/* picturepixels.mjs — a PICTURE FILE (a JPEG or a PNG a member uploaded, a
 * photographed page) as upright grey PNG pixels small enough to send on:
 * pdf-pixels R42 and R43 (T43; N853b; K2611, K2691).
 *
 * WHY IT NEVER HANDS ON THE FILE'S OWN BYTES. A page renderer's DCT pass-through
 * (`pagepixels.mjs`, R22) gives the publisher's JPEG untouched; this does not.
 * agent-worker R63 (Bob's K1888) admits only pixels this system made, so a
 * picture is always decoded, turned, made grey and re-encoded here: a PNG's text
 * chunks, an EXIF block or anything else the file carries never reaches the
 * model. The answer is a PNG this module wrote, or a stated refusal.
 *
 * WHAT "CORRECT" MEANS. Every step is Pillow's own, so an independent reader can
 * reproduce `pixels_sha256`: `ImageOps.exif_transpose` (R43), `convert("L")`
 * (ITU-R 601-2 luma in Pillow's fixed point, `Convert.c`'s `L24`) and
 * `reduce(k)` (`Reduce.c`: a box average whose division is Pillow's fixed-point
 * multiplier, with partial boxes on the right and bottom edges averaged over the
 * pixels present). The JPEG decode is image-codecs' R1, bit-exact with libjpeg;
 * the PNG decode is its R10.
 *
 * MEMORY. A 48-megapixel colour photo is 145 MB of samples, more than the
 * isolate's 128 MB. So a JPEG is decoded WHILE it is reduced (T44; N868): the
 * decoder hands over a strip of finished rows at a time (image-codecs R11) and
 * each row is summed, grey when asked, into the one band of boxes it falls in;
 * only the small picture is kept. The full frame is judged from the HEADER,
 * before anything is allocated, against `PICTURE_SOURCE_MAX`, the reduced one
 * against `PICTURE_FRAME_MAX`. A PNG is still decoded whole (image-codecs R10),
 * so its full frame is judged against `PICTURE_FRAME_MAX` (T43-5's measure).
 *
 * THE PREPARATION (R44; T51, FR-42, K4194). With `prepare: true` the grey picture
 * is also made ready for the engine: the light levelled, the lines turned level,
 * small print enlarged (`preparePicture`). The engine reads a photograph of a
 * page at 43 % of its words without it. Without `prepare` the answer is R42's.
 */

import { readJpegHeader, decodeBaselineJpegRows, DctRefusal } from "./dctdecode.mjs";
import { decodePng, PngRefusal, PNG_REFUSES } from "./pngdecode.mjs";
import { REFUSALS, DCT_TO_REFUSAL, featureReasons, encodePng8, isSource } from "./pagepixels.mjs";
import { boundOf } from "../../bio-plane/src/read-bounds.mjs";

/** The largest frame held whole here, as `width × height × components`
 *  (R42): a PNG's full frame, read from its header, and a JPEG's REDUCED frame,
 *  `ceil(width/k) × ceil(height/k) × components`. 4096 × 3072 × 3, a
 *  12.6-megapixel colour frame, so the 12-megapixel cameras (4032×3024,
 *  4000×3000, 4080×3072) pass whole. Measured at T43-5 (its job record): a
 *  whole decode's live working set is 2.0–2.33 bytes per sample, so this bound
 *  holds it under 88 MB of a 128 MB isolate. */
export const PICTURE_FRAME_MAX = boundOf("image", "picture_frame");

/** The largest JPEG frame decoded here, as `width × height × components` read
 *  from its header (R42, T44): 16384 × 12288 × 3, a 201-megapixel colour
 *  frame, so the 48 MP (8000×6000, 8064×6048) and 200 MP (16320×12240) phone
 *  frames pass either way up. Decoded while reduced, memory no longer grows
 *  with the frame (measured at T44-2, its job record: a peak 13–16 MB over the
 *  process's own, at 48 and at 195 MP, beside the input bytes the caller
 *  holds), so the bound is CPU time: 40–60 ms per megapixel in node, about
 *  12 s for a 200 MP colour reduction, 8 s grey, under a 30 s CPU limit. */
export const PICTURE_SOURCE_MAX = boundOf("image", "picture_source");
const EDGE_MAX = boundOf("image", "edge");

const refuse = (reason, detail = {}) => {
  if (!(reason in REFUSALS)) throw new Error(`undeclared refusal: ${reason}`);
  return { ok: false, reason, why: REFUSALS[reason], ...detail };
};

/* R42: a codec's refusal mapped as R22 and R25 map them, total over PNG_REFUSES
 * (every declared feature is UNSUPPORTED_FILTER unless named here). */
const PNG_FEATURE_REASONS = featureReasons(PNG_REFUSES, {});
export const PNG_CODE_REASONS = { TRUNCATED: "TRUNCATED_IMAGE_DATA", IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE" };
/** The `REFUSALS` reason each PNG_REFUSES feature answers, declared so a test
 *  can see the mapping is total. (The memory key is behind `PICTURE_FRAME_MAX`,
 *  which refuses first.) */
export const PNG_REFUSAL_REASONS = PNG_FEATURE_REASONS;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The picture's format from its first bytes (format-registry R29, R30's
 *  signatures), or null. */
function sniff(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v)) return "png";
  return null;
}

/** A PNG's IHDR: its size and the channels its colour type declares (a palette
 *  counts as the three it expands to). null when the first chunk is not a
 *  well-formed IHDR, which the decoder then refuses in its own words. */
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 3, 4: 2, 6: 4 };
function pngHeader(b) {
  if (b.length < 33) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(8) !== 13 || String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR") return null;
  const comps = PNG_CHANNELS[b[25]];
  return comps ? { width: dv.getUint32(16), height: dv.getUint32(20), comps } : null;
}

/* ── R43: EXIF orientation ────────────────────────────────────────────────────
 * Read as Pillow reads it for `exif_transpose`: the FIRST APP1 segment that
 * opens "Exif\0\0", its TIFF header (II or MM, 42), IFD0's tag 0x0112, the
 * entry's first value. Anything that cannot be read so — no segment, a cut
 * block, a type that is not an integer, a value outside 1–8 — is 1. */
const TIFF_INT = { 1: 1, 3: 2, 4: 4, 8: 2, 9: 4 };   // BYTE, SHORT, LONG, SSHORT, SLONG
export function exifOrientation(b) {
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { p += 2; continue; }
    if (m === 0xda || m === 0xd9) break;
    const len = (b[p + 2] << 8) | b[p + 3];
    const seg = b.subarray(p + 4, Math.min(b.length, p + 2 + len));
    if (m === 0xe1 && seg.length >= 6 && String.fromCharCode(...seg.subarray(0, 6)) === "Exif\0\0") {
      return orientationIn(seg.subarray(6));
    }
    p += 2 + len;
  }
  return 1;
}
function orientationIn(t) {
  if (t.length < 8) return 1;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return 1;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) return 1;
    if (u16(e) !== 0x0112) continue;
    const size = TIFF_INT[u16(e + 2)], count = u32(e + 4);
    if (!size || count < 1) return 1;
    const at = size * count <= 4 ? e + 8 : u32(e + 8);
    if (at + size > t.length) return 1;
    const v = size === 1 ? t[at] : size === 2 ? u16(at) : u32(at);
    return v >= 1 && v <= 8 ? v : 1;
  }
  return 1;
}

/* ── R42 (T44): the boxes, mapped back to the source ─────────────────────────
 * The answer is Pillow's `exif_transpose`, `convert("L")` and `reduce(k)` over
 * the full decode; nothing full-size is made to get it. Each orientation is a
 * map from the source's two axes to the oriented picture's: which oriented axis
 * a source axis becomes, and whether it runs backwards. A source axis of length
 * L, run forwards, falls in boxes floor(i/k) with the partial box at its far
 * end; run backwards, in floor((L-1-i)/k), the partial box at its near end, so
 * a partial box lies on the source edge that becomes the oriented picture's
 * right or bottom edge, where Pillow's lies (draft-T44 N868 doubt 4).
 *   orientation: [x becomes X (not Y)?, x reversed?, y reversed?]
 * 1 as stored; 2 mirror; 3 turn 180; 4 flip; 5 transpose; 6 turn 90 clockwise;
 * 7 transverse; 8 turn 270 clockwise. */
const AXES = [null,
  [true, false, false], [true, true, false], [true, true, true], [true, false, true],
  [false, false, false], [false, false, true], [false, true, true], [false, true, false]];

/* R43, R48: the orientation that is `o` followed by a clockwise turn of `deg`.
 * Each orientation is the signed permutation it applies to (x, y); a clockwise
 * quarter turn on a picture with y downwards is (x, y) -> (-y, x). */
const matrixOf = (o) => {
  const [xToX, xRev, yRev] = AXES[o];
  const sx = xRev ? -1 : 1, sy = yRev ? -1 : 1;
  return xToX ? [sx, 0, 0, sy] : [0, sy, sx, 0];
};
function turnedOrientation(o, deg) {
  let m = matrixOf(o);
  for (let q = deg / 90; q > 0; q--) m = [-m[2], -m[3], m[0], m[1]];
  for (let c = 1; c <= 8; c++) if (matrixOf(c).every((v, i) => v === m[i])) return c;
  throw new Error(`no orientation for ${o} turned ${deg}`);
}

/** The orientation's picture size: 5–8 swap the sides. */
const orientedSize = (w, h, o) => (AXES[o][0] ? [w, h] : [h, w]);

/** The box each index along a source axis of `len` falls in, for factor k. */
function boxMap(len, k, reversed) {
  const m = new Int32Array(len);
  for (let i = 0; i < len; i++) m[i] = Math.floor((reversed ? len - 1 - i : i) / k);
  return m;
}

/* ── R42: grey and reduction, strip by strip ─────────────────────────────────
 * Pillow's `convert("L")` is (R·19595 + G·38470 + B·7471 + 0x8000) >> 16 per
 * pixel; its `reduce(k)` (`Reduce.c`) sums each k×k box (a partial box on the
 * right or bottom edge over the pixels present) and divides a full box by a
 * shift when k is 2 or 4 (its own 2x2 and 4x4 paths), any other box by its
 * fixed-point multiplier. Source rows arrive top to bottom, a strip at a time
 * (image-codecs R11); a source row falls in one band of boxes, so only that
 * band's sums are held, and the band is written out to the small picture as
 * soon as the rows move on to the next. */

/** Pillow's `division_UINT32(n, 8)`: 2^32 / (256·n) in single precision,
 *  truncated. */
const multiplier = (n) => Math.trunc(Math.fround(4294967296 / Math.fround(256 * n)));

/** The smallest integer k with ceil(longEdge / k) ≤ maxEdge. */
export const reductionFor = (width, height, maxEdge) => Math.max(1, Math.ceil(Math.max(width, height) / maxEdge));

/** A reducer for a source picture of `w × h × comps`, oriented by `orientation`
 *  (R43) and reduced by k: `rows(strip, y0, count)` takes source rows in order,
 *  `done()` answers the reduced picture. */
function reducer(w, h, comps, { grey, orientation, k }) {
  const [xToX, xRev, yRev] = AXES[orientation];
  const oc = grey && comps === 3 ? 1 : comps;
  const xBox = boxMap(w, k, xRev), yBox = boxMap(h, k, yRev);
  const nbx = Math.ceil(w / k), nby = Math.ceil(h / k);
  const W = xToX ? nbx : nby, H = xToX ? nby : nbx;
  const out = new Uint8Array(W * H * oc);
  const sums = new Float64Array(nbx * oc);
  const shift = k === 2 ? 2 : k === 4 ? 4 : 0;
  let band = -1, bandRows = 0, seen = 0;
  const flush = () => {
    const bh = bandRows;
    for (let bx = 0; bx < nbx; bx++) {
      const bw = Math.min(k, w - bx * k), n = bw * bh, amend = n >> 1;
      const mul = bw === k && bh === k && shift ? 0 : multiplier(n);
      const o = (xToX ? band * W + bx : bx * W + band) * oc;
      for (let c = 0; c < oc; c++) {
        const s = sums[bx * oc + c];
        out[o + c] = mul ? Math.floor(((s + amend) * mul) / 16777216) : (s + amend) >>> shift;
      }
    }
    sums.fill(0);
    bandRows = 0;
  };
  const toGrey = oc !== comps;
  return {
    rows(strip, y0, count) {
      if (y0 !== seen) throw new Error(`rows out of order: ${y0} after ${seen}`);
      const stride = w * comps;
      for (let r = 0; r < count; r++) {
        const b = yBox[y0 + r];
        if (b !== band) { if (band >= 0) flush(); band = b; }
        bandRows++;
        let i = r * stride;
        if (toGrey) {
          for (let x = 0; x < w; x++, i += 3) sums[xBox[x]] += (strip[i] * 19595 + strip[i + 1] * 38470 + strip[i + 2] * 7471 + 0x8000) >>> 16;
        } else if (oc === 1) {
          for (let x = 0; x < w; x++) sums[xBox[x]] += strip[i++];
        } else {
          for (let x = 0; x < w; x++) { const s = xBox[x] * oc; for (let c = 0; c < oc; c++) sums[s + c] += strip[i++]; }
        }
      }
      seen += count;
    },
    done() {
      if (seen !== h) throw new Error(`${seen} of ${h} rows`);
      flush();
      return { samples: out, width: W, height: H, comps: oc };
    },
  };
}

async function sha256Hex(u8) {
  const d = await crypto.subtle.digest("SHA-256", u8);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


/* ── R44: the preparation for the engine ─────────────────────────────────────
 * A photograph of a page is read badly for three reasons the picture itself
 * shows: the light is uneven and the paper grey, the page is tilted, and the
 * letters are small. `prepare` (an opt-in of `renderPictureToPixels`, so R42's
 * Pillow-exact answer stays the default) answers them in this order, all in
 * integer-exact or fixed-order float arithmetic, so a call is a pure function
 * of its bytes (R40):
 *   1. LEVEL the light: the paper's brightness is taken per cell (the mean of
 *      the brighter half of the cell's pixels, so ink does not darken it),
 *      smoothed, and each pixel is divided by it; the picture is then stretched
 *      so the paper reads 255 and the ink's own level (the darkest twentieth of
 *      the ink pixels, however few they are) 0.
 *   2. DESKEW: the ink pixels' row profile is sharpest at the angle the lines
 *      run; searched over ±PREPARE_TILT_MAX degrees (0.25 steps, then 0.05).
 *   3. SCALE UP: the median text line's height is measured; a picture whose
 *      lines are shorter than PREPARE_LINE_PX is enlarged (bicubic) to reach
 *      it, by no more than PREPARE_SCALE_MAX, and never past `maxEdge`.
 * The turn and the enlargement are one resampling, so the picture is smoothed
 * once. Pictures are never reduced here. */

/** The tilt searched, in degrees either way. */
export const PREPARE_TILT_MAX = 10;
/** The text line height, in pixels, a small-print picture is enlarged to. 20, not 40 (T51 fix round 2, C18): enlarging a
 *  blurred page further only enlarges its blur. Measured through the engine on the hard photograph (231 words, 110 dpi,
 *  blur): lines to 40 px read 48 percent, to 20 px 56; the clean and noisy photographs read 97-100 percent at either. */
export const PREPARE_LINE_PX = 20;
/** The largest enlargement. */
export const PREPARE_SCALE_MAX = 4;
/** A tilt under this many degrees is left as it is (no turn). */
export const PREPARE_TILT_FLOOR = 0.1;

/** A [1 2 1]×[1 2 1] blur, edges clamped: takes the grain out of a noisy photograph
 *  before the paper and the ink are told apart. */
function smooth(g, w, h) {
  const t = new Uint16Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = g[y * w + Math.max(0, x - 1)], c = g[y * w + x], r = g[y * w + Math.min(w - 1, x + 1)];
    t[y * w + x] = l + 2 * c + r;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out[y * w + x] = (t[Math.max(0, y - 1) * w + x] + 2 * t[y * w + x] + t[Math.min(h - 1, y + 1) * w + x] + 8) >> 4;
  }
  return out;
}

/** A pixel under this share (of 255) of the paper beneath it is ink; fewer than INK_MIN of them is no ink. A faint print
 *  (a thermal receipt, ink at 80 to 90 percent of the paper) has none under INK_RATIO: `preparePicture` levels it again
 *  with the share INK_RATIO_FAINT when the first pass found no text lines, and keeps that only if it finds them
 *  (T52-4, C-K13). The faint share alone would take a blank photograph's grain for ink (R44 (d)): the faint ink must be at
 *  least INK_FAINT_SHARE of the pixels (a blank photograph holds a hundredth of that, a three-line receipt several times it). */
const INK_RATIO = 200, INK_RATIO_FAINT = 228, INK_MIN = 32, INK_FAINT_SHARE = 0.001;

/** Levels the light and stretches the contrast in place; returns the grey. */
function levelLight(g, w, h, faint = false) {
  const cell = Math.max(12, Math.min(64, Math.round(Math.max(w, h) / 60)));
  const cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
  let bg = new Float32Array(cw * ch);
  const hist = new Uint32Array(256);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    hist.fill(0);
    const x1 = Math.min(w, (cx + 1) * cell), y1 = Math.min(h, (cy + 1) * cell);
    let n = 0;
    for (let y = cy * cell; y < y1; y++) for (let x = cx * cell; x < x1; x++) { hist[g[y * w + x]]++; n++; }
    /* the mean of the brighter half */
    let need = n >> 1, sum = 0, cnt = 0;
    for (let v = 255; v >= 0 && cnt < (n - need); v--) {
      const take = Math.min(hist[v], (n - need) - cnt);
      sum += take * v; cnt += take;
    }
    bg[cy * cw + cx] = Math.max(1, sum / Math.max(1, cnt));
  }
  /* smooth: two 3×3 box passes */
  for (let pass = 0; pass < 2; pass++) {
    const nx = new Float32Array(bg.length);
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const y = cy + dy, x = cx + dx;
        if (y >= 0 && y < ch && x >= 0 && x < cw) { s += bg[y * cw + x]; c++; }
      }
      nx[cy * cw + cx] = s / c;
    }
    bg = nx;
  }
  /* ratio per pixel, bilinear on the cell centres; the ink level from a histogram of ratios */
  const half = cell / 2;
  const at = (x, y) => {
    const fx = Math.min(cw - 1, Math.max(0, (x - half) / cell)), fy = Math.min(ch - 1, Math.max(0, (y - half) / cell));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(cw - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    return (bg[y0 * cw + x0] * (1 - tx) + bg[y0 * cw + x1] * tx) * (1 - ty) + (bg[y1 * cw + x0] * (1 - tx) + bg[y1 * cw + x1] * tx) * ty;
  };
  const ratio = new Uint8Array(w * h), rh = new Uint32Array(256);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.min(255, Math.round(255 * g[y * w + x] / at(x + 0.5, y + 0.5)));
    ratio[y * w + x] = r; rh[r]++;
  }
  /* The ink level comes from the ink, not from a fixed share of all the pixels (R44 (a)): a page of three lines holds
   * under half a percent ink, and a level taken there falls among the paper's own greys and turns the page dark. The
   * ink is the pixels well under the paper (ratio under INK_RATIO); its level is the darkest twentieth of them. A
   * picture with next to no such pixels has no ink to level by: its paper is stretched to 255 and nothing more. */
  const inkRatio = faint ? INK_RATIO_FAINT : INK_RATIO;
  let inkN = 0;
  for (let v = 0; v < inkRatio; v++) inkN += rh[v];
  let lo = 0;
  if (inkN >= (faint ? Math.max(INK_MIN, w * h * INK_FAINT_SHARE) : INK_MIN)) {
    const target = Math.max(1, Math.round(inkN * 0.05));
    let acc = 0;
    while (lo < inkRatio - 1 && (acc += rh[lo]) < target) lo++;
  }
  const hi = 235;
  const span = Math.max(32, hi - lo);
  for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, Math.round((ratio[i] - lo) * 255 / span)));
  return g;
}

/** The tilt, in degrees (positive = the lines run clockwise down the page), of the
 *  text lines in a levelled grey picture; 0 when there is no ink to tell by. */
function skewOf(g, w, h) {
  const xs = [], ys = [];
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 400000)));
  for (let y = 0; y < h; y += 1) for (let x = (y % step); x < w; x += step) if (g[y * w + x] < 96) { xs.push(x); ys.push(y); }
  if (xs.length < 200) return 0;
  const cx = w / 2, cy = h / 2, n = xs.length;
  const bins = new Uint32Array(w + h + 8);
  const score = (deg) => {
    const t = deg * Math.PI / 180, s = Math.sin(t), c = Math.cos(t);
    bins.fill(0);
    const off = (w + h) >> 1;
    for (let i = 0; i < n; i++) bins[Math.round((ys[i] - cy) * c - (xs[i] - cx) * s + off)]++;
    let sq = 0; for (let i = 0; i < bins.length; i++) sq += bins[i] * bins[i];
    return sq;
  };
  let best = 0, bs = -1;
  for (let a = -PREPARE_TILT_MAX; a <= PREPARE_TILT_MAX + 1e-9; a += 0.25) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  const centre = best;
  for (let a = centre - 0.25; a <= centre + 0.25 + 1e-9; a += 0.05) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  return Math.round(best * 100) / 100;
}

/** The text lines (runs of rows holding ink) of a deskewed levelled grey picture:
 *  how many, and the median height of one in pixels. */
function textLines(g, w, h) {
  const rows = new Uint32Array(h);
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) if (g[y * w + x] < 96) c++; rows[y] = c; }
  const floor = Math.max(2, Math.round(w * 0.004));
  const runs = [];
  let start = -1, gap = 0;
  for (let y = 0; y <= h; y++) {
    const ink = y < h && rows[y] >= floor;
    if (ink) { if (start < 0) start = y; gap = 0; }
    else if (start >= 0) { gap++; if (gap > 1 || y === h) { runs.push(y - gap - start + 1); start = -1; gap = 0; } }
  }
  const real = runs.filter((r) => r >= 4).sort((a, b) => a - b);
  return { lines: real.length, median: real.length ? real[real.length >> 1] : 0 };
}

/** One resampling: the grey `g` (w×h) turned by `deg` and scaled by `s`, bicubic
 *  (Catmull-Rom), paper-white where the source has no pixel; the canvas grows to
 *  hold the turned picture whole. */
function resample(g, w, h, deg, s) {
  const t = deg * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
  const bw = Math.abs(w * cs) + Math.abs(h * sn), bh = Math.abs(w * sn) + Math.abs(h * cs);
  const W = Math.max(1, Math.round(bw * s)), H = Math.max(1, Math.round(bh * s));
  const out = new Uint8Array(W * H);
  const cxs = w / 2, cys = h / 2, cxo = W / 2, cyo = H / 2;
  const wt = (d) => { const a = Math.abs(d); return a < 1 ? 1.5 * a * a * a - 2.5 * a * a + 1 : a < 2 ? -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2 : 0; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - cxo) / s, dy = (y + 0.5 - cyo) / s;
    const sx = dx * cs - dy * sn + cxs - 0.5, sy = dx * sn + dy * cs + cys - 0.5;
    if (sx < -1 || sy < -1 || sx > w || sy > h) { out[y * W + x] = 255; continue; }
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    let acc = 0, wsum = 0;
    for (let j = -1; j <= 2; j++) {
      const yy = Math.min(h - 1, Math.max(0, y0 + j)), wy = wt(sy - (y0 + j));
      for (let i = -1; i <= 2; i++) {
        const xx = Math.min(w - 1, Math.max(0, x0 + i)), wx = wt(sx - (x0 + i));
        acc += g[yy * w + xx] * wx * wy; wsum += wx * wy;
      }
    }
    out[y * W + x] = Math.max(0, Math.min(255, Math.round(acc / wsum)));
  }
  return { samples: out, width: W, height: H };
}

/** R44: a grey picture made ready for the engine. `{samples, width, height, comps:1,
 *  prepared:{text_found, tilt_deg, scale, line_px}}` (`line_px`: the median text line's height in the answered picture). A picture with no text lines
 *  in it (no ink, or ink everywhere: noise, a blank wall) is handed on as it is,
 *  `text_found:false`: stretching its noise would make marks for the engine to read. */
export function preparePicture({ samples, width: w, height: h }, maxEdge) {
  const smoothed = smooth(samples, w, h);
  const level = (faint) => {
    const g = levelLight(smoothed.slice(), w, h, faint);
    const deskew = skewOf(g, w, h);
    const turn = Math.abs(deskew) < PREPARE_TILT_FLOOR ? 0 : deskew;
    /* the line height is measured on the picture as it will lie: turn, then measure */
    const cur = turn ? resample(g, w, h, turn, 1) : { samples: g, width: w, height: h };
    return { g, turn, cur, ...textLines(cur.samples, cur.width, cur.height) };
  };
  const noText = (m) => m.lines < 2 || m.median > m.cur.height / 4;
  let m = level(false);
  if (noText(m)) { const f = level(true); if (!noText(f)) m = f; }
  if (noText(m))
    return { samples, width: w, height: h, comps: 1, prepared: { text_found: false, tilt_deg: 0, scale: 1, line_px: 0 } };
  const { g, turn, median } = m;
  let cur = m.cur;
  let scale = median < PREPARE_LINE_PX ? Math.min(PREPARE_SCALE_MAX, PREPARE_LINE_PX / median) : 1;
  scale = Math.min(scale, maxEdge / Math.max(cur.width, cur.height));
  scale = scale < 1.05 ? 1 : Math.round(scale * 100) / 100;
  if (scale !== 1) cur = resample(g, w, h, turn, scale);
  return { samples: cur.samples, width: cur.width, height: cur.height, comps: 1,
           prepared: { text_found: true, tilt_deg: turn ? -turn : 0, scale, line_px: Math.round(median * scale) } };
}
/* ── the renderer ─────────────────────────────────────────────────────────── */

/**
 * A picture file as upright pixels (R42): `{ok:true, page:0, route:"decoded-picture",
 * mediaType:"image/png", bytes, width, height, upright:true, orientation,
 * reduced_by, source:{format, width, height, comps}, pixels_sha256}`, or a
 * refusal from `REFUSALS`. `maxEdge` (a positive integer) bounds the long edge;
 * `grey` turns the picture grey.
 */
export async function renderPictureToPixels(bytes, pageIndex, { maxEdge, grey = false, prepare = false, turn: turnAsked = 0 } = {}) {
  if (!Number.isInteger(maxEdge) || maxEdge < 1) throw new TypeError("renderPictureToPixels: maxEdge must be a positive integer");
  if (prepare) grey = true;   /* R44: the preparation works on grey */
  const turn = [90, 180, 270].includes(turnAsked) ? turnAsked : 0;   /* R48 */
  if (isSource(bytes)) bytes = await bytes.readRange(0, bytes.size);   /* R47: a picture is read whole */
  const b = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
  const format = b && sniff(b);
  if (!format) return refuse("NOT_A_PICTURE");
  if (pageIndex !== 0) return refuse("NO_SUCH_PAGE", { page: pageIndex, pageCount: 1 });

  if (format === "jpeg") {
    let h;
    try { h = readJpegHeader(b); } catch (e) { return jpegRefusal(e); }
    const source = { format, width: h.frame.width, height: h.frame.height, comps: h.frame.comps.length };
    const orientation = exifOrientation(b);
    const applied = turnedOrientation(orientation, turn);
    const k = reductionFor(...orientedSize(source.width, source.height, applied), maxEdge);
    const tooBig = overEdge(source) ?? overBound(source, PICTURE_SOURCE_MAX, "PICTURE_SOURCE_MAX") ?? overReduced(source, k);
    if (tooBig) return tooBig;
    /* Decoded while reduced (T44): the decoder hands over a strip of finished
     * rows at a time and only the reduced picture is kept. */
    const red = reducer(source.width, source.height, source.comps, { grey, orientation: applied, k });
    try { decodeBaselineJpegRows(b, { onRows: (rows, y0, count) => red.rows(rows, y0, count) }); } catch (e) { return jpegRefusal(e); }
    return answer(red.done(), { source, orientation, k, turn }, prepare, maxEdge);
  }

  /* A PNG is decoded whole (image-codecs R10) and judged on its full frame
   * against PICTURE_FRAME_MAX; it is never turned (R43). */
  const hd = pngHeader(b);
  const source = { format, width: hd ? hd.width : null, height: hd ? hd.height : null, comps: hd ? hd.comps : null };
  const tooBig = hd && (overEdge(source) ?? overBound(source, PICTURE_FRAME_MAX, "PICTURE_FRAME_MAX"));
  if (tooBig) return tooBig;
  let pic;
  try { pic = await decodePng(b); } catch (e) { return pngRefusal(e); }
  if (!hd) Object.assign(source, { width: pic.width, height: pic.height, comps: pic.comps });
  const applied = turnedOrientation(1, turn);
  const k = reductionFor(...orientedSize(pic.width, pic.height, applied), maxEdge);
  const red = reducer(pic.width, pic.height, pic.comps, { grey, orientation: applied, k });
  red.rows(pic.samples, 0, pic.height);
  pic.samples = null;
  return answer(red.done(), { source, orientation: 1, k, turn }, prepare, maxEdge);
}

async function answer(r, { source, orientation, k, turn }, prepare, maxEdge) {
  const prepared = prepare ? preparePicture(r, maxEdge) : null;
  if (prepared) r = prepared;
  return {
    ok: true, page: 0, route: "decoded-picture", mediaType: "image/png",
    bytes: await encodePng8(r.samples, r.width, r.height, r.comps),
    width: r.width, height: r.height, upright: true,
    orientation, turned_deg: turn, reduced_by: k, source,
    ...(prepared ? { prepared: prepared.prepared } : {}),
    pixels_sha256: await sha256Hex(r.samples),
  };
}

/** The header's frame against a bound, before any decode. */
function overBound({ width, height, comps }, bound, name) {
  const samples = width * height * comps;
  return samples > bound
    ? refuse("IMAGE_TOO_LARGE", { page: 0, width, height, comps, samples, bound, bound_name: name })
    : null;
}

/** Either side of the header's frame against the edge bound (R42, R46). */
function overEdge({ width, height, comps }) {
  return width > EDGE_MAX || height > EDGE_MAX
    ? refuse("IMAGE_TOO_LARGE", { page: 0, width, height, comps, bound: EDGE_MAX, bound_name: "edge" })
    : null;
}

/** A JPEG's reduced frame, `ceil(width/k) × ceil(height/k) × components`,
 *  against PICTURE_FRAME_MAX (T44). */
function overReduced({ width, height, comps }, k) {
  const samples = Math.ceil(width / k) * Math.ceil(height / k) * comps;
  return samples > PICTURE_FRAME_MAX
    ? refuse("IMAGE_TOO_LARGE", { page: 0, width, height, comps, reduced_by: k, samples, bound: PICTURE_FRAME_MAX, bound_name: "PICTURE_FRAME_MAX" })
    : null;
}

function jpegRefusal(e) {
  if (!(e instanceof DctRefusal)) return refuse("DECODE_FAILED", { page: 0, note: String(e && e.message || e) });
  return refuse(DCT_TO_REFUSAL[e.code] || "DECODE_FAILED", { page: 0, jpeg: e.code, ...e.detail });
}

function pngRefusal(e) {
  if (!(e instanceof PngRefusal)) return refuse("DECODE_FAILED", { page: 0, note: String(e && e.message || e) });
  const reason = e.code === "UNSUPPORTED" ? PNG_FEATURE_REASONS[e.detail?.feature] ?? "UNSUPPORTED_FILTER"
    : PNG_CODE_REASONS[e.code] || "DECODE_FAILED";
  return refuse(reason, { page: 0, png: e.code, ...e.detail });
}
