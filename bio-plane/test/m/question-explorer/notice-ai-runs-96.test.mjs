/* question-explorer over ai-runs PR 96 (ai-runs R9 as T53 renames it): a run names its paying principal `principalAi` and
   its member `principalAiRef`; an open sending the old names (`principalClaude`, `principalClaudeRef`) is refused whenever
   sent. The exploring run's open (R3) is the explorer's own: the arguments its tick hands ai-runs are taken as it sent
   them and opened on ai-runs' real code (its published world, ../ai-runs/world.mjs, with steps' published world), the
   question, the step's place and the clock alone moved to that world's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, Q } from "./fixture.mjs";
import { world as runsWorld, OPEN, INQ, T0 } from "../ai-runs/world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";

/** The explorer's own open for the group's account, as its tick sent it. */
async function explorersOpen() {
  const w = await world().standard();
  await w.openRun("group");
  const [open] = w.calledAs("open");
  assert.equal(open.contextId, Q);
  return open;
}

/** ai-runs' real world, `investigate` deployed by its flag and `check` verified live, so `investigate` may deploy (run-rules R19's chain). */
async function realRuns() {
  const f = stepsWorld();
  const r = runsWorld({ steps: f.steps, deployedModes: ["check", "investigate"] });
  await r.group("ann"); r.bundle(INQ);
  await r.runs.open(OPEN({ run: "V" }));
  assert.equal(r.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  return { r, f };
}

test("notice ai-runs:96 (R3; ai-runs R9): the exploring run's open names its paying owner as principalAi and no old principal name, so ai-runs' real open no longer refuses it on its principals; with the owner moved to a member of ai-runs' world it starts, origin explore, that owner recorded as its principal; control: the same open with the old names is refused AI_RUN_CAPABILITY_UNAVAILABLE", async () => {
  const open = await explorersOpen();
  assert.equal(open.principalAi, "group", "the paying owner is principalAi");
  assert.equal(open.principalAiRef, null);
  assert.equal("principalClaude" in open || "principalClaudeRef" in open, false, "no old name is sent");
  const { r, f } = await realRuns();
  const moved = { ...open, contextId: INQ, place: f.place, at: T0 };
  /* As sent: past R9's principals. (ai-runs then judges the act's member, run-rules R18; that a team's exploring run has
     none is reported to BOB, not decided here.) */
  const asSent = await r.runs.open({ ...moved, run: "XPL-0" });
  assert.notEqual(asSent.code, "AI_RUN_CAPABILITY_UNAVAILABLE", JSON.stringify(asSent).slice(0, 300));
  /* The owner moved to a member of that world who holds an account: the explorer's open starts on ai-runs' real code. */
  const x = await r.runs.open({ ...moved, run: "XPL-1", principalAi: "member:ann", enabledBy: "member:ann" });
  assert.deepEqual([x.started, x.origin, typeof x.step], [true, "explore", "string"], JSON.stringify(x).slice(0, 400));
  assert.equal(r.row(`SELECT principal_ai FROM ai_runs WHERE run='XPL-1'`).principal_ai, "member:ann");
  /* Control: ai-runs refuses the old names whenever sent, so an explorer still sending them opens nothing. */
  const { principalAi, principalAiRef, ...rest } = moved;
  const old = await r.runs.open({ ...rest, run: "XPL-2", principalClaude: "member:ann", principalClaudeRef: principalAiRef });
  assert.deepEqual([old.started, old.code], [false, "AI_RUN_CAPABILITY_UNAVAILABLE"]);
  assert.equal(r.row(`SELECT run FROM ai_runs WHERE run='XPL-2'`), null);
});
