/* docprofile — classifying a long text gives the thread back (R39; fix round 7, G88; K4768), at the module's interface:
 * `doctypeForYielding` through `docprofile/registry.mjs`. The types are this module's own stubs (`g48-readings.mjs`'s
 * corpus, plus stubs that answer CERTAIN or LIKELY by a marker in the text), each re-registered WRAPPED under its own key
 * (so its slot and the order are kept) to log every `detect` beside every `yield`; `doctypes` is a later module and is never
 * imported here. What is asserted is ORDER and COUNT over a 300 KiB text, never a compute time (R-CLOCK): the real eight
 * types over a 12 MB text are reading-pipeline's `r7-classify-yield.test.mjs`. This file runs in its own process, so its
 * first test sees the registry as a process that registered nothing does. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as dp from "../registry.mjs";
import { registerCorpusTypes } from "./g48-readings.mjs";
/** @import { DoctypeContext, ContentType, DoctypeAnswer, YieldOptions } from "../registry.mjs" */

const { doctypeFor, doctypeForYielding, doctypes, registerDoctype, CONFIDENCE, CONTRACT } = dp;
const KIB = 1024;
const AT = 256 * KIB;
const pad = /** @param {string} head @param {number} n */ (head, n) => head + " ".repeat(Math.max(0, n - head.length));

/** @type {string[]} */
let log = [];
/** @returns {Promise<void>} */
const settle = () => new Promise((r) => { setImmediate(() => r()); });
/** A yield that is a real turn of the loop, logged at its start and its end: a `detect` between the two would be a walk that did not wait. */
/** @returns {Promise<void>} */
const countingYield = async () => { log.push("yield"); await settle(); log.push("yield-end"); };
const events = () => log.filter((e) => e !== "yield-end");
/** A type that answers `confidence` on a text holding `marker`, and reads nothing.
 *  @param {string} key @param {string} marker @param {string} confidence
 *  @returns {ContentType} */
const stub = (key, marker, confidence) => ({
  key, label: `g88 ${key}`, version: 1, contract: CONTRACT.SUBSTANCE,
  detect: (ctx) => {
    if (String(ctx.text || "").includes(marker)) return { match: true, confidence, signals: [marker] };
    return { match: false };
  },
  parse: () => ({ entities: [], facts: {} }),
});
/** Re-register every held type wrapped, same key, same slot. */
function wrapAll() {
  for (const m of doctypes()) {
    const inner = m.detect;
    registerDoctype({ ...m, detect(ctx) { log.push(`detect:${m.key}`); return inner.call(this, ctx); } });
  }
}
/**
 * The sync answer and the twin's answer, or what each threw, with each one's events.
 * @typedef {{ sync: DoctypeAnswer | undefined, syncErr: unknown, syncLog: string[], twin: DoctypeAnswer | undefined, twinErr: unknown, twinLog: string[] }} Both
 */
/** The sync answer and the twin's answer (with the yields logged), the walk's events kept apart.
 *  @param {DoctypeContext} ctx @param {YieldOptions} [opts]
 *  @returns {Promise<Both>} */
async function both(ctx, opts = { yieldNow: countingYield }) {
  log = [];
  /** @type {DoctypeAnswer | undefined} */
  let sync;
  /** @type {unknown} */
  let syncErr;
  try { sync = doctypeFor(ctx); } catch (e) { syncErr = e; }
  const syncLog = log; log = [];
  /** @type {DoctypeAnswer | undefined} */
  let twin;
  /** @type {unknown} */
  let twinErr;
  try { twin = await doctypeForYielding(ctx, opts); } catch (e) { twinErr = e; }
  return { sync, syncErr, syncLog, twin, twinErr, twinLog: log };
}
/** An answer that is there: reading one a call that threw never gave is the test's failure, as reading a member of undefined is.
 *  @template T
 *  @param {T | undefined} v
 *  @returns {T} */
function there(v) {
  if (v === undefined) throw new TypeError("no answer to read: the call threw or found none");
  return v;
}
/** A thrown value's message where it is an Error; undefined otherwise. @param {unknown} e */
const messageOf = (e) => (e instanceof Error ? e.message : undefined);
const detects = /** @param {string[]} l */ (l) => l.filter((e) => e.startsWith("detect:"));
/** Strictly yield, detect, yield, detect ...: a yield before the first detect and between every two. */
/** @param {string[]} l @param {string} what */
function assertInterleaved(l, what) {
  const ev = l.filter((e) => e !== "yield-end");
  assert.ok(detects(ev).length >= 2, `${what}: ${detects(ev).length} detects`);
  ev.forEach((e, i) => assert.equal(e.startsWith("detect:"), i % 2 === 1, `${what}: event ${i} (${e}) in ${ev.join(" ")}`));
  assert.equal(ev.length, 2 * detects(ev).length, `${what}: one yield for each detect`);
  // each yield was awaited to its end before the next detect ran
  l.forEach((e, i) => { if (e === "yield") assert.equal(l[i + 1], "yield-end", `${what}: the yield was not awaited`); });
}
/** @param {Both} a @param {Both} b @param {string} what */
const same = (a, b, what) => {
  const { syncErr, twinErr } = a;
  assert.equal(syncErr === undefined, twinErr === undefined, `${what}: both throw or neither`);
  if (syncErr) assert.equal(String(twinErr && messageOf(twinErr)), String(messageOf(syncErr)), what);
  else assert.deepEqual(a.twin, a.sync, what);
};

test("R39 R4 nothing registered: the twin exists and answers the stated no-type answer, as doctypeFor does", async () => {
  assert.equal(typeof doctypeForYielding, "function");
  assert.deepEqual(doctypes(), []);
  /** @type {DoctypeContext[]} */
  const ctxs = [{ text: "a letter" }, { text: pad("a letter", AT + 1) }, {}];
  for (const ctx of ctxs) {
    const r = await both(ctx);
    same(r, r, "NO_TYPE");
    assert.equal(there(r.twin).type, dp.NO_TYPE);
    assert.equal(there(r.twin).why, there(r.sync).why);
    assert.deepEqual(r.twinLog, [], "no type, no detect, nothing to yield for");
  }
});

/** The corpus stubs, then two marker stubs, all wrapped; once, after the empty-registry test. */
let ready = false;
function setup() {
  if (ready) return;
  ready = true;
  registerCorpusTypes();
  registerDoctype(stub("g88_likely", "LIKELY-MARK", CONFIDENCE.LIKELY));
  registerDoctype(stub("g88_certain", "CERTAIN-MARK", CONFIDENCE.CERTAIN));
  wrapAll();
}

test("R39 the twin yields before the first detect and between every two, in the main walk, on a text over 256 KiB with no match", async () => {
  setup();
  const r = await both({ text: pad("a letter about nothing", AT + 1) });
  same(r, r, "no match");
  assert.equal(there(r.twin).confidence, CONFIDENCE.NONE);
  assertInterleaved(r.twinLog, "no match, main walk");
  assert.deepEqual(detects(r.twinLog), detects(r.syncLog), "the same types asked, in the same order, as doctypeFor asks");
  assert.equal(r.syncLog.includes("yield"), false, "doctypeFor never yields");
});

test("R39 R5 and in the also pass after a CERTAIN winner: types registered after the winner are asked with a yield before each", async () => {
  setup();
  const r = await both({ text: pad("MARKER-A plain", AT + 1) });
  same(r, r, "certain winner");
  assert.equal(there(r.twin).type.key, "g48_marker_a");
  const d = detects(r.twinLog);
  const all = doctypes().length;
  const winnerSlot = doctypes().findIndex((m) => m.key === "g48_marker_a") + 1;
  const fallbacksAfter = doctypes().slice(winnerSlot).filter((m) => m.fallback === true).length;
  assert.equal(d.length, all - fallbacksAfter, "the walk to the winner, then the also pass over every member after it but a fallback, each asked once");
  assertInterleaved(r.twinLog, "certain winner, main walk and also pass");
  // a type after the winner that matches is in also, with its own yield before its detect
  const r2 = await both({ text: pad("MARKER-A CERTAIN-MARK", AT + 1) });
  same(r2, r2, "winner and a later match");
  assert.deepEqual(there(r2.twin).also.map((x) => x.key), ["g88_certain"]);
  assertInterleaved(r2.twinLog, "certain winner with a later match");
});

test("R39 the threshold: no yield at 256 KiB - 1 and 256 KiB characters, yields at 256 KiB + 1; the answer is the same at each", async () => {
  setup();
  /** @type {[number, boolean][]} */
  const sizes = [[AT - 1, false], [AT, false], [AT + 1, true]];
  for (const [n, yields] of sizes) {
    const r = await both({ text: pad("MARKER-B tail", n) });
    const twin = r.twin;
    assert.equal(twin && twin.type.key, "g48_marker_b");
    same(r, r, `${n}`);
    assert.equal(r.twinLog.includes("yield"), yields, `${n} characters`);
    if (yields) assertInterleaved(r.twinLog, `${n}`);
    else assert.deepEqual(r.twinLog, detects(r.twinLog), `${n}: the detects alone, no yield`);
  }
});

const LIKELY_BEST_BY_RANK = "just MAYBE here and LIKELY-MARK";
/** Each shape of text by name. @type {ReadonlyArray<readonly [string, string]>} */
const TEXTS = [
  ["minutes-like", "MEMORANDUM\nMINUTES of the meeting\nPA-101 ITEMS\n"],
  ["agenda-like", "AGENDA\nItem 1\nItem 2\nMARKER-B\n"],
  ["regulation-like", "Section 4.2 It is ordained that\nMARKER-A\n"],
  ["no match", "a letter about nothing in particular"],
  ["certain winner mid-list", "MARKER-A and MAYBE and CERTAIN-MARK"],
  ["likely best by rank", LIKELY_BEST_BY_RANK],
  ["certain after likely", "MAYBE and MARKER-B"],
  ["empty", ""],
];

test("R39 R4 R5 the answer deep-equals doctypeFor's, over a long and a short text of each shape", async () => {
  setup();
  for (const [name, body] of TEXTS) {
    for (const n of [body.length, AT + 1]) {
      const r = await both({ text: pad(body, n) });
      same(r, r, `${name} at ${n}`);
      assert.equal(r.syncErr, undefined);
      assert.equal(there(r.twin).type, there(r.sync).type, `${name}: the very type`);
    }
  }
  const lik = await both({ text: pad(LIKELY_BEST_BY_RANK, AT + 1) });
  assert.equal(there(lik.twin).confidence, CONFIDENCE.LIKELY, "a LIKELY best-by-rank winner");
  assertInterleaved(lik.twinLog, "likely winner");
});

test("R39 R5 a throwing detect: in the main walk it propagates from both; in the also pass it is recorded, never thrown", async () => {
  setup();
  const main = await both({ text: pad("BOOM", AT + 1) });
  const { twinErr } = main;
  assert.ok(main.syncErr && main.twinErr, "both throw");
  same(main, main, "throw in the main walk");
  assert.match(String(messageOf(twinErr)), /g48 boom/);
  const also = await both({ text: pad("MARKER-A and BOOM", AT + 1) });
  assert.equal(also.syncErr, undefined);
  assert.equal(also.twinErr, undefined);
  same(also, also, "throw in the also pass");
  const rec = there(there(also.twin).also.find((x) => x.key === "g48_throws"));
  assert.deepEqual([rec.confidence, rec.signals, "error" in rec ? rec.error : undefined], [null, [], "g48 boom"]);
});

test("R39 a fallback member after the winner is not asked in the also pass, and the fallback answers a no-match the way doctypeFor's does", async () => {
  setup();
  const r = await both({ text: pad("MARKER-A plain", AT + 1) });
  const fb = doctypes().filter((m) => m.fallback === true).map((m) => m.key);
  assert.ok(fb.length >= 1);
  const askedTwice = detects(r.twinLog).filter((e, i, a) => a.indexOf(e) !== i);
  assert.deepEqual(askedTwice, [], "each type asked at most once (R5)");
  const none = await both({ text: pad("nothing", AT + 1) });
  assert.equal(there(none.twin).type, there(none.sync).type);
  assert.equal(there(none.twin).why, there(none.sync).why);
});

test("R39 a yieldNow that is missing, not a function, throws or rejects gives the same answer; with none it never suspends", async () => {
  setup();
  const text = pad("MARKER-A CERTAIN-MARK", AT + 1);
  log = [];
  const want = doctypeFor({ text });
  const detectsAlone = detects(log);
  /** @type {[string, YieldOptions | undefined][]} */
  const given = [["undefined", undefined], ["empty", {}], ["a string", { yieldNow: "now" }], ["null", { yieldNow: null }],
      ["throws", { yieldNow() { throw new Error("no"); } }],
      ["rejects", { yieldNow: () => Promise.reject(new Error("no")) }],
      ["async throws", { yieldNow: async () => { throw new Error("no"); } }]];
  for (const [name, opts] of given) {
    log = [];
    assert.deepEqual(await doctypeForYielding({ text }, opts), want, name);
    assert.deepEqual(detects(log), detectsAlone, name);
  }
  // with no yieldNow function it never suspends: the whole walk has run when the call returns, before any turn of the loop
  log = [];
  const loop = { turned: false };
  setImmediate(() => { loop.turned = true; });
  const p = doctypeForYielding({ text }, undefined);
  assert.deepEqual(detects(log), detectsAlone, "the walk ran synchronously inside the call");
  await p;
  assert.equal(loop.turned, false, "and no turn of the loop was taken");
});

test("R39 a text at or under 256 KiB never suspends even with a yieldNow, and the threshold counts characters of ctx.text only", async () => {
  setup();
  let yields = 0;
  const yieldNow = async () => { yields++; };
  /** @type {DoctypeContext[]} */
  const ctxs = [{ text: pad("MARKER-A", AT) }, { text: "short" }, {}, { text: 12345 }, { text: null }];
  for (const ctx of ctxs) {
    yields = 0;
    const want = doctypeFor(ctx);
    assert.deepEqual(await doctypeForYielding(ctx, { yieldNow }), want);
    assert.equal(yields, 0);
  }
  yields = 0;
  await doctypeForYielding({ text: pad("MARKER-A", AT + 1) }, { yieldNow });
  assert.ok(yields >= 2, `${yields} yields`);
});

test("R39 doctypeFor stays synchronous and the twin leaves ctx unchanged", async () => {
  setup();
  /** @type {DoctypeContext} */
  const ctx = { text: pad("MARKER-A", AT + 1), kind: "x" };
  const frozen = JSON.stringify(ctx);
  /** @type {object} */
  const r = doctypeFor(ctx);
  /** @type {{ readonly then?: unknown }} */
  const answer = r;
  assert.equal(typeof answer.then, "undefined", "doctypeFor returns the answer, not a promise");
  const t = doctypeForYielding(ctx, { yieldNow: countingYield });
  assert.equal(typeof t.then, "function");
  await t;
  assert.equal(JSON.stringify(ctx), frozen);
});
