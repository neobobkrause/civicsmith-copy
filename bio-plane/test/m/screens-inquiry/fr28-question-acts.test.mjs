/* screens-inquiry FR-28 (B15), the acts the registry lists on `question` that were not drawn: R101 (revise or take back a hunch),
 * R102 (divide a question), R103 (reminders to look again), R104 (reopen a finding), and R10 (the screen's acts are exactly the
 * registry's, `writinghelp` among them). On interface-shell's served page over a scripted plane; every request is checked by the
 * shell's guard against the owner's declared fields. Every expectation is a word read by key (R44), never copied (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDeclaredOps as registerOps } from "../../../src/op-declarations/index.mjs";
import { readFileSync } from "node:fs";
import { boot, ok, refusedIn } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { divideAnswers } from "../inquiry/fixtures.mjs";
import { BUNDLE_ID_RE } from "../../../src/record-grammar/ids.mjs";
import { open, storeWorld, aiAccounts, main, actsIn, button, fill, press, rawKeys, inquiryMd, INQUIRY_REFS, LEGS, BASIS, plane, says, section, day, word, SCREENS, POLICY, P, Q, D } from "./fixtures.mjs";

/* K4245 (test-support R17): every owner's declarations registered once, before the first read, by the one registrar */

const REGISTRY = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
const at = "/app/question/" + Q;
const GROUNDS = [{ ground: "part 1", asserted_by: "member:dev", at: "2026-10-05T09:00:00Z" }];
const grouped = (o = {}) => inquiryMd(P, INQUIRY_REFS, { legs: LEGS.map((l) => (l.target === D ? { ...l, ground: "part 1" } : l)), grounds: GROUNDS, ...o });
const A = { images: { [Q]: { "bundle.md": grouped() } } };
const DOC_TITLE = POLICY;
const OWN = { capabilities: ["contribute", "create_projects"] };
/** A project of `ann`'s with `n` held documents (the first titled POLICY) and a question of hers resting on them, drawn into the project, by real acts. `join(handle)` makes another member of the project (she invites,
 *  the other joins). Answers `{world, ann, project, targets, id, join(handle), page(opts, who)}`; `page` boots the question's page over the world's door as `who` (default `ann`). */
const stateWorld = async ({ n = 3, world = null } = {}) => {
  world = world || await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const targets = [];
  for (let i = 0; i < n; i++) targets.push((await world.recipes.hold(ann, i ? "Passage " + (i + 1) : POLICY, "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", legs: targets.map((target) => ({ target, role: "supports" })), draw: true })).id;
  const join = async (handle) => {
    const m = await world.signIn(handle, { capabilities: ["contribute"] });
    await ann.act("projectinvite", { query: { projectId: project, handle } });
    await m.act("projectjoin", { query: { projectId: project } });
    return m;
  };
  const page = async (o = {}, who = ann) => {
    const { door, session } = world.boot(who);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, ...o });
    await p.settle();
    return p;
  };
  return { world, ann, project, targets, id, join, page };
};
/** a record's title, as its bundle holds it */
const titleOf = async (as, id) => /^title: "?(.*?)"?$/m.exec((await as.read("image", { query: { id } }))["bundle.md"])[1];
const CONCLUDED = (r) => ok(BASIS(r.query.project ? { conclusion: { claim: { text: "Yes." }, by: "member:dev", at: "2026-10-13T09:00:00Z" }, conclusion_stance: "concluded" } : {}));

/* ------------------------------------------------------------------------------------------------------------------ R101 */

/** a question with a hunch of dev's (dev joined the project and held it by the act the page makes), and ana, a second member who can see the question */
const hunchWorld = async () => {
  const w = await stateWorld({ n: 1 });
  const dev = await w.join("dev");
  const ana = await w.join("ana");
  const held = await dev.act("hypothesishold", { body: { inquiry: w.id, kind: "other", statement: "Crews close reports when they inspect.", about: [w.id] } });
  return { ...w, dev, ana, hid: held.hypothesis_id };
};

test("R101 any member who sees the question revises or takes back a hunch, each with her reason: revise sends the hunch, the new statement and the reason; withdraw sends the hunch and the reason", async () => {
  const w = await hunchWorld();
  const p = await w.page();
  const foldNow = () => main(p).querySelector(`[data-hunch="${w.hid}"] details`);
  const fold = foldNow();
  assert.ok(fold && says(fold.querySelector("summary"), "screen.question.hunch.change.summary", { name: "dev" }), "the fold for dev's hunch");
  assert.ok(says(fold, "screen.question.hunch.change.note") && says(fold, "screen.question.hunch.revise.label") && says(fold, "screen.question.hunch.revise.help") && says(fold, "screen.question.hunch.revise.reason"));
  assert.equal(p.doc.getElementById("question-hrev-0").value, "Crews close reports when they inspect.", "the statement to change is the current one");
  /* revise: the new statement and the reason */
  fill(p, { "question-hrev-0": "Crews close reports at inspection, not repair.", "question-hrevr-0": "the crew foreman said so" });
  await press(p, "hypothesisrevise", { within: foldNow() });
  assert.deepEqual(p.byOp("hypothesisrevise")[0].body, { hypothesisId: w.hid, statement: "Crews close reports at inspection, not repair.", reason: "the crew foreman said so" });
  assert.equal(p.doc.getElementById("question-hrev-0").value, "Crews close reports at inspection, not repair.", "the change reached the record: the statement to change is now the revised one");
  /* revise with the words left as they are: only the reason changes (the statement is omitted) */
  fill(p, { "question-hrevr-0": "I checked it again" });
  await press(p, "hypothesisrevise", { within: foldNow() });
  assert.deepEqual(p.byOp("hypothesisrevise")[1].body, { hypothesisId: w.hid, reason: "I checked it again" });
  /* withdraw: the hunch and the reason, with the sentences that say it cannot be undone */
  assert.ok(says(foldNow(), "screen.question.hunch.withdraw.reason") && says(foldNow(), "screen.question.hunch.withdraw.note") && says(foldNow(), "screen.question.hunch.withdraw.note2"));
  assert.ok(says(button(p, "hypothesiswithdraw", foldNow()), "screen.question.hunch.withdraw.button"));
  fill(p, { "question-hwr-0": "the foreman corrected me" });
  await press(p, "hypothesiswithdraw", { within: foldNow() });
  assert.deepEqual(p.byOp("hypothesiswithdraw")[0].body, { hypothesisId: w.hid, reason: "the foreman corrected me" });
  assert.ok(p.byOp("hypotheses").length >= 3, "the hunches are read again after each change");
  assert.equal((await w.ann.read("hypotheses", { query: { inquiry: w.id } })).hypotheses[0].status, "withdrawn", "and the real act took the hunch back");
});

test("R101 each change stays on the record with who and why: the hunch's history is drawn; a hunch taken back is shown withdrawn and offers no change (control: no reason sends nothing and says so)", async () => {
  const w = await hunchWorld();
  await w.ana.act("hypothesisrevise", { body: { hypothesisId: w.hid, statement: "Crews close reports on inspection.", reason: "the inspection log says so" } });
  /* the date the record states for her change (the hunches' own clock) */
  const revised = (await w.ann.read("hypotheses", { query: { inquiry: w.id } })).hypotheses[0].history.find((x) => x.act === "revise");
  const p = await w.page();
  const h = main(p).querySelector(`[data-hunch="${w.hid}"]`);
  const rows = h.querySelectorAll("[data-history]");
  assert.deepEqual(rows.map((r) => r.getAttribute("data-history")), ["hold", "revise"]);
  assert.ok(rows[1].textContent.includes("ana") && rows[1].textContent.includes(day(revised.at)) && rows[1].textContent.includes("the inspection log says so") && says(rows[1], "shell.reason.lead"), "who, when and why");
  /* a hunch is never a leg: it is drawn as a hunch, with no grade */
  assert.equal(h.querySelectorAll(".cs-grade").length, 0);
  assert.ok(h.querySelector('[data-mark="hunch"]'));
  /* control: no reason, nothing sent */
  const n = await w.page();
  const f = main(n).querySelector(`[data-hunch="${w.hid}"] details`);
  assert.ok(says(await press(n, "hypothesisrevise", { within: f }), "screen.question.hunch.refused.body"));
  assert.ok(says(await press(n, "hypothesiswithdraw", { within: f }), "screen.question.hunch.refused.body"));
  assert.equal(n.byOp("hypothesisrevise").length + n.byOp("hypothesiswithdraw").length, 0);
  assert.ok(says(f, "screen.question.hunch.refused.summary") && says(f, "screen.question.hunch.refused.body2"));
  /* a hunch taken back is shown withdrawn and offers no change */
  await w.dev.act("hypothesiswithdraw", { body: { hypothesisId: w.hid, reason: "mistaken" } });
  const gone = await w.page();
  const g = main(gone).querySelector(`[data-hunch="${w.hid}"]`);
  assert.equal(g.getAttribute("data-status"), "withdrawn");
  assert.ok(g.textContent.includes("mistaken") && says(g, "screen.question.hunch.withdraw.note2"));
  assert.equal(g.querySelector("details"), null, "a hunch taken back is not changed again");
});

test("R101 the owner's refusals of a change are drawn by their words", async () => {
  const w = await hunchWorld();
  const p = await w.page();
  /* the hunch is taken back by its holder after the page was drawn: the page still offers the change, and the owner refuses it */
  await w.dev.act("hypothesiswithdraw", { body: { hypothesisId: w.hid, reason: "mistaken" } });
  const f = main(p).querySelector(`[data-hunch="${w.hid}"] details`);
  fill(p, { "question-hrevr-0": "why" });
  assert.ok(says(await press(p, "hypothesisrevise", { within: f }), "refusal.HYPOTHESIS_WITHDRAWN"));
  assert.deepEqual(rawKeys(p.root()), [], "every sentence the folds draw is a held word");
});

/* ------------------------------------------------------------------------------------------------------------------ R102 */

test("R102 Divide this question sends the reason, and two new questions, each numbered by the plane's allocator and carrying the passages sent to it; the new questions are drawn with their numbers", async () => {
  const w = await stateWorld({ n: 3 });
  const p = await w.page();
  const fold = main(p).querySelector("details[data-divide]");
  assert.ok(fold && says(fold.querySelector("summary"), "screen.question.divide.summary"));
  assert.deepEqual(rawKeys(fold), [], "every sentence the divide fold draws is a held word");
  assert.ok(says(fold, "screen.question.divide.leg", { passage: DOC_TITLE }), "a choice for each passage, named by its document's title");
  fill(p, { "question-divide-reason": "It was two questions.", "question-divide-q1": "How many reported potholes were marked closed within seven days?", "question-divide-q2": "Were the potholes marked closed actually repaired?" });
  const check = (ord, side) => { p.doc.getElementById(`question-divide-leg-${ord}-${side}`).checked = true; };
  check(0, 0); check(1, 1); check(2, 0); check(2, 1);
  await press(p, "inquirydivide", { within: fold });
  const b = p.byOp("inquirydivide")[0].body;
  assert.equal(b.target, w.id);
  assert.equal(b.reason, "It was two questions.");
  assert.deepEqual(b.children.map((c) => [c.question, c.legs]), [["How many reported potholes were marked closed within seven days?", [0, 2]], ["Were the potholes marked closed actually repaired?", [1, 2]]]);
  assert.deepEqual(b.children.map((c) => c.id.slice(0, 13)), ["INQ-2026-0002", "INQ-2026-0003"], "numbered for the member (the question took the first number)");
  for (const c of b.children) assert.match(c.id, BUNDLE_ID_RE, "an id the record's grammar accepts");
  const shown = main(p).querySelector("[data-divided]");
  assert.deepEqual(shown.querySelectorAll("[data-child]").map((c) => c.getAttribute("data-child")), b.children.map((c) => c.id));
  assert.ok(shown.textContent.includes(b.children[0].id) && shown.textContent.includes("Were the potholes marked closed actually repaired?"), "each new question drawn with its number");
  assert.ok(shown.querySelector(`a.cs-ref[href="/app/question/${b.children[1].id}"]`), "a reference opening it");
});

test("R102 control: a missing reason, a missing question or a passage sent nowhere sends nothing and says what to give; a refusal is drawn by its words; a long title never ends the id in a hyphen", async () => {
  const w = await stateWorld({ n: 3 });
  const p = await w.page();
  const fold = main(p).querySelector("details[data-divide]");
  assert.ok(says(await press(p, "inquirydivide", { within: fold }), "screen.question.divide.refused.body"), "nothing written");
  fill(p, { "question-divide-reason": "r", "question-divide-q1": "One?", "question-divide-q2": "Two?" });
  p.doc.getElementById("question-divide-leg-0-0").checked = true;
  assert.ok(says(await press(p, "inquirydivide", { within: fold }), "screen.question.divide.refused.body"), "two passages have no home");
  assert.equal(p.byOp("inquirydivide").length, 0);
  assert.equal(p.byOp("allocid").length, 0, "no number is taken for a division that cannot be sent");
  /* a question whose 40th character falls on a hyphen (the owner's refusal is its own answer, scripted over the world: the real act refuses only what already exists) */
  const long = "Did the city close every one of the reported potholes - on time";
  const q = await w.page({ plane: { inquirydivide: ok(divideAnswers().childExists) } });
  const f = main(q).querySelector("details[data-divide]");
  fill(q, { "question-divide-reason": "r", "question-divide-q1": long, "question-divide-q2": "Two?" });
  for (const o of [0, 1, 2]) { q.doc.getElementById(`question-divide-leg-${o}-0`).checked = true; q.doc.getElementById(`question-divide-leg-${o}-1`).checked = true; }
  assert.ok(says(await press(q, "inquirydivide", { within: f }), "refusal.CHILD_EXISTS"), "the owner's refusal by its words");
  for (const c of q.byOp("inquirydivide")[0].body.children) assert.match(c.id, BUNDLE_ID_RE);
});

/* ------------------------------------------------------------------------------------------------------------------ R103 */

/** a question citing a held page that has since changed at its source (the world's recipe `newerCapture`): the reminder the record holds for the document is a `source_status` cause (an `edition` cause needs a
 *  ratified or published edition above the first of a held document, which no act makes). Answers the recipe's, `as` the member signed in again, with `page(id)` over the world's door as her. */
const changedWorld = async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const made = await world.recipes.newerCapture(ann);
  const page = async (id = made.question) => {
    const { door, session } = world.boot(made.as);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id });
    await p.settle();
    return p;
  };
  return { world, ...made, page };
};
const obligationsOf = async (w, id) => (await w.as.read("reevaluations", { query: { target: w.document } })).obligations.filter((o) => o.bundle_id === id);

test("R103 what needs a second look is listed from the reminders the record holds for what this question rests on, and recording that one was looked at sends the dependent, the cause and the note", async () => {
  const w = await changedWorld();
  const p = await w.page();
  assert.deepEqual(p.byOp("reevaluations").map((r) => r.query.target), [w.document], "read for each document the question cites that is not taken back");
  const cause = (await obligationsOf(w, w.question))[0].causes[0];
  const s = main(p).querySelector("#reeval");
  assert.ok(s && says(s.querySelector("h2"), "screen.question.reeval.heading"));
  const open1 = s.querySelector('[data-reeval="open"]');
  assert.ok(open1.textContent.includes(cause.detail) && open1.textContent.includes(day(cause.since)), "a cause, as the record words it, with its date");
  assert.ok(says(s, "screen.question.reeval.note.label"));
  fill(p, { "question-reeval-note": "The new edition repeats the clause." });
  await press(p, "reevaluationrecord", { within: s });
  assert.deepEqual(p.byOp("reevaluationrecord")[0].body, { dependent: w.question, target: w.document, source: cause.source, since: cause.since, note: "The new edition repeats the clause." });
  /* the real act closed the cause: the list read again draws it as looked at, with who, when and what was decided */
  const closed = (await w.as.read("reevaluations", { query: { target: w.document } })).closed.find((o) => o.bundle_id === w.question).causes[0];
  const done = main(p).querySelector('#reeval [data-reeval="done"]');
  assert.ok(says(done, "screen.question.reeval.done", { name: "ann", date: day(closed.closed_at), note: closed.note }) && says(done, "screen.question.reeval.done.meta", { what: await titleOf(w.as, w.document) }), "a closed cause: who, when and what was decided");
  assert.equal(main(p).querySelector('#reeval [data-reeval="open"]'), null);
  /* "See what needs a second look" reads again */
  const before = p.byOp("reevaluations").length;
  await press(p, "reevaluations", { within: main(p).querySelector("#reeval") });
  assert.ok(p.byOp("reevaluations").length > before, "read again");
});

test("R103 control: a finding with no reminder draws none (R20); an empty note sends nothing; the owner's refusal is drawn by its words; a reminder for another question is not this one's", async () => {
  const quiet = await stateWorld({ n: 1 });
  const none = await quiet.page();
  assert.equal(main(none).querySelector("#reeval"), null);
  assert.ok(!actsIn(main(none)).includes("reevaluationrecord") && !actsIn(main(none)).includes("reevaluations"));
  /* a second question of the project resting on the same page: the record holds a reminder for each, and each page draws its own */
  const w = await changedWorld();
  const other = (await w.world.recipes.question(w.as, w.project, { title: "Another reading", text: "Is it so?", legs: [{ target: w.document, role: "supports" }], draw: true })).id;
  assert.ok((await obligationsOf(w, other)).length > 0 && (await obligationsOf(w, w.question)).length > 0, "a reminder for each question");
  const own = await w.page();
  assert.equal(main(own).querySelectorAll('#reeval [data-reeval="open"]').length, (await obligationsOf(w, w.question))[0].causes.length, "this question's alone");
  const p = await w.page(other);
  const s = main(p).querySelector("#reeval");
  assert.ok(says(await press(p, "reevaluationrecord", { within: s }), "screen.question.reeval.refused.body"), "no note");
  assert.equal(p.byOp("reevaluationrecord").length, 0);
  /* the cause is looked at by her real act after the page was drawn: the page still offers it, and the owner refuses */
  const cause = (await obligationsOf(w, other))[0].causes[0];
  await w.as.act("reevaluationrecord", { body: { dependent: other, target: w.document, source: cause.source, since: cause.since, note: "Looked." } });
  fill(p, { "question-reeval-note": "Looked." });
  const slot = await press(p, "reevaluationrecord", { within: s });
  assert.ok(says(slot, "screen.question.reeval.refused.body2"), "nothing stands now: the list is read again");
  assert.ok(says(s, "screen.question.reeval.refused.summary"), "the refusals' fold");
  for (const k of ["screen.question.reeval.heading", "screen.question.reeval.edition", "screen.question.reeval.edition.meta", "screen.question.reeval.done", "screen.question.reeval.done.meta", "screen.question.reeval.note.label",
    "screen.question.reeval.refused.summary", "screen.question.reeval.refused.body", "screen.question.reeval.refused.body2", "screen.question.reeval.help", "screen.question.reeval.help2",
    "act.reevaluationrecord.label.question", "act.reevaluations.label.question"]) assert.ok(hasWord(k), k);
});

/* ------------------------------------------------------------------------------------------------------------------ R104 */

/* fix round 2, C34: the state move is for a question whose own state is concluded; one concluded within a project is withdrawn (fr2-question.test.mjs) */
const OWN_CONCLUDED = { images: { [Q]: { "bundle.md": grouped().replace("object_type: inquiry\n", "object_type: inquiry\ncurrent_state: concluded\n") } } };

test("R104 a concluded question offers 'Reopen this finding, with a reason', the reason required: sent as the target and the reason; an empty reason sends nothing", async () => {
  /* the question's own state concluded, by her real conclusion with no project */
  const w = await stateWorld({ n: 1 });
  await w.ann.act("conclude", { query: { target: w.id, reading: "Yes: repairs are made within seven days.", falsifier: "Work orders dated later show otherwise." } });
  const p = await w.page();
  const fold = main(p).querySelector("details[data-reopen]");
  assert.ok(fold && says(fold.querySelector("summary"), "screen.question.reopen.summary"));
  assert.deepEqual(rawKeys(fold), [], "every sentence the reopen fold draws is a held word");
  assert.ok(says(await press(p, "reopen", { within: fold }), "screen.question.reopen.refused.noreason"), "required");
  assert.equal(p.byOp("reopen").length, 0);
  fill(p, { "question-reopen-why": "a later audit corrects the figure" });
  await press(p, "reopen", { within: fold });
  const q = p.byOp("reopen")[0].query;
  assert.deepEqual([q.target, q.reason], [w.id, "a later audit corrects the figure"]);
  /* control: an open question offers none */
  const v = await stateWorld({ n: 1 });
  const open1 = await v.page();
  assert.ok(!actsIn(main(open1)).includes("reopen"));
  assert.equal(main(open1).querySelector("details[data-reopen]"), null);
});

test("R104 the owner's refusals are drawn by the design's words: no reason, a reason that cannot be kept, a finding in no published case", async () => {
  for (const [code, key] of [["NO_REASON", "screen.question.reopen.refused.noreason"], ["BAD_REASON", "screen.question.reopen.refused.badreason"], ["NOT_SET_DOWN", "screen.question.reopen.refused.notsetdown"]]) {
    const p = await open(at, { ...OWN_CONCLUDED, plane: { basisversions: CONCLUDED, reopen: refusedIn(code) } });
    fill(p, { "question-reopen-why": "a reason" });
    assert.ok(says(await press(p, "reopen", { within: main(p).querySelector("details[data-reopen]") }), key), code);
  }
  const open1 = await open(at, { ...A, plane: { basisversions: CONCLUDED } });
  /* a published case that carries it offers the way to the next edition */
  const c = await open(at, { ...A, plane: { basisversions: CONCLUDED, backlinks: (r) => ok({ ok: true, target: r.query.target, backlinks: r.query.target === Q ? [{ from: "CASE-2026-0001", from_type: "published", from_title: "Street safety" }] : [] }) } });
  assert.ok(says(main(c).querySelector("details[data-reopen]"), "screen.question.reopen.next.link", { link: word("screen.question.reopen.next.link.text") }), "the docket, where the next edition is started");
  assert.ok(!main(open1).textContent.includes(word("screen.question.reopen.next.link.text")), "control: none when no published case carries it");
});

/* ------------------------------------------------------------------------------------------------------------------ R10 */

test("R10 question draws exactly its registry acts: each act the registry lists (the owed ones by their op, R110) is an act of the screen, and the screen has no other; the writing help is drawn only while the assistant is reachable", async () => {
  const reg = REGISTRY.screens.find((s) => s.id === "question").acts.map((a) => a.op.replace(/^owed:(\w+) DEC-\d+$/, "$1"));
  const screen = SCREENS.find((s) => s.id === "question");
  assert.deepEqual(screen.acts.map((a) => a.op).sort(), [...reg].sort());
  for (const op of ["reopen", "hypothesisrevise", "hypothesiswithdraw", "inquirydivide", "reevaluationrecord", "reevaluations", "writinghelp"])
    assert.equal(screen.acts.find((a) => a.op === op).label, `act.${op}.label.question`, op);
  const bare = await stateWorld({ n: 1 });
  const off = await bare.page();
  assert.ok(!actsIn(main(off)).includes("writinghelp"));
  /* reachable. T53 retired the door ops that set and switched on the team's key (`groupkeyset`, `groupkeyswitch`,
     `groupkeynoticeseen`; ai-accounts R35, op-declarations PR 95), and the assembled store holds ai-accounts with no
     catalogue (t48.test.mjs), so who serves her is ai-accounts' real service's `accountsof` (fixtures.mjs' `aiAccounts`),
     the team's key on, and the shell's reachability reads (interface-shell R20: `assistantstate`, `aipathready`) answer
     the assistant on with a ready path, over the world's door; every other read and act is the world's. */
  const world = await storeWorld({ ai: true });
  const w = await stateWorld({ n: 1, world });
  const { accountsOf } = await aiAccounts();
  const reads = (on, state) => ({ assistantstate: ok({ on }), aipathready: ok({ state }), accountsof: accountsOf() });
  const on = await w.page({ plane: reads(true, "ready") });
  assert.ok(actsIn(main(on)).includes("writinghelp"), "reachable: the help is drawn");
  assert.deepEqual(rawKeys(on.root()), []);
  /* control, on the same world with the same accounts: the assistant switched off, or its path not ready, draws no help */
  for (const [o, st] of [[false, "ready"], [true, "unready"]])
    assert.ok(!actsIn(main(await w.page({ plane: reads(o, st) }))).includes("writinghelp"), `not reachable (on ${o}, path ${st}): no help`);
});
