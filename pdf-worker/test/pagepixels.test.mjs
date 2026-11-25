/* renderPageToPixels and the shared decode rules: R13–R26, R39, R40 and R41 of
 * build/requirements/pdf-pixels.md; renderPictureToPixels, R42 and R43.
 *
 * INDEPENDENT EXPECTATIONS (R40). The CCITT digests come from Pillow (libtiff's
 * G4) through pypdf 6.14.2 / Pillow 11.3.0, run 2026-08-08; the DCT digests and
 * `fixtures/dct-variants.json` from Pillow 11.3.0 (libjpeg-turbo 3.1.1), written
 * by `fixtures/make-dct-fixtures.py` on 2026-09-25. Neither shares a line with
 * this module. For the synthetic images below the expected samples are known by
 * construction, and every PNG is read back with node's own zlib (`readPng`), not
 * the subject's encoder. If a fixture changes, re-derive its digest from the
 * independent decoder, never from a failing run's output.
 *
 * FIXTURES. `scan-ccitt-g4-page.pdf` wraps the exact CCITT G4 stream (84,797 B,
 * K=-1, 3300x2550, /Rotate 270) of a scanned council resolution; `scan-dct-page.pdf`
 * wraps the exact DCT stream (261,747 B, 3300x2550, 4:2:0, restart interval 1656,
 * /Rotate 270) of another page of the same document. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderPageToPixels, REFUSALS, encodePng8 } from "../src/pagepixels.mjs";
import { renderPictureToPixels, PICTURE_FRAME_MAX, PICTURE_SOURCE_MAX, PNG_REFUSAL_REASONS, PNG_CODE_REASONS, PREPARE_TILT_MAX, PREPARE_TILT_FLOOR, PREPARE_LINE_PX, PREPARE_SCALE_MAX } from "../src/picturepixels.mjs";
import { PNG_REFUSES } from "../src/pngdecode.mjs";
import { CROP_REFUSALS } from "../src/imagecrop.mjs";
import { openPdf, pdfPageImages, imagePlacementSource } from "../../bio-plane/src/pdfstructure.mjs";
import { boundOf } from "../../bio-plane/src/read-bounds.mjs";
import { generate as generatePdf } from "../../bio-plane/test/pdfgen.mjs";
import { generate } from "../../bio-plane/test/imggen.mjs";
import { pixelRefusal, pageRefusal, renderedPage } from "./pdf-pixels-fixtures.mjs";
import { cropImage } from "../src/imagecrop.mjs";
import { makePdf, onePage, content, image, readPng, turn, hex, deflateSync, runner } from "./make-pdf.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();

const F = (p) => new Uint8Array(readFileSync(fileURLToPath(new URL(p, import.meta.url))));
const { t, finish } = runner("pagepixels");

/* Every answer is kept, so R39 can be checked over all of them at the end. */
const answers = [];
const render = async (...a) => { const r = await renderPageToPixels(...a); answers.push(r); return r; };
const fields = (r, ...k) => k.map((x) => r[x]);

const IND_UNROTATED_SHA = "e54f07066bcf32a7b105cf43bb331e29c95dafa05e1cf0176c2164811f3417ef";
const IND_UPRIGHT_SHA = "ac4eb57f0f966f5d5b07eca8c97b065ab56746f32cfe33f3ba8b31cd1579efbc";
const IND_WHITE_BITS = 7915462;
const DCT_UPRIGHT_SHA = "2afca4d5af6d1d463ee61eac64d5a270a3ac09334567727d5b90b48663225b94";
const DCT_UNROTATED_SHA = "5e0adab5d8376c1617cf3620c2f2a6123615eeb9c060c27182533db444ded706";
const DCT_STREAM_SHA = "a537b2e0c19d384234695e5f9724b60c4b19857d20102211003ae0cbffc4a15b";
const SCAN = F("fixtures/scan-ccitt-g4-page.pdf");
const DCT_SCAN = F("fixtures/scan-dct-page.pdf");
const VARIANTS = JSON.parse(Buffer.from(F("fixtures/dct-variants.json")).toString("utf8")).variants;
const jpeg = (name) => new Uint8Array(Buffer.from(VARIANTS.find((v) => v.name === name).jpeg_b64, "base64"));

/* The raw CCITT stream of the scan, for pages that re-wrap it, read through
   pdf-reader's own services. */
const CCITT = await (async () => {
  const doc = await openPdf(SCAN);
  return doc.streamRawBytes(imagePlacementSource((await pdfPageImages(doc, 0)).images[0]).stream);
})();

/* A page painting one image named /Im at the full page box. */
const imagePage = (img, { w = 8, h = 8, pageExtra = "", pagesExtra = "", ops } = {}) => onePage({
  box: [0, 0, w, h], res: "/XObject << /Im 5 0 R >>", pageExtra, pagesExtra,
  ops: ops ?? `q ${w} 0 0 ${h} 0 0 cm /Im Do Q`, more: [img],
});
const gray8 = (w, h) => Uint8Array.from({ length: w * h }, (_, i) => (i * 37 + 11) & 0xff);
const G = gray8(3, 2);
const GREY_IMG = image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", G);

console.log("\n--- R13: a %PDF- header in the first 1024 bytes ---");
{
  const doc = imagePage(GREY_IMG, { w: 3, h: 2 });
  for (const [label, bytes] of [
    ["an ArrayBuffer", doc.buffer], ["a string", "%PDF-1.7"], ["null", null],
    ["four bytes", new Uint8Array([1, 2, 3, 4])],
    ["the header after byte 1024", new Uint8Array([...new Uint8Array(1100).fill(0x20), ...doc])],
  ]) {
    const r = await render(bytes, 0);
    t(`R13 ${label}: NOT_A_PDF`, [r.ok, r.reason], [false, "NOT_A_PDF"]);
  }
  const late = new Uint8Array([...new Uint8Array(1000).fill(0x20), ...doc]);
  t("R13 a header at byte 1000 is read", (await render(late, 0)).ok, true);
}

console.log("\n--- R14: encrypted ---");
{
  const enc = onePage({ ops: "q 8 0 0 8 0 0 cm /Im Do Q", res: "/XObject << /Im 5 0 R >>",
    more: [GREY_IMG, "<< /Filter /Standard /V 1 /R 2 /O (owner) /U (user) /P -4 >>"], trailer: "/Encrypt 6 0 R" });
  const r = await render(enc, 0);
  t("R14 an encrypted document: ENCRYPTED", [r.ok, r.reason], [false, "ENCRYPTED"]);
}

console.log("\n--- R15: the page index ---");
{
  const doc = imagePage(GREY_IMG, { w: 3, h: 2 });
  for (const i of [-1, 1, 7]) {
    const r = await render(doc, i);
    t(`R15 page ${i} of 1: NO_SUCH_PAGE with pageCount`, fields(r, "ok", "reason", "pageCount"), [false, "NO_SUCH_PAGE", 1]);
  }
  /* pdf-reader's page index admits only dictionaries, so the one way an in-range
     page reads short is an attribute that cannot be read: a /Rotate that is not a
     multiple of 90 (R21). */
  const r = await render(imagePage(GREY_IMG, { w: 3, h: 2, pageExtra: "/Rotate 45" }), 0);
  t("R15 an in-range page that cannot be read: PAGE_UNREADABLE", fields(r, "ok", "reason", "page"), [false, "PAGE_UNREADABLE", 0]);
}

console.log("\n--- R16: a page that shows text ---");
{
  const FONT = "/Font << /F1 6 0 R >>";
  const helv = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const withOps = (ops, res = "") => onePage({ box: [0, 0, 3, 2], res: `/XObject << /Im 5 0 R ${res} >> ${FONT}`,
    ops: `q 3 0 0 2 0 0 cm /Im Do Q ${ops}`, more: [GREY_IMG, helv, content("BT /F1 1 Tf (x) Tj ET").replace("<<", "<< /Type /XObject /Subtype /Form /BBox [0 0 3 2] /Resources << /Font << /F1 6 0 R >> >>")] });
  for (const [label, ops] of [["Tj", "BT /F1 1 Tf (a) Tj ET"], ["TJ", "BT /F1 1 Tf [(a) 5 (b)] TJ ET"],
    ["'", "BT /F1 1 Tf 1 TL (a) ' ET"], ['"', 'BT /F1 1 Tf 1 TL 0 0 (a) " ET'], ["a Form XObject's Tj", "/Fm Do"]]) {
    const r = await render(withOps(ops, "/Fm 7 0 R"), 0);
    t(`R16 ${label}: PAGE_HAS_TEXT_LAYER with imageCount`, fields(r, "ok", "reason", "imageCount"), [false, "PAGE_HAS_TEXT_LAYER", 1]);
  }
  const allowed = await render(withOps("BT /F1 1 Tf (a) Tj ET", "/Fm 7 0 R"), 0, { allowTextPage: true });
  t("R16 allowTextPage renders it", [allowed.ok, allowed.page_marks?.hasTextOps], [true, true]);
  {
    /* G132i: a page of a scan with a text line over it (pdfgen "mixed"), generated, through the real render */
    const folio = await generatePdf({ kind: "pdf", seed: "folio", size: { pages: 2, lines: 3 }, kinds: ["mixed"], scan: { dpi: 100, bits: 1 } }).bytes();
    const refused = await render(folio, 0), allowedFolio = await render(folio, 0, { allowTextPage: true });
    t("R16 a scan with a text line is refused PAGE_HAS_TEXT_LAYER without the option", [refused.ok, refused.reason], [false, "PAGE_HAS_TEXT_LAYER"]);
    t("R16 a scan with a text line is rendered with allowTextPage: its scan, its text noted", [allowedFolio.ok, allowedFolio.page_marks?.hasTextOps, allowedFolio.upright], [true, true, true]);
  }
  for (const [label, ops] of [["a bare BT … ET", "BT ET"], ["BT with only a font set", "BT /F1 1 Tf ET"],
    ["Tj spelled inside a string", "/Span << /ActualText (a note Tj about it) >> BDC EMC"]]) {
    const r = await render(withOps(ops), 0);
    t(`R16 ${label} is not text: the page renders`, [r.ok ? "ok" : r.reason, r.page_marks?.hasTextOps], ["ok", false]);
  }
}

console.log("\n--- R17: no image on the page ---");
{
  const page = (ops) => onePage({ ops, box: [0, 0, 8, 8] });
  for (const [label, ops, reason] of [
    ["nothing painted", "q Q", "NO_IMAGE_ON_PAGE"], ["a clip alone", "0 0 8 8 re W n", "NO_IMAGE_ON_PAGE"],
    ["a stroke", "0 0 m 8 8 l S", "NOT_IMAGE_ONLY"], ["a fill", "0 0 8 8 re f", "NOT_IMAGE_ONLY"],
    ["an even-odd fill", "0 0 8 8 re f*", "NOT_IMAGE_ONLY"], ["fill and stroke", "0 0 8 8 re B", "NOT_IMAGE_ONLY"],
    ["a close-and-stroke", "0 0 m 8 8 l s", "NOT_IMAGE_ONLY"], ["a shading", "/Sh0 sh", "NOT_IMAGE_ONLY"],
  ]) {
    const r = await render(page(ops), 0);
    t(`R17 ${label}: ${reason}`, [r.ok, r.reason], [false, reason]);
  }
}

console.log("\n--- R18: several images ---");
{
  const two = onePage({ box: [0, 0, 8, 8], res: "/XObject << /A 5 0 R /B 6 0 R >>", ops: "q 8 0 0 8 0 0 cm /A Do /B Do Q",
    more: [image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", G), image(4, 4, "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode", deflateSync(new Uint8Array(4)))] });
  const r = await render(two, 0);
  t("R18 MULTIPLE_IMAGES_ON_PAGE with every image's size and filters", fields(r, "ok", "reason", "imageCount", "images"),
    [false, "MULTIPLE_IMAGES_ON_PAGE", 2, [{ width: 3, height: 2, filters: [] }, { width: 4, height: 4, filters: ["FlateDecode"] }]]);
  t("R18 and no bytes", r.bytes, undefined);
}

console.log("\n--- R17, R18: images are counted from what the page paints (K27) ---");
{
  const A = image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", G);
  const B = image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", G.map((v) => 255 - v));
  const shared = (ops) => makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /XObject << /A 5 0 R /B 6 0 R /Fm 7 0 R >> >> >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3 2] /Contents 4 0 R >>",
    content(ops), A, B,
    { dict: "<< /Type /XObject /Subtype /Form /BBox [0 0 3 2] /Resources << /XObject << /B 6 0 R >> >> >>", data: new TextEncoder().encode("q 3 0 0 2 0 0 cm /B Do Q") },
  ]);
  const one = await render(shared("q 3 0 0 2 0 0 cm /A Do Q"), 0);
  t("R18 a page that paints one of the two images its shared /Resources lists renders that one",
    [one.ok, one.route, one.pixels_sha256], [true, "raw-samples-grey8", hex(G)]);
  const none = await render(shared("q Q"), 0);
  t("R17 a page whose /Resources list images it never paints: NO_IMAGE_ON_PAGE", [none.ok, none.reason], [false, "NO_IMAGE_ON_PAGE"]);
  const noneVec = await render(shared("0 0 3 2 re f"), 0);
  t("R17 ...and with a vector mark: NOT_IMAGE_ONLY", noneVec.reason, "NOT_IMAGE_ONLY");
  const form = await render(shared("/Fm Do"), 0);
  t("R17 R18 an image painted inside a Form XObject is counted and rendered",
    [form.ok, form.pixels_sha256], [true, hex(G.map((v) => 255 - v))]);
  const both = await render(shared("q 3 0 0 2 0 0 cm /A Do Q /Fm Do"), 0);
  t("R18 one image painted directly and one inside a form: MULTIPLE_IMAGES_ON_PAGE",
    fields(both, "reason", "imageCount", "images"), ["MULTIPLE_IMAGES_ON_PAGE", 2,
      [{ width: 3, height: 2, filters: [] }, { width: 3, height: 2, filters: [] }]]);
  const twice = await render(shared("q 3 0 0 2 0 0 cm /A Do /A Do Q"), 0);
  t("R18 the same image painted twice is two paintings: MULTIPLE_IMAGES_ON_PAGE", fields(twice, "reason", "imageCount"), ["MULTIPLE_IMAGES_ON_PAGE", 2]);
  const lost = await render(shared("q 3 0 0 2 0 0 cm /Missing Do Q"), 0);
  t("R15 R17 a paint sequence that cannot be walked: PAGE_UNREADABLE, not a guessed count",
    fields(lost, "ok", "reason", "note"), [false, "PAGE_UNREADABLE", "xobject_unresolvable:page 0:Missing"]);
  const inline = await render(onePage({ box: [0, 0, 3, 2], ops: "q 3 0 0 2 0 0 cm BI /W 3 /H 2 /CS /G /BPC 8 ID abcdef EI Q" }), 0);
  t("R17 R19 a page painting only an inline image paints an image; reading it is not built: IMAGE_UNREADABLE",
    fields(inline, "ok", "reason", "page"), [false, "IMAGE_UNREADABLE", 0]);
}

console.log("\n--- R19: the image's own refusal, with page added ---");
{
  const r = await render(imagePage(image(8, 8, "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /LZWDecode", new Uint8Array(64))), 0);
  t("R19 a decode refusal carries the page", fields(r, "ok", "reason", "page", "filters"), [false, "UNSUPPORTED_FILTER", 0, ["LZWDecode"]]);
}

console.log("\n--- R20, R23, R40: the scanned CCITT page against an independent decoder ---");
{
  const r = await render(SCAN, 0);
  t("R20 the success shape", Object.keys(r).sort(), ["bytes", "ccitt", "height", "mediaType", "ok", "page", "page_geometry",
    "page_marks", "pixels_sha256", "rotate_deg", "route", "source", "turned_deg", "upright", "width"]);
  t("R20 route, media type, page", fields(r, "ok", "page", "route", "mediaType"), [true, 0, "decoded-ccitt-g4", "image/png"]);
  t("R20 source", r.source, { filters: ["CCITTFaxDecode"], colorSpace: "DeviceGray", bitsPerComponent: 1, imageMask: false });
  t("R20 page geometry", r.page_geometry, { mediaBoxPt: { w: 792, h: 612 }, rotate: 270, dpi: { x: 300, y: 300 } });
  t("R20 page marks", r.page_marks, { hasTextOps: false, hasVectorOps: false });
  t("R23 ccitt detail", r.ccitt, { K: -1, columns: 3300, rows: 2550, blackIs1: false, byteAlign: false, rowsDecoded: 2550 });
  t("R21 R23 the page's /Rotate 270 is applied: upright", fields(r, "width", "height", "upright", "rotate_deg"), [2550, 3300, true, 270]);
  t("R23 R40 upright pixels match the independent decoder", r.pixels_sha256, IND_UPRIGHT_SHA);
  const png = readPng(r.bytes);
  t("R23 a 1-bit grey PNG", [png.width, png.height, png.bitDepth, png.colorType], [2550, 3300, 1, 0]);
  t("R26 pixels_sha256 is the digest of the packed samples", hex(png.samples), r.pixels_sha256);
  /* The rotation apart from the decode: turned back by an independent walk, the
     picture matches the independent decoder's un-rotated one. */
  const rb = png.rowBytes, W0 = 3300, H0 = 2550, rb0 = Math.ceil(W0 / 8);
  const bit = (x, y) => (png.samples[y * rb + (x >> 3)] >> (7 - (x & 7))) & 1;
  const back = new Uint8Array(rb0 * H0);
  let white = 0;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    const v = bit(y, W0 - 1 - x);     // original (x,y) lands at (y, W0-1-x) under a clockwise 270
    if (v) { back[y * rb0 + (x >> 3)] |= 0x80 >> (x & 7); white++; }
  }
  t("R23 R40 un-rotated pixels match the independent decoder", hex(back), IND_UNROTATED_SHA);
  t("R23 R40 white-bit count matches the independent decoder", white, IND_WHITE_BITS);
}

console.log("\n--- R23: the CCITT filter chain, K and truncation ---");
{
  const ccittPage = (filter, parms, data) => imagePage(image(3300, 2550,
    `/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter ${filter} /DecodeParms ${parms}`, data),
    { w: 792, h: 612, pageExtra: "/Rotate 270" });
  const P = "<< /K -1 /Columns 3300 /Rows 2550 >>";
  const fl = await render(ccittPage("[/FlateDecode /CCITTFaxDecode]", `[null ${P}]`, deflateSync(CCITT)), 0);
  t("R23 FlateDecode before CCITTFaxDecode is decoded first: same picture", [fl.ok, fl.pixels_sha256], [true, IND_UPRIGHT_SHA]);
  const hexed = new TextEncoder().encode(Buffer.from(CCITT).toString("hex") + ">");
  const ah = await render(ccittPage("[/ASCIIHexDecode /CCITTFaxDecode]", `[null ${P}]`, hexed), 0);
  t("R23 any other predecessor: UNSUPPORTED_FILTER", [ah.ok, ah.reason], [false, "UNSUPPORTED_FILTER"]);
  const k1 = await render(ccittPage("/CCITTFaxDecode", "<< /K 1 /Columns 3300 /Rows 2550 >>", CCITT), 0);
  t("R23 mixed mode (K>0): UNSUPPORTED_FILTER", [k1.ok, k1.reason], [false, "UNSUPPORTED_FILTER"]);
  const short = await render(ccittPage("/CCITTFaxDecode", P, CCITT.subarray(0, 20000)), 0);
  t("R23 fewer rows than declared: TRUNCATED_IMAGE_DATA", fields(short, "ok", "reason", "declaredHeight"), [false, "TRUNCATED_IMAGE_DATA", 2550]);
  t("R23 and fewer rows were decoded", short.rowsDecoded < 2550, true);
  const whole = Buffer.from(ccittPage("/CCITTFaxDecode", P, CCITT));
  const cut = whole.lastIndexOf("endstream");
  const unreadable = new Uint8Array(Buffer.concat([whole.subarray(0, cut), Buffer.from("endstrXam"), whole.subarray(cut + 9)]));
  const ur = await render(unreadable, 0);
  t("R23 an unreadable stream: IMAGE_UNREADABLE", [ur.ok, ur.reason], [false, "IMAGE_UNREADABLE"]);
}

console.log("\n--- R24: raw samples, no filter or FlateDecode ---");
{
  /* 1-bit: 10x3, bit pattern known. For grey 1 = white, as in PNG. For an
     /ImageMask 0 is where it paints (PDF 32000-1 8.9.6.2), i.e. black, as in PNG,
     so the PNG holds the samples too; MuPDF 1.28.2 renders an all-0 mask black
     and an all-0 mask with /Decode [1 0] white (checked 2026-09-26, D-622). */
  const bits = Uint8Array.from([0b10110011, 0b01000000, 0b00001111, 0b11000000, 0b11111111, 0b00000000]);
  const pad = (u) => Uint8Array.from(u, (b, i) => (i % 2 ? b & 0b11000000 : b));
  for (const [label, extra, want] of [
    ["1-bpc grey", "/ColorSpace /DeviceGray /BitsPerComponent 1", pad(bits)],
    ["1-bpc grey with the default /Decode [0 1]", "/ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [0 1]", pad(bits)],
    ["an /ImageMask", "/ImageMask true", pad(bits)],
    ["an /ImageMask, FlateDecode", "/ImageMask true /Filter /FlateDecode", pad(bits)],
    ["an /ImageMask with the default /Decode [0 1]", "/ImageMask true /Decode [0 1]", pad(bits)],
  ]) {
    const data = /FlateDecode/.test(extra) ? deflateSync(bits) : bits;
    const r = await render(imagePage(image(10, 3, extra, data), { w: 10, h: 3 }), 0);
    const png = r.ok ? readPng(r.bytes) : {};
    t(`R24 ${label}: a 1-bit PNG of exactly those samples`, [r.route, r.upright, png.bitDepth, png.width, png.height, png.samples && hex(png.samples)],
      ["raw-samples-1bit", true, 1, 10, 3, hex(want)]);
    t(`R26 ${label}: pixels_sha256 over the packed samples`, r.pixels_sha256, hex(want));
  }
  const rgb = Uint8Array.from({ length: 3 * 2 * 3 }, (_, i) => (i * 29 + 3) & 0xff);
  for (const [label, extra, samples, comps, route, colorType] of [
    ["8-bit grey", "/ColorSpace /DeviceGray /BitsPerComponent 8", G, 1, "raw-samples-grey8", 0],
    ["8-bit grey, FlateDecode", "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", G, 1, "raw-samples-grey8", 0],
    ["8-bit RGB", "/ColorSpace /DeviceRGB /BitsPerComponent 8", rgb, 3, "raw-samples-rgb8", 2],
    ["8-bit RGB, FlateDecode", "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode", rgb, 3, "raw-samples-rgb8", 2],
  ]) {
    for (const deg of [0, 90, 180, 270]) {
      const data = /FlateDecode/.test(extra) ? deflateSync(samples) : samples;
      const r = await render(imagePage(image(3, 2, extra, data), { w: 3, h: 2, pageExtra: `/Rotate ${deg}` }), 0);
      const png = r.ok ? readPng(r.bytes) : {};
      const tr = turn((x, y) => samples.subarray((y * 3 + x) * comps, (y * 3 + x + 1) * comps), 3, 2, deg);
      const want = new Uint8Array(tr.W * tr.H * comps);
      for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) want.set(tr.at(X, Y), (Y * tr.W + X) * comps);
      t(`R24 ${label}, /Rotate ${deg}: the turned samples, upright`,
        [r.route, r.upright, r.rotate_deg, png.colorType, png.width, png.height, png.samples && hex(png.samples)],
        [route, true, deg, colorType, tr.W, tr.H, hex(want)]);
      t(`R24 R26 ${label}, /Rotate ${deg}: pixels_sha256 over the samples`, r.pixels_sha256, hex(want));
    }
  }
  for (const [label, extra, data, reason] of [
    ["CMYK", "/ColorSpace /DeviceCMYK /BitsPerComponent 8", new Uint8Array(24), "UNSUPPORTED_SAMPLES"],
    ["16-bit grey", "/ColorSpace /DeviceGray /BitsPerComponent 16", new Uint8Array(12), "UNSUPPORTED_SAMPLES"],
    ["4-bit grey", "/ColorSpace /DeviceGray /BitsPerComponent 4", new Uint8Array(4), "UNSUPPORTED_SAMPLES"],
    ["an indirect colour space", "/ColorSpace [/Indexed /DeviceRGB 1 <000000ffffff>] /BitsPerComponent 8", new Uint8Array(6), "UNSUPPORTED_SAMPLES"],
    ["data short of the height", "/ColorSpace /DeviceGray /BitsPerComponent 8", new Uint8Array(5), "TRUNCATED_IMAGE_DATA"],
    ["a corrupt Flate stream", "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", new Uint8Array([1, 2, 3, 4, 5, 6]), "IMAGE_UNREADABLE"],
  ]) {
    const r = await render(imagePage(image(3, 2, extra, data), { w: 3, h: 2 }), 0);
    t(`R24 ${label}: ${reason}`, [r.ok, r.reason, r.bytes], [false, reason, undefined]);
  }
  const noW = await render(imagePage({ dict: "<< /Type /XObject /Subtype /Image /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 >>", data: G }, { w: 3, h: 2 }), 0);
  t("R24 a missing width: IMAGE_UNREADABLE", [noW.ok, noW.reason], [false, "IMAGE_UNREADABLE"]);
  const short = await render(imagePage(image(64, 64, "/ColorSpace /DeviceGray /BitsPerComponent 1", new Uint8Array(8)), { w: 64, h: 64 }), 0);
  t("R24 short 1-bit data: TRUNCATED_IMAGE_DATA, stating how short", fields(short, "reason", "declaredHeight", "needBytes", "haveBytes"),
    ["TRUNCATED_IMAGE_DATA", 64, 512, 8]);
}

console.log("\n--- R21: the page's own /Rotate, inherited, never the caller's ---");
{
  const tree = (pagesRot, leafRot) => makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [3 0 R] /Count 1 ${pagesRot == null ? "" : `/Rotate ${pagesRot}`} >>`,
    `<< /Type /Pages /Parent 2 0 R /Kids [4 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 3 2] /Resources << /XObject << /Im 6 0 R >> >> /Contents 5 0 R ${leafRot == null ? "" : `/Rotate ${leafRot}`} >>`,
    content("q 3 0 0 2 0 0 cm /Im Do Q"),
    GREY_IMG,
  ]);
  const want = (deg) => {
    const tr = turn((x, y) => G[y * 3 + x], 3, 2, deg);
    const out = [];
    for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) out.push(tr.at(X, Y));
    return [deg, tr.W, tr.H, hex(Uint8Array.from(out))];
  };
  for (const [label, pagesRot, leafRot, deg] of [
    ["inherited from the root /Pages, two levels up (D-671)", 90, null, 90],
    ["inherited 180", 180, null, 180],
    ["inherited 270", 270, null, 270],
    ["the leaf's own 0 overrides an inherited 90", 90, 0, 0],
    ["the leaf's own 270 overrides an inherited 90", 90, 270, 270],
    ["none anywhere is 0", null, null, 0],
    ["-90 is 270", null, -90, 270],
    ["450 is 90", null, 450, 90],
  ]) {
    const r = await render(tree(pagesRot, leafRot), 0);
    t(`R21 ${label}`, [r.rotate_deg, r.width, r.height, r.pixels_sha256], want(deg));
    t(`R21 ${label}: page_geometry states it`, r.page_geometry?.rotate, deg);
  }
  const ignored = await render(tree(90, null), 0, { rotate: 180 });
  t("R21 opts.rotate is ignored: the page's own value wins", [ignored.rotate_deg, ignored.pixels_sha256], [want(90)[0], want(90)[3]]);
  const odd = await render(tree(45, null), 0);
  t("R21 a /Rotate that is not a multiple of 90 is not guessed: PAGE_UNREADABLE", [odd.ok, odd.reason], [false, "PAGE_UNREADABLE"]);
  /* The DCT pass-through under an inherited rotation states it, not upright. */
  const dctTree = makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 /Rotate 90 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 63 47] /Resources << /XObject << /Im 5 0 R >> >> /Contents 4 0 R >>",
    content("q 63 0 0 47 0 0 cm /Im Do Q"),
    image(63, 47, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", jpeg("rgb-420-h2v2")),
  ]);
  const pass = await render(dctTree, 0);
  t("R21 R22 pass-through under an inherited 90: upright false, rotate_deg 90", fields(pass, "route", "upright", "rotate_deg"), ["passthrough-dct", false, 90]);
  const dec = await render(dctTree, 0, { decodeDct: true });
  t("R21 R22 decoded under an inherited 90: turned, matching Pillow's turn",
    [dec.route, dec.upright, dec.width, dec.height, dec.pixels_sha256],
    ["decoded-dct", true, 47, 63, VARIANTS.find((v) => v.name === "rgb-420-rotate90").pillow_sha256]);
}

console.log("\n--- R22, R40: DCT, every variant through the renderer against Pillow ---");
{
  const ok = VARIANTS.filter((v) => v.expect === "ok"), no = VARIANTS.filter((v) => v.expect !== "ok");
  t("R22 (the variant corpus: 12 decodable, 4 refused)", [ok.length, no.length], [12, 4]);
  /* Each variant is the one image of a page whose /Rotate is the variant's turn;
     a variant's width and height are Pillow's, after that turn. */
  const variantPage = (v, cs) => {
    const [w, h] = v.rotate === 90 || v.rotate === 270 ? [v.height, v.width] : [v.width ?? 63, v.height ?? 47];
    return imagePage(image(w, h, `/ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode`, jpeg(v.name)),
      { w, h, pageExtra: `/Rotate ${v.rotate}` });
  };
  for (const v of ok) {
    const r = await render(variantPage(v, v.mode === "L" ? "/DeviceGray" : "/DeviceRGB"), 0, { decodeDct: true });
    const png = r.ok ? readPng(r.bytes) : {};
    t(`R22 R40 ${v.name}: decoded-dct, Pillow's pixels`, [r.ok ? r.route : r.reason, r.width, r.height, r.upright, r.pixels_sha256, png.colorType],
      ["decoded-dct", v.width, v.height, true, v.pillow_sha256, v.mode === "L" ? 0 : 2]);
  }
  const want = { "refuse-progressive": ["UNSUPPORTED_JPEG_PROCESS", "/DeviceRGB"], "refuse-arithmetic": ["UNSUPPORTED_JPEG_PROCESS", "/DeviceRGB"],
    "refuse-cmyk": ["UNSUPPORTED_SAMPLES", "/DeviceCMYK"], "refuse-truncated": ["TRUNCATED_IMAGE_DATA", "/DeviceRGB"] };
  for (const v of no) {
    const r = await render(variantPage(v, want[v.name][1]), 0, { decodeDct: true });
    t(`R22 ${v.name}: refused ${want[v.name][0]}, no bytes`, fields(r, "ok", "reason", "bytes"), [false, want[v.name][0], undefined]);
  }
}

console.log("\n--- R22: DCT through the renderer ---");
{
  const pass = await render(DCT_SCAN, 0);
  t("R22 by default the publisher's own bytes, untouched", [pass.ok, pass.route, pass.mediaType, hex(pass.bytes)], [true, "passthrough-dct", "image/jpeg", DCT_STREAM_SHA]);
  t("R22 R26 not upright under /Rotate 270, and no pixels_sha256", [pass.upright, pass.rotate_deg, "pixels_sha256" in pass], [false, 270, false]);
  const r = await render(DCT_SCAN, 0, { decodeDct: true });
  t("R22 R40 decodeDct: decoded-dct, turned, upright, matching Pillow", [r.route, r.mediaType, r.width, r.height, r.upright, r.pixels_sha256],
    ["decoded-dct", "image/png", 2550, 3300, true, DCT_UPRIGHT_SHA]);
  t("R22 dct detail", [r.dct?.process, r.dct?.sampling, r.dct?.restart, r.dct?.stream_bytes], ["baseline", "2x2,1x1,1x1", 1656, 261747]);
  const png = readPng(r.bytes);
  t("R22 R26 an 8-bit RGB PNG whose samples are the pixels_sha256", [png.bitDepth, png.colorType, hex(png.samples)], [8, 2, DCT_UPRIGHT_SHA]);
  const u = await render(imagePage(image(3300, 2550, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", pass.bytes), { w: 792, h: 612 }), 0, { decodeDct: true });
  t("R22 R40 the same stream on an unrotated page: Pillow's unrotated picture", [u.route, u.width, u.height, u.pixels_sha256],
    ["decoded-dct", 3300, 2550, DCT_UNROTATED_SHA]);

  const up = await render(imagePage(image(63, 47, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", jpeg("rgb-444")), { w: 63, h: 47 }), 0);
  t("R22 pass-through at /Rotate 0 is upright", [up.route, up.upright], ["passthrough-dct", true]);
  const dct = (extra, data = jpeg("rgb-444"), cs = "/DeviceRGB") =>
    imagePage(image(63, 47, `/ColorSpace ${cs} /BitsPerComponent 8 ${extra}`, data), { w: 63, h: 47 });
  for (const [label, bytes, reason, detail] of [
    ["progressive", dct("/Filter /DCTDecode", jpeg("refuse-progressive")), "UNSUPPORTED_JPEG_PROCESS", "progressive-huffman"],
    ["arithmetic-coded", dct("/Filter /DCTDecode", jpeg("refuse-arithmetic")), "UNSUPPORTED_JPEG_PROCESS", "extended-sequential-arithmetic"],
    ["truncated", dct("/Filter /DCTDecode", jpeg("refuse-truncated")), "TRUNCATED_IMAGE_DATA", undefined],
    ["a /Decode array", dct("/Filter /DCTDecode /Decode [1 0 1 0 1 0]"), "UNSUPPORTED_SAMPLES", undefined],
    ["a component count the colour space contradicts", dct("/Filter /DCTDecode", jpeg("rgb-444"), "/DeviceGray"), "UNSUPPORTED_SAMPLES", undefined],
    ["a /ColorTransform the markers contradict", dct("/Filter /DCTDecode /DecodeParms << /ColorTransform 0 >>"), "UNSUPPORTED_SAMPLES", undefined],
    ["a stream with no SOI", dct("/Filter /DCTDecode", new Uint8Array(64).fill(7)), "DECODE_FAILED", undefined],
  ]) {
    const r2 = await render(bytes, 0, { decodeDct: true });
    t(`R22 decodeDct, ${label}: ${reason}`, [r2.ok, r2.reason, r2.process, r2.bytes], [false, reason, detail, undefined]);
  }
  const behind = await render(dct("/Filter [/FlateDecode /DCTDecode]", deflateSync(jpeg("rgb-444"))), 0);
  t("R22 anything before DCTDecode: UNSUPPORTED_FILTER", [behind.ok, behind.reason], [false, "UNSUPPORTED_FILTER"]);
  const behind2 = await render(dct("/Filter [/FlateDecode /DCTDecode]", deflateSync(jpeg("rgb-444"))), 0, { decodeDct: true });
  t("R22 ...with decodeDct too", behind2.reason, "UNSUPPORTED_FILTER");
  const small = await render(dct("/Filter /DCTDecode"), 0, { decodeDct: true });
  t("R22 R40 a small page through the whole route matches Pillow", small.pixels_sha256, VARIANTS.find((v) => v.name === "rgb-444").pillow_sha256);
}

console.log("\n--- R25: JBIG2 and JPX are jbig2.test.mjs's and jpx.test.mjs's; here, a stream that is neither ---");
{
  /* Eight zero bytes: to JBIG2 a segment header that runs out; to JPEG 2000
     neither a codestream nor a JP2 file. */
  for (const [f, reason] of [["JBIG2Decode", "TRUNCATED_IMAGE_DATA"], ["JPXDecode", "DECODE_FAILED"]]) {
    const r = await render(imagePage(image(8, 8, `/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /${f}`, new Uint8Array(8))), 0);
    t(`R25 ${f} over eight zero bytes: ${reason}, no bytes`, fields(r, "ok", "reason", "bytes"), [false, reason, undefined]);
  }
}

console.log("\n--- R40: pure per call ---");
{
  const key = (r) => JSON.stringify({ ...r, bytes: r.bytes ? hex(r.bytes) : null });
  for (const [label, bytes, opts] of [["the CCITT scan", SCAN, {}], ["the DCT scan, decoded", DCT_SCAN, { decodeDct: true }],
    ["a refusal", new Uint8Array(4), {}]]) {
    const a = await render(bytes, 0, opts), b = await render(bytes, 0, opts);
    t(`R40 ${label}: the same answer twice`, key(a) === key(b), true);
  }
  /* The decode runs the same in workerd, the runtime the fleet serves in. */
  let bundled = null, why = null;
  try {
    const esbuild = await (async () => {
      try { return await import("esbuild"); } catch { /* fall through */ }
      const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
      return await import(pathToFileURL(createRequire(planePkg).resolve("esbuild")).href);
    })();
    const out = await esbuild.build({
      stdin: {
        contents: `import { renderPageToPixels } from ${JSON.stringify(fileURLToPath(new URL("../src/pagepixels.mjs", import.meta.url)))};
import { renderPictureToPixels } from ${JSON.stringify(fileURLToPath(new URL("../src/picturepixels.mjs", import.meta.url)))};
export default { async fetch(req) {
  const q = new URL(req.url).searchParams, body = new Uint8Array(await req.arrayBuffer());
  const r = q.has("edge") ? await renderPictureToPixels(body, 0, { maxEdge: Number(q.get("edge")), grey: true })
    : await renderPageToPixels(body, 0, { decodeDct: q.has("dct") });
  return Response.json(r.ok ? { ok: true, route: r.route, width: r.width, height: r.height, upright: r.upright, pixels_sha256: r.pixels_sha256 } : r);
} };`,
        resolveDir: fileURLToPath(new URL(".", import.meta.url)), sourcefile: "pagepixels-under-test.mjs",
      },
      bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers", "node:*"],
    });
    bundled = out.outputFiles[0].text;
  } catch (e) { why = String(e && e.message || e).split("\n")[0]; }
  t("R40 (the workerd arm could be built)", why, null);
  if (bundled) {
    const mf = new Miniflare({ modules: true, modulesRoot: "/", script: bundled, scriptPath: "/pagepixels-under-test.mjs",
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] });
    try {
      const j = await (await mf.dispatchFetch("http://x/", { method: "POST", body: SCAN })).json();
      t("R40 workerd: the CCITT page, upright, the independent decoder's pixels", [j.ok, j.width, j.height, j.upright, j.pixels_sha256], [true, 2550, 3300, true, IND_UPRIGHT_SHA]);
      const jd = await (await mf.dispatchFetch("http://x/?dct=1", { method: "POST", body: DCT_SCAN })).json();
      t("R40 workerd: the DCT page decoded, Pillow's pixels", [jd.ok, jd.route, jd.pixels_sha256], [true, "decoded-dct", DCT_UPRIGHT_SHA]);
      const PV = JSON.parse(Buffer.from(F("fixtures/picture-variants.json")).toString("utf8")).variants;
      for (const [name, edge] of [["photo-4032x3024-o6", 1568], ["orient-7", 10], ["png-rgba", 30]]) {
        const v = PV.find((x) => x.name === name), e = v.expect.find((x) => x.max_edge === edge && x.grey);
        const jp = await (await mf.dispatchFetch(`http://x/?edge=${edge}`, { method: "POST", body: Buffer.from(v.b64, "base64") })).json();
        t(`R40 R42 workerd: the picture ${name}, Pillow's pixels`, [jp.ok, jp.route, jp.width, jp.height, jp.pixels_sha256], [true, "decoded-picture", e.width, e.height, e.pillow_sha256]);
      }
    } finally { await mf.dispose(); }
  }
}

console.log("\n--- R42, R43: a picture file, against Pillow 12.3.0 ---");
{
  /* `fixtures/picture-variants.json` is written by `make-picture-fixtures.py`
     with Pillow 12.3.0: each expected digest is Pillow's `exif_transpose`,
     `convert("L")` and `reduce(k)` over the same file (a PNG is never turned),
     never this module's own output (R40). */
  const PV = JSON.parse(Buffer.from(F("fixtures/picture-variants.json")).toString("utf8"));
  t("R42 (the reference is Pillow 12.3.0)", PV.pillow, "12.3.0");
  const pic = (name) => new Uint8Array(Buffer.from(PV.variants.find((v) => v.name === name).b64, "base64"));
  const picture = async (...a) => { const r = await renderPictureToPixels(...a); answers.push(r); return r; };
  const chunks = (png) => { const b = Buffer.from(png), out = []; for (let o = 8; o < b.length; o += 12 + b.readUInt32BE(o)) out.push(b.toString("latin1", o + 4, o + 8)); return out; };

  for (const v of PV.variants.filter((x) => x.expect.length && !x.name.startsWith("photo"))) {
    for (const e of v.expect) {
      const r = await picture(pic(v.name), 0, { maxEdge: e.max_edge, grey: e.grey });
      const png = r.ok ? readPng(r.bytes) : {};
      t(`R42 R43 ${v.name}, maxEdge ${e.max_edge}${e.grey ? ", grey" : ""}: Pillow's pixels`,
        [r.ok ? r.route : r.reason, r.orientation, r.reduced_by, r.width, r.height, r.pixels_sha256, png.colorType, png.samples && hex(png.samples)],
        ["decoded-picture", e.orientation, e.reduced_by, e.width, e.height, e.pillow_sha256, e.mode === "L" ? 0 : 2, e.pillow_sha256]);
      t(`R42 ${v.name}, maxEdge ${e.max_edge}: the source as the file states it`, r.source && [r.source.format, r.source.width, r.source.height],
        [e.source.format, e.source.width, e.source.height]);
    }
  }
  {
    /* K2701: R43 reads EXIF only. Pillow's `exif_transpose` also takes an XMP
       `tiff:Orientation` when EXIF has none; this module does not. */
    const e = PV.variants.find((v) => v.name === "orient-xmp-6-only").expect[0];
    const r = await picture(pic("orient-xmp-6-only"), 0, { maxEdge: 64, grey: true });
    t("R43 an XMP tiff:Orientation 6 with no EXIF tag is NOT applied (EXIF only; a stated divergence from Pillow, which would turn it)",
      [r.orientation, r.width, r.height, r.pixels_sha256], [1, 37, 23, e.pillow_sha256]);
  }
  t("R43 (every orientation 1–8 is among them, and both byte orders)", [1, 2, 3, 4, 5, 6, 7, 8].every((o) => PV.variants.some((v) => v.name === `orient-${o}`))
    && PV.variants.some((v) => v.name === "orient-6-big-endian"), true);
  t("R42 (every reduction path Pillow has is among them: k = 2, 3, 4, 5 and over 5)",
    [2, 3, 4, 5, 6].every((k) => PV.variants.some((v) => v.expect.some((e) => k === 6 ? e.reduced_by > 5 : e.reduced_by === k))), true);

  /* The photograph R42's entry names: a phone held upright. */
  const PHOTO = pic("photo-4032x3024-o6");
  const pe = PV.variants.find((v) => v.name === "photo-4032x3024-o6").expect[0];
  const ph = await picture(PHOTO, 0, { maxEdge: 1568, grey: true });
  t("R42 the success shape", Object.keys(ph).sort(), ["bytes", "height", "mediaType", "ok", "orientation", "page", "pixels_sha256",
    "reduced_by", "route", "source", "turned_deg", "upright", "width"]);
  t("R42 R43 a 4032×3024 colour JPEG, Orientation 6: a portrait grey PNG, long edge at most 1,568, Pillow's pixels",
    [ph.ok, ph.page, ph.route, ph.mediaType, ph.upright, ph.orientation, ph.reduced_by, ph.width, ph.height, ph.height > ph.width,
      Math.max(ph.width, ph.height) <= 1568, ph.pixels_sha256],
    [true, 0, "decoded-picture", "image/png", true, 6, 3, 1008, 1344, true, true, pe.pillow_sha256]);
  t("R42 the photograph's source", ph.source, { format: "jpeg", width: 4032, height: 3024, comps: 3 });
  const php = readPng(ph.bytes);
  t("R42 an 8-bit grey PNG under 5 MiB whose samples are the pixels_sha256",
    [php.bitDepth, php.colorType, ph.bytes.length < 5 * 1048576, hex(php.samples)], [8, 0, true, pe.pillow_sha256]);
  t("R42 the photograph's PNG is still 155,814 B (T43's, node's deflate)", ph.bytes.length, 155814);
  t("R42 never the file's own bytes: a PNG of IHDR, IDAT and IEND only, carrying no EXIF",
    [chunks(ph.bytes), Buffer.from(ph.bytes).includes("Exif")], [["IHDR", "IDAT", "IEND"], false]);

  console.log("\n--- R42 (T44): a 48-megapixel photograph, decoded while reduced, against Pillow 12.3.0 ---");
  {
    /* `make-picture-fixtures.py` keeps a seed: a Pillow-made JPEG 8064 wide with a
       restart marker after each MCU row. The 48 MP file is those rows' entropy runs
       laid out by the script's rule, the RSTn renumbered, the height set to 6048 and
       an Exif orientation inserted; the bytes are checked against the script's
       digest before any picture is, and every expected picture is Pillow's. */
    const P = PV.photo48, seed = Buffer.from(P.seed_b64, "base64");
    const seq = (i) => (5 * i + Math.floor(i / P.seed_rows)) % P.seed_rows;
    let p = 2;
    for (;;) { const m = seed[p + 1]; p += 2 + seed.readUInt16BE(p + 2); if (m === 0xda) break; }
    const header = Buffer.from(seed.subarray(0, p)), runs = [];
    for (let q = p, start = p; ; q++) {
      if (seed[q] === 0xff && ((seed[q + 1] >= 0xd0 && seed[q + 1] <= 0xd7) || seed[q + 1] === 0xd9)) {
        runs.push(seed.subarray(start, q));
        if (seed[q + 1] === 0xd9) break;
        start = q + 2; q++;
      }
    }
    header.writeUInt16BE(P.height, header.indexOf(Buffer.from([0xff, 0xc0])) + 5);
    const exif = (o) => { const b = Buffer.alloc(32); b.write("Exif\0\0II", 0, "latin1"); b.writeUInt16LE(42, 8); b.writeUInt32LE(8, 10);
      b.writeUInt16LE(1, 14); b.writeUInt16LE(0x0112, 16); b.writeUInt16LE(3, 18); b.writeUInt32LE(1, 20); b.writeUInt16LE(o, 24); return b; };
    const assemble = (o) => {
      const n = Math.ceil(P.height / 16), parts = [header.subarray(0, 2), Buffer.from([0xff, 0xe1, 0, 34]), exif(o), header.subarray(2)];
      for (let i = 0; i < n; i++) { parts.push(runs[seq(i)]); if (i < n - 1) parts.push(Buffer.from([0xff, 0xd0 + (i & 7)])); }
      parts.push(Buffer.from([0xff, 0xd9]));
      return new Uint8Array(Buffer.concat(parts));
    };
    t("R42 (the seed holds one entropy run per MCU row)", runs.length, P.seed_rows);
    t("R42 (every orientation the entry names is among them: 1, 3, 6, 8)", P.assembled.map((a) => a.orientation), [1, 3, 6, 8]);
    for (const a of P.assembled) {
      const file = assemble(a.orientation);
      t(`R42 (the 48 MP file, Orientation ${a.orientation}, is the script's, byte for byte)`, hex(file), a.sha256);
      for (const e of a.expect) {
        const r = await picture(file, 0, { maxEdge: e.max_edge, grey: e.grey });
        t(`R42 R43 8064×6048 colour, Orientation ${a.orientation}, maxEdge ${e.max_edge}${e.grey ? ", grey" : ", colour"}: decoded while reduced, Pillow's pixels`,
          [r.ok ? r.route : r.reason, r.orientation, r.reduced_by, r.width, r.height, r.source, r.pixels_sha256],
          ["decoded-picture", e.orientation, e.reduced_by, e.width, e.height, { format: "jpeg", width: 8064, height: 6048, comps: 3 }, e.pillow_sha256]);
      }
    }
    t("R42 (partial edge boxes are among them: k = 5 leaves 4 columns and 3 rows over)",
      P.assembled.some((a) => a.expect.some((e) => e.reduced_by === 5)) && 8064 % 5 === 4 && 6048 % 5 === 3, true);
  }

  console.log("\n--- R42: the refusals, each beside a control that is accepted (K874) ---");
  const SMALL = pic("orient-1");
  const ok = await picture(SMALL, 0, { maxEdge: 64, grey: true });
  t("R42 (control) a JPEG as a Uint8Array renders", ok.ok, true);
  t("R42 (control) the same JPEG as an ArrayBuffer renders the same picture",
    (await picture(SMALL.slice().buffer, 0, { maxEdge: 64, grey: true })).pixels_sha256, ok.pixels_sha256);
  for (const [label, bytes] of [["a PDF", imagePage(GREY_IMG, { w: 3, h: 2 })], ["a GIF", new TextEncoder().encode("GIF89a\x01\x00\x01\x00")],
    ["no bytes", new Uint8Array(0)], ["null", null], ["a string", "\xff\xd8\xff"], ["two bytes of a JPEG signature", Uint8Array.from([0xff, 0xd8, 0x00, 0xe0])],
    ["seven bytes of a PNG signature", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00])]]) {
    const r = await picture(bytes, 0, { maxEdge: 64, grey: true });
    t(`R42 ${label}: NOT_A_PICTURE, no bytes`, fields(r, "ok", "reason", "bytes"), [false, "NOT_A_PICTURE", undefined]);
  }
  for (const i of [1, -1, 0.5, "0", null]) {
    const r = await picture(SMALL, i, { maxEdge: 64, grey: true });
    t(`R42 page ${JSON.stringify(i)}: NO_SUCH_PAGE with pageCount 1`, fields(r, "ok", "reason", "pageCount"), [false, "NO_SUCH_PAGE", 1]);
  }
  /* The bound is read from the header, before any decode: a frame one column
     over it is refused although its data could not even be decoded, and one
     exactly at it gets past the bound to the decoder's own refusal. */
  const sof = (() => { for (let p = 2; ; ) { if (SMALL[p + 1] === 0xc0) return p; p += 2 + ((SMALL[p + 2] << 8) | SMALL[p + 3]); } })();
  const jpegSized = (w, h) => { const b = SMALL.slice(); b[sof + 5] = h >> 8; b[sof + 6] = h & 255; b[sof + 7] = w >> 8; b[sof + 8] = w & 255; return b; };
  /* T44: a JPEG is decoded while reduced, so its header's full frame is judged
     against PICTURE_SOURCE_MAX and its reduced frame against PICTURE_FRAME_MAX. */
  const [SW, SH] = [Math.floor(PICTURE_SOURCE_MAX / 3 / 8064), 8064];
  t("R42 (the source bound admits the 48 MP phone frames, in colour, either way up, and the 200 MP ones)",
    [[8000, 6000], [6000, 8000], [8064, 6048], [6048, 8064], [16320, 12240], [12240, 16320]].every(([w, h]) => w * h * 3 <= PICTURE_SOURCE_MAX), true);
  const over = await picture(jpegSized(SW + 1, SH), 0, { maxEdge: 1568, grey: true });
  t("R42 a JPEG header past PICTURE_SOURCE_MAX: IMAGE_TOO_LARGE before any decode, naming the bound",
    fields(over, "ok", "reason", "width", "height", "comps", "samples", "bound", "bound_name"),
    [false, "IMAGE_TOO_LARGE", SW + 1, SH, 3, (SW + 1) * SH * 3, PICTURE_SOURCE_MAX, "PICTURE_SOURCE_MAX"]);
  t("R42 (that header is past the source bound and the next column under it is not)",
    [(SW + 1) * SH * 3 > PICTURE_SOURCE_MAX, SW * SH * 3 <= PICTURE_SOURCE_MAX], [true, true]);
  const under = await picture(jpegSized(SW, SH), 0, { maxEdge: 1568, grey: true });
  t("R42 (control) a JPEG header one column under it reaches the decoder (its data is a small file's: the decoder's own refusal)",
    [under.ok, under.reason], [false, "TRUNCATED_IMAGE_DATA"]);
  const whole = await picture(jpegSized(8064, 6048), 0, { maxEdge: 8064, grey: true });
  t("R42 a 48 MP JPEG kept whole (k = 1): its reduced frame past PICTURE_FRAME_MAX, IMAGE_TOO_LARGE before any decode",
    fields(whole, "ok", "reason", "reduced_by", "samples", "bound", "bound_name"),
    [false, "IMAGE_TOO_LARGE", 1, 8064 * 6048 * 3, PICTURE_FRAME_MAX, "PICTURE_FRAME_MAX"]);
  const halved = await picture(jpegSized(8064, 6048), 0, { maxEdge: 4032, grey: true });
  t("R42 (control) the same header halved (k = 2, 4032×3024×3 within PICTURE_FRAME_MAX) reaches the decoder",
    [halved.ok, halved.reason, 4032 * 3024 * 3 <= PICTURE_FRAME_MAX], [false, "TRUNCATED_IMAGE_DATA", true]);
  const eq = await picture(jpegSized(4097, 3072), 0, { maxEdge: 1568, grey: true });
  t("R42 (control) a JPEG header the size of the PNG refused below (4097×3072 colour) is not refused for size: it reaches the decoder",
    [eq.ok, eq.reason], [false, "TRUNCATED_IMAGE_DATA"]);
  const ihdr = (w, h, ct) => {
    const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
    b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); b[24] = 8; b[25] = ct;
    return new Uint8Array(b);
  };
  for (const [label, w, h, ct, n] of [["an RGB PNG", 4097, 3072, 2, 3], ["an RGBA PNG (four channels)", 3600, 3000, 6, 4]]) {
    const r = await picture(ihdr(w, h, ct), 0, { maxEdge: 64, grey: true });
    t(`R42 ${label} header over PICTURE_FRAME_MAX (a PNG is judged on its full frame): IMAGE_TOO_LARGE before any decode`,
      fields(r, "ok", "reason", "samples", "bound", "bound_name"), [false, "IMAGE_TOO_LARGE", w * h * n, PICTURE_FRAME_MAX, "PICTURE_FRAME_MAX"]);
  }
  const atPng = await picture(ihdr(4096, 3072, 2), 0, { maxEdge: 64, grey: true });
  t("R42 (control) a PNG header at the bound reaches the decoder", [atPng.ok, atPng.reason !== "IMAGE_TOO_LARGE"], [false, true]);
  for (const [name, reason] of [["refuse-progressive", "UNSUPPORTED_JPEG_PROCESS"], ["refuse-cmyk", "UNSUPPORTED_SAMPLES"], ["refuse-truncated", "TRUNCATED_IMAGE_DATA"]]) {
    const r = await picture(pic(name), 0, { maxEdge: 64, grey: true });
    t(`R42 the JPEG codec's refusal, mapped as R22 maps it: ${name} is ${reason}, no bytes`, fields(r, "ok", "reason", "page", "bytes"), [false, reason, 0, undefined]);
  }
  /* PNG: the codec's refusals mapped as R25 maps JBIG2's and JPX's, each
     beside the untouched file, which renders. */
  const PNG = Buffer.from(pic("png-rgb"));
  t("R42 (control) the untouched PNG renders", (await picture(new Uint8Array(PNG), 0, { maxEdge: 64, grey: true })).ok, true);
  const crcOf = (b) => { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, "latin1"); Buffer.from(data).copy(b, 8); b.writeUInt32BE(crcOf(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const afterIhdr = (extra) => new Uint8Array(Buffer.concat([PNG.subarray(0, 33), extra, PNG.subarray(33)]));
  const interlaced = Buffer.from(PNG); interlaced[28] = 1; interlaced.writeUInt32BE(crcOf(interlaced.subarray(12, 29)), 29);
  const badCrc = Buffer.from(PNG); badCrc[40] ^= 0xff;
  for (const [label, bytes, reason] of [
    ["an interlaced PNG", new Uint8Array(interlaced), PNG_REFUSAL_REASONS["interlaced"]],
    ["an unknown critical chunk", afterIhdr(chunk("ABCD", [1, 2, 3])), PNG_REFUSAL_REASONS["an unknown critical chunk"]],
    ["a PNG cut short", new Uint8Array(PNG.subarray(0, PNG.length >> 1)), "TRUNCATED_IMAGE_DATA"],
    ["a damaged chunk (its CRC)", new Uint8Array(badCrc), "DECODE_FAILED"],
  ]) {
    const r = await picture(bytes, 0, { maxEdge: 64, grey: true });
    t(`R42 the PNG codec's refusal, mapped: ${label} is ${reason}, no bytes`, fields(r, "ok", "reason", "page", "bytes"), [false, reason, 0, undefined]);
  }
  t("R42 the mapping is total over PNG_REFUSES: every feature has a declared reason, and the codec's IMAGE_TOO_LARGE code maps to IMAGE_TOO_LARGE",
    [Object.keys(PNG_REFUSAL_REASONS).sort(), Object.values(PNG_REFUSAL_REASONS).every((x) => x in REFUSALS), PNG_CODE_REASONS.IMAGE_TOO_LARGE],
    [Object.keys(PNG_REFUSES).sort(), true, "IMAGE_TOO_LARGE"]);
  const withText = await picture(afterIhdr(chunk("tEXt", Buffer.from("Comment\0a member's note"))), 0, { maxEdge: 64, grey: true });
  t("R42 never the file's own bytes: a PNG's text chunk does not reach the answer",
    [withText.ok, chunks(withText.bytes), Buffer.from(withText.bytes).includes("member")], [true, ["IHDR", "IDAT", "IEND"], false]);
  for (const bad of [0, -3, 1.5, undefined, "64"]) {
    let threw = null;
    try { await renderPictureToPixels(SMALL, 0, { maxEdge: bad, grey: true }); } catch (e) { threw = e.constructor.name; }
    t(`R42 a maxEdge of ${JSON.stringify(bad)} is the caller's error: a TypeError, not an answer`, threw, "TypeError");
  }

  console.log("\n--- R40: a picture, pure per call ---");
  const key = (r) => JSON.stringify({ ...r, bytes: r.bytes ? hex(r.bytes) : null });
  const a = await picture(pic("orient-7"), 0, { maxEdge: 10, grey: false }), b = await picture(pic("orient-7"), 0, { maxEdge: 10, grey: false });
  t("R40 R42 the same picture and options: the same answer twice", key(a) === key(b), true);
}

console.log("\n--- R44: a photographed page, made ready for the engine ---");
{
  /* The photographs are `pages` of `fixtures/picture-variants.json` (made by `make-picture-fixtures.py`): a page of
     printed words drawn, then tilted, reduced, lit unevenly, flattened, blurred and given noise from formulas. The
     words each one holds are the page's own text; the real engine (tesseract-wasm 0.11.0 and the tessdata_fast model `ocr-worker` pins) reads the prepared and the unprepared picture, and the
     share of the page's words found (each word counted once per occurrence, case and punctuation ignored) is
     compared with the floor. The tilt and the contrast are measured on the returned pixels by the readings below,
     written here from their definitions, not by the subject. */
  const PV = JSON.parse(Buffer.from(F("fixtures/picture-variants.json")).toString("utf8"));
  const PAGES = Object.fromEntries(PV.pages.map((p) => [p.name, p]));
  const bytesOf = (name) => new Uint8Array(Buffer.from(PAGES[name].b64, "base64"));
  const variant = (name) => new Uint8Array(Buffer.from(PV.variants.find((v) => v.name === name).b64, "base64"));
  const FLOOR = 0.9;
  /* C18 (T51 fix round 2): the walk's hard photograph is a whole page of small print, blurred. `page-hard` is its twin
     (231 words, 110 dpi, a 2.4 degree tilt, perspective, noise, blur 1.0): measured through the engine, unprepared 2
     percent, prepared 56 percent (48 with lines enlarged to 40 px, the measure before this entry), so the floor on it is 52 percent. Its blur leaves nothing to read in a smaller page
     (`page-hard-blur`, under 10 percent: the engine's own legibility is `ocr-worker`'s to state), so no floor is
     claimed there. */
  const HARD_FLOOR = 0.52;
  /* The engine is the vendor package `ocr-worker` pins, resolved through that module's package.json (as miniflare is
     above, through bio-plane's), and the model is the file that module ships; no source of `ocr-worker` is imported. */
  const ocrPkg = createRequire(fileURLToPath(new URL("../../ocr-worker/package.json", import.meta.url)));
  const { createOCREngine } = await import(pathToFileURL(ocrPkg.resolve("tesseract-wasm")).href);
  const engineWasm = readFileSync(ocrPkg.resolve("tesseract-wasm").replace(/lib\.js$/, "tesseract-core.wasm"));
  const engineModel = new Uint8Array(readFileSync(fileURLToPath(new URL("../../ocr-worker/assets/eng.traineddata", import.meta.url))));
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const shareRead = (truth, got) => {
    const left = new Map();
    for (const w of words(got)) left.set(w, (left.get(w) || 0) + 1);
    const want = words(truth);
    let hit = 0;
    for (const w of want) if (left.get(w) > 0) { hit++; left.set(w, left.get(w) - 1); }
    return want.length ? hit / want.length : 0;
  };
  const readByEngine = async (png) => {
    const p = readPng(png), rgba = new Uint8ClampedArray(p.width * p.height * 4);
    for (let i = 0; i < p.width * p.height; i++) rgba.fill(p.samples[i], i * 4, i * 4 + 3), rgba[i * 4 + 3] = 255;
    const engine = await createOCREngine({ wasmBinary: engineWasm });
    try {
      engine.loadModel(engineModel);
      engine.loadImage({ data: rgba, width: p.width, height: p.height });
      return (engine.getTextBoxes("line") || []).map((b) => b.text).join(" ");
    } finally { engine.destroy(); }
  };
  const photo = async (name, opts = {}) => { const r = await renderPictureToPixels(bytesOf(name), 0, { maxEdge: 4096, grey: true, ...opts }); answers.push(r); return r; };
  /* The tilt of the lines in grey samples, in degrees (positive when they rise to the right): the angle, over a
     tenth-degree sweep, at which the ink's rows are most unevenly filled. */
  const tiltOf = (png) => {
    const p = readPng(png), pts = [];
    for (let y = 0; y < p.height; y++) for (let x = (y % 3); x < p.width; x += 3) if (p.samples[y * p.width + x] < 100) pts.push([x, y]);
    let best = 0, bestScore = -1;
    for (let a = -6; a <= 6.0001; a += 0.1) {
      const sl = Math.tan((a * Math.PI) / 180), rows = new Map();
      for (const [x, y] of pts) { const k = Math.round(y + x * sl); rows.set(k, (rows.get(k) || 0) + 1); }
      let sq = 0; for (const c of rows.values()) sq += c * c;
      if (sq > bestScore) { bestScore = sq; best = a; }
    }
    return best;
  };
  /* The text lines of grey samples: the runs of rows holding ink, and the median one's height in pixels. */
  const lineHeight = (png) => {
    const p = readPng(png), runs = [];
    let run = 0;
    for (let y = 0; y <= p.height; y++) {
      let ink = 0;
      if (y < p.height) for (let x = 0; x < p.width; x++) if (p.samples[y * p.width + x] < 100) ink++;
      if (ink > p.width * 0.004) run++; else { if (run >= 4) runs.push(run); run = 0; }
    }
    runs.sort((a, b) => a - b);
    return runs.length ? runs[runs.length >> 1] : 0;
  };
  /* The light: the mean of the brighter half of the pixels in each third of the width, and the darkest half percent. */
  const light = (png) => {
    const p = readPng(png), mean = [];
    for (let i = 0; i < 3; i++) {
      const v = [];
      for (let y = 0; y < p.height; y++) for (let x = Math.floor((i * p.width) / 3); x < Math.floor(((i + 1) * p.width) / 3); x++) v.push(p.samples[y * p.width + x]);
      v.sort((a, b) => a - b);
      const up = v.slice(v.length >> 1);
      mean.push(up.reduce((a, b) => a + b, 0) / up.length);
    }
    const all = Array.from(p.samples).sort((a, b) => a - b);
    return { paper: Math.min(...mean), spread: Math.max(...mean) - Math.min(...mean), ink: all[Math.floor(all.length * 0.005)] };
  };

  t("R44 (the constants the requirement states)", [PREPARE_TILT_MAX, PREPARE_TILT_FLOOR, PREPARE_LINE_PX, PREPARE_SCALE_MAX], [10, 0.1, 20, 4]);
  t("R44 (the fixture set holds the entry's pictures: a 2.4 degree tilt, 110 dpi, noise, and a picture with no text)",
    ["page-tilt-2.4", "page-110dpi", "page-noise-shade", "page-combined-a", "page-combined-b", "page-big-text", "page-blank"].every((n) => PAGES[n]), true);

  const READ_PAGES = PV.pages.filter((p) => p.words);
  const shares = {};
  for (const pg of READ_PAGES) {
    const prepared = await photo(pg.name, { prepare: true });
    const raw = await photo(pg.name);
    shares[pg.name] = { prepared: shareRead(pg.words, await readByEngine(prepared.bytes)), raw: shareRead(pg.words, await readByEngine(raw.bytes)) };
    if (!pg.name.startsWith("page-hard"))
      t(`R44 the floor: ${pg.name} read through the engine after preparation, at least ${FLOOR * 100} percent of its words`, shares[pg.name].prepared >= FLOOR, true);
  }
  t(`R44 the floor (C18): page-hard, the walk's hard photograph, read through the engine after preparation, at least ${HARD_FLOOR * 100} percent of its words`,
    shares["page-hard"].prepared >= HARD_FLOOR, true);
  t("R44 control (C18): page-hard unprepared falls under that floor (the preparation is the cause)", shares["page-hard"].raw < HARD_FLOOR, true);
  t("R44 control (C18): the preparation never reads fewer of page-hard-blur's words than the unprepared picture", shares["page-hard-blur"].prepared >= shares["page-hard-blur"].raw, true);
  console.log("  (words read, prepared / unprepared: " + Object.entries(shares).map(([n, v]) => `${n} ${Math.round(v.prepared * 100)}/${Math.round(v.raw * 100)}`).join(", ") + ")");
  /* The control: what the preparation fixes is what falls under the floor without it. */
  for (const n of ["page-noise-shade", "page-combined-a", "page-combined-b"])
    t(`R44 control: ${n} unprepared falls under the floor (the preparation is the cause)`, shares[n].raw < FLOOR, true);

  for (const n of ["page-tilt-2.4", "page-combined-a", "page-combined-b"]) {
    const pg = PAGES[n], r = await photo(n, { prepare: true }), raw = await photo(n);
    t(`R44 tilt: ${n} (true tilt ${pg.tilt_deg}) is found within half a degree`, Math.abs(r.prepared.tilt_deg - pg.tilt_deg) <= 0.5, true);
    t(`R44 tilt: ${n} prepared is level to within half a degree, by the test's own reading of its pixels`, Math.abs(tiltOf(r.bytes)) <= 0.5, true);
    t(`R44 tilt control: ${n} unprepared is still tilted past half a degree, the cause being the preparation`, Math.abs(tiltOf(raw.bytes) - pg.tilt_deg) <= 0.5 && Math.abs(tiltOf(raw.bytes)) > 0.5, true);
  }
  {
    const level = await photo("page-clean", { prepare: true });
    t("R44 tilt: a level page is not turned (under PREPARE_TILT_FLOOR)", level.prepared.tilt_deg, 0);
  }

  for (const n of ["page-noise-shade", "page-combined-a", "page-combined-b"]) {
    const r = await photo(n, { prepare: true }), raw = await photo(n), lp = light(r.bytes), lr = light(raw.bytes);
    t(`R44 contrast: ${n} prepared has paper at least 243, thirds within 12 of one another, ink at most 30`, [lp.paper >= 243, lp.spread <= 12, lp.ink <= 30], [true, true, true]);
    t(`R44 contrast control: ${n} unprepared has none of the three`, [lr.paper >= 243, lr.spread <= 12, lr.ink <= 30], [false, false, false]);
  }

  {
    const raw = await photo("page-110dpi"), r = await photo("page-110dpi", { prepare: true });
    const lines = lineHeight(raw.bytes), got = lineHeight(r.bytes);
    t("R44 scale: 110 dpi lines (under PREPARE_LINE_PX) are enlarged to it, the factor answered, the size following it",
      [lines < PREPARE_LINE_PX, Math.abs(got - PREPARE_LINE_PX) <= 3, r.prepared.scale > 1 && r.prepared.scale <= PREPARE_SCALE_MAX,
       Math.abs(r.width - Math.round(raw.width * r.prepared.scale)) <= 2, r.width > raw.width],
      [true, true, true, true, true]);
    const capped = await photo("page-110dpi", { prepare: true, maxEdge: 1200 });
    t("R44 scale: never past maxEdge", [Math.max(capped.width, capped.height) <= 1200, capped.prepared.scale > 1], [true, true]);
    const big = await photo("page-big-text", { prepare: true }), bigRaw = await photo("page-big-text");
    t("R44 scale control: lines of PREPARE_LINE_PX or more keep their size", [big.prepared.scale, big.width, big.height, lineHeight(bigRaw.bytes) >= PREPARE_LINE_PX], [1, bigRaw.width, bigRaw.height, true]);
  }

  {
    const blank = await photo("page-blank", { prepare: true }), plain = await photo("page-blank");
    t("R44 no text: a picture with no text lines says so and is handed on as R42 made it",
      [blank.ok, blank.prepared, blank.pixels_sha256, blank.width, blank.height], [true, { text_found: false, tilt_deg: 0, scale: 1, line_px: 0 }, plain.pixels_sha256, plain.width, plain.height]);
    t("R44 no text: the engine reads no words from it (it says so, it does not return a short text)", words(await readByEngine(blank.bytes)), []);
    t("R44 no text control: a page with text says text_found", (await photo("page-clean", { prepare: true })).prepared.text_found, true);
  }

  /* R44 (a), (d) (fix round 10, cause 6; K5053): a sparse page. The walkers' pictures hold three lines of text, under half a
     percent ink: the ink level was taken from the darkest half percent of all the pixels, so the paper went dark and the page
     was found to hold no text. The pictures are made by test-support's imggen, the walkers' recipes. */
  {
    /* The ink of a page however little of it there is: the darkest twentieth of the pixels under 128 (the 0.5th percentile
       of all the pixels, `light().ink`, is paper on a page whose ink is under half a percent). */
    const inkLevel = (png) => {
      const v = Array.from(readPng(png).samples).filter((x) => x < 128).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length * 0.05)] : 255;
    };
    const sparse = async (recipe, opts = {}) => {
      const g = generate({ kind: "png", seed: "rw9-A-7", size: { pages: 1, lines: 3 }, ...recipe });
      const r = await renderPictureToPixels(await g.bytes(), 0, { maxEdge: 4096, grey: true, prepare: true, ...opts });
      answers.push(r);
      return { r, truth: g.truth };
    };
    for (const frame of [undefined, [4096, 3000], [4097, 3000]]) {
      const { r, truth } = await sparse(frame ? { frame } : {});
      const inkShare = (() => { const p = readPng(r.bytes); let n = 0; for (const v of p.samples) if (v < 96) n++; return n / p.samples.length; })();
      t(`R44 sparse page: three lines of text${frame ? ` framed ${frame.join(" x ")}` : ""} are found to hold text, the lines 15 to 30 px`,
        [r.ok, r.prepared.text_found, r.prepared.line_px >= 15 && r.prepared.line_px <= 30], [true, true, true]);
      t(`R44 sparse page: ${frame ? frame.join(" x ") : "the letter page"} keeps its paper light (read 243 or more) and holds under half a percent ink`,
        [light(r.bytes).paper >= 243, inkShare > 0 && inkShare < 0.005, truth.pages[0].lines.length], [true, true, 3]);
      t(`R44 sparse page: ${frame ? frame.join(" x ") : "the letter page"}'s ink reads at most 30, however little of it there is`, inkLevel(r.bytes) <= 30, true);
    }
    const noise = await sparse({ seed: "rw9-A-noise", size: { pages: 1, lines: 0 }, degrade: { noise: 0.4 } });
    t("R44 sparse page control: noise is still no text", [noise.r.ok, noise.r.prepared.text_found], [true, false]);
    t("R44 sparse page control: a blank page is still no text", (await photo("page-blank", { prepare: true })).prepared.text_found, false);
    const dense = await sparse({ size: { pages: 1, lines: 18 } });
    t("R44 sparse page control: a dense page is still text, its ink at most 30", [dense.r.prepared.text_found, inkLevel(dense.r.bytes) <= 30], [true, true]);
    const words3 = words(await readByEngine((await sparse({})).r.bytes));
    t("R44 sparse page: the engine reads words from the prepared three-line page", words3.length > 0, true);
  }

  /* R44 (a), (d) (T52-4; C-K13): a faint print. A receipt whose ink is 80 to 90 percent of its paper (ink 200 on paper 240,
     the same page as the sparse test's) is found to hold text, as the same pixels are read inside a PDF, and the engine
     reads its words; a blank page of that paper stays no text. */
  {
    const g = generate({ kind: "png", seed: "rw9-A-7", size: { pages: 1, lines: 3 } });
    const base = readPng((await renderPictureToPixels(await g.bytes(), 0, { maxEdge: 4096, grey: true })).bytes);
    const faint = async (inkAt, paperAt, blank = false) => {
      const px = base.samples.map((v) => blank ? paperAt : Math.round(inkAt + (v * (paperAt - inkAt)) / 255));
      const r = await renderPictureToPixels(await encodePng8(px, base.width, base.height, 1), 0, { maxEdge: 4096, prepare: true });
      answers.push(r);
      return r;
    };
    for (const [ink, paper] of [[200, 240], [205, 240]]) {
      const r = await faint(ink, paper);
      t(`R44 faint print: ink ${ink} on paper ${paper} is found to hold text, the lines 15 to 30 px, the paper light`,
        [r.ok, r.prepared.text_found, r.prepared.line_px >= 15 && r.prepared.line_px <= 30, light(r.bytes).paper >= 243], [true, true, true, true]);
    }
    t("R44 faint print: the engine reads words from the prepared faint page", words(await readByEngine((await faint(200, 240)).bytes)).length > 0, true);
    t("R44 faint print control: a blank page of that paper is still no text", (await faint(200, 240, true)).prepared.text_found, false);
  }

  {
    const a = await photo("page-combined-a", { prepare: true }), b = await photo("page-combined-a", { prepare: true });
    t("R44 R40 the same bytes and options prepare to the same pixels, and the answer's keys are R42's with `prepared`",
      [a.pixels_sha256 === b.pixels_sha256, Object.keys(a).sort(), a.route, a.mediaType, a.upright, a.page],
      [true, ["bytes", "height", "mediaType", "ok", "orientation", "page", "pixels_sha256", "prepared", "reduced_by", "route", "source", "turned_deg", "upright", "width"], "decoded-picture", "image/png", true, 0]);
    t("R44 the pixels_sha256 is over the prepared samples", a.pixels_sha256, createHash("sha256").update(readPng(a.bytes).samples).digest("hex"));
    t("R44 control: without prepare the answer carries no `prepared` and is R42's grey", [(await photo("page-combined-a")).prepared, (await photo("page-combined-a")).width], [undefined, PAGES["page-combined-a"].width]);
    const colour = await renderPictureToPixels(variant("reduce"), 0, { maxEdge: 200, prepare: true });
    t("R44 prepare implies grey: a colour JPEG answers an 8-bit grey PNG", [colour.ok, readPng(colour.bytes).colorType], [true, 0]);
    const png = await renderPictureToPixels(variant("png-rgb"), 0, { maxEdge: 200, prepare: true });
    t("R44 a PNG is prepared by the same rule (no text lines in this one: text_found false)", [png.ok, png.prepared.text_found], [true, false]);
    const tiny = await renderPictureToPixels(variant("orient-1"), 0, { maxEdge: 64, prepare: true });
    t("R44 R42 a refusal still refuses as R42 does (bytes that are no picture)", (await renderPictureToPixels(new Uint8Array([1, 2, 3, 4]), 0, { maxEdge: 64, prepare: true })).reason, "NOT_A_PICTURE");
    t("R44 a tiny picture with no text lines is answered, not refused", [tiny.ok, tiny.prepared.text_found], [true, false]);
  }
}

console.log("\n--- the published fixtures: pixelRefusal, pageRefusal, renderedPage give the module's own real answers ---");
{
  for (const [reason, extra] of [["NOT_A_PDF", {}], ["PAGE_HAS_TEXT_LAYER", { imageCount: 1 }], ["MULTIPLE_IMAGES_ON_PAGE", { imageCount: 2 }],
    ["UNSUPPORTED_FILTER", { filters: ["LZWDecode"] }], ["PIXELS_UNDETERMINED", { detail: "decode_array" }]]) {
    const r = await pixelRefusal(reason);
    t(`fixtures pixelRefusal(${reason}) is the renderer's refusal, its why that reason's own text`, [r.ok, r.reason, r.why, r.bytes, ...Object.keys(extra).map((k) => r[k])],
      [false, reason, REFUSALS[reason], undefined, ...Object.values(extra)]);
  }
  const big = await pixelRefusal("IMAGE_TOO_LARGE");
  t("fixtures pixelRefusal(IMAGE_TOO_LARGE) is the picture renderer's, naming PICTURE_FRAME_MAX", [big.ok, big.reason, big.bound_name, big.bound], [false, "IMAGE_TOO_LARGE", "PICTURE_FRAME_MAX", PICTURE_FRAME_MAX]);
  t("fixtures pixelRefusal refuses a reason it makes no input for", await pixelRefusal("A_REASON_NOBODY_DECLARED").then(() => "answered", (e) => e.message.slice(0, 12)), "pixelRefusal");
  const text = await pageRefusal("PAGE_HAS_TEXT_LAYER"), prog = await pageRefusal("UNSUPPORTED_JPEG_PROCESS"), none = await pageRefusal("NOT_A_PICTURE");
  t("fixtures pageRefusal: PAGE_HAS_TEXT_LAYER, UNSUPPORTED_JPEG_PROCESS (with jpeg, process and page), NOT_A_PICTURE",
    [[text.ok, text.reason], [prog.ok, prog.reason, prog.page, typeof prog.jpeg, typeof prog.process], [none.ok, none.reason, none.why]],
    [[false, "PAGE_HAS_TEXT_LAYER"], [false, "UNSUPPORTED_JPEG_PROCESS", 0, "string", "string"], [false, "NOT_A_PICTURE", REFUSALS.NOT_A_PICTURE]]);
  const pdf = await renderedPage("pdf"), pic = await renderedPage("picture", { prepare: true });
  t("fixtures renderedPage('pdf') is the page renderer's success: route, size, digest, geometry",
    [pdf.ok, pdf.route, pdf.mediaType, [pdf.width, pdf.height], pdf.upright, pdf.rotate_deg, pdf.pixels_sha256 === createHash("sha256").update(readPng(pdf.bytes).samples).digest("hex"), "page_geometry" in pdf],
    [true, "raw-samples-grey8", "image/png", [3, 2], true, 0, true, true]);
  t("fixtures renderedPage('picture', {prepare}) is the picture renderer's success, prepared",
    [pic.ok, pic.route, pic.mediaType, pic.upright, pic.prepared.text_found, pic.pixels_sha256 === createHash("sha256").update(readPng(pic.bytes).samples).digest("hex")], [true, "decoded-picture", "image/png", true, true, true]);
}

console.log("\n--- R45: wrong pixels are never ok:true ---");
{
  const undetermined = async (label, bytes, detail, opts = {}) => {
    const r = await render(bytes, 0, opts);
    t(`R45 ${label}: PIXELS_UNDETERMINED, ${detail}, no bytes`, [r.ok, r.reason, r.detail, r.bytes], [false, "PIXELS_UNDETERMINED", detail, undefined]);
    return r;
  };
  const grey = (extra, data = G) => imagePage(image(3, 2, `/ColorSpace /DeviceGray /BitsPerComponent 8 ${extra}`, data), { w: 3, h: 2 });
  const bits1 = Uint8Array.from([0b10110011, 0b01000000, 0b00001111, 0b11000000, 0b11111111, 0b00000000]);
  const rgb = Uint8Array.from({ length: 18 }, (_, i) => (i * 29 + 3) & 0xff);

  /* /Decode (R24): a sample inverted by the dictionary is never presented as it is stored */
  await undetermined("8-bit grey with /Decode [1 0]", grey("/Decode [1 0]"), "decode_array");
  await undetermined("8-bit RGB with /Decode [1 0 1 0 1 0]", imagePage(image(3, 2, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Decode [1 0 1 0 1 0]", rgb), { w: 3, h: 2 }), "decode_array");
  await undetermined("1-bit grey with /Decode [1 0]", imagePage(image(10, 3, "/ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [1 0]", bits1), { w: 10, h: 3 }), "decode_array");
  await undetermined("an /ImageMask with /Decode [1 0]", imagePage(image(10, 3, "/ImageMask true /Decode [1 0]", bits1), { w: 10, h: 3 }), "decode_array");
  await undetermined("8-bit grey with /Decode [0 0.5] (a stretch)", grey("/Decode [0 0.5]"), "decode_array");
  await undetermined("8-bit grey with /Decode of the wrong length", grey("/Decode [0 1 0 1]"), "decode_array");
  t("R45 (control) 8-bit grey with the default /Decode [0 1] is rendered, the same pixels as with none",
    [(await render(grey("/Decode [0 1]"), 0)).pixels_sha256, (await render(grey(""), 0)).pixels_sha256], [hex(G), hex(G)]);
  t("R45 (control) 8-bit RGB with the default /Decode [0 1 0 1 0 1] is rendered",
    (await render(imagePage(image(3, 2, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Decode [0 1 0 1 0 1]", rgb), { w: 3, h: 2 }), 0)).pixels_sha256, hex(rgb));

  /* /SMask and /Mask (R24) */
  const withObj = (extra, obj) => onePage({ box: [0, 0, 3, 2], res: "/XObject << /Im 5 0 R >>", ops: "q 3 0 0 2 0 0 cm /Im Do Q",
    more: [image(3, 2, `/ColorSpace /DeviceGray /BitsPerComponent 8 ${extra}`, G), obj] });
  const alpha = image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", new Uint8Array(6).fill(128));
  await undetermined("an image with an /SMask", withObj("/SMask 6 0 R", alpha), "smask");
  await undetermined("an image with a stencil /Mask stream", withObj("/Mask 6 0 R", image(3, 2, "/ImageMask true /BitsPerComponent 1", new Uint8Array(2))), "mask");
  await undetermined("an image with a colour-key /Mask [0 10]", withObj("/Mask [0 10]", "<< >>"), "mask");
  t("R45 (control) the same page with neither is rendered", (await render(withObj("", "<< >>"), 0)).pixels_sha256, hex(G));

  /* a TIFF predictor (R24) */
  const flate = (extra, data) => imagePage(image(3, 2, `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ${extra}`, deflateSync(data)), { w: 3, h: 2 });
  await undetermined("FlateDecode with /Predictor 2", flate("/DecodeParms << /Predictor 2 /Colors 1 /BitsPerComponent 8 /Columns 3 >>", G), "tiff_predictor");
  t("R45 (control) FlateDecode with /Predictor 1 is rendered", (await render(flate("/DecodeParms << /Predictor 1 >>", G), 0)).pixels_sha256, hex(G));
  const png15 = Uint8Array.from([0, ...G.subarray(0, 3), 0, ...G.subarray(3, 6)]);
  t("R45 (control) a PNG predictor (15), which pdf-reader undoes, is rendered",
    (await render(flate("/DecodeParms << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns 3 >>", png15), 0)).pixels_sha256, hex(G));

  /* CCITT /Columns against /Width (R23) */
  const ccitt = (parms) => imagePage(image(3300, 2550, `/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms ${parms}`, CCITT), { w: 792, h: 612, pageExtra: "/Rotate 270" });
  const cc = await undetermined("CCITT /Columns 3000 on a 3300-wide image", ccitt("<< /K -1 /Columns 3000 /Rows 2550 >>"), "ccitt_columns");
  t("R45 ...naming both figures", [cc.columns, cc.width], [3000, 3300]);
  await undetermined("CCITT with no /Columns (1,728) on a 3300-wide image", ccitt("<< /K -1 /Rows 2550 >>"), "ccitt_columns");
  t("R45 (control) CCITT with /Columns equal to /Width is rendered, the independent decoder's pixels",
    (await render(ccitt("<< /K -1 /Columns 3300 /Rows 2550 >>"), 0)).pixels_sha256, IND_UPRIGHT_SHA);

  /* the DCT pass-through is examined (R22) */
  const dctPage = (w, h, cs, data = jpeg("rgb-444")) => imagePage(image(w, h, `/ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode`, data), { w: 63, h: 47 });
  await undetermined("a pass-through whose JPEG is 63 wide under a dictionary that says 64", dctPage(64, 47, "/DeviceRGB"), "dct_unexamined");
  await undetermined("a pass-through whose JPEG is 47 high under a dictionary that says 48", dctPage(63, 48, "/DeviceRGB"), "dct_unexamined");
  await undetermined("a pass-through whose JPEG has 3 components under /DeviceGray", dctPage(63, 47, "/DeviceGray"), "dct_unexamined");
  await undetermined("a pass-through whose stream states no frame at all", dctPage(63, 47, "/DeviceRGB", Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0])), "dct_unexamined");
  const okp = await render(dctPage(63, 47, "/DeviceRGB"), 0);
  t("R45 (control) the agreeing pass-through is the publisher's bytes", [okp.ok, okp.route, hex(okp.bytes)], [true, "passthrough-dct", hex(jpeg("rgb-444"))]);
  const prog = await render(dctPage(63, 47, "/DeviceRGB", jpeg("refuse-progressive")), 0);
  t("R45 (control) an agreeing progressive JPEG is still passed through (its frame is read, not decoded)", [prog.ok, prog.route], [true, "passthrough-dct"]);
  const crop = await cropImage(dctPage(64, 47, "/DeviceRGB"), { kind: "image", page: 0, rect: [0, 0, 63, 47] });
  t("R45 a crop of the disagreeing image says the decoder's reason", [crop.ok, crop.reason, crop.decoder], [false, "DECODE_REFUSED", "PIXELS_UNDETERMINED"]);
}

console.log("\n--- R46: declared sizes are judged before any decode, with the table's figures ---");
{
  const PIXELS = boundOf("image", "pixels"), EDGE = boundOf("image", "edge");
  const sized = (w, h, filter, parms, data) => imagePage(image(w, h, `/ColorSpace /DeviceGray /BitsPerComponent 1 ${filter ? `/Filter /${filter}` : ""} ${parms}`, data), { w: 8, h: 8 });
  const over = async (label, bytes) => {
    const r = await render(bytes, 0);
    t(`R46 ${label}: IMAGE_TOO_LARGE with the declared size and the bounds, no decode, no bytes`,
      [r.ok, r.reason, r.declared?.width, r.declared?.height, r.bound, r.bytes, r.rowsDecoded, r.jbig2, r.jpx, r.jpeg],
      [false, "IMAGE_TOO_LARGE", r.declared?.width, r.declared?.height, { pixels: PIXELS, edge: EDGE }, undefined, undefined, undefined, undefined, undefined]);
    return r;
  };
  const big = await over("an 8 KB CCITT stream declaring 60,000 x 60,000", sized(60000, 60000, "CCITTFaxDecode", "/DecodeParms << /K -1 /Columns 60000 /Rows 60000 >>", new Uint8Array(8000)));
  t("R46 ...its figures", [big.declared.width, big.declared.height, big.declared.pixels], [60000, 60000, 3.6e9]);
  await over("a DCT pass-through declaring 60,000 x 60,000 (judged before the header is compared)", imagePage(image(60000, 60000, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", jpeg("rgb-444")), { w: 8, h: 8 }));
  await over("a JBIG2 stream declaring 16,000 x 16,000", sized(16000, 16000, "JBIG2Decode", "", new Uint8Array(20)));
  await over("a JPX stream declaring 30,000 x 30,000", sized(30000, 30000, "JPXDecode", "", new Uint8Array(20)));
  await over("raw samples declaring 12,000 x 10,001 (one row over the pixel bound)", sized(12000, 10001, "", "", new Uint8Array(8)));
  const wide = await over("a raw image 65,536 wide and one row high (under the pixel bound, over the edge bound)", sized(EDGE + 1, 1, "", "", new Uint8Array(8)));
  t("R46 ...the edge is what it breaks", [wide.declared.pixels <= PIXELS, wide.declared.width > EDGE], [true, true]);
  /* the controls: at the bounds the route is reached and gives its own answer */
  const atPixels = await render(sized(12000, 10000, "", "", new Uint8Array(8)), 0);
  t("R46 (control) 12,000 x 10,000, exactly the pixel bound, reaches its route: TRUNCATED_IMAGE_DATA", [atPixels.reason, 12000 * 10000 === PIXELS], ["TRUNCATED_IMAGE_DATA", true]);
  const atEdge = await render(sized(EDGE, 1, "", "", new Uint8Array(8)), 0);
  t("R46 (control) 65,535 x 1, exactly the edge bound, reaches its route: TRUNCATED_IMAGE_DATA", atEdge.reason, "TRUNCATED_IMAGE_DATA");
  /* a crop reads the same rule */
  const c = await cropImage(sized(60000, 60000, "CCITTFaxDecode", "/DecodeParms << /K -1 /Columns 60000 /Rows 60000 >>", new Uint8Array(8000)), { kind: "image", page: 0, rect: [0, 0, 8, 8] });
  t("R46 a crop of it: DECODE_REFUSED naming IMAGE_TOO_LARGE", [c.ok, c.reason, c.decoder], [false, "DECODE_REFUSED", "IMAGE_TOO_LARGE"]);
}

console.log("\n--- R48: a turned page or picture is turned upright on request ---");
{
  const rgb = Uint8Array.from({ length: 18 }, (_, i) => (i * 29 + 3) & 0xff);
  const page = (rot, img = GREY_IMG) => imagePage(img, { w: 3, h: 2, pageExtra: `/Rotate ${rot}` });
  const wantGrey = (deg) => { const tr = turn((x, y) => G[y * 3 + x], 3, 2, deg); const o = []; for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) o.push(tr.at(X, Y)); return [tr.W, tr.H, hex(Uint8Array.from(o))]; };
  for (const deg of [0, 90, 180, 270]) {
    const r = await render(page(0), 0, { turn: deg });
    t(`R48 an 8-bit page, turn ${deg}: the samples turned exactly, turned_deg ${deg}, upright`, [r.width, r.height, r.pixels_sha256, r.turned_deg, r.rotate_deg, r.upright], [...wantGrey(deg), deg, 0, true]);
    t(`R48 (control) the same page, turn ${deg}: the png's samples are the digest's`, hex(readPng(r.bytes).samples), r.pixels_sha256);
  }
  const both = await render(page(90), 0, { turn: 90 });
  t("R48 the turn follows the page's own /Rotate (90 then 90 is 180); rotate_deg stays the page's", [both.pixels_sha256, both.rotate_deg, both.turned_deg, both.upright], [wantGrey(180)[2], 90, 90, true]);
  const plain = await render(page(0), 0);
  for (const bad of [45, "90", -90, 360, null, 1.5, undefined]) {
    const r = await render(page(0), 0, { turn: bad });
    t(`R48 a turn of ${JSON.stringify(bad)} is ignored as 0`, [r.pixels_sha256, r.turned_deg], [plain.pixels_sha256, 0]);
  }
  t("R48 no turn asked: turned_deg 0", plain.turned_deg, 0);
  const ign = await render(page(90), 0, { turn: 0, rotate: 180 });
  t("R48 R21 opts.rotate is still ignored", ign.pixels_sha256, wantGrey(90)[2]);
  /* 1-bit: a bit lands on a bit */
  const bits = Uint8Array.from([0b10110011, 0b01000000, 0b00001111, 0b11000000, 0b11111111, 0b00000000]);
  const bitAt = (x, y) => (bits[y * 2 + (x >> 3)] >> (7 - (x & 7))) & 1;
  for (const deg of [90, 180, 270]) {
    const r = await render(imagePage(image(10, 3, "/ImageMask true", bits), { w: 10, h: 3 }), 0, { turn: deg });
    const tr = turn(bitAt, 10, 3, deg), rb = Math.ceil(tr.W / 8), want = new Uint8Array(rb * tr.H);
    for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) if (tr.at(X, Y)) want[Y * rb + (X >> 3)] |= 0x80 >> (X & 7);
    t(`R48 a 1-bit mask, turn ${deg}: every bit on its bit`, [r.width, r.height, r.pixels_sha256, r.turned_deg], [tr.W, tr.H, hex(want), deg]);
  }
  /* a DCT page: the pass-through cannot be turned, so a turn decodes it */
  const dctPg = imagePage(image(63, 47, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", jpeg("rgb-420-h2v2")), { w: 63, h: 47 });
  const dt = await render(dctPg, 0, { turn: 90 });
  t("R48 a DCT page with turn 90 is decoded and turned: Pillow's own turn of the same JPEG",
    [dt.route, dt.upright, dt.width, dt.height, dt.turned_deg, dt.pixels_sha256], ["decoded-dct", true, 47, 63, 90, VARIANTS.find((v) => v.name === "rgb-420-rotate90").pillow_sha256]);
  const d0 = await render(dctPg, 0, { turn: 0 });
  t("R48 (control) turn 0 leaves the pass-through as it was", [d0.route, d0.upright, d0.turned_deg], ["passthrough-dct", true, 0]);
  const sc = await render(SCAN, 0, { turn: 180 });
  t("R48 the CCITT scan (/Rotate 270) with turn 180 is 90 in all: width and height follow", [sc.ok, sc.width, sc.height, sc.rotate_deg, sc.turned_deg], [true, 2550, 3300, 270, 180]);

  /* a picture: after the EXIF orientation, a PNG too */
  const PV = JSON.parse(Buffer.from(F("fixtures/picture-variants.json")).toString("utf8"));
  const pic = (name) => new Uint8Array(Buffer.from(PV.variants.find((v) => v.name === name).b64, "base64"));
  const samplesOf = (r) => { const p = readPng(r.bytes); return { w: p.width, h: p.height, s: p.samples, c: p.colorType === 2 ? 3 : 1 }; };
  const check = async (name, comps) => {
    const base = await renderPictureToPixels(pic(name), 0, { maxEdge: 4096, grey: true });
    const b = samplesOf(base);
    for (const deg of [90, 180, 270]) {
      const r = await renderPictureToPixels(pic(name), 0, { maxEdge: 4096, grey: true, turn: deg });
      answers.push(r);
      const tr = turn((x, y) => b.s[y * b.w + x], b.w, b.h, deg), g = samplesOf(r), want = new Uint8Array(tr.W * tr.H);
      for (let Y = 0; Y < tr.H; Y++) for (let X = 0; X < tr.W; X++) want[Y * tr.W + X] = tr.at(X, Y);
      t(`R48 ${name} (EXIF ${base.orientation}), turn ${deg}: the oriented picture turned exactly`,
        [r.ok, g.w, g.h, hex(g.s), r.turned_deg, r.orientation, r.upright], [true, tr.W, tr.H, hex(want), deg, base.orientation, true]);
    }
  };
  for (let o = 1; o <= 8; o++) await check(`orient-${o}`);
  await check("png-rgb");
  const p0 = await renderPictureToPixels(pic("orient-6"), 0, { maxEdge: 4096, grey: true });
  t("R48 a picture with no turn states turned_deg 0", p0.turned_deg, 0);
  for (const bad of [45, "90", null, 360])
    t(`R48 a picture's turn of ${JSON.stringify(bad)} is ignored`, (await renderPictureToPixels(pic("orient-6"), 0, { maxEdge: 4096, grey: true, turn: bad })).pixels_sha256, p0.pixels_sha256);
}

console.log("\n--- R47: a page is rendered from the page's own bytes ---");
{
  const sourceOf = (bytes) => { const log = { reads: 0, bytes: 0 }; return { log, size: bytes.length, readRange: async (o, n) => { log.reads++; const out = bytes.slice(o, o + n); log.bytes += out.length; return out; } }; };
  const same = (a, b) => JSON.stringify({ ...a, bytes: a.bytes ? hex(a.bytes) : null }) === JSON.stringify({ ...b, bytes: b.bytes ? hex(b.bytes) : null });
  const enc = onePage({ ops: "q 8 0 0 8 0 0 cm /Im Do Q", res: "/XObject << /Im 5 0 R >>", more: [GREY_IMG, "<< /Filter /Standard /V 1 /R 2 /O (owner) /U (user) /P -4 >>"], trailer: "/Encrypt 6 0 R" });
  for (const [label, bytes, page, opts] of [
    ["the CCITT scan", SCAN, 0, {}], ["the DCT scan decoded", DCT_SCAN, 0, { decodeDct: true }],
    ["a small page", imagePage(GREY_IMG, { w: 3, h: 2 }), 0, {}], ["a page past the end", imagePage(GREY_IMG, { w: 3, h: 2 }), 5, {}],
    ["an encrypted file", enc, 0, {}], ["bytes that are no PDF", new Uint8Array(64).fill(7), 0, {}],
  ]) {
    const a = await render(bytes, page, opts), b = await render(sourceOf(bytes), page, opts);
    t(`R47 ${label}: the source answers what the bytes answer`, same(a, b), true);
  }
  /* a many-page scan: one page costs about that page, not the file (needs pdf-reader's pageSource) */
  const file = generatePdf({ kind: "pdf", seed: "r47", size: { pages: 24, lines: 4 }, kinds: ["scan"], scan: { dpi: 150, bits: 1 }, structure: "classic" });
  const whole = await file.bytes();
  for (const [page, label] of [[19, "page 20"], [0, "page 1"], [23, "the last page"]]) {
    const src = sourceOf(whole);
    const a = await render(whole, page, { decodeDct: true }), b = await render(src, page, { decodeDct: true });
    t(`R47 ${label} of 24, through pdf-reader's pageSource: the same answer as the whole file's`, same(a, b), true);
    t(`R47 ${label}: the bytes read are the page's, under a quarter of the ${whole.length}-byte file (read ${src.log.bytes})`, src.log.bytes < whole.length / 4, true);
  }
  const pv = JSON.parse(Buffer.from(F("fixtures/picture-variants.json")).toString("utf8")).variants.find((v) => v.name === "orient-6");
  const picBytes = new Uint8Array(Buffer.from(pv.b64, "base64"));
  t("R47 a picture given as a source answers what its bytes answer",
    same(await renderPictureToPixels(sourceOf(picBytes), 0, { maxEdge: 64, grey: true }), await renderPictureToPixels(picBytes, 0, { maxEdge: 64, grey: true })), true);
}

console.log("\n--- R49: no ceiling of the module's own ---");
{
  const src = (f) => readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), "utf8");
  const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  /* the figures READ_BOUNDS holds for the rows this module quotes, as literals in any spelling */
  const figures = ["image.pixels", "image.edge", "image.picture_frame", "image.picture_source"].map((k) => boundOf(...k.split(".")));
  const spellings = (n) => [String(n), n.toLocaleString("en-US"), n.toString(16), `0x${n.toString(16)}`];
  const seen = (f, n) => spellings(n).some((x) => new RegExp(`(^|[^0-9A-Za-z_.])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^0-9A-Za-z_.]|$)`).test(code(f)));
  const MINE = ["imagecrop.mjs", "pagepixels-worker.mjs", "pagepixels.mjs", "picturepixels.mjs"];
  t("R49 no figure READ_BOUNDS holds for these rows is written as a literal in the module's code",
    MINE.flatMap((f) => figures.filter((n) => seen(f, n)).map((n) => `${f}:${n}`)), []);
  t("R49 no product of literals spells a frame bound (4096 * 3072 * 3, 16384 * 12288 * 3)",
    MINE.filter((f) => /\b4096\s*\*\s*3072|\b16384\s*\*\s*12288/.test(code(f))), []);
  t("R49 the /Parent walk's depth is the table's too: no literal bound on the loop", MINE.filter((f) => /d\s*<=?\s*\d+\s*;/.test(code(f))), []);
  t("R49 (the check sees a literal where one is written)", seen("pagepixels.mjs", 1728) && !seen("pagepixels.mjs", 120000000), true);
  t("R49 the exported frame bounds are the table's", [PICTURE_FRAME_MAX, PICTURE_SOURCE_MAX], [boundOf("image", "picture_frame"), boundOf("image", "picture_source")]);
  t("R49 the quoted rows are the figures the requirements name", [boundOf("image", "pixels"), boundOf("image", "edge")], [120000000, 65535]);
}

console.log("\n--- R41: no place named ---");
{
  /* The same list pdf-worker's R38 test uses. Comments are removed from the code
     first: only a comment may cite where a measurement was taken (layers.md, rule 6). */
  const PLACES = /\b(Oakland|Alameda|California|Berkeley|Legistar)\b/i;
  const texts = [...Object.values(REFUSALS), ...Object.values(CROP_REFUSALS)];
  t("R41 no refusal text names a place", texts.filter((s) => PLACES.test(s)), []);
  const told = answers.map((r) => JSON.stringify({ ...r, bytes: undefined })).filter((s) => PLACES.test(s));
  t(`R41 no answer given in this file names a place (${answers.length} answers)`, told, []);
  const src = (f) => readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), "utf8");
  const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const MINE = ["imagecrop.mjs", "pagepixels-worker.mjs", "pagepixels.mjs", "picturepixels.mjs"];
  t("R41 (the module's files are all there)", MINE.every((f) => readdirSync(fileURLToPath(new URL("../src", import.meta.url))).includes(f)), true);
  t("R41 no place is named in the module's code", MINE.filter((f) => PLACES.test(code(f))), []);
  /* The control: the same reading does see a place where one is written. */
  t("R41 (the check sees a place in code)", PLACES.test(code("pagepixels.mjs") + "const x = 'Berkeley';"), true);
}

console.log("\n--- R39: every refusal is declared, in its own words ---");
{
  const refusals = answers.filter((r) => r && r.ok === false);
  console.log(`  (${refusals.length} refusals over ${new Set(refusals.map((r) => r.reason)).size} reasons)`);
  t("R39 (the refusals checked span most of the declared set)", new Set(refusals.map((r) => r.reason)).size >= 13, true);
  t("R39 every reason is a key of REFUSALS", refusals.filter((r) => !(r.reason in REFUSALS)).map((r) => r.reason), []);
  t("R39 every why is exactly that key's text", refusals.filter((r) => r.why !== REFUSALS[r.reason]).map((r) => r.reason), []);
  t("R39 no refusal carries bytes", refusals.filter((r) => "bytes" in r).length, 0);
  /* words (setup-words R14, K874): every sentence this module refuses with or notes is read through a word id. */
  const WORD_IDS = [
    "pdf-pixels.pagepixels.the_document_is_encrypted_streams",
    "pdf-pixels.pagepixels.the_page_index_is_outside",
    "pdf-pixels.pagepixels.the_page_object_could_not",
    "pdf-pixels.pagepixels.the_page_carries_a_text",
    "pdf-pixels.pagepixels.the_page_carries_marks_that",
    "pdf-pixels.pagepixels.the_page_paints_no_image",
    "pdf-pixels.pagepixels.the_page_composes_several_images",
    "pdf-pixels.pagepixels.the_image_xobject_s_stream",
    "pdf-pixels.pagepixels.the_image_s_filter_chain",
    "pdf-pixels.pagepixels.the_image_s_sample_layout",
    "pdf-pixels.pagepixels.the_decoded_image_is_short",
    "pdf-pixels.pagepixels.the_decoder_could_not_read",
    "pdf-pixels.pagepixels.decoding_the_image_would_need",
    "pdf-pixels.pagepixels.an_inline_image_reading_inline",
    "pdf-pixels.pagepixels.the_jbig2globals_stream_could_not",
    "pdf-pixels.pagepixels.a_jbig2_image_is_1",
    "pdf-pixels.pagepixels.a_colour_space_other_than",
    "pdf-pixels.pagepixels.this_reader_cannot_give_the",
  ];
  t("words R14 every id is a dotted pdf-pixels.pagepixels word id, named once", WORD_IDS.filter((id) => !/^pdf-pixels\.pagepixels\.[a-z0-9_]+$/.test(id)).concat(WORD_IDS.length - new Set(WORD_IDS).size ? ["duplicate"] : []), []);
}

finish();
