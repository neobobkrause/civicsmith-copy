/* extraction, R82 (T51 fix round 4b, F4, F8, F9, F12; K4487; amends R80, R22, R35, R66, R68; reading-pipeline R37; plane R77):
   a transient failure is read again; nothing read is cut short. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, bucket, member, withEntry, i2, noText, ocrAnswer, doc, sha, pressThenPass, homesOver } from "./fixture.mjs";
import { wp, wr, wtbl, box, docx, bucket as _b } from "./fixture.mjs";
import { textUnitsFor, layerChainFor, readingProvenance } from "../../../src/reading-pipeline/index.mjs";
import { glyphCount } from "../../../src/textchain.mjs";
import { memberRefusal } from "../../../../ocr-worker/test/fixtures.mjs";

/* the real OCR member declining a page whose pixels it cannot read, a final decline (its published fixture, K5044) */
const PIXELS_UNREADABLE = await memberRefusal("PIXELS_UNREADABLE");

const pdf = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const register = (rows) => homesOver(rows);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const readingOf = (w, d) => JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);

/* A store whose register names INFO-1 the home of a PDF whose whole is held and which has no reading yet. */
async function held({ env = {} } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, env, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a packet " + Math.random());
  const d = await hold(evidence, bytes);
  rows.set(d, row("INFO-1", bytes.length));
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (bundleId, path) => (bundleId === "INFO-1" && path === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, rows, evidence, bytes, d };
}

/* 400 pages of about 2.5 KB each (1 MB of text): past the acquire answer's 512 KiB and inside the index's own 2 MiB. */
const PAGES = 400;
const filler = "budget appropriation fund transfer revenue estimate outlay authority ".repeat(34);
const bigText = () => i2(Array.from({ length: PAGES }, (_, p) => ({ page: p, text: `pageword${p}x ${filler}` })));

test("R82 R22 seam (needs reading-pipeline R37's `budget` option) (F8): a 400-page text PDF read by `readHeld` has every page indexed and findable; the acquire answer still carries its budget's share", async () => {
  const { w, d } = await held();
  const r = await withEntry(pdf(bigText()), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read], [true, true]);
  const u = w.x.unitsOf(d);
  assert.equal(u.state, "whole", "every offered unit was written");
  assert.equal(u.units.length, PAGES);
  for (const p of [0, 199, 399])
    assert.equal(w.one(`SELECT count(*) c FROM capture_text_fts WHERE capture_text_fts MATCH ?`, `pageword${p}x`).c, 1, `page ${p} is findable`);
  assert.equal(w.x.readingFor(d, "class:admin").text_units.length, PAGES);
  const rd = readingOf(w, d);
  assert.equal(rd.words_read, rd.words_total, "the reading says it read every word");
  /* control: the wire the acquire answer rides on keeps its budget */
  const wire = await withEntry(pdf(bigText()), () => w.x.read(doc({ digest: d, bytes: 20, ct: "application/pdf", format: "pdf" }), {}));
  assert.ok(wire.text_units_over_bound > 0, "op=acquire's wire answer is still cut at its budget");
});

test("R82 R22 seam (needs reading-pipeline R37's `budget` option) (F8): the re-read and the transcription index every page too", async () => {
  const t = i2(Array.from({ length: PAGES }, (_, p) => ({ page: p, text: p === 0 ? "" : `pageword${p}x ${filler}`, undetermined: p === 0 ? [noText(0)] : [] })));
  const { w, d } = await held();
  await withEntry(pdf(t), () => w.x.readHeld({ sha: d }));
  const ocr = member((b) => ocrAnswer(b.pages));
  const { x } = await pressThenPass(w, d, { OCR_WORKER: ocr });
  assert.equal(x.written, true);
  assert.equal(w.x.unitsOf(d).units.length, PAGES, "every page of the re-read is indexed");
});

/* ---- F4: a transient failed reading is replaced ---- */

/* The failed reading `read` made when the store failed once, stored with its mark (reading-pipeline R37 marks it). */
async function failedWith(failure) {
  const f = await held();
  const failed = { content_type: null, reader_version: null, read_from_text: false, found: false, entities: [], facts: {}, at: "2026-09-27T00:00:00Z",
    text_source: null, text_tier: null, text_container: null, basis: "the reading could not be composed (store read error)",
    ...(failure ? { failure } : {}) };
  f.w.x.writeReading({ bundleId: "INFO-1", captureSha: f.d, reading: failed, composed: true });
  return f;
}
const TEXT = i2([{ page: 0, text: "alpha beta gamma delta" }]);

test("R82 R80 (F4): a failed reading marked transient is replaced by `readHeld` once; the answer reads written, and a second call changes nothing", async () => {
  const { w, d } = await failedWith("transient");
  const hist = count(w, "reading_history", d);
  const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read], [true, true]);
  assert.notEqual(r.owed, true, "a reading with text owes nothing");
  assert.equal(readingOf(w, d).failure, undefined, "the replacement is no failed reading");
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/);
  assert.equal(count(w, "readings", d), 1, "replaced in place");
  assert.ok(count(w, "reading_history", d) > hist, "R23: the failed reading is kept in the history");
  const again = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"]);
});

test("R82 R80 R45 (F4 control): a failed reading marked final, one with no mark, and a reading with text are not replaced", async () => {
  for (const failure of ["final", null]) {
    const { w, d } = await failedWith(failure);
    const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
    const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
    assert.deepEqual([r.read, r.why], [false, "READING_HELD"], `failure ${failure}`);
    assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  }
  const { w, d } = await held();
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: { found: true, failure: "transient", basis: "x", entities: [] }, composed: true });
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  assert.equal((await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }))).read, false, "a reading that found text is never replaced, whatever it carries");
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
});

test("R82 R80 R101 (fix round 9, K4896; reading-pipeline R37, G133c): an entry that throws on the file's own bytes is a deterministic failure: the reading is `final` with its reason, not `transient`, so it is not owed and a later call does not replace it", async () => {
  const { w, d } = await failedWith("transient");
  let n = 0;
  const flaky = { format: "pdf", structure: async () => { if (n++ === 0) throw new Error("bad xref in the file"); return { ok: true, text: structuredClone(TEXT), pages: 1, notes: [] }; } };
  const first = await withEntry(flaky, () => w.x.readHeld({ sha: d }));
  assert.equal(first.read, true);
  assert.equal(first.owed, undefined, "a deterministic failure owes nothing");
  assert.equal(readingOf(w, d).failure, "final");
  const second = await withEntry(flaky, () => w.x.readHeld({ sha: d }));
  assert.deepEqual([second.read, second.why], [false, "READING_HELD"], "a final reading is not read again");
});

/* R-SEAM: needs reading-pipeline R37 (cause-reading-4), which marks the failure. Red by name until it is merged. */
test("R82 R80 seam (needs reading-pipeline R37): the store fails once during the first `readHeld`; the alarm after reads the document", async () => {
  const { w, evidence, d } = await held();
  const get = evidence.get.bind(evidence);
  let throws = 1;
  evidence.get = async (k) => { if (throws-- > 0) throw new Error("R2 read error"); return get(k); };
  const first = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.equal(first.read, true);
  assert.equal(first.owed, true, "a transient failure is owed");
  assert.equal(readingOf(w, d).failure, "transient");
  const second = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([second.read, second.owed === true], [true, false]);
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /alpha beta/);
});

/* ---- F9: the ocr entry continues from its cursor ---- */

/* An OCR member as the real one: one page per call, the rest named in `deferred`. */
const perPage = (log = []) => member((b) => {
  const [first, ...rest] = b.pages;
  log.push(b.pages.length);
  return { ...ocrAnswer([first]), deferred: rest };
});
const SCAN = (n) => i2(Array.from({ length: n }, (_, p) => ({ page: p, text: "", undetermined: [noText(p)] })));
const unread = (w, d) => w.x.readingFor(d, "class:admin").unread_pages.length;

test("R82 R35 R103 (F9; fix round 9, G126b): a 60-page scan read inside a member's request makes no OCR call and owes every page; `readHeld` with kind ocr (the ledger) then reads 24 pages a pass from the pages read until none are left", async () => {
  const log = [];
  const { w, d } = await held({ env: { OCR_WORKER: perPage(log) } });
  const run = (opts = {}) => withEntry(pdf(SCAN(60)), () => w.x.readHeld({ sha: d, env: w.env, ...opts }));
  const first = await run();
  assert.deepEqual([first.read, first.owed], [true, true], "nothing OCR'd in the request, every page owed");
  assert.equal(log.length, 0, "no call to the OCR member inside the request");
  assert.equal(unread(w, d), 60);
  for (const left of [36, 12]) {
    const pass = await run({ kind: "ocr" });
    assert.deepEqual([pass.read, pass.owed], [true, true]);
    assert.equal(unread(w, d), left);
  }
  const third = await run({ kind: "ocr" });
  assert.deepEqual([third.read, third.owed === true], [true, false], "the last pass ends the entry");
  assert.equal(unread(w, d), 0);
  assert.equal(w.x.unitsOf(d).units.length, 60, "every page is indexed");
  const after = await run({ kind: "ocr" });
  assert.deepEqual([after.read, after.owed === true], [false, false], "nothing left: nothing asked, nothing owed");
  assert.equal(log.length > 0 && Math.max(...log) <= 60, true);
});

test("R82 R35 (F9): an OCR member that is down leaves the entry owed; one that declines the pages ends it, stated", async () => {
  const down = await held({ env: { OCR_WORKER: member(() => ({ status: 503, body: { ok: false } })) } });
  await withEntry(pdf(SCAN(3)), () => down.w.x.readHeld({ sha: down.d, env: down.w.env }));
  const a = await withEntry(pdf(SCAN(3)), () => down.w.x.readHeld({ sha: down.d, env: down.w.env, kind: "ocr" }));
  assert.deepEqual([a.read, a.owed], [false, true], "a member that answers 503 is a transient cause");
  assert.equal(typeof a.why, "string");
  const declines = await held({ env: { OCR_WORKER: member(() => PIXELS_UNREADABLE) } });
  await withEntry(pdf(SCAN(3)), () => declines.w.x.readHeld({ sha: declines.d, env: declines.w.env }));
  const b = await withEntry(pdf(SCAN(3)), () => declines.w.x.readHeld({ sha: declines.d, env: declines.w.env, kind: "ocr" }));
  assert.deepEqual([b.read, b.owed === true], [false, false], "pages the member declines are the document's own: final");
  assert.equal(typeof b.why, "string");
  const none = await held({ env: {} });
  await withEntry(pdf(SCAN(3)), () => none.w.x.readHeld({ sha: none.d }));
  const c = await withEntry(pdf(SCAN(3)), () => none.w.x.readHeld({ sha: none.d, kind: "ocr" }));
  assert.deepEqual([c.read, c.owed === true], [false, false], "no OCR member is bound: nothing the entry can do");
});

test("R82 R35 (F9 control): `kind: ocr` on a reading with no page left, or a digest with no home or no whole, writes nothing", async () => {
  const { w, d } = await held({ env: { OCR_WORKER: perPage() } });
  await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d, env: w.env }));
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const hist = count(w, "reading_history", d);
  const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d, env: w.env, kind: "ocr" }));
  assert.deepEqual([r.ok, r.read, r.owed === true], [true, false, false]);
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  assert.equal(count(w, "reading_history", d), hist);
  const loose = await hold(w.evidence, "bytes nobody registered");
  assert.deepEqual((await w.x.readHeld({ sha: loose, kind: "ocr" })).why, "NO_HOME");
});

/* ---- F12: a migration's skipped candidate is re-queued ---- */

/* n26's own fixture (n26.test.mjs): a .docx whose text box repeats its paragraph in a Fallback branch; the stored
   reading is the pre-N26 walk's, numbered with the duplicate counted, over bytes the store does not hold yet. */
const BODY = wp(wr("before ")) + box([wp(wr("boxed"))]) + wp(wr("next"));
const OLD_PARAS = ["before ", "boxed", "boxed", "next"];
const AT = "2026-09-01T00:00:00Z";
async function oldReading() {
  const paragraphs = OLD_PARAS.map((text, para) => ({ para, ref: `¶${para + 1}`, text }));
  const document = OLD_PARAS.join("\n");
  const text = { ok: true, container: "docx", document, paragraphs, tables: [], undetermined: [], counts: { chars: document.length, undetermined: 0 } };
  const chain = layerChainFor(text, { tier: 1, container: "docx" });
  return { text, reading: {
    content_type: "doc", reader_version: 1, read_from_text: true, found: false, at: AT, entities: [], facts: {},
    text_source: chain, text_tier: 1, text_container: "docx", basis: "read by the doc reader", position_parts: 0, position_why: null,
    page_count: null, page_boxes: null,
    container_extent: { container: "docx", levels: ["paragraphs", "tables"], sheets: null, paragraphs: 4, slides: null, tables: [] },
    provenance: await readingProvenance({ text, chain, tier: 1, container: "docx" }),
    text_chars: document.length, text_glyphs: glyphCount(document), text_undetermined: 0 } };
}

test("R82 R66 (F12): a candidate whose bytes are not held is re-queued, not passed by the cursor; once held, the next run migrates it", async () => {
  const evidence = bucket();
  const f = fresh({ evidence });
  bundle(f.s, "INFO-1");
  const bytes = docx(BODY);
  const d = sha(bytes);
  const { text, reading } = await oldReading();
  f.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading, textUnits: textUnitsFor(text).textUnits, profileFormat: "docx", composed: true });
  const first = await f.x.migrateDocxReadings();
  assert.match(first.skipped[0].why, /not held/);
  assert.equal(first.done, false, "the migration is not finished while a candidate waits");
  await evidence.put(`bio/captures/${d}`, bytes);
  const second = await f.x.migrateDocxReadings();
  assert.deepEqual(second.migrated.map((m) => m.capture_sha), [d], "the waiting candidate is migrated once its bytes are held");
  assert.equal(second.done, true);
  const third = await f.x.migrateDocxReadings();
  assert.deepEqual([third.examined, third.migrated.length, third.done], [0, 0, true]);
});

test("R82 R66 (F12 control): a candidate left for a reason of its own (already migrated, unmoved) is not re-queued", async () => {
  const evidence = bucket();
  const f = fresh({ evidence });
  bundle(f.s, "INFO-1");
  const bytes = docx(wp(wr("plain")) + wp(wr("text")));
  const d = await hold(evidence, bytes);
  const r = await f.x.read({ ...{ capture: { sha256: d, bytes: bytes.length, content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", transport: { http_headers: [] } },
    profile: { format: { format: "docx" } }, retrieved: AT } });
  f.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx", composed: true });
  const out = await f.x.migrateDocxReadings();
  assert.equal(out.done, true, "nothing waits: a docx with no branch is unmoved, which is final");
});

test("R82 R66 R68 (F12, R-OLD): a migration that finished before this requirement, having passed a candidate whose bytes were not held, scans again once at the next start", async () => {
  const evidence = bucket();
  const f = fresh({ evidence });
  bundle(f.s, "INFO-1");
  const bytes = docx(BODY);
  const d = sha(bytes);
  const { text, reading } = await oldReading();
  f.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading, textUnits: textUnitsFor(text).textUnits, profileFormat: "docx", composed: true });
  /* the old code's state: the migration done, the cursor past the candidate, no scan-again mark */
  f.s.sql.exec(`UPDATE reading_migrations SET done=1, after=?, rescan=NULL`, d);
  await evidence.put(`bio/captures/${d}`, bytes);
  const x = await restartOver(f);
  assert.equal(x.readingFor(d).reading.migrated.n26 !== undefined, true, "the candidate passed by the old cursor is migrated");
  const again = await restartOver(f);
  assert.equal(again.readingFor(d).reading.migrated.n26 !== undefined, true);
  assert.equal(f.one(`SELECT rescan FROM reading_migrations WHERE migration='n26-docx'`).rescan, 1, "scanned again once, and marked");
});

/* The object restarting over the same storage (n26.test.mjs's own helper): migrate() takes or keeps each migration's row. */
async function restartOver(w) {
  const { Extraction } = await import("../../../src/extraction/index.mjs");
  const record = { evidenceStore: () => w.core.evidenceStore(), transact: (fn) => w.core.transact(fn), readFile: () => null };
  const waited = [];
  const x = new Extraction(w.s, { record, membership: w.membership, env: {}, host: { waitUntil: (p) => waited.push(p) } });
  x.migrate();
  await Promise.all(waited);
  return x;
}

test("R82 R37 (G172): the ledger's first `reading` pass over a scan whose page the OCR member refuses from its header ends final and owes nothing; a member answering transiently still owes", async () => {
  // fixtures-contract: store-assembly job-registrar
  const registerJob = async () => ({ ok: true }), armJobs = async () => {};
  const refuses = await held({ env: { OCR_WORKER: member(() => ({ ok: false, reason: "IMAGE_TOO_LARGE" })) } });
  const a = await withEntry(pdf(SCAN(1)), () => refuses.w.x.readHeld({ sha: refuses.d, env: refuses.w.env, kind: "reading", registerJob, armJobs }));
  assert.equal(a.read, true);
  assert.equal(readingOf(refuses.w, refuses.d).failure, "final", "the refusal ends the reading final");
  assert.notEqual(a.owed, true, "a reading that ended final owes nothing, an OCR member bound");
  /* control: a member that answers transiently leaves the page owed */
  const down = await held({ env: { OCR_WORKER: member(() => ({ status: 503, body: { ok: false } })) } });
  const b = await withEntry(pdf(SCAN(1)), () => down.w.x.readHeld({ sha: down.d, env: down.w.env, kind: "reading", registerJob, armJobs }));
  assert.equal(b.owed, true, "a transient answer is still owed");
});
