/* store-assembly's copy of plane's test. plane R97, R98, R101, R103-R110 -> R74, R75, R76, R65 (R103's fields), R77-R82 (fix round 9, G126, G126e, G126i, G126j, G127c, G129b-e, G93, G94, G123g; K4835, K4837, K4838, K4848; plan section 2c item 1): THE JOB TABLE AND
   ITS ONE REGISTRAR, at the module's interface, over the assembled store on the suite's storage (`alarmed-store.mjs`). The provided names of job 37's row: `jobRow` (R74's row read back whole), `registerJob` (R75, the
   registrar), `jobCounters` (R74's counters: written, skipped, owed, failed and `failed_why`), `attemptStamp` (R76's per-unit stamp), `healFrame` (plane R102's look on each request: the class's, its test stays in plane) and
   `watchdogRan` (plane R103's field). The owners below the table (extraction's `readHeld`, acquisition's owners) are scripted doubles of the reader contract (`counters`, `more`, `final`, `killed`):
   each test says what it asks of the double. The through-the-door and real-alarm checks are `r8-heal-door`, `r8-lag` and `r8-wave` (workerd, plane's) and control-plane's seam (section 3b). The cpu_ms config test (plane R99, `wrangler.jsonc`) and the heal-frame test (plane R102) are the Worker's and the class's, and stay in plane. */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store } from "./alarmed-store.mjs";
import { bucketStandIn } from "../case-carriage/fixture.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
/* the owners' published answers, made by their real code: extraction's `readHeldAnswer`, acquisition's `owedFetchAnswer` */
const { readHeldAnswer: { read: readDone, ...readHeld } } = await import("../extraction/fixtures.mjs");
const { owedFetchAnswer } = await import("../acquisition/fixtures.mjs");
import { pendingOf, pendingOps, administersOf, JOB_KINDS, JOB_STATES, WATCHDOG_FIELDS, PAGE_KILLED_READER, NO_PROGRESS, UNIT_KILLS_MAX, unitOf, TICK_FIGURES }
  from "../../../src/store-assembly/pending.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const SESSION_KEYED = ["subresources", "fetch"];
const keyOf = (kind, s) => (SESSION_KEYED.includes(kind) ? { session: `s-${s}` } : { sha: sha(s) });
const rowsOf = (x) => [...x.ctx.storage.sql.exec(`SELECT * FROM keeps_pending ORDER BY registered_at, sha, kind`)];
let began = () => {};
const NEVER = () => { began(); return new Promise(() => {}); };
const alarm = (x, at) => Promise.race([x.s.onAlarm(at), new Promise((r) => { began = () => r("killed"); })]);

async function world(db, { readAnswer = null, workers = null } = {}) {
  const x = await store({ db, env: { CAPTURES: bucketStandIn() }, before: workers ? (ctx, env) => pendingOf(ctx, { env, workers }) : null });
  x.read = [];
  if (readAnswer) extractionOf(x.ctx).readHeld = async (a) => { x.read.push(a); const k = readAnswer(a); return k === "read" ? readDone() : k; };   /* "read": extraction's published read-to-its-end answer */
  x.jobs = pendingOf(x.ctx);
  return x;
}

/* ---- R74: the job table ---- */

test("R74 jobRow: one row for each (sha or session, kind), for every kind of the table, reads back every column, `queued` at its registration", async () => {
  const x = await world();
  assert.deepEqual([...JOB_KINDS], ["keep", "reading", "ocr", "subresources", "unpack", "fetch", "scan", "safe_view", "grade", "ingest"]);
  assert.deepEqual([...JOB_STATES], ["queued", "fetching", "reading", "partial", "refused", "finished", "final"]);
  const part = sha("part 1");
  for (const kind of JOB_KINDS) {
    const k = keyOf(kind, kind);
    const r = x.jobs.registerJob({ kind, ...k, cursor: { next_page: 3 }, owed: 7, carrier: `snapshots/upload-${kind}`, parts: [part],
                                   detail: { project: "PROJ-2026-0001" }, verdict: { ok: true, size: 10, limit: 20, bound_key: "pdf.bytes" }, priority: "raised", member: "member:ann" });
    assert.deepEqual(r, { ok: true, existed: false, state: "queued" }, kind);
    const row = x.jobs.jobRow({ sha: k.sha ?? k.session, kind });
    for (const col of ["state", "verdict", "cursor", "written", "skipped", "owed", "failed", "failed_why", "last_progress_at", "rate_per_s", "carrier", "reader_version", "priority"])
      assert.ok(Object.hasOwn(row, col), `${kind}: ${col}`);
    assert.deepEqual([row.state, row.cursor, row.owed, row.carrier, row.priority, row.parts, row.verdict, row.written, row.skipped, row.failed, row.failed_why, row.member],
                     ["queued", { next_page: 3 }, 7, `snapshots/upload-${kind}`, "raised", [part], { ok: true, size: 10, limit: 20, bound_key: "pdf.bytes" }, 0, 0, 0, {}, "member:ann"], kind);
  }
  const names = [...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('job_unit_attempts','job_batches')`)].map((r) => r.name).sort();
  assert.deepEqual(names, ["job_batches", "job_unit_attempts"], "R74: the unit stamps and the batch ledger beside it");
});

test("R74 R77 job_batches: a batch landed twice writes once, by (sha, kind, batch); another batch or kind lands", async () => {
  const x = await world();
  const d = sha("an ingest of 25,000 rows");
  assert.equal(x.jobs.landBatch({ sha: d, kind: "ingest", batch: 0 }), true);
  assert.equal(x.jobs.landBatch({ sha: d, kind: "ingest", batch: 0 }), false, "a batch lands once");
  assert.equal(x.jobs.landBatch({ sha: d, kind: "ingest", batch: 1 }), true);
  assert.equal(x.jobs.landBatch({ sha: d, kind: "reading", batch: 0 }), true, "another kind's batch 0 is its own");
  assert.equal([...x.ctx.storage.sql.exec(`SELECT COUNT(*) AS n FROM job_batches`)][0].n, 3);
});

test("R74: a ledger of the old shape opens with every row kept: an owed row is `queued`, a row ended for a stated reason is `final` with it, the new counters start at none", async () => {
  const x = await world();
  const db = x.db, sql = x.ctx.storage.sql;
  sql.exec(`DROP TABLE keeps_pending`);
  sql.exec(`CREATE TABLE keeps_pending (sha TEXT NOT NULL, kind TEXT NOT NULL, parts TEXT NOT NULL DEFAULT '[]', detail TEXT NOT NULL DEFAULT '{}', attempts INTEGER NOT NULL DEFAULT 0,
            registered_at INTEGER NOT NULL, due_at INTEGER NOT NULL, last_try INTEGER, last_why TEXT, final_why TEXT, started_at INTEGER, interrupted INTEGER NOT NULL DEFAULT 0,
            last_ms INTEGER, last_mem INTEGER, own_ms INTEGER, wait_ms INTEGER, PRIMARY KEY (sha, kind))`);
  sql.exec(`INSERT INTO keeps_pending (sha, kind, detail, attempts, registered_at, due_at, interrupted) VALUES (?, 'reading', '{"cursor":"c4"}', 2, 100, 200, 1)`, sha("owed"));
  sql.exec(`INSERT INTO keeps_pending (sha, kind, attempts, registered_at, due_at, last_try, final_why, last_why) VALUES (?, 'ocr', 3, 100, 200, 300, 'PASSWORD_REQUIRED', 'PASSWORD_REQUIRED')`, sha("ended"));
  sql.exec(`DROP TABLE IF EXISTS job_unit_attempts`);
  const y = await world(db);
  const owed = y.jobs.jobRow({ sha: sha("owed"), kind: "reading" }), ended = y.jobs.jobRow({ sha: sha("ended"), kind: "ocr" });
  assert.deepEqual([owed.state, owed.detail, owed.attempts, owed.interrupted, owed.written, owed.owed, owed.failed], ["queued", { cursor: "c4" }, 2, 1, 0, 0, 0]);
  assert.deepEqual([ended.state, ended.final_why, ended.ended_at], ["final", "PASSWORD_REQUIRED", 300]);
  assert.deepEqual(y.jobs.list().map((r) => [r.kind, r.state, r.job_state]), [["reading", "owed", "queued"], ["ocr", "final", "final"]]);
  pendingOf(y.ctx).migrate();
  assert.equal(rowsOf(y).length, 2, "a second migration changes nothing");
});

test("R74 jobCounters: the counters a reader answers are written on its row (a piece with none moves the cursor, a failure is counted by cause, the finishing answer's written and skipped are kept); a finished row stays, `finished`", async () => {
  /* extraction's real ticks: two `more` pieces (no counters, each moving the cursor), then the finishing answer with its counters */
  const [p0, p1] = await readHeld.pieces(3);
  const done = await readHeld.finished();
  const pieces = [p0, { ok: false, reason: "STORE_BUSY" },   // fixtures-generic: STORE_BUSY   (a transient word no module gives: a failure is counted by its cause, whatever the word)
                  p1, done.answer];
  const x = await world(undefined, { readAnswer: () => pieces.shift() });
  const d = sha("a text read in pieces");
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  await x.s.onAlarm(at);
  let r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.written, r.skipped, r.owed, r.cursor], ["partial", 0, 0, 0, p0.detail]);
  assert.ok(r.last_progress_at !== null);
  await x.s.onAlarm((at += 1000));
  r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.failed, r.failed_why], ["queued", 1, { STORE_BUSY: 1 }], "a failure counted by its cause, the row owed again after its back-off");
  await x.s.onAlarm((at += 3_600_000));
  await x.s.onAlarm((at += 1000));
  r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.written, r.skipped, r.final_why], ["finished", done.counters.written, done.counters.skipped, null]);
  assert.deepEqual(x.jobs.list({ sha: d }), [], "the document's page owes nothing");
});

test("R74 G126j (control): a reading that is held with pictures still owed is not ended by that answer; it ends when a reading held says nothing is owed", async () => {
  /* extraction's real ticks: a scan that leaves its pictures owed (`owed: true`, its `ocr` entry registered), then a reading already held (READING_HELD, counters) */
  const owed = await readHeld.scanOwed();
  const held = await readHeld.held();
  const answers = [owed.answer, held];
  /* the scan's `ocr` entry is registered with the owed answer and is its own row: it is asked beside the reading and takes no answer of the reading's */
  const x = await world(undefined, { readAnswer: (a) => (a.kind === "ocr" ? held : answers.shift()) });
  const d = sha("a reading whose pictures are owed");
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  await x.s.onAlarm(at);
  let r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.notEqual(r.state, "finished", "pictures are owed: the owner's answer that it read is no end");
  assert.equal(r.last_why, "OWED");
  /* at most one heavy piece in a tick: the scan's `ocr` row, registered by the owed answer, takes a tick of its own beside the reading's */
  for (let i = 0; i < 3 && r.state !== "finished"; i++) {
    await x.s.onAlarm((at = Math.max(at, r.due_at) + 1000));
    r = x.jobs.jobRow({ sha: d, kind: "reading" });
  }
  assert.deepEqual([r.state, r.owed, r.written], ["finished", 0, held.counters.written]);
});

test("R74 G129d: a picture whose OCR failed transiently keeps its `ocr` row (an `UNREADABLE` pass that read nothing is no end), and ends once read; nothing owed ends it", async () => {
  const answers = [{ ok: true, read: false, why: "UNREADABLE" }, { ok: true, read: false, why: "UNREADABLE" }, { ok: true, read: false, why: "UNREADABLE" }, { ok: true, read: true }];
  const x = await world(undefined, { readAnswer: () => answers.shift() });
  const d = sha("a JPEG whose OCR member was down for three ticks");
  x.jobs.registerJob({ kind: "ocr", sha: d });
  let at = Date.now() + 1000;
  for (let i = 0; i < 3; i++, at += 3_600_000) {
    await x.s.onAlarm(at);
    const r = x.jobs.jobRow({ sha: d, kind: "ocr" });
    assert.ok(!["finished", "final"].includes(r.state), `pass ${i + 1}: the row stands (${r.state}, ${r.last_why})`);
  }
  await x.s.onAlarm(at);
  assert.equal(x.jobs.jobRow({ sha: d, kind: "ocr" }).state, "finished");
  /* nothing owed of the digest (no pages left) is an end */
  const y = await world(undefined, { readAnswer: () => ({ ok: true, read: false, why: "NO_PAGES_LEFT" }) });
  y.jobs.registerJob({ kind: "ocr", sha: d });
  await y.s.onAlarm(Date.now() + 1000);
  assert.equal(y.jobs.jobRow({ sha: d, kind: "ocr" }).state, "finished");
});

test("R74 G127c: a fetch refused for a capture another bundle holds ends `final` with the refused digest, its holder and whether it is a whole or a part on the row, never `detail {}`", async () => {
  const x = await world(undefined, {});
  const { acquisitionOf } = await import("../../../src/acquisition/index.mjs");
  /* acquisition's real refusal for a capture another bundle holds: its `detail` names the whole and its holder */
  acquisitionOf(x.ctx).owedFetch = async () => owedFetchAnswer({ kind: "final" });
  const facts = (await owedFetchAnswer({ kind: "final" })).detail;
  x.jobs.registerJob({ kind: "fetch", session: "s-held" });
  await x.s.onAlarm(Date.now() + 1000);
  const r = x.jobs.jobRow({ sha: "s-held", kind: "fetch" });
  assert.deepEqual([r.state, r.final_why], ["final", "CAPTURE_HELD_BY_ANOTHER_BUNDLE"]);
  assert.deepEqual(r.failed_why.CAPTURE_HELD_BY_ANOTHER_BUNDLE, { kind: facts.kind, capture_sha: facts.capture_sha, holder: facts.holder });
  assert.deepEqual(x.jobs.list({ sha: "s-held" }).map((e) => [e.state, e.why, e.failed_why.CAPTURE_HELD_BY_ANOTHER_BUNDLE.kind]), [["final", "CAPTURE_HELD_BY_ANOTHER_BUNDLE", facts.kind]]);
});

test("R97 R74: the assembly's own tables, the job table with `job_unit_attempts` and `job_batches` beside `keeps_last` and `acquire_stages`, are declared to record-core's purge by store-assembly, and no other row is its", async () => {
  const x = await world();
  const { recordOf } = await import("../../../src/record-core/index.mjs");
  for (const t of ["keeps_pending", "keeps_last", "acquire_stages", "job_unit_attempts", "job_batches"])
    assert.equal(recordOf(x.ctx).declarePurge("zz-probe", [t]).declaredBy, "store-assembly", t);
});

/* ---- R75: the one registrar ---- */

test("R75 registerJob: synchronous, never throws; a malformed entry is refused with its reason; a second registration re-arms, keeps every counter, changes cursor, owed, detail and parts only when given; `raised` is never lowered", async () => {
  const x = await world();
  const reg = x.jobs.registerJob;
  for (const [e, reason] of [[null, "JOB_ENTRY_INVALID"], [{ kind: "nope", sha: sha("a") }, "JOB_KIND_UNKNOWN"], [{ kind: "reading", sha: "ABC" }, "JOB_SHA_INVALID"],
                             [{ kind: "fetch", sha: sha("a") }, "JOB_SESSION_MISSING"], [{ kind: "keep", sha: sha("a") }, "JOB_ENTRY_INVALID"],
                             [{ kind: "reading", sha: sha("a"), parts: ["x"] }, "JOB_ENTRY_INVALID"], [{ kind: "reading", sha: sha("a"), owed: -1 }, "JOB_ENTRY_INVALID"]]) {
    const r = reg(e);
    assert.ok(!(r instanceof Promise), "synchronous");
    assert.deepEqual(r, { ok: false, reason }, JSON.stringify(e));
  }
  /* a store that throws: an answer, never a throw */
  const exec = x.ctx.storage.sql.exec;
  x.ctx.storage.sql.exec = () => { throw new Error("the store refused"); };
  try { assert.equal(reg({ kind: "reading", sha: sha("b") }).reason, "JOB_NOT_KEPT"); } finally { x.ctx.storage.sql.exec = exec; }
  const d = sha("a document read in pieces");
  assert.deepEqual(reg({ kind: "reading", sha: d, cursor: "c0", owed: 4, priority: "raised", detail: { cursor: "c0" } }), { ok: true, existed: false, state: "queued" });
  x.ctx.storage.sql.exec(`UPDATE keeps_pending SET written=12, skipped=1, failed=2, failed_why='{"X":2}', attempts=5, due_at=?, final_why='GAVE_UP', state='final' WHERE sha=?`, Date.now() + 9e9, d);
  assert.deepEqual(reg({ kind: "reading", sha: d }), { ok: true, existed: true, state: "queued" }, "re-armed");
  let r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.written, r.skipped, r.failed, r.failed_why, r.attempts, r.final_why, r.cursor, r.owed, r.detail, r.priority],
                   [12, 1, 2, { X: 2 }, 0, null, "c0", 4, { cursor: "c0" }, "raised"], "counters kept; nothing not given changed; raised kept");
  assert.ok(r.due_at <= Date.now(), "due now");
  reg({ kind: "reading", sha: d, cursor: "c9", owed: 1, detail: { cursor: "c9" } });
  r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.cursor, r.owed, r.detail, r.written], ["c9", 1, { cursor: "c9" }, 12]);
  /* a refusal by the plan step's bound: the row is `refused`, stated */
  const big = sha("a file over its bound");
  assert.deepEqual(reg({ kind: "reading", sha: big, verdict: { ok: false, size: 60, limit: 50, bound_key: "csv.bytes" } }), { ok: true, existed: false, state: "refused" });
  assert.deepEqual(x.jobs.list({ sha: big }).map((e) => [e.state, e.job_state, e.why]), [["final", "refused", "csv.bytes"]]);
});

test("R75: the registrar's row commits or rolls back with the caller's transaction; the alarm is armed by `armJobs` after the commit", async () => {
  const x = await world();
  const d = sha("a filing that rolls back"), e = sha("a filing that commits");
  assert.throws(() => x.ctx.storage.transactionSync(() => { assert.equal(x.jobs.registerJob({ kind: "reading", sha: d }).ok, true); throw new Error("the filing failed"); }));
  assert.equal(x.jobs.jobRow({ sha: d, kind: "reading" }), null, "no row without its filing");
  x.ctx.storage.transactionSync(() => x.jobs.registerJob({ kind: "reading", sha: e }));
  assert.equal(x.jobs.jobRow({ sha: e, kind: "reading" }).state, "queued");
  await x.ctx.storage.deleteAlarm();
  await x.jobs.armJobs();
  assert.equal(typeof (await x.ctx.storage.getAlarm()), "number", "armed after the commit");
});

test("R75: the composition wires ONE registrar: capture's `registerJob` and `armJobs` write and arm the plane's table, beside `keepLater`; an upload registers its `reading` row in its filing with its carrier, and the row is the same one a second upload re-arms", async () => {
  const x = await world();
  const cap = captureOf(x.ctx);
  assert.equal(typeof cap.registerJob, "function");
  assert.equal(typeof cap.armJobs, "function");
  const bytes = new TextEncoder().encode("the clerk's minutes, uploaded\n".repeat(20));
  const up = await cap.uploadCapture({ bytes, statement: "handed to me at the meeting", name: "minutes.txt", type: "text/plain", by: "member:ann", at: "2026-10-24T10:00:00Z" });
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
  const d = up.capture.sha256;
  const r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.kind, r.carrier], ["reading", `snapshots/upload-${d}`]);
  assert.equal(up.jobs, undefined, "the registrar was there: the answer names nothing unregistered");
  await cap.uploadCapture({ bytes, statement: "again", name: "minutes.txt", type: "text/plain", by: "member:ann", at: "2026-10-24T10:05:00Z" });
  assert.equal(rowsOf(x).filter((q) => q.sha === d && q.kind === "reading").length, 1, "one row for the digest and kind");
});

test("R75: a kill between the put and the filing's transaction leaves no row without its filing: the receipt refused inside the transaction rolls the row back with it", async () => {
  const x = await world();
  const cap = captureOf(x.ctx);
  cap.provenance.recordReceipt = () => { throw new Error("the object was killed here"); };
  const bytes = new TextEncoder().encode("a file whose filing dies\n".repeat(10));
  const up = await cap.uploadCapture({ bytes, statement: "handed to me", name: "dies.txt", type: "text/plain", by: "member:ann", at: "2026-10-24T10:00:00Z" });
  assert.notEqual(up.ok, true);
  assert.deepEqual(rowsOf(x).filter((q) => q.kind === "reading"), [], "no job row without its filing");
});

test("R75 (control): with no registrar the caller says so in its answer, never silently", async () => {
  const x = await world();
  const cap = captureOf(x.ctx);
  cap.registerJob = null; cap.armJobs = null;
  const up = await cap.uploadCapture({ bytes: new TextEncoder().encode("no registrar here\n".repeat(10)), statement: "handed to me", name: "n.txt", type: "text/plain",
                                       by: "member:ann", at: "2026-10-24T10:00:00Z" });
  assert.equal(up.ok, true);
  assert.deepEqual(up.jobs, { not_registered: [{ kind: "reading", reason: "NO_REGISTRAR" }] });
});

test("R75: extraction is handed the registrar (`registerJob`, `armJobs`) beside its `owe`, and each reader below the table receives it with its row's run", async () => {
  const x = await world(undefined, { readAnswer: () => ({ ok: true, read: true }) });
  x.jobs.registerJob({ kind: "reading", sha: sha("handed") });
  await x.s.onAlarm(Date.now() + 1000);
  const a = x.read[0];
  assert.equal(typeof a.registerJob, "function");
  assert.equal(typeof a.armJobs, "function");
  assert.equal(a.registerJob({ kind: "ocr", sha: sha("handed"), owed: 6 }).ok, true, "what the reader owes is a row of the same table");
  assert.equal(x.jobs.jobRow({ sha: sha("handed"), kind: "ocr" }).owed, 6);
});

test("R75: notice-producers' `readingsEnded({after, limit})` answers the rows that ended (finished, refused, final) with the member the registration named, paged by its cursor; a read", async () => {
  const x = await world(undefined, { readAnswer: (q) => (q.sha === sha("one") ? { ok: true, read: true } : { final: true, why: "PASSWORD_REQUIRED" }) });
  x.jobs.registerJob({ kind: "reading", sha: sha("one"), member: "member:ann" });
  x.jobs.registerJob({ kind: "reading", sha: sha("two"), member: "member:bea" });
  x.jobs.registerJob({ kind: "reading", sha: sha("three"), verdict: { ok: false, bound_key: "pdf.bytes" } });
  x.jobs.registerJob({ kind: "reading", sha: sha("four") });
  for (let i = 0, at = Date.now() + 1000; i < 3; i++, at += 1000) await x.s.onAlarm(at);
  const all = x.jobs.readingsEnded({});
  assert.deepEqual(all.rows.map((r) => [r.sha, r.state, r.member]).sort(),
                   [[sha("one"), "finished", "member:ann"], [sha("three"), "refused", null], [sha("two"), "final", "member:bea"], [sha("four"), "final", null]].sort());
  const p1 = x.jobs.readingsEnded({ limit: 2 }), p2 = x.jobs.readingsEnded({ after: p1.next, limit: 2 });
  assert.equal(p1.rows.length, 2);
  assert.deepEqual([...p1.rows, ...p2.rows].map((r) => r.sha).sort(), all.rows.map((r) => r.sha).sort(), "paged, none twice");
  const { noticeProducersOf } = await import("../../../src/notice-producers/index.mjs");
  void noticeProducersOf;   /* the callback is handed at composition (store.mjs); notice-producers reads it in its own job (34) */
});

/* ---- R76: progress only forward; the poison rule ---- */

test("R76 G129a: a step that advances nothing ends the row `final`, NO_PROGRESS, on that tick; a stub reader answering `count: 0` with the cursor it was asked ends stated; a password ends in one tick", async () => {
  const x = await world(undefined, { readAnswer: (q) => (q.sha === sha("pw") ? { ok: false, final: true, why: "PASSWORD_REQUIRED" }
    : { ok: true, more: true, count: 0, detail: q.detail && q.detail.cursor ? q.detail : { cursor: "c0" }, counters: { written: q.detail && q.detail.cursor ? 0 : 3 } }) });
  x.jobs.registerJob({ kind: "reading", sha: sha("stuck") });
  x.jobs.registerJob({ kind: "reading", sha: sha("pw") });
  let at = Date.now() + 1000;
  for (let i = 0; i < 4; i++, at += 1000) await x.s.onAlarm(at);
  const stuck = x.jobs.jobRow({ sha: sha("stuck"), kind: "reading" }), pw = x.jobs.jobRow({ sha: sha("pw"), kind: "reading" });
  assert.deepEqual([stuck.state, stuck.final_why], ["final", NO_PROGRESS]);
  assert.equal(x.read.filter((q) => q.sha === sha("stuck")).length, 2, "the first piece moved; the second advanced nothing and ended it");
  assert.deepEqual([pw.state, pw.final_why, x.read.filter((q) => q.sha === sha("pw")).length], ["final", "PASSWORD_REQUIRED", 1], "one tick, never 'being read' after");
});

test("R76 G129a: extraction's own answer for an OCR pass that read no glyph (`final: true`, NO_PROGRESS) ends the `ocr` row `final` on that tick, never retried; the ledger's `OCR_NOTHING_OWED` needs no word for it", async () => {
  const ended = await readHeld.final("NO_PROGRESS");
  assert.deepEqual([ended.final, ended.why], [true, NO_PROGRESS]);
  const x = await world(undefined, { readAnswer: () => ended });
  const d = sha("a scan whose pages hold no glyph");
  x.jobs.registerJob({ kind: "ocr", sha: d });
  let at = Date.now() + 1000;
  for (let i = 0; i < 3; i++, at += 3_600_000) await x.s.onAlarm(at);
  const r = x.jobs.jobRow({ sha: d, kind: "ocr" });
  assert.deepEqual([r.state, r.final_why, x.read.filter((q) => q.sha === d).length], ["final", ended.why, 1], "asked once");
});

test("R76 (control): a row that advances by one unit each tick is never ended by the no-progress rule", async () => {
  const x = await world(undefined, { readAnswer: () => ({ ok: true, more: true, counters: { written: 1 } }) });
  x.jobs.registerJob({ kind: "ocr", sha: sha("a long scan") });
  for (let i = 0, at = Date.now() + 1000; i < 30; i++, at += 1000) await x.s.onAlarm(at);
  const r = x.jobs.jobRow({ sha: sha("a long scan"), kind: "ocr" });
  assert.deepEqual([r.state, r.final_why, r.written], ["partial", null, 30]);
});

test("R76 G129b: a transient failure at tick 2 or later is tried again, never written as the end `partial` with no reason; it ends whole when the store answers", async () => {
  /* extraction's real pieces of a text of three (two `more`, then read), and its finishing answer with counters */
  const [p0, p1] = await readHeld.pieces(3);
  const done = await readHeld.finished();
  const failed = await readHeld.failed();   /* extraction's real second tick over a store that fails: owed, `why` TRANSIENT, the cursor kept */
  assert.deepEqual([failed.owed, failed.why], [true, "TRANSIENT"]);
  const answers = [p0, p1,
                   failed, { ok: true, more: true, detail: { cursor: "c2" }, failure: "transient", reason: "R2_HICCUP" },   // fixtures-generic: R2_HICCUP   (a transient word no module gives: any transient failure is tried again)
                   done.answer];
  const x = await world(undefined, { readAnswer: () => answers.shift() });
  const d = sha("a text whose store failed at tick 3");
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  for (let i = 0; i < 5; i++, at += 3_600_000) {
    await x.s.onAlarm(at);
    const r = x.jobs.jobRow({ sha: d, kind: "reading" });
    if (i === 2 || i === 3) assert.deepEqual([r.state === "final", r.state === "finished", r.final_why], [false, false, null], `tick ${i + 1}: retried, never ended`);
    if (i === 2) assert.equal(r.last_why, failed.why, "the ledger states the reason the owner's answer gave");
  }
  const r = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.written, r.failed], ["finished", done.counters.written, 2]);
  assert.deepEqual(x.read.map((q) => q.detail), [{}, p0.detail, p1.detail, p1.detail, p1.detail], "asked again at the cursor it failed at");
});

test("R76 G129c attemptStamp: a unit's attempt is stamped before its reader runs and cleared when it answers; a run that dies counts one kill of its unit, and a member's kill (`killed`) counts as one", async () => {
  assert.deepEqual([unitOf({}), unitOf({ next_page: 150 }), unitOf({ cursor: "c3" })], ["whole", "p150", "cc3"]);
  const seen = [];
  let x = await world(undefined, { readAnswer: (q) => { seen.push(x.jobs.unitAttempts({ sha: q.sha, kind: q.kind })); return { ok: true, more: true, counters: { written: 30 }, killed: [40] }; } });
  const d = sha("a 300-page scan");
  x.jobs.registerJob({ kind: "ocr", sha: d, detail: { next_page: 1 } });
  await x.s.onAlarm(Date.now() + 1000);
  assert.ok(seen[0].some((u) => u.unit === "p1" && u.stamped_at !== null), "stamped before the reader ran");
  const after = x.jobs.unitAttempts({ sha: d, kind: "ocr" });
  assert.ok(after.every((u) => u.stamped_at === null), "cleared when it answered");
  assert.deepEqual(after.find((u) => u.unit === "p40"), { unit: "p40", tries: 1, stamped_at: null }, "the member's kill of page 40 is one attempt against it");
});

test("R76 (2): a unit that is no page (the whole file) killed three times ends the row stated, PAGE_KILLED_READER; `three interruptions end the whole read` is no rule of its own: a row killed on three different pieces is charged to the whole read and ends stated (REPORT)", async () => {
  const d = sha("a DOCX that kills its reader");
  let x = await world(undefined, { readAnswer: NEVER });
  const db = x.db;
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  for (let i = 0; i < 4; i++, at += 3_600_000) { await alarm(x, at); x = await world(db, { readAnswer: NEVER }); }
  const r = pendingOf(x.ctx).jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.final_why], ["final", PAGE_KILLED_READER]);
  /* three kills on three different pieces: each piece killed once, the row goes on */
  const e = sha("a text killed once on each of three pieces");
  let n = 0;
  const next = await readHeld.pieces(5);   /* extraction's real ticks of a text of five pieces: four `more`, then read; each kill is a tick that never answers */
  const pieceAnswer = (q) => { n++; if (n % 2 === 1) return NEVER(); return next[n / 2 - 1]; };
  let y = await world(undefined, { readAnswer: pieceAnswer });
  const ydb = y.db;
  y.jobs.registerJob({ kind: "reading", sha: e });
  for (let i = 0; i < 6; i++, at += 3_600_000) if ((await alarm(y, at)) === "killed") y = await world(ydb, { readAnswer: pieceAnswer });
  const q = pendingOf(y.ctx).jobRow({ sha: e, kind: "reading" });
  /* REPORT: a real piece's detail names no window, so each kill is charged to the whole read, not to its piece; the third kill ends it, stated */
  assert.deepEqual([q.state, q.final_why], ["final", PAGE_KILLED_READER], `three kills end it, charged to the whole: ${q.state} ${q.final_why}`);
});

test("R76 (2c item 8, K4904): with the real table, a window cursor stamped three times reaches `readHeld` as `killedCursor`, and the reader steps past it to the text's end; a page keeps `killedPages`", async () => {
  const d = sha("a deck whose slide 7 kills its reader");
  /* extraction's real window killed three times: the reader steps past it (`killedCursor`), and the answer reads the text to its end with the window stated */
  const stepped = await readHeld.killedWindow();
  const step = (q) => (q.killedCursor === "slide-7" ? stepped.answer : NEVER());
  let x = await world(undefined, { readAnswer: step });
  const db = x.db;
  x.jobs.registerJob({ kind: "reading", sha: d, detail: { cursor: "slide-7" } });
  let at = Date.now() + 1000;
  for (let i = 0; i < 3; i++, at += 3_600_000) { assert.equal(await alarm(x, at), "killed"); x = await world(db, { readAnswer: step }); }
  await x.s.onAlarm(at);
  const last = x.read[x.read.length - 1];
  assert.equal(last.killedCursor, "slide-7", "stamped three times: handed to the reader");
  assert.deepEqual(last.killedPages, []);
  const r = pendingOf(x.ctx).jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.final_why], ["finished", null], "stepped past: the reader read the rest, the window stated, the row ends");
});

/* ---- plane R103 -> R65: the watchdog's fields ---- */

test("R65 (plane R103) watchdogRan G94: `watchdog_ran` and `running_since` join R65's fields in an administrator's `owedwork`, with and without a digest; a member's answer carries none of the seven", async () => {
  assert.deepEqual([...WATCHDOG_FIELDS], ["last_run", "alarm_at", "stale", "oldest_overdue", "watchdog_seen", "watchdog_ran", "running_since"]);
  const x = await world();
  const health = async () => ({ last_run: 1, alarm_at: 2, stale: false, oldest_overdue: null, watchdog_seen: 3, watchdog_ran: 4, running_since: 5 });
  const administers = administersOf(() => false);
  const ask = (q) => pendingOps(x.jobs, new URL(`http://do/owedwork?${q}`), { health, administers }).owedwork();
  const admin = await ask("viewer=class:admin"), adminSha = await ask(`viewer=admin&sha=${sha("x")}`);
  for (const a of [admin, adminSha]) assert.deepEqual(WATCHDOG_FIELDS.map((k) => a[k]), [1, 2, false, null, 3, 4, 5]);
  for (const q of ["viewer=member:ann", `viewer=member:ann&sha=${sha("x")}`, ""]) {
    const m = await ask(q);
    assert.deepEqual(WATCHDOG_FIELDS.filter((k) => Object.hasOwn(m, k)), [], q);
  }
  /* an administrator whose health throws sees the seven as null, and why */
  const broken = await pendingOps(x.jobs, new URL("http://do/owedwork?viewer=class:admin"), { health: async () => { throw new Error("no beat"); }, administers }).owedwork();
  assert.deepEqual([WATCHDOG_FIELDS.map((k) => broken[k]), broken.watchdog_why], [WATCHDOG_FIELDS.map(() => null), "no beat"]);
});

test("R65 (plane R103) watchdogRan G94 (R-SEAM: through the real scheduler, whose `watch` records `ran`, scheduler R29; job 33 merged, K4905): the handler called with the cron's slot 26 minutes before now answers `watchdog_seen` equal to the slot and a `watchdog_ran` within the test's own bracket of now", async () => {
  const x = await world();
  const slot = Date.now() - 26 * 60_000;
  const before = Date.now();
  await x.s.watchdog(slot);
  const after = Date.now();
  const h = await schedulerOf(x.ctx, x.env).health();
  assert.equal(h.watchdog_seen, slot, "the slot, as before");
  assert.ok(Number.isFinite(h.watchdog_ran) && h.watchdog_ran >= before && h.watchdog_ran <= after, `watchdog_ran ${h.watchdog_ran}: the instant the check ran, not the slot`);
  const said = (await (await x.fetch("/owedwork?viewer=class:admin")).json()).result;
  assert.equal(said.watchdog_ran, h.watchdog_ran);
});

/* ---- R77: alarm handlers idempotent on re-entry ---- */

test("R77: a firing run twice over one storage leaves the units of a single run; one cut after its second consumer and restarted goes on by its row's cursor, never afresh, and trusts no call the cut run left in flight", async () => {
  /* extraction's real ticks of a text of three pieces: the piece its row's cursor names (none at first, then each piece's own) */
  const list = await readHeld.pieces(3);
  const units = [];
  const answer = (q) => { const i = q.detail.read_through === undefined ? 0 : q.detail.read_through === list[0].detail.read_through ? 1 : 2; units.push(i); return list[i]; };
  let x = await world(undefined, { readAnswer: answer });
  const db = x.db, d = sha("a text read by an alarm that runs twice");
  x.jobs.registerJob({ kind: "reading", sha: d });
  const at = Date.now() + 1000;
  await x.s.onAlarm(at);
  await x.s.onAlarm(at + 1);   /* retryCount 1: the completed firing run again */
  assert.deepEqual(units, [0, 1], "the second run of the firing went on from the cursor the first left; no unit twice");
  /* cut: a run that never returns, the object restarted over its persisted store */
  let first = true;
  const cutting = (q) => { if (first) { first = false; return NEVER(); } return answer(q); };
  x = await world(db, { readAnswer: cutting });
  assert.equal(await alarm(x, at + 2000), "killed");
  x = await world(db, { readAnswer: answer });
  await x.s.onAlarm(at + 3_600_000);
  assert.deepEqual(units, [0, 1, 2], "restarted at the cursor its row kept, never from the start");
  assert.equal(pendingOf(x.ctx).jobRow({ sha: d, kind: "reading" }).state, "finished");
  /* control: once finished, a further firing writes nothing */
  await x.s.onAlarm(at + 7_200_000);
  assert.deepEqual(units, [0, 1, 2]);
});

/* ---- R78: the instruments ---- */

test("R78: each run of the ledger states `max_stretch_ms`, `rows_read`, `rows_written` and `units` on its last run, each a non-negative number or NULL when unmeasured, never a zero standing for none", async () => {
  assert.deepEqual([...TICK_FIGURES], ["max_stretch_ms", "rows_read", "rows_written", "units", "max_run_statements"]);
  const slow = (q) => new Promise((r) => setTimeout(() => r({ ok: true, read: true, counters: { written: 9 } }), 40));
  const x = await world(undefined, { readAnswer: slow });
  const d = sha("a measured run");
  x.jobs.registerJob({ kind: "reading", sha: d });
  await x.s.onAlarm(Date.now() + 1000);
  const [last] = x.jobs.ledgerLast({ sha: d });
  for (const k of TICK_FIGURES) assert.ok(Object.hasOwn(last, k), k);
  assert.equal(last.units, 9, "the units the owner wrote");
  assert.ok(last.max_stretch_ms === null || last.max_stretch_ms >= 0, `max_stretch_ms ${last.max_stretch_ms}`);
  /* the suite's storage has no platform cursor counts: unmeasured is NULL, never 0 */
  assert.deepEqual([last.rows_read, last.rows_written], [null, null]);
  /* control: an owner that states no units leaves `units` NULL */
  const y = await world(undefined, { readAnswer: () => ({ ok: true, read: true }) });
  y.jobs.registerJob({ kind: "reading", sha: d });
  await y.s.onAlarm(Date.now() + 1000);
  assert.equal(y.jobs.ledgerLast({ sha: d })[0].units, null);
});

/* ---- capture R113 (K4899): the composition's evidence key ---- */

test("R75 R2 (capture R113, K4899): the composition assigns capture's `evidenceKey`, record-core's key for a digest, so through the assembled store a parted upload's begin answers `ok` with its parts, never PARTED_UPLOAD_UNAVAILABLE", async () => {
  const opened = [];
  const bucket = bucketStandIn();
  bucket.createMultipartUpload = async (key) => { opened.push(key); return { uploadId: "u-1", key }; };
  bucket.resumeMultipartUpload = (key, id) => ({ key, uploadId: id, uploadPart: async () => ({}), complete: async () => ({}), abort: async () => {} });
  const x = await store({ env: { CAPTURES: bucket } });
  const d = sha("a file past the request-body ceiling");
  const r = await x.call("/captureuploadbegin?by=member:ann", { sha256: d, bytes: 200 * 1048576, statement: "handed to me", name: "big.pdf", type: "application/pdf" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.ok(r.parts >= 2, `in parts: ${r.parts}`);
  assert.deepEqual(opened, [`bio/captures/${d}`], "the key the evidence store reads the whole by");
  /* control: without the key the begin is unavailable, as capture states it */
  captureOf(x.ctx).evidenceKey = null;
  const n = await x.call("/captureuploadbegin?by=member:ann", { sha256: sha("another"), bytes: 200 * 1048576, statement: "handed to me", name: "b.pdf", type: "application/pdf" });
  assert.equal(n.reason, "PARTED_UPLOAD_UNAVAILABLE");
});

/* ---- R79 (K4916; control-plane R135): one job row by a store-internal route ---- */

test("R79: `jobrow?sha=&kind=` answers one job row whole, a finished and a refused row included (cursor, last_progress_at, verdict); a malformed digest or session is BAD_SHA, a kind outside R74's BAD_KIND; it writes nothing", async () => {
  const x = await world(undefined, { readAnswer: () => ({ ok: true, read: true, counters: { written: 4 } }) });
  const done = sha("a reading that finished"), big = sha("a file refused by its bound");
  x.jobs.registerJob({ kind: "reading", sha: done, cursor: "c0" });
  x.jobs.registerJob({ kind: "reading", sha: big, verdict: { ok: false, size: 60, limit: 50, bound_key: "csv.bytes" } });
  await x.s.onAlarm(Date.now() + 1000);
  const before = rowsOf(x).map((r) => JSON.stringify(r));
  const fin = await x.call(`/jobrow?sha=${done}&kind=reading`), ref = await x.call(`/jobrow?sha=${big}&kind=reading`);
  assert.equal(fin.ok, true);
  assert.deepEqual([fin.row.state, fin.row.cursor, fin.row.written, typeof fin.row.last_progress_at], ["finished", "c0", 4, "number"]);
  assert.deepEqual([ref.row.state, ref.row.verdict, ref.row.final_why], ["refused", { ok: false, size: 60, limit: 50, bound_key: "csv.bytes" }, "csv.bytes"]);
  assert.deepEqual(Object.keys(fin.row).sort(), Object.keys(x.jobs.jobRow({ sha: done, kind: "reading" })).sort(), "every column");
  assert.deepEqual(await x.call(`/jobrow?sha=nope&kind=reading`), { ok: false, reason: "BAD_SHA" });
  assert.deepEqual(await x.call(`/jobrow?sha=&kind=fetch`), { ok: false, reason: "BAD_SHA" });
  assert.deepEqual(await x.call(`/jobrow?sha=${done}&kind=nope`), { ok: false, reason: "BAD_KIND" });
  assert.deepEqual(rowsOf(x).map((r) => JSON.stringify(r)), before, "a read: nothing written");
  /* control: an absent row */
  assert.deepEqual(await x.call(`/jobrow?sha=${sha("never registered")}&kind=ocr`), { ok: true, row: null });
});

/* ---- R74 (K4980, G160): a refusal's facts in `failed_why` ---- */

test("R74 G160: a final answer carries the refusal's `kind`, `capture_sha` and `holder` as the refusing module answered them, in `detail` or at the top; `holder` is null where provenance names none (D-15); an answer with no facts adds none", async () => {
  const held = sha("a whole held elsewhere");
  const answers = [
    { ok: true, done: true, final: true, reason: "CAPTURE_HELD_BY_ANOTHER_BUNDLE", kind: "whole", capture_sha: held },
    { ok: true, done: true, final: true, reason: "CAPTURE_HELD_BY_ANOTHER_BUNDLE", refusal: { detail: { kind: "part", capture_sha: held, holder: "INFO-2026-0001" } } },
    "TOO_LARGE",   /* acquisition's published final answer of this reason, made in the stand-in below */
  ];
  const x = await world(undefined, {});
  const { acquisitionOf } = await import("../../../src/acquisition/index.mjs");
  const seen = [];
  acquisitionOf(x.ctx).owedFetch = async (_cap, e) => { seen.push(e.session); const a = answers[seen.length - 1]; return typeof a === "string" ? owedFetchAnswer({ kind: "final", reason: a }) : a; };
  for (let i = 0; i < 3; i++) x.jobs.registerJob({ kind: "fetch", session: `s-facts-${i}` });
  for (let i = 0; i < 3; i++) await x.s.onAlarm(Date.now() + 1000 + i * 3_600_000);
  const w = (i) => x.jobs.jobRow({ sha: `s-facts-${i}`, kind: "fetch" }).failed_why;
  assert.deepEqual(w(0).CAPTURE_HELD_BY_ANOTHER_BUNDLE, { kind: "whole", capture_sha: held, holder: null }, "no holder named: null");
  assert.deepEqual(w(1).CAPTURE_HELD_BY_ANOTHER_BUNDLE, { kind: "part", capture_sha: held, holder: "INFO-2026-0001" });
  assert.deepEqual(w(2), {}, "control: a final answer with no facts adds none");
});

/* ---- R81 (K4980, G159): a registered row arms the object itself ---- */

const settle = () => new Promise((r) => setTimeout(r, 25));

test("R81: registering a `fetch` row due now, with a daily alarm set hours ahead, brings the alarm forward with no `armJobs` call; control: a second row leaves the alarm where both are due; a refused registration arms nothing", async () => {
  const x = await world();
  const hours = Date.now() + 8 * 3_600_000;
  await x.ctx.storage.setAlarm(hours);
  const r = x.jobs.registerJob({ kind: "fetch", session: "s-arm-1" });
  assert.equal(r.ok, true);
  await settle();
  const due = x.jobs.jobRow({ sha: "s-arm-1", kind: "fetch" }).due_at;
  assert.ok((await x.ctx.storage.getAlarm()) <= due, "the alarm is no later than the row's due time");
  /* control: a second row registered beside it leaves the alarm no later than either row's due time */
  x.jobs.registerJob({ kind: "fetch", session: "s-arm-2" });
  await settle();
  assert.ok((await x.ctx.storage.getAlarm()) <= Date.now(), "the alarm stays at or before the instant both rows are due");
  /* the row runs within one tick of that alarm */
  await x.s.onAlarm(due + 1);
  assert.notEqual(x.jobs.jobRow({ sha: "s-arm-1", kind: "fetch" }).attempts, 0, "ran in that tick");
  /* control: a refusal arms nothing */
  const z = await world();
  await z.ctx.storage.setAlarm(hours);
  assert.equal(z.jobs.registerJob({ kind: "fetch" }).ok, false);
  await settle();
  assert.equal(await z.ctx.storage.getAlarm(), hours, "a refused registration arms nothing");
});

test("R81: a registration made inside a transaction arms once the transaction has returned", async () => {
  const x = await world();
  await x.ctx.storage.setAlarm(Date.now() + 8 * 3_600_000);
  x.ctx.storage.transactionSync(() => { x.jobs.registerJob({ kind: "fetch", session: "s-arm-3" }); });
  await settle();
  assert.ok((await x.ctx.storage.getAlarm()) <= x.jobs.jobRow({ sha: "s-arm-3", kind: "fetch" }).due_at, "armed once the transaction returned");
});

/* ---- R82 (K4980, G165): the unit in flight is stamped by the reader ---- */

test("R82 stampUnit: the reader is handed `stampUnit` for a paged read; a scan whose page 5 kills its reader three times ends with `killedPages: [5]`, pages 0-4 and 6-7 read, the row finished", async () => {
  const d = sha("an 8-page scan whose page 5 kills the reader");
  const read = new Set();
  const handed = [];
  const answer = async (q) => {
    handed.push(typeof q.stampUnit);
    const pass = [];
    for (let p = 0; p < 8; p++) {
      if (q.killedPages.includes(p)) continue;
      assert.equal(q.stampUnit(`p${p}`), true);   /* synchronously before the member call */
      if (p === 5) return NEVER();
      pass.push(p);
    }
    for (const p of pass) read.add(p);
    return { ok: true, read: true, counters: { written: pass.length }, refused: q.killedPages.map((k) => ({ page: k, reason: PAGE_KILLED_READER })) };
  };
  let x = await world(undefined, { readAnswer: answer });
  const db = x.db;
  x.jobs.registerJob({ kind: "ocr", sha: d });   /* as extraction registers it: no page in `detail` */
  let at = Date.now() + 1000;
  const seen = [];
  for (let i = 0; i < 12; i++, at += 3_600_000) {
    const row = pendingOf(x.ctx).jobRow({ sha: d, kind: "ocr" });
    if (!row || ["finished", "final"].includes(row.state)) break;
    seen.push(row.state);
    if ((await alarm(x, at)) === "killed") x = await world(db, { readAnswer: answer });
  }
  const row = pendingOf(x.ctx).jobRow({ sha: d, kind: "ocr" });
  assert.equal(row.state, "finished", JSON.stringify(row));
  assert.deepEqual([...read].sort(), [0, 1, 2, 3, 4, 6, 7]);
  const units = pendingOf(x.ctx).unitAttempts({ sha: d, kind: "ocr" });
  assert.equal(units.find((u) => u.unit === "p5").tries, UNIT_KILLS_MAX, "the kills are charged to page 5");
  assert.ok(!units.some((u) => u.unit === "whole" && u.tries > 0), "and to the whole none");
  assert.ok(handed.every((t) => t === "function"));
});

test("R82 control: a whole read with no unit stamped is charged to `whole` as before and ends stated at three kills; a kind that is not paged is handed no `stampUnit`", async () => {
  const d = sha("a DOCX with no pages");
  let x = await world(undefined, { readAnswer: NEVER });
  const db = x.db;
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  for (let i = 0; i < 4; i++, at += 3_600_000) { await alarm(x, at); x = await world(db, { readAnswer: NEVER }); }
  const r = pendingOf(x.ctx).jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([r.state, r.final_why], ["final", PAGE_KILLED_READER]);
  assert.deepEqual(pendingOf(x.ctx).unitAttempts({ sha: d, kind: "reading" }).map((u) => [u.unit, u.tries]), [["whole", UNIT_KILLS_MAX]]);
  /* a fetch is handed none */
  const y = await world(undefined, {});
  const { acquisitionOf } = await import("../../../src/acquisition/index.mjs");
  let got = "unset";
  acquisitionOf(y.ctx).owedFetch = async (_c, _e, o) => { got = typeof o.stampUnit; return owedFetchAnswer({ kind: "done" }); };
  y.jobs.registerJob({ kind: "fetch", session: "s-nostamp" });
  await y.s.onAlarm(Date.now() + 1000);
  assert.equal(got, "undefined");
});

/* ---- R74 (G168, K4985): no home yet waits uncounted; the finishing answer's counters are kept ---- */

test("R74 NO_HOME: a `reading` row answered NO_HOME waits and counts no failure; then READING_HELD with counters 8 ends it finished, written 8, failed 0", async () => {
  const d = sha("a scan read to its end");
  const answers = [{ ok: true, read: false, why: "NO_HOME" }, { ok: true, read: false, why: "READING_HELD", counters: { written: 8, skipped: 1 } }];
  const x = await world(undefined, { readAnswer: () => answers.shift() });
  x.jobs.registerJob({ kind: "reading", sha: d });
  let at = Date.now() + 1000;
  await x.s.onAlarm(at);
  let row = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([row.state, row.failed, row.failed_why, row.last_why, row.written], ["queued", 0, {}, "NO_HOME", 0], JSON.stringify(row));
  assert.ok(row.due_at > at, "tried again later");
  at += 3_600_000;
  await x.s.onAlarm(at);
  row = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([row.state, row.written, row.skipped, row.failed, row.owed], ["finished", 8, 1, 0, 0], JSON.stringify(row));
});

test("R74 NO_HOME control: the row keeps the larger of its own and the answer's counters; an owner's real failure is still counted", async () => {
  const d = sha("a reading with units already written");
  const answers = [{ ok: true, read: false, why: "READING_HELD", counters: { written: 3, skipped: 0 } }];
  const x = await world(undefined, { readAnswer: () => answers.shift() });
  x.jobs.registerJob({ kind: "reading", sha: d });
  x.ctx.storage.sql.exec(`UPDATE keeps_pending SET written=5 WHERE sha=? AND kind='reading'`, d);
  await x.s.onAlarm(Date.now() + 1000);
  const row = x.jobs.jobRow({ sha: d, kind: "reading" });
  assert.deepEqual([row.state, row.written, row.failed], ["finished", 5, 0]);
  const e = sha("a reading that fails");
  const y = await world(undefined, { readAnswer: () => ({ ok: false, why: "BROKEN" }) });
  y.jobs.registerJob({ kind: "reading", sha: e });
  await y.s.onAlarm(Date.now() + 1000);
  const bad = y.jobs.jobRow({ sha: e, kind: "reading" });
  assert.deepEqual([bad.failed, bad.failed_why], [1, { BROKEN: 1 }]);
});
