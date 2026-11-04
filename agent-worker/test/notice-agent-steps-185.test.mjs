/* agent-worker over agent-steps PR 185 (its source only, no requirement text): `modelHalf.spent` now keeps each
 * conversation's `entry_id` and `label` as `converse` answers them, else null, and no longer fills in the mode's model
 * from `MODEL_FOR_MODE` or carries `model`/`effort`. This member's `POST /ask` reports each drained entry to the plane
 * as `op=askusage` (R54, R112), so its body is now exactly `{mode, entry_id, label, usage, calls}`: confirmed, no code
 * change (ask.mjs already hands the drained entry on field by field, R112's T53 shape). Driven at the member's interface
 * with the API-key path; control: the report is one body per conversation that stated usage, never invented. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { askOnce, MODEL_USAGE } from "./notice-ask-usage.mjs";

test("notice agent-steps:185 (R54, R112): each askusage body is exactly {mode, entry_id, label, usage, calls}; no model or effort is filled in", async () => {
  const r = await askOnce();
  assert.equal(r.status, 200);
  assert.ok(r.usageBodies.length > 0, "the ask reported its usage");
  for (const b of r.usageBodies) {
    assert.deepEqual(Object.keys(b), ["mode", "entry_id", "label", "usage", "calls"]);
    assert.equal(b.mode, "ask");
    assert.equal(b.entry_id, null, "a pre-T53 converse answers no entry: null, never a table's model");
    assert.equal(b.label, null);
    assert.ok(!("model" in b) && !("effort" in b));
  }
});

test("notice agent-steps:185 (control, R112): one askusage per model conversation that stated usage, its usage as stated", async () => {
  const r = await askOnce();
  assert.equal(r.usageBodies.length, 2, "the reading and the composing conversation");
  for (const b of r.usageBodies) {
    assert.equal(b.usage.input_tokens, MODEL_USAGE.input_tokens);
    assert.equal(b.usage.output_tokens, MODEL_USAGE.output_tokens);
  }
  assert.equal(r.usageBodies.reduce((n, b) => n + (b.calls ?? 1), 0), r.modelCalls, "every model call is counted once");
});
