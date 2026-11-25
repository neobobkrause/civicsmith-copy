/* extraction, R80 as amended (T51 fix round 4, C5b, N5; K4429; amends R80, R45; control-plane R117): a failed reading that failed
   for want of the whole bytes is replaced once the whole is held, and `op=readheld` offers `readHeld` to a member who may see the
   document. The failed reading is made by the real chain (`read` over a three-part capture past the reader's size, then the
   promote projection), never written by hand. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, withEntry, i2, doc, sha, homesOver } from "./fixture.mjs";
import { extractionOps } from "../../../src/extraction/index.mjs";

const pdf = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const register = (rows) => homesOver(rows);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const TEXT = i2([{ page: 0, text: "alpha beta gamma delta" }]);
/* the BAC packet's shape: three parts, 21,036,491 bytes, past the 20 MiB a format entry is handed from parts */
const PARTS = [8388608, 8388608, 4259275].map((bytes, i) => ({ sha256: sha(`part ${i}`), bytes }));

/* A store whose register names INFO-1 the home of a capture promoted in parts with the reading the real chain made of it: the
   whole was not held, so the reading failed. The stored document (`data/provenance.json`) is what the promotion kept. */
async function promotedFailed({ bundleOpts = {}, parts = PARTS, holdFirst = null, entry = null, registered = true } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1", bundleOpts);
  const bytes = new TextEncoder().encode("%PDF-1.7 a packet kept in parts " + Math.random());
  const d = sha(bytes);
  if (registered) rows.set(d, row("INFO-1", bytes.length));
  const document = doc({ digest: d, bytes: parts ? parts.reduce((n, p) => n + p.bytes, 0) : bytes.length, ct: "application/pdf", format: "pdf", parts });
  if (holdFirst) await evidence.put(`bio/captures/${d}`, bytes);
  const made = await (entry ? withEntry(entry, () => w.x.read(document, { storeName: "bio" })) : w.x.read(document, { storeName: "bio" }));
  const files = [{ path: "data/provenance.json", text: JSON.stringify({ documents: [{ ...document, reading: made.reading,
    text_units: made.text_units || null }] }) }];
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: files[0].text } : null);
  w.x.projectPromotion({ bundleId: "INFO-1", author: "member:m1", files });
  return { w, rows, evidence, bytes, d, document, made };
}
const readingOf = (w, d) => JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);

test("R80 R45 (C5b): a home promoted with a reading that failed for want of the whole is read by `readHeld` once the whole is held; `op=reading` then answers found with units", async () => {
  const { w, evidence, bytes, d, made } = await promotedFailed();
  assert.equal(made.reading.found, false, "the real chain failed the reading: the whole was not held");
  const before = w.x.readingFor(d, "class:admin");
  assert.equal(before.found, true, "the walker's state: a reading is held");
  assert.match(before.reading.basis, /parts, over the 20971520 B/, "and it says it was not read for want of the whole");
  assert.deepEqual(before.text_units, []);
  await evidence.put(`bio/captures/${d}`, bytes);
  const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read], [true, true]);
  const after = w.x.readingFor(d, "class:admin");
  assert.equal(after.found, true);
  assert.doesNotMatch(after.reading.basis ?? "", /over the/, "no longer the failed reading");
  assert.ok(after.text_units.length >= 1, "the reading has text units");
  assert.match(after.text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/);
  assert.equal(after.bundle_id, "INFO-1", "written for the home bundle");
  assert.equal(count(w, "readings", d), 1, "replaced in place, not added");
  assert.equal(count(w, "reading_history", d), 2, "R23: the failed reading is kept in the history");
});

test("R80 R45: a second call changes nothing, and a replacement that fails again from the whole bytes is not read a third time", async () => {
  const { w, evidence, bytes, d } = await promotedFailed();
  await evidence.put(`bio/captures/${d}`, bytes);
  const first = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.equal(first.read, true);
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const hist = count(w, "reading_history", d);
  const again = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([again.ok, again.read, again.why], [true, false, "READING_HELD"]);
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  assert.equal(count(w, "reading_history", d), hist);
  /* the whole bytes find nothing: that failed reading is made from the whole, so it is written once and not read again */
  const dead = await promotedFailed();
  await dead.evidence.put(`bio/captures/${dead.d}`, dead.bytes);
  const one = await dead.w.x.readHeld({ sha: dead.d });
  assert.deepEqual([one.read, one.found], [true, false]);
  assert.equal(readingOf(dead.w, dead.d).found, false);
  const two = await dead.w.x.readHeld({ sha: dead.d });
  assert.deepEqual([two.read, two.why], [false, "READING_HELD"]);
  assert.equal(count(dead.w, "reading_history", dead.d), 2, "one replacement, no more");
});

test("R80 R45 (control): a reading with text is never replaced", async () => {
  const { w, evidence, bytes, d } = await promotedFailed({ parts: null, holdFirst: true, entry: pdf(TEXT) });
  assert.equal(readingOf(w, d).read_from_text !== undefined, true);
  await evidence.put(`bio/captures/${d}`, bytes);
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const hist = count(w, "reading_history", d);
  const r = await withEntry(pdf(i2([{ page: 0, text: "something else entirely" }])), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read, r.why], [true, false, "READING_HELD"]);
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  assert.equal(count(w, "reading_history", d), hist);
});

test("R80 R45 (control): a failed reading made from the whole bytes is not read again, for a single capture and for one kept in parts", async () => {
  /* the whole was held when the reading was made, and the reader found nothing */
  for (const parts of [null, PARTS]) {
    const { w, evidence, bytes, d, made } = await promotedFailed({ parts, holdFirst: true });
    assert.equal(made.reading.found, false);
    await evidence.put(`bio/captures/${d}`, bytes);
    const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
    const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
    assert.deepEqual([r.read, r.why], [false, "READING_HELD"], parts ? "in parts" : "single");
    assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
    assert.equal(count(w, "reading_history", d), 1);
  }
});

test("R80 (control): a failed reading for want of the whole is left while the whole is not held; a digest with no home is not read", async () => {
  const { w, d, evidence } = await promotedFailed();
  const stored = w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  const r = await w.x.readHeld({ sha: d });
  assert.deepEqual([r.ok, r.read, r.why], [true, false, "NO_WHOLE_OBJECT"]);
  assert.equal(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading, stored);
  const loose = sha("loose");
  await evidence.put(`bio/captures/${loose}`, new TextEncoder().encode("loose"));
  const none = await w.x.readHeld({ sha: loose });
  assert.deepEqual([none.read, none.why], [false, "NO_HOME"]);
});

/* ---- op=readheld (N5): the repair for a record stored unread ---- */

/* A record stored unread: the register names its home, the whole is held, and no reading was ever written (the promote
   request was aborted, as the walker did). */
async function storedUnread(bundleOpts = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-80", bundleOpts);
  const bytes = new TextEncoder().encode("%PDF-1.7 a photograph kept unread " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-80", bytes.length));
  await evidence.put(`bio/captures/${d}`, bytes);
  const stored = JSON.stringify({ documents: [doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" })] });
  w.core.readFile = (b, p) => (b === "INFO-80" && p === "data/provenance.json" ? { text: stored } : null);
  return { w, d };
}
const readheld = (w, sha256, viewer) => {
  const q = new URLSearchParams({ sha: sha256, store: "bio", ...(viewer == null ? {} : { viewer }) });
  return extractionOps(w.x, new URL(`http://x/readheld?${q}`), { sha: sha256 }, {}).readheld();
};

test("R80 (N5): `op=readheld` by a member who may see the document reads a record stored unread; a second press changes nothing", async () => {
  const { w, d } = await storedUnread();
  assert.equal(w.x.readingFor(d, "class:admin").found, false, "stored unread");
  const r = await withEntry(pdf(TEXT), () => readheld(w, d, "class:admin"));
  assert.deepEqual([r.ok, r.read], [true, true]);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.found, true);
  assert.match(got.text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/);
  const again = await withEntry(pdf(TEXT), () => readheld(w, d, "class:admin"));
  assert.deepEqual([again.ok, again.read, again.why], [true, false, "READING_HELD"]);
});

test("R80 (N5 control): `op=readheld` by a viewer who may not see the document is refused as an absent record, and writes nothing", async () => {
  const { w, d } = await storedUnread({ project: "PROJ-9", type: "information" });
  const absent = await readheld(w, sha("nobody holds this"), "member:outsider");
  const hidden = await withEntry(pdf(TEXT), () => readheld(w, d, "member:outsider"));
  assert.deepEqual(hidden, absent, "the same answer as a digest with no home");
  assert.deepEqual([hidden.ok, hidden.read, hidden.why], [true, false, "NO_HOME"]);
  assert.equal(count(w, "readings", d), 0);
  const nobody = await withEntry(pdf(TEXT), () => readheld(w, d, null));
  assert.equal(nobody.read, false, "a door call that names no viewer is not a viewer who may see it");
  assert.equal(count(w, "readings", d), 0);
});

test("R80 (N5 control): `op=readheld` of a malformed or absent digest reads nothing", async () => {
  const { w } = await storedUnread();
  assert.equal((await readheld(w, "nope", "class:admin")).read, false);
  assert.equal((await readheld(w, sha("no such document"), "class:admin")).read, false);
  assert.equal((await readheld(w, "", "class:admin")).reason, "NO_SHA", "R63: a request naming no digest");
  assert.equal(count(w, "readings", sha("no such document")), 0);
});

test("R80 R45 (C5b; K4440): a multipart capture is registered by its parts, not its whole digest, so the register names no home for the whole; `readHeld` finds the home by the failed reading's own bundle, and still reads nothing for a digest with neither", async () => {
  const { w, rows, evidence, bytes, d } = await promotedFailed({ registered: false });
  assert.equal(rows.size, 0, "the register holds no row for the whole digest");
  await evidence.put(`bio/captures/${d}`, bytes);
  const r = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read, r.bundle_id], [true, true, "INFO-1"]);
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/);
  const again = await withEntry(pdf(TEXT), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"]);
  /* the viewer gate follows the reading's bundle */
  const hidden = await promotedFailed({ registered: false, bundleOpts: { project: "PROJ-9" } });
  await hidden.evidence.put(`bio/captures/${hidden.d}`, hidden.bytes);
  const refused = await withEntry(pdf(TEXT), () => hidden.w.x.readHeld({ sha: hidden.d, viewer: "member:outsider" }));
  assert.deepEqual([refused.read, refused.why], [false, "NO_HOME"]);
  assert.equal(readingOf(hidden.w, hidden.d).found, false, "nothing written for a viewer who may not see it");
  /* control: no home and no reading is still no home */
  const loose = sha("loose bytes");
  await evidence.put(`bio/captures/${loose}`, new TextEncoder().encode("loose bytes"));
  assert.equal((await w.x.readHeld({ sha: loose })).why, "NO_HOME");
});
