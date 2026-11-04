/* interface-shell R90–R103 (T51-113): the kit options the L11 screens adopt (a choice that redraws, an act's explanation for
   its place, a strip reading's explanation, a field's placeholder), selecting words, the newer-version band, lists that re-read
   themselves, the read-only sentence, state chips and terms, the rail's count, the signer on the page's terms, bytes checked
   before they are handed on, printing, browser acts, the new paths and the admin gate, every screen's title and no weight mark
   on a public page, and an explanation placed where it covers no other control. Every sentence is read through
   `setup-words`' `word` (R70); a test holds no English. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import * as DECLARATIONS from "../../../src/op-declarations/index.mjs";
import { interfacePage, checkScreens, PATHS, HOOK_CLASSES, PUBLIC_PAGES, SHELL_OPS, browserActs } from "../../../src/interface-shell/index.mjs";
import { ADMIN_ACTS } from "../../../src/wizard-scripts/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { boot, ok, refused, silent, bytes, fitSend, declaredFit, MEMBER, ADMIN, SESSION, STORE_KEY, Event } from "./harness.mjs";
import { inWorld, bootAs } from "./world.mjs";
import { ALL, DOORBELL, JOIN } from "./screens.fixture.mjs";

/* an HTML-escaped sentence, as the page puts it in an explanation */
const h = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const tipOf = (el) => el.getAttribute("data-tip");

/* ---------- R90 ---------- */

const KIT = {
  id: "home", reads: () => ({}),
  words: [["screen.home.t.l", "fx label", false], ["screen.home.t.a", "fx a", false], ["screen.home.t.b", "fx b", false], "find.query.placeholder", "home.strip.ours_passed.one", "home.strip.ours_passed.opens"],
  acts: [{ op: "promote", send() { return { body: {} }; } }],
  render(cs, view) {
    return cs.choice("pick", "screen.home.t.l", [["a", "screen.home.t.a"], ["b", "screen.home.t.b"]], { redraw: "which", value: "a" }) + '<p id="said">' + cs.esc(view.ui.which || "-") + "</p>"
      + cs.choice("drv", "screen.home.t.l", [["a", "screen.home.t.a"], ["b", "screen.home.t.b"]], { acts: { a: "promote" }, act: { label: "act.promote.label.home", data: { k: "drv" } } })
      + cs.field("plain", "screen.home.t.l") + cs.field("ph", "screen.home.t.l", { placeholder: "find.query.placeholder" })
      + cs.act("promote", { label: "act.promote.label.home", here: "home", data: { k: "here" } })
      + cs.act("promote", { label: "act.promote.label.home", data: { k: "plain" } })
      + cs.act("promote", { label: "act.promote.label.home", here: "nowhere", data: { k: "gone" } })
      + cs.strip([{ n: 2, label: "home.strip.ours_passed.one", says: "home.strip.ours_passed.opens", screen: "queue" }, { n: 1, label: "home.strip.ours_passed.one" }]);
  },
};

test("R90 a choice with redraw sets view.ui and redraws on change with no op and no address; o.value seeds it only until the member chooses; control: an acts choice still drives its act", async () => {
  const p = await boot({ screens: [KIT] });
  const before = p.requests.length, at = p.location.pathname;
  assert.equal(p.doc.getElementById("said").textContent, "-");
  assert.ok(p.root().querySelector('option[value="a"]').hasAttribute("selected"), "seeded by o.value");
  const sel = p.doc.getElementById("pick");
  sel.value = "b";
  p.fire(sel, "change");
  await p.settle();
  assert.equal(p.doc.getElementById("said").textContent, "b", "the value chosen is view.ui.which");
  assert.equal(p.requests.length, before, "no op");
  assert.equal(p.location.pathname, at, "no address");
  assert.ok(p.root().querySelector('option[value="b"]').hasAttribute("selected"), "kept across the redraw");
  assert.ok(!p.root().querySelector('option[value="a"]').hasAttribute("selected"));
  p.fire(p.doc.getElementById("pick"), "change");
  await p.settle();
  assert.equal(p.doc.getElementById("said").textContent, "b", "still kept after a second redraw");
  assert.ok(p.root().querySelector('button[data-act="promote"][data-k="drv"]'), "the acts choice still drives its act");
});

test("R90 cs.act(op, {here}) explains the button by act.<op>.here.<place> in place of .does; a here word the table lacks falls back to .does; without here it is .does", async () => {
  const p = await boot({ screens: [KIT] });
  const tip = (k) => tipOf(p.root().querySelector('button[data-act="promote"][data-k="' + k + '"]'));
  assert.ok(hasWord("act.promote.here.home"));
  assert.ok(tip("here").includes(h(word("act.promote.here.home"))), "the place's own word");
  assert.ok(!tip("here").includes(h(word("act.promote.does"))), "in place of .does");
  assert.ok(tip("plain").includes(h(word("act.promote.does"))), "no here is .does");
  assert.ok(tip("gone").includes(h(word("act.promote.does"))), "a here word the table lacks falls back to .does");
  /* fix round 2, C76: `promote` is marked Reasoned and asks nothing, so it carries no weight line */
  assert.ok(!tip("here").includes(h(word("weight.reasoned.means"))), "no weight line for an act that asks nothing");
});

test("R90 a strip reading's says closes that reading's own explanation after its label in bold; the phone's one chip carries no reading's says; a reading with none explains nothing; the cap of four stays", async () => {
  const p = await boot({ screens: [KIT] });
  const links = p.root().querySelectorAll(".mk-strip a");
  assert.equal(tipOf(links[0]), "<b>" + h(word("home.strip.ours_passed.one")) + '</b><span class="more">' + h(word("home.strip.ours_passed.opens")) + "</span>");
  assert.equal(tipOf(links[1]), null, "no says explains nothing");
  const q = await boot({ screens: [KIT], phone: true });
  const chip = q.root().querySelectorAll(".mk-strip a");
  assert.equal(chip.length, 1, "one chip at the phone width");
  assert.ok(!String(tipOf(chip[0]) || "").includes(word("home.strip.ours_passed.opens")), "no reading's says in the chip");
  const five = { id: "home", reads: () => ({}), words: KIT.words, acts: [], render: (cs) => cs.strip([1, 2, 3, 4, 5].map((n) => ({ n, label: "home.strip.ours_passed.one" }))) };
  assert.equal((await boot({ screens: [five] })).root().querySelectorAll(".mk-strip a").length, 4);
});

test("R90 cs.field with a placeholder draws the word as the input's placeholder, the label and the help unchanged; without one there is no attribute", async () => {
  const p = await boot({ screens: [KIT] });
  assert.equal(p.doc.getElementById("ph").getAttribute("placeholder"), word("find.query.placeholder"));
  assert.equal(p.doc.getElementById("plain").getAttribute("placeholder"), null);
  assert.ok(p.root().querySelector('label[for="ph"]'), "a placeholder never stands in for the label");
});

/* ---------- R91 ---------- */

const UNITS = [{ extent: "p1:0-6", text: "Closed" }, { extent: "p1:7-11", text: "when" }, { extent: "p2:0-4", text: "done" }];
const WORDS = {
  id: "finder", reads: () => ({}),
  acts: [{ op: "search", send(view, el, cs) { cs.set("got", JSON.stringify(cs.value("w1"))); return null; } }],
  render(cs, view) { return cs.words("w1", { units: view.ui.units === "none" ? [] : [{ extent: "p1:0-6", text: "Closed" }, { extent: "p1:7-11", text: "when" }, { extent: "p2:0-4", text: "done" }] }) + cs.act("search") + '<pre id="got">' + cs.esc(view.ui.got || "") + "</pre>"; },
};
const unit = (p, i) => p.root().querySelector('[data-shell="word"][data-i="' + i + '"]');
const gotOf = async (p) => { await p.click('button[data-act="search"]'); const t = p.doc.getElementById("got").textContent; return t ? JSON.parse(t) : undefined; };

test("R91 cs.words draws a document's words for choosing; a click, Shift with a click, a sweep and the keyboard select; cs.value answers {text, extents} in the document's order and null when nothing is selected; it sends nothing", async () => {
  const p = await boot({ screens: [WORDS], path: "/app/finder" });
  assert.equal(await gotOf(p), null, "nothing selected answers null");
  const sent = p.requests.length;
  await p.click(unit(p, 2));
  await p.click(unit(p, 0));
  assert.equal(unit(p, 0).getAttribute("aria-checked"), "true");
  assert.equal(unit(p, 1).getAttribute("aria-checked"), "false");
  const two = await gotOf(p);
  assert.deepEqual(two, { text: UNITS[0].text + " " + UNITS[2].text, extents: [UNITS[0].extent, UNITS[2].extent] }, "both extents and their text, in the document's order");
  await p.click(unit(p, 0));
  await p.click(unit(p, 2));
  assert.equal(await gotOf(p), null, "toggled off");
  /* Shift with a click extends the run from the last unit */
  await p.click(unit(p, 0));
  p.fire(unit(p, 2), "click", { shiftKey: true });
  await p.settle();
  assert.deepEqual((await gotOf(p)).extents, UNITS.map((u) => u.extent));
  /* a sweep by the pointer */
  await p.click(unit(p, 0)); await p.click(unit(p, 1)); await p.click(unit(p, 2));
  assert.equal(await gotOf(p), null);
  p.fire(unit(p, 1), "pointerdown");
  p.fire(unit(p, 2), "pointerover");
  for (const f of p.win.listeners.pointerup || []) f({});
  await p.settle();
  assert.deepEqual((await gotOf(p)).extents, [UNITS[1].extent, UNITS[2].extent], "the units swept over");
  /* the keyboard: each unit takes focus, Space toggles, Shift with the arrows extends the run */
  await p.click(unit(p, 1)); await p.click(unit(p, 2));
  unit(p, 0).focus();
  p.fire(unit(p, 0), "keydown", { key: " " });
  await p.settle();
  assert.equal(unit(p, 0).getAttribute("aria-checked"), "true", "Space toggles");
  p.fire(unit(p, 0), "keydown", { key: "ArrowRight", shiftKey: true });
  await p.settle();
  assert.equal(unit(p, 1).getAttribute("aria-checked"), "true", "Shift with an arrow extends the run");
  assert.equal(p.doc.activeElement, unit(p, 1), "the focus moves along");
  assert.ok([0, 1, 2].every((i) => unit(p, i).getAttribute("tabindex") === "0"), "each unit takes focus");
  assert.equal(p.requests.filter((r) => !SHELL_OPS.includes(r.op) && r.op !== "version").length, 0, "it reads no op and sends nothing");
  assert.ok(p.requests.length >= sent);
  /* leaving the screen drops the selection (page memory only) */
  await p.back("/app/finder/other");
  assert.equal(await gotOf(p), null, "a new visit starts with nothing selected");
  assert.deepEqual([...p.local.keys()].filter((k) => /word|select/i.test(k)), [], "nothing kept in storage");
});

test("R91 a document with no units draws the empty state", async () => {
  const p = await boot({ screens: [{ ...WORDS, render: (cs) => cs.words("w1", { units: [] }) }], path: "/app/finder" });
  assert.equal(p.doc.getElementById("w1").textContent, word("state.empty"));
});

/* ---------- R92 ---------- */

const tick5 = (p) => p.clock.tick(5 * 60 * 1000);
const versions = (list) => { let n = 0; return () => ({ status: 200, text: list[Math.min(n++, list.length - 1)] }); };

test("R92 the shell asks GET /version once on load and every five minutes while the page is visible; scripted answers v1, v1, v2 draw the band at the third and not before; pressing its button reloads; nothing reloads by itself", async () => {
  const p = await boot({ screens: ALL, plane: { version: versions(["v1\n", "v1\n", "v2\n"]) } });
  const polls = () => p.byOp("version").length;
  assert.equal(polls(), 1, "once on load");
  assert.equal(p.root().querySelector(".mk-updband"), null);
  await tick5(p);
  assert.equal(polls(), 2);
  assert.equal(p.root().querySelector(".mk-updband"), null, "the same version draws nothing");
  await tick5(p);
  assert.equal(polls(), 3);
  const band = p.root().querySelector(".mk-updband");
  assert.ok(band, "the third answer differs");
  assert.ok(band.classList.contains("cs-testband"));
  assert.equal(band.parentElement, p.root().querySelector(".cs-frame"), "across the top of the frame");
  assert.equal(band.nextElementSibling, p.root().querySelector(".cs-mast"), "above the masthead");
  assert.equal(band.querySelector("b").textContent, word("shell.update.title"));
  assert.equal(band.querySelector("span").textContent, word("shell.update.says"));
  const button = band.querySelector('[data-shell="reload"]');
  assert.equal(button.textContent, word("shell.reload"));
  assert.equal(tipOf(button), "<b>" + h(word("shell.reload")) + "</b>: " + h(word("shell.update.reload.does")) + " " + h(word("shell.update.reload.warn")), "the one explanation: what it does, then the warning");
  let reloads = 0;
  p.location.reload = () => { reloads++; };
  await tick5(p);
  assert.equal(reloads, 0, "nothing reloads by itself");
  await p.click('a[href="/app/queue"]');
  assert.ok(p.root().querySelector(".mk-updband"), "the band stays over redraws and screens");
  const before = p.requests.length;
  await p.click(button.id ? "#" + button.id : '[data-shell="reload"]');
  assert.equal(reloads, 1);
  assert.equal(p.requests.length, before, "reloading sends no request");
  for (const r of p.byOp("version")) { assert.equal(r.url, "/version"); assert.equal(r.headers.Authorization, undefined, "no session on a poll"); assert.equal(r.query.background, undefined); }
});

test("R92 a failed or non-text answer is no answer; a hidden page is not polled; the public and setup frames send no /version; the poll counts as no activity and writes nothing", async () => {
  const f = await boot({ screens: ALL, plane: { version: versions(["v1\n"]) } });
  f.win.fetch = ((orig) => async (url, init) => (String(url) === "/version" ? Promise.reject(new TypeError("down")) : orig(url, init)))(f.win.fetch);
  await tick5(f); await tick5(f);
  assert.equal(f.root().querySelector(".mk-updband"), null, "a failed poll draws no band");
  const j = await boot({ screens: ALL, plane: { version: versions(["v1\n"]) } });
  assert.equal(j.byOp("version").length, 1);
  const n = await boot({ screens: ALL, plane: { version: ok({ build: "v2" }) } });
  await tick5(n); await tick5(n);
  assert.equal(n.root().querySelector(".mk-updband"), null, "a non-text answer is no answer");
  const hid = await boot({ screens: ALL, plane: { version: versions(["v1\n", "v2\n"]) } });
  hid.doc.hidden = true;
  await tick5(hid);
  assert.equal(hid.byOp("version").length, 1, "not while hidden");
  assert.equal(hid.root().querySelector(".mk-updband"), null);
  const pub = await boot({ screens: [DOORBELL], path: "/app/doorbell", session: null });
  await tick5(pub); await tick5(pub);
  assert.equal(pub.byOp("version").length, 0, "the public frame sends no /version");
  const setup = await boot({ screens: [JOIN], path: "/app/join", session: null });
  await tick5(setup);
  assert.equal(setup.byOp("version").length, 0, "nor the setup frame");
  const a = await boot({ screens: ALL, plane: { version: versions(["v1\n"]) } });
  const keys = new Set(a.local.keys()), tabKeys = new Set(a.store.keys());
  await tick5(a);
  assert.deepEqual([...a.local.keys()].filter((k) => !keys.has(k) && k !== STORE_KEY + ":active"), [], "a poll writes nothing");
  assert.deepEqual([...a.store.keys()].filter((k) => !tabKeys.has(k)), [], "a poll writes nothing to the tab's storage either (the frame's kept reads, R124, were written before it)");
});

/* ---------- R93 ---------- */

const LISTING = {
  id: "finder", words: [["screen.finder.t.col", "fx col", false], ["screen.finder.t.typed", "fx typed", false]],
  reads: (view) => ({ list: { op: "search", query: { q: "x" }, refresh: true } }),
  acts: [{ op: "select", send(view, el) { return { body: { id: el.dataset.id } }; } }, { op: "search", send() { return { body: {} }; } },
    { op: "calculationcreate", send() { return { body: {} }; } }],
  render(cs, view) {
    return cs.title() + cs.fresh() + cs.state("list", view, (v) => cs.rows({ id: "found", pick: true, cols: ["screen.finder.t.col"], items: v.items, key: (it) => it.id, name: (it) => cs.esc(it.title),
      cells: () => [], acts: (it) => cs.act("select", { data: { id: it.id } }) })) + cs.field("typed", "screen.finder.t.typed") + cs.act("calculationcreate");
  },
};
const PLAIN = { id: "queue", words: [], reads: () => ({ list: { op: "queue", query: { limit: 5 } } }), acts: [], render: (cs, view) => cs.state("list", view, () => "<p>x</p>") + cs.fresh() };
const lists = (...answers) => { let n = 0; return () => { const a = answers[Math.min(n++, answers.length - 1)]; return a === "fail" ? silent : ok({ items: a.map(([id, title]) => ({ id, title })) }); }; };
const titles = (p) => p.root().querySelectorAll("tr.cs-r").map((r) => r.querySelector(".mk-rowname").textContent.replace(/Acts?.*$/, "").trim());

test("R93 a read marked refresh: true is read again every 45 seconds as a background read while visible and unobstructed; the screen redraws with its picks and open panels kept; a re-read that fails keeps the list; cs.fresh draws list.fresh only while the read answered within 90 seconds", async () => {
  const p = await boot({ screens: [LISTING], path: "/app/finder", plane: { search: lists([["a", "Alpha"], ["b", "Beta"]], [["a", "Alpha"], ["b", "Beta"], ["c", "Gamma"]], "fail", [["z", "Zed"]]) } });
  const reads = () => p.byOp("search");
  assert.equal(reads().length, 1);
  assert.equal(reads()[0].query.background, undefined, "the first read is the screen's own");
  assert.equal(p.root().querySelector("[data-fresh]").textContent, word("list.fresh"), "drawn while the read just answered");
  assert.equal(p.root().querySelector("[data-fresh]").getAttribute("role"), "status");
  assert.equal(p.root().querySelector("[data-fresh]").getAttribute("aria-live"), "polite");
  /* picks and an open panel */
  const pick = p.doc.getElementById("pick-found-b");
  pick.checked = true; p.fire(pick, "change"); await p.settle();
  await p.click(p.root().querySelectorAll('[data-shell="row"]')[1]);
  await p.clock.tick(44 * 1000);
  assert.equal(reads().length, 1, "not before 45 seconds");
  await p.clock.tick(1000);
  assert.equal(reads().length, 2, "read again at 45 seconds");
  assert.equal(reads()[1].query.background, "1", "as a background read (R33)");
  assert.deepEqual(titles(p), ["Alpha", "Beta", "Gamma"], "the changed list is drawn");
  assert.equal(p.doc.getElementById("pick-found-b").checked, true, "picked rows kept");
  assert.equal(p.root().querySelectorAll("tr.cs-panel")[1].hidden, false, "the open panel kept");
  assert.ok(p.root().querySelector("[data-fresh]"));
  /* a re-read that fails keeps the list and the line goes */
  await p.clock.tick(45 * 1000);
  assert.equal(reads().length, 3);
  assert.deepEqual(titles(p), ["Alpha", "Beta", "Gamma"], "the list from the last answer");
  assert.equal(p.root().querySelector("[data-fresh]"), null, "no line after a failed re-read");
  await p.clock.tick(45 * 1000);
  assert.equal(reads().length, 4, "the next one tries again");
  assert.deepEqual(titles(p), ["Zed"]);
  assert.ok(p.root().querySelector("[data-fresh]"));
  /* leaving the screen cancels the timers */
  await p.back("/app/queue");
  await p.clock.tick(5 * 60 * 1000);
  assert.equal(reads().length, 4, "no re-read after the member left");
});

test("R93 a re-read is held back while the page is hidden, a lock or reason field is open, or the member's focus is in a text field; control: a screen with no refresh is never re-read and its line is not drawn", async () => {
  const p = await boot({ screens: [LISTING], path: "/app/finder", plane: { search: lists([["a", "Alpha"]], [["a", "Alpha"], ["b", "Beta"]]) } });
  const reads = () => p.byOp("search").length;
  p.doc.getElementById("typed").focus();
  await p.clock.tick(45 * 1000);
  assert.equal(reads(), 1, "a text field in focus holds it back");
  p.doc.getElementById("typed").blur();
  p.doc.hidden = true;
  await p.clock.tick(45 * 1000);
  assert.equal(reads(), 1, "a hidden page holds it back");
  p.doc.hidden = false;
  await p.click('button[data-act="calculationcreate"]');
  assert.ok(p.root().querySelector(".mk-slot .cs-reason"), "the reason field is open");
  await p.clock.tick(45 * 1000);
  assert.equal(reads(), 1, "an open reason field holds it back");
  await p.click('[data-shell="cancel"]');
  await p.clock.tick(45 * 1000);
  assert.equal(reads(), 2, "released, it reads at the next tick");
  /* the line expires with the answer when nothing re-reads */
  const q = await boot({ screens: [LISTING], path: "/app/finder", plane: { search: lists([["a", "Alpha"]]) } });
  q.doc.getElementById("typed").focus();
  await q.clock.tick(89 * 1000);
  assert.ok(q.root().querySelector("[data-fresh]"), "within 90 seconds");
  await q.clock.tick(3 * 1000);
  assert.equal(q.root().querySelector("[data-fresh]"), null, "not past 90 seconds of an answer that did not just update");
  /* control */
  const c = await boot({ screens: [PLAIN], path: "/app/queue" });
  const n = c.byOp("queue").filter((r) => r.query.limit === "5").length;
  await c.clock.tick(5 * 60 * 1000);
  assert.equal(c.byOp("queue").filter((r) => r.query.limit === "5").length, n, "a screen with no refresh is never re-read");
  assert.equal(c.root().querySelector("[data-fresh]"), null);
  const loading = await boot({ screens: [LISTING], path: "/app/finder", plane: { search: { pending: true } } });
  assert.equal(loading.root().querySelector("[data-fresh]"), null, "not drawn before the first answer");
});

/* ---------- R94 ---------- */

const NOUN = "fx noun";
const READONLY = { id: "home", reads: () => ({}), words: [["screen.home.t.noun", NOUN, false]], acts: [{ op: "promote", send() { return { body: {} }; } }],
  render: (cs) => cs.readonly("screen.home.t.noun") + cs.readonly("screen.home.t.noun") + cs.act("promote", { label: "act.promote.label.home" }) + cs.readonly({ text: "x" }) };

test("R94 cs.readonly(noun) draws shell.readonly as a note at the head of a screen for a member without Contribute, once, and nothing for one who holds it; the acts stay absent; the word says credential nowhere", async () => {
  const p = await boot({ screens: [READONLY], plane: { whoami: ok({ ...MEMBER, capabilities: [] }) } });
  const notes = p.root().querySelectorAll('.mk-note[role="note"]');
  assert.equal(notes.length, 1, "once per screen");
  assert.equal(notes[0].textContent, word("shell.readonly", { noun: NOUN, members: word("shell.readonly.members") }));
  assert.ok(!/credential/i.test(notes[0].textContent));
  assert.equal(p.root().querySelector("button[data-act]"), null, "the acts stay absent, never greyed");
  const m = await boot({ screens: [READONLY] });
  assert.equal(m.root().querySelector('.mk-note[role="note"]'), null, "a member with Contribute");
  assert.ok(m.root().querySelector('button[data-act="promote"]'));
  const a = await boot({ screens: [READONLY], plane: { whoami: ok({ ...ADMIN, capabilities: [] }) } });
  assert.equal(a.root().querySelector('.mk-note[role="note"]'), null, "an administrator holds it");
  const d = await boot({ screens: [{ ...READONLY, render: (cs) => cs.readonly({ text: "a <b>record</b>" }) }], plane: { whoami: ok({ ...MEMBER, capabilities: [] }) } });
  assert.equal(d.root().querySelector('.mk-note[role="note"]').textContent, word("shell.readonly", { noun: "a <b>record</b>", members: word("shell.readonly.members") }), "data is drawn as text");
});

/* ---------- R95 ---------- */

const KINDS = ["review", "reviewed", "retired", "open", "concluded", "published", "waiting", "flagged", "watched", "deferred", "dismissed", "divided", "planned", "active", "resolved", "abandoned"];
const CHIPS = {
  id: "home", reads: () => ({}), acts: [],
  words: [],
  render: (cs) => ["review", "reviewed", "retired", "open", "concluded", "published", "waiting", "flagged", "watched", "deferred", "dismissed", "divided", "planned", "active", "resolved", "abandoned", "nonesuch"].map((k) => '<p data-kind-of="' + k + '">' + cs.stateChip(k) + "</p>").join("")
    + '<p id="terms">' + cs.term("money.acfr") + "|" + cs.term("honest.nonesuch") + "</p>",
};

test("R95 cs.stateChip(kind) draws the design's mk-chip for each kind, its name and its explanation (means, then can and cannot where the table holds them); a kind outside the list draws nothing", async () => {
  const p = await boot({ screens: [CHIPS] });
  for (const k of KINDS) {
    const chip = p.root().querySelector('[data-kind-of="' + k + '"] .mk-chip');
    const b = "state.item." + k;
    assert.ok(chip, k);
    assert.equal(chip.textContent, word(b + ".name"));
    assert.equal(chip.getAttribute("data-level"), "1");
    const want = "<b>" + h(word(b + ".name")) + "</b>: " + h(word(b + ".means")) + [".can", ".cannot"].filter((x) => hasWord(b + x)).map((x) => '<span class="why">' + h(word(b + x)) + "</span>").join("");
    assert.equal(tipOf(chip), want, k);
  }
  for (const k of ["waiting", "flagged", "watched"]) assert.ok(!hasWord("state.item." + k + ".cannot"), k + " holds no cannot");
  assert.equal(p.root().querySelector('[data-kind-of="nonesuch"]').innerHTML, "", "an unknown kind draws nothing");
  await p.click(p.root().querySelector('[data-kind-of="open"] .mk-chip'));
});

test("R95 cs.term(termKey) draws a glossary term as a card: its name, explained by its definition then shell.card.open, a click opening glossary; until the design names the term, no term is drawn", async () => {
  const GLOSSARY = { id: "glossary", reads: () => ({}), acts: [], words: [], render: (cs) => '<p id="at-glossary">' + cs.title() + "</p>" };
  const p = await boot({ screens: [CHIPS, GLOSSARY] });
  const terms = p.doc.getElementById("terms");
  const link = terms.querySelector("a.cs-ref");
  assert.equal(link.textContent, word("screen.glossary.money.acfr.name"));
  assert.equal(tipOf(link), h(word("screen.glossary.money.acfr")) + '<span class="more">' + h(word("shell.card.open")) + "</span>");
  assert.equal(terms.textContent, word("screen.glossary.money.acfr.name") + "|", "a term the design has not named draws nothing");
  await p.click(link);
  assert.equal(p.location.pathname, "/app/glossary");
  assert.ok(p.doc.getElementById("at-glossary"));
  const lone = await boot({ screens: [CHIPS] });
  assert.ok(lone.doc.getElementById("terms").querySelector(".cs-card"), "no glossary screen: the card alone");
});

/* ---------- R96 ---------- */

test("R96 the rail's Queue place carries the number the masthead draws, the sum of the queue's three kinds, in the design's count slot, on Queue alone; none at zero; the count has no explanation of its own; no collapse control; the frame holds no verdict", async () => {
  const queue = ok({ items: [{ id: "a", class: "OBLIGATION" }, { id: "b", class: "OBLIGATION" }, { id: "c", class: "FINDING" }, { id: "d", class: "CONDITION" }] });
  const p = await boot({ screens: ALL, plane: { queue } });
  const counts = p.root().querySelectorAll(".cs-rail a .count");
  assert.equal(counts.length, 1, "Queue alone");
  assert.equal(counts[0].textContent, "4");
  assert.equal(counts[0].parentElement.getAttribute("href"), "/app/queue");
  assert.equal(counts[0].getAttribute("data-tip"), null, "no explanation of its own");
  assert.ok(String(counts[0].parentElement.getAttribute("data-tip")).includes(h(word("rail.queue.holds"))), "the place keeps its explanation");
  assert.equal(p.root().querySelector('.cs-mast [data-kind="todo"]').textContent, word("shell.todo", { n: 4 }), "the masthead draws the same number");
  assert.equal(p.root().querySelector(".cs-mast [data-kind=todo]").getAttribute("data-tip"), h(word("shell.queue.waiting", { n: 4, todo: 2, noticed: 1, status: 1 })) + '<span class="more">' + h(word("shell.queue.open")) + "</span>");
  assert.equal(p.root().querySelectorAll(".cs-tabs .count").length, 0, "the tabs carry none");
  const more = await boot({ screens: ALL, path: "/app/more", phone: true, plane: { queue } });
  assert.equal(more.root().querySelectorAll(".mk-morerows .count, .cs-tabs .count").length, 0, "More carries none");
  assert.equal(p.root().querySelectorAll('[data-shell="grip"]').length, 1, "the rail's width is the grip's alone");
  assert.equal(p.root().querySelectorAll('.cs-rail [aria-expanded], .cs-rail [data-shell="collapse"]').length, 0, "no collapse control");
  const zero = await boot({ screens: ALL, plane: { queue: ok({ items: [] }) } });
  assert.equal(zero.root().querySelectorAll(".cs-rail .count").length, 0, "never at zero");
  const failed = await boot({ screens: ALL, plane: { queue: silent } });
  assert.equal(failed.root().querySelectorAll(".cs-rail .count").length, 0, "drawn only when the queue read answered");
  assert.match(ASSET_FILES["civicsmith.css"].body, /\.cs-shell\.rail-icons \.cs-rail a \.count\s*\{\s*display:\s*none/, "the icons-only rail hides the count as the design's stylesheet does");
  assert.ok(!/verdict/i.test(p.root().querySelector(".cs-frame").innerHTML), "the frame draws no domain-claim verdict");
});

/* ---------- R97 ---------- */

const MAKER = {
  id: "account", reads: () => ({}),
  acts: [{ op: "signerregisterown", async send(view, el, cs) {
    const r = await cs.signer.register({ keep: cs.value("keep"), passphrase: cs.value("pw") === "<none>" ? undefined : cs.value("pw"), defer: cs.value("defer") });
    cs.set("reg", JSON.stringify(r)); return null; } }],
  render: (cs, view) => '<input type="checkbox" id="keep"><input type="checkbox" id="defer"><input type="text" id="pw" value="<none>">' + cs.act("signerregisterown") + '<pre id="reg">' + cs.esc(view.ui.reg || "") + "</pre>",
};
const PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
async function lineOfSeed(seed) {
  const key = await webcrypto.subtle.importKey("pkcs8", Buffer.concat([PKCS8, seed]), { name: "Ed25519" }, true, ["sign"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", key);
  const raw = Buffer.from(jwk.x, "base64url");
  const sshStr = (b) => Buffer.concat([Buffer.from([0, 0, 0, b.length]), b]);
  return Buffer.concat([sshStr(Buffer.from("ssh-ed25519")), sshStr(raw)]).toString("base64");
}
async function seedOf(file, pass) {
  const parts = file.split(".");
  if (parts[0] === "BIOKEY-RAW1") return Buffer.from(parts[2], "base64");
  const [, label, salt, iv, ct, iter] = parts;
  assert.equal(label, "bio-ratify");
  assert.equal(iter, "600000");
  const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt: Buffer.from(salt, "base64"), iterations: 600000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return Buffer.from(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, key, Buffer.from(ct, "base64")));
}
const made = async (p, { pass, defer = false, keep = false } = {}) => {
  p.doc.getElementById("pw").value = pass === undefined ? "<none>" : pass;
  p.doc.getElementById("defer").checked = defer;
  p.doc.getElementById("keep").checked = keep;
  await p.click('button[data-act="signerregisterown"]');
  for (let i = 0; i < 400 && !p.doc.getElementById("reg").textContent; i++) await new Promise((r) => setTimeout(r, 10));
  await p.settle();
  return JSON.parse(p.doc.getElementById("reg").textContent);
};
const fileText = async (p) => (await p.files[p.files.length - 1].blob.text()).trim();

test("R97 a passphrase typed on the page makes the BIOKEY1. file under it with no dialog; the file decrypts with it to the key the public line names; the passphrase is in no request or storage", async () => {
  const SECRET = "sentinel-pass-phrase-7f3a";
  const p = await boot({ screens: [MAKER], path: "/app/account" });
  const r = await made(p, { pass: SECRET });
  assert.equal(r.ok, true);
  assert.equal(r.kept, false);
  assert.equal(p.root().querySelector('[data-overlay="register"]'), null, "no dialog");
  assert.equal(p.files.length, 1, "downloaded as R40 says");
  const file = await fileText(p);
  assert.match(file, /^BIOKEY1\.bio-ratify\.[^.]+\.[^.]+\.[^.]+\.600000$/);
  const seed = await seedOf(file, SECRET);
  assert.equal(seed.length, 32);
  assert.equal(r.keyB64, await lineOfSeed(seed), "the file holds the key the line names");
  assert.equal(r.line.split(" ")[1], r.keyB64);
  const everything = JSON.stringify([p.requests, [...p.local], [...p.store], [...p.idb.entries()].map(([k, v]) => [k, [...v.entries()]])]);
  assert.ok(!everything.includes(SECRET), "the passphrase reaches no request or storage");
  assert.ok(!everything.includes(file), "nor does the file");
  assert.equal(p.idb.get("civicsmith-signer") === undefined || p.idb.get("civicsmith-signer").get("keys").size === 0, true, "nothing kept on the device unless kept");
});

test("R97 a passphrase of the empty string with keep false makes the unprotected BIOKEY-RAW1. file; with defer the signer downloads nothing and answers the file; control: with the passphrase absent the kit's own dialog asks it", async () => {
  const p = await boot({ screens: [MAKER], path: "/app/account" });
  const raw = await made(p, { pass: "" });
  assert.equal(raw.ok, true);
  assert.equal(p.root().querySelector('[data-overlay="register"]'), null, "no dialog");
  const file = await fileText(p);
  assert.match(file, /^BIOKEY-RAW1\.bio-ratify\.[A-Za-z0-9+/=]+$/);
  assert.equal(raw.keyB64, await lineOfSeed(await seedOf(file, "")), "its seed is the key the line names");
  assert.equal(raw.file, undefined, "downloaded, not answered");
  const q = await boot({ screens: [MAKER], path: "/app/account" });
  const d = await made(q, { pass: "a pass", defer: true });
  assert.equal(q.files.length, 0, "defer downloads nothing");
  assert.match(d.file, /^BIOKEY1\./);
  assert.equal(d.keyB64, await lineOfSeed(await seedOf(d.file, "a pass")));
  const r = await boot({ screens: [MAKER], path: "/app/account" });
  const dr = await made(r, { pass: "", defer: true });
  assert.match(dr.file, /^BIOKEY-RAW1\./);
  assert.equal(r.files.length, 0);
  const k = await boot({ screens: [MAKER], path: "/app/account" });
  const kept = await made(k, { pass: "ignored", keep: true });
  assert.equal(kept.kept, true);
  assert.equal(kept.file, undefined, "a key kept on the device has no file");
  assert.equal(k.files.length, 0);
  const t = await boot({ screens: [MAKER], path: "/app/account" });
  t.doc.getElementById("pw").value = "<none>";
  await t.click('button[data-act="signerregisterown"]');
  await t.settle();
  assert.ok(t.root().querySelector('[data-overlay="register"]'), "the dialog asks the passphrase twice when none is given");
});

/* ---------- R98 ---------- */

const hex = (b) => createHash("sha256").update(b).digest("hex");
const GOT = {
  id: "finder", reads: () => ({}),
  acts: [{ op: "search", async send(view, el, cs) { cs.set("dl", JSON.stringify(await cs.download("openoriginal", { query: { capture: "c1" }, name: "x.bin", verify: view.ui.verify || undefined }))); return null; } }],
  render: (cs, view) => cs.act("search") + '<pre id="dl">' + cs.esc(view.ui.dl || "") + "</pre>",
};
test("R98 cs.download with verify hashes the bytes in the browser before any file is made: matching bytes download; altered bytes save nothing and answer DIGEST_MISMATCH with expected and got; control: without verify a download saves as before", async () => {
  const body = new Uint8Array([1, 2, 3, 4, 5, 250]);
  const page = async (verify) => {
    /* the screen's function is self-contained, so the digest asked for is written into its source */
    const send = new Function("view", "el", "cs", `return (async () => { cs.set("dl", JSON.stringify(await cs.download("openoriginal", { query: { capture: "c1" }, name: "x.bin", verify: ${JSON.stringify(verify)} }))); return null; })();`);
    const screen = { ...GOT, acts: [{ op: "search", send }] };
    return boot({ screens: [screen], path: "/app/finder", plane: { openoriginal: bytes(body, "application/octet-stream") } });
  };
  const press = async (p) => {
    await p.click('button[data-act="search"]');
    /* the digest is computed by WebCrypto: let it finish */
    for (let i = 0; i < 400 && !p.doc.getElementById("dl").textContent; i++) await new Promise((r) => setTimeout(r, 10));
    await p.settle();
    return JSON.parse(p.doc.getElementById("dl").textContent);
  };
  const good = await page(hex(body));
  const a = await press(good);
  assert.equal(a.ok, true);
  assert.equal(good.files.length, 1, "matching bytes download");
  const upper = await page(hex(body).toUpperCase());
  assert.equal((await press(upper)).ok, true, "a digest is compared as lowercase hex");
  const bad = await page(hex(new Uint8Array([9, 9, 9])));
  const b = await press(bad);
  assert.equal(b.ok, false);
  assert.equal(b.answer.code, "DIGEST_MISMATCH");
  assert.equal(b.answer.expected, hex(new Uint8Array([9, 9, 9])));
  assert.equal(b.answer.got, hex(body));
  assert.equal(bad.files.length, 0, "nothing saved");
  assert.equal(bad.objectUrls.length, 0, "no object address made");
  const free = await page(null);
  assert.equal((await press(free)).ok, true, "without verify a download saves as before");
  assert.equal(free.files.length, 1);
  assert.ok(hasWord("refusal.DIGEST_MISMATCH"));
});

/* ---------- R99 ---------- */

const PRINTING = {
  id: "published", reads: () => ({}),
  acts: [{ op: "verify", send(view, el, cs) { cs.set("print", "1"); cs.print(); return null; } }],
  printed(cs, view) { cs.set("print", "done:" + (view.ui.n = (view.ui.n || 0) + 1)); },
  render: (cs, view) => cs.act("verify") + '<pre id="print">' + cs.esc(view.ui.print || "") + "</pre>",
};
test("R99 cs.print() asks the window to print once; the frame, the main column and the body are lifted off their fixed height by inline style while printing and restored after; the screen's printed(cs, view) is called once after; control: the theme returns and a screen with no printed is untouched", async () => {
  const p = await boot({ screens: [PRINTING], path: "/app/published/x", session: null });
  let printed = 0;
  p.win.print = () => { printed++; };
  await p.click('button[data-act="verify"]');
  assert.equal(printed, 1, "asked once");
  const frame = () => p.doc.getElementById("cs-frame"), main = () => p.doc.getElementById("cs-main");
  for (const f of p.win.listeners.beforeprint || []) f({});
  assert.equal(p.doc.documentElement.getAttribute("data-theme"), "light", "print is always light");
  for (const el of [frame(), main(), p.doc.body]) { assert.equal(el.style.height, "auto"); assert.equal(el.style.overflow, "visible"); }
  for (const f of p.win.listeners.afterprint || []) f({});
  await p.settle();
  for (const el of [frame(), main(), p.doc.body]) { assert.ok(!el.style.height, "restored"); assert.ok(!el.style.overflow, "restored"); }
  assert.equal(p.doc.documentElement.getAttribute("data-theme"), null, "the member's theme returns");
  assert.equal(p.doc.getElementById("print").textContent, "done:1", "printed called once, after");
  const q = await boot({ screens: [{ ...PRINTING, printed: undefined }], path: "/app/published/x", session: null });
  for (const f of q.win.listeners.beforeprint || []) f({});
  for (const f of q.win.listeners.afterprint || []) f({});
  await q.settle();
  assert.ok(q.root().querySelector(".cs-frame"), "a screen with no printed is untouched");
  assert.ok(!/@media print/.test(q.html), "no print rule is added to the page");
});

/* ---------- R100 ---------- */

const NAMES = ["revisioncompare", "hashcopy", "linkopen", "pubfloorset", "pubfloorclear", "pubprint", "reviewexport"];
/* a screen's functions are self-contained: the act is baked into the render by source, and send reads it from its button */
const browserScreen = (op, screen) => ({ id: screen, reads: () => ({}), acts: [{ op, send(view, el, cs) { cs.set("did", el.getAttribute("data-act")); return null; } }],
  render: new Function("cs", "view", "return cs.act(" + JSON.stringify(op) + ") + '<i id=\"did\">' + cs.esc(view.ui.did || '') + '</i>'") });

test("R100 BROWSER_ACTS (op-declarations) names the acts done in the page alone; the shell reads that table; each of the seven is drawn on its screen, calls its send and sends no request; published draws its three with no session; no weight mark", async () => {
  const table = browserActs();
  assert.equal(table, DECLARATIONS.BROWSER_ACTS, "the shell keeps no list of its own");
  for (const op of NAMES) assert.ok(Object.hasOwn(table, op), op);
  for (const [op, spec] of Object.entries(table)) {
    assert.ok(!Object.hasOwn(OPS, op), op + ": not an op");
    const sessionless = spec.screen === "published";
    const p = await boot({ screens: [browserScreen(op, spec.screen)], path: "/app/" + spec.screen + (sessionless ? "/c1" : ""), session: sessionless ? null : SESSION });
    const before = p.requests.length;
    const b = p.root().querySelector('button[data-act="' + op + '"]');
    assert.ok(b, op + " is drawn" + (sessionless ? " with no session" : ""));
    assert.equal(b.querySelector(".w"), null, "no weight mark");
    await p.click(b);
    assert.equal(p.doc.getElementById("did").textContent, op, "its send ran");
    assert.equal(p.requests.length, before, "no request: no header, no op door, no read");
    assert.equal(b.hasAttribute("data-done") || p.root().querySelector('button[data-act="' + op + '"]').hasAttribute("data-done"), true, "the button answers the press (R74)");
  }
  /* a session that holds nothing at all is drawn them too */
  const bare = await boot({ screens: [browserScreen("hashcopy", "document")], path: "/app/document/c1", plane: { whoami: ok({ ...MEMBER, capabilities: [] }) } });
  assert.ok(bare.root().querySelector('button[data-act="hashcopy"]'));
});

test("R100 a browser act is admitted on the screen BROWSER_ACTS lists it for and throws, naming the screen and the act, on another; control: an op OPS holds is checked as before; a name no table holds throws", () => {
  assert.equal(checkScreens([browserScreen("hashcopy", "document")]), true);
  assert.throws(() => checkScreens([browserScreen("hashcopy", "home")]), /home.*hashcopy/);
  assert.throws(() => checkScreens([browserScreen("pubprint", "document")]), /document.*pubprint/);
  assert.throws(() => checkScreens([browserScreen("notanact", "document")]), /document.*notanact/);
  assert.equal(checkScreens([{ id: "home", reads: () => ({}), render: () => "", acts: [{ op: "promote", send: () => null }] }]), true);
});

/* ---------- R101 ---------- */

test("R101 PATHS gains glossary, teamai and actionnew; ADMIN_ACTS gains signeradd and instancegroupseed; HOOK_CLASSES holds mk-updband with what reads it; the composed page admits glossary and actionnew; a member sees no signeradd act", async () => {
  assert.deepEqual(PATHS.glossary, ["settings", "screen.glossary.name"]);
  assert.deepEqual(PATHS.teamai, ["settings", "screen.teamai.name"]);
  assert.deepEqual(PATHS.actionnew, ["projects", "@project", "screen.actionnew.name"]);
  assert.deepEqual(PATHS["dash-action"], ["screen.dash-action.name"]);
  assert.deepEqual(PATHS["dash-project"], ["projects", "@project"]);
  for (const id of ["theme", "help-records"]) assert.ok(!Object.hasOwn(PATHS, id), id + " is not this entry's");
  assert.ok(ADMIN_ACTS.has("signeradd") && ADMIN_ACTS.has("instancegroupseed"));
  assert.match(HOOK_CLASSES["mk-updband"], /\S/);
  for (const id of ["glossary", "teamai", "actionnew"]) {
    assert.ok(SCREEN_REGISTRY.some((r) => r.id === id), id + " is in the regenerated registry");
    const screen = { id, reads: () => ({}), acts: [], render: (cs) => "<p>" + id + "</p>", place: () => ({ project: { id: "P1", title: "Pothole" } }) };
    const p = await boot({ screens: [screen], path: "/app/" + id });
    const steps = p.root().querySelector(".cs-crumbs").textContent;
    assert.ok(steps.includes(word(PATHS[id][0] === "projects" ? "rail.projects.name" : "rail.settings.name")), id);
    assert.ok(steps.endsWith(word("screen." + id + ".name")), id + ": its own name last");
    if (id === "actionnew") assert.ok(steps.includes("Pothole"), "the project's title as read");
  }
  const members = { id: "members", reads: () => ({}), acts: [{ op: "signeradd", send: () => null }], render: (cs) => cs.act("signeradd") };
  const asMember = await boot({ screens: [members], path: "/app/members" });
  assert.equal(asMember.root().querySelector('[data-act="signeradd"]'), null, "a member sees no signeradd");
  const asAdmin = await boot({ screens: [members], path: "/app/members", plane: { whoami: ok(ADMIN) } });
  assert.ok(asAdmin.root().querySelector('[data-act="signeradd"]'), "an administrator does");
  assert.throws(() => checkScreens([{ id: "glossary", reads: () => ({}), acts: [{ op: "cite", send: () => null }], render: () => "" }]), /glossary.*cite/, "an op the registry lacks for it still throws");
});

/* ---------- R102 ---------- */

const FRAME_ANSWERS = await frameAnswers();
test("R102 every screen of the registry has its tab title (page.title with screen.<id>.name) and the nine named pages page.title.public; none of the nine draws a weight mark; a working screen keeps its marks; the team's name wraps", async () => {
  assert.equal(SCREEN_REGISTRY.length >= 73, true);
  for (const r of SCREEN_REGISTRY) assert.ok(hasWord("screen." + r.id + ".name"), r.id + " has its name");
  const stand = (id) => ({ id, reads: () => ({}), acts: [], render: (cs) => "<p>x</p>", words: [] });
  const named = SCREEN_REGISTRY;
  assert.ok(PUBLIC_PAGES.every((id) => SCREEN_REGISTRY.some((r) => r.id === id)));
  for (const r of named.slice(0, 80)) {
    const pub = PUBLIC_PAGES.includes(r.id);
    const sessionless = PUBLIC_PAGES.includes(r.id) && r.id !== "join";
    const p = await boot({ screens: [stand(r.id)], path: "/app/" + r.id + (r.id === "home" ? "" : ""), session: sessionless ? null : SESSION, plane: FRAME_ANSWERS });
    const team = sessionless ? word("shell.group.unnamed") : "River Town";
    const want = pub ? word("page.title.public", { page: word("screen." + r.id + ".name"), team }) : word("page.title", { screen: word("screen." + r.id + ".name"), team });
    assert.equal(p.doc.title, want, r.id);
  }
  /* no weight mark on the nine named pages, in the frame or the page, whatever the session */
  for (const id of PUBLIC_PAGES) {
    const reg = SCREEN_REGISTRY.find((r) => r.id === id);
    const sessionless = id !== "join";
    const ops = reg.acts.filter((op) => Object.hasOwn(OPS, op) && (!sessionless || OPS[op].classes === null));
    const screen = { id, reads: () => ({}), acts: ops.map((op) => ({ op, send: () => null })), render: new Function("cs", "return " + JSON.stringify(ops) + ".map((op) => cs.act(op)).join(\"\")"), words: [] };
    const p = await boot({ screens: [screen], path: "/app/" + id, session: sessionless ? null : SESSION });
    assert.equal(p.root().querySelectorAll(".cs-pips, .w, [data-weighed]").length, 0, id + " carries no weight mark");
    if (ops.length) assert.ok(p.root().querySelectorAll("button[data-act]").length > 0 || !sessionless, id + ": its acts are drawn");
  }
  const home = await boot({ screens: ALL, path: "/app/members", plane: { whoami: ok(ADMIN) } });
  assert.ok(home.root().querySelector('button[data-act="memberadd"] .cs-pips'), "a working screen keeps its marks (an act that asks)");
  const long = "A very long team name that has to wrap and never be cut, however many words it takes to say it in full";
  const teamed = await inWorld();
  await teamed.me.act("groupnameset", { body: { name: long } });
  const wrapped = await bootAs(teamed.world, teamed.me, { screens: ALL });
  assert.equal(wrapped.root().querySelector(".cs-mast .mk-grp").textContent, long, "whole");
  assert.ok(!/\.mk-grp[^}]*white-space:\s*nowrap/.test(ASSET_FILES["shell.css"].body + ASSET_FILES["civicsmith.css"].body), "the design lets the name wrap, at every width (K4084)");
  assert.ok(!/\.mk-grp/.test(wrapped.html.slice(wrapped.html.indexOf("<style>"), wrapped.html.indexOf("</style>"))), "the shell carries no rule of its own for it");
});

/* ---------- R103 ---------- */

test("R103 an explanation opens below what it explains, else above: the first that covers no other control and stays inside the page, never beside it; closes on Escape, on the next tap elsewhere and on a scroll; control: with room below it opens below", async () => {
  const p = await boot({ screens: ALL, plane: FRAME_ANSWERS });
  const el = p.root().querySelector('.cs-mast [data-kind="todo"]');
  const rect = (l, t, r, b) => () => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
  el.getBoundingClientRect = rect(300, 150, 360, 170);
  const tip = p.doc.getElementById("cs-tip");
  Object.defineProperty(tip, "offsetWidth", { value: 100, configurable: true });
  Object.defineProperty(tip, "offsetHeight", { value: 40, configurable: true });
  p.win.innerWidth = 1000; p.win.innerHeight = 800;
  const rail = p.root().querySelectorAll(".cs-rail a");
  const open = () => { el.blur(); el.focus(); return { left: tip.style.left, top: tip.style.top }; };
  assert.deepEqual(open(), { left: "300px", top: "176px" }, "with room below, below");
  rail[0].getBoundingClientRect = rect(300, 200, 400, 230);
  assert.deepEqual(open(), { left: "300px", top: "104px" }, "below holds a control: above, not beside");
  rail[1].getBoundingClientRect = rect(290, 90, 420, 140);
  assert.deepEqual(open(), { left: "300px", top: "176px" }, "above holds one too: the first inside the page, below");
  rail[0].getBoundingClientRect = rect(0, 0, 0, 0); rail[1].getBoundingClientRect = rect(0, 0, 0, 0);
  assert.deepEqual(open(), { left: "300px", top: "176px" }, "control: with room below it opens below");
  p.fire(p.doc.body, "pointerdown");
  assert.ok(tip.hidden, "closes on the next tap elsewhere");
  open(); assert.ok(!tip.hidden);
  p.doc.dispatchEvent(new Event("scroll", { bubbles: false }));
  assert.ok(tip.hidden, "closes on a scroll");
  open();
  p.fire(tip, "pointerdown");
  assert.ok(!tip.hidden, "a tap on the explanation itself keeps it");
  el.blur();
  p.doc.dispatchEvent(new Event("keydown", { key: "Escape", bubbles: true }));
  assert.ok(tip.hidden, "closes on Escape");
});

/* ---------- K4072, K4073, K4076: the kit details the screens wait on (R90 and the shell's existing services) ---------- */

const SEARCHING = {
  id: "finder", words: [["screen.finder.t.l", "fx l", false], ["screen.finder.t.a", "fx a", false], ["screen.finder.t.b", "fx b", false], ["screen.finder.t.h1", "fx h1", false], ["screen.finder.t.h2", "fx h2", false]],
  reads: (view) => ({ list: { op: "search", query: { q: view.ui.show || "a" }, refusals: { BAD: (r, cs) => "<i id=own>" + cs.w("screen.finder.t.h1") + "</i>" } } }),
  acts: [],
  render(cs, view) {
    return cs.choice("c1", "screen.finder.t.l", [["a", "screen.finder.t.a"], ["b", "screen.finder.t.b"]], { redraw: "show" })
      + cs.choice("c2", "screen.finder.t.l", [["a", "screen.finder.t.a"], ["b", "screen.finder.t.b"]], { redraw: "other" })
      + cs.checks("ck", { text: "x" }, [["u", "screen.finder.t.a", true], ["v", "screen.finder.t.b", false]], { redraw: "marks" })
      + '<p id="marks">' + cs.esc(JSON.stringify(view.ui.marks || null)) + "</p>"
      + cs.field("f1", "screen.finder.t.l", { help: ["screen.finder.t.h1", "screen.finder.t.h2"], typing: (cs2, v2, value) => cs2.set("typed", value) })
      + '<p id="typed">' + cs.esc(view.ui.typed || "") + "</p>"
      + cs.sec("screen.finder.t.l", cs.state("list", view, () => "<p>ok</p>"), { help: ["screen.finder.t.h1", "screen.finder.t.h2"] });
  },
};
const pickIn = async (p, id, value) => { const el = p.doc.getElementById(id); el.value = value; p.fire(el, "change"); await p.settle(); };

test("R90 (K4072) a choice that redraws re-runs the screen's reads with the choice in page memory: a read whose query changed is read once with the new query; a choice that changes no read sends none", async () => {
  const p = await boot({ screens: [SEARCHING], path: "/app/finder", plane: { search: ok({ items: [] }) } });
  assert.equal(p.byOp("search").length, 1);
  await pickIn(p, "c2", "b");
  assert.equal(p.byOp("search").length, 1, "no read beyond the redraw's");
  await pickIn(p, "c1", "b");
  assert.equal(p.byOp("search").length, 2, "read once more");
  assert.equal(p.byOp("search")[1].query.q, "b", "with the new query");
});

test("R90 (K4073) cs.sec and cs.field take help as one key or a list, each its own sentence; a read's own refusal function is handed the kit; cs.checks takes the redraw option", async () => {
  const p = await boot({ screens: [SEARCHING], path: "/app/finder", plane: { search: ok({ items: [] }) } });
  const helps = p.root().querySelectorAll("#f1-help, #f1-help2");
  assert.deepEqual(helps.map((e) => e.textContent), ["fx h1", "fx h2"]);
  assert.equal(p.doc.getElementById("f1").getAttribute("aria-describedby"), "f1-help f1-help2");
  assert.equal(tipOf(p.root().querySelector("section.cs-section h2")), "fx h1" + '<span class="why">fx h2</span>');
  const one = await boot({ screens: [{ ...SEARCHING, render: (cs) => cs.field("g", "screen.finder.t.l", { help: "screen.finder.t.h1" }) }], path: "/app/finder" });
  assert.equal(one.doc.getElementById("g-help").textContent, "fx h1");
  /* the store's own refusal of a read: a selection handle it never made */
  const refusing = { ...SEARCHING, reads: () => ({ list: { op: "selection", query: { handle: "never-made" }, refusals: { NO_SUCH_SELECTION: (r, cs) => "<i id=own>" + cs.w("screen.finder.t.h1") + "</i>" } } }) };
  const world = await inWorld();
  const r = await bootAs(world.world, world.me, { screens: [refusing], path: "/app/finder" });
  assert.equal(r.doc.getElementById("own").textContent, "fx h1", "the refusal drawn with the screen's own words, by the kit");
  const box = p.doc.getElementById("ck-1"); box.checked = true; p.fire(box, "change"); await p.settle();
  assert.deepEqual(JSON.parse(p.doc.getElementById("marks").textContent), ["u", "v"], "checks redraws with the boxes ticked");
});

test("R90 (K4076) a text field's typed input carries the screen's handler, debounced by the kit to about half a second on the page's clock; leaving the screen cancels it", async () => {
  const p = await boot({ screens: [SEARCHING], path: "/app/finder", plane: { search: ok({ items: [] }) } });
  const f = () => p.doc.getElementById("f1");
  f().value = "ab"; p.fire(f(), "input");
  await p.clock.tick(300);
  f().value = "abc"; p.fire(f(), "input");
  await p.clock.tick(300);
  assert.equal(p.doc.getElementById("typed").textContent, "", "not yet: the last key restarted the wait");
  await p.clock.tick(300);
  assert.equal(p.doc.getElementById("typed").textContent, "abc", "once, with the last value");
  f().value = "z"; p.fire(f(), "input");
  await p.back("/app/finder/other");
  await p.clock.tick(1000);
  assert.equal(p.doc.getElementById("typed").textContent, "", "cancelled with the screen");
});

/* ---------- K4245: an act's failed hook (R21) and a kept choice (R90) ---------- */

/* a screen function is self-contained, so the owner's required fields are carried into its source as data (K3268) */
const withBody = (src) => new Function("return " + src.replace("__BODY__", JSON.stringify(JSON.stringify(declaredFit("promote")))))();
const WORKING = {
  id: "home", reads: () => ({}),
  words: [["screen.home.t.l", "fx label", false]],
  acts: [{ op: "promote",
    send: withBody('function (view, el, cs) { cs.set("working", true); return { body: JSON.parse(el.dataset.body) }; }'),
    done(view, answer, cs) { cs.set("working", false); },
    failed(view, answer, cs) { cs.set("working", false); cs.set("failedKind", answer.kind + ":" + (answer.code || "")); } }],
  render: withBody('function (cs, view) { return (view.ui.working ? \'<p id="working">on</p>\' : "") + \'<p id="failedKind">\' + cs.esc(view.ui.failedKind || "-") + "</p>" + cs.act("promote", { label: "act.promote.label.home", data: { body: __BODY__ } }); }'),
};

test("R21 an act's failed hook runs at once when its request is refused or not answered, so the line the press raised is cleared before the refusal is drawn beside the act; control: a successful act draws its answer as before and never calls failed", async () => {
  const refusedPage = await boot({ screens: [WORKING], plane: { promote: refused("ZZ_REFUSED", "No.") } });
  await refusedPage.click('button[data-act="promote"]');
  assert.equal(refusedPage.doc.getElementById("working"), null, "the working line is cleared");
  assert.equal(refusedPage.doc.getElementById("failedKind").textContent, "refused:ZZ_REFUSED", "failed was handed the refusal");
  assert.ok(refusedPage.root().querySelector('[data-slot] [data-gap="refused"]'), "the refusal is drawn beside the act, after the hook's redraw");
  const silentPage = await boot({ screens: [WORKING], plane: { promote: silent } });
  await silentPage.click('button[data-act="promote"]');
  assert.equal(silentPage.doc.getElementById("working"), null, "no answer clears it too");
  assert.equal(silentPage.doc.getElementById("failedKind").textContent, "silent:");
  /* control: success runs done and not failed, and the answer is drawn as before */
  const okPage = await boot({ screens: [WORKING], plane: { promote: ok({}) } });
  await okPage.click('button[data-act="promote"]');
  assert.equal(okPage.doc.getElementById("working"), null, "done cleared it");
  assert.equal(okPage.doc.getElementById("failedKind").textContent, "-", "failed was not called");
  assert.equal(okPage.root().querySelector('[data-gap="refused"]'), null);
});

test("R21 an act with no failed hook is refused as before (control)", async () => {
  const plain = { ...WORKING, acts: [{ op: "promote", send: withBody('function (view, el) { return { body: JSON.parse(el.dataset.body) }; }') }] };
  const p = await boot({ screens: [plain], plane: { promote: refused("ZZ_REFUSED", "No.") } });
  await p.click('button[data-act="promote"]');
  assert.ok(p.root().querySelector('[data-slot] [data-gap="refused"]'));
});

const AUD = {
  id: "home", reads: () => ({ list: { op: "queue" } }),
  words: [["screen.home.t.l", "fx label", false], ["screen.home.t.a", "fx a", false], ["screen.home.t.b", "fx b", false], ["screen.home.t.c", "fx c", false]],
  /* no rereads: the act re-reads every read, each shown as loading, so the whole screen is redrawn without the choice for a moment */
  acts: [{ op: "promote", send: fitSend("promote") }],
  render(cs, view) {
    return cs.state("list", (items) => cs.choice("aud", "screen.home.t.l", [["a", "screen.home.t.a"], ["b", "screen.home.t.b"], ["c", "screen.home.t.c"]], { value: "a" })
      + cs.choice("num", "screen.home.t.l", [{ value: 1, text: "one" }, { value: 2, text: "two" }])
      + cs.choice("gone", "screen.home.t.l", [["a", "screen.home.t.a"], ["b", "screen.home.t.b"]], { value: "a" }) + cs.act("promote", { label: "act.promote.label.home", data: { k: "x" } }), { empty: "state.empty" });
  },
};

test("R90 a redraw keeps a choice the member made: the whole-draw reset to its seed, after an act re-reads every read, no longer happens; the seed applies only until the member chooses (control)", async () => {
  const p = await boot({ screens: [AUD], plane: { queue: ok({ items: [1] }) } });
  const pick = (id) => p.doc.getElementById(id);
  assert.ok(p.root().querySelector('#aud option[value="a"]').hasAttribute("selected"), "seeded before the member chooses (control)");
  pick("aud").value = "c"; p.fire(pick("aud"), "change");
  pick("num").value = "2"; p.fire(pick("num"), "change");
  await p.click('button[data-act="promote"]');
  assert.equal(p.byOp("queue").length >= 2, true, "the act re-read the screen's reads");
  assert.equal(pick("aud").value, "c", "kept across the whole redraw");
  assert.ok(p.root().querySelector('#aud option[value="c"]').hasAttribute("selected"));
  assert.equal(pick("num").value, "2", "a numeric option value is kept too");
  assert.equal(pick("gone").value, "a", "a choice the member did not make keeps its seed (control)");
  await p.click('button[data-act="promote"]');
  assert.equal(pick("aud").value, "c", "and after a second act");
  /* a choice leaves nothing in a request or storage */
  assert.ok(p.byOp("promote").every((r) => JSON.stringify(r.body || {}).indexOf('"c"') < 0), "the choice is sent by no op of its own");
});
