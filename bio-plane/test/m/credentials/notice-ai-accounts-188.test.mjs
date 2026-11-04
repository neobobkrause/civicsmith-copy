/* credentials, notice ai-accounts:188 (PR 188, ai-accounts F2): ai-accounts' door arms (aiownadd, aimineuse, aimycheckset,
   aipersonalchoose, ownerOf's member arm) now take a stamped `by` that already reads `member:<id>` as the owner as it
   stands, never `member:member:<id>`. This module answers none of those arms (its ops map is its own) and builds its own
   member principals from a bare id. Confirmed with no code change: an account a member adds through the door's real
   stamping (admission's resolveSession, store-request's innerRequest) is the one credentials then serves her by
   (`accountFor`, R72's delegate), mints her run credential on, and revokes it with (R63, R73). Over the REAL credentials and
   ai-accounts (credentials' test world, ai-catalogue's published fixture). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, SECRET, PLANS } from "./fixture.mjs";
import { ask } from "../ai-accounts/helpers.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { innerRequest } from "../../../src/store-request/index.mjs";
import { resolveSession } from "../../../src/admission/index.mjs";

/* the address the plane door hands the store for `op`, from member `id`'s session, made by the providers' real code */
function stamped(op, id) {
  const caller = { cls: "member", viaSession: true, token: "t", ...resolveSession({ role: `member:${id}` }) };
  const r = innerRequest({ op, url: new URL(`https://plane.test/?op=${op}`), method: "POST", body: "{}", caller });
  assert.equal(r.refusal, undefined, JSON.stringify(r.refusal));
  return new URL(String(r.url));
}
const door = (w, op, id, body) => aiAccountsOps(w.a, stamped(op, id), body, { VERSION: "test-build" })[op]();
const look = (w, token) => w.c.aiCredentialLook({ secretSha: sha(token) }).credential;

test("notice ai-accounts:188: credentials answers none of ai-accounts' door arms PR 188 changed", () => {
  const w = world();
  const mine = Object.keys(w.ops());
  for (const op of ["aiownadd", "aimineuse", "aimycheckset", "aipersonalchoose", "aiorderset"])
    assert.equal(mine.includes(op), false, `${op} is not credentials' op`);
});

test("notice ai-accounts:188: an account ann adds through the door's stamping (by=member:ann) is the one credentials serves her by and mints her run credential on, revoked when it is removed; control: bob is not served by it, and no owner member:member:ann is written", async () => {
  const w = await world().group("ann", "bob");
  await w.ready;
  assert.equal(stamped("aiownadd", "ann").searchParams.get("by"), "member:ann");
  const set = await door(w, "aiownadd", "ann", { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: SECRET("ann") });
  assert.deepEqual([set.ok, set.owner], [true, "member:ann"], JSON.stringify(set));
  assert.equal(w.rows(`SELECT account_id FROM ai_accounts WHERE owner LIKE 'member:member:%'`).length, 0);
  await w.on(Promise.resolve(set), "ann");
  const served = await w.c.accountFor({ member: "ann", act: ask("ann") });
  assert.deepEqual([served.ok, served.account_id, served.owner], [true, set.account_id, "member:ann"], JSON.stringify(served));
  const bob = await w.c.accountFor({ member: "bob", act: ask("bob") });
  assert.notEqual(bob.account_id, set.account_id, "control: bob is not served by ann's account");
  const run = w.c.aiRunCredentialMint({ member: "ann", run: "RUN-A", writes: ["airuntick"], account_id: set.account_id });
  assert.equal(run.ok, true, JSON.stringify(run));
  assert.equal(w.a.accountRemove({ account_id: set.account_id, by: "ann" }).ok, true);
  assert.equal(look(w, run.token).revoked, true, "the run credential goes with the account");
});
