/* interface-shell, attempt 4: the walk of p3dev-t1 at 0.87.0 (4 Nov 2026; coordinator 22:10). Its three found marks, F1-F3. */
import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { stylesheetClasses, interfacePage, HOOK_CLASSES } from "../../../src/interface-shell/index.mjs";
import { shellProgram } from "../../../src/interface-shell/browser.mjs";
import { boot, ok, refused, silent, httpError } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";
import { inChromium } from "./chromium.mjs";

/* ---------- F1: the frame's aipathready refused (UNKNOWN_OP on p3dev-t1, surface-declarations R15 unmet) ---------- */

/* the frame drawn whole: the masthead with the group's name and the member, the rail, the screen's main column; and no assistant control */
function frameWhole(p, path) {
  const root = p.root();
  assert.ok(root.querySelector(".cs-mast"), path + ": the masthead");
  assert.ok(root.querySelector('.cs-mast [data-shell="menu"], .cs-mast button.mk-avatar'), path + ": the member's control");
  assert.ok(root.querySelector("#cs-main"), path + ": the main column");
  assert.equal(root.querySelector('[data-shell="dock"]'), null, path + ": no assistant control (R20)");
  assert.equal(root.querySelector(".cs-dock"), null, path + ": no dock");
}

test("F1 R20 with aipathready refused UNKNOWN_OP, as p3dev-t1 answers it, the frame asks it, takes the assistant as not reachable and draws every screen whole with no assistant control; control: answered ready, the button is drawn", async () => {
  for (const path of ["/app", "/app/document/c1", "/app/queue", "/app/members"]) {
    const p = await boot({ screens: ALL, path, plane: { assistantstate: ok({ on: true }), aipathready: refused("UNKNOWN_OP") } });
    assert.ok(p.byOp("aipathready").length >= 1, path + ": the frame asks it (R20)");
    frameWhole(p, path);
    const c = await boot({ screens: ALL, path, plane: { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
    assert.ok(c.root().querySelector('.cs-mast [data-shell="dock"]'), path + ": control: a ready path draws the button");
  }
});

test("F1 R20 any refusal of aipathready, a refusal with words, a server error and no answer each leave the assistant not reachable and the frame whole", async () => {
  for (const answer of [refused("UNKNOWN_OP"), refused("NOT_YOUR_ACCOUNT", "Not yours."), httpError(500), silent]) {
    const p = await boot({ screens: ALL, path: "/app/queue", plane: { assistantstate: ok({ on: true }), aipathready: answer } });
    frameWhole(p, "/app/queue");
  }
});

/* ---------- F2: every hook class the shell draws sits beside its design partner, and every page loads the sheet that defines it ---------- */

/* each class attribute of the shell's own program, as its list of words (a literal cut by the program's own quoting keeps its closed words) */
const classAttrs = (src) => [...String(src).matchAll(/\bclass=\\?["']([^"'`$\\<>{}]*)/g)].map((m) => m[1].split(/\s+/).filter(Boolean));
const DESIGN = () => stylesheetClasses(ASSET_FILES["civicsmith.css"].body, ASSET_FILES["shell.css"].body);

test("F2 R56 every hook class the shell draws sits beside a design partner a served stylesheet defines: the walk's cs-crumbs, cs-rows, cs-r and cs-panel and the newer-version band among them", () => {
  const defined = DESIGN();
  const withHooks = classAttrs(shellProgram.toString()).filter((ws) => ws.some((c) => Object.hasOwn(HOOK_CLASSES, c)));
  const drawn = new Set(withHooks.flat());
  for (const c of ["cs-crumbs", "cs-rows", "cs-r", "cs-panel", "mk-lvlbtn", "mk-updband"]) assert.ok(drawn.has(c), c + " is drawn by the shell");
  for (const ws of withHooks) assert.ok(ws.some((c) => !Object.hasOwn(HOOK_CLASSES, c) && defined.has(c)), "a design partner beside " + ws.join(" "));
  /* control: a hook class drawn alone has no partner */
  assert.equal(["cs-crumbs"].some((c) => !Object.hasOwn(HOOK_CLASSES, c) && defined.has(c)), false);
});

test("F2 R56 every page the shell serves loads civicsmith.css and then shell.css, the sheets that define the hook classes' partners", () => {
  for (const screens of [[], ALL]) {
    const links = [...interfacePage(screens).matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(links, ["/app/assets/civicsmith.css", "/app/assets/shell.css"]);
  }
});

/* ---------- F3: an explanation covers no control and stays inside the page ---------- */

/* a working screen with a section, a reference, a link and a button: what the walk opened explanations over. The frame brings the rail
   (the sections list), the masthead's avatar at the page's right edge and, at 390 px, the tabs. */
const SCREEN = {
  id: "home", words: [], reads: () => ({}), acts: [],
  render: (cs) => '<h1 class="t-title">Home</h1>' + cs.sec("screen.home.name", "<p>" + cs.ref("project", "P1", "Project one", []) + ' <a href="/app/queue">a link</a> <button type="button">Go</button></p>', { help: "screen.home.purpose" }),
};

/* opens every visible explanation in turn as the walk does (scrolled to the centre, focused, hovered) and answers each one that covers
   another control, or what it explains, or runs outside the page */
async function coverings(page) {
  const out = [];
  const n = await page.evaluate(() => [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length);
  assert.ok(n >= 8, "the fixture opens explanations over the masthead, the rail and the screen (" + n + ")");
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => {
      const el = [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })[i];
      el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    }, i);
    await page.waitForTimeout(650);
    const hit = await page.evaluate(() => {
      const tip = document.getElementById("cs-tip");
      if (!tip || tip.hidden) return null;
      const t = tip.getBoundingClientRect();
      const ex = document.querySelector("[aria-describedby='cs-tip']");
      const over = [];
      const hits = (r) => Math.min(t.right, r.right) - Math.max(t.left, r.left) > 2 && Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top) > 2;
      if (ex && hits(ex.getBoundingClientRect())) over.push("itself");
      for (const c of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
        if (c === ex || (ex && (ex.contains(c) || c.contains(ex))) || tip.contains(c)) continue;
        const r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && hits(r)) over.push(c.tagName + ":" + (c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 16));
      }
      const outside = t.left < -1 || t.top < -1 || t.right > innerWidth + 1 || t.bottom > innerHeight + 1;
      return { ex: ex ? ex.tagName + ":" + (ex.getAttribute("aria-label") || ex.textContent || "").trim().slice(0, 16) : "?", over, outside, below: ex ? t.top >= ex.getBoundingClientRect().bottom : null };
    });
    await page.keyboard.press("Escape");
    if (hit && (hit.over.length || hit.outside)) out.push(hit.ex + (hit.over.length ? " covers " + hit.over.join(", ") : "") + (hit.outside ? " runs outside the page" : ""));
  }
  return out;
}

for (const width of [1280, 390]) {
  test(`F3 R103 R145 at ${width} px every explanation covers neither what it explains nor another control (the rail's places, the masthead, the tabs) and stays inside the page`, { timeout: 120000 }, async () => {
    const found = await inChromium([SCREEN], { width, path: "/app/home" }, coverings);
    assert.deepEqual(found, []);
  });
}

test("F3 R103 control: with room below, an explanation still opens below what it explains, at its left edge", { timeout: 120000 }, async () => {
  const ROOMY = { ...SCREEN, render: (cs) => '<h1 class="t-title">Home</h1>' + cs.sec("screen.home.name", "<p>Words, and no control beneath them.</p>", { help: "screen.home.purpose" }) };
  const where = await inChromium([ROOMY], { width: 1280, path: "/app/home" }, async (page) => {
    await page.evaluate(() => { const el = document.querySelector("#cs-main h2[data-tip]"); el.focus(); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    await page.waitForTimeout(650);
    return page.evaluate(() => { const t = document.getElementById("cs-tip").getBoundingClientRect(), e = document.querySelector("#cs-main h2[data-tip]").getBoundingClientRect(); return { below: t.top >= e.bottom, left: Math.round(t.left - e.left) }; });
  });
  assert.equal(where.below, true);
  assert.equal(where.left, 0);
});
