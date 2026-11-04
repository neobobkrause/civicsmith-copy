/* store-assembly over ai-accounts' T53 seam (PR 124, F1; the coordinator's triage of ai-accounts:124: ask.mjs:211).
   ask.mjs reads the serving account's switches (`wireAccount`, R40: `accountReferenceState`, `groupKeySwitches`) and drops a
   refused sign-in's token (`tokenRefusal`) from ai-accounts, never through credentials' delegates, which T53 removed. These
   tests drive both at the module's interface over the assembled store, ai-accounts reading ai-catalogue's published fixture
   (the coordinator's CATALOGUE ruling; `withCatalogue` in the fixture). The ask and draft doors themselves wait on ai-runs'
   per-entry gate (its R78) and are not reached here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, disclosed } from "./fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { wireAccount, tokenRefusal, SIGNIN_TOKEN_REFUSED } from "../../../src/store-assembly/ask.mjs";

const SEAL = "a-long-seal-secret-for-the-seam-test";
const TOKEN = "sk-ant-oat01-SENTINEL-seam-held-token-0123456789";

async function world() {
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: SEAL } });
  const sql = x.ctx.storage.sql;
  for (const [id, role] of [["ada", "admin"], ["ann", "member"]])
    sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
              VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  await disclosed(x.ctx);          /* the old names' member form, `member:ann` */
  await disclosed(x.ctx, "ann");   /* and the bare id a sign-in's hold asks it under */
  return { ...x, acc: aiAccountsOf(x.ctx) };
}

test("R40 (ai-accounts:124 triage; ask.mjs wireAccount): a member's own key read over the seam carries her key as `secret` and her own suggestions switch; control: with the switch off, false", async () => {
  const x = await world();
  const set = await x.acc.accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" });
  assert.equal(set.ok, true, JSON.stringify(set));
  const ref = { kind: "apikey", level: "member", key: "sk-ant-zz-ann", member: "member:ann" };
  assert.equal(wireAccount(x.acc, ref, "member:ann").account.suggestions, false, "off until she turns it on");
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  const st = x.acc.accountReferenceState({ member: "member:ann", viewer: "member:ann" });
  assert.equal(st.ok, true, JSON.stringify(st));
  assert.equal(st.held, true);
  assert.deepEqual(wireAccount(x.acc, ref, "member:ann").account,
                   { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: true });
});

test("R40 (ask.mjs wireAccount): the team's key read over the seam carries the team key's own suggestions switch (`groupKeySwitches`); control: off before an administrator turns it on", async () => {
  const x = await world();
  const set = await x.acc.groupKeySet({ key: "sk-ant-zz-group", by: "ada" });
  assert.equal(set.ok, true, JSON.stringify(set));
  const ref = { kind: "apikey", level: "group", key: "sk-ant-zz-group", member: "member:ann" };
  assert.equal(wireAccount(x.acc, ref, "member:ann").suggestions, false);
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "group", switch: "suggestions", on: true, by: "ada" }).ok, true);
  assert.equal(x.acc.groupKeySwitches().suggestions, true);
  assert.equal(wireAccount(x.acc, ref, "member:ann").suggestions, true);
});

test("R40 (ask.mjs tokenRefusal; ai-accounts R19): an answer refusing a sign-in's token drops the member's held token over the seam (`issuedTokenRefused` on her sign-in account), once; control: an API key's refusal, or an answer refusing nothing, drops nothing", async () => {
  const x = await world();
  const held = await x.acc.subscriptionTokenHold({ member: "member:ann", token: TOKEN });
  assert.equal(held.ok, true, JSON.stringify(held));
  const state = () => x.acc.accountReferenceState({ member: "member:ann", viewer: "member:ann" }).subscription;
  assert.equal(state().held, true);
  /* controls first: nothing refused, and a refusal on an API key, leave the token held */
  assert.equal(tokenRefusal(x.acc, { kind: "signin", member: "member:ann" })({ ok: true }), false);
  assert.equal(tokenRefusal(x.acc, { kind: "apikey", level: "member", member: "member:ann" })({ code: SIGNIN_TOKEN_REFUSED }), false);
  assert.equal(state().held, true, "still held");
  const heard = tokenRefusal(x.acc, { kind: "signin", member: "member:ann" });
  assert.equal(heard({ code: SIGNIN_TOKEN_REFUSED }), true);
  assert.equal(state().held, false, "the refused token is dropped");
  assert.equal(heard({ code: SIGNIN_TOKEN_REFUSED }), false, "once");
});
