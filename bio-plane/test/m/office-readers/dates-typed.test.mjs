/* office-readers, R30 (fix round 9, G134c; S-11): a date cell is typed from the number format, the stored serial kept beside;
 * R37 (G131e): a point read works from access points. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
/** @import {TypedCell} from "../../../src/formats-xlsx.mjs" */

const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** @typedef {{[id: string]: string}} NumFmts custom number formats, by id */
/** @param {NumFmts | undefined} formats @param {number[]} xfs */
const styles = (formats = {}, xfs) => `<?xml version="1.0"?><styleSheet ${S}>`
  + (Object.keys(formats).length ? `<numFmts count="${Object.keys(formats).length}">${Object.entries(formats).map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${code}"/>`).join("")}</numFmts>` : "")
  + `<cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.map((id) => `<xf numFmtId="${id}"/>`).join("")}</cellXfs></styleSheet>`;
/** @param {string} cells */
const sheet = (cells) => `<worksheet ${S}><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;
/**
 * One sheet "S" of one row, with a styles part: `formats` the custom number formats, `xfs` each cell style's format.
 * @typedef {Object} BookOptions
 * @property {string} cells
 * @property {NumFmts} [formats]
 * @property {number[]} xfs
 * @property {boolean} [date1904]
 */
/** @param {TypedCell} c @returns {[string, TypedCell]} */
const byCell = (c) => [c.source.cell, c];
/** @param {BookOptions} o */
const book = ({ cells, formats, xfs, date1904 = false }) => F.xlsx({
  workbook: `<?xml version="1.0"?><workbook ${S}>${date1904 ? '<workbookPr date1904="1"/>' : ""}<sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  sheets: [{ name: "S", xml: sheet(cells) }],
  extra: [{ name: "xl/styles.xml", data: styles(formats, xfs) }],
});

test("R30 a number whose format is a date or date-time is typed date: ISO value, the stored serial beside, declared unchanged; text and document show the ISO date", async () => {
  /* xf 0 General, 1 built-in 14, 2 custom yyyy-mm-dd, 3 custom date-time, 4 built-in time-only 21, 5 custom time-only, 6 plain number */
  const bytes = book({
    formats: { 164: "yyyy\\-mm\\-dd", 165: "d/m/yy\\ h:mm", 166: "[h]:mm:ss", 167: "0.00" },
    xfs: [0, 14, 164, 165, 21, 166, 167],
    cells: `<c r="A1" s="1"><v>45413</v></c><c r="B1" s="2"><v>45413</v></c><c r="C1" s="3"><v>45413.5</v></c><c r="D1" s="4"><v>0.5</v></c><c r="E1" s="5"><v>1.25</v></c><c r="F1" s="6"><v>45413</v></c><c r="G1"><v>45413</v></c><c r="H1" s="1" t="d"><v>2024-05-01T00:00:00Z</v></c><c r="I1" s="1" t="s"><v>0</v></c>`,
  });
  const t = await xlsxEntry.text(bytes);
  assert(t.ok);
  const s0 = t.sheets[0];
  assert(s0);
  const s0cells = s0.cells;
  assert(s0cells);
  const cells = Object.fromEntries(s0cells.map(byCell));
  const { A1, B1, C1, D1, F1, H1 } = cells;
  assert(A1 && B1 && C1 && D1 && F1 && H1);
  assert.deepEqual([A1.type, A1.value, A1.serial, A1.declared], ["date", "2024-05-01", "45413", null]);
  assert.deepEqual([B1.type, B1.value, B1.serial], ["date", "2024-05-01", "45413"]);
  assert.deepEqual([C1.type, C1.value, C1.serial], ["date", "2024-05-01T12:00:00", "45413.5"]);
  for (const k of ["D1", "E1", "F1", "G1"]) {
    const ck = cells[k];
    assert(ck);
    assert.equal(ck.type, "number", `${k}: a time-only or plain number stays a number`);
    assert.ok(!("serial" in ck), `${k}: no serial key`);
  }
  assert.equal(D1.value, "0.5");
  assert.equal(F1.value, "45413");
  assert.deepEqual([H1.type, H1.value, "serial" in H1], ["date", "2024-05-01T00:00:00Z", false], "a t=d cell is already ISO and has no serial");
  assert.equal(s0.text.split("\t")[0], "2024-05-01");
  const doc = t.document;
  assert(doc);
  assert.ok(doc.includes("2024-05-01"), "2024-05-01 is found in an XLSX as it is in a CSV");
  assert.ok(doc.includes("2024-05-01T12:00:00"));
});

test("R30 the workbook's own date system: 1904 serials, and numbers outside the dates the system can express stay numbers", async () => {
  const b1904 = await xlsxEntry.text(book({ date1904: true, xfs: [14], cells: `<c r="A1" s="0"><v>0</v></c><c r="B1" s="0"><v>44</v></c>` }));
  assert(b1904.ok);
  const b0 = b1904.sheets[0];
  assert(b0);
  const b0cells = b0.cells;
  assert(b0cells);
  const c = Object.fromEntries(b0cells.map(byCell));
  assert.equal(c.A1?.value, "1904-01-01");
  assert.equal(c.B1?.value, "1904-02-14");
  const odd = await xlsxEntry.text(book({ xfs: [14], cells: `<c r="A1" s="0"><v>0</v></c><c r="B1" s="0"><v>60</v></c><c r="C1" s="0"><v>-5</v></c><c r="D1" s="0"><v>99999999</v></c><c r="E1" s="0"><v>1</v></c><c r="F1" s="0"><v>59</v></c><c r="G1" s="0"><v>61</v></c>` }));
  assert(odd.ok);
  const odd0 = odd.sheets[0];
  assert(odd0);
  const odd0cells = odd0.cells;
  assert(odd0cells);
  const o = Object.fromEntries(odd0cells.map(byCell));
  for (const k of ["A1", "B1", "C1", "D1"]) assert.equal(o[k]?.type, "number", k);
  assert.equal(o.E1?.value, "1900-01-01");
  assert.equal(o.F1?.value, "1900-02-28");
  assert.equal(o.G1?.value, "1900-03-01");
});

test("R30 a styles part that cannot be read leaves numbers numbers and is stated; cellsIn types dates as text() does", async () => {
  const bad = F.xlsx({ sheets: [{ name: "S", xml: sheet(`<c r="A1" s="1"><v>45413</v></c>`) }], extra: [{ name: "xl/styles.xml", data: "<styleSheet>&#x110000;</styleSheet>" }] });
  const t = await xlsxEntry.text(bad);
  assert(t.ok);
  assert.equal(t.sheets[0]?.cells?.[0]?.type, "number");
  assert.ok(t.undetermined.some((u) => "part" in u && u.part === "xl/styles.xml" && "why" in u && u.why === "char_ref_invalid"));
  const ok = book({ xfs: [14], cells: `<c r="A1" s="0"><v>45413</v></c>` });
  const r = await xlsxEntry.cellsIn(ok, { sheet: "S" });
  assert(r.ok);
  const r0 = r.cells[0];
  assert(r0);
  assert.deepEqual([r0.type, r0.value, r0.serial], ["date", "2024-05-01", "45413"]);
});

/* ------------------------------------------------------------------ R37 */

/** @param {number} rows */
const bigSheet = (rows) => {
  let xml = "";
  for (let r = 1; r <= rows; r++) xml += `<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>row number ${r} with some padding text</t></is></c><c r="B${r}"><v>${r}</v></c></row>`;
  return `<worksheet ${S}><sheetData>${xml}</sheetData></worksheet>`;
};

test("R37 a point read parses the blocks that hold the rows asked for, not the sheet: the bytes served are bounded by the rows and a block, whatever the row's offset", async () => {
  const xml = bigSheet(80000); // about 8 MB of text
  const bytes = F.xlsx({ sheets: [{ name: "S", xml }] });
  const parts = await xlsxEntry.parts(bytes);
  assert(parts.ok);
  /* the read that walks the sheet (the caller's cap) leaves the access points */
  await xlsxEntry.text(parts, { inlineCellsMax: 512 * 1024 });
  const part0 = parts.sheets[0]?.part;
  assert(part0 != null);
  const access0 = parts.access.get(part0);
  assert(access0);
  assert.ok(access0.blocks.length >= 6, "the read left several blocks");
  const far = await xlsxEntry.cellsIn(parts, { sheet: "S", fromRow: 79990, toRow: 80000 });
  assert.equal(far.ok, true);
  assert(far.ok);
  assert.equal(far.cells.length, 22);
  assert.equal(far.cells[0]?.source.cell, "A79990");
  assert.equal(far.cells[0]?.value, "row number 79990 with some padding text");
  assert.ok(far.served.bytes <= 2 * (1 << 20) + 4096, `served ${far.served.bytes}`);
  assert.ok(far.served.bytes < xml.length / 3);
  const near = await xlsxEntry.cellsIn(parts, { sheet: "S", fromRow: 1, toRow: 10 });
  assert(near.ok);
  assert.equal(near.cells.length, 20);
  assert.ok(near.served.bytes <= 2 * (1 << 20) + 4096);
  /* equal to what the whole read lists for them */
  const whole = await xlsxEntry.text(bytes);
  assert(whole.ok);
  const wholeCells = whole.sheets[0]?.cells;
  assert(wholeCells);
  assert.deepEqual(far.cells, wholeCells.slice(-22));
  assert.deepEqual(near.cells, wholeCells.slice(0, 20));
  /* a read that left no points leaves them on its first point read, and the next call serves the same bounded bytes */
  const fresh = await xlsxEntry.parts(bytes);
  const first = await xlsxEntry.cellsIn(fresh, { sheet: "S", fromRow: 40000, toRow: 40002 });
  const second = await xlsxEntry.cellsIn(fresh, { sheet: "S", fromRow: 70000, toRow: 70002 });
  assert(first.ok && second.ok);
  assert.ok(first.served.bytes <= 2 * (1 << 20) + 4096 && second.served.bytes <= 2 * (1 << 20) + 4096);
  assert.deepEqual(first.cells.map((c) => c.value), wholeCells.slice(39999 * 2, 40002 * 2).map((c) => c.value));
});

test("R37 maxCells across blocks: whole rows, next_row, and the rows of an out-of-order or row-number-less sheet are the whole read's", async () => {
  const xml = bigSheet(40000);
  const parts = await xlsxEntry.parts(F.xlsx({ sheets: [{ name: "S", xml }] }));
  await xlsxEntry.text(parts, { inlineCellsMax: 1 });
  const a = await xlsxEntry.cellsIn(parts, { sheet: "S", fromRow: 19998, maxCells: 6 });
  assert(a.ok);
  assert.equal(a.cells.length, 6);
  const nextRow = a.next_row;
  assert.equal(nextRow, 20001);
  assert.equal(a.rows.to, 20000);
  const rest = await xlsxEntry.cellsIn(parts, { sheet: "S", fromRow: nextRow, toRow: 20002 });
  assert(rest.ok);
  assert.deepEqual(rest.cells.map((c) => c.source.cell), ["A20001", "B20001", "A20002", "B20002"]);
  const last = await xlsxEntry.cellsIn(parts, { sheet: "S", fromRow: 39999 });
  assert(last.ok);
  assert.equal(last.next_row, undefined);
  assert.equal(last.rows.to, 40000);
});
