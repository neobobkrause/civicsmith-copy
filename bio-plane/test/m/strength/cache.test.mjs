/* The search cache (R13) in strength's own table, registered with promotion as a projection and with retrieval as the
   columns of the `capture` and `connection` fields (R23; N137, K649 (6)), driven at the module's interface. Also the
   convert share of `test/rec108-cache-asof.test.mjs` (the cache contract end to end: the row stays at the last
   promotion's value after the record moves beneath it, a refused promotion writes nothing, a corrected one moves it and
   the field's column follows) and of its R6 arm (inquirystrength's exact key set). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, MACHINE, REASON } from "./fixture.mjs";
import { STRENGTH_CACHE_TABLE, STRENGTH_CACHE_FIELDS, STRENGTH_PURGED_TABLES, STRENGTH_EXEMPT_TABLES,
         STRENGTH_STATES } from "../../../src/strength/index.mjs";
import { migrateStrength } from "../../../src/strength/schema.mjs";

const INQ = "INQ-2026-0001-a", SUB = "INQ-2026-0002-a", DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-a";

/* An inquiry resting on a captured document (capture B, ceiling B) and a sub-inquiry whose connection leg is C. */
function cached() {
  const w = world();
  w.bundle(DOC);
  w.bundle(DOC2);
  w.ceilings.set(DOC, { grade: "B", why: `${DOC} is captured at B` });
  w.inquiry(SUB, [{ target: DOC2, grade: "C", axis: "connection", source: "resolution" }]);
  w.inquiry(INQ, [{ target: DOC, grade: "B", axis: "capture", source: "capture" }, { target: SUB }]);
  return w;
}
const row = (w, id) => w.rows(`SELECT capture_grade, capture_state, connection_grade, connection_state
                                 FROM ${STRENGTH_CACHE_TABLE} WHERE bundle_id=?`, id)[0] ?? null;
/* What retrieval's registered relation reads for a field, as query-language R26 reads it: one value per key. */
const viaRelation = (w, field, id) => {
  const rel = w.fields.find((f) => f.field === field);
  const rows = w.rows(`SELECT ${rel.col} AS v FROM ${rel.table} WHERE ${rel.key}=?`, id);
  assert.ok(rows.length <= 1, "at most one row per key (retrieval R62)");
  return rows.length ? rows[0].v : null;
};

test("R13, R23: the factory registers one projection with promotion and the cache's two grade columns with retrieval as the capture and connection fields", () => {
  const w = world();
  assert.deepEqual(w.steps.map((x) => x.module), ["strength"], "one step, strength's own");
  assert.equal(typeof w.steps[0].project, "function");
  assert.equal(w.steps[0].check, undefined, "a projection only: the cache refuses nothing");
  assert.deepEqual(w.fields, [
    { module: "strength", field: "capture", table: STRENGTH_CACHE_TABLE, key: "bundle_id", col: "capture_grade" },
    { module: "strength", field: "connection", table: STRENGTH_CACHE_TABLE, key: "bundle_id", col: "connection_grade" }]);
  assert.deepEqual(Object.keys(STRENGTH_CACHE_FIELDS), ["capture", "connection"], "no third field: the bar and testimony stay out");
  /* Keyed by bundle_id, one row per key (retrieval R62). */
  const cols = w.rows(`PRAGMA table_info(${STRENGTH_CACHE_TABLE})`);
  assert.deepEqual(cols.filter((c) => c.pk).map((c) => c.name), ["bundle_id"]);
  assert.deepEqual(cols.map((c) => c.name).sort(),
    ["bundle_id", "capture_grade", "capture_state", "connection_grade", "connection_state"]);
  assert.ok(!cols.some((c) => /strength|score|overall|composed/.test(c.name) && c.name !== "bundle_id"),
    "two grade columns and never one composed column (R18)");
});

test("R13: a promotion writes the capture and connection grade and state of R1–R5, in its own transaction, and adds nothing to the promotion's answer", () => {
  const w = cached();
  assert.equal(row(w, INQ), null, "never projected: no row");
  assert.equal(w.promote(INQ), null, "the projection's answer adds no key (promotion R39)");
  const s = w.s.strengthOf(INQ);
  assert.deepEqual(row(w, INQ), { capture_grade: s.capture.grade, capture_state: s.capture.state,
                                  connection_grade: s.connection.grade, connection_state: s.connection.state });
  assert.deepEqual([s.capture.grade, s.connection.grade], ["B", "C"]);
  for (const st of [row(w, INQ).capture_state, row(w, INQ).connection_state]) assert.ok(STRENGTH_STATES.includes(st));
  /* The states keep unrated, undetermined and "never projected" apart, which one nullable grade could not. */
  w.inquiry("INQ-2026-0003-a", []);
  w.promote("INQ-2026-0003-a");
  assert.deepEqual(row(w, "INQ-2026-0003-a"),
    { capture_grade: null, capture_state: "unrated", connection_grade: null, connection_state: "unrated" });
  w.inquiry("INQ-2026-0004-a", [{ target: "INQ-2026-0005-a" }]);
  w.inquiry("INQ-2026-0005-a", [{ target: "INQ-2026-0004-a" }]);
  w.promote("INQ-2026-0004-a");
  assert.deepEqual(row(w, "INQ-2026-0004-a"),
    { capture_grade: null, capture_state: "undetermined", connection_grade: null, connection_state: "undetermined" });
  assert.equal(row(w, "INQ-2026-0005-a"), null, "only the promoted inquiry is written");
});

test("R13 (rec108): the row stays at the last promotion's value when the record moves beneath it; a refused promotion writes nothing; a corrected one moves it and the field's column follows", () => {
  const w = cached();
  w.promote(INQ);
  assert.equal(viaRelation(w, "capture", INQ), "B");
  assert.equal(viaRelation(w, "connection", INQ), "C");
  /* A document re-read lowers the ceiling, and a leg beneath is raised: neither re-promotes INQ. */
  w.ceilings.set(DOC, { grade: "C", why: `${DOC} is re-read at C` });
  w.basis.get(SUB)[0].grade = "A";
  assert.deepEqual([w.s.strengthOf(INQ).capture.grade, w.s.strengthOf(INQ).connection.grade], ["C", "A"], "the truth moved");
  assert.deepEqual([viaRelation(w, "capture", INQ), viaRelation(w, "connection", INQ)], ["B", "C"],
    "the cache stays at its last promotion, a letter the walk no longer derives");
  /* R13, R6: no read of strength answers from the cache. */
  const read = w.s.inquiryStrength({ id: INQ, viewer: MACHINE });
  assert.deepEqual([read.capture.grade, read.connection.grade], ["C", "A"]);
  /* A promotion refused after the projection ran rolls the row back with everything else. */
  assert.deepEqual(w.promote(INQ, "inquiry", { fail: true }), { refused: true });
  assert.deepEqual([viaRelation(w, "capture", INQ), viaRelation(w, "connection", INQ)], ["B", "C"], "a refused promotion writes nothing");
  /* The corrected promotion moves it, so capture:C now finds it where capture:B did. */
  w.promote(INQ);
  assert.deepEqual([viaRelation(w, "capture", INQ), viaRelation(w, "connection", INQ)], ["C", "A"]);
  assert.deepEqual(w.rows(`SELECT bundle_id FROM ${STRENGTH_CACHE_TABLE} WHERE capture_grade='C'`).map((r) => r.bundle_id), [INQ]);
  assert.deepEqual(w.rows(`SELECT bundle_id FROM ${STRENGTH_CACHE_TABLE} WHERE capture_grade='B'`), []);
});

test("R13: a bundle that is not an inquiry holds no row; one promoted out of being an inquiry loses the row a former revision left", () => {
  const w = cached();
  w.promote(DOC, "information");
  assert.equal(row(w, DOC), null);
  w.promote(INQ);
  assert.ok(row(w, INQ));
  w.promote(INQ, "information");
  assert.equal(row(w, INQ), null, "only an inquiry has a pair, so capture: finds it no more");
  assert.equal(w.s.writeProjection(INQ, false), null);
  assert.deepEqual(w.s.writeProjection(INQ, true), { capture: { grade: "B", state: "graded" }, connection: { grade: "C", state: "graded" } });
  assert.deepEqual(w.s.cachedOf(INQ), { stale: false, row: { capture_grade: "B", capture_state: "graded", connection_grade: "C",
                                                              connection_state: "graded" } });
});

test("R39: the tables are declared explicitly: the cache derived-rebuildable by bundle with R13 as its rebuild, the bar exempt and group-wide", () => {
  const w = cached();
  const mine = w.record.declaredTables().filter((d) => d.module === "strength");
  assert.deepEqual(mine.map((d) => [d.name, d.purge, d.expunge, d.export, d.sight, d.derive, d.version_chain]), [
    [STRENGTH_CACHE_TABLE, "clear", "none", "admin-only", "bundle", "derived-rebuildable", false],
    ["group_strength_bar", "exempt", "none", "admin-only", "group", "stored", false]]);
  assert.deepEqual(mine[0].key, ["bundle_id"]);
  /* The rebuild is R13's computation: the held rows equal it right after the promotions that wrote them. */
  w.promote(SUB);
  w.promote(INQ);
  assert.deepEqual(w.record.rebuildAndCompare("strength", STRENGTH_CACHE_TABLE), { same: true });
  /* Negative control: the record moves beneath a held row, and the rebuild names the row that differs. */
  w.ceilings.set(DOC, { grade: "C", why: "re-read" });
  const diff = w.record.rebuildAndCompare("strength", STRENGTH_CACHE_TABLE);
  assert.equal(diff.same, false);
  assert.deepEqual(diff.first.key, { bundle_id: INQ });
  assert.equal(diff.first.held.capture_grade, "B");
  assert.equal(diff.first.rebuilt.capture_grade, "C");
});

test("R39, R13: a promotion marks stale the cached rows of the inquiries resting on what it promoted, to the depth bound; a stale row is never read as current until its own promotion rebuilds it", () => {
  const w = cached();
  w.inquiry("INQ-2026-0003-a", [{ target: INQ }]);
  for (const id of [SUB, INQ, "INQ-2026-0003-a"]) w.promote(id);
  for (const id of [SUB, INQ, "INQ-2026-0003-a"]) assert.equal(w.s.cachedOf(id).stale, false, id);
  /* A leg beneath is raised and SUB re-promoted: INQ, and INQ-0003 above it, go stale; SUB is fresh. */
  w.basis.get(SUB)[0].grade = "A";
  w.promote(SUB);
  assert.deepEqual(w.s.cachedOf(SUB), { stale: false, row: row(w, SUB) });
  for (const id of [INQ, "INQ-2026-0003-a"]) assert.deepEqual(w.s.cachedOf(id), { stale: true }, id);
  assert.equal(row(w, INQ).connection_grade, "C", "the held row itself stays as written (rec108): only its reading fails closed");
  /* A refused promotion marks nothing. */
  w.promote(INQ);
  w.promote(SUB, "inquiry", { fail: true });
  assert.equal(w.s.cachedOf(INQ).stale, false);
  /* Its own promotion rebuilds it and clears the mark. */
  assert.deepEqual(w.s.cachedOf(INQ), { stale: false, row: { capture_grade: "B", capture_state: "graded", connection_grade: "A",
                                                              connection_state: "graded" } });
  assert.deepEqual(w.s.cachedOf("INQ-2026-0009-a"), { stale: true }, "never projected: fails closed");
});

test("R23: the cache is declared to purge by bundle, and the bar exempt: a bundle's purge and a whole-store purge remove the cache, never the bar", () => {
  const w = cached();
  assert.deepEqual([...STRENGTH_PURGED_TABLES], [STRENGTH_CACHE_TABLE]);
  assert.deepEqual([...STRENGTH_EXEMPT_TABLES], ["group_strength_bar"]);
  w.member("admin-ann", "admin");
  w.s.strengthBarSet({ reason: REASON, capture: "B", author: "admin-ann" });
  w.promote(INQ);
  w.promote(SUB);
  w.record.purge({ bundleId: INQ });
  assert.equal(row(w, INQ), null, "a bundle's purge takes its cache row");
  assert.ok(row(w, SUB), "and no other");
  w.record.purge({});
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM ${STRENGTH_CACHE_TABLE}`)[0].n, 0);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM group_strength_bar`)[0].n, 1);
});

test("R23: a store holding the cache on bundles carries it over once, so no search answer changes by the move; a row strength holds is never overwritten", () => {
  const w = world();
  const legacy = ["inquiry_capture_strength", "inquiry_capture_state", "inquiry_connection_strength", "inquiry_connection_state"];
  for (const c of legacy) w.st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c} TEXT`);
  w.bundle("INQ-2026-0007-a", "inquiry");
  w.bundle("INQ-2026-0008-a", "inquiry");
  w.bundle("INQ-2026-0009-a", "inquiry");
  w.rows(`UPDATE bundles SET inquiry_capture_strength='A', inquiry_capture_state='graded', inquiry_connection_strength=NULL,
          inquiry_connection_state='unrated' WHERE bundle_id='INQ-2026-0007-a'`);
  w.rows(`UPDATE bundles SET inquiry_capture_strength=NULL, inquiry_capture_state='undetermined', inquiry_connection_strength='D',
          inquiry_connection_state='graded' WHERE bundle_id='INQ-2026-0008-a'`);
  migrateStrength(w.st.sql);
  assert.deepEqual(w.rows(`SELECT * FROM ${STRENGTH_CACHE_TABLE} ORDER BY bundle_id`), [
    { bundle_id: "INQ-2026-0007-a", capture_grade: "A", capture_state: "graded", connection_grade: null, connection_state: "unrated" },
    { bundle_id: "INQ-2026-0008-a", capture_grade: null, capture_state: "undetermined", connection_grade: "D", connection_state: "graded" }],
    "each value where it stood, and nothing for a bundle that held none");
  /* Carried once: a row strength wrote or removed since stays as strength left it. */
  w.rows(`UPDATE ${STRENGTH_CACHE_TABLE} SET capture_grade='B' WHERE bundle_id='INQ-2026-0007-a'`);
  w.rows(`DELETE FROM ${STRENGTH_CACHE_TABLE} WHERE bundle_id='INQ-2026-0008-a'`);
  migrateStrength(w.st.sql);
  assert.deepEqual(w.rows(`SELECT bundle_id, capture_grade FROM ${STRENGTH_CACHE_TABLE}`),
    [{ bundle_id: "INQ-2026-0007-a", capture_grade: "B" }]);
  /* A store without the old columns migrates cleanly and carries nothing. */
  const fresh = world();
  migrateStrength(fresh.st.sql);
  assert.equal(fresh.rows(`SELECT COUNT(*) AS n FROM ${STRENGTH_CACHE_TABLE}`)[0].n, 0);
});

test("R6 (rec108), R5: inquirystrength's answer is exactly ok, target, depth_bound, the three axes and the hunches left out, with out_of_view only when something was withheld", () => {
  const w = cached();
  const r = w.s.inquiryStrength({ id: INQ, viewer: MACHINE });
  assert.deepEqual(Object.keys(r).sort(), ["capture", "connection", "depth_bound", "hunches_left_out", "ok", "target", "testimony", "ungraded", "ungraded_count"]);
  assert.equal(r.target, INQ);
  assert.equal(r.depth_bound, 6);
  w.project("PROJ-2026-0042-abc", ["alice"]);
  w.inquiry("INQ-2026-0006-a", [{ target: "PROJ-2026-0042-abc", grade: "B", axis: "connection", source: "resolution" }]);
  const withheld = w.s.inquiryStrength({ id: "INQ-2026-0006-a", viewer: "member:carol" });
  assert.deepEqual(Object.keys(withheld).sort(),
    ["capture", "connection", "depth_bound", "hunches_left_out", "ok", "out_of_view", "target", "testimony", "ungraded", "ungraded_count"]);
  assert.equal(withheld.out_of_view, true);
});
