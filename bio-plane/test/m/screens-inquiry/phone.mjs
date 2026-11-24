/* screens-inquiry's phone measurements (C81, fix round 3): this module's real screens, served as interface-shell serves them, drawn in
 * Chromium at a stated width over the scripted plane of `fixtures.mjs`, and the boxes of the controls a test names measured. Needs
 * `playwright-core` (beside the product) and Chromium (CHROMIUM, or /opt/pw-browsers/chromium); without them the test fails saying so
 * (as interface-shell's phone390.test.mjs does). */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { FRAME, SESSION, STORE_KEY } from "../interface-shell/harness.mjs";
import { SCREENS, plane } from "./fixtures.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

/** The screen at `path` drawn `width` px wide over `plane(o)` (op to answer or function, as the fixtures); `controls` are the words (already
 *  read through `word`) of the buttons and links to measure. Answers `{ mainScroll, over, small, boxes }`: the main area's scroll width, the
 *  visible elements of the main area that run past the screen, the controls (links, buttons) smaller than 44 px either way, and for each of
 *  `controls` the box of each visible control whose text holds it (`{ left, right, width, height }`, rounded). `before(page)` may act first. */
export async function onPhone({ path, o = {}, width = 390, controls = [], before = null }) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const answers = { ...FRAME, ...plane(o) };
  const html = interfacePage(SCREENS), script = interfaceScript(SCREENS);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [STORE_KEY, JSON.stringify(SESSION)]);
    const page = await ctx.newPage();
    await page.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith("/app/assets/")) {
        const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
      }
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      if (u.pathname === "/api/" || u.pathname === "/api") {
        const op = u.searchParams.get("op");
        let a = answers[op];
        const raw = r.request().postData();
        let body; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
        if (typeof a === "function") a = await a({ op, query: Object.fromEntries(u.searchParams), body });
        if (a === undefined) a = { status: 200, json: { ok: true, result: null } };
        if (a.pending || a.silent) return r.abort();
        return r.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.json ?? "") });
      }
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example" + path);
    await page.waitForSelector("#cs-main section, #cs-main h1", { timeout: 15000 });
    await page.waitForTimeout(600);
    if (before) { await before(page); await page.waitForTimeout(300); }
    return await page.evaluate(([W, texts]) => {
      const seen = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const out = { mainScroll: document.getElementById("cs-main").scrollWidth, over: [], small: [], boxes: {} };
      for (const e of document.querySelectorAll("#cs-main *")) {
        if (!seen(e) || e.closest(".tw")) continue;
        const r = e.getBoundingClientRect();
        if (r.right > W + 0.5 || r.left < -0.5) out.over.push(e.localName + "." + e.className + " " + Math.round(r.left) + "-" + Math.round(r.right) + " " + (e.textContent || "").slice(0, 30));
        if (e.matches("a, button, summary")) {
          if (r.height < 43.5 || r.width < 43.5) out.small.push(e.localName + "." + (e.className || "") + " " + Math.round(r.width) + "x" + Math.round(r.height) + " " + (e.textContent || "").slice(0, 30));
        }
      }
      for (const t of texts) out.boxes[t] = Array.from(document.querySelectorAll("#cs-main a, #cs-main button")).filter((e) => seen(e) && (e.textContent || "").includes(t))
        .map((e) => { const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }; });
      return out;
    }, [width, controls]);
  } finally { await browser.close(); }
}
