/* docprofile — a very large text stays bounded (R38; fix round 4, C5a/C5b/P8; K4467), at the module's interface.
 *
 * A text of BUDGET-2024-APP's size and shape (1,354 pages, 13.6 M characters, two-byte, `document` and `pages[]` both
 * supplied as the PDF reader gives them) is read in a process of its own (memory-child.mjs, `--expose-gc`); the measure
 * is heap + array buffers polled as fast as the worker thread that reads it answers, above what the caller holds. The types are stand-ins (this module holds
 * none, R36), one of which scans `ctx.pages`: what is measured is `readText`'s and `doctypeFor`'s own work. The real
 * types' share, with the real govinfo files, is `doctypes` R37's and measured there. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { registerStubs, stubItems, stubFallback } from "./stubs.mjs";
import * as dp from "../registry.mjs";
/** @import { SuppliedPage, SuppliedText } from "../registry.mjs" */
/** @import { ClassifiedOver } from "../classify-view.mjs" */
/** @import { MeasureMessage, SheetMessage } from "./memory-child.mjs" */

const CHILD = fileURLToPath(new URL("./memory-child.mjs", import.meta.url));
/** How the child process ended and what it printed.
 *  @typedef {Object} ChildRun
 *  @property {number | null} code
 *  @property {string} out
 *  @property {string} err
 */
/** @param {string[]} args
 *  @returns {Promise<ChildRun>} */
function child(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--expose-gc", CHILD, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", /** @param {Buffer} d */ (d) => (out += d));
    p.stderr.on("data", /** @param {Buffer} d */ (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}
/* What memory-child printed, decoded where it is read: the child is this module's own program, and its stdout its own channel. */
const measured = /** @param {string} out @returns {MeasureMessage} */ (out) => /** @type {MeasureMessage} */ (JSON.parse(out));
/* The view the answer was classified over; reading one an answer does not name fails, as reading a member of null does. */
const over = /** @param {ClassifiedOver | null} v @returns {ClassifiedOver} */ (v) => {
  if (v === null) throw new TypeError("the answer names no view it was classified over");
  return v;
};
const sheetMeasured = /** @param {string} out @returns {SheetMessage} */ (out) => /** @type {SheetMessage} */ (JSON.parse(out));

test("R38 readText over a 13.6 M character text adds under 16 MB, hands the type its pages, and answers as it did", { timeout: 300_000 }, async () => {
  const m = await child(["measure", "1354", "10042"]);
  assert.equal(m.code, 0, m.err.slice(0, 300));
  const r = measured(m.out);
  console.log(`R38: ${r.chars} characters, ${Math.round(r.ms)} ms, peak heap + array buffers above what the caller holds ${r.peakMB.toFixed(1)} MB`);
  assert.ok(r.chars > 13_000_000, `${r.chars} characters`);
  assert.ok(r.peakMB < 16, `peak ${r.peakMB.toFixed(1)} MB above what the caller holds`);
  const a = r.answers;
  assert.equal(a.determined, true);
  assert.equal(a.typeSawPages, true, "the type's detect was handed the supplied pages array itself");
  assert.equal(a.scanned, 1354);
  // R39 (fix round 9): the text beside them is the stated view of it (the classification is bounded for every kind), the whole text only for the reading
  assert.equal(over(a.classifiedOver).of, 1354 * 10042 + 1353);
  assert.equal(a.sawText, over(a.classifiedOver).chars, "and the view of the text, beside them");
  assert.ok(a.sawText <= 1536 * 1024, `${a.sawText} characters handed to a detect`);
  assert.deepEqual([a.type, a.confidence, a.also, a.parsed, a.positionParts, a.textFrom],
                   ["scans_pages", "certain", [], { entities: [], facts: { pages: 1354 } }, 1354, "document"]);
});

/* A text over the classification bound (R38, R39): the view is built from it and nothing more is copied. The measure is the plane's
 * (peak heap + array buffers above what the caller holds, polled while `readText` runs, no collection inside it, a 2 MB young
 * generation); the types are stand-ins, so what is measured is this module's own work (the view, `bounded`, `flattenText`). The
 * real types' garbage over the view is `doctypes`' own share (REPORT, K4889). */
/** The sheet of `bytes` read in the child, and what it held and handed the type, asserted.
 *  @param {number} bytes */
async function sheetOf(bytes) {
  const m = await child(["sheet", String(bytes)]);
  assert.equal(m.code, 0, m.err.slice(0, 300));
  const r = sheetMeasured(m.out);
  console.log(`R38 sheet: ${r.chars} characters, ${Math.round(r.ms)} ms, peak above what the caller holds ${r.peakMB.toFixed(1)} MB`);
  assert.ok(r.chars >= bytes - 200, `${r.chars} characters`);
  assert.ok(r.chars > 2 * 1048576, "over CLASSIFY_WHOLE_MAX_CHARS");
  assert.ok(r.peakMB < 6, `peak ${r.peakMB.toFixed(1)} MB above what the caller holds`);
  const a = r.answers;
  assert.equal(a.determined, true);
  assert.equal(a.calls, 1, "the type is asked once");
  assert.equal(over(a.classifiedOver).of, r.chars);
  assert.equal(a.sawText, over(a.classifiedOver).chars, "the type was handed the view");
  assert.ok(a.sawText <= 1536 * 1024, `${a.sawText} characters handed to a detect`);
  assert.deepEqual(a.window, { from: 0, to: a.sawText, of: r.chars });
  assert.equal(a.work.stopped_before, null);
}
test("R38 readText over a 3 MiB sheet, over the classification bound, adds under 6 MB of its own: the view and nothing else", { timeout: 300_000 }, () => sheetOf(3 * 1048576));
test("R38 readText over a 12 MiB sheet, over the classification bound, adds under 6 MB of its own: the view and nothing else", { timeout: 300_000 }, () => sheetOf(12 * 1048576));

test("R38 R39 doctypeForYielding over a 13.6 M character text holds no second copy of it: under 16 MB, the type handed the pages, the answer doctypeFor's", { timeout: 300_000 }, async () => {
  const m = await child(["twin", "1354", "10042"]);
  assert.equal(m.code, 0, m.err.slice(0, 300));
  const r = measured(m.out);
  console.log(`R39: ${r.chars} characters, ${Math.round(r.ms)} ms, peak heap + array buffers above what the caller holds ${r.peakMB.toFixed(1)} MB`);
  assert.ok(r.chars > 13_000_000, `${r.chars} characters`);
  assert.ok(r.peakMB < 16, `peak ${r.peakMB.toFixed(1)} MB above what the caller holds`);
  const a = r.answers;
  assert.equal(a.typeSawPages, true, "the type's detect was handed the supplied pages array itself");
  assert.equal(over(a.classifiedOver).of, 1354 * 10042 + 1353);
  assert.equal(a.sawText, over(a.classifiedOver).chars);
  assert.deepEqual([a.type, a.confidence, a.also], ["scans_pages", "certain", []]);
});

/* The map `segmentsOver` earns over `document` is the one the joined comparison earned: the oracle below is the
 * specification of R22 and R23 stated as the join, and every shape here must agree with it. */
/** @param {string} document @param {ReadonlyArray<SuppliedPage | null>} pages */
const oracle = (document, pages) => {
  /** @type {{ start: number, end: number, page: number }[]} */
  const segs = []; let text = "";
  for (const p of pages) {
    const given = p ? p.text : undefined;
    const t = typeof given === "string" ? given : "";
    if (!t) continue;
    if (text.length) text += "\n";
    const start = text.length; text += t;
    const page = p ? p.page : undefined;
    if (typeof page === "number" && Number.isInteger(page)) segs.push({ start, end: text.length, page });
  }
  return text === document ? segs : null;
};

test("R22 the segment map over document is exactly the join's: blank pages, pages without an index, near misses", () => {
  const P = /** @param {number} page @param {string} text @returns {SuppliedPage} */ (page, text) => ({ page, text });
  /** @type {(SuppliedPage | null)[][]} */
  const shapes = [
    [P(0, "a"), P(1, ""), P(2, "bc"), P(3, "d")],
    [P(0, ""), P(1, "x"), P(2, "")],
    [P(0, "a"), { text: "b" }, P(2, "c")],
    [P(0, "a"), null, P(2, "c"), { page: 3 }],
    [P(0, "\n"), P(1, "a\n"), P(2, "\nb")],
    [P(0, "ab"), P(1, "ab")],
  ];
  for (const pages of shapes) {
    const full = pages.map((p) => { const t = p ? p.text : undefined; return typeof t === "string" ? t : ""; }).filter(Boolean).join("\n");
    const docs = [full, full + "\n", full + "x", "\n" + full, full.slice(1), full.slice(0, -1), full.replace(/\n/, " "), "", "zz"];
    for (const d of docs) {
      if (!d.length) continue;
      const got = dp.flattenText({ document: d, pages });
      const want = oracle(d, pages);
      assert.deepEqual(got.segments, want ? want.map((s) => ({ start: s.start, end: s.end, source: { kind: "pdf-page", ref: `p.${s.page + 1}`, page: s.page, rect: null } })) : [], JSON.stringify([d, pages]));
      assert.equal(got.text, d);
      assert.equal(got.position_why === null, !!(want && want.length), JSON.stringify([d, pages]));
    }
  }
});

test("R38 the type is handed ctx.pages: the supplied pages, and none for a bare string or paragraphs", () => {
  /** @type {(SuppliedPage[] | undefined)[]} */
  const seen = [];
  const key = "r38_seen";
  dp.registerDoctype({ key, label: "r38", version: 1, contract: dp.CONTRACT.SUBSTANCE,
    detect(ctx) { seen.push(ctx.pages); return { match: false }; } });
  /** @type {SuppliedPage[]} */
  const pages = [{ page: 0, text: "one" }, { page: 1, text: "two" }];
  const given = /** @param {SuppliedText | string} supplied */ (supplied) => { seen.splice(0); dp.readText(supplied, {}); assert.ok(seen.length >= 1); return seen[0]; };
  assert.equal(given({ pages }), pages);
  assert.equal(given({ document: "one\ntwo", pages }), pages);
  assert.deepEqual(given("one two"), []);
  assert.deepEqual(given({ paragraphs: [{ para: 0, text: "one" }] }), []);
  dp.registerDoctype({ key, label: "gone", version: 1, contract: dp.CONTRACT.SUBSTANCE, detect: () => ({ match: false }) });
});
