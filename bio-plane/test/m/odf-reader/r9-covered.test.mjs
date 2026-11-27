/* odf-reader R50 (fix round 9, G133b; S-18): a covered table cell is iterated as a cell of its address. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odsEntry } from "../../../src/odf.mjs";
import { sheetCellRef } from "../../../src/formats-xlsx.mjs";
import { ods, tableOf, rowOf, cellOf } from "./r9.mjs";

/** @param {number} [n] */
const covered = (n = 1) => `<table:covered-table-cell${n > 1 ? ` table:number-columns-repeated="${n}"` : ""}/>`;

test("R50 a value to the right of a merge keeps its column: C1 is C1 in cells, in the row's text and in every sheet-cell reference", async () => {
  const merged = `<table:table-cell office:value-type="string" table:number-columns-spanned="2" table:number-rows-spanned="1"><text:p>wide</text:p></table:table-cell>${covered()}`;
  const body = tableOf("M", rowOf(merged + cellOf("right")) + rowOf(cellOf("a") + cellOf("b") + cellOf("c")));
  const t = await odsEntry.text(ods(body));
  assert.ok(t.ok);
  const s = t.sheets[0];
  assert.ok(s);
  assert.deepEqual(s.cells?.map((c) => [c.source.cell, c.value]), [["A1", "wide"], ["C1", "right"], ["A2", "a"], ["B2", "b"], ["C2", "c"]]);
  assert.equal(s.text, "wide\tright\na\tb\tc");
  assert.equal(s.usedCols, 3);
  assert.equal(s.range?.ref, "M!A1:C2");
  const st = await odsEntry.structure(ods(tableOf("M", rowOf(merged + `<table:table-cell table:formula="of:=1" office:value-type="float" office:value="1"><text:p>1</text:p></table:table-cell>`)
    .replace("<text:p>1</text:p>", `<text:p>1<text:a xlink:href="http://x.test/">l</text:a></text:p>`))));
  assert.ok(st.ok);
  assert.deepEqual(st.evidentiary.items.filter((i) => i.kind === "formula").map((i) => i.source), [sheetCellRef("M", "C1")]);
  assert.deepEqual(st.links.filter((l) => l.source).map((l) => l.source), [sheetCellRef("M", "C1")]);
});

test("R50 a repeated covered cell advances its whole run and holds no value, even one written inside it", async () => {
  const body = tableOf("R", rowOf(`<table:table-cell office:value-type="string" table:number-columns-spanned="4"><text:p>x</text:p></table:table-cell>${covered(3)}`
    + `<table:covered-table-cell office:value-type="string"><text:p>ghost</text:p></table:covered-table-cell>` + cellOf("after")));
  const t = await odsEntry.text(ods(body));
  assert.ok(t.ok);
  const s = t.sheets[0];
  assert.ok(s);
  assert.deepEqual(s.cells?.map((c) => [c.source.cell, c.value]), [["A1", "x"], ["F1", "after"]]);
  assert.equal(s.text, "x\tafter");
});

test("R50 a merge across rows: the covered cells of the next row leave its own cells at their columns", async () => {
  const body = tableOf("V", rowOf(`<table:table-cell office:value-type="string" table:number-rows-spanned="2"><text:p>tall</text:p></table:table-cell>` + cellOf("b1"))
    + rowOf(covered() + cellOf("b2")));
  const t = await odsEntry.text(ods(body));
  assert.ok(t.ok);
  const s = t.sheets[0];
  assert.ok(s);
  assert.deepEqual(s.cells?.map((c) => [c.source.cell, c.value]), [["A1", "tall"], ["B1", "b1"], ["B2", "b2"]]);
});
