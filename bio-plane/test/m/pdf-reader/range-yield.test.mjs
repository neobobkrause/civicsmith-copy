/* pdf-reader R45, amended (fix round 9, G179; K5006): the compute over a region yields too. `openPdfRange(bytes, {yieldNow})` gave the
 * thread back while it opened and then not at all: a `range(...)` call over 78 pages of a 21 MB file held the thread 250-435 ms in
 * one stretch (the page loop, the image walk, the glyph and word count of `readRange`), so a cheap request beside a reading tick
 * waited a whole tick. Now each loop whose work grows with the region awaits `yieldNow()` on a bounded slice (a count of tokens or
 * characters, never a time), and the answer is the same with and without it.
 *
 * R-CLOCK: the yields are COUNTED; the one stretch figure is taken with this test's clock outside the call and judged against the
 * SAME run's unsliced call of the same range (K4966: a wall bar measures the machine unless the machine is measured beside it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openPdfRange, extractPdfRange } from "../../../src/pdfstructure.mjs";
import { densePdf } from "./dense.mjs";
/** @import { OpenedRange, PdfRefusal, PdfRange, PdfRangeArgs } from "../../../src/pdfstructure.mjs" */

/** A value that is there; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined || v === null) throw new Error(`${what}: none`);
  return v;
}
/** An opened document; a thrown failure naming `what` when the opening is a refusal.
 *  @param {OpenedRange | PdfRefusal} r
 *  @param {string} what
 *  @returns {OpenedRange} */
function openedOf(r, what) {
  if (!r.ok) throw new Error(`${what}: the opening answered ${r.reason}`);
  return r;
}

/** A turn of the event loop.
 *  @returns {Promise<void>} */
const later = () => new Promise((r) => setImmediate(r));
/** What `stretches` gives: the `yieldNow`, the start and end marks, and what they counted.
 *  @typedef {Object} Stretches
 *  @property {() => Promise<void>} yieldNow
 *  @property {() => void} mark
 *  @property {() => void} end
 *  @property {number} calls
 *  @property {number} longest
 */
/** A `yieldNow` that counts its calls and takes, with the test's own clock outside the call, the longest stretch between
 *  `mark()`, its yields and `end()`.
 *  @returns {Stretches} */
function stretches() {
  let last = 0, longest = 0, calls = 0;
  const lap = () => { const t = performance.now(); longest = Math.max(longest, t - last); last = t; };
  return { yieldNow: async () => { calls++; lap(); await later(); last = performance.now(); },
    mark: () => { last = performance.now(); longest = 0; }, end: lap, get calls() { return calls; }, get longest() { return longest; } };
}
/** What `counted` gives: a `yieldNow` and how many times it was called.
 *  @typedef {Object} Counted
 *  @property {() => Promise<void>} yieldNow
 *  @property {number} n
 */
/** @returns {Counted} */
const counted = () => { let n = 0; return { yieldNow: async () => { n++; }, get n() { return n; } }; };
/** @param {PdfRange | PdfRefusal} v
 *  @returns {string} */
const json = (v) => JSON.stringify(v);
/** @param {PdfRangeArgs} args
 *  @returns {string} */
const jsonArgs = (args) => JSON.stringify(args);

test("R45 amended: a range awaits yieldNow within its compute, more work giving more awaits, counted and never timed", async () => {
  const bytes = densePdf({ pages: 300, linesPerPage: 120 });
  const c = counted();
  const open = openedOf(await openPdfRange(bytes, { yieldNow: c.yieldNow }), "300 pages");
  const afterOpen = c.n;
  await open.range({ from: 0, count: 10 });
  const ten = c.n - afterOpen;
  const before = c.n;
  await open.range({ from: 10, count: 100 });
  const hundred = c.n - before;
  assert.ok(ten >= 1, `${ten} awaits for a range of 10 pages`);
  assert.ok(hundred >= 8, `${hundred} awaits for a range of 100 pages of 120 lines`);
  assert.ok(hundred > ten, `${hundred} awaits for 100 pages, ${ten} for 10`);
  /* one page that is a region of its own: its token walk and its glyph and word count yield inside the page */
  const heavy = densePdf({ pages: 1, linesPerPage: 30000 });
  const h = counted();
  const ho = openedOf(await openPdfRange(heavy, { yieldNow: h.yieldNow }), "one heavy page");
  const hb = h.n;
  await ho.range({ from: 0, count: 1 });
  assert.ok(h.n - hb >= 20, `${h.n - hb} awaits for one page of 30,000 lines`);
  /* a page that paints and shows nothing the text walk reads: the image walk's own loop */
  const scan = densePdf({ pages: 40, scan: true });
  const s = counted();
  const so = openedOf(await openPdfRange(scan, { yieldNow: s.yieldNow }), "40 scanned pages");
  assert.equal(must((await so.range({ from: 0, count: 40 })).images, "images").length, 40);
  /* no function: no await at all, as R44 */
  const none = openedOf(await openPdfRange(bytes), "300 pages without yieldNow");
  assert.equal(json(await none.range({ from: 0, count: 100 })), json(await extractPdfRange(bytes, { from: 0, count: 100 })));
});

test("R45 amended: every range answers the same with yieldNow as without, whatever yieldNow does", async () => {
  /** One document read, and its name.
   *  @typedef {Object} Doc
   *  @property {string} dname
   *  @property {Uint8Array} bytes
   */
  /** @type {Doc[]} */
  const docs = [
    { dname: "text pages", bytes: densePdf({ pages: 120, linesPerPage: 80 }) },
    { dname: "one heavy page", bytes: densePdf({ pages: 3, linesPerPage: 9000 }) },
    { dname: "scanned pages", bytes: densePdf({ pages: 30, scan: true }) },
    { dname: "an encrypted file", bytes: densePdf({ pages: 5, linesPerPage: 3, encrypted: true }) },
  ];
  /** One `yieldNow` the opening is given, and its name.
   *  @typedef {Object} Variant
   *  @property {string} vname
   *  @property {() => (void | Promise<void>)} yieldNow
   */
  /** @type {Variant[]} */
  const variants = [
    { vname: "a timer turn", yieldNow: async () => later() },
    { vname: "a plain function", yieldNow: () => {} },
    { vname: "one that throws", yieldNow: () => { throw new Error("no"); } },
    { vname: "one that rejects", yieldNow: () => Promise.reject(new Error("no")) },
  ];
  /** @type {PdfRangeArgs[]} */
  const cuts = [{ from: 0, count: 100 }, { from: 1, count: 2 }, { from: 0, count: 100, maxBytes: 200_000 }, { from: 2, count: 1 }, { from: 500, count: 3 }];
  for (const { dname, bytes } of docs) {
    const plain = openedOf(await openPdfRange(bytes), dname);
    for (const { vname, yieldNow } of variants) {
      const y = openedOf(await openPdfRange(bytes, { yieldNow }), `${dname} ${vname}`);
      for (const args of cuts) {
        assert.equal(json(await y.range(args)), json(await plain.range(args)), `${dname} ${vname} ${jsonArgs(args)}`);
      }
    }
  }
});

test("R45 amended: no stretch of a range is as long as the range, judged against the same run's unsliced call", { timeout: 300_000 }, async () => {
  const bytes = densePdf({ pages: 200, linesPerPage: 120 });
  const plain = openedOf(await openPdfRange(bytes), "200 pages");
  const s = stretches();
  const y = openedOf(await openPdfRange(bytes, { yieldNow: s.yieldNow }), "200 pages with yieldNow");
  await plain.range({ from: 150, count: 10 });   // warm both
  await y.range({ from: 150, count: 10 });
  const t0 = performance.now();
  const want = await plain.range({ from: 0, count: 100 });
  const unsliced = performance.now() - t0;   // the control: the same range, one stretch
  const calls0 = s.calls;
  s.mark();
  const got = await y.range({ from: 0, count: 100 });
  s.end();
  console.log(`R45 range of 100 pages: unsliced one stretch of ${unsliced.toFixed(0)} ms; with yieldNow ${s.calls - calls0} yields, longest stretch ${s.longest.toFixed(1)} ms`);
  assert.equal(json(got), json(want));
  assert.ok(s.calls - calls0 >= 8, `${s.calls - calls0} yields`);
  assert.ok(s.longest < unsliced / 3, `the longest stretch ${s.longest.toFixed(1)} ms against the unsliced ${unsliced.toFixed(0)} ms`);
});
