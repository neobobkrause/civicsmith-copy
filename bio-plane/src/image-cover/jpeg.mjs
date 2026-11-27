/* image-cover: the JPEG path, in the DCT domain (R1, R2, R4).
 *
 * The photo is never decoded to pixels. Its entropy-coded data is read one MCU at a time into quantised
 * coefficients; each block of an MCU an area touches is replaced by a DC-only block of the cover colour (every AC
 * coefficient zero), every other block is kept coefficient for coefficient; and the coefficients are Huffman-coded
 * again into a fresh container that holds the frame, its tables and the scan, and nothing else. Two passes over the
 * data: the first counts the symbols the covered stream needs and builds optimal tables from them (jchuff.c's
 * `jpeg_gen_optimal_table`; a phone's own optimised tables may lack the symbols a cover's DC differences need), the
 * second writes. Neither pass holds more than one block of coefficients, so the working set is the photo's bytes
 * and the answer's (R4).
 *
 * WHY WHOLE MCUs. With subsampled chroma one chroma block spans the pixels of several luma blocks; covering only
 * the luma blocks an area touches would leave a band of original luma under a flat chroma block, and covering only
 * the chroma would leave the face's luma. So the cover is snapped outward to the MCU: every block of every
 * component in an MCU an area touches is covered, and luma and chroma cover the same pixels.
 *
 * THE COLOUR. Black: each luma (or each component, for a file not in YCbCr) gets the DC value whose dequantised
 * level lies deep in the decoder's saturating range, so any IDCT, exact or fast, answers 0; chroma gets DC 0,
 * which every decoder answers as 128. A covered pixel decodes to (0, 0, 0) in every decoder; only the one pixel
 * row or column on each side of a covered MCU edge mixes chroma with its neighbour under fancy upsampling. */
import { readJpegHeader, colourTransformOf, DctRefusal } from "../../../pdf-worker/src/dctdecode.mjs";
import { CoverRefusal, checkPixels, checkCount, storedRects, displayedSize, mergeSpans, orientationOf, orientationTiff } from "./geometry.mjs";
import { localize } from "../setup-words/index.mjs";

/** @import { Rect, Span } from "./geometry.mjs" */

/**
 * The coefficients of one 8x8 block, in zig-zag order, handed to a pass: the component's index, its table class
 * (0 luma, 1 chroma) and the block.
 * @callback BlockSink
 * @param {number} ci
 * @param {0 | 1} cls
 * @param {Int32Array} z
 * @returns {void}
 */

/**
 * One Huffman table's optimal code: `counts[16]`, the symbols in code order, and each symbol's code and size.
 * @typedef {Object} OptimalTable
 * @property {number[]} counts
 * @property {number[]} symbols
 * @property {Int32Array} code
 * @property {Int32Array} size
 */

/** @type {Readonly<Record<string, number>>} */
const SOF_MARKER = { baseline: 0xc0, "extended-sequential-huffman": 0xc1 };

/* The image-codecs refusal codes (its R1, R7) as this module's (R3): data that ends early is TRUNCATED_IMAGE_DATA,
 * data that cannot be read IMAGE_DATA_CORRUPT (K2173), each detail naming the fault. */
/**
 * @param {unknown} e
 * @returns {CoverRefusal}
 */
function fromDct(e) {
  if (!(e instanceof DctRefusal)) throw e;
  const note = [e.detail?.process, e.detail?.precision && `precision ${e.detail.precision}`, e.detail?.note]
    .filter(Boolean).join("; ");
  if (e.code === "NOT_A_JPEG") return new CoverRefusal("NOT_A_COVERABLE_FORMAT", `not a JPEG${note ? `: ${note}` : ""}`);
  if (e.code === "TRUNCATED")
    return new CoverRefusal("TRUNCATED_IMAGE_DATA", localize("image-cover.jpeg.the_jpeg_data_ends_before", "the JPEG data ends before the image does{v1}", { v1: String(note ? `: ${note}` : "") }));
  if (e.code === "CORRUPT_DATA")
    return new CoverRefusal("IMAGE_DATA_CORRUPT", localize("image-cover.jpeg.the_jpeg_data_cannot_be", "the JPEG data cannot be read{v1}", { v1: String(note ? `: ${note}` : "") }));
  return new CoverRefusal("UNSUPPORTED_JPEG_PROCESS", localize("image-cover.jpeg.this_jpegs_coding_is_not", "this JPEG's coding is not covered ({code}{v1}); only baseline or extended-sequential Huffman, 8-bit, one scan, grey or three components", { code: String(e.code), v1: String(note ? `: ${note}` : "") }));
}

/**
 * Refuse a JPEG holding more marker segments than the bound (R10), counted outside the entropy-coded data and
 * before anything is kept for them. A walk that cannot go on stops quietly: the reader refuses what is malformed.
 * @param {Uint8Array} d
 * @throws {CoverRefusal} IMAGE_TOO_LARGE
 */
export function checkMarkers(d) {
  let p = 2, count = 0;
  while (p + 1 < d.length) {
    if (d[p] !== 0xff) return;
    while (p + 1 < d.length && d[p + 1] === 0xff) p++;
    const m = d[p + 1] ?? NaN;                                   // past the end: no marker, and the walk stops below
    checkCount(++count, "markers");
    if (m === 0xd9) return;
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
    if (p + 4 > d.length) return;
    p += 2 + (((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0));
    if (m !== 0xda) continue;
    for (;;) {                                                   // the scan's entropy-coded data
      while (p < d.length && d[p] !== 0xff) p++;
      if (p + 1 >= d.length) return;
      const n = d[p + 1] ?? NaN;
      if (n === 0 || (n >= 0xd0 && n <= 0xd7) || n === 0xff) { p += n === 0xff ? 1 : 2; continue; }
      break;
    }
  }
}

/**
 * The orientation of the first EXIF APP1 before the scan; 1 when there is none.
 * @param {Uint8Array} d
 * @returns {number}
 */
export function exifOrientation(d) {
  let p = 2;
  while (p + 4 <= d.length) {
    while (p < d.length && d[p] !== 0xff) p++;
    while (p < d.length && d[p] === 0xff) p++;
    if (p + 2 >= d.length) return 1;
    const m = d[p++] ?? NaN;                                     // inside the data: p + 2 < length
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) continue;
    if (m === 0xd9 || m === 0xda) return 1;
    const len = ((d[p] ?? 0) << 8) | (d[p + 1] ?? 0);
    if (m === 0xe1 && len >= 8 && d[p + 2] === 0x45 && d[p + 3] === 0x78 && d[p + 4] === 0x69 && d[p + 5] === 0x66 && d[p + 6] === 0 && d[p + 7] === 0)
      return orientationOf(d.subarray(p + 8, Math.min(d.length, p + len)));
    p += len;
  }
  return 1;
}

/* ── reading the entropy-coded data (libjpeg's rules, as image-codecs' decoder keeps them) ── */
class BitReader {
  /**
   * @param {Uint8Array} d
   * @param {number} at
   */
  constructor(d, at) {
    /** @type {Uint8Array} */
    this.d = d;
    /** @type {number} */
    this.p = at;
    /** @type {number} */
    this.acc = 0;
    /** @type {number} */
    this.n = 0;
    /** @type {number | null} */
    this.marker = null;
    /** @type {number} */
    this.fed0 = 0;
  }
  fill() {
    while (this.n <= 24) {
      let b = 0;
      if (this.marker === null && this.p < this.d.length) {
        b = this.d[this.p] ?? 0;                                 // p < length
        if (b === 0xff) {
          let q = this.p + 1;
          while (q < this.d.length && this.d[q] === 0xff) q++;
          const nx = this.d[q] ?? 0xd9;                          // past the end: as if EOI
          if (nx === 0) this.p = q + 1;
          else { this.marker = nx; this.p = q + 1; b = 0; this.fed0++; }
        } else this.p++;
      } else { b = 0; this.fed0++; }
      this.acc = ((this.acc << 8) | b) >>> 0;
      this.n += 8;
    }
  }
  /** @param {number} k */
  bits(k) {
    if (k === 0) return 0;
    if (this.n < k) this.fill();
    this.n -= k;
    return (this.acc >>> this.n) & ((1 << k) - 1);
  }
  /**
   * @param {any} h a Huffman table image-codecs' `readJpegHeader` builds; its kind is not yet stated there
   * @returns {number}
   */
  decode(h) {
    if (this.n < 16) this.fill();
    const f = h.fast[(this.acc >>> (this.n - h.FAST)) & ((1 << h.FAST) - 1)];
    if (f >= 0) { this.n -= f >> 8; return f & 0xff; }
    let code = this.bits(h.FAST), l = h.FAST;
    for (;;) {
      code = (code << 1) | this.bits(1);
      if (++l > 16) throw new DctRefusal("CORRUPT_DATA", { note: "a Huffman code longer than 16 bits" });
      if (h.maxcode[l] >= 0 && code <= h.maxcode[l]) return h.symbols[h.valptr[l] + code - h.mincode[l]];
    }
  }
  /** @param {number} s */
  extend(s) {
    if (s === 0) return 0;
    const v = this.bits(s);
    return v < 1 << (s - 1) ? v - (1 << s) + 1 : v;
  }
  /** Bits handed out that were not in the stream: any at all means the data ran out. */
  fabricated() { return Math.max(0, this.fed0 * 8 - this.n); }
  restart() {
    this.acc = 0; this.n = 0; this.fed0 = 0;
    if (this.marker === null) {
      let q = this.p;
      while (q < this.d.length && this.d[q] !== 0xff) q++;
      while (q < this.d.length && this.d[q] === 0xff) q++;
      if (q < this.d.length) { this.marker = this.d[q] ?? null; this.p = q + 1; }
    }
    const m = this.marker;
    if (m !== null && m >= 0xd0 && m <= 0xd7) this.marker = null;
    return m;
  }
}

/* ── writing ──────────────────────────────────────────────────────────────── */
class ByteSink {
  /** @param {number} cap */
  constructor(cap) {
    /** @type {Uint8Array} */
    this.buf = new Uint8Array(Math.max(1024, cap));
    /** @type {number} */
    this.n = 0;
    /** @type {number} */
    this.acc = 0;
    /** @type {number} */
    this.nb = 0;
  }
  /** @param {number} k */
  grow(k) {
    if (this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.n + k, Math.ceil(this.buf.length * 1.5)));
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }
  /** @param {ArrayLike<number>} a */
  bytes(a) { this.grow(a.length); this.buf.set(a, this.n); this.n += a.length; }
  /**
   * @param {number} marker
   * @param {Uint8Array} body
   */
  segment(marker, body) {
    this.grow(body.length + 4);
    const b = this.buf;
    b[this.n++] = 0xff; b[this.n++] = marker; b[this.n++] = (body.length + 2) >> 8; b[this.n++] = (body.length + 2) & 0xff;
    b.set(body, this.n); this.n += body.length;
  }
  /**
   * Append `size` (<= 16) bits, stuffing a zero byte after every 0xFF.
   * @param {number} code
   * @param {number} size
   */
  put(code, size) {
    this.acc = ((this.acc << size) | (code & ((1 << size) - 1))) >>> 0;
    this.nb += size;
    while (this.nb >= 8) {
      const v = (this.acc >>> (this.nb - 8)) & 0xff;
      if (this.n + 2 > this.buf.length) this.grow(2);
      this.buf[this.n++] = v;
      if (v === 0xff) this.buf[this.n++] = 0;
      this.nb -= 8;
    }
    this.acc &= (1 << this.nb) - 1;
  }
  /** Pad the last byte with one bits (T.81 F.1.2.3). */
  align() { if (this.nb > 0) this.put((1 << (8 - this.nb)) - 1, 8 - this.nb); }
}

/**
 * Optimal code lengths for the counted symbols, limited to 16 bits: jchuff.c's `jpeg_gen_optimal_table` (T.81
 * K.2), with its reserved all-ones code. Returns `{counts[16], symbols, code[256], size[256]}`.
 * @param {Float64Array} freqIn
 * @returns {OptimalTable}
 */
export function optimalTable(freqIn) {
  const freq = new Float64Array(257);
  freq.set(freqIn.subarray(0, 256));
  freq[256] = 1;
  const codesize = new Int32Array(257), others = new Int32Array(257).fill(-1);
  /* Each read below is of a typed array, whose index past its end reads as nothing and whose write there is
   * dropped; `?? 0` is that nothing as the arithmetic used it (NaN in a sum that is then dropped, 0 in a test). */
  for (;;) {
    let c1 = -1, c2 = -1, v = Infinity;
    for (let i = 0; i <= 256; i++) { const f = freq[i] ?? 0; if (f && f <= v) { v = f; c1 = i; } }
    v = Infinity;
    for (let i = 0; i <= 256; i++) { const f = freq[i] ?? 0; if (f && f <= v && i !== c1) { v = f; c2 = i; } }
    if (c2 < 0) break;
    freq[c1] = (freq[c1] ?? 0) + (freq[c2] ?? 0); freq[c2] = 0;
    codesize[c1] = (codesize[c1] ?? 0) + 1;
    while ((others[c1] ?? -1) >= 0) { c1 = others[c1] ?? -1; codesize[c1] = (codesize[c1] ?? 0) + 1; }
    others[c1] = c2;
    codesize[c2] = (codesize[c2] ?? 0) + 1;
    while ((others[c2] ?? -1) >= 0) { c2 = others[c2] ?? -1; codesize[c2] = (codesize[c2] ?? 0) + 1; }
  }
  const bits = new Int32Array(33);
  for (let i = 0; i <= 256; i++) { const l = codesize[i] ?? 0; if (l) bits[l] = (bits[l] ?? 0) + 1; }
  for (let i = 32; i > 16; i--) {
    while ((bits[i] ?? 0) > 0) {
      let j = i - 2;
      while (bits[j] === 0) j--;
      bits[i] = (bits[i] ?? 0) - 2; bits[i - 1] = (bits[i - 1] ?? 0) + 1; bits[j + 1] = (bits[j + 1] ?? 0) + 2; bits[j] = (bits[j] ?? 0) - 1;
    }
  }
  let i = 16;
  while (bits[i] === 0) i--;
  bits[i] = (bits[i] ?? 0) - 1;                          // the reserved code
  /** @type {number[]} */
  const symbols = [];
  for (let l = 1; l <= 32; l++) for (let s = 0; s < 256; s++) if (codesize[s] === l) symbols.push(s);
  const counts = Array.from(bits.subarray(1, 17));
  const code = new Int32Array(256), size = new Int32Array(256);
  let c = 0, k = 0;
  for (let l = 1; l <= 16; l++) {
    /* the counts sum to fewer than the symbols (the reserved code is one of them), so `k` stays inside the list */
    for (let n = 0; n < (counts[l - 1] ?? 0); n++, k++) { const sym = symbols[k] ?? 0; code[sym] = c++; size[sym] = l; }
    c <<= 1;
  }
  return { counts, symbols: symbols.slice(0, k), code, size };
}

/** @param {number} v */
const category = (v) => { let a = v < 0 ? -v : v, s = 0; while (a) { s++; a >>= 1; } return s; };

/* The DC value of a component's cover block: the dequantised level that libjpeg's ISLOW (and any IDCT that clamps)
 * answers as `target`. For target 0 the value is chosen deep in the saturating range (level about -256, not the
 * edge at -128), so a fast or float IDCT's rounding cannot lift it off 0; but never so deep that the difference
 * from a neighbour's legal DC (at most 1024 / q0) passes the 8-bit limit of 2047, which only a DC quantiser of 1
 * (quality 100) reaches, and there the level is -128, still 0. */
/**
 * @param {number} q0
 * @param {number} target
 * @returns {number}
 */
function coverDc(q0, target) {
  /** @param {number} dc */
  const level = (dc) => { const v = Math.floor((dc * q0 + 4) / 8) & 1023; return v < 512 ? v : v - 1024; };
  /** @param {number} dc */
  const pixel = (dc) => Math.max(0, Math.min(255, level(dc) + 128));
  if (target === 128) return 0;
  let best = 0, bestScore = Infinity;
  for (let dc = 0, lb = -2047 + Math.ceil(1024 / q0); dc >= lb; dc--) {
    const score = pixel(dc) === 0 ? Math.abs(level(dc) + 256) : 1e6 + pixel(dc);
    if (score < bestScore) { best = dc; bestScore = score; }
  }
  return best;
}

/**
 * The header image-codecs reads, its refusal answered as this module's.
 * @param {Uint8Array} d
 */
function readHeader(d) {
  try { return readJpegHeader(d); } catch (e) { throw fromDct(e); }
}

/**
 * A frequency count per symbol, for one table class: its DC and its AC table.
 * @typedef {{dc: Float64Array, ac: Float64Array}} Counts
 */
/**
 * The optimal tables for one table class.
 * @typedef {{dc: OptimalTable, ac: OptimalTable}} Tables
 */

/**
 * Cover a baseline JPEG. `d` is the whole file; `areas` are already shape-checked.
 * @param {Uint8Array} d
 * @param {ReadonlyArray<Rect>} areas
 * @param {number} maxPixels
 * @returns {{bytes: Uint8Array, format: "jpeg", width: number, height: number, covered: number}}
 * @throws {CoverRefusal}
 */
export function coverJpeg(d, areas, maxPixels) {
  checkMarkers(d);
  const h = readHeader(d);
  const { frame, qt, hts, scan, adobe } = h;
  const nc = frame.comps.length;
  /** @param {string} note */
  const refuse = (note) => fromDct(new DctRefusal("UNSUPPORTED_PROCESS", { note }));
  if (nc !== 1 && nc !== 3) throw refuse(`${nc} components`);
  if (scan.comps.length !== nc) throw refuse(localize("image-cover.jpeg.multi_scan_sequential_length_of", "multi-scan sequential: {length} of {nc} components in the first scan", { length: String(scan.comps.length), nc: String(nc) }));
  const hmax = Math.max(...frame.comps.map((c) => c.h)), vmax = Math.max(...frame.comps.map((c) => c.v));
  for (const c of frame.comps) {
    const hx = hmax / c.h, vx = vmax / c.v;
    if (!(c.h >= 1 && c.v >= 1 && (hx === 1 || hx === 2) && (vx === 1 || vx === 2)))
      throw refuse(`sampling ${frame.comps.map((x) => `${x.h}x${x.v}`).join(",")}`);
  }
  const ycc = nc === 3 && colourTransformOf(h).ycc;
  const single = nc === 1;
  const comps = frame.comps.map((c, i) => {
    const sc = scan.comps.find((s) => s.id === c.id);
    const tq = c.tq, q = tq === undefined ? undefined : qt[tq];
    if (!sc || !hts.dc[sc.td] || !hts.ac[sc.ta] || tq === undefined || !q)
      throw fromDct(new DctRefusal("CORRUPT_DATA", { note: `a table is missing for component ${c.id}` }));
    /** @type {0 | 1} */
    const cls = i === 0 ? 0 : 1;
    return {
      id: c.id, tq, h: single ? 1 : c.h, v: single ? 1 : c.v, sh: c.h, sv: c.v,
      dc: hts.dc[sc.td], ac: hts.ac[sc.ta], cls,
      cover: coverDc(q[0] ?? 0, ycc && i > 0 ? 128 : 0),
    };
  });
  const W = frame.width, H = frame.height;
  checkPixels(W, H, maxPixels);
  const mw = single ? 8 : 8 * hmax, mh = single ? 8 : 8 * vmax;   // one MCU's pixels
  const mcux = Math.ceil(W / mw), mcuy = Math.ceil(H / mh);
  const orientation = exifOrientation(d);
  const rects = storedRects(areas, W, H, orientation)
    .map(([x0, y0, x1, y1]) => {
      /** @type {Rect} */
      const r = [Math.floor(x0 / mw), Math.floor(y0 / mh), Math.floor((x1 - 1) / mw) + 1, Math.floor((y1 - 1) / mh) + 1];
      return r;
    });
  /** @param {number} my */
  const spansOf = (my) => mergeSpans(rects.filter((r) => r[1] <= my && my < r[3]).map((r) => {
    /** @type {Span} */
    const s = [r[0], r[2]];
    return s;
  }));
  const blocksPerMcu = comps.reduce((n, c) => n + c.h * c.v, 0);
  const order = scan.comps.map((s) => comps.findIndex((c) => c.id === s.id));   // an MCU's blocks, in the scan's order

  /* A scan naming a component twice in the frame leaves one of its components unmatched (-1 in `order`). The cover
   * has always thrown the language's own TypeError there, not a refusal; kept as it was by this conversion, and
   * reported to ARCH as a flaw against R3 (it should be IMAGE_DATA_CORRUPT). */
  /** @param {number} ci @param {string} member */
  const compAt = (ci, member) => {
    const c = comps[ci];
    if (!c) throw new TypeError(`Cannot read properties of undefined (reading '${member}')`);
    return c;
  };

  const zz = new Int32Array(64);
  /* One pass over the data: read every block, cover the MCUs in `spans`, and hand each block's coefficients (in
   * zig-zag order) to `emit`. Throws on data that runs out or does not read. */
  /**
   * @param {BlockSink} emit
   * @param {() => void} restartAt
   * @returns {number}
   */
  const walk = (emit, restartAt) => {
    const br = new BitReader(d, scan.dataAt);
    const pred = new Int32Array(nc);
    let left = h.restart, expect = 0, covered = 0;
    for (let my = 0; my < mcuy; my++) {
      const spans = spansOf(my);
      let si = 0;
      for (let mx = 0; mx < mcux; mx++) {
        if (h.restart) {
          if (left === 0) {
            if (br.fabricated()) throw new DctRefusal("TRUNCATED", { note: "a restart interval's data ended before its last MCU" });
            const m = br.restart();
            if (m !== 0xd0 + expect) throw new DctRefusal("CORRUPT_DATA", { note: `expected RST${expect}, found ${m === null ? "none" : `0x${m.toString(16)}`}` });
            expect = (expect + 1) & 7;
            left = h.restart;
            pred.fill(0);
            restartAt();
          }
          left--;
        }
        while (si < spans.length && (spans[si]?.[1] ?? 0) <= mx) si++;          // si < length: the span is there
        const cover = si < spans.length && (spans[si]?.[0] ?? 0) <= mx;
        if (cover) covered += blocksPerMcu;
        for (const ci of order) {
          const c = compAt(ci, "h");
          for (let n = c.h * c.v; n > 0; n--) {
            zz.fill(0);
            pred[ci] = (pred[ci] ?? 0) + br.extend(br.decode(c.dc));          // ci is a component's index
            zz[0] = ((pred[ci] ?? 0) << 16) >> 16;
            for (let k = 1; k < 64;) {
              const rs = br.decode(c.ac), r = rs >> 4, s = rs & 15;
              if (s === 0) { if (r === 15) { k += 16; continue; } break; }
              k += r;
              if (k > 63) break;
              zz[k] = (br.extend(s) << 16) >> 16;
              k++;
            }
            if (cover) { zz.fill(0); zz[0] = c.cover; }
            emit(ci, c.cls, zz);
          }
        }
      }
      if (br.fabricated()) throw new DctRefusal("TRUNCATED", { note: `the entropy-coded data ended in MCU row ${my + 1} of ${mcuy}` });
    }
    return covered;
  };

  /* Pass 1: count the symbols the covered stream codes, per table class (luma, chroma). Every index below is inside
   * its array: a component's index, a DC category up to 11, an AC symbol below 256, a coefficient below 64. */
  /** @type {[Counts, Counts]} */
  const freq = [{ dc: new Float64Array(256), ac: new Float64Array(256) }, { dc: new Float64Array(256), ac: new Float64Array(256) }];
  let last = new Int32Array(nc), dataBits = 0;
  /** @type {BlockSink} */
  const count = (ci, cls, z) => {
    const f = freq[cls];
    const diff = (z[0] ?? 0) - (last[ci] ?? 0);
    last[ci] = z[0] ?? 0;
    const s = category(diff);
    if (s > 11) throw new DctRefusal("CORRUPT_DATA", { note: "a DC coefficient outside the 8-bit range" });
    f.dc[s] = (f.dc[s] ?? 0) + 1; dataBits += s;
    let r = 0;
    for (let k = 1; k < 64; k++) {
      const v = z[k] ?? 0;
      if (v === 0) { r++; continue; }
      while (r > 15) { f.ac[0xf0] = (f.ac[0xf0] ?? 0) + 1; r -= 16; }
      const t = category(v);
      if (t > 10) throw new DctRefusal("CORRUPT_DATA", { note: "an AC coefficient outside the 8-bit range" });
      const sym = (r << 4) | t;
      f.ac[sym] = (f.ac[sym] ?? 0) + 1; dataBits += t;
      r = 0;
    }
    if (r > 0) f.ac[0] = (f.ac[0] ?? 0) + 1;
  };
  /** @type {number} */
  let covered;
  try { covered = walk(count, () => last.fill(0)); } catch (e) { throw fromDct(e); }

  /** @type {Array<0 | 1>} */
  const classes = single ? [0] : [0, 1];
  /** @param {0 | 1} cls @returns {Tables} */
  const tablesOf = (cls) => ({ dc: optimalTable(freq[cls].dc), ac: optimalTable(freq[cls].ac) });
  const luma = tablesOf(0);
  /** @type {[Tables, Tables]} a grey image has no chroma class, and names only the first */
  const tables = [luma, single ? luma : tablesOf(1)];
  for (const cls of classes) {
    const f = freq[cls], t = tables[cls];
    for (let s = 0; s < 256; s++) dataBits += (f.dc[s] ?? 0) * (t.dc.size[s] ?? 0) + (f.ac[s] ?? 0) * (t.ac.size[s] ?? 0);
  }

  /* The fresh container: nothing of the original but the frame, its tables and the scan (R2). */
  const out = new ByteSink(Math.ceil((dataBits / 8) * 1.01) + 4096 + (h.restart ? Math.ceil((mcux * mcuy) / h.restart) * 2 : 0));
  out.bytes([0xff, 0xd8]);
  if (h.jfif) out.segment(0xe0, Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  /* a byte read as nothing is written as 0, as the typed array writes it */
  if (adobe) out.segment(0xee, Uint8Array.from([0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, adobe.transform ?? 0]));
  if (orientation !== 1) out.segment(0xe1, Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0, 0, ...orientationTiff(orientation)]));
  for (const tq of [...new Set(comps.map((c) => c.tq))].sort((a, b) => a - b)) {
    const q = qt[tq];
    if (!q) throw new TypeError("Cannot read properties of undefined (reading 'some')");   // each tq was checked above
    const wide = q.some((v) => v > 255);
    const body = new Uint8Array(1 + 64 * (wide ? 2 : 1));
    body[0] = ((wide ? 1 : 0) << 4) | tq;
    for (let i = 0; i < 64; i++) {
      const v = q[ZIGZAG[i] ?? 0] ?? 0;                          // a value read as nothing is written as 0
      if (wide) { body[1 + 2 * i] = v >> 8; body[2 + 2 * i] = v & 0xff; } else body[1 + i] = v;
    }
    out.segment(0xdb, body);
  }
  /* a component id read as nothing (NaN here) is written as 0, as the typed array writes it */
  const sof = [8, H >> 8, H & 0xff, W >> 8, W & 0xff, nc];
  for (const c of comps) sof.push(c.id ?? NaN, (c.sh << 4) | c.sv, c.tq);
  out.segment(SOF_MARKER[frame.process] ?? 0, Uint8Array.from(sof));
  for (const cls of classes) {
    /** @type {Array<[number, OptimalTable]>} */
    const dht = [[0, tables[cls].dc], [1, tables[cls].ac]];
    for (const [tc, t] of dht)
      out.segment(0xc4, Uint8Array.from([(tc << 4) | cls, ...t.counts, ...t.symbols]));
  }
  if (h.restart) out.segment(0xdd, Uint8Array.from([h.restart >> 8, h.restart & 0xff]));
  const sos = [nc];
  for (const ci of order) { const c = compAt(ci, "id"); sos.push(c.id ?? NaN, (c.cls << 4) | c.cls); }
  sos.push(0, 63, 0);
  out.segment(0xda, Uint8Array.from(sos));

  /* Pass 2: write. */
  last = new Int32Array(nc);
  let rst = 0;
  /** @type {BlockSink} */
  const write = (ci, cls, z) => {
    const t = tables[cls];
    const diff = (z[0] ?? 0) - (last[ci] ?? 0);
    last[ci] = z[0] ?? 0;
    const s = category(diff);
    out.put(t.dc.code[s] ?? 0, t.dc.size[s] ?? 0);
    if (s) out.put(diff < 0 ? diff + (1 << s) - 1 : diff, s);
    let r = 0;
    for (let k = 1; k < 64; k++) {
      const v = z[k] ?? 0;
      if (v === 0) { r++; continue; }
      while (r > 15) { out.put(t.ac.code[0xf0] ?? 0, t.ac.size[0xf0] ?? 0); r -= 16; }
      const u = category(v), sym = (r << 4) | u;
      out.put(t.ac.code[sym] ?? 0, t.ac.size[sym] ?? 0);
      out.put(v < 0 ? v + (1 << u) - 1 : v, u);
      r = 0;
    }
    if (r > 0) out.put(t.ac.code[0] ?? 0, t.ac.size[0] ?? 0);
  };
  try {
    walk(write, () => {
      out.align();
      out.bytes([0xff, 0xd0 + rst]);
      rst = (rst + 1) & 7;
      last.fill(0);
    });
  } catch (e) { throw fromDct(e); }
  out.align();
  out.bytes([0xff, 0xd9]);
  const [width, height] = displayedSize(W, H, orientation);
  return { bytes: out.buf.slice(0, out.n), format: "jpeg", width, height, covered };
}

const ZIGZAG = Int32Array.from([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48,
  41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22,
  15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55,
  62, 63,
]);
