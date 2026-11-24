/* answers — the plane's half of the assistant (requirements: `build/requirements/answers.md`; T33-53; K1450, K1474,
 * K1479, K1481, K1502, K1505 (14)). What an ask may read (R1, R2: `./scope.mjs`), what an answer must look like and the
 * checks every answer passes before a member sees it (R3–R6, R22: `./check.mjs`), the rule services every rule comes
 * from (R7–R12: `./rules.mjs`), the unattributed tallies (R13, R14), and a member's standing questions (R15–R21, R26–R28,
 * R34: `./standing.mjs`). The model only understands the member's words, writes queries, quotes and translates; it never
 * answers from its own knowledge.
 *
 * REACHED as `answersOf(host, deps)`: one instance per host, created on the first call with `deps`, its tables made
 * and declared (R23). `deps` (each an object, or a function answering one, reached lazily; an absent one answers
 * `not_held` or is skipped where a read needs it):
 *   record, membership   record-core and membership on the same host unless a test passes its own.
 *   standards, content, events, entities, lines, people, duties, calculations   the owners the rule services read.
 *   retrieval            the saved query's runner (its R70), the relations it compiles with (its R72) and the
 *                        governing zone (its R69), so a question is checked and run on one day boundary (N584).
 *   query                query-language's `savedForm` (its R30).
 *   relations, zone      each a function: the relations and the zone, used only where `retrieval` gives none.
 *   accounts             `ai-accounts` (T48-36; N996 §5): whether the group keeps its material away from AI (its R7,
 *                        `aiKeptAway`, the one site of `AI_KEPT_AWAY`, K231), the account that serves an act (its R7,
 *                        R11, `accountFor`), for R19, R26 and R30, and the projects kept away from a use (its R22,
 *                        `projectsKeptAway`), for R30's widening of R2; `aiAccountsOf` on the same host unless a test or
 *                        the composition root passes its own.
 *   credentials          the standing question's grant (its R32, `aiGrantMintStanding`), for R19; nothing else.
 *   useCheck             `({owner, member, use, at})` → null or `AI_LIMIT_REACHED`: the paying account's limits, in
 *                        place of the ceiling (R30), read for every account, a sign-in's included; `ai-use.useCheck`
 *                        (its R3) on the same host unless a test or the composition root passes its own.
 *   combine              `jurisdictions.combine` (default), over the active profiles (`record-core` R26).
 *   now                  the module's clock, an ISO instant (default: the wall clock).
 *
 * No place is named here (R25): zones and rules are profile data. */

import { sha256HexSync } from "../record-grammar/index.mjs";
import { localDay, dayRange } from "../civil-time/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, listenerRefusal, notAnAdmin } from "../membership/index.mjs";
import { AI_GRANT_TTL_SECONDS } from "../credentials/index.mjs";
import { aiAccountsOf, AI_ACCOUNT_CHECKS } from "../ai-accounts/index.mjs";
import { savedForm } from "../query.mjs";
import { combine as combineProfiles } from "../../../jurisdictions/index.mjs";
import { aiUseOf } from "../ai-use/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { ANSWERS_TABLES, migrateAnswers } from "./schema.mjs";
import { refusal } from "./checks.mjs";
import { askAdmits, scrubRead } from "./scope.mjs";
import { ReadLog } from "./readlog.mjs";
import { checkAnswer } from "./check.mjs";
import { BUILT_IN_SERVICES, notHeld } from "./rules.mjs";
import * as S from "./standing.mjs";

export { ANSWERS_CHECKS, refusal } from "./checks.mjs";
export { ASK_SCOPE, askAdmits, draftAdmits, scrubRead } from "./scope.mjs";
export { ReadLog, textOf } from "./readlog.mjs";
export { checkAnswer, shapeRefusal, figuresIn, ANSWER_FIELDS, SENTENCE_KINDS, RULE_LABELS, ANSWER_LABEL, LEVELS,
         ABSENCE_TERMS } from "./check.mjs";
export { checkSentences, verdictIn, VERDICT_WORDS, CAUSE_MARKERS, BASIS_KINDS, LOOKED_STATES } from "./sentences.mjs";
export { BUILT_IN_SERVICES, RULE_SERVICE_NAMES } from "./rules.mjs";
export { CADENCES, STANDING_TICK_MAX, STANDING_ANSWERS_MAX, STANDING_LABEL, STANDING_AI_SETTING, STANDING_USE, STANDING_FIND_MAX,
         STANDING_FIND_KEYS_MAX, STANDING_FIND_CAPTURES_MAX, STANDING_FIND_LABEL, FIND_ORIGIN, nextDueDay, memberOf, ownerOf }
  from "./standing.mjs";
export { ANSWERS_SCHEMA, ANSWERS_TABLES } from "./schema.mjs";

/** J1 (2), K1505 (14): the copy's switch for the rule services (off until M-Q9's bar is met). */
export const RULE_SERVICES_SETTING = "answers_rule_services";
/** R13: the modes a tally is kept per. */
export const ASK_MODES = Object.freeze(["ask", "standing"]);
/** R30 (K2508): the kinds `askAccount` judges an account for: an ask, and a draft (store-door R10, plane R33). */
export const ASK_ACCOUNT_KINDS = Object.freeze(["ask", "draft"]);
/** R30: the uses a grant reads under (ai-accounts' `USE_KINDS`, its R14, that mint an ask's or a standing question's
 *  grant). */
export const GRANT_USES = Object.freeze(["ask", "draft", "standing"]);
/** R35 (K3089): the uses `ruleAnswer` and `op=rule` open a grant's read log with. */
export const RULE_USES = Object.freeze(["ask", "draft"]);
/** The most read logs held at once (each lives at most a grant's life). */
const LOGS_MAX = 512;

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";

export class Answers {
  constructor({ storage, record, membership, ...deps }) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.deps = deps;
    this.resolved = new Map();
    this.logs = new Map();
    this.services = new Map();
    this.answerer = null;
    this.setListeners = [];
    migrateAnswers(this.sql);
  }

  rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  one(q, ...a) { const r = this.rows(q, ...a); return r.length ? r[0] : null; }

  /** A dependency named in `deps`: an object, or a function answering one, read once. */
  dep(name) {
    if (name === "query") return this.deps.query ?? { savedForm };
    if (name === "useCheck") return this.deps.useCheck ?? null;
    if (this.resolved.has(name)) return this.resolved.get(name);
    const d = this.deps[name];
    let v = null;
    try { v = typeof d === "function" ? d() : d ?? null; } catch { v = null; }
    if (v) this.resolved.set(name, v);
    return v;
  }

  now() {
    const n = this.deps.now;
    const v = typeof n === "function" ? n() : n;
    return typeof v === "string" ? v : new Date().toISOString();
  }

  /** The active profiles' combined view (`record-core` R26), or null. */
  view() {
    const list = this.record.getSetting("jurisdiction_profiles");
    const comb = this.deps.combine || combineProfiles;
    const r = comb(Array.isArray(list) ? list : []);
    return r && r.ok ? r.view : null;
  }
  /** The governing time zone, as retrieval answers it (its R69: local-facts' governing value first, then the active
   *  profiles'), so a question is set, checked, counted and run on the day boundary its saved query compiles on (N584).
   *  Without retrieval's, `deps.zone`, else the active profiles' `time_zone` (`jurisdictions` R41); or null. */
  zone() {
    const own = (z) => (filled(z) ? z : null);
    const r = this.dep("retrieval");
    if (r && typeof r.zone === "function") { try { return own(r.zone()); } catch { return null; } }
    if (typeof this.deps.zone === "function") { try { return own(this.deps.zone()); } catch { return null; } }
    const v = this.view();
    return v && v.time_zone ? own(v.time_zone.value) : null;
  }
  /** R15 (N584): the relations retrieval compiles a run with (its R72), so the saved-form check refuses no field a run
   *  reads; without retrieval's, `deps.relations`; or null. */
  relations() {
    const r = this.dep("retrieval");
    const fn = r && typeof r.relations === "function" ? () => r.relations() : this.deps.relations;
    try { return typeof fn === "function" ? fn() ?? null : fn ?? null; } catch { return null; }
  }
  dayStart(day, zone) { try { const r = dayRange(day, day, zone); return r && r.start ? r.start : null; } catch { return null; } }

  /* ===================================================================== *
   * THE READ LOG (R1, R2; J1 (4))
   * ===================================================================== */

  #key(grant) { return filled(grant) ? sha256HexSync(grant) : null; }
  #sweepLogs(nowMs) {
    for (const [k, l] of this.logs) if (l.expires !== null && l.expires <= nowMs) this.logs.delete(k);
    while (this.logs.size > LOGS_MAX) this.logs.delete(this.logs.keys().next().value);
  }
  holdLog(log) { log.expires = null; this.logs.set(this.#key(log.grant), log); }
  dropLog(grant) { const k = this.#key(grant); if (k) this.logs.delete(k); }

  /** The read log of a grant (an empty one when it has read nothing). */
  readLog(grant) {
    this.#sweepLogs(Date.parse(this.now()));
    const k = this.#key(grant);
    return (k && this.logs.get(k)) || new ReadLog({ grant: grant ?? null });
  }

  #logFor(grant, viewer, use = "ask") {
    const k = this.#key(grant);
    if (!k || !filled(viewer)) return null;
    const nowMs = Date.parse(this.now());
    this.#sweepLogs(nowMs);
    let l = this.logs.get(k);
    if (!l) {
      l = new ReadLog({ grant, viewer, at: this.now(), use: GRANT_USES.includes(use) ? use : "ask" });
      l.expires = nowMs + AI_GRANT_TTL_SECONDS * 1000;
      this.logs.set(k, l);
    }
    return l.viewer === viewer ? l : null;
  }

  /** R2, R30: whether an id names a held bundle the viewer may not see, or one of a project that keeps its material
   *  away from AI for `use` (`ai-accounts.projectsKeptAway`, its R22: the project's own bundle or one it holds). When
   *  the limits cannot be read (the read throws, answers no list, or ai-accounts cannot be reached), every project's
   *  bundle is dropped (fail closed). */
  hidden(viewer, use = "ask") {
    const accounts = this.dep("accounts");
    let away = null;
    try { away = accounts && typeof accounts.projectsKeptAway === "function" ? accounts.projectsKeptAway({ use }) : null; }
    catch { away = null; }
    const kept = Array.isArray(away) ? new Set(away) : null;
    return (id) => {
      const info = typeof this.record.bundleInfo === "function" ? this.record.bundleInfo(id) : null;
      if (!info) return false;
      if (!this.membership.inSight(id, viewer)) return true;
      const project = info.type === "project" ? info.id : info.project;
      if (!project) return false;
      return kept === null || kept.has(project);
    };
  }

  /** R1, R2, R30: a read served under a grant: refused outside ASK_SCOPE; otherwise its answer scrubbed of ties, source
   *  links, hidden rows and the rows of projects kept away from AI for the grant's use (`ask` unless named: `draft`,
   *  or `standing` for R19's run, fixed when the grant's log opens), recorded in the grant's read log, and answered as
   *  recorded. Writes no row (R14). */
  logRead({ grant = null, op = null, args = null, answer = null, viewer = null, use = "ask" } = {}) {
    if (!askAdmits(op)) return { ok: false, reason: "GRANT_OP_REFUSED", code: "GRANT_OP_REFUSED", op: op ?? null,
                                 detail: "an ask reads only the asking scope's reads" };
    const log = this.#logFor(grant, viewer, use);
    if (!log) return { ok: false, reason: "GRANT_OP_REFUSED", code: "GRANT_OP_REFUSED", op,
                       detail: "a read under a grant names the grant and its member" };
    const clean = scrubRead(answer, this.hidden(viewer, log.use));
    log.add(op, args, clean, this.now());
    return clean;
  }

  /* ===================================================================== *
   * THE RULE SERVICES (R7–R12)
   * ===================================================================== */

  /** R12: a later module's rule service, once per name, at start. */
  registerRuleService(name, fn) {
    const bad = listenerRefusal(null, filled(name) ? name : "", fn);
    if (bad && bad.reason === "LISTENER_MALFORMED") return bad;
    if (name in BUILT_IN_SERVICES || this.services.has(name))
      return refusal("RULE_SERVICE_EXISTS", `a rule service named ${name} is already held; the first stays`, { service: name });
    this.services.set(name, fn);
    return { ok: true, service: name };
  }

  /** J1 (2): the administrator's switch for the rule services. */
  ruleServicesSwitch({ on = null, by = null } = {}) {
    const m = S.memberOf(by);
    if (!m || !this.membership.isAdministrator(m)) return notAnAdmin(by ?? null, "switching the rule services");
    this.record.setSetting(RULE_SERVICES_SETTING, on === true, by);
    return { ok: true, on: on === true };
  }

  /** R7 (K5131): whether the rule services are on, for any signed-in member (the control plane's class gate admits the
   *  caller), so a screen draws their control only while on. A read: writes nothing; the services stay off until the
   *  administrator's switch (K1505 (14)). */
  ruleServicesState() {
    return { ok: true, on: this.record.getSetting(RULE_SERVICES_SETTING) === true };
  }

  /** R7: one rule service's answer, as of `at` (now when absent), recorded in the read log of the grant it was asked
   *  under. Non-mutating; never throws. (R35; K3089) `use` (`ask` or `draft`; absent or any other: `ask`) opens the
   *  grant's read log with it when this is the grant's first read, so a draft grant first read by `op=rule` is scrubbed
   *  as a draft (R30); a log already open keeps the use it opened with. */
  async ruleAnswer({ service = null, args = null, viewer = null, at = null, grant = null, use = "ask" } = {}) {
    if (this.record.getSetting(RULE_SERVICES_SETTING) !== true)
      return refusal("RULE_SERVICES_OFF", localize("answers.index.the_rule_services_are_switched", "the rule services are switched off in your team's Civicsmith"));
    const fn = BUILT_IN_SERVICES[service] || this.services.get(service);
    if (typeof fn !== "function" || !Object.hasOwn(BUILT_IN_SERVICES, service) && !this.services.has(service))
      return refusal("RULE_SERVICE_UNKNOWN", `no rule service is named ${service}`, { service: service ?? null });
    const asOf = filled(at) ? at : this.now();
    const ctx = { viewer, at: asOf, dep: (n) => this.dep(n), view: () => this.view() };
    let r;
    try { r = await fn(plain(args) ? args : {}, ctx); }
    catch (e) { r = notHeld("meaning", `the service failed: ${String(e && e.message || e).slice(0, 200)}`); }
    if (!plain(r)) r = notHeld("meaning", "the service gave no answer");
    const answer = r.not_held ? { ok: true, service, not_held: r.not_held }
      : { ok: true, service, value: r.value ?? null, basis: r.basis ?? null, grade: r.grade ?? null, status: r.status ?? null,
          label: r.label ?? null, as_of: asOf,
          ...(r.quote_only !== undefined ? { quote_only: r.quote_only } : {}), ...(r.limits ? { limits: r.limits } : {}) };
    const log = grant ? this.#logFor(grant, viewer, RULE_USES.includes(use) ? use : "ask") : null;
    if (log) return log.addRule(scrubRead(answer, this.hidden(viewer, log.use)), asOf);
    return answer;
  }

  /* ===================================================================== *
   * AN ASK'S ACCOUNT (R30; D38, B3)
   * ===================================================================== */

  /** R30: the account that serves a member's ask (or, K2508, a draft: `kind` `draft`), `ai-accounts.accountFor` asked
   *  with that kind (`ask` when absent) and the ask's `project` (one the member has joined: ai-accounts R11 refuses any
   *  other, `PROJECT_ACT_NOT_A_PARTICIPANT`, or as absent), then judged by `ai-use.useCheck` for the account chosen, in place of the ceiling. Answers
   *  `{ok: true, account, owner}` (`owner` the paying account, as `ai-use` R1 spells it) or the refusal unchanged
   *  (`AI_KEPT_AWAY`, `PROJECT_AI_KEPT_AWAY`, `AI_USE_SWITCHED_OFF`, `NO_ACCOUNT`, `AI_LIMIT_REACHED`, ...). A limit that
   *  cannot be judged, or an account that cannot be read, refuses with no row (`LIMITS_UNREADABLE`,
   *  `ACCOUNT_UNREADABLE`: the deployment's fault, fail closed). Writes nothing; never throws. */
  async askAccount({ member = null, project = null, at = null, kind = null } = {}) {
    /* (K2508) `kind`: `ask` when absent, or `draft` for a draft; any other is refused as ai-accounts R3 refuses an act
       not the member's own (`NOT_YOUR_ACCOUNT`, its row, ai-accounts R33), before any account is read */
    const use = kind === null || kind === undefined ? "ask" : kind;
    if (!ASK_ACCOUNT_KINDS.includes(use)) {
      const r = AI_ACCOUNT_CHECKS.NOT_YOUR_ACCOUNT;
      return { ok: false, reason: "NOT_YOUR_ACCOUNT", code: "NOT_YOUR_ACCOUNT", check: r.check, translation: r.translation,
               detail: `an ask's account is read for an ask or a draft only, not for '${String(use).slice(0, 40)}'. Nothing was used.` };
    }
    const accounts = this.dep("accounts");
    const act = { kind: use, member, ...(project !== null && project !== undefined ? { project } : {}) };
    let account = null;
    try { account = accounts && typeof accounts.accountFor === "function" ? await accounts.accountFor({ member, act }) : null; }
    catch { account = null; }
    if (!account || account.ok !== true)
      return account && account.ok === false ? account
        : { ok: false, reason: "ACCOUNT_UNREADABLE", detail: "the account that would serve this ask could not be read; nothing was used" };
    const owner = S.ownerOf(account, member);
    const check = this.dep("useCheck");
    let limit;
    try { limit = typeof check === "function" ? await check({ owner, member: S.memberOf(member) ?? member, use,
                                                                at: filled(at) ? at : this.now() }) : undefined; }
    catch { limit = undefined; }
    if (limit === undefined) return { ok: false, reason: "LIMITS_UNREADABLE",
                                      detail: "the limits of the account that would pay for this ask could not be read; nothing was used" };
    if (limit && limit.ok === false) return limit;
    return { ok: true, account, owner };
  }

  /* ===================================================================== *
   * THE CHECK AND THE TALLIES (R4, R13, R14)
   * ===================================================================== */

  /** R4 over the grant's own read log, counted (R13). */
  check({ answer = null, grant = null, viewer = null, mode = "ask" } = {}) {
    const log = this.readLog(grant);
    const r = checkAnswer(answer, { readLog: log.viewer === viewer ? log : null, viewer });
    this.countAsk({ outcome: r.ok ? "answered" : "refused", codes: r.ok ? r.withheld.map((w) => w.code) : [r.code],
                    mode, at: this.now() });
    return r;
  }

  /** R13: adds to the counts per local day of the group's jurisdiction and per mode. Carries no member, viewer,
   *  question, address or answer text. */
  countAsk({ outcome = null, codes = [], mode = "ask", at = null } = {}) {
    if (!["answered", "refused"].includes(outcome) || !ASK_MODES.includes(mode)) return { ok: false, reason: "BAD_TALLY",
      detail: `outcome is answered or refused; mode is one of ${ASK_MODES.join(", ")}` };
    const when = filled(at) ? at : this.now();
    const zone = this.zone();
    const d = localDay(when.replace(/\.\d+Z$/, "Z"), zone || "UTC");
    const day = typeof d === "string" ? d : when.slice(0, 10);
    const list = (Array.isArray(codes) ? codes : []).filter(filled).map((c) => c.slice(0, 64));
    const add = (kind, code) => this.sql.exec(`INSERT INTO answers_tallies (day, zone, mode, kind, code, n) VALUES (?,?,?,?,?,1)
      ON CONFLICT(day, mode, kind, code) DO UPDATE SET n = n + 1`, day, zone, mode, kind, code);
    this.record.transact(() => {
      if (outcome === "answered") { add("answered", ""); for (const c of list) add("withheld", c); }
      else for (const c of list.length ? list : ["UNNAMED"]) add("refused", c);
      return { ok: true };
    });
    return { ok: true, day, mode };
  }

  /** R13: the counts, to an administrator only. */
  tallies({ viewer = null, from = null, to = null } = {}) {
    const m = S.memberOf(viewer);
    if (!m || !this.membership.isAdministrator(m)) return notAnAdmin(viewer ?? null, "reading the assistant's tallies");
    const lo = filled(from) ? from : "0000-00-00", hi = filled(to) ? to : "9999-99-99";
    const rows = this.rows(`SELECT day, zone, mode, kind, code, n FROM answers_tallies WHERE day >= ? AND day <= ?
                            ORDER BY day, mode, kind, code`, lo, hi);
    return { ok: true, from: from ?? null, to: to ?? null, tallies: rows };
  }

  /* ===================================================================== *
   * STANDING QUESTIONS (R15–R21)
   * ===================================================================== */

  /** R19 (J1 (5)): the administrator's switch for the AI half of standing questions (off by default). */
  standingAiSwitch({ on = null, by = null } = {}) {
    const m = S.memberOf(by);
    if (!m || !this.membership.isAdministrator(m)) return notAnAdmin(by ?? null, "switching the standing questions' AI half");
    this.record.setSetting(S.STANDING_AI_SETTING, on === true, by);
    return { ok: true, on: on === true };
  }

  /** R19 (J1 (5)): the one module that calls the model for a standing question's new finds (K31's pattern). */
  registerStandingAnswerer(module, fn) {
    const bad = listenerRefusal(this.answerer, module, fn);
    if (bad) return bad;
    this.answerer = { module, fn };
    return { ok: true, module };
  }

  /** R27 (N605; K1666): one listener per module, told `{question, due}` after a standing question is set or ended by
   *  its author, so `scheduler` re-arms R17's wake. Refused through `membership.listenerRefusal`. */
  onStandingSet(module, fn) {
    const bad = listenerRefusal(this.setListeners, module, fn);
    if (bad) return bad;
    this.setListeners.push({ module, fn });
    return { ok: true, module };
  }
  /** R27: each listener once, after the act's transaction: at once outside one, or just after the outermost commits
   *  when the act runs inside another module's (`following` R25), never when that rolls back (`record-core` R66). One
   *  that throws never undoes the act, nor stops the others. Writes nothing. */
  tellStanding(question, due) {
    const tell = () => { for (const l of this.setListeners) { try { l.fn({ question, due }); } catch { /* the act stands (R27) */ } } };
    if (typeof this.record.afterCommit === "function") this.record.afterCommit(tell);
    else tell();
  }

  standingQuestionSet(a) { return S.standingQuestionSet(this, a); }
  standingQuestionRead(a) { return S.standingQuestionRead(this, a); }
  standingQuestionsOf(a) { return S.standingQuestionsOf(this, a); }
  standingQuestionEnd(a) { return S.standingQuestionEnd(this, a); }
  standingQuestionEndSet(a) { return S.standingQuestionEndSet(this, a); }
  standingDue(now) { return S.standingDue(this, now ?? this.now()); }
  standingWake(now) { return S.standingWake(this, now ?? this.now()); }
  standingTick(now) { return S.standingTick(this, now ?? this.now()); }
  standingAnswersFor(a) { return S.standingAnswersFor(this, a); }
}

/* One instance per host (R23: the tables are declared once). */
const instances = new WeakMap();

/** The module's instance for a host: created on the first call with `deps`, its tables made and declared. */
export function answersOf(host, deps) {
  const storage = host && host.storage ? host.storage : host;
  let a = instances.get(storage);
  if (!a) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const useCheck = d.useCheck || ((x) => aiUseOf(host, { record, membership }).useCheck(x));
    /* T48-36: ai-accounts' one instance on this host, reached lazily (credentials' factory creates it first, with the
       seal secret, at the composition root) */
    const accounts = d.accounts || (() => aiAccountsOf(host, { record, membership }));
    a = new Answers({ ...d, storage: d.storage || storage, record, membership, useCheck, accounts });
    instances.set(storage, a);
    const declared = record.declareTable("answers", ANSWERS_TABLES);
    if (!declared || declared.ok === false) throw new Error(`answers' tables could not be declared: ${JSON.stringify(declared)}`);
  }
  return a;
}

export { answersOps } from "./ops.mjs";
