/* screens-plan's T53 marks on `plan`: R9 (each option row says where it goes and its tier; "Assumed: not shown yet" explained) and R10
   (a checkpoint draws its test and where each judgement leads). Drawn by key through `setup-words` over the plan screen's fixtures;
   R8 waits on a provider (see docs/requirements-notes/screens-plan.md). */
import test from "node:test";
import assert from "node:assert/strict";
import { open, main, text, ok, W, D, DATA_PLANE, ROUTES, PLAN } from "../screens-action/page.mjs";

const withPlan = (o) => ({ ...DATA_PLANE, plan: ok({ ...PLAN, ...o }) });
const rowOf = (p, summary) => main(p).querySelectorAll("tr, .cs-row, li").find((r) => r.textContent.includes(summary) && r.textContent.length < 2000);

test("R9: an option with an office and a tier draws both; control: an option with none draws 'no office chosen'", async () => {
  const options = [
    { ...PLAN.options[1], id: "opt-o", summary: "Complaint to the City Clerk", category: "legal", tier: 2,
      addressee: { state: "named", kind: "office", role: "City Clerk", body: "City of Oakland" } },
    { ...PLAN.options[1], id: "opt-n", summary: "Talk to neighbours", category: "grassroots" },
  ];
  const p = await open(ROUTES.plan, withPlan({ options }));
  const o = text(p, rowOf(p, "Complaint to the City Clerk"));
  assert.ok(o.includes(W("screen.plan.option.goes", { office: "City Clerk, City of Oakland", tier: W("screen.plan.option.tier.2") })), o);
  const n = text(p, rowOf(p, "Talk to neighbours"));
  assert.ok(n.includes(W("screen.plan.option.goes", { office: W("screen.plan.option.nooffice"), tier: W("screen.plan.option.tier.none") })), n);
});

test("R9: 'Assumed: not shown yet' is explained in a sentence; control: an established matter draws no such sentence", async () => {
  const p = await open(ROUTES.plan, withPlan({}));
  assert.ok(text(p).includes(W("screen.plan.support.hypothetical")));
  assert.ok(text(p).includes(W("screen.plan.support.hypothetical.means")));
  const q = await open(ROUTES.plan, withPlan({ subjects: PLAN.subjects.map((s) => ({ ...s, support: "established" })) }));
  assert.ok(!text(q).includes(W("screen.plan.support.hypothetical.means")));
});

test("R10: a checkpoint 'Did the officer answer by the date?' draws its test, both branches and its judge day; control: a checkpoint with no branches draws 'no next step set'", async () => {
  const opt = PLAN.options[0].id;
  const phases = [
    { id: "p1", name: "Ask", options: [opt], starts: "plan_start", checkpoint: { after_days: 10 }, checkpoint_due: "2026-10-20",
      condition: "Did the officer answer by the date?", branches: { met: "p2", not_met: "p3" }, judgement: null },
    { id: "p2", name: "Read the reply", options: [opt], starts: { branch_of: "p1", when: "met" }, checkpoint: null, judgement: null },
    { id: "p3", name: "Appeal", options: [opt], starts: { branch_of: "p1", when: "not_met" }, checkpoint: { after_days: 5 }, checkpoint_due: "2026-10-30", judgement: null },
  ];
  const p = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases }] }));
  const t = text(p);
  assert.ok(t.includes(W("screen.plan.checkpoint.tests", { test: "Did the officer answer by the date?" })), "its test");
  assert.ok(t.includes(W("screen.plan.checkpoint.leads.met", { phase: "Read the reply" })), "where met leads");
  assert.ok(t.includes(W("screen.plan.checkpoint.leads.not_met", { phase: "Appeal" })), "where not met leads");
  assert.ok(t.includes(D("2026-10-20")), "its judge day");
  assert.ok(t.includes(W("screen.plan.checkpoint.nonext")), "the third phase's checkpoint leads nowhere");
  const q = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...phases[0], branches: null, condition: null }] }] }));
  assert.ok(text(q).includes(W("screen.plan.checkpoint.nonext")), "control: no branches");
  assert.ok(!text(q).includes(W("screen.plan.checkpoint.leads.met", { phase: "Read the reply" })));
});

test.todo("R8: a taken item stays taken: after 'Take this up' a reload shows it taken (by whom, her target date); control: another member still sees it open — waits on a read of take-ups (plan-work R11's takeUpsFor is no op)");
