/* Fixtures for the csv-reader suite: the byte encoder the tests build bodies with, the bounds the suite resolves from
 * runtime-limits' table (never a literal of its own), and the typed helpers that take an answer to the kind a test reads,
 * failing the test where the answer is another. */
import assert from "node:assert/strict";
import { boundOf } from "../../../src/read-bounds.mjs";
/** @import { TextResult, TextDone, TextOverBound, StructureResult, StructureDone, PartsResult, CsvParts, PartsRefusal, CellsResult, CellsDone, TextSheet, TypedCell } from "../../../src/csv-reader/index.mjs" */

/** Text as its UTF-8 bytes; bytes are handed back as they are.
 *  @param {string | Uint8Array} s @returns {Uint8Array} */
export const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);
/** The `csv` bytes bound (50 MB, the standard's figure for a light kind), the `csv` rows bound, the `sheet` column bound.
 *  @type {number} */
export const BYTES_BOUND = boundOf("csv", "bytes");
/** @type {number} */
export const ROWS_BOUND = boundOf("csv", "rows");
/** @type {number} */
export const COLUMNS_BOUND = boundOf("sheet", "columns");
/** @type {number} */
export const CELL_CHARS = boundOf("sheet", "cell_chars");
/** @type {number} */
export const CELL_KEPT = boundOf("sheet", "cell_kept_chars");
/** A body one byte over the bytes bound: one long ASCII line (a guard test reads nothing but its head).
 *  @returns {Uint8Array} */
export const overBytes = () => new Uint8Array(BYTES_BOUND + 1).fill(0x61);

/** `text()`'s answer for a body read or over a bound; a refusal fails the test.
 *  @param {TextResult} r @returns {TextDone | TextOverBound} */
export function textAnswered(r) {
  if (!r.ok) assert.fail(`text() refused: ${r.reason}`);
  return r;
}

/** `text()`'s answer for a body read; a refusal or a body over a bound fails the test.
 *  @param {TextResult} r @returns {TextDone} */
export function textRead(r) {
  const answered = textAnswered(r);
  if (answered.document === null) assert.fail("text() found the body over a bound");
  return answered;
}

/** `text()`'s answer for a body over a bound; a refusal or a body read fails the test.
 *  @param {TextResult} r @returns {TextOverBound} */
export function textOver(r) {
  const answered = textAnswered(r);
  if (answered.document !== null) assert.fail("text() read the body: it is not over a bound");
  return answered;
}

/** `structure()`'s answer when parts did not fail; a refusal fails the test.
 *  @param {StructureResult} r @returns {StructureDone} */
export function structureDone(r) {
  if (!r.ok) assert.fail(`structure() refused: ${r.reason}`);
  return r;
}

/** `parts()`'s answer for a body it could take apart; a refusal fails the test.
 *  @param {PartsResult} r @returns {CsvParts} */
export function partsRead(r) {
  if (!r.ok) assert.fail(`parts() refused: ${r.why}`);
  return r;
}

/** `parts()`'s refusal; parts taken fail the test.
 *  @param {PartsResult} r @returns {PartsRefusal} */
export function partsRefused(r) {
  if (r.ok) assert.fail("parts() took the body apart: it did not refuse");
  return r;
}

/** `cellsIn()`'s answer with cells; a refusal or a size marker fails the test.
 *  @param {CellsResult} r @returns {CellsDone} */
export function cellsDone(r) {
  if (!r.ok) assert.fail(`cellsIn() gave no cells: ${r.why}`);
  return r;
}

/** The item at `i` (a negative `i` counts from the end); a missing one fails the test.
 *  @template T
 *  @param {readonly T[]} list @param {number} i @returns {T} */
export function item(list, i) {
  const v = list.at(i);
  if (v === undefined) assert.fail(`no item at ${i} of ${list.length}`);
  return v;
}

/** A value that is there; null or undefined fails the test.
 *  @template T
 *  @param {T | null | undefined} v @param {string} what @returns {T} */
export function known(v, what) {
  if (v === null || v === undefined) assert.fail(`${what}: absent`);
  return v;
}

/** A sheet's listed cells; a sheet whose cells are held fails the test.
 *  @param {TextSheet} sheet @returns {TypedCell[]} */
export function cellsOf(sheet) {
  return known(sheet.cells, `sheet ${sheet.sheet}'s cells`);
}

/** The listed cell at `cell` (as "B2"); a cell not listed fails the test.
 *  @param {TextSheet} sheet @param {string} cell @returns {TypedCell} */
export function cellAt(sheet, cell) {
  return known(cellsOf(sheet).find((c) => c.source.cell === cell), `cell ${cell}`);
}
