/* journey-check R28 (N1184, N858, N880; DEC-340, U366; K3935; amends R6): what the walk checks on each screen beyond R6's
   limits, at 1280 and 390 px. Each check answers `[{kind, detail}]` for the page as it stands; the live arm reports them
   as failures (run.mjs). The words are read through `setup-words` `word`, or, for a key the design holds and the rows
   do not yet (the generated rows lag the design until BOB regenerates them at a layer close), from the design's own
   `words.json`, read as data. */
import { readFileSync } from "node:fs";
import { hasWord, word } from "../setup-words/index.mjs";
import { WORDS_JSON } from "./group-words.mjs";
import { registryScreens } from "./screens.mjs";

export const DEC340 = Object.freeze({ TITLE: "title", COVERS: "covers", WEIGHT: "weight", NAME: "name", CUT: "cut", GRAPH: "graph" });

/* A word of the list, else of the design's file; `{key}` placeholders filled from `vars`, the rest left as they are. */
let designWords = null;
export function wordOf(key, vars = {}) {
  if (hasWord(key)) return word(key, vars);
  designWords ||= new Map(JSON.parse(readFileSync(WORDS_JSON, "utf8")).words.map((w) => [w.key, w.en]));
  if (!designWords.has(key)) throw new Error(`no word ${key} in the list or in the design's file`);
  return designWords.get(key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/* The registry's public frame: every screen whose frame is `public` or `published`, and the setup frame's `join`
   (interface-shell R102). */
export function publicPages(screens = registryScreens()) {
  return screens.filter((s) => s.frame === "public" || s.frame === "published" || s.id === "join").map((s) => s.id);
}

/* The tab title screen `id` should carry: `page.title` with `screen.<id>.name` for a signed-in screen, `page.title.public` on a
   public page. The team's name is not known to the walk: it is any text between the two fixed parts. */
export function titlePattern(id, { isPublic = false } = {}) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const name = wordOf(`screen.${id}.name`);
  const sentinel = "\u0000";
  const w = isPublic ? wordOf("page.title.public", { page: name, team: sentinel }) : wordOf("page.title", { screen: name, team: sentinel });
  return new RegExp("^" + w.split(sentinel).map(esc).join(".+") + "$");
}

/* Whether the page's tab title is the word of its screen. */
export async function titleLimits(page, id, { isPublic = false } = {}) {
  const title = await page.title();
  let want;
  try { want = titlePattern(id, { isPublic }); } catch (e) { return [{ kind: DEC340.TITLE, detail: e.message }]; }
  return want.test(title) ? [] : [{ kind: DEC340.TITLE, detail: `the tab title is "${title}", not the word of screen.${id}.name (${want.source})` }];
}

/* A public page draws no weight mark, in the frame or the page (interface-shell R102): the marks are the buttons carrying
   `data-weighed`, and the dots the weight words describe. */
export async function weightLimits(page) {
  const n = await page.evaluate(() => document.querySelectorAll("[data-weighed], .cs-dots, [data-weight]").length);
  return n ? [{ kind: DEC340.WEIGHT, detail: `a public page draws ${n} weight mark${n === 1 ? "" : "s"}` }] : [];
}

/* The team's name in the masthead is fully visible: wrapped, never cut by an ellipsis, a clip or the viewport's edge. */
export async function mastheadLimits(page) {
  const m = await page.evaluate(() => {
    const el = document.querySelector(".cs-mast .mk-grp");
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { right: Math.round(r.right), vw: window.innerWidth, ellipsis: cs.textOverflow === "ellipsis", clip: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      hidden: cs.overflow === "hidden" || cs.overflowX === "hidden" };
  });
  if (!m) return [];
  const bad = [];
  if (m.ellipsis) bad.push("it ends in an ellipsis");
  if (m.hidden && m.clip) bad.push("it is clipped");
  if (m.right > m.vw + 1) bad.push(`it runs ${m.right - m.vw}px past the viewport`);
  return bad.length ? [{ kind: DEC340.CUT, detail: `the team's name in the masthead is cut: ${bad.join(", ")}` }] : [];
}

/* No explanation covers another control (interface-shell R103): each explanation (up to `limit` of them) is opened by focusing
   what it explains, and its box must overlap no other control. Since interface-shell's PR 310 (R145, F3, F4): the rail's width
   grip (`data-shell="grip"`) is no control an explanation must spare, and "inside the page" is inside the page's client width,
   so an explanation under the scroll bar runs outside it. */
export async function coverLimits(page, { limit = 8 } = {}) {
  const out = [];
  const n = await page.evaluate(() => [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length);
  for (let i = 0; i < Math.min(n, limit); i += 1) {
    const found = await page.evaluate((i) => {
      const els = [...document.querySelectorAll("[data-tip]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      const el = els[i];
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return true;
    }, i);
    if (!found) break;
    await page.waitForTimeout(700);
    const hit = await page.evaluate((i) => {
      const tip = document.getElementById("cs-tip");
      if (!tip || tip.hidden) return null;
      const els = [...document.querySelectorAll("[data-tip]")].filter((e) => e !== tip && !tip.contains(e));
      const t = tip.getBoundingClientRect();
      const explained = document.querySelector("[aria-describedby='cs-tip']");
      const over = [];
      for (const c of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
        if (c === explained || (explained && (explained.contains(c) || c.contains(explained))) || tip.contains(c)) continue;
        if (c.getAttribute("data-shell") === "grip") continue;
        const r = c.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const w = Math.min(t.right, r.right) - Math.max(t.left, r.left), h = Math.min(t.bottom, r.bottom) - Math.max(t.top, r.top);
        if (w > 2 && h > 2) over.push((c.getAttribute("data-act") || c.getAttribute("aria-label") || c.id || c.tagName).toString().slice(0, 40));
      }
      const vw = document.documentElement.clientWidth || window.innerWidth;
      return { over, outside: t.left < -1 || t.right > vw + 1, explains: (explained && (explained.getAttribute("data-act") || explained.id || explained.tagName)) || "" , i, els: els.length };
    }, i);
    await page.keyboard.press("Escape").catch(() => {});
    if (hit && hit.over.length) out.push({ kind: DEC340.COVERS, detail: `the explanation of ${hit.explains} covers ${[...new Set(hit.over)].slice(0, 3).join(", ")}` });
    if (hit && hit.outside) out.push({ kind: DEC340.COVERS, detail: `the explanation of ${hit.explains} runs outside the page` });
  }
  return out;
}

/* Controls of `selector` (within the main area) with no accessible name: no `aria-label`, `aria-labelledby`, `title`,
   `<label for>` or wrapping label. */
export async function unnamedControls(page, selector, { screen = "" } = {}) {
  const names = await page.evaluate((sel) => [...document.querySelectorAll(`#cs-main ${sel}`)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).filter((e) => {
    const labelled = e.getAttribute("aria-label") || e.getAttribute("title") || (e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby")))
      || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest("label");
    return !labelled;
  }).map((e) => e.getAttribute("data-act") || e.id || e.getAttribute("name") || e.tagName.toLowerCase()), selector);
  return names.map((n) => ({ kind: DEC340.NAME, detail: `${screen ? screen + ": " : ""}${n} has no accessible name` }));
}

/* Projects' search and filter have accessible names. */
export const projectsLimits = (page) => unnamedControls(page, 'input[type="search"], input[id*="search"], input[id*="filter"], select[id*="filter"], select[id*="search"], [role="search"] input, [role="search"] select', { screen: "projects" });

/* A person with no connections draws no graph and no Explore (U366): the person's page, which says it records none
   (`person.graph.none`), holds no graph and no door to Explore. The selectors are the graph's `[data-graph]` / `.cs-graph`
   and the Explore link. */
export async function noConnectionLimits(page) {
  const text = (await page.locator("#cs-main").innerText().catch(() => "")).replace(/\s+/g, " ");
  const none = wordOf("person.graph.none").split(/\{\w+\}/)[0].slice(0, 30);
  if (!text.includes(none)) return null;
  const drawn = await page.evaluate(() => ({ graph: !!document.querySelector("#cs-main [data-graph], #cs-main .cs-graph, #cs-main svg[data-graph]"),
    explore: !!document.querySelector('#cs-main a[href^="/app/explore"]') }));
  return [...(drawn.graph ? [{ kind: DEC340.GRAPH, detail: "a person with no connections draws a graph" }] : []),
    ...(drawn.explore ? [{ kind: DEC340.GRAPH, detail: "a person with no connections is offered Explore" }] : [])];
}

/* All of the above that apply to screen `id` at this width. `isPublic` from `publicPages()`. */
export async function dec340Limits(page, id, { isPublic = false, phone = false } = {}) {
  const out = [...await titleLimits(page, id, { isPublic })];
  if (isPublic) out.push(...await weightLimits(page));
  out.push(...await mastheadLimits(page), ...await coverLimits(page));
  if (id === "projects") out.push(...await projectsLimits(page));
  return out;
}
