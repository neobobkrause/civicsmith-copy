/* office-readers R47 (fix round 9, G185; K5011; S-15 to S-18) and R48 (G186; K5020; CORPUS #1's F1): XLSX cells as the file states them. Shared-formula dependents carry their own
   formula text; a row or cell with no `r` is placed by its position; a styled empty cell does not extend the used range; `mergeCells` is read and a covered cell stated. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
/** @import {XlsxText} from "../../../src/formats-xlsx.mjs" */
/** @import {XlsxOptions} from "./fixtures.mjs" */

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
/** @param {string} body @param {string} [after] */
const sheet = (body, after = "") => `<?xml version="1.0"?><worksheet ${NS}><sheetData>${body}</sheetData>${after}</worksheet>`;
/** @param {string} xml @param {XlsxOptions} [extra] */
const book = (xml, extra = {}) => F.xlsx({ sheets: [{ name: "S", xml }], ...extra });
/** @param {XlsxText} t */
const formulas = (t) => {
  const cells = t.sheets[0]?.cells;
  assert(cells);
  return cells.filter((c) => c.formula != null).map((c) => [c.source.cell, c.formula]);
};

test("R47 shared formulas: each dependent states its own formula, the master's moved by the distance: relative references move, absolute ones stay, quoted text is left, off the grid is #REF!", async () => {
  const body = `<row r="2"><c r="C2"><f t="shared" ref="C2:C4" si="7">A2*2+$A$1+Other!B$5+SUM(A2:B3)+"A2"+'It''s A1'!C3+A:A+3:4</f><v>1</v></c></row>`
    + `<row r="3"><c r="C3"><f t="shared" si="7"/><v>2</v></c></row>`
    + `<row r="4"><c r="C4"><f t="shared" si="7"></f></c><c r="D4"><f t="shared" ref="D4:D5" si="8">A1</f></c></row>`
    + `<row r="5"><c r="D5"><f t="shared" si="8"/></c><c r="E5"><f t="shared" si="9"/></c></row>`;
  const t = await xlsxEntry.text(book(sheet(body)));
  assert(t.ok);
  assert.deepEqual(formulas(t), [
    ["C2", `A2*2+$A$1+Other!B$5+SUM(A2:B3)+"A2"+'It''s A1'!C3+A:A+3:4`],
    ["C3", `A3*2+$A$1+Other!B$5+SUM(A3:B4)+"A2"+'It''s A1'!C4+A:A+4:5`],
    ["C4", `A4*2+$A$1+Other!B$5+SUM(A4:B5)+"A2"+'It''s A1'!C5+A:A+5:6`],
    ["D4", "A1"], ["D5", "A2"], ["E5", ""],
  ]);
  assert.equal(t.counts.formulas, 6);
  /* a master far enough down moves a reference off the grid */
  const edge = await xlsxEntry.text(book(sheet(`<row r="1"><c r="B1"><f t="shared" ref="B1:B2" si="0">A1048576+A1</f></c></row><row r="2"><c r="B2"><f t="shared" si="0"/></c></row>`)));
  assert(edge.ok);
  assert.deepEqual(formulas(edge), [["B1", "A1048576+A1"], ["B2", "#REF!+A2"]]);
  /* the structure's formula items and the point read say the same */
  const s = await xlsxEntry.structure(book(sheet(body)));
  assert(s.ok);
  assert.deepEqual(s.evidentiary.items.flatMap((i) => (i.kind === "formula" && i.source.cell === "C4" ? [i.formula] : [])), [`A4*2+$A$1+Other!B$5+SUM(A4:B5)+"A2"+'It''s A1'!C5+A:A+5:6`]);
  const c = await xlsxEntry.cellsIn(book(sheet(body)), { sheet: "S", fromRow: 3, toRow: 4 });
  assert(c.ok);
  assert.deepEqual(c.cells.filter((x) => x.formula != null).map((x) => [x.source.cell, x.formula]), [
    ["C3", `A3*2+$A$1+Other!B$5+SUM(A3:B4)+"A2"+'It''s A1'!C4+A:A+4:5`],
    ["C4", `A4*2+$A$1+Other!B$5+SUM(A4:B5)+"A2"+'It''s A1'!C5+A:A+5:6`], ["D4", "A1"]]);
});

test("R47 R48 a row or cell with no `r` is placed by its position: a row is the one after the last, a cell the column after the last; one with `r` goes there", async () => {
  const body = `<row><c><v>a</v></c><c><v>b</v></c></row>`
    + `<row><c t="inlineStr"><is><t>x</t></is></c><c r="D2"><v>9</v></c><c><v>10</v></c></row>`
    + `<row r="5" hidden="1"><c><v>far</v></c></row><row><c r="B6"><v>z</v></c><c><v>w</v></c></row>`;
  const t = await xlsxEntry.text(book(sheet(body)));
  assert(t.ok);
  const s = t.sheets[0];
  assert(s);
  assert.deepEqual(s.cells?.map((c) => c.source.cell), ["A1", "B1", "A2", "D2", "E2", "A5", "B6", "C6"]);
  assert.equal(s.usedRows, 6);
  assert.equal(s.usedCols, 5);
  assert.equal(s.range.range, "A1:E6");
  assert.deepEqual(s.lineRows, [1, 2, 5, 6]);
  assert.equal(t.document, "a\tb\nx\t9\t10\nfar\nz\tw");
  const st = await xlsxEntry.structure(book(sheet(body)));
  assert(st.ok);
  assert.deepEqual(st.evidentiary.items.flatMap((i) => (i.kind === "hidden-rows" ? [i.rows] : [])), [[5]]);
  /* a position past the format's columns is not read as an address: the sheet is refused whole with the count and the limit (R49) */
  const wide = await xlsxEntry.text(book(sheet(`<row r="1"><c r="XFD1"><v>1</v></c><c><v>2</v></c></row>`)));
  assert(wide.ok);
  assert.equal(wide.document, null);
  assert.ok(wide.undetermined.some((u) => "why" in u && u.why === "over_size_bound" && "metric" in u && u.metric === "columns"
    && "size" in u && u.size === 16385 && "bound" in u && u.bound === 16384 && "final" in u && u.final === true));
});

test("R48 a workbook whose rows and cells carry no `r` reads exactly as its referenced copy does: the text, the cells and their sources, the used range and the sheet unit", async () => {
  /** @param {boolean} refs */
  const rows = (refs) => Array.from({ length: 60 }, (_, i) => `<row${refs ? ` r="${i + 1}"` : ""}>${["A", "B", "C"].map((col, j) =>
    `<c${refs ? ` r="${col}${i + 1}"` : ""}${j === 1 ? ' t="inlineStr"' : ""}>${j === 1 ? `<is><t>w${i}</t></is>` : `<v>${i * 3 + j}</v>`}</c>`).join("")}</row>`).join("");
  const bare = await xlsxEntry.text(book(sheet(rows(false))));
  const refd = await xlsxEntry.text(book(sheet(rows(true))));
  assert(bare.ok && refd.ok);
  assert.deepEqual(bare.sheets[0], refd.sheets[0]);
  assert.equal(bare.document, refd.document);
  const { scanned_bytes: _a, ...bareCounts } = bare.counts, { scanned_bytes: _b, ...refdCounts } = refd.counts;   /* the bytes scanned are the files' own */
  assert.deepEqual(bareCounts, refdCounts);
  assert.equal(bare.sheets[0]?.usedRows, 60);
  assert.equal(bare.sheets[0]?.range.range, "A1:C60");
});

test("R47 a styled empty cell does not extend the used range: only a cell holding a value or a formula reaches", async () => {
  const body = `<row r="1"><c r="A1"><v>1</v></c><c r="B1" s="2"/></row><row r="3" s="1"><c r="A3" s="1"/><c r="Z900000" s="3"/></row><row r="4"><c r="C4"><f>A1</f></c></row>`;
  const t = await xlsxEntry.text(book(sheet(body)));
  assert(t.ok);
  assert.equal(t.sheets[0]?.usedRows, 4);
  assert.equal(t.sheets[0]?.usedCols, 3);
  assert.equal(t.sheets[0]?.range.range, "A1:C4");
  const none = await xlsxEntry.text(book(sheet(`<row r="9"><c r="Q9" s="1"/></row>`)));
  assert(none.ok);
  assert.equal(none.sheets[0]?.usedRows, 0);
  assert.equal(none.sheets[0]?.range, null);
});

test("R47 mergeCells are read: the sheet states its merged ranges, and a covered cell that holds a value is stated covered (the top-left cell is not); a sheet with none states none", async () => {
  const body = `<row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c><c r="C1"><v>3</v></c></row><row r="2"><c r="A2"><v>4</v></c><c r="B2"><v>5</v></c></row>`;
  const merged = await xlsxEntry.text(book(sheet(body, `<mergeCells count="2"><mergeCell ref="A1:B2"/><mergeCell ref="D5:E5"/></mergeCells>`)));
  assert(merged.ok);
  const m0 = merged.sheets[0];
  assert(m0);
  assert.deepEqual(m0.merges, ["A1:B2", "D5:E5"]);
  assert.deepEqual(m0.undetermined.flatMap((u) => ("reason" in u && u.reason === "covered_by_merge"
    ? [["cell" in u ? u.cell : undefined, "range" in u ? u.range : undefined]] : [])),
    [["B1", "A1:B2"], ["A2", "A1:B2"], ["B2", "A1:B2"]]);
  assert.equal(m0.cells?.length, 5, "the cells are still all listed");
  const plain = await xlsxEntry.text(book(sheet(body)));
  assert(plain.ok);
  const p0 = plain.sheets[0];
  assert(p0);
  assert.ok(!("merges" in p0));
  assert.ok(!p0.undetermined.some((u) => "reason" in u && u.reason === "covered_by_merge"));
});
