/* A worker thread for large-text.test.mjs: reads a package under the old-space limit its parent sets and
   answers only sizes, so the parent never holds the text a second time. Not a test. */
/** @import { TypedCell } from "../../../src/formats-xlsx.mjs" */
import { parentPort, workerData } from "node:worker_threads";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";

/**
 * What the parent hands the worker: the format to read and the package's bytes.
 * @typedef {Object} LargeJob
 * @property {"xlsx" | "docx" | "pptx"} job
 * @property {Uint8Array} bytes
 */
/**
 * What the worker answers: sizes of the read only.
 * @typedef {Object} LargeAnswer
 * @property {true} ok
 * @property {number | null} documentLength
 * @property {TypedCell[] | null} sheetCells
 * @property {number} undetermined
 */

/** @type {LargeJob} */
const { job, bytes } = workerData;
const entry = { xlsx: xlsxEntry, docx: docxEntry, pptx: pptxEntry }[job];
const t = await entry.text(new Uint8Array(bytes));
const port = parentPort;
if (port === null) throw new TypeError("Cannot read properties of null (reading 'postMessage')");
if (!t.ok) throw new TypeError("Cannot read properties of undefined (reading 'length')");
const document = t.document;
/** @type {LargeAnswer} */
const answer = { ok: t.ok, documentLength: document == null ? null : document.length,
  sheetCells: ("sheets" in t ? t.sheets[0]?.cells : undefined) ?? null, undetermined: t.undetermined.length };
port.postMessage(answer);
