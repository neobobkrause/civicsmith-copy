/* ai-runs R28–R30, R36–R38: the services later modules produce under a run through, the registrations this module
   fills (bias's work products, observation-log's run resolver, retrieval's hidden-run tail, contradiction's run gate),
   its purge declaration, and the ops table (K3). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, T0 } from "./world.mjs";
import { AI_RUN_CHECKS } from "../../../src/run-rules/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";
import { hiddenRuns } from "../../../src/ai-runs/index.mjs";

const HIDDEN = "PROJ-2026-0009";

async function prodWorld() {
  const w = world();
  await w.group("ann", "dan");
  w.bundle(INQ);
  w.project(HIDDEN, "ann");
  await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 2 }, { bound: "mints", allowed: 3 }] }));
  await w.runs.open(OPEN({ run: "RH", contextType: "project", contextId: HIDDEN, actor: "ann", viewer: "member:ann", principalPlane: "member:ann/t1" }));
  return w;
}

test("R28: runFor answers the run's gating facts (principal_claude, the member whose account carries it, included) for a held run the viewer can see, and null for a blank id, an absent run and an invisible one alike; it never throws and writes nothing", async () => {
  const w = await prodWorld();
  const before = w.dump();
  assert.deepEqual(w.runs.runFor("R1", "member:dan"),
    { run: "R1", status: "running", mode: "check", context_type: "inquiry", context_id: INQ, principal_plane: ORG, principal_claude: "member:ann",
      untested: null, project: null });
  assert.deepEqual(w.runs.runFor(" RH ", "member:ann"),
    { run: "RH", status: "running", mode: "check", context_type: "project", context_id: HIDDEN, principal_plane: "member:ann/t1",
      principal_claude: "member:ann", untested: null, project: HIDDEN });
  for (const [run, viewer] of [["", "admin"], ["  ", "admin"], [null, "admin"], ["R404", "admin"], ["RH", "member:dan"], ["RH", null],
                               ["R1", "who-knows"], [{ toString() { throw new Error("x"); } }, "admin"]])
    assert.equal(w.runs.runFor(run, viewer), null, `${typeof run} ${viewer}`);
  assert.equal(w.dump(), before);
});

test("R29: boundOf answers one bound's {allowed, consumed} or null; consumeBound adds inside the caller's transaction, making the row at allowed 0, writing nothing for 0, refusing a bad figure C-22.13, and never ending a run", async () => {
  const w = await prodWorld();
  assert.deepEqual(w.runs.boundOf("R1", "fetches"), { allowed: 2, consumed: 0 });
  assert.equal(w.runs.boundOf("R1", "surfaces"), null);
  assert.equal(w.runs.boundOf("R404", "fetches"), null);
  assert.equal(w.runs.consumeBound("R1", "mints", 2), null);
  assert.deepEqual(w.runs.boundOf("R1", "mints"), { allowed: 3, consumed: 2 });
  assert.equal(w.runs.consumeBound("R1", "surfaces", 0), null);
  assert.equal(w.runs.boundOf("R1", "surfaces"), null, "0 writes nothing, not even the row");
  assert.equal(w.runs.consumeBound("R1", "surfaces", 1), null);
  assert.deepEqual(w.runs.boundOf("R1", "surfaces"), { allowed: 0, consumed: 1 });
  const before = w.dump();
  for (const n of [-1, 1.5, "2", null, NaN, true]) {
    const r = w.runs.consumeBound("R1", "mints", n);
    assert.deepEqual([r.code, r.check, r.translation], ["AI_RUN_CONSUME_INVALID", "C-22.13", AI_RUN_CHECKS.AI_RUN_CONSUME_INVALID.translation], String(n));
  }
  assert.equal(w.dump(), before);
  /* inside the caller's transaction: a caller that refuses takes the spend back */
  w.record.transact(() => { w.runs.consumeBound("R1", "mints", 1); return { ok: false, reason: "CALLER_REFUSED" }; });
  assert.equal(w.runs.boundOf("R1", "mints").consumed, 2);
  /* never ends a run: an exhausted bound ends it at the next tick */
  w.runs.consumeBound("R1", "fetches", 5);
  assert.equal(w.runs.runFor("R1", "admin").status, "running");
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:05:00Z" });
  assert.deepEqual([t.status, t.ended.bound], ["stopped", "fetches"]);
});

test("R30: each run is registered with bias as a work product — its context, member principal, lens at the open, the manifest it ran under, its rerun_of, `registered` (its created instant, which bias offers the scheduler's rank as waitingSince) and R19's sight; an unrecorded open or an unreadable instant is undetermined, never filled in", async () => {
  const w = await prodWorld();
  const again = w.bias.registerWorkProducts("ai-run", { list: () => [], read: async () => null, visible: async () => false });
  assert.deepEqual([again.ok, again.reason], [false, "WORK_PRODUCTS_DECLARED"], "this module holds the registration");
  w.lens("BIAS-2026-0001-a");
  const now = await w.bias.biasManifest({ scope: "instance", scopeId: "", viewer: "admin", limit: 1 });
  const OPENED = "2026-07-01T00:07:31Z";
  await w.runs.open(OPEN({ run: "R2", principalPlane: "member:ann/t9", biasManifest: JSON.stringify({ statements_sha: now.statements_sha }), rerunOf: "R1",
    at: "2026-07-01T00:07:31.900Z" }));
  const wp = w.runs.workProducts();
  assert.deepEqual(wp.list("", 50), ["R1", "R2", "RH"]);
  assert.deepEqual(wp.list("R1", 1), ["R2"]);
  assert.deepEqual(await wp.read("R2"), { context: { type: "inquiry", id: INQ }, principal: "ann",
    lens: { basis: "at_open", statements_sha: now.statements_sha }, ranUnder: now.statements_sha, rerunOf: "R1",
    registered: OPENED });
  assert.deepEqual(await wp.read("R1"), { context: { type: "inquiry", id: INQ }, principal: null,
    lens: { basis: "at_open", statements_sha: null }, ranUnder: null, rerunOf: null, registered: T0 });
  /* `registered` is the run's own `created`, the open's instant to the second, for every run */
  /* K2442: the read is internal (a machine viewer), so a run over a hidden project no administrator is in (RH) is read
     whole, as every other run is (control: R1, over a question) */
  assert.deepEqual((await wp.read("RH")).context, { type: "project", id: HIDDEN });
  assert.equal((await w.runs.read({ run: "RH", viewer: "admin" })).found, false, "D54: the founder's own read sees it absent");
  for (const run of wp.list("", 50))
    assert.equal((await wp.read(run)).registered, w.row(`SELECT created FROM ai_runs WHERE run = ?`, run).created, run);
  /* through bias's own door: the sweep offers the scheduler's rank each product's context and its wait (bias R33) */
  let offered = null;
  await w.bias.biasDebtSweep(Date.parse("2026-07-01T01:00:00Z"), (items) => { offered = items.map(({ kind, id, waitingSince }) => ({ kind, id, waitingSince })); return items; });
  assert.deepEqual(offered, [{ kind: "bundle", id: INQ, waitingSince: Date.parse(T0) },
    { kind: "bundle", id: INQ, waitingSince: Date.parse(OPENED) }, { kind: "bundle", id: HIDDEN, waitingSince: Date.parse(T0) }]);
  w.sql.exec(`UPDATE ai_runs SET lens_at_open = '{broken', created = 'not an instant' WHERE run = 'R1'`);
  const broken = await wp.read("R1");
  assert.equal(broken.lens, null, "a lens that cannot be read is offered as undetermined");
  assert.equal(broken.registered, null, "an instant that cannot be read is offered as none, never filled in");
  assert.equal(await wp.read("R404"), null);
  assert.deepEqual([await wp.visible("RH", "member:ann"), await wp.visible("RH", "member:dan"), await wp.visible("R1", "member:dan")], [true, false, true]);
});

test("R36: the hidden-run predicate and the run resolver — retrieval's tail (R42's hiddenRuns, registered here) leaves out the log rows of runs over projects the viewer cannot see, and observation-log shows a run's rows to whoever may read the run", async () => {
  const w = await prodWorld();
  const look = { level: "document", subject: "https://example.org/x", state: "LOOKED_ABSENT", detail: "no" };
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, log: [look] });
  await w.runs.tick({ run: "RH", viewer: "member:ann", actor: "ann", caller: "member:ann", log: [look] });
  const retrieval = retrievalOf(w.ctx);
  const tail = retrieval.registerHiddenRunTail("queue", () => ({ sql: "", args: [] }));
  assert.deepEqual([tail.reason, tail.declaredBy], ["TAIL_DECLARED", "ai-runs"]);
  assert.equal(retrieval.registerProjectionDecoration("ai-runs", () => ({})).reason, "DECORATION_DECLARED");
  /* through retrieval's own door: the tail it answers is the one this module registered */
  const seen = (viewer) => { const t = retrieval.hiddenRunTail(viewer);
    assert.deepEqual(t, hiddenRuns(viewer));
    return w.rows(`SELECT authority FROM observation_log WHERE 1=1${t.sql} ORDER BY seq`, ...t.args).map((r) => r.authority); };
  assert.deepEqual(seen("member:dan"), ["R1"]);
  assert.deepEqual(seen("member:ann"), ["R1", "RH"]);
  /* D54 (K2442): the founder, neither invited nor joined to HIDDEN, does not see RH's rows; an invited administrator does */
  assert.deepEqual(seen("admin"), ["R1"]);
  w.membership.projectInvite({ projectId: HIDDEN, handle: "second", by: "ann" });
  w.membership.reindexProjectSight(HIDDEN);
  assert.deepEqual(seen("member:second"), ["R1", "RH"], "control: an invited administrator sees it");
  assert.deepEqual(seen("who-knows"), [], "an unrecognised viewer sees no run, as R19 answers it none");
  const obs = observationLogOf(w.ctx);
  const rowOf = (run) => w.row(`SELECT * FROM observation_log WHERE authority = ?`, run);
  assert.deepEqual([obs.rowVisible(rowOf("RH"), "member:ann"), obs.rowVisible(rowOf("RH"), "member:dan"), obs.rowVisible(rowOf("R1"), "member:dan")],
                   [true, false, true]);
});

test("R37: the run gate contradiction offers is filled here from R28 and R5 — found false for blank, absent and invisible alike, running, and R5's refusal naming the act", async () => {
  const w = await prodWorld();
  const c = contradictionOf(w.ctx);
  const again = c.registerRunGate("run-productions", () => ({ found: false, running: false, refusal: null }));
  assert.deepEqual([again.ok, again.module], [false, "ai-runs"], "one gate, held by this module");
  const g = (run, viewer, caller) => w.runs.runGate(run, viewer, caller, "proposing contradictions under a run");
  assert.deepEqual(g("R1", "admin", ORG), { found: true, running: true, refusal: null, run: w.runs.runFor("R1", "admin") });
  for (const [run, viewer] of [["", "admin"], ["R404", "admin"], ["RH", "member:dan"]])
    assert.deepEqual(g(run, viewer, ORG), { found: false, running: false, refusal: null, run: null });
  const np = g("R1", "admin", "member:dan");
  assert.deepEqual([np.found, np.refusal.code, np.refusal.check], [true, "AI_RUN_NOT_PRINCIPAL", "C-22.12"]);
  assert.match(np.refusal.detail, /^proposing contradictions under a run/);
  /* through contradiction's own door */
  const propose = (run, caller, viewer = "admin") => c.propose({ run, proposals: [], proposedBy: "class:ai/tok-org", viewer, caller, at: T0 });
  assert.equal(propose("R404", ORG).code, "CANDIDATE_NO_RUN");
  assert.equal(propose("RH", "member:ann/t1", "member:dan").code, "CANDIDATE_NO_RUN");
  assert.equal(propose("R1", "member:dan").code, "AI_RUN_NOT_PRINCIPAL");
  assert.equal(propose("R1", ORG).code, "CANDIDATE_NO_PROPOSALS");
  await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG });
  assert.equal(propose("R1", ORG).code, "CANDIDATE_RUN_NOT_RUNNING");
});

test("R38: the three tables are declared to record-core's purge — the whole-store form clears them, a bundle's form clears only that question's surfacing row", async () => {
  const w = await prodWorld();
  await w.runs.open(OPEN({ run: "RS", bounds: [{ bound: "surfaces", allowed: 2 }] }));
  const Q1 = "INQ-2026-0101", Q2 = "INQ-2026-0102";
  assert.equal(w.surface(Q1, { run: "RS" }).ok, true);
  assert.equal(w.surface(Q2, { run: "RS" }).ok, true);
  assert.deepEqual(w.record.declarePurge("someone-else", ["ai_runs"]).reason ?? "refused", "TABLE_DECLARED");
  const one = w.purge({ bundleId: Q1 });
  assert.equal(one.removed ? one.removed.inquiry_run_surfacings : one.tables.inquiry_run_surfacings, 1);
  assert.deepEqual(w.rows(`SELECT bundle_id FROM inquiry_run_surfacings`), [{ bundle_id: Q2 }]);
  assert.equal(w.count("ai_runs"), 3);
  w.purge({});
  for (const t of ["ai_runs", "ai_run_bounds", "inquiry_run_surfacings"]) assert.equal(w.count(t), 0, t);
});

test("K3: the ops table — each op answers through the module, every identity from the query's stamps and never the body's (R9, R11, R13, R19, R22, R23, R24)", async () => {
  const w = await prodWorld();
  const o = await w.op("airunopen", { principal: ORG, actor: "", viewer: "admin" },
    { ...OPEN({ run: "OP1" }), principalPlane: "member:forged", viewer: "member:forged", actor: "forged" });
  assert.equal(o.started, true);
  assert.equal(w.runs.runFor("OP1", "admin").principal_plane, ORG);
  const t = await w.op("airuntick", { principal: "member:dan", actor: "dan", viewer: "admin" }, { run: "OP1", caller: ORG });
  assert.equal(t.code, "AI_RUN_NOT_PRINCIPAL", "the body's caller is not believed");
  assert.equal((await w.op("airuntick", { principal: ORG, actor: "", viewer: "admin" }, { run: "OP1" })).ticked, true);
  assert.equal((await w.op("airun", { run: "OP1", viewer: "member:dan" })).found, true);
  assert.equal((await w.op("airun", { run: "RH", viewer: "member:dan" })).found, false);
  assert.equal((await w.op("airunlog", { run: "OP1", viewer: "admin", limit: "3" })).limit, 3);
  assert.equal((await w.op("airuns", { contextType: "inquiry", contextId: INQ, viewer: "admin" })).count, 2);
  assert.equal((await w.op("airunspawn", { run: "OP1", half: "compose", viewer: "admin" })).half, "compose");
  const c = await w.op("airunclose", { principal: ORG, actor: "", viewer: "admin" }, { run: "OP1", bound: "completed", caller: "member:dan" });
  assert.equal(c.terminated, true);
});
