/* The rule services (R7–R12), at the interface, over the real owners: standards, the active profile, civil-time,
   events, entities, lines, people, duties and calculations. Each answer is labelled (R6), recorded in the read log of
   the grant it was asked under, and writes nothing. They are built switched off (K1505 (14), K1603). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, V, R } from "./fixture.mjs";
import { RULE_SERVICE_NAMES, ANSWERS_CHECKS, answersOps } from "../../../src/answers/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const BOB = V("bob");
const T = { statement: "I attended the swearing-in" };
const keys = (r) => Object.keys(r).sort();

test("R7 ruleAnswer answers {ok, service, value, basis, grade, status, label, as_of} or {ok, not_held: {level, reason, act}}; recorded in the grant's read log; non-mutating; never throws", async () => {
  const w = answersWorld();
  const id = w.standard({ from: "2020-01-01", to: null });
  const before = w.snapshot();
  const r = await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB, at: "2026-05-01T00:00:00Z" });
  for (const k of ["ok", "service", "value", "basis", "grade", "status", "label", "as_of"]) assert.ok(k in r, k);
  assert.equal(r.as_of, "2026-05-01T00:00:00Z");
  const none = await w.a.ruleAnswer({ service: "standard", args: { id: "STD-2026-0999-none" }, viewer: BOB });
  assert.deepEqual(keys(none), ["not_held", "ok", "service"]);
  assert.deepEqual(keys(none.not_held), ["act", "level", "reason"]);
  assert.equal(none.not_held.level, "document"); assert.equal(none.not_held.act, "standardpropose");
  const unknown = await w.a.ruleAnswer({ service: "astrology", args: {}, viewer: BOB });
  assert.equal(unknown.code, "RULE_SERVICE_UNKNOWN"); assert.equal(unknown.check, ANSWERS_CHECKS.RULE_SERVICE_UNKNOWN.check);
  assert.equal((await w.a.ruleAnswer({ service: "toString", viewer: BOB })).code, "RULE_SERVICE_UNKNOWN");
  /* now when `at` is absent */
  assert.equal((await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB })).as_of, w.clock.now);
  /* a service that throws answers not_held with its reason */
  w.a.registerRuleService("thrower", () => { throw new Error("the register is down"); });
  const t = await w.a.ruleAnswer({ service: "thrower", args: {}, viewer: BOB });
  assert.equal(t.ok, true); assert.match(t.not_held.reason, /the register is down/);
  assert.deepEqual(w.snapshot(), before, "a rule answer writes nothing");
  /* recorded in the read log of the grant it was asked under, under a rule_id */
  const g = await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB, grant: "g1" });
  assert.match(g.rule_id, /^rule:\d+$/);
  assert.deepEqual(w.a.readLog("g1").rule(g.rule_id), g);
  assert.equal(w.a.readLog("g2").rule(g.rule_id), null);
});

test("R7 the rule services are built switched off (K1505 (14)): while off every service refuses RULE_SERVICES_OFF; only an administrator switches them", async () => {
  const w = answersWorld({ rules: false });
  const off = await w.a.ruleAnswer({ service: "profiles", args: { section: "time_zone" }, viewer: BOB });
  assert.equal(off.code, "RULE_SERVICES_OFF"); assert.equal(off.translation, ANSWERS_CHECKS.RULE_SERVICES_OFF.translation);
  assert.equal(w.a.ruleServicesSwitch({ on: true, by: BOB }).reason, "NOT_AN_ADMIN");
  assert.equal(w.a.ruleServicesSwitch({ on: true, by: V("alice") }).ok, true);
  assert.equal((await w.a.ruleAnswer({ service: "profiles", args: { section: "time_zone" }, viewer: BOB })).ok, true);
});

test("R8 law: a held standard with its captured text, version and portion (legal_information, its limits); in force at a date; a profile fact with citation and status, a venue's standard of proof included; an unsourced rule is not held", async () => {
  const w = answersWorld();
  const id = w.standard({ from: "2020-01-01", to: "2025-12-31" });
  const s = await w.a.ruleAnswer({ service: "standard", args: { id }, viewer: BOB });
  assert.equal(s.label, "legal_information");
  assert.equal(s.value.id, id); assert.ok(s.value.texts.length && s.value.texts[0].text);
  assert.ok("version" in s.value && "portion" in s.value);
  assert.equal(s.limits.reading_of, "held_text"); assert.equal(s.quote_only, false);
  const inF = await w.a.ruleAnswer({ service: "standardinforce", args: { standard: id, date: "2024-06-01" }, viewer: BOB });
  assert.equal(inF.value.state, "in_force"); assert.equal(inF.label, "computed_fact");
  const out = await w.a.ruleAnswer({ service: "standardinforce", args: { standard: id, date: "2026-06-01" }, viewer: BOB });
  assert.equal(out.value.state, "not_in_force"); assert.ok(out.value.why);
  const dl = await w.a.ruleAnswer({ service: "profiles", args: { section: "deadlines", key: "records_answer" }, viewer: BOB });
  assert.equal(dl.label, "procedural_fact"); assert.equal(dl.value.citation, "Test Stat. § 1.140"); assert.equal(dl.status, "researched");
  assert.ok("horizon" in dl.value);
  const proof = await w.a.ruleAnswer({ service: "profiles", args: { section: "action_kinds", key: "commitment_claim" }, viewer: BOB });
  assert.match(proof.value.standard_of_proof.standard, /Rule 9\.02/);
  assert.equal((await w.a.ruleAnswer({ service: "profiles", args: { section: "deadlines", key: "nothing" }, viewer: BOB })).not_held.level, "meaning");
  /* K1445: a rule without a primary source, or UNMEASURED, is not held */
  const view = combine(["test-port-ellery"]).view;
  const bare = { ...view, deadlines: [{ ...view.deadlines[0], citation: undefined }, { ...view.deadlines[1], basis: "UNMEASURED" }],
                 counterparties: [{ role: "clerk", body: "the town", level: "city", elected: false, basis: "UNMEASURED" }] };
  const u = answersWorld({ deps: { combine: () => ({ ok: true, view: bare }) } });
  for (const args of [{ section: "deadlines", key: view.deadlines[0].rule }, { section: "deadlines", key: view.deadlines[1].rule },
                      { section: "counterparties", key: "clerk" }]) {
    const r = await u.a.ruleAnswer({ service: "profiles", args, viewer: BOB });
    assert.match(r.not_held.reason, /primary source/, JSON.stringify(args));
  }
  assert.match((await u.a.ruleAnswer({ service: "deadlinecompute", args: { rule: view.deadlines[0].rule, start: "2026-03-02" }, viewer: BOB }))
    .not_held.reason, /primary source/);
});

test("R9 time: a due date from the profile rule over the start event's date, by civil-time; an uncertain date answers both candidates, the group's own deadline the earliest and a body overdue only after the latest", async () => {
  const w = answersWorld();
  const ev = w.event("meeting", "2026-03-02");
  const d = await w.a.ruleAnswer({ service: "deadlinecompute", args: { rule: "records_answer", start: ev.eventId }, viewer: BOB });
  assert.equal(d.label, "computed_fact");
  assert.equal(d.value.citation, "Test Stat. § 1.140");
  assert.ok(d.value.due && d.value.due.value, JSON.stringify(d.value));
  assert.equal(d.value.due.zone, "America/Halifax");
  assert.ok(d.value.trace);
  /* a month period landing on a day the target month lacks (K1504 (4)) */
  const u = await w.a.ruleAnswer({ service: "deadlinecompute", viewer: BOB,
    args: { rule: "appeal_window", start: { value: "2025-12-31", precision: "day", zone: "America/Halifax" } } });
  const c = u.value.due.candidates;
  assert.equal(c.length, 2);
  assert.deepEqual(u.value.group_deadline, c[0]); assert.deepEqual(u.value.body_overdue_after, c[1]);
  /* a start event with no date: undetermined with why, never a default */
  assert.equal((await w.a.ruleAnswer({ service: "deadlinecompute", args: { rule: "records_answer", start: "EVT-2026-zzzzzzzzzzzzzzzz" }, viewer: BOB })).not_held.level, "meaning");
  /* derived on each ask, never stored */
  const before = w.snapshot();
  await w.a.ruleAnswer({ service: "deadlinecompute", args: { rule: "records_answer", start: ev.eventId }, viewer: BOB });
  assert.deepEqual(w.snapshot(), before);
});

test("R10 organisations and people answer as their owners answer, with grade and basis; a holder is never inferred from a line its owner does not hold", async () => {
  const w = answersWorld();
  const office = w.entity("The Town Clerk", "office");
  const pat = w.person("Pat Example");
  const e = await w.a.ruleAnswer({ service: "entities", args: { id: office }, viewer: BOB });
  assert.equal(e.value.entity.entity_id ?? e.value.entity_id ?? e.value.entity?.id, office, JSON.stringify(e.value).slice(0, 200));
  assert.equal((await w.a.ruleAnswer({ service: "entities", args: { alias: "The Town Clerk" }, viewer: BOB })).value.count, 1);
  assert.ok((await w.a.ruleAnswer({ service: "entities", args: { id: "ENT-2026-9999" }, viewer: BOB })).not_held);
  /* no line held: undetermined as lines answers it, never a holder by default */
  const none = await w.a.ruleAnswer({ service: "holderAt", args: { office, at: "2024-06-01" }, viewer: BOB });
  assert.equal(none.value.holder ?? null, null); assert.equal(none.status, "undetermined");
  const l = w.lines.recordLine({ kind: "holds", from: pat, to: office, capacity: "elected",
                                 valid: { from: "2020-01-01", to: "2024-12-31" }, basis: T, by: BOB });
  assert.equal(l.ok, true, JSON.stringify(l));
  const h = await w.a.ruleAnswer({ service: "holderAt", args: { office, at: "2024-06-01" }, viewer: BOB });
  assert.equal(h.value.holder, pat); assert.equal(h.grade, "D"); assert.equal(h.basis.statement, T.statement); assert.equal(h.label, "computed_fact");
  const ln = await w.a.ruleAnswer({ service: "lines", args: { entity: office }, viewer: BOB });
  assert.equal(ln.value.lines.length, 1);
  const career = await w.a.ruleAnswer({ service: "careerOf", args: { entity: pat }, viewer: BOB });
  assert.equal(career.ok, true); assert.ok(JSON.stringify(career.value).includes(office));
  const duty = w.duty({ obligor: office });
  const ds = await w.a.ruleAnswer({ service: "duties", args: { entity: office }, viewer: BOB });
  assert.ok(JSON.stringify(ds.value).includes(duty.dutyId));
  const occ = await w.a.ruleAnswer({ service: "occurrences", args: { duty: duty.dutyId, asOf: "2026-06-01T00:00:00Z" }, viewer: BOB });
  assert.equal(occ.value.occurrences[0].key, duty.key);
});

test("R11 figures: evaluate runs a recipe through calculations without persisting it, its result with its denominator, computed_fact; a compare is never worded as a breach", async () => {
  const w = answersWorld();
  const before = w.snapshot();
  const ratio = await w.a.ruleAnswer({ service: "evaluate", viewer: BOB, args: {
    inputs: [{ name: "a", value: "300" }, { name: "b", value: "1,200" }],
    recipe: R([{ op: "ratio", numerator: "a", denominator: "b", as: "r" }], "r", [{ name: "a", kind: "figure" }, { name: "b", kind: "figure" }]) } });
  assert.equal(ratio.label, "computed_fact");
  assert.equal(ratio.value.results.output.denominator.value, "1200", JSON.stringify(ratio.value).slice(0, 300));
  const cmp = await w.a.ruleAnswer({ service: "evaluate", viewer: BOB, args: {
    inputs: [{ name: "a", value: "300" }, { name: "b", value: "250" }],
    recipe: R([{ op: "compare", a: "a", b: "b", as: "c" }], "c", [{ name: "a", kind: "figure" }, { name: "b", kind: "figure" }]) } });
  assert.equal(cmp.value.results.output.relation, "higher");
  assert.doesNotMatch(JSON.stringify(cmp), /breach|violation/i);
  assert.deepEqual(w.snapshot(), before, "nothing persisted");
});

test("R12 registerRuleService takes a later module's service once per name; a name held or built in is refused RULE_SERVICE_EXISTS and the first stays; it answers through R7", async () => {
  const w = answersWorld();
  const fn = ({ parcel }) => ({ value: { parcel, zoned: "residential" }, basis: "the zoning map", grade: "B", status: "held", label: "procedural_fact" });
  assert.deepEqual(w.a.registerRuleService("zoning", fn), { ok: true, service: "zoning" });
  const again = w.a.registerRuleService("zoning", () => ({ value: "other" }));
  assert.equal(again.code, "RULE_SERVICE_EXISTS"); assert.equal(again.check, ANSWERS_CHECKS.RULE_SERVICE_EXISTS.check);
  for (const name of RULE_SERVICE_NAMES) assert.equal(w.a.registerRuleService(name, fn).code, "RULE_SERVICE_EXISTS", name);
  assert.equal(w.a.registerRuleService("bad", "not a function").reason, "LISTENER_MALFORMED");
  const r = await w.a.ruleAnswer({ service: "zoning", args: { parcel: "P-1" }, viewer: BOB, grant: "g" });
  assert.deepEqual(r.value, { parcel: "P-1", zoned: "residential" });
  assert.equal(r.label, "procedural_fact");
  assert.ok(w.a.readLog("g").rule(r.rule_id));
  assert.deepEqual(RULE_SERVICE_NAMES, ["standard", "standardinforce", "profiles", "deadlinecompute", "entities", "lines", "holderAt",
                                        "careerOf", "duties", "occurrences", "evaluate"]);
});

test("R7 ruleservicesstate answers {ok: true, on} to any signed-in member: off on a fresh record (K1505 (14)), on after the administrator's switch, off again when switched off; writes nothing", () => {
  const w = answersWorld({ rules: false });
  const url = (viewer) => new URL(`https://plane.test/?${new URLSearchParams({ viewer })}`);
  const before = w.snapshot();
  assert.deepEqual(answersOps(w.a, url(BOB), {}).ruleservicesstate(), { ok: true, on: false });
  assert.deepEqual(answersOps(w.a, url(V("alice")), {}).ruleservicesstate(), { ok: true, on: false });
  assert.deepEqual(w.snapshot(), before, "the state read writes nothing");
  /* a member's switch is refused and the state stays off; the administrator's turns it on */
  assert.equal(answersOps(w.a, url(BOB), { on: true }).ruleservicesswitch().reason, "NOT_AN_ADMIN");
  assert.deepEqual(answersOps(w.a, url(BOB), {}).ruleservicesstate(), { ok: true, on: false });
  assert.equal(answersOps(w.a, url(V("alice")), { on: true }).ruleservicesswitch().ok, true);
  assert.deepEqual(answersOps(w.a, url(BOB), {}).ruleservicesstate(), { ok: true, on: true });
  assert.equal(answersOps(w.a, url(V("alice")), { on: false }).ruleservicesswitch().ok, true);
  assert.deepEqual(answersOps(w.a, url(BOB), {}).ruleservicesstate(), { ok: true, on: false });
});
