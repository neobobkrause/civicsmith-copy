/* question-explorer — the system exploring a question on its own where an account owner turned exploring on
 * (requirements: `build/requirements/question-explorer.md`, R1–R17; D33, D36, D39, D11–D14, D66; N815).
 *
 * `questionExplorerOf(host, deps)` answers the one instance per Durable Object storage (K61). What it does:
 *   - chooses (R1, R2, R9): each tick reads at most 200 open or surfaced questions, keeps those worth exploring, and
 *     asks `ai-use.exploreAllowed` for each account owner whose scope may hold the question;
 *   - opens (R3, R12): an `investigate` run with `origin: "explore"`, whose system step on the question `ai-runs` creates
 *     once the run is open (its R73, K2490),
 *     and use `explore` through `ai-runs`, the paying owner its principal and `ai-use` R6's label, its estimate kept;
 *   - holds the acts the run's work goes through (the model work itself is `agent-worker`'s, later in the order): a
 *     look aimed at a person (R9, R10), a find with its gauge (R4), a capture asked through `capture-requests` (R3), a
 *     read inside a held document (R13), and the run's end (R8, R12);
 *   - offers (R5, R7, R14): each find once to each member following the question, only while the gate is open, every
 *     find alike whatever its bearing; and the member's own doors (R6);
 *   - on a test instance (R16): the gate also opens on `ai-runs.partAdmitted`'s exception, every find then carrying the
 *     label it was gauged under.
 *
 * WHAT THIS MODULE DOES NOT DO: it writes no leg, no grade, no conclusion, no hypothesis and no score (R4, R6); it
 * computes no bearing (the run's work gauges; this module records the gauge with the gate's false-alarm rate); it
 * captures nothing itself (R3); it names no place in behaviour or outward text (R8); and it never decides the gate
 * from a group's own test investigations (R11).
 *
 * Providers built in T41 alongside it (the T41 services of `ai-runs` and
 * `capture-requests`) are taken through `deps` and read by their requirements' names; where one is
 * absent the module fails closed: the gate stays shut and nothing is explored. */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { aiAccountsOf, KEPT_AWAY_UNREADABLE } from "../ai-accounts/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { captureRequestsOf } from "../capture-requests/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { aiUseOf } from "../ai-use/index.mjs";
import { runProductionsOf } from "../run-productions/index.mjs";
import * as runRules from "../run-rules/index.mjs";
import { localDay } from "../civil-time/index.mjs";
import { parseFrontmatter, isMachineIdentity, ACCEPTANCE_FORMS, acceptanceRecord, canonicalJson, sha256HexSync }
  from "../record-grammar/index.mjs";
import { EXPLORE_CHECKS } from "./checks.mjs";
import { QUESTION_EXPLORER_TABLES, migrateQuestionExplorer } from "./schema.mjs";
import { say } from "./words.mjs";

export { EXPLORE_CHECKS, EXPLORE_CHECK_KEYS } from "./checks.mjs";
export { QUESTION_EXPLORER_SCHEMA, QUESTION_EXPLORER_TABLES, migrateQuestionExplorer } from "./schema.mjs";

export const QUESTION_EXPLORER_MODULE = "question-explorer";

/** R10: the most distinct persons one exploring run may gather about. A constant, changed only by a reviewed change. */
export const EXPLORE_PERSON_CAP = 20;
/** R2: the most questions one tick reads. */
export const EXPLORE_QUESTIONS_PER_TICK = 200;
/** R7: the most false alarms the explorer may raise on Civicsmith's test investigations for the gate to open. */
export const EXPLORE_FALSE_ALARM_MAX = 0.2;
/** R4: the three bearings a find is gauged with. Never a grade, never a score. */
export const EXPLORE_BEARINGS = Object.freeze(["supports", "cuts_against", "unclear"]);
/** R4: what a find is; `page` is an address the record does not hold, named to the members (R3). */
export const EXPLORE_FIND_KINDS = Object.freeze(["capture", "content", "connection"]);
/** R3: the run's path. */
export const EXPLORE_ORIGIN = runRules.RUN_ORIGINS.find((o) => o === "explore");
export const EXPLORE_USE = "explore";
export const EXPLORE_MODE = "investigate";
/** R7, R11: the AI part the test bar is recorded for (`ai-runs` R75). */
export const EXPLORE_TEST_PART = "explore";
/** The bounds an exploring run declares at its open (`ai-runs` R9, `run-rules` R3's list form; `pages` is R26's). */
export const EXPLORE_BOUNDS = Object.freeze([
  Object.freeze({ bound: "fetches", allowed: 20 }),
  Object.freeze({ bound: "wallclock", allowed: 3600000 }),
  Object.freeze({ bound: Object.keys(runRules.RUN_BOUNDS).find((k) => k === "pages"), allowed: 40 }),
  /* R13: what an exploring run proposes while reading is minted within this bound (`run-productions` R21, R10). */
  Object.freeze({ bound: "mints", allowed: 50 }),
]);
/** The step's words (`steps` R1's `work`, the doer's words on what the work is). */
export const EXPLORE_WORK = say("question-explorer.system_explored_question");
/** What every offered find says, whatever its bearing (R5, R14). */
export const EXPLORE_FIND_SAYS = say("question-explorer.system_found_exploring");
/** How long a pending Ask waits before a tick looks for its approval again (R1). */
export const EXPLORE_ASK_RECHECK_MS = 3600000;
/** The skill an exploring run is formed under (`run-rules` R8's `<pack>@<edition>`). */
export const EXPLORE_SKILL = "explore@1";
/** The plane principal a system run carries, a machine credential that sees every bundle (membership R43). */
export const EXPLORE_PRINCIPAL = "class:ai";

const HEX64 = /^[0-9a-f]{64}$/;
const str = (x) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);
const json = (v) => (v == null ? null : canonicalJson(v));
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const bareMember = (v) => { const m = /^member:([A-Za-z0-9._:-]{1,128})$/.exec(String(v ?? "")); return m ? m[1] : null; };

export class QuestionExplorer {
  constructor({ storage, record, membership, aiAccounts, connections, retrieval, inquiry, legEarning, basisVersions,
                steps = null, aiUse = null, aiRuns, captureRequests = null, runProductions = null,
                held = null, testSet = runRules.CIVICSMITH_TEST_SET, principal = EXPLORE_PRINCIPAL, now = null }) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.aiAccounts = aiAccounts;
    this.connections = connections;
    this.retrieval = retrieval;
    this.inquiry = inquiry;
    this.legEarning = legEarning;
    this.basisVersions = basisVersions;
    this.steps = steps;
    this.aiUse = aiUse;
    this.aiRuns = aiRuns;
    this.captureRequests = captureRequests;
    this.runProductions = runProductions;
    this.principal = principal;
    this.now = typeof now === "function" ? now : () => Date.now();
    /* R7: what the record holds for the deploy gate, `{verifications, testBars}` (the shape `run-rules`' `partDeployable`
       takes), read from `ai-runs` (its R19 `verifications()` and R75 `testBarRecords()`); absent, nothing is held and
       the gate is shut (fail closed). The set is Civicsmith's (`run-rules` R19, K2489). */
    this.held = typeof held === "function" ? held : () => ({
      verifications: aiRuns && typeof aiRuns.verifications === "function" ? aiRuns.verifications() : [],
      testBars: aiRuns && typeof aiRuns.testBarRecords === "function" ? aiRuns.testBarRecords() : [] });
    this.testSet = testSet;
  }

  #tail = Promise.resolve();

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  migrate() { migrateQuestionExplorer(this.sql); }

  /* ---------------------------------------------------------------- shared */

  #refuse(code, detail, extra) {
    const row = EXPLORE_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
  }

  #iso(at) {
    if (typeof at === "string" && at) return at.replace(/\.\d+Z$/, "Z");
    return stampInstant("second", Number.isFinite(at) ? at : this.now());
  }

  /** The group's local day for an instant (`civil-time`; the zone `retrieval` R69 answers, else UTC). */
  #day(iso) {
    let zone = "UTC";
    try {
      const z = this.retrieval && typeof this.retrieval.zone === "function" ? this.retrieval.zone() : null;
      if (typeof z === "string" && z) zone = z;
    } catch { /* UTC */ }
    const d = localDay(iso, zone);
    return typeof d === "string" ? d : localDay(iso, "UTC");
  }

  #question(id) {
    const b = this.#one(`SELECT bundle_id, object_type, current_state FROM bundles WHERE bundle_id=?`, id);
    if (!b || b.object_type !== "inquiry") return null;
    const f = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
    const fm = f && f.content ? (parseFrontmatter(f.content).data || {}) : {};
    let subject = null;
    try { subject = this.inquiry.subjectEntityOf(id) ?? null; } catch { subject = null; }
    if (!subject && typeof fm.subject_entity === "string") subject = fm.subject_entity;
    return { id, state: b.current_state, subject, surfacedBy: fm.surfaced_by ?? null };
  }

  /** `entities` R35's read contract: an entity's kind, or null when the registry cannot say. */
  #kindOf(entity) {
    try { return this.#one(`SELECT kind FROM entities WHERE entity_id=?`, entity)?.kind ?? null; } catch { return null; }
  }

  /** R9: the persons members tied to a question: its subject entity when a member raised the question
   *  (`surfaced_by: human`), and the persons resolved in a document a member connected to the question by her own
   *  assertion (`connections` R53, R54; `entities` R35's `resolutions`). */
  #tiedPersons(q) {
    const tied = new Set();
    if (q.subject && q.surfacedBy === "human") tied.add(q.subject);
    let rows = [];
    try {
      const a = this.connections.asserted({ bundleId: q.id, viewer: this.principal, limit: 200 });
      rows = a && Array.isArray(a.member) ? a.member : [];
    } catch { rows = []; }
    for (const r of rows) {
      if (!r || r.asserted_by !== "member" || isMachineIdentity(String(r.author ?? ""))) continue;
      const other = r.a_bundle_id === q.id ? r.b_bundle_id : r.a_bundle_id;
      try {
        for (const x of this.#rows(`SELECT DISTINCT entity_id FROM resolutions WHERE bundle_id=?`, other))
          if (this.#kindOf(x.entity_id) === "person") tied.add(x.entity_id);
      } catch { /* none read */ }
    }
    return tied;
  }

  /** R2: the distinct captures resolving to an entity (`entities` R35's `resolutions`). */
  #resolved(entity) {
    if (!entity) return 0;
    try {
      return Number(this.#one(`SELECT COUNT(DISTINCT capture_sha) AS n FROM resolutions WHERE entity_id=?`, entity)?.n ?? 0);
    } catch { return 0; }
  }

  /** `steps` R17's recipients of a question, as bare member ids, every page read (at most 1,000). */
  #recipients(question) {
    if (!this.steps || typeof this.steps.findRecipients !== "function") return [];
    const out = new Set();
    let after = null;
    for (let i = 0; i < 10; i++) {
      let r;
      try { r = this.steps.findRecipients({ question, after, limit: 100 }); } catch { break; }
      const list = Array.isArray(r) ? r : (r && (r.recipients || r.members)) || [];
      for (const m of list) {
        const raw = typeof m === "string" ? m : m && typeof m.member === "string" ? m.member : "";
        const id = bareMember(raw.startsWith("member:") ? raw : `member:${raw}`);
        if (id) out.add(id);
      }
      const next = r && !Array.isArray(r) ? r.next : null;
      after = next && typeof next === "object" ? (next.after ?? null) : (typeof next === "string" ? next : null);
      if (!after) break;
    }
    return [...out].sort();
  }

  /** The projects drawing on a question (`leg-earning` R13, every page; at most 2,000). In-process only. */
  #drawing(question) {
    const out = [];
    try {
      let after = null;
      for (let i = 0; i < 4; i++) {
        const r = this.legEarning.projectsDrawingOnPaged({ id: question, after, limit: 500 });
        if (!r || r.ok === false) break;
        out.push(...r.projects);
        after = r.cursor;
        if (!after) break;
      }
    } catch { /* none read */ }
    return out;
  }

  /** R3: whether a bundle is within the paying owner's sight: a member's account, that member's; a project's, its
   *  participants'; the group's, what every member may see (a bundle outside every project). */
  #ownerSees(owner, bundleId) {
    if (!bundleId) return false;
    if (owner === "group") {
      const b = this.#one(`SELECT object_type, project FROM bundles WHERE bundle_id=?`, bundleId);
      return !!b && b.object_type !== "project" && !String(b.project ?? "");
    }
    if (owner.startsWith("member:")) return this.membership.inSight(bundleId, owner);
    if (owner.startsWith("project:")) {
      const ps = this.membership.joinedParticipants(owner.slice(8));
      return ps.some((p) => this.membership.inSight(bundleId, `member:${p.member}`));
    }
    return false;
  }

  /** Whether a viewer owns the paying account (`ai-use`'s owners): the member herself, a project's owner, or an
   *  active administrator for the group's. Only they hear which account paid (D64) and what it cost (R12). */
  #ownsAccount(viewer, owner) {
    const m = bareMember(viewer);
    if (!m || !owner) return false;
    if (owner === `member:${m}`) return true;
    if (owner.startsWith("project:")) return this.membership.isProjectOwner(owner.slice(8), m);
    if (owner === "group") { try { return this.membership.isAdministrator(m) === true; } catch { return false; } }
    return false;
  }

  /** The run this module opened, held by `caller`, still running; or the refusal. */
  #liveRun(run, caller) {
    const r = typeof run === "string" ? this.#one(`SELECT * FROM explore_runs WHERE run=?`, run.trim()) : null;
    const gate = r ? runRules.runPrincipalGate({ caller, principal: this.principal, act: "exploring a question" }) : null;
    if (!r || gate)
      return { refusal: this.#refuse("EXPLORE_NO_RUN", "an exploring run this module opened, held by the caller",
                                     { run: run ?? null }) };
    if (r.ended)
      return { refusal: this.#refuse("EXPLORE_RUN_ENDED", `the run ended ${r.ended}`, { run: r.run, ended: r.ended }) };
    return { run: r };
  }

  /* ---------------------------------------------------------------- R7: the gate */

  /** R7, R16: whether an AI part is admitted, `{admitted, untested}`: `ai-runs.partAdmitted` (its R78, the one gate,
   *  `run-rules` R29 on what the record holds, with the deployment's test-instance fact); where that provider is not
   *  in place, R19's gate alone, `run-rules.partDeployableOn`, with no exception. Anything unreadable is not admitted. */
  #admitted(part, held, entry = null) {
    if (this.aiRuns && typeof this.aiRuns.partAdmitted === "function") {
      /* ai-runs R75, R78 (PR 391): Gate 1's verdict is per (entry, part), so the part is asked on the paying account's
         entry (F1) when one is known; with none, as before (only the test-instance exception can admit). */
      const a = typeof entry === "string" && entry ? this.aiRuns.partAdmitted(part, entry) : this.aiRuns.partAdmitted(part);
      const label = a && a.untested && typeof a.untested === "object" ? a.untested : null;
      return { admitted: !!a && a.admitted === true, untested: a && a.admitted === true ? label : null };
    }
    return { admitted: runRules.partDeployableOn(this.testSet, part, held) === true, untested: null };
  }

  /** R7: the gauge's gate. Open only when Civicsmith's test bar for the explorer is recorded passed with a false-alarm
   *  rate at most 20%, and `run-rules` R19 lets `investigate` deploy and the explorer's use. R16: also open, on the
   *  test-instance exception, when `ai-runs.partAdmitted` admits both `investigate` and `explore` and the explorer's
   *  own bar is not held: then `false_alarm_rate` and `gold_set` are null and `untested` is `explore`'s label. Whenever
   *  the explorer's bar is held, R7's rate applies and no label is carried. The exception lifts only the bar: the
   *  verification chain stands (it is `partAdmitted`'s), and nothing here counts toward any bar. A group's own test
   *  investigations are never read here (R11). F1 (ai-runs R75, R78, PR 391): judged on `entry`, the catalogue entry the
   *  paying account serves the run on, Gate 1's verdict being per (entry, part); with none, no entry is named. Never
   *  throws; anything unreadable shuts it. */
  gate({ entry = null } = {}) {
    const shut = (why) => ({ open: false, why, false_alarm_rate: null, gold_set: null, untested: null });
    try {
      if (!this.steps || !this.aiUse) return shut(say("question-explorer.provider_explorer_needs"));
      const held = this.held() || {};
      const inv = this.#admitted(EXPLORE_MODE, held, entry), use = this.#admitted(EXPLORE_TEST_PART, held, entry);
      if (!inv.admitted || !use.admitted)
        return shut(say("question-explorer.investigate_mode_explorer"));
      if (use.untested) return { open: true, why: null, false_alarm_rate: null, gold_set: null, untested: use.untested };
      /* The record that holds the explorer's bar on the set's current version (`run-rules`' `checkTestBarRecord`). */
      const tb = (Array.isArray(held.testBars) ? held.testBars : []).find((r) => runRules.checkTestBarRecord(r) === null
        && r.part === EXPLORE_TEST_PART && r.passed === true && r.set === this.testSet.id
        && r.set_version === this.testSet.version);
      const far = tb ? tb.false_alarm_rate : NaN;
      if (!(far >= 0 && far <= EXPLORE_FALSE_ALARM_MAX))
        return shut(say("question-explorer.explorer_false_alarm"));
      return { open: true, why: null, false_alarm_rate: far, gold_set: `${tb.set}@${tb.set_version}`, untested: null };
    } catch { return shut(say("question-explorer.gate_read")); }
  }

  /* ---------------------------------------------------------------- R1, R2: choosing */

  /** R2: the questions worth exploring today, at most `EXPLORE_QUESTIONS_PER_TICK` read, least recently explored
   *  first. In-process (for this module's tick and its tests). */
  questionsWorthExploring({ at = null } = {}) {
    const iso = this.#iso(at);
    const day = this.#day(iso);
    const cands = this.#rows(
      `SELECT b.bundle_id, (SELECT MAX(r.opened_at) FROM explore_runs r WHERE r.question = b.bundle_id) AS last
         FROM bundles b WHERE b.object_type = 'inquiry' AND b.current_state IN ('open', 'surfaced')
        ORDER BY last IS NOT NULL, last, b.bundle_id LIMIT ?`, EXPLORE_QUESTIONS_PER_TICK);
    const out = [];
    for (const c of cands) {
      const q = this.#question(c.bundle_id);
      if (!q) continue;
      /* R9 holds before R2: a question about a person no member tied to it is never chosen. */
      if (q.subject) {
        const kind = this.#kindOf(q.subject);
        if ((kind === "person" || kind === null) && !this.#tiedPersons(q).has(q.subject)) continue;
      }
      if (this.#one(`SELECT 1 AS x FROM explore_runs WHERE question=? AND day=?`, q.id, day)) continue;
      const seen = this.#resolved(q.subject);
      const last = this.#one(`SELECT seen FROM explore_runs WHERE question=? ORDER BY opened_at DESC LIMIT 1`, q.id);
      if (last && !(seen > Number(last.seen))) continue;
      const recipients = this.#recipients(q.id);
      if (!recipients.length) continue;
      out.push({ question: q.id, seen, recipients });
    }
    return out;
  }

  /** R1, R3: the owners whose scope may hold a question: the group, each project drawing on it, and each member
   *  among its recipients. `ai-use.exploreAllowed` decides each. */
  #ownersFor(w) {
    return ["group", ...this.#drawing(w.question).map((p) => `project:${p}`), ...w.recipients.map((m) => `member:${m}`)];
  }

  /** R3 (N796, K2425): a member's account served by her sign-in explores only while that account's `explore` use is
   *  on; whichever of her accounts serves, a switch at `no` is refused here as `ai-use` refuses it. Read through
   *  `ai-accounts.accountUsesOf` (its R17), the in-plane read for an account this module does not own, never
   *  `accountUses` as that member; an account that cannot be read is refused (fail closed: no switch reads as on). */
  #switchedOff(owner, u) {
    if (!owner.startsWith("member:")) return false;
    if (!u || u.unreadable === true) return true;
    return !!(u.uses && u.uses.explore === "no");
  }

  /** R1, R3 (T53): the owner's account as `ai-accounts` answers it in-plane (`accountUsesOf({owner})`: the owner's head
   *  account, `{account_id, held, uses}`), read once an owner a tick; `ai-use` R6 and R9 now decide on that `account_id`.
   *  A read that throws answers unreadable (fail closed). */
  #accountOf(owner) {
    try { return this.aiAccounts.accountUsesOf({ owner }) || { unreadable: true }; } catch { return { unreadable: true }; }
  }

  #considered(question, owner, day) {
    return this.#one(`SELECT outcome, at FROM explore_considered WHERE question=? AND owner=? AND day=?`, question, owner, day);
  }
  #consider(question, owner, day, outcome, at) {
    this.sql.exec(`INSERT INTO explore_considered (question, owner, day, outcome, at) VALUES (?,?,?,?,?)
                   ON CONFLICT(question, owner, day) DO UPDATE SET outcome=excluded.outcome, at=excluded.at`,
                  question, owner, day, outcome, at);
  }

  #due(iso) {
    const day = this.#day(iso);
    const t = Date.parse(iso);
    return this.questionsWorthExploring({ at: iso }).filter((w) => {
      const rows = this.#rows(`SELECT outcome, at FROM explore_considered WHERE question=? AND day=?`, w.question, day);
      if (!rows.length) return true;
      if (rows.some((r) => r.outcome === "opened")) return false;
      return rows.some((r) => r.outcome === "ask" && Date.parse(r.at) + EXPLORE_ASK_RECHECK_MS <= t);
    });
  }

  /** R1: for `scheduler`: how many questions a tick would consider now; none while the gate is shut. */
  async exploreDue(now) {
    try { const iso = this.#iso(now); return this.#anyOpen(iso) ? this.#due(iso).length : 0; } catch { return 0; }
  }

  /** R1: when a tick is next worth running: now while any is due; else, while an Ask waits for its approval today,
   *  the hour after it was made; else null. Answered in `now`'s own form (a number of ms, or an instant). */
  async exploreWake(now) {
    try {
      const iso = this.#iso(now);
      if (!this.#anyOpen(iso)) return null;
      const t = Date.parse(iso);
      let next = this.#due(iso).length ? t : null;
      if (next === null) {
        const asks = this.#rows(`SELECT at FROM explore_considered WHERE day=? AND outcome='ask'`, this.#day(iso));
        for (const a of asks) {
          const w = Math.max(t, Date.parse(a.at) + EXPLORE_ASK_RECHECK_MS);
          if (next === null || w < next) next = w;
        }
      }
      if (next === null) return null;
      return typeof now === "number" ? next : stampInstant("second", next);
    } catch { return null; }
  }

  /** R1: one tick. For each question due and each owner whose scope may hold it, `ai-use.exploreAllowed` decides:
   *  `null` opens one exploring run (at most one a question a day); `{ask: true}` gathers the question into that
   *  owner's Ask (`ai-use.exploreAsk`, with the questions and their estimate, R12), and nothing runs without approval;
   *  a refusal passes. Answers what it did. */
  exploreTick(now) {
    /* R17: `ai-runs` answers `open` asynchronously, so two ticks must not interleave between a question's check and its
       run's row: one tick at a time. */
    const tick = this.#tail.then(() => this.#tick(now));
    this.#tail = tick.catch(() => {});
    return tick;
  }

  async #tick(now) {
    const at = this.#iso(now);
    const out = { at, gate: "open", opened: [], asked: [], refused: 0, considered: 0, off: [] };
    const day = this.#day(at);
    const asks = new Map();
    const { accountOf, idOf, enablerOf, openFor } = this.#ownerReads();
    if (!this.gate().open && !this.#due(at).some((w) => this.#ownersFor(w).some(openFor))) return { ...out, gate: "closed" };
    for (const w of this.#due(at)) {
      out.considered += 1;
      for (const owner of this.#ownersFor(w)) {
        const prior = this.#considered(w.question, owner, day);
        if (prior && prior.outcome === "refused") continue;
        /* R7, F1: the gate judged on the entry this owner's run would be served on; shut, nothing is asked or recorded. */
        if (!openFor(owner)) continue;
        if (this.#switchedOff(owner, accountOf(owner))) { this.#consider(w.question, owner, day, "refused", at); out.refused += 1; continue; }
        /* F1: exploring off after its accountable member was refused, until a member turns it on again. */
        if (this.#offFor(owner, enablerOf(owner))) { this.#consider(w.question, owner, day, "refused", at); out.refused += 1; continue; }
        let a;
        try { a = this.aiUse.exploreAllowed({ owner, account_id: idOf(owner), question: w.question, at }); }
        catch { a = { ok: false, code: "EXPLORE_ALLOWED_UNREADABLE" }; }
        if (a && a.ask === true) {
          this.#consider(w.question, owner, day, "ask", at);
          if (!asks.has(owner)) asks.set(owner, []);
          asks.get(owner).push(w.question);
          continue;
        }
        if (a !== null && (a.ok === false || a.code || a.reason)) {
          this.#consider(w.question, owner, day, "refused", at);
          out.refused += 1;
          continue;
        }
        const label = (a && a.label) || { kind: "machine", enabled_by: owner };
        const opened = await this.#open(w, owner, label, at, day, enablerOf(owner), this.#entryFor(enablerOf(owner).member));
        if (opened.ok) { this.#consider(w.question, owner, day, "opened", at); out.opened.push(opened); break; }
        if (QuestionExplorer.#offRefusal(opened.refused)) {
          this.#turnOff(owner, idOf(owner), enablerOf(owner), opened.refused, at);
          out.off.push({ owner, code: opened.refused.code ?? null, detail: opened.refused.detail ?? null });
        }
        this.#consider(w.question, owner, day, "refused", at);
        out.refused += 1;
      }
    }
    for (const [owner, questions] of asks) {
      /* The Ask states the questions (`ai-use` R9's `what`, a list); ai-use attaches R10's rough cost to the item it
         answers its owners (`exploreAsksPending`). The estimate for the lot is kept here too. */
      const estimate = this.#estimate(owner, questions.length, at);
      let r = null;
      try { r = this.aiUse.exploreAsk({ owner, account_id: idOf(owner), at, what: questions }); } catch { r = null; }
      out.asked.push({ owner, questions, estimate, ask: r });
    }
    return out;
  }

  /** R12: `ai-use` R10's estimate for `count` exploring runs on `owner`'s account, read as its owner (the member; a
   *  project's first owner; the group's first active administrator, as ai-use reads an account itself), answered here
   *  only to that account's owners (`runCost`). `"not known yet"` when it cannot say. */
  #estimate(owner, count, at) {
    const viewer = this.#ownerViewer(owner);
    if (!viewer) return say("question-explorer.known");
    try {
      const e = this.aiUse.estimate({ owner, use: EXPLORE_USE, mode: EXPLORE_MODE, count, viewer, at });
      if (!e || e.ok === false || e.estimate === undefined || e.estimate === null) return say("question-explorer.known");
      /* (T53) ai-use R10 answers a range `{low, high, unit, basis}`; its `not_known` basis (or a range with no figure) is
         R12's "not known yet". */
      const r = e.estimate;
      if (typeof r === "object" && (r.basis === "not_known" || r.low === null || r.high === null)) return say("question-explorer.known");
      return r;
    } catch { return say("question-explorer.known"); }
  }

  /** An owner of `owner`'s account, as ai-use reads an account itself: the member; a project's first owner; the group's
   *  first active administrator. Null when there is none. */
  #ownerViewer(owner) {
    let as = null;
    try {
      as = owner.startsWith("member:") ? owner
        : owner.startsWith("project:") ? this.membership.projectOwners(owner.slice(8))[0] ?? null
          : this.membership.activeAdmins()[0] ?? null;
    } catch { as = null; }
    if (!as) return null;
    return as.startsWith("member:") || as === "admin" ? as : `member:${as}`;
  }

  /* ---------------------------------------------------------------- F1: the member accountable for exploring */

  /** F1 (K5821, REC-11): the member who turned exploring on for `owner`'s account `account_id`: the latest change of its
   *  `explore` switch to `yes` or `ask` (ai-accounts R14, R16), read through ai-accounts' `accountHistory` as one of the
   *  account's owners. `{member, key}`: `member` that member (`member:<id>`), or null when none is found or the history
   *  cannot be read (fail closed: a run with no enabling member is refused); `key` names that turning-on, so a later one,
   *  by any member, is told apart. */
  /** One tick's reads of each owner, each made once: its account id, the member who turned exploring on (F1), and
   *  whether the gate is open on the entry that member's run would be served on (R7, F1). */
  #ownerReads() {
    const accounts = new Map(), enablers = new Map(), opens = new Map();
    const accountOf = (owner) => { if (!accounts.has(owner)) accounts.set(owner, this.#accountOf(owner)); return accounts.get(owner); };
    const idOf = (owner) => { const u = accountOf(owner); return u && typeof u.account_id === "string" && u.account_id ? u.account_id : null; };
    const enablerOf = (owner) => { if (!enablers.has(owner)) enablers.set(owner, this.#enablerOf(owner, idOf(owner))); return enablers.get(owner); };
    const openFor = (owner) => {
      if (!opens.has(owner)) opens.set(owner, this.gate({ entry: this.#entryFor(enablerOf(owner).member) }).open === true);
      return opens.get(owner);
    };
    return { accountOf, idOf, enablerOf, openFor };
  }

  /** R7, F1: whether the gate is open for any run a tick at `iso` could open: with no entry named (the test-instance
   *  exception), or on the entry some due question's owner would be served on. */
  #anyOpen(iso) {
    if (this.gate().open) return true;
    const { openFor } = this.#ownerReads();
    return this.#due(iso).some((w) => this.#ownersFor(w).some(openFor));
  }

  /** F1 (ai-runs R75, R78, PR 391): the catalogue entry the member who turned exploring on would have a run served on,
   *  as `ai-runs.open` chooses it (`ai-accounts` R11's choice for her act of kind `run`, read in-plane without
   *  unsealing, its R25 `accountServing`); null when none serves or it cannot be read. */
  #entryFor(member) {
    if (!member || !this.aiAccounts || typeof this.aiAccounts.accountServing !== "function") return null;
    try {
      const s = this.aiAccounts.accountServing({ member, use: "run", project: null });
      return s && !s.refusal && typeof s.entry_id === "string" && s.entry_id ? s.entry_id : null;
    } catch { return null; }
  }

  #enablerOf(owner, account_id) {
    const viewer = this.#ownerViewer(owner);
    if (!viewer || !account_id) return { member: null, key: null };
    let h = null;
    try { h = this.aiAccounts.accountHistory({ owner, viewer, limit: 500 }); } catch { h = null; }
    const ons = (h && Array.isArray(h.changes) ? h.changes : []).filter((c) => c && c.change === "use_set"
      && c.switch === "explore" && c.account_id === account_id && (c.value === "yes" || c.value === "ask"));
    const last = ons[ons.length - 1];
    const by = last ? str(last.by) : null;
    if (!by) return { member: null, key: ons.length ? `${ons.length}|${last.at ?? ""}|` : null };
    const member = by.startsWith("member:") ? by : `member:${by}`;
    return { member, key: `${ons.length}|${last.at ?? ""}|${member}` };
  }

  /** F1: whether exploring is off for `owner` after a refused run: the row, or null. It stays off until a member turns
   *  exploring on again (a turning-on other than the one the refused run carried), and is then lifted. */
  #offFor(owner, enabler) {
    const off = this.#one(`SELECT * FROM explore_off WHERE owner=?`, owner);
    if (!off) return null;
    if (enabler && enabler.key && enabler.key !== off.enabled_key) {
      this.sql.exec(`DELETE FROM explore_off WHERE owner=?`, owner);
      return null;
    }
    return off;
  }

  /** F1: exploring turned off for `owner` by a refusal of its accountable member, the refusal kept as given so its
   *  sentence reaches the account's owners (`exploringOff`). */
  #turnOff(owner, account_id, enabler, refusal, at) {
    const r = refusal && typeof refusal === "object" ? refusal : {};
    this.sql.exec(`INSERT INTO explore_off (owner, project, account_id, enabled_by, enabled_key, code, check_id, translation, detail, at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(owner) DO UPDATE SET account_id=excluded.account_id, enabled_by=excluded.enabled_by,
                     enabled_key=excluded.enabled_key, code=excluded.code, check_id=excluded.check_id,
                     translation=excluded.translation, detail=excluded.detail, at=excluded.at`,
                  owner, owner.startsWith("project:") ? owner.slice(8) : null, account_id ?? null, enabler?.member ?? null,
                  enabler?.key ?? null, str(r.code) ?? "AI_RUN_NOT_A_MEMBER_ACT", str(r.check), str(r.translation), str(r.detail), at);
  }

  /** F1: whether an open's refusal says its accountable member is gone or no longer allowed (`run-rules` R18 as F1 amends
   *  it: `exploring: "off"`; an exploring run has no other member's act, so its `AI_RUN_NOT_A_MEMBER_ACT` is that). */
  static #offRefusal(r) {
    return !!r && typeof r === "object" && (r.exploring === "off" || r.code === "AI_RUN_NOT_A_MEMBER_ACT");
  }

  /** F1: where exploring is off after a refused run, to the owners of the account only: the refusal's own words
   *  (`run-rules`' sentence and translation, as given), when, and who had turned it on. It stays until a member turns
   *  exploring on again. Never throws. */
  exploringOff({ viewer = null } = {}) {
    try {
      const rows = this.#rows(`SELECT * FROM explore_off ORDER BY at DESC, owner LIMIT 1000`);
      return { ok: true, off: rows.filter((x) => this.#ownsAccount(viewer, x.owner)).map((x) => ({
        key: `explore-off:${x.owner}:${x.at}`, owner: x.owner, enabled_by: x.enabled_by, code: x.code, check: x.check_id,
        translation: x.translation, detail: x.detail, at: x.at, exploring: "off" })) };
    } catch { return { ok: true, off: [] }; }
  }

  /** R3, R12: open one exploring run on a question for an owner: its estimate, then the run, passing the step's place
   *  and work; `ai-runs` opens the run and then creates its system step (its R73, K2490), answering it. */
  async #open(w, owner, label, at, day, enabler = { member: null }, entry = null) {
    /* F1 (K5821): the run is accountable to the member who turned exploring on; with none found, `run-rules` R18 refuses
       it here, its one site, and nothing is asked of `ai-runs`. */
    if (!enabler.member) {
      const refused = runRules.startAllowed({ startedBy: null, mode: EXPLORE_MODE, origin: EXPLORE_ORIGIN, enabledBy: null });
      return { ok: false, question: w.question, owner, refused };
    }
    const estimate = this.#estimate(owner, 1, at);
    const run = `XPL-${day}-${sha256HexSync(`${w.question}|${owner}|${at}`).slice(0, 12)}`;
    /* R17: `ai-runs.open` answers asynchronously and is awaited; a run it refuses, or that it fails to open, is no run. */
    let opened;
    try {
      opened = await this.aiRuns.open({ run, contextType: "inquiry", contextId: w.question,
                                        label: say("question-explorer.label.exploring_question"),
                                        mode: EXPLORE_MODE, origin: EXPLORE_ORIGIN, use: EXPLORE_USE,
                                        place: { questions: [w.question] }, work: EXPLORE_WORK,
                                        principalPlane: this.principal, principalAi: owner, principalAiRef: null,
                                        enabledBy: enabler.member, skillVersion: EXPLORE_SKILL, bounds: EXPLORE_BOUNDS.map((b) => ({ ...b })),
                                        at, actor: null, viewer: this.principal });
    } catch { opened = null; }
    if (!opened || opened.ok === false || typeof opened.step !== "string" || !opened.step)
      return { ok: false, question: w.question, owner, refused: opened };
    const step = opened.step;
    /* F1: the entry the gate was judged on is kept with the run, so its finds are offered on that entry's admission. */
    this.sql.exec(`INSERT INTO explore_runs (run, question, owner, step, day, seen, estimate, opened_at, entry)
                   VALUES (?,?,?,?,?,?,?,?,?)`, run, w.question, owner, step, day, w.seen, json({ estimate }), at, entry);
    return { ok: true, run, question: w.question, owner, step, estimate, label, enabled_by: enabler.member };
  }

  /* ---------------------------------------------------------------- R9, R10: persons */

  /** R9, R10: a look the run's work is about to make. A look aimed at an entity of kind person (or one the registry
   *  cannot place, read as a person, fail closed) is made only when a member tied that person to the question; any
   *  other is refused `EXPLORE_PERSON_NOT_TIED`, recorded on the run, and the run goes on. A tied person past the
   *  run's 20th is refused `EXPLORE_PERSON_CAP_REACHED` and the run ends its step set aside (R8). */
  async look({ run, entity = null, aim = null, caller = null, at = null } = {}) {
    const live = this.#liveRun(run, caller);
    if (live.refusal) return live.refusal;
    const r = live.run;
    const iso = this.#iso(at);
    const e = str(entity);
    if (!e) return { ok: true, run: r.run, person: false };
    const kind = this.#kindOf(e);
    if (kind !== null && kind !== "person") return { ok: true, run: r.run, person: false };
    const q = this.#question(r.question);
    const aimText = str(aim) ? str(aim).slice(0, 200) : null;
    if (!q || !this.#tiedPersons(q).has(e)) {
      this.sql.exec(`INSERT INTO explore_refusals (run, question, code, entity, aim, at) VALUES (?,?,?,?,?,?)`,
                    r.run, r.question, "EXPLORE_PERSON_NOT_TIED", e, aimText, iso);
      return { ...this.#refuse("EXPLORE_PERSON_NOT_TIED", "no member tied this person to the question", { run: r.run, entity: e }),
               goes_on: true };
    }
    if (this.#one(`SELECT 1 AS x FROM explore_persons WHERE run=? AND entity=?`, r.run, e))
      return { ok: true, run: r.run, person: true, persons: this.#personCount(r.run) };
    if (this.#personCount(r.run) >= EXPLORE_PERSON_CAP) {
      this.sql.exec(`INSERT INTO explore_refusals (run, question, code, entity, aim, at) VALUES (?,?,?,?,?,?)`,
                    r.run, r.question, "EXPLORE_PERSON_CAP_REACHED", e, aimText, iso);
      const ended = await this.#end(r, "set_aside", "EXPLORE_PERSON_CAP_REACHED", null, null, iso, caller);
      return { ...this.#refuse("EXPLORE_PERSON_CAP_REACHED", `the run gathered about ${EXPLORE_PERSON_CAP} persons`,
                               { run: r.run, entity: e, cap: EXPLORE_PERSON_CAP }), ended };
    }
    this.sql.exec(`INSERT INTO explore_persons (run, question, entity, at) VALUES (?,?,?,?)`, r.run, r.question, e, iso);
    return { ok: true, run: r.run, person: true, persons: this.#personCount(r.run) };
  }

  #personCount(run) { return Number(this.#one(`SELECT COUNT(*) AS n FROM explore_persons WHERE run=?`, run).n); }

  /** R9: the looks refused on a run, in order. */
  refusalsOn(run) {
    return this.#rows(`SELECT code, entity, aim, at FROM explore_refusals WHERE run=? ORDER BY rowid`, String(run ?? ""));
  }

  /* ---------------------------------------------------------------- R4: a find, gauged */

  /** The documents a find rests on, within the paying owner's sight, or null when it is not held or not seen. */
  #locate(kind, ref, owner) {
    if (kind === "capture") {
      if (typeof ref !== "string" || !HEX64.test(ref)) return null;
      const a = this.retrieval.contentAxis({ captureSha: ref, viewer: this.principal });
      if (!a || a.found === false || !a.bundle_id) return null;
      return this.#ownerSees(owner, a.bundle_id) ? { ref, bundle_id: a.bundle_id, bundle_b: null } : null;
    }
    if (kind === "content") {
      if (typeof ref !== "string" || !ref) return null;
      let c = null;
      try { c = this.#one(`SELECT bundle_id FROM content WHERE content_id=?`, ref); } catch { c = null; }
      return c && this.#ownerSees(owner, c.bundle_id) ? { ref, bundle_id: c.bundle_id, bundle_b: null } : null;
    }
    if (kind === "connection") {
      const k = ref && typeof ref === "object" ? ref : null;
      if (!k || !HEX64.test(String(k.a ?? "")) || !HEX64.test(String(k.b ?? "")) || !str(k.entity)) return null;
      const read = this.connections.read({ captureSha: k.a, limit: 2000, viewer: this.principal });
      const rows = (read && (read.connections || read.rows)) || [];
      const row = rows.map((x) => x.connection || x).find((x) => x && x.entity_id === k.entity
        && [x.a_capture_sha, x.b_capture_sha].includes(k.a) && [x.a_capture_sha, x.b_capture_sha].includes(k.b));
      if (!row || !this.#ownerSees(owner, row.a_bundle_id) || !this.#ownerSees(owner, row.b_bundle_id)) return null;
      const [a, b] = [k.a, k.b].sort();
      return { ref: `${a}:${b}:${k.entity}`, bundle_id: row.a_bundle_id, bundle_b: row.b_bundle_id };
    }
    return null;
  }

  /** What the members of the question hold now: each drawing project's CURRENT version (`basis-versions`), and the
   *  question's projected legs (`leg-earning` R4). Stored with a find so its gauge says what it was gauged against. */
  #liveBasis(question) {
    const currents = [];
    for (const p of this.#drawing(question).slice(0, 32)) {
      try {
        const c = this.basisVersions.currentOf(p, question, this.principal);
        currents.push({ project: p, current: (c && (c.current ?? c.name ?? c.version)) ?? null });
      } catch { currents.push({ project: p, current: null }); }
    }
    let legs = null;
    try {
      const b = this.legEarning.basisFor(question, { limit: 1000 });
      legs = b && Array.isArray(b.legs) ? b.legs.length : null;
    } catch { legs = null; }
    return { currents, legs };
  }

  /** R4: a find the run located, with the run's gauge of how it bears on the question's live basis: `supports`,
   *  `cuts_against` or `unclear`, with its account of how. Recorded with the gate's false-alarm rate and gold set (R16:
   *  on the exception, both null and `untested` the label, kept with the find), the label `machine` and the account
   *  that enabled it, under the run's step. The same find
   *  under the same run answers the first record, writing nothing. Never a grade, never a score. */
  find({ run, kind, ref, bearing, how, caller = null, at = null } = {}) {
    const live = this.#liveRun(run, caller);
    if (live.refusal) return live.refusal;
    const r = live.run;
    if (!EXPLORE_BEARINGS.includes(bearing) || !str(how) || String(how).length > 2000)
      return this.#refuse("EXPLORE_BEARING_INVALID", `bearing one of ${EXPLORE_BEARINGS.join(", ")}, with an account of how (1–2,000 characters)`,
                          { run: r.run });
    if (!EXPLORE_FIND_KINDS.includes(kind))
      return this.#refuse("EXPLORE_FIND_UNKNOWN", `a find is one of ${EXPLORE_FIND_KINDS.join(", ")}`, { run: r.run });
    const loc = this.#locate(kind, ref, r.owner);
    if (!loc) return this.#refuse("EXPLORE_FIND_UNKNOWN", "not held, or not within the paying account's sight", { run: r.run, kind });
    const held = this.#one(`SELECT find FROM explore_finds WHERE run=? AND kind=? AND ref=?`, r.run, kind, loc.ref);
    if (held) return { ...this.#findAnswer(held.find, r), already: true };
    const iso = this.#iso(at);
    const g = this.gate({ entry: r.entry ?? null });
    const find = `XFD-${sha256HexSync(`${r.run}|${kind}|${loc.ref}`).slice(0, 16)}`;
    this.sql.exec(`INSERT INTO explore_finds (find, run, question, kind, ref, bundle_id, bundle_b, bearing, how,
                     false_alarm_rate, gold_set, against, untested, owner, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  find, r.run, r.question, kind, loc.ref, loc.bundle_id, loc.bundle_b, bearing, String(how).trim(),
                  g.false_alarm_rate, g.gold_set, json(this.#liveBasis(r.question)), json(g.untested), r.owner, iso);
    return { ...this.#findAnswer(find, r), step: r.step, already: false };
  }

  #findAnswer(find, r) {
    const f = this.#one(`SELECT * FROM explore_finds WHERE find=?`, find);
    return { ok: true, find, run: r.run, question: f.question, kind: f.kind, ref: f.ref,
             gauge: { bearing: f.bearing, how: f.how, false_alarm_rate: f.false_alarm_rate, gold_set: f.gold_set,
                      label: "machine", enabled_by: f.owner, untested: parse(f.untested) },
             against: parse(f.against) };
  }

  /* ---------------------------------------------------------------- R3: capture, through capture-requests only */

  /** R3: the run asks to capture an address through `capture-requests` only, the request carrying the step (its R55)
   *  and the question as its target. An address the record does not hold is refused there (its R49); this module then
   *  names that page to the members R5 reaches, who capture it, as a find of kind `page`. */
  capture({ run, address, purpose = null, render = null, caller = null, at = null } = {}) {
    const live = this.#liveRun(run, caller);
    if (live.refusal) return live.refusal;
    const r = live.run;
    if (!this.captureRequests || typeof this.captureRequests.captureRequest !== "function")
      return this.#refuse("EXPLORE_NO_RUN", "the capture door is not in place", { run: r.run });
    const asked = this.captureRequests.captureRequest(
      { run: r.run, address, target: r.question, purpose: purpose ?? say("question-explorer.exploring_question"), render, step: r.step },
      { viewer: this.principal, caller: caller ?? this.principal, ...(at ? { at } : {}) });
    if (asked && asked.ok === false && asked.code === "CAPTURE_REQUEST_ADDRESS_NOT_HELD" && typeof address === "string") {
      const iso = this.#iso(at);
      const ref = address.trim().slice(0, 2048);
      const find = `XFD-${sha256HexSync(`${r.run}|page|${ref}`).slice(0, 16)}`;
      /* R16: a page named on the exception carries the label as every find does. */
      this.sql.exec(`INSERT INTO explore_finds (find, run, question, kind, ref, bundle_id, bundle_b, bearing, how,
                       false_alarm_rate, gold_set, against, untested, owner, at)
                     VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,NULL,?,?,?) ON CONFLICT(run, kind, ref) DO NOTHING`,
                    find, r.run, r.question, "page", ref, json(this.gate({ entry: r.entry ?? null }).untested), r.owner, iso);
      return { ...asked, named_to_members: true, find };
    }
    return asked;
  }

  /* ---------------------------------------------------------------- R13: reading inside documents */

  /** R13: the run reads inside a held document through `run-productions` (its R24 `readPages`): a few pages at a time
   *  within the run's `pages` bound (`run-rules` R26), never a document under a "no AI" material limit on `read`
   *  (`ai-accounts` R22; run-productions asks `run-rules`' `checkPagesRead`, the one site), and says how far it read.
   *  Asked here first: the document is within the paying account's sight (R3), and no limit keeps it from `explore`.
   *  What it proposes while reading is `run-productions` R21's, under the step this answer names. */
  read({ run, bundleId, from = null, caller = null, at = null } = {}) {
    const d = this.#readable(run, bundleId, caller);
    if (d.refusal) return d.refusal;
    const { r, id } = d;
    if (!this.runProductions || typeof this.runProductions.readPages !== "function")
      return this.#refuse("EXPLORE_NO_RUN", "the reading door is not in place", { run: r.run });
    const read = this.runProductions.readPages({ run: r.run, bundleId: id, ...(from === null ? {} : { from }),
                                                 viewer: this.principal, caller: caller ?? this.principal,
                                                 ...(at ? { at } : {}) });
    return read && read.ok !== false ? { ...read, step: r.step } : read;
  }

  /** R3, R13: the run and the held document it would read or propose over: the run its caller holds, the document in
   *  the paying account's sight, and no limit keeping it from `explore`. */
  #readable(run, bundleId, caller) {
    const live = this.#liveRun(run, caller);
    if (live.refusal) return { refusal: live.refusal };
    const r = live.run;
    const id = str(bundleId);
    const b = id ? this.#one(`SELECT object_type, project FROM bundles WHERE bundle_id=?`, id) : null;
    if (!b || b.object_type !== "information" || !this.#ownerSees(r.owner, id))
      return { refusal: { ok: false, reason: "NO_SUCH_BUNDLE", code: "NO_SUCH_BUNDLE", target: id,
                          detail: "no held document by that id is in the paying account's sight" } };
    /* `ai-accounts` R22's one site; a call that throws is answered its R34 fail-closed refusal, never a copy. */
    let k = null;
    try { k = this.aiAccounts.aiKeptAway({ project: str(b.project), use: EXPLORE_USE }); }
    catch { k = KEPT_AWAY_UNREADABLE; }
    if (k) return { refusal: this.#refuse("EXPLORE_READ_KEPT_AWAY", "a material limit keeps this document from exploring",
                                          { run: r.run, target: id, kept_away: { code: k.code ?? null, use: EXPLORE_USE } }) };
    return { r, id };
  }

  /** R13 (K2502): what the run proposes while reading a held document is `run-productions` R21's (`extractPropose`):
   *  passages and connections, each tied to its quote, labelled the system's, under the run's step, minted within its
   *  `mints` bound. Asked here first, as `read` asks; and a proposed connection to a person passes R9 and R10's gate (a
   *  person a member tied, within the run's 20), so the run gathers about no one else by proposing either. */
  async propose({ run, bundleId, fn, version, cap = null, refs = [], connections = [], caller = null, at = null } = {}) {
    const d = this.#readable(run, bundleId, caller);
    if (d.refusal) return d.refusal;
    const { r, id } = d;
    for (const c of Array.isArray(connections) ? connections : []) {
      if (!c || c.to_kind !== "person") continue;
      const looked = await this.look({ run: r.run, entity: c.to, aim: say("question-explorer.proposed_connection"), caller, at });
      if (looked.ok === false) return { ...looked, nothing_proposed: true };
    }
    if (!this.runProductions || typeof this.runProductions.extractPropose !== "function")
      return this.#refuse("EXPLORE_NO_RUN", "the proposing door is not in place", { run: r.run });
    return this.runProductions.extractPropose({ run: r.run, bundleId: id, fn, version, cap, refs, connections, step: r.step,
                                                proposedBy: this.principal, viewer: this.principal,
                                                caller: caller ?? this.principal, ...(at ? { at } : {}) });
  }

  /* ---------------------------------------------------------------- R8, R12: the end */

  /** R17: the run's close through `ai-runs`, awaited, in the record's own words: a `bound` of `run-rules`' `RUN_BOUNDS`
   *  or `RUN_ENDINGS` (the one named when it is one, else `completed`: a run this module ends by its own rule, the cap or
   *  a limit, finished its work as far as it went) and a `condition` that is null or a key of `CONDITION_KINDS`. This
   *  module's own reasons (`EXPLORE_PERSON_CAP_REACHED`, a limit's text) are the step's `reason` only, never the run's
   *  condition. `ai-runs` ends the run's step at its close (its R73, `steps` R5's machine arm): `ended`, or `set_aside`
   *  with the reason. A close `ai-runs` refuses, or that fails, is carried in the answer (`closed: false`, the plane's
   *  code) and the row records that the end was not accepted (`close_refused`), the run staying open to end again; it
   *  never throws. */
  async #end(r, end, reason, bound, condition, iso, caller) {
    let closed = null;
    try {
      closed = await this.aiRuns.close({ run: r.run, bound: typeof bound === "string" && runRules.checkBound(bound) === null
                                           ? bound : "completed",
                                         condition: condition ?? null, stepEnd: end, reason: reason ?? null,
                                         at: iso, actor: null, viewer: this.principal,
                                         caller: caller ?? this.principal });
    } catch { closed = null; }
    const accepted = !!closed && closed.ok !== false && closed.terminated !== false && closed.found !== false;
    if (!accepted) {
      const code = closed && typeof closed.code === "string" ? closed.code : null;
      this.sql.exec(`UPDATE explore_runs SET close_refused=? WHERE run=? AND ended IS NULL`, code ?? "NOT_ACCEPTED", r.run);
      return { run: r.run, end, reason: reason ?? null, closed: false, code, actual: null };
    }
    const actual = (closed.actual ?? closed.cost) != null ? (closed.actual ?? closed.cost) : null;
    this.sql.exec(`UPDATE explore_runs SET ended=?, reason=?, closed_at=?, actual=?, close_refused=NULL WHERE run=? AND ended IS NULL`,
                  end, reason ?? null, iso, json(actual === null ? null : { actual }), r.run);
    return { run: r.run, end, reason: reason ?? null, closed: true, actual };
  }

  /** R8, R12, R17: the run's end. `ended` ends its step with every outcome undetermined; `set_aside` (a limit reached, a
   *  refusal) names its reason, and only the enabling owner is told (`stopsFor`). The close is awaited and answers
   *  `closed` only when `ai-runs` accepted it; the run's actual cost (`ai-runs` R76) is kept, answered only to the paying
   *  account's owners. An ended run answers as it ended. A `condition` outside `CONDITION_KINDS` is refused before
   *  anything is closed. */
  async end({ run, end = "ended", reason = null, bound = null, condition = null, caller = null, at = null } = {}) {
    const held = typeof run === "string" ? this.#one(`SELECT * FROM explore_runs WHERE run=?`, run.trim()) : null;
    if (held && held.ended) return { ok: true, run: held.run, end: held.ended, reason: held.reason, already: true };
    const live = this.#liveRun(run, caller);
    if (live.refusal) return live.refusal;
    if (end !== "ended" && end !== "set_aside")
      return this.#refuse("EXPLORE_RUN_ENDED", "a run ends `ended` or `set_aside`", { run: live.run.run });
    const bad = runRules.checkCondition(condition);
    if (bad) return { ...bad, run: live.run.run };
    const why = end === "set_aside" ? (str(reason) ? str(reason).slice(0, 500) : "LIMIT_REACHED") : null;
    const done = await this.#end(live.run, end, why, bound, condition, this.#iso(at), caller);
    return done.closed ? { ok: true, ...done, already: false } : { ok: false, ...done, already: false };
  }

  /** R8: the runs set aside by a limit, each told once (a stable key) to the owners of the account that enabled it
   *  only; never naming a place. For `notice-producers`. Never throws. */
  stopsFor({ viewer = null, at = null } = {}) {
    try {
      const rows = this.#rows(`SELECT run, question, owner, reason, closed_at FROM explore_runs WHERE ended='set_aside'
                                ORDER BY closed_at DESC, run LIMIT 1000`);
      return { ok: true, stops: rows.filter((x) => this.#ownsAccount(viewer, x.owner))
        .map((x) => ({ key: `explore-stopped:${x.run}`, run: x.run, question: x.question, reason: x.reason, at: x.closed_at,
                       says: say("question-explorer.says.exploring_run_enabled") })) };
    } catch { return { ok: true, stops: [] }; }
  }

  /** R12: a run's estimate before and actual cost after, to the paying account's owners only; anyone else is
   *  answered as for a run that does not exist. */
  runCost({ run, viewer = null } = {}) {
    const r = typeof run === "string" ? this.#one(`SELECT * FROM explore_runs WHERE run=?`, run.trim()) : null;
    if (!r || !this.#ownsAccount(viewer, r.owner)) return null;
    return { run: r.run, owner: r.owner, estimate: parse(r.estimate)?.estimate ?? null, actual: parse(r.actual)?.actual ?? null,
             ended: r.ended };
  }

  /* ---------------------------------------------------------------- R5, R7, R14: offering */

  /** Whether a find is offered to a member: the gate open, she is among the question's recipients, she may see the
   *  question and every document the find rests on. */
  #offeredTo(f, member, ctx) {
    const viewer = `member:${member}`;
    if (!ctx.recipients.has(f.question)) ctx.recipients.set(f.question, new Set(this.#recipients(f.question)));
    if (!ctx.recipients.get(f.question).has(member)) return false;
    if (!this.membership.inSight(f.question, viewer)) return false;
    if (f.bundle_id && !this.membership.inSight(f.bundle_id, viewer)) return false;
    if (f.bundle_b && !this.membership.inSight(f.bundle_b, viewer)) return false;
    return true;
  }

  /** R5, R7, R14: for `notice-producers`: each find, once (a stable key per find and question), to each of the
   *  question's recipients who may see both the find and the question, less those she muted or accepted. Every find
   *  is the same item in the same order (newest first, then by id) whatever its bearing: nothing here orders, groups
   *  or filters by bearing (R14). Labelled the system's work, and with the label a find was gauged under on the
   *  test-instance exception (R16); which account paid is answered only to its owners (D64).
   *  While the gate is shut it answers nothing and counts nothing (R7). Never throws. */
  findsFor({ viewer = null, at = null, limit = 200 } = {}) {
    const n = Math.max(1, Math.min(1000, Math.floor(Number(limit)) || 200));
    try {
      const member = bareMember(viewer);
      if (!member) return { ok: true, finds: [], truncated: false };
      const ctx = { recipients: new Map(), gates: new Map() };
      const out = [];
      let truncated = false;
      for (const f of this.#rows(`SELECT * FROM explore_finds ORDER BY at DESC, find LIMIT 5000`)) {
        if (!this.#findGateOpen(f, ctx)) continue;
        if (this.#doored(f, member)) continue;
        if (!this.#offeredTo(f, member, ctx)) continue;
        if (out.length >= n) { truncated = true; break; }
        out.push(this.#item(f, viewer));
      }
      return { ok: true, finds: out, truncated };
    } catch { return { ok: true, finds: [], truncated: false }; }
  }

  /** R7, F1: whether the gate is open on the entry the find's run was opened on (judged once an entry per `ctx`). */
  #findGateOpen(f, ctx = { gates: new Map() }) {
    const r = this.#one(`SELECT entry FROM explore_runs WHERE run=?`, f.run);
    const entry = r && typeof r.entry === "string" && r.entry ? r.entry : null;
    const k = entry ?? "";
    if (!ctx.gates.has(k)) ctx.gates.set(k, this.gate({ entry }).open === true);
    return ctx.gates.get(k);
  }

  /** Whether a member already muted or accepted a find (R6): it is then offered to her no more. */
  #doored(f, member) {
    return !!this.#one(`SELECT 1 AS x FROM explore_doors WHERE find=? AND question=? AND member=?`, f.find, f.question, member);
  }

  #item(f, viewer) {
    return { key: `explore-find:${f.find}:${f.question}`, find: f.find, question: f.question, kind: f.kind, ref: f.ref,
             bearing: f.bearing, how: f.how, false_alarm_rate: f.false_alarm_rate, gold_set: f.gold_set,
             untested: parse(f.untested), label: "machine", by: "system", says: EXPLORE_FIND_SAYS, at: f.at,
             ...(this.#ownsAccount(viewer, f.owner) ? { enabled_by: f.owner } : {}) };
  }

  /* ---------------------------------------------------------------- R6: the member's doors */

  #offered(find, question, by) {
    const member = bareMember(by);
    if (!member || isMachineIdentity(String(by))) return null;
    const f = typeof find === "string" ? this.#one(`SELECT * FROM explore_finds WHERE find=? AND question=?`, find, String(question ?? "")) : null;
    if (!f || !this.#findGateOpen(f) || !this.#offeredTo(f, member, { recipients: new Map() })) return null;
    if (this.#doored(f, member)) return null;
    return { f, member };
  }

  /** R6: the doors a find offers its member: dismiss (in a drawing project, the queue's project-scoped disposition,
   *  `queue` R27; outside every one, `findMute`), accept (`findAccept`, `record-grammar` R52's forms), hold a
   *  hypothesis (`hypotheses`), or start a step (`steps.stepCreate`). Answers null for a find not offered to her. */
  findDoors({ find, question, viewer = null } = {}) {
    const o = this.#offered(find, question, viewer);
    if (!o) return null;
    const inProject = this.#drawing(o.f.question).some((p) => this.membership.isJoinedParticipant(p, o.member));
    return { find: o.f.find, question: o.f.question, doors: [
      { door: "dismiss", by: inProject ? "the queue's dismissal, for the project (queue R27)" : "findMute" },
      { door: "accept", by: "findAccept", forms: [...ACCEPTANCE_FORMS] },
      { door: "hypothesis", by: "hypotheses" },
      { door: "step", by: "steps.stepCreate" },
    ] };
  }

  /** R6: a member accepts a find into the evidence by one act, in one of `record-grammar` R52's forms: as found, edited
   *  (her own words), or her own instead. Records the acceptance and answers the leg her own promotion would carry;
   *  writes no leg, no grade, no conclusion and no hypothesis. */
  findAccept({ find, question, form, edit = null, by = null, at = null } = {}) {
    if (!bareMember(by) || isMachineIdentity(String(by ?? "")) || !ACCEPTANCE_FORMS.includes(form)
        || (form === "edited" && !str(edit)))
      return this.#refuse("EXPLORE_ACCEPT_INVALID", `a member's act, form one of ${ACCEPTANCE_FORMS.join(", ")}, an edit with \`edited\``);
    const o = this.#offered(find, question, by);
    if (!o) return this.#refuse("EXPLORE_NO_SUCH_FIND", "answered as absent", { find: find ?? null });
    const rec = acceptanceRecord({ proposal: o.f.find, form, by: String(by), at: this.#iso(at), kind: "explore-find" });
    this.sql.exec(`INSERT INTO explore_doors (find, question, member, door, record, at) VALUES (?,?,?,?,?,?)
                   ON CONFLICT(find, question, member) DO UPDATE SET door=excluded.door, record=excluded.record, at=excluded.at`,
                  o.f.find, o.f.question, o.member, "accepted", json(rec), rec.at ?? this.#iso(at));
    const target = o.f.kind === "page" ? null : o.f.bundle_id;
    const leg = form === "own_instead" || !target ? null
      : { question: o.f.question, target, ...(o.f.kind === "content" ? { content_id: o.f.ref } : {}),
          note: form === "edited" ? str(edit) : o.f.how };
    return { ok: true, find: o.f.find, question: o.f.question, accepted: rec, leg,
             route: o.f.kind === "page" ? say("question-explorer.capture_page_act")
               : say("question-explorer.promotion_question_writes"), wrote_leg: false };
  }

  /** R6: a follower outside every project drawing on the question mutes a find; within a drawing project the find is
   *  dismissed for the project by the queue (`queue` R27), not here. */
  findMute({ find, question, by = null, at = null } = {}) {
    const o = this.#offered(find, question, by);
    if (!o) return this.#refuse("EXPLORE_NO_SUCH_FIND", "answered as absent", { find: find ?? null });
    if (this.#drawing(o.f.question).some((p) => this.membership.isJoinedParticipant(p, o.member)))
      return this.#refuse("EXPLORE_MUTE_IN_PROJECT", "dismissed for the project by the queue", { find: o.f.find });
    this.sql.exec(`INSERT INTO explore_doors (find, question, member, door, record, at) VALUES (?,?,?,?,NULL,?)
                   ON CONFLICT(find, question, member) DO NOTHING`, o.f.find, o.f.question, o.member, "muted", this.#iso(at));
    return { ok: true, find: o.f.find, question: o.f.question, muted: true };
  }

  /* ---------------------------------------------------------------- R11: a group's own test investigations */

  /** R11: the explorer's results on this group's own test investigations (`ai-runs` R75), with their false-alarm
   *  rate, to this group's members only. Never read by the gate. */
  groupTestResults({ viewer = null } = {}) {
    const member = bareMember(viewer);
    const facts = member ? this.membership.memberFacts(member) : null;
    if (!facts || facts.status !== "active") return null;
    if (!this.aiRuns || typeof this.aiRuns.groupTestResults !== "function") return { ok: true, part: EXPLORE_TEST_PART, results: [] };
    return this.aiRuns.groupTestResults({ part: EXPLORE_TEST_PART, viewer });
  }
}

const instances = new WeakMap();

/** The one question-explorer instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on
 *  the first call only; a provider not given is reached through its factory (`steps` since K2491, `ai-use` since
 *  K2488). At creation it creates its tables (`migrate()`, idempotent) and only then declares them to purge, as
 *  `publish-schedule`'s factory does, so a host that never calls `migrate()` reads, ticks and purges (R15). */
export function questionExplorerOf(host, deps) {
  let p = instances.get(host);
  if (!p) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    p = new QuestionExplorer({
      storage: d.storage || host.storage, record, membership,
      aiAccounts: d.aiAccounts || aiAccountsOf(host, { record, membership }),
      connections: d.connections || connectionsOf(host),
      retrieval: d.retrieval || retrievalOf(host),
      inquiry: d.inquiry || inquiryOf(host),
      legEarning: d.legEarning || legEarningOf(host),
      basisVersions: d.basisVersions || basisVersionsOf(host),
      aiRuns: d.aiRuns || aiRunsOf(host),
      captureRequests: d.captureRequests || captureRequestsOf(host),
      runProductions: d.runProductions || runProductionsOf(host),
      steps: d.steps || stepsOf(host, { record, membership }), aiUse: d.aiUse || aiUseOf(host, { record, membership }),
      held: d.held || null, ...(d.testSet ? { testSet: d.testSet } : {}),
      principal: d.principal || EXPLORE_PRINCIPAL, now: d.now || null,
    });
    instances.set(host, p);
    p.migrate();
    record.declarePurge(QUESTION_EXPLORER_MODULE, QUESTION_EXPLORER_TABLES);
  }
  return p;
}
