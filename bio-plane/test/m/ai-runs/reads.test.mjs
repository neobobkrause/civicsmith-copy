/* ai-runs R19–R24, R34: the run's reads — the run, its lens and bar, the runs in a context, the spawn payload and the
   log — each gated by the run's context and answering an invisible run as an absent one. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0 } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { RUN_BOUNDS, RUN_ENDINGS, STANDARD_BASIS, OBSERVATION_STATES, OBSERVATION_LEVELS, OBSERVATION_COVERAGE,
         OBSERVATION_COVERAGE_UNDETERMINED } from "../../../src/run-rules/index.mjs";
import { AI_RUNS_CONTEXT_CHECKS } from "../../../src/run-rules/index.mjs";

const CAP = "b".repeat(64);
const INQ2 = "INQ-2026-0002", INQ3 = "INQ-2026-0003", HIDDEN = "PROJ-2026-0009", INFO = "INF-2026-0001";

async function readWorld() {
  const w = world();
  await w.group("ann", "bob", "dan");
  w.bundle(INQ); w.bundle(INQ2); w.bundle(INQ3); w.bundle(INFO, "information");
  w.project(PROJ, "ann", { joined: ["bob"] });
  w.project(HIDDEN, "ann");
  w.cites(PROJ, INQ); w.cites(PROJ, INQ2); w.cites(PROJ, INFO);
  await w.runs.open(OPEN({ label: "L", principalAiRef: "acct-1", bounds: [{ bound: "fetches", allowed: 4 }] }));
  await w.runs.open(OPEN({ run: "RP", contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" }));
  await w.runs.open(OPEN({ run: "RH", contextType: "project", contextId: HIDDEN, actor: "ann", viewer: "member:ann", principalPlane: "member:ann" }));
  return w;
}

test("R19: absent or invisible {found: false, session: null}; otherwise the session with its context (a project's visible confirmed-cited questions), principals, budget, condition, bias, standard, state and rerun_of", async () => {
  const w = await readWorld();
  assert.deepEqual(await w.runs.read({ run: "R404", viewer: "admin" }), { run: "R404", found: false, session: null });
  assert.deepEqual(await w.runs.read({ run: "RH", viewer: "member:dan" }), { run: "RH", found: false, session: null });
  assert.deepEqual(await w.runs.read({ run: "R1", viewer: "nobody-we-know" }), { run: "R1", found: false, session: null });
  const s = (await w.runs.read({ run: "R1", viewer: "member:dan" })).session;
  assert.deepEqual(Object.keys(s), ["id", "label", "mode", "status", "ticks", "created", "updated", "expires", "context",
    "principal", "budget", "condition", "bias", "standard", "state", "rerun_of", "untested", "project"]);
  assert.equal(s.untested, null, "R78: a run the bar admitted carries no label");
  assert.equal(s.project, null, "R89: a run over a question opened in no project records none");
  assert.equal(s.rerun_of, null, "a run that re-runs nothing");
  assert.deepEqual(s.state, {}, "the run's scratch as the open wrote it");
  assert.deepEqual([s.id, s.label, s.mode, s.status, s.ticks, s.created, s.updated, s.expires],
                   ["R1", "L", "check", "running", 1, T0, T0, "2026-07-01T00:10:00Z"]);
  assert.deepEqual(s.context, { type: "inquiry", id: INQ });
  /* R52 (T41): `ref` is the member whose act the run is, never the opener's own word ("acct-1" was offered) */
  assert.deepEqual(s.principal, { plane: ORG, ai: "member:ann", ref: "member:ann", skill: "bio@1" });
  assert.deepEqual(s.budget, [{ bound: "fetches", allowed: 4, consumed: 0, unit: null }]);
  assert.equal(s.condition, null);
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, state: { todo: ["a", "b"], page: 3 } });
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: "admin" })).session.state, { todo: ["a", "b"], page: 3 }, "as the last tick wrote it");
  w.sql.exec(`UPDATE ai_runs SET state = '{broken' WHERE run = 'RP'`);
  assert.equal((await w.runs.read({ run: "RP", viewer: "member:bob" })).session.state, null, "unreadable scratch is null");
  const p = (await w.runs.read({ run: "RP", viewer: "member:bob" })).session;
  assert.deepEqual(p.context, { type: "project", id: PROJ, questions: [INQ, INQ2] }, "only inquiries, sorted");
  await w.runs.close({ run: "R1", bound: "cancelled", viewer: "admin", caller: ORG, at: "2026-07-01T00:05:00Z" });
  const c = (await w.runs.read({ run: "R1", viewer: "admin" })).session.condition;
  assert.deepEqual(c, { kind: "", detail: `cancelled: ${RUN_ENDINGS.cancelled}`, bound: "cancelled", at: "2026-07-01T00:05:00Z" });
  await w.runs.tick({ run: "RP", viewer: "member:bob", actor: "bob", caller: "member:bob", consume: { runtime: 0 } });
  await w.runs.close({ run: "RP", bound: "runtime", condition: "runtime-ceiling-reached", viewer: "member:bob", actor: "bob", caller: "member:bob", at: "2026-07-01T00:06:00Z" });
  assert.deepEqual((await w.runs.read({ run: "RP", viewer: "member:bob" })).session.condition,
    { kind: "runtime-ceiling-reached", detail: `runtime: ${RUN_BOUNDS.runtime}`, bound: "runtime", at: "2026-07-01T00:06:00Z" });
});

test("R19 (N190): rerun_of names the run this run re-runs only when the viewer can see that run too; otherwise null, answering alike a run that re-runs nothing and one whose earlier run is out of view", async () => {
  const w = await readWorld();
  /* RH is over a project dan cannot see; RH2 re-runs it, and a stored link to a run dan cannot see is read as out of view */
  await w.runs.open(OPEN({ run: "R1B", rerunOf: "R1" }));
  await w.runs.open(OPEN({ run: "RH2", contextType: "project", contextId: HIDDEN, actor: "ann", viewer: "member:ann",
                           principalPlane: "member:ann", rerunOf: "RH" }));
  const at = async (run, viewer) => (await w.runs.read({ run, viewer })).session;
  assert.equal((await at("R1B", "member:dan")).rerun_of, "R1");
  assert.equal((await at("R1B", "admin")).rerun_of, "R1");
  assert.equal((await at("RH2", "member:ann")).rerun_of, "RH");
  assert.equal(await at("RH2", "member:dan"), null, "the re-run itself is out of dan's view");
  /* a visible run whose stored link names a run the viewer cannot see, or no run at all: null, as for none */
  w.sql.exec(`UPDATE ai_runs SET rerun_of = 'RH' WHERE run = 'R1B'`);
  assert.equal((await at("R1B", "member:dan")).rerun_of, null);
  assert.equal((await at("R1B", "member:ann")).rerun_of, "RH");
  w.sql.exec(`UPDATE ai_runs SET rerun_of = 'R-PURGED' WHERE run = 'R1B'`);
  assert.equal((await at("R1B", "admin")).rerun_of, null);
  w.sql.exec(`UPDATE ai_runs SET rerun_of = '   ' WHERE run = 'R1B'`);
  assert.equal((await at("R1B", "admin")).rerun_of, null);
  /* the list is the read, per row */
  w.sql.exec(`UPDATE ai_runs SET rerun_of = 'R1' WHERE run = 'R1B'`);
  const listed = (await w.runs.listInContext({ contextType: "inquiry", contextId: INQ, viewer: "member:dan" })).runs;
  assert.equal(listed.find((r) => r.id === "R1B").rerun_of, "R1");
});

test("R20: the lens block — manifest in force or stated absent or unreadable, now, at_open (recorded, unreadable, not recorded), moved against the open where recorded else the hand, moved_basis, and hand in_force or stale", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const bias = async (run) => (await w.runs.read({ run, viewer: "admin" })).session.bias;
  /* nothing in force, nothing handed */
  await w.runs.open(OPEN({ run: "A" }));
  let b = await bias("A");
  assert.deepEqual([b.in_force, b.stated, b.manifest, b.moved, b.moved_basis, b.hand], [false, word("bias.manifest_force"), null, false, "at_open", "in_force"]);
  assert.deepEqual([b.at_open.recorded, b.at_open.in_force, b.now.in_force], [true, false, false]);
  /* a lens in force at the open */
  w.lens("BIAS-2026-0001-a");
  const inForce = (await w.bias.biasManifest({ scope: "instance", scopeId: "", viewer: "admin", limit: 1 })).statements_sha;
  await w.runs.open(OPEN({ run: "B" }));
  await w.runs.open(OPEN({ run: "C", biasManifest: JSON.stringify({ scope: "instance", statements_sha: inForce, bundles: [] }) }));
  await w.runs.open(OPEN({ run: "D", biasManifest: JSON.stringify({ statements_sha: "stale-hash" }) }));
  await w.runs.open(OPEN({ run: "E", biasManifest: "{not json" }));
  b = await bias("B");
  assert.deepEqual([b.in_force, b.stated, b.hand, b.moved], [false, word("ai-runs.stated.manifest_handed_run"), "stale", false]);
  b = await bias("C");
  assert.deepEqual([b.in_force, b.stated, b.manifest.statements_sha, b.hand, b.moved, b.moved_basis, b.now.statements_sha, b.at_open.statements_sha],
                   [true, null, inForce, "in_force", false, "at_open", inForce, inForce]);
  assert.equal((await bias("D")).hand, "stale");
  b = await bias("E");
  assert.deepEqual([b.in_force, b.stated, b.manifest, b.hand], [false, word("ai-runs.stated.manifest_recorded_run"), null, null]);
  /* the lens moves after the open: moved, against the open */
  w.lens("BIAS-2026-0002-b", { statement: "s2" });
  b = await bias("C");
  assert.deepEqual([b.moved, b.moved_basis, b.hand, b.at_open.statements_sha], [true, "at_open", "in_force", inForce]);
  assert.notEqual(b.now.statements_sha, inForce);
  /* an open that recorded nothing (before the rule): the hand against now */
  w.sql.exec(`UPDATE ai_runs SET lens_at_open = NULL WHERE run IN ('C', 'D')`);
  b = await bias("C");
  assert.deepEqual([b.at_open, b.moved, b.moved_basis, b.hand], [{ recorded: false, stated: "not recorded" }, true, "handed", null]);
  w.sql.exec(`UPDATE ai_runs SET bias_manifest = ? WHERE run = 'D'`, JSON.stringify({ statements_sha: b.now.statements_sha }));
  assert.equal((await bias("D")).moved, false);
  w.sql.exec(`UPDATE ai_runs SET bias_manifest = '{}' WHERE run = 'D'`);
  assert.equal((await bias("D")).moved, null, "a hand with no hash is undetermined, never false");
  /* an open recorded and unreadable */
  w.sql.exec(`UPDATE ai_runs SET lens_at_open = '{broken' WHERE run = 'C'`);
  b = await bias("C");
  assert.deepEqual([b.at_open.recorded, b.at_open.unreadable, b.moved, b.moved_basis, b.hand], [true, true, null, null, null]);
});

test("R21: the bar — recorded, none-recorded, context-has-no-project, names-no-axis or unreadable, with its sentence; the pair only when recorded, an unnamed axis null, never filled in", async () => {
  const w = await readWorld();
  /* bob, joined to PROJ, reads every case (D54, K2442: the founder outside PROJ reads its runs as absent, asserted below) */
  const std = async (o) => { const run = `S${Math.random()}`; await w.runs.open(OPEN({ run, ...o }));
    if (o.contextId === PROJ) assert.equal((await w.runs.read({ run, viewer: "admin" })).found, false, "D54");
    return (await w.runs.read({ run, viewer: "member:bob" })).session.standard; };
  const proj = { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" };
  const cases = [
    [{ ...proj, standardPair: '{"capture":"B","connection":" C "}' }, "recorded", { capture: "B", connection: "C" }],
    [{ ...proj, standardPair: '{"capture":"B"}' }, "recorded", { capture: "B", connection: null }],
    [{ ...proj }, "none-recorded", null],
    [{ ...proj, standardPair: "  " }, "none-recorded", null],
    [{ contextId: INQ3 }, "context-has-no-project", null],
    [{}, "none-recorded", null],   /* R86: INQ sits in PROJ, so it takes that project's bar */
    [{ standardPair: '{"capture":"","other":"x"}' }, "names-no-axis", null],
    [{ standardPair: "{broken" }, "unreadable", null],
    [{ standardPair: "[1,2]" }, "unreadable", null],
    [{ standardPair: "7" }, "unreadable", null],
  ];
  for (const [o, basis, pair] of cases) {
    const s = await std(o);
    assert.deepEqual(s, { in_force: basis === "recorded", basis, stated: STANDARD_BASIS[basis], pair }, `${basis} ${o.standardPair}`);
  }
});

test("R22: the runs in a context — no type C-36.1, an unknown one C-36.2, no id C-36.3; else the visible runs newest first as R19, limit clamped to [1, 1000] (200 by default), with truncated", async () => {
  const w = await readWorld();
  const refused = (r, code) => {
    assert.deepEqual([r.ok, r.code, r.reason, r.check, r.translation], [false, code, code, AI_RUNS_CONTEXT_CHECKS[code].check, AI_RUNS_CONTEXT_CHECKS[code].translation]);
  };
  refused(await w.runs.listInContext({ contextId: INQ, viewer: "admin" }), "AI_RUNS_NO_CONTEXT_TYPE");
  refused(await w.runs.listInContext({ contextType: "  ", contextId: INQ, viewer: "admin" }), "AI_RUNS_NO_CONTEXT_TYPE");
  refused(await w.runs.listInContext({ contextType: "case", contextId: INQ, viewer: "admin" }), "AI_RUNS_UNKNOWN_CONTEXT_TYPE");
  refused(await w.runs.listInContext({ contextType: "inquiry", contextId: " ", viewer: "admin" }), "AI_RUNS_NO_CONTEXT_ID");
  for (let i = 1; i <= 4; i++) await w.runs.open(OPEN({ run: `N${i}`, at: `2026-07-01T0${i}:00:00Z` }));
  const all = await w.runs.listInContext({ contextType: "Inquiry", contextId: INQ, viewer: "member:dan" });
  assert.deepEqual([all.ok, all.context, all.count, all.limit, all.truncated], [true, { type: "inquiry", id: INQ }, 5, 200, false]);
  assert.deepEqual(all.runs.map((r) => r.id), ["N4", "N3", "N2", "N1", "R1"]);
  assert.deepEqual(all.runs[0], (await w.runs.read({ run: "N4", viewer: "member:dan" })).session);
  const two = await w.runs.listInContext({ contextType: "inquiry", contextId: INQ, viewer: "admin", limit: 2 });
  assert.deepEqual([two.count, two.limit, two.truncated], [2, 2, true]);
  for (const [limit, applied] of [[0, 200], [-3, 1], [0.5, 1], ["7", 7], [99999, 1000], [null, 200], ["x", 200]])
    assert.equal((await w.runs.listInContext({ contextType: "inquiry", contextId: INQ, viewer: "admin", limit })).limit, applied, String(limit));
  /* withheld, never counted: an invisible context answers the empty list, byte for byte as an empty one */
  const hidden = await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "member:dan", limit: 1 });
  const empty = await w.runs.listInContext({ contextType: "project", contextId: "PROJ-2026-0404", viewer: "member:dan", limit: 1 });
  assert.deepEqual({ ...hidden, context: null }, { ...empty, context: null });
  assert.deepEqual([hidden.count, hidden.truncated], [0, false]);
  assert.equal((await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "member:ann" })).count, 1, "control: its owner");
  /* D54 (K2442): the founder, neither invited nor joined, lists none of a hidden project's runs, as dan does */
  const founder = await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "admin", limit: 1 });
  assert.deepEqual({ ...founder, context: null }, { ...hidden, context: null }, "D54: byte for byte as an outsider");
});

test("R23, R34: the spawn payload — absent or invisible found false; the search half carries context, mode, skill, bar and budget and no lens field at all; the compose half adds R20's block; the budget capped at the bound count", async () => {
  const w = await readWorld();
  w.lens("BIAS-2026-0001-a");
  await w.runs.open(OPEN({ run: "L1", biasManifest: '{"statements_sha":"x"}', standardPair: '{"capture":"A"}',
    bounds: [{ bound: "fetches", allowed: 2 }, { bound: "surfaces", allowed: 1 }] }));
  assert.deepEqual(await w.runs.spawnPayload({ run: "R404", viewer: "admin" }), { run: "R404", found: false, half: null, payload: null });
  assert.deepEqual(await w.runs.spawnPayload({ run: "RH", viewer: "member:dan", half: "compose" }), { run: "RH", found: false, half: null, payload: null });
  for (const half of [undefined, "search", "anything"]) {
    const s = await w.runs.spawnPayload({ run: "L1", viewer: "admin", half });
    assert.equal(s.half, "search");
    assert.deepEqual(Object.keys(s), ["run", "found", "half", "payload", "limit", "truncated", "fence"]);
    assert.deepEqual(Object.keys(s.payload), ["run", "context", "mode", "skill", "standard_pair", "standard", "budget", "subjects"]);
    const text = JSON.stringify(s);
    assert.equal(/bias|lens|manifest|statements_sha/i.test(text.replace(s.fence, "")), false, "R34: the search half never receives the lens");
    assert.deepEqual([s.payload.mode, s.payload.skill, s.payload.standard_pair, s.payload.standard.basis, s.limit, s.truncated],
                     ["check", "bio@1", '{"capture":"A"}', "recorded", Object.keys(RUN_BOUNDS).length, false]);
    assert.deepEqual(s.payload.budget.map((b) => b.bound), ["fetches", "surfaces"]);
  }
  const c = await w.runs.spawnPayload({ run: "L1", viewer: "admin", half: "compose" });
  assert.equal(c.half, "compose");
  assert.deepEqual(c.bias, (await w.runs.read({ run: "L1", viewer: "admin" })).session.bias);
  assert.deepEqual(c.payload, (await w.runs.spawnPayload({ run: "L1", viewer: "admin" })).payload);
});

test("R24: the log — absent or invisible found false with no entries; entries in order numbered from 1, an observation referent rewritten to its ordinal, each with coverage; limit clamped to [1, 5000] (200 by default), truncated, stopped and the vocabulary", async () => {
  const w = await readWorld();
  assert.deepEqual(w.runs.log({ run: "R404", viewer: "admin" }), { run: "R404", found: false, entries: [], stopped: null, limit: 200, truncated: false });
  assert.deepEqual(w.runs.log({ run: "RH", viewer: "member:dan", limit: 3 }), { run: "RH", found: false, entries: [], stopped: null, limit: 3, truncated: false });
  const look = (state, extra = {}) => ({ level: "content", subject: CAP, state, detail: state, ...extra });
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, log: [look("LOOKED_ABSENT"), look("PRESENT", { result_kind: "capture", result_ref: CAP })] });
  await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG, at: "2026-07-01T00:30:00Z" });
  const l = w.runs.log({ run: "R1", viewer: "member:dan" });
  assert.deepEqual([l.found, l.status, l.limit, l.truncated], [true, "finished", 200, false]);
  assert.deepEqual(l.entries.map((e) => e.seq), [1, 2, 3]);
  assert.deepEqual(Object.keys(l.entries[0]), ["seq", "at", "level", "subject", "state", "governed", "condition", "bound", "terminal", "detail",
    "result_kind", "result_ref", "coverage"]);
  assert.deepEqual(l.entries.map((e) => [e.state, e.terminal, e.governed]), [["LOOKED_ABSENT", false, false], ["PRESENT", false, false], ["PRESENT", true, false]]);
  assert.deepEqual([l.entries[2].result_kind, l.entries[2].result_ref], ["observation", "2"], "the rollup points at entry 2 in this answer");
  assert.equal(l.entries[1].result_ref, CAP);
  for (const e of l.entries) assert.ok(Object.hasOwn(OBSERVATION_COVERAGE, e.coverage) || e.coverage === OBSERVATION_COVERAGE_UNDETERMINED, e.coverage);
  assert.deepEqual(l.stopped, { bound: "completed", condition: null, at: "2026-07-01T00:30:00Z" });
  assert.deepEqual(l.vocabulary, { states: OBSERVATION_STATES, levels: OBSERVATION_LEVELS, bounds: RUN_BOUNDS, endings: RUN_ENDINGS,
                                   coverage: OBSERVATION_COVERAGE, coverage_undetermined: OBSERVATION_COVERAGE_UNDETERMINED });
  /* the bound: 205 entries against the default, and the clamp */
  await w.runs.tick({ run: "RP", viewer: "member:bob", actor: "bob", caller: "member:bob",
                      log: Array.from({ length: 205 }, (_, i) => look("LOOKED_ABSENT", { detail: `n${i}` })) });
  const d = w.runs.log({ run: "RP", viewer: "member:bob" });
  assert.deepEqual([d.entries.length, d.limit, d.truncated, d.entries[199].seq, d.entries[199].detail], [200, 200, true, 200, "n199"]);
  assert.equal(d.stopped, null);
  for (const [limit, applied] of [[0, 200], [-1, 1], [1, 1], ["205", 205], [99999, 5000]]) {
    const x = w.runs.log({ run: "RP", viewer: "member:bob", limit });
    assert.equal(x.limit, applied, String(limit));
    assert.equal(x.truncated, 205 > applied);
  }
});
