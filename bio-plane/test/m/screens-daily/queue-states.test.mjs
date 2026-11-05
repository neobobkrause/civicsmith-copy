/* The queue's other states (R58 to R61) on the real served page over the REAL store (store-request's `storeWorld()`, op-tables §5.3): choosing
   several items and acting once with each item's outcome, what the member answered, the feeds' honesty, and the set-aside findings with a muted
   item named. The team, its members, projects, documents, to-dos, findings, captures, decisions and snoozes are made by the real acts, and every
   answer the page reads is the real store's. Every sentence is asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { collectOwnerRows, fieldMismatches } from "../interface-shell/harness.mjs";
import { storeWorld } from "../store-request/fixtures.mjs";
import { hex, instant, resultOf } from "../store-request/door.mjs";
import { open as openRaw, refused, text, press as pressRaw, beside, last, main, word, hasWord, dmy, withScreens, settle, screen } from "./page.mjs";

const timeout = { timeout: 300000 };
const open = (w, as, path, plane = {}, o = {}) => openRaw(path, plane, { ...w.boot(as), screens: withScreens("document", "question", "project", "action", "dash-project", "members"), ...o });
// a day well after tomorrow, on the page's own clock (R79 (c): a snooze comes back tomorrow at the earliest)
const LATER = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const R = "looking";
const press = (p, op, o = {}) => pressRaw(p, op, { reason: R, ...o });
const pick = (id) => `queue-pick-${id}`;
const stripButton = (p, op) => main(p).querySelectorAll(`.cs-hold button[data-act="${op}"]`)[0] || null;
const choose = async (p, ids) => { for (const id of ids) { const box = p.doc.getElementById(pick(id)); assert.ok(box, "a box on " + id); box.checked = true; await p.click(box); } };
const ask = async (w, as, op, body) => resultOf(await w.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, as));
const itemsOf = async (as, query = {}) => (await as.read("queue", { query })).items;
const FINDING_KIND = "shared-inquiry-concluded-by-another-project";

/** A team: rosa (administrator, owner of both projects), mai (a member, joined to both), the projects "Pothole repairs" and "Coliseum". */
async function team() {
  const w = await storeWorld();
  const rosa = await w.signIn("rosa", { admin: true });
  const mai = await w.signIn("mai");
  const p1 = await w.recipes.project(rosa, "Pothole repairs"), p2 = await w.recipes.project(rosa, "Coliseum");
  for (const p of [p1, p2]) { await rosa.act("projectinvite", { query: { projectId: p, handle: "mai" } }); await mai.act("projectjoin", { query: { projectId: p } }); }
  return { w, rosa, mai, p1, p2 };
}
/** To-dos for `to`: a web page "Doc <name>" held in `project` for each name, and a check of it asked of `to` by rosa. Answers the documents' bundle ids. */
async function todos(w, rosa, to, project, names, { inCase = false } = {}) {
  const ids = [];
  for (const n of names) {
    const doc = await w.recipes.page(rosa, "Doc " + n, { project });
    // a document is in a case (a project) once a question of the project rests on it
    if (inCase) await w.recipes.question(rosa, project, { title: "About " + n, text: "Is " + n + " so?", legs: [{ target: doc.bundle, role: "supports" }], draw: true });
    await rosa.act("checkrequest", { body: { target: doc.bundle, member: to.handle, note: "please look at " + n } });
    ids.push(doc.bundle);
  }
  return ids;
}
/** The check `to` was asked of the document `doc` taken by `to` (`checktake`): her To do now closes only when the check is recorded. */
async function took(rosa, to, doc) {
  const asked = (await rosa.read("checkrequests")).requests.find((r) => r.target === doc && r.member === to.handle);
  await to.act("checktake", { body: { request: asked.request } });
}
/** `n` questions drawn into both projects and concluded by rosa in the first: each tells the second's members (a FINDING, "shared-inquiry-concluded-by-another-project",
 *  with the second project its home). Answers the questions' ids. */
async function findings(w, rosa, p1, p2, n, from = 1) {
  const ids = [];
  for (let i = from; i < from + n; i++) {
    const doc = await w.recipes.page(rosa, `Source ${i}`, { project: p1 });
    const q = await w.recipes.question(rosa, p1, { title: `Question ${i}`, text: `Is ${i} so?`, legs: [{ target: doc.bundle, role: "supports" }], draw: true });
    await rosa.act("drawquestion", { query: { project: p2, inquiry: q.id, note: "" } });
    await rosa.act("conclude", { query: { target: q.id, project: p1, reading: `Reading ${i} holds on the record.`, falsifier: `The record shows otherwise for ${i}.` } });
    ids.push(q.id);
  }
  await w.tick(120_000);
  return ids;
}
const todoOf = (items, title) => items.find((i) => i.kind === "check-requested" && i.subject.title === title);
const findingOf = (items, inquiry) => items.find((i) => i.kind === FINDING_KIND && i.subject.inquiry === inquiry);
/** The world's `queue` answer for `as`, with `extra` items added (not the muted, answered or set-aside lists): only for an item no producer of the real
 *  store makes, or one the store no longer holds (a to-do that left between the read and the press). Each use says which. */
const queueWith = (w, as, extra) => async (req) => {
  const a = await w.boot(as).door(req);
  const r = a.json && a.json.result;
  if (r && Array.isArray(r.items) && !req.query.muted && !req.query.answered && !req.query.aside) { r.items = [...r.items, ...extra]; r.item_count = r.items.length; }
  return a;
};
/** An item shaped as `like` is, with `over` (the id one the store does not hold). */
const clone = (like, over) => ({ ...JSON.parse(JSON.stringify(like)), ...over });
/** A letter to approve (kind `filing-approval`, its door `filingapprove`): no producer of the store makes one (queue R12 names none), so the page's reading of it is tried on one item. */
const letterLike = (like, id) => clone(like, { id, kind: "filing-approval", summary: "A letter to approve", options: [], disposition: { available: false, instead: "filingapprove" } });

test("R58: the queue offers choosing several items and what was answered; choosing puts a box on each item and the hold strip with the number chosen", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  await todos(w, rosa, mai, p1, ["T1", "T2"]);
  const [q1] = await findings(w, rosa, p1, p2, 1);
  const items = await itemsOf(mai);
  const [t1, t2, f1] = [todoOf(items, "Doc T1"), todoOf(items, "Doc T2"), findingOf(items, q1)];
  assert.ok(t1 && t2 && f1, "the real queue holds two to-dos and a finding");
  const p = await open(w, mai, "/app/queue");
  const links = main(p).querySelectorAll('a[href="/app/queue/choose"], a[href="/app/queue/answered"]');
  assert.deepEqual(links.map((a) => a.textContent), [word("queue.multi.choose"), word("queue.answered.title")]);
  const c = await open(w, mai, "/app/queue/choose");
  assert.ok(text(c).includes(word("queue.multi.head")) && text(c).includes(word("queue.multi.head2")));
  assert.equal(main(c).querySelectorAll('input[data-shell="pick"]').length, items.length, "a box on each item");
  assert.equal(main(c).querySelector(".cs-hold"), null, "control: nothing chosen draws no strip");
  await choose(c, [t1.id]);
  assert.ok(text(c, main(c).querySelector(".cs-hold")).includes(word("queue.multi.chosen.one")));
  await choose(c, [t2.id, f1.id]);
  assert.ok(text(c, main(c).querySelector(".cs-hold")).includes(word("queue.multi.chosen", { n: "3" })));
  assert.deepEqual(["taskresolve", "taskforward", "queuesnooze", "proposedispose"].filter((o) => stripButton(c, o)).length, 4, "the four acts");
  assert.equal(c.byOp("taskresolve").length + c.byOp("proposedispose").length, 0, "choosing sends nothing");
});

test("R58: Mark them done sends taskresolve once with the chosen items; the outcome says for each item done or not handled, stays here, with the door that is why; nothing chosen sends nothing", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  const [, docT2] = await todos(w, rosa, mai, p1, ["T1", "T2"]);
  await took(rosa, mai, docT2);   // she took the check: her To do closes only by the check recorded, so the set act retains it, with the record's own words
  await findings(w, rosa, p1, p2, 1);
  const real = await itemsOf(mai);
  const [t1, t2] = [todoOf(real, "Doc T1"), todoOf(real, "Doc T2")];
  // A letter to approve: the one item added to the real queue (no producer of the store makes one).
  const letter = letterLike(t1, "TASK-2026-9998-letter");
  const p = await open(w, mai, "/app/queue/choose", { queue: queueWith(w, mai, [letter]) });
  await settle();
  const none = await press(p, "taskresolve", { nth: 0 }).catch(() => null);
  assert.equal(none, null, "control: with nothing chosen there is no strip to press");
  await choose(p, [t1.id, t2.id, letter.id]);
  await press(p, "taskresolve", { nth: 0, values: { "qm-to": "" } });
  const calls = p.byOp("taskresolve");
  assert.equal(calls.length, 1, "once");
  assert.deepEqual(calls[0].body.items, real.filter((i) => i === t1 || i === t2).map((i) => ({ id: i.id })), "the to-dos the set act reaches; the letter's own door is not sent");
  const retained = (await ask(w, mai, "taskresolve", { items: [{ id: t2.id }] })).items[0];
  assert.equal(retained.outcome, "retained");
  assert.ok(retained.translation, "the record gives its reason in its own words");
  const t = text(p);
  assert.ok(t.includes(word("queue.multi.result", { n: "3", done: "1", kept: "2" })));
  assert.equal(t.split(word("queue.multi.refused")).length - 1, 2);
  assert.ok(t.includes(word("queue.multi.why.letter")), "a letter to approve");
  assert.ok(t.includes(retained.translation), "a kept item's reason is the record's own translation");
  assert.ok(main(p).querySelector('a[href="/app/queue"]') && t.includes(word("queue.multi.back")));
  assert.ok((await itemsOf(mai)).every((i) => i.id !== t1.id), "the real to-do that was handled has left the queue");
  assert.ok((await itemsOf(mai)).some((i) => i.id === t2.id), "the kept one is still there");
  // An item never leaves on a refusal: back on the list the re-read queue still holds the kept items.
  assert.ok(p.byOp("queue").length >= 1);
});

test("R58, C71: a set act over a mix says why for every item it does not handle: a reason key on each kept row, none on a handled one", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  const cy = await w.signIn("cy", { admin: true });   // a non-founder administrator proposes: the founder's proposal issues at once (member-roster R87)
  const [doc] = await todos(w, mai, rosa, p1, []).then(async () => [(await w.recipes.page(rosa, "Doc T1", { project: p1 })).bundle]);
  await rosa.act("checkrequest", { body: { target: doc, member: "rosa", note: "please look at T1" } });
  await mai.act("expertisedeclare", { body: { label: "tenant law" } });
  await cy.act("reauth", { body: { password: cy.password } });
  await cy.act("memberadd", { body: { memberId: "dan", cover: "the world's member dan", role: "admin" } }).catch((e) => { if (!/CONSENSUS_REQUIRED/.test(e.message)) throw e; });
  const real = await itemsOf(rosa);
  const t1 = todoOf(real, "Doc T1"), expert = real.find((i) => i.kind === "expertise-confirmation-owed"), endorse = real.find((i) => i.kind === "endorsement-owed");
  assert.ok(t1 && expert && endorse, "the real queue holds a to-do, an expertise to confirm and an endorsement owed");
  const letter = letterLike(t1, "TASK-2026-9998-letter");
  const p = await open(w, rosa, "/app/queue/choose", { queue: queueWith(w, rosa, [letter]) });
  await settle();
  await choose(p, [t1.id, expert.id, endorse.id, letter.id]);
  await press(p, "taskresolve", { nth: 0 });
  assert.deepEqual(last(p, "taskresolve").body.items, [{ id: t1.id }], "only the item the set act reaches is sent");
  const rowOf = (needle) => main(p).querySelectorAll(".cs-row").find((r) => text(p, r).includes(needle));
  const rows = main(p).querySelectorAll(".cs-row").map((r) => text(p, r));
  const kept = rows.filter((r) => r.includes(word("queue.multi.refused")));
  assert.equal(kept.length, 3);
  const reasons = ["queue.multi.why.letter", "queue.multi.why.check", "queue.multi.done.help2"].map((k) => word(k));
  for (const r of kept) assert.ok(reasons.some((x) => r.includes(x)), "a reason on every kept row: " + r);
  assert.ok(text(p, rowOf("tenant law")).includes(word("queue.multi.done.help2")), "an item that needs the member's own reason says so, not nothing");
  assert.ok(text(p, rowOf(letter.summary)).includes(word("queue.multi.why.letter")));
  // Control: the handled row carries none of them.
  const done = rows.filter((r) => r.includes(word("queue.multi.done")) && r.includes("Doc T1"));
  assert.equal(done.length, 1);
  for (const x of reasons) assert.ok(!done[0].includes(x), "a handled row draws no reason");
});

test("R58: an item that is a check another member asked of you stays with the check's reason, its own door beside it", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  await todos(w, rosa, mai, p1, ["T1", "T2"]);
  const real = await itemsOf(mai);
  const [t1, t2] = [todoOf(real, "Doc T1"), todoOf(real, "Doc T2")];
  // The page tells "a check to answer" by the kind `check`, which no producer of the store makes (the catalogue's is `check-requested`, which the
  // set act resolves for the member alone): so the check is one item added to the real queue, a to-do the store no longer holds, answered by it.
  const check = clone(t1, { id: "TASK-2026-9997-check", kind: "check" });
  const p = await open(w, mai, "/app/queue/choose", { queue: queueWith(w, mai, [check]) });
  await settle();
  await choose(p, [t1.id, t2.id, check.id]);
  await press(p, "taskresolve", { nth: 0 });
  const t = text(p);
  assert.ok(t.includes(word("queue.multi.why.check")) && !t.includes(word("queue.multi.why.letter")));
});

test("R58: Forward sends taskforward once with items and the one member; Dismiss sends proposedispose once with items, the one reason and to dismissed; a call over the bound is sent in further calls in order", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  const [docT1] = await todos(w, rosa, mai, p1, ["T1", "T2"]);
  const [docM] = [(await w.recipes.page(rosa, "Doc M", { project: p1 })).bundle];
  for (let i = 0; i < 103; i++) await rosa.act("checkrequest", { body: { target: docM, member: "mai", note: "many " + i } });
  const [q1, q2] = await findings(w, rosa, p1, p2, 2);
  const items = await itemsOf(mai);
  const [t1, t2] = [todoOf(items, "Doc T1"), todoOf(items, "Doc T2")];
  const [f1, f2] = [findingOf(items, q1), findingOf(items, q2)];
  const many = items.filter((i) => i.kind === "check-requested" && i.subject.title === "Doc M");
  assert.equal(many.length, 103);
  assert.ok(docT1 && t1 && t2 && f1 && f2);
  const inQueue = (list) => items.filter((i) => list.some((x) => x.id === i.id));   // the queue's own order
  const p = await open(w, mai, "/app/queue/choose");
  await settle();
  await choose(p, [t1.id, t2.id]);
  await press(p, "taskforward", { nth: 0, values: { "qm-to": "@rosa" } });
  assert.deepEqual([p.byOp("taskforward").length, p.byOp("taskforward")[0].body], [1, { items: inQueue([t1, t2]).map((i) => ({ id: i.id })), to: "rosa" }]);
  const q = await open(w, mai, "/app/queue/choose");
  await settle();
  await choose(q, [f1.id, f2.id]);
  await press(q, "proposedispose", { nth: 0, reason: "not worth pursuing" });
  assert.equal(q.byOp("proposedispose").length, 1);
  assert.deepEqual(q.byOp("proposedispose")[0].body, { items: inQueue([f1, f2]).map((i) => ({ project: p2, finding: i.id })), to: "dismissed", reason: "not worth pursuing" });
  // Over the bound: 103 to-dos go in calls of at most 100, in order.
  const b = await open(w, mai, "/app/queue/choose");
  await settle();
  await choose(b, many.map((x) => x.id));
  await press(b, "taskresolve", { nth: 0 });
  const order = inQueue(many).map((i) => i.id);
  assert.deepEqual(b.byOp("taskresolve").map((r) => r.body.items.length), [100, 3]);
  assert.deepEqual(b.byOp("taskresolve").flatMap((r) => r.body.items.map((x) => x.id)), order);
  assert.equal((await itemsOf(mai)).filter((i) => i.subject.title === "Doc M").length, 0, "the real store resolved them all");
  const empty = await open(w, mai, "/app/queue/choose");
  await settle();
  assert.equal(stripButton(empty, "taskforward"), null);
});

test("R58, R70: a set of findings of a declared flow sends each item's key with definitionVersion (the word proposedispose reads), never definition_version; one with no version sends the key alone", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  const [q1] = await findings(w, rosa, p1, p2, 1);
  const real = await itemsOf(mai);
  const like = findingOf(real, q1);
  // A flow's findings (a stage required and absent in a declared flow, with its instances) come of entities and dated documents threaded through it,
  // which no act of the world makes; so the two items are added to the real queue, and the act's answer is the real store's.
  const staged = (id, version) => clone(like, { id: "FINDING::prog::" + id, subject: { ...like.subject, id: "prog::" + id },
    disposition: { available: true, op: "proposedispose", scope: "instance", key: "prog::" + id, ...(version === null ? {} : { definition_version: version }) } });
  const [s1, s2] = [staged("S1", 4), staged("S2", null)];
  const p = await open(w, mai, "/app/queue/choose", { queue: queueWith(w, mai, [s1, s2]) });
  await settle();
  await choose(p, [s1.id, s2.id]);
  await press(p, "proposedispose", { nth: 0, reason: "settled by the flow" });
  assert.equal(p.byOp("proposedispose").length, 1);
  assert.deepEqual(p.byOp("proposedispose")[0].body, { items: [{ key: "prog::S1", definitionVersion: 4 }, { key: "prog::S2" }], to: "dismissed", reason: "settled by the flow" });
  assert.ok(!JSON.stringify(p.byOp("proposedispose")[0].body).includes("definition_version"), "control: the old spelling is not sent");
});

test("R58: Snooze sends queuesnooze once for each distinct case among the chosen items, the day from the field; an item with no case is not handled", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  await w.recipes.profiles(rosa, ["oakland-alameda"]);   // the team's time zone: a day is read where the team is
  const [doc] = await todos(w, rosa, rosa, p1, ["T1"], { inCase: true });
  await rosa.act("checkrequest", { body: { target: doc, member: "rosa", note: "and again" } });
  const [q1] = await findings(w, rosa, p1, p2, 1);
  // an item in no case: a capture asked for by a member whose address the world's network answers (its authority undetermined, a To do for the administrators)
  const question = await w.recipes.question(rosa, p1, { title: "Asked", text: "What did the council decide?" });
  const address = "https://records.example.org/minutes-nocase.html";
  w.script(address, async () => new Response("<html><head><title>Minutes</title></head><body><p>The council met.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
  await rosa.act("capturerequest", { body: { address, target: question.id } });
  await w.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: w.env.DAEMON_TOKEN });
  await w.tick(120_000);
  await w.door({ url: "/api/?op=taskdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: w.env.ADMIN_TOKEN });
  const items = await itemsOf(rosa);
  const todo = items.filter((i) => i.kind === "check-requested"), f1 = findingOf(items, q1), t3 = items.find((i) => i.kind === "authority-undetermined");
  assert.equal(todo.length, 2);
  assert.ok(f1 && t3 && t3.case.ungrouped === true, "the real queue holds an item in no case");
  const chosen = [...todo, f1, t3];
  const caseOf = (i) => (i.case.ancestors.find((a) => a.type === "project") || {}).id;
  const cases = [...new Set(items.filter((i) => chosen.includes(i)).map(caseOf).filter(Boolean))];
  const p = await open(w, rosa, "/app/queue/choose");
  await settle();
  await choose(p, chosen.map((i) => i.id));
  await press(p, "queuesnooze", { nth: 0, values: { "qm-until": LATER } });
  assert.deepEqual(p.byOp("queuesnooze").map((r) => r.body), cases.map((c) => ({ case: c, until: LATER })));
  assert.equal(cases.length, 2);
  assert.ok(text(p).includes(word("queue.multi.result", { n: "4", done: "3", kept: "1" })));
  const none = await open(w, rosa, "/app/queue/choose");
  await settle();
  await choose(none, [todo[0].id]);
  const b = await press(none, "queuesnooze", { nth: 0 });
  assert.equal(none.byOp("queuesnooze").length, 0, "control: no day, nothing sent");
  assert.equal(beside(none, b), word("screen.queue.fieldfirst"));
});

/** Real administrator to-dos for a team: a question in a project and `n` documents each captured, at the request of rosa, from a public address of its own
 *  (`capturerequest`, drained by the daemon), whose authority nobody has determined: after the scheduler's next round each administrator holds one to-do for each.
 *  Answers the to-dos (the `tasks` read) in the order the store gives them. */
async function undetermined(w, rosa, project, n) {
  const q = await w.recipes.question(rosa, project, { title: "What was decided", text: "What did the council decide?" });
  for (let i = 1; i <= n; i++) {
    const address = `https://site${i}.example.org/minutes.html`;
    w.script(address, async () => new Response(`<html><head><title>Minutes ${i}</title></head><body><p>The council met.</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }));
    await rosa.act("capturerequest", { body: { address, target: q.id } });
  }
  await w.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: w.env.DAEMON_TOKEN });
  await w.tick(120_000);
  return (await rosa.read("tasks")).tasks;
}
const clockOf = (iso) => { const d = new Date(iso); return word("time.clock", { hour: String(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12), minute: String(d.getMinutes()).padStart(2, "0"), ampm: word(d.getHours() < 12 ? "time.am" : "time.pm") }); };
const whenOf = (iso) => word("time.at", { date: dmy(iso.slice(0, 10)), time: clockOf(iso) });
/** The world's `queue` answer for `as`, passed through `edit` for the one kind of read it is about: `which` is "items" (the feed), "answered" or "aside".
 *  The door call is the real one, only the fields `edit` names are replaced (each use says which and why the store cannot make it). */
const through = (w, as, which, edit) => async (req) => {
  const a = await w.boot(as).door(req);
  const r = a.json && a.json.result;
  const kind = req.query.answered ? "answered" : req.query.aside ? "aside" : req.query.muted ? "muted" : "items";
  if (r && kind === which) a.json.result = edit(r, req) || r;
  return a;
};

test("R59: the answered page reads queue with answered true and draws each answer newest first with who and when, a forward and a snooze with their days; it sends nothing but the read", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  await w.recipes.profiles(rosa, ["oakland-alameda"]);
  const founder = await w.signIn("admin");
  const tasks = await undetermined(w, rosa, p1, 5);
  assert.equal(tasks.length, 5, "the real store holds five to-dos for the administrators");
  const [mine, theirs, said, first, bare] = tasks;
  // each act is made a minute apart, so the answers have an order of their own: newest first
  await rosa.act("taskresolve", { body: { id: mine.id } });                                 // resolved by her (by_you)
  await w.tick(60_000);
  await founder.act("taskresolve", { body: { id: theirs.id } });                            // resolved by another member
  await w.tick(60_000);
  await rosa.act("taskforward", { body: { items: [{ id: said.id }], to: "mai" } });         // a forward that names whom it went to
  await w.tick(60_000);
  await rosa.act("taskforward", { body: { items: [{ id: first.id }], to: "mai" } });        // a forward that was passed on again: it names nobody now
  await mai.act("taskforward", { body: { items: [{ id: first.id }], to: "admin" } });
  await w.tick(60_000);
  await rosa.act("taskresolve", { body: { id: bare.id } });                                 // a to-do that has no title to show
  await w.tick(60_000);
  await rosa.act("queuesnooze", { body: { case: p1, until: LATER } });
  const real = (await rosa.read("queue", { query: { answered: "true" } })).answered;
  const by = (act, id) => real.find((r) => r.act === act && r.id === id);
  assert.ok(by("resolved", mine.id) && by("resolved", mine.id).by_you === true && by("resolved", theirs.id).by_you === false, "the real answers hold her act and another member's");
  assert.equal(by("forwarded", first.id).to, null, "the real store names nobody for a forward passed on again");
  assert.equal(by("forwarded", said.id).to, "mai");
  assert.ok(real.some((r) => r.act === "snoozed"));
  // The one field the store does not make: a to-do with no title (the page names it by the untitled word).
  const p = await open(w, rosa, "/app/queue/answered", { queue: through(w, rosa, "answered", (r) => ({ ...r, answered: r.answered.map((x) => (x.id === bare.id ? { ...x, title: null } : x)) })) });
  await settle();
  const reads = p.byOp("queue");
  assert.ok(reads.some((r) => r.query.answered === "true"));
  assert.deepEqual(p.requests.filter((r) => r.method !== "GET" && r.op !== "subscriptionsignin").map((r) => r.op), [], "the page sends nothing but the read");
  const t = text(p);
  assert.ok(t.includes(word("queue.answered.byyou", { when: whenOf(by("resolved", mine.id).at) })));
  assert.ok(t.includes(word("queue.answered.bymember", { member: "founder", when: whenOf(by("resolved", theirs.id).at) })), "another member's, by her handle, by_you false");
  assert.ok(t.includes(word("queue.answered.byother")));
  assert.ok(t.includes(word("queue.source.untitled", { date: dmy(by("resolved", bare.id).at.slice(0, 10)) })), "a to-do with no title is named by the untitled word");
  assert.ok(t.includes(word("queue.answered.forwarded", { item: by("forwarded", said.id).title, member: "mai" })));
  assert.ok(!t.includes(word("queue.answered.forwarded", { item: by("forwarded", first.id).title, member: "null" })), "control: an earlier forward names nobody, never guessed");
  assert.ok(t.includes(word("queue.answered.forwarded.unnamed", { item: by("forwarded", first.id).title })), "an earlier forward is its own sentence, naming nobody");
  const snooze = real.find((r) => r.act === "snoozed");
  assert.ok(t.includes(word("queue.answered.snoozed", { item: snooze.case.title, date: dmy(LATER) })));
  assert.ok(t.includes(word("queue.answered.snoozed.meta")));
  const rows = main(p).querySelectorAll(".cs-row").map((r) => text(p, r));
  const shown = real.filter((r) => r.act !== "set_aside");
  assert.equal(rows.length, shown.length, "a row for each answer");
  shown.forEach((r, i) => assert.ok(rows[i].includes(r.act === "snoozed" ? r.case.title : r.id === bare.id ? word("queue.source.untitled", { date: dmy(r.at.slice(0, 10)) }) : r.title), "newest first, as the read answers them: " + i));
  assert.equal(shown[0].act, "snoozed", "control: the newest act is the first row");
  const failed = await open(w, rosa, "/app/queue/answered", { queue: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'), "a failed read is drawn failed");
});

/** The feeds' honesty as the world's `queue` answer holds it, with the feeds in `failed` (ids) not answered: the one field a store that answers every feed
 *  cannot make, a feed that failed. The items, the door call and every other field are the real store's. */
const feedsFailing = (failed, over = {}) => (r) => ({ ...r, feeds: [...(r.feeds || []), ...failed.map((f) => ({ feed: f, classes: ["FINDING"], answered: false, failed: ["x"] }))],
  all_answered: !failed.length, classes_answered: { OBLIGATION: true, FINDING: !failed.length, CONDITION: true }, all_clear: { OBLIGATION: true, FINDING: !failed.length, CONDITION: true }, ...over });

test("R60: a feed that did not answer is named at the head of a queue with items, with Try again; with nothing waiting the all-clear is withheld and no class is told none here", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  await todos(w, rosa, mai, p1, ["T1"]);
  const real = await mai.read("queue");
  assert.ok(real.items.length >= 1 && real.all_answered === true, "the real store's queue holds the to-do and every feed answered");
  const nothing = await w.signIn("noel");   // a member the queue holds nothing for
  assert.equal((await nothing.read("queue")).items.length, 0);
  const asMai = (failed, over) => ({ queue: through(w, mai, "items", feedsFailing(failed, over)) });
  const withItems = await open(w, mai, "/app/queue", asMai(["sources"]));
  await settle();
  const t = text(withItems);
  assert.ok(t.includes(word("queue.allclear.failed")) && t.includes(word("queue.allclear.failed2")));
  const retry = main(withItems).querySelector(`a[href="/app/queue"]`);
  assert.ok(retry && [...main(withItems).querySelectorAll("a")].some((a) => a.textContent === word("queue.tryagain")));
  const named = await open(w, mai, "/app/queue", asMai(["retrieval"]));
  await settle();
  assert.ok(text(named).includes(word("queue.allclear.failed.feed", { feed: word("queue.feed.retrieval") })));
  for (const id of ["tasks", "bias-debts", "proposals", "shared-inquiries", "leads", "exports", "references", "objectives", "machinery", "contradictions", "signing-keys",
    "action", "attribution", "docket", "cited-cases", "wizards", "schedule", "places", "projects"]) {
    const one = await open(w, mai, "/app/queue", asMai([id]));
    await settle();
    assert.ok(text(one).includes(word("queue.allclear.failed.feed", { feed: word("queue.feed." + id) })), id);
  }
  const bare = await open(w, mai, "/app/queue", asMai(["tasks-x"]));
  await settle();
  assert.ok(text(bare).includes(word("queue.allclear.withheld")), "a feed the word list does not name is not named, and the class stays withheld");
  const withheld = await open(w, nothing, "/app/queue", { queue: through(w, nothing, "items", feedsFailing(["sources"])) });
  await settle();
  const wh = text(withheld);
  assert.ok(wh.includes(word("queue.allclear.withheld")) && wh.includes(word("queue.allclear.failed")) && wh.includes(word("queue.tryagain")));
  assert.ok(!wh.includes(word("screen.queue.empty")) && !wh.includes(word("queue.none.todo")), "no 'nothing is waiting' and no 'none here'");
  // Control: all feeds answered, nothing waiting (the store's own answer): the sentence, each class, the up-to-date row and the door to Home; no kinds legend or sort controls.
  const clear = await open(w, nothing, "/app/queue");
  await settle();
  const c = text(clear);
  assert.ok(c.includes(word("screen.queue.empty")) && c.includes(word("screen.queue.uptodate")) && c.includes(word("screen.queue.gohome")));
  for (const k of ["todo", "noticed", "status"]) assert.ok(c.includes(word(`queue.none.${k}`)) && c.includes(word(`queue.none.${k}2`)), k);
  assert.ok(!c.includes(word("screen.queue.sort")));
  // Control: a class whose feeds did not all answer is not told none here, though the rest are (every feed answered, the finding class not clear).
  const part = await open(w, nothing, "/app/queue", { queue: through(w, nothing, "items", (r) => ({ ...r, all_answered: true, all_clear: { OBLIGATION: true, FINDING: false, CONDITION: true } })) });
  await settle();
  assert.ok(!text(part).includes(word("queue.none.noticed")) && text(part).includes(word("queue.none.todo")));
  // Control: an item held draws no 'none here' for its class (the list is drawn, not the all-clear).
  assert.ok(!text(withItems).includes(word("queue.none.todo")));
});

/** The set-aside findings, `aside` list of the world's queue answer for `as`, served in pages of `size` by `after` (the cursor is the index of the next row),
 *  with `front` rows first: the store pages by its own bound of 200 and its instance-scope rows come of a declared flow, which no act of the world makes. */
const asidePaged = (w, as, size, front = []) => async (req) => {
  if (!req.query.aside) return w.boot(as).door(req);
  const a = await w.boot(as).door({ ...req, query: { ...req.query, after: "" } });
  const r = a.json && a.json.result;
  const rows = [...front, ...r.aside];
  const from = req.query.after ? Number(req.query.after) : 0;
  a.json.result = { ...r, aside: rows.slice(from, from + size), count: rows.slice(from, from + size).length, truncated: from + size < rows.length, next: from + size < rows.length ? String(from + size) : null };
  return a;
};

test("R61: the set-aside findings are listed on the answered page with the decision, its reason and the version judged; a deferred one offers Dismiss with a reason; all pages are walked and each row listed once", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  const qs = await findings(w, rosa, p1, p2, 4);
  const items = await itemsOf(mai);
  const [f1, f2, f3, f4] = qs.map((q) => findingOf(items, q));
  assert.ok(f1 && f2 && f3 && f4, "the real queue holds four findings");
  const set = (as, f, to, reason) => as.act("proposedispose", { body: { items: [{ project: p2, finding: f.id }], to, reason } });
  await set(mai, f1, "deferred", "later");                 // deferred by her: offers Dismiss
  await w.tick(60_000);
  await set(mai, f2, "dismissed", "not worth pursuing");   // dismissed by her
  await w.tick(60_000);
  await set(rosa, f3, "dismissed", "settled");             // dismissed by another member
  await set(mai, f4, "dismissed", "enough already");
  const real = (await mai.read("queue", { query: { aside: "true" } })).aside;
  assert.equal(real.length, 4, "the real store lists the four set aside");
  const byFinding = (f) => real.find((r) => r.finding === f.id);
  assert.deepEqual([byFinding(f1).state, byFinding(f2).state, byFinding(f3).state], ["deferred", "dismissed", "dismissed"]);
  // A flow's finding (a stage required and absent in a declared flow, set aside at version 3) comes of entities and dated documents threaded through it, which
  // no act of the world makes: the one row added to the real store's list, first (newest), and the list served in pages of 3 by `after`.
  const flow = { scope: "instance", finding: "FINDING::prog::stage", project: null, key: "prog::stage", state: "deferred", reason: "r1", decided_by: "you", at: "2099-10-09T10:00:00Z", definition_version: 3, title: "A stage" };
  const p = await open(w, mai, "/app/queue/answered", { queue: asidePaged(w, mai, 3, [flow]) }, { screens: withScreens("document", "question", "project", "action", "dash-project", "members", "timeline") });
  await settle(80);
  const asides = p.byOp("queue").filter((r) => r.query.aside);
  assert.deepEqual(asides.map((r) => r.query.after || ""), ["", "3"], "walked in pages by after");
  const sec = main(p).querySelectorAll("section").find((s) => s.querySelector("h2") && s.querySelector("h2").textContent === word("progression.finding.state.dismissed"));
  assert.ok(sec, "the set-aside section");
  const rows = sec.querySelectorAll(".cs-row");
  assert.equal(rows.length, 5, "each listed once");
  const t0 = text(p, rows[0]);
  assert.ok(t0.includes(word("queue.aside.deferred", { date: dmy("2099-10-09") })) && t0.includes(word("queue.aside.v2", { n: "3" })) && t0.includes("r1"));
  assert.ok(rows[0].querySelector('button[data-act="proposedispose"]'), "a deferred row offers Dismiss with a reason");
  const t1 = text(p, rows[1]);   // the first real row, newest first: the dismissal by another member of f3 or her own of f4 (the same minute): either way dismissed, with its reason, no version
  assert.ok(!t1.includes(word("queue.aside.v2", { n: "3" })), "control: a project row with no version draws no version line");
  assert.ok(!rows[1].querySelector('button[data-act="proposedispose"]'));
  const mineDismissed = real.find((r) => r.finding === f4.id), others = byFinding(f3);
  assert.ok(text(p, sec).includes(word("queue.aside.dismissed", { date: dmy(mineDismissed.at.slice(0, 10)) })) && text(p, sec).includes("enough already"));
  assert.ok(text(p, sec).includes(word("queue.aside.dismissed.bymember", { member: "rosa", date: dmy(others.at.slice(0, 10)) })), "another member's decision by her handle");
  assert.ok(text(p, sec).includes(word("queue.aside.deferred", { date: dmy(byFinding(f1).at.slice(0, 10)) })), "her deferral");
  await press(p, "proposedispose", { nth: 0, reason: "enough" });
  assert.deepEqual(last(p, "proposedispose").body, { key: "prog::stage", definitionVersion: 3, to: "dismissed", reason: "enough" });
  // R70: control: the old spelling fails the guard over the owner's declaration.
  const declared = collectOwnerRows().proposedispose;
  assert.deepEqual(fieldMismatches({ query: {}, body: { key: "k", definition_version: 3, to: "dismissed", reason: "r" } }, declared).map((m) => m.field), ["definition_version"]);
  assert.deepEqual(fieldMismatches({ query: {}, body: { key: "k", definitionVersion: 3, to: "dismissed", reason: "r" } }, declared), []);
});

test("R61: Dismiss on a deferred finding of a project, as the real store lists it (its row carries a `project::finding` key), sends the project and the finding and the store sets it aside", timeout, async () => {
  const { w, rosa, mai, p1, p2 } = await team();
  const [q] = await findings(w, rosa, p1, p2, 1);
  const f = findingOf(await itemsOf(mai), q);
  await mai.act("proposedispose", { body: { items: [{ project: p2, finding: f.id }], to: "deferred", reason: "later" } });
  const p = await open(w, mai, "/app/queue/answered");
  await settle(80);
  await press(p, "proposedispose", { nth: 0, reason: "enough" });
  assert.deepEqual({ ...last(p, "proposedispose").body }, { project: p2, finding: f.id, to: "dismissed", reason: "enough" }, "a project's finding is named by project and finding, not by the row's key");
  const real = (await mai.read("queue", { query: { aside: "true" } })).aside;
  assert.equal(real.find((r) => r.finding === f.id).state, "dismissed", "the real store set it aside");
});

test("R34: every key the queue reads is a word of the list, including the states' words", () => {
  for (const k of screen("queue").words) assert.ok(hasWord(k), k);
  for (const k of ["queue.multi.entry", "queue.answered.title", "queue.allclear.withheld", "queue.aside.help", "queue.tryagain"]) assert.ok(screen("queue").words.includes(k), k);
});
