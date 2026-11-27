/* odf-reader: the .ods entry's typed cells, R46 (C:A-4), in office-readers
 * R30's contract, tested through odsEntry.text(). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odsEntry, ODF_REPEAT_EXPANSION_MAX } from "../../../src/odf.mjs";
import { sizeGuard } from "../../../src/ooxml.mjs";
import { sheetCellRef } from "../../../src/formats-xlsx.mjs";
import { buildZip, members, pkg, withCd, OVER_BOUND } from "./pkg.mjs";

/** @param {string} body */
const ods = (body) => pkg("ods", { body });
/* Every test that calls T reads the answer's sheets, so relies on the read succeeding: T states that
   (assert.ok(t.ok)) before handing the answer back. */
/** @param {string} body */
const T = async (body) => { const t = await odsEntry.text(ods(body)); assert.ok(t.ok); return t; };
/** @param {string} cells @param {string} [attrs] */
const row = (cells, attrs = "") => `<table:table-row${attrs ? " " + attrs : ""}>${cells}</table:table-row>`;
/** @param {string} name @param {string} rows @param {string} [attrs] */
const table = (name, rows, attrs = "") => `<table:table table:name="${name}"${attrs ? " " + attrs : ""}>${rows}</table:table>`;
/** @param {string} attrs @param {string | null} [text] */
const c = (attrs, text = null) => (text == null
  ? `<table:table-cell ${attrs}/>`
  : `<table:table-cell ${attrs}><text:p>${text}</text:p></table:table-cell>`);
/** @param {number} [n] */
const empty = (n = 1) => `<table:table-cell${n > 1 ? ` table:number-columns-repeated="${n}"` : ""}/>`;
const KEYS = ["source", "value", "type", "declared", "cached", "formula"];
/**
 * @param {string} sheet @param {string} at @param {string | null} value @param {string | null} type
 * @param {string | null} declared @param {string | null} [cached] @param {string | null} [formula]
 */
const cell = (sheet, at, value, type, declared, cached = null, formula = null) =>
  ({ source: sheetCellRef(sheet, at), value, type, declared, cached, formula });

test("R46 each value type maps as office-readers R30's set, value the attribute as written, declared the value-type as written", async () => {
  const body = table("V", [
    row(c('office:value-type="float" office:value="0.1"', "0.10")
      + c('office:value-type="float" office:value="1.10"', "1.1")
      + c('office:value-type="float" office:value="0.30000000000000004"', "0.3")
      + c('office:value-type="float" office:value="123456789012345678901234567890"', "1.2E+29")),
    row(c('office:value-type="percentage" office:value="0.125"', "12.50%")
      + c('office:value-type="currency" office:currency="USD" office:value="-1500.5"', "($1,500.50)")
      + c('office:value-type="date" office:date-value="2026-10-05T13:30:00"', "10/05/26")
      + c('office:value-type="time" office:time-value="PT01H30M00S"', "01:30")),
    row(c('office:value-type="boolean" office:boolean-value="true"', "TRUE")
      + c('office:value-type="string" office:string-value="stated"', "shown")
      + c('office:value-type="string"', "a&amp;b")
      + c("", "untyped text")),
  ].join(""));
  const t = await T(body);
  const [s0] = t.sheets;
  assert.ok(s0);
  assert.deepEqual(s0.cells, [
    cell("V", "A1", "0.1", "number", "float"),
    cell("V", "B1", "1.10", "number", "float"),
    cell("V", "C1", "0.30000000000000004", "number", "float"),
    cell("V", "D1", "123456789012345678901234567890", "number", "float"),
    cell("V", "A2", "0.125", "number", "percentage"),
    cell("V", "B2", "-1500.5", "number", "currency"),
    cell("V", "C2", "2026-10-05T13:30:00", "date", "date"),
    cell("V", "D2", "PT01H30M00S", "time", "time"),
    cell("V", "A3", "true", "boolean", "boolean"),
    cell("V", "B3", "stated", "text", "string"),
    cell("V", "C3", "a&b", "text", "string"),
    cell("V", "D3", "untyped text", "text", null),
  ]);
  const cells0 = s0.cells;
  assert.ok(cells0);
  for (const x of cells0) assert.deepEqual(Object.keys(x), KEYS);
  // the displayed text stream is unchanged: values are never re-rendered into it
  assert.equal(s0.text.split("\n")[0], "0.10\t1.1\t0.3\t1.2E+29");
});

test("R46 a formula cell keeps its formula verbatim and its value attribute as cached (null when none); nothing is recalculated", async () => {
  const body = table("F", row(
    c('table:formula="of:=SUM([.A1:.A2])" office:value-type="float" office:value="3"', "3.00")
    + c('table:formula="of:=1/3" office:value-type="float" office:value="0.333333333333333"', "0.33")
    + c('table:formula="of:=NA()"')
    + c('table:formula="of:=&quot;x&quot;&amp;&quot;y&quot;" office:value-type="string"', "xy")
    + c('table:formula="of:=[.A1]>1" office:value-type="boolean" office:boolean-value="false"', "FALSE")
    + c('table:formula="of:=2+2" office:value-type="float" office:value="5"', "5"),
  ));
  const t = await T(body);
  const [s0] = t.sheets;
  assert.ok(s0);
  assert.deepEqual(s0.cells, [
    cell("F", "A1", "3", "number", "float", "3", "of:=SUM([.A1:.A2])"),
    cell("F", "B1", "0.333333333333333", "number", "float", "0.333333333333333", "of:=1/3"),
    cell("F", "C1", null, null, null, null, "of:=NA()"),
    cell("F", "D1", "xy", "text", "string", null, 'of:="x"&"y"'),
    cell("F", "E1", "false", "boolean", "boolean", "false", "of:=[.A1]>1"),
    // the file's cached 5 is held as the file states it, never recomputed to 4
    cell("F", "F1", "5", "number", "float", "5", "of:=2+2"),
  ]);
});

test("R46 one entry per cell holding a value or a formula, in row then column order, a repeated cell at each address; empty cells none", async () => {
  const body = table("R", [
    `<table:table-column table:number-columns-repeated="8"/>`,
    row(empty(2) + c('office:value-type="float" office:value="7" table:number-columns-repeated="2"', "7") + empty(1000)),
    row(empty(8), 'table:number-rows-repeated="3"'),
    row(c('office:value-type="string"', "r") + c('office:value-type="string" office:string-value=""', "")
      + c('office:value-type="string"', "") + c("", ""), 'table:number-rows-repeated="2"'),
  ].join("")) + table("Hidden", row(c('office:value-type="string"', "secret")), 'table:display="false"')
    + table("Blank", row(empty(9), 'table:number-rows-repeated="9"'));
  const t = await T(body);
  assert.deepEqual(t.sheets.map((s) => s.cells), [
    [cell("R", "C1", "7", "number", "float"), cell("R", "D1", "7", "number", "float"),
      cell("R", "A5", "r", "text", "string"), cell("R", "A6", "r", "text", "string")],
    [cell("Hidden", "A1", "secret", "text", "string")],
    [],
  ]);
  assert.equal(t.sheets.reduce((n, s) => { const cs = s.cells; assert.ok(cs); return n + cs.length; }, 0), t.counts.cells);
});

test("R46 an unknown value type types nothing: declared as written, type null", async () => {
  const t = await T(table("U", row(c('office:value-type="void" office:value="1"', "1") + c('office:value-type="Float" office:value="2"', "2"))));
  const [s0] = t.sheets;
  assert.ok(s0);
  assert.deepEqual(s0.cells, [cell("U", "A1", "1", null, "void"), cell("U", "B1", "2", null, "Float")]);
});

test("R46 within R45's bound every address is given; over it, over the guard or with no body, no sheet and so no cells list stands", async () => {
  const MAX = ODF_REPEAT_EXPANSION_MAX;
  const at = await T(table("S", row(c(`office:value-type="float" office:value="1" table:number-columns-repeated="${MAX}"`, "1"))));
  const [atSheet] = at.sheets;
  assert.ok(atSheet);
  const atCells = atSheet.cells;
  assert.ok(atCells);
  assert.equal(atCells.length, MAX);
  /** @param {number} n */
  const letters = (n) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  assert.deepEqual(atCells[MAX - 1], cell("S", `${letters(MAX)}1`, "1", "number", "float"));
  /* the guard's marker names its why as sizeGuard (ooxml) states it: string | undefined */
  /** @type {[Uint8Array, string | undefined][]} */
  const unread = [
    [ods(table("S", row(c(`office:value-type="float" office:value="1" table:number-columns-repeated="${MAX + 1}"`, "1")))), "over_repeat_bound"],
    [buildZip(withCd(members("ods", { body: table("S", row(c('office:value-type="float" office:value="1"', "1"))) }), "content.xml", { usize: OVER_BOUND })), sizeGuard(OVER_BOUND).why],
    [pkg("ods", { content: "<office:document-content><office:body><office:text/></office:body></office:document-content>" }), "no_office_spreadsheet_body"],
  ];
  for (const [bytes, marker] of unread) {
    const t = await odsEntry.text(bytes);
    assert.equal(t.ok, true);
    assert.deepEqual(t.sheets, []);
    assert.equal(t.document, null);
    assert.equal(t.undetermined.length, 1);
    const [u0] = t.undetermined;
    assert.ok(u0);
    assert.equal(u0.why ?? ("reason" in u0 ? u0.reason : undefined), marker);
  }
});
