/* screens-entry re-tested against `instance-setup`'s new interface (land 2914227e80, its F2): agent-worker's GET /version
   no longer says `runner`, so `memberVersions` answers `agent-runner` SERVING from agent-worker's own answer and
   `op=bootstrap` answers `part_signin: true` where it answered `false` before. `setup` (R6, R17, R22, R33) reads from
   `bootstrap` only `claimed`, `bootstrapConfigured` and `part_scanner`, never `part_signin`, so the screen is the same
   whichever the runner's state: nothing here changes. The plane is the real store, its AGENT_WORKER binding agent-worker's
   own Worker code (never a hand-built answer). */
import test from "node:test";
import assert from "node:assert/strict";
import agentWorker from "../../../../agent-worker/src/index.mjs";
import { open, all, actOps, has, worldOf, SEAL } from "./kit.mjs";

const OTP = "otp-sentinel-f2a1";
const PW = "founder long password";
const HANDLE = "rivera";

/* the plane's AGENT_WORKER binding, served by agent-worker's own Worker over its own env */
const realAgentWorker = () => ({ fetch: (url, init) => agentWorker.fetch(new Request(url, init), { VERSION: "aw-real-1" }, { waitUntil() {} }) });
const fresh = (env = {}) => worldOf({ claimed: false, env: { ACCOUNT_SEAL_SECRET: SEAL, ...env } });
const bootOf = (o) => o.requests.find((r) => r.op === "bootstrap").answer.value;

test("re-test instance-setup F2: over agent-worker's real /version bootstrap answers part_signin true, and setup draws the claim as R6, R17, R22 state it", async () => {
  const o = await open("setup", { fragment: { boot: OTP }, world: await fresh({ AGENT_WORKER: realAgentWorker() }) });
  assert.equal(bootOf(o).part_signin, true, "the provider's new answer reaches the screen");
  assert.deepEqual(o.requests.map((r) => r.op), ["bootstrap", "groupidentity"]);
  assert.equal(all(o.tree, (e) => e.attrs.id === "su-otp")[0].attrs.value, OTP);
  assert.deepEqual(actOps(o.tree), ["claim"]);
  has(o, "screen.setup.claim"); has(o, "screen.setup.handle");
  // the claim walked: claim, login by the chosen handle, the codes
  await o.press("claim", { values: { "su-handle": HANDLE, "su-pw": PW, "su-pw2": PW } });
  assert.deepEqual(o.requests.slice(2, 5).map((r) => r.op), ["claim", "login", "recoverycodesissue"]);
  assert.equal(o.requests[3].body.handle, HANDLE);
});

test("re-test instance-setup F2 control: setup draws the same page whether bootstrap answers part_signin true or false (no agent-worker bound)", async () => {
  const withRunner = await open("setup", { fragment: { boot: OTP }, world: await fresh({ AGENT_WORKER: realAgentWorker() }) });
  const without = await open("setup", { fragment: { boot: OTP }, world: await fresh() });
  assert.equal(bootOf(withRunner).part_signin, true);
  assert.equal(bootOf(without).part_signin, false);
  assert.equal(withRunner.drawn(), without.drawn(), "setup reads nothing from part_signin");
});
