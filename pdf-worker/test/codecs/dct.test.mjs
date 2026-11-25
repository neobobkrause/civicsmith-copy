/* image-codecs R1, R6, R11: `decodeBaselineJpeg`, `decodeBaselineJpegRows`,
 * `readJpegHeader`, `colourTransformOf` and `DctRefusal` at their interface
 * (build/requirements/image-codecs.md).
 *
 * INDEPENDENT EXPECTATIONS (R6). Every expected picture is Pillow 11.3.0's decode
 * (libjpeg-turbo 3.1.1, whose SIMD paths are bit-exact with libjpeg's C) of the
 * same bytes, rotated clockwise by the fixture's `rotate`, written by
 * `../fixtures/make-dct-fixtures.py` into `../fixtures/dct-variants.json`.
 * libjpeg-turbo shares no line with `dctdecode.mjs`. `fixtures/dct-edges.json`
 * (T44, from `fixtures/make-dct-edges.py`, Pillow 12.3.0 the same way) adds the
 * sizes where a strip-wise decode has edges: one or two chroma samples wide, one
 * row tall, heights ending inside an MCU row, restart intervals of one block.
 * R11's rows are checked against R1's, which those digests pin. The refusals below that no
 * fixture carries are made by changing one field of a fixture's markers, each
 * named where it is made.
 *
 * R1 (as K117 words it): a DctRefusal carries the codec's own code and a detail
 * saying why; `pdf-pixels` maps each code to its reasons (shown beside each code
 * below for reference, not tested here). */
import "../../../bio-plane/test/sandbox.mjs";
import { localize } from "../../../bio-plane/src/setup-words/index.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeBaselineJpeg, decodeBaselineJpegRows, readJpegHeader, colourTransformOf, DctRefusal } from "../../src/dctdecode.mjs";

const FIX = JSON.parse(readFileSync(new URL("../fixtures/dct-variants.json", import.meta.url), "utf8"));
const V = FIX.variants;
const jpeg = (name) => new Uint8Array(Buffer.from(V.find((v) => v.name === name).jpeg_b64, "base64"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const EDGES = JSON.parse(readFileSync(new URL("fixtures/dct-edges.json", import.meta.url), "utf8"));
const edge = (v) => new Uint8Array(Buffer.from(v.jpeg_b64, "base64"));

/** Every code a DctRefusal carries, and the REFUSALS reason R1 says it answers as. */
const CODES = {
  UNSUPPORTED_PROCESS: "UNSUPPORTED_JPEG_PROCESS", UNSUPPORTED_PRECISION: "UNSUPPORTED_JPEG_PROCESS",
  UNSUPPORTED_COMPONENTS: "UNSUPPORTED_SAMPLES", COMPONENT_MISMATCH: "UNSUPPORTED_SAMPLES", UNSUPPORTED_SAMPLING: "UNSUPPORTED_SAMPLES",
  COLOR_TRANSFORM_CONFLICT: "UNSUPPORTED_SAMPLES", UNSUPPORTED_ROTATION: "UNSUPPORTED_SAMPLES", TRUNCATED: "TRUNCATED_IMAGE_DATA",
  NOT_A_JPEG: "DECODE_FAILED", CORRUPT_DATA: "DECODE_FAILED", UNSUPPORTED_FRAME: "DECODE_FAILED",
};

/** The refusal `fn` throws: always a DctRefusal, its code one of CODES. */
function refusal(fn) {
  try { fn(); } catch (e) {
    assert.ok(e instanceof DctRefusal, `a DctRefusal, not ${e && e.constructor && e.constructor.name}: ${e && e.message}`);
    assert.ok(e.code in CODES, `code ${e.code} is one R1 names`);
    assert.ok(e.detail && typeof e.detail === "object" && Object.keys(e.detail).length > 0, `${e.code}: a detail that says why`);
    return e;
  }
  assert.fail("no refusal");
}

/** The byte offset of the segment for marker `m` (just past its length field). */
function segmentAt(d, m) {
  for (let p = 2; p + 4 <= d.length;) {
    if (d[p] !== 0xff) { p++; continue; }
    if (d[p + 1] === m) return p + 4;
    if (d[p + 1] === 0xda) break;
    p += 2 + ((d[p + 2] << 8) | d[p + 3]);
  }
  throw new Error(`no marker 0x${m.toString(16)}`);
}
const patched = (name, m, off, value) => { const d = jpeg(name); d[segmentAt(d, m) + off] = value; return d; };

test("R1 R6 the fixtures: libjpeg-turbo's decode of baseline and extended-sequential files, grey and colour", () => {
  assert.match(FIX.provenance, /libjpeg-turbo/);
  const ok = V.filter((v) => v.expect === "ok");
  assert.equal(ok.length, 12);
  for (const v of ok) assert.match(v.pillow_sha256, /^[0-9a-f]{64}$/, v.name);
  assert.deepEqual([...new Set(ok.map((v) => v.rotate))].sort((a, b) => a - b), [0, 90, 180, 270]);
});

test("R1 R6 every decodable fixture: libjpeg's samples, to the bit, rotated as asked", () => {
  for (const v of V.filter((x) => x.expect === "ok")) {
    const out = decodeBaselineJpeg(jpeg(v.name), { rotate: v.rotate });
    assert.deepEqual([out.width, out.height, out.comps], [v.width, v.height, v.mode === "L" ? 1 : 3], v.name);
    assert.equal(out.samples.length, v.width * v.height * out.comps, v.name);
    assert.equal(sha(out.samples), v.pillow_sha256, `${v.name}: libjpeg-turbo's samples`);
  }
});

test("R1 each sampling libjpeg upsamples fancily: 4:4:4, 4:2:2, 4:2:0 and h1v2, with restart intervals", () => {
  const seen = new Set();
  for (const v of V.filter((x) => x.expect === "ok" && x.mode === "RGB")) {
    const out = decodeBaselineJpeg(jpeg(v.name), { rotate: v.rotate });
    seen.add(out.source.sampling);
    if (v.name.includes("restart")) assert.ok(out.source.restart > 0, v.name);
  }
  for (const s of ["1x1,1x1,1x1", "2x1,1x1,1x1", "2x2,1x1,1x1", "1x2,1x1,1x1"]) assert.ok(seen.has(s), s);
});

test("R1 readJpegHeader and colourTransformOf: libjpeg's colour-transform rule, in its order", () => {
  const h = readJpegHeader(jpeg("rgb-444"));
  assert.equal(h.frame.comps.length, 3);
  assert.deepEqual(colourTransformOf(h), { ycc: true, why: "JFIF" });
  const adobe = readJpegHeader(jpeg("rgb-adobe-no-transform"));
  assert.deepEqual(colourTransformOf(adobe), { ycc: false, why: "Adobe APP14 transform=0" });
  const comps = (ids) => ({ frame: { comps: ids.map((id) => ({ id })) }, jfif: false, adobe: null });
  assert.deepEqual(colourTransformOf(comps([82, 71, 66])), { ycc: false, why: "component ids R,G,B" });
  assert.deepEqual(colourTransformOf(comps([1, 2, 3])), { ycc: true, why: localize("image-codecs.dctdecode.libjpeg_s_default_for_three", "libjpeg's default for three components") });
  assert.equal(colourTransformOf({ ...comps([82, 71, 66]), jfif: true }).ycc, true, "JFIF wins over the ids");
  assert.equal(colourTransformOf({ ...comps([1, 2, 3]), adobe: { transform: 1 } }).ycc, true);
  /* The rule is what decoding follows: the Adobe file decodes untransformed, and matches libjpeg. */
  const v = V.find((x) => x.name === "rgb-adobe-no-transform");
  assert.equal(sha(decodeBaselineJpeg(jpeg(v.name)).samples), v.pillow_sha256);
});

test("R1 the fixtures' refusals: progressive, arithmetic-coded, four components, cut short", () => {
  for (const v of V.filter((x) => x.expect !== "ok")) {
    const e = refusal(() => decodeBaselineJpeg(jpeg(v.name), { rotate: v.rotate }));
    assert.equal(e.code, v.expect, v.name);
  }
});

/** Every refusal no fixture carries, as [label, bytes, options, code]: each made
 *  from a fixture by the one change its label names. R1 and R11 are driven over
 *  the same table. */
const OTHER_REFUSALS = () => [
  ["not a JPEG", Uint8Array.from([1, 2, 3, 4, 5]), {}, "NOT_A_JPEG"],
  ["not even bytes", "\xff\xd8\xff", {}, "NOT_A_JPEG"],
  ["12-bit precision (SOF P = 12)", patched("grey-baseline", 0xc0, 0, 12), {}, "UNSUPPORTED_PRECISION"],
  ["lossless (SOF3)", (() => { const d = jpeg("grey-baseline"); d[segmentAt(d, 0xc0) - 3] = 0xc3; return d; })(), {}, "UNSUPPORTED_PROCESS"],
  ["hierarchical (DHP)", (() => { const d = jpeg("grey-baseline"); d[segmentAt(d, 0xdb) - 3] = 0xde; return d; })(), {}, "UNSUPPORTED_PROCESS"],
  ["zero width (SOF X = 0)", (() => { const d = patched("grey-baseline", 0xc0, 3, 0); d[segmentAt(d, 0xc0) + 4] = 0; return d; })(), {}, "UNSUPPORTED_FRAME"],
  ["sampling 3x1", patched("rgb-444", 0xc0, 7, 0x31), {}, "UNSUPPORTED_SAMPLING"],
  ["a missing quantisation table", patched("grey-baseline", 0xc0, 8, 3), {}, "CORRUPT_DATA"],
  ["the PDF expects three components of a grey file", jpeg("grey-baseline"), { expectComps: 3 }, "COMPONENT_MISMATCH"],
  ["/ColorTransform 0 against a JFIF file", jpeg("rgb-444"), { colorTransform: 0 }, "COLOR_TRANSFORM_CONFLICT"],
  ["the entropy data cut", jpeg("rgb-420-h2v2").subarray(0, 600), {}, "TRUNCATED"],
  ["no SOS", jpeg("grey-baseline").subarray(0, 120), {}, "TRUNCATED"],
  ["a restart interval cut short", jpeg("rgb-420-restart-cjpeg").subarray(0, 900), {}, "TRUNCATED"],
  ["a restart marker out of order (RST0 written as RST5)", (() => {
    const d = jpeg("rgb-420-restart-cjpeg");
    let p = segmentAt(d, 0xda);
    while (!(d[p] === 0xff && d[p + 1] === 0xd0)) p++;
    d[p + 1] = 0xd5;
    return d;
  })(), {}, "CORRUPT_DATA"],
];

test("R1 every other refusal, each as the bytes require", () => {
  const cases = [
    ...OTHER_REFUSALS().map(([label, d, opts, code]) => [label, () => decodeBaselineJpeg(d, opts), code]),
    ["not even bytes, to the header", () => readJpegHeader("\xff\xd8\xff"), "NOT_A_JPEG"],
    ["a quarter turn that is not one", () => decodeBaselineJpeg(jpeg("grey-baseline"), { rotate: 45 }), "UNSUPPORTED_ROTATION"],
  ];
  const seen = new Set();
  for (const [label, fn, code] of cases) {
    const e = refusal(fn);
    assert.equal(e.code, code, label);
    seen.add(e.code);
  }
  for (const v of V.filter((x) => x.expect !== "ok")) seen.add(v.expect);
  assert.deepEqual([...seen].sort(), Object.keys(CODES).sort(), "every code R1's refusals take is driven");
  /* A rotation that is not a quarter turn is judged after the data: damaged data answers as damaged. */
  assert.equal(refusal(() => decodeBaselineJpeg(jpeg("rgb-420-h2v2").subarray(0, 600), { rotate: 45 })).code, "TRUNCATED");
});

test("R1 the options agree with the file: expectComps and a matching /ColorTransform decode as without them", () => {
  const v = V.find((x) => x.name === "rgb-444");
  assert.equal(sha(decodeBaselineJpeg(jpeg(v.name), { expectComps: 3, colorTransform: 1 }).samples), v.pillow_sha256);
  const g = V.find((x) => x.name === "grey-baseline");
  assert.equal(sha(decodeBaselineJpeg(jpeg(g.name), { expectComps: 1, colorTransform: 0 }).samples), g.pillow_sha256);
});

/* R1's header shape (T38; N782, K2179): `readJpegHeader`'s Huffman tables are part
 * of R1, because `image-cover` decodes with them. Every field is checked against
 * tables derived here from the DHT bytes alone, by T.81 Annex C's code assignment
 * (codes of one length consecutive, the next length starting at twice the end of
 * the last) and Annex F.2.2.3's decoder tables, so a change to any field's type,
 * length or content is a change this test sees. */
const SHAPE = ["maxcode", "valptr", "mincode", "symbols", "fast", "FAST"];
const FAST_BITS = 9;

/** Every DHT table before the SOS, in order, as [class, id, counts, symbols]. */
function dhtTables(d) {
  const out = [];
  for (let p = 2; p + 4 <= d.length;) {
    if (d[p] !== 0xff) { p++; continue; }
    const m = d[p + 1];
    if (m === 0xff) { p++; continue; }
    if (m === 0xda) break;
    const len = (d[p + 2] << 8) | d[p + 3];
    if (m === 0xc4) {
      for (let q = p + 4; q < p + 2 + len;) {
        const counts = [...d.subarray(q + 1, q + 17)], total = counts.reduce((a, n) => a + n, 0);
        out.push([d[q] >> 4, d[q] & 15, counts, [...d.subarray(q + 17, q + 17 + total)]]);
        q += 17 + total;
      }
    }
    p += 2 + len;
  }
  return out;
}

/** The table R1's decoding reads, from a DHT table's counts and symbols. */
function expectedTable(counts, symbols) {
  const maxcode = Array(18).fill(-1), valptr = Array(17).fill(0), mincode = Array(17).fill(0);
  const fast = Array(1 << FAST_BITS).fill(-1);
  let code = 0, k = 0;
  for (let l = 1; l <= 16; l++) {
    valptr[l] = k; mincode[l] = code;
    for (let i = 0; i < counts[l - 1]; i++, k++, code++) {
      if (l <= FAST_BITS) for (let j = 0; j < 1 << (FAST_BITS - l); j++) fast[(code << (FAST_BITS - l)) | j] = (l << 8) | symbols[k];
    }
    if (counts[l - 1]) maxcode[l] = code - 1;
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  return { maxcode, valptr, mincode, symbols, fast, FAST: FAST_BITS };
}

/** One table of `readJpegHeader`'s answer, checked whole against the DHT's. */
function assertTable(t, counts, symbols, what) {
  assert.ok(t && typeof t === "object", `${what}: a table`);
  assert.deepEqual(Object.keys(t).sort(), [...SHAPE].sort(), `${what}: exactly R1's six fields`);
  const want = expectedTable(counts, symbols);
  for (const [field, type, length] of [["maxcode", Int32Array, 18], ["valptr", Int32Array, 17], ["mincode", Int32Array, 17],
    ["symbols", Uint8Array, symbols.length], ["fast", Int32Array, 1 << FAST_BITS]]) {
    assert.equal(Object.getPrototypeOf(t[field]), type.prototype, `${what}.${field}: a ${type.name}`);
    assert.equal(t[field].length, length, `${what}.${field}: length ${length}`);
    assert.deepEqual([...t[field]], want[field], `${what}.${field}: its content`);
  }
  assert.equal(t.FAST, FAST_BITS, `${what}.FAST: the fast table's width in bits`);
}

/** `hts` against every DHT of `d`: one table per class and id, the last definition winning, nothing else. */
function assertHuffmanTables(d, what) {
  const { hts } = readJpegHeader(d);
  assert.deepEqual(Object.keys(hts).sort(), ["ac", "dc"], `${what}: hts holds dc and ac`);
  assert.ok(Array.isArray(hts.dc) && Array.isArray(hts.ac), `${what}: each an array indexed by table id`);
  const last = new Map();
  for (const [tc, th, counts, symbols] of dhtTables(d)) last.set(`${tc}:${th}`, [counts, symbols]);
  assert.ok(last.size > 0, `${what}: the file defines Huffman tables`);
  for (const [cls, list] of [[0, hts.dc], [1, hts.ac]]) {
    const ids = Object.keys(list).map(Number);
    assert.deepEqual(ids, [...last.keys()].filter((k) => k.startsWith(`${cls}:`)).map((k) => Number(k.slice(2))).sort((a, b) => a - b),
      `${what}: ${cls ? "ac" : "dc"} holds exactly the ids the file defines`);
    for (const i of ids) assertTable(list[i], ...last.get(`${cls}:${i}`), `${what} ${cls ? "ac" : "dc"}[${i}]`);
  }
  return hts;
}

test("R1 readJpegHeader's Huffman tables: hts.dc[i] and hts.ac[i], each {maxcode, valptr, mincode, symbols, fast, FAST}, typed and sized as stated", () => {
  let tables = 0;
  for (const v of V.filter((x) => !["refuse-progressive", "refuse-arithmetic"].includes(x.name))) {
    const hts = assertHuffmanTables(jpeg(v.name), v.name);
    tables += Object.keys(hts.dc).length + Object.keys(hts.ac).length;
  }
  assert.ok(tables >= 40, `${tables} tables checked`);
  /* Table ids past 0 and 1, held where the file puts them; several tables in one
   * DHT; codes longer than the fast table, which only maxcode, valptr and mincode
   * decode; a table redefined, the later one answered. The header ends at its SOS,
   * so these markers need no scan data. */
  const dht = (...ts) => {
    const body = ts.flatMap(([tc, th, counts, symbols]) => [(tc << 4) | th, ...counts, ...symbols]);
    return [0xff, 0xc4, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  };
  const long = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2];      // one code of each length 2..15, two of 16
  const longSyms = Array.from({ length: 16 }, (_, i) => 0x10 + i);
  const short = [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const header = Uint8Array.from([
    0xff, 0xd8,
    ...dht([0, 3, short, [7, 8, 9]], [1, 2, long, longSyms]),
    ...dht([0, 3, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [5]]),
    0xff, 0xdb, 0x00, 0x43, 0x00, ...Array(64).fill(1),
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x32, 0x00, 0x3f, 0x00,
  ]);
  const hts = assertHuffmanTables(header, "constructed header");
  assert.deepEqual([Object.keys(hts.dc), Object.keys(hts.ac)], [["3"], ["2"]]);
  assert.deepEqual([...hts.dc[3].symbols], [5], "the later DHT's dc[3]");
  assert.equal(hts.ac[2].fast.filter((f) => f >= 0).length, (1 << 7) + (1 << 6) + (1 << 5) + (1 << 4) + (1 << 3) + (1 << 2) + (1 << 1) + 1,
    "codes of 2..9 bits fill the fast table; longer ones are left to maxcode, valptr and mincode");
});

/* R1 (T38, K2265): a Huffman table libjpeg refuses is refused. Each case below
 * splices one DHT into a fixture before its SOS, and each verdict is libjpeg-
 * turbo 3.1.4's (through Pillow 12.3.0) on the same bytes, checked 2026-10-08:
 * it refuses a table the scan uses whose codes do not fit their lengths (the
 * all-ones code included) or whose DC symbol passes 15 ("Bogus Huffman table
 * definition"), and at once a class or id past the four tables, more than 256
 * symbols, or counts that run past the DHT; it decodes past a bogus table the
 * scan does not use. */
test("R1 a Huffman table libjpeg refuses is a CORRUPT_DATA refusal naming the table; one the scan does not use is no refusal", () => {
  const counts = (byLength) => Array.from({ length: 16 }, (_, i) => byLength[i + 1] ?? 0);
  const dht = (body) => [0xff, 0xc4, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  const table = (tc, th, byLength, symbols) => dht([(tc << 4) | th, ...counts(byLength), ...symbols]);
  const spliced = (name, ...segs) => {
    const d = jpeg(name);
    let sos = 2;
    while (!(d[sos] === 0xff && d[sos + 1] === 0xda)) sos++;
    return Uint8Array.from([...d.subarray(0, sos), ...segs.flat(), ...d.subarray(sos)]);
  };
  const refused = [
    ["three codes of 1 bit (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 3 }, [0, 1, 2])), "dc 0"],
    ["the all-ones code of 1 bit (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 2 }, [0, 1])), "dc 0"],
    ["the all-ones code of 2 bits (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 1, 2: 2 }, [0, 1, 2])), "dc 0"],
    ["the all-ones code of 16 bits (ac 0, used)", spliced("grey-baseline", table(1, 0, { ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, 1])), 16: 2 },
      Array.from({ length: 17 }, (_, i) => i))), "ac 0"],
    ["a DC symbol of 16 (dc 0, used)", spliced("grey-baseline", table(0, 0, { 2: 3 }, [0, 16, 2])), "dc 0"],
    ["the colour file's chroma AC table (ac 1, used)", spliced("rgb-444", table(1, 1, { 1: 2 }, [0, 1])), "ac 1"],
    ["a used table redefined bogus after a good one", spliced("grey-baseline", table(0, 0, { 1: 1 }, [0]), table(0, 0, { 1: 3 }, [0, 1, 2])), "dc 0"],
    ["an id past 3, unused", spliced("grey-baseline", dht([0x04, ...counts({ 1: 1 }), 0])), null],
    ["a class past AC, unused", spliced("grey-baseline", dht([0x20, ...counts({ 1: 1 }), 0])), null],
    ["257 symbols, unused", spliced("grey-baseline", dht([0x13, ...counts({ 8: 255, 9: 2 }), ...Array(257).fill(0)])), "ac 3"],
    ["counts that run past the DHT, unused", spliced("grey-baseline", dht([0x13, ...counts({ 2: 5 }), 0, 0])), "ac 3"],
    ["a DHT cut inside its counts, unused", spliced("grey-baseline", dht([0x13, 0, 0, 0])), "ac 3"],
  ];
  for (const [label, d, named] of refused) {
    for (const fn of [() => readJpegHeader(d), () => decodeBaselineJpeg(d)]) {
      const e = refusal(fn);
      assert.equal(e.code, "CORRUPT_DATA", label);
      if (named) assert.equal(e.detail.table, named, `${label}: the detail names the table`);
      else assert.ok(Number.isInteger(e.detail.id) && Number.isInteger(e.detail.class), `${label}: the detail names the class and id`);
      assert.match(e.detail.note, /Huffman table/, label);
    }
  }
  /* A bogus table the scan does not use: libjpeg decodes the picture, and so does R1. */
  const g = V.find((x) => x.name === "grey-baseline"), c = V.find((x) => x.name === "rgb-444");
  const [, , dc0Counts, dc0Symbols] = dhtTables(jpeg("grey-baseline")).find(([tc, th]) => tc === 0 && th === 0);
  const dc0 = [Object.fromEntries(dc0Counts.map((n, i) => [i + 1, n])), dc0Symbols];
  for (const [label, d, v] of [
    ["dc 3, unused", spliced("grey-baseline", table(0, 3, { 1: 3 }, [0, 1, 2])), g],
    ["ac 1, unused by a grey scan", spliced("grey-baseline", table(1, 1, { 1: 2 }, [0, 1])), g],
    ["dc 2 with a symbol of 16, unused", spliced("rgb-444", table(0, 2, { 2: 1 }, [16])), c],
    ["a used table bogus, then redefined good", spliced("grey-baseline", table(0, 0, { 1: 3 }, [0, 1, 2]), table(0, 0, ...dc0)), g],
  ]) {
    assert.equal(sha(decodeBaselineJpeg(d).samples), v.pillow_sha256, `${label}: libjpeg-turbo's picture`);
    const { hts } = readJpegHeader(d);
    for (const list of [hts.dc, hts.ac]) for (const t of Object.values(list)) assert.ok(t.fast.length === 512 && t.maxcode[17] === 0x7fffffff, label);
  }
});

/* ── R1's edges and R11 (T44, N868) ──────────────────────────────────────── */

test("R1 R6 the edge fixtures: libjpeg-turbo's samples one or two chroma samples wide, one row tall, ending inside an MCU row, restarting every block", () => {
  assert.match(EDGES.provenance, /^Pillow 12\.3\.0 \(libjpeg-turbo /);
  const samplings = new Set();
  let narrow = 0, ragged = 0;
  for (const v of EDGES.variants) {
    const out = decodeBaselineJpeg(edge(v));
    assert.deepEqual([out.width, out.height, out.comps], [v.width, v.height, v.mode === "L" ? 1 : 3], v.name);
    assert.equal(sha(out.samples), v.pillow_sha256, `${v.name}: libjpeg-turbo's samples`);
    samplings.add(out.source.sampling);
    if (out.comps === 3 && out.source.sampling !== "1x1,1x1,1x1" && v.width <= 4) narrow++;
    if (v.height % 16) ragged++;
  }
  for (const s of ["1x1", "1x1,1x1,1x1", "2x1,1x1,1x1", "2x2,1x1,1x1"]) assert.ok(samplings.has(s), s);
  assert.ok(narrow >= 6, `${narrow} subsampled images whose chroma is one or two samples wide`);
  assert.ok(ragged >= 20, `${ragged} images whose height ends inside an MCU row`);
  assert.ok(EDGES.variants.some((v) => v.name.includes("restart-1-block")));
});

/** R11's answer: the rows `onRows` was handed, checked for order as they come, and what it returned. */
function rowsOf(d, opts = {}) {
  const calls = [];
  let next = 0;
  const info = decodeBaselineJpegRows(d, { ...opts, onRows(rows, y0, count) {
    assert.ok(rows instanceof Uint8Array, "rows are bytes");
    assert.equal(y0, next, "strips are handed over in order, top to bottom, none skipped");
    assert.ok(Number.isInteger(count) && count > 0, "a strip holds rows");
    calls.push({ rows: rows.slice(), y0, count });           // the buffer is reused: kept by copying
    next = y0 + count;
  } });
  return { info, calls, joined: Buffer.concat(calls.map((c) => c.rows)) };
}

/** Every fixture R1 decodes, as [name, bytes]: the DCT variants and the edges. */
const DECODABLE = [
  ...V.filter((v) => v.expect === "ok").map((v) => [v.name, jpeg(v.name)]),
  ...EDGES.variants.map((v) => [`edges ${v.name}`, edge(v)]),
];

test("R11 decodeBaselineJpegRows: its rows joined are R1's rotate-0 samples, byte for byte, for every fixture of every sampling (grey, 4:4:4, 4:2:2, 4:2:0, h1v2, restarts)", () => {
  const samplings = new Set();
  for (const [name, d] of DECODABLE) {
    const whole = decodeBaselineJpeg(d, { rotate: 0 });
    const { info, calls, joined } = rowsOf(d);
    assert.deepEqual(info, { width: whole.width, height: whole.height, comps: whole.comps, source: whole.source }, `${name}: R1's answer without its samples`);
    assert.equal(calls.at(-1).y0 + calls.at(-1).count, whole.height, `${name}: every row, and no more`);
    for (const c of calls) assert.equal(c.rows.length, c.count * whole.width * whole.comps, `${name}: rows of width x comps bytes`);
    assert.ok(Buffer.from(whole.samples).equals(joined), `${name}: R1's samples, byte for byte`);
    samplings.add(whole.source.sampling);
  }
  for (const s of ["1x1", "1x1,1x1,1x1", "2x1,1x1,1x1", "2x2,1x1,1x1", "1x2,1x1,1x1"]) assert.ok(samplings.has(s), `sampling ${s}`);
  /* And so libjpeg-turbo's, wherever a fixture's digest is of the unrotated picture. */
  for (const v of V.filter((x) => x.expect === "ok" && x.rotate === 0)) assert.equal(sha(rowsOf(jpeg(v.name)).joined), v.pillow_sha256, v.name);
  /* The options agree with the file: the same rows as without them. */
  assert.equal(sha(rowsOf(jpeg("rgb-444"), { expectComps: 3, colorTransform: 1 }).joined), V.find((x) => x.name === "rgb-444").pillow_sha256);
});

test("R11 one MCU row at a time: no strip holds more than an MCU row's output rows (8 x vmax), and a tall image is handed over in many strips", () => {
  for (const [name, d] of DECODABLE) {
    const h = readJpegHeader(d);
    const single = h.frame.comps.length === 1;
    const vmax = Math.max(...h.frame.comps.map((c) => c.v));
    const most = single ? 8 : 8 * vmax;
    const { calls } = rowsOf(d);
    for (const c of calls) assert.ok(c.count <= most, `${name}: a strip of ${c.count} rows, at most ${most}`);
    assert.ok(calls.length >= Math.ceil(h.frame.height / most), `${name}: ${calls.length} strips for ${h.frame.height} rows`);
  }
});

test("R11 every R1 refusal is raised the same way: the same DctRefusal, code, message and detail (control: a baseline fixture decodes)", () => {
  const same = (label, d, opts = {}) => {
    let r1, r11, handed = 0;
    try { decodeBaselineJpeg(d, opts); } catch (e) { r1 = e; }
    try { decodeBaselineJpegRows(d, { ...opts, onRows: () => { handed++; } }); } catch (e) { r11 = e; }
    assert.ok(r1, `${label}: R1 refuses`);
    assert.ok(r11 instanceof DctRefusal, `${label}: R11 refuses with a DctRefusal`);
    assert.deepEqual([r11.code, r11.message, r11.detail], [r1.code, r1.message, r1.detail], `${label}: as R1 does`);
    return { e: r11, handed };
  };
  const codes = new Set();
  for (const v of V.filter((x) => x.expect !== "ok")) codes.add(same(v.name, jpeg(v.name)).e.code);
  for (const [label, d, opts] of OTHER_REFUSALS()) {
    const { e, handed } = same(label, d, opts);
    codes.add(e.code);
    /* A refusal from the header comes before any row is handed over. */
    if (e.code !== "TRUNCATED" && e.code !== "CORRUPT_DATA") assert.equal(handed, 0, `${label}: nothing handed over`);
  }
  assert.deepEqual([...codes].sort(), Object.keys(CODES).filter((c) => c !== "UNSUPPORTED_ROTATION").sort(),
    "every code R1 raises, but the rotation R11 never takes");
  /* The control: a baseline fixture decodes, its rows handed over. */
  const g = V.find((x) => x.name === "grey-baseline");
  assert.equal(sha(rowsOf(jpeg(g.name)).joined), g.pillow_sha256);
  /* R11 takes no rotation: one asked of it is not read. */
  assert.equal(sha(rowsOf(jpeg(g.name), { rotate: 90 }).joined), g.pillow_sha256);
});

test("R11 data that runs out: the rows above the break are the picture's, and no row made of bits the data did not hold is handed over", () => {
  const whole = decodeBaselineJpeg(jpeg("rgb-420-h2v2"));
  const rowBytes = whole.width * 3;
  for (const cut of [400, 600, 800, 1200]) {
    const got = [];
    let e;
    try { decodeBaselineJpegRows(jpeg("rgb-420-h2v2").subarray(0, cut), { onRows: (rows) => got.push(rows.slice()) }); } catch (x) { e = x; }
    assert.ok(e instanceof DctRefusal && e.code === "TRUNCATED", `cut at ${cut}: refused TRUNCATED`);
    const handed = Buffer.concat(got);
    assert.ok(handed.length < whole.samples.length, `cut at ${cut}: not the whole picture`);
    assert.equal(handed.length % rowBytes, 0);
    assert.ok(Buffer.from(whole.samples.subarray(0, handed.length)).equals(handed), `cut at ${cut}: only the picture's own rows`);
  }
});

test("R11 onRows is required", () => {
  assert.throws(() => decodeBaselineJpegRows(jpeg("grey-baseline")), TypeError);
  assert.throws(() => decodeBaselineJpegRows(jpeg("grey-baseline"), { onRows: 1 }), TypeError);
});

test("R11 the strip's shape (K2737): rows a Uint8Array of count rows of width x comps bytes, interleaved as R1's rotate-0 samples, y0 the row's index in the unrotated frame", () => {
  for (const [name, d] of DECODABLE) {
    const whole = decodeBaselineJpeg(d, { rotate: 0 });
    const rowBytes = whole.width * whole.comps;
    decodeBaselineJpegRows(d, { onRows(rows, y0, count) {
      assert.equal(Object.getPrototypeOf(rows), Uint8Array.prototype, `${name}: a Uint8Array`);
      assert.equal(rows.length, count * rowBytes, `${name}: count rows of width x comps bytes`);
      assert.ok(Buffer.from(whole.samples.subarray(y0 * rowBytes, (y0 + count) * rowBytes)).equals(rows), `${name}: rows ${y0}..${y0 + count - 1} of R1's rotate-0 samples`);
    } });
  }
  /* A rotated fixture's strips are its unrotated frame's: y0 counts the stored rows. */
  const v = V.find((x) => x.name === "rgb-420-rotate90");
  const h = readJpegHeader(jpeg(v.name)).frame;
  let last = 0;
  decodeBaselineJpegRows(jpeg(v.name), { onRows(rows, y0, count) { assert.equal(rows.length, count * h.width * 3); last = y0 + count; } });
  assert.equal(last, h.height, "every stored row, in the stored frame's height");
});
