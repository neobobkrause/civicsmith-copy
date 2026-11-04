/* scheduler — the provider notice ai-runs:96 (ai-runs PR 96, T53). Two things reach this module:
   (1) ai-runs R9 renames a run's principals (`principalAi`, `principalAiRef`); the run the scheduler's `ai-run-reap`
       consumer ends (R5, ai-runs R15) is one opened under the new names, and is reaped on the alarm at its lease's end.
   (2) ai-runs R98 registers a consumer of its own, `ai-health-probe` (key `aihealthprobe`), through this module's R8
       (`registerHealthProbe(slot)`). The real one is registered into the real scheduler: appended after R5's list,
       refused CONSUMER_DECLARED a second time, the alarm armed at its wake (a held pair's `reset_at`) and ticked there.
   Both over ai-runs' own test world (its real code over the real modules it uses), never a hand-built answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler, SCHEDULER_ORDER } from "../../../src/scheduler/index.mjs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";
import { storage } from "./fixture.mjs";
import { world, OPEN, PROJ, T0, ENTRIES, agentWorker } from "../ai-runs/world.mjs";

const STORE = { idFromName: (n) => `id:${n}` };
const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const at = (m) => Date.parse(T0) + m * 60000;
const iso = (m) => new Date(at(m)).toISOString().replace(/\.\d+Z$/, "Z");

/** ann's own run R1 over her project, opened under ai-runs R9's names and dispatched once (ai-runs' segments world). */
async function annRun() {
  const w = world({ env: { AGENT_WORKER: agentWorker({ status: 202, body: { accepted: true, run_id: "R1" } }), STORE,
                           AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.account("ann", "apikey", "secret-0-of-ann-0123456789", { entries: [ENTRIES.a] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann");
  const o = await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, at: T0, leaseMs: 600000, ...ANN }));
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  return w;
}

test("notice ai-runs:96, R5, R1: a run opened under ai-runs R9's names (principalAi) is reaped by ai-run-reap on the first firing past its lease's end, answered under airunreap; before it nothing is reaped", async () => {
  const w = await annRun();
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { aiRuns: () => w.runs } });
  const LEASE_END = at(10);
  assert.equal(await s.arm(at(1)), LEASE_END, "armed at the lease's end (ai-runs R15's reapWake)");
  /* Negative control: a firing before the lease ends reaps nothing. */
  const early = await s.onAlarm(at(5));
  assert.equal("airunreap" in early, false, "not due before the lease ends");
  assert.equal("airunreap" in (await s.onAlarm(LEASE_END)), false, "lapsed only once past it (ai-runs R15)");
  const r = await s.onAlarm(LEASE_END + 1000);
  assert.deepEqual(r.airunreap.reaped.map((x) => x.run ?? x), ["R1"], JSON.stringify(r.airunreap).slice(0, 300));
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run='R1'`).status !== "running", true, "ended");
  assert.equal(w.row(`SELECT principal_ai FROM ai_runs WHERE run='R1'`).principal_ai, "member:ann", "the column ai-runs R9 names");
});

test("notice ai-runs:96, R8: ai-runs' real ai-health-probe (its R98) registers into this scheduler once, appended after R5's list under the key aihealthprobe; a second registration is CONSUMER_DECLARED; a held pair arms the alarm at its reset_at and is probed on that firing, answered under aihealthprobe", async () => {
  const w = await annRun();
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  const st = storage();
  const s = new Scheduler({ storage: st, owners: {} });
  assert.deepEqual(w.runs.registerHealthProbe(s), { ok: true, module: "ai-runs", name: "ai-health-probe", key: "aihealthprobe", placed: "appended" });
  assert.equal(SCHEDULER_ORDER.includes("ai-health-probe"), false, "R5 does not name it: appended (R8)");
  assert.equal(w.runs.registerHealthProbe(s).reason, "CONSUMER_DECLARED", "once");
  assert.deepEqual(s.consumers(), ["ai-health-probe"]);
  /* the run stopped at a limit with nowhere to go, held until its reset_at (ai-runs R95, R98), its path not ready */
  w.runs.registerPathReady("plane", () => ({ state: "open" }));
  const held = await w.runs.tickAndContinue({ run: "R1", caller: "member:ann", viewer: "member:ann", actor: "member:ann", at: iso(1),
    segment_end: { by: "ai", done: false, refusals: [], ai_stop: { reason: "limit", class: "rate_limit", retry_after: iso(30) } } });
  assert.equal(held.segment_end.stop.decision, "held", JSON.stringify(held.segment_end).slice(0, 300));
  assert.equal(await s.arm(at(10)), at(30), "armed at the pair's reset_at, ai-runs' own instant (R7)");
  const r = await s.onAlarm(at(30));
  assert.deepEqual(r.aihealthprobe, { probed: 1, resumed: 0, still_down: 1, remaining: 0 });
  assert.deepEqual([r.nextAt, st.alarm], [at(30) + AiRuns.PROBE_INTERVAL_MS, at(30) + AiRuns.PROBE_INTERVAL_MS],
    "probed again after ai-runs' PROBE_INTERVAL_MS, never an interval of this module's");
});

/* R2, R15 against ai-runs R98: its `due(now)` answers a count of pairs due (0 when none), not the instant R98 and this
   module's consumer terms state; this module reads 0 as an instant long past, so the probe ticks (probed 0) at every
   firing while nothing is held. ai-runs' to correct; reported to BOB. */
test.todo("notice ai-runs:96, R2: with nothing held, ai-health-probe is not due and is absent from the firing's answer (ai-runs R98's due is an instant or null)");
