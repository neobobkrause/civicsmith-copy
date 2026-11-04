/* Notice ai-runs:96 (T53; ai-runs R9): a run names its paying principal `principalAi` and its member `principalAiRef`;
   an open that still sends `principalClaude` is refused. R10's re-examination run is opened by this module's real code;
   the arguments it sends are then given to ai-runs' real `open`, in ai-runs' own world, with only the values that name
   the world's member and project swapped for that world's (the argument names are this module's, unchanged). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { world as aiWorld, PROJ, T0 } from "../ai-runs/world.mjs";

const receive = async (w, action, at = "2026-10-03") => { const ord = w.correspond(action, "received", at); await w.settle(); return ord; };

test("R10 (notice ai-runs:96): the re-examination run names its principals as principalAi and principalAiRef, and ai-runs' real open does not refuse them", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  await receive(w, s.action);
  assert.equal(w.runs.length, 1);
  const sent = w.runs[0];
  assert.equal("principalClaude" in sent, false, "the old name is not sent");
  assert.equal("principalClaudeRef" in sent, false);
  assert.equal(sent.principalAi, V("bob"));
  assert.equal(sent.principalAiRef, V("bob"));

  const a = aiWorld({ deployedModes: ["check", "plan"] });
  await a.group("ann");
  a.project(PROJ, "ann");
  const swap = (v) => (v === V("bob") ? "member:ann" : v === w.P ? PROJ : v);
  const args = Object.fromEntries(Object.entries(sent).map(([k, v]) => [k, swap(v)]));
  const r = await a.runs.open({ ...args, at: T0 });
  assert.notEqual(r && r.code, "AI_RUN_CAPABILITY_UNAVAILABLE", JSON.stringify(r).slice(0, 400));
  assert.notEqual(r && r.reason, "AI_RUN_CAPABILITY_UNAVAILABLE", JSON.stringify(r).slice(0, 400));
});

test("R10 (notice ai-runs:96) control: the same open with the old principalClaude name is refused by ai-runs' real open", async () => {
  const w = world();
  const s = w.started({ subjects: [w.S1] });
  await receive(w, s.action);
  const { principalAi, principalAiRef, ...rest } = w.runs[0];
  const a = aiWorld({ deployedModes: ["check", "plan"] });
  await a.group("ann");
  a.project(PROJ, "ann");
  const swap = (v) => (v === V("bob") ? "member:ann" : v === w.P ? PROJ : v);
  const args = Object.fromEntries(Object.entries({ ...rest, principalClaude: principalAi }).map(([k, v]) => [k, swap(v)]));
  const r = await a.runs.open({ ...args, at: T0 });
  assert.equal(r.code ?? r.reason, "AI_RUN_CAPABILITY_UNAVAILABLE");
});
