/* ai-accounts F2 at the interface, through the door's own stamping: the plane door stamps a session's `by` as `member:<id>`
   (admission's resolveSession, carried by store-request's innerRequest), so a member's own act must take that stamp as the
   owner as it stands, never `member:member:<id>`. The stamped address is made by the providers' real code, never by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECRET } from "./fixture.mjs";
import { PLANS, ENTRIES } from "./catalogue.mjs";
import { projectWorld, on } from "./helpers.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { innerRequest } from "../../../src/store-request/index.mjs";
import { resolveSession } from "../../../src/admission/index.mjs";

/* the address the plane door hands the store for `op`, from member `id`'s session */
function stamped(op, id) {
  const caller = { cls: "member", viaSession: true, token: "t", ...resolveSession({ role: `member:${id}` }) };
  const r = innerRequest({ op, url: new URL(`https://plane.test/?op=${op}`), method: "POST", body: "{}", caller });
  assert.equal(r.refusal, undefined, JSON.stringify(r.refusal));
  return new URL(String(r.url));
}
const door = (w, op, id, body) => aiAccountsOps(w.a, stamped(op, id), body, { VERSION: "test-build" })[op]();

test("F2: through the door's stamping (by=member:ann), aiownadd sets owner member:ann and the member then orders, offers and ticks her own: never member:member:ann, never NOT_YOUR_ACCOUNT", async () => {
  const w = await projectWorld();
  assert.equal(stamped("aiownadd", "ann").searchParams.get("by"), "member:ann", "the door stamps by already prefixed");
  const set = await door(w, "aiownadd", "ann", { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: SECRET("ann") });
  assert.deepEqual([set.ok, set.owner, set.reason], [true, "member:ann", undefined], JSON.stringify(set));
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner LIKE 'member:member:%'`).length, 0);
  await on(w, Promise.resolve(set));
  const second = await on(w, w.own("ann", { entries: [ENTRIES.b] }));
  const moved = await door(w, "aiorderset", "ann", { owner: "member", account_id: second.account_id, position: 1 });
  assert.deepEqual([moved.ok, moved.accounts], [true, [second.account_id, set.account_id]], JSON.stringify(moved));
  const ticked = await door(w, "aimycheckset", "ann", { check: "P3", ticked: true });
  assert.equal(ticked.ok, true, JSON.stringify(ticked));
  const offered = await door(w, "aimineuse", "ann", { entries: [ENTRIES.a] });
  assert.equal(offered.ok, true, JSON.stringify(offered));
  /* control: the stamp, never the body, names the owner */
  const sneaky = await door(w, "aiownadd", "bob", { owner: "member:ann", provider: PLANS.provider, plan: PLANS.memberApi, secret: SECRET("bob") });
  assert.equal(sneaky.owner, "member:bob");
});
