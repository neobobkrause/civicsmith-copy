/* R9 in a browser: each page beside the design's drawing of its state at SITE_COMMIT, at 1280 and 390 px, screenshots
 * in pairs (journey-check R6's method), written to $SITE_PAIRS or a fresh temporary directory, whose path the test
 * prints for BOB. Each served page is checked: no wider than the viewport, every class it draws defined by a stylesheet
 * it loads, every face and icon loaded from the site itself. Needs `npm ci` in site/ (playwright-core) and Chromium
 * (CHROMIUM, or /opt/pw-browsers/chromium). */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/index.mjs";
import { SITE_COMMIT, STATES, designMain } from "../build.mjs";

const { chromium } = await import("playwright-core");
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const ENV = {
  INSTALLER_ADDRESS: "https://install.example/",
  FEATURED_CASE: { case: "case-x", title: "Case X", edition: 2, group: "Group X", place: "Place X", signer: "Signer X", date: "Date X", address: "https://x.example" },
  LISTED_GROUPS: [{ name: "Group A", place: "Place A", focus: "Focus A", cases: 1, editions: 2, latest: "Date A", address: "https://a.example/" },
    { name: "Group B", place: "Place B", focus: "Focus B", cases: 1, address: "https://b.example/" }],
};
const git = (path) => execFileSync("git", ["show", `${SITE_COMMIT}:docs/development/ux-substrate/${path}`], { encoding: "utf8", maxBuffer: 1 << 26 });

/* The design's drawing of a state: the design page's own stylesheet with the visual language, the icons, and SCR.site's
   main in the setup frame, its mock control removed. */
function design(st) {
  const src = git("screens/page.src.html");
  const style = src.slice(src.indexOf("<style>"), src.indexOf("</style>") + 8)
    .replace("{{FACES}}", git("visual-language/faces.css").replaceAll('url("fonts/', 'url("/app/assets/fonts/'))
    .replace("{{CSS}}", git("visual-language/civicsmith.css"));
  const main = designMain().replace(/<div class="mk-mockctl">[\s\S]*?<\/select><\/div>/, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${style}</head>`
    + `<body class="cs">${git("visual-language/icons.svg")}<div class="cs-frame mk-page mk-plain" data-frame="setup"><main class="mk-plainmain" data-st="${st}">${main}</main></div></body></html>`;
}

test("R9: each page beside the design's drawing at 1280 and 390 px; control: no page is wider than the viewport", async (t) => {
  const out = process.env.SITE_PAIRS || mkdtempSync(join(tmpdir(), "site-pairs-"));
  if (!existsSync(out)) mkdirSync(out, { recursive: true });
  const server = http.createServer(async (q, s) => {
    if (q.url.startsWith("/__design/")) { s.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return s.end(design(q.url.slice(10))); }
    const env = q.url.startsWith("/groups?empty") ? { ...ENV, LISTED_GROUPS: [] } : ENV;
    const r = await worker.fetch(new Request(`http://127.0.0.1${q.url}`), env);
    s.writeHead(r.status, Object.fromEntries(r.headers));
    s.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const outside = [], violations = [];
      page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) outside.push(r.url()); });
      page.on("console", (m) => { if (/Content Security Policy/.test(m.text())) violations.push(m.text()); });
      for (const [st, [name, path]] of Object.entries(STATES)) {
        const url = st === "d" ? `${path}?empty` : path;
        await page.goto(base + url, { waitUntil: "networkidle" });
        const m = await page.evaluate(() => {
          const defined = new Set();
          for (const sh of document.styleSheets) {
            const walk = (rules) => { for (const r of rules) { if (r.selectorText) for (const c of r.selectorText.matchAll(/\.([\w-]+)/g)) defined.add(c[1]); if (r.cssRules) walk(r.cssRules); } };
            walk(sh.cssRules);
          }
          const used = new Set([...document.querySelectorAll("[class]")].flatMap((e) => [...e.classList]));
          const svg = document.querySelector(".mk-setuphead svg").getBoundingClientRect();
          return { scroll: document.documentElement.scrollWidth, inner: innerWidth, undefinedClasses: [...used].filter((c) => !defined.has(c)),
            faces: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family), mark: svg.width > 0 && svg.height > 0 };
        });
        assert.ok(m.scroll <= m.inner, `${name} at ${width}: ${m.scroll} wide in ${m.inner}`);
        assert.deepEqual(m.undefinedClasses, [], `${name} at ${width}`);
        assert.ok(m.faces.length > 0, `${name} at ${width}: no face loaded`);
        assert.ok(m.mark, `${name} at ${width}: the mark is not drawn`);
        await page.screenshot({ path: join(out, `${width}-${st}-${name}-site.png`), fullPage: true });
        await page.goto(`${base}/__design/${st}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: join(out, `${width}-${st}-${name}-design.png`), fullPage: true });
      }
      assert.deepEqual(outside, [], `at ${width}: requests to another origin`);
      assert.deepEqual(violations, [], `at ${width}`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  t.diagnostic(`pairs at ${out}`);
});

test("R9 control: a page wider than the viewport is caught by the same measure", async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.setContent('<div style="width:900px">x</div>');
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
    assert.ok(m.scroll > m.inner);
  } finally { await browser.close(); }
});

/* R18 (JOURNEYS R-44): "Create your team" was a 130x23 px inline link beside a button. It is now the front page's primary
   button, the same control kind, measured here at 1280 and 390 px. The visual language (interface-assets' civicsmith.css)
   draws every cs-btn at least 40 px high, and 44 px only below 760 px (shell.css); so at 390 px it is at least 44 px, and at
   1280 px it is the front page's own height, 40 px. The 1280 px figure of 44 is the todo below, owed by the visual language
   (a BOB question: it is not this module's file, and R9 keeps the look interface-assets'). */
test("R18: /start's Create your team is the front page's primary button's control kind at 1280 and 390 px, at least 44 px high at 390 px; control: the front page's button is unchanged", async () => {
  const { word } = await import("../../bio-plane/src/setup-words/index.mjs");
  const server = http.createServer(async (q, s) => {
    const r = await worker.fetch(new Request(`http://127.0.0.1${q.url}`), ENV);
    s.writeHead(r.status, Object.fromEntries(r.headers));
    s.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: EXE });
  /* a control's kind: its element, its class, its tone, and the box the stylesheet gives it */
  const kind = (page, text) => page.evaluate((text) => {
    const a = [...document.querySelectorAll("main a")].find((e) => e.textContent.replace(/\s+/g, " ").trim() === text);
    if (!a) return null;
    const cs = getComputedStyle(a), box = a.getBoundingClientRect();
    return { tag: a.tagName, cls: a.className, tone: a.dataset.tone ?? null, display: cs.display, background: cs.backgroundColor,
      color: cs.color, border: cs.borderTopColor, radius: cs.borderTopLeftRadius, decoration: cs.textDecorationLine,
      minHeight: cs.minHeight, height: box.height };
  }, text);
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const primary = await kind(page, word("screen.site.start"));
      await page.goto(`${base}/start`, { waitUntil: "networkidle" });
      const create = await kind(page, word("screen.site.create"));
      assert.ok(create, `at ${width}: no Create your team`);
      const { height: h1, ...k1 } = create, { height: h2, ...k2 } = primary;
      assert.deepEqual(k1, k2, `at ${width}`);
      assert.ok(h1 >= h2, `at ${width}: ${h1} px high, the front page's button ${h2}`);
      if (width === 390) assert.ok(h1 >= 44, `at ${width}: ${h1} px high`);
      /* control: the front page's primary button is the button it was */
      assert.equal(primary.cls, "cs-btn");
      assert.equal(primary.tone, "primary");
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
});

test.todo("R18: at 1280 px Create your team is at least 44 px high (the visual language draws cs-btn 40 px there; interface-assets' stylesheet, a BOB question)");
