/* store-assembly: the provider notice run-rules:72 (PR 72; run-rules R19, R29, R30, R36, R37, T53). Confirmed, no code
   change. None of this module's own requirements reads run-rules since the split: the ask, draft and transcription doors
   (R49-R59) moved to `store-ask`, whose job owns their adaptation. The gate code still here until that job moves it
   (`ask.mjs`' `deployGate`, `transcribe.mjs`) asks `ai-runs.partAdmitted(part)` and relays `run-rules.partRefusal(part)`
   unchanged; it names no entry, so after PR 72 it answers R30's refusal with its words key and `entry_id: null`, never
   R37's PART_WITHDRAWN (which needs an entry), and R29's test-instance exception still admits it with the label. These
   fail with PR 72 reverted (no `words` key on the refusal), not with a change of this module's reverted. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, GATE_FLAGS } from "./fixture.mjs";
import { assistantGateOf, deployGate } from "../../../src/store-assembly/ask.mjs";
import { partRefusal, untestedLabel, PART_REFUSAL_WORDS } from "../../../src/run-rules/index.mjs";

const gated = (env = {}) => store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS }) });

test("notice run-rules:72 (R30): a part ai-runs does not admit is refused as run-rules' partRefusal answers it, unchanged: AI_PART_NOT_DEPLOYED with its words key and no entry", async () => {
  const x = await gated({ INSTANCE_NAME: "rr72-copy" });
  for (const [mode, kind, part] of [["ask", null, "ask"], ["draft", "own_words", "draft:own_words"]]) {
    const g = deployGate(x.ctx, x.env ?? {}, mode, kind);
    assert.deepEqual(g.refusal, partRefusal(part), part);
    assert.deepEqual([g.refusal.code, g.refusal.words, g.refusal.entry_id, g.refusal.part],
                     ["AI_PART_NOT_DEPLOYED", PART_REFUSAL_WORDS.AI_PART_NOT_DEPLOYED, null, part]);
    assert.equal(g.untested, null);
  }
});

test("notice run-rules:72 (R37) control: the gate names no entry, so it never answers PART_WITHDRAWN", async () => {
  const x = await gated({ INSTANCE_NAME: "rr72-copy" });
  assert.notEqual(deployGate(x.ctx, x.env ?? {}, "ask", null).refusal.code, "PART_WITHDRAWN");
});

test("notice run-rules:72 (R29): on the test instance the exception still admits the part with its label", async () => {
  const x = await gated({ CIVICSMITH_TEST_INSTANCE: "rr72-copy", INSTANCE_NAME: "rr72-copy" });
  const g = deployGate(x.ctx, x.env, "ask", null);
  assert.deepEqual(g, { refusal: null, untested: untestedLabel("ask") });
});
