/* The job registrar's stub (requirements/test-support.md R27; fix round 9, plan section 2c.1). Not product code;
 * importing it has no side effect. The real registrar is plane-2's table, wired by the composition root as
 * `capture.registerJob`; acquisition, capture, doorbell and extraction test against this stub until it merges ("a kill
 * between the put and the transaction finds one job row"), and control-plane's seam repeats it on the real table.
 *
 * The contract: `registerJob({kind, sha, session?, cursor?, owed?, carrier?, parts?, detail?, verdict?, priority?})
 * -> {ok:true, existed, state} | {ok:false, reason}`, synchronous, never throwing. Idempotent on (sha or session,
 * kind): a second registration re-arms the row and updates cursor, owed, detail and parts only when given, never
 * the counters; `priority: "raised"` is "Read it" and is never lowered. The row commits or rolls back with the
 * caller's transaction (`transact(fn)` here, as `core.transact` there); arming the alarm is `armJobs()`, after. */

/** The kinds a job row may have: today's PENDING_KINDS and the four this round adds. */
export const JOB_KINDS = Object.freeze(["keep", "reading", "ocr", "subresources", "unpack", "fetch", "scan", "safe_view", "grade", "ingest"]);
/** The kinds keyed by capture session, not by digest. */
export const SESSION_KEYED = Object.freeze(["fetch", "subresources"]);
const SHA = /^[0-9a-f]{64}$/;

/**
 * Plain data, as a row's JSON columns carry it.
 * @typedef {string | number | boolean | null | JobValueList | JobValueRecord} JobValue
 */
/** @typedef {JobValue[]} JobValueList */
/** @typedef {{[key: string]: JobValue}} JobValueRecord */
/**
 * A registration the contract takes: `sha` (64 lower-case hex digits) for a kind keyed by digest, `session` for one
 * keyed by capture session (SESSION_KEYED).
 * @typedef {Object} JobEntry
 * @property {string} kind one of JOB_KINDS
 * @property {string} [sha]
 * @property {string} [session]
 * @property {JobValue} [cursor]
 * @property {number} [owed]
 * @property {string} [carrier]
 * @property {JobValue} [parts]
 * @property {JobValue} [detail]
 * @property {JobValue} [verdict]
 * @property {string} [priority] "raised" is "Read it"; any other value is none
 */
/**
 * A job row as the stub keeps it.
 * @typedef {Object} JobRow
 * @property {string} kind
 * @property {string | null | undefined} sha null for a kind keyed by capture session
 * @property {string | null} session
 * @property {string} state
 * @property {JobValue} verdict
 * @property {JobValue} cursor
 * @property {number} owed
 * @property {JobValue} parts
 * @property {JobValue} detail
 * @property {string | null} carrier
 * @property {"raised" | null} priority
 * @property {number} written
 * @property {number} skipped
 * @property {number} failed
 * @property {{[reason: string]: number}} failed_why
 * @property {number | null} last_progress_at
 * @property {number | null} rate_per_s
 * @property {string | null} reader_version
 */
/**
 * A reader's progress write, as `bump` stands in for it.
 * @typedef {Object} JobProgress
 * @property {string} [state]
 * @property {number} [written]
 * @property {number} [skipped]
 * @property {number} [failed]
 * @property {{[reason: string]: number}} [failed_why]
 * @property {number | null} [last_progress_at]
 * @property {number | null} [rate_per_s]
 * @property {string | null} [reader_version]
 */
/**
 * @typedef {{ok: true, existed: boolean, state: string} | {ok: false, reason: string}} JobAnswer
 */
/**
 * @typedef {Object} JobRegistrarStub
 * @property {(e: unknown) => JobAnswer} registerJob synchronous; never throws
 * @property {<T>(fn: () => T) => T} transact
 * @property {() => Promise<void>} armJobs
 * @property {() => JobRow[]} rows copies, in the order first written
 * @property {() => boolean} armed
 * @property {(key: string, kind: string, fields: JobProgress) => void} bump
 */

/**
 * `jobRegistrarStub()` -> `{registerJob, armJobs, rows(), armed(), transact(fn), bump(key, kind, fields)}`. `rows()`
 * lists the committed rows in the order first written; `bump` stands in for a reader's progress write (counters and
 * state), so a test can show a re-registration keeps them.
 * @returns {JobRegistrarStub}
 */
export function jobRegistrarStub() {
  /** @type {Map<string, JobRow>} */
  let table = new Map([]);
  let changed = false, armedSince = false;
  const keyOf = (/** @type {JobEntry} */ e) => `${SESSION_KEYED.includes(e.kind) ? e.session : e.sha}\u0000${e.kind}`;

  /**
   * @param {unknown} e
   * @returns {string | null} the reason it is refused, or null for an entry the contract takes
   */
  function check(e) {
    if (e === null || typeof e !== "object") return "JOB_ENTRY_INVALID";
    /** @type {{kind?: unknown, session?: unknown, sha?: unknown}} every object has these, perhaps undefined */
    const o = e;
    const kind = o.kind;
    if (typeof kind !== "string" || !JOB_KINDS.includes(kind)) return "JOB_KIND_UNKNOWN";
    if (SESSION_KEYED.includes(kind)) {
      const session = o.session;
      return typeof session === "string" && session ? null : "JOB_SESSION_MISSING";
    }
    const sha = o.sha;
    return typeof sha === "string" && SHA.test(sha) ? null : "JOB_SHA_INVALID";
  }

  /**
   * @param {unknown} e
   * @param {string | null} reason what check(e) answered
   * @returns {e is JobEntry}
   */
  const isEntry = (e, reason) => reason === null;

  /**
   * @param {unknown} e
   * @returns {JobAnswer}
   */
  function registerJob(e) {
    try {
      const reason = check(e);
      if (!isEntry(e, reason)) return { ok: false, reason: reason ?? "JOB_ENTRY_INVALID" };
      const key = keyOf(e), row = table.get(key);
      if (row) {
        const { cursor, owed, detail, parts } = e;
        if (cursor !== undefined) row.cursor = structuredClone(cursor);
        if (owed !== undefined) row.owed = structuredClone(owed);
        if (detail !== undefined) row.detail = structuredClone(detail);
        if (parts !== undefined) row.parts = structuredClone(parts);
        if (e.priority === "raised") row.priority = "raised";
        row.state = "queued";
        changed = true; armedSince = false;
        return { ok: true, existed: true, state: row.state };
      }
      table.set(key, {
        kind: e.kind, sha: SESSION_KEYED.includes(e.kind) ? null : e.sha, session: e.session ?? null,
        state: "queued", verdict: e.verdict ?? null, cursor: e.cursor ?? null, owed: e.owed ?? 0, parts: e.parts ?? null,
        detail: e.detail ?? null, carrier: e.carrier ?? null, priority: e.priority === "raised" ? "raised" : null,
        written: 0, skipped: 0, failed: 0, failed_why: {}, last_progress_at: null, rate_per_s: null, reader_version: null,
      });
      changed = true; armedSince = false;
      return { ok: true, existed: false, state: "queued" };
    } catch (err) {
      return { ok: false, reason: "JOB_ENTRY_INVALID" };
    }
  }

  /**
   * Runs `fn` as one transaction: when it throws, every row it wrote or changed is as it was, and the error goes on.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  function transact(fn) {
    const before = new Map([...table].map(([k, v]) => [k, structuredClone(v)]));
    const beforeArmed = armedSince;
    try { return fn(); } catch (e) { table = before; armedSince = beforeArmed; throw e; }
  }

  return {
    registerJob, transact,
    async armJobs() { armedSince = true; changed = false; },
    rows: () => [...table.values()].map((r) => structuredClone(r)),
    armed: () => armedSince,
    bump(key, kind, fields) {
      const row = table.get(`${key}\u0000${kind}`);
      if (!row) throw new Error(`jobRegistrarStub: no row for ${kind}`);
      Object.assign(row, fields);
    },
  };
}
