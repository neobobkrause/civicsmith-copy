/* image-codecs R3, R6: `decodeJbig2`, `JBIG2_REFUSES` and `Jbig2Refusal` at their
 * interface (build/requirements/image-codecs.md).
 *
 * INDEPENDENT EXPECTATIONS (R6). Every expected picture is jbig2dec 0.20's decode
 * of the same stream (packed 1 bit a pixel, set bit = black, as `decodeJbig2`
 * packs), written by `../fixtures/make-jbig2-fixtures.py` into
 * `../fixtures/jbig2-variants.json`: the seven pages of a production scanner's
 * ordinance byte for byte, jbig2enc output, and streams from the script's own
 * T.88 encoder, each kept only when jbig2dec decodes it to exactly the picture
 * encoded. jbig2dec shares no line with `jbig2decode.mjs`. Two fixtures carry
 * `construction_sha256` instead: jbig2dec cannot decode one (an intermediate
 * generic region, its "NYI") and departs from T.88 on the other (a refinement
 * away from the page's origin, its own TODO); their expected picture is the one
 * encoded, with jbig2dec's answer recorded beside it. */
import "../../../bio-plane/test/sandbox.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeJbig2, JBIG2_REFUSES, Jbig2Refusal } from "../../src/jbig2decode.mjs";
import { localize } from "../../../bio-plane/src/setup-words/index.mjs";
import { MqDecoder } from "../../src/mq.mjs";
/** @import { Jbig2Image } from '../../src/jbig2decode.mjs' */

/** A stream of `../fixtures/jbig2-variants.json` that jbig2dec (or, for two, the encoder) decodes to a picture.
 *  @typedef {Object} OkVariant
 *  @property {string} name
 *  @property {string[]} features
 *  @property {"ok"} expect
 *  @property {string} stream_b64 the stream, base64
 *  @property {string | null} globals_b64 its JBIG2Globals, base64, or null
 *  @property {number} width
 *  @property {number} height
 *  @property {string | null} jbig2dec_sha256 the digest of jbig2dec's picture (null where jbig2dec cannot decode it)
 *  @property {string} pdf_samples_sha256 the digest of the picture complemented, row padding cleared
 *  @property {number} [black] the black pixels
 *  @property {string} [construction_sha256] the digest of the picture encoded, where jbig2dec's is not the expectation
 *  @property {string} [note] */
/** A stream of `../fixtures/jbig2-variants.json` that jbig2dec refuses or finds cut short.
 *  @typedef {Object} RefusedVariant
 *  @property {string} name
 *  @property {string[]} features
 *  @property {"UNSUPPORTED" | "TRUNCATED" | "CORRUPT"} expect the refusal's code
 *  @property {string} stream_b64 the stream, base64
 *  @property {string | null} globals_b64 its JBIG2Globals, base64, or null
 *  @property {string} jbig2dec what jbig2dec says of it
 *  @property {undefined} [width] @property {undefined} [height] @property {undefined} [jbig2dec_sha256]
 *  @property {undefined} [pdf_samples_sha256] @property {undefined} [black] @property {undefined} [construction_sha256] */
/** @typedef {OkVariant | RefusedVariant} Variant */
/** @typedef {Object} Jbig2Fixtures @property {string} provenance @property {Variant[]} variants */

const FIX = /** @type {Jbig2Fixtures} decodes the recorded jbig2-variants.json, written by make-jbig2-fixtures.py */ (JSON.parse(readFileSync(new URL("../fixtures/jbig2-variants.json", import.meta.url), "utf8")));
const V = FIX.variants;
/** @param {string} s @returns {Uint8Array} */
const bytes = (s) => new Uint8Array(Buffer.from(s, "base64"));
/** @param {string | null} s @returns {Uint8Array | null} */
const b64 = (s) => (s == null ? null : bytes(s));
/** @param {Uint8Array} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");
/** @param {Variant} v @returns {Jbig2Image} @throws {Jbig2Refusal} */
const decode = (v) => decodeJbig2(bytes(v.stream_b64), b64(v.globals_b64));
/** What `fn` throws, or undefined when it returns. @param {() => unknown} fn @returns {unknown} */
const thrown = (fn) => { try { fn(); } catch (x) { return x; } return undefined; };
/** The complement, each row's padding bits cleared: the fixture's `pdf_samples_sha256`.
 *  @param {Uint8Array} packed @param {number} w @param {number} h @returns {Uint8Array} */
function pdfSamples(packed, w, h) {
  const rb = Math.ceil(w / 8), mask = w % 8 ? (0xff << (8 - (w % 8))) & 0xff : 0xff;
  const out = packed.map((b) => ~b & 0xff);
  for (let y = 0; y < h; y++) { const at = y * rb + rb - 1; out[at] = (out[at] ?? 0) & mask; }
  return out;
}
const BITS = Uint8Array.from({ length: 256 }, (_, i) => [...i.toString(2)].filter((c) => c === "1").length);

test("R3 R6 the fixtures: jbig2dec's decode, 94 decodable and 14 refused or cut short", () => {
  assert.match(FIX.provenance, /^jbig2dec /);
  assert.deepEqual([V.filter((v) => v.expect === "ok").length, V.filter((v) => v.expect !== "ok").length], [94, 14]);
  const byConstruction = V.filter((v) => v.construction_sha256).map((v) => v.name).sort();
  assert.deepEqual(byConstruction, ["intermediate-generic-refined", "refine-onto-page-offset"]);
  for (const v of V.filter((x) => x.expect === "ok" && !x.construction_sha256)) assert.match(v.jbig2dec_sha256 ?? "", /^[0-9a-f]{64}$/, v.name);
});

test("R3 R6 every decodable fixture: jbig2dec's picture, pixel for pixel", () => {
  for (const v of V.filter((x) => x.expect === "ok")) {
    const out = decode(v);
    assert.deepEqual([out.width, out.height], [v.width, v.height], v.name);
    assert.equal(out.packed.length, Math.ceil(v.width / 8) * v.height, v.name);
    /* jbig2dec's digest covers its own row padding, so it is compared as is
     * only where the rows have none; everywhere, the picture with its padding
     * cleared is compared with the fixture's digest of the same (complemented,
     * as the PDF samples are, by the script from jbig2dec's decode). */
    if (v.width % 8 === 0) assert.equal(sha(out.packed), v.construction_sha256 ?? v.jbig2dec_sha256, `${v.name}: ${v.construction_sha256 ? "the picture encoded" : "jbig2dec's picture"}`);
    assert.equal(sha(pdfSamples(out.packed, v.width, v.height)), v.pdf_samples_sha256, `${v.name}: the picture, padding cleared`);
    const black = v.black;
    if (black != null && v.width % 8 === 0) assert.equal(out.packed.reduce((n, b) => n + (BITS[b] ?? 0), 0), black, `${v.name}: black pixels`);
  }
});

test("R3 what it decodes: generic and refinement regions, symbol dictionaries and text regions, MMR, Huffman and arithmetic, patterns and halftones", () => {
  /** @type {Set<string>} */
  const decoded = new Set();
  for (const v of V.filter((x) => x.expect === "ok")) for (const d of decode(v).detail.decoded) decoded.add(d);
  /** @param {RegExp} re @returns {boolean} */
  const has = (re) => [...decoded].some((d) => re.test(d));
  /* The two localized details are compared with the same localize call the
   * decoder makes (image-codecs R3, K3962): a prefix, the TPGDON/TPGRON tail aside. */
  /** @param {number} template @returns {string} */
  const arithPrefix = (template) => localize("image-codecs.jbig2decode.generic_region_arithmetic_template_template",
    "generic region, arithmetic, template {template}{v1}", { template: String(template), v1: "" });
  /** @param {number} template @returns {string} */
  const refinePrefix = (template) => localize("image-codecs.jbig2decode.generic_refinement_region_template_template",
    "generic refinement region, template {template}{v1}", { template: String(template), v1: "" });
  /** @param {string} p @returns {boolean} */
  const hasPrefix = (p) => [...decoded].some((d) => d.startsWith(p));
  /** @type {[string, RegExp][]} */
  const wanted = [
    ["generic region, MMR", /^generic region, MMR$/],
    ["symbol dictionary, arithmetic", /^symbol dictionary, arithmetic/],
    ["symbol dictionary, Huffman", /^symbol dictionary, Huffman/],
    ["symbol dictionary, refinement/aggregate", /refinement\/aggregate/],
    ["text region, arithmetic", /^text region, arithmetic/],
    ["text region, Huffman", /^text region, Huffman/],
    ["custom Huffman table", /^custom Huffman table$/],
    ["pattern dictionary", /^pattern dictionary/],
    ["halftone region", /^halftone region/],
  ];
  for (const [what, re] of wanted) assert.ok(has(re), what);
  for (const t of [0, 1, 2, 3]) assert.ok(hasPrefix(arithPrefix(t)), `arithmetic template ${t}`);
  for (const t of [0, 1]) assert.ok(hasPrefix(refinePrefix(t)), `refinement template ${t}`);
});

test("R3 the production scanner's pages, with their JBIG2Globals, decode to jbig2dec's pictures", () => {
  const pages = V.filter((v) => v.name.startsWith("ordinance-page-"));
  assert.equal(pages.length, 7);
  for (const v of pages) {
    assert.ok(v.globals_b64, `${v.name} carries its globals`);
    assert.equal(sha(decode(v).packed), v.jbig2dec_sha256, v.name);
    assert.throws(() => decodeJbig2(bytes(v.stream_b64), null), Jbig2Refusal, `${v.name} without its globals is refused, not guessed`);
  }
});

test("R3 what it cannot decode is a Jbig2Refusal naming the feature (a key of JBIG2_REFUSES) and the segment type", () => {
  /** @type {Set<string>} */
  const driven = new Set();
  for (const v of V.filter((x) => x.expect !== "ok")) {
    const e = thrown(() => decode(v));
    assert.ok(e instanceof Jbig2Refusal, `${v.name}: a Jbig2Refusal`);
    const code = e.code;
    assert.equal(code, v.expect, v.name);
    if (code === "UNSUPPORTED") {
      const feature = e.detail.feature;
      assert.ok(feature !== undefined && feature in JBIG2_REFUSES, `${v.name}: '${feature}' is declared`);
      assert.equal(feature, v.name.slice("UNSUPPORTED:".length), v.name);
      driven.add(feature);
    }
    if (e.detail.segment !== undefined) assert.equal(typeof e.detail.segmentType, "number", `${v.name}: the segment type is named`);
  }
  assert.deepEqual([...driven].sort(), Object.keys(JBIG2_REFUSES).sort(), "every declared refusal is driven");
  const inSegment = V.filter((x) => x.expect === "UNSUPPORTED" && !["no page"].includes(x.name.slice(12)));
  for (const v of inSegment) { try { decode(v); } catch (e) { assert.ok(e instanceof Jbig2Refusal); assert.equal(typeof e.detail.segmentType, "number", v.name); } }
});

test("R3 a stream cut short is refused TRUNCATED, never padded into a picture", () => {
  const page = V.find((v) => v.name === "ordinance-page-2");
  if (page === undefined) throw new TypeError("the fixtures hold no ordinance-page-2");
  const s = bytes(page.stream_b64);
  for (const cut of [s.length >> 1, s.length - 40, 45]) {
    const e = thrown(() => decodeJbig2(s.subarray(0, cut), b64(page.globals_b64)));
    assert.ok(e instanceof Jbig2Refusal && e.code === "TRUNCATED", `cut at ${cut}: ${e instanceof Jbig2Refusal ? e.code : undefined}`);
  }
});

/** A fixture's stream with its page information and its first generic region declaring `h` rows, the data unchanged.
 *  @param {Variant} v @param {number} h @returns {Uint8Array} */
function declaringRows(v, h) {
  const d = Uint8Array.from(bytes(v.stream_b64));
  /** @param {number} p @returns {number} */
  const u32 = (p) => (((d[p] ?? 0) << 24) | ((d[p + 1] ?? 0) << 16) | ((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0)) >>> 0;
  /** @param {number} p @param {number} n @returns {void} */
  const put = (p, n) => { d[p] = n >>> 24; d[p + 1] = (n >>> 16) & 255; d[p + 2] = (n >>> 8) & 255; d[p + 3] = n & 255; };
  for (let p = 0; p < d.length;) {
    const flags = d[p + 4] ?? 0, count = (d[p + 5] ?? 0) >> 5, at = p + 6 + count + (flags & 64 ? 4 : 1), len = u32(at), data = at + 4;
    if ((flags & 63) === 48) put(data + 4, h);
    if ((flags & 63) === 38) put(data + 4, h);
    p = data + len;
  }
  return d;
}

test("R3 R5 (fix round 9, G132l (d)) a region taller than its data, which ends in FF AC, is refused TRUNCATED as the data runs out and no row is invented", () => {
  /* A region's invented rows are found once the coder has fed on the marker past its look-ahead. Twelve of the sixteen
   * generic fixtures draw noise from the 1-bits at 400 rows too many and are refused; the other four (t0-moved,
   * t2-nominal, t3-nominal, t3-moved) draw WHITE from them, which no count of bytes can tell from a whole stream's blank
   * tail (a page that ends in white costs the coder nothing), so they are not asserted: R5 detects what is detectable. */
  const WHITE_TAIL = new Set(["generic-t0-moved", "generic-t2-nominal", "generic-t3-nominal", "generic-t3-moved"]);
  const fixtures = V.filter((v) => /^generic-t[0-3]-(nominal|moved)(-tpgdon)?$/.test(v.name));
  assert.equal(fixtures.length, 16);
  /** @param {() => unknown} fn @returns {{ calls: number, error: unknown }} */
  const callsOf = (fn) => {
    const orig = MqDecoder.prototype.decode;
    let calls = 0;
    MqDecoder.prototype.decode = /** @this {MqDecoder} @param {Uint8Array} ctx @param {number} cx @returns {number} */ function (ctx, cx) { calls++; return orig.call(this, ctx, cx); };
    try { fn(); } catch (e) { return { calls, error: e }; } finally { MqDecoder.prototype.decode = orig; }
    return { calls, error: null };
  };
  for (const v of fixtures) {
    if (v.expect !== "ok") throw new TypeError(`${v.name}: a generic fixture that decodes`);
    const whole = callsOf(() => decodeJbig2(declaringRows(v, v.height), null));
    assert.equal(whole.error, null, `${v.name}: the stream as it is decodes`);
    const { calls, error } = callsOf(() => decodeJbig2(declaringRows(v, v.height + 400), null));
    if (WHITE_TAIL.has(v.name)) { assert.equal(error, null, `${v.name}: a white tail decodes (the limit above)`); continue; }
    assert.ok(error instanceof Jbig2Refusal && error.code === "TRUNCATED", `${v.name} +400 rows: ${error instanceof Jbig2Refusal ? error.code : undefined}`);
    assert.equal(error.detail.segmentType, 38, `${v.name}: the generic region`);
    assert.ok(calls < whole.calls + 100 * v.width, `${v.name} +400 rows: stopped after ${calls} decisions (the whole stream takes ${whole.calls}; 400 rows more would be ${whole.calls + 400 * v.width}): within 100 rows of the data running out`);
  }
});
