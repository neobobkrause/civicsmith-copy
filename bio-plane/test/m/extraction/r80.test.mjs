/* extraction, R80 (T51 fix round 3, C5; K4356, K4358; amends R20, R27; provenance R4; control-plane R117): a registered home
   that has no reading is read once its bytes are held whole, by `readHeld({sha})`; it writes no bundle and replaces no
   reading. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, bucket, member, withEntry, i2, noText, ocrAnswer, sha, doc, pressThenPass, homesOver } from "./fixture.mjs";

const pdf = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });

/* provenance's R4 `homeOf` stand-in over a map of register rows. */
const register = (rows) => homesOver(rows);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });

/* A store whose register names `INFO-1` as the home of a capture whose whole object is not yet held (a parts-only home). */
function partsOnly() {
  const rows = new Map();
  const evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a notice kept in parts " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-1", bytes.length));
  /* a home is a promoted bundle: its own provenance document states the capture it holds (fix round 6, G6: a digest no stored
     document names is not read) */
  const stored = JSON.stringify({ documents: [doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" })] });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: stored } : null);
  return { w, rows, evidence, bytes, d };
}
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;

test("R80 R20: a registered home whose bytes arrive whole gets its reading; `op=reading` by the digest answers found", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  assert.equal(w.x.readingFor(d, "class:admin").found, false, "no reading before the repair");
  await evidence.put(`bio/captures/${d}`, bytes);
  const r = await w.x.readHeld({ sha: d });
  assert.equal(r.ok, true);
  assert.equal(r.read, true);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.found, true);
  assert.equal(got.bundle_id, "INFO-1", "the reading is written for the home bundle");
  assert.equal(got.origin.state, "composed", "this instance composed it");
});

test("R80: a second call changes nothing (no second reading, no second history row)", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  await w.x.readHeld({ sha: d });
  const before = [count(w, "readings", d), count(w, "reading_history", d)];
  const again = await w.x.readHeld({ sha: d });
  assert.deepEqual([again.ok, again.read], [true, false]);
  assert.equal(typeof again.why, "string");
  assert.deepEqual([count(w, "readings", d), count(w, "reading_history", d)], before);
});

test("R80: it writes no bundle and no register row; the home bundle's version is untouched", async () => {
  const { w, rows, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  const bundles = w.one(`SELECT count(*) c, max(row_version) v FROM bundles`);
  await w.x.readHeld({ sha: d });
  assert.deepEqual(w.one(`SELECT count(*) c, max(row_version) v FROM bundles`), bundles);
  assert.equal(rows.size, 1);
});

test("R80 R31 R32: after the repair the OCR re-read of the capture runs; before it, it answered 409 REEXTRACT_NOT_READ", async () => {
  const t = i2([{ page: 0, text: "alpha beta gamma" }, { page: 1, text: "", undetermined: [noText(1)] }]);
  const { w, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  const ask = () => withEntry(pdf(t), () => w.x.pdfStructure({ ocr: "1", sha: d, viewer: "class:admin", session: false,
    env: { OCR_WORKER: member(() => ocrAnswer([1])) } }));
  const before = await ask();
  assert.equal(before.status, 409);
  assert.equal(before.body.reason, "REEXTRACT_NOT_READ");
  const r = await withEntry(pdf(t), () => w.x.readHeld({ sha: d }));
  assert.equal(r.read, true);
  /* (fix round 9, R103) the press owes the page; the ledger's pass writes the re-read */
  const { press, x } = await pressThenPass(w, d, { OCR_WORKER: member(() => ocrAnswer([1])) });
  assert.deepEqual([press.status, press.body.reextraction.owed], [200, true]);
  assert.equal(x.written, true);
});

test("R80 (control): a digest that already has a reading is left as it is", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: { basis: "an earlier reading", entities: [] }, composed: true });
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const hist = count(w, "reading_history", d);
  const r = await w.x.readHeld({ sha: d });
  assert.deepEqual([r.ok, r.read], [true, false]);
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  assert.equal(count(w, "reading_history", d), hist);
});

test("R80 (control): a digest with no home writes nothing, though its bytes are held", async () => {
  const { w, evidence } = partsOnly();
  const loose = await hold(evidence, "held bytes nobody registered");
  const r = await w.x.readHeld({ sha: loose });
  assert.deepEqual([r.ok, r.read], [true, false]);
  assert.equal(typeof r.why, "string");
  assert.equal(count(w, "readings", loose), 0);
  assert.equal(count(w, "reading_history", loose), 0);
});

test("R80 (control): a home whose whole object is not held writes nothing", async () => {
  const { w, d } = partsOnly();
  const r = await w.x.readHeld({ sha: d });
  assert.deepEqual([r.ok, r.read], [true, false]);
  assert.equal(typeof r.why, "string");
  assert.equal(count(w, "readings", d), 0);
});

test("R80 (control): the three unread answers say different things; a malformed digest and a store with no provenance read nothing", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  const none = await w.x.readHeld({ sha: d });
  const loose = await w.x.readHeld({ sha: await hold(evidence, "loose bytes") });
  await evidence.put(`bio/captures/${d}`, bytes);
  await w.x.readHeld({ sha: d });
  const held = await w.x.readHeld({ sha: d });
  assert.equal(new Set([none.why, loose.why, held.why]).size, 3);
  assert.deepEqual((await w.x.readHeld({ sha: "nope" })).read, false);
  assert.deepEqual((await w.x.readHeld({})).read, false);
  const bare = fresh();
  assert.equal((await bare.x.readHeld({ sha: await hold(bare.evidence, "x") })).read, false);
});

test("R80 R45: bytes that find nothing are recorded as a failed reading, once", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  const r = await w.x.readHeld({ sha: d });
  assert.equal(r.read, true);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.found, true, "a reading is held");
  assert.equal(got.reader_found, false, "and it found nothing");
  assert.equal(count(w, "readings", d), 1);
});

test("R80 R24: the reading's listeners run in the write, as a promotion's reading's do", async () => {
  const { w, evidence, bytes, d } = partsOnly();
  await evidence.put(`bio/captures/${d}`, bytes);
  const seen = [];
  w.x.onReading("content", (e) => { seen.push([e.bundleId, e.captureSha, e.chainBefore]); return {}; });
  await w.x.readHeld({ sha: d });
  assert.deepEqual(seen, [["INFO-1", d, null]]);
});
