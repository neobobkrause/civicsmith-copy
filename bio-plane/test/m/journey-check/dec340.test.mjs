/* journey-check R28 (DEC-340), R27 (the pseudo-locale walk), R23 (a page numbered 0): the checks at the interface, each over a
   fixture page in a real browser, each with a control that holds. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browser } from "../../../src/journey-check/run.mjs";
import { Walk, FAIL, StepFailed } from "../../../src/journey-check/walker.mjs";
import { firstPage, pageNumbersProblem, NO_PAGE_NOTE } from "../../../src/journey-check/investigation.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { pageZero } from "../../../src/journey-check/words.mjs";
import { titleLimits, weightLimits, mastheadLimits, coverLimits, projectsLimits, noConnectionLimits, publicPages, wordOf, DEC340 } from "../../../src/journey-check/checks.mjs";
import { escapedIn, escapedOnPage, pseudoBody } from "../../../src/journey-check/pseudo.mjs";
import { word, WORD_ROWS } from "../../../src/setup-words/index.mjs";

let B, dir;
before(async () => { B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-dec340-")); });
after(async () => { await B?.close(); rmSync(dir, { recursive: true, force: true }); });

async function on(html, fn, viewport = { width: 1280, height: 900 }) {
  const ctx = await B.newContext({ viewport });
  try { const p = await ctx.newPage(); await p.setContent(html); return await fn(p); } finally { await ctx.close(); }
}

test("R28: each screen's tab title is the word of its screen, a public page's the public form; control: another title fails by name", async () => {
  const screen = wordOf("screen.members.name");
  const good = wordOf("page.title", { screen, team: "Lakeshore Tenants" });
  assert.deepEqual(await on(`<title>${good}</title>`, (p) => titleLimits(p, "members")), []);
  const bad = await on("<title>Civicsmith</title>", (p) => titleLimits(p, "members"));
  assert.equal(bad.length, 1);
  assert.equal(bad[0].kind, DEC340.TITLE);
  const pub = wordOf("page.title.public", { page: wordOf("screen.front.name"), team: "Lakeshore Tenants" });
  assert.deepEqual(await on(`<title>${pub}</title>`, (p) => titleLimits(p, "front", { isPublic: true })), []);
  assert.equal((await on(`<title>${good}</title>`, (p) => titleLimits(p, "front", { isPublic: true }))).length, 1);
  assert.ok(publicPages().includes("published") && publicPages().includes("join") && publicPages().length === 9, publicPages().join(","));
});

test("R28: a public page draws no weight mark; control: a working screen keeps its marks (the check is made on public pages only)", async () => {
  const marked = await on('<main id="cs-main"><button data-weighed="1">Save</button></main>', weightLimits);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].kind, DEC340.WEIGHT);
  assert.deepEqual(await on('<main id="cs-main"><button>Sign in</button></main>', weightLimits), []);
});

test("R28: the team's name in the masthead is never cut at 390 px; control: a name that wraps passes", async () => {
  const head = (css) => `<header class="cs-mast"><a class="mk-grp" href="/app" style="${css}">The Lakeshore Row Tenants and Neighbors Association of Oakland</a></header>`;
  const phone = { width: 390, height: 844 };
  const cut = await on(head("display:block;width:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"), mastheadLimits, phone);
  assert.equal(cut.length, 1);
  assert.equal(cut[0].kind, DEC340.CUT);
  assert.deepEqual(await on(head("display:block;width:120px;overflow-wrap:anywhere"), mastheadLimits, phone), []);
});

test("R28: no explanation covers another control; control: with room it opens clear of every control", async () => {
  const page = (tipCss) => `<body style="margin:0"><button id="a" data-tip="why" style="position:absolute;left:10px;top:10px;width:80px;height:30px">A</button>
<button id="b" style="position:absolute;left:10px;top:50px;width:80px;height:30px">B</button><div id="cs-tip" hidden style="position:absolute;${tipCss}">why</div>
<script>const a = document.getElementById("a"), t = document.getElementById("cs-tip");
a.addEventListener("focus", () => { t.hidden = false; a.setAttribute("aria-describedby", "cs-tip"); });</script></body>`;
  const covering = await on(page("left:10px;top:46px;width:80px;height:40px"), (p) => coverLimits(p));
  assert.equal(covering.length, 1, JSON.stringify(covering));
  assert.equal(covering[0].kind, DEC340.COVERS);
  assert.match(covering[0].detail, /covers b/);
  assert.deepEqual(await on(page("left:200px;top:10px;width:80px;height:30px"), (p) => coverLimits(p)), []);
});

test("R28 (interface-shell PR 310): the rail's width grip is no control an explanation must spare, and one under the scroll bar runs outside the page; control: another control it covers still fails", async () => {
  const page = (tipCss, second) => `<body style="margin:0;height:3000px;overflow-y:scroll"><button id="a" data-tip="why" style="position:absolute;left:10px;top:10px;width:80px;height:30px">A</button>
${second}<div id="cs-tip" hidden style="position:absolute;${tipCss}">why</div>
<script>const a = document.getElementById("a"), t = document.getElementById("cs-tip");
a.addEventListener("focus", () => { t.hidden = false; a.setAttribute("aria-describedby", "cs-tip"); });</script></body>`;
  const grip = '<button id="g" data-shell="grip" role="separator" style="position:absolute;left:10px;top:50px;width:80px;height:30px">|</button>';
  assert.deepEqual(await on(page("left:10px;top:46px;width:80px;height:40px", grip), (p) => coverLimits(p)), []);
  const other = '<button id="b" style="position:absolute;left:10px;top:50px;width:80px;height:30px">B</button>';
  assert.match((await on(page("left:10px;top:46px;width:80px;height:40px", other), (p) => coverLimits(p)))[0]?.detail || "", /covers b/);
  const vw = await on(page("left:0;top:0", ""), (p) => p.evaluate(() => [document.documentElement.clientWidth, window.innerWidth]));
  if (vw[0] < vw[1]) {
    const under = await on(page(`left:${vw[1] - 80}px;top:46px;width:78px;height:40px`, ""), (p) => coverLimits(p));
    assert.match(under[0]?.detail || "", /runs outside the page/, JSON.stringify(under));
  }
  assert.deepEqual(await on(page(`left:${vw[0] - 90}px;top:46px;width:80px;height:40px`, ""), (p) => coverLimits(p)), []);
});

test("R28: Projects' search and filter have accessible names; control: named ones pass", async () => {
  const bad = await on('<main id="cs-main"><input type="search" id="p-search"><select id="p-filter"><option>All</option></select></main>', projectsLimits);
  assert.deepEqual(bad.map((x) => x.kind), [DEC340.NAME, DEC340.NAME]);
  assert.deepEqual(await on('<main id="cs-main"><input type="search" id="p-search" aria-label="Search"><label for="p-filter">Show</label><select id="p-filter"><option>All</option></select></main>', projectsLimits), []);
});

test("R28: a person with no connections draws no graph and no Explore; control: a person with connections is not judged", async () => {
  const none = wordOf("person.graph.none");
  const bad = await on(`<main id="cs-main"><p>${none}</p><div class="cs-graph"></div><a href="/app/explore/p1">Explore</a></main>`, noConnectionLimits);
  assert.deepEqual(bad.map((x) => x.kind), [DEC340.GRAPH, DEC340.GRAPH]);
  assert.deepEqual(await on(`<main id="cs-main"><p>${none}</p></main>`, noConnectionLimits), []);
  assert.equal(await on('<main id="cs-main"><div class="cs-graph"></div></main>', noConnectionLimits), null);
});

test("R27: a fixture screen with one sentence from the list and one hard-coded reports exactly the second", async () => {
  const { pseudo } = await import("../../../src/setup-words/build.mjs");
  const fromList = pseudo(word("shell.menu.signout"));
  const found = await on(`<main><p>${fromList}</p><p>Please sign in again now</p><p>Ann K</p><p>${"Roof repairs at 14 Lakeshore Row"}</p></main>`,
    (p) => escapedOnPage(p, { entered: ["Roof repairs at 14 Lakeshore Row"] }));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].text, "Please sign in again now");
  assert.match(found[0].element, /^p/);
  /* data the screens draw from records and catalogues is not a sentence (K4086): a record reference and a catalogue row name */
  const data = await on('<main id="cs-main"><a class="cs-ref" href="/x">Firsthand observation observed</a><span class="mk-rowname">Splunk HTTP Event Collector</span><p>Please sign in again now</p></main>', (p) => escapedOnPage(p));
  assert.deepEqual(data.map((x) => x.text), ["Please sign in again now"]);
  assert.deepEqual(escapedIn(fromList), []);
  assert.deepEqual(escapedIn("a b"), []);
});

test("R27: the page's words are made pseudo before the page draws them: a key the list holds is altered, any other is left alone", async () => {
  const key = WORD_ROWS[0][0];
  const body = `x = [["${key}","${WORD_ROWS[0][1].replace(/"/g, '\\"').replace(/\n/g, "\\n")}"],["not.a.key","Plain words here"]]`;
  const out = await pseudoBody(body);
  assert.ok(out.includes('["not.a.key","Plain words here"]'));
  assert.ok(!out.includes(`["${key}","${WORD_ROWS[0][1].replace(/"/g, '\\"').replace(/\n/g, "\\n")}"]`) || WORD_ROWS[0][1].length < 2, "the row was altered");
  assert.match(out, /\["[^"]+","\[/);
});

test("R23: a page numbered 0 is found by the scan, and fails the step that draws it; control: a page bar whose first page reads Page 1 passes", async () => {
  assert.equal(pageZero("Page 0 of 3").length, 1);
  assert.equal(pageZero("Pages 0, 2").length, 1);
  assert.equal(pageZero("Page 0.5 of 3, Page 10, Page 1 of 3").length, 0);
  const stepOn = async (html) => {
    const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "local" });
    const ctx = await B.newContext(); const p = walk.watch(await ctx.newPage());
    try { await p.setContent(html); await walk.step(p, "a fixture page", async () => {}); return walk; } finally { await ctx.close(); }
  };
  const bad = await stepOn("<!doctype html><title>x</title><main><p>Page 0 of 3</p></main>");
  assert.deepEqual(bad.failures.map((f) => f.kind), [FAIL.PAGE_ZERO]);
  assert.deepEqual((await stepOn(`<!doctype html><title>x</title><main><p>${word("document.read.page", { n: 1, count: 3 })}</p></main>`)).failures, []);
});

test("R27 (K4086, K4111; R29): the document step requires document.read.title; the profile values and the vendor names are data, proved on the real screens in pseudo.test.mjs", async () => {
  /* the document step asks for the reading section by its key (B5) */
  const { requireWord } = await import("../../../src/journey-check/words.mjs");
  await on(`<main id="cs-main"><h2>${word("document.read.title")}</h2></main>`, (p) => requireWord(p, "document.read.title", { within: "#cs-main", timeout: 2000 }));
  await on('<main id="cs-main"><h2>Passages</h2></main>', async (p) => { await assert.rejects(requireWord(p, "document.read.title", { within: "#cs-main", timeout: 600 }), /does not draw the word document\.read\.title/); });
});

/* R23: the step on the document the walk captured, over a fixture page drawn in the real screen's words and its picker's markup
   (a `<select id="document-unread-page">` whose choices are pages numbered from 1) */
async function firstPageOn(main) {
  const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "local" });
  const ctx = await B.newContext();
  await ctx.route("http://doc.test/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head><title>x</title><link rel="stylesheet" href="/app/assets/civicsmith.css"></head><body><main id="cs-main" data-screen="document">${main}</main></body></html>` }));
  const p = walk.watch(await ctx.newPage());
  try { await firstPage(walk, p, "http://doc.test/app/document/D1"); } catch (e) { if (!(e instanceof StepFailed)) throw e; } finally { await ctx.close(); }
  return walk;
}
const bar = (n, count = 3) => `<div class="mk-pagebar" data-pagebar="1"><span>${word("document.read.page", { n, count })}</span></div>`;
const place = (page) => `<blockquote class="mk-passage rec">“Some words.” <span class="mk-small">${word("screen.document.passage.where", { page })}</span></blockquote>`;
const picker = (...pages) => `<select id="document-unread-page">${pages.map((n) => `<option value="${n}">${n}</option>`).join("")}</select>`;

test("R23: the document's first page reads Page 1 in the page bar, in the passage's place and in the picker of unread pages; control: a bar, a place or a picker that reads 0 fails by name, and a capture that states no page is noted", async () => {
  const good = await firstPageOn(bar(1) + place(1) + picker(2, 3));
  assert.deepEqual(good.failures, [], JSON.stringify(good.failures));
  assert.deepEqual(good.notes, []);
  const zeroBar = await firstPageOn(bar(0) + place(1));
  assert.ok(zeroBar.failures.some((f) => f.kind === FAIL.STEP && f.detail.includes(pageNumbersProblem({ bar: 0, place: null, picker: [] }))), JSON.stringify(zeroBar.failures));
  assert.ok(zeroBar.failures.some((f) => f.kind === FAIL.PAGE_ZERO), "and the scan for a page numbered 0 finds it");
  const zeroPlace = await firstPageOn(bar(1) + place(2));
  assert.ok(zeroPlace.failures.some((f) => f.detail.includes(pageNumbersProblem({ bar: null, place: 2, picker: [] }))), JSON.stringify(zeroPlace.failures));
  const zeroPicker = await firstPageOn(bar(1) + place(1) + picker(0, 2));
  assert.ok(zeroPicker.failures.some((f) => f.detail.includes(pageNumbersProblem({ bar: null, place: null, picker: ["0"] }))), JSON.stringify(zeroPicker.failures));
  const none = await firstPageOn("<p>The capture states no page.</p>");
  assert.deepEqual(none.failures, [], JSON.stringify(none.failures));
  assert.deepEqual(none.notes, [NO_PAGE_NOTE]);
  assert.equal(pageNumbersProblem({ bar: 1, place: 1, picker: ["1", "4"] }), null);
  assert.equal(pageNumbersProblem({ bar: 1, place: null, picker: ["x"] }), localize("journey-check.investigation.the_picker_of_unread_pages_offers", "the picker of unread pages offers page {pages}, pages are numbered from 1 (screen.document.unread.page)", { pages: "x" }));
});
