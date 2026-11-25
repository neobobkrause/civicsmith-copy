/* extraction R101 (fix round 9, G129b, G129c; CF-18): progress only forward; a failure is transient (retried, never written as an end) or deterministic
   (final, with its reason); a unit that kills its reader three times is stated for that unit alone and the read goes on. At the module's real entry,
   `readHeld`, as the plane's ledger calls it (one call a tick; `kind`, `killedPages` from the plane's attempt stamps in `job_unit_attempts`, `halfBudgetPages` for
   the one retry at half the budget), with the real reader for a text in pieces and a scripted OCR member for a scan. The corpus cases run here at the
   smallest size that shows the cause (PDF E7, SCAN E2, DOCS F1: the store failing at tick 2 of a text read in pieces; PDF E10, SCAN D12: the page that
   kills its reader); their full sizes are the corpus R set's. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, hold, member, i2, noText, ocrAnswer, pageUnits, homesOver } from "./fixture.mjs";
import { HALF_OCR_INVOCATIONS } from "../../../src/extraction/index.mjs";

const register = (rows) => homesOver(rows);
const LINES = 12000;
const text = () => Array.from({ length: LINES }, (_, i) => `line ${String(i).padStart(5, "0")} ` + "council-minutes ".repeat(5).padEnd(88, ".")).concat(["ENDMARKER"]).join("\n");

async function home(body) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode(body);
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "log.txt", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "undetermined", fromText: true });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, evidence };
}
const fts = (w, term) => w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH ?`, term).length;
const tick = (w, d, extra = {}) => w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {}, ...extra });

test("R101 (G129b; PDF E7, SCAN E2, DOCS F1): the store failing at tick 2 of a text read in pieces is transient: the tick reads nothing, keeps the cursor and stays owed; the next tick goes on, and the text is read whole to its last line", async () => {
  const { w, d, evidence } = await home(text());
  const first = await tick(w, d);
  assert.deepEqual([first.read, first.more], [true, true], JSON.stringify(first));
  const at = w.one(`SELECT cursor, read_through FROM capture_text_state WHERE capture_sha=?`, d);
  const get = evidence.get.bind(evidence);
  let fail = 1;
  evidence.get = async (k, o) => { if (fail-- > 0) throw new Error("R2 read error"); return get(k, o); };
  const second = await tick(w, d);
  assert.deepEqual([second.read, second.owed, second.why, second.more], [false, true, "TRANSIENT", undefined], JSON.stringify(second));
  assert.deepEqual({ ...w.one(`SELECT cursor, read_through, more FROM capture_text_state WHERE capture_sha=?`, d) }, { ...at, more: 1 }, "the cursor is kept; the read is not ended");
  assert.equal(w.x.readingFor(d, "class:admin").completeness.state, "partial");
  let a, n = 0;
  do { a = await tick(w, d); } while (a.more === true && ++n < 50);
  assert.equal(a.read, true);
  assert.equal(fts(w, "ENDMARKER"), 1, "R-STOP: the last line is found");
  assert.equal(w.x.unitsOf(d).state, "whole");
  assert.equal(w.x.readingFor(d, "class:admin").completeness.state, "whole");
});

test("R101 (G129b): a read in pieces whose next piece is refused ends stated, with its reason: the entry is final, the index partial and `completeness` says why, never `partial` without one", async () => {
  const { w, d } = await home(text());
  assert.equal((await tick(w, d)).more, true);
  w.s.sql.exec(`UPDATE capture_text_state SET cursor=? WHERE capture_sha=?`, "not-a-cursor-of-these-bytes", d);
  const end = await tick(w, d);
  assert.deepEqual([end.read, end.final], [false, true], JSON.stringify(end));
  const c = w.x.readingFor(d, "class:admin").completeness;
  assert.equal(c.state, "partial");
  assert.equal(typeof c.why, "string");
  assert.ok(c.why.length > 0, "the end says why");
  assert.equal(w.one(`SELECT more FROM capture_text_state WHERE capture_sha=?`, d).more, 0);
});

/* a scan whose stored reading leaves `n` pages to OCR */
async function scan(n) {
  const w = fresh();
  bundle(w.s, "B-1");
  const d = await hold(w.evidence, "%PDF-1.7 " + Math.random());
  const t = i2(Array.from({ length: n }, (_, p) => ({ page: p, text: "", undetermined: [noText(p)] })));
  w.x.writeReading({ bundleId: "B-1", captureSha: d, profileFormat: "pdf", textUnits: pageUnits(t), reading: { content_type: "generic", reader_version: 1,
    found: false, entities: [], facts: {}, at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: n, tier3_candidate: true } });
  return { w, d };
}
const allPages = () => member((b) => ocrAnswer(b.pages));

test("R101 (G129c; PDF E10, SCAN D12): a page the ledger states killed its reader three times is not asked: it is stated alone (`PAGE_KILLED_READER`, counted unread with its reason) and every other page is read; a later pass does not ask it again", async () => {
  const { w, d } = await scan(10);
  const ocr = allPages();
  const a = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr }, killedPages: [5] });
  assert.equal(a.read, true, JSON.stringify(a));
  assert.deepEqual(a.stated, [5]);
  assert.ok(!ocr.calls.flatMap((c) => c.body.pages).includes(5), "page 5 is not asked");
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual(got.unread_pages, [5], "the other nine pages are read");
  assert.deepEqual(got.reading.ocr_refused, [{ page: 5, reason: "PAGE_KILLED_READER" }]);
  const later = allPages();
  const b = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: later } });
  assert.deepEqual([b.read, b.why, later.calls.length], [false, "NO_PAGES_LEFT", 0], "the stated page is never asked again");
});

test("R101 (G129c; control): a page whose reader died twice and is then read is read, with no statement; the pass reports the pages whose call died, for the ledger's attempt stamps", async () => {
  const { w, d } = await scan(3);
  let dies = 2;
  const ocr = member((b) => (b.pages[0] === 1 && dies-- > 0 ? { status: 503, body: { ok: false } } : { ...ocrAnswer([b.pages[0]]), deferred: b.pages.slice(1) }));
  const a = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr } });
  assert.deepEqual([a.read, a.killed], [true, [1]], JSON.stringify(a));
  assert.equal(a.owed, true, "page 1 is still owed");
  const b = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr } });
  assert.deepEqual(b.killed, [1]);
  const c = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr } });
  assert.deepEqual([c.read, c.killed, c.stated], [true, undefined, undefined]);
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.unread_pages, got.reading.ocr_refused], [[], undefined]);
});

test("R101 R109 (G129c, G165): the one retry after two kills runs at half the budget: a page the plane names in `halfBudgetPages` makes the tick ask the OCR member at most half the calls of a tick", async () => {
  const { w, d } = await scan(40);
  const ocr = member((b) => ({ ...ocrAnswer([b.pages[0]]), deferred: b.pages.slice(1) }));
  await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr }, halfBudgetPages: [5] });
  assert.equal(ocr.calls.length, HALF_OCR_INVOCATIONS);
  const full = member((b) => ({ ...ocrAnswer([b.pages[0]]), deferred: b.pages.slice(1) }));
  await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: full } });
  assert.equal(full.calls.length, 2 * HALF_OCR_INVOCATIONS, "control: a tick's whole budget");
  const none = member((b) => ({ ...ocrAnswer([b.pages[0]]), deferred: b.pages.slice(1) }));
  const x = await scan(40);
  await x.w.x.readHeld({ sha: x.d, kind: "ocr", env: { OCR_WORKER: none }, halfBudgetPages: [] });
  assert.equal(none.calls.length, 2 * HALF_OCR_INVOCATIONS, "control: no page named, the whole budget");
});

test("R109 (G165): the plane's `stampUnit` reaches the reader: it is stamped with each page, before the OCR member is asked for it, in the order the pages are asked", async () => {
  const { w, d } = await scan(4);
  const order = [];
  const ocr = member((b) => { order.push(`ask${b.pages[0]}`); return { ...ocrAnswer([b.pages[0]]), deferred: b.pages.slice(1) }; });
  await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: ocr }, stampUnit: (u) => order.push(`stamp:${u}`) });
  assert.deepEqual(order.slice(0, 4), ["stamp:p0", "ask0", "stamp:p1", "ask1"], JSON.stringify(order));
  const bare = await scan(2);
  const r = await bare.w.x.readHeld({ sha: bare.d, kind: "ocr", env: { OCR_WORKER: allPages() } });
  assert.equal(r.read, true, "control: without `stampUnit` the reader behaves as before");
});

/* (K4904 (1); plan 2c item 8) reading-pipeline's `read` with `skipKilled` (job 40), a stand-in of its contract until it merges (R-SEAM): pieces of 3 units by
   a cursor `c<n>`; asked with `skipKilled` it reads nothing at the cursor and answers the next, `counters.skipped` 1, `stated: {cursor, why}`. Everything
   else is the real read. */
import { read as realRead } from "../../../src/reading-pipeline/index.mjs";
const WINDOWS = 4;
const windowed = (asked) => async (doc, o = {}) => {
  if (o.cursor === undefined) return realRead(doc, o);
  asked.push([o.cursor, o.skipKilled === true]);
  const i = o.cursor === null ? 0 : Number(String(o.cursor).slice(1));
  const next = i + 1 < WINDOWS ? `c${i + 1}` : null;
  const base = { more: next !== null, cursor: next, next, read_through: (i + 1) * 30, total: WINDOWS * 30, piece: { units: 0, words: 0 } };
  if (o.skipKilled === true) return { ...base, counters: { written: 0, skipped: 1, owed: 0, failed: 0 }, stated: { cursor: o.cursor, why: "UNIT_KILLED_READER" } };
  const units = [0, 1, 2].map((k) => ({ extent: { kind: "doc-para", para: i * 3 + k }, text: `window ${i} paragraph ${k} WIN${i}X`, seq: i * 3 + k }));
  return { ...base, text_units: units, piece: { units: 3, words: 12 }, counters: { written: 3, skipped: 0, owed: 0, failed: 0 },
           ...(o.cursor === null ? { reading: { content_type: "generic", found: false, entities: [], facts: {}, text_source: null, basis: "b", at: "t" } } : {}) };
};

test("R101 (G129c; K4904 (1); DOCS killAt): the window at the cursor the ledger states killed its reader three times (`killedCursor`) is stepped past with `skipKilled`, stated (`completeness.stated_units`, counted skipped) and the read goes on to the last window", async () => {
  const asked = [];
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows), reader: windowed(asked) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("a document read in windows " + Math.random());
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.docx", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "text", fromText: true });
  w.core.readFile = (b, p) => (p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  const first = await tick(w, d);
  assert.deepEqual([first.read, first.more], [true, true], JSON.stringify(first));
  assert.equal((await tick(w, d)).more, true, "window c1 read");
  const killed = await tick(w, d, { killedCursor: "c2" });
  assert.deepEqual([killed.read, killed.more, killed.stated], [true, true, { at: 60, why: "UNIT_KILLED_READER" }], JSON.stringify(killed));
  const last = await tick(w, d, { killedCursor: "c2" });
  assert.deepEqual([last.read, last.more, last.stated], [true, undefined, undefined], "the next window is read as any other");
  assert.deepEqual(asked.map(([c, s]) => [c, s]), [[null, false], ["c1", false], ["c2", true], ["c3", false]]);
  assert.deepEqual([fts(w, "WIN1X"), fts(w, "WIN2X"), fts(w, "WIN3X")], [3, 0, 3], "the stated window holds no unit; the others are read");
  const c = w.x.readingFor(d, "class:admin").completeness;
  assert.equal(c.state, "partial");
  assert.deepEqual(c.stated_units, [{ at: 60, why: "UNIT_KILLED_READER" }]);
  assert.equal(c.counts.skipped_named, 1);
});

test("R109 (G165): the plane's `stampUnit` reaches the reader of a text read in pieces as the same function, on the first piece and on a continuation; a tick given none hands none", async () => {
  const seen = [];
  const rows = new Map(), evidence = bucket();
  const spy = (rd) => async (doc, o = {}) => { seen.push(o.stampUnit); return rd(doc, o); };
  const inner = windowed([]);
  const w2 = fresh({ evidence, provenance: register(rows), reader: spy(inner) });
  bundle(w2.s, "INFO-1");
  const bytes = new TextEncoder().encode("a document read in windows " + Math.random());
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.docx", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "text", fromText: true });
  w2.core.readFile = (b, p) => (p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  const stamp = () => {};
  assert.equal((await tick(w2, d, { stampUnit: stamp })).more, true);
  assert.equal((await tick(w2, d, { stampUnit: stamp })).more, true);
  assert.equal((await tick(w2, d)).more, true);
  assert.deepEqual(seen.map((f) => f === stamp), [true, true, false], "the first piece and the continuation get the plane's function; a tick without one gets none");
  assert.equal(seen[2], undefined);
});

test("R101 (progress only forward): an OCR pass whose answered pages merge to no glyph has read nothing: it writes nothing and ends `NO_PROGRESS`, owing nothing, so the job never loops", async () => {
  const { w, d } = await scan(3);
  const empty = member((b) => ({ ...ocrAnswer(b.pages, { text: () => "   " }) }));
  const before = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const a = await w.x.readHeld({ sha: d, kind: "ocr", env: { OCR_WORKER: empty } });
  assert.deepEqual([a.read, a.owed, a.why, a.final], [false, undefined, "NO_PROGRESS", true], JSON.stringify(a));
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, before, "nothing written");
});
