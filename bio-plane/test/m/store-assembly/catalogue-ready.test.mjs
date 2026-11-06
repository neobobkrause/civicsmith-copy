/* store-assembly R1, F1 (ai-catalogue F2; BOB 5 Nov, the coordinator's 09:03 ruling): the assembled store holds its first
   request until ai-catalogue's start has loaded the seed a deployment signs (`loadSeed`'s start-up arm, ai-catalogue R39), so
   a development plane's first account act reads that seed's list and is never answered CATALOGUE_UNAVAILABLE for a race.
   The development variables are ai-catalogue's own (`makeDevelopmentKey`, `variablesFor`), its public half only, as a
   development deployment holds them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, assembleStore } from "./fixture.mjs";
import { aiCatalogueOf } from "../../../src/ai-catalogue/index.mjs";
import { makeDevelopmentKey, variablesFor, DEVELOPMENT_SIGNING_SECRET } from "../../../src/ai-catalogue/dev-key.mjs";

const SEAL = "a-long-seal-secret-for-the-catalogue-ready-test";

async function plane(extra) {
  const st = storage();
  const env = { STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: SEAL, ...extra };
  const s = assembleStore(st.ctx, env);
  for (const p of st.blocked) await p;   /* the work the runtime holds requests behind, and nothing after it */
  return { ctx: st.ctx, s };
}

async function developmentVars() {
  const vars = variablesFor(await makeDevelopmentKey());
  delete vars[DEVELOPMENT_SIGNING_SECRET];   /* the private half is a Worker secret the plane never reads */
  return vars;
}

test("F1, R1: on a development plane the signed seed is held once the blocked start work is done, so the first request reads it", async () => {
  const { ctx } = await plane(await developmentVars());
  const cat = aiCatalogueOf(ctx);
  assert.equal(cat.seedAtStart?.ok, true, JSON.stringify(cat.seedAtStart));
  assert.equal(cat.catalogueState({}).source, "seed");
});

test("F1, R1 control: with no development variables the release seed is unsigned, nothing is loaded and the plane still answers", async () => {
  const { ctx, s } = await plane({});
  assert.equal(aiCatalogueOf(ctx).seedAtStart, null);
  assert.equal(aiCatalogueOf(ctx).catalogueState({}).state, "unavailable");
  const r = await s.dispatch(new Request("http://do/stats", { method: "POST", body: "{}" }));
  assert.equal(typeof r.status, "number");
});
