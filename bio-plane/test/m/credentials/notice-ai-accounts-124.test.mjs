/* credentials, notice ai-accounts:124 (PR 124, ai-accounts' compatibility seam F1). PR 124 changed four of the names this
   module delegates to `ai-accounts` byte for byte (R72's MOVED_TO_AI_ACCOUNTS): `accountFor` (its old `{key, kind}` beside
   R7's answer), `accountUsesSet`, `accountUses` and `accountUsesOf` (each the old `{owner}` form beside the `{account_id}`
   one), and added deprecated names (accountReferenceSet, groupKeySet and the rest) this module does not delegate.
   Confirmed with no code change: each delegate answers exactly what ai-accounts answers, in both forms; the added names are
   not on credentials; and an account the seam itself sets and removes (accountReferenceSet, accountReferenceRemove) still
   reaches R63/R73's revocation of the run credentials it served. Driven over the REAL credentials and ai-accounts
   (credentials' test world, ai-catalogue's published fixture), never a stand-in. Each test has a control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, SECRET } from "./fixture.mjs";
import { ask } from "../ai-accounts/helpers.mjs";
import { MOVED_TO_AI_ACCOUNTS } from "../../../src/credentials/index.mjs";

const CHANGED = ["accountFor", "accountUses", "accountUsesOf", "accountUsesSet"];
const ADDED = ["accountReferenceRemove", "accountReferenceSet", "accountReferenceState", "groupKeyNoticeSeen", "groupKeySet",
  "groupKeyState", "groupKeySwitch", "groupKeySwitches", "projectKeySet", "subscriptionTokenHold", "projectAccountSwitch",
  "projectAccountState", "projectKeyNoticeSeen", "subscriptionConnected"];
const look = (w, token) => w.c.aiCredentialLook({ secretSha: sha(token) }).credential;

test("notice ai-accounts:124: the four changed names are still R72's delegates on credentials; the names PR 124 added are on ai-accounts and not delegated here", () => {
  for (const n of CHANGED) assert.ok(MOVED_TO_AI_ACCOUNTS.includes(n), `${n} is delegated`);
  const w = world();
  for (const n of ADDED) {
    assert.equal(typeof w.a[n], "function", `ai-accounts carries ${n}`);
    assert.equal(typeof w.c[n], "undefined", `credentials does not delegate ${n}`);
  }
});

test("notice ai-accounts:124: credentials' delegates answer the old {owner} forms and accountFor's old {key, kind} exactly as ai-accounts does; control: the new {account_id} forms are unchanged, and another member's owner is refused through both alike", async () => {
  const w = await world().group("ann", "bob");
  const set = await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET("ann"), by: "ann" });
  assert.equal(set.ok, true, JSON.stringify(set));
  w.a.groupKeyNoticeSeen({ member: "ann", by: "ann" });
  /* accountFor: R7's answer, and the old `key`/`kind` (non-enumerable) through the delegate */
  const viaC = await w.c.accountFor({ member: "ann", act: ask("ann") });
  const viaA = await w.a.accountFor({ member: "ann", act: ask("ann") });
  assert.equal(viaC.ok, true, JSON.stringify(viaC));
  assert.deepEqual(viaC, viaA);
  assert.deepEqual([viaC.key, viaC.kind, viaC.account_id], [SECRET("ann"), "apikey", set.account_id]);
  /* accountUsesSet / accountUses / accountUsesOf, old form by owner */
  const s = w.c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "ann" });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.deepEqual(w.c.accountUses({ owner: "member:ann", viewer: "member:ann" }), w.a.accountUses({ owner: "member:ann", viewer: "member:ann" }));
  assert.equal(w.c.accountUses({ owner: "member:ann", viewer: "member:ann" }).uses.suggestions, true);
  assert.deepEqual(w.c.accountUsesOf({ owner: "member:ann" }), w.a.accountUsesOf({ owner: "member:ann" }));
  assert.equal(w.c.accountUsesOf({ owner: "member:ann" }).account_id, set.account_id);
  /* control: the new forms */
  assert.deepEqual(w.c.accountUsesOf({ account_id: set.account_id }), w.a.accountUsesOf({ account_id: set.account_id }));
  assert.deepEqual(w.c.accountUses({ account_id: set.account_id, viewer: "member:ann" }),
                   w.a.accountUses({ account_id: set.account_id, viewer: "member:ann" }));
  /* control: bob may not set ann's switch, through either */
  const barC = w.c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: false, by: "bob" });
  const barA = w.a.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: false, by: "bob" });
  assert.equal(barC.ok, false);
  assert.deepEqual(barC, barA);
  assert.equal(w.c.accountUsesOf({ owner: "member:ann" }).uses.suggestions, true, "nothing written by the refused act");
});

test("notice ai-accounts:124 (R63, R73): a run credential minted for the account the seam's accountReferenceSet made is revoked when the seam's accountReferenceRemove clears it; control: bob's run on his own account keeps its credential", async () => {
  const w = await world().group("ann", "bob");
  const a = await w.a.accountReferenceSet({ member: "ann", kind: "apikey", secret: SECRET("ann"), by: "ann" });
  const b = await w.a.accountReferenceSet({ member: "bob", kind: "apikey", secret: SECRET("bob"), by: "bob" });
  assert.deepEqual([a.ok, b.ok], [true, true]);
  const ra = w.c.aiRunCredentialMint({ member: "ann", run: "RUN-A", writes: ["airuntick"], account_id: a.account_id });
  const rb = w.c.aiRunCredentialMint({ member: "bob", run: "RUN-B", writes: ["airuntick"], account_id: b.account_id });
  assert.deepEqual([ra.ok, rb.ok], [true, true]);
  assert.equal(look(w, ra.token).revoked, false);
  const gone = await w.a.accountReferenceRemove({ member: "ann", by: "ann" });
  assert.equal(gone.ok, true, JSON.stringify(gone));
  assert.equal(look(w, ra.token).revoked, true, "her run's credential is revoked with the account");
  assert.equal(look(w, rb.token).revoked, false, "control: bob's is not");
});
