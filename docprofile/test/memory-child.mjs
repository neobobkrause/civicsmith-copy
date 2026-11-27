/* docprofile tests (R38): one `readText` over a very large text in a process of its own, so its memory is its alone.
 * Run by memory.test.mjs as `node --expose-gc memory-child.mjs <idle|measure> [pages] [chars-per-page]`.
 *   idle:    nothing read; prints {baseMB}.
 *   twin:    as measure, with `doctypeForYielding` (R39) in place of `readText`: the same text, a real yield before each type.
 *   sheet:   (R38, a text over the classification bound) a CSV-shaped sheet of `pages` bytes (`document` and `sheets[0].text` the one
 *            string, as csv-reader emits it) read by `readText` under a 2 MB young generation, as the plane's isolate runs, with
 *            stand-in types that read the text and its `window` they are handed; no collection runs in the measured stretch.
 *            Prints {baseMB, peakMB, ...} with `answers` holding what the type was handed.
 *   measure: the text of the size given (I2's `document` and `pages[]`, the two-byte text a PDF with one character past
 *            U+00FF yields) is built and held in a worker thread, as the caller holds it; after a collection the worker
 *            runs `readText` (synchronously, with a type that scans `ctx.pages` and a fallback) while this thread polls
 *            the worker's heap + external memory as fast as it answers, above that baseline. Prints
 *            {baseMB, peakMB, samples, ms, chars, answers}, `answers` being what the type saw and read.
 * The registry holds only these stand-in types (this module holds none, R36); the answers of the real types are doctypes'. */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
/** @import { ClassifyWindow, DoctypeAnswer, SuppliedPage, SuppliedText, WorkSpent, AlsoEntry } from "../registry.mjs" */
/** @import { ClassifiedOver } from "../classify-view.mjs" */

/** What the worker is handed: the mode, and the size of the text to build.
 *  @typedef {Object} ChildData
 *  @property {string | undefined} mode
 *  @property {number} pages
 *  @property {number} per
 */
/** What `sheet`'s type was handed, and the answer.
 *  @typedef {Object} SheetAnswers
 *  @property {boolean} determined
 *  @property {string} type
 *  @property {number} calls
 *  @property {number} sawText
 *  @property {ClassifyWindow | null | undefined} window
 *  @property {ClassifiedOver | null} classifiedOver
 *  @property {WorkSpent} work
 */
/** What `measure`'s and `twin`'s type saw and read, and the answer.
 *  @typedef {Object} MeasureAnswers
 *  @property {boolean} determined
 *  @property {string} type
 *  @property {string | undefined} confidence
 *  @property {AlsoEntry[]} also
 *  @property {object | null} parsed
 *  @property {number} positionParts
 *  @property {string | null} textFrom
 *  @property {boolean} typeSawPages
 *  @property {number} scanned
 *  @property {number} sawText
 *  @property {ClassifiedOver | null} classifiedOver
 */
/** The worker's result for `sheet`: what it holds at the end above its baseline, the time, the text's size and the answers.
 *  @typedef {Object} SheetResult
 *  @property {number} endMB
 *  @property {number} ms
 *  @property {number} chars
 *  @property {SheetAnswers} answers
 */
/** The worker's result for `measure` and `twin`: what it holds at the end above its baseline, the time, the text's size and
 *  the answers.
 *  @typedef {Object} MeasureResult
 *  @property {number} endMB
 *  @property {number} ms
 *  @property {number} chars
 *  @property {MeasureAnswers} answers
 */
/** What the worker tells this thread: its baseline is taken, it is idle, or its result.
 *  @typedef {{ base: true } | { idle: true } | SheetResult | MeasureResult} WorkerMessage
 */
/** What `sheet` prints: the baseline, the peak above it, the samples taken, and the worker's result.
 *  @typedef {Object} SheetMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} samples
 *  @property {number} endMB
 *  @property {number} ms
 *  @property {number} chars
 *  @property {SheetAnswers} answers
 *  @message stdout
 */
/** What `measure` and `twin` print: the baseline, the peak above it, the samples taken, and the worker's result.
 *  @typedef {Object} MeasureMessage
 *  @property {number} baseMB
 *  @property {number} peakMB
 *  @property {number} samples
 *  @property {number} endMB
 *  @property {number} ms
 *  @property {number} chars
 *  @property {MeasureAnswers} answers
 *  @message stdout
 */

/** A member a stand-in type relies on being handed; reading one it was not handed fails, as reading a member of undefined does.
 *  @template T
 *  @param {T | undefined} v
 *  @param {string} what
 *  @returns {T} */
function there(v, what) {
  if (v === undefined) throw new TypeError(`the type was handed no ${what}`);
  return v;
}

const MB = 1048576;
if (isMainThread) {
  const [mode, pages, per] = process.argv.slice(2);
  /** @type {ChildData} */
  const data = { mode, pages: Number(pages), per: Number(per) };
  const file = fileURLToPath(import.meta.url);
  const w = mode === "sheet" ? new Worker(file, { workerData: data, resourceLimits: { maxYoungGenerationSizeMb: 2 } })
                             : new Worker(file, { workerData: data });
  let base = 0, peak = 0, samples = 0, stop = false;
  /** @returns {Promise<number>} */
  const heap = async () => { const h = await w.getHeapStatistics(); return h.used_heap_size + h.external_memory; };
  w.on("message", /** @param {unknown} raw */ async (raw) => {
    const m = /** @type {WorkerMessage} */ (raw);
    if ("base" in m) {
      base = await heap();
      (async () => { while (!stop) { /** @type {number} */ let v; try { v = (await heap()) - base; } catch { break; } /* the worker ended under a poll in flight */ samples++; if (v > peak) peak = v; } })();
      w.postMessage("go");
    } else if ("idle" in m) {
      console.log(JSON.stringify({ baseMB: (await heap()) / MB })); w.terminate();
    } else {
      stop = true;
      console.log(JSON.stringify({ baseMB: base / MB, peakMB: Math.max(peak, m.endMB * MB) / MB, samples, ...m }));
      w.terminate();
    }
  });
  w.on("error", (e) => { console.error(e); process.exit(1); });
} else {
  const { CONFIDENCE, CONTRACT, registerDoctype, readText, doctypeForYielding } = await import("../registry.mjs");
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  const { mode, pages: N, per: PER } = /** @type {ChildData} */ (workerData);
  const port = parentPort || (() => { throw new Error("memory-child: a worker with no parent port"); })();
  /* A full collection: `--expose-gc` gives it, and calling it without that fails as calling `global.gc` did. */
  const gc = () => {
    const collect = global.gc;
    if (!collect) throw new TypeError("global.gc is not a function");
    collect();
  };
  if (mode === "idle") { gc(); gc(); port.postMessage({ idle: true }); }
  else if (mode === "sheet") await measureSheet();
  else await measure(mode === "twin");
  async function measureSheet() {
    const rows = ["id,name,amount,note"];
    for (let n = 20, i = 0; n < N; i++) { const r = `${i},"name ${i}",${(i * 37) % 9973}.${i % 100},"council note ${i} budget line"`; rows.push(r); n += r.length + 1; }
    const text = rows.join("\n"); rows.splice(0);
    const sheet = { sheet: 0, name: "table", text };
    /** @type {SuppliedText} */
    const supplied = { document: text, sheets: [sheet], undetermined: [], counts: { chars: text.length, undetermined: 0 } };
    /** @type {{ text: number, window: ClassifyWindow | null | undefined, calls: number }} */
    const seen = { text: 0, window: null, calls: 0 };
    registerDoctype({
      key: "reads_view", label: "stand-in: reads what it is handed", version: 1, contract: CONTRACT.SUBSTANCE,
      detect(ctx) {
        const t = there(ctx.text, "text"), work = there(ctx.work, "work");
        seen.calls++; seen.text = t.length; seen.window = ctx.window;
        for (let at = t.indexOf("\n"); at >= 0; at = t.indexOf("\n", at + 1)) { /* a pass over every line of what it is handed */ }
        work.chars += t.length;
        return { match: false };
      },
      parse: () => ({ entities: [], facts: {} }),
    });
    registerDoctype({ key: "generic", label: "stand-in fallback", version: 1, fallback: true, contract: CONTRACT.SUBSTANCE,
      detect: () => ({ match: false }), parse: () => ({ entities: [], facts: {} }) });
    gc(); gc();
    const base = used();
    port.postMessage({ base: true });
    await new Promise((go) => { port.once("message", go); });
    const t0 = performance.now();
    const r = readText(supplied, {});
    const ms = performance.now() - t0;
    if (!r.determined) throw new TypeError("readText read nothing, so there is no doctype to report");
    /** @type {SheetResult} */
    const result = { endMB: Math.max(0, used() - base) / MB, ms, chars: text.length,
      answers: { determined: r.determined, type: r.doctype.type.key, calls: seen.calls, sawText: seen.text, window: seen.window,
                 classifiedOver: r.doctype.classified_over || null, work: r.doctype.work } };
    port.postMessage(result);
  }
  /** @param {boolean} twin */
  async function measure(twin) {
  const line = "Council Resolution 2024-001 — the fiscal year budget, Section 4.2, adopted by the Board.\n";
  /** @type {SuppliedPage[]} */
  const pages = [];
  for (let i = 0; i < N; i++) {
    let t = `Page ${i + 1}\n`;
    while (t.length < PER) t += line;
    pages.push({ page: i, text: t.slice(0, PER), undetermined: [] });
  }
  const document = pages.map((p) => p.text).join("\n");
  /** @type {SuppliedText} */
  const supplied = { document, pages, undetermined: [], counts: { chars: 0, undetermined: 0 } };
  /** @type {SuppliedPage[] | null | undefined} */
  let seenPages = null;
  let scanned = 0, sawText = 0;
  registerDoctype({
    key: "scans_pages", label: "stand-in: scans page by page", version: 1, contract: CONTRACT.SUBSTANCE,
    detect(ctx) {
      seenPages = ctx.pages;
      sawText = there(ctx.text, "text").length;
      let n = 0;
      for (const p of there(ctx.pages, "pages")) if (/Resolution 2024-001/.test(String(p.text))) n++;
      scanned = n;
      return n ? { match: true, confidence: CONFIDENCE.CERTAIN, signals: ["pages"] } : { match: false };
    },
    parse(ctx) { return { entities: [], facts: { pages: there(ctx.pages, "pages").length } }; },
  });
  registerDoctype({ key: "generic", label: "stand-in fallback", version: 1, fallback: true, contract: CONTRACT.SUBSTANCE,
    detect: () => ({ match: false }), parse: () => ({ entities: [], facts: {} }) });
  gc(); gc();
  const base = used();
  port.postMessage({ base: true });
  await new Promise((go) => { port.once("message", go); });
  const t0 = performance.now();
  /* twin: R39's `doctypeForYielding` over the same text, awaiting a real turn of the loop before each type (the text is long). */
  /** @type {{ chars: number, determined: boolean, doctype: DoctypeAnswer, position_parts: number, text_from: string | null, parsed: object | null }} */
  let r;
  if (twin) {
    const d = await doctypeForYielding({ text: document, pages }, { yieldNow: () => new Promise((go) => { setImmediate(go); }) });
    r = { chars: document.length, determined: true, doctype: d, position_parts: pages.length, text_from: "document", parsed: { entities: [], facts: { pages: pages.length } } };
  } else {
    const read = readText(supplied, {});
    if (!read.determined) throw new TypeError("readText read nothing, so there is no doctype to report");
    r = read;
  }
  const ms = performance.now() - t0;
  /** @type {MeasureResult} */
  const result = { endMB: Math.max(0, used() - base) / MB, ms, chars: document.length,
    answers: { determined: r.determined, type: r.doctype.type.key, confidence: r.doctype.confidence, also: r.doctype.also,
               parsed: r.parsed, positionParts: r.position_parts, textFrom: r.text_from,
               typeSawPages: seenPages === pages, scanned, sawText, classifiedOver: r.doctype.classified_over || null } };
  port.postMessage(result);
  }
}
