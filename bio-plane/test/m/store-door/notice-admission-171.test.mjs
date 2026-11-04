/* Provider notice admission:171 (PR 171; op-declarations R24 for T53): admission's `BODY_ONLY_FIELDS` no longer names the
   retired `groupkeyset`; the team's account acts that replace it carry their credential as the body's `secret`, which
   admission's address gate refuses in a query. The door reads no row of that table: by R9 it hands a request's body to the
   owners' maps as it arrived and puts no credential on the in-process URL. Confirmed with no code change: through the door,
   composed with ai-accounts' own map as `plane` composes the maps (R1), `aiaccountadd`'s body `secret` reaches ai-accounts
   and sets the team's account, the URL handed to the map carries no secret, and no answer carries it. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { dispatch } = await import("../../../src/store-door/dispatch.mjs");
const { credentialsOf } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf, aiAccountsOps } = await import("../../../src/ai-accounts/index.mjs");
const { BODY_ONLY_FIELDS } = await import("../../../src/admission/index.mjs");
const { PLANS } = await import("../ai-accounts/catalogue.mjs");

test("notice admission:171 (store-door R1, R9): `aiaccountadd`'s secret, sent in the body, reaches ai-accounts through the door and sets the team's account; the URL the door hands the map holds no secret, and neither answer carries it (control: admission names no body-only row for the retired groupkeyset)", async () => {
  assert.equal(Object.hasOwn(BODY_ONLY_FIELDS, "groupkeyset"), false);
  const r = await record({ sealSecret: "store-door-test-seal-secret-00171" });
  await credentialsOf(r.ctx).claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  const SECRET = "sk-team-0171-0123456789abcdef0123456789";
  const seen = [];
  const store = { routes: (url, body, grant) => { seen.push(String(url));
                    return { ...aiAccountsOps(aiAccountsOf(r.ctx), url, body, r.env), ...r.store.routes(url, body, grant) }; },
                  membership: r.store.membership };
  const res = await dispatch(new Request("http://do/aiaccountadd?by=admin", { method: "POST",
    body: JSON.stringify({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed", secret: SECRET }) }), store);
  const text = await res.text(), got = JSON.parse(text);
  assert.equal(got.ok, true, text);
  assert.deepEqual([got.result.ok, got.result.owner], [true, "group"], text);
  assert.equal(text.includes(SECRET), false, "the answer carries no secret");
  assert.ok(seen.length >= 1);
  assert.equal(seen.some((u) => u.includes(SECRET)), false, "no URL handed to a map carries the secret");
});
