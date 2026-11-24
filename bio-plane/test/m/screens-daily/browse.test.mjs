/* Find's browse, what each result is, Watch, Flag and Clear (R44, R45, R46) on the real served page (interface-shell's harness). Here the documents, the question, the person, the marks and the themes are made by the real acts over the REAL store (store-request's `storeWorld()`,
   op-tables §5.3) and every answer the page reads is the real store's. Every sentence is asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open as openRaw, refused, text, ops, button, press as pressRaw, beside, last, main, word, hasWord, settle, withScreens, dmy } from "./page.mjs";

const R = "looking";
const NOTE = "check the dates twice";
const SCREENS_OF = withScreens("document", "question", "person", "action", "plan", "project");
/** Opens `path` as `as` (default: the desk's owner) over the desk's world, `plane` on top of it (only a read made to fail or slow). */
const open = (d, path, plane = {}, as = d.rosa, boot = null) => openRaw(path, plane, { screens: SCREENS_OF, ...(boot || d.w.boot(as)) });
// Until op-grades names the marks, the shell weighs them as reasoned: the reason is answered where it is asked.
const press = (p, op, o = {}) => pressRaw(p, op, { reason: R, ...o });

// The nth index of the hold strip's own button for `op` among all the page's buttons for it.
const stripIndex = (p, op) => main(p).querySelectorAll(`button[data-act="${op}"]`).findIndex((b) => b.closest(".cs-hold"));

const DOC = "Work orders FY2025", QUESTION = "Is the city repairing potholes?", PERSON = "Dana Reyes";

/** A team's desk, by the real acts: rosa (an administrator) and her project "Pothole repairs"; the person Dana Reyes (registered before her look at Home, so
 *  not new); then, a minute on each, the question and the document "Work orders FY2025" in the project; rosa watches the document and flags the question for a
 *  second look ("check the dates"). `looked: false` is a member who has not yet visited Home (no mark); `bare` holds none of them; `plan` adds an older document
 *  "Repair plan"; `docs` more documents ("Budget memo ..."), each a minute after the last. */
async function desk({ looked = true, bare = false, plan = false, docs = 0 } = {}) {
  const w = await storeWorld({ now: Date.now() });
  const rosa = await w.signIn("rosa", { admin: true });
  const project = await w.recipes.project(rosa, "Pothole repairs");
  const ids = {};
  if (plan) ids.plan = (await w.recipes.hold(rosa, "Repair plan", "How the repairs are planned.", project)).bundle;
  if (!bare) ids.person = (await rosa.act("entitycreate", { body: { kind: "person", label: PERSON, note: "a council aide" } })).entity_id;
  if (looked) await rosa.read("lookedsince");
  if (bare) return { w, rosa, project, ids, since: looked ? (await rosa.read("lookedat")).since : null };
  await w.tick(60000);
  ids.question = (await w.recipes.question(rosa, project, { title: QUESTION, text: QUESTION, draw: true })).id;
  await w.tick(60000);
  ids.doc = (await w.recipes.hold(rosa, DOC, "Work orders for the potholes.", project)).bundle;
  for (let i = 1; i <= docs; i++) { await w.tick(60000); ids["extra" + i] = (await w.recipes.hold(rosa, "Budget memo " + i, "The public works budget.", project)).bundle; }
  await rosa.act("watchitem", { body: { item: ids.doc } });
  await rosa.act("secondlook", { body: { item: ids.question, note: "check the dates" } });
  return { w, rosa, project, ids, since: looked ? (await rosa.read("lookedat")).since : null };
}
const browseReqs = (p) => p.byOp("browse");


/** The browse as the real store answers it for `d`'s owner (with `query`), for the expected values. */
const browsed = (d, query = {}) => d.rosa.read("browse", { query: { limit: "50", ...query } });

test("R44: with no words Find is the browse: Show and Only choices, newest first, each result its kind, screen and marks; the words box says to leave it empty", async () => {
  const d = await desk();
  const { ids } = d;
  const p = await open(d, "/app/finder");
  assert.ok(text(p).includes(word("find.browse.says")));
  assert.ok(text(p).includes(word("find.query.help")), "the words box says, beneath it, to leave it empty to browse");
  assert.equal(p.doc.getElementById("finder-q").getAttribute("placeholder"), word("find.query.placeholder"), "R54: the kit's placeholder (interface-shell R90)");
  // R54: "Show" and "Only" are the design's choices, not chips; the values the route seeds are the first chosen.
  const optionsOf = (id) => main(p).querySelectorAll(`#${id} option`).map((o) => o.textContent);
  assert.deepEqual(optionsOf("finder-kind"), ["find.kind.all", "find.kind.document", "find.kind.question", "find.kind.action", "find.kind.entity", "find.kind.plan"].map((k) => word(k)));
  const onlys = optionsOf("finder-state");
  assert.ok(onlys.includes(word("find.state.new")) && onlys.includes(word("find.state.watched")) && onlys.includes(word("find.state.secondlook")));
  assert.equal(main(p).querySelectorAll("nav.mk-sortrow").length, 0, "control: no chips");
  assert.equal(last(p, "browse").query.kinds, undefined);
  assert.equal(last(p, "browse").query.limit, "50");
  const rows = main(p).querySelectorAll(".cs-row");
  assert.equal(rows.length, 3);
  const t = rows.map((r) => text(p, r));
  const flagged = (await browsed(d)).items.find((i) => i.id === ids.question).flagged;
  assert.equal(flagged.by, "rosa", "the flag is rosa's, by the handle the store answers");
  assert.ok(t[0].includes(DOC) && t[0].includes(word("find.row.kind.document")) && t[0].includes(word("find.row.watched")));
  assert.ok(t[1].includes(word("find.row.kind.question")) && t[1].includes(word("find.row.secondlook", { who: "rosa", date: dmy(flagged.at.slice(0, 10)), note: "check the dates" })));
  assert.ok(t[2].includes(word("find.row.kind.person")));
  // R44: the marks are the item's own: a browse asked with no `since` answers `new: false` for every item, so none is marked new here.
  assert.ok(!t.some((x) => x.includes(word("find.row.new"))), "control: no mark of new without a `since`");
  // Each result opens its own kind's screen.
  assert.deepEqual(rows.map((r) => (r.querySelector("a.cs-ref") || { getAttribute: () => null }).getAttribute("href")), ["/app/document/" + ids.doc, "/app/question/" + ids.question, "/app/person/" + ids.person]);
  // A kind chosen by the route: `kinds` is sent; "new" sends `since` from lookedat, which Find does not follow with a moved mark.
  const q = await open(d, "/app/finder/~question~new_since");
  assert.deepEqual([last(q, "browse").query.kinds, last(q, "browse").query.only, last(q, "browse").query.since], ["question", "new_since", d.since]);
  assert.equal(q.byOp("lookedat").length, 1);
  assert.equal(q.byOp("lookedsince").length, 0, "reading Find does not move the mark");
  assert.ok(text(q).includes(word("find.browse.new.means")));
  assert.ok(text(q, main(q).querySelectorAll(".cs-row")[0]).includes(word("find.row.new")), "asked since her look, the question changed after it is marked new");
  assert.equal((await d.rosa.read("lookedat")).since, d.since, "and her mark has not moved");
  // With words typed the screen searches (R4).
  const s = await open(d, "/app/finder/pothole");
  assert.equal(browseReqs(s).length, 0);
  assert.equal(s.byOp("search").length >= 1, true);
});

test("R44: a lookedat of null offers no \"new\" choice and says why; a browse not truncated draws no \"Show more\"; one that is pages by next and adds below", async () => {
  const d0 = await desk({ looked: false });
  const none = await open(d0, "/app/finder");
  const onlys = main(none).querySelectorAll("#finder-state option").map((o) => o.textContent);
  assert.ok(!onlys.includes(word("find.state.new")));
  assert.ok(text(none).includes(word("find.browse.nosince")));
  assert.ok(!ops(none).includes("search") === false);
  assert.ok(!text(none).includes(word("find.browse.showmore")), "control: not truncated, no Show more");
  assert.ok(!text(none).includes(word("find.browse.more")));
  // Four items, and the page's page size made three (the request's `limit`: the store pages its own answer by `next`).
  const d = await desk({ plan: true });
  const b = d.w.boot(d.rosa);
  const threes = { ...b, door: (req) => b.door(req.op === "browse" ? { ...req, url: req.url.replace(/limit=\d+/, "limit=3") } : req) };
  const p = await open(d, "/app/finder", {}, d.rosa, threes);
  const first = await browsed(d, { limit: "3" });
  assert.deepEqual([first.truncated, first.items.length], [true, 3], "the store pages: three, and more");
  assert.ok(text(p).includes(word("find.browse.more")));
  assert.equal(main(p).querySelectorAll(".cs-row").length, 3);
  await press(p, "search", { nth: 1 });
  const afters = browseReqs(p).filter((r) => r.query.after);
  assert.equal(afters.length, 1);
  assert.equal(afters[0].query.after, first.next, "after the answer's next");
  assert.equal(main(p).querySelectorAll(".cs-row").length, 4, "the next page is added below");
  assert.ok(text(p, main(p)).includes("Repair plan"));
  assert.ok(!text(p).includes(word("find.browse.showmore")), "the last page draws no more");
  // A browse answered undetermined for the marks draws them as unread, never as none. The world cannot make the store undetermined (it is so when no module
  // registered the marks' reader, or the set could not be read), so the real answer is handed on with the store's own `undetermined` stated.
  const odd = { ...b, door: async (req) => { const a = await b.door(req); if (req.op === "browse" && a.json && a.json.result) a.json.result.undetermined = { why: "marks_unread" }; return a; } };
  const u = await open(d, "/app/finder", {}, d.rosa, odd);
  assert.ok(text(u).includes(word("state.undetermined", { reason: "marks_unread" })));
});

const pick = (ids) => Object.fromEntries(ids.map((id) => [`finder-pick-${id}`, true]));

test("R45: Watch sends watchitem for each picked item in order; \"Take off my watch list\" sends on: false; the watched row is then listed", async () => {
  const d = await desk();
  const { ids } = d;
  const p = await open(d, "/app/finder");
  const strip = main(p).querySelector(".cs-hold");
  assert.ok(strip.querySelector('button[data-act="watchitem"]'), "Watch is in the hold strip");
  assert.ok(strip.querySelector('button[data-act="watchitem"]').textContent.startsWith(word("act.owed_watchitem.label.finder")));
  await press(p, "watchitem", { nth: stripIndex(p, "watchitem"), values: pick([ids.question, ids.person]) });
  assert.deepEqual(p.byOp("watchitem").map((r) => ({ item: r.body.item, on: r.body.on })), [{ item: ids.question, on: true }, { item: ids.person, on: true }], "one for each picked item, in order");
  assert.ok(text(p, main(p).querySelectorAll(".cs-row")[1]).includes(word("find.row.watched")), "her watch is read back");
  assert.deepEqual((await browsed(d)).items.filter((i) => i.watched).map((i) => i.id).sort(), [ids.doc, ids.person, ids.question].sort(), "and the store holds all three");
  // "Take off my watch list" is a row's own act and sends on: false.
  const unwatch = main(p).querySelectorAll('button[data-act="watchitem"]').find((b) => b.dataset.item === ids.doc);
  assert.ok(unwatch.textContent.startsWith(word("find.row.unwatch")));
  await press(p, "watchitem", { nth: main(p).querySelectorAll('button[data-act="watchitem"]').indexOf(unwatch) });
  assert.deepEqual({ item: last(p, "watchitem").body.item, on: last(p, "watchitem").body.on }, { item: ids.doc, on: false });
  assert.equal((await browsed(d)).items.find((i) => i.id === ids.doc).watched, false, "the store no longer lists it as watched");
  // A refusal is drawn and stops the rest: ola, a participant, sees the project's records; she is then removed from it, and what she picked is no
  // item she may see (the real store's refusal).
  const ola = await d.w.signIn("ola");
  await d.rosa.act("projectinvite", { query: { projectId: d.project, handle: "ola" } });
  await ola.act("projectjoin", { query: { projectId: d.project } });
  const r = await open(d, "/app/finder", {}, ola);
  assert.ok(main(r).querySelectorAll(".cs-row").length >= 2, "ola sees the records of the project");
  await d.rosa.act("projectremove", { query: { projectId: d.project, handle: "ola" } });
  const b = await press(r, "watchitem", { nth: stripIndex(r, "watchitem"), values: pick([ids.question, ids.person]) });
  assert.equal(r.byOp("watchitem").length, 1, "the first refusal stops the rest");
  assert.ok(beside(r, b).includes(word("refusal.MARK_NO_SUCH_ITEM")));
  // Nothing picked: told so, nothing sent.
  const n = await open(d, "/app/finder");
  await press(n, "watchitem", { nth: stripIndex(n, "watchitem") });
  assert.equal(n.byOp("watchitem").length, 0);
});

test("R45: Flag for a second look… opens its note in place and sends secondlook for each picked item with that one note; with no note nothing is sent; Clear sends secondlookclear and the row leaves", async () => {
  const d = await desk();
  const { ids } = d;
  const p = await open(d, "/app/finder");
  const det = main(p).querySelector(".cs-hold details");
  assert.equal(det.querySelector("summary").textContent, word("act.owed_secondlook.label.finder"));
  assert.ok(det.querySelector("#finder-note"), "the note, opened in place");
  assert.ok(text(p, det).includes(word("find.secondlook.note")) && text(p, det).includes(word("find.secondlook.note.help")));
  // No note: nothing sent, the note field's refusal drawn.
  const none = await press(p, "secondlook", { values: pick([ids.doc]) });
  assert.equal(p.byOp("secondlook").length, 0);
  assert.equal(beside(p, none), word("refusal.SECOND_LOOK_NO_NOTE"));
  // A note over 500 characters or with a line break is no note.
  await press(p, "secondlook", { values: { "finder-note": "x".repeat(501) } });
  await press(p, "secondlook", { values: { "finder-note": "a\nb" } });
  assert.equal(p.byOp("secondlook").length, 0);
  await press(p, "secondlook", { values: { "finder-note": NOTE, ...pick([ids.doc, ids.person]) } });
  assert.deepEqual(p.byOp("secondlook").map((r) => ({ item: r.body.item, note: r.body.note })), [{ item: ids.doc, note: NOTE }, { item: ids.person, note: NOTE }]);
  assert.deepEqual((await browsed(d)).items.filter((i) => i.flagged).map((i) => i.id).sort(), [ids.doc, ids.person, ids.question].sort(), "the store holds the flags");
  // Clear: no reason asked; the row leaves the flagged list.
  const clear = main(p).querySelectorAll('button[data-act="secondlookclear"]');
  assert.ok(clear.length >= 1 && clear[0].textContent.startsWith(word("act.secondlookclear.label.finder")));
  await press(p, "secondlookclear", { nth: clear.findIndex((b) => b.dataset.item === ids.question) });
  assert.equal(last(p, "secondlookclear").body.item, ids.question);
  assert.equal((await browsed(d)).items.find((i) => i.id === ids.question).flagged, null);
  const f = await open(d, "/app/finder/~all~flagged");
  assert.equal(last(f, "browse").query.only, "flagged");
  assert.deepEqual(main(f).querySelectorAll(".cs-row").length, 2, "the cleared one is not listed: the document and the person are");
});

test("R46: a search result is a reference of its own kind with its title and a plain excerpt, the match brackets drawn as emphasis; a passage's words when found through one; a hit with no snippet draws its title and kind alone", async () => {
  const w = await storeWorld({ now: Date.now() });
  const rosa = await w.signIn("rosa", { admin: true });
  const project = await w.recipes.project(rosa, "Repair of the Coliseum lease");
  const q = await w.recipes.question(rosa, project, { title: "Is the city repairing potholes?", text: "Did the city repair each report of potholes?", draw: true });
  const doc = await w.recipes.page(rosa, "Work orders FY2025", { paragraphs: ["Last year 420 work orders were closed, each after a repair."], project });
  const d = { w, rosa };
  const p = await open(d, "/app/finder/repair");
  await settle();
  const every = main(p).querySelectorAll(".cs-row");
  const rows = every.filter((r) => r.querySelector("input.mk-pick")), refOf = (r) => r.querySelector("a.cs-ref").getAttribute("href");   // the hits; the other rows are the passages' and the coverage
  const hits = (await rosa.read("search", { query: { q: "repair", limit: "50", snippet: "160" } })).hits;
  const hrefOf = { inquiry: "/app/question/", project: "/app/project/", information: "/app/document/" };
  assert.deepEqual(rows.map(refOf).sort(), [...new Set(hits.map((h) => hrefOf[h.object_type] + h.bundle_id))].sort(), "each hit a reference of its own kind");
  assert.ok(rows.length >= 3 && rows.some((r) => refOf(r) === "/app/question/" + q.id));
  for (const h of hits.filter((x) => x.snippet)) {
    const row = rows.find((r) => refOf(r) === hrefOf[h.object_type] + h.bundle_id);
    assert.deepEqual(row.querySelectorAll("em").map((e) => e.textContent), [...h.snippet.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]), "the match brackets are emphasis");
    assert.ok(text(p, row).includes(h.snippet.replace(/[\[\]]/g, "")), "the plain excerpt");
  }
  assert.ok(!text(p).includes("[repair") && !text(p).includes("[420]"));
  const docRow = every.find((r) => text(p, r).includes("work orders were closed"));
  assert.ok(docRow, "the document is found through its passage");
  assert.ok(docRow.querySelectorAll("em").some((e) => /repair/i.test(e.textContent)), "a passage's matched words");
  const bare = hits.find((h) => !h.snippet);
  if (bare) {
    const row = rows.find((r) => refOf(r) === hrefOf[bare.object_type] + bare.bundle_id);
    assert.ok(!row.querySelector("em"), "control: a hit with no snippet has no emphasis");
  }
  assert.doesNotMatch(text(p), /object_type|bundle_id|snippet|current_state|\b[0-9a-f]{12}\b/, "no field name, record id or digest");
});

const choose = async (p, id, value) => { const el = p.doc.getElementById(id); el.value = value; p.fire(el, "change"); await settle(); };

test("R54: choosing Documents re-reads browse at once with kinds set and sends no other request; choosing a theme re-reads themeread; a link route seeds the choice", async () => {
  const d = await desk();
  const theme = await d.rosa.act("themedeclare", { body: { name: "Street repair", test: "a street mended" } });
  await d.rosa.act("themeplace", { body: { theme: theme.theme_id, target: d.ids.doc } });
  const p = await open(d, "/app/finder");
  const before = p.requests.length;
  await choose(p, "finder-kind", "document");
  const sent = p.requests.slice(before);
  assert.deepEqual(sent.map((r) => r.op), ["browse"], "no other request");
  assert.equal(sent[0].query.kinds, "document");
  await choose(p, "finder-state", "watched");
  assert.equal(last(p, "browse").query.only, "watched");
  await choose(p, "finder-theme", theme.theme_id);
  assert.equal(last(p, "themeread").query.id, theme.theme_id);
  assert.ok(text(p).includes(DOC));
  // Control: a link route seeds the first values, so the browse that opens is that one.
  const seeded = await open(d, "/app/finder/~document~new_since");
  assert.equal(seeded.doc.getElementById("finder-kind").value, "document");
  assert.deepEqual([last(seeded, "browse").query.kinds, last(seeded, "browse").query.only], ["document", "new_since"]);
  assert.ok(hasWord("find.query.help") && hasWord("screen.finder.showas"));
});

test("R54, R93 (interface-shell R93): Find's browse re-reads itself every 45 seconds with the picked rows kept, says so while the list is fresh, and a choice changes the request", async () => {
  const d = await desk();
  const p = await open(d, "/app/finder");
  const reads = () => browseReqs(p).length;
  assert.equal(reads(), 1);
  assert.ok(text(p).includes(word("list.fresh")), "the first answer is fresh");
  p.doc.getElementById(`finder-pick-${d.ids.doc}`).checked = true;
  await d.w.tick(60000);
  await d.w.recipes.hold(d.rosa, "Newest filing", "A new filing.", d.project);
  await p.clock.tick(45000); await settle();
  assert.equal(reads(), 2, "read again at 45 seconds");
  assert.ok(text(p).includes("Newest filing"), "the list shows the new row");
  assert.equal(p.doc.getElementById(`finder-pick-${d.ids.doc}`).checked, true, "the picked row stays picked");
  await p.clock.tick(120000); await settle();
  const t = text(p);
  assert.ok(t.includes("Newest filing"));
  await choose(p, "finder-kind", "document");
  assert.equal(last(p, "browse").query.kinds, "document", "a choice changes the request");
  const quiet = await open(d, "/app/finder/pothole");
  await quiet.clock.tick(120000); await settle();
  assert.equal(browseReqs(quiet).length, 0, "control: a search is not a browse and is never re-read");
});

// C23, Find's part (fix round 2): the defects the walk found in Find's browse.
const helpOf = (p, key) => main(p).querySelectorAll("p").find((e) => e.textContent.includes(word(key)));

test("R44, R54 (C23): the list says how many the filter holds, and the count follows the filter, not the page", async () => {
  const d = await desk({ docs: 1 });
  const all = await browsed(d), docs = await browsed(d, { kinds: "document" });
  assert.ok(all.total > docs.total && docs.total === 2, "the store counts the whole record and the documents apart: " + JSON.stringify([all.total, docs.total]));
  const line = (r) => word("screen.finder.table.count.other", { n: String(r.total), m: String(r.awaiting_review) });
  const p = await open(d, "/app/finder");
  assert.ok(text(p).includes(line(all)), "the whole record's count");
  await choose(p, "finder-kind", "document");
  assert.ok(text(p).includes(line(docs)), "after choosing Documents the count is the documents'");
  assert.ok(!text(p).includes(line(all)));
  // Control: an answer with no count draws none (the store's own answer, its counts left out); a count of zero draws none (R21).
  const b = d.w.boot(d.rosa);
  const uncounted = { ...b, door: async (req) => { const a = await b.door(req); if (req.op === "browse" && a.json && a.json.result) { delete a.json.result.total; delete a.json.result.awaiting_review; } return a; } };
  const none = await open(d, "/app/finder", {}, d.rosa, uncounted);
  assert.doesNotMatch(text(none), /awaiting review/i);
  const empty = await desk({ bare: true });
  const zero = await open(empty, "/app/finder");
  assert.deepEqual([(await browsed(empty)).total, (await browsed(empty)).awaiting_review], [0, 0]);
  assert.ok(!text(zero).includes(word("screen.finder.table.count.other", { n: "0", m: "0" })));
});

test("R44, R54 (C23): an empty list under a filter says which filter found nothing; with no filter it says only that nothing is here", async () => {
  const d = await desk({ bare: true });
  const p = await open(d, "/app/finder/~all~new_since");
  const empty = main(p).querySelector('[data-state="empty"]');
  assert.ok(empty.textContent.includes(word("find.state.new")) && empty.textContent.includes(word("state.empty")), "names New since you last looked and says there is nothing");
  const docs = await open(d, "/app/finder/~document");
  assert.ok(main(docs).querySelector('[data-state="empty"]').textContent.includes(word("find.kind.document")));
  const plain = await open(d, "/app/finder");
  const text0 = main(plain).querySelector('[data-state="empty"]').textContent;
  assert.equal(text0, word("state.empty"), "control: no filter, no filter named");
});

test("R55 (C23): the table has a box on each row, so the rows can be held and watched there as in the list", async () => {
  const d = await desk();
  const p = await open(d, "/app/finder");
  await choose(p, "finder-view", "table");
  const rows = main(p).querySelectorAll("tbody tr");
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.querySelector('input[type="checkbox"]')), "a box on each row");
  assert.equal(rows[0].querySelector('input[type="checkbox"]').getAttribute("aria-label"), word("screen.finder.pick", { title: DOC }));
  assert.equal(main(p).querySelectorAll("thead th").length, 4, "still four columns");
  assert.ok(main(p).querySelector('.cs-hold button[data-act="watchitem"]'), "Watch is offered in the table");
  await press(p, "select", { nth: stripIndex(p, "select"), values: pick([d.ids.doc]) });
  assert.deepEqual(last(p, "select").body.ids, [d.ids.doc], "the picked row is held");
  const held = await d.rosa.read("selection", { query: { handle: p.byOp("selection").at(-1).query.handle } });
  assert.deepEqual(held.members, [d.ids.doc], "the store holds it");
});

test("R54 (C23): the words box is a full-width field with its button below it, and each help line sits under the control it explains", async () => {
  const d = await desk();
  await d.rosa.act("themedeclare", { body: { name: "Street repair", test: "a street mended" } });
  const p = await open(d, "/app/finder");
  const q = p.doc.getElementById("finder-q");
  const ancestors = []; for (let n = q.parentNode; n && n !== main(p); n = n.parentNode) ancestors.push(n.className || "");
  assert.ok(!ancestors.some((c) => /\bmk-search\b/.test(c)), "no row that leaves the field its content's width");
  const html = main(p).innerHTML;
  assert.ok(html.indexOf('id="finder-q"') >= 0 && html.indexOf('id="finder-q"') < html.indexOf('data-act="search"'), "the button follows the field");
  assert.ok(helpOf(p, "screen.finder.table.view.help").querySelector("#finder-view") === null && helpOf(p, "screen.finder.table.view.help").parentNode.querySelector("#finder-view"), "Show as's help is with Show as");
  assert.ok(helpOf(p, "find.browse.new.means").parentNode.querySelector("#finder-state"), "New since's help is with Only");
  assert.ok(helpOf(p, "theme.filter.help").parentNode.querySelector("#finder-theme"), "Theme's help is with Theme");
  // Control: with no earlier visit there is no "new" choice and the help that says why is with Only.
  const d0 = await desk({ looked: false });
  const none = await open(d0, "/app/finder");
  assert.ok(text(none, helpOf(none, "find.browse.nosince").parentNode).length > 0 && helpOf(none, "find.browse.nosince").parentNode.querySelector("#finder-state"));
  assert.ok(!helpOf(none, "find.browse.new.means"));
});
