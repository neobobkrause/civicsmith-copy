/* pdf-reader: requirement-named tests for each page's box and the per-image
 * unread marker (build/requirements/pdf-reader.md R33, R34; N100's and N101's
 * producer halves, D-374 and D-665), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { build, doc } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PageBox, PageBoxes, Marker } from "../../../src/pdfstructure.mjs" */
/** @import { StreamBody } from "./pdf.mjs" */

/** @type {StreamBody} */
const IMG = { dict: "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", data: "\x80" };
/** Entry `i` of a list; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[]} xs
 *  @param {number} i
 *  @param {string} what
 *  @returns {T} */
const nth = (xs, i, what) => {
  const x = xs[i];
  if (x === undefined) throw new Error(`${what}[${i}] is missing`);
  return x;
};
/** A value that must be there; a thrown failure naming `what` when it is null.
 *  @template T
 *  @param {T | null} x
 *  @param {string} what
 *  @returns {T} */
const must = (x, what) => {
  if (x === null) throw new Error(`${what} is null`);
  return x;
};
/** The reading of a PDF; a thrown failure when it is refused.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
const read = (r) => {
  if (!r.ok) throw new Error(`the PDF was refused: ${r.reason}`);
  return r;
};
/** The page box R33 states for `media_box` and `rotate`.
 *  @param {number[]} media_box
 *  @param {number | null} [rotate]
 *  @returns {PageBox} */
const box = (media_box, rotate = 0) => ({ media_box, w: nth(media_box, 2, "media_box") - nth(media_box, 0, "media_box"),
  h: nth(media_box, 3, "media_box") - nth(media_box, 1, "media_box"), rotate });

test("R33: pageBoxes gives each page's MediaBox, each distinct box once, indexed by page", async () => {
  const r = read(await extractPdfStructure(doc([
    { content: "" },
    { content: "", box: "/MediaBox [0 0 612 792]" },
    { content: "" },
    { content: "", box: "/MediaBox [-9 -9 621 801]" },
    { content: "", box: "/MediaBox [600 800 0 0]" },
    { content: "", box: "/MediaBox [0 0 600 800] /CropBox [10 10 300 400]" },
  ])));
  const boxes = r.pageBoxes;
  assert.deepEqual(boxes, {
    boxes: [box([0, 0, 600, 800]), box([0, 0, 612, 792]), box([-9, -9, 621, 801])],
    of_page: [0, 1, 0, 2, 0, 0],
  });
  assert.deepEqual(Object.keys(nth(boxes.boxes, 0, "boxes")).sort(), ["h", "media_box", "rotate", "w"]);
});

test("R33: MediaBox and /Rotate are inherited; rotate is normalised to 0/90/180/270, 0 when absent, null otherwise", async () => {
  const r = read(await extractPdfStructure(doc([
    { content: "", box: "" },
    { content: "", box: "/Rotate 90" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate -90" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate 450" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate 45" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate /Ninety" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate 0" },
    { content: "", box: "/MediaBox [0 0 100 200] /Rotate 99 0 R" },
  ], { pagesExtra: "/MediaBox [0 0 500 700] /Rotate 180" })));
  /** @type {PageBoxes} */
  const boxes = must(r.pageBoxes, "pageBoxes");
  /** Page `i`'s box, or null where it has none.
   *  @param {number} i
   *  @returns {PageBox | null} */
  const at = (i) => {
    const k = nth(boxes.of_page, i, "of_page");
    return k === null ? null : nth(boxes.boxes, k, "boxes");
  };
  assert.deepEqual(at(0), box([0, 0, 500, 700], 180));
  assert.deepEqual(at(1), box([0, 0, 500, 700], 90));
  assert.deepEqual(at(2), box([0, 0, 100, 200], 270));
  assert.deepEqual(at(3), box([0, 0, 100, 200], 90));
  assert.deepEqual(at(4), box([0, 0, 100, 200], null));
  assert.deepEqual(at(5), box([0, 0, 100, 200], null));
  assert.deepEqual(at(6), box([0, 0, 100, 200], 0));
  assert.deepEqual(at(7), box([0, 0, 100, 200], 0)); // a dangling reference is null, and a null /Rotate is absent
  const none = read(await extractPdfStructure(doc([{ content: "", box: "" }])));
  assert.deepEqual(none.pageBoxes, { boxes: [], of_page: [null] });
});

test("R33: an unreadable box is null for its page, never a default; the nearest definition decides; null only with no pages", async () => {
  const r = read(await extractPdfStructure(doc([
    { content: "", box: "/MediaBox [0 0 600]" },
    { content: "", box: "/MediaBox [0 0 0 800]" },
    { content: "", box: "/MediaBox [0 0 600 800 1]" },
    { content: "", box: "/MediaBox [0 0 (600) 800]" },
    { content: "", box: "/MediaBox 99 0 R" },
    { content: "", box: "/MediaBox [0 0 600 0]" },
    { content: "", box: "/MediaBox [0 0 600 800]" },
  ], { pagesExtra: "/MediaBox [0 0 300 400]" })));
  assert.deepEqual(r.pageBoxes, { boxes: [box([0, 0, 600, 800])], of_page: [null, null, null, null, null, null, 0] });
  const empty = read(await extractPdfStructure(build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] >>" })));
  assert.equal(empty.pageBoxes, null);
  // an encrypted document's boxes are numbers, never encrypted: they are read
  const enc = read(await extractPdfStructure(doc([{ content: "" }], { objs: { 90: "<< /Filter /Standard /V 1 /R 2 /O (o) /U (u) /P -4 >>" } })));
  assert.deepEqual(enc.pageBoxes, { boxes: [box([0, 0, 600, 800])], of_page: [0] });
});

test("R34: every painted image covering at least 0.001 of its visible page box says its content is unread", async () => {
  const res = "/Font << /F1 10 0 R >> /XObject << /I 20 0 R >>";
  const words = `BT /F1 10 Tf (${"word ".repeat(10)}) Tj ET`;
  const r = read(await extractPdfStructure(doc([
    // 0: a full page, a bullet under the floor, one exactly at it (24x20 of 600x800), one half off the page
    { content: `q 600 0 0 800 0 0 cm /I Do Q q 5 0 0 5 1 1 cm /I Do Q q 24 0 0 20 0 0 cm /I Do Q q 100 0 0 100 -50 0 cm /I Do Q ${words}`, resources: res },
    // 1: the visible box is the CropBox inside the MediaBox
    { content: `q 150 0 0 200 0 0 cm /I Do Q ${words}`, resources: res, box: "/MediaBox [0 0 600 800] /CropBox [0 0 300 400]" },
    // 2: no readable box: the image is still marked, its share null
    { content: `q 1 0 0 1 0 0 cm /I Do Q ${words}`, resources: res, box: "" },
    // 3: an image-only page: no_text_layer and the image's marker
    { content: "q 600 0 0 800 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" },
    // 4: a folio over an image: R26's marker first, then R34's
    { content: "q 600 0 0 400 0 0 cm /I Do Q BT /F1 10 Tf (1) Tj ET", resources: res },
    // 5: no image
    { content: words },
  ], { objs: { 20: IMG } })));
  /** R34's marker for an image of page `page` at `rect`.
   *  @param {number} page
   *  @param {number[]} rect
   *  @param {number | null} area_share
   *  @returns {Marker} */
  const mk = (page, rect, area_share) => ({ page, reason: "image_unread", font: null, codes: "", count: 0, rect, area_share });
  /** Page `i`'s image_unread markers.
   *  @param {number} i
   *  @returns {Marker[]} */
  const unread = (i) => nth(r.text.pages, i, "pages").undetermined.filter((m) => m.reason === "image_unread");
  assert.deepEqual(unread(0), [mk(0, [0, 0, 600, 800], 1), mk(0, [0, 0, 24, 20], 0.001), mk(0, [-50, 0, 50, 100], 0.0104)]);
  assert.deepEqual(unread(1), [mk(1, [0, 0, 150, 200], 0.25)]);
  assert.deepEqual(unread(2), [mk(2, [0, 0, 1, 1], null)]);
  assert.deepEqual(nth(r.text.pages, 3, "pages").undetermined.map((m) => m.reason), ["no_text_layer", "image_unread"]);
  assert.deepEqual(nth(r.text.pages, 4, "pages").undetermined.map((m) => m.reason), ["image_content_unread", "image_unread"]);
  assert.deepEqual(nth(r.text.pages, 5, "pages").undetermined, []);
  // each marker's rect IS its placement's rect, the same image {page, rect} reference
  for (const m of r.text.undetermined.filter((x) => x.reason === "image_unread")) {
    assert.ok(must(r.images, "images").some((im) => im.page === m.page && JSON.stringify(im.rect) === JSON.stringify(m.rect)));
  }
  assert.deepEqual(r.text.undetermined, r.text.pages.flatMap((p) => p.undetermined));
  assert.equal(r.text.counts.undetermined, r.text.undetermined.length);
  assert.equal(r.text.counts.chars, r.text.document.length);
});

test("R34: with images null (a page not walked, or encryption) no image_unread marker is added", async () => {
  const n = read(await extractPdfStructure(doc([
    { content: "q 600 0 0 800 0 0 cm /I Do Q BT /F1 10 Tf (x) Tj ET", resources: "/Font << /F1 10 0 R >> /XObject << /I 20 0 R >>" },
    { content: "/Gone Do" }], { objs: { 20: IMG } })));
  assert.equal(n.images, null);
  assert.ok(!n.text.undetermined.some((m) => m.reason === "image_unread"));
  const enc = read(await extractPdfStructure(doc([{ content: "q 600 0 0 800 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" }],
    { objs: { 20: IMG, 90: "<< /Filter /Standard /V 1 /R 2 /O (o) /U (u) /P -4 >>" } })));
  assert.deepEqual(enc.text.undetermined.map((m) => m.reason), ["encrypted"]);
});
