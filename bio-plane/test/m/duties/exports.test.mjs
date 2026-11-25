/* duties: T34's exports and readings (R24–R26), the re-keyed codes (R2, R6, R12), the profile's response vocabulary
   (R1, R4), internal reads (R8, R9) and the reader's viewer passed to a trigger source (R16). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, fictionalView, E, BOB, CAROL, MACHINE, ZONE } from "./fixture.mjs";
import { DUTIES_CHECKS, OCCURRENCE_KEY_RE, noSuchDuty, INTERNAL, Duties } from "../../../src/duties/index.mjs";
import { list as profiles, combine } from "../../../../jurisdictions/index.mjs";

const AS_OF = "2026-03-02T12:00:00Z";
const DAEMON = "class:daemon";

test("R2, R6, R12 the member-only, reason and proposal refusals answer this module's own codes, each with its own C-133 row (DEC-49 arm A)", () => {
  const w = world();
  for (const bare of ["MEMBER_ACT_ONLY", "NO_REASON", "NO_SUCH_PROPOSAL"]) assert.equal(DUTIES_CHECKS[bare], undefined, bare);
  const own = { DUTY_MEMBER_ACT_ONLY: "C-133.19", DUTY_NO_REASON: "C-133.21", DUTY_NO_SUCH_PROPOSAL: "C-133.24" };
  for (const [code, check] of Object.entries(own)) assert.equal(DUTIES_CHECKS[code].check, check, code);
  const checks = Object.values(DUTIES_CHECKS).map((r) => r.check);
  assert.equal(new Set(checks).size, checks.length, "one row, one code");
  const seen = (r, code) => assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
    [false, code, code, DUTIES_CHECKS[code].check, DUTIES_CHECKS[code].translation], JSON.stringify(r).slice(0, 200));
  const a = w.declare();
  const key = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: BOB }).occurrences[0].key;
  /* every member's act refuses the machine with the one code (R2, R3, R6, R12, R13) */
  const p = w.duties.propose({ ...w.fields(), by: MACHINE });
  for (const r of [w.duties.adopt({ proposalId: p.proposal_id, clause: "c", by: MACHINE }), w.declare({}, MACHINE),
                   w.duties.revise({ dutyId: a.duty_id, reason: "r", by: MACHINE }), w.duties.withdraw({ dutyId: a.duty_id, reason: "r", by: MACHINE }),
                   w.duties.matchEvent({ dutyId: a.duty_id, occurrenceKey: key, eventId: "EVT-x", reason: "r", by: MACHINE }),
                   w.duties.recordTransition({ dutyId: a.duty_id, occurrenceKey: key, state: "met", asOf: AS_OF, cause: "c", by: MACHINE })])
    seen(r, "DUTY_MEMBER_ACT_ONLY");
  for (const r of [w.duties.revise({ dutyId: a.duty_id, reason: "", by: BOB }), w.duties.withdraw({ dutyId: a.duty_id, by: BOB }),
                   w.duties.matchEvent({ dutyId: a.duty_id, occurrenceKey: key, eventId: "EVT-x", reason: " ", by: BOB })])
    seen(r, "DUTY_NO_REASON");
  seen(w.duties.adopt({ proposalId: 4242, clause: "c", by: BOB }), "DUTY_NO_SUCH_PROPOSAL");
  seen(w.duties.adopt({ clause: "c", by: BOB }), "DUTY_NO_SUCH_PROPOSAL");
});

test("R1, R4 a reported status is checked against the active profiles' response_statuses (jurisdictions R58), read from the held test profile; none held, every one refused", () => {
  const test = profiles().find((p) => p.test);
  const c = combine([test.id]);
  assert.equal(c.ok, true);
  const vocab = c.view.vocabulary.response_statuses.map((x) => x.status);
  assert.ok(vocab.length >= 2);
  const w = world({ view: c.view });
  const extent = w.passage().contentId;
  const d = (status) => w.declare({ time: { basis: "commitment", date: "2026-04-01" }, reported_status: [{ status, extent }] });
  for (const status of vocab) assert.equal(d(status).ok, true, status);
  const off = d("will_implement");
  assert.equal(off.reason, "UNKNOWN_REPORTED_STATUS");
  assert.deepEqual(off.statuses, vocab, "the refusal names the profiles' statuses");
  for (const s of vocab) assert.ok(off.detail.includes(s), s);
  /* a status at the view's top level is no vocabulary: only the profile key counts */
  const top = world({ view: fictionalView({ vocabulary: {}, response_statuses: [{ status: "implemented" }] }) });
  const r = top.declare({ reported_status: [{ status: "implemented", extent: top.passage().contentId }] });
  assert.equal(r.reason, "UNKNOWN_REPORTED_STATUS");
  assert.match(r.detail, /hold no response vocabulary/);
  assert.deepEqual(r.statuses, []);
});

test("R8, R9 an internal read (INTERNAL, the scheduler's consumer) reads the source in force as a member's read does, never undetermined for want of a viewer (N581)", () => {
  const w = world();
  const a = w.declare();
  const member = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: BOB }).occurrences[0];
  const internal = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: INTERNAL }).occurrences[0];
  assert.equal(member.derivation.source_in_force.state, "in_force");
  assert.deepEqual(internal.derivation.source_in_force, member.derivation.source_in_force);
  assert.equal(internal.state, member.state);
  /* the recorded transition carries the same derivation */
  assert.equal(w.duties.recordTransitions({ asOf: AS_OF }).recorded, 1);
  const t = w.duties.transitionsOf({ dutyId: a.duty_id, viewer: BOB }).transitions[0];
  assert.equal(t.evidence.derivation.source_in_force.state, "in_force");
  /* every service duties reads is asked with a viewer it knows: the reader's own, or class:daemon for an internal read */
  const asked = [];
  const spy = (svc) => new Proxy(svc, { get: (o, k) => (typeof o[k] === "function"
    ? (args) => { if (args && "viewer" in args) asked.push([k, args.viewer]); return o[k](args); } : o[k]) });
  let sw = null;   /* the world's own services, wrapped on first use */
  sw = world({ deps: { standards: () => spy(sw.standards), events: () => spy(sw.ev) } });
  sw.event({ value: { value: "2026-02-02", precision: "day", zone: ZONE }, concerns: [E.clerk] });
  const b = sw.declare({ trigger: { kind: "event", event_kind: "communication", entity: E.clerk } });
  asked.length = 0;
  sw.duties.occurrencesOf({ dutyId: b.duty_id, asOf: AS_OF, viewer: INTERNAL });
  sw.duties.recordTransitions({ asOf: AS_OF });
  assert.ok(asked.length >= 2);
  assert.ok(asked.every(([, v]) => v === DAEMON), JSON.stringify(asked));
  asked.length = 0;
  sw.duties.occurrencesOf({ dutyId: b.duty_id, asOf: AS_OF, viewer: CAROL });
  assert.ok(asked.length >= 2 && asked.every(([, v]) => v === CAROL), JSON.stringify(asked));
});

test("R16 a registered source is read with its reader's viewer (the member's own; class:daemon for an internal read), so a source that fences by viewer answers the member's items (N595, K1649)", () => {
  const w = world();
  const calls = [];
  /* a source that fails closed without a known viewer, as actions R67's does */
  w.duties.registerTriggerSource("actions", ({ viewer }) => {
    calls.push(viewer);
    return typeof viewer === "string" && viewer ? [{ ref: "ACT-2026-0001-req", date: "2026-02-02" }] : [];
  });
  const a = w.declare({ trigger: { kind: "source", source: "actions" } });
  assert.equal(w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: CAROL }).occurrences.length, 1);
  assert.equal(calls.at(-1), CAROL);
  assert.equal(w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: INTERNAL }).occurrences.length, 1);
  assert.equal(calls.at(-1), DAEMON);
  assert.equal(w.duties.recordTransitions({ asOf: AS_OF }).recorded, 1, "the scheduler's consumer sees the source's items");
  assert.equal(calls.at(-1), DAEMON);
  /* a match against an occurrence of the source (the act's own derivation) reads it too */
  const key = w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, viewer: BOB }).occurrences[0].key;
  const ev = w.event({ value: { value: "2026-02-05", precision: "day", zone: ZONE }, concerns: [E.group] });
  assert.equal(w.duties.matchEvent({ dutyId: a.duty_id, occurrenceKey: key, eventId: ev, reason: "the reply", by: BOB }).ok, true);
  /* the measured-evidence listener is told the reader too */
  const seen = [];
  w.duties.registerOccurrenceEvidence("calculations", ({ viewer }) => { seen.push(viewer); return []; });
  const b = w.declare({ trigger: { kind: "date", date: "2026-02-02" } });
  w.duties.occurrencesOf({ dutyId: b.duty_id, asOf: AS_OF, viewer: BOB });
  assert.deepEqual(seen, [BOB]);
});

test("R24 OCCURRENCE_KEY_RE is exported frozen, anchored: every key R9 answers matches it, and no other form does", () => {
  assert.ok(Object.isFrozen(OCCURRENCE_KEY_RE));
  assert.equal(OCCURRENCE_KEY_RE.source, "^OCC-[0-9a-f]{32}$");
  assert.equal(OCCURRENCE_KEY_RE.flags, "");
  const w = world();
  w.duties.registerTriggerSource("actions", () => [{ ref: "ACT-2026-0001-req", date: "2026-02-02" }]);
  const keys = [];
  for (const over of [{}, { trigger: { kind: "source", source: "actions" } },
                      { trigger: { kind: "recurrence", rrule: "FREQ=MONTHLY;BYMONTHDAY=1", dtstart: "2026-01-01" }, time: { basis: "commitment" } }]) {
    const a = w.declare(over);
    for (const o of w.duties.occurrencesOf({ dutyId: a.duty_id, asOf: AS_OF, from: "2026-01-01", to: "2026-03-01", viewer: BOB }).occurrences) keys.push(o.key);
  }
  assert.ok(keys.length >= 4);
  for (const k of keys) assert.ok(OCCURRENCE_KEY_RE.test(k), k);
  for (let i = 0; i < 50; i++) assert.ok(OCCURRENCE_KEY_RE.test(Duties.occurrenceKey(`DUT-2026-${i}`, i, "date", String(i))));
  const hex = "0123456789abcdef0123456789abcdef";
  for (const bad of [`OCC-${hex.slice(1)}`, `OCC-${hex}0`, `OCC-${hex.toUpperCase()}`, `occ-${hex}`, ` OCC-${hex}`, `OCC-${hex}\n`,
                     `xOCC-${hex}`, `OCC-${hex.slice(0, 31)}g`, ""])
    assert.equal(OCCURRENCE_KEY_RE.test(bad), false, JSON.stringify(bad));
  assert.equal(OCCURRENCE_KEY_RE.test(`OCC-${hex}`), true);
  /* frozen: lastIndex and the pattern cannot be changed, and repeated tests agree */
  assert.throws(() => { "use strict"; OCCURRENCE_KEY_RE.lastIndex = 5; });
  assert.equal(OCCURRENCE_KEY_RE.test(`OCC-${hex}`), true);
  /* a key of another form names no occurrence */
  const a = w.declare();
  assert.equal(w.duties.matchEvent({ dutyId: a.duty_id, occurrenceKey: `OCC-${hex.toUpperCase()}`, eventId: w.event({ concerns: [E.group] }), reason: "r", by: BOB }).reason,
    "NO_SUCH_OCCURRENCE");
});

test("R25 noSuchDuty is the one answer to 'no duty the caller may see': fixed fields and sentence, extra beside them and never over them, never throws; every read and act answers through it", () => {
  const row = DUTIES_CHECKS.NO_SUCH_DUTY;
  const base = (id) => ({ ok: false, reason: "NO_SUCH_DUTY", code: "NO_SUCH_DUTY", check: row.check, translation: row.translation, duty_id: id,
                          detail: "no obligation you can see answers to that id" });
  assert.deepEqual(noSuchDuty("DUT-2026-0042"), base("DUT-2026-0042"));
  assert.deepEqual(noSuchDuty(), base(null));
  assert.deepEqual(noSuchDuty(null), base(null));
  assert.deepEqual(noSuchDuty("DUT-2026-0042", { step: "S1", plan: "PLN-1" }), { ...base("DUT-2026-0042"), step: "S1", plan: "PLN-1" });
  const hostile = { ok: true, reason: "X", code: "X", check: "C-0", translation: "t", duty_id: "other", detail: "mine", own: 1 };
  assert.deepEqual(noSuchDuty("DUT-2026-0042", hostile), { ...base("DUT-2026-0042"), own: 1 }, "extra never replaces a fixed field");
  const throwing = new Proxy({}, { ownKeys() { throw new Error("boom"); } });
  for (const extra of [throwing, [1, 2], "x", 7, null, undefined]) assert.deepEqual(noSuchDuty("D", extra), base("D"));
  /* every read and act of the module answers the condition through it, absent and invisible alike */
  const w = world();
  const P = w.project("bob");
  const hid = w.declare({ project: P }).duty_id;
  const absent = "DUT-2026-0099";
  for (const id of [absent]) {
    for (const r of [w.duties.revise({ dutyId: id, reason: "r", by: BOB }), w.duties.withdraw({ dutyId: id, reason: "r", by: BOB }),
                     w.duties.matchEvent({ dutyId: id, occurrenceKey: "OCC-x", eventId: w.event({ concerns: [E.group] }), reason: "r", by: BOB }),
                     w.duties.recordTransition({ dutyId: id, occurrenceKey: "OCC-x", state: "met", asOf: AS_OF, cause: "c", by: BOB })])
      assert.deepEqual(r, noSuchDuty(id));
  }
  for (const id of [absent, hid]) {
    assert.deepEqual(w.duties.occurrencesOf({ dutyId: id, asOf: AS_OF, viewer: CAROL }), noSuchDuty(id));
    assert.deepEqual(w.duties.setAgainst({ dutyId: id, viewer: CAROL }), noSuchDuty(id));
  }
  assert.equal(w.sqlRows(`SELECT COUNT(*) AS n FROM duty_matches`)[0].n + w.sqlRows(`SELECT COUNT(*) AS n FROM duty_transitions`)[0].n, 0, "writes nothing");
});

test("R26 onDutyTracked: once per module; told {duty} once after each adoption, declaration, revision and withdrawal, after its transaction; a throwing listener never undoes the act; the notice writes nothing", () => {
  const w = world();
  assert.equal(w.duties.onDutyTracked("", () => {}).reason, "LISTENER_MALFORMED");
  assert.equal(w.duties.onDutyTracked("scheduler", "nope").reason, "LISTENER_MALFORMED");
  const told = [];
  let seenVersion = null;
  assert.equal(w.duties.onDutyTracked("scheduler", (arg) => {
    told.push(arg);
    seenVersion = w.duties.readDuty({ dutyId: arg.duty, viewer: BOB }).duty.version;   /* the act's transaction is whole */
  }).ok, true);
  assert.equal(w.duties.onDutyTracked("scheduler", () => {}).reason, "LISTENER_DECLARED");
  w.duties.onDutyTracked("notice-producers", () => { throw new Error("listener down"); });
  /* a declaration */
  const a = w.declare();
  assert.equal(a.ok, true);
  assert.deepEqual(told, [{ duty: a.duty_id }]);
  /* an adoption; a proposal alone is not tracked and tells nothing */
  const p = w.duties.propose({ ...w.fields(), by: MACHINE });
  assert.equal(told.length, 1);
  const b = w.duties.adopt({ proposalId: p.proposal_id, clause: "c", by: BOB });
  assert.deepEqual(told.at(-1), { duty: b.duty_id });
  /* a revision, seen at its new version */
  assert.equal(w.duties.revise({ dutyId: a.duty_id, performance: { act: "post it" }, reason: "r", by: BOB }).ok, true);
  assert.deepEqual(told.at(-1), { duty: a.duty_id });
  assert.equal(seenVersion, 2);
  /* a withdrawal; the same withdrawal again is no act and tells nothing */
  assert.equal(w.duties.withdraw({ dutyId: b.duty_id, reason: "repealed", by: BOB }).ok, true);
  assert.deepEqual(told.at(-1), { duty: b.duty_id });
  assert.equal(told.length, 4);
  assert.equal(w.duties.withdraw({ dutyId: b.duty_id, reason: "again", by: BOB }).already, true);
  /* refused acts tell nothing */
  w.declare({ modality: "wish" });
  w.duties.revise({ dutyId: a.duty_id, reason: "", by: BOB });
  w.declare({}, MACHINE);
  assert.equal(told.length, 4);
  /* the throwing listener undid nothing, and the notices wrote nothing beyond the acts */
  assert.equal(w.duties.readDuty({ dutyId: b.duty_id, viewer: BOB }).duty.withdrawn.reason, "repealed");
  const quiet = world();
  const q = quiet.declare();
  quiet.duties.revise({ dutyId: q.duty_id, performance: { act: "post it" }, reason: "r", by: BOB });
  const loud = world();
  loud.duties.onDutyTracked("scheduler", () => {});
  const l = loud.declare();
  loud.duties.revise({ dutyId: l.duty_id, performance: { act: "post it" }, reason: "r", by: BOB });
  const all = (x) => ["duties", "duty_versions", "duty_proposals", "duty_transitions", "duty_matches"].map((t) => x.sqlRows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n).join();
  assert.equal(all(loud), all(quiet), "a listener adds no row");
});
