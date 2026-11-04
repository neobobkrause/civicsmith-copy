/* Provider notice ai-accounts:124 (PR 124): ai-accounts changed `accountFor`, `accountUses*` and put back the old forms
   (`accountReferenceSet`, `groupKeySet`, `groupKeySwitch`, `groupKeyNoticeSeen`, …) over its catalogue-plan accounts. The door
   reads `accountFor` (R10's `{kind, level}`, R11's paying owner) and `subscriptionConnected` (R10's store-internal route) from
   ai-accounts (R16). Confirmed with no code change: over a real record seeded with ai-catalogue's real service, accounts set by
   the old forms are read through the door as ai-accounts answers them, its own answer asked beside the door's. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { credentialsOf } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf } = await import("../../../src/ai-accounts/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");
const { instanceSetupOf } = await import("../../../src/setup.mjs");

const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };

test("notice ai-accounts:124 (store-door R10, R11, R16): accounts set by ai-accounts' old forms are read through the door as ai-accounts' `accountFor` answers them — `askusage` counts to the paying owner (the member's own account, else the team's key), a draft's handler is handed `{kind, level}` of that answer and never its key, and `subscriptionconnected` relays ai-accounts' own answer (control: before any account, `askusage` names no owner)", async () => {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00124" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx), AA = aiAccountsOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  for (const [id, role] of [["ann", "admin"], ["bea", "member"]]) {
    const a = await mb.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    assert.equal(a.ok, true, JSON.stringify(a));
    await mb.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  assert.equal(C.aiKeepAwaySet({ on: false, by: "ann" }).ok, true);
  const seen = [];
  instanceSetupOf(r.ctx).groupDescriptionDraft = (args) => { seen.push(args.assistant); return { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" }; };
  const owner = async (m) => (await r.go(`askusage?viewer=member:${m}`, "POST", { mode: "ask", usage: USE })).json.result.owner;

  const none = await owner("bea");
  assert.notEqual(none, "member:bea");
  assert.notEqual(none, "group");

  assert.equal((await AA.accountReferenceSet({ member: "member:bea", kind: "apikey", secret: "sk-bea-own-124", by: "member:bea" })).ok, true);
  assert.equal((await AA.groupKeySet({ key: "sk-group-key-124", by: "admin" })).ok, true);
  assert.equal(AA.groupKeySwitch({ on: true, by: "admin" }).ok, true);
  assert.equal(AA.groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" }).ok, true);
  const own = await AA.accountFor({ member: "member:bea", act: { kind: "ask", member: "member:bea" } });
  const team = await AA.accountFor({ member: "member:ann", act: { kind: "draft", member: "member:ann" } });
  assert.deepEqual([own.ok, own.level, team.ok, team.level], [true, "member", true, "group"]);
  assert.equal(await owner("bea"), "member:bea");
  assert.equal(await owner("ann"), "group");

  const d = await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST", { answers: [{ question: "Who are you?", text: "Tenants" }] });
  assert.equal(d.json.result.reason, "ASSISTANT_DRAFT_UNAVAILABLE", JSON.stringify(d.json));
  assert.deepEqual(seen, [{ on: true, account: { kind: team.kind, level: team.level } }]);
  assert.equal(JSON.stringify([seen, d.json]).includes("sk-group-key-124"), false);

  const s = await r.go("subscriptionconnected?by=member:bea", "POST", {});
  assert.deepEqual(s.json.result, AA.subscriptionConnected({ member: "member:bea" }));
  assert.equal(s.json.result.connected, true);
});
