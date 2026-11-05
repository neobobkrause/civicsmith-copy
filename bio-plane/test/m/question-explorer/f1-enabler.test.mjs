/* question-explorer F1 (K5821, Bob's REC-11; run-rules R18 as its F1 amends it; ai-runs F2, PR 348): an exploring run is
   accountable to the member who turned exploring on. The explorer finds that member in ai-accounts' real history of the
   account's `explore` switch (its R14, R16) and opens the run with `enabledBy` that member's id, which run-rules' real
   `startAllowed` judges. If that member is gone or no longer allowed, the run is refused with run-rules' own sentence,
   which reaches the account's owners (`exploringOff`), and exploring stays off until a member turns it on again.

   ai-runs' open is the fixture's (the explorer's tick reaches it), and here it judges as ai-runs F2 specifies: run-rules'
   real `startAllowed` with the open's `origin` and `enabledBy`, the enabling member's standing read from the real
   membership, its refusal relayed in ai-runs' open shape (`{run, started: false, code, check, translation, detail}`).
   Every sentence asserted is the one run-rules' real code answers, never a copy. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startAllowed } from "../../../src/run-rules/index.mjs";
import { world, Q, PROJ } from "./fixture.mjs";
import { world as runsWorld, OPEN, INQ, T0 } from "../ai-runs/world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";

const DAY2 = "2026-10-11T09:00:00Z", DAY3 = "2026-10-12T09:00:00Z";

/** ai-runs' open as its F2 states it: `startAllowed` judged on the member who turned exploring on, at each run. */
function judgeAsAiRunsF2(w) {
  const open = w.aiRuns.open;
  w.aiRuns.open = async (a) => {
    const id = typeof a.enabledBy === "string" && a.enabledBy.startsWith("member:") ? a.enabledBy.slice(7) : null;
    const facts = id ? w.membership.memberFacts(id) : null;
    const said = startAllowed({ startedBy: null, mode: a.mode, origin: a.origin, enabledBy: a.enabledBy,
                                enablerAllowed: !!facts && facts.status === "active" });
    if (!said || said.ok !== true) {
      w.calls.push({ name: "open", a });
      return { run: a.run, started: false, code: said.code, check: said.check, translation: said.translation, detail: said.detail };
    }
    return open(a);
  };
  return w;
}

test("F1 (run-rules R18): the exploring run's open carries as enabledBy the member who turned exploring on, never a label, and run-rules' real startAllowed admits it with that member accountable; control: a project's run carries its own owner who turned it on", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  const [open] = w.calledAs("open");
  assert.equal(open.enabledBy, "member:dana", "dana, the administrator who set the team's explore to yes");
  assert.equal(o.enabled_by, "member:dana");
  assert.deepEqual(startAllowed({ origin: open.origin, mode: open.mode, enabledBy: open.enabledBy, enablerAllowed: true }),
                   { ok: true, origin: "explore", accountable: "member:dana" }, "run-rules R18 judges it on dana");
  /* Control: a project's exploring, turned on by alice, its owner, is alice's. */
  const p = await world().standard();
  p.project(PROJ, ["alice"], { owners: ["alice"] });
  p.draw(Q, PROJ);
  await p.setExplore("group", "no");
  const po = await p.openRun(`project:${PROJ}`);
  assert.equal(p.calledAs("open").at(-1).enabledBy, "member:alice");
  assert.equal(po.owner, `project:${PROJ}`);
});

test("F1: the member who turned exploring on is gone, so the run is refused with run-rules' sentence, which reaches the account's owners and no one else, and exploring stays off on later days; control: another administrator turns it on again and the next run opens, accountable to her", async () => {
  const w = judgeAsAiRunsF2(await world().standard());
  w.member("erin", "admin");
  w.member("frank", "admin");
  await w.setExplore("group", "yes");
  /* dana, who turned it on, is removed by the other administrators' votes (membership's real act). */
  w.membership.adminRemove({ memberId: "dana", by: "erin", reason: "left" });
  assert.equal(w.membership.adminRemove({ memberId: "dana", by: "frank", reason: "left" }).removed, true);
  const said = startAllowed({ origin: "explore", enabledBy: "member:dana", enablerAllowed: false });

  const t = await w.p.exploreTick(w.clock.now);
  assert.equal(t.opened.length, 0, JSON.stringify(t).slice(0, 300));
  assert.equal(w.calledAs("open").at(-1).enabledBy, "member:dana", "judged on dana");
  assert.deepEqual(t.off, [{ owner: "group", code: said.code, detail: said.detail }]);
  assert.equal(w.count("explore_runs"), 0, "no run");
  /* The reason reaches the screen: the account's owners read it, run-rules' own words. */
  const off = w.p.exploringOff({ viewer: "member:erin" }).off;
  assert.deepEqual(off.map((x) => [x.owner, x.code, x.check, x.translation, x.detail, x.enabled_by, x.exploring]),
                   [["group", said.code, said.check, said.translation, said.detail, "member:dana", "off"]]);
  assert.deepEqual(w.p.exploringOff({ viewer: "member:alice" }).off, [], "not an owner of the team's account");

  /* Stays off: the next day nothing is asked of ai-runs for the team. */
  w.clock.now = DAY2;
  const opens = w.calledAs("open").length;
  const t2 = await w.p.exploreTick(w.clock.now);
  assert.equal(t2.opened.length, 0);
  assert.equal(w.calledAs("open").length, opens, "exploring is off; no open was asked");
  assert.equal(w.p.exploringOff({ viewer: "member:frank" }).off.length, 1);

  /* Control: erin turns it on again by her own act; the next run opens, accountable to her, and it is no longer off. */
  w.clock.now = DAY3;
  const head = w.aiAccounts.accountUsesOf({ owner: "group" });
  assert.equal(w.aiAccounts.accountUsesSet({ account_id: head.account_id, switch: "explore", on: "yes", by: "member:erin" }).ok, true);
  const t3 = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(t3.opened.map((x) => [x.owner, x.enabled_by]), [["group", "member:erin"]], JSON.stringify(t3).slice(0, 300));
  assert.equal(w.calledAs("open").at(-1).enabledBy, "member:erin");
  assert.deepEqual(w.p.exploringOff({ viewer: "member:erin" }).off, []);
});

test("F1: with no owner left to read who turned exploring on, no member is accountable, so run-rules refuses the run before ai-runs is asked and exploring is off; control: the same world with its owner opens", async () => {
  const w = await world().standard();
  w.project(PROJ, ["alice", "bob"], { owners: ["alice"] });
  w.draw(Q, PROJ);
  await w.setExplore("group", "no");
  await w.setExplore(`project:${PROJ}`, "yes");
  /* The project's only owner is no longer one (membership's record of owners), so no owner reads its account. */
  w.st.sql.exec(`UPDATE project_participants SET owner=0 WHERE project_id=?`, PROJ);
  assert.deepEqual(w.membership.projectOwners(PROJ), []);
  const said = startAllowed({ origin: "explore", enabledBy: null });
  const t = await w.p.exploreTick(w.clock.now);
  assert.equal(t.opened.length, 0);
  assert.equal(w.calledAs("open").length, 0, "nothing asked of ai-runs");
  assert.deepEqual(t.off, [{ owner: `project:${PROJ}`, code: said.code, detail: said.detail }]);
  assert.equal(said.exploring, "off");
  /* Control: with alice its owner again (and a new turning-on by her), the run opens, hers. */
  w.st.sql.exec(`UPDATE project_participants SET owner=1 WHERE project_id=? AND member_id='alice'`, PROJ);
  w.clock.now = DAY2;
  await w.setExplore(`project:${PROJ}`, "yes");
  const t2 = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(t2.opened.map((x) => [x.owner, x.enabled_by]), [[`project:${PROJ}`, "member:alice"]], JSON.stringify(t2).slice(0, 300));
});

/** ai-runs' real world (its published world, with steps'): `investigate` may deploy (check verified live), ann and dana
 *  members. */
async function realRuns() {
  const f = stepsWorld();
  const r = runsWorld({ steps: f.steps, deployedModes: ["check", "investigate"] });
  await r.group("ann", "dana");
  r.bundle(INQ);
  await r.runs.open(OPEN({ run: "V" }));
  assert.equal(r.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  return { r, f };
}

test("F1 (ai-runs F2, PR 348): the explorer's own open, replayed on ai-runs' real open, opens accountable to dana who turned exploring on; refused AI_RUN_NOT_A_MEMBER_ACT with exploring off once she is gone, and the explorer, handed that real refusal, keeps exploring off with its sentence for the owners; control: the open as it was before F1 (a label) is refused too", async () => {
  const w = await world().standard();
  await w.openRun("group");
  const [mine] = w.calledAs("open");
  assert.equal(mine.enabledBy, "member:dana");
  const { r, f } = await realRuns();
  const moved = { ...mine, contextId: INQ, place: f.place, at: T0 };
  const x = await r.runs.open({ ...moved, run: "XPL-1" });
  assert.deepEqual([x.started, x.origin], [true, "explore"], JSON.stringify(x).slice(0, 300));
  assert.equal(r.rows(`SELECT principal_ai_ref FROM ai_runs WHERE run = 'XPL-1'`)[0].principal_ai_ref, "member:dana");
  /* Control: the label the explorer passed before F1 reads as no member, and is refused. */
  const old = await r.runs.open({ ...moved, run: "XPL-0", enabledBy: { kind: "machine", enabled_by: "group" } });
  assert.deepEqual([old.started, old.code], [false, "AI_RUN_NOT_A_MEMBER_ACT"]);
  /* dana is gone: the same open is refused, exploring off. */
  r.membership.memberSet({ memberId: "dana", status: "revoked", by: "admin" });
  const refused = await r.runs.open({ ...moved, run: "XPL-2" });
  assert.deepEqual([refused.started, refused.code, refused.exploring], [false, "AI_RUN_NOT_A_MEMBER_ACT", "off"], JSON.stringify(refused).slice(0, 300));
  assert.deepEqual(r.rows(`SELECT run FROM ai_runs WHERE run = 'XPL-2'`), []);
  /* The explorer handed ai-runs' real refusal: no run, exploring off for the team, its sentence for the team's owners. */
  const e = await world().standard();
  await e.setExplore("group", "yes");
  e.openRefuse = refused;
  const t = await e.p.exploreTick(e.clock.now);
  assert.equal(t.opened.length, 0);
  assert.deepEqual(t.off, [{ owner: "group", code: refused.code, detail: refused.detail }]);
  assert.deepEqual(e.p.exploringOff({ viewer: "member:dana" }).off.map((o) => [o.code, o.translation, o.detail]),
                   [[refused.code, refused.translation, refused.detail]]);
  e.openRefuse = null;
  e.clock.now = DAY2;
  const before = e.calledAs("open").length;
  assert.equal((await e.p.exploreTick(e.clock.now)).opened.length, 0, "still off the next day");
  assert.equal(e.calledAs("open").length, before);
});
