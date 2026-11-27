/* A worker thread for large-text.test.mjs: reads a body under the old-space limit its parent sets and
   answers only sizes, so the parent never holds the text a second time. Not a test. */
import { parentPort, workerData } from "node:worker_threads";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
/** @import { WorkerAnswer } from "./large.mjs" */

/** @type {unknown} this module's own channel: the parent sends a WorkerAsk */
const ask = workerData;
const sent = typeof ask === "object" && ask !== null && "bytes" in ask ? ask.bytes : null;
const bytes = sent instanceof Uint8Array ? sent : null;
if (bytes === null) throw new TypeError("large-worker: workerData.bytes is not a Uint8Array");
const t = await csvEntry.text(new Uint8Array(bytes));
const port = parentPort;
if (port === null) throw new TypeError("large-worker: not started as a worker");
/** @type {WorkerAnswer} */
const answer = t.ok
  ? { ok: t.ok, documentLength: t.document == null ? null : t.document.length,
    sheetCells: t.sheets[0]?.cells ?? null, undetermined: t.undetermined.length }
  : { ok: t.ok, documentLength: null, sheetCells: null, undetermined: 0 };
port.postMessage(answer);
