/* Provider notice ai-runs:96 (T53; ai-runs R9): a run names its paying principal `principalAi` and its member
   `principalAiRef`, and an argument of the old names (`principalClaude`, `principalClaudeRef`) is refused
   AI_RUN_CAPABILITY_UNAVAILABLE with nothing written. Intent's R18 hands `run` to ai-runs' `open` whole, so a member's
   run on an objective opens under the new names, and ai-runs' read answers them; a stale name is relayed as ai-runs'
   refusal, with no run held. Over the real ai-runs, built on its own test world. */
import test from "node:test";
import assert from "node:assert/strict";
import { intentOf } from "../../../src/intent/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { progressionsOf } from "../../../src/progressions/index.mjs";
import { homeOfEmpty } from "../provenance/fixtures.mjs";
import { world as runsWorld, PROJ, T0 } from "../ai-runs/world.mjs";

async function setUp() {
  const r = runsWorld();
  await r.group("ann", "bob", "cat");
  const proj = r.project(PROJ, "ann", { joined: ["bob"] });
  const i = intentOf(r.ctx, { record: r.record, membership: r.membership, promotion: r.promotion, aiRuns: r.runs,
    entities: entitiesOf(r.ctx, { record: r.record, membership: r.membership, provenance: {} }),
    progressions: progressionsOf(r.ctx, { record: r.record, provenance: homeOfEmpty() }), now: () => T0 });
  i.migrate();
  return { r, i, proj };
}

const RUN = (over = {}) => ({ run: "R-OBJ", principalPlane: "member:bob/t1", skillVersion: "bio@1",
  bounds: [{ bound: "fetches", allowed: 10 }], at: T0, ...over });

test("notice ai-runs:96 R18 workObjective opens its run under principalAi and principalAiRef, and ai-runs' read answers them as the run's principal", async () => {
  const { r, i, proj } = await setUp();
  const opened = await i.workObjective({ project: proj, reason: "Find the award records.", author: "member:bob",
    viewer: "member:bob", run: RUN({ principalAi: "member:bob", principalAiRef: "member:bob" }) });
  assert.equal(opened.started, true, JSON.stringify(opened));
  const read = await r.runs.read({ run: "R-OBJ", viewer: "member:bob" });
  assert.equal(read.found, true);
  const p = read.session.principal;
  assert.equal(p.ai, "member:bob", JSON.stringify(read.session.principal));
  assert.equal(p.plane, "member:bob/t1");
  assert.ok(!/claude/i.test(Object.keys(p).join(",")), "no principal field names claude");
  assert.deepEqual(read.session.state.instructions.authority, { kind: "objective", ref: proj });
});

test("notice ai-runs:96 R18 a run handed the old name principalClaude is refused AI_RUN_CAPABILITY_UNAVAILABLE, relayed by intent with no run held", async () => {
  const { r, i, proj } = await setUp();
  for (const stale of [{ principalClaude: "member:bob" }, { principalAi: "member:bob", principalClaudeRef: "member:bob" }]) {
    const got = await i.workObjective({ project: proj, reason: "Find the award records.", author: "member:bob",
      viewer: "member:bob", run: RUN(stale) });
    assert.equal(got.started, false, JSON.stringify(got));
    assert.equal(got.code, "AI_RUN_CAPABILITY_UNAVAILABLE");
    assert.equal(got.project, proj, "intent's answer still names the project");
    assert.equal((await r.runs.read({ run: "R-OBJ", viewer: "member:bob" })).found, false, "no run was opened");
  }
});
