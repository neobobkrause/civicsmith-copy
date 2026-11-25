/* action-clocks' T45 entries at its interface (T45-28; N882; Actions D15; `BIO_Action_v0_2.md` rule 6): R2's start from
   a recorded receipt or service and its governing view; R3's `owed_by`, `due_at`, `steps` and `noticed_by`, and no
   body's date while no reply is owed; R7's `stated` kind; R16 one date, one reminder, over the real `steps`; R17 a
   duty's Noticed item; R18 who owes an entry, the member's statement of one (`clockState`) and `ourDeadlines`. On the
   test profile and variants of it; instance clock 2026-09-28T12:00Z, zone America/Halifax (UTC−3). Receipts and
   service are recorded through the real `action-records.actionReceipt` (its R4, was `actions` R80; T47, N961) and read
   through `actions.actionRead`; `duties` (R17) is a stand-in answering
   `dutiesOf` and `occurrencesOf` in `duties` R7's and R9's shapes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, actionMd, CP, CLK } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import * as actions from "../../../src/actions/index.mjs";
import { get, combine } from "../../../../jurisdictions/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { icsText } from "../../../src/action-clocks/ics.mjs";

const M = V("alice"), BOB = V("bob");
const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b", C = "ACTN-2026-0003-c";
const key = (x) => `${x.action}:${x.ord}`;
const rowOf = (code) => clocks.ACTION_CLOCK_CHECKS[code];
/* One clock entry with its own keys. */
const E = (date, extra = [], status = "pending") => [`  - text: "t"`, '    description: "d"', `    date: ${date}`, "    basis: Act s.2",
  `    status: ${status}`, ...extra];

/* The test profile with records_answer owed by the group, a records-request rule counted from service, and the
   registry answer 3 business days due at the close of business. */
function variant() {
  const p = structuredClone(get("test-port-ellery"));
  p.deadlines = p.deadlines.map((d) => (d.rule === "records_answer" ? { ...d, owed_by: "group" }
    : d.rule === "registry_answer" ? { ...d, amount: 3 } : d));
  const base = p.deadlines.find((d) => d.rule === "filing_reply");
  p.deadlines.push({ ...structuredClone(base), rule: "records_served", applies_to: "records_request", units: "days", amount: 10,
                     count: "calendar", direction: "forward", starts: "served", owed_by: "body", roll: undefined,
                     closures: undefined });
  p.deadlines = p.deadlines.map((d) => JSON.parse(JSON.stringify(d)));
  assert.equal(combine([p]).ok, true, JSON.stringify(combine([p]).errors || []).slice(0, 400));
  return p;
}
/* action-records R4 (was actions R80; N961): a member records a receipt or service on the sent entry at `ord`. */
const receipt = (w, target, ord, kind, at, extra = {}) =>
  assert.equal(w.records().actionReceipt({ target, ord, kind, at, how: "the clerk's stamp", account: "seen by me", viewer: M, author: M, ...extra }).ok, true);
const sent = (w, id, at) => assert.equal(w.actions.actionCorrespond({ target: id, direction: "sent", at, account: "sent", viewer: M, author: M }).ok, true);

test("R2 (T45) a received rule counts from the receipt actions records when one is held, saying so in its trace; with none, from the first sent entry, saying \"receipt not recorded: counted from sending\"", () => {
  const w = world();
  w.action(A);
  sent(w, A, "2026-09-01");
  const P = () => w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal;
  /* control: no receipt held: counted from sending (Tue 1 Sept: 5 business days on 'town', Sunday the weekend: Mon 7). */
  const s = P();
  assert.deepEqual([s.entry.date, s.start, s.start_from, s.start_note, s.trace.start_from, s.trace.start_note],
    ["2026-09-07", "2026-09-01", "sent", word("action-clocks.note.receipt_recorded_counted"), "sent", word("action-clocks.note.receipt_recorded_counted")]);
  /* a receipt recorded on the sent entry (Thu 3 Sept): counted from it, the trace saying so; the latest record (the last, action-records R4) governs. */
  receipt(w, A, 0, "receipt", "2026-09-02");
  receipt(w, A, 0, "receipt", "2026-09-03T09:30");
  assert.equal(w.actions.actionRead({ id: A, viewer: M }).receipts.length, 2, "actions' read answers both");
  const r = P();
  assert.deepEqual([r.entry.date, r.start, r.start_from, r.start_note, r.trace.start_from], ["2026-09-09", "2026-09-03", "receipt", undefined, "receipt"]);
  /* a service record is not a receipt; a receipt on another entry is not the first sending's. */
  w.action(B);
  sent(w, B, "2026-09-01"); sent(w, B, "2026-09-02");
  receipt(w, B, 0, "service", "2026-09-03", { party: "the clerk" });
  receipt(w, B, 1, "receipt", "2026-09-03");
  assert.equal(w.c.clockPropose({ target: B, rule: "records_answer", proposer: M, viewer: M }).proposal.start_from, "sent");
  /* the stored proposal keeps which event it counted from. */
  assert.deepEqual([A, B].map((id) => JSON.parse(w.rows(`SELECT trace_json FROM action_clock_proposals WHERE bundle_id=?`, id)[0].trace_json).start_from),
    ["receipt", "sent"]);
});

test("R2 (T45) a served rule counts from the recorded service on that party, and reads undetermined, with why, when none is held", () => {
  const w = world({ override: { "test-port-ellery": variant() } });
  w.action(A);
  sent(w, A, "2026-09-01");
  const P = () => w.c.clockPropose({ target: A, rule: "records_served", proposer: M, viewer: M }).proposal;
  /* control: no service held: undetermined, never counted from sending. */
  const u = P();
  assert.equal(u.entry.date, null); assert.equal(u.undetermined, word("action-clocks.why.service_group_papers"));
  receipt(w, A, 0, "receipt", "2026-09-02");
  assert.equal(P().entry.date, null, "a receipt is not a service");
  receipt(w, A, 0, "service", "2026-09-04", { party: "the Town Clerk" });
  const s = P();
  assert.deepEqual([s.entry.date, s.start, s.start_from], ["2026-09-14", "2026-09-04", "service"]);
});

test("R2 (T45) the deadlines read are local-facts.governingView's, so a group's confirmed rule governs; with none it equals combine's; a proposal carries owed_by from the deadline's, undetermined where the profile does not say", () => {
  const w = world({ override: { "test-port-ellery": variant() } });
  w.action(A);
  sent(w, A, "2026-09-01");
  /* control: no group rule: the governing view is combine's, and the profile's rules apply. */
  assert.deepEqual(w.localFacts.governingView().view.deadlines, combine([variant()]).view.deadlines);
  const g = w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M });
  assert.deepEqual([g.proposal.entry.owed_by, g.proposal.entry.date], ["group", "2026-09-07"], "the profile's owed_by");
  assert.equal(w.c.clockPropose({ target: A, rule: "records_served", proposer: M, viewer: M }).proposal.entry.owed_by, "body");
  assert.equal(w.c.clockPropose({ target: A, rule: "group_rule", proposer: M, viewer: M }).reason, "NO_SUCH_RULE");
  /* a group's confirmed rule, as governingView answers it (local-facts R12), governs here. */
  const held = w.localFacts.governingView.bind(w.localFacts);
  w.localFacts.governingView = () => {
    const v = held();
    const base = v.view.deadlines.find((d) => d.rule === "records_answer");
    const { owed_by, ...rest } = base;
    return { ...v, view: { ...v.view, deadlines: [...v.view.deadlines, { ...rest, rule: "group_rule", amount: 2, count: "calendar",
      closures: undefined, observed: undefined, profile: "group", basis: "2026-09-20 GR-1" }] } };
  };
  try {
    const p = w.c.clockPropose({ target: A, rule: "group_rule", proposer: M, viewer: M });
    assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
    assert.deepEqual([p.proposal.entry.date, p.proposal.entry.owed_by], ["2026-09-03", "undetermined"], "a rule that does not say whose: undetermined");
    assert.match(p.proposal.entry.basis, /GR-1/);
  } finally { w.localFacts.governingView = held; }
});

test("R18 R13 an adopted entry carries owed_by: the proposal's, or the one the member states; a value outside CLOCK_OWED_BY is CLOCK_ENTRY_REFUSED and nothing is written; R3 a count due at a time of day keeps its due_at and zone", () => {
  const w = world({ override: { "test-port-ellery": variant() } });
  w.action(A);
  sent(w, A, "2026-09-01");
  const key = w.c.clockPropose({ target: A, rule: "records_answer", proposer: MACHINE, viewer: MACHINE }).proposal.key;
  const doc = w.text(A);
  const bad = w.c.clockAdopt({ target: A, proposal: key, owed_by: "us", author: M, viewer: M });
  assert.deepEqual([bad.reason, bad.code, bad.check, bad.arm, bad.translation], ["CLOCK_ENTRY_REFUSED", "CLOCK_ENTRY_REFUSED", "C-123.8", "owed_by",
    rowOf("CLOCK_ENTRY_REFUSED").translation]);
  assert.equal(w.text(A), doc, "nothing written");
  assert.equal(w.c.clockAdopt({ target: A, proposal: key, date: "2026-02-30", author: M, viewer: M }).arm, "date", "R13's amended date, its arm named");
  assert.equal(w.c.clockAdopt({ target: A, proposal: key, author: M, viewer: M }).ok, true);
  assert.equal(w.fm(A).clock[0].owed_by, "group", "the proposal's");
  w.c.clockPropose({ target: A, rule: "records_answer", proposer: MACHINE, viewer: MACHINE });
  const r = w.c.clockAdopt({ target: A, proposal: key, owed_by: "body", author: M, viewer: M });
  assert.deepEqual([r.ok, w.fm(A).clock[1].owed_by, w.fm(A).clock[1].amended], [true, "body", undefined], "the member's, which is no amendment of the date");
  /* due at the close of business (the Town Clerk's Friday close, 12:00; civil-time R14): adopted with its time and zone. */
  const C2 = "ACTN-2026-0009-c";
  w.action(C2, ["counterparty:", "  state: named", "  role: Town Clerk", "  body: City of Port Ellery", "action_kind: commitment_claim"]);
  sent(w, C2, "2026-09-01");
  const p = w.c.clockPropose({ target: C2, rule: "registry_answer", proposer: M, viewer: M });
  assert.deepEqual([p.proposal.entry.date, p.proposal.due.value], ["2026-09-04", "2026-09-04T12:00"]);
  assert.equal(w.c.clockAdopt({ target: C2, proposal: p.proposal.key, author: M, viewer: M }).ok, true);
  const e = w.fm(C2).clock[0];
  assert.deepEqual([e.due_at, e.due_zone, e.owed_by], ["2026-09-04T12:00", "America/Halifax", "undetermined"]);
  const item = w.c.overdueClocks({ viewer: M }).items.find((x) => x.action === C2);
  assert.deepEqual([item.due_at, item.due_zone, item.owed_by], ["2026-09-04T12:00", "America/Halifax", "undetermined"]);
  /* control: an entry stating no time answers both null. */
  const a0 = w.c.overdueClocks({ viewer: M, now: Date.parse("2026-10-01T12:00:00Z") }).items.find((x) => x.action === A);
  assert.deepEqual([a0.due_at, a0.due_zone], [null, null]);
});

test("R18 clockState: a member states an entry in one act through the action's revision, with its basis, owed_by (unstated: undetermined, written as such) and kind's fields; refusals in order MACHINE_CANNOT_STATE_CLOCK, NO_SUCH_ACTION, CLOCK_ENTRY_REFUSED naming the arm, NO_SUCH_STANDARD; nothing written by a refusal", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-09-01")]);
  const doc = w.text(A);
  const S = (x) => w.c.clockState({ target: A, text: "file our reply", description: "the group's reply to the registry", date: "2026-10-10",
    basis: "Registry rule 4", basis_kind: "rule", owed_by: "group", author: M, viewer: M, ...x });
  for (const author of [MACHINE, "token:ai", "", null, undefined]) {
    const r = S({ author, target: "ACTN-2026-0404-x" });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "MACHINE_CANNOT_STATE_CLOCK", "MACHINE_CANNOT_STATE_CLOCK", "C-123.7",
      rowOf("MACHINE_CANNOT_STATE_CLOCK").translation], String(author));
  }
  assert.deepEqual(S({ target: "ACTN-2026-0404-x", date: "soon" }), actions.noSuchAction("ACTN-2026-0404-x"));
  assert.deepEqual(S({ viewer: "nobody" }), actions.noSuchAction(A), "invisible as absent");
  const arm = (x) => { const r = S(x); assert.deepEqual([r.reason, r.check], ["CLOCK_ENTRY_REFUSED", "C-123.8"], JSON.stringify(x)); return r.arm; };
  assert.equal(arm({ text: "" }), "text");
  assert.equal(arm({ description: "x".repeat(501) }), "description");
  assert.equal(arm({ basis: null }), "basis");
  for (const date of ["soon", "2026-02-30", null]) assert.equal(arm({ date }), "date");
  for (const basis_kind of ["law", null, ""]) assert.equal(arm({ basis_kind }), "basis_kind");
  assert.equal(arm({ owed_by: "us" }), "owed_by");
  assert.equal(arm({ basis_kind: "stated", held_in: "a letter" }), "stated_by", "a stated date names who stated it");
  assert.equal(arm({ basis_kind: "stated", stated_by: "the clerk" }), "held_in", "and where it is held");
  assert.equal(arm({ basis_kind: "dependency" }), "precedes");
  assert.equal(arm({ committed_by: "the clerk" }), "committed_by", "a field of another kind");
  assert.equal(arm({ due_at: "2026-10-11T12:00" }), "due_at", "a time on another day");
  assert.equal(arm({ due_at: "2026-10-10T12:00", due_zone: "Nowhere/Atall" }), "due_zone");
  assert.equal(arm({ due_zone: "America/Halifax" }), "due_zone", "a zone with no time");
  assert.equal(S({ standard: "STD-2026-0404-statute" }).reason, "NO_SUCH_STANDARD");
  assert.equal(w.text(A), doc, "no refusal touched the document");
  /* the act: appended after the held entry, the rest of the document as it was. */
  const r = S({ due_at: "2026-10-10T17:00", due_zone: "America/Halifax" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const e = w.fm(A).clock[1];
  assert.deepEqual([r.ord, e.text, e.date, e.basis, e.status, e.basis_kind, e.owed_by, e.due_at, e.due_zone, e.entered_by, e.entered_at],
    [1, "file our reply", "2026-10-10", "Registry rule 4", "pending", "rule", "group", "2026-10-10T17:00", "America/Halifax", M, "2026-09-28T12:00:00Z"]);
  assert.deepEqual(w.fm(A).clock[0], { text: "t", description: "d", date: "2026-09-01", basis: "Act s.2", status: "pending" });
  /* unstated owed_by is written undetermined, never a side. */
  assert.equal(S({ owed_by: null, date: "2026-10-12" }).ok, true);
  assert.equal(w.fm(A).clock[2].owed_by, "undetermined");
  /* through the op: the stamps from the query, never the body's. */
  const op = (qs, body) => clocks.actionClocksOps(w.c, new URL(`https://x/?${qs}`), body).clockstate();
  const body = { target: A, text: "t2", description: "d2", date: "2026-10-20", basis: "b", basis_kind: "window", owed_by: "group", author: M };
  assert.equal(op(`viewer=${M}`, body).reason, "MACHINE_CANNOT_STATE_CLOCK");
  assert.deepEqual([op(`author=${M}&viewer=${M}`, body).ok, w.fm(A).clock[3].basis_kind], [true, "window"]);
});

test("R7 (T45) a fifth basis kind, stated: a deadline the other side stated, naming who and where it is held, never presented as a legal deadline; a rule entry keeps its citation words; BASIS_KINDS exported frozen", () => {
  assert.deepEqual(clocks.BASIS_KINDS, ["rule", "commitment", "dependency", "window", "stated"]);
  assert.ok(Object.isFrozen(clocks.BASIS_KINDS) && Object.isFrozen(clocks.CLOCK_OWED_BY));
  assert.deepEqual(clocks.CLOCK_OWED_BY, ["group", "body", "undetermined"]);
  const w = world();
  w.action(A);
  assert.equal(w.c.clockState({ target: A, text: "records by 1 Sept", description: "the clerk's own date", date: "2026-09-01",
    basis: "the clerk's letter", basis_kind: "stated", stated_by: "the Town Clerk", held_in: "correspondence 0", author: M, viewer: M }).ok, true);
  assert.equal(w.c.clockState({ target: A, text: "answer due", description: "the statute's period", date: "2026-09-02",
    basis: "Test Stat. § 1.140", basis_kind: "rule", author: M, viewer: M }).ok, true);
  const by = Object.fromEntries(w.c.overdueClocks({ viewer: M }).items.map((x) => [x.ord, x.basis_of]));
  assert.deepEqual(by[0], { kind: "stated", citation: "the clerk's letter", stated_by: "the Town Clerk", held_in: "correspondence 0",
                            says: word("action-clocks.says.date_side_stated") });
  assert.deepEqual(by[1], { kind: "rule", citation: "Test Stat. § 1.140" }, "a rule keeps its citation words");
  const ics = w.c.clocksIcs({ actions: [A], viewer: M }).ics.replace(/\r\n /g, "");
  assert.ok(ics.includes(icsText(word("action-clocks.basis_date_stated", { stated_by: "the Town Clerk", held_in: localize("action-clocks.index.held_in_place", ", held in {place}", { place: "correspondence 0" }), cite: ": the clerk's letter" }))));
  /* the stated entry's words name who stated it and no law. */
  const words = JSON.stringify(by[0]) + ics.split("BEGIN:VEVENT")[1];
  for (const x of [/\blaw\b/i, /\brule\b/i, /\blegal\b/i, /statut/i]) assert.ok(!x.test(words), String(x));
  /* R2 never proposes one: a proposal's kind is rule. */
  sent(w, A, "2026-09-01");
  assert.equal(w.c.clockPropose({ target: A, rule: "records_answer", proposer: M, viewer: M }).proposal.entry.basis_kind, "rule");
});

test("R3 (T45) each item carries owed_by and says it is a question about a date, naming no failure; while the action states reply_owed: false no entry owed_by: body is listed (control: reply_owed absent lists it)", () => {
  const w = world();
  const entries = ["clock:", ...E("2026-09-01", ["    owed_by: body"]), ...E("2026-09-02", ["    owed_by: group"]), ...E("2026-09-03")];
  w.action(A, [...entries, "reply_owed: false"], { extra: { replay: true } });
  w.action(B, entries);
  const items = w.c.overdueClocks({ viewer: M }).items;
  assert.deepEqual(items.map((x) => [key(x), x.owed_by]), [[`${A}:1`, "group"], [`${A}:2`, "undetermined"],
    [`${B}:0`, "body"], [`${B}:1`, "group"], [`${B}:2`, "undetermined"]]);
  assert.equal(w.fm(A).reply_owed, false);
  for (const x of items) assert.equal(x.says, clocks.OVERDUE_SAYS);
  assert.ok(!/fail|violat|breach|noncompli|unlawful/i.test(JSON.stringify(items)), "no word of a finding");
});

test("R18 ourDeadlines lists the pending entries owed_by: group of visible open actions, with basis, date, zone, project and creator, paged as R1; an entry owed_by body or undetermined is never listed", () => {
  const w = world();
  w.action(A, ["clock:", ...E("2026-09-01", ["    owed_by: group"]), ...E("2026-09-02", ["    owed_by: body"]), ...E("2026-09-03"),
               ...E("2026-12-01", ["    owed_by: group"]), ...E("2026-09-04", ["    owed_by: group"], "met")]);
  w.action(B, ["clock:", ...E("2026-10-01", ["    owed_by: group"])]);
  w.action(C, ["clock:", ...E("2026-10-01", ["    owed_by: group"])]);
  w.actions.actionMove({ target: C, to: "abandoned", reason: "dropped", viewer: M, author: M });
  const r = w.c.ourDeadlines({ viewer: M });
  assert.deepEqual(r.items.map(key), [`${A}:0`, `${A}:3`, `${B}:0`], "only pending, owed by the group, of open actions");
  assert.deepEqual(r.items[0], { action: A, ord: 0, date: "2026-09-01", basis: "Act s.2", text: "t", basis_of: { kind: null, citation: "Act s.2" },
    owed_by: "group", zone: "America/Halifax", local_day: "2026-09-28", past: true, due_at: null, due_zone: null, project: null, created_by: M });
  assert.deepEqual([r.limit, r.actions_limit, r.truncated, r.cursor], [500, 500, false, null]);
  assert.deepEqual(w.c.ourDeadlines({ viewer: M, from: "2026-10-01", to: "2026-12-31" }).items.map(key), [`${A}:3`, `${B}:0`]);
  const p1 = w.c.ourDeadlines({ viewer: M, limit: 2 });
  assert.deepEqual([p1.items.map(key), p1.truncated, p1.cursor], [[`${A}:0`, `${A}:3`], true, `${A}#3`]);
  assert.deepEqual(w.c.ourDeadlines({ viewer: M, limit: 2, after: p1.cursor }).items.map(key), [`${B}:0`]);
  assert.equal(w.c.ourDeadlines({ viewer: "nobody" }).items.length, 0);
  assert.equal(w.c.ourDeadlines({ viewer: M, from: "soon" }).reason, "OUR_DEADLINES_REFUSED");
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM action_reminders`)[0].n, 0, "no reminder minted");
});

test("R16 a step and a clock entry stand for each other when the step is tied to the action (its product, or an arrival wait on it) and dated the entry's day: steps' due holder holds it, clockForStep answers the entry, R3's and R5's items name the step; controls: another date, or an untied step, stands for nothing", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-09-01"), ...CLK("2026-12-01")]);
  const mk = (date) => { const s = w.steps.stepCreate({ place: { group: true }, work: `ask the clerk ${date} ${Math.random()}`, byWhen: { date, basis: "own" }, by: M }); assert.equal(s.ok, true); return s.step; };
  const tied = mk("2026-09-01"), waits = mk("2026-12-01"), other = mk("2026-09-02"), loose = mk("2026-09-01");
  assert.equal(w.steps.stepProduct({ step: tied, record: A, by: M }).ok, true);
  assert.equal(w.steps.stepProduct({ step: other, record: A, by: M }).ok, true);
  assert.equal(w.steps.stepWait({ step: waits, on: { arrival: { kind: "records_request", id: A } }, by: M }).ok, true);
  const held = (s) => w.steps.step({ step: s, viewer: M }).by_when_held;
  assert.deepEqual(held(tied), { module: "action-clocks", entry: { action: A, position: 0 } }, "as its product");
  assert.deepEqual(held(waits), { module: "action-clocks", entry: { action: A, position: 1 } }, "by an arrival wait on it");
  assert.deepEqual([held(other), held(loose)], [null, null], "controls");
  assert.deepEqual(w.c.clockForStep({ step: tied, viewer: M }), { action: A, entry: 0, date: "2026-09-01", basis: "Act s.2" });
  assert.deepEqual(w.c.clockForStep({ step: waits, viewer: M }), { action: A, entry: 1, date: "2026-12-01", basis: "Act s.2" });
  for (const s of [other, loose, "STP-2026-nonesuchnonesuch", null]) assert.equal(w.c.clockForStep({ step: s, viewer: M }), null, String(s));
  assert.equal(w.c.clockForStep({ step: tied, viewer: "nobody" }), null, "not visible");
  /* R3 and R5 items carry the steps standing for the entry. */
  assert.deepEqual(w.c.overdueClocks({ viewer: M }).items.map((x) => [x.ord, x.steps]), [[0, [tied]]]);
  w.c.reminderSet({ target: A, entry: 0, on: "2026-09-20", author: M, viewer: M });
  assert.deepEqual(w.c.remindersDue({ viewer: M }).items.map((x) => x.steps), [[tied]]);
  /* one date, one item: steps' own due list leaves the held step out, and keeps the untied one. */
  const due = w.steps.stepsDue({ viewer: M, at: "2026-09-28T12:00:00Z" });
  const dueIds = JSON.stringify(due);
  assert.ok(!dueIds.includes(tied) && dueIds.includes(loose), dueIds.slice(0, 400));
  /* more than one pending entry that day: none stands. */
  w.promote(A, w.text(A).replace("clock:", ["clock:", ...CLK("2026-09-01", "pending", "second")].join("\n")));
  assert.equal(held(tied), null);
  assert.equal(w.c.clockForStep({ step: tied, viewer: M }), null);
  /* writes nothing; never throws on any input. */
  for (const x of [undefined, null, {}, { step: 3, byWhen: "x", waits: 7 }]) assert.equal(w.c.stepDueHolder(x), null);
});

test("R16 (K2823) where the action is not visible to every viewer of the step's place, the holder answers {entry: \"clock\"}, held and unnamed; a step placed in the action's own project names it", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-09-01")]);
  const s = w.steps.stepCreate({ place: { group: true }, work: "ask the clerk", byWhen: { date: "2026-09-01", basis: "own" }, by: M });
  assert.equal(w.steps.stepProduct({ step: s.step, record: A, by: M }).ok, true);
  assert.deepEqual(w.c.stepDueHolder({ step: s.step, byWhen: { date: "2026-09-01" }, waits: [] }), { entry: { action: A, position: 0 } });
  /* the action now belongs to a project (record-core R34's column): a group-placed step's viewers do not all see it. */
  w.st.sql.exec(`UPDATE bundles SET project='PROJ-2026-0001' WHERE bundle_id=?`, A);
  assert.deepEqual(w.c.stepDueHolder({ step: s.step, byWhen: { date: "2026-09-01" }, waits: [] }), { entry: "clock" });
  /* a step placed in that project: every viewer of its place sees the action. */
  w.st.sql.exec(`UPDATE steps SET place_kind='project', project_id='PROJ-2026-0001' WHERE step_id=?`, s.step);
  assert.deepEqual(w.c.stepDueHolder({ step: s.step, byWhen: { date: "2026-09-01" }, waits: [] }), { entry: { action: A, position: 0 } });
});

/* A duties stand-in answering duties R7's `dutiesOf` and R9's `occurrencesOf` shapes: `duties` maps an obligor entity to
   its adopted duties, each `{duty_id, withdrawn, occurrences: [{key, trigger: {ref}, due: {date}}]}`. */
function dutiesStandIn(duties) {
  const asked = [];
  return { asked, dutiesOf: ({ entity }) => ({ ok: true, entity, as: "obligor", duties: (duties[entity] || []).map(({ occurrences, ...d }) => d), truncated: false }),
           occurrencesOf: (a) => { asked.push(a); const d = Object.values(duties).flat().find((x) => x.duty_id === a.dutyId);
                                   return { ok: true, duty_id: a.dutyId, occurrences: d ? d.occurrences : [] }; } };
}

test("R17 an adopted duty's Noticed item replaces the clock's overdue item: R3's item carries noticed_by when a duty of the addressee office has an occurrence triggered by this action's own sending whose due date, or a candidate of it, is the entry's date; controls: no duty adopted, or triggered by another action, and noticed_by is absent", () => {
  const w = world();
  const cp = ["counterparty:", "  state: named", "  role: Town Clerk", "  body: City of Port Ellery", "  entity_id: ENT-2026-0007", "action_kind: records_request"];
  w.action(A, [...cp, "clock:", ...CLK("2026-09-10"), ...CLK("2026-09-11")], { extra: { replay: true } });
  w.action(B, [...cp, "clock:", ...CLK("2026-09-10")], { extra: { replay: true } });
  sent(w, A, "2026-09-01"); sent(w, B, "2026-09-01");
  const occ = (ref, due) => ({ key: `OCC-${"a".repeat(31)}${ref.length % 10}`, trigger: { kind: "source", ref, date: "2026-09-01" }, due: { date: due } });
  const lf = dutiesStandIn({ "ENT-2026-0007": [
    { duty_id: "DUT-2026-0001", withdrawn: null, occurrences: [occ(`${A}#correspondence/0`, { value: "2026-09-10", precision: "day", zone: "America/Halifax" })] },
    { duty_id: "DUT-2026-0002", withdrawn: null, occurrences: [occ(`${A}#correspondence/0`, { candidates: [{ value: "2026-09-09" }, { value: "2026-09-11" }] })] },
    { duty_id: "DUT-2026-0003", withdrawn: { at: "x" }, occurrences: [occ(`${B}#correspondence/0`, { value: "2026-09-10" })] }] });
  /* control: no duty adopted (none held): noticed_by absent. */
  const none = w.c.overdueClocks({ viewer: M }).items;
  assert.ok(none.length === 3 && none.every((x) => !("noticed_by" in x)));
  /* the stand-in replaces this host's duties */
  Object.defineProperty(w.c, "duties", { value: lf, configurable: true });
  const items = Object.fromEntries(w.c.overdueClocks({ viewer: M }).items.map((x) => [key(x), x.noticed_by]));
  assert.deepEqual(items[`${A}:0`], { duty: "DUT-2026-0001", occurrence: occ(`${A}#correspondence/0`, null).key });
  assert.deepEqual(items[`${A}:1`], { duty: "DUT-2026-0002", occurrence: occ(`${A}#correspondence/0`, null).key }, "a candidate of the due date");
  assert.equal(items[`${B}:0`], undefined, "triggered by another action, or withdrawn: absent");
  assert.ok(lf.asked.every((a) => a.viewer === M && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(a.asOf)), "read as the viewer, as of the instance clock");
  /* a duties that throws answers no Noticed item, and the overdue item stands. */
  Object.defineProperty(w.c, "duties", { value: { dutiesOf: () => { throw new Error("x"); } }, configurable: true });
  assert.equal(w.c.overdueClocks({ viewer: M }).items.filter((x) => "noticed_by" in x).length, 0);
});
