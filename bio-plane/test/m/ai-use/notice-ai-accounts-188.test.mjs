/* ai-use: provider notice ai-accounts:188 (PR 188: source only, no requirement text; ai-accounts F2). Its door arms take
   the plane door's stamped `by`, already `member:<id>`, as the member owner as it stands, never `member:member:<id>`.
   Confirmed, no code change: ai-use calls no door arm, and judges a member's `explore` on the account named only when that
   account's `owner` is the member's own (R3). So an account a member adds through the door is hers here too: read by its
   id, at `yes` it passes. The stamped address is made by the providers' real code, never by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, PROVIDER, PLANS } from "./fixture.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { innerRequest } from "../../../src/store-request/index.mjs";
import { resolveSession } from "../../../src/admission/index.mjs";

const AT = "2026-10-09T12:00:00Z";

/* the address the plane door hands the store for `op`, from member `id`'s session */
function stamped(op, id) {
  const caller = { cls: "member", viaSession: true, token: "t", ...resolveSession({ role: `member:${id}` }) };
  const r = innerRequest({ op, url: new URL(`https://plane.test/?op=${op}`), method: "POST", body: "{}", caller });
  assert.equal(r.refusal, undefined, JSON.stringify(r.refusal));
  return new URL(String(r.url));
}
const door = (w, op, id, body) => aiAccountsOps(w.a, stamped(op, id), body, { VERSION: "test-build" })[op]();

test("notice ai-accounts:188 (R3): an account a member adds through the door (by stamped member:cy) is hers to ai-use: at yes its explore passes read by its id; another member naming it is refused", async () => {
  const w = await standard();
  assert.equal(stamped("aiownadd", "cy").searchParams.get("by"), "member:cy", "the door stamps by already prefixed");
  const set = await door(w, "aiownadd", "cy", { provider: PROVIDER, plan: PLANS.member, means: "sealed", secret: "fake-key-cy-door-0123456789" });
  assert.deepEqual([set.ok, set.owner], [true, "member:cy"], JSON.stringify(set));
  assert.equal(w.a.accountSwitch({ account_id: set.account_id, on: true, by: "cy" }).ok, true);
  assert.equal(w.explore(set.account_id, "yes", "cy").ok, true);
  const check = (owner, member) => w.u.useCheck({ owner, member, use: "explore", at: AT, account_id: set.account_id });
  assert.equal(check("member:cy", "cy"), null, "her door-added account, at yes, passes");
  /* control: the account is cy's alone; ann naming it is refused, as R3 refuses another's account */
  assert.equal(check("member:ann", "ann")?.code, "EXPLORE_NOT_ENABLED");
});
