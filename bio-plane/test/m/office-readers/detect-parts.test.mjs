/* office-readers, R1, R2, R4, R5: the three entries' formats, detection and parts()
 * (build/requirements/office-readers.md). Every test drives the entries
 * through their exported interface on packages built by ./fixtures.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { docxEntry, DOCX_CONTENT_TYPE } from "../../../src/docx.mjs";
import { pptxEntry, PPTX_CONTENT_TYPE } from "../../../src/pptx.mjs";
import { xlsxEntry, XLSX_CONTENT_TYPE } from "../../../src/formats-xlsx.mjs";
import * as F from "./fixtures.mjs";

const OOXML = [
  { entry: docxEntry, format: "docx", type: DOCX_CONTENT_TYPE, build: () => F.docx(), main: "word/document.xml" },
  { entry: pptxEntry, format: "pptx", type: PPTX_CONTENT_TYPE, build: () => F.pptx(), main: "ppt/presentation.xml" },
  { entry: xlsxEntry, format: "xlsx", type: XLSX_CONTENT_TYPE, build: () => F.xlsx(), main: "xl/workbook.xml" },
];
const ALL_TYPES = [DOCX_CONTENT_TYPE, PPTX_CONTENT_TYPE, XLSX_CONTENT_TYPE, "text/csv", "application/zip",
  "application/octet-stream", "text/plain", "application/vnd.oasis.opendocument.text", "", null, undefined];

/* ------------------------------------------------------------------ R1 */

test("R1 each entry's format is docx, pptx or xlsx", () => {
  assert.equal(docxEntry.format, "docx");
  assert.equal(pptxEntry.format, "pptx");
  assert.equal(xlsxEntry.format, "xlsx");
  for (const e of [docxEntry, pptxEntry, xlsxEntry]) {
    for (const slot of ["detect", "parts", "structure", "text"]) assert.equal(typeof e[slot], "function", `${e.format}.${slot}`);
  }
});

/* ------------------------------------------------------------------ R2 */

test("R2 docx/pptx/xlsx detect: null without ZIP magic, null on a magic-only prefix (no readable central directory)", () => {
  for (const { entry, build } of OOXML) {
    const full = build();
    assert.equal(entry.detect(new TextEncoder().encode("hello, world\n"), null), null);
    assert.equal(entry.detect(new Uint8Array(0), null), null);
    assert.equal(entry.detect(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), null), null);
    // the acquire-time 1 KiB prefix seam: magic present, central directory out of reach
    for (const n of [4, 30, full.length >> 1, full.length - 23]) assert.equal(entry.detect(full.subarray(0, n), null), null, `${entry.format} prefix ${n}`);
    // a bare prefix answers null even when the declared type is the format's own: bytes take precedence
    assert.equal(entry.detect(full.subarray(0, full.length >> 1), DOCX_CONTENT_TYPE), null);
  }
});

test("R2 docx/pptx/xlsx detect: a readable central directory naming [Content_Types].xml AND the main part is likely, never certain", () => {
  for (const { entry, format, build, main } of OOXML) {
    const d = entry.detect(build(), null);
    assert.equal(d.format, format);
    assert.equal(d.confidence, "likely");
    assert.ok(Array.isArray(d.signals) && d.signals.length > 0);
    // with a content type that disagrees, the bytes still answer (and still only "likely")
    assert.equal(entry.detect(build(), "text/plain").confidence, "likely");
    // missing the content-type map, or missing the main part: null
    const noTypes = F.zip([{ name: main, data: "<x/>" }, { name: "_rels/.rels", data: "<Relationships/>" }]);
    assert.equal(entry.detect(noTypes, null), null, `${format} without [Content_Types].xml`);
    const noMain = F.zip([...F.skeleton(format)]);
    assert.equal(entry.detect(noMain, null), null, `${format} without ${main}`);
    // another flavour's package is not this one
    for (const other of OOXML) if (other.format !== format) assert.equal(entry.detect(other.build(), null), null, `${format} on ${other.format}`);
  }
});

test("R2 docx/pptx/xlsx detect(null, contentType): likely exactly for the format's registered type, else null", () => {
  for (const { entry, format, type } of OOXML) {
    for (const ct of ALL_TYPES) {
      const d = entry.detect(null, ct);
      if (ct === type) {
        assert.equal(d.format, format);
        assert.equal(d.confidence, "likely");
        assert.ok(d.signals.length > 0);
      } else assert.equal(d, null, `${format} on ${ct}`);
    }
    assert.equal(entry.detect(null, type.toUpperCase()), null, "exact equality, not case-folded");
    assert.equal(entry.detect(null, ` ${type}`), null);
    assert.equal(entry.detect(null, `${type}; charset=binary`), null);
  }
});

/* ------------------------------------------------------------------ R4 */

test("R4 docx parts: an unreadable word/document.xml does not fail the read; the failure is in parts().undetermined and the text is null", async () => {
  const b = F.docx({ mainCd: F.CORRUPT });
  const p = await docxEntry.parts(b);
  assert.equal(p.ok, true);
  assert.equal(p.documentXml, null);
  assert.deepEqual(p.undetermined.find((u) => u.part === "word/document.xml"), { part: "word/document.xml", why: "crc_mismatch" });
  const t = await docxEntry.text(b);
  assert.equal(t.ok, true);
  assert.equal(t.document, null);
  assert.equal(t.undetermined[0].part, "word/document.xml");
  const s = await docxEntry.structure(b);
  assert.equal(s.ok, true);
  assert.equal(s.paragraphs, null);
});

test("R4 pptx parts: an unreadable ppt/presentation.xml does not fail the read; it is stated, and the slides are unnumbered (order null)", async () => {
  const b = F.pptx({ mainCd: F.CORRUPT, slides: [{ file: "slide1.xml", texts: ["One"] }, { file: "slide2.xml", texts: ["Two"] }] });
  const p = await pptxEntry.parts(b);
  assert.equal(p.ok, true);
  assert.equal(p.order, null);
  assert.ok(p.undetermined.some((u) => u.part === "ppt/presentation.xml" && u.why === "crc_mismatch"));
  const s = await pptxEntry.structure(b);
  assert.ok(s.notes.some((n) => /unnumbered/i.test(n)));
  const t = await pptxEntry.text(b);
  assert.deepEqual(t.slides.map((x) => [x.slide, x.text]), [[null, "One"], [null, "Two"]]);
  assert.equal(t.deckLength, null);
});

test("R4 docx/pptx parts: ok:false only when the bytes are not this format or the ZIP cannot be read", async () => {
  for (const [entry, own, others] of [[docxEntry, F.docx(), [F.pptx(), F.xlsx()]], [pptxEntry, F.pptx(), [F.docx(), F.xlsx()]]]) {
    assert.equal((await entry.parts(own)).ok, true);
    for (const o of others) {
      const p = await entry.parts(o);
      assert.equal(p.ok, false);
      assert.match(p.why, /^not_(docx|pptx):/);
      assert.ok(Array.isArray(p.signals));
    }
    for (const junk of [new TextEncoder().encode("not a zip"), own.subarray(0, 200), new Uint8Array(0)]) {
      const p = await entry.parts(junk);
      assert.equal(p.ok, false);
      assert.equal(typeof p.why, "string");
    }
    const plainZip = F.zip([{ name: "a.txt", data: "a" }]);
    assert.equal((await entry.parts(plainZip)).ok, false);
  }
});

/* ------------------------------------------------------------------ R5 */

test("R5 xlsx parts: an unreadable xl/workbook.xml fails the whole read as workbook_unreadable:<reason>", async () => {
  const p = await xlsxEntry.parts(F.xlsx({ workbookCd: F.CORRUPT }));
  assert.deepEqual(p, { ok: false, why: "workbook_unreadable:crc_mismatch" });
  const s = await xlsxEntry.structure(F.xlsx({ workbookCd: F.CORRUPT }));
  assert.deepEqual(s, { ok: false, container: "xlsx", reason: "workbook_unreadable:crc_mismatch" });
  const t = await xlsxEntry.text(F.xlsx({ workbookCd: F.CORRUPT }));
  assert.deepEqual(t, { ok: false, container: "xlsx", reason: "workbook_unreadable:crc_mismatch" });
  assert.equal((await xlsxEntry.parts(F.docx())).ok, false);
});

test("R5 xlsx parts: an unreadable sheet, sharedStrings or core part is carried in undetermined while ok stays true", async () => {
  const b = F.xlsx({
    sheets: [{ name: "A", cd: F.CORRUPT, data: {} }, { name: "B", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "s", v: "0" }] }] } }],
    sharedStrings: F.sst(["s0"]), sharedStringsCd: F.CORRUPT, core: F.core({ creator: "c" }),
    extra: [],
  });
  const p = await xlsxEntry.parts(b);
  assert.equal(p.ok, true);
  assert.ok(p.undetermined.some((u) => u.part === "xl/worksheets/sheet1.xml" && u.why === "crc_mismatch"));
  assert.ok(p.undetermined.some((u) => u.part === "xl/sharedStrings.xml" && u.why === "crc_mismatch"));
  const withBadCore = await xlsxEntry.parts(F.xlsx({ extra: [{ name: "docProps/core.xml", data: F.core({ creator: "x" }), cd: F.CORRUPT }] }));
  assert.equal(withBadCore.ok, true);
  assert.ok(withBadCore.undetermined.some((u) => u.part === "docProps/core.xml" && u.why === "crc_mismatch"));
});
