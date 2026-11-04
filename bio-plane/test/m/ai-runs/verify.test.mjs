/* ai-runs R40 as K1606 widens it (run-rules R16, R18, R19): an open's mode is a run's mode (`ask` is no run), deployed by
   its flag AND deployable on the verifications this record holds; the run starts only at a member's act
   (`startAllowed`, C-22.19, relayed); and `verification_recorded`, the act run-rules R19 shapes, is written here. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, T0 } from "./world.mjs";
import { AI_RUNS_CHECKS, RUN_MODES } from "../../../src/run-rules/index.mjs";

function refused(r, code) {
  assert.deepEqual([r.code, r.check, r.translation], [code, AI_RUNS_CHECKS[code].check, AI_RUNS_CHECKS[code].translation],
    JSON.stringify(r).slice(0, 300));
}
async function vWorld(deployedModes) {
  const w = world({ deployedModes });
  await w.group("ann", "bob");
  w.bundle(INQ);
  return w;
}
const EVIDENCE = ["the run's log read end to end", "its one suggestion checked against the capture"];

test("R40 (K1606): an open refuses `ask` (deployed apart, and no run) by C-109.1 even when its flag deploys it, and a later chain mode until the record holds the verification of every mode before it", async () => {
  assert.deepEqual(RUN_MODES, ["check", "investigate", "extract", "plan"]);
  const w = await vWorld(["check", "investigate", "ask"]);
  const before = w.dump();
  const ask = await w.runs.open(OPEN({ mode: "ask" }));
  refused(ask, "AI_RUN_MODE_NOT_DEPLOYED");
  assert.deepEqual(ask.deployed, ["check"], "investigate is flagged but not yet deployable; ask is no run");
  refused(await w.runs.open(OPEN({ mode: "investigate" })), "AI_RUN_MODE_NOT_DEPLOYED");
  assert.equal(w.dump(), before);
  /* check's first live run, verified by a member: investigate becomes deployable, and opens */
  assert.equal((await w.runs.open(OPEN({ run: "C1" }))).started, true);
  const v = w.runs.verificationRecord({ mode: "check", run: "C1", evidence: EVIDENCE, by: "member:ann", at: T0 });
  assert.deepEqual([v.ok, v.existed, v.verified_by, v.next], [true, false, "member:ann", { mode: "investigate", deployable: true }]);
  const inv = await w.runs.open(OPEN({ run: "I1", mode: "investigate" }));
  assert.equal(inv.started, true, JSON.stringify(inv));
  /* extract stays refused: not flagged, and investigate's own verification is not held */
  refused(await w.runs.open(OPEN({ run: "E1", mode: "extract" })), "AI_RUN_MODE_NOT_DEPLOYED");
});

test("R9, R52 (K1606): a run starts only at a member's act — a machine credential naming no member is refused AI_RUN_NOT_A_MEMBER_ACT (C-22.19, run-rules' row, relayed) before anything is written; a member's act passes to the account check", async () => {
  const w = await vWorld(undefined);
  const before = w.dump();
  for (const o of [{ principalAi: "instance" }, { principalPlane: "class:admin", principalAi: "project" }, { principalPlane: ORG, principalAi: "" + "class:ai/x" }])
    refused(await w.runs.open(OPEN(o)), "AI_RUN_NOT_A_MEMBER_ACT");
  assert.equal(w.dump(), before);
  assert.equal((await w.runs.open(OPEN({ principalAi: "member:bob" }))).started, true);
});

test("R40 (K1606; run-rules R19): verificationRecord writes verification_recorded — refused by checkVerification (C-22.20) for a mode outside the order, no run, a machine verifier or no evidence, and for a run this record does not hold in that mode; append-only; the op stamps `by`", async () => {
  const w = await vWorld(["check", "investigate"]);
  await w.runs.open(OPEN({ run: "C1" }));
  const before = w.dump() + JSON.stringify(w.rows(`SELECT * FROM ai_mode_verifications`));
  const unfit = (o, field) => { const r = w.runs.verificationRecord({ mode: "check", run: "C1", evidence: EVIDENCE, by: "member:ann", at: T0, ...o });
    refused(r, "AI_RUN_VERIFICATION_UNFIT"); assert.equal(r.field, field, JSON.stringify(o)); };
  unfit({ mode: "ask" }, "mode");
  unfit({ mode: "nonsense" }, "mode");
  unfit({ run: "" }, "run");
  unfit({ by: "class:ai/tok-org" }, "verified_by");
  unfit({ by: null }, "verified_by");
  unfit({ evidence: [] }, "evidence");
  unfit({ evidence: "  " }, "evidence");
  unfit({ run: "R404" }, "run");
  unfit({ mode: "investigate" }, "run");
  assert.equal(w.dump() + JSON.stringify(w.rows(`SELECT * FROM ai_mode_verifications`)), before, "nothing recorded");
  const first = await w.op("airunverify", { by: "member:bob" }, { mode: "check", run: "C1", evidence: EVIDENCE, by: "member:ann", at: T0 });
  assert.deepEqual([first.ok, first.verified_by], [true, "member:bob"], "the stamp, never the body's word");
  const again = w.runs.verificationRecord({ mode: "check", run: "C1", evidence: ["later"], by: "member:ann", at: "2026-07-02T00:00:00Z" });
  assert.deepEqual([again.ok, again.existed, again.at, again.verified_by], [true, true, T0, "member:ann"]);
  assert.deepEqual(w.runs.verifications(), [{ mode: "check", run: "C1", verified_by: "member:bob", at: T0, evidence: EVIDENCE }]);
  const d = w.record.declaredTables().find((t) => t.name === "ai_mode_verifications");
  assert.deepEqual([d.module, d.export, d.sight], ["ai-runs", "admin-only", "group"]);
});
