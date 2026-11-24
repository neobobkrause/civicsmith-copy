/* interface-shell R14–R18: explanations, their timings and nesting, references and cards, the explanation level and
   appearance. */
import test from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { boot, ok, refused, pending, nestedTips } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";

const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELDA = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }, { id: "h2", title: "Budget", at: "2026-10-02" }] });
const PLANE = { image: IMAGE, heldcaptures: HELDA, projectdirectory: ok({ projects: [{ id: "P1", title: "Pothole", questions: 2, due: "2026-10-20" }] }) };
const en = (k) => WORD_ROWS.find((r) => r[0] === k)[1];
const tip = (p) => p.doc.getElementById("cs-tip");
const MONTH = 31 * 24 * 3600 * 1000;

test("R14 every mark, name and reference explains itself at level 1; every screen heading, section heading, rail place, tab and act at level 2 (guidance)", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  const r = p.root();
  for (const el of r.querySelectorAll(".cs-grade, .cs-origin, .cs-gap, .cs-ref, .cs-card, .cs-due, .cs-band [data-tip]")) assert.equal(el.getAttribute("data-level"), "1", el.outerHTML.slice(0, 80));
  for (const el of r.querySelectorAll(".cs-rail a, .cs-tabs a, button[data-act], #cs-main h2")) assert.equal(el.getAttribute("data-level"), "2", el.outerHTML.slice(0, 80));
  const h1 = r.querySelector("#cs-main h1");
  assert.equal(h1.getAttribute("data-level"), "1", "a title naming a particular thing explains that thing first");
  assert.ok(h1.getAttribute("data-tip").includes(en("screen.document.purpose").replace(/'/g, "&#39;")));
  const home = await boot({ screens: ALL, plane: PLANE });
  assert.equal(home.root().querySelector("#cs-main h1").getAttribute("data-level"), "2");
  assert.equal(home.root().querySelector("#cs-main h1").getAttribute("data-tip"), en("screen.home.purpose").replace(/'/g, "&#39;"));
});

test("R14 timings: a pointer resting 0.5 s opens level 1, and level 2 at Explain promptly; 1.5 s for level 2 On a longer pause; keyboard focus and a tap at once; it stays while the pointer is on the element or the explanation; it closes 0.5 s after leaving both, or on Escape; one at a time; announced as the element's description", async () => {
  for (const level of ["prompt", "pause"]) {
    const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE, local: { "cs-level": level } });
    const grade = p.root().querySelector(".cs-grade");
    const act = p.root().querySelector('button[data-act="cite"]');
    p.fire(grade, "pointerover", { pointerType: "mouse" });
    await p.clock.tick(499); assert.equal(tip(p).hidden, true);
    await p.clock.tick(1); assert.equal(tip(p).hidden, false, "level 1 at 0.5 s");
    assert.equal(grade.getAttribute("aria-describedby"), "cs-tip");
    assert.ok(tip(p).textContent.startsWith(word("mark.scale.capture.name")));
    p.fire(grade, "pointerout", { relatedTarget: tip(p) });
    await p.clock.tick(2000); assert.equal(tip(p).hidden, false, "stays while on the explanation");
    p.fire(tip(p), "pointerout", { relatedTarget: p.root() });
    await p.clock.tick(499); assert.equal(tip(p).hidden, false);
    await p.clock.tick(1); assert.equal(tip(p).hidden, true, "closes 0.5 s after leaving both");
    assert.equal(grade.getAttribute("aria-describedby"), null);
    p.fire(act, "pointerover", { pointerType: "mouse" });
    const wait = level === "pause" ? 1500 : 500;
    await p.clock.tick(wait - 1); assert.equal(tip(p).hidden, true, level);
    await p.clock.tick(1); assert.equal(tip(p).hidden, false, level);
    assert.ok(tip(p).textContent.startsWith(word("act.cite.label.document")));
    p.fire(p.doc.body, "keydown", { key: "Escape" });
    assert.equal(tip(p).hidden, true, "Escape closes");
    p.root().querySelector(".cs-origin").focus();
    assert.equal(tip(p).hidden, false, "focus opens at once");
    assert.ok(tip(p).textContent.startsWith(word("mark.origin.search.name")));
    act.focus();
    assert.ok(tip(p).textContent.startsWith(word("act.cite.label.document")), "one at a time, at once on focus at either level");
    assert.equal(p.root().querySelector(".cs-origin").getAttribute("aria-describedby"), null);
    p.fire(grade, "pointerover", { pointerType: "touch" });
    assert.ok(tip(p).textContent.startsWith(word("mark.scale.capture.name")), "a tap at once");
  }
});

test("R14 nothing is hidden at either level: the same explanations exist promptly and on a longer pause", async () => {
  const a = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE, local: { "cs-level": "prompt" } });
  const b = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE, local: { "cs-level": "pause" } });
  const tips = (p) => p.root().querySelectorAll("#cs-main [data-tip]").map((e) => e.getAttribute("data-tip"));
  assert.deepEqual(tips(a), tips(b));
  assert.ok(tips(a).length > 5);
});

test("R15 no explaining element sits inside another, on every screen in every state at both widths; a control or mark with explanations inside absorbs them, said after its own", async () => {
  const states = [PLANE, Object.fromEntries(Object.keys(PLANE).map((k) => [k, pending])), Object.fromEntries(Object.keys(PLANE).map((k) => [k, ok(null)])), Object.fromEntries(Object.keys(PLANE).map((k) => [k, refused("NO")]))];
  for (const plane of states) for (const path of ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings", "/app/people", "/app/more"]) for (const phone of [false, true]) {
    const p = await boot({ screens: ALL, path, plane: { ...plane, assistantstate: ok({ on: true }), accountreference: ok({ held: true }) }, phone });
    const d = p.root().querySelector('[data-shell="dock"]');
    if (d) await p.click(d);
    assert.deepEqual(nestedTips(p.root()).map((e) => e.outerHTML.slice(0, 60)), [], path);
  }
  const s = { id: "home", reads: () => ({}), acts: [], render: (cs) => '<span id=o data-tip="Outer" data-level="2">' + cs.mark("origin", "machine") + "</span>" };
  const p = await boot({ screens: [s] });
  const o = p.doc.getElementById("o");
  assert.ok(o.getAttribute("data-tip").startsWith("Outer"));
  assert.ok(o.getAttribute("data-tip").includes(en("mark.origin.machine.means").slice(0, 20)), "said after its own");
  assert.equal(o.querySelector("[data-tip]"), null);
  /* control: the check finds a nesting */
  const raw = p.doc.createElement("div"); raw.innerHTML = '<a data-tip="x"><b data-tip="y">z</b></a>';
  assert.equal(nestedTips(raw).length, 1);
});

test("R16 an item the record holds is a link opening its screen where one is built, with a card on hover or focus naming what it is and the facts the read answered; an item whose screen is not built carries its card only", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  const link = p.root().querySelector("a.cs-ref");
  assert.equal(link.getAttribute("href"), "/app/document/c1%231");
  assert.ok(link.getAttribute("data-tip").includes(word("shell.card.passage")));
  assert.ok(link.getAttribute("data-tip").includes(word("shell.card.open")));
  link.focus();
  assert.ok(tip(p).textContent.startsWith(word("shell.card.passage")));
  const h = await boot({ screens: ALL, plane: PLANE });
  const card = h.root().querySelector("span.cs-card");
  assert.equal(card.textContent, "Pothole");
  assert.equal(card.getAttribute("tabindex"), "0");
  assert.ok(card.getAttribute("data-tip").includes(word("shell.card.project")) && card.getAttribute("data-tip").includes("2 questions"));
  assert.ok(!card.getAttribute("data-tip").includes(word("shell.card.open")));
  await h.click(card);
  assert.ok(tip(h).textContent.includes("2 questions"), "a tap shows the card");
  await p.click(link);
  assert.equal(p.location.pathname, "/app/document/c1%231");
});

test("R17 the explanation level is the member's: the masthead shows it and switches it in one click, as Alt+Shift+I does; sent as op=infolevelset and read with op=infolevel; kept on the device while either does not answer, default Explain promptly", async () => {
  const served = Object.hasOwn(OPS, "infolevelset");
  const p = await boot({ screens: ALL, plane: PLANE });
  const ctl = () => p.root().querySelector('[data-shell="level"]');
  assert.ok(ctl().textContent.includes(en("shell.level.button.prompt")));
  await p.click(ctl());
  assert.ok(ctl().textContent.includes(en("shell.level.button.pause")));
  assert.equal(p.local.get("cs-level"), "pause");
  assert.equal(p.byOp("infolevelset").length, served ? 1 : 0);
  if (served) assert.deepEqual(p.byOp("infolevelset")[0].body, { level: "pause" });
  p.fire(p.doc.body, "keydown", { key: "I", altKey: true, shiftKey: true });
  await p.settle();
  assert.ok(ctl().textContent.includes(en("shell.level.button.prompt")));
  const q = await boot({ screens: ALL, plane: { ...PLANE, infolevel: ok({ level: "pause", set_at: "2026-10-01T00:00:00Z", asked_at: null }) } });
  assert.ok(q.root().querySelector('[data-shell="level"]').textContent.includes(en("shell.level.button.pause")), "read with infolevel");
  const r = await boot({ screens: ALL, plane: { ...PLANE, infolevel: refused("NO") }, local: { "cs-level": "pause" } });
  assert.ok(r.root().querySelector('[data-shell="level"]').textContent.includes(en("shell.level.button.pause")), "kept on the device");
  const fresh = await boot({ screens: ALL, plane: { ...PLANE, infolevel: pending } });
  assert.ok(fresh.root().querySelector('[data-shell="level"]').textContent.includes(en("shell.level.button.prompt")), "a new member starts at Explain promptly");
});

test("R17 after the member's first month the shell asks once whether to keep the level (DEC-162 (2)), the answer recorded through the same op, and never asks again", async () => {
  const served = Object.hasOwn(OPS, "infolevelset");
  const young = await boot({ screens: ALL, plane: PLANE, local: { "cs-first:mai": String(Date.now() - 1000) } });
  assert.equal(young.root().querySelector('[data-shell="level-keep"]'), null);
  const p = await boot({ screens: ALL, plane: PLANE, local: { "cs-first:mai": String(Date.now() - MONTH) } });
  /* R75 (2): the question is one note at the top of Home, above everything else on it, in the design's words */
  assert.equal(p.root().querySelector("#cs-main").children[0].getAttribute("data-level-note"), "ask");
  assert.ok(p.root().querySelector("#cs-main").textContent.includes(word("level.keep.ask")));
  assert.deepEqual(p.root().querySelectorAll('[data-shell="level-keep"]').map((b) => b.textContent), [word("level.keep.prompt"), word("level.keep.pause")]);
  await p.click('[data-level-to="prompt"]');
  assert.equal(p.root().querySelector('[data-shell="level-keep"]'), null);
  assert.ok(p.root().querySelector("#cs-main").textContent.includes(word("level.keep.later")), "level.keep.later once, after the answer");
  if (served) assert.deepEqual(p.byOp("infolevelset")[0].body, { level: "prompt", asked: true });
  const again = await boot({ screens: ALL, plane: PLANE, local: Object.fromEntries(p.local) });
  assert.equal(again.root().querySelector('[data-shell="level-keep"]'), null);
  const answered = await boot({ screens: ALL, plane: { ...PLANE, infolevel: ok({ level: "prompt", set_at: "2026-01-01T00:00:00Z", asked_at: "2026-02-01T00:00:00Z" }) }, local: { "cs-first:mai": String(Date.now() - MONTH) } });
  assert.equal(answered.root().querySelector('[data-shell="level-keep"]'), null);
  const sw = await boot({ screens: ALL, plane: PLANE, local: { "cs-first:mai": String(Date.now() - MONTH) } });
  await sw.click('[data-level-to="pause"]');
  assert.equal(sw.local.get("cs-level"), "pause");
  if (served) assert.deepEqual(sw.byOp("infolevelset")[0].body, { level: "pause", asked: true });
  /* control: asked on Home only (not on another screen), and never of a member whose level is not the default */
  const other = await boot({ screens: ALL, path: "/app/queue", plane: PLANE, local: { "cs-first:mai": String(Date.now() - MONTH) } });
  assert.equal(other.root().querySelector('[data-shell="level-keep"]'), null);
  const set = await boot({ screens: ALL, plane: { ...PLANE, infolevel: ok({ level: "pause", set_at: "2026-01-01T00:00:00Z", asked_at: null }) }, local: { "cs-first:mai": String(Date.now() - MONTH) } });
  assert.equal(set.root().querySelector('[data-shell="level-keep"]'), null, "a member whose level is not the default is not asked");
});

test("R18 appearance is Follow my device, Light or Dark, kept on the device; print is always light", async () => {
  const p = await boot({ screens: ALL, plane: PLANE });
  const html = p.doc.documentElement;
  assert.equal(html.getAttribute("data-theme"), null);
  await p.click('[data-shell="menu"]');
  const names = p.root().querySelectorAll('[data-shell="theme"]').map((b) => b.textContent);
  assert.deepEqual(names, [word("shell.appearance.device"), word("shell.appearance.light"), word("shell.appearance.dark")]);
  await p.click('[data-theme-to="dark"]');
  assert.equal(html.getAttribute("data-theme"), "dark");
  assert.equal(p.local.get("cs-theme"), "dark");
  for (const f of p.win.listeners.beforeprint) f({});
  assert.equal(html.getAttribute("data-theme"), "light", "print is light");
  for (const f of p.win.listeners.afterprint) f({});
  assert.equal(html.getAttribute("data-theme"), "dark");
  await p.click('[data-shell="menu"]');
  await p.click('[data-theme-to="device"]');
  assert.equal(html.getAttribute("data-theme"), null);
  for (const f of p.win.listeners.beforeprint) f({});
  assert.equal(html.getAttribute("data-theme"), "light");
  const q = await boot({ screens: ALL, plane: PLANE, local: { "cs-theme": "light" } });
  assert.equal(q.doc.documentElement.getAttribute("data-theme"), "light");
  for (const r of [...p.requests, ...q.requests]) assert.doesNotMatch(JSON.stringify(r), /theme/);
});

test("R14 (K3302 (4)) a section's explanation is its word escaped once: data-tip holds the word as HTML, and the opened explanation reads the word exactly (an apostrophe, an ampersand and a bracket among it)", async () => {
  const { boot: b } = await import("./harness.mjs");
  const s = { id: "home", words: [["screen.home.t.x", "X", false], ["screen.home.t.x.holds", "Don't wait & see <now>", false]], reads: () => ({}), acts: [], render: (cs) => cs.sec("screen.home.t.x", "<p>y</p>") };
  const p = await b({ screens: [s] });
  const h2 = p.root().querySelector("section > h2");
  assert.equal(h2.getAttribute("data-tip"), "Don&#39;t wait &amp; see &lt;now&gt;", "the attribute holds the word's HTML, once");
  h2.focus();
  await p.settle();
  assert.equal(p.doc.getElementById("cs-tip").textContent, "Don't wait & see <now>", "the explanation drawn reads the word exactly");
});
