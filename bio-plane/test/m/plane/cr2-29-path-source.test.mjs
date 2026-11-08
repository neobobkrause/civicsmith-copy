/* CR2-29 (ai-runs R97, R98, F1; screens-inquiry CR2-14): the plane registers ai-runs' path source at start. The real Store is
   constructed (the plane's fixture), its `AGENT_WORKER` binding answered by agent-worker's own default export (`GET /health`,
   agent-model's `pathSource` over the Worker's circuit kept in its real `CircuitState` objects), and a member's own account
   made by her real act (`aiownadd`) through the object's door. A path whose circuit agent-model recorded a success answers
   `op=aipathready` ready with reason `ok`; a pair the Worker never saw answers not ready `unknown`, never `unregistered`; an
   open circuit answers not ready `open`. Control: with no binding the source is still registered (`unknown`, not
   `unregistered`), and with the registration reverted the read answers `unregistered`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, disclosed, withCatalogue } from "./fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import agentWorker from "../../../../agent-worker/src/index.mjs";
import { CircuitState, circuitHandle } from "../../../../agent-worker/src/circuit.mjs";
import { circuitRecord, BREAKER_FAILURES } from "../../../../agent-model/src/health.mjs";

const SEAL = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-cr2-29-test-0123" };
const OWN = { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-sentinel-sealed-ann-0123456789abcdef" };
const ENTRY = "entry-cr2-29";

/* the platform's Durable Object namespace for agent-worker's `HEALTH` (a platform double: one real `CircuitState` per name,
   each over an in-memory storage) */
function healthNamespace() {
  const objects = new Map();
  return {
    idFromName: (n) => String(n),
    get(id) {
      if (!objects.has(id)) {
        const kept = new Map();
        objects.set(id, new CircuitState({ storage: { get: async (k) => kept.get(k), put: async (k, v) => { kept.set(k, v); },
                                                      delete: async (k) => { kept.delete(k); } } }));
      }
      const o = objects.get(id);
      return { fetch: (input, init) => o.fetch(input instanceof Request ? input : new Request(input, init)) };
    },
  };
}

/* agent-worker's own Worker, bound as the platform binds a service: its default export's `fetch(request, env)` */
function workerBinding(env) {
  const asked = [];
  return { asked, fetch: (input, init) => { const req = input instanceof Request ? input : new Request(input, init);
                                            asked.push(new URL(req.url).pathname); return agentWorker.fetch(req, env); } };
}

const member = (x, id) => x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
  VALUES ('${id}', 'Cover ${id}', 'h_${id}', 'member', 'active', '["contribute"]', 't', 't')`);
const door = async (x, path, init) => (await x.fetch(path, init)).json();
const read = async (x, q) => {
  const a = await door(x, `/aipathready?viewer=member:ann&${new URLSearchParams(q)}`);
  return a && a.result !== undefined ? a.result : a;
};

async function world(env) {
  const x = await store({ env: { ...SEAL, ...env } });
  await withCatalogue(x.ctx);
  member(x, "ann");
  await disclosed(x.ctx);
  const set = await door(x, "/aiownadd?by=member:ann&viewer=member:ann", { method: "POST", body: JSON.stringify(OWN) });
  const made = set.result ?? set;
  assert.equal(made.ok, true, JSON.stringify(set).slice(0, 300));
  return { x, account_id: made.account_id };
}

test("CR2-29 (ai-runs R97, R98, F1): the real Store registers the path source at start; a path agent-model recorded ok answers aipathready ready, reason ok, over agent-worker's GET /health; a pair the Worker never saw reads unknown and an open circuit open, never unregistered", async () => {
  const awEnv = { HEALTH: healthNamespace() };
  const worker = workerBinding(awEnv);
  const { x, account_id } = await world({ AGENT_WORKER: worker });
  const q = { account_id, entry_id: ENTRY };

  /* never seen by the Worker: asked, not ready, `unknown` */
  const unseen = await read(x, q);
  assert.deepEqual([unseen.ok, unseen.state, unseen.ready, unseen.reason], [true, "not_ready", false, "unknown"], JSON.stringify(unseen));
  assert.ok(worker.asked.includes("/health"), "the source asked the Worker's /health");

  /* a turn agent-model recorded a success on: ready, `ok` */
  assert.equal(await circuitRecord(circuitHandle(awEnv), account_id, ENTRY, null), "ok");
  const ok = await read(x, q);
  assert.deepEqual([ok.ok, ok.state, ok.ready, ok.reason], [true, "ready", true, "ok"], JSON.stringify(ok));

  /* the breaker opened by counted failures: not ready, `open`, its reset instant passed on */
  for (let i = 0; i < BREAKER_FAILURES; i++) await circuitRecord(circuitHandle(awEnv), account_id, ENTRY, "overload");
  const open = await read(x, q);
  assert.deepEqual([open.state, open.ready, open.reason], ["not_ready", false, "open"], JSON.stringify(open));
  assert.equal(typeof open.reset_at, "string");

  /* registered once: a second registration on the same object is ai-runs' refusal */
  assert.notEqual(aiRunsOf(x.ctx).registerPathReady("plane", () => ({ state: "ok" })).ok, true);
});

test("CR2-29 control: with no AGENT_WORKER bound the source is still registered and reads unknown (fail closed), never unregistered; a Worker that throws reads unknown", async () => {
  const bare = await world({});
  const a = await read(bare.x, { account_id: bare.account_id, entry_id: ENTRY });
  assert.deepEqual([a.state, a.ready, a.reason], ["not_ready", false, "unknown"], JSON.stringify(a));

  const broken = await world({ AGENT_WORKER: { fetch: async () => { throw new Error("no such worker"); } } });
  const b = await read(broken.x, { account_id: broken.account_id, entry_id: ENTRY });
  assert.deepEqual([b.state, b.ready, b.reason], ["not_ready", false, "unknown"], JSON.stringify(b));
});
