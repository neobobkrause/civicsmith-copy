/* Provider notice ai-accounts:188 (PR 188; ai-accounts F2): a member's own act takes the stamped `by` as the owner when it
   already reads `member:<id>`, as the plane door stamps it, never `member:member:<id>`. The door reads the member's
   account through `ai-accounts.accountFor` (R10's draft, R11's paying owner, R16) with the stamped member `member:<id>`.
   Confirmed with no code change: an account the member adds herself through ai-accounts' own arm, stamped as the plane
   door stamps (store-request's innerRequest over admission's resolveSession, the providers' real code), is the account
   the door's `askusage` counts to. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { credentialsOf } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf, aiAccountsOps } = await import("../../../src/ai-accounts/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");
const { innerRequest } = await import("../../../src/store-request/index.mjs");
const { resolveSession } = await import("../../../src/admission/index.mjs");
const { PLANS } = await import("../ai-accounts/catalogue.mjs");

const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
function stamped(op, id) {
  const caller = { cls: "member", viaSession: true, token: "t", ...resolveSession({ role: `member:${id}` }) };
  const s = innerRequest({ op, url: new URL(`https://plane.test/?op=${op}`), method: "POST", body: "{}", caller });
  assert.equal(s.refusal, undefined, JSON.stringify(s.refusal));
  return new URL(String(s.url));
}

test("notice ai-accounts:188 (store-door R11, R16; ai-accounts F2): a member's own account, added through ai-accounts' aiownadd arm under the plane door's stamp (by=member:bea), is the paying owner the door's `askusage` counts to — `member:bea`, never `member:member:bea` (control: before it, no member owner)", async () => {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00188" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx), AA = aiAccountsOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  const a = await mb.memberAdd({ memberId: "bea", cover: "cover of bea", role: "member", capabilities: null, by: "admin" });
  assert.equal(a.ok, true, JSON.stringify(a));
  await mb.enroll({ invite: a.invite, handle: "bea", password: "bea-passphrase-x" });
  assert.equal(C.aiKeepAwaySet({ on: false, by: "admin" }).ok, true);
  const owner = async () => (await r.go("askusage?viewer=member:bea", "POST", { mode: "ask", usage: USE, calls: 1 })).json.result.owner;
  assert.notEqual(await owner(), "member:bea");

  const url = stamped("aiownadd", "bea");
  assert.equal(url.searchParams.get("by"), "member:bea", "the plane door stamps by already prefixed");
  const set = await aiAccountsOps(AA, url, { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-bea-own-0188-0123456789abcdef" }, { VERSION: "test-build" }).aiownadd();
  assert.deepEqual([set.ok, set.owner], [true, "member:bea"], JSON.stringify(set));
  const sw = await aiAccountsOps(AA, stamped("aiaccountswitch", "bea"), { account_id: set.account_id, on: true }, { VERSION: "test-build" }).aiaccountswitch();
  assert.equal(sw.ok, true, JSON.stringify(sw));
  assert.equal(await owner(), "member:bea");
});
