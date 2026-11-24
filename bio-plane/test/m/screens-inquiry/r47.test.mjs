/* screens-inquiry R47 and R48 (R085-24; K3510; WALK-085 r4): the question page draws its run beside waiting proposals and
 * finds a running run on load; the dock draws her latest ended run. On interface-shell's served page over the real world; every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ok } from "../interface-shell/harness.mjs";
import { storeWorld, WORLD_FOUNDER_HANDLE, main, actsIn, button, says, section, word, BASIS, SCREENS } from "./fixtures.mjs";

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
  await who.act("airunopen", { body: { run, contextType: "inquiry", contextId: w.id, skillVersion: "investigative-session@1", principalClaude: `member:${who.member}`, mode: "check" } });
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

const proposed = { name: "Proposed", state: "suggested", author: "class:ai/t", run: "RUN-1", claim: { text: "About 9 in 10 within seven days." }, grounds: [],
  legs: [{ target_id: "INFO-2026-0004", target_title: "the 2026 performance report" }] };
const withProposal = { basisversions: (r) => ok({ ...BASIS(), versions: [...BASIS().versions, proposed],
  ...(r.query.project ? { current: { project: r.query.project, version: "main", at: "2026-10-06T09:00:00Z", by: "dev" } } : {}) }) };

/* the machine's proposal is scripted over the world (needed: a question holding a suggested machine reading, with its run) */
test("R47 an ended run with proposals waiting draws the ending and the ask above them", async () => {
  const w = await stateWorld({ n: 1 });
  await (await openRun(w)).end("wallclock");
  const p = await w.page({ plane: withProposal });
  const m = main(p);
  const text = m.textContent;
  const end = text.indexOf(word("screen.assistant.run.ended", { why: word("ai.run.ending.wallclock") }));
  const prop = text.indexOf(word("question.proposal.heading"));
  assert.ok(end >= 0 && prop >= 0, "both are drawn");
  assert.ok(end < prop, "the ending stands above the proposals");
  assert.ok(section(p, "question.proposal.heading"), "the proposal is still drawn");
  const ask = m.querySelector('[data-run="ended"]');
  assert.deepEqual(actsIn(ask).filter((a) => a === "airunopen"), ["airunopen"], "the ask is offered with the ending");
  /* a state-c question (nothing cited) with waiting proposals says the ending too */
  const e = await stateWorld();
  await (await openRun(e)).end("wallclock");
  const c = await e.page({ plane: withProposal });
  assert.ok(says(section(c, "question.empty.heading"), "screen.assistant.run.ended", { why: word("ai.run.ending.wallclock") }));
});

test("R47 a running run found on load, not pressed on this page, draws state d and is read again until it ends", async () => {
  const w = await stateWorld({ n: 1 });
  const run = await openRun(w);
  const p = await w.page();
  let d = section(p, "question.run.heading");
  assert.ok(d, "state d is drawn for a run the page did not start");
  assert.ok(says(d, "screen.assistant.run.running", { ticks: "1" }));
  assert.deepEqual(actsIn(d), ["airunclose"]);
  const reads = () => p.byOp("airuns").length;
  const n = reads();
  await run.tick(); await run.tick();
  await p.clock.tick(9000);
  assert.equal(reads(), n, "not read again within 10 seconds");
  await p.clock.tick(1000);
  await p.settle();
  assert.equal(reads(), n + 1, "read again after 10 seconds");
  assert.ok(says(section(p, "question.run.heading"), "screen.assistant.run.running", { ticks: "3" }));
  await run.end("wallclock");
  await p.clock.tick(10000);
  await p.settle();
  assert.equal(section(p, "question.run.heading"), undefined);
  assert.ok(says(main(p), "screen.assistant.run.ended", { why: word("ai.run.ending.wallclock") }));
  const after = reads();
  await p.clock.tick(30000);
  assert.equal(reads(), after, "reading stops once it has ended");
  /* another member's running run is not hers */
  const x = await stateWorld({ n: 1 });
  await openRun(x, { who: await joined(x, "ben") });
  const other = await x.page();
  assert.equal(section(other, "question.run.heading"), undefined);
});

test("R47 control: no run, with proposals pending, draws the proposals as before and no ending", async () => {
  const w = await stateWorld({ n: 1 });
  const p = await w.page({ plane: withProposal });
  assert.ok(section(p, "question.proposal.heading"));
  assert.equal(main(p).querySelector('[data-run="ended"]'), null);
  assert.equal(section(p, "question.run.heading"), undefined);
});

/* ---- R48: the dock ---- */
async function dock(w) {
  const p = await w.page();
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  return p;
}
const panel = (p) => p.root().querySelector(".cs-dock");

test("R48 two ended runs draw the later's ending, not \"No run yet\"; the ask is offered", async () => {
  const w = await stateWorld({ n: 1 });
  await (await openRun(w)).end("cancelled");
  /* a run is stamped to the second by the wall clock, which the world does not move: the later run waits a second */
  await new Promise((r) => setTimeout(r, 1100));
  await (await openRun(w)).end("wallclock");
  const p = await dock(w);
  assert.ok(says(panel(p), "screen.assistant.run.ended", { why: word("ai.run.ending.wallclock") }));
  assert.ok(!says(panel(p), "screen.assistant.run.ended", { why: word("ai.run.ending.cancelled") }));
  assert.ok(!says(panel(p), "screen.assistant.run.none"));
  assert.ok(button(p, "airunopen", panel(p)), "Work on this is offered again");
  /* an ended run with no condition, named by its status alone, is a state no act makes (a run ends only by a named bound: AI_RUN_BOUND_UNNAMED, run-rules/rules.mjs:485-489; ai-runs/index.mjs:590-593;
     its expiry reads real time, which `tick` does not age), so that case is not tested; another member's ended run is not hers */
  const y = await stateWorld({ n: 1 });
  await (await openRun(y, { who: await joined(y, "ben") })).end("cancelled");
  const other = await dock(y);
  assert.ok(says(panel(other), "screen.assistant.run.none"));
});

test("R48 control: no run of hers draws \"No run yet\"", async () => {
  const w = await stateWorld({ n: 1 });
  const p = await dock(w);
  assert.ok(says(panel(p), "screen.assistant.run.none"));
  assert.ok(!panel(p).querySelector('[data-run="ended"]'));
});
