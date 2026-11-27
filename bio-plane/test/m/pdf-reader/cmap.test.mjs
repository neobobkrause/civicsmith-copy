/* pdf-reader: requirement-named tests for the /ToUnicode CMap reading (build/requirements/pdf-reader.md R12, fix round 9:
 * G132g every codespace range honoured and codes unsigned; G125f a bfrange expanded for at most boundOf("pdf",
 * "bfrange_codes") codes and looked up arithmetically beyond), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { build } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure } from "../../../src/pdfstructure.mjs" */
/** @import { Objects } from "./pdf.mjs" */

/** A value that is there; a thrown failure naming `what` when it is undefined.
 *  @template T
 *  @param {T | undefined} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined) throw new Error(`${what}: none`);
  return v;
}
/** The reading of a PDF; a thrown failure when the answer is a refusal.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
function readingOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** What `read` gives back: the page's text, the markers as `reason:codes`, and the whole reading.
 *  @typedef {Object} Read
 *  @property {string} text
 *  @property {string[]} marks
 *  @property {PdfStructure} r
 */
/** A bfrange's code as eight upper-case hex digits.
 *  @param {number} n
 *  @returns {string} */
const hexN = (n) => n.toString(16).padStart(8, "0").toUpperCase();

const TYPE0 = "<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /DescendantFonts [13 0 R] /ToUnicode 11 0 R >>";
const CID = "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /X /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 >>";

/** A one-page file whose only font is a Type0 font with the given CMap body; the page shows `shown` (a hex string).
 *  @param {string} cmap
 *  @param {string} shown
 *  @returns {Promise<Read>} */
async function read(cmap, shown) {
  /** @type {Objects} */
  const o = {
    1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 10: TYPE0, 13: CID,
    11: { data: `/CIDInit /ProcSet findresource begin ${cmap} end` },
    100: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 10 0 R >> >> /Contents 101 0 R >>",
    101: { data: `BT /F1 12 Tf 40 700 Td ${shown} Tj ET` },
  };
  const r = readingOf(await extractPdfStructure(build(o)));
  return { text: must(r.text.pages[0], "page 0").text, marks: r.text.undetermined.map((u) => `${u.reason}:${u.codes}`), r };
}

const FOUR = "1 begincodespacerange <00000000> <FFFFFFFF> endcodespacerange";

test("R12: codes of different widths in one CMap are each read at the width their codespace range gives", async () => {
  const mixed = "2 begincodespacerange <00> <7F> <8140> <9FFC> endcodespacerange 2 beginbfchar <41> <0058> <8140> <0059> endbfchar";
  const a = await read(mixed, "<41814041>");
  assert.equal(a.text, "XYX");
  assert.deepEqual(a.marks, []);
  /* the ranges stated in separate blocks are the same */
  const b = await read("1 begincodespacerange <00> <7F> endcodespacerange 1 begincodespacerange <8140> <9FFC> endcodespacerange"
    + " 2 beginbfchar <41> <0058> <8140> <0059> endbfchar", "<4181404141>");
  assert.equal(b.text, "XYXX");
  /* a prefix that lies in no range is taken at the shortest width and stated, not guessed */
  const c = await read(mixed, "<41FF41>");
  assert.equal(c.text, "XX");
  assert.deepEqual(c.marks, ["unmapped_code:ff"]);
  /* a final code that does not fit its width is stated misaligned */
  const d = await read(mixed, "<4181>");
  assert.equal(d.text, "X");
  assert.deepEqual(d.marks, ["code_width_misaligned:81"]);
});

test("R12: a code is unsigned whatever its width (a 4-byte code at or above 0x80000000 maps as itself)", async () => {
  const a = await read(`${FOUR} 2 beginbfchar <80000001> <0058> <FFFFFFFF> <0059> endbfchar`, "<80000001FFFFFFFF>");
  assert.equal(a.text, "XY");
  assert.deepEqual(a.marks, []);
  const b = await read(`${FOUR} 1 beginbfchar <80000001> <0058> endbfchar`, "<80000002>");
  assert.deepEqual(b.marks, ["unmapped_code:80000002"], "an unmapped high code states its own digits, never a negative number");
});

test("R12: a bfrange of more codes than the bound is looked up arithmetically, and the text is exactly what expansion gives", async () => {
  const cap = boundOf("pdf", "bfrange_codes");
  const heap0 = process.memoryUsage().heapUsed;
  const big = await read(`${FOUR} 1 beginbfrange <00000000> <00FFFFFF> <0041> endbfrange`, "<00000000000000190000FFFF>");
  assert.equal(big.text, "AZ" + String.fromCharCode(0x41 + 0xffff));
  assert.ok(process.memoryUsage().heapUsed - heap0 < 150 * 1048576, "a 16.7 million code range is not expanded");
  /* the bound's two sides: cap codes (expanded) and cap + 1 (arithmetic) give the same reading */
  for (const codes of [cap, cap + 1, cap + 2]) {
    const r = await read(`${FOUR} 1 beginbfrange <00000000> <${hexN(codes - 1)}> <0100> endbfrange`, `<00000000${hexN(codes - 1)}0000000A>`);
    assert.equal(r.text, String.fromCharCode(0x100) + String.fromCharCode(0x100 + codes - 1) + String.fromCharCode(0x10a), `range of ${codes} codes`);
    assert.deepEqual(r.marks, []);
  }
  /* a code just past the range is unmapped, and the explicit-array form still works beside it */
  const past = await read(`${FOUR} 1 beginbfrange <00000000> <${hexN(cap + 9)}> <0100> endbfrange`, `<${hexN(cap + 10)}>`);
  assert.deepEqual(past.marks, [`unmapped_code:${hexN(cap + 10).toLowerCase()}`]);
});

test("R12: sections apply in the order the CMap states them: a later range replaces an earlier entry, a later entry replaces a larger range", async () => {
  const cap = boundOf("pdf", "bfrange_codes");
  const last = hexN(cap + 100);
  /* bfchar sections are applied before bfrange sections (as full expansion has always done), so the range replaces the entry in it */
  const a = await read(`${FOUR} 1 beginbfchar <00000005> <005A> endbfchar 1 beginbfrange <00000000> <${last}> <0041> endbfrange`, "<00000005>");
  assert.equal(a.text, "F");
  /* a small range after a large one replaces its codes; a large one after a large one replaces them all */
  const b = await read(`${FOUR} 2 beginbfrange <00000000> <${last}> <0041> <00000005> <00000006> <0061> endbfrange`, "<0000000400000005>");
  assert.equal(b.text, "Ea");
  const c = await read(`${FOUR} 2 beginbfrange <00000000> <${last}> <0041> <00000000> <${last}> <0100> endbfrange`, "<00000003>");
  assert.equal(c.text, String.fromCharCode(0x103));
});
