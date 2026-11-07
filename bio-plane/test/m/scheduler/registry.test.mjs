/* scheduler: the registry (R5), a later module's registration (R8) and the test seam (R13). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULER_ORDER, SCHEDULER_KEYS, SCHED_GRACE_MS } from "../../../src/scheduler/index.mjs";
import { world, consumer, writes, NOW } from "./fixture.mjs";

const LATER = [["tasks", "task-drain", "drain"], ["queue", "queue-renotify", "queuerenotify"], ["instance-setup", "group-domain-recheck", "groupdomain"]];

test("R5: the consumers, in R5's order, each calling its owning module; gathering-sweep after monitor-cadence, scheduled-publish (R22) after deadline-recheck, working-on-seal and working-on-attest, then R21's six, then R24's five (file-reputation the fifth, T37), then R25's document-copy (T39), then R26's question-explore (T41), last", async () => {
  assert.deepEqual([...SCHEDULER_ORDER], ["selection-sweep", "task-drain", "archive-monitor", "connection-derive",
    "overdue-scan", "queue-renotify", "monitor-cadence", "gathering-sweep", "ai-run-reap", "capture-request-drain",
    "ai-run-wake", "calibration-reprobe", "group-domain-recheck", "bias-debt", "intent-age", "notice-sweep",
    "deadline-recheck", "scheduled-publish", "working-on-seal", "working-on-attest", "follow", "duty-transitions", "interest-checks",
    "money-detectors", "standing-questions", "dated-waits", "file-scan", "file-render", "file-deeper", "file-forward", "file-reputation", "document-copy",
    "question-explore", "register-import", "discard-clear", "mail-clear", "ingest"]);
  const { s } = world({}, null, { daily: true, files: true, copies: true, explore: true, ingest: true });
  /* T53's three (R34, R35) call the real registers, doorbell and mail-door, whose places t53.test.mjs checks; this world has none */
  const present = SCHEDULER_ORDER.filter((n) => !["register-import", "discard-clear", "mail-clear"].includes(n));
  /* registered by the later modules that own them, in an order other than R5's */
  for (const [m, n, key] of [...LATER].reverse()) assert.equal(s.register(m, consumer(n, { key })).ok, true);
  assert.deepEqual(s.consumers(), present, "each takes its R5 place");
  assert.ok(s.consumers().indexOf("capture-request-drain") < s.consumers().indexOf("ai-run-wake"),
    "the drain ticks before the wake");
});

test("R5: each consumer calls exactly its owner's services: due, wake and tick", async () => {
  const all = Object.fromEntries(SCHEDULER_ORDER.map((n) => [n, { due: 1, wake: NOW + 1000 }]));
  for (const n of ["bias-debt", "intent-age", "notice-sweep", "monitor-cadence", "deadline-recheck", "gathering-sweep",
                   "working-on-seal", "working-on-attest"]) all[n].due = NOW;
  const { s, calls } = world(all);
  await s.onAlarm(NOW);
  const called = new Set(calls.map(([m]) => m));
  for (const m of ["retrieval.sweepWake", "retrieval.sweepSelections",                           /* retrieval R22, R51 */
                   "monitoring.archiveDue", "monitoring.archiveWake", "monitoring.archiveTick",   /* monitoring R20 */
                   "monitoring.cadenceDue", "monitoring.cadenceWake", "monitoring.cadenceTick",   /* monitoring R19 */
                   "connections.wake", "connections.sweep",                                       /* connections R18 */
                   "progressions.overdueScan",                                                    /* progressions R17 */
                   "aiRuns.reapDue", "aiRuns.reapWake", "aiRuns.reap",                            /* ai-runs R15 */
                   "captureRequests.drainPending", "captureRequests.drainIntervalMs", "captureRequests.drain",   /* R11, R37 */
                   "aiRuns.wakeDue", "aiRuns.wakeWake", "aiRuns.wake",                            /* ai-runs R16 */
                   "calibration.calibrationDue", "calibration.calibrationWake", "calibration.calibrationTick",  /* R9 */
                   "bias.biasDebtDue", "bias.biasDebtWake", "bias.biasDebtSweep",                 /* bias R33, R41 */
                   "intent.ageDue", "intent.ageWake", "intent.ageSurfaced",                       /* intent R17, R27 */
                   "reevaluation.noticeSweepDue", "reevaluation.noticeSweepWake", "reevaluation.noticeSweep",  /* R25 */
                   "monitoring.deadlineRecheckDue", "monitoring.deadlineRecheckWake", "monitoring.deadlineRecheck",  /* R34, R50 */
                   "linkSweep.sweepDue", "linkSweep.sweepWake", "linkSweep.sweepTick",                            /* link-sweep R4 */
                   "networkNotices.sealDue", "networkNotices.sealWake", "networkNotices.sealTick",                /* R14, R15 */
                   "networkNotices.attestDue", "networkNotices.attestWake", "networkNotices.attestTick"])         /* R12, R17 */
    assert.ok(called.has(m), m);
  const drain = calls.find(([m]) => m === "captureRequests.drain")[1];
  assert.deepEqual([drain.actor, drain.now], ["alarm", NOW], "the drain is told it is the alarm, and when");
  const order = calls.filter(([m]) => ["captureRequests.drain", "aiRuns.wake"].includes(m)).map(([m]) => m);
  assert.deepEqual(order, ["captureRequests.drain", "aiRuns.wake"], "a request completing on this alarm wakes its run on it");
});

test("R5: the capture-request drain's wake is its owner's interval past now while a request waits, else none", async () => {
  const { s, st, set } = world({ "capture-request-drain": { due: 2, wake: 60000 } });
  assert.equal(await s.arm(NOW), NOW + 60000);
  set["capture-request-drain"].due = 0;
  await s.onAlarm(NOW);
  assert.equal(st.alarm, null);
});

test("R5: deadline-recheck runs monitoring's deadlineRecheck on the alarm its R50 wake sets, and no other; none pending holds no wake", async () => {
  const DAY = Date.parse("2026-09-29T00:00:00Z");   /* the start of the UTC day after a pending entry's date */
  const { s, st, calls, set } = world({ "deadline-recheck": { due: (now) => (DAY <= now ? DAY : null), wake: DAY,
    tick: { ok: true, at: "2026-09-29T00:00:00Z", marked: [{ action: "ACT-1", ords: [0], revision: 2 }], failed: [],
            truncated: false, escalations: null } } });
  assert.equal(await s.arm(NOW), DAY, "armed at monitoring's wake");
  const early = await s.onAlarm(NOW);
  assert.equal("deadlinerecheck" in early, false, "not yet due: absent");
  assert.equal(calls.some(([m]) => m === "monitoring.deadlineRecheck"), false);
  const r = await s.onAlarm(DAY);
  assert.deepEqual(r.deadlinerecheck.marked, [{ action: "ACT-1", ords: [0], revision: 2 }], "its answer under deadlinerecheck");
  assert.deepEqual(calls.filter(([m]) => m === "monitoring.deadlineRecheck"), [["monitoring.deadlineRecheck", DAY]],
    "called once, with the firing instant");
  set["deadline-recheck"].wake = null; set["deadline-recheck"].due = null;
  await s.onAlarm(DAY + 1000);
  assert.equal(st.alarm, null, "no pending entry: no wake held for it (R15)");
  const names = s.consumers();
  assert.deepEqual(names.slice(names.indexOf("deadline-recheck"), names.indexOf("deadline-recheck") + 3),
    ["deadline-recheck", "scheduled-publish", "working-on-seal"], "followed by the scheduled publish (R22), then network-notices' two consumers");
});

test("R5, R16: deadline-recheck never spins on an entry R34 cannot mark: a tick that marks nothing holds the past wake to the next UTC day; one that marks releases it", async () => {
  const PAST = Date.parse("2026-09-20T00:00:00Z");   /* R50's wake for an entry dated 09-19, still pending */
  const day = (t) => Math.floor(t / 86_400_000) * 86_400_000 + 86_400_000;
  const answer = { ok: true, at: null, marked: [], failed: [{ action: "ACT-9", reason: "UNSPLICEABLE_CLOCK" }], truncated: false, escalations: null };
  const { s, st, calls, set } = world({ "deadline-recheck": { due: (now) => (PAST <= now ? PAST : null), wake: PAST, tick: answer } });
  assert.equal(await s.arm(NOW), PAST, "first armed at the owner's wake, due at once");
  const r1 = await s.onAlarm(NOW);
  assert.deepEqual(r1.deadlinerecheck.failed, answer.failed);
  assert.equal(r1.nextAt, day(NOW), "held to the start of the next UTC day, not set in the past");
  assert.ok(st.alarm > NOW);
  const r2 = await s.onAlarm(NOW + 1000);
  assert.equal("deadlinerecheck" in r2, false, "a firing before then does not run it again");
  assert.equal(await s.arm(NOW + 2000), day(NOW), "nor does an arm pull the alarm back into the past");
  const r3 = await s.onAlarm(day(NOW));
  assert.equal("deadlinerecheck" in r3, true, "re-checked on the first alarm of the next day");
  assert.equal(r3.nextAt, day(day(NOW)));
  assert.equal(calls.filter(([m]) => m === "monitoring.deadlineRecheck").length, 2, "twice in two days, never in a loop");
  /* a tick that marks something releases the hold: its owner's wake stands again, past or not */
  set["deadline-recheck"].tick = { ok: true, marked: [{ action: "ACT-8", ords: [0] }], failed: [], truncated: true };
  const r4 = await s.onAlarm(day(day(NOW)));
  assert.equal(r4.nextAt, PAST, "progress made: the owner's wake again (more may remain)");
  /* a tick that throws holds it as well */
  set["deadline-recheck"].throws = "tick";
  const T = day(day(NOW)) + 5;
  const r5 = await s.onAlarm(T);
  assert.match(r5.deadlinerecheck.error, /broke/);
  assert.equal(r5.nextAt, day(T));
});

test("R8: a later module registers each consumer once; a name already registered, or one of this module's own, is refused CONSUMER_DECLARED", () => {
  const { s } = world();
  const a = s.register("queue", consumer("task-drain", { key: "drain" }));
  assert.deepEqual(a, { ok: true, module: "queue", name: "task-drain", key: "drain", placed: "R5" });
  assert.deepEqual(s.register("tasks", consumer("task-drain", { key: "drain2" })),
    { ok: false, reason: "CONSUMER_DECLARED", module: "tasks", name: "task-drain" });
  for (const own of ["selection-sweep", "archive-monitor", "monitor-cadence", "bias-debt", "intent-age"])
    assert.equal(s.register("m", consumer(own, { key: `k-${own}` })).reason, "CONSUMER_DECLARED", own);
  assert.equal(s.register("m", consumer("x", { key: "x" })).ok, true);
  assert.equal(s.register("n", consumer("x", { key: "y" })).reason, "CONSUMER_DECLARED");
});

test("R8: a consumer that is not {name, key, due, wake, tick}, or whose key another answer field holds, is refused and never registered", () => {
  const { s } = world();
  for (const bad of [null, 3, {}, { name: "" }, { name: "a", due: 1, wake() {}, tick() {} }, { name: "a", due() {}, wake() {} }])
    assert.equal(s.register("m", bad).reason, "CONSUMER_MALFORMED");
  assert.equal(s.register("", consumer("a")).reason, "CONSUMER_MALFORMED");
  for (const key of ["swept", "nextAt", "probes", "drained", "biasdebt"])
    assert.equal(s.register("m", consumer(`c-${key}`, { key })).reason, "CONSUMER_MALFORMED", key);
  assert.equal(s.consumers().length, SCHEDULER_ORDER.length - LATER.length - 3 - 5 - 1 - 1 - 1 - 3,
    "only the module's own consumers (the daily three's owners, file-safety, case-carriage, question-explorer, calculations, registers, doorbell and mail-door absent)");
});

test("R8: a consumer R5 does not name is appended in the order the modules register; it inherits R1–R4", async () => {
  const { s, st } = world({ "notice-sweep": { wake: NOW + 50000 } });
  const one = consumer("later-one", { key: "one", due: (n) => n, wake: NOW + 4000, tick: { one: "ticked" } });
  const two = consumer("later-two", { key: "two", due: null, wake: NOW + 3000 });
  s.register("module-a", one); s.register("module-b", two);
  s.register("queue", consumer("queue-renotify", { key: "queuerenotify" }));
  const names = s.consumers();
  assert.deepEqual(names.slice(-2), ["later-one", "later-two"]);
  assert.equal(names.indexOf("queue-renotify"), SCHEDULER_ORDER.filter((n) => names.includes(n)).indexOf("queue-renotify"));
  assert.equal(await s.arm(NOW), NOW + 3000, "R4: its wake is weighed");
  const r = await s.onAlarm(NOW);
  assert.deepEqual([r.one, one.ticks.length, two.ticks.length, r.nextAt], ["ticked", 1, 0, NOW + 3000], "R1, R2");
  assert.equal(st.alarm, NOW + 3000);
});

test("R13: with SCHED_PROBE unset or unparsable the registry is exactly R5's consumers and the seam writes nothing", async () => {
  for (const env of [null, {}, { SCHED_PROBE: "" }, { SCHED_PROBE: "not json" }, { SCHED_PROBE: "{\"a\":1}" }, { SCHED_PROBE: "[{\"nope\":1}]" }]) {
    const { s, st } = world({}, env);
    const r = await s.onAlarm(NOW);
    await s.arm(NOW);
    assert.deepEqual(r.probes, []);
    assert.equal(s.registry(await s.probeLog()).length, SCHEDULER_ORDER.length - LATER.length - 3 - 5 - 1 - 1 - 1 - 3);
    assert.deepEqual(st.log.filter(([m, k]) => m === "put" || k === "sched_probe" && m !== "get"), [], JSON.stringify(env));
    assert.equal(st.kv.size, 0);
  }
});

test("R13: each probe is an interval consumer due first at arming + period, then every period, for its fires; its state is the value sched_probe", async () => {
  const { s, st } = world({}, { SCHED_PROBE: JSON.stringify([{ name: "p", period: 100, fires: 2 }]) });
  assert.equal(await s.probeArm(NOW), NOW + 100, "schedProbeArm arms as R4");
  assert.equal(await s.alarmAt(), NOW + 100, "schedAlarmAt answers the alarm");
  assert.deepEqual(st.kv.get("sched_probe"), { p: { period: 100, remaining: 2, next: NOW + 100, fires: [] } });
  const early = await s.onAlarm(NOW + 100 - SCHED_GRACE_MS - 1);
  assert.deepEqual(early.probes, [], "not yet due");
  const r1 = await s.onAlarm(NOW + 100);
  assert.deepEqual([r1.probes, r1.nextAt], [["p"], NOW + 200]);
  const r2 = await s.onAlarm(NOW + 200);
  assert.deepEqual([r2.probes, r2.nextAt], [["p"], null]);
  assert.deepEqual((await s.probeLog()).p.fires, [NOW + 100, NOW + 200], "schedProbeLog answers each probe's firings");
  assert.equal((await s.onAlarm(NOW + 300)).probes.length, 0, "its fires spent");
});

test("R2: SCHEDULER_KEYS names every R5 consumer's key, each its own", () => {
  assert.deepEqual(Object.keys(SCHEDULER_KEYS), [...SCHEDULER_ORDER]);
  assert.equal(new Set(Object.values(SCHEDULER_KEYS)).size, SCHEDULER_ORDER.length);
});
