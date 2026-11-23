/* screens-action R1, R6, R38, R44, R45, R50, R51 (and R19, R27): what the Screens page "Deciding and acting" draws that the screens drew
   no part of before (ARCH's flaws of 22 Nov 2026): the plan's purpose, its explanations and its four folds; the action's fold of why a
   reply is not recorded; the matter's folds of why an act is not done. Over the scripted plane; every sentence by its key through
   `setup-words` (R19), none by its English. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, main, text, choose, ok, W, DATA_PLANE, ROUTES, PLAN, ESCALATION, DET, ESC, READER } from "./page.mjs";

const folds = (p) => [...main(p).querySelectorAll("details.mk-details")];
const foldOf = (p, key) => folds(p).find((d) => text(p, d.querySelector("summary")) === W(key));
const plain = (s) => String(s).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tips = (p) => [...p.root().querySelectorAll("[data-tip]")].map((e) => plain(e.getAttribute("data-tip")));
const tipped = (p, key, vars) => tips(p).some((t) => t.includes(W(key, vars)));
// a fold's sentences are each message's sentences said together, each by key
const says = (p, fold, keys) => keys.every((k) => text(p, fold).includes(W(k)));

test("R1 (the Screens page's purpose and explanations): the plan's heading explains the screen's purpose; the assumed matter, the legal deadline, the hostile-branch check, the scenario, its phase and its checkpoint each explain themselves by the design's words", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  const h1 = main(p).querySelector("h1");
  assert.ok(plain(h1.getAttribute("data-tip")).includes(W("screen.plan.purpose")), "the purpose");
  for (const k of ["screen.plan.tip.hypothetical", "screen.plan.tip.enddate", "screen.plan.tip.enddate_why", "screen.plan.tip.hostile", "screen.plan.tip.hostile_example",
    "screen.plan.tip.scenario", "screen.plan.tip.checkpoint"]) assert.ok(tipped(p, k), k);
  assert.ok(tipped(p, "screen.plan.tip.scenario_phase", { n: "1", step: PLAN.options[0].summary }), "the phase, by its place and its options");
  // control: the tips whose words hold the drawing's own sample facts are not drawn
  for (const k of ["screen.plan.tip.hypothetical_why", "screen.plan.tip.checkpoint_why"]) assert.ok(!tips(p).some((t) => t.includes(W(k).slice(0, 30))), k);
  // control: a plan with no hostile check, no dates and no assumed matter draws none of those three
  const q = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok({ ...PLAN, checks: [], subjects: PLAN.subjects.filter((s) => s.support !== "hypothetical"),
    options: PLAN.options.map((o) => ({ ...o, dates: [] })) }) });
  for (const k of ["screen.plan.tip.hypothetical", "screen.plan.tip.enddate", "screen.plan.tip.hostile"]) assert.ok(!tipped(q, k), k);
});

test("R1, R44 (the Screens page's folds): deciding the picked options sits under 'Decide the options you picked' with what a decision records; why an option is not added, a decision not recorded and a scenario not laid out are each said under its fold, every message with its second sentence", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  const decide = foldOf(p, "screen.plan.decide.the.options.you.picked");
  assert.ok(decide, "Decide the options you picked");
  assert.ok(says(p, decide, ["screen.plan.each.decision.is.recorded.with.who", "screen.plan.nothing.here.starts.an.action"]));
  assert.ok(decide.querySelector("#plan-rem-on"), "the reminder it may ask sits under it");
  const fold = {
    "screen.plan.when.an.option.is.not.added": ["an.option.needs.a.line.saying", "write.one.and.add.it.again", "choose.at.least.one.matter.the", "an.option.cannot.serve.a.matter",
      "a.tier.belongs.only.on.a", "change.the.kind.or.clear.the", "an.option.marked.as.lobbying.must", "choose.it.or.clear.the.mark", "a.date.needs.the.law.order",
      "fix.the.date.and.add.again", "an.option.can.be.directed.to", "change.who.it.is.for", "press.empty.role", "press.empty.organisation", "press.empty.both"],
    "screen.plan.when.a.decision.is.not.recorded": ["declining.an.option.or.marking.it", "reminders.are.set.only.when.you", "choose.it.or.leave.the.reminder",
      "a.reminder.names.a.date.the", "pick.one.of.its.dates.or", "pick.at.least.one.option", "an.option.that.is.not.in", "this.plan.is.closed.so.its", "ask.an.owner.to.reopen.it"],
    "screen.plan.when.a.scenario.is.not.laid": ["a.phase.can.hold.only.options", "choose.the.option.first.or.take", "following.when.each.phase.starts.leads",
      "no.phase.can.start.after.itself.2", "a.phase.points.to.a.phase", "choose.one.that.is.in.it", "a.phase.needs.a.name.the", "fill.in.the.one.that.is"],
  };
  for (const [summary, keys] of Object.entries(fold)) {
    const f = foldOf(p, summary);
    assert.ok(f, summary);
    assert.ok(says(p, f, keys.map((k) => "screen.plan." + k)), summary);
    assert.equal(f.querySelectorAll("p").length, summary.endsWith("added") ? 9 : summary.endsWith("recorded") ? 5 : 4, "one line for each message");
  }
  assert.ok(decide.contains(foldOf(p, "screen.plan.when.a.decision.is.not.recorded")), "why a decision is not recorded sits with the decision");
  // control: a closed plan offers no form, so none of the four folds
  const q = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok({ ...PLAN, state: "closed", closed: { reason: "done" } }) });
  for (const summary of ["screen.plan.decide.the.options.you.picked", ...Object.keys(fold)]) assert.ok(!foldOf(q, summary), summary);
});

test("R38 (the Screens page's form messages): under the reply form, 'When a reply is not recorded' says each of the ten reasons in its two sentences; control: a member who may not record a reply is shown no such fold (R27)", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  const f = foldOf(p, "screen.action.when.a.reply.is.not.recorded");
  assert.ok(f, "the fold");
  const pairs = [["the.day.is.not.a.real", "write.it.as.a.day.that"], ["a.reply.needs.either.the.document", "choose.one.and.record.again"],
    ["a.silence.has.no.document.or", "record.it.with.its.date.alone"], ["this.action.says.no.reply.is", "change.that.on.the.action.first"],
    ["that.kind.of.reply.does.not", "a.sending.is.a.request.a"], ["a.decision.needs.what.it.decided", "choose.what.the.office.decided.or"],
    ["a.fee.quote.needs.an.amount", "fix.the.quote.and.record.again"], ["the.date.the.office.gave.needs", "add.the.law.first.or.leave"],
    ["a.line.has.a.quotation.mark", "take.them.out.and.record.again"], ["another.member.is.recording.on.this", "wait.a.moment.and.try.again"]];
  const lines = [...f.querySelectorAll("p")].map((x) => text(p, x));
  assert.deepEqual(lines, pairs.map(([a, b]) => `${W("screen.action." + a)} ${W("screen.action." + b)}`));
  const r = await open(ROUTES.action, { ...DATA_PLANE, whoami: ok(READER) });
  assert.ok(!foldOf(r, "screen.action.when.a.reply.is.not.recorded"));
});

const AT = `/app/matter/${DET}~${ESC}`;
const STAGE = (n, o = {}) => ({ ...DATA_PLANE, escalation: ok({ ...ESCALATION, stage: n, ...o }) });
const MATTER_FOLDS = {
  determine: { when_it_cannot_be_recorded: ["it_needs_at_least_one_published_finding", "add_what_is_missing_then_record_it"],
    when_a_rule_does_not_bind_the: ["noncompliant_is_recorded_only_against_a_rule", "if_this_rule_does_not_bind_it"],
    when_a_rule_was_not_in_force: ["the_rule_was_not_in_force_when", "choose_the_rule_that_was_in_force"],
    when_you_choose_unclear: ["unclear_needs_at_least_one_question_that", "write_the_question_then_record_it_again"],
    when_the_cause_has_no_evidence: ["a_cause_is_recorded_only_when_evidence", "add_the_evidence_or_leave_the_cause"],
    when_it_says_how_serious_it_is: ["a_determination_says_what_was_required_what", "it_does_not_say_how_serious_the", "propose_an_action_for_that"],
    when_the_reason_is_missing: ["a_new_determination_that_replaces_an_earlier", "write_the_reason_then_record_it_again"],
    when_the_earlier_one_is_already_replaced: ["an_earlier_determination_is_replaced_only_once", "replace_the_newest_one_instead"] },
  consequencerecord: { when_a_part_cannot_be_recorded: ["a_consequence_is_what_a_breach_did", "choose_such_a_rule_or_record_the"],
    when_the_figure_cannot_be_worked_out: ["a_figure_is_worked_out_only_from", "name_the_figures_or_assess_it_yourself"],
    when_a_named_person_is_not_in: ["a_named_person_must_appear_in_a", "choose_the_passage_that_names_them_or"] },
  successrecord: { when_the_cause_is_only_your_own: ["evidence_that_your_team_s_own_letter", "add_evidence_from_elsewhere_or_leave_the"] },
  escalationattach: { when_it_cannot_be_attached: ["only_an_action_that_states_a_breach", "choose_such_an_action_or_move_the"],
    when_it_is_already_attached: ["that_action_is_already_attached_to_an"],
    when_the_office_is_the_wrong_kind: ["an_official_request_goes_to_an_elected", "choose_a_purpose_that_fits_the_office"] },
  escalationsuspend: { when_it_is_already_suspended: ["resume_it_before_suspending_it_again"] },
  escalationevaluate: { when_there_is_nothing_to_read: ["a_reading_other_than_no_response_names", "choose_the_reply_or_choose_no_response"],
    when_it_is_not_at_stage_4: ["a_response_is_read_at_stage_4"] },
};
const M = (k) => "screen.matter." + k;
const checkFolds = (p, set) => {
  for (const [summary, keys] of Object.entries(set)) {
    const f = foldOf(p, M(summary));
    assert.ok(f, summary);
    assert.deepEqual([...f.querySelectorAll("p")].map((x) => text(p, x)), keys.map((k) => W(M(k))), summary);
  }
};

test("R45, R50, R51 (the Screens page's form messages): each form of the matter says, under the design's folds 'When …', why its act is not done, each sentence by key; a sentence that needs a fact the form does not hold, or holds the drawing's sample, is not drawn", async () => {
  const p = await open(AT, STAGE(4));
  for (const [mode, set] of Object.entries(MATTER_FOLDS)) {
    await choose(p, "mt-mode", mode);
    checkFolds(p, set);
  }
  assert.ok(!text(p).includes(W(M("this_escalation_has_been_suspended_since_october"))), "control: the drawing's sample date is not said");
  const r = await open(AT, STAGE(2, { proposed: [{ to: 3 }] }));
  await choose(r, "mt-mode", "escalationdecline");
  checkFolds(r, { when_no_stage_is_proposed: ["there_is_nothing_to_hold_at"] });
  const s = await open(AT, { ...DATA_PLANE, escalation: ok({ ...ESCALATION, state: "suspended", proposed: [] }) });
  await choose(s, "mt-mode", "escalationresume");
  checkFolds(s, { when_it_is_not_suspended: ["this_escalation_is_open_not_suspended_so"] });
});

test("R6, R50 (the Screens page's C6): an open escalation says why it cannot be ended under the design's three folds; control: a member who may not act is shown none of them", async () => {
  const p = await open(AT, STAGE(2));
  checkFolds(p, { when_it_cannot_be_ended_compliance_is: ["an_escalation_ends_only_after_your_team", "record_it_then_end_the_escalation"],
    when_it_cannot_be_ended_the_consequences: ["if_your_team_judges_the_breach_had"], when_it_cannot_be_ended_the_consequences_2: ["say_with_evidence_that_each_part_was"] });
  const r = await open(AT, { ...STAGE(2), whoami: ok(READER) });
  assert.ok(!foldOf(r, M("when_it_cannot_be_ended_compliance_is")));
});
