/* image-cover's tests: reading an answer back, independently of the module.
 *
 * A JPEG answer is decoded by image-codecs' `decodeBaselineJpeg`, bit-exact with libjpeg-turbo (its R1, checked by
 * its own R6), and a PNG answer by node's zlib and the PNG standard's unfiltering, here; each is turned as its own
 * EXIF orientation says, as the reference (`ImageOps.exif_transpose`) turned the original. The structure walks read
 * every segment or chunk the answer holds, so the R2 tests can say exactly what is there. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { inflateSync } from "node:zlib";
import { decodeBaselineJpeg } from "../../../../pdf-worker/src/dctdecode.mjs";

/**
 * One photo the reference covered (`fixtures/make-fixtures.py`): the areas, and what the reference computed.
 * @typedef {Object} CoverCase
 * @property {string} file
 * @property {"jpeg" | "png"} format
 * @property {Array<[number, number, number, number]>} areas
 * @property {number} width
 * @property {number} height
 * @property {number} covered
 * @property {Array<[number, number, number, number]>} cover_rects
 * @property {number} bleed
 * @property {string} mode
 * @property {number[]} cover
 * @property {string} outside_sha256
 */
/**
 * One photo the reference expects refused, with its areas and the code.
 * @typedef {Object} RefusalCase
 * @property {string} file
 * @property {string} code
 * @property {Array<[number, number, number, number]>} areas
 */
/**
 * @typedef {Object} Cases
 * @property {CoverCase[]} cases
 * @property {RefusalCase[]} refusals
 */
/**
 * A decoded picture, upright: interleaved samples, `comps` to a pixel.
 * @typedef {Object} Picture
 * @property {Uint8Array} samples
 * @property {number} width
 * @property {number} height
 * @property {number} comps
 */
/**
 * An EXIF IFD0's tags, by tag number, and its next-IFD offset and TIFF magic.
 * @typedef {Object} Ifd0
 * @property {Record<number, {type: number, count: number, value: number}>} tags
 * @property {number} next
 * @property {number} magic
 */

const DIR = new URL("./fixtures/", import.meta.url);
/** A fixture's bytes, by its file name in `fixtures/`. @param {string} name */
export const fixture = (name) => new Uint8Array(readFileSync(new URL(basename(name), DIR)));
/* this module's own fixture list, decoded where it is read */
export const CASES = /** @type {Cases} */ (JSON.parse(readFileSync(new URL("cases.json", DIR), "utf8")));

/**
 * Every segment of a JPEG answer, in order: `{marker, body}`, then the scan's data with its RSTn markers, then
 * what follows EOI (which must be nothing).
 * @param {Uint8Array} d
 * @returns {{segs: Array<{marker: number, body: Uint8Array}>, rst: number[], after: Uint8Array}}
 */
export function jpegSegments(d) {
  if (d[0] !== 0xff || d[1] !== 0xd8) throw new Error("no SOI");
  /** @type {Array<{marker: number, body: Uint8Array}>} */
  const segs = [];
  let p = 2;
  for (;;) {
    if (d[p] !== 0xff) throw new Error(`no marker at ${p}`);
    const m = d[p + 1] ?? NaN, len = ((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0);
    segs.push({ marker: m, body: d.subarray(p + 4, p + 2 + len) });
    p += 2 + len;
    if (m === 0xda) break;
  }
  /** @type {number[]} */
  const rst = [];
  for (; p < d.length - 1; p++) {
    if (d[p] !== 0xff) continue;
    const n = d[p + 1] ?? NaN;
    if (n === 0) { p++; continue; }
    if (n >= 0xd0 && n <= 0xd7) { rst.push(n - 0xd0); p++; continue; }
    if (n === 0xd9) return { segs, rst, after: d.subarray(p + 2) };
    throw new Error(`marker 0x${n.toString(16)} inside the scan`);
  }
  throw new Error("no EOI");
}

/**
 * Every chunk of a PNG answer, then what follows IEND.
 * @param {Uint8Array} d
 * @returns {{chunks: Array<{type: string, body: Uint8Array}>, after: Uint8Array}}
 */
export function pngChunks(d) {
  /** @type {Array<{type: string, body: Uint8Array}>} */
  const chunks = [];
  let p = 8;
  for (;;) {
    const len = new DataView(d.buffer, d.byteOffset + p).getUint32(0);
    const type = String.fromCharCode(...d.subarray(p + 4, p + 8));
    chunks.push({ type, body: d.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === "IEND") return { chunks, after: d.subarray(p) };
  }
}

/**
 * The orientation an EXIF TIFF block holds, and every tag of its IFD0, and its next-IFD offset.
 * @param {Uint8Array} t
 * @returns {Ifd0}
 */
export function tiffIfd0(t) {
  const le = t[0] === 0x49;
  const dv = new DataView(t.buffer, t.byteOffset, t.length);
  /** @param {number} p */
  const u16 = (p) => dv.getUint16(p, le);
  /** @param {number} p */
  const u32 = (p) => dv.getUint32(p, le);
  /** @type {Record<number, {type: number, count: number, value: number}>} */
  const tags = {};
  const at = u32(4), n = u16(at);
  for (let i = 0; i < n; i++) { const e = at + 2 + 12 * i; tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), value: u16(e + 8) }; }
  return { tags, next: u32(at + 2 + 12 * n), magic: u16(2) };
}

/**
 * The stored pixel a displayed pixel (dx, dy) takes under EXIF orientation `o` (2 to 8), for a stored W x H raster.
 * @param {number} o @param {number} dx @param {number} dy @param {number} W @param {number} H
 * @returns {[number, number]}
 */
function storedPixel(o, dx, dy, W, H) {
  switch (o) {
    case 2: return [W - 1 - dx, dy];
    case 3: return [W - 1 - dx, H - 1 - dy];
    case 4: return [dx, H - 1 - dy];
    case 5: return [dy, dx];
    case 6: return [dy, H - 1 - dx];
    case 7: return [W - 1 - dy, H - 1 - dx];
    case 8: return [W - 1 - dy, dx];
    default: throw new Error(`no EXIF orientation ${o}`);
  }
}

/**
 * Stored samples to displayed, as EXIF orientation `o` says: displayed (dx, dy) takes stored toStored(dx, dy).
 * A decoder that answers no samples fails here.
 * @param {Uint8Array | null} samples @param {number} W @param {number} H @param {number} n @param {number} o
 * @returns {{samples: Uint8Array, width: number, height: number}}
 */
function orient(samples, W, H, n, o) {
  if (!samples) throw new Error("the decoder answered no samples");
  if (o === 1) return { samples, width: W, height: H };
  const [DW, DH] = o >= 5 ? [H, W] : [W, H];
  const out = new Uint8Array(samples.length);
  for (let dy = 0; dy < DH; dy++) for (let dx = 0; dx < DW; dx++) {
    const [sx, sy] = storedPixel(o, dx, dy, W, H);
    for (let k = 0; k < n; k++) out[(dy * DW + dx) * n + k] = samples[(sy * W + sx) * n + k] ?? 0;
  }
  return { samples: out, width: DW, height: DH };
}

/** @param {Uint8Array} d */
const exifOrientationJpeg = (d) => {
  const app1 = jpegSegments(d).segs.find((s) => s.marker === 0xe1);
  return app1 ? tiffIfd0(app1.body.subarray(6)).tags[0x0112]?.value ?? 1 : 1;
};

/**
 * A JPEG answer decoded and turned upright: `{samples, width, height, comps}` (L or RGB).
 * @param {Uint8Array} d
 * @returns {Picture}
 */
export function decodeJpegAnswer(d) {
  const o = decodeBaselineJpeg(d);
  return { ...orient(o.samples, o.width, o.height, o.comps, exifOrientationJpeg(d)), comps: o.comps };
}

/**
 * A PNG answer decoded to RGBA and turned upright (8-bit, non-interlaced: the only kind the module writes).
 * @param {Uint8Array} d
 * @returns {Picture}
 */
export function decodePngAnswer(d) {
  const { chunks } = pngChunks(d);
  const first = chunks[0];
  if (!first) throw new Error("no IHDR");
  const ih = first.body, dv = new DataView(ih.buffer, ih.byteOffset);
  const W = dv.getUint32(0), H = dv.getUint32(4), ct = ih[9];
  const bpp = ct === 0 || ct === 3 ? 1 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 6 ? 4 : NaN, stride = W * bpp;
  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.body)));
  const plte = chunks.find((c) => c.type === "PLTE")?.body, trns = chunks.find((c) => c.type === "tRNS")?.body;
  const exif = chunks.find((c) => c.type === "eXIf");
  const rgba = new Uint8Array(W * H * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < H; y++) {
    const t = raw[y * (stride + 1)] ?? 0, row = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] ?? 0 : 0, b = prev[i] ?? 0, c = i >= bpp ? prev[i - bpp] ?? 0 : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      row[i] = ((row[i] ?? 0) + ([0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][t] ?? NaN)) & 255;
    }
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, s = x * bpp;
      /** @param {number} k */
      const at = (k) => row[k] ?? 0;
      /** @type {number[]} */
      let px;
      if (ct === 6) px = [at(s), at(s + 1), at(s + 2), at(s + 3)];
      else if (ct === 4) px = [at(s), at(s), at(s), at(s + 1)];
      else if (ct === 2) px = [at(s), at(s + 1), at(s + 2), 255];
      else if (ct === 0) px = [at(s), at(s), at(s), 255];
      else {
        if (!plte) throw new Error("an indexed answer without PLTE");
        const i = at(s);
        px = [plte[3 * i] ?? 0, plte[3 * i + 1] ?? 0, plte[3 * i + 2] ?? 0, trns && i < trns.length ? trns[i] ?? 255 : 255];
      }
      rgba.set(px, o);
    }
    prev = row;
  }
  return { ...orient(rgba, W, H, 4, exif ? tiffIfd0(exif.body).tags[0x0112]?.value ?? 1 : 1), comps: 4 };
}

/**
 * The reference's comparison: the decode with every pixel the cover may change (each cover rectangle, grown by
 * the chroma bleed) set to zero, hashed; and whether each pixel inside every rectangle (shrunk by it) is the cover.
 * @param {Picture} img
 * @param {CoverCase} c
 * @returns {{width: number, height: number, outside_sha256: string, inside: number, wrong: number}}
 */
export function judge(img, c) {
  const { samples, width, height, comps } = img;
  const g = c.bleed, a = Uint8Array.from(samples);
  let inside = 0, wrong = 0;
  for (const [x0, y0, x1, y1] of c.cover_rects) {
    for (let y = Math.max(0, y0 - g); y < Math.min(height, y1 + g); y++)
      for (let x = Math.max(0, x0 - g); x < Math.min(width, x1 + g); x++) {
        const o = (y * width + x) * comps;
        if (y >= y0 + g && y < y1 - g && x >= x0 + g && x < x1 - g) {
          inside++;
          for (let k = 0; k < comps; k++) if (samples[o + k] !== c.cover[k]) { wrong++; break; }
        }
        a.fill(0, o, o + comps);
      }
  }
  return { width, height, outside_sha256: createHash("sha256").update(a).digest("hex"), inside, wrong };
}
