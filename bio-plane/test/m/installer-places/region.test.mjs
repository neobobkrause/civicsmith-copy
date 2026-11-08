/* installer-places R96: the install shows the region the team's record will use and offers two honest choices, near me (a hint,
 * the founder's own by default, another from a list) and keep my data in this region (a jurisdiction); the choice is said to be
 * made once before it is asked, and sets STORE_LOCATION or STORE_JURISDICTION, never both. Driven through the installer's routes
 * against its fixture's fake account; `cf` is set on the Request as workerd sets it (as installer's own R83 suite does). The lists
 * are `installer-steps`' (its R46), read from it; every sentence is read from the word table by key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../../../newgroup/src/index.mjs";
import { run, req, bindingOf, pageWorld, cookieOf, cookieValue, ORIGIN, passedCheck } from "../../../../newgroup/test/fixture.mjs";
import { WIZARD_HTML } from "../../../../newgroup/src/ui.mjs";
import { LOCATION_HINTS, JURISDICTIONS, locationHintFor } from "../../../../newgroup/src/steps/index.mjs";
import { word } from "../../../../newgroup/src/words.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WEST = { continent: "NA", country: "US", longitude: "-122.4" };
const DEFAULT = locationHintFor(WEST);
const OTHER = LOCATION_HINTS.find((h) => h !== DEFAULT && h === locationHintFor({ continent: "EU", longitude: "8.68" }));

/* A request through the edge: `cf` set on it as workerd sets it (absent when undefined). */
async function at(cf, path, init) {
  const request = new Request(ORIGIN + path, init);
  if (cf !== undefined) Object.defineProperty(request, "cf", { value: cf, enumerable: true });
  return worker.fetch(request);
}
async function beginAt(cf, slug, extra = {}, mode = "install") {
  const r = await at(cf, "/begin", { method: "POST", headers: mode === "install" ? { cookie: passedCheck(slug) } : {}, body: JSON.stringify({ slug, mode, ...extra }) });
  const j = await r.json();
  return { r, j, cookie: cookieOf(r), state: j.ok ? new URL(j.authorize).searchParams.get("state") : null };
}
async function installAt(cf, slug, extra = {}) {
  const b = await beginAt(cf, slug, extra);
  assert.equal(b.j.ok, true, JSON.stringify(b.j));
  const w = await run({ slug, cookie: b.cookie, state: b.state });
  assert.equal(w.page.failed, null, "the install completes");
  return w;
}
const placeOf = (w) => w.planePuts.map((p) => [bindingOf(p, "STORE_LOCATION")?.text ?? null, bindingOf(p, "STORE_JURISDICTION")?.text ?? null])[0];
const bucketPosts = (w) => w.calls.filter((c) => c.method === "POST" && c.u.endsWith("/r2/buckets"));
const jurisdictionHeader = (c) => new Headers(c.init.headers || {}).get("cf-r2-jurisdiction");

test("R96 the install page shows the region the founder's request is near, preselected in the list of other places, and states before the choice that it cannot be changed", async () => {
  assert.ok(DEFAULT && OTHER, "two regions to tell apart");
  const home = await (await at(WEST, "/")).text();
  const region = home.slice(home.indexOf('id="region"'), home.indexOf("</section>", home.indexOf('id="region"')));
  assert.ok(region.includes(esc(word("screen.install.region.near", { region: word(`screen.install.region.${DEFAULT}`) }))), "the region shown");
  assert.match(region, new RegExp(`<option value="${DEFAULT}" selected>`));
  const final = region.indexOf(esc(word("screen.install.region.final")));
  assert.ok(final >= 0 && final < region.indexOf('name="region"'), "said before the choice");
  for (const k of ["screen.install.region.near.what", "screen.install.region.keep", "screen.install.region.keep.what"])
    assert.ok(region.includes(esc(word(k))), k);
  /* The two choices: near me, with the places a hint may name; keep my data in this region, with the jurisdictions. */
  assert.deepEqual([...region.matchAll(/<input type="radio" id="[^"]+" name="region" value="(\w+)"/g)].map((m) => m[1]), ["near", "keep"]);
  const keep = region.slice(region.indexOf('id="region-keep"'));
  assert.deepEqual([...keep.matchAll(/<option value="(\w+)">/g)].map((m) => m[1]), [...JURISDICTIONS]);
});

test("R96 an install carries its default hint; a picked region overrides it; a jurisdiction sets STORE_JURISDICTION and no hint, and its buckets are made in it", async () => {
  assert.deepEqual(placeOf(await installAt(WEST, "region-default")), [DEFAULT, null], "the default hint");
  assert.deepEqual(placeOf(await installAt(WEST, "region-picked", { region: { hint: OTHER } })), [OTHER, null], "the picked one");
  for (const j of JURISDICTIONS) {
    const w = await installAt(WEST, `region-${j}`, { region: { jurisdiction: j } });
    assert.deepEqual(placeOf(w), [null, j], `${j}: the jurisdiction and no hint`);
    for (const p of w.planePuts) assert.equal(bindingOf(p, "STORE_LOCATION"), null, `${j}: no hint in any upload`);
    assert.deepEqual(bucketPosts(w).map(jurisdictionHeader), [j, j], `${j}: both buckets made in it`);
  }
  /* Control: a hint makes its buckets as before, with no jurisdiction. */
  assert.deepEqual(bucketPosts(await installAt(WEST, "region-hint-buckets", { region: { hint: OTHER } })).map(jurisdictionHeader), [null, null]);
});

test("R96 a missing cf installs as today, with no hint, and a region picked there is still set", async () => {
  const home = await (await at(undefined, "/")).text();
  assert.ok(!home.includes('id="region-default"'), "no region shown when the request says none");
  assert.ok(!/<option value="\w+" selected>/.test(home), "and none preselected");
  assert.deepEqual(placeOf(await installAt(undefined, "region-nocf")), [null, null]);
  assert.deepEqual(placeOf(await installAt(undefined, "region-nocf-picked", { region: { hint: OTHER } })), [OTHER, null]);
});

test("R96 /begin refuses a region not offered, a hint and a jurisdiction together, and any region on an update, by name and before any sign-in; a check carries the choice on to its install", async () => {
  for (const region of [{ hint: "atlantis" }, { jurisdiction: "mars" }, { hint: OTHER, jurisdiction: "eu" }, "eu", ["eu"], {}]) {
    const b = await beginAt(WEST, "region-bad", { region });
    assert.deepEqual([b.r.status, b.j.ok, b.j.error], [400, false, word("installer.begin.region")], JSON.stringify(region));
    assert.equal(b.r.headers.get("set-cookie"), null);
  }
  const u = await beginAt(WEST, "region-upd", { region: { jurisdiction: "eu" }, version: "9.9.9" }, "update");
  assert.deepEqual([u.r.status, u.j.error], [400, word("installer.begin.region.update")]);
  /* The check's cookie keeps the founder's pick, so "Install now" begins the install with it (installer-check R90). */
  const c = await beginAt(WEST, "region-check", { region: { jurisdiction: "eu" } }, "check");
  assert.equal(c.j.ok, true);
  assert.deepEqual(cookieValue(c.cookie).rg, { jurisdiction: "eu" });
  const w = await run({ slug: "region-check", mode: "check", cookie: c.cookie, state: c.state });
  const now = w.page.done.match(/id="install-now"[^>]*data-begin="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  assert.deepEqual(JSON.parse(now).region, { jurisdiction: "eu" });
});

test("R96 the page's script sends near me with the place in the list, or the jurisdiction kept, and refuses keep with none chosen", async () => {
  const send = async (set) => {
    const w = pageWorld(WIZARD_HTML);
    set(w);
    w.el("slug").value = "river-keepers";
    await w.el("go").click(); await w.el("confirm-yes").click(); await w.el("cloudflare").click();
    return { body: w.sent.at(-1)?.body ?? null, err: w.el("err2").textContent };
  };
  assert.deepEqual((await send((w) => { w.el("region-mode-near").checked = true; w.el("region-near").value = OTHER; })).body.region, { hint: OTHER });
  assert.deepEqual((await send((w) => { w.el("region-mode-keep").checked = true; w.el("region-keep").value = "us"; })).body.region, { jurisdiction: "us" });
  assert.equal("region" in (await send((w) => { w.el("region-mode-near").checked = true; })).body, false, "near with no place sends none: the default");
  const none = await send((w) => { w.el("region-mode-keep").checked = true; });
  assert.deepEqual([none.body, none.err], [null, word("installer.region.keep.none")]);
});
