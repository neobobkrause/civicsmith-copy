/* image-cover: the PNG path (R1, R2, R4).
 *
 * The image data is inflated and unfiltered one row at a time, the pixels an area touches are set to the cover
 * colour, and the row is filtered again (with the filter type its original row used) and deflated into a fresh
 * file holding IHDR, the palette and transparency the pixels need, the orientation alone, the data, and IEND;
 * nothing else of the original (no text, EXIF, time, colour profile, APNG frames or bytes after IEND; R2). Only two
 * rows are held at a time, so the working set is the photo's bytes and the answer's (R4).
 *
 * The cover colour is opaque black: (0, 0, 0) with alpha 255, so an area's alpha (which can carry a silhouette)
 * is covered too. An indexed image covers with a palette entry that is opaque black, added when the palette has
 * room, else its darkest opaque entry. A colour key (`tRNS` on grey or RGB) equal to black would make the cover
 * transparent, so the cover is then the nearest grey, 1. */
import { CoverRefusal, checkPixels, checkStride, checkCount, storedRects, displayedSize, mergeSpans, orientationOf, orientationTiff } from "./geometry.mjs";
import { localize } from "../setup-words/index.mjs";

/** @import { Rect, Span } from "./geometry.mjs" */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The samples a pixel of PNG colour type `ct` holds (grey 1, RGB 3, indexed 1, grey and alpha 2, RGBA 4); 0 for a
 * colour type the standard does not define.
 * @param {number | undefined} ct
 * @returns {number}
 */
export const channelsOf = (ct) => (ct === 0 || ct === 3 ? 1 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 6 ? 4 : 0);

/**
 * The chunks the cover reads.
 * @typedef {Object} ReadChunks
 * @property {Uint8Array[]} idat
 * @property {Uint8Array | null} plte
 * @property {Uint8Array | null} trns
 * @property {Uint8Array | null} exif
 * @property {Uint8Array | null} ihdr
 * @property {boolean} [idatDone]
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
/**
 * The CRC-32 of the parts, one after another (the PNG standard's).
 * @param {...Uint8Array} parts
 * @returns {number}
 */
export function crc32(...parts) {
  let c = 0xffffffff;
  for (const buf of parts) for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ (buf[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** @param {Uint8Array} d @param {number} p */
const u32 = (d, p) => (d[p] ?? NaN) * 0x1000000 + (((d[p + 1] ?? 0) << 16) | ((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0));
/** @param {string} why */
const truncated = (why) => new CoverRefusal("TRUNCATED_IMAGE_DATA", localize("image-cover.png.the_png_data_ends_before", "the PNG data ends before the image does: {why}", { why: String(why) }));
/** @param {string} why */
const corrupt = (why) => new CoverRefusal("IMAGE_DATA_CORRUPT", localize("image-cover.png.the_png_data_cannot_be", "the PNG data cannot be read: {why}", { why: String(why) }));

/** @param {Uint8Array} d @param {number} p @param {number} v */
function put32(d, p, v) { d[p] = v >>> 24; d[p + 1] = (v >>> 16) & 255; d[p + 2] = (v >>> 8) & 255; d[p + 3] = v & 255; }

/**
 * The chunks the cover reads, up to IEND; everything else is passed over and not carried.
 * @param {Uint8Array} d
 * @returns {ReadChunks}
 */
function readChunks(d) {
  /** @type {ReadChunks} */
  const got = { idat: [], plte: null, trns: null, exif: null, ihdr: null };
  let p = 8, end = false, count = 0;
  while (!end) {
    checkCount(++count, "chunks");
    if (p + 12 > d.length) throw truncated("a chunk runs past the end of the file");
    const len = u32(d, p), type = String.fromCharCode(d[p + 4] ?? NaN, d[p + 5] ?? NaN, d[p + 6] ?? NaN, d[p + 7] ?? NaN);
    if (p + 12 + len > d.length) throw truncated(`chunk ${type} runs past the end of the file`);
    const body = d.subarray(p + 8, p + 8 + len);
    const read = type === "IHDR" || type === "PLTE" || type === "tRNS" || type === "IDAT" || type === "eXIf";
    if (read && crc32(d.subarray(p + 4, p + 8), body) !== u32(d, p + 8 + len)) throw corrupt(`chunk ${type} fails its CRC`);
    if (type === "IHDR") got.ihdr = body;
    else if (!got.ihdr) throw corrupt("the first chunk is not IHDR");
    else if (type === "IDAT") {
      if (got.idatDone) throw corrupt("IDAT chunks are not consecutive");
      got.idat.push(body);
    } else {
      if (got.idat.length) got.idatDone = true;
      if (type === "PLTE") got.plte = body;
      else if (type === "tRNS") got.trns = body;
      else if (type === "eXIf" && !got.exif) got.exif = body;
      else if (type === "IEND") end = true;
    }
    p += 12 + len;
  }
  if (!got.idat.length) throw truncated("no IDAT chunk");
  return got;
}

/**
 * The cover pixel's bytes, and the palette and transparency the answer carries.
 * @param {number} ct
 * @param {Uint8Array | null} plte
 * @param {Uint8Array | null} trns
 * @returns {{px: number[], plte: Uint8Array | null, trns: Uint8Array | null}}
 */
function coverColour(ct, plte, trns) {
  if (ct === 6) return { px: [0, 0, 0, 255], plte, trns };
  if (ct === 4) return { px: [0, 255], plte, trns };
  if (ct === 0) {
    const key = trns && trns.length >= 2 ? ((trns[0] ?? 0) << 8) | (trns[1] ?? 0) : -1;
    return { px: [key === 0 ? 1 : 0], plte, trns };
  }
  if (ct === 2) {
    const black = trns && trns.length >= 6 && trns.every((v) => v === 0);
    return { px: black ? [1, 1, 1] : [0, 0, 0], plte, trns };
  }
  /* indexed: the palette was checked present (coverPng) */
  if (!plte) throw new TypeError("Cannot read properties of null (reading 'length')");
  /** @param {number} i */
  const n = plte.length / 3, alpha = (i) => (trns && i < trns.length ? trns[i] ?? 255 : 255);
  /* below, i < n, so each palette entry read is inside the palette */
  for (let i = 0; i < n; i++)
    if (plte[3 * i] === 0 && plte[3 * i + 1] === 0 && plte[3 * i + 2] === 0 && alpha(i) === 255) return { px: [i], plte, trns };
  if (n < 256) {
    const grown = new Uint8Array(plte.length + 3);
    grown.set(plte);
    return { px: [n], plte: grown, trns };
  }
  let best = 0, bestKey = Infinity;
  for (let i = 0; i < n; i++) {
    const key = (255 - alpha(i)) * 1e6 + (plte[3 * i] ?? 0) * 299 + (plte[3 * i + 1] ?? 0) * 587 + (plte[3 * i + 2] ?? 0) * 114;
    if (key < bestKey) { best = i; bestKey = key; }
  }
  return { px: [best], plte, trns };
}

/* In unfilter and filter, `row` and `prev` are one row's length and every index is inside them. */
/**
 * @param {number} type
 * @param {Uint8Array} row
 * @param {Uint8Array} prev
 * @param {number} bpp
 */
function unfilter(type, row, prev, bpp) {
  const n = row.length;
  switch (type) {
    case 0: return;
    case 1: for (let i = bpp; i < n; i++) row[i] = ((row[i] ?? 0) + (row[i - bpp] ?? 0)) & 255; return;
    case 2: for (let i = 0; i < n; i++) row[i] = ((row[i] ?? 0) + (prev[i] ?? 0)) & 255; return;
    case 3:
      for (let i = 0; i < n; i++) row[i] = ((row[i] ?? 0) + (((i >= bpp ? row[i - bpp] ?? 0 : 0) + (prev[i] ?? 0)) >> 1)) & 255;
      return;
    case 4:
      for (let i = 0; i < n; i++) {
        const a = i >= bpp ? row[i - bpp] ?? 0 : 0, b = prev[i] ?? 0, c = i >= bpp ? prev[i - bpp] ?? 0 : 0;
        row[i] = ((row[i] ?? 0) + paeth(a, b, c)) & 255;
      }
      return;
    default: throw corrupt(`a row has filter type ${type}`);
  }
}
/**
 * @param {number} type
 * @param {Uint8Array} row
 * @param {Uint8Array} prev
 * @param {number} bpp
 * @param {Uint8Array} out
 */
function filter(type, row, prev, bpp, out) {
  const n = row.length;
  out[0] = type;
  for (let i = 0; i < n; i++) {
    const a = i >= bpp ? row[i - bpp] ?? 0 : 0, b = prev[i] ?? 0, c = i >= bpp ? prev[i - bpp] ?? 0 : 0;
    const pred = type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : type === 4 ? paeth(a, b, c) : 0;
    out[1 + i] = ((row[i] ?? 0) - pred) & 255;
  }
}
/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Collect a readable stream's chunks, concurrently with whatever feeds it.
 * @param {ReadableStream<Uint8Array>} readable
 * @returns {Promise<{parts: Uint8Array[], total: number}>}
 */
async function drain(readable) {
  /** @type {Uint8Array[]} */
  const parts = [];
  let total = 0;
  for (const rd = readable.getReader(); ;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }
  return { parts, total };
}

/**
 * Cover an 8-bit, non-interlaced PNG. `d` is the whole file; `areas` are already shape-checked.
 * @param {Uint8Array} d
 * @param {ReadonlyArray<Rect>} areas
 * @param {number} maxPixels
 * @returns {Promise<{bytes: Uint8Array, format: "png", width: number, height: number, covered: number}>}
 * @throws {CoverRefusal}
 */
export async function coverPng(d, areas, maxPixels) {
  for (let i = 0; i < 8; i++) if (d[i] !== SIGNATURE[i]) throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", "not a PNG");
  const c = readChunks(d);
  const ih = c.ihdr;
  if (!ih) throw new TypeError("Cannot read properties of null (reading 'length')");    // readChunks found IHDR first
  if (ih.length !== 13) throw corrupt("IHDR is not 13 bytes");
  const W = u32(ih, 0), H = u32(ih, 4), depth = ih[8], ct = ih[9] ?? NaN;   // IHDR is 13 bytes: each is there
  if (!W || !H) throw corrupt("a zero dimension");
  checkPixels(W, H, maxPixels);
  if (!channelsOf(ct)) throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", localize("image-cover.png.png_colour_type_ct_is", "PNG colour type {ct} is not defined", { ct: String(ct) }));
  if (depth !== 8) throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", localize("image-cover.png.png_bit_depth_depth_only", "PNG bit depth {depth}; only 8-bit PNGs are covered", { depth: String(depth) }));
  if (ih[10] !== 0 || ih[11] !== 0) throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", "PNG compression or filter method is not the standard's");
  if (ih[12] !== 0) throw new CoverRefusal("PNG_INTERLACED", "an interlaced (Adam7) PNG is not covered");
  const bpp = channelsOf(ct), stride = W * bpp;
  checkStride(stride);
  const palette = c.plte, exif = c.exif;
  if (ct === 3 && (!palette || palette.length % 3 || !palette.length)) throw corrupt("an indexed PNG without a palette");
  const orientation = exif ? orientationOf(exif) : 1;
  const rects = storedRects(areas, W, H, orientation);
  const { px, plte, trns } = coverColour(ct, ct === 3 ? palette : null, c.trns);

  /* inflate → unfilter → cover → filter → deflate, a row at a time */
  const inflate = new DecompressionStream("deflate"), deflate = new CompressionStream("deflate");
  const feeding = (async () => {
    const w = inflate.writable.getWriter();
    for (const part of c.idat) await w.write(part);
    await w.close();
  })();
  feeding.catch(() => {});
  const collecting = drain(deflate.readable);
  collecting.catch(() => {});
  const dw = deflate.writable.getWriter();
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);          // the original rows, unfiltered
  let outPrev = new Uint8Array(stride), out = new Uint8Array(stride);       // the answer's rows
  const filtered = new Uint8Array(stride + 1);
  let y = 0, at = -1, type = 0, covered = 0;                  // at: bytes of the current row read; -1 = its filter byte
  const finishRow = async () => {
    unfilter(type, cur, prev, bpp);
    out.set(cur);
    for (const [x0, x1] of mergeSpans(rects.filter((r) => r[1] <= y && y < r[3]).map((r) => {
      /** @type {Span} */
      const s = [r[0], r[2]];
      return s;
    }))) {
      covered += x1 - x0;
      for (let x = x0; x < x1; x++) for (let k = 0; k < bpp; k++) out[x * bpp + k] = px[k] ?? 0;   // k < the pixel's samples
    }
    filter(type, out, outPrev, bpp, filtered);
    await dw.write(filtered.slice());
    [prev, cur] = [cur, prev];
    [outPrev, out] = [out, outPrev];
    y++;
    at = -1;
  };
  const rd = inflate.readable.getReader();
  try {
    while (y < H) {
      const r = await rd.read().catch((/** @type {unknown} */ e) => { throw corrupt(`the image data does not inflate (${(e instanceof Error ? e.message : undefined) || e})`); });
      if (r.done) break;
      const v = r.value;
      for (let i = 0; i < v.length && y < H;) {
        if (at < 0) { type = v[i++] ?? 0; at = 0; continue; }          // i < the part's length
        const k = Math.min(stride - at, v.length - i);
        cur.set(v.subarray(i, i + k), at);
        at += k; i += k;
        if (at === stride) await finishRow();
      }
    }
  } finally {
    rd.cancel().catch(() => {});
  }
  if (y < H) {
    dw.abort().catch(() => {});
    throw truncated(`the image data ends at row ${y} of ${H}`);
  }
  await dw.close();
  const { parts } = await collecting;

  /* The answer, written once: each deflated part is its own IDAT chunk, so the data is copied a single time. */
  /** @type {Array<[string, Uint8Array]>} */
  const pieces = [["IHDR", ih]];
  if (orientation !== 1) pieces.push(["eXIf", orientationTiff(orientation)]);
  if (plte) pieces.push(["PLTE", plte]);
  if (trns) pieces.push(["tRNS", trns]);
  for (const part of parts) if (part.length) pieces.push(["IDAT", part]);
  pieces.push(["IEND", new Uint8Array(0)]);
  const bytes = new Uint8Array(8 + pieces.reduce((n, [, b]) => n + 12 + b.length, 0));
  bytes.set(SIGNATURE);
  let o = 8;
  for (const [type, body] of pieces) {
    const t = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
    put32(bytes, o, body.length); bytes.set(t, o + 4); bytes.set(body, o + 8);
    put32(bytes, o + 8 + body.length, crc32(t, body));
    o += 12 + body.length;
  }
  const [width, height] = displayedSize(W, H, orientation);
  return { bytes, format: "png", width, height, covered };
}
