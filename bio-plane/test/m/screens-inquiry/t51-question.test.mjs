/* screens-inquiry T51, the question screen: R71 (a question set aside for the project), R72 (what each published case froze),
 * R73 (compare two readings; where each came from), R74 (the bias a reading was composed under), R70 (no state chip or term the
 * drawing does not draw) and R78 (pages drawn from one), on interface-shell's served page over a scripted plane. Every
 * expectation is a word read by key (R44), a date through the kit's own arithmetic (`day`), never copied. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDeclaredOps as registerOps } from "../../../src/op-declarations/index.mjs";
import { boot, ok, refusedIn, counted } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { emptyFeed } from "../queue/fixtures.mjs";
import { open, storeWorld, WORLD_FOUNDER_HANDLE, main, actsIn, press, fill, plane, inquiryMd, INQUIRY_REFS, DOCUMENT_MD, provenanceOf, SHA, POLICY, LEGS, says, section, lead, word, day, SCREENS, P, Q, D } from "./fixtures.mjs";

/* K4245 (test-support R17): every owner's declarations registered once, before the first read, by the one registrar */

const at = "/app/question/" + Q;
const GROUNDS = [{ ground: "part 1", asserted_by: "member:dev", at: "2026-10-05T09:00:00Z" }];
const grouped = (o = {}) => inquiryMd(P, INQUIRY_REFS, { legs: LEGS.map((l) => (l.target === D ? { ...l, ground: "part 1" } : l)), grounds: GROUNDS, ...o });
const A = { images: { [Q]: { "bundle.md": grouped() } } };
/** the assistant's reads (`assistantstate`, `aipathready`, `agentpack`, `airuns`) as the team's Claude account answers them: a world whose team has set it up and switched it on, and a member
 *  who has read its notice (the world's recipe), the world's door answering each request as she does */
const ASSISTANT = await (async () => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const member = await world.signIn("mai", { capabilities: ["contribute"] });
  await world.recipes.assistant(admin, { readers: [member] });
  return { world, member };
})();
const REACH = Object.fromEntries(["assistantstate", "aipathready", "agentpack", "airuns"].map((op) => [op, counted((req) => {
  const headers = Object.fromEntries(Object.entries({ ...(req.init && req.init.headers), ...req.headers }).filter(([k]) => k.toLowerCase() !== "authorization"));
  return ASSISTANT.world.door({ ...req, headers, init: { ...req.init, headers } }, ASSISTANT.member);
})]));
const reach = (o = {}) => ({ ...o, boot: { plane: { ...plane(o), ...REACH, ...(o.reach || {}) } } });
const choose = async (p, id, value) => { const el = p.doc.getElementById(id); el.value = value; p.fire(el, "change"); await p.settle(); };
const aside = (rows, extra = {}) => (r) => ok(r.query.aside ? { ok: true, aside: rows, count: rows.length, next: null, truncated: false, ...extra } : { items: [] });
const row = (o = {}) => ({ scope: "project", finding: Q, project: P, key: P + "::" + Q, state: "deferred", reason: "waiting for the 2026 log", decided_by: "mai", at: "2026-10-18T09:00:00Z", definition_version: null, title: null, ...o });
const OWN = { capabilities: ["contribute", "create_projects"] };
/** A project of `ann`'s (named Pothole repairs) with `n` held documents and a question of hers resting on them, drawn into the project (or into none), by real acts.
 *  Answers `{world, ann, project, targets, id, page(opts, who, path), question(title)}`; `page` boots the question's page over the world's door as `who` (default `ann`). */
const worldOf = async ({ n = 2, filed = true } = {}) => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const targets = [];
  for (let i = 0; i < n; i++) targets.push((await world.recipes.hold(ann, i ? "Passage " + (i + 1) : POLICY, "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const question = async (title = "Seven days", o = {}) => (await world.recipes.question(ann, filed ? project : null, { title, text: "Is the city repairing reported potholes within seven days?", legs: targets.map((target) => ({ target, role: "supports" })), draw: filed, ...o })).id;
  const id = await question();
  const page = async (o = {}, who = ann, path = "/app/question/" + id) => {
    const { door, session } = world.boot(who);
    const p = await boot({ screens: SCREENS, door, session, path, ...o });
    await p.settle();
    return p;
  };
  return { world, ann, project, targets, id, page, question };
};
/** the decisions the project has made about its questions, as the set-aside list gives them */
const decisions = async (w) => (await w.ann.read("queue", { query: { aside: "true", limit: "500" } })).aside;
const asideReads = (p) => p.byOp("queue").filter((r) => r.query.aside);

/* ---------------------------------------------------------------------------------------------------------------------- R71 */

test("R71 the fold sets the question aside for the project: nothing preselected; with no choice or no reason nothing is sent; with both, proposedispose carries the project, the question, the choice and the reason, and the receipt is drawn", async () => {
  const w = await worldOf();
  const P = w.project, Q = w.id;
  const p = await w.page();
  const more = main(p).querySelector('details[data-fold="more"]');
  const fold = more.querySelector('details[data-aside="set"]');
  assert.ok(fold, "in state a, under More you can do");
  assert.ok(says(fold.querySelector("summary"), "screen.question.say058", { project: "Pothole repairs" }));
  for (const k of ["screen.question.say059", "screen.question.say060", "screen.question.say061", "screen.question.say062"]) assert.ok(says(fold, k, { project: "Pothole repairs" }), k);
  assert.ok(says(fold, "screen.question.say063") && says(fold, "screen.question.say004") && says(fold, "screen.question.say005") && says(fold, "screen.question.say064"));
  assert.deepEqual(fold.querySelectorAll('input[type="radio"]').map((i) => i.getAttribute("value")), ["deferred", "dismissed"]);
  assert.ok(fold.querySelectorAll("input").every((i) => !i.checked), "nothing preselected");
  assert.ok(says(fold.querySelector("label[for=question-aside-why]"), "shell.reason"), "the required field Your reason");
  assert.equal(fold.querySelector("button[data-act=writinghelp]"), null, "no writing help is offered");
  assert.ok(says(fold.querySelector('details[data-aside="cannot"]'), "screen.question.say073") && says(fold, "screen.question.say074", { project: "Pothole repairs" }) && says(fold, "screen.question.say075"));
  /* with none chosen nothing is sent; with a choice and no reason nothing is sent */
  let slot = await press(p, "proposedispose", { within: fold });
  assert.ok(says(slot, "screen.question.say063"));
  p.doc.getElementById("question-aside-0").checked = true;
  slot = await press(p, "proposedispose", { within: fold });
  assert.ok(says(slot, "screen.question.say075"));
  assert.equal(p.byOp("proposedispose").length, 0);
  /* with both: the project's own act, nothing else */
  fill(p, { "question-aside-why": "waiting for the 2026 log" });
  await press(p, "proposedispose", { within: fold });
  assert.deepEqual(p.byOp("proposedispose")[0].body, { project: P, finding: Q, to: "deferred", reason: "waiting for the 2026 log" });
  /* the receipt, read from the set-aside list; the fold gives way to "Change your decision" */
  const r = main(p).querySelector('[data-aside="deferred"]');
  const first = (await decisions(w))[0];
  assert.ok(r && says(r, "screen.question.say000", { project: "Pothole repairs", date: day(first.at) }));
  assert.ok(r.textContent.includes("waiting for the 2026 log") && says(r, "shell.reason.lead") && says(r, "screen.question.say001", { project: "Pothole repairs" }) && says(r, "screen.question.say002"));
  assert.equal(main(p).querySelector('details[data-aside="set"]'), null);
  /* "Change your decision": the same choice (nothing preselected), a reason that replaces the earlier one */
  const change = r.querySelector('details[data-aside="change"]');
  assert.ok(change.querySelectorAll("input[type=radio]").every((i) => !i.checked) && says(change, "screen.question.say006"));
  assert.ok(says(change.querySelector("summary"), "screen.question.decision.change") && !says(change.querySelector("summary"), "screen.question.say003"), "the fold's summary is its own word, say003 the question inside");
  p.doc.getElementById("question-aside2-1").checked = true;
  fill(p, { "question-aside2-why": "the city retired the standard" });
  await press(p, "proposedispose", { within: change });
  assert.deepEqual(p.byOp("proposedispose")[1].body, { project: P, finding: Q, to: "dismissed", reason: "the city retired the standard" });
  assert.ok(says(main(p).querySelector('[data-aside="dismissed"]'), "screen.question.say008", { project: "Pothole repairs", date: day((await decisions(w))[0].at) }));
  assert.equal((await decisions(w))[0].state, "dismissed", "and the real act changed the decision");
  /* control: no request carries a shared (no-project) dispose */
  for (const q of p.byOp("proposedispose")) assert.ok(q.body.project === P && q.body.finding === Q && !("items" in q.body) && !("progression" in q.body));
});

test("R71 what this touches: the reading the project stands on, its plan, a question that cites it and a published case, each only when it exists and only what she may see; no other project is named", async () => {
  const backs = ok({ ok: true, target: Q, backlinks: [{ from: "INQ-2026-0020-reopen", from_type: "inquiry", from_title: "Reopened within a month?" },
    { from: "CASE-2026-0001", from_type: "published", from_title: "Street safety" }, { from: "PROJ-2026-0042", from_type: "project", from_title: "Elsewhere" }], out_of_view: true });
  const p = await open(at, { ...A, plane: { backlinks: backs, plans: (r) => ok({ ok: true, plans: r.query.subject === Q ? [{ id: "PLAN-1", title: "Repairs plan" }] : [] }) } });
  const t = main(p).querySelector('[data-aside="set"] [data-touches]');
  assert.ok(says(t, "screen.question.say065", { project: "Pothole repairs" }) && says(t, "screen.question.say066"), "the project stands on a reading");
  assert.ok(says(t, "screen.question.say067", { plan: "Repairs plan" }) && says(t, "screen.question.say068"), "its plan");
  assert.ok(says(t, "screen.question.say069") && says(t, "screen.question.say070"), "a question that cites it");
  assert.ok(says(t, "screen.question.say071", { title: "Street safety" }) && says(t, "screen.question.say072"), "a published case");
  assert.ok(says(t, "screen.question.touches.heading"), "headed What this touches, by its key");
  assert.ok(says(t, "screen.question.tip078") && says(t, "screen.question.tip079"), "the note that the list is of what she can see");
  assert.ok(!t.textContent.includes("Elsewhere") && !t.textContent.includes("PROJ-2026-0042"), "no other project is named");
  assert.equal(p.byOp("plans").find((r) => r.query.subject).query.subject, Q);
  /* control: nothing touched, nothing listed */
  const w = await worldOf();
  const n = await w.page();
  assert.equal(main(n).querySelector("[data-touches]"), null);
});

test("R71 the refusals are drawn by their words: not a participant, no reason, a bad reason, not a disposition", async () => {
  for (const code of ["PROJECT_ACT_NOT_A_PARTICIPANT", "NO_REASON", "BAD_REASON", "NOT_A_DISPOSITION"]) {
    const p = await open(at, { ...A, plane: { proposedispose: refusedIn(code) } });
    const fold = main(p).querySelector('details[data-aside="set"]');
    p.doc.getElementById("question-aside-0").checked = true;
    fill(p, { "question-aside-why": "a reason" });
    const slot = await press(p, "proposedispose", { within: fold });
    assert.ok(says(slot, "refusal." + code), code);
    assert.equal(p.byOp("proposedispose").length, 1, "sent once, refused by the plane");
  }
});

test("R71 states k and l: the project's decision is read from the set-aside list, paged by after; the receipt replaces the fold, the question is still drawn whole; another participant's decision is drawn by her name", async () => {
  const w = await worldOf();
  const dev = await w.world.signIn("dev", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "dev" } });
  await dev.act("projectjoin", { query: { projectId: w.project } });
  /* three questions of the project set aside before the one she reads, which another participant then dismisses */
  for (const title of ["Other one", "Other two", "Other three"]) await w.ann.act("proposedispose", { body: { project: w.project, finding: await w.question(title), to: "deferred", reason: "waiting for the 2026 log" } });
  const target = await w.question("Seven days again", { legs: [{ target: w.targets[0], role: "supports" }, { target: w.targets[1], role: "cuts_against" }] });
  await dev.act("proposedispose", { body: { project: w.project, finding: target, to: "dismissed", reason: "retired" } });
  /* the list paged two to a page by its own cursor: the world's door answering the page's read with a smaller limit (the page asks for 500, past what a test holds) */
  const { door } = w.world.boot(w.ann);
  const paged =(req) => door(req.query.aside ? { ...req, url: req.url.replace("limit=500", "limit=2") } : req);
  const p = await w.page({ plane: { queue: counted(paged) } }, w.ann, "/app/question/" + target);
  const first = await w.ann.read("queue", { query: { aside: "true", limit: "2" } });
  assert.deepEqual(asideReads(p).map((r) => r.query.after), [undefined, first.next], "paged by after until found");
  assert.ok(asideReads(p).every((r) => r.query.aside === "true" && r.query.limit === "500"));
  const m = main(p);
  const r = m.querySelector('[data-aside="dismissed"]');
  const theirs = (await decisions(w)).find((d) => d.finding === target);
  assert.ok(says(r, "screen.question.say008.bymember", { project: "Pothole repairs", member: theirs.decided_by, date: day(theirs.at) }));
  assert.ok(!says(r, "screen.question.say001", { project: "Pothole repairs" }), "the 'with your name' line is hers alone");
  assert.ok(says(r, "shell.reason.lead") && r.textContent.includes(theirs.reason), "her reason is led by its key");
  assert.equal(m.querySelector('details[data-aside="set"]'), null, "in states k and l the fold gives way to Change your decision");
  assert.ok(r.querySelector('details[data-aside="change"]'));
  assert.ok(section(p, "screen.question.supports.head") && section(p, "screen.question.against.head"), "drawn whole beneath");
  /* a deferral by her */
  const mine = await w.question("Mine");
  await w.ann.act("proposedispose", { body: { project: w.project, finding: mine, to: "deferred", reason: "waiting for the 2026 log" } });
  const d = await w.page({}, w.ann, "/app/question/" + mine);
  const deferred = (await decisions(w)).find((x) => x.finding === mine);
  assert.ok(says(main(d).querySelector('[data-aside="deferred"]'), "screen.question.say000", { project: "Pothole repairs", date: day(deferred.at) }));
  /* control: the decisions of other questions are not this one's: the fold is drawn */
  const o = await w.page({}, w.ann, "/app/question/" + await w.question("Untouched"));
  assert.ok(main(o).querySelector('details[data-aside="set"]') && !main(o).querySelector("[data-aside=deferred]"));
});

test("R71 controls: a member who is not in the project is drawn no fold and no set-aside read is made; a question in no project is drawn none; a read that fails is drawn failed", async () => {
  const w = await worldOf();
  /* invited to the project, not joined: she sees the question and is no participant */
  const zed = await w.world.signIn("zed", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "zed" } });
  const out = await w.page({}, zed);
  assert.ok(section(out, "screen.question.supports.head"), "she sees the question");
  assert.equal(main(out).querySelector("[data-aside]"), null);
  assert.equal(asideReads(out).length, 0);
  const loose = await worldOf({ filed: false });
  const bare = await loose.page();
  assert.equal(main(bare).querySelector("[data-aside]"), null);
  const failed = await w.page({ plane: { queue: (r) => (r.query.aside ? refusedIn("SOME_REFUSAL") : ok(emptyFeed())) } });
  const more = main(failed).querySelector('details[data-fold="more"]');
  assert.ok(more.querySelector('.cs-state[data-state="failed"]'), "drawn failed, never as no decision");
  assert.equal(more.querySelector('details[data-aside="set"]'), null);
  /* control: a concluded question is drawn its own row, no fold (her real conclusion in the project) */
  const v = await worldOf();
  await v.ann.act("conclude", { query: { target: v.id, project: v.project, reading: "Yes: repairs are made within seven days.", falsifier: "Work orders dated later show otherwise." } });
  const c = await v.page();
  assert.equal(main(c).querySelector('details[data-aside="set"]'), null);
});

/* ---------------------------------------------------------------------------------------------------------------------- R72 */

const PAIR = (c, k) => ({ capture: { axis: "capture", grade: c }, connection: { axis: "connection", grade: k } });
const weaker = (g) => String.fromCharCode(g.charCodeAt(0) + 1);
const later = (iso, days) => new Date(Date.parse(iso) + days * 86400000).toISOString().replace(/\.\d+Z$/, "Z");
/** A project of `ann`'s with a question resting on a held passage (capture graded B) and a directory (connection graded B by resolution), drawn into it, by real acts: its strength is graded on both
 *  axes. Answers `{world, ann, project, id, memo, today, retrieved, page(plane)}`: `today` is the owner's `inquirystrength`, `retrieved` the date the held passages were captured (the world's clock),
 *  `page(plane)` the question's page over the world's door with only the ops `plane` names answered otherwise. */
const gradedWorld = async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const directory = await world.recipes.graded(ann, project);
  const memo = (await world.recipes.hold(ann, POLICY, "The Director shall repair each reported pothole, part 1.", project)).bundle;
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", subject: directory.subject, draw: true,
    legs: [{ target: memo, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" }, { target: directory.document, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" }] })).id;
  const today = await ann.read("inquirystrength", { query: { id, project } });
  const retrieved = /^\s+retrieved: (\S+)/m.exec((await ann.read("image", { query: { id: memo } }))["bundle.md"])[1];
  const page = async (plane = {}) => {
    const { door, session } = world.boot(ann);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, plane });
    await p.settle();
    return p;
  };
  return { world, ann, project, id, memo, today, retrieved, page };
};
/** the cases a question is in, as published-read freezes them; a pair is today's, or one axis weaker (`cases(w)`'s B, whose capture grade was under today's) */
const casesOf = (w) => {
  const cap = w.today.capture.grade, con = w.today.connection.grade;
  return [
    { case_id: "CASE-A", edition: 2, project: w.project, published_at: later(w.retrieved, 9), signed_at: later(w.retrieved, 8), withdrawn: null, pinned: true, strength: PAIR(cap, con), strength_from: "case_document" },
    { case_id: "CASE-B", edition: 1, project: w.project, published_at: later(w.retrieved, 5), withdrawn: null, pinned: true, strength: PAIR(weaker(cap), con), strength_from: "member_bytes" },
    { case_id: "CASE-C", edition: 1, project: w.project, published_at: "2025-05-09T09:00:00Z", withdrawn: null, pinned: false, strength: PAIR("A", "A"), strength_from: "case_document" },
    { case_id: "CASE-D", edition: 1, project: w.project, published_at: "2025-06-01T09:00:00Z", withdrawn: null, pinned: true, strength: null, withheld: { orders: ["ORD-1"] } },
    { case_id: "CASE-E", edition: 1, project: w.project, published_at: "2025-07-01T09:00:00Z", withdrawn: null, pinned: null, strength: null, strength_detail: "none" }];
};
const FROZEN = (id, cases) => ok({ ok: true, id, cases, detail: "" });
const publishedcase = (project) => (r) => ok({ caseId: r.query.id, edition: Number(r.query.edition), project, ...(r.query.id === "CASE-A" ? { scope: "Street safety" } : {}) });
const entry = (p, id) => main(p).querySelector(`[data-case-edition="${id}"]`);

test("R72 what each published case froze for the question: one entry for each case edition, its own pair beside today's; the pinned-version check; a withheld edition with no pair; never combined", async () => {
  const w = await gradedWorld();
  const CASES = casesOf(w), cap = w.today.capture.grade, con = w.today.connection.grade;
  const p = await w.page({ publishedfrozen: FROZEN(w.id, CASES), publishedcase: publishedcase(w.project) });
  assert.equal(p.byOp("publishedfrozen")[0].query.id, w.id);
  const s = section(p, "screen.question.say045");
  assert.ok(s && says(s, "screen.question.say046") && says(s, "screen.question.say047"));
  assert.ok(says(s, "screen.question.frozen.count", { n: "5" }), "the question is in n published cases, n the cases the answer holds");
  assert.ok(!says(s, "screen.question.frozen.count.one"));
  /* the case as a reference of kind published, titled as the case states it, never its id */
  const a = entry(p, "CASE-A:2");
  /* a reference of kind published (a link where the published screen is served, its card either way) */
  assert.equal(a.querySelector("b").textContent, "Street safety");
  assert.ok((a.querySelector("b .cs-card") || a.querySelector("b a.cs-ref")).getAttribute("data-tip").includes(word("shell.card.published")));
  assert.ok(says(a.querySelector("[data-published]"), "screen.question.frozen.published", { date: day(CASES[0].published_at), n: "2" }), "Published <date>, edition n");
  assert.ok(says(entry(p, "CASE-B:1").querySelector("[data-published]"), "screen.question.frozen.published", { date: day(CASES[1].published_at), n: "1" }));
  const b = entry(p, "CASE-B:1");
  assert.ok(b.querySelector("b").textContent.startsWith(lead("state.undetermined")) && !b.textContent.includes("CASE-B"), "a case that states no title is undetermined, never its id");
  /* frozen beside today, each its own; the same or, axis by axis, stronger or weaker (today: the owner's pair for the question) */
  const grades = (el) => el.querySelectorAll(".cs-grade").map((g) => g.textContent.slice(-1));
  assert.deepEqual(grades(a.querySelector("[data-frozen]")), [cap, con]);
  assert.deepEqual(grades(a.querySelector("[data-today]")), [cap, con]);
  assert.deepEqual(grades(b.querySelector("[data-frozen]")), [weaker(cap), con], "each case its own pair, never combined");
  assert.deepEqual(grades(b.querySelector("[data-today]")), [cap, con]);
  assert.deepEqual([a, b].map((e) => ["capture", "connection"].map((x) => e.querySelector(`[data-axis="${x}"]`).getAttribute("data-relation"))), [["same", "same"], ["stronger", "same"]]);
  assert.ok(says(a.querySelector("[data-today]"), "screen.question.frozen.today") && says(b.querySelector("[data-today]"), "screen.question.frozen.today"), "Today:");
  assert.ok(says(a.querySelector("[data-axis=capture]"), "screen.question.word.same") && says(a.querySelector("[data-axis=connection]"), "screen.question.word.same"));
  assert.ok(says(b.querySelector("[data-axis=capture]"), "screen.question.word.stronger") && says(b.querySelector("[data-axis=connection]"), "screen.question.word.same"), "axis by axis");
  assert.ok(says(a.querySelector("[data-axis=capture]"), "screen.question.compare.axis", { axis: word("mark.scale.capture.name"), change: word("screen.question.word.same") }), "an axis with no citation: {axis}: {change}");
  assert.ok(says(a.querySelector("[data-axis=capture] .cs-card"), "mark.scale.capture.name") && a.querySelector("[data-axis=capture] .cs-card").getAttribute("data-tip").includes(word("screen.question.compare.captured.explain")));
  assert.ok(says(a, "screen.question.say048") && says(a, "screen.question.say050") && says(a, "screen.question.say051"), "stated in the signed case");
  assert.ok(says(b, "screen.question.say055") && !says(b, "screen.question.say050"), "stated in the member's own bytes");
  assert.ok(says(a, "screen.question.say052") && says(b, "screen.question.say052"), "pinned at the version she is reading");
  /* pinned: false draws that an earlier version was pinned and shows no strength */
  const c = entry(p, "CASE-C:1");
  assert.ok(says(c, "screen.question.say056") && says(c, "screen.question.say057"));
  assert.equal(c.querySelectorAll(".cs-grade").length, 0, "no pair for a case that pinned another version");
  assert.ok(!says(c, "screen.question.say052"));
  /* withheld: listed with that word and no pair */
  const held = entry(p, "CASE-D:1");
  assert.ok(held.hasAttribute("data-withheld") && says(held, "mark.gap.withheld.name") && held.querySelectorAll(".cs-grade").length === 0);
  /* pinned: null says nothing of a pin; a pair with no record is not filled in */
  const e = entry(p, "CASE-E:1");
  assert.ok(says(e, "screen.question.frozen.unpinned") && !says(a, "screen.question.frozen.unpinned") && !says(c, "screen.question.frozen.unpinned"), "pinned: null says nothing was pinned");
  assert.ok(!says(e, "screen.question.say052") && !says(e, "screen.question.say056") && says(e, "public-read.frozen.strength_detail.none") && e.querySelectorAll(".cs-grade").length === 0);
  /* its place: after Readings and the themes and what relies on this, before Concluding */
  const t = main(p).textContent, at1 = (k) => t.indexOf(word(k));
  assert.ok(at1("question.readings.title") < at1("question.around") && at1("question.around") < at1("screen.question.say045") && at1("screen.question.say045") < at1("screen.question.concluding.head"));
});

test("R72 controls: a question in no case draws no section; a question never published (NOT_PUBLISHED) draws none; a read that fails is drawn failed, never as none", async () => {
  const none = await open(at, { ...A, plane: { publishedfrozen: FROZEN(Q, []) } });
  assert.equal(section(none, "screen.question.say045"), undefined);
  const working = await open(at, { ...A, plane: { publishedfrozen: refusedIn("NOT_PUBLISHED") } });
  assert.equal(section(working, "screen.question.say045"), undefined);
  const failed = await open(at, { ...A, plane: { publishedfrozen: refusedIn("SOME_REFUSAL") } });
  assert.ok(section(failed, "screen.question.say045").querySelector('.cs-state[data-state="failed"]'));
  assert.ok(!section(failed, "screen.question.say045").textContent.includes(word("screen.question.say046")));
});

/* ---------------------------------------------------------------------------------------------------------------------- R73 */

const STD = "INFO-2026-0101", CNT = "INFO-2026-0102", AUD = "INFO-2026-0103";
const titled = (id, t) => ({ "bundle.md": `---\nid: ${id}\ntitle: "${t}"\n---\n` });
const DOCS = { [STD]: titled(STD, "The seven-day standard"), [CNT]: titled(CNT, "The count"), [AUD]: titled(AUD, "The audit") };
const L = (...ts) => ts.map((target, i) => ({ ord: i + 1, target_id: target, role: "supports", grade: "B" }));
const VERSIONS = [
  { name: "Two counts", state: "accepted", author: "member:ana", moved: { by: "ana", at: "2026-10-07T09:00:00Z" }, derived_from: null, run: null, kind: null, claim: { text: "Either count is enough." }, legs: L(CNT, AUD) },
  { name: "Seven-day standard", state: "accepted", author: "member:dev", moved: { by: "dev", at: "2026-10-06T09:00:00Z" }, derived_from: "Two counts", run: null, kind: null, claim: { text: "The standard is needed." }, legs: L(STD, CNT, AUD) },
  { name: "The audit alone", state: "suggested", author: "class:ai/t1", run: "RUN-77", kind: "machine", derived_from: "Two counts", at: "2026-10-08T09:00:00Z", legs: L(AUD) },
  { name: "The count alone", state: "considering", author: "member:mai", hidden: true, derived_from: "Two counts", legs: L(CNT) }];
const bv = (versions) => (r) => ok({ ok: true, inquiry: Q, versions, ...(r.query.project ? { current: { project: P, version: "Seven-day standard" } } : {}) });
const dim = (same, a, b) => ({ same, a, b });
const COMPARED = (a, b) => ok({ ok: true, a, b, differs: 4, of: 5, legs: { taken_up: [{ ord: 1, target: STD }], let_go: [], kept: [{ ord: 2, target: CNT }, { ord: 3, target: AUD }] },
  dimensions: {
    claim: dim(false, { text: "Either count is enough." }, { text: "The standard is needed." }),
    legs: dim(false, [{ target: CNT }, { target: AUD }], [{ target: STD }, { target: CNT }, { target: AUD }]),
    relationship: dim(false, { relationship: "any", partition: [] }, { relationship: "all", partition: [] }),
    decision: dim(false, { state: "accepted", moved: { by: "ana", at: "2026-10-07T09:00:00Z" }, current: false }, { state: "accepted", moved: { by: "dev", at: "2026-10-06T09:00:00Z" }, current: true }),
    origin: dim(true, { author: "member:ana", kind: null, run: null, derived_from: null }, { author: "member:dev", kind: null, run: null, derived_from: "Two counts" }) } });
const withVersions = (o = {}) => reach({ ...A, images: { ...A.images, ...DOCS }, ...o, plane: { basisversions: bv(VERSIONS), ...(o.plane || {}) } });
const fold73 = (p) => main(p).querySelector("details[data-compare-fold]");

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R73 compare two readings: choosing one sends versioncompare (a: the reading chosen, b: the reading shown, the project) and nothing is written; the reasons taken up, let go and kept; the five dimensions in the answer's order", async () => {
  const p = await open(at, withVersions({ plane: { versioncompare: (r) => COMPARED(r.query.a, r.query.b) } }));
  const f = fold73(p);
  assert.ok(says(f.querySelector("summary"), "screen.question.say022") && says(f, "screen.question.say023") && says(f, "screen.question.say024") && says(f, "screen.question.say025"));
  assert.equal(p.byOp("versioncompare").length, 0, "nothing is read until she chooses");
  assert.deepEqual(f.querySelectorAll("#question-compare option").map((o) => o.getAttribute("value")), ["", "Two counts", "The audit alone", "The count alone"], "the other readings, record data");
  await choose(p, "question-compare", "Two counts");
  assert.deepEqual(p.byOp("versioncompare")[0].query, { op: "versioncompare", target: Q, a: "Two counts", b: "Seven-day standard", project: P });
  const g = fold73(p);
  assert.ok(says(g.querySelector('[data-compare="sentence"]'), "screen.question.say026", { against: "Two counts", shown: "Seven-day standard", n: "4", total: "5" }));
  /* the reasons taken up, let go and kept, each a reference to its target; an empty one is not drawn */
  const refsOf = (k) => g.querySelectorAll(`[data-legs="${k}"] a.cs-ref`).map((a) => a.textContent);
  assert.deepEqual(refsOf("taken_up"), ["The seven-day standard"]);
  assert.deepEqual(refsOf("kept"), ["The count", "The audit"]);
  assert.ok(says(g.querySelector('[data-legs="taken_up"]'), "screen.question.compare.takenup") && says(g.querySelector('[data-legs="let_go"]'), "screen.question.compare.letgo") && says(g.querySelector('[data-legs="kept"]'), "screen.question.compare.kept"));
  assert.ok(says(g.querySelector('[data-legs="let_go"]'), "screen.question.compare.none") && !says(g.querySelector('[data-legs="taken_up"]'), "screen.question.compare.none"), "none when empty");
  assert.equal(g.querySelector(`[data-legs="taken_up"] a.cs-ref`).getAttribute("href"), "/app/document/" + STD);
  /* the five dimensions in the fixed order, the count of those that differ the sentence's n */
  const dims = g.querySelectorAll("[data-dim]");
  assert.deepEqual(dims.map((d) => d.getAttribute("data-dim")), ["claim", "legs", "relationship", "decision", "origin"]);
  assert.equal(dims.filter((d) => d.getAttribute("data-same") === "no").length, 4);
  for (const [k, key] of [["claim", "screen.question.say027"], ["legs", "screen.question.say028"], ["relationship", "screen.question.say029"], ["decision", "screen.question.say032"]]) assert.ok(says(g.querySelector(`[data-dim="${k}"]`), key), k);
  const claim = g.querySelector('[data-dim="claim"]');
  assert.ok(says(claim.querySelector('[data-side="was"]'), "screen.question.compare.was", { value: "Either count is enough." }) && says(claim.querySelector('[data-side="now"]'), "screen.question.compare.now", { value: "The standard is needed." }), "Was and Now by their keys");
  assert.ok(g.querySelectorAll("[data-dim]").every((d) => says(d, d.getAttribute("data-same") === "yes" ? "screen.question.word.same" : "screen.question.word.different")), "each dimension says different or the same");
  assert.ok(says(g.querySelector('[data-dim="origin"]'), "screen.question.compare.origin"));
  assert.ok(claim.querySelector('[data-side="was"]').textContent.includes("Either count is enough.") && claim.querySelector('[data-side="now"]').textContent.includes("The standard is needed."));
  assert.ok(g.querySelector('[data-dim="legs"] [data-side="now"]').textContent.includes("The seven-day standard"));
  const dec = g.querySelector('[data-dim="decision"]');
  assert.ok(says(dec.querySelector('[data-side="was"]'), "screen.question.say033", { member: "ana", date: day("2026-10-07") }));
  assert.ok(says(dec.querySelector('[data-side="now"]'), "screen.question.say034", { member: "dev", date: day("2026-10-06"), project: "Pothole repairs" }));
  assert.ok(says(g.querySelector('[data-dim="origin"]'), "screen.question.say035") && g.querySelector('[data-dim="origin"]').getAttribute("data-same") === "yes");
  /* control: no request writes */
  assert.deepEqual(p.requests.filter((r) => r.method !== "GET").map((r) => r.op).filter((op) => op !== "subscriptionsignin"), [], "comparing is reading: nothing is written");
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R73 where each reading came from: a tree by derived_from and origin, the roots first, each child indented under its source, the one read marked, a hidden reading held back, an orphan drawn first with its source", async () => {
  const orphan = { name: "Orphan", state: "suggested", author: "member:mai", derived_from: "Lost", legs: L(AUD) };
  const p = await open(at, withVersions({ plane: { basisversions: bv(VERSIONS.concat([orphan])) } }));
  const f = fold73(p);
  const t = f.querySelectorAll("[data-tree]");
  assert.deepEqual(t.map((x) => [x.getAttribute("data-tree"), x.getAttribute("data-depth")]),
    [["Two counts", "0"], ["Seven-day standard", "1"], ["The audit alone", "1"], ["The count alone", "1"], ["Orphan", "0"]]);
  const at2 = (n) => f.querySelector(`[data-tree="${n}"]`);
  assert.ok(says(at2("Two counts"), "screen.question.say037", { member: "ana" }), "the first reading");
  assert.ok(says(at2("Seven-day standard"), "screen.question.say038", { member: "dev" }) && says(at2("Seven-day standard"), "screen.question.say039"), "built from it; the one read");
  assert.ok(says(at2("The audit alone"), "screen.question.say040") && at2("The audit alone").querySelector('.cs-origin[data-origin="machine"]'), "taken by the assistant, marked machine work");
  assert.ok(says(at2("The count alone"), "screen.question.say041", { member: "mai" }) && says(at2("The count alone"), "screen.question.say042"), "taken from it; held back");
  assert.equal(at2("Orphan").querySelector('[data-from="Lost"]').textContent, "Lost", "a reading whose source is not among those drawn says where it comes from");
  assert.ok(says(f, "screen.question.say036") && says(f, "screen.question.say043") && says(f, "screen.question.say044"));
  /* control: a machine-authored reading is drawn only while the assistant is reachable */
  const off = await open(at, { ...A, images: { ...A.images, ...DOCS }, plane: { basisversions: bv(VERSIONS) } });
  assert.equal(fold73(off).querySelector('[data-tree="The audit alone"]'), null);
  assert.deepEqual(fold73(off).querySelectorAll("#question-compare option").map((o) => o.getAttribute("value")), ["", "Two counts", "The count alone"]);
});

test("R73 the three refusals are drawn by their words in the place of the answer; a reading compared with itself draws every dimension the same; control: a question with one reading draws no compare fold", async () => {
  for (const code of ["VERSION_COMPARE_NO_SUCH_VERSION", "VERSION_COMPARE_NO_VERSION", "VERSION_COMPARE_NO_INQUIRY"]) {
    const p = await open(at, withVersions({ plane: { versioncompare: refusedIn(code) } }));
    await choose(p, "question-compare", "Two counts");
    const r = fold73(p).querySelector('[data-compare="refused"]');
    assert.ok(says(r, "refusal." + code, { version: "Two counts" }), code);
    assert.equal(fold73(p).querySelector("[data-dim]"), null, "in the place of the answer");
  }
  const same = (x) => dim(true, x, x);
  const self = ok({ ok: true, a: "Two counts", b: "Two counts", differs: 0, of: 5, legs: { taken_up: [], let_go: [], kept: [{ ord: 1, target: CNT }] },
    dimensions: { claim: same("x"), legs: same([{ target: CNT }]), relationship: same({ relationship: "any", partition: [] }), decision: same({ state: "accepted" }), origin: same({ author: "member:ana" }) } });
  const p = await open(at, withVersions({ plane: { versioncompare: self } }));
  await choose(p, "question-compare", "Two counts");
  const dims = fold73(p).querySelectorAll("[data-dim]");
  assert.equal(dims.length, 5);
  assert.ok(dims.every((d) => d.getAttribute("data-same") === "yes"));
  assert.ok(says(fold73(p).querySelector('[data-compare="sentence"]'), "screen.question.say026", { against: "Two counts", shown: "Seven-day standard", n: "0", total: "5" }));
  const one = await open(at, withVersions({ plane: { basisversions: bv(VERSIONS.slice(0, 1)) } }));
  assert.equal(fold73(one), null);
});

/* ---------------------------------------------------------------------------------------------------------------------- R74 */

const BIAS = (bias) => (r) => ok({ ok: true, found: true, session: { id: r.query.run, status: "completed", principal: { plane: "member:mai" }, created: "2026-10-08T09:00:00Z", bias } });
const biasFold = (p, name = "The audit alone") => main(p).querySelector(`details[data-bias-fold="${name}"]`);

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R74 on a reading the assistant composed that is not yet accepted: the bias its own run was composed under, before she accepts it; the three answers and the no-manifest answer each draw their sentence", async () => {
  const cases = [
    [{ in_force: true, moved: true, moved_basis: "at_open" }, "moved", ["screen.question.say013"], ["screen.question.say017", "screen.question.say019", "screen.question.say021"]],
    [{ in_force: true, moved: false, moved_basis: "at_open" }, "notmoved", ["screen.question.say017", "screen.question.say018"], ["screen.question.say013", "screen.question.say019", "screen.question.say021"]],
    [{ in_force: true, moved: null, moved_basis: "handed" }, "unknown", ["screen.question.say019", "screen.question.say020"], ["screen.question.say017", "screen.question.say018", "screen.question.say013"]],
    [{ in_force: false, moved: false, moved_basis: "handed" }, "noneinforce", ["screen.question.say021"], ["screen.question.say017", "screen.question.say013", "screen.question.say019"]]];
  for (const [bias, kind, yes, no] of cases) {
    const p = await open(at, withVersions({ plane: { airun: BIAS(bias) } }));
    const f = biasFold(p);
    assert.equal(p.byOp("airun").find((r) => r.query.run === "RUN-77").query.run, "RUN-77", "read for the version's own run");
    assert.ok(says(f.querySelector("summary"), "screen.question.say009") && says(f, "screen.question.say010") && says(f, "screen.question.say011"));
    assert.ok(says(f, "screen.question.say012", { member: "mai", date: day("2026-10-08") }) && f.querySelector('.cs-origin[data-origin="machine"]'));
    assert.ok(says(f, "screen.question.say014") && says(f, "screen.question.say015"), "not a comparison with a bias of her own");
    assert.equal(f.querySelector("[data-bias]").getAttribute("data-bias"), kind);
    for (const k of yes) assert.ok(says(f.querySelector("[data-bias]"), k), kind + " " + k);
    assert.equal(says(f.querySelector("[data-bias]"), "screen.question.bias.moved"), kind === "moved", kind + " It has moved.");
    for (const k of no) assert.ok(!says(f.querySelector("[data-bias]"), k), kind + " never " + k);
    assert.ok(!/\d/.test(f.querySelector("[data-bias]").textContent), "whether it moved, never statement counts");
    /* it repeats the acts, so she can accept, weigh or reject from it */
    assert.deepEqual(actsIn(f).sort(), ["versionaccept", "versionconsider", "versionreject"]);
  }
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R74 an accept, a weigh and a reject sent from the fold carry the version; a run answering found: false is undetermined, never 'has not moved'; controls: a member-written or an accepted reading draws no fold", async () => {
  /* a reading suggested by the machine under its run (the world's recipe): the real acts, from the fold */
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const machine = await world.recipes.machineReading(admin, ann, project);
  const { door, session } = world.boot(ann);
  const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + machine.question });
  await p.settle();
  await press(p, "versionconsider", { within: biasFold(p, machine.version), reason: "weigh it" });
  await press(p, "versionaccept", { within: biasFold(p, machine.version) });
  assert.deepEqual([p.byOp("versionaccept")[0].body.version, p.byOp("versionconsider")[0].body.version], [machine.version, machine.version]);
  const missing = await open(at, withVersions({ plane: { airun: ok({ run: "RUN-77", found: false, session: null }) } }));
  const lens = biasFold(missing).querySelector("[data-bias]");
  assert.equal(lens.getAttribute("data-bias"), "undetermined");
  assert.ok(lens.textContent.includes(lead("state.undetermined")) && !says(lens, "screen.question.say017"));
  /* a run whose read fails is drawn failed */
  const failed = await open(at, withVersions({ plane: { airun: refusedIn("SOME_REFUSAL") } }));
  assert.ok(biasFold(failed).querySelector('.cs-state[data-state="failed"]'));
  /* controls: a reading a member wrote, an accepted machine reading, and a machine reading while the assistant is not reachable */
  const mine = VERSIONS.map((v) => (v.name === "The audit alone" ? { ...v, author: "member:mai", run: null, kind: null } : v));
  assert.equal(biasFold(await open(at, withVersions({ plane: { basisversions: bv(mine) } }))), null);
  const acc = VERSIONS.map((v) => (v.name === "The audit alone" ? { ...v, state: "accepted" } : v));
  assert.equal(biasFold(await open(at, withVersions({ plane: { basisversions: bv(acc) } }))), null);
  assert.equal(biasFold(await open(at, { ...A, plane: { basisversions: bv(VERSIONS) } })), null);
});

/* ---------------------------------------------------------------------------------------------------------------------- R70 */

test("R70 the question page draws no state chip or term the drawing does not draw: no state of an item is explained by a word of this module, and no glossary term is drawn", async () => {
  const KINDS = ["review", "reviewed", "retired", "open", "concluded", "deferred", "dismissed", "divided", "published", "waiting", "planned", "active", "resolved", "abandoned", "flagged", "watched"];
  /* the four states the page is drawn in, each of a question of hers made by real acts: as it is; set aside for the project; with two readings accepted; concluded */
  const w = await worldOf({ n: 1 });
  const { ann, project } = w;
  const conclusion = { query: { project, reading: "Yes: repairs are made within seven days.", falsifier: "Work orders dated later show otherwise." } };
  const aside1 = await w.question("Set aside");
  await ann.act("proposedispose", { body: { project, finding: aside1, to: "deferred", reason: "waiting for the 2026 log" } });
  const held = await w.world.recipes.page(ann, "A cited page", { paragraphs: ["Repairs are made within seven days."], project });
  const read2 = await w.question("Two readings", { legs: [{ target: held.bundle, role: "supports", extent_kind: "doc-para", extent_para: 1 }] });
  await ann.act("conclude", { query: { target: read2, ...conclusion.query } });
  const description = "Points the first citation at the first run of its paragraph alone, because the rest of the paragraph does not matter.";
  await ann.act("narrow", { query: { target: read2, version: "reading-1", ord: 0, name: "alt", description }, body: { extent: { extent_kind: "doc-para", extent_para: 1, extent_run: 0 } } });
  await ann.act("versionaccept", { query: { target: read2, version: "alt", project }, body: {} });
  await ann.act("withdrawconclusion", { query: { target: read2, project, reason: "new evidence" } });
  const done = await w.question("Concluded");
  await ann.act("conclude", { query: { target: done, ...conclusion.query } });
  for (const id of [w.id, aside1, read2, done]) {
    const p = await w.page({}, ann, "/app/question/" + id);
    const text = main(p).textContent;
    for (const k of KINDS) for (const part of ["means", "can", "cannot"]) assert.ok(!hasWord(`state.item.${k}.${part}`) || !text.includes(word(`state.item.${k}.${part}`)), `state.item.${k}.${part} is the kit's chip's, drawn where the design draws one`);
    assert.equal(main(p).querySelectorAll("[data-chip], [data-term], .cs-chip, .cs-term").length, 0, "no chip or term where the drawing draws none");
  }
});

/* ---------------------------------------------------------------------------------------------------------------------- R78 */

test("R78 a page the record states counts from zero and is drawn from one: an extent of page 0 draws Page 1 in the cited passage's place and in the read-back; a leg whose extent states no page draws none", async () => {
  const page = (n) => String(n + 1);
  const legs = [{ target: D, role: "supports", grade: "B", ground: "part 1", extent_page: 0 }, { target: "INFO-2026-0005", role: "supports", grade: "B", ground: "part 2", extent_page: 2 },
    { target: "INFO-2026-0007", role: "supports", grade: "B", ground: "part 2" }];
  const refs = legs.map((l) => [l.target, "cites", "confirmed", null]);
  const md = inquiryMd(P, refs, { legs, grounds: [{ ground: "part 1", asserted_by: "member:dev", at: "2026-10-05T09:00:00Z" }] });
  const p = await open(at, { images: { [Q]: { "bundle.md": md } } });
  const sup = section(p, "screen.question.supports.head");
  const rowOf = (t) => sup.querySelectorAll(".cs-row").find((r) => r.querySelector(`a.cs-ref[href="/app/document/${t}"]`));
  assert.ok(says(rowOf(D), "screen.document.passage.where", { page: page(0) }), "page 0 is Page 1");
  assert.ok(says(rowOf("INFO-2026-0005"), "screen.document.passage.where", { page: page(2) }));
  assert.ok(!rowOf("INFO-2026-0007").querySelector("a.cs-ref").parentElement.textContent.includes(lead("screen.document.passage.where")), "an extent that states no page draws no page");
  const rests = section(p, "question.rests.title");
  assert.ok(rests.textContent.includes(word("screen.document.passage.where", { page: page(0) })), "the read-back draws the place too");
  /* control: the value the screen sends is the record's own, untouched */
  assert.ok(p.byOp("basisversions").length > 0 && !p.requests.some((r) => r.body && JSON.stringify(r.body).includes('"page"')));
});

/** the case B edition, published `days` after the date the held passages were captured (negative: before it), the question's page drawing it beside today's pair */
const dated = async (days) => {
  const w = await gradedWorld();
  const c = { ...casesOf(w)[1], published_at: later(w.retrieved, days) };
  return { w, c, e: entry(await w.page({ publishedfrozen: FROZEN(w.id, [c]), publishedcase: publishedcase(w.project) }), "CASE-B:1") };
};

test("R72 the capture axis with a document the question cited after the edition published draws screen.question.say054 ({change}, {source} the document's title); the other axis, with none, draws screen.question.compare.axis", async () => {
  const { w, e } = await dated(-1);
  /* both held passages carry the world's clock as their capture date: the first the question cites is the newest, by the page's own rule */
  assert.ok(says(e.querySelector("[data-axis=capture]"), "screen.question.say054", { change: word("screen.question.word.stronger"), source: POLICY }));
  assert.ok(says(e.querySelector("[data-axis=connection]"), "screen.question.compare.axis", { axis: word("mark.scale.connection.name"), change: word("screen.question.word.same") }));
});

test("R72 a citation dated before the edition published draws screen.question.compare.axis, never say054", async () => {
  const { e } = await dated(1);
  assert.ok(says(e.querySelector("[data-axis=capture]"), "screen.question.compare.axis", { axis: word("mark.scale.capture.name"), change: word("screen.question.word.stronger") }));
  assert.ok(!e.textContent.includes(lead("screen.question.say054")));
});
