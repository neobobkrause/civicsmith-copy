/* The jurisdiction profiles (R12–R14, R16, N10) and R31, at the module's interface. The profiles held are `jurisdictions`'
   own: one real profile and one test profile. The page's half (the choice under Places) is setup-page's (its R13). */
import test from "node:test";
import assert from "node:assert/strict";
import { list as heldProfiles, combine } from "../../../../jurisdictions/index.mjs";
import { boot, stubOver, doAnswer } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { INSTANCE_SETUP_CHECKS, HOSTING_CONTROL, hostingControlBlock, NO_GROUP_RECORDED, RUNTIME_ASYMMETRY } from "../../../src/setup.mjs";

const REAL = heldProfiles().filter((p) => p.test !== true);
const TEST = heldProfiles().filter((p) => p.test === true);
const world = async (env = {}) => { const w = await boot({ env }); w.prov.admins = new Set(["admin", "member:ada"]); return w; };

test("R12 profiles(): the record-core setting's ids in order, each with its name and covers, combine's conflicts, and no active profile answered as valid", async () => {
  assert.ok(REAL.length >= 1 && TEST.length >= 1, "jurisdictions holds a real and a test profile");
  const w = await world();
  const empty = w.m.profiles();
  assert.deepEqual([empty.ok, empty.profiles, empty.conflicts], [true, [], []]);
  assert.equal(empty.detail, word("instance-setup.profiles.detail.none_active"));
  assert.deepEqual(empty.choices.map((c) => c.id), REAL.map((p) => p.id));
  w.record.setSetting("jurisdiction_profiles", [REAL[0].id], "admin");
  const one = w.m.profiles();
  assert.deepEqual(one.profiles, [{ id: REAL[0].id, name: REAL[0].name, covers: REAL[0].covers }]);
  assert.deepEqual(one.conflicts, combine([REAL[0].id]).conflicts);
  assert.equal("detail" in one, false);
  /* combine's conflicts are reported over the list as it stands, whatever it holds */
  w.record.setSetting("jurisdiction_profiles", [REAL[0].id, TEST[0].id], "admin");
  const two = w.m.profiles();
  assert.deepEqual(two.profiles.map((p) => p.id), [REAL[0].id, TEST[0].id]);
  assert.deepEqual(two.conflicts, combine([REAL[0].id, TEST[0].id]).conflicts);
  /* an id the setting holds that is no longer held is named, never dropped */
  w.record.setSetting("jurisdiction_profiles", ["gone-profile"], "admin");
  const gone = w.m.profiles();
  assert.deepEqual(gone.profiles, [{ id: "gone-profile", name: null, covers: null, held: false }]);
  assert.ok(Array.isArray(gone.errors) && gone.errors.length);
});

/* R12's view as `combine` gives it over `ids`: the three facts, each absent when the combined view holds none. */
const viewOf = (ids) => {
  const c = combine(ids);
  const want = {};
  if (!c.ok) return want;
  for (const f of ["deadlines", "legal_organisations"]) if ((c.view[f] || []).length) want[f] = c.view[f];
  const venues = (c.view.action_kinds || []).filter((k) => k.venue).map((k) => ({ kind: k.kind, venue: k.venue }));
  if (venues.length) want.venues = venues;
  /* (fix round 4, C64-law) records_laws, records_help and name, as combine gives them, absent when it states none */
  for (const f of ["records_laws", "records_help", "name"]) if (c.view[f] !== undefined && !(Array.isArray(c.view[f]) && !c.view[f].length)) want[f] = c.view[f];
  /* R108 (T53): the chain's layers with their coverage, as combine gives them */
  if (Array.isArray(c.view.layers) && c.view.layers.length) want.layers = c.view.layers;
  return want;
};

test("R12 R16 profiles() carries view: combine's deadlines and legal_organisations, and each {kind, venue} of a combined action kind that gives one, over two profiles one not Oakland's; a venue combine withholds, and every fact when nothing is active or the list cannot be combined, is absent, never an empty list; through the route too", async () => {
  const w = await world();
  const OAK = REAL.find((p) => p.id === "oakland-alameda"), OTHER = TEST[0];
  assert.ok(OAK && OTHER && OTHER.id !== OAK.id, "two held profiles, one not Oakland's");
  /* nothing active: the view states no fact, so agent-worker reads each undetermined */
  assert.deepEqual(w.m.profiles().view, {});
  for (const ids of [[OTHER.id], [OAK.id], [OAK.id, OTHER.id]]) {
    w.record.setSetting("jurisdiction_profiles", ids, "admin");
    const view = w.m.profiles().view;
    const c = combine(ids);
    assert.deepEqual(view, viewOf(ids), ids.join("+"));
    for (const f of ["deadlines", "legal_organisations", "venues"]) {
      assert.ok(Array.isArray(view[f]) && view[f].length > 0, `${ids.join("+")}: ${f} stated`);
      for (const x of view[f]) assert.equal(typeof x, "object");
    }
    assert.deepEqual(view.deadlines, c.view.deadlines);
    assert.deepEqual(view.legal_organisations, c.view.legal_organisations);
    for (const v of view.venues) assert.deepEqual(Object.keys(v), ["kind", "venue"]);
    /* every kind that gives a venue is listed, with that venue as combined, and no other */
    assert.deepEqual(view.venues.map((v) => v.kind), c.view.action_kinds.filter((k) => k.venue).map((k) => k.kind));
    for (const v of view.venues) assert.deepEqual(v.venue, c.view.action_kinds.find((k) => k.kind === v.kind).venue);
  }
  /* the profile that is not Oakland's alone: its own facts, none of Oakland's */
  w.record.setSetting("jurisdiction_profiles", [OTHER.id], "admin");
  const own = w.m.profiles().view;
  for (const f of ["deadlines", "legal_organisations"]) for (const x of own[f]) assert.equal(x.profile, OTHER.id, f);
  for (const v of own.venues) assert.equal(v.venue.profile, OTHER.id);
  /* together: the two disagree on records_request's venue, so combine withholds it and the view lists no venue for it */
  w.record.setSetting("jurisdiction_profiles", [OAK.id, OTHER.id], "admin");
  const both = w.m.profiles();
  assert.ok(both.conflicts.some((x) => x.at === "action_kinds[records_request].venue"), "the premise: a withheld venue");
  assert.equal(both.view.venues.some((v) => v.kind === "records_request"), false);
  assert.ok(both.view.venues.some((v) => v.venue.profile === OAK.id) && both.view.venues.some((v) => v.venue.profile === OTHER.id));
  /* a list combine cannot give answers no fact at all */
  w.record.setSetting("jurisdiction_profiles", [OAK.id, "gone-profile"], "admin");
  const gone = w.m.profiles();
  assert.ok(gone.errors.length);
  assert.deepEqual(gone.view, {});
  /* an empty list set by an administrator: none */
  w.prov.admins.add("admin");
  assert.deepEqual(w.m.profilesSet({ profiles: [], by: "admin" }).view, {});
  /* R16: the namespace addressed answers its own view, through the route the plane relays */
  const scratch = await world();
  w.m.profilesSet({ profiles: [OAK.id], by: "admin" });
  const routed = await doAnswer(stubOver(w.m).fetch("http://do/profiles"));
  assert.deepEqual(routed.result.view, viewOf([OAK.id]));
  assert.deepEqual((await doAnswer(stubOver(scratch.m).fetch("http://do/profiles"))).result.view, {});
});

test("R12 profiles().view also carries records_laws (each law whole), records_help and name as combine gives them, and none of them when no profile is active (C64-law)", async () => {
  const w = await world();
  const OAK = REAL.find((p) => p.id === "oakland-alameda"), OTHER = TEST[0];
  /* control: no active profile states none of the three */
  const none = w.m.profiles().view;
  for (const f of ["records_laws", "records_help", "name"]) assert.equal(f in none, false, `none active: ${f} absent`);
  /* the first profile: its laws whole, the federal one naming foia_response, and its name */
  w.record.setSetting("jurisdiction_profiles", [OAK.id], "admin");
  const c = combine([OAK.id]);
  const one = w.m.profiles().view;
  assert.deepEqual(one.records_laws, c.view.records_laws);
  assert.ok(one.records_laws.length >= 1);
  for (const l of one.records_laws) for (const k of ["level", "name", "citation", "response", "stages", "requesters"]) assert.ok(k in l, `${l.name}: ${k}`);
  assert.ok(one.records_laws.some((l) => l.level === "federal" && l.response === "foia_response"), "the federal law names foia_response");
  assert.equal(one.name, c.view.name);
  assert.equal("records_help" in one, c.view.records_help !== undefined);
  /* a profile that states records_help: it reaches the view as combine gives it */
  const stated = [OTHER.id], cs = combine(stated);
  assert.ok(cs.view.records_help, "the premise: the test profile states records_help");
  w.record.setSetting("jurisdiction_profiles", stated, "admin");
  const two = w.m.profiles().view;
  assert.deepEqual(two.records_help, cs.view.records_help);
  assert.deepEqual(two.records_laws, cs.view.records_laws);
  assert.equal(two.name, cs.view.name);
  /* the three old facts are unchanged */
  assert.deepEqual(w.m.profiles().view, viewOf(stated));
});

test("R13 at the first boot JURISDICTION_PROFILES (comma-separated, in order) is recorded when every id is held and none is a test profile; else nothing is recorded and profiles() says why; no later boot records it", async () => {
  const ok = await world({ JURISDICTION_PROFILES: ` ${REAL[0].id} ` });
  assert.deepEqual(ok.m.profiles().profiles.map((p) => p.id), [REAL[0].id]);
  assert.deepEqual(ok.started.profiles, { recorded: true, profiles: [REAL[0].id] });
  const unknown = await world({ JURISDICTION_PROFILES: `${REAL[0].id},nowhere-profile` });
  assert.deepEqual(unknown.m.profiles().profiles, []);
  assert.match(unknown.m.profiles().boot.why, /nowhere-profile/);
  assert.equal(unknown.record.getSetting("jurisdiction_profiles"), null);
  const testOne = await world({ JURISDICTION_PROFILES: `${REAL[0].id},${TEST[0].id}` });
  assert.deepEqual(testOne.m.profiles().profiles, []);
  assert.match(testOne.m.profiles().boot.why, new RegExp(TEST[0].id));
  const unbound = await world({});
  assert.equal(unbound.started.profiles.bound, false);
  assert.equal("boot" in unbound.m.profiles(), false);
  /* a later boot records nothing, whatever the binding says */
  const later = await boot({ st: unbound.st, env: { JURISDICTION_PROFILES: REAL[0].id } });
  assert.deepEqual(later.m.profiles().profiles, []);
  const moved = await boot({ st: ok.st, env: { JURISDICTION_PROFILES: "" } });
  assert.deepEqual(moved.m.profiles().profiles.map((p) => p.id), [REAL[0].id]);
});

test("R14 profilesSet replaces the list: PROFILES_NOT_ADMIN, NOT_A_LIST, UNKNOWN_PROFILE, PROFILE_IS_TEST (C-119); recorded through setSetting with by, dated and attributed", async () => {
  const w = await world();
  const refused = [
    [w.m.profilesSet({ profiles: [REAL[0].id], by: "member:bob" }), "PROFILES_NOT_ADMIN", "C-119.1"],
    [w.m.profilesSet({ profiles: [REAL[0].id], by: null }), "PROFILES_NOT_ADMIN", "C-119.1"],
    [w.m.profilesSet({ profiles: "oakland", by: "admin" }), "NOT_A_LIST", "C-119.2"],
    [w.m.profilesSet({ by: "admin" }), "NOT_A_LIST", "C-119.2"],
    [w.m.profilesSet({ profiles: [REAL[0].id, "nowhere"], by: "admin" }), "UNKNOWN_PROFILE", "C-119.3"],
    [w.m.profilesSet({ profiles: [7], by: "admin" }), "UNKNOWN_PROFILE", "C-119.3"],
    [w.m.profilesSet({ profiles: [TEST[0].id], by: "admin" }), "PROFILE_IS_TEST", "C-119.4"],
  ];
  for (const [r, code, check] of refused) {
    assert.deepEqual([r.ok, r.reason, r.check], [false, code, check]);
    assert.equal(r.translation, INSTANCE_SETUP_CHECKS[code].translation);
  }
  assert.deepEqual(refused[4][0].profiles, ["nowhere"]);
  assert.deepEqual(refused[6][0].profiles, [TEST[0].id]);
  assert.equal(w.record.getSetting("jurisdiction_profiles"), null);
  /* the administrator's check comes first: a non-administrator learns nothing about what it sent */
  assert.equal(w.m.profilesSet({ profiles: "x", by: "member:bob" }).reason, "PROFILES_NOT_ADMIN");
  const set = w.m.profilesSet({ profiles: [REAL[0].id, REAL[0].id], by: "member:ada" });
  assert.equal(set.ok, true);
  assert.equal(set.set_by, "member:ada");
  assert.deepEqual(set.profiles.map((p) => p.id), [REAL[0].id]);
  const row = w.st.db.prepare(`SELECT value, set_by, set_at FROM settings WHERE name='jurisdiction_profiles' ORDER BY rowid DESC`).get();
  assert.deepEqual([JSON.parse(row.value), row.set_by], [[REAL[0].id], "member:ada"]);
  assert.match(row.set_at, /^\d{4}-\d\d-\d\dT/);
  const none = w.m.profilesSet({ profiles: [], by: "admin" });
  assert.equal(none.ok, true);
  assert.deepEqual(none.profiles, []);
  assert.equal(none.note, word("setup.note.profile_active_now"));
  assert.equal(w.st.db.prepare(`SELECT count(*) n FROM settings WHERE name='jurisdiction_profiles'`).get().n, 2);
});

test("R16 profiles() and profilesSet answer from the namespace addressed: a scratch store holds its own list", async () => {
  const bio = await world();
  const scratch = await world();
  bio.m.profilesSet({ profiles: [REAL[0].id], by: "admin" });
  assert.deepEqual(bio.m.profiles().profiles.map((p) => p.id), [REAL[0].id]);
  assert.deepEqual(scratch.m.profiles().profiles, []);
  scratch.m.profilesSet({ profiles: [], by: "admin" });
  assert.deepEqual(bio.m.profiles().profiles.map((p) => p.id), [REAL[0].id]);
});

test("R31 no place is named in this module's outward text: R47's block it holds (R83: it serves no page), every refusal and every stated sentence name no jurisdiction a profile covers", async () => {
  const places = heldProfiles().flatMap((p) => p.covers).flatMap((c) => c.split(/\s+(?:of|and)\s+|\s+/))
    .filter((w) => /^[A-Z]/.test(w) && !["City", "County", "Town"].includes(w));
  assert.ok(places.length >= 2);
  const w = await world({ INSTANCE_NAME: "river-town" });
  w.prov.admins = new Set(["admin"]);
  const texts = [hostingControlBlock("notice"), JSON.stringify(HOSTING_CONTROL), NO_GROUP_RECORDED, RUNTIME_ASYMMETRY,
    ...Object.values(INSTANCE_SETUP_CHECKS).map((r) => r.translation),
    /* the choices are the profiles' own data (jurisdictions'), never this module's words */
    JSON.stringify({ ...w.m.profiles(), choices: undefined }), JSON.stringify(w.m.instanceGroup()), JSON.stringify(w.m.cpuProbeState()),
    JSON.stringify(w.m.runtimeObservations()), JSON.stringify(w.m.profilesSet({ profiles: "x", by: "admin" }))];
  for (const t of texts) for (const place of places) assert.equal(t.includes(place), false, `${place} in ${t.slice(0, 80)}`);
  /* the one way a place reaches an answer is a profile an administrator chose: its own name, from its own data */
  w.m.profilesSet({ profiles: [REAL[0].id], by: "admin" });
  assert.equal(w.m.profiles().profiles[0].name, REAL[0].name);
});
