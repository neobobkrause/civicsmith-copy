/* interface-shell R7, R8, R9, R20, R26, R28, R30, R35–R37, R43, R45, R48: the working frame and the public and setup frames, the path, the router and unavailable, the dock, the places, the band, the mark and the rail. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { PATHS, FRAMES, PLACE_SCREENS } from "../../../src/interface-shell/index.mjs";
import { fitSend, boot, ok, refused, silent, pending, httpError, STORE_KEY, tabs, SESSION } from "./harness.mjs";
import { ALL, ASSISTANT, FRONT, DOORBELL, PUBLISHED, JOIN, PERSON } from "./screens.fixture.mjs";
import { inWorld, bootAs, obligations } from "./world.mjs";
import { countWithItem } from "../queue/fixtures.mjs";

const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELDA = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] });
const FRAME_ANSWERS = await frameAnswers();
const PLANE = { image: IMAGE, heldcaptures: HELDA, projectdirectory: ok({ projects: [] }) };
const en = (k) => (WORD_ROWS.find((r) => r[0] === k) || [])[1];
const texts = (els) => els.map((e) => e.textContent.trim());
/* R8 (R56: the design's `mk-crumbs`): the path's steps, each earlier one a link, the screen's own name last */
const crumbSteps = (root) => { const nav = root.querySelector(".cs-crumbs"); return nav ? nav.children.filter((e) => e.localName !== "i") : []; };
/* an act pressed through whatever friction its weight asks (R11) */
async function press(p, op) {
  await p.click(`button[data-act="${op}"]`);
  const go = p.root().querySelector('[data-shell="reason-send"], [data-shell="confirm"]');
  if (go) { const ta = p.root().querySelector('[data-slot] textarea'); if (ta) ta.value = "because"; await p.click(go); }
}

test("R7 R60 the masthead: the group's name (groupidentity, read once; \"Your group\" when it has no display name, never its slug), search opening Find, the explanation-level control, the To do count from op=queue, the member's initial; no assistant button while not reachable", async () => {
  const { world, me } = await inWorld();
  const name = (await me.act("groupnameset", { body: { name: "River Town" } })).display_name;
  const items = await obligations(world, me, 3);
  const p = await bootAs(world, me, { screens: ALL, plane: PLANE });
  const mast = p.root().querySelector(".cs-mast");
  assert.equal(mast.querySelector(".mk-grp").textContent, name);
  assert.equal(p.byOp("groupidentity").length, 1);
  await p.click('a[href="/app/settings"]');
  assert.equal(p.byOp("groupidentity").length, 1, "read once");
  const m = p.root().querySelector(".cs-mast");
  assert.equal(m.querySelector('a[href="/app/find"]').textContent, word("shell.search"));
  assert.ok(m.querySelector('a[href="/app/find"]').classList.contains("mk-mastsearch"));
  assert.ok(m.querySelector('[data-shell="level"]').textContent.includes(word("shell.level.button.prompt")));
  assert.equal(m.querySelector('[data-kind="todo"]').textContent, word("shell.todo", { n: items.length }), "R96: the sum of the queue's three kinds");
  assert.equal(m.querySelector('[data-shell="menu"] [aria-hidden]').textContent, me.handle[0].toUpperCase());
  assert.equal(m.querySelector('[data-shell="dock"]'), null);
  /* R60: never the slug: "Your group" when no display name */
  const bare = await inWorld();
  const slug = (await bare.me.read("groupidentity")).group;
  const q = await bootAs(bare.world, bare.me, { screens: ALL, plane: PLANE });
  assert.equal(q.root().querySelector(".cs-mast .mk-grp").textContent, word("shell.group.unnamed"));
  assert.ok(!q.root().innerHTML.includes(slug));
});

test("R7 the band (mark.band.means with mark.path.working.*), the rail's seven places in order with rail.<k>.name and guidance rail.<k>.holds, one column of work, and at the phone width the five tabs Home, Queue, Add, Find, More", async () => {
  const p = await boot({ screens: ALL, plane: { ...FRAME_ANSWERS, ...PLANE } });
  const band = p.root().querySelector(".cs-band");
  assert.equal(band.getAttribute("data-band"), "working");
  assert.equal(band.textContent, word("mark.path.working.name") + " " + word("shell.band.working"), "R57: the band as drawn");
  assert.ok(band.querySelector("[data-tip]").getAttribute("data-tip").startsWith(en("mark.band.means").replace(/'/g, "&#39;")));
  const rail = p.root().querySelectorAll(".cs-rail a");
  assert.deepEqual(texts(rail), Object.keys(PLACE_SCREENS).map((k) => word("rail." + k + ".name") + (k === "queue" ? String(countWithItem().count) : "")), "the shell's places, in its order (R96: the queue's count on Queue alone)");
  rail.forEach((a, i) => assert.ok(a.getAttribute("data-tip").length > 10, i));
  assert.equal(p.root().querySelectorAll("main").length, 1);
  const tabs = p.root().querySelectorAll(".cs-tabs a");
  assert.deepEqual(texts(tabs), [en("rail.home.name"), en("rail.queue.name"), en("rail.add.name"), en("rail.find.name"), en("tab.more.name")]);
  assert.ok(rail[0].hasAttribute("aria-current"));
  const more = await boot({ screens: ALL, path: "/app/more" });
  assert.deepEqual(texts(more.root().querySelectorAll("#cs-main .mk-morerow a")), [word("rail.projects.name"), word("rail.people.name"), word("rail.settings.name")]);
  assert.ok(more.root().querySelectorAll(".cs-tabs a")[4].hasAttribute("aria-current"));
});

test("R7 R37 a place none of whose screens is registered is shown and opens the shell's page saying, in its words, that it comes later", async () => {
  const p = await boot({ screens: ALL });
  await p.click('.cs-rail a[href="/app/people"]');
  const main = p.root().querySelector("#cs-main");
  assert.ok(main.textContent.includes("People comes later"));
  assert.ok(p.root().querySelector('.cs-rail a[href="/app/people"]').hasAttribute("aria-current"));
});

test("R37 the People place opens people and the Settings place opens settings once registered; no working screen draws a link to / (control: before, the shell's settings list names no /)", async () => {
  const people = { id: "people", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const settings = { id: "settings", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const p = await boot({ screens: [...ALL, people, settings] });
  const rail = (k) => p.root().querySelector(".cs-rail a[href='/app/" + k + "']");
  assert.ok(rail("people") && rail("settings"));
  await p.click(rail("people"));
  assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), "people");
  assert.ok(p.root().querySelector('.cs-rail a[href="/app/people"]').hasAttribute("aria-current"));
  await p.click(rail("settings"));
  assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), "settings");
  for (const path of ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings", "/app/people", "/app/more"]) {
    const q = await boot({ screens: [...ALL, people, settings], path, plane: PLANE });
    assert.equal(q.root().querySelectorAll('a[href="/"]').length, 0, path);
  }
  const r = await boot({ screens: ALL, path: "/app/settings" });
  assert.equal(r.root().querySelectorAll('a[href="/"]').length, 0);
  assert.deepEqual(texts(r.root().querySelectorAll("#cs-main .cs-row a")), ["Members"], "the settings screens registered");
});

test("R8 every screen opens its main area with its path, from its rail place to its own name (last, the current page), each earlier step a link, the project's step its title as read", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  const nav = p.root().querySelector("#cs-main").children[0];
  assert.equal(nav.localName, "nav");
  assert.equal(nav.getAttribute("aria-label"), word("shell.path"));
  const steps = crumbSteps(p.root());
  assert.deepEqual(texts(steps), [word("rail.projects.name"), "Pothole repairs", word("screen.document.name")]);
  assert.equal(steps[0].getAttribute("href"), "/app/projects");
  assert.equal(steps[1].getAttribute("href"), "/app/project/P1");
  assert.equal(steps[2].localName === "a", false);
  assert.equal(steps[2].getAttribute("aria-current"), "page");
  assert.equal(steps[2].textContent, word("screen.document.name"));
  assert.equal(p.root().querySelector("#cs-main").children[1].textContent, "A lease", "the heading below names the thing shown");
  const h = await boot({ screens: ALL, path: "/app/held", plane: PLANE });
  assert.deepEqual(texts(crumbSteps(h.root())), [word("rail.add.name"), word("screen.held.name")]);
  const m = await boot({ screens: ALL, path: "/app/members" });
  assert.deepEqual(texts(crumbSteps(m.root())), [word("rail.settings.name"), word("screen.members.name")]);
});

const pathAt = (commit) => {
  const src = execFileSync("git", ["show", commit + ":docs/development/ux-substrate/screens/mock-shell.js"], { encoding: "utf8" });
  return new Function(/(const PATH = \{[\s\S]*?\n\};)/.exec(src)[1] + "; return PATH;")();
};
const PROJECTS = new Set(["The Coliseum lease", "Pothole repairs", "Sewer fund transfers"]);
const step = (s) => (s === "@project" ? "@project" : /\.crumb$/.test(s) ? word(s, { name: "<name>" }) : /^(shell|screen)\./.test(s) ? word(s) : word("rail." + s + ".name"));
const T46 = ["home", "queue", "inbox", "finder", "answers", "capture", "held", "open-file", "find-in", "project", "document", "question", "assistant", "members", "account", "connect", "notes"];

test("R8 each screen's path is mock-shell.js' PATH for its id at 3f40899950, a project's step its title (members: Settings › Members; held: Add › Held captures; document: Projects › <project> › Document)", () => {
  const PATH = pathAt("3f40899950");
  for (const id of T46) {
    const mock = id === "answers" ? ["Find", "Ask"] : PATH[id].map((x) => (PROJECTS.has(x) ? "@project" : x));
    assert.deepEqual(PATHS[id].map(step), mock, id);
  }
  assert.deepEqual(PATHS.members.map(step), [word("rail.settings.name"), word("screen.members.name")]);
  assert.deepEqual(PATHS.held.map(step), [word("rail.add.name"), word("screen.held.name")]);
  assert.deepEqual(PATHS.document.map(step), [word("rail.projects.name"), "@project", word("screen.document.name")]);
});

test("R28 every screen of the new screen modules has its path from mock-shell.js' PATH at a0fab7abf0 (plan: Projects › <project> › Action plan; wizards: Settings › Wizards; due-date: Queue › Due date; person: People › Person), and L11's screens from PATH at PR #33's head; the public, published and setup frames have none", async () => {
  const A = pathAt("a0fab7abf0"), B = pathAt("f90b187c7b");
  const NEW = ["wizards", "person", "explore", "timeline", "money", "calculation", "proceeding", "due-date", "standard", "ties", "case-editor", "review-copy", "ceremony", "imported", "docket", "plan", "start-send", "request", "action", "matter", "archive", "group-identity", "security", "translations"];
  /* the design's PATH is in its words of the day; the interface says "team" where it said "group" (setup-words) */
  const team = (x) => x.replace(/\bgroup('s)?\b/g, "team$1");
  /* R110 (K4217): the standard's last step is the design's crumb word (DEC-384 entry 9), not its name; every step before it is the design's */
  for (const id of NEW) assert.deepEqual(PATHS[id].map(step).map(team), A[id].map((x) => (PROJECTS.has(x) ? "@project" : x)).map(team).map((x, i, all) => (id === "standard" && i === all.length - 1 ? step("screen.standard.crumb") : x)), id);
  for (const id of ["people", "settings", "projects", "group", "places", "recovery"]) assert.deepEqual(PATHS[id].map(step).map(team), B[id].map(team), id);
  assert.deepEqual(PATHS.plan.map(step), [word("rail.projects.name"), "@project", word("screen.plan.name")]);
  assert.deepEqual(PATHS.wizards.map(step), [word("rail.settings.name"), word("screen.wizards.name")]);
  assert.deepEqual(PATHS["due-date"].map(step), [word("rail.queue.name"), word("shell.step.due-date")]);
  assert.deepEqual(PATHS.person.map(step), [word("rail.people.name"), word("screen.person.name")]);
  for (const [id, frame] of Object.entries(FRAMES)) if (frame !== "dock") assert.equal(PATHS[id], undefined, id);
  /* drawn: a person's path with its place linked */
  const p = await boot({ screens: [...ALL, PERSON], path: "/app/person/x1", plane: { person: ok({ name: "Dana Ruiz" }) } });
  assert.deepEqual(texts(crumbSteps(p.root())), [word("rail.people.name"), word("screen.person.name")]);
});

test("R9 the router maps /app to home and /app/<screen>[/<subject>] to that screen with that subject, keeps the browser's history (back and forward redraw), and answers an unknown screen or a subject the read does not find with Nothing here, never a blank page", async () => {
  const p = await boot({ screens: ALL, plane: PLANE });
  assert.ok(p.root().querySelector("#cs-main h1").textContent.includes("home"));
  await p.click('.cs-rail a[href="/app/settings"]');
  assert.equal(p.location.pathname, "/app/settings");
  await p.back("/app");
  assert.ok(p.root().querySelector("#cs-main h1").textContent.includes("home"));
  await p.back("/app/document/c1");
  assert.equal(p.byOp("image").at(-1).query.id, "c1");
  assert.equal(p.root().querySelector("#cs-main h1").textContent, "A lease");
  for (const [path, plane] of [["/app/nowhere", PLANE], ["/app/document/zz", { ...PLANE, image: refused("NO_SUCH_CAPTURE", "No such capture.") }], ["/app/document/zz", { ...PLANE, image: ok(null) }]]) {
    const q = await boot({ screens: ALL, path, plane });
    const main = q.root().querySelector("#cs-main");
    assert.ok(main.querySelector('[data-state="empty"]'), path);
    assert.ok(main.textContent.includes(word("shell.unavailable.nothing.title")), path);
  }
  /* control: a read that failed for another reason is "could not read", not "Nothing here" */
  const f = await boot({ screens: ALL, path: "/app/document/zz", plane: { ...PLANE, image: refused("NOT_ALLOWED", "Not yours.") } });
  assert.ok(f.root().querySelector('#cs-main [data-state="failed"]'));
});

test("R20 the assistant is reachable when assistantstate answers on and the member's own reference, a connected subscription, or the group's key held and on serves; then the masthead's button opens the dock with screens-inquiry's panel beside the screen; otherwise no assistant control anywhere", async () => {
  const reach = async (plane) => boot({ screens: ALL, path: "/app/document/c1", plane: { ...PLANE, ...plane } });
  const ON = { assistantstate: ok({ on: true }) };
  for (const plane of [{ ...ON, accountreference: ok({ held: true }) }, { ...ON, subscriptionsignin: ok({ connected: true }) }, { ...ON, groupkeystate: ok({ held: true, on: true }) }, { ...ON, groupkeystate: ok({ on: true }) }]) {
    const p = await reach(plane);
    const b = p.root().querySelector('.cs-mast [data-shell="dock"]');
    assert.ok(b, JSON.stringify(plane));
    assert.equal(p.root().querySelector(".cs-dock"), null);
    await p.click(b);
    const dock = p.root().querySelector(".cs-dock");
    assert.ok(dock.querySelector('button[data-act="airunopen"]'));
    assert.ok(p.root().querySelector("#cs-frame").classList.contains("with-dock"));
    assert.ok(p.root().querySelector("#cs-main"), "beside the screen it serves");
    await p.click(dock.querySelector('button[data-act="airunopen"]'));
    assert.deepEqual([p.byOp("airunopen")[0].body.contextType, p.byOp("airunopen")[0].body.contextId], ["document", "c1"]);
  }
  const NOT = [{ assistantstate: ok({ on: false }), accountreference: ok({ held: true }) }, { ...ON }, { ...ON, groupkeystate: ok({ held: true, on: false }) },
    { ...ON, groupkeystate: ok({ held: false, on: true }) }, { assistantstate: silent, accountreference: ok({ held: true }) },
    { ...ON, accountreference: refused("NOT_YOUR_ACCOUNT") }, { assistantstate: pending, accountreference: ok({ held: true }) }];
  for (const plane of NOT) {
    const p = await reach(plane);
    assert.equal(p.root().querySelector('[data-shell="dock"]'), null, JSON.stringify(plane));
    assert.equal(p.root().querySelector(".cs-dock"), null);
    assert.equal(p.root().querySelector('[data-act="airunopen"]'), null);
  }
  assert.deepEqual(ALL.map((s) => s.id).includes(ASSISTANT.id), true);
});

test("R26 the rail's width: 184 px by default, 64 to 320, set by the keyboard (arrows, Home resets) or by dragging its edge, kept on the device and never sent; the tabs unchanged by it; a storage that cannot be read or written leaves the default", async () => {
  const p = await boot({ screens: ALL });
  const frame = () => p.root().querySelector("#cs-frame");
  assert.match(frame().getAttribute("style"), /--rail:184px/);
  const grip = () => p.root().querySelector('[data-shell="grip"]');
  assert.equal(grip().getAttribute("aria-valuemin"), "64");
  assert.equal(grip().getAttribute("aria-valuemax"), "320");
  grip().focus();
  p.fire(grip(), "keydown", { key: "ArrowRight" }); await p.settle();
  assert.match(frame().getAttribute("style"), /--rail:192px/);
  for (let i = 0; i < 40; i++) p.fire(grip(), "keydown", { key: "ArrowRight" });
  await p.settle();
  assert.match(frame().getAttribute("style"), /--rail:320px/);
  for (let i = 0; i < 60; i++) p.fire(grip(), "keydown", { key: "ArrowLeft" });
  await p.settle();
  assert.match(frame().getAttribute("style"), /--rail:64px/);
  assert.ok(frame().classList.contains("rail-icons"));
  assert.equal(p.local.get("cs-railw"), "64");
  p.fire(grip(), "keydown", { key: "Home" }); await p.settle();
  assert.match(frame().getAttribute("style"), /--rail:184px/);
  /* dragging */
  p.fire(grip(), "pointerdown", { clientX: 184 });
  for (const f of p.win.listeners.pointermove || []) f({ clientX: 250 });
  for (const f of p.win.listeners.pointerup || []) f({});
  await p.settle();
  assert.match(frame().getAttribute("style"), /--rail:250px/);
  assert.equal(p.local.get("cs-railw"), "250");
  /* what a request carries (its address, query, body and headers), never its timing stamp, in which "250" may occur by chance */
  for (const r of p.requests) { const sent = JSON.stringify({ url: r.url, query: r.query, body: r.body, headers: r.headers }); assert.ok(!/\b250\b/.test(sent) && !/railw/.test(sent)); }
  assert.equal(p.root().querySelector(".cs-tabs").getAttribute("style"), null);
  const q = await boot({ screens: ALL, local: { "cs-railw": "250" } });
  assert.match(q.root().querySelector("#cs-frame").getAttribute("style"), /--rail:250px/);
  for (const bad of [{ local: { "cs-railw": "900" } }, { localThrows: true }]) {
    const r = await boot({ screens: ALL, ...bad });
    assert.match(r.root().querySelector("#cs-frame").getAttribute("style"), /--rail:184px/);
  }
});


test("R132 (DEC-155) a double-click on the rail's edge restores 184 px and keeps it, though the grip was redrawn by the drag before; control: a double-click elsewhere changes nothing", async () => {
  const p = await boot({ screens: ALL });
  const grip = () => p.root().querySelector('[data-shell="grip"]');
  p.fire(grip(), "pointerdown", { clientX: 184 });
  for (const f of p.win.listeners.pointermove || []) f({ clientX: 263 });
  for (const f of p.win.listeners.pointerup || []) f({});
  await p.settle();
  assert.equal(grip().getAttribute("aria-valuenow"), "263");
  assert.equal(p.local.get("cs-railw"), "263");
  p.fire(p.root().querySelector(".cs-rail a"), "dblclick");
  await p.settle();
  assert.equal(grip().getAttribute("aria-valuenow"), "263", "elsewhere changes nothing");
  p.fire(grip(), "dblclick");
  await p.settle();
  assert.equal(grip().getAttribute("aria-valuenow"), "184");
  assert.equal(p.local.get("cs-railw"), "184");
  assert.match(p.root().querySelector("#cs-frame").getAttribute("style"), /--rail:184px/);
});

test("R9 /app/review maps to review-outside (screens-publish R17), drawn in its published frame", async () => {
  const review = { id: "review-outside", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const p = await boot({ screens: [...ALL, review], path: "/app/review", session: null });
  assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), "review-outside");
  assert.equal(p.root().querySelector("#cs-frame").getAttribute("data-frame"), "published");
  /* control: another address under /app/review/ keeps its subject */
  const q = await boot({ screens: [...ALL, review], path: "/app/review/abc", session: null });
  assert.equal(q.root().querySelector("#cs-main").getAttribute("data-screen"), "review-outside");
});

test("R35 unavailable: an unknown screen or subject draws Nothing is here; NOT_VISIBLE and NOT_A_PARTICIPANT draw You can't open this; no answer or a 5xx draws can't be reached, tried again every 30 seconds in the background, what was typed kept", async () => {
  const states = [["/app/nowhere", {}, "nothing"], ["/app/document/zz", { image: refused("NO_SUCH_CAPTURE") }, "nothing"], ["/app/document/zz", { image: ok(null) }, "nothing"],
    ["/app/document/zz", { image: refused("NOT_VISIBLE", "Not yours.") }, "notyours"], ["/app/document/zz", { image: refused("NOT_A_PARTICIPANT") }, "notyours"],
    ["/app/document/zz", { image: silent }, "unreachable"], ["/app/document/zz", { image: httpError(503) }, "unreachable"]];
  const SAY = { nothing: word("shell.unavailable.nothing.title"), notyours: word("shell.unavailable.notyours.title"), unreachable: word("shell.unavailable.unreachable.title") };
  for (const [path, plane, kind] of states) {
    const p = await boot({ screens: ALL, path, plane: { ...PLANE, ...plane } });
    const u = p.root().querySelector("[data-unavailable]");
    assert.equal(u && u.getAttribute("data-unavailable"), kind, path + " " + JSON.stringify(plane));
    /* K3177 (b): one state's words: its heading and its path step, never another state's */
    const main = p.root().querySelector("#cs-main");
    assert.equal(main.querySelector("h1").textContent, SAY[kind], kind);
    assert.equal(main.querySelector('[aria-current="page"]').textContent, SAY[kind], kind);
    for (const other of Object.keys(SAY).filter((k) => k !== kind)) assert.ok(!main.textContent.toLowerCase().includes(SAY[other].toLowerCase()), kind + " draws none of " + other);
    assert.ok(!main.textContent.includes(word("screen.unavailable.name")), "control: the screen's name heads no state");
  }
  /* control: a read that failed for another reason is "could not read", not unavailable */
  const f = await boot({ screens: ALL, path: "/app/document/zz", plane: { ...PLANE, image: refused("NOT_ALLOWED", "Not yours.") } });
  assert.equal(f.root().querySelector("[data-unavailable]"), null);
  assert.ok(f.root().querySelector('#cs-main [data-state="failed"]'));
  /* retried every 30 seconds, in the background; what was typed comes back with the screen */
  let up = false;
  const form = { id: "document", reads: (view) => ({ d: { op: "image", query: { id: view.subject }, subject: true } }), acts: [],
    render: (cs, view) => cs.state("d", view, (d) => cs.title(d.title)) + cs.field("note", "shell.reason") };
  const r = await boot({ screens: [form], path: "/app/document/c1", plane: { image: () => (up ? IMAGE : silent) } });
  assert.ok(r.root().querySelector('[data-unavailable="unreachable"]'));
  up = true;
  await r.clock.tick(29_999);
  assert.ok(r.root().querySelector('[data-unavailable="unreachable"]'));
  await r.clock.tick(1);
  assert.equal(r.root().querySelector("[data-unavailable]"), null);
  assert.equal(r.byOp("image").at(-1).query.background, "1");
  r.doc.getElementById("note").value = "typed";
  up = false;
  await r.click('a[href="/app/document/c1"]') .catch(() => null);
  await r.back("/app/document/c1");
  assert.ok(r.root().querySelector('[data-unavailable="unreachable"]'));
});

test("R35 what was typed is kept while the screen can't be reached and comes back with it", async () => {
  let up = true;
  const s = { id: "document", reads: (view) => ({ d: { op: "image", query: { id: view.subject }, subject: true } }), acts: [{ op: "cite", send: fitSend("cite") }],
    render: (cs, view) => cs.state("d", view, (d) => cs.title(d.title)) + cs.field("note", "shell.reason") + cs.act("cite") };
  const p = await boot({ screens: [s], path: "/app/document/c1", plane: { image: () => (up ? IMAGE : silent) } });
  p.doc.getElementById("note").value = "kept words";
  up = false;
  await p.click('button[data-act="cite"]');
  assert.ok(p.root().querySelector('[data-unavailable="unreachable"]'), "the re-read after the act found nobody");
  up = true;
  await p.clock.tick(30_000);
  assert.equal(p.doc.getElementById("note").value, "kept words");
});

test("R30 a screen of the public or published frame is drawn without a session: no session record asked, no whoami, no rail, tabs, dock or member menu, and only public ops, each with no Authorization header", async () => {
  for (const [path, screen, session] of [["/app/doorbell", "doorbell", null], ["/app/doorbell", "doorbell", undefined], ["/app/published/c9", "published", null]]) {
    const opts = { screens: [...ALL, DOORBELL, PUBLISHED], path, plane: { publishedcase: ok({ title: "The case" }) } };
    if (session === null) opts.session = null;
    const p = await boot(opts);
    assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), screen, path);
    assert.equal(p.byOp("whoami").length, 0, path);
    for (const sel of [".cs-rail", ".cs-tabs", ".cs-dock", '[data-shell="menu"]', ".cs-mast"]) assert.equal(p.root().querySelector(sel), null, sel);
    for (const r of p.requests.filter((x) => x.op !== "bootstrap")) assert.equal(r.headers.Authorization, undefined, r.op);
  }
  const p = await boot({ screens: [...ALL, DOORBELL], path: "/app/doorbell", session: null });
  p.doc.getElementById("d-what").value = "a leaked memo";
  await p.click('button[data-act="knock"]');
  assert.equal(p.byOp("knock")[0].headers.Authorization, undefined);
  assert.deepEqual(p.byOp("knock")[0].body, { content: "a leaked memo" });
  /* control: /app/home with no record still draws front, never the working frame */
  const q = await boot({ screens: [...ALL, FRONT], path: "/app/home", session: null });
  assert.equal(q.root().querySelector("#cs-main").getAttribute("data-screen"), "front");
  assert.equal(q.byOp("whoami").length, 0);
});

test("R45 a screen of the setup frame is drawn without rail, tabs or dock, with or without a record: before one, no whoami and only public ops with no header; once its own act has made one, the acts R12 allows", async () => {
  /* the invitation is the administrator's real `memberadd`; the enrolment, the sign-in and the reads after it are the world's */
  const { world, me } = await inWorld();
  const { invite } = await me.act("memberadd", { body: { memberId: "newbie", cover: "the world's new member" } });
  const p = await bootAs(world, null, { screens: [...ALL, JOIN], path: "/app/join", hash: "#invite=" + invite });
  assert.equal(p.root().querySelector("#cs-frame").getAttribute("data-frame"), "setup");
  for (const sel of [".cs-rail", ".cs-tabs", ".cs-dock", ".cs-mast"]) assert.equal(p.root().querySelector(sel), null, sel);
  assert.equal(p.byOp("whoami").length, 0);
  assert.ok(p.root().querySelector('button[data-act="enroll"]'), "a public act drawn");
  assert.equal(p.root().querySelector('button[data-act="memberlanguageset"]'), null, "a member's act is not, before a session");
  p.doc.getElementById("j-handle").value = "newbie";
  p.doc.getElementById("j-pass").value = "pw-pw-pw-pw-pw";
  await press(p, "enroll");
  assert.equal(p.byOp("enroll")[0].headers.Authorization, undefined);
  assert.equal(p.byOp("login")[0].headers.Authorization, undefined);
  const token = JSON.parse(p.local.get(STORE_KEY)).t;
  assert.ok(token && !/^tok-/.test(token), "the world's own session token");
  assert.equal(p.byOp("whoami")[0].headers.Authorization, "Bearer " + token);
  assert.equal(p.location.pathname, "/app/join", "stays on the screen");
  assert.ok(p.root().querySelector('button[data-act="memberlanguageset"]'), "R12 now allows the member's act");
  await press(p, "memberlanguageset");
  assert.equal(p.byOp("memberlanguageset")[0].headers.Authorization, "Bearer " + token);
  /* control: R3's front does not apply: /app/join with no record draws join and sends no header */
  const q = await boot({ screens: [...ALL, JOIN, FRONT], path: "/app/join", session: null });
  assert.equal(q.root().querySelector("#cs-main").getAttribute("data-screen"), "join");
  for (const r of q.requests) assert.equal(r.headers.Authorization, undefined, r.op);
});

test("R36 /#invite= and /#join= forward to /app/join, /#boot= to /app/setup, the fragment carried (and read once, R46) and nothing else; no fragment reaches a request", async () => {
  const setup = { id: "setup", reads: () => ({}), acts: [], render: (cs, view) => "<p id=frag>" + cs.esc(JSON.stringify(view.fragment)) + "</p>" };
  const join = { id: "join", reads: () => ({}), acts: [], render: (cs, view) => "<p id=frag>" + cs.esc(JSON.stringify(view.fragment)) + "</p>" };
  for (const [hash, to, frag] of [["#invite=INV-123", "/app/join", { invite: "INV-123" }], ["#join=JL-9", "/app/join", { join: "JL-9" }], ["#boot=BOOT-SECRET", "/app/setup", { boot: "BOOT-SECRET" }]]) {
    const p = await boot({ screens: [...ALL, setup, join], path: "/", hash, session: null });
    assert.equal(p.location.pathname, to, hash);
    assert.equal(p.location.hash, "", "removed from the address");
    assert.deepEqual(JSON.parse(p.doc.getElementById("frag").textContent), frag);
    for (const r of p.requests) { assert.ok(!r.url.includes(hash.slice(1)), r.url); assert.ok(!JSON.stringify(r).includes(Object.values(frag)[0])); }
    for (const v of [...p.store.values(), ...p.local.values()]) assert.ok(!String(v).includes(Object.values(frag)[0]));
  }
});

test("R36 while bootstrap answers test_instance true every frame shows the test-instance band; otherwise none", async () => {
  for (const [path, screens, session] of [["/app", ALL, undefined], ["/app/doorbell", [...ALL, DOORBELL], null], ["/app/join", [...ALL, JOIN], null]]) {
    const opts = { screens, path, plane: { bootstrap: ok({ test_instance: true }) } };
    if (session === null) opts.session = null;
    const p = await boot(opts);
    /* R53: above the frame, never inside its columns */
    const band = p.doc.getElementById("cs-testband");
    assert.ok(band, path);
    assert.equal(p.root().contains(band), false, path);
    assert.ok(band.getAttribute("data-band") === "test" && band.textContent.includes(word("instance.test.band")), path);
    assert.equal(p.byOp("bootstrap")[0].headers.Authorization, session === null ? undefined : "Bearer " + SESSION.t, "R71: under the page's session when it holds one, else none");
  }
  for (const b of [ok({ test_instance: false }), ok({}), silent, refused("NO")]) {
    const q = await boot({ screens: ALL, plane: { bootstrap: b } });
    assert.equal(q.doc.querySelector(".cs-band[data-band=test]"), null);
  }
});

test("R43 every working screen's masthead opens with the mark (the plumb bob, before the group's name), explaining itself; the public frame's page body draws none", async () => {
  for (const path of ["/app", "/app/held", "/app/settings", "/app/nowhere"]) {
    const p = await boot({ screens: ALL, path, plane: { ...FRAME_ANSWERS, ...PLANE } });
    const mast = p.root().querySelector(".cs-mast");
    const mark = mast.children[0];
    assert.ok(mark.classList.contains("cs-mark"), path);
    assert.equal(mark.querySelector("use").getAttribute("href"), "/app/assets/icons.svg#i-mark");
    assert.equal(mark.nextElementSibling.classList.contains("mk-grp"), true, "before the team's name");
    assert.equal(mark.getAttribute("aria-label"), word("shell.mark"));
    assert.ok(mark.getAttribute("data-tip").includes(word("shell.mark.means").replace(/'/g, "&#39;")));
    assert.equal(mark.getAttribute("data-level"), "1");
  }
  const q = await boot({ screens: [...ALL, DOORBELL], path: "/app/doorbell", session: null });
  assert.equal(q.root().querySelector(".cs-mark"), null);
});

test("R48 the main frame's root carries data-screen of the registered screen it drew; the shell's own fallbacks carry none", async () => {
  const cases = [["/app", "home"], ["/app/held", "held"], ["/app/document/c1", "document"], ["/app/settings", null], ["/app/people", null], ["/app/nowhere", null], ["/app/more", null]];
  for (const [path, id] of cases) {
    const p = await boot({ screens: ALL, path, plane: { ...FRAME_ANSWERS, ...PLANE } });
    assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), id, path);
  }
  const nf = await boot({ screens: ALL, path: "/app/document/zz", plane: { ...PLANE, image: refused("NO_SUCH_CAPTURE") } });
  assert.equal(nf.root().querySelector("#cs-main").getAttribute("data-screen"), null, "a subject not found");
  const d = await boot({ screens: [...ALL, DOORBELL], path: "/app/doorbell", session: null });
  assert.equal(d.root().querySelector("#cs-main").getAttribute("data-screen"), "doorbell", "the public frame's root");
});

test("R30 R32 a public screen asks no session record: the record is not read while it is drawn, and is read once a working screen needs it; another tab's sign-in leaves a public or setup screen as it is", async () => {
  const reads = [];
  const p = await boot({ screens: [...ALL, DOORBELL], path: "/app/doorbell" });
  const get = p.win.localStorage.getItem;
  p.win.localStorage.getItem = (k) => { reads.push(k); return get(k); };
  await p.back("/app/doorbell");
  assert.ok(!reads.includes(STORE_KEY), "not read for the public frame");
  await p.back("/app/held");
  assert.ok(reads.includes(STORE_KEY), "read once a working screen needs it");
  assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), "held");
  /* another tab signs in: the doorbell and join stay where they are; a tab on front opens the page kept */
  const t = tabs();
  const door = await boot({ screens: [...ALL, DOORBELL, FRONT], tabs: t, session: null, path: "/app/doorbell" });
  const joining = await boot({ screens: [...ALL, JOIN, FRONT], tabs: t, session: null, path: "/app/join" });
  const front = await boot({ screens: [...ALL, FRONT], tabs: t, session: null, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  const signer = await boot({ screens: [...ALL, FRONT], tabs: t, session: null, path: "/", plane: { login: ok({ token: "tok-9", expires: 0 }) } });
  signer.doc.getElementById("f-handle").value = "mai";
  await signer.click('button[data-act="login"]');
  for (const x of [door, joining, front]) await x.settle();
  assert.equal(door.location.pathname, "/app/doorbell");
  assert.equal(door.root().querySelector("#cs-main").getAttribute("data-screen"), "doorbell");
  assert.equal(joining.location.pathname, "/app/join");
  assert.equal(joining.root().querySelector("#cs-main").getAttribute("data-screen"), "join");
  assert.equal(front.root().querySelector("#cs-main").getAttribute("data-screen"), "held");
});

test("R7 R4 R60 (K3177 (c)) the member's avatar is drawn from the signed-in member's handle: a founder's whoami answering no handle draws the handle signed in with; with none at all, the avatar's icon, never the member's record id; control: whoami's handle wins", async () => {
  const you = (p) => p.root().querySelector('[data-shell="menu"]');
  const founder = await boot({ screens: ALL, session: { t: "tok-f", e: 0, d: "own", w: "admin" }, plane: { whoami: ok({ tokenClass: "admin", session: true, member: "m-1", handle: null, administer: true, rootOfTrust: true, capabilities: ["contribute"] }) } });
  assert.equal(you(founder).querySelector('span[aria-hidden="true"]').textContent, "A");
  assert.equal(you(founder).getAttribute("aria-label"), "You: admin");
  assert.ok(you(founder).classList.contains("mk-avatar"));
  const bare = await boot({ screens: ALL, session: { t: "tok-f", e: 0, d: "own", w: "" }, plane: { whoami: ok({ tokenClass: "admin", session: true, member: "m-7f3a", handle: null, administer: true, capabilities: [] }) } });
  assert.equal(you(bare).querySelector("span"), null);
  assert.ok(you(bare).querySelector("svg"), "the avatar's icon");
  assert.ok(you(bare).getAttribute("aria-label").length > 0);
  assert.ok(!bare.root().innerHTML.includes("m-7f3a"), "R60: no record id drawn");
  const member = await boot({ screens: ALL, session: { t: "tok-1", e: 0, d: "own", w: "other" } });
  assert.equal(you(member).querySelector('[aria-hidden="true"]').textContent, "M");
});
