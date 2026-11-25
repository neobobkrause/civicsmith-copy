/* ai-accounts — the AI accounts the assistant's use is paid by, sealed at rest, and the choice of the one an act uses:
 * a member's own (an API key, or her Claude sign-in's token), a project's, and the group's API key; each account's
 * switch for every kind of use; the material limits that keep the group's or a project's material away from AI; the
 * notices and the disclosure owed before an account pays; and each account's change history. Claude is today's only
 * provider. Who the members are is `membership`'s; what a person signs in with, and the grant an ask reads under, are
 * `credentials`'.
 *
 * Requirements: build/requirements/ai-accounts.md (R1–R34). Split from `credentials` by copy (T48-10; N996, K617, K624,
 * K3101; `build/extraction/credentials-split.md` §2): the code below is credentials' as it stood at T48's START, with
 * no refusal text, code, number or translation changed and the seal byte-identical (HKDF salt and info
 * `bio-credentials-seal/1`, AAD `owner|kind`), so every row sealed before opens; the table names and columns are
 * unchanged, so a running store keeps its rows. Its R1–R23 are credentials' R22–R25, R33–R37, R54, R56, R58, R59,
 * R55, R60–R62, R43, R70, R51, R52, R57 and R64, renumbered; R24–R33 are the split's seams and its shares of
 * credentials' invariants; R34 is T48's one addition (`aiKeptAway` never answers AI_KEPT_AWAY without its row, and
 * `KEPT_AWAY_UNREADABLE`). Two acts change at the seam (map §1, §3): the ask grants and run credentials that end when
 * a reference is removed or a sign-in cleared are credentials', so this module tells them through `onAccountCleared`
 * (R26) instead of writing credentials' tables; and `#retiredReferences` no longer deletes grants (map doubt 5).
 *
 * SHAPE (K61). `aiAccountsOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`,
 * reaching record-core by `recordOf(ctx)` and membership by `membershipOf(ctx)` on the same `ctx`; credentials'
 * factory creates it with the Worker's seal secret (`sealSecret`, R24, R32), and a test may pass its own
 * `{record, membership, sealSecret}`, read on the first call only. Its first construction is this module's start: it
 * registers its revocation listener with membership (R27). It reads only record-grammar, record-core and membership,
 * and membership only through its services, never by SQL. Every refusal names its reason; no service throws. */
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { Membership, membershipOf, notAnAdmin, noSuchProject, notTheOwner, listenerRefusal }
  from "../membership/index.mjs";
import { AI_ACCOUNTS_SCHEMA, AI_ACCOUNTS_ADDITIVE_COLUMNS, AI_ACCOUNTS_TABLES, AI_ACCOUNTS_PROJECT_TABLES,
         AI_ACCOUNTS_HISTORY_TABLE } from "./schema.mjs";
export { AI_ACCOUNTS_TABLES, AI_ACCOUNTS_PROJECT_TABLES, AI_ACCOUNTS_HISTORY_TABLE } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { AI_ACCOUNT_CHECKS, AI_WORDS } from "./checks.mjs";
export { AI_ACCOUNT_CHECKS, AI_WORDS } from "./checks.mjs";

/** @typedef {Object<string, *>} Open a record; a field it does not name reads as absent */
/**
 * @typedef {Object} RefusalFields the fields every refusal this module mints carries (DEC-49, R33)
 * @property {false} ok
 * @property {string} reason the refusal's code
 * @property {string} code the same code
 * @property {string} check its row's check id in C-29, such as `C-29.14`
 * @property {string} translation its row's member-facing words, read by key from setup-words
 * @property {string} detail one fixed sentence saying why
 */
/**
 * @typedef {RefusalFields & Object<string, *>} Refusal an answer that refuses; the fields it names beside these
 *   (`member`, `project`, `use`, `whose`, `switch`, `values`, `keep_away`, `disclosure` and the like) are read by its code
 * @bound a refusal writes nothing and uses nothing
 */
/**
 * @typedef {Object} AiAct an act an account may serve (R3, R11)
 * @property {*} kind one of `USE_KINDS` other than `explore`
 * @property {*} member the member whose act it is, `member:<id>` or a bare id
 * @property {*} [project] the project the act is in, when it is in one
 */
/**
 * @typedef {Object} Uses an account's switch for each kind of use, and `suggestions` (R14)
 * @property {boolean} ask
 * @property {boolean} draft
 * @property {boolean} run
 * @property {boolean} standing
 * @property {string} explore `no`, `ask` or `yes`
 * @property {boolean} enquire
 * @property {boolean} read
 * @property {boolean} transcribe
 * @property {boolean} account
 * @property {boolean} suggestions
 */
/**
 * @typedef {Object} AccountUses one account's switches, held or not (R15, R17)
 * @property {boolean | null} held null when it could not be read
 * @property {Uses | null} uses null when no account is held or it could not be read
 */
/**
 * @typedef {Object} UsesAnswerFields one account's uses (R15, R17)
 * @property {true} ok
 * @property {*} owner the owner as asked, null when it was not a string
 * @property {boolean | null} held
 * @property {Uses | null} uses
 * @property {*} [kind] a project's account only: `apikey` or `signin`, null when none is held
 * @property {{reference: AccountUses, signin: AccountUses}} [accounts] `member:<id>` only: each of her two accounts
 * @property {true} [unreadable] when the store could not be read
 */
/** @typedef {UsesAnswerFields & Open} UsesAnswer */
/**
 * @typedef {Object} AccountServedFields the account that serves one act, for the one call it serves (R7, R11, R19)
 * @property {true} ok
 * @property {*} kind `apikey` or `signin`
 * @property {string} level `member`, `project` or `group`
 * @property {string} key the unsealed key or held token, kept by no caller
 * @property {*} [project] level `project` only
 * @property {*} [member] a sign-in's member
 */
/** @typedef {AccountServedFields & Open} AccountServed */
/**
 * @typedef {Object} KeepAway who kept material away, and why, as the latest set stands (R21, R22)
 * @property {string | null} reason the setter's own words, null when none was given or when it could not be read
 * @property {string | null} set_by
 * @property {string | null} set_at
 */
/**
 * @typedef {Object} Limit a material limit as it stands (R21, R22)
 * @property {boolean | null} on null when it could not be read
 * @property {string[] | null} uses the kinds of use it covers; every kind when none was named; null when it could not be read
 * @property {string | null} reason
 * @property {string | null} set_by
 * @property {string | null} set_at
 */
/**
 * @typedef {Object} RegisteredFields a registration taken (R23, R26)
 * @property {true} ok
 * @property {*} module the module named
 */
/** @typedef {RegisteredFields & Open} Registered */
/**
 * @typedef {Object} AccountCleared what a listener of `onAccountCleared` is told (R26)
 * @property {string} member the member's id
 * @property {string} account `reference` or `signin`
 * @property {string | null} by the acting caller, null when Anthropic refused the token
 * @property {string} why `removed`, `disconnected`, `revoked` or `refused`
 * @property {boolean} reference_held whether a reference of the member's still serves her
 */

/* R1 (K1502, K1547): the kind of a member's own Claude account reference: `apikey` (the member's own API key), held,
   sealed and used for that member alone. (T38; N708's remainder, K2200) `subscription`, a stored `claude setup-token`
   token, is retired: a member's subscription is reached through the hosted Claude Code's own sign-in (R18, R7), never
   a stored token, and a reference of that kind stored before T38 is removed at `migrate`. The group's own key is an API
   key only (R5). */
/** @type {readonly string[]} the kinds of reference a member holds: `apikey` alone (R1) */
export const ACCOUNT_KINDS = Object.freeze(["apikey"]);
/* R4, R9 (K1479, K1500): the two switches, a member's reference's and the group key's alike. (T40) Two of R14's;
   (T41; DEC-188 (8)) set only by `accountUsesSet`, R4's and R9's own acts retired. */
/** @type {readonly string[]} R4's and R9's two switches, `suggestions` and `standing` */
export const ACCOUNT_SWITCHES = Object.freeze(["suggestions", "standing"]);
/* R14 (T40; N812, D34, B2): the kinds of use. Every account holds a switch for each, `explore` holding one of
   `EXPLORE_VALUES` (B6, K2350), plus `suggestions` (K1479); `USE_SWITCHES` names them all. An act served by an account
   is of any kind but `explore` (R3, R11). Defaults: ask, draft and run on; standing and suggestions off; explore no.
   (T41; D2, D19, D21, D56) Four kinds added, each a member's own act or a run she starts, on by default as ask, draft
   and run: `enquire` (the interview and planning), `read` (reading inside documents), `transcribe` (transcribing
   picture pages) and `account` (drafting and checking a case's account). */
/**
 * @type {readonly string[]} the kinds of use, in this order (R14)
 * @bound exactly ask, draft, run, standing, explore, enquire, read, transcribe, account
 */
export const USE_KINDS = Object.freeze(["ask", "draft", "run", "standing", "explore", "enquire", "read", "transcribe",
  "account"]);
/** @type {readonly string[]} the values `explore`'s switch takes: `no`, `ask`, `yes` (R14, B6) */
export const EXPLORE_VALUES = Object.freeze(["no", "ask", "yes"]);
/** @type {readonly string[]} every switch an account holds: each of `USE_KINDS`, then `suggestions` (R14) */
export const USE_SWITCHES = Object.freeze([...USE_KINDS, "suggestions"]);
const USE_DEFAULTS = Object.freeze({ ask: true, draft: true, run: true, standing: false, explore: "no", enquire: true,
  read: true, transcribe: true, account: true, suggestions: false });
const ACT_KINDS = Object.freeze(USE_KINDS.filter((k) => k !== "explore"));
/* R20 (DEC-172): the keep-away reason's bounds, in characters. */
/** @type {Readonly<{min: number, max: number}>} a material limit's reason, in characters: 1 to 2,000 (R20) */
export const KEEP_AWAY_REASON = Object.freeze({ min: 1, max: 2000 });
/* R19 (T47; K3060 D10): a held sign-in token's length bounds, in characters. */
/** @type {Readonly<{min: number, max: number}>} a held sign-in token, in characters: 20 to 2,000 (R19) */
export const SIGNIN_TOKEN_LENGTH = Object.freeze({ min: 20, max: 2000 });

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/* A whole-second instant, the record's `…:00Z` spelling; the caller names the instant (R39: the instance clock). */
const stampSecond = (when) => new Date(when).toISOString().replace(/\.\d+Z$/, "Z");

/* The founder's role and member id (membership's `ROOT_ADMIN`). */
const ROOT = Membership.ROOT_ADMIN;

export class AiAccounts {
  /* R39 (fix round 10, STORE-REQUEST #5; K5192): `now` is the instance clock handed in (a function of milliseconds), read
     before the store's environment; `env` is set by `aiAccountsOps` from the store's environment (`BIO_NOW_MS`). */
  /**
   * @param {Object} [args]
   * @param {*} [args.sql] the store's SQL storage, whose `exec(query, ...bindings)` answers the rows
   * @param {*} [args.core] record-core's instance on the same store
   * @param {*} [args.membership] membership's instance on the same store
   * @param {*} [args.sealSecret] the Worker's seal secret; anything but a non-empty string binds none (R24)
   * @param {*} [args.now] the instance clock, a function answering milliseconds (R39)
   */
  constructor({ sql, core = null, membership = null, sealSecret = null, now = null } = {}) {
    /** @type {*} the store's SQL storage */
    this.sql = sql;
    /** @type {*} record-core's instance, null when none was given */
    this.core = core;
    /** @type {*} membership's instance, null when none was given */
    this.membership = membership;
    this.#sealSecret = typeof sealSecret === "string" && sealSecret !== "" ? sealSecret : null;
    /** @type {Function | null} the instance clock handed in, null when none (R39) */
    this.now = typeof now === "function" ? now : null;
    /** @type {*} the store's environment, set by `aiAccountsOps`; its `BIO_NOW_MS` is read for the clock (R39) */
    this.env = null;
  }
  #sealSecret;

  static #enc = new TextEncoder();

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* R39 (fix round 10, K5132's rule, as `credentials`' `#nowMs`): the instance clock. A handed `now` answers first, else
     the store's `env.BIO_NOW_MS`, else the wall clock. Every instant this module records, and every judgement of one,
     reads it. */
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

  /* The instance clock's instant, as a whole second. */
  #at() { return stampSecond(this.#nowMs()); }

  /* One act as one transaction, through record-core's `transact` (its R32) when the store offers it. */
  #tx(fn) { return typeof this.core?.transact === "function" ? this.core.transact(fn) : fn(); }

  /* ===== START: the seam with membership =====
   *
   * R27 (credentials R16's share): one listener on membership's revocation notice (its R79). Each time a member becomes
   * `revoked`, their sign-in, its token and their projects' sign-in accounts are cleared inside the revoking act (the
   * notice is called after the act's writes, in the caller's transaction), each a change (R16), each told through
   * R26. Membership ignores a listener's answer and survives its throw; registered once (a second registration is
   * refused through membership's R81, so `start` is idempotent through `aiAccountsOf`). */
  /**
   * R27: registers this module's one listener on membership's revocation notice.
   * @returns {{revoked: *} & Open} membership's answer to the registration, as it gave it
   */
  start() {
    const revoked = this.membership.onRevoked("ai-accounts", (notice) => this.#memberRevoked(notice));
    return { revoked };
  }

  #memberRevoked({ memberId, by = null } = {}) {
    if (typeof memberId !== "string" || memberId === "") return;
    this.#signinCleared(memberId, by, "revoked");
  }

  /* This module's tables, at every boot, idempotent: the additive columns an older store lacks, then every table and
     index created if absent, then the retired references removed and the history carried, then R28's declarations.
     Run by the host inside its boot, before credentials' own (map §3). */
  /**
   * R28: this module's tables made and declared, at every boot; idempotent.
   * @returns {void}
   * @throws {Error} when record-core refuses the tables' declaration, as `declareTables`
   */
  migrate() {
    const cols = (t) => [...this.sql.exec(`PRAGMA table_info(${t})`)].map((r) => r.name);
    for (const [table, column, decl] of AI_ACCOUNTS_ADDITIVE_COLUMNS) {
      const have = cols(table);
      if (have.length && !have.includes(column)) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
    const bare = AI_ACCOUNTS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    this.#tx(() => this.#retiredReferences());
    this.#tx(() => this.#carryHistory());
    this.declareTables();
  }

  /* R1, R7 (T38; N708's remainder, K2200): a reference of a kind no longer held (`subscription`, a stored token) is
     never answered, and is removed here. The member's `accountReferenceState` then shows none (R2). A later boot finds
     none to remove. (T48; map doubt 5) The standing grants credentials deleted beside it are credentials' table, which
     this module never writes; a standing grant lives `AI_GRANT_TTL_SECONDS` (900 s), so none from T38 survives. */
  #retiredReferences() {
    const kinds = ACCOUNT_KINDS.map(() => "?").join(",");
    this.sql.exec(`DELETE FROM account_references WHERE kind NOT IN (${kinds})`, ...ACCOUNT_KINDS);
  }

  /* R28, R29, through record-core's `declareTable` (its R21): every table declared explicitly with its classes. A
     refusal is thrown: a purge that silently cleared an account would end a member's assistant as a side effect of
     resetting the corpus, and an export that carried a key would publish it. */
  /**
   * R28, R29: every table declared with record-core once per instance.
   * @returns {boolean} true when declared by this call, false when already declared
   * @throws {Error} when record-core refuses the declaration, naming its reason and table
   */
  declareTables() {
    if (this.#declared) return false;
    const answer = this.core.declareTable("ai-accounts",
      [...AI_ACCOUNTS_TABLES, ...AI_ACCOUNTS_PROJECT_TABLES, AI_ACCOUNTS_HISTORY_TABLE]
        .map((t) => ({ ...t, ...(t.keys ? { keys: [...t.keys] } : {}) })));
    if (answer && answer.ok === false)
      throw new Error(`ai-accounts: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }
  #declared = false;

  /* R1, R19, R31 (T47; K3069, C5): whether `id` holds as an active member: an active member of the roster, or the
     founder (`admin`) once the instance is claimed, who holds no member row; the claim read as membership's R64
     answers it (the fact credentials registers, membership R94). */
  #holderActive(id) {
    if (id === ROOT) { try { return this.membership.isAdministrator(ROOT) === true; } catch { return false; } }
    return this.#memberFacts(id)?.status === "active";
  }

  /* membership R68: a member's standing, or null. Never throws here: an unreadable answer is no member. */
  #memberFacts(memberId) {
    if (typeof memberId !== "string" || memberId === "") return null;
    try { return this.membership.memberFacts(memberId) || null; } catch { return null; }
  }

  #adminBar(by, act) {
    const who = AiAccounts.#memberOf(by);
    return who !== null && !isMachineIdentity(by) && this.membership.isAdministrator(who) ? null : notAnAdmin(by ?? null, act);
  }

  /* ===== EACH MEMBER'S OWN CLAUDE ACCOUNT (R1–R4; T33-20, K1502, K1503) =====
   *
   * A member who wants the assistant may bring their own account: an API key, held only by the member's own act, SEALED at rest under that member (R2), and never shown, listed, logged or exported: no answer
   * below carries the secret or a digest of it, except R3's and R7's, which unseal it for the one call they serve.
   * The group's own API key, set by an administrator, serves members who hold none while it is on (R5–R9; K1755). */

  /* The member an actor or viewer names: `member:<id>` or a bare member id; null for anything else. */
  static #memberOf(x) {
    if (typeof x !== "string") return null;
    const id = x.startsWith("member:") ? x.slice(7) : x;
    return id !== "" ? id : null;
  }

  /**
   * @param {*} table
   * @param {string} code
   * @param {string} detail
   * @param {Object<string, *> | null} [extra]
   * @returns {Refusal}
   */
  static #row(table, code, detail, extra) {
    const r = table[code];
    return { ok: false, reason: code, code, check: r.check, translation: r.translation, detail, ...(extra || {}) };
  }

  /* R1: who may act on `member`'s reference, asked first by every act on it, by the grant's mint (`credentials` R27) and by the
     notice's acknowledgement (R8). Answers null when `by` is that member's own act and the member is active. A
     `member` naming no member of the roster ('organisation', a project, a machine class) is refused as any principal
     but the acting member is: NOT_YOUR_ACCOUNT, or ACCOUNT_MEMBER_NOT_ACTIVE when it names the actor themself (K1756). */
  #accountBar(member, by) {
    const refuse = (code, detail) => AiAccounts.#row(AI_ACCOUNT_CHECKS, code, detail);
    /* DEC-49 REGION is-account-own-act */
    if (by === null || by === undefined || by === "" || isMachineIdentity(by))
      return refuse("MACHINE_CANNOT_HOLD_ACCOUNT", localize("ai-accounts.index.a_members_claude_account_is", "a member's Claude account is held only by that member's own act, from their own signed-in session; this caller has no member behind it. Nothing was written."));
    const id = AiAccounts.#memberOf(member);
    if (id === null || AiAccounts.#memberOf(by) !== id)
      return AiAccounts.#notYours("a member's Claude account is acted on only by that member; another member, an "
        + "administrator or the founder cannot. Nothing was written.");
    if (!this.#holderActive(id))   /* (T47; R19) the claimed founder holds as a member does */
      return refuse("ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.only_an_active_member_holds", "only an active member holds a Claude account reference. Nothing was written."));
    /* END DEC-49 REGION is-account-own-act */
    return null;
  }

  /* R1–R3, `credentials` R27, R7: NOT_YOUR_ACCOUNT, minted here alone; `detail` is the asking act's fixed sentence. */
  static #notYours(detail) {
    /* DEC-49 REGION is-account-theirs */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "NOT_YOUR_ACCOUNT", detail);
    /* END DEC-49 REGION is-account-theirs */
  }

  /* R3, R4, `credentials` R27, `credentials` R32, R7: no account serves this member (R7's last branch), or, for R3 and R4 (`own`), the
     member holds no reference of their own; (T40; R14) for `accountUsesSet`, the owner named holds no account
     (`member`: neither a reference nor a sign-in; `project`: the project holds none). */
  #noAccount(member, scope = "served") {
    /* DEC-49 REGION is-account-held */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "NO_ACCOUNT", scope === true || scope === "own"
      ? localize("ai-accounts.index.this_member_holds_no_claude", "this member holds no Claude account reference of their own. Nothing was used or written.")
      : scope === "member" ? localize("ai-accounts.index.this_member_holds_no_claude_key", "this member holds no Claude account of their own: no key and no connected sign-in. Nothing was written.")
      : scope === "project" ? localize("ai-accounts.index.this_project_holds_no_claude", "this project holds no Claude account. Nothing was written.")
      : localize("ai-accounts.index.no_claude_account_serves_this", "no Claude account serves this member: they hold no reference of their own, they are not connected through their subscription, and the team's key is not held or not on, so there is no assistant for them. Nothing was used."), { member });
    /* END DEC-49 REGION is-account-held */
  }

  /* R1, R5: an empty key or token, refused before anything is sealed. */
  static #noSecret(secret) {
    /* DEC-49 REGION is-secret-given */
    if (typeof secret !== "string" || secret.trim() === "")
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "NO_SECRET", localize("ai-accounts.index.no_key_or_token_was", "no key or token was given. Nothing was written."));
    return null;
    /* END DEC-49 REGION is-secret-given */
  }

  /* R14: every switch an account holds, for `accountUsesSet` (T41: R4's and R9's own acts retired into it). */
  static #switchName(name, names = USE_SWITCHES) {
    /* DEC-49 REGION is-account-switch */
    /* (T51; K4206) a request that names no switch is refused naming it, as an unknown name is */
    if (name === null || name === undefined)
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "UNKNOWN_SWITCH", localize("ai-accounts.index.the_request_names_no_switch", "the request names no switch; the switches are {names}. Nothing was written.", { names: String(names.join(", ")) }), { switch: null });
    if (typeof name !== "string" || !names.includes(name))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "UNKNOWN_SWITCH", localize("ai-accounts.index.the_switches_are_names_nothing", "the switches are {names}. Nothing was written.", { names: String(names.join(", ")) }), { switch: typeof name === "string" ? name.slice(0, 40) : null });
    return null;
    /* END DEC-49 REGION is-account-switch */
  }

  /* ===== EVERY ACCOUNT'S SWITCHES (R14; T40, N812, D34, B2, B6, K2350) =====
   *
   * Each account (a member's reference, a member's sign-in, a project's account and the group key) holds a switch for
   * each kind of use but `explore`, which holds `no`, `ask` or `yes`, and `suggestions`. R4's and R9's two switches
   * are two of them, stored where they were. A value outside what a switch takes is refused SWITCH_VALUE_INVALID,
   * naming the values; only R5's and R10's on/off of the key itself keep "only `true` is on". */
  static #USE_COLUMN = Object.freeze({ ask: "use_ask", draft: "use_draft", run: "use_run", standing: "standing",
                                       explore: "explore", enquire: "use_enquire", read: "use_read",
                                       transcribe: "use_transcribe", account: "use_account", suggestions: "suggestions" });
  static #USES_COLUMNS = USE_SWITCHES.map((k) => AiAccounts.#USE_COLUMN[k]).join(", ");

  /* An account's switches from its row, as R14 names them, in USE_SWITCHES' order. */
  /**
   * @param {*} r
   * @returns {Uses}
   */
  static #usesOf(r) {
    return /** @type {Uses} builds a Uses: one entry for each of USE_SWITCHES */ (Object.fromEntries(USE_SWITCHES.map((k) => [k, k === "explore"
      ? (EXPLORE_VALUES.includes(r?.explore) ? r.explore : "no") : !!r?.[AiAccounts.#USE_COLUMN[k]]])));
  }

  /* R14, R22: SWITCH_VALUE_INVALID, minted here alone: `what` and the values it takes. */
  static #valueInvalid(what, values, extra) {
    /* DEC-49 REGION is-switch-value */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SWITCH_VALUE_INVALID", localize("ai-accounts.index.what_takes_map_nothing_was", "{what} takes {map}. Nothing was changed.", { what: String(what), map: String(values.map(String).join(", ")) }), { values: [...values], ...(extra || {}) });
    /* END DEC-49 REGION is-switch-value */
  }

  /* R14: `explore` one of EXPLORE_VALUES; any other switch a boolean. */
  static #switchValueFault(name, on) {
    /* (T51; K4206) a request that gives no `on` is refused naming it, the values the switch takes given as for any other */
    if (on === undefined) {
      const values = name === "explore" ? EXPLORE_VALUES : [true, false];
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SWITCH_VALUE_INVALID", localize("ai-accounts.index.the_request_gives_no_on", "the request gives no on to set; {what} takes {map}. Nothing was changed.", { what: name === "explore" ? "the explore switch" : `the ${name} switch`, map: String(values.map(String).join(", ")) }), { values: [...values], switch: name });
    }
    if (name === "explore") return EXPLORE_VALUES.includes(on) ? null
      : AiAccounts.#valueInvalid("the explore switch", EXPLORE_VALUES, { switch: name });
    return typeof on === "boolean" ? null : AiAccounts.#valueInvalid(`the ${name} switch`, [true, false], { switch: name });
  }

  static #stored(name, on) { return name === "explore" ? on : on ? 1 : 0; }

  /* R11: AI_USE_SWITCHED_OFF, minted here alone: the account the cascade chose holds the act's kind off, and the act
     never moves to the next account (Bob, K2352). `whose` is `project`, `own` or `group`. */
  static #switchedOff(whose, use, project = null) {
    /* DEC-49 REGION is-use-switched-on */
    const name = whose === "project" ? "this project's" : whose === "group" ? "your team's" : "your own";
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "AI_USE_SWITCHED_OFF", localize("ai-accounts.index.the_account_used_for_this", "the account used for this act is {name} Claude account, and its switch for {use} is off; the act does not move to another account. Nothing was used.", { name: String(name), use: String(use) }),
      { whose, use, ...(project !== null ? { project } : {}) });
    /* END DEC-49 REGION is-use-switched-on */
  }

  /* R14 `accountUsesSet`: one switch of one account, by its owner, `owner` spelled as ai-use R1's (`group`,
     `project:<id>`, `member:<id>`). The group key's by an active administrator (R5's refusals; it may be set before a key
     is held, as R9's); a project's by one of its owners (R10's refusals), while it holds an account; a member's own by
     that member (R1's refusals), on the account of theirs that would serve them: their reference when held, else their
     sign-in. Refusals in order: the owner's, UNKNOWN_SWITCH, SWITCH_VALUE_INVALID, NO_ACCOUNT, each writing nothing. */
  /**
   * R14 `op=accountusesset`: one switch of one account set by its owner, a change recorded (R16).
   * @param {Object} [args]
   * @param {*} [args.owner] `group`, `project:<id>` or `member:<id>`
   * @param {*} [args.switch] one of `USE_SWITCHES`
   * @param {*} [args.on] for `explore` one of `EXPLORE_VALUES`, for any other switch a boolean
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, owner: *, switch: *, on: *} & Open) | Refusal} the switch as set, or the owner's refusal (R1's, R10's or
   *   R5's), UNKNOWN_SWITCH, SWITCH_VALUE_INVALID or NO_ACCOUNT, in that order
   * @bound on: `explore` takes no, ask or yes; every other switch true or false
   */
  accountUsesSet({ owner = null, switch: name = null, on, by = null } = {}) {
    const t = this.#usesOwner(owner, by);
    if (t.refusal) return t.refusal;
    const unknown = AiAccounts.#switchName(name, USE_SWITCHES);
    if (unknown) return unknown;
    const bad = AiAccounts.#switchValueFault(name, on);
    if (bad) return bad;
    if (t.none) return t.none;
    this.#tx(() => {
      if (t.ensure) t.ensure();
      this.sql.exec(`UPDATE ${t.table} SET ${AiAccounts.#USE_COLUMN[name]}=? WHERE ${t.where}`, AiAccounts.#stored(name, on),
        ...t.args);
      if (t.act) t.act(name, on);
    });
    return { ok: true, owner, switch: name, on };
  }

  /* The account `owner` names, as `{table, where, args, ensure?, act?}`, `{refusal}` or `{none}`. */
  #usesOwner(owner, by) {
    const said = (v) => (typeof v === "boolean" ? (v ? "on" : "off") : String(v));
    if (owner === "group") {
      const bar = this.#adminBar(by, localize("ai-accounts.index.switching_the_team_keys", "switching the team key's assistant settings"));
      return bar ? { refusal: bar } : { table: "group_key", where: "id=1", args: [],
        ensure: () => this.sql.exec(`INSERT INTO group_key (id) VALUES (1) ON CONFLICT(id) DO NOTHING`),
        act: (n, v) => this.#groupKeyAct(`switch:${n}`, said(v), by) };
    }
    if (typeof owner === "string" && owner.startsWith("project:")) {
      const project = owner.slice(8);
      const bar = this.#projectOwnerBar(project, by, "setting a project's assistant settings");
      if (bar) return { refusal: bar };
      if (!this.#projectAccountRow(project)) return { none: this.#noAccount(null, "project") };
      return { table: "project_accounts", where: "project_id=?", args: [project],
        act: (n, v) => this.#projectAct(project, `uses:${n}`, said(v), by) };
    }
    if (typeof owner === "string" && owner.startsWith("member:")) {
      const bar = this.#accountBar(owner, by);
      if (bar) return { refusal: bar };
      const id = AiAccounts.#memberOf(owner);
      const act = (account) => (n, v) => this.#change(`member:${id}`, "use_set", { account, switch: n, value: v }, by);   /* R16 */
      if (this.#reference(id, "member_id"))
        return { table: "account_references", where: "member_id=?", args: [id], act: act("reference") };
      if (this.#connected(id))
        return { table: "subscription_connections", where: "member_id=?", args: [id], act: act("signin") };
      return { none: this.#noAccount(id, "member") };
    }
    /* no owner this module knows: refused as R1 refuses any principal but the actor; an owner the request does not give
       is refused naming it (T51; K4206), its machine refusal unchanged */
    const bar = /** @type {Refusal} R1's refusal: no member is named, so it always refuses */ (this.#accountBar(null, by));
    if (owner === null && bar.code === "NOT_YOUR_ACCOUNT")
      return { refusal: AiAccounts.#notYours(localize("ai-accounts.index.the_request_names_no_owner", "the request names no owner: the account is group, project:<id> or member:<id>. Nothing was written.")) };
    return { refusal: bar };
  }

  /* R2, `credentials` R29, R6: THE SEAL. AES-256-GCM under a key derived (HKDF-SHA-256) from the Worker's seal secret, the owner as
     salt (`member:<id>`, `group:<service>` or `group-key:anthropic`), so the key is never stored beside the row and no
     other owner's key opens it. The AAD binds the ciphertext to its owner and kind, so a row moved to another owner
     does not open. Answers `{sealed, iv}` (base64), or the refusal when no secret is bound. */
  static #b64(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
  static #unb64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

  async #sealKey(owner) {
    const base = await crypto.subtle.importKey("raw", AiAccounts.#enc.encode(this.#sealSecret), "HKDF", false,
      ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: AiAccounts.#enc.encode(owner),
        info: AiAccounts.#enc.encode("bio-credentials-seal/1") },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  static #sealRefusal(detail) {
    /* DEC-49 REGION is-seal-bound */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_SEAL_UNAVAILABLE", detail);
    /* END DEC-49 REGION is-seal-bound */
  }

  #seal() {
    return this.#sealSecret === null ? AiAccounts.#sealRefusal(localize("ai-accounts.index.your_teams_civicsmith_has_no", "your team's Civicsmith has no seal secret set, so a key cannot be kept sealed or read. Nothing was stored or read.")) : null;
  }

  async #encrypt(owner, kind, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AiAccounts.#enc.encode(`${owner}|${kind}`) },
      await this.#sealKey(owner), AiAccounts.#enc.encode(secret));
    return { sealed: AiAccounts.#b64(new Uint8Array(ct)), iv: AiAccounts.#b64(iv) };
  }

  /* Null when the row does not open (the seal secret changed): the caller answers ACCOUNT_SEAL_UNAVAILABLE. */
  async #decrypt(owner, kind, sealed, iv) {
    try {
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: AiAccounts.#unb64(iv), additionalData: AiAccounts.#enc.encode(`${owner}|${kind}`) },
        await this.#sealKey(owner), AiAccounts.#unb64(sealed));
      return new TextDecoder().decode(pt);
    } catch { return null; }
  }

  /* R1: one reference for `member`, of the one kind (`apikey`; `subscription` refused since T38), replacing any earlier
     one, by that member's own act.
     Answers `{ok, kind, set_at}` and never the secret. A replacement keeps the member's switches (R4); only removal turns them off. */
  /**
   * R1, R2, R23: the member's own reference held, sealed, by that member's own act.
   * @param {{member?: *, kind?: *, secret?: *, by?: *} & Open} [args] a field it does not name (a `level`) is not read;
   *   `member` the member, `kind` one of `ACCOUNT_KINDS`, `secret` the key (a non-blank string), `by` the stamped caller
   * @returns {Promise<({ok: true, kind: *, set_at: string} & Open) | Refusal>} never the secret; or MACHINE_CANNOT_HOLD_ACCOUNT,
   *   NOT_YOUR_ACCOUNT, ACCOUNT_MEMBER_NOT_ACTIVE, UNKNOWN_ACCOUNT_KIND, NO_SECRET, DISCLOSURE_DUE or
   *   ACCOUNT_SEAL_UNAVAILABLE, in that order
   */
  async accountReferenceSet({ member = null, kind = null, secret = null, by = null } = {}) {
    const bar = this.#accountBar(member, by);
    if (bar) return bar;
    /* DEC-49 REGION is-account-kind */
    if (!ACCOUNT_KINDS.includes(kind))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "UNKNOWN_ACCOUNT_KIND", localize("ai-accounts.index.the_kind_your_teams_civicsmith", "the kind your team's Civicsmith holds is {ACCOUNT_KINDS}; a Claude subscription is connected through Claude Code's own sign-in, never held as a token. Nothing was written.", { ACCOUNT_KINDS: String(ACCOUNT_KINDS.join(" and ")) }));
    /* END DEC-49 REGION is-account-kind */
    const empty = AiAccounts.#noSecret(secret);
    if (empty) return empty;
    /* R1 (T47; N981, K231): an API key is held only once the disclosure of what connecting means is recorded for
       her, asked after every refusal above, through R23's one site; `by` is the door's stamp, the form the disclosure
       is recorded under (control-plane R65 asks it so) */
    const due = kind === "apikey" ? this.disclosureDue({ member: by }) : null;
    if (due) return due;
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const id = AiAccounts.#memberOf(member);
    const { sealed, iv } = await this.#encrypt(`member:${id}`, kind, secret);
    const setAt = this.#at();
    this.#tx(() => {
      this.sql.exec(
        `INSERT INTO account_references (member_id, kind, sealed, iv, set_at) VALUES (?,?,?,?,?)
         ON CONFLICT(member_id) DO UPDATE SET kind=excluded.kind, sealed=excluded.sealed, iv=excluded.iv,
           set_at=excluded.set_at`, id, kind, sealed, iv, setAt);
      this.#change(`member:${id}`, "key_set", { account: "reference", kind }, by, null, setAt);   /* R16 */
    });
    return { ok: true, kind, set_at: setAt };
  }

  /* ===== THE DISCLOSURE-FIRST ORDER (R23; T47, N981; K231, K3027, K3030) =====
   *
   * Before a member's own account is connected she is shown what connecting means, and `instance-setup` (its R54)
   * records that it was shown. That record is a later module's, so this module cannot read it: one later module
   * (instance-setup, or the composition root on its behalf) registers, once at start, its `disclosureOf`, and
   * `disclosureDue` asks it. This is the one site that mints DISCLOSURE_DUE (K231): R1 refuses through it, and
   * control-plane R65's refusal of a sign-in's `start` answers through it. Fail closed: anything but `shown: true`, a
   * throw, or an answer that is not one (a promise among them) is the refusal. With none registered nothing is asked
   * and nothing is held (a module test with no instance-setup). */
  #disclosureSource = null;   // {module, fn}

  /* R23: one registration, whoever makes it; its refusals are membership's R81, naming the holder. */
  /**
   * R23: the one read of whether a member was shown the disclosure, registered once.
   * @param {*} module the registering module's name
   * @param {*} fn `fn({member})`, answering `{shown: true}` once the disclosure was shown
   * @returns {Registered | *} the registration, or membership's LISTENER_MALFORMED or LISTENER_DECLARED (its R81)
   */
  registerDisclosureRead(module, fn) {
    const refused = listenerRefusal(this.#disclosureSource, module, fn);
    if (refused) return refused;
    this.#disclosureSource = { module, fn };
    return { ok: true, module };
  }

  /* R23: an in-plane read, reached by no route and answered to no viewer: null when the registered read answers
     `shown: true` for `member` (or none is registered), else the one DISCLOSURE_DUE refusal. Writes nothing; never
     throws. */
  /**
   * R23: in-plane; whether the disclosure is due for `member`.
   * @param {Object} [args]
   * @param {*} [args.member] the member, as the door stamps her
   * @returns {Refusal | null} null when shown or none is registered; else DISCLOSURE_DUE, carrying `member`
   */
  disclosureDue({ member = null } = {}) {
    const source = this.#disclosureSource;
    if (source === null) return null;
    let shown = false;
    try {
      const a = source.fn({ member });
      shown = !!a && typeof a === "object" && typeof a.then !== "function" && a.shown === true;
    } catch { shown = false; }
    if (shown) return null;
    /* DEC-49 REGION is-disclosure-shown */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "DISCLOSURE_DUE", localize("ai-accounts.index.you_have_not_yet_been", "you have not yet been shown what connecting your own Claude account means, so nothing was connected or sent. Read it, then try again."),
      { member: typeof member === "string" ? member : null });
    /* END DEC-49 REGION is-disclosure-shown */
  }

  /* R1, R4, R26: the member removes their reference, which turns both switches off; with none, `removed: false`. In the
     same act R26's listeners are told (`credentials` R73 ends every standing question's grant minted for her, its R32),
     as credentials' own removal ended them, whether or not a reference was held. */
  /**
   * R1, R4, R26: the member's own reference removed, by her own act; her listeners told.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, removed: boolean} & Open) | Refusal} `removed` false when none was held; or R1's refusals
   */
  accountReferenceRemove({ member = null, by = null } = {}) {
    const bar = this.#accountBar(member, by);
    if (bar) return bar;
    const id = AiAccounts.#memberOf(member);
    const held = !!this.#one(`SELECT member_id FROM account_references WHERE member_id=?`, id);
    this.#tx(() => {
      if (held) {
        this.sql.exec(`DELETE FROM account_references WHERE member_id=?`, id);
        this.#change(`member:${id}`, "removed", { account: "reference" }, by);   /* R16 */
      }
      this.#cleared({ member: id, account: "reference", by: by ?? null, why: "removed", reference_held: false });   /* R26 */
    });
    return { ok: true, removed: held };
  }

  /* R2: what the member may read back of their own reference, to them alone; never the secret. */
  /**
   * R2, R14, R18, R19: the member's own reference and sign-in, to her alone; never a secret or token.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.viewer] the stamped viewer; only the member herself
   * @returns {({ok: true, held: boolean, kind: *, set_at: *, suggestions: boolean, standing: boolean, uses: Uses | null,
   *   subscription: {connected: boolean, since: *, held: boolean, valid_until?: *, refused_at?: *, uses: Uses | null}}
   *   & Open) | Refusal} or NOT_YOUR_ACCOUNT to anyone else
   */
  accountReferenceState({ member = null, viewer = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    if (id === null || typeof member !== "string" || AiAccounts.#memberOf(viewer) !== id || isMachineIdentity(viewer))
      return AiAccounts.#notYours("a member's Claude account is seen only by that "
        + "member. Nothing was read.");
    const r = this.#reference(id, `kind, set_at, ${AiAccounts.#USES_COLUMNS}`);
    const row = this.#one(`SELECT since, sealed, valid_until, refused_at, ${AiAccounts.#USES_COLUMNS}
                           FROM subscription_connections WHERE member_id=?`, id);
    const sub = row && row.sealed ? row : null;   /* R19: connected only while a token is held */
    return { ok: true, held: !!r, kind: r ? r.kind : null, set_at: r ? r.set_at : null,
             suggestions: !!(r && r.suggestions), standing: !!(r && r.standing),
             /* R14 (T40): every switch of the reference, null when none is held */
             uses: r ? AiAccounts.#usesOf(r) : null,
             /* R18: whether the member is connected through their own subscription, and since when; never a login;
                (T40, R14) the sign-in's own switches, null when not connected; (T47; R19) whether its token is held,
                until when the binary said it lasts, and when Anthropic refused it, each only when known */
             subscription: { connected: !!sub, since: sub ? sub.since : null, held: !!sub,
                             ...(sub && sub.valid_until ? { valid_until: sub.valid_until } : {}),
                             ...(row && row.refused_at && !sub ? { refused_at: row.refused_at } : {}),
                             uses: sub ? AiAccounts.#usesOf(sub) : null } };
  }

  /* ===== EACH ACCOUNT'S CHANGES (R16; T41, DEC-188 (1)) =====
   *
   * Every change to an account's settings is recorded in `account_changes`, in the order made, with who made it and
   * when, never the key or a digest of it: a key or sign-in set or replaced, the account switched, removed, one use's
   * switch set, and a material limit set. Only an accepted change writes one; a refusal or a read never does. The
   * records R5, R20, R10 and R22 kept before T41 (`group_key_acts`, `ai_keep_away`, `project_account_acts`,
   * `project_keep_away`) are carried into it once, in the order they were made, each naming its origin, so nothing is
   * back-filled and nothing carried twice; those tables are still written, each row with its change beside it. */

  static #ownerOfProject(project) { return `project:${project}`; }

  /* One change, in the caller's act. `origin` names the earlier record written beside it, or null. */
  #change(owner, change, detail, by, origin = null, at = this.#at()) {
    const project = owner.startsWith("project:") ? owner.slice(8) : null;
    this.sql.exec(`INSERT OR IGNORE INTO account_changes (owner, project_id, at, by, change, detail, origin)
                   VALUES (?,?,?,?,?,?,?)`, owner, project, at, AiAccounts.#memberOf(by), change,
      detail ? JSON.stringify(detail) : null, origin);
  }

  #lastSeq() { return Number(this.#one(`SELECT last_insert_rowid() AS id`)?.id ?? 0); }

  /* R5's acts on the group key and R10's on a project's account, as R16 names them. */
  static #legacyChange(act, detail) {
    if (act === "set") return ["key_set", { kind: "apikey" }];
    if (act === "setkey") return ["key_set", { kind: "apikey" }];
    if (act === "setsignin") return ["signin_set", {}];
    if (act === "remove") return ["removed", {}];
    if (act === "switch") return ["switched", { on: detail === "on" }];
    const m = /^(?:switch|uses):(.+)$/.exec(act);
    if (m) return ["use_set", { switch: m[1],
      value: detail === "on" ? true : detail === "off" ? false : detail }];
    return [act, detail === null || detail === undefined ? {} : { detail }];
  }

  static #limitDetail(r) { return { on: !!r.is_on, uses: AiAccounts.#usesList(r.uses), reason: r.reason ?? null }; }

  /* migrate: the records kept before T41 not yet carried, in the order made (instant, then the order each table kept
     them). A later boot finds none. */
  #carryHistory() {
    const have = (t) => this.#rows(`PRAGMA table_info(${t})`).length > 0;
    const out = [];
    if (have("group_key_acts"))
      for (const r of this.#rows(`SELECT seq, act, detail, actor, at FROM group_key_acts ORDER BY seq`))
        out.push({ owner: "group", at: r.at, by: r.actor, rank: 0, seq: r.seq, origin: `group_key_acts:${r.seq}`,
                   cd: AiAccounts.#legacyChange(r.act, r.detail) });
    if (have("ai_keep_away"))
      for (const r of this.#rows(`SELECT seq, is_on, uses, reason, set_by, set_at FROM ai_keep_away ORDER BY seq`))
        out.push({ owner: "group", at: r.set_at, by: r.set_by, rank: 1, seq: r.seq, origin: `ai_keep_away:${r.seq}`,
                   cd: ["limit_set", AiAccounts.#limitDetail(r)] });
    if (have("project_account_acts"))
      for (const r of this.#rows(`SELECT seq, project_id, act, detail, actor, at FROM project_account_acts ORDER BY seq`))
        out.push({ owner: AiAccounts.#ownerOfProject(r.project_id), at: r.at, by: r.actor, rank: 2, seq: r.seq,
                   origin: `project_account_acts:${r.seq}`, cd: AiAccounts.#legacyChange(r.act, r.detail) });
    if (have("project_keep_away"))
      for (const r of this.#rows(`SELECT seq, project_id, is_on, uses, reason, set_by, set_at FROM project_keep_away ORDER BY seq`))
        out.push({ owner: AiAccounts.#ownerOfProject(r.project_id), at: r.set_at, by: r.set_by, rank: 3, seq: r.seq,
                   origin: `project_keep_away:${r.seq}`, cd: ["limit_set", AiAccounts.#limitDetail(r)] });
    const carried = new Set(this.#rows(`SELECT origin FROM account_changes WHERE origin IS NOT NULL`).map((r) => r.origin));
    out.filter((x) => !carried.has(x.origin))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.rank - b.rank || a.seq - b.seq))
      .forEach((x) => this.#change(x.owner, x.cd[0], x.cd[1], x.by, x.origin, x.at));
  }

  /* R18, R27, R10: a member's sign-in cleared (their own disconnection, or their revocation), with every project's
     sign-in account that was theirs; each a change of its account (R16). R26's listeners are told of a sign-in held
     and cleared, with whether a reference of hers still serves her: `credentials` R73 revokes her run segments'
     credentials (its R63) and, when no reference serves her, ends the standing grants her sign-in served (its R32), as
     credentials' own clearing did. */
  #signinCleared(id, by, why) {
    const held = !!this.#one(`SELECT member_id FROM subscription_connections WHERE member_id=?`, id);
    if (held) {
      this.sql.exec(`DELETE FROM subscription_connections WHERE member_id=?`, id);
      this.#change(`member:${id}`, "removed", { account: "signin", why }, by);
      this.#cleared({ member: id, account: "signin", by: by ?? null, why,
                      reference_held: !!this.#reference(id, "member_id") });   /* R26 */
    }
    this.#projectSigninsCleared(id, by);
    return held;
  }

  /* R10, R31 (4): every project's sign-in account that is `id`'s, cleared with her sign-in; each a change (R16). */
  #projectSigninsCleared(id, by) {
    for (const p of this.#rows(`SELECT project_id FROM project_accounts WHERE kind='signin' AND member_id=?`, id)) {
      this.sql.exec(`DELETE FROM project_accounts WHERE project_id=?`, p.project_id);
      this.#change(AiAccounts.#ownerOfProject(p.project_id), "removed", { kind: "signin", member: id, why: "signin_cleared" }, by);
    }
  }

  /* R15, R16: the owners of the account `owner` names are those R14 lets set its switches; anyone else is refused as
     R14 refuses them. Null when `viewer` is one of them. */
  #ownerBar(owner, viewer) {
    if (owner === "group") return this.#adminBar(viewer, localize("ai-accounts.index.reading_the_team_keys_assistant", "reading the team key's assistant settings"));
    if (typeof owner === "string" && owner.startsWith("project:"))
      return this.#projectOwnerBar(owner.slice(8), viewer, "reading a project's assistant settings");
    if (typeof owner === "string" && owner.startsWith("member:")) return this.#accountBar(owner, viewer);
    return this.#accountBar(null, viewer);
  }

  /* R22, R15: every material limit that can bind the account, on or off: the group's, and a project's own for its
     account. */
  #limitsFor(owner) {
    const g = this.aiKeepAwayState();
    const out = [{ scope: "group", on: g.on, uses: g.uses, reason: g.reason, set_by: g.set_by, set_at: g.set_at }];
    if (owner.startsWith("project:")) {
      let lim;
      try { lim = this.#projectLimit(owner.slice(8)); }
      catch { lim = { on: null, uses: null, reason: null, set_by: null, set_at: null }; }
      out.push({ scope: "project", project: owner.slice(8), on: lim.on, uses: lim.uses, reason: lim.reason,
                 set_by: lim.set_by, set_at: lim.set_at });
    }
    return out;
  }

  /* R15 `accountUses` (`op=accountuses`): one account's uses and keep-aways, to its owners alone: `{owner, held,
     uses, keptAway}`, the uses as `#usesAnswer` reads them. Never a key; writes nothing; never throws (a store that
     cannot be read answers `unreadable: true`). */
  /**
   * R15 `op=accountuses`: one account's uses and the material limits that bind it, to its owners alone.
   * @param {Object} [args]
   * @param {*} [args.owner] `group`, `project:<id>` or `member:<id>`
   * @param {*} [args.viewer] the stamped viewer
   * @returns {(UsesAnswer & {keptAway: Array<Object<string, *>> | null, unreadable?: true}) | Refusal} `keptAway` each
   *   limit `{scope, project?, on, uses, reason, set_by, set_at}`; or the owner's refusal (R1's, R10's or R5's)
   */
  accountUses({ owner = null, viewer = null } = {}) {
    try {
      const bar = this.#ownerBar(owner, viewer);
      if (bar) return bar;
      return { ...this.#usesAnswer(owner), keptAway: this.#limitsFor(owner) };
    } catch {
      return { ok: true, owner: typeof owner === "string" ? owner : null, held: null, uses: null, keptAway: null, unreadable: true };
    }
  }

  /* R17 `accountUsesOf` (T42; N831): an in-plane read, reached by no route and taking no viewer, of one account's uses
     exactly as R15 answers them to its owners, without `keptAway`: the read an in-plane caller uses for an account it
     does not own (ai-use R3, `credentials` R6, `credentials` R9). An `owner` not spelled as R14's answers `held: false, uses: null`; a store that
     cannot be read answers `held: null, uses: null, unreadable: true`, never a default (no switch reads as on); a revoked
     member's `member:<id>` answers `held: false, uses: null` (K2620). Never a key or a digest; writes nothing; never throws. */
  /**
   * R17: in-plane; one account's uses as R15 answers them, taking no viewer.
   * @param {{owner?: *} & Open} [args] a `viewer` or any other field it does not name is not read;
   *   `owner` is `group`, `project:<id>` or `member:<id>`
   * @returns {UsesAnswer} `held: null, uses: null, unreadable: true` when the store cannot be read; `held: false, uses:
   *   null` for an owner not so spelled or a revoked member
   */
  accountUsesOf({ owner = null } = {}) {
    const said = typeof owner === "string" ? owner : null;
    try {
      if (!AiAccounts.#usesOwnerSpelled(owner)) return { ok: true, owner: said, held: false, uses: null };
      /* (K2620) a revoked member's account, which R15 answers no viewer, is held by no one; membership asked directly,
         so a roster that cannot be read answers `unreadable` */
      if (owner.startsWith("member:") && this.membership.memberFacts(owner.slice(7))?.status === "revoked") {
        const none = { held: false, uses: null };
        return { ok: true, owner, ...none, accounts: { reference: { ...none }, signin: { ...none } } };
      }
      return this.#usesAnswer(owner);
    } catch {
      return { ok: true, owner: said, held: null, uses: null, unreadable: true };
    }
  }

  /* R14, R17: `group`, `project:<id>` or `member:<id>`, the id non-empty, the member named once and no machine. */
  static #usesOwnerSpelled(owner) {
    if (owner === "group") return true;
    if (typeof owner !== "string") return false;
    if (owner.startsWith("project:")) return owner.length > 8;
    const id = owner.startsWith("member:") ? owner.slice(7) : "";
    return id !== "" && !id.startsWith("member:") && !isMachineIdentity(id);
  }

  /* R15, R17: one account's uses, `owner` spelled as R14's: `{ok, owner, held, uses}`, `uses` every R14 switch with
     its value (its default where none was set; null when no account is held, the group key's defaults before any act
     on it); a project's account also its `kind`. For `member:<id>`, `uses` is the account `accountUsesSet` sets (their
     reference when held, else their sign-in) and `accounts` answers each of the two. Never a key; throws when the
     store cannot be read, for its caller to answer `unreadable`. */
  /**
   * @param {*} owner
   * @returns {UsesAnswer}
   */
  #usesAnswer(owner) {
    if (owner === "group") {
      const f = this.#groupKeyFacts();
      return { ok: true, owner, held: f.held, uses: f.uses };
    }
    if (owner.startsWith("project:")) {
      const p = this.#projectAccountRow(owner.slice(8));
      return { ok: true, owner, held: !!p, kind: p ? p.kind : null, uses: p ? AiAccounts.#usesOf(p) : null };
    }
    const id = AiAccounts.#memberOf(owner);
    const ref = this.#reference(id, AiAccounts.#USES_COLUMNS);
    const sub = this.#one(`SELECT ${AiAccounts.#USES_COLUMNS} FROM subscription_connections WHERE member_id=?
                           AND sealed IS NOT NULL`, id);
    const one = (r) => ({ held: !!r, uses: r ? AiAccounts.#usesOf(r) : null });
    return { ok: true, owner, held: !!(ref || sub), uses: ref ? AiAccounts.#usesOf(ref) : sub ? AiAccounts.#usesOf(sub) : null,
             accounts: { reference: one(ref), signin: one(sub) } };
  }

  /* R16 `accountHistory` (`op=accounthistory`): the account's changes, to its owners alone (R15's), in the order made,
     each `{at, by, change, …}` with what it set; capped as `credentials` R15's (default 200, at most 500) with a measured
     `truncated`. Writes nothing; never throws. */
  /**
   * R16 `op=accounthistory`: one account's changes, in the order made, to its owners alone.
   * @param {Object} [args]
   * @param {*} [args.owner] `group`, `project:<id>` or `member:<id>`
   * @param {*} [args.viewer] the stamped viewer
   * @param {*} [args.limit] how many changes; 200 when absent or not a positive number
   * @returns {({ok: true, owner: *, count: number, limit: number | null, truncated: boolean,
   *   changes: Array<Object<string, *>>, unreadable?: true} & Open) | Refusal} each change `{at, by, change, …}` with what it
   *   set, never a key; or the owner's refusal (R15's)
   * @bound limit: at most 500, 200 when not given
   */
  accountHistory({ owner = null, viewer = null, limit = null } = {}) {
    try {
      const bar = this.#ownerBar(owner, viewer);
      if (bar) return bar;
      const asked = Number(limit);
      const cap = Number.isFinite(asked) && asked > 0 ? Math.min(500, Math.floor(asked)) : 200;
      const found = this.#rows(`SELECT at, by, change, detail FROM account_changes WHERE owner=? ORDER BY seq LIMIT ?`,
        owner, cap + 1);
      const changes = found.slice(0, cap).map((r) => {
        let d = {};
        try { d = r.detail ? JSON.parse(r.detail) : {}; } catch { d = {}; }
        return { ...d, at: r.at, by: r.by, change: r.change };
      });
      return { ok: true, owner, count: changes.length, limit: cap, truncated: found.length > cap, changes };
    } catch {
      return { ok: true, owner: typeof owner === "string" ? owner : null, count: 0, limit: null, truncated: false,
               changes: [], unreadable: true };
    }
  }

  /* ===== A CONNECTED SUBSCRIPTION (R18; N678's share, DEC-156; K1819, K1922) =====
   *
   * A member's Claude subscription is connected through the hosted, unmodified Claude Code's own sign-in. R18's call
   * records the fact alone and never takes the login, the code from Anthropic's page, a token, or a digest of any of
   * them; a call carrying anything but the member is refused, recording nothing. (T47; R19, K3060 D10) The token the
   * sign-in prints is held here, sealed, by `subscriptionTokenHold` (below), and a fact with no token held answers not
   * connected. `accountFor` (R7) reads it: a member with no reference of their own whose sign-in is held is served by
   * it, `{kind: "signin", level: "member", member, key}`. */

  /* R18: an in-plane call, reached by no route and answered to no viewer. */
  /**
   * R18: in-plane; records that the member is connected through her subscription, the fact alone.
   * @param {*} [args] `{member}` and nothing else
   * @returns {({ok: true, member: string, since: *} & Open) | Refusal} or SUBSCRIPTION_LOGIN_REFUSED when it carries any field but
   *   `member`, ACCOUNT_MEMBER_NOT_ACTIVE for anyone not an active member; each recording nothing
   */
  subscriptionConnected(args = {}) {
    const carried = args && typeof args === "object" ? Object.keys(args).filter((k) => k !== "member" && args[k] !== undefined) : [];
    /* DEC-49 REGION is-subscription-fact */
    if (carried.length)
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SUBSCRIPTION_LOGIN_REFUSED", localize("ai-accounts.index.only_that_the_member_is", "only that the member is connected is recorded here; this call carried more than the member, and none of it is kept. Nothing was recorded."));
    /* END DEC-49 REGION is-subscription-fact */
    const member = args?.member ?? null;
    const id = AiAccounts.#memberOf(member);
    if (id === null || isMachineIdentity(member) || !this.#holderActive(id))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.only_an_active_member_is", "only an active member is connected through their subscription. Nothing was recorded."));
    if (!this.#one(`SELECT member_id FROM subscription_connections WHERE member_id=?`, id))
      this.#tx(() => {
        const since = this.#at();
        this.sql.exec(`INSERT OR IGNORE INTO subscription_connections (member_id, since) VALUES (?,?)`, id, since);
        this.#change(`member:${id}`, "signin_set", { account: "signin" }, id, null, since);   /* R16: by the member's own sign-in */
      });
    return { ok: true, member: id, since: this.#one(`SELECT since FROM subscription_connections WHERE member_id=?`, id).since };
  }

  /* R18, R7: whether the member is connected through their subscription (the fact R7 reads); (T47; R19) only while
     its token is held: a fact with none answers not connected. */
  #connected(id) {
    return !!this.#one(`SELECT member_id FROM subscription_connections WHERE member_id=? AND sealed IS NOT NULL`, id);
  }

  /* ===== THE HELD SIGN-IN TOKEN (R19; T47, Bob K3060 D10, K3061 D10: "It IS allowed"; K3068) =====
   *
   * Replacing K1819's "held only on the container's disk": the token Claude Code's own `setup-token` prints at a
   * member's sign-in (agent-runner R27) is held HERE, sealed under the member as a reference is (R2), until Anthropic
   * refuses it or it is dropped here (her disconnection, R18; her revocation, R27). It is handed only to the one call
   * it serves (`accountFor`'s `key`), and never logged, answered to a viewer, put in a URL or kept as a digest. The
   * founder, once claimed, holds one as a member does (C5, for Bob's own testing, D11). */

  /* R19: an in-plane call, reached by no route: the door's, after a sign-in's `code` answer. */
  /**
   * R19: in-plane; the member's sign-in token held, sealed under her, with the fact R18 records.
   * @param {Object} [args]
   * @param {*} [args.member] the member, or the claimed founder
   * @param {*} [args.token] the token
   * @param {*} [args.validFor] how long the binary said it lasts: a whole number of days, or "N days" or "N years"
   * @returns {Promise<({ok: true, since: string} & Open) | Refusal>} never the token; or ACCOUNT_MEMBER_NOT_ACTIVE,
   *   SUBSCRIPTION_TOKEN_MALFORMED or ACCOUNT_SEAL_UNAVAILABLE, each recording nothing
   * @bound token: a string of 20 to 2,000 characters
   */
  async subscriptionTokenHold({ member = null, token = null, validFor = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    if (id === null || isMachineIdentity(member) || isMachineIdentity(id) || !this.#holderActive(id))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.only_an_active_member_or", "only an active member, or the founder, holds a sign-in. Nothing was recorded."));
    /* DEC-49 REGION is-signin-token-shape */
    if (typeof token !== "string" || token.length < SIGNIN_TOKEN_LENGTH.min || token.length > SIGNIN_TOKEN_LENGTH.max)
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SUBSCRIPTION_TOKEN_MALFORMED", localize("ai-accounts.index.a_sign_ins_token_is", "a sign-in's token is {min} to {max} characters, and this was not one. Nothing was recorded.", { min: String(SIGNIN_TOKEN_LENGTH.min), max: String(SIGNIN_TOKEN_LENGTH.max) }));
    /* END DEC-49 REGION is-signin-token-shape */
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const { sealed, iv } = await this.#encrypt(`member:${id}`, "signin", token);
    const now = this.#nowMs();
    const since = stampSecond(now);
    const validUntil = AiAccounts.#validUntil(validFor, now);
    this.#tx(() => {
      this.sql.exec(`INSERT INTO subscription_connections (member_id, since, sealed, iv, valid_until) VALUES (?,?,?,?,?)
                     ON CONFLICT(member_id) DO UPDATE SET since=excluded.since, sealed=excluded.sealed, iv=excluded.iv,
                       valid_until=excluded.valid_until, refused_at=NULL`, id, since, sealed, iv, validUntil);
      this.#change(`member:${id}`, "signin_set", { account: "signin" }, id, null, since);   /* R16, never the token */
    });
    return { ok: true, since };
  }

  /* R19: the instant `validFor` reaches from `now` when the binary stated a whole number of days or years ("1 year",
     "30 days"; a bare whole number is days), else null. */
  static #validUntil(validFor, now) {
    const m = typeof validFor === "number" ? [null, String(validFor), "day"]
      : typeof validFor === "string" ? /^\s*(\d{1,4})\s*(day|year)s?\s*$/i.exec(validFor) : null;
    if (!m || !Number.isSafeInteger(Number(m[1])) || Number(m[1]) < 1) return null;
    const n = Number(m[1]);
    if (m[2].toLowerCase() === "day") return stampSecond(now + n * DAY_MS);
    const d = new Date(now);
    d.setUTCFullYear(d.getUTCFullYear() + n);
    return stampSecond(d.getTime());
  }

  /* R19: an in-plane call, when an act on her token was answered SIGNIN_TOKEN_REFUSED: the token is dropped and
     `refused_at` recorded (the fact stays, answering not connected), a change of her account (R16), and (R31 (4)) her
     projects' sign-in accounts cleared; her own switches stay for her next sign-in. (T50; R26, N1060, K3218, K3224) It
     tells R26's listeners once, inside the act, as a disconnection does (`why: "refused"`, `by: null`); a call for a member
     with none held drops nothing, records nothing and tells no one. Answers `{ok: true, dropped}`; never throws. */
  /**
   * R19, R26: in-plane; the member's held token dropped because Anthropic refused it.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @returns {{ok: boolean, dropped: boolean, unreadable?: true} & Open} `ok: false, unreadable: true` when the store could not
   *   be read or written
   */
  subscriptionTokenRefused({ member = null } = {}) {
    try {
      const id = AiAccounts.#memberOf(member);
      if (id === null || !this.#connected(id)) return { ok: true, dropped: false };
      const at = this.#at();
      this.#tx(() => {
        this.sql.exec(`UPDATE subscription_connections SET sealed=NULL, iv=NULL, valid_until=NULL, refused_at=? WHERE member_id=?`,
          at, id);
        this.#change(`member:${id}`, "removed", { account: "signin", why: "refused" }, null, null, at);
        this.#projectSigninsCleared(id, null);   /* R31 (4) */
        this.#cleared({ member: id, account: "signin", by: null, why: "refused",
                        reference_held: !!this.#reference(id, "member_id") });   /* R26 */
      });
      return { ok: true, dropped: true };
    } catch { return { ok: false, dropped: false, unreadable: true }; }
  }

  /* R19: a held sign-in's token, unsealed for the one call it serves, `{key}`; or `{refusal}`: SIGNIN_NOT_HELD with none
     held, ACCOUNT_SEAL_UNAVAILABLE when it does not open. */
  async #signinKey(id) {
    const r = this.#one(`SELECT sealed, iv FROM subscription_connections WHERE member_id=? AND sealed IS NOT NULL`, id);
    if (!r) return { refusal: AiAccounts.#signinNotHeld(id) };
    const unsealable = this.#seal();
    if (unsealable) return { refusal: unsealable };
    const key = await this.#decrypt(`member:${id}`, "signin", r.sealed, r.iv);
    return key === null ? { refusal: AiAccounts.#sealRefusal(localize("ai-accounts.index.the_sign_in_does_not", "the sign-in does not open under the seal secret of your team's Civicsmith, which has changed; its member signs in again. Nothing was used.")) } : { key };
  }

  /* R19: SIGNIN_NOT_HELD, minted here alone: a sign-in account chosen whose token is not held. */
  static #signinNotHeld(member) {
    /* DEC-49 REGION is-signin-held */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SIGNIN_NOT_HELD", localize("ai-accounts.index.the_claude_sign_in_that", "the Claude sign-in that serves this act is not held: it was never connected since sign-ins are held, or Anthropic no longer accepts it. Its member signs in again. Nothing was used."), { member });
    /* END DEC-49 REGION is-signin-held */
  }

  /* R18: the member's own act (R1's refusals) clears it; so does their revocation (R27). */
  /**
   * R18 `op=subscriptiondisconnect`: the member's own sign-in cleared by her own act, with her projects' sign-in
   * accounts.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, disconnected: boolean} & Open) | Refusal} `disconnected` false when none was held; or R1's refusals
   */
  subscriptionDisconnect({ member = null, by = null } = {}) {
    const bar = this.#accountBar(member, by);
    if (bar) return bar;
    const id = AiAccounts.#memberOf(member);
    /* R10 (T40): a project's sign-in account is cleared with its member's sign-in; (T41; R16) each a change */
    const held = this.#tx(() => this.#signinCleared(id, by, "disconnected"));
    return { ok: true, disconnected: held };
  }

  /* R3, R7: the act a member's account may serve: their own ask, run or standing question; (T40; R11) any kind of use
     but `explore`, so a `draft` too. Answers the member's id, or null. */
  static #ownAct(member, act) {
    const id = AiAccounts.#memberOf(member);
    const actKind = act && typeof act === "object" ? act.kind : null;
    if (id === null || !ACT_KINDS.includes(actKind) || AiAccounts.#memberOf(act.member) !== id
        || isMachineIdentity(act.member)) return null;
    return id;
  }

  /* R1–R4, R7: the member's reference row (the columns asked), only of a kind held (ACCOUNT_KINDS): a retired kind
     stored before its retirement is never answered (T38), whatever a store holds before `migrate` has run. */
  #reference(id, columns) {
    const kinds = ACCOUNT_KINDS.map(() => "?").join(",");
    return this.#one(`SELECT ${columns} FROM account_references WHERE member_id=? AND kind IN (${kinds})`, id, ...ACCOUNT_KINDS);
  }

  /* R3, R7: a member's own reference, unsealed, or a refusal (ACCOUNT_SEAL_UNAVAILABLE); null when none is held. */
  /**
   * @param {*} id
   * @returns {Promise<{ok: true, kind: *, secret: string} | Refusal | null>}
   */
  async #ownReference(id) {
    const r = this.#reference(id, "kind, sealed, iv");
    if (!r) return null;
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const secret = await this.#decrypt(`member:${id}`, r.kind, r.sealed, r.iv);
    if (secret === null)
      return AiAccounts.#sealRefusal(localize("ai-accounts.index.the_reference_does_not_open", "the reference does not open under the seal secret of your team's Civicsmith, which has changed; the member connects their account again. Nothing was used."));
    return { ok: true, kind: r.kind, secret };
  }

  /* R3: unseals the member's reference only for that member's own ask, run or standing question, for the one call it
     serves; the caller keeps nothing (agent-model R8). Kept for its callers until they move to `accountFor` (R7). */
  /**
   * R3: in-plane; the member's own reference unsealed, for the one call of her own act it serves.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {AiAct | *} [args.act] her act, `{kind, member}`
   * @returns {Promise<({ok: true, kind: *, secret: string} & Open) | Refusal>} or AI_KEPT_AWAY (or PROJECT_AI_KEPT_AWAY),
   *   NOT_YOUR_ACCOUNT, ACCOUNT_SEAL_UNAVAILABLE or NO_ACCOUNT
   */
  async accountReferenceFor({ member = null, act = null } = {}) {
    /* R7 (DEC-172): no assistant while the group keeps its material away; (T40; R22) for the act's use */
    const away = this.aiKeptAway({ use: act && typeof act === "object" ? act.kind : null });
    if (away) return away;
    const id = AiAccounts.#ownAct(member, act);
    if (id === null)
      return AiAccounts.#notYours("a member's Claude account serves only that member's "
        + "own asks, runs and standing questions. Nothing was used.");
    return (await this.#ownReference(id)) ?? this.#noAccount(id, true);
  }

  /* R4 (T41; DEC-188 (8)): the member's own `suggestions` and `standing` switches stand, two of R14's, and are set
     only by `accountUsesSet`; R4's own act, `accountSwitchSet` (`op=accountswitchset`), is retired into it. */

  /* ===== THE GROUP'S API KEY (R5–R9; K1755; DEC-172, K1957) =====
   *
   * DEC-172's two separate choices: whether the group pays (its API key, here), and whether it keeps its material
   * away from every assistant (R20, below); a member may always connect their own account (R1–R4), and K1757's "the
   * group's key only" no longer exists. An active administrator sets, switches and removes the group's one Anthropic
   * API key; it is sealed under the copy (R6), off when first set and off by default, and serves only acts of active
   * members who hold no reference of their own, once each has read its notice (R7, R8). It carries its own two
   * switches, set by an administrator (R9). Every act is recorded with its administrator and instant, never the key
   * (R5). */
  static #GROUP_KEY_OWNER = "group-key:anthropic";

  #groupKeyRow() {
    return this.#one(`SELECT sealed, iv, is_on, set_by, set_at, ${AiAccounts.#USES_COLUMNS} FROM group_key WHERE id=1`);
  }

  /* Held, and on only while held and switched on. */
  #groupKeyFacts() {
    const r = this.#groupKeyRow();
    const held = !!(r && r.sealed);
    return { held, on: held && !!r.is_on, set_at: held ? r.set_at : null, by: held ? r.set_by : null,
             suggestions: !!(r && r.suggestions), standing: !!(r && r.standing),
             /* R14 (T40): every switch of the group key; before any act on it, the defaults it starts with */
             uses: r ? AiAccounts.#usesOf(r) : { ...USE_DEFAULTS } };
  }

  /* R5's record, and (T41; R16) its change beside it, naming it as its origin. */
  #groupKeyAct(act, detail, by) {
    const at = this.#at();
    this.sql.exec(`INSERT INTO group_key_acts (act, detail, actor, at) VALUES (?,?,?,?)`, act, detail ?? null,
      AiAccounts.#memberOf(by), at);
    const [change, d] = AiAccounts.#legacyChange(act, detail ?? null);
    this.#change("group", change, d, by, `group_key_acts:${this.#lastSeq()}`, at);
  }

  /* R5: one key for the group's copy, replacing any earlier one; off when first set (a replacement keeps the switch
     as it was). Answers `{ok, set_at}`, never the key. */
  /**
   * R5 `op=groupkeyset`: the group's one API key held, sealed, by an active administrator.
   * @param {Object} [args]
   * @param {*} [args.key] the key, a non-blank string
   * @param {*} [args.by] the stamped caller
   * @returns {Promise<({ok: true, set_at: string} & Open) | Refusal | *>} never the key; or membership's NOT_AN_ADMIN, NO_SECRET
   *   or ACCOUNT_SEAL_UNAVAILABLE
   */
  async groupKeySet({ key = null, by = null } = {}) {
    const bar = this.#adminBar(by, "setting the team's Anthropic API key");
    if (bar) return bar;
    const empty = AiAccounts.#noSecret(key);
    if (empty) return empty;
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const { sealed, iv } = await this.#encrypt(AiAccounts.#GROUP_KEY_OWNER, "apikey", key);
    const setAt = this.#at();
    /* the key and its record (R5, R16) in one act */
    this.#tx(() => {
      const first = !this.#groupKeyFacts().held;
      this.sql.exec(
        `INSERT INTO group_key (id, sealed, iv, is_on, set_by, set_at) VALUES (1,?,?,0,?,?)
         ON CONFLICT(id) DO UPDATE SET sealed=excluded.sealed, iv=excluded.iv, set_by=excluded.set_by,
           set_at=excluded.set_at, is_on=CASE WHEN ? THEN 0 ELSE group_key.is_on END`,
        sealed, iv, AiAccounts.#memberOf(by), setAt, first ? 1 : 0);
      this.#groupKeyAct("set", null, by);
    });
    return { ok: true, set_at: setAt };
  }

  /* R5, R9: removes the key, which switches it off and turns both its switches off; (T40; R9) every R14 switch of
     it; with none, `removed: false`. */
  /**
   * R5, R9 `op=groupkeyremove`: the group key removed by an active administrator, switched off with every switch.
   * @param {Object} [args]
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, removed: boolean} & Open) | *} or membership's NOT_AN_ADMIN
   */
  groupKeyRemove({ by = null } = {}) {
    const bar = this.#adminBar(by, "removing the team's Anthropic API key");
    if (bar) return bar;
    const held = this.#groupKeyFacts().held;
    const off = USE_SWITCHES.map((k) => `${AiAccounts.#USE_COLUMN[k]}=${k === "explore" ? "'no'" : "0"}`).join(", ");
    this.#tx(() => {
      this.sql.exec(`UPDATE group_key SET sealed=NULL, iv=NULL, is_on=0, set_by=NULL, set_at=NULL, ${off} WHERE id=1`);
      this.#groupKeyAct("remove", null, by);
    });
    return { ok: true, removed: held };
  }

  /* R5: switches the key on or off; only `true` is on, and it is on only while a key is held. */
  /**
   * R5 `op=groupkeyswitch`: the group key switched on or off by an active administrator.
   * @param {Object} [args]
   * @param {*} [args.on] only `true` is on
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, on: boolean} & Open) | *} `on` true only while a key is held; or membership's NOT_AN_ADMIN
   */
  groupKeySwitch({ on = false, by = null } = {}) {
    const bar = this.#adminBar(by, "switching the team's Anthropic API key");
    if (bar) return bar;
    const v = on === true ? 1 : 0;
    this.#tx(() => {
      this.sql.exec(`INSERT INTO group_key (id, is_on) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET is_on=excluded.is_on`, v);
      this.#groupKeyAct("switch", v ? "on" : "off", by);
    });
    return { ok: true, on: this.#groupKeyFacts().on };
  }

  /* R9 (T41; DEC-188 (8)): the group key's own `suggestions` and `standing` stand, two of R14's, set only by
     `accountUsesSet` with `owner` `group`; R9's own act, `groupSwitchSet` (`op=groupswitchset`), is retired into it. */

  /* R6, R9: an active administrator reads `{held, on, set_at, by, suggestions, standing}` (T40: and `uses`, every R14
     switch); any other active member
     `{on}`; anyone else is refused as a non-administrator. Never the key; writes nothing. */
  /**
   * R6, R9 `op=groupkeystate`: the group key's state, never the key.
   * @param {Object} [args]
   * @param {*} [args.viewer] the stamped viewer
   * @returns {({ok: true, held: boolean, on: boolean, set_at: *, by: *, suggestions: boolean, standing: boolean,
   *   uses: Uses} & Open) | ({ok: true, on: boolean} & Open) | *} the whole to an active administrator, `{on}` to any other active member;
   *   or membership's NOT_AN_ADMIN
   */
  groupKeyState({ viewer = null } = {}) {
    const id = AiAccounts.#memberOf(viewer);
    const f = this.#groupKeyFacts();
    if (id !== null && !isMachineIdentity(viewer) && this.membership.isAdministrator(id)) return { ok: true, ...f };
    if (id !== null && !isMachineIdentity(viewer) && this.#memberFacts(id)?.status === "active")
      return { ok: true, on: f.on };
    return notAnAdmin(viewer ?? null, "reading the team's Anthropic API key");
  }

  /* R9 (N674; K1798): the group key's switches, for `ai-runs`' dispatch of a `level: "group"` account; an in-plane
     read reached by no route and answered to no viewer. Never the key; writes nothing; never throws. */
  /**
   * R9: in-plane; the group key's on and its two switches; all false when they cannot be read.
   * @returns {{on: boolean, suggestions: boolean, standing: boolean} & Open}
   */
  groupKeySwitches() {
    try {
      const f = this.#groupKeyFacts();
      return { on: f.on, suggestions: f.suggestions, standing: f.standing };
    } catch { return { on: false, suggestions: false, standing: false }; }
  }

  /* R8: the notice's words, `words.json`'s `ai-accounts.group_key_notice_text`, read by key (D311's disclosure, K1478 (i),
     K1755). */
  /** @type {string} R8: the group key's notice, `ai-accounts.group_key_notice_text` read by key */
  static GROUP_KEY_NOTICE_TEXT = word("ai-accounts.group_key_notice_text");

  /* R8: `{due, text}` for a member until their own act records that they have read it; writes nothing. */
  /**
   * R8 `op=groupkeynotice`: whether the group key's notice is due for the member, and its words.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @returns {{ok: true, due: boolean, text: string} & Open}
   */
  groupKeyNotice({ member = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    const seen = id !== null && !!this.#one(`SELECT member_id FROM group_key_notices WHERE member_id=?`, id);
    return { ok: true, due: !seen, text: AiAccounts.GROUP_KEY_NOTICE_TEXT };
  }

  /* R8: the member's own act (R1's refusals), recorded once with its instant; again answers `already: true`. */
  /**
   * R8 `op=groupkeynoticeseen`: the member records, by her own act, that she has read the group key's notice.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, seen: true, already: boolean} & Open) | Refusal} or R1's refusals
   */
  groupKeyNoticeSeen({ member = null, by = null } = {}) {
    const bar = this.#accountBar(member, by);
    if (bar) return bar;
    const id = AiAccounts.#memberOf(member);
    const already = !!this.#one(`SELECT member_id FROM group_key_notices WHERE member_id=?`, id);
    if (!already) this.sql.exec(`INSERT INTO group_key_notices (member_id, seen_at) VALUES (?,?)`, id, this.#at());
    return { ok: true, seen: true, already };
  }

  /* R8: GROUP_KEY_NOTICE_DUE, minted here alone. */
  #noticeDue(id) {
    /* DEC-49 REGION is-group-key-notice-seen */
    if (this.#one(`SELECT member_id FROM group_key_notices WHERE member_id=?`, id)) return null;
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "GROUP_KEY_NOTICE_DUE", localize("ai-accounts.index.this_member_has_not_yet", "this member has not yet read the notice that their questions go to Anthropic under the team's API account. Nothing was sent."), { member: id });
    /* END DEC-49 REGION is-group-key-notice-seen */
  }

  /* R7's choice without unsealing: which account serves an active member's act now, 'member', 'group' or null, and
     the switches that govern it (R4, R9, R14). (T41; N796, Bob K2425) A member's own sign-in (R18) serves at level
     'member' and is governed by its own switches (R14), as a reference is: T38's refusal of a sign-in (K2275) is
     lifted. */
  #servingAccount(id) {
    const own = this.#reference(id, "suggestions, standing");
    if (own) return { level: "member", suggestions: !!own.suggestions, standing: !!own.standing };
    const sub = this.#one(`SELECT suggestions, standing FROM subscription_connections WHERE member_id=?
                           AND sealed IS NOT NULL`, id);
    if (sub) return { level: "member", signin: true, suggestions: !!sub.suggestions, standing: !!sub.standing };
    const g = this.#groupKeyFacts();
    return g.on ? { level: "group", suggestions: g.suggestions, standing: g.standing } : null;
  }

  /* R7: the account that serves a member's act: their own reference when held, `{kind, level: "member", key}`,
     whatever the group key's state (DEC-172 (1), (5)); else (T38; N785, K2200), when they are connected through their
     subscription (R18), their own sign-in, `{kind: "signin", level: "member", member, key}`, `key` the held token (T47;
     R19); else the group key when held and on, `{kind: "apikey", level: "group", key}`, for
     an active member who has read its notice (R8); else NO_ACCOUNT. While the group keeps its
     material away (R20), every account is refused AI_KEPT_AWAY first, before any is read. `act` as R3's. Writes
     nothing; called only by the modules that run the assistant. (T40; R11) `act` takes `project`, and the cascade
     begins with that project's account, `{kind: "apikey", level: "project", project, key}` or `{kind: "signin", level:
     "project", project, member, key}`; the account the cascade chooses is the one used (#resolve). */
  /**
   * R7, R11, R19: in-plane; the account that serves a member's own act, unsealed for the one call it serves.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {AiAct | *} [args.act] her act, `{kind, member, project?}`
   * @returns {Promise<AccountServed | Refusal | *>} or AI_KEPT_AWAY, PROJECT_AI_KEPT_AWAY, NOT_YOUR_ACCOUNT,
   *   membership's answer for a project she cannot see or has not joined, AI_USE_SWITCHED_OFF, SIGNIN_NOT_HELD,
   *   ACCOUNT_MEMBER_NOT_ACTIVE, PROJECT_KEY_NOTICE_DUE, GROUP_KEY_NOTICE_DUE, ACCOUNT_SEAL_UNAVAILABLE or NO_ACCOUNT
   */
  async accountFor({ member = null, act = null } = {}) {
    const away = this.aiKeptAway({ use: act && typeof act === "object" ? act.kind : null });
    if (away) return away;
    const id = AiAccounts.#ownAct(member, act);
    if (id === null)
      return AiAccounts.#notYours("a Claude account serves only a member's own asks, runs and standing questions. "
        + "Nothing was used.");
    const r = this.#resolve(id, act.kind, AiAccounts.#projectOf(act));
    if (r.refusal) return r.refusal;
    if (r.kind === "signin") {   /* (T47; R19) a held sign-in, its token as `key` for the one call it serves */
      const k = await this.#signinKey(r.level === "project" ? r.member : id);
      if (k.refusal) return k.refusal;
      return r.level === "project" ? { ok: true, kind: "signin", level: "project", project: r.project, member: r.member, key: k.key }
                                   : { ok: true, kind: "signin", level: "member", member: id, key: k.key };
    }
    if (r.level === "member") {
      const own = await this.#ownReference(id);
      if (!own) return this.#noAccount(id);
      return own.ok ? { ok: true, kind: own.kind, level: "member", key: own.secret } : own;
    }
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    if (r.level === "project") {
      const key = await this.#decrypt(`project:${r.project}`, "apikey", r.row.sealed, r.row.iv);
      if (key === null)
        return AiAccounts.#sealRefusal(localize("ai-accounts.index.the_projects_key_does_not", "the project's key does not open under the seal secret of your team's Civicsmith, which has changed; one of the project's owners sets it again. Nothing was used."));
      return { ok: true, kind: "apikey", level: "project", project: r.project, key };
    }
    const key = await this.#decrypt(AiAccounts.#GROUP_KEY_OWNER, "apikey", r.row.sealed, r.row.iv);
    if (key === null)
      return AiAccounts.#sealRefusal(localize("ai-accounts.index.the_teams_key_does_not", "the team's key does not open under the seal secret of your team's Civicsmith, which has changed; an administrator sets it again. Nothing was used."));
    return { ok: true, kind: "apikey", level: "group", key };
  }

  /* R11: the project an act names, or null when it names none. */
  static #projectOf(act) {
    const p = act && typeof act === "object" ? act.project : undefined;
    return p === undefined || p === null ? null : p;
  }

  /* R11 (T40; N812, D38; A3, A4 of K2352, K2353), without unsealing: the account that serves member `id`'s act of kind
     `use`, the first that is held and on of (1) `project`'s account (a sign-in only while it serves, R10), when the act
     names a project the member has joined; (2) the member's own, their reference, else their sign-in; (3) the group
     key. The account chosen is the one used: its switch for `use` off is AI_USE_SWITCHED_OFF, naming whose, and the act
     never moves to the next account. A project the member cannot see is answered as absent, one they see and have not
     joined PROJECT_ACT_NOT_A_PARTICIPANT; the project's material limit (R22) is asked before its account. A key that
     pays for others' acts serves only an active member who has read its notice (R8, R12), asked when `notice`.
     Answers `{refusal}`, or `{level, kind, project?, member?, row?}`. Writes nothing. */
  #resolve(id, use, project, { notice = true } = {}) {
    if (project !== null) {
      const bar = this.#participantBar(project, id, "asking the assistant in a project");
      if (bar) return { refusal: bar };
      const away = this.aiKeptAway({ project, use });
      if (away) return { refusal: away };
      const p = this.#projectAccountRow(project);
      if (p && p.is_on && this.#serves(p)) {
        if (!AiAccounts.#usesOf(p)[use]) return { refusal: AiAccounts.#switchedOff("project", use, project) };
        if (p.kind === "signin")   /* (T47; R19) chosen, so its token not held is SIGNIN_NOT_HELD, never the next */
          return this.#connected(p.member_id) ? { level: "project", kind: "signin", project, member: p.member_id }
            : { refusal: AiAccounts.#signinNotHeld(p.member_id) };
        if (this.#memberFacts(id)?.status !== "active")
          return { refusal: AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", "a project's key serves only "
            + "acts of active members. Nothing was used.") };
        const due = notice ? this.#projectNoticeDue(id, project) : null;
        if (due) return { refusal: due };
        return { level: "project", kind: "apikey", project, row: p };
      }
    }
    const own = this.#reference(id, `kind, ${AiAccounts.#USES_COLUMNS}`);
    if (own) return AiAccounts.#usesOf(own)[use] ? { level: "member", kind: own.kind }
                                                    : { refusal: AiAccounts.#switchedOff("own", use) };
    const sub = this.#one(`SELECT ${AiAccounts.#USES_COLUMNS} FROM subscription_connections WHERE member_id=?
                           AND sealed IS NOT NULL`, id);
    if (sub) return AiAccounts.#usesOf(sub)[use] ? { level: "member", kind: "signin", member: id }
                                                    : { refusal: AiAccounts.#switchedOff("own", use) };
    const g = this.#groupKeyRow();
    if (!(g && g.sealed && g.is_on)) return { refusal: this.#noAccount(id) };
    if (!AiAccounts.#usesOf(g)[use]) return { refusal: AiAccounts.#switchedOff("group", use) };
    if (this.#memberFacts(id)?.status !== "active")
      return { refusal: AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.the_teams_key_serves_only", "the team's key serves only acts of active members. Nothing was used.")) };
    const due = notice ? this.#noticeDue(id) : null;
    if (due) return { refusal: due };
    return { level: "group", kind: "apikey", row: g };
  }

  /* ===== KEEPING THE GROUP'S MATERIAL AWAY FROM AI (R20, R21; DEC-172, K1957) =====
   *
   * DEC-172's second choice, separate from whether the group pays: an active administrator may keep the group's
   * material away from every assistant, the group's key and members' own accounts alike, and turns it on only with a
   * reason every member reads, in the administrator's own words. Off by default. Each set is appended with who and
   * when, never replacing an earlier one; the latest is the setting. While it is on, `accountFor` (R7) refuses every
   * account before any is read, so no ask, run or standing question reaches a model, and the grants that serve them
   * (`credentials` R27, `credentials` R32) are not minted. */

  /* R21: the latest set, or off before any. Never throws: a setting that cannot be read is answered `on: null`, not
     known, which R7 reads as kept away (a failure never sends material out). */
  /**
   * R21, R22 `op=aikeepawaystate`: the group's material limit as the latest set stands; off before any.
   * @returns {Limit} `on`, `uses` and the rest null when it cannot be read
   */
  aiKeepAwayState() {
    try {
      const r = this.#one(`SELECT is_on, reason, set_by, set_at, uses FROM ai_keep_away ORDER BY seq DESC LIMIT 1`);
      return r ? { on: !!r.is_on, reason: r.reason ?? null, set_by: r.set_by, set_at: r.set_at, uses: AiAccounts.#usesList(r.uses) }
               : { on: false, reason: null, set_by: null, set_at: null, uses: [...USE_KINDS] };
    } catch { return { on: null, reason: null, set_by: null, set_at: null, uses: null }; }
  }

  /* R22 (T40): the uses a material limit covers, from its stored JSON: every kind when none was named (a limit set
     before T40 covers every use), and, for a value that does not read, every kind (fail closed). */
  static #usesList(json) {
    if (json === null || json === undefined) return [...USE_KINDS];
    try {
      const a = JSON.parse(json);
      return Array.isArray(a) && a.length ? USE_KINDS.filter((k) => a.includes(k)) : [...USE_KINDS];
    } catch { return [...USE_KINDS]; }
  }

  /* R22: a limit covers `use` when it is on and names it; with no `use` asked, whenever it is on ("as now", K2404 (4)). */
  static #covers(limit, use) {
    return limit.on === true && (use === null || use === undefined || (Array.isArray(limit.uses) && limit.uses.includes(use)));
  }

  /* R22: `uses` as set: absent (every use) or a non-empty list of USE_KINDS entries, each once; answers `{json}` to
     store, or `{fault}`, SWITCH_VALUE_INVALID naming the values (K2404 (4)). */
  static #usesToStore(uses) {
    if (uses === null || uses === undefined) return { json: null };
    if (Array.isArray(uses) && uses.length && uses.every((u) => USE_KINDS.includes(u)) && new Set(uses).size === uses.length)
      return { json: JSON.stringify(USE_KINDS.filter((k) => uses.includes(k))) };
    return { fault: AiAccounts.#valueInvalid(word("ai-accounts.fault"), USE_KINDS) };
  }

  /* R20 (DEC-172), R22: the reason rule a material limit is set under, the group's or a project's: `on: true` needs a
     reason of 1 to 2,000 characters, not blank; a reason given with `on: false` is held to the same bounds.
     AI_KEEP_AWAY_NO_REASON, minted here alone. */
  static #keepAwayReason(turnOn, reason) {
    const given = typeof reason === "string" && reason.trim() !== "";
    const length = typeof reason === "string" ? [...reason].length : 0;
    /* DEC-49 REGION is-keep-away-reason */
    if ((turnOn && !given) || (given && length > KEEP_AWAY_REASON.max) || (reason !== null && reason !== undefined
        && typeof reason !== "string"))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "AI_KEEP_AWAY_NO_REASON", localize("ai-accounts.index.keeping_material_away_from_the", "keeping material away from the assistant is turned on only with a reason of {min} to {max} characters, which every member reads{v1}. Nothing was changed.", { min: String(KEEP_AWAY_REASON.min), max: String(KEEP_AWAY_REASON.max), v1: String(given ? localize("ai-accounts.index.this_one_has", "; this one has {length}", { length: String(length) }) : "") }));
    /* END DEC-49 REGION is-keep-away-reason */
    return null;
  }

  /* R20 (`op=aikeepaway`): an active administrator's act. `on: true` needs a reason of 1 to 2,000 characters, not
     blank; a reason given with `on: false` is kept under the same bounds. Each refusal writes nothing. (T40; R22) It
     takes `uses`, the kinds of use the limit covers (all when absent). */
  /**
   * R20, R22 `op=aikeepaway`: the group's material limit set by an active administrator, appended.
   * @param {Object} [args]
   * @param {*} [args.on] only `true` is on
   * @param {*} [args.uses] the kinds of use it covers: absent for every kind, else a non-empty list of `USE_KINDS`
   *   entries, each once
   * @param {*} [args.reason] the administrator's words, needed when turning it on
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true} & Limit & Open) | Refusal | *} the limit as it then stands; or membership's NOT_AN_ADMIN,
   *   AI_KEEP_AWAY_NO_REASON or SWITCH_VALUE_INVALID, each writing nothing
   * @bound reason: 1 to 2,000 characters, not blank, when `on` is true; a reason given is held to the same bounds
   */
  aiKeepAwaySet({ on = false, uses = null, reason = null, by = null } = {}) {
    const bar = this.#adminBar(by, localize("ai-accounts.index.keeping_the_teams_material_away", "keeping the team's material away from every assistant"));
    if (bar) return bar;
    const turnOn = on === true;
    const noReason = AiAccounts.#keepAwayReason(turnOn, reason);
    if (noReason) return noReason;
    const u = AiAccounts.#usesToStore(uses);
    if (u.fault) return u.fault;
    const given = typeof reason === "string" && reason.trim() !== "";
    this.#tx(() => {
      const at = this.#at();
      this.sql.exec(`INSERT INTO ai_keep_away (is_on, reason, set_by, set_at, uses) VALUES (?,?,?,?,?)`, turnOn ? 1 : 0,
        given ? reason : null, AiAccounts.#memberOf(by), at, u.json);
      /* R16: the change beside it */
      this.#change("group", "limit_set", AiAccounts.#limitDetail({ is_on: turnOn, uses: u.json, reason: given ? reason : null }),
        by, `ai_keep_away:${this.#lastSeq()}`, at);
    });
    return { ok: true, ...this.aiKeepAwayState() };
  }

  /* R7 (T37; N765, K231): AI_KEPT_AWAY, minted here alone, carrying R21's reason, who and when as `keep_away` (the
     answer's own `reason` is its code); null while the setting is off. An in-plane read reached by no route and
     answered to no viewer: R7, `credentials` R27 and `credentials` R32 refuse through it, and every module that gates an assistant on keep-away
     (instance-setup R55, answers, wizard-scripts, store-door) reads it, never a copy of the condition. A setting that
     cannot be read is that refusal, saying so, with the three null (fail closed, K2093). Writes nothing; never
     throws. (T48; R34, N1041) Whatever part of a limit cannot be read, or an error inside the read, it answers a
     refusal with its row, never a throw: an error the reads below do not catch answers `KEPT_AWAY_UNREADABLE`, the
     unreadable form of this one site's own answer. */
  /**
   * R7, R22, R34: in-plane; the one site of AI_KEPT_AWAY and PROJECT_AI_KEPT_AWAY.
   * @param {Object} [args]
   * @param {*} [args.project] the project the act is in, or none
   * @param {*} [args.use] the act's kind of use, or none (then any limit that is on covers it)
   * @returns {Refusal | null} null when no limit covers the use; AI_KEPT_AWAY (with `keep_away`) when the group's does or
   *   cannot be read; else PROJECT_AI_KEPT_AWAY (with `project`, `use`, `keep_away`) when the project's does or cannot
   *   be read
   */
  aiKeptAway({ project = null, use = null } = {}) {
    try {
      let st;
      try { st = this.aiKeepAwayState(); } catch { st = { on: null, reason: null, set_by: null, set_at: null }; }
      /* (T40; R22) the group's limit refuses when it covers `use`; then `project`'s, PROJECT_AI_KEPT_AWAY */
      if (st.on === false || (st.on === true && !AiAccounts.#covers(st, use))) return this.#projectKeptAway(project, use);
      return AiAccounts.#keptAway(st);
    } catch {
      return { ...KEPT_AWAY_UNREADABLE, keep_away: { ...KEPT_AWAY_UNREADABLE.keep_away } };
    }
  }

  /* R7: the refusal `aiKeptAway` answers while the group's limit covers the use, or cannot be read (`st.on` not
     `true`). */
  static #keptAway(st) {
    /* DEC-49 REGION is-kept-away */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "AI_KEPT_AWAY", st.on === true
      ? localize("ai-accounts.index.the_team_keeps_its_material", "the team keeps its material away from every assistant, so no account was read or used. Nothing was sent.")
      : localize("ai-accounts.index.whether_the_team_keeps_its", "whether the team keeps its material away from every assistant could not be read, so no account was read or used. Nothing was sent."), { keep_away: { reason: st.reason, set_by: st.set_by, set_at: st.set_at } });
    /* END DEC-49 REGION is-kept-away */
  }

  /* R22: a project's material limit, the latest set, or off before any. Throws when it cannot be read: its caller
     fails closed. */
  #projectLimit(project) {
    const r = this.#one(`SELECT is_on, uses, reason, set_by, set_at FROM project_keep_away WHERE project_id=?
                         ORDER BY seq DESC LIMIT 1`, project);
    return r ? { on: !!r.is_on, uses: AiAccounts.#usesList(r.uses), reason: r.reason ?? null, set_by: r.set_by, set_at: r.set_at }
             : { on: false, uses: [...USE_KINDS], reason: null, set_by: null, set_at: null };
  }

  /* R22: PROJECT_AI_KEPT_AWAY, minted here alone, with the limit's reason, who and when; null when `project` names
     none or its limit does not cover `use`. A limit that cannot be read is that refusal, saying so (fail closed,
     K2093). */
  #projectKeptAway(project, use) {
    if (project === null || project === undefined) return null;
    let lim;
    try { lim = this.#projectLimit(String(project)); } catch { lim = { on: null, reason: null, set_by: null, set_at: null }; }
    if (lim.on === false || (lim.on === true && !AiAccounts.#covers(lim, use))) return null;
    /* DEC-49 REGION is-project-kept-away */
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "PROJECT_AI_KEPT_AWAY", lim.on === true
      ? localize("ai-accounts.index.this_project_keeps_its_material", "this project keeps its material away from the assistant for this use, so no account was read or used. Nothing was sent.")
      : localize("ai-accounts.index.whether_this_project_keeps_its", "whether this project keeps its material away from the assistant could not be read, so no account was read or used. Nothing was sent."),
      { project: String(project), use: use ?? null, keep_away: { reason: lim.reason, set_by: lim.set_by, set_at: lim.set_at } });
    /* END DEC-49 REGION is-project-kept-away */
  }

  /* ===== A PROJECT'S AI ACCOUNT (R10, R12, R13; T40, N812, D34, D37, K2352, K2353, K2404) =====
   *
   * A project holds at most one account, set, switched and removed by any one of its owners (K2352 (2)): an Anthropic
   * API key, sealed as the group key is under `project:<id>`, or the acting owner's own sign-in (R18), which holds no
   * secret and serves only while that member is the project's only participant (K2353: a subscription is that one
   * member's own use, AT-3). When a second member joins, the join is not refused: the sign-in stops serving at once
   * (R11 goes on to each member's own account, then the group's) and the owners are told once (R13, read by
   * notice-producers R16); it serves again when the project returns to that one member. Who participates, and since
   * when, is membership's `joinedParticipants` (its R127); without it a sign-in serves nothing (fail closed). Sight
   * before position (Membership v2 §7): a project the caller cannot see is answered as absent, one seen at existence by
   * C-70.1, and only then is ownership asked; PROJECT_ACT_NOT_THE_OWNER is membership's own answer (its R122). Each
   * act is recorded with its owner and instant, never the key. */

  /* R12 (T41; DEC-188 (7)): the notice's words, `words.json`'s `ai.disclosure.projectkey`, read by key; `{project}`
     is the project's name when answered (`#disclosure`). */
  /** @type {string} R12: the project key's notice, `ai.disclosure.projectkey` read by key, `{project}` left to fill */
  static PROJECT_KEY_NOTICE_TEXT = AI_WORDS["ai.disclosure.projectkey"];

  /* R12: the project's name, its bundle's title (record-core R34's `bundleInfo`), else its id. Never throws. */
  #projectName(project) {
    try {
      const t = this.core?.bundleInfo?.(project)?.title;
      if (typeof t === "string" && t.trim() !== "") return t;
    } catch { /* the id */ }
    return String(project);
  }

  /* R12: the disclosure for `project`, `{project}` filled with its name. */
  #disclosure(project) {
    return { key: "ai.disclosure.projectkey",
             text: AiAccounts.PROJECT_KEY_NOTICE_TEXT.replaceAll("{project}", this.#projectName(project)) };
  }

  /* membership R122: PROJECT_ACT_NOT_THE_OWNER, minted there alone. */
  #notTheOwner(by, project) { return notTheOwner(by ?? null, project); }

  /* membership R44: the caller's sight of `project`, NONE for anything that names no project; never throws. */
  #sightOf(project, viewer) {
    if (typeof project !== "string" || project === "") return Membership.SIGHT_NONE;
    try { return this.membership.sight(project, viewer); } catch { return Membership.SIGHT_NONE; }
  }

  /* Sight first (`credentials` R44, `credentials` R77): NONE answers as absent, EXISTENCE C-70.1; null when the caller sees the project. */
  #unseen(project, viewer) {
    const s = this.#sightOf(project, viewer);
    if (s === Membership.SIGHT_FULL) return null;
    const absent = noSuchProject(typeof project === "string" ? project : null);
    return s === Membership.SIGHT_EXISTENCE ? (this.membership.existenceAct(project, viewer) ?? absent) : absent;
  }

  /* R10: an act on a project's AI settings is an owner's (membership R54, `credentials` R122); a machine credential, the operator's
     token or an unstamped call is refused the same way. */
  #projectOwnerBar(project, by, act) {
    const id = AiAccounts.#memberOf(by);
    if (by === null || by === undefined || by === "" || isMachineIdentity(by) || id === null)
      return this.#notTheOwner(by, project);
    const unseen = this.#unseen(project, `member:${id}`);
    if (unseen) return unseen;
    return this.#isOwner(project, id) ? null : this.#notTheOwner(by, project);
  }

  /* R11, R12: a project a member acts in is one they have joined (membership R54's set; R14's
     PROJECT_ACT_NOT_A_PARTICIPANT for one they see and have not joined). */
  #participantBar(project, id, act) {
    const viewer = `member:${id}`;
    const unseen = this.#unseen(project, viewer);
    if (unseen) return unseen;
    return this.membership.projectAuthority(project, viewer, "joined", act);
  }

  #isOwner(project, id) { try { return this.membership.isProjectOwner(project, id) === true; } catch { return false; } }
  #isJoined(project, id) { try { return this.membership.isJoinedParticipant(project, id) === true; } catch { return false; } }

  /* membership R127: the project's participants joined or leaving, `[{member, owner, since}]`, or null when it cannot
     be read. */
  #participants(project) {
    try {
      if (typeof this.membership.joinedParticipants !== "function") return null;
      const a = this.membership.joinedParticipants(project);
      return Array.isArray(a) ? a : null;
    } catch { return null; }
  }

  #projectAccountRow(project) {
    if (typeof project !== "string" || project === "") return null;
    return this.#one(`SELECT * FROM project_accounts WHERE project_id=?`, project);
  }

  /* R10: a key serves while held; a sign-in only while its member is the project's only participant. */
  #serves(p) {
    if (p.kind !== "signin") return true;
    const parts = this.#participants(p.project_id);
    return !!parts && parts.some((x) => x.member === p.member_id) && parts.every((x) => x.member === p.member_id);
  }

  /* R10's record, and (T41; R16) its change beside it, naming it as its origin. */
  #projectAct(project, act, detail, by) {
    const at = this.#at();
    this.sql.exec(`INSERT INTO project_account_acts (project_id, act, detail, actor, at) VALUES (?,?,?,?,?)`, project, act,
      detail ?? null, AiAccounts.#memberOf(by), at);
    const [change, d] = AiAccounts.#legacyChange(act, detail ?? null);
    const extra = act === "setsignin" ? { kind: "signin", member: AiAccounts.#memberOf(by) } : {};
    this.#change(AiAccounts.#ownerOfProject(project), change, { ...d, ...extra }, by, `project_account_acts:${this.#lastSeq()}`, at);
  }

  /* R10 `projectKeySet`: an owner holds an Anthropic API key for the project, replacing any earlier account; off when
     first set (a key replacing a key keeps its switches; replacing a sign-in, it is a new account). Answers
     `{ok, project, kind, set_at}`, never the key. */
  /**
   * R10 `op=projectkeyset`: a project's API key held, sealed, by one of its owners.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.key] the key, a non-blank string
   * @param {*} [args.by] the stamped caller
   * @returns {Promise<({ok: true, project: *, kind: string, set_at: string} & Open) | Refusal | *>} never the key; or the project
   *   answered as absent, membership's PROJECT_ACT_NOT_THE_OWNER, NO_SECRET or ACCOUNT_SEAL_UNAVAILABLE
   */
  async projectKeySet({ project = null, key = null, by = null } = {}) {
    const bar = this.#projectOwnerBar(project, by, "setting a project's Anthropic API key");
    if (bar) return bar;
    const empty = AiAccounts.#noSecret(key);
    if (empty) return empty;
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const { sealed, iv } = await this.#encrypt(`project:${project}`, "apikey", key);
    const setAt = this.#at();
    const actor = AiAccounts.#memberOf(by);
    this.#tx(() => {
      const held = this.#projectAccountRow(project);
      if (held && held.kind === "apikey")
        this.sql.exec(`UPDATE project_accounts SET sealed=?, iv=?, set_by=?, set_at=? WHERE project_id=?`, sealed, iv, actor,
          setAt, project);
      else {
        this.sql.exec(`DELETE FROM project_accounts WHERE project_id=?`, project);
        this.sql.exec(`INSERT INTO project_accounts (project_id, kind, sealed, iv, set_by, set_at) VALUES (?,'apikey',?,?,?,?)`,
          project, sealed, iv, actor, setAt);
      }
      this.#projectAct(project, "setkey", null, by);
    });
    return { ok: true, project, kind: "apikey", set_at: setAt };
  }

  /* R10 `projectSigninSet`: the acting owner's own sign-in becomes the project's account, replacing any earlier one;
     refused PROJECT_NOT_SOLE_MEMBER while the project has any other participant (owners included; and when who
     participates cannot be read), and SIGNIN_NOT_CONNECTED when the owner is not connected through their subscription. */
  /**
   * R10 `op=projectsigninset`: the acting owner's own sign-in made the project's account.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, project: *, kind: string, set_at: string} & Open) | Refusal | *} or the project answered as absent,
   *   membership's PROJECT_ACT_NOT_THE_OWNER, PROJECT_NOT_SOLE_MEMBER or SIGNIN_NOT_CONNECTED
   */
  projectSigninSet({ project = null, by = null } = {}) {
    const bar = this.#projectOwnerBar(project, by, "making your sign-in a project's Claude account");
    if (bar) return bar;
    const id = AiAccounts.#memberOf(by);
    const parts = this.#participants(project);
    /* DEC-49 REGION is-project-sole-member */
    if (!parts || parts.some((x) => x.member !== id))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "PROJECT_NOT_SOLE_MEMBER", localize("ai-accounts.index.a_members_own_sign_in", "a member's own sign-in serves a project only while that member is its only participant, and this project has others (owners included); it can hold an Anthropic API key instead. Nothing was written."), { project });
    /* END DEC-49 REGION is-project-sole-member */
    /* DEC-49 REGION is-signin-connected */
    if (!this.#connected(id))
      return AiAccounts.#row(AI_ACCOUNT_CHECKS, "SIGNIN_NOT_CONNECTED", localize("ai-accounts.index.you_are_not_connected_through", "you are not connected through your Claude subscription, so there is no sign-in of yours to serve the project. Nothing was written."), { project });
    /* END DEC-49 REGION is-signin-connected */
    const setAt = this.#at();
    this.#tx(() => {
      const held = this.#projectAccountRow(project);
      if (held && held.kind === "signin" && held.member_id === id)
        this.sql.exec(`UPDATE project_accounts SET set_by=?, set_at=? WHERE project_id=?`, id, setAt, project);
      else {
        this.sql.exec(`DELETE FROM project_accounts WHERE project_id=?`, project);
        this.sql.exec(`INSERT INTO project_accounts (project_id, kind, member_id, set_by, set_at) VALUES (?,'signin',?,?,?)`,
          project, id, id, setAt);
      }
      this.#projectAct(project, "setsignin", null, by);
    });
    return { ok: true, project, kind: "signin", set_at: setAt };
  }

  /* R10 `projectAccountRemove`: removes whichever account is held; with none, `removed: false`. */
  /**
   * R10 `op=projectaccountremove`: a project's account removed by one of its owners.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, removed: boolean} & Open) | *} or the project answered as absent, or membership's
   *   PROJECT_ACT_NOT_THE_OWNER
   */
  projectAccountRemove({ project = null, by = null } = {}) {
    const bar = this.#projectOwnerBar(project, by, "removing a project's Claude account");
    if (bar) return bar;
    const held = !!this.#projectAccountRow(project);
    this.#tx(() => {
      this.sql.exec(`DELETE FROM project_accounts WHERE project_id=?`, project);
      this.#projectAct(project, "remove", null, by);
    });
    return { ok: true, removed: held };
  }

  /* R10 `projectAccountSwitch`: switches whichever account is held on or off; only `true` is on, and it is on only
     while an account is held. */
  /**
   * R10 `op=projectaccountswitch`: a project's account switched on or off by one of its owners.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.on] only `true` is on
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, on: boolean} & Open) | *} `on` true only while an account is held; or the project answered as absent,
   *   or membership's PROJECT_ACT_NOT_THE_OWNER
   */
  projectAccountSwitch({ project = null, on = false, by = null } = {}) {
    const bar = this.#projectOwnerBar(project, by, "switching a project's Claude account");
    if (bar) return bar;
    const v = on === true ? 1 : 0;
    this.#tx(() => {
      this.sql.exec(`UPDATE project_accounts SET is_on=? WHERE project_id=?`, v, project);
      this.#projectAct(project, "switch", v ? "on" : "off", by);
    });
    return { ok: true, on: !!this.#projectAccountRow(project)?.is_on };
  }

  /* R10 `projectAccountState`: its owners `{held, kind, on, set_at, by, uses, serving}`, its joined participants
     `{on, serving}`, anyone else as absent (after sight: C-70.1 at existence). Never the key; writes nothing. */
  /**
   * R10 `op=projectaccountstate`: a project's account, never its key.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.viewer] the stamped viewer
   * @returns {({ok: true, held: boolean, kind: *, on: boolean, set_at: *, by: *, uses: Uses | null, serving: boolean}
   *   & Open) | ({ok: true, on: boolean, serving: boolean} & Open) | *} the whole to its owners, `{on, serving}` to its joined
   *   participants; anyone else is answered as absent
   */
  projectAccountState({ project = null, viewer = null } = {}) {
    const id = AiAccounts.#memberOf(viewer);
    const absent = noSuchProject(typeof project === "string" ? project : null);
    if (id === null || isMachineIdentity(viewer)) return absent;
    const unseen = this.#unseen(project, `member:${id}`);
    if (unseen) return unseen;
    const p = this.#projectAccountRow(project);
    const on = !!p?.is_on;
    const serving = !!p && this.#serves(p);
    if (this.#isOwner(project, id))
      return { ok: true, held: !!p, kind: p ? p.kind : null, on, set_at: p ? p.set_at : null, by: p ? p.set_by : null,
               uses: p ? AiAccounts.#usesOf(p) : null, serving };
    if (this.#isJoined(project, id)) return { ok: true, on, serving };
    return absent;
  }

  /* R12 `projectKeyNotice`: `{due, text}` for a member and a project until their own act records that they have read
     it; writes nothing. */
  /**
   * R12 `op=projectkeynotice`: whether a project key's notice is due for the member, and its words.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.project] the project's id
   * @returns {{ok: true, due: boolean, text: string} & Open} `text` with `{project}` filled with the project's name
   */
  projectKeyNotice({ member = null, project = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    const seen = id !== null && typeof project === "string"
      && !!this.#one(`SELECT member_id FROM project_key_notices WHERE member_id=? AND project_id=?`, id, project);
    return { ok: true, due: !seen, text: this.#disclosure(project).text };
  }

  /* R12 `projectKeyNoticeSeen`: the member's own act (R1's refusals), for a project they have joined, recorded once
     with its instant; again answers `already: true`. */
  /**
   * R12 `op=projectkeynoticeseen`: the member records, by her own act, that she has read a project key's notice.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.project] a project she has joined
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, seen: true, already: boolean} & Open) | Refusal | *} or R1's refusals, the project answered as absent,
   *   or membership's PROJECT_ACT_NOT_A_PARTICIPANT
   */
  projectKeyNoticeSeen({ member = null, project = null, by = null } = {}) {
    const bar = this.#accountBar(member, by);
    if (bar) return bar;
    const id = AiAccounts.#memberOf(member);
    const out = this.#participantBar(project, id, "reading a project key's notice");
    if (out) return out;
    const already = !!this.#one(`SELECT member_id FROM project_key_notices WHERE member_id=? AND project_id=?`, id, project);
    if (!already) this.sql.exec(`INSERT INTO project_key_notices (member_id, project_id, seen_at) VALUES (?,?,?)`, id, project,
      this.#at());
    return { ok: true, seen: true, already };
  }

  /* R12: PROJECT_KEY_NOTICE_DUE, minted here alone. */
  #projectNoticeDue(id, project) {
    /* DEC-49 REGION is-project-key-notice-seen */
    if (this.#one(`SELECT member_id FROM project_key_notices WHERE member_id=? AND project_id=?`, id, project)) return null;
    return AiAccounts.#row(AI_ACCOUNT_CHECKS, "PROJECT_KEY_NOTICE_DUE", localize("ai-accounts.index.this_member_has_not_yet_2", "this member has not yet read the notice that their questions go to Anthropic under this project's API account. Nothing was sent."),
      { member: id, project, project_name: this.#projectName(project), disclosure: this.#disclosure(project) });
    /* END DEC-49 REGION is-project-key-notice-seen */
  }

  /* R13 `projectAccountsSuspended`: for each project `viewer` owns whose sign-in account stopped serving because
     another member joined, `{project, member, since, key}`: `since` the earliest join among the participants other
     than the account's member (membership R127), the account's set instant when none is recorded (K2404 (1)); `key`
     stable per project and suspension. `at` is the caller's instant; the answer is the suspensions in force at the
     call. In-plane, for notice-producers R16; writes nothing and never throws (a read that fails answers none). */
  /**
   * R13: in-plane; the sign-in accounts of projects the viewer owns that stopped serving because another member joined.
   * @param {Object} [args]
   * @param {*} [args.viewer] the owner, `member:<id>`
   * @param {*} [args.at] the caller's instant
   * @returns {Array<{project: *, member: *, since: *, key: string} & Open>} `key` stable per project and suspension; none when
   *   a read fails
   */
  projectAccountsSuspended({ viewer = null, at = null } = {}) {
    try {
      const id = AiAccounts.#memberOf(viewer);
      if (id === null || isMachineIdentity(viewer)) return [];
      const out = [];
      for (const p of this.#rows(`SELECT project_id, member_id, set_at FROM project_accounts WHERE kind='signin'
                                  ORDER BY project_id`)) {
        if (!this.#isOwner(p.project_id, id)) continue;
        const parts = this.#participants(p.project_id);
        const others = parts ? parts.filter((x) => x.member !== p.member_id) : [];
        if (!others.length) continue;
        const sinces = others.map((x) => x.since).filter((x) => typeof x === "string" && x !== "").sort();
        const since = sinces.length ? sinces[0] : p.set_at;
        out.push({ project: p.project_id, member: p.member_id, since, key: `${p.project_id}|${p.member_id}|${since}` });
      }
      return out;
    } catch { return []; }
  }

  /* ===== A PROJECT'S MATERIAL LIMITS (R22; D38 C, B3) =====
   *
   * A project may keep its material away from the assistant, for every kind of use or the ones it names, set by any
   * one of its owners under R20's reason rule and appended as R20's are. A material limit binds every account,
   * whoever pays; `aiKeptAway` (R7) is the one site for both refusals. */

  /* R22 `projectAiKeepAwaySet`: an owner's act (R10's refusals), R20's reason rule, `uses` as R20's; answers the state. */
  /**
   * R22 `op=projectaikeepaway`: a project's material limit set by one of its owners, appended.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.on] only `true` is on
   * @param {*} [args.uses] as `aiKeepAwaySet`'s
   * @param {*} [args.reason] as `aiKeepAwaySet`'s
   * @param {*} [args.by] the stamped caller
   * @returns {({ok: true, project: *} & Limit & Open) | Refusal | *} the limit as it then stands; or the project answered as
   *   absent, membership's PROJECT_ACT_NOT_THE_OWNER, AI_KEEP_AWAY_NO_REASON or SWITCH_VALUE_INVALID
   * @bound reason: 1 to 2,000 characters, not blank, when `on` is true; a reason given is held to the same bounds
   */
  projectAiKeepAwaySet({ project = null, on = false, uses = null, reason = null, by = null } = {}) {
    const bar = this.#projectOwnerBar(project, by, "keeping a project's material away from the assistant");
    if (bar) return bar;
    const turnOn = on === true;
    const noReason = AiAccounts.#keepAwayReason(turnOn, reason);
    if (noReason) return noReason;
    const u = AiAccounts.#usesToStore(uses);
    if (u.fault) return u.fault;
    const given = typeof reason === "string" && reason.trim() !== "";
    this.#tx(() => {
      const at = this.#at();
      this.sql.exec(`INSERT INTO project_keep_away (project_id, is_on, uses, reason, set_by, set_at) VALUES (?,?,?,?,?,?)`,
        project, turnOn ? 1 : 0, u.json, given ? reason : null, AiAccounts.#memberOf(by), at);
      /* R16: the change beside it */
      this.#change(AiAccounts.#ownerOfProject(project), "limit_set",
        AiAccounts.#limitDetail({ is_on: turnOn, uses: u.json, reason: given ? reason : null }), by,
        `project_keep_away:${this.#lastSeq()}`, at);
    });
    return { ok: true, project, ...this.#projectLimit(project) };
  }

  /* R22 `projectAiKeepAwayState`: the project's limit, to its participants (joined or leaving); anyone else as absent.
     Writes nothing. */
  /**
   * R22 `op=projectaikeepawaystate`: a project's material limit, to its participants.
   * @param {Object} [args]
   * @param {*} [args.project] the project's id
   * @param {*} [args.viewer] the stamped viewer
   * @returns {({ok: true, project: *} & Limit & Open) | *} the limit, its fields null when it cannot be read; anyone not
   *   joined is answered as absent
   */
  projectAiKeepAwayState({ project = null, viewer = null } = {}) {
    const id = AiAccounts.#memberOf(viewer);
    const absent = noSuchProject(typeof project === "string" ? project : null);
    if (id === null || isMachineIdentity(viewer)) return absent;
    const unseen = this.#unseen(project, `member:${id}`);
    if (unseen) return unseen;
    if (!this.#isJoined(project, id)) return absent;
    try { return { ok: true, project, ...this.#projectLimit(project) }; }
    catch { return { ok: true, project, on: null, uses: null, reason: null, set_by: null, set_at: null }; }
  }

  /* R22 `projectsKeptAway`: the ids of the projects whose limit covers `use`, for reads under a grant (answers R30)
     and exploring's scope (ai-use R9). In-plane; writes nothing; null when the limits cannot be read, which its caller
     reads as unknown. */
  /**
   * R22: in-plane; the ids of the projects whose latest limit covers `use`.
   * @param {Object} [args]
   * @param {*} [args.use] a kind of use, or none (any limit that is on)
   * @returns {string[] | null} in id order; null when the limits cannot be read
   */
  projectsKeptAway({ use = null } = {}) {
    try {
      return this.#rows(`SELECT k.project_id, k.is_on, k.uses FROM project_keep_away k
                         WHERE k.seq = (SELECT MAX(seq) FROM project_keep_away q WHERE q.project_id = k.project_id)
                         ORDER BY k.project_id`)
        .filter((r) => AiAccounts.#covers({ on: !!r.is_on, uses: AiAccounts.#usesList(r.uses) }, use))
        .map((r) => r.project_id);
    } catch { return null; }
  }

  /* ===== THE SEAMS CREDENTIALS CALLS (R24–R26; map §1) =====
   *
   * credentials' grants (its R27, R32), run credential (R63) and keyed services (R29) call these; each is in-plane,
   * reached by no route and answered to no viewer, and none answers a key but R24's, to its one caller. */

  /* R24 `sealText`: `text` sealed under `owner` and `kind` by THE SEAL above (byte-identical to credentials' before T48),
     `{ok, sealed, iv}`, or ACCOUNT_SEAL_UNAVAILABLE when no seal secret is bound. Never throws. */
  /**
   * R24: in-plane; `text` sealed under `owner` and `kind`.
   * @param {Object} [args]
   * @param {*} [args.owner] the owner it is sealed under, read as a string
   * @param {*} [args.kind] its kind, read as a string
   * @param {*} [args.text] the text, read as a string
   * @returns {Promise<({ok: true, sealed: string, iv: string} & Open) | Refusal>} base64; or ACCOUNT_SEAL_UNAVAILABLE
   */
  async sealText({ owner = null, kind = null, text = null } = {}) {
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    try {
      const { sealed, iv } = await this.#encrypt(String(owner), String(kind), String(text));
      return { ok: true, sealed, iv };
    } catch {
      return AiAccounts.#sealRefusal(localize("ai-accounts.index.the_key_could_not_be", "the key could not be sealed by your team's Civicsmith. Nothing was stored or read."));
    }
  }

  /* R24 `unsealText`: the text sealed under `owner` and `kind`, `{ok, text}`; ACCOUNT_SEAL_UNAVAILABLE when no seal
     secret is bound or the row does not open (the seal secret changed, or another owner's or kind's row). Never throws. */
  /**
   * R24: in-plane; the text sealed under `owner` and `kind`.
   * @param {Object} [args]
   * @param {*} [args.owner] the owner it was sealed under
   * @param {*} [args.kind] its kind
   * @param {*} [args.sealed] as `sealText` answered it
   * @param {*} [args.iv] as `sealText` answered it
   * @returns {Promise<({ok: true, text: string} & Open) | Refusal>} or ACCOUNT_SEAL_UNAVAILABLE
   */
  async unsealText({ owner = null, kind = null, sealed = null, iv = null } = {}) {
    const unsealable = this.#seal();
    if (unsealable) return unsealable;
    const text = typeof sealed === "string" && typeof iv === "string"
      ? await this.#decrypt(String(owner), String(kind), sealed, iv) : null;
    if (text === null)
      return AiAccounts.#sealRefusal(localize("ai-accounts.index.the_key_does_not_open", "the key does not open under the seal secret of your team's Civicsmith, which has changed; an administrator sets it again. Nothing was used."));
    return { ok: true, text };
  }

  /* R25 `accountActBar`: R1's refusals for an act on `member`'s account by `by`, or null (credentials R27's first
     step). */
  /**
   * R25: in-plane; R1's refusals for an act on `member`'s account by `by`.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.by] the acting caller
   * @returns {Refusal | null} null when it is that active member's own act
   */
  accountActBar({ member = null, by = null } = {}) { return this.#accountBar(member, by); }

  /* R25 `accountServing`: R11's choice for `member`'s act of kind `use` in `project` (or none), without unsealing:
     `{refusal}`, or `{level, kind, project?, member?}`, never a key or a row (credentials R27's cascade). Writes
     nothing. */
  /**
   * R25: in-plane; R11's choice of account without unsealing, never a key.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @param {*} [args.use] the act's kind of use
   * @param {*} [args.project] the project the act is in, or none
   * @returns {({refusal: *} & Open) | ({level: string, kind: *, project?: *, member?: *} & Open)} the refusal as `accountFor` would
   *   answer it, short of unsealing
   */
  accountServing({ member = null, use = null, project = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    const r = this.#resolve(id, use, project === undefined ? null : project);
    if (r.refusal) return { refusal: r.refusal };
    return { level: /** @type {string} the cascade's level once nothing refused */ (r.level), kind: r.kind, ...(r.project !== undefined ? { project: r.project } : {}),
             ...(r.member !== undefined ? { member: r.member } : {}) };
  }

  /* R25 `servingAccountOf`: which account serves an active member's act now, `{level, signin?, suggestions,
     standing}`, or null (credentials R32). Writes nothing. */
  /**
   * R25: in-plane; which account serves the member's act now, and its two switches.
   * @param {Object} [args]
   * @param {*} [args.member] the member
   * @returns {({level: string, signin?: boolean, suggestions: boolean, standing: boolean} & Open) | null} null when none serves her
   */
  servingAccountOf({ member = null } = {}) {
    const id = AiAccounts.#memberOf(member);
    return id === null ? null : this.#servingAccount(id);
  }

  /* R25: the one-site helpers of C-29.14, C-29.20 and C-29.15 (K231), for credentials' grants and run credential. */
  /**
   * R25: in-plane; NOT_YOUR_ACCOUNT (C-29.14), minted at its one site.
   * @param {*} detail the asking act's fixed sentence
   * @returns {Refusal}
   */
  notYourAccount(detail) { return AiAccounts.#notYours(detail); }
  /**
   * R25: in-plane; NO_ACCOUNT (C-29.20), minted at its one site, carrying `member`.
   * @param {*} member
   * @param {*} [scope] `served` (no account serves the member), `own` or true (she holds no reference), `member` or
   *   `project` (the owner holds no account); it chooses the detail's sentence
   * @returns {Refusal}
   */
  noAccount(member, scope = "served") { return this.#noAccount(member, scope); }
  /**
   * R25: in-plane; ACCOUNT_MEMBER_NOT_ACTIVE (C-29.15), minted at its one site.
   * @param {*} detail the asking act's fixed sentence
   * @param {*} [extra] fields beside the refusal's own
   * @returns {Refusal}
   */
  accountMemberNotActive(detail, extra) { return AiAccounts.#row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", detail, extra); }

  /* R26 `onAccountCleared`: one registration per module, each refused through membership's R81 (a malformed one, or
     a module's second). Each `fn` is called once, inside the act, in registration order, with `{member, account, by,
     why, reference_held}` when a reference is removed (R1; `account` "reference") or a sign-in is cleared (R18, R27;
     `account` "signin"); `reference_held` says whether a reference of the member's still serves her. A listener's
     answer is ignored, and one that throws changes nothing of the act or of another listener's notice. */
  #clearedListeners = [];   // [{module, fn}]

  /**
   * R26: in-plane; one listener per module, told when a reference is removed or a sign-in is cleared.
   * @param {*} module the registering module's name
   * @param {*} fn `fn(AccountCleared)`, called once inside the act; its answer ignored, its throw changing nothing
   * @returns {Registered | *} or membership's LISTENER_MALFORMED or LISTENER_DECLARED (its R81)
   */
  onAccountCleared(module, fn) {
    const refused = listenerRefusal(this.#clearedListeners, module, fn);
    if (refused) return refused;
    this.#clearedListeners.push({ module, fn });
    return { ok: true, module };
  }

  #cleared(notice) {
    for (const { fn } of this.#clearedListeners) {
      try { fn({ ...notice }); } catch { /* the act stands */ }
    }
  }
}

/* R34 (T48; N1041, K3148): AI_KEPT_AWAY's fail-closed answer, with its row, as `aiKeptAway` answers it when the
   setting cannot be read: asked of the one site over no store, so it is that answer and never a copy of it. An in-plane
   caller whose call to `aiKeptAway` threw or could not be made answers this as given (K231). */
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deepFreeze(v); return Object.freeze(o); };
/** @type {Readonly<Refusal>} R34: AI_KEPT_AWAY as `aiKeptAway` answers it when the setting cannot be read, `keep_away`'s three null */
export const KEPT_AWAY_UNREADABLE = deepFreeze(new AiAccounts({ sql: null }).aiKeptAway());

/* K61: the one AiAccounts of a Durable Object's storage, made on first use over its `sql`, reaching record-core and
   membership by their factories on the same `ctx`; its first construction registers its revocation listener (R27).
   `record`, `membership` and `sealSecret` are read on the first call only (R32: credentials' factory passes the seal
   secret it is given). */
const OF = new WeakMap();
/**
 * K61, R32: the one instance for a Durable Object's storage, made and started on first use.
 * @param {*} ctx the Durable Object's state, or its storage
 * @param {Object} [opts] read on the first call only
 * @param {*} [opts.record] record-core's instance; else `recordOf(ctx)`
 * @param {*} [opts.membership] membership's instance; else `membershipOf(ctx)`
 * @param {*} [opts.sealSecret] the Worker's seal secret (R24)
 * @param {*} [opts.now] the instance clock (R39)
 * @returns {AiAccounts}
 */
export function aiAccountsOf(ctx, { record = null, membership = null, sealSecret = null, now = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let a = OF.get(storage);
  if (!a) {
    a = new AiAccounts({ sql: storage.sql, core: record ?? recordOf(ctx),
                         membership: membership ?? membershipOf(ctx, { record }), sealSecret, now });
    OF.set(storage, a);
    a.start();
  }
  return a;
}

/* R32: the ops this module answers, as entries of the plane's one route map (spread by the plane before
   credentials'), copied from `credentialsOps` with their names unchanged. `url` carries the control plane's stamps
   (`by`, `viewer`) in its query, read AFTER the body is spread, so a caller's own copy never wins (D-136); `body` is the
   parsed body; a secret only ever in the body, never the query. The in-plane reads (`accountReferenceFor`,
   `accountFor`, `groupKeySwitches`, `subscriptionConnected`, `subscriptionTokenHold`, `subscriptionTokenRefused`,
   `accountUsesOf`, `aiKeptAway`, `projectAccountsSuspended`, `projectsKeptAway`, `disclosureDue` and R24–R26) are not
   routed; the retired `accountswitchset` and `groupswitchset` (R4, R9) are not in it. Which credential reaches each op
   is op-declarations' and control-plane's. */
/**
 * R32: this module's ops, by their door names, each answering its act's answer.
 * @param {*} a this module's instance, or credentials' instance, which answers through its `accounts`
 * @param {URL} url the request's address, carrying the door's stamps `by`, `viewer` and the query fields
 * @param {*} body the parsed body
 * @param {*} env the store's environment, read for the instance clock (R39)
 * @returns {Object<string, () => *>} subscriptiondisconnect, accountreferenceset, accountreferenceremove,
 *   accountreference, groupkeyset, groupkeyremove, groupkeyswitch, groupkeystate, groupkeynotice, groupkeynoticeseen,
 *   aikeepaway, aikeepawaystate, accountusesset, accountuses, accounthistory, projectkeyset, projectsigninset,
 *   projectaccountremove, projectaccountswitch, projectaccountstate, projectkeynotice, projectkeynoticeseen,
 *   projectaikeepaway, projectaikeepawaystate
 * @bound the stamps are read after the body, so a body's own `by`, `member` or `viewer` never wins
 */
export function aiAccountsOps(a, url, body, env) {
  /* R39 (K5192): the store's environment is the instance clock's source (`#nowMs`). `a` is the instance, or `credentials`'
     instance, which answers through its `accounts`; both read the same clock. */
  const owner = a instanceof AiAccounts ? a : a?.accounts;
  if (owner && env && typeof env === "object") owner.env = env;
  const bodyField = (k) => (body && typeof body === "object" && !Array.isArray(body) && typeof body[k] === "string" ? body[k] : null);
  const by = () => url.searchParams.get("by");
  return {
    /* R18: the member's own act; `subscriptionConnected` is in-plane and not routed. */
    subscriptiondisconnect: () => a.subscriptionDisconnect({ member: url.searchParams.get("by"), by: url.searchParams.get("by") }),
    /* R1, R38: the member's own account. The door's stamped `by` is both the member and the act; a `member` in the body is not read. */
    accountreferenceset: () => a.accountReferenceSet({ ...(body || {}), member: by(), by: by() }),
    accountreferenceremove: () => a.accountReferenceRemove({ member: by(), by: by() }),
    accountreference: () => a.accountReferenceState({ member: url.searchParams.get("member"),
                                                      viewer: url.searchParams.get("viewer") }),
    /* R5, R6, R8: the group's key and its notice */
    groupkeyset: () => a.groupKeySet({ ...(body || {}), by: url.searchParams.get("by") }),
    groupkeyremove: () => a.groupKeyRemove({ by: url.searchParams.get("by") }),
    groupkeyswitch: () => a.groupKeySwitch({ ...(body || {}), by: url.searchParams.get("by") }),
    groupkeystate: () => a.groupKeyState({ viewer: url.searchParams.get("viewer") }),
    groupkeynotice: () => a.groupKeyNotice({ member: url.searchParams.get("viewer") }),
    groupkeynoticeseen: () => a.groupKeyNoticeSeen({ member: url.searchParams.get("by"), by: url.searchParams.get("by") }),
    /* R20, R21 (DEC-172): the keep-away act, `by` the stamp after the body; its state, which reaches every active
       member through the op's spec (op-declarations, control-plane). */
    aikeepaway: () => a.aiKeepAwaySet({ ...(body || {}), by: url.searchParams.get("by") }),
    aikeepawaystate: () => a.aiKeepAwayState(),
    /* R10–R14, R22 (T40): every account's switches, a project's account, its key's notice and its material limits;
       `by` and `viewer` the stamps after the body. */
    accountusesset: () => a.accountUsesSet({ ...(body || {}), by: by() }),
    /* (T41; R15, R16) an account's panel: its uses and keep-aways, and its changes, to its owners; `viewer` the stamp */
    accountuses: () => a.accountUses({ owner: url.searchParams.get("owner"), viewer: url.searchParams.get("viewer") }),
    accounthistory: () => a.accountHistory({ owner: url.searchParams.get("owner"), viewer: url.searchParams.get("viewer"),
                                             limit: url.searchParams.get("limit") }),
    projectkeyset: () => a.projectKeySet({ ...(body || {}), by: by() }),
    projectsigninset: () => a.projectSigninSet({ ...(body || {}), by: by() }),
    projectaccountremove: () => a.projectAccountRemove({ ...(body || {}), by: by() }),
    projectaccountswitch: () => a.projectAccountSwitch({ ...(body || {}), by: by() }),
    projectaccountstate: () => a.projectAccountState({ project: url.searchParams.get("project"),
                                                       viewer: url.searchParams.get("viewer") }),
    projectkeynotice: () => a.projectKeyNotice({ member: url.searchParams.get("viewer"), project: url.searchParams.get("project") }),
    projectkeynoticeseen: () => a.projectKeyNoticeSeen({ project: bodyField("project") ?? url.searchParams.get("project"),
                                                         member: by(), by: by() }),
    projectaikeepaway: () => a.projectAiKeepAwaySet({ ...(body || {}), by: by() }),
    projectaikeepawaystate: () => a.projectAiKeepAwayState({ project: url.searchParams.get("project"),
                                                             viewer: url.searchParams.get("viewer") }),
  };
}

/* R35 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
/**
 * @typedef {Object} DeclaredOp one op's declaration (R35–R37; op-declarations R80)
 * @property {string[]} classes the credential classes it reaches
 * @property {string[]} machineClasses the machine classes it reaches
 * @property {boolean} mutating
 * @property {string} weight
 * @property {string} description
 * @property {{accepts: string[], requires: string[]}} fields the body's fields the arm reads, and those it needs
 */
/** @type {Readonly<Object<string, DeclaredOp>>} the ops the screens send, keyed by door name (R35, R36, R37) */
export const DECLARED_OPS = Object.freeze({
  subscriptiondisconnect: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.subscriptiondisconnect", "credential governance: a member clears their own subscription fact; the subject is a credential, not a bundle"),
    fields: { accepts: [], requires: [] } },
  groupkeynoticeseen: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("ai-accounts.declared.groupkeynoticeseen", "personal state, keyed by member: the notice of the group's key seen by them"),
    fields: { accepts: [], requires: [] } },
  groupkeyremove: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.groupkeyremove", "credential governance: the group's assistant key, an administrator's"),
    fields: { accepts: [], requires: [] } },
  groupkeyswitch: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description: localize("ai-accounts.declared.groupkeyswitch", "the copy's configuration: whether the group's assistant key is on; an administrator's, not an act on an object"),
    fields: { accepts: ["on"], requires: [] } },
  groupkeyset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.groupkeyset", "credential governance: the group's assistant key, an administrator's; never answered"),
    fields: { accepts: ["key"], requires: ["key"] } },
  accountreferenceset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.accountreferenceset", "credential governance: a member's own assistant account reference, never answered; the subject is a credential, not a bundle"),
    fields: { accepts: ["kind","secret"], requires: ["kind","secret"] } },
  accountreferenceremove: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.accountreferenceremove", "credential governance: a member removes their own account reference; the subject is a credential, not a bundle"),
    fields: { accepts: [], requires: [] } },
  accountusesset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description: localize("ai-accounts.declared.accountusesset", "the account's configuration: an owner sets one of its uses' switches (explore no, ask or yes); it moves no document, claim or grade"),
    fields: { accepts: ["owner","switch","on"], requires: ["owner","switch","on"] } },
  projectkeyset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.projectkeyset", "credential governance: an owner holds the project's API key, never answered; the subject is who pays for the assistant, not a bundle"),
    fields: { accepts: ["project","key"], requires: ["project","key"] } },
  projectsigninset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.projectsigninset", "credential governance: the sole participant's own sign-in made the project's account; the subject is who pays for the assistant, not a bundle"),
    fields: { accepts: ["project"], requires: ["project"] } },
  projectaccountremove: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("ai-accounts.declared.projectaccountremove", "credential governance: an owner removes the project's account; the subject is who pays for the assistant, not a bundle"),
    fields: { accepts: ["project"], requires: ["project"] } },
  projectaccountswitch: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description: localize("ai-accounts.declared.projectaccountswitch", "the account's configuration: whether the project's account is on; an owner's; moves no document, claim or grade"),
    fields: { accepts: ["project","on"], requires: ["project"] } },
  projectaikeepaway: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("ai-accounts.declared.projectaikeepaway", "setting: whether a project keeps its material away from the assistant, an owner's act with a reason; moves no bundle"),
    fields: { accepts: ["project","on","uses","reason"], requires: ["project"] } },
  projectkeynoticeseen: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("ai-accounts.declared.projectkeynoticeseen", "personal state, keyed (member, project): the notice of the project's account seen by them"),
    fields: { accepts: ["project"], requires: ["project"] } },
  aikeepaway: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("ai-accounts.declared.aikeepaway", "setting: whether the group keeps its material away from every assistant, an administrator's act with a reason; moves no bundle"),
    fields: { accepts: ["on","uses","reason"], requires: [] } },
});
