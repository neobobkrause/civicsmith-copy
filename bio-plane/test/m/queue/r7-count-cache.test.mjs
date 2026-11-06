/* G80 (T51 fix round 7; B.md:37, A.md:41; diagnosis-R7-screens.md S4): the Queue count is recomputed from scratch by every call
   (12 concurrent `queue?count=true` took 5.6 s). `op=queue` with `count: true` (R93) is now one count per viewer, record-core's
   write counter (R89, R90) and a bucket of the clock: reused while none of the three moves, recomputed for any write.
   The recompute is COUNTED (the producers' one read and `tasks`' read asked), never timed (R-CLOCK: workerd freezes the clock
   during synchronous work). The key is not a version of the reading ledger: a task, a question, a deadline, a notice or a mute
   changing must move the next count. Driven at the module's interface (`queueFeed`, the ops map as the plane calls it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW, iso, plainCount } from "./world.mjs";
import { Queue } from "../../../src/queue/index.mjs";

const FACTS = { objective_gap: { bound: 50, truncated: false }, contradiction: { bound: 50, truncated: false }, dispositions: [] };
const stub = (a, it) => ({ summary: "an item", detail: "about it", basis: { source: "stub", detail: "stubbed" },
  age: { state: "determined", since: iso(NOW - 1000), ms: 1000 }, assignee: null, assignee_role: null,
  options: [], case: a.homesOf([]), ...it });
const condition = (kind, tail = "x") => ({ id: `CONDITION::${kind}::${tail}`, class: "CONDITION", kind });
const alice = { member: "alice", viewer: "member:alice" };

/** A world whose producers' items are `state.items` and whose record-core counter is `state.writes` (a test moves either);
 *  `reads` counts the producers' read and tasks' read, which is what a recompute is. */
function setup({ withCounter = true } = {}) {   // withCounter: true (a scripted counter), false (none), "real" (record-core's own)
  const state = { items: [condition("render-deferred"), condition("text-undetermined")], writes: 0, produced: 0, tasked: 0 };
  const w = world({ producers: { feedItems: (a) => { state.produced += 1; return { facts: FACTS, items: state.items.map((it) => stub(a, { ...it, case: a.homesOf(it.subject ? [it.subject.id] : []) })) }; } } });
  w.member("alice"); w.member("bob");
  w.bundle("INF-1"); w.bundle("INF-2");
  w.task("TASK-2026-0001-a", "INF-1", { assignee: "alice" });
  if (withCounter === true) w.record.writeCount = () => state.writes;
  else if (withCounter === false) w.record.writeCount = undefined;   // (a record that states no counter, whatever record-core now provides)
  const recent = w.tasks.recentTasks.bind(w.tasks);
  w.tasks.recentTasks = (...a) => { state.tasked += 1; return recent(...a); };
  const count = (who = alice) => w.q.queueFeed({ ...who, count: true });
  const list = (who = alice) => w.q.queueFeed({ ...who, limit: 500 }).items.length;
  return { w, state, count, list };
}

test("R93 (G80): a count asked again for the same viewer with no write between is the answer already made, and recomputes nothing", () => {
  const { state, count, list } = setup();
  const first = count();
  assert.deepEqual(plainCount(first), { ok: true, member: "alice", count: 3 });
  assert.equal(state.produced, 1);
  assert.equal(state.tasked, 1);
  for (let i = 0; i < 24; i += 1) assert.deepEqual(plainCount(count()), plainCount(first));
  assert.equal(state.produced, 1, "the producers' read was made once for 25 counts");
  assert.equal(state.tasked, 1, "so was tasks'");
  assert.equal(first.count, list(), "the kept count is the list's length");
  // the answer is a copy: a caller changing what it was handed does not change the next one
  const mine = count(); mine.count = 99;
  assert.equal(count().count, 3);
});

test("R93 (G80): the count is kept per viewer: another member's count, and a machine credential's, are their own", () => {
  const { w, state, count } = setup();
  w.task("TASK-2026-0002-b", "INF-2", { assignee: "bob" });
  const bob = { member: "bob", viewer: "member:bob" };
  const admin = { viewer: "class:admin" };
  assert.equal(count().count, 3);
  assert.equal(count(bob).count, 3, "two status items and bob's own task");
  assert.equal(count(admin).count, 4, "a machine credential reads every assignee");
  const produced = state.produced;
  assert.equal(count().count, 3); assert.equal(count(bob).count, 3); assert.equal(count(admin).count, 4);
  assert.equal(state.produced, produced, "each viewer's second count was kept");
});

test("R93 (G80): record-core's write counter moving recomputes the next count, from every feed that can raise an item", () => {
  const { w, state, count, list } = setup();
  assert.equal(count().count, 3);
  // a producer's write: its feed now holds one more item, and the record's counter has moved
  state.items.push(condition("client-rendered-shell")); state.writes += 1;
  assert.equal(count().count, 4);
  assert.equal(count().count, list());
  // a task's write (the OBLIGATION feed): a second task for alice
  w.task("TASK-2026-0003-c", "INF-2", { assignee: "alice" }); state.writes += 1;
  assert.equal(count().count, 5);
  // the notices' feed (notice-producers) and every feed `queue-producers` names: a write to any of them moves the next count
  for (const [feed] of Queue.QUEUE_FEEDS) {
    const before = count().count;
    state.items.push(condition("render-deferred", `after-${feed}`)); state.writes += 1;
    assert.equal(count().count, before + 1, `a write to the ${feed} feed`);
  }
  // control: no write, no change in the feeds' answers, no recompute
  const produced = state.produced;
  count(); count();
  assert.equal(state.produced, produced);
});

test("R93 (G80): the key is the record's whole write counter, not a version of one ledger: a write that leaves every reading as it was still moves the count", () => {
  const { w, state, count } = setup();
  assert.equal(count().count, 3);
  w.run(`DELETE FROM tasks`); state.writes += 1;   // a question, deadline or notice table is not the reading ledger either
  assert.equal(count().count, 2);
});

test("R93 (G80): each of this member's own acts moves her next count, though record-core's counter never moved: an item mute, a kind muted in a case, a snooze", () => {
  const { w, state, count } = setup();
  w.bundle("PRJ-1", "project"); w.join("PRJ-1", "alice"); w.cite("PRJ-1", "INF-1");
  // the producers' items: one homed under PRJ-1 (through INF-1), one ungrouped
  const homed = { ...condition("render-deferred", "homed"), subject: { kind: "bundle", id: "INF-1" } };
  state.items = [homed, condition("text-undetermined", "loose")];
  const listLen = () => w.q.queueFeed({ ...alice, limit: 500 }).items.length;
  const settle = (what, expected) => {
    const produced = state.produced;
    assert.equal(count().count, expected, what);
    assert.equal(state.produced, produced + 1, `${what}: recomputed, though the record's counter stood at ${state.writes}`);
    assert.equal(count().count, expected, `${what}: and kept again`);
    assert.equal(state.produced, produced + 1);
    assert.equal(listLen(), expected, `${what}: the count is the list's length`);
  };
  count();                                    // warm
  assert.equal(w.q.queueMute({ ...alice, item: "CONDITION::text-undetermined::loose" }).ok, true);
  settle("an item mute", 2);                  // the task and the homed condition
  assert.equal(w.q.queueMute({ ...alice, item: "CONDITION::text-undetermined::loose", unmute: true }).ok, true);
  settle("an item unmute", 3);
  assert.equal(w.q.queueMute({ ...alice, case: "PRJ-1", kinds: ["render-deferred"] }).ok, true);
  settle("a kind muted in a case", 2);
  assert.equal(w.q.queueMute({ ...alice, case: "PRJ-1", kinds: ["render-deferred"], unmute: true }).ok, true);
  settle("a kind unmuted in a case", 3);
  assert.equal(w.q.queueSnooze({ ...alice, case: "PRJ-1", until: iso(NOW + 86400000) }).ok, true);
  settle("a snooze (it marks and removes nothing, R40)", 3);
  assert.equal(w.q.queueSnooze({ ...alice, case: "PRJ-1", clear: true }).ok, true);
  settle("a snooze cleared", 3);
  // control: a refused act writes nothing and moves nothing
  const produced = state.produced;
  assert.equal(w.q.queueMute({ ...alice, case: "PRJ-1", kinds: ["authority-undetermined"] }).ok, false);
  count();
  assert.equal(state.produced, produced);
});

test("R93 (G80): a project's decision on a finding moves the next count of its members, though record-core's counter never moved", () => {
  const w = world({ basisVersions: { projectsDrawingOn: () => Object.assign([
      { id: "PRJ-A", title: "A", current: { version: "v1", at: iso(NOW - 1000), by: "alice" } },
      { id: "PRJ-B", title: "B", current: { version: "v2", at: iso(NOW - 2000), by: "bob" } }], { bound: 32, truncated: false }) } });
  w.member("alice");
  w.bundle("INQ-S", "inquiry"); w.bundle("PRJ-A", "project"); w.bundle("PRJ-B", "project");
  w.join("PRJ-A", "alice"); w.join("PRJ-B", "alice"); w.cite("PRJ-A", "INQ-S"); w.cite("PRJ-B", "INQ-S");
  w.record.writeCount = () => 7;
  let asked = 0;
  const recent = w.tasks.recentTasks.bind(w.tasks);
  w.tasks.recentTasks = (...a) => { asked += 1; return recent(...a); };
  const count = () => w.q.queueFeed({ ...alice, count: true }).count;
  const id = "FINDING::stance-changed-here-not-elsewhere::INQ-S::PRJ-A";
  assert.ok(w.feed("alice").items.some((i) => i.id === id), "the finding is open for both projects");
  asked = 0;
  const open = count();
  assert.equal(count(), open); assert.equal(asked, 0, "the list just made is the derivation the count is served from (R94)");
  const decide = (project) => w.q.proposeDispose({ project, finding: id, to: "dismissed", reason: "seen", decidedBy: "alice",
    viewer: "member:alice", identity: "member:alice" });
  assert.equal(decide("PRJ-A").ok, true);
  assert.equal(count(), open, "one of two projects decided: the finding stays for the other");
  assert.equal(asked, 1, "but the count was recomputed");
  assert.equal(decide("PRJ-B").ok, true);
  assert.equal(count(), open - 1, "both projects decided: it leaves the count");
  assert.equal(asked, 2);
  assert.equal(count(), open - 1); assert.equal(asked, 2);
});

test("R93 (G80): the clock enters the feed, so a count is kept for one bucket of it and recomputed after", () => {
  const { w, state, count } = setup();
  const bucket = Queue.QUEUE_COUNT_BUCKET_MS;
  w.now = Math.floor(NOW / bucket) * bucket + 1;
  assert.equal(count().count, 3);
  w.now += bucket - 2;                        // the last millisecond of the same bucket
  count();
  assert.equal(state.produced, 1, "within the bucket nothing is recomputed");
  w.now += 2;                                  // the next bucket
  count();
  assert.equal(state.produced, 2, "the next bucket recomputes");
  count();
  assert.equal(state.produced, 2);
  // a clock that went back is a bucket of its own: it is not served an answer from the future
  w.now -= 10 * bucket;
  count();
  assert.equal(state.produced, 3);
});

test("R93 (G80, control): with no write counter stated by record-core (R90) nothing is reused", () => {
  const { state, count } = setup({ withCounter: false });
  count(); count(); count();
  assert.equal(state.produced, 3, "every count was made");
});

test("R93 (G80, control): a refusal is not kept: the next count is made, and answers once the producer is fixed", () => {
  const { state, count } = setup();
  state.items = [{ id: "FINDING::ingest-finished::1", class: "FINDING", kind: "ingest-finished" }];
  const refused = count();
  assert.equal(refused.ok, false);
  assert.equal(refused.reason ?? refused.code, "NO_SUCH_KIND");
  state.items = [];
  assert.deepEqual(plainCount(count()), { ok: true, member: "alice", count: 1 });   // no counter moved; the refusal was not kept
});

test("R94 (G116, control; replaces R93's pin that the list is made on every ask): the list is served from the derivation the count kept, and a list a to-do write has just changed is not served stale", () => {
  const { state, count, w } = setup();
  count();
  const a = w.q.queueFeed({ ...alice, limit: 500 });
  const b = w.q.queueFeed({ ...alice, limit: 500 });
  assert.equal(state.produced, 1, "the count, the list and the list again are one derivation");
  assert.equal(a.items.length, b.items.length);
  assert.deepEqual(w.q.queueFeed({ ...alice, muted: true }).muted, []);
  // a to-do's write between two list reads: the record's counter moves, and the next list holds it
  w.task("TASK-2026-0007-z", "INF-2", { assignee: "alice" }); state.writes += 1;
  const c = w.q.queueFeed({ ...alice, limit: 500 });
  assert.equal(c.items.length, a.items.length + 1, "the new to-do is in the list asked next");
  assert.ok(c.items.some((i) => i.id === "TASK-2026-0007-z"));
  assert.equal(state.produced, 2);
  // and one a to-do's resolve has just removed
  w.run(`DELETE FROM tasks WHERE id='TASK-2026-0007-z'`); state.writes += 1;
  assert.equal(w.q.queueFeed({ ...alice, limit: 500 }).items.some((i) => i.id === "TASK-2026-0007-z"), false);
});

test("R93 (G80, seam: record-core R89, R90): a write through the record's own paths moves the counter the cache reads", () => {
  const w = world();
  w.member("alice");
  w.bundle("INFO-2026-0001-doc"); w.bundle("INFO-2026-0002-other");
  w.task("TASK-2026-0001-a", "INFO-2026-0001-doc", { assignee: "alice" });
  w.task("TASK-2026-0002-b", "INFO-2026-0002-other", { assignee: "alice" });
  assert.equal(typeof w.record.writeCount, "function", "record-core provides writeCount() (R90)");
  let asked = 0;
  const recent = w.tasks.recentTasks.bind(w.tasks);
  w.tasks.recentTasks = (...a) => { asked += 1; return recent(...a); };
  const count = () => w.q.queueFeed({ ...alice, count: true }).count;
  /* the first read of a fresh object may run its providers' own migrations (ai-use's ledger rows, steps' repairs): writes of
     theirs, made while the count is derived, so the count is kept under the counter as it stands after them (R93) */
  assert.equal(count(), 2);
  const c0 = w.record.writeCount();
  assert.equal(w.record.writeCount(), c0, "a read of the counter does not move it");
  assert.equal(count(), 2); assert.equal(count(), 2);
  assert.equal(asked, 1, "the second and third counts were kept, the first read's own migrations notwithstanding");
  assert.equal(w.record.writeCount(), c0, "and asking for a count wrote nothing");
  // a task resolved through tasks' own path: a write to a table of the record the cache must see
  const resolved = w.tasks.taskResolve({ id: "TASK-2026-0001-a", actor: "alice" });
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.ok(w.record.writeCount() > c0, "a write moved the counter (R89)");
  assert.equal(count(), 1, "the next count is recomputed and correct");
  assert.equal(asked, 2);
});
