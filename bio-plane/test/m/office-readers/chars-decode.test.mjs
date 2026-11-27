/* office-readers, R40, R41 (fix round 9, G133c, G131g): a character reference that names no character never throws and
 * makes only its part unreadable; every text part is decoded through the one decode. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
/** @import { DocxText } from "../../../src/docx.mjs" */
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

const BAD = ["&#x110000;", "&#99999999999;", "&#xD800;", "&#0;", "&#12ab;", "&#xDFFF;", "&#;"];
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
/** @param {DocxText} t @param {string} part */
const stated = (t, part) => t.undetermined.find((u) => u.part === part && u.why === "char_ref_invalid");

test("R40 docx: every kind of invalid reference in the body states the body unreadable, the same on every call, and never throws", async () => {
  for (const bad of BAD) {
    const bytes = F.docx({ body: F.wp(F.wr(`before ${bad} after`)) });
    const first = await docxEntry.text(bytes);
    const second = await docxEntry.text(bytes);
    assert.equal(first.ok, true, bad);
    assert.equal(first.document, null, bad);
    const u = stated(first, "word/document.xml");
    assert.ok(u, bad);
    assert.ok("final" in u);
    assert.equal(u.final, true);
    assert.ok(second.ok);
    assert.deepEqual(second.undetermined, first.undetermined, "the same on every call");
    const s = await docxEntry.structure(bytes);
    assert.equal(s.ok, true);
    assert.ok(s.evidentiary.undetermined.some((x) => x.part === "word/document.xml" && x.why === "char_ref_invalid" && "final" in x && x.final === true));
  }
  /* controls: valid references are read */
  const ok = await docxEntry.text(F.docx({ body: F.wp(F.wr("A&#x41;&#66;&#x1F600; &amp; &lt;")) }));
  assert.ok(ok.ok);
  assert.equal(ok.document, "AAB😀 & <");
});

test("R40 docx: a bad reference in one other part states that part unreadable and the rest of the document is read", async () => {
  const bytes = F.docx({
    body: F.wp(F.wr("Body survives")),
    comments: `<w:comments ${W}><w:comment w:id="0"><w:p><w:r><w:t>bad &#x110000; here</w:t></w:r></w:p></w:comment></w:comments>`,
    rels: F.rels([{ id: "rIdFn", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes", target: "footnotes.xml" }]),
    extra: [{ name: "word/footnotes.xml", data: `<w:footnotes ${W}><w:footnote w:id="1"><w:p><w:r><w:t>x&#0;y</w:t></w:r></w:p></w:footnote></w:footnotes>` }],
  });
  const t = await docxEntry.text(bytes);
  assert.ok(t.ok);
  assert.equal(t.document, "Body survives");
  assert.deepEqual(t.undetermined.filter((u) => u.why === "char_ref_invalid").map((u) => [u.part, "final" in u ? u.final : undefined]).sort(), [["word/comments.xml", true], ["word/footnotes.xml", true]]);
  assert.deepEqual(t.parts, []);
});

test("R40 pptx and xlsx: a slide or a sheet holding a bad reference is unreadable and stated; the other slides and sheets are read", async () => {
  for (const bad of BAD) {
    const p = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", texts: ["fine slide"] }, { file: "slide2.xml", texts: [`oops ${bad}`] }] }));
    assert.equal(p.ok, true, bad);
    assert.deepEqual(p.slides.map((s) => s.text), ["fine slide"]);
    assert.ok(p.undetermined.some((u) => u.part === "ppt/slides/slide2.xml" && u.why === "char_ref_invalid" && "final" in u && u.final === true), bad);
    const x = await xlsxEntry.text(F.xlsx({ sheets: [
      { name: "A", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "fine" }] }] } },
      { name: "B", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: `oops ${bad}` }] }] } },
    ] }));
    assert.equal(x.ok, true, bad);
    assert.equal(x.sheets[0]?.text, "fine");
    assert.equal(x.sheets[1]?.text, "");
    assert.ok(x.undetermined.some((u) => {
      /** @type {object} */
      const o = u;
      return "reason" in o && o.reason === "char_ref_invalid" && "final" in o && o.final === true;
    }), bad);
  }
});

test("R40 a bad reference in the workbook part fails the workbook read by name and never throws", async () => {
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="A&#x110000;" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const parts = await xlsxEntry.parts(F.xlsx({ workbook: wb }));
  assert.equal(parts.ok, false);
  assert.equal(parts.why, "workbook_unreadable:char_ref_invalid");
});

/** @param {string} s @param {boolean} [bom] @returns {Uint8Array} */
function utf16le(s, bom = true) {
  const b = new Uint8Array((bom ? 2 : 0) + s.length * 2);
  if (bom) { b[0] = 0xff; b[1] = 0xfe; }
  for (let i = 0; i < s.length; i++) { b[(bom ? 2 : 0) + i * 2] = s.charCodeAt(i) & 255; b[(bom ? 2 : 0) + i * 2 + 1] = s.charCodeAt(i) >> 8; }
  return b;
}

test("R41 a UTF-16 document.xml (with or without a BOM) is read and not found empty; CDATA in w:t and a legacy declared charset are read", async () => {
  const doc = F.wdoc(F.wp(F.wr("Wide café text")));
  for (const bom of [true, false]) {
    const t = await docxEntry.text(F.docx({ document: utf16le(doc, bom) }));
    assert.ok(t.ok, `bom ${bom}`);
    assert.equal(t.document, "Wide café text", `bom ${bom}`);
  }
  const cd = await docxEntry.text(F.docx({ document: F.wdoc(F.wp(`<w:r><w:t><![CDATA[a < b & c]]></w:t></w:r>`)) }));
  assert.ok(cd.ok);
  assert.equal(cd.document, "a < b & c");
  const sheet = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", xml: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t><![CDATA[x < y]]></t></is></c></row></sheetData></worksheet>` }] }));
  assert.ok(sheet.ok);
  assert.equal(sheet.sheets[0]?.text, "x < y");
  const slide = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", xml: `<p:sld xmlns:p="p" xmlns:a="a"><p:sp><a:p><a:r><a:t><![CDATA[1 < 2]]></a:t></a:r></a:p></p:sp></p:sld>` }] }));
  assert.ok(slide.ok);
  assert.equal(slide.document, "1 < 2");
  /* windows-1252 declared in the prolog: the text equals the truth, never U+FFFD */
  const latin = new Uint8Array(Buffer.from(`<?xml version="1.0" encoding="windows-1252"?><w:document ${W}><w:body><w:p><w:r><w:t>Café résumé</w:t></w:r></w:p></w:body></w:document>`, "latin1"));
  const l = await docxEntry.text(F.docx({ document: latin }));
  assert.ok(l.ok);
  const latinText = l.document;
  assert.equal(latinText, "Café résumé");
  assert.ok(!latinText.includes("�"));
});

test("R41 a part decoded with more than 0.5 % replacement characters is stated partial with the count; an unsupported declared charset states ENCODING_UNSUPPORTED", async () => {
  const bad = new Uint8Array(Buffer.concat([Buffer.from(`<?xml version="1.0" encoding="utf-8"?><w:document ${W}><w:body><w:p><w:r><w:t>`), Buffer.from([0xff, 0xfe, 0xfd, 0xff, 0xff, 0xfe]), Buffer.from("tail</w:t></w:r></w:p></w:body></w:document>")]));
  const t = await docxEntry.text(F.docx({ document: bad }));
  assert.ok(t.ok);
  const partial = t.undetermined.find((u) => u.why === "partial");
  assert.ok(partial);
  assert.ok("replaced" in partial);
  assert.equal(partial.part, "word/document.xml");
  assert.ok(partial.replaced >= 4);
  const odd = new Uint8Array(Buffer.from(`<?xml version="1.0" encoding="x-no-such-charset"?><w:document ${W}><w:body/></w:document>`));
  const u = await docxEntry.text(F.docx({ document: odd }));
  assert.ok(u.ok);
  assert.equal(u.document, null);
  assert.ok(u.undetermined.some((x) => x.part === "word/document.xml" && x.why === "ENCODING_UNSUPPORTED" && "final" in x && x.final === true));
});
