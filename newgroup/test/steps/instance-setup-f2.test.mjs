/* installer-steps R28 against instance-setup's F2 (land 2914227e80): agent-worker's GET /version no longer says `runner`,
   and instance-setup's `memberVersions` answers `agent-runner` as agent-worker's part, SERVING via agent-worker with its
   version (and `ai_path_ready` when a boolean), never SILENT. The verdict and the container confirmation read that
   answer as they read any member's. The answer is the provider's own: instance-setup's real `memberVersions` over
   agent-worker's real Worker, run here, and the real `op=bootstrap` arm (credentials' fixture); nothing hand-built. */
import test from "node:test";
import assert from "node:assert/strict";
import { servingVerdict, verifyServing } from "../../src/steps/index.mjs";
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { memberVersions } from "../../../bio-plane/src/setup.mjs";
import { bootstrapVersions } from "../../../bio-plane/test/m/credentials/fixtures.mjs";
import agentWorker from "../../../agent-worker/src/index.mjs";
import { immediateTimers, account, jres, realFetch } from "./world.mjs";

const WANT = "2.0.0";
const BASE = "https://grp.pfx.workers.dev";
const grp = { grp: [{ type: "plain_text", name: "VERSION", text: WANT }] };
const RUNNER = "agent-runner", HOST = "agent-worker";

/* The plane's AGENT_WORKER binding, served by agent-worker's own Worker code over its own env. */
const realAgentWorker = (version = WANT) => ({
  async fetch(url, init) { return agentWorker.fetch(new Request(url, init), { VERSION: version }, { waitUntil() {} }); },
});
/* The plane's `memberVersions` as instance-setup answers it today, over the bindings given. */
const realMemberVersions = (env) => memberVersions(env);

let restoreTimers;
test.beforeEach(() => { restoreTimers = immediateTimers(); });
test.afterEach(() => { restoreTimers(); globalThis.fetch = realFetch; });

test("R28 (instance-setup F2): agent-runner answered as agent-worker's part, from agent-worker's real /version, confirms the verdict when both were installed", async () => {
  const mv = await realMemberVersions({ AGENT_WORKER: realAgentWorker() });
  assert.equal(mv[RUNNER].state, "SERVING", "the provider's answer this test stands on");
  assert.equal(mv[RUNNER].via, HOST);
  const j = await bootstrapVersions({ storeVersion: WANT, memberVersions: mv });
  const v = servingVerdict(j, WANT, [HOST, RUNNER], true, []);
  assert.deepEqual(v, { confirmed: true, lags: [], capable: true });
  /* an extra field the provider may carry (ai_path_ready) is not read as a lag */
  assert.ok(!v.lags.some((l) => l.includes(RUNNER)));
});

test("R28 (instance-setup F2): verifyServing over the real bootstrap answer confirms; an agent-worker on another build names the runner with it", async () => {
  const right = await bootstrapVersions({ storeVersion: WANT, memberVersions: await realMemberVersions({ AGENT_WORKER: realAgentWorker() }) });
  let w = account({ pre: grp, subdomain: "pfx", copy: { bootstrap: () => jres(right) } });
  const v = await verifyServing(BASE, WANT, [HOST, RUNNER], true, []);
  assert.equal(v.confirmed, true);
  w.restore();
  const old = await bootstrapVersions({ storeVersion: WANT, memberVersions: await realMemberVersions({ AGENT_WORKER: realAgentWorker("1.9.0") }) });
  w = account({ pre: grp, subdomain: "pfx", copy: { bootstrap: () => jres(old) } });
  const lag = await verifyServing(BASE, WANT, [HOST, RUNNER], true, []);
  assert.equal(lag.confirmed, false);
  assert.ok(lag.lags.includes(word("installer.lag.member.version", { name: RUNNER, version: "1.9.0" })), "the runner is named on agent-worker's build");
  w.restore();
});

test("R28 (instance-setup F2) control: with agent-worker unbound the runner is unbound with it, and installed by this act it is a lag", async () => {
  const mv = await realMemberVersions({});
  assert.equal(mv[RUNNER].state, "UNBOUND");
  const j = await bootstrapVersions({ storeVersion: WANT, memberVersions: mv });
  const v = servingVerdict(j, WANT, [RUNNER], true, []);
  assert.equal(v.confirmed, false);
  assert.ok(v.lags.includes(word("installer.lag.member.unbound", { name: RUNNER })));
});
