/* Find's states (R55 to R57) on the real served page (interface-shell's harness): the whole record as one sortable table, a search
   answered by three routes counted apart under a scope with what it covered, and citing the whole held set. Every sentence is
   asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open as openRaw, ok, refused, refusedIn, text, ops, button, press as pressRaw, beside, last, main, word, hasWord, settle, withScreens, dmy, screen } from "./page.mjs";

const R = "looking";
/** The team: a member (who may contribute and start projects), her project, four documents held in it and three questions drawn into it, all by the real acts. Shared. */
let shared = null;
const lab = () => (shared ||= (async () => {
  const w = await storeWorld({ now: Date.now() });
  const mem = await w.signIn("mem", { capabilities: ["contribute", "create_projects"] });
  const project = await w.recipes.project(mem, "Pothole repairs");
  const doc = async (title, body) => (await w.recipes.hold(mem, title, body, project)).bundle;
  const docs = [await doc("Work orders", "Work orders for each pothole."), await doc("Council report", "The report to council."), await doc("Budget memo", "The public works budget.")];
  const qs = [];
  for (const [title, text] of [["Are potholes repaired?", "Are potholes repaired?"], ["Does closed mean repaired?", "Does closed mean repaired?"]]) qs.push((await w.recipes.question(mem, project, { title, text, draw: true })).id);
  return { w, mem, project, docs, qs };
})());
const open = async (path, plane, o = {}) => { const L = await lab(); return openRaw(path, plane, { screens: withScreens("document", "question", "person", "action", "plan", "project", "timeline"), ...L.w.boot(L.mem), ...o }); };
const press = (p, op, o = {}) => pressRaw(p, op, { reason: R, ...o });
/** Waits (in small steps) until `cond()` holds: the held set's answer is the real store's, wrapped, and takes a moment the harness does not count. */
const until = async (cond) => { for (let i = 0; i < 40 && !cond(); i++) await new Promise((r) => setTimeout(r, 50)).then(() => settle()); };
const choose = async (p, id, value) => { const el = p.doc.getElementById(id); el.value = value; p.fire(el, "change"); await settle(); };
const ITEM = (id, kind, title, state, at, extra = {}) => ({ kind, id, title, state, last_changed: at, new: false, watched: false, flagged: null, ...extra });
const REC = [
  ITEM("INF-1", "document", "Council minutes", "collected", "2026-10-07T10:00:00Z"),
  ITEM("INQ-1", "question", "Potholes repaired?", "open", "2026-10-12T10:00:00Z"),
  ITEM("INF-2", "document", "Work orders", "verified", "2026-10-09T10:00:00Z"),
  ITEM("ACT-1", "action", "Ask for the log", "awaiting_response", "2026-10-02T10:00:00Z"),
  ITEM("INQ-2", "question", "Does closed mean repaired?", "concluded", "2026-10-15T10:00:00Z"),
  ITEM("INQ-3", "question", "Put off", "deferred", "2026-10-03T10:00:00Z"),
  ITEM("ENT-1", "person", "Dana Reyes", null, "2026-10-01T10:00:00Z"),
];
const BROWSE = (items = REC, extra = {}) => ok({ ok: true, items, count: items.length, limit: 50, truncated: false, next: null, total: items.length, awaiting_review: items.filter((i) => i.state === "collected").length, ...extra });
const PLANE = { lookedat: ok({ since: "2026-10-01T00:00:00Z" }), browse: BROWSE() };
const titles = (p) => main(p).querySelectorAll("table tbody tr").map((r) => r.querySelector("a.cs-ref, .cs-card").textContent);

test("R55: Show as offers the list or one table; the table is read with no kinds and no only, draws the count line from total and awaiting_review, four columns and a chip per state; sorting sends nothing", async () => {
  const p = await open("/app/finder", PLANE);
  assert.deepEqual(main(p).querySelectorAll("#finder-view option").map((o) => o.textContent), [word("screen.finder.showas.list"), word("screen.finder.showas.table")]);
  await choose(p, "finder-view", "table");
  const rq = last(p, "browse").query;
  assert.deepEqual([rq.kinds, rq.only], [undefined, undefined], "the whole record");
  assert.ok(main(p).querySelector(".tw table"), "B4 (2b): the table is drawn inside the design's scroll wrapper");
  assert.ok(text(p).includes(word("screen.finder.table.intro")) && text(p).includes(word("screen.finder.table.sorting")));
  assert.ok(text(p).includes(word("screen.finder.table.count.other", { n: "7", m: "1" })));
  assert.deepEqual(main(p).querySelectorAll("th").map((h) => h.textContent), ["item", "kind", "state", "updated"].map((c) => word(`column.finder.${c}.name`)));
  for (const c of ["item", "kind", "state", "updated"]) assert.ok(main(p).querySelectorAll("th button").some((b) => b.getAttribute("data-tip") === word(`column.finder.${c}.shows`)), c);
  const rows = main(p).querySelectorAll("table tbody tr");
  const chipOf = (i) => rows[i].querySelector(".mk-chip");
  const names = ["review", "open", "reviewed", "waiting", "concluded", "deferred"];
  names.forEach((n, i) => assert.ok(chipOf(i) && chipOf(i).textContent.includes(word(`state.item.${n}.name`)), n));
  assert.equal(chipOf(6), null, "an entity row draws no chip");
  assert.equal(main(p).querySelector("#finder-kind"), null, "the table draws none of Show, Only and Theme");
  // Sorting by Updated, both ways, by the value and not the shown text; sends nothing.
  const sentBefore = p.requests.length;
  const sortBtn = () => main(p).querySelectorAll("th button")[3];
  await p.click(sortBtn());
  assert.deepEqual(titles(p), ["Dana Reyes", "Ask for the log", "Put off", "Council minutes", "Work orders", "Potholes repaired?", "Does closed mean repaired?"]);
  await p.click(sortBtn());
  assert.deepEqual(titles(p).slice(0, 2), ["Does closed mean repaired?", "Potholes repaired?"]);
  assert.equal(p.requests.length, sentBefore, "sorting sends no request");
  // Control: a corpus of one draws the .one count; a page change moves neither figure.
  const one = await open("/app/finder", { ...PLANE, browse: BROWSE([REC[0]]) });
  await choose(one, "finder-view", "table");
  assert.ok(text(one).includes(word("screen.finder.table.count.one", { m: "1" })));
  let page2 = 0;
  const paged = await open("/app/finder", { ...PLANE, browse: (req) => (req.query.after ? (page2++, BROWSE([ITEM("PLN-1", "plan", "Repair plan", "open", "2026-09-01T00:00:00Z")], { total: 7, awaiting_review: 1 })) : BROWSE(REC, { truncated: true, next: "X", total: 7, awaiting_review: 1 })) });
  await choose(paged, "finder-view", "table");
  await press(paged, "search", { nth: 1 });
  assert.equal(page2, 1);
  assert.ok(text(paged).includes(word("screen.finder.table.count.other", { n: "7", m: "1" })), "Show more does not change either figure");
  assert.equal(main(paged).querySelectorAll("table tbody tr").length, 8);
});

const SCOPES = ok({ ok: true, scopes: ["everything", "question", "document", "action", "awaiting_review", "watched", "flagged"].map((key) => ({ key, kinds: [], only: null })) });
const FIELDS = ok({ ok: true, total: 2, hits: [
  { bundle_id: "INF-1", object_type: "information", title: "Sewer fund transfers", grade: "B", snippet: "the [sewer] fund" },
  { bundle_id: "INF-2", object_type: "information", title: "Budget amendment", snippet: null }],
  scope: { documents: 412, documents_with_rows: 391, documents_without_rows: 21, existence_only_projects: [{ project: "PROJ-8", name: "A" }, { project: "PROJ-9", name: "B" }] }, levels: { meaning: { state: "UNDETERMINED", why: "no read names it" } } });
const PASSAGES = ok({ ok: true, total: 2, rows: [
  { bundle_id: "INF-1", title: "Council minutes", snippet: "…transfer from the [sewer fund]…", extent: { passage: 4 } },
  { bundle_id: "INF-2", title: "Budget amendment", snippet: "…the [sewer fund] shall be reimbursed…", extent: { passage: 2 } }] });
const SUBJECTS = ok({ ok: true, count: 3, subjects: [
  { entity_id: "ENT-5", kind: "fund", label: "Sewer Service Fund", documents: 9 },
  { entity_id: "ENT-6", kind: "institution", label: "Public Works", documents: 31 },
  { entity_id: "ENT-7", kind: "ordinance", label: "Sewer rate ordinance", documents: 1 }] });
const THREE = { searchfields: SCOPES, search: FIELDS, meaningrows: PASSAGES, subjectsnamed: SUBJECTS };

test("R56: a search with words draws the scope and three sections counted apart, none added; subjects are references with their kind and the documents they are named in", async () => {
  const p = await open("/app/finder/sewer fund", THREE);
  const t = text(p);
  assert.ok(t.includes(word("screen.finder.route.fields")) && t.includes(word("screen.finder.route.passages")) && t.includes(word("screen.finder.subjects.heading")));
  assert.ok(t.includes(word("screen.finder.route.fields.holds.other", { n: "2" })));
  assert.ok(t.includes(word("screen.finder.route.passages.holds.other", { n: "2", m: "2" })));
  assert.ok(t.includes(word("screen.finder.route.subjects.holds.other", { n: "3" })));
  assert.ok(t.includes(word("screen.finder.route.apart")));
  assert.ok(!t.includes(word("screen.finder.total.many", { n: "7" })), "no total of the three is drawn");
  assert.deepEqual(main(p).querySelectorAll("#finder-scope option").map((o) => o.textContent),
    ["screen.finder.scope.everything", "find.kind.question", "find.kind.document", "find.kind.action", "state.item.review.name", "find.state.watched", "find.state.secondlook"].map((k) => word(k)));
  assert.ok(!main(p).querySelectorAll("#finder-scope option").some((o) => o.textContent === word("screen.finder.scope.cases")), "Cases is not a scope the answer holds");
  assert.ok(t.includes(word("find.row.kind.organization")) && t.includes(word("find.row.kind.fund")) && t.includes(word("screen.finder.named.nodoc.one")));
  assert.equal(main(p).querySelector('a[href="/app/person/ENT-6"]').textContent, "Public Works");
  // The scope chosen is sent to search and meaningrows; the subject route is team-wide.
  await choose(p, "finder-scope", "document");
  assert.equal(last(p, "search").query.scope, "document");
  assert.equal(last(p, "meaningrows").query.scope, "document");
  assert.equal(last(p, "subjectsnamed").query.scope, undefined);
  assert.equal(p.byOp("search")[0].query.scope, undefined, "control: no scope answers as before");
});

test("R56: a search that crosses routes is refused ROUTES_CROSSED and drawn as the screen's own fold, no row run; a failed route is drawn failed and the others as answered", async () => {
  const crossed = await open("/app/finder/" + encodeURIComponent('sewer OR passage:"sewer fund"'), { ...THREE, search: refusedIn("ROUTES_CROSSED", "x") });
  const t = text(crossed);
  assert.ok(t.includes(word("screen.finder.route.cross.heading")) && t.includes(word("screen.finder.route.cross")));
  assert.ok(main(crossed).querySelector("details[open]"), "open whenever drawn");
  assert.equal(main(crossed).querySelectorAll(".cs-row").length, 0, "no row is run");
  const failed = await open("/app/finder/sewer fund", { ...THREE, subjectsnamed: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'), "that route is failed");
  assert.ok(text(failed).includes(word("screen.finder.route.fields.holds.other", { n: "2" })) && text(failed).includes(word("screen.finder.route.passages")), "the others as answered");
  assert.ok(!text(failed).includes(word("screen.finder.route.subjects.holds.other", { n: "3" })));
});

test("R56: what the search covered: four rows from the answers, the documents read and left, and the projects known by name only; names no project the viewer cannot see", async () => {
  const p = await open("/app/finder/sewer fund", THREE);
  const t = text(p);
  assert.ok(t.includes(word("screen.finder.covered.heading")) && t.includes(word("screen.finder.covered.levels")));
  assert.ok(t.includes(word("screen.finder.covered.read.says.other", { read: "391", n: "412", rest: "21" })));
  assert.ok(t.includes(word("screen.finder.covered.docs.says.other", { n: "412", p: "2" })));
  assert.ok(t.includes(word("state.undetermined", { reason: "no read names it" })), "what anything rests on is undetermined with the statement's reason");
  assert.ok(!t.includes("PROJ-8") && !t.includes("PROJ-9"), "control: no project is named");
  assert.ok(t.includes(word("screen.finder.covered.looked")));
});

test("R57: Cite these together opens the cite state over the held set; a role must be chosen (nothing sent without); the held set is not released; each document is shown cited or left as it was", async () => {
  const L = await lab();
  const [d1, d2] = L.docs, [q1, q2] = L.qs;
  // The question already cites the first document (a real hold and a real cite), so the second is the one newly cited.
  const earlier = await L.mem.act("select", { query: { op: "select", kind: "enumerated", q: "" }, body: { ids: [d1] } });
  await L.mem.act("cite", { query: { handle: earlier.handle, project: q1, role: "supports" } });
  const items = [ITEM(d1, "document", "Work orders", "verified", "2026-10-12T10:00:00Z"), ITEM(d2, "document", "Council report", "verified", "2026-10-11T10:00:00Z")];
  const qs = ok({ total: 2, hits: [{ bundle_id: q1, title: "Are potholes repaired?", object_type: "inquiry" }, { bundle_id: q2, title: "Does closed mean repaired?", object_type: "inquiry" }] });
  const p = await open("/app/finder", { ...PLANE, browse: BROWSE(items), search: qs });
  await press(p, "select", { values: { ["finder-pick-" + d1]: true, ["finder-pick-" + d2]: true } });
  await press(p, "cite", { nth: 0 });
  const t = text(p);
  assert.equal(p.byOp("cite").length, 0, "opening the state sends nothing");
  for (const k of ["a17.cite_every_document_you_hold_together_in", "a17.each_document_is_cited_whole_as_its_own_", "a17.a_document_the_question_already_cites_is", "a17.if_the_set_changed_after_you_held_it_wha"]) assert.ok(t.includes(word(`screen.finder.${k}`)), k);
  assert.ok(t.includes("Work orders") && t.includes("Council report"), "the held documents, by the titles of the rows picked");
  assert.equal(main(p).querySelector("#finder-cite-q").value, q1, "the first question is preselected");
  assert.equal(main(p).querySelectorAll('#finder-cite-role input[type="radio"]').filter((r) => r.checked).length, 0, "none preselected");
  const stateAct = () => main(p).querySelectorAll('button[data-act="cite"]').findIndex((b) => b.dataset.cite === "1");
  const none = await press(p, "cite", { nth: stateAct() });
  assert.equal(p.byOp("cite").length, 0, "control: no role sends nothing");
  assert.equal(beside(p, none), word("screen.findin.cite.norole"));
  p.doc.getElementById("finder-cite-role-supports").checked = true;
  await press(p, "cite", { nth: stateAct() });
  assert.equal(p.byOp("cite").length, 1);
  assert.deepEqual([last(p, "cite").query.project, last(p, "cite").query.role], [q1, "supports"]);
  assert.equal(last(p, "cite").query.handle, last(p, "selection").query.handle, "over the held set");
  const after = text(p);
  assert.ok(after.includes(word("queue.answered.col.did")) && after.includes(word("screen.finder.a17.newly_cited_supporting_the_question")) && after.includes(word("screen.finder.a17.left_as_it_was")) && after.includes(word("screen.finder.a17.the_question_already_cited_it")));
  assert.ok(ops(p).includes("selectionrelease"), "the held set is not released by citing");
});

test("R57: the cite state's own words: the legend, Support it and Cut against it, Cited, and the way back; cutting against says so; a set that moved says what was added and dropped", async () => {
  const L = await lab();
  const [d1, d2, d3] = L.docs, q2 = L.qs[1];
  const items = [ITEM(d1, "document", "Work orders", "verified", "2026-10-12T10:00:00Z"), ITEM(d2, "document", "Council report", "verified", "2026-10-11T10:00:00Z"),
    ITEM(d3, "document", "Budget memo", "verified", "2026-10-10T10:00:00Z")];
  const qs = ok({ total: 1, hits: [{ bundle_id: q2, title: "Does closed mean repaired?", object_type: "inquiry" }] });
  // The held set is the store's own; only what it says its members are moves (no act of the door adds a document to an enumerated set).
  let members = [d1, d2];
  const selection = async (req) => { const real = await L.mem.read("selection", { query: req.query }); return ok({ ...real, n: members.length, members }); };
  const p = await open("/app/finder", { ...PLANE, browse: BROWSE(items), selection, search: qs });
  await press(p, "select", { values: { ["finder-pick-" + d1]: true, ["finder-pick-" + d2]: true, ["finder-pick-" + d3]: true } });
  await until(() => main(p).querySelector(".cs-hold") && text(p, main(p).querySelector(".cs-hold")).includes(word("screen.finder.held.many", { n: "2" })));
  await press(p, "cite", { nth: 0 });
  const t = text(p);
  for (const k of ["legend", "support", "against", "back", "back.help"]) assert.ok(t.includes(word(`screen.finder.cite.${k}`)), k);
  const back = main(p).querySelectorAll("a[data-nav]").find((a) => a.textContent === word("screen.finder.cite.back"));
  assert.equal(back.getAttribute("href"), "/app/finder", "the way out sends nothing and cites nothing");
  assert.ok(!t.includes(word("screen.finder.cite.set_changed")), "control: a set that has not moved says nothing");
  members = [d2, d3];
  p.doc.getElementById("finder-cite-role-against").checked = true;
  const stateAct = () => main(p).querySelectorAll('button[data-act="cite"]').findIndex((b) => b.dataset.cite === "1");
  await press(p, "cite", { nth: stateAct() });
  await until(() => text(p).includes(word("screen.finder.cite.set_changed")));
  const after = text(p);
  assert.equal(last(p, "cite").query.role, "cuts_against");
  assert.ok(after.includes(word("screen.finder.cite.cited")) && after.includes(word("screen.finder.cite.newly_against")));
  assert.ok(after.includes(word("screen.finder.cite.set_changed")) && after.includes(word("screen.finder.cite.added_since")) && after.includes(word("screen.finder.cite.gone_since")));
});

test("R34: every key Find reads is a word of the list", () => {
  for (const k of screen("finder").words) assert.ok(hasWord(k), k);
});

test("R76: the row \"what anything rests on\" reads the plane's own `why` after \"because\"; with no reason it draws no stub", async () => {
  const sentence = "no read of a meaning-level arm names it for these words";
  const withWhy = ok({ ...FIELDS.json.result, levels: { meaning: { state: "UNDETERMINED", why: sentence } } });
  const p = await open("/app/finder/sewer fund", { ...THREE, search: withWhy });
  assert.ok(text(p).includes(word("state.undetermined", { reason: sentence })), "the plane's sentence is drawn after because");
  assert.ok(text(p).includes(word("screen.finder.covered.rests")));
  // Control: no reason, no row that ends in the middle of a sentence.
  const bare = ok({ ...FIELDS.json.result, levels: { meaning: { state: "UNDETERMINED" } } });
  const q = await open("/app/finder/sewer fund", { ...THREE, search: bare });
  assert.ok(!text(q).includes(word("screen.finder.covered.rests")), "no stub row without a reason");
  assert.ok(!text(q).includes(word("state.undetermined", { reason: "" }).trim()), "no dangling because");
});
