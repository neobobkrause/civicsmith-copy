/* interface-shell R73–R89 (T50-27): the design's registry, the act button's answer and Sounds, the member menu, the header
   button and the phone masthead, the weight mark only above Reversible, streamed answers, addresses outside the team's
   pages, `cs.checks` over record data, more doors, explanations by the design's keys, a refusal in its own words, the look
   rows, the first load, a Reasoned act's reason, the public frame's cards, the phone layout. Every sentence is read through
   `setup-words`' `word` (R70); a test holds no English. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { interfacePage, interfaceScript, checkScreens, RE_POINTS, REF_SCREENS, SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { RUNGS, RUNG_ABSENT, IRREVERSIBLE_WEIGHT } from "../../../src/op-grades/index.mjs";
import { OPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { feedWithItem } from "../queue/fixtures.mjs";
import { fitSend, boot, ok, refused, httpError, ndjson, pending, settle, MEMBER, ADMIN, SESSION, STORE_KEY, served, scriptOf } from "./harness.mjs";
import { inWorld, bootAs, doorAs } from "./world.mjs";
import { ALL, HOME, HELD, DOORBELL, PUBLISHED } from "./screens.fixture.mjs";

const h = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const btn = (p, op) => p.root().querySelector(`button[data-act="${op}"]`);
const gate = () => { let go; const p = new Promise((r) => { go = r; }); return { p, go }; };
const stand = (id, ops, render, extra = {}) => ({ id, reads: () => ({}), acts: ops.map((op) => ({ op, send: fitSend(op) })), render, ...extra });
const audio = (p) => {
  const made = [];
  p.win.AudioContext = class { constructor() { this.destination = {}; this.currentTime = 0; }
    createOscillator() { const o = { frequency: {}, connect() {}, start() { made.push(o.frequency.value); }, stop() {} }; return o; }
    createGain() { return { gain: {}, connect() {} }; } };
  return made;
};

/* ---------- R73 ---------- */

test("R73 the registry is the design's: RE_POINTS holds only the named exception and none the registry lists; every act of the nine screen modules' real SCREENS composes; a stand-in naming an op neither lists throws; RE_POINTS is not consulted for an op the registry lists", async () => {
  /* R117 (fix round 3) named two more re-points, which G53 (fix round 6) removed: the registry lists both now */
  assert.deepEqual(RE_POINTS, { explore: ["stepsourcewithdraw"], document: ["readheld", "resolve"], person: ["linecurrentthrough"], setup: ["factconfirm"], question: ["leggrade"], queue: ["signerknown"] });
  for (const [id, ops] of Object.entries(RE_POINTS)) for (const op of ops) {
    const reg = SCREEN_REGISTRY.find((r) => r.id === id);
    assert.ok(reg, id + " is a registry screen");
    assert.ok(!reg.acts.includes(op) && !(reg.owed || []).some((o) => o.op === op), id + " " + op + " is listed by the registry, so it must leave RE_POINTS");
  }
  const mods = ["screens-entry", "screens-wizards", "screens-settings", "screens-intake", "screens-daily", "screens-inquiry", "screens-investigate", "screens-publish", "screens-action"];
  const screens = []; let guide = null;
  for (const m of mods) { const x = await import(`../../../src/${m}/index.mjs`); screens.push(...x.SCREENS); if (x.GUIDE) guide = x.GUIDE; }
  assert.equal(checkScreens(screens), true, "every act of the nine modules' screens is admitted");
  assert.ok(interfaceScript(screens, { guide }).length > 100000);
  const r = (id, ...ops) => ({ id, render: () => "", acts: ops.map((op) => ({ op })) });
  /* control: an op the registry lists on a screen is admitted whatever RE_POINTS holds; one neither lists throws, naming the screen */
  const reg = SCREEN_REGISTRY.find((s) => s.id === "queue");
  assert.equal(checkScreens([r("queue", reg.acts[0])]), true);
  assert.throws(() => checkScreens([r("queue", "stepsourcewithdraw")]), /queue.*stepsourcewithdraw/);
  assert.throws(() => checkScreens([r("ceremony", "ratify")]), /ceremony.*ratify/);
  /* an owed act is admitted under its op name */
  const owed = SCREEN_REGISTRY.flatMap((s) => (s.owed || []).map((o) => [s.id, o.op])).find(([, op]) => Object.hasOwn(OPS, op));
  if (owed) assert.equal(checkScreens([r(owed[0], owed[1])]), true, owed.join(" "));
});

/* ---------- R74 ---------- */

test("R74 an act button answers the press: busy while the request is out, a second press ignored, one polite live region says shell.working; done after success (cleared after about two seconds on the page clock for a Reversible act); a refusal clears busy and done and leaves the button usable; a read carries no data-done and a screen's own button is untouched", async () => {
  const go = gate();
  let n = 0;
  const doc = stand("document", ["cite"], (cs) => cs.act("cite") + '<button type="button" id="own">own</button>');
  const p = await boot({ screens: [doc], path: "/app/document/x", plane: { cite: async () => { n++; await go.p; return ok({}); } } });
  const live = () => p.doc.getElementById("cs-live");
  assert.equal(live().getAttribute("aria-live"), "polite");
  await p.click(btn(p, "cite"));
  assert.equal(btn(p, "cite").getAttribute("aria-busy"), "true");
  assert.equal(live().textContent, word("shell.working"));
  await p.click(btn(p, "cite"));
  assert.equal(n, 1, "a second press is ignored while the request is out");
  go.go(); await p.settle();
  assert.equal(btn(p, "cite").getAttribute("aria-busy"), null);
  assert.ok(btn(p, "cite").hasAttribute("data-done"), "done after success");
  assert.ok(!btn(p, "cite").hasAttribute("disabled"), "a Reversible act stays usable");
  assert.equal(live().textContent, "");
  await p.clock.tick(1900);
  assert.ok(btn(p, "cite").hasAttribute("data-done"), "still done before two seconds");
  await p.clock.tick(300);
  assert.ok(!btn(p, "cite").hasAttribute("data-done"), "cleared after about two seconds of the page clock");
  assert.equal(p.doc.getElementById("own").getAttribute("aria-busy"), null, "a screen's own button is untouched");
  assert.equal(p.doc.getElementById("own").hasAttribute("data-done"), false);
  /* a refusal clears busy and done, and leaves the button usable */
  const q = await boot({ screens: [doc], path: "/app/document/x", plane: { cite: refused("ZZ_REFUSED", "No.") } });
  await q.click(btn(q, "cite"));
  assert.equal(btn(q, "cite").getAttribute("aria-busy"), null);
  assert.ok(!btn(q, "cite").hasAttribute("data-done"));
  assert.ok(q.root().querySelector('[data-slot="m:0"] [data-gap="refused"]'));
  await q.click(btn(q, "cite"));
  assert.equal(q.byOp("cite").length, 2, "usable again");
  /* control: a read (R11's running-on-press arm) carries no data-done */
  const fin = stand("finder", ["search"], (cs) => cs.act("search"));
  const r = await boot({ screens: [fin], path: "/app/finder", plane: { search: ok({ results: [] }) } });
  await r.click(btn(r, "search"));
  assert.equal(r.byOp("search").length, 1);
  assert.ok(!btn(r, "search").hasAttribute("data-done") && btn(r, "search").getAttribute("aria-busy") === null);
});

test("R74 a Terminal, Signed, Irreversible or outward act is disabled after success and stays so until the screen is redrawn from a read", async () => {
  let hold = null;
  const doc = { id: "document", reads: () => ({ x: { op: "image" } }), acts: [{ op: "retire", send: fitSend("retire") }, { op: "release", outward: true, send: fitSend("release") }], render: (cs) => cs.act("retire") + cs.act("release") };
  const p = await boot({ screens: [doc], path: "/app/document/x", plane: { image: async () => { if (hold) await hold.p; return ok({ title: "t" }); }, retire: ok({}), release: ok({}) } });
  hold = gate();
  await p.click(btn(p, "retire"));
  await p.click('[data-shell="confirm"]');
  assert.equal(p.byOp("retire").length, 1);
  assert.ok(btn(p, "retire").hasAttribute("disabled"), "disabled after success");
  assert.ok(btn(p, "retire").hasAttribute("data-done"));
  await p.clock.tick(5000);
  assert.ok(btn(p, "retire").hasAttribute("disabled"), "stays disabled, whatever the clock");
  hold.go(); await p.settle();
  assert.ok(!btn(p, "retire").hasAttribute("disabled"), "enabled once a read has redrawn the screen");
  /* an outward act, Reasoned: the same */
  hold = gate();
  await p.click(btn(p, "release"));
  p.root().querySelector("textarea").value = "because";
  await p.click('[data-shell="reason-send"]');
  assert.equal(p.byOp("release").length, 1);
  assert.ok(btn(p, "release").hasAttribute("disabled"), "an outward act is disabled after success");
  hold.go(); await p.settle();
  assert.ok(!btn(p, "release").hasAttribute("disabled"));
});

test("R74 the Sounds setting is off for a new member and kept on the device, never sent; with it on a press plays a soft click and a refusal beside an act a low tone, made in the page; with it off nothing sounds; cs.sounds draws the control", async () => {
  const doc = stand("document", ["cite"], (cs) => cs.act("cite") + cs.sounds());
  const plane = { cite: () => (plane.refuse ? refused("ZZ_REFUSED", "No.") : ok({})) };
  const p = await boot({ screens: [doc], path: "/app/document/x", plane });
  const made = audio(p);
  const group = p.root().querySelector('[aria-label="' + h(word("screen.account.sounds")) + '"]');
  assert.ok(group, "the control is drawn by the kit");
  assert.deepEqual(group.querySelectorAll("button").map((b) => b.textContent), [word("screen.account.sounds.on"), word("screen.account.sounds.off")]);
  assert.equal(group.querySelector('[data-sounds-to="off"]').getAttribute("aria-pressed"), "true", "off for a new member");
  assert.equal(group.getAttribute("data-tip"), h(word("screen.account.sounds.help")));
  await p.click(btn(p, "cite"));
  assert.equal(made.length, 0, "off: nothing sounds");
  await p.click('[data-sounds-to="on"]');
  assert.equal(p.local.get("cs-sounds"), "on");
  made.length = 0;
  await p.click(btn(p, "cite"));
  assert.deepEqual(made.length, 1, "a press asks the page's audio once");
  assert.ok(made[0] > 400, "a soft click");
  made.length = 0;
  plane.refuse = true;
  await p.click(btn(p, "cite"));
  assert.equal(made.length, 2, "the press, then the refusal");
  assert.ok(made[1] < 300, "a low tone");
  await p.click('[data-sounds-to="off"]');
  made.length = 0;
  await p.click(btn(p, "cite"));
  assert.equal(made.length, 0);
  assert.equal(p.local.get("cs-sounds"), "off");
  for (const r of p.requests) assert.doesNotMatch(JSON.stringify(r), /sounds/, "never sent");
  /* kept on the device: a new load with it on */
  const q = await boot({ screens: [doc], path: "/app/document/x", local: { "cs-sounds": "on" }, plane: { cite: ok({}) } });
  const madeQ = audio(q);
  await q.click(btn(q, "cite"));
  assert.equal(madeQ.length, 1);
  /* R2: no sound file and no other origin */
  assert.doesNotMatch(p.html, /\.(mp3|ogg|wav)|<audio/i);
});

/* ---------- R75 ---------- */

const ACCOUNT = { id: "account", reads: () => ({}), acts: [], render: (cs) => cs.title() };

const FRAME_ANSWERS = await frameAnswers();
test("R75 the member's initial opens Your menu by the design's keys: who is signed in, a link to account, sign out (explained by shell.menu.signout_does, sending signout), the appearance control; the question after the first month is one note at the top of Home, asked once; the password dialog reads session.reauth.*", async () => {
  const p = await boot({ screens: [...ALL, ACCOUNT], plane: FRAME_ANSWERS });
  await p.click('[data-shell="menu"]');
  const menu = p.root().querySelector("#cs-menu");
  assert.ok(!menu.hidden);
  assert.equal(menu.querySelector("h2").textContent, word("shell.menu.name"));
  assert.equal(menu.querySelector("h2").getAttribute("data-tip"), h(word("shell.menu.says")));
  assert.ok(menu.textContent.includes(word("shell.menu.who", { name: "River Town", handle: "mai" })));
  const account = menu.querySelector('a[href="/app/account"]');
  assert.equal(account.textContent, word("shell.menu.account"));
  const out = menu.querySelector('[data-shell="signout"]');
  assert.equal(out.textContent, word("shell.menu.signout"));
  assert.equal(out.getAttribute("data-tip"), h(word("shell.menu.signout_does")));
  assert.equal(menu.querySelectorAll('[data-shell="theme"]').length, 3, "R18's appearance control");
  await p.click(out);
  assert.equal(p.byOp("signout").length, 1);
  assert.equal(p.local.get(STORE_KEY), undefined);
  /* the question: Home only, once, of a member whose level is the default; the answers sent with asked: true */
  const MONTH = 31 * 24 * 3600 * 1000;
  const first = { "cs-first:mai": String(Date.now() - MONTH) };
  const q = await boot({ screens: [...ALL, ACCOUNT], local: first });
  assert.equal(q.root().querySelector("#cs-main").children[0].getAttribute("data-level-note"), "ask");
  assert.equal(q.root().querySelector('[data-level-note="ask"] p').textContent, word("level.keep.ask"));
  await q.click('[data-level-to="pause"]');
  assert.deepEqual(q.byOp("infolevelset")[0].body, { level: "pause", asked: true });
  assert.equal(q.root().querySelector('[data-level-note="later"] p').textContent, word("level.keep.later"));
  assert.equal(q.root().querySelector('[data-level-note="ask"]'), null, "either answer closes it for good");
  const again = await boot({ screens: [...ALL, ACCOUNT], local: Object.fromEntries(q.local) });
  assert.equal(again.root().querySelector('[data-level-note]'), null);
  const other = await boot({ screens: [...ALL, ACCOUNT], path: "/app/account", local: first });
  assert.equal(other.root().querySelector('[data-level-note]'), null, "no other screen asks");
  /* the dialog: headed session.reauth.head, says session.reauth, Go on and Cancel explained; a wrong password resends nothing */
  /* the store's own REAUTH_DUE (adding an administrator always asks the password again) and its own refusal of a wrong password */
  const { world, me } = await inWorld();
  const adding = { ...ALL.find((x) => x.id === "members"), acts: [{ op: "memberadd", send: new Function("view", "el", "cs", 'return { body: { memberId: "new-admin", cover: "The new administrator", role: "admin" } };') }] };
  const r = await bootAs(world, me, { screens: [adding], path: "/app/members" });
  await r.click(btn(r, "memberadd"));
  const reason = r.root().querySelector('[data-slot="m:0"] textarea');
  if (reason) { reason.value = "because"; await r.click('[data-shell="reason-send"]'); }
  const dlg = r.root().querySelector('[data-overlay="reauth"]');
  assert.equal(dlg.querySelector("h2").textContent, word("session.reauth.head"));
  assert.equal(dlg.querySelector("p").textContent, word("session.reauth"));
  assert.equal(dlg.querySelector('[data-shell="reauth"]').textContent, word("session.reauth.go"));
  assert.equal(dlg.querySelector('[data-shell="reauth"]').getAttribute("data-tip"), h(word("session.reauth.go_does")));
  assert.equal(dlg.querySelector('[data-shell="reauth-cancel"]').getAttribute("data-tip"), h(word("session.reauth.cancel_does")));
  r.doc.getElementById("cs-reauth-pw").value = "wrong";
  await r.click('[data-shell="reauth"]');
  assert.equal(r.root().querySelector("[data-overlay-refusal]").textContent, word("session.reauth.wrong"));
  assert.equal(r.byOp("memberadd").length, 1, "a wrong password resends nothing");
  await r.click('[data-shell="reauth-cancel"]');
  assert.equal(r.root().querySelector('[data-overlay="reauth"]'), null);
  assert.equal(r.byOp("memberadd").length, 1, "Cancel sends nothing");
  assert.equal(r.byOp("reauth").length, 1);
});

/* ---------- R76 ---------- */

test("R76 the masthead's explanations button names itself and its setting (shell.level.button.prompt / .pause); at the phone width every masthead icon keeps its accessible name, shown on a tap, and the team's name wraps whole; a button's explanation never repeats its label or the sentence beside it; control: at 1280 px the labels are drawn", async () => {
  const LONG = "The Neighbourhood Association of the River Town Flats";
  const { world, me } = await inWorld();
  await me.act("groupnameset", { body: { name: LONG } });
  const p = await bootAs(world, me, { screens: ALL, phone: true, plane: { assistantstate: ok({ on: true }), accountreference: ok({ held: true }) } });
  const mast = p.root().querySelector(".cs-mast");
  assert.equal(mast.querySelector(".mk-grp").textContent, LONG, "the name complete, never cut");
  const lvl = mast.querySelector('[data-shell="level"]');
  assert.equal(lvl.getAttribute("aria-label"), word("shell.level.button.prompt"));
  await p.click(lvl);
  assert.equal(p.root().querySelector('.cs-mast [data-shell="level"]').getAttribute("aria-label"), word("shell.level.button.pause"));
  for (const el of p.root().querySelectorAll('.cs-mast a.mk-mastsearch, .cs-mast [data-shell="level"], .cs-mast [data-shell="dock"], .cs-mast button.mk-avatar')) {
    const name = el.getAttribute("aria-label");
    assert.ok(name && name.trim(), "an accessible name: " + el.outerHTML.slice(0, 80));
    assert.ok(String(el.getAttribute("data-tip") || "").startsWith("<b>" + name), "shown on a tap: " + name);
  }
  assert.ok(!/white-space:\s*nowrap/.test(((r) => r ? r[0] : "")(/\.mk-grp[^}]*\}/.exec(ASSET_FILES["shell.css"].body))), "the design's own rule lets the name wrap onto a second line (K4084)");
  /* no explanation of an act button equals its label or the sentence drawn beside it */
  for (const path of ["/app", "/app/document/c1", "/app/held"]) {
    const q = await boot({ screens: ALL, path, plane: { image: ok({ title: "A lease", pages: 1, grade: "B", why: "w", project: { id: "P1", title: "P" }, passages: [] }), heldcaptures: ok({ items: [{ id: "h1", title: "T", at: "2026-10-01" }] }) } });
    for (const b of q.root().querySelectorAll("button[data-act]")) {
      const tip = b.getAttribute("data-tip");
      if (!tip) continue;
      const text = (s) => { const d = q.doc.createElement("div"); d.innerHTML = s; return d.textContent.trim(); };
      assert.notEqual(text(tip), b.textContent.replace(b.querySelector(".w") ? b.querySelector(".w").textContent : "", "").trim(), "not its label");
      const next = b.parentElement && b.parentElement.nextElementSibling;
      if (next) assert.notEqual(text(tip), next.textContent.trim(), "nor its neighbour's text");
    }
  }
  /* control: at 1280 px the labels are drawn */
  const w = await boot({ screens: ALL, plane: FRAME_ANSWERS });
  assert.equal(w.root().querySelector('[data-shell="level"] .mk-hide-phone').textContent, word("shell.level.button.prompt"));
  assert.equal(w.root().querySelector('.mk-mastsearch').textContent, word("shell.search"));
});

/* ---------- R77 ---------- */

test("R77 the weight mark only above Reversible: a Reversible act draws no dots and no weight name on its button or in its explanation; the dots' sentence is said once, the first time a marked button's explanation opens, kept on the device; public pages carry no weight marks; control: a Reasoned act still asks its reason", async () => {
  const doc = stand("document", ["cite", "release", "retire"], (cs) => cs.act("cite") + cs.act("release") + cs.act("retire"));
  const p = await boot({ screens: [doc], path: "/app/document/x" });
  const cite = btn(p, "cite");
  assert.equal(cite.querySelector(".w"), null);
  assert.equal(cite.querySelectorAll(".cs-pips").length, 0);
  assert.ok(!String(cite.getAttribute("data-tip")).includes(h(word("weight.reversible.name"))));
  assert.ok(!String(cite.getAttribute("data-tip")).includes(h(word("weight.reversible.means"))));
  const tip = () => p.doc.getElementById("cs-tip");
  btn(p, "release").focus();
  assert.ok(tip().innerHTML.includes(h(word("weight.dots.means"))), "said the first time a marked button's explanation opens");
  assert.equal(p.local.get("cs-dots-said"), "1", "kept on the device");
  btn(p, "release").blur();
  btn(p, "retire").focus();
  assert.ok(!tip().innerHTML.includes(h(word("weight.dots.means"))), "not drawn again on any button");
  assert.ok(tip().innerHTML.includes(h(word("weight.terminal.means"))), "the button's own weight is still explained");
  const q = await boot({ screens: [doc], path: "/app/document/x", local: { "cs-dots-said": "1" } });
  btn(q, "release").focus();
  assert.ok(!q.doc.getElementById("cs-tip").innerHTML.includes(h(word("weight.dots.means"))));
  /* public pages carry no weight marks; the doorbell's button is plain */
  const d = await boot({ screens: [DOORBELL], path: "/app/doorbell", session: null });
  assert.equal(btn(d, "knock").querySelector(".w"), null);
  /* control: a Reasoned act still asks its reason */
  await p.click(btn(p, "release"));
  assert.ok(p.root().querySelector('[data-slot="m:1"] textarea'));
  assert.equal(p.byOp("release").length, 0);
});

/* ---------- R78 ---------- */

/* a streamed body whose lines arrive two seconds apart on the page's clock */
const streamed = (p, lines, type = "application/x-ndjson") => async () => {
  const enc = new TextEncoder();
  let i = 0;
  return { status: 200, ok: true, headers: { get: (k) => (k.toLowerCase() === "content-type" ? type : null) },
    body: { getReader: () => ({ read: async () => { if (i >= lines.length) return { done: true }; const line = lines[i++]; await new Promise((r) => p.clock.setTimeout(r, 2000)); return { done: false, value: enc.encode(typeof line === "string" ? line : JSON.stringify(line) + "\n") }; } }) },
    text: async () => lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") };
};
const ASKER = {
  id: "answers", reads: () => ({}),
  acts: [{ op: "ask", reasonField: "question", send: (view, el, cs) => ({ body: { question: cs.value("question") }, onEvent: (ev) => { window.__seen = (window.__seen || []).concat([ev]); } }),
    done(view, answer, cs) { window.__whole = answer.length; cs.set("n", String(answer.length)); } }],
  render: (cs) => cs.field("question", "shell.reason") + cs.act("ask") + '<p id="n">' + String((window.__seen || []).length) + "</p>",
};

test("R78 a streamed answer is handed on as it arrives: onEvent is called with each complete line at the instant it arrives, in order, the screen redrawn at each; the promise still answers the whole list, the answer the last; control: an ok:false last line is still a refusal beside the act, and a body that is not ndjson is read whole", async () => {
  const p = await boot({ screens: [ASKER], path: "/app/answers" });
  const real = p.win.fetch;
  p.win.fetch = (url, init) => (new URL(url, "https://x").searchParams.get("op") === "ask" ? streamed(p, [{ event: "a" }, { event: "b" }, { ok: true, answer: "c" }])() : real(url, init));
  p.doc.getElementById("question").value = "why";
  await p.click(btn(p, "ask"));
  const seen = () => (p.win.__seen || []).length;
  assert.equal(seen(), 0);
  await p.clock.tick(2000); assert.equal(seen(), 1, "the first line at two seconds, before the body ends");
  assert.equal(p.doc.getElementById("n").textContent, "1", "the screen redrawn as it arrives");
  await p.clock.tick(2000); assert.equal(seen(), 2);
  assert.equal(p.doc.getElementById("n").textContent, "2");
  await p.clock.tick(2000); await p.settle(); assert.equal(seen(), 3);
  assert.deepEqual(p.win.__seen.map((e) => e.event || e.answer), ["a", "b", "c"], "in order");
  assert.equal(p.win.__whole, 3, "the promise answers the whole list, the answer the last");
  /* control: an ok:false last line is a refusal drawn beside the act (R13) */
  const q = await boot({ screens: [ASKER], path: "/app/answers" });
  const realQ = q.win.fetch;
  // fixtures-generic: ZZ_STOP
  q.win.fetch = (url, init) => (new URL(url, "https://x").searchParams.get("op") === "ask" ? streamed(q, [{ event: "a" }, { ok: false, code: "ZZ_STOP", translation: "Stopped." }])() : realQ(url, init));
  q.doc.getElementById("question").value = "why";
  await q.click(btn(q, "ask"));
  await q.clock.tick(2000); await q.clock.tick(2000); await q.settle();
  assert.equal(q.root().querySelector('[data-slot="m:0"] [data-gap="refused"]').textContent, "Stopped.");
  assert.equal(q.doc.getElementById("question").value, "why", "the form keeps what was typed");
  /* control: a body that is not ndjson is read whole */
  const r = await boot({ screens: [ASKER], path: "/app/answers", plane: { ask: ok({ answer: "whole" }) } });
  r.doc.getElementById("question").value = "why";
  await r.click(btn(r, "ask"));
  assert.equal(r.byOp("ask").length, 1);
  assert.equal(r.win.__seen, undefined, "no event for an answer that is not streamed");
  /* the harness's whole-text ndjson answer still reaches done as the list */
  const t = await boot({ screens: [ASKER], path: "/app/answers", plane: { ask: ndjson([{ event: "x" }, { ok: true }]) } });
  t.doc.getElementById("question").value = "why";
  await t.click(btn(t, "ask"));
  assert.equal(t.win.__whole, 2);
});

/* ---------- R79 ---------- */

const TOUR = stand("tour", [], (cs) => cs.title());

test("R79 an address outside the team's pages: a path that is not /, not under /app, not /doorbell and not /tour draws unavailable in the public frame (unavailable.public, a link unavailable.public.go to /) with no session read and no Authorization header; /doorbell and /tour draw their screens in the public frame at that address; control: /app/nonesuch is Nothing is here and / is unchanged", async () => {
  const noAuth = (p) => p.requests.every((r) => r.headers.Authorization === undefined && r.op !== "whoami");
  const u = await boot({ screens: [...ALL, DOORBELL, TOUR], path: "/nonesuch/deeper", session: SESSION });
  assert.equal(u.root().querySelector(".cs-frame").getAttribute("data-frame"), "public");
  assert.equal(u.root().querySelector("#cs-main").textContent.includes(word("unavailable.public")), true);
  assert.equal(u.root().querySelector('#cs-main a[href="/"]').textContent, word("unavailable.public.go"));
  assert.ok(noAuth(u), "no session read, no header, even with a session record held");
  assert.equal(u.root().querySelector("nav.cs-rail, .cs-tabs"), null, "no rail or tabs");
  assert.equal(u.doc.title, word("page.title.public", { page: word("screen.unavailable.name"), team: word("shell.group.unnamed") }));
  const d = await boot({ screens: [...ALL, DOORBELL, TOUR], path: "/doorbell", session: null });
  assert.equal(d.root().querySelector("#cs-main").getAttribute("data-screen"), "doorbell");
  assert.equal(d.root().querySelector(".cs-frame").getAttribute("data-frame"), "public");
  assert.equal(d.location.pathname, "/doorbell", "at that address");
  assert.ok(noAuth(d));
  const t = await boot({ screens: [...ALL, DOORBELL, TOUR], path: "/tour", session: null });
  assert.equal(t.root().querySelector("#cs-main").getAttribute("data-screen"), "tour");
  assert.equal(t.root().querySelector(".cs-frame").getAttribute("data-frame"), "public");
  assert.deepEqual(t.requests.map((r) => r.op).filter((op) => op !== "bootstrap"), [], "the tour sends no request of its own");
  /* control */
  const a = await boot({ screens: ALL, path: "/app/nonesuch" });
  assert.equal(a.root().querySelector("[data-unavailable]").getAttribute("data-unavailable"), "nothing");
  const home = await boot({ screens: ALL, path: "/" });
  assert.equal(home.root().querySelector("#cs-main").getAttribute("data-screen"), "home");
  const front = await boot({ screens: [...ALL, stand("front", [], (cs) => cs.title())], path: "/", session: null });
  assert.equal(front.root().querySelector("#cs-main").getAttribute("data-screen"), "front");
});

/* ---------- R80 ---------- */

test("R80 cs.checks takes its options as words by key or as record data {value, text, on}, text drawn as data and never read as a key; a legend a key or {text}; each box beside its own words; control: an option by key is drawn as before", async () => {
  const s = stand("held", [], (cs) => cs.checks("opts", { text: "Which <b>scenarios</b>?" }, [{ value: "a", text: "shell.search", on: true }, { value: "b", text: "Second <i>one</i>" }, ["c", "shell.cancel", false]]) + cs.checks("kb", "shell.reason", [["x", "shell.confirm", true]]));
  const p = await boot({ screens: [s], path: "/app/held" });
  const f = p.doc.getElementById("opts");
  assert.equal(f.querySelector("legend").textContent, "Which <b>scenarios</b>?", "a legend of data, escaped");
  const boxes = f.querySelectorAll("input");
  assert.deepEqual(boxes.map((b) => b.type), ["checkbox", "checkbox", "checkbox"]);
  assert.deepEqual(f.querySelectorAll("label").map((l) => l.textContent.trim()), ["shell.search", "Second <i>one</i>", word("shell.cancel")], "record data is not read as a key");
  assert.ok(boxes[0].checked && !boxes[1].checked && !boxes[2].checked);
  assert.ok(f.querySelectorAll("label").every((l) => l.querySelector("input")), "a box beside its own words");
  assert.equal(p.doc.getElementById("kb").querySelector("legend").textContent, word("shell.reason"));
  assert.equal(p.doc.getElementById("kb").querySelector("label").textContent.trim(), word("shell.confirm"));
  assert.deepEqual(p.win.document.getElementById("kb").querySelectorAll("input").map((b) => b.checked), [true]);
});

/* ---------- R81, R88 ---------- */

test("R81 R88 more doors: request, matter, action and dash-project open their screens with shell.card.<kind>; theme opens theme with the item's own facts; published (in the public frame, no Authorization) and archive open with shell.card.published and shell.card.archive alone; docket-public is served in the public frame with no session; control: an unknown kind is refused", async () => {
  const KINDS = { request: "request", matter: "matter", action: "action", "dash-project": "dash-project", theme: "theme", published: "published", archive: "archive" };
  for (const [k, id] of Object.entries(KINDS)) assert.equal(REF_SCREENS[k], id, k);
  const target = (id) => stand(id, [], (cs) => cs.title());
  const src = { id: "home", reads: () => ({}), acts: [], render: (cs) => ["request", "matter", "action", "dash-project", "theme", "published", "archive"].map((k, i) => cs.ref(k, "X" + i, "label " + k, ["a fact " + k])).join("") + cs.ref("zzz-unknown", "U1", "label unknown", ["a fact unknown"]) };
  const targets = Object.values(KINDS).map((id) => (id === "published" ? { ...PUBLISHED } : target(id)));
  const p = await boot({ screens: [src, ...targets] });
  const refs = p.root().querySelectorAll("#cs-main a.cs-ref");
  assert.deepEqual(refs.map((a) => a.getAttribute("href")), Object.values(KINDS).map((id, i) => "/app/" + id + "/X" + i));
  Object.keys(KINDS).forEach((k, i) => {
    const tip = refs[i].getAttribute("data-tip");
    if (k === "theme") { assert.ok(!tip.includes("<b>"), "no shell.card.theme word is held"); assert.ok(tip.includes("a fact theme"), "the item's own facts"); }
    else assert.ok(tip.includes(h(word("shell.card." + k))), k + ": its card");
    if (k === "published" || k === "archive") assert.ok(!tip.includes("a fact"), k + ": the word alone");
    else assert.ok(tip.includes("a fact " + k), k + ": the facts");
    assert.ok(tip.includes(h(word("shell.card.open"))));
  });
  const unknown = p.root().querySelector("#cs-main .cs-card");
  assert.equal(unknown.localName, "span", "an unknown kind opens nothing");
  assert.ok(!String(unknown.getAttribute("data-tip")).includes(h(word("shell.card.open"))));
  /* published opens in the public frame, no Authorization header */
  const i = Object.keys(KINDS).indexOf("published");
  await p.click(refs[i]);
  assert.equal(p.location.pathname, "/app/published/X" + i);
  assert.equal(p.root().querySelector(".cs-frame").getAttribute("data-frame"), "published");
  assert.ok(p.byOp("publishedcase").length >= 1);
  assert.ok(p.byOp("publishedcase").every((r) => r.headers.Authorization === undefined), "no Authorization header");
  /* docket-public is a public-frame screen reached with no session (R88) */
  const dp = stand("docket-public", [], (cs) => cs.title(), { reads: () => ({ d: { op: "docketpublic" } }) });
  const d = await boot({ screens: [dp], path: "/app/docket-public", session: null });
  assert.equal(d.root().querySelector(".cs-frame").getAttribute("data-frame"), "published");
  assert.ok(d.byOp("docketpublic").length >= 1 && d.byOp("docketpublic").every((r) => r.headers.Authorization === undefined));
  assert.equal(d.byOp("whoami").length, 0);
});

/* ---------- R82 ---------- */

test("R82 explanations read the design's keys: the To-do count by shell.queue.waiting then shell.queue.open, only when every fill is answered; the team's name by shell.group.open; a row's icon by shell.icon.<kind>; the path's earlier steps by shell.crumb.back; control: the queue read failing draws no count and no sentence", async () => {
  const p = await boot({ screens: ALL, plane: FRAME_ANSWERS });
  const todo = p.root().querySelector('.cs-mast [data-kind="todo"]');
  const FEED = feedWithItem().items;
  const kind = (c) => FEED.filter((x) => x.class === c).length;
  assert.equal(todo.getAttribute("data-tip"), h(word("shell.queue.waiting", { n: FEED.length, todo: kind("OBLIGATION"), noticed: kind("FINDING"), status: kind("CONDITION") })) + '<span class="more">' + h(word("shell.queue.open")) + "</span>");
  assert.ok(p.root().querySelector(".cs-mast .mk-grp").getAttribute("data-tip").includes(h(word("shell.group.open"))));
  const ICONS = stand("held", [], (cs) => ["capture", "group", "clock", "tension", "hold", "plan"].map((k) => cs.icon(k)).join(""));
  const q = await boot({ screens: [ICONS], path: "/app/held", plane: FRAME_ANSWERS });
  for (const [i, k] of ["capture", "group", "clock", "tension", "hold", "plan"].entries()) assert.equal(q.root().querySelectorAll("#cs-main .cs-card")[i].getAttribute("data-tip"), h(word("shell.icon." + k)), k);
  const doc = { ...ALL.find((s) => s.id === "document") };
  const d = await boot({ screens: [doc], path: "/app/document/c1", plane: { image: ok({ title: "A lease", pages: 1, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [] }) } });
  const back = d.root().querySelectorAll("#cs-main nav.cs-crumbs a");
  assert.ok(back.length >= 1);
  for (const a of back) assert.equal(a.getAttribute("data-tip"), h(word("shell.crumb.back", { place: a.textContent })), "back to " + a.textContent);
  /* control */
  const f = await boot({ screens: ALL, plane: { queue: httpError(500) } });
  assert.equal(f.root().querySelector('.cs-mast [data-kind="todo"]'), null, "no count");
  assert.ok(![...f.root().querySelectorAll("[data-tip]")].some((e) => /\{|undefined|NaN/.test(e.getAttribute("data-tip"))), "no sentence with an empty fill");
  const zero = await boot({ screens: ALL, plane: { queue: ok({ items: [{ id: "x", class: "OTHER" }] }) } });
  assert.equal(zero.root().querySelector('.cs-mast [data-kind="todo"]'), null, "R60: never a count at zero");
});

/* ---------- R83 ---------- */

test("R83 a refusal is drawn in its own words and shell.unread is for no refusal: a coded refusal with no key and no translation is refusal.uncatalogued, its code and the reference; with a key its word alone; with a translation that alone; a 500 with no body draws shell.unread; control: the form keeps what was typed", async () => {
  assert.equal(hasWord("refusal.UNHELD_CODE"), false, "the code is one no row holds, so the uncatalogued path is proved");
  const words = async (answer) => (await boot({ screens: [HELD], path: "/app/held", plane: { heldcaptures: answer } })).root().querySelector('#cs-main [data-state="failed"]').textContent;
  assert.equal(await words(refused("UNHELD_CODE", null, 400, { trace: "0123456789abcdef" })), word("refusal.uncatalogued") + " UNHELD_CODE " + word("refusal.reference", { ref: "01234567" }));
  assert.equal(await words(refused("UNHELD_CODE")), word("refusal.uncatalogued") + " UNHELD_CODE");
  assert.equal(await words(refused("NOT_AN_ADMIN", "ignored")), word("refusal.NOT_AN_ADMIN"));
  assert.equal(await words(refused("UNHELD_CODE", "Its own words.")), "Its own words.");
  assert.equal(await words(httpError(500)), word("shell.unread"));
  // fixtures-generic: ZZ_REASON
  assert.equal(await words({ status: 200, json: { ok: false, reason: "ZZ_REASON" } }), word("refusal.uncatalogued") + " ZZ_REASON", "a reason as well as a code");
  const p = await boot({ screens: ALL, plane: { projectdirectory: ok({ projects: [] }), promote: refused("UNHELD_CODE", null, 400) } });
  p.doc.getElementById("home-title").value = "Typed";
  await p.click(btn(p, "promote"));
  const reason = p.root().querySelector('[data-slot="m:0"] textarea');
  if (reason) { reason.value = "because"; await p.click('[data-shell="reason-send"]'); }
  assert.ok(p.root().querySelector('[data-slot="m:0"] [data-gap="refused"]').textContent.startsWith(word("refusal.uncatalogued")));
  assert.equal(p.doc.getElementById("home-title").value, "Typed", "the form keeps what was typed");
});

/* ---------- R84 ---------- */

test("R84 look: the tab's title is page.title ({screen}, {team}) and on a public page page.title.public; an explanation opens below what it explains (above when the room below is short), never over the next control, and closes on Escape; at 390 px a table has no header row and every control is at least 44 px; public pages carry no weight mark; control: at 1280 px a table keeps its header row", async () => {
  const p = await boot({ screens: ALL, plane: FRAME_ANSWERS });
  assert.equal(p.doc.title, word("page.title", { screen: word("screen.home.name"), team: "River Town" }));
  const d = await boot({ screens: [DOORBELL], path: "/app/doorbell", session: null });
  assert.equal(d.doc.title, word("page.title.public", { page: word("screen.doorbell.name"), team: word("shell.group.unnamed") }));
  /* placement and Escape */
  const el = p.root().querySelector('.cs-mast [data-kind="todo"]');
  el.getBoundingClientRect = () => ({ left: 20, top: 150, bottom: 170, right: 80, width: 60, height: 20 });
  const tip = p.doc.getElementById("cs-tip");
  p.win.innerHeight = 800;
  el.focus();
  assert.equal(tip.style.top, "176px", "below what it explains");
  el.blur();
  p.win.innerHeight = 200; Object.defineProperty(tip, "offsetHeight", { value: 100, configurable: true });
  el.focus();
  assert.equal(tip.style.top, "44px", "above, where the room below is short, never over the next control");
  p.doc.dispatchEvent(new (await import("./dom.mjs")).Event("keydown", { key: "Escape", bubbles: true }));
  assert.ok(tip.hidden, "closes on Escape");
  /* tables at the phone width: cards with no header row, 44 px targets; at 1280 a header row */
  const phone = await boot({ screens: ALL, path: "/app/held", phone: true, plane: { heldcaptures: ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] }) } });
  assert.equal(phone.root().querySelector("thead"), null);
  assert.match(phone.html, /@media \(max-width:760px\)\{[^]*\.cs-btn[^{]*\{min-height:44px;min-width:44px\}/, "every control at least 44 px to tap");
  const wide = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] }) } });
  assert.ok(wide.root().querySelector("thead"), "a header row at 1280 px");
  assert.equal(btn(d, "knock").querySelector(".w"), null, "no weight mark on a public page");
});

/* ---------- R86 ---------- */

test("R86 a first load settles quickly: the working frame is drawn before the first answer; the shell's independent requests are in flight together and with the screen's own reads, sent on whoami's answer (M-T50-6: before, the screen's first read left after two round trips; now after one); control: with the session record absent no read is sent", async () => {
  const times = {};
  let p;
  const { world, me } = await inWorld();
  const door = doorAs(world, me).door;
  /* each op the page asks is held 500 ms on the page's fake clock, then answered by the world's door */
  const slow = (op) => async (req) => { times[op] = p.clock.at(); await new Promise((r) => p.clock.setTimeout(r, 500)); return door(req); };
  const ops = [...SHELL_OPS, "bootstrap", "projectdirectory"];
  p = await bootAs(world, me, { screens: ALL, run: false, plane: Object.fromEntries(ops.map((op) => [op, slow(op)])) });
  const base = Date.now();
  const FakeDate = class extends Date { static now() { return base + p.clock.at(); } };
  new Function("window", "setTimeout", "clearTimeout", "Date", scriptOf(p.html, ALL))(p.win, p.clock.setTimeout, p.clock.clearTimeout, FakeDate);
  await settle();
  const frame = p.root().querySelector(".cs-frame");
  assert.ok(frame && frame.getAttribute("data-frame") === "working", "the working frame is drawn before the first answer");
  assert.ok(frame.querySelector(".cs-mast") && frame.querySelector(".cs-rail") && frame.querySelector(".cs-tabs") && frame.querySelector(".cs-band"));
  /* G12b (R122): `bootstrap` is sent after the screen's first reads, never before them, so `whoami` goes alone and `bootstrap` with the rest on its answer */
  assert.deepEqual(Object.keys(times).sort(), ["whoami"], "nothing else sent before whoami answers");
  assert.equal(times.whoami, 0);
  await p.clock.tick(500);
  assert.equal(times.bootstrap, 500, "bootstrap goes with the screen's reads, after the first of them");
  /* everything else sent: the frame's own reads (the module's SHELL_OPS) and the screen's, all in flight on whoami's answer */
  const rest = Object.keys(times).filter((op) => op !== "whoami" && op !== "bootstrap");
  assert.equal(rest.filter((op) => SHELL_OPS.includes(op)).length, 8, "the frame's eight reads");
  for (const op of rest) assert.equal(times[op], 500, op + ": in flight on whoami's answer, with the others and the screen's reads");
  assert.ok(times.projectdirectory < 1000, "the screen's first read leaves after one round trip, not two");
  await p.clock.tick(500);
  assert.ok(p.root().querySelector("#cs-main section"), "the screen settles on its reads");
  /* control: with no session record, no read is sent (R3) */
  const none = await boot({ screens: ALL, session: null, path: "/app/home" });
  assert.deepEqual(none.requests.map((r) => r.op).filter((op) => op !== "bootstrap"), []);
});

/* ---------- R87 ---------- */

test("R87 a Reasoned act asks its reason and is never sent without one: the shell opens the reason field and sends nothing until it holds words, or a screen's reasonField holding the member's own words is the reason and the act is not sent while it is empty; a screen naming a reasonField that is no field's name is never served; over every act of the nine modules' real SCREENS graded Reasoned, pressing it with its field empty sends nothing; control: a Reversible act runs on press", async () => {
  const doc = stand("document", ["release", "cite"], (cs) => cs.act("release") + cs.act("cite"));
  const p = await boot({ screens: [doc], path: "/app/document/x" });
  await p.click(btn(p, "release"));
  assert.equal(p.byOp("release").length, 0, "nothing is sent on press");
  await p.click('[data-shell="reason-send"]');
  assert.equal(p.byOp("release").length, 0, "nor with the field empty");
  assert.ok(p.root().querySelector("[data-reason-refusal]").textContent.includes(word("shell.reason.needed")));
  p.root().querySelector("textarea").value = "because";
  await p.click('[data-shell="reason-send"]');
  assert.equal(p.byOp("release")[0].body.reason, "because");
  await p.click(btn(p, "cite"));
  assert.equal(p.byOp("cite").length, 1, "control: a Reversible act runs on press");
  /* a reasonField: the member's own words are the reason; empty, nothing is sent; no second reason is asked */
  const own = { id: "held", reads: () => ({}), acts: [{ op: "heldsetaside", reasonField: "reason", send: (view, el, cs) => ({ body: { ids: ["h1"], reason: cs.value("why") } }) }],
    render: (cs) => cs.field("why", "shell.reason") + cs.act("heldsetaside") };
  const q = await boot({ screens: [own], path: "/app/held" });
  await q.click(btn(q, "heldsetaside"));
  assert.equal(q.byOp("heldsetaside").length, 0);
  assert.ok(q.root().querySelector('[data-slot="m:0"] [data-gap="refused"]'));
  q.doc.getElementById("why").value = "my words";
  await q.click(btn(q, "heldsetaside"));
  assert.equal(q.byOp("heldsetaside")[0].body.reason, "my words");
  assert.equal(q.root().querySelector('[data-shell="reason-send"]'), null, "no second reason asked");
  /* a reasonField that is no field's name: never served, naming the screen and the op */
  for (const bad of ["", 5, null, false]) assert.throws(() => interfacePage([{ ...own, acts: [{ op: "heldsetaside", reasonField: bad }] }]), /held.*heldsetaside/);
  /* every real act graded Reasoned: pressing it with its field empty sends nothing */
  const reasoned = (op) => !(OPS[op] && OPS[op].mutating === false) && !IRREVERSIBLE_WEIGHT.includes(op)
    && (Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op] && RUNG_ABSENT[op].ground === "undetermined" : !Object.hasOwn(RUNGS, op) || RUNGS[op] === "reasoned");
  const mods = ["screens-entry", "screens-wizards", "screens-settings", "screens-intake", "screens-daily", "screens-inquiry", "screens-investigate", "screens-publish", "screens-action"];
  const caps = [...new Set(Object.values(NEEDS).filter(Boolean))];
  const everyone = [{ ...ADMIN, capabilities: caps }, { ...ADMIN, tokenClass: "admin", capabilities: caps }];
  let pressed = 0;
  const skipped = { registry: 0, absent: 0 };
  for (const m of mods) for (const screen of (await import(`../../../src/${m}/index.mjs`)).SCREENS) for (const act of screen.acts) {
    if (!reasoned(act.op) || !Object.hasOwn(OPS, act.op)) continue;
    assert.ok(act.reasonField === undefined || (typeof act.reasonField === "string" && act.reasonField), screen.id + " " + act.op);
    const stand1 = { id: screen.id, reads: () => ({}), acts: [act], render: new Function("cs", "return cs.act(" + JSON.stringify(act.op) + ");"), ...(screen.parts ? { parts: screen.parts } : {}) };
    /* whether the registry admits the act is R73's test; here only an admitted act is pressed, as whichever session may draw it */
    let r = null, b = null, blocked = false;
    for (const who of everyone) {
      r = await boot({ screens: [stand1], path: "/app/" + screen.id + (screen.id === "home" ? "" : "/x"), plane: { whoami: ok(who) } })
        .catch((e) => { if (/not the registry's for it/.test(e.message)) { blocked = true; return null; } throw e; });
      if (!r) break;
      b = btn(r, act.op);
      if (b) break;
    }
    if (blocked) { skipped.registry++; continue; }
    if (!b) { skipped.absent++; (skipped.ex ||= []).length < 6 && skipped.ex.push(screen.id + ":" + act.op); continue; }
    await r.click(b);
    pressed++;
    assert.equal(r.byOp(act.op).length, 0, screen.id + " " + act.op + ": a Reasoned act sends nothing on press");
  }
  assert.ok(pressed > 20, "pressed " + pressed + " " + JSON.stringify(skipped));
});

/* ---------- R89 ---------- */

test("R89 the phone layout as drawn: the rules for a row (auto minmax(0, 1fr), cells under their words), a label list in one column, a choice's words one block beside its box, tabs wrapping whole live in the shell's own layout and apply at the phone width only; control: a 1280 px row keeps its cells side by side", async () => {
  const p = await boot({ screens: ALL, plane: FRAME_ANSWERS });
  const style = /<style>([^]*?)<\/style>/.exec(p.html)[1];
  const at = style.indexOf("@media (max-width:760px)");
  assert.ok(at >= 0, "a phone-width block");
  const phone = style.slice(at, style.indexOf("@media (prefers-reduced-motion"));
  const wide = style.slice(0, at);
  assert.match(phone, /\.cs-row[^{]*\{grid-template-columns:auto minmax\(0,1fr\)/, "a row is auto minmax(0, 1fr)");
  assert.match(phone, /td[^{]*\{[^}]*min-width:0/, "every cell after its words sits under them");
  assert.match(phone, /fieldset\.cs-field label\{display:flex;align-items:flex-start/, "a label list is one column, a choice's words one block beside its box");
  assert.match(phone, /\[role=tablist\]\{flex-wrap:wrap\}/, "tabs wrap whole");
  assert.match(phone, /overflow-x:hidden/, "no page scrolls sideways");
  /* control: nothing of the above outside the phone width */
  assert.doesNotMatch(wide, /grid-template-columns:auto minmax|flex-wrap:wrap|min-height:44px/);
});

/* ---------- R31 (B3): the ring opens a closed fold ---------- */

test("R31 cs.ring opens every closed details enclosing the control it rings, and focuses it; control: a control outside any fold rings as before", async () => {
  const mk = (body) => ({ id: "document", reads: () => ({}), acts: [{ op: "cite" }],
    render: new Function("cs", "if (window.__r === undefined) cs.later(10, function (c) { window.__r = c.ring('cite'); }); return " + body + ";") });
  const folded = mk(`'<details id="f1"><summary>x</summary><details id="f2"><summary>y</summary>' + cs.act("cite") + '</details></details>'`);
  const p = await boot({ screens: [folded], path: "/app/document/x" });
  assert.ok(!p.doc.getElementById("f1").hasAttribute("open"));
  await p.clock.tick(20);
  assert.equal(p.win.__r, true);
  assert.ok(p.doc.getElementById("f1").hasAttribute("open") && p.doc.getElementById("f2").hasAttribute("open"));
  assert.equal(p.doc.activeElement.getAttribute("data-act"), "cite");
  const plain = mk(`cs.act("cite")`);
  const q = await boot({ screens: [plain], path: "/app/document/x" });
  await q.clock.tick(20);
  assert.equal(q.win.__r, true);
  assert.equal(q.root().querySelectorAll("details").length, 0);
});
