/* agent-drafts — notice answers:103 (`answers` changed its R1, PR 103: `ASK_SCOPE` equals credentials' `AI_GRANT_OPS`
 * less `aicredential`, the agent Worker's own credential read). This module's R1: a draft offered a read tool reads
 * through the grant only `answers`' `ASK_SCOPE`, and a read of any other op is refused before any plane call, the
 * refusal returned as the tool's result. Confirmed with no code change: driven at the member's interface, the default
 * export `fetch(request, env)`, with a recording plane binding, a recording runner namespace and the global `fetch`
 * replaced by a scripted model API (as the agent-worker suites drive it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../src/index.mjs";
import { ASK_SCOPE } from "../../../bio-plane/src/answers/index.mjs";
import { MEMBER } from "../account.mjs";
import { remoteBindings } from "../remote.mjs";

const GRANT = "aig-agent-drafts-fixture-grant";
const KEY = { kind: "apikey", level: "member", secret: "sk-ant-agent-drafts-fixture-never-echoed", member: MEMBER, suggestions: true };
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@agent-drafts",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W") } };
const SCOPE = ASK_SCOPE.map((e) => (typeof e === "string" ? e : e.op));

function plane() {
  const calls = [];
  return { calls, binding: { async fetch(url) {
    const op = new URL(url).searchParams.get("op") || "";
    calls.push(op);
    if (op === "agentpack") return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
    return Response.json({ ok: true, result: { op, rows: [{ id: "EVT-1" }] }, store: "scratch", tokenClass: "ai", version: "t" });
  } } };
}
function runner() {
  const connect = async (url) => {
    if (String(url).endsWith("/version")) return Response.json({ ok: true, name: "agent-runner", version: "t", capabilities: ["image"] });
    return { status: 101, webSocket: { accept() {}, close() {}, addEventListener() {}, send() {} } };
  };
  return { idFromName: (n) => ({ name: n }), newUniqueId: () => ({ name: "<unique>" }), get: () => ({ fetch: connect }) };
}
/** One writing-help draft with a grant; the model first reads `op`, then answers the draft. */
async function draftReading(op) {
  const p = plane();
  const api = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const b = JSON.parse(init.body);
    api.push(b);
    const [name, input] = api.length === 1 ? ["read", { op, args: {} }] : ["draft", { text: "drafted" }];
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${api.length}`, name, input }], usage: { input_tokens: 3, output_tokens: 2 } });
  };
  const kept = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) { kept[k] = console[k]; console[k] = () => {}; }
  try {
    const body = { task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote.", account: KEY, grant: GRANT };
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST", body: JSON.stringify(body) }),
      { VERSION: "t", PLANE: p.binding, ...remoteBindings(runner()) });
    return { status: res.status, out: await res.json(), plane: p.calls, api };
  } finally {
    globalThis.fetch = saved;
    for (const k of Object.keys(kept)) console[k] = kept[k];
  }
}
const toolResult = (req) => req.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((c) => c.type === "tool_result");

test("notice answers:103 (R1): the draft's read tool offers exactly answers' ASK_SCOPE, and aicredential is not among them", async () => {
  const r = await draftReading(SCOPE[0]);
  const read = r.api[0].tools.find((x) => x.name === "read");
  assert.deepEqual([...read.input_schema.properties.op.enum].sort(), [...SCOPE].sort());
  assert.equal(read.input_schema.properties.op.enum.includes("aicredential"), false);
});

test("notice answers:103 (R1): a draft's read of aicredential is refused before any plane call, as the tool's result, and the draft still answers 200", async () => {
  const r = await draftReading("aicredential");
  assert.equal(r.plane.includes("aicredential"), false);
  assert.equal(toolResult(r.api[1])?.is_error, true);
  assert.equal(r.status, 200);
  assert.equal(r.out.ok, true);
});

test("notice answers:103 (R1, control): a read of an op in ASK_SCOPE reaches the plane under the grant", async () => {
  const r = await draftReading(SCOPE[0]);
  assert.equal(r.plane.includes(SCOPE[0]), true);
  assert.notEqual(toolResult(r.api[1])?.is_error, true);
  assert.equal(r.status, 200);
});
