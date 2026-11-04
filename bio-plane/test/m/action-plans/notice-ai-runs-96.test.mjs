/* action-plans R51 against ai-runs PR 96 (notice ai-runs:96; ai-runs R9 as amended at T53): ai-runs renamed the run's
   paying principal `principalClaude` to `principalAi` and refuses the old name AI_RUN_CAPABILITY_UNAVAILABLE. planAsk's
   own open arguments, captured from the act, are handed to ai-runs' real `open` (its test world, its own code, a
   planning-run check registered as this module registers one), with only the world's ids put in place of this world's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, opened, by } from "./fixture.mjs";
import { world, PROJ, INQ } from "../ai-runs/world.mjs";

const PLN = "PLN-2026-0001";

async function askArgs() {
  const w = seeded();
  opened(w);
  const r = await w.ap.planAsk({ plan: w.PL, ...by("bob") });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.ctl.opens.length, 1);
  return { args: w.ctl.opens[0], P: w.P, PL: w.PL };
}

test("notice ai-runs:96 (R51): planAsk names the run's paying principal principalAi, never principalClaude, and ai-runs' real open starts the planning run on those arguments", async () => {
  const { args } = await askArgs();
  assert.equal(args.principalAi, "member:bob");
  assert.equal("principalClaude" in args, false);
  assert.equal("principalClaudeRef" in args, false);
  const aw = world({ deployedModes: ["check", "plan"] });
  await aw.group("ann", "bob");
  aw.bundle(INQ);
  aw.project(PROJ, "ann", { joined: ["bob"] });
  const heard = [];
  aw.runs.registerOpenCheck("action-plans", "plan", (a) => { heard.push(a); return null; });
  const r = await aw.runs.open({ ...args, contextId: PROJ, plan: PLN, at: "2026-07-01T00:00:00Z" });
  assert.equal(r.started, true, JSON.stringify(r).slice(0, 300));
  assert.notEqual(r.code, "AI_RUN_CAPABILITY_UNAVAILABLE");
  assert.equal(heard.length, 1, "the plan check was asked");
  assert.equal(aw.row(`SELECT principal_ai FROM ai_runs WHERE run=?`, args.run).principal_ai, "member:bob");
  /* control: the same arguments under the old name are refused by ai-runs, nothing written */
  const { principalAi, ...rest } = args;
  const stale = await aw.runs.open({ ...rest, run: `${args.run}X`, principalClaude: principalAi, contextId: PROJ, plan: PLN, at: "2026-07-01T00:00:00Z" });
  assert.equal(stale.started, false);
  assert.equal(stale.code, "AI_RUN_CAPABILITY_UNAVAILABLE");
  assert.equal(aw.row(`SELECT run FROM ai_runs WHERE run=?`, `${args.run}X`) ?? null, null, "nothing written");
});
