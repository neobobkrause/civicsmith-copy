/* question-explorer over ai-runs PR 391 (its R75 as restated: `gateVerdictRecord`, `gateVerdictRecords`; R78's
   `partAdmitted(part, entry)`), with F1 (R7 and R16's admission judged on the paying account's entry). Gate 1's verdict is
   per (entry, part) and `ai-runs` now writes it, so the explorer's gate (R7, R16) asks `partAdmitted` on the entry the run
   would be served on: the one `ai-accounts` chooses for the act of kind `run` of the member who turned exploring on (its
   R25 `accountServing`, R11's choice, as `ai-runs.open` asks `accountFor`). Asked with no entry, as before PR 391, no
   record written for an entry could ever open the gate off a test instance.

   The first test is on ai-runs' real code (its published world): the record is written through its real
   `gateVerdictRecord` and read back through its real `partAdmitted`. The second drives the explorer's own tick through
   this module's world, with ai-accounts' real account serving dana's run. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, CAP, CALLER } from "./fixture.mjs";
import { world as runsWorld, OPEN, INQ, T0, ENTRIES, TEST_SET as RUNS_TEST_SET, PLANS, HOSTS } from "../ai-runs/world.mjs";
import { gateOf } from "../ai-catalogue/fixture.mjs";

const T1 = "2026-07-02T00:00:00Z";

/** ai-runs' real world: `investigate` may deploy (check verified live), the explorer's bar held on its test set, and no
 *  Gate 1 verdict held for any entry but what a test writes through `gateVerdictRecord`. */
async function realRuns() {
  const r = runsWorld({ deployedModes: ["check", "investigate"] });
  await r.group("ann", "dana");
  r.bundle(INQ);
  await r.runs.open(OPEN({ run: "V" }));
  assert.equal(r.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  r.gates.length = 0;
  /* the explorer's bar on the test investigations, its false-alarm rate recorded (R7), through ai-runs' real R75 act */
  assert.equal(r.runs.testBarRecord({ part: "explore", set: RUNS_TEST_SET.id, set_version: RUNS_TEST_SET.version,
                                      false_alarm_rate: 0.1, passed: true, graded_by: "harness", at: T0 }).ok, true);
  return r;
}

test("notice ai-runs:391 (R7, R16, F1): a passing Gate 1 record ai-runs writes through gateVerdictRecord for an entry opens the explorer's gate on that entry, unlabelled, off a test instance, and on no other entry; a later not_suitable for it shuts it; control: the gate asked with no entry stays shut whatever is written", async () => {
  const r = await realRuns();
  const w = await world({ gateOpen: false, testSet: RUNS_TEST_SET }).standard();
  /* the explorer reads ai-runs' real gate and what its record holds (R7's `held`, its R19 and R75 reads) */
  w.p.aiRuns = r.runs;
  w.p.held = () => ({ verifications: r.runs.verifications(), testBars: r.runs.testBarRecords() });
  assert.equal(r.runs.testInstance(), false, "not a test instance");
  assert.equal(w.p.gate({ entry: ENTRIES.a }).open, false, "no Gate 1 record: shut");
  const wrote = r.runs.gateVerdictRecord(r.gate("run", ENTRIES.a));
  assert.equal(wrote.ok, true, JSON.stringify(wrote));
  const g = w.p.gate({ entry: ENTRIES.a });
  assert.deepEqual([g.open, g.untested], [true, null], JSON.stringify(g));
  assert.equal(g.false_alarm_rate, 0.1, "R7's recorded rate applies");
  assert.equal(w.p.gate({ entry: ENTRIES.b }).open, false, "another entry is not admitted by it");
  assert.equal(w.p.gate().open, false, "control: no entry named, nothing written for an entry opens it");
  /* the latest verdict for (entry, part) counts: not_suitable shuts it again */
  assert.equal(r.runs.gateVerdictRecord({ ...r.gate("run", ENTRIES.a), verdict: "not_suitable", at: T1 }).ok, true);
  assert.equal(w.p.gate({ entry: ENTRIES.a }).open, false);
});

/** The team's account (made by `setExplore`) switched on by an administrator and its recipient's notice read by dana, so
 *  that ai-accounts' real choice serves dana's run on it. */
function teamServes(w) {
  const u = w.aiAccounts.accountUsesOf({ owner: "group" });
  assert.equal(w.aiAccounts.accountSwitch({ account_id: u.account_id, on: true, by: "dana" }).ok, true);
  w.aiAccounts.recipientNoticeSeen({ member: "dana", provider: PLANS.provider, host: HOSTS.main, by: "dana" });
  const s = w.aiAccounts.accountServing({ member: "member:dana", use: "run", project: null });
  assert.equal(typeof s.entry_id, "string", JSON.stringify(s));
  return s.entry_id;
}

test("notice ai-runs:391 (R1, R5, R7, F1): off a test instance, with Gate 1 passed for the entry dana's run is served on, the tick asks the gate on that entry, opens the run keeping the entry, and its find is offered; control: Gate 1 passed only for another entry, the gate stays shut, nothing opens and nothing is offered", async () => {
  for (const passedFor of ["served", "other"]) {
    const w = await world().standard();
    await w.setExplore("group", "yes");
    const served = teamServes(w);
    w.testInstance = false;
    const entry = passedFor === "served" ? served : `${served}-other`;
    w.gateRecords = [{ ...gateOf("passes"), part: "run", entry_id: entry, grade: "MEASURED" }];
    const t = await w.p.exploreTick(w.clock.now);
    assert.ok(w.calledAs("partAdmitted").some((a) => a.entry === served), "the gate asked on the entry dana's run is served on");
    if (passedFor === "other") {
      assert.deepEqual([t.gate, t.opened.length, w.calledAs("open").length], ["closed", 0, 0], JSON.stringify(t).slice(0, 300));
      assert.equal(await w.p.exploreDue(w.clock.now), 0);
      assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }).finds, []);
      continue;
    }
    assert.equal(t.opened.length, 1, JSON.stringify(t).slice(0, 400));
    const run = t.opened[0].run;
    assert.equal(w.row(`SELECT entry FROM explore_runs WHERE run=?`, run).entry, served, "the entry kept with the run");
    const f = w.p.find({ run, kind: "capture", ref: CAP, bearing: "supports", how: "the minutes record the vote", caller: CALLER });
    assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
    assert.equal(f.gauge.untested, null, "unlabelled: the bar held, Gate 1 passed for the entry");
    assert.ok(w.p.findsFor({ viewer: "member:alice" }).finds.some((x) => x.find === f.find), "offered on its run's entry");
  }
});
