/* image-cover: a solid cover over the marked areas of a photo, in a new image that carries nothing of the original
 * but its pixels (DEC-180 (4), K2108; requirements `build/requirements/image-cover.md`).
 *
 * `coverAreas(bytes, {areas})` answers a Promise of `{ok: true, bytes, format, width, height, covered}` or
 * `{ok: false, code, detail}`. `format` is "jpeg" or "png"; `width` and `height` are the picture as displayed (its
 * EXIF orientation applied), the frame the areas are given in; `covered` counts the 8x8 blocks (every component's)
 * or the pixels the cover replaced. Pure (R6): no clock, no randomness, no I/O, nothing kept between calls. The
 * JPEG path is `jpeg.mjs`, the PNG path `png.mjs`, the areas and the orientation `geometry.mjs`.
 *
 * `stripMetadata(bytes)` answers `{ok: true, bytes, format, changed}` or `{ok: false, code, detail}`, synchronously
 * and never throwing (R8): the image's metadata left behind without re-encoding it, the coded data copied byte for
 * byte (`strip.mjs`). `format` is "jpeg", "png", "gif", "webp", "jp2" or "j2k"; `changed` is false exactly when
 * nothing was removed, and then `bytes` equal the input. */
import { CoverRefusal, checkAreas, COVER_MAX_BYTES, COVER_MAX_PIXELS } from "./geometry.mjs";
import { coverJpeg } from "./jpeg.mjs";
import { coverPng } from "./png.mjs";
import { stripImage } from "./strip.mjs";
import { localize, word } from "../setup-words/index.mjs";

/* The ceilings this module keeps are read from `READ_BOUNDS` (R3, R10, R11): `geometry.mjs` holds them. */
export { COVER_MAX_BYTES, COVER_MAX_PIXELS };

/** Every refusal code, with what it means (R3). */
export const COVER_REFUSALS = Object.freeze({
  NOT_A_COVERABLE_FORMAT: word("refusal.NOT_A_COVERABLE_FORMAT"),
  UNSUPPORTED_JPEG_PROCESS: word("refusal.UNSUPPORTED_JPEG_PROCESS"),
  PNG_INTERLACED: word("refusal.PNG_INTERLACED"),
  AREA_MALFORMED: word("refusal.AREA_MALFORMED"),
  AREA_OUTSIDE: word("refusal.AREA_OUTSIDE"),
  PHOTO_TOO_LARGE: word("refusal.PHOTO_TOO_LARGE"),
  TRUNCATED_IMAGE_DATA: word("refusal.TRUNCATED_IMAGE_DATA"),
  IMAGE_DATA_CORRUPT: word("refusal.IMAGE_DATA_CORRUPT"),
  /* a stand-in: the held row of this code speaks of a page image to transcribe; the row owed is this module's (R10) */
  IMAGE_TOO_LARGE: localize("image-cover.index.image_too_large", "The photo is too large to cover safely, so it was refused. Nothing was changed."),
});

const isJpeg = (d) => d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff;
const isPng = (d) => d.length >= 8 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47 &&
  d[4] === 0x0d && d[5] === 0x0a && d[6] === 0x1a && d[7] === 0x0a;

/** Cover each area of a JPEG or PNG with solid black, in a fresh image (R1–R5). */
export async function coverAreas(bytes, { areas } = {}) {
  try {
    const d = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
    if (!d) throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", localize("image-cover.index.the_photos_bytes_are_not_a_byte_array", "the photo's bytes are not a byte array"));
    if (d.length > COVER_MAX_BYTES)
      throw new CoverRefusal("PHOTO_TOO_LARGE", localize("image-cover.index.the_photo_is_length_bytes", "the photo is {length} bytes, over the {COVER_MAX_BYTES} this module covers", { length: String(d.length), COVER_MAX_BYTES: String(COVER_MAX_BYTES) }));
    checkAreas(areas);
    let answer;
    if (isJpeg(d)) answer = coverJpeg(d, areas, COVER_MAX_PIXELS);
    else if (isPng(d)) answer = await coverPng(d, areas, COVER_MAX_PIXELS);
    else throw new CoverRefusal("NOT_A_COVERABLE_FORMAT", localize("image-cover.index.the_photo_is_neither_a_jpeg_nor_a_png", "the photo is neither a JPEG nor a PNG"));
    return { ok: true, ...answer };
  } catch (e) {
    if (e instanceof CoverRefusal) return { ok: false, code: e.code, detail: e.detail };
    throw e;
  }
}

/** Every refusal of `stripMetadata`, with what it means (R8). */
export const STRIP_REFUSALS = Object.freeze({
  NOT_A_STRIPPABLE_FORMAT: word("refusal.NOT_A_STRIPPABLE_FORMAT"),
  PHOTO_TOO_LARGE: word("refusal.PHOTO_TOO_LARGE"),
  TRUNCATED_IMAGE_DATA: word("refusal.TRUNCATED_IMAGE_DATA"),
  IMAGE_DATA_CORRUPT: word("refusal.IMAGE_DATA_CORRUPT"),
  ANIMATED_IMAGE: word("refusal.ANIMATED_IMAGE"),
  IMAGE_TOO_LARGE: COVER_REFUSALS.IMAGE_TOO_LARGE,
});

/** Strip an image's metadata without re-encoding it (R8): what R2 forbids is left behind, the coded data is kept
 *  byte for byte. Never throws. */
export function stripMetadata(bytes) {
  try {
    const d = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
    if (!d) throw new CoverRefusal("NOT_A_STRIPPABLE_FORMAT", localize("image-cover.index.the_images_bytes_are_not_a_byte_array", "the image's bytes are not a byte array"));
    if (d.length > COVER_MAX_BYTES)
      throw new CoverRefusal("PHOTO_TOO_LARGE", localize("image-cover.index.the_image_is_length_bytes", "the image is {length} bytes, over the {COVER_MAX_BYTES} this module reads", { length: String(d.length), COVER_MAX_BYTES: String(COVER_MAX_BYTES) }));
    return { ok: true, ...stripImage(d) };
  } catch (e) {
    if (e instanceof CoverRefusal) return { ok: false, code: e.code, detail: e.detail };
    return { ok: false, code: "IMAGE_DATA_CORRUPT", detail: localize("image-cover.index.the_images_structure_cannot_be", "the image's structure cannot be walked ({v1})", { v1: String(e?.message || e) }) };
  }
}
