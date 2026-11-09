/* ai-accounts F6 (coordinator 17:24, screens-ai ruling) through the assembled store: aiconnect's two ways that had no store
   (`aikeyreference`, `aisignin`; screens-ai R5, R14) are declared and served; `accountsof` and `accountstate` answer the payer
   stop's instant, `flagged_at` (screens-ai R4); and each account's health is read with it (screens-ai R1). The store is
   store-assembly's real one over node:sqlite, the catalogue ai-catalogue's published fixture seeded as ai-accounts seeds it,
   the disclosure recorded through its own door; nothing of another module is hand-built. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, withCatalogue } from "../store-assembly/fixture.mjs";
import { aiAccountsOf, DECLARED_OPS } from "../../../src/ai-accounts/index.mjs";
import { ASSISTANT_DISCLOSURE } from "../../../src/setup.mjs";
import { PLANS } from "./catalogue.mjs";

const SEAL = "a-long-seal-secret-for-the-f6-test";
const KEY = (who) => `sk-ant-api03-SENTINEL-f6-${who}-0123456789abcdef`;
const TOKEN = (who) => `sk-ant-oat01-SENTINEL-f6-${who}-0123456789abcdef`;

async function world() {
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: SEAL } });
  await withCatalogue(x.ctx);
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
    VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  for (const id of ["ann", "bob"])
    x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
      VALUES (?, ?, ?, 'member', 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`);
  const door = async (path, body) => {
    const b = JSON.parse(await (await x.fetch(path, { method: "POST", body: JSON.stringify(body ?? {}) })).text());
    return b.result ?? b;
  };
  const read = async (path) => { const b = JSON.parse(await (await x.fetch(path)).text()); return b.result ?? b; };
  const shown = await door("/disclosureshown?by=member:ann&viewer=member:ann", { member: "member:ann", version: ASSISTANT_DISCLOSURE.version });
  assert.equal(shown.ok, true, JSON.stringify(shown));
  return { ...x, door, read, acc: aiAccountsOf(x.ctx) };
}
const leaks = (x, sentinel, answers) => {
  const tables = x.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name);
  const found = [];
  for (const t of tables) for (const r of x.db.prepare(`SELECT * FROM "${t}"`).all()) if (JSON.stringify(r).includes(sentinel)) found.push(t);
  for (const a of answers) if (JSON.stringify(a).includes(sentinel)) found.push("answer");
  return found;
};

test("F6: aikeyreference and aisignin are declared credential acts, their fields what the arms read; the token and reference only in the body", () => {
  assert.deepEqual([DECLARED_OPS.aikeyreference?.weight, DECLARED_OPS.aisignin?.weight], ["credential", "credential"]);
  assert.deepEqual(DECLARED_OPS.aikeyreference.fields.requires, ["account_id", "reference"]);
  assert.ok(DECLARED_OPS.aisignin.fields.accepts.includes("token"));
  assert.deepEqual(DECLARED_OPS.aisignin.fields.requires, [["account_id", "plan"], "token"]);
  assert.deepEqual(DECLARED_OPS.aisignin.machineClasses, []);
});

test("F6 (screens-ai R5, R14): through the store, a member points her own account at a reference with aikeyreference, and only the pointer is kept; control: another member's act on it is NOT_YOUR_ACCOUNT and a malformed pointer REFERENCE_MALFORMED, nothing written", async () => {
  const x = await world();
  const set = await x.door("/aiownadd?by=member:ann", { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: KEY("ann") });
  assert.equal(set.ok, true, JSON.stringify(set));
  const ref = await x.door("/aikeyreference?by=member:ann", { account_id: set.account_id, reference: { store: "vault", locator: "kv/ann" } });
  assert.deepEqual([ref.ok, ref.account_id, ref.means, ref.held], [true, set.account_id, "reference", true], JSON.stringify(ref));
  const st = await x.read(`/accountstate?account_id=${set.account_id}&viewer=member:ann`);
  assert.deepEqual([st.means, st.held], ["reference", true], JSON.stringify(st));
  const row = x.db.prepare(`SELECT sealed, iv, reference FROM ai_accounts WHERE account_id=?`).get(set.account_id);
  assert.deepEqual([row.sealed, row.iv, JSON.parse(row.reference)], [null, null, { store: "vault", locator: "kv/ann" }]);
  assert.deepEqual(leaks(x, KEY("ann"), [ref, st]), [], "the replaced key is nowhere");
  /* control */
  const before = x.db.prepare(`SELECT reference FROM ai_accounts WHERE account_id=?`).get(set.account_id).reference;
  const bob = await x.door("/aikeyreference?by=member:bob", { account_id: set.account_id, reference: { store: "vault", locator: "kv/bob" } });
  assert.deepEqual([bob.ok, bob.reason], [false, "NOT_YOUR_ACCOUNT"], JSON.stringify(bob));
  const bad = await x.door("/aikeyreference?by=member:ann", { account_id: set.account_id, reference: { store: "vault" } });
  assert.deepEqual([bad.ok, bad.reason], [false, "REFERENCE_MALFORMED"], JSON.stringify(bad));
  assert.equal(x.db.prepare(`SELECT reference FROM ai_accounts WHERE account_id=?`).get(set.account_id).reference, before);
});

test("F6 (screens-ai R5, R14): through the store, a member signs in with her provider (aisignin): a new issued account of her own holds the token sealed, never answered, and replacing it on the same account holds the new one; control: a team subscription for the team by a plain member is refused, an empty token NO_SECRET, nothing written", async () => {
  const x = await world();
  const signed = await x.door("/aisignin?by=member:ann", { provider: PLANS.provider, plan: PLANS.subscription, token: TOKEN("ann"), valid_until: "1 year" });
  assert.deepEqual([signed.ok, signed.means, signed.held], [true, "issued", true], JSON.stringify(signed));
  const mine = await x.read(`/accountsof?owner=member:ann&viewer=member:ann`);
  const acct = mine.accounts.find((a) => a.account_id === signed.account_id);
  assert.deepEqual([acct.owner, acct.means, acct.held, acct.health.state], ["member:ann", "issued", true, "off"], JSON.stringify(acct));
  assert.ok(x.db.prepare(`SELECT valid_until FROM ai_accounts WHERE account_id=?`).get(signed.account_id).valid_until, "the stated life is kept");
  const again = await x.door("/aisignin?by=member:ann", { account_id: signed.account_id, token: TOKEN("ann2") });
  assert.deepEqual([again.ok, again.account_id], [true, signed.account_id], JSON.stringify(again));
  const unsealed = await x.acc.accountSecretFor({ account_id: signed.account_id, act: { kind: "ask", member: "ann" } });
  assert.equal(unsealed.secret, TOKEN("ann2"), "the owner's act reads the new token");
  assert.deepEqual(leaks(x, TOKEN("ann"), [signed, mine, again]), []);
  assert.deepEqual(leaks(x, TOKEN("ann2"), [signed, mine, again]), []);
  /* control */
  const count = () => x.db.prepare(`SELECT COUNT(*) AS n FROM ai_accounts`).get().n;
  const n = count();
  const team = await x.door("/aisignin?by=member:bob", { owner: "group", provider: PLANS.provider, plan: PLANS.teamSubscription, token: TOKEN("bob") });
  assert.deepEqual([team.ok, team.reason], [false, "NOT_AN_ADMIN"], JSON.stringify(team));
  const empty = await x.door("/aisignin?by=member:ann", { provider: PLANS.provider, plan: PLANS.subscription, token: "" });
  assert.deepEqual([empty.ok, empty.reason], [false, "NO_SECRET"], JSON.stringify(empty));
  assert.equal(count(), n, "no refusal leaves a row");
});

test("F6 (screens-ai R4, R1): through the store, accountsof and accountstate answer flagged_at with a payer stop and each account's health; clearing it answers flagged_at null and health back; control: an unflagged account answers flagged_at null", async () => {
  const x = await world();
  x.acc.registerGatewayStore("root-f6", { create: async () => "gw-f6", put: async () => true, exists: async () => true });
  const add = await x.door("/aiaccountadd?by=ada", { owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "gateway" });
  assert.equal(add.ok, true, JSON.stringify(add));
  const sealed = await x.door("/aiaccountadd?by=ada", { owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed", secret: KEY("team") });
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
  const health = async () => Object.fromEntries((await x.read(`/accountsof?owner=group&viewer=member:ada`)).accounts.map((a) => [a.account_id, a]));
  let h = await health();
  assert.deepEqual([h[add.account_id].health.state, h[sealed.account_id].health.state], ["no_credential", "off"], "a gateway with no key holds nothing; a sealed key off");
  assert.equal((await x.door("/aikeycloudflare?by=ada", { account_id: add.account_id })).ok, true);
  assert.equal((await x.door("/aiaccountswitch?by=ada", { account_id: add.account_id, on: true })).ok, true);
  h = await health();
  assert.deepEqual([h[add.account_id].health.state, h[add.account_id].flagged_at], ["ready", null]);

  const flag = x.acc.gatewayServedCheck({ account_id: add.account_id, record: { gateway_id: "gw-f6", own_key_served: false, platform_credits_used: true } });
  assert.deepEqual(flag, { flagged: true, cause: "credits" });
  const stored = x.db.prepare(`SELECT flagged_at FROM ai_accounts WHERE account_id=?`).get(add.account_id).flagged_at;
  h = await health();
  assert.deepEqual([h[add.account_id].flagged, h[add.account_id].flagged_at, h[add.account_id].flag_cause, h[add.account_id].health],
    [true, stored, "credits", { state: "stopped", since: stored }], JSON.stringify(h[add.account_id]));
  const st = await x.read(`/accountstate?account_id=${add.account_id}&viewer=member:ada`);
  assert.deepEqual([st.flagged_at, st.health.state], [stored, "stopped"], JSON.stringify(st));
  /* control */
  assert.deepEqual([h[sealed.account_id].flagged, h[sealed.account_id].flagged_at], [false, null]);
  assert.equal((await x.door("/aicreditsclear?by=ada", { account_id: add.account_id })).ok, true);
  h = await health();
  assert.deepEqual([h[add.account_id].flagged_at, h[add.account_id].health.state], [null, "ready"]);
});

test("F6 (screens-ai R1): a credential the provider refused reads failed, an issued token past its life expired; control: neither is stored in the answer beyond its instant", async () => {
  const x = await world();
  const signed = await x.door("/aisignin?by=member:ann", { provider: PLANS.provider, plan: PLANS.subscription, token: TOKEN("ann"), valid_until: "1 day" });
  assert.equal(signed.ok, true, JSON.stringify(signed));
  x.db.prepare(`UPDATE ai_accounts SET valid_until='2000-01-01T00:00:00Z' WHERE account_id=?`).run(signed.account_id);
  let st = await x.read(`/accountstate?account_id=${signed.account_id}&viewer=member:ann`);
  assert.deepEqual(st.health, { state: "expired", since: "2000-01-01T00:00:00Z" });
  x.acc.accountCredentialFailed({ account_id: signed.account_id, why: "refused" });
  st = await x.read(`/accountstate?account_id=${signed.account_id}&viewer=member:ann`);
  assert.equal(st.health.state, "failed", JSON.stringify(st));
  assert.ok(!JSON.stringify(st).includes(TOKEN("ann")));
});
