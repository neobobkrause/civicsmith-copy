/* image-codecs R5: the MQ arithmetic decoder at its interface
 * (build/requirements/image-codecs.md).
 *
 * INDEPENDENT EXPECTATIONS. The standard's own test sequence (ITU-T T.88 Annex
 * H.2: 30 coded bytes and the 256 decisions they carry, in one context), and
 * round trips through an MQ ENCODER written below from T.88 Annex E.2's
 * procedures (INITENC, CODEMPS, CODELPS, RENORME, BYTEOUT, FLUSH), which shares
 * no line with `mq.mjs`. The same 47-state table is written out again here from
 * T.88 Table E.1, not imported. */
import "../../../bio-plane/test/sandbox.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { MqDecoder, mqContexts } from "../../src/mq.mjs";

/* T.88 Table E.1: Qe, NMPS, NLPS, SWITCH. */
/** @type {Array<[number, number, number, number]>} */
const TABLE = [
  [0x5601, 1, 1, 1], [0x3401, 2, 6, 0], [0x1801, 3, 9, 0], [0x0AC1, 4, 12, 0], [0x0521, 5, 29, 0], [0x0221, 38, 33, 0],
  [0x5601, 7, 6, 1], [0x5401, 8, 14, 0], [0x4801, 9, 14, 0], [0x3801, 10, 14, 0], [0x3001, 11, 17, 0], [0x2401, 12, 18, 0],
  [0x1C01, 13, 20, 0], [0x1601, 29, 21, 0], [0x5601, 15, 14, 1], [0x5401, 16, 14, 0], [0x5101, 17, 15, 0], [0x4801, 18, 16, 0],
  [0x3801, 19, 17, 0], [0x3401, 20, 18, 0], [0x3001, 21, 19, 0], [0x2801, 22, 19, 0], [0x2401, 23, 20, 0], [0x2201, 24, 21, 0],
  [0x1C01, 25, 22, 0], [0x1801, 26, 23, 0], [0x1601, 27, 24, 0], [0x1401, 28, 25, 0], [0x1201, 29, 26, 0], [0x1101, 30, 27, 0],
  [0x0AC1, 31, 28, 0], [0x09C1, 32, 29, 0], [0x08A1, 33, 30, 0], [0x0521, 34, 31, 0], [0x0441, 35, 32, 0], [0x02A1, 36, 33, 0],
  [0x0221, 37, 34, 0], [0x0141, 38, 35, 0], [0x0111, 39, 36, 0], [0x0085, 40, 37, 0], [0x0049, 41, 38, 0], [0x0025, 42, 39, 0],
  [0x0015, 43, 40, 0], [0x0009, 44, 41, 0], [0x0005, 45, 42, 0], [0x0001, 45, 43, 0], [0x5601, 46, 46, 0],
];

/** T.88 E.2's encoder. C is kept as a plain number (at most 28 bits live).
 *  @param {Array<[number, number]>} decisions (context, decision) pairs @returns {Uint8Array} */
function mqEncode(decisions) {
  /** @type {Array<[number, number]>} */
  const none = [];
  const I = new Map(none), MPS = new Map(none);   // context → state index, context → MPS
  /** @type {number[]} */ const out = [0];            // out[0] is the byte before BPST, which FLUSH may never touch
  let A = 0x8000, C = 0, CT = 12, bp = 0;
  const byteOut = () => {
    if (out[bp] === 0xff) { bp++; out[bp] = Math.floor(C / 2 ** 20); C %= 2 ** 20; CT = 7; return; }
    if (C < 0x8000000) { bp++; out[bp] = Math.floor(C / 2 ** 19); C %= 2 ** 19; CT = 8; return; }
    out[bp] = (out[bp] ?? NaN) + 1;
    if (out[bp] === 0xff) { C %= 0x8000000; bp++; out[bp] = Math.floor(C / 2 ** 20); C %= 2 ** 20; CT = 7; }
    else { bp++; out[bp] = Math.floor(C / 2 ** 19); C %= 2 ** 19; CT = 8; }
  };
  const renorm = () => { do { A *= 2; C *= 2; CT--; if (CT === 0) byteOut(); } while (A < 0x8000); };
  for (const [cx, d] of decisions) {
    const i = I.get(cx) ?? 0, mps = MPS.get(cx) ?? 0;
    const row = TABLE[i];
    if (row === undefined) throw new TypeError(`no state ${i} in Table E.1`);
    const [qe, nmps, nlps, sw] = row;
    A -= qe;
    if (d === mps) {                                   // CODEMPS
      if (A < 0x8000) {
        if (A < qe) A = qe; else C += qe;
        I.set(cx, nmps);
        renorm();
      } else C += qe;
    } else {                                           // CODELPS
      if (A < qe) C += qe; else A = qe;
      if (sw) MPS.set(cx, 1 - mps);
      I.set(cx, nlps);
      renorm();
    }
  }
  /* FLUSH: SETBITS, then two bytes out, then the 0xFFAC marker T.88 ends on. */
  const tempc = C + A;
  C = C - (C % 0x10000) + 0xffff;
  if (C >= tempc) C -= 0x8000;
  C *= 2 ** CT; byteOut();
  C *= 2 ** CT; byteOut();
  if (out[bp] !== 0xff) { bp++; out[bp] = 0xff; }
  out[bp + 1] = 0xac;
  return Uint8Array.from(out.slice(1));
}

/** A reproducible stream of decisions: `n` contexts, each with its own bias.
 *  @param {number} seed @param {number} count @param {number} n @returns {Array<[number, number]>} (context, decision) pairs */
function decisions(seed, count, n) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const bias = Array.from({ length: n }, () => rnd());
  return Array.from({ length: count }, () => {
    const cx = Math.floor(rnd() * n);
    /** @type {[number, number]} */
    const pair = [cx, rnd() < (bias[cx] ?? NaN) ? 1 : 0];
    return pair;
  });
}

test("R5 T.88 Annex H.2's test sequence decodes to the standard's 256 decisions", () => {
  const coded = Uint8Array.from([0x84, 0xC7, 0x3B, 0xFC, 0xE1, 0xA1, 0x43, 0x04, 0x02, 0x20, 0x00, 0x00, 0x41, 0x0D, 0xBB,
    0x86, 0xF4, 0x31, 0x7F, 0xFF, 0x88, 0xFF, 0x37, 0x47, 0x1A, 0xDB, 0x6A, 0xDF, 0xFF, 0xAC]);
  const want = [0x00, 0x02, 0x00, 0x51, 0x00, 0x00, 0x00, 0xC0, 0x03, 0x52, 0x87, 0x2A, 0xAA, 0xAA, 0xAA, 0xAA, 0x82, 0xC0,
    0x20, 0x00, 0xFC, 0xD7, 0x9E, 0xF6, 0xBF, 0x7F, 0xED, 0x90, 0x4F, 0x46, 0xA3, 0xBF];
  const mq = new MqDecoder(coded), ctx = mqContexts(1);
  const got = want.map(() => { let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | mq.decode(ctx, 0); return b; });
  assert.deepEqual(got, want);
  assert.equal(mq.overrun, 0);
});

test("R5 the encoder below reproduces H.2's coded bytes, so its round trips are the standard's", () => {
  const want = [0x00, 0x02, 0x00, 0x51, 0x00, 0x00, 0x00, 0xC0, 0x03, 0x52, 0x87, 0x2A, 0xAA, 0xAA, 0xAA, 0xAA, 0x82, 0xC0,
    0x20, 0x00, 0xFC, 0xD7, 0x9E, 0xF6, 0xBF, 0x7F, 0xED, 0x90, 0x4F, 0x46, 0xA3, 0xBF];
  const bits = want.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => {
    /** @type {[number, number]} */
    const bit = [0, (b >> k) & 1];
    return bit;
  }));
  assert.deepEqual([...mqEncode(bits)], [0x84, 0xC7, 0x3B, 0xFC, 0xE1, 0xA1, 0x43, 0x04, 0x02, 0x20, 0x00, 0x00, 0x41, 0x0D,
    0xBB, 0x86, 0xF4, 0x31, 0x7F, 0xFF, 0x88, 0xFF, 0x37, 0x47, 0x1A, 0xDB, 0x6A, 0xDF, 0xFF, 0xAC]);
});

test("R5 the same bytes and context states decode the decisions the standard's encoder coded", () => {
  /** @type {Array<[number, number, number]>} */
  const runs = [[1, 5000, 1], [2, 20000, 3], [3, 20000, 19], [4, 40000, 512], [5, 3000, 2], [6, 60000, 64]];
  for (const [seed, count, n] of runs) {
    const ds = decisions(seed, count, n);
    const coded = mqEncode(ds);
    const mq = new MqDecoder(coded), ctx = mqContexts(n);
    const got = ds.map(([cx]) => mq.decode(ctx, cx));
    assert.deepEqual(got, ds.map(([, d]) => d), `seed ${seed}: ${count} decisions over ${n} contexts`);
    assert.equal(mq.overrun, 0, `seed ${seed}: no byte needed beyond the data`);
  }
});

test("R5 decoding a window of a buffer: start and end bound what is read", () => {
  const ds = decisions(9, 8000, 7);
  const coded = mqEncode(ds);
  const buf = new Uint8Array(coded.length + 20).fill(0x55);
  buf.set(coded, 10);
  const mq = new MqDecoder(buf, 10, 10 + coded.length), ctx = mqContexts(7);
  assert.deepEqual(ds.map(([cx]) => mq.decode(ctx, cx)), ds.map(([, d]) => d));
});

test("R5 context states: mqContexts(n) is n zero states, and a context keeps its own state", () => {
  const c = mqContexts(5);
  assert.ok(c instanceof Uint8Array);
  assert.deepEqual([...c], [0, 0, 0, 0, 0]);
  /* Two contexts decoded in one stream decode as the encoder coded each. */
  /** @type {Array<[number, number]>} */
  const ds = decisions(11, 4000, 2).map(([cx, d]) => [cx, cx === 0 ? 1 : d]);
  const mq = new MqDecoder(mqEncode(ds)), ctx = mqContexts(2);
  assert.deepEqual(ds.map(([cx]) => mq.decode(ctx, cx)), ds.map(([, d]) => d));
  assert.equal((ctx[0] ?? NaN) & 1, 1, "context 0 learned MPS 1");
});

test("R5 data running out is counted, never hidden: overrun names the bytes needed and missing", () => {
  const ds = decisions(12, 20000, 9);
  const coded = mqEncode(ds);
  const cut = coded.subarray(0, coded.length >> 1);
  const mq = new MqDecoder(cut), ctx = mqContexts(9);
  for (const [cx] of ds) mq.decode(ctx, cx);
  assert.ok(mq.overrun > 0);
});

test("R5 (fix round 9, G132l (d)) data running out is detected as the bytes are consumed: onShort is called at the first byte the decode lacks, not after the region", () => {
  const ds = decisions(12, 20000, 9);
  const coded = mqEncode(ds);
  /* cut in half: the marker is gone, so the first byte past the cut is the first one lacking */
  const cut = coded.subarray(0, coded.length >> 1);
  const stop = Symbol("short");
  let decoded = 0;
  const mq = new MqDecoder(cut, 0, cut.length, { onShort() { throw stop; } }), ctx = mqContexts(9);
  /** @type {unknown} */ let thrown;
  try { for (const [cx] of ds) { mq.decode(ctx, cx); decoded++; } } catch (e) { thrown = e; }
  assert.equal(thrown, stop, "the decode was stopped by onShort");
  assert.ok(decoded > 0 && decoded < ds.length / 2 + 1000, `stopped after ${decoded} of ${ds.length} decisions`);
  assert.ok(mq.overrun > 0, "and the shortfall is counted as before");
  /* the same cut with no onShort: counted, decoded to the end (the callers that tolerate it, JPX's code-blocks) */
  const quiet = new MqDecoder(cut), qctx = mqContexts(9);
  for (const [cx] of ds) quiet.decode(qctx, cx);
  assert.ok(quiet.overrun > 0);
});

test("R5 (fix round 9, G132l (d)) a stream that ends in its 0xFFAC marker is short once the decode feeds on the marker past the coder's look-ahead; a whole stream never is", () => {
  /** @type {Array<[number, number, number]>} */
  const runs = [[1, 5000, 1], [2, 20000, 3], [3, 20000, 19], [4, 40000, 512], [5, 3000, 2], [6, 60000, 64], [7, 1, 1], [8, 17, 2]];
  for (const [seed, count, n] of runs) {
    const ds = decisions(seed, count, n), coded = mqEncode(ds);
    assert.deepEqual([...coded.subarray(-2)], [0xff, 0xac], "the standard's encoder ends on the marker");
    const mq = new MqDecoder(coded, 0, coded.length, { onShort() { assert.fail(`seed ${seed}: a whole stream is not short`); } }), ctx = mqContexts(n);
    for (const [cx] of ds) mq.decode(ctx, cx);
    assert.equal(mq.overrun, 0, `seed ${seed}`);
  }
  /* decisions asked beyond what was coded are fed from the marker's 1-bits: they stop within a few bytes' worth of them */
  const ds = decisions(2, 20000, 3), coded = mqEncode(ds);
  const stop = Symbol("short");
  const mq = new MqDecoder(coded, 0, coded.length, { onShort() { throw stop; } }), ctx = mqContexts(3);
  for (const [cx] of ds) mq.decode(ctx, cx);
  let extra = 0;
  /** @type {unknown} */ let thrown;
  try { for (; extra < 5000; extra++) mq.decode(ctx, extra % 3); } catch (e) { thrown = e; }
  assert.equal(thrown, stop);
  assert.ok(extra > 0 && extra < 1000, `stopped after ${extra} invented decisions`);
});
