/* store-request, notice store-assembly:93 (PR 93: assembleStore and deployGate changed; DECLARED_OPS, admitOn and servingEntry added;
   store-assembly R1, R90, ai-accounts R40, R63). Adapted: (1) the assembled ai-accounts now reads the object's own ai-catalogue, which
   holds no list until one is seeded, and store-assembly's world takes `catalogueKeys` (honoured on a test instance only). This
   module's `storeWorld({ ai: true })` is a test instance, so it hands ai-catalogue's fixture key and seeds ai-accounts' published
   catalogue through the catalogue's own channel; before, every account act answered CATALOGUE_UNAVAILABLE. (2) The draft door's
   first check is `deployGate` on the serving account's entry (`servingEntry`), so each draft op answers the refusal the owner's own
   gate reaches; door-ops.test R28 now compares the world's answer with `draftOnObject`'s. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";

const SECRET = "sk-ant-api03-" + "n".repeat(40);
const addTeam = async (w) => {
  const admin = await w.signIn("admin");
  await admin.act("reauth", { body: { password: admin.password } });
  return admin.act("aiaccountadd", { body: { owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed", secret: SECRET } });
};

test("notice store-assembly:93: a world made with { ai: true } holds a catalogue, so an administrator's real aiaccountadd adds the team's account; control: a world that is no test instance holds none and is refused CATALOGUE_UNAVAILABLE", async () => {
  const added = await addTeam(await storeWorld({ ai: true }));
  assert.equal(added.ok, true, JSON.stringify(added).slice(0, 300));
  assert.equal(typeof added.account_id, "string");
  await assert.rejects(addTeam(await storeWorld()), /CATALOGUE_UNAVAILABLE/);
});

