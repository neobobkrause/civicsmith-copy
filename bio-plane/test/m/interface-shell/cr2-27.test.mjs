/* interface-shell, attempt 21 (CR2-27; F7, meets F4): the DEC-340 overlaps the local walk still measured after CR2-4 ("A covers A, Width of
   the sections list", "SPAN covers A, Search, Explanations: prompt"). An explanation drawn beside a section-list link, the search prompt
   and the masthead's mark covers no control: not the rail's next place, not the width grip, not the masthead's row. */
import test from "node:test";
import assert from "node:assert/strict";
import { inChromium } from "./chromium.mjs";

const SCREEN = {
  id: "home", words: [], reads: () => ({}), acts: [],
  render: (cs) => '<h1 class="t-title">Home</h1>' + cs.sec("screen.home.name", "<p>" + cs.ref("project", "P1", "Project one", []) + ' <a href="/app/queue">a link</a> <button type="button">Go</button></p>', { help: "screen.home.purpose" }),
};

/* opens the explanation of the element `pick` finds (as the walk does: scrolled to the centre, focused, hovered) and answers the controls
   it covers by more than 2 px each way, the grip included, and where it stands against what it explains */
async function opened(page, pick) {
  const ok = await page.evaluate((pick) => {
    const el = new Function("return " + pick)();
    if (!el) return false;
    el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return true;
  }, pick);
  assert.ok(ok, "the fixture draws " + pick);
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const tip = document.getElementById("cs-tip");
    if (!tip || tip.hidden) return null;
    const t = tip.getBoundingClientRect();
    const ex = document.querySelector("[aria-describedby='cs-tip']");
    const e = ex.getBoundingClientRect();
    const over = [];
    for (const c of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
      if (c === ex || ex.contains(c) || c.contains(ex) || tip.contains(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (Math.min(t.right, r.right) - Math.max(t.left, r.left) > 2 && Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top) > 2) over.push(c.getAttribute("aria-label") || c.textContent.trim().slice(0, 20) || c.tagName);
    }
    return { over, inside: t.left >= 0 && t.top >= 0 && t.right <= document.documentElement.clientWidth && t.bottom <= document.documentElement.clientHeight,
      beside: t.left >= e.right, below: t.top >= e.bottom - 1, level: t.top < e.bottom && t.bottom > e.top };
  });
}

/* the section-list links: the rail's links, outside the masthead and the screen's column */
const RAILS = `[...document.querySelectorAll("a[data-tip]")].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest("#cs-main") && !e.closest("header") && e.getBoundingClientRect().top > 80)`;
const RAIL = (i) => RAILS + `[${i}]`;
const SEARCH = `document.querySelector("a.mk-mastsearch[data-tip]")`;
const MARK = `document.querySelector("span.cs-mark[data-tip]")`;

test("F7 CR2-27 at 1280 px the explanation of each section-list link covers no control: not the rail's next place, not the width grip", { timeout: 120000 }, async () => {
  const found = await inChromium([SCREEN], { width: 1280, path: "/app/home" }, async (page) => {
    const n = await page.evaluate((s) => new Function("return " + s)().length, RAILS);
    assert.ok(n >= 5, "the rail lists its sections (" + n + ")");
    const out = [];
    for (let i = 0; i < n; i++) { const h = await opened(page, RAIL(i)); await page.keyboard.press("Escape"); out.push(h); }
    return out;
  });
  for (const h of found) {
    assert.ok(h, "the explanation opens");
    assert.deepEqual(h.over, []);
    assert.ok(h.inside, "inside the page");
  }
});

for (const width of [1280, 390]) {
  test(`F7 CR2-27 at ${width} px the explanations of the search prompt and the masthead's mark cover no control of the masthead's row`, { timeout: 120000 }, async () => {
    const got = await inChromium([SCREEN], { width, path: "/app/home" }, async (page) => {
      const s = await opened(page, SEARCH); await page.keyboard.press("Escape");
      const m = await opened(page, MARK); await page.keyboard.press("Escape");
      return { s, m };
    });
    for (const [name, h] of Object.entries(got)) {
      assert.ok(h, name + " opens its explanation");
      assert.deepEqual(h.over, [], name);
      assert.ok(h.inside, name + " inside the page");
    }
  });
}

test("F7 CR2-27 control: a section-list link, with the rail's next place and the grip beneath and beside it, is explained beside it, level with it", { timeout: 120000 }, async () => {
  const h = await inChromium([SCREEN], { width: 1280, path: "/app/home" }, (page) => opened(page, RAIL(0)));
  assert.equal(h.beside, true);
  assert.equal(h.level, true);
  assert.deepEqual(h.over, []);
});
