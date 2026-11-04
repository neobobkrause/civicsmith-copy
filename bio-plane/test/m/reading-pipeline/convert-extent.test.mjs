/* reading-pipeline: the container's own extent (R12) over REAL office bytes, read by the REAL registered entries (docx,
   xlsx, pptx, odt, ods, pdf) through `read`, called directly. Moved from `extraction`'s convert-extent.test.mjs
   (N513), its assertions unchanged; `extraction` keeps the cases on its persistence (its R19, R20, R27, R30). Its
   share of two legacy suites, rows of `build/jobs/T17/legacy-tests.md`: `test/fw19-extent-arms.test.mjs` and
   `test/capture-container-extent.test.mjs` (deleted in T20, K931). The containers are assembled here byte by byte
   with an independent crc32, as the old suites built them, so every figure below is the fixture's own ground truth. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { fresh, hold, doc, sha } from "./fixture.mjs";
import { getFormat } from "../../../src/formats.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";

/* ---- independent crc32 and zip assembler (the old suites' own; nothing here imports the container reader) ---- */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
  return (c ^ 0xffffffff) >>> 0;
}
const u16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);
const u32 = (n) => Buffer.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
/* `store` writes a member uncompressed (ODF's mimetype); `declare` lies in the central directory only about the
   uncompressed size, so a small fixture reaches an entry's over-the-bound branch (capture-container-extent's device). */
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf-8");
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, "utf-8");
    const comp = f.store ? data : deflateRawSync(data), method = f.store ? 0 : 8, crc = crc32(data);
    const declared = Number.isInteger(f.declare) ? f.declare : data.length;
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(0), u16(0x21),
      u32(crc), u32(comp.length), u32(data.length), u16(name.length), u16(0), name, comp]);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0x21),
      u32(crc), u32(comp.length), u32(declared), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    locals.push(local); offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  return new Uint8Array(Buffer.concat([...locals, cd,
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]));
}
const hash = (b) => sha(b);
const TYPES = (over) => `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${over}</Types>`;
const RELS = (inner = "") => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${inner}</Relationships>`;
const REL = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;

/* ---- workbooks (xlsx) ---- */
const XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const sheetXml = (rows) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`
  + rows.map((cells, i) => `<row r="${i + 1}">` + cells.map((v, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${v}</t></is></c>`).join("") + `</row>`).join("")
  + `</sheetData></worksheet>`;
const workbook = (sheets) => zip([
  { name: "[Content_Types].xml", data: TYPES(`<Override PartName="/xl/workbook.xml" ContentType="${XLSX_CT}.main+xml"/>`) },
  { name: "_rels/.rels", data: RELS(REL("rId1", "officeDocument", "xl/workbook.xml")) },
  { name: "xl/workbook.xml", data: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
      + sheets.map(([n], i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>` },
  { name: "xl/_rels/workbook.xml.rels", data: RELS(sheets.map((_, i) => REL(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)).join("")) },
  ...sheets.map(([, rows], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(rows) })),
]);
/* capture-container-extent's workbook: three named sheets of known used ranges */
const SHEETS = [["Summary", [["Department", "FY26 Adopted"], ["Police", "2200000"], ["Fire", "2000000"]]],
                ["Detail", [["Fund 1010", "General Purpose Fund"]]], ["Reconciliation", [["Reconciliation notes"]]]];
const XLSX = workbook(SHEETS);
/* a workbook declaring no sheet: the entry itemises an empty list */
const EMPTY_BOOK = workbook([]);

/* ---- word-processing documents (docx) ---- */
const DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const wp = (s) => `<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`;
const document = (body, media = []) => zip([
  { name: "[Content_Types].xml", data: TYPES(`<Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="${DOCX_CT}.main+xml"/>`) },
  { name: "_rels/.rels", data: RELS(REL("rId1", "officeDocument", "word/document.xml")) },
  { name: "word/document.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}</w:body></w:document>` },
  { name: "word/_rels/document.xml.rels", data: RELS() },
  ...media,
]);
/* capture-container-extent's document: a known paragraph count and nothing else in the body */
const PARAS = ["CITY OF OAKLAND", "AGENDA REPORT", "TO: Jestin D. Johnson, City Administrator",
  "SUBJECT: FY 2026-27 Midcycle Budget Amendments", "FISCAL IMPACT",
  "The proposed appropriation is $1.9 million from the General Purpose Fund.", "RECOMMENDATION", "Adopt the accompanying resolution."];
const DOCX = document(PARAS.map(wp).join(""));
/* fw19-extent-arms' document: two top-level tables, one nested in the first (ordinal 0, 1 nested, 2), one image
   member and a non-image media member beside it */
const PNG = Buffer.from("\x89PNG\r\n\x1a\nFW-19 fixture: the budget map of Council District 3", "latin1");
const JPG = Buffer.from("\xff\xd8\xff\xe0FW-19 fixture: the signed page of the agreement", "latin1");
const tc = (inner) => `<w:tc>${inner}</w:tc>`;
const NESTED = `<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr>${tc(wp("nested"))}</w:tr></w:tbl>`;
const TABLE0 = `<w:tbl><w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid>`
  + `<w:tr>${tc(NESTED + wp("Fund"))}${tc(wp("FY26"))}${tc(wp("FY27"))}</w:tr><w:tr>${tc(wp("1010"))}${tc(wp("2.2M"))}${tc(wp("2.0M"))}</w:tr></w:tbl>`;
const TABLE2 = `<w:tbl><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>`
  + [1, 2, 3, 4].map((r) => `<w:tr>${tc(wp(`r${r}a`))}${tc(wp(`r${r}b`))}</w:tr>`).join("") + `</w:tbl>`;
const DOCX_TABLES = [{ rows: 2, cols: 3 }, { rows: 1, cols: 1 }, { rows: 4, cols: 2 }];
const TABLED = document(wp("AGENDA REPORT") + TABLE0 + wp("Between the tables.") + TABLE2 + wp("End."),
  [{ name: "word/media/image1.png", data: PNG }, { name: "word/media/briefing.wav", data: "RIFF not an image" }]);
/* fw19-extent-arms' workbook: two sheets and no media directory */
const XLSX_NOMEDIA = workbook([["Summary", [["Department", "FY26"], ["Police", "2.2M"], ["Fire", "2.0M"]]], ["Detail", [["Fund 1010"]]]]);

/* ---- decks (pptx) ---- */
const PPTX_CT = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const slideXml = (title, n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${NS}><p:cSld><p:spTree>`
  + `<p:sp><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>`
  + Array.from({ length: n - 1 }, (_, k) => `<p:sp><p:txBody><a:p><a:r><a:t>Line ${k + 1}.</a:t></a:r></a:p></p:txBody></p:sp>`).join("")
  + `</p:spTree></p:cSld></p:sld>`;
/* `shapes[i]` shapes on slide i+1; the part for slide `missing` is left out of the zip (declared everywhere else) */
const deck = (titles, shapes, { missing = 0, declare = {} } = {}) => zip([
  { name: "[Content_Types].xml", data: TYPES(`<Override PartName="/ppt/presentation.xml" ContentType="${PPTX_CT}.main+xml"/>`
      + titles.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")) },
  { name: "_rels/.rels", data: RELS(REL("rId1", "officeDocument", "ppt/presentation.xml")) },
  { name: "ppt/presentation.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation ${NS}><p:sldIdLst>`
      + titles.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("") + `</p:sldIdLst></p:presentation>` },
  { name: "ppt/_rels/presentation.xml.rels", data: RELS(titles.map((_, i) => REL(`rId${i + 2}`, "slide", `slides/slide${i + 1}.xml`)).join("")) },
  ...titles.flatMap((t, i) => (i + 1 === missing ? [] : [
    { name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(t, shapes[i]), declare: declare[i + 1] },
    { name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: RELS() }])),
]);
const PPTX = deck(["FY 2026-27 PROPOSED MIDCYCLE BUDGET", "GENERAL PURPOSE FUND OUTLOOK", "FISCAL IMPACT"], [2, 2, 2]);
const PPTX_GAPPED = deck(["MIDCYCLE OVERVIEW", "THE SLIDE THIS CAPTURE CANNOT READ", "GENERAL PURPOSE FUND RECONCILIATION"], [2, null, 4], { missing: 2 });
const TRAILING = ["AGENDA", "PROPOSED CUTS", "THE SLIDE THIS CAPTURE CANNOT READ"];
const PPTX_TRAILING = deck(TRAILING, [3, 1, null], { missing: 3 });
/* over the bound: one slide declares one byte past runtime-limits' current streamed-text bound for a deck, read from the register
   (READ_BOUNDS office.streamed_text_bytes, as read-bounds.mjs states it), never a figure of its own (BOB 4 Nov, PR 272 (b)) */
const PPTX_OVERBOUND = deck(TRAILING, [3, 1, 2], { declare: { 1: boundOf("office", "streamed_text_bytes") + 1 } });

/* ---- OpenDocument (odt, ods) ---- */
const ODF_NS = ['xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"', 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"', 'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"'].join(" ");
const manifest = (ct) => `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ct}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
const odf = (ct, body, extra = []) => zip([
  { name: "mimetype", data: ct, store: true },
  { name: "META-INF/manifest.xml", data: manifest(ct) },
  { name: "content.xml", data: `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ODF_NS} office:version="1.3"><office:automatic-styles/><office:body>${body}</office:body></office:document-content>` },
  { name: "styles.xml", data: `<?xml version="1.0"?><office:document-styles ${ODF_NS}/>` },
  ...extra,
]);
const ODS_CT = "application/vnd.oasis.opendocument.spreadsheet", ODT_CT = "application/vnd.oasis.opendocument.text";
const odsCell = (v) => `<table:table-cell office:value-type="string"><text:p>${v}</text:p></table:table-cell>`;
/* capture-container-extent's .ods: one sheet, used range two rows of two cells */
const ODS = odf(ODS_CT, `<office:spreadsheet><table:table table:name="Appropriations"><table:table-row>${odsCell("Department")}${odsCell("FY26 Adopted")}</table:table-row>`
  + `<table:table-row>${odsCell("Police")}${odsCell("2200000")}</table:table-row></table:table></office:spreadsheet>`);
/* fw19-extent-arms' .odt: one table of 3 columns (two by repeat) and 2 rows, one image */
const odtCell = (v) => `<table:table-cell><text:p>${v}</text:p></table:table-cell>`;
const ODT = odf(ODT_CT, `<office:text><text:p>Staff report.</text:p><table:table table:name="T1"><table:table-column/><table:table-column table:number-columns-repeated="2"/>`
  + `<table:table-row>${odtCell("a")}${odtCell("b")}${odtCell("c")}</table:table-row><table:table-row>${odtCell("d")}${odtCell("e")}${odtCell("f")}</table:table-row></table:table></office:text>`,
  [{ name: "Pictures/1000000000.jpg", data: JPG }]);

/* ---- a one-page text-free PDF and an HTML page (capture-container-extent's section 5) ---- */
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
  + "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n%%EOF\n", "latin1"));
const HTML = `<!doctype html><html><head><title>Council Calendar</title></head>`
  + `<body><h1>Meetings</h1><p>A web page has no sheets, no paragraph count and no slides.</p></body></html>`;

/* Holds the bytes and reads them through the registered entry for `format`, as capture's acquire answer names it. */
async function readAs(w, bytes, format, ct, extra = {}) {
  const d = await hold(w.evidence, bytes);
  const out = await w.read(doc({ digest: d, bytes: bytes.length, ct, format, headers: [["content-type", ct]], ...extra }));
  return { digest: d, ...out };
}
const produced = async (entry, bytes) => entry.text(await entry.parts(bytes));
const XLSX_GRID = { rows: 1048576, cols: 16384 };

test("R12 R21 (capture-container-extent §1): a real xlsx, docx and pptx each carry the extent their entry itemised: the sheet list with the producer's own grid and used range, the paragraph count, one slot per slide; the levels a container has no notion of are null", async () => {
  const w = fresh();
  const book = (await readAs(w, XLSX, "xlsx", XLSX_CT)).reading;
  const text = (await readAs(w, DOCX, "docx", DOCX_CT)).reading;
  const slides = (await readAs(w, PPTX, "pptx", PPTX_CT)).reading;
  for (const r of [book, text, slides]) assert.equal(r.text_tier, 1);
  const used = SHEETS.map(([, rows]) => [rows.length, Math.max(...rows.map((c) => c.length))]);
  assert.deepEqual(book.container_extent, {
    container: "xlsx", levels: ["sheets", "images"],
    sheets: SHEETS.map(([name], i) => ({ name, ...XLSX_GRID, usedRows: used[i][0], usedCols: used[i][1] })),
    paragraphs: null, slides: null, images: [] });
  assert.deepEqual(text.container_extent, {
    container: "docx", levels: ["paragraphs", "tables", "images"], sheets: null, paragraphs: PARAS.length, slides: null, tables: [], images: [] });
  assert.deepEqual(slides.container_extent, {
    container: "pptx", levels: ["slides", "images"], sheets: null, paragraphs: null,
    slides: [{ shapes: 2 }, { shapes: 2 }, { shapes: 2 }], deckLength: 3, images: [] });
  /* the record holds the producer's own figures: the entry called directly over the same bytes */
  const ps = (await produced(getFormat("xlsx"), XLSX)).sheets, pd = (await produced(getFormat("pptx"), PPTX)).slides;
  assert.deepEqual(book.container_extent.sheets.map((s) => [s.rows, s.cols, s.usedRows, s.usedCols]), ps.map((s) => [s.rows, s.cols, s.usedRows, s.usedCols]));
  assert.deepEqual(slides.container_extent.slides.map((s) => s.shapes), pd.map((s) => s.shapes));
});

test("R12 R21 (capture-container-extent §4b, §4b'): the slide map is keyed on the slide number and as long as the deck: an unreadable slide keeps its own slot with a null count, the deck length beside it; an over-the-bound deck holds one null slot per declared slide", async () => {
  const w = fresh();
  const gapped = (await readAs(w, PPTX_GAPPED, "pptx", PPTX_CT)).reading.container_extent;
  assert.deepEqual([gapped.slides, gapped.deckLength], [[{ shapes: 2 }, { shapes: null }, { shapes: 4 }], 3]);
  const trailing = (await readAs(w, PPTX_TRAILING, "pptx", PPTX_CT)).reading.container_extent;
  assert.deepEqual([trailing.slides, trailing.deckLength], [[{ shapes: 3 }, { shapes: 1 }, { shapes: null }], TRAILING.length]);
  /* the fixture arms: the entry's readable list is one short of the deck it declares */
  const tp = await produced(getFormat("pptx"), PPTX_TRAILING);
  assert.deepEqual([tp.slides.map((s) => s.slide), tp.deckLength], [[1, 2], TRAILING.length]);
  const over = (await readAs(w, PPTX_OVERBOUND, "pptx", PPTX_CT)).reading.container_extent;
  assert.deepEqual([over.levels, over.slides, over.deckLength], [["slides", "images"], TRAILING.map(() => ({ shapes: null })), TRAILING.length]);
});

test("R12 R21 (capture-container-extent §4c): an .ods sheet's grid is null, present and never borrowed, beside its measured used range", async () => {
  const w = fresh();
  const r = (await readAs(w, ODS, "ods", ODS_CT)).reading;
  assert.deepEqual(r.container_extent, { container: "ods", levels: ["sheets", "images"],
    sheets: [{ name: "Appropriations", rows: null, cols: null, usedRows: 2, usedCols: 2 }], paragraphs: null, slides: null, images: [] });
  assert.ok("rows" in r.container_extent.sheets[0] && "cols" in r.container_extent.sheets[0]);
});

test("R12 R21 (capture-container-extent §7): a workbook whose entry itemised no sheet records the sheet level null, never an empty list, the level still declared", async () => {
  const w = fresh();
  const r = (await readAs(w, EMPTY_BOOK, "xlsx", XLSX_CT)).reading;
  assert.deepEqual([r.container_extent.sheets, r.container_extent.levels], [null, ["sheets", "images"]]);
});

test("R12 R21 R17 (capture-container-extent §5): an HTML page no entry itemised states only its paragraph count; a PDF the real entry read carries its one level, images, a measured empty list; its page count and box; the text counts T9 pinned", async () => {
  const w = fresh();
  const html = (await readAs(w, HTML, "html", "text/html; charset=utf-8", { fromText: true })).reading;
  /* R63: an HTML page no entry itemised states its paragraph count and no other level */
  assert.deepEqual(html.container_extent, { container: "html", levels: ["paragraphs"], sheets: null, paragraphs: 2, slides: null });
  assert.deepEqual([html.text_chars, html.text_glyphs, html.text_undetermined], [168, 155, null]);
  const pdf = (await readAs(w, PDF, "pdf", "application/pdf")).reading;
  assert.deepEqual(pdf.container_extent, { container: "pdf", levels: ["images"], images: [] });
  assert.equal(pdf.page_count, 1);
  assert.deepEqual(pdf.page_boxes, { boxes: [{ media_box: [0, 0, 612, 792], w: 612, h: 792, rotate: 0 }], of_page: [0] });
  assert.deepEqual([pdf.text_chars, pdf.text_glyphs, pdf.text_undetermined], [0, 0, 0]);
});

test("R12 (fw19-extent-arms §1): a docx carries its table grids in document order, the nested one numbered as it opens, and its one image member by content hash (a non-image media member not listed); an xlsx with no media carries images as a measured empty list and no table level; an odt its table through the column repeat and its image", async () => {
  const w = fresh();
  const d = (await readAs(w, TABLED, "docx", DOCX_CT)).reading.container_extent;
  assert.deepEqual([d.levels, d.tables, d.images], [["paragraphs", "tables", "images"], DOCX_TABLES, [{ part: hash(PNG), mime: "image/png" }]]);
  const b = (await readAs(w, XLSX_NOMEDIA, "xlsx", XLSX_CT)).reading.container_extent;
  assert.deepEqual([b.levels, b.images, "tables" in b], [["sheets", "images"], [], false]);
  const o = (await readAs(w, ODT, "odt", ODT_CT)).reading.container_extent;
  assert.deepEqual([o.container, o.levels, o.tables, o.images], ["odt", ["paragraphs", "tables", "images"], [{ rows: 2, cols: 3 }], [{ part: hash(JPG), mime: "image/jpeg" }]]);
});

test("R63 R12 R32: a text reading states container_extent.paragraphs equal to the paragraph units it numbers, whole and in pieces, as an office reading does", async () => {
  const w = fresh();
  const three = "The council met on Tuesday.\n\nThe budget was adopted.\n\nThe meeting adjourned at nine.";
  const bytes = new Uint8Array(Buffer.from(three));
  const o = await readAs(w, bytes, "txt", "text/plain; charset=utf-8", { fromText: true });
  assert.deepEqual(o.reading.container_extent, { container: o.reading.text_container, levels: ["paragraphs"], sheets: null, paragraphs: 3, slides: null });
  assert.equal(o.reading.container_extent.paragraphs, o.text_units.length);
  /* a paragraph with no glyph is no unit but is numbered (R32), so the extent counts the numbers `para` takes */
  const dots = new Uint8Array(Buffer.from("First paragraph.\n\n...\n\nThird paragraph."));
  const d = await readAs(w, dots, "txt", "text/plain; charset=utf-8", { fromText: true });
  assert.deepEqual([d.reading.container_extent.paragraphs, Math.max(...d.text_units.map((u) => u.extent.para)) + 1], [3, 3]);
  /* a line-split text (R33) counts its lines */
  const lines = new Uint8Array(Buffer.from("one line\ntwo lines\nthree lines\nfour lines"));
  assert.equal((await readAs(w, lines, "txt", "text/plain; charset=utf-8", { fromText: true })).reading.container_extent.paragraphs, 4);
  /* in pieces the count is the whole text's, stated by the first piece */
  const many = new Uint8Array(Buffer.from(Array.from({ length: 40 }, (_, i) => `Paragraph number ${i + 1} of the minutes.`).join("\n\n")));
  const d2 = await hold(w.evidence, many);
  const first = await w.read(doc({ digest: d2, bytes: many.length, ct: "text/plain; charset=utf-8", format: "txt", headers: [["content-type", "text/plain; charset=utf-8"]], fromText: true }), { cursor: null, unitsBudget: 2000, maxUnits: 5 });
  assert.equal(first.reading.container_extent.paragraphs, 40);
});
