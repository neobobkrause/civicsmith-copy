/* ai-runs T41 (T41-23): B2's run holder for steps, R73's step-runs and exploring runs (each a system step of its own,
   K2490), R74's batch, R75's test bar and the deploy gate that reads it (B6), R76's cost. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, ANN, T0, TEST_SET, ENTRIES } from "./world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { QH, QP1, CAT } from "../steps/fixture.mjs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";
import { RUN_BOUNDS, CIVICSMITH_TEST_SET } from "../../../src/run-rules/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const CAP = "d".repeat(64);
const look = (state, extra = {}) => ({ level: "content", subject: CAP, state, detail: state, ...extra });
const SYS = (run) => AiRuns.systemOf(run);
/** A member's own credential, as the control plane stamps it (R9's `principalPlane`). */
const ANN_CRED = "member:ann/tok-ann";

test("B2 (K2480; J5 (8)): the run holder steps asks answers {enabled_by, principal} for a running run whose principal `by` is, or whose own system identity it is — `principal` the opener's viewer; an unknown, blank, ended, another's run, or another run's system identity answers null, so steps refuses it STEP_NOT_YOUR_RUN", async () => {
  const f = stepsWorld();
  const w = world({ steps: f.steps });
  await w.group("ann"); w.bundle(INQ);
  await w.runs.open(OPEN());
  await w.runs.open(OPEN({ run: "R2", principalPlane: ANN_CRED, actor: ANN }));
  /* the holder is steps': asked through a machine's step; the principal it names is the viewer the place is judged in, so
     a place only a machine's class sees (a hidden project's question) tells a machine's run from a member's. A member's own
     credential is no machine to steps, which does not ask the holder for it. */
  let n = 0;
  const take = (by, run, place) => f.steps.stepCreate({ by, run, place, work: `holder probe ${n++}` });
  const hidden = { questions: [QH] }, open = { questions: [QP1] };
  for (const [by, run, machine] of [[ORG, "R1", true], [SYS("R1"), "R1", true], [SYS("R2"), "R2", false]]) {
    const made = take(by, run, open);
    assert.equal(made.ok, true, `${by} ${run} ${JSON.stringify(made).slice(0, 200)}`);
    assert.equal(f.steps.step({ step: made.step, viewer: "member:ann" }).enabled_by, "member:ann", `${by} ${run}`);
    assert.equal(take(by, run, hidden).ok === true, machine, `${by} ${run}: a ${machine ? "machine's run acts in its class's sight" : "member's run acts in her sight"}`);
  }
  for (const [by, run] of [[ORG, "R404"], [ORG, ""], [ORG, null], ["class:ai/other", "R1"], ["", "R1"], [null, "R1"],
                           [SYS("R2"), "R1"], ["class:daemon", "R1"]])
    assert.equal(take(by, run, open).code, "STEP_NOT_YOUR_RUN", `${by} ${run}`);
  await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG });
  assert.equal(take(ORG, "R1", open).code, "STEP_NOT_YOUR_RUN", "an ended run is held by nobody");
  assert.equal(take(SYS("R1"), "R1", open).code, "STEP_NOT_YOUR_RUN");
});

test("R73 (K2490): an exploring run names its system step's place and work and is refused otherwise — an unknown origin (run-rules' originAllowed, relayed), explore while investigate cannot deploy, then explore with no place and work or with a step, a step the opener cannot see, a step and a place at once — nothing written; control: it opens, then its step is created by the run's own system identity and tied to it", async () => {
  const f = stepsWorld();
  const steps = f.steps;
  const w = world({ steps });
  await w.group("ann"); w.bundle(INQ);
  const seen = f.world.step();                          // a question outside every project: the opener sees its step
  const unseen = f.world.step({ by: CAT, place: { questions: [QH] } });   // a hidden project's: only its own members do
  const before = w.dump();
  const code = async (o) => (await w.runs.open(OPEN({ run: "S", ...o }))).code;
  const own = { place: f.place, work: "find the fee schedule" };
  assert.equal(await code({ origin: "elsewhere" }), "AI_RUN_ORIGIN_UNKNOWN");
  assert.equal(await code({ origin: "explore", enabledBy: ANN, ...own }), "AI_RUN_EXPLORE_NOT_DEPLOYABLE", "check not yet verified live");
  assert.equal(await code({ step: f.unknown }), "AI_RUN_STEP_UNKNOWN");
  assert.equal(await code({ step: unseen }), "AI_RUN_STEP_UNKNOWN", "seen by another viewer only");
  assert.equal(await code({ step: seen, ...own }), "AI_RUN_STEP_UNKNOWN", "a run works one step");
  assert.equal(w.dump(), before, "no refusal wrote anything");
  assert.equal(f.acts.length, 0, "and asked steps to make nothing");
  /* investigate may deploy once check is verified live (run-rules R19's chain; the world holds its test bar) */
  await w.runs.open(OPEN({ run: "V" }));
  assert.equal(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live: the run checked the fee table"], by: "member:ann", at: T0 }).ok, true);
  const mid = w.dump();
  assert.equal(await code({ origin: "explore" }), "AI_RUN_EXPLORE_NEEDS_STEP");
  assert.equal(await code({ origin: "explore", enabledBy: ANN, step: seen }), "AI_RUN_EXPLORE_NEEDS_STEP", "explore names no step (K2490)");
  /* a step steps refuses rolls the run back: nothing written */
  const refused = await w.runs.open(OPEN({ run: "X", origin: "explore", enabledBy: ANN, place: own.place, work: " " }));
  assert.deepEqual([refused.started, refused.code], [false, "STEP_NO_WORK"]);
  assert.equal(w.dump(), mid, "the run steps refused to give a step was not opened");
  /* control: it opens; its step is the system's, made after the open by the run's own identity */
  const x = await w.runs.open(OPEN({ run: "X", origin: "explore", enabledBy: ANN, ...own }));
  assert.deepEqual([x.started, x.origin, typeof x.step], [true, "explore", "string"], JSON.stringify(x));
  const made = f.acts.filter(([a]) => a === "stepCreate").pop()[1];
  assert.deepEqual(made, { ...own, run: "X", by: SYS("X") });
  const s = (await w.runs.read({ run: "X", viewer: "admin" })).session;
  assert.deepEqual([s.step, s.origin], [x.step, "explore"]);
  assert.equal(steps.step({ step: x.step, viewer: "admin" }).doer, "system", "the step is the system's, made by steps");
  /* a member's run of an existing step she sees opens too, naming it and no origin */
  const m = await w.runs.open(OPEN({ run: "S", step: seen }));
  assert.deepEqual([m.started, m.step, "origin" in m], [true, seen, false]);
});

test("R73: a step-run's looks name authority step and its log and rollup read them; its close ties what it produced and ends its own system step as a machine may (ended, or set aside with the bound's sentence), by its system identity; a member's step it worked is left to her; a run with no step tells steps nothing", async () => {
  const f = stepsWorld();
  const steps = f.steps;
  const w = world({ steps });
  await w.group("ann"); w.bundle(INQ);
  f.world.bundle("INFO-2026-0001-cap", { type: "information" });
  f.world.capture(CAP, "INFO-2026-0001-cap");
  const seen = f.world.step();
  await w.runs.open(OPEN({ run: "V" }));
  w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 });
  const own = { origin: "explore", enabledBy: ANN, place: f.place, work: "find the fee schedule" };
  const x = await w.runs.open(OPEN({ run: "X", ...own }));
  assert.equal(x.started, true, JSON.stringify(x));
  await w.runs.open(OPEN({ run: "S", step: seen }));
  await w.runs.tick({ run: "X", viewer: "admin", caller: ORG, log: [look("PRESENT", { result_kind: "capture", result_ref: CAP }), look("LOOKED_ABSENT")] });
  await w.runs.tick({ run: "V", viewer: "admin", caller: ORG, log: [look("LOOKED_ABSENT")] });
  assert.deepEqual(w.rows(`SELECT authority_kind, authority FROM observation_log WHERE terminal = 0 ORDER BY seq`).map((r) => [r.authority_kind, r.authority]),
    [["step", x.step], ["step", x.step], ["run", "V"]]);
  assert.deepEqual(w.runs.log({ run: "X", viewer: "admin" }).entries.map((e) => [e.seq, e.state]), [[1, "PRESENT"], [2, "LOOKED_ABSENT"]]);
  assert.equal(w.runs.log({ run: "V", viewer: "admin" }).entries.length, 1, "no other run's looks");
  const n0 = f.acts.length;
  const c = await w.runs.close({ run: "X", bound: "completed", viewer: "admin", caller: ORG });
  assert.deepEqual([c.terminated, c.state, c.step_end.told, c.step_end.end], [true, "PRESENT", true, "ended"]);
  assert.deepEqual(f.acts.slice(n0), [["recordProduct", { step: x.step, record: { kind: "capture", id: CAP }, by: SYS("X") }],
                                          ["stepEnd", { step: x.step, end: "ended", by: SYS("X") }]]);
  /* a member's step: its products tied, the step left to her (control for the own step's end above) */
  await w.runs.tick({ run: "S", viewer: "admin", caller: ORG, log: [look("PRESENT", { result_kind: "capture", result_ref: CAP })] });
  const n1 = f.acts.length;
  const cs = await w.runs.close({ run: "S", bound: "completed", viewer: "admin", caller: ORG });
  assert.equal(cs.step_end.end, null);
  assert.deepEqual(f.acts.slice(n1).map(([a]) => a), ["recordProduct"]);
  /* a bound stops an exploring run: its step set aside with the bound's sentence */
  const b = await w.runs.open(OPEN({ run: "B", ...own, work: "another look", bounds: [{ bound: "fetches", allowed: 1 }] }));
  const t = await w.runs.tick({ run: "B", viewer: "admin", caller: ORG, consume: { fetches: 1 } });
  assert.equal(t.ended.step_end.end, "set_aside");
  assert.deepEqual(f.acts.at(-1), ["stepEnd", { step: b.step, end: "set_aside", reason: RUN_BOUNDS.fetches, by: SYS("B") }]);
  const n2 = f.acts.length;
  assert.equal("step_end" in (await w.runs.close({ run: "V", bound: "completed", viewer: "admin", caller: ORG })), false);
  assert.equal(f.acts.length, n2);
});

test("R74 (B4 (5); J5 (8), (9), (11)): openMany, a member's batch — no member's act or no list refused whole, nothing written; one estimate for the batch; each seen step opens its own run with a system step of its own whose work names hers; an unseen step and a group's step refused for themselves alone while the others open; a run stopped by its bound sets only its own step aside", async () => {
  const f = stepsWorld();
  const w = world({ steps: f.steps });
  const Q = f.place.questions[0];                       // the question the steps sit on, held by this world too
  await w.group("ann"); w.bundle(INQ); w.bundle(Q);
  const A = f.world.step({ by: ANN, work: "Ask the clerk for the agenda" }), C = f.world.step({ by: ANN, work: "Ask the clerk for the minutes" });
  const G = f.world.step({ by: ANN, place: { group: true }, work: "Collect the team's questions" });
  const H = f.world.step({ by: CAT, place: { questions: [QH] } });      // a hidden project's: ann does not see it
  const before = w.dump();
  const batch = (o = {}) => w.runs.openMany({ steps: [A, H, G, C], mode: "check", skillVersion: "bio@1",
    bounds: [{ bound: "fetches", allowed: 1 }], principalPlane: ANN_CRED, actor: ANN, viewer: ANN, at: T0, ...o });
  assert.equal((await batch({ actor: null, principalPlane: ORG })).code, "AI_RUN_NOT_A_MEMBER_ACT");
  for (const list of [[], [A, A], [""], A])
    assert.equal((await batch({ steps: list })).code, "AI_RUN_NO_CONTEXT", JSON.stringify(list));
  assert.equal(w.dump(), before, "nothing written");
  const r = await batch();
  assert.equal(r.ok, true);
  /* ai-use R10's answer, relayed as it came: what the batch asked is this module's; the estimate itself is ai-use's */
  const { estimate: figures, ...asked } = r.estimate;
  assert.deepEqual(asked, { ok: true, owner: "member:ann", use: "run", mode: "check", count: 4, entry_id: ENTRIES.a }, "ai-use R10, asked once for the batch, naming the entry it is served on");
  assert.equal(typeof figures, "object");
  assert.deepEqual(r.runs.map((x) => [x.step, x.run ?? null, x.refusal ? x.refusal.code : null]),
    [[A, `RUN-${A}-1`, null], [H, null, "AI_RUN_STEP_UNKNOWN"], [G, null, "AI_RUN_NO_CONTEXT"], [C, `RUN-${C}-1`, null]]);
  const created = f.acts.filter(([a]) => a === "stepCreate").map(([, a]) => a);
  assert.deepEqual(created.map((a) => [a.run, a.by, a.work, JSON.stringify(a.place)]),
    [[`RUN-${A}-1`, SYS(`RUN-${A}-1`), "AI run on " + A + ": Ask the clerk for the agenda", JSON.stringify({ questions: [Q] })],
     [`RUN-${C}-1`, SYS(`RUN-${C}-1`), "AI run on " + C + ": Ask the clerk for the minutes", JSON.stringify({ questions: [Q] })]]);
  const a = (await w.runs.read({ run: `RUN-${A}-1`, viewer: ANN })).session;
  assert.deepEqual([a.step, a.context.id, a.principal.ai, a.principal.ref], [r.runs[0].system_step, Q, "member:ann", "member:ann"]);
  /* the bound ends RUN-<A>-1 alone, setting its own step aside; RUN-<C>-1 runs on */
  const t = await w.runs.tick({ run: `RUN-${A}-1`, viewer: ANN, caller: ANN_CRED, consume: { fetches: 1 } });
  assert.equal(t.ended.step_end.end, "set_aside");
  assert.deepEqual(f.acts.filter(([k]) => k === "stepEnd").map(([, x]) => x.step), [r.runs[0].system_step]);
  assert.equal((await w.runs.read({ run: `RUN-${C}-1`, viewer: ANN })).session.status, "running");
  /* a second batch over the same step mints the next run id */
  const again = await w.runs.openMany({ steps: [A], mode: "check", skillVersion: "bio@1", principalPlane: ANN_CRED, actor: ANN, viewer: ANN, at: T0 });
  assert.equal(again.runs[0].run, `RUN-${A}-2`);
});

test("R75: testBarRecord records a part's result through run-rules' checkTestBarRecord (a malformed record refused whole, nothing written); testBarRecords answers the gate's records only, never a group's set; groupTestSet by an active member, groupTestResults to the group's members with each false-alarm rate", async () => {
  const w = world({ bars: [] });
  await w.group("ann");
  const rec = { part: "explore", set: "civicsmith", set_version: 1, false_alarm_rate: 0.12, passed: true, graded_by: "harness", at: T0 };
  for (const bad of [{ false_alarm_rate: "low" }, { part: "nothing" }, { set_version: "1" }, { passed: "yes" }])
    assert.equal(w.runs.testBarRecord({ ...rec, ...bad }).code, "AI_TEST_BAR_UNFIT", JSON.stringify(bad));
  assert.equal(w.count("ai_test_bar"), 0, "nothing written");
  assert.deepEqual(w.runs.testBarRecord(rec), { ok: true, part: "explore", set: "civicsmith", set_version: 1, false_alarm_rate: 0.12, passed: true, at: T0 });
  assert.equal(w.runs.testBarRecord({ ...rec, set: "group", false_alarm_rate: 0.3, passed: false }).ok, true);
  assert.deepEqual(w.runs.testBarRecords().map((r) => [r.part, r.set, r.set_version, r.passed]), [["explore", "civicsmith", 1, true]],
    "a group's set is no gate's input; the version answered as the number the judge reads");
  for (const [args, ok] of [[{ part: "explore", matter: "fee rise", answers: { q: "a" }, by: "member:ann" }, true],
                            [{ part: "explore", matter: "", answers: "a", by: "member:ann" }, false],
                            [{ part: "explore", matter: "m", answers: "a", by: "member:nobody" }, false],
                            [{ part: "explore", matter: "m", answers: "a", by: "class:ai/x" }, false]]) {
    const r = w.runs.groupTestSet(args);
    assert.equal(r.ok, ok, JSON.stringify(args));
    if (!ok) assert.equal(r.code, "AI_GROUP_TEST_INVALID");
  }
  assert.equal(w.count("ai_group_tests"), 1);
  const mine = w.runs.groupTestResults({ part: "explore", viewer: "member:ann" });
  assert.deepEqual([mine.matters, mine.results.map((r) => [r.entry_id, r.part, r.false_alarm_rate, r.passed])], [1, [[null, "explore", 0.3, false]]]);
  assert.deepEqual(w.runs.groupTestResults({ part: "explore", viewer: "class:ai/x" }).results, [], "control: no member, nothing");
  assert.deepEqual(w.rows(`PRAGMA table_info(ai_test_bar)`).map((c) => c.name),
    ["seq", "part", "set_name", "set_version", "false_alarm_rate", "passed", "graded_by", "at", "entry_id"], "figures only: no transcript");
});

test("R40, R75, R78 (T53; run-rules R19, R29 as amended; AD13, K5475): the open deploys a mode only on a Gate 1 verdict held for the account's entry, besides the chain — none refuses check C-109.1, nothing written; an R75 record opens nothing; control: a passing verdict on the entry opens check, and a failed R75 record for that entry on the current set withdraws it for that entry alone", async () => {
  const none = world({ bars: [] });
  await none.group("ann"); none.bundle(INQ);
  const before = none.dump();
  const r = await none.runs.open(OPEN());
  assert.deepEqual([r.started, r.code, r.deployed], [false, "AI_RUN_MODE_NOT_DEPLOYED", []]);
  assert.equal(none.dump(), before);
  /* a passing R75 record (Civicsmith's standing measure) is no gate: still refused */
  none.runs.testBarRecord({ part: "check", set: TEST_SET.id, set_version: TEST_SET.version, false_alarm_rate: 0, passed: true,
                            graded_by: "harness", at: T0, entry_id: ENTRIES.a });
  assert.equal((await none.runs.open(OPEN())).code, "AI_RUN_MODE_NOT_DEPLOYED");
  /* control: Gate 1's verdict for ann's head entry opens check */
  none.gates.push(none.gate("check", ENTRIES.a));
  assert.equal((await none.runs.open(OPEN())).started, true);
  /* a failed R75 record for that entry on the current set withdraws it, for that entry only */
  none.runs.testBarRecord({ part: "check", set: TEST_SET.id, set_version: TEST_SET.version, false_alarm_rate: 0.4, passed: false,
                            graded_by: "harness", at: "2026-07-02T00:00:00Z", entry_id: ENTRIES.a });
  assert.equal((await none.runs.open(OPEN({ run: "R2" }))).code, "AI_RUN_MODE_NOT_DEPLOYED");
  assert.deepEqual([none.runs.partAdmitted("check", ENTRIES.a).admitted, none.runs.partAdmitted("check", ENTRIES.b).admitted], [false, false]);
  none.gates.push(none.gate("check", ENTRIES.b));
  assert.equal(none.runs.partAdmitted("check", ENTRIES.b).admitted, true, "another entry is unaffected");
});

test("R76 (K2482; J5 (10)): a run's cost is ai-use's actualOf for the run's id, asked with the reader's own stamp, answered to whom it answers (the paying account's owners) with `final` once the run has ended; no cost key at all where it answers nothing", async () => {
  const asked = [];
  const aiUse = { useCheck: () => null, countUsage: () => ({ ok: true }),
    actualOf: ({ act, viewer }) => { asked.push([act, viewer]);
      return viewer === "member:ann" ? { ok: true, found: true, act, unit: "usd", cost: { usd: 0.5 }, tokens: 1200, calls: 2 } : { ok: true, found: false }; } };
  const w = world({ aiUse });
  await w.group("ann", "bob"); w.bundle(INQ);
  await w.runs.open(OPEN());
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: "member:ann" })).session.cost,
    { final: false, act: "R1", unit: "usd", cost: { usd: 0.5 }, tokens: 1200, calls: 2 });
  assert.equal("cost" in (await w.runs.read({ run: "R1", viewer: "member:bob" })).session, false);
  const c = await w.runs.close({ run: "R1", bound: "completed", viewer: "member:ann", caller: ORG });
  assert.equal(c.cost.final, true);
  assert.equal("actual" in w.row(`SELECT * FROM ai_runs WHERE run='R1'`), false, "no figures kept on the run (one store)");
  await w.runs.open(OPEN({ run: "R2" }));
  const other = await w.runs.close({ run: "R2", bound: "completed", viewer: "member:bob", caller: ORG });
  assert.deepEqual([other.terminated, "cost" in other], [true, false]);
  assert.ok(asked.every(([act]) => act === "R1" || act === "R2"));
  assert.ok(asked.some(([, v]) => v === "member:bob"), "asked with the reader's own stamp");
});

test("R73, R74 over the real steps module (K2490; J5 (8), (9)): an exploring run's step is the system's, enabled by the paying owner, ended when the run completes, even one that looked at nothing (its NEVER_LOOKED rollup the run's own); a batch over a member's open step makes each run a system step of its own, steps' R8 never refusing it as alike; control: a machine's step of the same work as her open step is refused STEP_ALIKE_EXISTS", async () => {
  const { stepsOf } = await import("../../../src/steps/index.mjs");
  const w = world();
  await w.group("ann"); w.bundle(INQ);
  const steps = stepsOf(w.ctx);
  await w.runs.open(OPEN({ run: "V" }));
  w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 });
  const x = await w.runs.open(OPEN({ run: "X", origin: "explore", enabledBy: ANN, place: { questions: [INQ] }, work: "find the fee schedule" }));
  assert.equal(x.started, true, JSON.stringify(x));
  const made = steps.step({ step: x.step, viewer: "admin" });
  assert.deepEqual([made.doer, made.enabled_by, made.state], ["system", "member:ann", "planned"]);
  const c = await w.runs.close({ run: "X", bound: "completed", viewer: "admin", caller: ORG });
  assert.deepEqual([c.terminated, c.state, c.step_end.told], [true, "NEVER_LOOKED", true], JSON.stringify(c));
  assert.equal(steps.step({ step: x.step, viewer: "admin" }).state, "ended");
  /* R74: her own open step, then a batch over it */
  const mine = steps.stepCreate({ place: { questions: [INQ] }, work: "read the council minutes", by: ANN });
  assert.equal(mine.ok, true, JSON.stringify(mine));
  const r = await w.runs.openMany({ steps: [mine.step], mode: "check", skillVersion: "bio@1", principalPlane: ANN_CRED, actor: ANN, viewer: ANN, at: T0 });
  assert.equal(r.runs[0].run, `RUN-${mine.step}-1`, JSON.stringify(r.runs[0]));
  const sys = steps.step({ step: r.runs[0].system_step, viewer: ANN });
  assert.deepEqual([sys.doer, sys.work], ["system", `AI run on ${mine.step}: read the council minutes`]);
  /* control: steps R8 refuses the system a step of exactly her open step's work */
  await w.runs.open(OPEN({ run: "Y" }));
  const alike = steps.stepCreate({ place: { questions: [INQ] }, work: "read the council minutes", by: SYS("Y"), run: "Y" });
  assert.equal(alike.code || alike.reason, "STEP_ALIKE_EXISTS");
});
