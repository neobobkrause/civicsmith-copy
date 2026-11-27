/* A child process for g41-memory.test.mjs: holds a harness-shaped CSV of `bytes` bytes as one byte array outside the old
   space (as the object holds the file's bytes), reads it through the entry the way reading-pipeline does (`parts`, then
   `text` with an inline cap), keeps `parts` alive as the caller's scope does, and prints one JSON line with what the reader
   still held after a full GC. Not a test. Run: node --expose-gc --max-old-space-size=<MB> g41-memory-child.mjs <bytes> */
import { csvEntry } from "../../../src/csv-reader/index.mjs";

/** @param {unknown} f @returns {f is () => void} */
const isThunk = (f) => typeof f === "function";
/* the collector --expose-gc puts on the global object, which no other route reaches */
const host = globalThis;
/** @type {unknown} */
const exposed = "gc" in host ? host.gc : undefined;
if (!isThunk(exposed)) throw new TypeError("run with --expose-gc");
const gc = exposed;
/** The bytes the heap's live objects take. @returns {number} */
const heapUsed = () => process.memoryUsage().heapUsed;

const total = Number(process.argv[2]);
const body = new Uint8Array(total + 4096);
const encoder = new TextEncoder();
/** Writes `s` at byte `at`. @param {string} s @param {number} at @returns {number} the bytes written */
const write = (s, at) => { const b = encoder.encode(s); body.set(b, at); return b.length; };
let at = write("id,name,amount,note\n", 0);
for (let i = 0, n = 20; n < total; i++) {
  const r = `${i},"name ${i}",${(i * 37) % 9973}.${i % 100},"council note ${i} budget line"\n`;
  at += write(r, at); n += r.length;
}
at += write(`LASTROWMARK,"last name",1.00,"the final row of the sheet"\n`, at);
const bytes = body.subarray(0, at);
gc(); gc();
const base = heapUsed();

const parts = await csvEntry.parts(bytes);
const t = await csvEntry.text(parts, { inlineCellsMax: 512 * 1024 });
if (!t.ok || t.document === null) throw new Error(`not a body read: ${JSON.stringify(t).slice(0, 200)}`);
const sheet = t.sheets[0];
if (!sheet) throw new Error("no sheet");
gc(); gc();
const retainedMB = (heapUsed() - base) / 1048576;
const last = await csvEntry.cellsIn(parts, { fromRow: sheet.usedRows, toRow: sheet.usedRows });
console.log(JSON.stringify({
  ok: t.ok, bodyBytes: at, retainedMB, cellsHeld: "cells_held" in sheet && sheet.cells_held === true, cellsNull: sheet.cells === null,
  textHasLast: sheet.text.includes("LASTROWMARK"), usedRows: sheet.usedRows,
  lastCell: last.ok ? last.cells[0]?.value ?? null : null, partsKept: parts.ok,
}));
