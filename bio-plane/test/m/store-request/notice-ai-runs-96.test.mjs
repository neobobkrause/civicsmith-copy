/* store-request, notice ai-runs:96 (PR 96: R9 and the run's principals renamed for T53; open, dispatchMemberRun and partAdmitted
   changed). Adapted: a run names its paying principal as `principalAi` (R9); `principalClaude`, the old name, is refused whenever
   sent. The recipe `openRun` (under `recipes.contradiction`, `machineReading` and the rest) sent the old name and so no run opened;
   it now sends `principalAi`. Confirmed: the world's `dispatchMemberRun` RPC hands ai-runs only run, by, viewer, at, trace and
   memberRef (door-ops.test R27), which PR 96 did not change. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";
import { aiAccount, openRun } from "./recipes.mjs";

test("notice ai-runs:96: recipes' openRun opens a run under the team's account by the real airunopen with principalAi; control: the same act naming the old principalClaude is refused AI_RUN_CAPABILITY_UNAVAILABLE and opens nothing", async () => {
  const w = await storeWorld({ ai: true });
  const admin = await w.signIn("admin");
  await aiAccount(w, admin);
  const projectId = await w.recipes.project(admin, "Run notice project");
  const run = await openRun(w, admin, projectId);
  assert.match(run, /^RUN-/);
  const old = await w.door({ url: "/api/?op=airunopen", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ run: `${run}-old`, contextType: "project", contextId: projectId, skillVersion: "contradiction@1",
                           principalClaude: `member:${admin.member}`, mode: "check" }) } }, admin);
  const r = old.json && old.json.result !== undefined ? old.json.result : old.json;
  assert.equal(r.started === true, false);
  assert.equal(r.reason ?? r.code, "AI_RUN_CAPABILITY_UNAVAILABLE");
});
