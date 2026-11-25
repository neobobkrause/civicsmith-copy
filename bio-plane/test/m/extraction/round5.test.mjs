/* extraction, fix round 5 (T51; K4530; plan E1, E2, E3): `readHeld` offers the index only what it keeps (R83), states a capture over
   the reading ceiling with no whole held (R84), and reads once more a `final` "not read as text" reading whose held bytes now
   say what they are (R85). The readings are made by the real chain (`read`, then the promote projection), never written by
   hand; each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localize } from "../../../src/setup-words/index.mjs";
import { fresh, bundle, bucket, withEntry, i2, doc, sha, homesOver } from "./fixture.mjs";
import { CAPTURE_TEXT_CAPTURE_BOUND, extractionOps } from "../../../src/extraction/index.mjs";
import { WHOLE_READ_MAX } from "../../../src/reading-pipeline/index.mjs";

const MIB = 1024 * 1024;
const register = (rows) => homesOver(rows);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const readingOf = (w, d) => JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
const pdfEntry = (text) => ({ format: "pdf",
  detect: (b) => (b && b.length >= 5 && String.fromCharCode(...b.subarray(0, 5)) === "%PDF-" ? { format: "pdf", confidence: "certain", signals: [] } : null),
  structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const partsOf = (total, n) => Array.from({ length: n }, (_, i) =>
  ({ sha256: sha(`part ${i} ${total}`), bytes: i < n - 1 ? Math.floor(total / n) : total - Math.floor(total / n) * (n - 1) }));

/* A store whose register names INFO-1 the home of a capture stored in `parts`, with the document the promotion kept and no reading yet
   (the walker's state: nothing reads a capture whose whole never became one). `whole` holds the bytes under the digest. */
async function homeOfParts({ total, n = 5, whole = false, fmt = "undetermined", registerHome = true, bundleOpts = {} } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1", bundleOpts);
  const bytes = new TextEncoder().encode("%PDF-1.7 a packet kept in parts " + Math.random());
  const d = sha(bytes);
  if (registerHome) rows.set(d, row("INFO-1", bytes.length));
  const parts = partsOf(total, n);
  const document = doc({ digest: d, bytes: total, ct: "application/pdf", format: fmt, parts });
  const files = [{ path: "data/provenance.json", text: JSON.stringify({ documents: [document] }) }];
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: files[0].text } : null);
  if (whole) await evidence.put(`bio/captures/${d}`, bytes);
  return { w, rows, evidence, bytes, d, document, files };
}
const promote = (w, document, reading, units) => {
  const files = [{ path: "data/provenance.json", text: JSON.stringify({ documents: [{ ...document, reading, text_units: units || null }] }) }];
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: files[0].text } : null);
  w.x.projectPromotion({ bundleId: "INFO-1", author: "member:m1", files });
};

test("R84 (E3): a five-part capture of 41.5 MB with no whole is stated at once: `readHeld` writes the final statement with its size and answers read", async () => {
  const total = 41_500_000;
  assert.ok(total > WHOLE_READ_MAX);
  const { w, d } = await homeOfParts({ total, n: 5 });
  assert.equal(w.x.readingFor(d, "class:admin").found, false, "the walker's state: no reading");
  const r = await w.x.readHeld({ sha: d });
  assert.deepEqual([r.ok, r.read], [true, true], JSON.stringify(r));
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.found, true);
  assert.equal(got.reader_found, false);
  assert.equal(got.reading.failure, "final");
  assert.ok(got.reading.basis.includes(String(total)) && got.reading.basis.includes("5 parts"), got.reading.basis);
  assert.deepEqual(got.text_units, []);
  assert.deepEqual([got.completeness.state, got.completeness.failure, got.completeness.why.includes(String(total))], ["stated", "final", true], "R91 (G14): stated with its size reason, never none or full");
  assert.equal(got.bundle_id, "INFO-1");
  const again = await w.x.readHeld({ sha: d });
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"], "a second call changes nothing");
  assert.equal(count(w, "reading_history", d), 1);
});

test("R84 (E3): a transient 'over 20 MiB, no whole' reading of a capture past the ceiling is replaced by the final statement", async () => {
  const { w, d, document } = await homeOfParts({ total: 30 * MIB, n: 3 });
  const transient = { found: false, failure: "transient", entities: [],
    basis: `the capture is ${30 * MIB} bytes in 3 parts, over the ${20 * MIB} B a format entry is handed from parts, so it was not read` };
  promote(w, document, transient);
  assert.equal(readingOf(w, d).failure, "transient");
  const r = await w.x.readHeld({ sha: d });
  assert.deepEqual([r.ok, r.read], [true, true]);
  assert.equal(readingOf(w, d).failure, "final");
  assert.equal(count(w, "reading_history", d), 2, "R23: the transient reading is kept");
});

test("R84 (control): a capture of 22 MiB still needs its whole: with none it is not read, with it it is read and has text", async () => {
  const { w, d, evidence, bytes } = await homeOfParts({ total: 22 * MIB, n: 3, fmt: "pdf" });
  const none = await w.x.readHeld({ sha: d });
  assert.deepEqual([none.ok, none.read, none.why], [true, false, "NO_WHOLE_OBJECT"]);
  assert.equal(count(w, "readings", d), 0);
  await evidence.put(`bio/captures/${d}`, bytes);
  const r = await withEntry(pdfEntry(i2([{ page: 0, text: "alpha beta gamma delta" }])), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read], [true, true]);
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/);
});

test("R84 (control): a viewer who may not see the over-ceiling capture's home gets nothing written", async () => {
  const { w, d } = await homeOfParts({ total: 41_500_000, n: 5, bundleOpts: { project: "PROJ-9" } });
  const refused = await w.x.readHeld({ sha: d, viewer: "member:outsider" });
  assert.deepEqual([refused.read, refused.why], [false, "NO_HOME"]);
  assert.equal(count(w, "readings", d), 0);
});

test("R83 (E2): `readHeld` offers the index only what it keeps: a text past the index's 2 MiB leaves words_read below words_total and the index within its bound", async () => {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a long volume " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-1", bytes.length));
  await evidence.put(`bio/captures/${d}`, bytes);
  const line = "alpha beta gamma delta epsilon ".repeat(300);   /* about 9 KB a page */
  const pages = Array.from({ length: 600 }, (_, page) => ({ page, text: `${page} ${line}` }));   /* about 5.4 MB */
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  /* R83 amended by R90 (fix round 6): the first tick offers the index what it keeps and says it has more; the ledger's later ticks read the rest */
  const r = await withEntry(pdfEntry(i2(pages)), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read, r.more], [true, true, true]);
  const first = readingOf(w, d);
  assert.ok(first.words_total > first.words_read, `read ${first.words_read} of ${first.words_total}`);
  const bytesIndexed = w.one(`SELECT sum(length(CAST(text AS BLOB))) n, count(*) c FROM capture_text WHERE capture_sha=?`, d);
  assert.ok(bytesIndexed.n <= CAPTURE_TEXT_CAPTURE_BOUND, `${bytesIndexed.n} bytes indexed`);
  assert.equal(w.one(`SELECT state FROM capture_text_state WHERE capture_sha=?`, d).state, "partial");
  let more = true, ticks = 1;
  while (more && ticks < 20) { const t = await withEntry(pdfEntry(i2(pages)), () => w.x.readHeld({ sha: d, kind: "reading" })); more = t.more === true; ticks++; }
  const state = w.one(`SELECT state, offered, written, over_bound FROM capture_text_state WHERE capture_sha=?`, d);
  assert.deepEqual({ ...state }, { state: "whole", offered: 600, written: 600, over_bound: 0 }, "every page is read, each piece within the bound");
  assert.equal(w.x.readingFor(d, "class:admin").reading.words_read, first.words_total);
});

test("R83 (control): a text within the index's bound is offered whole: words_read equals words_total", async () => {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a short notice " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-1", bytes.length));
  await evidence.put(`bio/captures/${d}`, bytes);
  w.core.readFile = () => ({ text: JSON.stringify({ documents: [doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" })] }) });
  const r = await withEntry(pdfEntry(i2([{ page: 0, text: "alpha beta" }, { page: 1, text: "gamma delta epsilon" }])), () => w.x.readHeld({ sha: d }));
  assert.equal(r.read, true);
  const reading = readingOf(w, d);
  assert.deepEqual([reading.words_read, reading.words_total], [5, 5]);
});

/* The walker's 10 MB upload, as it was stored before reading-pipeline detected a format from the held bytes: two parts, the whole
   kept, `final` "not read as text (multipart)". Old data, so written as the old chain wrote it (R-OLD), its sentence read through
   the same word the chain used. */
async function multipartNotRead() {
  const made = await homeOfParts({ total: 10_300_000, n: 2, whole: true, fmt: "undetermined" });
  const reading = { found: false, entities: [], failure: "final", content_type: null, text_source: null,
    basis: localize("reading-pipeline.index.document_not_read_text", "the document was not read as text ({why}), so no reading was attempted",
      { why: localize("reading-pipeline.index.multipart", "multipart") }) };
  promote(made.w, made.document, reading, null);
  return { ...made, out: { reading } };
}

test("R85 (E1): a final 'not read as text (multipart)' reading is replaced once the held bytes detect a format: `readHeld` gives it its text", async () => {
  const { w, d, out } = await multipartNotRead();
  assert.equal(out.reading.found, false);
  assert.equal(out.reading.failure, "final");
  assert.deepEqual(w.x.readingFor(d, "class:admin").text_units, []);
  const r = await withEntry(pdfEntry(i2([{ page: 0, text: "alpha beta gamma delta" }])), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read], [true, true], JSON.stringify(r));
  const got = w.x.readingFor(d, "class:admin");
  assert.match(got.text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/, "R-STOP: the words are in the text units");
  assert.equal(got.format, "pdf", "the reading's capture format is the one the bytes detect");
  assert.equal(count(w, "reading_history", d), 2, "R23: the old reading is kept");
  const again = await withEntry(pdfEntry(i2([{ page: 0, text: "other words" }])), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"], "a reading with text is never replaced");
  assert.equal(count(w, "reading_history", d), 2);
});

test("R85 (control): bytes that detect no format leave the final reading as it is, however often it is pressed", async () => {
  const { w, d } = await multipartNotRead();
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  for (let i = 0; i < 2; i++) {
    const r = await withEntry({ format: "pdf", detect: () => null, structure: null }, () => w.x.readHeld({ sha: d }));
    assert.deepEqual([r.ok, r.read, r.why], [true, false, "READING_HELD"]);
  }
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  assert.equal(count(w, "reading_history", d), 1);
});

test("R85 (control): a final reading that says it was over the ceiling is not the 'not read as text' reading: it is not replaced, whatever the bytes are", async () => {
  const made = await homeOfParts({ total: 41_500_000, n: 5, whole: true, fmt: "undetermined" });
  const out = await made.w.x.read(made.document, { storeName: "bio" });
  assert.equal(out.reading.failure, "final");
  promote(made.w, made.document, out.reading);
  const stored = made.w.one(`SELECT reading FROM readings WHERE capture_sha=?`, made.d).reading;
  const r = await withEntry(pdfEntry(i2([{ page: 0, text: "alpha" }])), () => made.w.x.readHeld({ sha: made.d }));
  assert.deepEqual([r.read, r.why], [false, "READING_HELD"]);
  assert.equal(made.w.one(`SELECT reading FROM readings WHERE capture_sha=?`, made.d).reading, stored);
});

/* ---- R86 (B18): `defer=1`, the door's way to leave a read it cannot fit to the ledger ---- */

async function unreadHome(bundleOpts = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-80", bundleOpts);
  const bytes = new TextEncoder().encode("%PDF-1.7 held whole " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-80", bytes.length));
  await evidence.put(`bio/captures/${d}`, bytes);
  const stored = JSON.stringify({ documents: [doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" })] });
  w.core.readFile = (b, p) => (b === "INFO-80" && p === "data/provenance.json" ? { text: stored } : null);
  return { w, d };
}
const viaDoor = (w, d, viewer, defer) => {
  const q = new URLSearchParams({ sha: d, store: "bio", viewer, ...(defer ? { defer: "1" } : {}) });
  return extractionOps(w.x, new URL(`http://x/readheld?${q}`), { sha: d }, {}).readheld();
};
const TXT = i2([{ page: 0, text: "alpha beta gamma delta" }]);

test("R86 (B18): with defer=1 a home the caller may see answers READING_PENDING and reads nothing; without it the same home is read", async () => {
  const { w, d } = await unreadHome();
  const pending = await withEntry(pdfEntry(TXT), () => viaDoor(w, d, "class:admin", true));
  assert.deepEqual([pending.ok, pending.read, pending.why], [true, false, "READING_PENDING"]);
  assert.equal(count(w, "readings", d), 0);
  const read = await withEntry(pdfEntry(TXT), () => viaDoor(w, d, "class:admin", false));
  assert.deepEqual([read.ok, read.read], [true, true]);
});

test("R86 (control): with defer=1 a home she may not see answers as without it, and a home with a reading answers READING_HELD", async () => {
  const hidden = await unreadHome({ project: "PROJ-9" });
  const a = await viaDoor(hidden.w, hidden.d, "member:outsider", true);
  const b = await viaDoor(hidden.w, hidden.d, "member:outsider", false);
  assert.deepEqual(a, b);
  assert.equal(a.why, "NO_HOME");
  const { w, d } = await unreadHome();
  await withEntry(pdfEntry(TXT), () => viaDoor(w, d, "class:admin", false));
  const held = await withEntry(pdfEntry(TXT), () => viaDoor(w, d, "class:admin", true));
  assert.deepEqual([held.read, held.why], [false, "READING_HELD"]);
});
