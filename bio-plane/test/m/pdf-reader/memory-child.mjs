/* pdf-reader tests (R41): one reading of one file in a process of its own, so its memory is its alone. Run by
 * memory.test.mjs as `node [--expose-gc --max-old-space-size=N] memory-child.mjs <measure|digest> <file>`.
 *   measure: baseline after a collection, the reading with the peak of heap + array buffers polled while it runs;
 *            prints {baseMB, peakMB, ms, pages, ok, reason}. A reading that outgrows the heap limit dies, and so does this.
 *   objects: the same for `openPdf` and then `objects()` (R37), the file's bytes counted: prints {baseMB, peakMB, ms, objects, ok}.
 *   objdigest: a SHA-256 over every entry `objects()` answers (number, generation, value, string bytes), with no limit set.
 *   idle:    the heap this process holds before any reading (modules loaded, collected): {baseHeapMB}.
 *   digest:  the reading's whole answer as digestOf() states it, with no limit set. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractPdfStructure, extractPdfRange, openPdfRange, openPdf } from "../../../src/pdfstructure.mjs";
import { digestOf } from "./digest.mjs";

/** What `idle` prints: the heap the process holds with its modules loaded and collected, in MB.
 *  @typedef {Object} IdleMessage
 *  @property {number} baseHeapMB
 *  @message stdout
 */
/** What `measure` prints: the baseline, the peak above it and the reading's time; the page count where the answer has
 *  one (absent for a refusal of what is not a PDF), and the refusal's reason or null.
 *  @typedef {Object} MeasureMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} ms
 *  @property {number | undefined} pages
 *  @property {boolean} ok
 *  @property {string | null} reason
 *  @message stdout
 */
/** What `bigpage` prints: the reading's page count, the first and last pages' text, how many times page 2 says the
 *  sentence, the markers' reasons and the notes.
 *  @typedef {Object} BigPageMessage
 *  @property {boolean} ok
 *  @property {number} pages
 *  @property {string} first
 *  @property {string} last
 *  @property {number} said
 *  @property {string[]} marked
 *  @property {string[]} notes
 *  @message stdout
 */
/** One embedded file's record in `embedded`'s message.
 *  @typedef {Object} EmbeddedFile
 *  @property {string} sha
 *  @property {number} bytes
 */
/** What `embedded` prints: the baseline, the peak of live memory above it, the notes and the embedded files.
 *  @typedef {Object} EmbeddedMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {boolean} ok
 *  @property {string[]} notes
 *  @property {EmbeddedFile[]} intra
 *  @message stdout
 */
/** What `objects` prints: the baseline, the peak above it, the time, and how many objects `objects()` answered (null for
 *  none).
 *  @typedef {Object} ObjectsMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} ms
 *  @property {number | null} objects
 *  @property {boolean} ok
 *  @message stdout
 */
/** What `objdigest` prints: the digest of every entry `objects()` answered, and how many.
 *  @typedef {Object} ObjDigestMessage
 *  @property {string} digest
 *  @property {number} objects
 *  @message stdout
 */
/** What `range` prints: the baseline, the peak above it, the slowest range, the document's pages, the calls made and the
 *  digest of the pages' text in order.
 *  @typedef {Object} RangeMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} slowestMs
 *  @property {number} pages
 *  @property {number} calls
 *  @property {string} digest
 *  @message stdout
 */
/** What `opened` prints: `range`'s measures, the opening's time, and whether the opened document was still held.
 *  @typedef {Object} OpenedMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} openMs
 *  @property {number} slowestMs
 *  @property {number} pages
 *  @property {number} calls
 *  @property {string} digest
 *  @property {boolean} held
 *  @message stdout
 */
/** What `digest` prints: the reading's whole answer as `digestOf` states it.
 *  @typedef {Object} DigestMessage
 *  @property {string} digest
 *  @message stdout
 */

const mode = process.argv[2];
/** The command line's argument `i`; a thrown failure naming `what` when there is none.
 *  @param {number} i
 *  @param {string} what
 *  @returns {string} */
const arg = (i, what) => {
  const v = process.argv[i];
  if (v === undefined) throw new Error(`memory-child ${mode}: no ${what} given`);
  return v;
};
/** The file this run reads.
 *  @returns {string} */
const fileArg = () => arg(3, "file");
/** `v` itself; a thrown failure naming `what` when it is null or undefined.
 *  @template T
 *  @param {T | null | undefined} v
 *  @param {string} what
 *  @returns {T} */
const must = (v, what) => {
  if (v === null || v === undefined) throw new Error(`memory-child ${mode}: no ${what}`);
  return v;
};
/** Prints one message as a line of JSON.
 *  @param {IdleMessage | MeasureMessage | BigPageMessage | EmbeddedMessage | ObjectsMessage | ObjDigestMessage | RangeMessage | OpenedMessage | DigestMessage} m */
const say = (m) => console.log(JSON.stringify(m));
/** A JSON replacer that writes bytes as a list of numbers.
 *  @param {string} k
 *  @param {unknown} v
 *  @returns {unknown} */
const bytesAsList = (k, v) => (v instanceof Uint8Array ? Array.from(v) : v);

if (mode === "idle") {
  global.gc(); global.gc();
  say({ baseHeapMB: process.memoryUsage().heapUsed / 1048576 });
} else if (mode === "measure") {
  const bytes = new Uint8Array(readFileSync(fileArg()));
  /** @returns {number} heap + array buffers, in bytes */
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  global.gc(); global.gc();
  const base = used();
  let peak = 0;
  const timer = setInterval(() => { const v = used() - base; if (v > peak) peak = v; }, 2);
  const t0 = performance.now();
  const r = await extractPdfStructure(bytes);
  const ms = performance.now() - t0;
  clearInterval(timer);
  say({ baseMB: base / 1048576, peakMB: peak / 1048576, ms, pages: "pages" in r ? r.pages : undefined, ok: r.ok,
    reason: r.ok ? null : r.reason });
} else if (mode === "bigpage") {
  /* R41: a file whose page 2 (index 1) is one very large content stream of text lines, read in whatever heap limit the process
     was started with: whether it completes, the first and last pages' text, and how many times page 2 says the sentence. */
  const bytes = new Uint8Array(readFileSync(fileArg()));
  const sentence = arg(4, "sentence");
  const r = await extractPdfStructure(bytes);
  if (!r.ok) throw new Error(`memory-child bigpage: the reading answered ${r.reason}`);
  const t = must(r.text.pages[1], "page 2").text;
  let n = 0;
  for (let at = t.indexOf(sentence); at !== -1; at = t.indexOf(sentence, at + sentence.length)) n++;
  say({ ok: r.ok, pages: r.pages, first: must(r.text.pages[0], "page 1").text, last: must(r.text.pages[2], "page 3").text, said: n,
    marked: r.text.undetermined.map((u) => u.reason), notes: r.notes });
} else if (mode === "embedded") {
  /* R22: a file with an embedded file attached; the peak of LIVE heap + array buffers above the baseline (the file's bytes are
     read before the baseline, so they are not counted) and the embedded files' records. */
  const bytes = new Uint8Array(readFileSync(fileArg()));
  /** @returns {number} heap + array buffers, in bytes */
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  global.gc(); global.gc();
  const base = used();
  let peak = 0;
  /* a collection before each reading, so the peak is what is LIVE (what is held), not the garbage a decoder's chunks leave */
  const timer = setInterval(() => { global.gc(); const v = used() - base; if (v > peak) peak = v; }, 20);
  const r = await extractPdfStructure(bytes);
  clearInterval(timer);
  if (!r.ok) throw new Error(`memory-child embedded: the reading answered ${r.reason}`);
  say({ baseMB: base / 1048576, peakMB: peak / 1048576, ok: r.ok, notes: r.notes,
    intra: r.links.flatMap((l) => (l.partition === "intra" ? [{ sha: l.target.sha256, bytes: l.target.bytes }] : [])) });
} else if (mode === "objects") {
  /** @returns {number} heap + array buffers, in bytes */
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  global.gc(); global.gc();
  const base = used();
  let peak = 0;
  const timer = setInterval(() => { const v = used() - base; if (v > peak) peak = v; }, 2);
  const bytes = new Uint8Array(readFileSync(fileArg()));
  const t0 = performance.now();
  const doc = must(await openPdf(bytes), "PDF");
  const r = doc.objects();
  const ms = performance.now() - t0;
  clearInterval(timer);
  say({ baseMB: base / 1048576, peakMB: peak / 1048576, ms, objects: r ? r.objects.length : null, ok: Boolean(r) });
} else if (mode === "objdigest") {
  const doc = must(await openPdf(new Uint8Array(readFileSync(fileArg()))), "PDF");
  const r = must(doc.objects(), "objects() answer");
  const h = createHash("sha256");
  h.update(JSON.stringify(r.trailer, bytesAsList));
  for (const o of r.objects) h.update(JSON.stringify([o.num, o.gen, o.value], bytesAsList));
  h.update(JSON.stringify(r.unresolved));
  say({ digest: h.digest("hex"), objects: r.objects.length });
} else if (mode === "range") {
  /* R43: every range of `count` pages, in turn, from one copy of the bytes; the peak of heap + array buffers above the
     baseline over all of them, the slowest range, and the SHA-256 of the pages' text in order. */
  const count = Number(arg(4, "count"));
  const bytes = new Uint8Array(readFileSync(fileArg()));
  /** @returns {number} heap + array buffers, in bytes */
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  global.gc(); global.gc();
  const base = used();
  let peak = 0;
  const timer = setInterval(() => { const v = used() - base; if (v > peak) peak = v; }, 2);
  const h = createHash("sha256");
  let slowest = 0, total = 0, calls = 0;
  for (let from = 0; ; from += count) {
    const t0 = performance.now();
    const r = await extractPdfRange(bytes, { from, count });
    slowest = Math.max(slowest, performance.now() - t0);
    if (!r.ok) throw new Error(`memory-child range: the range answered ${r.reason}`);
    total = r.pages; calls++;
    for (const p of r.text.pages) h.update(JSON.stringify([p.page, p.text, p.undetermined]));
    if (r.count === 0 || from + count >= r.pages) break;
  }
  clearInterval(timer);
  say({ baseMB: base / 1048576, peakMB: peak / 1048576, slowestMs: slowest, pages: total, calls, digest: h.digest("hex") });
} else if (mode === "opened") {
  /* R44: the file opened once, then every range of `count` pages from the one opened document, which is held to the end;
     the same measures as "range" (the peak is read while the opened document is still held), and the pages' digest. */
  const count = Number(arg(4, "count"));
  const bytes = new Uint8Array(readFileSync(fileArg()));
  /** @returns {number} heap + array buffers, in bytes */
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  global.gc(); global.gc();
  const base = used();
  let peak = 0;
  const timer = setInterval(() => { const v = used() - base; if (v > peak) peak = v; }, 2);
  const h = createHash("sha256");
  const t0 = performance.now();
  const opened = await openPdfRange(bytes);
  const openMs = performance.now() - t0;
  if (!opened.ok) throw new Error(`memory-child opened: the opening answered ${opened.reason}`);
  let slowest = 0, calls = 0;
  for (let from = 0; ; from += count) {
    const t1 = performance.now();
    const r = await opened.range({ from, count });
    slowest = Math.max(slowest, performance.now() - t1);
    calls++;
    for (const p of r.text.pages) h.update(JSON.stringify([p.page, p.text, p.undetermined]));
    if (r.count === 0 || from + count >= opened.pages) break;
  }
  clearInterval(timer);
  say({ baseMB: base / 1048576, peakMB: peak / 1048576, openMs, slowestMs: slowest, pages: opened.pages, calls, digest: h.digest("hex"), held: Boolean(opened.range) });
} else {
  const bytes = new Uint8Array(readFileSync(fileArg()));
  say({ digest: digestOf(await extractPdfStructure(bytes)) });
}
