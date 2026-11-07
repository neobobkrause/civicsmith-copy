/* interface-shell, attempt 9 (1): BOB ruling 7 Nov 2026, from interface-shell-t53's block. The split modules' one way onto the page:
   the shell imports bio-plane/src/interface-shell-t53/index.mjs and folds its `CONTRIBUTION` into the page it composes, in a fixed
   order: its kit parts into the program (added to every kit `cs`, the shell's own names winning), its frame rules into `STYLE` (after
   the shell's own) and its data into `D` (after the shell's own keys). A contribution placed there reaches the page; an empty one
   changes nothing. The contribution is passed as `options.contribution` here, in place of the file's, through the same composition.
   fixtures-own: stand-in screens and contributions, the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as shell from "../../../src/interface-shell/index.mjs";
/* the hook's names are read from the module, and the t53 file imported only if present, so with the hook reverted the tests run and fail
   on their assertions, not at load */
const { interfacePage, interfaceScript } = shell;
const contributionOf = (c) => { assert.equal(typeof shell.contributionOf, "function", "the shell exports contributionOf"); return shell.contributionOf(c); };
const styleOf = () => { assert.equal(typeof shell.styleOf, "function", "the shell exports styleOf"); return shell.styleOf(); };
const EMPTY_CONTRIBUTION = shell.EMPTY_CONTRIBUTION;
const { CONTRIBUTION } = await import("../../../src/interface-shell-t53/index.mjs").catch(() => ({}));
import { boot } from "./harness.mjs";

const styleIn = (html) => html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
const HOME = (render) => ({ id: "home", reads: () => ({}), acts: [], render });
const PLACED = Object.freeze({
  kit: { t53probe: (cs, D, name) => '<p id="t53p">' + cs.esc(name) + "|" + cs.esc(D.t53Probe.said) + "</p>" },
  style: ".cs-main .t53-probe-rule{display:block}",
  data: { t53Probe: { said: "from-data" } },
});

test("the hook: interface-shell-t53's index.mjs holds the empty contribution, and an empty contribution changes nothing: the script has no fifth argument, the page's style is the shell's alone, page and script equal across every form of empty", () => {
  assert.deepEqual(contributionOf(CONTRIBUTION), { kit: {}, style: "", data: {} }, "the file the shell imports is the empty contribution");
  const screens = [HOME(() => "<p>home</p>")];
  const forms = [undefined, null, {}, { kit: {}, style: "", data: {} }, EMPTY_CONTRIBUTION];
  const pages = forms.map((c) => interfacePage(screens, { contribution: c }));
  const scripts = forms.map((c) => interfaceScript(screens, { contribution: c }));
  for (const p of pages) assert.equal(p, interfacePage(screens), "the page as the shell composes it with the file's contribution");
  for (const s of scripts) assert.equal(s, interfaceScript(screens));
  assert.match(scripts[0], /, window, null\)\.start\(\);$/, "no fifth argument: the program is the shell's alone");
  assert.equal(styleIn(pages[0]), styleOf(), "the page's style is the shell's STYLE alone");
});

test("the hook: a contribution reaches the page: its kit part is a kit call every screen can make, given the kit and the page data that holds its data; its frame rules are served after the shell's; control: the shell's own page has none of them", async () => {
  const screens = [HOME((cs) => cs.t53probe ? cs.t53probe("asked") : '<p id="t53p">none</p>')];
  const html = interfacePage(screens, { contribution: PLACED });
  const style = styleIn(html);
  assert.ok(style.startsWith(styleOf()), "the shell's own rules first");
  assert.ok(style.endsWith("\n" + PLACED.style), "the contribution's frame rules after them");
  const src = interfaceScript(screens, { contribution: PLACED });
  assert.ok(src.indexOf('"t53Probe":{"said":"from-data"}') > src.indexOf('"adminScreens":'), "its data in D after the shell's own keys");
  const p = await boot({ screens, path: "/app/home", contribution: PLACED });
  assert.equal(p.doc.getElementById("t53p").textContent, "asked|from-data", "the kit part drew, reading its data from D");
  /* control: without it, no kit part, no rule, no data */
  const q = await boot({ screens, path: "/app/home" });
  assert.equal(q.doc.getElementById("t53p").textContent, "none");
  assert.equal(styleIn(interfacePage(screens)).includes("t53-probe-rule"), false);
  assert.equal(interfaceScript(screens).includes("t53Probe"), false);
});

test("the hook's fixed order: kit parts and data keys by name, whatever order the contribution gives them; the shell's own kit names win, and a data key the shell's page data holds throws, naming it", async () => {
  const a = { kit: { zeta: (cs) => "z", alpha: (cs) => "a" }, data: { t53b: 2, t53a: 1 } };
  const b = { kit: { alpha: (cs) => "a", zeta: (cs) => "z" }, data: { t53a: 1, t53b: 2 } };
  const screens = [HOME((cs) => "<p>" + cs.esc(cs.alpha()) + "</p>")];
  assert.equal(interfaceScript(screens, { contribution: a }), interfaceScript(screens, { contribution: b }), "the same script for the same parts in any order");
  assert.deepEqual(Object.keys(contributionOf(a).kit), ["alpha", "zeta"]);
  /* the shell's own `esc` stays the shell's */
  const p = await boot({ screens: [HOME((cs) => '<p id="e">' + cs.esc("<b>") + "</p>")], path: "/app/home", contribution: { kit: { esc: () => "REPLACED" } } });
  assert.equal(p.doc.getElementById("e").textContent, "<b>");
  assert.throws(() => interfaceScript(screens, { contribution: { data: { words: [] } } }), /t53 contribution's data names words/);
});

test("the hook checks a contribution's shape and its classes: a kit part that is no function, a style with @import, url( or </, or data that is not an object throws; a class its kit draws must be served (R56), its own frame rules counting as served", () => {
  const screens = [HOME(() => "<p>home</p>")];
  assert.throws(() => interfaceScript(screens, { contribution: { kit: { x: "not a function" } } }), /kit part x is not a function/);
  for (const style of ["@import 'a.css';", ".a{background:url(x.png)}", "</style><script>"]) assert.throws(() => interfaceScript(screens, { contribution: { style } }), /@import, a url\( or a <\//);
  assert.throws(() => interfaceScript(screens, { contribution: { data: [1] } }), /data is not an object/);
  const draws = { kit: { probe: () => '<i class="t53-nonesuch"></i>' } };
  assert.throws(() => interfaceScript(screens, { contribution: draws }), /the t53 contribution draws the class t53-nonesuch/);
  assert.ok(interfaceScript(screens, { contribution: { ...draws, style: ".t53-nonesuch{display:inline}" } }), "with its own rule, it composes");
});
