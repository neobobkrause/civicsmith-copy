/* odf-reader R56 (fix round 9, G184; S-18, S-19): ODS cells are typed and placed as the file states. Markup is written
   as LibreOffice writes it (an error cell: office:value-type="string" beside calcext:value-type="error"). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odsEntry, ODF_REPEAT_EXPANSION_MAX } from "../../../src/odf.mjs";
import { ods, tableOf, rowOf, cellOf, floatOf } from "./r9.mjs";

/** @param {string} attrs */
const errorCell = (attrs) => `<table:table-cell ${attrs}><text:p>#DIV/0!</text:p></table:table-cell>`;
const MAX = ODF_REPEAT_EXPANSION_MAX;
/** @param {number} n */
const bigRow = (n) => rowOf(`<table:table-cell office:value-type="string" table:number-columns-repeated="${n}"><text:p>v</text:p></table:table-cell>`);

test("R56 office:value-type decides the type: an error cell keeps its type whichever attribute the file writes first", async () => {
  const a = errorCell('table:formula="of:=1/0" office:value-type="string" office:string-value="" calcext:value-type="error"');
  const b = errorCell('table:formula="of:=1/0" calcext:value-type="error" office:value-type="string" office:string-value=""');
  const c = errorCell('table:formula="of:=1/0" calcext:value-type="error"');
  const t = await odsEntry.text(ods(tableOf("E", rowOf(a + b + c))));
  assert.ok(t.ok);
  const cells = t.sheets[0]?.cells;
  assert.ok(cells);
  const [x, y, z] = cells;
  assert.ok(x && y && z);
  assert.deepEqual([x.declared, x.type], ["string", "text"]);
  assert.deepEqual([y.declared, y.type], ["string", "text"]);
  /* the office type is absent: calcext's is the one the file states, and no table maps it */
  assert.deepEqual([z.declared, z.type], ["error", null]);
});

test("R56 a cell right of a merge keeps its column (covered cells are iterated)", async () => {
  const merged = `<table:table-cell office:value-type="string" table:number-columns-spanned="2"><text:p>wide</text:p></table:table-cell><table:covered-table-cell/>`;
  const t = await odsEntry.text(ods(tableOf("M", rowOf(merged + floatOf(5)))));
  assert.ok(t.ok);
  const cells = t.sheets[0]?.cells;
  assert.ok(cells);
  assert.deepEqual(cells.map((c) => c.source.cell), ["A1", "C1"]);
});

test("R56 a typed-empty cell repeated to the sheet's edge is one empty run: read in full, never refused, no reach of its own", async () => {
  const padded = `<table:table-cell office:value-type="string" table:number-columns-repeated="16384"/>`;
  const body = tableOf("P", rowOf(cellOf("a") + padded, 'table:number-rows-repeated="64"') + rowOf(cellOf("last") + padded));
  const t = await odsEntry.text(ods(body));
  assert.equal(t.ok, true);
  assert.deepEqual(t.undetermined, []);
  const s = t.sheets[0];
  assert.ok(s);
  assert.equal(s.cells?.length, 65);
  assert.equal(s.usedCols, 1);
  assert.equal(s.usedRows, 65);
  const st = await odsEntry.structure(ods(body));
  assert.ok(st.ok);
  assert.deepEqual(st.evidentiary.undetermined.filter((u) => u.why === "over_repeat_bound"), []);
});

test("R56 every over_repeat_bound marker carries final, from text(), structure() and cellsIn", async () => {
  const units = ods(tableOf("S", bigRow(MAX + 1)));
  const t = await odsEntry.text(units);
  assert.ok(t.ok);
  const u0 = t.undetermined[0];
  assert.ok(u0);
  assert.equal(u0.why, "over_repeat_bound");
  assert.equal(u0.final, true);
  const st = await odsEntry.structure(units);
  assert.ok(st.ok);
  const marker = st.evidentiary.undetermined.find((u) => u.why === "over_repeat_bound");
  assert.ok(marker && marker.guard);
  assert.equal(marker.guard.final, true);
  const ci = await odsEntry.cellsIn(units, { sheet: "S" });
  assert.equal(ci.ok, false);
  assert.ok("final" in ci);
  assert.equal(ci.final, true);
  const chars = ods(tableOf("C", rowOf(cellOf("x".repeat(1 << 20)).replace(">", ' table:number-columns-repeated="22">'))));
  const tc = await odsEntry.text(chars);
  assert.ok(tc.ok);
  const c0 = tc.undetermined[0];
  assert.ok(c0 && "metric" in c0);
  assert.equal(c0.metric, "repeated_text_chars");
  assert.equal(c0.final, true);
});

test("R56 the repeat meter counts per sheet: two sheets of 200,000 units each are read; one sheet over the bound is still refused", async () => {
  const half = 200000;
  const two = ods(tableOf("A", bigRow(half)) + tableOf("B", bigRow(half)));
  const t = await odsEntry.text(two);
  assert.ok(t.ok);
  assert.deepEqual(t.undetermined, []);
  assert.deepEqual(t.sheets.map((s) => ("counts" in s ? s.counts : undefined) ?? s.usedCols), [half, half]);
  const st = await odsEntry.structure(two);
  assert.ok(st.ok);
  assert.deepEqual(st.evidentiary.undetermined.filter((u) => u.why === "over_repeat_bound"), []);
  const ci = await odsEntry.cellsIn(two, { sheet: "B", fromCol: half, toCol: half });
  assert.equal(ci.ok, true);
  assert.deepEqual(ci.cells.map((c) => c.source.cell), [`${(() => { let n = half - 1, s = ""; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; })()}1`]);
  const over = await odsEntry.text(ods(tableOf("A", bigRow(half)) + tableOf("B", bigRow(MAX + 1))));
  assert.ok(over.ok);
  assert.equal(over.undetermined[0]?.why, "over_repeat_bound");
});
