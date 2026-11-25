/* extraction, N439: moving the `slide-shape` references of `.pptx` readings made before N439 (R68; office-readers
   R11's pptx arm, R29; K747, K763, K795 (6)), and the promotion projection that does not undo it (R20). A reading
   "made before N439" is built here as the old walk wrote it (every branch of a slide's mc:AlternateContent walked, so
   its text doubled and its shapes numbered with the duplicate counted), over bytes held in the evidence store; the
   migration re-reads those bytes through the pptx entry and moves the references by `pptxRenumbering`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, psp, palt, pptx, docx, doc, wp, wr, box, bucket } from "./fixture.mjs";
import { n439MigratedReading, n439Marked, pptxRenumberingMoves, n26Marked, N439_READER_MARK, N439_MIGRATION, Extraction }
  from "../../../src/extraction/index.mjs";
import { textUnitsFor, layerChainFor, readingProvenance } from "../../../src/reading-pipeline/index.mjs";
import { pptxRenumbering, pptxEntry } from "../../../src/pptx.mjs";
import { glyphCount } from "../../../src/textchain.mjs";

/* The deck: slide 1 holds a title, a p14 graphic frame written as an mc:Choice (one shape) and its mc:Fallback copy
   (the same shape and a picture of it), then a shape after; slide 2 one shape. Under N439 slide 1 has three shapes
   (0 title, 1 eq, 2 after); the old walk numbered five (0 title, 1 eq, 2 eq copy, 3 picture, 4 after). */
const SLIDES = [psp("title") + palt(psp("eq"), psp("eq") + psp("eq pic")) + psp("after"), psp("two")];
const OLD = [{ shapes: 5, text: "title\neq\neq\neq pic\nafter" }, { shapes: 1, text: "two" }];
const NEW = [{ shapes: 3, text: "title\neq\nafter" }, { shapes: 1, text: "two" }];
const S = (slide, shape) => ({ kind: "slide-shape", ref: `slide ${slide}`, slide, ...(shape === undefined ? {} : { shape }) });
const AT = "2026-09-01T00:00:00Z";

const textOf = (slides) => {
  const document = slides.map((s) => s.text).join("\n");
  return { ok: true, container: "pptx", document, deckLength: slides.length, speakerNotes: [],
           slides: slides.map((s, i) => ({ slide: i + 1, ref: `slide ${i + 1}`, part: `ppt/slides/slide${i + 1}.xml`,
                                           hidden: false, shapes: s.shapes, text: s.text })),
           undetermined: [], counts: { chars: document.length, notesChars: 0, undetermined: 0 } };
};

/* The reading as the pre-N439 read composed it: references at the old shape numbers, the old shape counts. */
async function oldReading() {
  const text = textOf(OLD);
  const chain = layerChainFor(text, { tier: 1, container: "pptx" });
  return {
    content_type: "deck", reader_version: 1, read_from_text: true, found: true, at: AT,
    entities: [
      { key: "1", kind: "item", label: "After", facts: {}, ref: "item:1", source: S(1, 4),
        occurrences: [S(1, 1), S(1, 3), S(2, 0)] },
      { key: "p", kind: "pic", label: null, facts: {}, ref: "pic:p", source: S(1, 2) },
    ],
    facts: { link: { source: S(1, 4) }, slide: S(1), elsewhere: S(9, 4) },
    text_source: chain, text_tier: 1, text_container: "pptx", basis: "read by the deck reader",
    position_parts: 2, position_why: null, page_count: null, page_boxes: null,
    container_extent: { container: "pptx", levels: ["slides"], sheets: null, paragraphs: null,
                        slides: OLD.map((s) => ({ shapes: s.shapes })), deckLength: 2 },
    provenance: await readingProvenance({ text, chain, tier: 1, container: "pptx" }),
    text_chars: text.document.length, text_glyphs: glyphCount(text.document), text_undetermined: 0,
  };
}

/* A store holding the deck's bytes and its old reading in bundle INFO-1. */
async function seeded({ slides = SLIDES, reading = null, evidence = bucket(), origin = "composed", author = null } = {}) {
  const f = fresh({ evidence });
  const digest = await hold(evidence, pptx(slides));
  bundle(f.s, "INFO-1");
  const r = reading || await oldReading();
  const u = textUnitsFor(textOf(OLD));
  const notices = [];
  f.x.onReading("observation-log", (e) => { notices.push(e); return null; });
  f.x.writeReading({ bundleId: "INFO-1", captureSha: digest, reading: r, textUnits: u.textUnits, profileFormat: "pptx",
                     composed: origin === "composed", author, justification: origin === "asserted" ? "read it aloud" : null });
  notices.length = 0;
  return { ...f, digest, old: r, notices };
}

test("R68 R29: renumbering's map over the stored parts moves the shapes after a branch not read, and a deck with no mc:AlternateContent moves nothing", async () => {
  const map = pptxRenumbering(await pptxEntry.parts(pptx(SLIDES)));
  assert.equal(pptxRenumberingMoves(map), true);
  assert.deepEqual(map.slides.map((s) => [s.slide, s.shapes.map((x) => x.new)]), [[1, [0, 1, null, null, 2]], [2, [0]]]);
  assert.equal(pptxRenumberingMoves(pptxRenumbering(await pptxEntry.parts(pptx([psp("a") + psp("b"), psp("c")])))), false);
  assert.equal(pptxRenumberingMoves(null), false);
  assert.equal(pptxRenumberingMoves({ slides: [] }), false);
});

test("R68: a pre-N439 pptx reading is migrated once: re-read from its bytes, every shape reference moved, the old reading kept, the chain marked, R19's writer and its listeners", async () => {
  const f = await seeded();
  const out = await f.x.migratePptxReadings();
  assert.deepEqual([out.migration, out.done, out.examined], [N439_MIGRATION, true, 1]);
  assert.deepEqual(out.migrated.map((m) => m.capture_sha), [f.digest]);
  const got = f.x.readingFor(f.digest).reading;
  const [item, pic] = got.entities;
  /* a shape after the branch not read: to `new`; one inside it: unplaced; one before it and another slide's: as they were. */
  assert.deepEqual(item.source, S(1, 2));
  assert.deepEqual(item.occurrences, [S(1, 1), null, S(2, 0)]);
  assert.equal(pic.source, null);
  /* every slide-shape the reading holds, wherever it sits; the slide grain and a slide the map does not list stay. */
  assert.deepEqual(got.facts, { link: { source: S(1, 2) }, slide: S(1), elsewhere: S(9, 4) });
  /* slide numbers and the deck do not move; each slide's shape count is N439's; the text loses the duplicate. */
  assert.deepEqual(got.container_extent, { ...f.old.container_extent, slides: NEW.map((s) => ({ shapes: s.shapes })) });
  const doc = NEW.map((s) => s.text).join("\n");
  assert.deepEqual([got.text_chars, got.text_glyphs, got.text_undetermined], [doc.length, glyphCount(doc), 0]);
  /* the mark (text-chain accepts it: the text-source row carries the marked chain), the migration's own statement. */
  assert.equal(got.text_source[0].reader, N439_READER_MARK);
  assert.equal(n439Marked(got), true);
  assert.equal(n439Marked(f.old), false);
  assert.equal(n26Marked(got), false);
  assert.deepEqual(JSON.parse(f.one(`SELECT chain FROM reading_text_source WHERE capture_sha=?`, f.digest).chain), got.text_source);
  assert.deepEqual(got.migrated.n439.moved, { shapes: 4, unplaced: 2 });
  for (const k of ["content_type", "reader_version", "at", "basis", "found", "text_tier", "text_container", "page_count"])
    assert.deepEqual(got[k], f.old[k], k);
  assert.notEqual(got.provenance.text_sha256, f.old.provenance.text_sha256);
  /* R23: the reading it replaces is kept, then the new one. */
  const hist = f.rows(`SELECT reading FROM reading_history WHERE capture_sha=? ORDER BY seq`, f.digest);
  assert.deepEqual(hist.map((h) => JSON.parse(h.reading)), [f.old, got]);
  /* the text units rebuilt by R22 at the slide grain, slide numbers unchanged, no duplicated branch. */
  assert.deepEqual(f.rows(`SELECT extent, text FROM capture_text WHERE capture_sha=? ORDER BY seq`, f.digest)
                     .map((u) => [JSON.parse(u.extent), u.text]),
                   NEW.map((s, i) => [{ kind: "slide-shape", slide: i + 1, shape: null }, s.text]));
  /* the references' places moved: positions and occurrences of kind slide-shape. */
  assert.deepEqual(f.rows(`SELECT occurrence FROM reading_refs WHERE ref='item:1' ORDER BY seq`).map((r) => r.occurrence),
                   [[1, 2], [1, 1], null, [2, 0]].map((p) => (p ? `slide-shape:${JSON.stringify({ slide: p[0], shape: p[1] })}` : "")));
  assert.deepEqual(f.rows(`SELECT pos_kind, pos FROM reading_refs WHERE ref='pic:p'`).map((r) => [r.pos_kind, r.pos]), [[null, null]]);
  /* R19's listeners ran once, the plane's act, with the chain before and after differing (content R22 stales on it). */
  assert.equal(f.notices.length, 1);
  const e = f.notices[0];
  assert.equal(e.author, null);
  assert.notDeepEqual(e.chainAfter, e.chainBefore);
  assert.deepEqual(e.unitsBefore.map((u) => u.text), OLD.map((s) => s.text));
  /* once: a second run reads nothing and moves nothing. */
  const again = await f.x.migratePptxReadings();
  assert.deepEqual([again.done, again.examined, again.migrated], [true, 0, []]);
  assert.deepEqual(f.x.readingFor(f.digest).reading, got);
  assert.equal(f.notices.length, 1);
});

test("R68: a pptx reading whose renumbering moves nothing gets no mark and no re-read; a docx reading is not its candidate, nor a pptx reading N26's", async () => {
  const plain = [psp("one") + psp("two"), psp("three")];
  const evidence = bucket();
  const flat = [{ shapes: 2, text: "one\ntwo" }, { shapes: 1, text: "three" }];
  const plainReading = { ...(await oldReading()), container_extent: { container: "pptx", levels: ["slides"],
    slides: flat.map((s) => ({ shapes: s.shapes })), deckLength: 2 }, entities: [] };
  const f = await seeded({ slides: plain, reading: plainReading, evidence });
  const word = await hold(evidence, docx(wp(wr("a"), box([wp(wr("b"))]))));
  f.x.writeReading({ bundleId: "INFO-1", captureSha: word, profileFormat: "docx", composed: true,
    reading: { content_type: "doc", found: false, entities: [], at: AT, text_source: layerChainFor(null, { tier: 1, container: "docx" }) } });
  f.notices.length = 0;
  const before = f.rows(`SELECT * FROM readings ORDER BY capture_sha`);
  const out = await f.x.migratePptxReadings();
  assert.deepEqual([out.done, out.examined, out.unmoved, out.migrated], [true, 1, 1, []]);
  assert.deepEqual(f.rows(`SELECT * FROM readings ORDER BY capture_sha`), before);
  assert.equal(f.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, f.digest).c, 1);
  assert.equal(n439Marked(f.x.readingFor(f.digest).reading), false);
  assert.equal(f.notices.length, 0);
  /* N26's run examines the docx reading alone. */
  const d = await f.x.migrateDocxReadings();
  assert.equal(d.examined, 1);
  assert.deepEqual(f.x.readingFor(f.digest).reading, plainReading);
});

test("R68: a reading already marked moves nothing; one written after the migration's cutoff, or whose shape counts are N439's, is left as it is", async () => {
  /* Marked: the migrated reading carried into another store. */
  const a = await seeded();
  await a.x.migratePptxReadings();
  const marked = a.x.readingFor(a.digest).reading;
  const b = await seeded({ reading: marked });
  const ob = await b.x.migratePptxReadings();
  assert.deepEqual(ob.skipped.map((s) => s.why), ["already migrated"]);
  assert.deepEqual(b.x.readingFor(b.digest).reading, marked);
  /* N439's shape counts: a reading the new walk made. */
  const fresh439 = { ...(await oldReading()), container_extent: { container: "pptx", levels: ["slides"],
    slides: NEW.map((s) => ({ shapes: s.shapes })), deckLength: 2 } };
  const c = await seeded({ reading: fresh439 });
  const oc = await c.x.migratePptxReadings();
  assert.equal(oc.migrated.length, 0);
  assert.match(oc.skipped[0].why, /shape counts/);
  assert.deepEqual(c.x.readingFor(c.digest).reading, fresh439);
  /* No pptx layer step to mark. */
  const unchained = { ...(await oldReading()), text_source: null };
  const u = await seeded({ reading: unchained });
  assert.match((await u.x.migratePptxReadings()).skipped[0].why, /no pptx text layer/);
  /* After the cutoff: two old readings; the first run takes one; the other is then written again (a promotion after
     the migration started, so N439's), and the second run leaves it as it is. */
  const evidence = bucket();
  const d = await seeded({ evidence });
  const other = await hold(evidence, pptx([...SLIDES, psp("tail")]));
  d.x.writeReading({ bundleId: "INFO-1", captureSha: other, reading: await oldReading(), profileFormat: "pptx", composed: true });
  const first = await d.x.migratePptxReadings({ limit: 1 });
  assert.deepEqual([first.done, first.examined], [false, 1]);
  const [, late] = [d.digest, other].sort();
  const rewritten = { ...(await oldReading()), basis: "written again after the migration started" };
  d.x.writeReading({ bundleId: "INFO-1", captureSha: late, reading: rewritten, profileFormat: "pptx", composed: true });
  const rest = await d.x.migratePptxReadings();
  assert.deepEqual([rest.done, rest.examined, rest.migrated.length], [true, 1, 0]);
  assert.match(rest.skipped[0].why, /after the migration's cutoff/);
  assert.deepEqual(d.x.readingFor(late).reading, rewritten);
});

test("R68: bytes not held, or a stored reading that changed while the bytes were read, leave the stored reading as it stands", async () => {
  const ev1 = bucket();
  const a = await seeded({ evidence: ev1 });
  ev1.held.clear();
  const oa = await a.x.migratePptxReadings();
  assert.match(oa.skipped[0].why, /not held/);
  assert.deepEqual(a.x.readingFor(a.digest).reading, a.old);
  const ev2 = bucket();
  const b = await seeded({ evidence: ev2 });
  const newer = { ...(await oldReading()), basis: "a promotion that landed meanwhile" };
  const get = ev2.get.bind(ev2);
  ev2.get = async (k) => { b.x.writeReading({ bundleId: "INFO-1", captureSha: b.digest, reading: newer, composed: true }); return get(k); };
  const ob = await b.x.migratePptxReadings();
  assert.match(ob.skipped[0].why, /changed while/);
  assert.deepEqual(b.x.readingFor(b.digest).reading, newer);
});

test("R68 R21: an asserted reading stays the caller's assertion, with its standing and justification, after it is moved", async () => {
  const f = await seeded({ origin: "asserted", author: "member:ruth" });
  const before = f.x.readingFor(f.digest).origin;
  assert.equal(before.state, "asserted");
  await f.x.migratePptxReadings();
  const after = f.x.readingFor(f.digest);
  assert.deepEqual(after.origin, before);
  assert.equal(n439Marked(after.reading), true);
});

test("R68 R44 R46: the pure migration re-grades and resolves nothing, changes the reading handed in not at all, and keeps an absent key absent", async () => {
  const old = await oldReading();
  const copy = JSON.parse(JSON.stringify(old));
  const map = pptxRenumbering(await pptxEntry.parts(pptx(SLIDES)));
  const next = n439MigratedReading(old, map, textOf(NEW), { at: "2026-10-01T00:00:00Z" });
  assert.deepEqual(old, copy);
  assert.deepEqual(next.entities.map((e) => [e.ref, e.kind, e.key, e.label, e.facts]),
                   old.entities.map((e) => [e.ref, e.kind, e.key, e.label, e.facts]));
  assert.equal(next.migrated.n439.at, "2026-10-01T00:00:00Z");
  const bare = { ...old }; delete bare.text_chars; delete bare.text_glyphs; delete bare.text_undetermined; delete bare.container_extent;
  const n2 = n439MigratedReading(bare, map, textOf(NEW));
  for (const k of ["text_chars", "text_glyphs", "text_undetermined", "container_extent"]) assert.equal(k in n2, false, k);
  /* a slide the reading's extent itemised as unmeasured keeps null. */
  const nulls = n439MigratedReading({ ...old, container_extent: { ...old.container_extent, slides: [{ shapes: null }, { shapes: 1 }] } },
                                    map, textOf(NEW));
  assert.deepEqual(nulls.container_extent.slides, [{ shapes: null }, { shapes: 1 }]);
});

test("R20 R68: a promotion re-submitting the pre-N439 reading with the same `at` does not undo the migration; a reading with another `at` replaces it", async () => {
  const f = await seeded();
  await f.x.migratePptxReadings();
  const migrated = f.x.readingFor(f.digest).reading;
  const files = (reading) => [{ path: "data/provenance.json",
    text: JSON.stringify({ documents: [{ capture: { sha256: f.digest }, reading, profile: { format: { format: "pptx" } } }] }) }];
  f.x.projectPromotion({ bundleId: "INFO-1", files: files(f.old), author: null });
  assert.deepEqual(f.x.readingFor(f.digest).reading, migrated);
  const later = { ...f.old, at: "2026-09-30T00:00:00Z" };
  f.x.projectPromotion({ bundleId: "INFO-1", files: files(later), author: null });
  assert.deepEqual(f.x.readingFor(f.digest).reading, later);
});

test("R68 R66: on a Durable Object both migrations are started by migrate(), their cutoffs taken there, and carried by one waitUntil, once", async () => {
  const evidence = bucket();
  const f = await seeded({ evidence });
  const word = await hold(evidence, docx(wp(wr("a"), box([wp(wr("b"))])) + wp(wr("c"))));
  const P = (para) => ({ kind: "doc-para", ref: `¶${para + 1}`, para, run: null });
  f.x.writeReading({ bundleId: "INFO-1", captureSha: word, profileFormat: "docx", composed: true,
    reading: { content_type: "doc", found: true, at: AT, text_container: "docx",
               entities: [{ key: "c", kind: "c", label: null, facts: {}, ref: "c:c", source: P(3) }],
               text_source: layerChainFor(null, { tier: 1, container: "docx" }) } });
  const { Extraction } = await import("../../../src/extraction/index.mjs");
  const record = { evidenceStore: () => f.core.evidenceStore(), transact: (fn) => f.core.transact(fn), readFile: () => null };
  const waited = [];
  const x2 = new Extraction(f.s, { record, membership: f.membership, env: {}, host: { waitUntil: (p) => waited.push(p) } });
  x2.migrate();
  assert.equal(waited.length, 1);
  /* both cutoffs are rows before the run awaits anything, so a reading written now is past them */
  assert.deepEqual(f.rows(`SELECT migration FROM reading_migrations ORDER BY migration`).map((r) => r.migration),
                   ["n26-docx", N439_MIGRATION]);
  await waited[0];
  assert.equal(n439Marked(f.x.readingFor(f.digest).reading), true);
  assert.equal(n26Marked(f.x.readingFor(word).reading), true);
  assert.deepEqual(f.x.readingFor(word).reading.entities[0].source, P(2));
  x2.migrate();
  assert.equal(waited.length, 1);
  const x3 = new Extraction(f.s, { record, membership: f.membership, env: {} });
  assert.equal(x3.startMigrations(), null);
});

test("R68 (T38, N786; K2296): after a whole-store purge a .pptx reading written since, the fixed reader's, over a deck with a branch not read, is never migrated: the migrations' row survives the purge, done, its cutoff not taken again", async () => {
  const w = fresh({ host: { waitUntil: () => null } });
  /* the boot took the cutoff over the empty store; its run finds nothing and is done */
  assert.equal((await w.x.migratePptxReadings()).done, true);
  const kept = w.one(`SELECT * FROM reading_migrations WHERE migration=?`, N439_MIGRATION);
  assert.deepEqual([kept.cutoff, kept.done], [0, 1]);
  const purged = w.core.purge();
  assert.equal(purged.removed.reading_migrations, undefined, "the migrations' row is exempt from the purge");
  assert.equal(w.one(`SELECT count(*) c FROM reading_history`).c, 0);
  /* N439's own reading of the deck (R1), written after the purge */
  bundle(w.s, "INFO-1");
  const bytes = pptx(SLIDES);
  const d = await hold(w.evidence, bytes);
  const CT = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const r = await w.x.read(doc({ digest: d, bytes: bytes.length, ct: CT, format: "pptx", headers: [["content-type", CT]] }));
  assert.equal(r.reading.text_container, "pptx");
  assert.equal(pptxRenumberingMoves(pptxRenumbering(await pptxEntry.parts(bytes))), true, "the deck holds a branch N439 does not read");
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "pptx" });
  /* the object restarts over the same storage: the row stands, done, its cutoff the boot's */
  const record = { evidenceStore: () => w.core.evidenceStore(), transact: (fn) => w.core.transact(fn), readFile: () => null };
  const waited = [];
  const x2 = new Extraction(w.s, { record, membership: w.membership, env: {}, host: { waitUntil: (p) => waited.push(p) } });
  x2.migrate();
  await Promise.all(waited);
  assert.deepEqual(w.one(`SELECT * FROM reading_migrations WHERE migration=?`, N439_MIGRATION), kept);
  const again = await x2.migratePptxReadings();
  assert.deepEqual([again.done, again.examined, again.migrated], [true, 0, []]);
  const got = w.x.readingOf(d).reading;
  assert.deepEqual(got, r.reading);
  assert.equal(n439Marked(got), false);
  assert.equal(w.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, d).c, 1);
});
