/* screens-intake R2, R4, R7, R47 (T51 fix round 3, C81; SCREENS-INTAKE #14): the capture, Held and Inbox screens at 390 px, measured in a
 * browser. The page the shell serves, with the served stylesheets, is drawn in Chromium over this module's real `SCREENS`, over the REAL store (fix round 10,
 * K5054): the browser's `/api/` is answered by the world's door (the real modules, from what real acts made: projects and held documents, an unfinished
 * large capture, a request a site turned away for a login, a stored login, two knocks at the inbox, an address held and since changed); every control's width
 * and height and every part's edge are measured. Needs `playwright-core` (found beside the product, as interface-shell's `phone390.test.mjs` finds it) and
 * Chromium (CHROMIUM, or /opt/pw-browsers/chromium); without them it fails, saying so. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { members, openWorld, fill, press as pressAct, DOCUMENT_STUB } from "./page.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

const LONG = "A-very-long-member-name-or-digest-that-has-no-break-at-all-0123456789abcdef0123456789abcdef0123456789abcdef";
const ADDRESS = "https://records.example-city.gov/agendas/2026-10-14-regular-meeting-of-the-board-of-supervisors.pdf";
const BIG = "https://www.govinfo.gov/content/pkg/BUDGET-2021-APP/pdf/BUDGET-2021-APP.pdf";
const LATER = "https://agendas.example.org/later.html";
const CHANGED = "https://www.example.gov/reports/street-maintenance-2026";
const LOGIN_PAGE = "<html><head><title>Sign in</title></head><body><form action=/login><input type=password name=p></form></body></html>";
const serve = (world, address, body, type = "text/html", status = 200, extra = {}) => world.script(address, async () => new Response(body, { status, headers: { "content-type": type, ...extra } }));
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

/* The world every screen is measured over, made by real acts. mai is the administrator who signs in; rosa has a long handle. */
async function scene() {
  const rosaHandle = "rosa-with-a-long-handle";
  const t = await members({ [rosaHandle]: ["contribute"] }, { env: { CAPTURE_CREDENTIALS_KEY: "phone390-a-key-no-call-ever-sends" } });
  const { world } = t;
  const rosa = t[rosaHandle];
  const mai = await world.signIn("mai", { admin: true });
  const p1 = await world.recipes.project(mai, "Pothole repairs");
  const p2 = await world.recipes.project(mai, "Housing repairs with a long name that wraps at the phone width");
  /* Held: a survey in the first project, a long-titled document in the second, a photo rosa uploaded */
  await world.recipes.hold(mai, "Street survey of the Seminary Avenue corridor, 2026", "The survey found cracks along the corridor.\n", p1);
  await world.recipes.hold(mai, LONG, "A long-titled document.\n", p2);
  await world.recipes.hold(rosa, "A photo", PNG, "", { type: "image/png" });
  /* a question the requests are for, and one the picker finds */
  const q = await world.recipes.question(mai, p1, { title: "Seven days", text: "Seven days", draw: true });
  /* an unfinished large capture: the owner parks a file declared over its wait (the alarm of a world delivers nothing), so Add lists it as Unfinished */
  serve(world, BIG, new Uint8Array(9 * 1024 * 1024 + 5).fill(7), "application/pdf", 200, { "content-length": String(9 * 1024 * 1024 + 5) });
  await mai.act("acquire", { body: { locator: BIG } });
  /* a request a site turned away for a login (the daemon's drain), then one still waiting */
  serve(world, ADDRESS, LOGIN_PAGE, "text/html", 401);
  await mai.act("capturerequest", { body: { address: ADDRESS, target: q.id } });
  await world.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: world.env.DAEMON_TOKEN });
  serve(world, LATER, "<html><body>Later.</body></html>");
  await mai.act("capturerequest", { body: { address: LATER, target: q.id } });
  /* a login rosa supplied for the site: the store's own route, stamped as the owner reads its `by` (a member's id; the door's stamp is the viewer's `member:` form, which the
     owner does not take for a member: reported, so the supply is made at the route) */
  const supplied = await world.send({ url: `http://x/capturecredentialsupply?by=${encodeURIComponent(rosa.member)}&viewer=${encodeURIComponent("member:" + rosa.member)}`,
    body: { kind: "login", host: "records.example-city.gov", scope: "group", secret: "a-secret-no-screen-shows" } });
  const given = (await supplied.json()).result;
  if (!given || given.ok !== true) throw new Error("the login was not stored: " + JSON.stringify(given).slice(0, 300));
  /* the inbox: a knock at the door (anyone may), and one set aside with a reason */
  const door = world.boot(null).door;
  const knock = (text, note) => door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentText: text, note }) } });
  const first = (await knock("Sheets of the agenda, October regular meeting.\n", "Sheets.")).json.knockId;
  const second = (await knock("A duplicate sheet.\n", "")).json.knockId;
  await mai.act("inboxresolve", { body: { knockId: second, status: "discarded", reason: "A duplicate." } });
  /* an address held, then served changed since */
  serve(world, CHANGED, "<html><head><title>Street maintenance</title></head><body><p>The plan, first version.</p></body></html>");
  const first_page = await openWorld("/app/capture/address", { world, as: mai, screens: [...SCREENS, DOCUMENT_STUB] });
  fill(first_page, { "ci-address": CHANGED });
  await pressAct(first_page, "acquire");
  world.script(CHANGED, async () => new Response("<html><head><title>Street maintenance</title></head><body><p>The plan, second version, changed.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
  /* the member's "Check it now" (the monitor tick on the document), which finds the site gives a different document than the copy held */
  const watched = first_page.byOp("promote")[0].body.bundleId;
  await mai.act("monitorset", { body: { bundleId: watched, enabled: true, frequency: "daily" } });
  await mai.act("monitor", { body: { bundleId: watched } });
  return { world, as: mai, p1, p2, knocks: { first, second } };
}

async function measure(path, width, interact = async () => {}, at = null) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage(SCREENS), script = interfaceScript(SCREENS);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((session) => localStorage.setItem("bio-session", session), JSON.stringify(at.as.session));
    const { door } = at.world.boot(at.as);
    const page = await ctx.newPage();
    await page.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith("/app/assets/")) {
        const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
      }
      if (u.pathname === "/api/" || u.pathname === "/api") {
        /* the real store answers: the world's door, as the Worker's is asked */
        const rq = r.request();
        const a = await door({ url: u.pathname + u.search, init: { method: rq.method(), headers: rq.headers(), body: rq.postDataBuffer() || undefined } });
        if (a.json !== undefined) return r.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.json) });
        return r.fulfill({ status: a.status, contentType: a.type || "application/octet-stream", body: Buffer.from(a.bytes || []) });
      }
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example" + path);
    await page.waitForSelector("#cs-main .mk-h", { timeout: 15000 });
    await page.waitForTimeout(400);
    await interact(page);
    await page.evaluate(() => document.querySelectorAll("#cs-main details").forEach((d) => { d.open = true; }));
    await page.waitForTimeout(200);
    return await page.evaluate((W) => {
      const seen = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const out = { mainScroll: document.getElementById("cs-main").scrollWidth, over: [], small: [], thumbs: [], controls: 0 };
      for (const e of document.querySelectorAll("#cs-main *")) {
        if (!seen(e) || e.closest(".tw")) continue;
        const r = e.getBoundingClientRect();
        if (r.right > W + 0.5 || r.left < -0.5) out.over.push(e.localName + "." + e.className + " " + Math.round(r.left) + "-" + Math.round(r.right) + " " + (e.textContent || "").slice(0, 24));
        if (e.matches("a, button, input, select, textarea, summary, [role=tab]")) {
          out.controls++;
          const t = e.matches("input[type=checkbox], input[type=radio]") && e.closest("label") ? e.closest("label").getBoundingClientRect() : r;
          if (t.height < 43.5 || t.width < 43.5) out.small.push(e.localName + "." + (e.className || "") + " " + Math.round(t.width) + "x" + Math.round(t.height) + " " + (e.textContent || "").slice(0, 24));
        }
      }
      for (const t of document.querySelectorAll("#cs-main .mk-thumb")) { const r = t.getBoundingClientRect(); out.thumbs.push({ w: Math.round(r.width), h: Math.round(r.height), text: t.textContent.trim().length }); }
      return out;
    }, width);
  } finally { await browser.close(); }
}


const press = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(400); };
/* each screen: its path (from what the world made), what a member does there, and the world's own state */
const SCREEN_PATHS = [
  ["Add (address tab) with a login-turned request, its logins pressed open", (w) => `/app/capture/address/${w.p1}`, press('button[data-act="capturecredentiallist"]')],
  ["Add (address tab) with an address already held and changed since", () => "/app/capture/address", async (page) => { await page.fill("#ci-address", CHANGED); await page.click('button[data-act="acquire"]'); await page.waitForTimeout(4000); }],
  ["Add (file tab)", (w) => `/app/capture/file/${w.p1}`, async () => {}],
  ["Add (what I saw tab)", () => "/app/capture/saw", async () => {}],
  ["Held", () => "/app/held", async () => {}],
  ["Held with a row picked (the hold strip)", (w) => `/app/held/${w.p1}`, async (page) => { await page.click("input.mk-pick"); await page.waitForTimeout(300); }],
  ["Inbox, a knock opened", (w) => `/app/inbox/${w.knocks.first}`, async () => {}],
  ["Inbox, a discarded knock opened (put it back)", (w) => `/app/inbox/${w.knocks.second}`, async () => {}],
];

for (const [name, pathOf, interact] of SCREEN_PATHS) {
  test(`R4 R7 R47 (C81) ${name}: at 390 px nothing runs past the screen and every control is at least 44 px to press; at 1280 px the layout is the desktop's`, { timeout: 300000 }, async () => {
    const at = await scene();
    const path = pathOf(at);
    const m = await measure(path, 390, interact, at);
    assert.ok(m.controls > 3, "the screen drew its controls: " + m.controls);
    assert.ok(m.mainScroll <= 390, "the main area is no wider than the screen: " + m.mainScroll);
    assert.deepEqual(m.over, [], "nothing past the edge");
    assert.deepEqual(m.small, [], "every target is at least 44 px");
    for (const t of m.thumbs) assert.ok(t.w >= 44 && t.h >= 44, "Open the file is a 44 px target: " + JSON.stringify(t));
    const d = await measure(path, 1280, interact, at);
    assert.ok(d.mainScroll <= 1280, "control: the desktop page is no wider than the screen");
    for (const t of d.thumbs) assert.ok(t.w >= 44 && t.h >= 44, "and its Open the file keeps its width there: " + JSON.stringify(t));
  });
}
