/* affordances R52 (T46; N925, N930, N931; K2898; escalation R31, R33, R34; action-clocks R20; filings R50): the acts R51
   deferred at T45's merge, offered on an `action` target exactly where each act's own refusal would admit the caller (R18),
   at the module's interface. R14's `action` facts are asked of the real owners over their own fixtures — escalation's world
   (its actions and conformance stand-ins answering as the real modules do), action-clocks' and filings' worlds (every
   module real) — and each offer and each withholding is driven against the act's own refusal. The oracle over every
   combination of the facts is derive.test.mjs's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveActs, decorate } from "../../../src/affordances.mjs";
import { affordancesOf } from "../../../src/affordances/facts.mjs";
import { MACHINE_REFUSALS } from "../../../src/op-grades/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { seeded as escSeeded, opened as escOpened, toStage, OFFICE, V as EV, MACHINE as EMACHINE } from "../escalation/fixture.mjs";
import { world as cWorld, V as CV, MACHINE as CMACHINE } from "../action-clocks/fixture.mjs";
import { world as fWorld, V as FV } from "../filings/fixture.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";

/* The owners a scene does not drive answer as absent: their facts read null and offer nothing that needs them (R10). */
const SILENT = { escalationsFor: () => ({ ok: true, items: [] }), determinationRead: () => ({ ok: false }),
  templatesForAction: () => ({ ok: false }), filingsFor: () => ({ ok: false }), remindersFor: () => ({ ok: false }),
  clockProposalsFor: () => ({ ok: false }), pressureFor: () => ({ ok: false }), holdsOf: () => ({ ok: false }) };

/* escalation's world, as t45's scene builds it: actions' read from the action's document, conformance's from the world's
   determinations; escalation real. */
function escScene(w = escSeeded()) {
  const actions = { actionRead: ({ id, viewer }) => {
    const h = w.record.head(id);
    if (!h || !w.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE" };
    const fm = parseFrontmatter(w.record.readFile(id, "bundle.md").text).data || {};
    return { ok: true, id, current_state: fm.current_state ?? null, kind: fm.action_kind ?? null, breach: fm.breach === true,
      legs: (fm.action_basis ?? []).map((l) => ({ target: l.target, kind: l.kind })), correspondence: [], clock: [] };
  } };
  const conformance = { determinationRead: ({ id }) => {
    const d = w.determinations.get(id);
    return d ? { ok: true, id, project: d.project, live: !d.superseded_by, void: null, outcomes: d.outcomes } : { ok: false };
  } };
  const facts = affordancesOf(w.host, { record: w.record, membership: w.membership, actions, escalation: w.esc, conformance,
    connections: { citesInto: () => ({ confirmed: [], severed: [] }) }, actionHolds: SILENT, filings: SILENT, actionClocks: SILENT });
  const ask = (id, who = "bob", author = EV(who)) => facts.affordanceFacts({ target: id, viewer: EV(who), identity: EV(who), author, by: who });
  const acts = (id, who, author) => deriveActs(ask(id, who, author));
  const offered = (id, who, author) => acts(id, who, author).map((a) => a.id);
  return { w, ask, acts, offered };
}
const bob = { author: EV("bob"), viewer: EV("bob") };

test("R52 R18: escalation's stop is offered on an action while an escalation of what it rests on stands open or suspended, "
   + "and accepted; once stopped, the stop is withheld (refused NOT_OPEN) and the reopening offered and accepted; before, the "
   + "reopening is withheld (refused NOT_STOPPED); a stopped escalation still stands, so opening another is withheld "
   + "(ALREADY_OPEN); control: an action resting on no determination is offered neither", () => {
  const { w, offered } = escScene();
  const act = w.action({ project: w.P, restsOn: [w.D] });
  const bare = w.action({ project: w.P, restsOn: [] });
  for (const id of ["escalationstoppursuing", "escalationreopen"]) assert.ok(!offered(act).includes(id), `none open: ${id}`);
  escOpened(w);
  assert.ok(offered(act).includes("escalationstoppursuing"), "open: the stop offered");
  assert.ok(!offered(act).includes("escalationreopen"), "open: no reopening");
  assert.equal(w.esc.escalationReopen({ id: w.E, reason: "back to it", ...bob }).reason, "NOT_STOPPED");
  for (const id of ["escalationstoppursuing", "escalationreopen"]) assert.ok(!offered(bare).includes(id), `control: ${id}`);
  /* suspended: the stop still offered */
  assert.equal(w.esc.escalationSuspend({ id: w.E, reason: "waiting on the board", ...bob }).ok, true);
  assert.ok(offered(act).includes("escalationstoppursuing"), "suspended: the stop offered");
  const stop = w.esc.escalationStopPursuing({ id: w.E, reason: "the group has other priorities", ...bob });
  assert.equal(stop.ok, true, JSON.stringify(stop).slice(0, 300));
  const after = offered(act);
  assert.ok(!after.includes("escalationstoppursuing"), "stopped: no second stop");
  assert.equal(w.esc.escalationStopPursuing({ id: w.E, reason: "again", ...bob }).reason, "NOT_OPEN");
  assert.ok(after.includes("escalationreopen"), "stopped: the reopening offered");
  /* a stopped escalation still stands (escalation R1, R31): opening another is refused, and not offered */
  assert.ok(!after.includes("escalationopen"), "stopped: no opening");
  assert.equal(w.esc.escalationOpen({ reason: "again", determination: w.D, ...bob }).reason, "ALREADY_OPEN");
  assert.equal(w.esc.escalationReopen({ id: w.E, reason: "the board met again", ...bob }).ok, true);
  assert.ok(offered(act).includes("escalationstoppursuing") && !offered(act).includes("escalationreopen"), "reopened: open again");
});

test("R52 R10 R20: a machine is offered neither the stop nor the reopening, and escalation refuses it each with the code "
   + "MACHINE_REFUSALS names (MACHINE_CANNOT_STOP); a member is offered them", () => {
  const { w, offered } = escScene();
  const act = w.action({ project: w.P, restsOn: [w.D] });
  escOpened(w);
  assert.ok(offered(act).includes("escalationstoppursuing"));
  assert.ok(!offered(act, "bob", EMACHINE).includes("escalationstoppursuing"), "a machine: no stop");
  assert.equal(MACHINE_REFUSALS.escalationstoppursuing, "MACHINE_CANNOT_STOP");
  assert.equal(w.esc.escalationStopPursuing({ id: w.E, reason: "r", author: EMACHINE, viewer: EV("bob") }).reason, "MACHINE_CANNOT_STOP");
  assert.equal(w.esc.escalationStopPursuing({ id: w.E, reason: "r", ...bob }).ok, true);
  assert.ok(offered(act).includes("escalationreopen"));
  assert.ok(!offered(act, "bob", EMACHINE).includes("escalationreopen"), "a machine: no reopening");
  assert.equal(MACHINE_REFUSALS.escalationreopen, "MACHINE_CANNOT_STOP");
  assert.equal(w.esc.escalationReopen({ id: w.E, reason: "r", author: EMACHINE, viewer: EV("bob") }).reason, "MACHINE_CANNOT_STOP");
});

test("R52 R18: at stage 7 attachment is offered only for the purposes attachConditions admits for the action's addressee "
   + "(official_request withheld where the profile marks the office not elected, refused COUNTERPARTY_NOT_ELECTED; "
   + "testimony offered and accepted); an elected office is offered the official request; an action already attached is "
   + "offered no attachment (ALREADY_ATTACHED)", () => {
  const { w, acts } = escScene();
  const attached = toStage(w, 7);
  const purposesOf = (id) => acts(id).filter((a) => a.id === "escalationattach").map((a) => a.purposes);
  const clerk = w.action({ project: w.P, restsOn: [w.D], counterparty: { state: "named", ...OFFICE.clerk } });
  const board = w.action({ project: w.P, restsOn: [w.D], counterparty: { state: "named", ...OFFICE.board } });
  const conditions = (id) => w.esc.attachConditions({ id: w.E, action: id, viewer: EV("bob") }).purposes;
  /* the clerk, not elected: every purpose but the official request (refused); the oversight undetermined, offered */
  assert.equal(conditions(clerk).official_request.state, "refused");
  assert.deepEqual(purposesOf(clerk), [["oversight_request", "audit_request", "testimony", "enforcing_legislation"]]);
  /* the board, elected: the official request admitted and offered */
  assert.equal(conditions(board).official_request.state, "admitted");
  assert.ok(purposesOf(board)[0].includes("official_request"));
  /* decorated, the act keeps the purposes it names */
  const d = decorate(acts(clerk).find((a) => a.id === "escalationattach"), null);
  assert.deepEqual(d.purposes, purposesOf(clerk)[0]);
  /* R18, driven: the withheld purpose is refused, an offered one accepted */
  const standards = [w.esc.escalationRead({ id: w.E, viewer: EV("bob") }).standards[0]];
  assert.equal(w.esc.escalationAttach({ id: w.E, action: clerk, purpose: "official_request", standards, reason: "ask the clerk", ...bob }).reason,
    "COUNTERPARTY_NOT_ELECTED");
  const ok = w.esc.escalationAttach({ id: w.E, action: clerk, purpose: "testimony", standards, reason: "testify", ...bob });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  /* attached: withheld, and refused */
  assert.deepEqual(purposesOf(clerk), []);
  assert.equal(w.esc.escalationAttach({ id: w.E, action: clerk, purpose: "testimony", standards, reason: "again", ...bob }).reason,
    "ALREADY_ATTACHED");
  /* the action toStage attached at stage 2: no attachment, at any stage */
  assert.deepEqual(purposesOf(attached), []);
});

test("R52 R16: nothing offered or withheld names an escalation: the facts carry counts and flags, and the acts on an action "
   + "name no escalation id", () => {
  const { w, ask, acts } = escScene();
  toStage(w, 7);
  const clerk = w.action({ project: w.P, restsOn: [w.D], counterparty: { state: "named", ...OFFICE.clerk } });
  assert.equal(JSON.stringify(ask(clerk)).includes(w.E), false);
  assert.equal(JSON.stringify(acts(clerk)).includes(w.E), false);
});

/* action-clocks' world, every module real: the clock acts' facts asked of action-clocks itself. */
const CA = "ACTN-2026-0001-a";
function clockScene() {
  const w = cWorld();
  w.action(CA);
  const facts = affordancesOf(w.host, { record: w.record, membership: w.membership, actions: w.actions, actionClocks: w.c,
    escalation: SILENT, conformance: SILENT, filings: SILENT, actionHolds: SILENT });
  const M = CV("alice");
  const acts = (author = M) => deriveActs(facts.affordanceFacts({ target: CA, viewer: M, identity: M, author, by: "alice" }));
  return { w, M, acts };
}

test("R52 R18: clockadopt is offered once per standing dated proposal action-clocks' read answers, each act naming the key "
   + "clockadopt takes, and accepted by that key; control: with none standing it is not offered (refused "
   + "NO_SUCH_CLOCK_PROPOSAL); an undated proposal is not offered (refused CLOCK_PROPOSAL_UNDETERMINED); an adopted one no "
   + "longer offered", () => {
  const { w, M, acts } = clockScene();
  const adopts = () => acts().filter((a) => a.id === "clockadopt").map((a) => a.proposal);
  assert.deepEqual(adopts(), [], "none standing: not offered");
  assert.equal(w.c.clockAdopt({ target: CA, proposal: "records_answer@nobody", author: M, viewer: M }).reason, "NO_SUCH_CLOCK_PROPOSAL");
  /* undated before anything is sent: standing, but not offered */
  const u = w.c.clockPropose({ target: CA, rule: "records_answer", proposer: CV("bob"), viewer: CV("bob") });
  assert.equal(w.c.clockProposalsFor({ action: CA, viewer: M }).proposals.length, 1);
  assert.deepEqual(adopts(), [], "undated: not offered");
  assert.equal(w.c.clockAdopt({ target: CA, proposal: u.proposal.key, author: M, viewer: M }).reason, "CLOCK_PROPOSAL_UNDETERMINED");
  assert.equal(w.actions.actionCorrespond({ target: CA, direction: "sent", at: "2026-09-01", account: "sent", viewer: M, author: M }).ok, true);
  const p = w.c.clockPropose({ target: CA, rule: "records_answer", proposer: CMACHINE, viewer: CMACHINE });
  assert.deepEqual(adopts(), [p.proposal.key], "dated: offered, naming its key");
  const d = decorate(acts().find((a) => a.id === "clockadopt"), null);
  assert.equal(d.proposal, p.proposal.key);
  assert.equal(w.c.clockAdopt({ target: CA, proposal: p.proposal.key, author: M, viewer: M }).ok, true);
  assert.deepEqual(adopts(), [], "adopted: no longer standing");
  assert.equal(w.c.clockAdopt({ target: CA, proposal: p.proposal.key, author: M, viewer: M }).reason, "NO_SUCH_CLOCK_PROPOSAL");
});

test("R52 R10 R20: a machine is not offered clockadopt, which action-clocks refuses it with the code MACHINE_REFUSALS names "
   + "(MACHINE_CANNOT_ADOPT_CLOCK)", () => {
  const { w, M, acts } = clockScene();
  assert.equal(w.actions.actionCorrespond({ target: CA, direction: "sent", at: "2026-09-01", account: "sent", viewer: M, author: M }).ok, true);
  const p = w.c.clockPropose({ target: CA, rule: "records_answer", proposer: CMACHINE, viewer: CMACHINE });
  assert.ok(acts().some((a) => a.id === "clockadopt"), "a member is offered it");
  assert.ok(!acts(CMACHINE).some((a) => a.id === "clockadopt"), "a machine is not");
  assert.equal(MACHINE_REFUSALS.clockadopt, "MACHINE_CANNOT_ADOPT_CLOCK");
  assert.equal(w.c.clockAdopt({ target: CA, proposal: p.proposal.key, author: CMACHINE, viewer: M }).reason, "MACHINE_CANNOT_ADOPT_CLOCK");
});

test("R52 R18: filingsent is offered only on an approved draft filings answers second_needed: false — a draft still waiting "
   + "for a second approval offers no send (refused SECOND_APPROVAL_NEEDED) until the second approval is recorded, then it is "
   + "offered and accepted; control: with no setting naming the act, one approval offers the send", async () => {
  const x = fWorld();
  const f = x.filingsWith();
  const facts = affordancesOf(x.host, { record: x.record, membership: x.membership, actions: x.actions, filings: f,
    escalation: SILENT, conformance: SILENT, actionClocks: SILENT, actionHolds: SILENT });
  const BO = FV("bo");
  const offered = (id) => deriveActs(facts.affordanceFacts({ target: id, viewer: BO, identity: BO, author: BO, by: "bo" })).map((a) => a.id);
  const prep = (action, text) => f.filingPrepare({ action, text, preparer: BO, viewer: BO, language: "en" }).id;
  const send = (id) => f.filingRecordSent({ filing: id, at: "2026-09-29", account: "handed in", author: BO, viewer: BO });
  /* control: no setting names the act */
  const A = x.action();
  const d0 = prep(A, "One.");
  assert.ok(!offered(A).includes("filingsent"), "not approved: no send");
  await f.filingApprove({ filing: d0, author: BO, viewer: BO });
  assert.ok(offered(A).includes("filingsent"), "approved, needing nothing more: offered");
  assert.equal(send(d0).ok, true);
  assert.ok(!offered(A).includes("filingsent"), "sent: no second send");
  /* the project asks a second approval of the kind */
  const roster = projectRosterOf(x.host, { record: x.record });
  roster.migrate();
  assert.equal(roster.projectApprovalSet({ projectId: x.proj, needs: [{ kind: "bylaw_complaint" }], reason: "two eyes",
    by: "olive", viewer: FV("olive") }).ok, true);
  const B = x.action();
  const d = prep(B, "Two.");
  await f.filingApprove({ filing: d, author: BO, viewer: BO });
  assert.equal(f.filingsFor({ action: B, viewer: BO }).drafts.find((r) => r.filing === d).second_needed, true);
  assert.ok(!offered(B).includes("filingsent"), "waiting for a second approval: no send");
  assert.equal(send(d).reason, "SECOND_APPROVAL_NEEDED");
  assert.equal(f.filingSecondApprove({ filing: d, author: FV("cy"), viewer: FV("cy") }).ok, true);
  assert.ok(offered(B).includes("filingsent"), "seconded: offered");
  assert.equal(send(d).ok, true);
});
