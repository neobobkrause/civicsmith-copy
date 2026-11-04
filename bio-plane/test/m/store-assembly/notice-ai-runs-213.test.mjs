/* store-assembly: the provider notice ai-runs:213 (PR 213; ai-use:105, its R3, R18). Confirmed, no code change: the assembly
   builds ai-runs over the store's one ai-use instance (R29), and ai-runs now names the account and entry a run is served on to
   its useCheck, so a provider limit recorded on the store's ai-use for that account holds a run's open back. Fails with PR 213
   reverted (the open starts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { limitsWorld, PROJ, T0 } from "./notice-ai-use-limits.mjs";

const open = (w, run) => aiRunsOf(w.ctx).open({ run, contextType: "project", contextId: PROJ, principalPlane: "member:ann",
  principalAi: "member:ann", actor: "member:ann", viewer: "member:ann", skillVersion: "bio@1", at: T0 });

test("notice ai-runs:213 (ai-use R3, R18; ai-runs R52): through the assembled store, a provider limit on the account ann's run is served on holds the open back AI_LIMIT_REACHED; control: a limit on another account leaves it started", async () => {
  const w = await limitsWorld();
  assert.equal(w.limitOn("acct-other").ok, true);
  const o = await open(w, "R1");
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  assert.equal(w.limitOn(w.account_id).ok, true);
  const held = await open(w, "R2");
  assert.deepEqual([held.started, held.code], [false, "AI_LIMIT_REACHED"], JSON.stringify(held).slice(0, 300));
});
