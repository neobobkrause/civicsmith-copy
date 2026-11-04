/* affordances: R19's backing for every op T33 grades `reasoned` (op-grades R13), each driven at its owning module's own interface
   over that module's own fixture: called well-formed but without its authored account (reason, note, cause, evidence,
   purpose or basis), it is refused with its owner's code, which is in JUSTIFICATION_REFUSALS; called with it, it is
   accepted. The last test holds the list driven here to the ops `t33.mjs` grades `reasoned`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JUSTIFICATION_REFUSALS, RUNGS } from "../../../src/op-grades/index.mjs";
import { T33_RUNGS } from "../../../src/op-grades/t33.mjs";

/* Each op driven below, by its owner, is recorded as it is driven; the last test holds the ops driven to those `t33.mjs` grades
   `reasoned`, so no list of them is held here and a new `reasoned` op in the table that no test drives is seen. */
const DRIVEN = new Set();

/* The backing of one op: graded `reasoned`; without its account refused with `code`, in the family; with it accepted. */
function backed(op, code, refused, accepted) {
  DRIVEN.add(op);
  assert.equal(RUNGS[op], "reasoned", op);
  const r = refused;
  const got = r?.code ?? r?.reason;
  assert.notEqual(r?.ok, true, `${op}: accepted without its account: ${JSON.stringify(r).slice(0, 300)}`);
  assert.equal(got, code, `${op}: ${JSON.stringify(r).slice(0, 300)}`);
  assert.ok(JUSTIFICATION_REFUSALS.includes(got), `${op}: ${got} is not in JUSTIFICATION_REFUSALS`);
  assert.equal(accepted?.ok, true, `${op}: refused with its account: ${JSON.stringify(accepted).slice(0, 300)}`);
}

/* ---- events (R13, R14, R20) ---- */
import * as evFix from "../events/fixture.mjs";

test("R19: events' participantcorrect, eventmerge, eventsplit and eventrelationwithdraw, graded `reasoned` (op-grades R13), are "
   + "refused without their reason with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const M = evFix.MEMBER, doc = { kind: "document" };
  /* participantcorrect */
  {
    const w = evFix.world();
    const a = w.entity("Xan"), b = w.entity("Yolanda");
    w.event({ value: "2026-02-02", participants: [{ entityId: a, role: "mover", attestation: 0 }] });
    const pid = w.rows(`SELECT participant_id FROM event_participants`)[0].participant_id;
    const call = (x) => w.ev.correctParticipant({ participantId: pid, entityId: b, by: M, ...x });
    backed("participantcorrect", "NO_REASON", call({}), call({ reason: "the minutes name Yolanda" }));
  }
  /* eventmerge */
  {
    const w = evFix.world();
    const keep = w.event({ value: "2026-03-03" }), absorb = w.event({ value: "2026-03-02" });
    const call = (x) => w.ev.mergeEvents({ keep: keep.event_id, absorb: absorb.event_id, by: M, ...x });
    backed("eventmerge", "NO_REASON", call({}), call({ reason: "one meeting, two notices" }));
  }
  /* eventsplit */
  {
    const w = evFix.world();
    const keep = w.event({ value: "2026-03-03" }), absorb = w.event({ value: "2026-03-02" });
    assert.equal(w.ev.mergeEvents({ keep: keep.event_id, absorb: absorb.event_id, reason: "one meeting", by: M }).ok, true);
    const v = w.ev.readEvent({ eventId: keep.event_id, viewer: M }).event;
    const call = (x) => w.ev.splitEvent({ eventId: keep.event_id, attestations: [v.attestations[1].attestation_id], by: M, ...x });
    backed("eventsplit", "NO_REASON", call({}), call({ reason: "two meetings after all" }));
  }
  /* eventrelationwithdraw */
  {
    const w = evFix.world();
    const a = w.event({ value: "2026-04-01" }).event_id, b = w.event({ value: "2026-04-02" }).event_id;
    const s = w.capture("t33-r20");
    const id = w.ev.relate({ from: a, to: b, kind: "amends", attestation: { captureSha: s, extent: doc }, by: M }).relation.relation_id;
    const call = (x) => w.ev.withdrawRelation({ relationId: id, by: M, ...x });
    backed("eventrelationwithdraw", "NO_REASON", call({}), call({ reason: "it amends another" }));
  }
});

/* ---- lines (R8) ---- */
import * as lnFix from "../lines/fixture.mjs";

test("R19: lines' linewithdraw, graded `reasoned` (op-grades R13), is refused without its reason with a code in "
   + "JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const w = lnFix.world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master");
  const h = w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" } });
  const call = (x) => w.l.withdrawLine({ lineId: h, by: lnFix.ANN, ...x });
  backed("linewithdraw", "NO_REASON", call({}), call({ reason: "the source was misread" }));
});

/* ---- money (R7, R12) ---- */
import * as mnFix from "../money/fixture.mjs";

test("R19: money's moneywithdraw, moneysetinclude and moneysetexclude, graded `reasoned` (op-grades R13), are refused without "
   + "their reason with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const A = mnFix.ANN;
  {
    const s = mnFix.seeded();
    const id = s.rec();
    const call = (x) => s.m.withdrawFact({ factId: id, by: A, ...x });
    backed("moneywithdraw", "NO_REASON", call({}), call({ reason: "the page was misread" }));
  }
  for (const [op, act] of [["moneysetinclude", "include"], ["moneysetexclude", "exclude"]]) {
    const s = mnFix.seeded();
    const set = s.m.createSet({ purpose: "trail", label: "harbour money trail", by: A }).set_id;
    const f = s.rec();
    const call = (x) => s.m[act]({ setId: set, factId: f, by: A, ...x });
    backed(op, "NO_REASON", call({}), call({ reason: "follows the transfer" }));
  }
});

/* ---- duties (R6, R12, R13): DUTY_NO_REASON since duties' re-key (N608; K1805) ---- */
import * as duFix from "../duties/fixture.mjs";

test("R19: duties' dutyrevise, dutywithdraw, dutymatch and dutytransition, graded `reasoned` (op-grades R13), are refused without "
   + "their reason (or, for a transition, its cause) with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const B = duFix.BOB, ZONE = duFix.ZONE, E = duFix.E;
  {
    const w = duFix.world();
    const a = w.declare({ trigger: { kind: "recurrence", rrule: "FREQ=MONTHLY;BYMONTHDAY=1", dtstart: "2026-01-01" }, time: { basis: "commitment" } });
    const call = (x) => w.duties.revise({ dutyId: a.duty_id, performance: { act: "post the minutes" }, by: B, ...x });
    backed("dutyrevise", "DUTY_NO_REASON", call({}), call({ reason: "the clause says minutes" }));
  }
  {
    const w = duFix.world();
    const a = w.declare({ trigger: { kind: "recurrence", rrule: "FREQ=MONTHLY;BYMONTHDAY=1", dtstart: "2026-01-01" }, time: { basis: "commitment" } });
    const call = (x) => w.duties.withdraw({ dutyId: a.duty_id, by: B, ...x });
    backed("dutywithdraw", "DUTY_NO_REASON", call({}), call({ reason: "repealed by the council" }));
  }
  {
    const w = duFix.world();
    const day = (v) => ({ value: v, precision: "day", zone: ZONE });
    const req1 = w.event({ value: day("2026-02-02"), concerns: [E.clerk] });
    const resp1 = w.event({ value: day("2026-02-10"), concerns: [E.group] });
    const id = w.declare({ trigger: { kind: "event", event_kind: "communication", entity: E.clerk } }).duty_id;
    const occ = w.duties.occurrencesOf({ dutyId: id, asOf: "2026-03-09T12:00:00Z", from: "2026-01-01", to: "2026-03-31", viewer: B });
    const k = occ.occurrences.find((o) => o.trigger.ref === req1).key;
    const call = (x) => w.duties.matchEvent({ dutyId: id, occurrenceKey: k, eventId: resp1, by: B, ...x });
    backed("dutymatch", "DUTY_NO_REASON", call({}), call({ reason: "the response" }));
  }
  {
    const w = duFix.world();
    const a = w.declare({ trigger: { kind: "date", date: "2026-02-02" } });
    const key = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: "2026-03-02T00:00:00Z", viewer: B }).occurrences[0].key;
    const call = (x) => w.duties.recordTransition({ dutyId: a.duty_id, occurrenceKey: key, state: "met", asOf: "2026-03-01T00:00:00Z", by: B, ...x });
    backed("dutytransition", "NO_CAUSE", call({}), call({ cause: "the clerk's letter of 10 February" }));
  }
});

/* ---- people (R1, R4, R11, R12, R20, R21) ---- */
import * as ppFix from "../people/fixture.mjs";

test("R19: people's identityclaim, identitywithdraw, personfactwithdraw, personexpunge, membertie, membertiewithdraw and "
   + "sourcepersonlink, graded `reasoned` (op-grades R13; membertie is op-grades' R47 `reversible`, read not pinned), are refused without their reason, note or evidence with a code in "
   + "JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const A = ppFix.ANN, doc = ppFix.doc;
  const valid = { from: "2020-01-01", to: "2030-12-31", precision: "day", zone: "America/Los_Angeles" };
  {
    const w = ppFix.world();
    const p = w.person("Ola Berg"), q = w.person("Ola Berg");
    const call = (x) => w.p.claimIdentity({ a: p, b: q, kind: "same_as", basis: "testimony", by: A, ...x });
    backed("identityclaim", "NO_NOTE", call({}), call({ note: "the same signature on both" }));
  }
  {
    const w = ppFix.world();
    const p = w.person("Ola Berg"), q = w.person("Ola Berg");
    const c = w.p.claimIdentity({ a: p, b: q, kind: "same_as", basis: "testimony", note: "n", by: A });
    assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
    const call = (x) => w.p.withdrawIdentityClaim({ claimId: c.claim_id, by: A, ...x });
    backed("identitywithdraw", "NO_REASON", call({}), call({ reason: "wrong filer" }));
  }
  {
    const w = ppFix.world();
    const p = w.person("Lea Ng");
    const f = w.p.recordPersonFact({ person: p, kind: "birth", value: "1970-01-01", valid, citation: doc(w.capture("c")), by: A });
    const call = (x) => w.p.withdrawPersonFact({ factId: f.fact_id, by: A, ...x });
    backed("personfactwithdraw", "NO_REASON", call({}), call({ reason: "misread the year" }));
  }
  {
    const w = ppFix.world();
    const p = w.person("Ola Berg");
    const fact = w.p.recordPersonFact({ person: p, kind: "address", value: "9 Hill Rd", valid, citation: doc(w.capture("c")), by: A });
    const call = (x) => w.p.expunge({ id: fact.fact_id, ground: "unlawful", by: ppFix.BOSS, ...x });
    backed("personexpunge", "NO_REASON", call({}), call({ reason: "held unlawfully" }));
  }
  {
    /* membertie's grade is op-grades' (R47: `reversible`, its withdrawal takes it back), read here and never pinned; its note is
       people R20's shape, not a reason, so it is accepted with or without a reason and is taken back by membertiewithdraw */
    const w = ppFix.world();
    const co = w.entity("institution", "Harbour Co");
    const t = w.p.declareTie({ entity: co, kind: "employer", attribution: "cover", note: "I worked there 2019", by: A });
    assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
    assert.equal(RUNGS.membertie, T33_RUNGS.membertie);
    assert.notEqual(RUNGS.membertie, "reasoned");
    assert.equal(RUNGS.membertiewithdraw, "reasoned");
  }
  {
    const w = ppFix.world();
    const aunt = w.person("Pat Lee");
    const t = w.p.declareTie({ entity: aunt, kind: "relative", note: "my aunt", attribution: "group", by: A });
    assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
    const call = (x) => w.p.withdrawTie({ tieId: t.tie_id, by: A, ...x });
    backed("membertiewithdraw", "NO_REASON", call({}), call({ reason: "she moved away" }));
  }
  {
    const w = ppFix.world();
    const p = w.person("Quinn Roe");
    w.S.add("SRC-2026-1234abcd");
    const call = (x) => w.p.linkSourceToPerson({ source: "SRC-2026-1234abcd", person: p, sight: ["member:ann"], by: A, ...x });
    backed("sourcepersonlink", "NO_EVIDENCE", call({}), call({ evidence: "the same handwriting" }));
  }
});

/* ---- hypotheses (R2): HYPOTHESIS_NO_REASON (R43; K1807) ---- */
import * as hyFix from "../hypotheses/fixture.mjs";

test("R19: hypotheses' hypothesisrevise and hypothesiswithdraw, graded `reasoned` (op-grades R13), are refused without their "
   + "reason with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const A = hyFix.ANN;
  {
    const w = hyFix.world();
    w.bundle(hyFix.INQ);
    const id = w.hold();
    const call = (x) => w.h.revise({ hypothesisId: id, statement: "They act together, through E3.", by: A, ...x });
    backed("hypothesisrevise", "HYPOTHESIS_NO_REASON", call({}), call({ reason: "A new filing." }));
  }
  {
    const w = hyFix.world();
    w.bundle(hyFix.INQ);
    const id = w.hold();
    const call = (x) => w.h.withdraw({ hypothesisId: id, by: A, ...x });
    backed("hypothesiswithdraw", "HYPOTHESIS_NO_REASON", call({}), call({ reason: "The filing was misread." }));
  }
});

/* ---- calculations (R14) ---- */
import * as clFix from "../calculations/fixture.mjs";

test("R19: calculations' moneyingest, graded `reasoned` (op-grades R13), is refused for every row of a binding without its reason "
   + "with a code in JUSTIFICATION_REFUSALS, and accepted with it; named rows ask no reason", async () => {
  const w = clFix.seeded();
  const B = clFix.V("bob");
  const t = await w.table("payer,payee,amount\nP001,P002,5\n", [{ name: "payer", type: "string" }, { name: "payee", type: "string" }, { name: "amount", type: "number" }],
    { roles: { payer: { role: "payer", scheme: "ellery_person" }, payee: { role: "payee", scheme: "ellery_person" }, amount: { role: "amount" } } });
  w.person("Pat Quill", "P001");
  w.person("Lee Quill", "P002");
  const b = w.c.adoptBinding({ table: t.sha, roles: { amount: "amount", payer: "payer", payee: "payee", kind: { value: "payment" }, phase: { value: "actual" },
    stage: { value: "paid" }, basis: { value: "cash" }, currency: { value: "USD" }, period: { value: "2025-07-01/2026-06-30" } }, by: B });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  const call = (x) => w.c.ingestMoney({ binding: b.binding, rows: "all", by: B, ...x });
  backed("moneyingest", "NO_REASON", await call({}), await call({ reason: "the whole ledger is the request's subject" }));
  /* named rows ask none */
  const named = await w.c.ingestMoney({ binding: b.binding, rows: [0], by: B });
  assert.equal(named.ok, true, JSON.stringify(named).slice(0, 300));
  assert.notEqual(named.reason, "NO_REASON");
});

/* ---- workbooks (R3, R9, R10) ---- */
import * as wbFix from "../workbooks/fixture.mjs";

test("R19: workbooks' workbookunbind, workbooklintexplain and workbookmethodnote, graded `reasoned` (op-grades R13), are refused "
   + "without their reason, note or purpose with a code in JUSTIFICATION_REFUSALS, and accepted with it", async () => {
  const B = wbFix.V("bob");
  {
    const book = wbFix.xlsx([
      { name: "Model", cells: {
        A1: { s: "item" }, B1: { s: "amount" },
        A2: { s: "rent" }, B2: { n: "1200.50" }, A3: { s: "power" }, B3: { n: "300" }, A4: { s: "water" }, B4: { n: "99.5" },
        B5: { f: "SUM(B2:B4)", v: "1600" }, D1: { s: `tag ${Math.random()}` } } },
    ]);
    const w = await wbFix.seeded({}, book);
    const t = await w.table([["amount", "number"], ["note", "string"]], [["1200.50", "a"], ["300", "b"], ["99.5", "c"]]);
    const bound = await w.wb.bind({ ...w.at, range: "Model!B2:B4", input: { table: t, range: "A1:A3" }, by: B });
    assert.equal(bound.ok, true, JSON.stringify(bound).slice(0, 300));
    const call = (x) => w.wb.unbind({ bindingId: bound.binding.binding_id, by: B, ...x });
    backed("workbookunbind", "NO_REASON", await call({}), await call({ reason: "the wrong year's table" }));
  }
  {
    const w = await wbFix.seeded();
    const finding = { kind: "constant_in_formula", cell: "Model!B6" };
    const call = (x) => w.wb.explainLint({ ...w.at, finding, by: B, ...x });
    backed("workbooklintexplain", "NO_NOTE", await call({}), await call({ note: "the 10% markup the council adopted" }));
  }
  {
    const w = await wbFix.seeded();
    const NOTE = { sources: ["the FY2025 adopted budget", "the census"], steps: "Sum the three lines; divide by residents.",
                   limitations: "One year; the census is a 2020 count." };
    const call = (x) => w.wb.recordMethodNote({ ...w.at, ...NOTE, by: B, ...x });
    backed("workbookmethodnote", "NO_PURPOSE", await call({}), await call({ purpose: "The cost of the service per resident." }));
  }
});

/* ---- standards (R23, R26, R27) ---- */
import * as stFix from "../standards/fixture.mjs";

test("R19: standards' lawrelate, lawwithdraw, courtlink and courttreat, graded `reasoned` (op-grades R13), are refused without "
   + "their reason with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const B = stFix.V("bob"), REASON = stFix.REASON, who = { author: B, viewer: B };
  const two = (w) => {
    const at = w.passage().contentId, bt = w.passage().contentId;
    const a = w.declare({ cite: "PEBL § 10", text: [at], portion: { path: "10(a)", content_id: at } }).id;
    const b = w.declare({ cite: "PEBL § 20", text: [bt], portion: { path: "20(b)", content_id: bt } }).id;
    return { a, b, at };
  };
  {
    const w = stFix.seeded();
    const { a, b, at } = two(w);
    const call = (x) => w.s.lawRelate({ type: "amends", from: { standard: a, portion: "10(a)" }, to: { standard: b, portion: "20(b)" },
                                        citation: at, effective: "2021-01-01", ...who, ...x });
    backed("lawrelate", "STANDARD_NO_REASON", call({}), call({ reason: REASON }));
  }
  {
    const w = stFix.seeded();
    const { a, b, at } = two(w);
    const rel = w.s.lawRelate({ type: "refers_to", from: a, to: b, citation: at, reason: REASON, ...who });
    assert.equal(rel.ok, true, JSON.stringify(rel).slice(0, 300));
    const call = (x) => w.s.lawWithdraw({ relation: rel.relation.id, author: B, ...x });
    backed("lawwithdraw", "STANDARD_NO_REASON", call({}), call({ reason: "It cites the wrong section." }));
  }
  {
    const w = stFix.seeded();
    const ct = w.passage().contentId, st = w.passage().contentId;
    const court = w.declare({ cite: "12 Marlow 340", kind: "court", issuer: "Marlow Court", text: [ct] }).id;
    const statute = w.declare({ text: [st], portion: { path: "12(a)", content_id: st } }).id;
    const call = (x) => w.s.courtLink({ type: "interprets", from: court, to: { standard: statute, portion: "12(a)" }, citation: ct, ...who, ...x });
    backed("courtlink", "STANDARD_NO_REASON", call({}), call({ reason: REASON }));
  }
  {
    const w = stFix.seeded();
    const d = (cite, from) => { const t = w.passage().contentId; return { id: w.declare({ cite, kind: "court", issuer: "Court", text: [t], period: { from, to: null } }).id, t }; };
    const lower = d("1 Marlow 1", "2010-05-01"), affirm = d("4 Marlow 4", "2011-01-01");
    const call = (x) => w.s.courtTreat({ decision: lower.id, treatment: "affirmed", by_decision: affirm.id, citation: affirm.t, ...who, ...x });
    backed("courttreat", "STANDARD_NO_REASON", call({}), call({ reason: REASON }));
  }
});

/* ---- entities (R43) ---- */
import * as enFix from "../entities/fixture.mjs";

test("R19: entities' entityidentify (addIdentifier), graded `reasoned` (op-grades R13), is refused by a member without its basis "
   + "with a code in JUSTIFICATION_REFUSALS, and accepted with it", () => {
  const w = enFix.world({ profiles: ["test-port-ellery"] });
  const pat = w.e.createEntity({ note: "a subject the test registers", kind: "person", label: "Pat Quill" }).entity_id;
  const call = (x) => w.e.addIdentifier({ entityId: pat, scheme: "marlow_bar", id: "bar 12345", by: "member:ann", ...x });
  backed("entityidentify", "NO_BASIS", call({}), call({ basis: "the bar's published roll" }));
});

/* ---- ai-runs (run-rules R19) ----
   (T53; notice credentials:74; K5457, `ai-accounts` R35) ai-runs' published fixture (`../ai-runs/world.mjs`) connects each
   member's account through `accountReferenceSet`, which `ai-accounts` R35 retired, and builds its accounts with no catalogue,
   so no run opens through it on this tranche. Re-pointing it is ai-runs' (its fixture, its job); until it lands, this drive is
   owed, named to BOB, and `airunverify` is the one T33 `reasoned` op the list below finds undriven. */
const OWED_PROVIDER_FIXTURE = ["airunverify"];
test.todo("R19: ai-runs' airunverify (verificationRecord), graded `reasoned` (op-grades R13), is refused without the verifying "
   + "member's evidence with a code in JUSTIFICATION_REFUSALS, and accepted with it (owed: ai-runs' fixture after ai-accounts R35)");

/* ---- the list ---- */
test("R19: every op T33 grades (op-grades R13) `reasoned` is driven here", () => {
  const graded = Object.keys(T33_RUNGS).filter((op) => T33_RUNGS[op] === "reasoned").sort();
  assert.deepEqual([...DRIVEN, ...OWED_PROVIDER_FIXTURE].sort(), graded);
  assert.deepEqual(OWED_PROVIDER_FIXTURE.filter((op) => DRIVEN.has(op)), [], "an owed drive that is driven leaves the owed list");
});
