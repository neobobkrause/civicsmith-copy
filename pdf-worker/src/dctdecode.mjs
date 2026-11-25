/* dctdecode.mjs — D-320: a BASELINE JPEG decoder for the image-only page whose
 * one image is a `DCTDecode` stream, so the OCR member can read it in-isolate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT EXISTS, AND WHY IT DOES NOT REPLACE THE PASS-THROUGH ROUTE
 * ─────────────────────────────────────────────────────────────────────────────
 * CPDF-12's `passthrough-dct` route hands on the publisher's own JPEG bytes, the
 * strongest provenance position there is — and nothing in workerd can read
 * them (no canvas, no `createImageBitmap`), so `ocr-worker` refused every such
 * page `PIXELS_UNREADABLE`: 17 of the 24 image-only pages CPDF-12 censused. The
 * pass-through route is KEPT as `renderPageToPixels`'s default; this decoder is
 * reached only when a caller asks for decoded pixels (`decodeDct`), and the
 * route it produces is named `decoded-dct` so the chain says a transform of ours
 * now sits between the record and the pixels.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "CORRECT" MEANS HERE: THE SAME SAMPLES AS libjpeg, TO THE BIT
 * ─────────────────────────────────────────────────────────────────────────────
 * JPEG decoding is not bit-defined by the standard: the IDCT, the chroma
 * upsampling and the colour conversion each admit several conforming answers.
 * A decoder that is merely "conforming" produces a picture no independent
 * decoder reproduces, and then `pixels_sha256` is a hash nobody can check. So
 * every arithmetic step below is libjpeg's own, integer for integer:
 *   - the IDCT is `jidctint.c`'s ISLOW (CONST_BITS 13, PASS1_BITS 2) with the
 *     post-IDCT range-limit table's wrap (`& RANGE_MASK`), libjpeg's default
 *     `dct_method`;
 *   - chroma is upsampled by `jdsample.c`'s FANCY (triangle) filters for the
 *     h2v1, h1v2 and h2v2 cases, with edge rows and columns REPLICATED as
 *     `jdmainct.c`'s context pointers replicate them; `do_fancy_upsampling` is
 *     libjpeg's default;
 *   - YCbCr -> RGB is `jdcolor.c`'s fixed-point tables (SCALEBITS 16);
 *   - the colour transform is decided as `jdapimin.c` decides it (JFIF -> YCC;
 *     Adobe APP14 -> its transform flag; else component ids 1,2,3 -> YCC,
 *     'R','G','B' -> none).
 * The suite checks the result against Pillow's decode of the same bytes (Pillow
 * reaches libjpeg-turbo, whose SIMD paths are bit-exact with this C). A digest
 * this file produced would prove only that it agrees with itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT REFUSES, BY NAME — never a picture it guessed at
 * ─────────────────────────────────────────────────────────────────────────────
 * PROGRESSIVE (SOF2/SOF6/SOF10/SOF14), ARITHMETIC-CODED (SOF9..SOF15), LOSSLESS
 * (SOF3/SOF7/SOF11), HIERARCHICAL (DHP/SOF5-7), 12- or 16-bit precision, four
 * components (CMYK/YCCK), a sampling ratio other than 1x1/2x1/1x2/2x2, a
 * Huffman table libjpeg calls bogus (`bogusHuffman`, below), and a stream that
 * ends short of its declared height. A progressive JPEG parsed as
 * baseline decodes to a plausible smear, which an OCR engine turns into fluent
 * invented text — the hazard `textchain.mjs` exists for — so it is refused on
 * its SOF marker before a single coefficient is read.
 *
 * Every error thrown here is a `DctRefusal` carrying a CODE; `pagepixels.mjs`
 * turns each into one of its declared refusals.
 */

import { localize } from "../../bio-plane/src/setup-words/index.mjs"
import { READ_BOUNDS, boundOf, statement } from "../../bio-plane/src/read-bounds.mjs"

/* THE DECLARED FRAME (R12, fix round 9, G125a): a frame's width and height are judged against the table once its
 * header is read, before a plane, a strip or the output is allocated. A JPEG's own fields are 16 bits wide, so its
 * edge never passes the table's; the pixels bound is what a hostile frame meets. */
const PIXELS_MAX = boundOf("image", "pixels");
/* The row-by-row decoder (R11) holds no full-size plane, so BOB ruled it keeps today's ceiling in a row of its own, `image.rows_pixels`
 * (K4862). Until runtime-limits has added it the row of the whole-frame decode is read; the guard needs no edit when the row lands. */
const ROWS_ROW = Object.hasOwn(READ_BOUNDS.image, "rows_pixels") ? "rows_pixels" : "pixels";
const ROWS_PIXELS_MAX = boundOf("image", ROWS_ROW);

export class DctRefusal extends Error {
  constructor(code, detail = {}) {
    super(`${code}${detail.note ? `: ${detail.note}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}

/* The SOF markers, each named, so a refusal says WHICH process the file uses. */
const SOF_PROCESS = {
  0xc0: "baseline", 0xc1: "extended-sequential-huffman",
  0xc2: "progressive-huffman", 0xc3: "lossless-huffman",
  0xc5: "differential-sequential-huffman", 0xc6: "differential-progressive-huffman",
  0xc7: "differential-lossless-huffman",
  0xc9: "extended-sequential-arithmetic", 0xca: "progressive-arithmetic",
  0xcb: "lossless-arithmetic", 0xcd: "differential-sequential-arithmetic",
  0xce: "differential-progressive-arithmetic", 0xcf: "differential-lossless-arithmetic",
};
/* Decoded here: sequential DCT, Huffman-coded, 8-bit. SOF1 at 8-bit precision
 * is the same bitstream as SOF0 with larger table limits, and libjpeg decodes
 * both through one path; everything else is refused by its process name. */
const DECODED_SOF = new Set([0xc0, 0xc1]);

const ZIGZAG = Int32Array.from([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48,
  41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22,
  15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55,
  62, 63,
]);

/** Read the markers up to the first SOS. Returns the frame, tables and the
 *  colour-transform evidence; throws `DctRefusal` on anything not decoded. */
export function readJpegHeader(d) {
  if (!(d instanceof Uint8Array) || d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8)
    throw new DctRefusal("NOT_A_JPEG", { note: "no SOI" });
  const qt = [];
  const hts = { dc: [], ac: [] };
  /* Tables libjpeg would call bogus, by "dc i"/"ac i": refused only if the scan
   * uses one, as libjpeg derives (and checks) only the tables a scan uses. */
  const bogus = new Map();
  let frame = null, jfif = false, adobe = null, restart = 0;
  let p = 2;
  for (;;) {
    while (p < d.length && d[p] !== 0xff) p++;            // tolerate fill junk
    while (p < d.length && d[p] === 0xff) p++;
    if (p >= d.length) throw new DctRefusal("TRUNCATED", { note: "no SOS before the end of the stream" });
    const m = d[p++];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) continue;
    if (m === 0xd9) throw new DctRefusal("TRUNCATED", { note: "EOI before SOS" });
    if (p + 2 > d.length) throw new DctRefusal("TRUNCATED", { note: "marker length past end" });
    const len = (d[p] << 8) | d[p + 1];
    const seg = d.subarray(p + 2, p + len);
    if (p + len > d.length) throw new DctRefusal("TRUNCATED", { note: localize("image-codecs.dctdecode.marker_0x_m_runs_past", "marker 0x{m} runs past end", { m: String(m.toString(16)) }) });
    if (m in SOF_PROCESS) {
      if (!DECODED_SOF.has(m))
        throw new DctRefusal("UNSUPPORTED_PROCESS", { process: SOF_PROCESS[m], marker: `0x${m.toString(16)}` });
      const precision = seg[0];
      if (precision !== 8)
        throw new DctRefusal("UNSUPPORTED_PRECISION", { precision });
      const height = (seg[1] << 8) | seg[2], width = (seg[3] << 8) | seg[4], n = seg[5];
      if (!width || !height) throw new DctRefusal("UNSUPPORTED_FRAME", { note: "zero dimension (DNL) is not read", width, height });
      const comps = [];
      for (let i = 0; i < n; i++) {
        const b = 6 + i * 3;
        comps.push({ id: seg[b], h: seg[b + 1] >> 4, v: seg[b + 1] & 15, tq: seg[b + 2] });
      }
      frame = { process: SOF_PROCESS[m], precision, width, height, comps };
    } else if (m === 0xdb) {                               // DQT
      let q = 0;
      while (q < seg.length) {
        const pq = seg[q] >> 4, tq = seg[q] & 15;
        const t = new Int32Array(64);
        for (let i = 0; i < 64; i++) {
          t[ZIGZAG[i]] = pq ? (seg[q + 1 + 2 * i] << 8) | seg[q + 2 + 2 * i] : seg[q + 1 + i];
        }
        qt[tq] = t;
        q += 1 + (pq ? 128 : 64);
      }
    } else if (m === 0xc4) {                               // DHT
      /* `jdmarker.c`'s get_dht refuses a class or id past the four tables, and a
       * table whose counts pass 256 or run past the segment, at once. */
      let q = 0;
      while (q < seg.length) {
        const tc = seg[q] >> 4, th = seg[q] & 15, table = `${tc === 0 ? "dc" : "ac"} ${th}`;
        if (tc > 1 || th > 3) throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.huffman_table_class_or_id", "Huffman table class or id past the four tables"), class: tc, id: th });
        if (q + 17 > seg.length) throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.huffman_table_counts_run_past", "Huffman table counts run past their DHT"), table });
        const counts = seg.subarray(q + 1, q + 17);
        let total = 0;
        for (let i = 0; i < 16; i++) total += counts[i];
        if (total > 256 || q + 17 + total > seg.length)
          throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.huffman_table_of_total_symbols", "Huffman table of {total} symbols {v1}", { total: String(total), v1: String(total > 256 ? "past 256" : "runs past its DHT") }), table });
        const symbols = seg.subarray(q + 17, q + 17 + total);
        const why = bogusHuffman(counts, symbols, tc === 0);
        const list = tc === 0 ? hts.dc : hts.ac;
        if (why) { delete list[th]; bogus.set(table, why); }
        else { list[th] = buildHuffman(counts, symbols); bogus.delete(table); }
        q += 17 + total;
      }
    } else if (m === 0xcc) {
      throw new DctRefusal("UNSUPPORTED_PROCESS", { process: "arithmetic-conditioning (DAC)" });
    } else if (m === 0xde || m === 0xdf) {
      throw new DctRefusal("UNSUPPORTED_PROCESS", { process: "hierarchical (DHP/EXP)" });
    } else if (m === 0xdd) {
      restart = (seg[0] << 8) | seg[1];
    } else if (m === 0xe0) {
      if (seg.length >= 5 && seg[0] === 0x4a && seg[1] === 0x46 && seg[2] === 0x49 && seg[3] === 0x46 && seg[4] === 0) jfif = true;
    } else if (m === 0xee) {
      if (seg.length >= 12 && seg[0] === 0x41 && seg[1] === 0x64 && seg[2] === 0x6f && seg[3] === 0x62 && seg[4] === 0x65) adobe = { transform: seg[11] };
    } else if (m === 0xda) {                               // SOS
      if (!frame) throw new DctRefusal("UNSUPPORTED_FRAME", { note: "SOS before SOF" });
      const ns = seg[0];
      const scomps = [];
      for (let i = 0; i < ns; i++) scomps.push({ id: seg[1 + 2 * i], td: seg[2 + 2 * i] >> 4, ta: seg[2 + 2 * i] & 15 });
      for (const sc of scomps) for (const table of [`dc ${sc.td}`, `ac ${sc.ta}`]) {
        if (bogus.has(table))
          throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.bogus_huffman_table_definition_get", "bogus Huffman table definition: {get}", { get: String(bogus.get(table)) }), table, component: sc.id });
      }
      return { frame, qt, hts, jfif, adobe, restart, scan: { comps: scomps, dataAt: p + len } };
    }
    p += len;
  }
}

/* What `jdhuff.c`'s jpeg_make_d_derived_tbl refuses as "Bogus Huffman table
 * definition", or null: codes that do not fit their length (its last code would
 * be all ones, or past it), and a DC symbol past 15 (a DC difference has at most
 * 15 bits). */
function bogusHuffman(counts, symbols, isDC) {
  let code = 0;
  for (let l = 1; l <= 16; l++) {
    code += counts[l - 1];
    if (code >= 1 << l) return localize("image-codecs.dctdecode.v1_codes_of_l_bits", "{v1} codes of {l} bits overflow the code space, or use the all-ones code", { v1: String(counts[l - 1]), l: String(l) });
    code <<= 1;
  }
  if (isDC) for (const s of symbols) if (s > 15) return localize("image-codecs.dctdecode.dc_symbol_s_past_15", "DC symbol {s} past 15", { s: String(s) });
  return null;
}

/* A canonical Huffman table as a (length, code) -> symbol lookup, plus a 9-bit
 * fast table. Only a table `bogusHuffman` passes is built, so every code of a
 * length fits it and no fast index passes the table's end. */
function buildHuffman(counts, symbols) {
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0, k = 0;
  for (let l = 1; l <= 16; l++) {
    valptr[l] = k;
    mincode[l] = code;
    code += counts[l - 1];
    k += counts[l - 1];
    maxcode[l] = counts[l - 1] ? code - 1 : -1;
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  const FAST = 9;
  const fast = new Int32Array(1 << FAST).fill(-1);      // (len << 8) | symbol
  code = 0; k = 0;
  for (let l = 1; l <= FAST; l++) {
    for (let i = 0; i < counts[l - 1]; i++, k++) {
      const shift = FAST - l;
      for (let j = 0; j < 1 << shift; j++) fast[(code << shift) | j] = (l << 8) | symbols[k];
      code++;
    }
    code <<= 1;
  }
  return { maxcode, valptr, mincode, symbols: Uint8Array.from(symbols), fast, FAST };
}

/* The entropy-coded segment reader. Byte-stuffed 0xFF00 is a literal 0xFF; any
 * other marker ends the data, after which libjpeg feeds ZERO bits (and warns) —
 * that is reproduced here, and a stream that ends early is caught by the row
 * count rather than papered over. */
class Bits {
  constructor(d, at) { this.d = d; this.p = at; this.acc = 0; this.n = 0; this.marker = null; this.fed0 = 0; }
  fill() {
    while (this.n <= 24) {
      let b = 0;
      if (this.marker === null && this.p < this.d.length) {
        b = this.d[this.p];
        if (b === 0xff) {
          let q = this.p + 1;
          while (q < this.d.length && this.d[q] === 0xff) q++;
          const nx = q < this.d.length ? this.d[q] : 0xd9;
          if (nx === 0) { this.p = q + 1; }
          else { this.marker = nx; this.p = q + 1; b = 0; this.fed0++; }
        } else this.p++;
      } else { b = 0; this.fed0++; }
      this.acc = ((this.acc << 8) | b) >>> 0;
      this.n += 8;
    }
  }
  bits(k) {
    if (k === 0) return 0;
    if (this.n < k) this.fill();
    this.n -= k;
    return (this.acc >>> this.n) & ((1 << k) - 1);
  }
  peek(k) { if (this.n < k) this.fill(); return (this.acc >>> (this.n - k)) & ((1 << k) - 1); }
  skip(k) { this.n -= k; }
  decode(h) {
    if (this.n < 16) this.fill();
    const f = h.fast[this.peek(h.FAST)];
    if (f >= 0) { this.skip(f >> 8); return f & 0xff; }
    let code = this.bits(h.FAST), l = h.FAST;
    for (;;) {
      code = (code << 1) | this.bits(1);
      l++;
      if (l > 16) throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.huffman_code_longer_than_16", "Huffman code longer than 16 bits") });
      if (h.maxcode[l] >= 0 && code <= h.maxcode[l]) return h.symbols[h.valptr[l] + code - h.mincode[l]];
    }
  }
  receiveExtend(s) {
    if (s === 0) return 0;
    const v = this.bits(s);
    return v < 1 << (s - 1) ? v - (1 << s) + 1 : v;
  }
  /** Bits handed out that were NOT in the stream — libjpeg's zero-fill past a
   *  marker. Any at all means the data ran out before the decode did. */
  fabricated() { return Math.max(0, this.fed0 * 8 - this.n); }
  /** Consume the RSTn a restart interval ends on. */
  restart() {
    this.acc = 0; this.n = 0; this.fed0 = 0;
    if (this.marker === null) {
      let q = this.p;
      while (q < this.d.length && this.d[q] !== 0xff) q++;
      while (q < this.d.length && this.d[q] === 0xff) q++;
      if (q < this.d.length) { this.marker = this.d[q]; this.p = q + 1; }
    }
    const m = this.marker;
    if (m !== null && m >= 0xd0 && m <= 0xd7) this.marker = null;
    return m;
  }
}

/* ── ISLOW IDCT: jidctint.c, integer for integer ──────────────────────────── */
const CONST_BITS = 13, PASS1_BITS = 2;
const F_0_298 = 2446, F_0_390 = 3196, F_0_541 = 4433, F_0_765 = 6270, F_0_899 = 7373,
  F_1_175 = 9633, F_1_501 = 12299, F_1_847 = 15137, F_1_961 = 16069, F_2_053 = 16819,
  F_2_562 = 20995, F_3_072 = 25172;
const D1 = CONST_BITS - PASS1_BITS, R1 = 1 << (D1 - 1);
const D2 = CONST_BITS + PASS1_BITS + 3, R2 = 1 << (D2 - 1);

/* The post-IDCT range limit: `& RANGE_MASK` (1023), then the table the libjpeg
 * decoder builds in `prepare_range_limit_table` — 128..511 saturate high,
 * 512..895 saturate low, 896..1023 wrap to 0..127. */
const IDCT_LIMIT = (() => {
  const t = new Uint8Array(1024);
  for (let v = 0; v < 1024; v++) {
    const s = v < 512 ? v : v - 1024;
    t[v] = Math.max(0, Math.min(255, s + 128));
  }
  return t;
})();

const WS = new Int32Array(64);
/** Dequantize and inverse-transform one block into `out` at `(o, stride)`. */
function idctIslow(coef, q, out, o, stride) {
  const ws = WS;
  for (let c = 0; c < 8; c++) {
    const i1 = coef[8 + c], i2 = coef[16 + c], i3 = coef[24 + c], i4 = coef[32 + c],
      i5 = coef[40 + c], i6 = coef[48 + c], i7 = coef[56 + c];
    if ((i1 | i2 | i3 | i4 | i5 | i6 | i7) === 0) {
      const dc = (coef[c] * q[c]) << PASS1_BITS;
      for (let r = 0; r < 8; r++) ws[r * 8 + c] = dc;
      continue;
    }
    let z2 = i2 * q[16 + c], z3 = i6 * q[48 + c];
    let z1 = (z2 + z3) * F_0_541;
    let tmp2 = z1 + z3 * -F_1_847;
    let tmp3 = z1 + z2 * F_0_765;
    z2 = coef[c] * q[c]; z3 = i4 * q[32 + c];
    let tmp0 = (z2 + z3) * 8192, tmp1 = (z2 - z3) * 8192;
    const t10 = tmp0 + tmp3, t13 = tmp0 - tmp3, t11 = tmp1 + tmp2, t12 = tmp1 - tmp2;
    tmp0 = i7 * q[56 + c]; tmp1 = i5 * q[40 + c]; tmp2 = i3 * q[24 + c]; tmp3 = i1 * q[8 + c];
    z1 = tmp0 + tmp3; z2 = tmp1 + tmp2; z3 = tmp0 + tmp2; let z4 = tmp1 + tmp3;
    const z5 = (z3 + z4) * F_1_175;
    tmp0 *= F_0_298; tmp1 *= F_2_053; tmp2 *= F_3_072; tmp3 *= F_1_501;
    z1 *= -F_0_899; z2 *= -F_2_562; z3 *= -F_1_961; z4 *= -F_0_390;
    z3 += z5; z4 += z5;
    tmp0 += z1 + z3; tmp1 += z2 + z4; tmp2 += z2 + z3; tmp3 += z1 + z4;
    ws[c] = (t10 + tmp3 + R1) >> D1; ws[56 + c] = (t10 - tmp3 + R1) >> D1;
    ws[8 + c] = (t11 + tmp2 + R1) >> D1; ws[48 + c] = (t11 - tmp2 + R1) >> D1;
    ws[16 + c] = (t12 + tmp1 + R1) >> D1; ws[40 + c] = (t12 - tmp1 + R1) >> D1;
    ws[24 + c] = (t13 + tmp0 + R1) >> D1; ws[32 + c] = (t13 - tmp0 + R1) >> D1;
  }
  const L = IDCT_LIMIT;
  for (let r = 0; r < 8; r++) {
    const w = r * 8, d = o + r * stride;
    /* No zero-row shortcut: libjpeg's shortcut computes the same value as the
     * full expression ((w + 16) >> 5 == (w*8192 + 2^17) >> 18), so it is omitted. */
    let z2 = ws[w + 2], z3 = ws[w + 6];
    let z1 = (z2 + z3) * F_0_541;
    let tmp2 = z1 + z3 * -F_1_847;
    let tmp3 = z1 + z2 * F_0_765;
    let tmp0 = (ws[w] + ws[w + 4]) * 8192, tmp1 = (ws[w] - ws[w + 4]) * 8192;
    const t10 = tmp0 + tmp3, t13 = tmp0 - tmp3, t11 = tmp1 + tmp2, t12 = tmp1 - tmp2;
    tmp0 = ws[w + 7]; tmp1 = ws[w + 5]; tmp2 = ws[w + 3]; tmp3 = ws[w + 1];
    z1 = tmp0 + tmp3; z2 = tmp1 + tmp2; z3 = tmp0 + tmp2; let z4 = tmp1 + tmp3;
    const z5 = (z3 + z4) * F_1_175;
    tmp0 *= F_0_298; tmp1 *= F_2_053; tmp2 *= F_3_072; tmp3 *= F_1_501;
    z1 *= -F_0_899; z2 *= -F_2_562; z3 *= -F_1_961; z4 *= -F_0_390;
    z3 += z5; z4 += z5;
    tmp0 += z1 + z3; tmp1 += z2 + z4; tmp2 += z2 + z3; tmp3 += z1 + z4;
    out[d] = L[((t10 + tmp3 + R2) >> D2) & 1023];
    out[d + 7] = L[((t10 - tmp3 + R2) >> D2) & 1023];
    out[d + 1] = L[((t11 + tmp2 + R2) >> D2) & 1023];
    out[d + 6] = L[((t11 - tmp2 + R2) >> D2) & 1023];
    out[d + 2] = L[((t12 + tmp1 + R2) >> D2) & 1023];
    out[d + 5] = L[((t12 - tmp1 + R2) >> D2) & 1023];
    out[d + 3] = L[((t13 + tmp0 + R2) >> D2) & 1023];
    out[d + 4] = L[((t13 - tmp0 + R2) >> D2) & 1023];
  }
}

/* ── colour ───────────────────────────────────────────────────────────────── */
const FIX16 = (x) => Math.floor(x * 65536 + 0.5);
const CR_R = new Int32Array(256), CB_B = new Int32Array(256), CR_G = new Float64Array(256), CB_G = new Float64Array(256);
for (let i = 0, x = -128; i < 256; i++, x++) {
  CR_R[i] = Math.floor((FIX16(1.402) * x + 32768) / 65536);
  CB_B[i] = Math.floor((FIX16(1.772) * x + 32768) / 65536);
  CR_G[i] = -FIX16(0.71414) * x;
  CB_G[i] = -FIX16(0.34414) * x + 32768;
}
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Does libjpeg convert this 3-component file from YCbCr? `jdapimin.c`'s
 *  `default_decompress_parms`, in its order. Returns the answer and WHY. */
export function colourTransformOf(h) {
  const ids = h.frame.comps.map((c) => c.id);
  if (h.jfif) return { ycc: true, why: "JFIF" };
  if (h.adobe) return { ycc: h.adobe.transform !== 0, why: `Adobe APP14 transform=${h.adobe.transform}` };
  if (ids[0] === 82 && ids[1] === 71 && ids[2] === 66) return { ycc: false, why: "component ids R,G,B" };
  return { ycc: true, why: localize("image-codecs.dctdecode.libjpeg_s_default_for_three", "libjpeg's default for three components") };
}

/**
 * Decode a baseline JPEG to interleaved 8-bit samples, ROTATED CLOCKWISE by
 * `rotate` degrees (a PDF page's /Rotate) as the samples are written, so no
 * second full-size buffer is ever made.
 *
 * Returns `{ width, height, comps, samples, source }` where width/height are the
 * ROTATED dimensions and `source` names the frame as stored. Throws `DctRefusal`.
 *
 * Its live set (T44, N868): the input, the output, and the strip-wise decode's
 * own buffers (`decodeStrips`, below), which hold one MCU row and never a
 * full-size plane. At 4:2:0 that is about 3 bytes a pixel, where the decode
 * that upsampled whole chroma planes held about 6.5.
 */
export function decodeBaselineJpeg(d, { rotate = 0, expectComps = null, colorTransform = null } = {}) {
  const deg = (((rotate | 0) % 360) + 360) % 360;
  /* A rotation that is not a quarter turn is refused only once the data has been
   * read, as it always was, so a stream that is also damaged answers as damaged. */
  if (deg % 90) {
    decodeStrips(d, expectComps, colorTransform, () => {});
    throw new DctRefusal("UNSUPPORTED_ROTATION", { rotate });
  }
  let out = null, W2 = 0, H2 = 0;
  const info = decodeStrips(d, expectComps, colorTransform, (rows, y0, count, { W, H, nc }) => {
    if (!out) {
      [W2, H2] = deg === 90 || deg === 270 ? [H, W] : [W, H];
      out = new Uint8Array(W2 * H2 * nc);
    }
    if (deg === 0) { out.set(rows, y0 * W * nc); return; }
    for (let j = 0; j < count; j++) {
      const y = y0 + j;
      for (let x = 0; x < W; x++) {
        let X, Y;
        if (deg === 90) { X = H - 1 - y; Y = x; }
        else if (deg === 180) { X = W - 1 - x; Y = H - 1 - y; }
        else { X = y; Y = W - 1 - x; }
        const o = (Y * W2 + X) * nc, s = (j * W + x) * nc;
        out[o] = rows[s];
        if (nc === 3) { out[o + 1] = rows[s + 1]; out[o + 2] = rows[s + 2]; }
      }
    }
  });
  return { width: W2, height: H2, comps: info.comps, samples: out, source: info.source };
}

/**
 * image-codecs R11 (T44, N868): decode the same JPEGs as `decodeBaselineJpeg`,
 * with the same refusals, one MCU row at a time, top to bottom, never rotating.
 * Each strip's finished rows, interleaved 8-bit samples `width × comps` bytes a
 * row, are handed to `onRows(rows, y0, count)` in order; joined, they are
 * `decodeBaselineJpeg(d, {rotate: 0})`'s samples, byte for byte. `rows` is one
 * buffer reused for every strip: it holds this strip's rows until `onRows`
 * returns, and a caller that keeps them copies them. Returns `{ width, height,
 * comps, source }`, as R1 does without its samples.
 *
 * A refusal found in the header (every one but a damaged or short scan) is made
 * before any row is handed over. One found in the scan's data is made where the
 * data breaks, so `onRows` may already have had the rows above the break; a
 * caller that is refused discards what it was given. Rows decoded from bits the
 * data did not hold (libjpeg's zero fill past its end) are never handed over.
 *
 * Its live set: the input; per component, one MCU row of samples and the row
 * above it (the context row its upsampling reads); one row of each upsampled
 * component; one block of coefficients; and the strip being handed over, at most
 * 8 × vmax rows of `width × comps` bytes (8 for a single component). Measured in `build/jobs/T44/image-codecs.md`.
 */
export function decodeBaselineJpegRows(d, { expectComps = null, colorTransform = null, onRows } = {}) {
  if (typeof onRows !== "function") throw new TypeError("decodeBaselineJpegRows needs an onRows(rows, y0, count) function");
  return decodeStrips(d, expectComps, colorTransform, (strip, y0, count) => { onRows(strip, y0, count); }, true);
}

/* ── the strip-wise decode R1 and R11 share ──────────────────────────────────
 * The entropy-coded data is read MCU row by MCU row (a block row for a single,
 * non-interleaved component). Each component keeps only the MCU row just
 * decoded, plus slot 0: the last sample row of the MCU row before it. That is
 * all `jdsample.c`'s fancy upsampling reads, as libjpeg's context rows give it:
 * an output row of a vertically upsampled component reads its own sample row and
 * the one above or below, edges REPLICATED at the component's own height. So the
 * last output row of an MCU row, which reads the first sample row of the next,
 * waits for it, and each strip after the first begins with the one before. */
function decodeStrips(d, expectComps, colorTransform, emit, viaRows = false) {
  const h = readJpegHeader(d);
  const { frame, qt, hts, scan } = h;
  const nc = frame.comps.length;
  if (nc !== 1 && nc !== 3)
    throw new DctRefusal("UNSUPPORTED_COMPONENTS", { components: nc });
  if (expectComps != null && expectComps !== nc)
    throw new DctRefusal("COMPONENT_MISMATCH", { declared: expectComps, stream: nc });
  let colour = null;
  if (nc === 3) {
    colour = colourTransformOf(h);
    /* PDF's /ColorTransform OVERRIDES the file's own evidence. If it disagrees
     * with what libjpeg would decide, no independent decoder fed these bytes
     * reproduces what the PDF means, so it is refused rather than picked. */
    if (colorTransform != null && (colorTransform !== 0) !== colour.ycc)
      throw new DctRefusal("COLOR_TRANSFORM_CONFLICT", { pdf: colorTransform, stream: colour });
  }
  if (scan.comps.length !== nc)
    throw new DctRefusal("UNSUPPORTED_PROCESS", { process: "multi-scan sequential", note: localize("image-codecs.dctdecode.length_of_nc_components_in", "{length} of {nc} components in the first scan", { length: String(scan.comps.length), nc: String(nc) }) });

  const hmax = Math.max(...frame.comps.map((c) => c.h)), vmax = Math.max(...frame.comps.map((c) => c.v));
  const sampling = frame.comps.map((c) => `${c.h}x${c.v}`).join(",");
  for (const c of frame.comps) {
    const hx = hmax / c.h, vx = vmax / c.v;
    const ok = (hx === 1 || hx === 2) && (vx === 1 || vx === 2) && Number.isInteger(hx) && Number.isInteger(vx);
    if (!ok || c.h < 1 || c.v < 1) throw new DctRefusal("UNSUPPORTED_SAMPLING", { sampling });
    if (!qt[c.tq]) throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.quantisation_table_tq_missing", "quantisation table {tq} missing", { tq: String(c.tq) }) });
  }
  const W = frame.width, H = frame.height;
  const [limitName, limit] = viaRows ? [ROWS_ROW, ROWS_PIXELS_MAX] : ["pixels", PIXELS_MAX];
  if (W * H > limit)
    throw new DctRefusal("IMAGE_TOO_LARGE", {
      note: localize("image-codecs.dctdecode.the_picture_is_width_by_height", "the picture is {width} by {height}, past the {bound} pixels the decoder reads", { width: String(W), height: String(H), bound: String(limit) }),
      bound_name: limitName, ...statement("image", limitName, W * H), width: W, height: H, components: nc });
  /* A single-component scan is non-interleaved and walks its OWN block grid (for
   * a grey file, the same grid): its strip is one block row, and it is upsampled
   * by nothing. */
  const single = nc === 1;
  const mcux = Math.ceil(W / (8 * hmax)), mcuy = Math.ceil(H / (8 * vmax));
  const unitsPerRow = single ? Math.ceil(W / 8) : mcux;
  const strips = single ? Math.ceil(H / 8) : mcuy;
  const outPerStrip = single ? 8 : 8 * vmax;
  const planes = frame.comps.map((c) => {
    const sc = scan.comps.find((s) => s.id === c.id);
    if (!sc || !hts.dc[sc.td] || !hts.ac[sc.ta]) throw new DctRefusal("CORRUPT_DATA", { note: localize("image-codecs.dctdecode.huffman_table_missing_for_component", "Huffman table missing for component {id}", { id: String(c.id) }) });
    const hx = single ? 1 : hmax / c.h, vx = single ? 1 : vmax / c.v;
    const stride = mcux * c.h * 8, rowsPer = single ? 8 : 8 * c.v;
    const dw = Math.ceil((W * c.h) / hmax);
    return {
      c, dc: hts.dc[sc.td], ac: hts.ac[sc.ta], q: qt[c.tq], pred: 0, hx, vx, stride, rowsPer, dw,
      dh: Math.ceil((H * c.v) / vmax), base: 0,
      /* slot 0 the row above this MCU row, slots 1..rowsPer the MCU row's own */
      data: new Uint8Array((rowsPer + 1) * stride),
      /* one upsampled row, for a component that is upsampled */
      tmp: hx === 1 && vx === 1 ? null : new Uint8Array(dw * hx),
    };
  });
  /* Does any component read the sample row below its own? Then the last output
   * row of each strip waits for the next strip. */
  const waits = planes.some((pl) => pl.vx === 2);

  const br = new Bits(d, scan.dataAt);
  const coef = new Int32Array(64);
  let fabricated = false;
  const decodeBlock = (pl, bx, by) => {
    coef.fill(0);
    const t = br.decode(pl.dc);
    const diff = br.receiveExtend(t);
    pl.pred += diff;
    coef[0] = (pl.pred << 16) >> 16;                     // JCOEF is 16-bit
    for (let k = 1; k < 64;) {
      const rs = br.decode(pl.ac);
      const r = rs >> 4, s = rs & 15;
      if (s === 0) { if (r === 15) { k += 16; continue; } break; }
      k += r;
      if (k > 63) break;
      coef[ZIGZAG[k]] = (br.receiveExtend(s) << 16) >> 16;
      k++;
    }
    if (!fabricated) idctIslow(coef, pl.q, pl.data, (1 + by * 8) * pl.stride + bx * 8, pl.stride);
  };

  /* Sample row `y` of a component (clamped to its own height, as the context
   * rows replicate the edge) as an offset into its `data`. */
  const rowAt = (pl, y) => ((y < 0 ? 0 : y >= pl.dh ? pl.dh - 1 : y) - pl.base + 1) * pl.stride;
  /* Output row `oy` of a component, full width: [array, offset]. */
  const fullRow = (pl, oy) => {
    const { hx, vx, data: src, dw, tmp } = pl;
    if (vx === 1) {
      if (hx === 1) return [src, rowAt(pl, oy)];
      h2v1Row(src, rowAt(pl, oy), dw, tmp, 0);
      return [tmp, 0];
    }
    const cy = oy >> 1, below = oy & 1;
    const r0 = rowAt(pl, cy);
    if (hx === 1) {                                              // h1v2
      const r1 = rowAt(pl, below ? cy + 1 : cy - 1), bias = below ? 2 : 1;
      for (let x = 0; x < dw; x++) tmp[x] = (src[r0 + x] * 3 + src[r1 + x] + bias) >> 2;
    } else if (dw <= 2) {                                        // h2v2, too narrow for fancy
      for (let x = 0; x < dw; x++) tmp[2 * x] = tmp[2 * x + 1] = src[r0 + x];
    } else {                                                     // h2v2
      const r1 = rowAt(pl, below ? cy + 1 : cy - 1);
      let thiscol = src[r0] * 3 + src[r1], nextcol = src[r0 + 1] * 3 + src[r1 + 1], lastcol;
      tmp[0] = (thiscol * 4 + 8) >> 4;
      tmp[1] = (thiscol * 3 + nextcol + 7) >> 4;
      let q = 2;
      for (let x = 2; x < dw; x++) {
        lastcol = thiscol; thiscol = nextcol;
        nextcol = src[r0 + x] * 3 + src[r1 + x];
        tmp[q++] = (thiscol * 3 + lastcol + 8) >> 4;
        tmp[q++] = (thiscol * 3 + nextcol + 7) >> 4;
      }
      lastcol = thiscol; thiscol = nextcol;
      tmp[q++] = (thiscol * 3 + lastcol + 8) >> 4;
      tmp[q] = (thiscol * 4 + 7) >> 4;
    }
    return [tmp, 0];
  };
  const shape = { W, H, nc };
  /* The one strip buffer, reused for every strip handed over. */
  const strip = new Uint8Array(outPerStrip * W * nc);
  let emitted = 0;
  /* Output rows [emitted, limit): upsampled and colour-converted, row by row,
   * handed over at most an MCU row's worth at a time (the last strip also carries
   * the row the one before it held back). */
  const emitTo = (limit) => {
    while (limit - emitted > outPerStrip) emitTo(emitted + outPerStrip);
    if (limit <= emitted) return;
    const count = limit - emitted, rows = strip.subarray(0, count * W * nc);
    for (let j = 0; j < count; j++) {
      const oy = emitted + j;
      let o = j * W * nc;
      if (nc === 1) {
        const [a, ao] = fullRow(planes[0], oy);
        rows.set(a.subarray(ao, ao + W), o);
        continue;
      }
      const [a, ao] = fullRow(planes[0], oy), [b, bo] = fullRow(planes[1], oy), [c, co] = fullRow(planes[2], oy);
      if (colour.ycc) {
        for (let x = 0; x < W; x++, o += 3) {
          const Y = a[ao + x], cb = b[bo + x], cr = c[co + x];
          rows[o] = clamp8(Y + CR_R[cr]);
          rows[o + 1] = clamp8(Y + Math.floor((CB_G[cb] + CR_G[cr]) / 65536));
          rows[o + 2] = clamp8(Y + CB_B[cb]);
        }
      } else {
        for (let x = 0; x < W; x++, o += 3) { rows[o] = a[ao + x]; rows[o + 1] = b[bo + x]; rows[o + 2] = c[co + x]; }
      }
    }
    const y0 = emitted;
    emitted = limit;
    emit(rows, y0, count, shape);
  };

  const totalUnits = unitsPerRow * strips;
  let restartsLeft = h.restart, rstExpect = 0;
  for (let u = 0; u < totalUnits; u++) {
    if (h.restart) {
      if (restartsLeft === 0) {
        if (br.fabricated())
          throw new DctRefusal("TRUNCATED", { note: "a restart interval's data ended before its last MCU" });
        const m = br.restart();
        if (m !== 0xd0 + rstExpect)
          throw new DctRefusal("CORRUPT_DATA", { note: `expected RST${rstExpect}, saw ${m === null ? "none" : `0x${m.toString(16)}`}` });
        rstExpect = (rstExpect + 1) & 7;
        restartsLeft = h.restart;
        for (const pl of planes) pl.pred = 0;
      }
      restartsLeft--;
    }
    const ux = u % unitsPerRow;
    if (single) decodeBlock(planes[0], ux, 0);
    else for (const pl of planes)
      for (let v = 0; v < pl.c.v; v++) for (let hh = 0; hh < pl.c.h; hh++)
        decodeBlock(pl, ux * pl.c.h + hh, v);
    if (ux !== unitsPerRow - 1) continue;
    /* An MCU row is done. Bits the data did not hold mean this decode will be
     * refused (TRUNCATED, below or at the next restart): nothing more is handed
     * over, and the rest is only read through, so the refusal says what R1's
     * always said. */
    if (!fabricated && br.fabricated()) fabricated = true;
    if (fabricated) continue;
    const k = (u + 1) / unitsPerRow - 1;
    emitTo(k === strips - 1 ? H : Math.min(H, (k + 1) * outPerStrip - (waits ? 1 : 0)));
    for (const pl of planes) {
      pl.data.copyWithin(0, pl.rowsPer * pl.stride, (pl.rowsPer + 1) * pl.stride);
      pl.base += pl.rowsPer;
    }
  }
  /* A stream that ran out of data: libjpeg feeds zeros and warns, then emits a
   * picture that is grey past the break. That picture is not the publisher's,
   * so it is REFUSED here — the caller's TRUNCATED_IMAGE_DATA. The reader's own
   * look-ahead into the EOI is not counted: only zero bits actually CONSUMED. */
  if (br.fabricated())
    throw new DctRefusal("TRUNCATED", { note: localize("image-codecs.dctdecode.entropy_coded_data_ended_before", "entropy-coded data ended before the last MCU ({fabricated} bits zero-filled)", { fabricated: String(br.fabricated()) }) });

  return {
    width: W, height: H, comps: nc,
    source: { width: W, height: H, process: frame.process, sampling, restart: h.restart,
              colour: colour ? colour.why + (colour.ycc ? " -> YCbCr" : " -> no transform") : "grey" },
  };
}

/* h2v1: fancy only when the row is wider than 2 samples, as `jinit_upsampler`
 * chooses; otherwise plain replication. */
function h2v1Row(src, r, dw, dst, o) {
  if (dw <= 2) { for (let x = 0; x < dw; x++) dst[o + 2 * x] = dst[o + 2 * x + 1] = src[r + x]; return; }
  let v = src[r];
  dst[o] = v; dst[o + 1] = (v * 3 + src[r + 1] + 2) >> 2;
  let q = o + 2;
  for (let x = 1; x < dw - 1; x++) {
    v = src[r + x] * 3;
    dst[q++] = (v + src[r + x - 1] + 1) >> 2;
    dst[q++] = (v + src[r + x + 1] + 2) >> 2;
  }
  v = src[r + dw - 1];
  dst[q++] = (v * 3 + src[r + dw - 2] + 1) >> 2;
  dst[q] = v;
}
