/* screens-entry R35, R36 (T53; JOURNEYS R-3, R-45; DEC-472 (5)): a signed-in reader is not shown the sign-in form, on
   `front` and at the tour's end; `forgot`'s fields keep the public column, no wider than the sign-in panel's at 1280 px.
   The plane behind every screen is the real store (store-request's `storeWorld()` through the kit's `team`); R36 is
   measured in Chromium on the page `interface-shell` serves, with the served stylesheets. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { open, has, lacks, all, actOps, links, team, viaDoor, SCREENS } from "./kit.mjs";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { boot } from "../interface-shell/harness.mjs";

/* a member of the team, signed in by the real `memberadd` and `enroll`, and the session the shell holds for her */
async function signedIn() {
  const { world } = await team();
  const mai = await world.signIn("mai");
  const me = (await viaDoor(world, "whoami", {}, mai.token)).json.result;
  return { world, mai, me, session: { state: "live", handle: me.handle } };
}

// ---- R35: a signed-in reader ----

test("R35 front with a live member session: no sign-in panel and no 'Not a member yet?', 'You're signed in as <name>.' and a link to Home", async () => {
  const { world, mai, session } = await signedIn();
  const o = await open("front", { world, as: mai, session });
  assert.deepEqual(actOps(o.tree), [], "no sign-in act is drawn");
  for (const id of ["fs-handle", "fs-pw", "fs-device"]) assert.equal(all(o.tree, (e) => e.attrs.id === id || (e.attrs.id || "").startsWith(id + "-")).length, 0, id);
  lacks(o, "screen.front.notmember");
  lacks(o, "screen.front.members");
  has(o, "screen.front.signedin", { name: "mai" });
  has(o, "screen.front.home");
  const home = all(o.tree, (e) => e.tag === "a" && e.attrs.href === "/app");
  assert.equal(home.length, 1, "one way to Home");
  // the group's page is still drawn
  has(o, "screen.front.doorbell");
  assert.ok(o.text.includes("River Town Tenants"));
});

test("R35 control: signed out, front is as R1 draws it: the sign-in panel, 'Not a member yet?', and no signed-in line", async () => {
  const { world } = await team();
  for (const state of ["none", "signedout", "ended"]) {
    const o = await open("front", { world, session: { state, handle: state === "none" ? null : "mai" } });
    assert.deepEqual(actOps(o.tree), ["login"], state);
    has(o, "screen.front.notmember");
    lacks(o, "screen.front.home");
    assert.ok(!links(o.tree).includes("/app"), state + ": no link to Home");
  }
});

test("R35 the tour's 'Stop here' and 'Back to our page' land on Home for a live session (DEC-472 (5)); control: signed out they land on front", async () => {
  const live = { state: "live", handle: "mai" };
  for (const n of [1, 3, 6]) {
    const key = n === 6 ? "screen.tour.end" : "screen.tour.stop";
    const signed = await open("tour", { subject: String(n), session: live });
    const out = await open("tour", { subject: String(n), session: { state: "none" } });
    const stop = (o) => all(o.tree, (e) => e.tag === "a" && e.attrs["data-tone"] === "quiet").map((e) => e.attrs.href);
    has(signed, key);
    assert.deepEqual(stop(signed), ["/app"], "step " + n + " signed in");
    assert.deepEqual(stop(out), ["/app/front"], "step " + n + " signed out");
    assert.deepEqual(signed.requests, [], "still no op sent (R3)");
  }
});

/* On the served page the shell draws a public screen loaded fresh without reading the session record (interface-shell
   R30), so a live session reaches `front` once the page holds it: here the record is read on `setup` (the setup frame
   reads it, interface-shell R45) and the member then moves within the page to `/app/front` and to the tour's end. */
test("R35 on the served page: a member holding a session who moves to /app/front sees the team's page and the way to Home, no sign-in form; the tour's end leads Home", async () => {
  const { world, mai } = await signedIn();
  const { door, session } = world.boot(mai);
  const p = await boot({ screens: SCREENS, door, session, path: "/app/setup" });
  await p.settle(120);
  assert.ok(p.requests.some((r) => r.op === "whoami"), "the page holds the session");
  await p.back("/app/front");
  await p.settle(120);
  const m = p.doc.getElementById("cs-main");
  assert.ok(m && m.querySelector(".mk-frontgrid"), "front is drawn");
  assert.equal(m.querySelectorAll("#fs-pw").length, 0, "no password field");
  assert.equal(m.querySelectorAll('[data-act="login"]').length, 0, "no sign-in act");
  assert.equal(m.querySelectorAll('a[href="/app"]').length, 1, "the way to Home");
  await p.back("/app/tour/6");
  await p.settle(80);
  const end = [...p.doc.getElementById("cs-main").querySelectorAll('a[data-tone="quiet"]')].map((a) => a.getAttribute("href"));
  assert.deepEqual(end, ["/app"], "the tour's end leads Home");
});

/* control: a page with no session record draws front as R1 does (and, loaded fresh, asks no record: interface-shell R30) */
test("R35 control on the served page: no session record, /app/front draws the sign-in form", async () => {
  const { world } = await team();
  const { door } = world.boot(null);
  const p = await boot({ screens: SCREENS, door, session: null, path: "/app/front" });
  await p.settle(120);
  const m = p.doc.getElementById("cs-main");
  assert.equal(m.querySelectorAll("#fs-pw").length, 1);
  assert.equal(m.querySelectorAll('a[href="/app"]').length, 0);
});

// ---- R36: forgot keeps the public column, measured in Chromium ----

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  for (const home of ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"])) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

/* the widths of the inputs `selector` finds on `path`, drawn at `width` px with no session, the plane the real store */
async function fieldWidths(world, width, pages) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/): this test cannot measure without it");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage(SCREENS), script = interfaceScript(SCREENS), api = world.route(null);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const out = {};
    for (const [path, selector] of pages) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.route("**/*", async (r) => {
        const u = new URL(r.request().url());
        if (u.pathname.startsWith("/app/assets/")) {
          const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
          if (!f) return r.fulfill({ status: 404, body: "" });
          return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
        }
        if (u.pathname === "/api/" || u.pathname === "/api") return api(r);
        if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
        if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
        return r.fulfill({ status: 200, contentType: "text/html", body: html });
      });
      await page.goto("https://group.example" + path);
      await page.waitForSelector(selector, { timeout: 15000 });
      await page.waitForTimeout(200);
      out[path] = await page.$$eval(selector, (els) => els.map((e) => e.getBoundingClientRect().width));
      await ctx.close();
    }
    return out;
  } finally { await browser.close(); }
}

const PAGES = [["/app/front", "#cs-main #fs-handle, #cs-main #fs-pw"],
  ["/app/forgot", "#cs-main #fg-handle, #cs-main #fg-code, #cs-main #fg-pw, #cs-main #fg-pw2"]];

test("R36 at 1280 px forgot's fields are no wider than the sign-in panel's fields on front", async () => {
  const { world } = await team();
  const m = await fieldWidths(world, 1280, PAGES);
  const signin = m["/app/front"], fields = m["/app/forgot"];
  assert.equal(signin.length, 2, "front's handle and password measured");
  assert.equal(fields.length, 4, "forgot's four fields measured");
  const bound = Math.max(...signin);
  assert.ok(bound > 0 && bound < 640, "the sign-in column is a column, not the page: " + bound);
  for (const w of fields) assert.ok(w <= bound + 0.5, `a forgot field ${w}px is wider than the sign-in field ${bound}px`);
});

test("R36 control: at 390 px both fill the screen's width", async () => {
  const { world } = await team();
  const m = await fieldWidths(world, 390, PAGES);
  for (const w of [...m["/app/front"], ...m["/app/forgot"]]) assert.ok(w >= 390 * 0.75 && w <= 390, `a field ${w}px at 390`);
  const widths = new Set([...m["/app/front"], ...m["/app/forgot"]].map((w) => Math.round(w)));
  assert.equal(widths.size, 1, "the same column on both: " + [...widths]);
});
