/* office-readers, the two services N27 names in Provides for odf-reader's
 * `.ods` half of D-415: `a1Corner` (proposed R26) and `rangeUnitFor`
 * (proposed R27), the one reading of an A1 corner and the one place a
 * rectangle becomes a `sheet-range` unit. Driven through their exports only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { xlsxEntry, a1Corner, rangeUnitFor, usedSheetRange } from "../../../src/formats-xlsx.mjs";
import * as F from "./fixtures.mjs";

/** @param {number} n */
const letters = (n) => { let s = ""; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
const XLSX_GRID = { rows: 1048576, cols: 16384 };
/** @param {string} sheet @param {string} range */
const unit = (sheet, range) => ({ kind: "sheet-range", ref: `${sheet}!${range}`, sheet, range });
/** @type {unknown[]} */
const ODD = [undefined, null, 0, 1, -1, 1.5, NaN, "", "A1", {}, [], true, Symbol("s"), () => 1, new Uint8Array(2), { col: 1 }, { row: 1 }];

/* ------------------------------------------------------------------ R26 */

test("R26 a1Corner: every one-to-three-letter column reads as its bijective base-26 number, in any case and with either $ marker", () => {
  for (let col = 1; col <= 18278; col++) {
    const L = letters(col);
    const row = (col * 37) % 9999999 + 1;
    for (const s of [`${L}${row}`, `$${L}$${row}`, `$${L}${row}`, `${L}$${row}`, `${L.toLowerCase()}${row}`]) {
      assert.deepEqual(a1Corner(s), { col, row }, s);
    }
  }
  assert.equal(letters(18278), "ZZZ");
  assert.deepEqual(a1Corner("XFD1048576"), { col: 16384, row: 1048576 });
});

test("R26 a1Corner: rows 1 to 9,999,999 without a leading zero; surrounding whitespace trimmed", () => {
  for (const row of [1, 9, 10, 99, 100, 1048576, 1048577, 9999999]) assert.deepEqual(a1Corner(`B${row}`), { col: 2, row });
  assert.deepEqual(a1Corner("  $B$14\t"), { col: 2, row: 14 });
  assert.deepEqual(a1Corner("\nb14 "), { col: 2, row: 14 });
});

test("R26 a1Corner: null for anything that is not one A1 corner — never a guessed corner, never a throw", () => {
  const notCorners = ["", " ", "A", "1", "$A", "A$", "$1", "A0", "A01", "A00", "B10000000", "AAAA1", "A1:B2", "A 1", "$$A1", "A$$1",
    "Sheet!A1", "'S'!A1", "R1C1", "A-1", "A1.5", "A+1", "1A", "A1A", "Ä1", "A１", ":A1", "A:A", "1:1", "#REF!"];
  for (const s of notCorners) assert.equal(a1Corner(s), null, JSON.stringify(s));
  for (const x of ODD.filter((v) => typeof v !== "string")) {
    assert.doesNotThrow(() => a1Corner(x));
    assert.equal(a1Corner(x), null, String(typeof x));
  }
  assert.equal(a1Corner(new String("A1")), null, "a String object is not a string");
});

/* ------------------------------------------------------------------ R27 */

test("R27 rangeUnitFor: two corners on a sheet of the workbook give the sheet-range unit, top-left corner first, whichever order they come in", () => {
  const sheets = ["Data", "Other", "It's here"];
  const tl = { col: 2, row: 2 }, br = { col: 4, row: 9 }, tr = { col: 4, row: 2 }, bl = { col: 2, row: 9 };
  for (const [a, b] of [[tl, br], [br, tl], [tr, bl], [bl, tr]]) {
    assert.deepEqual(rangeUnitFor("Data", a, b, sheets, XLSX_GRID), { unit: unit("Data", "B2:D9") });
  }
  assert.deepEqual(rangeUnitFor("Other", { col: 3, row: 3 }, { col: 3, row: 3 }, sheets, XLSX_GRID), { unit: unit("Other", "C3:C3") }, "one cell is a one-cell range");
  assert.deepEqual(rangeUnitFor("It's here", { col: 1, row: 1 }, { col: 1, row: 2 }, sheets, null), { unit: unit("It's here", "A1:A2") });
  assert.deepEqual(rangeUnitFor("Data", a1Corner("$AA$10"), a1Corner("ab11"), sheets), { unit: unit("Data", "AA10:AB11") }, "grid defaults to none");
});

test("R27 rangeUnitFor: the unit is the one builder's (usedSheetRange's shape and spelling for every A1-anchored rectangle)", () => {
  for (let c = 1; c <= 800; c += 7) for (const r of [1, 2, 99, 1048576]) {
    const made = rangeUnitFor("S", { col: 1, row: 1 }, { col: c, row: r }, ["S"], XLSX_GRID);
    assert.ok("unit" in made);
    assert.deepEqual(made.unit, usedSheetRange("S", r, c));
  }
});

test("R27 rangeUnitFor: a sheet name matches exactly, else without case when exactly one sheet answers; the unit carries the workbook's spelling", () => {
  const a = { col: 1, row: 1 };
  assert.deepEqual(rangeUnitFor("dAtA", a, a, ["Data", "Other"], XLSX_GRID), { unit: unit("Data", "A1:A1") });
  assert.deepEqual(rangeUnitFor("DATA", a, a, ["Data", "DATA"], XLSX_GRID), { unit: unit("DATA", "A1:A1") }, "an exact match wins");
  assert.deepEqual(rangeUnitFor("data", a, a, ["Data", "DATA"], XLSX_GRID), { why: "no_such_sheet" }, "two sheets answer without case: not guessed");
  assert.deepEqual(rangeUnitFor("Missing", a, a, ["Data"], XLSX_GRID), { why: "no_such_sheet" });
  assert.deepEqual(rangeUnitFor("Data", a, a, [], XLSX_GRID), { why: "no_such_sheet" });
  assert.deepEqual(rangeUnitFor("null", a, a, ["Data"], XLSX_GRID), { why: "no_such_sheet" });
  for (const bad of [null, undefined, 1, {}, ["Data"]]) assert.deepEqual(rangeUnitFor(bad, a, a, ["Data", "null", "1"], XLSX_GRID), { why: "no_such_sheet" }, String(bad));
  /** @type {unknown[]} */
  const badSheets = [null, undefined, "Data", { Data: 1 }, 5];
  for (const bad of badSheets) assert.deepEqual(rangeUnitFor("Data", a, a, bad, XLSX_GRID), { why: "no_such_sheet" }, String(bad));
});

test("R27 rangeUnitFor: with a grid, a rectangle past it on either axis is outside_grid and one at its edge is a unit; with none, nothing is outside", () => {
  const a = { col: 1, row: 1 };
  assert.deepEqual(rangeUnitFor("S", a, a1Corner("XFD1048576"), ["S"], XLSX_GRID), { unit: unit("S", "A1:XFD1048576") });
  assert.deepEqual(rangeUnitFor("S", a, a1Corner("A1048577"), ["S"], XLSX_GRID), { why: "outside_grid" });
  assert.deepEqual(rangeUnitFor("S", a, a1Corner("XFE1"), ["S"], XLSX_GRID), { why: "outside_grid" });
  assert.deepEqual(rangeUnitFor("S", a1Corner("XFE1"), a, ["S"], XLSX_GRID), { why: "outside_grid" }, "either corner");
  assert.deepEqual(rangeUnitFor("S", a, a1Corner("ZZZ9999999"), ["S"], null), { unit: unit("S", "A1:ZZZ9999999") });
  assert.deepEqual(rangeUnitFor("Missing", a, a1Corner("XFE1"), ["S"], XLSX_GRID), { why: "no_such_sheet" }, "the sheet is judged first");
});

test("R27 rangeUnitFor: a corner that is not one (as a1Corner's null, or any other value) is not_a_range_reference; nothing throws", () => {
  const a = { col: 1, row: 1 };
  /** @type {unknown[]} */
  const badCorners = [null, undefined, {}, { col: 0, row: 1 }, { col: 1, row: 0 }, { col: 1.5, row: 1 }, { col: 1, row: -2 }, { col: "1", row: "1" }, { col: NaN, row: 1 }, "A1", 1, [1, 1]];
  for (const bad of badCorners) {
    assert.deepEqual(rangeUnitFor("S", bad, a, ["S"], XLSX_GRID), { why: "not_a_range_reference" }, JSON.stringify(bad));
    assert.deepEqual(rangeUnitFor("S", a, bad, ["S"], XLSX_GRID), { why: "not_a_range_reference" }, JSON.stringify(bad));
  }
  assert.deepEqual(rangeUnitFor("S", a1Corner("A:A"), a, ["S"], XLSX_GRID), { why: "not_a_range_reference" });
  for (const x of ODD) for (const y of ODD) {
    assert.doesNotThrow(() => rangeUnitFor(x, y, y, x, y));
    assert.doesNotThrow(() => rangeUnitFor("S", a, a, ["S"], x));
  }
});

/* ------------------------------------------------------------------ R11 */

test("R11 xlsx used range: a cell whose reference is no A1 corner does not reach usedCols (a1Corner's reading, the one there is)", async () => {
  const t = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: { rows: [{ r: 2, cells: [{ r: "B2", t: "inlineStr", is: "x" }, { r: "Z0", t: "inlineStr", is: "y" }, { r: "$C$2", t: "inlineStr", is: "z" }] }] } }] }));
  assert.ok(t.ok);
  const sheet0 = t.sheets[0];
  assert.ok(sheet0);
  assert.equal(sheet0.usedCols, 3);
  assert.equal(sheet0.usedRows, 2);
});
