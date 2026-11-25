/* extraction, fix round 6 wave 3 (T51; K4597, K4598; plan G33): a reading the old press stored against a PART's digest is superseded by the
   whole's sized statement (R92, a repair, R-OLD). The walker's state: 0115 held a `final` "non-textual or too large" reading against part 4
   of its five and none against the whole, so the document counted two captures. The old state is made by the real writer
   (`writeReading`, as the old press did), the repair is the start-up migration, the tick is `readHeld` as the ledger runs it; each test
   names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localize } from "../../../src/setup-words/index.mjs";
import { WHOLE_READ_MAX } from "../../../src/reading-pipeline/index.mjs";
import { fresh, bundle, bucket, doc, sha, homesOver } from "./fixture.mjs";

const register = (rows, parts = null) => homesOver(rows, parts);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const held = (w) => w.s.sql.exec(`SELECT capture_sha FROM readings ORDER BY capture_sha`).toArray().map((r) => r.capture_sha);
const ledger = () => { const owed = []; return { owed, owe: async (e) => { owed.push(e); return { ok: true }; } }; };
/* what the old press wrote against the digest the register named for a multipart capture: its lowest-sorting part */
const stub = () => ({ found: false, entities: [], failure: "final", content_type: null, text_source: null,
  basis: localize("reading-pipeline.index.document_not_read_text", "the document was not read as text ({why}), so no reading was attempted",
    { why: localize("reading-pipeline.index.non_textual_large", "non-textual or too large") }) });

/* 0115's shape, the readings as the old press left them (a reading stored against a part); the register as provenance keeps it now (R74, fix round 9,
   K4880): the whole is its one row and `partsOf` names its five parts; the bundle's provenance document names the whole and its parts, the capture is
   over the reading ceiling, the whole's bytes are not held. */
function walker({ n = 5, total = 41_502_904, bundleId = "INFO-1", host = null } = {}) {
  const rows = new Map(), evidence = bucket(), wholes = new Map();
  const w = fresh({ evidence, provenance: register(rows, wholes), host });
  bundle(w.s, bundleId);
  const d = sha("the whole of a packet kept in parts " + Math.random());
  const parts = Array.from({ length: n }, (_, i) => ({ file: `p${i}.bin`, sha256: sha(`part ${i} ${Math.random()}`),
    bytes: i < n - 1 ? Math.floor(total / n) : total - Math.floor(total / n) * (n - 1) }));
  rows.set(d, row(bundleId, total));
  wholes.set(d, parts.map((p) => ({ sha256: p.sha256, bytes: p.bytes })));
  const document = doc({ digest: d, bytes: total, ct: "application/pdf", format: "undetermined", parts });
  const text = JSON.stringify({ documents: [document] });
  w.s.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?,?,?,?,?,?)`, bundleId, "data/provenance.json", text, null, 1, "x");
  w.core.readFile = (b, p) => (b === bundleId && p === "data/provenance.json" ? { text } : null);
  return { w, rows, d, parts, document, bundleId };
}
const oldPress = (w, bundleId, part, reading = stub()) => w.x.writeReading({ bundleId, captureSha: part, reading, composed: true });
const TABLES = ["readings", "reading_history", "reading_refs", "reading_ref_terms", "reading_text_source", "capture_text",
  "capture_text_skipped", "capture_text_state", "reading_repairs"];

test("R92 (G33): a `final` reading stored against part 4 of five is superseded: after the repair and a tick the whole holds the sized statement and the part holds nothing", async () => {
  const { w, d, parts, bundleId } = walker();
  assert.ok(41_502_904 > WHOLE_READ_MAX);
  oldPress(w, bundleId, parts[3].sha256);
  assert.deepEqual(held(w), [parts[3].sha256], "the walker's state: one reading, against a part");
  const l = ledger();
  w.x.registerOwe(l.owe);
  const made = await w.x.migratePartReadings();
  assert.deepEqual(l.owed, [{ kind: "reading", sha: d }], "the whole is owed to the ledger");
  assert.deepEqual([made.done, made.superseded], [true, [parts[3].sha256]], JSON.stringify(made));
  for (const t of TABLES) assert.equal(count(w, t, parts[3].sha256), 0, `${t}: nothing is kept against a part`);
  /* the ledger's tick on the entry it was owed */
  const r = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.deepEqual([r.ok, r.read], [true, true], JSON.stringify(r));
  assert.deepEqual(held(w), [d], "the document's one capture holds the one reading: the case reads `only_capture`");
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.reading.failure, "final");
  assert.ok(got.reading.basis.includes("41502904") && got.reading.basis.includes("5 parts"), "the sized statement: " + got.reading.basis);
  assert.ok(got.at !== undefined);
  assert.equal(w.x.readingFor(parts[3].sha256, "class:admin").found, false, "R104: a part's digest is no capture, and holds no reading of its own any more");
});

test("R92 (G33): a part reading is superseded when the whole already holds its reading: nothing is owed; two parts of one whole owe it once", async () => {
  const { w, d, parts, bundleId } = walker();
  oldPress(w, bundleId, d, { ...stub(), basis: "the whole's own statement" });
  oldPress(w, bundleId, parts[3].sha256);
  const l = ledger();
  w.x.registerOwe(l.owe);
  await w.x.migratePartReadings();
  assert.deepEqual(held(w), [d]);
  assert.deepEqual(l.owed, [], "the whole has its reading: nothing is owed");
  assert.equal(w.x.readingFor(d, "class:admin").reading.basis, "the whole's own statement", "the whole's reading is not touched");
  /* two parts, no whole reading */
  const two = walker();
  oldPress(two.w, two.bundleId, two.parts[1].sha256);
  oldPress(two.w, two.bundleId, two.parts[3].sha256);
  const l2 = ledger();
  two.w.x.registerOwe(l2.owe);
  await two.w.x.migratePartReadings();
  assert.deepEqual(l2.owed, [{ kind: "reading", sha: two.d }], "owed once");
  assert.deepEqual(held(two.w), []);
});

test("R92 (control): only a failed reading keyed to a part is superseded: not a whole's own, not a reading with text, not a digest that is also a document of its bundle, not another bundle's", async () => {
  const { w, d, parts, bundleId } = walker();
  /* a failed reading of a digest no document names as a part: another capture of the bundle */
  const lone = sha("a lone capture " + Math.random());
  oldPress(w, bundleId, lone);
  /* a reading WITH text under a part digest (the bytes were read as a document of their own elsewhere) */
  const texty = parts[1].sha256;
  oldPress(w, bundleId, texty, { found: true, entities: [{ kind: "meeting", key: "1" }], basis: "read" });
  /* a part digest that is also a document of this bundle: it is a document, not only a part */
  const alsoDoc = parts[2].sha256;
  const second = doc({ digest: alsoDoc, bytes: 10, ct: "application/pdf", format: "undetermined" });
  w.core.readFile = (b, p) => (b === bundleId && p === "data/provenance.json"
    ? { text: JSON.stringify({ documents: [{ ...walkerDoc(parts, d), }, second] }) } : null);
  oldPress(w, bundleId, alsoDoc);
  /* a failed reading against the digest of a part, in a bundle that does not hold that document */
  bundle(w.s, "INFO-2");
  oldPress(w, "INFO-2", parts[4].sha256);
  const before = held(w);
  const l = ledger();
  w.x.registerOwe(l.owe);
  const made = await w.x.migratePartReadings();
  assert.deepEqual(made.superseded, []);
  assert.deepEqual(l.owed, []);
  assert.deepEqual(held(w), before, "every one of them stands");
  assert.ok(d);
});
function walkerDoc(parts, d) { return doc({ digest: d, bytes: 41_502_904, ct: "application/pdf", format: "undetermined", parts }); }

test("R92: the repair is done once; a ledger that refuses stops it with the part's reading kept, and the next run owes the same entry again; with no ledger it waits and deletes nothing", async () => {
  const { w, d, parts, bundleId } = walker();
  oldPress(w, bundleId, parts[3].sha256);
  const none = await w.x.migratePartReadings();
  assert.deepEqual([none.done, none.examined, none.superseded], [false, 0, []], "no ledger handed in: nothing is done");
  assert.deepEqual(held(w), [parts[3].sha256], "and nothing is deleted before the whole is owed");
  let down = true; const owed = [];
  w.x.registerOwe(async (e) => { if (down) return { ok: false, reason: "PENDING_NOT_KEPT" }; owed.push(e); return { ok: true }; });
  const first = await w.x.migratePartReadings();
  assert.deepEqual([first.done, first.examined, owed.length], [false, 0, 0]);
  assert.deepEqual(held(w), [parts[3].sha256], "a refused ledger leaves the part's reading where it was");
  down = false;
  const second = await w.x.migratePartReadings();
  assert.deepEqual([second.done, owed, held(w)], [true, [{ kind: "reading", sha: d }], []]);
  const again = await w.x.migratePartReadings();
  assert.deepEqual([again.done, again.examined, owed.length], [true, 0, 1], "done once: nothing is owed twice");
});

test("R92: handing the ledger in on an object starts the repair with no press; the start-up scan is its own row, so a store whose R89 repair finished is still scanned (R-OLD)", async () => {
  const pending = [];
  const { w, d, parts, bundleId } = walker({ host: { waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() } });
  oldPress(w, bundleId, parts[3].sha256);
  /* the R89 repair already finished on this store (a release that had it) */
  w.s.sql.exec(`INSERT OR REPLACE INTO reading_migrations (migration, cutoff, after, done, examined, migrated, at, rescan) VALUES (?,?,?,1,0,0,?,1)`,
    "r89-repair-not-read", 0, "", "t");
  const l = ledger();
  w.x.registerOwe(l.owe);
  await Promise.all(pending);
  assert.deepEqual(l.owed.filter((e) => e.sha === d), [{ kind: "reading", sha: d }], "the whole is owed");
  assert.deepEqual(held(w), [], "the part's reading is gone");
});
