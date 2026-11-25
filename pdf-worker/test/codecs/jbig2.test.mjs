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

const FIX = JSON.parse(readFileSync(new URL("../fixtures/jbig2-variants.json", import.meta.url), "utf8"));
const V = FIX.variants;
const b64 = (s) => (s == null ? null : new Uint8Array(Buffer.from(s, "base64")));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const decode = (v) => decodeJbig2(b64(v.stream_b64), b64(v.globals_b64));
/** The complement, each row's padding bits cleared: the fixture's `pdf_samples_sha256`. */
function pdfSamples(packed, w, h) {
  const rb = Math.ceil(w / 8), mask = w % 8 ? (0xff << (8 - (w % 8))) & 0xff : 0xff;
  const out = packed.map((b) => ~b & 0xff);
  for (let y = 0; y < h; y++) out[y * rb + rb - 1] &= mask;
  return out;
}
const BITS = Uint8Array.from({ length: 256 }, (_, i) => [...i.toString(2)].filter((c) => c === "1").length);

test("R3 R6 the fixtures: jbig2dec's decode, 94 decodable and 14 refused or cut short", () => {
  assert.match(FIX.provenance, /^jbig2dec /);
  assert.deepEqual([V.filter((v) => v.expect === "ok").length, V.filter((v) => v.expect !== "ok").length], [94, 14]);
  const byConstruction = V.filter((v) => v.construction_sha256).map((v) => v.name).sort();
  assert.deepEqual(byConstruction, ["intermediate-generic-refined", "refine-onto-page-offset"]);
  for (const v of V.filter((x) => x.expect === "ok" && !x.construction_sha256)) assert.match(v.jbig2dec_sha256, /^[0-9a-f]{64}$/, v.name);
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
    if (v.black != null && v.width % 8 === 0) assert.equal(out.packed.reduce((n, b) => n + BITS[b], 0), v.black, `${v.name}: black pixels`);
  }
});

test("R3 what it decodes: generic and refinement regions, symbol dictionaries and text regions, MMR, Huffman and arithmetic, patterns and halftones", () => {
  const decoded = new Set();
  for (const v of V.filter((x) => x.expect === "ok")) for (const d of decode(v).detail.decoded) decoded.add(d);
  const has = (re) => [...decoded].some((d) => re.test(d));
  /* The two localized details are compared with the same localize call the
   * decoder makes (image-codecs R3, K3962): a prefix, the TPGDON/TPGRON tail aside. */
  const arithPrefix = (template) => localize("image-codecs.jbig2decode.generic_region_arithmetic_template_template",
    "generic region, arithmetic, template {template}{v1}", { template: String(template), v1: "" });
  const refinePrefix = (template) => localize("image-codecs.jbig2decode.generic_refinement_region_template_template",
    "generic refinement region, template {template}{v1}", { template: String(template), v1: "" });
  const hasPrefix = (p) => [...decoded].some((d) => d.startsWith(p));
  for (const [what, re] of [
    ["generic region, MMR", /^generic region, MMR$/],
    ["symbol dictionary, arithmetic", /^symbol dictionary, arithmetic/],
    ["symbol dictionary, Huffman", /^symbol dictionary, Huffman/],
    ["symbol dictionary, refinement/aggregate", /refinement\/aggregate/],
    ["text region, arithmetic", /^text region, arithmetic/],
    ["text region, Huffman", /^text region, Huffman/],
    ["custom Huffman table", /^custom Huffman table$/],
    ["pattern dictionary", /^pattern dictionary/],
    ["halftone region", /^halftone region/],
  ]) assert.ok(has(re), what);
  for (const t of [0, 1, 2, 3]) assert.ok(hasPrefix(arithPrefix(t)), `arithmetic template ${t}`);
  for (const t of [0, 1]) assert.ok(hasPrefix(refinePrefix(t)), `refinement template ${t}`);
});

test("R3 the production scanner's pages, with their JBIG2Globals, decode to jbig2dec's pictures", () => {
  const pages = V.filter((v) => v.name.startsWith("ordinance-page-"));
  assert.equal(pages.length, 7);
  for (const v of pages) {
    assert.ok(v.globals_b64, `${v.name} carries its globals`);
    assert.equal(sha(decode(v).packed), v.jbig2dec_sha256, v.name);
    assert.throws(() => decodeJbig2(b64(v.stream_b64), null), Jbig2Refusal, `${v.name} without its globals is refused, not guessed`);
  }
});

test("R3 what it cannot decode is a Jbig2Refusal naming the feature (a key of JBIG2_REFUSES) and the segment type", () => {
  const driven = new Set();
  for (const v of V.filter((x) => x.expect !== "ok")) {
    let e;
    try { decode(v); } catch (x) { e = x; }
    assert.ok(e instanceof Jbig2Refusal, `${v.name}: a Jbig2Refusal`);
    assert.equal(e.code, v.expect, v.name);
    if (e.code === "UNSUPPORTED") {
      assert.ok(e.detail.feature in JBIG2_REFUSES, `${v.name}: '${e.detail.feature}' is declared`);
      assert.equal(e.detail.feature, v.name.slice("UNSUPPORTED:".length), v.name);
      driven.add(e.detail.feature);
    }
    if (e.detail.segment !== undefined) assert.equal(typeof e.detail.segmentType, "number", `${v.name}: the segment type is named`);
  }
  assert.deepEqual([...driven].sort(), Object.keys(JBIG2_REFUSES).sort(), "every declared refusal is driven");
  const inSegment = V.filter((x) => x.expect === "UNSUPPORTED" && !["no page"].includes(x.name.slice(12)));
  for (const v of inSegment) { try { decode(v); } catch (e) { assert.equal(typeof e.detail.segmentType, "number", v.name); } }
});

test("R3 a stream cut short is refused TRUNCATED, never padded into a picture", () => {
  const page = V.find((v) => v.name === "ordinance-page-2");
  const s = b64(page.stream_b64);
  for (const cut of [s.length >> 1, s.length - 40, 45]) {
    let e;
    try { decodeJbig2(s.subarray(0, cut), b64(page.globals_b64)); } catch (x) { e = x; }
    assert.ok(e instanceof Jbig2Refusal && e.code === "TRUNCATED", `cut at ${cut}: ${e && e.code}`);
  }
});

/** A fixture's stream with its page information and its first generic region declaring `h` rows, the data unchanged. */
function declaringRows(v, h) {
  const d = Uint8Array.from(b64(v.stream_b64));
  const u32 = (p) => ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0;
  const put = (p, n) => { d[p] = n >>> 24; d[p + 1] = (n >>> 16) & 255; d[p + 2] = (n >>> 8) & 255; d[p + 3] = n & 255; };
  for (let p = 0; p < d.length;) {
    const flags = d[p + 4], count = d[p + 5] >> 5, at = p + 6 + count + (flags & 64 ? 4 : 1), len = u32(at), data = at + 4;
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
  const callsOf = (fn) => {
    const orig = MqDecoder.prototype.decode;
    let calls = 0;
    MqDecoder.prototype.decode = function (...a) { calls++; return orig.apply(this, a); };
    try { fn(); } catch (e) { return { calls, error: e }; } finally { MqDecoder.prototype.decode = orig; }
    return { calls, error: null };
  };
  for (const v of fixtures) {
    const whole = callsOf(() => decodeJbig2(declaringRows(v, v.height), null));
    assert.equal(whole.error, null, `${v.name}: the stream as it is decodes`);
    const { calls, error } = callsOf(() => decodeJbig2(declaringRows(v, v.height + 400), null));
    if (WHITE_TAIL.has(v.name)) { assert.equal(error, null, `${v.name}: a white tail decodes (the limit above)`); continue; }
    assert.ok(error instanceof Jbig2Refusal && error.code === "TRUNCATED", `${v.name} +400 rows: ${error && error.code}`);
    assert.equal(error.detail.segmentType, 38, `${v.name}: the generic region`);
    assert.ok(calls < whole.calls + 100 * v.width, `${v.name} +400 rows: stopped after ${calls} decisions (the whole stream takes ${whole.calls}; 400 rows more would be ${whole.calls + 400 * v.width}): within 100 rows of the data running out`);
  }
});
