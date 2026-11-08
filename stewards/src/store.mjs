/* stewards: the service's one store, a SQLite Durable Object (R16). Every op runs whole in one turn of the object, so a
   limit's check and its count, or a decision and its register entry, never interleave with another request. The Worker
   calls it by `stub.fetch` with `{op, args}` and reads `{ok, ...}` or `{refused, ...}`. */
import { LIMITS, UNDECIDED_MAX, PAGE_SIZE, SERVICE_SOURCE, DAY, bucketOf, firstBucket, retryAfter, oldestKept } from "./limits.mjs";
import { DECISIONS, validReason, validTarget, checkRulePart, rulePartOf } from "./config.mjs";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (ref TEXT PRIMARY KEY, kind TEXT NOT NULL, concerns TEXT NOT NULL,
     description TEXT NOT NULL, contact TEXT, received INTEGER NOT NULL, latest_act INTEGER, state TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS reports_received ON reports (received DESC, ref DESC)`,
  `CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL, decision TEXT NOT NULL,
     reason TEXT NOT NULL, service TEXT, item TEXT, already INTEGER NOT NULL DEFAULT 0, steward TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS withdrawals (service TEXT NOT NULL, item TEXT NOT NULL, since INTEGER NOT NULL,
     ref TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (service, item))`,
  `CREATE TABLE IF NOT EXISTS counts (scope TEXT NOT NULL, source TEXT NOT NULL, bucket INTEGER NOT NULL, n INTEGER NOT NULL,
     PRIMARY KEY (scope, source, bucket))`,
  `CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS purge_log (at INTEGER NOT NULL, contacts_erased INTEGER NOT NULL, reports_deleted INTEGER NOT NULL)`,
];

const REF_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function newRef() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return "r-" + [...b].map((x) => REF_ALPHABET[x % 32]).join("");
}

export class StewardsStore {
  constructor(state) {
    this.sql = state.storage.sql;
    for (const s of SCHEMA) this.sql.exec(s);
    /* R24: a listing withdrawal's rule part and the rule text's version, kept per decision; added to a store made before. */
    const have = new Set(this.rows("SELECT name FROM pragma_table_info('decisions')").map((r) => r.name));
    for (const col of ["rule_part", "rule_text_version"]) if (!have.has(col)) this.sql.exec(`ALTER TABLE decisions ADD COLUMN ${col} TEXT`);
  }

  async fetch(request) {
    const { op, args } = await request.json();
    const fn = OPS[op];
    if (!fn) return Response.json({ refused: "NO_SUCH_OP" }, { status: 400 });
    return Response.json(fn.call(this, args || {}));
  }

  rows(q, ...b) { return [...this.sql.exec(q, ...b)]; }
  one(q, ...b) { return this.rows(q, ...b)[0] ?? null; }

  spanRows(limit, source, now) {
    return this.rows("SELECT bucket, n FROM counts WHERE scope = ? AND source = ? AND bucket >= ?",
      limit.scope, source, firstBucket(limit, now));
  }
  bump(limit, source, now) {
    this.sql.exec(`INSERT INTO counts (scope, source, bucket, n) VALUES (?, ?, ?, 1)
      ON CONFLICT (scope, source, bucket) DO UPDATE SET n = n + 1`, limit.scope, source, bucketOf(limit, now));
  }
  dropOldCounts(now) {
    for (const [scope, b] of Object.entries(oldestKept(now))) this.sql.exec("DELETE FROM counts WHERE scope = ? AND bucket < ?", scope, b);
  }
}

const OPS = {
  /* R3, R4: the intake. Limits are read and the report stored in one turn. */
  intake({ source, now, report }) {
    this.dropOldCounts(now);
    if (this.one("SELECT COUNT(*) AS n FROM reports WHERE state = 'undecided'").n >= UNDECIDED_MAX) return { refused: "INTAKE_FULL" };
    let wait = null;
    for (const [limit, src] of [[LIMITS.sourceHour, source], [LIMITS.sourceDay, source], [LIMITS.serviceDay, SERVICE_SOURCE]]) {
      const r = retryAfter(limit, this.spanRows(limit, src, now), now);
      if (r != null) wait = Math.max(wait ?? 0, r);
    }
    if (wait != null) return { refused: "REPORT_RATE_LIMITED", retryAfter: wait };
    let ref = newRef();
    while (this.one("SELECT ref FROM reports WHERE ref = ?", ref)) ref = newRef();
    this.sql.exec("INSERT INTO reports (ref, kind, concerns, description, contact, received, latest_act, state) VALUES (?, ?, ?, ?, ?, ?, NULL, 'undecided')",
      ref, report.kind, report.concerns, report.description, report.contact ?? null, now);
    this.bump(LIMITS.sourceHour, source, now);
    this.bump(LIMITS.sourceDay, source, now);
    this.bump(LIMITS.serviceDay, SERVICE_SOURCE, now);
    return { ok: true, ref, received: now };
  },

  /* R8: a sign-in; `match` is the Worker's comparison of the key. The limit holds even for a right key. */
  signin({ source, now, match, name, hash, expires }) {
    this.dropOldCounts(now);
    const wait = retryAfter(LIMITS.signin, this.spanRows(LIMITS.signin, source, now), now);
    if (wait != null) return { refused: "STEWARD_SIGNIN_LIMITED", retryAfter: wait };
    if (!match) { this.bump(LIMITS.signin, source, now); return { refused: "STEWARD_SIGNIN_REFUSED" }; }
    this.sql.exec("INSERT INTO sessions (hash, name, expires) VALUES (?, ?, ?)", hash, name, expires);
    return { ok: true };
  },
  session({ hash, now }) {
    this.sql.exec("DELETE FROM sessions WHERE expires <= ?", now);
    const s = this.one("SELECT name FROM sessions WHERE hash = ?", hash);
    return s ? { ok: true, name: s.name } : { refused: "STEWARD_SESSION_REQUIRED" };
  },
  signout({ hash }) {
    this.sql.exec("DELETE FROM sessions WHERE hash = ?", hash);
    return { ok: true };
  },

  /* R11. */
  list({ page = 1 }) {
    const rows = this.rows(`SELECT ref, kind, concerns, received, state FROM reports ORDER BY received DESC, ref DESC LIMIT ? OFFSET ?`,
      PAGE_SIZE + 1, (page - 1) * PAGE_SIZE);
    return { ok: true, reports: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE };
  },
  get({ ref }) {
    const r = this.one("SELECT ref, kind, concerns, description, contact, received, state FROM reports WHERE ref = ?", ref);
    if (!r) return { refused: "NO_SUCH_REPORT" };
    const decisions = this.rows("SELECT decision, reason, service, item, already, steward, at, rule_part, rule_text_version FROM decisions WHERE ref = ? ORDER BY id", ref)
      .map(({ rule_part, rule_text_version, ...d }) => ({ ...d, already: !!d.already,
        ...(rule_part != null ? { rule_part, rule_text_version } : {}) }));
    const standing = this.rows("SELECT service, item, since FROM withdrawals WHERE ref = ? ORDER BY since DESC", ref);
    return { ok: true, report: r, decisions, standing };
  },

  /* R12, in its refusal order (the session is the Worker's). */
  decide({ ref, decision, reason, withdraw, steward, now, ruleTextVersion }) {
    const r = typeof ref === "string" ? this.one("SELECT ref, kind FROM reports WHERE ref = ?", ref) : null;
    if (!r) return { refused: "NO_SUCH_REPORT" };
    if (!DECISIONS.includes(decision)) return { refused: "DECISION_UNKNOWN" };
    if (!validReason(reason)) return { refused: "NO_REASON" };
    let already = false;
    if (decision === "withdraw") {
      if (!validTarget(withdraw)) return { refused: "WITHDRAW_TARGET_INVALID" };
      const partRefused = checkRulePart(withdraw);
      if (partRefused) return { refused: partRefused };
      if (withdraw.service === "public_listing" && !ruleTextVersion) return { refused: "RULE_TEXT_VERSION_UNSET" };
      already = !!this.one("SELECT 1 AS x FROM withdrawals WHERE service = ? AND item = ?", withdraw.service, withdraw.item);
      if (!already) this.sql.exec("INSERT INTO withdrawals (service, item, since, ref, kind) VALUES (?, ?, ?, ?, ?)",
        withdraw.service, withdraw.item, now, ref, r.kind);
    }
    const listing = decision === "withdraw" && withdraw.service === "public_listing";
    this.sql.exec("INSERT INTO decisions (ref, decision, reason, service, item, already, steward, at, rule_part, rule_text_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ref, decision, reason, decision === "withdraw" ? withdraw.service : null, decision === "withdraw" ? withdraw.item : null,
      already ? 1 : 0, steward, now, listing ? rulePartOf(withdraw) : null, listing ? ruleTextVersion : null);
    this.sql.exec("UPDATE reports SET latest_act = ?, state = ? WHERE ref = ?", now, decision === "dismiss" ? "dismissed" : "withdrawn", ref);
    return { ok: true, ref, decision, ...(decision === "withdraw" ? { already } : {}),
      ...(listing ? { rule_part: rulePartOf(withdraw), rule_text_version: ruleTextVersion } : {}) };
  },

  /* R13: reinstatement, recorded on the report whose withdrawal it ends. */
  reinstate({ service, item, reason, steward, now }) {
    if (!validReason(reason)) return { refused: "NO_REASON" };
    const w = typeof service === "string" && typeof item === "string"
      ? this.one("SELECT ref FROM withdrawals WHERE service = ? AND item = ?", service, item) : null;
    if (!w) return { refused: "NOT_WITHDRAWN" };
    this.sql.exec("DELETE FROM withdrawals WHERE service = ? AND item = ?", service, item);
    this.sql.exec("INSERT INTO decisions (ref, decision, reason, service, item, already, steward, at) VALUES (?, 'reinstate', ?, ?, ?, 0, ?, ?)",
      w.ref, reason, service, item, steward, now);
    this.sql.exec("UPDATE reports SET latest_act = ? WHERE ref = ?", now, w.ref);
    return { ok: true, ref: w.ref };
  },

  /* R13, R22: the standing withdrawals, newest first. */
  register() {
    return { ok: true, register: this.rows("SELECT service, item, since, ref, kind FROM withdrawals ORDER BY since DESC, service, item") };
  },

  /* R15. */
  purge({ now, contactDays, reportDays }) {
    if (!contactDays || !reportDays) return { ok: true, skipped: true };
    const contacts = this.rows(`SELECT ref FROM reports WHERE contact IS NOT NULL AND latest_act IS NOT NULL AND latest_act + ? <= ?`,
      contactDays * DAY, now);
    for (const { ref } of contacts) this.sql.exec("UPDATE reports SET contact = NULL WHERE ref = ?", ref);
    let deleted = 0;
    const due = this.rows("SELECT ref FROM reports WHERE latest_act IS NOT NULL AND latest_act + ? <= ?", reportDays * DAY, now);
    for (const { ref } of due) {
      const standing = this.rows("SELECT service, item FROM withdrawals WHERE ref = ?", ref);
      if (standing.length) {
        this.sql.exec("UPDATE reports SET description = '', contact = NULL WHERE ref = ?", ref);
        const keep = this.rows("SELECT id, service, item FROM decisions WHERE ref = ? AND decision = 'withdraw' AND already = 0", ref)
          .filter((d) => standing.some((w) => w.service === d.service && w.item === d.item)).map((d) => d.id);
        this.sql.exec(`DELETE FROM decisions WHERE ref = ? AND id NOT IN (${keep.map(() => "?").join(",") || "NULL"})`, ref, ...keep);
      } else {
        this.sql.exec("DELETE FROM decisions WHERE ref = ?", ref);
        this.sql.exec("DELETE FROM reports WHERE ref = ?", ref);
        deleted++;
      }
    }
    this.dropOldCounts(now);
    this.sql.exec("DELETE FROM sessions WHERE expires <= ?", now);
    this.sql.exec("INSERT INTO purge_log (at, contacts_erased, reports_deleted) VALUES (?, ?, ?)", now, contacts.length, deleted);
    return { ok: true, contactsErased: contacts.length, reportsDeleted: deleted };
  },
  purgeLog() { return { ok: true, log: this.rows("SELECT at, contacts_erased, reports_deleted FROM purge_log ORDER BY at") }; },
};
