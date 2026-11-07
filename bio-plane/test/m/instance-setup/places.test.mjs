/* A place not yet held (R60, R62; DEC-150) at the module's interface: the module over the real record-core, its routes
   through the frame control-plane joins them to, an injected profile view whose held profiles a test can change between
   boots (an installed update bringing a profile), and `queue-producers`' registration as a stand-in recording what it
   is handed (its R38). */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, frame, providers } from "./fixture.mjs";
import { INSTANCE_SETUP_CHECKS, INSTANCE_SETUP_TABLE_DECLARATIONS, PLACE_NAME_MAX } from "../../../src/setup.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const call = async (m, path, body) => (await frame(m, new Request(`http://do/${path}`,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))).json();
const profile = (id, name, covers, extra = {}) => ({ id, name, covers, test: false, ...extra });
const HELD = [profile("p-river", "River County", ["River Town"]), profile("p-test", "Testland", ["Nowhere"], { test: true })];
const LAKE = profile("p-lake", "Lake Shore and Valley", ["Lake  Shore", "Valley Town"]);

/* One copy over one storage, with the held profiles as `held()` says at each boot. */
async function world({ held = HELD } = {}) {
  let views = held;
  const registered = [];
  const queueProducers = { registerPlaceArrivals(read) { registered.push(read); return { ok: true }; } };
  const jurisdictions = { list: () => views, get: (id) => views.find((p) => p.id === id) || null,
                          combine: () => ({ ok: true, conflicts: [], view: {} }) };
  let t = Date.parse("2026-10-06T08:00:00Z");
  const prov = providers({ admins: ["admin", "member:ada"] });
  const more = { jurisdictions, queueProducers };
  const w = await boot({ prov, now: () => t, more });
  /* a later start of the same storage, as an installed update restarts the Durable Object */
  const restart = async () => { t += 60_000; const again = await boot({ st: w.st, prov, now: () => t, more }); return again; };
  return { ...w, registered, restart, setHeld: (list) => { views = list; }, tick: () => { t += 60_000; } };
}

test("R60 placeWantedSet is an administrator's act only (NOT_AN_ADMIN, membership R84): trimmed text of 1 to 200 characters on one line, else PLACE_NAME_MALFORMED (C-64.8); null clears it; each set or clear appended with who and when; nothing written on a refusal", async () => {
  const w = await world();
  for (const by of [null, "", "ruth", "class:admin"]) {
    const r = w.m.placeWantedSet({ name: "Lake Shore", by });
    assert.deepEqual([r.ok, r.reason, r.check], [false, "NOT_AN_ADMIN", "C-96.1"], String(by));
  }
  for (const bad of [undefined, "", "   ", "x".repeat(PLACE_NAME_MAX + 1), "two\nlines", "tab\there", "nel\u0085x", 7, {}]) {
    const r = w.m.placeWantedSet({ name: bad, by: "admin" });
    assert.deepEqual([r.ok, r.reason, r.check], [false, "PLACE_NAME_MALFORMED", "C-64.8"], JSON.stringify(bad));
    assert.equal(r.translation, INSTANCE_SETUP_CHECKS.PLACE_NAME_MALFORMED.translation);
  }
  assert.equal(PLACE_NAME_MAX, 200);
  assert.equal(w.st.db.prepare(`SELECT count(*) n FROM place_wanted`).get().n, 0, "no refusal writes");
  assert.equal(w.m.placeWantedSet({ name: "é".repeat(200), by: "admin" }).ok, true);           // characters, not bytes
  const set = w.m.placeWantedSet({ name: "  Lake Shore  ", by: "member:ada" });
  assert.deepEqual([set.ok, set.name, set.set_by, set.set_at], [true, "Lake Shore", "member:ada", "2026-10-06T08:00:00.000Z"]);
  assert.equal(set.note, word("setup.note.name_kept_group"));
  w.tick();
  const clear = w.m.placeWantedSet({ name: null, by: "admin" });
  assert.deepEqual([clear.ok, clear.name], [true, null]);
  assert.deepEqual(clear.history.map((h) => [h.name, h.set_by]), [["é".repeat(200), "admin"], ["Lake Shore", "member:ada"], [null, "admin"]]);
  /* through the route: `by` is the stamp, never the body's */
  const forged = await call(w.m, "placewanted?by=ruth", { name: "Lake Shore", by: "admin" });
  assert.equal(forged.result.reason, "NOT_AN_ADMIN");
  const own = await call(w.m, "placewanted?by=admin", { name: "Lake Shore" });
  assert.deepEqual([own.result.ok, own.result.set_by], [true, "admin"]);
});

test("R60 placeWanted answers {name, set_by, set_at, matches} to an administrator and NOT_AN_ADMIN to anyone else; the name is kept only here: no public read carries it, nothing is fetched, and its tables are never exported", async () => {
  const w = await world();
  assert.deepEqual(w.m.placeWanted({ viewer: "admin" }), { ok: true, name: null, names: [], set_by: null, set_at: null, matches: [] });
  w.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
  const st = w.m.placeWanted({ viewer: "member:ada" });
  assert.deepEqual([st.name, st.set_by, st.matches], ["Lake Shore", "admin", []]);
  for (const viewer of [null, "ruth", "class:probe"]) assert.equal(w.m.placeWanted({ viewer }).reason, "NOT_AN_ADMIN", String(viewer));
  const routed = await call(w.m, "placewantedstate?viewer=admin");
  assert.equal(routed.result.name, "Lake Shore");
  assert.equal((await call(w.m, "placewantedstate?viewer=ruth")).result.reason, "NOT_AN_ADMIN");
  /* no answer a stranger or a member reads carries it, and no request leaves for any host */
  w.prov.admins.add("admin");
  for (const out of [w.m.instanceGroupPublic(), w.m.groupIdentityPublic(), w.m.instanceGroup(), w.m.groupIdentity(), w.m.profiles(),
                     w.m.assistantState(), w.m.memberLanguage({ viewer: "ruth" })])
    assert.equal(JSON.stringify(out).includes("Lake Shore"), false, JSON.stringify(out).slice(0, 80));
  assert.equal(w.prov.fetched.length, 0);
  for (const t of ["place_wanted", "place_seen", "place_arrivals"]) {
    const d = INSTANCE_SETUP_TABLE_DECLARATIONS.find((x) => x.name === t);
    assert.deepEqual([d.export, d.purge], ["never", "exempt"], t);
  }
  /* a purge in either form clears none of it */
  w.record.purge({});
  assert.equal(w.m.placeWanted({ viewer: "admin" }).name, "Lake Shore");
});

test("R62 at a later start a held non-test profile matching the named place by name or a covers entry (term fold, then exact) that was not held when the name was set is recorded once as an arrival {name, profile, found_at}; placeArrivals answers it to administrators only; a profile held at the set, a test profile and a near name are not", async () => {
  const w = await world();
  w.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
  /* the update brings LAKE (its covers fold to "lake shore") and a test profile and a near name that also match loosely */
  w.setHeld([...HELD, LAKE, profile("p-lake-test", "Lake Shore", [], { test: true }), profile("p-near", "Lake Shores", ["Shore"])]);
  const after = await w.restart();
  assert.deepEqual(after.started.places, { compared: true, arrived: 1 });
  const { ok, arrivals: open } = after.m.placeArrivals({ viewer: "admin" });
  assert.equal(ok, true);
  /* R113 (T53): each arrival answers its layer beside its profile; R109: and that the team's own entries stay */
  assert.deepEqual(open, [{ name: "Lake Shore", profile: "p-lake", layer: "p-lake", profile_name: "Lake Shore and Valley",
                            covers: ["Lake  Shore", "Valley Town"], found_at: "2026-10-06T08:01:00.000Z",
                            note: localize("instance-setup.places.arrival_entries_kept", "Your team's own entries about this place stay in your team's layer and keep working, beside the shipped layer's.") }]);
  for (const viewer of ["", "ruth", "class:probe"]) assert.deepEqual(after.m.placeArrivals({ viewer }), { ok: true, arrivals: [] }, viewer);
  /* the plane's own in-process read, as queue-producers R38 reads it, answers them for the administrators' item */
  assert.deepEqual(after.m.placeArrivals({ viewer: null }).arrivals, open);
  assert.deepEqual(after.m.placeArrivals().arrivals, open);
  assert.deepEqual(after.m.placeWanted({ viewer: "admin" }).matches, open);
  /* once: a further start records nothing again */
  const again = await w.restart();
  assert.deepEqual(again.started.places, { compared: true, arrived: 0 });
  assert.equal(again.m.placeArrivals({ viewer: "admin" }).arrivals.length, 1);
  /* a profile already held when the name is set is no arrival, and a profile matched by its own name is */
  const v = await world({ held: [...HELD, LAKE] });
  v.m.placeWantedSet({ name: "lake shore", by: "admin" });
  v.setHeld([...HELD, LAKE, profile("p-valley", "Valley Town", [])]);
  const vr = await v.restart();
  assert.deepEqual(vr.m.placeArrivals({ viewer: "admin" }).arrivals, [], "LAKE was held at the set; Valley Town does not match");
  v.m.placeWantedSet({ name: "Valley Town", by: "admin" });
  v.setHeld([...HELD, LAKE, profile("p-valley", "Valley Town", []), profile("p-vt", "VALLEY TOWN", [])]);
  const vr2 = await v.restart();
  assert.deepEqual(vr2.m.placeArrivals({ viewer: "admin" }).arrivals.map((a) => a.profile), ["p-vt"], "held at the second set: p-valley is not new");
  /* no place named: nothing is compared */
  const none = await world();
  none.setHeld([...HELD, LAKE]);
  assert.deepEqual((await none.restart()).started.places, { compared: false });
});

test("R62 a profile already active is not an arrival; an arrival leaves when an administrator makes that profile active (R14), or when the name is cleared or changed; offices the group added stay as they are", async () => {
  const w = await world();
  w.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
  w.setHeld([...HELD, LAKE]);
  await w.restart();
  assert.equal(w.m.placeArrivals({ viewer: "admin" }).arrivals.length, 1);
  /* chosen under Places: it leaves, and stays left */
  assert.equal(w.m.profilesSet({ profiles: ["p-lake"], by: "admin" }).ok, true);
  assert.deepEqual(w.m.placeArrivals({ viewer: "admin" }).arrivals, []);
  assert.deepEqual(w.st.db.prepare(`SELECT left_why FROM place_arrivals`).all().map((r) => r.left_why), [word("setup.leave_arrivals.profile_made_active")]);
  /* changed, then cleared */
  for (const [next, why] of [["Lake  shore ", null], [null, word("setup.leave_arrivals.name_cleared")]]) {
    const c = await world();
    c.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
    c.setHeld([...HELD, LAKE]);
    await c.restart();
    c.m.placeWantedSet({ name: next ?? null, by: "admin" });
    assert.deepEqual(c.m.placeArrivals({ viewer: "admin" }).arrivals, [], String(next));
    assert.equal(c.st.db.prepare(`SELECT left_why FROM place_arrivals`).get().left_why, why ?? word("setup.leave_arrivals.name_changed"));
  }
  /* active before it arrives: not an arrival */
  const a = await world({ held: HELD });
  a.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
  a.setHeld([...HELD, LAKE]);
  a.record.setSetting("jurisdiction_profiles", ["p-lake"], "admin");
  const ar = await a.restart();
  assert.deepEqual([ar.started.places.arrived, ar.m.placeArrivals({ viewer: "admin" }).arrivals], [0, []]);
});

test("R62 at start this module registers placeArrivals once with queue-producers (its R38), read as the plane: the read answers {ok, arrivals} with the open arrivals to the plane (viewer null) and to an administrator, and none to anyone else", async () => {
  const w = await world();
  assert.equal(w.registered.length, 1);
  assert.deepEqual(w.started.arrivals, { ok: true });
  w.m.placeWantedSet({ name: "Lake Shore", by: "admin" });
  w.setHeld([...HELD, LAKE]);
  const later = await w.restart();
  assert.equal(w.registered.length, 2, "each start of a new instance registers its own read once");
  const read = w.registered.at(-1);
  assert.deepEqual(read({ viewer: null }).arrivals.map((a) => a.profile), ["p-lake"]);
  assert.deepEqual(read({}).arrivals.map((a) => a.profile), ["p-lake"]);
  assert.deepEqual(read({ viewer: "admin" }).arrivals.map((a) => a.profile), ["p-lake"]);
  assert.deepEqual(read({ viewer: "ruth" }), { ok: true, arrivals: [] });
  /* a second start of the same instance registers nothing again */
  assert.equal((await later.m.start()).started, false);
  assert.equal(w.registered.length, 2);
  /* with no producers to register with, the start says so and goes on */
  const bare = await boot({ prov: providers() });
  assert.deepEqual([bare.started.ok, bare.started.arrivals.ok], [true, false]);
});
