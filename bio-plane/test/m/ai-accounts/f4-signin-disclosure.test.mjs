/* ai-accounts F4 through the assembled store: a sign-in's hold (`signintokenhold`, the sign-in door's store-internal route over
   `subscriptionTokenHold`) asks the disclosure (R23) under the member's reference, `member:<id>`, the spelling the door stamps
   and `instance-setup` (its R54, `disclosureshown`) records, never the bare id. The store is store-assembly's real one
   (`assembleStore` over node:sqlite), the disclosure recorded through its own door, the read registered by the composition
   root; nothing here is hand-built. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "../store-assembly/fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { ASSISTANT_DISCLOSURE } from "../../../src/setup.mjs";

const SEAL = "a-long-seal-secret-for-the-f4-test";
const TOKEN = (who) => `sk-ant-oat01-SENTINEL-f4-${who}-0123456789abcdef`;

async function world() {
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: SEAL } });
  for (const id of ["ann", "bob"])
    x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
      VALUES (?, ?, ?, 'member', 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`);
  const door = async (path, body) => JSON.parse(await (await x.fetch(path, { method: "POST", body: JSON.stringify(body) })).text());
  return { ...x, door, acc: aiAccountsOf(x.ctx) };
}

test("F4: through the assembled store, a member who has seen the disclosure (recorded by the door under member:ann) holds a sign-in token at signintokenhold, her issued account set and held; control: a member never shown it is refused DISCLOSURE_DUE and nothing is written", async () => {
  const x = await world();
  const shown = await x.door("/disclosureshown?by=member:ann&viewer=member:ann", { member: "member:ann", version: ASSISTANT_DISCLOSURE.version });
  assert.equal(shown.result.ok, true, JSON.stringify(shown));
  assert.equal(x.acc.disclosureDue({ member: "member:ann" }), null, "the store's own read: ann has seen it");

  const held = await x.door("/signintokenhold?by=member:ann", { token: TOKEN("ann") });
  assert.equal(held.result.ok, true, JSON.stringify(held));
  assert.equal(held.result.reason, undefined);
  assert.ok(!JSON.stringify(held).includes(TOKEN("ann")), "the answer never carries the token");
  const mine = x.acc.accountsOf({ owner: "member:ann", viewer: "member:ann" });
  const issued = (mine.accounts ?? []).filter((a) => a.means === "issued");
  assert.equal(issued.length, 1, JSON.stringify(mine));
  assert.deepEqual([issued[0].owner, issued[0].held], ["member:ann", true]);

  /* control: bob was never shown it */
  const refused = await x.door("/signintokenhold?by=member:bob", { token: TOKEN("bob") });
  assert.deepEqual([refused.result.ok, refused.result.reason], [false, "DISCLOSURE_DUE"], JSON.stringify(refused));
  const his = x.acc.accountsOf({ owner: "member:bob", viewer: "member:bob" });
  assert.equal((his.accounts ?? []).length, 0, "nothing was written for bob");
});
