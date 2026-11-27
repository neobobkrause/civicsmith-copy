/* pdf-reader: requirement-named tests for the recovery notes of a ranged read (R50; fix round 10, cause R9; K5074), at the
 * module's interface: `openPdfRange`'s answer carries the notes its parse made, each `range(...)` answer and each
 * `extractPdfRange` answer carries the open's notes (kept, never cleared by a range), then any the range itself adds, each
 * once; an intact file carries `notes: []`. The files are fixtures.mjs's, made by this module's real code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure, extractPdfRange, openPdfRange } from "../../../src/pdfstructure.mjs";
import { rangedNotesFiles } from "./fixtures.mjs";
import { doc } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfRefusal, OpenedRange, PdfRange } from "../../../src/pdfstructure.mjs" */

/** A text-showing content stream.
 *  @param {string} s
 *  @returns {string} */
const T = (s) => `BT /F1 12 Tf 40 700 Td (${s}) Tj ET`;
/** The reading of a whole file; a thrown failure naming the refusal when it is refused.
 *  @param {PdfStructureAnswer} a
 *  @returns {PdfStructure} */
const reading = (a) => { if (!a.ok) throw new Error(`expected a reading, got ${a.reason}`); return a; };
/** An opened document; a thrown failure naming the refusal when it is refused.
 *  @param {PdfRefusal | OpenedRange} a
 *  @returns {OpenedRange} */
const openOf = (a) => { if (!a.ok) throw new Error(`expected an open, got ${a.reason}`); return a; };
/** A range's reading; a thrown failure naming the refusal when it is refused.
 *  @param {PdfRefusal | PdfRange} a
 *  @returns {PdfRange} */
const rangeOf = (a) => { if (!a.ok) throw new Error(`expected a range, got ${a.reason}`); return a; };
/** The ranges a test reads, as `[from, count]`.
 *  @typedef {[number, number][]} Spans */

test("R50: a 30-page PDF with startxref damaged: the open and two range calls each carry the notes extractPdfStructure gives", async () => {
  const { damaged } = rangedNotesFiles();
  const whole = reading(await extractPdfStructure(damaged));
  assert.deepEqual(whole.notes, ["xref_reconstructed"]);
  const opened = openOf(await openPdfRange(damaged));
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.notes, whole.notes);
  /** @type {Spans} */
  const spans = [[0, 10], [10, 10], [20, 10]];
  for (const [from, count] of spans) {
    const r = rangeOf(await opened.range({ from, count }));
    assert.deepEqual(r.notes, whole.notes, `range ${from}+${count}`);
    assert.deepEqual(r.notes, rangeOf(await extractPdfRange(damaged, { from, count })).notes, `extractPdfRange ${from}+${count}`);
  }
});

test("R50: the same file cut at 70 percent: the open and two range calls each carry xref_reconstructed, structure_reconstructed and pages_missing", async () => {
  const { cut } = rangedNotesFiles();
  const whole = reading(await extractPdfStructure(cut));
  const missing = whole.notes.find((n) => n.startsWith("pages_missing:"));
  assert.equal(missing, `pages_missing:${30 - whole.pages}/30`);
  const want = ["xref_reconstructed", "structure_reconstructed", missing];
  const opened = openOf(await openPdfRange(cut));
  assert.deepEqual(opened.notes, want);
  const first = rangeOf(await opened.range({ from: 0, count: 10 }));
  const second = rangeOf(await opened.range({ from: 10, count: 10 }));
  assert.deepEqual(first.notes, want);
  assert.deepEqual(second.notes, want, "the first range did not clear what the second carries");
  assert.deepEqual(rangeOf(await extractPdfRange(cut, { from: 0, count: 10 })).notes, want);
  /* the open's own answer is not changed by the ranges that follow it */
  assert.deepEqual(opened.notes, want);
});

test("R50: control: an intact PDF carries notes [] on the open and on every range", async () => {
  const { intact } = rangedNotesFiles();
  const opened = openOf(await openPdfRange(intact));
  assert.deepEqual(opened.notes, []);
  /** @type {Spans} */
  const spans = [[0, 10], [10, 10], [20, 10], [30, 5], [0, 30]];
  for (const [from, count] of spans) assert.deepEqual(rangeOf(await opened.range({ from, count })).notes, [], `range ${from}+${count}`);
  assert.deepEqual(rangeOf(await extractPdfRange(intact, { from: 0, count: 10 })).notes, []);
});

test("R50: a note a range makes itself follows the open's notes, is carried by that range alone, and is carried once however often it is read", async () => {
  /* a file with no cross-reference (xref_reconstructed at the open) whose page 1 has a Flate content stream that cannot be decoded */
  const bytes = doc([{ content: T("ONE") }, { content: { dict: "/Filter /FlateDecode", data: "not flate data" } }, { content: T("THREE") }]);
  const opened = openOf(await openPdfRange(bytes));
  assert.deepEqual(opened.notes, ["xref_reconstructed"]);
  const clean = rangeOf(await opened.range({ from: 0, count: 1 }));
  assert.deepEqual(clean.notes, ["xref_reconstructed"]);
  const bad = rangeOf(await opened.range({ from: 1, count: 1 }));
  assert.deepEqual(bad.notes, ["xref_reconstructed", "content_stream_undecodable"]);
  const wide = rangeOf(await opened.range({ from: 0, count: 3 }));
  assert.deepEqual(wide.notes, ["xref_reconstructed", "content_stream_undecodable"]);
  const again = rangeOf(await opened.range({ from: 1, count: 1 }));
  assert.deepEqual(again.notes, ["xref_reconstructed", "content_stream_undecodable"]);
  const after = rangeOf(await opened.range({ from: 2, count: 1 }));
  assert.deepEqual(after.notes, ["xref_reconstructed"], "a note an earlier range made is not carried into one that did not make it");
  assert.deepEqual(rangeOf(await extractPdfRange(bytes, { from: 1, count: 1 })).notes, bad.notes);
  assert.deepEqual(opened.notes, ["xref_reconstructed"]);
});

test("R50: a range that reads nothing (from past the end) and the open of a document with a title it cannot decode still carry the notes", async () => {
  const { damaged } = rangedNotesFiles();
  const opened = openOf(await openPdfRange(damaged));
  assert.deepEqual(rangeOf(await opened.range({ from: 99, count: 5 })).notes, ["xref_reconstructed"]);
  /* an odd-length UTF-16BE title: the note is the document's, so every range carries it, not the first alone */
  const bytes = doc([{ content: T("ONE") }, { content: T("TWO") }], { objs: { 91: "<< /Title <FEFF004100> >>" }, trailer: "trailer\n<< /Root 1 0 R /Info 91 0 R >>\n" });
  const o2 = openOf(await openPdfRange(bytes));
  const a = rangeOf(await o2.range({ from: 0, count: 1 }));
  const b = rangeOf(await o2.range({ from: 1, count: 1 }));
  assert.deepEqual(a.notes, ["xref_reconstructed", "title_undecodable"]);
  assert.deepEqual(b.notes, a.notes);
  assert.deepEqual(reading(await extractPdfStructure(bytes)).notes, a.notes);
});

test("R50: an encrypted document's range carries the open's notes and encrypted, once", async () => {
  const bytes = doc([{ content: T("ONE") }], { catalog: "", trailer: "trailer\n<< /Root 1 0 R /Encrypt << /Filter /Standard /R 3 >> >>\n" });
  const opened = openOf(await openPdfRange(bytes));
  const r1 = rangeOf(await opened.range({ from: 0, count: 1 }));
  const r2 = rangeOf(await opened.range({ from: 0, count: 1 }));
  assert.ok(r1.notes.includes("encrypted"));
  assert.equal(r1.notes.filter(/** @param {string} n @returns {boolean} */ (n) => n === "encrypted").length, 1);
  assert.deepEqual(r2.notes, r1.notes);
  for (const n of opened.notes) assert.ok(r1.notes.includes(n));
});
