/* extraction, fix round 6 (T51; K4570, K4571; plan G6, G8): a digest that is a PART of a document is never read alone (R88; as R104 restates
   it at fix round 9, it is no capture and is never resolved to a whole); an old "not read as text" reading is owed to the ledger by a start-up repair and states that it is repairable (R89).
   The readings are made by the real chain (`read`, then the promote projection or `readHeld`), never written by hand where a test
   needs a reading's text; each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localize } from "../../../src/setup-words/index.mjs";
import { fresh, bundle, bucket, withEntry, i2, doc, sha, homesOver } from "./fixture.mjs";
import { extractionOps } from "../../../src/extraction/index.mjs";

const pdfEntry = (text) => ({ format: "pdf",
  detect: (b) => (b && b.length >= 5 && String.fromCharCode(...b.subarray(0, 5)) === "%PDF-" ? { format: "pdf", confidence: "certain", signals: [] } : null),
  structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const register = (rows, parts = null) => homesOver(rows, parts);
const row = (bundleId, bytes = 20) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const TEXT = i2([{ page: 0, text: "alpha beta gamma delta" }]);

/* A capture kept in parts as the register holds it now (provenance R74, fix round 9, K4880): the whole is its one row and `partsOf` names its parts;
   the bundle's `data/provenance.json` names the whole and its parts. `held: false` leaves the whole's bytes unheld. */
async function nParts({ n = 5, held = true, bundleId = "INFO-1" } = {}) {
  const rows = new Map(), wholes = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows, wholes) });
  bundle(w.s, bundleId);
  const bytes = new TextEncoder().encode("%PDF-1.7 a packet kept in parts " + Math.random());
  const d = sha(bytes);
  const size = Math.ceil(bytes.length / n);
  const parts = Array.from({ length: n }, (_, i) => bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size)))
    .filter((b) => b.length).map((b, i) => ({ file: `p${i}.bin`, sha256: sha(b + String(i) + Math.random()), bytes: b.length }));
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf", parts });
  rows.set(d, row(bundleId, bytes.length));
  wholes.set(d, parts.map((p) => ({ sha256: p.sha256, bytes: p.bytes })));
  w.s.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?,?,?,?,?,?)`,
    bundleId, "data/provenance.json", JSON.stringify({ documents: [document] }), null, 1, "x");
  if (held) await evidence.put(`bio/captures/${d}`, bytes);
  return { w, rows, evidence, bytes, d, parts, document };
}

/* ---- R88 as R104 restates it (fix round 9, G127a; K4833): a part's digest is no capture, and is never resolved to a whole ---- */

test("R88 R104 (G6, G127a): `readHeld` of a part's digest reads nothing and writes nothing under it (`NO_HOME`: the register names wholes only); the whole is read by its own digest", async () => {
  const { w, d, parts } = await nParts({ n: 5 });
  assert.ok(parts.length >= 2);
  for (const p of parts) {
    const r = await withEntry(pdfEntry(TEXT), () => w.x.readHeld({ sha: p.sha256 }));
    assert.deepEqual([r.ok, r.read, r.why], [true, false, "NO_HOME"], JSON.stringify(r));
    for (const t of ["readings", "reading_history", "capture_text_state", "reading_repairs"]) assert.equal(count(w, t, p.sha256), 0, t);
  }
  assert.equal(count(w, "readings", d), 0, "no part's press read the whole");
  assert.equal((await withEntry(pdfEntry(TEXT), () => w.x.readHeld({ sha: d }))).read, true);
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/, "R-STOP: the words are in the text units");
});

test("R88 R104 (G6): a part of a whole that is not held writes nothing, and the whole is `NO_WHOLE_OBJECT`", async () => {
  const { w, d, parts } = await nParts({ n: 3, held: false });
  const r = await w.x.readHeld({ sha: parts[1].sha256 });
  assert.deepEqual([r.ok, r.read, r.why], [true, false, "NO_HOME"]);
  const rw = await w.x.readHeld({ sha: d });
  assert.deepEqual([rw.ok, rw.read, rw.why], [true, false, "NO_WHOLE_OBJECT"]);
  assert.equal(count(w, "readings", parts[1].sha256), 0);
  assert.equal(count(w, "readings", d), 0);
});

test("R88 R104 (G6, G127a): `op=reading` of a part's digest is answered as any digest with no reading (`found: false`), never with its whole's reading", async () => {
  const { w, d, parts } = await nParts({ n: 5 });
  await withEntry(pdfEntry(TEXT), () => w.x.readHeld({ sha: d }));
  assert.equal(w.x.readingFor(d, "class:admin").found, true);
  for (const p of parts) {
    const got = w.x.readingFor(p.sha256, "class:admin");
    assert.deepEqual([got.found, got.capture_sha], [false, p.sha256]);
  }
});

test("R88 R104 (control): a digest a legacy register row homes but no stored document states is `NO_DOCUMENT`; a whole whose own reading failed is answered as itself", async () => {
  const { w, d, parts } = await nParts({ n: 3 });
  const bare = sha("a part no bundle states " + Math.random());
  const rows = new Map(); rows.set(bare, row("INFO-1", 10));
  const w2 = fresh({ evidence: bucket(), provenance: register(rows) });
  bundle(w2.s, "INFO-1");
  const r = await w2.x.readHeld({ sha: bare });
  assert.deepEqual([r.ok, r.read, r.why], [true, false, "NO_DOCUMENT"], "a bare digest is read as no document");
  assert.equal(count(w2, "readings", bare), 0);
  assert.equal(w2.x.readingFor(bare, "class:admin").found, false);
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, composed: true, reading: { found: false, entities: [], failure: "final", basis: "its own failure" } });
  const own = w.x.readingFor(d, "class:admin");
  assert.deepEqual([own.capture_sha, own.reader_found, own.reading.basis], [d, false, "its own failure"]);
  assert.equal(w.x.readingFor(parts[0].sha256, "class:admin").found, false, "its parts answer no reading");
});

test("R88 R104 (control): the whole of a bundle the viewer may not see is answered as an absent record, and its part as a digest nothing holds", async () => {
  const hidden = await nParts({ n: 3, bundleId: "INFO-9" });
  hidden.w.s.sql.exec(`UPDATE bundles SET project='PROJ-9' WHERE bundle_id='INFO-9'`);
  const r = await hidden.w.x.readHeld({ sha: hidden.d, viewer: "member:outsider" });
  assert.deepEqual([r.read, r.why], [false, "NO_HOME"]);
  const rp = await hidden.w.x.readHeld({ sha: hidden.parts[0].sha256, viewer: "member:outsider" });
  assert.deepEqual([rp.read, rp.why], [false, "NO_HOME"]);
  assert.equal(count(hidden.w, "readings", hidden.d), 0);
});

/* ---- R89 (G8): the old "not read as text" readings are owed, with no press ---- */

/* The walker's 0125: two parts of a PDF kept, the whole held, `final` "not read as text (multipart)" as the old chain wrote it. */
const notRead = () => ({ found: false, entities: [], failure: "final", content_type: null, text_source: null,
  basis: localize("reading-pipeline.index.document_not_read_text", "the document was not read as text ({why}), so no reading was attempted",
    { why: localize("reading-pipeline.index.multipart", "multipart") }) });
async function oldMultipart({ n = 2, bundleId = "INFO-1", env = {}, host = null } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows), env, host });
  bundle(w.s, bundleId);
  const bytes = new TextEncoder().encode("%PDF-1.7 an old budget kept in parts " + Math.random());
  const d = sha(bytes);
  const size = Math.ceil(bytes.length / n);
  const parts = Array.from({ length: n }, (_, i) => bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size)))
    .map((b, i) => ({ file: `p${i}.bin`, sha256: sha(b + String(i) + Math.random()), bytes: b.length }));
  for (const p of parts) rows.set(p.sha256, row(bundleId, p.bytes));
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "undetermined", parts });
  w.s.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?,?,?,?,?,?)`,
    bundleId, "data/provenance.json", JSON.stringify({ documents: [document] }), null, 1, "x");
  await evidence.put(`bio/captures/${d}`, bytes);
  w.x.writeReading({ bundleId, captureSha: d, reading: notRead(), composed: true });
  return { w, d, bytes, parts, rows };
}
const ledger = () => { const owed = []; return { owed, owe: async (e) => { owed.push(e); return { ok: true }; } }; };
/* what the plane's tick does with a `reading` entry (plane/pending.mjs `readNow`) */
const tick = (w, d, kind = "reading") => w.x.readHeld({ sha: d, kind, storeName: "bio", env: {} });

test("R89 (G8): the start-up repair owes the ledger a `reading` entry for each held 'not read as text' reading, once; the tick then reads it and it has its text", async () => {
  const { w, d } = await oldMultipart();
  const l = ledger();
  assert.deepEqual(w.x.registerOwe(l.owe), { ok: true });
  const made = await w.x.migrateRepairs();
  assert.deepEqual(l.owed, [{ kind: "reading", sha: d }], JSON.stringify(made));
  assert.equal(made.done, true);
  const again = await w.x.migrateRepairs();
  assert.deepEqual([l.owed.length, again.done, again.examined], [1, true, 0], "the repair is done: nothing is owed twice");
  assert.equal(w.x.readingFor(d, "class:admin").repairable, true, "until it is read, the reading states it may be repaired");
  const r = await withEntry(pdfEntry(TEXT), () => tick(w, d));
  assert.deepEqual([r.ok, r.read], [true, true], JSON.stringify(r));
  const got = w.x.readingFor(d, "class:admin");
  assert.match(got.text_units.map((u) => u.text).join(" "), /alpha beta gamma delta/, "R-STOP: the words are in the text units");
  assert.equal("repairable" in got, false, "a repaired reading states nothing of the kind");
  assert.equal(count(w, "reading_history", d), 2, "R23: the old reading is kept");
});

test("R89 (G8): a repair with no ledger handed in owes nothing and stays undone; once the ledger is handed in on an object it runs", async () => {
  const pending = [];
  const { w, d } = await oldMultipart({ host: { waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() } });
  const none = await w.x.migrateRepairs();
  assert.deepEqual([none.done, none.examined, none.owed], [false, 0, []]);
  const l = ledger();
  w.x.registerOwe(l.owe);
  await Promise.all(pending);
  assert.deepEqual(l.owed, [{ kind: "reading", sha: d }], "handing the ledger in starts the repair");
  assert.equal((await w.x.migrateRepairs()).done, true);
  assert.deepEqual(w.x.registerOwe(l.owe), { ok: false, reason: "LISTENER_DECLARED" }, "once");
  assert.equal(w.x.registerOwe(null).ok, false);
});

test("R89 (G8): a ledger that refuses stops the repair where it was and the next run owes the same entry again", async () => {
  const { w, d } = await oldMultipart();
  let down = true; const owed = [];
  w.x.registerOwe(async (e) => { if (down) return { ok: false, reason: "PENDING_NOT_KEPT" }; owed.push(e); return { ok: true }; });
  const first = await w.x.migrateRepairs();
  assert.deepEqual([first.done, first.examined, owed.length], [false, 0, 0]);
  down = false;
  const second = await w.x.migrateRepairs();
  assert.deepEqual([second.done, owed], [true, [{ kind: "reading", sha: d }]]);
});

test("R89 (control): only a held 'not read as text' reading is owed: not one with text, not an over-ceiling statement, not a failure that is not final, and none a read has tried", async () => {
  const { w, d } = await oldMultipart();
  const other = (reading) => { const b = sha("another capture " + Math.random()); w.x.writeReading({ bundleId: "INFO-1", captureSha: b, reading, composed: true }); return b; };
  other({ found: true, entities: [{ kind: "meeting", key: "1" }], basis: "read" });
  other({ found: false, entities: [], failure: "final", basis: "the capture is 41502904 bytes in 5 parts, over the 25165824 B a format entry is handed here, so it was not read" });
  other({ found: false, entities: [], failure: "transient", basis: notRead().basis });
  const tried = other(notRead());
  w.s.sql.exec(`INSERT INTO reading_repairs (capture_sha, bundle_id, version, outcome, at) VALUES (?,?,?,?,?)`, tried, "INFO-1", "", "undetected", "t");
  const l = ledger();
  w.x.registerOwe(l.owe);
  await w.x.migrateRepairs();
  assert.deepEqual(l.owed.map((e) => e.sha), [d]);
});

test("R89 (G8): a read that finds the held bytes detect nothing ends the entry and the reading stops stating itself repairable; a later release tries it again", async () => {
  const { w, d } = await oldMultipart({ env: { VERSION: "4.7.3" } });
  assert.equal(w.x.readingFor(d, "class:admin").repairable, true);
  const r = await withEntry({ format: "pdf", detect: () => null, structure: null }, () => tick(w, d));
  assert.deepEqual([r.ok, r.read, r.why], [true, false, "READING_HELD"], "the ledger ends the entry on READING_HELD");
  assert.equal("repairable" in w.x.readingFor(d, "class:admin"), false);
  assert.equal(count(w, "reading_repairs", d), 1);
  w.env.VERSION = "4.8.0";   /* the next release over the same store */
  assert.equal(w.x.readingFor(d, "class:admin").repairable, true, "tried under 4.7.3, not under 4.8.0");
});

test("R89 R49: the tried marks are purged with their bundle", async () => {
  const { w, d } = await oldMultipart();
  await withEntry({ format: "pdf", detect: () => null, structure: null }, () => tick(w, d));
  assert.equal(count(w, "reading_repairs", d), 1);
  const owned = (await import("../../../src/extraction/index.mjs")).extractionOwns;
  assert.equal(owned("reading_repairs"), true);
  assert.equal(w.one(`SELECT bundle_id FROM reading_repairs WHERE capture_sha=?`, d).bundle_id, "INFO-1", "keyed to its bundle");
});

/* ---- R90 (G13): a large text is read whole, in pieces, by the ledger ---- */

/* A held text capture read by a scripted provider that answers reading-pipeline's R40 pieces: the first is the reading with its units and
   `piece`, a later one its units alone, a cursor reading-pipeline's own object; each unit one block of `perUnit` bytes at a `doc-para`
   extent numbered from the whole text (global `seq`). The provider is scripted here, so this checks extraction's half alone; the whole
   path with the real reader is `round6-plane.test.mjs`. */
async function pieces({ pieceUnits = [3, 3, 3], perUnit = 40, order = null } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("a long plain text held whole " + Math.random());
  const d = sha(bytes);
  rows.set(d, row("INFO-1", bytes.length));
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "text" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  const all = pieceUnits.reduce((a, b) => a + b, 0), total = all * perUnit, asked = [];
  const starts = pieceUnits.map((_, i) => pieceUnits.slice(0, i).reduce((a, b) => a + b, 0));
  w.x.read = async (docm, opts) => {
    const c = opts.pieces ? opts.pieces.cursor : undefined;
    const i = c ? Number(c) : 0;
    asked.push({ cursor: c, budget: opts.budget });
    if (order) await order(i, w);
    const units = Array.from({ length: pieceUnits[i] }, (_, k) => ({ extent: { kind: "doc-para", para: starts[i] + k, run: null }, seq: starts[i] + k,
      text: `unit ${starts[i] + k} ${"x".repeat(perUnit - 10)}${i === pieceUnits.length - 1 && k === pieceUnits[i] - 1 ? " ENDMARKER" : ""}` }));
    const more = i < pieceUnits.length - 1;
    const fields = { more, cursor: more ? String(i + 1) : null, read_through: (starts[i] + pieceUnits[i]) * perUnit, total };
    const piece = { units: pieceUnits[i], words: pieceUnits[i] * 3 };
    return { ...(i === 0 ? { reading: { found: true, entities: [], text_source: null, basis: "read", text_container: "text", words_total: all * 3, words_read: pieceUnits[0] * 3 } } : {}),
             text_units: units, ...fields, piece };
  };
  return { w, d, asked, total, all };
}

test("R90 (G13): a text read in pieces is read to its end by the ledger's ticks: each tick reads the next piece and answers `more` until the last; ENDMARKER is then in the text units and the state is whole; midway the index holds only what was read and the reading says it has more", async () => {
  const { w, d, asked, total } = await pieces({ pieceUnits: [3, 3, 3] });
  const first = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([first.ok, first.read, first.more, first.detail], [true, true, true, { read_through: 120, total }], JSON.stringify(first));
  assert.equal(w.x.readingFor(d, "class:admin").reading.words_read, 9, "the words read so far, three units of three words");
  let got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.more, got.read_through, got.total], [true, 120, total], "R-STOP: the reading says it has more");
  assert.equal(w.x.unitsOf(d).state, "partial", "never stated whole while more follows");
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'ENDMARKER'`).length, 0, "midway a search finds only what is read");
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'unit'`).length, 3);
  const second = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([second.read, second.more], [true, true]);
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'unit'`).length, 6);
  const last = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([last.ok, last.read, last.more], [true, true, undefined], "the last piece ends the entry");
  assert.deepEqual(asked.map((a) => (a.cursor ? Number(a.cursor) : null)), [null, 1, 2], "each piece from the cursor the last one answered");
  assert.ok(asked.every((a) => a.budget === 2 * 1024 * 1024), "the index's bound is each piece's");
  got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.more, got.read_through, got.total], [false, total, total]);
  assert.equal(got.reading.words_read, got.reading.words_total, "every word read");
  assert.match(got.text_units.map((u) => u.text).join(" "), /ENDMARKER/, "R-STOP: the last line is in the text units");
  assert.deepEqual(got.text_units.map((u) => u.extent.para), [0, 1, 2, 3, 4, 5, 6, 7, 8], "in reading order, each once");
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'ENDMARKER'`).length, 1);
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.offered, st.counts.written, st.counts.over_bound], ["whole", 9, 9, 0]);
  const again = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"], "a finished text is held as any reading is");
  assert.equal(count(w, "reading_history", d), 1, "the pieces change no reading: one is kept");
});

test("R90 R22 (G13): the index's bound is each piece's, not the capture's: a text of 9,000 units and 5 MB is stored whole in three pieces, none over bound", async () => {
  const { w, d } = await pieces({ pieceUnits: [3000, 3000, 3000], perUnit: 600 });
  for (let i = 0; i < 3; i++) await w.x.readHeld({ sha: d, kind: "reading" });
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.written, st.counts.over_bound, st.counts.offered], ["whole", 9000, 0, 9000]);
  const bytes = w.one(`SELECT sum(length(CAST(text AS BLOB))) n FROM capture_text WHERE capture_sha=?`, d).n;
  assert.ok(bytes > 4 * 1024 * 1024 && bytes < 6 * 1024 * 1024, `${bytes} bytes stored, past the 2 MiB of any one piece`);
  assert.equal(w.rows(`SELECT count(*) c FROM capture_text WHERE capture_sha=?`, d)[0].c, 9000);
});

test("R90 R22 R99 (G13; fix round 9, G128f): a piece over the old 4,096-unit bound lands whole, in batches: every unit written, none over bound, and the text whole at its last piece", async () => {
  const { w, d } = await pieces({ pieceUnits: [4100, 5], perUnit: 20 });
  for (let i = 0; i < 2; i++) await w.x.readHeld({ sha: d, kind: "reading" });
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.counts.written, st.counts.over_bound, st.skipped.length], [4105, 0, 0]);
  assert.equal(st.state, "whole");
});

test("R90 (control): a read that is not in pieces is stated as it was: no `more` key, complete at once; and `defer=1` leaves the next piece to the ledger, reading nothing", async () => {
  const w0 = await pieces({ pieceUnits: [3] });
  const was = w0.w.x.read;
  w0.w.x.read = async (...a) => { const { piece, more, cursor, read_through, total, ...rest } = await was(...a); return rest; };
  const r = await w0.w.x.readHeld({ sha: w0.d, kind: "reading" });
  assert.deepEqual([r.read, r.more], [true, undefined]);
  const got = w0.w.x.readingFor(w0.d, "class:admin");
  assert.equal("more" in got, false, "absent, not false: a read not in pieces states no progress");
  assert.equal(w0.w.x.unitsOf(w0.d).state, "whole");
  const w1 = await pieces({ pieceUnits: [2, 2] });
  await w1.w.x.readHeld({ sha: w1.d, kind: "reading" });
  const pending = await w1.w.x.readHeld({ sha: w1.d, kind: "reading", defer: true });
  assert.deepEqual([pending.read, pending.why], [false, "READING_PENDING"]);
  assert.equal(w1.asked.length, 1, "nothing was read");
});

test("R90 (control): a cursor the reader refuses is stated and ends the entry, the units already read stay; a piece that lands after the state moved is not added", async () => {
  const bad = await pieces({ pieceUnits: [2, 2] });
  await bad.w.x.readHeld({ sha: bad.d, kind: "reading" });
  const was = bad.w.x.read;
  bad.w.x.read = async (docm, opts) => (!opts.pieces || !opts.pieces.cursor ? was(docm, opts)
    : { refused: { code: "CURSOR_MISMATCH", why: "the held bytes are not the ones this cursor was made from" } });
  const r = await bad.w.x.readHeld({ sha: bad.d, kind: "reading" });
  assert.deepEqual([r.ok, r.read, r.final], [true, false, true]);
  assert.match(r.why, /not the ones this cursor was made from/);
  assert.equal(bad.w.x.unitsOf(bad.d).units.length, 2, "what was read stays");
  /* the state moves while a piece is being read: the stale piece is dropped */
  const race = await pieces({ pieceUnits: [2, 2, 2], order: (i, w) => { if (i === 1) w.s.sql.exec(`UPDATE capture_text_state SET cursor='9'`); } });
  await race.w.x.readHeld({ sha: race.d, kind: "reading" });
  const lost = await race.w.x.readHeld({ sha: race.d, kind: "reading" });
  assert.deepEqual([lost.read, lost.why], [false, "READING_HELD"]);
  assert.equal(race.w.x.unitsOf(race.d).units.length, 2);
});

test("R90 (control): a reading of a viewer's hidden bundle states no progress", async () => {
  const { w, d } = await pieces({ pieceUnits: [2, 2] });
  await w.x.readHeld({ sha: d, kind: "reading" });
  w.s.sql.exec(`UPDATE bundles SET project='PROJ-9' WHERE bundle_id='INFO-1'`);
  const got = w.x.readingFor(d, "member:outsider");
  assert.equal(got.bundle_id, null);
  assert.equal("more" in got, false);
  assert.equal("text_units" in got, false);
});

/* ---- R90: a text the index holds only in part, written without pieces, is read again in pieces ---- */

/* The acquire wire's partial text, as a promotion stores it: the first units, the rest counted over the wire's bound. */
async function wirePartial({ container = "text" } = {}) {
  const made = await pieces({ pieceUnits: [3, 3], perUnit: 40 });
  const { w, d } = made;
  const wireReading = { found: true, entities: [], text_source: null, basis: "read", text_container: container, words_total: 18, words_read: 6 };
  const units = [0, 1].map((k) => ({ extent: { kind: "doc-para", para: k, run: null }, seq: k, text: `wire unit ${k} ${"x".repeat(30)}` }));
  return { ...made, wireReading, units, write: () => w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: wireReading, textUnits: units,
                                                                       textUnitsOverBound: 4, composed: true }) };
}

test("R90 (G13): a text promoted with its units over the acquire wire's bound is read again in pieces from its start: the wire's units are replaced, the ledger is owed once the write commits, and the text ends whole", async () => {
  const { w, d, write, asked } = await wirePartial();
  const owed = [];
  w.x.registerOwe(async (e) => { owed.push(e); return { ok: true }; });
  write();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(owed, [{ kind: "reading", sha: d }], "owed once the write has committed");
  assert.equal(w.x.unitsOf(d).state, "partial");
  const before = w.x.readingFor(d, "class:admin");
  assert.deepEqual([before.more, before.read_through, before.total], [true, null, null], "it says it has more, and not yet how far");
  const first = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([first.read, first.more], [true, true], JSON.stringify(first));
  assert.deepEqual(asked.map((a) => (a.cursor ? Number(a.cursor) : null)), [null], "from its start");
  assert.equal(w.rows(`SELECT count(*) c FROM capture_text WHERE capture_sha=? AND text LIKE 'wire unit%'`, d)[0].c, 0, "the wire's units are replaced by the first piece's");
  const last = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([last.read, last.more], [true, undefined]);
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.written, st.counts.over_bound], ["whole", 6, 0]);
  assert.match(w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" "), /ENDMARKER/, "R-STOP");
  assert.equal(count(w, "reading_history", d), 1, "the reading stands: one is kept");
});

test("R90 R91 (G13, G14): a reading of any format whose index is over its bound is read again in pieces; one the reader cannot continue by a cursor ends as stated partial, once; a piece state given or a reading within the bound is not touched", async () => {
  for (const container of ["pdf", "docx"]) {
    const { w, d, write } = await wirePartial({ container });
    const owed = [];
    w.x.registerOwe(async (e) => { owed.push(e); return { ok: true }; });
    write();
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(owed, [{ kind: "reading", sha: d }], container);
    assert.equal(w.one(`SELECT more FROM capture_text_state WHERE capture_sha=?`, d).more, 1);
    const was = w.x.read;
    w.x.read = async () => ({ refused: { code: "NOT_PIECEWISE", why: "not a text" } });
    const r = await w.x.readHeld({ sha: d, kind: "reading" });
    assert.deepEqual([r.read, r.why], [false, "READING_HELD"], "the entry ends");
    const got = w.x.readingFor(d, "class:admin");
    assert.equal(got.completeness.state, "partial", "stated partial, never whole");
    assert.equal(got.completeness.counts.over_bound, 4);
    assert.equal("more" in got, false);
    w.x.read = was;
    assert.equal((await w.x.readHeld({ sha: d, kind: "reading" })).why, "READING_HELD", "once");
  }
  const { w, d, wireReading, units } = await wirePartial();
  const owed = [];
  w.x.registerOwe(async (e) => { owed.push(e); return { ok: true }; });
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: wireReading, textUnits: units, textUnitsOverBound: 4, composed: true,
                     more: { more: true, cursor: "1", read_through: 80, total: 240, words: 6 } });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(owed, [], "a read in pieces is the ledger's already");
  const fit = await pieces({ pieceUnits: [2] });
  const fitOwed = [];
  fit.w.x.registerOwe(async (e) => { fitOwed.push(e); return { ok: true }; });
  fit.w.x.writeReading({ bundleId: "INFO-1", captureSha: fit.d, reading: { found: true, entities: [], text_container: "text" }, textUnits: [{ extent: { kind: "doc-para", para: 0, run: null }, seq: 0, text: "short" }], composed: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(fitOwed, []);
});

test("R91 (G14): op=reading states the capture's completeness and its units so far: whole, partial with the runs skipped, stated for a document refused whole, none; a hidden bundle states none of it", async () => {
  const { w, d } = await pieces({ pieceUnits: [3, 3] });
  await w.x.readHeld({ sha: d, kind: "reading" });
  let got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.completeness.state, got.units_total], ["partial", 3], "being read: partial, three units so far");
  await w.x.readHeld({ sha: d, kind: "reading" });
  got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.completeness.state, got.units_total, got.completeness.counts.written, got.completeness.skipped], ["whole", 6, 6, []]);
  const cut = await wirePartial();
  cut.write();
  const c = cut.w.x.readingFor(cut.d, "class:admin").completeness;
  assert.deepEqual([c.state, c.counts.over_bound], ["partial", 4]);
  const refused = await nParts({ n: 3 });
  refused.w.x.writeReading({ bundleId: "INFO-1", captureSha: refused.d, composed: true,
    reading: { found: false, entities: [], failure: "final", basis: "the capture is 41502904 bytes in 5 parts, over the 25165824 B a format entry is handed here, so it was not read" } });
  const s = refused.w.x.readingFor(refused.d, "class:admin").completeness;
  assert.deepEqual([s.state, s.failure, /41502904/.test(s.why)], ["stated", "final", true], "stated with its reason, never none or full");
  const never = fresh();
  assert.equal(never.x.readingFor(sha("x"), "class:admin").found, false);
  w.s.sql.exec(`UPDATE bundles SET project='PROJ-9' WHERE bundle_id='INFO-1'`);
  const hidden = w.x.readingFor(d, "member:outsider");
  assert.equal("completeness" in hidden || "units_total" in hidden, false);
});

test("R91 (G14): the pages a skipped run covers are unread, not read: a PDF reading whose index skipped pages over its bound names them in unread_pages", async () => {
  const w = fresh();
  bundle(w.s, "B-1", { type: "information" });
  const d = sha("a pdf over the bound");
  const pg = (page) => ({ extent: { kind: "pdf-page", page }, seq: page, text: `page ${page} words` });
  w.x.writeReading({ bundleId: "B-1", captureSha: d, composed: true,
    reading: { found: false, entities: [], basis: "b", page_count: 5, text_source: null },
    textUnits: [pg(0), pg(1)], textUnitsOverBound: 0,
    textUnitsSkipped: [{ first: pg(3).extent, last: pg(4).extent, first_seq: 3, last_seq: 4, units: 2 }] });
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual(got.unread_pages, [2, 3, 4], "page 2 holds no unit, pages 3 and 4 were skipped: all unread");
});

test("R90 R89 (G13, R-OLD): the start-up repair owes the ledger each text the index holds only in part and each text read in pieces with more to read, once, and marks the first to be read again from its start", async () => {
  const old = await wirePartial();           /* the walker's 12 MB text as an earlier release stored it: partial, no piece state */
  old.write();
  const mid = await pieces({ pieceUnits: [2, 2, 2] });
  await mid.w.x.readHeld({ sha: mid.d, kind: "reading" });   /* mid-way: more to read */
  const owedOld = [], owedMid = [];
  old.w.x.registerOwe(async (e) => { owedOld.push(e.sha); return { ok: true }; });
  mid.w.x.registerOwe(async (e) => { owedMid.push(e.sha); return { ok: true }; });
  const a = await old.w.x.migrateRepairs();
  const b = await mid.w.x.migrateRepairs();
  assert.deepEqual([owedOld, a.done], [[old.d], true]);
  assert.deepEqual([owedMid, b.done], [[mid.d], true]);
  assert.equal(old.w.one(`SELECT more, cursor FROM capture_text_state WHERE capture_sha=?`, old.d).more, 1, "marked for the first piece");
  assert.equal(old.w.one(`SELECT cursor FROM capture_text_state WHERE capture_sha=?`, old.d).cursor, null);
  /* the tick that follows reads it to its end */
  const first = await old.w.x.readHeld({ sha: old.d, kind: "reading" });
  assert.equal(first.more, true);
  const last = await old.w.x.readHeld({ sha: old.d, kind: "reading" });
  assert.deepEqual([last.read, last.more], [true, undefined]);
  assert.equal(old.w.x.unitsOf(old.d).state, "whole");
  assert.equal((await old.w.x.migrateRepairs()).examined, 0, "once");
});

/* ---- R76 amended (K4577): every unit of a capture read whole is reachable through op=reading, a page at a time ---- */

const viaDoor = (w, d, viewer, after = null) => {
  const q = new URLSearchParams({ sha256: d, store: "bio", viewer, ...(after === null ? {} : { after: String(after) }) });
  return extractionOps(w.x, new URL(`http://x/reading?${q}`), null, {}).reading();
};

test("R76 R90 (G13): `op=reading` answers at most 4,096 units and `next`, the seq to ask after the page, null at the end; asking `after` it reaches every unit of a 9,000-unit text, each once, in order", async () => {
  const { w, d } = await pieces({ pieceUnits: [3000, 3000, 3000], perUnit: 30 });
  for (let i = 0; i < 3; i++) await w.x.readHeld({ sha: d, kind: "reading" });
  const seen = [], pages = [];
  let after = null, guard = 0;
  do {
    const page = viaDoor(w, d, "class:admin", after);
    assert.equal(page.found, true);
    assert.ok(page.text_units.length <= 4096, "a page is at most 4,096 units");
    pages.push([page.text_units.length, page.next]);
    for (const u of page.text_units) seen.push(u.extent.para);
    after = page.next;
  } while (after !== null && ++guard < 10);
  assert.deepEqual(pages, [[4096, 4095], [4096, 8191], [808, null]]);
  assert.deepEqual(seen, Array.from({ length: 9000 }, (_, i) => i), "every unit once, in reading order");
  assert.match(viaDoor(w, d, "class:admin", 8191).text_units.map((u) => u.text).join(" "), /ENDMARKER/, "R-STOP: the last line is reached by paging");
});

test("R76 (control): a capture of at most 4,096 units is one page with `next` null; `after` past the end is an empty page; a malformed `after` asks from the start; a viewer refused the bundle gets no page", async () => {
  const { w, d } = await pieces({ pieceUnits: [3, 3], perUnit: 30 });
  await w.x.readHeld({ sha: d, kind: "reading" });
  await w.x.readHeld({ sha: d, kind: "reading" });
  const one = viaDoor(w, d, "class:admin");
  assert.deepEqual([one.text_units.length, one.next], [6, null]);
  const past = viaDoor(w, d, "class:admin", 99);
  assert.deepEqual([past.text_units, past.next], [[], null]);
  const url = new URL(`http://x/reading?sha256=${d}&store=bio&viewer=class%3Aadmin&after=abc`);
  assert.equal(extractionOps(w.x, url, null, {}).reading().text_units.length, 6, "a malformed after is no page position");
  w.s.sql.exec(`UPDATE bundles SET project='PROJ-9' WHERE bundle_id='INFO-1'`);
  const hidden = viaDoor(w, d, "member:outsider", 0);
  assert.equal("text_units" in hidden, false);
  assert.equal("next" in hidden, false);
});

/* ---- R90 (R-OLD): a store whose index state was made before pieces gains the columns and states nothing it did not know ---- */

test("R90 (R-OLD): a store made before the piece state gains its columns at the next boot, keeps every row, and its readings state no progress", async () => {
  const { w, d } = await pieces({ pieceUnits: [3] });
  await w.x.readHeld({ sha: d, kind: "reading" });
  const keep = w.one(`SELECT state, offered, written FROM capture_text_state WHERE capture_sha=?`, d);
  /* the table as an earlier release made it: no more, cursor, read_through, total, words_read */
  w.s.db.exec(`CREATE TABLE old_state AS SELECT capture_sha, bundle_id, state, offered, written, over_bound, unaddressable, truncated, skipped_named, chain_kind, at FROM capture_text_state`);
  w.s.db.exec(`DROP TABLE capture_text_state`);
  w.s.db.exec(`ALTER TABLE old_state RENAME TO capture_text_state`);
  assert.equal(w.rows(`PRAGMA table_info(capture_text_state)`).some((c) => c.name === "more"), false);
  w.x.migrate();
  const cols = w.rows(`PRAGMA table_info(capture_text_state)`).map((c) => c.name);
  for (const c of ["more", "cursor", "read_through", "total", "words_read"]) assert.ok(cols.includes(c), c);
  assert.deepEqual({ ...w.one(`SELECT state, offered, written FROM capture_text_state WHERE capture_sha=?`, d) }, { ...keep });
  const got = w.x.readingFor(d, "class:admin");
  assert.equal("more" in got, false, "an old state says nothing of pieces");
  assert.equal(w.x.unitsOf(d).state, keep.state);
});

test("R22 (G15): a sheet read in row blocks is indexed block by block: units of one sheet with different row ranges are each kept, found by search, their addresses distinct; a repeated range is counted unaddressable", async () => {
  const w = fresh();
  bundle(w.s, "B-1", { type: "information" });
  const d = sha("a long sheet");
  const block = (from, to, extra = "") => ({ extent: { kind: "sheet-range", sheet: "Sheet1", range: `A${from}:C${to}` }, seq: from,
    text: `name,place,amount\nrow ${from} council${extra}` });
  const r = w.x.writeReading({ bundleId: "B-1", captureSha: d, composed: true, reading: { found: false, entities: [], basis: "b" },
    textUnits: [block(1, 500), block(501, 1000), block(1001, 1500, " LASTROW"), block(501, 1000)] });
  assert.deepEqual([r.indexed.written, r.indexed.unaddressable], [3, 1]);
  const refs = w.rows(`SELECT ref FROM capture_text WHERE capture_sha=? ORDER BY seq`, d).map((x) => x.ref);
  assert.equal(new Set(refs).size, 3);
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'LASTROW'`).length, 1);
});
