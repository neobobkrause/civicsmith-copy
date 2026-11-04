/* notice ai-accounts:188 (its F2) for R16: a member's own act through ai-accounts' door now takes the stamped `by`
   (`member:<id>`) as the owner, never `member:member:<id>`. This module reaches ai-accounts and ai-use only through their
   in-plane reads, so an account a member adds through the door arm (`aiownadd`, stamped `by=member:cy`) is her own: a limit
   she sets on it and reaches is told to her alone as her own account's, in `ai.account.own`'s words. Confirmed with no code
   change of this module's. Over the real ai-accounts, ai-use and membership (ai-use's test world). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS, PROVIDER, PLANS } from "../ai-use/fixture.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });

test("notice ai-accounts:188 (R16) an account cy adds by aiownadd with the door's stamp by=member:cy is hers: her limit reached on it is told to her alone, as her own account's; none is owned by member:member:cy", async () => {
  const w = await standard();
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const url = new URL(`https://plane.test/?op=aiownadd&by=${encodeURIComponent("member:cy")}`);
  const set = await aiAccountsOps(w.a, url, { provider: PROVIDER, plan: PLANS.member, means: "sealed", secret: "fake-key-cy-0123456789" },
                                  { VERSION: "test-build" }).aiownadd();
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.equal(set.owner, "member:cy");
  assert.equal(w.a.accountSwitch({ account_id: set.account_id, on: true, by: "cy" }).ok, true);
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner LIKE 'member:member:%'`).length, 0);
  const { read } = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC }));
  assert.deepEqual(ofKind(read("cy", { now: AT }), "ai-limit-reached"), [], "control: nothing reached yet");
  assert.equal(w.u.aiLimitSet({ owner: "member:cy", scope: "ask", unit: "calls", period: "day", amount: 1, by: "cy", at: AT }).ok, true);
  w.count("member:cy", "cy", "ask", { at: "2026-10-09T11:00:00Z" });
  const [it] = ofKind(read("cy", { now: AT }), "ai-limit-reached");
  assert.ok(it, "her limit reached is told to her");
  assert.equal(it.subject.id, "own");
  assert.equal(it.fills.account, WORDS["ai.account.own"]);
  assert.deepEqual(it.recipients, ["cy"]);
  for (const m of ["ann", "bob", "second"]) assert.deepEqual(ofKind(read(m, { now: AT }), "ai-limit-reached"), [], m);
});
