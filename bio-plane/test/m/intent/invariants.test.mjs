/* intent's run (R18) and invariants: R19 (progress derived, never reported), R21 (priority, never a filter), R23
   (unseen reads as absent), R24 (tables declared to purge), R25 (no place named). */
import test from "node:test";
import assert from "node:assert/strict";
import { INTENT_CHECKS, INTENT_TABLES } from "../../../src/intent/index.mjs";
import { world, seeded, V, MACHINE, COND } from "./fixture.mjs";

const strip = (r) => { const { detail, project, goal, aspiration, ...rest } = r; return rest; };
const dropClock = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "computed_at" ? undefined : v)));

async function measured() {
  const w = seeded();
  w.entity("ENT-1"); w.entity("ENT-2");
  w.relate("ENT-2", "ENT-1", "member_of");
  w.define();
  await w.thread("ENT-1", { need: "A", award: "B" });
  await w.thread("ENT-2", { award: "C" });
  assert.equal(w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: { ...COND, relation: "member_of" }, author: V("bob"), viewer: V("bob") }).ok, true);
  return w;
}

test("R18 workObjective is a member's act only (MACHINE_CANNOT_CHOOSE_THE_QUESTION): it opens a run through ai-runs with the project as its context and the objective and its current gaps as its instructions, the looks named under authority kind objective", async () => {
  const w = await measured();
  for (const who of [MACHINE, "", null]) assert.equal((await w.i.workObjective({ reason: "Work the gaps.", project: w.P, author: who, run: { run: "R-1" } })).reason,
                                                      "MACHINE_CANNOT_CHOOSE_THE_QUESTION");
  assert.equal(w.calls.open.length, 0);
  assert.equal((await w.i.workObjective({ reason: "Work the gaps.", project: w.P, author: V("dave"), run: { run: "R-1" } })).reason, "NO_SUCH_PROJECT");
  const r = await w.i.workObjective({ reason: "Work the gaps.", project: w.P, author: V("bob"), viewer: V("bob"),
    run: { run: "R-1", principalPlane: "member:bob/tok", principalAi: "member:bob", skillVersion: "bio-pack@3",
           bounds: [{ bound: "fetches", allowed: 10 }], contextType: "inquiry", contextId: "INQ-X" } });
  assert.equal(r.started, true);
  const call = w.calls.open.at(-1);
  assert.equal(call.contextType, "project", "the project is the run's context, whatever the caller sent");
  assert.equal(call.contextId, w.P);
  assert.equal(call.run, "R-1");
  assert.equal(call.principalPlane, "member:bob/tok");
  assert.equal(call.actor, "bob", "the member behind the act, for ai-runs' project gate");
  const ins = call.state.instructions;
  assert.equal(ins.objective, "Find out what happened.");
  assert.deepEqual(ins.condition.required, COND.required);
  assert.deepEqual(ins.gaps.map((g) => g.basis.entity), ["ENT-2"]);
  assert.deepEqual(ins.authority, { kind: "objective", ref: w.P });
  assert.deepEqual(r.instructions, ins);
});

test("R19 progress is derived, never reported: no service accepts a progress figure, count, share or completion, and nothing stores one", async () => {
  const w = await measured();
  /* nothing intent stores has a place for one */
  for (const t of INTENT_TABLES) {
    const cols = w.rows(`PRAGMA table_info(${t.name})`).map((c) => c.name);
    assert.ok(!cols.some((c) => /progress|share|percent|complet|matched|meeting|satisf/.test(c)), `${t.name}: ${cols}`);
  }
  /* a figure sent with a condition or a goal is not taken */
  assert.equal(w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: { ...COND, relation: "member_of", progress: 90, satisfied: { share: 50, reached: 45 }, meeting: 3 },
                                   author: V("bob"), viewer: V("bob") }).ok, true);
  const oc = w.fm(w.P).objective_condition;
  assert.deepEqual(Object.keys(oc).sort(), ["entity", "progression", "relation", "required_grade", "required_stages", "set_at", "set_by", "set_reason", "share"]);
  const g = w.i.declareGoal({ statement: "s", bounds: "b", author: V("bob"), progress: 50, completion: 1 }).goal;
  assert.ok(!/progress|completion/.test(w.text(g)));
  /* reads write nothing */
  const snap = w.snapshot();
  w.i.progress({ project: w.P, viewer: V("bob") });
  w.i.gaps({ project: w.P, viewer: V("bob") });
  w.i.watchSet({ project: w.P });
  w.i.proposals({ viewer: V("bob") });
  assert.deepEqual(w.snapshot(), snap);
  /* a figure written into the project's document by hand is not read back as progress */
  const planted = w.text(w.P).replace("references: []", "references: []\nprogress: 99\nsatisfied: true");
  assert.equal(w.revise(w.P, planted, V("bob")).ok, true);
  const r = w.i.progress({ project: w.P, viewer: V("bob") });
  assert.equal(r.matched, 2);
  assert.equal(r.satisfied, true, "1 of 2 meets 50%, from the record, whatever the document says");
  await w.thread("ENT-1", { need: "A" });
  assert.equal(w.i.progress({ project: w.P, viewer: V("bob") }).meeting, 0, "it moves with the record");
});

test("R21 aspirations and goals set priority and never filter evidence: declaring them leaves every read byte-identical, and a proposal that cuts against a goal is offered on the same terms as one that supports it", async () => {
  const w = await measured();
  w.i.registerSource("monitoring", () => [
    { key: "for", kind: "finding", grade: "B", basis: { says: "supports the goal" }, instances: [] },
    { key: "against", kind: "finding", grade: "B", basis: { says: "cuts against the goal" }, instances: [] }]);
  const reads = () => [w.i.progress({ project: w.P, viewer: V("bob") }), w.i.gaps({ project: w.P, viewer: V("bob") }),
                       w.i.watchSet({ project: w.P }), w.i.proposals({ viewer: V("bob") }), w.i.proposals({ project: w.P, viewer: V("bob") }),
                       w.progressions.readInstance({ progressionKey: "proc", entityId: "ENT-2", viewer: V("bob") }),
                       w.progressions.proposalsFeed(null), w.entities.readEntity({ entityId: "ENT-1" })];
  const before = JSON.stringify(dropClock(reads()));
  const a = w.i.declareAspiration({ scope: "group", statement: "Every contract public", entities: ["ENT-1"], progressions: ["proc"], author: V("alice") }).aspiration;
  w.i.declareAspiration({ scope: "project", owner: w.P, statement: "Only ENT-1", entities: ["ENT-1"], author: V("bob") });
  const g = w.i.declareGoal({ statement: "Show the awards were proper", bounds: "this cycle", aspiration: a, author: V("bob") }).goal;
  w.i.linkObjective({ goal: g, project: w.P, author: V("bob") });
  assert.equal(JSON.stringify(dropClock(reads())), before, "no read is narrowed, reordered or withheld");
  const [pro, con] = ["monitoring::for", "monitoring::against"].map((k) => w.i.proposals({ viewer: V("bob") }).proposals.find((p) => p.key === k));
  assert.deepEqual(Object.keys(pro).sort(), Object.keys(con).sort());
  assert.equal(pro.grade, con.grade);
});

test("R23 every read and act naming a project, goal or aspiration the viewer may not see answers exactly as an absent one", async () => {
  const w = await measured();
  const hidden = w.project("Sealed", "carol");
  const absent = "PROJ-2026-9999-none";
  const pairs = (fn) => [fn(hidden), fn(absent)].map(strip);
  const same = (fn, label) => { const [a, b] = pairs(fn); assert.equal(b.reason, "NO_SUCH_PROJECT", label); assert.deepEqual(a, b, label); };
  same((p) => w.i.setCondition({ reason: "Measured by the record.", project: p, condition: COND, author: V("bob"), viewer: V("bob") }), "setCondition");
  same((p) => w.i.progress({ project: p, viewer: V("bob") }), "progress");
  same((p) => w.i.gaps({ project: p, viewer: V("bob") }), "gaps");
  same((p) => w.i.aspirationsFor({ project: p, viewer: V("bob") }), "aspirationsFor");
  same((p) => w.i.proposals({ project: p, viewer: V("bob") }), "proposals");
  const g = w.i.declareGoal({ statement: "s", bounds: "b", author: V("bob") }).goal;
  const a = w.i.declareAspiration({ scope: "group", statement: "s", author: V("alice") }).aspiration;
  same((p) => w.i.linkObjective({ goal: g, project: p, author: V("bob"), viewer: V("bob") }), "linkObjective");
  same((p) => w.i.departFrom({ project: p, aspiration: a, reason: "r", author: V("bob"), viewer: V("bob") }), "departFrom");
  same((p) => w.i.declareAspiration({ scope: "project", owner: p, statement: "s", author: V("bob"), viewer: V("bob") }), "declareAspiration");
  assert.deepEqual(strip(await w.i.workObjective({ reason: "Work the gaps.", project: hidden, author: V("bob") })), strip(await w.i.workObjective({ reason: "Work the gaps.", project: absent, author: V("bob") })));
  /* a goal or aspiration a viewer may not see (a viewer admitted to nothing) answers as an absent one */
  const nobody = "nobody";
  assert.deepEqual(strip(w.i.readGoal({ goal: g, viewer: nobody })), strip(w.i.readGoal({ goal: "GOAL-2026-0099", viewer: nobody })));
  assert.deepEqual(strip(w.i.pursuitOf({ aspiration: a, viewer: nobody })), strip(w.i.pursuitOf({ aspiration: "ASP-2026-0099", viewer: nobody })));
  assert.deepEqual(strip(w.i.linkObjective({ goal: g, project: w.P, author: V("bob"), viewer: nobody })),
                   strip(w.i.linkObjective({ goal: "GOAL-2026-0099", project: w.P, author: V("bob"), viewer: nobody })));
  assert.equal(w.i.aspirationsFor({ viewer: nobody }).aspirations.length, 0);
  /* N199 (1): a gap of a project the viewer may not see, set aside without naming its project, is still that project's:
     it is listed in `set_aside` to those who see the project and to no one else */
  assert.equal(w.i.setCondition({ reason: "Measured by the record.", project: hidden, condition: { ...COND, relation: "member_of" }, author: V("carol"),
                                   viewer: V("carol") }).ok, true);
  const gap = w.i.gaps({ project: hidden, viewer: V("carol") }).gaps[0];
  assert.ok(gap, "the hidden project has a gap");
  assert.equal(w.i.triage({ proposal: gap.key, act: "defer", reason: "Later.", author: V("carol"), viewer: V("carol") }).ok, true);
  assert.ok(w.i.proposals({ viewer: V("carol") }).set_aside.some((s) => s.key === gap.key), "its project's member sees it");
  for (const who of ["bob", "dave"]) {
    const r = w.i.proposals({ viewer: V(who) });
    assert.ok(!r.set_aside.some((s) => s.key === gap.key), `${who} does not`);
    assert.doesNotMatch(JSON.stringify(r), new RegExp(hidden), `${who} reads nothing naming the hidden project`);
  }
  /* N199 (2): a project's aspiration answers as an absent one to a viewer who may not see its project, in every read
     that names it: its pursuit record, the contacts, the aspirations in force, and a goal's pointer to it */
  const pa = w.i.declareAspiration({ scope: "project", owner: hidden, statement: "Only the sealed files", entities: ["ENT-1"],
                                     author: V("carol") }).aspiration;
  w.i.declareAspiration({ scope: "group", statement: "Every contract public", entities: ["ENT-1"], author: V("alice") });
  const pg = w.i.declareGoal({ statement: "The files", bounds: "this cycle", aspiration: pa, author: V("carol") }).goal;
  assert.deepEqual(strip(w.i.pursuitOf({ aspiration: pa, viewer: V("dave") })),
                   strip(w.i.pursuitOf({ aspiration: "ASP-2026-0099-aspiration", viewer: V("dave") })));
  assert.equal(w.i.pursuitOf({ aspiration: pa, viewer: V("carol") }).ok, true);
  assert.equal(w.i.readGoal({ goal: pg, viewer: V("dave") }).goal.aspiration, null, "the pointer reads as none");
  assert.equal(w.i.readGoal({ goal: pg, viewer: V("carol") }).goal.aspiration, pa);
  assert.ok(!w.i.contacts({ viewer: V("dave") }).contacts.some((c) => c.a === pa || c.b === pa));
  assert.ok(w.i.contacts({ viewer: V("carol") }).contacts.some((c) => c.a === pa || c.b === pa));
  assert.ok(!w.i.aspirationsFor({ member: "dave", viewer: V("dave") }).aspirations.some((a) => a.id === pa));
  assert.equal(w.i.declareGoal({ statement: "s", bounds: "b", aspiration: pa, author: V("dave") }).reason, "NO_SUCH_ASPIRATION");
  for (const r of [w.i.pursuitOf({ aspiration: pa, viewer: V("dave") }), w.i.readGoal({ goal: pg, viewer: V("dave") }),
                   w.i.contacts({ viewer: V("dave") }), w.i.aspirationsFor({ viewer: V("dave") })])
    assert.doesNotMatch(JSON.stringify(r), /sealed/i, "nothing of the hidden aspiration reaches dave");
  /* a project the viewer sees at existence only is told so (membership R77), never more */
  const disc = w.project("Discoverable", "carol", { visibility: "discoverable" });
  const e = w.i.progress({ project: disc, viewer: V("dave") });
  assert.equal(e.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.ok(!("objective" in e) && !("condition" in e));
});

test("R24 this module's tables carry the id they are about and are declared to record-core's purge: a bundle's purge clears its rows, the whole-store purge every row", async () => {
  const w = await measured();
  const Q = w.project("Second", "bob");
  const a = w.i.declareAspiration({ scope: "group", statement: "s", author: V("alice") }).aspiration;
  w.i.departFrom({ project: w.P, aspiration: a, reason: "r", author: V("bob") });
  w.i.departFrom({ project: Q, aspiration: a, reason: "r", author: V("bob") });
  w.i.registerSource("monitoring", () => [{ key: "1", kind: "k", basis: null }, { key: "2", kind: "k", basis: null }]);
  w.i.triage({ proposal: "monitoring::1", act: "dismiss", project: w.P, reason: "r", author: V("bob") });
  w.i.triage({ proposal: "monitoring::2", act: "dismiss", project: Q, reason: "r", author: V("bob") });
  for (const t of INTENT_TABLES) {
    const cols = w.rows(`PRAGMA table_info(${t.name})`).map((c) => c.name);
    for (const k of t.keys) assert.ok(cols.includes(k), `${t.name}.${k}`);
  }
  const one = await w.record.purge({ bundleId: w.P });
  assert.ok("intent_departures" in one.removed && "intent_triage" in one.removed, JSON.stringify(one).slice(0, 300));
  assert.deepEqual(w.rows(`SELECT project_id FROM intent_departures`), [{ project_id: Q }]);
  assert.deepEqual(w.rows(`SELECT project_id FROM intent_triage`), [{ project_id: Q }]);
  await w.record.purge({});
  assert.equal(w.count("intent_departures"), 0);
  assert.equal(w.count("intent_triage"), 0);
});

test("R25 no place is named in this module's behaviour or outward text: its rows, and the refusals and answers its acts and reads give", async () => {
  const PLACES = /oakland|alameda|california|berkeley|san francisco|county|city of/i;
  for (const row of Object.values(INTENT_CHECKS)) assert.doesNotMatch(row.translation, PLACES);
  const w = await measured();
  const a = w.i.declareAspiration({ scope: "group", statement: "s", author: V("alice") });
  const g = w.i.declareGoal({ statement: "s", bounds: "b", aspiration: a.aspiration, author: V("bob") });
  const answers = [
    a, g, w.i.progress({ project: w.P, viewer: V("bob") }), w.i.gaps({ project: w.P, viewer: V("bob") }),
    w.i.proposals({ viewer: V("bob") }), w.i.aspirationsFor({ project: w.P, viewer: V("bob") }), w.i.contacts({ viewer: V("bob") }),
    w.i.pursuitOf({ aspiration: a.aspiration, viewer: V("bob") }), w.i.readGoal({ goal: g.goal, viewer: V("bob") }),
    w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: {}, author: V("bob") }), w.i.declareGoal({ statement: "", bounds: "", author: V("bob") }),
    w.i.triage({ proposal: "x", act: "adopt", author: MACHINE }), w.i.departFrom({ project: w.P, aspiration: a.aspiration, reason: "", author: V("bob") }),
    w.i.closeGoal({ goal: g.goal, reason: "", author: V("bob") }), await w.i.ageSurfaced(Date.now()),
    await w.i.workObjective({ reason: "Work the gaps.", project: w.P, author: MACHINE }),
  ];
  for (const r of answers) assert.doesNotMatch(JSON.stringify(r), PLACES);
  for (const id of [w.P, a.aspiration, g.goal]) assert.doesNotMatch(w.text(id).replace(/title: .*/, ""), PLACES);
});

test("R15 R16 (N179) built as the plane builds it, intent first and progressions after it with the plane's env, intent reads progressions' configured clock: an overdue finding is judged at BIO_NOW_MS, not the wall clock", async () => {
  /* a flow whose award is due within 10 days of a need whose own date is 2026-01-01 (the dated fact events holds for its
     capture, progressions R37, in the profile's zone): due 2026-01-11. `dated: false` threads a need with no own date. */
  const at = async (nowIso, { dated = true } = {}) => {
    const w = world({ plane: { env: { BIO_NOW_MS: String(Date.parse(nowIso)) } } });
    w.member("alice", { role: "admin" });
    w.member("bob");
    w.entity("ENT-1");
    assert.equal(w.progressions.defineProgression({ progressionKey: "proc", label: "Procurement", declaredBy: V("alice"),
      basis: "an award follows a need within ten days", stages: [
      { key: "need", cardinality: "1", required: "always" },
      { key: "award", after: "need", cardinality: "1", required: "always", within: "10 days" }] }).ok, true);
    const need = dated ? w.dated("ent-1-need", "INFO-NEED", "2026-01-01") : w.held("ab".repeat(32), "INFO-NEED");
    w.resolve(need, "INFO-NEED", "ENT-1", "A");
    assert.equal((await w.progressions.threadInstance({ progressionKey: "proc", entityId: "ENT-1", threadedBy: V("alice"),
                                                        placements: [{ stage: "need", captureSha: need }] })).ok, true);
    return w.i.proposals({ viewer: V("bob") }).proposals.find((p) => p.key === "progressions::proc::award");
  };
  const before = await at("2026-01-05T00:00:00Z");
  assert.ok(before, "the missing award is proposed");
  assert.equal(before.basis.overdue, false, "at the configured 2026-01-05 it is not yet due, though the wall clock is past it");
  assert.equal(before.basis.overdue_undetermined_count, 0);
  const after = await at("2026-01-20T00:00:00Z");
  assert.equal(after.basis.overdue, true, "at the configured 2026-01-20 it is overdue");
  assert.equal(after.basis.overdue_count, 1);
  assert.equal(after.basis.overdue_undetermined_count, 0);
  /* progressions R16 (K1444 (ii)): a need with no own date settles nothing; it is counted apart, never as not overdue */
  const undated = await at("2026-01-20T00:00:00Z", { dated: false });
  assert.equal(undated.basis.overdue, false);
  assert.equal(undated.basis.overdue_count, 0);
  assert.equal(undated.basis.overdue_undetermined_count, 1, "the undated need's award is counted as undetermined");
});
