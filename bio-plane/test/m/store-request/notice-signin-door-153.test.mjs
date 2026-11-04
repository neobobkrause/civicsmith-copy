/* store-request, notice signin-door:153 (PR 153, its F1): the sign-in's `state` step reads ai-accounts' T53 `accountsof` (owner
   `member:<id>`) in place of the retired `accountreference`. Confirmed with no code change here: the world's door hands
   `subscriptionsignin` to signin-door's own function over the store (R17), so the step now answers from the store's real route.
   The recipe `connectedSignIn` now records the disclosure by the real acts first, since the token's hold asks it (ai-accounts R23). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";

test("notice signin-door:153: through the world's door a member's sign-in `state` answers from accountsof: ok, not connected and no account for a member who holds none, and never the retired route's 'unknown op'", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann");
  const st = await ann.act("subscriptionsignin", { body: { step: "state" } });
  assert.deepEqual([st.ok, st.step, st.connected, st.held, st.account_id, st.since], [true, "state", false, false, null, null]);
  assert.equal(JSON.stringify(st).includes("accountreference"), false);
  /* control: the read the step asks answers the same member's own accounts, none */
  assert.deepEqual((await ann.read("accountsof", { query: { owner: `member:${ann.member}` } })).accounts, []);
});
