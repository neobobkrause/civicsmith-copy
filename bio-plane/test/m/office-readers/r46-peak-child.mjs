/* A child process for r46-memory.test.mjs: reads a workbook from a file under the old-space limit its parent sets, and
   answers the most memory the read held above its idle (heap used plus array buffers, sampled every millisecond, as the
   shape harness samples them) with sizes of the answer only. Not a test. Run with --expose-gc.
     node --expose-gc --max-old-space-size=N r46-peak-child.mjs <file>  */
import { readFileSync } from "node:fs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
const bytes = new Uint8Array(readFileSync(process.argv[2]));
gc(); gc();
const idle = used();
let peak = idle;
const timer = setInterval(() => { const u = used(); if (u > peak) peak = u; }, 1);
const parts = await xlsxEntry.parts(bytes);
const t = await xlsxEntry.text(parts, { inlineCellsMax: 512 * 1024 });
clearInterval(timer);
const s = t.sheets[0];
process.stdout.write(JSON.stringify({ aboveIdleMB: (peak - idle) / 1048576, ok: t.ok, documentLength: t.document.length,
  sheetIsDocument: s.text === t.document, lines: s.lineRows.length, piecewise: !!t.piecewise }));
