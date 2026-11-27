/* pdf-reader: requirement-named tests for the content stream read as bytes (R41: a page's decoded content is lexed from its
 * bytes, never made a string of its own size), at the module's interface: the text each way of writing a shown string, a
 * name, a comment and a split content stream reads as. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure, extractPdfRange } from "../../../src/pdfstructure.mjs";
import { doc } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfRange, PdfRefusal, PageText, Marker } from "../../../src/pdfstructure.mjs" */
/** @import { Page } from "./pdf.mjs" */

/** What a test adds to a page beside its content.
 *  @typedef {Object} PageExtra
 *  @property {string} [contents] a /Contents value that replaces the generated one
 */
/** A page of one content stream, or of none when `content` is null.
 *  @param {string | null} content
 *  @param {PageExtra} [extra]
 *  @returns {Page} */
const page = (content, extra = {}) => {
  /** @type {Page} */
  const p = {};
  if (content !== null) p.content = content;
  const contents = extra.contents;
  if (contents !== undefined) p.contents = contents;
  return p;
};
/** The reading of a PDF; a thrown failure when it is refused.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
const read = (r) => {
  if (!r.ok) throw new Error(`the PDF was refused: ${r.reason}`);
  return r;
};
/** A range's reading; a thrown failure when it is refused.
 *  @param {PdfRange | PdfRefusal} r
 *  @returns {PdfRange} */
const ranged = (r) => {
  if (!r.ok) throw new Error(`the range was refused: ${r.reason}`);
  return r;
};
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
/** Each page's text, in order.
 *  @param {Page[]} pages
 *  @returns {Promise<string[]>} */
const textOf = async (pages) => read(await extractPdfStructure(doc(pages))).text.pages.map((/** @type {PageText} */ p) => p.text);

test("R41: every way of writing a shown string reads as its bytes: escapes, octal, nested parentheses, line continuation, hex with an odd digit", async () => {
  const got = await textOf([
    page("BT /F1 12 Tf 10 700 Td (a\\(b\\)c \\101\\102\\x) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td (nested (inner (deep)) ok) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td (one\\\ntwo) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td <48656c6C6F> Tj <4> Tj < 5 5 4 4 > Tj ET"),
    page("BT /F1 12 Tf 10 700 Td (back\\\\slash \\060\\0600) Tj ET"),
  ]);
  assert.deepEqual(got, ["a(b)c ABx", "nested (inner (deep)) ok", "onetwo", "Hello@UD", "back\\slash 0000".replace("0000", "000")]);
});

test("R41: names with #xx escapes, comments, array operands, the quote operators and operands of every sign read as the string lexer read them", async () => {
  const got = await textOf([
    page("BT /F#31 12 Tf 10 700 Td (via escaped name) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td % (hidden) Tj\n(shown) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td [(A) -300 (B) 120 (C)] TJ ET"),
    page("BT /F1 12 Tf 14 TL 10 700 Td (first) Tj (second) ' 1 2 (third) \" ET"),
    page("BT /F1 +12 Tf -.5 +.5 Td 10 -700.25e Td (signed) Tj ET"),
  ]);
  assert.equal(got[0], "via escaped name");
  assert.equal(got[1], "shown");
  assert.match(nth(got, 2, "texts"), /^A\s?B\s?C$/);
  assert.equal(got[3], "first\nsecond\nthird");
  assert.equal(got[4], "signed");
});

test("R41: a content array is one stream with a line feed between its parts, and both the whole reading and a range read it so", async () => {
  const bytes = doc([page(null, { contents: "[101 0 R 102 0 R 103 0 R]" })], { objs: {
    101: { data: "BT /F1 12 Tf 10 700 Td (one) Tj" }, 102: { data: "(two) Tj" }, 103: { data: "(three) Tj ET" } } });
  assert.equal(nth(read(await extractPdfStructure(bytes)).text.pages, 0, "pages").text, "onetwothree");
  assert.equal(nth(ranged(await extractPdfRange(bytes, { from: 0, count: 1 })).text.pages, 0, "range pages").text, "onetwothree");
  const split = doc([page(null, { contents: "[101 0 R 102 0 R]" })], { objs: { 101: { data: "BT /F1 12 Tf 10 700 Td (par" }, 102: { data: "ted) Tj ET" } } });
  const t = read(await extractPdfStructure(split)).text;
  /* the string runs on across the join, as one content stream: the line feed between the parts is one of its bytes, which the font does not map */
  assert.deepEqual(nth(t.pages, 0, "pages").undetermined.map((/** @type {Marker} */ u) => [u.reason, u.codes]), [["unmapped_code", "0a"]]);
  assert.equal(nth(t.pages, 0, "pages").text, "parted");
});

test("R41: bytes the lexer meets that are not operators of text (a stray delimiter, an unclosed string, null bytes, binary after ID) neither stop it nor change the text before and after", async () => {
  const got = await textOf([
    page("BT /F1 12 Tf 10 700 Td (before) Tj >> ] } { \x00\x0c (after) Tj ET"),
    page("BT /F1 12 Tf 10 700 Td (kept) Tj ET (unclosed"),
    page("BT /F1 12 Tf 10 700 Td (head) Tj ET BI /W 1 /H 1 /BPC 8 /CS /G ID \x01\x02(never text) Tj\n EI BT /F1 12 Tf 10 600 Td (tail) Tj ET"),
  ]);
  assert.equal(got[0], "beforeafter");
  assert.equal(got[1], "kept");
  assert.match(nth(got, 2, "texts"), /^head\n?tail$|head/);
});
