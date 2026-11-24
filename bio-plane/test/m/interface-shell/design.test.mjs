/* interface-shell R52–R64 (T48; the L11 design fold of WALK-084 #2, K3250, K3254): no help cursor, the test band across
   the frame and from first paint, the paths of `elsewhere` and `updates`, T48's re-points, the two stylesheets and the
   undefined class refused, the phone frame, the guide's marks in the title row, no zero and no slug, absence and a
   refusal's own words, fields and rows as designed, More as rows, and the rungless acts' marks. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { interfacePage, interfaceScript, checkScreens, classLiterals, stylesheetClasses, HOOK_CLASSES, PATHS, RE_POINTS, SETTINGS_SCREENS } from "../../../src/interface-shell/index.mjs";
import { ADMIN_SCREENS } from "../../../src/wizard-scripts/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { MARKS } from "../../../src/op-grades/index.mjs";
import { fitSend, boot, ok, refused, httpError, ADMIN, MEMBER } from "./harness.mjs";
import { inWorld, bootAs, obligations } from "./world.mjs";
import { documentOf } from "./dom.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { ALL, HELD } from "./screens.fixture.mjs";

const styleOf = (html) => /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const btn = (p, op) => p.root().querySelector(`button[data-act="${op}"]`);
/* a screen's function as its own source text, so a value it names travels with it into the page (R21's contract) */
const fn = (body) => new Function("cs", "view", body);
const DESIGN_WORDS = new Map(JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words.map((r) => [r.key, r.en]));

test("R52 no style the shell carries gives cursor: help to any element, nor a pointer to an element that only explains itself; control: the rail's grip keeps col-resize and cs.areas crosshair", () => {
  const style = styleOf(interfacePage(ALL));
  assert.doesNotMatch(style, /cursor\s*:\s*help/);
  assert.doesNotMatch(style, /cursor\s*:\s*pointer/, "the shell styles no control's cursor of its own; civicsmith.css does");
  assert.doesNotMatch(style, /\.cs-mark\b/, "the mark's rule is the design's, in shell.css");
  /* control: the cursor still changes over a control */
  assert.match(ASSET_FILES["shell.css"].body, /\.mk-imgareas\s*\{[^}]*cursor:\s*crosshair/, "the areas control is the design's, with its crosshair");
  assert.match(ASSET_FILES["civicsmith.css"].body, /\.cs-grip\s*\{[^}]*cursor:\s*col-resize/);
});

test("R53 the test-instance band spans the working frame: above the frame, outside the rail's column and every column, at both widths; its sentence instance.test.notice; control: no band while bootstrap answers test_instance other than true", async () => {
  for (const phone of [false, true]) {
    const p = await boot({ screens: ALL, phone, plane: { bootstrap: ok({ test_instance: true }) } });
    const band = p.doc.getElementById("cs-testband");
    assert.ok(band, "drawn");
    assert.ok(band.classList.contains("cs-band") && band.getAttribute("data-band") === "test", "R67: the design's band");
    assert.equal(band.parentElement, p.doc.body, "a block of the page, not of a column");
    assert.equal(band.nextElementSibling, p.root(), "directly above the frame");
    assert.equal(p.root().querySelector(".cs-band[data-band=test]"), null, "never inside the rail or the work");
    assert.equal(p.root().children[0].getAttribute("data-frame"), "working");
    assert.ok(band.textContent.includes(word("instance.test.band")) && band.textContent.includes(word("instance.test.notice")));
    /* as wide as the frame: the body is one column (R57's page rules), the band and the frame each its full width */
    assert.match(styleOf(p.html), /body\.cs\{[^}]*flex-direction:column/);
  }
  for (const b of [ok({ test_instance: false }), ok({})]) {
    const q = await boot({ screens: ALL, plane: { bootstrap: b } });
    assert.equal(q.doc.getElementById("cs-testband"), null);
  }
});

test("R54 the paths of the screens PR #34's registry adds are mock-shell.js' PATH at its merge (4664e8efd4): elsewhere Home › Where else to go, updates Settings › Updates; each drawn; Updates listed among the Settings sections after Security only for a member who administers (control: a member sees none)", async () => {
  const src = execFileSync("git", ["show", "4664e8efd4:docs/development/ux-substrate/screens/mock-shell.js"], { encoding: "utf8" });
  const PATH = new Function(/(const PATH = \{[\s\S]*?\n\};)/.exec(src)[1] + "; return PATH;")();
  const step = (k) => (/^screen\./.test(k) ? DESIGN_WORDS.get(k) : DESIGN_WORDS.get("rail." + k + ".name"));
  assert.deepEqual(PATHS.elsewhere.map(step), PATH.elsewhere);
  assert.deepEqual(PATHS.updates.map(step), PATH.updates);
  assert.deepEqual(PATH.elsewhere, [word("rail.home.name"), word("screen.elsewhere.name")]);
  assert.deepEqual(PATH.updates, [word("rail.settings.name"), word("screen.updates.name")]);
  assert.equal(SETTINGS_SCREENS.indexOf("updates"), SETTINGS_SCREENS.indexOf("security") + 1, "after Security");
  assert.deepEqual(ADMIN_SCREENS, ["updates"]);
  /* drawn: each path, its place linked and current */
  const own = (id) => ({ id, reads: () => ({}), acts: [], render: (cs) => cs.title() });
  for (const [id, place, words] of [["elsewhere", "home", [word("rail.home.name"), word("screen.elsewhere.name")]], ["updates", "settings", [word("rail.settings.name"), word("screen.updates.name")]]]) {
    const p = await boot({ screens: [...ALL, own(id)], path: "/app/" + id, plane: { whoami: ok(ADMIN) } });
    const steps = p.root().querySelector(".cs-crumbs").children.filter((e) => e.localName !== "i");
    assert.deepEqual(steps.map((e) => e.textContent), words, id);
    assert.equal(steps[0].getAttribute("href"), place === "home" ? "/app" : "/app/" + place);
    assert.ok(p.root().querySelector(`.cs-rail a[href="${place === "home" ? "/app" : "/app/" + place}"]`).hasAttribute("aria-current"), id);
  }
  /* the Settings sections: Updates after Security, for an administrator only */
  const screens = [...ALL, own("security"), own("updates")];
  const listed = async (who) => (await boot({ screens, path: "/app/settings", plane: { whoami: ok(who) } })).root().querySelectorAll("#cs-main .cs-row a").map((a) => a.getAttribute("href"));
  assert.deepEqual(await listed(ADMIN), ["/app/members", "/app/security", "/app/updates"]);
  assert.deepEqual(await listed(MEMBER), ["/app/members", "/app/security"], "control: a member who does not administer sees no Updates");
});

test("R55 (amended by R73) the one op a screen needs that the registry does not list stays a named re-point: stepsourcewithdraw on explore; control: a screen naming another unlisted op still throws", () => {
  assert.deepEqual(RE_POINTS, { explore: ["stepsourcewithdraw"], document: ["readheld", "resolve"], person: ["linecurrentthrough"], setup: ["factconfirm"], question: ["leggrade"], queue: ["signerknown"] });
  const r = (id, ...ops) => ({ id, render: () => "", acts: ops.map((op) => ({ op })) });
  assert.equal(checkScreens([r("explore", "stepsourcewithdraw")]), true);
  assert.ok(interfacePage([r("explore", "stepsourcewithdraw")]).length > 1000, "served");
  assert.throws(() => checkScreens([r("plan", "stepsourcewithdraw")]), /plan.*stepsourcewithdraw/);
  assert.throws(() => checkScreens([r("plan", "retire")]), /plan.*retire/);
});
test("R56 the page links civicsmith.css and then shell.css, both before its own style; interfacePage throws, naming the screen and the class, for a class no served stylesheet defines; control: a stand-in drawing mk-door composes", () => {
  const html = interfacePage(ALL);
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(links, ["/app/assets/civicsmith.css", "/app/assets/shell.css"]);
  assert.ok(html.indexOf("/app/assets/shell.css") < html.indexOf("<style>"));
  assert.ok(Object.hasOwn(ASSET_FILES, "shell.css"), "interface-assets serves it (its R7)");
  const stand = (cls) => ({ id: "home", reads: () => ({}), acts: [], render: fn(`return '<div class="${cls}">' + cs.title() + "</div>";`) });
  assert.throws(() => interfacePage([stand("cs-nonesuch")]), /screen home.*cs-nonesuch/);
  assert.throws(() => interfacePage([stand("mk-door cs-nonesuch")]), /cs-nonesuch/, "every class of the attribute");
  assert.throws(() => interfacePage(ALL, { guide: { acts: [], render: () => '<p class="cs-nonesuch"></p>' } }), /the guide.*cs-nonesuch/);
  /* a screen's part and act functions are its functions too */
  assert.throws(() => interfacePage([{ ...stand("mk-door"), parts: { x: () => '<b class="zz-unstyled"></b>' } }]), /home.*zz-unstyled/);
  /* control: a design class, a class civicsmith.css draws on its own elements, the shell's own and a hook compose */
  for (const cls of ["mk-door", "cs-btn", "spacer", "mk-scrim", ...Object.keys(HOOK_CLASSES)]) assert.ok(interfacePage([stand(cls)]).length > 1000, cls);
  for (const [c, reader] of Object.entries(HOOK_CLASSES)) assert.ok(typeof reader === "string" && reader.length > 10, c + " names what reads it");
  /* the shell's own program draws only defined classes */
  const defined = stylesheetClasses(ASSET_FILES["civicsmith.css"].body, ASSET_FILES["shell.css"].body, styleOf(html));
  const shellOwn = classLiterals(interfaceScript([]));
  for (const c of shellOwn) assert.ok(defined.has(c) || Object.hasOwn(HOOK_CLASSES, c), c);
  assert.ok(shellOwn.size > 30);
});

test("R56 class literals: written classes are taken, every one of a class attribute; a class made at run time is not, nor one in a comment of a stylesheet", () => {
  const src = `'<b class="a-1 b_2">' + "<i class=\\"c3\\">" + '<p class="cs-tag-' + kind + '">' + \`<q class="mk-door\${x}">\` + el.setAttribute("class", "d4") + el.classList.add("e5")`;
  assert.deepEqual([...classLiterals(src)].sort(), ["a-1", "b_2", "c3", "d4", "e5", "mk-door"]);
  assert.deepEqual([...stylesheetClasses("/* .nope */ .x{background:url(a.b.png)} .y .z:hover{content:\".q\"} @media (max-width:760px){.w{}}")].sort(), ["w", "x", "y", "z"]);
});

const FRAME_ANSWERS = await frameAnswers();
test("R57 the working frame is the design's page: at the phone width the masthead shows icons only (the mark and the group's name, search, the explanation control, the avatar), each label kept as its accessible name, and the tabs are drawn last inside the frame, which is fixed-height; control: at 1280 px the labels are drawn and the tabs hidden by the stylesheet", async () => {
  const p = await boot({ screens: ALL, phone: true, plane: { ...FRAME_ANSWERS, assistantstate: ok({ on: true }), accountreference: ok({ held: true }) } });
  const frame = p.root().querySelector(".cs-frame");
  assert.ok(frame.classList.contains("cs-frame") && frame.getAttribute("data-frame") === "working");
  const mast = frame.querySelector(".cs-mast");
  assert.ok(mast.querySelector(".cs-mark") && mast.querySelector(".mk-grp"));
  const search = mast.querySelector(".mk-mastsearch");
  assert.equal(search.getAttribute("aria-label"), word("shell.search"));
  assert.equal(search.textContent, "", "an icon only");
  assert.ok(search.querySelector("svg"));
  const level = mast.querySelector('[data-shell="level"]');
  assert.equal(level.getAttribute("aria-label"), word("shell.level.button.prompt"));
  assert.equal(level.textContent, "");
  assert.equal(mast.querySelector('[data-shell="dock"]').textContent, "");
  assert.ok(mast.querySelector(".mk-avatar"));
  assert.equal(mast.querySelector('[data-kind="todo"]'), null, "no count beside the icons");
  assert.equal(frame.children.at(-1).classList.contains("cs-tabs"), true, "the tabs last inside the frame");
  assert.equal(frame.querySelector(".cs-band").textContent, word("mark.path.working.name") + " " + word("shell.band.working"), "the band's words");
  /* fixed-height: the page never scrolls, the frame fills the viewport's height and its main column scrolls */
  const style = styleOf(p.html);
  assert.match(style, /body\.cs\{[^}]*height:100dvh[^}]*overflow:hidden/);
  assert.match(style, /#cs-root>\.cs-frame\{[^}]*flex:1 1 auto[^}]*overflow:hidden/);
  assert.match(style, /#cs-root>\.cs-frame>\.cs-main\{overflow:auto/);
  /* control: at 1280 px the labels are drawn, and civicsmith.css hides the tabs outside its 760 px query */
  const q = await boot({ screens: ALL, plane: { ...FRAME_ANSWERS, assistantstate: ok({ on: true }), accountreference: ok({ held: true }) } });
  const m2 = q.root().querySelector(".cs-mast");
  assert.equal(m2.querySelector(".mk-mastsearch").textContent, word("shell.search"));
  assert.equal(m2.querySelector('[data-shell="level"] .mk-hide-phone').textContent, word("shell.level.button.prompt"));
  assert.equal(m2.querySelector('[data-shell="dock"] .mk-hide-phone').textContent, word("shell.assistant"));
  const css = ASSET_FILES["civicsmith.css"].body;
  assert.ok(/\.cs-tabs\s*\{\s*display:\s*none/.test(css.slice(0, css.indexOf("@media (max-width: 760px)"))));
});

test("R58 while testInstance is true the band is part of the page as served, before any script runs, and the page does not move when bootstrap answers; an answer of test_instance that is not true removes it; control: testInstance false serves no band", async () => {
  const html = interfacePage(ALL, { testInstance: true });
  const before = documentOf(html);
  const band = before.getElementById("cs-testband");
  assert.ok(band, "in the served HTML");
  assert.equal(band.nextElementSibling.id, "cs-root", "above the frame");
  assert.ok(band.textContent.includes(word("instance.test.band")) && band.textContent.includes(word("instance.test.notice")));
  /* bootstrap answering true: the same band, not a second one; no answer keeps it */
  for (const b of [ok({ test_instance: true }), { silent: true }]) {
    const p = await boot({ screens: ALL, testInstance: true, plane: { bootstrap: b } });
    assert.equal(p.doc.querySelectorAll(".cs-band[data-band=test]").length, 1);
    assert.equal(p.doc.querySelector(".cs-band[data-band=test]").nextElementSibling, p.root());
  }
  const q = await boot({ screens: ALL, testInstance: true, plane: { bootstrap: ok({ test_instance: false }) } });
  assert.equal(q.doc.getElementById("cs-testband"), null, "removed by an answer that is not true");
  /* control */
  assert.equal(documentOf(interfacePage(ALL, { testInstance: false })).getElementById("cs-testband"), null);
  assert.equal(documentOf(interfacePage(ALL)).getElementById("cs-testband"), null);
});

const MARKER = { words: [], ops: [], acts: [], render: () => "", marks: () => '<span class="cs-wizmark" id="chip">2 wizards</span>' };

test("R59 the guide's marks are drawn inside the screen's title row, after its heading, never a block above the path or the heading (the screen's own title row when it draws one); control: a screen with no marks keeps its title row unchanged", async () => {
  const p = await boot({ screens: ALL, guide: MARKER, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  const chip = p.doc.getElementById("chip");
  const row = chip.parentElement.parentElement;
  assert.ok(row.classList.contains("mk-titlerow"));
  assert.equal(row.children[0].localName, "h1");
  assert.equal(chip.parentElement.getAttribute("data-guide-from"), "marks");
  assert.equal(p.root().querySelector("#cs-main").children[0].localName, "nav", "the path first");
  /* a screen that draws its own title row keeps it, the marks after its heading */
  const own = { id: "held", reads: () => ({}), acts: [], render: (cs) => '<div class="mk-titlerow">' + cs.title() + '<span class="mk-small" id="mine">x</span></div>' };
  const q = await boot({ screens: [own], guide: MARKER, path: "/app/held" });
  const row2 = q.doc.getElementById("mine").parentElement;
  assert.deepEqual(row2.children.map((e) => e.localName + (e.id ? "#" + e.id : "")), ["h1", "span", "span#mine"]);
  assert.equal(row2.children[1].getAttribute("data-guide-from"), "marks");
  assert.equal(q.root().querySelectorAll(".mk-titlerow").length, 1);
  /* control: no marks, the title as the screen drew it */
  const r = await boot({ screens: ALL, guide: { ...MARKER, marks: () => "" }, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  assert.equal(r.root().querySelector(".mk-titlerow"), null);
  assert.equal(r.root().querySelector("#cs-main").children[1].localName, "h1");
  assert.equal(r.root().querySelector("[data-guide-from]"), null);
});

test("R60 the masthead never draws a count at zero, never the group's slug (\"Your group\" when groupidentity answers no display_name), and names the explanation level by its own words; control: a set name is drawn", async () => {
  const { world, me } = await inWorld();
  const slug = (await me.read("groupidentity")).group;
  assert.equal((await me.read("groupidentity")).display_name, null, "the world's team is unnamed");
  const p = await bootAs(world, me, { screens: ALL });
  const mast = p.root().querySelector(".cs-mast");
  assert.equal(mast.querySelector('[data-kind="todo"]'), null, "zero To-do items draw no count");
  assert.ok(!mast.textContent.includes("0"));
  assert.equal(mast.querySelector(".mk-grp").textContent, word("shell.group.unnamed"));
  assert.ok(!p.root().innerHTML.includes(slug), "no slug anywhere the shell draws");
  assert.ok(!p.doc.title.includes(slug), "nor the page's title");
  assert.equal(mast.querySelector('[data-shell="level"] .mk-hide-phone').textContent, word("shell.level.button.prompt"), "R76: the button names itself and its setting");
  await p.click('[data-shell="level"]');
  assert.equal(p.root().querySelector('.cs-mast [data-shell="level"] .mk-hide-phone').textContent, word("shell.level.button.pause"));
  /* control: a set name is drawn, and a count above zero */
  const name = (await me.act("groupnameset", { body: { name: "River Town" } })).display_name;
  const items = await obligations(world, me, 3);
  const q = await bootAs(world, me, { screens: ALL });
  assert.equal(q.root().querySelector(".cs-mast .mk-grp").textContent, name);
  assert.equal(q.root().querySelector('.cs-mast [data-kind="todo"]').textContent, word("shell.todo", { n: items.length }));
});

test("R61 absence: a subject read refused with an absence code draws only Nothing is here, with the way back to its place; a subject screen opened with no subject likewise, reading nothing; a refusal with its own words draws them alone; a failure without words draws could not be read with its reference; control: a 5xx still draws can't be reached", async () => {
  const calc = { id: "calculation", reads: (view) => ({ c: { op: "calculation", query: { id: view.subject }, subject: true } }), acts: [{ op: "testify" }],
    render: (cs, view) => cs.state("c", view, (c) => cs.title(c.name)) + cs.act("testify") };
  const only = (p) => { const main = p.root().querySelector("#cs-main"); return { main, kind: (main.querySelector("[data-unavailable]") || { getAttribute: () => null }).getAttribute("data-unavailable") }; };
  for (const code of ["NO_CALC", "NO_ENTITY", "NO_NODE", "NOT_FOUND", "NO_SUCH_CALCULATION", "CALCULATION_NOT_FOUND"]) {
    const p = await boot({ screens: [calc], path: "/app/calculation/c9", plane: { calculation: refused(code, "words of its own") } });
    const { main, kind } = only(p);
    assert.equal(kind, "nothing", code);
    assert.equal(main.querySelector("h1").textContent, word("shell.unavailable.nothing.title"));
    assert.equal(btn(p, "testify"), null, "nothing else of the screen");
    assert.ok(!main.textContent.includes(code) && !main.textContent.includes("words of its own"));
    const back = main.querySelector('[data-unavailable] + p a, p > a.cs-btn');
    assert.equal(back.getAttribute("href"), "/app/projects", "the way back to its place");
    assert.equal(main.querySelector(".cs-crumbs a").getAttribute("href"), "/app/projects");
  }
  /* a screen's own absence codes */
  const own = { ...calc, ABSENT_CODES: ["CALC_GONE_ZZ"] };
  const o = await boot({ screens: [own], path: "/app/calculation/c9", plane: { calculation: refused("CALC_GONE_ZZ") } });
  assert.equal(only(o).kind, "nothing");
  assert.throws(() => interfacePage([{ ...calc, ABSENT_CODES: "NO" }]), /calculation.*ABSENT_CODES/);
  /* a bare subject screen: nothing is read */
  const bare = await boot({ screens: [calc], path: "/app/calculation" });
  assert.equal(only(bare).kind, "nothing");
  assert.equal(bare.byOp("calculation").length, 0);
  /* a refusal's own words alone; a failure without words, "could not be read" with its reference and no code */
  const words = async (answer) => (await boot({ screens: [HELD], path: "/app/held", plane: { heldcaptures: answer } })).root().querySelector('#cs-main [data-state="failed"]').textContent;
  assert.equal(await words(refused("NOT_AN_ADMIN", "Only an administrator can do this.")), word("refusal.NOT_AN_ADMIN"));
  /* R83: a coded refusal with neither a word nor a translation is drawn as refusal.uncatalogued, its code and the reference */
  assert.equal(await words(refused("ZZ_NO_WORDS", null, 400, { trace: "0123456789abcdef" })), word("refusal.uncatalogued") + " ZZ_NO_WORDS " + word("refusal.reference", { ref: "01234567" }));
  /* a failure with no code at all (a 5xx with no body) is still "could not be read" */
  assert.equal(await words(httpError(500)), word("shell.unread"));
  /* control: a 5xx still draws can't be reached */
  const down = await boot({ screens: [calc], path: "/app/calculation/c9", plane: { calculation: httpError(503) } });
  assert.equal(only(down).kind, "unreachable");
  /* control: another refusal of the subject read is not absence */
  const other = await boot({ screens: [calc], path: "/app/calculation/c9", plane: { calculation: refused("NOT_ALLOWED", "Not yours.") } });
  assert.equal(only(other).kind, null);
  assert.equal(other.root().querySelector('#cs-main [data-state="failed"]').textContent, "Not yours.");
});

test("R62 cs.field draws the label bold with its help beneath, tied by aria-describedby, separate boxes; at the phone width cs.rows draws each row as the design's one-line row, no label for an empty cell, no column empty in every row; controls: a member with no expertise shows no Expertise label, and on a wide screen every column is drawn", async () => {
  const form = { id: "account", reads: () => ({}), acts: [], render: (cs) => cs.field("lang", "shell.reason", { help: "shell.reason.help" }) };
  const f = await boot({ screens: [form], path: "/app/account" });
  const field = f.doc.getElementById("lang").parentElement;
  assert.ok(field.classList.contains("cs-field"));
  const [label, help] = field.children;
  assert.equal(label.localName, "label");
  assert.ok(help.classList.contains("help"));
  assert.notEqual(label, help);
  assert.equal(label.textContent, word("shell.reason"), "the label alone");
  assert.equal(f.doc.getElementById("lang").getAttribute("aria-describedby"), help.id);
  assert.ok(/\.cs-field\s*>\s*label\s*\{[^}]*font-weight:\s*600/.test(ASSET_FILES["civicsmith.css"].body), "bold");
  const roster = { id: "members", reads: () => ({ m: { op: "members" } }), acts: [{ op: "memberset" }],
    render: (cs) => cs.state("m", (v) => cs.rows({ id: "m", cols: ["shell.copy", "shell.cancel", "shell.confirm", "shell.sections"], items: v.items, key: (i) => i.id, name: (i) => cs.esc(i.name),
      cells: (i) => [cs.esc(i.role), cs.esc(i.expertise || ""), ""] })) };
  const M = ok({ items: [{ id: "a", name: "Mai", role: "member", expertise: "" }, { id: "b", name: "Rosa", role: "administrator", expertise: "law" }] });
  const p = await boot({ screens: [roster], path: "/app/members", phone: true, plane: { members: M } });
  const rows = p.root().querySelectorAll("tr.cs-r");
  assert.equal(rows[0].querySelector(".mk-rowname").textContent, "Maimember", "the name and its first value on one line");
  assert.ok(rows[0].classList.contains("mk-r"));
  assert.equal(rows[0].querySelectorAll("td[data-label]").length, 0, "no label for Mai's empty expertise");
  assert.deepEqual(rows[1].querySelectorAll("td[data-label]").map((t) => t.getAttribute("data-label")), [word("shell.confirm")], "Rosa's expertise labelled");
  /* R84: at the phone width a table restacks as cards with no header row */
  assert.equal(p.root().querySelector("thead"), null);
  assert.equal(p.root().querySelectorAll("th").length, 0);
  assert.equal(rows[0].querySelectorAll("td").length, 1, "the column empty in every row is not drawn: Mai's row is her name alone");
  /* control: on a wide screen every column is drawn */
  const q = await boot({ screens: [roster], path: "/app/members", plane: { members: M } });
  assert.equal(q.root().querySelectorAll("th").length, 4);
  assert.equal(q.root().querySelectorAll("tr.cs-r")[0].querySelectorAll("td").length, 4);
});

test("R63 R69 the phone's More page heads with screen.more.sub and lists the places the tabs do not hold as the design's more rows (mk-morerows, mk-morerow): each place's icon and name as its reference, explained by rail.<k>.holds, with rail.<k>.line beneath, the More tab lit; control: no <ul> without a class", async () => {
  const p = await boot({ screens: ALL, path: "/app/more", phone: true });
  const main = p.root().querySelector("#cs-main");
  assert.equal(main.querySelector(".mk-sub").textContent, word("screen.more.sub"), "the page's line");
  const rows = main.querySelectorAll(".mk-morerows > .mk-morerow");
  assert.deepEqual(rows.map((r) => r.querySelector("a.cs-ref").textContent), ["projects", "people", "settings"].map((k) => word("rail." + k + ".name")));
  rows.forEach((r, i) => {
    const k = ["projects", "people", "settings"][i];
    assert.ok(r.querySelector("svg use").getAttribute("href").includes("#i-"), "its icon");
    assert.equal(r.querySelector("p").textContent, word("rail." + k + ".line"), "what it holds, beneath");
    assert.equal(r.querySelector("a.cs-ref").getAttribute("data-tip"), word("rail." + k + ".holds").replace(/'/g, "&#39;"), "explained by what it holds");
  });
  assert.equal(p.root().querySelectorAll(".cs-tabs a[aria-current=page]").length, 1, "the More tab lit");
  assert.equal(p.root().querySelector(".cs-tabs a[aria-current=page]").getAttribute("href"), "/app/more");
  for (const path of ["/app/more", "/app/settings"]) {
    const q = await boot({ screens: ALL, path, phone: true });
    assert.equal(q.root().querySelectorAll("ul").filter((u) => !u.getAttribute("class")).length, 0, path);
  }
});

test("R64 an act R11 draws with no weight carries the mark MARKS names, a mark and its explanation only: Sign in, Search, Capture and Mute draw theirs (Reversible: none above it), a Terminal-marked act its mark; control: Search still runs on press, and a weighed act carries its weight, not a mark. (fix round 2, C76) Start a project is marked Reasoned and asks nothing, so it draws no mark", async () => {
  const cases = [["front", "login"], ["finder", "search"], ["capture", "acquire"], ["queue", "queuemute"], ["connect", "subscriptiondisconnect"]];
  for (const [id, op] of cases) {
    assert.ok(Object.hasOwn(MARKS, op), op + " in MARKS");
    const s = { id, reads: () => ({}), acts: [{ op, send: fitSend(op) }], render: fn(`return cs.act("${op}");`) };
    const p = await boot({ screens: [s], path: "/app/" + id, plane: { whoami: ok({ ...ADMIN, capabilities: ["contribute", "create_projects", "publish"] }) } });
    const b = btn(p, op);
    assert.ok(b, op);
    const w = b.querySelector(".w");
    /* R77: a mark at Reversible draws nothing; one above it draws as before */
    if (String(MARKS[op]).toLowerCase() === "reversible") {
      assert.equal(w, null, op + ": no mark at Reversible");
      await p.click(b);
      assert.equal(p.byOp(op).length, 1, op + " runs on press");
      continue;
    }
    assert.equal(w.getAttribute("data-mark"), String(MARKS[op]).toLowerCase(), op);
    assert.equal(w.textContent, word("weight." + String(MARKS[op]).toLowerCase() + ".name"), op + ": the weight's own name, read by key");
    assert.ok(w.textContent.length > 3, op + " named");
    assert.ok(b.getAttribute("data-tip").includes(w.textContent + ":"), op + " explained");
    await p.click(b);
    assert.equal(p.root().querySelector('[data-shell="reason-send"], [data-shell="confirm"]'), null, op + ": no reason asked, no dialog");
    assert.equal(p.byOp(op).length, 1, op + " runs on press");
  }
  /* control: a weighed act carries its weight */
  const c = { id: "document", reads: () => ({}), acts: [{ op: "release", send: fitSend("release") }, { op: "cite" }], render: (cs) => cs.act("release") + cs.act("cite") };
  const q = await boot({ screens: [c], path: "/app/document/x" });
  assert.equal(btn(q, "release").querySelector(".w").hasAttribute("data-mark"), false);
  assert.equal(btn(q, "cite").querySelector(".w"), null, "R77: a Reversible act draws no weight");
});
