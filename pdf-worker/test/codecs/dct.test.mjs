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
/** @import { ColourEvidence, DecodeOptions, HuffmanTable, HuffmanTables, JpegInfo } from "../../src/dctdecode.mjs" */

/** Every code a DctRefusal carries.
 *  @typedef {"UNSUPPORTED_PROCESS" | "UNSUPPORTED_PRECISION" | "UNSUPPORTED_COMPONENTS" | "COMPONENT_MISMATCH" | "UNSUPPORTED_SAMPLING"
 *    | "COLOR_TRANSFORM_CONFLICT" | "UNSUPPORTED_ROTATION" | "TRUNCATED" | "NOT_A_JPEG" | "CORRUPT_DATA" | "UNSUPPORTED_FRAME"} DctCode */
/** A fixture libjpeg-turbo decodes, and its decode.
 *  @typedef {Object} DecodedVariant
 *  @property {string} name @property {number} rotate degrees clockwise @property {"ok"} expect
 *  @property {string} mode Pillow's mode, "L" or "RGB" @property {number} width @property {number} height
 *  @property {string} pillow_sha256 the digest of Pillow's samples @property {string} jpeg_b64 the file, base64 */
/** A fixture the codec refuses.
 *  @typedef {Object} RefusedVariant
 *  @property {string} name @property {number} rotate @property {DctCode} expect the code it is refused with
 *  @property {string} jpeg_b64 the file, base64 */
/** @typedef {DecodedVariant | RefusedVariant} DctVariant */
/** @typedef {Object} DctFixtures @property {string} provenance @property {DctVariant[]} variants */
/** An edge fixture, every one decoded.
 *  @typedef {Object} EdgeVariant
 *  @property {string} name @property {string} mode @property {number} width @property {number} height
 *  @property {string} pillow_sha256 @property {string} jpeg_b64 */
/** The options a test asks of the decoders: R1's, and never R11's sink, which is the test's own.
 *  @typedef {Object} AskedOptions
 *  @property {number | undefined} [rotate] @property {number | null | undefined} [expectComps]
 *  @property {number | null | undefined} [colorTransform] @property {undefined} [onRows] never asked */
/** @typedef {Object} EdgeFixtures @property {string} provenance @property {EdgeVariant[]} variants */

const FIX = /** @type {DctFixtures} decodes the recorded dct-variants.json, written by make-dct-fixtures.py */ (JSON.parse(readFileSync(new URL("../fixtures/dct-variants.json", import.meta.url), "utf8")));
const V = FIX.variants;
/** The fixture named `name` (none is a TypeError, as reading it was). @param {string} name @returns {DctVariant} */
function variant(name) {
  const v = V.find((x) => x.name === name);
  if (v === undefined) throw new TypeError(`dct-variants.json has no variant ${name}`);
  return v;
}
/** The decoded fixture named `name` (none, or a refused one, is a broken fixture file). @param {string} name @returns {DecodedVariant} */
function decodedVariant(name) {
  const v = variant(name);
  if (v.expect !== "ok") throw new TypeError(`dct-variants.json has no decoded variant ${name}`);
  return v;
}
/** The fixtures libjpeg-turbo decodes, in the file's order. @type {DecodedVariant[]} */
const DECODED = [];
/** The fixtures the codec refuses, in the file's order. @type {RefusedVariant[]} */
const REFUSED = [];
for (const v of V) { if (v.expect === "ok") DECODED.push(v); else REFUSED.push(v); }
/** @param {string} name @returns {Uint8Array} */
const jpeg = (name) => new Uint8Array(Buffer.from(variant(name).jpeg_b64, "base64"));
/** @param {Uint8Array} b @returns {string} */
const sha = (b) => createHash("sha256").update(b).digest("hex");
const EDGES = /** @type {EdgeFixtures} decodes the recorded dct-edges.json, written by make-dct-edges.py */ (JSON.parse(readFileSync(new URL("./fixtures/dct-edges.json", import.meta.url), "utf8")));
/** @param {EdgeVariant} v @returns {Uint8Array} */
const edge = (v) => new Uint8Array(Buffer.from(v.jpeg_b64, "base64"));

/** Every code a DctRefusal carries, and the REFUSALS reason R1 says it answers as. */
const CODES = {
  UNSUPPORTED_PROCESS: "UNSUPPORTED_JPEG_PROCESS", UNSUPPORTED_PRECISION: "UNSUPPORTED_JPEG_PROCESS",
  UNSUPPORTED_COMPONENTS: "UNSUPPORTED_SAMPLES", COMPONENT_MISMATCH: "UNSUPPORTED_SAMPLES", UNSUPPORTED_SAMPLING: "UNSUPPORTED_SAMPLES",
  COLOR_TRANSFORM_CONFLICT: "UNSUPPORTED_SAMPLES", UNSUPPORTED_ROTATION: "UNSUPPORTED_SAMPLES", TRUNCATED: "TRUNCATED_IMAGE_DATA",
  NOT_A_JPEG: "DECODE_FAILED", CORRUPT_DATA: "DECODE_FAILED", UNSUPPORTED_FRAME: "DECODE_FAILED",
};

/** The refusal `fn` throws: always a DctRefusal, its code one of CODES.
 *  @param {() => unknown} fn @returns {DctRefusal} */
function refusal(fn) {
  try { fn(); } catch (e) {
    const err = e;
    assert.ok(err instanceof DctRefusal, `a DctRefusal, not ${err instanceof Error ? err.name : typeof err}: ${err instanceof Error ? err.message : String(err)}`);
    assert.ok(err.code in CODES, `code ${err.code} is one R1 names`);
    assert.ok(err.detail && typeof err.detail === "object" && Object.keys(err.detail).length > 0, `${err.code}: a detail that says why`);
    return err;
  }
  assert.fail("no refusal");
}

/** The byte offset of the segment for marker `m` (just past its length field); a byte past the end reads as 0, as before.
 *  @param {Uint8Array} d @param {number} m @returns {number} */
function segmentAt(d, m) {
  for (let p = 2; p + 4 <= d.length;) {
    if (d[p] !== 0xff) { p++; continue; }
    if (d[p + 1] === m) return p + 4;
    if (d[p + 1] === 0xda) break;
    p += 2 + (((d[p + 2] ?? NaN) << 8) | (d[p + 3] ?? NaN));
  }
  throw new Error(`no marker 0x${m.toString(16)}`);
}
/** @param {string} name @param {number} m @param {number} off @param {number} value @returns {Uint8Array} */
const patched = (name, m, off, value) => { const d = jpeg(name); d[segmentAt(d, m) + off] = value; return d; };

test("R1 R6 the fixtures: libjpeg-turbo's decode of baseline and extended-sequential files, grey and colour", () => {
  assert.match(FIX.provenance, /libjpeg-turbo/);
  const ok = DECODED;
  assert.equal(ok.length, 12);
  for (const v of ok) assert.match(v.pillow_sha256, /^[0-9a-f]{64}$/, v.name);
  assert.deepEqual([...new Set(ok.map((v) => v.rotate))].sort((a, b) => a - b), [0, 90, 180, 270]);
});

test("R1 R6 every decodable fixture: libjpeg's samples, to the bit, rotated as asked", () => {
  for (const v of DECODED) {
    const out = decodeBaselineJpeg(jpeg(v.name), { rotate: v.rotate });
    assert.deepEqual([out.width, out.height, out.comps], [v.width, v.height, v.mode === "L" ? 1 : 3], v.name);
    assert.equal(out.samples.length, v.width * v.height * out.comps, v.name);
    assert.equal(sha(out.samples), v.pillow_sha256, `${v.name}: libjpeg-turbo's samples`);
  }
});

test("R1 each sampling libjpeg upsamples fancily: 4:4:4, 4:2:2, 4:2:0 and h1v2, with restart intervals", () => {
  /** @type {Set<string>} */
  const seen = new Set();
  for (const v of DECODED.filter((x) => x.mode === "RGB")) {
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
  /** @param {number[]} ids @returns {ColourEvidence} */
  const comps = (ids) => ({ frame: { comps: ids.map((id) => ({ id })) }, jfif: false, adobe: null });
  assert.deepEqual(colourTransformOf(comps([82, 71, 66])), { ycc: false, why: "component ids R,G,B" });
  assert.deepEqual(colourTransformOf(comps([1, 2, 3])), { ycc: true, why: localize("image-codecs.dctdecode.libjpeg_s_default_for_three", "libjpeg's default for three components") });
  assert.equal(colourTransformOf({ ...comps([82, 71, 66]), jfif: true }).ycc, true, "JFIF wins over the ids");
  assert.equal(colourTransformOf({ ...comps([1, 2, 3]), adobe: { transform: 1 } }).ycc, true);
  /* The rule is what decoding follows: the Adobe file decodes untransformed, and matches libjpeg. */
  const v = decodedVariant("rgb-adobe-no-transform");
  assert.equal(sha(decodeBaselineJpeg(jpeg(v.name)).samples), v.pillow_sha256);
});

test("R1 the fixtures' refusals: progressive, arithmetic-coded, four components, cut short", () => {
  for (const v of REFUSED) {
    const e = refusal(() => decodeBaselineJpeg(jpeg(v.name), { rotate: v.rotate }));
    assert.equal(e.code, v.expect, v.name);
  }
});

/** A refusal as [label, bytes, options, code]. @typedef {[string, unknown, AskedOptions, DctCode]} RefusalCase */
/** Every refusal no fixture carries, as [label, bytes, options, code]: each made
 *  from a fixture by the one change its label names. R1 and R11 are driven over
 *  the same table.
 *  @returns {RefusalCase[]} */
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
  /** @type {Array<[string, () => unknown, DctCode]>} */
  const cases = [
    ...OTHER_REFUSALS().map(/** @param {RefusalCase} c @returns {[string, () => unknown, DctCode]} */ ([label, d, opts, code]) => [label, () => decodeBaselineJpeg(d, opts), code]),
    ["not even bytes, to the header", () => readJpegHeader("\xff\xd8\xff"), "NOT_A_JPEG"],
    ["a quarter turn that is not one", () => decodeBaselineJpeg(jpeg("grey-baseline"), { rotate: 45 }), "UNSUPPORTED_ROTATION"],
  ];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const [label, fn, code] of cases) {
    const got = refusal(fn).code;
    assert.equal(got, code, label);
    seen.add(got);
  }
  for (const v of REFUSED) seen.add(v.expect);
  assert.deepEqual([...seen].sort(), Object.keys(CODES).sort(), "every code R1's refusals take is driven");
  /* A rotation that is not a quarter turn is judged after the data: damaged data answers as damaged. */
  assert.equal(refusal(() => decodeBaselineJpeg(jpeg("rgb-420-h2v2").subarray(0, 600), { rotate: 45 })).code, "TRUNCATED");
});

test("R1 the options agree with the file: expectComps and a matching /ColorTransform decode as without them", () => {
  const v = decodedVariant("rgb-444");
  assert.equal(sha(decodeBaselineJpeg(jpeg(v.name), { expectComps: 3, colorTransform: 1 }).samples), v.pillow_sha256);
  const g = decodedVariant("grey-baseline");
  assert.equal(sha(decodeBaselineJpeg(jpeg(g.name), { expectComps: 1, colorTransform: 0 }).samples), g.pillow_sha256);
});

/* R1's header shape (T38; N782, K2179): `readJpegHeader`'s Huffman tables are part
 * of R1, because `image-cover` decodes with them. Every field is checked against
 * tables derived here from the DHT bytes alone, by T.81 Annex C's code assignment
 * (codes of one length consecutive, the next length starting at twice the end of
 * the last) and Annex F.2.2.3's decoder tables, so a change to any field's type,
 * length or content is a change this test sees. */
const SHAPE = ["maxcode", "valptr", "mincode", "symbols", "fast", "FAST"];
/** A field of a HuffmanTable that is an array. @typedef {"maxcode" | "valptr" | "mincode" | "symbols" | "fast"} TableArray */
/** The table the test derives from the DHT bytes, each array as plain numbers.
 *  @typedef {Object} ExpectedTable
 *  @property {number[]} maxcode @property {number[]} valptr @property {number[]} mincode
 *  @property {number[]} symbols @property {number[]} fast @property {number} FAST */
/** A DHT table as the file holds it: [class, id, counts, symbols]. @typedef {[number, number, number[], number[]]} DhtTable */
const FAST_BITS = 9;

/** Every DHT table before the SOS, in order, as [class, id, counts, symbols]; a byte past the end reads as 0, as before.
 *  @param {Uint8Array} d @returns {DhtTable[]} */
function dhtTables(d) {
  /** @type {DhtTable[]} */
  const out = [];
  for (let p = 2; p + 4 <= d.length;) {
    if (d[p] !== 0xff) { p++; continue; }
    const m = d[p + 1];
    if (m === 0xff) { p++; continue; }
    if (m === 0xda) break;
    const len = ((d[p + 2] ?? NaN) << 8) | (d[p + 3] ?? NaN);
    if (m === 0xc4) {
      for (let q = p + 4; q < p + 2 + len;) {
        const counts = [...d.subarray(q + 1, q + 17)], total = counts.reduce((a, n) => a + n, 0);
        out.push([(d[q] ?? NaN) >> 4, (d[q] ?? NaN) & 15, counts, [...d.subarray(q + 17, q + 17 + total)]]);
        q += 17 + total;
      }
    }
    p += 2 + len;
  }
  return out;
}

/** The table R1's decoding reads, from a DHT table's counts and symbols (a count or symbol past the end reads as none, as before).
 *  @param {number[]} counts @param {number[]} symbols @returns {ExpectedTable} */
function expectedTable(counts, symbols) {
  const maxcode = Array.from({ length: 18 }, () => -1), valptr = Array.from({ length: 17 }, () => 0), mincode = Array.from({ length: 17 }, () => 0);
  const fast = Array.from({ length: 1 << FAST_BITS }, () => -1);
  let code = 0, k = 0;
  for (let l = 1; l <= 16; l++) {
    valptr[l] = k; mincode[l] = code;
    for (let i = 0; i < (counts[l - 1] ?? NaN); i++, k++, code++) {
      if (l <= FAST_BITS) for (let j = 0; j < 1 << (FAST_BITS - l); j++) fast[(code << (FAST_BITS - l)) | j] = (l << 8) | (symbols[k] ?? NaN);
    }
    if (counts[l - 1]) maxcode[l] = code - 1;
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  return { maxcode, valptr, mincode, symbols, fast, FAST: FAST_BITS };
}

/** One table of `readJpegHeader`'s answer, checked whole against the DHT's.
 *  @param {HuffmanTable | undefined} t @param {number[]} counts @param {number[]} symbols @param {string} what */
function assertTable(t, counts, symbols, what) {
  assert.ok(t && typeof t === "object", `${what}: a table`);
  assert.deepEqual(Object.keys(t).sort(), [...SHAPE].sort(), `${what}: exactly R1's six fields`);
  const want = expectedTable(counts, symbols);
  /** Each array field, its type's prototype, that type's name, and its length. @type {Array<[TableArray, object, string, number]>} */
  const fields = [["maxcode", Int32Array.prototype, "Int32Array", 18], ["valptr", Int32Array.prototype, "Int32Array", 17], ["mincode", Int32Array.prototype, "Int32Array", 17],
    ["symbols", Uint8Array.prototype, "Uint8Array", symbols.length], ["fast", Int32Array.prototype, "Int32Array", 1 << FAST_BITS]];
  for (const [field, prototype, typeName, length] of fields) {
    /** @type {ArrayLike<number>} */
    const array = t[field];
    assert.equal(Reflect.getPrototypeOf(array), prototype, `${what}.${field}: a ${typeName}`);
    assert.equal(array.length, length, `${what}.${field}: length ${length}`);
    assert.deepEqual(Array.from(array), want[field], `${what}.${field}: its content`);
  }
  assert.equal(t.FAST, FAST_BITS, `${what}.FAST: the fast table's width in bits`);
}

/** The table at id `i` of `list` (none is a TypeError, as reading it was). @param {HuffmanTable[]} list @param {number} i @returns {HuffmanTable} */
function tableAt(list, i) {
  const t = list[i];
  if (t === undefined) throw new TypeError(`no table ${i}`);
  return t;
}

/** `hts` against every DHT of `d`: one table per class and id, the last definition winning, nothing else.
 *  @param {Uint8Array} d @param {string} what @returns {HuffmanTables} */
function assertHuffmanTables(d, what) {
  const { hts } = readJpegHeader(d);
  assert.deepEqual(Object.keys(hts).sort(), ["ac", "dc"], `${what}: hts holds dc and ac`);
  assert.ok(Array.isArray(hts.dc) && Array.isArray(hts.ac), `${what}: each an array indexed by table id`);
  /** @type {Map<string, [number[], number[]]>} */
  const last = new Map([]);
  for (const [tc, th, counts, symbols] of dhtTables(d)) last.set(`${tc}:${th}`, [counts, symbols]);
  assert.ok(last.size > 0, `${what}: the file defines Huffman tables`);
  /** @type {Array<[number, HuffmanTable[]]>} */
  const classes = [[0, hts.dc], [1, hts.ac]];
  for (const [cls, list] of classes) {
    const ids = Object.keys(list).map(Number);
    assert.deepEqual(ids, [...last.keys()].filter((k) => k.startsWith(`${cls}:`)).map((k) => Number(k.slice(2))).sort((a, b) => a - b),
      `${what}: ${cls ? "ac" : "dc"} holds exactly the ids the file defines`);
    for (const i of ids) {
      const defined = last.get(`${cls}:${i}`);
      if (defined === undefined) throw new TypeError(`${what}: no DHT defines ${cls}:${i}`);
      assertTable(list[i], ...defined, `${what} ${cls ? "ac" : "dc"}[${i}]`);
    }
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
  /** @param {...DhtTable} ts @returns {number[]} */
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
    0xff, 0xdb, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 1),
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x32, 0x00, 0x3f, 0x00,
  ]);
  const hts = assertHuffmanTables(header, "constructed header");
  assert.deepEqual([Object.keys(hts.dc), Object.keys(hts.ac)], [["3"], ["2"]]);
  assert.deepEqual([...tableAt(hts.dc, 3).symbols], [5], "the later DHT's dc[3]");
  assert.equal(tableAt(hts.ac, 2).fast.filter((f) => f >= 0).length, (1 << 7) + (1 << 6) + (1 << 5) + (1 << 4) + (1 << 3) + (1 << 2) + (1 << 1) + 1,
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
  /** @param {{ [length: number]: number }} byLength @returns {number[]} */
  const counts = (byLength) => Array.from({ length: 16 }, (_, i) => byLength[i + 1] ?? 0);
  /** @param {number[]} body @returns {number[]} */
  const dht = (body) => [0xff, 0xc4, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  /** @param {number} tc @param {number} th @param {{ [length: number]: number }} byLength @param {number[]} symbols @returns {number[]} */
  const table = (tc, th, byLength, symbols) => dht([(tc << 4) | th, ...counts(byLength), ...symbols]);
  /** @param {string} name @param {...number[]} segs @returns {Uint8Array} */
  const spliced = (name, ...segs) => {
    const d = jpeg(name);
    let sos = 2;
    while (!(d[sos] === 0xff && d[sos + 1] === 0xda)) sos++;
    return Uint8Array.from([...d.subarray(0, sos), ...segs.flat(), ...d.subarray(sos)]);
  };
  /** @type {Array<[string, Uint8Array, string | null]>} */
  const refused = [
    ["three codes of 1 bit (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 3 }, [0, 1, 2])), "dc 0"],
    ["the all-ones code of 1 bit (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 2 }, [0, 1])), "dc 0"],
    ["the all-ones code of 2 bits (dc 0, used)", spliced("grey-baseline", table(0, 0, { 1: 1, 2: 2 }, [0, 1, 2])), "dc 0"],
    ["the all-ones code of 16 bits (ac 0, used)", spliced("grey-baseline", table(1, 0, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 2 },
      Array.from({ length: 17 }, (_, i) => i))), "ac 0"],
    ["a DC symbol of 16 (dc 0, used)", spliced("grey-baseline", table(0, 0, { 2: 3 }, [0, 16, 2])), "dc 0"],
    ["the colour file's chroma AC table (ac 1, used)", spliced("rgb-444", table(1, 1, { 1: 2 }, [0, 1])), "ac 1"],
    ["a used table redefined bogus after a good one", spliced("grey-baseline", table(0, 0, { 1: 1 }, [0]), table(0, 0, { 1: 3 }, [0, 1, 2])), "dc 0"],
    ["an id past 3, unused", spliced("grey-baseline", dht([0x04, ...counts({ 1: 1 }), 0])), null],
    ["a class past AC, unused", spliced("grey-baseline", dht([0x20, ...counts({ 1: 1 }), 0])), null],
    ["257 symbols, unused", spliced("grey-baseline", dht([0x13, ...counts({ 8: 255, 9: 2 }), ...Array.from({ length: 257 }, () => 0)])), "ac 3"],
    ["counts that run past the DHT, unused", spliced("grey-baseline", dht([0x13, ...counts({ 2: 5 }), 0, 0])), "ac 3"],
    ["a DHT cut inside its counts, unused", spliced("grey-baseline", dht([0x13, 0, 0, 0])), "ac 3"],
  ];
  for (const [label, d, named] of refused) {
    for (const fn of [() => readJpegHeader(d), () => decodeBaselineJpeg(d)]) {
      const e = refusal(fn);
      assert.equal(e.code, "CORRUPT_DATA", label);
      if (named) assert.equal(e.detail.table, named, `${label}: the detail names the table`);
      else assert.ok(Number.isInteger(e.detail.id) && Number.isInteger(e.detail.class), `${label}: the detail names the class and id`);
      assert.match(String(e.detail.note), /Huffman table/, label);
    }
  }
  /* A bogus table the scan does not use: libjpeg decodes the picture, and so does R1. */
  const g = decodedVariant("grey-baseline"), c = decodedVariant("rgb-444");
  const dc0Table = dhtTables(jpeg("grey-baseline")).find(([tc, th]) => tc === 0 && th === 0);
  if (dc0Table === undefined) throw new TypeError("grey-baseline defines no dc 0");
  const [, , dc0Counts, dc0Symbols] = dc0Table;
  /** @type {{ [length: number]: number }} */
  const dc0ByLength = {};
  dc0Counts.forEach((n, i) => { dc0ByLength[i + 1] = n; });
  /** @type {[{ [length: number]: number }, number[]]} */
  const dc0 = [dc0ByLength, dc0Symbols];
  /** @type {Array<[string, Uint8Array, DecodedVariant]>} */
  const unused = [
    ["dc 3, unused", spliced("grey-baseline", table(0, 3, { 1: 3 }, [0, 1, 2])), g],
    ["ac 1, unused by a grey scan", spliced("grey-baseline", table(1, 1, { 1: 2 }, [0, 1])), g],
    ["dc 2 with a symbol of 16, unused", spliced("rgb-444", table(0, 2, { 2: 1 }, [16])), c],
    ["a used table bogus, then redefined good", spliced("grey-baseline", table(0, 0, { 1: 3 }, [0, 1, 2]), table(0, 0, ...dc0)), g],
  ];
  for (const [label, d, v] of unused) {
    assert.equal(sha(decodeBaselineJpeg(d).samples), v.pillow_sha256, `${label}: libjpeg-turbo's picture`);
    const { hts } = readJpegHeader(d);
    for (const list of [hts.dc, hts.ac]) for (const t of Object.values(list)) assert.ok(t.fast.length === 512 && t.maxcode[17] === 0x7fffffff, label);
  }
});

/* ── R1's edges and R11 (T44, N868) ──────────────────────────────────────── */

test("R1 R6 the edge fixtures: libjpeg-turbo's samples one or two chroma samples wide, one row tall, ending inside an MCU row, restarting every block", () => {
  assert.match(EDGES.provenance, /^Pillow 12\.3\.0 \(libjpeg-turbo /);
  /** @type {Set<string>} */
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

/** A strip `onRows` was handed, its rows copied. @typedef {Object} Strip @property {Uint8Array} rows @property {number} y0 @property {number} count */
/** @typedef {Object} RowsAnswer @property {JpegInfo} info @property {Strip[]} calls @property {Buffer} joined */

/** R11's answer: the rows `onRows` was handed, checked for order as they come, and what it returned.
 *  @param {Uint8Array} d @param {AskedOptions} [opts] @returns {RowsAnswer} */
function rowsOf(d, opts = {}) {
  /** @type {Strip[]} */
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

/** Every fixture R1 decodes, as [name, bytes]: the DCT variants and the edges. @type {Array<[string, Uint8Array]>} */
const DECODABLE = [
  ...DECODED.map(/** @param {DecodedVariant} v @returns {[string, Uint8Array]} */ (v) => [v.name, jpeg(v.name)]),
  ...EDGES.variants.map(/** @param {EdgeVariant} v @returns {[string, Uint8Array]} */ (v) => [`edges ${v.name}`, edge(v)]),
];

test("R11 decodeBaselineJpegRows: its rows joined are R1's rotate-0 samples, byte for byte, for every fixture of every sampling (grey, 4:4:4, 4:2:2, 4:2:0, h1v2, restarts)", () => {
  /** @type {Set<string>} */
  const samplings = new Set();
  for (const [name, d] of DECODABLE) {
    const whole = decodeBaselineJpeg(d, { rotate: 0 });
    const { info, calls, joined } = rowsOf(d);
    assert.deepEqual(info, { width: whole.width, height: whole.height, comps: whole.comps, source: whole.source }, `${name}: R1's answer without its samples`);
    const lastStrip = calls.at(-1);
    if (lastStrip === undefined) throw new TypeError(`${name}: no strip handed over`);
    assert.equal(lastStrip.y0 + lastStrip.count, whole.height, `${name}: every row, and no more`);
    for (const c of calls) assert.equal(c.rows.length, c.count * whole.width * whole.comps, `${name}: rows of width x comps bytes`);
    assert.ok(Buffer.from(whole.samples).equals(joined), `${name}: R1's samples, byte for byte`);
    samplings.add(whole.source.sampling);
  }
  for (const s of ["1x1", "1x1,1x1,1x1", "2x1,1x1,1x1", "2x2,1x1,1x1", "1x2,1x1,1x1"]) assert.ok(samplings.has(s), `sampling ${s}`);
  /* And so libjpeg-turbo's, wherever a fixture's digest is of the unrotated picture. */
  for (const v of DECODED.filter((x) => x.rotate === 0)) assert.equal(sha(rowsOf(jpeg(v.name)).joined), v.pillow_sha256, v.name);
  /* The options agree with the file: the same rows as without them. */
  assert.equal(sha(rowsOf(jpeg("rgb-444"), { expectComps: 3, colorTransform: 1 }).joined), decodedVariant("rgb-444").pillow_sha256);
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
  /** @param {string} label @param {unknown} d @param {AskedOptions} [opts] @returns {{ e: DctRefusal, handed: number }} */
  const same = (label, d, opts = {}) => {
    /** @type {unknown} */ let r1;
    /** @type {unknown} */ let r11;
    let handed = 0;
    try { decodeBaselineJpeg(d, opts); } catch (e) { r1 = e; }
    try { decodeBaselineJpegRows(d, { ...opts, onRows: () => { handed++; } }); } catch (e) { r11 = e; }
    const first = r1, second = r11;
    assert.ok(first, `${label}: R1 refuses`);
    assert.ok(second instanceof DctRefusal, `${label}: R11 refuses with a DctRefusal`);
    assert.deepEqual([second.code, second.message, second.detail],
      first instanceof DctRefusal ? [first.code, first.message, first.detail] : [undefined, undefined, undefined], `${label}: as R1 does`);
    return { e: second, handed };
  };
  /** @type {Set<string>} */
  const codes = new Set();
  for (const v of REFUSED) codes.add(same(v.name, jpeg(v.name)).e.code);
  for (const [label, d, opts] of OTHER_REFUSALS()) {
    const { e, handed } = same(label, d, opts);
    const code = e.code;
    codes.add(code);
    /* A refusal from the header comes before any row is handed over. */
    if (code !== "TRUNCATED" && code !== "CORRUPT_DATA") assert.equal(handed, 0, `${label}: nothing handed over`);
  }
  assert.deepEqual([...codes].sort(), Object.keys(CODES).filter((c) => c !== "UNSUPPORTED_ROTATION").sort(),
    "every code R1 raises, but the rotation R11 never takes");
  /* The control: a baseline fixture decodes, its rows handed over. */
  const g = decodedVariant("grey-baseline");
  assert.equal(sha(rowsOf(jpeg(g.name)).joined), g.pillow_sha256);
  /* R11 takes no rotation: one asked of it is not read. */
  assert.equal(sha(rowsOf(jpeg(g.name), { rotate: 90 }).joined), g.pillow_sha256);
});

test("R11 data that runs out: the rows above the break are the picture's, and no row made of bits the data did not hold is handed over", () => {
  const whole = decodeBaselineJpeg(jpeg("rgb-420-h2v2"));
  const rowBytes = whole.width * 3;
  for (const cut of [400, 600, 800, 1200]) {
    /** @type {Uint8Array[]} */
    const got = [];
    /** @type {unknown} */ let e;
    try { decodeBaselineJpegRows(jpeg("rgb-420-h2v2").subarray(0, cut), { onRows: (rows) => got.push(rows.slice()) }); } catch (x) { e = x; }
    const err = e;
    assert.ok(err instanceof DctRefusal && err.code === "TRUNCATED", `cut at ${cut}: refused TRUNCATED`);
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
      assert.equal(Reflect.getPrototypeOf(rows), Uint8Array.prototype, `${name}: a Uint8Array`);
      assert.equal(rows.length, count * rowBytes, `${name}: count rows of width x comps bytes`);
      assert.ok(Buffer.from(whole.samples.subarray(y0 * rowBytes, (y0 + count) * rowBytes)).equals(rows), `${name}: rows ${y0}..${y0 + count - 1} of R1's rotate-0 samples`);
    } });
  }
  /* A rotated fixture's strips are its unrotated frame's: y0 counts the stored rows. */
  const v = decodedVariant("rgb-420-rotate90");
  const h = readJpegHeader(jpeg(v.name)).frame;
  let last = 0;
  decodeBaselineJpegRows(jpeg(v.name), { onRows(rows, y0, count) { assert.equal(rows.length, count * h.width * 3); last = y0 + count; } });
  assert.equal(last, h.height, "every stored row, in the stored frame's height");
});
