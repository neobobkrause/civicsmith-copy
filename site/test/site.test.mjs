/* site's tests at its interface: the Worker's fetch(request, env), the generator's output and the served files
 * (build/requirements/site.md R1–R16). No test holds a sentence's English: each reads it through setup-words' `word`
 * or from the design at SITE_COMMIT. The browser pairs (R9 at 1280 and 390 px) are in browser.test.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { word, hasWord } from "../../bio-plane/src/setup-words/index.mjs";
import { ASSET_FILES, ASSETS_COMMIT } from "../../bio-plane/src/interface-assets/index.mjs";
import worker, { CSP, FAVICON, config } from "../src/index.mjs";
import { SITE_COMMIT as SERVED_COMMIT } from "../src/pages.mjs";
import { KEYS, STATES, SITE_COMMIT, designMain, parse, find, generate, render, placesReady, joinPlaces, esc } from "../build.mjs";

const INSTALLER = "https://install.example/start";
const GROUP_A = { name: "Group A", place: "Place A", focus: "Focus A", cases: 1, editions: 2, latest: "Date A", address: "https://a.example/" };
const GROUP_B = { name: "Group B", place: "Place B", focus: "Focus B", cases: 1, address: "https://b.example/" };
const FEATURED = { case: "case-x", title: "Case X", edition: 3, group: "Group X", place: "Place X", signer: "Signer X", date: "Date X", address: "https://x.example" };
const ENV = { INSTALLER_ADDRESS: INSTALLER, STEWARDS_ADDRESS: "stewards@example.org", FEATURED_CASE: JSON.stringify(FEATURED), LISTED_GROUPS: JSON.stringify([GROUP_A, GROUP_B]) };

const get = (path, env = ENV, method = "GET") => worker.fetch(new Request(`https://site.example${path}`, { method }), env);
const html = async (path, env = ENV) => { const r = await get(path, env); return { r, t: await r.text() }; };
const w = (key, vars) => esc(word(key, vars));
const textOf = (n) => (typeof n === "string" ? n : n.kids.map(textOf).join(""));
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const cls = (e) => (e.attrs.class || "").split(/\s+/).filter(Boolean);
const mainOf = (t) => find(parse(t.slice(t.indexOf("<main"), t.lastIndexOf("</main>") + 7)), (e) => e.tag === "main")[0];

/* The design's drawing of each state: its blocks (headings, paragraphs, list items, buttons) in order, each with its text. */
const DESIGN = parse(designMain(SITE_COMMIT));
const state = (s) => find(DESIGN, (e) => cls(e).includes(`st-${s}`))[0];
const BLOCK = (e) => ["h1", "h2", "p", "li", "nav"].includes(e.tag) || (e.tag === "a" && !find(e, () => false).length && /cs-btn|cs-ref/.test(e.attrs.class || ""));
const blocks = (root, skip = () => false) => {
  const out = [];
  const walk = (n) => {
    if (typeof n === "string" || skip(n) || cls(n).includes("mk-mockctl")) return;
    if (BLOCK(n)) out.push({ tag: n.tag, text: norm(textOf(n)) });
    for (const k of n.kids) walk(k);
  };
  walk(root);
  return out;
};
const samples = (n) => n.attrs["data-goto"] === "published" || cls(n).includes("cs-sheet") || cls(n).includes("cs-row");
const sampleSection = (root) => find(root, (e) => e.tag === "section" && find(e, (x) => x.attrs["data-goto"] === "published").length)[0];

/* The design's sentences in a state equal the page's, element by element (samples aside, R4 and R5 drawing values). */
async function sameAsDesign(path, s, env) {
  const { t } = await html(path, env);
  const sec = sampleSection(state(s));
  const want = blocks(state(s), (n) => n === sec || samples(n));
  const page = mainOf(t);
  const fsec = find(page, (e) => e.tag === "section" && find(e, (x) => x.tag === "a" && /\/app\/published\//.test(x.attrs.href || "")).length)[0];
  const got = blocks(page, (n) => n === fsec || samples(n) || cls(n).includes("mk-setuphead"));
  assert.deepEqual(got.map((b) => b.tag), want.map((b) => b.tag));
  got.forEach((b, i) => {
    if (b.tag === "nav") return;
    if (want[i].text.includes("[")) return; // the stewards' placeholder, R6's own test
    if (norm(b.text) === norm(word("screen.site.steps.name", { places: placesReady() }))) return; // R11's places, R11's own test
    assert.equal(norm(b.text).replace(/\.$/, ""), want[i].text.replace(/\.$/, ""), `${path} block ${i}`);
  });
  return t;
}

test("R1: three pages, each opening with the one menu, its own item marked", async () => {
  const navKeys = ["screen.site.nav.home", "screen.site.nav.start", "screen.site.nav.groups"];
  for (const [i, path] of ["/", "/start", "/groups"].entries()) {
    const { r, t } = await html(path);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/html/);
    const main = mainOf(t);
    const navs = find(main, (e) => e.tag === "nav");
    assert.equal(navs.length, 1);
    assert.equal(navs[0].attrs.class, "mk-sitenav");
    const links = navs[0].kids.filter((k) => typeof k !== "string");
    assert.deepEqual(links.map((a) => a.attrs.href), ["/", "/start", "/groups"]);
    assert.deepEqual(links.map((a) => textOf(a)), navKeys.map((k) => word(k)));
    assert.deepEqual(links.map((a) => a.attrs["aria-current"] ?? null), links.map((_, j) => (j === i ? "page" : null)));
    /* under the wordmark */
    const head = find(main, (e) => cls(e).includes("mk-setuphead"))[0];
    assert.ok(t.indexOf("mk-setuphead") < t.indexOf("mk-sitenav"));
    assert.equal(textOf(find(head, (e) => cls(e).includes("mk-wordmark"))[0]), word("shell.mark"));
    /* HEAD answers as GET with no body */
    const h = await get(path, ENV, "HEAD");
    assert.equal(h.status, 200);
    assert.equal(await h.text(), "");
    assert.equal(h.headers.get("content-type"), r.headers.get("content-type"));
  }
  for (const m of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) {
    const r = await get("/", ENV, m);
    assert.equal(r.status, 405, m);
    assert.equal(r.headers.get("allow"), "GET, HEAD");
  }
});

test("R1 control: /nonesuch answers 404 with a page in the same frame and a link to /", async () => {
  for (const path of ["/nonesuch", "/start/", "/app/assets/nonesuch.css", "/groups?x"]) {
    const { r, t } = await html(path);
    if (path === "/groups?x") { assert.equal(r.status, 200); continue; }
    assert.equal(r.status, 404, path);
    assert.ok(t.includes(w("screen.site.notfound")));
    const main = mainOf(t);
    assert.ok(find(main, (e) => cls(e).includes("mk-setuphead")).length);
    assert.ok(find(main, (e) => e.tag === "nav" && !find(e, (a) => a.attrs["aria-current"]).length).length);
    assert.ok(find(main, (e) => e.tag === "a" && e.attrs.href === "/" && textOf(e) === word("screen.site.back")).length);
  }
});

test("R2: the front page is the design's state a, element by element, in its order", async () => {
  await sameAsDesign("/", "a");
  const { t } = await html("/");
  const order = ["screen.site.hold", "screen.site.start", "screen.site.seegroups", "screen.site.uses.head", "screen.site.gets.head",
    "screen.site.not.head", "screen.site.onecase.head", "screen.site.member.head", "screen.site.questions.head"].map((k) => t.indexOf(`>${w(k)}<`));
  assert.ok(order.every((x) => x > 0), JSON.stringify(order));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(t.includes(`${w("screen.site.line1")} ${w("screen.site.line2")}`));
  const a = find(mainOf(t), (e) => e.tag === "a" && /cs-btn/.test(e.attrs.class || ""));
  assert.deepEqual(a.map((x) => x.attrs.href), ["/start", "/groups"]);
  assert.equal(find(mainOf(t), (e) => e.tag === "ol")[0].kids.filter((k) => typeof k !== "string").length, 5);
});

test("R2 control: no form and no field is drawn on any page", async () => {
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) {
    const { t } = await html(path);
    assert.doesNotMatch(t, /<(form|input|select|textarea|button)\b/i, path);
  }
});

test("R3: Start a group is the design's state b, element by element, then Create your group and Back to the front page", async () => {
  const t = await sameAsDesign("/start", "b");
  const order = ["screen.site.fit.head", "screen.site.need.head", "screen.site.hold.head", "screen.site.steps.head", "screen.site.costs.head",
    "screen.site.create", "screen.site.back"].map((k) => t.lastIndexOf(w(k)));
  assert.ok(order.every((x) => x > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const back = find(mainOf(t), (e) => e.tag === "a" && textOf(e) === word("screen.site.back"))[0];
  assert.equal(back.attrs.href, "/");
});

test("R3 control: Create your group opens exactly INSTALLER_ADDRESS", async () => {
  const { t } = await html("/start");
  const create = find(mainOf(t), (e) => e.tag === "a" && norm(textOf(e)) === word("screen.site.create"));
  assert.equal(create.length, 1);
  assert.equal(create[0].attrs.href, INSTALLER);
  assert.equal(create[0].attrs.target, undefined);
});

/* R4 (DEC-255, DEC-270): the listing rule, beside its sentence, as a details element: its heading and Bob's text, whole. */
function listingRule(t) {
  const d = find(mainOf(t), (e) => e.tag === "details");
  assert.equal(d.length, 1);
  assert.equal(norm(textOf(find(d[0], (e) => e.tag === "summary")[0])), norm(word("site.groups.rule.head")));
  assert.equal(norm(textOf(find(d[0], (e) => e.tag === "p")[0])), norm(word("site.groups.rule.text")));
  assert.ok(t.indexOf(w("site.groups.rule")) < t.indexOf("<details"));
}

test("R4: two listed groups draw two rows, in order, each with its name, place, focus, cases and Visit", async () => {
  const t = await sameAsDesign("/groups", "c");
  const rows = find(mainOf(t), (e) => cls(e).includes("cs-row"));
  assert.equal(rows.length, 2);
  const [a, b] = rows.map((r) => norm(textOf(r)));
  assert.equal(a, `${GROUP_A.name} · ${GROUP_A.place}${GROUP_A.focus} · ${norm(word("screen.site.groups.cases.one", { editions: 2, date: GROUP_A.latest }))}${word("screen.site.groups.visit")}`);
  assert.equal(b, `${GROUP_B.name} · ${GROUP_B.place}${GROUP_B.focus} · ${norm(word("screen.site.groups.case.one"))}${word("screen.site.groups.visit")}`);
  assert.deepEqual(rows.map((r) => find(r, (e) => e.tag === "a")[0].attrs.href), [GROUP_A.address, GROUP_B.address]);
  assert.ok(t.indexOf(w("screen.site.groups.listing")) > t.lastIndexOf("cs-row"));
  listingRule(t);
  /* more than one case */
  const many = { ...GROUP_A, cases: 3, editions: 5 };
  const { t: t3 } = await html("/groups", { ...ENV, LISTED_GROUPS: [many, { ...GROUP_B, cases: 2 }] });
  assert.ok(t3.includes(w("screen.site.groups.cases.many", { cases: 3, editions: 5, date: GROUP_A.latest })));
  assert.ok(t3.includes(w("screen.site.groups.case.many", { cases: 2 })));
  /* a group's own words are drawn as text, never as markup */
  const { t: tx } = await html("/groups", { ...ENV, LISTED_GROUPS: [{ ...GROUP_B, name: "<i>x</i>" }] });
  assert.ok(tx.includes("&lt;i&gt;x&lt;/i&gt;"));
});

test("R4 control: an empty list draws the empty state, no row and no made-up group", async () => {
  const designGroups = find(state("c"), (e) => cls(e).includes("cs-row")).map((r) => textOf(find(r, (e) => e.tag === "b")[0]));
  assert.ok(designGroups.length >= 1);
  for (const env of [{ ...ENV, LISTED_GROUPS: "[]" }, { ...ENV, LISTED_GROUPS: undefined }, { ...ENV, LISTED_GROUPS: [] }]) {
    const t = await sameAsDesign("/groups", "d", env);
    assert.equal(find(mainOf(t), (e) => cls(e).includes("cs-row") || cls(e).includes("cs-sheet")).length, 0);
    for (const g of designGroups) assert.ok(!t.includes(esc(g)), g);
    for (const k of ["screen.site.groups.lede", "screen.site.groups.none", "site.groups.rule"]) assert.ok(t.includes(w(k)), k);
    assert.ok(!t.includes(w("screen.site.groups.visit")));
    listingRule(t);
  }
  for (const bad of ["{", "{}", [{ ...GROUP_A, address: "http://a.example/" }], [{ ...GROUP_A, cases: 0 }], [{ ...GROUP_A, name: "" }], [{ ...GROUP_A, editions: 2, cases: 3 }]]) {
    assert.equal((await get("/groups", { ...ENV, LISTED_GROUPS: bad })).status, 500, JSON.stringify(bad));
  }
});

test("R5: a set FEATURED_CASE draws its row: title, edition, group, signer and date, linking that edition's public page", async () => {
  const { t } = await html("/");
  const sec = find(mainOf(t), (e) => e.tag === "section" && find(e, (h) => h.tag === "h2" && textOf(h) === word("screen.site.onecase.head")).length);
  assert.equal(sec.length, 1);
  const a = find(sec[0], (e) => e.tag === "a");
  assert.equal(a.length, 1);
  assert.equal(a[0].attrs.href, `${FEATURED.address}/app/published/${FEATURED.case}`);
  assert.equal(textOf(a[0]), word("screen.site.onecase.title", { case: FEATURED.title, edition: FEATURED.edition }));
  assert.ok(t.includes(w("screen.site.onecase.meta", { group: FEATURED.group, place: FEATURED.place, signer: FEATURED.signer, date: FEATURED.date })));
  assert.ok(t.includes(w("screen.site.onecase.open")));
  assert.ok(t.indexOf(w("screen.site.not.head")) < t.indexOf(w("screen.site.onecase.head")));
  assert.ok(t.indexOf(w("screen.site.onecase.head")) < t.indexOf(w("screen.site.member.head")));
});

test("R5 control: null draws no section; a malformed edition is refused, never drawn", async () => {
  for (const v of [null, undefined, "", "null"]) {
    const { r, t } = await html("/", { ...ENV, FEATURED_CASE: v });
    assert.equal(r.status, 200);
    assert.ok(!t.includes(w("screen.site.onecase.head")));
    assert.ok(!t.includes("/app/published/"));
  }
  for (const bad of [{ ...FEATURED, case: "../x" }, { ...FEATURED, edition: 0 }, { ...FEATURED, address: "javascript:alert(1)" }, { ...FEATURED, address: "https://x.example/?q" }, { ...FEATURED, signer: "" }, []]) {
    assert.equal((await get("/", { ...ENV, FEATURED_CASE: bad })).status, 500, JSON.stringify(bad));
  }
});

test("R6: STEWARDS_ADDRESS unset draws the marked placeholder, and every response says not yet public", async () => {
  const env = { ...ENV, STEWARDS_ADDRESS: undefined };
  const { r, t } = await html("/", env);
  assert.ok(t.includes(w("screen.site.questions.write", { address: `<b>${word("screen.site.questions.unset")}</b>` }).replace(/&lt;(\/?)b&gt;/g, "<$1b>").replace(/([.!?])<\/b>\.$/, "$1</b>")));
  assert.ok(!t.includes("mailto:"));
  for (const path of ["/", "/start", "/groups", "/nonesuch", "/app/assets/civicsmith.css"]) {
    assert.equal((await get(path, env)).headers.get("x-robots-tag"), "noindex", path);
    assert.equal((await get(path, { ...env, STEWARDS_ADDRESS: "" })).headers.get("x-robots-tag"), "noindex", path);
  }
  assert.equal(r.headers.get("x-robots-tag"), "noindex");
});

test("R6: the placeholder's own full stop ends the sentence, never followed by a second", async () => {
  const { t } = await html("/", { ...ENV, STEWARDS_ADDRESS: undefined });
  const q = find(mainOf(t), (e) => e.tag === "section" && find(e, (h) => h.tag === "h2" && textOf(h) === word("screen.site.questions.head")).length)[0];
  const said = norm(textOf(q).slice(word("screen.site.questions.head").length));
  assert.match(word("screen.site.questions.unset"), /[.!?]$/);
  assert.equal(said, norm(word("screen.site.questions.write", { address: word("screen.site.questions.unset") })).replace(/([.!?])\.$/, "$1"));
  assert.doesNotMatch(said, /[.!?]\.$/);
  /* set: the address takes the sentence's own stop */
  const { t: s2 } = await html("/");
  assert.ok(s2.includes(`${ENV.STEWARDS_ADDRESS}</a>.`));
});

test("R8: the page's icon is the mark, served from the site itself", async () => {
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) assert.ok((await html(path)).t.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'), path);
  for (const path of ["/favicon.svg", "/favicon.ico"]) {
    const r = await get(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get("content-type"), /^image\/svg\+xml/);
    assert.equal(r.headers.get("content-security-policy"), CSP);
    const body = await r.text();
    assert.equal(body, FAVICON);
    assert.doesNotMatch(body, /<script|<style|href=|url\(/);
    const mark = /<symbol id="i-mark"[^>]*>([\s\S]*?)<\/symbol>/.exec(ASSET_FILES["icons.svg"].body)[1];
    assert.ok(body.includes(/ d="([^"]+)"/.exec(mark)[1]));
  }
});

test("R6 control: set, it draws the mailto: link and no header", async () => {
  const { r, t } = await html("/");
  assert.ok(t.includes(w("screen.site.questions.write", { address: "\u0001" }).replace("\u0001", `<a href="mailto:${ENV.STEWARDS_ADDRESS}">${ENV.STEWARDS_ADDRESS}</a>`)));
  assert.ok(!t.includes(w("screen.site.questions.unset")));
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) assert.equal((await get(path)).headers.get("x-robots-tag"), null);
  assert.equal(r.headers.get("x-robots-tag"), null);
  for (const bad of ["not an address", "a@b", "<a@b.org>", "a@b.org?subject=x"]) assert.equal((await get("/", { ...ENV, STEWARDS_ADDRESS: bad })).status, 500, bad);
});

test("R7: the installer hand-off is a plain link equal to INSTALLER_ADDRESS, passing nothing about the visitor", async () => {
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) assert.equal((await get(path)).headers.get("referrer-policy"), "no-referrer");
  const { t } = await html("/start");
  const a = find(mainOf(t), (e) => e.tag === "a" && e.attrs.href === INSTALLER);
  assert.equal(a.length, 1);
  /* a plain link (no target, rel, ping or download), drawn as the primary button (R18) */
  assert.deepEqual(Object.keys(a[0].attrs).sort(), ["class", "data-tone", "href"]);
  assert.deepEqual([a[0].attrs.class, a[0].attrs["data-tone"]], ["cs-btn", "primary"]);
  /* unset until the release: drawn, with nowhere to go */
  const { t: u } = await html("/start", { ...ENV, INSTALLER_ADDRESS: undefined });
  const c = find(mainOf(u), (e) => e.tag === "a" && norm(textOf(e)) === word("screen.site.create"))[0];
  assert.equal(c.attrs.href, undefined);
});

test("R7 control: the link carries no query or fragment; one set with either is refused", async () => {
  const { t } = await html("/start");
  const href = find(mainOf(t), (e) => e.tag === "a" && norm(textOf(e)) === word("screen.site.create"))[0].attrs.href;
  const u = new URL(href);
  assert.equal(u.search, "");
  assert.equal(u.hash, "");
  for (const bad of [`${INSTALLER}?from=site`, `${INSTALLER}#x`, `${INSTALLER}?`, "http://install.example/", "https://u:p@install.example/", "javascript:alert(1)"]) {
    assert.equal((await get("/start", { ...ENV, INSTALLER_ADDRESS: bad })).status, 500, bad);
  }
});

/* wrangler.jsonc as the deploy reads it: its comments stripped, its strings kept whole (a `//` inside a URL is no comment). */
const deployConfig = () => JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? ""));

test("R7: the deploy config carries INSTALLER_ADDRESS, and the /start it serves draws Create your team to that address", async () => {
  const vars = deployConfig().vars;
  assert.match(vars.INSTALLER_ADDRESS, /^https:\/\/[^?#]+$/);
  /* the address as the site reads it: a URL, so a bare origin takes its own trailing slash */
  const want = new URL(vars.INSTALLER_ADDRESS).href;
  assert.equal(config(vars).installer, want);
  const { t } = await html("/start", vars);
  const a = find(mainOf(t), (e) => e.tag === "a" && norm(textOf(e)) === word("screen.site.create"));
  assert.equal(a.length, 1);
  assert.equal(a[0].attrs.href, want);
  /* R6: STEWARDS_ADDRESS stays unset, so the site stays marked not yet public */
  assert.equal(vars.STEWARDS_ADDRESS, undefined);
  assert.equal((await get("/start", vars)).headers.get("x-robots-tag"), "noindex");
});

test("R8: every page loads only the site's own files, runs no script, and every response carries the policy", async () => {
  const outside = new Set([INSTALLER, `${FEATURED.address}/app/published/${FEATURED.case}`, GROUP_A.address, GROUP_B.address, `mailto:${ENV.STEWARDS_ADDRESS}`]);
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) {
    const { r, t } = await html(path);
    assert.equal(r.headers.get("content-security-policy"), CSP);
    assert.match(CSP, /^default-src 'self'(;|$)/);
    assert.match(CSP, /script-src 'none'/);
    assert.doesNotMatch(t, /<script\b|@import|url\(|\bon[a-z]+=|\bstyle=|<style\b|<iframe|<img\b/i, path);
    for (const m of t.matchAll(/\b(src|href)="([^"]*)"/g)) {
      const [, attr, v] = m, tagStart = t.lastIndexOf("<", m.index), tag = /^<(\w+)/.exec(t.slice(tagStart))[1];
      assert.notEqual(attr, "src", path);
      if (tag === "a") { assert.ok(v.startsWith("/") ? ["/", "/start", "/groups"].includes(v) : outside.has(v), `${path}: ${v}`); continue; }
      if (v === "/favicon.svg") { assert.equal((await get(v)).status, 200); continue; }
      assert.ok(/^\/app\/assets\/[\w./-]+(#[\w-]+)?$/.test(v), `${path}: <${tag}> ${v}`);
      const file = v.slice("/app/assets/".length).replace(/#.*/, "");
      assert.ok(Object.hasOwn(ASSET_FILES, file), file);
      assert.equal((await get(v.replace(/#.*/, ""))).status, 200, v);
    }
  }
  for (const name of Object.keys(ASSET_FILES)) {
    const r = await get(`/app/assets/${name}`);
    assert.equal(r.headers.get("content-security-policy"), CSP);
    if (ASSET_FILES[name].encoding === "base64") continue;
    for (const m of (await r.text()).matchAll(/url\(\s*["']?([^"')]+)|@import\s+["']([^"']+)/g)) assert.match(m[1] ?? m[2], /^\/app\/assets\//, name);
  }
});

test("R8 control: the outside addresses drawn are anchors only", async () => {
  for (const path of ["/", "/start", "/groups"]) {
    const { t } = await html(path);
    for (const m of t.matchAll(/<(\w+)[^>]*\b(?:src|href)="(https?:|mailto:)[^"]*"/g)) assert.equal(m[1], "a", path);
  }
});

test("R9: the look is interface-assets' files, served at their paths byte for byte", async () => {
  const { t } = await html("/");
  const sheets = [...t.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(sheets, ["/app/assets/civicsmith.css", "/app/assets/shell.css"]);
  for (const [name, f] of Object.entries(ASSET_FILES)) {
    const r = await get(`/app/assets/${name}`);
    assert.equal(r.status, 200, name);
    assert.equal(r.headers.get("content-type").split(";")[0], f.type);
    const body = Buffer.from(await r.arrayBuffer());
    assert.ok(body.equals(f.encoding === "base64" ? Buffer.from(f.body, "base64") : Buffer.from(f.body)), name);
  }
});

test("R9: the pages are generated from SCR.site at SITE_COMMIT, never edited by hand", async () => {
  assert.equal(SERVED_COMMIT, SITE_COMMIT);
  const fresh = render(generate());
  assert.equal(readFileSync(new URL("../src/pages.mjs", import.meta.url), "utf8"), fresh, "site/src/pages.mjs is stale: node site/build.mjs");
  /* the mock's controls are gone and its links are real */
  for (const path of ["/", "/start", "/groups"]) {
    const { t } = await html(path);
    assert.doesNotMatch(t, /mk-mockctl|onclick|data-tip|data-goto|href="#"|class="st\b/);
  }
  assert.deepEqual(Object.keys(STATES).sort(), ["a", "b", "c", "d"]);
});

test("R10: nothing about a visitor is held: no cookie, and no binding beyond the deploy values", async () => {
  for (const path of ["/", "/start", "/groups", "/nonesuch", "/app/assets/icons.svg"]) {
    const r = await get(path);
    assert.equal(r.headers.get("set-cookie"), null);
    assert.equal(r.headers.get("cache-control"), "no-cache");
  }
  const cfg = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  assert.deepEqual(Object.keys(cfg).sort(), ["$schema", "account_id", "compatibility_date", "main", "name", "observability", "vars"]);
  assert.equal(cfg.account_id, "20b533579290b9b93168345edd3b7f72");
  assert.equal(cfg.observability.enabled, false);
  for (const k of Object.keys(cfg.vars)) assert.ok(["INSTALLER_ADDRESS", "STEWARDS_ADDRESS", "FEATURED_CASE", "LISTED_GROUPS", "WITHDRAWAL_REGISTER"].includes(k), k);
  /* a binding handed to it is never touched */
  const touched = [];
  const trap = new Proxy({}, { get: (_, p) => { touched.push(p); return () => {}; } });
  const r = await get("/", { ...ENV, KV: trap, LOG: trap });
  assert.equal(r.status, 200);
  assert.deepEqual(touched, []);
});

test("R11: the places ready now come from the released jurisdictions profiles at generation, and only from there", async () => {
  const dir = mkdtempSync(join(tmpdir(), "site-places-"));
  writeFileSync(join(dir, "a.mjs"), 'export default {\n  id: "a",\n  name: "Released Place Q",\n  covers: ["Q"],\n  test: false,\n};\n');
  writeFileSync(join(dir, "b.mjs"), 'export default {\n  id: "b",\n  name: "Test Place R",\n  covers: ["R"],\n  test: true,\n};\n');
  const url = new URL(`file://${dir}/`);
  assert.equal(placesReady(url), "Released Place Q");
  const g = generate({ places: placesReady(url) });
  const startText = norm(textOf(mainOf(g.pages.start.replace("{{installer}}", ""))));
  assert.ok(startText.includes(norm(word("screen.site.steps.name", { places: "Released Place Q" }))));
  assert.ok(!g.pages.start.includes(esc(placesReady())));
  for (const p of Object.values(g.pages)) assert.ok(!p.includes("Test Place R"));
  /* the served page names the released profiles' places, by the same rule */
  const { t } = await html("/start");
  assert.ok(norm(textOf(mainOf(t))).includes(norm(word("screen.site.steps.name", { places: placesReady() }))));
  mkdirSync(join(dir, "none"));
  assert.equal(placesReady(new URL(`file://${dir}/none/`)), "");
});

test("R11 control: no place is drawn but the profiles' and the listed groups' own", async () => {
  const env = { ...ENV, FEATURED_CASE: undefined, LISTED_GROUPS: [] };
  const design = norm(textOf(DESIGN));
  /* the design's sample places (its rows' places) are nowhere on the served pages */
  const samplePlaces = find(state("c"), (e) => cls(e).includes("cs-row")).map((r) => {
    const span = r.kids.find((k) => typeof k !== "string" && k.tag === "span");
    return norm(span.kids.find((k) => typeof k === "string" && norm(k).length > 1)).replace(/^· /, "");
  });
  assert.ok(samplePlaces.length && samplePlaces.every(Boolean), JSON.stringify(samplePlaces));
  for (const path of ["/", "/groups"]) {
    const { t } = await html(path, env);
    for (const p of samplePlaces) assert.ok(!norm(textOf(mainOf(t))).includes(p), `${path}: ${p}`);
  }
});

test("R12: every key the site reads exists, and what it draws is word(key, vars)", async () => {
  for (const k of Object.keys(KEYS)) assert.ok(hasWord(k), k);
  assert.ok(Object.keys(KEYS).includes("site.groups.rule.text") && Object.keys(KEYS).includes("site.groups.rule.head"));
  const drawn = async (path, env = ENV) => norm(textOf(mainOf((await html(path, env)).t)));
  const home = await drawn("/");
  for (const k of ["screen.site.hold", "screen.site.uses.head", "screen.site.not.legal", "screen.site.member.where", "screen.site.uses.gather"]) assert.ok(home.includes(norm(word(k))), k);
  assert.ok(home.includes(norm(word("screen.site.uses.ask", { example: word("screen.site.uses.ask.example") }))));
  const start = await drawn("/start");
  for (const k of ["screen.site.start.lede", "screen.site.costs.what", "screen.site.need.time", "screen.site.steps.claim"]) assert.ok(start.includes(norm(word(k))), k);
  assert.ok((await drawn("/groups", { ...ENV, LISTED_GROUPS: [] })).includes(norm(word("screen.site.groups.none"))));
  /* a sentence no key holds stops the generation, never drawn inline */
  assert.throws(() => word("screen.site.no-such-key"), (e) => /UNKNOWN_WORD/.test(e.code || e.message));
});

/* R13 to R16 (T50): the design's "team" words, the empty state, the places sentence, the listing rule. */
const ONE_TEAM = { ...ENV, LISTED_GROUPS: [GROUP_B] };
const EMPTY = { ...ENV, LISTED_GROUPS: [] };

test("R13: with no team listed the page draws the lede, the none sentence and the listing rule, no row and no listing note", async () => {
  for (const env of [EMPTY, { ...ENV, LISTED_GROUPS: undefined }]) {
    const { t } = await html("/groups", env);
    const order = ["screen.site.groups.lede", "screen.site.groups.none", "site.groups.rule"].map((k) => t.indexOf(w(k)));
    assert.ok(order.every((x) => x > 0), JSON.stringify(order));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.equal(find(mainOf(t), (e) => cls(e).includes("cs-row") || cls(e).includes("cs-sheet")).length, 0);
    assert.ok(!t.includes(w("screen.site.groups.listing")));
    assert.ok(t.indexOf(w("site.groups.rule")) < t.indexOf("<details"));
  }
});

test("R13 control: one listed team draws its row and the listing note", async () => {
  const { t } = await html("/groups", ONE_TEAM);
  assert.equal(find(mainOf(t), (e) => cls(e).includes("cs-row")).length, 1);
  assert.ok(t.includes(w("screen.site.groups.listing")));
  assert.ok(!t.includes(w("screen.site.groups.none")));
});

test("R14: the places step draws screen.site.steps.name with the released places joined without a serial comma", async () => {
  const dir = mkdtempSync(join(tmpdir(), "site-places-r14-"));
  const profile = (id, name, test) => writeFileSync(join(dir, `${id}.mjs`), `export default {\n  id: "${id}",\n  name: "${name}",\n  covers: ["${id}"],\n  test: ${test},\n};\n`);
  profile("a", "Place A", false); profile("b", "Place B", false); profile("c", "Place C", false); profile("d", "Place D (test)", true);
  assert.equal(placesReady(new URL(`file://${dir}/`)), "Place A, Place B and Place C");
  assert.equal(joinPlaces(["Place A", "Place B"]), "Place A and Place B");
  assert.equal(joinPlaces(["Place A"]), "Place A");
  const g = generate({ places: "Place A and Place B" });
  const start = norm(textOf(mainOf(g.pages.start.replace("{{installer}}", ""))));
  assert.ok(start.includes(norm(word("screen.site.steps.name", { places: "Place A and Place B" }))));
  assert.ok(!start.includes(norm(word("screen.site.steps.name.noplace"))));
  assert.ok(!g.pages.start.includes("Place D"));
});

test("R14 control: no place ready draws screen.site.steps.name.noplace, never an empty places sentence", async () => {
  const g = generate({ places: "" });
  const start = norm(textOf(mainOf(g.pages.start.replace("{{installer}}", ""))));
  assert.ok(start.includes(norm(word("screen.site.steps.name.noplace"))));
  assert.doesNotMatch(start, /Places ready now:\s*(\.|$|For each)/);
  assert.ok(!start.includes(norm(word("screen.site.steps.name", { places: "" }))));
  assert.ok(hasWord("screen.site.steps.name.noplace") && Object.keys(KEYS).includes("screen.site.steps.name.noplace"));
});

test("R15: the listing rule, its note and its details with Bob's heading and text, are on Teams at work with and without listed teams", async () => {
  for (const env of [ENV, ONE_TEAM, EMPTY]) {
    const { t } = await html("/groups", env);
    for (const k of ["site.groups.rule", "site.groups.rule.head", "site.groups.rule.text"]) assert.ok(t.includes(w(k)), k);
    listingRule(t);
  }
});

test("R15 control: no listing rule text is written in the site's code", () => {
  const rule = [word("site.groups.rule"), word("site.groups.rule.head"), word("site.groups.rule.text")];
  for (const f of ["../src/index.mjs", "../build.mjs"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const sentence of rule) assert.ok(!src.includes(sentence), f);
  }
  assert.ok(Object.keys(KEYS).includes("site.groups.rule") && Object.keys(KEYS).includes("site.groups.rule.text"));
});

test("R16: SITE_COMMIT is interface-assets' ASSETS_COMMIT (red until interface-assets' T50 job moves it, K3750)", () => {
  assert.equal(SITE_COMMIT, ASSETS_COMMIT);
});

test("R16: the design has four states, and the pages equal them", async () => {
  assert.equal(SERVED_COMMIT, SITE_COMMIT);
  assert.deepEqual(Object.keys(STATES), ["a", "b", "c", "d"]);
  await sameAsDesign("/", "a");
  await sameAsDesign("/start", "b");
  await sameAsDesign("/groups", "c");
  await sameAsDesign("/groups", "d", EMPTY);
  const fresh = render(generate());
  assert.equal(readFileSync(new URL("../src/pages.mjs", import.meta.url), "utf8"), fresh);
  for (const k of ["screen.site.nav.home", "screen.site.nav.start", "screen.site.nav.groups", "screen.site.start", "screen.site.seegroups", "screen.site.create", "screen.site.line1", "screen.site.line2"]) assert.ok(Object.keys(KEYS).includes(k), k);
});

test("R16 control: no served page says \"group\" for a team; the design's own sense is read from its list", async () => {
  const list = readFileSync(new URL("../../docs/development/ux-substrate/screens/build_words.mjs", import.meta.url), "utf8");
  const sense = new RegExp(/const GROUP_SENSE = (\/.*\/);/.exec(list)[1].slice(1, -1));
  const kept = Object.keys(KEYS).filter((k) => sense.test(k));
  assert.deepEqual(kept, ["screen.site.line2"]);
  for (const path of ["/", "/start", "/groups", "/nonesuch"]) {
    for (const env of [EMPTY, ONE_TEAM]) {
      let text = norm(textOf(mainOf((await html(path, { ...env, FEATURED_CASE: undefined })).t)));
      if (env === ONE_TEAM) text = text.replace(norm(`${GROUP_B.name} · ${GROUP_B.place}`), "");
      for (const k of kept) text = text.replace(norm(word(k)), "");
      assert.doesNotMatch(text, /group/i, path);
    }
  }
});
