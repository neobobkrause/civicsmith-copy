/* Provider notice ai-use:105 (PR 105; ai-use R1 as T53 amends it): `countAskUsage` now takes the call's catalogue
   `entry_id` and its `label` (`agent-model` R26: provider, host, model version, effort, account level, owner; `model` and
   `effort` its fallbacks), counts the entry's use when an entry is named, and refuses a malformed label. The door's
   `askusage` (R11) handed on only `member`, `mode`, `usage`, `calls` and `owner`, so an ask's entry and label were lost.
   Adapted: the door hands the body's `entry_id`, `label`, `model` and `effort` to ai-use as sent; the instant stays
   ai-use's clock. Driven through the door over a real record, ai-use's own code judging. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { aiUseOf } = await import("../../../src/ai-use/index.mjs");
const { ENTRIES, PLANS } = await import("../ai-accounts/catalogue.mjs");

const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
const ask = (r, body) => r.go("askusage?viewer=member:bea", "POST", { mode: "ask", usage: USE, calls: 1, ...body });

test("notice ai-use:105 (store-door R11; ai-use R1): `askusage` hands the body's catalogue entry and label to ai-use's `countAskUsage` — the entry is counted and answered, the label judged by ai-use (a label field it does not carry is refused AI_RUN_CONSUME_INVALID, nothing counted), and the door's answer is ai-use's own for the same call (control: no entry named answers entry_id null)", async () => {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00105" });
  const label = { provider: PLANS.provider, host: "anthropic", model_version: "model-x", effort: "high", account_level: "member", owner: "member:bea" };

  const named = await ask(r, { entry_id: ENTRIES.a, label });
  assert.equal(named.json.ok, true, JSON.stringify(named.json));
  assert.deepEqual([named.json.result.ok, named.json.result.entry_id, named.json.result.calls], [true, ENTRIES.a, 1], JSON.stringify(named.json));
  const own = aiUseOf(r.ctx).countAskUsage({ member: "member:bea", mode: "ask", usage: USE, calls: 1, entry_id: ENTRIES.a, label, owner: named.json.result.owner });
  assert.deepEqual(named.json.result, own, "the door answers what ai-use answers for the same call");

  const fallback = await ask(r, { entry_id: ENTRIES.b, model: "model-y", effort: "low" });
  assert.deepEqual([fallback.json.result.ok, fallback.json.result.entry_id], [true, ENTRIES.b], JSON.stringify(fallback.json));

  const bad = await ask(r, { entry_id: ENTRIES.a, label: { ...label, secret: "not a label field" } });
  assert.equal(bad.json.result.ok, false, JSON.stringify(bad.json));
  assert.equal(bad.json.result.reason, "AI_RUN_CONSUME_INVALID");
  const badEffort = await ask(r, { entry_id: ENTRIES.a, effort: "NOT A WORD" });
  assert.equal(badEffort.json.result.reason, "AI_RUN_CONSUME_INVALID", JSON.stringify(badEffort.json));

  const none = await ask(r, {});
  assert.deepEqual([none.json.result.ok, none.json.result.entry_id], [true, null], JSON.stringify(none.json));
});
