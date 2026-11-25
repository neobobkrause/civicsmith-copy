/* extraction R99, R100, R105 (b), R107, R24, and G128c (fix round 9, the second half: job 41, extraction-2; K4837, K4840, K4909): units land whole in
   batches; completeness is one fact, the counters; stored readings in old shapes are re-registered and re-read; a stored unit has a kind and a sheet's
   rows; listeners are handed the whole old set; the stored PDF reading is completed by its pieces. Driven through the module's real entries (`readHeld`
   as the plane's ledger calls it, `writeReading`, `indexUnits`, `readingFor` / `op=reading`, `unitsOf`, `migrateReadings`) with the real reader
   (reading-pipeline's `read`), test-support's generators (`pdfgen`) and its registrar stub (`jobRegistrarStub`). Each case runs at the smallest size that
   shows its cause (R-FOUR (3)); the full sizes are the corpus R set's. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fresh, bundle, bucket, doc, sha, docx, wp, wr, member, ocrAnswer, homesOver } from "./fixture.mjs";
import { generate } from "../../pdfgen.mjs";
import * as F from "../office-readers/fixtures.mjs";
// fixtures-contract: store-assembly job-registrar
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";
import { read as readDocument } from "../../../src/reading-pipeline/index.mjs";
import { extractionOps, LAND_BATCH_BYTES, READING_SHAPE, CAPTURE_TEXT_CAPTURE_UNIT_BOUND } from "../../../src/extraction/index.mjs";

const MiB = 1048576;
const register = (rows) => homesOver(rows);

/* a held home: the bytes in the evidence store, the register naming it, the document in its bundle's provenance document */
async function home(bytes, { ct = "text/plain", format = "undetermined", fromText = false, reader = null } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows), reader });
  bundle(w.s, "INFO-1");
  const u8 = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const d = sha(u8);
  rows.set(d, { bundleId: "INFO-1", path: "f", encoding: "binary", bytes: u8.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, u8);
  const document = doc({ digest: d, bytes: u8.length, ct, format, fromText });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, bytes: u8, document };
}
const readAll = async (w, d, extra = {}) => { let a, n = 0; do { a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {}, ...extra }); } while (a.more && ++n < 400); return a; };
const fts = (w, term) => w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH ?`, `"${term}"`).length;
const viaOp = (w, d) => extractionOps(w.x, new URL(`http://x/reading?sha256=${d}&viewer=class:admin`), null, {}).reading();
const unitsOnce = (w, d) => { const r = w.one(`SELECT count(*) n, count(DISTINCT seq) s FROM capture_text WHERE capture_sha=?`, d); return r.n === r.s; };
const lines = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const textOf = (n) => lines(n, (i) => `line ${String(i).padStart(6, "0")} ${"council-minutes ".repeat(5)}`.padEnd(99, ".")).concat(["ENDMARKER"]).join("\n");
const pdfOf = async (recipe) => { const g = generate({ kind: "pdf", seed: "r99", fonts: ["type0"], ...recipe }); return { g, bytes: await g.bytes() }; };
/* the scripted OCR member: at most 24 of the pages asked a tick (the walker's 30-page scan, 24 read), its words carrying the page's marker */
const ocrOnePage = () => member((body) => ocrAnswer((Array.isArray(body.pages) ? body.pages : []).slice(0, 24), { text: (p) => `ocr words of page ${p} mark${p}` }));

/* ---------------------------------------------------------------------------------------------------- R99: units land in batches */

test("R99 R22 (G128; the 12,000,060 B text scaled to 3 MiB): a text read in pieces by the ledger lands every unit once, in batches of at most LAND_BATCH_BYTES, and its last line is found", { timeout: 120_000 }, async () => {
  const { w, d, bytes } = await home(textOf(32_000), { fromText: true });
  assert.ok(bytes.length > 2.9 * MiB);
  const a = await readAll(w, d);
  assert.equal(a.read, true, JSON.stringify(a));
  assert.equal(fts(w, "ENDMARKER"), 1, "R-STOP: the last line is in the index");
  assert.ok(unitsOnce(w, d), "each unit once");
  const batches = w.one(`SELECT count(*) n FROM job_batches WHERE sha=? AND kind='reading'`, d).n;
  const textBytes = w.one(`SELECT sum(length(CAST(text AS BLOB))) n FROM capture_text WHERE capture_sha=?`, d).n;
  assert.ok(batches >= Math.ceil(textBytes / LAND_BATCH_BYTES), `${batches} batches for ${textBytes} B of text`);
  assert.equal(w.x.unitsOf(d).state, "whole");
});

test("R99 (G128): a 6,000-paragraph .docx read by the ledger lands every paragraph, its last found; R22: none cut, none over a bound", { timeout: 120_000 }, async () => {
  const body = lines(6000, (i) => wp(wr(`paragraph ${i} of the council minutes, with words enough to weigh ${"x".repeat(40)}`))).join("") + wp(wr("LASTPARAGRAPHMARK"));
  const { w, d } = await home(docx(body), { ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", format: "docx" });
  const a = await readAll(w, d);
  assert.equal(a.read, true, JSON.stringify(a));
  assert.equal(fts(w, "LASTPARAGRAPHMARK"), 1);
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.written, st.counts.over_bound, st.counts.truncated], ["whole", 6001, 0, 0]);
  assert.ok(unitsOnce(w, d));
});

test("R99 (G128; PDF A1's family at 300 pages): a 300-page PDF read in page ranges by the ledger lands every page, its first, middle and last marks found", { timeout: 300_000 }, async () => {
  const { g, bytes } = await pdfOf({ size: { pages: 300, lines: 1 }, kinds: ["text"] });
  const { w, d } = await home(bytes, { ct: "application/pdf", format: "pdf" });
  const a = await readAll(w, d);
  assert.equal(a.read, true, JSON.stringify(a));
  for (const m of Object.values(g.truth.marks)) assert.equal(fts(w, m), 1, `mark ${m} is found`);
  assert.equal(w.one(`SELECT count(*) n FROM capture_text WHERE capture_sha=?`, d).n, 300);
  assert.equal(w.x.unitsOf(d).state, "whole");
});

test("R99 (G128): a batch landed a second time changes nothing: each unit once, the second landing's batches counted as already landed", () => {
  const w = fresh(); bundle(w.s, "B-1");
  const S = "9".repeat(64);
  const u = (i) => ({ extent: { kind: "pdf-page", page: i, rect: null }, text: `page ${i} ` + "z".repeat(200_000), seq: i });
  w.x.indexUnits("B-1", S, [u(0)], null);
  const piece = [u(1), u(2), u(3), u(4), u(5), u(6)];
  const first = w.x.indexUnits("B-1", S, piece, null, { append: true, batchKey: "p:1" });
  assert.ok(first.batches.landed >= 2, "the piece lands in more than one batch");
  const again = w.x.indexUnits("B-1", S, piece, null, { append: true, batchKey: "p:1" });
  assert.deepEqual([again.batches.landed, again.batches.already], [0, first.batches.landed]);
  assert.equal(w.one(`SELECT count(*) n FROM capture_text WHERE capture_sha=?`, S).n, 7, "each unit once");
});

test("R99 R107 (G128; K4914): a kill between two batches of a piece resumes from the next: the retried tick lands the rest, each unit once, and the read goes on to its end", { timeout: 120_000 }, async () => {
  /* 3 MiB of text: the second piece's units pass one batch (the piece is 2 MiB, the batch 1 MiB) */
  const { w, d } = await home(textOf(32_000), { fromText: true });
  const first = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.equal(first.more, true);
  /* R107 (K4914): while more follows, unitsOf answers how far the text has been read */
  const mid = w.x.unitsOf(d);
  assert.deepEqual([mid.read_through, mid.total], [first.detail.read_through, first.detail.total]);
  assert.ok(mid.read_through > 0 && mid.read_through < mid.total);
  const before = w.one(`SELECT count(*) n FROM capture_text WHERE capture_sha=?`, d).n;
  const cursor = w.one(`SELECT cursor FROM capture_text_state WHERE capture_sha=?`, d).cursor;
  const transact = w.core.transact.bind(w.core);
  let calls = 0;
  w.core.transact = (fn) => { if (++calls === 2) throw new Error("the object was killed between two batches"); return transact(fn); };
  await assert.rejects(() => w.x.readHeld({ sha: d, kind: "reading" }), /killed between two batches/);
  w.core.transact = transact;
  const landed = w.one(`SELECT count(*) n FROM capture_text WHERE capture_sha=?`, d).n;
  assert.ok(landed > before, "the first batch of the piece stands");
  assert.equal(w.one(`SELECT cursor FROM capture_text_state WHERE capture_sha=?`, d).cursor, cursor, "the state has not moved");
  const a = await readAll(w, d);
  assert.equal(a.read, true);
  assert.ok(unitsOnce(w, d), "each unit once after the resumed tick");
  assert.equal(fts(w, "ENDMARKER"), 1);
  assert.equal(w.x.unitsOf(d).state, "whole");
  assert.equal("read_through" in w.x.unitsOf(d), false, "absent once nothing more follows");
});

test("R99 (control): a reading under one batch lands in one", async () => {
  const { w, d } = await home(textOf(50), { fromText: true });
  await readAll(w, d);
  assert.equal(w.one(`SELECT count(*) n FROM job_batches WHERE sha=? AND kind='reading'`, d).n, 1);
});

/* ---------------------------------------------------------------------------------------------------- R100: completeness is one fact */

test("R100 R91 (G128a; SCAN C1 at 30 pages): a scan whose OCR left 6 of 30 pages is `partial` with 6 owed, in `op=reading` and `unitsOf` alike, and `whole` after its last OCR pass", { timeout: 120_000 }, async () => {
  const { bytes } = await pdfOf({ size: { pages: 30, lines: 1 }, kinds: ["scan"] });
  const { w, d } = await home(bytes, { ct: "application/pdf", format: "pdf" });
  const env = { OCR_WORKER: ocrOnePage() };
  const jobs = jobRegistrarStub();
  const r = await w.x.readHeld({ sha: d, kind: "reading", env, registerJob: jobs.registerJob, armJobs: jobs.armJobs });
  assert.equal(r.read, true, JSON.stringify(r));
  const a = viaOp(w, d);
  assert.equal(a.completeness.state, "partial", "never whole before the last OCR");
  assert.deepEqual([a.completeness.counters.owed, a.completeness.owed.pages], [6, 6]);
  const u = w.x.unitsOf(d);
  assert.deepEqual([u.state, u.counters], [a.completeness.state, a.completeness.counters], "op=reading and unitsOf agree");
  const job = jobs.rows().find((x) => x.kind === "ocr" && x.sha === d);
  assert.ok(job, "the 6 pages are owed as an ocr job");
  for (let n = 0; n < 5; n++) { const p = await w.x.readHeld({ sha: d, kind: "ocr", env, registerJob: jobs.registerJob, armJobs: jobs.armJobs }); if (!p.owed) break; }
  const done = viaOp(w, d);
  assert.deepEqual([done.completeness.state, done.completeness.counters.owed, "owed" in done.completeness], ["whole", 0, false]);
  assert.equal(w.x.unitsOf(d).state, "whole");
  assert.equal(fts(w, "mark29"), 1, "the last page's OCR words are found");
});

test("R100 (G128a; the 250-page mixed file at 25 pages): a PDF with 10 scanned pages and no OCR member is `partial` with 10 owed, never `whole`", async () => {
  const { bytes } = await pdfOf({ size: { pages: 25, lines: 1 }, kinds: ["text", "text", "text", "scan", "scan"] });
  const { w, d } = await home(bytes, { ct: "application/pdf", format: "pdf" });
  await readAll(w, d);
  const a = viaOp(w, d);
  assert.equal(a.completeness.state, "partial");
  assert.equal(a.completeness.counters.owed, 10);
  assert.equal(w.x.unitsOf(d).state, "partial");
});

test("R100 (G128b; SCAN C11): a text page with an unread picture (the reader's `pictures_unread`) is `partial` with the picture owed", () => {
  const w = fresh(); bundle(w.s, "B-1");
  const S = "7".repeat(64);
  w.core.transact(() => w.x.writeReading({ bundleId: "B-1", captureSha: S, composed: true,
    reading: { found: false, entities: [], content_type: "generic", text_container: "pdf", page_count: 1, pictures_unread: 1, basis: "b", at: "2026-10-24T00:00:00Z", text_source: null },
    textUnits: [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "A table of figures, below", seq: 0 }] }));
  const c = w.x.readingFor(S, "class:admin").completeness;
  assert.deepEqual([c.state, c.counters.owed, c.owed.pictures], ["partial", 1, 1]);
});

test("R100 (control): a fully read text is `whole`, counted from its counters: nothing skipped, owed or failed", async () => {
  const { w, d } = await home(textOf(20), { fromText: true });
  await readAll(w, d);
  const c = viaOp(w, d).completeness;
  assert.deepEqual([c.state, c.counters.skipped, c.counters.owed, c.counters.failed], ["whole", 0, 0, 0]);
});

/* ---------------------------------------------------------------------------------------------------- R107: a stored unit has a kind */

test("R107 (G134d; DOCS O4's comment part): a .docx comment read by the real reader is stored with `kind` `comment`, answered by `unitsOf`, `op=reading`'s `text_units` and `capture_text`; a body paragraph is `body` (control)", async () => {
  const comments = '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="1"><w:p><w:r><w:t>REVIEWERNOTE the figure is wrong</w:t></w:r></w:p></w:comment></w:comments>';
  const { w, d } = await home(F.docx({ body: F.wp(F.wr("Body paragraph of the minutes")), comments }), { ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", format: "docx" });
  await readAll(w, d);
  const byText = (list, t) => list.find((u) => u.text.includes(t));
  assert.equal(byText(w.x.unitsOf(d).units, "REVIEWERNOTE").kind, "comment");
  assert.equal(byText(w.x.unitsOf(d).units, "Body paragraph").kind, "body");
  assert.equal(byText(viaOp(w, d).text_units, "REVIEWERNOTE").kind, "comment");
  assert.equal(w.one(`SELECT kind FROM capture_text WHERE capture_sha=? AND text LIKE 'REVIEWERNOTE%'`, d).kind, "comment");
  assert.equal(fts(w, "REVIEWERNOTE"), 1, "found by search");
});

test("R107 (G128h; SHEET J-10): a CSV's first, middle and last marks are found, and the unit holding each states the row of each of its lines (`lineRows`), so the hit's extent names the mark's row", { timeout: 120_000 }, async () => {
  const rows = lines(3000, (i) => `${i},name ${i},${(i * 7) % 1000}`);
  const marks = { 1: "FIRSTMARK", 1500: "MIDDLEMARK", 3000: "LASTMARK" };
  for (const [r, m] of Object.entries(marks)) rows[Number(r) - 1] = `${m},marked row,${r}`;
  const csv = ["id,name,amount", ...rows].join("\n") + "\n";
  const { w, d } = await home(csv, { ct: "text/csv", format: "csv" });
  await readAll(w, d);
  const all = [];
  for (let page = w.x.unitsOf(d); ; page = w.x.unitsOf(d, { after: page.next })) { all.push(...page.units); if (page.next == null) break; }
  for (const [row, m] of Object.entries(marks)) {
    assert.equal(fts(w, m), 1, `${m} is found`);
    const unit = all.find((u) => u.text.includes(m));
    assert.ok(Array.isArray(unit.lineRows), `the unit holding ${m} states its rows`);
    const at = unit.text.split("\n").findIndex((l) => l.includes(m));
    assert.equal(unit.lineRows[at], Number(row) + 1, `${m} is on row ${Number(row) + 1} (the header is row 1)`);
  }
});

test("R107 (control): a unit stored with no kind (an old unit, or a producer that names none) answers `kind` null, never a guess", () => {
  const w = fresh(); bundle(w.s, "B-1");
  const S = "6".repeat(64);
  w.x.indexUnits("B-1", S, [{ extent: { kind: "document" }, text: "no kind named", seq: 0 }], null);
  assert.equal(w.x.unitsOf(S).units[0].kind, null);
  /* (G128h) a sheet block's per-cell `undetermined` list is stored with its unit and answered with it */
  const und = [{ cell: "B7", reason: "undecodable" }];
  w.x.indexUnits("B-1", S, [{ extent: { kind: "sheet-range", sheet: "S", range: "A1:B9" }, text: "a\tb", seq: 0, kind: "body", lineRows: [1], undetermined: und }], null);
  const u = w.x.unitsOf(S).units[0];
  assert.deepEqual([u.kind, u.lineRows, u.undetermined], ["body", [1], und]);
});

/* ---------------------------------------------------------------------------------------------------- R24: the whole old set */

test("R24 (G128f): a listener is handed the capture's whole old set of units, never cut at the first 4,096, page by page (each page at most 4,096), with the old index state", () => {
  const w = fresh(); bundle(w.s, "B-1");
  const S = "5".repeat(64);
  const many = lines(CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 10, (i) => ({ extent: { kind: "doc-para", para: i, run: null }, text: `old ${i}`, seq: i }));
  w.core.transact(() => w.x.writeReading({ bundleId: "B-1", captureSha: S, reading: { found: false, entities: [], basis: "b", at: "t", text_source: null }, textUnits: many, composed: true }));
  let got = null;
  w.x.onReading("content", (e) => { got = e.unitsBefore; return {}; });
  w.core.transact(() => w.x.writeReading({ bundleId: "B-1", captureSha: S, reading: { found: false, entities: [], basis: "c", at: "t", text_source: null }, textUnits: [many[0]], composed: true }));
  assert.equal(got.length, CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 10, "every old unit");
  assert.equal(got[got.length - 1].text, `old ${CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 9}`);
  assert.deepEqual(got.pages.map((p) => p.length), [CAPTURE_TEXT_CAPTURE_UNIT_BOUND, 10]);
  assert.deepEqual([got.units === got, got.state], [true, "whole"], "R36's shape too");
});

/* ---------------------------------------------------------------------------------------------------- G128c: the stored PDF reading is completed */

test("G128c (R57's extraction half; red.mjs N3, PDF A1, I6): the 33-page agenda read in page ranges by the ledger stores the whole read's title, page boxes, image placements, glyphs and words", { timeout: 120_000 }, async () => {
  const bytes = new Uint8Array(readFileSync(new URL("../../fixtures/legistar-agenda-1425405.pdf", import.meta.url)));
  const reader = (dd, o) => readDocument(dd, o.cursor !== undefined ? { ...o, rangePages: 10 } : o);
  const { w, d, document } = await home(bytes, { ct: "application/pdf", format: "pdf", reader });
  await readAll(w, d);
  const stored = JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
  const whole = (await readDocument(document, { evidence: w.core.evidenceStore(), env: {}, unitsBudget: Infinity })).reading;
  for (const k of ["title", "page_count", "page_boxes", "text_glyphs", "words_total"]) assert.deepEqual(stored[k], whole[k], k);
  assert.deepEqual(stored.container_extent.images, whole.container_extent.images, "image placements");
});

/* ---------------------------------------------------------------------------------------------------- R105 (b): the old shapes */

/* A stored reading put in one of the old shapes: what the writer before this round stored, made here from a fresh reading by the edits that writer's
   output differed by (its reading had no shape stamp; N15 cut a unit at 131,072 characters and marked it; N22 stood as a statement with no units; N3
   lacked the whole file's glyphs and words; S2 still owed OCR pages). */
async function oldShape(kind) {
  if (kind === "cut_units") {
    const long = "w ".repeat(150_000) + "TAILWORD";
    const h = await home(long, { fromText: true });
    await readAll(h.w, h.d);
    h.w.s.sql.exec(`DELETE FROM capture_text WHERE capture_sha=? AND seq > 0`, h.d);
    h.w.s.sql.exec(`UPDATE capture_text SET text=substr(text, 1, 131072), truncated=1 WHERE capture_sha=?`, h.d);
    return h;
  }
  if (kind === "stated_bare") {
    const h = await home(textOf(10), { fromText: true });
    await readAll(h.w, h.d);
    h.w.s.sql.exec(`UPDATE readings SET reading=json_set(reading, '$.too_large', json('{"bytes":2000000,"key":"cells","key_bytes":1900000,"limit":1048576}'), '$.found', json('false'), '$.failure', 'final') WHERE capture_sha=?`, h.d);
    h.w.s.sql.exec(`DELETE FROM capture_text WHERE capture_sha=?`, h.d);
    return h;
  }
  if (kind === "first_range") {
    const { bytes } = await pdfOf({ size: { pages: 4, lines: 1 }, kinds: ["text"] });
    const h = await home(bytes, { ct: "application/pdf", format: "pdf" });
    await readAll(h.w, h.d);
    h.w.s.sql.exec(`UPDATE readings SET reading=json_remove(reading, '$.text_glyphs', '$.words_total') WHERE capture_sha=?`, h.d);
    return h;
  }
  const { bytes } = await pdfOf({ size: { pages: 3, lines: 1 }, kinds: ["scan"] });
  const h = await home(bytes, { ct: "application/pdf", format: "pdf" });
  await readAll(h.w, h.d);
  return h;
}

test("R105 (b) (G128j): a stored reading in each old shape is re-registered as a reading job, counted by shape; a second run changes nothing; the job's re-read gives the new shape, units and completeness of a fresh read", { timeout: 120_000 }, async () => {
  for (const kind of ["cut_units", "stated_bare", "first_range", "pages_unread"]) {
    const h = await oldShape(kind);
    h.w.s.sql.exec(`UPDATE readings SET reading_shape=NULL WHERE capture_sha=?`, h.d);
    const jobs = jobRegistrarStub();
    h.w.x.registerOwe(jobs.registerJob);
    const out = await h.w.x.migrateReadings();
    assert.deepEqual([out.done, out.registered, out.shapes[kind]], [true, 1, 1], `${kind}: ${JSON.stringify(out)}`);
    assert.deepEqual(jobs.rows().map((r) => [r.kind, r.sha]), [["reading", h.d]]);
    const again = await h.w.x.migrateReadings();
    assert.deepEqual([again.done, again.registered, again.examined], [true, 0, 0], `${kind}: a second run changes nothing`);
    /* the ledger reads the job: the reading is read again to the new shape */
    await readAll(h.w, h.d, { registerJob: jobs.registerJob, armJobs: jobs.armJobs });
    assert.equal(h.w.one(`SELECT reading_shape FROM readings WHERE capture_sha=?`, h.d).reading_shape, READING_SHAPE, kind);
    const fresh2 = await home(h.bytes, { ct: h.document.capture.content_type, format: h.document.profile.format.format, fromText: h.document.profile.profiled_from_text });
    await readAll(fresh2.w, fresh2.d);
    const unitsOf = (x, s) => x.rows(`SELECT extent, text, truncated, kind FROM capture_text WHERE capture_sha=? ORDER BY seq`, s).map((r) => ({ ...r }));
    assert.deepEqual(unitsOf(h.w, h.d), unitsOf(fresh2.w, fresh2.d), `${kind}: units equal a fresh read's`);
    assert.deepEqual(viaOp(h.w, h.d).completeness.state, viaOp(fresh2.w, fresh2.d).completeness.state, `${kind}: completeness equals a fresh read's`);
  }
});

test("R105 (b) (control): a reading under the current shape is left; a registrar that refuses stops the step where it was, the reading not counted", async () => {
  const h = await home(textOf(10), { fromText: true });
  await readAll(h.w, h.d);
  const jobs = jobRegistrarStub();
  h.w.x.registerOwe(jobs.registerJob);
  const out = await h.w.x.migrateReadings();
  assert.deepEqual([out.done, out.registered], [true, 0]);
  const old = await oldShape("cut_units");
  old.w.s.sql.exec(`UPDATE readings SET reading_shape=NULL WHERE capture_sha=?`, old.d);
  old.w.x.registerOwe(() => ({ ok: false, reason: "JOB_TABLE_FULL" }));
  const refused = await old.w.x.migrateReadings();
  assert.deepEqual([refused.done, refused.registered, refused.refused], [false, 0, "JOB_TABLE_FULL"]);
});

/* ---------------------------------------------------------------------------------------------------- G128d, G134d: every chunk and every part under its own address */

test("R22 R99 (G128d; DOCS T5): a 300,009-character single line, chunked by the reader into consecutive units, is stored whole in its chunks and found at its last word", { timeout: 120_000 }, async () => {
  const line = "council ".repeat(37_500) + "LASTWORDMARK";
  assert.equal(line.length, 300_012);
  const { w, d } = await home(line, { fromText: true });
  await readAll(w, d);
  assert.equal(fts(w, "LASTWORDMARK"), 1, "the last word is found");
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.counts.written > 1, st.counts.unaddressable, st.counts.truncated, st.state], [true, 0, 0, "whole"], "every chunk stored, none cut, none dropped");
  assert.equal(w.one(`SELECT sum(length(text)) n FROM capture_text WHERE capture_sha=?`, d).n >= line.length, true);
});

test("R22 R99 (G128d; PDF A10, red.mjs N15): a PDF page of 300,000 characters is stored in its chunks and its last line is found (text-chain's `run` in the address, job 63, K4913)", { timeout: 120_000 }, async () => {
  const { g, bytes } = await pdfOf({ size: { pages: 3, lines: 2 }, kinds: ["text"], heavy: { page: 2, lines: 9000 } });
  const { w, d } = await home(bytes, { ct: "application/pdf", format: "pdf" });
  await readAll(w, d);
  const heavy = g.truth.page(2).lines;
  assert.ok(heavy.join("\n").length > 131_072, "the page is over the unit cap");
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.counts.unaddressable, st.state], [0, "whole"], "no chunk lost as an address already written");
  assert.equal(fts(w, heavy[heavy.length - 1].split(" ")[0]), 1, "the heavy page's last line is found");
});

test("R107 (G134d; DOCS O4): two comments of one .docx, each anchored in the body, are each stored under its own address with `kind` `comment`; red by name until office-readers names each comment part's `ref` (it emits `ref: null` for every comment, so two share one `doc-part` address; text-chain's arm, job 63, is merged)", async () => {
  const comments = '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:comment w:id="1"><w:p><w:r><w:t>FIRSTCOMMENT one</w:t></w:r></w:p></w:comment><w:comment w:id="2"><w:p><w:r><w:t>SECONDCOMMENT two</w:t></w:r></w:p></w:comment></w:comments>';
  /* each comment anchored in the body (`w:commentReference`), as a document that has comments holds them, so each part has its own reference */
  const anchored = F.wp(F.wr("Body one"), '<w:r><w:commentReference w:id="1"/></w:r>') + F.wp(F.wr("Body two"), '<w:r><w:commentReference w:id="2"/></w:r>');
  const { w, d } = await home(F.docx({ body: anchored, comments }), { ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", format: "docx" });
  await readAll(w, d);
  assert.equal(fts(w, "FIRSTCOMMENT"), 1);
  assert.equal(fts(w, "SECONDCOMMENT"), 1, "the second part is stored, not counted as an address already written");
  assert.deepEqual(w.rows(`SELECT kind FROM capture_text WHERE capture_sha=? AND kind='comment'`, d).length, 2);
});

/* ---------------------------------------------------------------------------------------------------- R108: how far each reading is read */

test("R108 (G135f; K4922): `progressOf` answers each capture's state, R90's figures and what it owes, loading no unit: a scan with pages owed is `partial` with `owed > 0`, a whole text `whole` with `owed: 0`, an unknown sha `none`", { timeout: 120_000 }, async () => {
  const { bytes } = await pdfOf({ size: { pages: 30, lines: 1 }, kinds: ["scan"] });
  const scan = await home(bytes, { ct: "application/pdf", format: "pdf" });
  const jobs = jobRegistrarStub();
  await scan.w.x.readHeld({ sha: scan.d, kind: "reading", env: { OCR_WORKER: ocrOnePage() }, registerJob: jobs.registerJob, armJobs: jobs.armJobs });
  const unknown = "4".repeat(64);
  /* a capture's units are never read for it: a query of `capture_text`'s text would show here */
  const seen = [];
  const exec = scan.w.s.sql.exec.bind(scan.w.s.sql);
  scan.w.s.sql.exec = (q, ...a) => { seen.push(q); return exec(q, ...a); };
  const p = scan.w.x.progressOf([scan.d, unknown]);
  scan.w.s.sql.exec = exec;
  assert.deepEqual([p[scan.d].state, p[scan.d].owed], ["partial", 6]);
  assert.deepEqual(p[unknown], { state: "none", read_through: null, total: null, owed: 0 });
  assert.equal(seen.some((q) => /SELECT[^;]*\btext\b[^;]*FROM capture_text\b/i.test(q) && !/count|length/i.test(q)), false, "no unit's text is loaded");
  const text = await home(textOf(20), { fromText: true });
  await readAll(text.w, text.d);
  assert.deepEqual(text.w.x.progressOf([text.d])[text.d], { state: "whole", read_through: null, total: null, owed: 0 });
  /* while more follows, R90's figures */
  const big = await home(textOf(32_000), { fromText: true });
  const first = await big.w.x.readHeld({ sha: big.d, kind: "reading" });
  const mid = big.w.x.progressOf([big.d])[big.d];
  assert.deepEqual([mid.state, mid.read_through, mid.total], ["partial", first.detail.read_through, first.detail.total]);
  /* at most 500 a call */
  assert.equal(Object.keys(text.w.x.progressOf(Array.from({ length: 600 }, (_, i) => i.toString(16).padStart(64, "0")))).length, 500);
});
