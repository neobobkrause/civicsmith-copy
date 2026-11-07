/* scheduler — fix round 6, G55 (K4562, K4571, K4630; calculations R14): the consumer `ingest`, which runs a money ingest over the inline
   threshold in the background, one slice for each firing (R5, R7, R24). It calls `calculations.ingestDue/ingestWake/ingestTick`, asked
   afresh every time (R11), registers once with `calculations.onIngestWork` (R9), and never spins on a failing tick (R3). The first tests
   drive a stand-in shaped as calculations R14 states its services (`fixture.mjs`); the last drive the real calculations over its own
   test world and stay red by name until calculations' G55 tier 2 is merged (R-SEAM). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as scheduler from "../../../src/scheduler/index.mjs";
import { world, storage, writes, NOW, INGEST_CONSUMER } from "./fixture.mjs";
import { seeded, V } from "../calculations/fixture.mjs";
import * as calculations from "../../../src/calculations/index.mjs";

const { SCHEDULER_ORDER, SCHEDULER_KEYS, RANKED, DAILY, ALWAYS_DUE, SCHED_GRACE_MS, Scheduler } = scheduler;
const IN = "ingest";
const called = (calls, m) => calls.filter(([x]) => x === m).map(([, a]) => a);
const STARTED = { ok: true, ingest: "ing_1", state: "ingesting", complete: false, rows_total: 25000, rows_done: 2000 };

/* ---- the registry (R5, R2, R6) ---- */

test("R24, R5, R2, R6: ingest closes the registry after question-explore, answers under ingest, is calculations' alone (neither ranked, daily nor always due), and is absent without a calculations owner", () => {
  assert.equal(INGEST_CONSUMER, IN, "the fixture's name is the module's");
  assert.equal(SCHEDULER_ORDER.at(-1), IN);
  assert.ok(SCHEDULER_ORDER.indexOf(IN) > SCHEDULER_ORDER.indexOf("question-explore"));
  assert.equal(SCHEDULER_ORDER.indexOf(IN), SCHEDULER_ORDER.indexOf("mail-clear") + 1, "after T53's three (R34, R35), which follow question-explore");
  assert.equal(SCHEDULER_KEYS[IN], "ingest");
  assert.deepEqual([RANKED.includes(IN), DAILY.includes(IN), ALWAYS_DUE.includes(IN)], [false, false, false]);
  assert.equal(world().s.consumers().includes(IN), false, "no calculations owner: absent");
  assert.equal(world({}, null, { ingest: true }).s.consumers().at(-1), IN, "last of those present");
  assert.deepEqual(world({}, null, { explore: true, ingest: true }).s.consumers().slice(-2), ["question-explore", IN]);
  assert.deepEqual(new Scheduler({ storage: storage(), owners: { calculations: () => world({}, null, { ingest: true }).o.calculations } }).consumers(), [IN]);
});

/* ---- the tick (R1, R2, R7) ---- */

test("R24, R1, R2: due while a record is ingesting, it calls ingestTick(now) once, awaited, its answer under ingest as given; not due, it is absent and ingestTick is not called", async () => {
  const { s, calls } = world({ [IN]: { due: NOW, wake: NOW, tick: () => new Promise((ok) => setTimeout(() => ok(STARTED), 5)) } });
  const r = await s.onAlarm(NOW + 100);
  assert.deepEqual(r.ingest, STARTED, "awaited inside the alarm");
  assert.deepEqual(called(calls, "calculations.ingestTick"), [[NOW + 100][0]].map((x) => x), "once, with the firing's now");
  assert.equal(called(calls, "calculations.ingestTick").length, 1);
  const quiet = world({ [IN]: { due: null, wake: null } });
  const q = await quiet.s.onAlarm(NOW);
  assert.equal("ingest" in q, false, "no record ingesting: absent");
  assert.deepEqual(called(quiet.calls, "calculations.ingestTick"), []);
});

test("R24, R1, R15, R7: its due and wake are ingestDue(now) and ingestWake(now), asked afresh with each now: the alarm is set at the wake, a due within the grace ticks, and with none it is deleted; nothing but the alarm is written or read, and no interval is this module's", async () => {
  let wake = NOW + 4000;
  const { s, st, calls } = world({ [IN]: { due: (now) => (now >= wake - SCHED_GRACE_MS ? now : null), wake: () => wake, tick: STARTED } });
  assert.equal(await s.arm(NOW), NOW + 4000, "armed at ingestWake's instant");
  assert.equal("ingest" in (await s.onAlarm(NOW + 4000 - SCHED_GRACE_MS - 1)), false, "not due before it, beyond the grace");
  assert.ok("ingest" in (await s.onAlarm(NOW + 4000 - SCHED_GRACE_MS)), "due within the grace");
  wake = null;
  const done = await s.onAlarm(NOW + 4001);
  assert.deepEqual([done.nextAt, st.alarm], [null, null], "no record ingesting: no alarm (R15)");
  for (const t of [NOW, NOW + 4000 - SCHED_GRACE_MS - 1, NOW + 4001]) assert.ok(called(calls, "calculations.ingestWake").includes(t), `asked at ${t}`);
  assert.deepEqual(st.log.filter(([m]) => m === "get" || m === "put"), [], "no value read or written for it");
  const numbers = Object.entries(scheduler).filter(([, v]) => typeof v === "number").map(([k]) => k).sort();
  assert.deepEqual(numbers, ["DETECTORS_BUDGET_MS", "SCHED_GRACE_MS"], "no slice size, attempt count or interval of this module's (R7)");
  for (const odd of ["soon", true, NaN, {}]) {
    const o = world({ [IN]: { due: null, wake: odd } });
    assert.equal(await o.s.arm(NOW), null, String(odd));
  }
});

test("R24, R7: an owner that does not offer the ingest services wants nothing: no error is answered and no alarm is set", async () => {
  const bare = new Scheduler({ storage: storage(), owners: { calculations: () => ({}) } });
  assert.equal(await bare.arm(NOW), null);
  const r = await bare.onAlarm(NOW);
  assert.deepEqual([r.nextAt, "ingest" in r], [null, false]);
  assert.deepEqual(bare.consumers(), [IN]);
});

/* ---- failure never spins (R3) ---- */

test("R24, R3: a tick that throws is answered {error} under ingest and every other consumer still ticks; a record calculations stops after its third failed attempt leaves no due consumer, the alarm is deleted and no fourth tick runs", async () => {
  let attempts = 0;   /* calculations' own count (INGEST_MAX_ATTEMPTS = 3): after the third failure the record is stopped */
  const stopped = () => attempts >= 3;
  let ran = false;
  const { s, st } = world({
    [IN]: { due: (now) => (stopped() ? null : now), wake: (now) => (stopped() ? null : now), tick: () => { attempts += 1; throw new Error("slice broke"); } },
    "file-reputation": { wake: () => (ran ? null : NOW), tick: () => { ran = true; return { ok: true }; } } });
  const first = await s.onAlarm(NOW);
  assert.deepEqual(first.ingest, { error: "slice broke" });
  assert.deepEqual(first.filereputation, { ok: true }, "the other consumer still ticked (R3)");
  assert.equal(first.nextAt, NOW, "still owed: the reconcile wants the next slice at once");
  assert.equal(st.alarm, NOW);
  for (let i = 1; i < 3; i++) await s.onAlarm(NOW + i);
  const last = await s.onAlarm(NOW + 10);
  assert.equal("ingest" in last, false, "stopped: not due");
  assert.deepEqual([last.nextAt, st.alarm, last.rearmed], [null, null, false], "the alarm is deleted (R15)");
  assert.equal(attempts, 3, "three attempts and no fourth");
  /* a wake that throws wants nothing and is answered under the key */
  const w = world({ [IN]: { due: NOW, wake: NOW, throws: "wake" } });
  const r = await w.s.onAlarm(NOW);
  assert.deepEqual(r.ingest, { error: "ingest wake broke" });
  assert.equal(r.nextAt, null);
});

/* ---- recovery (R11) ---- */

test("R24, R11: a fresh start over a store with an ingesting record re-derives the alarm from ingestWake; over none it sets none", async () => {
  const owed = world({ [IN]: { due: NOW, wake: NOW + 1500 } });
  assert.equal(await owed.s.start(NOW), NOW + 1500, "a restarted object restarts the owed slices");
  assert.equal(owed.st.alarm, NOW + 1500);
  const lost = world({ [IN]: { due: NOW, wake: NOW + 1500 } });
  lost.st.alarm = NOW - 10 * 60_000;   /* an alarm the platform stopped running: spent (R4) */
  assert.ok((await lost.s.start(NOW)) >= NOW, "a spent alarm is set afresh");
  const idle = world({ [IN]: { due: null, wake: null } });
  assert.equal(await idle.s.start(NOW), null);
  assert.equal(idle.st.alarm, null);
  assert.deepEqual(writes(idle.st), [["deleteAlarm"]]);
});

/* ---- onIngestWork (calculations R14), R9's notice ---- */

test("R24, R9, R17: it registers once with calculations' onIngestWork, as scheduler; each call arms the alarm at once at ingestWake's instant, never pushes it later, runs no tick and writes nothing but the alarm", async () => {
  const { s, st, calls, set, o } = world({ [IN]: { due: null, wake: null } });
  const out = s.listenTo({ calculations: o.calculations });
  assert.deepEqual(out.calculations, { ok: true, module: "scheduler" });
  assert.deepEqual(called(calls, "calculations.onIngestWork"), ["scheduler"]);
  assert.equal(o.calculations.listeners.length, 1);
  assert.deepEqual(s.faults(), []);
  assert.equal(await s.start(NOW), null, "idle: no alarm");
  st.log.length = 0;
  const t0 = Date.now();
  set[IN].wake = (now) => now;   /* an ingest over the threshold started: a record is ingesting */
  const armed = await o.calculations.listeners[0]({ at: t0 });
  assert.ok(armed >= t0 && armed <= Date.now(), `armed at once: ${armed}`);
  assert.equal(st.alarm, armed);
  assert.deepEqual(writes(st), [["setAlarm", armed]], "the alarm alone");
  set[IN].wake = armed + 60_000;
  await o.calculations.listeners[0]({ at: armed + 60_000 });
  assert.equal(st.alarm, armed, "never pushed later (R4)");
  assert.deepEqual(called(calls, "calculations.ingestTick"), [], "no slice ran on the notice");
  /* a storage that fails the arm is never thrown into calculations' act */
  const w2 = world({ [IN]: { wake: NOW } });
  const broken = new Scheduler({ storage: { ...storage(), getAlarm: async () => { throw new Error("storage gone"); } }, owners: { calculations: () => w2.o.calculations } });
  broken.listenTo({ calculations: w2.o.calculations });
  assert.equal(await w2.o.calculations.listeners[0]({ at: NOW }), null);
  /* a refused registration is a start-up fault, never ignored */
  const refused = world({ [IN]: { wake: null }, "ingest-work": { tick: { ok: false, reason: "REGISTRATION_CLOSED" } } });
  refused.s.listenTo({ calculations: refused.o.calculations });
  assert.deepEqual(refused.s.faults().map((f) => [f.notice, f.reason]), [["calculations", "REGISTRATION_CLOSED"]]);
});

test("R24, R1: an onIngestWork call made inside a firing arms nothing of its own: the firing's reconcile stands", async () => {
  let queued = false;
  const { s, st, o } = world({ "file-scan": { wake: () => (queued ? null : NOW),
    tick: async () => { queued = true; return { ok: true, told: (await o.calculations.listeners[0]({ at: NOW + 9 })) ?? null }; } },
    [IN]: { wake: () => (queued ? NOW + 9_000 : null) } });
  s.listenTo({ calculations: o.calculations });
  st.log.length = 0;
  const r = await s.onAlarm(NOW);
  assert.equal(r.filescan.told, null, "the notice answered nothing and set nothing");
  assert.equal(r.nextAt, NOW + 9_000, "the firing's own reconcile set the alarm");
  assert.deepEqual(writes(st).filter(([m]) => m === "setAlarm"), [["setAlarm", NOW + 9_000]], "set once");
});

/* ---- through the real calculations (R-SEAM; red by name until calculations' tier 2 merges) ---- */

const FIELDS = [{ name: "payer", type: "string" }, { name: "payee", type: "string" }, { name: "amount", type: "number" }];
const ROLES = { payer: { role: "payer", scheme: "ellery_person" }, payee: { role: "payee", scheme: "ellery_person" }, amount: { role: "amount" } };
const BIND = { amount: "amount", payer: "payer", payee: "payee", kind: { value: "payment" }, phase: { value: "actual" },
  stage: { value: "paid" }, basis: { value: "cash" }, currency: { value: "USD" }, period: { value: "2025-07-01/2026-06-30" } };

test("R24, R7, R9 (seam: calculations R14 not merged): the real calculations offers ingestDue, ingestWake, ingestTick and onIngestWork, and the registration takes", async () => {
  const w = seeded();
  for (const m of ["ingestDue", "ingestWake", "ingestTick", "onIngestWork"])
    assert.equal(typeof w.c[m], "function", `calculations does not offer ${m}: its G55 tier 2 has not merged`);
  const s = new Scheduler({ storage: storage(), owners: { calculations: () => w.c } });
  assert.deepEqual(s.listenTo({ calculations: w.c }).calculations.ok, true);
  assert.deepEqual(s.faults(), []);
  assert.deepEqual(s.consumers(), [IN]);
  assert.equal(await s.start(Date.now()), null, "no record ingesting: no alarm, nothing asked of a table");
  const r = await s.onAlarm(Date.now());
  assert.deepEqual([r.nextAt, "ingest" in r], [null, false]);
});

test("R24, R9, R11, R15 (seam: calculations R14 not merged): an ingest over the inline threshold arms the alarm at once, the alarm's firings run its slices to the end, and the alarm is then deleted; a fresh scheduler over the same store re-arms a record left ingesting", async () => {
  assert.equal(typeof calculations.INGEST_INLINE_ROWS, "number", "calculations does not export INGEST_INLINE_ROWS: its G55 tier 2 has not merged");
  const rows = calculations.INGEST_INLINE_ROWS + 1;
  const w = seeded();
  w.person("Pat Quill", "P001");
  w.person("Lee Quill", "P002");
  let text = "payer,payee,amount\n";
  for (let i = 0; i < rows; i++) text += `U${String(i).padStart(7, "0")},P002,${(i % 97) + 1}\n`;
  const t = await w.table(text, FIELDS, { roles: ROLES }, {});
  const b = w.c.adoptBinding({ table: t.sha, roles: BIND, by: V("bob") });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { calculations: () => w.c } });
  s.listenTo({ calculations: w.c });
  const act = await w.c.ingestMoney({ binding: b.binding, rows: "all", reason: "the whole ledger is the request's subject", by: V("bob") });
  assert.equal(act.state, "ingesting", JSON.stringify(act).slice(0, 300));
  await new Promise((r) => setTimeout(r, 0));   /* the notice is told after the act commits */
  assert.notEqual(st.alarm, null, "the alarm is armed at once (R9)");
  /* a fresh scheduler over the same store: the record is still ingesting, so the start re-arms (R11) */
  const fresh = new Scheduler({ storage: storage(), owners: { calculations: () => w.c } });
  assert.notEqual(await fresh.start(Date.now()), null, "re-armed at start");
  let last = null;
  for (let i = 0; i < 50; i++) { last = await s.onAlarm(Date.now() + i); if (last.nextAt === null) break; }
  assert.equal(last.nextAt, null, "the slices ran to the end and the alarm is deleted (R15)");
  assert.equal(st.alarm, null);
  assert.ok(!w.c.ingestDue(Date.now()), "no record is ingesting any more (calculations R14: `ingestDue` answers false when none is due)");
});
