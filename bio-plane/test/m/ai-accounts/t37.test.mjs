/* Ported from credentials' t37.test.mjs (T48-10; split map §6, K874): its account arms, each under its new id with its
   old one kept. The one keep-away read every gate asks (R7's `aiKeptAway`, was credentials R35) and keep-away's reason
   refused under a code of this module's own (R20, was R51). A member's own password change (credentials R3, R38, R44)
   and a mint's digest (R53) stay credentials', as does the refusal of its grants (credentials R27, R32). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";

const shape = (r) => ({ ok: r.ok, reason: r.reason, code: r.code, check: r.check, translation: r.translation });
const row = (table, code) => ({ ok: false, reason: code, code, check: table[code].check, translation: table[code].translation });

/* ann holds her own key with standing on; bob is a member (credentials' sessions and grants are not this module's) */
async function served() {
  const w = await world().group("ann", "bob");
  await w.c.accountReferenceSet({ member: "ann", kind: "apikey", secret: "sk-ann", by: "ann" });
  w.c.accountUsesSet({ owner: "member:ann", switch: "standing", on: true, by: "ann" });
  return w;
}

/* ===== R7 (was credentials R35): aiKeptAway, the one site of AI_KEPT_AWAY ===== */

test("R7 R21 (was credentials R35 R52): aiKeptAway answers null while the group does not keep its material away, and otherwise the one AI_KEPT_AWAY refusal (C-29.31, its `where` its one site) with keep_away as R21 answers it; the refusal accountFor and accountReferenceFor answer is exactly it; it writes nothing and is reached by no route", async () => {
  const w = await served();
  assert.equal(w.c.aiKeptAway(), null, "off by default");
  w.c.aiKeepAwaySet({ on: false, reason: "not now", by: "admin" });
  assert.equal(w.c.aiKeptAway(), null, "set off");
  const set = w.c.aiKeepAwaySet({ on: true, reason: "A confidentiality order.", by: "second" });
  const before = w.snapshot();
  const k = w.c.aiKeptAway();
  assert.deepEqual(shape(k), row(AI_ACCOUNT_CHECKS, "AI_KEPT_AWAY"));
  assert.deepEqual(Object.keys(k ?? {}).sort(), ["check", "code", "detail", "keep_away", "ok", "reason", "translation"]);
  assert.deepEqual(k.keep_away, { reason: "A confidentiality order.", set_by: "second", set_at: set.set_at });
  const { on, uses, ...state } = w.c.aiKeepAwayState();
  assert.deepEqual([on, k.keep_away], [true, state]);
  assert.equal(AI_ACCOUNT_CHECKS.AI_KEPT_AWAY.where, "src/ai-accounts/index.mjs #keptAway > is-kept-away");
  for (const r of [await w.c.accountFor({ member: "ann", act: { kind: "ask", member: "ann" } }),
                   await w.c.accountReferenceFor({ member: "ann", act: { kind: "run", member: "ann" } })])
    assert.deepEqual(r, k, "the one refusal, through the one site");
  assert.equal(w.snapshot(), before, "it writes nothing");
  assert.ok(!Object.keys(w.ops()).some((op) => /keptaway/i.test(op)), "reached by no route (aikeepawaystate is R21's)");
  w.c.aiKeepAwaySet({ on: false, by: "admin" });
  assert.equal(w.c.aiKeptAway(), null, "turned off again");
});

test("R7 (was credentials R35): aiKeptAway fails closed: when the setting cannot be read it answers the AI_KEPT_AWAY refusal, saying so, with the three null; it never throws", async () => {
  const w = await world().group("ann");
  w.sql.exec(`DROP TABLE ai_keep_away`);
  const k = w.c.aiKeptAway();
  assert.deepEqual([shape(k), k.keep_away], [row(AI_ACCOUNT_CHECKS, "AI_KEPT_AWAY"), { reason: null, set_by: null, set_at: null }]);
  assert.match(k.detail, /could not be read/);
  const broken = Object.create(Object.getPrototypeOf(w.c));
  const b = w.c.aiKeptAway.call(broken);
  assert.deepEqual([shape(b), b.keep_away], [row(AI_ACCOUNT_CHECKS, "AI_KEPT_AWAY"), { reason: null, set_by: null, set_at: null }]);
  assert.equal(w.c.aiKeptAway.length, 0);
});

/* ===== R20 (was credentials R51): a code of this module's own ===== */

test("R20 (was credentials R51): keep-away's reason refusal is AI_KEEP_AWAY_NO_REASON on row C-29.32, its number unmoved; the module holds no `NO_REASON` code of its own, so progressions' NO_REASON (C-100.18) reads its own row", () => {
  assert.deepEqual([AI_ACCOUNT_CHECKS.AI_KEEP_AWAY_NO_REASON.check, AI_ACCOUNT_CHECKS.AI_KEEP_AWAY_NO_REASON.where],
    ["C-29.32", "src/ai-accounts/index.mjs #keepAwayReason > is-keep-away-reason"]);   /* T40: shared with R22's project limit */
  assert.ok(!("NO_REASON" in AI_ACCOUNT_CHECKS));
});
