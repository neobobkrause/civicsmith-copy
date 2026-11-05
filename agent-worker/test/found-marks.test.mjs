/* agent-worker — the found marks F2, F3 and F4 (5 Nov 2026), each at the member's interface.
 *
 * F2 (coordinator ruling 5 Nov; agent-runner R13, K5576): no runner is bound. The configuration declares no `REMOTE`
 *    and no `RUNNER`, no source reads either or names `agent-runner`'s code, and a sign-in account is refused
 *    `ASSISTANT_REMOTE_NOT_READY` (`why: "absent"`) with a recording `REMOTE` stub in `env` never touched.
 * F3 (agent-model R35, R53; PR 355): the circuit is kept in this member's own `HEALTH` Durable Object and asked around
 *    each conversation: `BREAKER_FAILURES` failed drafts open it, the next is never sent, and `GET /health` answers the
 *    pair `open` with its `reset_at`. Control: with no `HEALTH` bound every call is sent and the pair reads `unknown`.
 *    A `/run` segment's model half records each conversation and its meter closes when the circuit opens.
 * F4 (agent-drafts:358): a draft's label is read as `{kind: "machine", ai}` (`label.mjs`), whatever `ai` was served. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import worker, { CircuitState } from "../src/index.mjs";
import { circuitRun, circuitAccount, DEFAULT_ENTRY } from "../src/circuit.mjs";
import { BREAKER_FAILURES } from "../../agent-model/src/health.mjs";
import { machineWork, MACHINE_WORK } from "./label.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const MEMBER = "member:ruth";
const APIKEY = { kind: "apikey", level: "member", secret: "sk-ant-found-marks-fixture", member: MEMBER };
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@found-marks",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W"),
               interface_translation: LAYER("T"), reading_translation: LAYER("RT") } };
const draftBody = (account) => ({ task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote.", account, pack: PACK });
const PLANE = { async fetch() { return Response.json({ ok: false }, { status: 500 }); } };

/** A recording namespace that throws on use: a binding nothing may touch. */
function untouchable() {
  const calls = [];
  const fail = (what) => { calls.push(what); throw new Error(`${what} touched`); };
  return { calls, idFromName: () => fail("idFromName"), newUniqueId: () => fail("newUniqueId"), get: () => fail("get") };
}
/** `HEALTH` as workerd stands it up: one `CircuitState` per name, each over its own storage. */
function healthNamespace() {
  const objects = new Map();
  return {
    idFromName: (name) => String(name),
    get: (id) => {
      if (!objects.has(id)) {
        const kept = new Map();
        objects.set(id, new CircuitState({ storage: { get: async (k) => kept.get(k), put: async (k, v) => { kept.set(k, v); },
                                                      delete: async (k) => { kept.delete(k); } } }));
      }
      const o = objects.get(id);
      return { fetch: (url, init) => o.fetch(new Request(url, init)) };
    },
  };
}
/** The model API, answering `status` (a JSON error) or a draft; counts the calls that reached it. */
function scriptModel(status) {
  const seen = { calls: 0 };
  globalThis.fetch = async () => {
    seen.calls += 1;
    if (status !== 200) return Response.json({ type: "error", error: { type: "overloaded_error", message: "busy" } }, { status });
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "u1", name: "draft", input: { text: "drafted" } }], usage: { input_tokens: 3, output_tokens: 2 } });
  };
  return seen;
}
const post = (path, body, env) => worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", body: JSON.stringify(body) }), env);
const health = async (env, account_id, entry_id) =>
  (await worker.fetch(new Request(`http://agent-worker/health?account_id=${encodeURIComponent(account_id)}&entry_id=${encodeURIComponent(entry_id)}`), env)).json();

/* ------------------------------------------------------------------------------------------------------------ F2 */

test("F2: the configuration declares no REMOTE or RUNNER binding and names no agent-runner script", () => {
  const cfg = read("wrangler.jsonc");
  assert.doesNotMatch(cfg, /"name":\s*"(REMOTE|RUNNER)"/);
  assert.doesNotMatch(cfg, /"script_name":\s*"agent-runner"/);
  assert.doesNotMatch(cfg, /RemoteSession"/);
});

test("F2: no source reads env.REMOTE or env.RUNNER, and none imports agent-runner's code", () => {
  for (const f of readdirSync(new URL("../src/", import.meta.url))) {
    const src = read(`src/${f}`);
    assert.ok(!/env\??\.(REMOTE|RUNNER)\b/.test(src), `${f} reads REMOTE or RUNNER`);
    assert.ok(!/from\s+["'][^"']*agent-runner\//.test(src), `${f} imports agent-runner`);
  }
});

test("F2: no suite of this module imports agent-runner's code", () => {
  for (const f of readdirSync(new URL("./", import.meta.url)).filter((n) => n.endsWith(".mjs"))) {
    assert.ok(!/from\s+["'][^"']*agent-runner\//.test(read(`test/${f}`)), `${f} imports agent-runner`);
  }
});

test("F2: a sign-in account is refused ASSISTANT_REMOTE_NOT_READY (absent) before any model call; REMOTE and RUNNER untouched", async () => {
  const REMOTE = untouchable(), RUNNER = untouchable();
  const seen = scriptModel(200);
  const res = await post("draft", draftBody({ kind: "signin", level: "member", member: MEMBER, secret: "held-token-fixture" }),
                         { VERSION: "t", PLANE, REMOTE, RUNNER });
  const out = await res.json();
  assert.equal(res.status, 503);
  assert.equal(out.code, "ASSISTANT_REMOTE_NOT_READY");
  assert.equal(out.why, "absent");
  assert.equal(seen.calls, 0);
  assert.deepEqual([REMOTE.calls, RUNNER.calls], [[], []]);
});

test("F2 (control): an API-key account is served with REMOTE and RUNNER in env untouched", async () => {
  const REMOTE = untouchable(), RUNNER = untouchable();
  scriptModel(200);
  const res = await post("draft", draftBody(APIKEY), { VERSION: "t", PLANE, REMOTE, RUNNER });
  assert.equal(res.status, 200);
  assert.deepEqual([REMOTE.calls, RUNNER.calls], [[], []]);
});

/* ------------------------------------------------------------------------------------------------------------ F3 */

test("F3: BREAKER_FAILURES failed drafts open the account's circuit in HEALTH; the next draft is never sent; /health answers open", async () => {
  const env = { VERSION: "t", PLANE, HEALTH: healthNamespace() };
  const seen = scriptModel(529);
  for (let i = 0; i < BREAKER_FAILURES; i += 1) assert.notEqual((await post("draft", draftBody(APIKEY), env)).status, 200);
  assert.equal(seen.calls, BREAKER_FAILURES);
  const held = await post("draft", draftBody(APIKEY), env);
  assert.notEqual(held.status, 200);
  assert.equal(seen.calls, BREAKER_FAILURES, "the draft after the circuit opened reached the model API");
  const h = await health(env, circuitAccount(APIKEY), DEFAULT_ENTRY);
  assert.equal(h.ok, true);
  assert.equal(h.state, "open");
  assert.ok(Number.isFinite(Date.parse(h.reset_at)));
});

test("F3: a success records the pair ok, read by /health", async () => {
  const env = { VERSION: "t", PLANE, HEALTH: healthNamespace() };
  scriptModel(200);
  assert.equal((await post("draft", draftBody(APIKEY), env)).status, 200);
  assert.equal((await health(env, circuitAccount(APIKEY), DEFAULT_ENTRY)).state, "ok");
});

test("F3 (control): with no HEALTH bound every draft is sent and /health answers unknown", async () => {
  const env = { VERSION: "t", PLANE };
  const seen = scriptModel(529);
  for (let i = 0; i <= BREAKER_FAILURES; i += 1) await post("draft", draftBody(APIKEY), env);
  assert.equal(seen.calls, BREAKER_FAILURES + 1);
  assert.equal((await health(env, circuitAccount(APIKEY), DEFAULT_ENTRY)).state, "unknown");
});

test("F3: a /run segment's model half records each conversation, and its meter closes when the circuit opens", async () => {
  const env = { HEALTH: healthNamespace() };
  const run = await circuitRun(env, APIKEY);
  assert.equal(run.admitted, true);
  const told = [];
  const model = run.watch({ meter: { turns: 3, turnsBound: 40 }, spent(got, mode) { told.push(mode); } });
  for (let i = 0; i < BREAKER_FAILURES; i += 1) model.spent({ refused: { status: 529, type: "overloaded_error" }, usage: null, calls: 1 }, "check");
  await run.settle();
  assert.equal(told.length, BREAKER_FAILURES, "the model half's own spent still runs");
  assert.equal(model.meter.turnsBound, 3);
  const next = await circuitRun(env, APIKEY);
  assert.deepEqual([next.admitted, next.class], [false, "circuit_open"]);
});

test("F3: the circuit names the account without its secret", () => {
  assert.equal(circuitAccount(APIKEY).includes(APIKEY.secret), false);
  assert.equal(circuitAccount({ ...APIKEY, account_id: "acct-1" }), "acct-1");
});

/* ------------------------------------------------------------------------------------------------------------ F4 */

test("F4: a draft's label reads as machine work {kind: machine, ai}, whatever ai was served", async () => {
  scriptModel(200);
  const out = await (await post("draft", draftBody(APIKEY), { VERSION: "t", PLANE })).json();
  assert.deepEqual(machineWork(out.label), MACHINE_WORK);
  assert.deepEqual(machineWork({ kind: "machine", ai: { provider: "stub", model_version: "stub-1" } }), MACHINE_WORK);
});

test("F4 (control): another kind, an extra field or an ai that is not a label is not machine work", () => {
  for (const label of [{ kind: "member" }, { kind: "machine", says: "x" }, { kind: "machine", ai: "stub" }, null, "machine"])
    assert.notDeepEqual(machineWork(label), MACHINE_WORK, JSON.stringify(label));
});
