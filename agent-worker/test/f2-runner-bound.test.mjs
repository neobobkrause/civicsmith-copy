/* agent-worker — F2 and F5 (coordinator ruling 5 Nov 2026, 20:18, restated 6 Nov 03:33): the runner is bound.
 *
 * The configuration declares `RUNNER`, `agent-runner`'s class `AgentRunner` cross-script; the source reads it
 * (`remoteOf` answers it when bound). `RUNNER` here is this test's own stand-in for the Durable Object namespace
 * (`runnerNamespace`): it records each instance named and each request an instance receives, and answers a sign-in
 * step as JSON. It stands on no other module's test internals (agent-runner's helpers changed shape in its PR 610).
 * Bound, a sign-in step reaches that member's own instance at the step's route. F5: `agent-drafts`' draft paths name no
 * runner (its PR 570), so bound or not a sign-in account's draft is refused `ASSISTANT_REMOTE_NOT_READY`
 * (`why: "absent"`) before any model call and names no instance. Control: with no `RUNNER` bound a sign-in is refused
 * the same way, and `/signin` answers `RUNNER_NOT_CONFIGURED`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.mjs";
import { remoteOf } from "../src/remote.mjs";
import { SIGNIN_ROUTES } from "../src/signin.mjs";

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

/** `RUNNER` as a Durable Object namespace: each instance named is recorded, and each request an instance receives
 *  (`{name, path, body}`); a sign-in step is answered `{ok: true, step}` as JSON. */
function runnerNamespace() {
  const named = [], received = [];
  return {
    named, received,
    idFromName: (name) => { named.push(name); return name; },
    get: (id) => ({
      async fetch(url, init = {}) {
        const path = new URL(typeof url === "string" ? url : url.url).pathname;
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        received.push({ name: id, path, body });
        return Response.json({ ok: true, step: path });
      },
    }),
  };
}

/** Counts the model calls a request makes: every outbound `fetch` while `run` is awaited. */
async function modelCalls(run) {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ error: "no model in this test" }, { status: 500 }); };
  try { return { out: await run(), calls }; } finally { globalThis.fetch = real; }
}

test("F2: the configuration binds RUNNER to agent-runner's AgentRunner, and no REMOTE", () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(cfg, /\{\s*"name":\s*"RUNNER",\s*"class_name":\s*"AgentRunner",\s*"script_name":\s*"agent-runner"\s*\}/);
  assert.doesNotMatch(cfg, /"name":\s*"REMOTE"/);
});

test("F2: remoteOf answers RUNNER when bound and null otherwise; REMOTE is never read", () => {
  const ns = runnerNamespace();
  assert.equal(remoteOf({ RUNNER: ns }), ns);
  assert.equal(remoteOf({ REMOTE: ns }), null);
  assert.equal(remoteOf({}), null);
  assert.equal(remoteOf({ RUNNER: {} }), null);
});

test("F5 (agent-drafts:570): bound, a sign-in account's draft is refused ASSISTANT_REMOTE_NOT_READY (absent) before any model call", async () => {
  const RUNNER = runnerNamespace();
  const { out: res, calls } = await modelCalls(() => post("draft", draftBody(SIGNIN), { VERSION: "t", PLANE, RUNNER }));
  const out = await res.json();
  assert.equal(res.status, 503);
  assert.equal(out.code, "ASSISTANT_REMOTE_NOT_READY");
  assert.equal(out.why, "absent");
  assert.deepEqual([calls, RUNNER.named, RUNNER.received], [0, [], []], "no model call, no instance named or reached");
  assert.ok(!JSON.stringify(out).includes(SIGNIN.secret), "the secret is in no answer");
});

test("F2, F5: bound, a sign-in step reaches the runner's /signin for the member's own instance", async () => {
  const RUNNER = runnerNamespace();
  const res = await post("signin", { member: MEMBER, step: "state" }, { VERSION: "t", RUNNER });
  const out = await res.json();
  assert.notEqual(out.code, "RUNNER_NOT_CONFIGURED");
  assert.notEqual(out.code, "RUNNER_SILENT");
  assert.deepEqual(RUNNER.named, [MEMBER]);
  assert.deepEqual(RUNNER.received, [{ name: MEMBER, path: SIGNIN_ROUTES.state, body: { member: MEMBER } }],
                   "the member's own instance received the step at its route");
});

test("F2 (control): unbound, a sign-in is refused ASSISTANT_REMOTE_NOT_READY (absent) before any model call", async () => {
  const REMOTE = runnerNamespace();
  const { out: res, calls } = await modelCalls(() => post("draft", draftBody(SIGNIN), { VERSION: "t", PLANE, REMOTE }));
  const out = await res.json();
  assert.equal(res.status, 503);
  assert.equal(out.code, "ASSISTANT_REMOTE_NOT_READY");
  assert.equal(out.why, "absent");
  assert.deepEqual([calls, REMOTE.named], [0, []]);
  const s = await post("signin", { member: MEMBER, step: "state" }, { VERSION: "t" });
  assert.equal((await s.json()).code, "RUNNER_NOT_CONFIGURED");
});
