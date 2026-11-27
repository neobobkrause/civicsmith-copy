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
import { ccittDecode, CcittRefusal } from "../../src/ccittdecode.mjs";
import { decodeJbig2, JBIG2_REFUSES, Jbig2Refusal } from "../../src/jbig2decode.mjs";
import { decodeJpx, JPX_REFUSES, JpxRefusal } from "../../src/jpxdecode.mjs";
import { MqDecoder, mqContexts } from "../../src/mq.mjs";
import { decodePng, PNG_REFUSES, PngRefusal } from "../../src/pngdecode.mjs";

/** @import { PngImage } from "../../src/pngdecode.mjs" */
/** @import { DecodedJpeg, JpegInfo } from "../../src/dctdecode.mjs" */
/** @import { Jbig2Image } from "../../src/jbig2decode.mjs" */
/** @import { JpxImage } from "../../src/jpxdecode.mjs" */

/** The four codecs whose fixtures are decoded synchronously. @typedef {"dct" | "ccitt" | "jbig2" | "jpx"} Codec */
/** A fixture record of any codec as this test reads it: each codec's records carry their own members, and lack the others.
 *  @typedef {Object} Variant
 *  @property {string} name
 *  @property {string} [expect] "ok", or the code it is refused with
 *  @property {number} [rotate] DCT: degrees clockwise
 *  @property {string} [jpeg_b64] DCT: the file, base64
 *  @property {string} [data_b64] CCITT, JPX and PNG: the data, base64
 *  @property {string} [stream_b64] JBIG2: the stream, base64
 *  @property {string | null} [globals_b64] JBIG2: its JBIG2Globals, base64, or null
 *  @property {number} [K] CCITT @property {number} [columns] CCITT @property {number} [rows] CCITT @property {boolean} [byteAlign] CCITT
 *  @property {string} [pillow_sha256] DCT and PNG: Pillow's digest
 *  @property {string | null} [jbig2dec_sha256] JBIG2: jbig2dec's digest (null where jbig2dec cannot decode it)
 *  @property {string} [opj_sha256] JPX: OpenJPEG's digest
 *  @property {string} [libtiff_sha256] CCITT: libtiff's digest
 *  @property {string} [construction_sha256] JBIG2: the digest of the picture encoded, where jbig2dec's is not the expectation
 *  @property {string} [note] */
/** @typedef {Variant & { rotate: number, jpeg_b64: string }} DctVariant */
/** @typedef {Variant & { K: number, columns: number, rows: number, byteAlign: boolean, data_b64: string }} CcittVariant */
/** @typedef {Variant & { stream_b64: string, globals_b64: string | null }} Jbig2Variant */
/** A JPX record, or a PNG one Pillow wrote. @typedef {Variant & { data_b64: string }} DataVariant */
/** @template V @typedef {{ provenance: string, variants: readonly V[] }} Fixtures */
/** @typedef {{ provenance: string, suite: Variant[], variants: DataVariant[] }} PngFixtures */
/** The digest members a fixture names its independent decoder's picture by. @typedef {"pillow_sha256" | "jbig2dec_sha256" | "opj_sha256" | "libtiff_sha256"} DigestField */
/** A decode's answer: R1's picture, CCITT's packed rows, a JBIG2 page, a JPX picture, or R11's rows joined, and the rest.
 *  @typedef {DecodedJpeg | { packed: Uint8Array, rowsDecoded: number } | Jbig2Image | JpxImage | RowsJoined} Decoded */
/** R11's answer: what the strip-wise decoder says of the picture, and its rows joined. @typedef {JpegInfo & { samples: Buffer }} RowsJoined */

const DCT = /** @type {Fixtures<DctVariant>} decodes the recorded dct-variants.json */ (JSON.parse(readFileSync(new URL("../fixtures/dct-variants.json", import.meta.url), "utf8")));
const JB = /** @type {Fixtures<Jbig2Variant>} decodes the recorded jbig2-variants.json */ (JSON.parse(readFileSync(new URL("../fixtures/jbig2-variants.json", import.meta.url), "utf8")));
const JPX = /** @type {Fixtures<DataVariant>} decodes the recorded jpx-variants.json */ (JSON.parse(readFileSync(new URL("../fixtures/jpx-variants.json", import.meta.url), "utf8")));
const CC = /** @type {Fixtures<CcittVariant>} decodes the recorded ccitt-variants.json */ (JSON.parse(readFileSync(new URL("fixtures/ccitt-variants.json", import.meta.url), "utf8")));
const PNG = /** @type {PngFixtures} decodes the recorded png-variants.json */ (JSON.parse(readFileSync(new URL("fixtures/png-variants.json", import.meta.url), "utf8")));
const SUITE_DIR = new URL("fixtures/pngsuite/", import.meta.url);
/** @param {string} name @returns {Uint8Array} */
const pngFile = (name) => new Uint8Array(readFileSync(new URL(name, SUITE_DIR)));
/** @param {string} s @returns {Uint8Array} */
const bytesOf = (s) => new Uint8Array(Buffer.from(s, "base64"));
/** @param {string | null | undefined} s @returns {Uint8Array | null} */
const b64 = (s) => (s == null ? null : bytesOf(s));
/** @param {Uint8Array | Buffer} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** Every fixture of every codec as [codec, name, () => answer], answer being the
 *  decode's result or the refusal it threw.
 *  @type {Array<[Codec, string, () => Decoded]>} */
const CALLS = [
  ...DCT.variants.map(/** @returns {[Codec, string, () => Decoded]} */ (v) => ["dct", v.name, () => decodeBaselineJpeg(bytesOf(v.jpeg_b64), { rotate: v.rotate })]),
  ...CC.variants.map(/** @returns {[Codec, string, () => Decoded]} */ (v) => ["ccitt", v.name, () => ccittDecode(bytesOf(v.data_b64), { K: v.K, columns: v.columns, rows: v.rows, byteAlign: v.byteAlign })]),
  ...JB.variants.map(/** @returns {[Codec, string, () => Decoded]} */ (v) => ["jbig2", v.name, () => decodeJbig2(bytesOf(v.stream_b64), b64(v.globals_b64))]),
  ...JPX.variants.map(/** @returns {[Codec, string, () => Decoded]} */ (v) => ["jpx", v.name, () => decodeJpx(bytesOf(v.data_b64))]),
];
/** What was thrown, as the Error every decoder throws (anything else is thrown on). @param {unknown} e @returns {Error} */
const caught = (e) => { if (e instanceof Error) return e; throw e; };
/** @template T @param {() => T} fn @returns {T | Error} */
const answer = (fn) => { try { return fn(); } catch (e) { return caught(e); } };
/** Every PNG fixture as [name, () => bytes]: the suite's files and the constructed ones.
 *  `decodePng` answers a Promise, so its answers are awaited apart from CALLS'.
 *  @type {Array<[string, () => Uint8Array]>} */
const PNG_INPUTS = [
  ...PNG.suite.map(/** @returns {[string, () => Uint8Array]} */ (e) => [e.name, () => pngFile(e.name)]),
  ...PNG.variants.map(/** @returns {[string, () => Uint8Array]} */ (v) => [v.name, () => bytesOf(v.data_b64)]),
];
/** @returns {Promise<Array<PngImage | Error>>} */
const pngAnswers = () => Promise.all(PNG_INPUTS.map(([, bytes]) => decodePng(bytes()).catch(caught)));
/** A thrown answer as R8 compares it: the refusal class it is of, by name (as its constructor's name read), its code,
 *  message and detail (an Error of none of the module's classes: its own name, and its code and detail if it has them).
 *  @param {Error} a @returns {{ refused: string, code: unknown, message: string, detail: unknown }} */
function thrown(a) {
  if (a instanceof DctRefusal) return { refused: "DctRefusal", code: a.code, message: a.message, detail: a.detail };
  if (a instanceof CcittRefusal) return { refused: "CcittRefusal", code: a.code, message: a.message, detail: a.detail };
  if (a instanceof Jbig2Refusal) return { refused: "Jbig2Refusal", code: a.code, message: a.message, detail: a.detail };
  if (a instanceof JpxRefusal) return { refused: "JpxRefusal", code: a.code, message: a.message, detail: a.detail };
  if (a instanceof PngRefusal) return { refused: "PngRefusal", code: a.code, message: a.message, detail: a.detail };
  return { refused: a.name, code: "code" in a ? a.code : undefined, message: a.message, detail: "detail" in a ? a.detail : undefined };
}
/** An answer as a comparable value: the samples' digest and the rest, or the refusal.
 *  @param {Decoded | Error} a @returns {object} */
function summary(a) {
  if (a instanceof Error) return thrown(a);
  if ("samples" in a) { const { samples, ...rest } = a; return { digest: sha(samples), ...rest }; }
  const { packed, ...rest } = a;
  return { digest: sha(packed), ...rest };
}

test("R6 each codec's fixtures name an independent decoder and carry its digest for every picture", () => {
  /** @type {Array<[Fixtures<Variant>, RegExp, DigestField]>} */
  const RECORDS = [[DCT, /libjpeg-turbo/, "pillow_sha256"], [JB, /^jbig2dec /, "jbig2dec_sha256"],
    [JPX, /OpenJPEG/, "opj_sha256"], [CC, /^libtiff /, "libtiff_sha256"],
    [{ provenance: PNG.provenance, variants: [...PNG.suite, ...PNG.variants] }, /^Pillow 12\.3\.0 .*PngSuite/, "pillow_sha256"]];
  for (const [fix, decoder, field] of RECORDS) {
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
  /** @type {{ dct: string[], jbig2: string[], jpx: string[] }} */
  const CLASSES = {
    dct: ["NOT_A_JPEG", "TRUNCATED", "IMAGE_TOO_LARGE", "UNSUPPORTED_PROCESS", "UNSUPPORTED_PRECISION", "UNSUPPORTED_FRAME", "CORRUPT_DATA",
      "UNSUPPORTED_COMPONENTS", "COMPONENT_MISMATCH", "COLOR_TRANSFORM_CONFLICT", "UNSUPPORTED_SAMPLING", "UNSUPPORTED_ROTATION"],
    jbig2: ["UNSUPPORTED", "TRUNCATED", "CORRUPT", "IMAGE_TOO_LARGE"],
    jpx: ["UNSUPPORTED", "UNSUPPORTED_SAMPLES", "TRUNCATED", "CORRUPT", "IMAGE_TOO_LARGE"],
  };
  const KIND = { dct: DctRefusal, jbig2: Jbig2Refusal, jpx: JpxRefusal };
  const KIND_NAME = { dct: "DctRefusal", jbig2: "Jbig2Refusal", jpx: "JpxRefusal" };
  /** The feature an UNSUPPORTED refusal names (a DCT refusal names none). @param {DctRefusal | Jbig2Refusal | JpxRefusal} a @returns {string | undefined} */
  const featureOf = (a) => (a instanceof DctRefusal ? undefined : a.detail.feature);
  /** Whether that feature is a key of its codec's declared set (DCT declares none: a TypeError, as `in undefined` was).
   *  @param {DctRefusal | Jbig2Refusal | JpxRefusal} a @returns {boolean} */
  const declared = (a) => {
    if (a instanceof Jbig2Refusal) return String(a.detail.feature) in JBIG2_REFUSES;
    if (a instanceof JpxRefusal) return String(a.detail.feature) in JPX_REFUSES;
    throw new TypeError("Cannot use 'in' operator: DCT declares no refusal set");
  };
  let refusals = 0;
  /** @type {{ dct: Set<string>, jbig2: Set<string>, jpx: Set<string> }} */
  const codes = { dct: new Set(), jbig2: new Set(), jpx: new Set() };
  /** @param {string[]} list @returns {string[]} */
  const fixtureCodes = (list) => list.filter((c) => c !== "IMAGE_TOO_LARGE").sort();
  for (const [codec, name, fn] of CALLS) {
    const a = answer(fn);
    if (!(a instanceof Error)) continue;
    refusals++;
    if (codec === "ccitt") throw new TypeError(`${codec} ${name}: Right-hand side of 'instanceof' is not callable (CCITT has no refusal kind here)`);
    assert.ok(a instanceof KIND[codec], `${codec} ${name}: a ${KIND_NAME[codec]}`);
    assert.ok(CLASSES[codec].includes(a.code), `${codec} ${name}: ${a.code}`);
    if (a.code === "UNSUPPORTED") assert.ok(declared(a), `${codec} ${name}: '${featureOf(a)}'`);
    codes[codec].add(a.code);
  }
  assert.equal(refusals, 4 + 14 + 13);
  /* The codes are part of R7 too: JBIG2's and JPX's are all reached by the corpus
   * (DCT's eleven are all driven in dct.test.mjs). */
  /* ... but for IMAGE_TOO_LARGE, which no fixture draws and bounds.test.mjs drives (R12). */
  assert.deepEqual([...codes.jbig2].sort(), fixtureCodes(CLASSES.jbig2));
  assert.deepEqual([...codes.jpx].sort(), fixtureCodes(CLASSES.jpx));
});

test("R7 every refusal a PNG fixture draws is a PngRefusal under one of R10's codes, an UNSUPPORTED one naming a declared key", async () => {
  const got = await pngAnswers();
  /** @type {Set<string>} */
  const codes = new Set();
  /** @type {Set<string | undefined>} */
  const features = new Set();
  for (const [i, a] of got.entries()) {
    if (!(a instanceof Error)) continue;
    const input = PNG_INPUTS[i];
    if (input === undefined) throw new TypeError(`no PNG input ${i}`);
    const name = input[0];
    assert.ok(a instanceof PngRefusal, `png ${name}: a PngRefusal`);
    assert.ok(["NOT_A_PNG", "UNSUPPORTED", "TRUNCATED", "CORRUPT"].includes(a.code), `png ${name}: ${a.code}`);
    if (a.code === "UNSUPPORTED") { assert.ok(String(a.detail.feature) in PNG_REFUSES, `png ${name}: '${a.detail.feature}'`); features.add(a.detail.feature); }
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

test("R8 no clock, no randomness, no I/O: every decode answers the same with them all taken away", (t) => {
  const want = CALLS.map(([, , fn]) => summary(answer(fn)));
  const saved = { perf: globalThis.performance, crypto: globalThis.crypto };
  /** @param {string} what @returns {() => never} */
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  try {
    t.mock.method(Date, "now", trap("the clock"));
    t.mock.method(Math, "random", trap("randomness"));
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    t.mock.method(globalThis, "fetch", trap("the network"));
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    const got = CALLS.map(([, , fn]) => answer(fn));
    for (const a of got) if (a instanceof Error) assert.doesNotMatch(a.message, /the decoder reached for/);
    assert.deepEqual(got.map(summary), want);
  } finally {
    t.mock.restoreAll();
    Object.defineProperty(globalThis, "performance", { value: saved.perf, configurable: true, writable: true });
    Object.defineProperty(globalThis, "crypto", { value: saved.crypto, configurable: true, writable: true });
  }
});

test("R8 no state carried between calls: the input is never changed, and a second decoder is independent of the first", () => {
  for (const [codec, name] of CALLS) {
    /** @type {readonly Variant[]} */
    const variants = { dct: DCT, ccitt: CC, jbig2: JB, jpx: JPX }[codec].variants;
    const v = variants.find((x) => x.name === name);
    if (v === undefined) throw new TypeError(`${codec} ${name}: no such fixture (reading it was a TypeError)`);
    const bytes = b64(v.jpeg_b64 ?? v.data_b64 ?? v.stream_b64);
    if (bytes === null) throw new TypeError(`${codec} ${name}: no data (hashing it was a TypeError)`);
    const before = sha(bytes);
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
  /** @type {number[]} */
  const da = [];
  /** @type {number[]} */
  const db = [];
  for (let i = 0; i < 300; i++) { da.push(a.decode(ca, i % 4)); db.push(b.decode(cb, i % 4)); }
  assert.deepEqual(da, db);
});

/** R11's answer for a DCT fixture: its rows joined, and the rest, or its refusal.
 *  @param {DctVariant} v @returns {RowsJoined | Error} */
const rowsAnswer = (v) => answer(/** @returns {RowsJoined} */ () => {
  /** @type {Uint8Array[]} */
  const parts = [];
  const info = decodeBaselineJpegRows(b64(v.jpeg_b64), { onRows: (rows) => parts.push(rows.slice()) });
  return { ...info, samples: Buffer.concat(parts) };
});
/** @returns {Array<RowsJoined | Error>} */
const rowsAnswers = () => DCT.variants.map((v) => rowsAnswer(v));

test("R8 R11 pure, the strip-wise JPEG decoder too: the same answers in any order, with no clock, randomness or I/O, and no input changed", (t) => {
  const first = rowsAnswers().map(summary);
  assert.deepEqual([...DCT.variants].reverse().map((v) => summary(rowsAnswer(v))).reverse(), first, "in reverse order, the same answers");
  const saved = { perf: globalThis.performance, crypto: globalThis.crypto };
  /** @param {string} what @returns {() => never} */
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  /** @type {Array<RowsJoined | Error>} */
  let got;
  try {
    t.mock.method(Date, "now", trap("the clock"));
    t.mock.method(Math, "random", trap("randomness"));
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    t.mock.method(globalThis, "fetch", trap("the network"));
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    got = rowsAnswers();
  } finally {
    t.mock.restoreAll();
    Object.defineProperty(globalThis, "performance", { value: saved.perf, configurable: true, writable: true });
    Object.defineProperty(globalThis, "crypto", { value: saved.crypto, configurable: true, writable: true });
  }
  assert.deepEqual(got.map(summary), first);
  for (const v of DCT.variants) {
    const d = bytesOf(v.jpeg_b64), before = sha(d);
    answer(() => decodeBaselineJpegRows(d, { onRows: () => {} }));
    assert.equal(sha(d), before, `dct ${v.name}: input unchanged`);
  }
});

/** A PNG answer as a comparable value: the samples' digest and the rest, or the refusal. @param {PngImage | Error} a @returns {object} */
const pngSummary = (a) => (a instanceof Error ? summary(a) : { digest: sha(a.samples), width: a.width, height: a.height, comps: a.comps, detail: a.detail });

test("R8 pure, the PNG decoder too: the same bytes always answer the same way, in any order and all at once", async () => {
  /** @type {object[]} */
  const first = [];
  for (const [, bytes] of PNG_INPUTS) first.push(pngSummary(await decodePng(bytes()).catch(caught)));
  /** @type {object[]} */
  const reversed = [];
  for (const [, bytes] of [...PNG_INPUTS].reverse()) reversed.push(pngSummary(await decodePng(bytes()).catch(caught)));
  assert.deepEqual(reversed.reverse(), first);
  assert.deepEqual((await pngAnswers()).map(pngSummary), first, "every decode in flight at once");
});

test("R8 the PNG decoder reaches for no clock, no randomness and no I/O, and changes no input", async (t) => {
  const want = (await pngAnswers()).map(pngSummary);
  const saved = { perf: globalThis.performance, crypto: globalThis.crypto };
  /** @param {string} what @returns {() => never} */
  const trap = (what) => () => { throw new Error(`the decoder reached for ${what}`); };
  /** @type {Array<PngImage | Error>} */
  let got;
  try {
    t.mock.method(Date, "now", trap("the clock"));
    t.mock.method(Math, "random", trap("randomness"));
    Object.defineProperty(globalThis, "performance", { value: { now: trap("the clock") }, configurable: true, writable: true });
    t.mock.method(globalThis, "fetch", trap("the network"));
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    got = await pngAnswers();
  } finally {
    t.mock.restoreAll();
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
  /** @type {Array<unknown>} */
  const said = [];
  /** @param {unknown} v @param {number} [depth] @returns {void} */
  const collect = (v, depth = 0) => {
    if (typeof v === "string") said.push(v);
    else if (v && typeof v === "object" && !ArrayBuffer.isView(v) && depth < 6) for (const [k, x] of Object.entries(v)) { said.push(k); collect(x, depth + 1); }
  };
  collect(JBIG2_REFUSES); collect(JPX_REFUSES); collect(PNG_REFUSES);
  for (const a of [...CALLS.map(([, , fn]) => answer(fn)), ...(await pngAnswers())]) {
    if (a instanceof Error) { const t = thrown(a); said.push(a.message, t.code); collect(t.detail); } else collect(a);
  }
  assert.ok(said.length > 500);
  assert.deepEqual(said.filter((s) => PLACES.test(String(s))), []);
});
