/* installer-steps R41 and R42 (fix round 7 G83; K4746, K4747, K4752, K4754): the team's room is created in the founder's region,
   and the place travels with every upload of the plane. The fake account of world.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { locationHintFor, storeLocationBinding, LOCATION_HINTS, uploadInstall, uploadUpdate, planeInSync, heldBindings, bindMembers, namesFor } from "../../src/steps/index.mjs";
import { session, immediateTimers, account, release, chosen, realFetch, CAPABLE_SRC, sink } from "./world.mjs";

let restoreTimers;
test.beforeEach(() => { restoreTimers = immediateTimers(); });
test.afterEach(() => { restoreTimers(); globalThis.fetch = realFetch; });
const NAMES = namesFor("grp");
const SECRETS = { boot: "boot-secret", probe: "probe-secret", daemon: "daemon-secret", seal: "seal-secret" };
const bundle = async () => chosen(await release({ src: CAPABLE_SRC }));
const install = (rel, opts = {}) => uploadInstall(session(), "A1", "grp", SECRETS, rel, { names: NAMES, members: [], ...opts });
const update = (rel, opts = {}) => uploadUpdate(session(), "A1", "grp", true, rel, { names: NAMES, members: [], ...opts });
const plain = (bindings, name) => (bindings || []).filter((b) => b.name === name);
/* a plane the account holds, with the given plain texts */
const held = (...texts) => ({ grp: texts.map(([name, text]) => ({ type: "plain_text", name, text })) });
const lastPlane = (w) => w.planePuts.at(-1);

test("R41: locationHintFor answers by continent and longitude only (the table, its boundaries, and everything it will not guess)", () => {
  const cf = (continent, longitude, extra = {}) => ({ continent, longitude, ...extra });
  const table = [
    [cf("NA", "-122.4", { country: "US" }), "wnam"], [cf("NA", "-74.0", { country: "US" }), "enam"], [cf("NA", "-99.1", { country: "MX" }), "wnam"],
    [cf("NA", -98), "enam"], [cf("NA", "-98"), "enam"], [cf("NA", "-98.0001"), "wnam"], [cf("NA", -98.0001), "wnam"],
    [cf("EU", "13.4", { country: "DE" }), "weur"], [cf("EU", "21.0", { country: "PL" }), "eeur"], [cf("EU", 20), "eeur"], [cf("EU", "19.9999"), "weur"],
    [cf("AS", "55.3", { country: "AE" }), "me"], [cf("AS", "139.7", { country: "JP" }), "apac"], [cf("AS", 60), "apac"], [cf("AS", "59.9999"), "me"],
    [{ continent: "SA" }, "sam"], [{ continent: "SA", longitude: "-46.6" }, "sam"], [{ continent: "AF" }, "afr"], [{ continent: "OC" }, "oc"],
    [{ continent: "AN" }, null], [{ continent: "T1" }, null], [{ continent: "na", longitude: "-122" }, null], [{ longitude: "-122" }, null],
    [cf("NA", undefined), null], [cf("NA", null), null], [cf("NA", ""), null], [cf("NA", "  "), null], [cf("NA", "west"), null],
    [cf("NA", NaN), null], [cf("NA", Infinity), null], [cf("NA", true), null], [cf("EU", []), null], [cf("AS", {}), null],
    [{}, null], [null, null], [undefined, null], ["NA", null], [42, null],
  ];
  for (const [input, want] of table) assert.equal(locationHintFor(input), want, JSON.stringify(input));
  /* every answer is on the list; the list is Cloudflare's eleven */
  assert.equal(LOCATION_HINTS.length, 11);
  assert.deepEqual([...LOCATION_HINTS].sort(), ["afr", "apac", "apac-ne", "apac-se", "eeur", "enam", "me", "oc", "sam", "weur", "wnam"]);
  for (const [, want] of table) assert.ok(want === null || LOCATION_HINTS.includes(want));
});

test("R42: storeLocationBinding answers the plain text for an allowed hint and nothing for any other value", () => {
  for (const h of LOCATION_HINTS) assert.deepEqual(storeLocationBinding(h), [{ type: "plain_text", name: "STORE_LOCATION", text: h }], h);
  /* "eu" is a jurisdiction since R46: it binds STORE_JURISDICTION, never STORE_LOCATION */
  assert.deepEqual(storeLocationBinding("eu"), [{ type: "plain_text", name: "STORE_JURISDICTION", text: "eu" }]);
  for (const bad of ["bogus", "", "WNAM", " wnam", "wnam ", "EU", "apac-sw", null, undefined, 3, ["wnam"], {}]) assert.deepEqual(storeLocationBinding(bad), [], JSON.stringify(bad));
});

test("R42: the install's creating upload carries STORE_LOCATION when given a hint, and is otherwise exactly the list of R12", async () => {
  const w = account({});
  await install(await bundle(), { storeLocation: "wnam" });
  const withHint = w.puts.at(-1).meta;
  assert.deepEqual(plain(withHint.bindings, "STORE_LOCATION"), [{ type: "plain_text", name: "STORE_LOCATION", text: "wnam" }]);
  assert.equal(plain(withHint.bindings, "STORE_GENERATION").length, 0, "no generation is invented");
  w.restore();
  const none = account({});
  await install(await bundle());
  const without = none.puts.at(-1).meta;
  assert.equal(plain(without.bindings, "STORE_LOCATION").length, 0);
  /* control: the same upload minus the one binding is the list as it was */
  assert.deepEqual(withHint.bindings.filter((b) => b.name !== "STORE_LOCATION"), without.bindings);
  assert.deepEqual({ ...withHint, bindings: null }, { ...without, bindings: null });
  none.restore();
  for (const bad of ["bogus", "WNAM", ""]) {
    const v = account({});
    await install(await bundle(), { storeLocation: bad });
    assert.equal(plain(v.puts.at(-1).meta.bindings, "STORE_LOCATION").length, 0, JSON.stringify(bad) + " is not sent");
    v.restore();
  }
});

test("R42: an update restates the STORE_LOCATION and STORE_GENERATION the script holds, as they are, and invents none", async () => {
  const w = account({ pre: held(["STORE_LOCATION", "wnam"], ["STORE_GENERATION", "2"]) });
  await update(await bundle());
  const b = lastPlane(w).meta.bindings;
  assert.deepEqual(plain(b, "STORE_LOCATION"), [{ type: "plain_text", name: "STORE_LOCATION", text: "wnam" }]);
  assert.deepEqual(plain(b, "STORE_GENERATION"), [{ type: "plain_text", name: "STORE_GENERATION", text: "2" }]);
  assert.deepEqual(lastPlane(w).bindings.filter((x) => /^STORE_/.test(x.name)).map((x) => [x.name, x.text]).sort(), [["STORE_GENERATION", "2"], ["STORE_LOCATION", "wnam"]], "the account still holds both");
  w.restore();
  /* a hint held without a generation restates the hint alone */
  const h = account({ pre: held(["STORE_LOCATION", "enam"]) });
  await update(await bundle(), { storeLocation: "wnam" });
  assert.deepEqual(plain(lastPlane(h).meta.bindings, "STORE_LOCATION"), [{ type: "plain_text", name: "STORE_LOCATION", text: "enam" }], "a hint given to an update never replaces the held one: a room never moves");
  assert.equal(plain(lastPlane(h).meta.bindings, "STORE_GENERATION").length, 0);
  h.restore();
  /* none held: none sent, the update's list is otherwise unchanged */
  const n = account({ pre: { grp: [] } });
  await update(await bundle());
  assert.equal(plain(lastPlane(n).meta.bindings, "STORE_LOCATION").length, 0);
  assert.equal(plain(lastPlane(n).meta.bindings, "STORE_GENERATION").length, 0);
  assert.equal(lastPlane(n).bindings.some((x) => /^STORE_(LOCATION|GENERATION)$/.test(x.name)), false);
  n.restore();
});

test("R42: the install sequence (creating PUT, step-3 re-PUT, own-hosts re-PUT, an update) ends with STORE_LOCATION present", async () => {
  /* the member the fleet step uploaded is on the account by the time of the re-PUT (a service binding to none is refused) */
  const w = account({ pre: { "pdf-worker-grp": [] } });
  const rel = await bundle();
  await install(rel, { storeLocation: "weur" });
  assert.equal(lastPlane(w).bindings.find((x) => x.name === "STORE_LOCATION")?.text, "weur", "after the creating PUT");
  /* the step-3 re-PUT of bindMembers, with a member added */
  await bindMembers(sink(), session(), "A1", "grp", rel, [], { done: ["pdf-worker"] }, { withR2: true, names: NAMES, writeHosts: true, ownHosts: ["grp.example.workers.dev"] });
  assert.equal(w.planePuts.length, 2, "the creating PUT and the re-PUT");
  assert.equal(lastPlane(w).bindings.find((x) => x.name === "STORE_LOCATION")?.text, "weur", "after the step-3 re-PUT");
  assert.equal(plain(lastPlane(w).meta.bindings, "STORE_LOCATION").length, 1);
  /* the own-hosts re-PUT, where nothing was added, and then an update */
  await bindMembers(sink(), session(), "A1", "grp", rel, ["pdf-worker"], { done: [] }, { withR2: true, names: NAMES, writeHosts: true, ownHosts: ["grp.example.workers.dev"] });
  assert.equal(lastPlane(w).bindings.find((x) => x.name === "STORE_LOCATION")?.text, "weur", "after the own-hosts re-PUT");
  await update(rel, { members: ["pdf-worker"] });
  assert.equal(lastPlane(w).bindings.find((x) => x.name === "STORE_LOCATION")?.text, "weur", "after an update");
  assert.equal(lastPlane(w).bindings.some((x) => x.name === "STORE_GENERATION"), false);
  w.restore();
  /* control: an install given no hint ends with none anywhere in the sequence */
  const c = account({ pre: { "pdf-worker-grp": [] } });
  await install(rel);
  await bindMembers(sink(), session(), "A1", "grp", rel, [], { done: ["pdf-worker"] }, { withR2: true, names: NAMES });
  await update(rel);
  for (const p of c.planePuts) assert.equal(p.bindings.some((x) => /^STORE_(LOCATION|GENERATION)$/.test(x.name)), false);
  c.restore();
});

test("R42: an update of a script that exists whose held settings cannot be read refuses before anything is uploaded (and says so)", async () => {
  const rel = await bundle();
  for (const mode of [{ settingsBlind: true }, { lookupFail: ["grp"] }]) {
    const w = account({ pre: held(["STORE_LOCATION", "wnam"]), ...mode });
    await assert.rejects(update(rel), (e) => !e.approveAgain && typeof e.message === "string" && e.message.length > 0 && !e.message.includes("TOKEN-THAT"), JSON.stringify(mode));
    assert.equal(w.puts.length, 0, JSON.stringify(mode) + ": nothing was PUT");
    assert.equal(w.schedules.size, 0, JSON.stringify(mode) + ": no schedule");
    assert.equal(w.secretPuts.length, 0);
    w.restore();
  }
  /* an expired approval is handed on as it is, never read as unreadable settings */
  const x = account({ pre: held(["STORE_LOCATION", "wnam"]), expireAfter: 0 });
  await assert.rejects(update(rel), (e) => e.approveAgain === true);
  assert.equal(x.puts.length, 0);
  x.restore();
  /* control: the same account with readable settings completes */
  const ok = account({ pre: held(["STORE_LOCATION", "wnam"]) });
  await update(rel);
  assert.equal(ok.puts.length, 1);
  ok.restore();
});

test("R42: uploadUpdate reads the held place itself, from the caller's slug: it needs nothing from the caller", async () => {
  const w = account({ pre: held(["STORE_LOCATION", "apac"], ["STORE_GENERATION", "3"]) });
  await update(await bundle(), { held: [], location: "sam", generation: "9", storeLocation: "sam" });
  const b = lastPlane(w).meta.bindings;
  assert.deepEqual(plain(b, "STORE_LOCATION").map((x) => x.text), ["apac"]);
  assert.deepEqual(plain(b, "STORE_GENERATION").map((x) => x.text), ["3"]);
  w.restore();
});

test("R42: planeInSync treats a held place that differs from what an install would send, or none, as in sync (a room never moves)", async () => {
  const rel = await bundle();
  for (const texts of [[], [["STORE_LOCATION", "enam"]], [["STORE_LOCATION", "bogus"], ["STORE_GENERATION", "4"]]]) {
    const w = account({});
    await install(rel, { storeLocation: "wnam" });
    /* make the held place differ from what the install sent, in the account itself */
    const held_ = w.scripts.get("grp").filter((b) => !/^STORE_(LOCATION|GENERATION)$/.test(b.name));
    w.scripts.set("grp", [...held_, ...texts.map(([name, text]) => ({ type: "plain_text", name, text }))]);
    const list = (await heldBindings(session(), "A1", "grp")).list;
    assert.equal(await planeInSync(session(), "A1", "grp", rel, list, { names: NAMES, members: [], profiles: [], storeLocation: "wnam" }), true, JSON.stringify(texts));
    w.restore();
  }
  /* control: another binding missing still makes it out of sync */
  const c = account({});
  await install(rel, { storeLocation: "wnam" });
  c.scripts.set("grp", c.scripts.get("grp").filter((b) => b.name !== "BROWSER"));
  const list = (await heldBindings(session(), "A1", "grp")).list;
  assert.equal(await planeInSync(session(), "A1", "grp", rel, list, { names: NAMES, members: [], profiles: [] }), false);
  c.restore();
});

test("R41: no upload carries a country, a continent or a longitude: only the hint is sent", async () => {
  const w = account({});
  await install(await bundle(), { storeLocation: locationHintFor({ continent: "EU", longitude: "13.4", country: "DE" }) });
  const text = JSON.stringify(w.puts.at(-1).meta);
  assert.equal(/Germany|\bDE\b|13\.4|"EU"/.test(text), false, "only the hint is sent");
  assert.equal(plain(w.puts.at(-1).meta.bindings, "STORE_LOCATION")[0].text, "weur");
  w.restore();
});

/* The parity test (a test, not product code: R35 stands). Red by name until `runtime-limits` has merged (the provider). */
test("R41: the hint list equals runtime-limits' STORE_HINTS, in the same order", async () => {
  const { STORE_HINTS } = await import("../../../bio-plane/src/store-place.mjs");
  assert.deepEqual([...LOCATION_HINTS], [...STORE_HINTS]);
});
