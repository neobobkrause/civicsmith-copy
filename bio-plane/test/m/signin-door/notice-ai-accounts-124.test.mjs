/* signin-door, notice ai-accounts:124 (PR 124, ai-accounts' T53 rewrite): the store's half (`ops.mjs`) is handed the
   store's `credentials` (store-assembly R49), which after PR 124 delegates `disclosureDue` alone of the sign-in names (its
   R72 list); `subscriptionTokenHold` and `subscriptionTokenRefused` are no longer on it. The door's routes now reach
   `ai-accounts` itself (`credentials.accounts`): driven here over the REAL credentials and ai-accounts (credentials' test
   world, ai-catalogue's published fixture), never a stand-in. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { signinDoorOps } from "../../../src/signin-door/ops.mjs";
import { world, SIGNIN_TOKEN } from "../credentials/fixture.mjs";

const ANN = "member:ann";
const at = (path) => new URL(`http://do/${path}`);
const run = (c, path, body = {}) => signinDoorOps(c, at(path), body, {})[at(path).pathname.slice(1)]();
const subscriptionOf = (w) => w.a.accountsOf({ owner: ANN, viewer: ANN }).accounts.find((x) => x.means === "issued") ?? null;

test("notice ai-accounts:124: over the real credentials, which no longer carries the sign-in token's names, `signintokenhold` holds the member's token on her own issued account through ai-accounts and answers no token; `signintokenrefused` drops it (held false), and asks nothing of another member's", async () => {
  const w = await world().group("ann", "bea");
  assert.equal(typeof w.c.subscriptionTokenHold, "undefined", "credentials delegates no token hold after PR 124");
  const held = await run(w.c, "signintokenhold?by=member%3Aann", { token: SIGNIN_TOKEN("ann"), validFor: "30 days" });
  assert.equal(held.ok, true, held.reason);
  assert.equal(JSON.stringify(held).includes(SIGNIN_TOKEN("ann")), false, "no token answered");
  const sub = subscriptionOf(w);
  assert.deepEqual([sub.account_id, sub.held], [held.account_id, true]);
  /* another member's refusal drops nothing of ann's */
  assert.deepEqual(run(w.c, "signintokenrefused?by=member%3Abea"), { ok: true, dropped: false });
  assert.equal(subscriptionOf(w).held, true);
  assert.deepEqual(run(w.c, "signintokenrefused?by=member%3Aann"), { ok: true, dropped: true });
  assert.equal(subscriptionOf(w).held, false, "the refused token is dropped");
});

test("notice ai-accounts:124: `signindisclosuredue` still answers through ai-accounts' `disclosureDue` (shown: `{ok: true}`), over credentials or ai-accounts handed directly", async () => {
  const w = await world().group("ann");
  assert.deepEqual(run(w.c, "signindisclosuredue?by=member%3Aann"), w.a.disclosureDue({ member: ANN }) ?? { ok: true });
  assert.deepEqual(run(w.a, "signindisclosuredue?by=member%3Aann"), run(w.c, "signindisclosuredue?by=member%3Aann"));
});
