/* The member's queue (R2, R3, R12, R13, R18, R19, R22, R28, R31) on the real served page (interface-shell's harness): the sort, the
   kinds, the words, the due dates, the hints, the note shown once, the grouping by case, and each act an item offers with what
   it sends. Items are in `queue` R6's shape, their options decorated (R17) and their dispositions naming their doors (R12,
   R46). Every sentence is asserted as `word(key, vars)` (R34): no test here holds a sentence's English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open, ok, refused, text, ops, acts, button, press, beside, last, main, screen, word, hasWord, dmy, withScreens } from "./page.mjs";
import { ADMIN } from "../interface-shell/harness.mjs";

const timeout = { timeout: 300000 };
const openW = (w, as, path, plane = {}, o = {}) => open(path, plane, { ...w.boot(as), ...o });
/** A team on the REAL store (store-request's `storeWorld()`): rosa (administrator, owner of both projects), mai (a member, joined to both), ana (a member),
 *  the projects "Pothole repairs" and "The Coliseum lease", and the team's time zone (a day is read where the team is). */
async function team(env = {}) {
  const w = await storeWorld({ env });
  const rosa = await w.signIn("rosa", { admin: true });
  const mai = await w.signIn("mai");
  const ana = await w.signIn("ana");
  await w.recipes.profiles(rosa, ["oakland-alameda"]);
  const p1 = await w.recipes.project(rosa, "Pothole repairs"), p2 = await w.recipes.project(rosa, "The Coliseum lease");
  for (const p of [p1, p2]) { await rosa.act("projectinvite", { query: { projectId: p, handle: "mai" } }); await mai.act("projectjoin", { query: { projectId: p } }); }
  return { w, rosa, mai, ana, p1, p2 };
}
/** A web page "Doc <name>" held in `project` (in the case: a question of the project rests on it), and a check of it asked of `to` by rosa (her To do).
 *  Answers the document's bundle id. */
async function todo(w, rosa, to, project, name) {
  const doc = await w.recipes.page(rosa, "Doc " + name, { project });
  await w.recipes.question(rosa, project, { title: "About " + name, text: "Is " + name + " so?", legs: [{ target: doc.bundle, role: "supports" }], draw: true });
  await rosa.act("checkrequest", { body: { target: doc.bundle, member: to.handle, note: "please look at " + name } });
  return doc.bundle;
}
const itemsOf = async (as) => (await as.read("queue")).items;
const todoOf = (items, name) => items.find((i) => i.kind === "check-requested" && i.subject.title === "Doc " + name);
/** The world's `queue` answer for `as` with `edit` applied to the list of items (not the muted, answered or set-aside lists): the real items, some shown
 *  as the page draws what no producer of the store makes (each use says which). */
const queueAs = (w, as, edit) => async (req) => {
  const a = await w.boot(as).door(req);
  const r = a.json && a.json.result;
  if (r && Array.isArray(r.items) && !req.query.muted && !req.query.answered && !req.query.aside) { r.items = edit(r.items); r.item_count = r.items.length; }
  return a;
};
/** An unsent request by the real acts: an action of `project` (a records request), a letter drafted for it and approved by rosa, not recorded sent. */
async function unsent(w, rosa, project, title) {
  const doc = ["---", "object_type: action", "title: " + title, "current_state: active", 'created: "2026-10-01T00:00:00Z"', 'last_updated: "2026-10-01T00:00:00Z"',
    "action_kind: records_request", "project: " + project, "---", "", "An action.", ""].join("\n");
  const action = (await rosa.act("actioncreate", { body: { document: doc } })).id;
  await rosa.act("actionrisktier", { query: { target: action, tier: "1", reason: "a plain request" }, body: { target: action, tier: 1, reason: "a plain request" } });
  const filing = (await rosa.act("filingprepare", { body: { action, text: "Dear clerk, " + title + "." } })).id;
  await rosa.act("filingapprove", { body: { filing } });
  return { action, filing };
}
const PROJ = (id, title) => ({ state: "determined", ungrouped: false, ancestors: [{ id, type: "project", title, depth: 1 }] });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ITEMS = [
  { id: "TSK-1", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-1", "Pothole repairs"), subject: { kind: "bundle", id: "INF-7", title: "Work orders" },
    summary: "Ana asked you to check a calculation", detail: "812 of 903 reports", due: day(-1),
    options: [{ id: "cite", label: "Cite" }], disposition: { available: false, instead: "taskresolve" } },
  { id: "FINDING::tension::PROJ-2::x", class: "FINDING", kind: "tension", case: PROJ("PROJ-2", "The Coliseum lease"),
    subject: { kind: "bundle", id: "INF-8" }, summary: "Two filings disagree about the date",
    hint: { matched: "Form 700 against votes", how: "the check matched names", false_alarm_rate: 0.12, false: 3, looked: 25, reason: "a name shared by two people" },
    options: [], disposition: { available: true, op: "proposedispose", scope: "project", finding: "FINDING::tension::PROJ-2::x", projects: ["PROJ-2"] } },
  { id: "FINDING::newer::1", class: "FINDING", kind: "newer-capture-affects-reference", case: PROJ("PROJ-2", "The Coliseum lease"),
    subject: { kind: "capture", id: "abc123" }, summary: "A newer version", options: [],
    disposition: { available: true, scope: "notice", notice: "VN-5", acts: ["versionadopt", "versionkeep"] } },
  { id: "OBLIGATION::action-reminder::ACT-1::0::d", class: "OBLIGATION", kind: "action-reminder", case: PROJ("PROJ-1", "Pothole repairs"),
    subject: { kind: "action", id: "ACT-1", entry: 0 }, summary: "Remind me", due: day(0), options: [], disposition: { instead: "reminderanswer" } },
  { id: "OBLIGATION::explore-ask::x", class: "OBLIGATION", kind: "explore-ask", case: { ungrouped: true, ancestors: [] },
    subject: { kind: "ai_account", id: "project:PROJ-1", day: "2026-10-12" }, basis: { owner: "project:PROJ-1" },
    summary: "Explore today?", options: [], disposition: { instead: "exploreapprove" } },
  { id: "CONDITION::q", class: "CONDITION", kind: "step-date-due", word: "queue.step-date-due.summary", fills: { step: "Ask the clerk", date: "3 October" },
    case: { ungrouped: true, ancestors: [] }, summary: "raw summary", options: [{ id: "steps", label: "Steps" }], subject: { kind: "step", id: "STP-1" },
    disposition: { instead: "queuemute" } },
];
const FEED = { items: ITEMS, item_count: 8, truncated: true };
const PLANE = { queue: ok(FEED) };
const mainQueue = (p) => p.byOp("queue").filter((r) => r.query.limit !== "500" && r.query.muted === undefined && r.query.count === undefined); /* the frame's count read (interface-shell R7, sent when the list comes back cut) is not the screen's */
const itemOf = (p, id) => main(p).querySelectorAll(".cs-row").find((r) => r.querySelectorAll("button[data-act]").some((b) => b.dataset.item === id));
const opsOf = (row) => row.querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act"));
const UNTITLED = word("queue.source.untitled", { date: "" }).trim();

test("R2: the queue is read with the member's chosen sort (time added, time due, case, kind), the route's subject; any other the default", async () => {
  for (const s of ["added", "due", "case", "kind"]) {
    const p = await open("/app/queue/" + s, PLANE);
    assert.deepEqual(mainQueue(p).at(-1).query, { op: "queue", sort: s });
    assert.equal(main(p).querySelector("nav.mk-sortrow b[aria-current]").textContent, word(`screen.queue.sort.${s}`));
  }
  const d = await open("/app/queue", PLANE);
  assert.deepEqual(mainQueue(d).at(-1).query, { op: "queue" });
  const bogus = await open("/app/queue/bogus", PLANE);
  assert.deepEqual(mainQueue(bogus).at(-1).query, { op: "queue" });
  const links = main(d).querySelectorAll("nav.mk-sortrow a[data-nav]").map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["/app/queue/added", "/app/queue/due", "/app/queue/kind"]);
  // A sort is a route: following it keeps the browser's history and re-reads in that sort.
  await d.click(main(d).querySelector('a[href="/app/queue/due"]'));
  assert.equal(d.location.pathname, "/app/queue/due");
  assert.deepEqual(mainQueue(d).at(-1).query, { op: "queue", sort: "due" });
});

test("R2: each item drawn by its kind mark (To do, Noticed, Status), grouped by case in the feed's order, with the uncased together", async () => {
  const p = await open("/app/queue", PLANE);
  const marks = main(p).querySelectorAll(".cs-row > .cs-kind").map((e) => e.getAttribute("data-kind"));
  assert.deepEqual(marks, ["todo", "todo", "noticed", "noticed", "todo", "status"]);
  const heads = main(p).querySelectorAll("section.mk-sec > h2").map((h) => h.textContent);
  assert.deepEqual(heads, ["Pothole repairs", "The Coliseum lease", word("screen.queue.nocase")]);
  assert.ok(text(p).includes(`${word("screen.queue.count.many", { n: "8" })} · ${word("screen.queue.grouped")}`));
  assert.ok(text(p).includes(word("screen.queue.more", { n: "2" })));
  const one = await open("/app/queue", { queue: ok({ items: ITEMS, item_count: 7, truncated: true }) });
  assert.ok(text(one).includes(word("screen.queue.more.one")), "R25: one more, the singular key");
});

test("R2, R25: an item's summary and detail are its queue.<kind> words where keyed, filled, else its own summary and detail; the count picks its singular or plural key", async () => {
  const p = await open("/app/queue", PLANE);
  assert.ok(text(p).includes(word("queue.step-date-due.summary", { step: "Ask the clerk", date: "3 October" })));
  assert.ok(text(p).includes(word("queue.step-date-due.detail", { step: "Ask the clerk", date: "3 October" })));
  assert.doesNotMatch(text(p), /raw summary/);
  assert.ok(text(p).includes("Ana asked you to check a calculation") && text(p).includes("812 of 903 reports"), "an unkeyed item draws the producer's own words");
  const cost = await open("/app/queue", { queue: ok({ items: [{ id: "N1", class: "FINDING", kind: "step-cost-shared", fills: { step: "s", totals: "$4", projects: "A, B" }, case: { ungrouped: true }, options: [] }] }) });
  assert.ok(text(cost).includes(word("queue.step-cost-shared.detail", { totals: "$4", projects: "A, B" })));
  const one = await open("/app/queue", { queue: ok({ items: [ITEMS[0]], item_count: 1 }) });
  assert.ok(text(one).includes(word("screen.queue.count.one")), "one item: the singular key");
});

test("R2, R31: due dates drawn with mark.due (a passed date with its date and no word, near, later), and a hint with mark.hint opening in place with what, how, the false-alarm rate and what it is not", async () => {
  const p = await open("/app/queue", PLANE);
  const dues = main(p).querySelectorAll(".cs-due").map((e) => e.getAttribute("data-due") || "");
  assert.deepEqual(dues, ["", "near"]);
  assert.ok(text(p, main(p).querySelectorAll(".cs-due")[0]).includes(dmy(day(-1))), "a passed date is drawn with its date");
  const later = await open("/app/queue", { queue: ok({ items: [{ ...ITEMS[0], due: day(30) }] }) });
  assert.ok(!main(later).querySelector(".cs-due").getAttribute("data-due"));
  const hint = main(p).querySelector("details.mk-hintd");
  assert.ok(hint.querySelector(".cs-hint"));
  const said = text(p, hint);
  for (const k of ["screen.queue.hint.how", "screen.queue.hint.matched"]) assert.ok(said.includes(word(k)), k);
  assert.ok(said.includes("Form 700 against votes") && said.includes("the check matched names"));
  assert.ok(said.includes(word("screen.queue.hint.rate", { rate: "12", false: "3", looked: "25", reason: "a name shared by two people" })) && said.includes(word("screen.queue.hint.not")) && said.includes(word("screen.queue.hint.not.text")));
  const norate = await open("/app/queue", { queue: ok({ items: [{ ...ITEMS[1], hint: { matched: "m" } }] }) });
  assert.ok(text(norate).includes(word("screen.queue.hint.rate.none")));
  const bare = await open("/app/queue", { queue: ok({ items: [{ ...ITEMS[1], hint: { matched: "m", false_alarm_rate: 0.2 } }] }) });
  assert.doesNotMatch(text(bare), /\{\w+\}/, "control: a rate without the counts the word names is not drawn with its placeholders showing");
});

test("R2, R31: due dates are judged on the page's clock (cs.now(), K3002)", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [{ ...ITEMS[0], due: day(1) }] }) });
  assert.equal(main(p).querySelector(".cs-due").getAttribute("data-due"), "near");
  await p.clock.tickActive(3 * 86400000); // an own device idle 30 minutes locks (interface-shell R33): the member keeps acting
  await p.click(main(p).querySelector('a[href="/app/queue/due"]'));
  assert.ok(!main(p).querySelector(".cs-due").getAttribute("data-due"), "passed: no longer near, and no word of overdue");
  assert.doesNotMatch(text(p), /overdue/i);
});

test("R2: the three-kinds note is shown once per member on the device", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const first = await open("/app/queue", PLANE);
    assert.ok(text(first).includes(word("screen.queue.note")) && text(first).includes(word("screen.queue.note.once")));
    await press(first, "taskresolve");
    assert.ok(text(first).includes(word("screen.queue.note")), "kept through the screen's redraws and re-reads while the member is here");
    assert.ok(!text(await open("/app/queue", PLANE)).includes(word("screen.queue.note")), "not again for the same member");
    globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() {} };
    assert.ok(!text(await open("/app/queue", PLANE)).includes(word("screen.queue.note")), "a device that cannot keep it does not repeat it on every draw");
  } finally { delete globalThis.localStorage; }
});

test("R3: an item's acts are its options and disposition's doors among the registered acts; any other option is \"Open\", a link to its subject's screen", async () => {
  const p = await open("/app/queue", PLANE, { screens: withScreens("document") });
  assert.deepEqual(opsOf(itemOf(p, "TSK-1")), ["taskresolve"]);
  assert.deepEqual(opsOf(itemOf(p, "FINDING::tension::PROJ-2::x")), ["proposedispose", "proposedispose", "queuemute"], "R68: Dismiss, then Defer");
  assert.deepEqual(opsOf(itemOf(p, "FINDING::newer::1")), ["adoptversion", "keepversion", "queuemute"]);
  assert.deepEqual(opsOf(itemOf(p, "OBLIGATION::action-reminder::ACT-1::0::d")), ["reminderanswer"]);
  assert.deepEqual(opsOf(itemOf(p, "OBLIGATION::explore-ask::x")), ["exploreapprove"]);
  assert.deepEqual(opsOf(itemOf(p, "CONDITION::q")), ["queuemute"]);
  assert.deepEqual(acts(p).filter(([op]) => op === "queuesnooze").map(([, d]) => d.project), ["PROJ-1", "PROJ-2"], "snooze is by case, on each case's heading");
  const open1 = itemOf(p, "TSK-1").querySelector('a.cs-btn[data-nav][href="/app/document/INF-7"]');
  assert.equal(open1.textContent, word("screen.queue.open"));
  assert.ok(!main(p).querySelector('a[href^="/app/step/"]'), "a subject with no built screen has no link");
  assert.ok(button(p, "taskresolve").textContent.startsWith(word("act.taskresolve.label.queue")));
  // Each act drawn only where the gate allows it (interface-shell R12): without `contribute`, the dispositions needing it go.
  const plain = await open("/app/queue", { ...PLANE, whoami: ok({ tokenClass: "member", session: true, member: "mai", handle: "mai", capabilities: [] }) });
  assert.ok(!ops(plain).includes("proposedispose") && !ops(plain).includes("adoptversion"));
  assert.ok(ops(plain).includes("queuemute"));
});

test("R3: each act sends its op's body for the item it was drawn on; an act asking the member's words draws its fields in place", async () => {
  const p = await open("/app/queue", PLANE);
  await press(p, "taskresolve");
  assert.deepEqual(last(p, "taskresolve").body, { id: "TSK-1" });
  const fwd = button(p, "taskforward");
  assert.equal(fwd, null, "forwarding is not this item's option");
  // R18: "Mute a kind" mutes the item's kind for its nearest home case.
  await press(p, "queuemute", { nth: 1 });
  assert.deepEqual(last(p, "queuemute").body, { case: "PROJ-2", kinds: ["newer-capture-affects-reference"] });
  await press(p, "proposedispose", { reason: "Not relevant to us" });
  assert.deepEqual(last(p, "proposedispose").body, { project: "PROJ-2", finding: "FINDING::tension::PROJ-2::x", to: "dismissed", reason: "Not relevant to us" });
  const snooze = button(p, "queuesnooze");
  const f = snooze.dataset.f;
  assert.equal(snooze.closest("details").querySelector("summary").textContent, word("act.queuesnooze.label.queue"));
  await press(p, "queuesnooze", { values: { [f + "-until"]: day(3) } });
  assert.deepEqual(last(p, "queuesnooze").body, { case: "PROJ-1", until: day(3) });
  const keep = await press(p, "keepversion");
  assert.deepEqual(last(p, "keepversion").body, { notice: "VN-5" });
  const adopt = button(p, "adoptversion");
  const b = await press(p, "adoptversion");
  assert.equal(p.byOp("adoptversion").length, 0, "control: adopting asks why (reevaluation R15)");
  assert.equal(beside(p, b), word("screen.queue.fieldfirst"));
  await press(p, "adoptversion", { values: { [adopt.dataset.f + "-why"]: " It corrects the date " } });
  assert.deepEqual(last(p, "adoptversion").body, { notice: "VN-5", why: "It corrects the date" }, "the member's why is the act's reason, no second one asked (interface-shell R11)");
  const rem = button(p, "reminderanswer");
  await press(p, "reminderanswer");
  assert.deepEqual(last(p, "reminderanswer").body, { target: "ACT-1", entry: 0 });
  await press(p, "reminderanswer", { values: { [rem.dataset.f + "-on"]: "2026-10-25" } });
  assert.deepEqual(last(p, "reminderanswer").body, { target: "ACT-1", entry: 0, on: "2026-10-25" });
  await press(p, "exploreapprove");
  assert.deepEqual(last(p, "exploreapprove").body, { owner: "project:PROJ-1", day: "2026-10-12" });
  assert.ok(keep);
});

test("R3, F2: forwarding and a question from a hint, each with its own field, and nothing sent without it; a retired project key option is drawn as Open, never its act", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  await todo(w, rosa, mai, p1, "Forward");
  await todo(w, rosa, mai, p1, "Keys");
  const real = await itemsOf(mai);
  const [fwdItem, keyItem] = [todoOf(real, "Forward"), todoOf(real, "Keys")];
  // The store's check to-do offers none of these three acts (taskforward and promote are doors of a set act or a wizard, a project key the owner's): the two real to-dos
  // are shown with the options the page draws these fields by.
  await mai.act("reauth", { body: { password: mai.password } });   // as before T53, when the item also offered a project key (now retired, F2)
  const offered = (items) => items.map((i) => (i.id === fwdItem.id ? { ...i, options: [{ id: "taskforward" }], disposition: {} } : i.id === keyItem.id ? { ...i, options: [{ id: "projectkeyset" }, { id: "promote" }], disposition: {} } : i));
  const p = await openW(w, mai, "/app/queue", { queue: queueAs(w, mai, offered) });
  const fwd = await press(p, "taskforward");
  assert.equal(p.byOp("taskforward").length, 0);
  assert.equal(beside(p, fwd), word("screen.queue.fieldfirst"));
  await press(p, "taskforward", { values: { [button(p, "taskforward").dataset.f + "-to"]: "@ana" } });
  assert.deepEqual(last(p, "taskforward").body, { id: fwdItem.id, to: "ana" });
  // F2: `projectkeyset` left the door in T53 (op-declarations R41): an item still offering it draws no such act and sends nothing for it (R3: any other option is "Open").
  assert.equal(button(p, "projectkeyset"), null, "the retired act is not drawn");
  assert.equal(p.byOp("projectkeyset").length, 0);
  await press(p, "promote", { values: { [button(p, "promote").dataset.f + "-question"]: "Did the council vote?" } });
  const r = last(p, "promote");
  // R81: the guard (the owner's declaration) takes the package fields only; the project is the file's own line.
  assert.equal(r.query.project, undefined);
  assert.deepEqual(Object.keys(r.body).sort(), ["base", "bundleId", "files", "meta", "snapKey"]);
  assert.match(r.body.bundleId, /^INQ-\d{4}-\d+/, "the id comes from the store (allocid)");
  assert.match(r.body.files[0].text, new RegExp("\\nproject: " + p1 + "\\n"));
  assert.equal(r.body.meta.object_type, "inquiry");
  assert.equal(r.body.meta.title, "Did the council vote?");
  assert.match(r.body.files[0].text, /## Question\n\nDid the council vote\?\n/);
  assert.ok(r.body.files[0].text.includes("Trigger: " + word("file.trigger.queue", { item: keyItem.id }) + "\n"), "the session log's trigger is the keyed word, as text");
  assert.equal(p.location.pathname, "/app/question/" + r.body.bundleId, "the real store took the package and the page went on to the question");
});

test("R2, R3 (interface-shell R10, R13): the queue's four states; a refusal beside its act; an item resolved or muted leaves the list on the re-read", timeout, async () => {
  const empty = await open("/app/queue", { queue: ok({ items: [] }) });
  assert.ok(text(empty).includes(word("screen.queue.empty")));
  const loading = await open("/app/queue", { queue: { pending: true } });
  assert.ok(main(loading).querySelector('[data-state="loading"]'));
  const failed = await open("/app/queue/kind", { queue: (req) => (req.query.sort ? refused("QUEUE_SORT_UNKNOWN", "That sort is not one the queue knows.") : ok({ items: [] })) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'));
  assert.ok(!text(failed).includes(word("screen.queue.empty")));
  const { w, rosa, mai, p1 } = await team();
  await todo(w, rosa, mai, p1, "Work orders");
  await todo(w, rosa, mai, p1, "Permits");
  const p = await openW(w, mai, "/app/queue");
  const first = button(p, "taskresolve").dataset.item;
  assert.ok(itemOf(p, first));
  await press(p, "taskresolve");
  assert.equal(itemOf(p, first), undefined, "re-read after the act: the resolved item is gone");
  assert.ok((await itemsOf(mai)).every((i) => i.id !== first), "the real to-do is resolved");
  const r = await open("/app/queue", { ...PLANE, taskresolve: refused("TASK_NOT_YOURS", "This task is not yours to resolve.") });
  const b = await press(r, "taskresolve");
  assert.match(beside(r, b), /not yours|TASK_NOT_YOURS/);
  assert.ok(itemOf(r, "TSK-1"), "nothing on the screen changes but the refusal");
});

test("R41 (U8b; DEC-292 D13): with nothing waiting the queue draws the sentence only: no kinds legend, no sort controls, no way-home button", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [] }) });
  assert.ok(text(p).includes(word("screen.queue.empty")));
  assert.ok(!main(p).querySelector("nav.mk-sortrow"), "no sort controls");
  assert.ok(!main(p).querySelector(".mk-note"), "no kinds legend");
  assert.ok(!main(p).querySelector('a[data-nav][href="/app"]'));
  // Control: a queue with items draws the legend and the controls and not the sentence; a failed read says neither.
  const q = await open("/app/queue", PLANE);
  assert.ok(main(q).querySelector("nav.mk-sortrow"));
  assert.ok(!text(q).includes(word("screen.queue.empty")));
  const f = await open("/app/queue", { queue: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(!text(f).includes(word("screen.queue.empty")));
});

// The unsent request (action-producers R25): its subject the action, homed under its project.
const UNSENT = { id: "CONDITION::request-unsent::FIL-3", class: "CONDITION", kind: "request-unsent", case: PROJ("PROJ-1", "Pothole repairs"),
  subject: { kind: "action", id: "ACT-9" }, summary: "You left a records request unsent", options: [], disposition: { available: false, instead: "queuemute" } };

test("R13 (DEC-212): the unsent-request item draws \"Pick up where you left off\", \"Keep it for later\" and \"Drop the request, with a reason\"", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [UNSENT, ITEMS[0]] }) });
  const row = itemOf(p, "CONDITION::request-unsent::FIL-3");
  assert.deepEqual(opsOf(row), ["queuesnooze", "actionmove"], "its own acts only: no mute, no other door");
  const pick = row.querySelector('a[data-nav][href="/app/request/ACT-9"]'); // the request screen, at its step (K3145)
  assert.equal(pick.textContent, word("screen.queue.unsent.pickup"));
  assert.equal(row.querySelector('button[data-act="queuesnooze"]').closest("details").querySelector("summary").textContent, word("screen.queue.unsent.keep"));
  assert.ok(row.querySelector('button[data-act="actionmove"]').textContent.startsWith(word("screen.queue.unsent.drop")));
  assert.ok(row.querySelector('button[data-act="actionmove"]').getAttribute("data-tip").includes(String(word("act.actionmove.here.queue")).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;")), "the drop explains itself by its queue word (R54)");
  // Control: actionmove is drawn on no other item.
  assert.equal(itemOf(p, "TSK-1").querySelectorAll('button[data-act="actionmove"]').length, 0);
  const other = await open("/app/queue", { queue: ok({ items: [{ ...ITEMS[0], options: [{ id: "actionmove" }] }] }) });
  assert.ok(!ops(other).includes("actionmove"), "an item offering actionmove among its options does not draw it");
});

test("R13: \"Drop the request\" sends actionmove to abandoned with the member's reason; \"Keep it for later\" snoozes its case to the chosen day", timeout, async () => {
  const { w, rosa, p1 } = await team();
  const [a, b] = [await unsent(w, rosa, p1, "Demand to rescind"), await unsent(w, rosa, p1, "Request the logs")];
  const real = await itemsOf(rosa);
  const unsentOf = (x) => real.find((i) => i.kind === "request-unsent" && i.subject.id === x.action);
  assert.ok(unsentOf(a) && unsentOf(b), "the real queue holds both unsent requests");
  const p = await openW(w, rosa, "/app/queue");
  const snooze = button(p, "queuesnooze");
  const bt = await press(p, "queuesnooze");
  assert.equal(p.byOp("queuesnooze").length, 0, "control: no day, nothing sent");
  assert.equal(beside(p, bt), word("screen.queue.fieldfirst"));
  // The first drawn request is dropped (the snooze below holds the case's other one back, so it comes after).
  const dropped = button(p, "actionmove").dataset.item;
  const gone = real.find((i) => i.id === dropped);
  await press(p, "actionmove", { reason: "We found the logs online" });
  assert.deepEqual({ ...last(p, "actionmove").query, op: undefined }, { op: undefined, target: gone.subject.id, to: "abandoned", reason: "We found the logs online" }, "the store reads actionmove's fields from the query");
  assert.ok(!itemOf(p, dropped), "re-read after the act: the dropped request leaves the list");
  assert.ok((await itemsOf(rosa)).every((i) => i.id !== dropped), "the real action is abandoned");
  assert.ok(snooze);
  await press(p, "queuesnooze", { values: { [button(p, "queuesnooze").dataset.f + "-until"]: day(10) } });
  assert.deepEqual(last(p, "queuesnooze").body, { case: p1, until: day(10) });
  const r = await open("/app/queue", { queue: ok({ items: [UNSENT] }), actionmove: refused("ACTION_NOT_FOUND", "No such action.") });
  const c = await press(r, "actionmove", { reason: "x" });
  assert.match(beside(r, c), /No such action|ACTION_NOT_FOUND/);
});

test("R18 (queue R19, R20): \"Mute a kind\" sends the case form {case, kinds}: the item's kind for its nearest home case; an item with no case offers the item mute", timeout, async () => {
  const { w, rosa, p1, p2 } = await team();
  // A finding of the second project (a question of the first, concluded, and drawn into the second), and an item in no case (a capture finished with nobody waiting).
  const doc = await w.recipes.page(rosa, "Source", { project: p1 });
  const q = await w.recipes.question(rosa, p1, { title: "Which streets?", text: "Which streets are worst?", legs: [{ target: doc.bundle, role: "supports" }], draw: true });
  await rosa.act("drawquestion", { query: { project: p2, inquiry: q.id, note: "" } });
  await rosa.act("conclude", { query: { target: q.id, project: p1, reading: "The worst streets are named on the record.", falsifier: "The record shows otherwise." } });
  const address = "https://records.example.org/minutes-mute.html";
  w.script(address, async () => new Response("<html><head><title>Minutes</title></head><body><p>The council met.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
  const asked = await w.recipes.question(rosa, p1, { title: "Asked", text: "What did the council decide?" });
  await rosa.act("capturerequest", { body: { address, target: asked.id } });
  await w.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: w.env.DAEMON_TOKEN });
  await w.tick(120_000);
  const real = await itemsOf(rosa);
  const finding = real.find((i) => i.kind === "shared-inquiry-concluded-by-another-project"), quiet = real.find((i) => i.kind === "capture-completed-unattended");
  assert.ok(finding && quiet && quiet.case.ungrouped === true, "the real queue holds a finding and an item in no case");
  // The store homes this finding under its project; the page's rule reads the ancestor of least depth, so the finding is shown under the question inside the project
  // (the question the finding is about), as a finding of a case nested in a project is.
  const project = finding.case.ancestors.find((a) => a.type === "project");
  const nested = { ...finding, case: { ...finding.case, ancestors: [{ id: q.id, type: "inquiry", title: "Which streets?", depth: 1 }, { ...project, depth: 2 }] } };
  const p = await openW(w, rosa, "/app/queue", { queue: queueAs(w, rosa, () => [nested, quiet]) });
  await press(p, "queuemute");
  assert.deepEqual(last(p, "queuemute").body, { case: q.id, kinds: [finding.kind] }, "the nearest home case, a question");
  await press(p, "queuemute", { nth: 1 });
  assert.deepEqual(last(p, "queuemute").body, { item: quiet.id }, "no case: the item");
});

test("R18: control: a to-do offers no mute (queue R31)", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [ITEMS[0]] }) });
  assert.equal(button(p, "queuemute"), null);
});

const UPDATE = (security) => ({ id: "OBLIGATION::update-ready::0.84.0", class: "OBLIGATION", kind: "update-ready", assignee_role: "admin", case: { ungrouped: true, ancestors: [] },
  detail: { version: "0.84.0", date: "2026-10-13", security }, options: [{ id: "updatelater" }], disposition: {} });

test("R19 (DEC-226 (1)): the update to-do is drawn under its own section with its release and date, \"See what changes\" and Not now; the security mark when marked", timeout, async () => {
  // An administrator's act (instance-setup R90): drawn to an administrator's session. The release is a stored, verified notice newer than the running version
  // (R88's row: its signature is a release key's, which no act of the world holds), and the to-do, the section and the act are the real store's.
  const { w } = await team({ VERSION: "0.80.0" });
  const rosa = await w.signIn("founder");   // the team's founding administrator: the instance setup's administrator
  w.ctx.storage.sql.exec(`INSERT INTO release_notices (version, date, manifest, security, notes, sig, found_at) VALUES ('0.84.0', '2026-10-13', '{}', 1, '{}', 'sig', '2026-10-12T00:00:00Z')`);
  assert.ok((await itemsOf(rosa)).some((i) => i.kind === "update-ready"), "the real queue holds the update to-do");
  const p = await openW(w, rosa, "/app/queue");
  const sec = main(p).querySelectorAll("section").find((x) => x.querySelector("h2").textContent === word("queue.update.section"));
  assert.ok(sec, "its section");
  assert.ok(sec.querySelector("h2").getAttribute("data-tip").length > 10, "explained by queue.update.section_says");
  assert.ok(text(p, sec).includes(word("updates.ready.security")) && text(p, sec).includes(word("queue.update.ready", { version: "0.84.0", date: dmy("2026-10-13") })));
  assert.ok(sec.querySelector(".mk-tag").getAttribute("data-tip").length > 10, "explained by updates.ready.security_says");
  assert.equal(sec.querySelector('a[href="/app/updates"]').textContent, word("queue.update.see"));
  assert.ok(button(p, "updatelater").textContent.startsWith(word("act.owed_updatelater.label.queue")));
  await press(p, "updatelater", { reason: "Later this week" });
  assert.deepEqual(last(p, "updatelater").body.version, "0.84.0");
  assert.ok(p.byOp("queue").length >= 2, "re-read: when one administrator acts, it leaves on the next read");
  assert.ok(!(await itemsOf(rosa)).some((i) => i.kind === "update-ready"), "the real to-do has left");
  const plain = await open("/app/queue", { queue: ok({ items: [UPDATE(false)] }) });
  assert.ok(!text(plain).includes(word("updates.ready.security")));
  assert.ok(text(plain).includes(word("queue.update.ready", { version: "0.84.0", date: dmy("2026-10-13") })));
});

test("R19: on Home's \"Needs you\" the update is drawn as home.update.ready, with and without the security mark; control: a member who is not an administrator is answered no such item and none is drawn", async () => {
  const mine = (security) => ({ ...UPDATE(security), assignee: "mai" });
  const p = await open("/app", { queue: ok({ items: [mine(true)] }), lookedsince: ok({ since: "2026-10-01T00:00:00Z" }) });
  assert.ok(inOrderText(p, [word("screen.home.needsyou"), word("home.update.ready", { version: "0.84.0", security: word("home.update.security") })]));
  const plain = await open("/app", { queue: ok({ items: [mine(false)] }), lookedsince: ok({ since: "2026-10-01T00:00:00Z" }) });
  assert.ok(text(plain).includes(word("home.update.ready", { version: "0.84.0", security: "" }) + word("queue.update.see")));
  const none = await open("/app", { queue: ok({ items: [] }), lookedsince: ok({ since: "2026-10-01T00:00:00Z" }) });
  assert.ok(!text(none).includes(word("home.update.ready", { version: "0.84.0", security: "" }).slice(0, 20)));
  assert.ok(!text(await open("/app/queue", { queue: ok({ items: [] }) })).includes(word("queue.update.section")), "no section with no item");
});
const inOrderText = (p, parts) => { const t = text(p); let at = 0; for (const x of parts) { const i = t.indexOf(x, at); if (i < 0) return false; at = i + x.length; } return true; };

const SOURCE = (i, kind = "source-modified", title = `Doc ${i}`) => ({ id: `FINDING::${kind}::B-${i}`, class: "FINDING", kind, title,
  summary: `B-${i} changed at its source (HTTP 404, a monitoring check)`, detail: "raw", subject: { kind: "bundle", id: `INF-${i}` },
  case: { ungrouped: true, ancestors: [] }, options: [], disposition: { available: true, op: "proposedispose", finding: `FINDING::${kind}::B-${i}`, projects: ["PROJ-1"] } });

test("R22: five source-modified items draw one item reading \"5 documents changed at their source\", with the keyed detail, opening the list of its documents, each a reference with its own options", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [1, 2, 3, 4].map((i) => SOURCE(i)).concat([SOURCE(5, "source-modified", null)]) }) });
  const rows = main(p).querySelectorAll("section .cs-row");
  assert.equal(rows.length, 1, "one item");
  assert.ok(text(p, rows[0]).includes(word("queue.source-modified.many", { n: "5" })));
  assert.ok(text(p, rows[0]).includes(word("queue.source.detail")));
  assert.doesNotMatch(text(p), /B-\d|HTTP|404|monitoring/, "never the producer's English");
  const list = rows[0].querySelector('details[data-sources="source-modified"]');
  assert.ok(list);
  assert.deepEqual(list.querySelectorAll("li").map((li) => li.querySelector(".cs-card, a.cs-ref").textContent.trim()), ["Doc 1", "Doc 2", "Doc 3", "Doc 4", UNTITLED]);
  assert.equal(list.querySelectorAll('button[data-act="proposedispose"][data-to="dismissed"]').length, 5, "each document with its own options (R68: and its Defer)");
  assert.equal(list.querySelectorAll('button[data-act="proposedispose"][data-to="dismissed"]')[4].dataset.finding, "FINDING::source-modified::B-5");
});

test("R22: control: a single item draws .one; source-removed is its own item; on Home the same items are one item too", async () => {
  const p = await open("/app/queue", { queue: ok({ items: [SOURCE(1), SOURCE(2, "source-removed"), SOURCE(3, "source-removed")] }) });
  assert.ok(text(p).includes(word("queue.source-modified.one")));
  assert.ok(text(p).includes(word("queue.source-removed.many", { n: "2" })));
  assert.equal(main(p).querySelectorAll("section .cs-row").length, 2);
  const h = await open("/app", { queue: ok({ items: [1, 2, 3, 4, 5].map((i) => SOURCE(i)) }), lookedsince: ok({ since: "2026-10-01T00:00:00Z" }) });
  assert.ok(inOrderText(h, [word("screen.home.needsgroup"), word("queue.source-modified.many", { n: "5" })]));
  assert.equal(main(h).querySelectorAll("section .cs-row").length, 1);
});

test("R28: a to-do names its subject by its title, a reference, and its act by the act's label; never a bare address", async () => {
  const items = [{ id: "TSK-8", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-1", "Pothole repairs"), summary: "https://example.org/permit.pdf",
    subject: { kind: "bundle", id: "INF-7", title: "Permit application" }, options: [], disposition: { instead: "taskresolve" } },
  { id: "TSK-9", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-1", "Pothole repairs"), summary: "https://example.org/other.pdf",
    subject: { kind: "bundle", id: "INF-9" }, age: { since: "2026-10-03T00:00:00Z" }, options: [], disposition: { instead: "taskresolve" } },
  { id: "TSK-10", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-1", "Pothole repairs"), summary: "Check this one",
    subject: { kind: "bundle", id: "INF-10" }, age: { since: "2026-10-03T00:00:00Z" }, options: [], disposition: { instead: "taskresolve" } }];
  const p = await open("/app/queue", { queue: ok({ items, item_count: 3 }) }, { screens: withScreens("document") });
  const [titled, bare, plain] = main(p).querySelectorAll("section .cs-row");
  assert.equal(titled.querySelector('a.cs-ref[href="/app/document/INF-7"]').textContent, "Permit application");
  assert.ok(titled.querySelector('button[data-act="taskresolve"]').textContent.startsWith(word("act.taskresolve.label.queue")));
  assert.doesNotMatch(text(p), /https?:/);
  // C25 (K4437): a subject with no title whose words are the address it came from is named by the one rule: its host and the day, never the file part.
  assert.equal(bare.querySelector("a.cs-ref").textContent, word("document.untitled.web", { site: "example.org", date: dmy("2026-10-03") }), "no title: the host and the day");
  assert.equal(plain.querySelector("a.cs-ref").textContent, word("queue.source.untitled", { date: dmy("2026-10-03") }), "control: a subject with no title and no address draws the untitled word");
});

test("R31: a reply owed by another side whose date has passed is \"no reply recorded\" in a row, never \"overdue\"", async () => {
  const item = { id: "CONDITION::c", class: "CONDITION", kind: "action-clock-overdue.theirs", case: PROJ("PROJ-1", "Pothole repairs"), due: "2026-10-02",
    fills: { office: "Public Works", what: "send the records", date: "2026-10-02" }, subject: { kind: "action", id: "ACT-5" }, options: [], disposition: {} };
  const p = await open("/app/queue", { queue: ok({ items: [item] }) });
  assert.ok(text(p).includes(word("action.noreply.title", { date: dmy("2026-10-02") })));
  assert.ok(text(p).includes(word("queue.action-clock-overdue.theirs.detail", { office: "Public Works", what: "send the records", date: dmy("2026-10-02") })));
  assert.doesNotMatch(text(p), /overdue/i, "control: no drawn text contains it");
  const ours = await open("/app/queue", { queue: ok({ items: [{ ...item, kind: "action-clock-overdue.ours" }] }) });
  assert.ok(!text(ours).includes(word("action.noreply.title", { date: dmy("2026-10-02") })), "control: the group's own passed date is not a reply owed");
});

test("R34: every key the queue reads is a word of the list; the retired overdue row is not read", () => {
  for (const k of screen("queue").words) assert.ok(hasWord(k), k);
  assert.ok(!screen("queue").words.includes("screen.queue.due.overdue"), "DEC-256's retired row");
  for (const k of ["queue.update.section", "action.noreply.title", "file.trigger.queue"]) assert.ok(screen("queue").words.includes(k), k);
});

// R71, R73, R74: where an item opens. A subject with a screen opens it; a settling kind opens the screen that settles it; the rest draw no Open.
const opensOf = async (item, o = {}) => {
  const p = await open("/app/queue", { queue: ok({ items: [{ id: "X-1", class: "OBLIGATION", case: { ungrouped: true, ancestors: [] }, options: [{ id: "somethingelse" }], disposition: { available: false, instead: "taskresolve" }, summary: "A sentence of its own", ...item }], item_count: 1 }) }, { screens: withScreens("matter", "account", "bias", "contradiction", "document"), ...o });
  const row = main(p).querySelectorAll(".cs-row").find((r) => text(p, r).includes("A sentence of its own"));
  return row.querySelectorAll("a[data-nav]").filter((a) => a.textContent === word("screen.queue.open")).map((a) => a.getAttribute("href"));
};

test("R71: an item whose subject kind has a screen opens it (escalation its matter, key the account); one whose subject opens nothing draws no Open", async () => {
  assert.deepEqual(await opensOf({ kind: "escalation-stage-proposed", subject: { kind: "escalation", id: "ESC-1" } }), ["/app/matter/ESC-1"]);
  assert.deepEqual(await opensOf({ kind: "signer-self-registered", subject: { kind: "key", id: "mai" } }), ["/app/account/mai"]);
  assert.deepEqual(await opensOf({ kind: "request-awaiting", subject: { kind: "capture_request", id: "CR-1" } }), [], "a subject that opens nothing draws no Open");
  // Control: a document subject still opens `document`.
  assert.deepEqual(await opensOf({ kind: "check", subject: { kind: "bundle", id: "INF-7" } }), ["/app/document/INF-7"]);
});

test("R73: a bias-debt item's Open opens `bias` at that debt; an item of another kind is unchanged", async () => {
  assert.deepEqual(await opensOf({ kind: "bias-debt", subject: { kind: "run", id: "RUN-4", context: { type: "project", id: "PROJ-1" } } }), ["/app/bias/RUN-4"]);
  assert.deepEqual(await opensOf({ kind: "check", subject: { kind: "bundle", id: "INF-7" } }), ["/app/document/INF-7"]);
});

test("R74: a tension row opens `contradiction` at its pair; other kinds are unchanged", async () => {
  assert.deepEqual(await opensOf({ class: "FINDING", kind: "tension", subject: { kind: "bundle", id: "INF-8", candidate: "CAND-2" } }), ["/app/contradiction/CAND-2"]);
  assert.deepEqual(await opensOf({ class: "OBLIGATION", kind: "contradiction-duty", subject: { kind: "contradiction_candidate", id: "CAND-3" } }), ["/app/contradiction/CAND-3"]);
  assert.deepEqual(await opensOf({ class: "FINDING", kind: "newer-capture-affects-reference", subject: { kind: "capture", id: "abc123" } }), ["/app/document/abc123"]);
});

test("R74: a conflict the member sees only half of opens `<candidate>/<project>`, the project from `between_projects[0]` (a candidate) or `parties[0]` (a notice), the slash unescaped; control: a whole-seen candidate still opens by its id", async () => {
  assert.deepEqual(await opensOf({ class: "OBLIGATION", kind: "contradiction-duty-unseen", subject: { kind: "contradiction_candidate", id: "CAND-3", between_projects: [{ project: "PROJ-1" }, { project: "PROJ-2" }] } }), ["/app/contradiction/CAND-3/PROJ-1"]);
  assert.deepEqual(await opensOf({ class: "FINDING", kind: "tension", subject: { kind: "contradiction_notice", id: "N-1", candidate: "CAND-2", parties: [{ project: "PROJ-9" }] } }), ["/app/contradiction/CAND-2/PROJ-9"]);
  assert.deepEqual(await opensOf({ class: "OBLIGATION", kind: "contradiction-duty", subject: { kind: "contradiction_candidate", id: "CAND-3" } }), ["/app/contradiction/CAND-3"]);
});

// C73 (fix round 2): the line says how the list is sorted, and the vouch to-dos follow the sort.
const HELD1 = { ok: true, held: [{ bundle_id: "INF-H1", title: "Photo", source: { address: "https://city.example/gate", via: "web" }, collected_since: "2026-10-03T10:00:00Z", actor: "mai" }], state: "held", truncated: false, next: null };
const SORTED = [
  { id: "TSK-A", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-1", "Pothole repairs"), age: { since: "2026-10-05T10:00:00Z" }, due: day(2), summary: "Alpha item", options: [], disposition: { instead: "taskresolve" } },
  { id: "TSK-B", class: "OBLIGATION", kind: "check-requested", case: PROJ("PROJ-2", "The Coliseum lease"), age: { since: "2026-10-01T10:00:00Z" }, summary: "Bravo item", options: [], disposition: { instead: "taskresolve" } },
  { id: "F-C", class: "FINDING", kind: "tension", case: PROJ("PROJ-2", "The Coliseum lease"), age: { since: "2026-09-20T10:00:00Z" }, summary: "Charlie item", options: [], disposition: { available: true, op: "proposedispose", scope: "project", finding: "F-C", projects: ["PROJ-2"] } },
];
const orderOf = (p) => main(p).querySelectorAll(".cs-row").map((r) => text(p, r)).map((t) => (t.includes("Alpha") ? "A" : t.includes("Bravo") ? "B" : t.includes("Charlie") ? "C" : t.includes("Photo") ? "V" : "?")).filter((x) => x !== "?").join("");

test("R2, C73: after a sort the line names the sort and no longer says the list is grouped by case; by case it still says grouped; the vouch to-dos follow the sort", async () => {
  const plane = { queue: ok({ items: SORTED, item_count: 3 }), heldcaptures: ok(HELD1) };
  const grouped = word("screen.queue.grouped");
  for (const s of ["added", "due", "kind"]) {
    const p = await open("/app/queue/" + s, plane);
    const line = text(p, main(p).querySelector("p.mk-sub"));
    assert.ok(line.includes(word("screen.queue.sorted", { sort: word(`screen.queue.sort.${s}`) })), `sorted by ${s}`);
    assert.ok(!line.includes(grouped), `${s}: not grouped by case`);
    assert.ok(line.includes(word("screen.queue.count.many", { n: "4" })), "the vouch to-do is counted");
  }
  const byCase = await open("/app/queue/case", plane);
  assert.ok(text(byCase, main(byCase).querySelector("p.mk-sub")).includes(grouped), "control: by case it is grouped by case");
  const dflt = await open("/app/queue", plane);
  assert.ok(text(dflt, main(dflt).querySelector("p.mk-sub")).includes(grouped), "control: the default is grouped by case");
  assert.equal(orderOf(dflt), "ABCV", "by case: the group of no case is last with the vouch to-do in it");
  assert.equal(orderOf(await open("/app/queue/added", plane)), "AVBC", "by time added, newest first: the to-do arose on 3 October");
  // The list is drawn by case in the order the sort gives the cases; the to-do in no case comes after the items the sort puts before it.
  assert.equal(orderOf(await open("/app/queue/due", plane)), "ABCV", "by time due: after the item with a day due and the to-dos with none");
  assert.equal(orderOf(await open("/app/queue/kind", plane)), "ABCV", "by kind: its group follows the cases the sort reaches first");
});

// C75 (fix round 2): forward to a member is a pick list, and forwarding to oneself is refused in words.
test("R3, C75: forwarding is a choice of the group's members; forwarding to oneself is refused in words and sends nothing; one member sends her handle", timeout, async () => {
  const { w, rosa, mai, p1 } = await team();
  await rosa.act("memberadd", { body: { memberId: "bo", cover: "a member invited and not yet joined" } });
  await todo(w, rosa, mai, p1, "Forward");
  const item = todoOf(await itemsOf(mai), "Forward");
  // The store's check to-do offers no forward option of its own: the real to-do is shown with the option the page draws the choice by.
  const offered = (items) => items.map((i) => (i.id === item.id ? { ...i, options: [{ id: "taskforward" }], disposition: {} } : i));
  const p = await openW(w, mai, "/app/queue", { queue: queueAs(w, mai, offered) });
  const f = button(p, "taskforward").dataset.f;
  const choice = p.doc.getElementById(f + "-to");
  assert.equal(choice.tagName.toLowerCase(), "select", "a choice, not a box to type a handle in");
  const roster = (await mai.read("memberlist")).members;
  const handles = roster.filter((m) => m.status === "active" && m.handle).map((m) => m.handle);
  assert.ok(handles.includes("mai") && handles.includes("ana"), "the real roster holds both");
  assert.ok(roster.some((m) => m.status !== "active"), "control: the roster holds one who is not a choice (invited, not yet a member)");
  const ids = roster.filter((m) => m.status === "active" && m.handle).map((m) => m.member_id);
  assert.deepEqual(choice.querySelectorAll("option").filter((o) => o.getAttribute("value")).map((o) => [o.getAttribute("value"), o.textContent.trim()]), ids.map((id, i) => [id, handles[i]]), "the group's active members who have a handle: each by her member id, named by her handle (A-02)");
  const none = await press(p, "taskforward");
  assert.equal(p.byOp("taskforward").length, 0, "no one chosen, nothing sent");
  assert.equal(beside(p, none), word("screen.queue.fieldfirst"));
  const self = await press(p, "taskforward", { values: { [f + "-to"]: "mai" } });
  assert.equal(p.byOp("taskforward").length, 0, "oneself is refused before anything is sent");
  assert.equal(beside(p, self), word("refusal.ALREADY_THEIRS"));
  await press(p, "taskforward", { values: { [f + "-to"]: "ana" } });
  assert.deepEqual(last(p, "taskforward").body, { id: item.id, to: "ana" }, "control: another member is sent");
  // Control: when the group's members are not answered the handle is typed as before.
  const typed = await openW(w, rosa, "/app/queue", { queue: ok({ items: [{ id: "TSK-2", class: "OBLIGATION", kind: "check", case: PROJ("PROJ-1", "Pothole repairs"), summary: "s", options: [{ id: "taskforward" }] }] }), memberlist: refused("NOT_YET", "No.", 500) });
  assert.equal(typed.doc.getElementById(button(typed, "taskforward").dataset.f + "-to").tagName.toLowerCase(), "input");
});
