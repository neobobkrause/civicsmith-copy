/* store-assembly R1 (ai-accounts R40, R63; the coordinator, 4 Nov): the assembly hands ai-accounts the object's own ai-catalogue,
   so an assembled store's account act reads the signed list the copy holds. A test plane may hand `catalogueKeys`, honoured on a
   test instance alone; anywhere else the product's keys stay and a list signed by another key is refused. The list is
   ai-catalogue's published fixture, seeded through the catalogue's own channel (`loadSeed`) by ai-accounts' `catalogueFor`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, assembleStore } from "./fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiCatalogueOf } from "../../../src/ai-catalogue/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { catalogueFor, PLANS } from "../ai-accounts/catalogue.mjs";
import { KEY } from "../ai-catalogue/fixture.mjs";

const SEAL = "a-long-seal-secret-for-the-catalogue-test";
const TEST_INSTANCE = { CIVICSMITH_TEST_INSTANCE: "t-cat", INSTANCE_NAME: "t-cat" };

async function plane(env, opts = {}) {
  const st = storage();
  const e = { STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: SEAL, ...env };
  const s = assembleStore(st.ctx, e, opts);
  for (const p of st.blocked) await p;
  st.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                           VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  const add = async () => {
    const r = await s.dispatch(new Request("http://do/aiaccountadd?by=ada&viewer=member:ada", { method: "POST",
      body: JSON.stringify({ owner: "group", provider: "anthropic", plan: PLANS.teamApi, means: "sealed", secret: "sk-ant-zz-team-0123456789" }) }));
    const b = await r.json();
    return b.result ?? b;
  };
  return { ctx: st.ctx, s, add };
}

test("R1 (ai-accounts R40, R63): ai-accounts' catalogue is the object's own ai-catalogue; on a test instance handed `catalogueKeys` a list signed by that key is taken through the channel, and an administrator's aiaccountadd is answered on it, not CATALOGUE_UNAVAILABLE", async () => {
  const x = await plane(TEST_INSTANCE, { catalogueKeys: [KEY.line] });
  assert.equal(aiAccountsOf(x.ctx).catalogue, aiCatalogueOf(x.ctx), "the one instance on this storage");
  const before = await x.add();
  assert.equal(before.reason, "CATALOGUE_UNAVAILABLE", "no list held yet: fail closed");
  await catalogueFor(x.ctx, { record: recordOf(x.ctx) }).seeded;   /* the assembled catalogue's own loadSeed */
  const r = await x.add();
  assert.notEqual(r.reason, "CATALOGUE_UNAVAILABLE", JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("R1: off a test instance `catalogueKeys` are refused: the product's keys stay, a list signed by the test key is refused at the seed, and the account act fails closed CATALOGUE_UNAVAILABLE; control: with no keys handed, the same", async () => {
  for (const opts of [{ catalogueKeys: [KEY.line] }, {}]) {
    for (const env of [{}, { INSTANCE_NAME: "t-cat" }, { CIVICSMITH_TEST_INSTANCE: "t-cat", INSTANCE_NAME: "other" }]) {
      const x = await plane(env, opts);
      assert.equal(aiAccountsOf(x.ctx).catalogue, aiCatalogueOf(x.ctx));
      await assert.rejects(catalogueFor(x.ctx, { record: recordOf(x.ctx) }).seeded, /catalogue seed refused/, JSON.stringify(env));
      assert.equal((await x.add()).reason, "CATALOGUE_UNAVAILABLE", JSON.stringify(env));
    }
  }
});

test("R90, R1: storeWorld forwards `catalogueKeys`, so a test-instance world seeds the fixture's list through its own catalogue; control: a world that is no test instance refuses that list", async () => {
  const { storeWorld } = await import("./world.mjs");
  const w = await storeWorld({ instanceName: "t-cat", env: { CIVICSMITH_TEST_INSTANCE: "t-cat", ACCOUNT_SEAL_SECRET: SEAL }, catalogueKeys: [KEY.line] });
  assert.equal(aiAccountsOf(w.ctx).catalogue, aiCatalogueOf(w.ctx));
  await catalogueFor(w.ctx, { record: recordOf(w.ctx) }).seeded;
  assert.notEqual(aiCatalogueOf(w.ctx).catalogueState({}).state, "unavailable");
  const off = await storeWorld({ catalogueKeys: [KEY.line] });
  await assert.rejects(catalogueFor(off.ctx, { record: recordOf(off.ctx) }).seeded, /catalogue seed refused/);
});

/* ai-catalogue R33, R39 (from ai-runs' job): the deployment's env reaches the plane's catalogue. A development deployment sets
   AI_CATALOGUE_DEVELOPMENT ("1", so its build trusts the development key line) and AI_CATALOGUE_SEED_SIGNATURE (the release
   seed's signature by that key); the assembled store's catalogue then loads the seed at start. */
test("R1 (ai-catalogue R33, R39): the assembled catalogue is built with the store's env, so a development deployment's AI_CATALOGUE_SEED_SIGNATURE loads the release seed when AI_CATALOGUE_DEVELOPMENT is \"1\"; control: without it the development-signed seed is refused and the catalogue holds none", async () => {
  const { NS_AI_CATALOGUE, aiCatalogueStatement } = await import("../../../src/sshsig.mjs");
  const { seedFor, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_MARK } = await import("../../../src/ai-catalogue/index.mjs");
  const { newKey, sign } = await import("../ai-catalogue/fixture.mjs");
  const DEV = await newKey();
  const devLine = DEV.line.replace(/ throwaway$/, ` bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
  /* the seed a development deployment takes (`seedFor`, ai-catalogue PRs 484, 611: its development seed) */
  const armored = await sign(DEV, NS_AI_CATALOGUE, aiCatalogueStatement(seedFor({ [DEVELOPMENT_VAR]: "1" }).statement));
  const state = async (env) => {
    const x = await plane({ ...TEST_INSTANCE, [SEED_SIGNATURE_VAR]: armored, ...env }, { catalogueKeys: [devLine] });
    await aiCatalogueOf(x.ctx).ready;
    return aiCatalogueOf(x.ctx).catalogueState({});
  };
  const dev = await state({ [DEVELOPMENT_VAR]: "1" });
  assert.equal(dev.source, "seed", JSON.stringify(dev));
  assert.notEqual(dev.state, "unavailable");
  const pub = await state({});
  assert.equal(pub.state, "unavailable", "a build that is not a development one drops the development line");
});
