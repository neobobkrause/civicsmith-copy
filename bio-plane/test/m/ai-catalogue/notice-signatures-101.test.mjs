/* ai-catalogue: provider notice signatures:101 (signatures R57, R58, PR 101). `CATALOGUE_KEYS` now holds exactly Bob's
 * two catalogue keys and no test key; a test signs with its own throwaway key and passes it as the allowed keys. This
 * module imports `CATALOGUE_KEYS` and `verifyAiCatalogue` (index.mjs:17) and trusts the list by default (R33, R39).
 * Confirmed, no code change: a copy built with no keys of its own trusts the list exactly as signatures writes it, in a
 * public build and a development build alike (no line of it is a development line to drop), refuses a seed signed by
 * any key outside it, and verifies a throwaway key only when that key is handed to it as `keys`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE_KEYS, RELEASE_KEYS, NS_AI_CATALOGUE, aiCatalogueStatement } from "../../../src/sshsig.mjs";
import * as catalogue from "../../../src/ai-catalogue/index.mjs";
import { newKey, sign, world, AT } from "./fixture.mjs";

const { RELEASE_SEED, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_MARK, catalogueKeysFor, isDevelopmentKey } = catalogue;
/* written out, so the file loads without R59's change and the test that needs it fails */
const DEVELOPMENT_KEY_VAR = "AI_CATALOGUE_DEVELOPMENT_KEY";

const signSeed = (key) => sign(key, NS_AI_CATALOGUE, aiCatalogueStatement(RELEASE_SEED.statement));
const DEV_ENV = (armored) => ({ [DEVELOPMENT_VAR]: "1", [SEED_SIGNATURE_VAR]: armored });

/* Amended for signatures R59: CATALOGUE_KEYS now ends with development lines, so a public build trusts Bob's lines
 * alone and a development build trusts the list whole. */
test("notice signatures:101 (as R59 amends it): a public build trusts CATALOGUE_KEYS less its development lines, a development build the list whole", () => {
  assert.ok(CATALOGUE_KEYS.length > 0);
  const bob = CATALOGUE_KEYS.filter((l) => !isDevelopmentKey(l));
  assert.ok(bob.length > 0);
  assert.deepEqual(catalogueKeysFor(CATALOGUE_KEYS, {}), bob);
  assert.deepEqual(catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_VAR]: "1" }), [...CATALOGUE_KEYS]);
  for (const line of CATALOGUE_KEYS) assert.equal(RELEASE_KEYS.includes(line), false);
});

test("notice signatures:101 (as R59 amends it): a development build adds the deployment's own line after the list; a public build never does", async () => {
  const own = (await newKey()).line.replace(/ throwaway$/, ` bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
  const bob = CATALOGUE_KEYS.filter((l) => !isDevelopmentKey(l));
  assert.deepEqual([...catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_VAR]: "1", [DEVELOPMENT_KEY_VAR]: own })],
    [...CATALOGUE_KEYS, own]);
  assert.deepEqual([...catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_KEY_VAR]: own })], bob);
  /* end to end: the seed signed by that line's key verifies in a development build of the product's list */
  const key = await newKey();
  const line = key.line.replace(/ throwaway$/, ` bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
  const { cat } = await world({ keys: null,
    env: { ...DEV_ENV(await signSeed(key)), [DEVELOPMENT_KEY_VAR]: line }, seed: RELEASE_SEED });
  assert.equal(cat.seedAtStart.outcome, "found");
  /* F2: handed no seed, the development build takes the development seed, signed by that line's key: it lists plans */
  const dev = await world({ keys: null, env: { ...DEV_ENV(await sign(key, NS_AI_CATALOGUE,
    aiCatalogueStatement(catalogue.DEVELOPMENT_SEED.statement))), [DEVELOPMENT_KEY_VAR]: line } });
  assert.equal(dev.cat.seedAtStart && dev.cat.seedAtStart.outcome, "found");
  assert.ok(dev.cat.plansOf({ at: AT }).length > 0);
});

test("notice signatures:101: a copy built with no keys of its own refuses a throwaway-signed seed UNKNOWN_KEY, even in a development build", async () => {
  const tmp = await newKey();
  for (const env of [{ [SEED_SIGNATURE_VAR]: await signSeed(tmp) }, DEV_ENV(await signSeed(tmp))]) {
    const { cat } = await world({ keys: null, env });          /* null: aiCatalogueOf takes signatures' CATALOGUE_KEYS */
    assert.equal(cat.seedAtStart.code, "UNKNOWN_KEY");
    assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
    assert.equal(cat.entriesFor({ part: "ask", at: AT }).code, "CATALOGUE_UNAVAILABLE");
  }
});

test("notice signatures:101 control: the same throwaway key handed as keys verifies the seed and the copy is current from the seed", async () => {
  const tmp = await newKey();
  const { cat } = await world({ keys: [tmp.line], env: { [SEED_SIGNATURE_VAR]: await signSeed(tmp) } });
  assert.equal(cat.seedAtStart.outcome, "found");
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.state, s.source], ["current", "seed"]);
});
