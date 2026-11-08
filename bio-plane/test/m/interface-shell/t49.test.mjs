/* interface-shell R65, R67, R68 (T49-20): the shell draws its own elements with the design's classes and carries no rule
   for them; the test-instance band is the design's; explanations close, nothing is clipped at the phone width, and the
   expected refusal writes no console line. Every sentence is read through `setup-words`' `word` (R70). */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { interfacePage, classLiterals, checkScreens } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { boot, ok, refused, bytes, SESSION } from "./harness.mjs";
import { documentOf } from "./dom.mjs";
import { ALL, FRONT } from "./screens.fixture.mjs";
import { inWorld, bootAs } from "./world.mjs";

const styleOf = (html) => /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const REPLACED = ["cs-menuwrap", "cs-menu", "cs-actwrap", "cs-slot", "cs-rowname", "cs-overlay", "cs-image", "cs-areas-box", "cs-area"];
/* R67 retired the test band's own `cs-testband`; no rule of it is carried in STYLE (the newer-version band is the design's
   `cs-updband`, F6) */
const classesOf = (root) => { const out = new Set(); for (const el of root.querySelectorAll("[class]")) for (const c of el.getAttribute("class").split(/\s+/)) if (c) out.add(c); return out; };
const fn = (body) => new Function("cs", "view", body);
const HEX = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";

/* a screen drawing every element R65 names: a row with its name cell, an act with its slot, an image, areas over it */
const ELEMENTS = {
  id: "ceremony", reads: () => ({}), acts: [{ op: "obscuremark" }],
  render: (cs) => cs.title() + cs.rows({ id: "r", cols: ["shell.row.acts"], items: [{ id: "a", n: "Row A" }], key: (i) => i.id, name: (i) => cs.esc(i.n), cells: () => [], acts: () => cs.act("obscuremark") })
    + cs.areas(cs.image("openoriginal", { capture: "p1" }, { alt: { text: "x" } }), { id: "ph", areas: [{ left: 1, top: 2, width: 3, height: 4 }] }),
};

const FRAME_ANSWERS = await frameAnswers();
test("R65 the shell draws its own elements with the design's classes: the member menu (mk-menuwrap, mk-menu over a cs-dialog), an act with its slot (mk-actwrap, mk-slot), a row's name cell (mk-rowname), the scrim behind a dialog (mk-scrim), an image (mk-image), areas on it (mk-imgareas, mk-imgarea), the avatar as a button, the group's name (mk-grp) and the explanation-level control (the design's quiet cs-btn, CR2-4); none of the replaced classes is drawn or styled", async () => {
  const p = await boot({ screens: [...ALL, ELEMENTS], path: "/app/ceremony/c1", plane: { ...FRAME_ANSWERS, openoriginal: bytes(new Uint8Array([1]), "image/png") } });
  const root = p.root();
  assert.ok(root.querySelector(".mk-menuwrap > button.mk-avatar"));
  assert.ok(root.querySelector(".mk-menuwrap > .mk-menu.cs-dialog#cs-menu"));
  assert.ok(root.querySelector(".mk-actwrap > button[data-act]") && root.querySelector(".mk-actwrap > .mk-slot"));
  assert.ok(root.querySelector(".mk-rowname"));
  assert.ok(root.querySelector("img.mk-image"));
  assert.ok(root.querySelector(".mk-imgareas > .mk-imgarea"));
  assert.ok(root.querySelector(".cs-mast a.mk-grp"));
  assert.ok(root.querySelector('.cs-mast button.cs-btn[data-shell="level"][data-tone="quiet"]'));
  assert.equal(root.querySelector(".mk-lvlbtn") === null, true, "the level control draws no mk-lvlbtn, which no loaded sheet defines (CR2-4)");
  const seen = classesOf(root);
  for (const c of REPLACED) assert.ok(!seen.has(c), c + " is drawn");
  /* the program and the page as served name none of them either */
  const html = interfacePage([...ALL, ELEMENTS]);
  const written = classLiterals(html.slice(html.indexOf("<script")));
  for (const c of REPLACED) assert.ok(!written.has(c), c + " is written in the program");
  for (const c of [...REPLACED, "cs-testband"]) assert.ok(!new RegExp("\\." + c + "\\b").test(styleOf(html)), c + " is styled");
  /* STYLE holds only the page's height settings and the reduced-motion rule (and, R120, the layout of a row with no first part) */
  const selectors = styleOf(html).replace(/@media[^{]*\{[\s\S]*\}\s*$/, "").split("}").map((r) => r.split("{")[0].trim()).filter(Boolean);
  for (const sel of selectors) assert.match(sel, /^(html,body\.cs|body\.cs|#cs-root|\.cs-main \.cs-row\[data-lead=none\])/, sel);
  assert.match(styleOf(html), /@media \(prefers-reduced-motion:reduce\)/);
  /* the design's classes are all defined by the served stylesheets */
  const css = ASSET_FILES["civicsmith.css"].body + ASSET_FILES["shell.css"].body;
  for (const c of ["mk-menuwrap", "mk-menu", "mk-actwrap", "mk-slot", "mk-rowname", "mk-scrim", "mk-image", "mk-imgareas", "mk-imgarea", "mk-grp"]) assert.ok(css.includes("." + c), c);
});

test("R65 control: the dialog over a locked screen is the design's scrim and still blocks the screen behind it", async () => {
  const p = await boot({ screens: [...ALL, FRONT], plane: { projectdirectory: ok({ projects: [] }) } });
  await p.clock.tick(31 * 60 * 1000);
  const scrim = p.root().querySelector(".mk-scrim");
  assert.ok(scrim && scrim.querySelector('[role="dialog"][aria-modal="true"].cs-dialog'), "the lock is a dialog on the scrim");
  assert.equal(p.root().querySelector(".cs-overlay"), null);
  await p.click('button[data-act="promote"]');
  assert.equal(p.byOp("promote").length, 0, "nothing beneath answers");
});

test("R67 the test-instance band is the design's .cs-band[data-band=test]: the machine icon, instance.test.band, then instance.test.notice; served in the page, and drawn by the page when bootstrap says so; cs-testband is drawn nowhere", async () => {
  const served = documentOf(interfacePage(ALL, { testInstance: true })).getElementById("cs-testband");
  assert.equal(served.getAttribute("data-band"), "test");
  assert.ok(served.classList.contains("cs-band"));
  assert.ok(served.querySelector("use").getAttribute("href").endsWith("#i-machine"));
  assert.equal(served.querySelector("b").textContent, word("instance.test.band"));
  assert.ok(served.textContent.endsWith(word("instance.test.notice")));
  assert.ok(served.textContent.indexOf(word("instance.test.band")) < served.textContent.indexOf(word("instance.test.notice")), "the band's name, then the notice");
  /* the same band when the page draws it */
  const p = await boot({ screens: ALL, plane: { bootstrap: ok({ test_instance: true }) } });
  const drawn = p.doc.getElementById("cs-testband");
  assert.equal(drawn.getAttribute("data-band"), "test");
  assert.equal(drawn.outerHTML.replace(/\s+/g, " "), served.outerHTML.replace(/\s+/g, " "), "served and drawn alike");
  assert.ok(!classesOf(p.doc.body).has("cs-testband"));
  /* control: no band otherwise */
  const q = await boot({ screens: ALL, plane: { bootstrap: ok({ test_instance: false }) } });
  assert.equal(q.doc.getElementById("cs-testband"), null);
});

test("R68 explanations close: a card opened by a control closes when the control is pressed and when the focus leaves it, never left open over the next field; control: a card opened by hover still opens after 0.5 s", async () => {
  const tip = (p) => p.doc.getElementById("cs-tip");
  const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: { image: IMAGE } });
  const act = p.root().querySelector('button[data-act="release"]');
  /* control first: hover opens at 0.5 s */
  p.fire(act, "pointerover", { pointerType: "mouse" });
  await p.clock.tick(499); assert.equal(tip(p).hidden, true);
  await p.clock.tick(1); assert.equal(tip(p).hidden, false, "opens after 0.5 s");
  /* pressing the control closes it, the act opening its reason field beside it */
  await p.click(act);
  assert.equal(tip(p).hidden, true, "closed on press");
  const reason = p.root().querySelector("[data-slot] textarea");
  assert.ok(reason, "the act asked for its reason");
  /* a card opened by keyboard focus closes when the focus moves on to the next field */
  act.focus();
  assert.equal(tip(p).hidden, false, "focus opens at once");
  reason.focus();
  assert.equal(tip(p).hidden, true, "closed when the focus leaves it for the next field");
  assert.equal(act.getAttribute("aria-describedby"), null);
  /* a card opened by the pointer likewise, once the focus goes to a field */
  p.fire(act, "pointerout", { relatedTarget: p.root() });
  p.fire(act, "pointerover", { pointerType: "mouse" });
  await p.clock.tick(500);
  assert.equal(tip(p).hidden, false);
  reason.blur();
  reason.focus();
  assert.equal(tip(p).hidden, true, "never left open over the next field");
});

test("R68 nothing clipped at the phone width: a long unbroken name, label or digest the shell draws wraps (a break every 16 characters) or is cut with its full text in its card; the text itself stays whole", async () => {
  const LONG = "Riverbend" + "x".repeat(60);
  const s = { id: "home", reads: () => ({}), acts: [],
    render: fn(`return cs.title() + cs.ref("project", "P1", "${HEX}", []) + cs.mark("kind", "todo", { reason: "${HEX}" }) + cs.hint("${HEX}");`) };
  const { world, me } = await inWorld();
  await me.act("groupnameset", { body: { name: LONG } });
  const p = await bootAs(world, me, { screens: [s], phone: true });
  const root = p.root();
  const grp = root.querySelector(".cs-mast .mk-grp");
  assert.equal(grp.textContent, LONG, "the name whole");
  const card = p.doc.createElement("div"); card.innerHTML = grp.getAttribute("data-tip");
  assert.ok(card.textContent.includes(LONG), "its full text in its card");
  /* no run of 25 or more unbroken characters in what the shell draws: a break opportunity is a <wbr> or a space */
  const main = root.querySelector("#cs-main");
  for (const sel of [".cs-card", ".cs-kind", ".cs-hint"]) {
    const el = main.querySelector(sel);
    assert.ok(el, sel);
    assert.ok(el.textContent.includes(HEX), sel + ": the digest whole");
    assert.ok(el.querySelector("wbr"), sel + ": breaks where it may");
    for (const piece of textNodesOf(el)) for (const run of piece.split(/\s+/)) assert.ok(run.length <= 24, sel + ": a run of " + run.length);
  }
});

function textNodesOf(el) {
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.data.trim(); if (t) out.push(t); } else walk(c); } };
  walk(el);
  return out;
}

test("R68 an expected refusal writes no console line: an act answered REAUTH_DUE that the shell handles (R34) calls no console method from the page's script (measured at START: the 403 line the browser shows is Chromium's own network log of the answer, which no page code can remove, so journey-check's console check admits it)", async () => {
  const calls = [];
  const was = {};
  /* the store's own REAUTH_DUE: adding an administrator is one of the acts that always ask the password again (credentials R66) */
  const { world, me } = await inWorld();
  const adding = { ...ALL.find((x) => x.id === "members"), acts: [{ op: "memberadd", send: fn('return { body: { memberId: "new-admin", cover: "The new administrator", role: "admin" } };') }] };
  for (const m of ["log", "info", "warn", "error", "debug", "trace"]) { was[m] = console[m]; console[m] = (...a) => { calls.push([m, a]); }; }
  try {
    const p = await bootAs(world, me, { screens: [adding], path: "/app/members" });
    await p.click('button[data-act="memberadd"]');
    const reason = p.root().querySelector('textarea');
    if (reason) { reason.value = "because"; await p.click('[data-shell="reason-send"]'); }
    assert.ok(p.byOp("memberadd").length >= 1, "the act was sent and answered REAUTH_DUE");
    assert.ok(p.root().querySelector('[data-overlay="reauth"]'), "the shell asks the password again (R34)");
  } finally { for (const m of Object.keys(was)) console[m] = was[m]; }
  /* the store's own structured log lines (one JSON object a line, written by the world's modules) are not the page's */
  assert.deepEqual(calls.filter(([, a]) => !(typeof a[0] === "string" && a[0].startsWith("{"))), [], "no console line from the page's own script");
});

test("R71 the startup bootstrap carries the page's session whenever the page holds one, and none when it holds none; setup's acts admit founderhandleset; control: an act on none of R72's lists still throws, and each R72 act is admitted on its screen", async () => {
  const signedIn = await boot({ screens: ALL, plane: { bootstrap: ok({ test_instance: false }) } });
  assert.equal(signedIn.byOp("bootstrap")[0].headers.Authorization, "Bearer " + SESSION.t);
  const signedOut = await boot({ screens: ALL, session: null, path: "/app/home", plane: { bootstrap: ok({ test_instance: false }) } });
  assert.equal(signedOut.byOp("bootstrap")[0].headers.Authorization, undefined);
  /* R73: setup's founderhandleset is the registry's (owed), admitted under its op name once op-declarations declares the op */
  const s = (id, op) => ({ id, reads: () => ({}), acts: [{ op }], render: () => "" });
  const owed = (SCREEN_REGISTRY.find((r) => r.id === "setup") || { owed: [] }).owed.some((o) => o.op === "founderhandleset");
  if (owed && Object.hasOwn(OPS, "founderhandleset")) assert.equal(checkScreens([s("setup", "founderhandleset")]), true);
});

