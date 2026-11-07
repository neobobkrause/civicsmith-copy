/* T50-21's three requirements at the module's interface: R55 (the muted list, `op=queue` with `muted`), R56 (every item's
   subject names its title) and R57 (the three new kinds, their doors and their fences). The producers are stubbed, so
   every answer here is this module's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { queueOps, queueAnswer } from "../../../src/queue/index.mjs";
import { queueFeedOp } from "../../../src/queue/door.mjs";
import { classOfKind, QUEUE_OBLIGATION_KINDS, QUEUE_FINDING_KINDS, QUEUE_CONDITION_KINDS } from "../../../src/queuestate.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const FACTS = { objective_gap: { bound: 50, truncated: false }, contradiction: { bound: 50, truncated: false }, dispositions: [] };
/** A producer item the mint accepts, filed under `subjects`' homes. */
const stub = (a, it) => ({ summary: "an item", detail: "about it", basis: { source: "stub", detail: "stubbed" },
  age: { state: "determined", since: iso(NOW - 1000), ms: 1000 }, assignee: null, assignee_role: null,
  options: [], case: a.homesOf(it.subjects || []), ...it, subjects: undefined });
const withItems = (items, extra = {}) => world({ producers: { feedItems: (a) => ({ facts: FACTS, items: items.map((it) => stub(a, it)) }) }, ...extra });

function setup() {
  const w = world();
  w.member("alice"); w.member("bob");
  w.bundle("INQ-1", "inquiry", { title: "Is the roof sound?" });
  w.bundle("PRJ-1", "project", { title: "Roof project" });
  w.bundle("PRJ-H", "project", { title: "Hidden project" });
  w.join("PRJ-1", "alice"); w.join("PRJ-H", "bob");
  return w;
}
const asAlice = { member: "alice", viewer: "member:alice" };
const mute = (w, a, who = asAlice) => w.q.queueMute({ ...who, ...a });
const listed = (w, who = asAlice) => w.q.queueFeed({ ...who, muted: true });

test("R55: mute a kind in a case and an item; the list shows both with their instants, newest first; unmuting one removes its row and leaves the other", () => {
  const w = setup();
  assert.equal(mute(w, { case: "INQ-1", kinds: ["render-deferred"], at: iso(NOW + 1000) }).ok, true);
  assert.equal(mute(w, { case: "PRJ-1", kinds: ["source-modified"], at: iso(NOW + 2000) }).ok, true);
  assert.equal(mute(w, { item: "CONDITION::governor-holding-host::h.example", at: iso(NOW + 3000) }).ok, true);
  const l = listed(w);
  assert.deepEqual(Object.keys(l), ["ok", "muted", "count"], "in place of the feed: no items, no blocks");
  assert.deepEqual(l, { ok: true, count: 3, muted: [
    { item: "CONDITION::governor-holding-host::h.example", class: "CONDITION", kind: "governor-holding-host", title: null, at: iso(NOW + 3000) },
    { kind: "source-modified", case: { id: "PRJ-1", title: "Roof project" }, at: iso(NOW + 2000) },
    { kind: "render-deferred", case: { id: "INQ-1", title: "Is the roof sound?" }, at: iso(NOW + 1000) } ] });
  // the row's act is queuemute with unmute (R20): the case form removes the kind's row, the item form the item's
  const r = mute(w, { case: "INQ-1", kinds: ["render-deferred"], unmute: true });
  assert.deepEqual([r.ok, r.removed], [true, ["render-deferred"]]);
  assert.deepEqual(listed(w).muted.map((x) => x.item ?? x.kind), ["CONDITION::governor-holding-host::h.example", "source-modified"]);
  assert.equal(mute(w, { item: "CONDITION::governor-holding-host::h.example", unmute: true }).ok, true);
  assert.deepEqual(listed(w), { ok: true, count: 1, muted: [
    { kind: "source-modified", case: { id: "PRJ-1", title: "Roof project" }, at: iso(NOW + 2000) }] });
  // the same list through the op's route and through the door's decoration
  const op = queueOps(w.q, new URL("http://do/queue?member=alice&viewer=member%3Aalice&muted=true"), null).queue();
  assert.deepEqual(op, listed(w));
  assert.deepEqual(queueAnswer(op, { gate: {} }), { status: 200, result: op }, "no items are added to it");
});

test("R55: a kind muted before its instant was kept answers at null, never back-filled, and follows the dated rows; a kind muted again keeps its first instant", () => {
  const w = setup();
  w.run(`INSERT INTO queue_state (member_id, case_id, muted_kinds, last_seen) VALUES ('alice','INQ-1','render-deferred',?)`, iso(NOW));
  mute(w, { case: "INQ-1", kinds: ["source-removed"], at: iso(NOW + 5000) });
  assert.deepEqual(listed(w).muted.map((x) => [x.kind, x.at]), [["source-removed", iso(NOW + 5000)], ["render-deferred", null]]);
  mute(w, { case: "INQ-1", kinds: ["render-deferred", "source-removed"], at: iso(NOW + 9000) });
  assert.deepEqual(listed(w).muted.map((x) => [x.kind, x.at]), [["source-removed", iso(NOW + 5000)], ["render-deferred", null]],
    "neither the undated kind is dated by a later mute, nor the dated one moved");
  mute(w, { case: "INQ-1", kinds: ["render-deferred"], unmute: true });
  mute(w, { case: "INQ-1", kinds: ["render-deferred"], at: iso(NOW + 9000) });
  assert.deepEqual(listed(w).muted.map((x) => [x.kind, x.at]), [["render-deferred", iso(NOW + 9000)], ["source-removed", iso(NOW + 5000)]],
    "muted afresh after an unmute it is dated by that mute");
  // the instants sort as times, not as text: ".500Z" sorts before "Z" as text and half a second after it as a time
  const t = setup();
  t.run(`INSERT INTO queue_item_mutes (member_id, item_id, item_class, muted_at) VALUES ('alice','FINDING::x::1','FINDING','2026-09-01T00:00:00Z')`);
  t.run(`INSERT INTO queue_item_mutes (member_id, item_id, item_class, muted_at) VALUES ('alice','FINDING::x::2','FINDING','2026-09-01T00:00:00.500Z')`);
  assert.deepEqual(listed(t).muted.map((x) => x.item), ["FINDING::x::2", "FINDING::x::1"]);
});

test("R55 (control): another member's mutes are not listed; a member with none, and a caller with no member, get muted: []; a case the viewer cannot see names nothing", () => {
  const w = setup();
  mute(w, { case: "INQ-1", kinds: ["render-deferred"], at: iso(NOW) });
  mute(w, { item: "CONDITION::governor-holding-host::h.example", at: iso(NOW) });
  const bob = { member: "bob", viewer: "member:bob" };
  assert.deepEqual(listed(w, bob), { ok: true, muted: [], count: 0 });
  mute(w, { case: "PRJ-H", kinds: ["source-modified"], at: iso(NOW + 1) }, bob);
  assert.deepEqual(listed(w, bob).muted.map((x) => x.kind), ["source-modified"]);
  assert.equal(listed(w).muted.length, 2, "bob's two writes added nothing to alice's list");
  assert.deepEqual(w.q.queueFeed({ viewer: "class:admin", muted: true }), { ok: true, muted: [], count: 0 }, "a machine credential has no member");
  // a mute row of alice on a case she may not see names neither the case nor a count
  w.run(`INSERT INTO queue_state (member_id, case_id, muted_kinds, muted_at) VALUES ('alice','PRJ-H','render-deferred',NULL)`);
  const l = listed(w);
  assert.equal(l.count, 2); assert.ok(!JSON.stringify(l).includes("PRJ-H") && !JSON.stringify(l).includes("Hidden project"));
  // the muted list asks nothing of the feed: a bad sort is not read, and the ordinary feed has no `muted` block of this shape
  assert.equal(w.q.queueFeed({ ...asAlice, muted: true, sort: "newest" }).ok, true);
  assert.equal(w.q.queueFeed({ ...asAlice, sort: "newest" }).reason, "QUEUE_SORT_UNKNOWN");
  assert.equal(Array.isArray(w.q.queueFeed(asAlice).muted), false);
  assert.equal(w.q.queueFeed({ ...asAlice, muted: false }).ok, true);
});

test("R55: a store made before the instants were kept gains their column; its mutes answer at null and a new mute is dated", () => {
  const w = world({}, { bare: true });
  w.db.exec(`CREATE TABLE queue_state (member_id TEXT NOT NULL, case_id TEXT NOT NULL, muted_kinds TEXT, snoozed_until TEXT,
               last_seen TEXT, PRIMARY KEY (member_id, case_id))`);
  w.boot();
  w.db.exec(`CREATE TABLE IF NOT EXISTS probe (x INTEGER)`);
  assert.ok(w.all(`PRAGMA table_info(queue_state)`).some((c) => c.name === "muted_at"));
  w.q.migrate();   // idempotent
  w.member("alice"); w.bundle("INQ-1", "inquiry");
  w.run(`INSERT INTO queue_state (member_id, case_id, muted_kinds) VALUES ('alice','INQ-1','render-deferred')`);
  mute(w, { case: "INQ-1", kinds: ["source-removed"], at: iso(NOW) });
  assert.deepEqual(listed(w).muted.map((x) => [x.kind, x.at]), [["source-removed", iso(NOW)], ["render-deferred", null]]);
});

test("R55: the door passes `muted` on to the store and answers the list as it is, with no items decorated into it", async () => {
  const asked = [];
  const list = { ok: true, muted: [{ kind: "render-deferred", case: { id: "INQ-1", title: null }, at: null }], count: 1 };
  const helpers = { json: (body, status) => ({ body, status }), doAnswer: async () => ({ answered: true, result: list }),
    storeRefusal: (o) => ({ refusal: o }), storeSilent: (op) => ({ silent: op }), gate: { needs: () => null, mode: () => "session" },
    storeName: "bio", cls: "member", member: "alice", viewer: "member:alice" };
  const store = { fetch: (u) => { asked.push(new URL(u)); return "queue"; } };
  const out = await queueFeedOp(new URL("http://plane/?op=queue&muted=true&sort=kind"), store, helpers);
  assert.equal(out.status, 200);
  assert.deepEqual(out.body.result, list);
  assert.deepEqual(Object.fromEntries(asked[0].searchParams), { viewer: "member:alice", member: "alice", sort: "kind", muted: "true" });
  asked.length = 0;
  await queueFeedOp(new URL("http://plane/?op=queue"), store, helpers);
  assert.equal(asked[0].searchParams.has("muted"), false, "absent when the request sent none");
});

test("R55: every kind a member may mute has the plain name the muted list's sentence reads, queue.kind.<kind>, and a muted row's kind is one of them", () => {
  const mutable = [...Object.keys(QUEUE_CONDITION_KINDS), ...Object.keys(QUEUE_FINDING_KINDS)];
  /* T51 fix round 7 (G61; K4269): the kinds the catalogue gained (nine at G61, `reading-ended` at G135f) name no plain name yet (`fetch-done`, `ingest-done`, `ingest-stopped` have since gained theirs); the rows are owed to UX-DESIGN
     (T52) and the screen draws its own fallback for a kind with none. This list is exactly the kinds without a row: a row
     arriving for one of them makes this assertion fail until the kind leaves the list. */
  /* layer 11 reopen (notice-producers R33-R36): the six kinds catalogued then have no `queue.kind.<kind>` row yet either. */
  const OWED = ["ai-account-left-list", "ai-account-left-project-list", "ai-signin-ended", "ai-terms-notice",
    "ai-threshold-reached", "edition-published-as-scheduled", "edition-scheduled", "mail-cleared",
    "place-profile-arrived", "register-changed-noticed", "register-import-done", "register-import-failed",
    "register-import-stopped", "request-unsent", "scheduled-edition-stopped", "wizard-base-updated"];
  assert.deepEqual(mutable.filter((k) => !hasWord(`queue.kind.${k}`)).sort(), OWED);
  assert.ok(mutable.includes("watched-changed") && hasWord("queue.kind.watched-changed"), "DEC-328 (3)");
  assert.ok(hasWord("queue.muted.title"), "the list's title");
  assert.ok(hasWord("queue.muted.help"), "the list's help");
  assert.ok(hasWord("queue.muted.kind"), "a kind muted in a case");
  assert.ok(hasWord("queue.muted.by"), "when it was muted");
  assert.ok(hasWord("queue.muted.by.undated"), "a mute with no instant");
  assert.ok(hasWord("queue.muted.unmute"), "the unmute act");
  assert.equal(mutable.some((k) => classOfKind(k) === "OBLIGATION"), false, "no row can be an obligation (R31)");
});

test("R56: every item's subject carries title: the bundle's when it names one the viewer may see, else null, never missing", () => {
  const w = withItems([
    { id: "FINDING::source-modified::a", class: "FINDING", kind: "source-modified", subject: { kind: "bundle", id: "DOC-T" }, subjects: ["DOC-T"] },
    { id: "FINDING::source-modified::b", class: "FINDING", kind: "source-modified", subject: { kind: "project", id: "PRJ-1" }, subjects: ["PRJ-1"] },
    { id: "FINDING::source-modified::c", class: "FINDING", kind: "source-modified", subject: { kind: "bundle", id: "DOC-NONE" }, subjects: ["DOC-NONE"] },
    { id: "FINDING::source-modified::d", class: "FINDING", kind: "source-modified", subject: { kind: "bundle", id: "PRJ-H" }, subjects: [] },
    { id: "FINDING::source-modified::e", class: "FINDING", kind: "source-modified", subject: { kind: "contradiction_candidate", id: "CAND-1" }, subjects: [] },
    { id: "FINDING::source-modified::f", class: "FINDING", kind: "source-modified", subject: { kind: "bundle", id: null }, subjects: [] },
    { id: "FINDING::source-modified::g", class: "FINDING", kind: "source-modified", subject: { kind: "bundle", id: "DOC-ABSENT" }, subjects: [] },
  ]);
  w.member("alice"); w.member("bob");
  w.bundle("DOC-T", "information", { title: "The roofing report" });
  w.bundle("DOC-NONE", "information", { title: "" });
  w.bundle("PRJ-1", "project", { title: "Roof project" }); w.bundle("PRJ-H", "project", { title: "Secret roof team" });
  w.join("PRJ-1", "alice"); w.join("PRJ-H", "bob");
  w.bundle("INF-9", "information", { title: "A task's document" }); w.task("TASK-2026-0001-a", "INF-9");
  w.task("TASK-2026-0002-b", "DOC-NONE");
  const f = w.feed("alice");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const it = byId(f);
  const titleOf = (id) => it[id].subject.title;
  assert.equal(titleOf("FINDING::source-modified::a"), "The roofing report");
  assert.equal(titleOf("FINDING::source-modified::b"), "Roof project");
  assert.equal(titleOf("TASK-2026-0001-a"), "A task's document", "a task's item, whose subject is {kind: bundle, id}");
  assert.deepEqual(it["TASK-2026-0001-a"].subject, { kind: "bundle", id: "INF-9", title: "A task's document" });
  // control: no title where there is none to give; the key is present and null
  for (const id of ["FINDING::source-modified::c", "FINDING::source-modified::e", "FINDING::source-modified::f",
                    "FINDING::source-modified::g", "TASK-2026-0002-b"]) {
    assert.ok("title" in it[id].subject, `${id} carries the key`);
    assert.equal(titleOf(id), null, id);
  }
  // control: a bundle the viewer may not see gives none of its title (R33), nor does it appear in the answer
  assert.equal(titleOf("FINDING::source-modified::d"), null);
  assert.ok(!JSON.stringify(f).includes("Secret roof team"));
  // the same item read by a viewer who may see it names the title
  assert.equal(byId(w.feed("bob"))["FINDING::source-modified::d"].subject.title, "Secret roof team");
  // every item of the answer, whatever its class or producer
  for (const i of f.items) assert.ok("title" in i.subject, i.id);
});

const NEW = [
  { id: "OBLIGATION::project-invitation::INV-1", class: "OBLIGATION", kind: "project-invitation", subject: { kind: "invitation", id: "INV-1" } },
  { id: "OBLIGATION::project-request::REQ-1", class: "OBLIGATION", kind: "project-request", subject: { kind: "project_request", id: "REQ-1" } },
  { id: "FINDING::watched-changed::W-1", class: "FINDING", kind: "watched-changed", subject: { kind: "bundle", id: "DOC-1" }, subjects: ["DOC-1"] },
];

test("R57: project-invitation and project-request are OBLIGATIONs and watched-changed a FINDING, each with its one sentence, and each passes the mint", () => {
  assert.deepEqual(["project-invitation", "project-request", "watched-changed"].map(classOfKind), ["OBLIGATION", "OBLIGATION", "FINDING"]);
  for (const [vocab, k] of [[QUEUE_OBLIGATION_KINDS, "project-invitation"], [QUEUE_OBLIGATION_KINDS, "project-request"], [QUEUE_FINDING_KINDS, "watched-changed"]])
    assert.ok(typeof vocab[k] === "string" && vocab[k].length > 20, k);
  assert.match(QUEUE_OBLIGATION_KINDS["project-invitation"], /you are invited to a project; join it or leave it/);
  assert.match(QUEUE_OBLIGATION_KINDS["project-request"], /a member asks to join a project you own; grant or decline/);
  assert.match(QUEUE_FINDING_KINDS["watched-changed"], /something you watch changed/);
  const w = withItems(NEW);
  w.member("alice"); w.bundle("DOC-1");
  const f = w.feed("alice");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  assert.deepEqual(f.items.map((i) => [i.kind, i.class]),
    [["project-invitation", "OBLIGATION"], ["project-request", "OBLIGATION"], ["watched-changed", "FINDING"]]);
  // control: an uncatalogued kind, and near misses of the new names, are still refused whole
  for (const kind of ["project-invitations", "project-requests", "watched-change", "no-such-kind"]) {
    const bad = withItems([{ id: "FINDING::x::1", class: "FINDING", kind }]).feed(null, "class:admin");
    assert.deepEqual([bad.ok, bad.reason], [false, "NO_SUCH_KIND"], kind);
  }
  // control: each minted under the other class is KIND_MISCLASSED
  const mis = (kind, cls) => withItems([{ id: `${cls}::${kind}::1`, class: cls, kind }]).feed(null, "class:admin").reason;
  assert.deepEqual([mis("project-invitation", "FINDING"), mis("project-request", "CONDITION"), mis("watched-changed", "OBLIGATION")],
    ["KIND_MISCLASSED", "KIND_MISCLASSED", "KIND_MISCLASSED"]);
});

test("R57, R12: the doors: project-invitation instead projectjoin, project-request instead projectrequestanswer; watched-changed told to its watcher alone, instead queuemute", () => {
  const w = withItems(NEW);
  w.member("alice"); w.bundle("DOC-1");
  const it = byId(w.feed("alice"));
  const inv = it["OBLIGATION::project-invitation::INV-1"].disposition, req = it["OBLIGATION::project-request::REQ-1"].disposition;
  assert.deepEqual([inv.available, inv.instead, inv.reason], [false, "projectjoin", "an_obligation_is_resolved_not_disposed"]);
  assert.deepEqual([req.available, req.instead, req.reason], [false, "projectrequestanswer", "an_obligation_is_resolved_not_disposed"]);
  assert.match(inv.detail, /op=projectjoin/); assert.match(req.detail, /op=projectrequestanswer/);
  const wc = it["FINDING::watched-changed::W-1"].disposition;
  assert.deepEqual([wc.available, wc.scope, wc.instead, wc.key, wc.op], [false, null, "queuemute", null, null]);
  assert.match(wc.detail, /you alone are told/);
  // watched-changed is homed under a project and still has no team to decide it
  const h = world({ producers: { feedItems: (a) => ({ facts: FACTS, items: [stub(a, { ...NEW[2], subjects: ["DOC-1"] })] }) } });
  h.member("alice"); h.bundle("DOC-1"); h.bundle("PRJ-1", "project"); h.join("PRJ-1", "alice"); h.cite("PRJ-1", "DOC-1");
  const homed = byId(h.feed("alice"))["FINDING::watched-changed::W-1"];
  assert.deepEqual(homed.case.ancestors.map((a) => a.id), ["PRJ-1"]);
  assert.deepEqual([homed.disposition.available, homed.disposition.instead, homed.disposition.scope], [false, "queuemute", null]);
});

test("R57, R19, R31: project-invitation and project-request muted, by kind or by id, are KIND_NOT_PERSONAL and write nothing; a row naming them suppresses nothing; the bridge names their doors", () => {
  const w = withItems(NEW);
  w.member("alice"); w.bundle("DOC-1"); w.bundle("INQ-1", "inquiry");
  for (const kind of ["project-invitation", "project-request"]) {
    const r = mute(w, { case: "INQ-1", kinds: [kind] });
    assert.deepEqual([r.ok, r.reason, r.kind_class, r.check], [false, "KIND_NOT_PERSONAL", "OBLIGATION", "C-33.27"], kind);
    assert.ok(!r.available.includes(kind), "it is not among the kinds a member may mute");
  }
  for (const item of ["OBLIGATION::project-invitation::INV-1", "OBLIGATION::project-request::REQ-1"]) {
    const r = mute(w, { item });
    assert.deepEqual([r.ok, r.reason, r.kind_class], [false, "KIND_NOT_PERSONAL", "OBLIGATION"], item);
  }
  assert.equal(w.all(`SELECT count(*) c FROM queue_state`)[0].c + w.all(`SELECT count(*) c FROM queue_item_mutes`)[0].c, 0);
  // R31: even rows that name them (the write refuses these) suppress neither
  w.run(`INSERT INTO queue_state (member_id, case_id, muted_kinds) VALUES ('alice','INQ-1','project-invitation,project-request')`);
  w.run(`INSERT INTO queue_item_mutes (member_id, item_id, item_class, muted_at) VALUES ('alice','OBLIGATION::project-invitation::INV-1','OBLIGATION','2026-09-01T00:00:00Z')`);
  const f = w.feed("alice");
  assert.deepEqual(f.mute.suppressed, []);
  assert.ok(byId(f)["OBLIGATION::project-invitation::INV-1"] && byId(f)["OBLIGATION::project-request::REQ-1"]);
  // R28: the bridge
  const pd = (key) => w.q.proposeDispose({ key, to: "dismissed", reason: "r", decidedBy: "alice", viewer: "member:alice", identity: "member:alice" });
  for (const [key, door] of [["OBLIGATION::project-invitation::INV-1", "projectjoin"], ["OBLIGATION::project-request::REQ-1", "projectrequestanswer"],
                             ["project-invitation::x", "projectjoin"]]) {
    const r = pd(key);
    assert.deepEqual([r.ok, r.reason, r.class, r.instead], [false, "CLASS_NOT_DISPOSED", "OBLIGATION", door], key);
  }
  const wr = pd("FINDING::watched-changed::W-1");
  assert.deepEqual([wr.ok, wr.reason, wr.kind], [false, "NO_PROJECT_SCOPE", "watched-changed"]);
});

test("R57, R20, R55: watched-changed is mutable, by case and by item, and its row is listed", () => {
  const w = withItems(NEW);
  w.member("alice"); w.bundle("DOC-1"); w.bundle("INQ-1", "inquiry", { title: "Roof question" });
  const byCase = mute(w, { case: "INQ-1", kinds: ["watched-changed"], at: iso(NOW) });
  assert.deepEqual([byCase.ok, byCase.muted_kinds], [true, ["watched-changed"]]);
  const byItem = mute(w, { item: "FINDING::watched-changed::W-1", at: iso(NOW + 1000) });
  assert.deepEqual([byItem.ok, byItem.item_class], [true, "FINDING"]);
  assert.deepEqual(listed(w).muted, [
    { item: "FINDING::watched-changed::W-1", class: "FINDING", kind: "watched-changed", title: "DOC-1", at: iso(NOW + 1000) },
    { kind: "watched-changed", case: { id: "INQ-1", title: "Roof question" }, at: iso(NOW) }]);
  const f = w.feed("alice");
  assert.equal(f.mute.suppressed.length, 1, "the item mute suppresses it, personally");
  assert.equal(f.mute.suppressed[0].scope, "item");
});
