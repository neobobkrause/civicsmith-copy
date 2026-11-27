/* G15 (fix round 6): every sheet's `lineRows`, at the interface (R11, R30). */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
/** @type {(rows: string) => string} */
const sheetXml = (rows) => `<?xml version="1.0"?><worksheet ${NS}><sheetData>${rows}</sheetData></worksheet>`;

test("R11 lineRows: one 1-based row number per line of sheet.text, empty and skipped rows leaving gaps, in the order of the lines", async () => {
  /* Row 2 has no cell, row 3 only an empty string, row 4 a styled empty cell:
     none gives a line, so the line index is not the row. Row 9 and row 6 are
     written out of order; text is in file order and so are the row numbers. */
  const xml = sheetXml(
    `<row r="1"><c r="A1" t="inlineStr"><is><t>head</t></is></c><c r="B1" t="inlineStr"><is><t>h2</t></is></c></row>`
    + `<row r="2"/>`
    + `<row r="3"><c r="A3" t="inlineStr"><is><t></t></is></c></row>`
    + `<row r="4"><c r="A4" s="2"/></row>`
    + `<row r="5"><c r="A5"><v>5</v></c></row>`
    + `<row r="9"><c r="A9"><v>9</v></c></row>`
    + `<row r="6"><c r="B6"><v>6</v></c></row>`
    + `<row><c r="A7"><v>next</v></c></row>`);
  const t = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", xml }, { name: "E", data: {} }] }));
  if (!t.ok) assert.fail(`the workbook is refused: ${t.reason}`);
  const [s, empty] = t.sheets;
  if (s === undefined || empty === undefined) assert.fail("the workbook has its two sheets");
  const { text, lineRows } = s;
  assert.equal(text, "head\th2\n5\n9\n6\nnext");
  assert.deepEqual(lineRows, [1, 5, 9, 6, 7]);
  assert.equal(lineRows.length, text.split("\n").length);
  assert.deepEqual(empty.lineRows, []);
});
