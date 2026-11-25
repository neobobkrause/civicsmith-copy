/* imggen: the seeded picture generator (requirements/test-support.md R19, R20, R24; fix round 9, G123d; envelope-scans 5.1).
 * Not product code; importing it has no side effect.
 *
 * A page is text lines rasterised from a built-in 5x7 bitmap font, so no font file is needed and the truth (the
 * words, and every pixel) is exact. Each line carries `<seed>-p<page>-l<line>` and a word. Degradations are seeded
 * and independent (tilt, turns, shade, low contrast, noise, inversion), then the page is coloured (grey, bi-level,
 * RGB, palette, grey with alpha, 16-bit) and encoded: PNG, BMP, GIF (LZW, several frames) and TIFF (none, PackBits,
 * LZW, Deflate, predictor 2; one or several pages; II or MM) are written here. Hostile files are patched headers over
 * a few bytes of data (`declare`), a wide or tall frame (`frame`), a hostile count (`hostile`) and a polyglot.
 *
 * Recipe: `{kind: "png"|"bmp"|"gif"|"tiff", seed, size: {pages = 1, lines = 6, bytes}, dpi = 150, frame: [w, h],
 * mode: "L"|"1"|"RGB"|"P"|"LA"|"I;16", degrade: {tilt, turn, shade, contrast, noise, invert} (or a list per page),
 * compression ("none"|"packbits"|"lzw"|"deflate"), predictor (2), byteOrder ("II"|"MM"), declare: {width, height},
 * hostile: {chunks|frames|ifds: n}, polyglot: "zip", bound (bytes), pixelBound (a declared frame's pixels)}.
 * Truth: `{kind, pages: [{width, height, mode, lines, unread, pixels(), sha256()}], frames, marks, words, declared,
 * refusal}`; a page's pixels are as Pillow gives them (`P` and BMP and GIF as `RGB`, `1` as `L`, `I;16` big-endian). */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { makeZip, crc32 } from "./make-zip.mjs";
import { hash32, drawAt, ASCII_VOCAB, canonical } from "./seeded.mjs";

export const KINDS = Object.freeze(["png", "bmp", "gif", "tiff"]);
const TYPES = { png: "image/png", bmp: "image/bmp", gif: "image/gif", tiff: "image/tiff" };
const EXT = { png: "png", bmp: "bmp", gif: "gif", tiff: "tif" };

/* ---- the font: 5 columns by 7 rows, a row a binary group ---- */
const GLYPHS = {
  A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110", C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11110 10001 10001 10001 10001 10001 11110", E: "11111 10000 10000 11110 10000 10000 11111", F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111", H: "10001 10001 10001 11111 10001 10001 10001", I: "01110 00100 00100 00100 00100 00100 01110",
  J: "00111 00010 00010 00010 00010 10010 01100", K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 10001 11001 10101 10011 10001 10001", O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000", Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100", U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100", W: "10001 10001 10001 10101 10101 10101 01010", X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 10001 01010 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
  a: "00000 00000 01110 00001 01111 10001 01111", b: "10000 10000 10110 11001 10001 10001 11110", c: "00000 00000 01110 10000 10000 10001 01110",
  d: "00001 00001 01101 10011 10001 10001 01111", e: "00000 00000 01110 10001 11111 10000 01110", f: "00110 01001 01000 11100 01000 01000 01000",
  g: "00000 01111 10001 10001 01111 00001 01110", h: "10000 10000 10110 11001 10001 10001 10001", i: "00100 00000 01100 00100 00100 00100 01110",
  j: "00010 00000 00110 00010 00010 10010 01100", k: "10000 10000 10010 10100 11000 10100 10010", l: "01100 00100 00100 00100 00100 00100 01110",
  m: "00000 00000 11010 10101 10101 10001 10001", n: "00000 00000 10110 11001 10001 10001 10001", o: "00000 00000 01110 10001 10001 10001 01110",
  p: "00000 00000 11110 10001 11110 10000 10000", q: "00000 00000 01101 10011 01111 00001 00001", r: "00000 00000 10110 11001 10000 10000 10000",
  s: "00000 00000 01110 10000 01110 00001 11110", t: "01000 01000 11100 01000 01000 01001 00110", u: "00000 00000 10001 10001 10001 10011 01101",
  v: "00000 00000 10001 10001 10001 01010 00100", w: "00000 00000 10001 10001 10101 10101 01010", x: "00000 00000 10001 01010 00100 01010 10001",
  y: "00000 00000 10001 10001 01111 00001 01110", z: "00000 00000 11111 00010 00100 01000 11111",
  0: "01110 10001 10011 10101 11001 10001 01110", 1: "00100 01100 00100 00100 00100 00100 01110", 2: "01110 10001 00001 00010 00100 01000 11111",
  3: "11111 00010 00100 00010 00001 10001 01110", 4: "00010 00110 01010 10010 11111 00010 00010", 5: "11111 10000 11110 00001 00001 10001 01110",
  6: "00110 01000 10000 11110 10001 10001 01110", 7: "11111 00001 00010 00100 01000 01000 01000", 8: "01110 10001 10001 01110 10001 10001 01110",
  9: "01110 10001 10001 01111 00001 00010 01100", "-": "00000 00000 00000 11111 00000 00000 00000", ".": "00000 00000 00000 00000 00000 01100 01100",
  _: "00000 00000 00000 00000 00000 00000 11111", " ": "00000 00000 00000 00000 00000 00000 00000",
};
const FONT = Object.fromEntries(Object.entries(GLYPHS).map(([ch, rows]) => [ch, rows.split(" ").map((r) => [...r].map((b) => b === "1"))]));
/** The characters the bitmap font draws; a page's text uses only these. */
export const FONT_CHARS = Object.freeze(Object.keys(GLYPHS).join(""));

/** The scale (font pixels to page pixels), advance and line height at a dpi. */
export function metrics(dpi = 150) {
  const scale = Math.max(1, Math.round(dpi / 50));
  return { scale, advance: 6 * scale, lineHeight: 11 * scale, margin: 8 * scale };
}

/** Draws `lines` on a white grey page of `width` x `height` (0 ink, 255 paper), top-left first; a line that does not
 *  fit whole is not drawn. Answers `{data, drawn}` (the indexes of the lines drawn). */
export function renderLines(lines, { width, height, dpi = 150 }) {
  const { scale, advance, lineHeight, margin } = metrics(dpi);
  const data = new Uint8Array(width * height).fill(255);
  const drawn = [];
  lines.forEach((text, i) => {
    const y0 = margin + i * lineHeight;
    if (y0 + 7 * scale > height || margin + text.length * advance > width) return;
    for (const ch of text) if (!FONT[ch]) throw new Error(`imggen: the font has no ${JSON.stringify(ch)}`);
    [...text].forEach((ch, k) => {
      const g = FONT[ch], x0 = margin + k * advance;
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
        if (!g[gy][gx]) continue;
        for (let dy = 0; dy < scale; dy++) data.fill(0, (y0 + gy * scale + dy) * width + x0 + gx * scale, (y0 + gy * scale + dy) * width + x0 + gx * scale + scale);
      }
    });
    drawn.push(i);
  });
  return { data, drawn };
}

/** The page size that holds `lines` at a dpi: a letter page, taller when the lines need it. */
export function pageSize(lines, dpi = 150) {
  const { advance, lineHeight, margin } = metrics(dpi);
  const longest = Math.max(0, ...lines.map((l) => l.length));
  return { width: Math.max(Math.round(8.5 * dpi), 2 * margin + longest * advance), height: Math.max(Math.round(11 * dpi), 2 * margin + lines.length * lineHeight) };
}

/** The text lines of page `p` (1-based) of a recipe with `n` lines a page. */
export function pageLines(seed, p, n, vocab = ASCII_VOCAB) {
  return Array.from({ length: n }, (_, i) => `${seed}-p${p}-l${i + 1} ${vocab[hash32(seed, p, i + 1) % vocab.length]}`);
}

/* ---- degradations (on a grey page) ---- */

function degrade(page, d, seed, p) {
  let { width: w, height: h, data } = page;
  if (d.tilt) {
    const a = (d.tilt * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a), cx = w / 2, cy = h / 2;
    const out = new Uint8Array(w * h).fill(255);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.round(cos * (x - cx) + sin * (y - cy) + cx), sy = Math.round(-sin * (x - cx) + cos * (y - cy) + cy);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) out[y * w + x] = data[sy * w + sx];
    }
    data = out;
  }
  if (d.turn) {
    if (![90, 180, 270].includes(d.turn)) throw new Error("imggen: degrade.turn must be 90, 180 or 270");
    const W = d.turn === 180 ? w : h, H = d.turn === 180 ? h : w, out = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      out[Y * W + X] = d.turn === 90 ? data[(h - 1 - X) * w + Y] : d.turn === 180 ? data[(h - 1 - Y) * w + (w - 1 - X)] : data[X * w + (w - 1 - Y)];
    }
    data = out; w = W; h = H;
  }
  if (d.shade) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.round(data[y * w + x] * (1 - (d.shade * x) / w));
  if (d.contrast) { const lo = 96, hi = 160; for (let i = 0; i < data.length; i++) data[i] = lo + Math.round((data[i] * (hi - lo)) / 255); }
  if (d.noise) for (let i = 0; i < data.length; i++) { const r = drawAt(seed, "noise", p, i); if (r < d.noise) data[i] = r < d.noise / 2 ? 0 : 255; }
  if (d.invert) for (let i = 0; i < data.length; i++) data[i] = 255 - data[i];
  return { width: w, height: h, data };
}

/* ---- colour: the stored samples, and the pixels Pillow gives back ---- */

const INK = [20, 40, 140], PAPER = [250, 246, 235];
const PALETTE = [[0, 0, 0], [96, 64, 32], [180, 170, 150], [255, 255, 255]];

/** Stored samples for a grey page in `mode` (rows packed, no padding), and the truth's pixels. */
function colour(page, mode) {
  const { width: w, height: h, data } = page, n = w * h;
  if (mode === "L") return { samples: data, channels: 1, depth: 8, pixels: data, pixelMode: "L" };
  if (mode === "1") {
    const bw = data.map((v) => (v < 128 ? 0 : 255)), rowBytes = Math.ceil(w / 8), s = new Uint8Array(rowBytes * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bw[y * w + x]) s[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    return { samples: s, channels: 1, depth: 1, pixels: bw, pixelMode: "L", rowBytes };
  }
  if (mode === "I;16") {
    const s = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) { const v = data[i] * 257; s[2 * i] = v >> 8; s[2 * i + 1] = v & 0xff; }
    return { samples: s, channels: 1, depth: 16, pixels: s, pixelMode: "I;16" };
  }
  if (mode === "RGB") {
    const s = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[3 * i + c] = Math.round(INK[c] + ((PAPER[c] - INK[c]) * data[i]) / 255);
    return { samples: s, channels: 3, depth: 8, pixels: s, pixelMode: "RGB" };
  }
  if (mode === "P") {
    const idx = data.map((v) => Math.min(3, Math.floor(v / 64))), px = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) px.set(PALETTE[idx[i]], 3 * i);
    return { samples: idx, channels: 1, depth: 8, pixels: px, pixelMode: "RGB", palette: PALETTE };
  }
  if (mode === "LA") {
    const s = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) { s[2 * i] = data[i]; s[2 * i + 1] = data[i] < 128 ? 255 : 200; }
    return { samples: s, channels: 2, depth: 8, pixels: s, pixelMode: "LA" };
  }
  throw new Error(`imggen: mode must be L, 1, RGB, P, LA or I;16, got ${mode}`);
}

/* The modes each kind writes, and how Pillow gives each back. */
const MODES = { png: ["L", "1", "RGB", "P", "LA", "I;16"], bmp: ["RGB"], gif: ["P", "L"], tiff: ["L", "1", "RGB"] };
const asRgb = (c) => {
  if (c.pixelMode === "RGB") return c.pixels;
  const out = new Uint8Array(c.pixels.length * 3);
  for (let i = 0; i < c.pixels.length; i++) out.fill(c.pixels[i], 3 * i, 3 * i + 3);
  return out;
};

/* ---- the encoders ---- */

const be32 = (v) => Uint8Array.of(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const concat = (list) => { let n = 0; for (const b of list) n += b.length; const o = new Uint8Array(n); let k = 0; for (const b of list) { o.set(b, k); k += b.length; } return o; };
const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function pngChunk(type, data) {
  const td = concat([ascii(type), data]);
  return concat([be32(data.length), td, be32(crc32(td))]);
}

function png(c, w, h, { declare, hostile, pad = 0 }) {
  const rowBytes = c.rowBytes ?? w * c.channels * (c.depth / 8);
  const raw = new Uint8Array((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) raw.set(c.samples.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  const colourType = c.palette ? 3 : c.channels === 3 ? 2 : c.channels === 2 ? 4 : 0;
  const ihdr = new Uint8Array(13);
  ihdr.set(be32(declare?.width ?? w), 0); ihdr.set(be32(declare?.height ?? h), 4);
  ihdr[8] = c.depth; ihdr[9] = colourType;
  const parts = [Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), pngChunk("IHDR", ihdr)];
  if (c.palette) parts.push(pngChunk("PLTE", Uint8Array.from(c.palette.flat())));
  for (let i = 0; i < (hostile?.chunks ?? 0); i++) parts.push(pngChunk("paDd", new Uint8Array(0)));
  parts.push(pngChunk("IDAT", new Uint8Array(deflateSync(raw))));
  if (pad) {
    if (pad < 12) throw new Error(`imggen: a PNG grows by 12 bytes or more, not ${pad}`);
    parts.push(pngChunk("paDd", new Uint8Array(pad - 12)));
  }
  parts.push(pngChunk("IEND", new Uint8Array(0)));
  return concat(parts);
}

function bmp(c, w, h, { declare, pad = 0 }) {
  const rowBytes = Math.ceil((w * 3) / 4) * 4, pixels = new Uint8Array(rowBytes * h), rgb = asRgb(c);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 3, d = (h - 1 - y) * rowBytes + x * 3;
    pixels[d] = rgb[s + 2]; pixels[d + 1] = rgb[s + 1]; pixels[d + 2] = rgb[s];
  }
  const total = 54 + pixels.length + pad, head = new DataView(new ArrayBuffer(54));
  head.setUint16(0, 0x4d42, true); head.setUint32(2, total, true); head.setUint32(10, 54, true);
  head.setUint32(14, 40, true); head.setInt32(18, declare?.width ?? w, true); head.setInt32(22, declare?.height ?? h, true);
  head.setUint16(26, 1, true); head.setUint16(28, 24, true); head.setUint32(34, pixels.length, true);
  head.setInt32(38, 5906, true); head.setInt32(42, 5906, true);
  return concat([new Uint8Array(head.buffer), pixels, new Uint8Array(pad)]);
}

/** LZW codes of `indexes` as GIF writes them: LSB first, `min` bits a symbol, clear and end codes. */
function gifLzw(indexes, min) {
  const clear = 1 << min, end = clear + 1, out = [];
  let acc = 0, bits = 0, width = min + 1, next = end + 1, dict = new Map();
  const emit = (code) => { acc |= code << bits; bits += width; while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; } };
  emit(clear);
  let prefix = -1;
  for (const k of indexes) {
    if (prefix < 0) { prefix = k; continue; }
    const key = prefix * 4096 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > 1 << width && width < 12) width++; }
    else { emit(clear); dict = new Map(); next = end + 1; width = min + 1; }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix);
  emit(end);
  if (bits) out.push(acc & 255);
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) { const b = out.slice(i, i + 255); blocks.push(Uint8Array.of(b.length), Uint8Array.from(b)); }
  blocks.push(Uint8Array.of(0));
  return concat(blocks);
}

function gif(frames, w, h, { declare, hostile, pad = 0 }) {
  const lsd = new DataView(new ArrayBuffer(7));
  lsd.setUint16(0, declare?.width ?? w, true); lsd.setUint16(2, declare?.height ?? h, true); lsd.setUint8(4, 0x80 | 0x70 | 7);
  const table = new Uint8Array(768);
  const pal = frames[0].palette ?? Array.from({ length: 256 }, (_, i) => [i, i, i]);
  pal.forEach((rgb, i) => table.set(rgb, 3 * i));
  const parts = [ascii("GIF89a"), new Uint8Array(lsd.buffer), table];
  const image = (c, fw, fh) => {
    const d = new DataView(new ArrayBuffer(10));
    d.setUint8(0, 0x2c); d.setUint16(5, fw, true); d.setUint16(7, fh, true);
    return concat([Uint8Array.of(0x21, 0xf9, 4, 0, 0, 0, 0, 0), new Uint8Array(d.buffer), Uint8Array.of(8), gifLzw(c.samples, 8)]);
  };
  for (const f of frames) parts.push(image(f, w, h));
  for (let i = 0; i < (hostile?.frames ?? 0); i++) parts.push(image({ samples: Uint8Array.of(0) }, 1, 1));
  if (pad) {
    if (pad < 4) throw new Error(`imggen: a GIF grows by 4 bytes or more, not ${pad}`);
    /* a comment extension: 0x21 0xfe, sub-blocks of up to 255, then 0 */
    const body = [];
    let left = pad - 3;
    while (left > 0) { const n = Math.min(255, left - 1 || 1); if (left - 1 - n < 0) break; body.push(Uint8Array.of(n), new Uint8Array(n).fill(0x20)); left -= n + 1; }
    if (left !== 0) throw new Error(`imggen: a GIF cannot grow by exactly ${pad} bytes`);
    parts.push(Uint8Array.of(0x21, 0xfe), ...body, Uint8Array.of(0));
  }
  parts.push(Uint8Array.of(0x3b));
  return concat(parts);
}

function packBits(row) {
  const out = [];
  let i = 0;
  while (i < row.length) {
    let run = 1;
    while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
    if (run > 1) { out.push(257 - run, row[i]); i += run; continue; }
    let j = i + 1;
    while (j < row.length && j - i < 128 && !(j + 1 < row.length && row[j] === row[j + 1])) j++;
    out.push(j - i - 1, ...row.subarray(i, j));
    i = j;
  }
  return Uint8Array.from(out);
}

/** TIFF's LZW (5): MSB first, 9 to 12 bits, written as libtiff writes it: after each code the next free entry is
 *  counted, the width grows when it passes the width's largest code, and the table is cleared at 4094. */
function tiffLzw(bytes) {
  const out = [];
  let acc = 0, bits = 0, width = 9, next = 258, dict = new Map();
  const emit = (code) => { acc = (acc << width) | code; bits += width; while (bits >= 8) { out.push((acc >>> (bits - 8)) & 255); bits -= 8; acc &= (1 << bits) - 1; } };
  const grow = () => {
    next++;
    if (next === 4094) { emit(256); dict = new Map(); next = 258; width = 9; }
    else if (next > (1 << width) - 1) width++;
  };
  emit(256);
  let prefix = -1;
  for (const k of bytes) {
    if (prefix < 0) { prefix = k; continue; }
    const key = prefix * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    dict.set(key, next);
    grow();
    prefix = k;
  }
  if (prefix >= 0) { emit(prefix); grow(); }
  emit(257);
  if (bits) out.push((acc << (8 - bits)) & 255);
  return Uint8Array.from(out);
}

function tiff(pagesOut, { byteOrder = "II", compression = "none", predictor, declare, hostile, pad = 0 }) {
  const little = byteOrder === "II";
  if (!["II", "MM"].includes(byteOrder)) throw new Error("imggen: byteOrder must be II or MM");
  const CODE = { none: 1, packbits: 32773, lzw: 5, deflate: 8 };
  if (!CODE[compression]) throw new Error("imggen: compression must be none, packbits, lzw or deflate");
  if (predictor && (predictor !== 2 || !["lzw", "deflate"].includes(compression))) throw new Error("imggen: predictor 2 goes with lzw or deflate");
  const strips = pagesOut.map(({ c, w, h }) => {
    const rowBytes = c.rowBytes ?? w * c.channels * (c.depth / 8);
    let s = c.samples;
    if (predictor === 2) {
      s = s.slice();
      for (let y = 0; y < h; y++) for (let x = w - 1; x >= 1; x--) for (let k = 0; k < c.channels; k++) {
        const i = y * rowBytes + x * c.channels + k;
        s[i] = (s[i] - s[i - c.channels]) & 255;
      }
    }
    if (compression === "packbits") { const rows = []; for (let y = 0; y < h; y++) rows.push(packBits(s.subarray(y * rowBytes, (y + 1) * rowBytes))); return concat(rows); }
    if (compression === "lzw") return tiffLzw(s);
    if (compression === "deflate") return new Uint8Array(deflateSync(s));
    return s;
  });
  const chunks = [];
  let at = 8;
  const u16 = (v) => { const b = new DataView(new ArrayBuffer(2)); b.setUint16(0, v, little); return new Uint8Array(b.buffer); };
  const u32 = (v) => { const b = new DataView(new ArrayBuffer(4)); b.setUint32(0, v, little); return new Uint8Array(b.buffer); };
  const header = concat([ascii(byteOrder), u16(42), u32(0)]);
  chunks.push(header);
  const stripAt = strips.map((s) => { const o = at; chunks.push(s); at += s.length; if (at % 2) { chunks.push(Uint8Array.of(0)); at++; } return o; });
  const ifds = [];
  const ifdFor = (i, { c, w, h }) => {
    const bits = c.channels === 3 ? null : c.depth;
    const tags = [[256, 4, 1, declare?.width ?? w], [257, 4, 1, declare?.height ?? h], [258, 3, c.channels, bits], [259, 3, 1, CODE[compression]],
      [262, 3, 1, c.channels === 3 ? 2 : 1], [273, 4, 1, stripAt[i]], [277, 3, 1, c.channels], [278, 4, 1, h], [279, 4, 1, strips[i].length],
      [282, 5, 1, null], [283, 5, 1, null], [296, 3, 1, 2]];
    if (predictor) tags.push([317, 3, 1, 2]);
    return tags;
  };
  const list = pagesOut.map((p, i) => ({ tags: ifdFor(i, p) }));
  for (let k = 0; k < (hostile?.ifds ?? 0); k++) list.push({ tags: ifdFor(0, pagesOut[0]) });
  for (const ifd of list) {
    const extra = [];
    const entryBytes = 2 + ifd.tags.length * 12 + 4;
    const base = at + entryBytes;
    let extraAt = base;
    const entries = ifd.tags.map(([tag, type, count, value]) => {
      let field;
      if (tag === 258 && count === 3) { field = u32(extraAt); extra.push(concat([u16(8), u16(8), u16(8)])); extraAt += 6; }
      else if (type === 5) { field = u32(extraAt); extra.push(concat([u32(150), u32(1)])); extraAt += 8; }
      else if (type === 3) field = concat([u16(value), u16(0)]);
      else field = u32(value);
      return concat([u16(tag), u16(type), u32(count), field]);
    });
    ifd.at = at;
    ifd.bytes = [u16(ifd.tags.length), ...entries];
    ifd.extra = concat(extra);
    at = extraAt + (extraAt % 2);
    ifds.push(ifd);
  }
  ifds.forEach((ifd, i) => {
    chunks.push(...ifd.bytes, u32(i + 1 < ifds.length ? ifds[i + 1].at : 0), ifd.extra);
    if (ifd.extra.length % 2) chunks.push(Uint8Array.of(0));
  });
  const out = concat([...chunks, new Uint8Array(pad)]);
  new DataView(out.buffer).setUint32(4, ifds[0].at, little);
  return out;
}

/* ---- the recipe ---- */

function plan(recipe) {
  const kind = recipe.kind;
  if (!KINDS.includes(kind)) throw new Error(`imggen: kind must be one of ${KINDS.join(", ")}`);
  if (recipe.seed === undefined) throw new Error("imggen: recipe.seed is missing");
  const seed = String(recipe.seed);
  const size = recipe.size ?? {};
  const pages = size.pages ?? 1, lines = size.lines ?? 6, dpi = recipe.dpi ?? 150;
  if (kind !== "gif" && kind !== "tiff" && pages !== 1) throw new Error(`imggen: a ${kind} holds one page`);
  const mode = recipe.mode ?? (kind === "bmp" ? "RGB" : kind === "gif" ? "P" : "L");
  if (!MODES[kind].includes(mode)) throw new Error(`imggen: a ${kind} is written in ${MODES[kind].join(", ")}, not ${mode}`);
  for (const ch of seed) if (!FONT[ch]) throw new Error(`imggen: recipe.seed has ${JSON.stringify(ch)}, which the font cannot draw`);
  return { kind, seed, pages, lines, dpi, mode, size };
}

/** The pages' grey rasters, truth lines and stored colours. */
function pagesOf(recipe, p) {
  const out = [];
  for (let i = 1; i <= p.pages; i++) {
    const lines = pageLines(p.seed, i, p.lines);
    const { width, height } = recipe.frame ? { width: recipe.frame[0], height: recipe.frame[1] } : pageSize(lines, p.dpi);
    const { data, drawn } = renderLines(lines, { width, height, dpi: p.dpi });
    const d = Array.isArray(recipe.degrade) ? recipe.degrade[(i - 1) % recipe.degrade.length] ?? {} : recipe.degrade ?? {};
    const page = degrade({ width, height, data }, d, p.seed, i);
    out.push({ page, lines, drawn, d });
  }
  return out;
}

function truthFrom(recipe, p, pages) {
  const all = pages.map(({ page, lines, drawn, d }, i) => {
    const c = () => colour(page, p.mode);
    /* Pillow gives a BMP and a palette GIF back as RGB, a grey GIF as L */
    const rgb = p.kind === "bmp" || (p.kind === "gif" && p.mode === "P");
    const pixelMode = rgb ? "RGB" : c().pixelMode;
    const pixels = () => (rgb ? asRgb(c()) : c().pixels);
    return {
      page: i + 1, width: page.width, height: page.height, mode: pixelMode,
      orientation: d.turn ?? 0, degrade: d,
      lines: drawn.map((k) => lines[k]),
      unread: lines.map((l, k) => (drawn.includes(k) ? null : { line: l, reason: "OFF_FRAME" })).filter(Boolean),
      pixels,
      sha256: () => createHash("sha256").update(pixels()).digest("hex"),
    };
  });
  const firstPage = all[0], midPage = all[Math.floor((all.length - 1) / 2)], lastPage = all[all.length - 1];
  const mark = (pg, which) => { const l = pg.lines[which === "first" ? 0 : which === "last" ? pg.lines.length - 1 : Math.floor((pg.lines.length - 1) / 2)]; return l ? l.split(" ")[0] : null; };
  const hostile = recipe.hostile ?? null;
  const frames = all.length + (hostile?.frames ?? 0) + (hostile?.ifds ?? 0);
  const declared = recipe.declare ? { width: recipe.declare.width ?? firstPage.width, height: recipe.declare.height ?? firstPage.height } : null;
  if (declared) declared.pixels = declared.width * declared.height;
  return {
    kind: p.kind, recipe, pages: all, frames,
    words: all.flatMap((pg) => pg.lines.map((l) => l.split(" ")[1])),
    marks: { first: mark(firstPage, "first"), middle: mark(midPage, "middle"), last: mark(lastPage, "last") },
    declared, hostile, polyglot: recipe.polyglot ?? null,
    refusal: declared && recipe.pixelBound && declared.pixels > recipe.pixelBound ? { code: "TOO_LARGE", size: declared.pixels, bound: recipe.pixelBound } : null,
  };
}

function encode(recipe, p, pages, pad) {
  const opts = { declare: recipe.declare, hostile: recipe.hostile, pad };
  const coloured = pages.map(({ page }) => ({ c: colour(page, p.mode), w: page.width, h: page.height }));
  if (p.kind === "png") return png(coloured[0].c, coloured[0].w, coloured[0].h, opts);
  if (p.kind === "bmp") return bmp(coloured[0].c, coloured[0].w, coloured[0].h, opts);
  if (p.kind === "gif") {
    const frames = coloured.map(({ c }) => (p.mode === "L" ? { samples: c.samples } : { samples: c.samples, palette: c.palette }));
    return gif(frames, coloured[0].w, coloured[0].h, opts);
  }
  return tiff(coloured, { ...opts, byteOrder: recipe.byteOrder, compression: recipe.compression, predictor: recipe.predictor });
}

const POLYGLOT = () => makeZip([{ name: "polyglot.txt", data: "polyglot" }]);

/** The picture of a recipe (R19, R20): `{kind, ext, type, size, truth, chunks(), bytes()}`. */
export function generate(recipe) {
  const p = plan(recipe);
  const pages = pagesOf(recipe, p);
  const tail = recipe.polyglot === "zip" ? POLYGLOT() : recipe.polyglot ? (() => { throw new Error("imggen: polyglot must be zip"); })() : new Uint8Array(0);
  let bytes = encode(recipe, p, pages, 0);
  const target = p.size.bytes;
  if (target !== undefined) {
    const pad = target - bytes.length - tail.length;
    if (pad < 0) throw new Error(`imggen: the picture is ${bytes.length + tail.length} bytes before padding, over size.bytes ${target}`);
    if (pad) bytes = encode(recipe, p, pages, pad);
  }
  bytes = concat([bytes, tail]);
  const truth = truthFrom(recipe, p, pages);
  truth.size = bytes.length;
  if (!truth.refusal && recipe.bound && bytes.length > recipe.bound) truth.refusal = { code: "TOO_LARGE", size: bytes.length, bound: recipe.bound };
  return {
    kind: p.kind, ext: EXT[p.kind], type: TYPES[p.kind], size: bytes.length, truth,
    async *chunks() { for (let i = 0; i < bytes.length; i += 1 << 20) yield bytes.subarray(i, i + (1 << 20)); },
    bytes: async () => bytes,
  };
}

/** The truth of a recipe without encoding its file (R24). */
export function truthOf(recipe) {
  const p = plan(recipe);
  const t = truthFrom(recipe, p, pagesOf(recipe, p));
  t.size = p.size.bytes ?? null;
  if (!t.refusal && recipe.bound && t.size > recipe.bound) t.refusal = { code: "TOO_LARGE", size: t.size, bound: recipe.bound };
  return t;
}

/** The key a recipe is cached by (for a caller that keys its own derived files). */
export const keyOf = (recipe) => createHash("sha256").update(canonical(recipe)).digest("hex").slice(0, 24);
