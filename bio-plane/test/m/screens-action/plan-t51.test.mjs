/* screens-action T51 fix round, the `plan` screen: R44 (the plan's forms carry what the plane takes: who an option is directed to,
   its dates, tier, enforcement; a scenario's phases with their branches and order; an option marked done, blocked or returned to
   undecided, with a reason and a reminder) and R53 (an option or a phase with no name is named by its place; the Judge control
   only once the checkpoint is due; a judgement drawn as its words), and the registry's `writinghelp` on the plan's own-words
   fields. Behaviour at the interface only; every sentence is read by its key through `setup-words` (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, openIn, planIn, optionOn, refusalSentence } from "./world-D.mjs";
import { open, main, text, ops, press, last, ok, button, fill, choose, refusedIn, beside, W, D, hasWord, DATA_PLANE, ROUTES, PLAN, PLAN_ID, DET } from "./page.mjs";

const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
const withPlan = (o) => ({ ...DATA_PLANE, plan: ok({ ...PLAN, ...o }) });
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
const two = (a, b) => `${W(a)} ${W(b)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const optionsOf = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.getAttribute("value"));
const body = (p, op) => { const b = { ...last(p, op).body }; delete b.reason; return b; };

/* ---------- R44 (a): "Add an option" ---------- */

test("R44 (a): 'Add an option' sends the declared names only: with nothing more given it sends the line, kind and matter alone (no addressee, dates, tier, lobbying or enforces)", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  await press(p, "optionadd", { values: { "plan-opt-summary": "Ask the auditor", "plan-opt-category": "legal", "plan-opt-matter": `outcome:${DET}#STD-1` }, reason: "x" });
  assert.deepEqual(body(p, "optionadd"), { plan: PLAN_ID, summary: "Ask the auditor", category: "legal", subjects: [`outcome:${DET}#STD-1`] });
});

test("R44 (a): the addressee is sent as the plane's shape for each of the five choices, never a private individual; 'no one in particular' sends none", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  const base = { "plan-opt-summary": "Write to them", "plan-opt-category": "awareness", "plan-opt-matter": `outcome:${DET}#STD-1` };
  assert.deepEqual(optionsOf(p, "plan-opt-adk"), ["none", "office", "press", "organisation", "audience"]);
  const cases = [
    [{ "plan-opt-adk": "office", "plan-opt-arole": "City Clerk", "plan-opt-abody": "City of Oakland" }, { state: "named", kind: "office", role: "City Clerk", body: "City of Oakland" }],
    [{ "plan-opt-adk": "press", "plan-opt-arole": "Reporter", "plan-opt-abody": "The Daily" }, { state: "named", kind: "press", role: "Reporter", organisation: "The Daily" }],
    [{ "plan-opt-adk": "organisation", "plan-opt-arole": "Director", "plan-opt-abody": "Tenants Union" }, { state: "named", kind: "organisation", role: "Director", organisation: "Tenants Union" }],
    [{ "plan-opt-adk": "audience", "plan-opt-adesc": "Renters in the district" }, { state: "audience", description: "Renters in the district" }],
  ];
  for (const [values, addressee] of cases) {
    await press(p, "optionadd", { values: { ...base, ...values }, reason: "x" });
    assert.deepEqual(last(p, "optionadd").body.addressee, addressee, values["plan-opt-adk"]);
  }
  await press(p, "optionadd", { values: { ...base, "plan-opt-adk": "none" }, reason: "x" });
  assert.ok(!("addressee" in last(p, "optionadd").body), "no one in particular: no addressee");
});

test("R44 (a): the dates that bind an option each carry their basis; 'add another' (up to 20) adds a line; an empty line sends nothing", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  assert.ok(p.doc.getElementById("plan-opt-date-0") && !p.doc.getElementById("plan-opt-date-1"), "one line to begin with");
  assert.deepEqual(optionsOf(p, "plan-opt-datecount").length, 20, "up to twenty");
  await choose(p, "plan-opt-datecount", "3");
  for (const i of [0, 1, 2]) assert.ok(p.doc.getElementById(`plan-opt-date-${i}`) && p.doc.getElementById(`plan-opt-basis-${i}`), `line ${i + 1}`);
  assert.ok(!p.doc.getElementById("plan-opt-date-3"));
  fill(p, { "plan-opt-summary": "Public comment", "plan-opt-category": "legal", "plan-opt-matter": `outcome:${DET}#STD-1`,
    "plan-opt-date-0": "2026-10-30", "plan-opt-basis-0": "the notice of the draft", "plan-opt-date-2": "2026-11-15", "plan-opt-basis-2": "the council's order" });
  await choose(p, "plan-opt-datecount", "20");
  assert.ok(p.doc.getElementById("plan-opt-date-19") && !p.doc.getElementById("plan-opt-date-20"));
  assert.equal(p.doc.getElementById("plan-opt-basis-2").value, "the council's order", "what was typed stays");
  await press(p, "optionadd", { reason: "x" });
  assert.deepEqual(last(p, "optionadd").body.dates, [{ date: "2026-10-30", basis: "the notice of the draft" }, { date: "2026-11-15", basis: "the council's order" }]);
});

test("R44 (a): the tier is sent only when one is chosen ('not assessed yet' sends none); lobbying sends the mark and the requirement it seeks", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  assert.deepEqual(optionsOf(p, "plan-opt-tier"), ["", "1", "2", "3"]);
  const base = { "plan-opt-summary": "Comment", "plan-opt-category": "legal", "plan-opt-matter": `outcome:${DET}#STD-1` };
  await press(p, "optionadd", { values: { ...base, "plan-opt-tier": "" }, reason: "x" });
  assert.ok(!("tier" in last(p, "optionadd").body), "not assessed yet sends none");
  await press(p, "optionadd", { values: { ...base, "plan-opt-tier": "2" }, reason: "x" });
  assert.equal(last(p, "optionadd").body.tier, 2);
  assert.ok(!("lobbying" in last(p, "optionadd").body) && !("enforces" in last(p, "optionadd").body));
  assert.ok(optionsOf(p, "plan-opt-enforces").includes(`outcome:${DET}#STD-1`) && optionsOf(p, "plan-opt-enforces").includes("STD-2"), "the requirements it can seek: a matter of the plan, a standard");
  await press(p, "optionadd", { values: { ...base, "plan-opt-tier": "", "plan-opt-lobbying-0": true, "plan-opt-enforces": "STD-2" }, reason: "x" });
  assert.equal(last(p, "optionadd").body.lobbying, true);
  assert.equal(last(p, "optionadd").body.enforces, "STD-2");
  await press(p, "optionadd", { values: { ...base, "plan-opt-lobbying-0": false, "plan-opt-enforces": `outcome:${DET}#STD-1` }, reason: "x" });
  assert.ok(!("lobbying" in last(p, "optionadd").body), "unmarked: no lobbying");
  assert.equal(last(p, "optionadd").body.enforces, `outcome:${DET}#STD-1`);
});

test("R44 (a): each refusal of 'Add an option' is drawn by its two sentences, beside the act; control: an option the plane takes draws none", async () => {
  const codes = [
    ["OPTION_NO_SUMMARY", "screen.plan.an.option.needs.a.line.saying", "screen.plan.write.one.and.add.it.again"],
    ["OPTION_NO_SUBJECT", "screen.plan.choose.at.least.one.matter.the", "screen.plan.an.option.cannot.serve.a.matter"],
    ["TIER_REFUSED", "screen.plan.a.tier.belongs.only.on.a", "screen.plan.change.the.kind.or.clear.the"],
    ["LOBBYING_NO_REQUIREMENT", "screen.plan.an.option.marked.as.lobbying.must", "screen.plan.choose.it.or.clear.the.mark"],
    ["DATE_REFUSED", "screen.plan.a.date.needs.the.law.order", "screen.plan.fix.the.date.and.add.again"],
    ["ADDRESSEE_REFUSED", "screen.plan.an.option.can.be.directed.to", "screen.plan.change.who.it.is.for"],
  ];
  const values = { "plan-opt-summary": "Comment", "plan-opt-category": "legal", "plan-opt-matter": `outcome:${DET}#STD-1` };
  for (const [code, a, b] of codes) {
    const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: refusedIn(code, "the owner's own sentence") });
    const at = await press(p, "optionadd", { values, reason: "x" });
    assert.ok(beside(p, at).includes(two(a, b)), code);
    assert.ok(!beside(p, at).includes("the owner's own sentence"), code);
  }
  const fine = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  const b = await press(fine, "optionadd", { values, reason: "x" });
  for (const [, a] of codes) assert.ok(!beside(fine, b).includes(W(a)), a);
  // no line: nothing is sent, the line is asked for
  const none = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  const nb = await press(none, "optionadd", { values: { ...values, "plan-opt-summary": "" }, reason: "x" });
  assert.equal(none.byOp("optionadd").length, 0);
  assert.ok(beside(none, nb).includes(W("screen.plan.option.needed")));
});

/* ---------- R44 (b): a scenario's phases ---------- */

test("R44 (b): a scenario lays out more than one phase, each with its name, options, start, check-back days, test and where each judgement goes", async () => {
  const chosen = { ...PLAN, options: PLAN.options.map((o) => (o.id === "opt-2" ? { ...o, disposition: "chosen" } : o)) };
  const p = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok(chosen), scenarioset: ok({}) });
  await choose(p, "plan-scen-phasecount", "3");
  for (const k of ["", "-p2", "-p3"]) for (const f of ["pname", "start", "after", "days", "cond", "met", "not"]) assert.ok(p.doc.getElementById(`plan-scen-${f}${k}`), `${f}${k}`);
  assert.deepEqual(optionsOf(p, "plan-scen-start"), ["plan_start", "after", "met", "not_met"]);
  assert.deepEqual(optionsOf(p, "plan-scen-after-p2"), ["", "p1", "p3"], "any other phase, never itself");
  fill(p, { "plan-scen-name": "Records first", "plan-scen-pname": "Ask for the logs", "plan-scen-options-0": true, "plan-scen-days": "14",
    "plan-scen-cond": "The logs show inspection dates", "plan-scen-met": "p2", "plan-scen-not": "p3",
    "plan-scen-pname-p2": "Story", "plan-scen-options-p2-1": true, "plan-scen-start-p2": "met", "plan-scen-after-p2": "p1",
    "plan-scen-pname-p3": "Complaint", "plan-scen-options-p3-0": true, "plan-scen-start-p3": "not_met", "plan-scen-after-p3": "p1", "plan-scen-days-p3": "30" });
  await press(p, "scenarioset");
  assert.deepEqual(last(p, "scenarioset").body, { plan: PLAN_ID, scenario: 2, name: "Records first", phases: [
    { id: "p1", name: "Ask for the logs", options: ["opt-1"], starts: "plan_start", checkpoint: { after_days: 14 }, condition: "The logs show inspection dates", branches: { met: "p2", not_met: "p3" } },
    { id: "p2", name: "Story", options: ["opt-2"], starts: { branch_of: "p1", when: "met" } },
    { id: "p3", name: "Complaint", options: ["opt-1"], starts: { branch_of: "p1", when: "not_met" }, checkpoint: { after_days: 30 } }] });
  // after another phase; a phase without a name or without options sends nothing
  const q = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok(chosen), scenarioset: ok({}) });
  await choose(q, "plan-scen-phasecount", "2");
  fill(q, { "plan-scen-name": "Two", "plan-scen-pname": "One", "plan-scen-options-0": true, "plan-scen-pname-p2": "Then", "plan-scen-options-p2-1": true, "plan-scen-start-p2": "after", "plan-scen-after-p2": "p1" });
  await press(q, "scenarioset");
  assert.deepEqual(last(q, "scenarioset").body.phases[1].starts, { after: "p1" });
  const r = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok(chosen), scenarioset: ok({}) });
  await choose(r, "plan-scen-phasecount", "2");
  fill(r, { "plan-scen-name": "Two", "plan-scen-options-0": true, "plan-scen-pname-p2": "", "plan-scen-options-p2-1": true });
  const b = await press(r, "scenarioset");
  assert.equal(r.byOp("scenarioset").length, 0);
  assert.ok(beside(r, b).includes(W("screen.plan.scenario.needed")));
});

test("R44 (b): each refusal of a scenario is drawn by its two sentences, beside the act; control: a scenario the plane takes draws none", async () => {
  const codes = [
    ["PHASE_OPTION_NOT_CHOSEN", "screen.plan.a.phase.can.hold.only.options", "screen.plan.choose.the.option.first.or.take"],
    ["PHASE_CYCLE", "screen.plan.following.when.each.phase.starts.leads", "screen.plan.no.phase.can.start.after.itself.2"],
    ["BRANCH_UNKNOWN", "screen.plan.a.phase.points.to.a.phase", "screen.plan.choose.one.that.is.in.it"],
    ["PHASE_MALFORMED", "screen.plan.a.phase.needs.a.name.the", "screen.plan.fill.in.the.one.that.is"],
  ];
  const values = { "plan-scen-name": "Go public", "plan-scen-options-0": true };
  for (const [code, a, b] of codes) {
    const p = await open(ROUTES.plan, { ...DATA_PLANE, scenarioset: refusedIn(code, "the owner's own sentence") });
    const at = await press(p, "scenarioset", { values });
    assert.ok(beside(p, at).includes(two(a, b)), code);
    assert.ok(!beside(p, at).includes("the owner's own sentence"), code);
  }
  const fine = await open(ROUTES.plan, { ...DATA_PLANE, scenarioset: ok({}) });
  const b = await press(fine, "scenarioset", { values });
  for (const [, a] of codes) assert.ok(!beside(fine, b).includes(W(a)), a);
});

/* ---------- R44 (c): done, blocked, undecided, with a reason and a reminder ---------- */

const DATED = { ...PLAN, options: [
  { id: "opt-1", summary: "Public comment", category: "legal", subjects: [`outcome:${DET}#STD-1`], dates: [{ date: "2026-11-30", basis: "law" }], disposition: "open", dispositions: [], action: null },
  { id: "opt-2", summary: "Story with a reporter", category: "awareness", subjects: [`outcome:${DET}#STD-1`], dates: [], disposition: "blocked", dispositions: [{ disposition: "blocked", reason: "no signatures" }], action: null }] };
const labelOf = { done: "screen.plan.dispose.done", blocked: "screen.plan.dispose.blocked", open: "screen.plan.dispose.open", chosen: "screen.plan.choose", declined: "screen.plan.decline" };
const markBtn = (p, option, disposition) => main(p).querySelectorAll('button[data-act="optiondispose"]').find((b) => b.dataset.option === option && b.dataset.disposition === disposition);

test("R44 (c): an option can be marked done or blocked, or returned to undecided, each sending its reason; never the mark it already has", async () => {
  const p = await open(ROUTES.plan, { ...withPlan(DATED), optiondispose: ok({}) });
  for (const d of ["chosen", "declined", "done", "blocked"]) assert.ok(markBtn(p, "opt-1", d), `an undecided option can be marked ${d}`);
  assert.equal(markBtn(p, "opt-1", "open"), undefined, "undecided already: no return to undecided");
  assert.equal(markBtn(p, "opt-2", "blocked"), undefined, "blocked already: no mark blocked");
  assert.ok(markBtn(p, "opt-2", "open"), "a blocked option can be returned to undecided");
  for (const d of ["done", "blocked"]) assert.ok(markBtn(p, "opt-1", d).textContent.replace(/\s+/g, " ").trim().startsWith(W(labelOf[d])), d);
  for (const [option, d, reason] of [["opt-1", "done", "filed October 9"], ["opt-1", "blocked", "we need 200 signatures first"], ["opt-2", "open", "the signatures came"]]) {
    await press(p, markBtn(p, option, d), { reason });
    assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: [option], disposition: d, reason }, `${option} ${d}`);
  }
  // the picked rows, together
  await p.click(p.doc.getElementById("pick-options-opt-1"));
  await p.click(p.doc.getElementById("pick-options-opt-2"));
  const hold = main(p).querySelector(".cs-hold").querySelectorAll('button[data-act="optiondispose"]');
  assert.deepEqual(hold.map((b) => b.dataset.disposition).sort(), ["blocked", "chosen", "declined", "done", "open"]);
  await press(p, hold.find((b) => b.dataset.disposition === "done"), { reason: "both done" });
  assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: ["opt-1", "opt-2"], disposition: "done", reason: "both done" });
});

test("R44 (c): a reminder (which date of the option, on what day) goes with the choice; none asked sends none; control: no dates, no reminder control", async () => {
  const p = await open(ROUTES.plan, { ...withPlan(DATED), optiondispose: ok({}) });
  const dates = optionsOf(p, "plan-rem-date");
  assert.deepEqual(dates, ["", "opt-1|2026-11-30"]);
  assert.ok(p.doc.getElementById("plan-rem-on"));
  await press(p, markBtn(p, "opt-1", "chosen"), { reason: "worth it" });
  assert.ok(!("reminders" in last(p, "optiondispose").body), "none asked");
  await press(p, markBtn(p, "opt-1", "chosen"), { values: { "plan-rem-date": "opt-1|2026-11-30", "plan-rem-on": "2026-11-27" }, reason: "worth it" });
  assert.deepEqual(last(p, "optiondispose").body.reminders, [{ option: "opt-1", date: "2026-11-30", on: "2026-11-27" }]);
  const undated = await open(ROUTES.plan, withPlan({ options: DATED.options.map((o) => ({ ...o, dates: [] })) }));
  assert.equal(undated.doc.getElementById("plan-rem-date"), null);
  assert.equal(undated.doc.getElementById("plan-rem-on"), null);
});

test("R44 (c): each refusal of a decision is drawn by its words beside the act: no reason, a reminder that is not for a choice or names no date of the option, no such option, a closed plan", async () => {
  /* every refusal is the real owner's, made by a real state: a reason with a quotation mark (`refuseReason`), a reminder with a declining, a reminder
     naming a day the option does not have, an option the plan does not hold (the button names another), a plan closed after the page drew */
  const { world, me, project } = await actionWorld();
  const plan = await planIn(world, me, project, "Repairs: closed is not repaired");
  const inquiry = plan.subjects[0].inquiry;
  const opt = await optionOn(me, plan.id, inquiry);
  const date = "2026-11-30";
  const cases = [
    ["PLAN_NO_REASON", { reason: 'a "quoted" reason' }, null, [W("screen.plan.declining.an.option.or.marking.it")]],
    ["REMINDER_REFUSED", { reason: "x", values: { "plan-rem-date": `${opt}|${date}`, "plan-rem-on": "2026-11-27" } }, null, [two("screen.plan.reminders.are.set.only.when.you", "screen.plan.choose.it.or.leave.the.reminder")]],
    ["REMINDER_REFUSED", { reason: "x", values: { "plan-rem-date": `${opt}|2026-12-31`, "plan-rem-on": "2026-11-27" } }, "chosen", [two("screen.plan.a.reminder.names.a.date.the", "screen.plan.pick.one.of.its.dates.or")]],
    ["NO_SUCH_OPTION", { reason: "x" }, "gone", [two("screen.plan.pick.at.least.one.option", "screen.plan.an.option.that.is.not.in")]],
    ["PLAN_CLOSED", { reason: "x" }, "closed", [two("screen.plan.this.plan.is.closed.so.its", "screen.plan.ask.an.owner.to.reopen.it")]],
  ];
  for (const [code, how, variant, drawn] of cases) {
    const w = code === "PLAN_CLOSED" ? (await actionWorld()) : { world, me, project };
    let target = plan.id, option = opt;
    if (code === "PLAN_CLOSED") {
      target = (await planIn(w.world, w.me, w.project, "Repairs: closed is not repaired")).id;
      option = await optionOn(w.me, target, (await w.me.read("plan", { query: { id: target } })).subjects[0].subject.inquiry);
    }
    const p = await openIn(w.world, w.me, `/app/plan/${target}`);
    const button = markBtn(p, option, variant === "chosen" ? "chosen" : "declined");
    if (variant === "gone") button.dataset.option = "opt-gone";
    if (variant === "closed") await w.me.act("planclose", { query: { id: target }, body: { reason: "it is done" } });
    const at = await press(p, button, how);
    for (const d of drawn) assert.ok(beside(p, at).includes(d), `${code} ${variant}`);
    const owner = await refusalSentence(w.me, "optiondispose", last(p, "optiondispose").body);
    assert.ok(owner.length > 0, `the owner has a sentence of its own for ${code}`);
    assert.ok(!beside(p, at).includes(owner), code);
  }
  // control: a decision the store takes draws none of these
  const fine = await openIn(world, me, `/app/plan/${plan.id}`);
  const b = await press(fine, markBtn(fine, opt, "done"), { reason: "x" });
  for (const k of ["screen.plan.declining.an.option.or.marking.it", "screen.plan.pick.at.least.one.option", "screen.plan.this.plan.is.closed.so.its"]) assert.ok(!beside(fine, b).includes(W(k)), k);
});

/* ---------- R53: names by place, Judge only when due, a judgement in words ---------- */

const UNNAMED = { ...PLAN, options: [
  { id: "opt-zzz", summary: "", category: "other", subjects: [`outcome:${DET}#STD-1`], dates: [], disposition: "chosen", dispositions: [], action: null },
  { id: "opt-named", summary: "Story with a reporter", category: "awareness", subjects: [`outcome:${DET}#STD-1`], dates: [], disposition: "chosen", dispositions: [], action: null },
  { id: "opt-yyy", summary: "", category: "other", subjects: [`outcome:${DET}#STD-1`], dates: [], disposition: "open", dispositions: [], action: { id: "ACTN-2026-bbbbbbbbbbbbbbbb", state: "planned" } }],
  scenarios: [{ scenario: 1, version: 1, name: "Records first", set_aside: null, phases: [
    { id: "ph-secret", name: "", options: ["opt-zzz"], starts: "plan_start", checkpoint: { after_days: 10 }, checkpoint_due: TODAY, judgement: null },
    { id: "ph-other", name: "Phase two", options: ["opt-named", "opt-yyy"], starts: "plan_start", judgement: null }] }] };

test("R53: an option with no summary is named by its place in the list, a phase with no name by its place in its scenario, never by an id, wherever it is drawn", async () => {
  const p = await open(ROUTES.plan, withPlan(UNNAMED));
  const t = text(p);
  assert.ok(hasWord("screen.plan.option.unnamed") && hasWord("screen.plan.phase.unnamed"));
  said(p, "screen.plan.option.unnamed", { n: "1" });
  said(p, "screen.plan.option.unnamed", { n: "3" });
  unsaid(p, "screen.plan.option.unnamed", { n: "2" });
  said(p, "screen.plan.phase.unnamed", { n: "1" });
  assert.ok(t.includes("Phase two"), "a named phase keeps its name");
  for (const id of ["opt-zzz", "opt-yyy", "ph-secret", "ph-other"]) assert.ok(!t.includes(id), `no ${id}`);
  // the scenario's checkbox, the phase's option list and the started section name them too
  const boxes = p.doc.getElementById("plan-scen-options").textContent.replace(/\s+/g, " ");
  assert.ok(boxes.includes(W("screen.plan.option.unnamed", { n: "1" })) && boxes.includes("Story with a reporter"));
  const startedRow = main(p).querySelectorAll('a[href^="/app/action/"]').map((a) => a.textContent.trim());
  assert.ok(startedRow.includes(W("screen.plan.option.unnamed", { n: "3" })), "what a started option became");
  const html = main(p).innerHTML;
  for (const id of ["opt-zzz", "opt-yyy"]) assert.ok(!html.replace(/value="[^"]*"|data-[a-z-]+="[^"]*"|id="[^"]*"/g, "").includes(id), `${id} appears only as a value`);
  // control: a named option and phase are drawn by their names, not by a place
  const named = await open(ROUTES.plan, DATA_PLANE);
  unsaid(named, "screen.plan.option.unnamed", { n: "1" });
  assert.ok(text(named).includes("Records request: inspection logs"));
  const phase = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], name: "Ask for the logs" }] }] }));
  assert.ok(text(phase).includes("Ask for the logs"));
  unsaid(phase, "screen.plan.phase.unnamed", { n: "1" });
});

test("R53: the Judge control is drawn only once the checkpoint is due, by the page's clock; before, the day it can be judged; control: due today or earlier draws Judge", async () => {
  for (const [due, isDue] of [[inDays(3), false], [inDays(1), false], [TODAY, true], [inDays(-1), true], [inDays(-40), true]]) {
    const p = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], checkpoint_due: due }] }] }));
    assert.equal(ops(p).includes("checkpointrecord"), isDue, `due ${due}`);
    assert.equal(!!p.doc.getElementById("plan-judge-1-p1"), isDue, `due ${due}: the outcome choice`);
    if (isDue) unsaid(p, "screen.plan.judge.notdue", { date: D(due) });
    else said(p, "screen.plan.judge.notdue", { date: D(due) });
  }
  assert.ok(hasWord("screen.plan.judge.notdue"));
  // a judged checkpoint and a plan with no checkpoint draw neither
  const judged = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], checkpoint_due: inDays(5), judgement: { judged: "met", note: "n" } }] }] }));
  assert.ok(!ops(judged).includes("checkpointrecord"));
  unsaid(judged, "screen.plan.judge.notdue", { date: D(inDays(5)) });
  // the page's clock decides: the same plan, drawn again after the due day, draws Judge
  const later = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], checkpoint_due: inDays(1) }] }] }));
  assert.ok(!ops(later).includes("checkpointrecord"));
  await later.clock.tickActive(2 * 86400000);
  await choose(later, "plan-opt-datecount", "2");
  assert.ok(ops(later).includes("checkpointrecord"), "two days on, by the page clock");
});

test("R53: a judgement is drawn as the words 'met' and 'not met', never the raw value: the judged phase, the control's choices and the check that a judgement leads nowhere", async () => {
  const unbranched = (outcomes) => ({ check: "unbranched", scenario: 1, phase: "p1", outcomes, says: `phase p1's checkpoint leads nowhere when judged ${outcomes.join(" or ")}` });
  for (const [outcomes, wanted, unwanted] of [[["met", "not_met"], ["met", "not_met"], []], [["not_met"], ["not_met"], ["met"]], [["met"], ["met"], ["not_met"]]]) {
    const p = await open(ROUTES.plan, withPlan({ checks: [unbranched(outcomes)] }));
    const t = text(p);
    for (const m of wanted) assert.ok(t.includes(W("action-plans.says.phase_checkpoint_leads", { id: "Phase 1", miss: W(`screen.plan.judged.${m}`) })), `${outcomes}: ${m} by its word`);
    for (const m of unwanted) assert.ok(!t.includes(W("action-plans.says.phase_checkpoint_leads", { id: "Phase 1", miss: W(`screen.plan.judged.${m}`) })), `${outcomes}: not ${m}`);
    assert.ok(!t.includes("not_met") && !t.includes("met or"), `${outcomes}: no raw value`);
    said(p, "screen.plan.checks", { n: "1" });
  }
  const unnamed = await open(ROUTES.plan, withPlan({ checks: [unbranched(["not_met"])], scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], name: "" }] }] }));
  assert.ok(text(unnamed).includes(W("action-plans.says.phase_checkpoint_leads", { id: W("screen.plan.phase.unnamed", { n: "1" }), miss: W("screen.plan.judged.not_met") })), "an unnamed phase, by its place");
  assert.ok(!text(unnamed).includes("p1"));
  // the judge control offers both words; a recorded judgement is drawn by its word
  const p = await open(ROUTES.plan, DATA_PLANE);
  assert.deepEqual(p.doc.getElementById("plan-judge-1-p1").querySelectorAll("option").map((o) => o.textContent.trim()), [W("screen.plan.judged.met"), W("screen.plan.judged.not_met")]);
  const done = await open(ROUTES.plan, withPlan({ scenarios: [{ ...PLAN.scenarios[0], phases: [{ ...PLAN.scenarios[0].phases[0], judgement: { judged: "not_met", note: "late" } }] }] }));
  said(done, "screen.plan.judged.not_met");
  assert.ok(!text(done).includes("not_met"));
  // control: a check the screen has no words for of its own is drawn as the plane says it
  const other = await open(ROUTES.plan, withPlan({ checks: [{ check: "date_past", option: "opt-1", says: "a plain sentence from the plane" }] }));
  assert.ok(text(other).includes("a plain sentence from the plane"));
});

/* ---------- registry: writinghelp on the own-words fields ---------- */

test("R44 (registry): the assistant's help with words is drawn on the option's line and detail and the close note only while the assistant is reachable; control: unreachable draws none", async () => {
  const on = await open(ROUTES.plan, { ...DATA_PLANE, ...REACH, writinghelp: ok({ text: "A worded line" }), optionadd: ok({}) });
  const helps = main(on).querySelectorAll('button[data-act="writinghelp"]');
  assert.deepEqual(helps.map((b) => [b.dataset.field, b.dataset.id, b.dataset.forop]),
    [["summary", "plan-opt-summary", "optionadd"], ["detail", "plan-opt-detail", "optionadd"], ["note", "plan-close-note", "planclose"]]);
  assert.ok(helps[0].textContent.replace(/\s+/g, " ").trim().startsWith(W("act.writinghelp.label.plan")));
  for (const id of ["plan-opt-summary", "plan-opt-detail", "plan-close-note"]) assert.ok(/\brec\b/.test(on.doc.getElementById(id).getAttribute("class")), `${id} is an own-words field`);
  fill(on, { "plan-opt-summary": "ask the clerk" });
  await press(on, helps[0], { reason: "ask the clerk" });
  assert.equal(on.byOp("writinghelp").length, 1);
  assert.equal(last(on, "writinghelp").body.field, "summary");
  assert.equal(last(on, "writinghelp").body.told, "ask the clerk");
  const off = await open(ROUTES.plan, { ...DATA_PLANE, writinghelp: ok({}) });
  assert.ok(!ops(off).includes("writinghelp"));
  // a closed plan has no field to help with
  const closed = await open(ROUTES.plan, { ...DATA_PLANE, ...REACH, plan: ok({ ...PLAN, state: "closed", closed: { reason: "done", by: "member:dev", at: "x" } }) });
  assert.ok(!ops(closed).includes("writinghelp"));
  assert.ok(button(on, "optionadd") && hasWord("act.writinghelp.label.plan"));
});

/* ---------- R44 (DEC-387, B424): the forms' own rows ---------- */

const texts = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.textContent.trim());

test("R44 (DEC-387): 'Add an option' reads the design's rows: the kinds, who it is directed to, the role and the date, the tier, seeking enforcement and its 'None'; control: the case list is not the table's", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok({}) });
  assert.deepEqual(texts(p, "plan-opt-category"), ["mitigation", "legal", "awareness", "journalistic", "grassroots", "other"].map((c) => W("screen.plan.option.kind." + c)));
  assert.equal(texts(p, "plan-opt-adk")[2], W("screen.plan.option.directed.press"), "the press");
  assert.deepEqual(texts(p, "plan-opt-tier"), [W("screen.plan.option.tier.none"), W("screen.plan.option.tier.1"), W("screen.plan.option.tier.2"), W("screen.plan.option.tier.3")]);
  assert.equal(texts(p, "plan-opt-enforces")[0], W("screen.plan.option.enforce.none"));
  for (const id of ["plan-opt-arole", "plan-opt-date-0", "plan-opt-lobbying-0"]) assert.ok(p.doc.getElementById(id), id);
  const labelOf = (id) => p.doc.getElementById(id).parentNode.querySelector("label, legend");
  assert.equal(p.doc.getElementById("plan-opt-arole").parentNode.querySelector("label").textContent.trim(), W("screen.plan.option.role"));
  assert.equal(p.doc.getElementById("plan-opt-date-0").parentNode.querySelector("label").textContent.trim(), W("screen.plan.option.date"));
  assert.ok(labelOf("plan-opt-tier"));
  said(p, "screen.plan.option.enforce");
  said(p, "screen.plan.add.another.date");
  said(p, "screen.plan.add.another.phase");
});

test("R44 (DEC-387): deciding the options reads the design's rows: marking done and blocked and returning to undecided on a row; 'Choose them', 'Decline them' and 'Mark them blocked' on the picked ones; the reminder's 'Which date'", async () => {
  const p = await open(ROUTES.plan, { ...withPlan(DATED), optiondispose: ok({}) });
  const row = (d) => markBtn(p, "opt-1", d);
  assert.ok(row("done").textContent.includes(W("screen.plan.dispose.done")) && row("blocked").textContent.includes(W("screen.plan.dispose.blocked")));
  assert.ok(markBtn(p, "opt-2", "open").textContent.includes(W("screen.plan.dispose.open")));
  await p.click(p.doc.getElementById("pick-options-opt-1"));
  await p.click(p.doc.getElementById("pick-options-opt-2"));
  const hold = main(p).querySelector(".cs-hold").querySelectorAll('button[data-act="optiondispose"]');
  const by = (d) => hold.find((b) => b.dataset.disposition === d).textContent;
  assert.ok(by("chosen").includes(W("screen.plan.dispose.them.choose")) && by("declined").includes(W("screen.plan.dispose.them.decline")) && by("blocked").includes(W("screen.plan.dispose.them.blocked")));
  assert.ok(by("done").includes(W("screen.plan.dispose.done")) && by("open").includes(W("screen.plan.dispose.open")));
  assert.equal(p.doc.getElementById("plan-rem-date").parentNode.querySelector("label").textContent.trim(), W("screen.plan.dispose.date"));
});

test("R44 (DEC-387): a scenario's phase reads the design's rows: 'A phase', its options, when it starts, which phase and 'No phase' for where each judgement goes", async () => {
  const p = await open(ROUTES.plan, withPlan({ options: DATED.options.map((o, i) => ({ ...o, disposition: "chosen" })) }));
  said(p, "screen.plan.phase.head");
  const labelOf = (id) => p.doc.getElementById(id).parentNode.querySelector("label, legend").textContent.trim();
  assert.equal(labelOf("plan-scen-start"), W("screen.plan.phase.when"));
  assert.equal(labelOf("plan-scen-after"), W("screen.plan.phase.which"));
  assert.ok(texts(p, "plan-scen-start").includes(W("screen.plan.phase.when.after")), "'After another phase'");
  assert.ok(text(p).includes(W("screen.plan.phase.options")), "its options");
  assert.equal(texts(p, "plan-scen-met")[0], W("screen.plan.phase.none"));
  assert.equal(texts(p, "plan-scen-not")[0], W("screen.plan.phase.none"));
  said(p, "screen.plan.each.phase.starts.after.something.else");
  said(p, "screen.plan.no.phase.can.start.after.itself");
});

/* ---------- C53: "Remind me" on a chosen option, and the reminder the record holds ---------- */

const CHOSEN = (reminders, dates = [{ date: "2026-11-30", basis: "law" }]) => withPlan({ options: [
  { id: "opt-1", summary: "Public comment", category: "legal", subjects: [`outcome:${DET}#STD-1`], dates, disposition: "chosen", dispositions: [], reminders, action: null },
  { id: "opt-2", summary: "Story with a reporter", category: "awareness", subjects: [`outcome:${DET}#STD-1`], dates: [{ date: "2026-12-15", basis: "law" }], disposition: "open", dispositions: [], reminders: null, action: null }] });
const remindBtn = (p, option) => main(p).querySelectorAll('button[data-act="optiondispose"]').find((b) => b.dataset.option === option && b.dataset.remind);

test("R1, R44 (c) (C53): a chosen option with dates draws the Set-reminder act and the day it holds, read from the record; the act sends the choice with the reminder; control: an option with none draws the act only", async () => {
  // a chosen option that holds no reminder draws the act and no reminder sentence
  const bare = await open(ROUTES.plan, { ...CHOSEN([]), optiondispose: ok({}) });
  assert.ok(remindBtn(bare, "opt-1"), "a chosen, dated option draws the act");
  assert.ok(remindBtn(bare, "opt-1").textContent.replace(/\s+/g, " ").trim().startsWith(W("act.reminderset.label.action")));
  assert.equal(remindBtn(bare, "opt-2"), undefined, "an undecided option draws no such act: it is set while choosing");
  unsaid(bare, "screen.reminder.on", { date: D("2026-11-25") });
  // a held reminder is drawn by its day, after a reload as before
  const held = [{ date: "2026-11-30", on: "2026-11-25" }];
  const p = await open(ROUTES.plan, { ...CHOSEN(held), optiondispose: ok({}) });
  said(p, "screen.reminder.on", { date: D("2026-11-25") });
  assert.ok(remindBtn(p, "opt-1"), "and the act stays, to add another");
  // the act keeps the choice and carries the held reminders with the new one
  await press(p, remindBtn(p, "opt-1"), { values: { "plan-rem-date": "opt-1|2026-11-30", "plan-rem-on": "2026-11-28" }, reason: "worth it" });
  assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: ["opt-1"], disposition: "chosen", reason: "worth it",
    reminders: [{ option: "opt-1", date: "2026-11-30", on: "2026-11-25" }, { option: "opt-1", date: "2026-11-30", on: "2026-11-28" }] });
  // an option with one date needs no date chosen; no day asks for the day first and sends nothing
  const q = await open(ROUTES.plan, { ...CHOSEN([]), optiondispose: ok({}) });
  await press(q, remindBtn(q, "opt-1"), { values: { "plan-rem-on": "" }, reason: "x" });
  assert.equal(q.byOp("optiondispose").length, 0);
  said(q, "screen.action.remindon.needed");
  await press(q, remindBtn(q, "opt-1"), { values: { "plan-rem-on": "2026-11-27" }, reason: "x" });
  assert.deepEqual(last(q, "optiondispose").body.reminders, [{ option: "opt-1", date: "2026-11-30", on: "2026-11-27" }]);
  // control: a chosen option with no dates, a started one and a closed plan draw no such act
  const undated = await open(ROUTES.plan, CHOSEN([], []));
  assert.equal(remindBtn(undated, "opt-1"), undefined);
  const closed = await open(ROUTES.plan, withPlan({ ...CHOSEN([]).plan.json.result, state: "closed" }));
  assert.equal(remindBtn(closed, "opt-1"), undefined);
});
