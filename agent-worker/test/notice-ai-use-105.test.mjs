/* agent-worker over ai-use PR 105 (ai-use R1, R11, R15; T53): `countAskUsage` now takes `{member, mode, entry_id, label,
 * usage, calls}`, the label checked against `LABEL_FIELDS`. What this member hands it is the `op=askusage` body of each
 * ask conversation (R54, R112), which the store's door passes on field by field. Confirmed, no code change: every body
 * a real `POST /ask` sends is counted by ai-use's real `countAskUsage` on its published world (its own fixture, real
 * code), with the call count it states. Control: the same body with a label field ai-use does not carry is refused
 * `AI_RUN_CONSUME_INVALID`, so the check is ai-use's and can fail. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { askOnce } from "./notice-ask-usage.mjs";
import { world } from "../../bio-plane/test/m/ai-use/fixture.mjs";
import { LABEL_FIELDS } from "../../bio-plane/src/ai-use/index.mjs";

/* As the store's door hands an `askusage` body to ai-use (store-door's dispatch). */
const count = (w, member, b) => w.u.countAskUsage({ member, mode: b.mode ?? "ask", usage: b.usage ?? null, calls: b.calls ?? null,
  entry_id: b.entry_id ?? null, label: b.label ?? null, model: b.model ?? null, effort: b.effort ?? null });

test("notice ai-use:105 (R54, R112 -> ai-use R1): every askusage body a real ask sends is counted by ai-use's countAskUsage", async () => {
  const r = await askOnce();
  assert.ok(r.usageBodies.length > 0);
  const w = await world().then((x) => x.group("ann"));
  for (const b of r.usageBodies) {
    const got = count(w, "member:ann", b);
    assert.equal(got.ok, true, `counted: ${JSON.stringify(got).slice(0, 300)}`);
  }
});

test("notice ai-use:105 (control): a label naming a field outside LABEL_FIELDS is refused AI_RUN_CONSUME_INVALID", async () => {
  const r = await askOnce();
  const w = await world().then((x) => x.group("ann"));
  const label = Object.fromEntries(LABEL_FIELDS.map((k) => [k, null]));
  const got = count(w, "member:ann", { ...r.usageBodies[0], label: { ...label, not_a_label_field: "x" } });
  assert.equal(got.ok, false);
  assert.equal(got.code, "AI_RUN_CONSUME_INVALID");
});
