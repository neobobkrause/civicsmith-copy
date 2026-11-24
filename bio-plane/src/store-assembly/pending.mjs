/* plane R75, R77 (T51 fix rounds 4 and 4b; C5c; K4429, K4487; amends R4, R76; acquisition R96 and R100, extraction R80 and R82,
   control-plane R120 and R123): THE OWED-WORK LEDGER, FINISHED BY THE OBJECT'S OWN ALARM. A request is answered inside the door's
   bound and the Durable Object keeps no promise alive after it, so work that will not end inside the bound is written down
   here, in the object's storage, and finished by one `scheduler` consumer, `pending-work`. The table is `keeps_pending`, one row
   for each `(sha, kind)`; the kinds are
     `keep`          the whole is not yet put; `parts` are the part digests in order (acquisition R96); put by
                     `evidenceStore().putFromParts` (record-core R87), then read, in the same tick;
     `reading`       the whole is held and its reading is owed (control-plane R120, R123), by `extraction.readHeld`;
     `ocr`           pages of a scan left unread (extraction R82), continued by `extraction.readHeld({sha, kind: "ocr"})`, which
                     answers `owed: true` while pages remain;
     `subresources`  a web capture's outstanding supporting files and pending render, keyed by the capture SESSION (acquisition
                     R100), run by `acquisition.owedRun(cap, {kind, session})`;
     `unpack`        an archive stopped by a budget (acquisition R100), run as the unpack drain does, `op=unpack` as the daemon;
     `fetch`         a large web capture handed to the alarm (fix round 6, G2; acquisition's `owedFetch`), keyed by the capture SESSION as
                     `subresources` is, heavy: its body is read and its document filed by the alarm, never inside the member's request;
     `scan`, `safe_view`, `grade`, `ingest`  (fix round 9, R97) the job kinds of the safety scan, the safe view, the grade and the money
                     ingest, run by the owner the composition hands for each (`workers`); with none the row stays owed, `NO_OWNER`.
   An entry ends only when its work is done, or when its owner answers a FINAL reason (`final: true`, with its `why`), which the
   row then keeps, stated, for the document's page (op `owedwork`); never by a count or a clock. A failure, `NO_HOME` among them,
   leaves the entry for a later alarm, backed off from `PENDING_RETRY_MS` doubling to at most `PENDING_RETRY_MAX_MS` and going on
   at that rate. A second registration of the same entry re-arms it (no attempts, due now), a final one too.

   THE JOB TABLE (fix round 9, G126, G129c-e; R97, R98, R101; K4835 (2), K4837). `keeps_pending` is the job table of the reading kinds:
   beside R77's columns each row states its `state` (`queued`, `fetching`, `reading`, `partial`, `refused`, `finished`, `final`), the plan
   step's `verdict` on the bound, its `cursor`, the counters `written`, `skipped`, `owed`, `failed` (with `failed_why`, by cause),
   `last_progress_at`, `rate_per_s`, `carrier`, `reader_version` and `priority` (`raised` is "Read it"). A row that ended stays, `finished`,
   `refused` or `final`, for the readers of the table (`readingsEnded`); the member's page lists the work still owed and the ends stated.
   Every way in writes its row through ONE registrar, `registerJob(entry)`, SYNCHRONOUS (a write on the object's own SQL storage, so a
   caller makes it inside the function it hands `core.transact` and the row commits or rolls back with its filing) and never throwing;
   arming the alarm is the separate `armJobs()` after the commit. A row ends only when its counters say nothing is owed, never because a
   hook was called (G126j).

   THE RUN IS COUNTED BEFORE IT HAPPENS (fix round 5, E2; K4530; fix round 9, R101). An owner that kills the isolate (memory, CPU) never
   returns, so the ledger cannot learn of it from an answer. A row is stamped `started_at`, its try counted and its back-off set, and the
   UNIT it is on (the page or piece its cursor names, else the whole) stamped in `job_unit_attempts`, before its owner runs; every answer
   clears both stamps. A row found started and not finished at a later tick, by an isolate that is not running it, is an interrupted run:
   counted in `interrupted` (kept across a re-registration, never ending the row), and its unit counted one kill. A unit killed twice is
   asked once more at half the budget; a unit killed three times is stated unread alone (a page: `PAGE_KILLED_READER`, handed to the reader as
   `killedPages`; a window its cursor names: handed as `killedCursor`, which the reader steps past, K4904) while the row goes on with the rest;
   the whole of a file read with no cursor has no unit to leave out, and is the row's own end, stated.
   "Three interruptions end the whole read" is retired. A step that moved neither its cursor nor any counter ends the row `final`,
   `NO_PROGRESS`, on that tick (R101 (1)); a transient failure is tried again, never written as the end (R101 (3)). A tick runs the
   light kinds (`subresources`, `unpack`, `grade`) and at most one heavy row, so one document's read never holds the object that answers
   every screen for the length of three.

   A ROW'S TIME IS ITS OWN (fix round 7, G67, G69; R91, R92). A row is stamped started at its OWN start (`now()` when it begins, never the
   alarm's instant, which every consumer and row of the tick shares), so `last_ms` is that row's elapsed time and no earlier row's. It is
   split: `wait_ms` the part spent awaiting a worker (a service binding, measured by the plane around the binding the owner is handed, the
   union of overlapping calls), `own_ms` the rest; the 10 s bar is `own_ms`'s. `last_mem` is NULL where the platform reports no memory
   (workerd answers zeros). The last run of each `(sha, kind)` is kept beyond the row in `keeps_last`. (R105, G123g) Each run also states
   what it cost: `max_stretch_ms`, the longest gap an event-loop meter of `LAG_EVERY_MS` saw while it ran; `rows_read` and `rows_written`, the
   SQL rows its statements touched (the platform's cursor counts); `units`, the units its owner wrote; `max_run_statements` (fix round 10, 28b),
   the most statements it ran between two turns of the event loop, a count that needs no timer to beat inside the stretch it measures, so a pass that
   never yields states it where `max_stretch_ms` is NULL; a row keeps the largest over all its runs. Each is NULL when unmeasured.

   Lower modules cannot import this one (it is last in the order), so they are handed the registration at composition, as they
   are handed `cap.waitUntil`: `captureOf(ctx).registerJob(entry)` and `.armJobs()` (R98), and the older async hooks
   `.keepLater({sha, parts})` and `.owedLater({kind, sha, session?, parts?, detail?})`, which write the same row through the registrar
   and arm the alarm in one step, never throwing. The door's deferred reading arrives by the store-internal route `pendingadd`. An
   owner answers one of: `{ok: true, read: true}` or `{ok: true, done: true}` (ended, when nothing is owed), `{ok: true, more: true,
   detail}` or `{ok: true, owed: true}` (a stage ended, the rest follows), `{final: true, why}` (ended, stated), anything else (tried
   again). */
import { recordOf } from "../record-core/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { acquisitionOf, owedRun } from "../acquisition/index.mjs";
import * as acquisitionModule from "../acquisition/index.mjs";   /* `owedFetch` is read from the namespace: an instance's own, else the module's */
import { captureOf } from "../capture/index.mjs";
import { schedulerOf } from "../scheduler/index.mjs";
import { ROOT_ADMIN, baseViewer, viewerMember } from "../member-roster/index.mjs";

export const KEEPS_PENDING_DDL = `CREATE TABLE IF NOT EXISTS keeps_pending (
  sha TEXT NOT NULL, kind TEXT NOT NULL, parts TEXT NOT NULL DEFAULT '[]', detail TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0, registered_at INTEGER NOT NULL, due_at INTEGER NOT NULL, last_try INTEGER, last_why TEXT,
  final_why TEXT, started_at INTEGER, interrupted INTEGER NOT NULL DEFAULT 0, last_ms INTEGER, last_mem INTEGER, own_ms INTEGER, wait_ms INTEGER,
  PRIMARY KEY (sha, kind))`;
/** R97: the job table's own columns, added to a ledger of any earlier shape (additive; a row of the old shape keeps what it had). */
export const JOB_COLUMNS = Object.freeze([
  ["state", "TEXT NOT NULL DEFAULT 'queued'"], ["verdict", "TEXT"], ["cursor", "TEXT"],
  ["written", "INTEGER NOT NULL DEFAULT 0"], ["skipped", "INTEGER NOT NULL DEFAULT 0"], ["owed", "INTEGER NOT NULL DEFAULT 0"],
  ["failed", "INTEGER NOT NULL DEFAULT 0"], ["failed_why", "TEXT NOT NULL DEFAULT '{ }'"], ["last_progress_at", "INTEGER"],
  ["rate_per_s", "REAL"], ["carrier", "TEXT"], ["reader_version", "TEXT"], ["priority", "TEXT"], ["ended_at", "INTEGER"], ["member", "TEXT"],
]);
/** R92: the last run of each (digest or session, kind), kept after the row has ended. */
export const KEEPS_LAST_DDL = `CREATE TABLE IF NOT EXISTS keeps_last (
  sha TEXT NOT NULL, kind TEXT NOT NULL, last_ms INTEGER, own_ms INTEGER, wait_ms INTEGER, last_mem INTEGER, outcome TEXT NOT NULL, at INTEGER NOT NULL,
  PRIMARY KEY (sha, kind))`;
/** R105: what a run cost, beside R92's times (NULL when unmeasured). */
export const TICK_FIGURES = Object.freeze(["max_stretch_ms", "rows_read", "rows_written", "units", "max_run_statements"]);
/** R97, R101: a unit's attempts, stamped before its reader runs: `tries` counts the runs that died on it. */
export const JOB_UNIT_ATTEMPTS_DDL = `CREATE TABLE IF NOT EXISTS job_unit_attempts (
  sha TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, stamped_at INTEGER,
  PRIMARY KEY (sha, kind, unit))`;
/** R97, R104 (G128): a batch lands once, by (sha, kind, batch). */
export const JOB_BATCHES_DDL = `CREATE TABLE IF NOT EXISTS job_batches (
  sha TEXT NOT NULL, kind TEXT NOT NULL, batch TEXT NOT NULL, landed_at INTEGER NOT NULL,
  PRIMARY KEY (sha, kind, batch))`;
export const PENDING_NAME = "pending-work";
/** R97: the job table's kinds: R77's, `fetch` (R81), and the four fix round 9 adds. */
export const JOB_KINDS = Object.freeze(["keep", "reading", "ocr", "subresources", "unpack", "fetch", "scan", "safe_view", "grade", "ingest"]);
export const PENDING_KINDS = JOB_KINDS;
/** R97: the states of a row; the last three are ends. */
export const JOB_STATES = Object.freeze(["queued", "fetching", "reading", "partial", "refused", "finished", "final"]);
const ENDED = Object.freeze(["refused", "finished", "final"]);
export const PENDING_RETRY_MS = 15_000;
export const PENDING_RETRY_MAX_MS = 3_600_000;
export const PENDING_BATCH = 3;
/** R101 (2): the kills of one unit after which it is stated unread alone; the run before it is at half the budget. */
export const UNIT_KILLS_MAX = 3;
export const PAGE_KILLED_READER = "PAGE_KILLED_READER";
/** R101 (1): the reason a row that advanced nothing ends with. */
export const NO_PROGRESS = "NO_PROGRESS";
/** R105: the lag meter's interval, milliseconds. */
export const LAG_EVERY_MS = 10;
/** an ended row is kept this long for the table's readers, then removed at a tick */
export const ENDED_KEEP_MS = 30 * 24 * 3_600_000;
const HEAVY = Object.freeze(["keep", "reading", "ocr", "fetch", "scan", "safe_view", "ingest"]);
/* an entry of these kinds is keyed by its capture SESSION (acquisition R100), the others by a digest */
const SESSION_KEYED = Object.freeze(["subresources", "fetch"]);
/* the kinds whose unit may be a page the reader can leave out (`killedPages`) */
const PAGED = Object.freeze(["reading", "ocr"]);
/* G129d: what an `ocr` pass answers when nothing is owed of the digest (no pages left, no reading, the pages the member declined, no OCR
   member installed, no home): an end. Any other pass that read nothing (`UNREADABLE`, the object not held) is tried again. */
const OCR_NOTHING_OWED = Object.freeze(["NO_PAGES_LEFT", "NO_READING", "OCR_NO_PROGRESS", "NO_OCR_MEMBER", "NO_HOME"]);

const DIGEST = /^[0-9a-f]{64}$/;
const HOLDERS = new WeakMap();
const why = (e) => String(e && e.message || e).slice(0, 160);
/* the platform's memory marker, or null where it measures none: workerd answers all zeros, which is no reading (R92) */
const memory = () => { try { const m = globalThis.process && typeof globalThis.process.memoryUsage === "function" ? globalThis.process.memoryUsage() : null; const n = m ? Math.round(m.rss || m.heapUsed || 0) : 0; return n > 0 ? n : null; } catch { return null; } };
/* the service bindings a row's owner awaits: a call through one is `wait_ms` (the worker's time, not the object's thread) */
const WORKER_BINDINGS = Object.freeze(["PDF_WORKER", "OCR_WORKER", "SHEET_WORKER", "AGENT_WORKER", "FILE_SCANNER", "SELF"]);
const RANK = { keep: 0, reading: 1, ocr: 2, subresources: 3, unpack: 4, fetch: 5, scan: 6, safe_view: 7, grade: 8, ingest: 9 };
const json = (v, otherwise) => { try { const o = JSON.parse(v); return o && typeof o === "object" ? o : otherwise; } catch { return otherwise; } };
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
/* R101: the unit a row's run starts on: the page its cursor names (`p<n>`), else the piece its cursor names, else the whole */
export const unitOf = (detail) => {
  const d = plain(detail) ? detail : {};
  const page = d.next_page ?? d.page;
  if (Number.isSafeInteger(page) && page >= 0) return `p${page}`;
  const v = d.cursor ?? d.next;
  return v === undefined || v === null || v === "" ? "whole" : `c${String(typeof v === "object" ? JSON.stringify(v) : v).slice(0, 200)}`;
};
const pageOf = (unit) => (/^p\d{1,9}$/.test(unit) ? Number(unit.slice(1)) : null);
/* R101 (2): the pages an owner answered as killing their reader (a 5xx or a throw of the member): `killed`, `ocr_killed`, or the reading's */
const killedIn = (r) => {
  const out = new Set();
  for (const a of [r && r.killed, r && r.ocr_killed, r && r.reading && r.reading.ocr_killed])
    if (Array.isArray(a)) for (const p of a) if (Number.isInteger(p) && p >= 0) out.add(p);
  return [...out];
};
/* R97: the counters an owner answered, `counters {written, skipped, owed, failed}` (the reader contract) or the same names at the top */
const countersIn = (r) => {
  const c = plain(r && r.counters) ? r.counters : r || {};
  return { written: count(c.written), skipped: count(c.skipped), owed: count(c.owed) };
};
const transientIn = (r) => !!r && (r.transient === true || r.failure === "transient" || (plain(r.reading) && r.reading.failure === "transient"));

/* R105: the SQL rows a run's statements touched, from the platform's cursors (`rowsRead`, `rowsWritten`); a storage whose cursors carry no
   such count is unmeasured. The object's one `sql.exec` is wrapped once, and counts only while a run is metered. Fix round 10 (28b): it also
   counts the statements of the run's current stretch, which a zero-delay timer resets when the event loop turns (a timer that can only fire
   between stretches, so no clock is read and a stretch that never yields is counted whole); `most` is the largest stretch seen. */
const countStatement = (t) => {
  t.run++;
  if (t.run > t.most) t.most = t.run;
  if (t.run === 1) {
    try { t.reset = setTimeout(() => { t.run = 0; }, 0); } catch { t.reset = null; t.unmeasured = true; }
  }
};
const SQL_METERS = new WeakMap();
function sqlMeter(sql) {
  let m = SQL_METERS.get(sql);
  if (m) return m;
  m = { active: null };
  try {
    const exec = sql.exec;
    if (typeof exec === "function") {
      sql.exec = function (...a) {
        const cur = exec.apply(this, a);
        const t = m.active;
        if (t) {
          if (t.cursors.length < 1_000_000) t.cursors.push(cur);
          countStatement(t);
        }
        return cur;
      };
    }
  } catch { /* an exec that cannot be wrapped leaves the rows unmeasured */ }
  SQL_METERS.set(sql, m);
  return m;
}
const sumRows = (cursors) => {
  if (!cursors || !cursors.length) return { rows_read: null, rows_written: null };
  let read = 0, written = 0, measured = false;
  for (const c of cursors) {
    try {
      if (c && Number.isFinite(c.rowsRead)) { read += c.rowsRead; measured = true; }
      if (c && Number.isFinite(c.rowsWritten)) { written += c.rowsWritten; measured = true; }
    } catch { /* a cursor that cannot say */ }
  }
  return measured ? { rows_read: read, rows_written: written } : { rows_read: null, rows_written: null };
};

/** The pending-work holder of a host (one per storage): `{migrate, registerJob, armJobs, owe, add, list, jobRow, readingsEnded, summary,
 *  consumer, ...}`. `deps`: `env`, `store` (a function answering the object's namespace), `now` (the clock; a test's own), `deliver`
 *  (control-plane's `deliverOwedRender`, handed by the composition), `clock` (the clock durations are measured on, the wall by default; K5132)
 *  and `workers` (kind -> async `(entry, {at}) -> answer`, replacing or
 *  supplying the owner of that kind; a test's, or the composition's for the kinds this module runs no owner of). */
export function pendingOf(ctx, deps = {}) {
  let h = HOLDERS.get(ctx);
  if (h) return h;
  const sql = ctx.storage.sql;
  const env = deps.env ?? null;
  const store = typeof deps.store === "function" ? deps.store : () => "bio";
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  /* K5132 (R71, R78): durations are measured on a clock of their own, `deps.clock` (the wall by default), never the instance clock `now`,
     so a pinned instance clock (`BIO_NOW_MS`) that stamps the rows' instants still measures a run's work */
  const clock = typeof deps.clock === "function" ? deps.clock : () => Date.now();
  /* a run's start on that clock, by row, while it runs */
  const begun = new Map();
  const all = (q, ...a) => [...sql.exec(q, ...a)];
  const rowOf = (sha, kind) => all(`SELECT * FROM keeps_pending WHERE sha=? AND kind=?`, sha, kind)[0] || null;
  const backoff = (attempts) => Math.min(PENDING_RETRY_MAX_MS, PENDING_RETRY_MS * 2 ** Math.min(20, Math.max(0, attempts - 1)));
  const arm = async () => { try { await schedulerOf(ctx, env).arm(now()); } catch { /* the stored entry re-derives it at the next start */ } };
  const meter = sqlMeter(sql);

  /* the rows this isolate is running now: a row stamped started that is not among them was started by an isolate that is gone */
  const running = new Set();
  const keyOf = (row) => `${row.kind}\u0000${row.sha}`;

  /* R97, R98: write the row of a registration, or re-arm the one held: attempts none and due now, an end cleared, the counters kept;
     `cursor`, `owed`, `detail`, `parts`, `carrier` and `verdict` changed only when given; `raised` never lowered. Synchronous. */
  const write = (key, kind, { parts, detail, cursor, owed, carrier, verdict, priority, member }) => {
    const at = now();
    const have = rowOf(key, kind);
    const refused = plain(verdict) && verdict.ok === false;
    const refusedWhy = refused ? String(verdict.bound_key || verdict.reason || "REFUSED").slice(0, 160) : null;
    const j = (v) => (v === undefined ? null : JSON.stringify(v));
    if (!have) {
      sql.exec(`INSERT INTO keeps_pending (sha, kind, parts, detail, attempts, registered_at, due_at, state, verdict, cursor, owed, carrier, priority,
                  final_why, ended_at, member) VALUES (?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?)`,
               key, kind, JSON.stringify(parts || []), JSON.stringify(detail || {}), at, at, refused ? "refused" : "queued",
               j(verdict), j(cursor), owed ?? 0, carrier ?? null, priority === "raised" ? "raised" : null, refusedWhy, refused ? at : null, member ?? null);
      return { existed: false, state: refused ? "refused" : "queued" };
    }
    const runningNow = have.started_at !== null && running.has(keyOf(have));
    const state = refused ? "refused" : runningNow ? have.state : "queued";
    const pj = parts && parts.length ? JSON.stringify(parts) : null, dj = detail && Object.keys(detail).length ? JSON.stringify(detail) : null;
    sql.exec(`UPDATE keeps_pending SET parts=CASE WHEN ? IS NULL THEN parts ELSE ? END, detail=CASE WHEN ? IS NULL THEN detail ELSE ? END,
                cursor=CASE WHEN ? IS NULL THEN cursor ELSE ? END, owed=CASE WHEN ? IS NULL THEN owed ELSE ? END,
                carrier=CASE WHEN ? IS NULL THEN carrier ELSE ? END, verdict=CASE WHEN ? IS NULL THEN verdict ELSE ? END,
                priority=CASE WHEN ?='raised' THEN 'raised' ELSE priority END, member=COALESCE(member, ?),
                attempts=0, due_at=?, final_why=?, ended_at=?, state=? WHERE sha=? AND kind=?`,
             pj, pj, dj, dj, j(cursor), j(cursor), owed ?? null, owed ?? null, carrier ?? null, carrier ?? null, j(verdict), j(verdict),
             priority === "raised" ? "raised" : null, member ?? null, at, refusedWhy, refused ? at : null, state, key, kind);
    return { existed: true, state };
  };

  /** R98: THE REGISTRAR. `registerJob({kind, sha, session?, cursor?, owed?, carrier?, parts?, detail?, verdict?, priority?, member?})` ->
   *  `{ok: true, existed, state}` or `{ok: false, reason}`; synchronous, never throws. */
  const registerJob = (e) => {
    try {
      if (!plain(e)) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      const { kind } = e;
      if (!JOB_KINDS.includes(kind)) return { ok: false, reason: "JOB_KIND_UNKNOWN" };
      const sessionKeyed = SESSION_KEYED.includes(kind);
      const key = sessionKeyed ? e.session : e.sha;
      if (sessionKeyed && !(typeof key === "string" && key !== "" && key.length <= 200)) return { ok: false, reason: "JOB_SESSION_MISSING" };
      if (!sessionKeyed && !(typeof key === "string" && DIGEST.test(key))) return { ok: false, reason: "JOB_SHA_INVALID" };
      const parts = e.parts;
      if (parts !== undefined && !(Array.isArray(parts) && parts.every((x) => typeof x === "string" && DIGEST.test(x)))) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      if (kind === "keep" && !(Array.isArray(parts) && parts.length)) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      if (e.detail !== undefined && !plain(e.detail)) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      if (e.owed !== undefined && count(e.owed) === null) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      if (e.carrier !== undefined && (typeof e.carrier !== "string" || e.carrier.length > 400)) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      if (e.verdict !== undefined && !plain(e.verdict)) return { ok: false, reason: "JOB_ENTRY_INVALID" };
      let detail = e.detail;
      if (sessionKeyed && typeof e.sha === "string") detail = { ...(detail || {}), sha: e.sha };
      const member = typeof e.member === "string" && e.member !== "" && e.member.length <= 200 ? e.member : undefined;
      const r = write(key, kind, { parts, detail, cursor: e.cursor, owed: e.owed, carrier: e.carrier, verdict: e.verdict, priority: e.priority, member });
      /* R109 (G159): the alarm is arranged after the transaction the caller made this write in: a microtask runs once the synchronous function
         given to `transactionSync` has returned, so the row has committed (a rolled-back one leaves the alarm nothing to weigh). */
      void Promise.resolve().then(arm);
      return { ok: true, existed: r.existed, state: r.state };
    } catch (err) {
      return { ok: false, reason: "JOB_NOT_KEPT", detail: why(err) };
    }
  };

  /* R91: what a row spent awaiting the workers it was handed, the union of overlapping calls: `ms()` is the time at least one was in flight */
  const meters = new Map();
  const meterOf = (row) => {
    const k = keyOf(row);
    let m = meters.get(k);
    if (!m) { m = { open: 0, since: 0, total: 0, ms() { return m.total + (m.open > 0 ? clock() - m.since : 0); } }; meters.set(k, m); }
    return m;
  };
  /* the env an owner is handed: the same, its worker bindings' `fetch` timed. Without the bindings (a test's) the env is the owner's own. */
  const timed = (row) => {
    if (!env || typeof env !== "object") return env;
    const m = meterOf(row);
    const span = async (fn) => { if (m.open++ === 0) m.since = clock(); try { return await fn(); } finally { if (--m.open === 0) m.total += Math.max(0, clock() - m.since); } };
    return new Proxy(env, { get(target, key) {
      const v = target[key];
      if (!WORKER_BINDINGS.includes(key) || !v || typeof v.fetch !== "function") return v;
      return new Proxy(v, { get(b, p) { const f = b[p]; return p === "fetch" ? (...a) => span(() => b.fetch(...a)) : typeof f === "function" ? f.bind(b) : f; } });
    } });
  };
  /* R105: the instruments of one run, opened at its stamp and read at its end: the lag meter (the longest gap between the interval's
     beats, less the interval; null when it never beat) and the SQL cursors of the run */
  const instruments = new Map();
  const openInstruments = (row) => {
    const t = { beat: null, stretch: null, timer: null, cursors: [], run: 0, most: 0, reset: null, unmeasured: false };
    try {
      t.beat = clock();
      t.timer = setInterval(() => { const n = clock(); const gap = Math.max(0, n - t.beat - LAG_EVERY_MS); t.stretch = Math.max(t.stretch ?? 0, gap); t.beat = n; }, LAG_EVERY_MS);
      /* R78 (K5200): an instrument, never work: a run abandoned in the middle (its isolate gone) must not keep the process alive */
      if (typeof t.timer.unref === "function") t.timer.unref();
    } catch { t.timer = null; }
    meter.active = t;
    instruments.set(keyOf(row), t);
  };
  const closeInstruments = (row, units) => {
    const t = instruments.get(keyOf(row));
    instruments.delete(keyOf(row));
    if (!t) return { max_stretch_ms: null, rows_read: null, rows_written: null, units: units ?? null, max_run_statements: null };
    try { if (t.timer) clearInterval(t.timer); } catch { /* none */ }
    try { if (t.reset) clearTimeout(t.reset); } catch { /* none */ }
    if (meter.active === t) meter.active = null;
    return { max_stretch_ms: t.stretch === null ? null : Math.round(t.stretch), ...sumRows(t.cursors), units: units ?? null, max_run_statements: t.unmeasured || t.most === 0 ? null : t.most };
  };
  /* a row's run, measured at its end: the elapsed time, the part awaiting workers, the rest, the memory marker (null where none is measured)
     and what the run cost (R105) */
  const measure = (row, units = null) => {
    const from = begun.get(keyOf(row));
    const last_ms = Math.max(0, Math.round(from === undefined ? 0 : clock() - from));
    const wait_ms = Math.min(last_ms, Math.max(0, Math.round(meterOf(row).ms())));
    return { last_ms, wait_ms, own_ms: last_ms - wait_ms, last_mem: memory(), ...closeInstruments(row, units) };
  };
  /* R92, R105: the last run of this (digest or session, kind), kept after the row ends */
  const noteLast = (row, m, outcome) => {
    /* the run's statements: the largest of all the row's runs is kept (a later, smaller pass does not lower it), NULL while no run measured one */
    sql.exec(`INSERT INTO keeps_last (sha, kind, last_ms, own_ms, wait_ms, last_mem, outcome, at, max_stretch_ms, rows_read, rows_written, units, max_run_statements) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT (sha, kind) DO UPDATE SET last_ms=excluded.last_ms, own_ms=excluded.own_ms, wait_ms=excluded.wait_ms, last_mem=excluded.last_mem, outcome=excluded.outcome,
                at=excluded.at, max_stretch_ms=excluded.max_stretch_ms, rows_read=excluded.rows_read, rows_written=excluded.rows_written, units=excluded.units,
                max_run_statements=NULLIF(MAX(COALESCE(keeps_last.max_run_statements, 0), COALESCE(excluded.max_run_statements, 0)), 0)`,
             row.sha, row.kind, m.last_ms, m.own_ms, m.wait_ms, m.last_mem, outcome, now(), m.max_stretch_ms, m.rows_read, m.rows_written, m.units, m.max_run_statements ?? null);
    meters.delete(keyOf(row));
    begun.delete(keyOf(row));
  };
  const num = (v) => (v === null || v === undefined ? "NULL" : String(Math.round(v)));
  /* `row.attempts` already holds this run's try (`stamp`); the run's end clears `started_at` and notes how long it took and what it cost */
  const ended = (row, outcome, units = null) => {
    const m = measure(row, units);
    noteLast(row, m, outcome);
    return `started_at=NULL, last_ms=${num(m.last_ms)}, own_ms=${num(m.own_ms)}, wait_ms=${num(m.wait_ms)}, last_mem=${num(m.last_mem)}`;
  };
  /* R97: a failure is counted, by cause */
  const failedWhy = (row, because) => {
    const w = json(row.failed_why, {});
    const k = String(because).slice(0, 60);
    if (Object.hasOwn(w, k) || Object.keys(w).length < 20) w[k] = (w[k] || 0) + 1;
    return JSON.stringify(w);
  };
  const attempt = (row, at, because, units = null) => {
    sql.exec(`UPDATE keeps_pending SET ${ended(row, "retried", units)}, last_try=?, due_at=?, last_why=?, failed=failed+1, failed_why=?,
                state=CASE WHEN written>0 THEN 'partial' ELSE 'queued' END WHERE sha=? AND kind=?`,
             at, at + backoff(row.attempts), because, failedWhy(row, because), row.sha, row.kind);
    return "retried";
  };
  /* R97 (G168): a wait that is no failure: the owner has no home for the capture yet (`NO_HOME`); the row is tried again, backed off, and counts nothing */
  const wait = (row, at, because) => {
    sql.exec(`UPDATE keeps_pending SET ${ended(row, "retried")}, last_try=?, due_at=?, last_why=?,
                state=CASE WHEN written>0 THEN 'partial' ELSE 'queued' END WHERE sha=? AND kind=?`,
             at, at + backoff(row.attempts), because, row.sha, row.kind);
    return "retried";
  };
  /* R97 (G168): an ended row stays, `finished`, for the table's readers; the document's page no longer lists it as owed */
  const finish = (row, units = null) => {
    sql.exec(`UPDATE keeps_pending SET ${ended(row, "finished", units)}, state='finished', ended_at=?, final_why=NULL, last_why=NULL, owed=0
                WHERE sha=? AND kind=?`, now(), row.sha, row.kind);
    return "finished";
  };
  /* G127c: what a stated end carries beside its reason: a refusal for a held capture names the refused digest, its holder, and whether the digest
     is a whole or a part, so the row says what was refused and by whom (never `detail {}`) */
  const heldOf = (r) => {
    /* R97 (G160): the facts as the refusing module answered them, in its `detail`, its refusal's `detail`, or at the top of its answer; `holder` is
       null where provenance names none to this caller (D-15) */
    const d = r && (plain(r.detail) ? r.detail : plain(r.refusal) && plain(r.refusal.detail) ? r.refusal.detail : plain(r) ? r : null);
    if (!d) return null;
    const capture_sha = typeof d.capture_sha === "string" ? d.capture_sha : typeof d.sha === "string" ? d.sha : null;
    const kind = d.kind === "whole" || d.kind === "part" ? d.kind : null;
    const holder = typeof d.holder === "string" && d.holder !== "" ? d.holder : null;
    if (capture_sha === null && kind === null && holder === null) return null;
    return { kind, capture_sha, holder };
  };
  const stop = (row, at, because, units = null, state = "final", r = null) => {
    const held = heldOf(r);
    const w = json(row.failed_why, {});
    if (held) w[String(because).slice(0, 60)] = held;
    sql.exec(`UPDATE keeps_pending SET ${ended(row, "final", units)}, final_why=?, last_try=?, last_why=?, state=?, ended_at=?, failed_why=? WHERE sha=? AND kind=?`,
             because, at, because, state, now(), JSON.stringify(w), row.sha, row.kind);
    return "final";
  };
  const live = () => all(`SELECT * FROM keeps_pending WHERE final_why IS NULL AND state NOT IN ('refused','finished','final')`)
    /* a keep goes before any other row due with it: it makes the whole its digest's reading then reads in the same tick */
    .sort((a, b) => a.due_at - b.due_at || (a.priority === "raised" ? 0 : 1) - (b.priority === "raised" ? 0 : 1)
                    || (a.kind === "keep" ? 0 : 1) - (b.kind === "keep" ? 0 : 1)
                    || a.registered_at - b.registered_at || RANK[a.kind] - RANK[b.kind] || (a.sha < b.sha ? -1 : 1));
  const next = () => { const r = live()[0]; return r ? r.due_at : null; };

  /* R97: the counters an answer carried, written on the row; whether the run made progress (a unit written or the cursor moved) */
  const tally = (row, r, moved) => {
    const c = countersIn(r);
    const progressed = moved || (c.written ?? 0) > 0;
    const at = now();
    const from = begun.get(keyOf(row));
    const elapsed = from === undefined ? 0 : Math.max(0, clock() - from);
    const rate = (c.written ?? 0) > 0 && elapsed > 0 ? Math.round(((c.written * 1000) / elapsed) * 100) / 100 : null;
    const version = typeof (r && (r.reader_version ?? r.version)) === "string" ? String(r.reader_version ?? r.version).slice(0, 80) : null;
    sql.exec(`UPDATE keeps_pending SET written=written+?, skipped=skipped+?, owed=CASE WHEN ? IS NULL THEN owed ELSE ? END,
                last_progress_at=CASE WHEN ? THEN ? ELSE last_progress_at END, rate_per_s=CASE WHEN ? IS NULL THEN rate_per_s ELSE ? END,
                reader_version=COALESCE(?, reader_version) WHERE sha=? AND kind=?`,
             c.written ?? 0, c.skipped ?? 0, c.owed, c.owed, progressed ? 1 : 0, at, rate, rate, version, row.sha, row.kind);
    return { progressed, units: c.written, owed: c.owed };
  };
  /* R101 (2): the pages an answer named as killing their reader, each counted one kill */
  const countKills = (row, r) => {
    for (const p of killedIn(r))
      sql.exec(`INSERT INTO job_unit_attempts (sha, kind, unit, tries, stamped_at) VALUES (?,?,?,1,NULL)
                ON CONFLICT (sha, kind, unit) DO UPDATE SET tries=tries+1`, row.sha, row.kind, `p${p}`);
  };

  /* what an owner answered, read: the entry's outcome */
  const settle = (row, at, r) => {
    if (r && r.final === true && r.refused === true) return stop(row, at, String(r.why || r.reason || r.code || "REFUSED").slice(0, 160), countersIn(r).written, "refused", r);
    if (r && (r.final === true || r.failure === "final")) return stop(row, at, String(r.why || r.reason || r.code || "FINAL").slice(0, 160), countersIn(r).written, "final", r);
    countKills(row, r);
    /* R101 (3): a transient failure (the store, the member, the network) is tried again, never written as the end, at any tick */
    if (transientIn(r)) return attempt(row, at, String((r && (r.why || r.reason || r.code)) || "TRANSIENT").slice(0, 160), countersIn(r).written);
    if (r && r.ok === true && r.more === true) {
      /* a piece ended and the rest follows by the cursor the owner answered (`detail`), one heavy piece for each tick. A piece that moved the
         cursor is progress: the isolate lived through it, so the interruptions counted before it no longer stand against what follows (fix round 6, G13) */
      const nextDetail = JSON.stringify(plain(r.detail) ? r.detail : json(row.detail, {}));
      const moved = nextDetail !== row.detail;
      const t = tally(row, r, moved);
      /* R101 (1): a step that moved neither its cursor nor any counter ends the row stated, on this tick, never retried */
      if (!t.progressed) return stop(row, at, NO_PROGRESS, t.units);
      const cursor = plain(r.detail) ? JSON.stringify(r.cursor ?? r.detail.cursor ?? r.detail) : row.cursor;
      /* due one millisecond on: a pass that went on moves its due instant (B38), so the scheduler's hold against a spin (its R27) reads a changed
         wake even where the tick began with a row found stopped, whose wake it read as "now" */
      sql.exec(`UPDATE keeps_pending SET ${ended(row, "more", t.units)}, detail=?, cursor=?, attempts=0, due_at=?, last_try=?, last_why=NULL, state='partial'${moved ? ", interrupted=0" : ""} WHERE sha=? AND kind=?`,
               nextDetail, cursor, at + 1, at, row.sha, row.kind);
      return "retried";
    }
    /* G126j: work remains while the owner says so (`owed: true`) or its counters do (`counters.owed` above zero) */
    const c = countersIn(r);
    const stillOwed = r && r.ok === true && (r.owed === true || (c.owed ?? 0) > 0);
    if (stillOwed) {
      /* work remains for the digest (extraction R82). An `ocr` pass that read pages goes on at once; a pass that read none (the member
         down) and a reading whose own failure was transient wait their back-off. A reading that left pages of a scan unread owes an `ocr`
         entry besides, and keeps its own until the next call finds the reading held. */
      const t = tally(row, r, false);
      if (row.kind === "ocr" && r.read === true) {
        sql.exec(`UPDATE keeps_pending SET ${ended(row, "more", t.units)}, attempts=0, due_at=?, last_try=?, last_why=NULL, state='partial' WHERE sha=? AND kind=?`, at, at, row.sha, row.kind);
        return "retried";
      }
      if (row.kind !== "ocr" && r.read === true) write(row.sha, "ocr", {});
      return attempt(row, at, String(r.why || "OWED"), t.units);
    }
    /* an end: the owner read it, or did it, and owes nothing; a picture's or a page's OCR that read nothing is no end (G129d) */
    /* G168: no home yet for a reading waits, uncounted, as the `ocr` kind's ends without a failure */
    if (r && r.ok === true && r.read === false && r.why === "NO_HOME" && row.kind === "reading") return wait(row, at, "NO_HOME");
    /* G168: a reading already held ends with the units the held reading wrote, whoever wrote them: the larger of the row's and the answer's */
    if (r && r.ok === true && r.why === "READING_HELD" && row.kind !== "ocr" && plain(r.counters)) {
      const c = countersIn(r);
      sql.exec(`UPDATE keeps_pending SET written=MAX(written, ?), skipped=MAX(skipped, ?) WHERE sha=? AND kind=?`, c.written ?? 0, c.skipped ?? 0, row.sha, row.kind);
      return finish(row, c.written);
    }
    if (r && r.ok === true && (r.read === true || r.done === true || (r.why === "READING_HELD" && row.kind !== "ocr")
                               || (row.kind === "ocr" && OCR_NOTHING_OWED.includes(r.why)))) { const t = tally(row, r, false); return finish(row, t.units); }
    return attempt(row, at, String(r && (r.why || r.code || r.reason) || "NOT_DONE"));
  };
  /* the run is counted before it happens: started (at the row's OWN start, `now()`, not the alarm's `at` which every row of the tick shares; R91),
     one more try, the back-off it will be first again after, and its unit stamped (R101) */
  const stamp = (row, at) => {
    const n = row.attempts + 1, began = now();
    begun.set(keyOf(row), clock());
    const state = row.kind === "fetch" ? "fetching" : "reading";
    sql.exec(`UPDATE keeps_pending SET started_at=?, attempts=?, last_try=?, due_at=?, state=? WHERE sha=? AND kind=?`, began, n, at, at + backoff(n), state, row.sha, row.kind);
    const unit = unitOf(json(row.detail, {}));
    sql.exec(`INSERT INTO job_unit_attempts (sha, kind, unit, tries, stamped_at) VALUES (?,?,?,0,?)
              ON CONFLICT (sha, kind, unit) DO UPDATE SET stamped_at=excluded.stamped_at`, row.sha, row.kind, unit, began);
    meters.delete(keyOf(row));
    return { ...row, attempts: n, started_at: began, last_try: at, state, unit };
  };
  /* the units of a row, by kills */
  const unitsOf = (row) => all(`SELECT unit, tries FROM job_unit_attempts WHERE sha=? AND kind=?`, row.sha, row.kind);
  /* R101 (2): what the reader is handed: the pages killed three times (stated, not asked), the pages killed twice (asked at half the budget) */
  const unitPlan = (row) => {
    const killedPages = [], halfBudgetPages = [];
    for (const u of unitsOf(row)) {
      const p = pageOf(u.unit);
      if (p === null) continue;
      if (u.tries >= UNIT_KILLS_MAX) killedPages.push(p);
      else if (u.tries === UNIT_KILLS_MAX - 1) halfBudgetPages.push(p);
    }
    /* (2c item 8, K4904) a window the row's cursor names (a text window, a slide, a sheet block), killed three times: handed as `killedCursor`, so
       the reader steps past it (reading-pipeline's `skipKilled`), states it and goes on */
    const d = json(row.detail, {}), unit = unitOf(d);
    const here = unit.startsWith("c") ? all(`SELECT tries FROM job_unit_attempts WHERE sha=? AND kind=? AND unit=?`, row.sha, row.kind, unit)[0] : null;
    const killedCursor = here && here.tries >= UNIT_KILLS_MAX ? (d.cursor ?? d.next) : null;
    return { killedPages: killedPages.sort((a, b) => a - b), halfBudgetPages: halfBudgetPages.sort((a, b) => a - b), ...(killedCursor !== null ? { killedCursor } : {}) };
  };
  /* a row found started by an isolate that is gone: an interrupted run, counted, and one kill of the unit it was on; a unit that is no page
     the reader can leave out, killed three times, ends the row stated */
  const startedRows = () => all(`SELECT * FROM keeps_pending WHERE final_why IS NULL AND state NOT IN ('refused','finished','final') AND started_at IS NOT NULL`)
    .filter((r) => !running.has(keyOf(r)));
  const reapInterrupted = (at) => {
    for (const row of startedRows()) {
      /* the unit the dead run stamped last (R110's, else the cursor's): a page the reader can step past, killed, is not the row's end */
      const stamped = all(`SELECT unit FROM job_unit_attempts WHERE sha=? AND kind=? AND stamped_at IS NOT NULL`, row.sha, row.kind).map((u) => u.unit);
      sql.exec(`UPDATE job_unit_attempts SET tries=tries+1, stamped_at=NULL WHERE sha=? AND kind=? AND stamped_at IS NOT NULL`, row.sha, row.kind);
      sql.exec(`UPDATE keeps_pending SET interrupted=interrupted+1, started_at=NULL, last_why=?, state=CASE WHEN written>0 THEN 'partial' ELSE 'queued' END
                WHERE sha=? AND kind=?`, "OBJECT_STOPPED", row.sha, row.kind);
      const unit = stamped.find((n) => n !== "whole") ?? unitOf(json(row.detail, {}));
      const u = all(`SELECT tries FROM job_unit_attempts WHERE sha=? AND kind=? AND unit=?`, row.sha, row.kind, unit)[0];
      /* a page or a window the reader can step past goes on (`killedPages`, `killedCursor`); only the whole, which has no unit to leave out, ends stated */
      const steppable = PAGED.includes(row.kind) && (pageOf(unit) !== null || unit.startsWith("c"));
      if (u && u.tries >= UNIT_KILLS_MAX && !steppable) {
        sql.exec(`UPDATE keeps_pending SET final_why=?, last_why=?, state='final', ended_at=?, last_try=? WHERE sha=? AND kind=?`,
                 PAGE_KILLED_READER, PAGE_KILLED_READER, now(), at, row.sha, row.kind);
        noteLast(row, { last_ms: null, own_ms: null, wait_ms: null, last_mem: null, max_stretch_ms: null, rows_read: null, rows_written: null, units: null, max_run_statements: null }, "final");
      }
    }
  };
  /* R110 (G165): the unit in flight. A paged reader calls `stampUnit("p<page>")` (or `"c<cursor>"`) synchronously before that unit's member call; the
     unit is written as the one in flight and every other stamp of the row is cleared (the whole's, the units already done), so a kill is charged to
     the unit that died, never to `whole` while a page is known. Only while the isolate is running the row; anything else is refused. */
  const UNIT = /^(p\d{1,9}|c[^]{1,200})$/;
  const stampFor = (row) => (unit) => {
    if (typeof unit !== "string" || !UNIT.test(unit) || !running.has(keyOf(row))) return false;
    try {
      sql.exec(`UPDATE job_unit_attempts SET stamped_at=NULL WHERE sha=? AND kind=? AND unit<>?`, row.sha, row.kind, unit);
      sql.exec(`INSERT INTO job_unit_attempts (sha, kind, unit, tries, stamped_at) VALUES (?,?,?,0,?)
                ON CONFLICT (sha, kind, unit) DO UPDATE SET stamped_at=excluded.stamped_at`, row.sha, row.kind, unit, now());
      return true;
    } catch { return false; }
  };
  const call = async (fn) => { try { return await fn(); } catch (e) { return { ok: false, reason: why(e) }; } };
  /* R98: what the owner is handed beside its row, so a reader below this module registers owed work through the one registrar */
  const handed = () => ({ registerJob, armJobs: arm });

  /* `detail` is what the owner's last answer left for it (a cursor over a text, `{}` at first), handed back as it was kept (R82); R101 the
     pages killed three times and twice */
  const readArgs = (row) => ({ sha: row.sha, kind: row.kind, detail: json(row.detail, {}), storeName: store(), env: timed(row), ...unitPlan(row), ...handed(), ...(PAGED.includes(row.kind) ? { stampUnit: stampFor(row) } : {}) });
  const readNow = (row, at) => call(() => extractionOf(ctx).readHeld(readArgs(row))).then((r) => settle(row, at, r));
  const owner = {
    reading: readNow,
    ocr: readNow,
    keep: async (row, at) => {
      const ev = recordOf(ctx).evidenceStore();
      if (!ev || typeof ev.putFromParts !== "function") return attempt(row, at, "NO_MULTIPART_STORE");
      const r = await call(() => ev.putFromParts(row.sha, JSON.parse(row.parts)));
      if (r && r.final === true) return stop(row, at, String(r.why || r.code || r.reason || "FINAL").slice(0, 160));
      if (!r || r.ok !== true) return attempt(row, at, String(r && (r.code || r.reason) || "REFUSED"));
      /* the whole is held: the keep ends and the reading it owes is entered, then asked for in this same tick */
      finish(row);
      write(row.sha, "reading", { carrier: row.carrier ?? undefined });
      const reading = stamp(rowOf(row.sha, "reading"), at);
      running.add(keyOf(reading));
      openInstruments(reading);
      try {
        /* G79: a keep handed to the ledger at once can end before the screen has filed the document: no home yet (`NO_HOME`) owes nothing, the filing's
           promotion owes the reading through control-plane's `unreadDocuments`. A filed document's keep still owes its reading. */
        const asked = await call(() => extractionOf(ctx).readHeld(readArgs(reading)));
        sql.exec(`UPDATE job_unit_attempts SET stamped_at=NULL WHERE sha=? AND kind=?`, reading.sha, reading.kind);
        if (asked && asked.ok === true && asked.read === false && asked.why === "NO_HOME") {
          closeInstruments(reading);
          sql.exec(`DELETE FROM keeps_pending WHERE sha=? AND kind='reading'`, reading.sha);
          sql.exec(`DELETE FROM job_unit_attempts WHERE sha=? AND kind='reading'`, reading.sha);
          meters.delete(keyOf(reading));
          return "finished";
        }
        return settle(reading, at, asked);
      } finally { running.delete(keyOf(reading)); }
    },
    subresources: async (row, at) => {
      const acq = acquisitionOf(ctx);
      const run = acq && typeof acq.owedRun === "function" ? acq.owedRun.bind(acq) : owedRun;   /* acquisition's export; an instance's own is a test's */
      /* a rendered document is promoted beside its shell by the door's own function (control-plane, B29), handed in by the composition; without it a pending render stays the member's "Finish it" */
      const deliver = typeof deps.deliver === "function" ? (a) => deps.deliver({ ctx, env, storeName: store(), ...a }) : undefined;
      const r = await call(() => run(captureOf(ctx), { kind: "subresources", session: row.sha }, { storeName: store(), env: timed(row), ...(deliver ? { deliver } : {}), ...handed() }));
      if (r && r.final === true && r.reason) return stop(row, at, String(r.reason).slice(0, 160));
      if (r && r.ok === true && r.done === true) return finish(row);
      return attempt(row, at, String(r && (r.reason || r.code || r.why) || (r && r.outstanding ? "OUTSTANDING" : "NOT_DONE")));
    },
    /* fix round 6, G2 (R81): a large capture's fetch, by acquisition's `owedFetch(cap, {kind: "fetch", session}, {storeName, env, deliver})`, its
       finished document handed to the same `deliver` (control-plane's, which promotes it and owes its reading). The session's row is heavy. */
    fetch: async (row, at) => {
      const acq = acquisitionOf(ctx);
      const run = acq && typeof acq.owedFetch === "function" ? acq.owedFetch.bind(acq) : acquisitionModule.owedFetch;
      if (typeof run !== "function") return attempt(row, at, "NO_OWNER");
      const deliver = typeof deps.deliver === "function" ? (a) => deps.deliver({ ctx, env, storeName: store(), ...a }) : undefined;
      const r = await call(() => run(captureOf(ctx), { kind: "fetch", session: row.sha }, { storeName: store(), env: timed(row), ...(deliver ? { deliver } : {}), ...handed() }));
      if (r && r.final === true) return stop(row, at, String(r.reason || r.why || r.code || "FINAL").slice(0, 160), null, "final", r);
      if (r && r.ok === true && r.done === true) return finish(row);
      if (r && r.ok === true && r.more === true) return settle(row, at, r);   /* the fetch goes on at the next tick, from where it stopped */
      return attempt(row, at, String(r && (r.reason || r.code || r.why) || "NOT_DONE"));
    },
    /* the archive-unpack drain's call (plane/unpack.mjs): `op=unpack` as the daemon, through the door. G129e: the project the archive was
       filed under (`detail.project`, given at registration) rides with the call, so a continuation's members land in it; a transient failure
       is an attempt, never a member's end. */
    unpack: async (row, at) => {
      if (!(env && env.SELF && typeof env.SELF.fetch === "function" && typeof env.DAEMON_TOKEN === "string" && env.DAEMON_TOKEN !== ""))
        return attempt(row, at, "NOT_CONFIGURED");
      const d = json(row.detail, {});
      let status = 0, body = null;
      try {
        const res = await timed(row).SELF.fetch(new Request("https://self/api/?op=unpack", { method: "POST",
          headers: { authorization: `Bearer ${env.DAEMON_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({ archiveSha: row.sha, ...(typeof d.project === "string" && d.project ? { project: d.project } : {}) }) }));
        status = res.status;
        body = await res.json();
      } catch { /* an unreadable answer is an attempt */ }
      const r = body && typeof body === "object" ? (body.result && typeof body.result === "object" ? body.result : body) : null;
      if (status >= 200 && status < 300 && r && r.ok !== false) {
        if (r.complete === true) return finish(row);
        const code = r.waiting_on && (r.waiting_on.code || r.waiting_on.reason);
        if (typeof code === "string" && /^(ARCHIVE_TREE_|ARCHIVE_DEPTH_MAX)/.test(code)) return stop(row, at, code);   /* a limit no retry changes; the page states it */
        return attempt(row, at, typeof code === "string" ? code : "WAITING");   /* a daily budget, a member waiting on a transient store: owed until it renews */
      }
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) return stop(row, at, String(r && (r.reason || r.code) || `REFUSED_${status}`).slice(0, 160));
      return attempt(row, at, `STATUS_${status}`);
    },
  };
  const run = async (row0, at) => {
    const row = stamp(row0, at);
    running.add(keyOf(row));
    openInstruments(row);
    try {
      const w = deps.workers && deps.workers[row.kind];
      if (typeof w === "function") return settle(row, at, await call(() => w({ ...row, parts: json(row.parts, []), detail: json(row.detail, {}), ...unitPlan(row) }, { at, ...handed(), ...(PAGED.includes(row.kind) ? { stampUnit: stampFor(row) } : {}) })));
      if (typeof owner[row.kind] !== "function") return attempt(row, at, "NO_OWNER");
      return await owner[row.kind](row, at);
    } finally {
      running.delete(keyOf(row));
      closeInstruments(row);
      /* the run answered: its unit's stamp is cleared, so a later tick does not count this run a kill */
      try { sql.exec(`UPDATE job_unit_attempts SET stamped_at=NULL WHERE sha=? AND kind=?`, row.sha, row.kind); } catch { /* none */ }
    }
  };
  /* an end kept a month for the table's readers, then removed */
  const prune = () => { try { sql.exec(`DELETE FROM keeps_pending WHERE state IN ('finished','refused') AND ended_at < ?`, now() - ENDED_KEEP_MS); } catch { /* kept */ } };

  const view = (r) => ({ sha: r.sha, kind: r.kind, state: r.final_why === null ? "owed" : "final", job_state: r.state, attempts: r.attempts,
    registered_at: r.registered_at, next_try: r.final_why === null ? r.due_at : null, last_try: r.last_try, why: r.final_why ?? r.last_why,
    detail: json(r.detail, {}), interrupted: r.interrupted, running: r.started_at !== null && running.has(keyOf(r)), last_ms: r.last_ms,
    own_ms: r.own_ms, wait_ms: r.wait_ms, last_mem: r.last_mem, written: r.written, skipped: r.skipped, owed: r.owed, failed: r.failed,
    failed_why: json(r.failed_why, {}), priority: r.priority ?? null });

  h = {
    /** R75, R77, R97 (and R5's migration pass): the ledger's table; one an earlier release wrote (one row for each digest, a count
     *  that gave up) is carried over and every entry of it re-armed, so none stays given up. The job table's columns are added to a
     *  ledger of any earlier shape, each row keeping what it had (a stated end stays `final`), the new counters new data only. */
    migrate() {
      const cols = all(`PRAGMA table_info(keeps_pending)`).map((c) => c.name);
      if (cols.length && !cols.includes("detail")) {
        const at = now();
        sql.exec(`ALTER TABLE keeps_pending RENAME TO keeps_pending_old`);
        sql.exec(KEEPS_PENDING_DDL);
        sql.exec(`INSERT INTO keeps_pending (sha, kind, parts, attempts, registered_at, due_at, last_try, last_why)
                  SELECT sha, kind, parts, 0, registered_at, ?, last_try, last_why FROM keeps_pending_old`, at);
        sql.exec(`DROP TABLE keeps_pending_old`);
      } else sql.exec(KEEPS_PENDING_DDL);
      /* fix round 5: the run's accounting; a ledger of the round before gains the columns and its rows start with none */
      const have = all(`PRAGMA table_info(keeps_pending)`).map((c) => c.name);
      for (const [col, def] of [["started_at", "INTEGER"], ["interrupted", "INTEGER NOT NULL DEFAULT 0"], ["last_ms", "INTEGER"], ["last_mem", "INTEGER"],
                                ["own_ms", "INTEGER"], ["wait_ms", "INTEGER"], ...JOB_COLUMNS])
        if (!have.includes(col)) sql.exec(`ALTER TABLE keeps_pending ADD COLUMN ${col} ${def}`);
      /* R97: a row the old ledger ended for a stated reason is a `final` job; every other row is owed, `queued` */
      if (!have.includes("state")) sql.exec(`UPDATE keeps_pending SET state='final', ended_at=COALESCE(last_try, registered_at) WHERE final_why IS NOT NULL`);
      sql.exec(KEEPS_LAST_DDL);
      const last = all(`PRAGMA table_info(keeps_last)`).map((c) => c.name);
      for (const col of TICK_FIGURES) if (!last.includes(col)) sql.exec(`ALTER TABLE keeps_last ADD COLUMN ${col} INTEGER`);
      sql.exec(JOB_UNIT_ATTEMPTS_DDL);
      sql.exec(JOB_BATCHES_DDL);
    },
    /** R98: the registrar (synchronous, never throws) and the arming after the commit (asynchronous) */
    registerJob,
    armJobs: () => arm(),
    /** R77: owed work, whatever its kind, through the registrar, the alarm armed. `parts` (a keep) and `detail` (a cursor, a session's key) are the owner's. */
    async owe({ kind, sha, session, parts, detail } = {}) {
      /* the ledger's key is the digest, but a web capture's outstanding files, and its fetch, are owed by its SESSION (acquisition R100) */
      const sessionKeyed = SESSION_KEYED.includes(kind);
      const key = sessionKeyed ? session : sha;
      if (!JOB_KINDS.includes(kind)) return { ok: false, reason: "PENDING_MALFORMED" };
      if (sessionKeyed ? (typeof key !== "string" || key === "" || key.length > 200) : (typeof key !== "string" || !DIGEST.test(key)))
        return { ok: false, reason: "PENDING_MALFORMED" };
      const p = parts === undefined ? [] : parts;
      if (!Array.isArray(p) || !p.every((x) => typeof x === "string" && DIGEST.test(x)) || (kind === "keep" && p.length === 0)
          || (detail !== undefined && (detail === null || typeof detail !== "object" || Array.isArray(detail))))
        return { ok: false, reason: "PENDING_MALFORMED" };
      const r = registerJob({ kind, ...(sessionKeyed ? { session } : {}), ...(sha !== undefined ? { sha } : {}), parts: p, ...(detail !== undefined ? { detail } : {}) });
      if (!r.ok) return { ok: false, reason: r.reason === "JOB_NOT_KEPT" ? "PENDING_NOT_KEPT" : "PENDING_MALFORMED", ...(r.detail ? { detail: r.detail } : {}) };
      await arm();
      return { ok: true };
    },
    /** acquisition R100: owed work of the kinds `subresources` and `unpack` (the hook `captureOf(ctx).owedLater`) */
    owedLater(entry) { return h.owe(entry || {}); },
    /** acquisition R96: a keep that will not end inside the bound. `parts` are the part digests in order. */
    keepLater({ sha, parts } = {}) { return h.owe({ kind: "keep", sha, parts }); },
    /** control-plane R120, R123: work the door deferred; a keep names its parts, which only acquisition has. R108: a `project` (a non-empty string
     *  of at most 200 characters) is kept as the row's `detail.project`, so the unpack drain sends it; absent or any other, the row carries none. */
    add({ kind, sha, project } = {}) {
      if (kind === "keep") return Promise.resolve({ ok: false, reason: "PENDING_MALFORMED" });
      const kept = typeof project === "string" && project !== "" && project.length <= 200;
      return h.owe({ kind, sha, ...(kept ? { detail: { project } } : {}) });
    },
    /** R104 (G128): a batch of a job lands once: true the first time `(sha, kind, batch)` is landed, false after. Synchronous. */
    landBatch({ sha, kind, batch } = {}) {
      if (typeof sha !== "string" || !JOB_KINDS.includes(kind) || (typeof batch !== "string" && !Number.isInteger(batch))) return false;
      const had = all(`SELECT 1 AS x FROM job_batches WHERE sha=? AND kind=? AND batch=?`, sha, kind, String(batch))[0];
      if (had) return false;
      sql.exec(`INSERT INTO job_batches (sha, kind, batch, landed_at) VALUES (?,?,?,?)`, sha, kind, String(batch), now());
      return true;
    },
    /** R97: one job row, every column, or null */
    jobRow({ sha, kind } = {}) {
      const r = typeof sha === "string" && JOB_KINDS.includes(kind) ? rowOf(sha, kind) : null;
      if (!r) return null;
      return { ...r, parts: json(r.parts, []), detail: json(r.detail, {}), verdict: r.verdict === null ? null : json(r.verdict, null),
               cursor: r.cursor === null ? null : (() => { try { return JSON.parse(r.cursor); } catch { return null; } })(), failed_why: json(r.failed_why, {}) };
    },
    /** R101: the attempts stamped on a row's units, `[{unit, tries, stamped_at}]` */
    unitAttempts({ sha, kind } = {}) { return all(`SELECT unit, tries, stamped_at FROM job_unit_attempts WHERE sha=? AND kind=? ORDER BY unit`, sha, kind).map((r) => ({ ...r })); },
    /** every entry still owed or ended for a stated reason, or those of one digest, with the state the document's page states: `owed`, or
     *  `final` with its reason (a `refused` row is `final`); `job_state` is R97's. A row that finished owes nothing and is not listed. */
    list({ sha } = {}) {
      const rows = sha === undefined ? all(`SELECT * FROM keeps_pending WHERE state <> 'finished'`) : all(`SELECT * FROM keeps_pending WHERE sha=? AND state <> 'finished'`, sha);
      return rows.sort((a, b) => a.registered_at - b.registered_at || (a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : RANK[a.kind] - RANK[b.kind])).map(view);
    },
    /** R98: the rows that ended (`finished`, `refused`, `final`), after the cursor `after` (the `next` of the page before; none: from the
     *  first), at most `limit`: `{ok, rows: [{sha, kind, state, why, written, skipped, owed, failed, ended_at, member}], next}`. The member is
     *  the one the registration named, else null. A read; writes nothing. */
    readingsEnded({ after = null, limit = 100 } = {}) {
      const n = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
      const [t, s, k] = typeof after === "string" && after ? after.split("\u0001") : [null, null, null];
      const rows = (t === null
        ? all(`SELECT * FROM keeps_pending WHERE state IN ('refused','finished','final') AND ended_at IS NOT NULL ORDER BY ended_at, sha, kind LIMIT ?`, n)
        : all(`SELECT * FROM keeps_pending WHERE state IN ('refused','finished','final') AND ended_at IS NOT NULL
                 AND (ended_at > ? OR (ended_at = ? AND (sha > ? OR (sha = ? AND kind > ?)))) ORDER BY ended_at, sha, kind LIMIT ?`,
               Number(t), Number(t), s, s, k, n));
      const out = rows.map((r) => ({ sha: r.sha, kind: r.kind, state: r.state, why: r.final_why ?? null, written: r.written, skipped: r.skipped,
                                     owed: r.owed, failed: r.failed, ended_at: r.ended_at, member: r.member ?? null }));
      const lastRow = rows[rows.length - 1];
      return { ok: true, rows: out, next: rows.length === n && lastRow ? `${lastRow.ended_at}\u0001${lastRow.sha}\u0001${lastRow.kind}` : null };
    },
    /** R92, R105: the last run of each kind held for a digest or session, after its row has ended or while it is owed: `{kind, outcome,
     *  last_ms, own_ms, wait_ms, last_mem, at, max_stretch_ms, rows_read, rows_written, units, max_run_statements}` */
    ledgerLast({ sha } = {}) {
      return all(`SELECT kind, outcome, last_ms, own_ms, wait_ms, last_mem, at, max_stretch_ms, rows_read, rows_written, units, max_run_statements FROM keeps_last WHERE sha=?`, sha)
        .sort((a, b) => RANK[a.kind] - RANK[b.kind]).map((r) => ({ ...r }));
    },
    /** counts for each kind and state, with no digest: what a member's diagnosis may see */
    summary() {
      const out = {};
      for (const r of h.list()) { const k = out[r.kind] || (out[r.kind] = { owed: 0, final: 0 }); k[r.state]++; }
      return out;
    },
    /** the scheduler consumer `{name, key, due, wake, tick}` (scheduler R8) */
    consumer() {
      return {
        name: PENDING_NAME, key: "pendingwork",
        /* a row found started by an isolate that is gone is reaped at the next alarm, not at its back-off. `wake` is the entry's own due
           instant, never raised to "now": the scheduler holds a consumer whose wake, read after its tick, equals the one read before it and
           is in the past (its R27, against a spin), so a wake clamped to the tick's instant looked unchanged after a pass that went on and
           the entry, due again at once, waited for an arm outside a firing (fix round 5, B38). A pass that went on moves its due instant. */
        due: (at) => { const n = next(); return (n !== null && n <= at) || startedRows().length ? at : null; },
        wake: (at) => { const n = next(); return startedRows().length ? at : n; },
        tick: async (at) => {
          const out = { asked: 0, finished: 0, retried: 0, final: 0, results: [] };
          reapInterrupted(at);
          prune();
          const due = live().filter((r) => r.due_at <= at);
          /* the light kinds first, then one heavy row: a read that can starve the object is never followed by another in the same tick */
          const light = due.filter((r) => !HEAVY.includes(r.kind)).slice(0, PENDING_BATCH);
          /* a due keep goes first: it makes the whole its digest's reading then reads in the same tick */
          const heavy = due.filter((r) => HEAVY.includes(r.kind)).sort((a, b) => (a.kind === "keep" ? 0 : 1) - (b.kind === "keep" ? 0 : 1)).slice(0, 1);
          for (const row of [...light, ...heavy]) {
            out.asked++;
            const done = await run(row, at);
            out[done === "finished" ? "finished" : done === "final" ? "final" : "retried"]++;
            out.results.push({ sha: row.sha, kind: row.kind, outcome: done });
          }
          return { pendingwork: out };
        },
      };
    },
  };
  HOLDERS.set(ctx, h);
  return h;
}

/** The store-internal route `pendingadd`: no caller's own, reached by the door with the stamps it sets. And the member's read
 *  `owedwork` (R77): the entries owed on one digest (`sha`), else the counts for each kind; the plane's own arm, declared. An
 *  administrator's answer also carries what the watchdog sees (R80, R103): `last_run`, `alarm_at`, `stale`, `oldest_overdue`,
 *  `watchdog_seen`, `watchdog_ran` and `running_since`, from `health` (the scheduler's, read-only: it re-arms nothing). Who asks is the
 *  door's `viewer` stamp, judged by `administers(viewer)` (`administersOf`, below, handed by the composition), never a `cls` the caller
 *  wrote: a member's screen never shows a stall, nor when the watchdog ran (K4565). An administrator whose `health` throws or answers no
 *  object is shown the seven fields as null and a `watchdog_why` (K4566): a stall is never hidden by silence. */
export const WATCHDOG_FIELDS = Object.freeze(["last_run", "alarm_at", "stale", "oldest_overdue", "watchdog_seen", "watchdog_ran", "running_since"]);

/** R90 (G58): who is an administrator, by the spellings the door stamps as `viewer`: the machine credential `class:admin`, the founder's
 *  bare `admin` (`member-roster` R73's root spelling, which the door stamps for the founder's session: admission `resolveSession`), and
 *  `member:<id>` naming an active administrator, which `isAdministrator(id)` (membership's) judges. Any other spelling, and no
 *  viewer, is not one. */
export function administersOf(isAdministrator) {
  return (viewer) => {
    if (typeof viewer !== "string") return false;
    if (viewer === "class:admin") return true;
    if (baseViewer(viewer) === ROOT_ADMIN) return true;
    const id = viewerMember(viewer);
    return id !== null && typeof isAdministrator === "function" && isAdministrator(id) === true;
  };
}

const lastOf = (holder, sha) => (typeof holder.ledgerLast === "function" ? holder.ledgerLast({ sha }) : []);
export function pendingOps(holder, url, { health, administers } = {}) {
  const stalled = async (answer) => {
    if (typeof health !== "function" || typeof administers !== "function" || answer.ok !== true) return answer;
    let admin = false;
    try { admin = administers(url.searchParams.get("viewer")) === true; } catch { admin = false; }
    if (!admin) return answer;
    let seen = null, because = null;
    try { seen = await health(); } catch (e) { because = why(e); }
    if (seen && typeof seen === "object") return { ...answer, ...Object.fromEntries(WATCHDOG_FIELDS.map((k) => [k, seen[k] ?? null])) };
    return { ...answer, ...Object.fromEntries(WATCHDOG_FIELDS.map((k) => [k, null])), watchdog_why: because || "WATCHDOG_UNREADABLE" };
  };
  return {
    pendingadd: () => holder.add({ kind: url.searchParams.get("kind"), sha: url.searchParams.get("sha"), project: url.searchParams.get("project") ?? undefined }),
    /* R107 (K4916; control-plane R135): one job row, every column, ended rows included, `row: null` when none; store-internal (the door
       applies the sight check), a read */
    jobrow: () => {
      const sha = url.searchParams.get("sha"), kind = url.searchParams.get("kind");
      if (!JOB_KINDS.includes(kind)) return { ok: false, reason: "BAD_KIND" };
      const good = SESSION_KEYED.includes(kind) ? typeof sha === "string" && sha !== "" && sha.length <= 200 : typeof sha === "string" && DIGEST.test(sha);
      if (!good) return { ok: false, reason: "BAD_SHA" };
      return { ok: true, row: typeof holder.jobRow === "function" ? holder.jobRow({ sha, kind }) : null };
    },
    owedwork: () => {
      const sha = url.searchParams.get("sha");
      if (sha === null) return stalled({ ok: true, owed: holder.summary() });
      if (DIGEST.test(sha)) return stalled({ ok: true, sha, owed: holder.list({ sha }), last: lastOf(holder, sha) });
      /* a `subresources` or `fetch` row is keyed by its capture session (R77, R81): the key is read when a row of those kinds holds it */
      const owed = holder.list({ sha }).filter((e) => SESSION_KEYED.includes(e.kind));
      return owed.length ? stalled({ ok: true, sha, owed, last: lastOf(holder, sha) }) : { ok: false, reason: "BAD_SHA" };
    },
  };
}
