/* people's interest checks at its interface: R22–R25 (K1491, K1473; gate K1504 M-C8, K1505 (8)). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN, OUT, BOSS, MACHINE, PRESET_PERSONS } from "./fixture.mjs";
import { SHIPPED_CHECKS, GATE_RATE_MAX, HINT_MARK, peopleOps } from "../../../src/people/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const span = (from, to) => ({ from, to });
const RD = { from: { line: "holds", sector: "government" }, to: { line: "holds" }, join: { lines: ["oversees", "contracts_with"] }, order: { after: true, within_days: 730 }, hops: 0 };

/* The revolving door: P held a government office that oversees a company, then held a post at the company within two
   years; R held the same office, and the company post nine years later; S a post at the company only. */
function door(w, { fenced = false } = {}) {
  const office = w.entity("office", "Harbour Commissioner"), co = w.entity("institution", "Quay Ltd");
  const p = w.person("Uma Vance"), r = w.person("Vic Wu"), s = w.person("Wes Xu");
  w.line("holds", p, office, span("2010-01-01", "2015-12-31"));
  w.line("holds", p, co, span("2016-06-01", "2018-01-01"), { fenced });
  w.line("holds", r, office, span("2010-01-01", "2015-12-31"));
  w.line("holds", r, co, span("2024-06-01", "2025-01-01"));
  w.line("holds", s, co, span("2016-06-01", "2018-01-01"));
  const over = w.line("oversees", office, co, span("2000-01-01", "2030-01-01"));
  return { office, co, p, r, s, over };
}
const shipped = (w) => w.p.listChecks({ viewer: ANN }).checks.find((c) => c.machine && c.name === "revolving door");

test("R22 a check (CHK-) is data-defined: line kinds, event roles or money kinds at each end, a hop bound of at most two through related_to or associate_of, a denominator; the shipped checks include the revolving door; a member may add one; one naming a hypothesis is HYPOTHESIS_NOT_A_FACT; any check may be switched off per project by a member of it; a change is a new version and earlier versions are kept", () => {
  const w = world();
  const rd = shipped(w);
  assert.ok(rd, "the shipped revolving-door check");
  assert.match(rd.check, /^CHK-2026-\d{4,}$/);
  assert.deepEqual(rd.condition, SHIPPED_CHECKS[0].condition);
  assert.equal(rd.by, MACHINE, "the machine's own (DEC-52)");
  const base = { name: "donor then decider", denominator: "persons who gave a contribution", by: ANN,
                 condition: { from: { money: "contribution", side: "payer" }, to: { event_role: "decider" }, join: "same", hops: 1 } };
  const ok = w.p.defineCheck(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.version, 1);
  assert.equal(w.p.defineCheck({ ...base, condition: { ...base.condition, hops: 3 } }).reason, "BAD_CONDITION");
  assert.equal(w.p.defineCheck({ ...base, condition: { ...base.condition, from: { line: "holds", money: "gift", side: "payer" } } }).reason, "BAD_CONDITION");
  assert.equal(w.p.defineCheck({ ...base, condition: { ...base.condition, join: "anything" } }).reason, "BAD_CONDITION");
  assert.equal(w.p.defineCheck({ ...base, denominator: "" }).reason, "NO_DENOMINATOR");
  assert.equal(w.p.defineCheck({ ...base, name: "" }).reason, "NO_NAME");
  assert.equal(w.p.defineCheck({ ...base, by: null }).reason, "NO_BY", "every check is recorded under its stamped author (N617)");
  const hyp = w.p.defineCheck({ ...base, condition: { ...base.condition, to: { event_role: "decider", note: "HYP-2026-0003" } } });
  assert.equal(hyp.reason, "HYPOTHESIS_NOT_A_FACT");
  assert.equal(w.p.defineCheck({ ...base, denominator: "rests on HYP-2026-0009" }).reason, "HYPOTHESIS_NOT_A_FACT");
  const v2 = w.p.defineCheck({ ...base, check: ok.check, denominator: "persons who gave anything" });
  assert.equal(v2.version, 2);
  const versions = w.p.listChecks({ viewer: ANN }).checks.filter((c) => c.check === ok.check);
  assert.deepEqual(versions.map((c) => [c.version, c.denominator]), [[1, "persons who gave a contribution"], [2, "persons who gave anything"]]);
  const proj = w.project();
  assert.equal(w.p.switchCheck({ check: rd.check, project: proj, on: false, by: OUT }).reason, "NO_SUCH_PROJECT", "only a member of the project");
  assert.equal(w.p.switchCheck({ check: "CHK-2026-9999", project: proj, on: false, by: ANN }).reason, "NO_SUCH_CHECK");
  assert.equal(w.p.switchCheck({ check: rd.check, project: proj, on: false, by: ANN }).ok, true);
  assert.deepEqual(w.p.checkResults({ project: proj, viewer: ANN }).checks.map((c) => c.check), [ok.check], "switched off in that project");
  assert.ok(w.p.checkResults({ viewer: ANN }).checks.some((c) => c.check === rd.check), "still on elsewhere");
  w.p.switchCheck({ check: rd.check, project: proj, on: true, by: ANN });
  assert.ok(w.p.checkResults({ project: proj, viewer: ANN }).checks.some((c) => c.check === rd.check));
});

test("R23 evaluateChecks evaluates every switched-on check over the held record within its budget, writing each match to the checks' own table with its cited derivation and denominator, never to a person's or entity's row; it answers {evaluated, remaining} and resumes where it stopped; a computation", () => {
  const w = world();
  const d = door(w);
  const people = () => JSON.stringify([w.rows(`SELECT * FROM entities ORDER BY entity_id`), w.rows(`SELECT * FROM person_facts`), w.rows(`SELECT * FROM identity_claims`)]);
  const before = people();
  const first = w.p.evaluateChecks({ budgetMs: 0 });
  assert.equal(first.ok, true);
  assert.equal(first.evaluated, 1);
  assert.equal(first.remaining, true);
  let guard = 0, last;
  do { last = w.p.evaluateChecks({ budgetMs: 0 }); } while (last.remaining && ++guard < 50);
  assert.equal(last.remaining, false);
  const rows = w.rows(`SELECT * FROM interest_check_results`);
  assert.equal(rows.length, 1, "only P's move is within two years of an office that oversees the company");
  const der = JSON.parse(rows[0].derivation_json);
  assert.equal(der.person, d.p);
  assert.ok(der.rows.some((r) => r.id === d.over), "the oversight line is cited");
  assert.equal(der.rows.length, 3);
  assert.equal(rows[0].denominator, SHIPPED_CHECKS[0].denominator);
  assert.equal(people(), before, "nothing is written to a person's or entity's row");
  const again = w.p.evaluateChecks({ budgetMs: 10000 });
  assert.deepEqual([again.evaluated, again.remaining], [3 + PRESET_PERSONS, false], "a fresh pass over every person held");
  assert.equal(w.rows(`SELECT * FROM interest_check_results`).length, 1, "a re-evaluation finds the same match, not a second");
  w.p.recordCheckGate({ check: shipped(w).check, version: 1, goldSet: "g", falseAlarmRate: 0.1, by: "member:boss" });
  const res = w.p.checkResults({ check: shipped(w).check, viewer: ANN }).checks[0].results[0];
  assert.deepEqual(res.denominator, { label: SHIPPED_CHECKS[0].denominator, counted: 2 }, "P and R hold a government post");
});

test("R24 a machine check version's results are answered only once its gate is recorded by an administrator (NO_GOLD_SET; a rate outside 0–1 refused) at a false-alarm rate at most 20%; until then {gated: true, reason} and no result; each result labelled the machine's, layer hypothesis, 'Noticed', with its derivation and denominator; a member's own check shows at once; a gate measured again governs and the one it replaced is kept (N617)", () => {
  const w = world();
  door(w);
  const own = w.p.defineCheck({ name: "my door", condition: RD, denominator: "people with a government post", by: ANN });
  w.p.evaluateChecks({ budgetMs: 10000 });
  const rd = shipped(w);
  const g = w.p.checkResults({ check: rd.check, viewer: ANN }).checks[0];
  assert.equal(g.gated, true);
  assert.ok(g.reason);
  assert.equal(g.results, undefined);
  const mine = w.p.checkResults({ check: own.check, viewer: ANN }).checks[0];
  assert.equal(mine.gated, false, "a member-declared check shows at once (K1505 (8))");
  assert.equal(mine.results.length, 1);
  const gate = { check: rd.check, version: 1, goldSet: "desk gold set 1", falseAlarmRate: 0.15, by: BOSS };
  assert.equal(w.p.recordCheckGate({ ...gate, by: ANN }).reason, "NOT_AN_ADMIN");
  assert.equal(w.p.recordCheckGate({ ...gate, goldSet: "" }).reason, "NO_GOLD_SET");
  for (const bad of [-0.1, 1.5, "x", null]) assert.equal(w.p.recordCheckGate({ ...gate, falseAlarmRate: bad }).reason, "BAD_RATE", String(bad));
  assert.equal(w.p.recordCheckGate({ ...gate, version: 9 }).reason, "NO_SUCH_CHECK");
  assert.equal(w.p.recordCheckGate({ ...gate, falseAlarmRate: 0.3 }).open, false);
  assert.equal(w.p.checkResults({ check: rd.check, viewer: ANN }).checks[0].gated, true, "above 20% stays gated");
  assert.equal(w.p.recordCheckGate({ ...gate, falseAlarmRate: GATE_RATE_MAX }).open, true);
  const kept = w.rows(`SELECT * FROM interest_check_gate_history WHERE check_id=? ORDER BY replaced_at`, rd.check);
  assert.deepEqual(kept.map((g) => [g.false_alarm_rate, g.by_actor, g.replaced_by]), [[0.3, BOSS, BOSS]], "the measurement it replaced is kept");
  assert.equal(w.rows(`SELECT * FROM interest_check_gates WHERE check_id=?`, rd.check).length, 1);
  const open = w.p.checkResults({ check: rd.check, viewer: ANN }).checks[0];
  assert.equal(open.gated, false);
  const res = open.results[0];
  assert.deepEqual([res.by, res.layer, res.label], ["the machine's", "hypothesis", "Noticed"]);
  assert.ok(res.derivation.rows.length && res.denominator.label);
  assert.doesNotMatch(JSON.stringify(open), /conflict|suspicious|knows|most connected/i);
  /* a new version has its own gate */
  const v2 = w.p.defineCheck({ check: rd.check, name: "revolving door", condition: RD, denominator: "same", by: MACHINE });
  assert.equal(v2.version, 2);
  assert.equal(w.p.checkResults({ check: rd.check, viewer: ANN }).checks[0].gated, true);
});

test("R25 a result whose derivation rests on any row the viewer may not see is withheld whole and not counted; onCheckResult registrations (R19's rule) are told of each new gated-open result once, for notice-producers", () => {
  const w = world();
  door(w, { fenced: true });
  const told = [];
  assert.equal(w.p.onCheckResult("", () => 1).reason, "LISTENER_MALFORMED");
  assert.equal(w.p.onCheckResult("notice-producers", (e) => told.push(e.result.result_id)).ok, true);
  assert.equal(w.p.onCheckResult("notice-producers", () => 1).reason, "LISTENER_DECLARED");
  w.p.evaluateChecks({ budgetMs: 10000 });
  assert.equal(told.length, 0, "gated: nobody is told");
  const rd = shipped(w);
  w.p.recordCheckGate({ check: rd.check, version: 1, goldSet: "g", falseAlarmRate: 0.1, by: BOSS });
  assert.equal(told.length, 1, "told when the gate opens");
  w.p.recordCheckGate({ check: rd.check, version: 1, goldSet: "g2", falseAlarmRate: 0.05, by: BOSS });
  w.p.evaluateChecks({ budgetMs: 10000 });
  assert.equal(told.length, 1, "once");
  const ann = w.p.checkResults({ check: rd.check, viewer: ANN }).checks[0];
  const out = w.p.checkResults({ check: rd.check, viewer: OUT }).checks[0];
  assert.equal(ann.count, 1);
  assert.deepEqual([out.count, out.results.length], [0, 0], "withheld whole and not counted");
  /* a member check made inside the project is not answered to an outsider at all */
  const proj = w.project();
  const inner = w.p.defineCheck({ name: "inner", condition: RD, denominator: "d", project: proj, by: ANN });
  assert.ok(w.p.checkResults({ viewer: ANN }).checks.some((c) => c.check === inner.check));
  assert.ok(!w.p.checkResults({ viewer: OUT }).checks.some((c) => c.check === inner.check));
});

test("R35 onChecksChanged takes one registration per module (membership's listenerRefusal); after a check is defined, given a new version, or switched on or off in a project, fn({check, project}) is called once, after the act's transaction; a throwing fn never undoes the act; the notice writes nothing", () => {
  const w = world();
  const heard = [];
  assert.equal(w.p.onChecksChanged("", () => 1).reason, "LISTENER_MALFORMED");
  assert.equal(w.p.onChecksChanged("scheduler", "no").reason, "LISTENER_MALFORMED");
  assert.equal(w.p.onChecksChanged("scheduler", (n) => heard.push(n)).ok, true);
  assert.equal(w.p.onChecksChanged("scheduler", () => 1).reason, "LISTENER_DECLARED");
  const proj = w.project();
  const one = w.p.defineCheck({ name: "mine", condition: RD, denominator: "d", by: ANN });
  const inner = w.p.defineCheck({ name: "inner", condition: RD, denominator: "d", project: proj, by: ANN });
  const v2 = w.p.defineCheck({ check: one.check, name: "mine", condition: RD, denominator: "d2", by: ANN });
  const rd = shipped(w).check;
  w.p.switchCheck({ check: rd, project: proj, on: false, by: ANN });
  w.p.switchCheck({ check: rd, project: proj, on: true, by: ANN });
  assert.deepEqual(heard, [
    { check: one.check, project: null }, { check: inner.check, project: proj }, { check: one.check, project: null },
    { check: rd, project: proj }, { check: rd, project: proj }]);
  assert.equal(v2.version, 2);
  /* refused acts tell nobody */
  w.p.defineCheck({ name: "", condition: RD, denominator: "d", by: ANN });
  w.p.switchCheck({ check: rd, project: proj, on: false, by: OUT });
  assert.equal(heard.length, 5);
  /* after the act's transaction: inside a caller's transaction, told only once it commits, and never when it rolls back */
  const before = heard.length;
  w.record.transact(() => {
    w.p.defineCheck({ name: "held", condition: RD, denominator: "d", by: ANN });
    assert.equal(heard.length, before, "not while the transaction is open");
    return { ok: true };
  });
  assert.equal(heard.length, before + 1);
  w.record.transact(() => { w.p.defineCheck({ name: "rolled back", condition: RD, denominator: "d", by: ANN }); return { ok: false, reason: "X" }; });
  assert.equal(heard.length, before + 1, "a rolled-back act tells nobody");
  assert.ok(!w.p.listChecks({ viewer: ANN }).checks.some((c) => c.name === "rolled back"));
  /* a throwing listener never undoes the act, and the notice writes nothing */
  const counts = (x) => JSON.stringify(["interest_checks", "interest_check_switches", "interest_check_results", "interest_check_cursor"]
    .map((t) => x.rows(`SELECT COUNT(*) AS n FROM ${t}`)));
  const loud = world(), quiet = world();
  loud.p.onChecksChanged("scheduler", () => { throw new Error("scheduler down"); });
  for (const x of [loud, quiet]) {
    const r = x.p.defineCheck({ name: "kept", condition: RD, denominator: "d", by: ANN });
    assert.equal(r.ok, true);
    assert.equal(x.p.switchCheck({ check: r.check, project: x.project(), on: false, by: ANN }).ok, true);
    assert.ok(x.p.listChecks({ viewer: ANN }).checks.some((c) => c.check === r.check), "the act stands");
  }
  assert.equal(counts(loud), counts(quiet), "a listened act writes exactly what an unlistened one does");
});

test("R24 (T35; DEC-131) each answered result, wherever it reaches a member (op=interestchecks, and what R25's listeners are told), carries mark 'Hint · machine work' beside label 'Noticed', its detail beginning with that mark and calling it a hint, never a signal; label, layer, by and every key stay", () => {
  const w = world();
  door(w);
  const told = [];
  w.p.onCheckResult("notice-producers", (e) => told.push(e.result));
  const rd = shipped(w);
  w.p.evaluateChecks({ budgetMs: 10000 });
  w.p.recordCheckGate({ check: rd.check, version: 1, goldSet: "g", falseAlarmRate: 0.1, by: BOSS });
  const op = peopleOps(w.p, new URL(`https://plane.example/?check=${rd.check}&viewer=${encodeURIComponent(ANN)}`), null).interestchecks();
  const answered = op.checks[0].results;
  assert.equal(answered.length, 1);
  assert.equal(told.length, 1);
  const sentence = "Hint · machine work. A check noticed this hint, a pattern in held facts, worth a look. It is not a finding and says nothing about anyone.";
  for (const r of [answered[0], told[0]]) {
    assert.equal(r.mark, word("mark.hint.label"), "DEC-131's words, exactly");
    assert.equal(r.mark, HINT_MARK);
    assert.equal(r.detail, sentence);
    assert.ok(r.detail.startsWith(r.mark));
    assert.match(r.detail, /\bhint\b/);
    assert.doesNotMatch(JSON.stringify(r), /signal/i);
    assert.deepEqual([r.label, r.layer, r.by], ["Noticed", "hypothesis", "the machine's"]);
    assert.deepEqual(Object.keys(r).sort(), ["at", "by", "check", "denominator", "derivation", "detail", "label", "layer", "mark", "name",
      "project", "result_id", "version"]);
  }
  assert.deepEqual(told[0], answered[0], "the listener is told what the op answers");
  /* a member's own check's results carry it too */
  const own = w.p.defineCheck({ name: "my door", condition: RD, denominator: "people with a government post", by: ANN });
  w.p.evaluateChecks({ budgetMs: 10000 });
  for (const r of w.p.checkResults({ check: own.check, viewer: ANN }).checks[0].results) assert.equal(r.mark, HINT_MARK);
});
