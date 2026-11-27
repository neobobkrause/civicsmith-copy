/* office-readers, R42, R43, R44, R45 (fix round 9, G133d, G125d, G124c, G128e): linear work, streamed identities, the
 * retained-objects bound before the walk, table cells omitted past the caller's cap. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as F from "./fixtures.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
/** @import { DocxText, DocLinkTarget } from "../../../src/docx.mjs" */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const RETAINED = boundOf("office", "retained_objects");

test("R44 the bound is the table's row (250,000 paragraphs, cells and links together)", () => {
  assert.equal(RETAINED, 250000);
});

/* ------------------------------------------------------------------ R42 */

/** @param {string} inner */
const docWith = (inner) => F.docx({ document: `<?xml version="1.0"?><w:document ${W}><w:body>${inner}</w:body></w:document>` });
/** @type {{[name: string]: () => string}} */
const shapes = {
  "an unterminated tag": () => F.wp(F.wr("kept")) + "<w:comment " + "x".repeat(200000),
  "40,000 copies of an open attribute": () => F.wp(F.wr("kept")) + '<a b="'.repeat(40000),
  "20,000 unclosed comments": () => F.wp(F.wr("kept")) + "<w:comment ".repeat(20000),
  "200,000 declarations": () => F.wp(F.wr("kept")) + "<!x>".repeat(200000),
  "a long run of less-than signs": () => F.wp(F.wr("kept")) + "<".repeat(300000),
  "an unterminated comment": () => F.wp(F.wr("kept")) + "<!--" + "-".repeat(300000),
};

test("R42 docx: whatever the shape, the scan examines each byte at most 4 times (counts.scanned_bytes), and the walk still reads what it can", async () => {
  for (const [name, make] of Object.entries(shapes)) {
    const inner = make();
    const part = `<?xml version="1.0"?><w:document ${W}><w:body>${inner}</w:body></w:document>`;
    const t = await docxEntry.text(docWith(inner));
    assert.equal(t.ok, true, name);
    assert.ok(t.counts.scanned_bytes <= 4 * part.length, `${name}: ${t.counts.scanned_bytes} vs ${4 * part.length}`);
    const doc = t.document;
    assert.ok(typeof doc === "string" && doc.startsWith("kept"), name);
  }
  const over = await docxEntry.text(docWith(F.wp(F.wr("kept")) + '<a b="'.repeat(40000)));
  assert.ok(over.ok);
  assert.ok(over.undetermined.some((u) => u.why === "tag_over_bound"), "a tag longer than 64 KiB is not a tag, and is stated");
  assert.ok(over.undetermined.every((u) => u.why !== "tag_over_bound" || u.part === "word/document.xml"));
});

test("R42 pptx and xlsx: hostile shapes are linear too", async () => {
  for (const [name, make] of Object.entries(shapes)) {
    const tail = make().replace(/^<w:p>.*?<\/w:p>/, "");
    const slide = `<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>kept</a:t></a:r></a:p>${tail}</p:sld>`;
    const p = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", xml: slide }] }));
    assert.ok(p.ok);
    assert.ok(p.counts.scanned_bytes <= 4 * slide.length, `pptx ${name}: ${p.counts.scanned_bytes}`);
    assert.equal(p.slides[0]?.text, "kept", name);
    const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>kept</t></is></c></row>${tail}</sheetData></worksheet>`;
    const x = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", xml: sheet }] }));
    assert.ok(x.ok);
    assert.ok(x.counts.scanned_bytes <= 4 * sheet.length, `xlsx ${name}: ${x.counts.scanned_bytes}`);
    assert.equal(x.sheets[0]?.text, "kept", name);
  }
});

test("R42 text(parts, {yieldNow}) awaits yieldNow at least every 65,536 tokens; the answer is the same without it", async () => {
  const body = F.wp(F.wr("x")).repeat(60000); // 4 tokens a paragraph's tags plus text: 300,000 tokens
  const bytes = docWith(body);
  let calls = 0;
  const withYield = await docxEntry.text(bytes, { yieldNow: async () => { calls++; } });
  const without = await docxEntry.text(bytes);
  assert.ok(calls >= Math.floor(300000 / 65536), `yieldNow called ${calls} times`);
  assert.deepEqual(withYield, without);
  let sCalls = 0;
  await docxEntry.structure(bytes, { yieldNow: () => { sCalls++; } });
  assert.ok(sCalls >= 1, "structure() yields too");
  /* a yieldNow that throws or rejects is no yield, and a non-function is ignored */
  const bad = await docxEntry.text(bytes, { yieldNow: () => { throw new Error("no"); } });
  assert.deepEqual(bad, without);
  assert.deepEqual(await docxEntry.text(bytes, { yieldNow: 7 }), without);
});

/* ------------------------------------------------------------------ R43 */

/** @param {Uint8Array} b */
const sha = (b) => createHash("sha256").update(b).digest("hex");

test("R43 an embedded part's identity is taken as it streams; a member over MEMBER_MAX or ARCHIVE_RATIO_MAX is refused by that name before inflation", async () => {
  const payload = Buffer.alloc(3 * 1048576, 7);
  for (let i = 0; i < payload.length; i += 977) payload[i] = i % 251;
  const rel = F.rels([{ id: "rIdE", type: F.RT.package, target: "embeddings/ok.bin" }]);
  const parts = [
    { name: "word/embeddings/ok.bin", data: payload },
    { name: "word/embeddings/ratio.bin", data: "zzzz", cd: { usize: 5 * 1048576 }, ld: { usize: 5 * 1048576 } },
  ];
  const s = await docxEntry.structure(F.docx({ rels: rel, extra: parts }));
  assert.equal(s.ok, true);
  const intra = s.links.find((l) => l.partition === "intra");
  assert.ok(intra);
  const intraTarget = intra.target;
  assert.ok("sha256" in intraTarget);
  assert.equal(intraTarget.sha256, sha(payload));
  assert.equal(intraTarget.bytes, payload.length);
  const refused = Object.fromEntries(s.links.filter((l) => l.partition === "undetermined").map((l) => {
    const target = l.target;
    /** @type {[string, DocLinkTarget]} */
    const entry = [String("part" in target ? target.part : undefined), target];
    return entry;
  }));
  const ratio = refused["word/embeddings/ratio.bin"];
  assert.ok(ratio);
  assert.ok("detail" in ratio);
  assert.equal(ratio.detail, "ARCHIVE_RATIO_MAX");
  assert.ok("limit" in ratio);
  assert.equal(ratio.limit, 1100);
  /* a member declaring more than the member cap makes the archive's declared total pass its cap too: the file is refused by that name */
  const huge = await docxEntry.parts(F.docx({ extra: [{ name: "word/embeddings/huge.bin", data: "zzzz", cd: { usize: 300 * 1048576 } }] }));
  assert.equal(huge.ok, false);
  assert.match(String(huge.why), /ARCHIVE_TOTAL_MAX|MEMBER_MAX/);
  /* pptx and xlsx take the same path */
  const p = await pptxEntry.structure(F.pptx({ extra: [{ name: "ppt/embeddings/ok.bin", data: payload }, { name: "ppt/embeddings/ratio.bin", data: "zzzz", cd: { usize: 5 * 1048576 }, ld: { usize: 5 * 1048576 } }] }));
  assert.ok(p.ok);
  const pIntra = p.links.find((l) => l.partition === "intra");
  assert.ok(pIntra);
  const pIntraTarget = pIntra.target;
  assert.ok("sha256" in pIntraTarget);
  assert.equal(pIntraTarget.sha256, sha(payload));
  const pRefused = p.links.find((l) => l.partition === "undetermined");
  assert.ok(pRefused);
  const pRefusedTarget = pRefused.target;
  assert.ok("detail" in pRefusedTarget);
  assert.equal(pRefusedTarget.detail, "ARCHIVE_RATIO_MAX");
  const x = await xlsxEntry.structure(F.xlsx({ extra: [{ name: "xl/embeddings/ok.bin", data: payload }, { name: "xl/embeddings/ratio.bin", data: "zzzz", cd: { usize: 5 * 1048576 }, ld: { usize: 5 * 1048576 } }] }));
  assert.ok(x.ok);
  const xIntra = x.links.find((l) => l.partition === "intra");
  assert.ok(xIntra);
  const xIntraTarget = xIntra.target;
  assert.ok("sha256" in xIntraTarget);
  assert.equal(xIntraTarget.sha256, sha(payload));
  const xRefused = x.links.find((l) => l.partition === "undetermined");
  assert.ok(xRefused);
  const xRefusedTarget = xRefused.target;
  assert.ok("why" in xRefusedTarget);
  assert.match(xRefusedTarget.why, /ARCHIVE_RATIO_MAX/);
});

/* ------------------------------------------------------------------ R44 */

/** @param {DocxText} t @param {string} [part] */
const refusal = (t, part = "word/document.xml") => t.undetermined.find((u) => u.part === part && u.why === "TOO_MANY_OBJECTS");

test("R44 docx: a body that would retain more than 250,000 paragraphs, cells and links is refused before the walk, by name and with its figure; at the bound it is read", async () => {
  /** @type {{[name: string]: () => string}} */
  const shapesOver = {
    "empty paragraphs": () => "<w:p/>".repeat(RETAINED + 1),
    "one-cell tables": () => "<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>".repeat(Math.floor(RETAINED / 2) + 1),
    "hyperlinks": () => F.wp("<w:hyperlink/>".repeat(RETAINED)),
    "nested tables": () => "<w:tbl><w:tr><w:tc>".repeat(RETAINED + 1) + "<w:p/>" + "</w:tc></w:tr></w:tbl>".repeat(RETAINED + 1),
  };
  for (const [name, make] of Object.entries(shapesOver)) {
    const t = await docxEntry.text(docWith(make()));
    assert.equal(t.ok, true, name);
    assert.equal(t.document, null, name);
    const r = refusal(t);
    assert.ok(r, name);
    assert.ok("bound" in r && "n" in r);
    assert.equal(r.bound, RETAINED);
    assert.ok(r.n > RETAINED, `${name}: n ${r.n}`);
    assert.equal(r.final, true);
    assert.deepEqual(t.paragraphs, []);
    assert.equal(t.tables, null);
    const s = await docxEntry.structure(docWith(make()));
    assert.ok(s.ok);
    assert.ok(s.evidentiary.undetermined.some((u) => u.why === "TOO_MANY_OBJECTS" && "final" in u && u.final === true), `structure ${name}`);
  }
  const edge = await docxEntry.text(docWith("<w:p/>".repeat(RETAINED)));
  assert.ok(edge.ok);
  assert.equal(edge.paragraphs.length, RETAINED, "exactly at the bound the body is read");
  assert.equal(refusal(edge), undefined);
});

test("R44 decoded characters: the figure is the table's row, taken through boundOf", () => {
  assert.equal(boundOf("office", "decoded_chars"), 64 * 1048576);
});

test("R44 pptx and xlsx: a deck past the figure is refused by name; a workbook whose typed cells would pass it is refused unless the caller asks for them held", async () => {
  const slide = `<p:sld xmlns:p="p" xmlns:a="a">${"<a:p/>".repeat(RETAINED + 1)}</p:sld>`;
  const p = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", xml: slide }] }));
  assert.ok(p.ok);
  assert.equal(p.document, null);
  assert.ok(p.undetermined.some((u) => u.why === "TOO_MANY_OBJECTS" && "bound" in u && u.bound === RETAINED && "final" in u && u.final === true));
  /** @type {unknown[]} */
  const rows = [];
  let xml = "";
  for (let r = 1; r <= 62600; r++) xml += `<row r="${r}"><c r="A${r}"><v>${r}</v></c><c r="B${r}"><v>1</v></c><c r="C${r}"><v>2</v></c><c r="D${r}"><v>3</v></c></row>`;
  void rows;
  const book = F.xlsx({ sheets: [{ name: "S", xml: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xml}</sheetData></worksheet>` }] });
  const refused = await xlsxEntry.text(book);
  assert.ok(refused.ok);
  assert.equal(refused.document, null);
  assert.ok(refused.undetermined.some((u) => "why" in u && u.why === "TOO_MANY_OBJECTS" && "bound" in u && u.bound === RETAINED && "n" in u && u.n > RETAINED && "final" in u && u.final === true));
  const held = await xlsxEntry.text(book, { inlineCellsMax: 512 * 1024 });
  assert.ok(held.ok);
  const heldDoc = held.document;
  assert.ok(heldDoc !== null);
  assert.ok(heldDoc.length > 0);
  assert.equal(held.sheets[0]?.cells, null);
  assert.equal(held.sheets[0]?.cells_held, true);
});

/* ------------------------------------------------------------------ R45 */

/** @param {number} rows */
const tableDoc = (rows) => {
  let body = F.wp(F.wr("INTRO"));
  body += "<w:tbl><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>";
  for (let i = 1; i <= rows; i++) body += `<w:tr><w:tc>${F.wp(F.wr(`row ${i} left`))}</w:tc><w:tc>${F.wp(F.wr(`row ${i} right`))}</w:tc></w:tr>`;
  body += "</w:tbl>" + F.wp(F.wr("ENDMARKER"));
  return F.docx({ body });
};

test("R45 past opts.inlineCellsMax the cells of a docx table are omitted with a statement; the paragraphs and document carry every cell's text to the last", async () => {
  const bytes = tableDoc(1500);
  const full = await docxEntry.text(bytes);
  assert.ok(full.ok);
  const fullTable = full.tables?.[0];
  assert.ok(fullTable);
  assert.equal(fullTable.cells?.length, 3000);
  assert.equal(fullTable.cells_omitted, undefined);
  const cap = 512 * 1024;
  const small = await docxEntry.text(tableDoc(20), { inlineCellsMax: cap });
  assert.ok(small.ok);
  const smallTable = small.tables?.[0];
  assert.ok(smallTable);
  assert.equal(smallTable.cells?.length, 40, "under the cap the cells are listed");
  assert.equal(smallTable.cells_omitted, undefined);
  const t = await docxEntry.text(bytes, { inlineCellsMax: 100 * 1024 });
  assert.ok(t.ok);
  const table = t.tables?.[0];
  assert.ok(table);
  assert.equal(table.cells, null);
  assert.equal(table.cells_omitted, true);
  const s = t.undetermined.find((u) => u.why === "cells_omitted");
  assert.ok(s);
  assert.ok("bound" in s && "size" in s);
  assert.equal(s.bound, 100 * 1024);
  assert.ok(s.size > 100 * 1024);
  const tDoc = t.document;
  assert.ok(tDoc !== null);
  assert.ok(tDoc.includes("row 1500 right") && tDoc.endsWith("ENDMARKER"));
  assert.ok(t.paragraphs.some((p) => p.text === "row 1500 right"));
  assert.equal(table.rows, 1500);
  /* without the option, or with one that is not a number, every cell is listed */
  const notNumber = await docxEntry.text(bytes, { inlineCellsMax: "x" });
  assert.ok(notNumber.ok);
  assert.equal(notNumber.tables?.[0]?.cells?.length, 3000);
  /* a deck lists no table cells, so none are omitted */
  const p = await pptxEntry.text(F.pptx(), { inlineCellsMax: 0 });
  assert.equal(p.ok, true);
});

test("R43 a 100 MiB embedding in a small file is passed through ooxml's streamMember: the buffers held while it is hashed stay within a read window and an inflate chunk", async () => {
  const big = F.docx({ extra: [{ name: "word/embeddings/zeros.bin", data: Buffer.alloc(100 * 1048576) }] });
  assert.ok(big.length < 400 * 1024, `the package is small: ${big.length}`);
  /** @type {number} */
  const base = process.memoryUsage().arrayBuffers;
  let peak = base;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().arrayBuffers); }, 2);
  const s = await docxEntry.structure(big);
  clearInterval(timer);
  peak = Math.max(peak, process.memoryUsage().arrayBuffers);
  assert.ok(s.ok);
  const intra = s.links.find((l) => l.partition === "intra");
  assert.ok(intra);
  const intraTarget = intra.target;
  assert.ok("bytes" in intraTarget);
  assert.equal(intraTarget.bytes, 100 * 1048576);
  assert.equal(intraTarget.sha256, createHash("sha256").update(Buffer.alloc(100 * 1048576)).digest("hex"));
  assert.ok(peak - base < 48 * 1048576, `peak ArrayBuffer growth ${(peak - base) / 1048576} MiB`);
});

test("R12 docx: the declared bytes of every part inflated for text count, the footnotes, endnotes, headers and footers with the body and comments; over the ceiling the text is refused with the guard's marker", async () => {
  const rels = F.rels([{ id: "rIdFn", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes", target: "footnotes.xml" }]);
  const bytes = F.docx({ body: F.wp(F.wr("small")), rels, extra: [{ name: "word/footnotes.xml", data: `<w:footnotes ${W}/>`, cd: F.OVER }] });
  const t = await docxEntry.text(bytes);
  assert.ok(t.ok);
  assert.equal(t.document, null);
  const over = t.undetermined[0];
  assert.ok(over);
  assert.equal(over.why, "over_size_bound");
  assert.ok("final" in over);
  assert.equal(over.final, true);
  /* the ceiling is the table's figure, quoted not copied */
  assert.ok("bound" in over);
  assert.equal(over.bound, 32 * 1048576);
  /* control: the same package with a small footnotes part is read */
  const ok = await docxEntry.text(F.docx({ body: F.wp(F.wr("small")), rels, extra: [{ name: "word/footnotes.xml", data: `<w:footnotes ${W}/>` }] }));
  assert.ok(ok.ok);
  assert.equal(ok.document, "small");
});
