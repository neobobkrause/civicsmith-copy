/* pdf-reader: requirement-named tests for how the file's own structure is read (build/requirements/pdf-reader.md R8, R9, R23,
 * fix round 9: G132a-G132f), at the module's interface: the cross-reference chain and the newest revision, the catalog the
 * trailer names, text inside a stream's data, a page leaf with no /Type, a damaged or truncated file, a direct /Encrypt. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure, extractPdfRange, openPdf, openPdfRange } from "../../../src/pdfstructure.mjs";
import { build, doc, FONT_OBJS, FONTS } from "./pdf.mjs";
import { indexed } from "./indexed.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfRange, PdfRefusal, OpenedRange, PdfDoc } from "../../../src/pdfstructure.mjs" */
/** @import { Objects } from "./pdf.mjs" */

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
/** A range's reading; a thrown failure when the answer is a refusal.
 *  @param {PdfRange | PdfRefusal} r
 *  @returns {PdfRange} */
function rangeOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** A document opened for ranges; a thrown failure when the answer is a refusal.
 *  @param {OpenedRange | PdfRefusal} r
 *  @returns {OpenedRange} */
function openedOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** A document opened; a thrown failure when the bytes are not a PDF.
 *  @param {PdfDoc | null} d
 *  @returns {PdfDoc} */
const opened = (d) => must(d, "openPdf");

/** The objects of each part in one, a later part's object replacing an earlier one of the same number (as spreading them
 *  into one object does).
 *  @param {...Objects} parts
 *  @returns {Objects} */
function merged(...parts) {
  /** @type {Objects} */
  const out = {};
  for (const part of parts) for (const [n, body] of Object.entries(part)) out[n] = body;
  return out;
}

/** @param {string} s
 *  @returns {string} */
const T = (s) => `BT /F1 12 Tf 40 700 Td (${s}) Tj ET`;
/** @param {number} parent
 *  @param {number} c
 *  @returns {string} */
const PAGE = (parent, c) => `<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents ${c} 0 R >>`;
/** @param {number} p
 *  @returns {string} */
const CAT = (p) => `<< /Type /Catalog /Pages ${p} 0 R >>`;
/** @param {Uint8Array} bytes
 *  @returns {Promise<string[]>} */
const texts = async (bytes) => readingOf(await extractPdfStructure(bytes)).text.pages.map((p) => p.text);
/** @param {Objects} [extra]
 *  @returns {Objects} */
const base = (extra = {}) => merged({ 1: CAT(2), 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 100: PAGE(2, 101) }, FONT_OBJS, { 101: { data: T("OLDTEXT") } }, extra);

test("R8: an update that rewrites a page into a NEW object stream reads the newest definition, whichever xref form the file has", async () => {
  /** @type {("table" | "stream")[]} */
  const forms = ["table", "stream"];
  for (const xref of forms) {
    const r1 = indexed(base(), { xref, packed: [1, 2, 100], objStmNum: 900, xrefNum: 990 });
    const v2 = indexed({ 100: PAGE(2, 102), 102: { data: T("NEWTEXT") } }, { xref, packed: [100], objStmNum: 901, xrefNum: 991, prev: r1 });
    assert.deepEqual(await texts(v2), ["NEWTEXT"], `${xref}: the page in the second revision's object stream`);
    assert.ok(!readingOf(await extractPdfStructure(v2)).notes.includes("xref_reconstructed"), `${xref}: the chain validated`);
    /* the same update with the page at the top level of the file */
    const v2top = indexed({ 100: PAGE(2, 102), 102: { data: T("NEWTEXT") } }, { xref, prev: r1, xrefNum: 991 });
    assert.deepEqual(await texts(v2top), ["NEWTEXT"], `${xref}: the page at the top level`);
    /* the original is still what its own revision says */
    assert.deepEqual(await texts(r1), ["OLDTEXT"]);
  }
});

test("R8: three incremental revisions (a page added, a page deleted, the title changed) read as the last one states them", async () => {
  /** @param {number} n
   *  @param {string} t
   *  @returns {Objects} */
  const o = (n, t) => ({ [100 + 2 * n]: PAGE(2, 101 + 2 * n), [101 + 2 * n]: { data: T(t) } });
  const first = merged({ 1: CAT(2), 2: "<< /Type /Pages /Kids [100 0 R 102 0 R] /Count 2 >>" }, FONT_OBJS, o(0, "A"), o(1, "B"), { 91: "<< /Title (First) >>" });
  const r1 = indexed(first,
    { trailer: "/Root 1 0 R /Info 91 0 R" });
  const second = merged({ 2: "<< /Type /Pages /Kids [100 0 R 102 0 R 104 0 R] /Count 3 >>" }, o(2, "C"));
  const r2 = indexed(second, { prev: r1, trailer: "/Root 1 0 R /Info 91 0 R" });
  const r3 = indexed({ 2: "<< /Type /Pages /Kids [100 0 R 104 0 R] /Count 2 >>", 91: "<< /Title (Third) >>" }, { prev: r2, trailer: "/Root 1 0 R /Info 91 0 R" });
  assert.deepEqual(await texts(r1), ["A", "B"]);
  assert.deepEqual(await texts(r2), ["A", "B", "C"]);
  const last = readingOf(await extractPdfStructure(r3));
  assert.deepEqual(last.text.pages.map((p) => p.text), ["A", "C"]);
  assert.equal(must(last.metadata, "metadata").title, "Third");
  assert.ok(!last.notes.includes("xref_reconstructed"));
});

test("R8: a file with a first-page cross-reference section ahead of the rest (linearized) and an update after it reads the update", async () => {
  /* the first section at the front names /Prev: the one at the end; a second update is appended after both */
  const r1 = indexed(base(), { xref: "table" });
  const upd = indexed({ 101: { data: T("UPDATED") } }, { xref: "table", prev: r1 });
  assert.deepEqual(await texts(upd), ["UPDATED"]);
});

test("R8: when the chain does not validate every top-level object is scanned, a later definition winning, and xref_reconstructed is stated", async () => {
  const good = indexed(base({ 102: "<< /Unused true >>" }), { xref: "table" });
  const text = Buffer.from(good).toString("latin1");
  const badStart = Buffer.from(text.replace(/startxref\n\d+/, "startxref\n7"), "latin1");
  const r = readingOf(await extractPdfStructure(new Uint8Array(badStart)));
  assert.deepEqual(r.text.pages.map((p) => p.text), ["OLDTEXT"]);
  assert.ok(r.notes.includes("xref_reconstructed"), "a startxref that points nowhere");
  const noStart = new Uint8Array(Buffer.from(text.replace(/startxref\n\d+/, ""), "latin1"));
  assert.ok(readingOf(await extractPdfStructure(noStart)).notes.includes("xref_reconstructed"), "no startxref");
  /* a table that names an object at an offset where it is not */
  /** @param {string} m
   *  @param {string} off
   *  @returns {string} */
  const shifted = (m, off) => `${String(Number(off) + 5).padStart(10, "0")} 00000 n \n`;
  const moved = Buffer.from(text.replace(/(\d{10}) 00000 n \n/, shifted), "latin1");
  assert.ok(readingOf(await extractPdfStructure(new Uint8Array(moved))).notes.includes("xref_reconstructed"), "a named object that is not there");
  /* a later definition of one number wins when nothing names it */
  const firstTwice = merged(base(), { 101: { data: T("FIRST") } });
  const twice = build(firstTwice, { order: [1, 2, 100, 10, 11, 12, 101, 101] });
  assert.ok(twice.length > 0);
  const o = merged(base(), { 101: { data: T("FIRST") } });
  const two = build(o);
  const dup = new Uint8Array([...two.subarray(0, two.length - 30), ...Buffer.from(`101 0 obj\n<< /Length ${T("SECOND").length} >>\nstream\n${T("SECOND")}\nendstream\nendobj\n`), ...two.subarray(two.length - 30)]);
  assert.deepEqual(await texts(dup), ["SECOND"]);
  /* a valid chain is not noted */
  assert.ok(!readingOf(await extractPdfStructure(good)).notes.includes("xref_reconstructed"));
});

test("R8: the page tree is walked from the catalog the newest trailer's /Root names, never the first /Type /Catalog in the file", async () => {
  const o = merged({ 1: CAT(2), 3: CAT(4) }, FONT_OBJS, { 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 4: "<< /Type /Pages /Kids [102 0 R 104 0 R] /Count 2 >>",
    100: PAGE(2, 101), 101: { data: T("FIRST") }, 102: PAGE(4, 103), 103: { data: T("SECOND-A") }, 104: PAGE(4, 105), 105: { data: T("SECOND-B") } });
  assert.deepEqual(await texts(build(o, { trailer: "trailer\n<< /Root 3 0 R >>\n" })), ["SECOND-A", "SECOND-B"]);
  assert.deepEqual(await texts(build(o, { trailer: "trailer\n<< /Root 1 0 R >>\n" })), ["FIRST"]);
  /* through a chain: the update's trailer names the other catalog */
  const r1 = indexed(o, { trailer: "/Root 1 0 R" });
  /** @type {Objects} */
  const none = {};
  const r2 = indexed(none, { prev: r1, trailer: "/Root 3 0 R", xrefNum: 991 });
  assert.deepEqual(await texts(r2), ["SECOND-A", "SECOND-B"]);
});

test("R8: text inside a stream's data is never read as an object: a fake `N G obj` there overrides nothing", async () => {
  const fake = "<x>\n101 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n</x>";
  const o = merged(base(), { 101: { data: T("REALTEXT") }, 200: { dict: "/Type /Metadata /Subtype /XML", data: fake } });
  assert.deepEqual(await texts(build(o)), ["REALTEXT"]);
  /* a stream whose /Length is an indirect reference, and one whose /Length is wrong, are stepped over as well */
  const o2 = merged(base(), { 101: { data: T("REALTEXT") }, 200: { dict: "/Type /Metadata /Subtype /XML", data: fake, length: null }, 201: { dict: "/Subtype /XML", data: fake, length: 3 } });
  assert.deepEqual(await texts(build(o2)), ["REALTEXT"]);
  /* `length` absent is the data's length, as `length: undefined` was */
  const o3 = merged(base(), { 101: { data: T("REALTEXT") }, 200: { dict: "/Type /Metadata /Subtype /XML /Length 300 0 R", data: fake }, 300: String(fake.length) });
  assert.deepEqual(await texts(build(o3)), ["REALTEXT"]);
});

test("R8: a /Kids entry with no /Kids of its own is a page, whether or not it states /Type /Page", async () => {
  /** @param {number} c
   *  @returns {string} */
  const leaf = (c) => `<< /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents ${c} 0 R >>`;
  const o = merged({ 1: CAT(2) }, FONT_OBJS, { 2: "<< /Type /Pages /Kids [100 0 R 102 0 R 104 0 R] /Count 3 >>",
    100: PAGE(2, 101), 101: { data: T("ALPHA") }, 102: leaf(103), 103: { data: T("BRAVO") }, 104: PAGE(2, 105), 105: { data: T("CHARLIE") } });
  assert.deepEqual(await texts(build(o)), ["ALPHA", "BRAVO", "CHARLIE"]);
  /* when the walk yields no pages, every /Type /Page is used by object number, and that is noted */
  const lost = merged(o, { 1: "<< /Type /Catalog >>" });
  const r = readingOf(await extractPdfStructure(build(lost)));
  assert.deepEqual(r.text.pages.map((p) => p.text), ["ALPHA", "CHARLIE"]);
  assert.ok(r.notes.includes("page_order_by_object_number_fallback"));
});

test("R8: a file cut at 70 percent reads the pages it can find and states the rest (structure_reconstructed, pages_missing 10 of 30)", async () => {
  const full = doc(Array.from({ length: 30 }, (_, i) => ({ content: T(`PAGE${String(i + 1).padStart(2, "0")}`) })));
  const cut = full.subarray(0, Math.floor(full.length * 0.7));
  const answer = await extractPdfStructure(cut);
  assert.equal(answer.ok, true);
  const r = readingOf(answer);
  assert.ok(r.pages < 30 && r.pages > 0);
  assert.ok(r.notes.includes("xref_reconstructed"));
  assert.ok(r.notes.includes("structure_reconstructed"));
  assert.ok(r.notes.includes(`pages_missing:${30 - r.pages}/30`), JSON.stringify(r.notes));
  /* the intact file, and an indexed one, state nothing of the kind */
  for (const whole of [full, indexed(base(), {})]) {
    const w = readingOf(await extractPdfStructure(whole));
    assert.ok(!w.notes.includes("structure_reconstructed") && !w.notes.some((n) => n.startsWith("pages_missing")), JSON.stringify(w.notes));
  }
  /* a range over the same file states it too, and never throws */
  const open = await openPdfRange(cut);
  assert.equal(open.ok, true);
  assert.equal(openedOf(open).pages, r.pages);
});

test("R9, R23: a /Encrypt entry in the newest trailer, direct or by reference, is an encrypted document and ciphertext is never read as text", async () => {
  const E = "<< /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >>";
  const o = merged({ 1: CAT(2) }, FONT_OBJS, { 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 100: PAGE(2, 101), 101: { data: "\x01\x02CIPHERTEXT" } });
  const direct = readingOf(await extractPdfStructure(build(o, { trailer: `trailer\n<< /Root 1 0 R /Encrypt ${E} >>\n` })));
  const withE = merged(o, { 300: E });
  const indirect = readingOf(await extractPdfStructure(build(withE, { trailer: "trailer\n<< /Root 1 0 R /Encrypt 300 0 R >>\n" })));
  /* the only entry is a reference to an object that does not exist: still the newest trailer's /Encrypt */
  const dangling = readingOf(await extractPdfStructure(build(o, { trailer: "trailer\n<< /Root 1 0 R /Encrypt 999 0 R >>\n" })));
  for (const r of [direct, indirect, dangling]) {
    assert.deepEqual(r.text.undetermined, [{ page: null, reason: "encrypted", font: null, codes: "", count: 0 }]);
    assert.equal(r.text.producer.determination, "undetermined");
    assert.equal(r.text.producer.why, "encrypted");
    assert.equal(r.text.pages.length, 0);
    assert.equal(r.images, null);
  }
  const d = opened(await openPdf(build(o, { trailer: `trailer\n<< /Root 1 0 R /Encrypt ${E} >>\n` })));
  assert.equal(d.isEncrypted(), true);
  /* control: the same file without the entry reads its page */
  const plain = readingOf(await extractPdfStructure(build(o)));
  assert.equal(plain.text.pages.length, 1);
  assert.equal(opened(await openPdf(build(o))).isEncrypted(), false);
  /* through a chain: the newest trailer's entry counts */
  const r1 = indexed(o, { trailer: `/Root 1 0 R /Encrypt ${E}` });
  assert.equal(opened(await openPdf(r1)).isEncrypted(), true);
});

test("R9, R43: a range over an encrypted document answers the marker with final true and count 0, so a caller advancing by from + count is told the reading ends", async () => {
  const E = "<< /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >>";
  const o = merged({ 1: CAT(2) }, FONT_OBJS, { 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 100: PAGE(2, 101), 101: { data: "\x01\x02CIPHERTEXT" }, 300: E });
  const bytes = build(o, { trailer: "trailer\n<< /Root 1 0 R /Encrypt 300 0 R >>\n" });
  const emptied = merged(o, { 300: "<<>>" });
  const direct = build(emptied, { trailer: `trailer\n<< /Root 1 0 R /Encrypt ${E} >>\n` });
  for (const b of [bytes, direct]) {
    const r = rangeOf(await extractPdfRange(b, { from: 0, count: 10 }));
    assert.equal(r.final, true);
    assert.equal(r.count, 0);
    assert.deepEqual(r.text.undetermined, [{ page: null, reason: "encrypted", font: null, codes: "", count: 0 }]);
    const open = openedOf(await openPdfRange(b));
    const again = rangeOf(await open.range({ from: 0, count: 1, maxBytes: 100 }));
    assert.equal(again.final, true);
    assert.equal(again.count, 0);
  }
  /* control: a range over a readable document is not final here */
  const plain = rangeOf(await extractPdfRange(build(base()), { from: 0, count: 1 }));
  assert.equal(plain.final, undefined);
});

test("R47: a page tree 1,000 deep leaves the process alive and the walk stops at the bound, stated with its figures", async () => {
  const depth = 1000;
  /** @param {number} i
   *  @returns {number} */
  const N = (i) => 2000 + i;
  const o = merged({ 1: CAT(N(0)) }, FONT_OBJS);
  for (let i = 0; i < depth; i++) o[N(i)] = `<< /Type /Pages /Kids [${N(i + 1)} 0 R] /Count 1 >>`;
  o[N(depth)] = PAGE(N(depth - 1), 5000);
  o[5000] = { data: T("DEEP") };
  const answer = await extractPdfStructure(build(o));
  assert.equal(answer.ok, true);
  const r = readingOf(answer);
  /* the walk stops at the bound, so no page is reached by it; the page is then found the way R8 (c) finds pages when a walk yields none */
  assert.ok(r.notes.includes("page_order_by_object_number_fallback"));
  assert.deepEqual(r.text.pages.map((p) => p.text), ["DEEP"]);
  const note = r.notes.find((n) => n.startsWith("over_bound:tree_depth"));
  assert.ok(note, JSON.stringify(r.notes));
  assert.equal(must(note, "over_bound:tree_depth").split(":")[3], "256");
});
