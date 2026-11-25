/* A child process for r47-docx-memory.test.mjs: reads a docx from a file and answers the most memory the read held above its
   start (heap used plus external memory, which holds the array buffers and the large strings; sampled every millisecond, as the
   shape harness samples them), with the shape of the answer only. "Start" is the memory with the file's bytes in hand, before `parts()`: the
   plane's own state beside the read, which `capFor` leaves out of the cap; the peak covers `parts()` and `text()` both. With `--idle` it answers only that heap figure, so
   the parent can set the old space to the idle heap plus `capFor(128)`. Not a test. Run with --expose-gc.
     node --expose-gc [--max-old-space-size=N] r47-peak-child.mjs <file> [--idle|--read] [docx|pptx]  */
import { readFileSync } from "node:fs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";

const entry = process.argv[4] === "pptx" ? pptxEntry : docxEntry;

const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.external; };
const bytes = new Uint8Array(readFileSync(process.argv[2]));
gc(); gc();
const idle = used();
if (process.argv[3] === "--idle") { process.stdout.write(JSON.stringify({ idleHeapMB: process.memoryUsage().heapUsed / 1048576 })); process.exit(0); }
/* Sampled after a collection at every yield (and after `parts()`): what the read holds LIVE, not what a collector has yet to
   free; a read that needs more than the old space its parent sets does not end (the parent sees it). */
let peak = idle;
const sample = () => { gc(); const u = used(); if (u > peak) peak = u; };
const parts = await entry.parts(bytes);
sample();
const yieldNow = async () => { sample(); await new Promise((r) => setImmediate(r)); };
const t = await entry.text(parts, { inlineCellsMax: 512 * 1024, yieldNow });
sample();
const refusal = t.undetermined.find((u) => u.why === "TOO_MANY_OBJECTS") ?? null;
process.stdout.write(JSON.stringify({ aboveStartMB: (peak - idle) / 1048576, ok: t.ok,
  documentLength: t.document == null ? null : t.document.length, paragraphs: (t.paragraphs ?? t.slides).length, refusal }));
