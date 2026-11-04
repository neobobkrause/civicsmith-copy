/* ai-runs R9, R10, R32, R40 (R45 in state.test.mjs): the open (`op=airunopen`), at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0 } from "./world.mjs";
import { AI_RUNS_CHECKS, DEPLOYED_MODES, DEPLOYMENT_SEQUENCE } from "../../../src/run-rules/index.mjs";

const HIDDEN = "PROJ-2026-0002", OPENP = "PROJ-2026-0003";

async function openWorld() {
  const w = world();
  await w.group("ann", "bob", "cat", "dan");
  w.bundle(INQ);
  w.project(PROJ, "ann", { joined: ["bob"], invited: ["cat"] });
  w.project(HIDDEN, "ann");
  w.project(OPENP, "ann", { discoverable: true });
  w.cites(PROJ, INQ); w.cites(HIDDEN, INQ);
  return w;
}

/** A refusal carrying its row. */
function refused(r, code) {
  assert.equal(r.started, false, JSON.stringify(r));
  assert.equal(r.code, code);
  if (AI_RUNS_CHECKS[code]) {
    assert.equal(r.check, AI_RUNS_CHECKS[code].check);
    assert.equal(r.translation, AI_RUNS_CHECKS[code].translation);
  } else assert.equal(typeof r.translation, "string");
}

test("R9: the open's refusals in order, nothing written on any — no context, existence, kind, project gate, principals, skill, bounds, state, already open, re-run self/unknown/other", async () => {
  const w = await openWorld();
  const before = w.dump();
  const bob = { actor: "bob", viewer: "member:bob", principalPlane: "member:bob/t1" };
  const dan = { actor: "dan", viewer: "member:dan", principalPlane: "member:dan" };
  const code = async (o) => (await w.runs.open(OPEN(o))).code;
  /* no run id, context type or id: C-33.30, asked before anything else */
  for (const o of [{ run: "" }, { contextType: null }, { contextId: "" }, { run: null, contextType: "nonsense", principalPlane: null }])
    refused(await w.runs.open(OPEN(o)), "AI_RUN_NO_CONTEXT");
  /* a discoverable project the viewer is outside: membership's existence refusal (C-70.1), before the kind */
  const seen = await w.runs.open(OPEN({ ...dan, contextType: "project", contextId: OPENP, principalAi: null }));
  assert.deepEqual([seen.started, seen.code, seen.check, seen.project], [false, "PROJECT_SEEN_NOT_A_PARTICIPANT", "C-70.1", OPENP]);
  /* R7: an unknown kind, a mismatched kind, an absent id and a hidden one — one answer each, before the gate */
  refused(await w.runs.open(OPEN({ ...dan, contextType: "information", principalAi: null })), "AI_RUN_NO_SUCH_CONTEXT");
  refused(await w.runs.open(OPEN({ ...bob, contextType: "inquiry", contextId: PROJ })), "AI_RUN_NO_SUCH_CONTEXT");
  const absent = await w.runs.open(OPEN({ ...dan, contextType: "project", contextId: "PROJ-2026-0404" }));
  const hidden = await w.runs.open(OPEN({ ...dan, contextType: "project", contextId: HIDDEN }));
  refused(hidden, "AI_RUN_NO_SUCH_CONTEXT");
  assert.equal(absent.detail.replace("PROJ-2026-0404", "X"), hidden.detail.replace(HIDDEN, "X"), "absent and hidden answer alike");
  /* R6: an invited (not joined) participant over the project, before the principals are asked */
  refused(await w.runs.open(OPEN({ actor: "cat", viewer: "member:cat", principalPlane: null, contextType: "project", contextId: PROJ })),
    "AI_RUN_NOT_PROJECT_MEMBER");
  /* either principal absent: C-33.29, before the skill version */
  refused(await w.runs.open(OPEN({ principalPlane: null, skillVersion: null })), "AI_RUN_CAPABILITY_UNAVAILABLE");
  refused(await w.runs.open(OPEN({ principalAi: "", skillVersion: null })), "AI_RUN_CAPABILITY_UNAVAILABLE");
  /* R8, then R3 over the bounds */
  refused(await w.runs.open(OPEN({ skillVersion: "3", bounds: { fetches: 1 } })), "AI_RUN_SKILL_VERSION_UNNAMED");
  refused(await w.runs.open(OPEN({ bounds: { fetches: 1 } })), "AI_RUN_BOUND_UNKNOWN");
  refused(await w.runs.open(OPEN({ bounds: [{ bound: "fetches" }] })), "AI_RUN_BOUND_NO_ALLOWANCE");
  refused(await w.runs.open(OPEN({ bounds: [{ bound: "lease", allowed: 1 }] })), "AI_RUN_BOUND_PLANE_COUNTED");
  refused(await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: -1 }] })), "AI_RUN_CONSUME_INVALID");
  /* R45 over the state, after the bounds */
  const big = { s: "x".repeat(262144) };
  refused(await w.runs.open(OPEN({ state: big, bounds: [{ bound: "fetches", allowed: -1 }] })), "AI_RUN_CONSUME_INVALID");
  refused(await w.runs.open(OPEN({ state: big })), "AI_RUN_STATE_TOO_LARGE");
  assert.equal(w.dump(), before, "no refusal wrote anything");
  /* a run id already held: C-33.31 */
  assert.equal((await w.runs.open(OPEN())).started, true);
  const held = w.dump();
  refused(await w.runs.open(OPEN({ contextId: INQ, label: "again" })), "AI_RUN_ALREADY_OPEN");
  /* re-runs: itself, an absent or invisible run, one over another context */
  refused(await w.runs.open(OPEN({ run: "R2", rerunOf: "R2" })), "AI_RUN_RERUN_SELF");
  refused(await w.runs.open(OPEN({ run: "R2", rerunOf: "R404" })), "AI_RUN_RERUN_UNKNOWN");
  assert.equal((await w.runs.open(OPEN({ run: "RP", ...bob, contextType: "project", contextId: PROJ }))).started, true);
  const invisible = await w.runs.open(OPEN({ run: "R2", ...dan, rerunOf: "RP" }));
  refused(invisible, "AI_RUN_RERUN_UNKNOWN");
  assert.equal(invisible.note, (await w.runs.open(OPEN({ run: "R2", ...dan, rerunOf: "R404" }))).note);
  refused(await w.runs.open(OPEN({ run: "R2", ...bob, rerunOf: "RP" })), "AI_RUN_RERUN_OTHER_CONTEXT");
  assert.equal(w.count("ai_runs"), 2, "only the two runs opened");
  void held;
});

test("R10: success writes the run, its bounds, the handed manifest and bar verbatim and the lens in force at the open, and answers the stated shape with the viewer's project count", async () => {
  const w = await openWorld();
  w.lens("BIAS-2026-0001-a");
  const handed = '{"statements_sha":"abc","scope":"instance"}', bar = '{"capture":"B","connection":"C"}';
  const r = await w.runs.open(OPEN({ label: "fees", bounds: [{ bound: "fetches", allowed: 5, unit: "fetch" },
    { bound: "surfaces", allowed: 2, consumed: 0 }], biasManifest: handed, standardPair: bar, state: { todo: [1] },
    actor: "bob", viewer: "member:bob", principalPlane: "member:bob/t1" }));
  assert.deepEqual(Object.keys(r), ["run", "started", "status", "ticks", "created", "expires", "untested", "project", "projectGate"]);
  assert.equal(r.untested, null, "R78: a run the bar admitted carries no label");
  assert.deepEqual([r.started, r.status, r.ticks, r.created, r.expires], [true, "running", 1, T0, "2026-07-01T00:10:00Z"]);
  /* INQ is cited by PROJ (bob sees it) and HIDDEN (he does not): the stated count is the sighted one */
  assert.deepEqual(r.projectGate, { applied: false, ground: "INQUIRY", why: r.projectGate.why, projects: 1 });
  const row = w.row(`SELECT * FROM ai_runs WHERE run='R1'`);
  assert.deepEqual([row.status, row.ticks, row.label, row.bias_manifest, row.standard_pair, row.state, row.context_type, row.context_id,
                    row.principal_plane, row.principal_ai, row.skill_version, row.expires],
                   ["running", 1, "fees", handed, bar, '{"todo":[1]}', "inquiry", INQ, "member:bob/t1", "member:bob", "bio@1", "2026-07-01T00:10:00Z"]);
  assert.deepEqual(w.rows(`SELECT bound, allowed, consumed, unit FROM ai_run_bounds WHERE run='R1' ORDER BY bound`),
    [{ bound: "fetches", allowed: 5, consumed: 0, unit: "fetch" }, { bound: "surfaces", allowed: 2, consumed: 0, unit: null }]);
  const atOpen = JSON.parse(row.lens_at_open);
  const now = await w.bias.biasManifest({ scope: "instance", scopeId: "", viewer: "member:bob", limit: 1 });
  assert.deepEqual(atOpen, { in_force: true, statements_sha: now.statements_sha, scope: now.scope ?? null, scope_id: now.scope_id ?? null,
    bundles: now.bundles.map((b) => ({ bundle_id: b.bundle_id, revision: b.revision ?? null })), at: T0 });
  /* a project run reads the project's lens; `leaseMs` sets the expiry; `rerun_of` is echoed only when named */
  const p = await w.runs.open(OPEN({ run: "R2", contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob",
    principalPlane: "member:bob", leaseMs: 60000, rerunOf: null }));
  assert.equal(p.expires, "2026-07-01T00:01:00Z");
  assert.deepEqual(p.projectGate.ground, "PARTICIPANT");
  assert.equal("rerun_of" in p, false);
  assert.equal(JSON.parse(w.row(`SELECT lens_at_open FROM ai_runs WHERE run='R2'`).lens_at_open).scope, "project");
  const rr = await w.runs.open(OPEN({ run: "R3", rerunOf: " R1 ", actor: "bob", viewer: "member:bob", principalPlane: "member:bob" }));
  assert.equal(rr.rerun_of, "R1");
  assert.equal(w.row(`SELECT rerun_of FROM ai_runs WHERE run='R3'`).rerun_of, "R1");
  /* a machine credential: the gate is not applied, and the count is the viewer's */
  const m = await w.runs.open(OPEN({ run: "R4", actor: "", viewer: "member:ann" }));
  assert.deepEqual([m.projectGate.ground, m.projectGate.projects], ["NO_MEMBER_BEHIND_CALLER", 2]);
  /* D54 (K2442): the founder's viewer, in neither project, counts neither hidden project; cited also by the discoverable
     OPENP (control), it counts that one */
  assert.equal((await w.runs.open(OPEN({ run: "R5", actor: "", viewer: "admin" }))).projectGate.projects, 0, "D54");
  w.cites(OPENP, INQ);
  assert.equal((await w.runs.open(OPEN({ run: "R6", actor: "", viewer: "admin" }))).projectGate.projects, 1, "control: discoverable");
});

test("R32: a run's conditions are recorded at the open and never derived later — the handed manifest verbatim, absent stored as absent, the lens at the open unchanged by a later lens", async () => {
  const w = await openWorld();
  await w.runs.open(OPEN({ biasManifest: "not json at all", standardPair: null, skillVersion: "  bio@7  " }));
  const row = w.row(`SELECT * FROM ai_runs WHERE run='R1'`);
  assert.deepEqual([row.bias_manifest, row.standard_pair, row.skill_version], ["not json at all", null, "bio@7"]);
  const lensBefore = row.lens_at_open;
  assert.equal(JSON.parse(lensBefore).in_force, false);
  w.lens("BIAS-2026-0001-a");
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:10:00Z" });
  await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG, at: "2026-07-01T00:20:00Z" });
  const after = w.row(`SELECT * FROM ai_runs WHERE run='R1'`);
  assert.deepEqual([after.lens_at_open, after.bias_manifest, after.standard_pair], [lensBefore, "not json at all", null]);
  const read = await w.runs.read({ run: "R1", viewer: "admin" });
  assert.equal(read.session.bias.at_open.in_force, false, "the lens at the open is read back, never recomputed");
  assert.equal(read.session.bias.now.in_force, true);
});

test("R40 (T47; N949): the open refuses a mode that is not a deployed member of the one deployment order — a mode whose own flag in DEPLOYED_MODES is set, check and plan today — by C-109.1, after R8 and before anything is written; no mode opens in the deployed one", async () => {
  const w = await openWorld();
  /* run-rules R14 (T46; K2892): plan is deployed by its own flag; ask and draft deploy apart and are no run modes */
  assert.deepEqual(DEPLOYED_MODES, ["check", "plan", "ask", "draft"]);
  assert.equal(DEPLOYMENT_SEQUENCE.verification_recorded, null);
  const before = w.dump();
  for (const mode of ["investigate", "extract", "ask", "draft", "", "   ", "CHECK", "anything", 0]) {
    const r = await w.runs.open(OPEN({ mode }));
    refused(r, "AI_RUN_MODE_NOT_DEPLOYED");
    assert.equal(r.check, "C-109.1");
    assert.deepEqual(r.deployed, ["check", "plan"]);
  }
  /* after R8: a bad skill version is asked first; before R3: a bad mode is answered before bad bounds */
  refused(await w.runs.open(OPEN({ mode: "investigate", skillVersion: "" })), "AI_RUN_SKILL_VERSION_UNNAMED");
  refused(await w.runs.open(OPEN({ mode: "investigate", bounds: { nope: 1 } })), "AI_RUN_MODE_NOT_DEPLOYED");
  assert.equal(w.dump(), before, "no run, no bound and no log row in a mode not deployed");
  /* no mode: the deployed mode, recorded; the deployed mode named: accepted */
  assert.equal((await w.runs.open(OPEN({ run: "R1" }))).started, true);
  assert.equal((await w.runs.open(OPEN({ run: "R2", mode: "check" }))).started, true);
  assert.equal((await w.runs.open(OPEN({ run: "R3", mode: " check " }))).started, true);
  assert.deepEqual(w.rows(`SELECT mode FROM ai_runs ORDER BY run`).map((r) => r.mode), ["check", "check", "check"]);
  assert.equal((await w.runs.read({ run: "R1", viewer: "admin" })).session.mode, "check");
});
