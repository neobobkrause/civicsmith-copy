/* scheduler — the provider notice ai-runs:323 (ai-runs PR 323; its R97, F1 fail closed). The `ai-run-wake` consumer (R5,
   ai-runs R16) ticks `aiRuns.wake(now)`, which hands a woken instance run to agent-worker through ai-runs' path check. Since
   PR 323 that check fails closed with no path source registered: the dispatch is withheld `AI_PATH_NOT_READY unregistered`.
   This module's answer: nothing to change. The withheld dispatch is ai-runs' answer under `airunwake` (R2); the firing does
   not throw (R3), the wake is delivered once and not lost (R12: the expired request told to the run on the alarm that
   expires it, stamped woken), the consumer then wants no wake, so the alarm does not fire again at once (R1, R15), and it
   stays on its schedule: the next completion is woken at the next firing, and once a source answers `ok` it is dispatched.
   Over ai-runs' own test world and capture-requests' own (each module's real code; capture-requests' real wait source),
   never a hand-built answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../../../src/scheduler/index.mjs";
import { storage } from "./fixture.mjs";
import { world as aiWorld, OPEN, INQ, ORG, T0, sha, agentWorker } from "../ai-runs/world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";

const TOKEN = "instance-ai-secret-value-n323";
const DAY = 24 * 3600 * 1000;
const at = (m) => Date.parse(T0) + m * 60000;

/** An instance run R1 (opened under the instance's organisation credential, so the wake may dispatch it, ai-runs R18)
 *  waiting on one capture request filed through capture-requests' real door; ai-runs' path source as `path` says
 *  (null: none registered). The real scheduler runs both modules' consumers. */
async function scene(path) {
  const agent = agentWorker({ status: 202, body: { accepted: true, run_id: "R1" } });
  const w = aiWorld({ env: { AGENT_WORKER: agent, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` },
                             AI_RUN_DISPATCH_WAIT_MS: "50", AI_RUN_LEASE_MS: String(3 * DAY) }, pathReady: path });
  await w.group("ann");
  w.bundle(INQ);
  const minted = w.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  assert.equal(minted.ok, true, JSON.stringify(minted));
  w.ctx.id = { equals: (x) => x === "id:bio" };
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const stamp = `${cred.principal}/${cred.tokenId}`;
  assert.equal((await w.runs.open(OPEN({ principalPlane: stamp }))).started, true);

  const c = crWorld({ runs: w.runs });
  c.bundle(INQ);
  c.clock.ms = at(1);
  const ask = (n) => {
    const address = `https://example.org/notice-323-${n}`;
    c.hold(address);
    const a = c.cr.captureRequest({ run: "R1", address, target: INQ, purpose: "investigate" }, { viewer: V("ann"), caller: stamp });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
    return a.request;
  };
  /* capture-requests' own wait source, registered with ai-runs as the module registers it in the product (ai-runs R41) */
  assert.equal(w.runs.registerWaitSource("capture-requests", c.cr.waitSource()).ok, true);
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { aiRuns: () => w.runs, captureRequests: () => c.cr } });
  return { w, c, s, st, agent, ask };
}

const runLog = (w) => w.rows(`SELECT detail FROM observation_log WHERE authority_kind = 'run' AND authority = 'R1' ORDER BY seq`).map((r) => r.detail);

test("notice ai-runs:323, R1, R3, R12, R15: with no AI path source, the firing that expires a run's request wakes it once and ai-runs withholds the dispatch AI_PATH_NOT_READY unregistered — no error, no call to agent-worker, the completion stamped woken, the run still running, no wake left in the past; the next completion is woken at its firing, and once a source answers ok it is dispatched", async () => {
  const { w, c, s, agent, ask } = await scene(null);
  const q1 = ask(1);
  const expiry = Date.parse(c.req(q1).expires);
  assert.ok(expiry > at(1) + DAY / 2, "the request's own TTL");

  /* the firing at the expiry: capture-request-drain expires it, ai-run-wake (after it, R5) wakes R1 on the same alarm */
  const fire = expiry + 1000;
  const before = runLog(w).length;
  const r = await s.onAlarm(fire);
  assert.equal("error" in (r.airunwake || {}), false, JSON.stringify(r.airunwake).slice(0, 400));
  assert.equal(c.req(q1).state, "expired");
  assert.equal(r.airunwake.woken, 1, JSON.stringify(r.airunwake).slice(0, 400));
  const wk = r.airunwake.wakes[0];
  assert.deepEqual([wk.run, wk.woken, wk.expired, wk.resume], ["R1", true, 1, "DISPATCH"], JSON.stringify(wk).slice(0, 400));
  assert.deepEqual([wk.dispatch.state, wk.dispatch.withheld, wk.dispatch.reason], ["WITHHELD", "AI_PATH_NOT_READY", "AI_PATH_NOT_READY unregistered"]);
  assert.equal(r.airunwake.dispatched, 0);
  assert.equal(agent.calls.length, 0, "nothing reaches the agent-worker binding");
  /* not lost: told to the run once, stamped, and the run left resumable */
  assert.ok(c.req(q1).run_woken_at, "the completion is stamped woken (capture-requests R29)");
  const added = runLog(w).slice(before);
  assert.equal(added.length, 2, "the wake's entry and the withheld dispatch's");
  assert.match(added[1], /still resumable/);
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run = 'R1'`).status, "running");
  /* no busy loop: ai-run-wake wants no wake now, and the alarm is not left at or before the firing */
  assert.equal(w.runs.wakeDue(fire), 0);
  assert.equal(w.runs.wakeWake(fire), null);
  assert.ok(r.nextAt === null || r.nextAt > fire, `nextAt ${r.nextAt} after ${fire}`);
  const again = await s.onAlarm(fire + 5000);
  assert.equal("airunwake" in again, false, "the woken run is not woken again");
  assert.equal(runLog(w).length, before + 2);

  /* on its schedule: a second request's expiry is woken at its own firing, withheld again while no source stands */
  c.clock.ms = fire + 10000;
  const q2 = ask(2);
  const fire2 = Date.parse(c.req(q2).expires) + 1000;
  const r2 = await s.onAlarm(fire2);
  assert.equal(r2.airunwake.wakes[0].dispatch.withheld, "AI_PATH_NOT_READY");
  assert.ok(c.req(q2).run_woken_at);

  /* control: a registered source answering ok — the next woken completion is dispatched (agent-model R35's source, stood in
     by ai-runs' own registration seam) */
  assert.equal(w.runs.registerPathReady("plane", () => ({ state: "ok" })).ok, true);
  c.clock.ms = fire2 + 10000;
  const q3 = ask(3);
  const r3 = await s.onAlarm(Date.parse(c.req(q3).expires) + 1000);
  assert.deepEqual([r3.airunwake.wakes[0].dispatch.state, r3.airunwake.dispatched], ["RUNNING", 1], JSON.stringify(r3.airunwake).slice(0, 400));
  assert.equal(agent.calls.length, 1);
  assert.ok(c.req(q3).run_woken_at);
});

test("notice ai-runs:323, R1, R12: with a path source registered answering ok, the same firing wakes the run and dispatches it (RUNNING) on the alarm that expires its request; control: the run is not woken twice", async () => {
  const { w, c, s, agent, ask } = await scene("ok");
  const q1 = ask(1);
  const fire = Date.parse(c.req(q1).expires) + 1000;
  const r = await s.onAlarm(fire);
  assert.equal(r.airunwake.woken, 1, JSON.stringify(r.airunwake).slice(0, 400));
  assert.deepEqual([r.airunwake.wakes[0].dispatch.state, r.airunwake.dispatched], ["RUNNING", 1]);
  assert.equal(agent.calls.length, 1);
  assert.equal(agent.calls[0].body.run_id, "R1");
  assert.ok(c.req(q1).run_woken_at);
  assert.equal(w.runs.wakeDue(fire), 0);
  assert.ok(r.nextAt === null || r.nextAt > fire);
  assert.equal("airunwake" in (await s.onAlarm(fire + 5000)), false);
  assert.equal(agent.calls.length, 1);
});
