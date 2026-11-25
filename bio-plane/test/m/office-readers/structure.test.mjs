/* office-readers, R7–R10: structure() — links and their partitions, element
 * references, the xlsx named units (D-415) and the DEC-5 evidentiary envelope. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { docxEntry, docParaRef } from "../../../src/docx.mjs";
import { pptxEntry, slideShapeRef } from "../../../src/pptx.mjs";
import { xlsxEntry, sheetCellRef, usedSheetRange } from "../../../src/formats-xlsx.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import * as F from "./fixtures.mjs";

const sha = (s) => createHash("sha256").update(F.enc(s)).digest("hex");
const PARTITIONS = ["anchor", "intra", "deferred", "refused", "undetermined"];

function checkShape(s, container, unitField) {
  assert.equal(s.ok, true);
  assert.equal(s.container, container);
  assert.ok(unitField in s, `${container} carries ${unitField}`);
  assert.ok(Array.isArray(s.links) && Array.isArray(s.notes));
  assert.deepEqual(Object.keys(s.counts).sort(), [...PARTITIONS].sort());
  for (const p of PARTITIONS) assert.equal(s.counts[p], s.links.filter((l) => l.partition === p).length, `${container} counts.${p}`);
  for (const l of s.links) {
    for (const k of ["partition", "wrapper", "target", "source"]) assert.ok(k in l, `${container} link has ${k}`);
    assert.ok(PARTITIONS.includes(l.partition));
    if (l.partition === "deferred") assert.equal(l.wrapper, linkWrapper.deferred(l.target.url));
    if (l.partition === "refused") assert.equal(l.wrapper, linkWrapper.refused());
    if (l.partition === "intra") assert.equal(l.wrapper, linkWrapper.intra(l.target.sha256));
    if (l.partition === "anchor") assert.equal(l.wrapper, linkWrapper.anchor(l.target.fragment));
    if (l.partition === "undetermined") { assert.equal(l.wrapper, null); assert.equal(typeof l.target.why, "string"); }
  }
  const ev = s.evidentiary;
  assert.deepEqual(Object.keys(ev).sort(), ["container", "counts", "items", "kinds", "undetermined"]);
  assert.equal(ev.container, container);
  assert.deepEqual(ev.kinds, [...new Set(ev.items.map((i) => i.kind))]);
  for (const k of ev.kinds) assert.equal(ev.counts[k], ev.items.filter((i) => i.kind === k).length);
  assert.equal(Object.keys(ev.counts).length, ev.kinds.length);
}

/* ------------------------------------------------------------------ fixtures */

const DOCX_RELS = F.rels([
  { id: "rIdH", target: "https://example.org/a b?x=1", external: true },
  { id: "rIdM", target: "mailto:clerk@example.org", external: true },
  { id: "rIdR", target: "page.html", external: true },
  { id: "rIdU", target: "http://example.org/unused", external: true },
  { id: "rIdF", target: "file:///C:/secret.doc", external: true },
  { id: "rIdE", type: F.RT.oleObject, target: "embeddings/obj.bin" },
]);
const DOCX_BODY =
  F.wp('<w:bookmarkStart w:id="0" w:name="bm"/>', F.wr("Intro"))
  + F.wp(`<w:hyperlink r:id="rIdH">${F.wr("web")}</w:hyperlink>`, `<w:hyperlink w:anchor="bm">${F.wr("jump")}</w:hyperlink>`, `<w:hyperlink w:anchor="nope">${F.wr("x")}</w:hyperlink>`)
  + F.wp(`<w:hyperlink r:id="rIdM">${F.wr("mail")}</w:hyperlink>`, '<w:r><w:object><o:OLEObject xmlns:o="urn:schemas-microsoft-com:office:office" r:id="rIdE"/></w:object></w:r>', `<w:hyperlink r:id="rIdR">${F.wr("rel")}</w:hyperlink>`)
  + F.wp(`<w:hyperlink r:id="rIdF">${F.wr("f")}</w:hyperlink>`);
const richDocx = () => F.docx({ body: DOCX_BODY, rels: DOCX_RELS, extra: [{ name: "word/embeddings/obj.bin", data: "EMB" }] });

const SLIDE_WITH_LINKS = `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree>`
  + `<p:sp><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="rIdH"/></a:rPr><a:t>web</a:t></a:r></a:p></p:txBody></p:sp>`
  + `<p:sp><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="rIdJ"/></a:rPr><a:t>jump</a:t></a:r></a:p></p:txBody></p:sp>`
  + `<p:sp><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="rIdX"/></a:rPr><a:t>gone</a:t></a:r></a:p></p:txBody></p:sp>`
  + `<p:pic><p:blipFill><a:blip r:embed="rIdE"/></p:blipFill></p:pic>`
  + `<p:sp><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="custom7"/></a:rPr><a:t>odd id</a:t></a:r></a:p></p:txBody></p:sp>`
  + `</p:spTree></p:cSld></p:sld>`;
/* Deck order: slide2.xml first, slide1.xml second — filenames say the opposite. */
const richPptx = () => F.pptx({
  slides: [
    { file: "slide2.xml", texts: ["First in the deck"] },
    { file: "slide1.xml", xml: SLIDE_WITH_LINKS, rels: [
      { id: "rIdH", target: "https://example.org/", external: true },
      { id: "rIdU", target: "ftp://example.org/unused", external: true },
      { id: "rIdJ", type: F.RT.slide, target: "slide2.xml" },
      { id: "rIdX", type: F.RT.slide, target: "slide9.xml" },
      { id: "rIdE", type: F.RT.oleObject, target: "../embeddings/e.bin" },
      { id: "custom7", target: "http://example.org/custom", external: true },
    ] },
  ],
  extra: [{ name: "ppt/embeddings/e.bin", data: "PPTEMB" }],
});

const richXlsx = (o = {}) => F.xlsx({
  sheets: [
    { name: "Data", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "a" }] }],
      hyperlinks: [{ ref: "A1", id: "rH" }, { ref: "B2", location: "Other!A1" }, { ref: "C3", id: "rMissing" }, { ref: "D4" }, { ref: "E5", id: "rInt" }] },
      rels: [
        { id: "rH", target: "http://example.org/x", external: true },
        { id: "rU", target: "mailto:x@example.org", external: true },
        { id: "rInt", type: F.RT.drawing, target: "../drawings/drawing1.xml" },
      ], ...(o.sheet0 ?? {}) },
    { name: "Other", data: { rows: [{ r: 1, cells: [{ r: "A1", v: "1" }] }] } },
  ],
  definedNames: o.definedNames ?? [{ name: "Total", ref: "Data!$A$1:$B$4" }],
  extra: [
    { name: "xl/embeddings/x.bin", data: "XEMB" },
    { name: "xl/drawings/drawing1.xml", data: "<xdr:wsDr/>" },
    { name: "xl/drawings/_rels/drawing1.xml.rels", data: F.rels([{ id: "d1", target: "https://example.org/drawn", external: true }]) },
    ...(o.extra ?? []),
  ],
});

/* ------------------------------------------------------------------ R7 */

test("R7 docx links: external rels deferred/refused through linkWrapper, bookmark anchors, embeddings intra by sha256, unresolved stated", async () => {
  const s = await docxEntry.structure(richDocx());
  checkShape(s, "docx", "paragraphs");
  const by = (url) => s.links.filter((l) => l.target.url === url);
  assert.deepEqual(by("https://example.org/a b?x=1"), [{ partition: "deferred", wrapper: linkWrapper.deferred("https://example.org/a b?x=1"), target: { url: "https://example.org/a b?x=1" }, source: docParaRef(1, 0) }]);
  assert.equal(by("mailto:clerk@example.org")[0].partition, "refused");
  assert.equal(by("file:///C:/secret.doc")[0].partition, "refused");
  assert.equal(by("page.html")[0].partition, "deferred", "a bare relative target is deferred");
  assert.deepEqual(by("http://example.org/unused"), [{ partition: "deferred", wrapper: linkWrapper.deferred("http://example.org/unused"), target: { url: "http://example.org/unused" }, source: null }]);
  const anchor = s.links.find((l) => l.partition === "anchor");
  assert.deepEqual(anchor, { partition: "anchor", wrapper: "#para=1", target: { para: 0, fragment: "#para=1", bookmark: "bm" }, source: docParaRef(1, 1) });
  assert.deepEqual(s.links.find((l) => l.target.bookmark === "nope"), { partition: "undetermined", wrapper: null, target: { why: "bookmark_unresolved", bookmark: "nope" }, source: docParaRef(1, 2) });
  assert.deepEqual(s.links.find((l) => l.partition === "intra"), { partition: "intra", wrapper: linkWrapper.intra(sha("EMB")), target: { sha256: sha("EMB"), name: "obj.bin", bytes: 3 }, source: docParaRef(2, 1) });
  assert.equal(s.links.length, 8);
});

test("R7 pptx links: slide rels deferred/refused, a same-deck slide jump is an anchor, a jump to a missing slide undetermined, embeddings intra", async () => {
  const s = await pptxEntry.structure(richPptx());
  checkShape(s, "pptx", "slides");
  assert.equal(s.slides, 2);
  assert.deepEqual(s.links.find((l) => l.target.url === "https://example.org/"), { partition: "deferred", wrapper: linkWrapper.deferred("https://example.org/"), target: { url: "https://example.org/" }, source: slideShapeRef(2, 0) });
  assert.deepEqual(s.links.find((l) => l.target.url === "ftp://example.org/unused"), { partition: "refused", wrapper: linkWrapper.refused(), target: { url: "ftp://example.org/unused" }, source: slideShapeRef(2) });
  assert.deepEqual(s.links.find((l) => l.partition === "anchor"), { partition: "anchor", wrapper: "#slide=1", target: { slide: 1, fragment: "#slide=1", part: "ppt/slides/slide2.xml" }, source: slideShapeRef(2, 1) });
  assert.deepEqual(s.links.find((l) => l.target.why === "slide_unresolved"), { partition: "undetermined", wrapper: null, target: { why: "slide_unresolved", part: "ppt/slides/slide9.xml" }, source: slideShapeRef(2, 2) });
  assert.deepEqual(s.links.find((l) => l.partition === "intra"), { partition: "intra", wrapper: linkWrapper.intra(sha("PPTEMB")), target: { sha256: sha("PPTEMB"), name: "e.bin", bytes: 6 }, source: slideShapeRef(2, 3) });
  // a relationship id without the conventional rId prefix is still joined to its shape
  assert.deepEqual(s.links.find((l) => l.target.url === "http://example.org/custom").source, slideShapeRef(2, 4));
});

test("R7 xlsx links: cell hyperlinks join sheet rels, cross-sheet locations and defined names are anchors, every other outbound rel is carried, embeddings intra", async () => {
  const s = await xlsxEntry.structure(richXlsx());
  checkShape(s, "xlsx", "sheets");
  const L = s.links;
  assert.deepEqual(L.find((l) => l.target.url === "http://example.org/x"), { partition: "deferred", wrapper: linkWrapper.deferred("http://example.org/x"), target: { url: "http://example.org/x" }, source: sheetCellRef("Data", "A1") });
  assert.deepEqual(L.find((l) => l.target.location), { partition: "anchor", wrapper: "#Other!A1", target: { location: "Other!A1", fragment: "#Other!A1" }, source: sheetCellRef("Data", "B2") });
  assert.deepEqual(L.find((l) => l.target.why === "hyperlink_rel_unresolved"), { partition: "undetermined", wrapper: null, target: { why: "hyperlink_rel_unresolved", relId: "rMissing" }, source: sheetCellRef("Data", "C3") });
  assert.deepEqual(L.find((l) => l.target.why === "hyperlink_without_target"), { partition: "undetermined", wrapper: null, target: { why: "hyperlink_without_target" }, source: sheetCellRef("Data", "D4") });
  assert.equal(L.find((l) => l.target.why === "hyperlink_rel_not_external").source.cell, "E5");
  // an external rel no hyperlink uses: carried once, no cell to name
  assert.deepEqual(L.filter((l) => l.target.url === "mailto:x@example.org"), [{ partition: "refused", wrapper: linkWrapper.refused(), target: { url: "mailto:x@example.org" }, source: null }]);
  // an outbound rel of another part (a drawing's hyperlink): carried, source null
  assert.deepEqual(L.filter((l) => l.target.url === "https://example.org/drawn"), [{ partition: "deferred", wrapper: linkWrapper.deferred("https://example.org/drawn"), target: { url: "https://example.org/drawn" }, source: null }]);
  assert.deepEqual(L.find((l) => l.partition === "intra"), { partition: "intra", wrapper: linkWrapper.intra(sha("XEMB")), target: { sha256: sha("XEMB"), name: "xl/embeddings/x.bin", bytes: 4 }, source: null });
});

test("R7 an unreadable .rels part yields an undetermined link saying links may be missing, never zero links (docx, pptx, xlsx)", async () => {
  const d = await docxEntry.structure(F.docx({ extra: [{ name: "word/_rels/document.xml.rels", data: DOCX_RELS, cd: F.CORRUPT }] }));
  assert.deepEqual(d.links, [{ partition: "undetermined", wrapper: null, target: { why: "rels_unreadable", part: "word/_rels/document.xml.rels", detail: "crc_mismatch" }, source: null }]);
  assert.equal(d.counts.undetermined, 1);
  const p = await pptxEntry.structure(F.pptx({ extra: [{ name: "ppt/slides/_rels/slide1.xml.rels", data: "<nope/>" }] }));
  assert.ok(p.links.some((l) => l.partition === "undetermined" && l.target.why === "rels_unreadable" && l.target.part === "ppt/slides/_rels/slide1.xml.rels"));
  const x = await xlsxEntry.structure(F.xlsx({ sheets: [{ name: "S", data: {}, rels: "<nope/>" }] }));
  assert.deepEqual(x.links, [{ partition: "undetermined", wrapper: null, target: { why: "rels_unreadable", part: "xl/worksheets/_rels/sheet1.xml.rels", detail: "rels_unparseable" }, source: null }]);
  assert.ok(x.evidentiary.undetermined.some((u) => u.part === "xl/worksheets/_rels/sheet1.xml.rels"));
  const x2 = await xlsxEntry.structure(F.xlsx({ extra: [{ name: "xl/drawings/_rels/drawing1.xml.rels", data: "x", cd: F.CORRUPT }] }));
  assert.equal(x2.links[0].target.why, "rels_unreadable");
});

test("R7 xlsx over the size guard still carries each sheet's external targets, with the cell join stated unavailable", async () => {
  const s = await xlsxEntry.structure(richXlsx({ sheet0: { cd: F.OVER } }));
  const l = s.links.find((x) => x.target.url === "http://example.org/x");
  assert.equal(l.source, null);
  assert.equal(l.note, "cell_join_unavailable:over_size_bound");
  assert.ok(s.links.some((x) => x.target.url === "mailto:x@example.org"));
});

/* ------------------------------------------------------------------ R8 */

test("R8 docx sources are docParaRef; pptx slide numbers come from sldIdLst, never filenames; xlsx sources are sheetCellRef", async () => {
  const d = await docxEntry.structure(richDocx());
  for (const l of d.links) if (l.source) assert.deepEqual(Object.keys(l.source).filter((k) => k !== "run").sort(), ["kind", "para", "ref"]), assert.equal(l.source.kind, "doc-para");
  const p = await pptxEntry.structure(richPptx());
  for (const l of p.links) if (l.source) { assert.equal(l.source.kind, "slide-shape"); assert.equal(l.source.slide, 2, "slide1.xml is the deck's second slide"); }
  const t = await pptxEntry.text(richPptx());
  assert.deepEqual(t.slides.map((s) => [s.slide, s.part]), [[1, "ppt/slides/slide2.xml"], [2, "ppt/slides/slide1.xml"]]);
  const x = await xlsxEntry.structure(richXlsx());
  for (const l of x.links) if (l.source) assert.deepEqual(l.source, sheetCellRef(l.source.sheet, l.source.cell));
});

test("R8 pptx: when the declared order cannot be read, slides and their sources are null, never numbered off the filename", async () => {
  const b = F.pptx({ presRels: false, slides: [{ file: "slide1.xml", texts: ["a"], hlinks: { 0: "rIdH" }, rels: [{ id: "rIdH", target: "http://e.org/", external: true }], notes: "n" }] });
  const s = await pptxEntry.structure(b);
  for (const l of s.links) assert.equal(l.source, null);
  assert.equal(s.evidentiary.items.find((i) => i.kind === "speaker-notes").slide, null);
  const t = await pptxEntry.text(b);
  assert.equal(t.slides[0].slide, null);
  assert.equal(t.slides[0].ref, null);
  assert.equal(t.deckLength, null);
});

/* ------------------------------------------------------------------ R9 */

const NAMES = [
  { name: "Total", ref: "Data!$A$1:$B$4" },
  { name: "Cell", ref: "Other!C3" },
  { name: "Rev", ref: "Data!D9:B2" },
  { name: "Quoted", ref: "'It''s here'!A1:A2" },
  { name: "Case", ref: "data!A1" },
  { name: "Local", ref: "Other!A1:A5", localSheetId: 1 },
  { name: "_xlnm._FilterDatabase", ref: "Data!$A$1:$C$9", localSheetId: 0, hidden: true },
  { name: "Empty", ref: "" },
  { name: "Broken", ref: "#REF!" },
  { name: "Broken2", ref: "Data!#REF!" },
  { name: "Multi", ref: "Data!A1,Data!B2" },
  { name: "Paren", ref: "(Data!A1)" },
  { name: "Formula", ref: "SUM(Data!A1:A3)" },
  { name: "Const", ref: "0.075" },
  { name: "Col", ref: "Data!$A:$A" },
  { name: "Rows", ref: "Data!1:3" },
  { name: "Ext", ref: "[1]Data!A1" },
  { name: "ThreeD", ref: "Data:Other!A1" },
  { name: "Nowhere", ref: "Missing!A1" },
  { name: "PastRows", ref: "Data!A1:A1048577" },
  { name: "PastCols", ref: "Data!A1:XFE1" },
  { name: "Triple", ref: "Data!A1:B2:C3" },
];
const namedXlsx = (sheet0 = {}) => F.xlsx({
  sheets: [
    { name: "Data", data: { rows: [{ r: 1, cells: [{ r: "A1", v: "1" }] }] }, rels: [
      { id: "t1", type: F.RT.table, target: "../tables/table1.xml" },
      { id: "t2", type: F.RT.table, target: "../tables/table2.xml" },
      { id: "t3", type: F.RT.table, target: "/xl/tables/table3.xml" },
      { id: "t4", type: F.RT.table, target: "../tables/table4.xml" },
    ], ...sheet0 },
    { name: "Other", data: {} },
    { name: "It's here", data: {} },
  ],
  definedNames: NAMES,
  extra: [
    { name: "xl/tables/table1.xml", data: F.tablePart("Budget", "B2:D10") },
    { name: "xl/tables/table2.xml", data: "<notATable/>" },
    { name: "xl/tables/table3.xml", data: F.tablePart("Broken", "B2:D10"), cd: F.CORRUPT },
    { name: "xl/tables/table4.xml", data: F.tablePart("Odd", "B2") },
    // a table part NO sheet's rels reaches is not read (tables are reached through rels, never by filename)
    { name: "xl/tables/table9.xml", data: F.tablePart("Stray", "A1:B2") },
  ],
});
const unit = (sheet, range) => ({ kind: "sheet-range", ref: `${sheet}!${range}`, sheet, range });

test("R9 xlsx structure: each defined name emits one workbook-scoped anchor link {definedName, ref, fragment}, source null", async () => {
  const s = await xlsxEntry.structure(namedXlsx());
  const anchors = s.links.filter((l) => l.target.definedName != null);
  assert.equal(anchors.length, NAMES.length);
  for (const [i, dn] of NAMES.entries()) {
    assert.deepEqual(anchors[i], { partition: "anchor", wrapper: `#${dn.ref}`, target: { definedName: dn.name, ref: dn.ref, fragment: `#${dn.ref}` }, source: null });
  }
});

test("R9 xlsx text: each defined name or table part naming one rectangle on one sheet is a sheet-range unit; every other is skipped with its reason", async () => {
  const t = await xlsxEntry.text(namedXlsx());
  assert.deepEqual(t.rangeUnits, [
    { source: "defined-name", name: "Total", scope: null, hidden: false, unit: unit("Data", "A1:B4") },
    { source: "defined-name", name: "Cell", scope: null, hidden: false, unit: unit("Other", "C3:C3") },
    { source: "defined-name", name: "Rev", scope: null, hidden: false, unit: unit("Data", "B2:D9") },
    { source: "defined-name", name: "Quoted", scope: null, hidden: false, unit: unit("It's here", "A1:A2") },
    { source: "defined-name", name: "Case", scope: null, hidden: false, unit: unit("Data", "A1:A1") },
    { source: "defined-name", name: "Local", scope: "Other", hidden: false, unit: unit("Other", "A1:A5") },
    { source: "defined-name", name: "_xlnm._FilterDatabase", scope: "Data", hidden: true, unit: unit("Data", "A1:C9") },
    { source: "table", name: "Budget", scope: "Data", hidden: false, unit: unit("Data", "B2:D10") },
    { source: "table", name: "Odd", scope: "Data", hidden: false, unit: unit("Data", "B2:B2") },
  ]);
  const why = Object.fromEntries(t.rangeUnitsSkipped.filter((x) => x.source === "defined-name").map((x) => [x.name, x.why]));
  assert.deepEqual(why, {
    Empty: "empty_reference", Broken: "broken_reference", Broken2: "broken_reference", Multi: "multi_area", Paren: "multi_area",
    Formula: "not_a_range_reference", Const: "not_a_range_reference", Col: "whole_row_or_column", Rows: "whole_row_or_column",
    Ext: "external_workbook", ThreeD: "multi_sheet_reference", Nowhere: "no_such_sheet", PastRows: "outside_grid",
    PastCols: "outside_grid", Triple: "not_a_range_reference",
  });
  for (const x of t.rangeUnitsSkipped.filter((x) => x.source === "defined-name")) assert.equal(x.ref, NAMES.find((n) => n.name === x.name).ref);
  assert.deepEqual(t.rangeUnitsSkipped.filter((x) => x.source === "table"), [
    { source: "table", name: null, ref: null, part: "xl/tables/table2.xml", why: "table_element_absent" },
    { source: "table", name: null, ref: null, part: "xl/tables/table3.xml", why: "table_part_unreadable:crc_mismatch" },
  ]);
  assert.equal(t.rangeUnits.length + t.rangeUnitsSkipped.length, NAMES.length + 4, "every name and every reached table is accounted for once");
  // each unit has the one builder's shape (the shape usedSheetRange emits)
  const shape = Object.keys(usedSheetRange("x", 1, 1)).sort();
  for (const u of t.rangeUnits) assert.deepEqual(Object.keys(u.unit).sort(), shape);
});

test("R9 xlsx: the named units are emitted over the size guard too, and a workbook with none emits empty lists", async () => {
  const over = await xlsxEntry.text(namedXlsx({ cd: F.OVER }));
  assert.equal(over.document, null);
  const normal = await xlsxEntry.text(namedXlsx());
  assert.deepEqual(over.rangeUnits, normal.rangeUnits);
  assert.deepEqual(over.rangeUnitsSkipped, normal.rangeUnitsSkipped);
  const none = await xlsxEntry.text(F.xlsx());
  assert.deepEqual(none.rangeUnits, []);
  assert.deepEqual(none.rangeUnitsSkipped, []);
});

/* ------------------------------------------------------------------ R10 */

test("R10 docx evidentiary: tracked insertions and deletions, comments located by their reference, core properties", async () => {
  const body = F.wp(F.wr("Keep "), '<w:ins w:id="1" w:author="Ana" w:date="2026-01-02T00:00:00Z">' + F.wr("added") + "</w:ins>",
    '<w:del w:id="2" w:author="Bo"><w:r><w:delText>removed</w:delText></w:r></w:del>')
    + F.wp('<w:r><w:commentReference w:id="7"/></w:r>', F.wr("noted"));
  const comments = `<?xml version="1.0"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="Cy" w:date="2026-02-03T00:00:00Z" w:initials="C"><w:p><w:r><w:t>first</w:t></w:r></w:p><w:p><w:r><w:t>second</w:t></w:r></w:p></w:comment><w:comment w:id="8"><w:p><w:r><w:t>loose</w:t></w:r></w:p></w:comment></w:comments>`;
  const s = await docxEntry.structure(F.docx({ body, comments, core: F.core({ creator: "Ana", lastModifiedBy: "Bo", revision: "12", created: "2026-01-01", title: "T" }) }));
  checkShape(s, "docx", "paragraphs");
  assert.deepEqual(s.evidentiary.items, [
    { kind: "tracked-change", change: "insertion", author: "Ana", date: "2026-01-02T00:00:00Z", source: docParaRef(0, 1), text: "added" },
    { kind: "tracked-change", change: "deletion", author: "Bo", date: null, source: docParaRef(0, 2), superseded: "removed" },
    { kind: "comment", id: "7", author: "Cy", date: "2026-02-03T00:00:00Z", initials: "C", text: "first\nsecond", source: docParaRef(1, 0) },
    { kind: "comment", id: "8", author: null, date: null, initials: null, text: "loose", source: null },
    { kind: "core-properties", creator: "Ana", lastModifiedBy: "Bo", revision: "12", revisionNumber: 12, created: "2026-01-01", modified: null, title: "T", source: null },
  ]);
  const bad = await docxEntry.structure(F.docx({ comments: "<notcomments/>" }));
  assert.deepEqual(bad.evidentiary.undetermined, [{ part: "word/comments.xml", why: "comments_unparseable" }]);
});

test("R10 pptx evidentiary: hidden slides from either location, speaker notes mapped by the slide's own rels, orphan notes, core properties", async () => {
  const b = F.pptx({
    slides: [
      { file: "slide1.xml", texts: ["shown"], notes: "n1", notesFile: "notesSlide9.xml" },
      { file: "slide2.xml", texts: ["root-hidden"], show: "0" },
      { file: "slide3.xml", texts: ["list-hidden"], sldIdShow: "false" },
      { file: "slide4.xml", texts: ["explicitly shown"], show: "1" },
    ],
    core: F.core({ creator: "P" }),
    extra: [{ name: "ppt/notesSlides/notesSlide1.xml", data: F.notesXml("orphan") }],
  });
  const s = await pptxEntry.structure(b);
  checkShape(s, "pptx", "slides");
  const items = s.evidentiary.items;
  assert.deepEqual(items.filter((i) => i.kind === "hidden-slide"), [
    { kind: "hidden-slide", slide: 2, part: "ppt/slides/slide2.xml", source: slideShapeRef(2) },
    { kind: "hidden-slide", slide: 3, part: "ppt/slides/slide3.xml", source: slideShapeRef(3) },
  ]);
  assert.deepEqual(items.filter((i) => i.kind === "speaker-notes"), [
    { kind: "speaker-notes", slide: 1, part: "ppt/notesSlides/notesSlide9.xml", text: "n1", source: slideShapeRef(1) },
    { kind: "speaker-notes", slide: null, part: "ppt/notesSlides/notesSlide1.xml", text: "orphan", source: null },
  ]);
  assert.equal(items.filter((i) => i.kind === "core-properties").length, 1);
  // the hidden slides' text is still extracted
  const t = await pptxEntry.text(b);
  assert.match(t.document, /root-hidden/);
  assert.match(t.document, /list-hidden/);
});

test("R10 xlsx evidentiary: formulas beside their cached values, hidden rows, columns and sheets (hidden sheets over the guard too), core properties", async () => {
  const b = (cd) => F.xlsx({
    sheets: [
      { name: "S", cd, data: { rows: [{ r: 1, cells: [{ r: "A1", f: "B1*2", v: "4" }, { r: "B1", v: "2" }] }, { r: 2, hidden: true, cells: [{ r: "A2", f: "NOW()" }] }, { r: 5, hidden: true, cells: [] }],
        cols: [{ min: 3, max: 4, hidden: true }, { min: 5, max: 5 }] } },
      { name: "H", state: "hidden", data: {} },
      { name: "V", state: "veryHidden", data: {} },
    ],
    core: F.core({ creator: "X", revision: "r2" }),
  });
  const s = await xlsxEntry.structure(b());
  checkShape(s, "xlsx", "sheets");
  assert.deepEqual(s.evidentiary.items, [
    { kind: "formula", source: sheetCellRef("S", "A1"), formula: "B1*2", value: "4" },
    { kind: "formula", source: sheetCellRef("S", "A2"), formula: "NOW()", value: null },
    { kind: "hidden-rows", sheet: "S", rows: [2, 5], count: 2, source: null },
    { kind: "hidden-cols", sheet: "S", cols: [{ min: 3, max: 4 }], count: 1, source: null },
    { kind: "hidden-sheet", sheet: "H", state: "hidden", source: null },
    { kind: "hidden-sheet", sheet: "V", state: "veryHidden", source: null },
    { kind: "core-properties", creator: "X", lastModifiedBy: null, revision: "r2", revisionNumber: null, created: null, modified: null, title: null, source: null },
  ]);
  const over = await xlsxEntry.structure(b(F.OVER));
  assert.deepEqual(over.evidentiary.items.filter((i) => i.kind === "hidden-sheet").map((i) => i.sheet), ["H", "V"]);
  assert.ok(over.evidentiary.undetermined.some((u) => u.why === "over_size_bound" && u.guard && u.guard.boundName === "STREAMED_TEXT_BOUND_BYTES"));
});
