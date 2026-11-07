/* installer-steps R46 and R47 (T53; N1273, K5440, K5441): the room's placement is the founder's choice, a hint or a jurisdiction and
   never both, and travels with every upload; a copy with a jurisdiction creates its buckets in it. The fake account of world.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
/* The module as a namespace, so a name it does not (yet) export fails the test that uses it, not the file's load. */
import * as steps from "../../src/steps/index.mjs";
const { placementFor, storeLocationBinding, JURISDICTIONS, LOCATION_HINTS, PLACEMENT_CONFLICT, BUCKET_JURISDICTION, uploadInstall, uploadUpdate,
  planeInSync, heldBindings, ensureBuckets, r2Endpoint, namesFor } = steps;
import { session, immediateTimers, account, release, chosen, realFetch, CAPABLE_SRC } from "./world.mjs";

let restoreTimers;
test.beforeEach(() => { restoreTimers = immediateTimers(); });
test.afterEach(() => { restoreTimers(); globalThis.fetch = realFetch; });
const NAMES = namesFor("grp");
const SECRETS = { boot: "boot-secret", probe: "probe-secret", daemon: "daemon-secret", seal: "seal-secret" };
const bundle = async () => chosen(await release({ src: CAPABLE_SRC }));
const install = (rel, opts = {}) => uploadInstall(session(), "A1", "grp", SECRETS, rel, { names: NAMES, members: [], ...opts });
const update = (rel, opts = {}) => uploadUpdate(session(), "A1", "grp", true, rel, { names: NAMES, members: [], ...opts });
const placed = (bindings) => (bindings || []).filter((b) => /^STORE_(LOCATION|JURISDICTION)$/.test(b.name)).map((b) => [b.name, b.text]);
const held = (...texts) => ({ grp: texts.map(([name, text]) => ({ type: "plain_text", name, text })) });
const EU_CF = { continent: "EU", longitude: "13.4" };

test("R46: a picked hint overrides the default; a jurisdiction carries no hint; both are refused; neither and no cf is nothing", () => {
  assert.deepEqual(placementFor({ cf: EU_CF }), { hint: "weur" }, "the default is locationHintFor(cf)");
  assert.deepEqual(placementFor({ hint: "apac", cf: EU_CF }), { hint: "apac" }, "a picked hint overrides the default");
  assert.deepEqual(placementFor({ jurisdiction: "eu", cf: EU_CF }), { jurisdiction: "eu" }, "a jurisdiction, and no default hint beside it");
  for (const j of JURISDICTIONS) assert.deepEqual(placementFor({ jurisdiction: j }), { jurisdiction: j });
  assert.throws(() => placementFor({ hint: "weur", jurisdiction: "eu" }), (e) => e.code === PLACEMENT_CONFLICT);
  /* a value off its list is not a choice */
  assert.deepEqual(placementFor({ hint: "eu", cf: EU_CF }), { hint: "weur" });
  assert.deepEqual(placementFor({ jurisdiction: "weur" }), {});
  /* control: neither chosen and no cf answers no placement */
  assert.deepEqual(placementFor({}), {});
  assert.deepEqual(placementFor(), {});
});

test("R46: storeLocationBinding answers STORE_JURISDICTION for a jurisdiction and STORE_LOCATION for a hint, never both", () => {
  for (const j of JURISDICTIONS) assert.deepEqual(storeLocationBinding(j), [{ type: "plain_text", name: "STORE_JURISDICTION", text: j }], j);
  for (const h of LOCATION_HINTS) assert.deepEqual(storeLocationBinding(h), [{ type: "plain_text", name: "STORE_LOCATION", text: h }], h);
  for (const bad of ["EU", "eu ", "fed", "", null, 1]) assert.deepEqual(storeLocationBinding(bad), [], JSON.stringify(bad));
  assert.equal(LOCATION_HINTS.some((h) => JURISDICTIONS.includes(h)), false, "the lists share no value");
});

test("R46: the install's upload binds the jurisdiction and no hint; both given are refused before any write", async () => {
  const rel = await bundle();
  const w = account({});
  await install(rel, { storeJurisdiction: "eu" });
  assert.deepEqual(placed(w.puts.at(-1).meta.bindings), [["STORE_JURISDICTION", "eu"]]);
  w.restore();
  const both = account({});
  await assert.rejects(install(rel, { storeLocation: "weur", storeJurisdiction: "eu" }), (e) => e.code === PLACEMENT_CONFLICT);
  assert.equal(both.calls.length, 0, "nothing was asked of the account, let alone written");
  assert.equal(both.puts.length, 0);
  both.restore();
  /* control: neither chosen, no placement binding, exactly as today */
  const none = account({});
  await install(rel);
  assert.deepEqual(placed(none.puts.at(-1).meta.bindings), []);
  none.restore();
});

test("R46: a later update restates the held STORE_JURISDICTION and STORE_GENERATION and invents none; the room never moves", async () => {
  const rel = await bundle();
  const w = account({ pre: held(["STORE_JURISDICTION", "eu"], ["STORE_GENERATION", "2"]) });
  await update(rel, { storeLocation: "wnam", storeJurisdiction: "us" });
  const b = w.planePuts.at(-1).meta.bindings;
  assert.deepEqual(b.filter((x) => /^STORE_/.test(x.name)).map((x) => [x.name, x.text]).sort(), [["STORE_GENERATION", "2"], ["STORE_JURISDICTION", "eu"]]);
  w.restore();
  /* planeInSync never compares the place: a held jurisdiction other than one an install would send is still in sync */
  const s = account({});
  await install(rel, { storeJurisdiction: "eu" });
  s.scripts.set("grp", s.scripts.get("grp").map((x) => x.name === "STORE_JURISDICTION" ? { ...x, text: "us" } : x));
  const list = (await heldBindings(session(), "A1", "grp")).list;
  assert.equal(await planeInSync(session(), "A1", "grp", rel, list, { names: NAMES, members: [], profiles: [] }), true);
  s.restore();
});

/* The parity test (a test, not product code: R35 stands). */
test("R46: the jurisdiction list equals runtime-limits' STORE_JURISDICTIONS, in the same order", async () => {
  const { STORE_JURISDICTIONS } = await import("../../../bio-plane/src/store-place.mjs");
  assert.deepEqual([...JURISDICTIONS], [...STORE_JURISDICTIONS]);
});

test("R47: an install with a jurisdiction creates both buckets in it; the S3 endpoint is the jurisdiction's own", async () => {
  const w = account({});
  assert.deepEqual(await ensureBuckets(session(), "A1", NAMES, { jurisdiction: "eu" }), []);
  assert.equal(w.bucketJurisdictions.get(NAMES.captures), "eu");
  assert.equal(w.bucketJurisdictions.get(NAMES.published), "eu");
  for (const c of w.calls.filter((c) => c.u.endsWith("/r2/buckets"))) assert.equal(c.init.headers["cf-r2-jurisdiction"], "eu");
  w.restore();
  assert.equal(r2Endpoint("abc123", "eu"), "abc123.eu.r2.cloudflarestorage.com");
  assert.equal(r2Endpoint("abc123", "fedramp"), "abc123.fedramp.r2.cloudflarestorage.com");
  assert.equal(r2Endpoint("abc123"), "abc123.r2.cloudflarestorage.com");
  /* control: with a hint or none the buckets are created as before, with no jurisdiction asked */
  const c = account({});
  await ensureBuckets(session(), "A1", NAMES);
  assert.equal(c.bucketJurisdictions.get(NAMES.captures), "default");
  for (const k of c.calls.filter((k) => k.u.endsWith("/r2/buckets"))) assert.equal(k.init.headers["cf-r2-jurisdiction"], undefined);
  c.restore();
});

test("R47: a bucket that cannot be created in the jurisdiction stops the install before the room is created, saying why", async () => {
  const rel = await bundle();
  /* the account refuses the jurisdiction: the steps the installer runs in order (buckets, then the room) stop at the first */
  const w = account({ r2Jurisdictions: ["eu"] });
  const run = async () => { await ensureBuckets(session(), "A1", NAMES, { jurisdiction: "fedramp" }); await install(rel, { storeJurisdiction: "fedramp" }); };
  await assert.rejects(run(), (e) => typeof e.message === "string" && /fedramp/.test(e.message));
  assert.equal(w.puts.length, 0, "no room");
  assert.equal(w.buckets.size, 0, "no bucket");
  w.restore();
  /* the account answers a bucket created somewhere else: named, and no room */
  const x = account({ r2Answers: "default" });
  const run2 = async () => { await ensureBuckets(session(), "A1", NAMES, { jurisdiction: "eu" }); await install(rel, { storeJurisdiction: "eu" }); };
  await assert.rejects(run2(), (e) => e.code === BUCKET_JURISDICTION && e.said === "default" && e.bucket === NAMES.captures);
  assert.equal(x.puts.length, 0, "no room");
  x.restore();
  /* a jurisdiction off the list is refused before any call */
  const y = account({});
  await assert.rejects(ensureBuckets(session(), "A1", NAMES, { jurisdiction: "mars" }), (e) => e.code === BUCKET_JURISDICTION);
  assert.equal(y.calls.length, 0);
  y.restore();
});
