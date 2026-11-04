/* question-explorer: the gate open on the test-instance exception, finds labelled (R16; amends R4, R7). The deployment's
   test-instance fact is ai-runs R78's, handed to the stand-in as `w.testInstance`; each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CIVICSMITH_TEST_SET, untestedLabel } from "../../../src/run-rules/index.mjs";
import { world, bar, VERIFIED_CHECK, Q, DOC2, CAP, CAP2, CALLER } from "./fixture.mjs";

const label = (set = { id: "civicsmith", version: 1 }) =>
  ({ kind: "untested", part: "explore", set: set.id, set_version: set.version, words: "ai.label.untested" });
const gauge = (w, run, over = {}) =>
  w.p.find({ run, kind: "capture", ref: CAP, bearing: "supports", how: "the minutes record the vote", caller: CALLER, ...over });

test("R16: on a test instance with no record and investigate's chain held, the gate is open on the exception: R4's answer carries false_alarm_rate null, gold_set null and untested the label, and each find R5 offers carries it; control: a non-test instance with no record stays shut, R5 answering nothing", async () => {
  for (const set of [CIVICSMITH_TEST_SET, undefined]) {
    const w = await world(set ? { testSet: set } : {}).standard();
    w.testBars = [];
    w.verifications = [VERIFIED_CHECK];
    w.testInstance = true;
    const L = label(set || undefined);
    assert.deepEqual(L, { ...untestedLabel("explore") }, "run-rules R29's label for the explorer's use");
    assert.deepEqual(w.p.gate(), { open: true, why: null, false_alarm_rate: null, gold_set: null, untested: L });
    assert.deepEqual(w.calledAs("partAdmitted").slice(-2).map((a) => a.part), ["investigate", "explore"], "ai-runs R78, the one gate");
    const o = await w.openRun("group");
    const a = gauge(w, o.run);
    assert.deepEqual(a.gauge, { bearing: "supports", how: "the minutes record the vote", false_alarm_rate: null, gold_set: null,
                                label: "machine", enabled_by: "group", untested: L });
    w.content("CNT-1", DOC2, CAP2);
    w.p.find({ run: o.run, kind: "content", ref: "CNT-1", bearing: "cuts_against", how: "the passage says otherwise", caller: CALLER });
    const page = w.p.capture({ run: o.run, address: "https://elsewhere.example/page", caller: CALLER });
    assert.equal(page.named_to_members, true);
    const items = w.p.findsFor({ viewer: "member:alice" }).finds;
    assert.equal(items.length, 3);
    for (const f of items) assert.deepEqual([f.untested, f.false_alarm_rate, f.gold_set], [L, null, null], `${f.kind} labelled`);
    assert.deepEqual(w.testBars, [], "nothing here counts toward any bar");
    /* Control: the same record on an instance that is not a test instance stays shut. */
    w.testInstance = false;
    assert.deepEqual(w.p.gate(), { open: false, why: w.p.gate().why, false_alarm_rate: null, gold_set: null, untested: null });
    assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }), { ok: true, finds: [], truncated: false }, "nothing, no count");
    assert.equal(await w.p.exploreDue(w.clock.now), 0);
    assert.equal(await w.p.exploreWake(w.clock.now), null);
    assert.equal((await w.p.exploreTick(w.clock.now)).gate, "closed");
    for (const v of ["yes", 1, null, undefined]) {
      w.testInstance = v;
      assert.equal(w.p.gate().open, false, `testInstance ${String(v)}: only exactly true`);
    }
  }
});

test("R16: the exception lifts only the bar: with investigate's verification chain not held the gate stays shut on a test instance; a part the exception does not admit shuts it", async () => {
  const w = await world().standard();
  w.testBars = [];
  w.testInstance = true;
  w.verifications = [];
  assert.equal(w.p.gate().open, false, "the chain stands");
  assert.equal((await w.p.exploreTick(w.clock.now)).gate, "closed");
  /* Negative control: the chain held, the gate opens on the exception. */
  w.verifications = [VERIFIED_CHECK];
  assert.equal(w.p.gate().open, true);
  /* A stand-in partAdmitted that refuses the explorer's use shuts it whatever investigate's answer. */
  const real = w.aiRuns.partAdmitted;
  w.aiRuns.partAdmitted = (part) => (part === "explore" ? { admitted: false, untested: null } : real(part));
  assert.equal(w.p.gate().open, false, "explore not admitted");
  w.aiRuns.partAdmitted = (part) => (part === "investigate" ? { admitted: false, untested: null } : real(part));
  assert.equal(w.p.gate().open, false, "investigate not admitted");
  w.aiRuns.partAdmitted = real;
});

test("R16: whenever the explorer's bar is held, R7's recorded false-alarm rate of at most 20% applies and no label is carried, on a test instance too; a find keeps the label it was gauged under", async () => {
  const w = await world().standard();
  w.testInstance = true;
  /* The explorer's bar not held (investigate's is): open on the exception, labelled. */
  w.testBars = [bar("investigate")];
  assert.deepEqual(w.p.gate().untested, label());
  const o = await w.openRun("group");
  const before = gauge(w, o.run);
  assert.deepEqual(before.gauge.untested, label());
  /* The bar held (T53: Gate 1 for the entry ai-runs judges, and R7's recorded rate), on a test instance still: the label
     follows the bar, not the instance. */
  w.testBars = [bar("investigate"), bar("explore")];
  w.gate1();
  w.testInstance = true;
  assert.deepEqual(w.p.gate(), { open: true, why: null, false_alarm_rate: 0.1, gold_set: "civicsmith@1", untested: null });
  w.content("CNT-1", DOC2, CAP2);
  const after = w.p.find({ run: o.run, kind: "content", ref: "CNT-1", bearing: "unclear", how: "a passage", caller: CALLER });
  assert.deepEqual([after.gauge.false_alarm_rate, after.gauge.gold_set, after.gauge.untested], [0.1, "civicsmith@1", null]);
  const items = w.p.findsFor({ viewer: "member:alice" }).finds;
  assert.deepEqual(items.map((f) => [f.find, f.untested]).sort(),
                   [[before.find, label()], [after.find, null]].sort(), "recorded at the find, never removed by a later bar");
  /* Held but above 20%: R7 shuts it, on a test instance too. */
  w.testBars = [bar("investigate"), bar("explore", { false_alarm_rate: 0.21 })];
  assert.equal(w.p.gate().open, false);
  assert.equal(w.p.findsFor({ viewer: "member:alice" }).finds.length, 0);
});

test("R16, R15: a store made before the label gains its column at migrate(), its finds kept, and migrate() stays idempotent", async () => {
  const { storage } = await import("./fixture.mjs");
  const { migrateQuestionExplorer, QUESTION_EXPLORER_SCHEMA } = await import("../../../src/question-explorer/index.mjs");
  const st = storage();
  /* The T42 shape: explore_finds without `untested`. */
  const old = QUESTION_EXPLORER_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--") && !/^\s*untested\s/.test(l)).join("\n");
  for (const s of old.split(";")) if (s.trim()) st.sql.exec(s);
  const cols = () => [...st.sql.exec(`PRAGMA table_info(explore_finds)`)].map((c) => c.name);
  assert.equal(cols().includes("untested"), false, "negative control: the old store lacks it");
  st.sql.exec(`INSERT INTO explore_finds (find, run, question, kind, ref, owner, at) VALUES ('XFD-1','R','Q','page','u','group','t')`);
  migrateQuestionExplorer(st.sql);
  migrateQuestionExplorer(st.sql);
  assert.equal(cols().filter((c) => c === "untested").length, 1);
  assert.deepEqual([...st.sql.exec(`SELECT find, untested FROM explore_finds`)], [{ find: "XFD-1", untested: null }]);
});
