/* jbig2decode.mjs — D-622: a JBIG2 decoder (ITU-T T.88) for the `JBIG2Decode`
 * image of an image-only PDF page, so tier 3 can read it in-isolate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT EXISTS, AND WHY IT DECODES MORE THAN A GENERIC REGION
 * ─────────────────────────────────────────────────────────────────────────────
 * No tier read a JBIG2 page: `decodeImage` refused the filter and tiers 1-2 found
 * no glyph. The held pages this was built for are NOT generic regions: a scanner
 * in lossless "text" mode writes one symbol dictionary (the shapes of the page's
 * characters, in the PDF's `/JBIG2Globals`) and one immediate text region per
 * page (where each shape is drawn). So this decodes every region type a page
 * composes from — generic (arithmetic and MMR), generic refinement, symbol
 * dictionary, text (arithmetic and Huffman coded), pattern dictionary and
 * halftone — and REFUSES BY NAME what it does not decode (see JBIG2_REFUSES).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "CORRECT" MEANS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * JBIG2 is lossless as coded: the standard defines every pixel, so there is one
 * right picture, and the suite checks this decoder's against jbig2dec's (the
 * decoder MuPDF and Ghostscript use, sharing no line with this file), pixel for
 * pixel. Where jbig2dec and T.88 disagree on something a real stream can carry,
 * this file follows jbig2dec and says so at the place (the refinement template-1
 * typical-prediction context), because the reference decoder is how a reader
 * checks the picture. Where jbig2dec INVENTS pixels — it pads a short MMR region
 * with white and draws a region whose arithmetic data ran out — this file refuses
 * instead: a page it cannot finish is `TRUNCATED`, never a picture it guessed.
 *
 * Every error thrown here is a `Jbig2Refusal` carrying a code:
 *   UNSUPPORTED  a feature this decoder does not decode, named in `feature`
 *   TRUNCATED    the data ends before the picture does
 *   CORRUPT      the data contradicts itself or the standard
 * `pagepixels.mjs` turns each into one of its declared refusals.
 *
 * Bitmaps are held one byte per pixel (1 = black, JBIG2's sense) while decoding,
 * which keeps every context lookup a plain array read; the page is packed to one
 * bit per pixel only at the end.
 */

import { MqDecoder, mqContexts } from "./mq.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { READ_BOUNDS, boundOf, statement } from "../../bio-plane/src/read-bounds.mjs";

export class Jbig2Refusal extends Error {
  constructor(code, detail = {}) {
    super(`${code}${detail.feature ? `: ${detail.feature}` : detail.note ? `: ${detail.note}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}
const unsupported = (feature, extra = {}) => new Jbig2Refusal("UNSUPPORTED", { feature, ...extra });
const corrupt = (note, extra = {}) => new Jbig2Refusal("CORRUPT", { note, ...extra });
const truncated = (note, extra = {}) => new Jbig2Refusal("TRUNCATED", { note, ...extra });

/** What this decoder refuses, by name — every `feature` an UNSUPPORTED refusal
 *  can carry. Exported so the suite can drive each one. */
export const JBIG2_REFUSES = Object.freeze({
  "colour extension": localize("image-codecs.jbig2decode.a_region_s_colour_extension", "a region's colour-extension flag (T.88 Amendment 3) is set"),
  "12 adaptive-template pixels": "a generic region's extended template (EXTTEMPLATE) is used",
  "reused bitmap coding contexts": localize("image-codecs.jbig2decode.a_symbol_dictionary_reuses_a", "a symbol dictionary reuses a previous dictionary's arithmetic contexts"),
  "Huffman-coded refinement": localize("image-codecs.jbig2decode.a_huffman_coded_symbol_dictionary", "a Huffman-coded symbol dictionary or text region refines its symbols"),
  "a necessary extension segment": localize("image-codecs.jbig2decode.an_extension_segment_the_decoder", "an extension segment the decoder must understand and does not"),
  "segment type": localize("image-codecs.jbig2decode.a_segment_type_t_88", "a segment type T.88 does not define"),
  "several pages": localize("image-codecs.jbig2decode.the_stream_holds_more_than", "the stream holds more than one page"),
  "no page": localize("image-codecs.jbig2decode.the_stream_holds_no_page", "the stream holds no page information segment"),
});

/* THE DECLARED SIZES (R12, fix round 9, G125a): a page, region, symbol or pattern bitmap is judged against the table
 * before any of it is allocated. The decode holds a bitmap a byte a pixel, so the pixel bound is also the byte bound. */
const PIXELS_MAX = boundOf("image", "pixels");
const EDGE_MAX = boundOf("image", "edge");
/* the symbols of a dictionary and the patterns of a pattern dictionary are retained objects, one bitmap each: the table's
 * retained-objects bound (250,000; `image.retained_objects`, the row JPX counts its precincts against, see jpxdecode.mjs; K4858) */
const OBJECTS_ROW = Object.hasOwn(READ_BOUNDS.image, "retained_objects") ? ["image", "retained_objects"] : ["office", "retained_objects"];
const OBJECTS_MAX = boundOf(...OBJECTS_ROW);
/** IMAGE_TOO_LARGE: final and deterministic, with the declared size, the bound it was judged against and the sentence's key. */
const tooLarge = (kind, name, size, note, extra) => new Jbig2Refusal("IMAGE_TOO_LARGE", { note, bound_name: name, ...statement(kind, name, size), ...extra });
const tooWide = (w, h) => tooLarge("image", "edge", Math.max(w, h),
  localize("image-codecs.jbig2decode.the_bitmap_is_w_by_h", "the bitmap is {w} by {h}, and the decoder reads an edge of at most {bound}", { w: String(w), h: String(h), bound: String(EDGE_MAX) }), { width: w, height: h });
const tooManyObjects = (n, note) => tooLarge(...OBJECTS_ROW, n, note, { bound_name: "objects" });
const tooMany = (w, h) => tooLarge("image", "pixels", w * h,
  localize("image-codecs.jbig2decode.the_bitmap_is_w_by_h_2", "the bitmap is {w} by {h}, past the {bound} pixels the decoder reads", { w: String(w), h: String(h), bound: String(PIXELS_MAX) }), { width: w, height: h });

/* ── bitmaps ──────────────────────────────────────────────────────────────── */

const bitmap = (w, h, fill = 0) => {
  if (!(Number.isInteger(w) && Number.isInteger(h)) || w < 0 || h < 0) throw corrupt(`bitmap size ${w}x${h}`);
  if (Math.max(w, h) > EDGE_MAX) throw tooWide(w, h);
  if (w * h > PIXELS_MAX) throw tooMany(w, h);
  const d = new Uint8Array(w * h);
  if (fill) d.fill(1);
  return { w, h, d };
};

/** Draw `src` into `dst` at (x, y) with combination operator `op`
 *  (0 OR, 1 AND, 2 XOR, 3 XNOR, 4 REPLACE), clipped to `dst`. */
function compose(dst, src, x, y, op) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(dst.w, x + src.w), y1 = Math.min(dst.h, y + src.h);
  if (x0 >= x1 || y0 >= y1) return;
  const D = dst.d, S = src.d;
  for (let yy = y0; yy < y1; yy++) {
    let di = yy * dst.w + x0, si = (yy - y) * src.w + (x0 - x);
    const de = yy * dst.w + x1;
    switch (op) {
      case 0: for (; di < de; di++, si++) D[di] |= S[si]; break;
      case 1: for (; di < de; di++, si++) D[di] &= S[si]; break;
      case 2: for (; di < de; di++, si++) D[di] ^= S[si]; break;
      case 3: for (; di < de; di++, si++) D[di] = 1 - (D[di] ^ S[si]); break;
      case 4: for (; di < de; di++, si++) D[di] = S[si]; break;
      default: throw corrupt(`combination operator ${op}`);
    }
  }
}

/* ── the byte reader ──────────────────────────────────────────────────────── */

class Reader {
  constructor(d, p = 0, end = d.length) { this.d = d; this.p = p; this.end = end; }
  need(n, what) { if (this.p + n > this.end) throw truncated(localize("image-codecs.jbig2decode.what_n_bytes_needed_v1", "{what}: {n} bytes needed, {v1} left", { what: String(what), n: String(n), v1: String(this.end - this.p) })); }
  u8(what = "a byte") { this.need(1, what); return this.d[this.p++]; }
  u16(what = "a 16-bit field") { this.need(2, what); const v = (this.d[this.p] << 8) | this.d[this.p + 1]; this.p += 2; return v; }
  u32(what = "a 32-bit field") { this.need(4, what); const d = this.d, p = this.p; this.p += 4; return ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0; }
  i32(what) { return this.u32(what) | 0; }
  i8(what) { const v = this.u8(what); return v > 127 ? v - 256 : v; }
}

/* ── integer arithmetic decoding (T.88 Annex A) ───────────────────────────── */

const OOB = null;
const iaCtx = () => mqContexts(512);

/** IAx: a signed integer or OOB (Annex A.2). */
function iaDecode(mq, ctx) {
  let prev = 1;
  const bit = () => {
    const b = mq.decode(ctx, prev);
    prev = prev < 256 ? (prev << 1) | b : (((prev << 1) | b) & 511) | 256;
    return b;
  };
  const s = bit();
  let n, off;
  if (!bit()) { n = 2; off = 0; }
  else if (!bit()) { n = 4; off = 4; }
  else if (!bit()) { n = 6; off = 20; }
  else if (!bit()) { n = 8; off = 84; }
  else if (!bit()) { n = 12; off = 340; }
  else { n = 32; off = 4436; }
  let v = 0;
  for (let i = 0; i < n; i++) v = v * 2 + bit();
  v = Math.min(v + off, 0x7fffffff);
  if (s && v === 0) return OOB;
  return s ? -v : v;
}

/** IAID: an unsigned `len`-bit symbol id (Annex A.3). */
function iaidDecode(mq, ctx, len) {
  let prev = 1;
  for (let i = 0; i < len; i++) prev = (prev << 1) | mq.decode(ctx, prev);
  return prev - (1 << len);
}

const intOrThrow = (v, what) => { if (v === OOB) throw corrupt(localize("image-codecs.jbig2decode.oob_where_what_is_required", "OOB where {what} is required", { what: String(what) })); return v; };

/* ── Huffman tables (T.88 Annex B) ────────────────────────────────────────── */

/* Each standard table as [PREFLEN, RANGELEN, RANGELOW, kind] lines, in the
 * standard's order; kind is "" for an ordinary line, "low" and "high" for the
 * lower and upper range lines, and "oob". Tables B.1–B.15. */
const L = (p, r, low, kind = "") => [p, r, low, kind];
const STANDARD_TABLES = {
  1: [L(1, 4, 0), L(2, 8, 16), L(3, 16, 272), L(3, 32, 65808, "high")],
  2: [L(1, 0, 0), L(2, 0, 1), L(3, 0, 2), L(4, 3, 3), L(5, 6, 11), L(6, 32, 75, "high"), L(6, 0, 0, "oob")],
  3: [L(8, 8, -256), L(1, 0, 0), L(2, 0, 1), L(3, 0, 2), L(4, 3, 3), L(5, 6, 11), L(8, 32, -257, "low"),
      L(7, 32, 75, "high"), L(6, 0, 0, "oob")],
  4: [L(1, 0, 1), L(2, 0, 2), L(3, 0, 3), L(4, 3, 4), L(5, 6, 12), L(5, 32, 76, "high")],
  5: [L(7, 8, -255), L(1, 0, 1), L(2, 0, 2), L(3, 0, 3), L(4, 3, 4), L(5, 6, 12), L(7, 32, -256, "low"),
      L(6, 32, 76, "high")],
  6: [L(5, 10, -2048), L(4, 9, -1024), L(4, 8, -512), L(4, 7, -256), L(5, 6, -128), L(5, 5, -64), L(4, 5, -32),
      L(2, 7, 0), L(3, 7, 128), L(3, 8, 256), L(4, 9, 512), L(4, 10, 1024), L(6, 32, -2049, "low"),
      L(6, 32, 2048, "high")],
  7: [L(4, 9, -1024), L(3, 8, -512), L(4, 7, -256), L(5, 6, -128), L(5, 5, -64), L(4, 5, -32), L(4, 5, 0),
      L(5, 5, 32), L(5, 6, 64), L(4, 7, 128), L(3, 8, 256), L(3, 9, 512), L(3, 10, 1024),
      L(5, 32, -1025, "low"), L(5, 32, 2048, "high")],
  8: [L(8, 3, -15), L(9, 1, -7), L(8, 1, -5), L(9, 0, -3), L(7, 0, -2), L(4, 0, -1), L(2, 1, 0), L(5, 0, 2),
      L(6, 0, 3), L(3, 4, 4), L(6, 1, 20), L(4, 4, 22), L(4, 5, 38), L(5, 6, 70), L(5, 7, 134), L(6, 7, 262),
      L(7, 8, 390), L(6, 10, 646), L(9, 32, -16, "low"), L(9, 32, 1670, "high"), L(2, 0, 0, "oob")],
  9: [L(8, 4, -31), L(9, 2, -15), L(8, 2, -11), L(9, 1, -7), L(7, 1, -5), L(4, 1, -3), L(3, 1, -1), L(3, 1, 1),
      L(5, 1, 3), L(6, 1, 5), L(3, 5, 7), L(6, 2, 39), L(4, 5, 43), L(4, 6, 75), L(5, 7, 139), L(5, 8, 267),
      L(6, 8, 523), L(7, 9, 779), L(6, 11, 1291), L(9, 32, -32, "low"), L(9, 32, 3339, "high"),
      L(2, 0, 0, "oob")],
  10: [L(7, 4, -21), L(8, 0, -5), L(7, 0, -4), L(5, 0, -3), L(2, 2, -2), L(5, 0, 2), L(6, 0, 3), L(7, 0, 4),
       L(8, 0, 5), L(2, 6, 6), L(5, 5, 70), L(6, 5, 102), L(6, 6, 134), L(6, 7, 198), L(6, 8, 326),
       L(6, 9, 582), L(6, 10, 1094), L(7, 11, 2118), L(8, 32, -22, "low"), L(8, 32, 4166, "high"),
       L(2, 0, 0, "oob")],
  11: [L(1, 0, 1), L(2, 1, 2), L(4, 0, 4), L(4, 1, 5), L(5, 1, 7), L(5, 2, 9), L(6, 2, 13), L(7, 2, 17),
       L(7, 3, 21), L(7, 4, 29), L(7, 5, 45), L(7, 6, 77), L(7, 32, 141, "high")],
  12: [L(1, 0, 1), L(2, 0, 2), L(3, 1, 3), L(5, 0, 5), L(5, 1, 6), L(6, 1, 8), L(7, 0, 10), L(7, 1, 11),
       L(7, 2, 13), L(7, 3, 17), L(7, 4, 25), L(8, 5, 41), L(8, 32, 73, "high")],
  13: [L(1, 0, 1), L(3, 0, 2), L(4, 0, 3), L(5, 0, 4), L(4, 1, 5), L(3, 3, 7), L(6, 1, 15), L(6, 2, 17),
       L(6, 3, 21), L(6, 4, 29), L(6, 5, 45), L(7, 6, 77), L(7, 32, 141, "high")],
  14: [L(3, 0, -2), L(3, 0, -1), L(1, 0, 0), L(3, 0, 1), L(3, 0, 2)],
  15: [L(7, 4, -24), L(6, 2, -8), L(5, 1, -4), L(4, 0, -2), L(3, 0, -1), L(1, 0, 0), L(3, 0, 1), L(4, 0, 2),
       L(5, 1, 3), L(6, 2, 5), L(7, 4, 9), L(7, 32, -25, "low"), L(7, 32, 25, "high")],
};

/** Assign the prefix codes (B.3: FIRSTCODE[len] = (FIRSTCODE[len-1] +
 *  LENCOUNT[len-1]) * 2, lines of one length taking consecutive codes in the
 *  table's order) and index them by (length, code). */
function table(lines) {
  const maxLen = Math.max(0, ...lines.map((l) => l[0]));
  const count = new Array(maxLen + 1).fill(0);
  for (const l of lines) if (l[0]) count[l[0]]++;
  const byLen = new Map();
  let first = 0;
  for (let len = 1; len <= maxLen; len++) {
    first = (first + count[len - 1]) * 2;
    let code = first;
    for (const l of lines) if (l[0] === len) byLen.set(len * 0x100000000 + code++, l);
  }
  return { maxLen, byLen };
}
const STD = {};
const standardTable = (n) => (STD[n] ||= table(STANDARD_TABLES[n]));

/** An MSB-first bit reader over a segment's data, for the Huffman-coded paths. */
class Bits {
  constructor(d, p, end) { this.d = d; this.p = p; this.end = end; this.bit = 0; }
  read(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (this.p >= this.end) throw truncated(localize("image-codecs.jbig2decode.huffman_coded_data_ends_early", "Huffman-coded data ends early"));
      v = v * 2 + ((this.d[this.p] >> (7 - this.bit)) & 1);
      if (++this.bit === 8) { this.bit = 0; this.p++; }
    }
    return v;
  }
  align() { if (this.bit) { this.bit = 0; this.p++; } }
  /** Decode one value with table `t` (B.4). OOB is `null`. */
  huff(t) {
    let code = 0;
    for (let len = 1; len <= t.maxLen; len++) {
      code = code * 2 + this.read(1);
      const l = t.byLen.get(len * 0x100000000 + code);
      if (!l) continue;
      const [, rangeLen, low, kind] = l;
      if (kind === "oob") return OOB;
      const off = this.read(rangeLen);
      return kind === "low" ? low - off : low + off;
    }
    throw corrupt(localize("image-codecs.jbig2decode.a_huffman_code_no_table", "a Huffman code no table line holds"));
  }
}

/** A table segment (7.4.13) → a table. */
function parseTableSegment(data) {
  const r = new Reader(data);
  const flags = r.u8("table flags");
  const htoob = flags & 1, htps = ((flags >> 1) & 7) + 1, htrs = ((flags >> 4) & 7) + 1;
  const low = r.i32("HTLOW"), high = r.i32("HTHIGH");
  const b = new Bits(data, r.p, data.length);
  const lines = [];
  let cur = low;
  while (cur < high) {
    const p = b.read(htps), rl = b.read(htrs);
    lines.push(L(p, rl, cur));
    cur += 2 ** rl;
    if (lines.length > 1 << 16) throw corrupt(localize("image-codecs.jbig2decode.a_custom_huffman_table_with", "a custom Huffman table with no end"));
  }
  lines.push(L(b.read(htps), 32, low - 1, "low"));
  lines.push(L(b.read(htps), 32, high, "high"));
  if (htoob) lines.push(L(b.read(htps), 0, 0, "oob"));
  return table(lines);
}

/* ── generic region decoding (6.2) ────────────────────────────────────────── */

/* The nominal adaptive-template pixels, and the context TPGDON's SLTP bit is
 * decoded in, per template (6.2.5.3, 6.2.5.7). */
const TPGD_CONTEXT = [0x9b25, 0x0795, 0x00e5, 0x0195];

/**
 * Decode a generic region with the arithmetic coder. `at` is the adaptive
 * template's [x0,y0,x1,y1,...] (four pixels for template 0, one otherwise);
 * `skip`, when given, is a bitmap whose set pixels are not coded (read as 0).
 * `ctx` is the region's GB statistics, shared by the caller where the standard
 * shares them (a symbol dictionary's symbols).
 */
function decodeGenericArith(mq, ctx, w, h, template, tpgdon, at, skip = null) {
  const bm = bitmap(w, h);
  const D = bm.d;
  const nat = template === 0 ? 4 : 1;
  for (let i = 0; i < nat; i++) {
    const ax = at[2 * i], ay = at[2 * i + 1];
    if (ay > 0 || (ay === 0 && ax >= 0)) throw corrupt(localize("image-codecs.jbig2decode.adaptive_template_pixel_ax_ay", "adaptive template pixel ({ax},{ay}) is not yet decoded", { ax: String(ax), ay: String(ay) }));
  }
  const px = (x, y) => (x < 0 || x >= w || y < 0 ? 0 : D[y * w + x]);
  let ltp = 0;
  const sltp = TPGD_CONTEXT[template];
  const [a1x, a1y, a2x, a2y, a3x, a3y, a4x, a4y] = at;
  for (let y = 0; y < h; y++) {
    if (tpgdon) {
      ltp ^= mq.decode(ctx, sltp);
      if (ltp) {
        if (y > 0) D.copyWithin(y * w, (y - 1) * w, y * w);
        continue;
      }
    }
    const r0 = y * w, r1 = r0 - w, r2 = r1 - w;
    const has1 = y >= 1, has2 = y >= 2;
    const p1 = (x) => (has1 && x >= 0 && x < w ? D[r1 + x] : 0);
    const p2 = (x) => (has2 && x >= 0 && x < w ? D[r2 + x] : 0);
    /* Sliding windows over the fixed template pixels: `c0` the current row's
     * pixels left of x, `c1`/`c2` the two rows above. Each window holds its
     * RIGHTMOST pixel in bit 0, which is exactly the order of its field in the
     * context word (e.g. template 0's bits 5..9 are pixels x+2, x+1, x, x-1, x-2
     * of the row above), so a field is its window shifted into place. */
    let c0 = 0, c1, c2;
    if (template === 0) { c1 = (p1(-2) << 4) | (p1(-1) << 3) | (p1(0) << 2) | (p1(1) << 1) | p1(2); c2 = (p2(-1) << 2) | (p2(0) << 1) | p2(1); }
    else if (template === 1) { c1 = (p1(-2) << 4) | (p1(-1) << 3) | (p1(0) << 2) | (p1(1) << 1) | p1(2); c2 = (p2(-1) << 3) | (p2(0) << 2) | (p2(1) << 1) | p2(2); }
    else if (template === 2) { c1 = (p1(-2) << 3) | (p1(-1) << 2) | (p1(0) << 1) | p1(1); c2 = (p2(-1) << 2) | (p2(0) << 1) | p2(1); }
    else { c1 = (p1(-3) << 4) | (p1(-2) << 3) | (p1(-1) << 2) | (p1(0) << 1) | p1(1); c2 = 0; }
    for (let x = 0; x < w; x++) {
      let bit = 0;
      if (!(skip && skip.d[y * w + x])) {
        let cx;
        if (template === 0) {
          cx = c0 | (px(x + a1x, y + a1y) << 4) | (c1 << 5) | (px(x + a2x, y + a2y) << 10)
             | (px(x + a3x, y + a3y) << 11) | (c2 << 12) | (px(x + a4x, y + a4y) << 15);
        } else if (template === 1) {
          cx = (c0 & 0x7) | (px(x + a1x, y + a1y) << 3) | (c1 << 4) | (c2 << 9);
        } else if (template === 2) {
          cx = (c0 & 0x3) | (px(x + a1x, y + a1y) << 2) | (c1 << 3) | (c2 << 7);
        } else {
          cx = c0 | (px(x + a1x, y + a1y) << 4) | (c1 << 5);
        }
        bit = mq.decode(ctx, cx);
      }
      D[r0 + x] = bit;
      c0 = ((c0 << 1) | bit) & 0xf;
      if (template === 0) { c1 = ((c1 << 1) & 0x1f) | p1(x + 3); c2 = ((c2 << 1) & 0x7) | p2(x + 2); }
      else if (template === 1) { c1 = ((c1 << 1) & 0x1f) | p1(x + 3); c2 = ((c2 << 1) & 0xf) | p2(x + 3); }
      else if (template === 2) { c1 = ((c1 << 1) & 0xf) | p1(x + 2); c2 = ((c2 << 1) & 0x7) | p2(x + 2); }
      else { c1 = ((c1 << 1) & 0x1f) | p1(x + 2); }
    }
  }
  return bm;
}

/* ── MMR (6.2.6: T.6 two-dimensional coding, EOFB-terminated) ────────────── */

const MODES = [
  // [bits, code, mode, delta]
  [1, 0b1, "V", 0], [3, 0b011, "V", 1], [3, 0b010, "V", -1], [3, 0b001, "H", 0], [4, 0b0001, "P", 0],
  [6, 0b000011, "V", 2], [6, 0b000010, "V", -2], [7, 0b0000011, "V", 3], [7, 0b0000010, "V", -3],
];
/* T.4 terminating and make-up codes as [bits, code, run]. */
const WHITE = [
  [8, 0x35, 0], [6, 0x7, 1], [4, 0x7, 2], [4, 0x8, 3], [4, 0xb, 4], [4, 0xc, 5], [4, 0xe, 6], [4, 0xf, 7],
  [5, 0x13, 8], [5, 0x14, 9], [5, 0x7, 10], [5, 0x8, 11], [6, 0x8, 12], [6, 0x3, 13], [6, 0x34, 14],
  [6, 0x35, 15], [6, 0x2a, 16], [6, 0x2b, 17], [7, 0x27, 18], [7, 0xc, 19], [7, 0x8, 20], [7, 0x17, 21],
  [7, 0x3, 22], [7, 0x4, 23], [7, 0x28, 24], [7, 0x2b, 25], [7, 0x13, 26], [7, 0x24, 27], [7, 0x18, 28],
  [8, 0x2, 29], [8, 0x3, 30], [8, 0x1a, 31], [8, 0x1b, 32], [8, 0x12, 33], [8, 0x13, 34], [8, 0x14, 35],
  [8, 0x15, 36], [8, 0x16, 37], [8, 0x17, 38], [8, 0x28, 39], [8, 0x29, 40], [8, 0x2a, 41], [8, 0x2b, 42],
  [8, 0x2c, 43], [8, 0x2d, 44], [8, 0x4, 45], [8, 0x5, 46], [8, 0xa, 47], [8, 0xb, 48], [8, 0x52, 49],
  [8, 0x53, 50], [8, 0x54, 51], [8, 0x55, 52], [8, 0x24, 53], [8, 0x25, 54], [8, 0x58, 55], [8, 0x59, 56],
  [8, 0x5a, 57], [8, 0x5b, 58], [8, 0x4a, 59], [8, 0x4b, 60], [8, 0x32, 61], [8, 0x33, 62], [8, 0x34, 63],
  [5, 0x1b, 64], [5, 0x12, 128], [6, 0x17, 192], [7, 0x37, 256], [8, 0x36, 320], [8, 0x37, 384],
  [8, 0x64, 448], [8, 0x65, 512], [8, 0x68, 576], [8, 0x67, 640], [9, 0xcc, 704], [9, 0xcd, 768],
  [9, 0xd2, 832], [9, 0xd3, 896], [9, 0xd4, 960], [9, 0xd5, 1024], [9, 0xd6, 1088], [9, 0xd7, 1152],
  [9, 0xd8, 1216], [9, 0xd9, 1280], [9, 0xda, 1344], [9, 0xdb, 1408], [9, 0x98, 1472], [9, 0x99, 1536],
  [9, 0x9a, 1600], [6, 0x18, 1664], [9, 0x9b, 1728],
];
const BLACK = [
  [10, 0x37, 0], [3, 0x2, 1], [2, 0x3, 2], [2, 0x2, 3], [3, 0x3, 4], [4, 0x3, 5], [4, 0x2, 6], [5, 0x3, 7],
  [6, 0x5, 8], [6, 0x4, 9], [7, 0x4, 10], [7, 0x5, 11], [7, 0x7, 12], [8, 0x4, 13], [8, 0x7, 14],
  [9, 0x18, 15], [10, 0x17, 16], [10, 0x18, 17], [10, 0x8, 18], [11, 0x67, 19], [11, 0x68, 20],
  [11, 0x6c, 21], [11, 0x37, 22], [11, 0x28, 23], [11, 0x17, 24], [11, 0x18, 25], [12, 0xca, 26],
  [12, 0xcb, 27], [12, 0xcc, 28], [12, 0xcd, 29], [12, 0x68, 30], [12, 0x69, 31], [12, 0x6a, 32],
  [12, 0x6b, 33], [12, 0xd2, 34], [12, 0xd3, 35], [12, 0xd4, 36], [12, 0xd5, 37], [12, 0xd6, 38],
  [12, 0xd7, 39], [12, 0x6c, 40], [12, 0x6d, 41], [12, 0xda, 42], [12, 0xdb, 43], [12, 0x54, 44],
  [12, 0x55, 45], [12, 0x56, 46], [12, 0x57, 47], [12, 0x64, 48], [12, 0x65, 49], [12, 0x52, 50],
  [12, 0x53, 51], [12, 0x24, 52], [12, 0x37, 53], [12, 0x38, 54], [12, 0x27, 55], [12, 0x28, 56],
  [12, 0x58, 57], [12, 0x59, 58], [12, 0x2b, 59], [12, 0x2c, 60], [12, 0x5a, 61], [12, 0x66, 62],
  [12, 0x67, 63], [10, 0xf, 64], [12, 0xc8, 128], [12, 0xc9, 192], [12, 0x5b, 256], [12, 0x33, 320],
  [12, 0x34, 384], [12, 0x35, 448], [13, 0x6c, 512], [13, 0x6d, 576], [13, 0x4a, 640], [13, 0x4b, 704],
  [13, 0x4c, 768], [13, 0x4d, 832], [13, 0x72, 896], [13, 0x73, 960], [13, 0x74, 1024], [13, 0x75, 1088],
  [13, 0x76, 1152], [13, 0x77, 1216], [13, 0x52, 1280], [13, 0x53, 1344], [13, 0x54, 1408],
  [13, 0x55, 1472], [13, 0x5a, 1536], [13, 0x5b, 1600], [13, 0x64, 1664], [13, 0x65, 1728],
];
const EXT = [
  [11, 0x8, 1792], [11, 0xc, 1856], [11, 0xd, 1920], [12, 0x12, 1984], [12, 0x13, 2048], [12, 0x14, 2112],
  [12, 0x15, 2176], [12, 0x16, 2240], [12, 0x17, 2304], [12, 0x1c, 2368], [12, 0x1d, 2432], [12, 0x1e, 2496],
  [12, 0x1f, 2560],
];
/* 13-bit lookup: the code's bits, left-aligned, → (length << 16) | run + 1. */
function runLookup(codes) {
  const t = new Int32Array(1 << 13);
  for (const [n, code, run] of [...codes, ...EXT]) {
    const base = code << (13 - n);
    for (let i = 0; i < 1 << (13 - n); i++) t[base | i] = (n << 16) | (run + 1);
  }
  return t;
}
const WHITE_LUT = runLookup(WHITE), BLACK_LUT = runLookup(BLACK);

class MmrBits {
  constructor(d, p, end) { this.d = d; this.p0 = p; this.pos = p * 8; this.endBit = end * 8; }
  peek(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const b = this.pos + i;
      v = (v << 1) | (b < this.endBit ? (this.d[b >> 3] >> (7 - (b & 7))) & 1 : 0);
    }
    return v;
  }
  skip(n) { this.pos += n; }
  get left() { return this.endBit - this.pos; }
}

function mmrRun(br, lut) {
  let total = 0;
  for (;;) {
    const e = lut[br.peek(13)];
    if (!e || (e >> 16) > br.left) return -1;
    br.skip(e >> 16);
    const run = (e & 0xffff) - 1;
    total += run;
    if (run < 64) return total;
  }
}

/**
 * MMR-decode a w×h bitmap from `d[p, end)`. Returns `{bm, end}` where `end` is
 * the byte after the data the bitmap used (EOFB consumed when present).
 * A row the data does not finish, or an EOFB before the last row, is refused
 * TRUNCATED: jbig2dec pads the rest with white, and a page of invented white
 * reads downstream like a page with nothing on it.
 */
function decodeMmr(d, p, end, w, h) {
  const bm = bitmap(w, h);
  const br = new MmrBits(d, p, end);
  let ref = [w, w];
  for (let y = 0; y < h; y++) {
    if (br.peek(24) === 0x001001 && br.left >= 24) throw truncated(localize("image-codecs.jbig2decode.mmr_data_ends_eofb_after", "MMR data ends (EOFB) after {y} of {h} rows", { y: String(y), h: String(h) }));
    const cur = [];
    let a0 = -1, colour = 0;
    const b1 = () => {
      let i = 0;
      while (i < ref.length && ref[i] <= a0) i++;
      if (a0 < 0) i = 0;
      while (i < ref.length && (i & 1) !== colour) i++;
      return i < ref.length ? ref[i] : w;
    };
    const b1Index = () => {
      let i = 0;
      while (i < ref.length && (a0 >= 0 ? ref[i] <= a0 : false)) i++;
      while (i < ref.length && (i & 1) !== colour) i++;
      return i;
    };
    let guard = 0;
    while (a0 < w) {
      if (++guard > 4 * w + 16) throw corrupt("an MMR row that does not end");
      let hit = null;
      for (const m of MODES) if (br.left >= m[0] && br.peek(m[0]) === m[1]) { hit = m; break; }
      if (!hit) throw truncated(localize("image-codecs.jbig2decode.mmr_data_ends_or_breaks", "MMR data ends or breaks in row {y} of {h}", { y: String(y), h: String(h) }));
      br.skip(hit[0]);
      if (hit[2] === "H") {
        const start = a0 < 0 ? 0 : a0;
        const r1 = mmrRun(br, colour ? BLACK_LUT : WHITE_LUT);
        const r2 = r1 < 0 ? -1 : mmrRun(br, colour ? WHITE_LUT : BLACK_LUT);
        if (r1 < 0 || r2 < 0) throw truncated(localize("image-codecs.jbig2decode.mmr_data_ends_or_breaks_2", "MMR data ends or breaks in row {y} of {h}", { y: String(y), h: String(h) }));
        const m1 = Math.min(w, start + r1), m2 = Math.min(w, m1 + r2);
        cur.push(m1, m2);
        a0 = m2;
      } else if (hit[2] === "P") {
        const i = b1Index();
        a0 = i + 1 < ref.length ? ref[i + 1] : w;
      } else {
        const a1 = Math.max(0, Math.min(w, b1() + hit[3]));
        if (a1 < a0) throw corrupt(localize("image-codecs.jbig2decode.mmr_row_y_runs_backwards", "MMR row {y} runs backwards", { y: String(y) }));
        cur.push(a1);
        a0 = a1;
        colour ^= 1;
      }
    }
    const row = y * w;
    let pos = 0, c = 0;
    for (const t of cur) {
      if (c) bm.d.fill(1, row + pos, row + Math.min(t, w));
      pos = t; c ^= 1;
    }
    if (c && pos < w) bm.d.fill(1, row + pos, row + w);
    ref = cur.length ? [...cur, w, w] : [w, w];
  }
  if (br.left >= 24 && br.peek(24) === 0x001001) br.skip(24);
  return { bm, end: Math.min(end, Math.ceil(br.pos / 8)) };
}

/* ── generic refinement region decoding (6.3) ─────────────────────────────── */

function decodeRefinement(mq, ctx, w, h, template, ref, dx, dy, tpgron, at) {
  const bm = bitmap(w, h);
  const D = bm.d, R = ref.d, rw = ref.w, rh = ref.h;
  if (template === 0) {
    if (at[1] > 0 || (at[1] === 0 && at[0] >= 0)) throw corrupt(localize("image-codecs.jbig2decode.refinement_adaptive_pixel_is_not", "refinement adaptive pixel is not yet decoded"));
  }
  const g = (x, y) => (x < 0 || x >= w || y < 0 || y >= h ? 0 : D[y * w + x]);
  const r = (x, y) => (x < 0 || x >= rw || y < 0 || y >= rh ? 0 : R[y * rw + x]);
  const ctxOf = template === 0
    ? (x, y) => {
        const i = x - dx, j = y - dy;
        return g(x - 1, y) | (g(x + 1, y - 1) << 1) | (g(x, y - 1) << 2) | (g(x + at[0], y + at[1]) << 3)
          | (r(i + 1, j + 1) << 4) | (r(i, j + 1) << 5) | (r(i - 1, j + 1) << 6) | (r(i + 1, j) << 7)
          | (r(i, j) << 8) | (r(i - 1, j) << 9) | (r(i + 1, j - 1) << 10) | (r(i, j - 1) << 11)
          | (r(i + at[2], j + at[3]) << 12);
      }
    : (x, y) => {
        const i = x - dx, j = y - dy;
        return g(x - 1, y) | (g(x + 1, y - 1) << 1) | (g(x, y - 1) << 2) | (g(x - 1, y - 1) << 3)
          | (r(i + 1, j + 1) << 4) | (r(i, j + 1) << 5) | (r(i + 1, j) << 6) | (r(i, j) << 7)
          | (r(i - 1, j) << 8) | (r(i, j - 1) << 9);
      };
  /* TPGRON's SLTP context: 0x100 for template 0 as T.88 gives it; 0x40 for
   * template 1, which is jbig2dec's value (the reference this is checked
   * against) where T.88 would give 0x80. */
  const sltp = template === 0 ? 0x100 : 0x40;
  let ltp = 0;
  for (let y = 0; y < h; y++) {
    if (tpgron) ltp ^= mq.decode(ctx, sltp);
    for (let x = 0; x < w; x++) {
      if (ltp) {
        const i = x - dx, j = y - dy, m = r(i, j);
        if (r(i - 1, j - 1) === m && r(i, j - 1) === m && r(i + 1, j - 1) === m && r(i - 1, j) === m
            && r(i + 1, j) === m && r(i - 1, j + 1) === m && r(i, j + 1) === m && r(i + 1, j + 1) === m) {
          D[y * w + x] = m;
          continue;
        }
      }
      D[y * w + x] = mq.decode(ctx, ctxOf(x, y));
    }
  }
  return bm;
}

/* ── text region decoding (6.4) ───────────────────────────────────────────── */

const CORNER = { BOTTOMLEFT: 0, TOPLEFT: 1, BOTTOMRIGHT: 2, TOPRIGHT: 3 };

/**
 * `p` holds the region's parameters (Table 9 of T.88); `dec` is either
 * `{mq, ia:{DT,FS,DS,IT,ID,RI,RDW,RDH,RDX,RDY}, idLen, gr}` (arithmetic) or
 * `{bits, tables:{FS,DS,DT,...}, symCodes}` (Huffman).
 */
function decodeTextRegion(p, syms, dec) {
  const reg = bitmap(p.w, p.h, p.defPixel);
  const huff = !!dec.bits;
  const num = (name) => {
    if (huff) return dec.bits.huff(dec.tables[name]);
    return iaDecode(dec.mq, dec.ia[name]);
  };
  let stript = -intOrThrow(num("DT"), "the first strip's T") * p.strips;
  let firsts = 0, n = 0;
  while (n < p.numInstances) {
    stript += intOrThrow(num("DT"), "a strip's T") * p.strips;
    let first = true, curs = 0;
    for (;;) {
      if (first) {
        firsts += intOrThrow(num("FS"), "a strip's first S");
        curs = firsts;
        first = false;
      } else {
        const ids = num("DS");
        if (ids === OOB) break;
        curs += ids + p.dsOffset;
      }
      let curt = 0;
      if (p.strips !== 1) curt = huff ? dec.bits.read(p.logStrips) : intOrThrow(iaDecode(dec.mq, dec.ia.IT), "a symbol's T");
      const t = stript + curt;
      const id = huff ? intOrThrow(dec.bits.huff(dec.symCodes), "a symbol id") : iaidDecode(dec.mq, dec.ia.ID, dec.idLen);
      if (id < 0 || id >= syms.length || !syms[id]) throw corrupt(localize("image-codecs.jbig2decode.symbol_id_id_of_length", "symbol id {id} of {length}", { id: String(id), length: String(syms.length) }));
      let ib = syms[id];
      const ri = p.refine ? (huff ? dec.bits.read(1) : intOrThrow(iaDecode(dec.mq, dec.ia.RI), "a refinement flag")) : 0;
      if (ri) {
        const rdw = intOrThrow(iaDecode(dec.mq, dec.ia.RDW), "RDW"), rdh = intOrThrow(iaDecode(dec.mq, dec.ia.RDH), "RDH");
        const rdx = intOrThrow(iaDecode(dec.mq, dec.ia.RDX), "RDX"), rdy = intOrThrow(iaDecode(dec.mq, dec.ia.RDY), "RDY");
        if (ib.w + rdw < 0 || ib.h + rdh < 0) throw corrupt(localize("image-codecs.jbig2decode.a_refined_symbol_of_negative", "a refined symbol of negative size"));
        ib = decodeRefinement(dec.mq, dec.gr, ib.w + rdw, ib.h + rdh, p.rTemplate, ib,
          (rdw >> 1) + rdx, (rdh >> 1) + rdy, false, p.rAt);
      }
      if (!p.transposed && p.refCorner > 1) curs += ib.w - 1;
      else if (p.transposed && !(p.refCorner & 1)) curs += ib.h - 1;
      const s = curs;
      let x, y;
      const [u, v] = p.transposed ? [t, s] : [s, t];
      switch (p.refCorner) {
        case CORNER.TOPLEFT: x = u; y = v; break;
        case CORNER.TOPRIGHT: x = u - ib.w + 1; y = v; break;
        case CORNER.BOTTOMLEFT: x = u; y = v - ib.h + 1; break;
        default: x = u - ib.w + 1; y = v - ib.h + 1; break;
      }
      compose(reg, ib, x, y, p.combOp);
      if (!p.transposed && p.refCorner < 2) curs += ib.w - 1;
      else if (p.transposed && (p.refCorner & 1)) curs += ib.h - 1;
      n++;
      if (n > p.numInstances + 1e6) throw corrupt(localize("image-codecs.jbig2decode.a_text_region_with_no", "a text region with no end"));
    }
  }
  return reg;
}

/** The text region's symbol-id Huffman table, coded at the start of its data
 *  (7.4.3.1.7). */
function readSymbolIdTable(bits, numSyms) {
  const runLines = [];
  for (let i = 0; i < 35; i++) runLines.push(L(bits.read(4), 0, i));
  const runTable = table(runLines);
  const lens = [];
  while (lens.length < numSyms) {
    const code = bits.huff(runTable);
    if (code === OOB || code > 34) throw corrupt(localize("image-codecs.jbig2decode.a_symbol_id_length_code", "a symbol-id length code outside the run table"));
    if (code < 32) lens.push(code);
    else {
      const [rep, val] = code === 32 ? [3 + bits.read(2), lens.length ? lens[lens.length - 1] : -1]
        : code === 33 ? [3 + bits.read(3), 0] : [11 + bits.read(7), 0];
      if (val < 0) throw corrupt(localize("image-codecs.jbig2decode.a_repeated_symbol_id_length", "a repeated symbol-id length with nothing before it"));
      for (let i = 0; i < rep; i++) lens.push(val);
    }
  }
  if (lens.length > numSyms) throw corrupt(localize("image-codecs.jbig2decode.more_symbol_id_lengths_than", "more symbol-id lengths than symbols"));
  bits.align();
  return table(lens.map((len, i) => L(len, 0, i)));
}

/* ── the segments ─────────────────────────────────────────────────────────── */

function regionInfo(r) {
  const w = r.u32("region width"), h = r.u32("region height"), x = r.u32("region x"), y = r.u32("region y");
  const flags = r.u8("region flags");
  if (flags & 0x08) throw unsupported("colour extension");
  return { w, h, x, y, op: flags & 7 };
}

function readAt(r, n) {
  const at = [];
  for (let i = 0; i < n; i++) at.push(r.i8("an adaptive-template x"), r.i8("an adaptive-template y"));
  return at;
}

/** The segment headers of an embedded (PDF) stream, each with its data. */
function readSegments(d, into, limit = d.length) {
  const r = new Reader(d, 0, limit);
  while (r.p < limit) {
    const number = r.u32("a segment number");
    const flags = r.u8("segment flags");
    const type = flags & 63;
    const pageAssoc4 = flags & 64;
    let count = r.u8("the referred-to count") >> 5;
    if (count === 7) {
      r.p--;
      count = r.u32("a long referred-to count") & 0x1fffffff;
      const bytes = Math.ceil((count + 1) / 8);
      r.need(bytes, "retention flags");
      r.p += bytes;
    } else if (count > 4) throw corrupt(`referred-to count ${count}`);
    const refSize = number <= 256 ? 1 : number <= 65536 ? 2 : 4;
    const refs = [];
    for (let i = 0; i < count; i++) refs.push(refSize === 1 ? r.u8("a referred-to segment") : refSize === 2 ? r.u16("a referred-to segment") : r.u32("a referred-to segment"));
    const page = pageAssoc4 ? r.u32("a page association") : r.u8("a page association");
    let length = r.u32("a segment data length");
    const start = r.p;
    if (length === 0xffffffff) {
      if (type !== 38 && type !== 39) throw corrupt(localize("image-codecs.jbig2decode.segment_number_of_type_type", "segment {number} of type {type} has an unknown length", { number: String(number), type: String(type) }));
      length = unknownLengthGeneric(d, start, limit);
    }
    r.need(length, `segment ${number}'s data`);
    into.push({ number, type, refs, page, data: d.subarray(start, start + length) });
    r.p = start + length;
    if (type === 51) break;
  }
}

/** An immediate generic region of unknown length (7.2.7): its data ends with
 *  0xFFAC (arithmetic) or 0x0000 (MMR), then a 32-bit row count. */
function unknownLengthGeneric(d, start, limit) {
  if (start + 18 > limit) throw truncated("a generic region's header");
  const mmr = d[start + 17] & 1;
  const hdr = 18 + (mmr ? 0 : (((d[start + 17] >> 1) & 3) === 0 ? 8 : 2));
  for (let i = start + hdr; i + 6 <= limit; i++) {
    if (mmr ? d[i] === 0 && d[i + 1] === 0 : d[i] === 0xff && d[i + 1] === 0xac) return i + 6 - start;
  }
  throw truncated(localize("image-codecs.jbig2decode.a_generic_region_of_unknown", "a generic region of unknown length never ends"));
}

/**
 * Decode one embedded JBIG2 image: `data` the image stream, `globals` the
 * `/JBIG2Globals` stream's bytes or null. Returns
 * `{ width, height, packed, detail }` where `packed` holds 1-bit rows, MSB
 * first, SET BIT = BLACK (JBIG2's sense), and `detail` names what was decoded.
 */
export function decodeJbig2(data, globals = null) {
  const segs = [];
  if (globals) readSegments(globals, segs);
  const nGlobal = segs.length;
  readSegments(data, segs);

  const results = new Map();            // segment number → {kind, ...}
  const tables = new Map();
  let page = null, pageInfo = null;
  const used = new Set();

  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    try {
      page = decodeSegment(seg, page);
    } catch (e) {
      /* R25 (K43): a refusal names the segment it arose in, by type. */
      if (e instanceof Jbig2Refusal) e.detail = { segmentType: seg.type, segment: seg.number, ...e.detail };
      throw e;
    }
  }
  function decodeSegment(seg, page) {
    const r = new Reader(seg.data);
    const t = seg.type;
    switch (t) {
      case 48: {                                     // page information
        if (page) throw unsupported("several pages");
        const w = r.u32("page width"), h = r.u32("page height");
        r.u32("x resolution"); r.u32("y resolution");
        const flags = r.u8("page flags");
        const striping = r.u16("page striping");
        const unknownHeight = h === 0xffffffff;
        if (unknownHeight && !(striping & 0x8000)) throw corrupt(localize("image-codecs.jbig2decode.a_page_of_unknown_height", "a page of unknown height that is not striped"));
        pageInfo = { w, h: unknownHeight ? 0 : h, unknownHeight, defPixel: (flags >> 2) & 1, op: (flags >> 3) & 3,
                     maxStripe: striping & 0x7fff };
        page = bitmap(w, unknownHeight ? 0 : h, pageInfo.defPixel);
        used.add("page information");
        break;
      }
      case 49: case 51: case 52: break;              // end of page, end of file, profiles
      case 50: {                                     // end of stripe
        const endRow = r.u32("end of stripe row");
        if (pageInfo?.unknownHeight && endRow + 1 > page.h) page = grow(page, endRow + 1, pageInfo.defPixel);
        break;
      }
      case 53: {
        tables.set(seg.number, parseTableSegment(seg.data));
        used.add("custom Huffman table");
        break;
      }
      case 62: {                                     // extension
        const kind = r.u32("an extension type");
        if (kind & 0x80000000) throw unsupported("a necessary extension segment", { extension: kind >>> 0 });
        break;
      }
      case 0: {
        results.set(seg.number, { kind: "symbols", ...decodeSymbolDict(seg, r, results, tables, used) });
        break;
      }
      case 4: case 6: case 7:
      case 20: case 22: case 23:
      case 36: case 38: case 39:
      case 40: case 42: case 43: {
        if (!page) throw unsupported("no page");
        const info = regionInfo(r);
        let reg;
        if (t <= 7) reg = decodeTextSegment(seg, r, info, results, tables, used);
        else if (t <= 23) reg = decodeHalftoneSegment(seg, r, info, results, used);
        else if (t <= 39) reg = decodeGenericSegment(seg, r, info, used);
        else reg = decodeRefinementSegment(seg, r, info, results, page, used);
        if (t === 4 || t === 20 || t === 36 || t === 40) {
          results.set(seg.number, { kind: "region", bm: reg, info });
        } else {
          if (pageInfo.unknownHeight && info.y + info.h > page.h) page = grow(page, info.y + info.h, pageInfo.defPixel);
          compose(page, reg, info.x, info.y, info.op);
        }
        break;
      }
      case 16: {
        results.set(seg.number, { kind: "patterns", patterns: decodePatternDict(seg, r, used) });
        break;
      }
      default:
        throw unsupported("segment type");
    }
    return page;
  }
  if (!page) throw unsupported("no page");
  const rowBytes = Math.ceil(page.w / 8);
  const packed = new Uint8Array(rowBytes * page.h);
  for (let y = 0; y < page.h; y++) {
    const row = y * page.w, o = y * rowBytes;
    for (let x = 0; x < page.w; x++) if (page.d[row + x]) packed[o + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return { width: page.w, height: page.h, packed, detail: { segments: segs.length, global_segments: nGlobal,
    decoded: [...used].sort() } };
}

function grow(bm, h, fill) {
  const nb = bitmap(bm.w, h, fill);
  nb.d.set(bm.d.subarray(0, Math.min(bm.d.length, nb.d.length)));
  return nb;
}

/** Symbols from every symbol dictionary a segment refers to, in order. */
function referredSymbols(seg, results) {
  const out = [];
  for (const n of seg.refs) {
    const s = results.get(n);
    if (s && s.kind === "symbols") out.push(...s.exported);
  }
  return out;
}
function referredTables(seg, tables) {
  return seg.refs.filter((n) => tables.has(n)).map((n) => tables.get(n));
}

function decodeGenericSegment(seg, r, info, used) {
  const flags = r.u8("generic region flags");
  const mmr = flags & 1, template = (flags >> 1) & 3, tpgdon = (flags >> 3) & 1;
  if (flags & 0x10) throw unsupported("12 adaptive-template pixels");
  if (mmr) {
    used.add("generic region, MMR");
    const { bm } = decodeMmr(seg.data, r.p, seg.data.length, info.w, info.h);
    return bm;
  }
  const at = readAt(r, template === 0 ? 4 : 1);
  used.add(localize("image-codecs.jbig2decode.generic_region_arithmetic_template_template", "generic region, arithmetic, template {template}{v1}", { template: String(template), v1: String(tpgdon ? ", TPGDON" : "") }));
  let end = seg.data.length;
  /* An unknown-length region carries its row count after the data. */
  /* the data running out stops the decode where it runs out (R5), not after every row has been invented */
  const mq = new MqDecoder(seg.data, r.p, end, { onShort: (m) => { throw truncated(localize("image-codecs.jbig2decode.the_generic_regions_arithmetic_data", "the generic region's arithmetic data ran out ({overrun} bytes short)", { overrun: String(m.overrun) })); } });
  const bm = decodeGenericArith(mq, mqContexts(1 << 16), info.w, info.h, template, tpgdon, at);
  return bm;
}

function decodeRefinementSegment(seg, r, info, results, page, used) {
  const flags = r.u8("refinement region flags");
  const template = flags & 1, tpgron = (flags >> 1) & 1;
  const at = template === 0 ? readAt(r, 2) : [0, 0, 0, 0];
  let ref;
  const inter = seg.refs.map((n) => results.get(n)).find((s) => s && s.kind === "region");
  if (inter) { ref = inter.bm; }
  else {
    /* No intermediate region referred to: the reference is the page's region
     * under this one (7.4.7.4) — a bitmap of the region's own size, so a pixel
     * beyond its edge reads 0, never the page next to it. jbig2dec (0.20, its own
     * TODO) takes the whole page from (0, 0) instead; the two agree only for a
     * region at the page's origin. */
    ref = bitmap(info.w, info.h);
    compose(ref, page, -info.x, -info.y, 4);
  }
  used.add(localize("image-codecs.jbig2decode.generic_refinement_region_template_template", "generic refinement region, template {template}{v1}", { template: String(template), v1: String(tpgron ? ", TPGRON" : "") }));
  const mq = new MqDecoder(seg.data, r.p, seg.data.length, { onShort: (m) => { throw truncated(localize("image-codecs.jbig2decode.the_refinement_regions_arithmetic_data", "the refinement region's arithmetic data ran out ({overrun} bytes short)", { overrun: String(m.overrun) })); } });
  const bm = decodeRefinement(mq, mqContexts(1 << 13), info.w, info.h, template, ref, 0, 0, tpgron, at);
  return bm;
}

function decodeSymbolDict(seg, r, results, tables, used) {
  const flags = r.u16("symbol dictionary flags");
  const huff = flags & 1, refagg = (flags >> 1) & 1;
  const selDH = (flags >> 2) & 3, selDW = (flags >> 4) & 3, selBM = (flags >> 6) & 1, selAI = (flags >> 7) & 1;
  const ctxUsed = (flags >> 8) & 1;
  const template = (flags >> 10) & 3, rTemplate = (flags >> 12) & 1;
  if (ctxUsed) throw unsupported("reused bitmap coding contexts");
  if (huff && refagg) throw unsupported("Huffman-coded refinement");
  const at = huff ? [] : readAt(r, template === 0 ? 4 : 1);
  const rAt = refagg && rTemplate === 0 ? readAt(r, 2) : [0, 0, 0, 0];
  const numEx = r.u32("SDNUMEXSYMS"), numNew = r.u32("SDNUMNEWSYMS");
  const inSyms = referredSymbols(seg, results);
  const custom = referredTables(seg, tables);
  let ci = 0;
  const pick = (sel, std) => {
    if (sel === 3 || (std.length === 1 && sel === 1)) {
      if (ci >= custom.length) throw corrupt(localize("image-codecs.jbig2decode.a_custom_huffman_table_the", "a custom Huffman table the segment does not refer to"));
      return custom[ci++];
    }
    if (sel >= std.length) throw corrupt(localize("image-codecs.jbig2decode.huffman_table_selection_sel", "Huffman table selection {sel}", { sel: String(sel) }));
    return standardTable(std[sel]);
  };
  let tDH, tDW, tBM;
  if (huff) {
    tDH = pick(selDH, [4, 5]); tDW = pick(selDW, [2, 3]); tBM = pick(selBM, [1]);
    pick(selAI, [1]);   // AGGINST: unused with refinement refused, but it takes its custom table in turn
  }
  used.add(`symbol dictionary, ${huff ? "Huffman" : "arithmetic"}${refagg ? ", refinement/aggregate" : ""}`);
  const total = inSyms.length + numNew;
  if (total > OBJECTS_MAX) throw tooManyObjects(total, localize("image-codecs.jbig2decode.the_symbol_dictionary_declares_n", "the symbol dictionary declares {n} symbols, past the {bound} the decoder holds", { n: String(total), bound: String(OBJECTS_MAX) }));
  let idLen = 0;
  while (2 ** idLen < total) idLen++;
  const newSyms = [];
  const d = seg.data;
  let mq = null, bits = null;
  const gb = mqContexts(1 << 16), gr = mqContexts(1 << 13);
  const ia = { DH: iaCtx(), DW: iaCtx(), EX: iaCtx(), AI: iaCtx(), DT: iaCtx(), FS: iaCtx(), DS: iaCtx(), IT: iaCtx(),
               RI: iaCtx(), RDW: iaCtx(), RDH: iaCtx(), RDX: iaCtx(), RDY: iaCtx(), ID: mqContexts(1 << (idLen + 1)) };
  if (huff) bits = new Bits(d, r.p, d.length);
  else mq = new MqDecoder(d, r.p, d.length, { onShort: (m) => { throw truncated(localize("image-codecs.jbig2decode.the_symbol_dictionarys_arithmetic_data", "the symbol dictionary's arithmetic data ran out ({overrun} bytes short)", { overrun: String(m.overrun) })); } });
  const num = (name, tbl) => (huff ? bits.huff(tbl) : iaDecode(mq, ia[name]));
  let hcHeight = 0;
  while (newSyms.length < numNew) {
    hcHeight += intOrThrow(num("DH", tDH), "a height-class delta");
    if (hcHeight < 0) throw corrupt("a negative height class");
    let symWidth = 0, totWidth = 0;
    const widths = [];
    for (;;) {
      const dw = num("DW", tDW);
      if (dw === OOB) break;
      if (newSyms.length + widths.length >= numNew && !huff) throw corrupt("more symbols than SDNUMNEWSYMS");
      symWidth += dw;
      if (symWidth < 0) throw corrupt("a negative symbol width");
      totWidth += symWidth;
      if (huff) { widths.push(symWidth); continue; }
      if (!refagg) {
        newSyms.push(decodeGenericArith(mq, gb, symWidth, hcHeight, template, 0, at));
        continue;
      }
      const nInst = intOrThrow(iaDecode(mq, ia.AI), "REFAGGNINST");
      if (nInst <= 0) throw corrupt(localize("image-codecs.jbig2decode.a_refinement_aggregate_symbol_of", "a refinement/aggregate symbol of no instances"));
      const syms = [...inSyms, ...newSyms];
      if (nInst > 1) {
        newSyms.push(decodeTextRegion({ w: symWidth, h: hcHeight, numInstances: nInst, strips: 1, logStrips: 0,
          refine: 1, defPixel: 0, combOp: 0, transposed: 0, refCorner: CORNER.TOPLEFT, dsOffset: 0,
          rTemplate, rAt }, syms, { mq, ia, idLen, gr }));
      } else {
        const id = iaidDecode(mq, ia.ID, idLen);
        const rdx = intOrThrow(iaDecode(mq, ia.RDX), "RDX"), rdy = intOrThrow(iaDecode(mq, ia.RDY), "RDY");
        if (id >= syms.length) throw corrupt(localize("image-codecs.jbig2decode.refinement_of_symbol_id_of", "refinement of symbol {id} of {length}", { id: String(id), length: String(syms.length) }));
        newSyms.push(decodeRefinement(mq, gr, symWidth, hcHeight, rTemplate, syms[id], rdx, rdy, false, rAt));
      }
    }
    if (huff) {
      /* The height class's collective bitmap (6.5.9). */
      const bmSize = intOrThrow(bits.huff(tBM), "BMSIZE");
      bits.align();
      let coll;
      if (bmSize === 0) {
        const stride = Math.ceil(totWidth / 8);
        if (bits.p + stride * hcHeight > d.length) throw truncated("an uncompressed collective bitmap");
        coll = bitmap(totWidth, hcHeight);
        for (let y = 0; y < hcHeight; y++) for (let x = 0; x < totWidth; x++)
          coll.d[y * totWidth + x] = (d[bits.p + y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
        bits.p += stride * hcHeight;
      } else {
        if (bits.p + bmSize > d.length) throw truncated("an MMR collective bitmap");
        coll = decodeMmr(d, bits.p, bits.p + bmSize, totWidth, hcHeight).bm;
        bits.p += bmSize;
      }
      let x = 0;
      for (const w of widths) {
        const s = bitmap(w, hcHeight);
        for (let y = 0; y < hcHeight; y++) s.d.set(coll.d.subarray(y * totWidth + x, y * totWidth + x + w), y * w);
        newSyms.push(s);
        x += w;
      }
    }
  }
  /* The export flags (6.5.10). */
  const all = [...inSyms, ...newSyms];
  const exported = [];
  let exFlag = 0, i = 0;
  while (i < all.length) {
    const run = intOrThrow(huff ? bits.huff(standardTable(1)) : iaDecode(mq, ia.EX), "an export run");
    if (run < 0 || i + run > all.length) throw corrupt(localize("image-codecs.jbig2decode.an_export_run_past_the", "an export run past the symbols"));
    if (exFlag) exported.push(...all.slice(i, i + run));
    i += run;
    exFlag ^= 1;
  }
  if (exported.length !== numEx) throw corrupt(localize("image-codecs.jbig2decode.length_symbols_exported_where_sdnumexsyms", "{length} symbols exported where SDNUMEXSYMS is {numEx}", { length: String(exported.length), numEx: String(numEx) }));
  return { exported };
}

function decodeTextSegment(seg, r, info, results, tables, used) {
  const flags = r.u16("text region flags");
  const huff = flags & 1, refine = (flags >> 1) & 1, logStrips = (flags >> 2) & 3, refCorner = (flags >> 4) & 3;
  const transposed = (flags >> 6) & 1, combOp = (flags >> 7) & 3, defPixel = (flags >> 9) & 1;
  let dsOffset = (flags >> 10) & 31;
  if (dsOffset > 15) dsOffset -= 32;
  const rTemplate = (flags >> 15) & 1;
  if (huff && refine) throw unsupported("Huffman-coded refinement");
  let hflags = 0;
  if (huff) hflags = r.u16("text region Huffman flags");
  const rAt = refine && rTemplate === 0 ? readAt(r, 2) : [0, 0, 0, 0];
  const numInstances = r.u32("SBNUMINSTANCES");
  const syms = referredSymbols(seg, results);
  used.add(`text region, ${huff ? "Huffman" : "arithmetic"}${refine ? ", refinement" : ""}`);
  const p = { w: info.w, h: info.h, numInstances, strips: 1 << logStrips, logStrips, refine, defPixel, combOp,
              transposed, refCorner, dsOffset, rTemplate, rAt };
  const d = seg.data;
  if (huff) {
    const custom = referredTables(seg, tables);
    let ci = 0;
    const pick = (sel, std) => {
      if (sel === 3) { if (ci >= custom.length) throw corrupt(localize("image-codecs.jbig2decode.a_custom_huffman_table_the", "a custom Huffman table the segment does not refer to")); return custom[ci++]; }
      if (sel >= std.length) throw corrupt(localize("image-codecs.jbig2decode.huffman_table_selection_sel_2", "Huffman table selection {sel}", { sel: String(sel) }));
      return standardTable(std[sel]);
    };
    const tbl = {
      FS: pick(hflags & 3, [6, 7]), DS: pick((hflags >> 2) & 3, [8, 9, 10]), DT: pick((hflags >> 4) & 3, [11, 12, 13]),
    };
    /* The refinement tables (RDW..RSIZE) are selected by the same flags; with
     * refinement refused above they are read here only to consume their custom
     * tables in order, as 7.4.3.1.6 lays them out. */
    for (const [sh, std] of [[6, [14, 15]], [8, [14, 15]], [10, [14, 15]], [12, [14, 15]]]) if (((hflags >> sh) & 3) === 3) pick(3, std);
    if ((hflags >> 14) & 1) pick(3, [1]);
    const bits = new Bits(d, r.p, d.length);
    const symCodes = readSymbolIdTable(bits, syms.length);
    return decodeTextRegion(p, syms, { bits, tables: tbl, symCodes });
  }
  let idLen = 0;
  while (2 ** idLen < syms.length) idLen++;
  const mq = new MqDecoder(d, r.p, d.length, { onShort: (m) => { throw truncated(localize("image-codecs.jbig2decode.the_text_regions_arithmetic_data", "the text region's arithmetic data ran out ({overrun} bytes short)", { overrun: String(m.overrun) })); } });
  const ia = { DT: iaCtx(), FS: iaCtx(), DS: iaCtx(), IT: iaCtx(), RI: iaCtx(), RDW: iaCtx(), RDH: iaCtx(),
               RDX: iaCtx(), RDY: iaCtx(), ID: mqContexts(1 << (idLen + 1)) };
  const reg = decodeTextRegion(p, syms, { mq, ia, idLen, gr: mqContexts(1 << 13) });
  return reg;
}

function decodePatternDict(seg, r, used) {
  const flags = r.u8("pattern dictionary flags");
  const mmr = flags & 1, template = (flags >> 1) & 3;
  const pw = r.u8("HDPW"), ph = r.u8("HDPH"), grayMax = r.u32("GRAYMAX");
  if (!pw || !ph) throw corrupt(localize("image-codecs.jbig2decode.a_pattern_of_no_size", "a pattern of no size"));
  if (grayMax + 1 > OBJECTS_MAX) throw tooManyObjects(grayMax + 1, localize("image-codecs.jbig2decode.the_pattern_dictionary_declares_n", "the pattern dictionary declares {n} patterns, past the {bound} the decoder holds", { n: String(grayMax + 1), bound: String(OBJECTS_MAX) }));
  const w = (grayMax + 1) * pw;
  used.add(`pattern dictionary, ${mmr ? "MMR" : `arithmetic, template ${template}`}`);
  let coll;
  if (mmr) coll = decodeMmr(seg.data, r.p, seg.data.length, w, ph).bm;
  else {
    const at = template === 0 ? [-pw, 0, -3, -1, 2, -2, -2, -2] : [-pw, 0];
    const mq = new MqDecoder(seg.data, r.p, seg.data.length, { onShort: () => { throw truncated(localize("image-codecs.jbig2decode.the_pattern_dictionary_s_arithmetic", "the pattern dictionary's arithmetic data ran out")); } });
    coll = decodeGenericArith(mq, mqContexts(1 << 16), w, ph, template, 0, at);
  }
  const pats = [];
  for (let g = 0; g <= grayMax; g++) {
    const p = bitmap(pw, ph);
    for (let y = 0; y < ph; y++) p.d.set(coll.d.subarray(y * w + g * pw, y * w + g * pw + pw), y * pw);
    pats.push(p);
  }
  return pats;
}

function decodeHalftoneSegment(seg, r, info, results, used) {
  const flags = r.u8("halftone region flags");
  const mmr = flags & 1, template = (flags >> 1) & 3, enableSkip = (flags >> 3) & 1;
  const combOp = (flags >> 4) & 7, defPixel = (flags >> 7) & 1;
  const gw = r.u32("HGW"), gh = r.u32("HGH"), gx = r.i32("HGX"), gy = r.i32("HGY");
  const rx = r.u16("HRX"), ry = r.u16("HRY");
  const dict = seg.refs.map((n) => results.get(n)).find((s) => s && s.kind === "patterns");
  if (!dict) throw corrupt(localize("image-codecs.jbig2decode.a_halftone_region_with_no", "a halftone region with no pattern dictionary"));
  const pats = dict.patterns;
  const pw = pats[0].w, ph = pats[0].h;
  used.add(`halftone region, ${mmr ? "MMR" : `arithmetic, template ${template}`}`);
  const reg = bitmap(info.w, info.h, defPixel);
  const place = (m, n) => [Math.floor((gx + m * ry + n * rx) / 256), Math.floor((gy + m * rx - n * ry) / 256)];
  let skip = null;
  if (enableSkip) {
    skip = bitmap(gw, gh);
    for (let m = 0; m < gh; m++) for (let n = 0; n < gw; n++) {
      const [x, y] = place(m, n);
      if (x + pw <= 0 || x >= info.w || y + ph <= 0 || y >= info.h) skip.d[m * gw + n] = 1;
    }
  }
  let bpp = 0;
  while (2 ** bpp < pats.length) bpp++;
  /* The grey-scale image, bitplane by bitplane, most significant first (C.5). */
  const planes = new Array(bpp);
  const at = [template <= 1 ? 3 : 2, -1, -3, -1, 2, -2, -2, -2];
  const d = seg.data;
  let mq = null, gb = null, p = r.p;
  if (!mmr) { mq = new MqDecoder(d, p, d.length, { onShort: () => { throw truncated(localize("image-codecs.jbig2decode.the_halftone_region_s_arithmetic", "the halftone region's arithmetic data ran out")); } }); gb = mqContexts(1 << 16); }
  for (let j = bpp - 1; j >= 0; j--) {
    if (mmr) { const o = decodeMmr(d, p, d.length, gw, gh); planes[j] = o.bm; p = o.end; }
    else planes[j] = decodeGenericArith(mq, gb, gw, gh, template, 0, at, skip);
    if (j < bpp - 1) for (let i = 0; i < planes[j].d.length; i++) planes[j].d[i] ^= planes[j + 1].d[i];
  }
  for (let m = 0; m < gh; m++) for (let n = 0; n < gw; n++) {
    let g = 0;
    for (let j = bpp - 1; j >= 0; j--) g = (g << 1) | planes[j].d[m * gw + n];
    if (g >= pats.length) g = pats.length - 1;
    const [x, y] = place(m, n);
    compose(reg, pats[g], x, y, combOp);
  }
  return reg;
}
