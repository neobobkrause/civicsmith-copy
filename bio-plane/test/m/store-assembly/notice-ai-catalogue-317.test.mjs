/* Notice ai-catalogue:317 (store-assembly R1): ai-catalogue now trusts a development deployment's own key line, handed as
   the variable DEVELOPMENT_KEY_VAR, where DEVELOPMENT_VAR is "1". The assembly builds the storage's one catalogue with the
   deployment's env (assemble.mjs, `aiCatalogueOf(ctx, {record, env, clock})`), so through `assembleStore` alone, with no
   test keys handed and no test instance, a development deployment's seed signed by its own key loads, and a deployment
   that does not set DEVELOPMENT_VAR refuses the same seed. ai-use and ai-runs reach the catalogue without env, so the
   assembly must build it first: the instance they find is the one built with env. The seed and its signature are made
   by ai-catalogue's own fixture signer over the seed a development deployment takes (`seedFor`, ai-catalogue PRs 484, 611:
   DEVELOPMENT_SEED where DEVELOPMENT_VAR is "1"); the key line carries ai-catalogue's mark. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { storage, assembleStore } from "./fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiCatalogueOf, seedFor, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_VAR, DEVELOPMENT_KEY_MARK }
  from "../../../src/ai-catalogue/index.mjs";
import { NS_AI_CATALOGUE, aiCatalogueStatement } from "../../../src/sshsig.mjs";
import { newKey, sign } from "../ai-catalogue/fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";

const SEAL = "a-long-seal-secret-for-the-catalogue-317-test";
const DEV = await newKey();
const DEV_LINE = DEV.line.replace(/ throwaway$/, ` bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
const ARMORED = await sign(DEV, NS_AI_CATALOGUE, aiCatalogueStatement(seedFor({ [DEVELOPMENT_VAR]: "1" }).statement));

/* a deployment's store: assembleStore over its env, nothing else handed (no catalogueKeys, no test instance) */
async function deployment(env) {
  const st = storage();
  const s = assembleStore(st.ctx, { STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: SEAL, INSTANCE_NAME: "p3dev-t1",
    [DEVELOPMENT_KEY_VAR]: DEV_LINE, [SEED_SIGNATURE_VAR]: ARMORED, ...env });
  for (const p of st.blocked) await p;
  await aiCatalogueOf(st.ctx).ready;
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

test("R1 (notice ai-catalogue:317): through assembleStore, a development deployment (AI_CATALOGUE_DEVELOPMENT \"1\") trusts its AI_CATALOGUE_DEVELOPMENT_KEY line, so the seed signed by that key loads and the catalogue is available; control: with AI_CATALOGUE_DEVELOPMENT unset the same seed is refused and an account act fails closed CATALOGUE_UNAVAILABLE", async () => {
  const dev = await deployment({ [DEVELOPMENT_VAR]: "1" });
  const held = aiCatalogueOf(dev.ctx).catalogueState({});
  assert.equal(held.source, "seed", JSON.stringify(held));
  assert.notEqual(held.state, "unavailable", JSON.stringify(held));
  assert.notEqual((await dev.add()).reason, "CATALOGUE_UNAVAILABLE");

  for (const env of [{}, { [DEVELOPMENT_VAR]: "0" }]) {
    const rel = await deployment(env);
    assert.equal(aiCatalogueOf(rel.ctx).catalogueState({}).state, "unavailable", JSON.stringify(env));
    assert.equal((await rel.add()).reason, "CATALOGUE_UNAVAILABLE", JSON.stringify(env));
  }
});

test("R1 (notice ai-catalogue:317): the assembly builds the catalogue with env before ai-use, ai-runs or credentials can reach it, so the one instance on the storage, which ai-accounts holds and ai-use and ai-runs find without env, is the env-built one", async () => {
  const dev = await deployment({ [DEVELOPMENT_VAR]: "1" });
  const one = aiCatalogueOf(dev.ctx);
  assert.equal(aiAccountsOf(dev.ctx).catalogue, one, "ai-accounts holds the storage's one catalogue");
  assert.equal(one.catalogueState({}).source, "seed", "the instance every reader finds trusts the deployment's line");
  /* the order in the composition: the env-built catalogue comes before the first construction of each reader */
  const src = readFileSync(new URL("../../../src/store-assembly/assemble.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function assembleStore("));
  const at = body.search(/aiCatalogueOf\(ctx, \{[^}]*\benv\b/);
  assert.ok(at > 0, "assembleStore builds the catalogue with env");
  for (const reader of ["aiUseOf(ctx", "aiRunsOf(ctx", "credentialsOf(ctx"]) {
    const r = body.indexOf(reader);
    assert.ok(r > at, `${reader} comes after the catalogue's construction`);
  }
});
