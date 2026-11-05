/* wizard-scripts: the provider notice ai-runs:391 (ai-runs R75 restated; exports AiRuns.gateVerdictRecord and
   AiRuns.gateVerdictRecords). Confirmed at this module's interface over the real ai-runs: R34 reads
   `ai-runs.partAdmitted(WRITING_HELP_PART)` with no entry, so a Gate 1 record ai-runs now writes per (entry, part) is read
   for that entry alone and leaves a writing-help draft's label as it was; writing help writes no Gate 1 record. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, V } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { untestedLabel, gatePartOf } from "../../../src/run-rules/index.mjs";

const F = V("frank");
const ON = { on: true, account: { kind: "own", level: "member" } };
const TEST_ENV = Object.freeze({ CIVICSMITH_TEST_INSTANCE: "biotest1", INSTANCE_NAME: "biotest1" });
const OFF_ENV = Object.freeze({ CIVICSMITH_TEST_INSTANCE: "biotest2", INSTANCE_NAME: "biotest1" });
const ENTRY = "anthropic:throwaway";
const ask = (w) => w.wz.writingHelp({ op: "notewrite", field: "text", told: "The gate was locked.", assistant: ON, by: F, viewer: F });

/* A Gate 1 record in ai-gate R37's shape, as ai-runs' own world stands one in: ai-gate has no code yet and is not a use of
   this module, so no fixture of its own can make one. */
// fixtures-own: harness - a throwaway Gate 1 record standing in for ai-gate, which has no code yet (BOB's ruling on Gate 1)
const gateRecord = (verdict = "passes") => ({ part: gatePartOf(wz.WRITING_HELP_PART), entry_id: ENTRY,
  suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 }, verdict, limits: [], grade: "throwaway", at: "2026-07-01T00:00:00Z" });

test("notice ai-runs:391 (R75; gateVerdictRecord, gateVerdictRecords): a Gate 1 record ai-runs writes for writing help's gate part on an entry is read for that entry, and a writing-help draft, asked with no entry (R34), keeps run-rules' label on a test instance; writing help writes no Gate 1 record", () => {
  const w = seeded({ env: TEST_ENV });
  const runs = aiRunsOf(w.host, TEST_ENV);
  runs.migrate();
  const LABEL = untestedLabel(wz.WRITING_HELP_PART);
  const before = ask(w);
  assert.deepEqual([before.code, before.untested], ["ASSISTANT_DRAFT_UNAVAILABLE", LABEL]);
  assert.deepEqual(runs.gateVerdictRecords({}), [], "writing help writes no Gate 1 record");
  const wrote = runs.gateVerdictRecord(gateRecord());
  assert.deepEqual([wrote.ok, wrote.part], [true, "draft"], "written on the gate part `draft`");
  assert.deepEqual(runs.partAdmitted(wz.WRITING_HELP_PART, ENTRY), { admitted: true, untested: null }, "ai-runs reads it for that entry: admitted by the bar");
  const after = ask(w);
  assert.deepEqual([after.code, after.untested], ["ASSISTANT_DRAFT_UNAVAILABLE", LABEL], "R34 asks with no entry: the label as before");
  assert.equal(runs.gateVerdictRecords({}).length, 1, "the draft wrote none");
  /* control: off a test instance, the same record leaves the draft unlabelled, as before it */
  const off = seeded({ env: OFF_ENV });
  const offRuns = aiRunsOf(off.host, OFF_ENV);
  offRuns.migrate();
  assert.equal("untested" in ask(off), false);
  assert.equal(offRuns.gateVerdictRecord(gateRecord()).ok, true);
  assert.equal("untested" in ask(off), false);
});
