/* action-clocks' T53 entry at its interface (N1257; K5458; DEC-404): R27, `calendarFactsRead` names the layer a list is read
   from and a list's end; R28, a proposed clock entry keeps the layer of its rule; R29, an entry of basis `rule` records the
   layer and never changes with later layers. Over `jurisdictions`' published test forest (its R118) and the shipped package,
   each combined by `jurisdictions`' real code when the test runs; the only change made to the forest is the name of the two
   city-like layers' rules, so that two layers give one rule. Instance clock 2026-09-28T12:00Z. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, CLK } from "./fixture.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const M = V("alice");
const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b";
const RULE = "records_response";
const CITY_A = "forest-city-a", CITY_B = "forest-city-b";
/* The forest's chain and the second branch, the city-like layers' rules both named `records_response` (with the law that answers by them). */
function forest(ids) {
  const ls = forestCopy(FOREST.all).filter((l) => ids.includes(l.id));
  for (const l of ls) if (l.id === CITY_A || l.id === CITY_B) { l.deadlines[0].rule = RULE; l.records_laws[0].response = RULE; }
  return { profiles: ids, override: Object.fromEntries(ls.map((l) => [l.id, l])) };
}
const ONE = ["forest-federal", "forest-state", "forest-county-a", CITY_A];
const TWO = [...ONE, "forest-county-b", CITY_B];
const sent = (w, id, at = "2026-06-05") =>
  assert.equal(w.actions.actionCorrespond({ target: id, direction: "sent", at, account: "sent", viewer: M, author: M }).ok, true);
const propose = (w, id, rule, layer) => w.c.clockPropose({ target: id, rule, ...(layer ? { layer } : {}), proposer: M, viewer: M });
const adopt = (w, id, key) => w.c.clockAdopt({ target: id, proposal: key, author: M, viewer: M });

test("R28 two layers giving one rule for the kind: both are offered, each adoptable by its own <layer id>:<rule>@<proposer> key; without a layer the rule is NAME_AMBIGUOUS naming both; NO_SUCH_RULE's deadlines carry each one's layer", () => {
  const f = forest(TWO);
  assert.equal(combine(TWO.map((id) => f.override[id])).ok, true, "the forest combines");
  const w = world(f);
  w.action(A);
  sent(w, A);
  const amb = propose(w, A, RULE);
  assert.equal(amb.ok, false);
  assert.equal(amb.reason, "NAME_AMBIGUOUS");
  assert.deepEqual(amb.layers.map((l) => l.layer).sort(), [CITY_A, CITY_B]);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM action_clock_proposals`)[0].n, 0, "nothing is written");
  /* the deadlines a request may name, each with its layer */
  const no = propose(w, A, "no_such");
  assert.equal(no.reason, "NO_SUCH_RULE");
  assert.deepEqual(no.deadlines.filter((d) => d.rule === RULE).map((d) => d.layer).sort(), [CITY_A, CITY_B]);
  assert.ok(no.deadlines.every((d) => typeof d.layer === "string"));
  /* each layer's rule, named by `layer` or by the qualified name */
  const pa = propose(w, A, RULE, CITY_A), pb = propose(w, A, `${CITY_B}:${RULE}`);
  assert.equal(pa.ok, true);
  assert.equal(pb.ok, true);
  assert.equal(pa.proposal.key, `${CITY_A}:${RULE}@${M}`);
  assert.equal(pb.proposal.key, `${CITY_B}:${RULE}@${M}`);
  assert.deepEqual([pa.proposal.rule, pa.proposal.layer, pa.proposal.entry.layer], [RULE, CITY_A, CITY_A]);
  assert.deepEqual([pb.proposal.rule, pb.proposal.layer], [RULE, CITY_B]);
  /* the rows: rule stored qualified, the layer in its own column; the trace names the closure list it counted on by its layer */
  const rows = w.rows(`SELECT rule, layer, trace_json FROM action_clock_proposals ORDER BY rule`);
  assert.deepEqual(rows.map((r) => [r.rule, r.layer]), [[`${CITY_A}:${RULE}`, CITY_A], [`${CITY_B}:${RULE}`, CITY_B]]);
  assert.deepEqual(JSON.parse(rows[0].trace_json).closures, [`${CITY_A}:town`]);
  assert.deepEqual(JSON.parse(rows[1].trace_json).closures, [`${CITY_B}:town`]);
  /* R20 lists both by those keys */
  const standing = w.c.clockProposalsFor({ action: A, viewer: M });
  assert.deepEqual(standing.proposals.map((p) => [p.key, p.rule, p.layer]), [[pa.proposal.key, RULE, CITY_A], [pb.proposal.key, RULE, CITY_B]]);
  /* R13: each adopted by its own key */
  const ea = adopt(w, A, pa.proposal.key), eb = adopt(w, A, pb.proposal.key);
  assert.equal(ea.ok, true, JSON.stringify(ea).slice(0, 300));
  assert.equal(eb.ok, true, JSON.stringify(eb).slice(0, 300));
  assert.deepEqual(w.fm(A).clock.map((e) => [e.text, e.layer, e.date]), [[RULE, CITY_A, pa.proposal.entry.date], [RULE, CITY_B, pb.proposal.entry.date]]);
});

test("R28 control: a standing proposal written before the change (a rule with no layer, its row keyed <rule>@<proposer>) is adopted by its old key and its row is untouched", () => {
  const w = world();
  w.action(B);
  sent(w, B, "2026-09-01");
  const p = propose(w, B, "records_answer");
  assert.equal(p.ok, true);
  assert.equal(p.proposal.key, `records_answer@${M}`);
  assert.equal("layer" in p.proposal, false);
  const cols = "bundle_id, proposed_by, rule, layer, date, basis, entry_json, why, proposed_at, trace_json";
  const before = w.rows(`SELECT ${cols} FROM action_clock_proposals`);
  assert.equal(before[0].layer, null);
  assert.equal(adopt(w, B, `records_answer@${M}`).ok, true);
  assert.deepEqual(w.rows(`SELECT ${cols} FROM action_clock_proposals`), before, "only the adoption's own columns change");
  assert.equal("layer" in w.fm(B).clock[0], false, "an entry of no layer names none");
});

test("R29 an entry adopted from a city layer's rule keeps its date and its layer after a second city layer giving a rule of the same name is activated; a re-proposal is a new, labelled proposal, never an edit; R10 states the layer of the list it read", () => {
  const f = forest(TWO);
  const w = world({ profiles: ONE, override: f.override });
  w.action(A);
  sent(w, A);
  const p = propose(w, A, RULE);
  assert.equal(p.ok, true, "one layer gives it: the bare name resolves");
  assert.equal(p.proposal.layer, CITY_A);
  /* R10: the closure list the count read is the city layer's own, stated with its layer; the other city's list of the same name is not read */
  const years = p.proposal.calendar.years.filter((y) => y.list === "town");
  assert.ok(years.length > 0);
  assert.ok(years.every((y) => y.layer === CITY_A));
  assert.equal(adopt(w, A, p.proposal.key).ok, true);
  const text = w.text(A);
  const entry = w.fm(A).clock[0];
  assert.deepEqual([entry.layer, entry.date, entry.basis_kind], [CITY_A, p.proposal.entry.date, "rule"]);
  /* a second city layer giving the same rule name is activated */
  w.record.setSetting("jurisdiction_profiles", TWO, V("admin"));
  assert.equal(propose(w, A, RULE).reason, "NAME_AMBIGUOUS", "the bare name now names two");
  assert.equal(w.text(A), text, "the document is not rewritten");
  assert.deepEqual([w.fm(A).clock[0].layer, w.fm(A).clock[0].date], [CITY_A, entry.date]);
  const pend = w.c.pendingClocks({ before: "2027-12-31", viewer: M });
  assert.deepEqual(pend.items.filter((i) => i.action === A).map((i) => i.date), [entry.date]);
  /* with both city layers active, each count reads its own layer's list: the other city's closed day never moves a date */
  const pb = propose(w, A, RULE, CITY_B);
  assert.equal(pb.ok, true);
  assert.ok(pb.proposal.calendar.years.filter((y) => y.list === "town").every((y) => y.layer === CITY_B));
  assert.equal(propose(w, A, RULE, CITY_A).proposal.entry.date, entry.date, "the first city's count is unchanged by the second's list");
  assert.equal(w.text(A), text, "a proposal writes nothing into the document");
});

test("R29 clockState accepts `layer` for a rule entry only: another kind naming it is CLOCK_ENTRY_REFUSED naming the field; control: an entry adopted before keeps its text, basis and date, no layer, and its action's document is not rewritten", () => {
  const w = world();
  w.action(A, ["clock:", ...CLK("2026-12-01")]);
  const base = { target: A, text: "Answer due", description: "d", date: "2026-12-10", basis: "Act s.3", author: M, viewer: M };
  const ok = w.c.clockState({ ...base, basis_kind: "rule", layer: CITY_A });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.equal(w.fm(A).clock[1].layer, CITY_A);
  const before = w.text(A);
  const bad = w.c.clockState({ ...base, basis_kind: "commitment", committed_by: "the clerk", layer: CITY_A });
  assert.deepEqual([bad.ok, bad.reason, bad.arm], [false, "CLOCK_ENTRY_REFUSED", "layer"]);
  assert.equal(w.text(A), before, "nothing was written");
  /* control: the entry written before names no layer, and stands as written */
  const first = w.fm(A).clock[0];
  assert.equal("layer" in first, false);
  assert.deepEqual([first.text, first.basis, first.date], ["t", "Act s.2", "2026-12-01"]);
  const none = w.c.clockState({ ...base, basis_kind: "rule" });
  assert.equal(none.ok, true);
  assert.equal("layer" in w.fm(A).clock[2], false, "a rule entry with no layer names none");
});

test("R27 calendarFactsRead names the layer each list path is read from, and a FOIA clock needing the federal list past its last year lists it as ending, naming the layer and the years it lacks; control: a count inside the list lists no federal end", () => {
  const PROFILES = ["oakland-alameda"];
  const v = combine(PROFILES).view;
  const fedLayer = v.layers.find((l) => l.level === "federal");
  assert.ok(Number.isInteger(fedLayer.holidays_through));
  const o = v.counterparties.find((c) => c.level === "federal");
  const to = ["counterparty:", "  state: named", "  kind: office", `  role: ${JSON.stringify(o.role)}`, `  body: ${JSON.stringify(o.body)}`];
  const past = `${fedLayer.holidays_through + 1}-03-01`;
  /* the closure list the federal law's response rule counts on, as the view gives it */
  const fedLaw = v.records_laws.find((l) => l.level === "federal");
  const list = v.deadlines.find((d) => d.rule === fedLaw.response && d.applies_to === "records_request").closures;
  assert.ok(typeof list === "string" && list);

  const w = world({ profiles: PROFILES });
  w.action(A, [...to, "clock:", ...CLK(past)]);
  const r = w.c.calendarFactsRead({ viewer: M });
  assert.equal(r.ok, true);
  const end = r.lists_ending.find((x) => x.list === list && x.layer === fedLayer.id);
  assert.ok(end, JSON.stringify(r.lists_ending));
  assert.equal(end.holidays_through, fedLayer.holidays_through);
  assert.deepEqual(end.years, [fedLayer.holidays_through + 1]);
  assert.deepEqual(end.actions.map((a) => a.action), [A]);
  /* each path of the federal list names its layer */
  assert.ok(r.paths.every((p) => p.layer === undefined || v.layers.some((l) => l.id === p.layer)));
  assert.ok(r.paths.some((p) => p.layer === fedLayer.id));

  /* control: a clock inside the list's years lists no federal end */
  const c = world({ profiles: PROFILES });
  c.action(B, [...to, "clock:", ...CLK("2026-12-01")]);
  const rc = c.c.calendarFactsRead({ viewer: M });
  assert.equal(rc.lists_ending.some((x) => x.layer === fedLayer.id), false);
  assert.ok(rc.paths.some((p) => p.layer === fedLayer.id), "the federal list's own years are still listed, with their layer");
});
