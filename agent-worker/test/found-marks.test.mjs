/* agent-worker — the found marks F3 and F4 (5 Nov 2026), each at the member's interface.
 *
 * F2: held by `f2-runner-bound.test.mjs` since the coordinator's ruling of 5 Nov 20:18 bound the runner.
 * F3 (agent-model R35, R53; PR 355): the circuit is kept in this member's own `HEALTH` Durable Object and asked around
 *    each conversation: `BREAKER_FAILURES` failed drafts open it, the next is never sent, and `GET /health` answers the
 *    pair `open` with its `reset_at`. Control: with no `HEALTH` bound every call is sent and the pair reads `unknown`.
 *    A `/run` segment's model half records each conversation and its meter closes when the circuit opens.
 *    Through the worker's own fetch, an open circuit refuses `POST /run` 503 `AI_PATH_NOT_READY` (class, retry_at) with
 *    no model call and the run unread, and `POST /ask` and `POST /transcribe` send no call; each has its closed control.
 * F4 (agent-drafts:358): a draft's label is read as `{kind: "machine", ai}` (`label.mjs`), whatever `ai` was served. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import worker, { CircuitState } from "../src/index.mjs";
import { circuitRun, circuitAccount, circuitHandle, DEFAULT_ENTRY } from "../src/circuit.mjs";
import { BREAKER_FAILURES, circuitRecord } from "../../agent-model/src/health.mjs";
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

/* F2 (the runner bound, coordinator ruling 5 Nov 20:18) is held by `f2-runner-bound.test.mjs`. */

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

/* The wiring, through the worker's own fetch (PR 364 review): `/run`, `/ask` and `/transcribe` each meet an open circuit
   before any model call. The circuit is opened as `agent-model` opens it, BREAKER_FAILURES recorded failures. */
const AIK = "aik-" + "7".repeat(64);
const GRANT = "aig-found-marks-fixture-grant";
async function openCircuit(env, account) {
  const handle = circuitHandle(env);
  for (let i = 0; i < BREAKER_FAILURES; i += 1) await circuitRecord(handle, circuitAccount(account), DEFAULT_ENTRY, "overload");
}
/** A recording plane: the credential's `whoami` reads as an `ai` credential, an ask's ceiling as not reached, the
 *  pack as PACK; every other op answers ok with nothing in it. */
function recordingPlane() {
  const ops = [];
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai" });
  return { ops, async fetch(url) {
    const op = new URL(url).searchParams.get("op") || "";
    ops.push(op);
    if (op === "whoami") return ok({ tokenClass: "ai", session: false, member: null });
    if (op === "agentpack") return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
    if (op === "askceiling") return ok({ ok: true, reached: false });
    return ok({ rows: [] });
  } };
}
const RUN_BODY = { run_id: "RUN-F3", store: "scratch", credential: AIK, account: APIKEY };
const ASK_BODY = { question: "Who held the seat?", grant: GRANT, account: APIKEY };
const TRANSCRIBE_BODY = { capture_sha: "c".repeat(64), pages: [{ page: 0, media_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAA" }], account: APIKEY };

test("F3: POST /run with the account's circuit open answers 503 AI_PATH_NOT_READY with class and retry_at; no model call, the run as it was", async () => {
  const plane = recordingPlane();
  const env = { VERSION: "t", PLANE: plane, HEALTH: healthNamespace() };
  await openCircuit(env, APIKEY);
  const seen = scriptModel(200);
  const res = await post("run", RUN_BODY, env);
  const out = await res.json();
  assert.equal(res.status, 503);
  assert.equal(out.code ?? out.reason, "AI_PATH_NOT_READY");
  assert.equal(out.run_id, "RUN-F3");
  assert.equal(out.class, "circuit_open");
  assert.ok(Number.isFinite(Date.parse(out.retry_at)), `retry_at ${out.retry_at}`);
  assert.equal(seen.calls, 0, "a model call was made");
  assert.deepEqual(plane.ops, ["whoami"], "past the credential's whoami the run was read or written");
});

test("F3 (control): POST /run with the circuit closed is admitted: the segment goes on to read its run", async () => {
  const plane = recordingPlane();
  const env = { VERSION: "t", PLANE: plane, HEALTH: healthNamespace() };
  scriptModel(200);
  const out = await (await post("run", RUN_BODY, env)).json();
  assert.notEqual(out.code ?? out.reason, "AI_PATH_NOT_READY");
  assert.ok(plane.ops.includes("airun"), `the admitted segment never read its run: ${plane.ops}`);
});

for (const [path, body] of [["ask", ASK_BODY], ["transcribe", TRANSCRIBE_BODY]]) {
  test(`F3: POST /${path} with the account's circuit open sends no call to the model API`, async () => {
    const env = { VERSION: "t", PLANE: recordingPlane(), HEALTH: healthNamespace() };
    await openCircuit(env, APIKEY);
    const seen = scriptModel(200);
    const res = await post(path, body, env);
    await res.text();
    assert.equal(seen.calls, 0, `/${path} reached the model API with the circuit open`);
  });

  test(`F3 (control): POST /${path} with the circuit closed reaches the model API`, async () => {
    const env = { VERSION: "t", PLANE: recordingPlane(), HEALTH: healthNamespace() };
    const seen = scriptModel(200);
    await (await post(path, body, env)).text();
    assert.ok(seen.calls > 0, `/${path} made no model call with the circuit closed`);
  });
}

test("F3: the circuit names the account without its secret", () => {
  assert.equal(circuitAccount(APIKEY).includes(APIKEY.secret), false);
  assert.equal(circuitAccount({ ...APIKEY, account_id: "acct-1" }), "acct-1");
});

/* ------------------------------------------------------------------------------------------------------------ F4 */

/** One `/draft` in a child whose `converse` is the real one with `ai` stated on its answer, as a served adapter states
 *  it (agent-model R21, R26; today's `converse` states none). Answers the draft's label. */
function servedLabel(ai) {
  const model = fileURLToPath(new URL("../../agent-model/src/model.mjs", import.meta.url));
  const index = fileURLToPath(new URL("../src/index.mjs", import.meta.url));
  const script = `
    import { mock } from "node:test";
    const real = { ...(await import(${JSON.stringify("file://" + model + "?real")})) };
    mock.module(${JSON.stringify("file://" + model)}, { namedExports: { ...real,
      converse: async (a) => { const o = await real.converse(a); return o && "answer" in o ? { ...o, label: ${JSON.stringify(ai)} } : o; } } });
    const { default: worker } = await import(${JSON.stringify("file://" + index)});
    globalThis.fetch = async () => Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "u1", name: "draft", input: { text: "drafted" } }], usage: { input_tokens: 3, output_tokens: 2 } });
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST", body: ${JSON.stringify(JSON.stringify(draftBody(APIKEY)))} }),
      { VERSION: "t", PLANE: { fetch: async () => Response.json({ ok: false }, { status: 500 }) } });
    process.stdout.write("OUT " + JSON.stringify(await res.json()) + "\\n");`;
  const out = execFileSync(process.execPath, ["--experimental-test-module-mocks", "--no-warnings", "--input-type=module", "-e", script], { encoding: "utf8" });
  return JSON.parse(/^OUT (.*)$/m.exec(out)[1]).label;
}

test("F4: where converse states the served AI, the draft's label carries it exactly, {kind: machine, ai}", () => {
  const ai = { provider: "stub", host: "stub.test", model_version: "stub-1", effort: "medium", account_level: "member", owner: MEMBER };
  assert.deepEqual(servedLabel(ai), { kind: "machine", ai });
});

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
