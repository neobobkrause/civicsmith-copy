/* ai-runs' answer to provider notice ai-use:378 (ai-use R10 amended; `AiUse.useEstimate` gains `entry_id`): a batch's
   one estimate (R74) names the entry its runs are served on, so an account with too few measured acts is answered that
   entry's range (`agent-model.estimate`, basis unchanged) rather than `not_known`; the call naming an entry answers a
   promise, which openMany awaits. Over the real modules (./world.mjs) and steps' published fixture. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN, T0, ENTRIES } from "./world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const ANN_CRED = "member:ann/tok-ann";

test("notice ai-use:378 (ai-use R10; R74): openMany's estimate names the entry the batch is served on and carries its range as a settled answer — with no measured acts, the catalogue's priced entry answers price_only, never not_known; control: ai-use asked without an entry answers not_known", async () => {
  const f = stepsWorld();
  const w = world({ steps: f.steps });
  const Q = f.place.questions[0];
  await w.group("ann"); w.bundle(Q);
  const A = f.world.step({ by: ANN, work: "Ask the clerk for the agenda" });
  const r = await w.runs.openMany({ steps: [A], mode: "check", skillVersion: "bio@1", principalPlane: ANN_CRED, actor: ANN, viewer: ANN, at: T0 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(typeof r.estimate?.then, "undefined", "a settled answer, never a promise");
  assert.equal(r.estimate.ok, true, JSON.stringify(r.estimate));
  assert.equal(r.estimate.entry_id, ENTRIES.a, "the entry her runs are served on");
  assert.equal(r.estimate.estimate.basis, "price_only", JSON.stringify(r.estimate));
  /* control: the same ask of ai-use without the entry has nothing to answer from */
  const bare = aiUseOf(w.ctx).useEstimate({ owner: r.estimate.owner, use: "run", mode: "check", count: 1, viewer: ANN });
  assert.equal(bare.estimate.basis, "not_known");
});
