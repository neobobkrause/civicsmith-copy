/* ai-catalogue F2: a development seed that lists plans, `api` among them, signed by `makeDevelopmentKey`'s key and taken
 * only where AI_CATALOGUE_DEVELOPMENT=1; RELEASE_SEED is unchanged and never carries it. The copy is the fixture's real
 * one with signatures' CATALOGUE_KEYS (keys: null), as the plane builds it; the variables are the ones
 * makeDevelopmentKey's deployment hands. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as catalogue from "../../../src/ai-catalogue/index.mjs";
import { world, AT } from "./fixture.mjs";

const { RELEASE_SEED, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, validatePayload, SCHEMA_VERSIONS_READ } = catalogue;
const DEVELOPMENT_KEY_VAR = "AI_CATALOGUE_DEVELOPMENT_KEY";
const PLAN = "api";

/* The development deployment's public variables, from makeDevelopmentKey as dev-key.mjs hands them. */
async function devVars() {
  const { makeDevelopmentKey } = await import("../../../src/ai-catalogue/dev-key.mjs");
  const k = await makeDevelopmentKey();
  return { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: k.line, [SEED_SIGNATURE_VAR]: k.armored };
}
const planIds = (cat) => cat.plansOf({ at: AT }).flatMap((g) => g.plans.map((p) => p.plan_id));

test("F2 with the development variables the development seed loads at start and lists the plan api", async () => {
  const { cat } = await world({ keys: null, env: await devVars() });
  assert.equal(cat.seedAtStart && cat.seedAtStart.outcome, "found", JSON.stringify(cat.seedAtStart));
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.state, s.source], ["current", "seed"]);
  assert.ok(planIds(cat).includes(PLAN), JSON.stringify(planIds(cat)));
  const [group] = cat.plansOf({ plan_id: PLAN, at: AT });
  assert.ok(group && group.plans[0].plan_id === PLAN);
  /* its entry reached through the plan is offered once the build registers the entry's adapter type (R38) */
  const entry = cat.entryOf("p3dev-model", { at: AT });
  cat.registerAdapterTypes([{ type: entry.adapter_type, profiles: { [entry.profile.id]: entry.profile.min_version } }]);
  assert.ok(cat.entriesFor({ part: "ask", at: AT }).entries.some((e) => e.entry_id === "p3dev-model"));
  assert.ok(entry.plan_ids.includes(PLAN));
  assert.equal(validatePayload(JSON.parse(catalogue.DEVELOPMENT_SEED.body), { supported: SCHEMA_VERSIONS_READ }).ok, true);
});

test("F2 control: without the development variable only RELEASE_SEED is taken and the development seed is refused", async () => {
  const vars = await devVars();
  const release = { ...vars };
  delete release[DEVELOPMENT_VAR];
  const { cat } = await world({ keys: null, env: release });
  /* the development seed's signature does not sign the release's seed: nothing loads, no plan is listed */
  assert.notEqual(cat.seedAtStart && cat.seedAtStart.outcome, "found");
  assert.deepEqual(planIds(cat), []);
  /* handed the development seed directly, a release build refuses its development key */
  const r = await cat.loadSeed({ ...catalogue.DEVELOPMENT_SEED, armored: vars[SEED_SIGNATURE_VAR] });
  assert.equal(r.code, "UNKNOWN_KEY");
  assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
  /* RELEASE_SEED is unchanged: no plan, no entry */
  const doc = JSON.parse(RELEASE_SEED.body);
  assert.deepEqual([doc.plans, doc.entries, doc.providers], [[], [], []]);
});
