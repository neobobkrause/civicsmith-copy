/* imagecrop.mjs — CPDF-18: the CROP of a cited PDF image, as a DERIVED RENDITION.
 *
 * EXTRACTION-BREADTH §3.4: "The capture's bytes and the extent, verified as the
 * capture is. The viewer shows the crop; the crop is not the evidence." So this
 * module produces the thing a viewer shows and says, on every answer, that it is
 * derived — the render companion's rule (CAPTURE-FIDELITY: a separate derived
 * artifact beside bytes that are never rewritten). Nothing here touches the
 * provenance chain, writes anything, or is the address of anything: the content
 * row's address is `{page, rect}` over the capture, and a crop can be re-derived
 * from those two facts by anyone holding the capture.
 *
 * WHAT A "CROP" IS HERE, precisely, because the obvious reading is not what is
 * built. There is no page rasteriser in this fleet (CPDF-12 measured that a
 * canvas is absent on workerd and did not build one). So the crop of an image
 * cited by `{page, rect}` is THE IMAGE THE PAGE PAINTS AT THAT RECTANGLE, taken
 * from the file: the XObject whose placement `pdfPageImages` reports at exactly
 * that rect, decoded through `pagepixels.mjs`'s own `decodeImage` (imported,
 * never re-derived). It is the image as the FILE STORES it:
 *   - marks drawn OVER the image and any clipping are NOT composited;
 *   - the placement's own flip or rotation is NOT applied (`placement` states
 *     the rectangle and `axis_aligned`, and `upright` is null when the placement
 *     is not a plain scale-and-translate, because this module does not know);
 *   - a DCT image is the publisher's own JPEG bytes, untouched (pass-through).
 *
 * THE REFUSALS ARE NAMED, and the first is the negative control EXTRACTION-
 * BREADTH §8 / the CPDF-18 row declares: a reference with the rect DROPPED
 * cannot be cropped — "an image on page 3" names no one image when a page
 * paints several, and choosing one would be inventing the citation's referent.
 */

import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { pdfPageImages, imagePlacementSource } from "../../bio-plane/src/pdfstructure.mjs";
import { loadPdf, decodeImage, imageOf } from "./pagepixels.mjs";
/** @import { Route } from "./pagepixels.mjs" */

/** Every reason a crop can refuse with (R39): a key of `CROP_REFUSALS`.
 *  @typedef {"NOT_AN_IMAGE_EXTENT" | "RECT_REQUIRED" | "NOT_A_PDF" | "ENCRYPTED" | "NO_SUCH_PAGE" | "PAGE_UNWALKABLE"
 *    | "NO_IMAGE_AT_RECT" | "AMBIGUOUS_RECT" | "INLINE_IMAGE" | "DECODE_REFUSED"} CropRefusalReason */
/** A content row's extent as handed in (R27): only `{kind: "image", page, rect}` with four finite numbers and no `part` is
 *  cropped; anything else is refused by name.
 *  @typedef {Object} CropExtent
 *  @property {string} [kind]
 *  @property {number} [page]
 *  @property {readonly number[] | null} [rect]
 *  @property {string | number | null} [part] */
/** The evidence a crop's refusal carries (R27-R31).
 *  @typedef {Object} CropRefusalDetail
 *  @property {CropExtent} [extent] the extent refused
 *  @property {number} [page]
 *  @property {number} [pageCount]
 *  @property {string} [detail] pdf-reader's own why, when the page cannot be walked (R29)
 *  @property {number[]} [rect] the rectangle asked for, normalised
 *  @property {number[][]} [painted] every rectangle the page paints an image at (R30)
 *  @property {number} [count] how many images the page paints at the rectangle (R30)
 *  @property {string} [decoder] the decoder's own refusal reason (R31)
 *  @property {string} [decoderWhy] and its text */
/** A crop's stated refusal (R27-R31, R39): always marked derived.
 *  @typedef {{ ok: false, derived: true, reason: CropRefusalReason, why: string } & CropRefusalDetail} CropRefusal */
/** A crop: the image a page paints at a rectangle, as a derived rendition for display (R32-R34).
 *  @typedef {Object} Crop
 *  @property {true} ok
 *  @property {true} derived
 *  @property {"crop"} rendition
 *  @property {string} why
 *  @property {{ kind: "image", page: number, rect: number[] }} of
 *  @property {string} capture_sha256 of the whole capture
 *  @property {{ name: string | null, axis_aligned: boolean, filters: string[] }} placement
 *  @property {Route} route
 *  @property {"image/png" | "image/jpeg"} mediaType
 *  @property {Uint8Array} bytes
 *  @property {number | null} width
 *  @property {number | null} height
 *  @property {true | null} upright true only when known upright (R33), else null
 *  @property {string} file_sha256 of the returned bytes
 *  @property {string} [pixels_sha256] on a decoded route only */
/** @typedef {Crop | CropRefusal} CropAnswer */

export const CROP_REFUSALS = Object.freeze({
  NOT_AN_IMAGE_EXTENT: "the extent is not an `image` extent in its PDF form ({kind:'image', page, rect})",
  RECT_REQUIRED: localize("pdf-pixels.imagecrop.the_extent_names_a_page", "the extent names a page and no rectangle, so it names no one image to crop"),
  NOT_A_PDF: "the bytes do not carry a %PDF- header",
  ENCRYPTED: localize("pdf-pixels.imagecrop.the_document_is_encrypted_streams", "the document is encrypted; streams are ciphertext to this reader"),
  NO_SUCH_PAGE: localize("pdf-pixels.imagecrop.the_page_index_is_outside", "the page index is outside the document"),
  PAGE_UNWALKABLE: localize("pdf-pixels.imagecrop.the_page_s_content_could", "the page's content could not be interpreted, so what it paints is undetermined"),
  NO_IMAGE_AT_RECT: localize("pdf-pixels.imagecrop.the_page_paints_no_image", "the page paints no image at exactly that rectangle"),
  AMBIGUOUS_RECT: localize("pdf-pixels.imagecrop.the_page_paints_more_than", "the page paints more than one image at exactly that rectangle"),
  INLINE_IMAGE: localize("pdf-pixels.imagecrop.the_image_at_that_rectangle", "the image at that rectangle is inline in the content stream; extracting inline images is not built"),
  DECODE_REFUSED: localize("pdf-pixels.imagecrop.the_image_was_found_and", "the image was found and its samples could not be decoded here"),
});

/** @param {CropRefusalReason} reason
 *  @param {CropRefusalDetail} [detail]
 *  @returns {CropRefusal} */
const refuse = (reason, detail = {}) => {
  if (!(reason in CROP_REFUSALS)) throw new Error(`undeclared refusal: ${reason}`);
  return { ok: false, derived: true, reason, why: CROP_REFUSALS[reason], ...detail };
};

const RECT_TOL = 0.001;   // pdfPageImages writes rects at 1/1000 pt
/** @param {readonly number[]} a
 *  @param {readonly number[]} b
 *  @returns {boolean} */
const sameRect = (a, b) => a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) <= RECT_TOL);
/** @param {readonly number[]} r
 *  @returns {number[]} */
const normRect = (r) => {
  const x0 = r[0] ?? NaN, y0 = r[1] ?? NaN, x1 = r[2] ?? NaN, y1 = r[3] ?? NaN;
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
};

/** @param {Uint8Array} u8
 *  @returns {Promise<string>} */
async function sha256Hex(u8) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", u8));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Crop the image a content row's extent names.
 * @param {Uint8Array} bytes   the capture's bytes (the evidence)
 * @param {CropExtent | null} extent      `{kind:"image", page, rect}` — the row's extent
 * @returns {Promise<CropAnswer>} a derived rendition `{ok:true, derived:true, rendition:"crop", …}`
 *          or a NAMED refusal from CROP_REFUSALS. Never a blank frame.
 */
export async function cropImage(bytes, extent) {
  /** @type {CropExtent} */
  const e = extent && typeof extent === "object" ? extent : {};
  const page = e.page;
  if (e.kind !== "image" || page === undefined || !Number.isInteger(page) || e.part != null)
    return refuse("NOT_AN_IMAGE_EXTENT", { extent: e });
  const rect = e.rect;
  if (!(Array.isArray(rect) && rect.length === 4 && rect.every((n) => typeof n === "number" && Number.isFinite(n))))
    return refuse("RECT_REQUIRED", { page });

  const doc = await loadPdf(bytes);
  if (!doc) return refuse("NOT_A_PDF");
  if (doc.isEncrypted()) return refuse("ENCRYPTED");
  const n = doc.pageCount;
  if (page < 0 || page >= n) return refuse("NO_SUCH_PAGE", { page, pageCount: n });

  const got = await pdfPageImages(doc, page);
  if (!got.images) return refuse("PAGE_UNWALKABLE", { page, detail: got.why });
  const want = normRect(rect);
  const hits = got.images.filter((im) => Array.isArray(im.rect) && sameRect(im.rect, want));
  if (hits.length === 0)
    return refuse("NO_IMAGE_AT_RECT", { page, rect: want, painted: got.images.map((im) => im.rect) });
  if (hits.length > 1) return refuse("AMBIGUOUS_RECT", { page, rect: want, count: hits.length });
  const hit = hits[0];
  if (!hit) return refuse("NO_IMAGE_AT_RECT", { page, rect: want, painted: got.images.map((im) => im.rect) });
  const src = imagePlacementSource(hit);
  const stream = src?.stream;
  if (hit.inline || !src || !stream) return refuse("INLINE_IMAGE", { page, rect: want });

  const im = imageOf(doc, hit);
  const out = await decodeImage(doc, { ...im, obj: stream }, { rotate: 0 });
  if (!out.ok) return refuse("DECODE_REFUSED", { page, rect: want, decoder: out.reason, decoderWhy: out.why });

  return {
    ok: true,
    derived: true,
    rendition: "crop",
    why: "a DERIVED rendition for display: the evidence is the capture's bytes plus this extent, "
       + "and this file can be re-derived from them (EXTRACTION-BREADTH §3.4)",
    of: { kind: "image", page, rect: want },
    capture_sha256: await sha256Hex(bytes),
    placement: { name: hit.name, axis_aligned: hit.axis_aligned, filters: hit.filters },
    route: out.route,
    mediaType: out.mediaType,
    bytes: out.bytes,
    width: out.width ?? hit.width,
    height: out.height ?? hit.height,
    /* Upright only when the placement is a plain scale-and-translate with
       POSITIVE scales (no rotation, skew or flip — a PDF commonly paints an
       image through a negative y-scale) AND the decoder itself reports its
       samples upright; otherwise this module does not know, and says null
       rather than true. */
    upright: (() => {
      const m = src.ctm;
      const plain = Array.isArray(m) && m[1] === 0 && m[2] === 0 && (m[0] ?? NaN) > 0 && (m[3] ?? NaN) > 0;
      return plain && out.upright === true ? true : null;
    })(),
    /* Both hashes, each labelled (D-246's recommendation, CPDF-12): the FILE
       hash says "is this the copy that was served", the PIXEL hash (decoded
       routes only) says "is this the same picture" and survives a runtime
       whose deflate differs. */
    file_sha256: await sha256Hex(out.bytes),
    ...(out.pixelsSha256 ? { pixels_sha256: out.pixelsSha256 } : {}),
  };
}
