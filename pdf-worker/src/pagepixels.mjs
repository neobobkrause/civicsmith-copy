/* pagepixels.mjs — CPDF-12: a PDF page turned into PIXELS, inside workerd, with
 * NO canvas and NO dependency.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT A RASTERISER, AND WHY THAT IS THE FINDING RATHER THAN A DODGE
 * ─────────────────────────────────────────────────────────────────────────────
 * CPDF-9 measured that pdf.js's renderer wants a `canvas` workerd does not have,
 * and the queue row that named this item assumed the answer was therefore a page
 * RASTERISER (interpret the content stream, paint glyphs and vectors into a
 * frame buffer). DEC-42 carried one observation that would remove that entirely,
 * to be VERIFIED rather than assumed: for the image-only class — the class OCR
 * is FOR — a page is typically ONE full-page embedded image, so what is needed is
 * image EXTRACTION, not rasterisation.
 *
 * `pagepixels-corpus.probe.mjs` measured that observation over a real Oakland
 * corpus before a line of this was built. The figures are in MEASUREMENTS.md;
 * read them there rather than from a number in this comment, which would go
 * stale silently the way every hand-carried figure in this repository has.
 *
 * So this module renders a page by EXTRACTING the image the page consists of and
 * decoding it to pixels. It is deliberately NOT a general renderer:
 *
 *   - A page carrying real TEXT is REFUSED by name (`PAGE_HAS_TEXT_LAYER`). That
 *     page does not need OCR; Tier 1 or the pdf-worker already reads it, and
 *     rendering it here would be inventing a picture of text we can read exactly.
 *   - A page whose marks are VECTOR (line art, tables drawn as strokes) is
 *     REFUSED by name (`NOT_IMAGE_ONLY`). Rasterising vectors IS the canvas job,
 *     and this module does not pretend to do it.
 *   - A page composed of MANY images (a mosaic, or a scan split into strips) is
 *     REFUSED by name (`MULTIPLE_IMAGES_ON_PAGE`) rather than silently returning
 *     the biggest one. Compositing strips is a real capability; it is not built,
 *     and the refusal says so with the count so the corpus decides whether it is
 *     ever worth building.
 *
 * EVERY refusal is a STATED refusal carrying a reason and the evidence for it.
 * The one thing this module must never do is hand back a blank or partial frame
 * that reads downstream like content — an OCR pass over a blank page produces
 * nothing, and "nothing" is indistinguishable from "a page with no text on it".
 * That is the negative control the queue row names, and it is enforced here by
 * construction: there is no code path that allocates a frame and returns it
 * without having decoded real samples into it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DECODES, AND WHAT IT REFUSES
 * ─────────────────────────────────────────────────────────────────────────────
 *   DCTDecode        -> PASS-THROUGH by default. The stream bytes ARE a JPEG
 *                       file. Nothing is decoded, re-encoded or resampled: the
 *                       bytes handed on are the bytes the publisher's scanner
 *                       wrote, which is also the strongest provenance position
 *                       available (no transform of ours sits between the record
 *                       and the pixels a reader checks a claim against).
 *                    -> DECODED HERE when the caller asks (`decodeDct`, D-320):
 *                       a baseline decoder (`dctdecode.mjs`) bit-exact with
 *                       libjpeg, the page's /Rotate applied, to an 8-bit PNG with
 *                       a `pixels_sha256` an independent decoder reproduces. The
 *                       OCR member asks, because no engine in the isolate reads a
 *                       JPEG; progressive and arithmetic-coded files are REFUSED.
 *   CCITTFaxDecode   -> DECODED (`image-codecs`' `ccittdecode.mjs`, K115), G4
 *                       (K<0) and G3 1D (K=0), to a 1-bit-per-pixel PNG, checked
 *                       PIXEL-EXACT against an independent decoder.
 *   FlateDecode /
 *   no filter        -> raw samples, 1/8-bit grey or 8-bit RGB, to PNG.
 *   JBIG2Decode      -> DECODED HERE (D-622, `jbig2decode.mjs`): every region
 *                       type a page composes from, to a 1-bit PNG checked
 *                       pixel-exact against jbig2dec; what it does not decode
 *                       is refused UNSUPPORTED_FILTER naming the feature.
 *   JPXDecode        -> DECODED HERE (D-622, `jpxdecode.mjs`): JPEG 2000, 8-bit
 *                       grey or RGB, to an 8-bit PNG checked pixel-exact
 *                       against OpenJPEG; the rest refused by name.
 *
 * PNG is written by hand (CRC32 + `CompressionStream("deflate")`, which is zlib-
 * wrapped and therefore exactly what an IDAT holds). Bilevel pages are written
 * at bit depth 1: a 3300x2550 bilevel page is ~1.05 MB packed against the 33.6 MB
 * an RGBA frame of the same page would cost, and memory is the binding constraint,
 * stated as a WORKLOAD SIZE and never as a share of 128 MB (D-312; INTERFACES.md
 * §"The memory bound, and how it is expressed"): CPDF-15 measured an RGBA frame of
 * 61.3 MB completing and one of 75.7 MB KILLED (`exceededMemory`). Not making the
 * RGBA frame is the whole reason this fits.
 */

import { openPdf, pageShowsText, pdfPageImages, imagePlacementSource } from "../../bio-plane/src/pdfstructure.mjs";
import * as reader from "../../bio-plane/src/pdfstructure.mjs";
import { decodeBaselineJpeg, DctRefusal } from "./dctdecode.mjs";
import { decodeJbig2, Jbig2Refusal, JBIG2_REFUSES } from "./jbig2decode.mjs";
import { decodeJpx, JpxRefusal, JPX_REFUSES } from "./jpxdecode.mjs";
import { ccittDecode } from "./ccittdecode.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { boundOf } from "../../bio-plane/src/read-bounds.mjs";

const LATIN1 = new TextDecoder("latin1");

/* R46, R49: the ceilings this module keeps, read from READ_BOUNDS (runtime-limits). */
const PIXELS_MAX = boundOf("image", "pixels");
const EDGE_MAX = boundOf("image", "edge");
const TREE_DEPTH_MAX = boundOf("pdf", "tree_depth");

/** A source `{size, readRange(offset, length)}` and not bytes (R47). */
export const isSource = (x) => x != null && typeof x === "object" && !(x instanceof Uint8Array) && !(x instanceof ArrayBuffer)
  && Number.isInteger(x.size) && x.size >= 0 && typeof x.readRange === "function";

/** Every reason this module can refuse with. Exported so a caller can branch on
 *  the set rather than on a string it guessed, and so the suite can assert that
 *  no refusal is emitted that is not declared here. */
export const REFUSALS = {
  NOT_A_PDF: "the bytes do not carry a %PDF- header",
  NOT_A_PICTURE: "the bytes are neither a JPEG nor a PNG file",
  ENCRYPTED: localize("pdf-pixels.pagepixels.the_document_is_encrypted_streams", "the document is encrypted; streams are ciphertext to this reader"),
  NO_SUCH_PAGE: localize("pdf-pixels.pagepixels.the_page_index_is_outside", "the page index is outside the document"),
  PAGE_UNREADABLE: localize("pdf-pixels.pagepixels.the_page_object_could_not", "the page object could not be read"),
  PAGE_HAS_TEXT_LAYER: localize("pdf-pixels.pagepixels.the_page_carries_a_text", "the page carries a text layer; it does not need pixels"),
  NOT_IMAGE_ONLY: localize("pdf-pixels.pagepixels.the_page_carries_marks_that", "the page carries marks that are not an embedded image"),
  NO_IMAGE_ON_PAGE: localize("pdf-pixels.pagepixels.the_page_paints_no_image", "the page paints no image"),
  MULTIPLE_IMAGES_ON_PAGE: localize("pdf-pixels.pagepixels.the_page_composes_several_images", "the page composes several images; compositing is not built"),
  IMAGE_UNREADABLE: localize("pdf-pixels.pagepixels.the_image_xobject_s_stream", "the image XObject's stream could not be read"),
  UNSUPPORTED_FILTER: localize("pdf-pixels.pagepixels.the_image_s_filter_chain", "the image's filter chain has no decoder here"),
  UNSUPPORTED_SAMPLES: localize("pdf-pixels.pagepixels.the_image_s_sample_layout", "the image's sample layout has no decoder here"),
  TRUNCATED_IMAGE_DATA: localize("pdf-pixels.pagepixels.the_decoded_image_is_short", "the decoded image is short of its declared height"),
  DECODE_FAILED: localize("pdf-pixels.pagepixels.the_decoder_could_not_read", "the decoder could not read the image data"),
  UNSUPPORTED_JPEG_PROCESS: "the JPEG is not baseline (progressive, arithmetic-coded, lossless, hierarchical or not 8-bit); only baseline is decoded here",
  IMAGE_TOO_LARGE: localize("pdf-pixels.pagepixels.decoding_the_image_would_need", "decoding the image would need more memory than a decode may use here"),
  PIXELS_UNDETERMINED: localize("pdf-pixels.pagepixels.this_reader_cannot_give_the", "this reader cannot give the page's true pixels for this image, and says so rather than give wrong ones"),
};

/* R25: the REFUSALS reason for each feature a codec refuses as UNSUPPORTED —
 * total over JBIG2_REFUSES and JPX_REFUSES (and, for `picturepixels.mjs`, R42,
 * PNG_REFUSES) by construction: every key the codec declares is
 * UNSUPPORTED_FILTER unless named here (K116). */
export const featureReasons = (declared, named) =>
  Object.freeze(Object.fromEntries(Object.keys(declared).map((k) => [k, named[k] ?? "UNSUPPORTED_FILTER"])));
const JBIG2_FEATURE_REASONS = featureReasons(JBIG2_REFUSES, {});
const JPX_FEATURE_REASONS = featureReasons(JPX_REFUSES, {});

const refuse = (reason, detail = {}) => {
  if (!(reason in REFUSALS)) throw new Error(`undeclared refusal: ${reason}`);
  return { ok: false, reason, why: REFUSALS[reason], ...detail };
};

/* ── the document ─────────────────────────────────────────────────────────── */

/** Open a PDF with `pdf-reader`'s own `openPdf` — the one reader, never re-derived.
 *  Everything below uses its named services only (N9): `pageCount`, `pageDict`,
 *  `imagePlacementSource`, never a private field. */
export async function loadPdf(bytes) {
  return openPdf(bytes);
}

const nameOf = (doc, v) => {
  v = doc.resolve(v);
  return v && v.t === "name" ? v.v : null;
};
const numOf = (doc, v) => {
  v = doc.resolve(v);
  return typeof v === "number" ? v : null;
};

/** Filter chain as a plain array of names, in application order. */
function filterNames(doc, dict) {
  const f = doc.resolve(dict.Filter);
  if (!f) return [];
  if (f.t === "name") return [f.v];
  if (f.t === "arr") return f.items.map((x) => nameOf(doc, x)).filter(Boolean);
  return [];
}

/** /DecodeParms for the LAST filter in the chain (the one that matters for an
 *  image: an image is `[FlateDecode, CCITTFaxDecode]` at most, never the other
 *  way round). */
function decodeParms(doc, dict, idx) {
  let p = doc.resolve(dict.DecodeParms) ?? doc.resolve(dict.DP);
  if (p && p.t === "arr") p = doc.resolve(p.items[idx] ?? p.items[p.items.length - 1]);
  return p && p.t === "dict" ? p.map : null;
}

/** An inheritable page attribute (/MediaBox, /Rotate): the leaf's own value, else
 *  the nearest ancestor's, walking /Parent. `undefined` when no node carries it.
 *  D-671: /Rotate was read from the leaf only, so a page inheriting its rotation
 *  from /Pages rendered un-turned. */
function inheritedAttr(doc, pageMap, key) {
  let p = pageMap;
  for (let d = 0; p && d <= TREE_DEPTH_MAX; d++) {
    if (p[key] !== undefined) return doc.resolve(p[key]);
    p = doc.dictOf(p.Parent);
  }
  return undefined;
}

/** The page's /Rotate, normalised to 0/90/180/270. Absent is 0; a value that is
 *  not a multiple of 90 is `null` — unreadable, never guessed. */
function pageRotate(doc, pageMap) {
  const r = inheritedAttr(doc, pageMap, "Rotate");
  if (r === undefined) return 0;
  if (!Number.isInteger(r) || r % 90 !== 0) return null;
  return ((r % 360) + 360) % 360;
}

/** The page's content stream bytes, concatenated when /Contents is an array. */
async function pageContentText(doc, pageMap) {
  const c = doc.resolve(pageMap.Contents);
  const parts = [];
  const one = async (v) => {
    const st = doc.resolve(v);
    if (!st || st.t !== "stream") return;
    const data = await doc.streamDecoded(st);
    if (data) parts.push(LATIN1.decode(data));
  };
  if (c && c.t === "arr") { for (const it of c.items) await one(it); }
  else await one(pageMap.Contents);
  return parts.join("\n");
}

/* Content-stream operators, read from a stream with strings and inline images
 * MASKED OUT first. A naive regex over raw content matches operator letters
 * inside `(...)` strings and inside BI/ID/EI inline-image binary, which is how a
 * page of pure scan reads as "carrying text" — the generous direction, and the
 * one this project treats as the worse one. */
function maskedContent(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") {
      let depth = 1; i++;
      while (i < s.length && depth > 0) {
        if (s[i] === "\\") { i += 2; continue; }
        if (s[i] === "(") depth++;
        else if (s[i] === ")") depth--;
        i++;
      }
      out += " () ";
      continue;
    }
    if (ch === "<" && s[i + 1] !== "<") {
      const e = s.indexOf(">", i);
      i = e === -1 ? s.length : e + 1;
      out += " <> ";
      continue;
    }
    if (ch === "%") {
      const e = s.indexOf("\n", i);
      i = e === -1 ? s.length : e + 1;
      out += " ";
      continue;
    }
    // Inline image: BI ... ID <binary> EI
    if (ch === "B" && s[i + 1] === "I" && /[\s/]/.test(s[i + 2] || " ")) {
      const id = s.indexOf("ID", i);
      if (id !== -1) {
        const ei = s.indexOf("EI", id);
        i = ei === -1 ? s.length : ei + 2;
        out += " INLINEIMAGE ";
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/* D-585: WHETHER THE PAGE SHOWS TEXT IS NOT ASKED HERE ANY MORE. This module
 * held two regexes, `TEXT_OPS` (Tj, TJ, ', ") and `SHOW_TEXT_BLOCK` (a bare
 * `BT`), and counted EITHER as text. A `BT` opens a text object and shows
 * nothing: `0201-cafr-2002` carries an empty `BT … ET` beside the scan on 161 of
 * its 175 pages, and every one of them was refused `PAGE_HAS_TEXT_LAYER` — a
 * scan with no glyph on it, refused OCR for having text (M-157). The question is
 * now the plane's `pageShowsText`, the ONE predicate Tier 1's `no_text_layer`
 * marker also asks, so the page Tier 1 sends here is the page this admits. It
 * reads the page's content AND the Form XObjects it draws, which the regex never
 * did; an UNDETERMINED answer (a stream or form it could not read) is not
 * counted as text here, which is this module's behaviour before the change for
 * the same input, and is recorded as `textShown: null` for a reader to see. */
/* Painting operators that put non-image marks on the page. `sh` is a shading;
 * the rest are path fills and strokes. `W`/`n` (clip, no-op) are excluded on
 * purpose — a clip path paints nothing and every scanned page has one. */
const VECTOR_OPS = /(^|\s)(f\*?|F|B\*?|b\*?|S|s|sh)(\s|$)/;

/** One painted image, as the decoder reads it: the placement's own width,
 *  height, filters and name, and its stream's sample layout. An inline image has
 *  no stream (`obj` null). */
export function imageOf(doc, placement) {
  const src = imagePlacementSource(placement);
  const st = src ? src.stream : null;
  const d = st ? st.dict : {};
  return {
    name: placement.name,
    inline: placement.inline === true,
    obj: st,
    width: placement.width,
    height: placement.height,
    bpc: numOf(doc, d.BitsPerComponent),
    colorSpace: nameOf(doc, d.ColorSpace) || (d.ColorSpace ? "«indirect»" : null),
    isMask: doc.resolve(d.ImageMask) === true,
    filters: placement.filters,
  };
}

/** What is actually ON this page: images, text, vector marks. The three are
 *  reported separately and NONE of them is inferred from another — "no fonts"
 *  is not "no text" (a Type3 or a broken resource dict), and "has an image" is
 *  not "is a scan". */
export async function analyzePage(doc, pageIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= doc.pageCount) return null;
  const pageMap = doc.pageDict(pageIndex);
  if (!pageMap) return null;

  /* R17/R18 (K27): the images the page PAINTS, in painting order, including
   * those a Form XObject draws — never the image XObjects its /Resources list,
   * which a scanner commonly shares across every page of the document. */
  const painted = await pdfPageImages(doc, pageIndex);
  const images = painted.images ? painted.images.map((pl) => imageOf(doc, pl)) : [];

  let content = "";
  try { content = await pageContentText(doc, pageMap); } catch { content = ""; }
  const masked = maskedContent(content);
  let textShown = null;
  try { textShown = await pageShowsText(doc, pageMap); } catch { textShown = null; }


  const mediaBox = (() => {
    const m = inheritedAttr(doc, pageMap, "MediaBox");
    if (!m || m.t !== "arr" || m.items.length < 4) return null;
    const v = m.items.map((x) => numOf(doc, x));
    if (v.some((x) => x == null)) return null;
    return { w: Math.abs(v[2] - v[0]), h: Math.abs(v[3] - v[1]) };
  })();

  return {
    page: pageIndex,
    contentBytes: content.length,
    contentReadable: content.length > 0 || !pageMap.Contents,
    hasTextOps: textShown === true,
    textShown,
    hasVectorOps: VECTOR_OPS.test(masked),
    hasInlineImage: masked.includes("INLINEIMAGE"),
    images: images.map(({ obj, ...rest }) => rest),
    _images: images,
    imagesWhy: painted.why,
    drawnImageNames: images.map((im) => im.name),
    imageCount: images.length,
    mediaBox,
    rotate: pageRotate(doc, pageMap),
  };
}

/* ── the renderer ─────────────────────────────────────────────────────────── */

/**
 * Render one page to pixels. Returns either
 *   { ok:true, page, route, mediaType, bytes, width, height, … }
 * or a STATED refusal from `REFUSALS`. Never a blank frame.
 *
 * `route` names how the pixels were produced, because the provenance chain
 * CPDF-10 records has to say it: `passthrough-dct` means the publisher's own
 * JPEG bytes were handed on untouched; `decoded-ccitt-g4` means this module's
 * decoder produced them and a calibration therefore applies to it too.
 */
export async function renderPageToPixels(bytes, pageIndex, opts = {}) {
  if (isSource(bytes)) {
    /* R47: pdf-reader's `pageSource` reads the page's own bytes through the source and
     * answers a small PDF of that one page; on `fallback` (or where the provider is not
     * yet merged) the whole file is read, so every refusal stays the whole file's. */
    const got = typeof reader.pageSource === "function" ? await reader.pageSource(bytes, pageIndex) : null;
    if (!got || !got.ok) return renderPageToPixels(await bytes.readRange(0, bytes.size), pageIndex, opts);
    const r = await renderPageToPixels(got.bytes, 0, opts);
    return "page" in r ? { ...r, page: pageIndex } : r;
  }
  const doc = await loadPdf(bytes);
  if (!doc) return refuse("NOT_A_PDF");
  if (doc.isEncrypted()) return refuse("ENCRYPTED");

  const a = await analyzePage(doc, pageIndex);
  if (!a) {
    const n = doc.pageCount;
    return pageIndex >= 0 && pageIndex < n
      ? refuse("PAGE_UNREADABLE", { page: pageIndex })
      : refuse("NO_SUCH_PAGE", { page: pageIndex, pageCount: n });
  }

  if (a.rotate === null) {
    return refuse("PAGE_UNREADABLE", { page: pageIndex, note: "/Rotate is not a multiple of 90" });
  }
  if (a.hasTextOps && !opts.allowTextPage) {
    return refuse("PAGE_HAS_TEXT_LAYER", { page: pageIndex, imageCount: a.imageCount });
  }
  if (a.imagesWhy) {
    return refuse("PAGE_UNREADABLE", { page: pageIndex, note: a.imagesWhy });
  }
  if (a.imageCount === 0) {
    return refuse(a.hasVectorOps ? "NOT_IMAGE_ONLY" : "NO_IMAGE_ON_PAGE", {
      page: pageIndex, hasVectorOps: a.hasVectorOps, hasInlineImage: a.hasInlineImage,
    });
  }
  if (a.imageCount > 1) {
    return refuse("MULTIPLE_IMAGES_ON_PAGE", {
      page: pageIndex, imageCount: a.imageCount,
      images: a.images.map((i) => ({ width: i.width, height: i.height, filters: i.filters })),
    });
  }

  const im = a._images[0];
  if (!im.obj) {
    return refuse("IMAGE_UNREADABLE", { page: pageIndex, filters: im.filters, note: localize("pdf-pixels.pagepixels.an_inline_image_reading_inline", "an inline image; reading inline images is not built") });
  }
  /* R48: a turn the caller found necessary, applied after the page's own /Rotate. */
  const turn = [90, 180, 270].includes(opts.turn) ? opts.turn : 0;
  const out = await decodeImage(doc, im, { ...opts, turn, rotate: (a.rotate + turn) % 360 });
  if (!out.ok) return { ...out, page: pageIndex };

  return {
    ok: true,
    page: pageIndex,
    route: out.route,
    mediaType: out.mediaType,
    bytes: out.bytes,
    width: out.width ?? im.width,
    height: out.height ?? im.height,
    /* Are these pixels the page as a READER sees it? A route that could not
     * apply the page's own /Rotate says so HERE rather than leaving a consumer
     * to discover it in its output. See the note on rotateBilevel. */
    upright: out.upright,
    rotate_deg: a.rotate,
    turned_deg: turn,
    source: {
      filters: im.filters,
      colorSpace: im.colorSpace,
      bitsPerComponent: im.bpc,
      imageMask: im.isMask,
    },
    page_geometry: {
      mediaBoxPt: a.mediaBox,
      rotate: a.rotate,
      dpi: a.mediaBox && im.width && im.height
        ? { x: +(im.width / (a.mediaBox.w / 72)).toFixed(1), y: +(im.height / (a.mediaBox.h / 72)).toFixed(1) }
        : null,
    },
    page_marks: { hasTextOps: a.hasTextOps, hasVectorOps: a.hasVectorOps },
    ...(out.ccitt ? { ccitt: out.ccitt } : {}),
    ...(out.dct ? { dct: out.dct } : {}),
    ...(out.jbig2 ? { jbig2: out.jbig2 } : {}),
    ...(out.jpx ? { jpx: out.jpx } : {}),
    /* THE DIGEST OF THE PICTURE, NOT OF THE FILE — and this field exists because
     * the cross-runtime arm of the probe found the file digest to be RUNTIME-
     * DEPENDENT. `CompressionStream("deflate")` is a platform service, and
     * workerd's and node's produce different (both valid) deflate streams for
     * identical input: the same page rendered by the same code came out
     * 147,251 B on workerd and 152,499 B on node. The PIXELS were identical.
     * A record that hashes the FILE therefore records a value no verifier on a
     * different runtime can reproduce, which is the whole point of a hash here.
     * So a decoded route also carries `pixels_sha256`, taken over the normalised
     * samples before any container is built. A pass-through route does not need
     * one: its bytes are the publisher's own and are byte-stable by definition. */
    ...(out.pixelsSha256 ? { pixels_sha256: out.pixelsSha256 } : {}),
  };
}

/* CPDF-18 exports this ONE function so `imagecrop.mjs` decodes a cited image
 * through the same decoder rather than growing a second one (CPDF-12's `PdfDoc`
 * precedent, D-164's lesson). Its contract is unchanged. */
export async function decodeImage(doc, im, opts) {
  const dict = im.obj.dict;
  const filters = im.filters;
  const last = filters[filters.length - 1] || null;

  /* R46: the declared size is judged first, before the stream is read, inflated,
   * copied or handed to a decoder. */
  const large = declaredTooLarge(im);
  if (large) return large;

  /* DCTDecode: the stream IS a JPEG. Hand the publisher's own bytes on — or,
   * when the caller asked for pixels it can read, decode them (D-320). */
  if (last === "DCTDecode" || last === "DCT") {
    if (filters.length > 1) return refuse("UNSUPPORTED_FILTER", { filters, note: "DCT behind another filter" });
    const raw = doc.streamRawBytes(im.obj);
    if (!raw || raw.length < 4) return refuse("IMAGE_UNREADABLE", { filters });
    if (!(raw[0] === 0xff && raw[1] === 0xd8)) {
      return refuse("DECODE_FAILED", { filters, note: "DCT stream does not start with SOI" });
    }
    /* A turn cannot be made on the publisher's bytes: it needs the pixels (R48). */
    if (opts.decodeDct || opts.turn) return decodeDct(doc, im, raw, opts.rotate || 0);
    /* R22, R45: the pass-through is examined, not trusted: the JPEG's own header
     * must agree with the image dictionary. */
    const frame = jpegFrame(raw);
    const pdfComps = colourComponents(doc, dict.ColorSpace);
    if (!frame || frame.width !== im.width || frame.height !== im.height || (pdfComps != null && frame.comps !== pdfComps)) {
      return refuse("PIXELS_UNDETERMINED", { detail: "dct_unexamined", filters,
        declared: { width: im.width, height: im.height, comps: pdfComps }, jpeg: frame });
    }
    /* NOT ROTATED, AND THAT IS THE POINT OF THE ROUTE. Rotating a JPEG means
     * decoding and re-encoding it, which throws away the one property this
     * route has — that the bytes in the record are the publisher's own, with no
     * transform of ours between the record and the pixels a reader checks a
     * claim against. So a rotated page comes back `upright:false` with its
     * `rotate_deg` STATED, and a consumer that needs it upright must say so
     * rather than be handed a sideways page that reads like a good one — and
     * since D-320 it can: `decodeDct` takes the `decoded-dct` route above. */
    return { ok: true, route: "passthrough-dct", mediaType: "image/jpeg", bytes: raw,
             upright: (opts.rotate || 0) === 0 };
  }

  if (!im.width || !im.height) return refuse("IMAGE_UNREADABLE", { filters });

  /* CCITTFaxDecode: decode here. */
  if (last === "CCITTFaxDecode" || last === "CCF") {
    let data = doc.streamRawBytes(im.obj);
    if (filters.length > 1) {
      if (filters.slice(0, -1).every((f) => f === "FlateDecode" || f === "Fl")) {
        const st = { ...im.obj, dict: { ...dict, Filter: { t: "name", v: "FlateDecode" } } };
        data = await doc.streamDecoded(st);
      } else return refuse("UNSUPPORTED_FILTER", { filters });
    }
    if (!data) return refuse("IMAGE_UNREADABLE", { filters });

    const p = decodeParms(doc, dict, filters.length - 1) || {};
    const K = numOf(doc, p.K) ?? 0;
    const columns = numOf(doc, p.Columns) ?? 1728;
    const rows = numOf(doc, p.Rows) ?? im.height;
    /* Mixed mode (K>0) needs the per-row tag bit only an EOL carries, so it has
     * no decoder here: a filter refusal, not a failed decode. */
    if (K > 0) return refuse("UNSUPPORTED_FILTER", { filters, note: "mixed-mode (K>0) CCITT is not decoded here" });
    if (columns !== im.width) {
      return refuse("PIXELS_UNDETERMINED", { detail: "ccitt_columns", filters, columns, width: im.width });
    }
    const blackIs1 = doc.resolve(p.BlackIs1) === true;
    const byteAlign = doc.resolve(p.EncodedByteAlign) === true;

    let bits;
    try {
      bits = ccittDecode(data, { K, columns, rows, byteAlign });
    } catch (e) {
      return refuse("DECODE_FAILED", { filters, note: String(e && e.message || e) });
    }
    if (bits.rowsDecoded < im.height) {
      return refuse("TRUNCATED_IMAGE_DATA", {
        filters, declaredHeight: im.height, rowsDecoded: bits.rowsDecoded, columns,
      });
    }

    /* CCITT's own colours -> PNG greyscale-1 samples. In PNG, sample 0 is black.
     * CCITT "white" is white unless BlackIs1 flips it; /Decode [1 0] flips again.
     * Both flips are applied here explicitly rather than assumed away. */
    const dec = doc.resolve(dict.Decode);
    const decodeInverts = dec && dec.t === "arr" && numOf(doc, dec.items[0]) === 1;
    let invert = false;
    if (blackIs1) invert = !invert;
    if (decodeInverts) invert = !invert;
    // `bits.packed` holds 1 = CCITT white. PNG grey-1 wants 1 = white too, so a
    // straight copy is correct in the un-inverted case.
    const packed0 = invert ? bits.packed.map((b) => ~b & 0xff) : bits.packed;
    const rot = rotateBilevel(normalisePacked(packed0, columns, im.height), columns, im.height, opts.rotate || 0);

    const png = await encodePng1(rot.packed, rot.width, rot.height);
    return { ok: true, route: "decoded-ccitt-g4", mediaType: "image/png", bytes: png,
             width: rot.width, height: rot.height, upright: true,
             pixelsSha256: await sha256Hex(normalisePacked(rot.packed, rot.width, rot.height)),
             ccitt: { K, columns, rows, blackIs1, byteAlign, rowsDecoded: bits.rowsDecoded } };
  }

  /* JBIG2Decode: decode here (D-622). Only FlateDecode may come before it, as
   * for CCITT; the /JBIG2Globals stream holds the segments pages share. */
  if (last === "JBIG2Decode") {
    let data = doc.streamRawBytes(im.obj);
    if (filters.length > 1) {
      if (!filters.slice(0, -1).every((f) => f === "FlateDecode" || f === "Fl")) return refuse("UNSUPPORTED_FILTER", { filter: last, filters });
      data = await doc.streamDecoded({ ...im.obj, dict: { ...dict, Filter: { t: "name", v: "FlateDecode" }, DecodeParms: null } });
    }
    if (!data) return refuse("IMAGE_UNREADABLE", { filters });
    const p = decodeParms(doc, dict, filters.length - 1);
    let globals = null;
    if (p && p.JBIG2Globals !== undefined) {
      const g = doc.resolve(p.JBIG2Globals);
      globals = g && g.t === "stream" ? await doc.streamDecoded(g) : null;
      if (!globals) return refuse("IMAGE_UNREADABLE", { filters, note: localize("pdf-pixels.pagepixels.the_jbig2globals_stream_could_not", "the /JBIG2Globals stream could not be read") });
    }
    if (!im.isMask && (im.bpc ?? 1) !== 1) return refuse("UNSUPPORTED_SAMPLES", { filters, bpc: im.bpc, note: localize("pdf-pixels.pagepixels.a_jbig2_image_is_1", "a JBIG2 image is 1 bit per sample") });
    let out;
    try {
      out = decodeJbig2(data, globals);
    } catch (e) {
      if (!(e instanceof Jbig2Refusal)) return refuse("DECODE_FAILED", { filters, note: String(e && e.message || e) });
      const reason = e.code === "UNSUPPORTED" ? JBIG2_FEATURE_REASONS[e.detail.feature] ?? "UNSUPPORTED_FILTER"
        : { TRUNCATED: "TRUNCATED_IMAGE_DATA", IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE" }[e.code] || "DECODE_FAILED";
      return refuse(reason, { filter: last, filters, jbig2: e.code, ...e.detail });
    }
    if (out.width !== im.width || out.height > im.height) {
      return refuse("DECODE_FAILED", { filters, note: `the JBIG2 page is ${out.width}x${out.height}; the image declares ${im.width}x${im.height}` });
    }
    if (out.height < im.height) {
      return refuse("TRUNCATED_IMAGE_DATA", { filters, declaredHeight: im.height, rowsDecoded: out.height });
    }
    /* JBIG2's 1 is black; the filter's output is its inverse (a PDF sample 0
     * is black in DeviceGray, and paints for an /ImageMask), so the PDF samples
     * are the complement of the decoded page. */
    const samples = out.packed.map((b) => ~b & 0xff);
    const bi = await bilevelPng(doc, dict, samples, im.width, im.height, opts.rotate || 0);
    return { ok: true, route: "decoded-jbig2", mediaType: "image/png", ...bi, upright: true,
             jbig2: { ...out.detail, globals_bytes: globals ? globals.length : 0, stream_bytes: data.length } };
  }

  /* JPXDecode: decode here (D-622). The stream IS a JPEG 2000 file (JP2 or a
   * bare codestream), so like DCT nothing may come before it but FlateDecode.
   * The picture is the file's own samples: a /Decode array, or a PDF colour
   * space that says the samples mean something other than grey or RGB, would
   * make the PNG a picture no independent decoder of these bytes produces, so
   * each is refused rather than applied or ignored. */
  if (last === "JPXDecode") {
    let data = doc.streamRawBytes(im.obj);
    if (filters.length > 1) {
      if (!filters.slice(0, -1).every((f) => f === "FlateDecode" || f === "Fl")) return refuse("UNSUPPORTED_FILTER", { filter: last, filters });
      data = await doc.streamDecoded({ ...im.obj, dict: { ...dict, Filter: { t: "name", v: "FlateDecode" }, DecodeParms: null } });
    }
    if (!data) return refuse("IMAGE_UNREADABLE", { filters });
    if (doc.resolve(dict.Decode)) return refuse("UNSUPPORTED_SAMPLES", { filters, note: "a /Decode array on a JPX image is not applied here" });
    if (im.isMask) return refuse("UNSUPPORTED_SAMPLES", { filters, note: "a JPX image mask" });
    const pdfComps = jpxColourComponents(doc, dict.ColorSpace);
    if (pdfComps === false) return refuse("UNSUPPORTED_SAMPLES", { filters, colorSpace: im.colorSpace, note: localize("pdf-pixels.pagepixels.a_colour_space_other_than", "a colour space other than DeviceGray, DeviceRGB or a 1- or 3-component ICCBased") });
    let out;
    try {
      out = decodeJpx(data);
    } catch (e) {
      if (!(e instanceof JpxRefusal)) return refuse("DECODE_FAILED", { filters, note: String(e && e.message || e) });
      const reason = e.code === "UNSUPPORTED" ? JPX_FEATURE_REASONS[e.detail.feature] ?? "UNSUPPORTED_FILTER"
        : { UNSUPPORTED_SAMPLES: "UNSUPPORTED_SAMPLES", TRUNCATED: "TRUNCATED_IMAGE_DATA", IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE" }[e.code] || "DECODE_FAILED";
      return refuse(reason, { filter: last, filters, jpx: e.code, ...e.detail });
    }
    if (pdfComps !== null && pdfComps !== out.comps) {
      return refuse("UNSUPPORTED_SAMPLES", { filters, note: localize("pdf-pixels.pagepixels.the_colour_space_has_pdfcomps", "the colour space has {pdfComps} components; the image has {comps}", { pdfComps: String(pdfComps), comps: String(out.comps) }) });
    }
    if (out.width !== im.width || out.height !== im.height) {
      return refuse("DECODE_FAILED", { filters, note: localize("pdf-pixels.pagepixels.the_jpeg_2000_image_is", "the JPEG 2000 image is {width}x{height}; the PDF declares {width_2}x{height_2}", { width: String(out.width), height: String(out.height), width_2: String(im.width), height_2: String(im.height) }) });
    }
    const rot = rotate8(out.samples, out.width, out.height, out.comps, opts.rotate || 0);
    out.samples = null;
    return { ok: true, route: "decoded-jpx", mediaType: "image/png", upright: true, width: rot.width, height: rot.height,
             pixelsSha256: await sha256Hex(rot.samples),
             bytes: await encodePng8(rot.samples, rot.width, rot.height, out.comps),
             jpx: { ...out.detail, comps: out.comps, stream_bytes: data.length } };
  }

  /* FlateDecode or unfiltered raw samples. */
  if (filters.length === 0 || filters.every((f) => f === "FlateDecode" || f === "Fl")) {
    const bpc = im.isMask ? 1 : (im.bpc ?? 8);
    const cs = im.colorSpace;
    const comps = im.isMask ? 1 : cs === "DeviceRGB" ? 3 : cs === "DeviceGray" ? 1 : null;
    if (comps == null) return refuse("UNSUPPORTED_SAMPLES", { colorSpace: cs, bpc, filters });
    /* R24, R45: what the samples alone would get wrong, stated before they are inflated. */
    const undetermined = rawUndetermined(doc, dict, comps, filters);
    if (undetermined) return undetermined;
    const data = await doc.streamDecoded(im.obj);
    if (!data) return refuse("IMAGE_UNREADABLE", { filters });

    const rowBytes = Math.ceil((im.width * comps * bpc) / 8);
    const need = rowBytes * im.height;
    if (data.length < need) {
      return refuse("TRUNCATED_IMAGE_DATA", {
        filters, declaredHeight: im.height, haveBytes: data.length, needBytes: need,
      });
    }
    if (bpc === 1 && comps === 1) {
      const bi = await bilevelPng(doc, dict, data.subarray(0, need), im.width, im.height, opts.rotate || 0);
      return { ok: true, route: "raw-samples-1bit", mediaType: "image/png", upright: true, ...bi };
    }
    if (bpc === 8) {
      /* 8-bit rotation, BUILT BY D-320 (it was named and not built while this
       * class was 0 of the measured image-only pages; the decoded-DCT route needs
       * the same quarter turn, so it now exists for both). A sample lands on a
       * sample, exactly as a bit does in `rotateBilevel`. */
      const rot = rotate8(data.subarray(0, need), im.width, im.height, comps, opts.rotate || 0);
      return { ok: true, route: comps === 3 ? "raw-samples-rgb8" : "raw-samples-grey8",
               mediaType: "image/png", upright: true, width: rot.width, height: rot.height,
               pixelsSha256: await sha256Hex(rot.samples),
               bytes: await encodePng8(rot.samples, rot.width, rot.height, comps) };
    }
    return refuse("UNSUPPORTED_SAMPLES", { colorSpace: cs, bpc, comps, filters });
  }

  return refuse("UNSUPPORTED_FILTER", { filters });
}

/* R46: width, height and pixel count as the image dictionary declares them,
 * against READ_BOUNDS; null when within them (or not declared: the route's own
 * refusal says so). */
function declaredTooLarge(im) {
  const { width, height } = im;
  if (!(width > 0 && height > 0)) return null;
  const pixels = width * height;
  if (width <= EDGE_MAX && height <= EDGE_MAX && pixels <= PIXELS_MAX) return null;
  return refuse("IMAGE_TOO_LARGE", {
    declared: { width, height, pixels, bitsPerComponent: im.bpc, colorSpace: im.colorSpace },
    bound: { pixels: PIXELS_MAX, edge: EDGE_MAX },
  });
}

/* R45: what a raw route cannot show truly. */
function rawUndetermined(doc, dict, comps, filters) {
  const why = (detail, more = {}) => refuse("PIXELS_UNDETERMINED", { detail, filters, ...more });
  const p = decodeParms(doc, dict, filters.length - 1);
  if (p && numOf(doc, p.Predictor) === 2) return why("tiff_predictor");
  if (dict.SMask !== undefined && doc.resolve(dict.SMask) != null) return why("smask");
  if (dict.Mask !== undefined && doc.resolve(dict.Mask) != null) return why("mask");
  const dec = doc.resolve(dict.Decode);
  if (dec && dec.t === "arr") {
    const v = dec.items.map((x) => numOf(doc, x));
    const dflt = v.length === 2 * comps && v.every((x, i) => x === i % 2);
    if (!dflt) return why("decode_array", { decode: v });
  }
  return null;
}

/** The frame a JPEG states (any process: pass-through never decodes), or null. */
function jpegFrame(d) {
  let p = 2;
  while (p + 4 <= d.length) {
    if (d[p] !== 0xff) { p++; continue; }
    const m = d[p + 1];
    if (m === 0xff) { p++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
    if (m === 0xd9 || m === 0xda) return null;
    const len = (d[p + 2] << 8) | d[p + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (p + 10 > d.length) return null;
      return { height: (d[p + 5] << 8) | d[p + 6], width: (d[p + 7] << 8) | d[p + 8], comps: d[p + 9] };
    }
    p += 2 + len;
  }
  return null;
}

/** An image's PDF colour space as a component count, null when it cannot be told. */
function colourComponents(doc, csv) {
  const cs = doc.resolve(csv);
  if (cs == null) return null;
  if (cs.t === "name") return { DeviceGray: 1, DeviceRGB: 3, DeviceCMYK: 4, CalGray: 1, CalRGB: 3 }[cs.v] ?? null;
  if (cs.t === "arr") {
    const head = nameOf(doc, cs.items[0]);
    if (head === "ICCBased") return numOf(doc, doc.dictOf(cs.items[1])?.N);
    if (head === "Indexed" || head === "I" || head === "Separation") return 1;
  }
  return null;
}

/** PDF 1-bit samples (packed rows) to a grey-1 PNG, rotated. A sample 0 is
 *  black: in DeviceGray, and for an /ImageMask, where 0 is where the mask
 *  PAINTS under the default /Decode [0 1] (PDF 32000-1 8.9.6.2; MuPDF renders
 *  it so). PNG grey-1's 0 is black too, so the samples are copied as they are,
 *  and /Decode [1 0] inverts them. D-622 found the mask case the other way
 *  round: an /ImageMask came out as its negative. */
async function bilevelPng(doc, dict, samples, width, height, rotate) {
  const dec = doc.resolve(dict.Decode);
  const invert = !!(dec && dec.t === "arr" && numOf(doc, dec.items[0]) === 1);
  const packed0 = invert ? Uint8Array.from(samples, (b) => ~b & 0xff) : Uint8Array.from(samples);
  const rot = rotateBilevel(normalisePacked(packed0, width, height), width, height, rotate);
  return { width: rot.width, height: rot.height,
           pixelsSha256: await sha256Hex(normalisePacked(rot.packed, rot.width, rot.height)),
           bytes: await encodePng1(rot.packed, rot.width, rot.height) };
}

/** A JPX image's PDF colour space, as the number of components it implies:
 *  null when absent (the JPEG 2000 file's own colour decides), 1 or 3 for
 *  DeviceGray, DeviceRGB or an ICCBased profile of that /N, false otherwise. */
function jpxColourComponents(doc, csv) {
  const cs = doc.resolve(csv);
  if (cs == null) return null;
  if (cs.t === "name") return cs.v === "DeviceGray" ? 1 : cs.v === "DeviceRGB" ? 3 : false;
  if (cs.t === "arr" && nameOf(doc, cs.items[0]) === "ICCBased") {
    const n = numOf(doc, doc.dictOf(cs.items[1])?.N);
    return n === 1 || n === 3 ? n : false;
  }
  return false;
}

/* ── DCT, decoded (D-320) ─────────────────────────────────────────────────────
 * The JPEG's own evidence decides the picture; the PDF's dictionary may only
 * AGREE with it. Where the two disagree — a component count the colour space
 * contradicts, a /Decode array, a /ColorTransform the file's markers overrule —
 * the page is REFUSED, because an independent decoder fed these bytes would
 * produce a different picture from the one the PDF means, and `pixels_sha256`
 * would then certify something nobody can check. */
export const DCT_TO_REFUSAL = {
  UNSUPPORTED_PROCESS: "UNSUPPORTED_JPEG_PROCESS",
  UNSUPPORTED_PRECISION: "UNSUPPORTED_JPEG_PROCESS",
  UNSUPPORTED_COMPONENTS: "UNSUPPORTED_SAMPLES",
  COMPONENT_MISMATCH: "UNSUPPORTED_SAMPLES",
  UNSUPPORTED_SAMPLING: "UNSUPPORTED_SAMPLES",
  COLOR_TRANSFORM_CONFLICT: "UNSUPPORTED_SAMPLES",
  UNSUPPORTED_ROTATION: "UNSUPPORTED_SAMPLES",
  TRUNCATED: "TRUNCATED_IMAGE_DATA",
  NOT_A_JPEG: "DECODE_FAILED",
  CORRUPT_DATA: "DECODE_FAILED",
  UNSUPPORTED_FRAME: "DECODE_FAILED",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
};

async function decodeDct(doc, im, raw, rotate) {
  const filters = im.filters;
  const dict = im.obj.dict;
  if (doc.resolve(dict.Decode)) return refuse("UNSUPPORTED_SAMPLES", { filters, note: "a /Decode array on a DCT image is not applied here" });
  const cs = im.colorSpace;
  const expectComps = cs === "DeviceGray" ? 1 : cs === "DeviceRGB" ? 3 : cs === "DeviceCMYK" ? 4 : null;
  const p = decodeParms(doc, dict, filters.length - 1);
  const colorTransform = p ? numOf(doc, p.ColorTransform) : null;
  let out;
  try {
    out = decodeBaselineJpeg(raw, { rotate, expectComps, colorTransform });
  } catch (e) {
    if (!(e instanceof DctRefusal)) return refuse("DECODE_FAILED", { filters, note: String(e && e.message || e) });
    return refuse(DCT_TO_REFUSAL[e.code] || "DECODE_FAILED", { filters, jpeg: e.code, ...e.detail });
  }
  const bytes = await encodePng8(out.samples, out.width, out.height, out.comps);
  return { ok: true, route: "decoded-dct", mediaType: "image/png", bytes,
           width: out.width, height: out.height, upright: true,
           pixelsSha256: await sha256Hex(out.samples),
           dct: { ...out.source, comps: out.comps, stream_bytes: raw.length } };
}

/* ── PNG ──────────────────────────────────────────────────────────────────── */

/* ── /Rotate ──────────────────────────────────────────────────────────────────
 * A PAGE IS NOT ITS IMAGE, AND THIS COST A MEASUREMENT TO LEARN. The scanned
 * exhibit CPDF-9 ground-truthed carries `/Rotate 270`: the embedded image is
 * 3300x2550 landscape and the page a reader sees is portrait. Handing the raw
 * image to an OCR engine returned **8.67% character accuracy with 355 MINTED
 * digits** — fluent, confident, wholly invented text, not a failure the engine
 * announced. That is the exact hazard CPDF-10's chain rule exists for, arriving
 * one layer below where anyone was looking for it, and it is why `upright` is a
 * first-class field of the result rather than a detail of the caller's.
 */
function getBit(packed, rowBytes, x, y) {
  return (packed[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
}
function setBit(packed, rowBytes, x, y, v) {
  const i = y * rowBytes + (x >> 3), m = 0x80 >> (x & 7);
  if (v) packed[i] |= m; else packed[i] &= ~m;
}

/** Rotate interleaved 8-bit samples (`comps` per pixel) CLOCKWISE by 90/180/
 *  270 — `rotateBilevel`'s mapping, a sample landing on a sample. D-320. */
export function rotate8(samples, width, height, comps, deg) {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0) return { samples, width, height };
  if (d !== 90 && d !== 180 && d !== 270) throw new Error(`unsupported rotation ${deg}`);
  const [w2, h2] = d === 180 ? [width, height] : [height, width];
  const out = new Uint8Array(samples.length);
  for (let Y = 0; Y < h2; Y++) {
    for (let X = 0; X < w2; X++) {
      let sx, sy;
      if (d === 90) { sx = Y; sy = height - 1 - X; }
      else if (d === 180) { sx = width - 1 - X; sy = height - 1 - Y; }
      else { sx = width - 1 - Y; sy = X; }
      const o = (Y * w2 + X) * comps, i = (sy * width + sx) * comps;
      for (let c = 0; c < comps; c++) out[o + c] = samples[i + c];
    }
  }
  return { samples: out, width: w2, height: h2 };
}

/** Rotate a packed 1-bit image CLOCKWISE by 90/180/270. Exact and lossless: a
 *  bit lands on a bit. Returns { packed, width, height }. */
export function rotateBilevel(packed, width, height, deg) {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0) return { packed, width, height };
  if (d !== 90 && d !== 180 && d !== 270) throw new Error(`unsupported rotation ${deg}`);
  const srcRow = Math.ceil(width / 8);
  const [w2, h2] = d === 180 ? [width, height] : [height, width];
  const dstRow = Math.ceil(w2 / 8);
  const out = new Uint8Array(dstRow * h2);
  for (let Y = 0; Y < h2; Y++) {
    for (let X = 0; X < w2; X++) {
      let sx, sy;
      if (d === 90) { sx = Y; sy = height - 1 - X; }
      else if (d === 180) { sx = width - 1 - X; sy = height - 1 - Y; }
      else { sx = width - 1 - Y; sy = X; }
      setBit(out, dstRow, X, Y, getBit(packed, srcRow, sx, sy));
    }
  }
  return { packed: out, width: w2, height: h2 };
}

async function sha256Hex(u8) {
  const d = await crypto.subtle.digest("SHA-256", u8);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateZlib(bytes) {
  const cs = new CompressionStream("deflate");         // zlib-wrapped: what IDAT holds
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  const chunks = [];
  const rd = cs.readable.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function buildPng(raw, width, height, bitDepth, colorType) {
  return buildPngFromIdat(await deflateZlib(raw), width, height, bitDepth, colorType);
}

function buildPngFromIdat(idat, width, height, bitDepth, colorType) {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = bitDepth; ihdr[9] = colorType;
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}

/** Packed 1-bit rows, SET bit = white, to a grey-1 PNG. Filter type 0 per row:
 *  a bilevel scan gains almost nothing from the other filters and costs a pass
 *  over every row to find out.
 *
 *  THE PADDING BITS ARE ZEROED, and that line is here because it was a FINDING
 *  rather than a nicety. A width of 3300 leaves 4 wasted bits at the end of each
 *  scanline; a PNG reader must ignore them, so no summary statistic — size,
 *  dimensions, ink fraction, "all 2550 rows decoded" — can see them. Comparing
 *  the packed bytes against the independent decoder's byte for byte is what
 *  surfaced it: 10,200 bits (4 per row x 2550 rows) differed while every visible
 *  figure agreed. They are zeroed so the two representations are identical and
 *  there is one fewer difference that has to be explained away. */
async function encodePng1(packed, width, height) {
  const rowBytes = Math.ceil(width / 8);
  const pad = rowBytes * 8 - width;
  const mask = pad ? (0xff << pad) & 0xff : 0xff;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0;
    raw.set(packed.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
    if (pad) raw[(y + 1) * (rowBytes + 1) - 1] &= mask;
  }
  return buildPng(raw, width, height, 1, 0);
}

/** The packed rows with each scanline's wasted trailing bits zeroed — the exact
 *  representation an independent decoder produces, so a digest of it is
 *  comparable. Exported because the suite pins that digest and the expected
 *  value has INDEPENDENT provenance; a digest of our own convention would only
 *  prove we were self-consistent. */
export function normalisePacked(packed, width, height) {
  const rowBytes = Math.ceil(width / 8);
  const pad = rowBytes * 8 - width;
  const out = Uint8Array.from(packed);
  if (!pad) return out;
  const mask = (0xff << pad) & 0xff;
  for (let y = 0; y < height; y++) out[(y + 1) * rowBytes - 1] &= mask;
  return out;
}

/* An 8-bit page is 8x (grey) or 24x (RGB) the bytes of a bilevel one — a
 * 3300x2550 RGB scan is 25.2 MB of samples — so the filtered raster is fed to
 * the compressor in BANDS rather than built whole beside the samples, which
 * would be a second 25 MB copy in a 128 MB isolate (D-320). `picturepixels.mjs`
 * writes its PNG with it too (R42). */
export async function encodePng8(samples, width, height, comps) {
  const rowBytes = width * comps;
  const band = Math.max(1, Math.floor((1 << 20) / (rowBytes + 1)));
  const cs = new CompressionStream("deflate");
  const w = cs.writable.getWriter();
  const reading = (async () => {
    const chunks = [];
    const rd = cs.readable.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); }
    return chunks;
  })();
  for (let y0 = 0; y0 < height; y0 += band) {
    const n = Math.min(band, height - y0);
    const raw = new Uint8Array((rowBytes + 1) * n);
    for (let k = 0; k < n; k++) {
      raw.set(samples.subarray((y0 + k) * rowBytes, (y0 + k + 1) * rowBytes), k * (rowBytes + 1) + 1);
    }
    await w.write(raw);
  }
  await w.close();
  const chunks = await reading;
  const idat = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { idat.set(c, o); o += c.length; }
  return buildPngFromIdat(idat, width, height, 8, comps === 3 ? 2 : 0);
}
