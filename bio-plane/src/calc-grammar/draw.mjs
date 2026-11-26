/* calc-grammar's recorded random draws (requirements: `build/requirements/calc-grammar.md`, R16, R17; K1448, DEC-22).
 * A draw ranks every key of a frozen frame by SHA-256 of the caller's seed and the key, so anyone with the frame,
 * the seed and any SHA-256 tool can reproduce it; the module reads no clock and no randomness of its own. The
 * interval is the exact hypergeometric one, computed in whole numbers, with no floating point. */

import { createSha256, sha256HexSync } from "../record-grammar/index.mjs";
import { dec, refusal } from "./decimal.mjs";

/** @import { Refusal } from "./decimal.mjs" */
/** @import { Data } from "./tables.mjs" */
/**
 * A draw's arguments (R16): the frozen frame of distinct keys, how many to draw, and the caller's seed.
 * @typedef {Object} DrawArgs
 * @property {Data[]} [frame]
 * @property {number} [n]
 * @property {string} [seed]
 * @bound n: whole number, 0 to the frame's size; frame: no key repeated
 */
/**
 * A draw (R16): the sample, the frame's hash, the seed and the method, from which anyone can reproduce it.
 * @typedef {Object} Draw
 * @property {string[]} sample
 * @property {string} frame_hash
 * @property {string} seed
 * @property {string} method
 */
/** What `drawSliced` awaits between slices. @typedef {() => Data} YieldNow */
/**
 * What lets `drawSliced` pass the caller's turn between slices (R23); a `yieldNow` that is not a function is no yield.
 * @typedef {Object} SliceOptions
 * @property {YieldNow | Data} [yieldNow]
 */
/** A frame whose every key is a string. @typedef {string[]} Keys */
/** A frame as handed in: a list of keys of any kind. @typedef {Data[]} Frame */
/** @param {Data} k @returns {boolean} */
const isText = (k) => typeof k === "string";
/** @param {unknown} x @returns {x is Frame} */
const isFrame = (x) => Array.isArray(x);
/** @param {unknown} x @returns {x is Keys} */
const isKeys = (x) => isFrame(x) && allText(x);
/** @param {Frame} frame @returns {boolean} */
const allText = (frame) => frame.every(isText);
/** @param {unknown} x @returns {x is YieldNow} */
const isYieldNow = (x) => typeof x === "function";
/**
 * An interval's arguments (R17).
 * @typedef {Object} IntervalArgs
 * @property {number} [frame_size]
 * @property {number} [sample_size]
 * @property {number} [successes]
 * @property {string | number} [confidence]
 * @bound 0 ≤ successes ≤ sample_size ≤ frame_size, sample_size at least 1; confidence strictly between 0 and 1
 */
/**
 * The exact interval (R17): the counts in the frame bounding the proportion, and the method.
 * @typedef {Object} Interval
 * @property {number} low
 * @property {number} high
 * @property {string} method
 */
/** A key ranked by its hash. @typedef {{ key: string, h: string }} Ranked */
/** The head of one sorted chunk of the frame, merged in order. @typedef {{ ci: number, at: number, key: string }} Head */

export const DRAW_METHOD = "bio-draw/1: rank each key by sha256(seed + \"\\n\" + key), lowest first (ties by key), take the first n";
export const INTERVAL_METHOD = "bio-interval/1: exact hypergeometric, equal tails, counts in the frame";

/** R23: the most keys one stretch of `drawSliced` hashes, ranks or merges before it lets the caller's turn pass. */
export const DRAW_SLICE = 4000;

const utf8 = new TextEncoder();
/** @param {Ranked} a @param {Ranked} b @returns {number} */
const rankBefore = (a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/* An item a heap holds at an index it has counted. */
/** @template T @param {T[]} items @param {number} i @returns {T} */
function at(items, i) {
  const x = items[i];
  if (x === undefined) throw new TypeError("a heap is read only at the places it holds");
  return x;
}

/* A binary heap over `items`, its root the one `before(a, b) > 0` puts last. */
/** @template T @param {T[]} items @param {(a: T, b: T) => number} cmp @param {number} i @returns {void} */
function siftUp(items, cmp, i) {
  const x = at(items, i);
  while (i > 0) {
    const up = (i - 1) >> 1;
    const above = at(items, up);
    if (cmp(above, x) >= 0) break;
    items[i] = above; i = up;
  }
  items[i] = x;
}
/** @template T @param {T[]} items @param {(a: T, b: T) => number} cmp @param {number} i @param {number} size
 *  @returns {void} */
function siftDown(items, cmp, i, size) {
  const x = at(items, i);
  for (;;) {
    let c = 2 * i + 1;
    if (c >= size) break;
    if (c + 1 < size && cmp(at(items, c + 1), at(items, c)) > 0) c++;
    const child = at(items, c);
    if (cmp(child, x) <= 0) break;
    items[i] = child; i = c;
  }
  items[i] = x;
}

/* The draw as steps: a generator that yields at each slice boundary and returns the answer, so `draw` (run through
 * at once) and `drawSliced` (a turn passed at each yield) are one computation and answer alike (R16, R23). */
/** @param {string[]} frame @param {number} n @param {string} seed @returns {Generator<undefined, Draw | Refusal, undefined>} */
function* drawSteps(frame, n, seed) {
  /** @type {Set<string>} */
  const seen = new Set(/** @type {string[]} */ ([]));
  for (let i = 0; i < frame.length; i++) {
    const k = at(frame, i);
    if (seen.has(k)) return refusal("FRAME_INVALID", `the frame repeats the key "${k.slice(0, 64)}"`);
    seen.add(k);
    if ((i + 1) % (DRAW_SLICE * 8) === 0) yield;
  }
  seen.clear();
  if (!seed) return refusal("SEED_INVALID", "the seed is empty");
  if (n < 0 || n > frame.length) return refusal("DRAW_TOO_LARGE", `n is ${n}, and the frame holds ${frame.length} keys`);
  // the n lowest ranks, kept in a heap whose root is the highest of them
  /** @type {Ranked[]} */
  const heap = [];
  for (let i = 0; i < frame.length && n > 0; i++) {
    const key = at(frame, i);
    /** @type {Ranked} */
    const item = { key, h: String(sha256HexSync(`${seed}\n${key}`)) };
    if (heap.length < n) { heap.push(item); siftUp(heap, rankBefore, heap.length - 1); }
    else if (rankBefore(item, at(heap, 0)) < 0) { heap[0] = item; siftDown(heap, rankBefore, 0, n); }
    if ((i + 1) % DRAW_SLICE === 0) yield;
  }
  /** @type {string[]} */
  const sample = Array.from({ length: heap.length }, () => "");
  for (let end = heap.length, done = 0; end > 0; done++) {
    sample[--end] = at(heap, 0).key;
    heap[0] = at(heap, end); siftDown(heap, rankBefore, 0, end);
    if ((done + 1) % DRAW_SLICE === 0) yield;
  }
  // the frame's hash: sorted chunks merged in order into the canonical JSON, streamed through the digest
  /** @type {string[][]} */
  const chunks = [];
  for (let from = 0; from < frame.length; from += DRAW_SLICE) { chunks.push(frame.slice(from, from + DRAW_SLICE).sort()); yield; }
  /** @type {Head[]} */
  const heads = [];
  chunks.forEach((c, ci) => { const key = c[0]; if (key !== undefined) heads.push({ ci, at: 0, key }); });
  /** @param {Head} a @param {Head} b @returns {number} */
  const byKey = (a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0); // the lowest key at the root
  for (let i = (heads.length >> 1) - 1; i >= 0; i--) siftDown(heads, byKey, i, heads.length);
  const digest = createSha256();
  let part = ["["];
  for (let emitted = 0; heads.length; emitted++) {
    const top = at(heads, 0);
    part.push(emitted ? "," + JSON.stringify(top.key) : JSON.stringify(top.key));
    top.at++;
    const chunk = at(chunks, top.ci);
    if (top.at < chunk.length) top.key = at(chunk, top.at);
    else heads[0] = at(heads, heads.length - 1), heads.pop();
    if (heads.length) siftDown(heads, byKey, 0, heads.length);
    if ((emitted + 1) % DRAW_SLICE === 0) { digest.update(utf8.encode(part.join(""))); part = []; yield; }
  }
  part.push("]");
  digest.update(utf8.encode(part.join("")));
  return { sample, frame_hash: String(digest.hex()), seed, method: DRAW_METHOD };
}

/** @param {DrawArgs} args @returns {Generator<undefined, Draw | Refusal, undefined> | Refusal} */
function drawInput({ frame, n, seed }) {
  if (!Array.isArray(frame)) throw new TypeError("draw's frame is a list of keys");
  if (typeof seed !== "string") throw new TypeError("draw's seed is a string the caller records");
  if (typeof n !== "number" || !Number.isSafeInteger(n)) throw new TypeError("draw's n is a whole number");
  if (!isKeys(frame)) return refusal("FRAME_INVALID", "every key of the frame is a string");
  return drawSteps(frame, n, seed);
}

/** R16: `{sample, frame_hash, seed, method}`, or a refusal.
 *  @param {DrawArgs} [args] @returns {Draw | Refusal} */
export function draw(args = {}) {
  const steps = drawInput(args);
  if (!("next" in steps)) return steps;
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}

/** R23: `draw`'s answer, byte for byte, with `await yieldNow()` between slices of at most `DRAW_SLICE` keys, so a
 * frame of a million keys never holds the caller's turn. A `yieldNow` that is not a function is no yield.
 * @param {DrawArgs} [args] @param {SliceOptions} [options] @returns {Promise<Draw | Refusal>} */
export async function drawSliced(args = {}, { yieldNow } = {}) {
  const steps = drawInput(args);
  if (!("next" in steps)) return steps;
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    if (isYieldNow(yieldNow)) await yieldNow();
  }
}

// ---- the exact interval ----

/* C(m, k) as a BigInt; 0 outside 0 ≤ k ≤ m. */
/** @param {number} m @param {number} k @returns {bigint} */
function choose(m, k) {
  if (k < 0 || k > m) return 0n;
  k = Math.min(k, m - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(m - k + i)) / BigInt(i);
  return r;
}

/* The numerator over C(N, n) of P(X ≥ x) (upper) or P(X ≤ x) (lower), X hypergeometric with M successes. Each term
 * follows the one before by the exact ratio (M−k)(n−k) / ((k+1)(N−M−n+k+1)), a whole-number division, so a tail is
 * one binomial product and a run of small multiplications (R23). */
/** @param {number} N @param {number} n @param {number} M @param {number} x @param {boolean} upper @returns {bigint} */
function tail(N, n, M, x, upper) {
  const first = Math.max(0, n - (N - M));
  const from = upper ? Math.max(x, first) : first;
  const to = upper ? Math.min(n, M) : Math.min(x, M);
  if (from > to) return 0n;
  let term = choose(M, from) * choose(N - M, n - from);
  let s = term;
  for (let k = from; k < to; k++) {
    term = (term * BigInt(M - k) * BigInt(n - k)) / (BigInt(k + 1) * BigInt(N - M - n + k + 1));
    s += term;
  }
  return s;
}

/* Confidence as an exact fraction p/q with 0 < p/q < 1, from a decimal string or a number written as one. */
/** @param {string | number} c @returns {{ p: bigint, q: bigint } | null} */
function fraction(c) {
  const d = dec(typeof c === "number" ? String(c) : c);
  if (!d || d.n <= 0n) return null;
  const q = 10n ** BigInt(d.s);
  return d.n < q ? { p: d.n, q } : null;
}

/** R17: `{low, high, method}`: the counts in the frame bounding the proportion at `confidence`, or a refusal.
 *  @param {IntervalArgs} [args] @returns {Interval | Refusal} */
export function interval(args = {}) {
  const N = args.frame_size; const n = args.sample_size; const x = args.successes; const confidence = args.confidence;
  /** @type {[string, number | undefined][]} */
  const counts = [["frame_size", N], ["sample_size", n], ["successes", x]];
  for (const [name, v] of counts)
    if (!Number.isSafeInteger(v)) return refusal("INTERVAL_INVALID", `${name} must be a whole number`);
  if (N === undefined || n === undefined || x === undefined) return refusal("INTERVAL_INVALID", "the counts must be whole numbers");
  if (!(N >= 1 && n >= 1 && n <= N && x >= 0 && x <= n))
    return refusal("INTERVAL_INVALID", "the counts must satisfy 0 ≤ successes ≤ sample_size ≤ frame_size, with a sample of at least one");
  if (typeof confidence !== "string" && typeof confidence !== "number")
    return refusal("INTERVAL_INVALID", "confidence is a decimal between 0 and 1, such as 0.95");
  const f = fraction(confidence);
  if (!f) return refusal("INTERVAL_INVALID", "confidence is a decimal strictly between 0 and 1");
  // A tail is at least (1 − c)/2 exactly when 2·q·tail ≥ (q − p)·C(N, n).
  const total = choose(N, n);
  /** @param {bigint} t @returns {boolean} */
  const atLeast = (t) => 2n * f.q * t >= (f.q - f.p) * total;
  // P(X ≥ x | M) rises with M, and P(X ≤ x | M) falls with M: search each bound.
  let lo = x; let hi = N - (n - x);
  while (lo < hi) { const m = (lo + hi) >> 1; if (atLeast(tail(N, n, m, x, true))) hi = m; else lo = m + 1; }
  const low = lo;
  lo = x; hi = N - (n - x);
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (atLeast(tail(N, n, m, x, false))) lo = m; else hi = m - 1; }
  return { low, high: lo, method: INTERVAL_METHOD };
}
