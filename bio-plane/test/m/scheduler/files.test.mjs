/* scheduler — T36-29, T37-24 (R24; N707, N762; K1913, K1929, K2129, K2153, K2175, K2188): the five consumers of
   `file-safety`, after `dated-waits`, each calling its owner's batch, its answer under its R2 key: `file-scan` (its R4),
   `file-render` (its R12), `file-deeper` (its R36), `file-forward` (its R35, with no period of ours) and `file-reputation`
   (its R41). Each one's due and wake are what file-safety R39 answers at `now`, asked afresh every time; this module
   keeps no instant, period or interval for any of them (R7). When the plane hands it file-safety, it registers once with
   `onFileWork` (its R40), whose call arms the alarm (R9). The first tests drive a stand-in shaped as file-safety states its
   services (`fixture.mjs`); the last drive the real `file-safety` in its own test world. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as scheduler from "../../../src/scheduler/index.mjs";
import { world, storage, writes, NOW, FILE_CONSUMERS, pinNow } from "./fixture.mjs";
import { world as fsWorld, pdf } from "../file-safety/fixture.mjs";
import { FILE_SAFETY_CHECKS } from "../../../src/file-safety/index.mjs";
import { batchTickAnswers, declaredRefusals } from "../file-safety/fixtures.mjs";

const { SCHEDULER_ORDER, SCHEDULER_KEYS, RANKED, DAILY, ALWAYS_DUE, FILE_SAFETY_CONSUMERS, SCHED_GRACE_MS, Scheduler, schedulerOf } = scheduler;
const FIVE = ["file-scan", "file-render", "file-deeper", "file-forward", "file-reputation"];
const KEYS = ["filescan", "filerender", "filedeeper", "fileforward", "filereputation"];
const WAKES = ["scanWake", "renderWake", "deeperWake", "forwardWake", "reputationWake"];
const BATCHES = ["scanBatch", "renderBatch", "deeperBatch", "forwardSecurityCounts", "refreshReputationLists"];
const iso = (ms) => new Date(ms).toISOString();
const called = (calls, m) => calls.filter(([x]) => x === m).map(([, a]) => a);
const batchCalls = (calls) => calls.filter(([m]) => BATCHES.some((b) => m === `fileSafety.${b}`));
/* every one of the five with the wake given (the instant, or null), and the rest of the registry idle */
const wanting = (wakes) => Object.fromEntries(FIVE.map((n, i) => [n, { wake: wakes[i] }]));

/* ---- the registry (R5, R2) ---- */

test("R24, R5, R2: the five stand after dated-waits, in R24's order, before R25's document-copy, each answering under its own key (filescan, filerender, filedeeper, fileforward, filereputation); without file-safety they are absent", () => {
  assert.deepEqual([...FILE_SAFETY_CONSUMERS], FIVE);
  assert.deepEqual([...FILE_CONSUMERS], FIVE, "the fixture's list is the module's");
  assert.deepEqual(SCHEDULER_ORDER.slice(SCHEDULER_ORDER.indexOf("dated-waits")), ["dated-waits", ...FIVE, "document-copy", "question-explore", "register-import", "discard-clear", "mail-clear", "ingest"], "then document-copy, then R26's question-explore (T41), then T53's three (R34, R35), then G55's ingest");
  assert.deepEqual(FIVE.map((n) => SCHEDULER_KEYS[n]), KEYS);
  for (const n of FIVE) {
    assert.equal(RANKED.includes(n), false, `${n}: given its now alone`);
    assert.equal(DAILY.includes(n), false, `${n}: no local day of R21's`);
    assert.equal(ALWAYS_DUE.includes(n), false, `${n}: R6's five are unchanged`);
  }
  const { s } = world({}, null, { daily: true, files: true });
  const names = s.consumers();
  assert.deepEqual(names.slice(names.indexOf("dated-waits")), ["dated-waits", ...FIVE], "no case-carriage owner: the five last");
  assert.deepEqual(world().s.consumers().filter((n) => FIVE.includes(n)), [], "no file-safety owner: none of the five");
});

test("R2, R24: each of the five that ticks answers under its key, the owner's answer as it is; one that did not tick is absent", async () => {
  const real = await batchTickAnswers();   /* file-safety's own answers: the deeper batch's and the forward counts' */
  const answers = [{ ok: true, scanned: 2, found: 0, not_scanned: 0, remaining: 0 },
    { ok: true, rendered: 1, failed: 0, none: 0, data: 0, copies: { made: 0, failed: 0, queued: 0 }, remaining: 0 },
    real.deeper,
    real.forward,
    { ok: true, refreshed: [{ tool_id: "rep-1", list_version: "v2", fetched_at: iso(NOW) }], failed: [], skipped: [] }];
  const { s } = world(Object.fromEntries(FIVE.map((n, i) => [n, { wake: NOW, tick: answers[i] }])));
  const r = await s.onAlarm(NOW);
  KEYS.forEach((k, i) => assert.deepEqual(r[k], answers[i], k));
  const quiet = world(wanting([NOW, null, NOW + 1000, null, null]));
  const q = await quiet.s.onAlarm(NOW);
  assert.deepEqual(KEYS.filter((k) => k in q), ["filescan"], "only the one due ticked");
});

test("R24, R8: the plane hands the file-safety owner after construction (hand, or schedulerOf's deps.fileSafety); the five then join, and an owner already held is kept", async () => {
  const w = world({}, null, { files: true });
  const s = new Scheduler({ storage: storage(), owners: {} });
  assert.deepEqual(s.consumers(), []);
  assert.deepEqual(s.hand({ fileSafety: w.o.fileSafety }), { ok: true, handed: ["fileSafety"] }, "an instance");
  assert.deepEqual(s.consumers(), FIVE);
  assert.deepEqual(s.hand({ fileSafety: () => null }), { ok: true, handed: [] }, "already held: kept");
  assert.deepEqual(s.hand(null), { ok: true, handed: [] });
  const ctx = { storage: storage() };
  const made = schedulerOf(ctx, null, { owners: {} });
  assert.deepEqual(made.consumers(), []);
  assert.equal(schedulerOf(ctx, null, { fileSafety: () => w.o.fileSafety }), made, "the one scheduler of the object");
  assert.deepEqual(made.consumers(), FIVE);
});

/* ---- each consumer's call ---- */

test("R24: each consumer calls exactly its batch: scanBatch({at}) and refreshReputationLists({at}) with the firing instant, renderBatch({}), deeperBatch({}), and forwardSecurityCounts({}) with neither from nor to (file-safety R35 chooses the period); nothing names a viewer, a member or a file", async () => {
  const { s, calls } = world(wanting([NOW, NOW, NOW, NOW, NOW]));
  const at = NOW + 100;   /* inside the grace after each wake */
  await s.onAlarm(at);
  assert.deepEqual(called(calls, "fileSafety.scanBatch"), [{ at: iso(at) }]);
  assert.deepEqual(called(calls, "fileSafety.renderBatch"), [{}]);
  assert.deepEqual(called(calls, "fileSafety.deeperBatch"), [{}]);
  assert.deepEqual(called(calls, "fileSafety.forwardSecurityCounts"), [{}], "no from, no to");
  assert.deepEqual(called(calls, "fileSafety.refreshReputationLists"), [{ at: iso(at) }]);
  assert.equal(batchCalls(calls).length, 5, "each batch once");
  assert.doesNotMatch(JSON.stringify(batchCalls(calls).map(([, a]) => a)), /viewer|member|capture|file|name|by/i);
});

/* ---- due and wake: file-safety R39's, asked afresh ---- */

test("R24: each consumer's due and wake are its R39 wake at now (scanWake, renderWake, deeperWake, forwardWake, reputationWake): due when that instant is within the grace, the alarm the earliest of them, none when every one is null", async () => {
  /* each wake in turn the earliest; the others later or none */
  for (let i = 0; i < 5; i++) {
    const wakes = FIVE.map((_, j) => (j === i ? NOW + 60_000 : j % 2 ? null : NOW + 3_600_000));
    const { s, st, calls } = world(wanting(wakes));
    assert.equal(await s.arm(NOW), NOW + 60_000, `${FIVE[i]}: the alarm at its wake`);
    assert.equal(st.alarm, NOW + 60_000);
    const early = await s.onAlarm(NOW + 60_000 - SCHED_GRACE_MS - 1);
    assert.equal(KEYS.some((k) => k in early), false, "not due before its instant, beyond the grace");
    const r = await s.onAlarm(NOW + 60_000 - SCHED_GRACE_MS);
    assert.deepEqual(KEYS.filter((k) => k in r), [KEYS[i]], `${FIVE[i]}: due within the grace (R1)`);
    assert.equal(called(calls, `fileSafety.${WAKES[i]}`).length > 0, true, `${WAKES[i]} asked`);
  }
  const none = world(wanting([null, null, null, null, null]));
  assert.equal(await none.s.arm(NOW), null, "every R39 wake null: no alarm (R15)");
  const r = await none.s.onAlarm(NOW);
  assert.equal(KEYS.some((k) => k in r), false, "none due");
  assert.deepEqual([r.nextAt, none.st.alarm], [null, null]);
  /* an answer that is not an instant in ms is none */
  const odd = world(wanting([iso(NOW), "soon", true, NaN, {}]));
  assert.equal(await odd.s.arm(NOW), null);
  const o = await odd.s.onAlarm(NOW);
  assert.equal(KEYS.some((k) => k in o), false);
});

test("R24, R7: the wakes are asked afresh at every firing, arm and start, each with its now; a wake R39 moves is followed at once, whatever this module saw before", async () => {
  let scanAt = NOW + 5000;
  const { s, calls } = world({ "file-scan": { wake: () => scanAt } });
  assert.equal(await s.start(NOW), NOW + 5000);
  assert.deepEqual(called(calls, "fileSafety.scanWake"), [NOW], "start asks with its now");
  scanAt = NOW + 2000;
  assert.equal(await s.arm(NOW + 1), NOW + 2000, "arm follows the earlier wake");
  const r = await s.onAlarm(NOW + 2000);
  assert.ok("filescan" in r);
  scanAt = NOW + 9_000_000;   /* after the batch, R39 answers a later instant: the reconcile sets it outright */
  const r2 = await s.onAlarm(NOW + 2001);
  assert.equal("filescan" in r2, false);
  assert.equal(r2.nextAt, NOW + 9_000_000);
  scanAt = NOW + 2001;   /* while the last batch answered remaining above 0, R39 answers now: due at the next firing */
  assert.ok("filescan" in (await s.onAlarm(NOW + 2001)));
  assert.ok(called(calls, "fileSafety.scanWake").includes(NOW + 1) && called(calls, "fileSafety.scanWake").includes(NOW + 2001));
});

test("R7: no interval of this module's for any file-safety consumer: no FILE_SCAN_EVERY_MS or FILE_SAFETY_POLL_MS exported, no other interval, and no instant kept: nothing but the alarm is written however the five tick", async () => {
  assert.equal("FILE_SCAN_EVERY_MS" in scheduler, false);
  assert.equal("FILE_SAFETY_POLL_MS" in scheduler, false);
  const numbers = Object.entries(scheduler).filter(([, v]) => typeof v === "number").map(([k]) => k).sort();
  assert.deepEqual(numbers, ["DETECTORS_BUDGET_MS", "SCHED_GRACE_MS"], "the grace, and money-checks' budget (R21), alone");
  const answers = [{ ok: true, remaining: 3 }, { ok: true, remaining: 2, copies: { queued: 1 } }, { ok: true, queued: 1, running: 1 },
                   { ok: true, sent: ["log-1"], failed: [] }, { ok: false, code: "SCANNER_ABSENT" }];
  const { s, st } = world(Object.fromEntries(FIVE.map((n, i) => [n, { wake: NOW, tick: answers[i] }])));
  for (const t of [NOW, NOW + 1000, NOW + 2000]) await s.onAlarm(t);
  await s.arm(NOW + 3000); await s.start(NOW + 3000);
  assert.deepEqual(st.log.filter(([m]) => m === "get" || m === "put"), [], "no value read or written for the five");
  assert.deepEqual([...st.kv.keys()], []);
  assert.deepEqual([...new Set(writes(st).map(([m]) => m))], ["setAlarm"], "the alarm alone");
});

test("R24, R11, R18: a restarted instance re-derives the five's wakes from file-safety's durable state; a sched_files value T36 left in storage is ignored, never read, written or obeyed", async () => {
  const st = storage();
  st.kv.set("sched_files", { "file-scan": { last: NOW, more: false }, "file-forward": { hour: NOW, to: NOW, log: true } });
  const a = world(wanting([NOW, null, null, null, null]), null, { st });
  assert.equal(await a.s.start(NOW + 1000), NOW, "the owner's wake, not the kept day");
  assert.ok("filescan" in (await a.s.onAlarm(NOW + 1000)), "due though T36's value says it ran");
  st.alarm = null;
  const b = world(wanting([null, NOW + 300_000, null, NOW + 3_600_000, NOW + 21_600_000]), null, { st });
  assert.equal(await b.s.start(NOW + 2000), NOW + 300_000, "the earliest the owner states");
  assert.equal(st.alarm, NOW + 300_000);
  assert.deepEqual(st.log.filter(([m, k]) => k === "sched_files"), [], "never read nor written");
  assert.deepEqual(st.kv.get("sched_files"), { "file-scan": { last: NOW, more: false }, "file-forward": { hour: NOW, to: NOW, log: true } }, "left as it was");
});

test("R24, R3: a refusal file-safety answers (one of its declared refusal codes) is the tick's answer, and the next wake is again R39's; a batch or a wake that throws is answered {error} and every other consumer still ticks", async () => {
  const declared = Object.keys(FILE_SAFETY_CHECKS).filter((c) => /_(ABSENT|UNREADABLE|INVALID)$/.test(c));
  const real = await declaredRefusals();   /* file-safety's real refusal of each declared code */
  assert.deepEqual([...declared].sort(), Object.keys(real).sort(), "every declared code has its real refusal");
  const refusals = FIVE.map((_, i) => real[declared[i % declared.length]]);
  const later = [NOW + 86_400_000, NOW + 300_000, NOW + 300_000, NOW + 3_600_000, NOW + 600_000];
  const fired = new Set();
  const set = Object.fromEntries(FIVE.map((n, i) => [n, { wake: () => (fired.has(n) ? later[i] : NOW), tick: () => { fired.add(n); return refusals[i]; } }]));
  const { s } = world(set);
  const r = await s.onAlarm(NOW);
  KEYS.forEach((k, i) => assert.deepEqual(r[k], refusals[i], k));
  assert.equal(r.nextAt, NOW + 300_000, "R39's next wake, the earliest of them");
  for (const [i, what] of [[0, "tick"], [2, "wake"]]) {
    const w = world(wanting([NOW, NOW, NOW, NOW, NOW]));
    w.set[FIVE[i]].throws = what;
    const b = await w.s.onAlarm(NOW);
    assert.deepEqual(b[KEYS[i]], { error: `${FIVE[i]} ${what} broke` }, `${FIVE[i]} ${what}`);
    for (const [j, k] of KEYS.entries()) if (j !== i) assert.ok(k in b, `${k} still ticked`);
    assert.equal(b.nextAt, NOW, "the reconcile still ran over the others' wakes");
  }
});

/* ---- onFileWork (file-safety R40), R9's notice for the five ---- */

test("R24, R9, R17: handed file-safety, the scheduler registers once with onFileWork; each call arms the alarm at once to the earliest wake, writing nothing else and running no batch", async (t) => { pinNow(t);
  const w = world(wanting([null, null, null, null, null]));
  const fs = w.o.fileSafety;
  const st = storage();
  const s = new Scheduler({ storage: st, owners: {} });
  s.hand({ fileSafety: fs });
  s.hand({ fileSafety: fs });
  assert.deepEqual(called(w.calls, "fileSafety.onFileWork"), ["scheduler"], "registered once, as `scheduler`");
  assert.equal(fs.listeners.length, 1);
  assert.deepEqual(s.faults(), []);
  assert.equal(await s.start(NOW), null, "idle: no alarm");
  /* a receipt queued: R39's scan wake is now; file-safety tells it after the act commits */
  w.set["file-scan"].wake = NOW + 10;
  const before = st.log.length;
  await fs.listeners[0]({ batch: "scan", at: NOW + 10 });
  assert.equal(st.alarm, NOW + 10, "armed at that batch's instant");
  assert.deepEqual(writes({ log: st.log.slice(before) }), [["setAlarm", NOW + 10]], "the alarm alone");
  assert.deepEqual(batchCalls(w.calls), [], "no batch ran");
  /* arming never pushes a set alarm later (R4) */
  w.set["file-scan"].wake = null; w.set["file-reputation"].wake = NOW + 99_000;
  await fs.listeners[0]({ batch: "reputation", at: NOW + 99_000 });
  assert.equal(st.alarm, NOW + 10);
  /* a listener's failure to arm is never thrown into file-safety's act */
  const broken = new Scheduler({ storage: { ...storage(), getAlarm: async () => { throw new Error("storage gone"); } }, owners: {} });
  const w2 = world({}, null, { files: true });
  broken.hand({ fileSafety: w2.o.fileSafety });
  w2.set["file-scan"] = { wake: NOW };
  assert.equal(await w2.o.fileSafety.listeners[0]({ batch: "scan", at: NOW }), null);
});

test("R24, R1: an onFileWork call made inside a firing (a batch that queues more work) arms nothing of its own: the firing's reconcile stands", async () => {
  const w = world({}, null, { files: true });
  const st = storage();
  const s = new Scheduler({ storage: st, owners: {} });
  s.hand({ fileSafety: w.o.fileSafety });
  let renderAt = null;
  w.set["file-scan"] = { wake: NOW, tick: async () => { renderAt = NOW + 300_000; await w.o.fileSafety.listeners[0]({ batch: "render", at: renderAt }); return { ok: true, remaining: 0 }; } };
  w.set["file-render"] = { wake: () => renderAt };
  w.set["file-scan"].wake = () => (renderAt === null ? NOW : null);
  const r = await s.onAlarm(NOW);
  assert.ok("filescan" in r);
  assert.equal(r.nextAt, NOW + 300_000);
  assert.deepEqual(writes(st), [["setAlarm", NOW + 300_000]], "one alarm write, the reconcile's");
});

test("R24, R23: a refused onFileWork registration (LISTENER_DECLARED, LISTENER_MALFORMED), or a file-safety offering none, is a start-up fault in faults(), never ignored; the five still run", async () => {
  for (const code of ["LISTENER_DECLARED", "LISTENER_MALFORMED"]) {
    const w = world({ "file-work": { tick: { ok: false, reason: code, detail: "refused" } } }, null, { files: true });
    const s = new Scheduler({ storage: storage(), owners: {} });
    s.hand({ fileSafety: w.o.fileSafety });
    assert.deepEqual(s.faults(), [{ notice: "fileSafety", reason: code, detail: "refused" }], code);
    assert.deepEqual(s.consumers(), FIVE, "the consumers stand");
  }
  const bare = { ...world({}, null, { files: true }).o.fileSafety };
  delete bare.onFileWork;
  const s = new Scheduler({ storage: storage(), owners: {} });
  s.hand({ fileSafety: bare });
  assert.deepEqual(s.faults().map((f) => [f.notice, f.reason]), [["fileSafety", "NOTICE_ABSENT"]]);
  const thrower = { ...bare, onFileWork() { throw new Error("no"); } };
  const s2 = new Scheduler({ storage: storage(), owners: {} });
  s2.hand({ fileSafety: thrower });
  assert.deepEqual(s2.faults(), [{ notice: "fileSafety", reason: "NOTICE_THREW", detail: "no" }]);
  assert.deepEqual(world().s.faults(), [], "no file-safety handed: no fault");
});

test("R24 (K1892, K1929): nothing the five pass or answer names who opened a file, and nothing of theirs is kept", async () => {
  const { s, st, calls } = world(wanting([NOW, NOW, NOW, NOW, NOW]));
  const r = await s.onAlarm(NOW);
  assert.doesNotMatch(JSON.stringify([batchCalls(calls), KEYS.map((k) => r[k])]), /member|viewer|opened|by"|capture_sha|captureSha/i);
  assert.equal(st.kv.size, 0);
});

/* ---- against the real file-safety (its own test world, `test/m/file-safety/fixture.mjs`) ---- */

/* the earliest of the real file-safety's own R39 wakes at `now` */
const earliest = (fs, now) => { const ws = WAKES.map((m) => fs[m](now)).filter((x) => x !== null); return ws.length ? Math.min(...ws) : null; };

test("R24, R9: against the real file-safety, a capture received tells onFileWork, which arms the alarm at once; the firing scans it and renders one view; while views stay queued the alarm is R39's wake, the firing instant, for the next firing, and the wake ends after the last view", async () => {
  const w = fsWorld();
  const st = storage();
  const s = new Scheduler({ storage: st, owners: {} });
  assert.deepEqual(s.hand({ fileSafety: w.fs }), { ok: true, handed: ["fileSafety"] });
  assert.deepEqual(s.faults(), [], "the real onFileWork took the listener");
  const T = w.clock.now;
  assert.equal(await s.start(T), null, "nothing held: no wake");
  for (let i = 1; i <= 3; i++) { await w.capture(pdf(false, `sched-${i}`)); w.tick(1000); }
  for (let i = 0; i < 20 && st.alarm === null; i++) await new Promise((ok) => setTimeout(ok, 5));
  /* the listener arms on the runtime's clock (Date.now()), where R39's scan wake is at once */
  assert.ok(st.alarm !== null && st.alarm <= Date.now(), `armed by the receipt, at once: ${st.alarm}`);
  const at = w.clock.now;
  const r = await s.onAlarm(at);
  assert.deepEqual([r.filescan.ok, r.filescan.scanned, r.filescan.remaining], [true, 3, 0], JSON.stringify(r.filescan));
  assert.equal(w.calls("/scan").length, 1, "one batch to the scanner");
  assert.equal(r.filerender.ok, true, JSON.stringify(r.filerender));
  assert.equal(r.nextAt, earliest(w.fs, at), "R39's earliest wake");
  /* R39 (K4902): while a view or safe copy stays queued the render wake is `now`, one render a tick; the alarm is re-armed for the next
     firing, never a loop inside this one (this onAlarm returned after one render), and the run is bounded: the wake ends after the last view */
  let last = r, firings = 1;
  while (last.nextAt !== null && last.nextAt <= at && firings < 10) {
    assert.equal(last.nextAt, at, "while views are queued the wake is the firing instant");
    assert.equal(st.alarm, last.nextAt, "the alarm is set for the next firing");
    last = await s.onAlarm(at);
    firings++;
  }
  assert.ok(firings <= 4, `bounded: ${firings} firings for three views`);
  assert.ok(last.nextAt === null || last.nextAt > at, `no spin: ${last.nextAt} after ${at}`);
  assert.equal("fileforward" in r, false, "no log tool on: forward wants no wake (R39)");
  assert.equal("filereputation" in r, false, "no reputation tool on: none (R39)");
  /* a week on, the re-scan falls due (file-safety R4, R39) */
  const next = last.nextAt ?? at + 7 * 86_400_000;
  w.clock.now = next;
  const again = await s.onAlarm(next);
  assert.ok("filescan" in again || "filerender" in again, JSON.stringify(again));
});

test("R24: against the real file-safety with no scanner bound, scan and render each want no wake (R39: no renderer bound, no render wake), so neither ticks, filerender is absent, and the alarm is R39's earliest wake, never at once nor crawling", async () => {
  const w = fsWorld({ bound: false });
  await w.capture(pdf(false, "sched-unbound"));
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { fileSafety: () => w.fs } });
  const now = w.clock.now;
  assert.deepEqual([w.fs.scanWake(now), w.fs.renderWake(now)], [null, null], "R39: neither wants a wake with no scanner bound");
  const r = await s.onAlarm(now);
  assert.equal("filescan" in r, false, "no scanner bound: scan not due");
  assert.equal("filerender" in r, false, "no renderer bound: render not due, so no RENDERER_ABSENT tick");
  assert.equal(r.nextAt, earliest(w.fs, now), "R39's earliest wake");
  assert.equal(st.alarm, r.nextAt, "the alarm as the reconcile set it");
  assert.ok(r.nextAt === null || r.nextAt > now, `never at once: ${r.nextAt}`);
  /* five minutes on (file-safety's poll), render still wants no wake: no tick, no crawl */
  const later = now + 300_000;
  w.clock.now = later;
  const again = await s.onAlarm(later);
  assert.equal("filerender" in again, false, "still no render tick");
  assert.equal(again.nextAt, earliest(w.fs, later));
});
