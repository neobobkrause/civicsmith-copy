/* scheduler — T41-49 (N820; K2405, K2417, K2418): R26, `question-explorer`'s consumer (its R1) and `investigation`'s
   quiet check (its R18). The first tests drive a stand-in shaped as question-explorer R1 states its services; the last
   drive the real question-explorer in its own test world and read the alarm. Each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULER_ORDER, SCHEDULER_KEYS, RANKED, DAILY, Scheduler, schedulerOf } from "../../../src/scheduler/index.mjs";
import { world, storage, NOW } from "./fixture.mjs";
import { world as explorerWorld } from "../question-explorer/fixture.mjs";

const iso = (ms) => new Date(ms).toISOString();

/* ---- R26: question-explorer's consumer ---- */

test("R26, R5, R2: question-explore closes the registry after document-copy, answers under explore, is question-explorer's alone, and is neither ranked nor daily", () => {
  assert.deepEqual(SCHEDULER_ORDER.slice(-5), ["question-explore", "register-import", "discard-clear", "mail-clear", "ingest"], "T53's three (R34, R35) follow it, and G55's `ingest` (R24) closes the registry");
  assert.equal(SCHEDULER_ORDER.indexOf("question-explore"), SCHEDULER_ORDER.indexOf("document-copy") + 1);
  assert.equal(SCHEDULER_KEYS["question-explore"], "explore");
  assert.equal(RANKED.includes("question-explore"), false, "its batch is question-explorer's own (its R2's 200)");
  assert.equal(DAILY.includes("question-explore"), false, "its day is question-explorer's, never this module's (R7)");
  const { s } = world({}, null, { explore: true, copies: true });
  assert.deepEqual(s.consumers().slice(-2), ["document-copy", "question-explore"]);
  /* Negative control: without question-explorer it is absent. */
  assert.equal(world({}, null, { copies: true }).s.consumers().includes("question-explore"), false);
  assert.deepEqual(new Scheduler({ storage: storage(), owners: {} }).consumers(), []);
});

test("R26, R1, R2: due now while exploreDue counts a question; the tick is exploreTick, told the firing instant and awaited, its answer under explore; none due, it is absent and wants only exploreWake", async () => {
  const answer = { at: iso(NOW), gate: "open", opened: [{ question: "INQ-2026-0001-q" }], asked: [], refused: 0, considered: 1 };
  const { s, st, calls, set } = world({ "question-explore": { due: 1, wake: NOW, tick: answer } });
  assert.equal(await s.arm(NOW), NOW, "armed now: a question is due");
  const r = await s.onAlarm(NOW);
  assert.deepEqual(r.explore, answer);
  assert.deepEqual(calls.filter(([m]) => m === "questionExplorer.exploreTick"), [["questionExplorer.exploreTick", NOW]]);
  /* Negative control: nothing due, an Ask's re-check an hour on (its instant text): not ticked, armed then. */
  const RECHECK = NOW + 3_600_000;
  Object.assign(set["question-explore"], { due: 0, wake: iso(RECHECK) });
  const quiet = await s.onAlarm(NOW + 1000);
  assert.equal("explore" in quiet, false, "not due: absent");
  assert.equal(calls.filter(([m]) => m === "questionExplorer.exploreTick").length, 1, "no second tick");
  assert.deepEqual([quiet.nextAt, st.alarm], [RECHECK, RECHECK], "armed at question-explorer's own instant (R7)");
  set["question-explore"].wake = null;
  assert.deepEqual([(await s.onAlarm(RECHECK)).nextAt, st.alarm], [null, null], "nothing wanted: no alarm (R15)");
});

test("R26, R3: an explore tick that throws is answered under its key, and every other consumer still ticks", async () => {
  const { s } = world({ "question-explore": { due: 1, wake: NOW, throws: "tick" }, "document-copy": { wake: NOW } });
  const r = await s.onAlarm(NOW);
  assert.deepEqual(r.explore, { error: "question-explore tick broke" });
  assert.equal(r.doccopy.ok, true, "document-copy ticked beside it");
});

/* ---- R26: investigation's quiet check (its R18) ---- */

test("R26, R7: investigation's quiet check needs no alarm: its R18 prompts are read when notice-producers asks, so no consumer of investigation's is registered and no wake is kept for it", async () => {
  /* Negative control first: the full registry, every owner in place, names nothing of investigation's. */
  const { s, st } = world({}, null, { explore: true, copies: true, files: true, daily: true });
  assert.equal(s.consumers().some((n) => /quiet|investigation/.test(n)), false);
  const inv = { quietState: () => { throw new Error("never read by the scheduler"); },
                quietPrompts: () => { throw new Error("never read by the scheduler"); } };
  const held = new Scheduler({ storage: st, owners: { investigation: () => inv } });
  assert.deepEqual(held.consumers(), [], "an investigation owner adds no consumer");
  assert.equal(await held.arm(NOW), null, "and wants no wake");
  assert.deepEqual(held.listenTo({ investigation: inv }), {}, "and registers no notice");
});

/* ---- against the real question-explorer: the work set up, the alarm read ---- */

test("R26, R1, R11: against the real question-explorer, a question worth exploring arms the alarm now; the firing opens its run through exploreTick; then nothing more is due that day and the alarm is deleted; with the gate shut nothing is armed or run", async () => {
  const w = await explorerWorld().standard();
  await w.setExplore("group", "yes");
  const T = Date.parse(w.clock.now);
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { questionExplorer: () => w.p } });
  assert.equal(await s.start(T), T, "the start reads exploreWake: due now");
  const r = await s.onAlarm(T);
  assert.equal(r.explore.opened.length, 1, JSON.stringify(r.explore).slice(0, 300));
  assert.equal(w.calledAs("open").length, 1);
  assert.deepEqual([r.nextAt, st.alarm], [null, null], "explored for the day: no wake (R15)");
  assert.equal("explore" in (await s.onAlarm(T + 1000)), false, "not due again the same day");
  assert.equal(w.calledAs("open").length, 1);
  /* Negative control: the gate shut (question-explorer R7): nothing due, no alarm, no tick. */
  const shut = await explorerWorld({ gateOpen: false }).standard();
  await shut.setExplore("group", "yes");
  const st2 = storage();
  const s2 = new Scheduler({ storage: st2, owners: { questionExplorer: () => shut.p } });
  assert.equal(await s2.start(T), null);
  assert.equal("explore" in (await s2.onAlarm(T)), false);
  assert.equal(shut.calledAs("open").length, 0);
});

test("R26, R7: against the real question-explorer, an Ask waits for its approval: the alarm is set at question-explorer's own re-check instant, and the firing there opens the approved run", async () => {
  const w = await explorerWorld().standard();
  w.draw("INQ-2026-0001-q", "PROJ-2026-0001-p");
  w.project("PROJ-2026-0001-p", ["alice"], { owners: ["alice"] });
  await w.setExplore("group", "no");
  await w.setExplore("project:PROJ-2026-0001-p", "ask");
  const T = Date.parse(w.clock.now), RECHECK = Date.parse("2026-10-10T10:00:00Z");
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { questionExplorer: () => w.p } });
  const first = await s.onAlarm(T);
  assert.equal(first.explore.opened.length, 0, "nothing runs without approval");
  assert.equal(first.explore.asked.length, 1);
  assert.deepEqual([first.nextAt, st.alarm], [RECHECK, RECHECK], "the re-check is question-explorer's instant, not this module's");
  /* Negative control: a firing before the re-check runs nothing. */
  assert.equal("explore" in (await s.onAlarm(RECHECK - 60_000)), false);
  w.approve("project:PROJ-2026-0001-p");
  w.clock.now = "2026-10-10T10:00:00Z";
  const second = await s.onAlarm(RECHECK);
  assert.deepEqual(second.explore.opened.map((o) => o.owner), ["project:PROJ-2026-0001-p"]);
});

test("R26, R11: the plane hands question-explorer once it has built it (hand, or schedulerOf's deps.questionExplorer); the scheduler never builds it itself, so an unhanded instance has no question-explore consumer", async () => {
  const w = await explorerWorld().standard();
  await w.setExplore("group", "yes");
  const T = Date.parse(w.clock.now);
  /* Negative control: built with its default owners, nothing of question-explorer's is reached. */
  const ctx = { storage: storage() };
  const s = schedulerOf(ctx, null, { owners: {} });
  assert.equal(s.consumers().includes("question-explore"), false, "not handed: absent");
  assert.deepEqual(schedulerOf(ctx, null, { questionExplorer: w.p }).consumers(), ["question-explore"], "handed: present");
  assert.equal(schedulerOf(ctx, null), s, "the one scheduler of the object");
  assert.equal(await s.start(T), T, "the start weighs the handed consumer's wake");
  const held = new Scheduler({ storage: storage(), owners: {} });
  assert.deepEqual(held.hand({ questionExplorer: () => w.p }), { ok: true, handed: ["questionExplorer"] });
  assert.deepEqual(held.hand({ questionExplorer: () => null }), { ok: true, handed: [] }, "an owner already held is kept");
  assert.equal((await held.onAlarm(T)).explore.opened.length, 1);
  assert.deepEqual(held.faults(), [], "no notice to register: no fault");
});
