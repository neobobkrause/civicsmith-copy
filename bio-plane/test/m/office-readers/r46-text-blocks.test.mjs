/* office-readers R46 (fix round 9, G178; K5006): a workbook's text is made once, as the walk goes, and only what has been
   made is held. The text is kept in blocks added as it grows, so these cases are large enough that a workbook's text spans
   many blocks: the document and every sheet's text are still exact (characters of one, two and four UTF-8 bytes among
   them), and a sheet that cannot be read to its end, after its own rows had filled further blocks, leaves none of its
   lines while the sheets around it keep theirs. The memory itself is measured by `r46-memory.test.mjs`. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

/* `n` rows of three cells, each cell's text naming its sheet, row and column, with letters of every UTF-8 width */
const WORDS = ["naïve", "مدينة", "😀 emoji", "ordinance", "señor", "ﬂoor"];
const rowsOf = (tag, n) => Array.from({ length: n }, (_, i) => [0, 1, 2].map((j) => `${tag}-r${i + 1}c${j + 1} ${WORDS[(i + j) % WORDS.length]}`));
const sheetOf = (rows) => F.sheetXml({ rows: rows.map((cells, i) => ({ r: i + 1, cells: cells.map((is, j) => ({ r: `${"ABC"[j]}${i + 1}`, t: "inlineStr", is })) })) });
const textOf = (rows) => rows.map((r) => r.join("\t")).join("\n");
const utf8 = (s) => Buffer.byteLength(s, "utf8");

test("R46 a workbook whose text spans many blocks answers it exactly: each sheet's text, the document joined from them, its length and each line's row", async () => {
  const a = rowsOf("alpha", 6000), b = rowsOf("beta", 4000);
  assert.ok(utf8(textOf(a)) + utf8(textOf(b)) > (64 + 128 + 256) * 1024, "the text passes the first three blocks");
  const t = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "A", xml: sheetOf(a) }, { name: "B", xml: sheetOf(b) }] }));
  assert.equal(t.ok, true);
  assert.equal(t.sheets[0].text, textOf(a));
  assert.equal(t.sheets[1].text, textOf(b));
  assert.equal(t.document, `${textOf(a)}\n${textOf(b)}`);
  assert.equal(t.counts.chars, t.document.length);
  assert.deepEqual(t.sheets[0].lineRows, a.map((_, i) => i + 1));
  assert.deepEqual(t.sheets[1].lineRows, b.map((_, i) => i + 1));
});

test("R46 a sheet that cannot be read to its end after its rows filled further blocks gives none of its lines; the sheets before and after it are exactly their own", async () => {
  const before = rowsOf("before", 3000), bad = rowsOf("lost", 6000), after = rowsOf("after", 3000);
  const bytes = F.xlsx({ sheets: [
    { name: "Before", xml: sheetOf(before) },
    { name: "Bad", xml: sheetOf(bad), cd: F.OVER_WHOLE },
    { name: "After", xml: sheetOf(after) },
  ] });
  const t = await xlsxEntry.text(bytes);
  assert.equal(t.ok, true);
  assert.equal(t.sheets[1].text, "");
  assert.equal(t.sheets[1].cells, null);
  assert.ok(t.undetermined.some((u) => u.sheet === 1), "the unreadable sheet is stated");
  assert.equal(t.sheets[0].text, textOf(before));
  assert.equal(t.sheets[2].text, textOf(after));
  assert.equal(t.document, `${textOf(before)}\n${textOf(after)}`);
  assert.equal(t.counts.chars, t.document.length);
  assert.ok(!t.document.includes("lost-"), "none of the unreadable sheet's rows is in the document");
});

/* R37 beside R46: a sheet over the whole-read bound is kept for point reads as its pieces, each encoded and compressed a
   window at a time while the walk goes on. Rows dense with four-byte letters put window edges between the two halves of
   a pair again and again; every cell a point read answers is the letter the file holds, never a replacement character. */
test("R37 R46 a workbook over the whole-read bound, dense with four-byte letters, answers its point reads exactly as written", async () => {
  const rows = 120_000, word = (r) => `${"😀🎉".repeat(15)}${r}`;
  const body = [];
  for (let r = 1; r <= rows; r++) body.push(`<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>${word(r)}</t></is></c></row>`);
  const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body.join("")}</sheetData></worksheet>`;
  assert.ok(utf8(xml) > 20 * 1048576 && utf8(xml) < 32 * 1048576, "over the whole-read bound, under the streamed ceiling");
  const parts = await xlsxEntry.parts(F.xlsx({ sheets: [{ name: "Dense", xml }] }));
  const t = await xlsxEntry.text(parts, { inlineCellsMax: 512 * 1024 });
  assert.ok(t.piecewise, "the sheet is read in pieces");
  assert.ok(!t.document.includes("�"));
  for (const [from, to] of [[1, 6000], [59_000, 61_000], [119_000, 120_000]]) {
    const got = [];
    for (let at = from; at != null && at <= to;) {
      const r = await xlsxEntry.cellsIn(parts, { sheet: "Dense", fromRow: at, toRow: to });
      assert.equal(r.ok, true);
      got.push(...r.cells.map((c) => c.value));
      at = r.next_row ?? null;
    }
    assert.deepEqual(got, Array.from({ length: to - from + 1 }, (_, i) => word(from + i)), `rows ${from} to ${to}`);
  }
});
