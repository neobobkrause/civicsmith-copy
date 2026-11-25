/* jpxdecode.mjs — D-622: a JPEG 2000 decoder (ITU-T T.800, Part 1) for the
 * `JPXDecode` image of an image-only PDF page, so tier 3 can read it in-isolate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "CORRECT" MEANS HERE: THE SAME SAMPLES AS OpenJPEG, TO THE BIT
 * ─────────────────────────────────────────────────────────────────────────────
 * The reversible path (the 5/3 wavelet, the RCT) is integer arithmetic the
 * standard defines exactly, so there is one right picture. The irreversible
 * path (the 9/7 wavelet, the ICT, scalar quantisation) is not bit-defined: the
 * standard allows any reconstruction within its tolerance, and a decoder that
 * is merely conforming produces a picture no independent decoder reproduces,
 * which would make `pixels_sha256` a hash nobody can check. So every
 * irreversible step below is OpenJPEG 2.5's own, float32 operation for float32
 * operation (each JavaScript result is rounded with Math.fround, which gives
 * exactly the IEEE single-precision answer for one add or multiply):
 *   - tier 1 reconstructs a coefficient at the middle of its last decoded
 *     interval, in doubled integer units (`opj_t1_dec_*`'s "oneplushalf");
 *   - dequantisation multiplies that integer, as a float, by half the band's
 *     step size, computed in double and stored as float (`tcd.c`), with the
 *     sub-band gain OpenJPEG leaves out and its 9/7 compensates (its
 *     BUG_WEIRD_TWO_INVK: high bands are scaled by 1.625732422 = "2/K", not 1/K);
 *   - the 9/7 lifting steps in `opj_v8dwt_decode`'s order and grouping, rows
 *     first, then columns, level by level;
 *   - the ICT with `opj_mct_decode_real`'s constants and order;
 *   - rounding to the nearest integer, ties to even (`lrintf`), then the DC
 *     level shift and a clamp to the component's range.
 * The suite checks the result against opj_decompress (OpenJPEG 2.5.0), which
 * shares no line with this file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT REFUSES, BY NAME (JPX_REFUSES) — never a picture it guessed at
 * ─────────────────────────────────────────────────────────────────────────────
 * High-throughput coding (Part 15), packed packet headers, sub-sampled
 * components, a palette, sYCC,
 * signed samples and any precision but 8 bits, more than three components.
 * A size the decoder will not allocate for (an image past the pixel or edge bound,
 * past the memory bound below, or a codestream whose precincts and code-blocks
 * would pass the retained-objects bound) is refused from its headers before a
 * sample or an object is allocated: IMAGE_TOO_LARGE, final and never retried,
 * its `detail` the declared size, the bound and the sentence's key (R4, R12).
 * Every error thrown is a `JpxRefusal` carrying a code: UNSUPPORTED (with the
 * feature), UNSUPPORTED_SAMPLES, IMAGE_TOO_LARGE, TRUNCATED or CORRUPT.
 */

import { MqDecoder, mqContexts } from "./mq.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { READ_BOUNDS, boundOf, statement } from "../../bio-plane/src/read-bounds.mjs";

export class JpxRefusal extends Error {
  constructor(code, detail = {}) {
    super(`${code}${detail.feature ? `: ${detail.feature}` : detail.note ? `: ${detail.note}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}
const unsupported = (feature, extra = {}) => new JpxRefusal("UNSUPPORTED", { feature, ...extra });
const samples = (note, extra = {}) => new JpxRefusal("UNSUPPORTED_SAMPLES", { note, ...extra });
const corrupt = (note, extra = {}) => new JpxRefusal("CORRUPT", { note, ...extra });
const truncated = (note, extra = {}) => new JpxRefusal("TRUNCATED", { note, ...extra });

/** The old `feature` of the memory refusal, an identifier read by code. The refusal is `IMAGE_TOO_LARGE` now (R4, R12) and no
 *  longer a key of `JPX_REFUSES`; the name stays exported so `pdf-pixels`' import of it still loads until it maps the code. */
export const MEMORY_FEATURE = "image-past-memory-bound";

/** Every `feature` an UNSUPPORTED refusal can carry. */
export const JPX_REFUSES = Object.freeze({
  "high-throughput coding": localize("image-codecs.jpxdecode.the_codestream_uses_part_15", "the codestream uses Part 15 (HTJ2K) block coding"),
  "a JP2 palette": localize("image-codecs.jpxdecode.the_image_s_samples_index", "the image's samples index a palette (pclr box)"),
  "sYCC colour": localize("image-codecs.jpxdecode.the_jp2_colour_specification_is", "the JP2 colour specification is sYCC, whose conversion is not bit-defined"),
  "an extended capability": "a Part 2 extension the decoder must understand (a CAP marker, or Rsiz beyond Part 1)",
  "packed packet headers": "the packet headers are carried apart from the packets (PPM or PPT markers); no encoder at hand writes them, so no decode of them could be checked",
});

/* THE BOUNDS (R4, R12, fix round 9, G125b), all read from the table. The image is judged by its pixels and its edge, the
 * decode by its working set, and the codestream by the objects its precincts and code-blocks would build.
 *
 * THE MEMORY BOUND (N34), a workload size and never a share of 128 MB (D-312).
 * The working set is what a decode must hold at once. Since N75 the decode is
 * line-based ("THE LINE-BASED DECODE", below): no component is ever held whole,
 * so the working set is the 8-bit output and, beside it, the buffers the tiles
 * share, at 4 bytes a sample (float32 or int32, which the bit-exact paths need):
 * one code-block row of every band, and each level's line and window of rows.
 * 61.3 MB is the largest working set measured to complete in the OCR member's
 * isolate (CPDF-15: a 61.3 MB frame completed there beside the OCR engine, a
 * 75.7 MB one was killed `exceededMemory`). Measured in node on 2026-09-28
 * (`test/codecs/jpx-memory.probe.mjs`: heap plus external memory, sampled every
 * 2 ms from outside the decoding thread), the decoder's live peak is the working
 * set plus 11-23 MB of its own (code-blocks, tag trees, input, garbage not yet
 * collected), as the whole-plane decode's was plus 12-18 MB: a 2550x3300 colour
 * page in one tile (31.5 MB, refused at 101 MB before N75) peaks 54 MB above
 * the idle isolate, where the whole-plane decode peaked at 119 MB.
 *
 * THE OBJECT BOUND (G125b). Tier 2 builds an object for every precinct of every band and one for every code-block, and
 * two tag trees per precinct, before a packet byte is read: a codestream of about 170 bytes with 2 x 2 precincts cost
 * 629 MB at SIZ 500, 2 GB at 1000 and 7.7 GB at 2000. They are counted from the headers, in closed form per band, and
 * judged against the table's retained-objects bound before the first is built (the bound is the table's: 250,000,
 * proposed, BOB confirming for JPX). */
const PIXELS_MAX = boundOf("image", "pixels");
const EDGE_MAX = boundOf("image", "edge");
/* the two rows BOB ruled for this module (K4858): `image.working_set` and `image.retained_objects`. Until runtime-limits has added them
 * the same figures are read from the rows that hold them today, `ocr.frame_bytes` and `office.retained_objects`; the guard needs no
 * edit when the rows land. */
const WORKING_ROW = Object.hasOwn(READ_BOUNDS.image, "working_set") ? ["image", "working_set"] : ["ocr", "frame_bytes"];
const OBJECTS_ROW = Object.hasOwn(READ_BOUNDS.image, "retained_objects") ? ["image", "retained_objects"] : ["office", "retained_objects"];
const WORKING_SET_MAX = boundOf(...WORKING_ROW);
const OBJECTS_MAX = boundOf(...OBJECTS_ROW);
const tooLarge = (kind, name, size, note, extra) => new JpxRefusal("IMAGE_TOO_LARGE", { note, bound_name: name, ...statement(kind, name, size), ...extra });

/** What decoding this codestream must hold at once, from its headers alone:
 *  the 8-bit output, and the buffers the tiles share (`Pool`), each slot as
 *  large as the largest tile asks of it. */
function workingSet(cs, nTiles) {
  const { siz } = cs;
  const slots = [];
  for (const [no, t] of cs.tiles) {
    if (no >= nTiles) continue;
    tileSlots(tileLayout(cs, t, no)).forEach((n, i) => { slots[i] = Math.max(slots[i] ?? 0, n); });
  }
  return (siz.X - siz.XO) * (siz.Y - siz.YO) * siz.comps.length + slots.reduce((a, n) => a + n, 0);
}

/** The objects tier 2 would build for the tiles present, counted from the headers alone: per band, one per precinct and one
 *  per code-block; per tile, one, and one entry of the packet order for every layer of every precinct of every component
 *  and resolution (`packetOrder` lists them all before a packet byte is read). Stops at the bound, so a hostile count is
 *  not summed past it. */
function retainedObjects(cs, nTiles) {
  let n = 0;
  for (const [no, t] of cs.tiles) {
    if (no >= nTiles) continue;
    n++;
    let precincts = 0;
    const { tc, cod } = tileLayout(cs, t, no);
    for (const x of tc) for (const R0 of x.res) {
      precincts += R0.npw * R0.nph;
      for (const B of R0.bands) {
        const bw = Math.max(0, B.x1 - B.x0), bh = Math.max(0, B.y1 - B.y0);
        n += R0.npw * R0.nph + ceilDiv(bw, 2 ** B.xcb) * ceilDiv(bh, 2 ** B.ycb);
      }
      if (n > OBJECTS_MAX) return n;
    }
    n += cod.layers * precincts;
    if (n > OBJECTS_MAX) return n;
  }
  return n;
}

const f32 = Math.fround;

/* ── the container ────────────────────────────────────────────────────────── */

function boxes(d, p, end) {
  const out = [];
  while (p + 8 <= end) {
    let len = ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0;
    const type = String.fromCharCode(d[p + 4], d[p + 5], d[p + 6], d[p + 7]);
    let hdr = 8;
    if (len === 1) {
      if (p + 16 > end) throw truncated("a JP2 box's extended length");
      len = (((d[p + 8] << 24) | (d[p + 9] << 16) | (d[p + 10] << 8) | d[p + 11]) >>> 0) * 2 ** 32
        + (((d[p + 12] << 24) | (d[p + 13] << 16) | (d[p + 14] << 8) | d[p + 15]) >>> 0);
      hdr = 16;
    } else if (len === 0) len = end - p;
    if (len < hdr || p + len > end) throw truncated(localize("image-codecs.jpxdecode.the_jp2_box_type_runs", "the JP2 box '{type}' runs past the data", { type: String(type) }));
    out.push({ type, start: p + hdr, end: p + len });
    p += len;
  }
  return out;
}

/** The codestream's range, and what the JP2 header says about colour. */
function container(d) {
  if (d.length >= 2 && d[0] === 0xff && d[1] === 0x4f) return { cs: [0, d.length], colour: null, jp2: false };
  if (d.length < 12 || !(d[4] === 0x6a && d[5] === 0x50 && d[6] === 0x20 && d[7] === 0x20))
    throw corrupt("neither a JPEG 2000 codestream (SOC) nor a JP2 file (signature box)");
  let colour = null, cs = null, palette = false;
  for (const b of boxes(d, 0, d.length)) {
    if (b.type === "jp2c") { cs = [b.start, b.end]; break; }
    if (b.type === "jp2h") {
      for (const h of boxes(d, b.start, b.end)) {
        if (h.type === "pclr") palette = true;
        if (h.type === "colr" && !colour) {
          const meth = d[h.start];
          colour = meth === 1
            ? { method: "enumerated", enumCs: ((d[h.start + 3] << 24) | (d[h.start + 4] << 16) | (d[h.start + 5] << 8) | d[h.start + 6]) >>> 0 }
            : { method: meth === 2 ? "icc" : `method ${meth}` };
        }
      }
    }
  }
  if (!cs) throw truncated(localize("image-codecs.jpxdecode.the_jp2_file_holds_no", "the JP2 file holds no codestream (jp2c box)"));
  if (palette) throw unsupported("a JP2 palette");
  if (colour && colour.method === "enumerated" && colour.enumCs === 18) throw unsupported("sYCC colour");
  return { cs, colour, jp2: true };
}

/* ── the codestream's marker segments ─────────────────────────────────────── */

class R {
  constructor(d, p, end) { this.d = d; this.p = p; this.end = end; }
  need(n, what) { if (this.p + n > this.end) throw truncated(localize("image-codecs.jpxdecode.what_runs_past_the_codestream", "{what} runs past the codestream", { what: String(what) })); }
  u8(w = "a field") { this.need(1, w); return this.d[this.p++]; }
  u16(w = "a field") { this.need(2, w); const v = (this.d[this.p] << 8) | this.d[this.p + 1]; this.p += 2; return v; }
  u32(w = "a field") { this.need(4, w); const d = this.d, p = this.p; this.p += 4; return ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0; }
}

function readSiz(r, len) {
  const end = r.p + len - 2;
  const rsiz = r.u16("Rsiz");
  const s = { rsiz, X: r.u32(), Y: r.u32(), XO: r.u32(), YO: r.u32(), XT: r.u32(), YT: r.u32(), XTO: r.u32(), YTO: r.u32() };
  const n = r.u16("Csiz");
  s.comps = [];
  for (let i = 0; i < n; i++) {
    const ssiz = r.u8("Ssiz");
    s.comps.push({ prec: (ssiz & 0x7f) + 1, sgnd: ssiz >> 7, dx: r.u8("XRsiz"), dy: r.u8("YRsiz") });
  }
  r.p = end;
  if (!s.XT || !s.YT || s.X <= s.XO || s.Y <= s.YO || s.XTO > s.XO || s.YTO > s.YO || s.XTO + s.XT <= s.XO || s.YTO + s.YT <= s.YO)
    throw corrupt(localize("image-codecs.jpxdecode.an_image_and_tile_geometry", "an image and tile geometry the standard does not allow"));
  if (rsiz & 0x4000) throw unsupported("high-throughput coding");
  if (rsiz & 0x8000) throw unsupported("an extended capability", { rsiz });
  return s;
}

/** SPcod/SPcoc: the component's coding parameters. */
function readSpcod(r, precincts) {
  const c = { nl: r.u8("decomposition levels"), xcb: (r.u8("code-block width") & 0xf) + 2, ycb: (r.u8("code-block height") & 0xf) + 2,
              cblksty: r.u8("code-block style"), qmfbid: r.u8("the wavelet") };
  if (c.nl > 32) throw corrupt(`${c.nl} decomposition levels`);
  if (c.xcb + c.ycb > 12 || c.xcb > 10 || c.ycb > 10) throw corrupt(localize("image-codecs.jpxdecode.a_code_block_larger_than", "a code-block larger than 4096 samples"));
  if (c.cblksty & 0x40) throw unsupported("high-throughput coding");
  c.prc = [];
  for (let i = 0; i <= c.nl; i++) {
    if (precincts) { const b = r.u8("a precinct size"); c.prc.push([b & 0xf, b >> 4]); }
    else c.prc.push([15, 15]);
  }
  return c;
}

function readQcd(r, len) {
  const end = r.p + len;
  const s = r.u8("Sqcd");
  const style = s & 0x1f, guard = s >> 5;
  const steps = [];
  if (style === 0) while (r.p < end) steps.push({ expn: r.u8("an exponent") >> 3, mant: 0 });
  else while (r.p + 1 < end) { const v = r.u16("a step size"); steps.push({ expn: v >> 11, mant: v & 0x7ff }); }
  r.p = end;
  if (style > 2 || !steps.length) throw corrupt(`quantisation style ${style}`);
  return { style, guard, steps };
}

/**
 * Parse the whole codestream: the main header, and every tile-part's header
 * and data, gathered per tile.
 */
function parseCodestream(d, start, end) {
  const r = new R(d, start, end);
  if (r.u16("SOC") !== 0xff4f) throw corrupt("no SOC marker");
  const main = { cod: null, coc: [], qcd: null, qcc: [], rgn: [], poc: null };
  let siz = null;
  const tiles = new Map();
  const readSeg = (h, m, len) => {
    const segEnd = r.p + len - 2;
    const wide = siz && siz.comps.length > 256;
    const comp = () => (wide ? r.u16("a component index") : r.u8("a component index"));
    switch (m) {
      case 0xff52: {
        const scod = r.u8("Scod");
        h.cod = { scod, prog: r.u8("the progression order"), layers: r.u16("the layer count"), mct: r.u8("the colour transform"),
                  sp: readSpcod(r, scod & 1) };
        break;
      }
      case 0xff53: { const c = comp(); const s = r.u8("Scoc"); h.coc[c] = readSpcod(r, s & 1); break; }
      case 0xff5c: h.qcd = readQcd(r, len - 2); break;
      case 0xff5d: { const c = comp(); h.qcc[c] = readQcd(r, segEnd - r.p); break; }
      case 0xff5e: { const c = comp(); r.u8("Srgn"); h.rgn[c] = r.u8("the ROI shift"); break; }
      case 0xff5f: {
        const list = [];
        while (r.p < segEnd) list.push({ rs: r.u8(), cs: comp(), lye: r.u16(), re: r.u8(), ce: wide ? r.u16() : r.u8() || 256, prog: r.u8() });
        h.poc = (h.poc || []).concat(list);
        break;
      }
      case 0xff60: case 0xff61: throw unsupported("packed packet headers", { marker: m === 0xff60 ? "PPM" : "PPT" });
      case 0xff50: throw unsupported("an extended capability", { marker: "CAP" });
      default: break;                                   // TLM, PLM, PLT, CRG, COM, CPF: not needed
    }
    r.p = segEnd;
  };
  /* The main header. */
  for (;;) {
    const m = r.u16("a main-header marker");
    if (m === 0xff90) { r.p -= 2; break; }
    if (m === 0xffd9) throw truncated(localize("image-codecs.jpxdecode.the_codestream_ends_before_any", "the codestream ends before any tile"));
    if ((m & 0xff00) !== 0xff00) throw corrupt("a main-header marker expected");
    const len = r.u16("a marker segment length");
    if (len < 2) throw corrupt(localize("image-codecs.jpxdecode.a_marker_segment_length_under", "a marker segment length under 2"));
    r.need(len - 2, "a marker segment");
    if (m === 0xff51) { siz = readSiz(r, len); continue; }
    if (!siz) throw corrupt("a marker before SIZ");
    readSeg(main, m, len);
  }
  if (!siz || !main.cod || !main.qcd) throw corrupt("the main header lacks SIZ, COD or QCD");
  /* The tile-parts. */
  while (r.p + 2 <= end) {
    const m = r.u16("a tile-part marker");
    if (m === 0xffd9) break;
    if (m !== 0xff90) throw corrupt(localize("image-codecs.jpxdecode.marker_0x_m_where_sot", "marker 0x{m} where SOT was expected", { m: String(m.toString(16)) }));
    const sotAt = r.p - 2;
    r.u16("Lsot");
    const isot = r.u16("Isot"), psot = r.u32("Psot");
    r.u8("TPsot"); r.u8("TNsot");
    const tpEnd = psot ? sotAt + psot : end;
    if (tpEnd > end) throw truncated(localize("image-codecs.jpxdecode.tile_part_of_tile_isot", "tile-part of tile {isot} runs past the codestream", { isot: String(isot) }));
    let t = tiles.get(isot);
    const first = !t;
    if (!t) { t = { index: isot, cod: null, coc: [], qcd: null, qcc: [], rgn: [], poc: null, data: [] }; tiles.set(isot, t); }
    for (;;) {
      const mm = r.u16("a tile-part header marker");
      if (mm === 0xff93) break;
      const len = r.u16("a marker segment length");
      r.need(len - 2, "a marker segment");
      if (!first && mm !== 0xff61) { r.p += len - 2; continue; }   // a later tile-part may carry PPT (refused) and PLT/COM
      readSeg(t, mm, len);
    }
    t.data.push(d.subarray(r.p, Math.min(tpEnd, end)));
    r.p = tpEnd;
  }
  return { siz, main, tiles };
}

/* ── geometry ─────────────────────────────────────────────────────────────── */

const ceilDiv = (a, b) => Math.ceil(a / b);
const floorLog2 = (v) => 31 - Math.clz32(v);

/** A tag tree over w×h leaves (B.10.2). */
class TagTree {
  constructor(w, h) {
    this.levels = [];
    do {
      this.levels.push({ w, h, value: new Int32Array(w * h).fill(0x7fffffff), low: new Int32Array(w * h) });
      if (w === 1 && h === 1) break;
      w = ceilDiv(w, 2); h = ceilDiv(h, 2);
    } while (true);   // eslint-disable-line no-constant-condition
  }
  /** Decode leaf (x, y) against `threshold`: true when its value is below it. */
  decode(bio, x, y, threshold) {
    const path = [];
    for (let l = 0; l < this.levels.length; l++) { path.push(y * this.levels[l].w + x); x >>= 1; y >>= 1; }
    let low = 0;
    for (let l = this.levels.length - 1; l >= 0; l--) {
      const lv = this.levels[l], i = path[l];
      if (low > lv.low[i]) lv.low[i] = low; else low = lv.low[i];
      while (low < threshold && low < lv.value[i]) {
        if (bio.bit()) lv.value[i] = low; else low++;
      }
      lv.low[i] = low;
    }
    return this.levels[0].value[path[0]] < threshold;
  }
  value(x, y) { return this.levels[0].value[y * this.levels[0].w + x]; }
}

/** The packet-header bit reader (B.10.1): after a 0xFF byte, the next byte
 *  carries 7 bits. */
class Bio {
  constructor(d, p, end) { this.d = d; this.p = p; this.end = end; this.buf = 0; this.ct = 0; }
  byteIn() {
    this.buf = (this.buf << 8) & 0xffff;
    this.ct = this.buf === 0xff00 ? 7 : 8;
    if (this.p < this.end) this.buf |= this.d[this.p++];
    else { this.p++; this.over = true; }
  }
  bit() {
    if (this.ct === 0) this.byteIn();
    this.ct--;
    return (this.buf >> this.ct) & 1;
  }
  bits(n) { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | this.bit(); return v; }
  /** Byte-align after a header: a final 0xFF is followed by a stuffed byte. */
  align() { if ((this.buf & 0xff) === 0xff) this.byteIn(); this.ct = 0; }
}

/* ── tier 1: EBCOT (Annex D), as OpenJPEG decodes it ──────────────────────── */

/* Neighbour flag bits, per coefficient: significance of the 8 neighbours,
 * the sign of the 4 direct ones, and the coefficient's own state. */
const N = 1, S = 2, W = 4, E = 8, NW = 16, NE = 32, SW = 64, SE = 128;
const SGN_N = 256, SGN_S = 512, SGN_W = 1024, SGN_E = 2048;
const SIG = 4096, NEG = 8192, REFINED = 16384, VISIT = 32768;
const NBR = 255;

/* ZC contexts per band (0 LL, 1 HL, 2 LH, 3 HH): Table D.1, whose columns
 * swap the horizontal and vertical counts for HL, the horizontally high-pass band. */
const ZC = [0, 1, 2, 3].map((orient) => Uint8Array.from({ length: 256 }, (_, f) => {
  let h = ((f & W) !== 0) + ((f & E) !== 0), v = ((f & N) !== 0) + ((f & S) !== 0);
  const d = ((f & NW) !== 0) + ((f & NE) !== 0) + ((f & SW) !== 0) + ((f & SE) !== 0);
  if (orient === 1) [h, v] = [v, h];
  if (orient === 3) {
    const hv = h + v;
    if (!d) return hv === 0 ? 0 : hv === 1 ? 1 : 2;
    if (d === 1) return hv === 0 ? 3 : hv === 1 ? 4 : 5;
    if (d === 2) return hv === 0 ? 6 : 7;
    return 8;
  }
  if (!h) return !v ? (!d ? 0 : d === 1 ? 1 : 2) : v === 1 ? 3 : 4;
  if (h === 1) return !v ? (!d ? 5 : 6) : 7;
  return 8;
}));
/* Sign context and prediction bit, from the 4 direct neighbours' significance
 * and signs (Table D.3). Index: N,S,W,E significance (4 bits) | signs << 4. */
const SC = new Uint8Array(256), SPB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const sig = (b) => (i >> b) & 1, neg = (b) => (i >> (4 + b)) & 1;
  const pos = (b) => sig(b) && !neg(b), ng = (b) => sig(b) && neg(b);
  const hc = Math.min(pos(2) + pos(3), 1) - Math.min(ng(2) + ng(3), 1);
  const vc0 = Math.min(pos(0) + pos(1), 1) - Math.min(ng(0) + ng(1), 1);
  SPB[i] = !hc && !vc0 ? 0 : (!(hc > 0 || (!hc && vc0 > 0)) ? 1 : 0);
  let h = hc, v = vc0;
  if (h < 0) { h = -h; v = -v; }
  SC[i] = !h ? (v ? 1 : 0) : (v === -1 ? 2 : v === 0 ? 3 : 4);
}
const CTX_SC = 9, CTX_MAG = 14, CTX_AGG = 17, CTX_UNI = 18;

class RawDecoder {
  constructor(d, p, end) { this.d = d; this.bp = p; this.end = end; this.c = 0; this.ct = 0; }
  bit() {
    if (this.ct === 0) {
      const next = this.bp < this.end ? this.d[this.bp] : 0xff;
      if (this.c === 0xff) {
        if (next > 0x8f) { this.c = 0xff; this.ct = 8; }
        else { this.c = next; this.bp++; this.ct = 7; }
      } else { this.c = next; this.bp++; this.ct = 8; }
    }
    this.ct--;
    return (this.c >> this.ct) & 1;
  }
}

/**
 * Decode one code-block's passes into `out` (w×h, doubled units, signed).
 * `segs` are the codeword segments `[{data, passes}]` in order.
 */
function decodeCodeBlock(w, h, orient, numbps, lazyFrom, cblksty, segs, out, scratch) {
  const fw = w + 2;
  /* The flags live in the decode's one scratch array (a code-block is at most
   * 4096 samples, so (w+2)(h+2) <= 1026*6), cleared for each block: a fresh
   * array per block was garbage enough to add a fifth to a page's peak. */
  const flags = scratch.subarray(0, fw * (h + 2));
  flags.fill(0);
  const ctx = mqContexts(19);
  const resetCtx = () => { ctx.fill(0); ctx[CTX_UNI] = 46 << 1; ctx[CTX_AGG] = 3 << 1; ctx[0] = 4 << 1; };
  resetCtx();
  const zc = ZC[orient];
  const vsc = cblksty & 8, lazy = cblksty & 1, reset = cblksty & 2, segsym = cblksty & 32;
  let bpno = numbps;                  // "bpno_plus_one"
  let passtype = 2;
  const at = (x, y) => (y + 1) * fw + x + 1;
  const setSig = (x, y, neg) => {
    const i = at(x, y);
    flags[i] |= SIG | (neg ? NEG : 0);
    flags[i - fw] |= S | (neg ? SGN_S : 0);           // for the neighbour above, this is its south
    flags[i + fw] |= N | (neg ? SGN_N : 0);
    flags[i - 1] |= E | (neg ? SGN_E : 0);
    flags[i + 1] |= W | (neg ? SGN_W : 0);
    flags[i - fw - 1] |= SE; flags[i - fw + 1] |= SW;
    flags[i + fw - 1] |= NE; flags[i + fw + 1] |= NW;
  };
  /* The neighbourhood as the coefficient sees it: under vertical causality a
   * stripe's last row does not see the stripe below. */
  const nbr = (f, y) => (vsc && (y & 3) === 3 ? f & ~(S | SW | SE | SGN_S) : f);
  const scIndex = (f) => ((f & N) ? 1 : 0) | ((f & S) ? 2 : 0) | ((f & W) ? 4 : 0) | ((f & E) ? 8 : 0)
    | ((f & SGN_N) ? 16 : 0) | ((f & SGN_S) ? 32 : 0) | ((f & SGN_W) ? 64 : 0) | ((f & SGN_E) ? 128 : 0);

  for (const seg of segs) {
    /* OpenJPEG compares against the block's bit-planes WITHOUT the ROI shift. */
    const raw = lazy && bpno <= lazyFrom - 4 && passtype < 2;
    const mq = raw ? null : new MqDecoder(seg.data, 0, seg.data.length);
    const rd = raw ? new RawDecoder(seg.data, 0, seg.data.length) : null;
    for (let pass = 0; pass < seg.passes && bpno >= 1; pass++) {
      const one = 1 << bpno, half = one >> 1, oneplushalf = one | half;
      if (passtype === 0) {
        /* significance propagation */
        for (let y0 = 0; y0 < h; y0 += 4) for (let x = 0; x < w; x++) for (let y = y0; y < y0 + 4 && y < h; y++) {
          const i = at(x, y), f = nbr(flags[i], y);
          if ((f & SIG) || !(f & NBR)) continue;
          const bit = raw ? rd.bit() : mq.decode(ctx, zc[f & NBR]);
          if (bit) {
            let neg;
            if (raw) neg = rd.bit();
            else { const k = scIndex(f); neg = mq.decode(ctx, CTX_SC + SC[k]) ^ SPB[k]; }
            out[y * w + x] = neg ? -oneplushalf : oneplushalf;
            setSig(x, y, neg);
          }
          flags[i] |= VISIT;
        }
      } else if (passtype === 1) {
        /* magnitude refinement */
        for (let y0 = 0; y0 < h; y0 += 4) for (let x = 0; x < w; x++) for (let y = y0; y < y0 + 4 && y < h; y++) {
          const i = at(x, y), f = flags[i];
          if ((f & (SIG | VISIT)) !== SIG) continue;
          const bit = raw ? rd.bit()
            : mq.decode(ctx, (f & REFINED) ? CTX_MAG + 2 : (nbr(f, y) & NBR) ? CTX_MAG + 1 : CTX_MAG);
          const v = out[y * w + x];
          out[y * w + x] = v + ((bit ^ (v < 0 ? 1 : 0)) ? half : -half);
          flags[i] |= REFINED;
        }
      } else {
        /* cleanup, with run-length coding of all-quiet stripe columns */
        for (let y0 = 0; y0 < h; y0 += 4) for (let x = 0; x < w; x++) {
          let y = y0;
          if (y0 + 4 <= h) {
            let quiet = true;
            for (let k = 0; k < 4 && quiet; k++) {
              const f = nbr(flags[at(x, y0 + k)], y0 + k);
              if (f & (SIG | VISIT | NBR)) quiet = false;
            }
            if (quiet) {
              if (!mq.decode(ctx, CTX_AGG)) continue;
              const k = (mq.decode(ctx, CTX_UNI) << 1) | mq.decode(ctx, CTX_UNI);
              y = y0 + k;
              const f = nbr(flags[at(x, y)], y);
              const sk = scIndex(f);
              const neg = mq.decode(ctx, CTX_SC + SC[sk]) ^ SPB[sk];
              out[y * w + x] = neg ? -oneplushalf : oneplushalf;
              setSig(x, y, neg);
              y++;
            }
          }
          for (; y < y0 + 4 && y < h; y++) {
            const i = at(x, y), f = nbr(flags[i], y);
            if (f & (SIG | VISIT)) continue;
            if (mq.decode(ctx, zc[f & NBR])) {
              const sk = scIndex(f);
              const neg = mq.decode(ctx, CTX_SC + SC[sk]) ^ SPB[sk];
              out[y * w + x] = neg ? -oneplushalf : oneplushalf;
              setSig(x, y, neg);
            }
          }
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) flags[at(x, y)] &= ~VISIT;
        /* the segmentation symbol, 1010 when intact: OpenJPEG decodes it and
         * does not act on it, so neither does this */
        if (segsym) for (let k = 0; k < 4; k++) mq.decode(ctx, CTX_UNI);
      }
      if (reset && !raw) resetCtx();
      if (++passtype === 3) { passtype = 0; bpno--; }
    }
  }
}

/* ── wavelets (Annex F), and OpenJPEG's float 9/7 ─────────────────────────── */

const K = f32(1.230174105), TWO_INVK = f32(1.625732422);
const ALPHA = f32(-1.586134342), BETA = f32(-0.052980118), GAMMA = f32(0.882911075), DELTA = f32(0.443506852);

/** One 5/3 synthesis over `x` (interleaved in place), `cas` the parity of the
 *  first sample (1 = it is a high-pass one). F.3.8.2, as OpenJPEG. */
function idwt53(x, n, cas) {
  if (n === 1) { if (cas) x[0] = Math.trunc(x[0] / 2); return; }
  const at = (i) => x[i < 0 ? -i : i >= n ? 2 * (n - 1) - i : i];     // symmetric extension
  for (let i = cas ? 1 : 0; i < n; i += 2) x[i] -= Math.floor((at(i - 1) + at(i + 1) + 2) / 4);
  for (let i = cas ? 0 : 1; i < n; i += 2) x[i] += Math.floor((at(i - 1) + at(i + 1)) / 2);
}

/** One 9/7 synthesis, `opj_v8dwt_decode` exactly. `x` is a Float32Array. */
function idwt97(x, n, cas) {
  const sn = cas ? n >> 1 : (n + 1) >> 1, dn = n - sn;
  if (cas === 0) { if (!(dn > 0 || sn > 1)) return; }
  else if (!(sn > 0 || dn > 1)) return;
  const a = cas, b = 1 - cas;
  for (let i = 0; i < sn; i++) x[a + 2 * i] = f32(x[a + 2 * i] * K);
  for (let i = 0; i < dn; i++) x[b + 2 * i] = f32(x[b + 2 * i] * TWO_INVK);
  step97(x, b, a + 1, sn, Math.min(sn, dn - a), f32(-DELTA));
  step97(x, a, b + 1, dn, Math.min(dn, sn - b), f32(-GAMMA));
  step97(x, b, a + 1, sn, Math.min(sn, dn - a), f32(-BETA));
  step97(x, a, b + 1, dn, Math.min(dn, sn - b), f32(-ALPHA));
}
function step97(x, l, w, end, m, c) {
  const imax = Math.min(end, m);
  let fl = l, fw = w;
  for (let i = 0; i < imax; i++) {
    x[fw - 1] = f32(x[fw - 1] + f32(f32(x[fl] + x[fw]) * c));
    fl = fw; fw += 2;
  }
  if (m < end) x[fw - 1] = f32(x[fw - 1] + f32(x[fl] * f32(c + c)));
}

/* ── the tile ─────────────────────────────────────────────────────────────── */

/** The progression's packets, in order, as [layer, res, comp, precinct]. */
function packetOrder(tc, layers, progs, tile, comps) {
  const out = [], seen = new Set();
  const push = (l, r, c, p) => { const k = `${l}.${r}.${c}.${p}`; if (!seen.has(k)) { seen.add(k); out.push([l, r, c, p]); } };
  for (const pg of progs) {
    const LYE = Math.min(pg.lye, layers), RE = pg.re, CE = Math.min(pg.ce, comps.length);
    const cs = [], rs = [];
    for (let c = pg.cs; c < CE; c++) cs.push(c);
    for (let r = pg.rs; r < RE; r++) rs.push(r);
    const has = (c, r) => r < tc[c].res.length;
    if (pg.prog === 0 || pg.prog === 1) {
      for (const o1 of pg.prog === 0 ? [...Array(LYE).keys()] : rs)
        for (const o2 of pg.prog === 0 ? rs : [...Array(LYE).keys()])
          for (const c of cs) {
            const [l, r] = pg.prog === 0 ? [o1, o2] : [o2, o1];
            if (!has(c, r)) continue;
            const res = tc[c].res[r];
            for (let p = 0; p < res.npw * res.nph; p++) push(l, r, c, p);
          }
      continue;
    }
    /* Position-driven orders: each precinct is met at the first reference-grid
     * position whose conditions (B.12.1.3) it satisfies — its top-left corner,
     * or the tile's own corner for a precinct the tile's edge cuts. */
    const items = [];
    for (const c of cs) for (const r of rs) {
      if (!has(c, r)) continue;
      const res = tc[c].res[r], n = tc[c].nl - r, cp = comps[c];
      for (let py = 0; py < res.nph; py++) for (let px = 0; px < res.npw; px++) {
        const gx = (res.pgx + px) << res.ppx, gy = (res.pgy + py) << res.ppy;
        const X = gx <= res.x0 ? (((res.x0 << n) * cp.dx) % ((cp.dx << (res.ppx + n))) === 0 ? res.x0 * cp.dx << n : tile.x0) : (gx * cp.dx) << n;
        const Y = gy <= res.y0 ? (((res.y0 << n) * cp.dy) % ((cp.dy << (res.ppy + n))) === 0 ? res.y0 * cp.dy << n : tile.y0) : (gy * cp.dy) << n;
        items.push({ c, r, p: py * res.npw + px, X, Y });
      }
    }
    const key = { 2: (a) => [a.r, a.Y, a.X, a.c], 3: (a) => [a.Y, a.X, a.c, a.r], 4: (a) => [a.c, a.Y, a.X, a.r] }[pg.prog];
    if (!key) throw corrupt(`progression order ${pg.prog}`);
    items.sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; });
    for (const it of items) for (let l = 0; l < LYE; l++) push(l, it.r, it.c, it.p);
  }
  return out;
}

/**
 * A tile's geometry and coding parameters, per component: its resolutions,
 * their bands with quantisation and code-block size, and the precinct grid.
 * Nothing here is sized by the samples, so the working set can be read from it
 * before a decode allocates anything.
 */
function tileLayout(cs, t, tileNo) {
  const { siz, main } = cs;
  const cod = t.cod || main.cod;
  const nTx = ceilDiv(siz.X - siz.XTO, siz.XT);
  const p = tileNo % nTx, q = Math.floor(tileNo / nTx);
  const tile = { x0: Math.max(siz.XTO + p * siz.XT, siz.XO), y0: Math.max(siz.YTO + q * siz.YT, siz.YO),
                 x1: Math.min(siz.XTO + (p + 1) * siz.XT, siz.X), y1: Math.min(siz.YTO + (q + 1) * siz.YT, siz.Y) };
  const tc = siz.comps.map((cp, c) => {
    const sp = t.coc[c] || (t.cod ? t.cod.sp : null) || main.coc[c] || main.cod.sp;
    const qc = t.qcc[c] || t.qcd || main.qcc[c] || main.qcd;
    const roi = t.rgn[c] ?? main.rgn[c] ?? 0;
    const x0 = ceilDiv(tile.x0, cp.dx), y0 = ceilDiv(tile.y0, cp.dy), x1 = ceilDiv(tile.x1, cp.dx), y1 = ceilDiv(tile.y1, cp.dy);
    const res = [];
    for (let r = 0; r <= sp.nl; r++) {
      const sc = 2 ** (sp.nl - r);
      const R0 = { r, x0: ceilDiv(x0, sc), y0: ceilDiv(y0, sc), x1: ceilDiv(x1, sc), y1: ceilDiv(y1, sc) };
      const [ppx, ppy] = sp.prc[r];
      R0.ppx = ppx; R0.ppy = ppy;
      R0.pgx = Math.floor(R0.x0 / 2 ** ppx); R0.pgy = Math.floor(R0.y0 / 2 ** ppy);
      R0.npw = R0.x1 > R0.x0 ? ceilDiv(R0.x1, 2 ** ppx) - R0.pgx : 0;
      R0.nph = R0.y1 > R0.y0 ? ceilDiv(R0.y1, 2 ** ppy) - R0.pgy : 0;
      const bandSpecs = r === 0 ? [[0, 0, 0]] : [[1, 1, 0], [2, 0, 1], [3, 1, 1]];
      const nb = r === 0 ? sp.nl : sp.nl - r + 1;
      const xcb = Math.min(sp.xcb, r === 0 ? ppx : ppx - 1), ycb = Math.min(sp.ycb, r === 0 ? ppy : ppy - 1);
      R0.bands = bandSpecs.map(([bandno, xob, yob]) => {
        const s = 2 ** nb, hx = xob ? 2 ** (nb - 1) : 0, hy = yob ? 2 ** (nb - 1) : 0;
        const B = { bandno, x0: ceilDiv(x0 - hx, s), y0: ceilDiv(y0 - hy, s), x1: ceilDiv(x1 - hx, s), y1: ceilDiv(y1 - hy, s) };
        const bi = r === 0 ? 0 : 3 * (r - 1) + bandno;
        const st = qc.style === 1
          ? { expn: Math.max(0, qc.steps[0].expn - (r === 0 ? 0 : Math.floor((bi - 1) / 3))), mant: qc.steps[0].mant }
          : qc.steps[bi];
        if (!st) throw corrupt(localize("image-codecs.jpxdecode.no_quantisation_step_for_band", "no quantisation step for band {bi}", { bi: String(bi) }));
        B.numbps = st.expn + qc.guard - 1;
        const rb = cp.prec + (sp.qmfbid === 0 ? 0 : bandno === 0 ? 0 : bandno === 3 ? 2 : 1);
        B.stepsize = f32((1 + st.mant / 2048) * 2 ** (rb - st.expn));
        /* the band's precinct grid (the resolution's, halved for a detail band)
         * and its code-block size */
        B.bpx = r === 0 ? ppx : ppx - 1; B.bpy = r === 0 ? ppy : ppy - 1;
        B.xcb = xcb; B.ycb = ycb;
        return B;
      });
      res.push(R0);
    }
    return { x0, y0, x1, y1, nl: sp.nl, sp, qc, roi, res };
  });
  return { tile, cod, tc };
}

/** Each band's precincts, each holding its code-blocks and two tag trees. */
function addPrecincts(x) {
  for (const R0 of x.res) for (const B of R0.bands) {
    const { bpx, bpy, xcb, ycb } = B;
    B.prec = [];
    for (let py = 0; py < R0.nph; py++) for (let px = 0; px < R0.npw; px++) {
      const X0 = Math.max(B.x0, (R0.pgx + px) * 2 ** bpx), Y0 = Math.max(B.y0, (R0.pgy + py) * 2 ** bpy);
      const X1 = Math.min(B.x1, (R0.pgx + px + 1) * 2 ** bpx), Y1 = Math.min(B.y1, (R0.pgy + py + 1) * 2 ** bpy);
      const pr = { cblks: [], cw: 0, ch: 0 };
      if (X1 > X0 && Y1 > Y0) {
        const cx0 = Math.floor(X0 / 2 ** xcb), cy0 = Math.floor(Y0 / 2 ** ycb);
        pr.cw = ceilDiv(X1, 2 ** xcb) - cx0; pr.ch = ceilDiv(Y1, 2 ** ycb) - cy0;
        for (let j = 0; j < pr.ch; j++) for (let i = 0; i < pr.cw; i++) {
          pr.cblks.push({ x0: Math.max(X0, (cx0 + i) * 2 ** xcb), y0: Math.max(Y0, (cy0 + j) * 2 ** ycb),
                          x1: Math.min(X1, (cx0 + i + 1) * 2 ** xcb), y1: Math.min(Y1, (cy0 + j + 1) * 2 ** ycb),
                          included: false, numbps: 0, lblock: 3, segs: [], passes: 0 });
        }
        pr.incl = new TagTree(pr.cw, pr.ch);
        pr.imsb = new TagTree(pr.cw, pr.ch);
      }
      B.prec.push(pr);
    }
  }
}

/** A tile's layout with every code-block's codeword segments read from its
 *  packets (tier 2). No sample is decoded here. */
function decodeTile(cs, t, tileNo) {
  const comps = cs.siz.comps;
  const layout = tileLayout(cs, t, tileNo);
  const { tile, cod, tc } = layout;
  for (const x of tc) addPrecincts(x);

  /* Tier 2: every packet, in the progression's order. */
  const progs = (t.poc || cs.main.poc)
    ? (t.poc || cs.main.poc).map((pg) => ({ ...pg, re: Math.min(pg.re, 33) }))
    : [{ rs: 0, cs: 0, lye: cod.layers, re: 33, ce: comps.length, prog: cod.prog }];
  const packets = packetOrder(tc, cod.layers, progs, tile, comps);
  const body = concat(t.data);
  let bp = 0;
  const sop = cod.scod & 2, eph = cod.scod & 4;
  for (const [l, r, c, pi] of packets) {
    const res = tc[c].res[r];
    const sp = tc[c].sp;
    if (sop && bp + 6 <= body.length && body[bp] === 0xff && body[bp + 1] === 0x91) bp += 6;
    const bio = new Bio(body, bp, body.length);
    const contrib = [];
    if (bio.p >= body.length) throw truncated(localize("image-codecs.jpxdecode.the_tiles_packets_run_out", "the tile's packets run out at packet {v1} of {length}", { v1: String(packets.indexOf(packets.find((q) => q[0] === l && q[1] === r && q[2] === c && q[3] === pi)) + 1), length: String(packets.length) }));
    if (bio.bit()) {
      for (const B of res.bands) {
        const pr = B.prec[pi];
        for (let k = 0; k < pr.cblks.length; k++) {
          const cb = pr.cblks[k], cx = k % pr.cw, cy = Math.floor(k / pr.cw);
          let inc;
          if (!cb.included) inc = pr.incl.decode(bio, cx, cy, l + 1);
          else inc = bio.bit();
          if (!inc) continue;
          if (!cb.included) {
            let i = 0;
            while (!pr.imsb.decode(bio, cx, cy, i)) i++;
            cb.numbps = B.numbps + 1 - i;
            cb.included = true;
          }
          let np;
          if (!bio.bit()) np = 1;
          else if (!bio.bit()) np = 2;
          else { const v = bio.bits(2); if (v < 3) np = 3 + v; else { const v2 = bio.bits(5); np = v2 < 31 ? 6 + v2 : 37 + bio.bits(7); } }
          while (bio.bit()) cb.lblock++;
          /* the passes' lengths, one per codeword segment they reach (B.10.7) */
          let left = np;
          while (left > 0) {
            let seg = cb.segs[cb.segs.length - 1];
            if (!seg || seg.claimed >= seg.max) {
              const max = (sp.cblksty & 4) ? 1 : (sp.cblksty & 1) ? (!seg ? 10 : (seg.max === 1 || seg.max === 10) ? 2 : 1) : 109;
              seg = { max, passes: 0, claimed: 0, chunks: [] };
              cb.segs.push(seg);
            }
            const n = Math.min(left, seg.max - seg.claimed);
            seg.claimed += n;          // passes this and earlier headers gave the segment
            const len = bio.bits(cb.lblock + floorLog2(n));
            contrib.push({ seg, len, n });
            left -= n;
          }
        }
      }
    }
    bio.align();
    bp = bio.p;
    if (eph && bp + 2 <= body.length && body[bp] === 0xff && body[bp + 1] === 0x92) bp += 2;
    for (const k of contrib) {
      if (bp + k.len > body.length) throw truncated(localize("image-codecs.jpxdecode.a_packets_code_block_data", "a packet's code-block data runs past the tile ({v1} bytes)", { v1: String(bp + k.len - body.length) }));
      k.seg.chunks.push(body.subarray(bp, bp + k.len));
      k.seg.passes += k.n;
      bp += k.len;
    }
  }
  return layout;
}

/* ── tier 1 on demand, and the line-based inverse wavelet (N75) ───────────── */

/* THE LINE-BASED DECODE. A component is never held whole: its rows are pulled,
 * top to bottom, through every level of the inverse wavelet, and each level
 * pulls the rows it needs from the level below and from its three bands. A band
 * decodes its code-blocks one code-block row (2^ycb rows) at a time, as the
 * first row of that strip is asked for. Each level synthesises an input row
 * horizontally as it arrives (`idwt97`/`idwt53`, the same line as before), and
 * runs the vertical lifting over a window of rows: when row k arrives, lifting
 * step s is applied to row k - s if that row has the step's parity, so every
 * sample meets exactly the float32 operations, on exactly the same operands,
 * that `idwt97` applies to its column (the scale by K or 2/K first, then the
 * four steps; the edges' mirrored neighbour spelled as `step97` spells it). The
 * picture is therefore the whole-plane decode's, to the bit.
 *
 * A row source's `next()` answers an offset into its `buf`, valid until the
 * next call; nothing is allocated per row. Every buffer is taken from a `Pool`
 * in the same order for every tile, so a tiled image reuses them. */
const LIFT97 = [f32(-DELTA), f32(-GAMMA), f32(-BETA), f32(-ALPHA)];

/** Buffers reused from tile to tile: slot i is as large as the largest tile
 *  asks of it (`tileSlots` lists what a tile asks, in the same order). */
class Pool {
  constructor() { this.slots = []; this.i = 0; }
  take(T, n) {
    const i = this.i++;
    if (!this.slots[i] || this.slots[i].byteLength < n * 4) this.slots[i] = new ArrayBuffer(n * 4);
    return new T(this.slots[i], 0, n);
  }
}

/** The samples a band's strip holds: `w` by at most 2^ycb rows. */
const stripSize = (B) => (B.x1 - B.x0) * Math.max(0, Math.min(2 ** B.ycb, B.y1 - B.y0));

/** A band's dequantised samples, one row at a time, in order. */
class BandRows {
  constructor(x, B, irr, t1, pool) {
    this.x = x; this.B = B; this.irr = irr; this.t1 = t1;
    this.w = B.x1 - B.x0;
    this.g = 2 ** B.ycb; this.s0 = Math.floor(B.y0 / this.g);
    this.strips = new Map();                         // strip → its code-blocks
    for (const pr of B.prec) for (const cb of pr.cblks) {
      const s = Math.floor(cb.y0 / this.g) - this.s0;
      if (!this.strips.has(s)) this.strips.set(s, []);
      this.strips.get(s).push(cb);
    }
    this.buf = pool.take(irr ? Float32Array : Int32Array, stripSize(B));
    this.strip = -1; this.top = 0;
  }
  /** Band row y's offset in `buf`. */
  row(y) {
    const s = Math.floor((this.B.y0 + y) / this.g) - this.s0;
    if (s !== this.strip) this.load(s);
    return (y - this.top) * this.w;
  }
  /** Decode one strip's code-blocks into the buffer (dequantised, as before). */
  load(s) {
    const { x, B, irr, w, buf } = this;
    this.strip = s;
    this.top = Math.max(0, (this.s0 + s) * this.g - B.y0);
    buf.fill(0);
    const half = f32(0.5 * B.stepsize), tmp = this.t1.tmp;
    for (const cb of this.strips.get(s) || []) {
      const cw = cb.x1 - cb.x0, ch = cb.y1 - cb.y0;
      const segs = cb.segs.filter((sg) => sg.passes > 0).map((sg) => ({ data: concat(sg.chunks), passes: sg.passes }));
      cb.segs = null;                                // read once; its bytes can go
      if (!segs.length) continue;
      const bpn = x.roi + cb.numbps;
      if (bpn >= 31) throw corrupt(localize("image-codecs.jpxdecode.a_code_block_of_31", "a code-block of 31 or more bit-planes"));
      tmp.fill(0, 0, cw * ch);
      decodeCodeBlock(cw, ch, B.bandno, bpn, cb.numbps, x.sp.cblksty, segs, tmp, this.t1.flags);
      if (x.roi) {
        const th = 2 ** x.roi;
        for (let i = 0; i < cw * ch; i++) { const v = tmp[i], m = Math.abs(v); if (m >= th) tmp[i] = v < 0 ? -(m >> x.roi) : m >> x.roi; }
      }
      const bx = cb.x0 - B.x0, by = cb.y0 - B.y0 - this.top;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const v = tmp[j * cw + i];
        buf[(by + j) * w + bx + i] = irr ? f32(f32(v) * half) : Math.trunc(v / 2);
      }
    }
  }
}

/** Resolution 0: the LL band's rows as they are. */
class LowestRows {
  constructor(band) { this.band = band; this.buf = band.buf; this.y = 0; }
  next() { return this.band.row(this.y++); }
}

/** One level of the inverse wavelet, row by row (see "THE LINE-BASED DECODE"). */
class LevelRows {
  constructor(prev, [hl, lh, hh], R0, P, irr, pool) {
    Object.assign(this, { prev, hl, lh, hh, irr });
    this.rw = R0.x1 - R0.x0; this.rh = R0.y1 - R0.y0; this.sw = P.x1 - P.x0;
    this.casx = R0.x0 & 1; this.casy = R0.y0 & 1;
    this.S = irr ? 4 : 2;                            // lifting steps
    const T = irr ? Float32Array : Int32Array;
    this.line = pool.take(T, this.rw);
    /* a ring of S+3 rows: arrival k reads rows k-S-1 to k, and the row last
     * answered stays whole until its caller has read it */
    this.R = this.S + 3;
    this.buf = pool.take(T, this.R * this.rw);
    this.k = 0; this.m = 0; this.lo = 0; this.hi = 0;
  }
  next() {
    const m = this.m++;
    while (this.k <= m + this.S && this.k < this.rh + this.S) this.arrive();
    return (m % this.R) * this.rw;
  }
  arrive() {
    const k = this.k++, { rw, rh, sw, casx, casy, irr, S, R, buf, line } = this;
    if (k < rh) {
      /* input row k: a low-pass row (LL and HL) or a high-pass one (LH and HH),
       * synthesised horizontally */
      const low = (k & 1) === casy;
      const A = low ? this.prev : this.lh, B = low ? this.hl : this.hh;
      const ao = low ? this.prev.next() : this.lh.row(this.hi);
      const bo = low ? this.hl.row(this.lo++) : this.hh.row(this.hi++);
      const a = A.buf, b = B.buf;
      for (let i = 0; i < sw; i++) line[casx ? 2 * i + 1 : 2 * i] = a[ao + i];
      for (let i = 0; i < rw - sw; i++) line[casx ? 2 * i : 2 * i + 1] = b[bo + i];
      (irr ? idwt97 : idwt53)(line, rw, casx);
      const o = (k % R) * rw;
      if (rh === 1) {                                // a one-sample column: `idwt97` leaves it, `idwt53` halves a high-pass one
        if (!irr && casy) for (let i = 0; i < rw; i++) buf[o + i] = Math.trunc(line[i] / 2);
        else buf.set(line, o);
      } else if (irr) {
        const g = low ? K : TWO_INVK;
        for (let i = 0; i < rw; i++) buf[o + i] = f32(line[i] * g);
      } else buf.set(line, o);
    }
    if (rh < 2) return;
    for (let s = 1; s <= S; s++) {
      const j = k - s;
      if (j < 0 || j >= rh || (j & 1) !== (s & 1 ? casy : 1 - casy)) continue;
      const o = (j % R) * rw, up = j > 0 ? ((j - 1) % R) * rw : -1, dn = j + 1 < rh ? ((j + 1) % R) * rw : -1;
      if (irr) {
        const c = LIFT97[s - 1];
        if (up < 0) for (let i = 0; i < rw; i++) buf[o + i] = f32(buf[o + i] + f32(f32(buf[dn + i] + buf[dn + i]) * c));
        else if (dn < 0) { const c2 = f32(c + c); for (let i = 0; i < rw; i++) buf[o + i] = f32(buf[o + i] + f32(buf[up + i] * c2)); }
        else for (let i = 0; i < rw; i++) buf[o + i] = f32(buf[o + i] + f32(f32(buf[up + i] + buf[dn + i]) * c));
      } else {
        const u = up < 0 ? dn : up, d = dn < 0 ? up : dn;
        if (s === 1) for (let i = 0; i < rw; i++) buf[o + i] -= Math.floor((buf[u + i] + buf[d + i] + 2) / 4);
        else for (let i = 0; i < rw; i++) buf[o + i] += Math.floor((buf[u + i] + buf[d + i]) / 2);
      }
    }
  }
}

/** A component of a decoded tile (`decodeTile`), as a source of its rows. */
function componentRows(x, irr, t1, pool) {
  const band = (B) => new BandRows(x, B, irr, t1, pool);
  let src = new LowestRows(band(x.res[0].bands[0]));
  for (let r = 1; r < x.res.length; r++) src = new LevelRows(src, x.res[r].bands.map(band), x.res[r], x.res[r - 1], irr, pool);
  return src;
}

/** The pool slots a tile's decode takes, in bytes, in `componentRows`' order:
 *  per component, a strip of every band and each level's line and ring. */
function tileSlots({ tc }) {
  const out = [];
  for (const x of tc) {
    const S = x.sp.qmfbid === 0 ? 4 : 2;
    for (const R0 of x.res) {
      for (const B of R0.bands) out.push(4 * stripSize(B));
      if (R0.r) out.push(4 * (R0.x1 - R0.x0), 4 * (S + 3) * (R0.x1 - R0.x0));
    }
  }
  return out;
}

function concat(parts) {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** lrintf under the default rounding mode: to nearest, ties to even. */
function rintEven(v) {
  const f = Math.floor(v), d = v - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * Decode a `JPXDecode` stream (a JP2 file or a bare codestream). Returns
 * `{ width, height, comps, samples, detail }`: `samples` interleaved 8-bit,
 * one byte per component per pixel, rows top to bottom.
 */
export function decodeJpx(d) {
  const box = container(d);
  const cs = parseCodestream(d, box.cs[0], box.cs[1]);
  const { siz } = cs;
  const nc = siz.comps.length;
  if (nc !== 1 && nc !== 3) throw samples(localize("image-codecs.jpxdecode.nc_components_only_1_grey", "{nc} components; only 1 (grey) or 3 (colour) are decoded here", { nc: String(nc) }), { components: nc });
  for (const cp of siz.comps) {
    if (cp.dx !== 1 || cp.dy !== 1) throw samples("a sub-sampled component", { dx: cp.dx, dy: cp.dy });
    if (cp.sgnd) throw samples("signed samples");
    if (cp.prec !== 8) throw samples(localize("image-codecs.jpxdecode.prec_bit_samples_only_8", "{prec}-bit samples; only 8-bit are decoded here", { prec: String(cp.prec) }), { precision: cp.prec });
  }
  const W = siz.X - siz.XO, H = siz.Y - siz.YO;
  const nTiles = ceilDiv(siz.X - siz.XTO, siz.XT) * ceilDiv(siz.Y - siz.YTO, siz.YT);
  if (Math.max(W, H) > EDGE_MAX)
    throw tooLarge("image", "edge", Math.max(W, H), localize("image-codecs.jpxdecode.the_image_is_w_by_h", "the image is {W} by {H}, and the decoder reads an edge of at most {bound}", { W: String(W), H: String(H), bound: String(EDGE_MAX) }), { width: W, height: H, components: nc });
  if (W * H > PIXELS_MAX)
    throw tooLarge("image", "pixels", W * H, localize("image-codecs.jpxdecode.the_image_is_w_by_h_2", "the image is {W} by {H}, past the {bound} pixels the decoder reads", { W: String(W), H: String(H), bound: String(PIXELS_MAX) }), { width: W, height: H, components: nc });
  const need = workingSet(cs, nTiles);
  if (need > WORKING_SET_MAX)
    throw tooLarge(...WORKING_ROW, need, localize("image-codecs.jpxdecode.the_decode_would_hold_bytes_at", "the decode would hold {bytes} bytes at once, past the {bound} the memory bound allows: the 8-bit output, and beside it, at 4 bytes a sample, one code-block row of every band and a few rows of every level of the largest tile", { bytes: String(need), bound: String(WORKING_SET_MAX) }),
      { bound_name: "working_set", working_set_bytes: need, bound_bytes: WORKING_SET_MAX, width: W, height: H, components: nc });
  const objects = retainedObjects(cs, nTiles);
  if (objects > OBJECTS_MAX)
    throw tooLarge(...OBJECTS_ROW, objects, localize("image-codecs.jpxdecode.the_codestream_s_precincts_and_code", "the codestream's precincts and code-blocks would be {objects} objects, past the {bound} the decoder builds", { objects: String(objects), bound: String(OBJECTS_MAX) }), { bound_name: "objects", width: W, height: H, components: nc });
  if (cs.tiles.size < nTiles) throw truncated(localize("image-codecs.jpxdecode.size_of_ntiles_tiles_are", "{size} of {nTiles} tiles are present", { size: String(cs.tiles.size), nTiles: String(nTiles) }));
  let out = null;
  const t1 = { tmp: new Int32Array(4096), flags: new Uint16Array(1026 * 6) };
  const pool = new Pool();
  const shift = 1 << 7;
  const put = (v, irr) => {
    const s = irr ? (v > 2147483647 ? 255 : v < -2147483648 ? 0 : rintEven(v) + shift) : v + shift;
    return s < 0 ? 0 : s > 255 ? 255 : s;
  };
  let transform = null;
  for (const [no, t] of cs.tiles) {
    if (no >= nTiles) throw corrupt(`tile ${no} of ${nTiles}`);
    const { tile, cod, tc } = decodeTile(cs, t, no);
    out ??= new Uint8Array(W * H * nc);              // after the first tile's packets have been read
    const irreversible = tc.map((x) => x.sp.qmfbid === 0);
    transform ??= irreversible[0] ? "9/7" : "5/3";
    const mct = cod.mct && nc >= 3;
    if (mct && (irreversible[0] !== irreversible[1] || irreversible[1] !== irreversible[2])) throw corrupt(localize("image-codecs.jpxdecode.a_colour_transform_over_mixed", "a colour transform over mixed wavelets"));
    pool.i = 0;
    const src = tc.map((x, c) => componentRows(x, irreversible[c], t1, pool));
    const w = tile.x1 - tile.x0, h = tile.y1 - tile.y0;
    /* Row by row: the component transform (G.2, G.3), then rounding, level
     * shift and clamp, straight into the output. */
    const ro = new Array(nc);
    for (let j = 0; j < h; j++) {
      for (let c = 0; c < nc; c++) ro[c] = src[c].next();
      let o = ((tile.y0 - siz.YO + j) * W + (tile.x0 - siz.XO)) * nc;
      if (mct && irreversible[0]) {
        const [a, b, c] = src.map((s) => s.buf), [ao, bo, co] = ro;
        for (let i = 0; i < w; i++, o += 3) {
          const y = a[ao + i], u = b[bo + i], v = c[co + i];
          out[o] = put(f32(y + f32(v * f32(1.402))), true);
          out[o + 1] = put(f32(f32(y - f32(u * f32(0.34413))) - f32(v * f32(0.71414))), true);
          out[o + 2] = put(f32(y + f32(u * f32(1.772))), true);
        }
      } else if (mct) {
        const [a, b, c] = src.map((s) => s.buf), [ao, bo, co] = ro;
        for (let i = 0; i < w; i++, o += 3) {
          const y = a[ao + i], u = b[bo + i], v = c[co + i];
          const g = y - Math.floor((u + v) / 4);
          out[o] = put((v + g) | 0, false); out[o + 1] = put(g | 0, false); out[o + 2] = put((u + g) | 0, false);
        }
      } else {
        for (let c = 0; c < nc; c++) {
          const row = src[c].buf, rc = ro[c], irr = irreversible[c];
          for (let i = 0; i < w; i++) out[o + i * nc + c] = put(row[rc + i], irr);
        }
      }
    }
  }
  const cod = cs.main.cod;
  return { width: W, height: H, comps: nc, samples: out,
           detail: { container: box.jp2 ? "jp2" : "codestream", colour: box.colour, tiles: nTiles, layers: cod.layers,
                     levels: cod.sp.nl, transform, progression: ["LRCP", "RLCP", "RPCL", "PCRL", "CPRL"][cod.prog] ?? cod.prog,
                     colour_transform: !!cod.mct } };
}
