/* interface-shell's tests in a real browser (R84, R89, R108, R120): the page the shell serves, with the served stylesheets and script, is
   drawn in Chromium at a given width over stand-in screens, the plane scripted. Needs `playwright-core` (found beside the product: `site/node_modules`,
   the journey check's, or the tools directory) and Chromium (CHROMIUM, or /opt/pw-browsers/chromium); without them a test fails, saying so. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

/* a member's session as `whoami` answers it, and the frame's own reads answered with it (the scripted plane answers every op alike) */
export const PLANE = { session: true, member: "mai", handle: "mai", tokenClass: "admin", administer: true, capabilities: ["contribute", "create_projects", "publish"], items: [], projects: [], display_name: "A team", members: [] };

/** Draws `screens` at `path` in Chromium at `width` px; `answer(op, url)` may answer an op with a result (default `PLANE`), and
 *  `seen` collects each request's op. Calls `fn(page, seen)` once `ready` (a selector) is drawn, closes the browser, answers fn's result. */
export async function inChromium(screens, { width = 390, path = "/app/question/Q1", ready = "#cs-main", answer = null, record = null, plane = PLANE } = {}, fn) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage(screens), script = interfaceScript(screens);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("bio-session", JSON.stringify({ t: "tok", e: 0, d: "own", w: "mai" })));
    const page = await ctx.newPage();
    await page.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith("/app/assets/")) {
        const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
      }
      if (u.pathname === "/api/" || u.pathname === "/api") {
        const op = u.searchParams.get("op");
        if (record) record.push({ op, query: Object.fromEntries(u.searchParams) });
        const own = answer ? answer(op, u) : undefined;
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: own === undefined ? plane : own }) });
      }
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example" + path);
    await page.waitForSelector(ready, { timeout: 15000 });
    await page.waitForTimeout(300);
    return await fn(page);
  } finally { await browser.close(); }
}
