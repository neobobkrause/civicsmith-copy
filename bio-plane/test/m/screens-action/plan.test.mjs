/* screens-action R1 (and R7's rules on `plan`): the action plan, its reads and its ten acts, at the module's interface:
   the served page over a scripted plane, every act through the shell's friction and gate. R13, R15 and R18: the ask, its
   help, its run and refusals, the plan's titles, its picked references and its categories. Every sentence is asserted by
   its key through `setup-words` (R19): no test here holds a sentence's English. */
import test from "node:test";
import { storeSilentParsed } from "../answer-envelope/fixtures.mjs";
import assert from "node:assert/strict";
import { actionWorld, openIn, planOn, untitledQuestion } from "./world-D.mjs";
import { open, main, text, ops, press, last, ok, button, fill, refusedIn, beside, W, D, PAGE, hasWord, DATA_PLANE, ROUTES, PLAN, PLAN_ID, PROPOSALS, ESC, DET, PROJECT,
  QUESTION, QUESTION_TITLE, PROJECT_QUESTIONS, DETERMINATIONS } from "./page.mjs";

const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
// each row's name, without the row's own panel control the kit may draw beside it (interface-shell R27)
const rowsOrder = (p) => main(p).querySelectorAll("table.cs-rows tbody tr.cs-r").map((tr) => {
  const td = tr.querySelectorAll("td")[1];
  const bare = td.querySelectorAll("button").reduce((t, b) => t.replace(b.textContent, ""), td.textContent).trim();
  return bare || td.textContent.trim(); // the T46 kit draws the name inside the panel's control
});
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);

test("R1: reads the plan: its matters (with support and escalation stage), options, scenarios, what each started option became, and the checks strip", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  assert.deepEqual(p.byOp("plan").map((r) => r.query.id), [PLAN_ID]);
  assert.ok(text(p).includes("Repairs: closed is not repaired"));
  said(p, "screen.plan.checks", { n: "1" });
  assert.ok(text(p).includes("Scenario 1: no branch answers a hostile response"));
  said(p, "screen.plan.matter.n", { n: "1" });
  said(p, "screen.plan.support.hypothetical");
  said(p, "screen.plan.escalation", { stage: W("screen.matter.stage.2") });
  assert.ok(main(p).querySelector(`a[href="/app/matter/${encodeURIComponent(DET + "~" + ESC)}"]`), "an outcome matter opens its matter screen");
  assert.ok(text(p).includes("Records request: inspection logs"));
  assert.ok(text(p).includes("Records first"));
  assert.ok(main(p).querySelector('a[href^="/app/action/ACTN-"]'), "a started option links its action");
  said(p, "screen.plan.actionstate.awaiting_response");
});

test("R1, R19: the plan's opening is drawn with its date and who opened it, and no placeholder ever is", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  said(p, "screen.plan.opened", { date: D("2026-10-03"), name: "dev" });
  assert.doesNotMatch(text(p), /\{\w+\}/);
});

test("R1: the assistant's suggestions are read and drawn only while it is reachable, labelled machine work not yet in the plan; control: unreachable reads none and draws no ask", async () => {
  const off = await open(ROUTES.plan, DATA_PLANE);
  assert.equal(off.byOp("planproposals").length, 0);
  assert.ok(!ops(off).includes("planask"));
  unsaid(off, "screen.plan.suggested");
  const on = await open(ROUTES.plan, { ...DATA_PLANE, ...REACH });
  assert.equal(on.byOp("planproposals").at(-1).query.plan, PLAN_ID);
  said(on, "screen.plan.suggested");
  assert.ok(text(on).includes("Ask the committee to agendize repair performance"));
  assert.ok(ops(on).includes("planask"), "R13: Ask the assistant for options");
  assert.ok(!ops(on).includes("optionpropose"), "R13: optionpropose is not drawn for this act");
});

test("R1 (interface-shell R19): options sort by category, regulated end date, matter or disposition, each row's acts in its panel", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  const sort = async (col) => p.click(main(p).querySelector(`[data-shell="sort"][data-col="${col}"]`));
  await sort(1);
  assert.deepEqual(rowsOrder(p), ["Complaint to the auditor", "Story with a reporter", "Records request: inspection logs"], "by category, in the plan's order of categories");
  await sort(2);
  assert.deepEqual(rowsOrder(p), ["Records request: inspection logs", "Complaint to the auditor", "Story with a reporter"], "by end date, none last");
  await sort(4);
  assert.deepEqual(rowsOrder(p).slice(0, 2).sort(), ["Complaint to the auditor", "Records request: inspection logs"], "by disposition: chosen first");
  await sort(3);
  assert.equal(rowsOrder(p)[0], "Records request: inspection logs", "by matter");
  const panel = main(p).querySelectorAll("tr.cs-panel")[0];
  assert.ok(panel.querySelector("button[data-act]"), "the row's acts sit in its panel");
});

test("R1: 'Choose' and 'Decline' send optiondispose with the member's reason, for one option or the picked ones", async () => {
  const plane = { ...DATA_PLANE, optiondispose: ok({ plan: PLAN_ID }) };
  const p = await open(ROUTES.plan, plane);
  const choose = main(p).querySelectorAll('button[data-act="optiondispose"]').find((b) => b.dataset.option === "opt-2" && b.dataset.disposition === "chosen");
  assert.ok(choose.textContent.replace(/\s+/g, " ").trim().startsWith(W("screen.plan.choose")));
  await press(p, choose, { reason: "the reporter asked" });
  assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: ["opt-2"], disposition: "chosen", reason: "the reporter asked" });
  // the hold strip: two picked, declined together
  await p.click(p.doc.getElementById("pick-options-opt-1"));
  await p.click(p.doc.getElementById("pick-options-opt-2"));
  const decline = main(p).querySelector(".cs-hold").querySelectorAll('button[data-act="optiondispose"]').find((b) => b.dataset.disposition === "declined");
  await press(p, decline, { reason: "too early" });
  assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: ["opt-1", "opt-2"], disposition: "declined", reason: "too early" });
});

test("R1, R7: 'Add a matter' sends plansubjectadd with the matter and the member's reason, its label the key's word; control: no reference sends nothing", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, plansubjectadd: ok({ plan: PLAN_ID }) });
  assert.ok(button(p, "plansubjectadd").textContent.includes(W("act.plansubjectadd.label.plan")));
  const b = await press(p, "plansubjectadd", { values: { "plan-subject-id": "", "plan-subject-reason": "the logs decide it" } });
  assert.equal(p.byOp("plansubjectadd").length, 0);
  assert.ok(beside(p, b).includes(W("screen.plan.subject.needed")));
  await press(p, "plansubjectadd", { values: { "plan-subject-id": `outcome:${DET}#STD-2`, "plan-subject-reason": "the logs decide it" } });
  assert.deepEqual(last(p, "plansubjectadd").body, { plan: PLAN_ID, subject: { kind: "outcome", determination: DET, standard: "STD-2" }, reason: "the logs decide it" });
});

test("R1: optionadd sends the option's line, category and matter; optionadopt adopts a suggestion or a standing offer only by the member's act", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, ...REACH, optionadd: ok({}), optionadopt: ok({}) });
  await press(p, "optionadd", { values: { "plan-opt-summary": "Ask the auditor", "plan-opt-category": "legal", "plan-opt-matter": `outcome:${DET}#STD-1` }, reason: "worth trying" });
  assert.deepEqual({ ...last(p, "optionadd").body, reason: undefined }, { plan: PLAN_ID, summary: "Ask the auditor", category: "legal", subjects: [`outcome:${DET}#STD-1`], reason: undefined });
  const adopts = main(p).querySelectorAll('button[data-act="optionadopt"]');
  await press(p, adopts.find((b) => b.dataset.offer), { reason: "fair" });
  assert.deepEqual(last(p, "optionadopt").body.offer, { subject: `outcome:${DET}#STD-1`, kind: "chance_to_fix" });
  await press(p, main(p).querySelectorAll('button[data-act="optionadopt"]').find((b) => b.dataset.proposal), { reason: "good" });
  assert.equal(last(p, "optionadopt").body.proposal, `${PLAN_ID}/proposal/1`);
});

test("R1: scenarioset lays out a scenario of chosen options; checkpointrecord judges a checkpoint; refusals stay beside the act", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, scenarioset: ok({}), checkpointrecord: refusedIn("CHECKPOINT_NOT_DUE", "Not due yet.") });
  fill(p, { "plan-scen-name": "Go public", "plan-scen-options-0": true, "plan-scen-days": "7" });
  await press(p, "scenarioset");
  assert.deepEqual(last(p, "scenarioset").body, { plan: PLAN_ID, scenario: 2, name: "Go public",
    phases: [{ id: "p1", name: "Go public", options: ["opt-1"], starts: "plan_start", checkpoint: { after_days: 7 } }] });
  const b = await press(p, "checkpointrecord", { values: { "plan-judge-1-p1": "met", "plan-judgenote-1-p1": "logs arrived" }, reason: "x" });
  assert.deepEqual({ ...last(p, "checkpointrecord").body, reason: undefined }, { plan: PLAN_ID, scenario: 1, phase: "p1", judged: "met", note: "logs arrived", reason: undefined });
  assert.ok(hasWord("refusal.CHECKPOINT_NOT_DUE"));
  assert.ok(beside(p, b).includes(W("refusal.CHECKPOINT_NOT_DUE")), "the design's word for the code, not the owner's sentence");
  assert.ok(!beside(p, b).includes("Not due yet"));
});

test("R1 (v0.2 rule 18): 'Take this up' routes the item's to-dos to the member, nobody assigned; the screen then says she took it up", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, itemtakeup: (req) => ok({ take_up: 1, item: req.body.item, by: "member:mai", at: "x" }) });
  const cp = main(p).querySelectorAll('button[data-act="itemtakeup"]').find((b) => b.dataset.kind === "checkpoint");
  await press(p, cp);
  assert.deepEqual(last(p, "itemtakeup").body, { item: { kind: "checkpoint", plan: PLAN_ID, scenario: 1, phase: "p1" } });
  assert.ok(!("for" in last(p, "itemtakeup").body), "names nobody else");
  said(p, "screen.plan.tookup");
  await press(p, main(p).querySelectorAll('button[data-act="itemtakeup"]').find((b) => b.dataset.kind === "escalation_stage"));
  assert.deepEqual(last(p, "itemtakeup").body, { item: { kind: "escalation_stage", escalation: ESC, stage: 2 } });
});

test("R1: 'Start…' opens start-send for the chosen option, sending nothing; 'Close plan…' sends planclose with the reason and the lessons", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, planclose: ok({}) });
  const start = button(p, "optionstartpreview");
  assert.equal(start.dataset.option, "opt-1");
  await press(p, start);
  assert.equal(p.byOp("optionstartpreview").length, 1, "only start-send's own preview read");
  assert.equal(p.location.pathname, `/app/start-send/${encodeURIComponent(PLAN_ID + "~opt-1")}`);
  const q = await open(ROUTES.plan, { ...DATA_PLANE, planclose: ok({}) });
  assert.ok(button(q, "planclose").textContent.includes(W("screen.plan.close")));
  await press(q, "planclose", { values: { "plan-close-note": "ask sooner" }, reason: "done" });
  assert.deepEqual(last(q, "planclose").body, { plan: PLAN_ID, note: "ask sooner", reason: "done" });
});

test("R1: control: a closed plan offers no act", async () => {
  const p = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok({ ...PLAN, state: "closed", closed: { reason: "done", by: "member:dev", at: "x" } }) });
  assert.deepEqual(ops(p).filter((o) => o !== "itemtakeup"), []);
  said(p, "screen.plan.closedwhy", { reason: "done" });
});

/* ---------- R13 (T48; N1043; K3149, K3207; action-plans R51; interface-shell R55) ---------- */

const RUN = "RUN-2026-00000001";
const asking = (held, o = {}) => ({ ...DATA_PLANE, ...REACH, planask: o.ask || ok({ ok: true, plan: PLAN_ID, run: RUN, started: true }),
  airun: () => ok({ found: true, session: { id: RUN, status: held.status, ticks: 1 } }),
  planproposals: () => ok({ ...PROPOSALS, proposals: held.proposals || PROPOSALS.proposals }), ...(o.more || {}) });

test("R13: 'Ask the assistant for options' sends planask with the plan, labelled by its key, its run drawn running; control: no optionpropose is sent", async () => {
  const held = { status: "running" };
  const p = await open(ROUTES.plan, asking(held));
  const b = button(p, "planask");
  assert.equal(b.textContent.replace(/\s+/g, " ").trim().startsWith(W("act.planask.label.plan")), true);
  await press(p, b, { reason: "to see what else we could do" });
  assert.equal(last(p, "planask").body.plan, PLAN_ID);
  assert.deepEqual(Object.keys(last(p, "planask").body).filter((k) => k !== "reason"), ["plan"], "the plan alone: no summary or why of her own");
  assert.equal(p.byOp("optionpropose").length, 0, "control: no optionpropose");
  said(p, "screen.plan.ask.running");
  assert.ok(main(p).querySelector('[data-run="running"]'));
});

test("R15: the help drawn for the ask is act.planask.does's, never act.optionpropose.does's", async () => {
  const p = await open(ROUTES.plan, asking({ status: "running" }));
  const tip = button(p, "planask").getAttribute("data-tip") || "";
  const plain = (s) => String(s).replace(/<[^>]*>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
  assert.ok(hasWord("act.planask.does") && hasWord("act.planask.label.plan"));
  assert.ok(plain(tip).includes(W("act.planask.does")), "act.planask.does");
  if (hasWord("act.optionpropose.does")) assert.ok(!plain(tip).includes(W("act.optionpropose.does")), "not act.optionpropose.does");
});

test("R13: the run is re-read on the page clock until it ends, and its proposals then reach the tray, labelled machine work; an ended run is not read again", async () => {
  const held = { status: "running", proposals: [] };
  const p = await open(ROUTES.plan, asking(held));
  await press(p, "planask", { reason: "ask" });
  const reads = () => p.byOp("airun").length;
  const before = reads();
  await p.clock.tick(9000);
  assert.equal(reads(), before, "not before 10 seconds");
  const trayBefore = p.byOp("planproposals").length;
  held.status = "completed"; held.proposals = PROPOSALS.proposals;
  await p.clock.tick(10000);
  said(p, "screen.plan.ask.ended");
  assert.ok(p.byOp("planproposals").length > trayBefore, "the tray is re-read when the run ends");
  assert.ok(text(p).includes("Ask the committee to agendize repair performance"));
  assert.ok(text(p).includes("machine work"), "labelled with the proposal's own label");
  const ended = reads();
  await p.clock.tick(60000);
  assert.equal(reads(), ended, "an ended run is not read again");
});

test("R13: existed: true draws the run already asked; a refusal is drawn beside the act, and nothing is drawn as asked", async () => {
  const p = await open(ROUTES.plan, asking({ status: "running" }, { ask: ok({ ok: true, plan: PLAN_ID, run: RUN, started: false, existed: true }) }));
  await press(p, "planask", { reason: "ask" });
  said(p, "screen.plan.ask.already");
  for (const code of ["PLAN_CLOSED", "AI_RUN_MODE_NOT_DEPLOYED"]) {
    assert.ok(hasWord(`refusal.${code}`), code);
    const q = await open(ROUTES.plan, asking({ status: "running" }, { ask: refusedIn(code, "the owner's own sentence") }));
    const b = await press(q, "planask", { reason: "ask" });
    assert.ok(beside(q, b).includes(W(`refusal.${code}`)), `${code}: by its words`);
    unsaid(q, "screen.plan.ask.running");
  }
  // a code the design holds no word for is drawn by the owner's own sentence
  const odd = await open(ROUTES.plan, asking({ status: "running" }, { ask: refusedIn("CODE_NO_ONE_HAS_A_WORD_FOR", "Planning is not possible today.") }));
  assert.ok(beside(odd, await press(odd, "planask", { reason: "ask" })).includes("Planning is not possible today."));
  // a code the design holds a word for is drawn by that word, not by the owner's sentence
  assert.ok(hasWord("refusal.AI_RUN_NOT_PRINCIPAL"));
  const k = await open(ROUTES.plan, asking({ status: "running" }, { ask: refusedIn("AI_RUN_NOT_PRINCIPAL", "the owner's own sentence") }));
  const kb = await press(k, "planask", { reason: "ask" });
  assert.ok(beside(k, kb).includes(W("refusal.AI_RUN_NOT_PRINCIPAL")));
  assert.ok(!beside(k, kb).includes("the owner's own sentence"));
});

test("R13: a closed plan offers no ask; the ask is drawn only while the assistant is reachable", async () => {
  const closed = await open(ROUTES.plan, { ...DATA_PLANE, ...REACH, plan: ok({ ...PLAN, state: "closed", closed: { reason: "done", by: "member:dev", at: "x" } }) });
  assert.ok(!ops(closed).includes("planask"));
  const off = await open(ROUTES.plan, { ...DATA_PLANE, planask: ok({}) });
  assert.ok(!ops(off).includes("planask"));
});

/* ---------- R18 (T49; D5 B, its half; D20 M; ai-runs R81): the run, the titles, the references, the categories ---------- */

test("R18 (D5, D29): an answer of ok: true that carries started: false (no run already asked), dispatched: false or withheld is drawn as its refusal, never as a run looking for options", async () => {
  const carried = [
    ["started: false", { ok: true, plan: PLAN_ID, run: RUN, started: false, code: "AI_RUN_MODE_NOT_DEPLOYED", translation: "Planning runs are not deployed." }, W("refusal.AI_RUN_MODE_NOT_DEPLOYED")],
    // fixtures-generic: CODE_NO_ONE_HAS_A_WORD_FOR (a code the design has no word for, on purpose)
    ["started: false, a code with no design word", { ok: true, plan: PLAN_ID, run: RUN, started: false, code: "CODE_NO_ONE_HAS_A_WORD_FOR", translation: "Planning runs are not deployed." }, "Planning runs are not deployed."],
    ["dispatched: false", { ok: true, plan: PLAN_ID, run: RUN, started: true, dispatched: false, code: "AI_NO_ACCOUNT", translation: "No account pays for this run." }, W("refusal.AI_NO_ACCOUNT")],
    ["withheld", { ok: true, plan: PLAN_ID, run: RUN, started: true, withheld: "AGENT_WORKER_UNBOUND", translation: "The worker is not bound." }, W("refusal.AGENT_WORKER_UNBOUND")],
    ["withheld, a code with no design word", { ok: true, plan: PLAN_ID, run: RUN, started: true, withheld: "CODE_NO_ONE_HAS_A_WORD_FOR", translation: "No account pays for this run." }, "No account pays for this run."],
    ["a code with a design word", { ok: true, plan: PLAN_ID, run: RUN, started: false, code: "AI_RUN_NOT_PRINCIPAL", translation: "the owner's own sentence" }, W("refusal.AI_RUN_NOT_PRINCIPAL")],
    ["no words at all", { ok: true, plan: PLAN_ID, run: RUN, started: false }, PAGE("shell.unread")],
  ];
  for (const [what, answer, drawn] of carried) {
    const p = await open(ROUTES.plan, asking({ status: "running" }, { ask: ok(answer) }));
    await press(p, "planask", { reason: "ask" });
    const alert = main(p).querySelector('[data-run="refused"]');
    assert.ok(alert, `${what}: the refusal is drawn`);
    assert.ok(alert.textContent.includes(drawn), `${what}: by its words`);
    unsaid(p, "screen.plan.ask.running");
    unsaid(p, "screen.plan.ask.already");
    assert.equal(p.byOp("airun").length, 0, `${what}: no run is read that did not start`);
    assert.equal(main(p).querySelectorAll('[data-run="running"]').length, 0, what);
  }
});

test("R18: 'looking for options' is drawn only while airun answers the run as running; control: an ended run does not, and nothing is drawn before airun answers", async () => {
  const running = await open(ROUTES.plan, asking({ status: "running" }));
  await press(running, "planask", { reason: "ask" });
  said(running, "screen.plan.ask.running");
  const ended = await open(ROUTES.plan, asking({ status: "completed" }));
  await press(ended, "planask", { reason: "ask" });
  unsaid(ended, "screen.plan.ask.running");
  said(ended, "screen.plan.ask.ended");
  const silent = async (op) => { const { status, body } = await storeSilentParsed(op); return { status, json: body }; };
  const unanswered = await open(ROUTES.plan, asking({ status: "running" }, { more: { airun: await silent("airun") } }));
  await press(unanswered, "planask", { reason: "ask" });
  unsaid(unanswered, "screen.plan.ask.running");
  unsaid(unanswered, "screen.plan.ask.ended");
});

test("R18 (D20): the plan names its project and its questions by their titles, each a reference; never INQ-… or inquiry:INQ-…", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  const t = text(p);
  assert.ok(t.includes(QUESTION_TITLE), "the question, by its title");
  assert.ok(t.includes("Pothole repairs"), "the project, by its title");
  assert.doesNotMatch(t, /INQ-/, "no question reference");
  assert.doesNotMatch(t, /inquiry:/, "no matter key");
  const refs = main(p).querySelectorAll(".cs-card, a.cs-ref").map((e) => e.textContent.trim());
  assert.ok(refs.includes(QUESTION_TITLE) && refs.includes("Pothole repairs"), "each a reference the kit draws");
  // the options' matter column names the question by title, and the picker of an option's matter does too
  assert.ok(main(p).querySelectorAll("table.cs-rows tbody tr.cs-r").some((tr) => tr.textContent.includes(QUESTION_TITLE)));
  assert.ok(main(p).querySelector("#plan-opt-matter").querySelectorAll("option").some((o) => o.textContent.trim() === QUESTION_TITLE));
  // the questions are read from the project's own list, once
  assert.deepEqual(p.byOp("projectquestions").map((r) => r.query.project), [PROJECT]);
  // control: a question whose title the record does not give is not named by its reference
  const { world, me, project } = await actionWorld();
  const untitled = await untitledQuestion(world, me, project);
  const held = await planOn(me, project, untitled, "A plan on a question with no title");
  assert.equal((await me.read("projectquestions", { query: { project } })).items.find((x) => x.inquiry === untitled).title, null, "the record gives it no title");
  const none = await openIn(world, me, `/app/plan/${held}`);
  assert.ok(text(none).includes("A plan on a question with no title"), "the real plan is drawn");
  assert.doesNotMatch(text(none), /INQ-|inquiry:/);
});

test("R18: a reference is picked from a list the record answers, never typed; what the plan holds is not offered again; control: with nothing to pick, no field and no act", async () => {
  const p = await open(ROUTES.plan, DATA_PLANE);
  const field = p.doc.getElementById("plan-subject-id");
  assert.equal(field.tagName.toLowerCase(), "select", "a choice, not a typed field");
  const offered = field.querySelectorAll("option").map((o) => [o.getAttribute("value"), o.textContent.trim()]);
  assert.deepEqual(offered, [["inquiry:INQ-2026-9999999999999999", "Who signed the closure memo?"], [`outcome:${DET}#STD-2`, `${D("2024-03-01")} · City Administrator, City · Lease §9.1`]],
    "the project's other question, and the determination's other standard: the matters the plan holds are left out");
  assert.equal(p.doc.getElementById("plan-subject-standard"), null, "the standard is picked with the determination, not typed");
  await press(p, "plansubjectadd", { values: { "plan-subject-id": "inquiry:INQ-2026-9999999999999999", "plan-subject-reason": "it decides the memo" } });
  // (the plane here answers plansubjectadd with nothing scripted: the body is what the member's picks sent)
  assert.deepEqual(last(p, "plansubjectadd").body, { plan: PLAN_ID, subject: { kind: "inquiry", inquiry: "INQ-2026-9999999999999999" }, reason: "it decides the memo" });
  // the lists are read for this plan's project only
  assert.deepEqual(p.byOp("determinations").map((r) => r.query.project), [PROJECT]);
  const taken = await open(ROUTES.plan, { ...DATA_PLANE, projectquestions: ok({ ...PROJECT_QUESTIONS, items: [PROJECT_QUESTIONS.items[0]] }),
    determinations: ok({ ...DETERMINATIONS, items: [{ ...DETERMINATIONS.items[0], outcomes: [DETERMINATIONS.items[0].outcomes[0]] }] }) });
  assert.equal(taken.doc.getElementById("plan-subject-id"), null);
  assert.ok(!ops(taken).includes("plansubjectadd"));
});

test("R18: categories are drawn by their words, never as lowercase codes: a category the plan does not know is the word for other", async () => {
  const odd = { ...PLAN, options: PLAN.options.map((o, i) => (i === 1 ? { ...o, category: "zzcode" } : o)) };
  const p = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok(odd) });
  const cells = main(p).querySelectorAll("table.cs-rows tbody tr.cs-r").map((tr) => tr.textContent);
  const story = cells.find((c) => c.includes("Story with a reporter"));
  assert.ok(story.includes(W("screen.plan.category.other")));
  assert.ok(!story.includes("zzcode"));
  for (const c of ["mitigation", "legal", "awareness", "journalistic", "grassroots", "other"]) assert.ok(hasWord(`screen.plan.category.${c}`) && hasWord(`screen.plan.option.kind.${c}`), c);
  // DEC-387 (B424): the add form's options read the design's `screen.plan.option.kind.*` rows
  const choices = p.doc.getElementById("plan-opt-category").querySelectorAll("option").map((o) => o.textContent.trim());
  assert.deepEqual(choices, ["mitigation", "legal", "awareness", "journalistic", "grassroots", "other"].map((c) => W(`screen.plan.option.kind.${c}`)));
});
