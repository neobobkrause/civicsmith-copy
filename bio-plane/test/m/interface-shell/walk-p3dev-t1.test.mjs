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

/* the class attributes of a source that draw a hook class with no design partner a served stylesheet defines beside it */
const unpartnered = (src, defined) => classAttrs(src).filter((ws) => ws.some((c) => Object.hasOwn(HOOK_CLASSES, c)))
  .filter((ws) => !ws.some((c) => !Object.hasOwn(HOOK_CLASSES, c) && defined.has(c))).map((ws) => ws.join(" "));

test("F2 R56 every hook class the shell draws sits beside a design partner a served stylesheet defines: the walk's cs-crumbs, cs-rows, cs-r and cs-panel and the newer-version band among them", () => {
  const defined = DESIGN();
  const src = shellProgram.toString();
  const drawn = new Set(classAttrs(src).flat());
  for (const c of ["cs-crumbs", "cs-rows", "cs-r", "cs-panel", "mk-lvlbtn", "mk-updband"]) assert.ok(drawn.has(c), c + " is drawn by the shell");
  assert.deepEqual(unpartnered(src, defined), []);
});

test("F2 control: the same check reports a hook class drawn alone, or beside only a class no served stylesheet defines, and passes one beside its partner", () => {
  const defined = DESIGN();
  const src = `'<nav class="cs-crumbs">' + '<table class="cs-rows mk-nonesuch">' + '<tr class="cs-r mk-r">' + '<p class="plain">'`;
  assert.deepEqual(unpartnered(src, defined), ["cs-crumbs", "cs-rows mk-nonesuch"]);
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

/* opens every visible explanation in turn as the walk does (scrolled to the centre, focused, hovered) and answers each one that does not open,
   is not below or above what it explains (spanning part of it: never beside it), covers what it explains or another control, or runs outside the
   page. The rail's width grip (`data-shell="grip"`), a thin separator the height of the rail, is no control an explanation must spare (F3). */
async function coverings(page) {
  const out = [];
  const n = await page.evaluate(() => [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length);
  assert.ok(n >= 8, "the fixture opens explanations over the masthead, the rail and the screen (" + n + ")");
  for (let i = 0; i < n; i++) {
    const name = await page.evaluate((i) => {
      const el = [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })[i];
      el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return el.tagName + ":" + (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 16);
    }, i);
    await page.waitForTimeout(650);
    const hit = await page.evaluate(() => {
      const tip = document.getElementById("cs-tip");
      if (!tip || tip.hidden) return null;
      const t = tip.getBoundingClientRect();
      const ex = document.querySelector("[aria-describedby='cs-tip']");
      if (!ex) return null;
      const e = ex.getBoundingClientRect();
      const over = [];
      const hits = (r) => Math.min(t.right, r.right) - Math.max(t.left, r.left) > 2 && Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top) > 2;
      if (hits(e)) over.push("itself");
      for (const c of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
        if (c === ex || ex.contains(c) || c.contains(ex) || tip.contains(c) || c.getAttribute("data-shell") === "grip") continue;
        const r = c.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && hits(r)) over.push(c.tagName + ":" + (c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 16));
      }
      const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
      /* R103's first choice: below at its own left edge (kept inside the page), or above where below runs out of it */
      const x0 = Math.min(Math.max(8, W - t.width - 8), Math.max(8, e.left));
      const first = Math.abs(t.left - x0) <= 1 && (Math.abs(t.top - (e.bottom + 6)) <= 1 || Math.abs(t.bottom - (e.top - 6)) <= 1);
      return { over, outside: t.left < -1 || t.top < -1 || t.right > W + 1 || t.bottom > H + 1, first, main: !!ex.closest("#cs-main"),
        place: t.top >= e.bottom - 1 ? "below" : t.bottom <= e.top + 1 ? "above" : "level", spans: t.left < e.right && t.right > e.left };
    });
    await page.keyboard.press("Escape");
    if (!hit) { out.push(name + " opens no explanation"); continue; }
    const bad = [];
    if (hit.place === "level" || !hit.spans) bad.push("is beside it (" + hit.place + (hit.spans ? "" : ", clear of its width") + ")");
    /* F3: never over what it explains. F4 (unmet): where no place below or above spans it and covers nothing (the rail's places stand closer
       than an explanation is tall), R103's first choice stands though it covers the next control; in the screen's own column there is room,
       and nothing is covered */
    if (hit.over.includes("itself")) bad.push("covers what it explains");
    if (hit.over.length && (!hit.first || hit.main)) bad.push("covers " + hit.over.join(", ") + (hit.first ? "" : ", away from R103's first place"));
    if (hit.outside) bad.push("runs outside the page");
    if (bad.length) out.push(name + ": " + bad.join("; "));
  }
  return out;
}

for (const width of [1280, 390]) {
  test(`F3 R103 R145 at ${width} px every explanation opens below or above what it explains, spanning it, inside the page; in the screen's column it covers no control, and elsewhere it covers one only at R103's first place`, { timeout: 120000 }, async () => {
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

test("F3 R103 an explanation at the page's right edge stays clear of the page's scroll bar: it is placed inside the page's client width with its margin, not by the window's width", { timeout: 120000 }, async () => {
  const got = await inChromium([SCREEN], { width: 1280, path: "/app/home", scrollbars: true }, async (page) => {
    await page.evaluate(() => { document.documentElement.style.overflowY = "scroll"; });
    await page.evaluate(() => { const el = document.querySelector("button.mk-avatar"); el.focus(); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    await page.waitForTimeout(650);
    return page.evaluate(() => ({ right: document.getElementById("cs-tip").getBoundingClientRect().right, client: document.documentElement.clientWidth, inner: innerWidth }));
  });
  assert.ok(got.inner - got.client >= 8, "the page shows a scroll bar (" + (got.inner - got.client) + " px)");
  /* placed by the window's width it is squeezed against the scroll bar (it ends at the client width, its 8 px margin gone) */
  assert.ok(got.right <= got.client - 7, `the explanation ends at ${got.right}, 8 px inside the client width ${got.client}`);
});
