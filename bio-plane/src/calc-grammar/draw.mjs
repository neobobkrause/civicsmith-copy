/* calc-grammar's recorded random draws (requirements: `build/requirements/calc-grammar.md`, R16, R17; K1448, DEC-22).
 * A draw ranks every key of a frozen frame by SHA-256 of the caller's seed and the key, so anyone with the frame,
 * the seed and any SHA-256 tool can reproduce it; the module reads no clock and no randomness of its own. The
 * interval is the exact hypergeometric one, computed in whole numbers, with no floating point. */

import { createSha256, sha256HexSync } from "../record-grammar/index.mjs";
import { dec, refusal } from "./decimal.mjs";

export const DRAW_METHOD = "bio-draw/1: rank each key by sha256(seed + \"\\n\" + key), lowest first (ties by key), take the first n";
export const INTERVAL_METHOD = "bio-interval/1: exact hypergeometric, equal tails, counts in the frame";

/** R23: the most keys one stretch of `drawSliced` hashes, ranks or merges before it lets the caller's turn pass. */
export const DRAW_SLICE = 4000;

const utf8 = new TextEncoder();
const rankBefore = (a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/* A binary heap over `items`, its root the one `before(a, b) > 0` puts last. */
function siftUp(items, cmp, i) {
  const x = items[i];
  while (i > 0) {
    const up = (i - 1) >> 1;
    if (cmp(items[up], x) >= 0) break;
    items[i] = items[up]; i = up;
  }
  items[i] = x;
}
function siftDown(items, cmp, i, size) {
  const x = items[i];
  for (;;) {
    let c = 2 * i + 1;
    if (c >= size) break;
    if (c + 1 < size && cmp(items[c + 1], items[c]) > 0) c++;
    if (cmp(items[c], x) <= 0) break;
    items[i] = items[c]; i = c;
  }
  items[i] = x;
}

/* The draw as steps: a generator that yields at each slice boundary and returns the answer, so `draw` (run through
 * at once) and `drawSliced` (a turn passed at each yield) are one computation and answer alike (R16, R23). */
function* drawSteps(frame, n, seed) {
  const seen = new Set();
  for (let i = 0; i < frame.length; i++) {
    const k = frame[i];
    if (seen.has(k)) return refusal("FRAME_INVALID", `the frame repeats the key "${k.slice(0, 64)}"`);
    seen.add(k);
    if ((i + 1) % (DRAW_SLICE * 8) === 0) yield;
  }
  seen.clear();
  if (!seed) return refusal("SEED_INVALID", "the seed is empty");
  if (n < 0 || n > frame.length) return refusal("DRAW_TOO_LARGE", `n is ${n}, and the frame holds ${frame.length} keys`);
  // the n lowest ranks, kept in a heap whose root is the highest of them
  const heap = [];
  for (let i = 0; i < frame.length && n > 0; i++) {
    const item = { key: frame[i], h: sha256HexSync(`${seed}\n${frame[i]}`) };
    if (heap.length < n) { heap.push(item); siftUp(heap, rankBefore, heap.length - 1); }
    else if (rankBefore(item, heap[0]) < 0) { heap[0] = item; siftDown(heap, rankBefore, 0, n); }
    if ((i + 1) % DRAW_SLICE === 0) yield;
  }
  const sample = new Array(heap.length);
  for (let end = heap.length, done = 0; end > 0; done++) {
    sample[--end] = heap[0].key;
    heap[0] = heap[end]; siftDown(heap, rankBefore, 0, end);
    if ((done + 1) % DRAW_SLICE === 0) yield;
  }
  // the frame's hash: sorted chunks merged in order into the canonical JSON, streamed through the digest
  const chunks = [];
  for (let at = 0; at < frame.length; at += DRAW_SLICE) { chunks.push(frame.slice(at, at + DRAW_SLICE).sort()); yield; }
  const heads = chunks.map((c, ci) => ({ ci, at: 0, key: c[0] })).filter((x) => x.key !== undefined);
  const byKey = (a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0); // the lowest key at the root
  for (let i = (heads.length >> 1) - 1; i >= 0; i--) siftDown(heads, byKey, i, heads.length);
  const digest = createSha256();
  let part = ["["];
  for (let emitted = 0; heads.length; emitted++) {
    const top = heads[0];
    part.push(emitted ? "," + JSON.stringify(top.key) : JSON.stringify(top.key));
    top.at++;
    if (top.at < chunks[top.ci].length) top.key = chunks[top.ci][top.at];
    else heads[0] = heads[heads.length - 1], heads.pop();
    if (heads.length) siftDown(heads, byKey, 0, heads.length);
    if ((emitted + 1) % DRAW_SLICE === 0) { digest.update(utf8.encode(part.join(""))); part = []; yield; }
  }
  part.push("]");
  digest.update(utf8.encode(part.join("")));
  return { sample, frame_hash: digest.hex(), seed, method: DRAW_METHOD };
}

function drawInput(frame, n, seed) {
  if (!Array.isArray(frame)) throw new TypeError("draw's frame is a list of keys");
  if (typeof seed !== "string") throw new TypeError("draw's seed is a string the caller records");
  if (!Number.isSafeInteger(n)) throw new TypeError("draw's n is a whole number");
  if (!frame.every((k) => typeof k === "string")) return refusal("FRAME_INVALID", "every key of the frame is a string");
  return null;
}

/** R16: `{sample, frame_hash, seed, method}`, or a refusal. */
export function draw({ frame, n, seed } = {}) {
  const bad = drawInput(frame, n, seed);
  if (bad) return bad;
  const steps = drawSteps(frame, n, seed);
  for (let r = steps.next(); ; r = steps.next()) if (r.done) return r.value;
}

/** R23: `draw`'s answer, byte for byte, with `await yieldNow()` between slices of at most `DRAW_SLICE` keys, so a
 * frame of a million keys never holds the caller's turn. A `yieldNow` that is not a function is no yield. */
export async function drawSliced({ frame, n, seed } = {}, { yieldNow } = {}) {
  const bad = drawInput(frame, n, seed);
  if (bad) return bad;
  const steps = drawSteps(frame, n, seed);
  for (let r = steps.next(); ; r = steps.next()) {
    if (r.done) return r.value;
    if (typeof yieldNow === "function") await yieldNow();
  }
}

// ---- the exact interval ----

/* C(m, k) as a BigInt; 0 outside 0 ≤ k ≤ m. */
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
function fraction(c) {
  const d = dec(typeof c === "number" ? String(c) : c);
  if (!d || d.n <= 0n) return null;
  const q = 10n ** BigInt(d.s);
  return d.n < q ? { p: d.n, q } : null;
}

/** R17: `{low, high, method}`: the counts in the frame bounding the proportion at `confidence`, or a refusal. */
export function interval({ frame_size: N, sample_size: n, successes: x, confidence } = {}) {
  for (const [name, v] of [["frame_size", N], ["sample_size", n], ["successes", x]])
    if (!Number.isSafeInteger(v)) return refusal("INTERVAL_INVALID", `${name} must be a whole number`);
  if (!(N >= 1 && n >= 1 && n <= N && x >= 0 && x <= n))
    return refusal("INTERVAL_INVALID", "the counts must satisfy 0 ≤ successes ≤ sample_size ≤ frame_size, with a sample of at least one");
  if (typeof confidence !== "string" && typeof confidence !== "number")
    return refusal("INTERVAL_INVALID", "confidence is a decimal between 0 and 1, such as 0.95");
  const f = fraction(confidence);
  if (!f) return refusal("INTERVAL_INVALID", "confidence is a decimal strictly between 0 and 1");
  // A tail is at least (1 − c)/2 exactly when 2·q·tail ≥ (q − p)·C(N, n).
  const total = choose(N, n);
  const atLeast = (t) => 2n * f.q * t >= (f.q - f.p) * total;
  // P(X ≥ x | M) rises with M, and P(X ≤ x | M) falls with M: search each bound.
  let lo = x; let hi = N - (n - x);
  while (lo < hi) { const m = (lo + hi) >> 1; if (atLeast(tail(N, n, m, x, true))) hi = m; else lo = m + 1; }
  const low = lo;
  lo = x; hi = N - (n - x);
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (atLeast(tail(N, n, m, x, false))) lo = m; else hi = m - 1; }
  return { low, high: lo, method: INTERVAL_METHOD };
}
