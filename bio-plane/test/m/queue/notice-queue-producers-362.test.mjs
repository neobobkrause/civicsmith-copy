/* notice queue-producers:362 (T53; PR 362 changed queue-producers R56, R60, R61). R56 (one signing-key item per member, its keys
   listed with a pair of options each) is adapted by R97 and tested in `r97-signer-keys.test.mjs`. R60 and R61 declare their
   doors on the item (`door`: `aicreditsclear`, `airetestset`), and queue R12's door rule carries a declared door onto the
   disposition and R28's bridge; R1 catalogues both kinds as OBLIGATIONs, never muted. Confirmed here over the real queue-producers
   and the providers' own test worlds (ai-accounts' and ai-use's fixtures), never a hand-built item. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./world.mjs";
import { world as accountsWorld } from "../ai-accounts/fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { standard } from "../ai-use/fixture.mjs";

const ofKind = (f, k) => f.items.filter((i) => i.kind === k);

async function stopped() {
  const aw = await accountsWorld().group("ann");
  aw.a.registerGatewayStore("fixture-root", { create: async () => "gw-1", put: async () => true, exists: async () => true });
  const t = await aw.a.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "gateway", by: "admin" });
  await aw.a.gatewayKeyAttest({ account_id: t.account_id, by: "admin" });
  aw.a.accountSwitch({ account_id: t.account_id, on: true, by: "admin" });
  aw.a.gatewayServedCheck({ account_id: t.account_id, record: { gateway_id: "gw-1", own_key_served: false, platform_credits_used: true } });
  return { aw, account: t.account_id };
}

test("notice queue-producers:362 (R60): a stopped AI account is one to-do whose door is aicreditsclear, on the item and in the bridge; never muted", async () => {
  const { aw, account } = await stopped();
  const w = world({ aiAccounts: { creditsStopsOpen: (x) => aw.a.creditsStopsOpen(x) } });
  w.member("admin", { role: "admin" }); w.member("ann");
  const f = w.feed("admin");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const [it] = ofKind(f, "ai-credits-stop");
  assert.ok(it, "minted for an administrator");
  assert.deepEqual([it.class, it.disposition.available, it.disposition.instead], ["OBLIGATION", false, "aicreditsclear"]);
  const bridge = w.q.proposeDispose({ key: it.id, state: "dismissed", reason: "r", decidedBy: "admin", viewer: "member:admin", identity: "member:admin" });
  assert.deepEqual([bridge.reason, bridge.instead], ["CLASS_NOT_DISPOSED", "aicreditsclear"]);
  assert.equal(w.q.queueMute({ member: "admin", viewer: "member:admin", item: it.id }).reason, "KIND_NOT_PERSONAL");
  // control: a member who may not clear it is told nothing; cleared, it leaves
  assert.deepEqual(ofKind(w.feed("ann"), "ai-credits-stop"), []);
  assert.equal(aw.a.aiCreditsClear({ account_id: account, by: "admin" }).ok, true);
  w.now += 6000;
  assert.deepEqual(ofKind(w.feed("admin"), "ai-credits-stop"), []);
});

test("notice queue-producers:362 (R61): re-testing off is one to-do per administrator whose door is airetestset, on the item and in the bridge; never muted", async () => {
  const uw = await standard();
  assert.equal(uw.u.retestSet({ owner: "group", on: false, by: "admin", at: "2026-08-31T10:00:00Z" }).ok, true);
  const w = world({ aiUse: { retestingOff: (x) => uw.u.retestingOff(x) } });
  w.member("admin", { role: "admin" }); w.member("bob");
  const [it] = ofKind(w.feed("admin"), "retesting-off");
  assert.ok(it, "minted for an administrator");
  assert.deepEqual([it.class, it.disposition.available, it.disposition.instead], ["OBLIGATION", false, "airetestset"]);
  const bridge = w.q.proposeDispose({ key: it.id, state: "dismissed", reason: "r", decidedBy: "admin", viewer: "member:admin", identity: "member:admin" });
  assert.deepEqual([bridge.reason, bridge.instead], ["CLASS_NOT_DISPOSED", "airetestset"]);
  assert.equal(w.q.queueMute({ member: "admin", viewer: "member:admin", item: it.id }).reason, "KIND_NOT_PERSONAL");
  // control: a member who does not administer the account sees none; turned on, it leaves
  assert.deepEqual(ofKind(w.feed("bob"), "retesting-off"), []);
  uw.u.retestSet({ owner: "group", on: true, by: "admin" });
  w.now += 6000;
  assert.deepEqual(ofKind(w.feed("admin"), "retesting-off"), []);
});
