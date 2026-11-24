/* interface-shell R1, R2, R21, R23: the page as `interfacePage` composes it and the door serves it, and the screen
   contract it checks before composing anything. */
import test from "node:test";
import { WORD_ROWS } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { interfacePage, interfaceScript, scriptPath, NONCE_SLOT, PATHS, checkScreens } from "../../../src/interface-shell/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { randomBytes } from "node:crypto";
import { boot, ok, scriptOf } from "./harness.mjs";
import { ALL, HOME, DOCUMENT } from "./screens.fixture.mjs";
import { inWorld, bootAs, translated } from "./world.mjs";
import { documentOf, textNodes } from "./dom.mjs";

const scripts = (html) => [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
const handlers = (html) => {
  const out = [];
  for (const [tag, attrs] of [...String(html).matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)].map((m) => [m[0], m[1]]))
    for (const [, name, raw = ""] of attrs.matchAll(/([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const value = raw.replace(/^["']|["']$/g, "").trim();
      if (/^on/i.test(name) || (/^(?:href|src|action|formaction|xlink:href)$/i.test(name) && /^javascript:/i.test(value))) out.push(tag);
    }
  return out;
};
const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "withheld", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });

test("R1 R56 one document: <html lang> en until the member's language is read, interface-assets' civicsmith.css and then shell.css linked before the shell's own style, the icon sprite absent (icons referenced from /app/assets/icons.svg), one external script at the version's address with no nonce slot, no member text outside the words", async () => {
  const html = interfacePage(ALL);
  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.deepEqual([...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]), ['<link rel="stylesheet" href="/app/assets/civicsmith.css">', '<link rel="stylesheet" href="/app/assets/shell.css">']);
  assert.ok(html.indexOf("shell.css") < html.indexOf("<style>"), "both before the shell's own style");
  assert.doesNotMatch(html, /<symbol\b|<svg[^>]*>\s*<defs/, "no inline sprite");
  assert.equal(scripts(html).length, 1);
  assert.match(scripts(html)[0].trim(), new RegExp(`^src="${scriptPath("0").replace(/[.]/g, "\\.")}" integrity="sha256-`));
  assert.equal(html.includes(NONCE_SLOT), false, "no nonce slot (R1, fix round 3)");
  const before = documentOf(html);
  assert.deepEqual(textNodes(before.body).map((t) => t.data.trim()).filter(Boolean), [], "no text but the script's words");
  assert.equal(/<title>([^<]*)<\/title>/.exec(html)[1], "", "even the title is drawn from the words");
  const { world, me } = await inWorld({ founder: true });
  const words = await translated(me, "es", [["rail.home.name", "Inicio"]]);
  assert.equal(words.length, 1, "the store holds the one adopted word");
  const p = await bootAs(world, me, { screens: ALL, path: "/app/document/c1", plane: { image: IMAGE } });
  assert.equal(p.doc.documentElement.getAttribute("lang"), "es");
  const uses = p.root().querySelectorAll("use").map((u) => u.getAttribute("href"));
  assert.ok(uses.length > 5);
  for (const u of uses) assert.match(u, /^\/app\/assets\/icons\.svg#i-[a-z-]+$/);
  /* control: before the language is read the page says en */
  const bare = await inWorld();
  const q = await bootAs(bare.world, bare.me, { screens: ALL });
  assert.equal(q.doc.documentElement.getAttribute("lang"), "en");
});

test("R1 no secret: the page holds no session token or key, and the session it reads is the browser's, never the page's", async () => {
  const html = interfacePage(ALL);
  assert.doesNotMatch(html, /Bearer [A-Za-z0-9]|sk-ant|ADMIN_TOKEN/);
});

test("R2 no resource on another origin in any src, href, @import, url() or fetch, and no typeface but interface-assets' (the page loads none itself)", async () => {
  const html = interfacePage(ALL);
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/g)) assert.match(m[1], /^\/(?!\/)/, m[0]);
  assert.doesNotMatch(html, /@import|@font-face|url\(\s*["']?(?:https?:|\/\/)/i);
  /* the words are data (a word may tell a member what an address starts with); the program and the screens name no origin */
  assert.doesNotMatch(scriptOf(html, ALL).replace(/"words":\[[\s\S]*?\],"ops":/, '"words":[],"ops":'), /https?:\/\/|["'`]\/\//, "the script names no other origin");
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: { image: IMAGE } });
  for (const el of p.root().querySelectorAll("[href], [src]")) assert.match(el.getAttribute("href") || el.getAttribute("src"), /^\/(?!\/)/);
  assert.ok(p.requests.length > 3);
  for (const r of p.requests) assert.match(r.url, /^\/api\/\?op=/);
  /* R92: the version poll is the one address that is no op: a public text address of its own */
  for (const r of p.polls) assert.equal(r.url, "/version");
});

test("R2 no inline event-handler attribute, no javascript: address and no script made from a string, in the page or anything it draws", async () => {
  const html = interfacePage(ALL);
  assert.deepEqual(handlers(html), []);
  assert.doesNotMatch(scriptOf(html, ALL), /\beval\s*\(|new\s+Function\b|setTimeout\(\s*["'`]|setInterval\(\s*["'`]|javascript:/);
  for (const path of ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings"]) {
    const p = await boot({ screens: ALL, path, plane: { image: IMAGE, heldcaptures: ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] }) } });
    assert.deepEqual(handlers(p.root().innerHTML), [], path);
  }
  /* control: the checker finds one */
  assert.equal(handlers('<a href="javascript:x">a</a><b onclick="x">b</b>').length, 2);
});

test("R2 (fix round 3) served as the door serves it, the page holds one script element loading the shell's versioned script and no inline script; two responses are the same page and the script is the same bytes (nothing per response: no nonce, no slot)", async () => {
  const [a, b] = [interfacePage(ALL, { version: "r1" }), interfacePage(ALL, { version: "r1" })];
  assert.equal(a, b);
  const s = scripts(a);
  assert.equal(s.length, 1);
  assert.match(s[0], new RegExp(`\\bsrc="${scriptPath("r1")}"`));
  assert.equal(/<script\b[^>]*>[^<]/i.test(a), false, "no inline script");
  assert.equal(a.includes(NONCE_SLOT) || /\bnonce=/.test(a), false);
  assert.equal(interfaceScript(ALL), interfaceScript(ALL));
  assert.notEqual(scriptPath("r1"), scriptPath("r2"), "a new release has a new address");
});

test("R21 interfacePage throws, naming the screen, for a screen whose id is not in SCREEN_REGISTRY, an act naming an op OPS does not hold, or an op neither the registry's for that screen nor a named re-point; a valid set passes", () => {
  const bad = (s, re) => assert.throws(() => interfacePage([s]), re);
  bad({ ...HOME, id: "nowhere" }, /nowhere.*SCREEN_REGISTRY/);
  bad({ ...HOME, acts: [{ op: "notanop" }] }, /home.*notanop.*OPS/);
  bad({ ...HOME, acts: [{ op: "retire" }] }, /home.*retire.*registry/);
  bad({ ...HOME, id: "home", render: undefined }, /home/);
  assert.throws(() => interfacePage([HOME, HOME]), /home.*twice/);
  assert.ok(interfacePage(ALL).length > 1000);
  const r = (id, op) => ({ id, render: () => "", acts: [{ op }] });
  assert.throws(() => checkScreens([r("home", "captureupload")]), /home.*captureupload/);
  assert.equal(checkScreens([{ ...DOCUMENT }]), true);
});

test("R38 R21 (as R73 amends) admits an op on a screen only when the registry lists it there (acts, or owed under its op name), infolevelset, or the one named re-point; ratify on ceremony is no longer admitted; a screen naming an unlisted op throws at interfacePage", () => {
  const r = (id, ...ops) => ({ id, render: () => "", acts: ops.map((op) => ({ op })) });
  const reg = (id) => SCREEN_REGISTRY.find((s) => s.id === id);
  const listed = (id, op) => !!reg(id) && (reg(id).acts.includes(op) || (reg(id).owed || []).some((o) => o.op === op));
  assert.equal(checkScreens([r("account", "infolevelset"), r("home", "infolevelset")]), true);
  /* R73: ratify goes (screens-publish sends caseratify); unlock on front and founderhandleset on setup are the registry's when it lists them */
  assert.throws(() => checkScreens([r("ceremony", "ratify")]), /ceremony.*ratify/);
  for (const [id, op] of [["front", "unlock"], ["setup", "founderhandleset"], ["capture", "captureupload"], ["connect", "subscriptionsignin"], ["connect", "subscriptiondisconnect"], ["answers", "ask"], ["capture", "monitorset"], ["project", "projectbarset"], ["project", "drawquestion"], ["calculation", "spotcheckvisit"]]) {
    if (listed(id, op)) assert.equal(checkScreens([r(id, op)]), true, id + " " + op);
    else assert.throws(() => checkScreens([r(id, op)]), new RegExp(id + ".*" + op), id + " " + op);
  }
  /* control: an op OPS holds, listed on no screen it names, throws naming both */
  assert.throws(() => interfacePage([r("project", "strengthbarset")]), /project.*strengthbarset/);
  assert.throws(() => interfacePage([r("home", "ratify")]), /home.*ratify/);
  assert.throws(() => interfacePage([r("doorbell", "cite")]), /doorbell/);
});

test("R30 a screen of the public or published frame naming an act that is not a public op throws at interfacePage", () => {
  const r = (id, op) => ({ id, render: () => "", acts: [{ op }] });
  assert.equal(checkScreens([r("doorbell", "knock")]), true);
  const pub = SCREEN_REGISTRY.find((s) => s.id === "published");
  const member = pub.acts.find((op) => OPS[op] && OPS[op].classes !== null);
  if (member) assert.throws(() => checkScreens([r("published", member)]), /published.*public/);
  assert.equal(SCREEN_REGISTRY.find((s) => s.id === "doorbell").acts.includes("knock"), true);
});

test("R23 no place is named in the shell's behaviour or words: its words, paths and program name none", () => {
  const PLACES = /Oakland|California|Alameda|Coliseum|Lakeshore|San Francisco|Berkeley|United States|\bCity of\b/;
  for (const [k, en] of WORD_ROWS.filter(([k]) => /^(shell|rail|tab)\./.test(k))) assert.doesNotMatch(en, PLACES, k);
  assert.doesNotMatch(JSON.stringify(PATHS), PLACES);
  assert.doesNotMatch(scriptOf(interfacePage([]), []), PLACES);
  /* control: the pattern finds one */
  assert.match("the Coliseum lease", PLACES);
});

test("R21 (K3297) a screen's functions may use Intl beside JSON, Math, String, Number, Array, Object and Date: composed and drawn, a language's name read through it", async () => {
  const s = { id: "account", reads: () => ({}), acts: [], render: (cs) => "<p id=lang>" + cs.esc(new Intl.DisplayNames(["en"], { type: "language" }).of("es")) + "</p>" };
  assert.ok(interfacePage([s]).length > 1000);
  const p = await boot({ screens: [s], path: "/app/account" });
  assert.equal(p.doc.getElementById("lang").textContent, "Spanish");
});
