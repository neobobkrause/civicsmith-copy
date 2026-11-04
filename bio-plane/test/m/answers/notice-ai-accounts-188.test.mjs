/* notice ai-accounts:188 (its F2): a member's own act through the door now takes the stamped `by` (`member:<id>`) as the
   owner, never `member:member:<id>`. answers asks `accountFor` with the member as the door stamps it, so an account a member
   adds through ai-accounts' own door arm (`aiownadd`, stamped `by=member:bob`) serves that member's ask, paid by
   `member:bob`. Confirmed with no code change of answers'. Over the real ai-accounts (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, V, PLANS } from "./fixture.mjs";
import { HOSTS } from "../ai-accounts/catalogue.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";

const BOB = V("bob");

test("notice ai-accounts:188 an account added by aiownadd with the door's stamp by=member:bob serves bob's ask: owner member:bob, never member:member:bob, never NOT_YOUR_ACCOUNT", async () => {
  const w = answersWorld();
  await w.ready;
  assert.equal(BOB, "member:bob", "answers' member is the door's stamp");
  const url = new URL(`https://plane.test/?op=aiownadd&by=${encodeURIComponent(BOB)}`);
  const set = await aiAccountsOps(w.accounts, url, { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-bob" },
                                  { VERSION: "test-build" }).aiownadd();
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.equal(set.owner, "member:bob");
  assert.equal(w.accounts.accountSwitch({ account_id: set.account_id, on: true, by: "bob" }).ok, true);
  assert.equal(w.accounts.recipientNoticeSeen({ member: "bob", provider: PLANS.provider, host: HOSTS.main, by: "bob" }).ok, true);
  const r = await w.a.askAccount({ member: BOB });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.owner, "member:bob");
  assert.equal(r.account.account_id, set.account_id);
  assert.equal(w.limit.asked.at(-1).owner, "member:bob");
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner LIKE 'member:member:%'`).length, 0);
});
