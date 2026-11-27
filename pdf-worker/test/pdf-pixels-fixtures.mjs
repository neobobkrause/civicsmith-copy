/* pdf-pixels' published fixtures (build/plan/fixtures-T51/; K4990, K4993, K4995, K5044): the real answers of
 * `renderPageToPixels` and `renderPictureToPixels`, made by this module's own code when a test calls them and never stored,
 * for the tests of the modules that read through it (ocr-worker, plane). Each is checked by this module's own test
 * (`pagepixels.test.mjs`, "the published fixtures"). The inputs are generated here (make-pdf, imggen) except the one
 * progressive JPEG, a file of `fixtures/picture-variants.json`. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderPageToPixels } from "../src/pagepixels.mjs";
import { renderPictureToPixels, PICTURE_FRAME_MAX } from "../src/picturepixels.mjs";
import { generate } from "../../bio-plane/test/imggen.mjs";
import { onePage, image, content, deflateSync } from "./make-pdf.mjs";
/** @import { PageAnswer, RenderOptions } from "../src/pagepixels.mjs" */
/** @import { PictureAnswer } from "../src/picturepixels.mjs" */
/** The options `renderedPage` hands on: the page renderer's, or the picture renderer's beside its own maxEdge and grey.
 *  @typedef {Object} RenderedOptions
 *  @property {boolean} [allowTextPage]
 *  @property {boolean} [decodeDct]
 *  @property {number} [turn]
 *  @property {boolean} [prepare]
 *  @property {boolean} [grey]
 *  @property {number} [maxEdge] */
/** @import { PdfBody } from "./make-pdf.mjs" */

/** @param {number} n
 *  @returns {Uint8Array} */
const GREY = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
const GREY_8 = "/ColorSpace /DeviceGray /BitsPerComponent 8";

/* A page painting one grey image named /Im over the whole page box (w × h points). */
/** @param {PdfBody} img
 *  @param {{ w?: number, h?: number, ops?: string, res?: string, more?: PdfBody[] }} [spec]
 *  @returns {Uint8Array} */
const imagePage = (img, { w = 3, h = 2, ops = "", res = "", more = [] } = {}) => onePage({
  box: [0, 0, w, h], res: `/XObject << /Im 5 0 R >> ${res}`, ops: `q ${w} 0 0 ${h} 0 0 cm /Im Do Q ${ops}`, more: [img, ...more],
});
/** @param {string} [extra]
 *  @param {string} [filter]
 *  @returns {PdfBody} */
const greyImage = (extra = "", filter = "") => image(3, 2, `${GREY_8} ${extra}`, filter ? new Uint8Array(6) : GREY(6));

/** The bytes of one picture of this module's own `fixtures/picture-variants.json`, by name.
 *  @param {string} name
 *  @returns {Uint8Array}
 *  @throws {TypeError} when the file holds no such picture, as reading it always did */
const variantBytes = (name) => {
  /** @type {unknown} */
  const j = JSON.parse(readFileSync(fileURLToPath(new URL("fixtures/picture-variants.json", import.meta.url)), "utf8"));
  /* Decoded here: the file is this module's own. */
  const variants = j !== null && typeof j === "object" && "variants" in j && Array.isArray(j.variants) ? j.variants : [];
  /** @type {unknown} */
  const found = variants.find((/** @type {unknown} */ v) => v !== null && typeof v === "object" && "name" in v && v.name === name);
  const b64 = found !== null && typeof found === "object" && "b64" in found ? found.b64 : undefined;
  if (typeof b64 !== "string") throw new TypeError(`picture-variants.json holds no picture ${name}`);
  return new Uint8Array(Buffer.from(b64, "base64"));
};

/** A PNG header alone, `width × height`, 8-bit RGB: what the picture renderer judges before any decode. */
/** @param {number} width
 *  @param {number} height
 *  @returns {Uint8Array} */
const pngHeaderOnly = (width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20); b[24] = 8; b[25] = 2;
  return new Uint8Array(b);
};

/** The real refusal of `renderPageToPixels` for `reason`: NOT_A_PDF, PAGE_HAS_TEXT_LAYER, MULTIPLE_IMAGES_ON_PAGE,
 *  UNSUPPORTED_FILTER, PIXELS_UNDETERMINED (an image whose `/Decode` inverts its samples), or IMAGE_TOO_LARGE
 *  (`renderPictureToPixels` over a picture whose frame is past PICTURE_FRAME_MAX, `bound_name` PICTURE_FRAME_MAX). */
/** @param {string} reason
 *  @returns {Promise<PageAnswer | PictureAnswer>}
 *  @throws {Error} for a reason no input is made for */
export async function pixelRefusal(reason) {
  /** @param {Uint8Array} bytes
   *  @param {RenderOptions} [opts]
   *  @returns {Promise<PageAnswer>} */
  const page = (bytes, opts = {}) => renderPageToPixels(bytes, 0, opts);
  switch (reason) {
    case "NOT_A_PDF": return page(new Uint8Array([1, 2, 3, 4]));
    case "PAGE_HAS_TEXT_LAYER":
      return page(imagePage(greyImage(), { res: "/Font << /F1 6 0 R >>", ops: "BT /F1 1 Tf (a) Tj ET",
        more: ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"] }));
    case "MULTIPLE_IMAGES_ON_PAGE":
      return page(onePage({ box: [0, 0, 8, 8], res: "/XObject << /A 5 0 R /B 6 0 R >>", ops: "q 8 0 0 8 0 0 cm /A Do /B Do Q",
        more: [greyImage(), image(4, 4, "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode", deflateSync(new Uint8Array(4)))] }));
    case "UNSUPPORTED_FILTER": return page(imagePage(greyImage("/Filter /LZWDecode", "lzw")));
    case "PIXELS_UNDETERMINED": return page(imagePage(greyImage("/Decode [1 0]")));
    case "IMAGE_TOO_LARGE": {
      const side = Math.ceil(Math.sqrt(PICTURE_FRAME_MAX / 3)) + 1;
      return renderPictureToPixels(pngHeaderOnly(side, side), 0, { maxEdge: 64, grey: true });
    }
    default: throw new Error(`pixelRefusal: no input is made for ${reason}`);
  }
}

/** The real refusal of the page renderers for `reason`: PAGE_HAS_TEXT_LAYER (a page that shows text),
 *  UNSUPPORTED_JPEG_PROCESS (a progressive JPEG picture: the answer carries `jpeg`, `process` and `page`), NOT_A_PICTURE. */
/** @param {string} reason
 *  @returns {Promise<PageAnswer | PictureAnswer>}
 *  @throws {Error} for a reason no input is made for */
export async function pageRefusal(reason) {
  switch (reason) {
    case "PAGE_HAS_TEXT_LAYER": return pixelRefusal(reason);
    case "UNSUPPORTED_JPEG_PROCESS": return renderPictureToPixels(variantBytes("refuse-progressive"), 0, { maxEdge: 64, grey: true });
    case "NOT_A_PICTURE": return renderPictureToPixels(new Uint8Array([1, 2, 3, 4]), 0, { maxEdge: 64, grey: true });
    default: throw new Error(`pageRefusal: no input is made for ${reason}`);
  }
}

/** The real success answer of the renderers over a tiny generated input: `kind` "pdf" (a 3 × 2 grey image page through
 *  `renderPageToPixels(bytes, 0, opts)`) or "picture" (a generated PNG through `renderPictureToPixels(bytes, 0,
 *  {maxEdge: 4096, grey: true, ...opts})`, `prepare` and `turn` among them). */
/** @param {string} [kind] "pdf" or "picture"
 *  @param {RenderedOptions} [opts]
 *  @returns {Promise<PageAnswer | PictureAnswer>}
 *  @throws {Error} for any other kind */
export async function renderedPage(kind = "pdf", opts = {}) {
  if (kind === "pdf") return renderPageToPixels(imagePage(greyImage()), 0, opts);
  if (kind !== "picture") throw new Error(`renderedPage: kind is "pdf" or "picture", not ${kind}`);
  const g = generate({ kind: "png", seed: "fx-pdf-pixels", size: { pages: 1, lines: 3 } });
  return renderPictureToPixels(await g.bytes(), 0, { maxEdge: 4096, grey: true, ...opts });
}
