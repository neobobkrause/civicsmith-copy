/* action-plans R55, R56 (T53; agent-steps R54, R56): a retried `optionPropose` carrying an `idem` stores one proposal and
   answers the first call's answer with `repeated: true`; a proposal keeps who produced it (`produced_by`), a member's
   own answering null. A label's fields are read from ai-runs' `LABEL_FIELDS`, the product's own list: `agent-model`
   publishes no label fixture yet (its R26), as capture-requests' T53 test reads them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, opened, V, MACHINE, AGENT, RUN_PRINCIPAL, by } from "./fixture.mjs";
import { ACTION_PLAN_CHECKS } from "../../../src/action-plans/index.mjs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";

const code = (r) => r.code ?? r.reason;
const label = (who) => Object.fromEntries(AiRuns.LABEL_FIELDS.map((f) => [f, f === "effort" ? "high" : `${f} of ${who}`]));
const propose = (w, run, extra = {}) => w.ap.optionPropose({ plan: w.PL, summary: "Ask the clerk", category: "awareness",
  subjects: [w.S1], why: "The clerk holds the records", run, sources: [w.D], proposer: AGENT, principal: RUN_PRINCIPAL,
  viewer: MACHINE, ...extra });
const count = (w) => w.rows(`SELECT COUNT(*) AS n FROM plan_option_proposals`)[0].n;

test("R55: a retried optionPropose with the same idem stores one proposal and answers the first answer verbatim with repeated: true; a changed candidate's new idem stores its own; a member's proposal still records her own and opens no run (control)", async () => {
  const w = seeded();
  opened(w);
  const { run } = w.openRun({ plan: w.PL, project: w.P, proposals: 3 });
  const idem = `${run}:1:propose:1`;
  const first = await propose(w, run, { idem });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal("repeated" in first, false);
  assert.equal(count(w), 1);
  assert.equal(w.runs.get(run).bounds.proposals.consumed, 1);
  /* the step re-runs after a stop: its run is no longer running, and the same idem still answers the first answer */
  w.runs.get(run).status = "stopped";
  const again = await propose(w, run, { idem });
  assert.deepEqual(again, { ...first, repeated: true }, "the first answer, verbatim, repeated: true");
  assert.equal(count(w), 1, "no second proposal stored");
  assert.equal(w.runs.get(run).bounds.proposals.consumed, 1, "the bound spent once");
  w.runs.get(run).status = "running";
  /* control: a changed candidate carries a new idem and stores its own */
  const changed = await propose(w, run, { idem: `${run}:1:propose:2`, summary: "Ask the auditor" });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.equal("repeated" in changed, false);
  assert.notEqual(changed.proposal.id, first.proposal.id);
  assert.equal(count(w), 2);
  /* control: the same idem from another principal is not this principal's repeat */
  const other = w.openRun({ plan: w.PL, project: w.P, principal: "member:ann/tok-2" });
  const theirs = await propose(w, other.run, { idem, principal: "member:ann/tok-2" });
  assert.equal(theirs.ok, true, JSON.stringify(theirs));
  assert.equal("repeated" in theirs, false);
  assert.equal(count(w), 3);
  /* control: with no idem, R11's call as before stores each */
  assert.equal((await propose(w, run)).ok, true);
  assert.equal(count(w), 4);
  /* control: a member's optionpropose still records her own proposal and opens no run */
  const opens = w.ctl.opens.length;
  const mine = await w.ap.optionPropose({ plan: w.PL, summary: "Mine", category: "other", subjects: [w.S1], why: "w",
    idem: "mine:1", proposer: V("bob"), viewer: V("bob") });
  assert.equal(mine.ok, true, JSON.stringify(mine));
  assert.equal(mine.proposal.label.machine_work, false);
  assert.equal(w.ctl.opens.length, opens, "no run opened");
  assert.deepEqual(await w.ap.optionPropose({ plan: w.PL, summary: "Mine", category: "other", subjects: [w.S1], why: "w",
    idem: "mine:1", proposer: V("bob"), viewer: V("bob") }), { ...mine, repeated: true });
  assert.equal(count(w), 5);
});

test("R56: a proposal keeps who produced it, deduplicated in order, answered by every read; one after a hop names the new label; a member's own answers null and a malformed list stores nothing (controls); a repeated idem answers the first list", async () => {
  const w = seeded();
  opened(w);
  const { run } = w.openRun({ plan: w.PL, project: w.P, proposals: 4 });
  const before = await propose(w, run, { produced_by: [label("old")], idem: `${run}:1:propose:1` });
  const after = await propose(w, run, { produced_by: [label("old"), label("new"), label("old")], summary: "Ask the auditor" });
  assert.equal(before.ok, true, JSON.stringify(before));
  assert.deepEqual(before.proposal.produced_by, [label("old")]);
  assert.deepEqual(after.proposal.produced_by, [label("old"), label("new")], "the hop's new label, deduplicated in order");
  /* every read answers it as stored: the tray and the plan */
  const tray = w.ap.planProposals({ plan: w.PL, run, viewer: V("bob") });
  assert.deepEqual(tray.proposals.map((p) => p.produced_by), [[label("old")], [label("old"), label("new")]]);
  const read = w.ap.planRead({ id: w.PL, viewer: V("bob") });
  const json = JSON.stringify(read);
  assert.ok(json.includes(JSON.stringify([label("old"), label("new")])), "planRead answers the list as stored");
  /* a repeated idem answers the first proposal's list, even when the retry names another */
  const again = await propose(w, run, { produced_by: [label("new")], idem: `${run}:1:propose:1` });
  assert.equal(again.repeated, true);
  assert.deepEqual(again.proposal.produced_by, [label("old")]);
  /* control: a malformed list is refused by its row, nothing stored, the bound unspent */
  const n = w.rows(`SELECT COUNT(*) AS n FROM plan_option_proposals`)[0].n;
  const spent = w.runs.get(run).bounds.proposals.consumed;
  for (const bad of ["old", [label("old"), "x"], [{ ...label("old"), score: "9" }], [{}], [{ provider: 3 }]]) {
    const r = await propose(w, run, { produced_by: bad });
    assert.equal(code(r), "PLAN_PRODUCED_BY_MALFORMED", JSON.stringify(bad));
    assert.equal(r.check, ACTION_PLAN_CHECKS.PLAN_PRODUCED_BY_MALFORMED.check);
    assert.equal(r.translation, ACTION_PLAN_CHECKS.PLAN_PRODUCED_BY_MALFORMED.translation);
  }
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM plan_option_proposals`)[0].n, n, "nothing stored");
  assert.equal(w.runs.get(run).bounds.proposals.consumed, spent);
  /* control: a member's own proposal answers null; a machine's with none named answers null too */
  const mine = await w.ap.optionPropose({ plan: w.PL, summary: "Mine", category: "other", subjects: [w.S1], why: "w",
    produced_by: [label("old")], proposer: V("bob"), viewer: V("bob") });
  assert.equal(mine.ok, true, JSON.stringify(mine));
  assert.equal(mine.proposal.produced_by, null);
  assert.equal((await propose(w, run, { summary: "Ask the press" })).proposal.produced_by, null);
});
