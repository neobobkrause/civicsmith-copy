/* cropImage: R27–R34 of build/requirements/pdf-pixels.md, and R39 for its
 * refusals. Expected samples are known by construction and every PNG is read
 * back with node's own zlib, never the subject's encoder. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cropImage, CROP_REFUSALS } from "../src/imagecrop.mjs";
import { REFUSALS } from "../src/pagepixels.mjs";
import { onePage, image, readPng, hex, runner } from "./make-pdf.mjs";

const { t, finish } = runner("imagecrop");
const answers = [];
const crop = async (...a) => { const r = await cropImage(...a); answers.push(r); return r; };
const fields = (r, ...k) => k.map((x) => r[x]);

const G = Uint8Array.from({ length: 6 }, (_, i) => (i * 37 + 11) & 0xff);
const GREY = image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", G);
const VARIANTS = JSON.parse(readFileSync(fileURLToPath(new URL("fixtures/dct-variants.json", import.meta.url)), "utf8")).variants;
const JPEG = new Uint8Array(Buffer.from(VARIANTS.find((v) => v.name === "rgb-444").jpeg_b64, "base64"));

/* One page painting /Im by `ops` (default: at [0,0,3,2]). */
const page = ({ ops = "q 3 0 0 2 0 0 cm /Im Do Q", img = GREY, pageExtra = "", res = "/XObject << /Im 5 0 R >>", more = [], trailer = "" } = {}) =>
  onePage({ box: [0, 0, 3, 2], res, ops, pageExtra, more: [img, ...more], trailer });
const DOC = page();
const EXTENT = { kind: "image", page: 0, rect: [0, 0, 3, 2] };

console.log("\n--- R27: the extent ---");
{
  for (const [label, extent] of [
    ["null", null], ["a string", "image"], ["kind text", { ...EXTENT, kind: "text" }], ["kind missing", { page: 0, rect: [0, 0, 3, 2] }],
    ["page 1.5", { ...EXTENT, page: 1.5 }], ["page \"0\"", { ...EXTENT, page: "0" }], ["page missing", { kind: "image", rect: [0, 0, 3, 2] }],
    ["a part given", { ...EXTENT, part: 0 }], ["a part given as a string", { ...EXTENT, part: "a" }],
  ]) {
    const r = await crop(DOC, extent);
    t(`R27 ${label}: NOT_AN_IMAGE_EXTENT`, [r.ok, r.derived, r.reason], [false, true, "NOT_AN_IMAGE_EXTENT"]);
  }
  for (const [label, rect] of [["missing", undefined], ["three numbers", [0, 0, 3]], ["five numbers", [0, 0, 3, 2, 1]],
    ["a NaN", [0, NaN, 3, 2]], ["an Infinity", [0, 0, Infinity, 2]], ["a string", [0, 0, "3", 2]], ["not an array", "0 0 3 2"]]) {
    const r = await crop(DOC, { kind: "image", page: 0, rect });
    t(`R27 rect ${label}: RECT_REQUIRED`, [r.ok, r.derived, r.reason], [false, true, "RECT_REQUIRED"]);
  }
}

console.log("\n--- R28: the document and the page ---");
{
  t("R28 not a PDF: NOT_A_PDF", (await crop(new Uint8Array([1, 2, 3]), EXTENT)).reason, "NOT_A_PDF");
  const enc = page({ more: ["<< /Filter /Standard /V 1 /R 2 /O (o) /U (u) /P -4 >>"], trailer: "/Encrypt 6 0 R" });
  t("R28 encrypted: ENCRYPTED", (await crop(enc, EXTENT)).reason, "ENCRYPTED");
  for (const p of [-1, 1]) {
    const r = await crop(DOC, { ...EXTENT, page: p });
    t(`R28 page ${p} of 1: NO_SUCH_PAGE`, fields(r, "reason", "pageCount"), ["NO_SUCH_PAGE", 1]);
  }
}

console.log("\n--- R29: a page whose paint order cannot be walked ---");
{
  const r = await crop(page({ ops: "q 3 0 0 2 0 0 cm /Missing Do Q" }), EXTENT);
  t("R29 PAGE_UNWALKABLE carrying pdfPageImages's own why", fields(r, "ok", "reason", "detail"),
    [false, "PAGE_UNWALKABLE", "xobject_unresolvable:page 0:Missing"]);
}

console.log("\n--- R30: matching the rect ---");
{
  const miss = await crop(DOC, { ...EXTENT, rect: [0, 0, 3, 1] });
  t("R30 no image at the rect: NO_IMAGE_AT_RECT with every painted rect", fields(miss, "reason", "rect", "painted"),
    ["NO_IMAGE_AT_RECT", [0, 0, 3, 1], [[0, 0, 3, 2]]]);
  t("R30 within 0.001 pt matches", (await crop(DOC, { ...EXTENT, rect: [0.0009, -0.0009, 3.001, 2] })).ok, true);
  t("R30 beyond 0.001 pt does not", (await crop(DOC, { ...EXTENT, rect: [0.0015, 0, 3, 2] })).reason, "NO_IMAGE_AT_RECT");
  const rev = await crop(DOC, { ...EXTENT, rect: [3, 2, 0, 0] });
  t("R30 a reversed rect is normalised", [rev.ok, rev.of?.rect], [true, [0, 0, 3, 2]]);
  const two = await crop(page({ ops: "q 3 0 0 2 0 0 cm /Im Do /Im Do Q" }), EXTENT);
  t("R30 two images at the rect: AMBIGUOUS_RECT with the count", fields(two, "reason", "count"), ["AMBIGUOUS_RECT", 2]);
  const inline = await crop(page({ ops: "q 3 0 0 2 0 0 cm BI /W 3 /H 2 /CS /G /BPC 8 ID abcdef EI Q" }), EXTENT);
  t("R30 an inline image at the rect: INLINE_IMAGE", [inline.ok, inline.reason], [false, "INLINE_IMAGE"]);
}

console.log("\n--- R31: decoding, rotation forced to 0 ---");
{
  const jpx = await crop(page({ img: image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /LZWDecode", new Uint8Array(6)) }), EXTENT);
  t("R31 a decode refusal: DECODE_REFUSED naming the decoder's reason and why", fields(jpx, "ok", "reason", "decoder", "decoderWhy"),
    [false, "DECODE_REFUSED", "UNSUPPORTED_FILTER", REFUSALS.UNSUPPORTED_FILTER]);
  const short = await crop(page({ img: image(3, 2, "/ColorSpace /DeviceGray /BitsPerComponent 8", new Uint8Array(2)) }), EXTENT);
  t("R31 truncated samples: DECODE_REFUSED, TRUNCATED_IMAGE_DATA", fields(short, "reason", "decoder"), ["DECODE_REFUSED", "TRUNCATED_IMAGE_DATA"]);
  for (const deg of [90, 270]) {
    const r = await crop(page({ pageExtra: `/Rotate ${deg}` }), EXTENT);
    const png = readPng(r.bytes);
    t(`R31 under a page /Rotate ${deg} the crop is not turned`, [r.width, r.height, png.width, png.height, hex(png.samples)], [3, 2, 3, 2, hex(G)]);
  }
}

console.log("\n--- R32: the derived rendition ---");
{
  const r = await crop(DOC, EXTENT);
  t("R32 the success shape", Object.keys(r).sort(), ["bytes", "capture_sha256", "derived", "file_sha256", "height", "mediaType", "of", "ok",
    "pixels_sha256", "placement", "rendition", "route", "upright", "why", "width"]);
  t("R32 derived, a crop, of the extent", [r.ok, r.derived, r.rendition, r.of], [true, true, "crop", { kind: "image", page: 0, rect: [0, 0, 3, 2] }]);
  t("R32 why is stated", typeof r.why === "string" && r.why.length > 20, true);
  t("R32 placement", r.placement, { name: "Im", axis_aligned: true, filters: [] });
  const png = readPng(r.bytes);
  t("R32 the image's own samples", [r.route, r.mediaType, r.width, r.height, hex(png.samples)], ["raw-samples-grey8", "image/png", 3, 2, hex(G)]);
  t("R32 capture_sha256 is the whole capture's digest", r.capture_sha256, hex(DOC));
  t("R32 file_sha256 is the returned bytes' digest", r.file_sha256, hex(r.bytes));
  t("R32 pixels_sha256 on a decoded route", r.pixels_sha256, hex(G));
  const dct = page({ img: image(63, 47, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", JPEG), ops: "q 3 0 0 2 0 0 cm /Im Do Q" });
  const d = await crop(dct, EXTENT);
  t("R32 a DCT image: the publisher's bytes, no pixels_sha256",
    [d.route, d.mediaType, hex(d.bytes), d.file_sha256, "pixels_sha256" in d, d.width, d.height, d.capture_sha256],
    ["passthrough-dct", "image/jpeg", hex(JPEG), hex(JPEG), false, 63, 47, hex(dct)]);
}

console.log("\n--- R33: upright only for a plain positive scale ---");
{
  for (const [label, ops, want] of [
    ["a plain scale-and-translate", "q 3 0 0 2 0 0 cm /Im Do Q", true],
    ["a y-flip", "q 3 0 0 -2 0 2 cm /Im Do Q", null],
    ["an x-flip", "q -3 0 0 2 3 0 cm /Im Do Q", null],
    ["a quarter turn", "q 0 2 -3 0 3 0 cm /Im Do Q", null],
    ["a skew", "q 3 0 1 2 0 0 cm /Im Do Q", null],
  ]) {
    const r = await crop(page({ ops }), { ...EXTENT, rect: label === "a skew" ? [0, 0, 4, 2] : [0, 0, 3, 2] });
    t(`R33 ${label}: upright ${want}`, [r.ok, r.upright], [true, want]);
  }
  const dct = page({ img: image(63, 47, "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", JPEG), pageExtra: "/Rotate 90" });
  t("R33 the pass-through decoder reports upright at rotation 0, so a plain placement is upright",
    (await crop(dct, EXTENT)).upright, true);
}

console.log("\n--- R34: nothing composited, no placement transform applied ---");
{
  const over = await crop(page({ ops: "q 3 0 0 2 0 0 cm /Im Do Q 0 0 0 rg 0 0 3 2 re f" }), EXTENT);
  t("R34 a fill drawn over the image is not in the crop", hex(readPng(over.bytes).samples), hex(G));
  const clipped = await crop(page({ ops: "q 0 0 1 1 re W n 3 0 0 2 0 0 cm /Im Do Q" }), EXTENT);
  t("R34 a clip is not applied", [clipped.width, clipped.height, hex(readPng(clipped.bytes).samples)], [3, 2, hex(G)]);
  const flipped = await crop(page({ ops: "q 3 0 0 -2 0 2 cm /Im Do Q" }), EXTENT);
  t("R34 a flipped placement: the samples as stored", hex(readPng(flipped.bytes).samples), hex(G));
  const turned = await crop(page({ ops: "q 0 2 -3 0 3 0 cm /Im Do Q" }), EXTENT);
  t("R34 a turned placement: the samples as stored", [turned.width, turned.height, hex(readPng(turned.bytes).samples)], [3, 2, hex(G)]);
}

console.log("\n--- R39: every crop refusal is declared, in its own words ---");
{
  const refusals = answers.filter((r) => r && r.ok === false);
  console.log(`  (${refusals.length} refusals over ${new Set(refusals.map((r) => r.reason)).size} reasons)`);
  t("R39 (every declared crop reason was driven)", [...new Set(refusals.map((r) => r.reason))].sort(), Object.keys(CROP_REFUSALS).sort());
  t("R39 every reason is a key of CROP_REFUSALS", refusals.filter((r) => !(r.reason in CROP_REFUSALS)).map((r) => r.reason), []);
  t("R39 every why is exactly that key's text", refusals.filter((r) => r.why !== CROP_REFUSALS[r.reason]).map((r) => r.reason), []);
  /* words (setup-words R14, K874): every crop refusal sentence is read through a word id. */
  const WORD_IDS = [
    "pdf-pixels.imagecrop.the_extent_names_a_page",
    "pdf-pixels.imagecrop.the_document_is_encrypted_streams",
    "pdf-pixels.imagecrop.the_page_index_is_outside",
    "pdf-pixels.imagecrop.the_page_s_content_could",
    "pdf-pixels.imagecrop.the_page_paints_no_image",
    "pdf-pixels.imagecrop.the_page_paints_more_than",
    "pdf-pixels.imagecrop.the_image_at_that_rectangle",
    "pdf-pixels.imagecrop.the_image_was_found_and",
  ];
  t("words R14 every id is a dotted pdf-pixels.imagecrop word id, named once", WORD_IDS.filter((id) => !/^pdf-pixels\.imagecrop\.[a-z0-9_]+$/.test(id)).concat(WORD_IDS.length - new Set(WORD_IDS).size ? ["duplicate"] : []), []);
  t("R39 every refusal says it is derived, and carries no bytes", refusals.filter((r) => r.derived !== true || "bytes" in r).length, 0);
}

finish();
