/* image-codecs R6–R9, across every codec (R10 the PNG decoder and R11 the strip-wise JPEG decoder among them) (build/requirements/image-codecs.md):
 * each checked against a named independent decoder (R6), refusal sets as
 * contracts (R7), purity (R8), and no place named (R9). Behaviour at the
 * interface only: what the module exports and answers. */
import "../../../bio-plane/test/sandbox.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeBaselineJpeg, decodeBaselineJpegRows, DctRefusal } from "../../src/dctdecode.mjs";
import { ccittDecode } from "../../src/ccittdecode.mjs";
import { decodeJbig2, JBIG2_REFUSES, Jbig2Refusal } from "../../src/jbig2decode.mjs";
import { decodeJpx, JPX_REFUSES, JpxRefusal } from "../../src/jpxdecode.mjs";
import { MqDecoder, mqContexts } from "../../src/mq.mjs";
import { decodePng, PNG_REFUSES, PngRefusal } from "../../src/pngdecode.mjs";

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const DCT = load("../fixtures/dct-variants.json"), JB = load("../fixtures/jbig2-variants.json");
const JPX = load("../fixtures/jpx-variants.json"), CC = load("fixtures/ccitt-variants.json");
const PNG = load("fixtures/png-variants.json");
const pngFile = (name) => new Uint8Array(readFileSync(new URL(`fixtures/pngsuite/${name}`, import.meta.url)));
const b64 = (s) => (s == null ? null : new Uint8Array(Buffer.from(s, "base64")));
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** Every fixture of every codec as [codec, name, () => answer], answer being the
 *  decode's result or the refusal it threw. */
const CALLS = [
  ...DCT.variants.map((v) => ["dct", v.name, () => decodeBaselineJpeg(b64(v.jpeg_b64), { rotate: v.rotate })]),
  ...CC.variants.map((v) => ["ccitt", v.name, () => ccittDecode(b64(v.data_b64), { K: v.K, columns: v.columns, rows: v.rows, byteAlign: v.byteAlign })]),
  ...JB.variants.map((v) => ["jbig2", v.name, () => decodeJbig2(b64(v.stream_b64), b64(v.globals_b64))]),
  ...JPX.variants.map((v) => ["jpx", v.name, () => decodeJpx(b64(v.data_b64))]),
];
const answer = (fn) => { try { return fn(); } catch (e) { return e; } };
/** Every PNG fixture as [name, () => bytes]: the suite's files and the constructed ones.
 *  `decodePng` answers a Promise, so its answers are awaited apart from CALLS'. */
const PNG_INPUTS = [
  ...PNG.suite.map((e) => [e.name, () => pngFile(e.name)]),
  ...PNG.variants.map((v) => [v.name, () => b64(v.data_b64)]),
];
const pngAnswers = () => Promise.all(PNG_INPUTS.map(([, bytes]) => decodePng(bytes()).catch((e) => e)));
/** An answer as a comparable value: the samples' digest and the rest, or the refusal. */
function summary(a) {
  if (a instanceof Error) return { refused: a.constructor.name, code: a.code, message: a.message, detail: a.detail };
  const { samples, packed, ...rest } = a;
  return { digest: sha(samples ?? packed), ...rest };
}

test("R6 each codec's fixtures name an independent decoder and carry its digest for every picture", () => {
  for (const [fix, decoder, field] of [[DCT, /libjpeg-turbo/, "pillow_sha256"], [JB, /^jbig2dec /, "jbig2dec_sha256"],
    [JPX, /OpenJPEG/, "opj_sha256"], [CC, /^libtiff /, "libtiff_sha256"],
    [{ provenance: PNG.provenance, variants: [...PNG.suite, ...PNG.variants] }, /^Pillow 12\.3\.0 .*PngSuite/, "pillow_sha256"]]) {
    assert.match(fix.provenance, decoder);
    for (const v of fix.variants.filter((x) => (x.expect ?? "ok") === "ok")) {
      assert.ok(v[field] || v.construction_sha256, `${v.name}: ${field}`);
    }
  }
});

test("R6 no expected picture is this module's own output: every digest is the reference's, and the reference differs where it must", () => {
  /* The two JBIG2 pictures judged by construction are exactly those where jbig2dec
   * does not give the picture encoded, and the fixture says so beside it. */
  for (const v of JB.variants.filter((x) => x.construction_sha256)) {
    assert.ok(v.note, v.name);
    assert.notEqual(v.jbig2dec_sha256, v.construction_sha256, v.name);
  }
});

test("R7 the declared refusal sets, exactly: renaming or removing a key is a change to R7", () => {
  assert.deepEqual(Object.keys(JBIG2_REFUSES), ["colour extension", "12 adaptive-template pixels", "reused bitmap coding contexts",
    "Huffman-coded refinement", "a necessary extension segment", "segment type", "several pages", "no page"]);
  assert.deepEqual(Object.keys(JPX_REFUSES), ["high-throughput coding", "a JP2 palette", "sYCC colour", "an extended capability",
    "packed packet headers"]);
  assert.deepEqual(Object.keys(PNG_REFUSES), ["interlaced", "an unknown critical chunk"]);
  for (const set of [JBIG2_REFUSES, JPX_REFUSES, PNG_REFUSES]) {
    assert.ok(Object.isFrozen(set));
    for (const [k, why] of Object.entries(set)) assert.ok(typeof why === "string" && why.length > 20, k);
  }
});

test("R7 every refusal any fixture draws is one of its codec's codes, an UNSUPPORTED one naming a declared key", () => {
  const CLASSES = {
    dct: ["NOT_A_JPEG", "TRUNCATED", "IMAGE_TOO_LARGE", "UNSUPPORTED_PROCESS", "UNSUPPORTED_PRECISION", "UNSUPPORTED_FRAME", "CORRUPT_DATA",
      "UNSUPPORTED_COMPONENTS", "COMPONENT_MISMATCH", "COLOR_TRANSFORM_CONFLICT", "UNSUPPORTED_SAMPLING", "UNSUPPORTED_ROTATION"],
    jbig2: ["UNSUPPORTED", "TRUNCATED", "CORRUPT", "IMAGE_TOO_LARGE"],
    jpx: ["UNSUPPORTED", "UNSUPPORTED_SAMPLES", "TRUNCATED", "CORRUPT", "IMAGE_TOO_LARGE"],
  };
  const KIND = { dct: DctRefusal, jbig2: Jbig2Refusal, jpx: JpxRefusal };
  const SET = { jbig2: JBIG2_REFUSES, jpx: JPX_REFUSES };
  let refusals = 0;
  const codes = { dct: new Set(), jbig2: new Set(), jpx: new Set() };
  for (const [codec, name, fn] of CALLS) {
    const a = answer(fn);
    if (!(a instanceof Error)) continue;
    refusals++;
    assert.ok(a instanceof KIND[codec], `${codec} ${name}: a ${KIND[codec] && KIND[codec].name}`);
    assert.ok(CLASSES[codec].includes(a.code), `${codec} ${name}: ${a.code}`);
    if (a.code === "UNSUPPORTED") assert.ok(a.detail.feature in SET[codec], `${codec} ${name}: '${a.detail.feature}'`);
    codes[codec].add(a.code);
  }
  assert.equal(refusals, 4 + 14 + 13);
  /* The codes are part of R7 too: JBIG2's and JPX's are all reached by the corpus
   * (DCT's eleven are all driven in dct.test.mjs). */
  /* ... but for IMAGE_TOO_LARGE, which no fixture draws and bounds.test.mjs drives (R12). */
  const fixtureCodes = (list) => list.filter((c) => c !== "IMAGE_TOO_LARGE").sort();
  assert.deepEqual([...codes.jbig2].sort(), fixtureCodes(CLASSES.jbig2));
  assert.deepEqual([...codes.jpx].sort(), fixtureCodes(CLASSES.jpx));
});

test("R7 every refusal a PNG fixture draws is a PngRefusal under one of R10's codes, an UNSUPPORTED one naming a declared key", async () => {
  const got = await pngAnswers();
  const codes = new Set(), features = new Set();
  for (const [i, a] of got.entries()) {
    if (!(a instanceof Error)) continue;
    const name = PNG_INPUTS[i][0];
    assert.ok(a instanceof PngRefusal, `png ${name}: a PngRefusal`);
    assert.ok(["NOT_A_PNG", "UNSUPPORTED", "TRUNCATED", "CORRUPT"].includes(a.code), `png ${name}: ${a.code}`);
    if (a.code === "UNSUPPORTED") { assert.ok(a.detail.feature in PNG_REFUSES, `png ${name}: '${a.detail.feature}'`); features.add(a.detail.feature); }
    codes.add(a.code);
  }
  assert.equal(got.filter((a) => a instanceof Error).length, 35 + 14);
  /* The suite reaches these; TRUNCATED and the other two keys are driven in png.test.mjs. */
  assert.deepEqual([...codes].sort(), ["CORRUPT", "NOT_A_PNG", "UNSUPPORTED"]);
  assert.deepEqual([...features], ["interlaced"]);
});

test("R8 pure: the same bytes and options always answer the same way, in any order", () => {
  const first = CALLS.map(([, , fn]) => summary(answer(fn)));
  const reversed = [...CALLS].reverse().map(([, , fn]) => summary(answer(fn))).reverse();
  assert.deepEqual(reversed, first);
});

test("R8 no clock, no randomness, no I/O: every decode answers the same with them all taken away", () => {
  const want = CALLS.map(([, , fn]) => summary(answer(fn)));
  const saved = { now: Date.now, random: Math.random, perf: globalThis.performance, fetch: globalThis.fetch, crypto: globalThis.crypto };
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  try {
    Date.now = trap("the clock");
    Math.random = trap("randomness");
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    globalThis.fetch = trap("the network");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    const got = CALLS.map(([, , fn]) => answer(fn));
    for (const a of got) if (a instanceof Error) assert.doesNotMatch(a.message, /the decoder reached for/);
    assert.deepEqual(got.map(summary), want);
  } finally {
    Date.now = saved.now; Math.random = saved.random; globalThis.fetch = saved.fetch;
    Object.defineProperty(globalThis, "performance", { value: saved.perf, configurable: true, writable: true });
    Object.defineProperty(globalThis, "crypto", { value: saved.crypto, configurable: true, writable: true });
  }
});

test("R8 no state carried between calls: the input is never changed, and a second decoder is independent of the first", () => {
  for (const [codec, name] of CALLS) {
    const v = { dct: DCT, ccitt: CC, jbig2: JB, jpx: JPX }[codec].variants.find((x) => x.name === name);
    const bytes = b64(v.jpeg_b64 ?? v.data_b64 ?? v.stream_b64), before = sha(bytes);
    const globals = b64(v.globals_b64), gBefore = globals && sha(globals);
    answer(() => codec === "dct" ? decodeBaselineJpeg(bytes, { rotate: v.rotate })
      : codec === "ccitt" ? ccittDecode(bytes, { K: v.K, columns: v.columns, rows: v.rows, byteAlign: v.byteAlign })
      : codec === "jbig2" ? decodeJbig2(bytes, globals) : decodeJpx(bytes));
    assert.equal(sha(bytes), before, `${codec} ${name}: input unchanged`);
    if (globals) assert.equal(sha(globals), gBefore, `${codec} ${name}: globals unchanged`);
  }
  /* Two MQ decoders over the same bytes, interleaved, decode the same decisions. */
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 73 + 5) & 0xff);
  const a = new MqDecoder(bytes), b = new MqDecoder(bytes), ca = mqContexts(4), cb = mqContexts(4);
  const da = [], db = [];
  for (let i = 0; i < 300; i++) { da.push(a.decode(ca, i % 4)); db.push(b.decode(cb, i % 4)); }
  assert.deepEqual(da, db);
});

/** R11's answer for a DCT fixture: its rows joined, and the rest, or its refusal. */
const rowsAnswer = (v) => answer(() => {
  const parts = [];
  const info = decodeBaselineJpegRows(b64(v.jpeg_b64), { onRows: (rows) => parts.push(rows.slice()) });
  return { ...info, samples: Buffer.concat(parts) };
});
const rowsAnswers = () => DCT.variants.map(rowsAnswer);

test("R8 R11 pure, the strip-wise JPEG decoder too: the same answers in any order, with no clock, randomness or I/O, and no input changed", () => {
  const first = rowsAnswers().map(summary);
  assert.deepEqual([...DCT.variants].reverse().map((v) => summary(rowsAnswer(v))).reverse(), first, "in reverse order, the same answers");
  const saved = { now: Date.now, random: Math.random, perf: globalThis.performance, fetch: globalThis.fetch, crypto: globalThis.crypto };
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  let got;
  try {
    Date.now = trap("the clock");
    Math.random = trap("randomness");
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    globalThis.fetch = trap("the network");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    got = rowsAnswers();
  } finally {
    Date.now = saved.now; Math.random = saved.random; globalThis.fetch = saved.fetch;
    Object.defineProperty(globalThis, "performance", { value: saved.perf, configurable: true, writable: true });
    Object.defineProperty(globalThis, "crypto", { value: saved.crypto, configurable: true, writable: true });
  }
  assert.deepEqual(got.map(summary), first);
  for (const v of DCT.variants) {
    const d = b64(v.jpeg_b64), before = sha(d);
    answer(() => decodeBaselineJpegRows(d, { onRows: () => {} }));
    assert.equal(sha(d), before, `dct ${v.name}: input unchanged`);
  }
});

/** A PNG answer as a comparable value: the samples' digest and the rest, or the refusal. */
const pngSummary = (a) => (a instanceof Error ? summary(a) : { digest: sha(a.samples), width: a.width, height: a.height, comps: a.comps, detail: a.detail });

test("R8 pure, the PNG decoder too: the same bytes always answer the same way, in any order and all at once", async () => {
  const first = [];
  for (const [, bytes] of PNG_INPUTS) first.push(pngSummary(await decodePng(bytes()).catch((e) => e)));
  const reversed = [];
  for (const [, bytes] of [...PNG_INPUTS].reverse()) reversed.push(pngSummary(await decodePng(bytes()).catch((e) => e)));
  assert.deepEqual(reversed.reverse(), first);
  assert.deepEqual((await pngAnswers()).map(pngSummary), first, "every decode in flight at once");
});

test("R8 the PNG decoder reaches for no clock, no randomness and no I/O, and changes no input", async () => {
  const want = (await pngAnswers()).map(pngSummary);
  const saved = { now: Date.now, random: Math.random, perf: globalThis.performance, fetch: globalThis.fetch, crypto: globalThis.crypto };
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  let got;
  try {
    Date.now = trap("the clock");
    Math.random = trap("randomness");
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    globalThis.fetch = trap("the network");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    got = await pngAnswers();
  } finally {
    Date.now = saved.now; Math.random = saved.random; globalThis.fetch = saved.fetch;
    Object.defineProperty(globalThis, "performance", { value: saved.perf, configurable: true, writable: true });
    Object.defineProperty(globalThis, "crypto", { value: saved.crypto, configurable: true, writable: true });
  }
  for (const a of got) if (a instanceof Error) assert.doesNotMatch(a.message, /the decoder reached for/);
  assert.deepEqual(got.map(pngSummary), want);
  for (const [name, bytes] of PNG_INPUTS) {
    const d = bytes(), before = sha(d);
    await decodePng(d).catch(() => {});
    assert.equal(sha(d), before, `png ${name}: input unchanged`);
  }
});

test("R9 no place is named in anything the module declares or answers", async () => {
  const PLACES = /oakland|alameda|california|berkeley|san francisco|sacramento|los angeles|legistar/i;
  const said = [];
  const collect = (v, depth = 0) => {
    if (typeof v === "string") said.push(v);
    else if (v && typeof v === "object" && !ArrayBuffer.isView(v) && depth < 6) for (const [k, x] of Object.entries(v)) { said.push(k); collect(x, depth + 1); }
  };
  collect(JBIG2_REFUSES); collect(JPX_REFUSES); collect(PNG_REFUSES);
  for (const a of [...CALLS.map(([, , fn]) => answer(fn)), ...(await pngAnswers())]) {
    if (a instanceof Error) { said.push(a.message, a.code); collect(a.detail); } else collect(a);
  }
  assert.ok(said.length > 500);
  assert.deepEqual(said.filter((s) => PLACES.test(s)), []);
});
