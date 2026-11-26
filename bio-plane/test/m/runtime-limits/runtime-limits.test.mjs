/* runtime-limits: requirement-named tests at the module's interface
 * (build/requirements/runtime-limits.md). Each test names the requirement id it
 * checks in its title. No network, no store and no real clock is relied on:
 * cpuProbe is driven by an injected `now` or the runner's mock clock, and the tokens are fresh random values. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as cpu from "../../../src/cpu.mjs";
import * as tokens from "../../../src/tokens.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/** @import { Segment } from "../../../src/cpu.mjs" */
/** @import { Bindings, InstanceStatus } from "../../../src/tokens.mjs" */

const { makeMeter, burn, cpuProbe } = cpu;
const {
  sha256hex, liveToken, PUBLISHED_TOKEN_HASHES, instanceClaudeStatus, instanceClaudeToken, instanceAiCredential,
  unattendedCredential,
  INSTANCE_AI_BINDING, CASCADE_UNSET, CASCADE_PUBLISHED, INSTANCE_AI_UNSET, INSTANCE_AI_PUBLISHED,
} = tokens;

/* a value never published: distinct on every call, and never one of the denylist's */
let made = 0;
const fresh = () => "tok-" + String(++made).padStart(48, "0");
/** @param {string} s */
const nodeHash = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

/** Runs `fn` with `v` published (its hash on the denylist), then takes it off again.
 *  @template T
 *  @param {string} v
 *  @param {() => Promise<T>} fn
 *  @returns {Promise<T>} */
async function published(v, fn) {
  const h = await sha256hex(v);
  PUBLISHED_TOKEN_HASHES.add(h);
  try { return await fn(); } finally { PUBLISHED_TOKEN_HASHES.delete(h); }
}

/** An env that records every key asked of it (a read, a probe, a descriptor or the list of keys) and answers
 *  nothing, so a test can show that a service asks nothing of the env it is given.
 *  @param {string[]} reads
 *  @returns {Bindings} */
function watched(reads) {
  return new Proxy({}, {
    get(_t, k) { reads.push(String(k)); return undefined; },
    has(_t, k) { reads.push(String(k)); return false; },
    getOwnPropertyDescriptor(_t, k) { reads.push(String(k)); return undefined; },
    ownKeys() { reads.push("<keys>"); return []; },
  });
}
/** An env whose every read and probe throws. */
const hostile = () => new Proxy({}, { get() { throw new Error("read"); }, has() { throw new Error("has"); } });

/** The one answer the instance level gives (R13), and the env values that must all receive it.
 *  @param {InstanceStatus} st */
const NO_ACCOUNT = (st) => {
  assert.deepEqual(Object.keys(st).sort(), ["configured", "detail", "level", "reason"]);
  assert.equal(st.level, "instance");
  assert.equal(st.configured, false);
  assert.equal(st.reason, CASCADE_UNSET);
  assert.equal(typeof st.detail, "string");
};
/** @param {string} v @returns {unknown[]} */
const claudeEnvs = (v) => [undefined, null, {}, 0, "x", [], { INSTANCE_CLAUDE_TOKEN: "" },
  { INSTANCE_CLAUDE_TOKEN: undefined }, { INSTANCE_CLAUDE_TOKEN: 5 }, { INSTANCE_CLAUDE_TOKEN: v },
  { INSTANCE_CLAUDE_TOKEN: "sk-ant-anything" }, { INSTANCE_CLAUDE_TOKEN: " " }, { instance_claude_token: v },
  { INSTANCE_AI_TOKEN: v }, { ANTHROPIC_API_KEY: v, CLAUDE_CODE_OAUTH_TOKEN: v },
  { INSTANCE_CLAUDE_TOKEN: v, INSTANCE_AI_TOKEN: v, DAEMON_TOKEN: v, ADMIN_TOKEN: v }];

/** @typedef {(string | number)[]} Event a step of a probe as the test saw it: ["now", v], ["checkpoint", step, ms], ["resolved", step] */
/** A `now` that returns the listed values in turn and records each call as an event.
 *  @param {number[]} values
 *  @param {Event[]} events
 *  @returns {() => number} */
function clock(values, events) {
  let i = 0;
  return () => { const v = values[Math.min(i, values.length - 1)] ?? 0; i++; events.push(["now", v]); return v; };
}
/** Lets every microtask already queued, and those they queue, run; no timer is used. */
const settle = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };

/* ------------------------------------------------------------------ makeMeter */

test("R1: makeMeter returns an object with sync, cpuAwait and report methods", () => {
  const m = makeMeter();
  assert.equal(typeof m.sync, "function", "sync");
  assert.equal(typeof m.cpuAwait, "function", "cpuAwait");
  assert.equal(typeof m.report, "function", "report");
  assert.notEqual(makeMeter(), m, "each call makes a new meter");
});

test("R2: sync and cpuAwait count one call per use under the label, add finite bytes only, count before fn runs, return fn's result", async () => {
  const m = makeMeter();
  /** @type {Segment | undefined} */
  let seenInside;
  const r1 = m.sync("parse", () => { seenInside = m.report().segments.parse; return 7; }, 10);
  assert.equal(r1, 7);
  assert.deepEqual(seenInside, { calls: 1, bytes: 10 }, "counted before fn ran");
  assert.equal(m.sync("parse", () => "x"), "x");
  /** @type {unknown[]} */
  const notCounted = [NaN, Infinity, -Infinity, "5", null, undefined, {}, 5n];
  for (const b of notCounted) m.sync("parse", () => 0, b);
  m.sync("parse", () => 0, -3);
  m.sync("parse", () => 0, 2.5);
  assert.deepEqual(m.report().segments.parse, { calls: 12, bytes: 9.5 });

  /** @type {Segment | undefined} */
  let awaitedInside;
  const r2 = await m.cpuAwait("hash", async () => { awaitedInside = m.report().segments.hash; return "d"; }, 4);
  assert.equal(r2, "d", "cpuAwait awaits fn and returns its value");
  assert.deepEqual(awaitedInside, { calls: 1, bytes: 4 });
  assert.equal(await m.cpuAwait("hash", () => 3), 3, "a synchronous fn is also accepted");
  assert.deepEqual(m.report().segments.hash, { calls: 2, bytes: 4 });

  // A throwing or rejecting fn still leaves its call counted, and its error propagates unchanged.
  const boom = new Error("boom");
  /** @param {unknown} e */
  const isBoom = (e) => e === boom;
  assert.throws(() => m.sync("bad", () => { throw boom; }, 1), isBoom);
  await assert.rejects(m.cpuAwait("bad", async () => { throw boom; }, 2), isBoom);
  await assert.rejects(m.cpuAwait("bad", () => Promise.reject(boom)), isBoom);
  assert.deepEqual(m.report().segments.bad, { calls: 3, bytes: 3 });
});

test("R3: report returns the sums over every label, a copy of the segments, measured_ms null and a note that these are counts", async () => {
  const m = makeMeter();
  assert.deepEqual({ ...m.report(), note: undefined },
    { work_calls: 0, work_bytes: 0, segments: {}, measured_ms: null, note: undefined });
  m.sync("a", () => 0, 100); m.sync("a", () => 0, 50); m.sync("b", () => 0);
  await m.cpuAwait("c", async () => 0, 7);
  m.sync("__proto__", () => 0, 1); m.sync("constructor", () => 0, 2);
  const r = m.report();
  const segs = new Map(Object.entries(r.segments));
  assert.deepEqual(Object.keys(r).sort(), ["measured_ms", "note", "segments", "work_bytes", "work_calls"]);
  assert.equal(r.work_calls, 6);
  assert.equal(r.work_bytes, 160);
  assert.deepEqual(Object.keys(r.segments).sort(), ["__proto__", "a", "b", "c", "constructor"].sort());
  assert.deepEqual(segs.get("a"), { calls: 2, bytes: 150 });
  assert.deepEqual(segs.get("b"), { calls: 1, bytes: 0 });
  assert.deepEqual(segs.get("c"), { calls: 1, bytes: 7 });
  assert.deepEqual(segs.get("__proto__"), { calls: 1, bytes: 1 }, "an own segment, not the report's prototype");
  assert.deepEqual(segs.get("constructor"), { calls: 1, bytes: 2 });
  assert.equal(r.measured_ms, null);
  assert.equal(typeof r.note, "string");
  assert.match(r.note, /count/i);
  assert.match(r.note, /not times/i);
  assert.match(r.note, /Cloudflare/);
  assert.match(r.note, /freez/i);
  assert.match(r.note, /synchronous/i);

  // A copy: the report is a fixed reading, independent of the meter in both directions.
  const a = r.segments.a;
  assert.ok(a);
  a.calls = 999; r.segments.z = { calls: 1, bytes: 1 };
  m.sync("a", () => 0, 1);
  assert.deepEqual(r.segments.a, { calls: 999, bytes: 150 }, "a later call does not change an earlier report");
  const r2 = m.report();
  assert.deepEqual(r2.segments.a, { calls: 3, bytes: 151 }, "changing a report does not change the meter");
  assert.equal(r2.segments.z, undefined);
  assert.equal(r2.work_calls, 7);
  // Meters are independent of each other.
  assert.equal(makeMeter().report().work_calls, 0);
});

/* ------------------------------------------------------------------ burn */

test("R4: burn runs the same fixed arithmetic every time and never throws", () => {
  // The loop's own recurrence, x = (x * 1103515245 + 12345) % 2147483647 from x = 1, in IEEE doubles.
  /** @param {number} n */
  const expect = (n) => { let x = 1; for (let i = 0; i < n; i++) x = (x * 1103515245 + 12345) % 2147483647; return x; };
  for (const n of [0, 1, 2, 3, 10, 1000, 123457]) {
    assert.equal(burn(n), expect(n), `iterations ${n}`);
    assert.equal(burn(n), burn(n), "the same iterations, the same result");
  }
  assert.equal(typeof burn(5), "number");
  /** @type {unknown[]} */
  const bads = [-1, NaN, undefined, null, "12", Symbol("s"), {}, { valueOf() { throw new Error("x"); } }, 3n];
  for (const bad of bads) {
    assert.doesNotThrow(() => burn(bad), String(typeof bad));
    assert.equal(typeof burn(bad), "number");
  }
});

/* ------------------------------------------------------------------ cpuProbe */

test("R5: cpuProbe's defaults are startStep 0, maxStep 40, budgetMs 20,000, now Date.now, iterationsPerStep 2,000,000; checkpoint has none", async (t) => {
  // startStep 0 and maxStep 40: a clock that never moves runs steps 1..40 and stops there.
  /** @type {number[]} */
  const steps = [];
  const r = await cpuProbe({ checkpoint: (s) => { steps.push(s); }, now: () => 0, iterationsPerStep: 1 });
  assert.deepEqual(steps, Array.from({ length: 40 }, (_, i) => i + 1));
  assert.equal(r.completed, 40);

  // budgetMs 20,000: 19,999 elapsed goes on, 20,000 stops.
  /** @type {Event[]} */
  const ev1 = [];
  const b1 = await cpuProbe({ checkpoint: () => {}, now: clock([0, 19_999, 20_000], ev1), iterationsPerStep: 1 });
  assert.deepEqual(b1, { completed: 2, elapsed_ms: 20_000, reason: "BUDGET_REACHED" });

  // now defaults to Date.now, read at call time: under the runner's mock clock, each checkpoint moves it 7,000 ms on.
  t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
  try {
    /** @type {number[]} */
    const seen = [];
    const d = await cpuProbe({ checkpoint: (_s, ms) => { seen.push(ms); t.mock.timers.tick(7_000); }, iterationsPerStep: 1, maxStep: 10 });
    assert.deepEqual(d, { completed: 4, elapsed_ms: 21_000, reason: "BUDGET_REACHED" });
    assert.deepEqual(seen, [0, 7_000, 14_000, 21_000], "Date.now read once at the start and once per step");
  } finally { t.mock.timers.reset(); }

  // checkpoint has no default: leaving it out is refused.
  await assert.rejects(cpuProbe({ now: () => 0 }), TypeError);

  // iterationsPerStep 2,000,000: a step's work is observable only as CPU time, so the default
  // step is compared with explicit steps of 1, 2 and 4 million, by process CPU time over 3 steps (median of 3).
  /** @param {number} [iterationsPerStep] absent is the default @returns {Promise<number>} */
  const cost = async (iterationsPerStep) => {
    /** @type {number[]} */
    const runs = [];
    for (let k = 0; k < 3; k++) {
      const c0 = process.cpuUsage();
      if (iterationsPerStep === undefined) await cpuProbe({ checkpoint: () => {}, now: () => 0, maxStep: 3 });
      else await cpuProbe({ checkpoint: () => {}, now: () => 0, maxStep: 3, iterationsPerStep });
      const c = process.cpuUsage(c0);
      runs.push(c.user + c.system);
    }
    return runs.sort((a, b) => a - b)[1] ?? 0;
  };
  await cost(); // warm the loop
  const c1 = await cost(1_000_000), c2 = await cost(2_000_000);
  const cd = await cost(), c4 = await cost(4_000_000);
  /** @param {number} a @param {number} b */
  const d = (a, b) => Math.abs(Math.log(a / b));
  assert.ok(d(cd, c2) < d(cd, c1) && d(cd, c2) < d(cd, c4),
    `default step costs ${cd}µs: nearest 2M (${c2}µs), not 1M (${c1}µs) or 4M (${c4}µs)`);
});

test("R6: cpuProbe reads now once as t0, then per step burns, measures and awaits checkpoint(step + 1, elapsed) before the next step", async () => {
  /** @type {Event[]} */
  const events = [];
  const now = clock([100, 101, 103, 106, 110], events);
  /** @type {(() => void)[]} */
  const gates = [];
  /** @param {number} s @param {number} e @returns {Promise<void>} */
  const checkpoint = (s, e) => {
    events.push(["checkpoint", s, e]);
    return new Promise((res) => gates.push(() => { events.push(["resolved", s]); res(); }));
  };
  const p = cpuProbe({ checkpoint, startStep: 5, maxStep: 9, iterationsPerStep: 10, budgetMs: 1e9, now });
  // Each checkpoint is left pending until the test resolves it: no further now() (hence no burn) may happen.
  for (let k = 0; k < 4; k++) {
    await settle();
    assert.equal(gates.length, k + 1, `step ${k + 1} has checkpointed and waits`);
    assert.deepEqual(events.at(-1)?.[0], "checkpoint", "nothing ran while the checkpoint was pending");
    gates[k]?.();
  }
  const r = await p;
  assert.deepEqual(events, [
    ["now", 100],
    ["now", 101], ["checkpoint", 6, 1], ["resolved", 6],
    ["now", 103], ["checkpoint", 7, 3], ["resolved", 7],
    ["now", 106], ["checkpoint", 8, 6], ["resolved", 8],
    ["now", 110], ["checkpoint", 9, 10], ["resolved", 9],
  ]);
  assert.deepEqual(r, { completed: 9, elapsed_ms: 10, reason: "MAX_STEP_REACHED" });

  // A checkpoint that throws or rejects ends the probe with that error, and no further step runs.
  const boom = new Error("store down");
  /** @param {unknown} e */
  const isBoom = (e) => e === boom;
  for (const cp of [() => { throw boom; }, async () => { throw boom; }]) {
    /** @type {Event[]} */
    const ev = [];
    await assert.rejects(cpuProbe({ checkpoint: cp, now: clock([0, 1, 2, 3], ev), iterationsPerStep: 1 }), isBoom);
    assert.equal(ev.length, 2, "t0 and the one step's reading, nothing after");
  }
  // Not callable: refused before the clock is read or any step is burned.
  for (const bad of [undefined, null, 1, "f", {}]) {
    /** @type {Event[]} */
    const ev = [];
    await assert.rejects(cpuProbe({ checkpoint: bad, now: clock([0], ev) }), TypeError);
    assert.equal(ev.length, 0);
  }
  await assert.rejects(cpuProbe(), TypeError);
});

test("R7: after the first checkpointed step whose elapsed reaches budgetMs, cpuProbe returns BUDGET_REACHED and starts no other step", async () => {
  /** @type {[number[], number, { completed: number, elapsed_ms: number, reason: string }][]} */
  const cases = [
    [[0, 5, 10, 15], 10, { completed: 2, elapsed_ms: 10, reason: "BUDGET_REACHED" }],
    [[0, 5, 12], 10, { completed: 2, elapsed_ms: 12, reason: "BUDGET_REACHED" }],
    [[50, 50], 0, { completed: 1, elapsed_ms: 0, reason: "BUDGET_REACHED" }],
    [[0, 30], 10, { completed: 1, elapsed_ms: 30, reason: "BUDGET_REACHED" }],
  ];
  for (const [readings, budget, expect] of cases) {
    /** @type {Event[]} */
    const ev = [];
    /** @type {[number, number][]} */
    const cps = [];
    const r = await cpuProbe({ checkpoint: async (s, e) => { cps.push([s, e]); }, now: clock(readings, ev),
      budgetMs: budget, iterationsPerStep: 1, maxStep: 40 });
    assert.deepEqual(r, expect);
    assert.equal(cps.length, expect.completed, "the budget step was checkpointed, and nothing after it");
    assert.deepEqual(cps.at(-1), [expect.completed, expect.elapsed_ms]);
    assert.equal(ev.length, expect.completed + 1, "no further reading, so no further step");
  }
  // From a later start step, `completed` is the absolute step number.
  const r = await cpuProbe({ checkpoint: () => {}, now: clock([0, 1, 9], []), budgetMs: 9, startStep: 20, iterationsPerStep: 1 });
  assert.deepEqual(r, { completed: 22, elapsed_ms: 9, reason: "BUDGET_REACHED" });
});

test("R8: reaching maxStep under budget returns MAX_STEP_REACHED with maxStep and the last completed step's elapsed", async () => {
  /** @type {Event[]} */
  const ev = [];
  /** @type {[number, number][]} */
  const cps = [];
  const r = await cpuProbe({ checkpoint: (s, e) => { cps.push([s, e]); }, now: clock([0, 2, 4, 6, 999], ev),
    maxStep: 3, budgetMs: 100, iterationsPerStep: 1 });
  assert.deepEqual(r, { completed: 3, elapsed_ms: 6, reason: "MAX_STEP_REACHED" });
  assert.deepEqual(cps, [[1, 2], [2, 4], [3, 6]]);
  assert.equal(ev.length, 4, "the clock is not read again after the last step");
  // Resumed at a later start step.
  const r2 = await cpuProbe({ checkpoint: () => {}, now: clock([10, 11, 13], []), startStep: 38, maxStep: 40,
    budgetMs: 100, iterationsPerStep: 1 });
  assert.deepEqual(r2, { completed: 40, elapsed_ms: 3, reason: "MAX_STEP_REACHED" });
  // A probe started at maxStep has no step to run: it checkpoints nothing and reports maxStep.
  /** @type {number[]} */
  const cps3 = [];
  const r3 = await cpuProbe({ checkpoint: (s) => { cps3.push(s); }, now: clock([5, 77], []), startStep: 40, maxStep: 40 });
  assert.deepEqual(r3, { completed: 40, elapsed_ms: 0, reason: "MAX_STEP_REACHED" });
  assert.deepEqual(cps3, []);
});

/* ------------------------------------------------------------------ sha256hex */

test("R9: sha256hex is the SHA-256 of the UTF-8 encoding, 64 lowercase hex characters, for any string", async () => {
  assert.equal(await sha256hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(await sha256hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  for (const s of ["", "abc", "é", "日本語", "😀", "a\u0000b", "x".repeat(100_000), fresh(), "\ud800"]) {
    const h = await sha256hex(s);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, nodeHash(s), JSON.stringify(s.slice(0, 20)));
  }
});

/* ------------------------------------------------------------------ liveToken */

test("R10: liveToken is false for a non-string or the empty string", async () => {
  /** @type {unknown[]} */
  const values = [undefined, null, 0, 1, true, false, {}, [], ["x"], 12n, Symbol("t"), () => "x", new String("abc"), ""];
  for (const v of values) assert.equal(await liveToken(v), false, typeof v);
});

test("R11: liveToken is false exactly when the value's hash is published, true otherwise", async () => {
  const v = fresh();
  assert.equal(await liveToken(v), true);
  assert.equal(await liveToken(" "), true, "any non-empty unpublished string, whatever its shape");
  await published(v, async () => assert.equal(await liveToken(v), false));
  assert.equal(await liveToken(v), true);
});

/* ------------------------------------------------------------------ PUBLISHED_TOKEN_HASHES */

test("R12: PUBLISHED_TOKEN_HASHES is an exported Set of SHA-256 hex; membership decides every service as liveToken does", async () => {
  assert.ok(PUBLISHED_TOKEN_HASHES instanceof Set);
  assert.ok(PUBLISHED_TOKEN_HASHES.size > 0);
  for (const h of PUBLISHED_TOKEN_HASHES) assert.match(h, /^[0-9a-f]{64}$/);
  for (const v of [fresh(), fresh()]) {
    const direct = async () => !PUBLISHED_TOKEN_HASHES.has(await sha256hex(v));
    assert.equal(await direct(), await liveToken(v));
    assert.equal((await instanceAiCredential({ INSTANCE_AI_TOKEN: v })).token, v);
    assert.equal(await unattendedCredential({ DAEMON_TOKEN: v }).token(), v);
    const empty = async () => ({ ai: await instanceAiCredential({ INSTANCE_AI_TOKEN: "" }),
      un: await unattendedCredential({ DAEMON_TOKEN: "", ADMIN_TOKEN: "" }).token(), cs: await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: "" }),
      ct: await instanceClaudeToken({ INSTANCE_CLAUDE_TOKEN: "" }) });
    await published(v, async () => {
      assert.equal(await direct(), false);
      assert.equal(await direct(), await liveToken(v));
      // Published is treated as not set by every credential service: each answers exactly as for the empty value
      // (the AI credential's reason alone names publication, R19).
      const { ai, un, cs, ct } = await empty();
      assert.deepEqual(await instanceAiCredential({ INSTANCE_AI_TOKEN: v }), { token: null, reason: INSTANCE_AI_PUBLISHED });
      assert.equal(ai.token, null);
      assert.equal(await unattendedCredential({ DAEMON_TOKEN: v, ADMIN_TOKEN: v }).token(), un);
      assert.deepEqual(await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: v }), cs);
      assert.equal(await instanceClaudeToken({ INSTANCE_CLAUDE_TOKEN: v }), ct);
    });
  }
});

/* ------------------------------------------------------------------ instanceClaudeStatus */

test("R13: instanceClaudeStatus answers not configured, CASCADE_UNSET, with a detail naming a member's own account or the group's API key in credentials, for every env; it reads nothing from env and no binding name is exported", async () => {
  const v = fresh();
  /** @type {string[]} */
  const answers = [];
  /** @param {unknown} env */
  const check = async (env) => {
    const st = await instanceClaudeStatus(env);
    NO_ACCOUNT(st);
    answers.push(JSON.stringify(st));
  };
  for (const env of claudeEnvs(v)) await check(env);
  await published(v, async () => { for (const env of claudeEnvs(v)) await check(env); });
  await check(hostile());
  await check(undefined);
  assert.equal(new Set(answers).size, 1, "one answer, whatever env carries");
  // Nothing is asked of the env: no binding is read, probed or listed.
  /** @type {string[]} */
  const reads = [];
  NO_ACCOUNT(await instanceClaudeStatus(watched(reads)));
  await published(v, async () => NO_ACCOUNT(await instanceClaudeStatus(watched(reads))));
  assert.deepEqual(reads, [], "no binding is read from env");
  // The detail says where the assistant's account comes from instead (K1755): a member's own Claude account or API
  // key, or the group's API key, each held in credentials, never a binding of the copy.
  const { detail } = await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: v });
  assert.equal(detail, word("tokens.group_civicsmith_binds"), "K3810: the sentence is the word table's");
  // It claims no limit of Anthropic's plans (K1761, K1763): the retired "serves only its own holder" is gone, and
  // nothing says the group can hold no account at all.
  assert.doesNotMatch(String(detail), /serves only|only its own holder|subscription/i);
  assert.doesNotMatch(String(detail), /holds no Claude account/i);
  assert.ok(!("INSTANCE_CLAUDE_BINDING" in tokens), "INSTANCE_CLAUDE_BINDING is no longer exported");
  /** @type {string[]} every text the module exports (its export surface is pinned whole by R23's test) */
  const texts = [CASCADE_UNSET, CASCADE_PUBLISHED, INSTANCE_AI_UNSET, INSTANCE_AI_PUBLISHED, INSTANCE_AI_BINDING];
  assert.ok(!texts.includes("INSTANCE_CLAUDE_TOKEN"), "no export names the retired binding");
  // A fresh answer each call: changing one answer changes no later one.
  const st = await instanceClaudeStatus({});
  st.configured = true; st.detail = null;
  NO_ACCOUNT(await instanceClaudeStatus({}));
});

test("R13 (DEC-149 sweep, tokens.mjs:62): the detail says \"Your group's Civicsmith\", never \"the plane\", \"the instance\" or \"this group's copy\"", async () => {
  const v = fresh();
  for (const env of [{}, { INSTANCE_CLAUDE_TOKEN: v }]) {
    const { detail } = await instanceClaudeStatus(env);
    assert.equal(detail, word("tokens.group_civicsmith_binds"), String(detail));
    assert.doesNotMatch(String(detail), /\bthe plane\b|\bthe instance\b|\bcopy\b|This group's/i);
  }
  // The sweep's old string is gone.
  assert.ok(!String((await instanceClaudeStatus({})).detail).includes("This group's copy holds no Claude account"));
});

test("R16: detail is null exactly when configured, a string otherwise, and no status ever carries the value", async () => {
  const v = fresh();
  /** @type {InstanceStatus[]} */
  const cases = [];
  for (const env of claudeEnvs(v)) cases.push(await instanceClaudeStatus(env));
  await published(v, async () => { for (const env of claudeEnvs(v)) cases.push(await instanceClaudeStatus(env)); });
  for (const st of cases) {
    assert.equal(st.detail === null, st.configured === true);
    if (!st.configured) assert.equal(typeof st.detail, "string");
    assert.ok(!JSON.stringify(st).includes(v), "the value is never in the status");
    assert.ok(![st.level, st.configured, st.reason, st.detail].some((x) => x === v));
  }
});

/* ------------------------------------------------------------------ instanceClaudeToken */

test("R17: instanceClaudeToken is null for every env, agreeing with instanceClaudeStatus, and reads nothing from env", async () => {
  const v = fresh();
  /** @param {unknown} env */
  const check = async (env) => {
    const st = await instanceClaudeStatus(env);
    const tok = await instanceClaudeToken(env);
    assert.equal(tok, null);
    assert.equal(st.configured, false, "the status and the token agree");
  };
  for (const env of claudeEnvs(v)) await check(env);
  await published(v, async () => { for (const env of claudeEnvs(v)) await check(env); });
  await check(hostile());
  /** @type {string[]} */
  const reads = [];
  await check(watched(reads));
  await published(v, () => check(watched(reads)));
  assert.deepEqual(reads, [], "no Claude credential is read from the copy's bindings");
  assert.ok((await Promise.resolve(instanceClaudeToken({ INSTANCE_CLAUDE_TOKEN: v }))) === null);
  assert.ok(instanceClaudeToken({}) instanceof Promise, "answers a promise");
});

/* ------------------------------------------------------------------ instanceAiCredential */

test("R18: instanceAiCredential reads INSTANCE_AI_TOKEN; missing or empty is {token: null, reason: INSTANCE_AI_UNSET}", async () => {
  assert.equal(INSTANCE_AI_BINDING, "INSTANCE_AI_TOKEN");
  /** @type {(Bindings | null | undefined)[]} */
  const envs = [undefined, null, {}, { INSTANCE_AI_TOKEN: "" }, { INSTANCE_AI_TOKEN: undefined }, { INSTANCE_CLAUDE_TOKEN: fresh() }];
  for (const env of envs) {
    assert.deepEqual(await instanceAiCredential(env), { token: null, reason: INSTANCE_AI_UNSET });
  }
});

test("R19: instanceAiCredential on a published value is {token: null, reason: INSTANCE_AI_PUBLISHED}", async () => {
  const v = fresh();
  await published(v, async () =>
    assert.deepEqual(await instanceAiCredential({ INSTANCE_AI_TOKEN: v }), { token: null, reason: INSTANCE_AI_PUBLISHED }));
});

test("R20: instanceAiCredential on any other non-empty string returns it with reason null", async () => {
  for (const v of [fresh(), "aik-" + "0".repeat(64), "x", " "])
    assert.deepEqual(await instanceAiCredential({ INSTANCE_AI_TOKEN: v }), { token: v, reason: null });
});

/* ------------------------------------------------------------------ unattendedCredential */

/** @typedef {"missing" | "empty" | "live" | "published"} BindingState */

test("R26: unattendedCredential: bound is synchronous presence of DAEMON_TOKEN or ADMIN_TOKEN; token() is the first live of the two, else null; no value on the object; never throws or rejects", async () => {
  const d = fresh(), a = fresh();
  // Every combination of each binding's states: missing, empty, live, published.
  /** @type {BindingState[]} */
  const states = ["missing", "empty", "live", "published"];
  /** @param {BindingState} st @param {string} live @returns {string | undefined} */
  const valueOf = (st, live) => (st === "live" || st === "published" ? live : st === "empty" ? "" : undefined);
  /** @template T @param {string[]} vals @param {() => Promise<T>} fn @returns {Promise<T>} */
  const withPublished = async (vals, fn) => {
    const hs = await Promise.all(vals.map(sha256hex));
    hs.forEach((h) => PUBLISHED_TOKEN_HASHES.add(h));
    try { return await fn(); } finally { hs.forEach((h) => PUBLISHED_TOKEN_HASHES.delete(h)); }
  };
  for (const ds of states) for (const as of states) {
    /** @type {{ [binding: string]: string | undefined }} */
    const env = {};
    const dv = valueOf(ds, d), av = valueOf(as, a);
    if (ds !== "missing") env.DAEMON_TOKEN = dv;
    if (as !== "missing") env.ADMIN_TOKEN = av;
    /** @type {string[]} */
    const publishedNow = [];
    if (ds === "published") publishedNow.push(d);
    if (as === "published") publishedNow.push(a);
    await withPublished(publishedNow, async () => {
      const u = unattendedCredential(env);
      const label = `DAEMON ${ds}, ADMIN ${as}`;
      assert.deepEqual(Object.keys(u).sort(), ["bound", "token"], label);
      assert.equal(typeof u.bound, "boolean", label);
      // Presence only: a published value still binds.
      assert.equal(u.bound, (ds === "live" || ds === "published") || (as === "live" || as === "published"), label);
      assert.equal(typeof u.token, "function", label);
      const p = u.token();
      assert.ok(p instanceof Promise, label);
      const expect = ds === "live" ? d : as === "live" ? a : null;
      assert.equal(await p, expect, label);
      // The object never carries a credential's value: its only members are the boolean and the function above.
      assert.ok(!JSON.stringify(u).includes(d) && !JSON.stringify(u).includes(a), label);
    });
  }
  // bound is computed synchronously, when the object is made, without awaiting anything.
  const u = unattendedCredential({ DAEMON_TOKEN: d });
  assert.equal(u.bound, true);
  // Unrelated bindings are neither bound nor spent.
  /** @type {(Bindings | null | undefined)[]} */
  const unrelated = [undefined, null, {}, { INSTANCE_CLAUDE_TOKEN: d, INSTANCE_AI_TOKEN: a, MEMBER_TOKEN: d, PROBE_TOKEN: a },
    { daemon_token: d, admin_token: a }];
  for (const env2 of unrelated) {
    const x = unattendedCredential(env2);
    assert.equal(x.bound, false);
    assert.equal(await x.token(), null);
  }
  // A non-string value is never spent.
  for (const bad of [5, true, {}, ["x"], new String("abc")]) {
    assert.equal(await unattendedCredential({ DAEMON_TOKEN: bad, ADMIN_TOKEN: bad }).token(), null);
    assert.equal(await unattendedCredential({ DAEMON_TOKEN: bad, ADMIN_TOKEN: a }).token(), a);
  }
  // Never throws, and token() never rejects, even on an env whose reads throw.
  assert.doesNotThrow(() => unattendedCredential(hostile()));
  const h = unattendedCredential(hostile());
  assert.equal(h.bound, false);
  assert.equal(await h.token(), null);
});

/* ------------------------------------------------------------------ reason constants */

test("R21: the four reason constants have their stated values and are the only non-null reasons any service gives", async () => {
  assert.equal(CASCADE_UNSET, "NO_INSTANCE_ACCOUNT");
  assert.equal(CASCADE_PUBLISHED, "INSTANCE_ACCOUNT_REVOKED_BY_PUBLICATION");
  assert.equal(INSTANCE_AI_UNSET, "NO_INSTANCE_AI_CREDENTIAL");
  assert.equal(INSTANCE_AI_PUBLISHED, "INSTANCE_AI_CREDENTIAL_REVOKED_BY_PUBLICATION");
  /** @type {Set<string | null>} */
  const allowed = new Set([null, CASCADE_UNSET, CASCADE_PUBLISHED, INSTANCE_AI_UNSET, INSTANCE_AI_PUBLISHED]);
  const v = fresh();
  /** @type {unknown[]} */
  const values = [undefined, "", 7, {}, v, "y"];
  const reasons = async () => {
    /** @type {(string | null)[]} */
    const out = [];
    for (const x of values) {
      out.push((await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: x })).reason);
      out.push((await instanceAiCredential({ INSTANCE_AI_TOKEN: x })).reason);
    }
    return out;
  };
  const seen = [...await reasons(), ...await published(v, reasons)];
  for (const r of seen) assert.ok(allowed.has(r), String(r));
  // Every reason but CASCADE_PUBLISHED is reachable; that one is kept exported and stable, and no service gives it
  // since the instance level answers CASCADE_UNSET for every env (R13).
  for (const r of allowed) if (r !== null && r !== CASCADE_PUBLISHED) assert.ok(seen.includes(r), `${r} is reachable`);
  assert.ok(!seen.includes(CASCADE_PUBLISHED));
  // Stable across calls and across module loads.
  const again = await import("../../../src/tokens.mjs?again");
  assert.equal(again.CASCADE_UNSET, CASCADE_UNSET);
  assert.equal(again.CASCADE_PUBLISHED, CASCADE_PUBLISHED);
  assert.equal(again.INSTANCE_AI_UNSET, INSTANCE_AI_UNSET);
  assert.equal(again.INSTANCE_AI_PUBLISHED, INSTANCE_AI_PUBLISHED);
});

/* ------------------------------------------------------------------ invariants */

test("R22: pure — no clock outside cpuProbe's now: the same answer for the same inputs, whatever the clock shows", async (t) => {
  const v = fresh();
  const run = async () => {
    const m = makeMeter();
    m.sync("s", () => 1, 3); await m.cpuAwait("a", async () => 2, 4);
    const probe = await cpuProbe({ checkpoint: () => {}, now: clock([0, 1, 2], []), maxStep: 2, iterationsPerStep: 3 });
    return JSON.stringify([
      m.report(), burn(1000), probe, await sha256hex(v), await liveToken(v), await liveToken(""),
      await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: v }), await instanceClaudeStatus({}),
      await instanceClaudeToken({ INSTANCE_CLAUDE_TOKEN: v }), await instanceAiCredential({ INSTANCE_AI_TOKEN: v }),
      await instanceAiCredential({}), [...PUBLISHED_TOKEN_HASHES],
      unattendedCredential({ DAEMON_TOKEN: v }).bound, await unattendedCredential({ DAEMON_TOKEN: v }).token(),
    ]);
  };
  // Under the runner's mock clock, set to two times a year apart: an answer that read the clock would differ.
  t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
  try {
    const first = await run();
    t.mock.timers.tick(365 * 24 * 3_600_000);
    assert.equal(await run(), first, "the same inputs give the same answers, at any time");
  } finally { t.mock.timers.reset(); }
});

test("R23: nothing exported accepts or sets a credential; the env passed in is only read", async () => {
  // The whole export surface: services that read, the two binding names, the reasons and the denylist.
  assert.deepEqual(Object.keys(tokens).sort(), ["CASCADE_PUBLISHED", "CASCADE_UNSET", "INSTANCE_AI_BINDING",
    "INSTANCE_AI_PUBLISHED", "INSTANCE_AI_UNSET", "PUBLISHED_TOKEN_HASHES",
    "instanceAiCredential", "instanceClaudeStatus", "instanceClaudeToken", "liveToken", "sha256hex",
    "unattendedCredential"]);
  assert.deepEqual(Object.keys(cpu).sort(), ["burn", "cpuProbe", "makeMeter"]);
  // Every service called with a frozen env, in every state, leaves it untouched and writes nothing onto it.
  const v = fresh();
  /** @type {{ [binding: string]: string }[]} */
  const envs = [{}, { INSTANCE_CLAUDE_TOKEN: v, INSTANCE_AI_TOKEN: v, DAEMON_TOKEN: v, ADMIN_TOKEN: v },
    { INSTANCE_CLAUDE_TOKEN: "", INSTANCE_AI_TOKEN: "", DAEMON_TOKEN: "", ADMIN_TOKEN: "" }];
  /** @param {Bindings} env */
  const all = async (env) => {
    await instanceClaudeStatus(env); await instanceClaudeToken(env); await instanceAiCredential(env);
    await liveToken(env.INSTANCE_CLAUDE_TOKEN);
    await unattendedCredential(env).token();
  };
  for (const env of envs) {
    const before = JSON.stringify(env);
    const frozen = { ...env };
    Object.freeze(frozen);
    await all(frozen);
    await published(v, () => all(frozen));
    assert.equal(JSON.stringify(frozen), before);
    // A second env, never passed, is never seen: nothing is kept between calls.
    const withToken = await instanceAiCredential(frozen);
    assert.deepEqual(await instanceAiCredential({}), { token: null, reason: INSTANCE_AI_UNSET });
    assert.equal(await instanceClaudeToken({}), null);
    assert.ok(withToken);
  }
  // No Claude credential is read from env at all (K1502, K1755): a member's own account and the group's API key are
  // credentials'; with every binding present, the Claude services read nothing.
  {
    /** @type {string[]} */
    const reads = [];
    assert.equal(await instanceClaudeToken(watched(reads)), null);
    assert.equal((await instanceClaudeStatus(watched(reads))).configured, false);
    assert.deepEqual(reads, []);
  }
});

test("R24: report never states a duration for synchronous work: measured_ms is null and the note says why", async () => {
  for (const work of [0, 1, 50]) {
    const m = makeMeter();
    for (let i = 0; i < work; i++) m.sync("x", () => burn(10_000), 8);
    await m.cpuAwait("y", async () => 0);
    const r = m.report();
    assert.equal(r.measured_ms, null);
    assert.ok(!Object.values(r.segments).some((s) => Object.keys(s).some((k) => /ms|time|dur/i.test(k))),
      "no segment carries a time");
    assert.match(r.note, /freez/i);
    assert.match(r.note, /cannot measure/i);
  }
});

test("R25: no place is named in anything the module says, and no behaviour depends on one", async () => {
  const places = /oakland|alameda|california|\bbay area\b|san francisco|berkeley|\bCA\b/i;
  const v = fresh();
  /** @type {string[]} */
  const said = [];
  said.push(JSON.stringify(makeMeter().report()));
  said.push(JSON.stringify(await instanceClaudeStatus({})));
  said.push(JSON.stringify(await instanceClaudeStatus({ INSTANCE_CLAUDE_TOKEN: v })));
  await published(v, async () => said.push(JSON.stringify(await instanceAiCredential({ INSTANCE_AI_TOKEN: v }))));
  said.push(CASCADE_UNSET, CASCADE_PUBLISHED, INSTANCE_AI_UNSET, INSTANCE_AI_PUBLISHED, INSTANCE_AI_BINDING);
  for (const s of said) assert.doesNotMatch(s, places, s);
  // Values naming a place are treated like any other value.
  for (const t of ["oakland-token", "alameda-county", "springfield"]) {
    assert.equal(await liveToken(t), true);
    assert.equal(await unattendedCredential({ DAEMON_TOKEN: t }).token(), t);
    assert.deepEqual(await instanceAiCredential({ INSTANCE_AI_TOKEN: t }), { token: t, reason: null });
  }
});
