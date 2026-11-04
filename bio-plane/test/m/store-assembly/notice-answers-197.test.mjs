/* store-assembly: the provider notice answers:197 (PR 197; ai-use:105, its R3, R18). Confirmed, no code change: the ask and
   draft doors take the serving account and its limit from `answers.askAccount` (store-ask R1, the code here), and answers now
   names the account and its entry to the store's one ai-use (`useCheck`), so a provider limit standing on the account the ask
   is served on holds it back before anything is minted or posted. Fails with PR 197 reverted (the limit is not seen). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersOf } from "../../../src/answers/index.mjs";
import { limitsWorld } from "./notice-ai-use-limits.mjs";

test("notice answers:197 (ai-use R3, R18): through the assembled store, a provider limit on the account that serves ann's ask holds answers.askAccount back AI_LIMIT_REACHED; control: before it is recorded the account is answered with its entry", async () => {
  const w = await limitsWorld();
  const ok = await answersOf(w.ctx).askAccount({ member: "member:ann", kind: "ask" });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual([ok.account.account_id, ok.account.entry_id], [w.account_id, w.served.entry_id]);
  assert.equal(w.limitOn(w.account_id).ok, true);
  const held = await answersOf(w.ctx).askAccount({ member: "member:ann", kind: "ask" });
  assert.deepEqual([held.ok, held.code], [false, "AI_LIMIT_REACHED"], JSON.stringify(held).slice(0, 300));
});
