/* image-cover: the areas, from the picture as displayed to the pixels as stored, and the one EXIF field kept.
 *
 * An area `[x0, y0, x1, y1]` is a half-open rectangle in the pixels a viewer sees: the stored raster with its EXIF
 * orientation applied (R1). The cover is laid on the stored raster, so each area is mapped back through the
 * orientation, clipped to the image, and only then snapped (by the format's own code) to whole blocks or pixels.
 * The orientation is the only thing of the original's metadata the answer carries (R2): written back as a minimal
 * TIFF structure holding Orientation alone, or not at all when the picture is stored upright. */

/** A refusal raised inside the module and answered as `{ok:false, code, detail}` by `coverAreas`. */
import { localize } from "../setup-words/index.mjs";
import { boundOf } from "../read-bounds.mjs";

/** The largest photo covered or stripped, in bytes; a larger one is refused before a byte of it is read (R3, R4). */
export const COVER_MAX_BYTES = boundOf("image", "cover_bytes");

/** The most pixels a photo may declare; more is refused from its header, before anything is decoded (R3): a small
 *  file can declare a huge image, and the cover's time grows with the pixels. */
export const COVER_MAX_PIXELS = boundOf("image", "pixels");

/** The widest PNG row, in bytes, and the most chunks (PNG), markers (JPEG) or boxes (JP2) an image may hold; a
 *  breach is refused from the headers, before any buffer is sized for it (R10). */
export const COVER_MAX_STRIDE = boundOf("image", "row_stride");
export const COVER_MAX_CHUNKS = boundOf("image", "chunks");

export class CoverRefusal extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}

/** Check the areas' shape before any byte is read (R3 `AREA_MALFORMED`). */
export function checkAreas(areas) {
  if (!Array.isArray(areas)) throw new CoverRefusal("AREA_MALFORMED", "areas must be a list of [x0, y0, x1, y1] rectangles");
  areas.forEach((a, i) => {
    const ok = Array.isArray(a) && a.length === 4 && a.every((v) => Number.isSafeInteger(v)) && a[0] < a[2] && a[1] < a[3];
    if (!ok) throw new CoverRefusal("AREA_MALFORMED", `area ${i} is not four integers [x0, y0, x1, y1] with x0 < x1 and y0 < y1`);
  });
}

/** Refuse a photo declaring more than `max` pixels (R3 `PHOTO_TOO_LARGE`), from its header alone. */
export function checkPixels(w, h, max) {
  if (w * h > max) throw new CoverRefusal("PHOTO_TOO_LARGE", localize("image-cover.geometry.the_photo_declares_w_x", "the photo declares {w} x {h} pixels, over the {max} this module covers", { w: String(w), h: String(h), max: String(max) }));
}

/** Refuse a PNG whose declared row (`stride` bytes) is over the bound (R10 `IMAGE_TOO_LARGE`), before a buffer is sized. */
export function checkStride(stride) {
  if (stride > COVER_MAX_STRIDE)
    throw new CoverRefusal("IMAGE_TOO_LARGE", localize("limit.image.row_stride", "the image declares rows of {size} bytes, over the {bound} this module reads", { size: String(stride), bound: String(COVER_MAX_STRIDE) }));
}

/** Refuse an image holding more than the bound of `unit` (chunks, markers or boxes; R10 `IMAGE_TOO_LARGE`); `count` is
 *  the number reached when the walk stopped. */
export function checkCount(count, unit) {
  if (count > COVER_MAX_CHUNKS)
    throw new CoverRefusal("IMAGE_TOO_LARGE", localize("limit.image.chunks", "the image holds at least {size} {unit}, over the {bound} this module reads", { size: String(count), unit: String(unit), bound: String(COVER_MAX_CHUNKS) }));
}

/** The displayed size of a stored `w` x `h` raster under EXIF orientation `o`. */
export const displayedSize = (w, h, o) => (o >= 5 ? [h, w] : [w, h]);

/* A displayed pixel (dx, dy) back to its stored pixel, for a stored raster W x H (EXIF 2.32 §4.6.5, Orientation). */
function toStored(dx, dy, W, H, o) {
  switch (o) {
    case 2: return [W - 1 - dx, dy];
    case 3: return [W - 1 - dx, H - 1 - dy];
    case 4: return [dx, H - 1 - dy];
    case 5: return [dy, dx];
    case 6: return [dy, H - 1 - dx];
    case 7: return [W - 1 - dy, H - 1 - dx];
    case 8: return [W - 1 - dy, dx];
    default: return [dx, dy];
  }
}

/** Each area as a half-open rectangle `[x0, y0, x1, y1]` of the stored raster, clipped to it. An area wholly
 *  outside the displayed picture is refused `AREA_OUTSIDE` (R3). */
export function storedRects(areas, W, H, o) {
  const [DW, DH] = displayedSize(W, H, o);
  return areas.map((a, i) => {
    const [x0, y0, x1, y1] = a;
    if (x1 <= 0 || y1 <= 0 || x0 >= DW || y0 >= DH)
      throw new CoverRefusal("AREA_OUTSIDE", localize("image-cover.geometry.area_i_lies_wholly_outside", "area {i} lies wholly outside the {DW} x {DH} picture", { i: String(i), DW: String(DW), DH: String(DH) }));
    const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(DW, x1), cy1 = Math.min(DH, y1);
    const [ax, ay] = toStored(cx0, cy0, W, H, o), [bx, by] = toStored(cx1 - 1, cy1 - 1, W, H, o);
    return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx) + 1, Math.max(ay, by) + 1];
  });
}

/** The union of the spans `[c0, c1)` in one row of cells, given each rectangle's cell range; sorted, merged. */
export function mergeSpans(spans) {
  if (spans.length < 2) return spans;
  spans.sort((p, q) => p[0] - q[0]);
  const out = [spans[0].slice()];
  for (let i = 1; i < spans.length; i++) {
    const last = out[out.length - 1], s = spans[i];
    if (s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push(s.slice());
  }
  return out;
}

/* ── EXIF: Orientation in, Orientation alone out ──────────────────────────── */

/** The Orientation (1–8) in a TIFF-structured EXIF block (IFD0, tag 0x0112); 1 when absent or unreadable. */
export function orientationOf(t) {
  if (!t || t.length < 8) return 1;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return 1;
  const u16 = (p) => (p + 2 > t.length ? -1 : le ? t[p] | (t[p + 1] << 8) : (t[p] << 8) | t[p + 1]);
  const u32 = (p) => (p + 4 > t.length ? -1 : le
    ? (t[p] | (t[p + 1] << 8) | (t[p + 2] << 16)) + t[p + 3] * 0x1000000
    : t[p] * 0x1000000 + ((t[p + 1] << 16) | (t[p + 2] << 8) | t[p + 3]));
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  const n = u16(ifd);
  if (ifd < 8 || n < 0) return 1;
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + 12 * i;
    if (e + 12 > t.length) return 1;
    if (u16(e) !== 0x0112) continue;
    if (u16(e + 2) !== 3 || u32(e + 4) !== 1) return 1;
    const v = u16(e + 8);
    return v >= 1 && v <= 8 ? v : 1;
  }
  return 1;
}

/** A TIFF structure holding one IFD with Orientation alone, and no next IFD (so no thumbnail): 26 bytes. */
export function orientationTiff(o) {
  return Uint8Array.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]);
}
