/* A child process for g41-held.test.mjs: reads a package from a file under the old-space limit its parent sets, and
   answers sizes and a few cells only. Not a test. Run with --expose-gc and --max-old-space-size.
     node --expose-gc --max-old-space-size=N g41-peak.mjs <file> text|cellsIn <fromRow> <toRow>  */
/** @import { TypedCell } from "../../../src/formats-xlsx.mjs" */
import { readFileSync } from "node:fs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

/**
 * The `text` job's answer: sizes of the read, its first sheet's cells or null.
 * @typedef {Object} G41TextAnswer
 * @property {true} ok
 * @property {number} documentLength
 * @property {number} lines
 * @property {number} lineRows
 * @property {TypedCell[] | null} cells
 * @property {true | null} cells_held
 * @property {number | null} usedRows
 * @property {unknown} piecewise
 */
/**
 * The `cellsIn` job's answer; a refusal carries `ok` alone.
 * @typedef {{ok: true, cells: TypedCell[], rows: {from: number, to: number}, next_row: number | undefined} | {ok: false}} G41CellsAnswer
 */
/**
 * What the child writes: its heap at idle and at the end, in MB, and the job's answer.
 * @typedef {Object} G41Report
 * @property {number} idleMB
 * @property {number} endMB
 * @property {G41TextAnswer | G41CellsAnswer} answer
 * @message stdout
 */
/**
 * What the child writes for the `text` job.
 * @typedef {Object} G41TextReport
 * @property {number} idleMB
 * @property {number} endMB
 * @property {G41TextAnswer} answer
 */
/**
 * What the child writes for the `cellsIn` job.
 * @typedef {Object} G41CellsReport
 * @property {number} idleMB
 * @property {number} endMB
 * @property {G41CellsAnswer} answer
 */

const [file, job, fromRow, toRow] = process.argv.slice(2);
if (file === undefined) throw new TypeError('The "path" argument must be of type string or an instance of Buffer or URL. Received undefined');
const bytes = new Uint8Array(readFileSync(file));
gc(); gc();
/** @type {number} */
const idleMB = process.memoryUsage().heapUsed / 1e6;
/** @type {G41TextAnswer | G41CellsAnswer} */
let answer;
if (job === "text") {
  const t = await xlsxEntry.text(bytes, { inlineCellsMax: 512 * 1024 });
  if (!t.ok) throw new TypeError("Cannot read properties of undefined (reading '0')");
  const s = t.sheets[0];
  const document = t.document;
  if (document === null) throw new TypeError("Cannot read properties of null (reading 'length')");
  if (s === undefined) throw new TypeError("Cannot read properties of undefined (reading 'text')");
  const lineRows = s.lineRows;
  if (lineRows === undefined) throw new TypeError("Cannot read properties of undefined (reading 'length')");
  answer = { ok: t.ok, documentLength: document.length, lines: s.text.split("\n").length, lineRows: lineRows.length,
    cells: s.cells, cells_held: s.cells_held ?? null, usedRows: s.usedRows, piecewise: t.piecewise ?? null };
} else {
  const r = await xlsxEntry.cellsIn(bytes, { sheet: "Big", fromRow: Number(fromRow), toRow: Number(toRow) });
  answer = r.ok ? { ok: r.ok, cells: r.cells, rows: r.rows, next_row: r.next_row } : { ok: r.ok };
}
/** @type {G41Report} */
const report = { idleMB, endMB: process.memoryUsage().heapUsed / 1e6, answer };
process.stdout.write(JSON.stringify(report));
