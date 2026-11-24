/* R52 (K861, plane R10): the two shares this module exports for plane to register under its name, and registers
   nowhere itself: (1) the figure source shaped as `record-core` R63's `counts(hid)`, with its key list
   (`inquiryMigrationReplays`), registered here through R63 as plane registers it, and read whole, through the caller's
   sight, through `op=stats`' source and in purge's proof; (2) the leg-grade resolver `retrieval`'s `registerLegGrades`
   takes (its R55), registered through the real retrieval and read through its leg rows (R12). The pinned values are
   this module's count of `inquiry_migration_replays` as its SQL states it and its leg grades as `legCapped` answers
   them, each over this module's own fixture (they are the values plane answered before plane R10 was met, K923). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { Inquiry, inquiryLegGrades, legCapped } from "../../../src/inquiry/index.mjs";
import { hiddenBundles } from "../../../src/membership/index.mjs";

const CAP = "c".repeat(64);
const OPEN = "INQ-2026-0601-open", CLOSED = "INQ-2026-0602-closed", PLAIN = "INQ-2026-0603-plain";

/* Two replayed creations (one of them inside alice's hidden project), one ordinary inquiry, and a row naming no bundle. */
function replays() {
  const w = world();
  w.member("alice"); w.member("bob");
  const P = w.project("Closed work", "alice");
  for (const id of [OPEN, CLOSED])
    assert.equal(w.promote(id, inquiryMd(id), null, { migrationReplay: { capture: CAP, promotion: `P-${id}` } }).ok, true);
  w.inquiry(PLAIN);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, P, CLOSED);
  w.st.sql.exec(`INSERT INTO inquiry_migration_replays (bundle_id, capture_sha, promotion_key, at) VALUES (NULL, ?, NULL, ?)`,
    CAP, "2026-09-28T00:00:00Z");
  return { w, P };
}
/* The pinned count, stated here as its SQL: the table less the rows naming a hidden bundle, a NULL key naming none. */
const pinnedCount = (w, hid) => w.row(hid
  ? `SELECT count(*) AS c FROM inquiry_migration_replays WHERE COALESCE(bundle_id, '') NOT IN ${hid.sql}`
  : `SELECT count(*) AS c FROM inquiry_migration_replays`, ...(hid ? hid.args : [])).c;
const register = (w) => w.record.registerCounts("inquiry", [...Inquiry.COUNT_KEYS], (hid) => w.k.counts(hid));

test("R52 (1) the figure source: its key list is `inquiryMigrationReplays`, it registers through record-core R63 under this module's name, and the module registers it nowhere itself", () => {
  const { w } = replays();
  assert.deepEqual([...Inquiry.COUNT_KEYS], ["inquiryMigrationReplays"]);
  assert.ok(Object.isFrozen(Inquiry.COUNT_KEYS));
  assert.equal(Object.hasOwn(w.record.counts(null), "inquiryMigrationReplays"), false, "nothing is registered by the module itself");
  assert.deepEqual(register(w), { ok: true, module: "inquiry", keys: ["inquiryMigrationReplays"] });
  assert.equal(register(w).reason, "COUNTS_DECLARED", "registered once, under one name");
  assert.deepEqual(Object.keys(w.k.counts(null)), [...Inquiry.COUNT_KEYS], "counts(hid) answers exactly its keys");
});

test("R52 (1) R63: the registered figure counts the table as its SQL states, whole and through each caller's sight; a NULL key names no bundle and is never dropped", () => {
  const { w, P: closedWork } = replays();
  register(w);
  assert.equal(w.record.counts(null).inquiryMigrationReplays, 3, "whole: the two replays and the row naming no bundle");
  assert.equal(w.record.counts(null).inquiryMigrationReplays, pinnedCount(w, null));
  /* D54 (K2408, K2442): alice's project is hidden (no visibility recorded, membership R85) and the founder neither invited
     nor joined, so the founder's viewer, either spelling, is blind to the replay inside it, as bob is */
  for (const [viewer, expected] of [["admin", 2], ["member:admin", 2], [V("alice"), 3], [V("bob"), 2], ["", 1], [null, 1],
                                    ["class:member", 3]]) {
    const hid = hiddenBundles(viewer);
    assert.equal(w.k.counts(hid).inquiryMigrationReplays, expected, `${viewer}`);
    assert.equal(w.record.counts(hid).inquiryMigrationReplays, pinnedCount(w, hid), `${viewer}: as the pinned count states it`);
  }
  /* negative control (D54): the project set discoverable, the founder sees it whole again (K2409), bob still does not */
  const set = w.membership.projectVisibilitySet({ projectId: closedWork, setting: "discoverable", reason: "open to the team",
                                                  by: "alice", viewer: V("alice") });
  assert.equal(set.ok, true, JSON.stringify(set));
  for (const [viewer, expected] of [["admin", 3], ["member:admin", 3], [V("bob"), 2]]) {
    const hid = hiddenBundles(viewer);
    assert.equal(w.k.counts(hid).inquiryMigrationReplays, expected, `${viewer}, discoverable`);
    assert.equal(w.record.counts(hid).inquiryMigrationReplays, pinnedCount(w, hid), `${viewer}, discoverable`);
  }
  /* the plain inquiry wrote no row, and a revision writes none */
  assert.equal(w.row(`SELECT count(*) AS c FROM inquiry_migration_replays WHERE bundle_id=?`, PLAIN).c, 0);
});

test("R52 (1) R63: a figure whose table cannot be read is answered null by R63, never zero, and counts(hid) never throws", () => {
  const { w } = replays();
  register(w);
  const broken = { sql: "(SELECT nope FROM no_such_table)", args: [] };
  assert.doesNotThrow(() => w.k.counts(broken));
  assert.deepEqual(w.k.counts(broken), {});
  assert.equal(w.record.counts(broken).inquiryMigrationReplays, null);
});

test("R52 (1) R63: through op=stats' source the figure is the caller's sight, and purge's proof counts it whole, before and after a purge takes a replayed question", () => {
  const { w } = replays();
  register(w);
  /* the stats source as plane composes it (record-core R64, R65): the registered figures spread through the caller's
     sight, a viewer never sent counted whole */
  w.record.registerStatsSource("test", ({ viewer }) => w.record.counts(viewer === undefined ? null : hiddenBundles(viewer)));
  assert.equal(w.record.stats({ viewer: V("bob") }).inquiryMigrationReplays, 2);
  assert.equal(w.record.stats({ viewer: V("alice") }).inquiryMigrationReplays, 3);
  assert.equal(w.record.stats({}).inquiryMigrationReplays, 3);
  const before = w.record.proofCounts();
  assert.equal(before.inquiryMigrationReplays, 3, "purge's proof is whole");
  w.record.transact(() => w.record.purge({ bundleId: OPEN }));
  const after = w.record.proofCounts();
  assert.equal(after.inquiryMigrationReplays, 2);
  assert.equal(before.inquiryMigrationReplays - after.inquiryMigrationReplays, 1, "the proof shows the replay row taken");
  assert.equal(after.inquiryMigrationReplays, pinnedCount(w, null));
});

/* The leg-grade corpus: one document per capture ceiling, each by the route its bytes came by (provenance R24–R26): a
   direct fetch earns B, an archive replay one rank below (C), a route no ruling grades leaves it undetermined; and
   replayed legs stating a letter above each (a replay is exempt from the earned arm at the write, R11, so the stated
   letter stands in the bytes and the ceiling caps it at the read). */
const DB = "INFO-2026-0610-direct", DC = "INFO-2026-0611-archive", DU = "INFO-2026-0612-unruled", NONE = "INFO-2026-0619-none";
function legCorpus(opts = {}) {
  const w = world(opts);
  w.doc(DB, ["direct"]);
  w.doc(DC, ["archive"], { via: "archive.org" });
  w.doc(DU, ["unruled"], { via: "carrier-pigeon" });
  return w;
}

test("R52 (2) leg-earning R2: the resolver caps each leg's capture letter as legCapped answers it over its target's earned capture ceiling, in order; a target with no ceiling answers null; an empty list answers none", () => {
  const w = legCorpus();
  const resolve = inquiryLegGrades(w.host);
  const legs = [{ grade: "B", target_id: DC }, { grade: "B", target_id: DB }, { grade: "A", target_id: DU },
                { grade: "C", target_id: NONE }, { grade: "A", target_id: DB }, { grade: "D", target_id: DC }];
  const cap = w.k.earned(null, [DC, DB, DU, NONE]).earned.capture;
  const got = resolve(legs);
  assert.deepEqual(got, legs.map((l) => legCapped(l.grade, cap[l.target_id], l.target_id)), "legCapped's answer over the earned ceiling, leg for leg");
  assert.equal(got[0].grade, "C", "B above the archive replay's C is read at C");
  assert.equal(got[1], null, "B within the ceiling stands");
  assert.equal(got[2].grade, null, "an undetermined ceiling answers a null grade");
  assert.match(got[2].why, /no ruling grades/);
  assert.equal(got[3], null, "a target the record holds no capture of has no ceiling");
  assert.equal(got[4].grade, "B");
  assert.equal(got[5], null);
  assert.deepEqual(resolve([]), []);
  assert.deepEqual(w.k.legGrades([]), []);
  assert.deepEqual(w.k.legGrades(legs), got, "the instance's own method answers the same");
});

test("R52 (2) leg-earning R1: the resolver asks leg-earning's earned once per list, with no subject entity, over the list's distinct targets; an empty list asks nothing", () => {
  const w = legCorpus();
  const asked = [];
  const le = w.k.legEarning;
  const earned = le.earned.bind(le);
  le.earned = (s, t, c) => { asked.push([s, t, c]); return earned(s, t, c); };
  try {
    inquiryLegGrades(w.host)([{ grade: "B", target_id: DC }, { grade: "A", target_id: DC }, { grade: "B", target_id: DB }]);
    assert.deepEqual(asked, [[null, [DC, DB], undefined]]);
    asked.length = 0;
    inquiryLegGrades(w.host)([]);
    assert.deepEqual(asked, []);
  } finally { delete le.earned; }
});

test("R52 (2) retrieval R55, R12: registered through registerLegGrades as `inquiry`, the resolver caps the leg rows' capture letters, the authored letter beside the earned one; a leg onto a question passes unchanged", () => {
  const w = legCorpus({ realRetrieval: true });
  const Q = "INQ-2026-0620-q", R = "INQ-2026-0621-r";
  assert.equal(w.inquiry(R).ok, true);
  const legs = [{ target: DC, grade: "B", grade_axis: "capture", grade_source: "capture" },
                { target: DB, grade: "B", grade_axis: "capture", grade_source: "capture" },
                { target: DU, grade: "B", grade_axis: "capture", grade_source: "capture" },
                { target: R }];
  assert.equal(w.promote(Q, inquiryMd(Q, { legs }), null, { replay: true }).ok, true);
  assert.deepEqual(w.retrieval.registerLegGrades("inquiry", inquiryLegGrades(w.host)), { ok: true, module: "inquiry" });
  assert.equal(w.retrieval.registerLegGrades("plane", () => []).declaredBy, "inquiry", "one resolver, registered as inquiry");
  const rows = w.retrieval.meaningRows({ q: "", rows: "leg", viewer: "admin", limit: 500 }).rows.filter((r) => r.bundle_id === Q);
  const at = (t) => rows.find((r) => r.target_id === t);
  const cap = w.k.earned(null, [DC, DB, DU]).earned.capture;
  for (const t of [DC, DB, DU]) {
    const want = legCapped("B", cap[t], t);
    assert.deepEqual([at(t).grade, at(t).grade_authored, at(t).grade_why],
      want ? [want.grade, "B", want.why] : ["B", "B", null], t);
  }
  assert.equal(at(DC).grade, "C");
  assert.equal(at(DU).grade, null);
  assert.deepEqual([at(R).grade, at(R).grade_why], [null, null], "a leg onto a question carries no capture letter to cap");
});

/* T33-45 (K617, K1505; plan Rules (9) item 4): the earned registry and the resting-on reads are leg-earning's. This
   module's projection writes `inquiry_basis` only through leg-earning's one write, and its names and reads answer
   exactly what leg-earning's do, for importers not yet re-pointed. */
import * as LE from "../../../src/leg-earning/index.mjs";
import * as INQ from "../../../src/inquiry/index.mjs";

test("R12 R29 R40 the projection writes inquiry_basis only through leg-earning's writeBasis, once per promotion, the legs whole and in order", () => {
  const w = legCorpus();
  const calls = [];
  const le = w.k.legEarning, write = le.writeBasis.bind(le);
  le.writeBasis = (id, rows) => { calls.push([id, rows.map((r) => [r.ord, r.target, r.role])]); return write(id, rows); };
  try {
    const Q = "INQ-2026-0630-q";
    assert.equal(w.inquiry(Q, { legs: [{ target: DB }, { target: DC, role: "cuts_against" }] }).ok, true);
    assert.deepEqual(calls, [[Q, [[0, DB, "supports"], [1, DC, "cuts_against"]]]]);
    assert.equal(w.row(`SELECT inquiry_basis_count AS n FROM inquiry_bundle_facts WHERE bundle_id=?`, Q).n, 2);
    /* a promotion of anything else writes none */
    calls.length = 0;
    w.doc("INFO-2026-0631-z");
    assert.deepEqual(calls, [["INFO-2026-0631-z", []]]);
  } finally { delete le.writeBasis; }
});

test("R11 R29 R39 R52 Rules (9): the moved names are leg-earning's own bindings, and the instance's reads answer exactly what leg-earning's answer", () => {
  for (const n of ["legCapped", "LEG_BACKFILL_MAX", "EARNED_TARGETS_MAX", "PROJECTS_DRAWING_MAX", "AUTHORED_ROUTE_BASES"])
    assert.equal(INQ[n], LE[n], n);
  const w = legCorpus();
  const Q = "INQ-2026-0640-q", R = "INQ-2026-0641-r";
  w.inquiry(R, { legs: [{ target: DB }] });
  w.inquiry(Q, { legs: [{ target: DC }, { target: R }] });
  const le = w.k.legEarning;
  assert.equal(le, LE.legEarningOf(w.host), "the host's one leg-earning instance");
  assert.deepEqual(w.k.basisFor(Q), le.basisFor(Q));
  assert.deepEqual(w.k.basisFor(Q, { limit: 1 }), le.basisFor(Q, { limit: 1 }));
  assert.deepEqual(w.k.restingOn(R), le.restingOn(R));
  assert.deepEqual(w.k.restsOnLive(R), le.restsOnLive(R));
  assert.deepEqual(w.k.cyclePath(R, [Q]), le.cyclePath(R, [Q]));
  assert.deepEqual(w.k.earned(null, [DB, DC]), le.earned(null, [DB, DC]));
  assert.deepEqual(w.k.earnedForDoc({}, [{ target: DB }]), le.earnedForDoc({}, [{ target: DB }]));
  assert.deepEqual(w.k.earnedBasis({ id: Q, viewer: "admin" }), le.earnedBasis({ id: Q, viewer: "admin" }));
  assert.deepEqual([...w.k.projectsDrawingOn(R)], [...le.projectsDrawingOn(R)]);
});
