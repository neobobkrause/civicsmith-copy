/* screens-publish's tests: a screen of this module drawn in Chromium at a given width, over the fixture plane, and its controls
 * measured (C81). The page is the one the shell serves (`interfacePage`, `interfaceScript`) with the served stylesheets; the plane
 * is `fixtures.mjs`'s, answering each op by the `op` query the page sends. Needs `playwright-core` (beside the product or in
 * /opt/node-tools) and Chromium (CHROMIUM, or /opt/pw-browsers/chromium); without them the test that measures fails, saying so. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { SCREENS, plane } from "./fixtures.mjs";
import { FRAME } from "../interface-shell/harness.mjs";
import { frameAnswers } from "../interface-shell/frame-answers.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

/** Draws `path` at `width` px over `answers` (op → fixture answer) and returns what `inspect(page)` measures; `waitFor` is a selector. */
export async function measure(path, width, { answers = {}, waitFor = "#cs-main h1, #cs-main h2", session = true, inspect, drive } = {}) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage(SCREENS), script = interfaceScript(SCREENS);
  const all = { ...FRAME, ...(await frameAnswers()), ...plane(answers) };
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    if (session) await ctx.addInitScript(() => localStorage.setItem("bio-session", JSON.stringify({ t: "tok", e: 0, d: "own", w: "mai" })));
    const page = await ctx.newPage();
    await page.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith("/app/assets/")) {
        const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
      }
      const op = u.searchParams.get("op");
      if (u.pathname === "/api/" || u.pathname === "/api" || op) {
        let a = all[op];
        if (typeof a === "function") a = await a({ op, query: Object.fromEntries(u.searchParams), body: (() => { try { return JSON.parse(r.request().postData() || "null"); } catch { return null; } })() });
        if (a === undefined) a = { status: 200, json: { ok: true, result: null } };
        if (a.bytes !== undefined) return r.fulfill({ status: a.status, contentType: a.type || "application/octet-stream", body: Buffer.from(a.bytes) });
        return r.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.json ?? "") });
      }
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example" + path);
    await page.waitForSelector(waitFor, { timeout: 15000 });
    await page.waitForTimeout(600);
    if (drive) { await drive(page); await page.waitForTimeout(400); }
    return await page.evaluate(inspect, width);
  } finally { await browser.close(); }
}

/** Run in the page: what runs past the viewport or is a target under 44 px, among the visible controls and boxes of the main area. */
export function cut(W) {
  const seen = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const out = { mainScroll: document.getElementById("cs-main").scrollWidth, over: [], small: [] };
  for (const e of document.querySelectorAll("#cs-main *")) {
    if (!seen(e) || e.closest(".tw")) continue;
    const r = e.getBoundingClientRect();
    if (r.right > W + 0.5 || r.left < -0.5) out.over.push(e.localName + "." + (e.className || "") + " " + Math.round(r.left) + "-" + Math.round(r.right) + " " + (e.textContent || "").trim().slice(0, 24));
    if (e.matches("a, button, input, select, textarea, summary, [role=tab]")) {
      const t = e.matches("input[type=checkbox], input[type=radio]") && e.closest("label") ? e.closest("label").getBoundingClientRect() : r;
      if (t.height < 43.5 || t.width < 43.5) out.small.push(e.localName + "." + (e.className || "") + " " + Math.round(t.width) + "x" + Math.round(t.height) + " " + (e.textContent || "").trim().slice(0, 24));
    }
  }
  return out;
}
