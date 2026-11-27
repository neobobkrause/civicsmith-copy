/* office-readers R49 (fix round 10, cause 21 (b); K5056, K4630; as csv-reader R22): a workbook wider than its format's grid is
   refused whole, stated with the count and the limit; a sheet of exactly 16,384 columns is read. */
import test from "node:test";
import assert from "node:assert/strict";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { generate } from "../../sheetgen.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";

const COLS = boundOf("sheet", "columns");
/** @param {number} cols */
const wide = (cols) => generate({ kind: "xlsx", seed: "rw9-B-9a", size: { rows: 10, cols } }).bytes();

test("R49 control: an xlsx of 10 rows and exactly 16,384 columns is read, with no refusal and no outside_grid note", async () => {
  assert.equal(COLS, 16384);
  const t = await xlsxEntry.text(await wide(COLS));
  assert.equal(t.ok, true);
  assert.equal(typeof t.document, "string");
  const sheet0 = t.sheets[0];
  assert.ok(sheet0);
  assert.equal(sheet0.usedCols, COLS);
  assert.ok(!t.undetermined.some((u) => ("why" in u && u.why === "over_size_bound") || ("reason" in u && u.reason === "outside_grid")));
  assert.ok(!sheet0.undetermined.some((u) => "reason" in u && u.reason === "outside_grid"));
});

test("R49: an xlsx of 10 rows and 16,385 columns is refused whole with its count and the limit (metric columns, final), and read on by no path", async () => {
  const bytes = await wide(COLS + 1);
  const t = await xlsxEntry.text(bytes);
  assert.equal(t.ok, true);
  assert.equal(t.document, null);
  assert.deepEqual(t.sheets, []);
  const u = t.undetermined.find((x) => "why" in x && x.why === "over_size_bound");
  assert.ok(u, JSON.stringify(t.undetermined));
  assert.ok("metric" in u);
  assert.equal(u.metric, "columns");
  assert.equal(u.size, COLS + 1);
  assert.equal(u.bound, COLS);
  assert.equal(u.final, true);
  assert.equal(typeof u.part, "string");
  assert.match(u.statement, /16385/);
  assert.match(u.statement, /16384/);
  const s = await xlsxEntry.structure(bytes);
  assert.equal(s.ok, true);
});
