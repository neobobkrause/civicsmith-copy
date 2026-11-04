/* interface-shell, attempt 4: the walk of p3dev-t1 at 0.87.0 (4 Nov 2026; coordinator 22:10). Its three found marks, F1-F3. */
import test from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { classLiterals, stylesheetClasses, interfacePage, HOOK_CLASSES } from "../../../src/interface-shell/index.mjs";
import { shellProgram } from "../../../src/interface-shell/browser.mjs";
import { boot, ok } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";
import { inChromium } from "./chromium.mjs";

const UNDECLARED = "aipathready";

/* ---------- F1: no op `OPS` does not declare leaves the page ---------- */

test("F1 the op the frame asks for the assistant's path is one OPS does not declare today (this file's premise; when op-declarations declares it, F1's frame arm is moot and R20's ready arm is met)", () => {
  assert.equal(Object.hasOwn(OPS, UNDECLARED), false);
});

test("F1 R20 the frame sends no op OPS does not declare: aipathready is not asked on any screen, the assistant stays unreachable (no assistant control), and every request names a declared op", async () => {
  for (const path of ["/app", "/app/document/c1", "/app/queue", "/app/members"]) {
    /* the plane would answer ready: the page must not ask it */
    const p = await boot({ screens: ALL, path, plane: { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
    assert.equal(p.byOp(UNDECLARED).length, 0, path + ": aipathready is not sent");
    for (const r of p.requests) assert.ok(Object.hasOwn(OPS, r.op), path + ": " + r.op + " is declared");
    assert.equal(p.root().querySelector('[data-shell="dock"]'), null, path + ": no assistant control while the path read cannot be asked (R20)");
    assert.equal(p.root().querySelector(".cs-dock"), null);
    /* control: the declared frame reads still go */
    assert.ok(p.byOp("whoami").length >= 1 && p.byOp("assistantstate").length >= 1, path + ": declared reads are sent");
  }
});

test("F1 a screen's read or call of an op OPS does not declare sends nothing and is drawn as the door's refusal; control: its declared read is sent", async () => {
  const SCREEN = {
    id: "home", words: [], acts: [],
    reads: () => ({ odd: { op: "nonesuchop" }, fine: { op: "queue" } }),
    render: (cs, view) => '<h1 class="t-title">x</h1><p id="odd">' + view.data.odd.state + (view.data.odd.refusal ? ":" + view.data.odd.refusal.code : "")
      + '</p><p id="fine">' + view.data.fine.state + "</p>",
  };
  const p = await boot({ screens: [SCREEN], path: "/app" });
  assert.equal(p.byOp("nonesuchop").length, 0, "nothing leaves the page");
  assert.equal(p.doc.getElementById("odd").textContent, "failed:UNKNOWN_OP");
  assert.equal(p.byOp("queue").length >= 1, true, "control: the declared read is sent");
});

/* ---------- F2: every class the shell draws is defined by a loaded stylesheet ---------- */

const LOADED = () => {
  const style = /<style>([\s\S]*?)<\/style>/.exec(interfacePage([]));
  return stylesheetClasses(ASSET_FILES["civicsmith.css"].body, ASSET_FILES["shell.css"].body, style ? style[1] : "");
};

test("F2 every class literal of the shell's own program is defined by a stylesheet the page loads (civicsmith.css, shell.css, the page's own style), the walk's five and the newer-version band among them, with no hook exemption", () => {
  const defined = LOADED();
  const drawn = [...classLiterals(shellProgram.toString())];
  for (const c of ["cs-crumbs", "mk-lvlbtn", "cs-rows", "cs-r", "cs-panel", "mk-updband"]) assert.ok(drawn.includes(c), c + " is drawn by the shell");
  assert.deepEqual(drawn.filter((c) => !defined.has(c)), [], "classes the shell draws that no loaded stylesheet defines");
});

test("F2 the walk's classes are each defined in the page as served; control: a hook class still needs no rule from a screen (R56), while the shell's own program has none to lean on", () => {
  const defined = LOADED();
  for (const c of ["cs-crumbs", "mk-lvlbtn", "cs-rows", "cs-r", "cs-panel"]) {
    assert.ok(Object.hasOwn(HOOK_CLASSES, c), c + " stays a hook class (its readers keep it)");
    assert.ok(defined.has(c), c + " is defined by a loaded stylesheet");
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
