/* pdf-reader: requirement-named tests for each link's anchor text
 * (build/requirements/pdf-reader.md R35; N101's REC-206 half), at the module's
 * interface. Glyphs of F1 are 0.5 em wide, so at 10 pt each advances 5 pt and
 * its ink point sits mid-advance, 3.5 pt above the baseline. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { doc } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, LinkAnchor, LinkRecord } from "../../../src/pdfstructure.mjs" */
/** @import { DocOptions, Objects, Page } from "./pdf.mjs" */

/** What a test gives `anchors` beside the content and the rects.
 *  @typedef {Object} AnchorsOptions
 *  @property {string} [resources] the page's /Resources entries, absent is the fonts
 *  @property {Objects} [objs] objects added
 *  @property {Objects} [extraObjs] more objects added
 *  @property {DocOptions} [docOpts] more document options
 */

const URI = "/A << /S /URI /URI (https://example.org/) >>";
/** The reading of a PDF; a thrown failure when it is refused.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
const read = (r) => {
  if (!r.ok) throw new Error(`the PDF was refused: ${r.reason}`);
  return r;
};
/** The anchors of links laid over one page showing `content`.
 *  @param {string} content
 *  @param {(number[] | null)[]} rects
 *  @param {AnchorsOptions} [options]
 *  @returns {Promise<(LinkAnchor | undefined)[]>} */
async function anchors(content, rects, { resources, objs = {}, extraObjs = {}, docOpts = {} } = {}) {
  /** @type {Objects} */
  const all = { ...objs, ...extraObjs };
  rects.forEach((r, i) => { all[30 + i] = `<< /Type /Annot /Subtype /Link ${r === null ? "" : `/Rect [${r.join(" ")}]`} ${URI} >>`; });
  const refs = rects.map((_, i) => `${30 + i} 0 R`).join(" ");
  /** @type {Page} */
  const page = { content, extra: `/Annots [${refs}]` };
  if (resources !== undefined) page.resources = resources;
  /** @type {DocOptions} */
  const options = { objs: all, ...docOpts };
  const r = read(await extractPdfStructure(doc([page], options)));
  return r.links.map((/** @type {LinkRecord} */ l) => l.anchor);
}
/** An anchor as tier 1 states it.
 *  @param {string | null} text
 *  @param {string | null} [why]
 *  @returns {LinkAnchor} */
const a = (text, why = null) => ({ text, why, tier: 1 });
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

test("R35: an anchor is the text whose ink point lies in the link's rect, in showing order, one space between runs", async () => {
  const content = "BT /F1 10 Tf 100 700 Td (Read the) Tj 0 -20 Td (full report) Tj 0 -20 Td (elsewhere) Tj ET";
  // "Read the" spans x 100-140 at y 700; "full report" x 100-155 at y 680
  const got = await anchors(content, [
    [95, 675, 160, 715],   // both lines
    [95, 695, 121, 715],   // "Read" only: the space glyph's ink point (x 122.5) is outside
    [118, 678, 142, 692],  // "report" crossing nothing else: x 125-155 ink points 127.5.. → "rep" partly
    [0, 0, 50, 50],        // nothing there, every glyph placed
    [140, 710, 95, 675],   // corners given in reverse order: "rep" ink points are at x 127.5-137.5
  ]);
  assert.deepEqual(got[0], a("Read the full report"));
  assert.deepEqual(got[1], a("Read"));
  assert.deepEqual(got[2], a("rep"));
  assert.deepEqual(got[3], a(null, "no_text_in_rect"));
  assert.deepEqual(got[4], a("Read the full rep"));
  // showing order, not position: a run painted after, to the left, comes after
  const order = await anchors("BT /F1 10 Tf 100 700 Td (B) Tj -90 0 Td (A) Tj ET", [[0, 690, 200, 720]]);
  assert.deepEqual(order[0], a("B A"));
});

test("R35: text in a Form XObject and under a cm is placed in default user space", async () => {
  const objs = { 20: { dict: "/Type /XObject /Subtype /Form /BBox [0 0 600 800] /Matrix [1 0 0 1 200 0] /Resources << /Font << /F1 10 0 R >> >>", data: "BT /F1 10 Tf 0 100 Td (form) Tj ET" } };
  const got = await anchors("/Fm Do q 2 0 0 2 0 300 cm BT /F1 10 Tf 0 0 Td (big) Tj ET Q",
    [[195, 95, 225, 115], [0, 300, 40, 320]], { resources: "/Font << /F1 10 0 R >> /XObject << /Fm 20 0 R >>", objs });
  assert.deepEqual(got, [a("form"), a("big")]);
});

test("R35: no rect, or no text read on the page, is stated: no_rect, text_not_read", async () => {
  const got = await anchors("BT /F1 10 Tf 0 0 Td (x) Tj ET", [null, [0, 0, 1]]);
  assert.deepEqual(got, [a(null, "no_rect"), a(null, "no_rect")]);
  // a document-level embedded file has no page rect
  const emb = read(await extractPdfStructure(doc([{ content: "" }], {
    catalog: "/Names << /EmbeddedFiles 54 0 R >>",
    objs: { 52: "<< /Type /Filespec /F (f.txt) /EF << /F 53 0 R >> >>", 53: { data: "plain" }, 54: "<< /Names [(f) 52 0 R] >>" } })));
  assert.deepEqual(nth(emb.links, 0, "links").anchor, a(null, "no_rect"));
  // an encrypted document's text is not read, its links still are
  const enc = await anchors("BT /F1 10 Tf 0 0 Td (x) Tj ET", [[0, 0, 100, 100]],
    { extraObjs: { 90: "<< /Filter /Standard /V 1 /R 2 /O (o) /U (u) /P -4 >>" } });
  assert.deepEqual(enc, [a(null, "text_not_read")]);
});

test("R35: glyphs the page could not place make the reading incomplete: positions_unknown, partly_unplaced", async () => {
  // F2 has no widths: after its run the pen is unknown until a positioning operator states it
  const content = "BT /F1 10 Tf 100 700 Td (seen) Tj /F2 10 Tf (lost) Tj /F1 10 Tf (gone) Tj ET";
  const got = await anchors(content, [[95, 695, 125, 715], [300, 300, 400, 400]]);
  assert.deepEqual(got, [a("seen", "partly_unplaced"), a(null, "positions_unknown")]);
  // with no font at all the glyphs are unplaced too
  const nofont = await anchors("BT 0 0 Td (x) Tj ET", [[0, 0, 600, 800]]);
  assert.deepEqual(nofont, [a(null, "positions_unknown")]);
});

test("R35: a code under the rect that decodes to nothing makes it undecodable or partly_undecodable", async () => {
  // F1 maps 0x20-0x7E only: <01> is placed (outside /Widths it advances 0, so its ink point is x 110) and unmapped
  const content = "BT /F1 10 Tf 100 700 Td (ok) Tj <01> Tj 0 -100 Td <0101> Tj ET";
  const got = await anchors(content, [[95, 695, 120, 715], [95, 695, 109, 715], [95, 595, 115, 615], [300, 300, 400, 400]]);
  assert.deepEqual(got, [a("ok", "partly_undecodable"), a("ok"), a(null, "undecodable"), a(null, "no_text_in_rect")]);
  // a font with widths and no /ToUnicode: its run is placed and not read
  const objs = { 13: `<< /Type /Font /Subtype /TrueType /BaseFont /Mute /FirstChar 32 /Widths [${Array.from({ length: 95 }, () => 500).join(" ")}] >>` };
  const mute = await anchors("BT /M 10 Tf 100 700 Td (abc) Tj ET", [[95, 695, 120, 715], [0, 0, 10, 10]],
    { resources: "/Font << /M 13 0 R >>", objs });
  assert.deepEqual(mute, [a(null, "undecodable"), a(null, "no_text_in_rect")]);
});
