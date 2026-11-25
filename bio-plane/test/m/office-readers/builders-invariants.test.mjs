/* office-readers, R15–R25: the exported element-reference builders and the
 * module's invariants (pure, never throws, never invents, hidden is never
 * omitted, no meaning, no place). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { docxEntry, docParaRef, docTableRef } from "../../../src/docx.mjs";
import { pptxEntry, slideShapeRef } from "../../../src/pptx.mjs";
import { xlsxEntry, sheetCellRef, usedSheetRange } from "../../../src/formats-xlsx.mjs";
import * as F from "./fixtures.mjs";

const ENTRIES = [docxEntry, pptxEntry, xlsxEntry];
const ODD = [undefined, null, 0, -1, 1.5, NaN, "", "PK\x03\x04", {}, [], true, new ArrayBuffer(3), new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])];

/* ------------------------------------------------------------------ R15–R16, R19 */

test("R15 docParaRef(para, run=null): {kind:'doc-para', ref:'¶<para+1>', para[, run]}; run only when given", () => {
  for (let p = 0; p < 300; p++) {
    assert.deepEqual(docParaRef(p), { kind: "doc-para", ref: `¶${p + 1}`, para: p });
    assert.ok(!("run" in docParaRef(p)));
    assert.ok(!("run" in docParaRef(p, null)));
    for (const r of [0, 1, 17]) assert.deepEqual(docParaRef(p, r), { kind: "doc-para", ref: `¶${p + 1}`, para: p, run: r });
  }
});

test("R16 docTableRef(table, cell=null): {kind:'doc-table', ref:'table <table+1>[, <cell>]', table[, cell]}", () => {
  for (let t = 0; t < 200; t++) {
    assert.deepEqual(docTableRef(t), { kind: "doc-table", ref: `table ${t + 1}`, table: t });
    assert.ok(!("cell" in docTableRef(t, null)));
    for (const c of ["A1", "B3", "AA10"]) assert.deepEqual(docTableRef(t, c), { kind: "doc-table", ref: `table ${t + 1}, ${c}`, table: t, cell: c });
  }
});

test("R19 slideShapeRef(slide, shape=null): {kind:'slide-shape', ref:'slide <slide>', slide[, shape]}", () => {
  for (let s = 1; s < 300; s++) {
    assert.deepEqual(slideShapeRef(s), { kind: "slide-shape", ref: `slide ${s}`, slide: s });
    assert.ok(!("shape" in slideShapeRef(s, null)));
    for (const sh of [0, 4]) assert.deepEqual(slideShapeRef(s, sh), { kind: "slide-shape", ref: `slide ${s}`, slide: s, shape: sh });
  }
});

/* ------------------------------------------------------------------ R20 */

test("R20 pure: the same bytes always give the same answer, whatever the clock, and nothing reaches the network", async () => {
  const inputs = [
    [docxEntry, F.docx({ core: F.core({ creator: "a" }), extra: [{ name: "word/embeddings/e.bin", data: "E" }, { name: "word/media/i.png", data: "I" }] })],
    [pptxEntry, F.pptx({ slides: [{ file: "slide1.xml", texts: ["x"], notes: "n" }] })],
    [xlsxEntry, F.xlsx({ definedNames: [{ name: "N", ref: "Sheet1!A1" }], extra: [{ name: "xl/embeddings/e.bin", data: "E" }] })],
  ];
  const realNow = Date.now, realFetch = globalThis.fetch, RealDate = globalThis.Date;
  const run = async (e, b) => ({ d: e.detect(b, null), s: await e.structure(b), t: await e.text(b) });
  for (const [e, b] of inputs) {
    const first = await run(e, b);
    globalThis.fetch = () => { throw new Error("network reached"); };
    Date.now = () => 0;
    globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [0])); } static now() { return 0; } };
    try {
      assert.deepEqual(await run(e, b), first, e.format);
      Date.now = () => 9e12;
      assert.deepEqual(await run(e, b), first, e.format);
    } finally { Date.now = realNow; globalThis.fetch = realFetch; globalThis.Date = RealDate; }
  }
});

/* ------------------------------------------------------------------ R21 */

test("R21 never throws: odd arguments to every slot of every entry, and to the builders", async () => {
  for (const e of ENTRIES) {
    for (const x of ODD) {
      for (const y of [null, "text/csv", 5, {}]) assert.doesNotThrow(() => e.detect(x, y), `${e.format}.detect`);
      await assert.doesNotReject(async () => e.parts(x), `${e.format}.parts`);
      await assert.doesNotReject(async () => e.structure(x), `${e.format}.structure`);
      await assert.doesNotReject(async () => e.text(x), `${e.format}.text`);
    }
  }
  for (const x of ODD) {
    assert.doesNotThrow(() => { docParaRef(x, x); docTableRef(x, x); sheetCellRef(x, x); usedSheetRange(x, x, x); slideShapeRef(x, x); });
  }
});

test("R21 never throws: character references past U+10FFFF, and randomly corrupted packages", async () => {
  /* R40 (fix round 9): a reference that names no character makes only its part unreadable, stated, and never throws */
  const big = "&#x110000;&#99999999;";
  const d = await docxEntry.text(F.docx({ body: F.wp(F.wr(big)) }));
  assert.equal(d.document, null, "the part holding a reference that is no character is unreadable");
  assert.ok(d.undetermined.some((u) => u.part === "word/document.xml" && u.why === "char_ref_invalid" && u.final === true));
  const p = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", texts: [big] }] }));
  assert.deepEqual(p.slides, []);
  assert.ok(p.undetermined.some((u) => u.why === "char_ref_invalid"));
  const x = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: big }] }] } }] }));
  assert.equal(x.sheets[0].text, "");
  assert.ok(x.undetermined.some((u) => u.reason === "char_ref_invalid"));
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const packages = [[docxEntry, F.docx({ comments: "<w:comments/>" })], [pptxEntry, F.pptx({ slides: [{ file: "slide1.xml", texts: ["a"], notes: "n" }] })], [xlsxEntry, F.xlsx({ sharedStrings: F.sst(["a"]) })]];
  for (const [e, b] of packages) {
    for (let i = 0; i < 150; i++) {
      const m = b.slice();
      const flips = 1 + Math.floor(rnd() * 6);
      for (let k = 0; k < flips; k++) m[Math.floor(rnd() * m.length)] = Math.floor(rnd() * 256);
      const cut = rnd() < 0.2 ? m.subarray(0, Math.floor(rnd() * m.length)) : m;
      assert.doesNotThrow(() => e.detect(cut, null));
      const parts = await e.parts(cut);
      const s = await e.structure(parts);
      const t = await e.text(parts);
      assert.equal(typeof s.ok, "boolean");
      assert.equal(typeof t.ok, "boolean");
    }
  }
});

/* ------------------------------------------------------------------ R22 */

test("R22 never invents: what cannot be established is stated — unresolvable slots, rels, bookmarks, sheet names and shared strings", async () => {
  const pres = `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rIdGone"/><p:sldId id="257"/><p:sldId id="258" r:id="rId10"/></p:sldIdLst></p:presentation>`;
  const p = await pptxEntry.parts(F.pptx({ presentation: pres }));
  assert.deepEqual(p.undetermined.filter((u) => u.part === "ppt/presentation.xml").map((u) => u.why), ["sldid_rel_unresolved:rIdGone", "sldid_rel_unresolved:no_rid"]);
  const pt = await pptxEntry.text(F.pptx({ presentation: pres }));
  assert.deepEqual(pt.slides.map((s) => s.slide), [3], "the resolvable slide keeps its declared slot; the others are not renumbered");
  // an orphan slide part outside the declaration is unnumbered, never numbered off its filename
  const orphan = await pptxEntry.text(F.pptx({ extra: [{ name: "ppt/slides/slide7.xml", data: F.slideXml(["stray"]) }] }));
  assert.deepEqual(orphan.slides.map((s) => [s.slide, s.text]), [[1, "Title"], [null, "stray"]]);
  assert.equal(orphan.deckLength, 1);
  // a <sheet> with no name: stated in parts().undetermined
  const wb = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const xp = await xlsxEntry.parts(F.xlsx({ workbook: wb }));
  assert.ok(xp.undetermined.some((u) => u.part === "xl/workbook.xml" && u.why === "sheet_name_absent:0"));
  // a sheet the workbook rels cannot resolve is stated, not skipped
  const xs = await xlsxEntry.text(F.xlsx({ wbRels: false }));
  assert.deepEqual(xs.sheets[0].undetermined, [{ sheet: 0, cell: null, reason: "sheet_rel_unresolved" }]);
  const xpp = await xlsxEntry.parts(F.xlsx({ wbRels: false }));
  assert.ok(xpp.undetermined.some((u) => u.part === "xl/_rels/workbook.xml.rels" && u.why === "part_absent"));
  // docx: a comment with no reference in the body has source null, not a guessed paragraph
  const ds = await docxEntry.structure(F.docx({ comments: `<w:comments xmlns:w="w"><w:comment w:id="3"><w:p><w:r><w:t>c</w:t></w:r></w:p></w:comment></w:comments>` }));
  assert.equal(ds.evidentiary.items[0].source, null);
  // the docx paragraph count is null, not 0, when the body was not read
  assert.equal((await docxEntry.structure(F.docx({ mainCd: F.OVER }))).paragraphs, null);
});

/* ------------------------------------------------------------------ R23 */

test("R23 nothing marked hidden is omitted from text(): hidden slides, sheets, rows and columns keep their content", async () => {
  const p = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", texts: ["seen"] }, { file: "slide2.xml", texts: ["secret slide"], show: "false", notes: "secret notes" }] }));
  assert.deepEqual(p.slides.map((s) => [s.hidden, s.text]), [[false, "seen"], [true, "secret slide"]]);
  assert.deepEqual(p.speakerNotes.map((s) => [s.hidden, s.text]), [[true, "secret notes"]]);
  assert.match(p.document, /secret slide/);
  const x = await xlsxEntry.text(F.xlsx({ sheets: [
    { name: "V", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "shown" }] }, { r: 2, hidden: true, cells: [{ r: "A2", t: "inlineStr", is: "hidden row" }] }], cols: [{ min: 2, max: 2, hidden: true }] } },
    { name: "H", state: "veryHidden", data: { rows: [{ r: 1, cells: [{ r: "B1", t: "inlineStr", is: "very hidden sheet" }] }] } },
  ] }));
  assert.equal(x.document, "shown\nhidden row\nvery hidden sheet");
  assert.deepEqual(x.sheets.map((s) => s.hidden), [false, "veryHidden"]);
});

/* ------------------------------------------------------------------ R24 */

function keysDeep(v, out = new Set()) {
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    if (v instanceof Map) for (const x of v.values()) keysDeep(x, out);
    else for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  }
  return out;
}

test("R24 asserts nothing about meaning and writes nothing: no grade or judgment in any output, and the input bytes are untouched", async () => {
  const inputs = [[docxEntry, F.docx()], [pptxEntry, F.pptx()], [xlsxEntry, F.xlsx()]];
  for (const [e, b] of inputs) {
    const before = b.slice();
    const outs = [await e.parts(b), await e.structure(b), await e.text(b)];
    assert.deepEqual(b, before, `${e.format} left its input unchanged`);
    const keys = keysDeep(outs);
    for (const k of ["grade", "meaning", "entity", "entities", "finding", "claim", "record", "store"]) assert.ok(!keys.has(k), `${e.format} output has no ${k}`);
  }
});

/* ------------------------------------------------------------------ R25 */

test("R25 no place is named: a document naming one jurisdiction reads exactly as the same document naming another", async () => {
  const swap = (v) => JSON.parse(JSON.stringify(v).replaceAll("Oakland", "Fairfax"));
  const builds = [
    [docxEntry, (n) => F.docx({ body: F.wp(F.wr(`City of ${n} council`)) })],
    [pptxEntry, (n) => F.pptx({ slides: [{ file: "slide1.xml", texts: [`${n} budget`] }] })],
    [xlsxEntry, (n) => F.xlsx({ sheets: [{ name: n, data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: n }] }] } }] })],
  ];
  for (const [e, build] of builds) {
    const a = build("Oakland"), b = build("Fairfax");
    const [sa, sb] = [await e.structure(a), await e.structure(b)];
    const [ta, tb] = [await e.text(a), await e.text(b)];
    const strip = (o) => { const c = structuredClone(o); delete c.images; return c; };
    assert.deepEqual(swap(strip(sa)), strip(sb), e.format);
    assert.deepEqual(swap(strip(ta)), strip(tb), e.format);
  }
});
