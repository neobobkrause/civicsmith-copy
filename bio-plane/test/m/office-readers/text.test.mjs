/* office-readers, R11–R12: text() — the I2 text shape per format, the size
 * guard (OOXML declared bytes). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { textPlan, STREAMED_TEXT_BOUND_BYTES, MEASURED_OOXML_TEXT_BOUND_BYTES } from "../../../src/ooxml.mjs";
import * as F from "./fixtures.mjs";

const sha = (s) => createHash("sha256").update(F.enc(s)).digest("hex");
const MiB = 1024 * 1024;
const BOUND = 20 * MiB;
/* The ceiling of a read in pieces (R35): over it, and only over it, the text is refused. */
const CEIL = STREAMED_TEXT_BOUND_BYTES;

function common(t, container, unitField) {
  assert.equal(t.ok, true);
  assert.equal(t.container, container);
  for (const k of ["document", "undetermined", "counts", "images", unitField]) assert.ok(k in t, `${container}.text has ${k}`);
  assert.ok(Array.isArray(t.undetermined));
}

/* ------------------------------------------------------------------ R11 */

test("R11 every text() carries {ok, container, document, undetermined, counts, images} and a per-unit list; ok:false when parts failed", async () => {
  common(await docxEntry.text(F.docx()), "docx", "paragraphs");
  common(await pptxEntry.text(F.pptx()), "pptx", "slides");
  common(await xlsxEntry.text(F.xlsx()), "xlsx", "sheets");
  const junk = F.enc("junk");
  for (const [e, c] of [[docxEntry, "docx"], [pptxEntry, "pptx"], [xlsxEntry, "xlsx"]]) {
    const t = await e.text(junk);
    assert.deepEqual(Object.keys(t).sort(), ["container", "ok", "reason"]);
    assert.equal(t.ok, false);
    assert.equal(t.container, c);
    assert.deepEqual(await e.text(undefined), { ok: false, container: c, reason: "PARTS_ABSENT" });
  }
});

test("R11 images: every image under the format's media directory, content-addressed and exhaustive; null when it could not be walked", async () => {
  for (const [e, build, dir] of [[docxEntry, F.docx, "word/media/"], [pptxEntry, F.pptx, "ppt/media/"], [xlsxEntry, F.xlsx, "xl/media/"]]) {
    const t = await e.text(build({ extra: [{ name: `${dir}a.png`, data: "PNG" }, { name: `${dir}b.jpeg`, data: "JPG" }, { name: `${dir}notes.txt`, data: "t" }, { name: "other/c.png", data: "C" }] }));
    assert.deepEqual(t.images, [
      { kind: "image", ref: `image ${sha("PNG").slice(0, 12)}`, part: sha("PNG"), mime: "image/png", name: "a.png" },
      { kind: "image", ref: `image ${sha("JPG").slice(0, 12)}`, part: sha("JPG"), mime: "image/jpeg", name: "b.jpeg" },
    ]);
    assert.deepEqual((await e.text(build())).images, []);
    const bad = await e.text(build({ extra: [{ name: `${dir}a.png`, data: "PNG", cd: F.CORRUPT }] }));
    assert.equal(bad.images, null);
  }
});

test("R11 docx text: <w:t> joined per paragraph, deleted text never in it, inserted text in it; paragraphs one per <w:p> incl. tables; tables in order, nested included", async () => {
  const cell = (t) => `<w:tc><w:p>${F.wr(t)}</w:p></w:tc>`;
  const nested = `<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr>${cell("in")}</w:tr></w:tbl>`;
  const body = F.wp(F.wr("A"), '<w:ins w:author="x">' + F.wr("+ins") + "</w:ins>", '<w:del><w:r><w:delText>gone</w:delText></w:r></w:del>', "<w:r><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r>")
    + `<w:tbl><w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid><w:tr>${cell("r1c1")}<w:tc>${nested}<w:p/></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p>${F.wr("wide")}</w:p></w:tc></w:tr></w:tbl>`
    + F.wp() + F.wp(F.wr("&amp;&lt;&#x263A;"));
  const t = await docxEntry.text(F.docx({ body }));
  assert.deepEqual(t.paragraphs, [
    { para: 0, ref: "¶1", text: "A+ins\tb\nc" }, { para: 1, ref: "¶2", text: "r1c1" }, { para: 2, ref: "¶3", text: "in" },
    { para: 3, ref: "¶4", text: "" }, { para: 4, ref: "¶5", text: "wide" }, { para: 5, ref: "¶6", text: "" }, { para: 6, ref: "¶7", text: "&<☺" },
  ]);
  assert.equal(t.document, "A+ins\tb\nc\nr1c1\nin\nwide\n&<☺");
  assert.ok(!t.document.includes("gone"));
  const tc = (table, cell, value, paras) => ({ source: { kind: "doc-table", ref: `table ${table + 1}, ${cell}`, table, cell }, value, type: "text", declared: null, cached: null, formula: null, paras });
  assert.deepEqual(t.tables, [
    { table: 0, ref: "table 1", rows: 2, cols: 3, cells: [tc(0, "A1", "r1c1", [1]), tc(0, "A2", "wide", [4])] },
    { table: 1, ref: "table 2", rows: 1, cols: 1, cells: [tc(1, "A1", "in", [2])] },
  ]);
  assert.deepEqual((await docxEntry.text(F.docx({ body: F.wp(F.wr("x")) }))).tables, [], "a body with no tables is an empty list");
  assert.equal((await docxEntry.text(F.docx({ mainCd: F.CORRUPT }))).tables, null, "an unread body is null, never []");
});

test("R11 docx text: a paragraph inside a text box does not end its anchoring paragraph; the outer paragraph keeps its later text", async () => {
  const box = '<w:r><w:drawing><wps:txbx xmlns:wps="urn:wps"><w:txbxContent><w:p>' + F.wr("boxed") + "</w:p></w:txbxContent></wps:txbx></w:drawing></w:r>";
  const t = await docxEntry.text(F.docx({ body: F.wp(F.wr("before "), box, F.wr("after")) + F.wp(F.wr("next")) }));
  assert.deepEqual(t.paragraphs.map((p) => [p.para, p.text]), [[0, "before after"], [1, "boxed"], [2, "next"]]);
  const rels = F.rels([{ id: "rIdH", target: "http://example.org/", external: true }]);
  const s = await docxEntry.structure(F.docx({ rels, body: F.wp(F.wr("x"), box, `<w:hyperlink r:id="rIdH">${F.wr("link")}</w:hyperlink>`) }));
  assert.deepEqual(s.links[0].source, { kind: "doc-para", ref: "¶1", para: 0, run: 2 }, "a link after the box belongs to the outer paragraph, at its own run index");
});

test("R11 pptx text: slide text only, in deck order; speaker notes a distinct list never in document; hidden slides populated; deckLength from declared slots", async () => {
  const b = F.pptx({
    slides: [
      { file: "slide3.xml", texts: ["Third file, first slide", "second shape"], notes: "candid" },
      { file: "slide1.xml", texts: ["hidden one"], show: "0", notes: "hidden notes" },
      { file: "slide2.xml", texts: [] },
    ],
  });
  const t = await pptxEntry.text(b);
  assert.deepEqual(t.slides, [
    { slide: 1, ref: "slide 1", part: "ppt/slides/slide3.xml", hidden: false, shapes: 2, text: "Third file, first slide\nsecond shape" },
    { slide: 2, ref: "slide 2", part: "ppt/slides/slide1.xml", hidden: true, shapes: 1, text: "hidden one" },
    { slide: 3, ref: "slide 3", part: "ppt/slides/slide2.xml", hidden: false, shapes: 0, text: "" },
  ]);
  assert.deepEqual(t.speakerNotes, [
    { slide: 1, ref: "slide 1 (notes)", part: "ppt/notesSlides/notes_slide3.xml", hidden: false, text: "candid" },
    { slide: 2, ref: "slide 2 (notes)", part: "ppt/notesSlides/notes_slide1.xml", hidden: true, text: "hidden notes" },
  ]);
  assert.equal(t.document, "Third file, first slide\nsecond shape\nhidden one");
  assert.ok(!t.document.includes("candid"));
  assert.equal(t.counts.chars, t.document.length);
  assert.equal(t.counts.notesChars, "candid".length + "hidden notes".length);
  assert.equal(t.deckLength, 3);
  // an unresolvable sldId slot still counts toward the deck's length, and a trailing unreadable slide does not shorten it
  const pres = `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId10"/><p:sldId id="257" r:id="rIdGone"/><p:sldId id="258" r:id="rId11"/></p:sldIdLst></p:presentation>`;
  const t2 = await pptxEntry.text(F.pptx({ presentation: pres, slides: [{ file: "a.xml", texts: ["a"] }, { file: "b.xml", texts: ["b"], cd: F.CORRUPT }] }));
  assert.equal(t2.deckLength, 3);
  assert.deepEqual(t2.slides.map((s) => s.slide), [1]);
  assert.ok(t2.undetermined.some((u) => u.reason === "slide_unreadable" && u.part === "ppt/slides/b.xml"));
});

test("R11 xlsx text: tab-joined rows, newline-joined across rows and sheets; the fixed grid bound; the used range from cells; shared strings stated when unresolvable", async () => {
  const b = F.xlsx({
    sheets: [
      { name: "One", data: { rows: [
        { r: 1, cells: [{ r: "A1", t: "s", v: "0" }, { r: "B1", v: "3.5" }, { r: "C1", t: "b", v: "1" }] },
        { r: 2, cells: [{ r: "A2", t: "s", v: "7" }, { r: "C2", t: "inlineStr", is: "inline" }, { r: "D2", t: "e", v: "#DIV/0!" }] },
        { r: 3, cells: [{ r: "A3", t: "str", f: "A1&amp;\"!\"", v: "zero!" }] },
        { r: 40, cells: [] },
      ] } },
      { name: "Two", state: "hidden", data: { rows: [{ r: 2, cells: [{ r: "B2", t: "inlineStr", is: "hidden text" }] }] } },
      { name: "Empty", data: {} },
    ],
    sharedStrings: `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><t>ze</t></r><r><t>ro</t></r><rPh sb="0" eb="1"><t>PHON</t></rPh></si></sst>`,
  });
  const t = await xlsxEntry.text(b);
  assert.equal(t.document, "zero\t3.5\tTRUE\ninline\t#DIV/0!\nzero!\nhidden text");
  assert.deepEqual(t.sheets.map((s) => s.lineRows), [[1, 2, 3], [2], []]);
  assert.deepEqual(t.sheets.map(({ text, cells, lineRows, ...s }) => s), [
    { sheet: 0, name: "One", hidden: false, rows: 1048576, cols: 16384, usedRows: 3, usedCols: 4, range: { kind: "sheet-range", ref: "One!A1:D3", sheet: "One", range: "A1:D3" }, undetermined: [{ sheet: 0, cell: "A2", reason: "shared_string_index_out_of_range" }] },
    { sheet: 1, name: "Two", hidden: "hidden", rows: 1048576, cols: 16384, usedRows: 2, usedCols: 2, range: { kind: "sheet-range", ref: "Two!A1:B2", sheet: "Two", range: "A1:B2" }, undetermined: [] },
    { sheet: 2, name: "Empty", hidden: false, rows: 1048576, cols: 16384, usedRows: 0, usedCols: 0, range: null, undetermined: [] },
  ]);
  assert.ok(!t.document.includes("PHON"), "a phonetic reading guide is not the cell's text");
  const noSst = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "s", v: "0" }] }] } }], sharedStrings: F.sst(["x"]), sharedStringsCd: F.CORRUPT }));
  assert.deepEqual(noSst.undetermined, [{ sheet: 0, cell: "A1", reason: "shared_strings_unreadable" }]);
  const unread = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: {}, cd: F.CORRUPT }] }));
  assert.deepEqual(unread.sheets[0], { sheet: 0, name: "S", hidden: false, rows: 1048576, cols: 16384, usedRows: null, usedCols: null, range: null, text: "", cells: null, undetermined: [{ sheet: 0, cell: null, reason: "crc_mismatch" }] });
});

/* ------------------------------------------------------------------ R12 */

test("R12 docx guard: word/document.xml + word/comments.xml declared bytes over the bound refuse text with the guard's marker verbatim; rels and core still run", async () => {
  const half = { usize: CEIL / 2 + 1 };
  const rels = F.rels([{ id: "rIdH", target: "http://example.org/", external: true }]);
  const b = F.docx({ mainCd: half, comments: "<w:comments/>", commentsCd: half, rels, core: F.core({ creator: "c" }) });
  const t = await docxEntry.text(b);
  assert.equal(t.document, null);
  assert.deepEqual(t.paragraphs, []);
  assert.equal(t.tables, null);
  assert.deepEqual(t.undetermined, [textPlan(CEIL + 2).guard]);
  assert.equal(t.undetermined[0].final, true);
  assert.equal(t.undetermined[0].size, CEIL + 2);
  const s = await docxEntry.structure(b);
  assert.equal(s.links[0].target.url, "http://example.org/");
  assert.equal(s.evidentiary.items.find((i) => i.kind === "core-properties").creator, "c");
  assert.ok(s.evidentiary.undetermined.some((u) => u.why === "over_size_bound"));
  // exactly at the bound is not over it
  const at = await docxEntry.text(F.docx({ mainCd: { usize: MEASURED_OOXML_TEXT_BOUND_BYTES } }));
  assert.ok(!at.undetermined.some((u) => u.why === "over_size_bound"));
  // parts outside the guarded family do not count toward it
  const other = await docxEntry.text(F.docx({ extra: [{ name: "word/styles.xml", data: "<x/>", cd: { usize: BOUND * 2 } }] }));
  assert.equal(other.document, "Hello");
});

test("R12 pptx guard: every slide + notesSlide part summed; over it text is refused while presentation.xml numbering, deckLength and hidden flags survive", async () => {
  const b = F.pptx({ slides: [
    { file: "slide1.xml", texts: ["a"], cd: { usize: CEIL / 2 }, notes: "n" },
    { file: "slide2.xml", texts: ["b"], sldIdShow: "0", cd: { usize: CEIL / 2 } },
  ] });
  const t = await pptxEntry.text(b);
  assert.equal(t.document, null);
  assert.deepEqual(t.slides, []);
  assert.deepEqual(t.speakerNotes, []);
  assert.equal(t.deckLength, 2);
  assert.equal(t.undetermined[0].why, "over_size_bound");
  assert.equal(t.undetermined[0].boundName, "STREAMED_TEXT_BOUND_BYTES");
  const s = await pptxEntry.structure(b);
  assert.equal(s.slides, 2);
  assert.deepEqual(s.evidentiary.items.filter((i) => i.kind === "hidden-slide").map((i) => i.slide), [2]);
});

test("R12 xlsx guard: every worksheet part + sharedStrings summed; over it text is refused while workbook names, order and hidden state survive", async () => {
  const b = F.xlsx({ sheets: [{ name: "A", data: {}, cd: { usize: CEIL } }, { name: "B", state: "hidden", data: {} }], sharedStrings: F.sst(["x"]) });
  const t = await xlsxEntry.text(b);
  assert.equal(t.document, null);
  assert.equal(t.undetermined.length, 1);
  assert.equal(t.undetermined[0].metric, "declared_uncompressed_text_part_bytes");
  const s = await xlsxEntry.structure(b);
  assert.deepEqual(s.sheets.map((x) => [x.name, x.hidden]), [["A", false], ["B", "hidden"]]);
  assert.ok(s.notes.includes("text_parts_over_bound"));
});
