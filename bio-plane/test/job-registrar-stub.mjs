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
 * `jobRegistrarStub()` -> `{registerJob, armJobs, rows(), armed(), transact(fn), bump(key, kind, fields)}`. `rows()`
 * lists the committed rows in the order first written; `bump` stands in for a reader's progress write (counters and
 * state), so a test can show a re-registration keeps them.
 */
export function jobRegistrarStub() {
  let table = new Map();
  let changed = false, armedSince = false;
  const keyOf = (e) => `${SESSION_KEYED.includes(e.kind) ? e.session : e.sha}\u0000${e.kind}`;

  function check(e) {
    if (e === null || typeof e !== "object") return "JOB_ENTRY_INVALID";
    if (!JOB_KINDS.includes(e.kind)) return "JOB_KIND_UNKNOWN";
    if (SESSION_KEYED.includes(e.kind)) return typeof e.session === "string" && e.session ? null : "JOB_SESSION_MISSING";
    return typeof e.sha === "string" && SHA.test(e.sha) ? null : "JOB_SHA_INVALID";
  }

  function registerJob(e) {
    try {
      const reason = check(e);
      if (reason) return { ok: false, reason };
      const key = keyOf(e), row = table.get(key);
      if (row) {
        for (const f of ["cursor", "owed", "detail", "parts"]) if (e[f] !== undefined) row[f] = structuredClone(e[f]);
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

  /** Runs `fn` as one transaction: when it throws, every row it wrote or changed is as it was, and the error goes on. */
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
