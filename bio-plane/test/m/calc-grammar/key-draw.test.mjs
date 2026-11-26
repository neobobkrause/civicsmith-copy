/* calc-grammar at its interface: result keys (R15), recorded draws (R16) and the exact interval (R17). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resultKey, draw, drawSliced, DRAW_SLICE, interval, METHOD } from "../../../src/calc-grammar/index.mjs";
import { isRefusal } from "../../../src/calc-grammar/decimal.mjs";

/** @import { Refusal } from "../../../src/calc-grammar/decimal.mjs" */
/** @import { Draw, Interval, IntervalArgs } from "../../../src/calc-grammar/draw.mjs" */

/** A string's SHA-256, its UTF-8 bytes hashed. @param {string} s @returns {string} */
const sha = (s) => createHash("sha256").update(s).digest("hex");
/** The draw a test expects; anything else fails. @param {Draw | Refusal} r @returns {Draw} */
const asDraw = (r) => ("sample" in r ? r : assert.fail(`not a draw: ${JSON.stringify(r)}`));
/** The interval a test expects; anything else fails. @param {Interval | Refusal} r @param {string} [message] @returns {Interval} */
const asInterval = (r, message) => ("low" in r ? r : assert.fail(message ?? `not an interval: ${JSON.stringify(r)}`));
/** The refusal a test expects; anything else fails. @param {Draw | Interval | Refusal} r @param {string} [message] @returns {Refusal} */
const asRefusal = (r, message) => (isRefusal(r) ? r : assert.fail(message ?? `not a refusal: ${JSON.stringify(r)}`));
const R = { method: METHOD, inputs: [{ name: "t", kind: "table" }], steps: [{ op: "count", as: "c", from: "t" }], output: "c" };

test("R15 the result key is SHA-256 of the canonical JSON of {recipe, inputs, method_version}: same in, same key; another method version, another key", () => {
  const h = { t: "a".repeat(64) };
  const k = resultKey(R, h);
  assert.match(k, /^[0-9a-f]{64}$/);
  const canonical = `{"inputs":{"t":"${"a".repeat(64)}"},"method_version":"${METHOD}","recipe":{"inputs":[{"kind":"table","name":"t"}],"method":"${METHOD}","output":"c","steps":[{"as":"c","from":"t","op":"count"}]}}`;
  assert.equal(k, sha(canonical));
  const reordered = { output: "c", steps: [{ from: "t", op: "count", as: "c" }], inputs: [{ kind: "table", name: "t" }], method: METHOD };
  assert.equal(resultKey(reordered, { t: "a".repeat(64) }), k);
  assert.notEqual(resultKey(R, { t: "b".repeat(64) }), k);
  assert.notEqual(resultKey({ ...R, output: "d" }, h), k);
  assert.notEqual(resultKey(R, h, { methodVersion: "bio-calc/1+1" }), k);
  assert.equal(resultKey(R, h, { methodVersion: METHOD }), k);
  assert.throws(() => resultKey(null, h), TypeError);
  assert.throws(() => resultKey(R, "x"), TypeError);
});

test("R16 a draw ranks every key by SHA-256 of the seed and the key and takes the first n: reproducible by any SHA-256 tool, with the frame's hash, the seed and the method", () => {
  const frame = Array.from({ length: 300 }, (_, i) => `ROW-${i}`);
  /** @type {[string, number][]} */
  const draws = [["2026-10-05 public draw", 25], ["x", 0], ["x", 300], ["ünïcode seed", 7]];
  for (const [seed, n] of draws) {
    const r = asDraw(draw({ frame, n, seed }));
    const want = [...frame].sort((a, b) => { const x = sha(`${seed}\n${a}`); const y = sha(`${seed}\n${b}`); return x < y ? -1 : x > y ? 1 : 0; }).slice(0, n);
    assert.deepEqual(r.sample, want);
    assert.equal(r.seed, seed);
    assert.equal(r.frame_hash, sha(JSON.stringify([...frame].sort())));
    assert.match(r.method, /sha256\(seed \+ "\\n" \+ key\)/);
    assert.deepEqual(draw({ frame: [...frame].reverse(), n, seed }), r, "the frame's order does not change the draw");
  }
  assert.notDeepEqual(asDraw(draw({ frame, n: 25, seed: "a" })).sample, asDraw(draw({ frame, n: 25, seed: "b" })).sample);
  assert.equal(asRefusal(draw({ frame, n: 301, seed: "x" })).refused, "DRAW_TOO_LARGE");
  assert.equal(asRefusal(draw({ frame, n: -1, seed: "x" })).refused, "DRAW_TOO_LARGE");
  assert.equal(asRefusal(draw({ frame: ["a", "b", "a"], n: 1, seed: "x" })).refused, "FRAME_INVALID");
  assert.equal(asRefusal(draw({ frame: ["a", 2], n: 1, seed: "x" })).refused, "FRAME_INVALID");
  assert.equal(asRefusal(draw({ frame, n: 1, seed: "" })).refused, "SEED_INVALID");
  assert.throws(() => draw({ frame, n: 1 }), TypeError);
  assert.throws(() => draw({ frame: "abc", n: 1, seed: "x" }), TypeError);
});

/* An independent oracle: every M scanned, tails as exact fractions. */
/** @param {number} N @param {number} n @param {number} x @param {string} conf @returns {{ low: number | null, high: number | null }} */
function oracle(N, n, x, conf) {
  /** @param {number} m @param {number} k @returns {bigint} */
  const C = (m, k) => { if (k < 0 || k > m) return 0n; let r = 1n; for (let i = 0; i < k; i++) r = (r * BigInt(m - i)) / BigInt(i + 1); return r; };
  const [, f] = conf.split(".");
  if (f === undefined) throw new TypeError(`no fraction in the confidence ${conf}`);
  const q = 10n ** BigInt(f.length); const p = BigInt(f);
  const total = C(N, n);
  /** @param {bigint} t @returns {boolean} */
  const ok = (t) => 2n * q * t >= (q - p) * total;
  /** @param {number} M @returns {bigint} */
  const up = (M) => { let s = 0n; for (let k = x; k <= n; k++) s += C(M, k) * C(N - M, n - k); return s; };
  /** @param {number} M @returns {bigint} */
  const down = (M) => { let s = 0n; for (let k = 0; k <= x; k++) s += C(M, k) * C(N - M, n - k); return s; };
  /** @type {number | null} */
  let low = null;
  /** @type {number | null} */
  let high = null;
  for (let M = 0; M <= N; M++) { if (low === null && ok(up(M))) low = M; if (ok(down(M))) high = M; }
  return { low, high };
}

test("R17 the exact hypergeometric interval: low and high are the extreme frame counts whose tails are not below (1 − confidence)/2, for every small frame", () => {
  for (const conf of ["0.8", "0.9", "0.95", "0.99"]) for (let N = 1; N <= 14; N++) for (let n = 1; n <= N; n++) for (let x = 0; x <= n; x++) {
    const r = asInterval(interval({ frame_size: N, sample_size: n, successes: x, confidence: conf }), `N=${N} n=${n} x=${x} c=${conf}`);
    const o = oracle(N, n, x, conf);
    assert.deepEqual([r.low, r.high], [o.low, o.high], `N=${N} n=${n} x=${x} c=${conf}`);
    assert.ok(r.low <= x + (N - n) && r.low >= x && r.high <= N - (n - x));
  }
  const big = asInterval(interval({ frame_size: 5000, sample_size: 400, successes: 40, confidence: 0.95 }));
  assert.match(big.method, /hypergeometric/);
  assert.ok(big.low < 500 && big.high > 500 && big.low > 300 && big.high < 750, JSON.stringify(big));
  assert.deepEqual(interval({ frame_size: 10, sample_size: 10, successes: 4, confidence: "0.95" }), { low: 4, high: 4, method: big.method });
  /** @type {IntervalArgs[]} */
  const bads = [{ frame_size: 0, sample_size: 0, successes: 0, confidence: "0.9" }, { frame_size: 5, sample_size: 6, successes: 1, confidence: "0.9" },
    { frame_size: 5, sample_size: 3, successes: 4, confidence: "0.9" }, { frame_size: 5, sample_size: 3, successes: -1, confidence: "0.9" },
    { frame_size: 5.5, sample_size: 3, successes: 1, confidence: "0.9" }, { frame_size: 5, sample_size: 3, successes: 1, confidence: "1" },
    { frame_size: 5, sample_size: 3, successes: 1, confidence: "0" }, { frame_size: 5, sample_size: 3, successes: 1, confidence: "95%" },
    { frame_size: 5, sample_size: 3, successes: 1 }];
  for (const bad of bads) assert.equal(asRefusal(interval(bad), JSON.stringify(bad)).refused, "INTERVAL_INVALID", JSON.stringify(bad));
});

test("R23 a draw over 1,000,000 keys yields on bounded slices and answers the sample a plain draw and any SHA-256 tool give", async () => {
  const frame = Array.from({ length: 1_000_000 }, (_, i) => `ROW-${(i * 7919) % 1_000_003}`);
  const seed = "2026-10-25 public draw";
  const n = 100;
  const want = frame.map((key) => ({ key, h: sha(`${seed}\n${key}`) }))
    .sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0)).slice(0, n).map((x) => x.key);
  let yields = 0; let longest = 0; let last = performance.now();
  const r = asDraw(await drawSliced({ frame, n, seed }, { yieldNow: async () => { yields++; const t = performance.now(); longest = Math.max(longest, t - last); last = performance.now(); await new Promise(/** @param {(value: void) => void} res */ (res) => setImmediate(res)); last = performance.now(); } }));
  longest = Math.max(longest, performance.now() - last);
  assert.deepEqual(r.sample, want);
  assert.equal(r.frame_hash, sha(JSON.stringify([...frame].sort())));
  assert.equal(r.seed, seed);
  assert.ok(yields >= frame.length / DRAW_SLICE, `yielded ${yields} times`);
  assert.ok(longest < 500, `the longest stretch without a yield was ${Math.round(longest)} ms`);
  assert.deepEqual(draw({ frame, n, seed }), r, "the plain draw answers the same");
  assert.deepEqual(await drawSliced({ frame: ["b", "a", "c"], n: 2, seed: "x" }), draw({ frame: ["b", "a", "c"], n: 2, seed: "x" }), "no yield function is no yield");
  assert.equal(asRefusal(await drawSliced({ frame: ["a", "a"], n: 1, seed: "x" }, {})).refused, "FRAME_INVALID");
  assert.equal(asRefusal(await drawSliced({ frame: ["a"], n: 2, seed: "x" }, {})).refused, "DRAW_TOO_LARGE");
  await assert.rejects(() => drawSliced({ frame: "abc", n: 1, seed: "x" }), TypeError);
});

test("R23 interval over a frame of 100,000 values answers in moments, the extreme counts the tail rule names", () => {
  /** @param {number} m @param {number} k @returns {bigint} */
  const C = (m, k) => { if (k < 0 || k > m) return 0n; k = Math.min(k, m - k); let r = 1n; for (let i = 1; i <= k; i++) r = (r * BigInt(m - k + i)) / BigInt(i); return r; };
  const N = 100_000; const n = 400; const x = 40;
  const t0 = performance.now();
  const r = asInterval(interval({ frame_size: N, sample_size: n, successes: x, confidence: "0.95" }));
  assert.ok(performance.now() - t0 < 5000);
  const total = C(N, n);
  /** @param {bigint} t @returns {boolean} */
  const ok = (t) => 2n * 100n * t >= 5n * total;
  /** @param {number} M @returns {bigint} */
  const up = (M) => { let s = 0n; for (let k = x; k <= Math.min(n, M); k++) s += C(M, k) * C(N - M, n - k); return s; };
  /** @param {number} M @returns {bigint} */
  const down = (M) => { let s = 0n; for (let k = 0; k <= x; k++) s += C(M, k) * C(N - M, n - k); return s; };
  assert.ok(ok(up(r.low)) && !ok(up(r.low - 1)), "low is the least count whose upper tail is not below the rule");
  assert.ok(ok(down(r.high)) && !ok(down(r.high + 1)), "high is the greatest count whose lower tail is not below the rule");
  assert.match(r.method, /hypergeometric/);
});
