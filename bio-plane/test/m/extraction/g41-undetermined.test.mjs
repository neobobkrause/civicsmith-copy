/* extraction R98 (fix round 6, G41 follow-up; K4664, K4669, K4670): A HELD SHEET WHOSE CAPTURE FORMAT IS `undetermined` HAS ITS CELLS MADE. The walker's shape is a CSV
   (or a workbook) stored `undetermined` (an upload over one 8 MiB part, or a capture made before its type was profiled): the reading itself was made by the entry the pipeline chose from the
   bytes (R73) and names `cells_held`, but `cellsOf` passed `readings.capture_format` on, `reading-pipeline.cellsInRange` has no entry for `undetermined`, and the answer was
   `cells_not_interpretable`. The format is now taken from the reading's own `text_container` when the registry has an entry for it with a `cellsIn` slot, else detected again
   from the held head (R73's detection); never guessed. The two sources are told apart: the CSV's bytes detect nothing, so only the container can make its cells; the workbook's
   container is set to one without the slot, so only detection can. Run through the module's real entry, `readHeld` then `cellsOf`. Each test names the requirement id it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, homesOver } from "./fixture.mjs";
import * as F from "../office-readers/fixtures.mjs";
import { getFormat, detectFormat } from "../../../src/formats.mjs";

const XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const register = (rows) => homesOver(rows);
const COLS = "ABCDEFGHIJ";
const cellOf = (sheet, row, col, value) => ({ source: { kind: "sheet-cell", ref: `${sheet}!${COLS[col]}${row}`, sheet, cell: `${COLS[col]}${row}` }, value, type: "text", declared: null, cached: null, formula: null });

function csvRows(bytes) {
  const rows = [["id", "name", "amount", "note"]];
  for (let n = 20, i = 0; n < bytes; i++) { const r = [String(i), `name ${i}`, `${(i * 37) % 9973}.${i % 100}`, `council note ${i} budget line`]; rows.push(r); n += r.join(",").length + 8; }
  rows.push(["LASTROWMARK", "last name", "1.00", "the final row of the sheet"]);
  return rows;
}
const csvText = (rows) => rows.map((r) => r.map((v, c) => (c === 1 || c === 3 ? `"${v}"` : v)).join(",")).join("\n") + "\n";
const xlsxRows = 5000;
const xlsxBytes = () => F.xlsx({ sheets: [{ name: "Budget", data: { rows: Array.from({ length: xlsxRows }, (_, i) => ({ r: i + 1,
  cells: ["A", "B", "C", "D"].map((c, k) => ({ r: `${c}${i + 1}`, t: "inlineStr", is: i === xlsxRows - 1 && k === 0 ? "LASTROWMARK" : `value ${i} ${k}` })) })) } }] });

/* a held home whose capture was profiled `undetermined`, as an upload over one part is stored (g40.test.mjs reads the 1 MB CSV so) */
async function home(bytes, { ct, name = "t" } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const u8 = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const d = sha(u8);
  rows.set(d, { bundleId: "INFO-1", path: name, encoding: "binary", bytes: u8.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, u8);
  const document = doc({ digest: d, bytes: u8.length, ct, format: "undetermined", fromText: typeof bytes === "string" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, bytes: u8 };
}
/* the document as the bundle states it, served again with a declared type that names no format, so detection over the held head has nothing to go by */
const serveAs = (w, d, bytes, ct) => {
  const document = doc({ digest: d, bytes: bytes.length, ct, format: "undetermined" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
};
const readAll = async (w, d) => { let a, n = 0; do { a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); } while (a.more && ++n < 200); return a; };
const readingOf = (w, d) => JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
const setContainer = (w, d, container) => w.s.sql.exec(`UPDATE readings SET reading=json_set(reading, '$.text_container', ?) WHERE capture_sha=?`, container, d);
const setFormat = (w, d, format) => w.s.sql.exec(`UPDATE readings SET capture_format=? WHERE capture_sha=?`, format, d);
const lastCells = (rows) => { const r = rows.length, out = []; for (let k = r - 1; k <= r; k++) rows[k - 1].forEach((v, c) => out.push(cellOf("csv", k, c, v))); return out; };

test("R98 (G41 follow-up): a 1 MB CSV stored `undetermined` has its last rows' cells made from the reading's own container: the bytes detect no format, so only the container can have named it", async () => {
  const rows = csvRows(1_048_576);
  const { w, d, bytes } = await home(csvText(rows), { ct: "text/csv" });
  await readAll(w, d);
  /* what is true before the call: stored undetermined, a held sheet, a container the registry has an entry with the slot for, and bytes that detect no such format */
  assert.equal(w.one(`SELECT capture_format FROM readings WHERE capture_sha=?`, d).capture_format, "undetermined");
  const stored = readingOf(w, d);
  assert.deepEqual(stored.cells_held, ["csv"]);
  assert.equal(stored.text_container, "csv");
  assert.equal(typeof getFormat("csv").cellsIn, "function");
  serveAs(w, d, bytes, "application/octet-stream");
  assert.equal(detectFormat(bytes.subarray(0, 1024), "application/octet-stream").format, "undetermined", "the held head and the declared type name no format: detection cannot have made these cells");
  const got = await w.x.cellsOf(d, "csv", { fromRow: rows.length - 1, toRow: rows.length });
  assert.equal(got.reason, undefined, JSON.stringify(got.why));
  assert.deepEqual(got.cells, lastCells(rows));
  assert.deepEqual(got.interpreted, { sheet: "csv", from_row: rows.length - 1, to_row: rows.length });
  assert.equal(got.next_row, null);
});

test("R98 (G41 follow-up): a workbook stored `undetermined` whose container names no format with the slot has its cells made by detecting the format again from the held head: only detection can have named it", async () => {
  const bytes = xlsxBytes();
  const { w, d } = await home(bytes, { ct: XLSX_CT });
  await readAll(w, d);
  assert.deepEqual(readingOf(w, d).cells_held, ["Budget"]);
  /* the container is one the registry has no cell-making entry for, so the container cannot name the format */
  setContainer(w, d, "text");
  assert.ok(!getFormat("text") || typeof getFormat("text").cellsIn !== "function");
  assert.equal(w.one(`SELECT capture_format FROM readings WHERE capture_sha=?`, d).capture_format, "undetermined");
  /* a workbook is recognised by its central directory, which a first KiB does not hold: the declared type names it, as the pipeline's own detection does */
  assert.equal(detectFormat(bytes.subarray(0, 1024), null).format, "undetermined");
  assert.equal(detectFormat(bytes.subarray(0, 1024), XLSX_CT).format, "xlsx");
  const got = await w.x.cellsOf(d, "Budget", { fromRow: xlsxRows - 1, toRow: xlsxRows });
  assert.equal(got.reason, undefined, JSON.stringify(got.why));
  assert.equal(got.cells.length, 8);
  assert.deepEqual(got.cells.map((c) => c.source.cell), ["A4999", "B4999", "C4999", "D4999", "A5000", "B5000", "C5000", "D5000"]);
  assert.equal(got.cells[4].value, "LASTROWMARK");
  assert.deepEqual(got.interpreted, { sheet: "Budget", from_row: xlsxRows - 1, to_row: xlsxRows });
});

test("R98 (G41 follow-up): a capture format that is empty (null) is taken as `undetermined` is: the same workbook, the same cells", async () => {
  const { w, d } = await home(xlsxBytes(), { ct: XLSX_CT });
  await readAll(w, d);
  setContainer(w, d, "text");
  setFormat(w, d, null);
  const got = await w.x.cellsOf(d, "Budget", { fromRow: xlsxRows, toRow: xlsxRows, fromCol: 1, toCol: 1 });
  assert.equal(got.reason, undefined, JSON.stringify(got.why));
  assert.deepEqual(got.cells.map((c) => [c.source.cell, c.value]), [["A5000", "LASTROWMARK"]]);
});

test("R98 (G41 follow-up): the format is never guessed: a CSV stored `undetermined` whose container names no format with the slot, and whose bytes and declared type detect none, answers `cells_not_interpretable`", async () => {
  const rows = csvRows(1_048_576);
  const { w, d, bytes } = await home(csvText(rows), { ct: "text/csv" });
  await readAll(w, d);
  setContainer(w, d, "text");
  serveAs(w, d, bytes, "application/octet-stream");
  const got = await w.x.cellsOf(d, "csv", { fromRow: rows.length, toRow: rows.length });
  assert.deepEqual([got.cells, got.reason], [null, "cells_not_interpretable"]);
  assert.equal(typeof got.why, "string");
});

test("R98 (G41 follow-up, control): a capture format that is named is used as it is, whatever the container says: the cells are byte-identical to those of the same sheet stored `undetermined`", async () => {
  const rows = csvRows(1_048_576);
  const a = await home(csvText(rows), { ct: "text/csv" });
  await readAll(a.w, a.d);
  const b = await home(csvText(rows), { ct: "text/csv" });
  await readAll(b.w, b.d);
  setFormat(b.w, b.d, "csv");
  setContainer(b.w, b.d, "text");
  const ask = { fromRow: rows.length - 1, toRow: rows.length };
  const viaDetection = await a.w.x.cellsOf(a.d, "csv", ask);
  const named = await b.w.x.cellsOf(b.d, "csv", ask);
  assert.deepEqual(named, viaDetection);
  assert.deepEqual(JSON.stringify(named), JSON.stringify(viaDetection));
  /* a named format that has no slot is not replaced by the container's or by detection: it answers as it does */
  setFormat(b.w, b.d, "html");
  const refused = await b.w.x.cellsOf(b.d, "csv", ask);
  assert.deepEqual([refused.cells, refused.reason], [null, "cells_not_interpretable"]);
});
