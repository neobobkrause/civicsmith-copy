/* image-codecs R12, R13 (fix round 9, G125a, G125b, G124): every decoder judges what its header or parameters declare
 * BEFORE it allocates, against `READ_BOUNDS`, and the module keeps no numeric literal of its own for a ceiling.
 *
 * The streams below are hostile ones the test builds itself, byte by byte, from the standards' own syntax (a JPEG's
 * markers, a JBIG2 segment's header, a JPEG 2000 codestream's SIZ, COD and QCD): a few hundred bytes that DECLARE a
 * picture the data could never fill. Each is answered `IMAGE_TOO_LARGE` in the codec's own refusal class, with the size,
 * the bound and the sentence's key in `detail`, deterministic and never `transient`, and the test counts the largest typed
 * array or buffer the decoder asked for while it answered (counts, not seconds: R-CLOCK). Either side of each bound is
 * driven: the declared size at the bound is not refused for its size, one past it is. `READ_BOUNDS` is read here too, so
 * a change of the table's figure moves the test with it. PNG's header and chunk bounds are driven in png.test.mjs, where
 * the PngSuite helpers are. */
import "../../../bio-plane/test/sandbox.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { READ_BOUNDS, boundOf } from "../../../bio-plane/src/read-bounds.mjs";
import { peakAllocation } from "./alloc-spy.mjs";
import { ccittDecode, CcittRefusal } from "../../src/ccittdecode.mjs";
import { decodeBaselineJpeg, decodeBaselineJpegRows, DctRefusal } from "../../src/dctdecode.mjs";
import { decodeJbig2, Jbig2Refusal } from "../../src/jbig2decode.mjs";
import { decodeJpx, JpxRefusal } from "../../src/jpxdecode.mjs";
/** @import { DecodedJpeg, JpegInfo } from "../../src/dctdecode.mjs" */

const PIXELS = boundOf("image", "pixels"), EDGE = boundOf("image", "edge");
const IMAGE_ROWS = READ_BOUNDS.image;   // present: boundOf("image", ...) on the line above has read it
/* the rows BOB ruled (K4858), or the rows holding the same figures until runtime-limits has added them */
/** @type {[string, string]} */
const OBJECTS_ROW = IMAGE_ROWS !== undefined && Object.hasOwn(IMAGE_ROWS, "retained_objects") ? ["image", "retained_objects"] : ["office", "retained_objects"];
/** @type {[string, string]} */
const WORKING_ROW = IMAGE_ROWS !== undefined && Object.hasOwn(IMAGE_ROWS, "working_set") ? ["image", "working_set"] : ["ocr", "frame_bytes"];
const OBJECTS = boundOf(...OBJECTS_ROW);

/** @param {number} n @returns {number[]} */
const u16 = (n) => [(n >>> 8) & 255, n & 255];
/** @param {number} n @returns {number[]} */
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** What was thrown, as a DCT refusal, or undefined (what reading its members answered for anything else). @param {unknown} e @returns {DctRefusal | undefined} */
const asDct = (e) => (e instanceof DctRefusal ? e : undefined);
/** What was thrown, as a JBIG2 refusal, or undefined. @param {unknown} e @returns {Jbig2Refusal | undefined} */
const asJbig2 = (e) => (e instanceof Jbig2Refusal ? e : undefined);
/** What was thrown, as a JPX refusal, or undefined. @param {unknown} e @returns {JpxRefusal | undefined} */
const asJpx = (e) => (e instanceof JpxRefusal ? e : undefined);

/* ── CCITT ────────────────────────────────────────────────────────────────── */

test("R12 CCITT: 8,000 bytes declaring 60,000 x 60,000 are refused from the parameters, nothing allocated, never transient", () => {
  const data = new Uint8Array(8000).fill(0xff);
  const { error, peak } = peakAllocation(() => ccittDecode(data, { K: -1, columns: 60000, rows: 60000 }));
  assert.ok(error instanceof CcittRefusal, `a CcittRefusal, not ${error instanceof Error ? error.name : typeof error}`);
  assert.equal(error.code, "IMAGE_TOO_LARGE");
  assert.equal(error.detail.bound_name, "pixels");
  assert.equal(error.detail.size, 60000 * 60000);
  assert.equal(error.detail.bound, PIXELS);
  assert.equal(error.detail.key, "limit.image.pixels");
  assert.deepEqual([error.detail.columns, error.detail.rows], [60000, 60000]);
  assert.ok(!("transient" in error.detail) && !("transient" in error), "final, never retried");
  assert.ok(peak <= data.length, `no allocation past the input (${peak} bytes)`);
});

test("R12 CCITT: the pixel bound either side, and the edge", () => {
  const empty = new Uint8Array(0);
  /* exactly the bound: not refused for its size (no data, so no rows) */
  const at = ccittDecode(empty, { K: -1, columns: 12000, rows: PIXELS / 12000 });
  assert.equal(at.rowsDecoded, 0);
  assert.throws(() => ccittDecode(empty, { K: -1, columns: 12000, rows: PIXELS / 12000 + 1 }),
    /** @param {unknown} e */ (e) => e instanceof CcittRefusal && e.code === "IMAGE_TOO_LARGE" && e.detail.bound_name === "pixels" && e.detail.size === 12000 * (PIXELS / 12000 + 1));
  /* the edge: a width past it is refused whatever the rows */
  assert.throws(() => ccittDecode(empty, { K: 0, columns: EDGE + 1, rows: 1 }),
    /** @param {unknown} e */ (e) => e instanceof CcittRefusal && e.code === "IMAGE_TOO_LARGE" && e.detail.bound_name === "edge" && e.detail.size === EDGE + 1 && e.detail.bound === EDGE);
  assert.doesNotThrow(() => ccittDecode(empty, { K: 0, columns: EDGE, rows: 1 }));
  /* rows not declared: the data is not allowed to run the output past the bound */
  assert.throws(() => ccittDecode(new Uint8Array(1 << 16).fill(0xff), { K: -1, columns: 60000, rows: 0 }),
    /** @param {unknown} e */ (e) => e instanceof CcittRefusal && e.code === "IMAGE_TOO_LARGE");
});

/* ── DCT ──────────────────────────────────────────────────────────────────── */

/** A baseline JPEG's markers to the start of the scan, declaring w x h and `comps` components; no Huffman tables, no data.
 *  @param {number} w @param {number} h @param {number} [comps] @returns {Uint8Array} */
function jpegDeclaring(w, h, comps = 3) {
  const out = [0xff, 0xd8, 0xff, 0xdb, ...u16(67), 0, ...Array.from({ length: 64 }, () => 1)];
  out.push(0xff, 0xc0, ...u16(8 + 3 * comps), 8, ...u16(h), ...u16(w), comps);
  for (let i = 0; i < comps; i++) out.push(i + 1, 0x11, 0);
  out.push(0xff, 0xda, ...u16(6 + 2 * comps), comps);
  for (let i = 0; i < comps; i++) out.push(i + 1, 0x00);
  out.push(0, 63, 0, 0x00, 0x00, 0xff, 0xd9);
  return Uint8Array.from(out);
}

test("R12 DCT: a ~330-byte JPEG declaring 60,000 x 60,000 and one declaring 30,000 x 30,000 are refused from the frame, both entry points", () => {
  /** @type {Array<[number, number]>} */
  const SIZES = [[60000, 60000], [30000, 30000]];
  for (const [w, h] of SIZES) {
    /** @type {Array<[string, (d: Uint8Array) => unknown]>} */
    const ROUTES = [["decodeBaselineJpeg", (d) => decodeBaselineJpeg(d)], ["decodeBaselineJpegRows", (d) => decodeBaselineJpegRows(d, { onRows() { assert.fail("no row is handed over"); } })]];
    for (const [name, run] of ROUTES) {
      const d = jpegDeclaring(w, h);
      const { error, peak } = peakAllocation(() => run(d));
      assert.ok(error instanceof DctRefusal, `${name} ${w}x${h}: a DctRefusal, not ${error instanceof Error ? error.name : typeof error}: ${error instanceof Error ? error.message : String(error)}`);
      assert.equal(error.code, "IMAGE_TOO_LARGE", `${name} ${w}x${h}`);
      const rowsRoute = name === "decodeBaselineJpegRows" && IMAGE_ROWS !== undefined && Object.hasOwn(IMAGE_ROWS, "rows_pixels");   // K4862
      assert.equal(error.detail.bound_name, rowsRoute ? "rows_pixels" : "pixels");
      assert.equal(error.detail.size, w * h);
      assert.equal(error.detail.bound, rowsRoute ? boundOf("image", "rows_pixels") : PIXELS);
      assert.deepEqual([error.detail.width, error.detail.height], [w, h]);
      assert.ok(!("transient" in error.detail) && !("transient" in error));
      assert.ok(peak < 1 << 20, `${name} ${w}x${h}: no allocation sized by the frame (${peak} bytes)`);
    }
  }
});

test("R12 DCT: the pixel bound either side, grey and colour; the edge", () => {
  /** @param {Uint8Array} d @returns {unknown} */
  const refused = (d) => { try { decodeBaselineJpeg(d); } catch (e) { return e; } return null; };
  /* at the bound the frame is not refused for its size: it is refused for the tables this stream does not carry */
  const at = refused(jpegDeclaring(10000, PIXELS / 10000, 1));
  assert.ok(at instanceof DctRefusal && at.code === "CORRUPT_DATA", `${asDct(at)?.code}`);
  const over = refused(jpegDeclaring(10000, PIXELS / 10000 + 1, 1));
  assert.ok(over instanceof DctRefusal && over.code === "IMAGE_TOO_LARGE" && over.detail.size === 10000 * (PIXELS / 10000 + 1));
  const colourAt = refused(jpegDeclaring(10000, PIXELS / 10000, 3));
  assert.equal(asDct(colourAt)?.code, "CORRUPT_DATA", "components do not change the pixel count the bound judges");
  /* a JPEG's width and height are 16-bit fields, so its edge is the field's: the widest and tallest frames are judged by their pixels */
  const wide = refused(jpegDeclaring(EDGE, 2, 1));
  assert.equal(asDct(wide)?.code, "CORRUPT_DATA", "65,535 x 2 is within both bounds");
  const tall = asDct(refused(jpegDeclaring(EDGE, EDGE, 1)));
  assert.equal(tall?.code, "IMAGE_TOO_LARGE");
  assert.equal(tall?.detail.bound_name, "pixels");
});

/* ── JBIG2 ────────────────────────────────────────────────────────────────── */

/** @param {number} number @param {number} type @param {number[]} data @param {number} [page] @returns {number[]} */
const seg = (number, type, data, page = 1) => [...u32(number), type, 0, page, ...u32(data.length), ...data];
/** @param {number} w @param {number} h @returns {number[]} */
const pageInfo = (w, h) => [...u32(w), ...u32(h), ...u32(0), ...u32(0), 0, 0, 0];
/** @param {number} w @param {number} h @param {number} [x] @param {number} [y] @param {number} [op] @returns {number[]} */
const regionInfo = (w, h, x = 0, y = 0, op = 0) => [...u32(w), ...u32(h), ...u32(x), ...u32(y), op];
/** @param {...number[]} segs @returns {Uint8Array} */
const stream = (...segs) => Uint8Array.from(segs.flat());

test("R12 JBIG2: a page declaring 16,000 x 16,000 in 30 bytes is refused from the page information, nothing sized by it allocated", () => {
  const d = stream(seg(0, 48, pageInfo(16000, 16000)));
  assert.ok(d.length <= 40);
  const { error, peak } = peakAllocation(() => decodeJbig2(d, null));
  assert.ok(error instanceof Jbig2Refusal, `a Jbig2Refusal, not ${error instanceof Error ? error.name : typeof error}: ${error instanceof Error ? error.message : String(error)}`);
  assert.equal(error.code, "IMAGE_TOO_LARGE");
  assert.equal(error.detail.bound_name, "pixels");
  assert.equal(error.detail.size, 16000 * 16000);
  assert.equal(error.detail.bound, PIXELS);
  assert.equal(error.detail.segmentType, 48, "the refusal names the segment it arose in");
  assert.ok(!("transient" in error.detail) && !("transient" in error));
  assert.ok(peak < 1 << 20, `no allocation sized by the page (${peak} bytes)`);
});

test("R12 JBIG2: a region, a width past the edge, and a pattern dictionary each judged from their own header", () => {
  /** @param {number} w @param {number} h @returns {number[]} */
  const generic = (w, h) => seg(1, 38, [...regionInfo(w, h), 0, 3, 0xff, 0xfd, 0xff, 2, 0xfe, 0xfe, 0xfe, 0xff, 0xac]);
  const big = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(100, 100)), generic(16000, 16000)), null));
  const bigError = big.error;
  assert.ok(bigError instanceof Jbig2Refusal && bigError.code === "IMAGE_TOO_LARGE" && bigError.detail.segmentType === 38, `${asJbig2(bigError)?.code}`);
  assert.ok(big.peak < 1 << 20);
  const wide = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(EDGE + 1, 1))), null));
  const wideError = asJbig2(wide.error);
  assert.equal(wideError?.code, "IMAGE_TOO_LARGE");
  assert.equal(wideError?.detail.bound_name, "edge");
  assert.equal(wideError?.detail.size, EDGE + 1);
  /* a pattern dictionary of 2^32 patterns would be a bitmap 2^32 wide */
  /** @param {number} grayMax @returns {number[]} */
  const patterns = (grayMax) => seg(2, 16, [0, 1, 1, ...u32(grayMax), 0x00, 0x00]);
  const dict = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(8, 8)), patterns(0xffffffff)), null));
  const dictError = dict.error;
  assert.ok(dictError instanceof Jbig2Refusal && dictError.code === "IMAGE_TOO_LARGE" && dictError.detail.segmentType === 16, `${asJbig2(dictError)?.code}`);
  assert.ok(dict.peak < 1 << 20);
  /* the counts a dictionary declares are judged too: 2^22 patterns would be four million bitmaps, 2^29 symbols a 1 GiB table of contexts */
  const manyPatterns = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(8, 8)), patterns(2 ** 22 - 1)), null));
  const manyPatternsError = manyPatterns.error;
  assert.ok(manyPatternsError instanceof Jbig2Refusal && manyPatternsError.code === "IMAGE_TOO_LARGE", `${asJbig2(manyPatternsError)?.code}`);
  assert.deepEqual([manyPatternsError.detail.bound_name, manyPatternsError.detail.size, manyPatternsError.detail.bound, manyPatternsError.detail.segmentType], ["objects", 2 ** 22, OBJECTS, 16]);
  assert.ok(manyPatterns.peak < 1 << 20);
  /** @param {number} numNew @returns {number[]} */
  const symbolDict = (numNew) => seg(3, 0, [...u16(0), 3, 0xff, 0xfd, 0xff, 2, 0xfe, 0xfe, 0xfe, ...u32(0), ...u32(numNew), 0x00, 0x00]);
  const manySymbols = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(8, 8)), symbolDict(2 ** 29)), null));
  const manySymbolsError = manySymbols.error;
  assert.ok(manySymbolsError instanceof Jbig2Refusal && manySymbolsError.code === "IMAGE_TOO_LARGE", `${asJbig2(manySymbolsError)?.code}`);
  assert.deepEqual([manySymbolsError.detail.bound_name, manySymbolsError.detail.size, manySymbolsError.detail.segmentType], ["objects", 2 ** 29, 0]);
  assert.ok(manySymbols.peak < 1 << 20);
  const fewPatterns = peakAllocation(() => decodeJbig2(stream(seg(0, 48, pageInfo(8, 8)), patterns(60000)), null));
  assert.equal(asJbig2(fewPatterns.error)?.code, "TRUNCATED", "60,000 patterns, a bitmap within the edge: refused as the short data it is, not for its count");
});

test("R12 JBIG2: the pixel bound either side", () => {
  /* one pixel past the bound is refused ... */
  const over = (() => { try { decodeJbig2(stream(seg(0, 48, pageInfo(12000, PIXELS / 12000 + 1))), null); } catch (e) { return e; } return null; })();
  assert.ok(over instanceof Jbig2Refusal && over.code === "IMAGE_TOO_LARGE" && over.detail.bound_name === "pixels" && over.detail.size === 12000 * (PIXELS / 12000 + 1), `${asJbig2(over)?.code}`);
  /* ... and the bound itself is a page (one byte a pixel while it is decoded, a bit a pixel when it is answered) */
  const out = decodeJbig2(stream(seg(0, 48, pageInfo(12000, PIXELS / 12000))), null);
  assert.deepEqual([out.width, out.height], [12000, PIXELS / 12000]);
  assert.equal(out.packed.length, 1500 * (PIXELS / 12000));
  /* the widest page the edge admits */
  assert.deepEqual([decodeJbig2(stream(seg(0, 48, pageInfo(EDGE, 1))), null).width], [EDGE]);
});

/* ── JPX ──────────────────────────────────────────────────────────────────── */

/** A square picture's codestream: `size` x `size`, unless `w` or `h` says otherwise.
 *  @typedef {Object} SquareSpec
 *  @property {number} size @property {number} [w] @property {number} [h] @property {number} [levels] @property {number | null} [pp]
 *  @property {number} [cblk] @property {number} [comps] @property {number} [layers] */
/** A picture's codestream of `w` x `h`.
 *  @typedef {Object} SidedSpec
 *  @property {undefined} [size] @property {number} w @property {number} h @property {number} [levels] @property {number | null} [pp]
 *  @property {number} [cblk] @property {number} [comps] @property {number} [layers] */

/** A codestream's main header and one tile-part, declaring a `size` x `size` single-tile grey picture in 8 bytes of
 *  data: `levels` decomposition levels, precincts of 2^pp (or the default, whole-tile, precincts when pp is null).
 *  @param {SquareSpec | SidedSpec} spec @returns {Uint8Array} */
function codestream(spec) {
  const { size, w: givenW, h: givenH, levels = 5, pp = null, cblk = 4, comps = 1, layers = 1 } = spec;
  const w = size === undefined ? givenW : givenW === undefined ? size : givenW;
  const h = size === undefined ? givenH : givenH === undefined ? size : givenH;
  const siz = [0, 0, ...u32(w), ...u32(h), ...u32(0), ...u32(0), ...u32(w), ...u32(h), ...u32(0), ...u32(0), ...u16(comps)];
  for (let c = 0; c < comps; c++) siz.push(7, 1, 1);
  const cod = [pp === null ? 0 : 1, 0, ...u16(layers), 0, levels, cblk, cblk, 0, 1];
  if (pp !== null) for (let r = 0; r <= levels; r++) cod.push((pp << 4) | pp);
  const qcd = [0x40];
  for (let i = 0; i < 1 + 3 * levels; i++) qcd.push(8 << 3);
  /** @param {number} m @param {number[]} body @returns {number[]} */
  const marker = (m, body) => [...u16(m), ...u16(body.length + 2), ...body];
  const sot = [...u16(0xff90), ...u16(10), ...u16(0), ...u32(0), 0, 1];
  return Uint8Array.from([...u16(0xff4f), ...marker(0xff51, siz), ...marker(0xff52, cod), ...marker(0xff5c, qcd), ...sot, ...u16(0xff93),
    0x80, 0, 0, 0, 0, 0, 0, 0, ...u16(0xffd9)]);
}

test("R12 R4 JPX: SIZ 500, 1000, 2000 with 2 x 2 precincts and 1500 with 1 x 1, in a few hundred bytes, are refused before any precinct object", () => {
  /** @type {Array<[number, number]>} */
  const CASES = [[500, 1], [1000, 1], [2000, 1], [1500, 0]];
  for (const [size, pp] of CASES) {
    const d = codestream({ size, pp });
    assert.ok(d.length < 200);
    const { error, peak } = peakAllocation(() => decodeJpx(d));
    assert.ok(error instanceof JpxRefusal, `${size}/${pp}: a JpxRefusal, not ${error instanceof Error ? error.name : typeof error}: ${error instanceof Error ? error.message : String(error)}`);
    assert.equal(error.code, "IMAGE_TOO_LARGE", `${size}/${pp}`);
    assert.equal(error.detail.bound_name, "objects", `${size}/${pp}`);
    assert.equal(error.detail.bound, OBJECTS);
    const count = error.detail.size;
    assert.ok(count !== undefined && count > OBJECTS, `${size}/${pp}: the count ${count}`);
    assert.deepEqual([error.detail.width, error.detail.height], [size, size]);
    assert.ok(!("transient" in error.detail) && !("transient" in error));
    assert.ok(peak < 16 << 20, `${size}/${pp}: no object table, no allocation sized by the precincts (${peak} bytes)`);
  }
});

test("R12 R4 JPX: the retained-objects bound counts precincts and code-blocks; the same picture with whole-tile precincts, and the pixel bound", () => {
  /** @param {Uint8Array} d @returns {unknown} */
  const refusal = (d) => { try { decodeJpx(d); } catch (e) { return e; } return null; };
  /* no decomposition: one band, 2 x 2 precincts each holding one 2 x 2 code-block: the count is a closed form of the size */
  /** @param {number} size @returns {unknown} */
  const lone = (size) => refusal(codestream({ size, levels: 0, pp: 1, cblk: 0 }));
  const over = lone(708);
  assert.ok(over instanceof JpxRefusal && over.code === "IMAGE_TOO_LARGE" && over.detail.bound_name === "objects", `${asJpx(over)?.code}`);
  const overSize = over.detail.size;
  assert.equal(overSize, 1 + 2 * 354 * 354, "the tile, 354 x 354 precincts and as many code-blocks");
  assert.ok(overSize !== undefined && overSize > OBJECTS && 1 + 2 * 353 * 353 <= OBJECTS, "708 is the first even size past the bound, 706 the last within it");
  assert.notEqual(asJpx(lone(200))?.code, "IMAGE_TOO_LARGE", "200 x 200: 20,000 objects, within the bound, goes on to its data (which is not there)");
  /* the same picture with the default precincts has a handful of objects: it is not refused for them (its few bytes decode, to nothing) */
  const plain = refusal(codestream({ size: 500, pp: null }));
  assert.notEqual(asJpx(plain)?.code, "IMAGE_TOO_LARGE");
  /* the packet order lists every layer of every precinct before a byte is read: 65,535 layers of a small picture's six resolutions are 393,210 entries */
  const layered = refusal(codestream({ size: 100, pp: null, layers: 65535 }));
  assert.ok(layered instanceof JpxRefusal && layered.code === "IMAGE_TOO_LARGE" && layered.detail.bound_name === "objects", `${asJpx(layered)?.code}`);
  const layeredSize = layered.detail.size;
  assert.ok(layeredSize !== undefined && layeredSize > OBJECTS);
  assert.notEqual(asJpx(refusal(codestream({ size: 100, pp: null, layers: 12 })))?.code, "IMAGE_TOO_LARGE", "twelve layers are not");
  /* the pixel bound is judged from SIZ too */
  const huge = refusal(codestream({ size: 11000, pp: null }));
  assert.ok(huge instanceof JpxRefusal && huge.code === "IMAGE_TOO_LARGE", `${asJpx(huge)?.code}`);
  /** @type {Array<string | undefined>} */
  const JUDGED = ["pixels", "working_set"];
  assert.ok(JUDGED.includes(huge.detail.bound_name));
  /* a width past the edge, however short; the edge itself is not refused for it */
  const wide = refusal(codestream({ w: EDGE + 1, h: 1, pp: null }));
  assert.ok(wide instanceof JpxRefusal && wide.code === "IMAGE_TOO_LARGE" && wide.detail.bound_name === "edge" && wide.detail.size === EDGE + 1 && wide.detail.bound === EDGE, `${asJpx(wide)?.code}`);
  assert.notEqual(asJpx(refusal(codestream({ w: EDGE, h: 1, pp: null })))?.code, "IMAGE_TOO_LARGE");
});

/* ── R13: no ceiling of the module's own ──────────────────────────────────── */

test("R13 the module's source holds no numeric literal for a ceiling it keeps: each is read from READ_BOUNDS", () => {
  /* each of the module's sources, read from the module's own folder */
  const text = {
    ccittdecode: readFileSync(new URL("../../src/ccittdecode.mjs", import.meta.url), "utf8"),
    dctdecode: readFileSync(new URL("../../src/dctdecode.mjs", import.meta.url), "utf8"),
    jbig2decode: readFileSync(new URL("../../src/jbig2decode.mjs", import.meta.url), "utf8"),
    jpxdecode: readFileSync(new URL("../../src/jpxdecode.mjs", import.meta.url), "utf8"),
    mq: readFileSync(new URL("../../src/mq.mjs", import.meta.url), "utf8"),
    pngdecode: readFileSync(new URL("../../src/pngdecode.mjs", import.meta.url), "utf8"),
  };
  /** @param {string} spelling @returns {RegExp} */
  const literal = (spelling) => new RegExp(`(?<![\\w.])${spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.])`);
  /** @param {string} t @returns {string} */
  const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  /* every figure of every column of the rows this module quotes, in the ways a number is written */
  const figures = [
    ...["pixels", "edge", "chunks", "row_stride"].map((n) => boundOf("image", n)),
    boundOf(...WORKING_ROW), boundOf(...OBJECTS_ROW),
  ];
  /** @param {number} n @returns {string[]} */
  const spellings = (n) => [String(n), n.toLocaleString("en-US").replaceAll(",", "_"), `0x${n.toString(16)}`, ...(Number.isInteger(Math.log2(n)) ? [`1 << ${Math.log2(n)}`, `2 ** ${Math.log2(n)}`] : []),
    ...(n % 1048576 === 0 ? [`${n / 1048576} * 1024 * 1024`, `${n / 1048576} * 1048576`] : [])];
  /** @type {string[]} */
  const found = [];
  /** @type {Array<"ccittdecode" | "dctdecode" | "jbig2decode" | "jpxdecode" | "mq" | "pngdecode">} */
  const SOURCES = ["ccittdecode", "dctdecode", "jbig2decode", "jpxdecode", "mq", "pngdecode"];
  for (const name of SOURCES) {
    const c = code(text[name]);
    for (const n of figures) for (const s of spellings(n)) {
      /* 65,536 and 65,535 are also the sizes of a 16-bit field, a JPEG's fixed-point scale and a JBIG2 context set: judged by the next test, not here */
      if (n < 100000) continue;
      if (literal(s).test(c)) found.push(`${name}: ${s}`);
    }
    /* the 2^28 bitmap ceiling the JBIG2 decoder kept before the table */
    for (const s of ["1 << 28", "2 ** 28", "0x10000000", "268435456", "268_435_456"]) if (literal(s).test(c)) found.push(`${name}: ${s}`);
    /* the 1 << 20 default row ceiling of the CCITT decoder */
    if (name === "ccittdecode" && /1 << 20/.test(c)) found.push(`${name}: 1 << 20`);
  }
  assert.deepEqual(found, [], "ceilings written as literals");
  /* and each decoder that keeps one reads it from the table */
  /** @type {Array<"ccittdecode" | "dctdecode" | "jbig2decode" | "jpxdecode" | "pngdecode">} */
  const READERS = ["ccittdecode", "dctdecode", "jbig2decode", "jpxdecode", "pngdecode"];
  for (const name of READERS) assert.match(code(text[name]), /\bboundOf\(/, `${name} reads its ceilings with boundOf`);
  assert.match(code(text.jpxdecode), /boundOf\("image", "pixels"\)/);
  assert.match(code(text.pngdecode), /boundOf\("image", "chunks"\)/);
  /** @type {Array<"ccittdecode" | "jbig2decode" | "jpxdecode" | "pngdecode">} */
  const EDGED = ["ccittdecode", "jbig2decode", "jpxdecode", "pngdecode"];
  for (const name of EDGED) assert.match(code(text[name]), /boundOf\("image", "edge"\)/, `${name}: the edge`);
});

test("R12 R11 DCT: the row-by-row decoder is judged against its own row (K4862), the whole-frame decode against image.pixels", () => {
  const ROWS_NAME = IMAGE_ROWS !== undefined && Object.hasOwn(IMAGE_ROWS, "rows_pixels") ? "rows_pixels" : "pixels";
  const ROWS = boundOf("image", ROWS_NAME);
  /** @param {(d: Uint8Array) => unknown} run @param {Uint8Array} d @returns {unknown} */
  const of = (run, d) => { try { run(d); } catch (e) { return e; } return null; };
  /** @param {Uint8Array} d @returns {DecodedJpeg} */
  const whole = (d) => decodeBaselineJpeg(d);
  /** @param {Uint8Array} d @returns {JpegInfo} */
  const rows = (d) => decodeBaselineJpegRows(d, { onRows() {} });
  const mid = jpegDeclaring(10000, 12500, 1);   // 125 million pixels: past image.pixels
  const w = of(whole, mid);
  assert.ok(w instanceof DctRefusal && w.code === "IMAGE_TOO_LARGE" && w.detail.bound_name === "pixels" && w.detail.bound === PIXELS);
  const r = of(rows, mid);
  if (ROWS >= 125000000) assert.equal(asDct(r)?.code, "CORRUPT_DATA", "within the rows route's ceiling: goes on to its (absent) tables");
  else assert.ok(r instanceof DctRefusal && r.code === "IMAGE_TOO_LARGE" && r.detail.bound_name === ROWS_NAME);
  /* the hostile header is refused by the rows route from the header, whatever its row */
  const hostile = of(rows, jpegDeclaring(60000, 60000, 3));
  assert.ok(hostile instanceof DctRefusal && hostile.code === "IMAGE_TOO_LARGE" && hostile.detail.bound_name === ROWS_NAME && hostile.detail.bound === ROWS && hostile.detail.key === `limit.image.${ROWS_NAME}`);
  const over = of(rows, jpegDeclaring(ROWS_NAME === "pixels" ? 12000 : 16384, Math.floor(ROWS / (ROWS_NAME === "pixels" ? 12000 : 16384)) + 1, 1));
  assert.equal(asDct(over)?.code, "IMAGE_TOO_LARGE", "one row past the ceiling");
});
