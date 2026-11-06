/* ai-use — what each AI account has spent and may spend (requirements: `build/requirements/ai-use.md`, R1–R15). A new
 * module of layer 6, directly before `ai-runs` (K657, K1043; N812, K2373). Built by copy (K624): the counter, the use
 * figures' checks and the reads come from `ai-runs/index.mjs`:2588–2932 (its R48–R51), re-keyed by the paying account
 * (`owner`) and the kind of use (B8); `ai-runs`' own job deletes its copy and re-points after this module merges. The
 * member ceilings of that block are replaced by the account limits (R2, B4), judged per account (R3, D38, D39, B5); the
 * reads, the told-once reach (R5), the exploring gate and its daily ask (R6, R9; A5, K2350), the cost before and after
 * (R10, R11; D12), each account's limits panel (R12; DEC-188) and its use over thirty days (R14; DEC-215 (1)) are new.
 *
 * It holds no credential and never chooses which account pays (`ai-accounts`' R11): a caller names the `owner` its
 * `accountFor` answered. Every use is still the act of the member who made it (K1755): it is counted to that account and
 * to that member. Nobody reads another member's spending; a cost is answered only to the paying account's owners
 * (K1450 as D12 retires it for them).
 *
 * SHAPE (K61). `aiUseOf(ctx, deps)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`,
 * reaching record-core, membership, ai-accounts and connections by their factories on the same `ctx`; a test may pass
 * its own as `deps` (`record`, `membership`, `accounts`, `connections`, and `zone`, the group's zone or a function
 * answering it) on the first call. Its first construction migrates and declares its tables (R7). No service throws.
 */
import { isMachineIdentity, normalizeType } from "../record-grammar/index.mjs";
import { localDay } from "../civil-time/index.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, notAnAdmin, notTheOwner } from "../membership/index.mjs";
import { aiAccountsOf, KEPT_AWAY_UNREADABLE, USE_KINDS, PART_OF_KIND } from "../ai-accounts/index.mjs";
import { estimate as entryEstimate } from "../../../agent-model/src/provider/catalogue.mjs";
import { aiCatalogueOf } from "../ai-catalogue/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { AI_RUNS_CHECKS } from "../run-rules/index.mjs";
import { AI_USE_SCHEMA, AI_USE_TABLES, AI_USE_ADDED_COLUMNS } from "./schema.mjs";
import { AI_USE_CHECKS, AI_USE_WORDS, AI_USE_NEW_WORDS, LIMIT_WORD_BY_SCOPE, UNJUDGED_WORD, WHOSE_WORD, PERIOD_WORD, WHEN_WORD, MONTH_WORD,
  LIMIT_FIELD_WORD, useInlineWord, useNameWord, fillWords } from "./checks.mjs";
import { localize } from "../setup-words/index.mjs";
export { AI_USE_SCHEMA, AI_USE_TABLES, AI_USE_ADDED_COLUMNS } from "./schema.mjs";
export { AI_USE_CHECKS, AI_USE_WORDS, AI_USE_NEW_WORDS, LIMIT_WORD_BY_SCOPE, UNJUDGED_WORD, WHOSE_WORD, PERIOD_WORD, WHEN_WORD, MONTH_WORD,
  LIMIT_FIELD_WORD, useInlineWord, useNameWord, fillWords } from "./checks.mjs";

/** R1 (was ai-runs R48; T53, `agent-model` R5): the token figures of one conversation's neutral `usage` record, each a
 *  whole number or `null` where the provider did not state it (its name then in `unstated`), never 0 for an unstated one. */
export const USAGE_TOKEN_FIGURES = Object.freeze(["input_tokens", "output_tokens", "cache_read_input_tokens",
  "cache_creation_input_tokens"]);
/** R1 (T53): the reasoning tokens, summed with the others; absent reads as not stated. */
export const REASONING_FIGURE = "reasoning_tokens";
/** The two cost figures of the record before T53 (`total_cost_usd`, `estimated_cost_usd`), still read from a caller not
 *  yet on R5's record: the first as `cost_reported` in `usd`, the second as `cost_estimated` in `usd`. */
export const USAGE_COST_FIGURES = Object.freeze(["total_cost_usd", "estimated_cost_usd"]);
/** R1: the modes an ask's use is counted under (`countAskUsage`): an ask, or a draft (run-rules R21); neither is a run. */
export const ASK_USAGE_MODES = Object.freeze(["ask", "draft"]);
/** R2 (B4): a limit's scopes besides the kinds of use, its units and its periods. */
export const LIMIT_UNITS = Object.freeze(["usd", "tokens", "calls"]);
export const LIMIT_PERIODS = Object.freeze(["day", "month"]);
/** R1, R4 (B8): the owner a row counted before T40 is kept under; it counts toward no limit. */
export const NOT_RECORDED = "not recorded";
/** R10 (D12; K2480): an estimate needs at least `ESTIMATE_MIN_ACTS` measured acts and reads the latest `ESTIMATE_SAMPLE`
 *  (T53's parameters, as `draft-ai-use.md` proposes them, K5457). */
export const ESTIMATE_MIN_ACTS = 5;
export const ESTIMATE_SAMPLE_SIZE = 20;
export const ESTIMATE_SAMPLE = Object.freeze({ min: ESTIMATE_MIN_ACTS, of: ESTIMATE_SAMPLE_SIZE });
/** R9: the longest statement of what is worth exploring kept with an ask. */
export const EXPLORE_WHAT_MAX = 2000;
/** R15 (T50; N1168; T53): an effort a conversation ran at, a lowercase word of at most `EFFORT_WORD_MAX` letters. */
export const EFFORT_WORD_MAX = 16;
const EFFORT_WORD = /^[a-z]{1,16}$/;
/** R14, R27 (T53): the local days a use over time spans. */
export const USE_DAYS = 30;
/** R18 (T53; BR23): how long a provider limit recorded with no reset time stands before one call may probe it. */
export const PROVIDER_REPROBE_MS = 900000;
/** R18: the kinds and scopes of a provider limit (`agent-model` R52). */
export const PROVIDER_LIMIT_KINDS = Object.freeze(["spend", "quota", "rate_window", "plan_window"]);
export const PROVIDER_LIMIT_SCOPES = Object.freeze(["account", "entry"]);
/** R23 (T53; BR24): a percent threshold's bounds. */
export const THRESHOLD_PERCENT_MIN = 1;
export const THRESHOLD_PERCENT_MAX = 99;
export const THRESHOLD_KINDS = Object.freeze(["percent", "amount"]);
/** R25 (T53): the share a figure may differ by and still be within tolerance (2 percent). */
export const RECONCILE_TOLERANCE = 0.02;
/** R31–R33 (T53; AD38; K5487): an entry's least calls in a day for the report to hold it, the most days back a report
 *  reaches, the days `ai_health` keeps, and the report's version. */
export const HEALTH_MIN_CALLS = 10;
export const HEALTH_DAYS_MAX = 7;
export const HEALTH_KEEP_DAYS = 90;
export const HEALTH_REPORT_VERSION = 1;
/** R31: `agent-model`'s closed lists of outcomes and error classes, as `countHealth` accepts them. */
export const HEALTH_OUTCOMES = Object.freeze(["result", "refused", "silent", "error", "limit"]);
export const HEALTH_ERROR_CLASSES = Object.freeze(["rate_limit", "provider_limit", "overload", "timeout", "auth", "model_gone",
  "content_refusal", "malformed", "pin_violation", "unsupported_control", "request_rejected", "circuit_open"]);
/** R1, R11 (T53; `agent-model` R26): the fields of a conversation's label. */
/** R28 (T53): the mode a re-test's use is counted under, so its entry's monthly cap reads re-tests alone. */
export const RETEST_MODE = "retest";
export const LABEL_FIELDS = Object.freeze(["provider", "host", "model_version", "effort", "account_level", "owner"]);

/** A member's id from any of the forms a stamp takes (`member:<id>`, `member:<id>/<tokenId>`, `<id>`); null for a
 *  machine identity, an absent value, or a deploy class. (Copied from ai-runs, K624.) */
function memberIdOf(x) {
  if (typeof x !== "string") return null;
  const t = x.trim();
  if (!t || isMachineIdentity(t) || t.startsWith("class:") || t.startsWith("token:")) return null;
  const bare = t.startsWith("member:") ? t.slice(7) : t;
  const id = bare.split("/")[0];
  return /^[A-Za-z0-9._-]{1,128}$/.test(id) ? id : null;
}

/** R1, R2 (`ai-accounts` R10, R11, R14): an owner's spelling, `group`, `project:<id>` or `member:<id>`, parsed; null for any
 *  other. */
export function parseOwner(owner) {
  if (owner === "group") return { kind: "group", owner: "group" };
  if (typeof owner !== "string") return null;
  const m = /^(project|member):([A-Za-z0-9._-]{1,128})$/.exec(owner.trim());
  return m ? { kind: m[1], id: m[2], owner: `${m[1]}:${m[2]}` } : null;
}
const whoseOf = (p) => (p.kind === "group" ? "group" : p.kind === "project" ? "project" : "own");
const tokensOf = (r) => Number(r.input_tokens) + Number(r.output_tokens) + Number(r.cache_read_input_tokens)
  + Number(r.cache_creation_input_tokens);

export class AiUse {
  constructor(ctx, deps = {}) {
    this.ctx = ctx;
    const storage = ctx && ctx.storage ? ctx.storage : ctx;
    this.sql = storage.sql;
    this.#deps = deps || {};
    /* R17 (K5132, K5148): the clock this instance was handed (`now`, a function of milliseconds), and the store's
       environment (`env.BIO_NOW_MS`), set here or by `aiUseOps`; both are read by `#nowMs` */
    this.clock = typeof this.#deps.now === "function" ? this.#deps.now : null;
    this.env = this.#deps.env && typeof this.#deps.env === "object" ? this.#deps.env : null;
    this.record = this.#deps.record || recordOf(ctx);
    this.membership = this.#deps.membership || membershipOf(ctx, { record: this.record });
  }
  #deps;

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #accounts() { return this.#deps.accounts || aiAccountsOf(this.ctx, { record: this.record, membership: this.membership }); }
  /** T53 (`ai-catalogue` R16, R28, R29): the catalogue, as handed in, else as ai-accounts holds it, else the store's own. */
  #catalogue() {
    if (this.#deps.catalogue) return this.#deps.catalogue;
    try { const a = this.#accounts(); if (a && a.catalogue) return a.catalogue; } catch { /* the store's own below */ }
    try { return aiCatalogueOf(this.ctx, { record: this.record }); } catch { return null; }
  }
  #connections() { return this.#deps.connections || connectionsOf(this.ctx); }
  /** Every write this module makes outside a caller's transaction goes through record-core's `transact` (its R32). */
  #transact(fn) { return typeof this.record.transact === "function" ? this.record.transact(fn) : fn(); }

  /* ===== START: the tables (R7) ===== */

  /** R1, R2, R7: this module's tables, created if absent, the pre-T40 counter and ceilings carried over once and their
   *  old tables dropped (T42; N848), then declared to record-core. Idempotent; run at the first construction
   *  (`aiUseOf`). */
  migrate() {
    const cols = (t) => this.#rows(`PRAGMA table_info(${t})`).map((r) => r.name);
    const before = cols("ai_usage");
    const carried = before.length && !before.includes("owner");
    if (carried) this.sql.exec(`ALTER TABLE ai_usage RENAME TO ai_usage_before_t40`);
    const bare = AI_USE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    for (const [t, c, decl] of AI_USE_ADDED_COLUMNS) if (!cols(t).includes(c)) this.sql.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${decl}`);
    if (carried) this.#carryCounter();
    this.#carryCeilings();
    this.#carryDollars();
    this.declareTables();
  }

  /** R1 (B8): rows counted before T40 named no payer: each is kept, owner "not recorded", its kind of use read from its
   *  mode (an ask's or a draft's own, else a run's), so it counts toward no limit. */
  #carryCounter() {
    this.sql.exec(
      `INSERT INTO ai_usage (owner, member, day, use, mode, calls, input_tokens, output_tokens, cache_read_input_tokens,
         cache_creation_input_tokens, cost_micro_usd, tokens_unstated, cost_unstated)
       SELECT ?, member, day, CASE WHEN mode IN ('ask', 'draft') THEN mode ELSE 'run' END, mode, calls, input_tokens,
         output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_micro_usd, tokens_unstated, cost_unstated
       FROM ai_usage_before_t40`, NOT_RECORDED);
    this.sql.exec(`DROP TABLE ai_usage_before_t40`);
  }

  /** R2 (B4): today's ceilings, once: a member's own daily ceiling becomes that member's account's `overall` day limits
   *  in tokens and calls; the copy-wide ceiling the group account's `per_member` day limits. Each is recorded in the
   *  history as set by the migration. (T42; N848) Once carried, `ai_ceilings` is dropped, as the pre-T40 counter is, so
   *  a migrated store holds no table a fresh one lacks; a store whose carry already ran but which still holds the table
   *  drops it here, at its next migration. */
  #carryCeilings() {
    if (!this.#one(`SELECT name FROM ai_use_migrations WHERE name='ceilings'`)) this.#carryCeilingsOnce();
    this.sql.exec(`DROP TABLE IF EXISTS ai_ceilings`);
  }

  #carryCeilingsOnce() {
    const now = stampInstant("second", this.#nowMs());
    const held = this.#rows(`SELECT name FROM sqlite_master WHERE type='table' AND name='ai_ceilings'`).length
      ? this.#rows(`SELECT holder, tokens, calls FROM ai_ceilings ORDER BY holder`) : [];
    for (const c of held) {
      const own = typeof c.holder === "string" && c.holder.startsWith("member:") ? parseOwner(c.holder) : null;
      const target = c.holder === "copy" ? { owner: "group", scope: "per_member" } : own ? { owner: own.owner, scope: "overall" } : null;
      if (!target) continue;
      for (const unit of ["tokens", "calls"]) {
        const v = Number(c[unit]);
        if (c[unit] == null || !Number.isSafeInteger(v) || v < 1) continue;
        if (this.#limit(target.owner, target.scope, unit, "day")) continue;
        this.#write(target.owner, target.scope, unit, "day", v, null, "migration:ceilings", now);
      }
    }
    this.sql.exec(`INSERT INTO ai_use_migrations (name, at) VALUES ('ceilings', ?)`, now);
  }

  /** R1 (T53; B6): the dollars the counter summed before T53 (one figure, the estimate or the provider's) become
   *  `cost_estimated_sum` in `usd`, with `entry_id` null; once. */
  #carryDollars() {
    if (this.#one(`SELECT name FROM ai_use_migrations WHERE name='money-t53'`)) return;
    this.sql.exec(`INSERT INTO ai_usage_money (owner, member, day, use, mode, unit, reported_micro, reported_calls, estimated_micro, estimated_calls)
                   SELECT owner, member, day, use, mode, 'usd', 0, 0, cost_micro_usd, MAX(calls - cost_unstated, 1) FROM ai_usage WHERE cost_micro_usd > 0
                   ON CONFLICT(owner, member, day, use, mode, unit) DO UPDATE SET estimated_micro = estimated_micro + excluded.estimated_micro,
                     estimated_calls = estimated_calls + excluded.estimated_calls`);
    this.sql.exec(`UPDATE ai_usage SET cost_micro_usd = 0 WHERE cost_micro_usd > 0`);
    this.sql.exec(`UPDATE ai_use_acts SET estimated_micro = cost_micro_usd, estimated_calls = calls - cost_unstated, money_unit = 'usd', cost_micro_usd = 0
                   WHERE cost_micro_usd > 0`);
    this.sql.exec(`INSERT INTO ai_use_migrations (name, at) VALUES ('money-t53', ?)`, stampInstant("second", this.#nowMs()));
  }

  /** R7: the tables declared once through record-core (its R21): `admin-only`, `sight: "group"`, purged only with the
   *  whole store, a project's limits, their history, its reached rows and its asks also with the project. */
  declareTables() {
    if (this.#declared) return false;
    const answer = this.record.declareTable("ai-use", AI_USE_TABLES.map((t) => ({ ...t, keys: [...t.keys] })));
    if (answer && answer.ok === false)
      throw new Error(`ai-use: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }
  #declared = false;

  /* ===== The refusals (R8, R13) ===== */

  /** One refusal with its row: this module's (R8), or `run-rules`' by key (`AI_RUN_CONSUME_INVALID`,
   *  `NOT_YOUR_CEILING`; its R11, R20). */
  #refuse(code, detail, extra = {}) {
    const row = AI_USE_CHECKS[code] || AI_RUNS_CHECKS[code] || { check: null, translation: null };
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
  }

  /** R13 (K2514; T43, DEC-189 (1); T44, DEC-191 (2), DEC-192 (4)): `AI_LIMIT_REACHED`'s sentence for `lim` reached in
   *  the period starting `start`, answered whole so every caller relays a filled sentence, every fill read by key and
   *  none written here: `{whose}` from `ai.whose.*`, `{use}` from `ai.use.<use>.inline` (`{Use}` from `.name`),
   *  `{period}` from `ai.period.*`, `{when}` from `ai.when.day`, or `ai.when.month` with `{month}`, the next period's
   *  month, from `date.month.*`; never a cost. */
  static #limitSentence(key, whose, lim, start) {
    const w = (k) => AI_USE_WORDS[k];
    const when = lim.period === "month"
      ? fillWords(w(WHEN_WORD.month), { month: w(MONTH_WORD[Number(start.slice(5, 7)) % 12]) }) : w(WHEN_WORD.day);
    const fills = { whose: w(WHOSE_WORD[whose]), period: w(PERIOD_WORD[lim.period]), when };
    if (USE_KINDS.includes(lim.scope)) Object.assign(fills, { use: w(useInlineWord(lim.scope)), Use: w(useNameWord(lim.scope)) });
    return fillWords(w(key), fills);
  }

  /** R3, R13: `AI_LIMIT_REACHED`, the one site that mints it (K231), naming no cost. For a limit reached, its sentence
   *  read by its scope (a use's own, any of the nine: `ai.refused.limit`; T44, DEC-191 (2)) and filled whole
   *  (`#limitSentence`). With no `lim` the limit cannot be judged (T43; N856; DEC-189 (5): no paying account named, the
   *  use not a `USE_KINDS` entry, or the counter unreadable): still the refusal, failing closed, but `unjudged: true` and
   *  no `scope`, `unit` or `period`, since nothing was reached; its sentence `ai.refused.limit.unjudged` with `{whose}`
   *  only (the group's words when no account is named, `whose` then null; K2720). */
  #limitReached(p, lim, use, start, why = null) {
    const whose = p ? whoseOf(p) : null;
    if (!lim) {
      const translation = fillWords(AI_USE_WORDS[UNJUDGED_WORD], { whose: AI_USE_WORDS[WHOSE_WORD[whose || "group"]] });
      /* DEC-49 REGION is-ai-limit-reached */
      return { ...this.#refuse("AI_LIMIT_REACHED", localize("ai-use.index.why_nothing_was_started", "{why} Nothing was started.", { why: String(why) })), translation, word: UNJUDGED_WORD,
        unjudged: true, whose, use: use ?? null };
    }
    const scope = lim.scope;
    /* a re-test cap (R28, `retest:<entry>`) names no use: the overall sentence */
    const word = LIMIT_WORD_BY_SCOPE[scope] || (scope.startsWith("retest:") ? LIMIT_WORD_BY_SCOPE.overall : "ai.refused.limit");
    return { ...this.#refuse("AI_LIMIT_REACHED", localize("ai-use.index.owner_s_period_limit_scope", "{owner}'s {period} limit ({scope}, in {unit}) is reached for the period from {start}. Nothing was started.", { owner: String(p.owner), period: String(lim.period), scope: String(scope), unit: String(lim.unit), start: String(start) })), translation: AiUse.#limitSentence(word, whose, lim, start),
      word, whose, scope, unit: lim.unit, period: lim.period, period_start: start, use: use ?? null };
    /* END DEC-49 REGION is-ai-limit-reached */
  }

  /** R2: an invalid limit, naming the field, its sentence's `{field}` filled from `ai.limitfield.<field>` (R13). */
  #invalid(field, detail) {
    const translation = fillWords(AI_USE_WORDS["ai.refused.limitinvalid"], { field: AI_USE_WORDS[LIMIT_FIELD_WORD[field]] });
    /* DEC-49 REGION is-ai-limit-invalid */
    return this.#refuse("AI_LIMIT_INVALID", localize("ai-use.index.detail_nothing_was_changed", "{detail} Nothing was changed.", { detail: String(detail) }), { field, word: "ai.refused.limitinvalid", translation });
    /* END DEC-49 REGION is-ai-limit-invalid */
  }

  /** R3, R6, R9: exploring is `no` on the account. */
  #exploreOff(p) {
    const whose = whoseOf(p);
    /* DEC-49 REGION is-explore-not-enabled */
    return { ...this.#refuse("EXPLORE_NOT_ENABLED", localize("ai-use.index.exploring_is_set_to_no", "exploring is set to no on {owner}'s account, so it pays for no exploring. Nothing was started.", { owner: String(p.owner) })), translation: fillWords(AI_USE_WORDS["ai.refused.explorenotenabled"],
      { whose: AI_USE_WORDS[WHOSE_WORD[whose]] }), word: "ai.refused.explorenotenabled", whose, owner: p.owner };
    /* END DEC-49 REGION is-explore-not-enabled */
  }

  /** R6, R8, R13 (T44; N859, N869; DEC-191 (1)): the question lies outside what `p`'s account explores. Carries `whose`
   *  as `AI_LIMIT_REACHED` does; its sentence `ai.refused.exploreoutofscope`, `{whose}` filled from `ai.whose.*`. */
  #outOfScope(p) {
    const whose = whoseOf(p);
    /* DEC-49 REGION is-explore-out-of-scope */
    return this.#refuse("EXPLORE_OUT_OF_SCOPE", localize("ai-use.index.the_question_is_not_one", "the question is not one {owner}'s account explores. Nothing was started.", { owner: String(p.owner) }),
      { owner: p.owner, whose, word: "ai.refused.exploreoutofscope",
        translation: fillWords(AI_USE_WORDS["ai.refused.exploreoutofscope"], { whose: AI_USE_WORDS[WHOSE_WORD[whose]] }) });
    /* END DEC-49 REGION is-explore-out-of-scope */
  }

  /** R9: an ask or approval naming no day or no thing worth exploring; its sentence `ai.refused.exploreaskinvalid`
   *  (R13; T44, DEC-191 (1)). */
  #askFault(field, detail) {
    /* DEC-49 REGION is-explore-ask-invalid */
    return this.#refuse("EXPLORE_ASK_INVALID", localize("ai-use.index.detail_nothing_was_recorded", "{detail} Nothing was recorded.", { detail: String(detail) }),
      { field, word: "ai.refused.exploreaskinvalid", translation: AI_USE_WORDS["ai.refused.exploreaskinvalid"] });
    /* END DEC-49 REGION is-explore-ask-invalid */
  }

  /* ===== Time (R1–R5, R9) ===== */

  /** The group's zone (`retrieval` R69, as ai-runs reads it; K2480), or the one a test hands in; UTC when it cannot be
   *  read. */
  #zone() {
    const z0 = this.#deps.zone;
    try {
      const z = typeof z0 === "function" ? z0() : z0 !== undefined ? z0 : retrievalOf(this.ctx).zone();
      return typeof z === "string" && z ? z : "UTC";
    } catch { return "UTC"; }
  }

  /** R17 (T51 fix round 10; K5132, K5148; R-CLOCK): the instance clock. A handed `now` answers first; else the store's
   *  `env.BIO_NOW_MS`; else the wall clock (credentials' `#nowMs`). Every instant this module records, and every judgement
   *  of one, reads it. */
  #nowMs() {
    if (this.clock) {
      const handed = Number(this.clock());
      if (Number.isFinite(handed) && handed >= 0) return handed;
    }
    const raw = this.env ? this.env.BIO_NOW_MS : undefined;
    if (raw !== undefined && raw !== null && raw !== "") {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
    return Date.now();
  }

  /** An instant (ms, or an ISO string) as the record's spelling; now (on the instance clock, R17) when absent or unreadable. */
  #ms(at) { const ms = typeof at === "string" ? Date.parse(at) : typeof at === "number" ? at : NaN; return Number.isFinite(ms) ? ms : this.#nowMs(); }
  static #iso(ms) { return stampInstant("second", ms); }

  /** R1: the local day, in the group's zone, on which an instant falls (`civil-time.localDay`); UTC's when the zone
   *  cannot be read. */
  #dayOf(at) {
    const iso = AiUse.#iso(this.#ms(at));
    const zone = this.#zone();
    const d = localDay(iso, zone);
    if (typeof d === "string") return { day: d, zone };
    return { day: localDay(iso, "UTC"), zone: "UTC" };
  }

  /** R2: a period's start for the day `day` (`YYYY-MM-DD`): the day itself, or the 1st of its month. */
  static #start(period, day) { return period === "month" ? `${day.slice(0, 7)}-01` : day; }
  /** The SQL that keeps a counter row inside the period starting `start`. */
  static #inPeriod(period) { return period === "month" ? "substr(day, 1, 7) = substr(?, 1, 7)" : "day = ?"; }

  /* ===== COUNTING (R1, R15, R21, R31) ===== */

  /** R1, R15: a conversation's entry and label, checked: `{entry_id, label}` (each label field a string or null), or the
   *  refusal's detail. `model` and `effort`, the shape before T53, are read as the label's `model_version` and `effort`. */
  static #labelOf({ entry_id, label, model, effort }) {
    if (entry_id !== null && entry_id !== undefined && !(typeof entry_id === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(entry_id)))
      return { fault: "its entry_id is not a catalogue entry's id." };
    if (label !== null && label !== undefined && (typeof label !== "object" || Array.isArray(label)))
      return { fault: "its label is not an object {provider, host, model_version, effort, account_level, owner}." };
    const given = label && typeof label === "object" ? label : {};
    for (const k of Object.keys(given)) if (!LABEL_FIELDS.includes(k)) return { fault: `its label names '${String(k).slice(0, 40)}', which a label does not carry.` };
    const out = {};
    for (const k of LABEL_FIELDS) {
      let v = Object.prototype.hasOwnProperty.call(given, k) ? given[k] : undefined;
      if (v === undefined && k === "model_version") v = model;
      if (v === undefined && k === "effort") v = effort;
      if (v === undefined || v === null) { out[k] = null; continue; }
      if (typeof v !== "string" || !v.length || v.length > 120) return { fault: `its label's '${k}' is not a short word or null.` };
      if (k === "effort" && !EFFORT_WORD.test(v))
        return { fault: localize("ai-use.index.its_effort_is_not_a", "its effort is not a lowercase word of at most 16 letters, or null where none was stated.") };
      out[k] = v;
    }
    return { entry_id: entry_id ?? null, label: out };
  }

  /** R1 (`agent-model` R5): a conversation's `usage`, as the neutral record: `{tokens: {figure: n|null}, reasoning,
   *  reported: {amount, unit, source}|null, estimated: {amount, unit, price_date}|null, unstated: [names]}`, or
   *  `{fault}`. A record before T53 (`total_cost_usd`, `estimated_cost_usd`) is read as `cost_reported` and `cost_estimated`
   *  in `usd`. A figure the record does not state is null and named in `unstated`, never 0. */
  static #usageOf(u) {
    if (!u || typeof u !== "object" || Array.isArray(u)) return { fault: "its usage is not an object of the call's figures." };
    const whole = (v) => v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
    const tokens = {};
    for (const f of USAGE_TOKEN_FIGURES) {
      if (!Object.prototype.hasOwnProperty.call(u, f)) return { fault: `its usage names no '${f}' (null when the provider did not state it).` };
      if (!whole(u[f])) return { fault: `its '${f}' is not a whole number of zero or more.` };
      tokens[f] = u[f];
    }
    const reasoning = Object.prototype.hasOwnProperty.call(u, REASONING_FIGURE) ? u[REASONING_FIGURE] : null;
    if (!whole(reasoning)) return { fault: `its '${REASONING_FIGURE}' is not a whole number of zero or more.` };
    const money = (c, f, extra) => {
      if (c === null || c === undefined) return { v: null };
      if (typeof c !== "object" || Array.isArray(c)) return { fault: `its '${f}' is not {amount, unit, …} or null.` };
      if (!(typeof c.amount === "number" && Number.isFinite(c.amount) && c.amount >= 0)) return { fault: `its '${f}' amount is not an amount of zero or more.` };
      if (!(typeof c.unit === "string" && /^[a-z]{3,8}$/.test(c.unit))) return { fault: `its '${f}' unit is not a currency unit such as usd.` };
      const x = typeof c[extra] === "string" ? c[extra].slice(0, 40) : null;
      return { v: { amount: c.amount, unit: c.unit, [extra]: x } };
    };
    const neutral = ["cost_reported", "cost_estimated", "unstated", REASONING_FIGURE].some((k) => Object.prototype.hasOwnProperty.call(u, k));
    let rep, est;
    if (neutral) {
      rep = money(u.cost_reported, "cost_reported", "source");
      est = money(u.cost_estimated, "cost_estimated", "price_date");
    } else {
      for (const f of USAGE_COST_FIGURES) {
        const v = u[f];
        if (v !== undefined && v !== null && !(typeof v === "number" && Number.isFinite(v) && v >= 0))
          return { fault: `its '${f}' is not an amount of zero or more.` };
      }
      rep = { v: typeof u.total_cost_usd === "number" ? { amount: u.total_cost_usd, unit: "usd", source: "provider" } : null };
      est = { v: typeof u.estimated_cost_usd === "number" ? { amount: u.estimated_cost_usd, unit: "usd", price_date: null } : null };
    }
    if (rep.fault) return { fault: rep.fault };
    if (est.fault) return { fault: est.fault };
    if (u.unstated !== undefined && !(Array.isArray(u.unstated) && u.unstated.every((x) => typeof x === "string" && x.length <= 60)))
      return { fault: "its 'unstated' is not a list of the figures the provider did not state." };
    const named = new Set(Array.isArray(u.unstated) ? u.unstated : []);
    for (const f of USAGE_TOKEN_FIGURES) if (tokens[f] === null) named.add(f);
    if (reasoning === null && neutral) named.add(REASONING_FIGURE);
    return { tokens, reasoning, reported: rep.v, estimated: est.v, unstated: [...named].sort() };
  }

  /** R1: one entry `{mode, usage, calls}` checked: `{entry}` well formed, else run-rules R3's refusal of a malformed
   *  consumption (C-22.13), naming what. `calls` absent is malformed. */
  #entryOf(e) {
    const bad = (detail) => ({ refusal: this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.detail_nothing_was_counted", "{detail} Nothing was counted.", { detail: String(detail) })) });
    if (!e || typeof e !== "object" || Array.isArray(e)) return bad("the use is not an object {mode, usage, calls}.");
    if (typeof e.mode !== "string" || !e.mode.trim() || e.mode.length > 40) return bad("the use names no mode.");
    if (e.model != null && (typeof e.model !== "string" || e.model.length > 120)) return bad("its model is not a model's name.");
    const lab = AiUse.#labelOf(e);
    if (lab.fault) return bad(lab.fault);
    const u = AiUse.#usageOf(e.usage);
    if (u.fault) return bad(u.fault);
    if (!Object.prototype.hasOwnProperty.call(e, "calls") || e.calls === undefined)
      return bad("it names no 'calls', the model calls its usage covers (null when the runner stated none).");
    const c = e.calls;
    if (!(c === null || (typeof c === "number" && Number.isSafeInteger(c) && c >= 1)))
      return bad("its 'calls' is not a whole number of one or more, or null.");
    return { entry: { mode: e.mode.trim(), calls: c === null ? 1 : c, ...lab, usage: u } };
  }

  static #micro(amount) { return Math.round(amount * 1e6); }

  /** R1 `countUsage({owner, member, use, mode, entry_id, label, usage, calls, at, act?})`, in the caller's transaction:
   *  adds to the counter for that owner, member, local day, use and mode (the token sums, reasoning included; the calls,
   *  a `null` counted as one; `unpriced_calls`; the figures not stated), to its money kept apart per unit (reported and
   *  estimated, never added), to the entry's use (R28), and with `act` to that act's measure and its conversations'
   *  `{entry_id, label, calls}` (R10, R11, R15); then notes any limit or threshold of the owner this reached (R5, R24). A
   *  malformed entry is refused `AI_RUN_CONSUME_INVALID`, counting nothing. Never throws. */
  countUsage({ owner = null, member = null, use = null, mode = null, entry_id = null, label = null, model = null, effort = null,
               usage = null, calls = undefined, at = null, act = null } = {}) {
    try {
      const p = owner === NOT_RECORDED ? { kind: "none", owner: NOT_RECORDED } : parseOwner(owner);
      const bad = (detail) => this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.detail_nothing_was_counted_2", "{detail} Nothing was counted.", { detail: String(detail) }));
      if (!p) return bad(localize("ai-use.index.the_use_names_no_paying", "the use names no paying account: 'group', 'project:<id>' or 'member:<id>'."));
      const id = memberIdOf(member);
      if (!id) return bad("the use names no member whose act it was.");
      if (!USE_KINDS.includes(use)) return bad(`the use '${String(use).slice(0, 40)}' is not a kind of use (${USE_KINDS.join(", ")}).`);
      if (act !== null && act !== undefined && (typeof act !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(act)))
        return bad("its act is not a run's or an act's id.");
      const checked = this.#entryOf({ mode, entry_id, label, model, effort, usage, calls });
      if (checked.refusal) return checked.refusal;
      const e = checked.entry;
      const ms = this.#ms(at);
      const { day } = this.#dayOf(ms);
      const t = e.usage.tokens;
      const n = (f) => (t[f] === null ? 0 : t[f]);
      const reasoning = e.usage.reasoning ?? 0;
      const rep = e.usage.reported, est = e.usage.estimated;
      const unpriced = rep === null && est === null ? e.calls : 0;
      const tokensUnstated = USAGE_TOKEN_FIGURES.some((f) => t[f] === null) ? 1 : 0;
      const prior = this.#one(`SELECT unstated FROM ai_usage WHERE owner=? AND member=? AND day=? AND use=? AND mode=?`, p.owner, id, day, use, e.mode);
      let named = [];
      try { named = prior ? JSON.parse(prior.unstated || "[]") : []; } catch { named = []; }
      const unstated = JSON.stringify([...new Set([...named, ...e.usage.unstated])].sort());
      this.sql.exec(
        `INSERT INTO ai_usage (owner, member, day, use, mode, calls, input_tokens, output_tokens, cache_read_input_tokens,
           cache_creation_input_tokens, reasoning_tokens, cost_micro_usd, tokens_unstated, cost_unstated, unpriced_calls, unstated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
         ON CONFLICT(owner, member, day, use, mode) DO UPDATE SET calls = calls + excluded.calls,
           input_tokens = input_tokens + excluded.input_tokens, output_tokens = output_tokens + excluded.output_tokens,
           cache_read_input_tokens = cache_read_input_tokens + excluded.cache_read_input_tokens,
           cache_creation_input_tokens = cache_creation_input_tokens + excluded.cache_creation_input_tokens,
           reasoning_tokens = reasoning_tokens + excluded.reasoning_tokens,
           tokens_unstated = tokens_unstated + excluded.tokens_unstated, cost_unstated = cost_unstated + excluded.cost_unstated,
           unpriced_calls = unpriced_calls + excluded.unpriced_calls, unstated = excluded.unstated`,
        p.owner, id, day, use, e.mode, e.calls, n("input_tokens"), n("output_tokens"), n("cache_read_input_tokens"),
        n("cache_creation_input_tokens"), reasoning, tokensUnstated, unpriced ? 1 : 0, unpriced, unstated);
      const money = (unit, rMicro, rCalls, eMicro, eCalls) => this.sql.exec(
        `INSERT INTO ai_usage_money (owner, member, day, use, mode, unit, reported_micro, reported_calls, estimated_micro, estimated_calls)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner, member, day, use, mode, unit) DO UPDATE SET reported_micro = reported_micro + excluded.reported_micro,
           reported_calls = reported_calls + excluded.reported_calls, estimated_micro = estimated_micro + excluded.estimated_micro,
           estimated_calls = estimated_calls + excluded.estimated_calls`, p.owner, id, day, use, e.mode, unit, rMicro, rCalls, eMicro, eCalls);
      if (rep) money(rep.unit, AiUse.#micro(rep.amount), e.calls, 0, 0);
      if (est) money(est.unit, 0, 0, AiUse.#micro(est.amount), e.calls);
      if (e.entry_id) {
        const usd = (c) => (c && c.unit === "usd" ? AiUse.#micro(c.amount) : 0);
        this.sql.exec(
          `INSERT INTO ai_usage_entries (owner, day, entry_id, mode, calls, reported_micro, estimated_micro, unpriced_calls)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(owner, day, entry_id, mode) DO UPDATE SET calls = calls + excluded.calls,
             reported_micro = reported_micro + excluded.reported_micro, estimated_micro = estimated_micro + excluded.estimated_micro,
             unpriced_calls = unpriced_calls + excluded.unpriced_calls`,
          p.owner, day, e.entry_id, e.mode, e.calls, usd(rep), usd(est), unpriced);
      }
      const now = AiUse.#iso(ms);
      if (act) this.#countAct(p, act, use, id, e, now);
      if (p.kind !== "none") { this.#noteReached(p, ms); this.#noteCrossed(p, ms); }
      return { ok: true, counted: 1, owner: p.owner, member: id, use, day, calls: e.calls, act: act || null, entry_id: e.entry_id };
    } catch (err) {
      return this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.the_use_could_not_be", "the use could not be counted ({String}). Nothing was counted.", { String: String(String(err && err.message || err).slice(0, 200)) }));
    }
  }

  /** R10, R11, R15, R22: an act's measure: its sums, the latest stated input tokens, its money in one unit (a second unit is
   *  not summed into the first, R21: the act's money is then not measurable), and each conversation's entry and label. */
  #countAct(p, act, use, member, e, now) {
    const t = e.usage.tokens;
    const tokens = USAGE_TOKEN_FIGURES.reduce((s, f) => s + (t[f] ?? 0), 0) + (e.usage.reasoning ?? 0);
    const rep = e.usage.reported, est = e.usage.estimated;
    const held = this.#one(`SELECT money_unit FROM ai_use_acts WHERE owner=? AND act=?`, p.owner, act);
    const unitOf = rep ? rep.unit : est ? est.unit : null;
    let unit = held ? held.money_unit : null;
    if (unitOf && unit === null) unit = unitOf;
    else if (unitOf && unit !== unitOf) unit = "mixed";
    const same = unit !== "mixed";
    const rMicro = same && rep ? AiUse.#micro(rep.amount) : 0, eMicro = same && est ? AiUse.#micro(est.amount) : 0;
    const unpriced = rep === null && est === null ? e.calls : 0;
    this.sql.exec(
      `INSERT INTO ai_use_acts (owner, act, use, mode, calls, tokens, cost_micro_usd, tokens_unstated, cost_unstated, first_at, last_at,
         member, last_input_tokens, unpriced_calls, reported_micro, reported_calls, estimated_micro, estimated_calls, money_unit)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner, act) DO UPDATE SET calls = calls + excluded.calls, tokens = tokens + excluded.tokens,
         tokens_unstated = tokens_unstated + excluded.tokens_unstated, cost_unstated = cost_unstated + excluded.cost_unstated,
         last_at = excluded.last_at, last_input_tokens = COALESCE(excluded.last_input_tokens, last_input_tokens),
         unpriced_calls = unpriced_calls + excluded.unpriced_calls, reported_micro = reported_micro + excluded.reported_micro,
         reported_calls = reported_calls + excluded.reported_calls, estimated_micro = estimated_micro + excluded.estimated_micro,
         estimated_calls = estimated_calls + excluded.estimated_calls, money_unit = excluded.money_unit`,
      p.owner, act, use, e.mode, e.calls, tokens, USAGE_TOKEN_FIGURES.some((f) => t[f] === null) ? 1 : 0, unpriced ? 1 : 0, now, now,
      member, t.input_tokens, unpriced, rMicro, rep && same ? e.calls : 0, eMicro, est && same ? e.calls : 0, unit);
    const L = e.label;
    const v = (k) => (L[k] === null ? "" : L[k]);
    this.sql.exec(
      `INSERT INTO ai_use_act_entries (owner, act, entry_id, provider, host, model_version, effort, account_level, label_owner, calls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner, act, entry_id, provider, host, model_version, effort, account_level, label_owner) DO UPDATE SET calls = calls + excluded.calls`,
      p.owner, act, e.entry_id ?? "", v("provider"), v("host"), v("model_version"), v("effort"), v("account_level"), v("owner"), e.calls);
  }

  /** R1 `countAskUsage({member, mode, entry_id, label, usage, calls, at, owner?, act?})` (was ai-runs R48's; K2400): an ask
   *  or a draft (no run), counted as `countUsage` counts, its use its mode, in its own transaction. `owner` is the account
   *  the caller's `accountFor` answered; without one the use is kept as "not recorded" and counts toward no limit (K2480).
   *  Any mode but `ask` or `draft` is refused `AI_RUN_CONSUME_INVALID`. */
  countAskUsage({ member = null, mode = null, entry_id = null, label = null, model = null, effort = null, usage = null, calls = null,
                  at = null, owner = null, act = null } = {}) {
    if (!ASK_USAGE_MODES.includes(typeof mode === "string" ? mode.trim() : mode))
      return this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.the_mode_string_is_not", "the mode '{String}' is not one an ask's use is counted under: an ask counts as 'ask' and a draft as 'draft'; a run's use arrives on its own ticks. Nothing was counted.", { String: String(String(mode).slice(0, 40)) }));
    const m = mode.trim();
    let out = null;
    try {
      this.#transact(() => { out = this.countUsage({ owner: owner ?? NOT_RECORDED, member, use: m, mode: m, entry_id, label, model,
        effort, usage, calls, at, act }); return out; });
    } catch { /* a refusal rolled back; `out` carries it */ }
    return out ?? this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.the_use_could_not_be_2", "the use could not be counted. Nothing was counted."));
  }

  /** R31 `countHealth({entry_id, personal, outcome, error_class?, at})`, beside `countUsage` for every model turn, in the
   *  caller's transaction: adds to `ai_health` per entry, `personal` flag and UTC day: `calls`; `refused` (outcome `refused`
   *  or class `content_refusal`); `silent`; one count per error class. A `limit` outcome is a limit reached (R18): `calls`
   *  only. Keeps no owner, account, member, run, finer time, content or message. An absent entry, or an outcome or class
   *  outside `agent-model`'s lists, is refused `AI_RUN_CONSUME_INVALID`, counting nothing. Never throws. */
  countHealth({ entry_id = null, personal = false, outcome = null, error_class = null, at = null } = {}) {
    const bad = (detail) => this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.health_detail_nothing_counted", "{detail} Nothing was counted.", { detail: String(detail) }));
    try {
      if (!(typeof entry_id === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(entry_id))) return bad("the turn names no catalogue entry.");
      if (!HEALTH_OUTCOMES.includes(outcome)) return bad(`the outcome is not one of ${HEALTH_OUTCOMES.join(", ")}.`);
      if (error_class !== null && error_class !== undefined && !HEALTH_ERROR_CLASSES.includes(error_class))
        return bad("the error class is not one of agent-model's.");
      if (outcome === "error" && !error_class) return bad("an error outcome names its class.");
      const day = AiUse.#iso(this.#ms(at)).slice(0, 10);
      const limit = outcome === "limit";
      const refused = !limit && (outcome === "refused" || error_class === "content_refusal") ? 1 : 0;
      const silent = !limit && outcome === "silent" ? 1 : 0;
      const held = this.#one(`SELECT errors FROM ai_health WHERE entry_id=? AND personal=? AND day=?`, entry_id, personal ? 1 : 0, day);
      let errors = {};
      try { errors = held ? JSON.parse(held.errors) : {}; } catch { errors = {}; }
      if (!limit && error_class) errors[error_class] = (errors[error_class] ?? 0) + 1;
      this.sql.exec(`INSERT INTO ai_health (entry_id, personal, day, calls, refused, silent, errors) VALUES (?, ?, ?, 1, ?, ?, ?)
                     ON CONFLICT(entry_id, personal, day) DO UPDATE SET calls = calls + 1, refused = refused + excluded.refused,
                       silent = silent + excluded.silent, errors = excluded.errors`,
        entry_id, personal ? 1 : 0, day, refused, silent, JSON.stringify(errors));
      const keep = new Date(Date.parse(`${day}T00:00:00Z`) - HEALTH_KEEP_DAYS * 864e5).toISOString().slice(0, 10);
      this.sql.exec(`DELETE FROM ai_health WHERE day < ?`, keep);
      return { ok: true, counted: 1, entry_id, day };
    } catch (err) {
      return bad(`the turn could not be counted (${String(err && err.message || err).slice(0, 200)}).`);
    }
  }

  /* ===== The sums ===== */

  /** The uses of `owner` whose limit is exclusive (B5): a use with any limit held `inclusive` false. */
  #exclusive(owner) {
    return new Set(this.#rows(`SELECT DISTINCT scope FROM ai_limits WHERE owner=? AND inclusive=0`, owner).map((r) => r.scope));
  }

  /** The WHERE of a sum over `owner`'s counter in the period of `period` holding `day`: over `use` (or every use but
   *  `excluded`), for `member` alone when named, and with `through` only the period's days up to it. */
  static #where(owner, period, day, { use = null, member = null, excluded = null, through = null } = {}) {
    const where = [`owner = ?`, AiUse.#inPeriod(period)], args = [owner, day];
    if (through) { where.push("day <= ?"); args.push(through); }
    if (use) { where.push("use = ?"); args.push(use); }
    if (member) { where.push("member = ?"); args.push(member); }
    if (!use && excluded && excluded.size) { where.push(`use NOT IN (${[...excluded].map(() => "?").join(",")})`); args.push(...excluded); }
    return { sql: where.join(" AND "), args };
  }

  /** R3, R21, R24: the money used in `usd` over a WHERE, in millionths, and its basis: `reported` when every call stated a
   *  reported cost, else `estimated`; null when no call carried either (not measurable). */
  #usdUsed(w) {
    const m = this.#one(`SELECT COALESCE(SUM(reported_micro), 0) r, COALESCE(SUM(reported_calls), 0) rc, COALESCE(SUM(estimated_micro), 0) e,
                                COALESCE(SUM(estimated_calls), 0) ec FROM ai_usage_money WHERE unit = 'usd' AND ${w.sql}`, ...w.args);
    const calls = Number(this.#one(`SELECT COALESCE(SUM(calls), 0) c FROM ai_usage WHERE ${w.sql}`, ...w.args).c);
    if (!Number(m.rc) && !Number(m.ec)) return { micro: null, basis: null, calls };
    if (Number(m.rc) >= calls && calls > 0) return { micro: Number(m.r), basis: "reported", calls };
    return { micro: Number(m.ec) ? Number(m.e) : Number(m.r), basis: Number(m.ec) ? "estimated" : "reported", calls };
  }

  /** The figure of `unit` used by `owner` in the period of `period` holding `day` (R3's sums): tokens (reasoning included),
   *  calls, or `usd` in whole cents, rounded up so a limit is never reached late (0 where no money was measured). */
  #used(owner, unit, period, day, opts = {}) {
    const w = AiUse.#where(owner, period, day, opts);
    if (unit === "usd") { const u = this.#usdUsed(w); return u.micro === null ? 0 : Math.ceil(u.micro / 1e4); }
    const r = this.#one(`SELECT COALESCE(SUM(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens + reasoning_tokens), 0) t,
                                COALESCE(SUM(calls), 0) c FROM ai_usage WHERE ${w.sql}`, ...w.args);
    return unit === "tokens" ? Number(r.t) : Number(r.c);
  }

  /** The greatest figure any one member used of a per-member limit, naming none (R12, R14). */
  #mostByAMember(owner, unit, period, day, through = null) {
    const ids = this.#rows(`SELECT DISTINCT member FROM ai_usage WHERE owner = ? AND ${AiUse.#inPeriod(period)}`, owner, day);
    return ids.reduce((m, r) => Math.max(m, this.#used(owner, unit, period, day, { member: r.member, through })), 0);
  }

  /** A limit's (or a threshold's) use in its period, as R3 counts it: `overall` over the uses that are not exclusive, a
   *  use's own, `per_member` the most any one member used, `retest:<entry>` the entry's money that month (R28). */
  #usedFor(owner, scope, unit, period, day, { through = null, member = null } = {}) {
    if (scope.startsWith("retest:")) return this.#retestUsed(owner, scope.slice(7), day);
    if (scope === "overall") return this.#used(owner, unit, period, day, { excluded: this.#exclusive(owner), through, member });
    if (scope === "per_member") return member ? this.#used(owner, unit, period, day, { member, through }) : this.#mostByAMember(owner, unit, period, day, through);
    return this.#used(owner, unit, period, day, { use: scope, through, member });
  }

  /** The limits held for `owner`, every one or one scope's; the re-test caps (R28) only when asked for by scope. */
  #limits(owner, scope = null) {
    return scope ? this.#rows(`SELECT * FROM ai_limits WHERE owner=? AND scope=? ORDER BY scope, unit, period`, owner, scope)
      : this.#rows(`SELECT * FROM ai_limits WHERE owner=? AND scope NOT LIKE 'retest:%' ORDER BY scope, unit, period`, owner);
  }
  #limit(owner, scope, unit, period) {
    return this.#one(`SELECT * FROM ai_limits WHERE owner=? AND scope=? AND unit=? AND period=?`, owner, scope, unit, period);
  }

  /** R3: the first limit of `p` reached for `use` (and `member`) at `ms`, as `{lim, start}`, else null: the use's own,
   *  then the overall one (unless the use is exclusive), then the per-member one. */
  #reachedFor(p, use, member, ms) {
    const { day } = this.#dayOf(ms);
    const excluded = this.#exclusive(p.owner);
    const over = (lim, opts) => this.#used(p.owner, lim.unit, lim.period, day, opts) >= Number(lim.amount);
    for (const lim of use ? this.#limits(p.owner, use) : [])
      if (over(lim, { use })) return { lim, start: AiUse.#start(lim.period, day) };
    if (!use || !excluded.has(use))
      for (const lim of this.#limits(p.owner, "overall"))
        if (over(lim, { excluded })) return { lim, start: AiUse.#start(lim.period, day) };
    if (member)
      for (const lim of this.#limits(p.owner, "per_member"))
        if (over(lim, { member })) return { lim, start: AiUse.#start(lim.period, day) };
    return null;
  }

  /** R3: whether any limit of `p` that bears on `use` is held in `usd`. */
  #usdLimitBears(p, use) {
    const ex = this.#exclusive(p.owner);
    return this.#limits(p.owner).some((l) => l.unit === "usd" && (l.scope === use || l.scope === "per_member" || (l.scope === "overall" && !ex.has(use))));
  }

  /** R5 (B7): every limit of `p` reached at `ms` and not yet noted for its period is noted, once, with the instant. */
  #noteReached(p, ms) {
    const { day } = this.#dayOf(ms);
    const at = AiUse.#iso(ms);
    for (const lim of this.#limits(p.owner)) {
      const start = AiUse.#start(lim.period, day);
      if (this.#one(`SELECT owner FROM ai_limit_reached WHERE owner=? AND scope=? AND unit=? AND period=? AND period_start=?`,
                    p.owner, lim.scope, lim.unit, lim.period, start)) continue;
      if (this.#usedFor(p.owner, lim.scope, lim.unit, lim.period, day) >= Number(lim.amount))
        this.sql.exec(`INSERT INTO ai_limit_reached (owner, scope, unit, period, period_start, reached_at, project_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`, p.owner, lim.scope, lim.unit, lim.period, start, at,
                       p.kind === "project" ? p.id : null);
    }
  }

  /* ===== Who acts (R2, R4, R9, R12) ===== */

  /** R2: the owner's own act: the member (`NOT_YOUR_CEILING`); a project's owner (`ai-accounts`' R10 refusals, through its
   *  in-plane `accountActBar`, R25); an active administrator (`NOT_AN_ADMIN`). Null when `by` may act. */
  #ownerBar(p, by, act) {
    if (p.kind === "member") {
      const id = memberIdOf(by);
      /* the member's account is theirs alone: anyone else, an administrator or a machine included */
      return id !== null && id === p.id ? null
        : this.#refuse("NOT_YOUR_CEILING", localize("ai-use.index.a_members_limits_and_use", "a member's limits and use of the assistant are that member's alone to {act}. Nothing was changed.", { act: String(act) }));
    }
    if (p.kind === "group")
      return this.#owns(p, by) && !isMachineIdentity(String(by)) ? null : notAnAdmin(by ?? null, localize("ai-use.index.act_the_team_accounts_limits", "{act} the team account's limits and use", { act: String(act) }));
    return this.#accountsBar(p, by, act);
  }

  /** R12, R14 (T53; `ai-accounts` R15, R25): the account's owners and refusals as `ai-accounts.accountActBar({owner, by})`
   *  answers them (R1's, R5's, R10's: `NOT_YOUR_ACCOUNT`, `NOT_AN_ADMIN`, `PROJECT_ACT_NOT_THE_OWNER`); when that read
   *  cannot be made, membership's own refusals (fail closed). */
  #accountsBar(p, by, act) {
    let bar;
    try { bar = this.#accounts().accountActBar({ owner: p.owner, by: by ?? null }); } catch { bar = undefined; }
    if (bar === null) return null;
    if (bar && bar.ok === false) return bar;
    return this.#owns(p, by) ? null
      : p.kind === "group" ? notAnAdmin(by ?? null, act) : p.kind === "project" ? notTheOwner(by ?? null, p.id) : this.#refuse("NOT_YOUR_CEILING", "Nothing was read.");
  }

  /** Whether `viewer` is one of `p`'s owners: the member; an active administrator for the group; an owner of the
   *  project. False for a machine or an absent viewer. */
  #owns(p, viewer) {
    const id = memberIdOf(viewer);
    if (!id) return false;
    try {
      if (p.kind === "member") return id === p.id;
      if (p.kind === "group") return this.membership.isAdministrator(id);
      if (p.kind === "project") return this.membership.isProjectOwner(p.id, id);
    } catch { return false; }
    return false;
  }

  /** R3, R6, R9 (T53; `ai-accounts` R14, R17): the `explore` value of the account `account_id`: `no`, `ask` or `yes`, read
   *  through `ai-accounts.accountUsesOf({account_id})` with no viewer. `held` is read, never `uses` alone. `no` when no
   *  account is named, the account is not held, it is not `p`'s own (its `owner` is another's), it cannot be read, or it
   *  holds any other value (fail closed). */
  #exploreOf(p, account_id) {
    if (typeof account_id !== "string" || !account_id) return "no";
    try {
      const a = this.#accounts().accountUsesOf({ account_id });
      const v = a && a.ok === true && a.held === true && !a.unreadable && a.owner === p.owner && a.uses ? a.uses.explore : "no";
      return ["no", "ask", "yes"].includes(v) ? v : "no";
    } catch { return "no"; }
  }

  /* ===== Money: the plan's and the entry's (R2, R3, R4, R14, R21; ai-catalogue R16) ===== */

  /** The plan's `money` (`ai-catalogue` R16 through `plansOf`): `reported`, `priced`, `none`, or `open` (OPEN, unknown, or
   *  the catalogue unreadable). */
  #planMoney(provider, plan_id) {
    try {
      const groups = this.#catalogue()?.plansOf({ provider, plan_id }) ?? [];
      const row = (Array.isArray(groups) ? groups : []).flatMap((g) => g.plans || []).find((x) => x.plan_id === plan_id);
      const m = row ? row.money : undefined;
      return typeof m === "string" && ["reported", "priced", "none"].includes(m) ? m : "open";
    } catch { return "open"; }
  }

  /** R2, R4, R14 (T53; B1): the money of `p`'s own accounts, read as `viewer` (one of its owners): `{allows, monies}`,
   *  `allows` true only when the owner holds at least one account and every one's plan money is `reported` or `priced`
   *  (fail closed: OPEN, an unreadable catalogue or no account refuses money). */
  #ownerMoney(p, viewer) {
    let list = null;
    try {
      const a = this.#accounts().accountsOf({ owner: p.owner, viewer });
      list = a && a.ok !== false ? (Array.isArray(a) ? a : a.accounts ?? null) : null;
    } catch { list = null; }
    const own = Array.isArray(list) ? list.filter((x) => x && x.owner === p.owner) : [];
    const monies = own.map((x) => this.#planMoney(x.provider, x.plan));
    return { allows: monies.length > 0 && monies.every((m) => m === "reported" || m === "priced"), monies };
  }

  /** R3, R22 (T53): the catalogue entry `entry_id` (`ai-catalogue` R28 `entryOf`), or null. */
  #entry(entry_id) {
    try { return typeof entry_id === "string" ? this.#catalogue()?.entryOf(entry_id) ?? null : null; } catch { return null; }
  }
  /** Whether a price figure is stated (a number, never OPEN). */
  static #priced(prices, ...figures) {
    return !!prices && typeof prices === "object" && !prices.open && figures.every((f) => typeof prices[f] === "number");
  }

  /** R3 (T53; B2): whether an act on `entry_id` can be measured in money: the entry carries a price, or every plan it is
   *  offered under reports its cost (`money: reported`). */
  #entryMeasurable(entry_id) {
    const e = this.#entry(entry_id);
    if (!e) return false;
    if (AiUse.#priced(e.prices, "input") || AiUse.#priced(e.prices, "output")) return true;
    try {
      const plans = (this.#catalogue()?.plansOf({ entry_id }) ?? []).flatMap((g) => g.plans || []);
      return plans.length > 0 && plans.every((x) => x.money === "reported");
    } catch { return false; }
  }

  /* ===== LIMITS (R2) ===== */

  /** R2: append one change to the history and hold the limit (or remove it, `amount` null). */
  #write(owner, scope, unit, period, amount, inclusive, by, at) {
    const p = parseOwner(owner);
    const project = p && p.kind === "project" ? p.id : null;
    const held = this.#limit(owner, scope, unit, period);
    const change = amount === null ? "removed" : held ? "changed" : "set";
    if (amount === null) this.sql.exec(`DELETE FROM ai_limits WHERE owner=? AND scope=? AND unit=? AND period=?`, owner, scope, unit, period);
    else this.sql.exec(`INSERT INTO ai_limits (owner, scope, unit, period, amount, inclusive, project_id, set_by, set_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(owner, scope, unit, period) DO UPDATE SET amount=excluded.amount,
                          inclusive=excluded.inclusive, set_by=excluded.set_by, set_at=excluded.set_at`,
                        owner, scope, unit, period, amount, inclusive === null ? null : inclusive ? 1 : 0, project, by, at);
    this.sql.exec(`INSERT INTO ai_limit_history (owner, scope, unit, period, change, amount, inclusive, project_id, by, at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, owner, scope, unit, period, change, amount,
                   inclusive === null ? null : inclusive ? 1 : 0, project, by, at);
    return change;
  }

  /** R2 (T53; B1): `LIMIT_UNIT_UNAVAILABLE`: a limit (or threshold) in `usd` on an account whose plan reports no money. */
  #unitUnavailable(extra = {}) {
    /* DEC-49 REGION is-limit-unit-unavailable */
    return { ...this.#refuse("LIMIT_UNIT_UNAVAILABLE", localize("ai-use.index.plan_reports_no_money", "this account's plan reports no money and the catalogue prices none of it, so a limit in dollars cannot be judged; set it in tokens or calls. Nothing was changed.")), word: "ai.refused.unitunavailable", ...extra };
    /* END DEC-49 REGION is-limit-unit-unavailable */
  }

  /** The stamp a change is recorded under: `admin` or `member:<id>`. */
  static #who(by) { return memberIdOf(by) === "admin" ? "admin" : `member:${memberIdOf(by)}`; }

  /** R2 (T53) `aiLimitSet({owner, scope, unit, period, amount, inclusive?, by, at?})` (`op=ailimitset`): sets, changes or
   *  (`amount` null) removes one limit of one account, by that account's owner, appended to its history with who and
   *  when. `usd` only where every account of the owner has a plan whose money is `reported` or `priced` (else
   *  `LIMIT_UNIT_UNAVAILABLE`, following the plan, never the kind of account). Answers `{ok, owner, scope, unit, period,
   *  amount, inclusive, change, set_at}`. Never throws. */
  aiLimitSet({ owner = null, scope = null, unit = null, period = null, amount = undefined, inclusive = undefined,
               by = null, at = null } = {}) {
    try {
      const p = parseOwner(owner);
      if (!p) return this.#invalid("owner", localize("ai-use.index.a_limit_s_owner_is", "a limit's owner is 'group', 'project:<id>' or 'member:<id>'."));
      const bar = this.#ownerBar(p, by, "set");
      if (bar) return bar;
      const scopes = ["overall", ...USE_KINDS, ...(p.kind === "member" ? [] : ["per_member"])];
      if (!scopes.includes(scope))
        return this.#invalid("scope", localize("ai-use.index.a_limits_scope_is_one", "a limit's scope is one of {scopes}{v1}.", { scopes: String(scopes.join(", ")), v1: String(p.kind === "member" ? " (per_member only for a team's or a project's account)" : "") }));
      const v = this.#amountOf(unit, period, amount);
      if (v.refusal) return v.refusal;
      const stored = v.stored;
      const useScope = USE_KINDS.includes(scope);
      if (inclusive !== undefined && inclusive !== null && (!useScope || typeof inclusive !== "boolean"))
        return this.#invalid("inclusive", useScope ? localize("ai-use.index.inclusive_is_true_or_false", "inclusive is true or false.") : localize("ai-use.index.inclusive_is_set_only_for", "inclusive is set only for a limit on one kind of use."));
      if (unit === "usd" && stored !== null && !this.#ownerMoney(p, by).allows) return this.#unitUnavailable();
      const ms = this.#ms(at);
      const now = AiUse.#iso(ms);
      const incl = useScope ? (inclusive === undefined || inclusive === null ? true : inclusive) : null;
      if (stored === null && !this.#limit(p.owner, scope, unit, period))
        return { ok: true, owner: p.owner, scope, unit, period, amount: null, inclusive: null, change: "none", set_at: null };
      let change = null;
      this.#transact(() => { change = this.#write(p.owner, scope, unit, period, stored, incl, AiUse.#who(by), now); this.#noteReached(p, ms); return { ok: true }; });
      return { ok: true, owner: p.owner, scope, unit, period, amount: stored === null ? null : unit === "usd" ? stored / 100 : stored,
               inclusive: stored === null ? null : incl, change, set_at: now };
    } catch (err) {
      return this.#invalid("owner", localize("ai-use.index.the_limit_could_not_be", "the limit could not be set ({String}).", { String: String(String(err && err.message || err).slice(0, 200)) }));
    }
  }

  /** F3 (coordinator 17:24, screens-ai R2, R7; DEC-420's spellings, `draft-assistant-screens.md` §4) `budgetSet({owner,
   *  scope, unit, period, amount?, inclusive?, kind?, level?, was?, by, at?}, ownerField?)`, the act of `op=aibudgetset`
   *  (the team's or a member's own account, the screen's "Limits and alerts") and `op=aiprojectbudget` (a project's): with
   *  `kind`, an alert threshold as R23 sets it (`aiThresholdSet`); without, a limit as R2 sets it (`aiLimitSet`). Either
   *  way the owner's own act, refused and recorded as those are. An owner that is not one is refused `AI_LIMIT_INVALID`
   *  naming `ownerField` (`owner`, or `project` for a project's). Never throws. */
  budgetSet({ owner = null, scope = null, unit = null, period = null, amount = undefined, inclusive = undefined, kind = undefined,
              level = undefined, was = null, by = null, at = null } = {}, ownerField = "owner") {
    try {
      if (!parseOwner(owner)) {
        const r = this.#invalid("owner", localize("ai-use.index.a_limit_s_owner_is", "a limit's owner is 'group', 'project:<id>' or 'member:<id>'."));
        return ownerField === "owner" ? r : { ...r, field: ownerField };
      }
      return kind !== undefined && kind !== null
        ? this.aiThresholdSet({ owner, scope, unit, period, kind, level, was, by, at })
        : this.aiLimitSet({ owner, scope, unit, period, amount, inclusive, by, at });
    } catch (err) {
      return this.#invalid("owner", localize("ai-use.index.the_limit_could_not_be", "the limit could not be set ({String}).", { String: String(String(err && err.message || err).slice(0, 200)) }));
    }
  }

  /** R2, R23: a unit, a period and an amount checked: `{stored}` (whole cents for `usd`, whole numbers otherwise, null to
   *  remove), or `{refusal}` naming the field. */
  #amountOf(unit, period, amount) {
    if (!LIMIT_UNITS.includes(unit)) return { refusal: this.#invalid("unit", localize("ai-use.index.a_limits_unit_is_usd", "a limit's unit is usd, tokens or calls.")) };
    if (!LIMIT_PERIODS.includes(period)) return { refusal: this.#invalid("period", localize("ai-use.index.a_limits_period_is_day", "a limit's period is day or month.")) };
    if (amount === undefined) return { refusal: this.#invalid("amount", localize("ai-use.index.a_limits_amount_is_a", "a limit's amount is a positive number, or null to remove it.")) };
    if (amount === null) return { stored: null };
    const okNum = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
    if (unit === "usd") {
      const cents = okNum ? Math.round(amount * 100) : NaN;
      if (!okNum || cents < 1 || Math.abs(cents - amount * 100) > 1e-6)
        return { refusal: this.#invalid("amount", localize("ai-use.index.a_limit_in_usd_is", "a limit in usd is a positive amount to the cent, or null to remove it.")) };
      return { stored: cents };
    }
    if (!okNum || !Number.isSafeInteger(amount))
      return { refusal: this.#invalid("amount", localize("ai-use.index.a_limit_in_unit_is", "a limit in {unit} is a whole number of one or more, or null to remove it.", { unit: String(unit) })) };
    return { stored: amount };
  }

  /* ===== JUDGING (R3, R18, R20) ===== */

  /** R18: the provider limits standing at `ms` for the account (and, for an entry-scoped one, the entry): a limit stands
   *  until its `resets_at`; with none given, until `PROVIDER_REPROBE_MS` after its latest recording. */
  #providerStanding(where, args, ms) {
    return this.#rows(`SELECT * FROM ai_provider_limits WHERE ${where} ORDER BY recorded_at, kind`, ...args).filter((r) =>
      r.resets_at ? Date.parse(r.resets_at) > ms : Date.parse(r.recorded_at) + PROVIDER_REPROBE_MS > ms);
  }

  /** R3, R13 (T53; B4): `AI_LIMIT_REACHED` for a provider limit, `source: "provider"`, `walkable: true`, its sentence
   *  `ai.refused.limit.provider` filled with `{when}` from its reset time, or `ai.refused.limit.provider.unknown`. */
  #providerReached(p, r, use, ms) {
    const whose = whoseOf(p);
    const resets = r.resets_at || null;
    const w = { whose: AI_USE_WORDS[WHOSE_WORD[whose]] };
    /* `{when}`: `ai.when.day` when it resets on the next local day, `ai.when.month` when on a month's 1st, else the day */
    const today = this.#dayOf(ms).day;
    const resetDay = resets ? this.#dayOf(Date.parse(resets)).day : null;
    const next = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
    const when = !resetDay ? null : resetDay === next ? AI_USE_WORDS[WHEN_WORD.day]
      : resetDay.endsWith("-01") ? fillWords(AI_USE_WORDS[WHEN_WORD.month], { month: AI_USE_WORDS[MONTH_WORD[Number(resetDay.slice(5, 7)) - 1]] })
      : resetDay;
    const translation = resets
      ? localize("ai.refused.limit.provider", "The assistant stopped here: the provider's limit on {whose} account is reached. It works again {when}. Everything else works as usual.", { ...w, when })
      : localize("ai.refused.limit.provider.unknown", "The assistant stopped here: the provider's limit on {whose} account is reached, and the provider did not say when it resets. Everything else works as usual.", w);
    /* DEC-49 REGION is-ai-limit-reached-provider */
    return { ...this.#refuse("AI_LIMIT_REACHED", localize("ai-use.index.provider_limit_reached", "the provider's {kind} limit on {owner}'s account is reached{until}. Nothing was started.", { kind: String(r.kind), owner: String(p.owner), until: resets ? ` until ${resets}` : "" })),
      translation, word: resets ? "ai.refused.limit.provider" : "ai.refused.limit.provider.unknown", whose, source: "provider",
      scope: r.scope, kind: r.kind, unit: null, period: null, resets_at: resets, entry_id: r.entry_id || null, walkable: true, use: use ?? null };
    /* END DEC-49 REGION is-ai-limit-reached-provider */
  }

  /** R3 (T53) `useCheck({owner, member, use, at, account_id?, entry_id?})`: null while nothing bears on this use; else
   *  `EXPLORE_NOT_ENABLED` (`explore` set `no` on the account named, `walkable: false`), a provider limit standing on the
   *  account or the entry (`AI_LIMIT_REACHED`, `source: "provider"`, `walkable: true`, R18), an own limit reached
   *  (`source: "own"`, `walkable: true`), or `LIMIT_UNIT_UNAVAILABLE` `unjudged` when a `usd` limit bears on an act whose
   *  entry neither is priced nor reports its cost (R21; never counted as zero). Judges only the paying account's limits
   *  (D38). Writes nothing; never throws; a counter that cannot be read answers the refusal, unjudged, `walkable: false`. */
  useCheck({ owner = null, member = null, use = null, at = null, account_id = null, entry_id = null } = {}) {
    const p = parseOwner(owner);
    const failClosed = (why) => ({ ...this.#limitReached(p, null, use, null, why), walkable: false });
    if (!p) return failClosed(localize("ai-use.fail_closed.use_names_paying", "the use names no paying account, so its limits cannot be judged."));
    if (!USE_KINDS.includes(use)) return failClosed(localize("ai-use.fail_closed.kind_use_limits", "'{use}' is not a kind of use, so its limits cannot be judged.", { use: String(String(use).slice(0, 40)) }));
    try {
      if (use === "explore" && this.#exploreOf(p, account_id) === "no") return { ...this.#exploreOff(p), walkable: false };
      const ms = this.#ms(at);
      if (typeof account_id === "string" && account_id) {
        const standing = this.#providerStanding(`account_id = ? AND (scope = 'account' OR entry_id = ?)`, [account_id, entry_id ?? ""], ms);
        if (standing.length) return this.#providerReached(p, standing[0], use, ms);
      }
      const hit = this.#reachedFor(p, use, memberIdOf(member), ms);
      if (hit) return { ...this.#limitReached(p, hit.lim, use, hit.start), source: "own", walkable: true };
      if (typeof entry_id === "string" && entry_id && this.#usdLimitBears(p, use) && !this.#entryMeasurable(entry_id))
        return { ...this.#unitUnavailable({ unjudged: true, entry_id }), walkable: false };
      return null;
    } catch { return failClosed(localize("ai-use.fail_closed.use_counted_far", "the use counted so far could not be read.")); }
  }

  /** R18 (T53; BR23) `recordProviderLimit({owner, account_id, entry_id, kind, scope, resets_at, at})`, in the caller's
   *  transaction: a provider limit `agent-model` returned as a `limit` outcome, idempotent per (account, entry, kind,
   *  `resets_at`); a second recording refreshes its instant (so a repeat limit after the re-probe stands again). A limit
   *  reached, never a failure for health. A malformed entry is refused `AI_RUN_CONSUME_INVALID`. Never throws. */
  recordProviderLimit({ owner = null, account_id = null, entry_id = null, kind = null, scope = null, resets_at = null, at = null } = {}) {
    const bad = (detail) => this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-use.index.provider_limit_bad", "{detail} Nothing was recorded.", { detail: String(detail) }));
    try {
      const p = parseOwner(owner);
      if (!p) return bad("the limit names no paying account.");
      if (!(typeof account_id === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(account_id))) return bad("the limit names no account.");
      if (!PROVIDER_LIMIT_KINDS.includes(kind)) return bad(`its kind is not one of ${PROVIDER_LIMIT_KINDS.join(", ")}.`);
      if (!PROVIDER_LIMIT_SCOPES.includes(scope)) return bad("its scope is account or entry.");
      if (entry_id !== null && !(typeof entry_id === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(entry_id))) return bad("its entry_id is not an entry's id.");
      if (scope === "entry" && !entry_id) return bad("an entry-scoped limit names its entry.");
      if (resets_at !== null && !(typeof resets_at === "string" && Number.isFinite(Date.parse(resets_at)))) return bad("its resets_at is not an instant, or null.");
      const now = AiUse.#iso(this.#ms(at));
      const resets = resets_at === null ? "" : AiUse.#iso(Date.parse(resets_at));
      const e = scope === "entry" ? entry_id : "";
      const held = !!this.#one(`SELECT kind FROM ai_provider_limits WHERE account_id=? AND entry_id=? AND kind=? AND resets_at=?`, account_id, e, kind, resets);
      this.sql.exec(`INSERT INTO ai_provider_limits (owner, account_id, entry_id, kind, scope, resets_at, recorded_at, project_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, entry_id, kind, resets_at) DO UPDATE SET recorded_at = excluded.recorded_at`,
        p.owner, account_id, e, kind, scope, resets, now, p.kind === "project" ? p.id : null);
      return { ok: true, recorded: !held, owner: p.owner, account_id, entry_id: e || null, kind, scope, resets_at: resets || null, recorded_at: now };
    } catch (err) { return bad(`the limit could not be recorded (${String(err && err.message || err).slice(0, 200)}).`); }
  }

  /** R19 (T53) `aiProviderLimits({owner, viewer, at})`: to the account's owners only (R12's), each recorded provider limit
   *  still standing, `{account_id, entry_id, kind, scope, resets_at, recorded_at}`, naming no member, and the history of
   *  past ones. Writes nothing; never throws. */
  aiProviderLimits({ owner = null, viewer = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.limits_are_read_for", "limits are read for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#accountsBar(p, viewer, "reading an account's limits");
    if (bar) return bar;
    try {
      const ms = this.#ms(at);
      const all = this.#rows(`SELECT * FROM ai_provider_limits WHERE owner=? ORDER BY recorded_at, kind`, p.owner);
      const standing = new Set(this.#providerStanding(`owner = ?`, [p.owner], ms).map((r) => `${r.account_id}|${r.entry_id}|${r.kind}|${r.resets_at}`));
      const shape = (r) => ({ account_id: r.account_id, entry_id: r.entry_id || null, kind: r.kind, scope: r.scope, resets_at: r.resets_at || null, recorded_at: r.recorded_at });
      const key = (r) => `${r.account_id}|${r.entry_id}|${r.kind}|${r.resets_at}`;
      return { ok: true, owner: p.owner, standing: all.filter((r) => standing.has(key(r))).map(shape), history: all.filter((r) => !standing.has(key(r))).map(shape) };
    } catch { return { ok: true, owner: p.owner, standing: null, history: null, unreadable: true }; }
  }

  /* ===== READS (R4, R5, R21) ===== */

  /** R4, R21 (T53): the money over a WHERE of the counter, per unit, kept apart: `{cost_reported_sum, cost_estimated_sum}`,
   *  each `{unit: amount}` or null where no call carried it; both null when nothing was measured. */
  #moneyOf(w) {
    const rows = this.#rows(`SELECT unit, SUM(reported_micro) r, SUM(reported_calls) rc, SUM(estimated_micro) e, SUM(estimated_calls) ec
                             FROM ai_usage_money WHERE ${w.sql} GROUP BY unit ORDER BY unit`, ...w.args);
    const rep = {}, est = {};
    for (const r of rows) {
      if (Number(r.rc)) rep[r.unit] = Number(r.r) / 1e6;
      if (Number(r.ec)) est[r.unit] = Number(r.e) / 1e6;
    }
    return { cost_reported_sum: Object.keys(rep).length ? rep : null, cost_estimated_sum: Object.keys(est).length ? est : null };
  }

  /** R4, R21: one group's sums as a read answers them: tokens and calls always; money apart (reported, estimated) only where
   *  `money` allows it and something was measured, else `cost: null, not_measurable: true`, never 0; `money` false (a
   *  viewer who does not own the account) answers no money field at all. */
  #figures(r, w, money) {
    const unstated = (() => { try { return JSON.parse(r.unstated || "[]"); } catch { return []; } })();
    const base = { calls: Number(r.calls), input_tokens: Number(r.input_tokens), output_tokens: Number(r.output_tokens),
      cache_read_input_tokens: Number(r.cache_read_input_tokens), cache_creation_input_tokens: Number(r.cache_creation_input_tokens),
      reasoning_tokens: Number(r.reasoning_tokens), tokens: tokensOf(r) + Number(r.reasoning_tokens), tokens_unstated: Number(r.tokens_unstated),
      unpriced_calls: Number(r.unpriced_calls), unstated };
    if (money === false) return { ...base };
    const m = money ? this.#moneyOf(w) : { cost_reported_sum: null, cost_estimated_sum: null };
    if (!m.cost_reported_sum && !m.cost_estimated_sum) return { ...base, cost: null, not_measurable: true, word: "ai.use.notmeasurable" };
    return { ...base, ...m };
  }
  static #SUMS = `SUM(calls) calls, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens,
    SUM(cache_read_input_tokens) cache_read_input_tokens, SUM(cache_creation_input_tokens) cache_creation_input_tokens,
    SUM(reasoning_tokens) reasoning_tokens, SUM(tokens_unstated) tokens_unstated, SUM(unpriced_calls) unpriced_calls,
    json_group_array(unstated) unstated_all`;
  static #unstatedOf(r) {
    let all = [];
    try { for (const s of JSON.parse(r.unstated_all || "[]")) all.push(...JSON.parse(s || "[]")); } catch { all = []; }
    return { ...r, unstated: JSON.stringify([...new Set(all)].sort()) };
  }

  /** R4 (T53) `aiUsage({owner, viewer, month})` (`op=aiusage` with `owner`): the account's month of use per kind of use,
   *  summed over members and naming none, to that account's owners (R2's refusals otherwise), its money as `#figures`
   *  answers it. `month` is `YYYY-MM`, this month in the group's zone by default. Writes nothing. */
  aiUsage({ owner = null, viewer = null, month = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.use_is_read_for", "use is read for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#ownerBar(p, viewer, "read");
    if (bar) return bar;
    const { day, zone } = this.#dayOf(at);
    const m = typeof month === "string" && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : day.slice(0, 7);
    const money = this.#ownerMoney(p, viewer).allows || null;
    const rows = this.#rows(`SELECT use, ${AiUse.#SUMS} FROM ai_usage WHERE owner = ? AND substr(day, 1, 7) = ?
                             GROUP BY use ORDER BY use`, p.owner, m).map(AiUse.#unstatedOf);
    return { ok: true, owner: p.owner, month: m, zone, uses: rows.map((r) => ({ use: r.use,
      ...this.#figures(r, { sql: "owner = ? AND substr(day, 1, 7) = ? AND use = ?", args: [p.owner, m, r.use] }, money) })) };
  }

  /** R4 (T53) `aiUsageMine({viewer, day?, month?})` (`op=aiusage` without `owner`): a member's own use, per paying account
   *  and per kind of use, for a local day (today by default) or, with `month`, a month; against each limit of those
   *  accounts that bound them, each with whether it is reached; money only for the accounts the member owns (D12).
   *  Nobody sees another member's spending. Writes nothing. */
  aiUsageMine({ viewer = null, day = null, month = null, at = null } = {}) {
    const id = memberIdOf(viewer);
    if (!id) return this.#refuse("NOT_YOUR_CEILING", localize("ai-use.index.a_members_use_of_the", "a member's use of the assistant is read only by that member. Nothing was read."));
    const today = this.#dayOf(at);
    const m = typeof month === "string" && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : null;
    const d = m ? null : typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.trim()) ? day.trim() : today.day;
    const period = m ? "substr(day, 1, 7) = ?" : "day = ?";
    const rows = this.#rows(`SELECT owner, use, ${AiUse.#SUMS} FROM ai_usage WHERE member = ? AND ${period}
                             GROUP BY owner, use ORDER BY owner, use`, id, m ?? d).map(AiUse.#unstatedOf);
    const owners = [...new Set(rows.map((r) => r.owner))];
    const payers = owners.map((o) => {
      const p = parseOwner(o);
      const mine = p ? this.#owns(p, `member:${id}`) : false;
      const money = mine ? this.#ownerMoney(p, `member:${id}`).allows || null : false;
      const limits = p ? this.#limits(o).filter((l) => l.scope === "overall" || l.scope === "per_member"
        || rows.some((r) => r.owner === o && r.use === l.scope)).map((l) => {
        const hit = this.#reachedFor(p, l.scope === "overall" || l.scope === "per_member" ? null : l.scope, id, this.#ms(at));
        return { scope: l.scope, unit: l.unit, period: l.period, amount: l.unit === "usd" ? Number(l.amount) / 100 : Number(l.amount),
                 inclusive: l.inclusive === null ? null : !!l.inclusive,
                 reached: !!(hit && hit.lim.scope === l.scope && hit.lim.unit === l.unit && hit.lim.period === l.period) };
      }) : [];
      return { owner: o, whose: p ? whoseOf(p) : null, uses: rows.filter((r) => r.owner === o).map((r) => ({ use: r.use,
        ...this.#figures(r, { sql: `owner = ? AND member = ? AND ${period} AND use = ?`, args: [o, id, m ?? d, r.use] }, mine ? money : false) })),
        limits };
    });
    return { ok: true, member: id, ...(m ? { month: m } : { day: d }), zone: today.zone, payers };
  }

  /** R5 (T53) `limitsReached({viewer, at})`: for each account the viewer owns, each limit first reached in its current
   *  period, `{key, owner, scope, unit, period, period_start, reached_at, source: "own"}`, the key stable per owner, limit
   *  and period; and each provider limit standing (R18), `{key, owner, scope, kind, resets_at, reached_at, source:
   *  "provider"}`, the key stable per owner, kind and `resets_at`. For `notice-producers` R16. Writes nothing; never throws. */
  limitsReached({ viewer = null, at = null } = {}) {
    try {
      if (!memberIdOf(viewer)) return { ok: true, reached: [] };
      const ms = this.#ms(at);
      const { day } = this.#dayOf(ms);
      const out = [];
      for (const r of this.#rows(`SELECT * FROM ai_limit_reached ORDER BY reached_at, owner, scope, unit, period`)) {
        const p = parseOwner(r.owner);
        if (!p || r.period_start !== AiUse.#start(r.period, day) || !this.#owns(p, viewer)) continue;
        if (!this.#limit(r.owner, r.scope, r.unit, r.period)) continue;
        out.push({ key: `ai-limit:${r.owner}:${r.scope}:${r.unit}:${r.period}:${r.period_start}`, owner: r.owner,
                   scope: r.scope, unit: r.unit, period: r.period, period_start: r.period_start, reached_at: r.reached_at, source: "own" });
      }
      const seen = new Set();
      for (const r of this.#providerStanding(`1 = 1`, [], ms)) {
        const p = parseOwner(r.owner);
        if (!p || !this.#owns(p, viewer)) continue;
        const key = `ai-provider-limit:${r.owner}:${r.kind}:${r.resets_at || "none"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, owner: r.owner, scope: r.scope, kind: r.kind, unit: null, period: null, period_start: null,
                   resets_at: r.resets_at || null, reached_at: r.recorded_at, source: "provider" });
      }
      return { ok: true, reached: out };
    } catch { return { ok: true, reached: [], unreadable: true }; }
  }

  /* ===== EXPLORING (R6, R9) ===== */

  /** R6: whether `question` lies in `p`'s scope (B6): the group's, a question the record holds; a project's, a
   *  question it draws on (its citers through `connections.citesInto`); a member's, none yet (D36). */
  #inScope(p, question) {
    if (typeof question !== "string" || !question.trim() || p.kind === "member") return false;
    const info = this.record.bundleInfo(question);
    if (!info || normalizeType(info.type) !== "inquiry") return false;
    if (p.kind === "group") return true;
    return this.#connections().citesInto(question).confirmed.includes(p.id);
  }

  /** R6 (T53) `exploreAllowed({owner, account_id, question, at})`, for the explorer (B9): `{ok: true, ask: false, label}`
   *  when exploring `question` on `owner`'s account `account_id` may run now (`label` `{kind: "machine", enabled_by:
   *  owner}`); `{ok: true, ask: true}` when that account's `explore` is `ask` and that local day is not approved (R9); else
   *  a refusal: `EXPLORE_NOT_ENABLED` (its `explore` `no`, or no account of the owner's named), `ai-accounts.aiKeptAway`'s,
   *  `EXPLORE_OUT_OF_SCOPE`, R3's `AI_LIMIT_REACHED`. A keep-away read that throws answers `ai-accounts`'
   *  `KEPT_AWAY_UNREADABLE` as given. Writes nothing; never throws. */
  exploreAllowed({ owner = null, account_id = null, question = null, at = null } = {}) {
    const p = parseOwner(owner);
    try {
      if (!p) return this.#exploreOff({ kind: "group", owner: String(owner) });
      const value = this.#exploreOf(p, account_id);
      if (value === "no") return this.#exploreOff(p);
      const c = this.#accounts();
      const keptAway = (args) => { try { return c.aiKeptAway(args); } catch { return KEPT_AWAY_UNREADABLE; } };
      const away = keptAway({ use: "explore", ...(p.kind === "project" ? { project: p.id } : {}) });
      if (away) return away;
      if (!this.#inScope(p, question)) return this.#outOfScope(p);
      if (p.kind === "group") {
        const drawn = this.#connections().citesInto(question).confirmed
          .filter((b) => { const i = this.record.bundleInfo(b); return i && normalizeType(i.type) === "project"; });
        let kept = null;
        try { kept = new Set(c.projectsKeptAway({ use: "explore" }) || []); } catch { return KEPT_AWAY_UNREADABLE; }
        if (drawn.length && drawn.every((b) => kept.has(b))) return keptAway({ project: drawn[0], use: "explore" });
      }
      const limit = this.useCheck({ owner: p.owner, member: null, use: "explore", at, account_id });
      if (limit) return limit;
      if (value === "ask" && !this.#approved(p, this.#dayOf(at).day)) return { ok: true, ask: true, owner: p.owner, account_id };
      return { ok: true, ask: false, owner: p.owner, account_id, label: { kind: "machine", enabled_by: p.owner } };
    } catch {
      return this.#exploreOff(p || { kind: "group", owner: String(owner) });
    }
  }

  #approved(p, day) { return !!this.#one(`SELECT approved_at FROM ai_explore_asks WHERE owner=? AND day=? AND approved_at IS NOT NULL`, p.owner, day); }

  /** R9 (T53) `exploreAsk({owner, account_id, at, what})`: for an owner whose account `account_id` has `explore` `ask`,
   *  records at most one pending ask a local day stating what is worth exploring (`what`, a statement or a list of the
   *  questions); a second ask that day answers the first's key and mints nothing. Answers `{ok, key, owner, day, minted}`. */
  exploreAsk({ owner = null, account_id = null, at = null, what = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#exploreOff({ kind: "group", owner: String(owner) });
    if (this.#exploreOf(p, account_id) !== "ask") return this.#exploreOff(p);
    const list = Array.isArray(what) ? what.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : null;
    const text = list ? (list.length === what.length && list.length ? JSON.stringify(list) : null)
      : typeof what === "string" && what.trim() ? what.trim() : null;
    if (!text || text.length > EXPLORE_WHAT_MAX)
      return this.#askFault("what", `an ask states what is worth exploring, a statement or a list of questions, at most ${EXPLORE_WHAT_MAX} characters.`);
    const ms = this.#ms(at);
    const { day } = this.#dayOf(ms);
    const key = `explore-ask:${p.owner}:${day}`;
    const held = this.#one(`SELECT asked_at FROM ai_explore_asks WHERE owner=? AND day=?`, p.owner, day);
    if (held && held.asked_at) return { ok: true, key, owner: p.owner, day, minted: false };
    this.#transact(() => {
      if (held) this.sql.exec(`UPDATE ai_explore_asks SET what=?, asked_at=? WHERE owner=? AND day=?`, text, AiUse.#iso(ms), p.owner, day);
      else this.sql.exec(`INSERT INTO ai_explore_asks (owner, day, what, asked_at, project_id) VALUES (?, ?, ?, ?, ?)`,
        p.owner, day, text, AiUse.#iso(ms), p.kind === "project" ? p.id : null);
      return { ok: true };
    });
    return { ok: true, key, owner: p.owner, day, minted: true };
  }

  /** R9 `exploreAsksPending({viewer, at})`: today's asks not yet approved, of the accounts the viewer owns, each
   *  `{key, owner, day, what, asked_at, word, text, estimate}`: `text` `words.json`'s `ai.queue.exploreask` with `{what}`
   *  filled and `{scope}`, `{account}` left for the screen; `estimate` R10's rough cost of one exploring run. For
   *  `notice-producers` R16. Writes nothing; never throws. */
  exploreAsksPending({ viewer = null, at = null } = {}) {
    try {
      if (!memberIdOf(viewer)) return { ok: true, asks: [] };
      const { day } = this.#dayOf(at);
      const asks = [];
      for (const r of this.#rows(`SELECT * FROM ai_explore_asks WHERE day=? AND asked_at IS NOT NULL AND approved_at IS NULL
                                  ORDER BY asked_at, owner`, day)) {
        const p = parseOwner(r.owner);
        if (!p || !this.#owns(p, viewer)) continue;
        let what = r.what;
        try { const j = JSON.parse(r.what); if (Array.isArray(j)) what = j; } catch { /* a statement */ }
        const shown = Array.isArray(what) ? what.join("; ") : what;
        asks.push({ key: `explore-ask:${r.owner}:${r.day}`, owner: r.owner, day: r.day, what, asked_at: r.asked_at,
                    word: "ai.queue.exploreask", text: fillWords(AI_USE_WORDS["ai.queue.exploreask"], { what: shown }),
                    estimate: this.#estimate(p, "explore", "explore", 1, viewer) });
      }
      return { ok: true, asks };
    } catch { return { ok: true, asks: [], unreadable: true }; }
  }

  /** R9 `exploreApprove({owner, day, by})` (`op=exploreapprove`): one of the account's owners approves exploring on it
   *  for that local day (R2's refusals for anyone else). */
  exploreApprove({ owner = null, day = null, by = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.exploring_is_approved_for", "exploring is approved for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#ownerBar(p, by, "approve exploring on");
    if (bar) return bar;
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.trim()))
      return this.#askFault("day", "an approval names its local day, YYYY-MM-DD.");
    const d = day.trim();
    const now = AiUse.#iso(this.#ms(at));
    const who = AiUse.#who(by);
    this.#transact(() => {
      if (this.#one(`SELECT day FROM ai_explore_asks WHERE owner=? AND day=?`, p.owner, d))
        this.sql.exec(`UPDATE ai_explore_asks SET approved_by=COALESCE(approved_by, ?), approved_at=COALESCE(approved_at, ?)
                       WHERE owner=? AND day=?`, who, now, p.owner, d);
      else this.sql.exec(`INSERT INTO ai_explore_asks (owner, day, approved_by, approved_at, project_id) VALUES (?, ?, ?, ?, ?)`,
        p.owner, d, who, now, p.kind === "project" ? p.id : null);
      return { ok: true };
    });
    const r = this.#one(`SELECT approved_by, approved_at FROM ai_explore_asks WHERE owner=? AND day=?`, p.owner, d);
    return { ok: true, owner: p.owner, day: d, approved_by: r.approved_by, approved_at: r.approved_at };
  }

  /* ===== COST BEFORE AND AFTER (R10, R11, R22; D12) ===== */

  /** R10: the range for `count` acts of `use` and `mode` on `p`'s account, from its latest measured acts:
   *  `basis: "account_measured"` with at least `ESTIMATE_MIN_ACTS` of them; money only when every act in the sample carried
   *  a cost in one unit and the plan's money allows it, else tokens and calls with `not_measurable`; fewer acts
   *  `basis: "not_known"`. */
  #estimate(p, use, mode, count, viewer = null) {
    const acts = this.#rows(`SELECT calls, tokens, reported_micro, reported_calls, estimated_micro, estimated_calls, money_unit
                             FROM ai_use_acts WHERE owner=? AND use=? AND mode=? ORDER BY last_at DESC, act DESC LIMIT ?`,
      p.owner, use, mode, ESTIMATE_SAMPLE_SIZE);
    if (acts.length < ESTIMATE_MIN_ACTS) return { low: null, high: null, unit: null, basis: "not_known" };
    const range = (f) => { const v = acts.map(f); return { low: Math.min(...v) * count, high: Math.max(...v) * count }; };
    const units = new Set(acts.map((a) => a.money_unit));
    const costed = acts.every((a) => Number(a.reported_calls) + Number(a.estimated_calls) >= Number(a.calls) && Number(a.calls) > 0);
    const allows = viewer ? this.#ownerMoney(p, viewer).allows : true;
    if (costed && units.size === 1 && ![...units][0]?.match?.(/mixed/) && [...units][0] && allows) {
      const r = range((a) => (Number(a.reported_calls) >= Number(a.calls) ? Number(a.reported_micro) : Number(a.estimated_micro)));
      return { low: r.low / 1e6, high: r.high / 1e6, unit: [...units][0], basis: "account_measured", measured: acts.length };
    }
    return { ...range((a) => Number(a.tokens)), unit: "tokens", calls: { ...range((a) => Number(a.calls)), unit: "calls" },
             basis: "account_measured", not_measurable: true, measured: acts.length };
  }

  /** R10 `useEstimate({owner, use, mode, entry_id?, count?, viewer, at?})` (`estimate` is its older name): before an AI act
   *  or exploring run (or a batch of `count`), a range `{low, high, unit, basis}` from that account's measured acts of that
   *  use and mode (`account_measured`); with too few and an `entry_id`, `agent-model.estimate`'s range for the part
   *  (`PART_OF_KIND[use]`), its `basis` unchanged (`measured` or `price_only`), money shown only where the plan's money
   *  allows it, else `not_measurable`; with neither, `basis: "not_known"`. Answered only to the account's owners (R2's
   *  refusals otherwise). Writes nothing, never throws. `agent-model.estimate` is asynchronous, so a call naming an
   *  `entry_id` answers a promise of the same answer (its refusals too); a call naming none answers at once, as before. */
  useEstimate({ owner = null, use = null, mode = null, entry_id = null, count = 1, viewer = null } = {}) {
    const named = entry_id !== null && entry_id !== undefined;
    const answer = this.#useEstimateNow({ owner, use, mode, entry_id, count, viewer, named });
    if (!named) return answer;
    if (!answer.fallback) return Promise.resolve(answer);
    return this.#entryRange(answer).catch(() => ({ ...answer.result, estimate: { low: null, high: null, unit: null, basis: "not_known" } }));
  }

  #useEstimateNow({ owner, use, mode, entry_id, count, viewer, named }) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.an_estimate_is_for", "an estimate is for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#ownerBar(p, viewer, "read");
    if (bar) return bar;
    if (!USE_KINDS.includes(use)) return this.#invalid("use", localize("ai-use.index.an_estimate_names_a_kind", "an estimate names a kind of use ({USE_KINDS}).", { USE_KINDS: String(USE_KINDS.join(", ")) }));
    const m = typeof mode === "string" && mode.trim() ? mode.trim() : use;
    const n = count === undefined || count === null ? 1 : count;
    if (!Number.isSafeInteger(n) || n < 1) return this.#invalid("count", localize("ai-use.index.an_estimates_count_is_a", "an estimate's count is a whole number of one or more."));
    if (named && !(typeof entry_id === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(entry_id)))
      return this.#invalid("entry_id", localize("ai-use.index.an_estimates_entry_is_a", "an estimate's entry_id names a catalogue entry."));
    const result = { ok: true, owner: p.owner, use, mode: m, count: n, ...(named ? { entry_id } : {}), estimate: this.#estimate(p, use, m, n, viewer) };
    if (named && result.estimate.basis === "not_known") return { fallback: true, result, p, use, n, entry_id, viewer };
    return result;
  }

  /** R10: the entry's range from `agent-model.estimate` (its R34) for the part of `use`, read over this store's catalogue;
   *  its `basis` kept; money only where the account's plan allows it, else the range withheld as `not_measurable`. */
  async #entryRange({ result, p, use, n, entry_id, viewer }) {
    const e = await entryEstimate({ entry_id, task: { kind: PART_OF_KIND[use], count: n } }, { catalogue: this.#catalogue() });
    if (!e || e.basis === "not_known") return result;
    const est = { low: e.low ?? null, high: e.high ?? null, unit: e.unit ?? null, basis: e.basis };
    if (!this.#ownerMoney(p, viewer).allows) return { ...result, estimate: { low: null, high: null, unit: null, basis: e.basis, not_measurable: true } };
    return { ...result, estimate: est };
  }
  estimate(args = {}) { return this.useEstimate(args); }

  /** The act `id`'s measures on accounts `viewer` owns. */
  #actsOwned(id, viewer) {
    return this.#rows(`SELECT * FROM ai_use_acts WHERE act=? ORDER BY owner`, id)
      .filter((r) => { const p = parseOwner(r.owner); return p && this.#owns(p, viewer); });
  }

  /** R11 (T53) `actualOf({run | act, viewer})`: the actual cost of one run or act after, only to the paying account's
   *  owners: `cost_reported` and `cost_estimated` apart (`{amount, unit}`), `not_measurable` where neither exists (never 0),
   *  and `by_entry: [{entry_id, label, calls}]` in first-seen order, each field null where not stated. An act not
   *  measured, or not on an account the viewer owns, answers `found: false`. Writes nothing. */
  actualOf({ run = null, act = null, viewer = null } = {}) {
    const id = typeof run === "string" && run ? run : typeof act === "string" && act ? act : null;
    if (!id || !memberIdOf(viewer)) return { ok: true, found: false };
    const rows = this.#actsOwned(id, viewer);
    if (!rows.length) return { ok: true, found: false };
    const r = rows[0];
    const nul = (v) => (v === "" ? null : v);
    const by_entry = this.#rows(`SELECT * FROM ai_use_act_entries WHERE owner = ? AND act = ? ORDER BY seq`, r.owner, id)
      .map((m) => ({ entry_id: nul(m.entry_id), label: { provider: nul(m.provider), host: nul(m.host), model_version: nul(m.model_version),
        effort: nul(m.effort), account_level: nul(m.account_level), owner: nul(m.label_owner) }, calls: Number(m.calls) }));
    const unit = r.money_unit && r.money_unit !== "mixed" ? r.money_unit : null;
    const rep = unit && Number(r.reported_calls) ? { amount: Number(r.reported_micro) / 1e6, unit } : null;
    const est = unit && Number(r.estimated_calls) ? { amount: Number(r.estimated_micro) / 1e6, unit } : null;
    return { ok: true, found: true, act: id, owner: r.owner, use: r.use, mode: r.mode, calls: Number(r.calls), tokens: Number(r.tokens),
             tokens_unstated: Number(r.tokens_unstated) > 0, unpriced_calls: Number(r.unpriced_calls),
             cost_reported: rep, cost_estimated: est, ...(rep || est ? {} : { not_measurable: true, word: "ai.use.notmeasurable" }),
             first_at: r.first_at, last_at: r.last_at, by_entry };
  }

  /** R22 (T53; BR24) `estimateSwitch({run, from_account, to_entry, to_account?, at, viewer})`: before a hop is shown, the
   *  cold-cache cost of resending the run's prefix on `to_entry`: `{low, high, unit}` from the run's latest stated input
   *  tokens times the entry's input price (low) and cache-write price (high), per million, plus `payer_change`
   *  (`{from_owner, to_owner}`, null when the target account has the same owner or none is named); `estimate: null` with
   *  `not_known` where the target is unpriced or the run states no input tokens, never zero. To the paying account's
   *  owners and the member whose run it is; anyone else is refused as R12 refuses. Writes nothing; never throws. */
  estimateSwitch({ run = null, from_account = null, to_entry = null, to_account = null, viewer = null } = {}) {
    try {
      const id = typeof run === "string" && run ? run : null;
      const acts = id ? this.#rows(`SELECT * FROM ai_use_acts WHERE act=? ORDER BY owner`, id) : [];
      const r = acts[0] ?? null;
      const p = r ? parseOwner(r.owner) : null;
      const vid = memberIdOf(viewer);
      const allowed = p && (this.#owns(p, viewer) || (vid && r.member === vid));
      if (!allowed) return this.#accountsBar(p ?? { kind: "member", owner: "member:", id: "" }, viewer, "reading a run's cost") ?? this.#refuse("NOT_YOUR_CEILING", "Nothing was read.");
      const ownerOf = (a) => { try { const u = typeof a === "string" ? this.#accounts().accountUsesOf({ account_id: a }) : null; return u && u.owner ? u.owner : null; } catch { return null; } };
      const fromOwner = ownerOf(from_account) ?? r.owner, toOwner = ownerOf(to_account);
      const payer_change = toOwner && toOwner !== fromOwner ? { from_owner: fromOwner, to_owner: toOwner } : null;
      const e = this.#entry(to_entry);
      const tokens = r.last_input_tokens === null || r.last_input_tokens === undefined ? null : Number(r.last_input_tokens);
      if (!e || !AiUse.#priced(e.prices, "input", "cache_write") || tokens === null)
        return { ok: true, run: id, to_entry, estimate: null, not_known: true, payer_change };
      const unit = e.prices.unit === "usd_per_million_tokens" ? "usd" : null;
      return { ok: true, run: id, to_entry, estimate: { low: (tokens * e.prices.input) / 1e6, high: (tokens * e.prices.cache_write) / 1e6, unit,
        price_date: e.prices.date ?? null }, payer_change };
    } catch { return { ok: true, run, to_entry, estimate: null, not_known: true, payer_change: null, unreadable: true }; }
  }

  /* ===== THE PANEL'S READ (R12; DEC-188) ===== */

  /** R12 `aiLimits({owner, viewer})` (`op=ailimits`): each limit held on one account, with its use in the current period
   *  (R5's sums, naming no member: a per-member limit answers the most any one member used) and the account's history
   *  of limits (set, changed, removed; who and when), to that account's owners only, as `ai-accounts` states them;
   *  anyone else is refused as it refuses them. Writes nothing. */
  aiLimits({ owner = null, viewer = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.limits_are_read_for", "limits are read for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#accountsBar(p, viewer, "reading an account's limits");
    if (bar) return bar;
    try {
      const { day, zone } = this.#dayOf(at);
      const money = (unit, v) => (v === null ? null : unit === "usd" ? Number(v) / 100 : Number(v));
      const limits = this.#limits(p.owner).map((l) => {
        const used = this.#usedFor(p.owner, l.scope, l.unit, l.period, day);
        return { scope: l.scope, use: USE_KINDS.includes(l.scope) ? l.scope : null, unit: l.unit, period: l.period,
                 amount: money(l.unit, l.amount), inclusive: l.inclusive === null ? null : !!l.inclusive,
                 on_top: l.inclusive === null ? null : !l.inclusive, period_start: AiUse.#start(l.period, day),
                 used: money(l.unit, used), reached: used >= Number(l.amount), set_by: l.set_by, set_at: l.set_at };
      });
      const history = this.#rows(`SELECT * FROM ai_limit_history WHERE owner=? ORDER BY seq`, p.owner)
        .map((h) => ({ change: h.change, scope: h.scope, unit: h.unit, period: h.period, amount: money(h.unit, h.amount),
                       inclusive: h.inclusive === null ? null : !!h.inclusive, by: h.by, at: h.at }));
      return { ok: true, owner: p.owner, zone, limits, history };
    } catch {
      return { ok: true, owner: p.owner, limits: null, history: null, unreadable: true };
    }
  }

  /* ===== USE OVER TIME (R14, R27; DEC-215 (1)) ===== */

  /** R14: the `n` local days ending with `day` (`YYYY-MM-DD`), oldest first: calendar days, so a zone's clock change
   *  neither skips nor repeats one. */
  static #daysEnding(day, n) {
    const end = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
    return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
  }

  /** R14, R27: a day's (or a span's) cost as a read answers it: `{reported, estimated}` in the unit summed, or null where
   *  the plan reports no money or nothing was priced. */
  #costOf(w, allows) {
    if (!allows) return null;
    const m = this.#moneyOf(w);
    if (!m.cost_reported_sum && !m.cost_estimated_sum) return null;
    return { reported: m.cost_reported_sum, estimated: m.cost_estimated_sum };
  }

  /** R14 (T53) `accountUseOverTime({owner, viewer, at})` (`op=aiuseovertime`): one account's use over time, to its owners
   *  only (R12's owners and refusals), as `{owner, days, periods}`. `days`: the `USE_DAYS` local days ending with the day
   *  of `at`, oldest first, each `{day, calls, tokens, cost}`, `cost` `{reported, estimated}` or `null` with
   *  `not_measurable`, never zero. `periods`: one per limit held, `{scope, unit, period, period_start, used, limit}`; with
   *  none, one month entry `overall`, in `usd` where the plan's money allows it, else `tokens`. Every figure names no
   *  member (K1450). Unreadable use answers `unreadable: true`, never zeros. Writes nothing; never throws. */
  accountUseOverTime({ owner = null, viewer = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.use_over_time_is_read_for", "use over time is read for 'group', 'project:<id>' or 'member:<id>'."));
    const bar = this.#accountsBar(p, viewer, "reading an account's use");
    if (bar) return bar;
    try {
      const { day, zone } = this.#dayOf(at);
      const span = AiUse.#daysEnding(day, USE_DAYS);
      const allows = this.#ownerMoney(p, viewer).allows;
      const byDay = new Map(this.#rows(`SELECT day, SUM(calls) calls, SUM(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens + reasoning_tokens) tokens
                                        FROM ai_usage WHERE owner = ? AND day >= ? AND day <= ? GROUP BY day`, p.owner, span[0], day)
        .map((r) => [r.day, r]));
      const days = span.map((d) => {
        const r = byDay.get(d);
        const cost = r ? this.#costOf({ sql: "owner = ? AND day = ?", args: [p.owner, d] }, allows) : null;
        return { day: d, calls: r ? Number(r.calls) : 0, tokens: r ? Number(r.tokens) : 0, cost, ...(cost ? {} : { not_measurable: true }) };
      });
      const money = (unit, v) => (unit === "usd" ? Number(v) / 100 : Number(v));
      const held = this.#limits(p.owner);
      const unit = allows ? "usd" : "tokens";
      const periods = held.length ? held.map((l) => ({ scope: l.scope, unit: l.unit, period: l.period, period_start: AiUse.#start(l.period, day),
        used: money(l.unit, this.#usedFor(p.owner, l.scope, l.unit, l.period, day, { through: day })), limit: money(l.unit, l.amount) }))
        : [{ scope: "overall", unit, period: "month", period_start: AiUse.#start("month", day),
             used: money(unit, this.#used(p.owner, unit, "month", day, { through: day })), limit: null }];
      return { ok: true, owner: p.owner, zone, days, periods };
    } catch {
      return { ok: true, owner: p.owner, days: null, periods: null, unreadable: true };
    }
  }

  /** R27 (T53; K5459) `accountUseByMember({owner, viewer, at})` (`op=aiusebymember`): for a team or project account only,
   *  to its owners (R12's), each member's use of that account over the `USE_DAYS` days ending with `at` and over each
   *  limit's current period, `{member, calls, tokens, cost}` (`cost` as R14's), sorted by cost then tokens. A member's own
   *  account is refused `NOT_A_PAYING_ACCOUNT` to anyone. Only this account's use is counted. Writes nothing; never
   *  throws; unreadable use answers `unreadable: true`. */
  accountUseByMember({ owner = null, viewer = null, at = null } = {}) {
    const p = parseOwner(owner);
    if (!p) return this.#invalid("owner", localize("ai-use.index.use_over_time_is_read_for", "use over time is read for 'group', 'project:<id>' or 'member:<id>'."));
    if (p.kind === "member") {
      /* DEC-49 REGION is-not-a-paying-account */
      return { ...this.#refuse("NOT_A_PAYING_ACCOUNT", localize("ai-use.index.not_a_paying_account", "a member's own account and its use are that member's alone; it is not a paying account read by member. Nothing was read.")), word: AI_USE_CHECKS.NOT_A_PAYING_ACCOUNT.word };
      /* END DEC-49 REGION is-not-a-paying-account */
    }
    const bar = this.#accountsBar(p, viewer, "reading an account's use by member");
    if (bar) return bar;
    try {
      const { day, zone } = this.#dayOf(at);
      const span = AiUse.#daysEnding(day, USE_DAYS);
      const allows = this.#ownerMoney(p, viewer).allows;
      const ids = this.#rows(`SELECT DISTINCT member FROM ai_usage WHERE owner = ? AND day >= ? AND day <= ? ORDER BY member`, p.owner, span[0], day).map((r) => r.member);
      const sumOf = (member, where, args) => {
        const r = this.#one(`SELECT COALESCE(SUM(calls), 0) calls, COALESCE(SUM(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens + reasoning_tokens), 0) tokens
                             FROM ai_usage WHERE owner = ? AND member = ? AND ${where}`, p.owner, member, ...args);
        const cost = this.#costOf({ sql: `owner = ? AND member = ? AND ${where}`, args: [p.owner, member, ...args] }, allows);
        return { calls: Number(r.calls), tokens: Number(r.tokens), cost, ...(cost ? {} : { not_measurable: true }) };
      };
      const costKey = (c) => (c ? Math.max(...Object.values(c.reported ?? {}), ...Object.values(c.estimated ?? {}), 0) : -1);
      const members = ids.map((m) => ({ member: m, ...sumOf(m, "day >= ? AND day <= ?", [span[0], day]),
        periods: this.#limits(p.owner).map((l) => ({ scope: l.scope, unit: l.unit, period: l.period, period_start: AiUse.#start(l.period, day),
          used: (l.unit === "usd" ? (v) => v / 100 : (v) => v)(this.#usedFor(p.owner, l.scope, l.unit, l.period, day, { through: day, member: m })) })) }))
        .sort((a, b) => costKey(b.cost) - costKey(a.cost) || b.tokens - a.tokens || (a.member < b.member ? -1 : 1));
      return { ok: true, owner: p.owner, zone, days: USE_DAYS, from: span[0], to: day, members };
    } catch { return { ok: true, owner: p.owner, members: null, unreadable: true }; }
  }

  /* ===== THRESHOLDS AND ALERTS (R23, R24; BR24) ===== */

  /** R23: `AI_THRESHOLD_INVALID`, naming the field. */
  #thresholdInvalid(field, detail) {
    /* DEC-49 REGION is-ai-threshold-invalid */
    return this.#refuse("AI_THRESHOLD_INVALID", localize("ai-use.index.threshold_invalid", "{detail} Nothing was changed.", { detail: String(detail) }),
      { field, word: AI_USE_CHECKS.AI_THRESHOLD_INVALID.word });
    /* END DEC-49 REGION is-ai-threshold-invalid */
  }

  /** R23 (T53) `aiThresholdSet({owner, scope, unit, period, kind, level, was?, by, at?})`: sets an owner's alert level,
   *  `kind` `percent` (of the matching limit, `THRESHOLD_PERCENT_MIN` to `THRESHOLD_PERCENT_MAX`) or `amount` (a positive
   *  number in the unit); several per owner, scope, unit and period; `level: null` removes the one `was` names (every one
   *  of that kind when `was` is absent). `unit` and `scope` follow R2's rules, `usd` only where the plan's money allows
   *  it. A percent threshold with no matching limit is `AI_THRESHOLD_INVALID`. The owner's own act, as R2. Each change
   *  appended with who and when. Never throws. */
  aiThresholdSet({ owner = null, scope = null, unit = null, period = null, kind = null, level = undefined, was = null, by = null, at = null } = {}) {
    try {
      const p = parseOwner(owner);
      if (!p) return this.#invalid("owner", localize("ai-use.index.a_limit_s_owner_is", "a limit's owner is 'group', 'project:<id>' or 'member:<id>'."));
      const bar = this.#ownerBar(p, by, "set");
      if (bar) return bar;
      const scopes = ["overall", ...USE_KINDS, ...(p.kind === "member" ? [] : ["per_member"])];
      if (!scopes.includes(scope)) return this.#invalid("scope", localize("ai-use.index.a_limits_scope_is_one", "a limit's scope is one of {scopes}{v1}.", { scopes: String(scopes.join(", ")), v1: "" }));
      if (!THRESHOLD_KINDS.includes(kind)) return this.#thresholdInvalid("kind", "a threshold's kind is percent or amount.");
      const toLevel = (v) => {
        if (kind === "percent") return Number.isSafeInteger(v) && v >= THRESHOLD_PERCENT_MIN && v <= THRESHOLD_PERCENT_MAX ? { stored: v }
          : { refusal: this.#thresholdInvalid("level", `a percent threshold is a whole number from ${THRESHOLD_PERCENT_MIN} to ${THRESHOLD_PERCENT_MAX}.`) };
        const a = this.#amountOf(unit, period, v);
        return a.refusal ? { refusal: this.#thresholdInvalid("level", "an amount threshold is a positive amount in its unit.") } : a;
      };
      const u = this.#amountOf(unit, period, null);
      if (u.refusal) return u.refusal;
      const ms = this.#ms(at);
      const now = AiUse.#iso(ms);
      const project = p.kind === "project" ? p.id : null;
      const who = AiUse.#who(by);
      if (level === null) {
        const w = was === null ? null : toLevel(was);
        if (w && w.refusal) return w.refusal;
        const gone = this.#rows(`SELECT level FROM ai_thresholds WHERE owner=? AND scope=? AND unit=? AND period=? AND kind=?${w ? " AND level=?" : ""}`,
          p.owner, scope, unit, period, kind, ...(w ? [w.stored] : []));
        this.#transact(() => {
          for (const g of gone) {
            this.sql.exec(`DELETE FROM ai_thresholds WHERE owner=? AND scope=? AND unit=? AND period=? AND kind=? AND level=?`, p.owner, scope, unit, period, kind, g.level);
            this.sql.exec(`INSERT INTO ai_threshold_history (owner, scope, unit, period, kind, level, change, project_id, by, at) VALUES (?, ?, ?, ?, ?, ?, 'removed', ?, ?, ?)`,
              p.owner, scope, unit, period, kind, g.level, project, who, now);
          }
          return { ok: true };
        });
        return { ok: true, owner: p.owner, scope, unit, period, kind, level: null, removed: gone.length, set_at: now };
      }
      const lv = toLevel(level);
      if (lv.refusal) return lv.refusal;
      if (kind === "percent" && !this.#limit(p.owner, scope, unit, period))
        return this.#thresholdInvalid("kind", "a percent threshold needs a limit of the same scope, unit and period; set one, or use an amount.");
      if (unit === "usd" && !this.#ownerMoney(p, by).allows) return this.#unitUnavailable();
      const held = !!this.#one(`SELECT level FROM ai_thresholds WHERE owner=? AND scope=? AND unit=? AND period=? AND kind=? AND level=?`, p.owner, scope, unit, period, kind, lv.stored);
      this.#transact(() => {
        this.sql.exec(`INSERT INTO ai_thresholds (owner, scope, unit, period, kind, level, project_id, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(owner, scope, unit, period, kind, level) DO UPDATE SET set_by=excluded.set_by, set_at=excluded.set_at`,
          p.owner, scope, unit, period, kind, lv.stored, project, who, now);
        this.sql.exec(`INSERT INTO ai_threshold_history (owner, scope, unit, period, kind, level, change, project_id, by, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          p.owner, scope, unit, period, kind, lv.stored, held ? "changed" : "set", project, who, now);
        this.#noteCrossed(p, ms);
        return { ok: true };
      });
      const shown = kind === "amount" && unit === "usd" ? lv.stored / 100 : lv.stored;
      return { ok: true, owner: p.owner, scope, unit, period, kind, level: shown, change: held ? "changed" : "set", set_at: now };
    } catch (err) {
      return this.#thresholdInvalid("owner", `the threshold could not be set (${String(err && err.message || err).slice(0, 200)}).`);
    }
  }

  /** R24: every threshold of `p` crossed at `ms` and not yet noted for its period is noted, once, with its basis. */
  #noteCrossed(p, ms) {
    const { day } = this.#dayOf(ms);
    const at = AiUse.#iso(ms);
    for (const t of this.#rows(`SELECT * FROM ai_thresholds WHERE owner=?`, p.owner)) {
      const start = AiUse.#start(t.period, day);
      if (this.#one(`SELECT owner FROM ai_threshold_crossed WHERE owner=? AND scope=? AND unit=? AND period=? AND kind=? AND level=? AND period_start=?`,
        p.owner, t.scope, t.unit, t.period, t.kind, t.level, start)) continue;
      const lim = t.kind === "percent" ? this.#limit(p.owner, t.scope, t.unit, t.period) : null;
      if (t.kind === "percent" && !lim) continue;
      const target = t.kind === "percent" ? (Number(lim.amount) * Number(t.level)) / 100 : Number(t.level);
      const used = this.#usedFor(p.owner, t.scope, t.unit, t.period, day);
      if (used < target || used === 0) continue;
      const basis = t.unit === "usd" ? this.#usdUsed(AiUse.#where(p.owner, t.period, day, t.scope === "overall" ? { excluded: this.#exclusive(p.owner) }
        : USE_KINDS.includes(t.scope) ? { use: t.scope } : {})).basis : null;
      this.sql.exec(`INSERT INTO ai_threshold_crossed (owner, scope, unit, period, kind, level, period_start, crossed_at, basis, project_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, p.owner, t.scope, t.unit, t.period, t.kind, t.level, start, at, basis,
                     p.kind === "project" ? p.id : null);
    }
  }

  /** R24 (T53) `thresholdsReached({viewer, at})`: for each account the viewer owns, each threshold first crossed in its
   *  current period, `{owner, scope, unit, period, period_start, kind, level, crossed_at, basis, key, word}`, a stable key
   *  per owner, threshold and period (word key `ai.alert.threshold`). A `usd` threshold says its `basis` (`reported` or
   *  `estimated`). For `notice-producers`. Writes nothing; never throws. */
  thresholdsReached({ viewer = null, at = null } = {}) {
    try {
      if (!memberIdOf(viewer)) return { ok: true, crossed: [] };
      const { day } = this.#dayOf(at);
      const out = [];
      for (const r of this.#rows(`SELECT c.* FROM ai_threshold_crossed c JOIN ai_thresholds t ON t.owner=c.owner AND t.scope=c.scope
                                    AND t.unit=c.unit AND t.period=c.period AND t.kind=c.kind AND t.level=c.level ORDER BY c.crossed_at, c.owner`)) {
        const p = parseOwner(r.owner);
        if (!p || r.period_start !== AiUse.#start(r.period, day) || !this.#owns(p, viewer)) continue;
        out.push({ key: `ai-threshold:${r.owner}:${r.scope}:${r.unit}:${r.period}:${r.kind}:${r.level}:${r.period_start}`, owner: r.owner,
          scope: r.scope, unit: r.unit, period: r.period, period_start: r.period_start, kind: r.kind,
          level: r.kind === "amount" && r.unit === "usd" ? Number(r.level) / 100 : Number(r.level), crossed_at: r.crossed_at,
          basis: r.basis ?? null, word: "ai.alert.threshold" });
      }
      return { ok: true, crossed: out };
    } catch { return { ok: true, crossed: [], unreadable: true }; }
  }

  /* ===== RECONCILIATION (R25) ===== */

  /** R25 (T53) `reconcile({owner, period, provider_figures: {tokens?, cost?, unit?, source}, viewer, at?})`: Civicsmith's
   *  totals for the account and period (`YYYY-MM` or `YYYY-MM-DD`; R4's sums) against the figures handed in, to the
   *  account's owners only: per figure `{ours, theirs, difference, basis, within_tolerance}` against `RECONCILE_TOLERANCE`;
   *  a figure not stated is null and not compared; a difference outside tolerance is recorded as `reconcile_gap` with who
   *  and when. Writes only that record; never throws. */
  reconcile({ owner = null, period = null, provider_figures = null, viewer = null, at = null } = {}) {
    try {
      const p = parseOwner(owner);
      if (!p) return this.#invalid("owner", localize("ai-use.index.use_is_read_for", "use is read for 'group', 'project:<id>' or 'member:<id>'."));
      const bar = this.#accountsBar(p, viewer, "reconciling an account's use");
      if (bar) return bar;
      const f = provider_figures && typeof provider_figures === "object" && !Array.isArray(provider_figures) ? provider_figures : null;
      if (!f || !(typeof f.source === "string" && /^[a-z_]{1,40}$/.test(f.source))) return this.#invalid("owner", "the figures handed in name their source.");
      const month = typeof period === "string" && /^\d{4}-\d{2}$/.test(period);
      const dayP = typeof period === "string" && /^\d{4}-\d{2}-\d{2}$/.test(period);
      if (!month && !dayP) return this.#invalid("period", "a reconciliation names its period, YYYY-MM or YYYY-MM-DD.");
      const w = month ? { sql: "owner = ? AND substr(day, 1, 7) = ?", args: [p.owner, period] } : { sql: "owner = ? AND day = ?", args: [p.owner, period] };
      const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
      const tok = Number(this.#one(`SELECT COALESCE(SUM(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens + reasoning_tokens), 0) t FROM ai_usage WHERE ${w.sql}`, ...w.args).t);
      const unit = typeof f.unit === "string" && /^[a-z]{3,8}$/.test(f.unit) ? f.unit : "usd";
      const m = this.#moneyOf(w);
      const ourCost = m.cost_reported_sum && m.cost_reported_sum[unit] !== undefined ? { v: m.cost_reported_sum[unit], basis: "reported" }
        : m.cost_estimated_sum && m.cost_estimated_sum[unit] !== undefined ? { v: m.cost_estimated_sum[unit], basis: "estimated" } : { v: null, basis: null };
      const compare = (ours, theirs, basis) => {
        if (theirs === null || ours === null) return { ours, theirs, difference: null, basis, within_tolerance: null };
        const difference = theirs - ours;
        const scale = Math.max(Math.abs(ours), Math.abs(theirs));
        return { ours, theirs, difference, basis, within_tolerance: scale === 0 || Math.abs(difference) <= RECONCILE_TOLERANCE * scale };
      };
      const tokens = compare(tok, num(f.tokens), "counted");
      const cost = { ...compare(ourCost.v, num(f.cost), ourCost.basis), unit };
      const now = AiUse.#iso(this.#ms(at));
      const gaps = [["tokens", tokens, null], ["cost", cost, unit]].filter(([, c]) => c.within_tolerance === false);
      if (gaps.length) this.#transact(() => {
        for (const [figure, c, u] of gaps) this.sql.exec(`INSERT INTO ai_reconcile_gaps (owner, period, figure, ours, theirs, unit, source, project_id, by, at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, p.owner, period, figure, c.ours, c.theirs, u, f.source, p.kind === "project" ? p.id : null, AiUse.#who(viewer), now);
        return { ok: true };
      });
      return { ok: true, owner: p.owner, period, source: f.source, tokens, cost, recorded: gaps.map(([g]) => g), change: gaps.length ? "reconcile_gap" : null };
    } catch { return { ok: true, owner, period, unreadable: true }; }
  }

  /* ===== RE-TESTING (R28, R29, R30; K5480, K5481) ===== */

  /** R28: an entry's re-test money in the month of `day`, in whole cents, rounded up: the reported where any was, else the
   *  estimated (mode `retest`). */
  #retestUsed(owner, entry_id, day) {
    const r = this.#one(`SELECT COALESCE(SUM(reported_micro), 0) r, COALESCE(SUM(estimated_micro), 0) e FROM ai_usage_entries
                         WHERE owner = ? AND entry_id = ? AND mode = ? AND substr(day, 1, 7) = substr(?, 1, 7)`, owner, entry_id, RETEST_MODE, day);
    return Math.ceil((Number(r.r) > 0 ? Number(r.r) : Number(r.e)) / 1e4);
  }

  #retestRow(owner) { return this.#one(`SELECT * FROM ai_retest WHERE owner=?`, owner); }

  /** R28 (T53) `retestSet({owner, on?, caps?, by, at?})` (`op=airetestset`): an owner of the paying account (R12's) sets
   *  its re-test switch (`on`, true by default) and its caps, `{entry_id: amount | null}`, each an R2 limit on that account
   *  with scope `retest:<entry_id>`, unit `usd`, period `month` (`null` removes it; `usd` only where the plan's money
   *  allows). Every change recorded who and when. Never throws. */
  retestSet({ owner = null, on = undefined, caps = undefined, by = null, at = null } = {}) {
    try {
      const p = parseOwner(owner);
      if (!p) return this.#invalid("owner", localize("ai-use.index.a_limit_s_owner_is", "a limit's owner is 'group', 'project:<id>' or 'member:<id>'."));
      const bar = this.#accountsBar(p, by, "setting an account's re-tests");
      if (bar) return bar;
      if (on !== undefined && typeof on !== "boolean") return { ...this.#refuse("AI_LIMIT_INVALID", "re-testing is on (true) or off (false). Nothing was changed."), field: "on" };
      if (caps !== undefined && (caps === null || typeof caps !== "object" || Array.isArray(caps)))
        return this.#invalid("amount", "the caps are {entry_id: amount in usd, or null}.");
      const set = [];
      for (const [entry, amount] of Object.entries(caps ?? {})) {
        if (!/^[A-Za-z0-9._:-]{1,96}$/.test(entry)) return this.#invalid("scope", "a cap names a catalogue entry.");
        const a = this.#amountOf("usd", "month", amount);
        if (a.refusal) return a.refusal;
        set.push([entry, a.stored]);
      }
      if (set.some(([, v]) => v !== null) && !this.#ownerMoney(p, by).allows) return this.#unitUnavailable();
      const ms = this.#ms(at);
      const now = AiUse.#iso(ms);
      const who = AiUse.#who(by);
      this.#transact(() => {
        for (const [entry, v] of set) if (v !== null || this.#limit(p.owner, `retest:${entry}`, "usd", "month")) this.#write(p.owner, `retest:${entry}`, "usd", "month", v, null, who, now);
        if (on !== undefined) {
          const held = this.#retestRow(p.owner);
          const was = held ? !!held.on_ : true;
          if (!held) this.sql.exec(`INSERT INTO ai_retest (owner, on_, changed_by, changed_at, turned_off_by, turned_off_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            p.owner, on ? 1 : 0, who, now, on ? null : who, on ? null : now, p.kind === "project" ? p.id : null);
          else if (was !== on) this.sql.exec(`UPDATE ai_retest SET on_=?, changed_by=?, changed_at=?, turned_off_by=?, turned_off_at=? WHERE owner=?`,
            on ? 1 : 0, who, now, on ? null : who, on ? null : now, p.owner);
          this.sql.exec(`INSERT INTO ai_limit_history (owner, scope, unit, period, change, amount, inclusive, project_id, by, at)
                         VALUES (?, 'retest', 'switch', 'month', ?, NULL, NULL, ?, ?, ?)`, p.owner, on ? "retest_on" : "retest_off", p.kind === "project" ? p.id : null, who, now);
        }
        return { ok: true };
      });
      return { ok: true, owner: p.owner, retest: this.#retestOf(p.owner), set_at: now };
    } catch (err) { return this.#invalid("owner", `re-testing could not be set (${String(err && err.message || err).slice(0, 200)}).`); }
  }

  /** R28: an account's `{on, caps: {entry_id: amount}}`. */
  #retestOf(owner) {
    const row = this.#retestRow(owner);
    const caps = Object.fromEntries(this.#rows(`SELECT scope, amount FROM ai_limits WHERE owner=? AND scope LIKE 'retest:%' ORDER BY scope`, owner)
      .map((r) => [r.scope.slice(7), Number(r.amount) / 100]));
    return { on: row ? !!row.on_ : true, caps };
  }

  /** R28 (T53) `retestAllowed({owner, entry_id, at})`: `true`, or `{off: true}` while re-testing is off, or
   *  `{cap_reached: true, cap, used}` at the entry's monthly cap, carrying R3's `AI_LIMIT_REACHED` on the cap's scope; `ai-gate`'s canary schedule asks it before each run.
   *  Unreadable answers `{off: true, unreadable: true}` (fail closed). Writes nothing; never throws. */
  retestAllowed({ owner = null, entry_id = null, at = null } = {}) {
    try {
      const p = parseOwner(owner);
      if (!p || typeof entry_id !== "string") return { off: true, unreadable: true };
      const r = this.#retestOf(p.owner);
      if (!r.on) return { off: true };
      const lim = this.#limit(p.owner, `retest:${entry_id}`, "usd", "month");
      if (!lim) return true;
      const { day } = this.#dayOf(at);
      const used = this.#retestUsed(p.owner, entry_id, day);
      /* at the cap: R3's refusal, `AI_LIMIT_REACHED` on the cap's scope, beside `cap_reached` */
      return used >= Number(lim.amount) ? { ...this.#limitReached(p, lim, null, AiUse.#start("month", day)), source: "own", walkable: false,
        cap_reached: true, cap: Number(lim.amount) / 100, used: used / 100 } : true;
    } catch { return { off: true, unreadable: true }; }
  }

  /** R29 (T53) `retestingOff({viewer, at})`, in-plane: for each paying account the viewer owns (R12's) whose re-testing is
   *  off, `{owner, turned_off_by, turned_off_at, key}`, a stable key per account and turning-off, for `queue-producers`'
   *  `retesting-off` item (`queue.retesting-off.summary`); this module calls no queue. Writes nothing; never throws. */
  retestingOff({ viewer = null } = {}) {
    try {
      if (!memberIdOf(viewer)) return { ok: true, off: [] };
      const off = this.#rows(`SELECT * FROM ai_retest WHERE on_ = 0 ORDER BY turned_off_at, owner`).filter((r) => {
        const p = parseOwner(r.owner);
        return p && this.#owns(p, viewer);
      }).map((r) => ({ owner: r.owner, turned_off_by: r.turned_off_by, turned_off_at: r.turned_off_at,
        key: `retesting-off:${r.owner}:${r.turned_off_at}`, word: "queue.retesting-off.summary" }));
      return { ok: true, off };
    } catch { return { ok: true, off: [], unreadable: true }; }
  }

  /* ===== HEALTH COUNTS (R32, R33; AD38; K5487, K5491) ===== */

  /** R32: whether `by` is an active administrator (never a machine). */
  #admin(by) { return !isMachineIdentity(String(by)) && this.#owns({ kind: "group", owner: "group" }, by); }

  /** R32 (T53) `healthShareSet({on, by, at?})` (`op=aihealthset`): the team's switch, off by default, set only by an active
   *  administrator (`NOT_AN_ADMIN`), each set appended with who and when. Never throws. */
  healthShareSet({ on = undefined, by = null, at = null } = {}) {
    try {
      if (!this.#admin(by)) return notAnAdmin(by ?? null, localize("ai-use.index.share_health_counts", "share the team's AI health counts"));
      if (typeof on !== "boolean") return { ...this.#refuse("AI_LIMIT_INVALID", "sharing is on (true) or off (false). Nothing was changed."), field: "on" };
      const now = AiUse.#iso(this.#ms(at));
      this.#transact(() => { this.sql.exec(`INSERT INTO ai_health_switch (on_, by, at) VALUES (?, ?, ?)`, on ? 1 : 0, AiUse.#who(by), now); return { ok: true }; });
      return { ok: true, ...this.healthShareState() };
    } catch (err) { return { ...this.#refuse("AI_LIMIT_INVALID", `the switch could not be set (${String(err && err.message || err).slice(0, 200)}).`), field: "on" }; }
  }

  /** R32 `healthShareState()`: `{on, since, by}` from the latest set; before any, off. */
  healthShareState() {
    try {
      const r = this.#one(`SELECT on_, by, at FROM ai_health_switch ORDER BY seq DESC LIMIT 1`);
      return r ? { on: !!r.on_, since: r.at, by: r.by } : { on: false, since: null, by: null };
    } catch { return { on: false, since: null, by: null, unreadable: true }; }
  }

  /** R33: the reports for the complete UTC days from `fromDay` to yesterday, not yet sent, each with its entries. */
  #healthReports(fromDay, ms) {
    const today = AiUse.#iso(ms).slice(0, 10);
    const floor = new Date(Date.parse(`${today}T00:00:00Z`) - HEALTH_DAYS_MAX * 864e5).toISOString().slice(0, 10);
    const lastSent = this.#one(`SELECT MAX(day) d FROM ai_health_sent`)?.d ?? null;
    const after = lastSent ? new Date(Date.parse(`${lastSent}T00:00:00Z`) + 864e5).toISOString().slice(0, 10) : null;
    const start = [fromDay, floor, after].filter(Boolean).sort().pop();
    const rows = this.#rows(`SELECT * FROM ai_health WHERE personal = 0 AND day >= ? AND day < ? AND calls >= ? ORDER BY day, entry_id`, start, today, HEALTH_MIN_CALLS);
    const sent = new Set(this.#rows(`SELECT day FROM ai_health_sent`).map((r) => r.day));
    const byDay = new Map();
    for (const r of rows) {
      if (sent.has(r.day)) continue;
      let errors = {};
      try { errors = JSON.parse(r.errors); } catch { errors = {}; }
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push({ entry_id: r.entry_id, calls: Number(r.calls), refused: Number(r.refused), silent: Number(r.silent), errors });
    }
    return [...byDay.entries()].map(([day, entries]) => ({ report_version: HEALTH_REPORT_VERSION, day, entries }));
  }

  /** R33 (T53) `healthReport({at})`: only while the switch is on, one report per complete UTC day since the later of the
   *  switch's `since` and the last day sent, at most `HEALTH_DAYS_MAX` days back: `{report_version, day, entries:
   *  [{entry_id, calls, refused, silent, errors}]}`, summing only rows of no personal subscription and holding only entries
   *  with at least `HEALTH_MIN_CALLS` calls that day; nothing else. Switched off, `null`. Writes nothing; never throws. */
  healthReport({ at = null } = {}) {
    try {
      const s = this.healthShareState();
      if (!s.on) return null;
      return this.#healthReports(s.since.slice(0, 10), this.#ms(at));
    } catch { return null; }
  }

  /** R33 `healthSent({day, at?})`: records a day delivered, so it is never sent twice. */
  healthSent({ day = null, at = null } = {}) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ...this.#refuse("AI_LIMIT_INVALID", "a sent report names its UTC day. Nothing was recorded."), field: "day" };
    this.sql.exec(`INSERT OR IGNORE INTO ai_health_sent (day, sent_at) VALUES (?, ?)`, day, AiUse.#iso(this.#ms(at)));
    return { ok: true, day };
  }

  /** R33 `healthPreview({viewer, at})` (`op=aihealthpreview`, administrators): the next reports exactly as they would be
   *  sent, the switch on or off (from its `since` when on, else `HEALTH_DAYS_MAX` days back). */
  healthPreview({ viewer = null, at = null } = {}) {
    if (!this.#admin(viewer)) return notAnAdmin(viewer ?? null, localize("ai-use.index.preview_health_counts", "preview the team's AI health counts"));
    try {
      const s = this.healthShareState();
      return { ok: true, on: s.on, reports: this.#healthReports(s.on ? s.since.slice(0, 10) : null, this.#ms(at)) };
    } catch { return { ok: true, on: false, reports: null, unreadable: true }; }
  }
}

/* K61: the one AiUse of a Durable Object's storage, made, migrated and declared on first use. `deps` (a test's own
   modules, or the group's `zone`) are read on the first call only. */
const OF = new WeakMap();
export function aiUseOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let u = OF.get(storage);
  if (!u) {
    u = new AiUse(ctx, deps);
    OF.set(storage, u);
    u.migrate();
  }
  return u;
}

/** The ops this module answers (`op-declarations` R41): `ailimitset`, `ailimits`, `aiusage` (with `owner` an account's
 *  month, R4; without, the viewer's own), `exploreapprove`, `aiuseovertime` (R14), and (T53) `aiusebymember` (R27),
 *  `airetestset` (R28), `aihealthset` (R32), `aihealthpreview` (R33), and (F3) `aibudgetset` and `aiprojectbudget`
 *  (R2's limits and R23's thresholds, the screens' spellings). Every identity (`by`, `viewer`) is the control
 *  plane's stamp, read from the QUERY after the body is spread, so a caller's own copy never wins (D-136). */
/** F3: the owner `aibudgetset` names: `group` (or `team`, or none given), the member's own from the stamp (`member`), or
 *  an owner as written (the act's own bar judges it). */
const budgetOwner = (owner, by) => (owner === undefined || owner === null || owner === "group" || owner === "team" ? "group"
  : owner === "member" ? (memberIdOf(by) ? `member:${memberIdOf(by)}` : null) : owner);

export function aiUseOps(use, url, body, env = null) {
  /* R17 (K5132): the store's environment is the instance clock's source (`BIO_NOW_MS`), as credentialsOps hands it */
  if (env && typeof env === "object") use.env = env;
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  return {
    ailimitset: () => use.aiLimitSet({ ...b, by: q("by") }),
    ailimits: () => use.aiLimits({ owner: q("owner") ?? b.owner ?? null, viewer: q("viewer") }),
    aiusage: () => (q("owner") != null
      ? use.aiUsage({ owner: q("owner"), viewer: q("viewer"), month: q("month") })
      : use.aiUsageMine({ viewer: q("viewer"), day: q("day"), month: q("month") })),
    exploreapprove: () => use.exploreApprove({ ...b, by: q("by") }),
    aiuseovertime: () => use.accountUseOverTime({ owner: q("owner") ?? b.owner ?? null, viewer: q("viewer") }),
    aiusebymember: () => use.accountUseByMember({ owner: q("owner") ?? b.owner ?? null, viewer: q("viewer") }),
    airetestset: () => use.retestSet({ ...b, by: q("by") }),
    aihealthset: () => use.healthShareSet({ ...b, by: q("by") }),
    aihealthpreview: () => use.healthPreview({ viewer: q("viewer") }),
    /* F3 (screens-ai R2, R7): a limit or (with `kind`) an alert threshold, the team's (`owner` `group`, the default) or the
       member's own (`member`, the member from the stamp) by `aibudgetset`, a project's by `aiprojectbudget` (`project`) */
    aibudgetset: () => use.budgetSet({ ...b, owner: budgetOwner(b.owner, q("by")), by: q("by") }),
    aiprojectbudget: () => use.budgetSet({ ...b, owner: typeof b.project === "string" && b.project ? `project:${b.project}` : null,
      by: q("by") }, "project"),
  };
}

/* R16 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  ailimitset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description: localize("ai-use.declared.ailimitset", "the account's configuration: a limit on one account's assistant use, set by its owner; moves no document, claim or grade"),
    fields: { accepts: ["owner","scope","unit","period","amount","inclusive"], requires: ["owner","scope","unit","period","amount"] } },
  exploreapprove: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description: localize("ai-use.declared.exploreapprove", "the account's configuration: an owner's approval of one day's exploring on that account; moves no document, claim or grade"),
    fields: { accepts: ["owner","day"], requires: ["owner","day"] } },
  /* F2 (op-grades R57; coordinator ruling 5 Nov 04:19): the assistant's ops this module serves, with R57's grades: the
     re-tests' switch and caps and the health report's switch reversible (a further set takes each back), the use by
     member and the health report's preview reads. Classes and stamps agree with op-declarations' hand rows (t48). */
  airetestset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("ai-use.declared.airetestset", "the account's configuration: whether an account re-tests its entries and each entry's monthly cap, set by an owner of the paying account; a further set takes it back"),
    fields: { accepts: ["owner","on","caps"], requires: ["owner"] } },
  aihealthset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("ai-use.declared.aihealthset", "the team's configuration: whether the team shares its AI health counts, an administrator's act recorded with who and when; a further set takes it back"),
    fields: { accepts: ["on"], requires: ["on"] } },
  aiusebymember: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("ai-use.declared.aiusebymember", "read: each member's use of a team's or a project's account, to that account's owners; writes nothing") },
  aihealthpreview: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("ai-use.declared.aihealthpreview", "read: the health report the team would share, to an administrator; writes nothing") },
  /* F3 (coordinator 17:24, screens-ai R2, R7): the screens' limits and alerts, op-grades R57's reversible rows (a further
     set takes each back), served here (`budgetSet`) and reaching OPS through this declaration (op-declarations R80) */
  aibudgetset: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by"], needs: null, weight: "reversible", description: localize("ai-use.declared.aibudgetset", "the account's configuration: a limit or an alert threshold on the team's or the member's own account, set by its owner; a further set takes it back"),
    fields: { accepts: ["owner","scope","unit","period","amount","inclusive","kind","level","was"], requires: ["scope","unit","period",["amount","level"]] } },
  aiprojectbudget: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by"], needs: null, weight: "reversible", description: localize("ai-use.declared.aiprojectbudget", "the project's configuration: a limit or an alert threshold on a project's account, set by an owner of the project; a further set takes it back"),
    fields: { accepts: ["project","scope","unit","period","amount","inclusive","kind","level","was"], requires: ["project","scope","unit","period",["amount","level"]] } },
});
