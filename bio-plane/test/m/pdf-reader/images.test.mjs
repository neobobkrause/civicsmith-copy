/* pdf-reader: requirement-named tests for the image walk, image-only content,
 * and the named services pdf-worker drives (build/requirements/pdf-reader.md
 * R16-R17, R26, R30-R32), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure, pdfPageImages, imagePlacementSource, openPdf } from "../../../src/pdfstructure.mjs";
import { doc, flate, bytesOf } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfDoc, PdfValue, PdfName, PdfMap, PageImages, ImagePlacement, PageText, Marker } from "../../../src/pdfstructure.mjs" */
/** @import { Objects, StreamBody, Page, Text } from "./pdf.mjs" */

/** A value that is there; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined || v === null) throw new Error(`${what}: none`);
  return v;
}
/** The reading of a PDF; a thrown failure when the answer is a refusal.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
function readingOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** A document opened; a thrown failure when the bytes are not a PDF.
 *  @param {PdfDoc | null} d
 *  @returns {PdfDoc} */
const opened = (d) => must(d, "openPdf");
/** A page's images; a thrown failure naming the why when the page could not be walked.
 *  @param {PageImages} got
 *  @returns {ImagePlacement[]} */
function imagesIn(got) {
  if (got.images === null) throw new Error(`no images: ${got.why}`);
  return got.images;
}
/** A name value; a thrown failure naming `what` when `v` is not a name.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfName} */
function nameOf(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "name") throw new Error(`${what}: not a name`);
  return v;
}
/** A page's dict; a thrown failure when there is none.
 *  @param {PdfDoc} d
 *  @param {number} i
 *  @returns {PdfMap} */
const pageDictOf = (d, i) => must(d.pageDict(i), `page ${i}`);

/** @param {string} [filter]
 *  @param {number} [w]
 *  @param {number} [h]
 *  @param {Text} [data]
 *  @returns {StreamBody} */
const img = (filter = "", w = 2, h = 3, data = "\x01\x02") =>
  ({ dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 ${filter}`, data });
/** @param {string} content
 *  @param {string} [res]
 *  @param {string} [extra]
 *  @returns {StreamBody} */
const form = (content, res = "", extra = "") => ({ dict: `/Type /XObject /Subtype /Form /BBox [0 0 600 800] ${res ? `/Resources << ${res} >>` : ""} ${extra}`, data: content });
const PLACEMENT_KEYS = ["axis_aligned", "filters", "height", "inline", "kind", "mime", "name", "page", "rect", "ref", "width"];

/** A document opened and the images of one page.
 *  @typedef {Object} OpenedImages
 *  @property {PdfDoc} d
 *  @property {PageImages} got
 */
/** @param {string} content
 *  @param {string} resources
 *  @param {Objects} [objs]
 *  @param {number} [pageIdx]
 *  @returns {Promise<OpenedImages>} */
async function imagesOf(content, resources, objs = {}, pageIdx = 0) {
  const d = opened(await openPdf(doc([{ content, resources }], { objs })));
  return { d, got: await pdfPageImages(d, pageIdx) };
}

test("R16: every painted image, in painting order, at its composed rectangle, with exactly the IC-1 fields", async () => {
  /** @type {Objects} */
  const objs = {
    20: img("/Filter /DCTDecode"), 21: img("/Filter /JPXDecode", 4, 5), 22: img("/Filter [/FlateDecode /DCTDecode]"),
    23: img("/Filter /FlateDecode", 7, 8, flate("\x00")),
    24: form("50 0 0 50 0 0 cm /Inner Do", "/XObject << /Inner 23 0 R >>", "/Matrix [1 0 0 1 10 20]"),
  };
  const res = "/XObject << /J 20 0 R /P 21 0 R /C 22 0 R /F 24 0 R >>";
  const content = "q 200 0 0 100 50 600 cm /J Do Q q 0 100 -100 0 300 300 cm /P Do Q "
    + "q 0.33333 0 0 0.66666 1 1 cm /C Do Q /F Do q 10 0 0 10 5 5 cm BI /W 1 /H 1 /BPC 8 /CS /G ID Q\x80cm EI Q";
  const { got } = await imagesOf(content, res, objs);
  assert.equal(got.why, null);
  const want = [
    { rect: [50, 600, 250, 700], mime: "image/jpeg", name: "J", inline: false, width: 2, height: 3, filters: ["DCTDecode"], axis_aligned: true },
    { rect: [200, 300, 300, 400], mime: "image/jp2", name: "P", inline: false, width: 4, height: 5, filters: ["JPXDecode"], axis_aligned: false },
    { rect: [1, 1, 1.333, 1.667], mime: "image/jpeg", name: "C", inline: false, width: 2, height: 3, filters: ["FlateDecode", "DCTDecode"], axis_aligned: true },
    { rect: [10, 20, 60, 70], mime: null, name: "Inner", inline: false, width: 7, height: 8, filters: ["FlateDecode"], axis_aligned: true },
    { rect: [5, 5, 15, 15], mime: null, name: null, inline: true, width: null, height: null, filters: [], axis_aligned: true },
  ];
  const images = imagesIn(got);
  assert.equal(images.length, want.length);
  images.forEach((p, i) => {
    assert.deepEqual(Object.keys(p).sort(), PLACEMENT_KEYS);
    assert.deepEqual({ ...p }, { kind: "image", ref: "an image on page 1", page: 0, ...want[i] }, `placement ${i}`);
  });
});

test("R16: extractPdfStructure carries every page's images, concatenated in page order, at the top level", async () => {
  const bytes = doc([
    { content: "q 10 0 0 10 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" },
    { content: "" },
    { content: "q 20 0 0 20 0 0 cm /I Do Q q 5 0 0 5 1 1 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" },
  ], { objs: { 20: img() } });
  const r = readingOf(await extractPdfStructure(bytes));
  assert.deepEqual(must(r.images, "images").map((p) => [p.page, p.ref, p.rect]), [
    [0, "an image on page 1", [0, 0, 10, 10]], [2, "an image on page 3", [0, 0, 20, 20]], [2, "an image on page 3", [1, 1, 6, 6]]]);
  assert.ok(!("imagesWhy" in r));
  assert.ok(!JSON.stringify(r.images).includes("stream"));
});

test("R17: an unwalkable page gives images null with a named why — never a partial list", async () => {
  /** @param {string} content
   *  @param {string} resources
   *  @param {Objects} [objs]
   *  @param {number} [idx]
   *  @returns {Promise<PageImages>} */
  const why = async (content, resources, objs, idx = 0) => (await imagesOf(content, resources, objs, idx)).got;
  assert.deepEqual(await why("", "", {}, 5), { images: null, why: "page_unreadable:5" });
  assert.deepEqual(await why("", "", {}, -1), { images: null, why: "page_unreadable:-1" });
  const d = opened(await openPdf(doc([{ content: { dict: "/Filter /FlateDecode", data: "junk" } }])));
  assert.deepEqual(await pdfPageImages(d, 0), { images: null, why: "content_stream_undecodable:page 0" });
  assert.deepEqual(await why("/I Do /Gone Do", "/XObject << /I 20 0 R >>", { 20: img() }), { images: null, why: "xobject_unresolvable:page 0:Gone" });
  assert.deepEqual(await why("/A Do", "/XObject << /A 20 0 R >>", { 20: form("/A Do", "/XObject << /A 20 0 R >>") }), { images: null, why: "form_nesting_unwalkable:page 0" });
  /** @type {Objects} */
  const deep = {};
  for (let k = 1; k <= 9; k++) deep[19 + k] = form(k < 9 ? "/Fm Do" : "", k < 9 ? `/XObject << /Fm ${20 + k} 0 R >>` : "");
  assert.deepEqual(await why("/Fm Do", "/XObject << /Fm 20 0 R >>", deep), { images: null, why: "form_nesting_unwalkable:page 0" });
  delete deep[28]; deep[27] = form("", "");
  assert.deepEqual(await why("/Fm Do", "/XObject << /Fm 20 0 R >>", deep), { images: [], why: null });
  assert.deepEqual(await why("/F Do", "/XObject << /F 20 0 R >>", { 20: { dict: "/Subtype /Form /Filter /FlateDecode", data: "junk" } }), { images: null, why: "form_stream_undecodable:page 0" });
  const longName = "N".repeat(200);
  const t = await why(`/${longName} Do`, "");
  assert.equal(t.images, null);
  assert.equal(t.why, `xobject_unresolvable:page 0:${longName}`.slice(0, 120));
  // the document: the FIRST unwalkable page's why, and no list at all
  const r = readingOf(await extractPdfStructure(doc([
    { content: "q 1 0 0 1 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" },
    { content: "/X Do" }, { content: "/Y Do" }], { objs: { 20: img() } })));
  assert.equal(r.images, null);
  assert.equal(r.imagesWhy, "xobject_unresolvable:page 1:X");
});

test("R26: a page an image fills while it shows at most a folio carries image_content_unread, naming both figures", async () => {
  /** @param {string} text
   *  @param {string} cm
   *  @param {{ box?: string }} [extra]
   *  @returns {Page} */
  const page = (text, cm, { box } = {}) => {
    /** @type {Page} */
    const p = { content: `q ${cm} cm /I Do Q BT /F1 10 Tf ${text} Tj ET`, resources: "/Font << /F1 10 0 R /N 13 0 R >> /XObject << /I 20 0 R >>" };
    if (box !== undefined) p.box = box;
    return p;
  };
  /** @type {Objects} */
  const objs = { 20: img(), 13: "<< /Type /Font /Subtype /Type1 /BaseFont /NoMap >>" };
  const r = readingOf(await extractPdfStructure(doc([
    page("(123)", "600 0 0 400 0 0"),                                       // 0: share 0.5, 3 glyphs
    page("(1234)", "600 0 0 144 0 0"),                                      // 1: share 0.18, 4 glyphs: both edges
    page("(12345)", "600 0 0 400 0 0"),                                     // 2: 5 glyphs: the gap
    page(`(${"x".repeat(21)})`, "600 0 0 400 0 0"),                         // 3: 21 glyphs: the gap
    page(`(${"x".repeat(22)})`, "600 0 0 400 0 0"),                         // 4: 22 glyphs: text page
    page("(12)", "600 0 0 120 0 0"),                                        // 5: share 0.15: the gap
    page("(1)", "600 0 0 800 0 -400"),                                      // 6: half off the page
    page("(1)", "600 0 0 200 0 0", { box: "/MediaBox [0 0 600 800] /CropBox [0 0 600 400]" }), // 7: cropped
    { content: "q 600 0 0 400 0 0 cm /I Do Q BT /N 10 Tf (abc) Tj ET", resources: "/Font << /N 13 0 R >> /XObject << /I 20 0 R >>" }, // 8: undecoded folio
    page("(1)", "600 0 0 400 0 0", { box: "" }),                            // 9: no page box
    page("(1)", "0 0 0 0 0 0"),                                             // 10: painted, share 0
    page(`(${"x".repeat(22)})`, "600 0 0 400 0 0", { box: "" }),            // 11: no page box, 22 glyphs
  ], { objs })));
  /** @param {number} i
   *  @returns {PageText} */
  const pageAt = (i) => must(r.text.pages[i], `page ${i}`);
  /** @param {number} i
   *  @returns {Marker[]} */
  const m = (i) => pageAt(i).undetermined.filter((x) => x.reason.startsWith("image_content"));
  /** @param {number} page
   *  @param {string} reason
   *  @param {number | null} image_share
   *  @param {number} glyphs
   *  @returns {Marker[]} */
  const mk = (page, reason, image_share, glyphs) => [{ page, reason, font: null, codes: "", count: 0, image_share, glyphs }];
  assert.deepEqual(m(0), mk(0, "image_content_unread", 0.5, 3));
  assert.deepEqual(m(1), mk(1, "image_content_unread", 0.18, 4));
  assert.deepEqual(m(2), mk(2, "image_content_undetermined", 0.5, 5));
  assert.deepEqual(m(3), mk(3, "image_content_undetermined", 0.5, 21));
  assert.deepEqual(m(4), []);
  assert.deepEqual(m(5), mk(5, "image_content_undetermined", 0.15, 2));
  assert.deepEqual(m(6), mk(6, "image_content_unread", 0.5, 1));
  assert.deepEqual(m(7), mk(7, "image_content_unread", 0.5, 1));
  assert.deepEqual(m(8), mk(8, "image_content_unread", 0.5, 3));
  assert.deepEqual(m(9), mk(9, "image_content_undetermined", null, 1));
  assert.deepEqual(m(10), mk(10, "image_content_undetermined", 0, 1));
  assert.deepEqual(m(11), []);
  assert.deepEqual(r.text.undetermined, r.text.pages.flatMap((p) => p.undetermined));
  assert.equal(r.text.counts.undetermined, r.text.undetermined.length);
});

test("R26: overlapping images count once; a no_text_layer page carries neither R26 marker; no images, no marker", async () => {
  const r = readingOf(await extractPdfStructure(doc([
    { content: "q 600 0 0 400 0 0 cm /I Do Q q 600 0 0 400 0 0 cm /I Do Q q 300 0 0 400 0 0 cm /I Do Q BT /F1 10 Tf (7) Tj ET", resources: "/Font << /F1 10 0 R >> /XObject << /I 20 0 R >>" },
    { content: "q 600 0 0 800 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" },
    { content: "BT /F1 10 Tf (7) Tj ET" },
  ], { objs: { 20: img() } })));
  /** @param {number} i
   *  @returns {Marker[]} */
  const r26 = (i) => must(r.text.pages[i], `page ${i}`).undetermined.filter((x) => x.reason !== "image_unread");
  assert.deepEqual(r26(0).map((x) => [x.reason, x.image_share]), [["image_content_unread", 0.5]]);
  assert.deepEqual(r26(1).map((x) => x.reason), ["no_text_layer"]);
  assert.deepEqual(must(r.text.pages[2], "page 2").undetermined, []);
  // images null (a page could not be walked): no share can be measured and nothing is said
  const n = readingOf(await extractPdfStructure(doc([
    { content: "q 600 0 0 800 0 0 cm /I Do Q BT /F1 10 Tf (7) Tj ET", resources: "/Font << /F1 10 0 R >> /XObject << /I 20 0 R >>" },
    { content: "/Gone Do" }], { objs: { 20: img() } })));
  assert.equal(n.images, null);
  assert.ok(!n.text.undetermined.some((x) => x.reason.startsWith("image_content")));
});

test("R30: openPdf returns a fully read PdfDoc, or null for what is not PDF bytes; never throws", async () => {
  for (const v of [undefined, null, "x", [1], new ArrayBuffer(4)]) assert.equal(await openPdf(v), null);
  assert.equal(await openPdf(bytesOf("no signature here")), null);
  assert.equal(await openPdf(new Uint8Array(0)), null);
  assert.equal(await openPdf(bytesOf(" ".repeat(1024) + "%PDF-1.7\n")), null);
  const bytes = doc([{ content: "" }, { content: "" }, { content: "" }]);
  const d = opened(await openPdf(bytes));
  const pageCount = d.pageCount;
  assert.equal(pageCount, 3);
  assert.equal(readingOf(await extractPdfStructure(bytes)).pages, pageCount);
  assert.equal(nameOf(pageDictOf(d, 2).Type, "Type").v, "Page");
  for (let n = 0; n < bytes.length; n += 11) await openPdf(bytes.subarray(0, n)); // never throws
});

test("R31: pageDict is the page's resolved dict in page order, null outside [0, pageCount) or for a non-integer", async () => {
  const d = opened(await openPdf(doc([{ content: "BT (a) Tj ET" }, { content: "", extra: "/Marker /Second" }])));
  assert.equal(nameOf(pageDictOf(d, 1).Marker, "Marker").v, "Second");
  assert.equal(pageDictOf(d, 0).Marker, undefined);
  /** The document, through a view whose `pageDict` is asked with values that are not numbers as well.
   *  @type {{ pageDict(pageIdx: number | string | null | undefined): PdfMap | null }} */
  const asked = d;
  for (const bad of [-1, 2, 1.5, "0", NaN, null, undefined, Infinity]) assert.equal(asked.pageDict(bad), null, String(bad));
  assert.equal(await (await import("../../../src/pdfstructure.mjs")).pageShowsText(d, d.pageDict(0)), true);
});

test("R32: imagePlacementSource gives a placement's stream and a fresh copy of its CTM; anything else is null", async () => {
  const { d, got } = await imagesOf("q 200 0 0 100 50 600 cm /I Do Q q 10 0 0 10 0 0 cm BI /W 1 /H 1 /BPC 8 /CS /G ID \x80 EI Q",
    "/XObject << /I 20 0 R >>", { 20: img("", 2, 1, "\x07\x09") });
  const [xo, inline] = imagesIn(got);
  const s = must(imagePlacementSource(xo), "the source of the first placement");
  assert.deepEqual(Object.keys(s).sort(), ["ctm", "stream"]);
  assert.deepEqual([...must(d.streamRawBytes(s.stream), "raw bytes")], [7, 9]);
  assert.deepEqual([...must(await d.streamDecoded(s.stream), "decoded bytes")], [7, 9]);
  assert.equal(d.resolve(must(s.stream, "stream").dict.Width), 2);
  assert.deepEqual(s.ctm, [200, 0, 0, 100, 50, 600]);
  s.ctm[0] = 0;
  assert.deepEqual(must(imagePlacementSource(xo), "the source again").ctm, [200, 0, 0, 100, 50, 600]);
  assert.deepEqual(imagePlacementSource(inline), { stream: null, ctm: [10, 0, 0, 10, 0, 0] });
  for (const other of [{ ...xo }, JSON.parse(JSON.stringify(xo)), {}, null, undefined, 1, "x", [xo]]) {
    assert.equal(imagePlacementSource(other), null);
  }
});
