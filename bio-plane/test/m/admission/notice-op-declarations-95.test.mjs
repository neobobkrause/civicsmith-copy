/* admission: provider notice op-declarations:95 (PR 95: R20, R24, R30, R41 restated for T53; ai-accounts R35). The group
   key's ops (`groupkeyset` and the rest), the account-reference ops and `subscriptiondisconnect` are retired with no
   alias, so admission names none of them in what it judges: no row of BODY_ONLY_FIELDS (R19, R20) names an op without a
   spec. The team's account acts that replace the group key carry their credential as the body's `secret`, which R20's
   address gate refuses in a query for every op, so `aiaccountadd` needs no row of its own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, refused, hex64 } from "./harness.mjs";

const RETIRED = ["groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeystate", "groupkeynotice", "groupkeynoticeseen",
                 "accountreferenceset", "accountreferenceremove", "accountreference", "subscriptiondisconnect"];

test("notice op-declarations:95 (R19, R20): every op BODY_ONLY_FIELDS names has a spec, and none is a retired op; control: the doors' and handlecheck's rows stay", () => {
  for (const op of RETIRED) assert.equal(Object.hasOwn(O.OPS, op), false, `${op} is retired (op-declarations R20, R24, R30)`);
  for (const op of Object.keys(A.BODY_ONLY_FIELDS)) {
    assert.ok(Object.hasOwn(O.OPS, op), `${op}: BODY_ONLY_FIELDS names an op op-declarations declares`);
    assert.equal(RETIRED.includes(op), false, op);
  }
  assert.deepEqual(Object.keys(A.BODY_ONLY_FIELDS).sort(), ["handlecheck", "joinlinkinvite", "websiteinvite"]);
});

test("notice op-declarations:95 (R19, R20): aiaccountadd's secret is read from the body only — in the query it is refused CREDENTIAL_IN_ADDRESS before any store call and appears in no refusal; in the body a session is admitted with no secret in its address", async () => {
  const { env, S } = world();
  const SECRET = "sk-ant-api03-" + hex64();
  env.calls.length = 0;
  refused(await gate(env, { op: "aiaccountadd", token: S.founder, params: { secret: SECRET } }), 400, "CREDENTIAL_IN_ADDRESS", "C-38.10", [SECRET]);
  assert.equal(env.calls.length, 0, "before any store call");
  const r = await gate(env, { op: "aiaccountadd", token: S.founder, params: { owner: "group" }, extraBody: { secret: SECRET } });
  assert.equal(r.caller?.viaSession, true);
  assert.deepEqual(Object.fromEntries(r.url.searchParams), { owner: "group" }, "the URL is left as it came");
});
