/* extraction, N26: moving the ¶ and table references of `.docx` readings made before N26 (R66; office-readers R11,
   R16, R28; K747, K763), and the promotion projection that does not undo it (R20). A reading "made before N26" is
   built here as the old walk wrote it (every branch of an mc:AlternateContent numbered), over bytes held in the
   evidence store; the migration re-reads those bytes through the docx entry and moves the references by
   `docxRenumbering`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, wp, wr, wtbl, box, alt, docx, doc, bucket } from "./fixture.mjs";
import { n26MigratedReading, n26Marked, renumberingMoves, N26_READER_MARK, Extraction } from "../../../src/extraction/index.mjs";
import { textUnitsFor, layerChainFor, readingProvenance } from "../../../src/reading-pipeline/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { docxRenumbering } from "../../../src/docx.mjs";
import { glyphCount } from "../../../src/textchain.mjs";

/* The document: a paragraph holding a text box (Choice and its Fallback copy), a plain paragraph, a paragraph holding
   a boxed table (Choice) whose Fallback holds a second copy, and a table after. Under N26: six paragraphs, two tables;
   the old walk numbered eight paragraphs and three tables. */
const BODY = wp(wr("before "), box([wp(wr("boxed"))]), wr("after")) + wp(wr("next"))
  + wp(box([wtbl("t in box")])) + wtbl("after table");
const OLD_PARAS = ["before after", "boxed", "boxed", "next", "", "t in box", "t in box", "after table"];
const NEW_PARAS = ["before after", "boxed", "next", "", "t in box", "after table"];
const P = (para, run) => ({ kind: "doc-para", ref: `¶${para + 1}`, para, run: run ?? null });
const T = (table, cell) => ({ kind: "doc-table", ref: `table ${table + 1}${cell ? `, ${cell}` : ""}`, table, ...(cell ? { cell } : {}) });
const AT = "2026-09-01T00:00:00Z";

const oldText = () => {
  const paragraphs = OLD_PARAS.map((text, para) => ({ para, ref: `¶${para + 1}`, text }));
  const document = OLD_PARAS.filter((t) => t.length).join("\n");
  return { ok: true, container: "docx", document, paragraphs, tables: [0, 1, 2].map((t) => ({ table: t, ref: `table ${t + 1}`, rows: 1, cols: 1 })),
           undetermined: [], counts: { chars: document.length, undetermined: 0 } };
};

/* The reading as the pre-N26 read composed it: references at the old numbers, the old paragraph count and tables. */
async function oldReading() {
  const text = oldText();
  const chain = layerChainFor(text, { tier: 1, container: "docx" });
  return {
    content_type: "doc", reader_version: 1, read_from_text: true, found: true, at: AT,
    entities: [
      { key: "1", kind: "item", label: "Next", facts: {}, ref: "item:1", source: P(3),
        occurrences: [P(1), P(2), P(7)] },
      { key: "b", kind: "box", label: "Boxed", facts: {}, ref: "box:b", source: P(2, 0) },
      { key: "t", kind: "tbl", label: null, facts: {}, ref: "tbl:t", source: T(2, "A1") },
      { key: "g", kind: "gone", label: null, facts: {}, ref: "gone:g", source: T(1) },
    ],
    facts: { link: { partition: "anchor", wrapper: "anchor:#para=7", target: { para: 6, fragment: "#para=7", bookmark: "bm" },
                     source: P(7, 0) } },
    text_source: chain, text_tier: 1, text_container: "docx", basis: "read by the doc reader",
    position_parts: 8, position_why: null, page_count: null, page_boxes: null,
    container_extent: { container: "docx", levels: ["paragraphs", "tables"], sheets: null, paragraphs: 8, slides: null,
                        tables: [{ rows: 1, cols: 1 }, { rows: 1, cols: 9 }, { rows: 1, cols: 2 }] },
    provenance: await readingProvenance({ text, chain, tier: 1, container: "docx" }),
    text_chars: text.document.length, text_glyphs: glyphCount(text.document), text_undetermined: 0,
  };
}

/* A store holding the document's bytes and its old reading in bundle INFO-1. */
async function seeded({ body = BODY, reading = null, evidence = bucket(), origin = "composed", author = null } = {}) {
  const f = fresh({ evidence });
  const digest = await hold(evidence, docx(body));
  bundle(f.s, "INFO-1");
  const r = reading || await oldReading();
  const u = textUnitsFor(oldText());
  const notices = [];
  f.x.onReading("observation-log", (e) => { notices.push(e); return null; });
  f.x.writeReading({ bundleId: "INFO-1", captureSha: digest, reading: r, textUnits: u.textUnits, profileFormat: "docx",
                     composed: origin === "composed", author, justification: origin === "asserted" ? "read it aloud" : null });
  notices.length = 0;
  return { ...f, digest, old: r, notices };
}

test("R66 R28: renumbering's map over the stored document.xml moves paragraphs, runs and tables, and a document with no mc:AlternateContent moves nothing", async () => {
  const xml = (b) => `<w:document><w:body>${b}</w:body></w:document>`;
  const map = docxRenumbering(xml(BODY));
  assert.equal(renumberingMoves(map), true);
  assert.deepEqual(map.paragraphs.map((p) => p.new), [0, 1, null, 2, 3, 4, null, 5]);
  assert.equal(renumberingMoves(docxRenumbering(xml(wp(wr("a")) + wtbl("b")))), false);
  assert.equal(renumberingMoves(null), false);
});

test("R66: a pre-N26 docx reading is migrated once: re-read from its bytes, every reference moved, the old reading kept, the chain marked, R19's writer and its listeners", async () => {
  const f = await seeded();
  const out = await f.x.migrateDocxReadings();
  assert.equal(out.done, true);
  assert.equal(out.examined, 1);
  assert.deepEqual(out.migrated.map((m) => m.capture_sha), [f.digest]);
  const got = f.x.readingFor(f.digest).reading;
  const [item, boxed, tbl, gone] = got.entities;
  /* doc-para: to `new`, and its ref; inside a branch not read: to `outer`, a whole paragraph, no run. */
  assert.deepEqual(item.source, P(2));
  assert.deepEqual(item.occurrences, [P(1), P(0), P(5)]);
  assert.deepEqual(boxed.source, P(0));
  /* doc-table: to `new` with its ref and cell; one in a branch not read is unplaced. */
  assert.deepEqual(tbl.source, T(1, "A1"));
  assert.equal(gone.source, null);
  /* a #para= anchor's target and the link's run source. */
  assert.deepEqual(got.facts.link.target, { para: 3, fragment: "#para=4", bookmark: "bm" });
  assert.equal(got.facts.link.wrapper, "anchor:#para=4");
  assert.deepEqual(got.facts.link.source, P(5, 0));
  /* the paragraph count, the tables N26 reads in its order, and the text's counts: the duplicate lost, nothing gained. */
  assert.equal(got.container_extent.paragraphs, 6);
  assert.deepEqual(got.container_extent.tables, [{ rows: 1, cols: 1 }, { rows: 1, cols: 2 }]);
  const doc = NEW_PARAS.filter((t) => t.length).join("\n");
  assert.deepEqual([got.text_chars, got.text_glyphs, got.text_undetermined], [doc.length, glyphCount(doc), 0]);
  /* the mark, the migration's own statement, and what did not change. */
  assert.equal(got.text_source[0].reader, N26_READER_MARK);
  assert.equal(n26Marked(got), true);
  assert.equal(n26Marked(f.old), false);
  assert.deepEqual(got.migrated.n26.moved, { paragraphs: 4, runs: 2, tables: 2, unplaced: 1 });
  for (const k of ["content_type", "reader_version", "at", "basis", "found", "text_tier", "text_container"])
    assert.deepEqual(got[k], f.old[k], k);
  assert.notEqual(got.provenance.text_sha256, f.old.provenance.text_sha256);
  /* R23: the reading it replaces is kept, then the new one. */
  const hist = f.rows(`SELECT reading FROM reading_history WHERE capture_sha=? ORDER BY seq`, f.digest);
  assert.deepEqual(hist.map((h) => JSON.parse(h.reading)), [f.old, got]);
  /* the text units rebuilt by R22 at N26's numbering, no duplicated branch; the references' places moved. */
  /* (fix round 9, K4896) the text box's text is also its own `doc-part` unit (reading-pipeline R47, G134d: every part marked with its kind), beside
     the paragraph units, which are N26's numbering */
  const units = f.rows(`SELECT extent_kind, extent, text FROM capture_text WHERE capture_sha=? ORDER BY seq`, f.digest);
  assert.deepEqual(units.filter((u) => u.extent_kind === "doc-para").map((u) => [JSON.parse(u.extent).para, u.text]),
                   /* (K4985, G166) a text box's paragraphs (1 and 4) are its `doc-part` unit only, never also a body paragraph */
                   NEW_PARAS.map((t, i) => [i, t]).filter(([i, t]) => t.length && i !== 1 && i !== 4));
  assert.deepEqual(units.filter((u) => u.extent_kind !== "doc-para").map((u) => [u.extent_kind, u.text]), [["doc-part", "boxed"], ["doc-part", "t in box"]]);
  /* K4929: both text boxes are their own units since office-readers R38 gives each its own `ref` (before, the second shared `ref: null` and was dropped as already written) */
  assert.deepEqual(f.rows(`SELECT occurrence FROM reading_refs WHERE ref='item:1' ORDER BY seq`).map((r) => r.occurrence),
                   [2, 1, 0, 5].map((p) => `doc-para:${JSON.stringify({ para: p, run: null })}`));
  /* R19's listeners ran once, the plane's act, with the chain before and after differing (content R22 stales on it). */
  assert.equal(f.notices.length, 1);
  const e = f.notices[0];
  assert.equal(e.author, null);
  assert.notDeepEqual(e.chainAfter, e.chainBefore);
  assert.deepEqual(e.unitsBefore.map((u) => u.text), OLD_PARAS.filter((t) => t.length));
  /* once: a second run reads nothing and moves nothing. */
  const again = await f.x.migrateDocxReadings();
  assert.deepEqual([again.done, again.examined, again.migrated], [true, 0, []]);
  assert.deepEqual(f.x.readingFor(f.digest).reading, got);
  assert.equal(f.notices.length, 1);
});

test("R66: a docx reading whose renumbering moves nothing gets no mark and no re-read; a reading of another format is not a candidate", async () => {
  const plain = wp(wr("one")) + wp(wr("two")) + wtbl("t");
  const evidence = bucket();
  const f = await seeded({ body: plain, evidence });
  const html = await hold(evidence, "<p>x</p>");
  f.x.writeReading({ bundleId: "INFO-1", captureSha: html, reading: { content_type: "doc", found: false, entities: [], at: AT,
    text_source: layerChainFor(null, { tier: 1, container: "html" }) }, profileFormat: "html", composed: true });
  f.notices.length = 0;
  const before = f.rows(`SELECT * FROM readings ORDER BY capture_sha`);
  const out = await f.x.migrateDocxReadings();
  assert.deepEqual([out.done, out.examined, out.unmoved, out.migrated], [true, 1, 1, []]);
  assert.deepEqual(f.rows(`SELECT * FROM readings ORDER BY capture_sha`), before);
  assert.equal(f.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, f.digest).c, 1);
  assert.equal(n26Marked(f.x.readingFor(f.digest).reading), false);
  assert.equal(f.notices.length, 0);
});

test("R66: a reading already marked moves nothing; one written after the migration's cutoff, or whose paragraph count is N26's, is left as it is", async () => {
  /* Marked: the migrated reading carried into another store. */
  const a = await seeded();
  await a.x.migrateDocxReadings();
  const marked = a.x.readingFor(a.digest).reading;
  const b = await seeded({ reading: marked });
  const ob = await b.x.migrateDocxReadings();
  assert.deepEqual(ob.skipped.map((s) => s.why), ["already migrated"]);
  assert.deepEqual(b.x.readingFor(b.digest).reading, marked);
  /* N26's paragraph count: a reading the new walk made. */
  const fresh26 = { ...(await oldReading()), container_extent: { container: "docx", levels: ["paragraphs"], paragraphs: 6 } };
  const c = await seeded({ reading: fresh26 });
  const oc = await c.x.migrateDocxReadings();
  assert.equal(oc.migrated.length, 0);
  assert.match(oc.skipped[0].why, /paragraph count/);
  assert.deepEqual(c.x.readingFor(c.digest).reading, fresh26);
  /* After the cutoff: two old readings; the first run takes one; the other is then written again (a promotion after
     the migration started, so N26's), and the second run leaves it as it is. */
  const evidence = bucket();
  const d = await seeded({ evidence });
  const other = await hold(evidence, docx(BODY + wp(wr("tail"))));
  d.x.writeReading({ bundleId: "INFO-1", captureSha: other, reading: await oldReading(), profileFormat: "docx", composed: true });
  const first = await d.x.migrateDocxReadings({ limit: 1 });
  assert.deepEqual([first.done, first.examined], [false, 1]);
  const [, late] = [d.digest, other].sort();
  const rewritten = { ...(await oldReading()), basis: "written again after the migration started" };
  d.x.writeReading({ bundleId: "INFO-1", captureSha: late, reading: rewritten, profileFormat: "docx", composed: true });
  const rest = await d.x.migrateDocxReadings();
  assert.deepEqual([rest.done, rest.examined, rest.migrated.length], [true, 1, 0]);
  assert.match(rest.skipped[0].why, /after the migration's cutoff/);
  assert.deepEqual(d.x.readingFor(late).reading, rewritten);
});

test("R66: bytes not held, or a stored reading that changed while the bytes were read, leave the stored reading as it stands", async () => {
  /* not held */
  const ev1 = bucket();
  const a = await seeded({ evidence: ev1 });
  ev1.held.clear();
  const oa = await a.x.migrateDocxReadings();
  assert.match(oa.skipped[0].why, /not held/);
  assert.deepEqual(a.x.readingFor(a.digest).reading, a.old);
  /* a newer reading lands while the bytes are being read: it stands */
  const ev2 = bucket();
  const b = await seeded({ evidence: ev2 });
  const newer = { ...(await oldReading()), basis: "a promotion that landed meanwhile" };
  const get = ev2.get.bind(ev2);
  ev2.get = async (k) => { b.x.writeReading({ bundleId: "INFO-1", captureSha: b.digest, reading: newer, composed: true }); return get(k); };
  const ob = await b.x.migrateDocxReadings();
  assert.match(ob.skipped[0].why, /changed while/);
  assert.deepEqual(b.x.readingFor(b.digest).reading, newer);
});

test("R66 (DEC-149): with no evidence store set up, the stored reading is left as it stands, saying your group's Civicsmith cannot read the stored bytes again", async () => {
  const f = await seeded();
  f.core.evidenceStore = () => null;
  const out = await f.x.migrateDocxReadings();
  assert.deepEqual(out.skipped.map((s) => s.why),
                   [localize("extraction.index.no_evidence_store_set_up", "your team's Civicsmith has no evidence store set up, so the stored bytes cannot be read again")]);
  assert.deepEqual(f.x.readingFor(f.digest).reading, f.old);
});

test("R66 R21: an asserted reading stays the caller's assertion, with its standing and justification, after it is moved", async () => {
  const f = await seeded({ origin: "asserted", author: "member:ruth" });
  const before = f.x.readingFor(f.digest).origin;
  assert.equal(before.state, "asserted");
  await f.x.migrateDocxReadings();
  const after = f.x.readingFor(f.digest);
  assert.deepEqual(after.origin, before);
  assert.equal(n26Marked(after.reading), true);
});

test("R66 R44 R46: the pure migration re-grades and resolves nothing, changes the reading handed in not at all, and keeps an absent key absent", async () => {
  const old = await oldReading();
  const copy = JSON.parse(JSON.stringify(old));
  const map = docxRenumbering(`<w:document><w:body>${BODY}</w:body></w:document>`);
  const text = { paragraphs: NEW_PARAS.map((t, para) => ({ para, text: t })), document: NEW_PARAS.filter(Boolean).join("\n"),
                 counts: { chars: 0, undetermined: 0 } };
  const next = n26MigratedReading(old, map, text, { at: "2026-10-01T00:00:00Z" });
  assert.deepEqual(old, copy);
  assert.deepEqual(next.entities.map((e) => [e.ref, e.kind, e.key, e.label]), old.entities.map((e) => [e.ref, e.kind, e.key, e.label]));
  const bare = { ...old }; delete bare.text_chars; delete bare.text_glyphs; delete bare.text_undetermined; delete bare.container_extent;
  const n2 = n26MigratedReading(bare, map, text);
  for (const k of ["text_chars", "text_glyphs", "text_undetermined", "container_extent"]) assert.equal(k in n2, false, k);
});

test("R20 R66: a promotion re-submitting the pre-N26 reading with the same `at` does not undo the migration; a reading with another `at` replaces it", async () => {
  const f = await seeded();
  await f.x.migrateDocxReadings();
  const migrated = f.x.readingFor(f.digest).reading;
  const files = (reading) => [{ path: "data/provenance.json",
    text: JSON.stringify({ documents: [{ capture: { sha256: f.digest }, reading, profile: { format: { format: "docx" } } }] }) }];
  f.x.projectPromotion({ bundleId: "INFO-1", files: files(f.old), author: null });
  assert.deepEqual(f.x.readingFor(f.digest).reading, migrated);
  const later = { ...f.old, at: "2026-09-30T00:00:00Z" };
  f.x.projectPromotion({ bundleId: "INFO-1", files: files(later), author: null });
  assert.deepEqual(f.x.readingFor(f.digest).reading, later);
});

test("R66: on a Durable Object the migration is started by migrate() and carried by the object's waitUntil, once", async () => {
  const f = await seeded();
  const { Extraction } = await import("../../../src/extraction/index.mjs");
  /* The object restarting over the same storage: record-core's seams as the object hands them (purge already declared). */
  const record = { evidenceStore: () => f.core.evidenceStore(), transact: (fn) => f.core.transact(fn), readFile: () => null };
  const waited = [];
  const x2 = new Extraction(f.s, { record, membership: f.membership, env: {}, host: { waitUntil: (p) => waited.push(p) } });
  x2.migrate();
  assert.equal(waited.length, 1);
  await waited[0];
  assert.equal(n26Marked(f.x.readingFor(f.digest).reading), true);
  x2.migrate();
  assert.equal(waited.length, 1);
  /* no host, no background run */
  const x3 = new Extraction(f.s, { record, membership: f.membership, env: {} });
  assert.equal(x3.startMigrations(), null);
});

/* ---- T38 (N786): no reading carrying a `.docx` cell's `paras` (office-readers R11) is migrated ---- */

const DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const AFTER_N26 = "read after N26 (its reading was written after the migration's cutoff)";
/* A table cell whose paragraph holds a run-level mc:AlternateContent: the branch not read moves a run and no paragraph,
   so the paragraph-count check (`oldWalk`) alone does not tell this N26 reading from an old one. */
const RUN_BODY = wp(wr("head")) + `<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc>${wp(alt(wr("choice"), wr("fallback")))}</w:tc></w:tr></w:tbl>`;

/* N26's own reading of `body` (`read`, R1): its cells carry `paras`, as every reading since T37-4 does. */
async function readNow(w, body) {
  const bytes = docx(body);
  const d = await hold(w.evidence, bytes);
  const r = await w.x.read(doc({ digest: d, bytes: bytes.length, ct: DOCX_CT, format: "docx", headers: [["content-type", DOCX_CT]] }));
  const cells = Object.values(r.reading.cells || {}).flat();
  assert.ok(cells.length && cells.every((c) => Array.isArray(c.paras) && c.paras.length), "the reading carries cells with paras");
  assert.equal(renumberingMoves(docxRenumbering(`<w:document><w:body>${body}</w:body></w:document>`)), true,
               "the document holds a branch N26 does not read");
  return { d, r };
}
const lastKept = (w, d) => w.one(`SELECT rowid AS n, reading FROM reading_history WHERE capture_sha=? ORDER BY seq DESC LIMIT 1`, d);
/* The object restarting over the same storage, as n26's own restart test builds it: migrate() takes or keeps the cutoff. */
async function restart(w) {
  const record = { evidenceStore: () => w.core.evidenceStore(), transact: (fn) => w.core.transact(fn), readFile: () => null };
  const waited = [];
  const x = new Extraction(w.s, { record, membership: w.membership, env: {}, host: { waitUntil: (p) => waited.push(p) } });
  x.migrate();
  await Promise.all(waited);
  return x;
}

test("R66 (T38, N786): a stored reading carrying a .docx cell's `paras`, its last kept row after the migration's cutoff, over a .docx with a branch not read, is skipped read after N26, its `paras` and every row unchanged", async () => {
  for (const body of [BODY, RUN_BODY]) {
    const w = fresh();
    bundle(w.s, "INFO-1");
    /* two old readings, so the first batch takes the cutoff and leaves the migration not done */
    const old = await oldReading();
    for (const c of ["0".repeat(64), "f".repeat(64)]) {
      w.x.writeReading({ bundleId: "INFO-1", captureSha: c, reading: old, profileFormat: "docx", composed: true });
      /* R82 (F12): bytes held, so neither waits for them (a candidate whose bytes are not held keeps the migration open); the
         docx entry cannot read these, which is a reason of its own */
      await w.evidence.put(`bio/captures/${c}`, new Uint8Array([1, 2, 3]));
    }
    const first = await w.x.migrateDocxReadings({ limit: 1 });
    assert.deepEqual([first.done, first.examined], [false, 1]);
    /* the paras reading, written after the cutoff (a promotion after the migration started) */
    const { d, r } = await readNow(w, body);
    w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
    const notices = [];
    w.x.onReading("observation-log", (e) => { notices.push(e); return null; });
    assert.ok(Number(lastKept(w, d).n) > Number(first.cutoff), "its last kept row is after the cutoff");
    const rowsBefore = ["readings", "reading_history", "reading_refs", "capture_text", "reading_text_source"]
      .map((t) => w.rows(`SELECT * FROM ${t} WHERE capture_sha=?`, d));
    const rest = await w.x.migrateDocxReadings();
    assert.equal(rest.done, true);
    assert.deepEqual(rest.migrated, []);
    assert.deepEqual(rest.skipped.filter((s) => s.capture_sha === d).map((s) => s.why), [AFTER_N26]);
    const got = w.x.readingOf(d).reading;
    assert.deepEqual(got, r.reading);
    assert.deepEqual(got.cells, r.reading.cells, "`paras` unchanged");
    assert.equal(n26Marked(got), false);
    assert.equal("migrated" in got, false);
    assert.deepEqual(["readings", "reading_history", "reading_refs", "capture_text", "reading_text_source"]
      .map((t) => w.rows(`SELECT * FROM ${t} WHERE capture_sha=?`, d)), rowsBefore);
    assert.equal(notices.length, 0);
  }
});

test("R66 (T38, N786): a reading carrying `paras` is never migrated on a store whose migration is done, after a restart, nor after a whole-store purge: the migrations' row survives the purge, so its cutoff is not taken again over the readings written since", async () => {
  for (const body of [BODY, RUN_BODY]) {
    const w = fresh({ host: { waitUntil: () => null } });
    /* the boot took the cutoff over the empty store; its run finds nothing and is done */
    assert.equal((await w.x.migrateDocxReadings()).done, true);
    const kept = w.one(`SELECT * FROM reading_migrations WHERE migration='n26-docx'`);
    assert.deepEqual([kept.cutoff, kept.done], [0, 1]);
    /* the whole-store purge empties the record, the history's rowids restart, and a reading is written again */
    const purged = w.core.purge();
    assert.equal(purged.removed.reading_migrations, undefined, "the migrations' row is exempt from the purge");
    assert.equal(w.one(`SELECT count(*) c FROM reading_history`).c, 0);
    bundle(w.s, "INFO-1");
    const { d, r } = await readNow(w, body);
    w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
    /* restart: the row stands, done, its cutoff the boot's (taken again, it would hold this reading's row) */
    const x2 = await restart(w);
    assert.deepEqual(w.one(`SELECT * FROM reading_migrations WHERE migration='n26-docx'`), kept);
    const again = await x2.migrateDocxReadings();
    assert.deepEqual([again.done, again.examined, again.migrated], [true, 0, []]);
    const got = w.x.readingOf(d).reading;
    assert.deepEqual(got, r.reading);
    assert.equal(n26Marked(got), false);
    assert.equal(w.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, d).c, 1);
  }
});

test("R66 R23 (T38, N786): every write of a reading carrying `paras` leaves its last kept row holding that reading, through promotion's projection, the writer, and a second bundle writing the same reading, so none carrying `paras` lacks a history row", async () => {
  const w = fresh();
  bundle(w.s, "INFO-1"); bundle(w.s, "INFO-2");
  const { d, r } = await readNow(w, BODY);
  const files = [{ path: "data/provenance.json", text: JSON.stringify({ documents: [{ capture: { sha256: d }, reading: r.reading,
    text_units: r.text_units, profile: { format: { format: "docx" } } }] }) }];
  w.x.projectPromotion({ bundleId: "INFO-1", files, author: null });
  const stored = () => w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading;
  assert.equal(lastKept(w, d).reading, stored());
  w.x.writeReading({ bundleId: "INFO-2", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
  assert.equal(lastKept(w, d).reading, stored());
  assert.equal(w.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, d).c, 1, "the same reading is not kept again");
  const changed = { ...r.reading, basis: "read again" };
  w.x.writeReading({ bundleId: "INFO-2", captureSha: d, reading: changed, textUnits: r.text_units, profileFormat: "docx" });
  assert.equal(lastKept(w, d).reading, stored());
  assert.deepEqual(JSON.parse(stored()).cells, r.reading.cells);
});
