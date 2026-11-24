/* screens-settings' tests' helper for what only a browser can measure (fix round 3, C81): the real `SCREENS` page the shell serves,
   with the served stylesheets, drawn in Chromium at a given width over a scripted plane, and a function run in the page to measure it.
   Needs `playwright-core` (found beside the product, or in the tools directory) and Chromium (CHROMIUM, or /opt/pw-browsers/chromium);
   without them a test using it fails, saying so (as interface-shell's phone390.test.mjs does). */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { SCREENS } from "../../../src/screens-settings/index.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

/** Draws `path` at `width` px over the world's `door` (a function of the request `{op, query, body}` → `{status, json}`), for the member whose `session` the page holds, waits for `ready`
 *  (a selector in the main area), and answers what `measure` (run in the page, given `width`) returns. */
export async function measure({ path, width, door, session, ready, measure: fn, screens = SCREENS }) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage(screens), script = interfaceScript(screens);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((rec) => localStorage.setItem("bio-session", JSON.stringify(rec)), session || { t: "tok", e: 0, d: "own", w: "mai" });
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
        const a = await door({ op, query: Object.fromEntries(u.searchParams), body: r.request().postData() ? JSON.parse(r.request().postData()) : undefined });
        if (a.pending) return new Promise(() => {});
        return r.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.json ?? "") });
      }
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example" + path);
    await page.waitForSelector(ready, { timeout: 15000 });
    await page.waitForTimeout(400);
    return await page.evaluate(fn, width);
  } finally { await browser.close(); }
}

/** Run in the page: every control (and ticked box's label) in the main area and masthead that is under 44 px, and every element
 *  whose box passes the screen's edge, outside a scroller `.tw`. */
export const FIT = (W) => {
  const seen = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const out = { mainScroll: document.getElementById("cs-main").scrollWidth, over: [], small: [] };
  for (const e of document.querySelectorAll("#cs-main *, .cs-mast *, .cs-tabs *")) {
    if (!seen(e) || e.closest(".tw")) continue;
    const r = e.getBoundingClientRect();
    if (r.right > W + 0.5 || r.left < -0.5) out.over.push(e.localName + "." + e.className + " " + Math.round(r.left) + "-" + Math.round(r.right) + " " + (e.textContent || "").trim().slice(0, 24));
    if (e.matches("a, button, input, select, textarea, summary, [role=tab]")) {
      const t = e.matches("input[type=checkbox], input[type=radio]") && e.closest("label") ? e.closest("label").getBoundingClientRect() : r;
      if (t.height < 43.5 || t.width < 43.5) out.small.push(e.localName + "." + (e.className || "") + " " + Math.round(t.width) + "x" + Math.round(t.height) + " " + (e.textContent || "").trim().slice(0, 24));
    }
  }
  return out;
};
