/* F2 (journey-check, 7 Nov 2026): agent-worker R30 (T53) took `runner` out of its GET /version, and memberVersions still
   read `runner`, so every fresh install reported agent-runner SILENT. The runner is now read from agent-worker's current
   answer: served, it is agent-worker's part. Tested against agent-worker's real /version (its Worker's own fetch, run
   here), never a hand-built answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { memberVersions, bootstrapReport } from "../../../src/setup.mjs";
import { io, read } from "./fixture.mjs";
import agentWorker from "../../../../agent-worker/src/index.mjs";

/* The plane's AGENT_WORKER binding, served by agent-worker's own Worker code over its own env. */
const realAgentWorker = (env = { VERSION: "aw-real-1" }) => {
  const b = { calls: 0, async fetch(url, init) { b.calls += 1; return agentWorker.fetch(new Request(url, init), env, { waitUntil() {} }); } };
  return b;
};
const store = { async fetch() { return Response.json({ ok: true, result: { claimed: false, rearmed: false, consumedAt: null, storeVersion: "s" } }); } };

test("F2 memberVersions answers agent-runner from agent-worker's real /version, which no longer says runner: SERVING via agent-worker with its version, never SILENT", async () => {
  const aw = realAgentWorker();
  const said = await (await aw.fetch("https://agent-worker/version", { method: "GET" })).json();
  assert.equal(said.name, "agent-worker");
  assert.equal("runner" in said, false, "agent-worker R30 (T53): runner is gone from /version");
  const all = await memberVersions({ AGENT_WORKER: aw });
  const expected = { binding: "AGENT_WORKER", via: "agent-worker", state: "SERVING", version: "aw-real-1",
                     ...(typeof said.ai_path_ready === "boolean" ? { ai_path_ready: said.ai_path_ready } : {}) };
  assert.deepEqual(all["agent-runner"], expected);
  assert.deepEqual(all["agent-worker"], { binding: "AGENT_WORKER", state: "SERVING", version: "aw-real-1" });
  /* control: with agent-worker unbound the runner is unbound with it, never SERVING */
  assert.equal((await memberVersions({}))["agent-runner"].state, "UNBOUND");
});

test("F2 op=bootstrap answers part_signin true over agent-worker's real /version (control: no agent-worker answers false)", async () => {
  const body = async (env) => (await read(await bootstrapReport(env, "fp", { stub: store, ...io }))).body;
  assert.equal((await body({ AGENT_WORKER: realAgentWorker() })).part_signin, true);
  assert.equal((await body({})).part_signin, false);
});
