/* agent-worker — F2 (coordinator ruling 5 Nov 2026, 20:18): the runner is bound.
 *
 * The configuration declares `RUNNER`, `agent-runner`'s class `AgentRunner` cross-script; the source reads it
 * (`remoteOf` answers it when bound). Driven over `agent-runner`'s own wire: its image's real server (`agentRunnerOf`,
 * started in process by its own test helper over a stubbed SDK and Claude binary) stands behind a `RUNNER` namespace
 * that forwards each instance's request to it, a conversation's upgrade as a WebSocket. A sign-in account's draft
 * reaches that member's own instance and its conversation runs there; a sign-in step reaches the runner's `/signin`.
 * Control: with no `RUNNER` bound a sign-in is refused `ASSISTANT_REMOTE_NOT_READY` (`why: "absent"`) before any model
 * call, and `/signin` answers `RUNNER_NOT_CONFIGURED`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.mjs";
import { remoteOf } from "../src/remote.mjs";
import { stubSdk, success, startRunner } from "../../agent-runner/test/helpers.mjs";

const MEMBER = "member:ruth";
const SIGNIN = { kind: "signin", level: "member", member: MEMBER, secret: "held-token-f2-fixture" };
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@f2",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W"),
               interface_translation: LAYER("T"), reading_translation: LAYER("RT") } };
const draftBody = (account) => ({ task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote.", account, pack: PACK });
const PLANE = { async fetch() { return Response.json({ ok: false }, { status: 500 }); } };
const post = (path, body, env) => worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", body: JSON.stringify(body) }), env);

/** `RUNNER` as workerd stands it up over the runner's image at `base`: each instance named, each request forwarded to
 *  the image unchanged, a WebSocket upgrade answered with a Workers-shaped `webSocket` over a real connection. */
function runnerNamespace(base) {
  const named = [];
  return {
    named,
    idFromName: (name) => { named.push(name); return name; },
    get: () => ({
      async fetch(url, init = {}) {
        const path = new URL(typeof url === "string" ? url : url.url).pathname;
        const upgrade = new Headers(init.headers || {}).get("upgrade");
        if (String(upgrade).toLowerCase() !== "websocket") return fetch(`http://${base}${path}`, init);
        const ws = new WebSocket(`ws://${base}${path}`);
        const queued = [];
        let open = false;
        ws.addEventListener("open", () => { open = true; for (const t of queued.splice(0)) ws.send(t); });
        return { status: 101, webSocket: {
          accept() {},
          send(t) { if (open) ws.send(t); else queued.push(t); },
          close(code, reason) { ws.close(code, reason); },
          addEventListener: (type, fn) => ws.addEventListener(type, fn),
        } };
      },
    }),
  };
}

/** The SDK's script: the conversation ends by calling the draft's final tool through the runner's relay. */
const drafting = () => stubSdk(async (call, { callTool }) => {
  const tool = (call.listed || []).find((t) => /draft$/.test(t.name));
  if (tool) await callTool(tool.name, { text: "drafted" }).catch(() => null);
  return success();
});

test("F2: the configuration binds RUNNER to agent-runner's AgentRunner, and no REMOTE", () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(cfg, /\{\s*"name":\s*"RUNNER",\s*"class_name":\s*"AgentRunner",\s*"script_name":\s*"agent-runner"\s*\}/);
  assert.doesNotMatch(cfg, /"name":\s*"REMOTE"/);
});

test("F2: remoteOf answers RUNNER when bound and null otherwise; REMOTE is never read", () => {
  const ns = runnerNamespace("127.0.0.1:1");
  assert.equal(remoteOf({ RUNNER: ns }), ns);
  assert.equal(remoteOf({ REMOTE: ns }), null);
  assert.equal(remoteOf({}), null);
  assert.equal(remoteOf({ RUNNER: {} }), null);
});

test("F2: bound, a sign-in account's draft reaches the member's own runner instance and its conversation runs there", async () => {
  const { calls, sdk } = drafting();
  const r = await startRunner(sdk);
  try {
    const RUNNER = runnerNamespace(r.base);
    const res = await post("draft", draftBody(SIGNIN), { VERSION: "t", PLANE, RUNNER });
    const out = await res.json();
    assert.notEqual(out.code, "ASSISTANT_REMOTE_NOT_READY");
    assert.ok(RUNNER.named.length > 0 && RUNNER.named.every((n) => n === MEMBER), "only the member's own instance is named");
    assert.equal(calls.length, 1, "the conversation ran in the runner");
    assert.ok(r.lines.some((l) => l.event && /conversation|runner/.test(l.event)), "the runner logged the conversation");
    assert.ok(!JSON.stringify(out).includes(SIGNIN.secret), "the secret is in no answer");
  } finally { await r.stop(); }
});

test("F2: bound, a sign-in step reaches the runner's /signin for the member's own instance", async () => {
  const r = await startRunner(stubSdk(async () => success()).sdk);
  try {
    const RUNNER = runnerNamespace(r.base);
    const res = await post("signin", { member: MEMBER, step: "state" }, { VERSION: "t", RUNNER });
    const out = await res.json();
    assert.notEqual(out.code, "RUNNER_NOT_CONFIGURED");
    assert.notEqual(out.code, "RUNNER_SILENT");
    assert.deepEqual(RUNNER.named, [MEMBER]);
    assert.ok(r.lines.some((l) => l.event === "signin.runner" && l.step === "state"), "the runner answered the step");
  } finally { await r.stop(); }
});

test("F2 (control): unbound, a sign-in is refused ASSISTANT_REMOTE_NOT_READY (absent) before any model call", async () => {
  const { calls, sdk } = drafting();
  const r = await startRunner(sdk);
  try {
    const REMOTE = runnerNamespace(r.base);
    const res = await post("draft", draftBody(SIGNIN), { VERSION: "t", PLANE, REMOTE });
    const out = await res.json();
    assert.equal(res.status, 503);
    assert.equal(out.code, "ASSISTANT_REMOTE_NOT_READY");
    assert.equal(out.why, "absent");
    assert.deepEqual([calls.length, REMOTE.named], [0, []]);
    const s = await post("signin", { member: MEMBER, step: "state" }, { VERSION: "t" });
    assert.equal((await s.json()).code, "RUNNER_NOT_CONFIGURED");
  } finally { await r.stop(); }
});
