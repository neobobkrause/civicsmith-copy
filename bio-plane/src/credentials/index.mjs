/* credentials — the credentials a person or the instance acts by: the founder's password and claim, members' passwords
 * and sessions, the signer keys whose signatures the record accepts, the credentials AI work runs under, the short-lived
 * grant an ask or a standing question reads under, the group's own keys for keyed outside services (T33-20); and, from
 * T35 (the security package N680, N703, K1888; K1881, K1934), the sign-in window, sign-out, sessions held as digests,
 * agent credential expiry, the count-only security tally with its map and level, and administrators' recovery codes;
 * and, from T36 (T36-7; DEC-172, K1946, K2038), each outside security tool's credentials under R29, the tally's totals
 * for a period and its store-internal route; and, from T37 (T37-6; DEC-182 (4), N761), a member's own password change
 * and a mint that carries no digest refused; and, from T47 (T47-9, T47-81; N955, K2976, K3060 D4, K3061 D3, K3076), a
 * run segment's credential minted in the plane, sessions by device and inactivity with their lock, the password asked
 * again, sign-in by handle, every member's recovery codes and the administrator's reset link; and, from T50 (T50-5;
 * N1186, K3557), the optional project a grant or a run's credential is minted in, which fences the viewer it makes
 * (R79: membership R149's `projectViewer`).
 *
 * Which AI account pays for an assistant's act (each member's own accounts, the team's, a
 * project's account, the switches for each kind of use, the material limits, the notices and the disclosure, each
 * account's history) moved to `ai-accounts` in T48 (T48-10, T48-11; N996, K3101), split by copy (K617, K624). This
 * module creates it in its factory with the seal secret and asks it, never a copy (R27, R29, R32, R63, R73). Its
 * transitional delegates, ops, `USE_KINDS` and `ACCOUNT_CHECKS` view stay answered only until their last readers
 * re-point (R72, retired T53, K5457: deleted by the first job after that).
 *
 * Requirements: build/requirements/credentials.md (R1–R79; R26, and R22–R25, R33–R37, R43, R51, R52, R54–R62, R64, R70
 * moved to `ai-accounts`, retired). Split from `membership` (K617, K636 BOB-1, K637; T19 layer
 * 2, CREDENTIALS #1): the code is copied from `membership/index.mjs` and `schema.mjs`, without change of meaning, and
 * reads `members` only through membership's services (`memberFacts`, `sessionRights`, `isAdministrator`,
 * `activeAdmins`, `notAnAdmin`), never by SQL. Who the members are, and what each may do, is membership's; this module
 * never decides it. Membership reaches this module's sessions and keys only through its `onRevoked` notice (R16), and
 * reads the founder's claim through the one fact this module registers (R17).
 *
 * SHAPE (K61). `credentialsOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`,
 * reaching record-core by `recordOf(ctx)` and membership by `membershipOf(ctx)` on the same `ctx`; a test may pass its
 * own as `credentialsOf(ctx, { record, membership })`, and the composition root passes the Worker's seal secret
 * (`sealSecret`, R29; handed to `ai-accounts`, its R24, R32) on the first call. Its first construction is this
 * module's start: it registers the revocation listener (R16) and the claim fact (R17) with membership, and the
 * clearing listener (R73) with `ai-accounts`. Every refusal names its reason; no service
 * throws.
 */
import { MACHINE_CLASS_PREFIX, isMachineIdentity, sha256HexSync } from "../record-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { Membership, membershipOf, notAnAdmin, noSuchMember, noSuchProject, projectViewer } from "../membership/index.mjs";
import { aiAccountsOf, AI_ACCOUNT_CHECKS, USE_KINDS } from "../ai-accounts/index.mjs";
import { CREDENTIALS_SCHEMA, CREDENTIALS_ADDITIVE_COLUMNS, CREDENTIALS_TABLES } from "./schema.mjs";
export { CREDENTIALS_EXEMPT_TABLES, CREDENTIALS_TABLES } from "./schema.mjs";
import { CREDENTIALS_CHECKS, SIGNER_ENROLMENT_CHECKS, AI_CREDENTIAL_CHECKS, ACCOUNT_CHECKS,
         KEYED_SERVICE_CHECKS, SIGN_IN_CHECKS, SIGN_IN_WINDOW, SIGN_IN_STATED } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";
export { CREDENTIALS_CHECKS, SIGNER_ENROLMENT_CHECKS, AI_CREDENTIAL_CHECKS, KEYED_SERVICE_CHECKS, SIGN_IN_CHECKS }
  from "./checks.mjs";
/* (T48, transitional; K3101; R72 retired T53, K5457) `ACCOUNT_CHECKS` as its readers knew it, a frozen view of
   `ai-accounts`' rows (`AI_ACCOUNT_CHECKS`) with this module's own C-29 rows (`checks.mjs`' `ACCOUNT_CHECKS`), answered
   from here only and never from `checks.mjs`, until its readers re-point (store-door's and control-plane's tests). Each
   row is the holding module's own object. */
const ACCOUNT_CHECKS_VIEW = Object.freeze({ ...AI_ACCOUNT_CHECKS, ...ACCOUNT_CHECKS });
export { ACCOUNT_CHECKS_VIEW as ACCOUNT_CHECKS };

/* (T48, transitional; K3101) the kinds of use, `ai-accounts`' own (its R14), answered here unchanged until this
   module's users read them from there. */
export { USE_KINDS };
/* R27: an ask grant's life, in seconds (it also ends with the member's session). */
export const AI_GRANT_TTL_SECONDS = 900;
/* R28 (K1505 (14); N580, K1603, K1609): the ask's op allow-list, held by the grant's class, each entry the op's name as
   the plane routes it. `answers`' `ASK_SCOPE` (its R1) is held equal to it, both ways, by answers' copy test. Every op
   here is a read; a grant admits no write. `rule` is answers' door to every rule service (its R7). (T53; K5457)
   `aicredential` is `ai-accounts`' R65: the agent Worker reads the sealed key of the act's own account under the ask's
   grant at the call; that op serves the Worker's principal alone, so a member holding the grant is refused it there. */
export const AI_GRANT_OPS = Object.freeze([
  "aicredential", "calculation", "career", "committedagainstpaid", "dutiesof", "dutyoccurrences", "entity", "entitybyalias",
  "eventsfor", "explore", "frontier", "holderat", "linesof", "meaningrows", "money", "moneyof", "profiles", "relation",
  "resolutions", "rule", "search", "searchfields", "standard", "standardinforce", "standards", "strengthbarof",
  "structureat", "timeline",
]);
/* R29 (K1449): the keyed outside services the team may hold a key for, by name: CourtListener's lookup. (T53; R84, N1259,
   K5666) `ca-officers`, the state's officers lookup, is the second; no `openfec` (the federal bulk files need no key). (T36; K1946
   T1) Beside them, each outside security tool `file-safety` adds holds its credentials under its own service,
   `security:<tool_id>` (the tool id 1 to 120 letters, digits, `.`, `_` or `-`). */
export const KEYED_SERVICES = Object.freeze(["courtlistener", "ca-officers"]);
export const SECURITY_SERVICE_PREFIX = "security:";
const SECURITY_SERVICE_RE = /^security:[A-Za-z0-9._-]{1,120}$/;

/* R38's bounds (SIGN_IN_WINDOW, SIGN_IN_STATED) are defined in checks.mjs, where the pause's words read them; they are
   re-exported here as before. */
export { SIGN_IN_WINDOW, SIGN_IN_STATED };
/* R63 (T47; N955, K2976, K3033): the write ops the runner makes on a run, in every deployed mode: `check`'s (agent-worker
   R37) and `plan`'s (agent-worker R53, `optionpropose` with `airuntick` and `airunclose`). A run segment's credential
   holds a non-empty list of these and nothing else; `ai-runs` passes the run's mode's own. A mode deployed later adds
   its writes here in its own entry. */
export const AI_RUN_WRITES = Object.freeze(["airuntick", "suggest", "capturerequest", "airunclose", "optionpropose"]);
/* R63: a run segment's credential's life, in seconds: under one day (the job's value, six hours, well past any one
   segment's wall-clock bound), never renewed; the next segment mints its own. */
export const AI_RUN_CREDENTIAL_TTL_SECONDS = 6 * 3600;
/* R73 (T53; `ai-accounts` R26): the reasons an account is cleared, as that module's notice words them. */
export const ACCOUNT_CLEARED_WHY = Object.freeze(["removed", "disconnected", "revoked", "refused", "unresolved"]);
/* R42 (F15; K1934 (2)): an agent credential's life in whole days, and its default. */
export const AI_CREDENTIAL_EXPIRY_DAYS = Object.freeze({ min: 1, max: 365, default: 90 });
/* R44 (N703; DEC-165, DEC-166; K1934 (2)): the tally's kinds, and how long its counts are kept. */
export const SECURITY_KINDS = Object.freeze(["signin", "credential", "rate", "handover", "through"]);
export const SECURITY_DAYS = 90;
/* R45 (DEC-166 (1)): the map's note, exactly. */
export const SECURITY_NOTE = word("credentials.country_proof_behind");
/* R45 (K1881, K1934 (2), (3)): an hour is unusual at `atLeast` or more and more than `times` its usual (more than
   `times` itself when its usual is 0); the usual is the median of the same hour of the day over `usualDays` days. */
export const SECURITY_THRESHOLD = Object.freeze({ atLeast: 10, times: 5, usualDays: 28 });
/* R46 (K1888): how many recovery codes an issue gives. */
export const RECOVERY_CODE_COUNT = 10;
/* R65 (T47; Bob K3061 D3, "as recommended"; K3070): a session's device, `shared` when not said, and its limits in ms.
   A `shared` session ends after `sharedIdle` without activity; an `own` one locks after `ownLock`, ends `ownEndAfterLock`
   after it locked, and ends `ownMax` after its sign-in in any case (BOB's cap, P17). */
export const SESSION_DEVICES = Object.freeze(["own", "shared"]);
export const SESSION_LIMITS = Object.freeze({ sharedIdle: 15 * 60e3, ownLock: 30 * 60e3, ownEndAfterLock: 12 * 3600e3,
  ownMax: 30 * 24 * 3600e3 });
/* R65 (fix round 10, cause 24 (a); K5057): `last_active` is kept at this grain, in ms: a foreground read writes it only when the
   stored value is older, so a read is not a write on every request and an idle ending moves by at most one grain. */
export const ACTIVITY_GRAIN_MS = 60e3;
/* R66 (T47; K3061 D3): the window the password asked again opens, in ms (BOB's, P17). */
export const REAUTH_WINDOW_MS = 5 * 60e3;
/* R69 (T47; K3060 D4): an administrator's reset link lives this many days. */
export const RESET_LINK_DAYS = 7;

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/* A whole-second instant, the record's `…:00Z` spelling. */
const stampSecond = (when = Date.now()) => new Date(when).toISOString().replace(/\.\d+Z$/, "Z");

/* The founder's role and member id (membership's `ROOT_ADMIN`): the credentials role the founder holds. */
const ROOT = Membership.ROOT_ADMIN;

export class Credentials {
  /* `accounts` is `ai-accounts`' instance on the same storage, made by `credentialsOf` with the seal secret (`ai-accounts` R32). */
  constructor({ sql, core = null, membership = null, accounts = null, now = null } = {}) {
    this.sql = sql;
    this.core = core;
    this.membership = membership;
    this.accounts = accounts;
    this.now = typeof now === "function" ? now : null;   /* K5148: the clock handed in (`credentialsOf`), else the wall clock */
    this.env = null;   /* K5132: the store's environment, set by `credentialsOps` (`#nowMs`) */
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* K5132 (fix round 10, cause 1; R-CLOCK; K5148): the instance clock. The clock this instance was handed (`now`, a
     function of milliseconds) answers first; else the store's environment (`env.BIO_NOW_MS`, handed in by `credentialsOps`);
     else the wall clock. Every instant this module records, and every judgement of one, reads it; a duration measured for a
     reply (R9's `timings`) stays on the wall clock. */
  #nowMs() {
    if (this.now) {
      const handed = Number(this.now());
      if (Number.isFinite(handed) && handed >= 0) return handed;
    }
    const raw = this.env ? this.env.BIO_NOW_MS : undefined;
    if (raw !== undefined && raw !== null && raw !== "") {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
    return Date.now();
  }

  /* ===== START: the seam with membership (K637) =====
   *
   * R16: one listener on membership's revocation notice (its R79). Each time a member becomes `revoked` (a carried
   * removal, membership R8; a revocation, its R20), every session of theirs ends and every signer key registered to
   * them is revoked, named for the act's actor, inside the revoking act (the notice is called after the act's writes,
   * in the caller's transaction). Membership ignores a listener's answer and survives its throw; a session left open
   * by a failure here holds no capability (membership R92 resolves a revoked member to none at every read) and a key
   * left `active` does not attest (R8 asks the member's status), so a failure is never a credential kept.
   * R17: the one fact `claimed()`, read by membership's R64 and R86 through its R94. Registered once; each answer is
   * membership's R81 (a second registration is refused, so `start` is idempotent through `credentialsOf`).
   * R20 (K774): `setPassword` registered as the setter membership's `enroll` calls inside its own act (its R95), so a
   * member's password is set in the one act that enrols them, as before the split, and membership stores none. The
   * setter is asked `{role, password}` and answers R3's `{ok, role}` (a promise: the derivation is asynchronous). Until
   * membership offers R95 (its later work in this layer, K774) there is nothing to register with, and `password` reads
   * null.
   * R73 (T48; K3101): one registration with `ai-accounts`' `onAccountCleared` (its R26), so a member's run credentials
   * and standing grants end inside the act that clears her account (`#accountCleared`). */
  start() {
    const revoked = this.membership.onRevoked("credentials", (notice) => this.#memberRevoked(notice));
    const claimed = this.membership.registerClaimed("credentials", () => this.claimed());
    const password = typeof this.membership.registerPasswordSetter === "function"
      ? this.membership.registerPasswordSetter(({ role, password } = {}) => this.setPassword({ role, password }))
      : null;
    const cleared = this.accounts.onAccountCleared("credentials", (notice) => this.#accountCleared(notice));
    return { revoked, claimed, password, cleared };
  }

  #memberRevoked({ memberId, by = null, at = null } = {}) {
    if (typeof memberId !== "string" || memberId === "") return;
    this.sql.exec(`DELETE FROM sessions WHERE role=?`, `member:${memberId}`);
    this.sql.exec(`DELETE FROM ai_grants WHERE member_id=?`, memberId);   /* R27: their grants end with their sessions */
    /* R16 (T35): their unspent recovery codes are spent (R46), in the same act. (T48; K3101) Their connected sign-in
       is cleared by `ai-accounts`' own listener (its R27), earlier in the module order. */
    this.sql.exec(`UPDATE recovery_codes SET spent_at=? WHERE role=? AND spent_at IS NULL`, this.#instant(at),
      `member:${memberId}`);
    /* R69 (T47): their live reset links end with them */
    this.sql.exec(`UPDATE password_reset_links SET ended_at=? WHERE member_id=? AND spent_at IS NULL AND ended_at IS NULL`,
      stampSecond(this.#nowMs()), memberId);
    /* R63: her run segments' credentials are revoked with her (a cleared sign-in revokes them too, R73) */
    this.#revokeRunCredentials(`principal=?`, [`member:${memberId}`], stampSecond(this.#nowMs()), Credentials.#memberOf(by));
    /* REC-159: the cascade is the revoking act's, so the keys it revokes name its actor. R21: a key it revokes takes
       the act's own time (the notice's `at`) as `status_at`; a key already revoked keeps its own. */
    this.sql.exec(
      `UPDATE signers SET status='revoked', status_by=?,
         status_at=CASE WHEN status<>'revoked' THEN ? ELSE status_at END WHERE member_id=?`,
      by ?? null, this.#instant(at), memberId);
  }

  /* R17: true exactly when the founder's credential is held, which R1's claim writes and a re-armed claim replaces.
     Writes nothing and never throws: a store that cannot be read answers not claimed. */
  claimed() {
    try { return !!this.#one(`SELECT role FROM credentials WHERE role=?`, ROOT); }
    catch { return false; }
  }

  /* R80 (T51 CR-16; K4076): the newest `last_active` over every session this module holds (R5), as the ISO-8601 instant
     it is kept as (milliseconds), or null when none is held or none has recorded one. A read that changes nothing: it
     reads the rows and never `session()`, which would count as activity. Never throws; a store that cannot be read
     answers null, as one that holds no activity does. */
  lastActivity() {
    try {
      const r = this.#one(`SELECT MAX(last_active) AS at FROM sessions`);
      const ms = r && r.at !== null && r.at !== undefined ? Number(r.at) : NaN;
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    } catch { return null; }
  }

  /* This module's tables, at every boot, idempotent: (T48) `ai-accounts`' own first (its R32), then the additive
     columns an older store lacks, then every table and index created if absent, then R18's purge exemption declared.
     Run by the host inside its boot. */
  migrate() {
    this.accounts.migrate();
    const cols = (t) => [...this.sql.exec(`PRAGMA table_info(${t})`)].map((r) => r.name);
    this.#tx(() => this.#sessionsAsDigests(cols));
    for (const [table, column, decl] of CREDENTIALS_ADDITIVE_COLUMNS) {
      const have = cols(table);
      if (have.length && !have.includes(column)) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
    const bare = CREDENTIALS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    /* R42 (K1934 (5)): a credential minted before expiry was recorded is given 90 days from this migration. Only such a
       row has no `expires_at`, since every mint records one, so a later boot finds none to give. */
    this.sql.exec(`UPDATE ai_credentials SET expires_at=? WHERE expires_at IS NULL`,
      stampSecond(this.#nowMs() + AI_CREDENTIAL_EXPIRY_DAYS.default * DAY_MS));
    /* R65: a session made before activity was recorded is counted active from this boot */
    this.sql.exec(`UPDATE sessions SET last_active=? WHERE last_active IS NULL`, this.#nowMs());
    this.declareTables();
  }

  /* R40 (F13): a store whose sessions are held as tokens (the `token` column) is carried over, once, to their SHA-256
     digests: each live row is copied under its token's digest into the new table and the old table is dropped, and
     every ask grant's session (R27) is re-pointed to the same digest, so every session and grant stays live and no
     token stays stored. A store already carried over, or a new one, has nothing to carry. */
  #sessionsAsDigests(cols) {
    const have = cols("sessions");
    if (!have.includes("token") || have.includes("token_sha")) return;
    const held = this.#rows(`SELECT token, role, expires, created FROM sessions`);
    this.sql.exec(`ALTER TABLE sessions RENAME TO sessions_held_as_tokens`);
    this.sql.exec(`CREATE TABLE sessions (token_sha TEXT PRIMARY KEY, role TEXT NOT NULL, expires INTEGER NOT NULL,
                   created TEXT NOT NULL)`);
    for (const r of held)
      this.sql.exec(`INSERT OR IGNORE INTO sessions (token_sha, role, expires, created) VALUES (?,?,?,?)`,
        Credentials.#tokenSha(r.token), r.role, r.expires, r.created);
    this.sql.exec(`DROP TABLE sessions_held_as_tokens`);
    if (cols("ai_grants").includes("session"))
      for (const g of this.#rows(`SELECT grant_sha, session FROM ai_grants WHERE session <> ''`))
        this.sql.exec(`UPDATE ai_grants SET session=? WHERE grant_sha=?`, Credentials.#tokenSha(g.session), g.grant_sha);
  }

  /* One act as one transaction, through record-core's `transact` (its R32) when the store offers it. */
  #tx(fn) { return typeof this.core?.transact === "function" ? this.core.transact(fn) : fn(); }

  /* R18, R30, through record-core's `declareTable` (its R21): every table declared explicitly with its classes, each
     purge-exempt. A refusal is thrown: a purge that silently cleared a credential would revoke authority as a side
     effect of resetting the corpus, and an export that carried a secret would publish it. (T48; K3101) Its own fourteen
     tables only: the AI accounts' eleven are `ai-accounts`' (its R28). */
  declareTables() {
    if (this.#declared) return false;
    const answer = this.core.declareTable("credentials", CREDENTIALS_TABLES.map((t) => ({ ...t })));
    if (answer && answer.ok === false)
      throw new Error(`credentials: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }
  #declared = false;

  /* ===== SIGN-IN AND SESSIONS (R1–R5) =====
   *
   * A Worker cannot rewrite its own secret, so ADMIN_TOKEN is a bootstrap credential rather than the credential. It is
   * spent once, exchanging itself for an operator-chosen password whose hash lives here. Recovery is to overwrite
   * ADMIN_TOKEN in the dashboard, which re-arms the claim. That makes the group's hosting login the root of trust,
   * which is the only thing they reliably still have when a password is lost. */

  static #enc = new TextEncoder();

  static async #derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey(
      "raw", Credentials.#enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: Credentials.#enc.encode(salt), iterations }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  static #rand(n = 32) {
    return [...crypto.getRandomValues(new Uint8Array(n))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* R40: a session token's digest, the only form a session is held or found by. */
  static #tokenSha(token) { return sha256HexSync(String(token)); }

  /* R41 (F12): two values derived from secrets agree, judged in constant time: both sides as SHA-256 digests (64 hex
     characters each, whatever was given), every character compared, the differences gathered, never a comparison that
     stops at the first difference. `digests: true` when both sides are already SHA-256 digests (R47's code). */
  static #same(a, b, { digests = false } = {}) {
    const x = digests ? String(a ?? "") : sha256HexSync(String(a ?? ""));
    const y = digests ? String(b ?? "") : sha256HexSync(String(b ?? ""));
    let diff = x.length ^ y.length;
    for (let i = 0; i < 64; i++) diff |= (x.charCodeAt(i) | 0) ^ (y.charCodeAt(i) | 0);
    return diff === 0;
  }

  /* REC-41: A FIXED, PUBLISHED, DELIBERATELY WORTHLESS SALT, and the one place a refusal pays what an acceptance pays.
     Collapsing the sign-in refusals into one code and one sentence (R4) is defeated by a stopwatch if the arms do not
     COST the same: an arm that refuses without a password check would answer in microseconds while the wrong-password
     arm runs PBKDF2 at 100,000 iterations, so "is this an active member" would be answerable with a timer. Every such
     arm awaits this first. It equalises the DOMINANT cost and is not a proof of constant time (the lookup and the
     compare still differ by microseconds); it removes the measurement an ordinary caller can make over the internet.
     The salt guards nothing and is never stored; a real credential's salt is minted per password by `setPassword`. */
  static #TIMING_SALT = "bio-login-timing-equaliser";

  static async #payLoginCost(password) {
    await Credentials.#derive(String(password ?? ""), Credentials.#TIMING_SALT, 100000);
  }

  /* R2 (REC-41, closing D-188). `op=bootstrap` is reached by any stranger, and it answers ONE question, the one the
     setup screen (`screens-entry` R18) asks before it can show anything: has this instance been claimed, and is there
     a live bootstrap credential to claim it with. It answers no roster (every role holding a credential and when its
     password was set): the credentials table is not read here at all, so there is no roster in this answer for a later
     refactor to leak. `consumedAt` stays: it is the instant the INSTANCE was claimed, a fact about this copy of the
     software that names nobody. */
  bootstrapState(tokenFp = null) {
    const b = this.#one(`SELECT consumed_at, token_fp FROM bootstrap WHERE id=1`);
    const spent = !!(b && b.consumed_at);
    /* A different bootstrap secret than the one that was spent means the operator has rotated it in the dashboard,
       which is the recovery gesture: re-arm rather than lock them out. (T49; R77, N945) Only a claim that recorded what
       it spent can be told from a rotated secret: a spent credential with no recorded fingerprint (a store from before
       `token_fp`) reads claimed for every fingerprint presented, so a bootstrap secret never re-claims a store that
       cannot tell. */
    const presented = typeof tokenFp === "string" && tokenFp !== "";
    const recorded = typeof b?.token_fp === "string" && b.token_fp !== "";
    const rearmed = spent && presented && recorded && b.token_fp !== tokenFp;
    return {
      claimed: spent && !rearmed,
      rearmed,
      consumedAt: rearmed ? null : (b?.consumed_at || null),
    };
  }

  /* R1: spending the bootstrap credential. Refused once spent, so a leaked ADMIN_TOKEN cannot silently re-claim a
     running instance; a replaced one (a different recorded fingerprint) re-arms it. R38's window is asked first, under
     the role `admin`; each refused claim counts toward it and toward R44's tally. (T49; R77, N945, K3337) A claim given
     no `tokenFp` records none, and so reads claimed. (R74, N1072) The founder chooses her handle at the claim: when
     none is held (a first claim or a re-armed one) a given `handle` is judged and recorded by membership's
     `founderHandleSet` (its R144) in the claim's one act, after R1's own refusals, its refusal answered as given and
     neither password nor handle written; with none given (K3337) the password is set and no handle is held, so R75's
     transition applies; when one is held, `handle` absent or equal to it is accepted and any other is refused by that
     same service, HANDLE_FIXED. The success answers `handle`, the held one or null. */
  async claim({ password, handle = null, tokenFp = null, source = null, country = null } = {}) {
    const gate = await this.#gate({ role: ROOT, source, country, password });
    if (gate.paused) return gate.paused;
    const refuse = (answer) => { this.#refusedAttempt(gate, country); return answer; };
    if (typeof password !== "string" || password.length < 12)
      return refuse({ ok: false, reason: "PASSWORD_TOO_SHORT", minimum: 12 });
    const st = this.bootstrapState(tokenFp);
    if (st.claimed) return refuse({ ok: false, reason: "ALREADY_CLAIMED", consumedAt: st.consumedAt });
    const hashed = await Credentials.#hashFor(password);
    const done = this.#tx(() => {
      const chosen = this.#founderHandleChosen(handle);
      if (chosen.ok !== true) return chosen;   /* nothing written yet: the handle is judged before the password */
      this.#storePassword(ROOT, hashed);
      const now = this.#instant();
      this.sql.exec(`INSERT INTO bootstrap (id, consumed_at, token_fp) VALUES (1, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET consumed_at=excluded.consumed_at,
                       token_fp=excluded.token_fp`, now, typeof tokenFp === "string" && tokenFp !== "" ? tokenFp : null);
      return { ok: true, role: ROOT, consumedAt: now, handle: chosen.handle };
    });
    return done.ok === true ? done : refuse(done);
  }

  /* R74: the founder's handle as membership holds it (its R144), or null. Never throws. */
  #founderHandle() {
    try {
      const h = this.membership.founderHandle();
      return typeof h === "string" && h !== "" ? h : null;
    } catch { return null; }
  }

  /* R74: the handle the claim takes, inside its act: the one held when `handle` is absent or equal to it, else the
     answer of membership's `founderHandleSet({handle, by: "admin"})`: the handle recorded, or its refusal (BAD_HANDLE,
     HANDLE_TAKEN with none held; HANDLE_FIXED with a different one held) as it gives it. With none held and none
     given, no handle is held (K3337). */
  #founderHandleChosen(handle) {
    const held = this.#founderHandle();
    if (held !== null && (handle === null || handle === undefined || handle === "" || handle === held))
      return { ok: true, handle: held };
    if (held === null && (handle === null || handle === undefined || handle === "")) return { ok: true, handle: null };
    return this.membership.founderHandleSet({ handle, by: ROOT });
  }

  /* R3: a salted, derived hash for `role`, replacing any earlier one; never the password. An in-plane call reached
     by no route: `enroll`'s setter (R20) and `recover` (R47). A member's own change is `passwordChange`, below. */
  async setPassword({ role, password, iterations = 100000 } = {}) {
    this.#storePassword(role, await Credentials.#hashFor(password, iterations));
    return { ok: true, role };
  }

  /* R3 (T37; N776, DEC-182 (4)) `op=setpassword`: a signed-in member's or administrator's change of their own
     password. The role is the role of the live session `session` names, `by` and `session` the control plane's
     stamps; a `role` in the body is never read, so no op sets another's password. Refusals in order, each writing
     nothing but its count: a machine credential, the operator's token or no stamp (MACHINE_CANNOT_SET_PASSWORD); no
     live session (NOT_SIGNED_IN, R39's row); R38's window, under the session's role; a new password under 12
     characters; a current password that does not derive the stored hash (CURRENT_PASSWORD_WRONG, R41's comparison),
     the only arm that judges a secret and so the only one counted toward R38's window and R44's tally (`signin`). On
     success, in one act, the password is set as `setPassword` sets it and every OTHER session of the role ends with
     the ask grants minted under it (R39); the presenting session stays. Neither password is logged, stored or
     answered. */
  async passwordChange({ current = null, password = null, by = null, session = null, source = null, country = null } = {}) {
    /* DEC-49 REGION is-password-change-own */
    if (by === null || by === undefined || by === "" || isMachineIdentity(by)) {
      const row = SIGN_IN_CHECKS.MACHINE_CANNOT_SET_PASSWORD;
      return { ok: false, reason: "MACHINE_CANNOT_SET_PASSWORD", code: "MACHINE_CANNOT_SET_PASSWORD", check: row.check,
               translation: row.translation, by: by || null,
               detail: localize("credentials.index.a_member_changes_their_own", "a member changes their own password from their own signed-in session. A machine credential, the operator's bearer and an unstamped call have no member behind them. Nothing was changed.") };
    }
    /* END DEC-49 REGION is-password-change-own */
    const s = this.#liveSession(session, { locked: true });
    if (!s) return Credentials.#notSignedIn();
    if (s.state === "locked") return Credentials.sessionLockedRefusal();   /* R65: a locked session serves no act */
    const role = s.role;
    const gate = await this.#gate({ role, source, country, password: current });
    if (gate.paused) return gate.paused;
    if (typeof password !== "string" || password.length < 12)
      return { ok: false, reason: "PASSWORD_TOO_SHORT", minimum: 12 };
    const matches = await this.#passwordMatches(role, current);
    /* DEC-49 REGION is-current-password */
    if (!matches) {
      this.#refusedAttempt(gate, country);
      const row = SIGN_IN_CHECKS.CURRENT_PASSWORD_WRONG;
      return { ok: false, reason: "CURRENT_PASSWORD_WRONG", code: "CURRENT_PASSWORD_WRONG", check: row.check,
               translation: row.translation,
               detail: localize("credentials.index.the_current_password_given", "the current password given does not derive the hash stored for this account, so the password was not changed. Nothing was changed.") };
    }
    /* END DEC-49 REGION is-current-password */
    const hashed = await Credentials.#hashFor(password);
    /* asked again in the one act that writes, so a session ended meanwhile changes nothing */
    const done = this.#tx(() => {
      const live = this.#liveSession(session);
      if (!live || live.role !== role) return null;
      this.#storePassword(role, hashed);
      const now = this.#nowMs();
      const others = this.#rows(`SELECT token_sha, expires FROM sessions WHERE role=? AND token_sha<>?`, role,
        live.token_sha);
      this.#endSessions(others.map((r) => r.token_sha));
      return { ok: true, role, ended: others.filter((r) => r.expires >= now).length };
    });
    return done ?? Credentials.#notSignedIn();
  }

  /* R3's two halves: the derivation (asynchronous), and the write (synchronous, so R47 can make it inside one act with
     the code it spends). */
  static async #hashFor(password, iterations = 100000) {
    const salt = Credentials.#rand(16);
    return { salt, iterations, hash: await Credentials.#derive(password, salt, iterations) };
  }

  #storePassword(role, { salt, hash, iterations }) {
    this.sql.exec(
      `INSERT INTO credentials (role, salt, hash, iterations, updated) VALUES (?,?,?,?,?)
       ON CONFLICT(role) DO UPDATE SET salt=excluded.salt, hash=excluded.hash,
         iterations=excluded.iterations, updated=excluded.updated`,
      role, salt, hash, iterations, this.#instant());
  }

  /* R4 (REC-39, REC-41): THE WORDS A REFUSED SIGN-IN IS GIVEN, in one place, because one refusal answers every arm: no
     credential under the role, a member who is not active, and a stored credential the password does not derive. Two
     sentences would tell the arms apart at a glance, and telling them apart is what the collapse prevents: with
     `op=bootstrap`'s roster closed, a distinguishable refusal is an unmetered anonymous oracle over who holds a
     credential. D-57's rule shapes the sentence: a refusal states what THE MECHANISM FOUND and never makes a claim about
     who is asking. It says "active" rather than "no such role" because the obvious wording is false for the revoked
     member, whose credential row is still there; and it says that it does not separate the arms, rather than leaving a
     reader to assume it does. Reversing it costs two lines (the arms are still separate below); the honest way back is
     a rate limit plus an authenticated diagnostic, not a louder anonymous refusal. */
  static LOGIN_REFUSAL_DETAIL = {
    SIGN_IN_REFUSED: localize("credentials.index.sign_in_refused",
      "no session was issued and nothing was written. Either no active credential is held under that role — a role that was never registered and one whose membership is no longer active are the same answer here — or a credential is stored and the password supplied does not derive its stored hash. The password itself is never kept, only a salted derivation of it, so that is the only comparison there is to make. Which of those happened, the record does not say: it is one answer deliberately, so that a refusal cannot be used to find out which roles hold a credential."),
  };

  static #refused() {
    return { ok: false, reason: "SIGN_IN_REFUSED", detail: Credentials.LOGIN_REFUSAL_DETAIL.SIGN_IN_REFUSED };
  }

  /* R4: exchanges a password for a bearer token, so the password does not travel on every later request. A member's
     sign-in is refused unless the member is active (membership R68's standing), so revocation closes the front door as
     well as the sessions; that arm never touches a password, so it pays the same cost first and answers the same
     words, byte for byte. R38's window is asked first; each refusal counts toward it and toward R44's tally. R40: the
     session is stored as its token's digest and the token answered once. R41: the derived hash is compared in
     constant time. (T47; R67; T49 R75) `handle` names the role (`#roleByHandle`): a handle no one holds, or none, is a
     role no credential is held under, the same refusal at the same cost; `role` is no longer read. (R65) `device`, `own` or `shared` (anything else,
     or none, `shared`), is recorded on the session; an `own` session ends `ownMax` after its sign-in at most, a `shared`
     one `ttlSeconds` after (12 hours unless said), each sooner when idle (`#stateOf`). */
  async login({ handle = null, password, ttlSeconds = 43200, device = "shared", source = null,
                country = null } = {}) {
    const role = this.#roleByHandle(handle);
    const gate = await this.#gate({ role, source, country, password });
    if (gate.paused) return gate.paused;
    const refuse = () => { this.#refusedAttempt(gate, country); return Credentials.#refused(); };
    if (typeof role === "string" && role.startsWith("member:")) {
      const m = this.#memberFacts(role.slice(7));
      if (!m || m.status !== "active") {
        await Credentials.#payLoginCost(password);
        return refuse();
      }
    }
    if (!(await this.#passwordMatches(role, password))) return refuse();
    const token = Credentials.#rand(32);
    const now = this.#nowMs();
    const own = device === "own";
    const expires = now + (own ? SESSION_LIMITS.ownMax : ttlSeconds * 1000);
    this.sql.exec(`DELETE FROM sessions WHERE expires < ?`, now);
    this.sql.exec(`INSERT INTO sessions (token_sha, role, expires, created, device, last_active) VALUES (?,?,?,?,?,?)`,
      Credentials.#tokenSha(token), role, expires, new Date(now).toISOString(), own ? "own" : "shared", now);
    this.#succeeded(gate);
    return { ok: true, role, token, expires, device: own ? "own" : "shared" };
  }

  /* R75 (T49; N1072, K3265; amends R67): the role a handle names. The founder's handle (`membership.founderHandle()`)
     names the role `admin`; a member's names `member:<id>` (membership R119, whatever their status: R4 judges it);
     `admin` names the founder only while no founder handle is held (a group claimed before T49, until its founder
     chooses once; BOB's detail, N1072). Every other handle, an empty one and none included, names `handle:<as typed>`,
     a role under which no credential is ever held and under which R38 counts the attempt, so that arm costs and answers
     as every other refusal and attempts on `admin` never pause the founder's own handle. */
  #roleByHandle(handle) {
    const typed = typeof handle === "string" ? handle : "";
    const founder = this.#founderHandle();
    if (typed !== "" && founder !== null && typed === founder) return ROOT;
    let m = null;
    if (typed !== "") { try { m = this.membership.memberByHandle(typed); } catch { m = null; } }
    if (m && typeof m.member_id === "string") return `member:${m.member_id}`;
    if (typed === ROOT && founder === null) return ROOT;
    return `handle:${typed}`;
  }

  /* R4, R41: whether `password` derives the hash stored for `role`, at one derivation's cost whether or not a
     credential is held. */
  async #passwordMatches(role, password) {
    const c = this.#one(`SELECT salt, hash, iterations FROM credentials WHERE role=?`, role);
    if (!c) { await Credentials.#payLoginCost(password); return false; }
    return Credentials.#same(await Credentials.#derive(String(password ?? ""), c.salt, c.iterations), c.hash);
  }

  /* R65 (T47; K3061 D3): a session row's state at `now`: `ended` past its cap, or idle past its device's limit; `locked`
     for an `own` one idle `ownLock` or more, until `ownEndAfterLock` after; else `live`. Idle is counted from its last
     activity; a row with none recorded (written before the column, or outside this module) is counted active now, as
     `migrate` counts it from the boot, and its first read records it. */
  static #stateOf(s, now) {
    const last = s.last_active !== null && s.last_active !== undefined && Number.isFinite(Number(s.last_active))
      ? Number(s.last_active) : now;
    const idle = now - last;
    if (s.expires < now) return "ended";
    if (s.device !== "own") return idle >= SESSION_LIMITS.sharedIdle ? "ended" : "live";
    if (idle >= SESSION_LIMITS.ownLock + SESSION_LIMITS.ownEndAfterLock) return "ended";
    return idle >= SESSION_LIMITS.ownLock ? "locked" : "live";
  }

  /* R5: what a session is, and what it may do (Membership Architecture v2 §5), resolved HERE at every read through
     membership's `sessionRights` (its R92) rather than cached on the session row: a capability change or a revocation
     takes effect on the next request, not on the next login. R40: found by the digest of the token presented.
     (T47; R65) An ended session answers null and is ended with its grants; a locked one answers `locked: true`
     holding no capability (it serves only `unlock` and sign-out, and a gate that missed the flag grants nothing); a
     request not marked `background` is activity, counted only while the session is not locked. (R66) `reauthUntil`
     is the end of the password's re-ask window while it is open, else null. */
  session(token, { background = false } = {}) {
    if (typeof token !== "string" || token === "") return null;
    this.#settleSoon();
    const sha = Credentials.#tokenSha(token);
    const s = this.#one(`SELECT role, expires, created, device, last_active, reauth_until FROM sessions WHERE token_sha=?`,
      sha);
    if (!s) return null;
    const now = this.#nowMs();
    const state = Credentials.#stateOf(s, now);
    if (state === "ended") { this.#tx(() => this.#endSessions([sha])); return null; }
    const locked = state === "locked";
    /* R65 (fix round 10): written only once the stored value is older than the grain (or none is recorded). */
    const stored = s.last_active === null || s.last_active === undefined ? NaN : Number(s.last_active);
    if (!locked && background !== true && !(now - stored < ACTIVITY_GRAIN_MS))
      this.sql.exec(`UPDATE sessions SET last_active=? WHERE token_sha=?`, now, sha);
    const r = this.membership.sessionRights(s.role) || {};
    return { role: s.role, expires: s.expires, capabilities: locked ? [] : r.capabilities ?? [],
             administer: !locked && r.administer === true, member: r.member ?? null, handle: r.handle ?? null,
             rootOfTrust: !locked && r.rootOfTrust === true, device: s.device === "own" ? "own" : "shared", locked,
             reauthUntil: !locked && Number(s.reauth_until) > now ? Number(s.reauth_until) : null };
  }

  /* R39 (F14): the session a token names, while it is live, as its stored row with its `state` (R65); null for an
     unknown, expired or ended one, and for a locked one unless `locked` admits it (sign-out and `unlock`). */
  #liveSession(token, { locked = false } = {}) {
    if (typeof token !== "string" || token === "") return null;
    const s = this.#one(`SELECT token_sha, role, expires, created, device, last_active, reauth_until FROM sessions
                         WHERE token_sha=?`, Credentials.#tokenSha(token));
    if (!s) return null;
    const state = Credentials.#stateOf(s, this.#nowMs());
    return state === "live" || (state === "locked" && locked) ? { ...s, state } : null;
  }

  /* R65 (T47; K3061 D3): SESSION_LOCKED, minted here alone: an act or read under a locked session, which serves only
     `unlock` and sign-out. An in-plane answer `admission` relays (its T47-77), and this module's own acts answer. */
  static sessionLockedRefusal() {
    /* DEC-49 REGION is-session-unlocked */
    return Credentials.#row(ACCOUNT_CHECKS, "SESSION_LOCKED", localize("credentials.index.this_session_is_locked", "this session is locked after a while without use: only unlocking it with the password, or signing out, is served. Nothing was changed."));
    /* END DEC-49 REGION is-session-unlocked */
  }

  /* R65 `unlock` and R66 `reauth`: the password of the session's own role asked again, under R38's window and compared
     as R41 states; a wrong one is SIGN_IN_REFUSED, leaving the session as it was. On success, in one act, the lock is
     cleared (activity now) and, for `reauth`, the re-ask window opens for REAUTH_WINDOW_MS. */
  async #passwordAgain({ token, password, source, country }, reauth) {
    const s = this.#liveSession(token, { locked: true });
    if (!s) return Credentials.#notSignedIn();
    const gate = await this.#gate({ role: s.role, source, country, password });
    if (gate.paused) return gate.paused;
    if (!(await this.#passwordMatches(s.role, password))) {
      this.#refusedAttempt(gate, country);
      return Credentials.#refused();
    }
    const now = this.#nowMs();
    const done = this.#tx(() => {
      if (!this.#liveSession(token, { locked: true })) return null;
      this.sql.exec(`UPDATE sessions SET last_active=?${reauth ? ", reauth_until=?" : ""} WHERE token_sha=?`, now,
        ...(reauth ? [now + REAUTH_WINDOW_MS] : []), s.token_sha);
      return { ok: true, role: s.role, locked: false, ...(reauth ? { reauthUntil: now + REAUTH_WINDOW_MS } : {}) };
    });
    if (!done) return Credentials.#notSignedIn();
    this.#succeeded(gate);
    return done;
  }

  /* R65: clears a locked session's lock with its password (`op=unlock`, the session the door authenticated). */
  unlock({ token = null, password = null, source = null, country = null } = {}) {
    return this.#passwordAgain({ token, password, source, country }, false);
  }

  /* R66: opens the password's re-ask window on the session (`op=reauth`); a locked session is unlocked by it too. */
  reauth({ token = null, password = null, source = null, country = null } = {}) {
    return this.#passwordAgain({ token, password, source, country }, true);
  }

  /* R66 (T47; K3061 D3): REAUTH_DUE, minted here alone (K231): an in-plane read, reached by no route, that the gate
     serving each weighty act (signing or publishing a case, changing administrators, connecting an AI account) relays: null
     while the session `token` names is live, unlocked and inside its re-ask window, else the refusal. Writes nothing;
     never throws. */
  reauthDue({ token = null } = {}) {
    try {
      const s = this.#liveSession(token);
      if (s && Number(s.reauth_until) > this.#nowMs()) return null;
    } catch { /* due */ }
    /* DEC-49 REGION is-reauth-window */
    return Credentials.#row(ACCOUNT_CHECKS, "REAUTH_DUE", localize("credentials.index.this_act_asks_for", "this act asks for the password again, and it was not given in the last {minutes} minutes. Nothing was changed.", { minutes: String(REAUTH_WINDOW_MS / 60e3) }));
    /* END DEC-49 REGION is-reauth-window */
  }

  static #notSignedIn() {
    /* DEC-49 REGION is-session-live */
    const row = SIGN_IN_CHECKS.NOT_SIGNED_IN;
    return { ok: false, reason: "NOT_SIGNED_IN", code: "NOT_SIGNED_IN", check: row.check, translation: row.translation,
             detail: localize("credentials.index.no_live_session_answers", "no live session answers to this token: it ended, it expired, or it never existed. Nothing was ended.") };
    /* END DEC-49 REGION is-session-live */
  }

  /* R39: the sessions named end, with every ask grant minted under them (R27); a standing question's grant has no
     session and is not touched (R32). Inside one act. */
  #endSessions(shas) {
    for (const sha of shas) {
      this.sql.exec(`DELETE FROM ai_grants WHERE session=? AND (kind IS NULL OR kind='ask')`, sha);
      this.sql.exec(`DELETE FROM sessions WHERE token_sha=?`, sha);
    }
  }

  /* R39: ends the session `token` names. */
  signOut({ token = null } = {}) {
    const s = this.#liveSession(token, { locked: true });
    if (!s) return Credentials.#notSignedIn();
    this.#tx(() => this.#endSessions([s.token_sha]));
    return { ok: true, ended: 1 };
  }

  /* R39: ends every session held under the role of the session `token` names, that one included; `ended` counts the
     live ones. Another role's sessions are not touched. */
  signOutEverywhere({ token = null } = {}) {
    const s = this.#liveSession(token, { locked: true });
    if (!s) return Credentials.#notSignedIn();
    const now = this.#nowMs();
    const all = this.#rows(`SELECT token_sha, expires FROM sessions WHERE role=?`, s.role);
    this.#tx(() => this.#endSessions(all.map((r) => r.token_sha)));
    return { ok: true, ended: all.filter((r) => r.expires >= now).length };
  }

  /* ===== THE SIGN-IN WINDOW (R38; F3, K1881) =====
   *
   * `claim`, `login`, `recover` and `passwordChange` (R3) share one window, counted per source and per role. A refused attempt is counted in
   * both; at `perSource` estimated for the source, or `perRole` for the role, in any 10 minutes, the next attempt is
   * paused before any password, code or claim is judged. The pause is ONE answer for every arm (whichever bucket is
   * full, a role held or not, a member active or not), at the cost of one password derivation, so neither its words
   * nor its time tell them apart. A pause counts toward neither window (it is R44's `rate`), and a success counts
   * toward neither and empties neither. The window keys a source and a role by a keyed digest (R44's key), so no row
   * of it names an address or a role; a call with no source counts under one shared source of its own. */

  /* R38, R44: this module's key, 256 random bits made once and kept in `security_key`, answered by no op. */
  #securityKeyHex() {
    let r = this.#one(`SELECT key_hex FROM security_key WHERE id=1`);
    if (!r) {
      this.sql.exec(`INSERT OR IGNORE INTO security_key (id, key_hex, created) VALUES (1, ?, ?)`, Credentials.#rand(32),
        stampSecond(this.#nowMs()));
      r = this.#one(`SELECT key_hex FROM security_key WHERE id=1`);
    }
    return r.key_hex;
  }

  /* HMAC-SHA-256 under that key, as hex. */
  async #keyed(text) {
    const hex = this.#securityKeyHex();
    if (this.#hmac?.hex !== hex) {
      const raw = Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));
      this.#hmac = { hex, key: await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) };
    }
    const mac = await crypto.subtle.sign("HMAC", this.#hmac.key, Credentials.#enc.encode(text));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  #hmac = null;

  /* R38's estimate for one bucket at `now`: `prev × (1 − elapsed/W) + cur`. */
  #estimate(kind, key, now) {
    const W = SIGN_IN_WINDOW.windowMs;
    const win = Math.floor(now / W);
    const at = (w) => Number(this.#one(`SELECT count FROM signin_window WHERE kind=? AND key=? AND win=?`, kind, key, w)
      ?.count ?? 0);
    return at(win - 1) * (1 - (now - win * W) / W) + at(win);
  }

  static #paused() {
    /* DEC-49 REGION is-sign-in-window */
    const row = SIGN_IN_CHECKS.SIGN_IN_PAUSED;
    return { ok: false, reason: "SIGN_IN_PAUSED", code: "SIGN_IN_PAUSED", check: row.check, translation: row.translation,
             detail: localize("credentials.index.too_many_attempts_were", "too many attempts were refused recently, so this one was not judged: no password, code or claim was checked and nothing changed. Try again later."),
             stated: SIGN_IN_STATED };
    /* END DEC-49 REGION is-sign-in-window */
  }

  /* R38: asked first by `claim` (role `admin`), `login` and `recover`, and by `passwordChange` after its session. Answers `{paused}`, the pause after its cost and
     its count (R44's `rate`), or the gate's keys for the attempt's counts. */
  async #gate({ role, source, country, password }) {
    const roleKey = await this.#keyed(`role\u0000${String(role ?? "")}`);
    const sourceKey = typeof source === "string" && source !== "" ? await this.#keyed(`source\u0000${source}`) : "none";
    const now = this.#nowMs();
    if (this.#estimate("source", sourceKey, now) >= SIGN_IN_WINDOW.perSource
        || this.#estimate("role", roleKey, now) >= SIGN_IN_WINDOW.perRole) {
      await Credentials.#payLoginCost(password);
      this.#tallyOwn("rate", country, roleKey);
      return { paused: Credentials.#paused() };
    }
    return { roleKey, sourceKey };
  }

  /* R38, R44: a refused attempt counts toward both windows and is R44's `signin`, in one act; a count that cannot be
     written is dropped and never changes the answer. */
  #refusedAttempt({ roleKey, sourceKey }, country) {
    try {
      this.#tx(() => {
        const W = SIGN_IN_WINDOW.windowMs;
        const win = Math.floor(this.#nowMs() / W);
        for (const [kind, key] of [["source", sourceKey], ["role", roleKey]])
          this.sql.exec(`INSERT INTO signin_window (kind, key, win, count) VALUES (?,?,?,1)
                         ON CONFLICT(kind, key, win) DO UPDATE SET count=count+1`, kind, key, win);
        /* the previous window is read by the estimate, so only older ones go */
        this.sql.exec(`DELETE FROM signin_window WHERE win < ?`, win - 1);
      });
    } catch { /* dropped */ }
    this.#tallyOwn("signin", country, roleKey);
  }

  /* R44: a sign-in or recovery that succeeded: a `through` when its role was paused in the hour before it; and the
     role's waiting places are dropped, so the counts they held are never placed (DEC-166). */
  #succeeded({ roleKey }) {
    try {
      this.#tx(() => {
        const now = this.#nowMs();
        this.#settle(now);
        if (this.#one(`SELECT seq FROM security_pending WHERE role=? AND kind='rate' AND at > ? LIMIT 1`, roleKey,
                      now - HOUR_MS))
          this.#bump("through", Math.floor(now / HOUR_MS), "");
        this.sql.exec(`DELETE FROM security_pending WHERE role=?`, roleKey);
      });
    } catch { /* dropped */ }
  }

  /* R46, R69 (T47; K3069, C5): whether `id` holds as an active member: an active member of the roster, or the
     founder (`admin`) once the instance is claimed (R17), who holds no member row. */
  #holderActive(id) {
    return id === ROOT ? this.claimed() : this.#memberFacts(id)?.status === "active";
  }

  /* membership R68: a member's standing, or null. Never throws here: an unreadable answer is no member. */
  #memberFacts(memberId) {
    if (typeof memberId !== "string" || memberId === "") return null;
    try { return this.membership.memberFacts(memberId) || null; } catch { return null; }
  }

  /* ===== SIGNING KEYS (R6–R11, R19) ===== */

  /* REC-159 — §4.9's custodial acts are refused before anything is looked up, so a caller with no standing learns
   * nothing about the member or key it named. `by` is the control plane's STAMP. Three shapes, three answers:
   *   - a member's id (a signed-in session): admitted only as one of membership's administrators (its R86), else
   *     NOT_AN_ADMIN through membership's `notAnAdmin` (its R84), exactly as membership R12 admits;
   *   - `class:<cls>`, the operator's bearer (BOB #22's ruling): the plane decides which classes reach here, and the
   *     record names the credential;
   *   - absent, a route with no plane in front of it: nothing is attributed, and the row records `not recorded`.
   * Answers null when the act may proceed. */
  #custodialBar(by, act) {
    if (by === null || by === undefined || by === "") return null;
    if (String(by).startsWith(MACHINE_CLASS_PREFIX)) return null;
    if (this.membership.activeAdmins().includes(by)) return null;
    return notAnAdmin(by, act);
  }

  /* REC-159: the stored actor, or the stated absence of one. */
  static #statusBy(v) { return typeof v === "string" && v !== "" ? v : "not recorded"; }

  /* R21: the instant an act changes a key's status, in `added`'s spelling (ISO 8601 with milliseconds): the act's own
     time when its caller states one (membership's revocation notice, R16), else now. */
  #instant(at = null) { return typeof at === "string" && at !== "" ? at : new Date(this.#nowMs()).toISOString(); }

  /* R8, R11, R19 (D-158) — ONE PREDICATE, AND IT IS WHAT KEEPS THE ROSTER AND THE GATE FROM DISAGREEING. A key attests
   * exactly when the key is `active` and its member is `active`; `origin` is never read (R19). `signerList` projects it
   * as `attests` and `attestingKeys` filters by it, so the roster can never report a key `op=ratify` would refuse:
   * two copies of the rule and a third reader that never asked it is what once let `op=signerlist` report `active` for
   * a key the gate answered `SIG_UNKNOWN_KEY`. The member's status is membership's fact (its R68), never a join on
   * its table. */
  static #attests(keyStatus, memberStatus) { return keyStatus === "active" && memberStatus === "active"; }

  /* D-158 — THE WRITE HALF: a key is registered only to a member who can attest, so the roster tells the truth and the
   * gate is not relaxed (relaxing it would widen an authority: a signature attesting in the name of a roster slot no
   * person has taken up). TWO CODES, because there are two facts: a member with no handle has never enrolled; one with
   * a handle whose status is not `active` is not standing. The answer carries the stored status and the enrolment fact
   * beside the code. Answers null when the member may attest. */
  #signerMemberBar(memberId) {
    const m = this.#memberFacts(memberId);
    if (!m) return noSuchMember(memberId);   /* membership R121 (N793; K231): the one site that mints NO_SUCH_MEMBER */
    if (m.status === "active") return null;
    const enrolled = typeof m.handle === "string" && m.handle !== "";
    const refusal = (code, detail) => {
      const row = SIGNER_ENROLMENT_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               memberId, member_status: m.status, enrolled };
    };
    /* DEC-49 REGION is-signer-member-attesting */
    if (!enrolled)
      return refusal("SIGNER_MEMBER_NOT_ENROLLED",
        localize("credentials.index.memberid_has_not_enrolled_status", "{memberId} has not enrolled: status '{status}', no handle chosen. op=ratify weighs a signature against the member's own standing, so a key registered now would sit on the roster as one your team's Civicsmith would refuse. Nothing was written.", { memberId: String(memberId), status: String(m.status) }));
    return refusal("SIGNER_MEMBER_NOT_ACTIVE",
      localize("credentials.index.memberid_is_on_the", "{memberId} is on the roster with status '{status}' rather than 'active'. op=ratify weighs a signature against the member's own standing and would refuse this one. Nothing was written.", { memberId: String(memberId), status: String(m.status) }));
    /* END DEC-49 REGION is-signer-member-attesting */
  }

  /* The shape R6 and R9 both take: the base64 field of an ssh-ed25519 public key (the OpenSSH wire bytes, which an
     Ed25519 WebCrypto key exports to as well; `sshsig.mjs` verifies either). One predicate, so the two doors cannot
     disagree about what a key is. */
  static #keyShaped(keyB64) { return typeof keyB64 === "string" && /^AAAA[A-Za-z0-9+/=]+$/.test(keyB64); }

  /* R6: an administrator registers a key for a member. Registering a known key rebinds it and makes it `active`, never
     a second row; `origin` 'admin' and `registered_by` the stamped actor (NULL reads `not recorded`). R21: a new key's
     `status_at` is its registration's instant; a known key's changes only when it was revoked and is re-activated. */
  signerAdd({ keyB64, memberId, comment, by = null } = {}) {
    const barCust = this.#custodialBar(by, "registering a signing key");
    if (barCust) return barCust;
    const row = CREDENTIALS_CHECKS.BAD_KEY;
    /* DEC-49 REGION is-signer-key-shape */
    if (!Credentials.#keyShaped(keyB64))
      return { ok: false, reason: "BAD_KEY", code: "BAD_KEY", check: row.check, translation: row.translation,
               detail: localize("credentials.index.expected_the_base64_field", "expected the base64 field of an ssh-ed25519 public key") };
    /* END DEC-49 REGION is-signer-key-shape */
    const barAdd = this.#signerMemberBar(memberId);
    if (barAdd) return barAdd;
    const now = this.#instant();
    this.sql.exec(
      `INSERT INTO signers (key_b64,member_id,comment,status,added,status_by,origin,registered_by,status_at)
       VALUES (?,?,?,'active',?,?,'admin',?,?)
       ON CONFLICT(key_b64) DO UPDATE SET member_id=excluded.member_id,
         comment=excluded.comment, status='active', status_by=excluded.status_by,
         origin='admin', registered_by=excluded.registered_by,
         status_at=CASE WHEN signers.status<>'active' THEN excluded.status_at ELSE signers.status_at END`,
      keyB64, memberId, comment ?? null, now, by || null, by || null, now);
    return { ok: true, keyB64, memberId, by: Credentials.#statusBy(by) };
  }

  /* ===== R9, R10, R19 (N364; DEC-80 item 4, Bob's ruling K509 (2)) — A MEMBER REGISTERS THEIR OWN KEY =====
   *
   * The key is made in the member's own browser, never by another, and each use is confirmed on the device (the
   * interface's to keep; the plane cannot test it). From a signed-in session the member registers its public half
   * here, and it attests exactly as an administrator-registered key does (R19). What keeps it accountable is that every
   * administrator is told (`notified`, membership R86's list at this instant, and the key's row, which the feed's
   * notice reads: N375, K535) and any of them can revoke the key (R7).
   *
   * THE ORDER, each step the requirement's: who is asking (a machine credential, the operator's bearer or no stamp
   * has no member to register for: C-96.17); the key's shape (R6's answer, relayed from R6's own region so C-96.8
   * keeps its one site); the member's standing (R6's bar); and whether ANOTHER member holds the key. A held key is
   * never rebound, and the refusal names no one. A key `by` already holds and that is active answers `existed: true`,
   * unchanged; one `by` holds that was revoked is refused and stays revoked (K535): only an administrator re-activates
   * a key (R7). */
  signerRegisterOwn({ keyB64, comment = null, by = null } = {}) {
    if (by === null || by === undefined || by === "" || isMachineIdentity(by)) return Credentials.#machineCannotRegister(by, "register");
    if (!Credentials.#keyShaped(keyB64)) return this.signerAdd({ keyB64 });   /* R6's BAD_KEY, from its one site */
    /* C51 (fix round 3; K4356): the answer of a registration carries `timings: {total_ms, stages}`, the whole milliseconds
       each stage that ran took: `standing` (the member's bar), `lookup` (whether the key is held), `write` (the new row,
       absent when the key is already the member's) and `notify` (membership's list of administrators). The arm makes no
       more than five store calls, whatever the size of the team or of the roster. */
    const t0 = performance.now();
    const stages = {};
    const timed = (stage, fn) => { const t = performance.now(); try { return fn(); } finally { stages[stage] = Math.floor(performance.now() - t); } };
    const bar = timed("standing", () => this.#signerMemberBar(by));
    if (bar) return bar;
    const held = timed("lookup", () => this.#one(`SELECT member_id, status, origin, registered_by FROM signers WHERE key_b64=?`, keyB64));
    /* DEC-49 REGION is-signer-key-held */
    if (held && held.member_id !== by) {
      const row = CREDENTIALS_CHECKS.SIGNER_KEY_HELD_BY_ANOTHER;
      return { ok: false, reason: "SIGNER_KEY_HELD_BY_ANOTHER", code: "SIGNER_KEY_HELD_BY_ANOTHER", check: row.check,
               translation: row.translation,
               detail: localize("credentials.index.this_key_is_registered", "this key is registered to another member of this team, and a registered key is never rebound by its own member's act. Nothing was written.") };
    }
    /* END DEC-49 REGION is-signer-key-held */
    /* DEC-49 REGION is-signer-key-revoked */
    if (held && held.status !== "active") {
      const row = CREDENTIALS_CHECKS.SIGNER_KEY_REVOKED;
      return { ok: false, reason: "SIGNER_KEY_REVOKED", code: "SIGNER_KEY_REVOKED", check: row.check,
               translation: row.translation,
               detail: localize("credentials.index.this_key_of_yours", "this key of yours was revoked, and a revoked key is re-activated only by an administrator (op=signerset), so that a revocation stands. Nothing was written.") };
    }
    /* END DEC-49 REGION is-signer-key-revoked */
    if (!held) timed("write", () => {
      const now = this.#instant();   /* R21: a new key's status_at is its registration's instant */
      this.sql.exec(
        `INSERT INTO signers (key_b64,member_id,comment,status,added,status_by,origin,registered_by,status_at)
         VALUES (?,?,?,'active',?,?,'self',?,?)`, keyB64, by, comment ?? null, now, by, by, now);
    });
    const notified = timed("notify", () => this.membership.activeAdmins());
    return { ok: true, keyB64, memberId: by, status: "active",
             origin: held ? (held.origin === "self" ? "self" : "admin") : "self",
             registered_by: held ? Credentials.#statusBy(held.registered_by) : by, existed: !!held,
             notified,
             detail: held ? localize("credentials.index.this_key_is_already", "this key is already registered to you and active; nothing was written. Every administrator is told of the registration, and any of them can revoke the key.")
                          : localize("credentials.index.registered_to_you_and", "registered to you, and it attests as any registered key does. Every administrator is told of the registration, and any of them can revoke the key."),
             timings: { total_ms: Math.max(Math.floor(performance.now() - t0), Object.values(stages).reduce((x, y) => x + y, 0)), stages } };
  }

  /* R9, R83: MACHINE_CANNOT_REGISTER_KEY (C-96.17), minted here alone (K231): a machine credential, the operator's bearer
     or an unstamped call has no member behind it, whether it registers a key (R9) or says it knows about one (R83). */
  static #machineCannotRegister(by, act) {
    /* DEC-49 REGION is-machine-register-key */
    const row = CREDENTIALS_CHECKS.MACHINE_CANNOT_REGISTER_KEY;
    return { ok: false, reason: "MACHINE_CANNOT_REGISTER_KEY", code: "MACHINE_CANNOT_REGISTER_KEY", check: row.check,
             translation: row.translation, by: by || null,
             detail: act === "register"
               ? localize("credentials.index.a_member_registers_their", "a member registers their own signing key from their own signed-in session. A machine credential, the operator's bearer and an unstamped call have no member behind them to hold one; an administrator registers a key for a member with op=signeradd. Nothing was written.")
               : localize("credentials.index.an_administrator_says_they_know", "an administrator says they know about a member's signing key from their own signed-in session. A machine credential, the operator's bearer and an unstamped call have no administrator behind them to say it. Nothing was written.") };
    /* END DEC-49 REGION is-machine-register-key */
  }

  /* R83 (T51 fix round 10; DEC-439, DEC-440, DEC-441, K5303; A-03) `op=signerknown`: an administrator says they know about
     a key a member registered for themselves. It records `known_by` (the administrator) and `known_at` (the instant) on the
     key's row, which R8 answers and which the queue's "a key was self-registered" item reads to end. It only records: the key
     attests as before (R19) and any administrator can revoke it (R7). Refusals in order, each writing nothing: no member
     behind the caller (R9's MACHINE_CANNOT_REGISTER_KEY); not an administrator (membership R84, as R13 answers it); the key's
     shape (R6's BAD_KEY, from its one site); a key not held (R7's NO_SUCH_KEY, the absent-key answer); a key not
     self-registered or not active (SIGNER_NOT_SELF_ACTIVE, C-96.55). A key already known answers `already: true` with the
     first knower and instant, writing nothing. `viewer` is the control plane's stamp, never read from the body. */
  signerKnown({ keyB64, viewer = null } = {}) {
    if (viewer === null || viewer === undefined || viewer === "" || isMachineIdentity(viewer))
      return Credentials.#machineCannotRegister(viewer, "know");
    const bar = this.#adminBar(viewer, localize("credentials.index.saying_you_know_about_a_key", "saying you know about a member's signing key"));
    if (bar) return bar;
    if (!Credentials.#keyShaped(keyB64)) return this.signerAdd({ keyB64 });   /* R6's BAD_KEY, from its one site */
    const row = this.#one(`SELECT status, origin, known_by, known_at FROM signers WHERE key_b64=?`, keyB64);
    if (!row) return { ok: false, reason: "NO_SUCH_KEY" };
    /* DEC-49 REGION is-signer-self-active */
    if (row.origin !== "self" || row.status !== "active") {
      const refused = CREDENTIALS_CHECKS.SIGNER_NOT_SELF_ACTIVE;
      return { ok: false, reason: "SIGNER_NOT_SELF_ACTIVE", code: "SIGNER_NOT_SELF_ACTIVE", check: refused.check,
               translation: refused.translation,
               detail: localize("credentials.index.only_a_key_a_member", "only a key a member registered for themselves and that is still active can be marked as known; this one was registered by an administrator or has been revoked. Nothing was written.") };
    }
    /* END DEC-49 REGION is-signer-self-active */
    if (typeof row.known_by === "string" && row.known_by !== "")
      return { ok: true, keyB64, already: true, known_by: row.known_by, known_at: row.known_at ?? null };
    const by = Credentials.#memberOf(viewer), at = this.#instant();
    this.sql.exec(`UPDATE signers SET known_by=?, known_at=? WHERE key_b64=? AND known_by IS NULL`, by, at, keyB64);
    return { ok: true, keyB64, already: false, known_by: by, known_at: at };
  }

  /* R10: a member revokes their own key, never refused for a key they hold, whatever its state or theirs (revoking
     narrows a claim, D-158). A key they do not hold answers NO_SUCH_KEY exactly as `signerSet` answers a key no one
     holds, so the answer never says whether a key is registered to somebody else. */
  signerRevokeOwn({ keyB64, by = null } = {}) {
    const row = typeof keyB64 === "string" && typeof by === "string" && by !== ""
      ? this.#one(`SELECT status FROM signers WHERE key_b64=? AND member_id=?`, keyB64, by) : null;
    if (!row) return { ok: false, reason: "NO_SUCH_KEY" };
    const already = row.status === "revoked";
    if (!already)   /* R21: a real change, so status_at moves; revoking twice leaves it */
      this.sql.exec(`UPDATE signers SET status='revoked', status_by=?, status_at=? WHERE key_b64=?`,
        by, this.#instant(), keyB64);
    return { ok: true, keyB64, status: "revoked", by, already };
  }

  /* R8 (D-158) — THE ROSTER SAYS WHICH STATE EACH KEY IS ACTUALLY IN. `status` is the administrator's own switch on
   * the key; `member_status` is the stored fact underneath (membership's, R68), and `attests` is whether `op=ratify`
   * would accept a signature from this key now, from the one predicate. A key whose member is gone is REPORTED, not
   * dropped, and `attests_why` names a stored fact in every branch; its last branch, `undetermined`, is unreachable
   * while the predicate is what it is, and kept so a derived reason never quietly guesses. */
  signerList() {
    const facts = new Map();
    const statusOf = (id) => {
      if (!facts.has(id)) facts.set(id, this.#memberFacts(id)?.status ?? null);
      return facts.get(id);
    };
    return { signers: this.#rows(
      `SELECT key_b64, member_id, comment, status, added, status_by, origin, registered_by, status_at, known_by, known_at
         FROM signers ORDER BY added, key_b64`).map((r) => {
        const memberStatus = statusOf(r.member_id);
        const attests = Credentials.#attests(r.status, memberStatus);
        return {
          key_b64: r.key_b64, member_id: r.member_id, comment: r.comment, status: r.status, added: r.added,
          status_by: Credentials.#statusBy(r.status_by),   /* REC-159 */
          /* R21: when the status last changed; null for a key registered before the column (not recorded). */
          status_at: typeof r.status_at === "string" && r.status_at !== "" ? r.status_at : null,
          /* R6 was the only door before R9, so a row with no recorded origin is an administrator's. */
          origin: r.origin === "self" ? "self" : "admin",
          registered_by: Credentials.#statusBy(r.registered_by),
          /* R83: the administrator who said they know about the key and when; null until one has */
          known_by: typeof r.known_by === "string" && r.known_by !== "" ? r.known_by : null,
          known_at: typeof r.known_at === "string" && r.known_at !== "" ? r.known_at : null,
          member_status: memberStatus,
          attests,
          attests_why: attests ? null
            : r.status !== "active" ? "key_revoked"
            : memberStatus === null ? "member_absent"
            : memberStatus !== "active" ? `member_${memberStatus}`
            : "undetermined",
        };
      }) };
  }

  /* R7: an administrator sets a key's status. Only ACTIVATION is barred as R6 bars the owning member, because
     membership's revocation revokes the member's keys (R16) and this would otherwise undo it one call later; revoking
     narrows a claim and is never refused. R21: `status_at` moves only when the status set differs from the key's. */
  signerSet({ keyB64, status, by = null } = {}) {
    const barCust = this.#custodialBar(by, "setting a signing key's status");
    if (barCust) return barCust;
    if (!["active", "revoked"].includes(status)) return { ok: false, reason: "BAD_STATUS" };
    const row = this.#one(`SELECT key_b64, member_id FROM signers WHERE key_b64=?`, keyB64);
    if (!row) return { ok: false, reason: "NO_SUCH_KEY" };
    if (status === "active") {
      const barSet = this.#signerMemberBar(row.member_id);
      if (barSet) return barSet;
    }
    this.sql.exec(
      `UPDATE signers SET status=?, status_by=?, status_at=CASE WHEN status<>? THEN ? ELSE status_at END
       WHERE key_b64=?`, status, by || null, status, this.#instant(), keyB64);
    return { ok: true, keyB64, status, by: Credentials.#statusBy(by) };
  }

  /* R11: the signer keys that attest, by R8's one predicate: the set the ratification gate accepts, for every reader
     that splices it (`signerList`, the gate's facts, a case's document facts). */
  attestingKeys() {
    const facts = new Map();
    const statusOf = (id) => {
      if (!facts.has(id)) facts.set(id, this.#memberFacts(id)?.status ?? null);
      return facts.get(id);
    };
    return this.#rows(`SELECT key_b64, member_id, status FROM signers ORDER BY added, key_b64`)
      .filter((r) => Credentials.#attests(r.status, statusOf(r.member_id)))
      .map((r) => ({ key_b64: r.key_b64, member_id: r.member_id }));
  }

  /* ===== AI CREDENTIALS (R12–R15) =====
   *
   * PL-11 / IS-5 / D-199 — THE `ai` CREDENTIAL, AND WHY ITS SCOPE IS A ROW. What an AI credential may reach must be
   * amendable only as an authored, dated, on-the-record act (D-199 (2), DEC-17's reasoning), so this class is not a
   * binding: a presented credential resolves against a row naming the member who minted it and when, and widening it
   * is another row with another name against it. THE VALUE NEVER ARRIVES HERE: the control plane generates the secret,
   * hashes it, hands this module the HASH, and returns the value to the minting member once. */

  /* R12–R14: a MEMBER act (D-199 (3)), and the record says who, when, for whom and what for (D-199 (4)). `writes` and
     `confinedTo` arrive already judged at the mint edge (the control plane's ops table and namespaces are the only
     things that know); what this method judges is what the RECORD must say. */
  aiCredentialMint({ who = null, tokenId = null, secretSha = null, principalKind = null,
                     principalMember = null, taskScope = null, writes = [], note = null,
                     confinedTo = null, at = null, expiresInDays = null } = {}) {
    const refusal = (code, detail, extra) => {
      const row = AI_CREDENTIAL_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check,
               translation: row.translation, detail, ...(extra || {}) };
    };
    const now = at || stampSecond(this.#nowMs());
    const id = String(tokenId ?? "").trim();
    const kind = String(principalKind ?? "").trim().toLowerCase();

    /* DEC-49 REGION is-ai-credential-mint
     *
     * D-199 (3) FIRST, before any shape question: a caller who may not mint at all is told that, rather than being
     * walked through the shape of a credential they were never going to get. Every code is a string literal at its
     * site. */
    if (!who || isMachineIdentity(who))
      return refusal("AI_CREDENTIAL_MINT_NOT_A_MEMBER",
        who ? localize("credentials.index.string_is_a_machine_identity", "'{String}' is a machine identity, and minting an AI credential is a MEMBER act, never an AI act (D-199 (3)): if an agent can request a broader token, the scoping is theatre. This is REC-46's ONE predicate, so it catches token:ai without knowing that class exists.", { String: String(String(who).slice(0, 60)) })
            : localize("credentials.index.no_member_is_named", "no member is named on this act. An authority granted by nobody is an authority nobody can be asked about afterwards."),
        { who: who || null });

    /* R14 (C-29.11): a member-scoped credential acts for the member who minted it, and for nobody else. */
    const minter = String(who).trim();
    if (kind === "member" && principalMember !== null && principalMember !== undefined
        && String(principalMember).trim() !== "" && String(principalMember).trim() !== minter)
      return refusal("AI_CREDENTIAL_PRINCIPAL_NOT_THE_MINTER",
        localize("credentials.index.a_member_scoped_credential", "a member-scoped credential acts for the member who mints it, and '{principalMember}' is not '{minter}'. A member cannot authorise an agent in another member's name. Nothing was written.", { principalMember: String(principalMember).slice(0, 60), minter: minter.slice(0, 60) }), { principalMember: String(principalMember).slice(0, 60) });
    /* R13 (Bob, 2026-09-26): an ORGANISATION-scoped credential acts for the whole group, so only an active
       administrator (the founder included; membership R64) mints one; anyone else is answered through membership's
       R84, its remedy the member-scoped credential open to every member (DEC-83). */
    if (kind === "organisation" && !this.membership.isAdministrator(minter))
      return notAnAdmin(minter, "minting an organisation-wide AI credential",
        { remedy: word("credentials.member_scoped_credential") });
    const principal = kind === "organisation" ? `${MACHINE_CLASS_PREFIX}ai`
                    : kind === "member" ? `member:${minter}`
                    : null;
    if (!principal || principal === "member:")
      return refusal("AI_CREDENTIAL_PRINCIPAL_UNSTATED",
        localize("credentials.index.principalkind_was", "principalKind was '{kind}'. It is 'organisation' (the key acts for the team, nobody individual behind it) or 'member' (attributable to that member). They carry different accountability and the record states which, never the token's value.", { kind: kind.slice(0, 40) || "(none)" }),
        { principalKind: kind || null });

    if (!id || this.#one(`SELECT token_id FROM ai_credentials WHERE token_id=?`, id))
      return refusal("AI_CREDENTIAL_IDENTITY_TAKEN",
        id ? localize("credentials.index.id_already_names_a_credential", "'{id}' already names a credential in your team's Civicsmith. Acts cite the IDENTITY, so rebinding it would re-attribute work already done.", { id: String(id.slice(0, 60)) })
           : localize("credentials.index.pass_an_identity", "pass an identity for this credential: it is the name acts will cite, and a credential nothing can name is one nothing can revoke either."),
        { tokenId: id || null });
    /* END DEC-49 REGION is-ai-credential-mint */

    /* R42 (F15; K1881): a whole number of days from 1 to 365, 90 when not given; anything else refused, writing
       nothing. The credential expires that many whole days after it was minted. */
    const days = expiresInDays === null || expiresInDays === undefined ? AI_CREDENTIAL_EXPIRY_DAYS.default : expiresInDays;
    /* DEC-49 REGION is-ai-credential-expiry */
    if (!Number.isInteger(days) || days < AI_CREDENTIAL_EXPIRY_DAYS.min || days > AI_CREDENTIAL_EXPIRY_DAYS.max)
      return refusal("AI_CREDENTIAL_BAD_EXPIRY",
        localize("credentials.index.expiresindays_is_a", "expiresInDays is a whole number of days from {min} to {max}, {default} when it is left out, and this was not one. Nothing was written.", { min: String(AI_CREDENTIAL_EXPIRY_DAYS.min), max: String(AI_CREDENTIAL_EXPIRY_DAYS.max), default: String(AI_CREDENTIAL_EXPIRY_DAYS.default) }),
        { expiresInDays: typeof expiresInDays === "number" ? expiresInDays : null });
    /* END DEC-49 REGION is-ai-credential-expiry */
    /* R53 (N761; K2129): the digest the control plane hands in the body, 64 lowercase hexadecimal characters, or no
       credential: one recorded without it could never be found by a lookup (R15), so it is refused, writing nothing. */
    /* DEC-49 REGION is-ai-credential-digest */
    if (typeof secretSha !== "string" || !/^[0-9a-f]{64}$/.test(secretSha))
      return refusal("AI_CREDENTIAL_NO_SECRET",
        localize("credentials.index.no_digest_of_the", "no digest of the credential's secret was handed in (64 lowercase hexadecimal characters, made from the value generated when the credential was asked for), so there is nothing a lookup could ever find this credential by. Nothing was written."));
    /* END DEC-49 REGION is-ai-credential-digest */
    const base = Date.parse(now);
    const expiresAt = stampSecond((Number.isFinite(base) ? base : this.#nowMs()) + days * DAY_MS);

    const declared = (Array.isArray(writes) ? writes : []).map((w) => String(w)).sort();
    /* D-463: it stores 'scratch' or it stores NULL, and nothing between. */
    const confinement = confinedTo === null || confinedTo === undefined ? null : String(confinedTo);
    this.sql.exec(
      `INSERT INTO ai_credentials (token_id, secret_sha, principal_kind, principal, task_scope,
         scope_writes, scope_note, minted_by, minted_at, confined_to, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, secretSha, kind, principal, String(taskScope ?? "investigative"),
      JSON.stringify(declared), String(note ?? ""), String(who), now, confinement, expiresAt);
    return { ok: true, minted: true, credential: this.#aiCredentialPublic(
      this.#one(`SELECT * FROM ai_credentials WHERE token_id=?`, id)) };
  }

  /* R15: also a member act, and the reason is `revoked_by` rather than the risk (C-29.4). Revoking twice answers
     `already: true`, and the row is kept with its `revokedAt`. */
  aiCredentialRevoke({ who = null, tokenId = null, at = null } = {}) {
    const refusal = (code, detail, extra) => {
      const row = AI_CREDENTIAL_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check,
               translation: row.translation, detail, ...(extra || {}) };
    };
    const now = at || stampSecond(this.#nowMs());
    const id = String(tokenId ?? "").trim();

    /* DEC-49 REGION is-ai-credential-revoke */
    if (!who || isMachineIdentity(who))
      return refusal("AI_CREDENTIAL_REVOKE_NOT_A_MEMBER",
        who ? localize("credentials.index.string_is_a_machine_identity_2", "'{String}' is a machine identity. The row carries revoked_by, and a machine name there would record the team withdrawing an authority nobody in the team decided to withdraw.", { String: String(String(who).slice(0, 60)) })
            : localize("credentials.index.no_member_is_named_2", "no member is named on this act, and a withdrawal nobody authored is not one."),
        { who: who || null });

    const row = id ? this.#one(`SELECT * FROM ai_credentials WHERE token_id=?`, id) : null;
    if (!row)
      return refusal("AI_CREDENTIAL_UNKNOWN",
        localize("credentials.index.no_credential_in_your_teams", "no credential in your team's Civicsmith is called '{v1}'. Nothing was withdrawn, and being told so is the point: believing an authority is gone when it is not is the worse of the two outcomes.", { v1: String(id.slice(0, 60) || "(none)") }),
        { tokenId: id || null });
    /* END DEC-49 REGION is-ai-credential-revoke */

    if (row.revoked_at)
      return { ok: true, revoked: true, already: true,
               credential: this.#aiCredentialPublic(row) };
    this.sql.exec(`UPDATE ai_credentials SET revoked_at=?, revoked_by=? WHERE token_id=?`,
                  now, String(who), id);
    return { ok: true, revoked: true, already: false,
             credential: this.#aiCredentialPublic(
               this.#one(`SELECT * FROM ai_credentials WHERE token_id=?`, id)) };
  }

  /* R15: resolve a PRESENTED credential to its record row, by the SHA of the value and never the value. A REVOKED ROW
     IS RETURNED rather than hidden, the fail-closed direction here: the gate must tell a withdrawn credential from an
     unknown string. R42: so is an EXPIRED one, `expired: true`, for the gate to refuse as it refuses a revoked one. */
  aiCredentialLook({ secretSha = null } = {}) {
    const sha = String(secretSha ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) return { found: false, credential: null };
    const row = this.#one(`SELECT * FROM ai_credentials WHERE secret_sha=?`, sha);
    if (!row) return { found: false, credential: null };
    /* R79 (T50; N1186): a credential minted in a project makes membership R149's viewer for it, so everything read under it
       is narrowed to that project; one that cannot be made is not found, the gate refusing it as unknown (fail closed) */
    const principal = Credentials.#viewerOf(row.principal, row.project);
    if (principal === null) return { found: false, credential: null };
    return { found: true, credential: {
      ...this.#aiCredentialPublic(row),
      /* The gate needs these two as values: the viewer it stamps, and the ops the record declared. */
      principal, writes: this.#aiCredentialWrites(row),
      /* R79: the project it was minted in, null for one minted with none; the gate reads it beside `run` */
      project: row.project || null } };
  }

  /* R15: what the group can see about its own agents, never a value and never a hash (the hash is a verifier, and
     publishing it would make every read of this list an offline guessing target). BOUNDED, AND IT SAYS SO
     (REC-57 / D-225): `limit` is the cap applied (default 200, at most 500), and `truncated` is measured by reading
     one row past it. */
  aiCredentials({ limit = null } = {}) {
    const asked = Number(limit);
    const cap = Number.isFinite(asked) && asked > 0 ? Math.min(500, Math.floor(asked)) : 200;
    const found = this.#rows(
      `SELECT * FROM ai_credentials ORDER BY minted_at, token_id LIMIT ?`, cap + 1);
    const rows = found.slice(0, cap);
    return { count: rows.length, limit: cap, truncated: found.length > cap,
             credentials: rows.map((r) => this.#aiCredentialPublic(r)) };
  }

  #aiCredentialWrites(row) {
    try { const w = JSON.parse(row.scope_writes || "[]"); return Array.isArray(w) ? w.map(String) : []; }
    catch { return []; }
  }

  /* ONE projection, used by the mint, the revoke, the list and the gate's lookup, so no surface is shown a shape the
     others do not agree with, and ONE place decides `secret_sha` is not in it. `confinedTo` is stated as a value, null
     for "not confined", rather than left off: it is the one property a member must read back to know whether an agent
     can touch the record at all (D-463). */
  #aiCredentialPublic(row) {
    if (!row) return null;
    return { tokenId: row.token_id, principalKind: row.principal_kind, principal: row.principal,
             taskScope: row.task_scope, writes: this.#aiCredentialWrites(row),
             note: row.scope_note || null, mintedBy: row.minted_by, mintedAt: row.minted_at,
             revokedAt: row.revoked_at || null, revokedBy: row.revoked_by || null,
             revoked: !!row.revoked_at,
             confinedTo: row.confined_to || null,
             /* R42: when it expires, and whether it has, from `expiresAt` on; never renewed. */
             expiresAt: row.expires_at || null,
             expired: typeof row.expires_at === "string" && row.expires_at !== "" && this.#nowMs() >= Date.parse(row.expires_at),
             /* R63: the run a segment's credential is bound to, null for every credential R12 mints */
             run: row.run || null };
  }

  /* ===== A RUN SEGMENT'S CREDENTIAL (R63; T47, N955; K2976, K2999, K3027, K3033) =====
   *
   * The `ai` credential one segment of a member's own run is dispatched under, minted HERE, in the plane, at her act
   * (`ai-runs`' dispatch), so no credential is ever minted by or held in her page. In-plane only: no route reaches it
   * and no viewer is answered. Member-scoped (its principal the member, R14), recorded as R12 records one (`minted_by`
   * the member, only its token's SHA-256 kept), with the run on its row; its writes a non-empty list of AI_RUN_WRITES;
   * it expires AI_RUN_CREDENTIAL_TTL_SECONDS after minting, never renewed. At most one is live per run: a new mint
   * revokes every earlier one of the same run, and the run's end (`aiRunCredentialsEnd`), the member's revocation (R16)
   * and an account of hers cleared (`ai-accounts` R26, told through R73) revoke them, changing nothing else. The
   * token has the shape the gate reads (`aik-` and 64 hexadecimal characters, admission's AI_TOKEN_SHAPE) and is
   * answered once, never logged or stored. */
  /* (T50; R79, N1186) It takes `project?`, the project the run was opened in: kept on the row, and the viewer
     `aiCredentialLook` answers for it is membership R149's `projectViewer` of the member's own. */
  aiRunCredentialMint({ member = null, run = null, writes = null, project = null, account_id = null } = {}) {
    const id = Credentials.#memberOf(member);
    /* R78 (T49; K3392, K3398; amends R63, as R76 amends R27): the founder holds no member row; the member who resolves to
       her (`#isFounder`, R76's one test) is admitted as an active member, for her own run only. */
    if (id === null || isMachineIdentity(member) || isMachineIdentity(id)
        || (id === ROOT ? !this.#isFounder(ROOT) : this.#memberFacts(id)?.status !== "active"))
      return this.accounts.accountMemberNotActive(localize("credentials.index.a_runs_credential_is", "a run's credential is minted only for an active member's own run. Nothing was minted."), { member: id });
    const malformed = Credentials.#runCredentialFault(run, writes, project, account_id);
    if (malformed) return malformed;
    /* R79 (T50; N1186): a project the run was opened in, one the member sees and has joined, asked after R63's shape and
       before the keep-away; none present leaves the credential as it was */
    const named = project !== null && project !== undefined;
    if (named) {
      const unfit = this.#runProjectBar(project, id);
      if (unfit) return unfit;
    }
    /* `ai-accounts` R7 (K231): the one keep-away read, asked with no use or project (`aiKeptAway()`), as R27 is refused */
    const away = this.accounts.aiKeptAway();
    if (away) return away;
    const token = `aik-${Credentials.#rand(32)}`;
    const tokenId = `run-${Credentials.#rand(12)}`;
    const nowMs = this.#nowMs();
    const now = stampSecond(nowMs);
    const expiresAt = stampSecond(nowMs + AI_RUN_CREDENTIAL_TTL_SECONDS * 1000);
    const declared = AI_RUN_WRITES.filter((w) => writes.includes(w));
    this.#tx(() => {
      this.#revokeRunCredentials(`run=?`, [run], now, id);   /* the next segment: every earlier one of this run */
      this.sql.exec(
        `INSERT INTO ai_credentials (token_id, secret_sha, principal_kind, principal, task_scope, scope_writes, scope_note,
           minted_by, minted_at, confined_to, expires_at, run, project, account_id)
         VALUES (?, ?, 'member', ?, 'run', ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        tokenId, sha256HexSync(token), `member:${id}`, JSON.stringify(declared),
        localize("credentials.index.minted_by_your_teams_civicsmith", "minted by your team's Civicsmith for one segment of your run"), id, now, expiresAt, run, named ? project : null, typeof account_id === "string" ? account_id : null);
    });
    return { ok: true, tokenId, token, run, writes: declared, expiresAt };
  }

  /* R63, R79: AI_RUN_CREDENTIAL_MALFORMED, minted here alone, naming what: `run` a non-empty string, `writes` a non-empty
     list of AI_RUN_WRITES entries, `project` (present) a non-empty string. */
  static #runCredentialFault(run, writes, project = null, accountId = null) {
    const what = typeof run !== "string" || run.trim() === "" ? "run"
      : !Array.isArray(writes) || !writes.length || !writes.every((w) => typeof w === "string" && AI_RUN_WRITES.includes(w))
        ? "writes"
      : project !== null && project !== undefined && (typeof project !== "string" || project.trim() === "") ? "project"
      : accountId !== null && accountId !== undefined && (typeof accountId !== "string" || accountId.trim() === "") ? "account_id"
      : null;
    if (what === null) return null;
    /* DEC-49 REGION is-ai-run-credential-shape */
    return Credentials.#row(AI_CREDENTIAL_CHECKS, "AI_RUN_CREDENTIAL_MALFORMED", what === "run"
      ? localize("credentials.index.a_runs_credential_names", "a run's credential names the run it is bound to, a non-empty string, and none was given. Nothing was minted.")
      : what === "project"
        ? localize("credentials.index.a_runs_credential_names_the", "a run's credential names the project the run was opened in as a non-empty string, or names none, and this was neither. Nothing was minted.")
      : what === "account_id"
        ? localize("credentials.index.a_runs_credential_names_account", "a run's credential names the account that serves the segment as a non-empty string, or names none, and this was neither. Nothing was minted.")
      : localize("credentials.index.a_runs_credential_holds", "a run's credential holds a non-empty list of the runner's writes, each one of {writes}, and this was not one. Nothing was minted.", { writes: AI_RUN_WRITES.join(", ") }), { what });
    /* END DEC-49 REGION is-ai-run-credential-shape */
  }

  /* R79 (T50; N1186): the project a run is opened in is one its member sees and has joined, as `ai-accounts` R11 asks it of
     an ask (the same two reads of membership, R44 and R54): a project they cannot see is answered as absent
     (`noSuchProject`, or the existence act membership R85 gives an administrator at a hidden project), one they see and
     have not joined PROJECT_ACT_NOT_A_PARTICIPANT. Null when the run may be minted. Any read that fails is absent. */
  #runProjectBar(project, id) {
    const viewer = `member:${id}`;
    try {
      const s = this.membership.sight(project, viewer);
      if (s === Membership.SIGHT_FULL)
        return this.membership.projectAuthority(project, viewer, "joined",
          localize("credentials.index.a_run_in_a_project", "a run in a project"));
      const absent = noSuchProject(project);
      return s === Membership.SIGHT_EXISTENCE ? (this.membership.existenceAct(project, viewer) ?? absent) : absent;
    } catch { return noSuchProject(project); }
  }

  /* R79: the viewer a member's act carries, `member:<id>` with no project, else membership R149's `projectViewer` of it,
     the member's own sight narrowed to that project's records. Null when that service cannot be asked, so a grant or a
     credential is then refused rather than widened (fail closed). */
  static #viewerOf(principal, project) {
    if (typeof project !== "string" || project === "") return principal;
    try {
      const v = projectViewer(principal, project);
      return v === undefined || v === null ? null : v;
    } catch { return null; }
  }

  /* R63: the live run credentials `where` names revoked at `at`, `by` recorded (null when no one's act ends them);
     every other credential, and everything else, unchanged. Answers how many. Inside the caller's act. */
  #revokeRunCredentials(where, args, at, by = null) {
    const live = this.#rows(`SELECT token_id FROM ai_credentials WHERE run IS NOT NULL AND revoked_at IS NULL AND ${where}`,
      ...args);
    for (const r of live)
      this.sql.exec(`UPDATE ai_credentials SET revoked_at=?, revoked_by=? WHERE token_id=?`, at, by, r.token_id);
    return live.length;
  }

  /* R63: the run's end, the in-plane call `ai-runs` makes when the run leaves `running` (its R14): every credential of
     `run` revoked. Answers `{ok: true, revoked}`; never throws (a store that cannot be written answers `ok: false`). */
  aiRunCredentialsEnd({ run = null } = {}) {
    if (typeof run !== "string" || run.trim() === "") return { ok: true, revoked: 0 };
    try {
      return { ok: true, revoked: this.#tx(() => this.#revokeRunCredentials(`run=?`, [run], stampSecond(this.#nowMs()))) };
    } catch { return { ok: false, revoked: 0, unreadable: true }; }
  }

  /* ===== THE SPLIT WITH `ai-accounts` (R73; T48, N996; K3101) =====
   *
   * Which AI account pays for an assistant's act is `ai-accounts`' (each member's own reference and sign-in, the
   * group's key, a project's account, the switches for each kind of use, the material limits, the notices and the
   * disclosure, each account's history; its R1–R23), split by copy from here (K617, K624). This module creates it in
   * its factory with the seal secret (its R32), and asks it, never a copy: the grants' bar, cascade and notices (R27,
   * R32) and the run credential's refusals (R63) through its R25 reads, the keep-away through its R7's `aiKeptAway`,
   * the keyed services' seal through its R24 (R29), and the end of a standing grant or a run credential when an
   * account is cleared through its R26's notice (R73, `start`). */

  /* The member an actor or viewer names: `member:<id>` or a bare member id; null for anything else. */
  static #memberOf(x) {
    if (typeof x !== "string") return null;
    const id = x.startsWith("member:") ? x.slice(7) : x;
    return id !== "" ? id : null;
  }

  static #row(table, code, detail, extra) {
    const r = table[code];
    return { ok: false, reason: code, code, check: r.check, translation: r.translation, detail, ...(extra || {}) };
  }

  /* R73 (T53; K3218, K5457; `ai-accounts` R26): `ai-accounts`' notice that an account was cleared, refused, revoked or
     found to resolve to nothing, told inside the clearing act: `{account_id, owner, member, means, by, why,
     other_account_serves}`, `member` the owner of a member's account and null for a project's or the team's, `why` one of
     ACCOUNT_CLEARED_WHY. Whatever the means, the run credentials of the runs the account served (those carrying its
     `account_id`, R63) are revoked, and for a member-owned account every run credential of that member; her standing grants
     (R32) end unless another account of hers still serves (`other_account_serves`; `reference_held` is the same fact as the
     earlier notice spelled it). Anything else changes nothing. */
  #accountCleared({ account_id = null, member = null, by = null, why = null, other_account_serves = undefined,
                    reference_held = undefined } = {}) {
    if (!ACCOUNT_CLEARED_WHY.includes(why)) return;
    const at = stampSecond(this.#nowMs());
    const actor = Credentials.#memberOf(by);
    if (typeof account_id === "string" && account_id !== "") this.#revokeRunCredentials(`account_id=?`, [account_id], at, actor);
    const id = Credentials.#memberOf(member);
    if (id === null) return;
    this.#revokeRunCredentials(`principal=?`, [`member:${id}`], at, actor);
    if ((other_account_serves ?? reference_held) !== true) this.sql.exec(`DELETE FROM ai_grants WHERE member_id=? AND kind='standing'`, id);
  }

  /* ===== THE ASK GRANT (R27, R28, R31, R32; Q1-3, K1450, K1505 (14), K1609, K1685) =====
   *
   * A short-lived, read-only `ai` grant whose viewer is the member, minted at their own act under their own live
   * session (R27), or for a standing question's AI half by `answers` alone (R32). Only its token's SHA-256 is kept; it
   * writes no run row and no observation row and keeps no read log (K1450). An ask's grant ends at
   * `AI_GRANT_TTL_SECONDS`, or with the session it was minted under, whichever is first; a standing question's at its
   * time; each at once when its member is revoked (R16), and a standing one when the account that serves it is cleared
   * and no other account of theirs serves (`ai-accounts` R26, told through R73). */
  static async #sha256(text) {
    const d = await crypto.subtle.digest("SHA-256", Credentials.#enc.encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async #mintGrant(id, session, expires, kind, project = null) {
    const token = Credentials.#rand(32);
    this.sql.exec(`DELETE FROM ai_grants WHERE expires < ?`, this.#nowMs());
    this.sql.exec(`INSERT INTO ai_grants (grant_sha, member_id, session, expires, kind, project) VALUES (?,?,?,?,?,?)`,
      await Credentials.#sha256(token), id, session, expires, kind, project);
    return { ok: true, token, expires };
  }

  /* R27: at the member's own act under their own live session; refused NO_ACCOUNT when no account serves them (no account
     of their own, none of the project's and none of the team's that serves their act: `ai-accounts` R11; T38, K2275),
     and RECIPIENT_NOTICE_DUE when the account that would serve them sends to a recipient whose notice they have not read
     (`ai-accounts` R51; K5457). A member served by an account, its notice read, is granted. (T40) It takes `project?`, a
     project the member has joined, and asks the cascade (`ai-accounts` R11) for `{kind: "ask", member, project}`: its
     refusals are this mint's, as it answers them (AI_USE_SWITCHED_OFF, ...). (T48; K3101) The bar, the cascade and
     NOT_YOUR_ACCOUNT are `ai-accounts`' R25 reads, the keep-away its R7's. */
  async aiGrantMint({ member = null, by = null, session = null, project = null } = {}) {
    const bar = this.accounts.accountActBar({ member, by });
    if (bar) return bar;
    const away = this.accounts.aiKeptAway({ use: "ask" });   /* R27 mints only for a member an account serves: none while kept away (DEC-172) */
    if (away) return away;
    const id = Credentials.#memberOf(member);
    const s = this.#liveSession(session, { locked: true });
    if (!s || !this.#ownSession(s.role, id))
      return this.accounts.notYourAccount(localize("credentials.index.an_asks_grant_is", "an ask's grant is minted only under the member's own live session. Nothing was minted."));
    if (s.state === "locked") return Credentials.sessionLockedRefusal();   /* R65 */
    const sessionSha = s.token_sha;
    const served = this.accounts.accountServing({ member: id, use: "ask", project: project === undefined ? null : project });
    if (served.refusal) return served.refusal;
    /* R79 (T50; N1186): the project, which the cascade above has just found the member sees and has joined, is kept on the
       grant's row and fences the viewer it makes (`#liveGrant`); with none the grant is as it was */
    const named = typeof project === "string" && project !== "" ? project : null;
    if (named !== null && Credentials.#viewerOf(`member:${id}`, named) === null)
      return noSuchProject(named);   /* membership R149 cannot be asked: nothing is minted rather than a wider grant */
    return this.#mintGrant(id, sessionSha, Math.min(this.#nowMs() + AI_GRANT_TTL_SECONDS * 1000, s.expires), "ask", named);
  }

  /* R32: a standing question's grant, for `answers` R19 only (not routed): shaped as R27's, minted with no session.
     (T41; N796, Bob K2425; T53, K5457) The member's serving account (`ai-accounts` R25's `servingAccountOf`) is asked its
     `standing` switch (`ai-accounts` R14), off by default and set only by the owner's own act. (T48; K3101) The serving
     account and the two account rows are `ai-accounts`' R25 reads, the keep-away its R7's; this module's own rows are
     STANDING_SWITCH_OFF and NO_QUESTION. */
  async aiGrantMintStanding({ member = null, question = null } = {}) {
    const id = Credentials.#memberOf(member);
    const refuse = (code, detail) => Credentials.#row(ACCOUNT_CHECKS, code, detail, { member: id });
    if (id === null || isMachineIdentity(member) || this.#memberFacts(id)?.status !== "active")
      return this.accounts.accountMemberNotActive(localize("credentials.index.a_standing_question_runs", "a standing question runs only for an active member. Nothing was minted."), { member: id });
    const away = this.accounts.aiKeptAway({ use: "standing" });   /* R32 mints only for a member an account serves: none while kept away (DEC-172) */
    if (away) return away;
    const serving = this.accounts.servingAccountOf({ member: id });
    if (!serving) return this.accounts.noAccount(id);
    /* DEC-49 REGION is-standing-grant */
    if (!serving.standing)
      return refuse("STANDING_SWITCH_OFF", localize("credentials.index.standing_questions_are_off", "standing questions are off for the {who}, which would serve this one. Nothing was minted.", { who: serving.level === "group"
        ? "team's account" : serving.level === "project" ? "project's account" : "member's own account" }));
    if (typeof question !== "string" || question.trim() === "")
      return refuse("NO_QUESTION", localize("credentials.index.no_standing_question_was", "no standing question was named. Nothing was minted."));
    /* END DEC-49 REGION is-standing-grant */
    return this.#mintGrant(id, "", this.#nowMs() + AI_GRANT_TTL_SECONDS * 1000, "standing");
  }

  /* R76 (T49; D2, K3320; amends R27): whether the live session of role `role` is `id`'s own: a member's session is
     `member:<id>`, and the founder's (the session whose role `membership.sessionRights` answers as the founder, its
     R144: `rootOfTrust` and the founder's id) is her own for her own grant, exactly as a member's is for hers. A
     session of any other role is not. */
  #ownSession(role, id) {
    if (typeof id !== "string" || id === "" || typeof role !== "string") return false;
    if (id !== ROOT) return role === `member:${id}`;
    return role === ROOT && this.#isFounder(role);
  }

  /* R76, R78: whether the role `role` is the founder's, by membership's one answer (`sessionRights`, its R144):
     the root of trust, and her id. */
  #isFounder(role) {
    const r = this.membership.sessionRights(role) || {};
    return r.rootOfTrust === true && r.member === ROOT;
  }

  /* R28, R31: the live grant a token names, or null: unexpired and, for an ask's, its session live and the member's;
     a standing question's needs no session (R32). Writes nothing. */
  async #liveGrant(token) {
    const g = typeof token === "string" && token !== ""
      ? this.#one(`SELECT member_id, session, expires, kind, project FROM ai_grants WHERE grant_sha=?`, await Credentials.#sha256(token))
      : null;
    const now = this.#nowMs();
    if (!g || g.expires < now) return null;
    if (g.kind === "standing") return { ...g, viewer: `member:${g.member_id}` };
    const s = this.#one(`SELECT role, expires, created, device, last_active FROM sessions WHERE token_sha=?`, g.session);   /* R40: the digest */
    /* R65: its session live and not locked */
    if (!(s && Credentials.#stateOf(s, now) === "live" && this.#ownSession(s.role, g.member_id))) return null;
    /* R79: the viewer the grant makes, narrowed to its project when it has one; none can be made, no grant is held */
    const viewer = Credentials.#viewerOf(`member:${g.member_id}`, g.project);
    return viewer === null ? null : { ...g, viewer };
  }

  static #grantNotHeld() {
    /* DEC-49 REGION is-grant-held */
    return Credentials.#row(ACCOUNT_CHECKS, "GRANT_NOT_HELD", localize("credentials.index.no_live_grant_answers", "no live grant answers to this token: it expired, its session ended, or it never existed. Nothing was read."));
    /* END DEC-49 REGION is-grant-held */
  }

  static #held(g) { return { ok: true, member: g.member_id, viewer: g.viewer, expires: g.expires }; }

  /* R28: a request under a grant is admitted only for an op on `AI_GRANT_OPS`, only as a read, while the grant lives.
     Answers `{ok, member, viewer, expires}`; writes nothing. */
  async aiGrantAdmit({ token = null, op = null, write = false } = {}) {
    const g = await this.#liveGrant(token);
    if (!g) return Credentials.#grantNotHeld();
    /* DEC-49 REGION is-grant-op */
    if (write !== false || typeof op !== "string" || !AI_GRANT_OPS.includes(op))
      return Credentials.#row(ACCOUNT_CHECKS, "GRANT_OP_REFUSED", localize("credentials.index.an_asks_grant_admits", "an ask's grant admits only the reads on its list, and '{op}'{write} is not one. Nothing was read.", { op: String(op ?? "").slice(0, 40), write: write !== false ? " as a write" : "" }),
        { op: typeof op === "string" ? op.slice(0, 40) : null });
    /* END DEC-49 REGION is-grant-op */
    return Credentials.#held(g);
  }

  /* R31 (N616, K1685): whether `token` is a live grant, asking about no op: exactly when R28 would admit a listed read
     under it. Writes nothing, keeps no read log and never throws. */
  async aiGrantHeld({ token = null } = {}) {
    try {
      const g = await this.#liveGrant(token);
      return g ? Credentials.#held(g) : Credentials.#grantNotHeld();
    } catch { return Credentials.#grantNotHeld(); }
  }

  /* ===== THE SECURITY TALLY (R44; F9, N703; DEC-165, DEC-166; K1874, K1875, K1882) =====
   *
   * COUNTS ONLY: a kind, an hour and a country, and how many. No address reaches this module, and it keeps and derives
   * none; no fingerprint, handle, role, op, path, time within the hour or content is held with a count. `country` is
   * Cloudflare's two-letter label as the caller read it, or null. Counts older than 90 days are dropped. A count that
   * cannot be written is dropped and never changes the answer of the act that refused.
   *
   * DEC-166's PLACE RULE, for the counts this module writes for a sign-in, claim or recovery (`signin`, and R38's
   * `rate`): the count is held at once WITHOUT a place, and its country waits in `security_pending`, beside a keyed
   * digest of the role and nothing else that names it, until an hour has passed with no successful sign-in or recovery
   * under that role; then it is placed and the waiting row dropped. A success within the hour drops the role's waiting
   * rows, so those counts are never placed, and a member's own refused attempt before their own sign-in is never
   * given a country. `through` is never placed. A successful sign-in is never counted. */

  /* Cloudflare's label: two letters or digits, upper-cased; anything else is no country. */
  static #country(c) {
    return typeof c === "string" && /^[A-Za-z0-9]{2}$/.test(c.trim()) ? c.trim().toUpperCase() : null;
  }

  #bump(kind, hour, country) {
    this.sql.exec(`INSERT INTO security_counts (kind, hour, country, count) VALUES (?,?,?,1)
                   ON CONFLICT(kind, hour, country) DO UPDATE SET count=count+1`, kind, hour, country ?? "");
  }

  /* The waiting places an hour old are placed and dropped, and counts older than the days kept are dropped. */
  #settle(now = this.#nowMs()) {
    for (const p of this.#rows(`SELECT seq, kind, hour, country FROM security_pending WHERE at <= ?`, now - HOUR_MS)) {
      if (p.country && this.#one(`SELECT count FROM security_counts WHERE kind=? AND hour=? AND country='' AND count > 0`,
                                  p.kind, p.hour)) {
        this.sql.exec(`UPDATE security_counts SET count=count-1 WHERE kind=? AND hour=? AND country=''`, p.kind, p.hour);
        this.#bump(p.kind, p.hour, p.country);
      }
      this.sql.exec(`DELETE FROM security_pending WHERE seq=?`, p.seq);
    }
    this.sql.exec(`DELETE FROM security_counts WHERE count <= 0 OR hour < ?`,
      Math.floor(now / HOUR_MS) - SECURITY_DAYS * 24);
  }

  /* `session` (R5) is asked at every request, so a waiting place an hour old is dropped promptly; it writes only when
     one is due. */
  #settleSoon() {
    try {
      const now = this.#nowMs();
      if (this.#one(`SELECT seq FROM security_pending WHERE at <= ? LIMIT 1`, now - HOUR_MS)) this.#tx(() => this.#settle(now));
    } catch { /* dropped */ }
  }

  /* R44: a count this module writes for a sign-in, claim or recovery, under DEC-166's place rule. */
  #tallyOwn(kind, country, roleKey) {
    try {
      this.#tx(() => {
        const now = this.#nowMs();
        this.#settle(now);
        const hour = Math.floor(now / HOUR_MS);
        this.#bump(kind, hour, "");
        this.sql.exec(`INSERT INTO security_pending (kind, hour, country, role, at) VALUES (?,?,?,?,?)`, kind, hour,
          Credentials.#country(country), roleKey, now);
      });
    } catch { /* dropped */ }
  }

  /* R44: an in-plane write reached by no route, for `admission` and `capture` (and this module's own kinds): one count
     of `kind` for the current UTC hour and `country`, placed at once. */
  securityCount({ kind = null, country = null } = {}) {
    /* DEC-49 REGION is-security-kind */
    if (!SECURITY_KINDS.includes(kind)) {
      const row = SIGN_IN_CHECKS.SECURITY_KIND_UNKNOWN;
      return { ok: false, reason: "SECURITY_KIND_UNKNOWN", code: "SECURITY_KIND_UNKNOWN", check: row.check,
               translation: row.translation, kind: typeof kind === "string" ? kind.slice(0, 40) : null,
               detail: localize("credentials.index.the_kinds_counted_are", "the kinds counted are {kinds}. Nothing was counted.", { kinds: SECURITY_KINDS.join(", ") }) };
    }
    /* END DEC-49 REGION is-security-kind */
    try {
      this.#tx(() => {
        const now = this.#nowMs();
        this.#settle(now);
        this.#bump(kind, Math.floor(now / HOUR_MS), Credentials.#country(country));
      });
      return { ok: true, kind, counted: true };
    } catch { return { ok: true, kind, counted: false }; }
  }

  /* ===== THE SECURITY MAP AND THE LEVEL (R45; DEC-165, DEC-166; K1881, K1934 (2), (3)) ===== */

  static #iso(ms) { return stampSecond(ms); }

  static #instantOf(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (typeof v === "string" && v.trim() !== "") return /^\d+$/.test(v.trim()) ? Number(v.trim()) : Date.parse(v);
    return NaN;
  }

  /* R45: the period asked, or what is wrong with it. */
  static #periodFault(fromMs, toMs, now) {
    if (!Number.isFinite(fromMs)) return localize("credentials.index.from_is_not_an", "from is not an instant");
    if (!Number.isFinite(toMs)) return localize("credentials.index.to_is_not_an", "to is not an instant");
    if (fromMs >= toMs) return localize("credentials.index.from_is_not_before", "from is not before to");
    if (toMs - fromMs > SECURITY_DAYS * DAY_MS)
      return localize("credentials.index.the_period_is_longer", "the period is longer than {days} days", { days: SECURITY_DAYS });
    if (Math.floor(fromMs / HOUR_MS) < Math.floor(now / HOUR_MS) - SECURITY_DAYS * 24)
      return localize("credentials.index.from_is_before_the", "from is before the counts kept, which go back {days} days", { days: SECURITY_DAYS });
    if (toMs > (Math.floor(now / HOUR_MS) + 1) * HOUR_MS) return localize("credentials.index.to_is_after_the", "to is after the present hour");
    return null;
  }

  /* R45, R49: SECURITY_PERIOD_INVALID, minted here alone, naming what is wrong (`what`) and the rule (`rule`). */
  static #periodRefusal(what, rule) {
    /* DEC-49 REGION is-security-period */
    const row = SIGN_IN_CHECKS.SECURITY_PERIOD_INVALID;
    return { ok: false, reason: "SECURITY_PERIOD_INVALID", code: "SECURITY_PERIOD_INVALID", check: row.check,
             translation: row.translation, what, detail: localize("credentials.index.period_refused_detail", "{what}. {rule} Nothing was read.", { what, rule }) };
    /* END DEC-49 REGION is-security-period */
  }

  static #median(values) {
    const v = [...values].sort((a, b) => a - b);
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* R45: the figures over hours [fromH, toH), with the usual of each hour, the countries and the level. Writes
     nothing: a waiting place an hour old is read as placed, as the next write will place it. */
  #figures(fromMs, toMs, now) {
    const fromH = Math.floor(fromMs / HOUR_MS), toH = Math.ceil(toMs / HOUR_MS);
    const keys = [...SECURITY_KINDS, "total"];
    const zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
    const byHour = new Map();
    const usualDays = SECURITY_THRESHOLD.usualDays;
    for (const r of this.#rows(`SELECT kind, hour, SUM(count) AS n FROM security_counts WHERE hour >= ? AND hour < ?
                                GROUP BY kind, hour`, fromH - usualDays * 24, toH)) {
      if (!SECURITY_KINDS.includes(r.kind)) continue;
      const h = Number(r.hour);
      if (!byHour.has(h)) byHour.set(h, zero());
      const c = byHour.get(h);
      c[r.kind] += Number(r.n);
      c.total += Number(r.n);
    }
    const at = (h) => byHour.get(h) ?? zero();
    const usualOf = (h) => Object.fromEntries(keys.map((k) =>
      [k, Credentials.#median(Array.from({ length: usualDays }, (_, i) => at(h - (i + 1) * 24)[k]))]));
    const hours = [];
    for (let h = fromH; h < toH; h++) hours.push({ h, counts: at(h), usual: usualOf(h) });
    const unusual = ({ counts, usual }) => counts.total >= SECURITY_THRESHOLD.atLeast
      && counts.total > (usual.total === 0 ? SECURITY_THRESHOLD.times : SECURITY_THRESHOLD.times * usual.total);
    const firstUnusual = hours.find(unusual)?.h ?? null;
    const firstThrough = hours.find((x) => x.counts.through > 0)?.h ?? null;
    const lastWhole = Math.floor(toMs / HOUR_MS) - 1;
    const going = lastWhole >= fromH && unusual(hours[lastWhole - fromH] ?? { counts: zero(), usual: zero() })
      && toMs >= now - HOUR_MS;
    const level = firstThrough !== null || going ? "High" : firstUnusual !== null ? "Raised" : "Ordinary";
    const firsts = [firstUnusual, firstThrough].filter((x) => x !== null);
    return { fromH, toH, keys, zero, hours, level, levelAt: firsts.length ? Credentials.#iso(Math.min(...firsts) * HOUR_MS) : null };
  }

  /* R45 (`op=securitymap`): administrators only. */
  securityMap({ from = null, to = null, by = null } = {}) {
    const bar = this.#adminBar(by, "reading the security map");
    if (bar) return bar;
    const now = this.#nowMs();
    const fromMs = Credentials.#instantOf(from), toMs = Credentials.#instantOf(to);
    const fault = Credentials.#periodFault(fromMs, toMs, now);
    if (fault) return Credentials.#periodRefusal(fault, localize("credentials.index.the_period_is_from", "The period is from an earlier instant to a later one, at most {days} days long and inside the last {days} days.", { days: SECURITY_DAYS }));
    const f = this.#figures(fromMs, toMs, now);
    const span = toMs - fromMs;
    const [step, stepH] = span <= 48 * HOUR_MS ? ["hour", 1] : span <= 14 * DAY_MS ? ["six-hours", 6] : ["day", 24];
    const buckets = [];
    for (let start = Math.floor(f.fromH / stepH) * stepH; start < f.toH; start += stepH) {
      const counts = f.zero(), usual = f.zero();
      for (const x of f.hours.slice(Math.max(start, f.fromH) - f.fromH, Math.min(start + stepH, f.toH) - f.fromH))
        for (const k of f.keys) { counts[k] += x.counts[k]; usual[k] += x.usual[k]; }
      buckets.push({ start: Credentials.#iso(start * HOUR_MS), counts, usual });
    }
    const count = f.zero(), usual = f.zero();
    for (const b of buckets) for (const k of f.keys) { count[k] += b.counts[k]; usual[k] += b.usual[k]; }
    let busiest = buckets[0];
    for (const b of buckets) if (b.counts.total > busiest.counts.total) busiest = b;
    /* countries: the period's placed counts, and the waiting places an hour old read as placed */
    const placed = new Map();
    let unplaced = 0;
    for (const r of this.#rows(`SELECT country, SUM(count) AS n FROM security_counts WHERE hour >= ? AND hour < ?
                                GROUP BY country`, f.fromH, f.toH)) {
      if (r.country === "") unplaced += Number(r.n);
      else placed.set(r.country, (placed.get(r.country) ?? 0) + Number(r.n));
    }
    for (const p of this.#rows(`SELECT country, COUNT(*) AS n FROM security_pending WHERE at <= ? AND hour >= ?
                                AND hour < ? AND country IS NOT NULL GROUP BY country`, now - HOUR_MS, f.fromH, f.toH)) {
      const n = Math.min(Number(p.n), unplaced);
      unplaced -= n;
      placed.set(p.country, (placed.get(p.country) ?? 0) + n);
    }
    const countries = [...placed].filter(([, n]) => n > 0).map(([country, n]) => ({ country, count: n }))
      .sort((a, b) => b.count - a.count || (a.country < b.country ? -1 : 1));
    return { ok: true, from: Credentials.#iso(fromMs), to: Credentials.#iso(toMs), step, buckets,
             totals: { count, usual, busiest: busiest ? busiest.start : null }, countries, unplaced,
             note: SECURITY_NOTE, level: f.level, levelAt: f.levelAt };
  }

  /* R45: the level over the 24 hours ending now, for `notice-producers`' one "Noticed" when it becomes High; an
     in-plane read reached by no route and answered to no viewer. Writes nothing; never throws. (N743; K2038) When the
     counts cannot be read the failure is answered as one, `{level: null, levelAt: null}`, never `Ordinary`. */
  securityLevel() {
    try {
      const now = this.#nowMs();
      const { level, levelAt } = this.#figures(now - DAY_MS, now, now);
      return { level, levelAt };
    } catch { return { level: null, levelAt: null }; }
  }

  /* R49 (K1946 T3): R44's counts for a period, for `file-safety`'s log forwarding (its R35): each kind's sum over every
     country and over counts not placed, for the hours that start at or after `from` and before `to`. An in-plane read
     reached by no route and answered to no viewer; it names no country, writes nothing and never throws. Counts that
     cannot be read are a refusal naming the failure, never zeros, so the forwarding sends them as absent. */
  securityTotals({ from = null, to = null } = {}) {
    const fromMs = Credentials.#instantOf(from), toMs = Credentials.#instantOf(to);
    const fault = !Number.isFinite(fromMs) ? localize("credentials.index.from_is_not_an", "from is not an instant")
      : !Number.isFinite(toMs) ? localize("credentials.index.to_is_not_an", "to is not an instant")
      : fromMs >= toMs ? localize("credentials.index.from_is_not_before", "from is not before to") : null;
    if (fault) return Credentials.#periodRefusal(fault, localize("credentials.index.the_period_is_from_2", "The period is from an earlier instant to a later one."));
    try {
      const counts = Object.fromEntries(SECURITY_KINDS.map((k) => [k, 0]));
      /* the hours h with h·H in [from, to) */
      for (const r of this.#rows(`SELECT kind, SUM(count) AS n FROM security_counts WHERE hour >= ? AND hour < ?
                                  GROUP BY kind`, Math.ceil(fromMs / HOUR_MS), Math.ceil(toMs / HOUR_MS)))
        if (SECURITY_KINDS.includes(r.kind)) counts[r.kind] = Number(r.n);
      return { ok: true, from: Credentials.#iso(fromMs), to: Credentials.#iso(toMs), counts };
    } catch (e) {
      /* DEC-49 REGION is-security-counts-read */
      const row = SIGN_IN_CHECKS.SECURITY_COUNTS_UNREADABLE;
      return { ok: false, reason: "SECURITY_COUNTS_UNREADABLE", code: "SECURITY_COUNTS_UNREADABLE", check: row.check,
               translation: row.translation, failure: String(e?.message ?? e).slice(0, 200),
               detail: localize("credentials.index.the_security_counts_could", "the security counts could not be read, so no figure is given: they are absent, never zero. Nothing was read.") };
      /* END DEC-49 REGION is-security-counts-read */
    }
  }

  /* ===== RECOVERY CODES (R46, R47; K1888) =====
   *
   * An active administrator holds ten one-time codes for their own role, each drawn from a CSPRNG (100 bits: twenty
   * characters of a 32-letter alphabet), answered once and kept only as its SHA-256. A code recovers its role only
   * while that role is an active administrator; it sets a new password, ends every session of the role, and is never
   * accepted again. `recover` is reached without a credential, so it is under R38's window, and every refusal past the
   * window and the password's length is ONE answer at one cost, so it never tells which roles hold codes. */

  static #CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  static #newCode() {
    const b = crypto.getRandomValues(new Uint8Array(20));
    const chars = [...b].map((x) => Credentials.#CODE_ALPHABET[x & 31]).join("");
    return chars.match(/.{5}/g).join("-");
  }

  /* A code as typed: case, spaces and dashes do not matter. */
  static #codeSha(code) { return sha256HexSync(String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")); }

  /* The founder's role is `admin`; a member's `member:<id>`. */
  static #roleFor(id) { return id === ROOT ? ROOT : `member:${id}`; }

  /* R47 (T47; R68): whether `role` is an active member's, or the founder's once claimed, now. */
  #roleIsActive(role) {
    return role === ROOT || (typeof role === "string" && role.startsWith("member:") && role.length > 7)
      ? this.#holderActive(role === ROOT ? ROOT : role.slice(7)) : false;
  }

  /* R46 (T47; R68, K3060 D4): ten codes for `by`'s own role, any active member's or the claimed founder's; issuing
     again spends every earlier unspent code of that role. Anyone else is refused RECOVERY_CODES_NOT_A_MEMBER. */
  recoveryCodesIssue({ by = null } = {}) {
    const who = Credentials.#memberOf(by);
    /* DEC-49 REGION is-recovery-codes-member */
    if (who === null || isMachineIdentity(by) || isMachineIdentity(who) || !this.#holderActive(who))
      return Credentials.#row(SIGN_IN_CHECKS, "RECOVERY_CODES_NOT_A_MEMBER", localize("credentials.index.recovery_codes_are_issued", "recovery codes are issued to an active member for their own account, from their own signed-in session. Nothing was issued."), { by: by ?? null });
    /* END DEC-49 REGION is-recovery-codes-member */
    const role = Credentials.#roleFor(who);
    const issuedAt = stampSecond(this.#nowMs());
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => Credentials.#newCode());
    this.#tx(() => {
      this.sql.exec(`UPDATE recovery_codes SET spent_at=? WHERE role=? AND spent_at IS NULL`, issuedAt, role);
      for (const c of codes)
        this.sql.exec(`INSERT INTO recovery_codes (code_sha, role, issued_at) VALUES (?,?,?)`, Credentials.#codeSha(c), role,
          issuedAt);
    });
    return { ok: true, codes, issuedAt };
  }

  /* R46: `by`'s own codes, counted; never a code or a digest. */
  recoveryCodesState({ by = null } = {}) {
    const id = Credentials.#memberOf(by);
    if (id === null || isMachineIdentity(by)) return { ok: true, held: false, remaining: 0, issuedAt: null };
    const r = this.#one(`SELECT COUNT(*) AS n, MAX(issued_at) AS at FROM recovery_codes WHERE role=? AND spent_at IS NULL`,
      Credentials.#roleFor(id));
    const remaining = Number(r?.n ?? 0);
    return { ok: true, held: remaining > 0, remaining, issuedAt: remaining > 0 ? r.at : null };
  }

  static #recoveryRefused() {
    /* DEC-49 REGION is-recovery-code */
    const row = SIGN_IN_CHECKS.RECOVERY_REFUSED;
    return { ok: false, reason: "RECOVERY_REFUSED", code: "RECOVERY_REFUSED", check: row.check, translation: row.translation,
             detail: localize("credentials.index.no_password_was_set", "no password was set and nothing was written. Either that role holds no recovery code, or the code given is not one of its unspent codes, or the role is not an active member's now. Which of those happened is not said: it is one answer deliberately, so that a refusal cannot be used to find out which roles hold codes.") };
    /* END DEC-49 REGION is-recovery-code */
  }

  /* R47: reached without a credential. (T47; R67; T49 R75) `handle` names the role as `login`'s does, and `role` is no
     longer read; (R68) any active member's role recovers. */
  async recover({ handle = null, code = null, password = null, source = null, country = null } = {}) {
    const asked = this.#roleByHandle(handle);
    const gate = await this.#gate({ role: asked, source, country, password });
    if (gate.paused) return gate.paused;
    if (typeof password !== "string" || password.length < 12) {
      this.#refusedAttempt(gate, country);
      return { ok: false, reason: "PASSWORD_TOO_SHORT", minimum: 12 };
    }
    const presented = Credentials.#codeSha(code);
    /* R41: every unspent code of the role compared, in constant time, none skipped */
    const unspent = (r) => this.#rows(`SELECT code_sha FROM recovery_codes WHERE role=? AND spent_at IS NULL`, r);
    const matches = () => {
      let hit = null;
      for (const r of unspent(asked)) if (Credentials.#same(presented, r.code_sha, { digests: true })) hit = r.code_sha;
      return hit;
    };
    const admin = this.#roleIsActive(asked);
    const given = typeof code === "string" && code.trim() !== "";
    const refuse = () => { this.#refusedAttempt(gate, country); return Credentials.#recoveryRefused(); };
    if (!(matches() !== null && admin && given)) {
      await Credentials.#payLoginCost(password);
      return refuse();
    }
    const hashed = await Credentials.#hashFor(password);
    /* asked again in the one act that spends it, so a code is spent once whatever runs beside it */
    const done = this.#tx(() => {
      const hit = matches();
      if (hit === null || !this.#roleIsActive(asked)) return null;
      const at = stampSecond(this.#nowMs());
      this.#storePassword(asked, hashed);
      this.sql.exec(`UPDATE recovery_codes SET spent_at=? WHERE code_sha=?`, at, hit);
      this.#endSessions(this.#rows(`SELECT token_sha FROM sessions WHERE role=?`, asked).map((r) => r.token_sha));
      this.sql.exec(`INSERT INTO recoveries (role, at) VALUES (?,?)`, asked, at);
      return { ok: true, role: asked, remaining: unspent(asked).length };
    });
    if (!done) return refuse();
    this.#succeeded(gate);
    return done;
  }

  /* ===== THE ADMINISTRATOR'S RESET LINK (R69; T47, K3060 D4) =====
   *
   * An administrator makes a one-time link for a member who cannot sign in: one live per member (a new one ends the
   * earlier), RESET_LINK_DAYS days, answered once and kept only as its SHA-256, with who made it and when. The member
   * looks it up and sets a new password through it, both reached with no credential; the reset is under R38's window,
   * sets the password as R3 does, ends every session of the member and spends the link. Every dead arm (unknown,
   * expired, spent, ended by a newer link or by the member's revocation, R16) is the one RESET_LINK_DEAD. */

  /* R69: the live link a presented one names, or null. */
  #liveResetLink(link) {
    if (typeof link !== "string" || link === "") return null;
    const r = this.#one(`SELECT link_sha, member_id, expires_at FROM password_reset_links
                         WHERE link_sha=? AND spent_at IS NULL AND ended_at IS NULL`, sha256HexSync(link));
    return r && r.expires_at > this.#nowMs() && this.#holderActive(r.member_id) ? r : null;
  }

  static #resetLinkDead() {
    /* DEC-49 REGION is-reset-link-live */
    return Credentials.#row(ACCOUNT_CHECKS, "RESET_LINK_DEAD", localize("credentials.index.this_reset_link_does", "this reset link does not work: it was used, it expired, a newer one replaced it, or it never existed. Which, it does not say. Nothing was changed."));
    /* END DEC-49 REGION is-reset-link-live */
  }

  /* R69 `passwordResetLinkMake` (`op=passwordresetlink`): an active administrator's act, for an active member. */
  passwordResetLinkMake({ member = null, by = null } = {}) {
    const bar = this.#adminBar(by, "making a password reset link");
    if (bar) return bar;
    const id = Credentials.#memberOf(member);
    /* DEC-49 REGION is-reset-link-member */
    if (id === null || id === ROOT || isMachineIdentity(id) || this.#memberFacts(id)?.status !== "active")
      return Credentials.#row(ACCOUNT_CHECKS, "RESET_LINK_MEMBER_NOT_ACTIVE", localize("credentials.index.a_reset_link_is_made", "a reset link is made only for an active member of the team. Nothing was made."), { member: id });
    /* END DEC-49 REGION is-reset-link-member */
    const link = `rl-${Credentials.#rand(32)}`;
    const now = this.#nowMs();
    const expiresAt = now + RESET_LINK_DAYS * DAY_MS;
    this.#tx(() => {
      this.sql.exec(`UPDATE password_reset_links SET ended_at=? WHERE member_id=? AND spent_at IS NULL AND ended_at IS NULL`,
        stampSecond(now), id);
      this.sql.exec(`INSERT INTO password_reset_links (link_sha, member_id, made_by, made_at, expires_at) VALUES (?,?,?,?,?)`,
        sha256HexSync(link), id, Credentials.#memberOf(by), stampSecond(now), expiresAt);
    });
    return { ok: true, member: id, link, expiresAt: stampSecond(expiresAt) };
  }

  /* R69 `passwordResetLook` (`op=passwordresetlook`, public): live, with the member's handle and when it expires; or
     RESET_LINK_DEAD for every other arm. Writes nothing. */
  passwordResetLook({ link = null } = {}) {
    const r = this.#liveResetLink(link);
    return r ? { ok: true, live: true, handle: this.#memberFacts(r.member_id)?.handle ?? null,
                 expiresAt: stampSecond(r.expires_at) } : Credentials.#resetLinkDead();
  }

  /* R69 `passwordReset` (`op=passwordreset`, public): R38's window (under the link's member, or one role of its own
     for a dead link), a password of 12 or more, then the link; a dead link is counted as a refused recovery is. */
  async passwordReset({ link = null, password = null, source = null, country = null } = {}) {
    const found = this.#liveResetLink(link);
    const gate = await this.#gate({ role: found ? `member:${found.member_id}` : "reset-link", source, country, password });
    if (gate.paused) return gate.paused;
    if (typeof password !== "string" || password.length < 12) return { ok: false, reason: "PASSWORD_TOO_SHORT", minimum: 12 };
    const hashed = await Credentials.#hashFor(password);   /* one derivation, dead link or live */
    const done = found && this.#tx(() => {
      const live = this.#liveResetLink(link);
      if (!live) return null;
      const role = `member:${live.member_id}`;
      this.#storePassword(role, hashed);
      this.sql.exec(`UPDATE password_reset_links SET spent_at=? WHERE link_sha=?`, stampSecond(this.#nowMs()), live.link_sha);
      const all = this.#rows(`SELECT token_sha FROM sessions WHERE role=?`, role).map((r) => r.token_sha);
      this.#endSessions(all);
      return { ok: true, member: live.member_id, ended: all.length };
    });
    if (!done) { this.#refusedAttempt(gate, country); return Credentials.#resetLinkDead(); }
    this.#succeeded(gate);
    return done;
  }

  /* ===== THE GROUP'S KEYED SERVICES (R29; K1449; K1946 T1) =====
   *
   * The group's own key for a keyed outside service, set by an administrator, sealed as a member's reference is, off
   * by default and off while it holds no key. No key is ever required for the copy to work (D201): an in-plane caller
   * that is refused answers without the service. A paid account is not a keyed service (K1449; `sources`). (T36)
   * Each outside security tool's credentials are held here too, under `security:<tool_id>`, set when an administrator
   * adds the tool and read for each call to it (`file-safety` R28, R29); such a key may be a set of named fields held
   * as one value, and a set with no key removes the service's key, which turns it off (`file-safety` R30). */
  #keyedService(service) {
    /* DEC-49 REGION is-keyed-service */
    if (!KEYED_SERVICES.includes(service) && !(typeof service === "string" && SECURITY_SERVICE_RE.test(service)))
      return Credentials.#row(KEYED_SERVICE_CHECKS, "UNKNOWN_KEYED_SERVICE", localize("credentials.index.the_keyed_services_are",
        "the keyed services are {services}, and {prefix}<tool id> for each security tool. Nothing was changed.",
        { services: KEYED_SERVICES.join(", "), prefix: SECURITY_SERVICE_PREFIX }),
        { service: typeof service === "string" ? service.slice(0, 40) : null });
    return null;
    /* END DEC-49 REGION is-keyed-service */
  }

  #adminBar(by, act) {
    const who = Credentials.#memberOf(by);
    return who !== null && !isMachineIdentity(by) && this.membership.isAdministrator(who) ? null : notAnAdmin(by ?? null, act);
  }

  /* R29: one key, a string; or a set of named fields (`{name: value}`, at least one, each name 1 to 64 letters, digits,
     `.`, `_` or `-` and each value a non-blank string), held and answered as one value. No key at all (null or left
     out) removes the service's key. Answers the form to seal, or the refusal. */
  static #keyForm(key) {
    if (typeof key === "string") return key.trim() === "" ? { empty: word("credentials.key_given") } : { form: "key", text: key };
    if (key && typeof key === "object" && !Array.isArray(key) && Object.getPrototypeOf(key) === Object.prototype) {
      const names = Object.keys(key);
      if (!names.length) return { empty: word("credentials.set_fields_empty") };
      for (const n of names) {
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(n)) return { empty: word("credentials.field_name_set", { n: String(n.slice(0, 64)) }) };
        if (typeof key[n] !== "string" || key[n].trim() === "") return { empty: word("credentials.field_holds_value", { n: String(n) }) };
      }
      return { form: "fields", text: JSON.stringify(Object.fromEntries(names.sort().map((n) => [n, key[n]]))) };
    }
    return { empty: word("credentials.key_given") };
  }

  async keyedServiceSet({ service = null, key = null, by = null } = {}) {
    const bar = this.#adminBar(by, localize("credentials.index.setting_the_teams_key", "setting the team's key for an outside service"));
    if (bar) return bar;
    const unknown = this.#keyedService(service);
    if (unknown) return unknown;
    if (key === null || key === undefined) {   /* a set with no key removes it, and the service is off */
      const held = this.#keyedState(service).held;
      this.sql.exec(`DELETE FROM keyed_services WHERE service=?`, service);
      return { ok: true, service, held: false, removed: held };
    }
    const k = Credentials.#keyForm(key);
    /* DEC-49 REGION is-keyed-service-key */
    if (k.empty)
      return Credentials.#row(KEYED_SERVICE_CHECKS, "KEYED_SERVICE_NO_KEY", localize("credentials.index.empty_nothing_was", "{empty}. Nothing was changed.", { empty: k.empty }));
    /* END DEC-49 REGION is-keyed-service-key */
    /* (T48; K3101) sealed through `ai-accounts` R24, byte-identical to the seal held here before, so every key opens */
    const s = await this.accounts.sealText({ owner: `group:${service}`, kind: k.form, text: k.text });
    if (!s || s.ok === false) return s;
    const { sealed, iv } = s;
    const setAt = stampSecond(this.#nowMs());
    this.sql.exec(
      `INSERT INTO keyed_services (service, sealed, iv, is_on, set_by, set_at, form) VALUES (?,?,?,0,?,?,?)
       ON CONFLICT(service) DO UPDATE SET sealed=excluded.sealed, iv=excluded.iv, set_by=excluded.set_by,
         set_at=excluded.set_at, form=excluded.form`, service, sealed, iv, Credentials.#memberOf(by), setAt, k.form);
    return { ok: true, service, held: true, set_at: setAt };
  }

  keyedServiceSwitch({ service = null, on = false, by = null } = {}) {
    const bar = this.#adminBar(by, localize("credentials.index.switching_the_teams_key", "switching the team's key for an outside service"));
    if (bar) return bar;
    const unknown = this.#keyedService(service);
    if (unknown) return unknown;
    this.sql.exec(`INSERT INTO keyed_services (service, is_on) VALUES (?,?)
                   ON CONFLICT(service) DO UPDATE SET is_on=excluded.is_on`, service, on === true ? 1 : 0);
    return { ok: true, ...this.#keyedState(service) };
  }

  /* F1 (op-grades R55; N1259-e §1; R84): `alertconnect`, connecting the team's outside alert service, is the keyed-service
     act under the screens' name: an active administrator's alone (a machine credential is refused `NOT_AN_ADMIN`, as
     `keyedserviceset` is), the key set or removed (`key`, null removes it) and the service switched (`on`), in that order;
     with neither, the service's state is answered and nothing is written. Never answers the key. */
  async alertConnect({ service = null, key, on, by = null } = {}) {
    const bar = this.#adminBar(by, localize("credentials.index.setting_the_teams_key", "setting the team's key for an outside service"));
    if (bar) return bar;
    const unknown = this.#keyedService(service);
    if (unknown) return unknown;
    if (key !== undefined) {
      const set = await this.keyedServiceSet({ service, key, by });
      if (!set || set.ok === false) return set;
    }
    if (typeof on === "boolean") return this.keyedServiceSwitch({ service, on, by });
    return { ok: true, ...this.#keyedState(service) };
  }

  /* A service is on only while it is switched on AND holds a key. */
  #keyedState(service) {
    const r = this.#one(`SELECT sealed, is_on, set_by, set_at FROM keyed_services WHERE service=?`, service);
    const held = !!(r && r.sealed);
    return { service, held, on: held && !!r.is_on, set_by: r?.set_by ?? null, set_at: r?.set_at ?? null };
  }

  /* Every named service, then each security tool's that holds a row, in order; never a key. */
  keyedServices() {
    const tools = this.#rows(`SELECT service FROM keyed_services WHERE service LIKE 'security:%' ORDER BY service`)
      .map((r) => r.service).filter((x) => SECURITY_SERVICE_RE.test(x));
    return { services: [...KEYED_SERVICES, ...tools].map((s) => this.#keyedState(s)) };
  }

  /* The key, to its in-plane caller only while the service is on; never routed. A set of fields is answered as the
     object it was set as. */
  async keyedServiceFor({ service = null } = {}) {
    const unknown = this.#keyedService(service);
    if (unknown) return unknown;
    const off = () => Credentials.#row(KEYED_SERVICE_CHECKS, "KEYED_SERVICE_OFF", localize("credentials.index.the_teams_key_for", "the team's key for this service is off or not held; the caller goes on without it."), { service });
    /* DEC-49 REGION is-keyed-service-on */
    if (!this.#keyedState(service).on) return off();
    /* END DEC-49 REGION is-keyed-service-on */
    /* (T48; K3101) opened through `ai-accounts` R24, which answers ACCOUNT_SEAL_UNAVAILABLE (its one site) when no seal
       secret is bound or the key does not open; a set of fields that opens and does not parse is answered the same
       refusal, asked of that site with nothing to open */
    const r = this.#one(`SELECT sealed, iv, form FROM keyed_services WHERE service=?`, service);
    const form = r.form === "fields" ? "fields" : "key";
    const owner = `group:${service}`;
    const opened = await this.accounts.unsealText({ owner, kind: form, sealed: r.sealed, iv: r.iv });
    if (!opened || opened.ok !== true) return opened;
    let key = opened.text;
    if (form === "fields") { try { key = JSON.parse(opened.text); } catch { key = null; } }
    if (key === null) return this.accounts.unsealText({ owner, kind: form });
    return { ok: true, service, key };
  }
}

/* K61: the one Credentials of a Durable Object's storage, made on first use over its `sql`, reaching record-core and
   membership by their factories on the same `ctx`; its first construction registers the seam (R16, R17). `record` and
   `membership` (a test's own) are read on the first call only. `now` (K5148) is the instance clock, read on the first call
   only, as retrieval's and capture-requests' are; none handed, the store's environment or the wall clock answers. `catalogue`
   (T53) is ai-catalogue's service, handed on to `ai-accounts` (its R32) on the first call. */
const OF = new WeakMap();
export function credentialsOf(ctx, { record = null, membership = null, sealSecret = null, now = null, catalogue = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let c = OF.get(storage);
  if (!c) {
    const core = record ?? recordOf(ctx);
    const m = membership ?? membershipOf(ctx, { record });
    /* (T48; `ai-accounts` R32) `ai-accounts` is made here, first, with the seal secret this module is given */
    const accounts = aiAccountsOf(ctx, { record: core, membership: m, sealSecret, now, catalogue });   /* K5197: the instance clock reaches it */
    c = new Credentials({ sql: storage.sql, core, membership: m, accounts, now });
    OF.set(storage, c);
    c.start();
  }
  return c;
}

/* R72 (T48, transitional; K3101): each service that moved to `ai-accounts` (its R1–R23) answered here through its own,
   byte for byte: a delegate per name, never a copy of its code (K624). Deleted, with `ACCOUNT_CHECKS`' view and the
   spread in `credentialsOps`, by this module's first job after its last user re-points (split map §5). */
export const MOVED_TO_AI_ACCOUNTS = Object.freeze([
  "accountFor", "registerDisclosureRead", "disclosureDue", "accountUsesSet", "accountUses", "accountUsesOf", "accountHistory",
  "aiKeepAwaySet", "aiKeepAwayState", "aiKeptAway", "projectAiKeepAwaySet", "projectAiKeepAwayState", "projectsKeptAway",
]);
for (const name of MOVED_TO_AI_ACCOUNTS)
  Object.defineProperty(Credentials.prototype, name, {
    value: function (...a) { return this.accounts[name](...a); }, writable: true, configurable: true });

/* The ops this module answers, as entries of the plane's one route map (plane R5: `routes` spreads them in, after
   membership's, and control-plane's `dispatch` answers every store request over it). `url` carries the control
   plane's stamps (`by`, `who`) in its query, read AFTER the body is spread, so a caller's own copy never wins (D-136);
   `body` is the parsed body; `env` the store's environment. */
export function credentialsOps(c, url, body, env) {
  /* K5132: the store's environment is the instance clock's source (`#nowMs`), so every op this map answers reads it */
  if (env && typeof env === "object") c.env = env;
  const doorStamps = (u) => ({ source: u.searchParams.get("source"), country: u.searchParams.get("country") });
  const bodyField = (k) => (body && typeof body === "object" && !Array.isArray(body) && typeof body[k] === "string" ? body[k] : null);
  const by = () => url.searchParams.get("by");
  return {
    /* D-199: `who` is the SERVER'S stamp, and `secretSha` never comes from a caller: the control plane generates the
       value, hashes it, and this module never sees the value. R53 (N761; K2129): the digest is read from the body
       only, where the control plane sets it after removing any a caller sent; a `secretSha` in the query is never
       read, so no digest travels in an internal address. */
    aicredentialmint: () => {
      const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
      return c.aiCredentialMint({ ...b, who: url.searchParams.get("who"), secretSha: b.secretSha ?? null });
    },
    aicredentialrevoke: () => c.aiCredentialRevoke({
      tokenId: url.searchParams.get("tokenId"),
      who: url.searchParams.get("who") }),
    aicredentials: () => c.aiCredentials({ limit: url.searchParams.get("limit") }),
    /* INTERNAL ONLY, the gate's own lookup; it takes the HASH because the value never crosses this boundary. */
    aicredentiallook: () => c.aiCredentialLook({ secretSha: url.searchParams.get("sha") }),
    /* D-116: the DO's own build under `storeVersion`, never `version` (the routing isolate's, spread before this).
       null, never a default: a DO with no VERSION bound cannot say which build it is. */
    bootstrap: () => ({ ...c.bootstrapState(url.searchParams.get("fp")),
                        storeVersion: typeof env?.VERSION === "string" && env.VERSION ? env.VERSION : null }),
    /* R38, R44 (T35): `source` (the caller's keyed fingerprint of the connecting address, never the address) and
       `country` (Cloudflare's label) are the control plane's stamps, read from the query after the body, so a caller
       cannot choose the window it is counted in (admission's, T35-71). */
    claim: () => c.claim({ ...(body || {}), tokenFp: url.searchParams.get("fp"), ...doorStamps(url) }),
    login: () => c.login({ ...(body || {}), ...doorStamps(url) }),
    /* R3 (T37; DEC-182 (4)): a member's own change, `{current, password}` from the body; the role from the session the
       control plane authenticated (`session`), `by` its stamp, `source` and `country` the door's; a `role` in the
       body is never read. */
    setpassword: () => {
      const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
      return c.passwordChange({ current: b.current ?? null, password: b.password ?? null, by: url.searchParams.get("by"),
                                session: url.searchParams.get("session"), ...doorStamps(url) });
    },
    /* (T47; R65) a request the door marks `background=1` is no activity */
    session: () => ({ session: c.session(url.searchParams.get("t"), { background: url.searchParams.get("background") === "1" }) }),
    /* R65, R66 (T47): the password asked again on the session the control plane authenticated (`session`, its stamp),
       from the body only; `source` and `country` the door's */
    unlock: () => c.unlock({ token: url.searchParams.get("session"), password: bodyField("password"), ...doorStamps(url) }),
    reauth: () => c.reauth({ token: url.searchParams.get("session"), password: bodyField("password"), ...doorStamps(url) }),
    /* R69 (T47): the administrator's reset link, `by` the stamp; the look and the reset reached with no credential, the
       link from the body only, never an address */
    passwordresetlink: () => c.passwordResetLinkMake({ member: bodyField("member") ?? url.searchParams.get("member"), by: by() }),
    passwordresetlook: () => c.passwordResetLook({ link: bodyField("link") }),
    passwordreset: () => c.passwordReset({ link: bodyField("link"), password: bodyField("password"), ...doorStamps(url) }),
    /* R39 (F14): the session the control plane authenticated (`session`, its stamp). */
    signout: () => c.signOut({ token: url.searchParams.get("session") }),
    signouteverywhere: () => c.signOutEverywhere({ token: url.searchParams.get("session") }),
    /* R45: an administrator's read; the period from the query or the body, `by` the stamp. */
    securitymap: () => c.securityMap({ from: url.searchParams.get("from"), to: url.searchParams.get("to"), ...(body || {}),
                                       by: url.searchParams.get("by") }),
    /* R46, R47 (K1888): an administrator's own codes; `recover` reached with no credential, under R38's window. */
    recoverycodesissue: () => c.recoveryCodesIssue({ by: url.searchParams.get("by") }),
    recoverycodesstate: () => c.recoveryCodesState({ by: url.searchParams.get("by") }),
    recover: () => c.recover({ ...(body || {}), ...doorStamps(url) }),
    /* REC-159: spread the body, THEN the stamp. */
    signeradd: () => c.signerAdd({ ...(body || {}), by: url.searchParams.get("by") }),
    signerlist: () => c.signerList(),
    signerset: () => c.signerSet({ ...(body || {}), by: url.searchParams.get("by") }),
    /* R83 (T51): the key from the body, the administrator from the control plane's stamp (`viewer`, else `by`), never the body */
    signerknown: () => c.signerKnown({ keyB64: bodyField("keyB64"), viewer: url.searchParams.get("viewer") ?? url.searchParams.get("by") }),
    /* T33-20 (R27–R29): the ask grant and the keyed services, `by` the control plane's stamp and the session the one it
       authenticated (`session`, its stamp); a secret only ever in the body, never the query. The in-plane reads
       (`aiGrantAdmit`, `aiGrantHeld`, `aiGrantMintStanding`, `keyedServiceFor`; T35's `securityLevel`; T36's
       `securityTotals`) are not routed; `securityCount` only as the store-internal `securitycount` (R50). Which
       credential reaches each op is op-declarations' and control-plane's (Q0-10; control-plane R53, R56). */
    /* (T40; R27) the project an ask is made in, the body's or the query's; never a stamp */
    aigrantmint: () => c.aiGrantMint({ member: url.searchParams.get("member"), by: url.searchParams.get("by"),
                                       session: url.searchParams.get("session"),
                                       project: bodyField("project") ?? (url.searchParams.get("project") || null) }),
    keyedserviceset: () => c.keyedServiceSet({ ...(body || {}), by: url.searchParams.get("by") }),
    keyedserviceswitch: () => c.keyedServiceSwitch({ ...(body || {}), by: url.searchParams.get("by") }),
    keyedservices: () => c.keyedServices(),
    /* F1: the screens' alert-connect act, the fields from the body, the administrator from the control plane's stamp */
    alertconnect: () => {
      const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
      return c.alertConnect({ service: b.service ?? null, ...(Object.hasOwn(b, "key") ? { key: b.key } : {}),
                              ...(Object.hasOwn(b, "on") ? { on: b.on } : {}), by: url.searchParams.get("by") });
    },
    /* R50 (N744; K2038): STORE-INTERNAL, no spec (op-declarations R6): R44's write for admission R22, reached from the
       Worker through the store as `doorbellrefused` is. It takes `{kind, country}` from the body and nothing else. */
    securitycount: () => {
      const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
      return c.securityCount({ kind: b.kind ?? null, country: b.country ?? null });
    },
  };
}

/* R82 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by
   their owner beside the ops map: each row's classes, weight and description are the op's existing rows', its fields are what
   the arm reads from `url` and `body`, less the door's stamps (`by`, `session`, `source`, `country`, and `fp`, the fingerprint
   of the bootstrap secret). `signerregisterown` and `signerrevokeown` are the screens' names for the arms the store door
   routes as `signerregister` and `signerrevoke` (op-declarations R21); they call `signerRegisterOwn` and `signerRevokeOwn`
   here. `login`, `recover` and `reauth` refuse a missing field with the one refusal they give for every arm (R4, R47, R65),
   which names no field; their `requires` are the fields without which no call can succeed. `subscriptionsignin` is the
   control plane's route to the member's own runner (`agent-worker` R66), not an arm of this module. `securitymap` is a read the
   administrator's screen sends with `from` and `to` (K4210: `op-grades` drops its hand row that grounded a read). */
export const DECLARED_OPS = Object.freeze({
  /* `members` (not required) is the screens' ask for each member's own build, answered at the public door by instance-setup's
     `bootstrapOp` (setup.mjs), not by the arm above (K4237, SCREENS-SETTINGS #10); declared here so the screen's field is accepted. */
  bootstrap: { classes: null, mutating: false, weight: "read", description: "act.bootstrap.does",
    fields: { accepts: ["members"], requires: [] } },
  /* F1 (op-grades R55): graded ground `credential` as `keyedserviceset`; no machine class reaches it (`machineClasses: []`),
     and the module refuses a machine author itself; an administrator's act, gated by class, so `needs` is null (op-capabilities R4) */
  alertconnect: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "credential",
    budget_ms: 1000, description: localize("credentials.declared.alertconnect", "credential governance: an administrator sets, removes or switches the team's key for an outside alert service; the key is never answered"),
    fields: { accepts: ["service","key","on"], requires: ["service"] } },
  claim: { classes: null, mutating: true, weight: "credential", description: localize("credentials.declared.claim", "claims an instance at bootstrap"),
    fields: { accepts: ["password","handle"], requires: ["password"] } },
  login: { classes: null, mutating: false, weight: "read", description: "act.login.does",
    fields: { accepts: ["handle","password","ttlSeconds","device"], requires: ["handle","password"] } },
  passwordreset: { classes: null, mutating: true, weight: "credential", description: localize("credentials.declared.passwordreset", "credential: a reset link and a new password, reached with no session; moves no bundle"),
    fields: { accepts: ["link","password"], requires: ["link","password"] } },
  passwordresetlink: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.passwordresetlink", "credential: an administrator's reset link for one member, answered once; moves no bundle"),
    fields: { accepts: ["member"], requires: ["member"] } },
  reauth: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.reauth", "session-directed: the caller's own session, its password asked again for five minutes; moves no bundle"),
    fields: { accepts: ["password"], requires: ["password"] } },
  recover: { classes: null, mutating: true, weight: "credential", description: localize("credentials.declared.recover", "credential: a recovery code and a new password, reached with no session; moves no bundle"),
    fields: { accepts: ["handle","code","password"], requires: ["handle","code","password"] } },
  recoverycodesissue: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.recoverycodesissue", "credential: an administrator's own recovery codes, shown once; moves no bundle"),
    fields: { accepts: [], requires: [] } },
  securitymap: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: "act.securitymap.does",
    fields: { accepts: ["from","to"], requires: ["from","to"] } },
  setpassword: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("credentials.declared.setpassword", "session-directed: the caller's own password, the role from their session; ends their other sessions; moves no bundle"),
    fields: { accepts: ["current","password"], requires: ["current","password"] } },
  signeradd: { classes: ["admin","member","probe"], machineClasses: ["admin","probe"], mutating: true, weight: "credential", description: localize("credentials.declared.signeradd", "signer governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)"),
    fields: { accepts: ["keyB64","memberId","comment"], requires: ["keyB64","memberId"] } },
  signerregisterown: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.signerregisterown", "signer governance: a member registers their own signing key, stamped `by` from their session, and every administrator is told; the subject is a key, not a bundle"),
    fields: { accepts: ["keyB64","comment"], requires: ["keyB64"] } },
  signerrevokeown: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.signerrevokeown", "signer governance: a member revokes their own signing key, stamped `by` from their session; the subject is a key, not a bundle"),
    fields: { accepts: ["keyB64"], requires: ["keyB64"] } },
  signerknown: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "reversible", description: localize("credentials.declared.signerknown", "signer governance: an administrator says they know about a member's self-registered signing key, stamped `by` from their session; it records who and when and changes nothing else; the subject is a key, not a bundle"),
    fields: { accepts: ["keyB64"], requires: ["keyB64"] } },
  signerset: { classes: ["admin","member","probe"], machineClasses: ["admin","probe"], mutating: true, weight: "credential", description: localize("credentials.declared.signerset", "signer governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)"),
    fields: { accepts: ["keyB64","status"], requires: ["keyB64","status"] } },
  signout: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("credentials.declared.signout", "session-directed: ends the caller's own session, or every session of the caller's role; moves no bundle"),
    fields: { accepts: [], requires: [] } },
  signouteverywhere: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("credentials.declared.signouteverywhere", "session-directed: ends the caller's own session, or every session of the caller's role; moves no bundle"),
    fields: { accepts: [], requires: [] } },
  unlock: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("credentials.declared.unlock", "session-directed: the caller's own locked session, cleared with their password; moves no bundle"),
    fields: { accepts: ["password"], requires: ["password"] } },
});
