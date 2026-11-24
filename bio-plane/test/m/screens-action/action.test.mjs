/* screens-action R5, R10, R12, R16, R17 (and R7 on `action`): one action, its replies, due dates, pressure, holds, scope, the law
   it goes under and its risk. Every sentence is asserted by its key through `setup-words` (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { SCREENS, open, main, crumbs, text, ops, press, last, ok, beside, button, refusedIn, W, D, hasWord, DATA_PLANE, ROUTES, ACTION, FUTURE_ACTION, ACTION_ID, FILINGS, PRESSURE, PROJECT, PROFILES, draft } from "./page.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";

const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
const OFFICE = "City Clerk, Office of the City Clerk";

test("R5: reads the action: what it is, to whom (by role, with who holds it today), when and by whom it was sent, its replies; the wait while one is owed", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  assert.equal(p.byOp("action")[0].query.id, ACTION_ID);
  said(p, "screen.action.kind.records_request");
  said(p, "screen.action.to", { office: OFFICE });
  said(p, "screen.request.holder", { holder: "Asha Rao" });
  said(p, "screen.action.sentby", { date: D("2026-10-02"), who: "mai" });
  said(p, "screen.action.waiting", { office: OFFICE });
  assert.ok(text(p).includes(D("2026-10-03")));
  assert.ok(text(p).includes(`${W("screen.action.received")} · Office of the City Clerk · email`));
  const q = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, reply_owed: { owed: false } }) });
  unsaid(q, "screen.action.waiting", { office: OFFICE });
});

test("R5 (action-producers R1; v0.2 rule 6): each due date is drawn with mark.due and opens due-date; a passed one is canon's question, never 'overdue' until a member determines it", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  const dues = main(p).querySelectorAll(".cs-due");
  assert.equal(dues.length, 2);
  assert.ok(dues.every((d) => d.getAttribute("data-tip")), "mark.due explains itself");
  assert.ok(main(p).querySelector(`a[href="/app/due-date/${encodeURIComponent(ACTION_ID + "~0")}"]`));
  said(p, "screen.action.noreplyby", { date: D("2026-10-12") });
  unsaid(p, "screen.action.clock.overdue");
  const q = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, clock: [{ ...ACTION.clock[0], status: "overdue" }] }) });
  said(q, "screen.action.clock.overdue");
});

test("R5: 'Record a reply' sends actioncorrespond with the day and the member's account; 'Mark a reply as pressure' marks a received one once", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: ok({ ...PRESSURE, items: [] }), actioncorrespond: ok({}), actionpressure: ok({}) });
  const b = await press(p, "actioncorrespond", { reason: "it came" });
  assert.ok(beside(p, b).includes(W("screen.action.reply.at.needed")));
  await press(p, "actioncorrespond", { values: { "reply-at": "2026-10-11", "reply-account": "They will answer by 26 October." }, reason: "it came" });
  const r = last(p, "actioncorrespond");
  assert.deepEqual([r.query.target, r.query.direction, r.query.at, r.query.account], [ACTION_ID, "received", "2026-10-11", "They will answer by 26 October."]);
  await press(p, "actionpressure", { values: { "pressure-kind-2": "discrediting", "pressure-note-2": "called us saboteurs" }, reason: "x" });
  assert.deepEqual({ ...last(p, "actionpressure").body, reason: undefined }, { target: ACTION_ID, ord: 2, pressure: { kind: "discrediting", note: "called us saboteurs" }, reason: undefined });
  const q = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, entries: [{ ord: 2, pressure: { kind: "legal", note: "x" } }] }) });
  assert.ok(!ops(q).includes("actionpressure"), "control: a marked reply is marked once");
  said(q, "screen.action.pressure.legal");
});

test("R5 (diagnosis 11 §17): a reply marked through `actionpressure` is drawn marked, read from `pressurefor`, and not offered again; another received reply still offers it", async () => {
  const two = { ...ACTION, correspondence: [...ACTION.correspondence, { ord: 3, direction: "received", at: "2026-10-04", medium: "email", party: "Office of the City Clerk", author: "member:mai" }], entries: [{ ord: 2 }, { ord: 3 }] };
  const marked = { ...PRESSURE, items: [{ arrived: { action: ACTION_ID, ord: 2 }, project: PROJECT, kind: "legal", note: "a letter", by: "member:mai", at: "2026-10-04T09:00:00Z" }] };
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok(two), pressurefor: ok(marked), actionpressure: ok({}) });
  assert.equal(p.doc.getElementById("pressure-kind-2"), null, "ord 2 is marked: no choice to mark it again");
  assert.ok(p.doc.getElementById("pressure-kind-3"), "ord 3 is not marked: it is still offered");
  const row = main(p).querySelectorAll(".cs-row").find((r) => text(p, r).includes(D("2026-10-03")));
  assert.ok(text(p, row).includes(W("screen.action.pressure.legal")), "the mark is drawn beside the reply it was made on");
  // control: a mark on another action's reply is not read as this one's
  const other = await open(ROUTES.action, { ...DATA_PLANE, action: ok(two), pressurefor: ok({ ...marked, items: [{ ...marked.items[0], arrived: { action: "ACTN-2026-9999999999999999", ord: 2 } }] }) });
  assert.ok(other.doc.getElementById("pressure-kind-2"));
});

test("R5: 'Move the action' to a state its edges allow, with the reason in the query actions reads; resolving names how", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionmove: ok({}) });
  const to = p.doc.getElementById("move-to").querySelectorAll("option").map((o) => o.value);
  assert.deepEqual(to, ["active", "resolved", "abandoned"]);
  await press(p, "actionmove", { values: { "move-to": "resolved", "move-resolution": "complied" }, reason: "the logs came" });
  const r = last(p, "actionmove");
  assert.deepEqual([r.query.target, r.query.to, r.query.resolution, r.query.reason], [ACTION_ID, "resolved", "complied", "the logs came"]);
});

test("R5: 'Remind me' on a dated entry; confidential or not with a reason, a published case keeping what it said; the litigation hold is no longer placed here (R32)", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, reminderset: ok({}), actionscope: ok({}) });
  await press(p, "reminderset", { nth: 1, values: { "remind-1": "2099-10-20" } });
  assert.deepEqual(last(p, "reminderset").body, { target: ACTION_ID, entry: 1, on: "2099-10-20" });
  said(p, "screen.action.scope.open");
  assert.ok(!ops(p).includes("actionhold"), "R5 drops actionhold: it is placed on `hold`");
  assert.equal(p.byOp("actionholdpreview").length, 0, "the hold's preview is not read here");
  await press(p, "actionscope", { reason: "names a witness" });
  assert.deepEqual(last(p, "actionscope").body, { target: ACTION_ID, confidential: true, reason: "names a witness" });
});

test("R10 (DEC-212): an action holding an approved, unsent text offers to pick up where it was left, opening the request at its send step; control: none without one", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, filingsfor: ok(FILINGS([draft({ approval: { approved_by: "member:mai", at: "x", sha: "s" } })])) });
  said(p, "screen.action.unsent");
  const a = main(p).querySelectorAll("a").find((x) => x.textContent.includes(W("screen.action.pickup")));
  assert.equal(a.getAttribute("href"), `/app/request/${ACTION_ID}`);
  const q = await open(ROUTES.action, DATA_PLANE);
  unsaid(q, "screen.action.pickup");
});

/* ---------- R12 (T48; N1035; K3145; actions R102; action-holds R16) ---------- */

test("R12: the action heads the screen with its title and its project as a reference, each as `action` answers them; control: a null is drawn absent, never as 'untitled'", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  assert.equal(main(p).querySelector("h1").textContent, "Inspection logs, 2025");
  assert.deepEqual(crumbs(p).slice(1), ["Pothole repairs", W("screen.action.name")], "the project step is named by its title");
  assert.equal(p.byOp("file").length, 0, "the project comes from the action's own answer, not from its document");
  const bare = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, title: null, project: null }) });
  assert.equal(main(bare).querySelector("h1").textContent, W("screen.action.name"), "no title: the screen's own name");
  assert.doesNotMatch(text(bare), /untitled/i);
  assert.equal(crumbs(bare).length, 2, "no project: no project step");
});

test("R12: the pressure marks from pressurefor are drawn with where each arrived; control: a mark on another action is not drawn", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  assert.equal(p.byOp("pressurefor")[0].query.action, ACTION_ID);
  said(p, "screen.action.pressuremarks");
  said(p, "screen.action.pressuremark.reply", { ord: "2" });
  // R31 (3): a legal mark is drawn as `screen.action.legalmark` with its note and, while it has no hold, `screen.action.holdnone`
  said(p, "screen.action.legalmark", { member: "mai" });
  said(p, "screen.action.holdnone");
  assert.ok(text(p).includes(`${W("screen.action.legalmark", { member: "mai" })} · a letter from the city's counsel`));
  const retaliation = { arrived: { action: ACTION_ID, ord: 2 }, project: PROJECT, kind: "retaliation", note: "a threat to the lease", by: "member:asha", at: "2026-10-05T09:00:00Z", hold: null };
  const r = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: ok({ ...PRESSURE, items: [retaliation] }) });
  said(r, "screen.action.pressuremark.by", { who: "asha" });
  unsaid(r, "screen.action.holdnone");
  assert.ok(text(p).includes(D("2026-10-04")));
  const other = { arrived: { action: "ACTN-2026-ffffffffffffffff", ord: 1 }, project: PROJECT, kind: "retaliation", note: "a threat on the other action", by: "member:dev", at: "2026-10-05T09:00:00Z" };
  const q = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: ok({ ...PRESSURE, items: [...PRESSURE.items, other] }) });
  assert.doesNotMatch(text(q), /a threat on the other action/);
  const none = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: ok({ ...PRESSURE, items: [] }) });
  unsaid(none, "screen.action.pressuremarks");
  const failed = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: { status: 502, text: "boom" } });
  assert.ok(main(failed).querySelector('[data-state="failed"]'), "a failed read is drawn as failed");
});

test("R12: the marks are paged by `after`: the next page is read from the cursor until none follows", async () => {
  const mark = (ord, note) => ({ arrived: { action: ACTION_ID, ord }, project: PROJECT, kind: "other", note, by: "member:mai", at: "2026-10-04T09:00:00Z" });
  const pages = { undefined: { ...PRESSURE, items: [mark(2, "first page")], truncated: true, cursor: `${ACTION_ID}#2` },
    [`${ACTION_ID}#2`]: { ...PRESSURE, items: [mark(3, "second page")], truncated: true, cursor: `${ACTION_ID}#3` },
    [`${ACTION_ID}#3`]: { ...PRESSURE, items: [mark(4, "third page")], truncated: false, cursor: null } };
  const p = await open(ROUTES.action, { ...DATA_PLANE, pressurefor: (r) => ok(pages[r.query.after]) });
  for (const s of ["first page", "second page", "third page"]) assert.ok(text(p).includes(s), s);
  assert.deepEqual(p.byOp("pressurefor").map((r) => r.query.after), [undefined, `${ACTION_ID}#2`, `${ACTION_ID}#3`]);
});

/* ---------- R16 (T49; N1093; DEC-239 (1); actions R18, R25; action-records R1): the law it goes under ---------- */

const REACH = { assistantstate: ok({ on: true }), accountreference: ok({ held: true }) };
const section = (p, titleKey) => main(p).querySelectorAll("section.cs-section").find((s) => (s.querySelector("h2") || { textContent: "" }).textContent.trim() === W(titleKey));

test("R16: the law chosen is drawn by level and citation with its window and who stated it, and when; a proposal is drawn apart, never as the law", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  const law = section(p, "law.title");
  assert.ok(law, "law.title");
  assert.ok(hasWord("law.help"));
  const t = law.textContent.replace(/\s+/g, " ");
  assert.ok(t.includes(`${W("screen.request.level.state")} · Gov. Code § 7922.535(b) · ${W("screen.request.window.calendar", { n: "10" })}`), "level, citation and the profile's window");
  assert.ok(t.includes(W("law.stated", { who: "mai", date: D("2026-10-01") })));
  assert.ok(t.includes(W("law.proposed")));
  assert.ok(t.includes(W("law.proposal.not", { who: "claude", date: D("2026-10-02") }).replace("claude", "agent:claude")), "who proposed it, and when, not the law");
  // control: the proposal's citation is under the proposal, not among the laws chosen
  const sheets = law.querySelectorAll(".cs-sheet");
  assert.ok(!sheets[0].textContent.includes("Mun. Code § 2.20.230"), "a proposal is never drawn as the law");
  assert.ok(sheets[1].textContent.includes("Mun. Code § 2.20.230"));
  assert.equal(p.byOp("profiles").length, 1, "the laws the group's places name are read");
});

test("R16: an undetermined list is drawn as law.undetermined; control: nothing is drawn as stated", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, governing_laws: { state: "undetermined", laws: [], by: null, at: null, stated: "x" }, governing_laws_proposals: { proposals: [] } }) });
  const law = section(p, "law.title");
  assert.ok(law.textContent.includes(W("law.undetermined")));
  assert.ok(!law.textContent.includes(W("law.proposed")), "no proposal, none drawn");
  assert.doesNotMatch(law.textContent, /law\.stated|Stated by/);
});

test("R16: 'Change the law…' sends actionlaws with the law chosen from those the group's places name; 'Propose another law…' sends actionlawspropose and changes nothing", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionlaws: ok({}), actionlawspropose: ok({}) });
  assert.ok(button(p, "actionlaws").textContent.includes(W("law.change")));
  assert.ok(button(p, "actionlawspropose").textContent.includes(W("law.propose")));
  // R54: one list offers the laws of this action's kind the places name, for both acts
  assert.deepEqual(p.doc.getElementById("law-pick").querySelectorAll("option").map((o) => o.value), ["Gov. Code § 7922.535(b)", "Mun. Code § 2.20.230"]);
  assert.equal(p.doc.getElementById("lawp-pick"), null, "no second list");
  await press(p, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  assert.deepEqual(last(p, "actionlaws").body, { target: ACTION_ID, laws: [{ level: "city", citation: "Mun. Code § 2.20.230" }] });
  await press(p, "actionlawspropose", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  assert.deepEqual(last(p, "actionlawspropose").body, { target: ACTION_ID, laws: [{ level: "city", citation: "Mun. Code § 2.20.230" }] });
  assert.equal(p.byOp("actionlaws").length, 1, "proposing sent no actionlaws");
  // a law already chosen keeps its level when it is chosen again
  await press(p, "actionlaws", { values: { "law-pick": "Gov. Code § 7922.535(b)" } });
  assert.deepEqual(last(p, "actionlaws").body.laws, [{ level: "state", citation: "Gov. Code § 7922.535(b)" }]);
});

test("R16: refusals are drawn by their words, beside the act", async () => {
  assert.ok(hasWord("refusal.BAD_CITATION"));
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionlaws: refusedIn("BAD_CITATION", "the owner's own sentence") });
  const b = await press(p, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  assert.ok(beside(p, b).includes(W("refusal.BAD_CITATION")), "by its word");
  assert.ok(!beside(p, b).includes("the owner's own sentence"));
  // a code the design holds no word for is drawn by the owner's own sentence
  const q = await open(ROUTES.action, { ...DATA_PLANE, actionlaws: refusedIn("CODE_NO_ONE_HAS_A_WORD_FOR", "That law cannot be kept.") });
  assert.ok(beside(q, await press(q, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230" } })).includes("That law cannot be kept."));
});

/* ---------- R17 (T49; N1093; DEC-239 (2); actions R23–R25; action-records R2): its risk ---------- */

test("R17: tier 2 is drawn by key with its words, its latest revision (who, when, the reason, the prior tier's words); control: tier undetermined has its own words", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  const risk = section(p, "risk.title");
  assert.ok(risk, "risk.title");
  assert.ok(hasWord("risk.help"));
  const t = risk.textContent.replace(/\s+/g, " ");
  assert.ok(t.includes(`${W("risk.tier", { tier: "2" })} · ${W("risk.tier.2")}`));
  assert.ok(t.includes(W("risk.set", { who: "mai", date: D("2026-10-03"), reason: "the office has fought requests before", prior: W("risk.tier.1") })));
  const q = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, risk_tier: "undetermined", risk_tier_history: { revisions: [] }, risk_tier_proposals: { proposals: [] } }) });
  const u = section(q, "risk.title");
  assert.ok(u.textContent.includes(W("risk.tier.undetermined")));
  assert.ok(!u.textContent.includes(W("risk.tier", { tier: "1" })));
  assert.ok(!u.textContent.includes(W("risk.proposed")), "no proposal, none drawn");
  for (const n of ["1", "2", "3"]) assert.ok(hasWord(`risk.tier.${n}`));
});

test("R17: 'Revise, with a reason…' sends actionrisktier with the tier and the reason; its refusals are drawn by their words", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionrisktier: ok({}) });
  assert.ok(button(p, "actionrisktier").textContent.includes(W("risk.revise")));
  await press(p, "actionrisktier", { values: { "risk-tier": "3" }, reason: "counsel read it" });
  assert.deepEqual(last(p, "actionrisktier").body, { target: ACTION_ID, tier: 3, reason: "counsel read it" });
  assert.ok(hasWord("refusal.RISK_TIER_UNCHANGED"));
  const q = await open(ROUTES.action, { ...DATA_PLANE, actionrisktier: refusedIn("RISK_TIER_UNCHANGED", "the owner's own sentence") });
  const b = await press(q, "actionrisktier", { values: { "risk-tier": "2" }, reason: "same" });
  assert.ok(beside(q, b).includes(W("refusal.RISK_TIER_UNCHANGED")));
  assert.ok(!beside(q, b).includes("the owner's own sentence"));
});

test("R17: a machine proposal is drawn only while the assistant is reachable, apart and labelled; a member's whether or not; control: it is not the tier", async () => {
  const off = await open(ROUTES.action, DATA_PLANE);
  const offRisk = section(off, "risk.title").textContent.replace(/\s+/g, " ");
  assert.ok(offRisk.includes(W("risk.proposed")), "a member's proposal is drawn though the assistant is unreachable");
  assert.ok(offRisk.includes(W("risk.proposal", { who: "asha", tier: "1", words: W("risk.tier.1") })));
  assert.ok(!offRisk.includes(W("risk.proposal", { who: "agent:claude", tier: "3", words: W("risk.tier.3") })), "control: the machine's is not drawn while unreachable");
  const on = await open(ROUTES.action, { ...DATA_PLANE, ...REACH });
  const onRisk = section(on, "risk.title").textContent.replace(/\s+/g, " ");
  assert.ok(onRisk.includes(W("risk.proposal", { who: "agent:claude", tier: "3", words: W("risk.tier.3") })));
  assert.ok(onRisk.includes(W("risk.proposal.not")));
  assert.ok(onRisk.includes(W("mark.origin.machine.name")), "labelled machine work (mark.origin.machine)");
  assert.ok(onRisk.includes(W("risk.tier", { tier: "2" })), "the tier is still the member's 2");
});

/* ---------- R23 (T50; N1093; DEC-239; UX-DESIGN U233; action-records R19): an action opens a question ---------- */

// `actioninquiry` is an owed act (`interface-shell` R73): drawn once `op-declarations` declares it (R12); until then none is, and nothing throws.
const DECLARED = Object.hasOwn(OPS, "actioninquiry");
const INQ = "INQ-2026-aaaaaaaaaaaaaaaa";
const FUTURE = FUTURE_ACTION;

test("R23, R26: where a reply's date has passed with none recorded, 'Open a question from this' is offered at once with a field for the question; it sends actioninquiry, the page stays and says where the question is open, with a reference to it", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actioninquiry: ok({ ok: true, inquiry: INQ, action: ACTION_ID, project: PROJECT }) });
  if (!DECLARED) {
    assert.ok(!ops(p).includes("actioninquiry"), "not declared: not registered, not drawn");
    assert.ok(!SCREENS.flatMap((x) => x.acts.map((a) => a.op)).includes("actioninquiry"));
    return;
  }
  said(p, "action.noreply.title", { date: D("2026-10-12") });
  said(p, "action.noreply.says");
  said(p, "action.noreply.question.help");
  assert.ok(button(p, "actioninquiry").textContent.includes(W("action.noreply.question")));
  assert.equal(p.doc.getElementById("action-question").closest("details"), null, "at once, not behind a fold");
  const field = p.doc.getElementById("action-question");
  assert.equal(field.value, "", "control: nothing is filled from the action into the question");
  assert.equal(field.getAttribute("maxlength"), "500");
  const reads = p.byOp("action").length;
  const none = await press(p, "actioninquiry", { reason: "x" });
  assert.ok(beside(p, none).includes(W("refusal.ACTION_INQUIRY_NO_QUESTION")), "a question is needed");
  assert.equal(p.byOp("actioninquiry").length, 0);
  await press(p, "actioninquiry", { values: { "action-question": "  Why has the Clerk not answered the request?  " }, reason: "x" });
  const sent = last(p, "actioninquiry").body;
  assert.equal(sent.action, ACTION_ID);
  assert.equal(sent.question, "Why has the Clerk not answered the request?");
  assert.deepEqual(Object.keys(sent).filter((k) => !["action", "question", "reason"].includes(k)), [], "control: nothing else is sent, nothing filled from the action");
  // R26: the screen does not navigate away: the receipt and the reference to the question
  assert.equal(p.location.pathname, ROUTES.action, "the page stays on the action");
  said(p, "screen.action.ask.done", { project: "Pothole repairs" });
  assert.ok(main(p).querySelector(`a[href="/app/question/${INQ}"]`), "the reference to the question");
  assert.equal(p.byOp("action").length, reads, "the action page is unchanged: it is not read again");
  said(p, "screen.action.ask.heading");
  assert.ok(p.doc.getElementById("action-question").parentNode.textContent.includes(W("action.noreply.question.label")), "the field's label is `action.noreply.question.label`");
});

test("R23: on request on any action: a date not yet passed offers it behind a fold, with no 'no reply recorded' box; control: it is the same act", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok(FUTURE), actioninquiry: ok({ ok: true, inquiry: INQ, action: ACTION_ID, project: PROJECT }) });
  if (!DECLARED) return assert.ok(!ops(p).includes("actioninquiry"));
  assert.ok(!text(p).includes(W("action.noreply.title", { date: D("2099-10-26") })), "nothing has lapsed");
  const fold = main(p).querySelector("details.mk-details");
  assert.ok(fold && fold.querySelector("summary").textContent.includes(W("action.noreply.question")));
  assert.ok(fold.querySelector('button[data-act="actioninquiry"]'));
  await press(p, "actioninquiry", { values: { "action-question": "Is the extension lawful?" }, reason: "x" });
  assert.equal(last(p, "actioninquiry").body.question, "Is the extension lawful?");
  // an action with no clock at all is offered it too
  const bare = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, clock: [] }) });
  assert.ok(ops(bare).includes("actioninquiry"));
});

test("R23: ACTION_NO_PROJECT, MACHINE_CANNOT_OPEN_FROM_ACTION and ACTION_INQUIRY_NO_QUESTION are drawn by their words, beside the act; an action in no project opens nothing", async () => {
  for (const k of ["refusal.ACTION_INQUIRY_NO_QUESTION", "refusal.ACTION_NO_PROJECT", "refusal.MACHINE_CANNOT_OPEN_FROM_ACTION", "action.noreply.question", "action.noreply.question.help"]) assert.ok(hasWord(k), k);
  if (!DECLARED) return;
  for (const code of ["ACTION_NO_PROJECT", "MACHINE_CANNOT_OPEN_FROM_ACTION", "ACTION_INQUIRY_NO_QUESTION"]) {
    const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, project: null }), actioninquiry: refusedIn(code, "the owner's own sentence") });
    const b = await press(p, "actioninquiry", { values: { "action-question": "A question?" }, reason: "x" });
    assert.ok(beside(p, b).includes(W("refusal." + code)), code);
    assert.ok(!beside(p, b).includes("the owner's own sentence"));
    assert.equal(p.location.pathname, ROUTES.action, "nothing opened");
  }
});
