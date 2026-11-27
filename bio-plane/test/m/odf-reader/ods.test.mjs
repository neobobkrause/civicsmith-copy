/* odf-reader: the .ods entry's structure() and text()
 * (build/requirements/odf-reader.md R14–R20, R42). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odsEntry } from "../../../src/odf.mjs";
import { sizeGuard } from "../../../src/ooxml.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import { sheetCellRef, usedSheetRange } from "../../../src/formats-xlsx.mjs";
import { buildZip, members, pkg, withCd, OVER_BOUND } from "./pkg.mjs";

/** @typedef {import("../../../src/odf.mjs").OdsStructure} OdsStructure */

/** @param {string} body @param {string} [styles] */
const ods = (body, styles = "") => pkg("ods", { body, styles });
/* Every test that calls S or T reads the answer's sheets, links, text or items, so relies on the read succeeding:
   the helpers state that (assert.ok(x.ok)) before handing the answer back. */
/** @param {string} b @param {string} [st] */
const S = async (b, st) => { const s = await odsEntry.structure(ods(b, st)); assert.ok(s.ok); return s; };
/** @param {string} b @param {string} [st] */
const T = async (b, st) => { const t = await odsEntry.text(ods(b, st)); assert.ok(t.ok); return t; };
/** @param {OdsStructure} s @param {string} kind */
const items = (s, kind) => s.evidentiary.items.filter((i) => i.kind === kind);

/** @param {string} text @param {string} [attrs] */
const cell = (text, attrs = "") => `<table:table-cell office:value-type="string"${attrs ? " " + attrs : ""}><text:p>${text}</text:p></table:table-cell>`;
/** @param {number} [n] */
const empty = (n = 1) => `<table:table-cell${n > 1 ? ` table:number-columns-repeated="${n}"` : ""}/>`;
/** @param {string} cells @param {string} [attrs] */
const row = (cells, attrs = "") => `<table:table-row${attrs ? " " + attrs : ""}>${cells}</table:table-row>`;
/** @param {string} name @param {string} rows @param {string} [attrs] */
const table = (name, rows, attrs = "") => `<table:table table:name="${name}"${attrs ? " " + attrs : ""}>${rows}</table:table>`;

const TABLE_STYLES = `<style:style style:name="ta1" style:family="table"><style:table-properties table:display="true"/></style:style>
  <style:style style:name="taHidden" style:family="table"><style:table-properties table:display="false"/></style:style>
  <style:style style:name="taNone" style:family="table"><style:table-properties/></style:style>`;

/* ------------------------------------------------------------------ R14 */

test("R14 sheets: one per <table:table> in order, sheetId null, hidden from the element's or its style's table:display, the element winning", async () => {
  const body = [
    table("Plain", row(cell("a"))),
    table("StyleShown", row(cell("b")), 'table:style-name="ta1"'),
    table("StyleHidden", row(cell("c")), 'table:style-name="taHidden"'),
    table("ElementHidden", row(cell("d")), 'table:display="false"'),
    table("ElementWins", row(cell("e")), 'table:style-name="taHidden" table:display="true"'),
    table("ElementWinsHidden", row(cell("f")), 'table:style-name="ta1" table:display="false"'),
    table("StyleSaysNothing", row(cell("g")), 'table:style-name="taNone"'),
    table("UnknownStyle", row(cell("h")), 'table:style-name="nope"'),
  ].join("");
  const s = await S(body, TABLE_STYLES);
  const hidden = new Set(["StyleHidden", "ElementHidden", "ElementWinsHidden"]);
  assert.deepEqual(s.sheets, ["Plain", "StyleShown", "StyleHidden", "ElementHidden", "ElementWins", "ElementWinsHidden", "StyleSaysNothing", "UnknownStyle"]
    .map((name, sheet) => ({ sheet, name, sheetId: null,
      state: hidden.has(name) ? "hidden" : "visible", hidden: hidden.has(name) ? "hidden" : false })));
  assert.deepEqual((await S("")).sheets, []);
});

/* ------------------------------------------------------------------ R15 */

test("R15 formulas: one item per cell carrying table:formula, verbatim, beside the displayed value (or the raw value when none is displayed)", async () => {
  const body = table("Calc", [
    row(`<table:table-cell office:value-type="float" office:value="1"><text:p>1</text:p></table:table-cell>`
      + `<table:table-cell table:formula="of:=SUM([.A1:.A2])" office:value-type="float" office:value="3"><text:p>3.00</text:p></table:table-cell>`),
    row(`<table:table-cell office:value-type="float" office:value="2"><text:p>2</text:p></table:table-cell>`
      + `<table:table-cell table:formula="of:=[.A2]*2" office:value-type="float" office:value="4"/>`
      + `<table:table-cell table:formula="of:=NA()"/>`
      + `<table:table-cell table:formula="of:=&quot;x&quot;&amp;&quot;y&quot;" office:value-type="string" office:string-value="xy"/>`),
  ].join("")) + table("Other", row(empty(2) + `<table:table-cell table:formula="of:=Calc.B1" office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell>`));
  const s = await S(body);
  assert.deepEqual(items(s, "formula"), [
    { kind: "formula", source: sheetCellRef("Calc", "B1"), formula: "of:=SUM([.A1:.A2])", value: "3.00" },
    { kind: "formula", source: sheetCellRef("Calc", "B2"), formula: "of:=[.A2]*2", value: "4" },
    { kind: "formula", source: sheetCellRef("Calc", "C2"), formula: "of:=NA()", value: null },
    { kind: "formula", source: sheetCellRef("Calc", "D2"), formula: 'of:="x"&"y"', value: "xy" },
    { kind: "formula", source: sheetCellRef("Other", "C1"), formula: "of:=Calc.B1", value: "3" },
  ]);
  // never the formula in the text stream
  const t = await T(body);
  const doc = t.document;
  assert.ok(doc !== null);
  assert.ok(!doc.includes("of:="));
  assert.ok(!doc.includes("SUM"));
});

/* ------------------------------------------------------------------ R16 */

test("R16 hidden rows and columns as one range per run, never expanded, and hidden sheets: one item each per sheet that has any", async () => {
  const body = table("H", [
    `<table:table-column/><table:table-column table:visibility="collapse" table:number-columns-repeated="2"/><table:table-column table:visibility="filter"/><table:table-column/>`,
    row(cell("r1")),
    row(cell("r2"), 'table:visibility="collapse"'),
    row(cell("r3")),
    row(cell("r4-6"), 'table:visibility="filter" table:number-rows-repeated="3"'),
    row(empty(), 'table:visibility="collapse" table:number-rows-repeated="2"'),
    row(cell("r9")),
  ].join("")) + table("Shown", row(cell("x"))) + table("Gone", row(cell("y")), 'table:display="false"');
  const s = await S(body);
  assert.deepEqual(items(s, "hidden-rows"), [{ kind: "hidden-rows", sheet: "H",
    rows: [{ min: 2, max: 2, visibility: "collapse" }, { min: 4, max: 6, visibility: "filter" }, { min: 7, max: 8, visibility: "collapse" }],
    count: 3, source: null }]);
  assert.deepEqual(items(s, "hidden-cols"), [{ kind: "hidden-cols", sheet: "H",
    cols: [{ min: 2, max: 3, visibility: "collapse" }, { min: 4, max: 4, visibility: "filter" }], count: 2, source: null }]);
  assert.deepEqual(items(s, "hidden-sheet"), [{ kind: "hidden-sheet", sheet: "Gone", state: "hidden", source: null }]);
  // a collapsed run of a million empty rows below the content is ONE range, and the sheet still reads
  const tail = await S(table("T", row(cell("a")) + row(empty(1024), 'table:visibility="collapse" table:number-rows-repeated="1048575"')));
  assert.deepEqual(items(tail, "hidden-rows"), [{ kind: "hidden-rows", sheet: "T",
    rows: [{ min: 2, max: 1048576, visibility: "collapse" }], count: 1, source: null }]);
  // two adjacent hidden rows written as two elements are two ranges, never merged; a sheet with none has no item
  const two = await S(table("A", row(cell("x"), 'table:visibility="filter"') + row(cell("y"), 'table:visibility="filter"')) + table("B", row(cell("z"))));
  assert.deepEqual(items(two, "hidden-rows"), [{ kind: "hidden-rows", sheet: "A",
    rows: [{ min: 1, max: 1, visibility: "filter" }, { min: 2, max: 2, visibility: "filter" }], count: 2, source: null }]);
  assert.deepEqual(items(two, "hidden-cols"), []);
});

/* ------------------------------------------------------------------ R17 */

test("R17 links: every <text:a>/<draw:a> href in a cell, at that cell's sheet-cell reference, a repeated cell's at each address", async () => {
  /** @param {string} h */
  const link = (h) => `<table:table-cell office:value-type="string"><text:p><text:a xlink:href="${h}">t</text:a></text:p></table:table-cell>`;
  const body = table("L", [
    row(empty() + link("https://example.org/a")),
    row(`<table:table-cell office:value-type="string" table:number-columns-repeated="2"><text:p><text:a xlink:href="#Sheet2.A1">r</text:a></text:p></table:table-cell>`),
    row(`<table:table-cell><draw:a xlink:href="mailto:x@example.org"><draw:frame/></draw:a></table:table-cell>`),
    row(link("page.html"), 'table:number-rows-repeated="2"'),
  ].join(""));
  const s = await S(body);
  /** @param {string} h @param {string} partition @param {string} cellRef */
  const rec = (h, partition, cellRef) => (partition === "anchor"
    ? { partition, wrapper: h, target: { fragment: h, name: h.slice(1) }, source: sheetCellRef("L", cellRef) }
    : { partition, wrapper: partition === "deferred" ? linkWrapper.deferred(h) : linkWrapper.refused(), target: { url: h }, source: sheetCellRef("L", cellRef) });
  assert.deepEqual(s.links, [
    rec("https://example.org/a", "deferred", "B1"),
    rec("#Sheet2.A1", "anchor", "A2"), rec("#Sheet2.A1", "anchor", "B2"),
    rec("mailto:x@example.org", "refused", "A3"),
    rec("page.html", "deferred", "A4"), rec("page.html", "deferred", "A5"),
  ]);
  assert.deepEqual(s.counts, { anchor: 2, intra: 0, deferred: 3, refused: 1, undetermined: 0 });
});

/* ------------------------------------------------------------------ R18 */

test("R18 text() sheets: capacity null, used extent from the cells (padding never counts), range from usedSheetRange", async () => {
  const body = table("Used", [
    `<table:table-column table:number-columns-repeated="1024"/>`,
    row(cell("a") + empty(3) + cell("e") + empty(1000)),
    row(empty(1024), 'table:number-rows-repeated="5"'),
    row(empty(2) + cell("c7")),
    row(empty(1024), 'table:number-rows-repeated="1048000"'),
  ].join("")) + table("Blank", row(empty(50), 'table:number-rows-repeated="99"')) + table("Hidden", row(cell("h")), 'table:display="false"');
  const t = await T(body);
  assert.deepEqual(t.sheets.map(({ text, cells, lineRows, ...s }) => s), [   // cells: R46 (cells.test.mjs); lineRows: R19 (below)
    { sheet: 0, name: "Used", hidden: false, rows: null, cols: null, usedRows: 7, usedCols: 5, range: usedSheetRange("Used", 7, 5), undetermined: [] },
    { sheet: 1, name: "Blank", hidden: false, rows: null, cols: null, usedRows: 0, usedCols: 0, range: null, undetermined: [] },
    { sheet: 2, name: "Hidden", hidden: "hidden", rows: null, cols: null, usedRows: 1, usedCols: 1, range: usedSheetRange("Hidden", 1, 1), undetermined: [] },
  ]);
});

/* ------------------------------------------------------------------ R19 */

test("R19 a sheet's text is its non-empty rows of displayed values, tab-joined; hidden sheets included; cells and formulas counted", async () => {
  const body = table("One", [
    row(cell("a1") + cell("b1")),
    row(empty(3)),
    row(`<table:table-cell office:value-type="float" office:value="7"/>` + cell("b3")),
    row(`<table:table-cell table:formula="of:=1+1" office:value-type="float" office:value="2"><text:p>2</text:p></table:table-cell>`),
    row(`<table:table-cell table:formula="of:=NA()"/>`),
  ].join("")) + table("Empty", row(empty(4))) + table("Hid", row(cell("secret")), 'table:display="false"');
  const t = await T(body);
  assert.deepEqual(t.sheets.map((s) => s.text), ["a1\tb1\n7\tb3\n2", "", "secret"]);
  const doc = t.document;
  assert.equal(doc, "a1\tb1\n7\tb3\n2\nsecret");
  assert.deepEqual({ ...t.counts, scanned_bytes: undefined }, { chars: doc.length, cells: 6, formulas: 2, undetermined: 0, scanned_bytes: undefined });
  assert.deepEqual(t.undetermined, []);
  assert.ok(!doc.includes("of:"));
});

test("R19 lineRows: every sheet carries one 1-based sheet row per line of its text, through empty rows, repeated rows and a cell holding several lines", async () => {
  const body = table("Rows", [
    row(cell("head") + cell("h2")),                           // row 1
    row(empty(3)),                                            // row 2, empty: no line
    row(empty(1024), 'table:number-rows-repeated="5"'),       // rows 3-7, empty and repeated: no line
    row(cell("r8")),                                          // row 8
    row(cell("rep"), 'table:number-rows-repeated="3"'),       // rows 9-11, one line each
    row(`<table:table-cell office:value-type="string"><text:p>m1</text:p><text:p>m2</text:p></table:table-cell>`),   // row 12, two lines
    row(empty(2) + cell("late")),                             // row 13
    row(empty(1024), 'table:number-rows-repeated="1048000"'),
  ].join("")) + table("Blank", row(empty(4), 'table:number-rows-repeated="9"'))
    + table("Hid", row(empty(1)) + row(cell("secret")), 'table:display="false"');
  const t = await T(body);
  const [rows, blank, hid] = t.sheets;
  assert.ok(rows); assert.ok(blank); assert.ok(hid);
  assert.deepEqual(rows.text.split("\n"), ["head\th2", "r8", "rep", "rep", "rep", "m1", "m2", "late"]);
  assert.deepEqual(rows.lineRows, [1, 8, 9, 10, 11, 12, 12, 13]);
  assert.equal(rows.lineRows.length, rows.text.split("\n").length);
  assert.equal(blank.text, "");
  assert.deepEqual(blank.lineRows, []);
  assert.deepEqual(hid.text, "secret");
  assert.deepEqual(hid.lineRows, [2]);
});

/* ------------------------------------------------------------------ R20 */

test("R20 text() over the guard carries the guard marker verbatim; with no readable body, one marker naming why with sheet and cell null", async () => {
  const over = await odsEntry.text(buildZip(withCd(members("ods", { body: table("S", row(cell("x"))) }), "content.xml", { usize: OVER_BOUND })));
  assert.equal(over.ok, true);
  assert.equal(over.document, null);
  assert.deepEqual(over.sheets, []);
  assert.deepEqual(over.undetermined, [{ ...sizeGuard(OVER_BOUND), final: true }]);
  assert.deepEqual({ ...over.counts, scanned_bytes: undefined }, { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: undefined });
  /** @type {[Uint8Array, string][]} */
  const unread = [
    [buildZip(withCd(members("ods"), "content.xml", { crc: 9 })), "crc_mismatch"],
    [pkg("ods", { content: "<office:document-content><office:body><office:text/></office:body></office:document-content>" }), "no_office_spreadsheet_body"],
  ];
  for (const [bytes, reason] of unread) {
    const t = await odsEntry.text(bytes);
    assert.ok(t.ok);
    assert.equal(t.document, null);
    assert.deepEqual(t.sheets, []);
    assert.deepEqual(t.undetermined, [{ sheet: null, cell: null, reason }]);
    assert.deepEqual({ ...t.counts, scanned_bytes: undefined }, { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: undefined });
  }
  // structure() on the same: no sheets read, and the notes say which
  const so = await odsEntry.structure(buildZip(withCd(members("ods", { body: table("S", row(cell("x"))) }), "content.xml", { usize: OVER_BOUND })));
  assert.ok(so.ok);
  assert.deepEqual(so.sheets, []);
  assert.ok(so.notes.some((n) => /size bound/.test(n)));
});

/* ------------------------------------------------------------------ R42 */

test("R42 a sheet's capacity is always null, however large its used range", async () => {
  const wide = table("Wide", row(empty(20000) + cell("far")) + row(empty(), 'table:number-rows-repeated="2000000"') + row(cell("deep")));
  const t = await T(wide);
  const [s0] = t.sheets;
  assert.ok(s0);
  assert.equal(s0.rows, null);
  assert.equal(s0.cols, null);
  assert.equal(s0.usedCols, 20001);
  assert.equal(s0.usedRows, 2000002);
  for (const b of ["", table("E", "")]) for (const s of (await T(b)).sheets) assert.deepEqual([s.rows, s.cols], [null, null]);
});
