/* Find (R4) on the real served page (interface-shell's harness): the search, its results with grade and where they
   matched, holding a picked set together with its strip, letting it go, "Find in these", where nobody looked, and
   "Count". The held documents, the held set, its release, the count and the other routes' answers are the REAL store's (store-request's `storeWorld()`,
   op-tables §5.3): a member's three documents, made by the real acts. The plane's `search` answers only where the test is about the shape of a hit (a grade, a
   snippet, a title missing, a widened count): no act of the door gives a hit a grade today, and the real snippet is the document's own text. Every sentence is
   asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open as openRaw, ok, refused, text, ops, button, press, beside, last, main, screen, word, hasWord, settle } from "./page.mjs";
import { SESSION_OPS } from "../../../src/op-declarations/index.mjs";
import { SCREENS } from "./page.mjs";

const HITS = ok({ total: 3, hits: [
  { bundle_id: "INF-1", title: "Public Works work orders, FY2025", grade: "B", snippet: "pothole [work orders]" },
  { bundle_id: "INF-2", title: "Memo 88-31 on stormwater", snippet: "within seven calendar days" },
  { bundle_id: "INF-3", title: "Report to council", grade: "C" },
] });
/** The team: a member (`mem`, who may contribute and start projects), her project and three documents held in it, by the real acts. Shared. */
let shared = null;
const lab = () => (shared ||= (async () => {
  const w = await storeWorld({ now: Date.now() });
  const mem = await w.signIn("mem", { capabilities: ["contribute", "create_projects"] });
  const project = await w.recipes.project(mem, "Pothole repairs");
  const ids = [];
  for (const [title, body] of [["Pothole work orders, FY2025", "Work orders for each pothole."], ["Pothole memo 88-31 on stormwater", "Repairs within seven calendar days."], ["Pothole report to council", "The report."]])
    ids.push((await w.recipes.hold(mem, title, body, project)).bundle);
  return { w, mem, project, ids };
})());
/** Opens `path` as the member over the real store, `plane` on top of it (only a read the test is about the shape of, or one made to fail). */
const open = async (path, plane = {}, o = {}) => { const L = await lab(); return openRaw(path, plane, { ...L.w.boot(L.mem), ...o }); };
const PLANE = { search: HITS };
// `search`, `findin`, `frontier` and `ruleanswer` are reads the shell weighs as reasoned until op-grades names them
// (SCREENS-DAILY #1's REPORT): the member's reason is answered where the shell asks one.
const R = "looking";

test("R4, R56: search with the member's words: read from the route's words or the last search, each route sent apart", async () => {
  const blank = await open("/app/finder", PLANE);
  assert.equal(blank.byOp("search").length, 0, "nothing searched before the member writes words");
  const routed = await open("/app/finder/pothole", PLANE);
  assert.equal(last(routed, "search").query.q, "pothole", "R56: the plain words to the fields route alone");
  assert.equal(last(routed, "meaningrows").query.q, "passage:pothole", "R56: as passage terms to the passages route alone");
  assert.equal(last(routed, "meaningrows").query.rows, "passage");
  assert.equal(last(routed, "subjectsnamed").query.q, "pothole", "R56: and to the subjects route alone");
  await press(routed, "search", { values: { "finder-q": "  work orders " }, reason: R });
  await settle();
  assert.equal(last(routed, "search").query.q, "work orders");
  assert.equal(last(routed, "meaningrows").query.q, "passage:work passage:orders");
  assert.equal(last(routed, "subjectsnamed").query.q, "work orders");
  // R44: leaving the words empty returns to the browse; nothing is searched and nothing is refused.
  const empty = await press(blank, "search", { values: { "finder-q": " " }, reason: R });
  assert.equal(beside(blank, empty), "");
  assert.equal(blank.byOp("search").length, 0);
});

test("R35, R56: no read joins the field route and the passage route with OR; a query in the member's own syntax is sent as written to the route its terms name; control: an empty search sends nothing", async () => {
  const one = await open("/app/finder/pothole", PLANE);
  const two = await open("/app/finder/work orders", PLANE);
  assert.equal(last(one, "search").query.q, "pothole");
  assert.equal(last(two, "search").query.q, "work orders");
  assert.equal(last(two, "meaningrows").query.q, "passage:work passage:orders");
  for (const p of [one, two]) for (const r of [...p.byOp("search"), ...p.byOp("meaningrows"), ...p.byOp("subjectsnamed")]) assert.ok(!/\bOR\b/.test(r.query.q), "no OR joins routes");
  // The member's own syntax is sent as written: a field is not split into passage terms, and goes to its route alone.
  const typed = await open("/app/finder/capture:b", PLANE);
  assert.equal(last(typed, "search").query.q, "capture:b");
  assert.equal(typed.byOp("meaningrows").length + typed.byOp("subjectsnamed").length, 0);
  const passage = await open("/app/finder/passage:\"sewer fund\"", PLANE);
  assert.equal(last(passage, "meaningrows").query.q, "passage:\"sewer fund\"");
  assert.equal(passage.byOp("search").length, 0);
  const blank = await open("/app/finder", PLANE);
  await press(blank, "search", { values: { "finder-q": "   " }, reason: R });
  assert.equal(blank.byOp("search").length + blank.byOp("meaningrows").length + blank.byOp("subjectsnamed").length, 0, "control: an empty search sends nothing");
});

test("R4: each result with its grade and where it matched (Found by search), a reference to its document and a box to pick it", async () => {
  const p = await open("/app/finder/pothole", PLANE);
  assert.ok(text(p).includes(word("screen.finder.route.fields.holds.other", { n: "3" })), "R56: the fields route counts its own");
  assert.equal(main(p).querySelectorAll('.cs-origin[data-origin="search"]').length, 3);
  assert.deepEqual(main(p).querySelectorAll(".cs-grade").map((g) => g.textContent.slice(-1)), ["B", "C"]);
  // R46: the match brackets are drawn as emphasis, never as raw brackets.
  assert.match(text(p), /pothole work orders/);
  assert.ok(!text(p).includes("[work orders]"));
  assert.deepEqual(main(p).querySelectorAll("em").map((e) => e.textContent), ["work orders"]);
  assert.ok(main(p).querySelectorAll(".cs-card, a.cs-ref").some((a) => a.textContent === "Memo 88-31 on stormwater"));
  assert.equal(p.doc.getElementById("finder-pick-INF-1").getAttribute("aria-label"), word("screen.finder.pick", { title: "Public Works work orders, FY2025" }));
  const none = await open("/app/finder/zz", { search: ok({ total: 0, hits: [], widen: { total: 4 } }) });
  assert.ok(text(none).includes(word("screen.finder.noresult.partial", { q: "zz" })), "R78: a widened count above 0 draws the partial sentence");
  assert.ok(text(none).includes(word("screen.finder.widen", { n: "4" })));
  const nothing = await open("/app/finder/zz", { search: ok({ total: 0, hits: [], widen: null }) });
  assert.ok(text(nothing).includes(word("screen.finder.noresult", { q: "zz" })));
  const one = await open("/app/finder/pothole", { search: ok({ total: 1, hits: [HITS.json.result.hits[0]] }) });
  assert.ok(text(one).includes(word("screen.finder.route.fields.holds.one")), "R25: one result, the singular key");
});

test("R4: select holds the picked results together; the hold strip shows how many and until when, from selection", async () => {
  const L = await lab();
  const [d1, d2, d3] = L.ids;
  const p = await open("/app/finder/pothole");
  assert.ok(ops(p).includes("select"));
  assert.ok(!ops(p).some((o) => ["findin", "calculationcreate", "selectionrelease"].includes(o)), "control: nothing held, nothing to act on");
  const nopick = await press(p, "select");
  assert.equal(beside(p, nopick), word("screen.finder.pickfirst"));
  await press(p, "select", { values: { ["finder-pick-" + d1]: true, ["finder-pick-" + d3]: true } });
  assert.deepEqual(last(p, "select").query, { op: "select", kind: "enumerated", q: "pothole" });
  assert.deepEqual(last(p, "select").body, { ids: [d1, d3] });
  const held = await L.mem.read("selection", { query: { handle: last(p, "selection").query.handle } });
  assert.deepEqual([held.n, held.members.sort()], [2, [d1, d3].sort()], "the store holds the two");
  const at = new Date(held.expires);
  const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  assert.ok(text(p, main(p).querySelector(".cs-hold")).includes(`${word("screen.finder.held.many", { n: "2" })} · ${word("screen.finder.until", { time: hm })}`));
  assert.deepEqual(ops(p).filter((o) => !["search", "frontier", "select", "watchitem", "secondlook"].includes(o)), ["findin", "cite", "calculationcreate", "selectionrelease"]);
  const one = await open("/app/finder/pothole");
  await press(one, "select", { values: { ["finder-pick-" + d1]: true } });
  assert.ok(text(one).includes(word("screen.finder.held.one")), "R25: one document, the singular key");
  assert.ok(d2);
});

test("R4: selectionrelease lets the set go; \"Find in these\" opens find-in over the held set", async () => {
  const L = await lab();
  const p = await open("/app/finder/pothole");
  await press(p, "select", { values: { ["finder-pick-" + L.ids[0]]: true } });
  const handle = last(p, "selection").query.handle;
  await press(p, "selectionrelease");
  assert.equal(last(p, "selectionrelease").query.handle, handle);
  assert.ok(!ops(p).includes("selectionrelease"), "the set is gone from the strip");
  await assert.rejects(L.mem.read("selection", { query: { handle } }), /NO_SUCH_SELECTION/, "the store let it go");
  await press(p, "select", { values: { ["finder-pick-" + L.ids[0]]: true } });
  const again = last(p, "selection").query.handle;
  await press(p, "findin", { reason: R });
  assert.equal(p.byOp("findin").length, 0, "it sends nothing itself");
  assert.equal(p.location.pathname, "/app/find-in/" + again);
});

// R67: a `frontier` answer for each level: `perLevel[level]` is that level's answer.
const LEVELS = ["document", "content", "meaning", "internet"];
const frontierPlane = (perLevel) => ({ frontier: (req) => ok(perLevel[req.query.level] === undefined ? null : perLevel[req.query.level]) });
const GOT = { found: true, built: true, never_looked: [], never_looked_count: 0, tally: { LOOKED_FOUND: 4, LOOKED_ABSENT: 1 }, note: "" };
// `frontier` is in the member's session set the shell's script carries (op-declarations' SESSION_OPS), so the default page serves it.
const HTMLF = () => undefined;
const rowsOfLevels = (p) => main(p).querySelectorAll(".cs-row").filter((r) => LEVELS.some((l) => r.querySelector("b") && r.querySelector("b").textContent === word("screen.answers.level." + l)));

test("R4, R67: frontier is read at each of its four levels and draws one row for each, with the places nobody looked at and the look states", async () => {
  // `frontier` is a read in no session set, so the shell's gate (interface-shell R12) draws it to nobody today
  // (SCREENS-DAILY #1's REPORT); with it in the member's set, as the registry's act needs, the screen draws and sends it.
  const absent = await open("/app/finder", {});
  assert.equal(ops(absent).includes("frontier"), SESSION_OPS.member.has("frontier"));
  const html = HTMLF();
  const per = { document: { ...GOT, never_looked: [{ referent: "Council minutes 2024" }, "Budget FY24"], never_looked_count: 2 }, content: { ...GOT, never_looked_count: 34, never_looked: [] }, meaning: GOT,
    internet: { found: true, built: false, never_looked: [], never_looked_count: 0, tally: {}, note: "this reader reads no such level" } };
  const p = await open("/app/finder", frontierPlane(per), { html });
  assert.ok(ops(p).includes("frontier"));
  await press(p, "frontier", { reason: R });
  assert.deepEqual([...new Set(p.byOp("frontier").map((r) => r.query.level))].sort(), [...LEVELS].sort(), "all four levels are read");
  const rows = rowsOfLevels(p);
  assert.equal(rows.length, 4, "four rows, one for each level");
  const rowOf = (l) => rows.find((r) => r.querySelector("b").textContent === word("screen.answers.level." + l));
  assert.ok(main(p).querySelector('.cs-gap[data-gap="nobody"]'));
  assert.ok(text(p, rowOf("document")).includes(word("screen.finder.nobody", { n: "2" })) && text(p, rowOf("document")).includes("Council minutes 2024") && text(p, rowOf("document")).includes("Budget FY24"));
  assert.ok(text(p, rowOf("content")).includes(word("screen.finder.nobody", { n: "34" })), "the passage level names the 34 nobody read");
  assert.ok(text(p, rowOf("meaning")).includes(word("screen.answers.state.LOOKED_FOUND")) && text(p, rowOf("meaning")).includes(word("screen.answers.state.LOOKED_ABSENT")), "the look states its tally names");
  assert.ok(text(p, rowOf("internet")).includes(word("state.undetermined", { reason: "this reader reads no such level" })), "a level the reader does not read is undetermined with the note");
  // Control (R20): fewer levels answered draws fewer rows; one place nobody looked takes the singular key.
  const fewer = await open("/app/finder", frontierPlane({ document: { ...GOT, never_looked_count: 1, never_looked: ["Budget FY24"] }, content: GOT }), { html });
  await press(fewer, "frontier", { reason: R });
  assert.equal(rowsOfLevels(fewer).length, 2);
  assert.ok(text(fewer).includes(word("screen.finder.nobody.one")), "R25: one place, the singular key");
});

test("R67, R4 (C22): a place is drawn by its name (else the plain word for a document), no empty list item is drawn, and every look state the plane answers is drawn as a word, never as its code", async () => {
  const html = HTMLF();
  const SHA = "a".repeat(64);
  const per = {
    // places nobody looked at: an address and a lead's words are names; a digest and an id are not, and draw no item
    document: { ...GOT, never_looked_count: 3, never_looked: [{ subject: "https://oakland.example/budget.pdf", from_document: "INF-1" }, { subject: SHA, from_document: "INF-2" }, { subject: "" }] },
    content: { ...GOT, never_looked_count: 2, never_looked: [{ subject: SHA, bundle_id: "INF-3" }, { subject: "b".repeat(64), bundle_id: "INF-4" }] },
    // every look state the plane's observation log answers
    meaning: { ...GOT, tally: { PRESENT: 5, LOOKED_ABSENT: 2, LOOKED_INDETERMINATE: 3, LOOKED_FOUND: 1, NEVER_LOOKED: 9, partial: 1 } },
    internet: GOT,
  };
  const p = await open("/app/finder", frontierPlane(per), { html });
  await press(p, "frontier", { reason: R });
  const rowOf = (l) => rowsOfLevels(p).find((r) => r.querySelector("b").textContent === word("screen.answers.level." + l));
  assert.ok(text(p, rowOf("document")).includes("https://oakland.example/budget.pdf"), "control: a place with a name draws it");
  assert.ok(text(p, rowOf("document")).includes(word("screen.finder.nobody", { n: "3" })), "the count is the answer's");
  assert.equal(main(p).querySelectorAll("li").filter((li) => !li.textContent.trim()).length, 0, "no empty list item");
  // R89 (C22): every place counted is named; one with no words of its own is the plain word for a document, never its digest or id.
  assert.deepEqual(rowOf("document").querySelectorAll("li").map((li) => li.textContent), ["https://oakland.example/budget.pdf", word("shell.card.document"), word("shell.card.document")], "all three places are items");
  assert.deepEqual(rowOf("content").querySelectorAll("li").map((li) => li.textContent), [word("shell.card.document"), word("shell.card.document")], "so are the two the passage level counts");
  assert.doesNotMatch(text(p), /[0-9a-f]{64}/, "no digest is drawn");
  const meaning = text(p, rowOf("meaning"));
  for (const code of ["PRESENT", "LOOKED_ABSENT", "LOOKED_INDETERMINATE", "LOOKED_FOUND", "NEVER_LOOKED", "partial"]) assert.ok(!meaning.includes(code), `${code} is drawn as a word`);
  assert.ok(meaning.includes(word("screen.answers.state.LOOKED_FOUND")) && meaning.includes(word("screen.answers.state.LOOKED_ABSENT")));
  assert.ok(meaning.includes(word("refusal.LOOKED_INDETERMINATE")), "a look that could not tell is told in the plane's own held word");
});

test("R77: \"Somebody has looked everywhere\" is drawn only when every level answered and none has a place left unlooked", async () => {
  const html = HTMLF();
  const open1 = async (per) => { const p = await open("/app/finder", frontierPlane(per), { html }); await press(p, "frontier", { reason: R }); return p; };
  // The document level empty, the passage level unread: no "everywhere", and the unread level is named.
  const partial = await open1({ document: GOT, content: { ...GOT, never_looked_count: 34 }, meaning: GOT, internet: GOT });
  assert.ok(!text(partial).includes(word("screen.finder.nobody.none")), "no 'everywhere' sentence while the passage level is unread");
  assert.ok(text(partial, rowsOfLevels(partial).find((r) => r.querySelector("b").textContent === word("screen.answers.level.content"))).includes(word("screen.finder.nobody", { n: "34" })));
  // Control: all four levels looked draws it.
  const all = await open1({ document: GOT, content: GOT, meaning: GOT, internet: GOT });
  assert.ok(text(all).includes(word("screen.finder.nobody.none")));
  // A level that failed or is not built is not "looked".
  const unbuilt = await open1({ document: GOT, content: GOT, meaning: GOT, internet: { found: false, built: false, never_looked: [], never_looked_count: 0, tally: {}, note: "no such level" } });
  assert.ok(!text(unbuilt).includes(word("screen.finder.nobody.none")));
});

test("R4: \"Count\" makes a count over the held set as a calculation, asking what and when in place, and says what it counted", async () => {
  const L = await lab();
  const p = await open("/app/finder/pothole");
  await press(p, "select", { values: { ["finder-pick-" + L.ids[0]]: true, ["finder-pick-" + L.ids[1]]: true } });
  const handle = last(p, "selection").query.handle;
  assert.equal(button(p, "calculationcreate").closest("details").querySelector("summary").textContent, word("act.calculationcreate.label.finder"));
  await press(p, "calculationcreate", { values: { "fc-question": "Reports closed in 7 days", "fc-from": "2024-07-01", "fc-to": "2025-06-30" }, reason: R });
  assert.deepEqual({ ...last(p, "calculationcreate").body, reason: undefined },
    { question: "Reports closed in 7 days", period: { from: "2024-07-01", to: "2025-06-30" }, kind: "count", inputs: [{ name: "held", set: handle }], reason: undefined });
  assert.ok(text(p).includes(word("screen.finder.counted", { result: "2" })), "it counted the two held documents");
  const r = await open("/app/finder/pothole");
  await press(r, "select", { values: { ["finder-pick-" + L.ids[0]]: true } });
  const b = await press(r, "calculationcreate", { values: { "fc-question": "q" }, reason: R });
  assert.match(beside(r, b), /period|NO_PERIOD/);
});

test("R12 (DEC-201 (13)): a search with no result says what search covers and offers \"Capture it\"", async () => {
  const p = await open("/app/finder/rent board minutes 2019", { search: ok({ total: 0, hits: [] }) });
  assert.ok(text(p).includes(word("screen.finder.noresult", { q: "rent board minutes 2019" }) + " " + word("screen.finder.covers")));
  assert.equal(main(p).querySelector('a[data-nav][href="/app/capture"]').textContent, word("screen.finder.captureit"));
  // Controls: results, nothing searched yet, and a failed search say neither.
  for (const [path, plane] of [["/app/finder/pothole", PLANE], ["/app/finder", PLANE], ["/app/finder/x", { search: refused("STORE_DID_NOT_ANSWER", null, 502) }]]) {
    const q = await open(path, plane);
    assert.ok(!text(q).includes(word("screen.finder.covers")), path);
    assert.equal(main(q).querySelector('a[href="/app/capture"]'), null, path);
  }
});

test("R34: every key find reads is a word of the list", () => {
  for (const k of screen("finder").words) assert.ok(hasWord(k), k);
});

test("R78: a hit is headed by its document's title; no hits with a widened count draws the partial key, not the no-match key; a count of 0 draws the no-match key", async () => {
  const withTitle = await open("/app/finder/pothole", { ...PLANE, search: ok({ total: 1, hits: [{ bundle_id: "INF-1", object_type: "information", title: "Public Works work orders, FY2025", snippet: "x" }] }) });
  assert.ok(main(withTitle).querySelectorAll(".cs-card, a.cs-ref").some((a) => a.textContent === "Public Works work orders, FY2025"), "headed by the title");
  const noTitle = await open("/app/finder/pothole", { ...PLANE, search: ok({ total: 1, hits: [{ bundle_id: "INF-9", object_type: "information", title: null, last_updated: "2026-10-01T00:00:00Z" }] }) });
  assert.ok(!main(noTitle).querySelectorAll(".cs-card, a.cs-ref").some((a) => a.textContent === "INF-9"), "never headed by its id");
  const partial = await open("/app/finder/pothole repair", { ...PLANE, search: ok({ total: 0, hits: [], widen: { interpretation: "OR", total: 2, q: "pothole repair" } }) });
  assert.ok(text(partial).includes(word("screen.finder.noresult.partial", { q: "pothole repair" })));
  assert.ok(text(partial).includes(word("screen.finder.partial.head")));
  assert.ok(!text(partial).includes(word("screen.finder.noresult", { q: "pothole repair" })));
  const none = await open("/app/finder/pothole repair", { ...PLANE, search: ok({ total: 0, hits: [], widen: { interpretation: "OR", total: 0, q: "x" } }) });
  assert.ok(text(none).includes(word("screen.finder.noresult", { q: "pothole repair" })));
  assert.ok(!text(none).includes(word("screen.finder.noresult.partial", { q: "pothole repair" })));
});
