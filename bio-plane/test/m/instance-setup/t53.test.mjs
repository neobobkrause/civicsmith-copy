/* T53 (N1257; DEC-404; K5452, K5458; N824): the layers a team chooses (R107), what profiles() tells of each (R108), a place
   named at its level and its arrival (R109), an update that changes no choice (R111), arrivals as layers (R113), and the
   mail domain and the switch (R114), at the module's interface over the real `jurisdictions`. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, providers } from "./fixture.mjs";
import { INSTANCE_SETUP_CHECKS, MAIL_SETUP_SETTING } from "../../../src/setup.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { layers as heldLayers, list as realList, get as realGet, combine as realCombine } from "../../../../jurisdictions/index.mjs";
import { LOCAL_FACTS_CHECKS } from "../../../src/local-facts/index.mjs";
import { MAIL_CHECKS } from "../../../src/mail-door/checks.mjs";

const FED = "us-federal", CA = "us-california", ALA = "us-ca-alameda-county", OAK = "us-ca-oakland";
const setting = (w) => w.record.getSetting("jurisdiction_profiles");
const settingRows = (w) => w.st.db.prepare(`SELECT COUNT(*) AS n FROM settings WHERE name = 'jurisdiction_profiles'`).get().n;

test("R107 layersSet records the layers chosen in level order, each after the one it sits within; nothing below the federal layer is added; a layer below federal without it is LAYER_NO_FEDERAL, a county or city without its parent LAYER_PARENT_MISSING, each writing nothing", async () => {
  assert.deepEqual(heldLayers().map((l) => l.id), [FED, CA, ALA, OAK], "the provider holds the four layers");
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  const four = w.m.layersSet({ layers: [OAK, FED, ALA, CA], by: "admin" });
  assert.equal(four.ok, true, JSON.stringify(four));
  assert.deepEqual(setting(w), [FED, CA, ALA, OAK]);
  assert.deepEqual(four.layers_set, [FED, CA, ALA, OAK]);
  /* California alone: federal and California, no county or city */
  assert.equal(w.m.layersSet({ layers: [CA, FED], by: "admin" }).ok, true);
  assert.deepEqual(setting(w), [FED, CA]);
  const n = settingRows(w);
  const noFed = w.m.layersSet({ layers: [CA], by: "admin" });
  assert.deepEqual([noFed.code, noFed.check, noFed.translation], ["LAYER_NO_FEDERAL", "C-119.13", INSTANCE_SETUP_CHECKS.LAYER_NO_FEDERAL.translation]);
  assert.deepEqual(noFed.missing, [FED]);
  const orphan = w.m.layersSet({ layers: [FED, ALA], by: "admin" });
  assert.deepEqual([orphan.code, orphan.check, orphan.layers, orphan.missing], ["LAYER_PARENT_MISSING", "C-119.14", [ALA], [CA]]);
  assert.equal(w.m.layersSet({ layers: [FED, CA, OAK], by: "admin" }).code, "LAYER_PARENT_MISSING");
  assert.equal(settingRows(w), n, "a refusal writes nothing");
  assert.deepEqual(setting(w), [FED, CA]);
});

test("R107 control: no place leaves the federal layer only, removing it leaves no layer (valid); a test profile is PROFILE_IS_TEST and the team layer LAYER_NOT_SHIPPED (local-facts' row) in layersSet and profilesSet; a package or an unknown id is no layer; only an administrator chooses", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  assert.equal(w.m.layersSet({ layers: [FED], by: "admin" }).ok, true);
  assert.deepEqual(setting(w), [FED]);
  const none = w.m.layersSet({ layers: [], by: "admin" });
  assert.equal(none.ok, true);
  assert.deepEqual([setting(w), none.layers, none.detail], [[], [], word("instance-setup.profiles.detail.none_active")]);
  const testId = realList().find((p) => p.test === true).id;
  assert.equal(w.m.layersSet({ layers: [testId], by: "admin" }).code, "PROFILE_IS_TEST");
  for (const act of [(x) => w.m.layersSet({ layers: x, by: "admin" }), (x) => w.m.profilesSet({ profiles: x, by: "admin" })]) {
    const team = act([FED, "team"]);
    assert.deepEqual([team.code, team.check, team.translation], ["LAYER_NOT_SHIPPED", LOCAL_FACTS_CHECKS.LAYER_NOT_SHIPPED.check, LOCAL_FACTS_CHECKS.LAYER_NOT_SHIPPED.translation]);
  }
  for (const id of ["oakland-alameda", "nowhere"]) assert.equal(w.m.layersSet({ layers: [id], by: "admin" }).code, "UNKNOWN_PROFILE", id);
  assert.equal(w.m.layersSet({ layers: "us-federal", by: "admin" }).code, "NOT_A_LIST");
  assert.equal(w.m.layersSet({ layers: [FED], by: "ruth" }).code, "PROFILES_NOT_ADMIN");
  /* profilesSet accepts the ids of held layers */
  assert.equal(w.m.profilesSet({ profiles: [FED, CA], by: "admin" }).ok, true);
  assert.deepEqual(setting(w), [FED, CA]);
  /* the op, as the door runs it */
  const { instanceSetupOps } = await import("../../../src/setup.mjs");
  const r = instanceSetupOps(w.m, new URL("http://do/layersset?by=admin"), { layers: [FED, CA, ALA], by: "ruth" }).layersset();
  assert.equal(r.ok, true);
  assert.deepEqual(setting(w), [FED, CA, ALA]);
});

test("R108 profiles() tells each layer of the chain: level, place, origin, coverage and the number of facts it gives, with the layer it sits within, in level order; view.layers as combine gives them; control: an empty chain answers no active profile", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  w.m.layersSet({ layers: [FED, CA, ALA, OAK], by: "admin" });
  const p = w.m.profiles();
  const held = heldLayers();
  assert.deepEqual(p.layers.map((l) => [l.id, l.level, l.place, l.origin, l.within, l.coverage.as_of]),
    held.map((l) => [l.id, l.level, l.place, l.origin, l.within, l.coverage.as_of]));
  for (const l of p.layers) assert.ok(Number.isInteger(l.facts) && l.facts > 0, l.id);
  assert.deepEqual(p.view.layers, realCombine([FED, CA, ALA, OAK]).view.layers);
  assert.ok(Array.isArray(p.stage_findings));
  const empty = (await boot()).m.profiles();
  assert.deepEqual([empty.layers, empty.detail], [[], word("instance-setup.profiles.detail.none_active")]);
});

test("R111 an update changes no choice: a copy with oakland-alameda recorded answers profiles() with the four layers, and its setting is the same string, never rewritten at a later start", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town", JURISDICTION_PROFILES: "oakland-alameda" } });
  assert.deepEqual(setting(w), ["oakland-alameda"]);
  const rows = settingRows(w);
  const again = await boot({ st: w.st, prov: w.prov });
  assert.deepEqual(again.m.profiles().layers.map((l) => l.id), [FED, CA, ALA, OAK]);
  assert.deepEqual(again.m.profiles().profiles.map((x) => x.id), ["oakland-alameda"]);
  assert.deepEqual([setting(again), settingRows(again)], [["oakland-alameda"], rows]);
});

/* One copy whose held set is the provider's, or before an update the provider without the layers named (a narrower held
   set of the provider's own answers), and a later start as an installed update restarts it. */
async function placesWorld({ hide = [], layered = true } = {}) {
  let hidden = hide, withLayers = layered;
  const jurisdictions = {
    list: () => realList().filter((p) => !hidden.includes(p.id)),
    get: (id) => (hidden.includes(id) ? null : realGet(id)),
    combine: (ids) => realCombine(ids),
  };
  Object.defineProperty(jurisdictions, "layers", { enumerable: true, get: () => (withLayers ? () => heldLayers().filter((l) => !hidden.includes(l.id)) : undefined) });
  let t = Date.parse("2026-11-06T08:00:00Z");
  const prov = providers({ admins: ["admin"] });
  const more = { jurisdictions, queueProducers: { registerPlaceArrivals: () => ({ ok: true }) } };
  const w = await boot({ prov, now: () => t, more });
  const restart = async () => { t += 60_000; return boot({ st: w.st, prov, now: () => t, more }); };
  return { ...w, restart, update: ({ hide: h = [], layered: l = true } = {}) => { hidden = h; withLayers = l; } };
}

test("R109 a place is named as a set of names, each a state, a county or a city; a layer arriving in an update whose place or covers matches a name is told once as an arrival, saying the team's own entries stay; control: a layer already active is not an arrival", async () => {
  const w = await placesWorld({ hide: [ALA, "oakland-alameda"] });
  const set = w.m.placeWantedSet({ name: ["Alameda County", "Marin County"], by: "admin" });
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.deepEqual([set.name, set.names], ["Alameda County", ["Alameda County", "Marin County"]]);
  assert.deepEqual(w.m.placeWanted({ viewer: "admin" }).names, ["Alameda County", "Marin County"]);
  w.update();
  const after = await w.restart();
  const open = after.m.placeArrivals({ viewer: "admin" }).arrivals;
  assert.deepEqual(open.map((a) => [a.name, a.layer, a.profile]), [["Alameda County", ALA, ALA]], "one arrival, the layer, not its package");
  assert.equal(open[0].note, localize("instance-setup.places.arrival_entries_kept", "Your team's own entries about this place stay in your team's layer and keep working, beside the shipped layer's."));
  assert.equal((await w.restart()).started.places.arrived, 0, "told once");
  assert.equal(after.m.placeArrivals({ viewer: "admin" }).arrivals.length, 1);
  /* made active with layersSet, it leaves */
  assert.equal(after.m.layersSet({ layers: [FED, CA, ALA], by: "admin" }).ok, true);
  assert.deepEqual(after.m.placeArrivals({ viewer: "admin" }).arrivals, []);
  /* control: a layer already active when it arrives is not an arrival */
  const c = await placesWorld({ hide: ["oakland-alameda"] });
  c.m.layersSet({ layers: [FED, CA, ALA], by: "admin" });
  c.m.placeWantedSet({ name: "Alameda County", by: "admin" });
  c.update();
  await c.restart();
  assert.deepEqual(c.m.placeArrivals({ viewer: "admin" }).arrivals, []);
  /* a list with a malformed name is refused whole, writing nothing */
  assert.equal(w.m.placeWantedSet({ name: ["Oakland", "a\nb"], by: "admin" }).code, "PLACE_NAME_MALFORMED");
  assert.deepEqual(w.m.placeWanted({ viewer: "admin" }).names, ["Alameda County", "Marin County"]);
});

test("R113 a copy active on oakland-alameda, updated to the layered release, answers placeArrivals with []: the last-compared set and the active ids are read as layers (control: a layer arriving that matches the named place and is in no active package is one arrival, answered with its layer)", async () => {
  /* before: the provider before the split, a package held as a profile of its own and no layers */
  const w = await placesWorld({ layered: false });
  w.record.setSetting("jurisdiction_profiles", ["oakland-alameda"], "bootstrap");
  w.m.placeWantedSet({ name: ["Oakland", "Alameda County"], by: "admin" });
  assert.deepEqual(JSON.parse(w.st.db.prepare(`SELECT profiles FROM place_seen`).get().profiles), realList().filter((p) => !p.test).map((p) => p.id));
  w.update();
  const after = await w.restart();
  assert.deepEqual(after.m.placeArrivals({ viewer: "admin" }).arrivals, []);
  assert.deepEqual(setting(after), ["oakland-alameda"], "the setting gains nothing");
  /* control: the same names, no package active and the county not held before: the county layer is one arrival */
  const c = await placesWorld({ hide: [ALA, OAK, "oakland-alameda"] });
  c.m.placeWantedSet({ name: ["Alameda County"], by: "admin" });
  c.update();
  await c.restart();
  assert.deepEqual(c.m.placeArrivals({ viewer: "admin" }).arrivals.map((a) => a.layer), [ALA]);
});

test("R114 the mail domain and the switch are an administrator's acts (GROUP_IDENTITY_NOT_ADMIN otherwise), the domain validated as R7 validates one (MAIL_DOMAIN_MALFORMED), each a dated act kept in the history with who and when; the state is by key and the steps are named by key, asking for no token or account id; control: with no domain the switch cannot be turned on (MAIL_NOT_SET_UP)", async () => {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const w = await boot({ now: () => t, prov: providers({ admins: ["admin", "member:ada"] }) });
  const off = w.m.mailDoorSet({ on: true, by: "admin" });
  assert.deepEqual([off.code, off.check, off.translation], ["MAIL_NOT_SET_UP", MAIL_CHECKS.MAIL_NOT_SET_UP.check, MAIL_CHECKS.MAIL_NOT_SET_UP.translation]);
  assert.equal(w.record.getSetting(MAIL_SETUP_SETTING), null, "nothing written");
  for (const by of ["ruth", "", null, "class:probe"]) {
    assert.equal(w.m.mailDomainSet({ domain: "mail.example.org", by }).code, "GROUP_IDENTITY_NOT_ADMIN", String(by));
    assert.equal(w.m.mailDoorSet({ on: false, by }).code, "GROUP_IDENTITY_NOT_ADMIN", String(by));
  }
  assert.equal(w.m.mailSetup({ viewer: "ruth" }).ok, false);
  for (const bad of ["https://mail.example.org", "mail.example.org/x", "mail.example.org:25", "10.0.0.1", "a@mail.example.org", ""])
    assert.deepEqual([w.m.mailDomainSet({ domain: bad, by: "admin" }).code, w.m.mailDomainSet({ domain: bad, by: "admin" }).check], ["MAIL_DOMAIN_MALFORMED", "C-64.34"], bad);
  assert.equal(w.m.mailDoorSet({ on: "yes", by: "admin" }).code, "MAIL_SWITCH_MALFORMED");
  const d = w.m.mailDomainSet({ domain: "Mail.Example.org.", by: "admin" });
  assert.deepEqual([d.ok, d.domain, d.on, d.state], [true, "mail.example.org", false, "off"]);
  t += 60_000;
  const on = w.m.mailDoorSet({ on: true, by: "member:ada" });
  assert.deepEqual([on.state, on.state_key, on.state_words], ["not_yet_receiving", "instance-setup.mail.state.not_yet_receiving",
    localize("instance-setup.mail.state.not_yet_receiving", "Not yet receiving: no test message has arrived since the domain was set.")]);
  assert.deepEqual(w.m.mailSettings(), { mail_domain: "mail.example.org", mail_door: true });
  assert.deepEqual(on.history, [
    { field: "mail_domain", value: "mail.example.org", set_at: "2026-11-07T10:00:00.000Z", set_by: "admin" },
    { field: "mail_door", value: true, set_at: "2026-11-07T10:01:00.000Z", set_by: "member:ada" }]);
  assert.deepEqual(on.steps.map((s) => s.key), ["instance-setup.mail.step.add_domain", "instance-setup.mail.step.routing_rule", "instance-setup.mail.step.test_message"]);
  assert.equal(on.intro_key, "instance-setup.mail.intro");
  assert.equal(/token|account id/i.test(JSON.stringify(on.steps)), false, "no step asks for a token or an account id");
  /* clearing the domain turns the door off for the mail door, whatever the switch says */
  const cleared = w.m.mailDomainSet({ domain: null, by: "admin" });
  assert.deepEqual([cleared.state, w.m.mailSettings()], ["not_set_up", { mail_domain: null, mail_door: false }]);
  assert.equal(w.m.mailSetup({ viewer: "admin" }).history.length, 3);
});

test("R114 through the real mail door: \"receiving\" only after a test message the door accepted (mail-door R2) since the domain was set, never on the setting alone; the door reads its domain and switch from mailSettings()", async () => {
  const { fresh, addressFor, plain } = await import("../mail-door/fixture.mjs");
  const { MailDoor } = await import("../../../src/mail-door/index.mjs");
  const { InstanceSetup } = await import("../../../src/setup.mjs");
  const f = fresh({ on: false, domain: null });
  const prov = providers({ admins: ["admin"] });
  const m = new InstanceSetup({ storage: f.s }, {}, { record: f.core, membership: prov.membership, credentials: prov.credentials,
    aiAccounts: prov.aiAccounts, promotion: prov.promotion, scheduler: prov.scheduler, capture: prov.capture, governor: prov.governor,
    publicRead: null, fetch: prov.fetch, sleep: async () => {} });
  await m.start({ firstBoot: false });
  /* the composition hands the door this module's reader (mail-door R12): the door over the same store, its tables made */
  const d = new MailDoor(f.s, { capture: f.c, record: f.core, settings: () => m.mailSettings() });
  assert.equal(d.doorState().on, false, "no domain: the door is off");
  m.mailDomainSet({ domain: "mail.example.org", by: "admin" });
  m.mailDoorSet({ on: true, by: "admin" });
  assert.deepEqual(d.doorState(), { domain: "mail.example.org", on: true });
  assert.equal(m.mailSetup({ viewer: "admin" }).state, "not_yet_receiving");
  const to = await addressFor(d, "ada");
  const got = await d.receiveMail({ raw: plain("a test message"), envelope_to: to });
  assert.equal(got.ok, true, JSON.stringify(got));
  const s = m.mailSetup({ viewer: "admin" });
  assert.equal(s.state, "receiving");
  assert.equal(typeof s.receiving_since, "string");
  /* control: setting the domain again waits for a new test message */
  await new Promise((r) => setTimeout(r, 5));
  m.mailDomainSet({ domain: "post.example.org", by: "admin" });
  assert.equal(m.mailSetup({ viewer: "admin" }).state, "not_yet_receiving");
});
