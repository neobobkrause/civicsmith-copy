/* A child process for r47-docx-memory.test.mjs: reads a docx from a file and answers the most memory the read held above its
   start (heap used plus external memory, which holds the array buffers and the large strings; sampled every millisecond, as the
   shape harness samples them), with the shape of the answer only. "Start" is the memory with the file's bytes in hand, before `parts()`: the
   plane's own state beside the read, which `capFor` leaves out of the cap; the peak covers `parts()` and `text()` both. With `--idle` it answers only that heap figure, so
   the parent can set the old space to the idle heap plus `capFor(128)`. Not a test. Run with --expose-gc.
     node --expose-gc [--max-old-space-size=N] r47-peak-child.mjs <file> [--idle|--read] [docx|pptx]  */
/** @import { DocxPartsResult, DocxText, ReadFailure, ReadOptions } from "../../../src/docx.mjs" */
/** @import { PptxPartsResult, PptxText, PptxUndetermined } from "../../../src/pptx.mjs" */
import { readFileSync } from "node:fs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";

/**
 * What the child writes with `--idle`: its heap with the file's bytes in hand, in MiB.
 * @typedef {Object} R47Idle
 * @property {number} idleHeapMB
 * @message stdout
 */
/**
 * What the child writes with `--read`: the read's peak above its start, in MiB, the shape of the answer and the
 * statement of the bound passed, or null.
 * @typedef {Object} R47Report
 * @property {number} aboveStartMB
 * @property {true} ok
 * @property {number | null} documentLength
 * @property {number} paragraphs
 * @property {PptxUndetermined | null} refusal
 * @message stdout
 */

/** @type {boolean} */
const isPptx = process.argv[4] === "pptx";

/** @returns {number} */
const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.external; };
const file = process.argv[2];
if (file === undefined) throw new TypeError('The "path" argument must be of type string or an instance of Buffer or URL. Received undefined');
const bytes = new Uint8Array(readFileSync(file));
gc(); gc();
const idle = used();
if (process.argv[3] === "--idle") {
  /** @type {R47Idle} */
  const idleReport = { idleHeapMB: process.memoryUsage().heapUsed / 1048576 };
  process.stdout.write(JSON.stringify(idleReport)); process.exit(0);
}
/* Sampled after a collection at every yield (and after `parts()`): what the read holds LIVE, not what a collector has yet to
   free; a read that needs more than the old space its parent sets does not end (the parent sees it). */
let peak = idle;
const sample = () => { gc(); const u = used(); if (u > peak) peak = u; };
/** @type {{pptx: true, parts: PptxPartsResult} | {pptx: false, parts: DocxPartsResult}} */
const held = isPptx ? { pptx: true, parts: await pptxEntry.parts(bytes) } : { pptx: false, parts: await docxEntry.parts(bytes) };
sample();
/** @returns {Promise<void>} */
const yieldNow = async () => {
  sample();
  /** @type {Promise<void>} */
  const turn = new Promise((r) => setImmediate(r));
  await turn;
};
/** @type {ReadOptions} */
const options = { inlineCellsMax: 512 * 1024, yieldNow };
/** @type {DocxText | PptxText | ReadFailure} */
const t = held.pptx ? await pptxEntry.text(held.parts, options) : await docxEntry.text(held.parts, options);
sample();
if (!t.ok) throw new TypeError("Cannot read properties of undefined (reading 'find')");
/** @type {ReadonlyArray<PptxUndetermined>} */
const stated = t.undetermined;
const refusal = stated.find((u) => u.why === "TOO_MANY_OBJECTS") ?? null;
const document = t.document;
/** @type {R47Report} */
const report = { aboveStartMB: (peak - idle) / 1048576, ok: t.ok,
  documentLength: document == null ? null : document.length, paragraphs: ("paragraphs" in t ? t.paragraphs : t.slides).length, refusal };
process.stdout.write(JSON.stringify(report));
