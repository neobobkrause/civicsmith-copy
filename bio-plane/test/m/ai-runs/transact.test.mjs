/* ai-runs N418 (K650): every write the run's acts make goes through record-core's `transact` (its R32), so the store's
   one transaction and its `afterCommit` (R66) hold over them — R10's open, R12's tick, R14's exit (through the close and
   the reaper), R16's hold and wake, R18's failed dispatch entry, R26's surfacing and R29's spend. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, sha, agentWorker, USAGE } from "./world.mjs";
import { ENTRY } from "./world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const at = (s) => Date.parse(`2026-07-01T${s}Z`);
const WRITE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b[\s\S]*?\b(ai_runs|ai_run_bounds|inquiry_run_surfacings|observation_log|ai_usage|ai_ceilings)\b/i;

/** Watches the world: every write to this module's tables or the observation log is made inside record-core's
 *  `transact`, and `afterCommit` held inside one runs only after it commits. */
function watch(w) {
  let depth = 0;
  const outside = [];
  const transact = w.record.transact.bind(w.record);
  w.record.transact = (fn) => { depth++; try { return transact(fn); } finally { depth--; } };
  const exec = w.sql.exec.bind(w.sql);
  w.sql.exec = (q, ...a) => { if (WRITE.test(q) && depth === 0) outside.push(q.trim().split("\n")[0]); return exec(q, ...a); };
  return { outside, get depth() { return depth; } };
}

function waitSource(reqs) {
  return {
    tickMs: () => 5000, configured: () => true,
    holds: (iso, limit) => Object.entries(reqs).map(([run, rs]) => ({ run, outstanding: rs.filter((q) => q.state === "pending").length }))
      .filter((h) => h.outstanding > 0).slice(0, limit),
    woken: (limit) => Object.entries(reqs).filter(([, rs]) => rs.some((q) => q.state !== "pending" && !q.woken)).map(([r]) => r).slice(0, limit),
    completions: (run, limit) => (reqs[run] || []).filter((q) => q.state !== "pending" && !q.woken).slice(0, limit)
      .map((q) => ({ request: q.request, state: q.state })),
    markWoken: (ids, iso) => { for (const rs of Object.values(reqs)) for (const q of rs) if (ids.includes(q.request)) q.woken = iso; },
  };
}

test("R10, R12, R14, R16, R18, R26, R29, R52 (N418): every write of the run's acts is made inside record-core's transact — open, tick (its calls counted through ai-use, at a limit too), close, reap, hold and wake, a failed dispatch's entry, the surfacing step and a spend", async () => {
  const TOKEN = "instance-ai-secret-value-7f3c";
  const w = world({ env: { AGENT_WORKER: agentWorker("throw"), INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` },
                           AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann");
  w.bundle(INQ);
  w.ctx.id = { equals: (x) => x === "id:bio" };
  const m = w.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  assert.equal(m.ok, true, JSON.stringify(m));
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const stamp = `${cred.principal}/${cred.tokenId}`;
  /* ai-use's own migration (its T53 money table) runs at its first reach: made before the watch, it is not this module's */
  aiUseOf(w.ctx);
  const seen = watch(w);

  assert.equal((await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 5 }, { bound: "surfaces", allowed: 2 }] }))).started, true);
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:00:01Z", consume: { fetches: 1 },
    state: { next: 1 }, log: [{ level: "document", subject: INQ, state: "LOOKED_ABSENT" }] });
  assert.deepEqual([t.ticked, t.appended], [true, 1]);
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:00:02Z",
    usage: [ENTRY()] })).counted, 1);
  const limit = (amount) => aiUseOf(w.ctx).aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day",
    amount, by: "member:ann", at: "2026-07-01T00:00:02Z" });
  assert.equal(limit(1).ok, true, "ai-use R2: ann's own account limited to one call a day");
  /* at the limit (ai-use R3): the refused tick's calls are still counted, inside transact */
  const over = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-01T00:00:03Z",
    usage: [ENTRY()] });
  assert.deepEqual([over.ticked, over.code, over.counted], [false, "AI_LIMIT_REACHED", 1]);
  assert.equal(limit(null).ok, true);
  assert.equal(w.surface("INQ-2026-0009").ok, true);
  assert.equal(w.runs.consumeBound("R1", "fetches", 1), null);
  assert.equal((await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG })).terminated, true);
  await w.runs.open(OPEN({ run: "R2", leaseMs: 1000 }));
  assert.equal(w.runs.reap(at("01:00:00")).reaped[0].terminated, true);
  await w.runs.open(OPEN({ run: "R3", principalPlane: stamp, at: "2026-07-01T02:00:00Z" }));
  await w.runs.open(OPEN({ run: "R4", at: "2026-07-01T02:00:00Z" }));
  w.runs.registerWaitSource("capture-requests", waitSource({
    R3: [{ request: "q1", state: "captured" }], R4: [{ request: "q2", state: "pending" }] }));
  const k = await w.runs.wake(at("02:00:10"));
  assert.deepEqual([k.held, k.woken, k.wakes[0].dispatch.state], [1, 1, "SILENT"]);
  assert.equal(w.rows(`SELECT * FROM observation_log WHERE authority='R3'`).length, 2, "the wake's entry and the failed dispatch's");

  assert.deepEqual(seen.outside, [], "no write of this module's is made outside record-core's transact");
  assert.equal(seen.depth, 0);

  /* control: the watch sees a write made outside transact */
  w.sql.exec(`UPDATE ai_runs SET label = 'x' WHERE run = 'R4'`);
  assert.equal(seen.outside.length, 1);
});

test("R10, R12 (N418): the run's writes join a caller's transact — a refusal around them rolls them back, and afterCommit held inside runs only once the outermost commits", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const before = w.dump();
  const out = w.record.transact(() => {
    w.runs.consumeBound("NONE", "fetches", 1);
    return { ok: false, reason: "CALLER_REFUSED" };
  });
  assert.equal(out.reason, "CALLER_REFUSED");
  assert.equal(w.dump(), before, "the spend inside a refused transaction is rolled back");
  await w.runs.open(OPEN());
  const order = [];
  w.record.transact(() => {
    w.runs.consumeBound("R1", "fetches", 2);
    w.record.afterCommit(() => order.push(w.runs.boundOf("R1", "fetches").consumed));
    order.push("inside");
  });
  assert.deepEqual(order, ["inside", 2], "held until the outermost commit, which the spend joined");
});
