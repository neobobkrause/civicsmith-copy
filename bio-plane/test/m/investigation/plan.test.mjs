/* investigation R20, R21: planning proposals from mode `enquire`, accepted only by a member's one act; every act here
   has a path by hand that needs no AI. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, ANN, BOB, CAT, DAN, OUT, AI, P1, PH, Q1, Q3 } from "./fixture.mjs";
import { INVESTIGATION_CHECKS } from "../../../src/investigation/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

test("R20: planPropose stores a proposed question or step drawn from a member's words, labelled the system's; never a question or step until accepted", () => {
  const w = world();
  w.runs();
  const before = w.snapshot();
  const prop = (args) => w.inv.planPropose({ project: P1, kind: "step", text: "Ask the district for the newsletter", run: "RUN-1", by: AI, ...args });
  assert.equal(prop({ by: ANN }).code, "PLAN_NOT_A_MACHINE");
  assert.equal(prop({ run: "RUN-9" }).code, "PLAN_NOT_YOUR_RUN");
  assert.equal(prop({ kind: "action" }).code, "PLAN_BAD_KIND");
  assert.equal(prop({ text: "" }).code, "PLAN_NO_TEXT");
  assert.equal(prop({ question: Q3 }).code, "NO_SUCH_QUESTION");
  assert.equal(prop({ project: PH }).code, "NO_SUCH_PROJECT", "beyond its principal's sight");
  assert.equal(w.snapshot(), before);
  const bundles = w.rows(`SELECT COUNT(*) AS n FROM bundles`)[0].n;
  const p = prop({ question: Q1 });
  assert.deepEqual([p.ok, p.label], [true, { by: AI, state: "machine_proposed", machine_work: true }]);
  const q = prop({ kind: "question", text: "Did the district promise one school year?" });
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM steps`)[0].n, 0, "not a step");
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM bundles`)[0].n, bundles, "not a question");
  const list = w.inv.planProposals({ project: P1, viewer: BOB }).proposals;
  assert.deepEqual(list.map((x) => [x.proposal, x.kind, x.status]), [[p.proposal, "step", "proposed"], [q.proposal, "question", "proposed"]]);
  assert.equal(w.inv.planProposals({ project: P1, viewer: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
});

test("R20: planAccept is the member's one accepting act (record-grammar R52): a step by steps in her name, a question by her own promotion; own_instead sets it aside for her words", () => {
  const w = world();
  w.runs();
  const prop = (kind, text, extra = {}) => w.inv.planPropose({ project: P1, kind, text, run: "RUN-1", by: AI, ...extra }).proposal;
  const a = prop("step", "Ask the district for the newsletter", { question: Q1 });
  const b = prop("question", "Did the district promise one school year?");
  const c = prop("step", "Call the board clerk");
  assert.equal(w.inv.planAccept({ proposal: a, form: "taken", by: ANN }).code, "PLAN_BAD_FORM");
  assert.equal(w.inv.planAccept({ proposal: a, form: "as_proposed", by: AI }).code, "INVESTIGATION_MEMBER_ONLY");
  assert.equal(w.inv.planAccept({ proposal: a, form: "as_proposed", by: DAN }).code, "NO_SUCH_PLANNING_PROPOSAL");
  assert.equal(w.inv.planAccept({ proposal: a, form: "as_proposed", by: OUT }).code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(w.inv.planAccept({ proposal: a, form: "edited", by: ANN }).code, "PLAN_NO_TEXT", "edited carries her words");
  const r1 = w.inv.planAccept({ proposal: a, form: "as_proposed", by: BOB });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.deepEqual({ ...r1.acceptance, at: null }, { proposal: `plan:${a}`, form: "as_proposed", by: BOB, at: null, kind: "plan-step" });
  const s = w.steps.step({ step: r1.made, viewer: ANN });
  assert.deepEqual([s.work, s.doer, s.place], ["Ask the district for the newsletter", "bob-h", { questions: [Q1] }]);
  assert.equal(w.inv.planAccept({ proposal: a, form: "edited", text: "again", by: ANN }).code, "PLAN_DECIDED");
  const r2 = w.inv.planAccept({ proposal: b, form: "edited", text: "Did the district state, in writing, that the closure is for one school year?", by: ANN });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  const head = w.record.head(r2.made);
  assert.deepEqual([head.type, head.currentState], ["inquiry", "surfaced"], "a question, opened by her promotion");
  assert.match(w.record.readFile(r2.made, "bundle.md").text, /surfaced_by: human/);
  const r3 = w.inv.planAccept({ proposal: c, form: "own_instead", text: "Visit the clerk's office", reason: "A call will not get the file.", by: ANN });
  assert.equal(r3.ok, true);
  const shown = w.inv.planProposals({ project: P1, viewer: ANN }).proposals.find((x) => x.proposal === c);
  assert.deepEqual([shown.status, shown.form, shown.reason, shown.decided_by], ["set_aside", "own_instead", "A call will not get the file.", "ann-h"]);
  assert.equal(w.steps.step({ step: r3.made, viewer: ANN }).work, "Visit the clerk's office");
});

test("R21: every act here has a path by hand that needs no AI; the assistant only proposes", () => {
  const w = world();
  /* no run holder is registered for either module: nothing below has AI behind it */
  const s = w.step();
  const iv = w.inv.interviewKeep({ project: P1, answers: ["What happened.", "", "", "", "", ""], by: ANN });
  const claim = w.inv.narrativeClaim({ project: P1, source: { interview: iv.interview, answer: 0 }, text: "What happened", by: ANN });
  const { milestone } = w.inv.milestoneSet({ project: P1, name: "M", date: "2026-11-14", waitsOn: [Q1, s], by: ANN });
  const acts = [
    () => w.inv.milestoneRevise({ milestone, name: "N", by: BOB }),
    () => w.inv.milestoneReminder({ milestone, at: "2026-11-10", by: BOB }),
    () => w.inv.milestoneItemRemove({ milestone, item: s, reason: "r", by: BOB }),
    () => w.inv.reportKeep({ project: P1, text: w.inv.reportDraft({ project: P1, viewer: ANN }).text, by: ANN }),
    () => w.inv.claimFindStep({ claim: claim.claim, by: ANN }),
    () => w.inv.claimFound({ claim: claim.claim, record: Q1, by: ANN }),
    () => w.inv.firsthandAccount({ words: "I was there.", observedAt: "2026-09-01", by: ANN }),
    () => w.inv.milestoneRemove({ milestone, reason: "r", by: ANN }),
  ];
  for (const a of acts) assert.equal(a().ok, true, a.toString());
  /* the assistant's acts only propose: with no run held they are refused, and a member's path covers each */
  assert.equal(w.inv.planPropose({ project: P1, kind: "step", text: "t", run: "RUN-1", by: AI }).code, "PLAN_NOT_YOUR_RUN");
  const c2 = w.inv.narrativeClaim({ project: P1, source: { own: true }, text: "x", by: ANN });
  assert.equal(w.inv.claimFindStep({ claim: c2.claim, run: "RUN-1", by: AI }).code, "PLAN_NOT_YOUR_RUN");
  assert.equal(w.inv.claimFindStep({ claim: c2.claim, by: ANN }).ok, true, "the member's own path");
  /* no act a machine may take writes a question, a step, a report, a milestone or an interview */
  for (const [name, args] of [["milestoneSet", { project: P1, name: "m", date: "2026-11-14", waitsOn: [Q1] }], ["reportKeep", { project: P1, text: "t" }],
                              ["interviewKeep", { project: P1, answers: ["a", "", "", "", "", ""] }], ["planAccept", { proposal: 1, form: "as_proposed" }],
                              ["claimFound", { claim: claim.claim, record: Q1 }]])
    assert.equal(w.inv[name]({ ...args, by: AI }).ok, false, name);
});

test("R23: planAccept refuses a planning proposal absent or unseen with NO_SUCH_PLANNING_PROPOSAL (C-146.21, its translation kept), never intent's NO_SUCH_PROPOSAL", () => {
  const w = world();
  w.runs();
  const a = w.inv.planPropose({ project: P1, kind: "step", text: "Ask the district for the newsletter", run: "RUN-1", by: AI }).proposal;
  const before = w.snapshot();
  const row = INVESTIGATION_CHECKS.NO_SUCH_PLANNING_PROPOSAL;
  assert.deepEqual([row.check, row.translation], ["C-146.21", word("refusal.NO_SUCH_PLANNING_PROPOSAL")]);
  assert.equal(INVESTIGATION_CHECKS.NO_SUCH_PROPOSAL, undefined, "intent's code is not minted here");
  const refusals = [
    w.inv.planAccept({ proposal: 999, form: "as_proposed", by: ANN }),          /* absent */
    w.inv.planAccept({ proposal: null, form: "as_proposed", by: ANN }),         /* named by nothing */
    w.inv.planAccept({ proposal: "x", form: "as_proposed", by: ANN }),          /* not a number */
    w.inv.planAccept({ proposal: a, form: "as_proposed", by: DAN }),            /* a project she does not see in full */
    w.inv.planAccept({ proposal: a, form: "as_proposed", by: CAT }),            /* another project's owner, not of P1 */
    w.inv.planAccept({ proposal: a, form: "as_proposed", by: null }),           /* no stamp: fails closed */
  ];
  for (const r of refusals) {
    assert.deepEqual([r.ok, r.code, r.reason, r.check, r.translation], [false, "NO_SUCH_PLANNING_PROPOSAL", "NO_SUCH_PLANNING_PROPOSAL", "C-146.21", row.translation], JSON.stringify(r));
    assert.notEqual(r.code, "NO_SUCH_PROPOSAL");
  }
  assert.equal(w.snapshot(), before, "nothing was written");
  /* the negative control: the same proposal, seen by a joined participant, is accepted, so the refusal is the condition's */
  assert.equal(w.inv.planAccept({ proposal: a, form: "as_proposed", by: BOB }).ok, true);
  /* and no answer of any act here carries intent's code */
  assert.equal(JSON.stringify([w.inv.planProposals({ project: P1, viewer: ANN }), ...refusals]).includes('"NO_SUCH_PROPOSAL"'), false);
});
