/* question-explorer: choosing what is worth exploring and opening the run (R1, R2, R3's run path and sign-in, R9's
   choice, R12's estimate). Each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, Q, Q2, Q3, PROJ, ENT, PERSON, CAP, DOC } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { EXPLORE_QUESTIONS_PER_TICK, EXPLORE_BOUNDS } from "../../../src/question-explorer/index.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";

test("R1: exploreDue, exploreWake and exploreTick for the scheduler; exploreAllowed decides each owner and question; null opens one run, at most one a question a day", async () => {
  const w = await world().standard();
  await w.setExplore("group", "yes");
  assert.equal(await w.p.exploreDue(w.clock.now), 1);
  assert.equal(await w.p.exploreWake(w.clock.now), w.clock.now, "due now, answered in now's own form");
  assert.equal(await w.p.exploreWake(Date.parse(w.clock.now)), Date.parse(w.clock.now));
  const t = await w.p.exploreTick(w.clock.now);
  assert.equal(t.opened.length, 1);
  assert.deepEqual(w.calledAs("exploreAllowed").map((a) => [a.owner, a.question]), [["group", Q]]);
  /* Negative control: the same day, nothing more is due, and a second tick opens nothing. */
  assert.equal(await w.p.exploreDue(w.clock.now), 0);
  assert.equal(await w.p.exploreWake(w.clock.now), null);
  assert.equal((await w.p.exploreTick(w.clock.now)).opened.length, 0);
  assert.equal(w.calledAs("open").length, 1);
});

test("R1: a refusal from exploreAllowed opens nothing and the next owner is asked; {ask: true} records exploreAsk with the questions and their estimate, and nothing runs that day without approval", async () => {
  const w = await world().standard();
  w.question(Q2, { recipients: ["alice"] });
  w.draw(Q, PROJ);
  w.project(PROJ, ["alice"], { owners: ["alice"] });
  await w.setExplore("group", "no");
  await w.setExplore(`project:${PROJ}`, "ask");
  const t = await w.p.exploreTick(w.clock.now);
  assert.equal(t.opened.length, 0, "nothing runs without approval");
  assert.equal(w.calledAs("open").length, 0);
  const asks = w.calledAs("exploreAsk");
  assert.equal(asks.length, 1, "one Ask per owner per tick");
  assert.equal(asks[0].owner, `project:${PROJ}`);
  assert.deepEqual(asks[0].what, [Q], "the questions worth exploring");
  /* R12: the Ask item its owners read carries ai-use R10's estimate, as ai-use itself answers it for that account (here, no
     run measured yet); this module's own answer says "not known yet". */
  const [item] = w.realAiUse.exploreAsksPending({ viewer: "member:alice", at: w.clock.now }).asks;
  const r10 = w.realAiUse.estimate({ owner: `project:${PROJ}`, use: "explore", mode: "explore", count: 1, viewer: "member:alice" }).estimate;
  assert.deepEqual([item.owner, item.what, item.estimate], [`project:${PROJ}`, [Q], r10]);
  /* The Ask names the account ai-use decides on (ai-use R9 as T53 states it). */
  assert.equal(asks[0].account_id, w.aiAccounts.accountUsesOf({ owner: `project:${PROJ}` }).account_id);
  assert.equal(typeof asks[0].account_id, "string");
  assert.equal(t.asked[0].estimate, word("question-explorer.known"));
  /* The Ask waits an hour before it is looked at again (Q2, refused by every owner, not again that day); then,
     approved, the run opens that day. */
  assert.equal(await w.p.exploreDue(w.clock.now), 0);
  assert.equal(await w.p.exploreWake(w.clock.now), "2026-10-10T10:00:00Z");
  w.approve(`project:${PROJ}`);
  w.clock.now = "2026-10-10T10:00:00Z";
  const t2 = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(t2.opened.map((o) => [o.question, o.owner]), [[Q, `project:${PROJ}`]]);
});

test("R2: worth exploring: open or surfaced, at least one member receives its finds, and never explored or a capture resolving to its subject entity gained since its last run; bounded at 200 a tick", async () => {
  const w = await world().standard();
  w.entity(ENT, "body");
  w.question(Q2, { subject: ENT, recipients: ["bob"] });
  w.question(Q3, { recipients: [] });
  w.bundle("INQ-2026-0004-t", "inquiry", null, { state: "concluded" });
  const ids = () => w.p.questionsWorthExploring({ at: w.clock.now }).map((x) => x.question);
  assert.deepEqual(ids().sort(), [Q, Q2].sort(), "Q3 has no recipient; a concluded question is not open or surfaced");
  w.bundle(Q3, "inquiry", null, { state: "surfaced" });
  w.follow(Q3, "carol");
  assert.ok(ids().includes(Q3), "surfaced counts");
  await w.setExplore("group", "yes");
  await w.p.exploreTick(w.clock.now);
  w.clock.now = "2026-10-11T09:00:00Z";
  /* Negative control: explored, with no new capture of its subject, Q2 is not worth exploring again. */
  assert.deepEqual(ids(), []);
  w.resolve(CAP, DOC, ENT);
  assert.deepEqual(ids(), [Q2], "a capture resolving to Q2's subject entity since its last run");
  assert.equal(EXPLORE_QUESTIONS_PER_TICK, 200);
  for (let i = 10; i < 230; i++) w.question(`INQ-2026-${String(i).padStart(4, "0")}-x`, { recipients: ["alice"] });
  assert.ok(w.p.questionsWorthExploring({ at: w.clock.now }).length <= 200, "at most 200 read a tick");
});

test("R2: R9 holds before it: a question about a person no member tied is never chosen; one a member raised about that person is", async () => {
  const w = await world().standard();
  w.entity(PERSON, "person");
  w.question(Q2, { subject: PERSON, surfacedBy: "agent", recipients: ["alice"] });
  w.question(Q3, { subject: PERSON, surfacedBy: "human", recipients: ["alice"] });
  const ids = w.p.questionsWorthExploring({ at: w.clock.now }).map((x) => x.question);
  assert.ok(!ids.includes(Q2), "machine-surfaced, about a person no member tied");
  assert.ok(ids.includes(Q3), "negative control: a member raised it about that person");
});

test("R3: the run opens through ai-runs in the investigate run path, origin explore, use explore, the paying owner its principal and ai-use R6's label, as a system step on the question that ai-runs creates once the run is open (K2490)", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  const [open] = w.calledAs("open");
  assert.deepEqual([open.mode, open.origin, open.use, open.principalAi, open.contextType, open.contextId],
                   ["investigate", "explore", "explore", "group", "inquiry", Q]);
  assert.equal("step" in open, false, "this module passes no step of its own");
  assert.deepEqual([open.place, typeof open.work], [{ questions: [Q] }, "string"], "it passes the step's place and work");
  /* F1 (K5821): the run carries the member who turned exploring on (dana, the group's administrator), not ai-use's label. */
  assert.equal(open.enabledBy, "member:dana");
  assert.deepEqual(o.label, { kind: "machine", enabled_by: "group" }, "ai-use R6's label still marks the run's finds");
  assert.deepEqual(open.bounds.map((b) => b.bound), EXPLORE_BOUNDS.map((b) => b.bound));
  assert.ok(open.bounds.some((b) => b.bound === "pages"), "R13's pages bound declared");
  assert.match(o.step, /^STP-/);
  assert.equal(o.step, w.runs.get(o.run).step, "the step ai-runs created, kept with the run");
  assert.deepEqual(w.realSteps.step({ step: o.step, viewer: "member:alice" }).place, { questions: [Q] }, "a step on the question, in the real steps");
  assert.equal(w.calledAs("stepCreate")[0].run, o.run, "created for the open run");
  /* Negative controls: a refused open, and an open that answers no step, leave no run. */
  const w2 = await world().standard();
  w2.openRefuse = { ok: false, code: "AI_RUN_MODE_NOT_DEPLOYED" };
  await w2.setExplore("group", "yes");
  assert.equal((await w2.p.exploreTick(w2.clock.now)).opened.length, 0);
  assert.equal(w2.count("explore_runs"), 0);
  const w3 = await world().standard();
  w3.openRefuse = { ok: true, run: "x" };
  await w3.setExplore("group", "yes");
  assert.equal((await w3.p.exploreTick(w3.clock.now)).opened.length, 0);
  assert.equal(w3.count("explore_runs"), 0);
});

test("R3: a principal served by a sign-in explores only while that sign-in account's explore use is on; off (its default) it is refused as any account whose explore use is off (ai-accounts R14 and ai-use R6, the real modules; the sign-in held, ai-accounts R19)", async () => {
  /* (T53) A sign-in serves only the level its plan's scope names (ai-accounts R10, R42: a project's sign-in is refused, and
     a member's own account explores no question, ai-use R6), so the principal served by a sign-in here is the team's: its
     account a team-scope subscription of the catalogue's (the fixture's `teamSubscription` plan), set by an administrator,
     instead of the standard world's API key. */
  const w = world();
  for (const m of ["alice", "bob"]) w.member(m);
  w.member("dana", "admin");
  await w.catalogue.seeded;
  const set = await w.aiAccounts.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamSubscription, means: "issued",
                                               secret: "sk-ant-oat01-team-sign-in-0123456789", by: "member:dana" });
  assert.equal(set.ok, true, JSON.stringify(set));
  w.doc(DOC, CAP);
  w.question(Q, { recipients: ["alice"] });
  /* Off: the sign-in account's switch at its default, no: ai-use asked and refused, nothing opened. */
  const off = await w.p.exploreTick(w.clock.now);
  assert.equal(off.opened.length, 0);
  assert.equal(w.calledAs("open").length, 0);
  assert.ok(w.calledAs("exploreAllowed").some((a) => a.owner === "group"), "ai-use asked, and refused");
  /* On: set by the account's owner's own act. */
  w.clock.now = "2026-10-11T09:00:00Z";
  await w.setExplore("group", "yes");
  const on = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(on.opened.map((o) => o.owner), ["group"]);
  assert.equal(w.calledAs("open")[0].principalAi, "group");
  /* Negative control: switched back off by its owner's act, the next day opens nothing more. */
  w.clock.now = "2026-10-12T09:00:00Z";
  await w.setExplore("group", "no");
  assert.equal((await w.p.exploreTick(w.clock.now)).opened.length, 0);
  assert.equal(w.calledAs("open").length, 1);
});

test("R12: each Ask item and each run carries ai-use R10's estimate before", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  assert.equal(o.estimate, word("question-explorer.known"), "ai-use R10: no exploring run of this account measured yet");
  assert.deepEqual(w.calledAs("estimate")[0], { owner: "group", use: "explore", mode: "investigate", count: 1,
                                                 viewer: "member:dana", at: w.clock.now }, "read as the account's owner");
  assert.equal(w.p.runCost({ run: o.run, viewer: "member:dana" }).estimate, word("question-explorer.known"));
  assert.equal(w.p.runCost({ run: o.run, viewer: "member:alice" }), null, "negative control: not the account's owner");
});

test("R3: a member's account's explore switch is read through ai-accounts' in-plane accountUsesOf (its R17), never accountUses as that member; an account that cannot be read is refused before ai-use is asked (fail closed)", async () => {
  /* A stand-in over the real ai-accounts that records each read and, while `unreadable`, answers R17's fail-closed form. */
  const asked = [];
  const stand = { real: null, unreadable: false,
    accountUsesOf(a) { asked.push(["accountUsesOf", a]); return stand.unreadable ? { ok: true, owner: a.owner, held: null, uses: null, unreadable: true } : stand.real.accountUsesOf(a); },
    accountUses(a) { asked.push(["accountUses", a]); return stand.real.accountUses(a); },
    aiKeptAway(a) { return stand.real.aiKeptAway(a); } };
  const w = world({ aiAccounts: stand });
  stand.real = w.aiAccounts;
  await w.standard();
  /* Alice holds her own key (ai-accounts R1), its explore switch at yes by her own act. */
  assert.equal((await w.aiAccounts.accountReferenceSet({ member: "alice", kind: "apikey", secret: "sk-ant-alice", by: "member:alice" })).ok, true);
  await w.setExplore("member:alice", "yes");
  stand.unreadable = true;
  const t = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(asked.filter(([, a]) => a.owner === "member:alice"), [["accountUsesOf", { owner: "member:alice" }]],
                   "the in-plane read, with no viewer, once a tick");
  assert.ok(asked.every(([k, a]) => k === "accountUsesOf" && Object.keys(a).join() === "owner"), "every read in-plane, by owner");
  assert.equal(w.calledAs("exploreAllowed").some((a) => a.owner === "member:alice"), false, "refused here, ai-use not asked");
  assert.equal(t.refused, 2, "the group (its switch at no, by ai-use) and her unreadable account");
  /* Negative control: read, at yes, she is passed to ai-use to decide (ai-use R6). */
  w.clock.now = "2026-10-11T09:00:00Z";
  stand.unreadable = false;
  await w.p.exploreTick(w.clock.now);
  assert.equal(w.calledAs("exploreAllowed").some((a) => a.owner === "member:alice"), true);
  assert.equal(asked.some(([k]) => k === "accountUses"), false, "never asked as an owner it is not");
});
