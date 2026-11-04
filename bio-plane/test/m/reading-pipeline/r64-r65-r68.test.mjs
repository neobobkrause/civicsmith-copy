/* reading-pipeline R64, R65 and R68 (T53; N1272, DEC-479 (51); T53-125, T53-126): `partsOf` names the candidate parts of a reading in the one shape of a part (K5734),
   `interpretUnits` makes a part's entities and facts from that part's units alone, and a reading states how many of its words fall below the reader's own measured
   clarity, only where the reader measured it. Each test names the ids. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { read, partsOf, interpretUnits, PARTS_MAX, PART_KINDS } from "../../../src/reading-pipeline/index.mjs";
import { fresh, hold, doc, member, evidenceStore, withEntry, ocrAnswer, i2 } from "./fixture.mjs";
import { scanPdf } from "./scans.mjs";

const pdfEntry = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: text.pages.length, notes: [] }) });
const unitsOf = (n, kind = "pdf-page") => Array.from({ length: n }, (_, i) => ({ extent: { kind, page: i, rect: null }, seq: i, text: `unit ${i}`, kind: "body" }));

test("R65: a workbook of three sheets of 100,000 rows is named as row blocks of the sheet's unit size, in sheet order, rows from 1", () => {
  const sheet = (name) => ({ name, rows: 100000, cols: 4, usedRows: 100000, usedCols: 4 });
  const out = partsOf({ container_extent: { container: "xlsx", sheets: [sheet("A"), sheet("B"), sheet("C")] } });
  assert.equal(out.truncated, false);
  const block = 5000;   /* 20,000 cells a block over 4 columns */
  assert.equal(out.parts.length, 60);
  assert.deepEqual(out.parts[0], { kind: "sheet-range", sheet: "A", from_row: 1, to_row: block });
  assert.deepEqual(out.parts[19], { kind: "sheet-range", sheet: "A", from_row: 95001, to_row: 100000 });
  assert.deepEqual(out.parts[20], { kind: "sheet-range", sheet: "B", from_row: 1, to_row: block });
  assert.deepEqual(out.parts.at(-1), { kind: "sheet-range", sheet: "C", from_row: 95001, to_row: 100000 });
  assert.equal(out.why, undefined);
});

test("R65: a PDF with headings is named by heading, one without by page range; pages from 0, in document order", () => {
  const units = unitsOf(30);
  units[0].heading = true; units[0].text = "Budget"; units[12].heading = true; units[12].text = "Minutes"; units[25].heading = true; units[25].text = "Appendix";
  const headed = partsOf({ page_count: 30, text_units: units }, { kind: "pdf-page" });
  assert.deepEqual(headed.parts, [{ kind: "pdf-page", from: 0, to: 11 }, { kind: "pdf-page", from: 12, to: 24 }, { kind: "pdf-page", from: 25, to: 29 }]);
  assert.deepEqual(headed.headings, ["Budget", "Minutes", "Appendix"]);
  const plain = partsOf({ page_count: 25, text_units: unitsOf(25) });
  assert.deepEqual(plain.parts.map((p) => [p.from, p.to]), [[0, 9], [10, 19], [20, 24]]);
  assert.equal(plain.headings, undefined);
});

test("R65: a deck is named by the slide from 1, a document by runs of paragraphs from 0; the kind asked for is the only kind named", () => {
  const deck = partsOf({ container_extent: { container: "pptx", slides: [{ shapes: 1 }, { shapes: 2 }, { shapes: 1 }] } });
  assert.deepEqual(deck.parts, [1, 2, 3].map((n) => ({ kind: "slide", from: n, to: n })));
  const doc120 = partsOf({ container_extent: { container: "docx", paragraphs: 120 } }, { kind: "doc-para" });
  assert.deepEqual(doc120.parts, [{ kind: "doc-para", from: 0, to: 49 }, { kind: "doc-para", from: 50, to: 99 }, { kind: "doc-para", from: 100, to: 119 }]);
  assert.deepEqual(partsOf({ container_extent: { container: "docx", paragraphs: 120 } }, { kind: "slide" }).parts, []);
  for (const p of [...deck.parts, ...doc120.parts]) assert.ok(PART_KINDS.includes(p.kind));
});

test("R65: more than the bound is named up to it and stated truncated with the count; a reading with no units names none and says so", () => {
  const big = partsOf({ container_extent: { container: "pptx", slides: Array.from({ length: PARTS_MAX + 7 }, () => ({ shapes: 1 })) } });
  assert.equal(big.parts.length, PARTS_MAX);
  assert.equal(big.truncated, true);
  assert.equal(big.total, PARTS_MAX + 7);
  const none = partsOf({});
  assert.deepEqual(none.parts, []);
  assert.equal(none.total, 0);
  assert.equal(none.why, "NO_UNITS");
  assert.equal(partsOf(null).why, "NO_UNITS");
});

test("R64: a 40-page document interpreted for pages 5 to 6 returns only what its units there hold; the reading's whole-document entities are unchanged", async () => {
  const w = fresh();
  const pages = Array.from({ length: 40 }, (_, p) => ({ page: p, text: p === 5 || p === 6 ? `Item ${p}: the council approved $${p}00,000 on October ${p}, 2026.` : `Page ${p} holds routine minutes.` }));
  const bytes = "%PDF-1.7 interpret";
  const d = await hold(w.evidence, bytes);
  const document = doc({ digest: d, ct: "application/pdf", format: "pdf" });
  await withEntry(pdfEntry(i2(pages)), async () => {
    const whole = await w.read(document);
    const before = JSON.stringify(whole.reading.entities);
    const got = await interpretUnits(document, { kind: "pdf-page", from: 5, to: 6 }, { evidence: evidenceStore(w.evidence), env: w.env });
    assert.equal(got.ok, true);
    assert.deepEqual(got.part, { kind: "pdf-page", from: 5, to: 6 });
    assert.ok(Array.isArray(got.entities));
    for (const e of got.entities) assert.ok(!/Page \d+ holds routine/.test(JSON.stringify(e)), "no entity from a page outside the part");
    assert.match(got.basis, /\b2\b/);
    assert.equal(JSON.stringify((await w.read(document)).reading.entities), before, "the reading's own entities are untouched");
    const none = await interpretUnits(document, { kind: "pdf-page", from: 90, to: 91 }, { evidence: evidenceStore(w.evidence), env: w.env });
    assert.equal(none.ok, false);
    assert.equal(none.reason, "PART_HAS_NO_UNITS");
  });
});

test("R64: a part that is not one of the four shapes is refused, and no AI member is among this module's uses for it", async () => {
  const w = fresh();
  assert.equal((await interpretUnits(doc({ digest: "a".repeat(64) }), { kind: "table", from: 1, to: 2 }, { evidence: evidenceStore(w.evidence) })).reason, "PART_NOT_VALID");
  assert.equal((await interpretUnits(doc({ digest: "a".repeat(64) }), { kind: "slide", from: 0, to: 1 }, { evidence: evidenceStore(w.evidence) })).reason, "PART_NOT_VALID");
  /* this module's source and, since BOB's split (PR 274), `reader-contract`'s, which it re-exports */
  const src = ["../../../src/reading-pipeline/index.mjs", "../../../src/reader-contract/index.mjs"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(src, /from\s+["'][^"']*\/(?:ai-[a-z-]+|agent-[a-z-]+|skills)\b/);
});

test("R68: an OCR reading states the words below the reader's own measured clarity with the pages they sit on; a page above the threshold counts none", async () => {
  const bytes = scanPdf(3);
  const leg = { 0: { words: 10, confident_words: 10, share: 1 }, 1: { words: 10, confident_words: 7, share: 0.7 }, 2: { words: 10, confident_words: 6, share: 0.6 } };
  const m = member((body) => {
    const clean = [...new Set(body.pages)].sort((a, b) => a - b), p = clean[0];
    return { ...ocrAnswer([p]), legibility: leg[p], deferred: clean.slice(1) };
  });
  const w = fresh({ env: { OCR_WORKER: m } });
  const d = await hold(w.evidence, bytes);
  const out = await read(doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" }), { evidence: evidenceStore(w.evidence), env: w.env });
  assert.deepEqual(out.reading.unclear_words, { count: 7, positions: [{ page: 1, count: 3 }, { page: 2, count: 4 }] });
});

test("R68 (control): a text layer, a reading whose reader measured no clarity and a page refused as illegible carry no unclear_words, never a zero", async () => {
  const w = fresh();
  const d = await hold(w.evidence, "%PDF-1.7 layer");
  await withEntry(pdfEntry(i2([{ page: 0, text: "A page with a text layer of its own." }])), async () => {
    const out = await w.read(doc({ digest: d, ct: "application/pdf", format: "pdf" }));
    assert.equal("unclear_words" in out.reading, false);
  });
  const bytes = scanPdf(1);
  const m = member((body) => ({ ...ocrAnswer([body.pages[0]]) }));   /* the member states no legibility */
  const w2 = fresh({ env: { OCR_WORKER: m } });
  const d2 = await hold(w2.evidence, bytes);
  const out2 = await read(doc({ digest: d2, bytes: bytes.length, ct: "application/pdf", format: "pdf" }), { evidence: evidenceStore(w2.evidence), env: w2.env });
  assert.equal("unclear_words" in out2.reading, false);
  const refusing = member((body) => ({ ok: false, reason: "PAGE_NOT_LEGIBLE", page: body.pages[0], legibility: { words: 10, confident_words: 1, share: 0.1 }, deferred: [], notes: [] }));
  const w3 = fresh({ env: { OCR_WORKER: refusing } });
  const d3 = await hold(w3.evidence, bytes);
  const out3 = await read(doc({ digest: d3, bytes: bytes.length, ct: "application/pdf", format: "pdf" }), { evidence: evidenceStore(w3.evidence), env: w3.env });
  assert.equal("unclear_words" in out3.reading, false, "a refused page's words are no part of the reading");
});

test("R64: a sheet part returns cellsInRange's cells for the range and no others, with no entities made", async () => {
  const w = fresh();
  const csv = "name,amount\nAnn,5\nBob,7\nCy,9\n";
  const d = await hold(w.evidence, csv);
  const document = doc({ digest: d, bytes: csv.length, ct: "text/csv", format: "csv", fromText: true });
  const whole = await w.read(document);
  const sheet = whole.reading.container_extent.sheets[0].name;
  const got = await interpretUnits(document, { kind: "sheet-range", sheet, from_row: 2, to_row: 3 }, { evidence: evidenceStore(w.evidence), env: w.env });
  assert.equal(got.ok, true);
  assert.deepEqual(got.entities, []);
  const rows = new Set(got.cells.map((c) => (c.row ?? c.source?.row ?? null)));
  assert.ok(got.cells.length > 0 && got.cells.length <= 4, `${got.cells.length} cells`);
  assert.ok(![...rows].some((r) => r === 1 || r === 4), "no cell of a row outside the part");
});
