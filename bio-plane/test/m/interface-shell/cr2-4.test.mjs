/* interface-shell, completion round 2, CR2-4: the live walk of p3dev-l11 (8 Nov 2026), findings 1 and 2. The explanation-level control
   drew `mk-lvlbtn`, which no loaded stylesheet defines (308 findings); it is now the design's quiet `cs-btn` with `data-shell="level"`.
   The member menu is the design's `mk-menu` (no `cs-menu` class; `#cs-menu` stays its id, read by journey-check). Every class the shell
   draws is one a loaded stylesheet defines (R56, R65; F2), but `SHELL_HOOKS_UNSTYLED`'s, each named by a requirement (R92's `mk-updband`). */
import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import * as shell from "../../../src/interface-shell/index.mjs";
const { stylesheetClasses, classLiterals, styleOf, checkClasses } = shell;
const SHELL_HOOKS_UNSTYLED = shell.SHELL_HOOKS_UNSTYLED || [];
import { shellProgram } from "../../../src/interface-shell/browser.mjs";
import { boot, ADMIN } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";

/* the loaded stylesheets: civicsmith.css, then shell.css, then the page's own `<style>` (the shell's STYLE) */
const LOADED = () => stylesheetClasses(ASSET_FILES["civicsmith.css"].body, ASSET_FILES["shell.css"].body, styleOf());
const classesIn = (els) => { const out = new Set(); for (const root of els) for (const el of [root, ...root.querySelectorAll("[class]")]) for (const c of (el.getAttribute("class") || "").split(/\s+/)) if (c) out.add(c); return out; };

test("CR2-4 F2 R56 R65 every class written in the shell's own program is defined by a loaded stylesheet, but the hooks a requirement names (R92's mk-updband)", () => {
  const defined = LOADED();
  const undefinedOnes = [...classLiterals(shellProgram.toString())].filter((c) => !defined.has(c)).sort();
  assert.deepEqual(undefinedOnes, [...SHELL_HOOKS_UNSTYLED].sort());
  assert.deepEqual([...SHELL_HOOKS_UNSTYLED], ["mk-updband"], "no other unstyled hook");
});

test("CR2-4 F2 every class the shell's frame draws (masthead, band, rail, tabs, member menu, path) at 1280 and 390 px is defined by a loaded stylesheet", async () => {
  const defined = LOADED();
  for (const phone of [false, true]) for (const path of ["/app", "/app/queue", "/app/members"]) {
    const p = await boot({ screens: ALL, path, phone, plane: { whoami: { status: 200, json: { ok: true, result: { ...ADMIN, capabilities: [] } } } } });
    const root = p.root();
    const frame = [".cs-mast", ".cs-band", ".cs-rail", ".cs-tabs", "#cs-menu", ".cs-crumbs"].map((s) => root.querySelector(s)).filter(Boolean);
    assert.ok(frame.length >= 3, path + ": the frame is drawn");
    const missing = [...classesIn(frame)].filter((c) => !defined.has(c));
    assert.deepEqual(missing, [], path + (phone ? " at 390 px" : " at 1280 px"));
  }
});

test("CR2-4 findings 1 and 2: the explanation-level control is the design's quiet cs-btn with data-shell=\"level\", and no element draws mk-lvlbtn; the member menu is mk-menu, never the class cs-menu", async () => {
  const p = await boot({ screens: ALL, path: "/app" });
  const level = p.root().querySelector('.cs-mast [data-shell="level"]');
  assert.ok(level, "the control is drawn");
  assert.equal(level.tagName, "BUTTON");
  assert.deepEqual(level.getAttribute("class").split(/\s+/), ["cs-btn"]);
  assert.equal(level.dataset.tone, "quiet");
  assert.equal(p.root().querySelector(".mk-lvlbtn"), null);
  assert.ok(!classLiterals(shellProgram.toString()).has("mk-lvlbtn"), "the program writes no mk-lvlbtn");
  /* finding 2: the member menu is the design's mk-menu over a cs-dialog; no element carries the class cs-menu; its id #cs-menu stays for journey-check */
  await p.click('[data-shell="menu"]');
  const menu = p.root().querySelector("#cs-menu");
  assert.ok(menu && menu.classList.contains("mk-menu") && menu.classList.contains("cs-dialog"));
  assert.equal(p.root().querySelector(".cs-menu"), null);
  assert.ok(!classLiterals(shellProgram.toString()).has("cs-menu"));
});

test("CR2-4 R56 the shell's own program takes no hook exemption: a hook class it drew with no loaded style (as mk-lvlbtn was) is refused at composition, naming it; control: a screen may still draw a hook class, and a defined class passes", () => {
  assert.throws(() => checkClasses([], null, `'<button class="cs-btn mk-lvlbtn">'`), /the shell draws the class mk-lvlbtn/);
  assert.throws(() => checkClasses([], null, `'<p class="cs-nonesuch">'`), /the shell draws the class cs-nonesuch/);
  assert.equal(checkClasses([], null, `'<button class="cs-btn">' + '<div class="cs-testband mk-updband">'`), true);
  const screen = { id: "home", reads: () => ({}), acts: [], render: () => '<nav class="cs-crumbs mk-crumbs"></nav>' };
  assert.equal(checkClasses([screen], null, `'<b class="cs-btn">'`), true);
});
