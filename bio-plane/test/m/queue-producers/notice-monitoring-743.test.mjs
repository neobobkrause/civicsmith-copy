/* Notice monitoring:743 (PR 743; monitoring R81, amending its R30): the administrator's pause now also stops register
   slices and keyed docket polls. PR 743 changed monitoring's tests and its requirement mark, not the reads this module
   makes: the `sources` feed (R2's source-modified and source-removed, R40, R45) reads `monitoring.flagged` (its R48) alone.
   Confirmed with no code change here: over monitoring's REAL seeded world (its published `monitoringReads`), read live,
   a pause stops no flag this module reads: the flagged documents are still raised while paused and after the resume, and
   the `sources` feed is not named failed. Control: a pause asked by a member who is not an administrator is refused. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, MONITORING } from "./world.mjs";

const ADMIN = "class:admin";

test("notice monitoring:743 (R2, R40, R45; monitoring R30, R48, R81): with the administrator's pause on, the documents monitoring flagged are still one source-modified and one source-removed item, and the sources feed answered; resumed, the same; control: a non-administrator's pause is refused and changes nothing", () => {
  const F = MONITORING.seeded, m = F.world.m;
  const MOD = F.bundles.modified, REM = F.bundles.removed;
  /* monitoring's real `flagged`, read live at every feed read, so the pause is seen as it stands */
  const w = world({ monitoring: { flagged: () => m.flagged({ viewer: F.viewer }) } });
  w.member("alice");
  w.bundle(MOD, "information", { title: "Water Quality Report" });
  w.bundle(REM, "information", { title: "Zoning Memo" });
  const read = () => w.read("alice", "member:alice", { now: F.now });
  const raised = (r) => ({ modified: !!byId(r)[`FINDING::source-modified::${MOD}`], removed: !!byId(r)[`FINDING::source-removed::${REM}`] });
  const failedSources = (r) => r.facts.failed.filter((f) => f.feed === "sources");

  assert.equal(m.pause({ paused: true, by: "nobody" }).reason, "NOT_AN_ADMIN", "control: refused");
  assert.deepEqual(m.sweepHost().paused(), { paused: false });
  const before = read();
  assert.deepEqual(raised(before), { modified: true, removed: true });

  assert.equal(m.pause({ paused: true, by: ADMIN }).ok, true);
  assert.equal(m.sweepHost().paused().paused, true, "the pause is on (R30, R81)");
  try {
    const paused = read();
    assert.deepEqual(raised(paused), { modified: true, removed: true }, "a pause stops checks, not the flags already found");
    assert.deepEqual(failedSources(paused), [], "the sources feed answered while paused");
  } finally {
    assert.equal(m.pause({ paused: false, by: ADMIN }).ok, true);
  }
  const resumed = read();
  assert.deepEqual(raised(resumed), { modified: true, removed: true });
  assert.deepEqual(failedSources(resumed), []);
});
