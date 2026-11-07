/* screens-inquiry R45 (R085-6; K3477; WALK-085 F2): the question's own run, from the press to its end, on interface-shell's
 * served page over the real world. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ok } from "../interface-shell/harness.mjs";
import { storeWorld, WORLD_FOUNDER_HANDLE, main, actsIn, press, says, section, word, SCREENS } from "./fixtures.mjs";

/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): the team's Claude account is set up by its administrator's acts, a project and a
   question of ann's (with `n` documents it rests on) are made by hers, and the page is read over the world's door, `plane` scripting only the ops it names */
const OWN = { capabilities: ["contribute", "create_projects"] };
const stateWorld = async ({ n = 0 } = {}) => {
  const world = await storeWorld({ ai: true });
  const admin = await world.signIn(WORLD_FOUNDER_HANDLE);
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const docs = [];
  for (let i = 0; i < n; i++) docs.push((await world.recipes.hold(ann, "Passage " + (i + 1), "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: docs.map((target) => ({ target, role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture" })), draw: true })).id;
  await world.recipes.assistant(admin, { readers: [ann] });
  const page = async (o = {}, who = ann) => {
    const { door, session } = world.boot(who);
    const p = await boot({ screens: SCREENS, door, session, path: "/app/question/" + id, ...o });
    await p.settle();
    return p;
  };
  return { world, admin, ann, project, docs, id, page };
};
/** a run of `who` (default: ann) over the question, opened by her real act (`airunopen`: running); `end(bound)` closes it by hers (`airunclose`) and `tick()` counts one of the run's ticks (`airuntick`) */
let runs = 0;
const openRun = async (w, { who = w.ann, run = "RUN-" + String(++runs).padStart(4, "0") + "d".repeat(12) } = {}) => {
  await who.act("airunopen", { body: { run, contextType: "inquiry", contextId: w.id, skillVersion: "investigative-session@1", principalAi: `member:${who.member}`, mode: "check" } });
  return { run, tick: () => who.act("airuntick", { body: { run } }), end: (bound) => who.act("airunclose", { body: { run, bound } }) };
};
/** a member besides ann, joined to her project, who can then open a run of her own over the question */
const joined = async (w, handle) => {
  const other = await w.world.signIn(handle, OWN);
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle }, body: {} });
  await other.act("projectjoin", { query: { projectId: w.project }, body: {} });
  await other.act("groupkeynoticeseen", { body: {} });
  return other;
};

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 the press draws state d before airunopen answers, its stop disabled; a refusal then replaces it, drawn as R33 says", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const w = await stateWorld();
  /* the limit is scripted over the world (needed: a team whose Claude use has reached its limit) */
  const limit = { status: 200, json: { ok: true, result: { run: "x", started: false, code: "AI_LIMIT_REACHED", whose: "the team's", period: "monthly", when: "on 1 November" } } };
  const p = await w.page({ plane: { airunopen: async () => { await gate; return limit; } } });
  assert.equal(section(p, "question.run.heading"), undefined, "nothing at work before the press");
  await press(p, "airunopen");
  const d = section(p, "question.run.heading");
  assert.ok(d, "state d is drawn while airunopen is unanswered");
  assert.ok(says(d, "question.run.leave"));
  assert.equal(p.byOp("airunopen").length, 1);
  assert.ok(d.querySelector("button[disabled]"), "its act is disabled until the answers arrive");
  assert.deepEqual(actsIn(d), [], "no live act in it yet");
  assert.equal(p.byOp("airundispatch").length, 0);
  release();
  await p.settle();
  assert.equal(section(p, "question.run.heading"), undefined, "the refusal replaces state d");
  assert.ok(says(section(p, "question.empty.ask"), "ai.refused.limit.overall", { whose: "the team's", period: "monthly", when: "on 1 November" }));
  assert.equal(p.byOp("airundispatch").length, 0);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 a withheld dispatch replaces state d with its reason by key", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const w = await stateWorld();
  /* the open and the dispatch are scripted over the world: the world's own dispatch is withheld at once, so state d could not be seen while it waits (needed: a world with the agent worker bound, answering after a wait) */
  const p = await w.page({ plane: {
    airunopen: ok({ run: "x", started: true, status: "running" }),
    airundispatch: async () => { await gate; return ok({ run: "x", found: true, dispatched: false, status: "running", withheld: "AGENT_WORKER_UNBOUND" }); } } });
  await press(p, "airunopen");
  assert.ok(section(p, "question.run.heading"), "drawn while the dispatch is unanswered");
  release();
  await p.settle();
  assert.equal(section(p, "question.run.heading"), undefined);
  assert.ok(says(main(p).querySelector('[data-refusal="airundispatch"]'), "dock.withheld.AGENT_WORKER_UNBOUND"));
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 while the run works, airuns is read again at most once every 10 seconds and its ticks are drawn; its end is then stated", async () => {
  const w = await stateWorld();
  /* the run is opened by the press (the world's own airunopen); the dispatch is scripted (needed: a world with the agent worker bound), so the page draws it at work */
  const p = await w.page({ plane: { airundispatch: ok({ run: "x", found: true, dispatched: true, status: "running" }) } });
  await press(p, "airunopen");
  const run = p.byOp("airunopen")[0].body.run;
  const mineRun = { tick: () => w.ann.act("airuntick", { body: { run } }), end: (bound) => w.ann.act("airunclose", { body: { run, bound } }) };
  let d = section(p, "question.run.heading");
  assert.ok(d && says(d, "screen.assistant.run.running", { ticks: "1" }), "the run's ticks are drawn");
  assert.deepEqual(actsIn(d), ["airunclose"], "Stop the run, once the plane has answered");
  const reads = () => p.byOp("airuns").length;
  const n = reads();
  for (let i = 0; i < 3; i++) await mineRun.tick();
  await p.clock.tick(9000);
  assert.equal(reads(), n, "not read again within 10 seconds");
  await p.clock.tick(1000);
  await p.settle();
  assert.equal(reads(), n + 1, "read again once after 10 seconds");
  assert.ok(says(section(p, "question.run.heading"), "screen.assistant.run.running", { ticks: "4" }), "seen to move");
  await mineRun.end("wallclock");
  await p.clock.tick(10000);
  await p.settle();
  assert.equal(section(p, "question.run.heading"), undefined, "an ended run is not drawn at work");
  const s = section(p, "question.empty.heading");
  assert.ok(says(s, "screen.assistant.run.ended", { why: word("ai.run.ending.wallclock") }), "its ending is stated");
  assert.deepEqual(actsIn(s).filter((a) => a === "airunopen"), ["airunopen"], "and the ask is offered again, once");
  const after = reads();
  await p.clock.tick(30000);
  assert.equal(reads(), after, "no more reading once it has ended");
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 a run of hers that ended with no proposal draws the ending and the ask on a question that cites passages too", async () => {
  const w = await stateWorld({ n: 1 });
  await (await openRun(w)).end("cancelled");
  const p = await w.page();
  const m = main(p);
  assert.ok(says(m, "screen.assistant.run.ended", { why: word("ai.run.ending.cancelled") }));
  assert.equal(section(p, "question.run.heading"), undefined);
  assert.deepEqual(actsIn(m).filter((a) => a === "airunopen"), ["airunopen"]);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 another member's ended run is not hers", async () => {
  const w = await stateWorld();
  /* a run that ended with no condition, only a status, is a state no act makes: a run ends only by a named bound (AI_RUN_BOUND_UNNAMED, run-rules/rules.mjs:485-489; ai-runs/index.mjs:590-593),
     and its expiry reads real time, which `tick` does not age; that case is not tested */
  const ben = await joined(w, "ben");
  await (await openRun(w, { who: ben })).end("cancelled");
  const other = await w.page();
  assert.equal(main(other).querySelector('[data-run="ended"]'), null);
});

test.todo("[owed: ai-runs F1 must answer the pairless aipathready read (interface-shell R20); BOB 7 Nov] R45 control: a question with no run draws state c, with no ending and no run at work", async () => {
  const w = await stateWorld();
  const p = await w.page();
  assert.ok(section(p, "question.empty.heading"));
  assert.equal(main(p).querySelector('[data-run="ended"]'), null);
  assert.equal(section(p, "question.run.heading"), undefined);
  assert.deepEqual(actsIn(section(p, "question.empty.heading")).sort(), ["airunopen", "search"]);
});
