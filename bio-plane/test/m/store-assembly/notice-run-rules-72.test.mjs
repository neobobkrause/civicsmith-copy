/* store-assembly: the provider notice run-rules:72 (PR 72; run-rules R19, R29, R30, R36, R37, T53), answered with ai-runs R78
   (PR 96) and the coordinator's ruling of 4 Nov: the gate of the ask, draft and transcription doors (`ask.mjs`' `deployGate`
   and `admitOn`, `transcribe.mjs`) asks `ai-runs.partAdmitted(part, entry)` on the catalogue entry of the account that serves,
   and relays `run-rules.partRefusal(part, entry, {set, held})` unchanged: R30's AI_PART_NOT_DEPLOYED names the entry with its
   words key, R37's PART_WITHDRAWN answers when the standing measure failed that part on that entry, and R29's test-instance
   exception still admits with the label. The R30 and R37 tests fail with ask.mjs reverted (no entry is named, and a
   withdrawal is never answered). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, GATE_FLAGS, GATE_SET } from "./fixture.mjs";
import { assistantGateOf, deployGate } from "../../../src/store-assembly/ask.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { partRefusal, untestedLabel, PART_REFUSAL_WORDS } from "../../../src/run-rules/index.mjs";
import { ENTRIES } from "../ai-accounts/catalogue.mjs";

const gated = (env = {}) => store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });

test("notice run-rules:72 (R30), ai-runs R78: a part ai-runs does not admit on the serving entry is refused as run-rules' partRefusal answers it, unchanged: AI_PART_NOT_DEPLOYED with its words key, naming the part and the entry", async () => {
  const x = await gated({ INSTANCE_NAME: "rr72-copy" });
  for (const [mode, kind, part] of [["ask", null, "ask"], ["draft", "own_words", "draft:own_words"]]) {
    const g = deployGate(x.ctx, x.env ?? {}, mode, kind, ENTRIES.a);
    assert.deepEqual([g.refusal.code, g.refusal.words, g.refusal.entry_id, g.refusal.part],
                     ["AI_PART_NOT_DEPLOYED", PART_REFUSAL_WORDS.AI_PART_NOT_DEPLOYED, ENTRIES.a, part]);
    assert.equal(g.untested, null);
  }
});

test("notice run-rules:72 (R37): a part the standing measure failed on the serving entry is refused PART_WITHDRAWN, naming the entry and the set; control: on another entry it is not withdrawn", async () => {
  const x = await gated({ INSTANCE_NAME: "rr72-copy" });
  assert.equal(aiRunsOf(x.ctx).testBarRecord({ part: "ask", set: GATE_SET.id, set_version: GATE_SET.version, false_alarm_rate: 0.5,
    passed: false, graded_by: "harness", at: "2026-10-02T00:00:00Z", entry_id: ENTRIES.a }).ok, true);
  const g = deployGate(x.ctx, x.env ?? {}, "ask", null, ENTRIES.a);
  assert.deepEqual(g.refusal, partRefusal("ask", ENTRIES.a, { set: GATE_SET, held: { testBars: aiRunsOf(x.ctx).testBarRecords() } }));
  assert.deepEqual([g.refusal.code, g.refusal.entry_id], ["PART_WITHDRAWN", ENTRIES.a]);
  assert.equal(deployGate(x.ctx, x.env ?? {}, "ask", null, ENTRIES.b).refusal.code, "AI_PART_NOT_DEPLOYED");
});

test("notice run-rules:72 (R29): on the test instance the exception still admits the part on its entry, with the label", async () => {
  const x = await gated({ CIVICSMITH_TEST_INSTANCE: "rr72-copy", INSTANCE_NAME: "rr72-copy" });
  const g = deployGate(x.ctx, x.env, "ask", null, ENTRIES.a);
  assert.deepEqual([g.refusal, g.untested, g.entry], [null, untestedLabel("ask"), ENTRIES.a]);
});
