/* pngdecode.mjs — N853b: a PNG decoder (ISO/IEC 15948, W3C PNG second edition)
 * for a picture file a member sends, so `pdf-pixels` can turn a photographed
 * page into the pixels it renders (image-codecs R10).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT ANSWERS
 * ─────────────────────────────────────────────────────────────────────────────
 * 8-bit samples, interleaved, rows top to bottom: one component for a grey image
 * (colour types 0 and 4), three for every other (2, 3 and 6; a palette is
 * expanded). Every colour type at every depth the standard allows is read, with
 * every filter (0–4). A sample under 8 bits is scaled by bit replication (a
 * 2-bit 3 is 255), a 16-bit one is reduced to its high byte, and transparency
 * (an alpha channel, or a tRNS chunk: a palette's alphas, or the one grey or
 * colour value it names, compared at the image's own depth) is composited over
 * white. Gamma, colour profiles and every other ancillary chunk are not applied.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "CORRECT" MEANS HERE: THE SAME SAMPLES AS PILLOW, TO THE BIT
 * ─────────────────────────────────────────────────────────────────────────────
 * PNG is lossless, so the samples before compositing have one right answer. The
 * composite is Pillow's own integer arithmetic (`AlphaComposite.c`, 7 bits of
 * precision, its rounded division by 255, an alpha of 0 answered by the white
 * beneath), so an image with transparency is Pillow's `alpha_composite` over
 * opaque white, sample for sample. The suite checks every answer against
 * Pillow's decode of the same bytes over PngSuite, which shares no line with
 * this file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT REFUSES, BY NAME (PNG_REFUSES) — never a picture it guessed at
 * ─────────────────────────────────────────────────────────────────────────────
 * An interlaced (Adam7) image and a critical chunk the standard does not define.
 * A size the decoder will not allocate for (a frame past the pixel or edge bound,
 * past the memory bound, or a file of more chunks than the bound) is refused from
 * the header, before a sample is allocated: `IMAGE_TOO_LARGE`, final and never
 * retried, its `detail` the declared size, the bound and the sentence's key (R12).
 * Every error thrown is a `PngRefusal` carrying a code:
 *   NOT_A_PNG       the bytes do not begin with the PNG signature
 *   UNSUPPORTED     a feature this decoder does not decode, named in `feature`
 *   IMAGE_TOO_LARGE a size past a bound, named in `bound_name`
 *   TRUNCATED       the data ends before the picture does
 *   CORRUPT         the data contradicts itself or the standard
 *
 * The image data is inflated by the platform's `DecompressionStream("deflate")`
 * and unfiltered row by row as it arrives, so only the output and two rows are
 * ever held; a stream that inflates past the frame is stopped at once.
 */

import { localize } from "../../bio-plane/src/setup-words/index.mjs"
import { READ_BOUNDS, boundOf, statement } from "../../bio-plane/src/read-bounds.mjs"

export class PngRefusal extends Error {
  constructor(code, detail = {}) {
    super(`${code}${detail.feature ? `: ${detail.feature}` : detail.note ? `: ${detail.note}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}
const unsupported = (feature, extra = {}) => new PngRefusal("UNSUPPORTED", { feature, ...extra });
const corrupt = (note, extra = {}) => new PngRefusal("CORRUPT", { note, ...extra });
const truncated = (note, extra = {}) => new PngRefusal("TRUNCATED", { note, ...extra });

/** The old `feature` of the memory refusal, an identifier read by code. The refusal is `IMAGE_TOO_LARGE` now (R10, R12) and no
 *  longer a key of `PNG_REFUSES`; the name stays exported so `pdf-pixels`' import of it still loads until it maps the code. */
export const MEMORY_FEATURE = "image-past-memory-bound";

/** Every `feature` an UNSUPPORTED refusal can carry. */
export const PNG_REFUSES = Object.freeze({
  "interlaced": "the image is stored Adam7-interlaced (IHDR interlace method 1), whose seven passes are not reassembled here",
  "an unknown critical chunk": localize("image-codecs.pngdecode.a_chunk_the_decoder_must", "a chunk the decoder must understand to draw the image (its type's first letter upper-case) is not one the standard defines"),
});

/* THE BOUNDS (R12, fix round 9, G125a), all read from the table. The frame is judged by its pixels and its edge, the
 * file by its chunks, and the decode by its working set (N34, D-312), the same figure as the JPEG 2000 decoder's: the
 * largest working set measured to complete in a member's isolate (CPDF-15). A decode holds the 8-bit output and two
 * stored rows (the row being unfiltered and the one above it); the compressed input is the caller's, and the
 * inflater's window is a fixed 32 KB. A row's bytes cannot pass the table's row stride below the edge, so the stride
 * is not judged apart. */
const PIXELS_MAX = boundOf("image", "pixels");
const EDGE_MAX = boundOf("image", "edge");
const CHUNKS_MAX = boundOf("image", "chunks");
/* the working-set row BOB ruled for this module (K4858): `image.working_set`. Until runtime-limits has added it the same figure is
 * read from the row that holds it today, `ocr.frame_bytes`; the guard needs no edit when the row lands. */
const WORKING_ROW = Object.hasOwn(READ_BOUNDS.image, "working_set") ? ["image", "working_set"] : ["ocr", "frame_bytes"];
const WORKING_SET_MAX = boundOf(...WORKING_ROW);
const tooLarge = (kind, name, size, note, extra) => new PngRefusal("IMAGE_TOO_LARGE", { note, bound_name: name, ...statement(kind, name, size), ...extra });

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/* The depths each colour type allows (Table 11.1), and its channels. */
const DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/* CRC-32 (ISO 3309, the polynomial 0xEDB88320, reflected), over a chunk's type
 * and data. */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(d, start, end) {
  let c = -1;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const u32 = (d, p) => ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0;
const u16 = (d, p) => (d[p] << 8) | d[p + 1];
const KNOWN_CRITICAL = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
const USED_ANCILLARY = new Set(["tRNS"]);

/**
 * The chunks up to IEND: the header, the palette and transparency as they stand
 * before the image data, and the image data's pieces in order. Nothing is
 * copied. A chunk this decoder reads has its CRC checked; an ancillary chunk it
 * skips does not (the standard lets a decoder ignore one).
 */
function readChunks(d) {
  let p = 8, ihdr = null, plte = null, trns = null, ended = false, chunks = 0;
  const idat = [];
  while (!ended) {
    if (++chunks > CHUNKS_MAX) throw tooLarge("image", "chunks", chunks, localize("image-codecs.pngdecode.the_file_holds_more_than_chunks", "the file holds more than {bound} chunks", { bound: String(CHUNKS_MAX) }));
    if (p + 8 > d.length) throw truncated(localize("image-codecs.pngdecode.the_data_ends_at_byte", "the data ends at byte {p}, before an IEND chunk", { p: String(p) }));
    const len = u32(d, p);
    const type = String.fromCharCode(d[p + 4], d[p + 5], d[p + 6], d[p + 7]);
    if (!/^[A-Za-z]{4}$/.test(type)) throw corrupt(localize("image-codecs.pngdecode.a_chunk_type_that_is", "a chunk type that is not four letters at byte {p}", { p: String(p) }), { at: p });
    if (len > 0x7fffffff) throw corrupt(localize("image-codecs.pngdecode.the_type_chunk_declares_a", "the {type} chunk declares a length past 2^31 - 1", { type: String(type) }), { chunk: type });
    if (p + 12 + len > d.length) throw truncated(localize("image-codecs.pngdecode.the_type_chunk_at_byte", "the {type} chunk at byte {p} runs past the data", { type: String(type), p: String(p) }), { chunk: type });
    const start = p + 8, end = start + len;
    const critical = (d[p + 4] & 0x20) === 0;
    if (critical || USED_ANCILLARY.has(type)) {
      if (crc32(d, p + 4, end) !== u32(d, end)) throw corrupt(localize("image-codecs.pngdecode.the_type_chunks_crc_does", "the {type} chunk's CRC does not match its data", { type: String(type) }), { chunk: type, at: p });
    }
    if (critical && !KNOWN_CRITICAL.has(type)) throw unsupported("an unknown critical chunk", { chunk: type });
    if (!ihdr && type !== "IHDR") throw corrupt(localize("image-codecs.pngdecode.the_first_chunk_is_type", "the first chunk is {type}, not IHDR", { type: String(type) }), { chunk: type });
    switch (type) {
      case "IHDR":
        if (ihdr) throw corrupt("a second IHDR chunk");
        ihdr = readIhdr(d, start, len);
        break;
      case "PLTE":
        if (!idat.length) plte = d.subarray(start, end);
        break;
      case "tRNS":
        if (!idat.length) trns = d.subarray(start, end);
        break;
      case "IDAT":
        if (len) idat.push(d.subarray(start, end));
        else if (!idat.length) idat.empty = true;
        break;
      case "IEND":
        ended = true;
        break;
      default:
        break;
    }
    p = end + 4;
  }
  if (!idat.length) throw corrupt(idat.empty ? "the IDAT chunks hold no data" : "no IDAT chunk");
  return { ihdr, plte, trns, idat };
}

function readIhdr(d, p, len) {
  if (len !== 13) throw corrupt(localize("image-codecs.pngdecode.an_ihdr_of_len_bytes", "an IHDR of {len} bytes, not 13", { len: String(len) }));
  const h = { width: u32(d, p), height: u32(d, p + 4), depth: d[p + 8], colourType: d[p + 9],
              compression: d[p + 10], filter: d[p + 11], interlace: d[p + 12] };
  if (!h.width || !h.height || h.width > 0x7fffffff || h.height > 0x7fffffff)
    throw corrupt(`an image of ${h.width}x${h.height}`, { width: h.width, height: h.height });
  if (!(h.colourType in DEPTHS)) throw corrupt(`colour type ${h.colourType}`, { colour_type: h.colourType });
  if (!DEPTHS[h.colourType].includes(h.depth))
    throw corrupt(localize("image-codecs.pngdecode.bit_depth_depth_with_colour", "bit depth {depth} with colour type {colourType}", { depth: String(h.depth), colourType: String(h.colourType) }), { colour_type: h.colourType, bit_depth: h.depth });
  if (h.compression !== 0) throw corrupt(`compression method ${h.compression}`);
  if (h.filter !== 0) throw corrupt(`filter method ${h.filter}`);
  if (h.interlace > 1) throw corrupt(`interlace method ${h.interlace}`);
  return h;
}

/** Pillow's `alpha_composite` of one sample `c` at alpha `a` over opaque white
 *  (`AlphaComposite.c`: its coefficients reduce to a·128 and (255-a)·128 when
 *  the destination is opaque; SHIFTFORDIV255 is its division by 255). */
function overWhite(c, a) {
  if (a === 0) return 255;
  const t = (c * a + 255 * (255 - a)) * 128 + 16384;
  return (((t >> 8) + t) >> 8) >> 7;
}

/* The scale bit replication gives a sample of each depth under 8. */
const SCALE = { 1: 255, 2: 85, 4: 17, 8: 1 };

/**
 * Decode a PNG file. Returns a Promise of `{ width, height, comps, samples,
 * detail }`: `samples` interleaved 8-bit, `comps` 1 (grey) or 3, `detail` naming
 * the stored image (`colour_type`, `bit_depth`, `transparency`). Rejects with a
 * `PngRefusal`.
 */
export async function decodePng(bytes) {
  const d = bytes;
  if (!(d instanceof Uint8Array) || d.length < 8 || SIGNATURE.some((b, i) => d[i] !== b))
    throw new PngRefusal("NOT_A_PNG", { note: "the bytes do not begin with the PNG signature" });
  const { ihdr, plte, trns, idat } = readChunks(d);
  const { width: W, height: H, depth, colourType } = ihdr;
  if (ihdr.interlace === 1) throw unsupported("interlaced", { width: W, height: H });

  const ch = CHANNELS[colourType];
  const comps = colourType === 0 || colourType === 4 ? 1 : 3;
  if (Math.max(W, H) > EDGE_MAX)
    throw tooLarge("image", "edge", Math.max(W, H), localize("image-codecs.pngdecode.the_image_is_w_by_h", "the image is {W} by {H}, and the decoder reads an edge of at most {bound}", { W: String(W), H: String(H), bound: String(EDGE_MAX) }), { width: W, height: H, components: comps });
  if (W * H > PIXELS_MAX)
    throw tooLarge("image", "pixels", W * H, localize("image-codecs.pngdecode.the_image_is_w_by_h_2", "the image is {W} by {H}, past the {bound} pixels the decoder reads", { W: String(W), H: String(H), bound: String(PIXELS_MAX) }), { width: W, height: H, components: comps });
  const rowBytes = Math.ceil((W * ch * depth) / 8);
  const need = W * H * comps + 2 * (rowBytes + 1);
  if (need > WORKING_SET_MAX)
    throw tooLarge(...WORKING_ROW, need, localize("image-codecs.pngdecode.the_decode_would_hold_bytes_at", "the decode would hold {bytes} bytes at once, past the {bound} the memory bound allows: the 8-bit output, and beside it two rows of the stored image", { bytes: String(need), bound: String(WORKING_SET_MAX) }),
      { bound_name: "working_set", working_set_bytes: need, bound_bytes: WORKING_SET_MAX, width: W, height: H, components: comps });

  /* The palette and transparency, as the colour type reads them. */
  let palette = null, alphaOf = null, key = null, transparency = colourType === 4 || colourType === 6 ? "alpha channel" : null;
  if (colourType === 3) {
    if (!plte) throw corrupt("a palette image with no PLTE chunk before its image data");
    if (!plte.length || plte.length % 3 || plte.length > 768) throw corrupt(localize("image-codecs.pngdecode.a_plte_of_length_bytes", "a PLTE of {length} bytes", { length: String(plte.length) }));
    palette = plte;
    alphaOf = new Uint8Array(256).fill(255);
    if (trns) { alphaOf.set(trns.subarray(0, Math.min(trns.length, plte.length / 3))); transparency = "tRNS"; }
  } else if (trns && colourType === 0 && trns.length === 2) {
    key = [u16(trns, 0)]; transparency = "tRNS";
  } else if (trns && colourType === 2 && trns.length === 6) {
    key = [u16(trns, 0), u16(trns, 2), u16(trns, 4)]; transparency = "tRNS";
  }
  const entries = palette ? palette.length / 3 : 0;

  const out = new Uint8Array(W * H * comps);
  const bpp = Math.max(1, (ch * depth) >> 3);
  let cur = new Uint8Array(rowBytes + 1), prev = new Uint8Array(rowBytes + 1);
  let fill = 0, y = 0;

  /** Unfilter the row in `cur` (filter byte first) against `prev`, and write it out. */
  const emit = () => {
    const f = cur[0], r = cur, q = prev, n = rowBytes + 1;
    if (f === 1) { for (let i = 1 + bpp; i < n; i++) r[i] = (r[i] + r[i - bpp]) & 0xff; }
    else if (f === 2) { for (let i = 1; i < n; i++) r[i] = (r[i] + q[i]) & 0xff; }
    else if (f === 3) {
      for (let i = 1; i < n; i++) r[i] = (r[i] + ((i > bpp ? r[i - bpp] : 0) + q[i] >> 1)) & 0xff;
    } else if (f === 4) {
      for (let i = 1; i < n; i++) {
        const a = i > bpp ? r[i - bpp] : 0, b = q[i], c = i > bpp ? q[i - bpp] : 0;
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        r[i] = (r[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    } else if (f !== 0) throw corrupt(localize("image-codecs.pngdecode.filter_type_f_in_row", "filter type {f} in row {y}", { f: String(f), y: String(y) }), { row: y, filter: f });
    writeRow(r, y);
    [cur, prev] = [prev, cur];
    y++;
  };

  const writeRow = (r, row) => {
    let o = row * W * comps;
    if (depth < 8) {
      const mask = (1 << depth) - 1, scale = SCALE[depth];
      for (let x = 0; x < W; x++) {
        const bit = x * depth, v = (r[1 + (bit >> 3)] >> (8 - depth - (bit & 7))) & mask;
        if (colourType === 3) o = paletteOut(v, o);
        else out[o++] = key && v === key[0] ? 255 : v * scale;
      }
      return;
    }
    const wide = depth === 16, s = wide ? 2 : 1;
    for (let x = 0, i = 1; x < W; x++, i += ch * s) {
      switch (colourType) {
        case 0: out[o++] = key && (wide ? u16(r, i) : r[i]) === key[0] ? 255 : r[i]; break;
        case 3: o = paletteOut(r[i], o); break;
        case 4: out[o++] = overWhite(r[i], r[i + s]); break;
        case 2:
          if (key && (wide ? u16(r, i) === key[0] && u16(r, i + 2) === key[1] && u16(r, i + 4) === key[2]
            : r[i] === key[0] && r[i + 1] === key[1] && r[i + 2] === key[2])) { out[o++] = 255; out[o++] = 255; out[o++] = 255; }
          else { out[o++] = r[i]; out[o++] = r[i + s]; out[o++] = r[i + 2 * s]; }
          break;
        default: {
          const a = r[i + 3 * s];
          out[o++] = overWhite(r[i], a); out[o++] = overWhite(r[i + s], a); out[o++] = overWhite(r[i + 2 * s], a);
        }
      }
    }
  };

  const paletteOut = (v, o) => {
    if (v >= entries) throw corrupt(localize("image-codecs.pngdecode.palette_index_v_past_the", "palette index {v} past the palette's {entries} entries", { v: String(v), entries: String(entries) }), { index: v, entries });
    const a = alphaOf[v], p = 3 * v;
    out[o] = overWhite(palette[p], a); out[o + 1] = overWhite(palette[p + 1], a); out[o + 2] = overWhite(palette[p + 2], a);
    return o + 3;
  };

  /* Inflate, feeding the rows as the bytes arrive. */
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter(), reader = ds.readable.getReader();
  let extra = 0;
  const writing = (async () => {
    for (const part of idat) await writer.write(part);
    await writer.close();
  })();
  writing.catch(() => {});
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let i = 0;
      while (i < value.length) {
        if (y === H) { extra += value.length - i; break; }
        const take = Math.min(value.length - i, rowBytes + 1 - fill);
        cur.set(value.subarray(i, i + take), fill);
        fill += take; i += take;
        if (fill === rowBytes + 1) { fill = 0; emit(); }
      }
      if (extra) break;
    }
  } catch (e) {
    if (e instanceof PngRefusal) { reader.cancel().catch(() => {}); throw e; }
    /* The inflater refused the zlib stream: damaged, cut inside well-formed
     * chunks, or (once the frame is complete) its Adler-32 wrong, missing or
     * followed by junk. Which of these it was is said only in the inflater's own
     * words, which differ between platforms, so all are CORRUPT here; a file cut
     * short is TRUNCATED by its chunks, and a whole stream of too few rows below. */
    const why = String((e && e.message) || (e && e.code) || e);
    throw corrupt(y < H ? localize("image-codecs.pngdecode.the_image_data_does_not", "the image data does not inflate (row {y} of {H})", { y: String(y), H: String(H) }) : localize("image-codecs.pngdecode.the_image_data_s_zlib", "the image data's zlib trailer is damaged or missing"),
      { rows: y, height: H, inflater: why });
  }
  if (extra) {
    reader.cancel().catch(() => {});
    throw corrupt(localize("image-codecs.pngdecode.the_image_data_inflates_past", "the image data inflates past the frame"), { height: H, row_bytes: rowBytes });
  }
  if (y < H) throw truncated(localize("image-codecs.pngdecode.the_image_data_ends_after", "the image data ends after {y} of {H} rows", { y: String(y), H: String(H) }), { rows: y, height: H });
  return { width: W, height: H, comps, samples: out, detail: { colour_type: colourType, bit_depth: depth, transparency } };
}
