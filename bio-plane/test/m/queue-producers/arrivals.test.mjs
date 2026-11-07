/* R38 (DEC-150 (3); N665; instance-setup R62): the one Status item to the administrators when an installed update brings a
   held profile for the place the group named, read through the one read instance-setup registers at start
   (`registerPlaceArrivals`, K31's pattern) and answered by feedItems. R39 (DEC-158 (4); K1818; wizard-scripts R26): a
   copied wizard's editors told once when its base has a newer approved version. Both providers are fakes in the shapes
   their requirements publish. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const arrival = (over = {}) => ({ name: "Riverton", profile: "us-xx-riverton", profile_name: "City of Riverton",
  covers: ["Riverton", "Riverton County"], found_at: iso(NOW - 7200000), ...over });

function admins(extra = {}) {
  const w = world(extra);
  w.member("ada", { role: "admin" }); w.member("abe", { role: "admin" }); w.member("bob");
  w.member("old", { role: "admin", status: "left" });
  return w;
}
const placeItems = (r) => r.items.filter((i) => i.kind === "place-profile-arrived");

test("R38: registerPlaceArrivals takes the read once at start; a second call is refused PLACE_ARRIVALS_REGISTERED, a read that is none PLACE_ARRIVALS_MALFORMED; with none registered no item is raised", () => {
  const w = admins();
  assert.deepEqual(placeItems(w.read("ada")), [], "none registered: no item");
  assert.equal(w.p.registerPlaceArrivals(null).reason, "PLACE_ARRIVALS_MALFORMED");
  assert.equal(w.p.registerPlaceArrivals({ arrivals: [] }).reason, "PLACE_ARRIVALS_MALFORMED");
  const asked = [];
  assert.deepEqual(w.p.registerPlaceArrivals((a) => { asked.push(a); return { ok: true, arrivals: [arrival()] }; }), { ok: true });
  const again = w.p.registerPlaceArrivals(() => ({ ok: true, arrivals: [arrival({ profile: "other" })] }));
  assert.deepEqual([again.ok, again.reason], [false, "PLACE_ARRIVALS_REGISTERED"]);
  assert.deepEqual(placeItems(w.read("ada")).map((i) => i.id), ["CONDITION::place-profile-arrived::us-xx-riverton"],
    "the first registration stands; the refused one changed nothing");
  assert.deepEqual(asked[0], { viewer: null }, "read as the plane (instance-setup R62)");
  /* an object offering placeArrivals is the same door */
  const w2 = admins();
  assert.deepEqual(w2.p.registerPlaceArrivals({ placeArrivals: () => [arrival()] }), { ok: true });
  assert.equal(placeItems(w2.read("ada")).length, 1, "a bare list is read as the arrivals");
});

test("R38: one CONDITION place-profile-arrived per arrival, keyed CONDITION::place-profile-arrived::<profile>, to every administrator and nobody else, with no project home, naming the place and the profile's name and coverage, offering to choose it under Places", () => {
  const w = admins();
  let list = [arrival(), arrival({ profile: "us-xx-riverton" })];
  w.p.registerPlaceArrivals(() => ({ ok: true, arrivals: list }));
  const it = byId(w.read("ada"))["CONDITION::place-profile-arrived::us-xx-riverton"];
  assert.equal(placeItems(w.read("ada")).length, 1, "raised once per arrival");
  assert.deepEqual([it.class, it.kind], ["CONDITION", "place-profile-arrived"]);
  assert.equal(it.summary, word("queue.place-profile-arrived.summary", { place: "Riverton", profile: "City of Riverton" }));
  assert.equal(it.detail, `${word("queue.place-profile-arrived.detail", { place: "Riverton", profile: "City of Riverton" })} ${word("queue.place-profile-arrived.detail.covers", { covers: "Riverton, Riverton County" })}`);
  assert.match(it.detail, /\bstatus\b/, "a status in member text (R24)");
  assert.deepEqual(it.subject, { kind: "place_profile", id: "us-xx-riverton", name: "City of Riverton",
                                 covers: ["Riverton", "Riverton County"], place: "Riverton" });
  assert.deepEqual(it.case.ancestors, [], "no project home"); assert.equal(it.case.ungrouped, true);
  assert.deepEqual(it.options.map((o) => o.id), ["profilesset"], "choosing it under Places (instance-setup R14)");
  assert.deepEqual(it.recipients.sort(), ["abe", "ada"], "every active administrator");
  assert.deepEqual(it.age, { state: "determined", since: iso(NOW - 7200000), ms: 7200000 });
  assert.equal(placeItems(w.read("abe")).length, 1);
  assert.deepEqual(placeItems(w.read("bob")), [], "a member who is no administrator");
  assert.deepEqual(placeItems(w.read(null, "class:admin")), [], "a caller with no member");
  /* it leaves when the arrival leaves (the profile made active, the name cleared or changed) */
  list = [];
  assert.deepEqual(placeItems(w.read("ada")), []);
});

/* R39: a fake in wizard-scripts R26's shape (B2; K1861 (1)) for the cases the real read cannot make cheaply (a hidden
   project, paging); `wizard.test.mjs` drives R39 through the real `baseUpdates`. */
const update = (over = {}) => ({ copy: "WIZ-C", copy_version: "WIZ-C@1", name: "File it our way", project: "PRJ-1",
  base: "WIZ-B", base_name: "File a records request", based_on: "WIZ-B@1", base_version: "WIZ-B@2", found_at: iso(NOW - 600000),
  recipients: ["ed", "eve"], steps: { copy: [{ screen: "s", act: "a" }], base: [{ screen: "s", act: "a" }, { screen: "s", act: "b" }] },
  ...over });

test("R39: one FINDING wizard-base-updated per entry and recipient baseUpdates answers, keyed FINDING::wizard-base-updated::<copy>::<base version>::<member>, to that recipient and nobody else, offering to see what changed and to bring it across", () => {
  const w = world({ wizardScripts: { baseUpdates: () => ({ ok: true, cursor: null, truncated: false,
    entries: [update(), update({ recipients: ["ed", "token:admin"] })] }) } });
  for (const m of ["ed", "eve", "bob"]) w.member(m);
  w.bundle("PRJ-1", "project"); for (const m of ["ed", "eve", "bob"]) w.join("PRJ-1", m);
  const mine = (who) => w.read(who).items.filter((i) => i.kind === "wizard-base-updated");
  const it = mine("ed");
  assert.deepEqual(it.map((i) => i.id), ["FINDING::wizard-base-updated::WIZ-C::WIZ-B@2::ed"], "raised once");
  const x = it[0];
  assert.deepEqual([x.class, x.kind, x.recipients], ["FINDING", "wizard-base-updated", ["ed"]]);
  assert.deepEqual([x.subject.kind, x.subject.id, x.subject.base_version], ["wizard", "WIZ-C", "WIZ-B@2"], "its subject the copy");
  assert.equal(x.summary, word("queue.wizard-base-updated.summary", { base: "File a records request", version: "WIZ-B@2", name: "File it our way" }));
  assert.equal(x.detail, word("queue.wizard-base-updated.detail.versioned", { name: "File it our way", base: "File a records request", version: "WIZ-B@2", based_on: "WIZ-B@1" }));
  assert.deepEqual([x.summary_key, x.detail_key], ["queue.wizard-base-updated.summary", "queue.wizard-base-updated.detail.versioned"]);
  assert.deepEqual(x.options.map((o) => o.id), ["wizardread", "wizardrevise"]);
  assert.deepEqual(x.case.ancestors.map((a) => [a.id, a.depth]), [["PRJ-1", 0]]);
  assert.deepEqual(x.age, { state: "determined", since: iso(NOW - 600000), ms: 600000 });
  assert.deepEqual(x.basis.steps, update().steps, "both step lists ride on the basis, for seeing what changed");
  assert.deepEqual(mine("eve").map((i) => i.id), ["FINDING::wizard-base-updated::WIZ-C::WIZ-B@2::eve"]);
  assert.deepEqual(mine("bob"), [], "a member R26 does not name");
  assert.deepEqual(w.read(null, "class:admin").items.filter((i) => i.kind === "wizard-base-updated"), [], "nor a caller with no member");
});

test("R39, R11: a copy in a project the viewer may not see yields no item; the read is followed by its cursor", () => {
  const w = world({ wizardScripts: { baseUpdates: ({ after }) => (after === null
    ? { ok: true, cursor: "p2", truncated: true, entries: [update({ project: "PRJ-H", copy: "WIZ-H" })] }
    : { ok: true, cursor: null, truncated: false, entries: [update({ project: null, copy: "WIZ-G" })] }) } });
  w.member("ed"); w.bundle("PRJ-H", "project");
  const r = w.read("ed");
  assert.deepEqual(r.items.filter((i) => i.kind === "wizard-base-updated").map((i) => i.id),
    ["FINDING::wizard-base-updated::WIZ-G::WIZ-B@2::ed"], "the group copy on the second page; the hidden project's copy withheld");
  assert.ok(!JSON.stringify(r).includes("PRJ-H"));
  assert.equal(byId(r)["FINDING::wizard-base-updated::WIZ-G::WIZ-B@2::ed"].case.ungrouped, true, "a group copy has no project home");
});
