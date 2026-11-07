/* installer-places R94 (amends R21): the install asks where the team's work focuses, a set of places of any level, only the
 * federal layer preselected, and binds the chosen ids with the layers each sits within added, in order, as JURISDICTION_PROFILES.
 * The installer (newgroup) is driven through its own routes against the stateful fake account of its fixture
 * (`newgroup/test/fixture.mjs`, installer's world); the places are `jurisdictions`' own layers, read from it, never listed here,
 * and every sentence is read from the word table by key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { run, req, begin, bindingOf, pageWorld, cookieValue } from "../../../../newgroup/test/fixture.mjs";
import { WIZARD_HTML, PROFILE_CHOICES, PROFILES_NONE } from "../../../../newgroup/src/ui.mjs";
import { word } from "../../../../newgroup/src/words.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LAYERS = jurisdictions.layers().filter((l) => l.origin === "civicsmith");
const at = (level, n = 0) => LAYERS.filter((l) => l.level === level)[n];
const FEDERAL = at("federal"), STATE = at("state");
/* A county and a city within it, in the state above (the held layers' own `within`). */
const COUNTY = LAYERS.find((l) => l.level === "county" && l.within === STATE.id);
const CITY = LAYERS.find((l) => l.level === "city" && l.within === COUNTY.id);
const boxes = (html) => [...html.matchAll(/<input type="checkbox" id="(place-\d+)" name="profile" value="([^"]*)"([^>]*)>/g)].map((m) => ({ el: m[1], id: m[2], checked: /\bchecked\b/.test(m[3]) }));

/* An install begun with `profiles` as the page sends them, run to its end: the ids its plane uploads bind. */
async function bound(slug, profiles) {
  const b = await begin(slug, "install", { profiles });
  assert.equal(b.j.ok, true, JSON.stringify(b.j));
  const w = await run({ slug, cookie: b.cookie, state: b.state });
  assert.equal(w.page.failed, null, "the install completes");
  assert.ok(w.planePuts.length >= 1);
  const texts = w.planePuts.map((p) => bindingOf(p, "JURISDICTION_PROFILES")?.text ?? null);
  assert.equal(new Set(texts).size, 1, "every plane upload binds the same");
  return texts[0] === null ? [] : texts[0].split(",");
}

test("R94 choosing the state alone binds the federal and state layers, in that order, and no county or city", async () => {
  assert.ok(FEDERAL && STATE && COUNTY && CITY, "the held layers have every level");
  assert.deepEqual(await bound("places-state", [STATE.id]), [FEDERAL.id, STATE.id]);
});

test("R94 choosing a county and a city in it binds federal, the state, the county and the city, each after the layer it sits within", async () => {
  /* Sent in either order, and without the layers they sit within, the binding adds them and orders them. */
  assert.deepEqual(await bound("places-local", [CITY.id, COUNTY.id]), [FEDERAL.id, STATE.id, COUNTY.id, CITY.id]);
  assert.deepEqual(await bound("places-city", [CITY.id]), [FEDERAL.id, STATE.id, COUNTY.id, CITY.id]);
  /* The cookie carries what is bound, not what was sent. */
  const b = await begin("places-cookie", "install", { profiles: [CITY.id] });
  assert.deepEqual(cookieValue(b.cookie).p, [FEDERAL.id, STATE.id, COUNTY.id, CITY.id]);
});

test("R94 choosing nothing and removing the federal layer binds none, and the page says what that means; the federal layer alone binds it alone", async () => {
  assert.deepEqual(await bound("places-none", []), []);
  assert.deepEqual(await bound("places-federal", [FEDERAL.id]), [FEDERAL.id]);
  const home = await (await req("/")).text();
  assert.ok(home.includes(esc(word("installer.places.federal.what"))), "what removing the federal layer means");
  assert.ok(home.includes(esc(PROFILES_NONE)), "and the choice of none");
});

test("R94 the page asks where the work focuses, says Civicsmith ships United States places only, and that a team may add its counties' and cities' facts to its team layer", async () => {
  const home = await (await req("/")).text();
  const places = home.slice(home.indexOf('id="places"'), home.indexOf("</section>", home.indexOf('id="places"')));
  assert.ok(places.includes(`<h2>${esc(word("installer.places.focus"))}</h2>`));
  assert.ok(places.includes(esc(word("installer.places.usonly"))));
  assert.ok(places.includes(esc(word("installer.places.teamlayer"))));
});

test("R94 the places are one list grouped by state: every held layer offered once, each state's counties and cities after it; the page's script adds the layers a chosen place sits within and shows them added, and sends the set", async () => {
  const drawn = boxes(WIZARD_HTML);
  assert.deepEqual(drawn.map((b) => b.id).sort(), LAYERS.map((l) => l.id).sort(), "every held layer, once");
  const pos = (id) => drawn.findIndex((b) => b.id === id);
  assert.ok(pos(FEDERAL.id) < pos(STATE.id) && pos(STATE.id) < pos(COUNTY.id) && pos(COUNTY.id) < pos(CITY.id));
  assert.equal(WIZARD_HTML.split('class="profiles ng-state"').length - 1, LAYERS.filter((l) => l.level === "state").length, "one group per state");
  /* The script, run as a browser runs it: the founder checks the city; the county and the state are checked and marked added. */
  const w = pageWorld(WIZARD_HTML);
  const el = (id) => w.el(drawn.find((b) => b.id === id).el);
  el(FEDERAL.id).checked = true;
  const city = el(CITY.id);
  city.checked = true;
  for (const f of city.on.change) f({ target: city });
  assert.deepEqual([el(STATE.id).checked, el(COUNTY.id).checked], [true, true]);
  const added = (id) => w.el(`added-${pos(id)}`).textContent;
  assert.deepEqual([added(STATE.id), added(COUNTY.id), added(CITY.id), added(FEDERAL.id)], [word("installer.places.added"), word("installer.places.added"), "", ""]);
  /* Removing the state removes what sits within it. */
  const state = el(STATE.id);
  state.checked = false;
  for (const f of state.on.change) f({ target: state });
  assert.deepEqual([el(COUNTY.id).checked, el(CITY.id).checked, el(FEDERAL.id).checked], [false, false, true]);
  /* The set goes to /begin. */
  city.checked = true;
  for (const f of city.on.change) f({ target: city });
  w.el("slug").value = "river-keepers";
  await w.el("go").click(); await w.el("confirm-yes").click(); await w.el("cloudflare").click();
  assert.deepEqual(w.sent.at(-1).body.profiles.slice().sort(), [FEDERAL.id, STATE.id, COUNTY.id, CITY.id].sort());
});

test("R94 control: a fresh page has only the federal layer checked, and no test layer or test profile is offered or bound", async () => {
  const drawn = boxes(await (await req("/")).text());
  assert.deepEqual(drawn.filter((b) => b.checked).map((b) => b.id), [FEDERAL.id]);
  const tests = jurisdictions.list().filter((p) => p.test === true);
  assert.ok(tests.length > 0, "a test profile is held, so the filter is exercised");
  for (const t of tests) {
    assert.ok(!drawn.some((b) => b.id === t.id), `${t.id} not offered`);
    assert.ok(!PROFILE_CHOICES.some((p) => p.id === t.id));
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "places-test", mode: "install", profiles: [t.id] }) });
    assert.equal(r.status, 400, `${t.id} refused`);
  }
});

test("R21 (as R94 amends it) each place is offered by name and the place it covers; an update offers and binds no choice", async () => {
  const home = await (await req("/")).text();
  for (const l of LAYERS) {
    assert.ok(home.includes(`<span class="pname">${esc(l.name)}</span>`), l.id);
    assert.ok(home.includes(esc(word("installer.places.covers", { covers: l.place }))), l.id);
  }
  const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "places-upd", mode: "update", version: "9.9.9", profiles: [STATE.id] }) });
  assert.equal(r.status, 400, "an update never changes them");
});
