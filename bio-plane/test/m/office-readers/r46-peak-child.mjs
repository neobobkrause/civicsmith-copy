/* A child process for r46-memory.test.mjs: reads a workbook from a file under the old-space limit its parent sets, and
   answers the most memory the read held above its idle (heap used plus array buffers, sampled every millisecond, as the
   shape harness samples them) with sizes of the answer only. Not a test. Run with --expose-gc.
     node --expose-gc --max-old-space-size=N r46-peak-child.mjs <file>  */
import { readFileSync } from "node:fs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

/**
 * What the child writes: the read's peak above idle, in MiB, and sizes of the answer.
 * @typedef {Object} R46Report
 * @property {number} aboveIdleMB
 * @property {true} ok
 * @property {number} documentLength
 * @property {boolean} sheetIsDocument
 * @property {number} lines
 * @property {boolean} piecewise
 * @message stdout
 */

/** @returns {number} */
const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
const file = process.argv[2];
if (file === undefined) throw new TypeError('The "path" argument must be of type string or an instance of Buffer or URL. Received undefined');
const bytes = new Uint8Array(readFileSync(file));
gc(); gc();
const idle = used();
let peak = idle;
const timer = setInterval(() => { const u = used(); if (u > peak) peak = u; }, 1);
const parts = await xlsxEntry.parts(bytes);
const t = await xlsxEntry.text(parts, { inlineCellsMax: 512 * 1024 });
clearInterval(timer);
if (!t.ok) throw new TypeError("Cannot read properties of undefined (reading '0')");
const s = t.sheets[0];
const document = t.document;
if (document === null) throw new TypeError("Cannot read properties of null (reading 'length')");
if (s === undefined) throw new TypeError("Cannot read properties of undefined (reading 'text')");
const lineRows = s.lineRows;
if (lineRows === undefined) throw new TypeError("Cannot read properties of undefined (reading 'length')");
/** @type {R46Report} */
const report = { aboveIdleMB: (peak - idle) / 1048576, ok: t.ok, documentLength: document.length,
  sheetIsDocument: s.text === document, lines: lineRows.length, piecewise: !!t.piecewise };
process.stdout.write(JSON.stringify(report));
