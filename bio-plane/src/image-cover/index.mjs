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

/**
 * What `coverAreas` is asked to cover (R1).
 * @typedef {Object} CoverArgs
 * @property {unknown} [areas] a list of areas `[x0, y0, x1, y1]`, each a half-open rectangle in the picture's pixels as
 *   displayed (its EXIF orientation applied); an empty list covers nothing
 * @bound areas: a list, each area four whole numbers with x0 < x1 and y0 < y1, else AREA_MALFORMED; an area wholly
 *   outside the displayed picture is AREA_OUTSIDE; one partly outside is clipped to the picture
 */
/**
 * A refusal code of `coverAreas` (R3, R10).
 * @typedef {"NOT_A_COVERABLE_FORMAT"|"UNSUPPORTED_JPEG_PROCESS"|"PNG_INTERLACED"|"AREA_MALFORMED"|"AREA_OUTSIDE"|"PHOTO_TOO_LARGE"|"TRUNCATED_IMAGE_DATA"|"IMAGE_DATA_CORRUPT"|"IMAGE_TOO_LARGE"} CoverRefusalCode
 */
/**
 * A refusal code of `stripMetadata` (R8, R10).
 * @typedef {"NOT_A_STRIPPABLE_FORMAT"|"PHOTO_TOO_LARGE"|"TRUNCATED_IMAGE_DATA"|"IMAGE_DATA_CORRUPT"|"ANIMATED_IMAGE"|"IMAGE_TOO_LARGE"} StripRefusalCode
 */
/**
 * The answer of `coverAreas` (R1–R3, R10). When `ok` is true: a fresh image carrying nothing of the original but its
 * pixels, with `bytes`, `format`, `width`, `height` and `covered`. When `ok` is false: the refusal alone, with `code`
 * and `detail`, and nothing else answered.
 * @typedef {Object} CoverAnswer
 * @property {boolean} ok
 * @property {Uint8Array} [bytes] the new image
 * @property {string} [format] the format read, and written
 * @property {number} [width] the picture's width as displayed
 * @property {number} [height] the picture's height as displayed
 * @property {number} [covered] the 8x8 blocks (every component's) or the pixels the cover replaced
 * @property {string} [code] the refusal, one of CoverRefusalCode
 * @property {string} [detail] the fault, in words people read
 * @bound format: "jpeg" or "png"
 * @bound width, height: whole numbers, 1 or more, width times height at most COVER_MAX_PIXELS
 * @bound covered: whole number, zero or more; zero when no area was given
 */
/**
 * The answer of `stripMetadata` (R8, R10). When `ok` is true: the image with what R2 forbids left behind and its
 * coded data copied byte for byte, with `bytes`, `format` and `changed`. When `ok` is false: the refusal alone, with
 * `code` and `detail`, and nothing else answered.
 * @typedef {Object} StripAnswer
 * @property {boolean} ok
 * @property {Uint8Array} [bytes] the image without its metadata; equal to the input when nothing was removed
 * @property {string} [format] the format read
 * @property {boolean} [changed] false exactly when nothing was removed
 * @property {string} [code] the refusal, one of StripRefusalCode
 * @property {string} [detail] the fault, in words people read
 * @bound format: "jpeg", "png", "gif", "webp", "jp2" or "j2k"
 */

/* The ceilings this module keeps are read from `READ_BOUNDS` (R3, R10, R11): `geometry.mjs` holds them. */
export { COVER_MAX_BYTES, COVER_MAX_PIXELS };

/**
 * Every refusal code of `coverAreas`, with what it means (R3).
 * @type {Readonly<Record<CoverRefusalCode, string>>}
 */
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

/**
 * Cover each area of a JPEG or PNG with solid black, in a fresh image (R1–R5).
 * @param {unknown} bytes the photo, a Uint8Array or ArrayBuffer: a baseline or extended-sequential Huffman 8-bit JPEG,
 *   or an 8-bit non-interlaced PNG; anything else is refused by name
 * @param {CoverArgs} [args]
 * @returns {Promise<CoverAnswer>}
 * @bound bytes: at most COVER_MAX_BYTES bytes, else PHOTO_TOO_LARGE with nothing read; declaring at most
 *   COVER_MAX_PIXELS pixels, else PHOTO_TOO_LARGE with nothing decoded; a PNG row of at most READ_BOUNDS image
 *   row_stride bytes, and at most READ_BOUNDS image chunks chunks or markers, else IMAGE_TOO_LARGE before any buffer
 */
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

/**
 * Every refusal code of `stripMetadata`, with what it means (R8).
 * @type {Readonly<Record<StripRefusalCode, string>>}
 */
export const STRIP_REFUSALS = Object.freeze({
  NOT_A_STRIPPABLE_FORMAT: word("refusal.NOT_A_STRIPPABLE_FORMAT"),
  PHOTO_TOO_LARGE: word("refusal.PHOTO_TOO_LARGE"),
  TRUNCATED_IMAGE_DATA: word("refusal.TRUNCATED_IMAGE_DATA"),
  IMAGE_DATA_CORRUPT: word("refusal.IMAGE_DATA_CORRUPT"),
  ANIMATED_IMAGE: word("refusal.ANIMATED_IMAGE"),
  IMAGE_TOO_LARGE: COVER_REFUSALS.IMAGE_TOO_LARGE,
});

/**
 * Strip an image's metadata without re-encoding it (R8): what R2 forbids is left behind, the coded data is kept
 * byte for byte. Never throws.
 * @param {unknown} bytes the image, a Uint8Array or ArrayBuffer: a JPEG of any process, a PNG, a GIF, a WebP, or a JP2
 *   or J2K codestream; anything else is refused by name
 * @returns {StripAnswer}
 * @bound bytes: at most COVER_MAX_BYTES bytes, else PHOTO_TOO_LARGE with nothing read; a PNG row of at most
 *   READ_BOUNDS image row_stride bytes, and at most READ_BOUNDS image chunks chunks, markers or boxes, else
 *   IMAGE_TOO_LARGE before any buffer; one image only, else ANIMATED_IMAGE
 */
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
