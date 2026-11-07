/* screens-inquiry R50, R51, R55, R56, R57, R58, R59, R62, R64 (T50-32): the question page's own reading, its three steps, a
 * concluded question's case, how a run ends and what it cost, its progress as it is made, the affirmation of a reading of
 * several parts, and the stopped run's decline; the document page's held copy and themes. On interface-shell's served page
 * over a scripted plane. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { storeWorld, WORLD_FOUNDER_HANDLE, main, actsIn, press, fill, says, section, word, SCREENS } from "./fixtures.mjs";

/** A project with `n` held documents and a question in it resting on them, drawn into the project: all by real acts over the world.
 *  Answers `{world, ann, project, docs, id, page(opts)}`; `page` boots the question's page over the world (`plane` overrides only the ops it names). */
const stateWorld = async ({ n = 1, world = null } = {}) => {
  world = world || await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  const docs = [];
  for (let i = 0; i < n; i++) docs.push((await world.recipes.hold(ann, "Passage " + (i + 1), "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const made = docs.map((target) => ({ target, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" }));
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: made, draw: true })).id;
  const page = async (o = {}, who = ann) => {
    const { door, session } = world.boot(who);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, ...o });
    await p.settle();
    return p;
  };
  return { world, ann, project, docs, id, page };
};
/** the team's Claude account, by the administrator's real acts (the world made with `storeWorld({ ai: true })`): her password again, the team's key set and switched on, its notice read */
const aiTeam = async (world) => {
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  await admin.act("reauth", { body: { password: admin.password } });
  await admin.act("groupkeyset", { body: { key: "sk-ant-api03-" + "w".repeat(40) } });
  await admin.act("groupkeyswitch", { body: { on: true } });
  await admin.act("groupkeynoticeseen", { body: {} });
  return admin;
};
/** a run of the member's own over the question, opened by her real act (`airunopen`: running, before anything dispatches it); the member reads the team's notice first */
let runs = 0;
const openRun = async (w, who = w.ann, run = "RUN-" + String(++runs).padStart(16, "c")) => {
  await who.act("groupkeynoticeseen", { body: {} });
  await who.act("airunopen", { body: { run, contextType: "inquiry", contextId: w.id, skillVersion: "investigative-session@1", principalAi: `member:${who.member}`, mode: "check" } });
  return run;
};
/** a reading of two separately sufficient parts that is suggested, by her real acts: the passages grouped into two parts (`inquiryground`), a reading accepted with both parts affirmed, withdrawn, turned down and put back (`versionrevert`) */
const twoParts = async (w) => {
  const grounds = [{ ground: "part 1", legs: [0] }, { ground: "part 2", legs: [1] }];
  const q = { target: w.id, project: w.project };
  await w.ann.act("inquiryground", { body: { target: w.id, grounds } });
  await w.ann.act("conclude", { query: { ...q, reading: "The count is about four hundred.", falsifier: "records showing otherwise", affirmed: "part 1,part 2" } });
  await w.ann.act("withdrawconclusion", { query: { ...q, reason: "to make it suggested again" } });
  await w.ann.act("versionreject", { query: { ...q, version: "reading-1", reason: "set aside once for now" } });
  await w.ann.act("versionrevert", { query: { ...q, version: "reading-1" } });
  return "reading-1";
};
const steps = (p) => main(p).querySelectorAll("[data-steps] li").map((li) => [li.getAttribute("data-step"), li.getAttribute("data-state")]);

test("R50 Conclude takes a member's own reading: reading is sent in place of version; an empty reading is refused in place and nothing is sent", async () => {
  /* the real state: a question resting on a held passage, no reading made for it, so her own is the choice */
  const w = await stateWorld();
  const p = await w.page();
  assert.equal(p.doc.getElementById("question-conclude-reading").value, "", "no reading stands: her own is the choice");
  assert.ok(says(p.doc.getElementById("question-conclude-reading"), "question.conclude.own.choice"));
  assert.ok(p.doc.getElementById("question-conclude-own"), "Your reading");
  fill(p, { "question-conclude-falsifier": "records showing repair", "question-conclude-own": "", "question-conclude-reason": "my reason", "question-conclude-commentary": "my note" });
  await press(p, "conclude");
  assert.equal(p.byOp("conclude").length, 0, "an empty reading sends nothing");
  fill(p, { "question-conclude-own": "Most reports are repaired within seven days." });
  await press(p, "conclude");
  const q = p.byOp("conclude")[0].query;
  assert.equal(q.reading, "Most reports are repaired within seven days.");
  assert.ok(!("version" in q), "reading in place of version");
  /* a conclusion on a member's own reading names who wrote it, never marked machine work (the conclusion the press just made, read again) */
  const g = await w.page();
  const sec = section(g, "question.concluded.heading");
  assert.ok(sec, "the conclusion is drawn");
  assert.ok(says(sec, "question.reading.by.member", { member: w.ann.member }));
  assert.equal(sec.querySelector('[data-origin="machine"]'), null);
});

test("R51 the three steps: each state draws its step as current; the new question draws the three buttons and no Concluding section; secondary acts fold under more", async () => {
  /* the real states, by her acts over a question in a project: no passage cited, a passage cited and a reading put under consideration (none accepted), a reading accepted, the conclusion made */
  const e = await stateWorld({ n: 0 });
  const empty = await e.page();
  assert.deepEqual(steps(empty), [["source", "current"], ["mark", "todo"], ["conclude", "todo"]]);
  assert.equal(section(empty, "screen.question.concluding.head"), undefined);
  assert.equal(empty.root().querySelector('[data-adddoc="question"]').getAttribute("data-tone"), "primary");
  assert.ok(says(main(empty), "question.empty.conclude.own"));
  const w = await stateWorld();
  const q = { target: w.id, project: w.project };
  const reading = { ...q, reading: "Most reports are repaired within seven days.", falsifier: "records showing otherwise" };
  const cited = await w.page();
  assert.deepEqual(steps(cited), [["source", "done"], ["mark", "current"], ["conclude", "todo"]]);
  await w.ann.act("conclude", { query: reading });
  await w.ann.act("withdrawconclusion", { query: { ...q, reason: "to weigh it first" } });
  await w.ann.act("versionconsider", { query: { ...q, version: "reading-1", reason: "we are weighing it" } });
  const ask = await w.page();
  assert.deepEqual(steps(ask), [["source", "done"], ["mark", "current"], ["conclude", "todo"]]);
  await w.ann.act("versionaccept", { query: { ...q, version: "reading-1" } });
  const stands = await w.page();
  assert.deepEqual(steps(stands), [["source", "done"], ["mark", "done"], ["conclude", "current"]]);
  const more = main(stands).querySelector('details[data-fold="more"]');
  assert.ok(says(more.querySelector("summary"), "question.more"));
  assert.deepEqual(actsIn(more).sort(), ["checkrequest", "inquirydivide", "planopen", "proposedispose", "search"], "R71: set aside for the project is among them");
  await w.ann.act("conclude", { query: reading });
  const done = await w.page();
  assert.deepEqual(steps(done), [["source", "done"], ["mark", "done"], ["conclude", "done"]]);
});

test("R62 a concluded question offers a case: casedraft with the project and the question as the one target, no case; not concluded, none", async () => {
  const w = await stateWorld();
  /* not concluded: none */
  const n = await w.page();
  assert.ok(!actsIn(main(n)).includes("casedraft"));
  /* concluded by her real act (a reading of her own, within the project, as the page's press carries it) */
  await w.ann.act("conclude", { query: { target: w.id, project: w.project, reading: "Most reports are repaired within seven days.", falsifier: "records showing otherwise" } });
  const p = await w.page();
  assert.deepEqual(actsIn(section(p, "question.concluded.heading")), ["casedraft", "planopen", "withdrawconclusion"]);
  await press(p, "casedraft");
  const b = p.byOp("casedraft")[0].body;
  assert.deepEqual([b.project, b.targets, "caseId" in b, "newCase" in b], [w.project, [w.id], false, false]);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R57 a run ends in the ending's own words, never its code; the cost to the owner only; a stopped run says what was kept", async () => {
  /* a run ending with a code the words do not know cannot exist: airunclose refuses a bound that names none (AI_RUN_BOUND_UNNAMED, run-rules/rules.mjs:485-489; ai-runs/index.mjs:590-593) */
  for (const [bound, key] of [["wallclock", "ai.run.ending.wallclock"], ["cancelled", "ai.run.ending.cancelled"]]) {
    /* the real state: her run opened and closed with the ending, by the acts the page makes */
    const world = await storeWorld({ ai: true });
    await aiTeam(world);
    const w = await stateWorld({ world });
    const run = await openRun(w);
    await w.ann.act("airunclose", { body: { run, bound } });
    const p = await w.page();
    assert.ok(says(main(p), "screen.assistant.run.ended", { why: word(key) }), bound);
    assert.ok(!main(p).textContent.includes("ai.run.ending"), "the code is never drawn");
    assert.equal(!!main(p).querySelector('[data-run="stopped"]'), bound === "cancelled", "R64: only a stopped run says what was kept");
  }
  /* the cost: the model's calls counted under the run's id by the run's own ticks (`airuntick` with its usage), a run closed after; the account is the team's, so its owner (the administrator) reads the cost of her run, and a member who is not an owner reads none of hers */
  /* each in a world of its own: the page draws her newest run, and two runs of one second are not told apart */
  const closed = async (member, usage) => {
    const world = await storeWorld({ ai: true });
    const admin = await aiTeam(world);
    const w = await stateWorld({ world });
    const who = member === "admin" ? admin : w.ann;
    const run = await openRun(w, who);
    await who.act("airuntick", { body: { run, usage, log: [] } });
    await who.act("airunclose", { body: { run, bound: "completed" } });
    return w.page({}, who);
  };
  const call = { mode: "ask", usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: 0.42 }, calls: 3 };
  const owner = await closed("admin", [call]);
  assert.ok(says(main(owner), "screen.assistant.run.cost.final", { cost: word("ai.run.cost.money", { amount: "$0.42", calls: 3 }), account: word("ai.run.cost.on.team") }));
  /* a call that states no money (total_cost_usd null) is counted in tokens */
  const tokens = await closed("admin", [{ ...call, usage: { ...call.usage, total_cost_usd: null } }]);
  assert.ok(says(main(tokens), "ai.run.cost.tokens", { tokens: 1200, calls: 3 }));
  const other = await closed("ann", [call]);
  assert.equal(main(other).querySelector('[data-run="cost"]'), null, "no cost line for a member who does not own the account");
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R58 airunopen carries the question's project", async () => {
  /* a log whose rows carry the progress fields (read, found, checked) cannot exist: the entries the run's log holds carry seq, at, level, subject, state, governed, condition, bound, terminal, detail, result_kind, result_ref and coverage only (ai-runs/index.mjs:3094-3118) */
  const world = await storeWorld({ ai: true });
  await aiTeam(world);
  const w = await stateWorld({ world, n: 0 });
  await w.ann.act("groupkeynoticeseen", { body: {} });
  const o = await w.page();
  await press(o, "airunopen");
  assert.equal(o.byOp("airunopen")[0].body.project, w.project);
});

test("R59 R64 accepting a reading of several parts asks each part; Decline sends the version's reject with its reason", async () => {
  /* the real state: a reading of two separately sufficient parts, suggested again by her acts */
  const w = await stateWorld({ n: 2 });
  const name = await twoParts(w);
  const p = await w.page();
  const row = section(p, "question.readings.title").querySelector(`[data-reading="${name}"]`);
  assert.ok(says(row, "reading.affirm.head") && says(row, "reading.affirm.says", { n: 2 }) && says(row, "reading.affirm.part", { part: "part 1" }));
  p.doc.getElementById("affirm-0-0").checked = true;
  await press(p, "versionaccept", { within: row });
  assert.deepEqual(p.byOp("versionaccept")[0].body.affirmed, ["part 1"], "the parts she ticked");
  /* a reading of one part asks none (the question's other reading, of its one passage) */
  const one = await stateWorld({ n: 1 });
  const q = { target: one.id, project: one.project };
  await one.ann.act("conclude", { query: { ...q, reading: "Most reports are repaired within seven days.", falsifier: "records showing otherwise" } });
  await one.ann.act("withdrawconclusion", { query: { ...q, reason: "to make it suggested again" } });
  await one.ann.act("versionreject", { query: { ...q, version: "reading-1", reason: "set aside once for now" } });
  await one.ann.act("versionrevert", { query: { ...q, version: "reading-1" } });
  const single = await one.page();
  assert.equal(single.doc.getElementById("affirm-0"), null);
});

test("R55 R56 the document: a held copy is vouched for and replaced by the vouched line; a placement in a theme is drawn apart from evidence", async () => {
  /* the real state: a copy she captured by her own upload (held until she vouches for it), placed in a theme she declared */
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const held = await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.");
  const made = await ann.act("themedeclare", { body: { name: "Deferred maintenance", test: "the document concerns deferred maintenance" } });
  await ann.act("themeplace", { body: { theme: made.theme_id, target: held.bundle, note: "ref" } });
  const at = "/app/document/" + held.bundle;
  const pageOf = async (who) => {
    const { door, session } = world.boot(who);
    const page = await boot({ screens: SCREENS, door, session, path: at });
    await page.settle();
    return page;
  };
  const p = await pageOf(ann);
  assert.ok(says(main(p), "document.held.says"));
  assert.ok(main(p).textContent.includes("Deferred maintenance") && says(main(p), "theme.never.evidence"));
  fill(p, { "document-release-ack": "I read it", "document-release-mitigation": "none" });
  await press(p, "release");
  assert.ok(!says(main(p), "document.held.says") && main(p).querySelector("[data-vouched]"), "replaced at once by the vouched line");
  assert.ok(actsIn(main(p)).includes("attest") && main(p).querySelector('details[data-fold="retire"]'), "attest and a folded retire at the foot");
  /* control: a document the viewer did not capture draws no held banner */
  const theirs = await world.recipes.hold(ann, "Her own memo", "Held by Ann alone.");
  const rosa = await world.signIn("rosa", { capabilities: ["contribute", "create_projects"] });
  const { door, session } = world.boot(rosa);
  const o = await boot({ screens: SCREENS, door, session, path: "/app/document/" + theirs.bundle });
  await o.settle();
  assert.ok(main(o).textContent.includes("Her own memo"), "the document itself is drawn");
  assert.equal(main(o).querySelector("[data-held]"), null);
});
