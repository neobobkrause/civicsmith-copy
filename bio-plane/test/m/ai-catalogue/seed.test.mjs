/* ai-catalogue: the release's seed, loaded at start (R39; build/requirements/ai-catalogue.md), and the build's catalogue
 * keys (R33; BOB's ruling for the T53 restart under CLAUDE.md 9fb1b38: a development deployment signs the seed with a
 * development catalogue key; a public release trusting Bob's lines refuses a development-signed seed). Every key is a
 * throwaway generated here; the seed's signature reaches the copy as the deployment's variable, as a development deploy
 * hands it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NS_AI_CATALOGUE } from "../../../src/sshsig.mjs";
import { validatePayload, RELEASE_SEED, SEED_PAYLOAD, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_MARK,
  catalogueKeysFor, isDevelopmentKey, seedOf, SCHEMA_VERSIONS_READ } from "../../../src/ai-catalogue/index.mjs";
import { newKey, sign, sha, payload, publish, pull, world, AT } from "./fixture.mjs";
import { aiCatalogueStatement } from "../../../src/sshsig.mjs";

const DEV = await newKey();
const DEV_LINE = DEV.line.replace(/ throwaway$/, ` bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
const BOB = await newKey();                       /* stands in for Bob's line: not marked development */
const KEYS = [BOB.line, DEV_LINE];
const DEV_ENV = (armored) => ({ [DEVELOPMENT_VAR]: "1", [SEED_SIGNATURE_VAR]: armored });
const signSeed = (key, seed = RELEASE_SEED) => sign(key, NS_AI_CATALOGUE, aiCatalogueStatement(seed.statement));
const offered = (cat) => cat.entriesFor({ part: "ask", at: AT });

test("R39 the release carries a seed whose statement binds its bytes and which is valid by R36", () => {
  assert.equal(validatePayload(JSON.parse(RELEASE_SEED.body), { supported: SCHEMA_VERSIONS_READ }).ok, true);
  assert.equal(RELEASE_SEED.statement.sha256, sha(RELEASE_SEED.body));
  assert.equal(RELEASE_SEED.statement.bytes, Buffer.byteLength(RELEASE_SEED.body));
  assert.equal(RELEASE_SEED.statement.seq, SEED_PAYLOAD.seq);
  assert.equal(JSON.parse(RELEASE_SEED.body).entries.length, 0);
});

test("R39 a copy with no network loads the release's seed at start and holds a verified catalogue (source seed)", async () => {
  const { cat } = await world({ keys: KEYS, env: DEV_ENV(await signSeed(DEV)), seed: RELEASE_SEED });
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.state, s.source, s.seq], ["current", "seed", RELEASE_SEED.statement.seq]);
  assert.equal(offered(cat).ok, true);
  assert.deepEqual(offered(cat).entries, []);
  assert.equal(cat.seedAtStart.outcome, "found");
  /* F2: handed no seed, a development build takes the development seed, which the release seed's signature does not sign */
  const unnamed = await world({ keys: KEYS, env: DEV_ENV(await signSeed(DEV)) });
  assert.ok(unnamed.cat.seedAtStart && unnamed.cat.seedAtStart.ok === false, JSON.stringify(unnamed.cat.seedAtStart));
});

test("R39 a copy with no network offers the seed's entries, the seed loaded at start", async () => {
  const seed = seedOf(payload({ seq: 1 }));
  const { cat } = await world({ keys: KEYS, env: DEV_ENV(await signSeed(DEV, seed)), seed });
  assert.deepEqual(offered(cat).entries.map((e) => e.entry_id), ["fake-one"]);
  assert.equal(cat.catalogueState({ at: AT }).source, "seed");
});

test("R39 control: a seed with a bad signature is refused at start and the copy is unavailable", async () => {
  const other = await newKey();
  const { cat } = await world({ keys: KEYS, env: DEV_ENV(await signSeed(other)) });
  assert.equal(cat.seedAtStart.code, "UNKNOWN_KEY");
  assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
  assert.equal(offered(cat).code, "CATALOGUE_UNAVAILABLE");
});

test("R39 control: a release with no seed signature loads nothing and is unavailable", async () => {
  const { cat } = await world({ keys: KEYS });
  assert.equal(cat.seedAtStart, null);
  assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
});

test("R39 a public release (Bob's lines, not development) refuses a development-signed seed; Bob's signature loads", async () => {
  const dev = await world({ keys: KEYS, env: { [SEED_SIGNATURE_VAR]: await signSeed(DEV) } });
  assert.equal(dev.cat.seedAtStart.code, "UNKNOWN_KEY");
  assert.equal(dev.cat.catalogueState({ at: AT }).state, "unavailable");
  const bob = await world({ keys: KEYS, seed: seedOf(SEED_PAYLOAD, await signSeed(BOB)) });
  assert.equal(bob.cat.catalogueState({ at: AT }).source, "seed");
  assert.equal(bob.cat.catalogueState({ at: AT }).state, "current");
});

test("R33 the build's keys: development lines only where the deployment says it is one", () => {
  assert.equal(isDevelopmentKey(DEV_LINE), true);
  assert.equal(isDevelopmentKey(BOB.line), false);
  assert.deepEqual(catalogueKeysFor(KEYS, {}), [BOB.line]);
  assert.deepEqual(catalogueKeysFor(KEYS, { [DEVELOPMENT_VAR]: "1" }), KEYS);
  assert.deepEqual(catalogueKeysFor(KEYS, { [DEVELOPMENT_VAR]: "true" }), [BOB.line]);
});

test("R39 a restart re-reads the held seed and writes no second copy of it", async () => {
  const env = DEV_ENV(await signSeed(DEV));
  const first = await world({ keys: KEYS, env, seed: RELEASE_SEED });
  const rows = first.db.prepare("SELECT COUNT(*) AS n FROM ai_catalogue_payloads").get().n;
  const again = await world({ keys: KEYS, env, db: first.db, seed: RELEASE_SEED });
  assert.equal(again.cat.seedAtStart.outcome, "none");
  assert.equal(first.db.prepare("SELECT COUNT(*) AS n FROM ai_catalogue_payloads").get().n, rows);
  assert.equal(again.cat.catalogueState({ at: AT }).source, "seed");
});

test("R39 control: a seed older than a held pulled payload is not applied at the next start (NOT_NEWER)", async () => {
  const env = DEV_ENV(await signSeed(DEV));
  const first = await world({ keys: KEYS, env, seed: RELEASE_SEED });
  const pub = await publish(payload({ seq: 2, issued_at: "2026-10-02T00:00:00Z" }), { key: DEV });
  assert.equal((await pull(first.cat, pub)).payload.outcome, "found");
  const otherSeed = seedOf({ ...SEED_PAYLOAD, issued_at: "2026-11-05T00:00:00Z" });
  const again = await world({ keys: KEYS, env: DEV_ENV(await signSeed(DEV, otherSeed)), seed: otherSeed, db: first.db });
  assert.equal(again.cat.seedAtStart.code, "NOT_NEWER");
  const s = again.cat.catalogueState({ at: AT });
  assert.deepEqual([s.seq, s.source], [2, "pulled"]);
});
