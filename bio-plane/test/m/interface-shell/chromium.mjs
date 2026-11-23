/* interface-shell's tests in a real browser (R84, R89, R108, R120): the page the shell serves, with the served stylesheets and script, is
   drawn in Chromium at a given width over stand-in screens, the plane scripted. Needs `playwright-core` (found beside the product: `site/node_modules`,
   the journey check's, or the tools directory) and Chromium: the first installed of the places `exeOf` names (Google Chrome on GitHub's machines), or the build that `playwright-core` names,
   fetched once by its own installer where no browser is installed (GitHub's machines have none). Without them a test fails, saying so. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return { pw: createRequire(home + "noop.js")("playwright-core"), cli: home + "playwright-core/cli.js" }; } catch { /* the next */ }
  }
  return null;
}
/* the browser: the first installed of CHROMIUM, /opt/pw-browsers/chromium, CHROME_BIN, /usr/bin/google-chrome, /usr/bin/chromium and
   /usr/bin/chromium-browser; else the build `playwright-core` names, fetched by its own installer when absent (once: a second call finds it);
   null when none can be had */
function exeOf(found) {
  /* the first installed of these: GitHub's machines carry Google Chrome (as store-request #2 found on the required run) */
  const at = [process.env.CHROMIUM, "/opt/pw-browsers/chromium", process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
    .find((p) => typeof p === "string" && p !== "" && existsSync(p));
  if (at) return at;
  const named = () => { try { const p = found.pw.chromium.executablePath(); return p && existsSync(p) ? p : null; } catch { return null; } };
  if (named()) return named();
  try { execFileSync(process.execPath, [found.cli, "install", "chromium"], { stdio: "ignore", timeout: 5 * 60 * 1000 }); } catch { /* none to be had */ }
  return named();
}
/** The engine and the browser the real-browser tests draw in, each asserted present, saying what is missing.
 *  @returns {{pw: *, exe: string}} */
export function chromium() {
  const found = engine();
  assert.ok(found && found.pw && found.pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  const exe = exeOf(found);
  assert.ok(exe && existsSync(exe), "Chromium is needed: at CHROMIUM, /opt/pw-browsers/chromium, CHROME_BIN, /usr/bin/google-chrome, /usr/bin/chromium or /usr/bin/chromium-browser, or fetched by playwright-core's installer");
  return { pw: found.pw, exe };
}

/* a member's session as `whoami` answers it, and the frame's own reads answered with it (the scripted plane answers every op alike) */
export const PLANE = { session: true, member: "mai", handle: "mai", tokenClass: "admin", administer: true, capabilities: ["contribute", "create_projects", "publish"], items: [], projects: [], display_name: "A team", members: [] };

/** Draws `screens` at `path` in Chromium at `width` px; `answer(op, url)` may answer an op with a result (default `PLANE`), and
 *  `seen` collects each request's op. Calls `fn(page, seen)` once `ready` (a selector) is drawn, closes the browser, answers fn's result. */
export async function inChromium(screens, { width = 390, path = "/app/question/Q1", ready = "#cs-main", answer = null, record = null, plane = PLANE } = {}, fn) {
  const { pw, exe: EXE } = chromium();
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
