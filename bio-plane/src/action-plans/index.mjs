/* action-plans — the action plan (requirements: `build/requirements/action-plans.md`; `BIO_Action_v0_2.md` §3, §4):
 * a project's working material for deciding what to do about one or more matters, an inquiry still open (suspected)
 * or a determination's outcomes (determined). It holds options the assistant suggests or a member adds, each bound to
 * the matters it serves; the member's choice of which to pursue; any number of scenarios laying the chosen options out
 * over time, with checkpoints a member judges, each in use or set aside; and the link from each started option to the
 * Action it created. Since T45 (`BIO_Action_v0_2.md`) a plan may be paused, offers the infraction's two standing options
 * (R41, R42), holds the re-examination's machine marks apart (R43), and keeps a frozen summary and a note at its close
 * (R20, R44, R45). Since T46 a pause is the document's own state, `paused`, written with its Plan Log entry in one act
 * (R46 (a); record-grammar's `action_plan` states), and the look-again day is read on the place's local day (R46 (b)).
 * Since T47 the date checks are judged on that local day too (R48), and a closed plan's read names its closing instant
 * `closed.at` (R50). Since T48 a member's "Ask the assistant for options" is `planAsk` (R51): it opens the plan's planning
 * run and records no option or proposal of the member's own.
 *
 * A new module (T18, layer 9, last): nothing moves from the legacy modules. Escalation's record-object pattern is the
 * model (its index.mjs and doc.mjs).
 *
 * WHAT IT DECIDES, AND WHAT IT NEVER DOES. Every fact about a matter is read through the module that owns it (an
 * inquiry's state through record-core and the projects drawing on it through `leg-earning`, a determination through
 * `conformance`, a standard through `standards`, an action through `actions`, an escalation through `escalation`, what
 * is available through `filings`, the project's bar through `strength`); support, liveness, phase starts and the checks
 * are derived when read, never stored (R8, R15, R19). A machine proposes (R11, R31) and nothing else (R24, R33): every
 * other act is a named member's. A checkpoint is the group's own intention and never a finding about the government
 * (R23). Nothing here holds a cost, budget, assignee, hours or significance score (R26), and no place is named in its
 * behaviour or text (R28). A plan is never published (R25): it is read only through this module's reads, by a viewer
 * who may see its project, and answered to anyone else as an id that names nothing (R22).
 *
 * THE RECORD OBJECT (R2, R27). A plan is a document of type `action_plan` under a `PLN-` id, promoted through
 * `promotion` like any record object, so it has history, audit and export. Each act is one promotion that appends one
 * entry to the document's Plan Log; the tables are that log's projections, written by the module's registered
 * projection inside the promotion's transaction. The module's registered check refuses any other promotion of a plan
 * document (only a replay restores one), so an act and a raw promotion cannot disagree about what happened. Proposals
 * are stored apart (R11), since any credential may make one, and are never part of the plan's document.
 *
 * REACHED as `actionPlansOf(host, deps)` (K61): one instance per host, created on the first call with `deps`, returned
 * to every later caller. At creation it migrates its tables (idempotent), declares them to purge (R27), registers its
 * step with promotion (R21's check included), and registers its planning-run check and run listener with ai-runs (R30,
 * R32).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `allocId`, `transact`, `head`, `readFile`, `livePaths`, `declarePurge`;
 *                                   `inSight`, `sight`, `existenceAct`, `projectAuthority`, `memberFacts`; `promote`,
 *                                   `registerStep`.
 *   legEarning     `projectsDrawingOn` (its R7; R1: the projects drawing on an inquiry), read directly (K1661).
 *   strength       `projectBar` (Terms: `short` support).
 *   conformance    `determinationRead`, `determinationsFor` (R1, R5, R8); its `noSuchDetermination`.
 *   standards      `standardRead` (R12's `enforces`, R19).
 *   actions        `actionCreate`, `actionRead` (R6, R15, R18); its `contactNotAMember` and `contactId` (its R45; R18);
 *                  `place()` and `zoneOf` (its R68; R46 (b): the zone a plan's day is read in).
 *   clocks         action-clocks' `reminderSet` and `reminderRefused` (its R4; R18, R29).
 *   escalation     `escalationsFor`, `escalationRead` (R6, R15).
 *   filings        `availableActions` (shown beside legal options).
 *   duties         `occurrencesOf`, `transitionsOf`, `readDuty` (R38: a phase started by a duty occurrence's state); its
 *                  `noSuchDuty` (its R25; R38, N601).
 *   aiRuns         `registerOpenCheck`, `onRunOpened`, `runFor`, `read`, `boundOf`, `consumeBound` (R30–R32); `open` in mode
 *                  `plan` (its R46; R51).
 *   now            the instance clock, an ISO string (default: the wall clock, to the second). */

import { recordOf, stampInstant, instantOrder } from "../record-core/index.mjs";
import { membershipOf, noSuchProject, listenerRefusal } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { strengthOf } from "../strength/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { conformanceOf, noSuchDetermination } from "../conformance/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { actionsOf, contactNotAMember, contactId, zoneOf } from "../actions/index.mjs";
import { localDay } from "../civil-time/index.mjs";
import { governingZone } from "../../../jurisdictions/index.mjs";
import { actionClocksOf, reminderRefused } from "../action-clocks/index.mjs";
import { escalationOf } from "../escalation/index.mjs";
import { filingsOf } from "../filings/index.mjs";
import { dutiesOf, noSuchDuty, INTERNAL as DUTIES_INTERNAL } from "../duties/index.mjs";
import { aiRunsOf, AiRuns } from "../ai-runs/index.mjs";
import { runPrincipalGate } from "../run-rules/index.mjs";
import { isMachineIdentity, proposalLabel, normalizeType } from "../record-grammar/index.mjs";
import { ACTION_PLAN, planId, planDoc, appendEntry, logOf, logSection, parseFm, q, tok } from "./doc.mjs";
import { ACTION_PLANS_TABLES, migrateActionPlans } from "./schema.mjs";
import { ACTION_PLAN_CHECKS, PLAN_WORDS, refusal } from "./checks.mjs";
import { CATEGORIES, DISPOSITIONS, NEEDS_REASON, WORK_KINDS, REFUSED_KEYS, TIERS, JUDGEMENTS, TITLE_MAX, REASON_MAX,
         SUMMARY_MAX, DETAIL_MAX, WHY_MAX, NOTE_MAX, SUBJECTS_MAX, DATES_MAX, PLANS_PAGE_MAX, DUE_MAX,
         SOURCES_MAX, isObj, str, isDay, isLine, isToken, normSubject, subjectKey, addresseeArm, addresseeEmptyFields, addresseeOf,
         checkPhases, phaseTimes, unbranched, dayOf, DUTY_STATES, OFFER_KINDS, INFRACTION_OUTCOMES, MARK_KINDS, CLOSE_NOTE_MAX,
         CLOSING_NOTES_MAX, MARKS_MAX } from "./values.mjs";
import { localize, word } from "../setup-words/index.mjs";

export { ACTION_PLANS_SCHEMA, ACTION_PLANS_TABLES } from "./schema.mjs";
export { ACTION_PLAN_CHECKS, PLAN_WORDS } from "./checks.mjs";
export { CATEGORIES, DISPOSITIONS, WORK_KINDS, REFUSED_KEYS, TIERS, JUDGEMENTS, DUTY_STATES, PLAN_STATES, OFFER_KINDS,
         MARK_KINDS } from "./values.mjs";

/** R1, R8: an inquiry still open is live; these states are closed. (`published` is read, never entered.) */
export const CLOSED_INQUIRY_STATES = Object.freeze(["concluded", "dismissed", "divided", "published"]);
/** R32: the disclosure every machine proposal, and every option adopted from one, answers. */
export const DISCLOSURE = (run, skill) => localize("action-plans.suggested_assistant_machine", "Suggested by the assistant (machine work) in run {run}, under skill version {skill}. It is not the team's decision; it becomes an option only when a member adopts it.", { run: String(run), skill: String(skill ?? "undetermined") });
const PROPOSAL_SAYS = localize("action-plans.proposal_option_stored", "this is a proposal, not an option: it is stored apart from the plan's options and becomes one only when a member adopts it, in their own words for any reason the plan asks.");
const CHECK_SAYS = localize("action-plans.check_informs_refuses", "a check informs; it never refuses or changes anything.");
/* R41: the offers' default words, which a member may change when adopting one; the surface's keyed sentences are the
   design stream's (`plan.offer.document_infraction`, `plan.offer.chance_to_fix`). */
const OFFER_WORDS = Object.freeze({
  document_infraction: Object.freeze({ summary: localize("action-plans.summary.document_infraction", "Document the infraction"), category: "other", key: "plan.offer.document_infraction" }),
  chance_to_fix: Object.freeze({ summary: localize("action-plans.summary.offer_chance_fix", "Offer the chance to fix it"), category: "mitigation", key: "plan.offer.chance_to_fix" }),
});
/* R20, R47: the closing note's prompt, its key and words.json's words for it, read by key (DEC-194). */
const CLOSE_NOTE_PROMPT = Object.freeze({ key: "plan.close.lessons", en: PLAN_WORDS["plan.close.lessons"] });
/* R46 (b): what the look-again read says when no zone is held. */
const LOOK_AGAIN_UNDETERMINED = word("action-plans.time_zone_held");
/* R48: what a date check says when no zone is held. */
const DAY_UNDETERMINED = word("action-plans.time_zone_held_place");
/* R40: what a paused plan's read says of it. */
const PAUSED_SAYS = localize("action-plans.plan_paused_set", "the plan is paused: what it set running continues (its actions' dates, escalations and watches), and its own checkpoints are not due until it is resumed. Every act stays open to members.");
/* R37: the preview's own mode of R18's path, and what it says. */
const PREVIEW = Symbol("action-plans start preview");
const PREVIEW_SAYS = localize("action-plans.preview_starting_option", "a preview of starting this option: what the action would be, the matters it would rest on and the reminders it would set. Nothing was written: no action, no id, no reminder.");
/* R51: the skill version and bounds a member's planning run is opened under (a planning run: no search, ai-runs R46). */
const ASK_SKILL = "planning@1";
const ASK_BOUNDS = Object.freeze([Object.freeze({ bound: "proposals", allowed: 20 }),
                                  Object.freeze({ bound: "wallclock", allowed: 600000 })]);
const DAY_MS = 86400000;
const ACT = Symbol("action-plans act");
/* R35: marks a liveness whose successor was withheld; never answered. */
const WITHHELD = Symbol("action-plans withheld");
const GRADE_RANK = Object.freeze({ A: 0, B: 1, C: 2, D: 3 });

const isMachine = (who) => str(who) === "" || isMachineIdentity(str(who));
const unjson = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const hex8 = () => { const b = new Uint8Array(4); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); };
const msOf = (v) => (typeof v !== "string" || !v ? NaN : /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : Date.parse(v));
const iso = (ms) => stampInstant("second", ms);
const ok = (r) => r && r.ok !== false;

export class ActionPlans {
  /* R44: the one reader of a plan's closing summary, `{module, fn}`. */
  #closeHolder = null;
  /* R51: the planning runs being opened by a member's ask right now, by plan, each a promise of its run id (or null), so
     two asks at once open one run. */
  #asking = new Map();

  constructor(deps) {
    this.record = deps.record;
    this.membership = deps.membership;
    this.promotion = deps.promotion;
    this.sql = (deps.storage || {}).sql;
    this.deps = deps;
    this.now = deps.now || (() => stampInstant("second"));
  }

  /* The providers, reached when first needed (layers 5–9). */
  get legEarning() { return this.#dep("legEarning"); }
  get strength() { return this.#dep("strength"); }
  get basisVersions() { return this.#dep("basisVersions"); }
  get conformance() { return this.#dep("conformance"); }
  get standards() { return this.#dep("standards"); }
  get actions() { return this.#dep("actions"); }
  get clocks() { return this.#dep("clocks"); }
  get escalation() { return this.#dep("escalation"); }
  get filings() { return this.#dep("filings"); }
  get duties() { return this.#dep("duties"); }
  get aiRuns() { return this.#dep("aiRuns"); }
  #dep(name) {
    const d = this.deps[name];
    let v;
    try { v = typeof d === "function" ? d() : d; } catch { v = null; }
    if (!v) throw new ProviderAbsent(name);
    return v;
  }

  /** R27: the module's tables; run at creation, and safe to run again. */
  migrate() { migrateActionPlans(this.sql); }

  #rows(qy, ...a) { return [...this.sql.exec(qy, ...a)]; }
  #one(qy, ...a) { return this.#rows(qy, ...a)[0] || null; }
  #text(id) { const f = this.record.readFile(id, "bundle.md"); return f && typeof f.text === "string" ? f.text : null; }
  #nowMs() { return msOf(this.now()); }

  /* ===================================================================== *
   * READING THE PLAN'S ROWS (R6, R22: absent and unseen are one answer)
   * ===================================================================== */

  #sees(project, viewer) { return viewer === null || viewer === undefined || this.membership.inSight(project, viewer); }

  #plan(id, viewer) {
    if (typeof id !== "string" || !id) return null;
    const r = this.#one(`SELECT * FROM plans WHERE plan_id=?`, id);
    if (!r || !this.#sees(r.project_id, viewer)) return null;
    return { id: r.plan_id, project: r.project_id, title: r.title, state: r.state, openedBy: r.opened_by,
             openedAt: r.opened_at, closedBy: r.closed_by ?? null, closedAt: r.closed_at ?? null,
             closeReason: r.close_reason ?? null };
  }
  #subjectsOf(planId, { all = false } = {}) {
    return this.#rows(`SELECT * FROM plan_subjects WHERE plan_id=? ${all ? "" : "AND removed_seq IS NULL"} ORDER BY seq, ord`, planId)
      .map((s) => ({ key: s.skey, subject: unjson(s.subject_json, {}), addedBy: s.added_by, addedAt: s.added_at,
                     removedSeq: s.removed_seq ?? null }));
  }
  #options(planId) {
    return this.#rows(`SELECT * FROM plan_options WHERE plan_id=? ORDER BY ord`, planId).map((o) => ({
      id: o.option_id, ord: o.ord, fields: unjson(o.fields_json, {}), disposition: o.disposition,
      reminders: unjson(o.reminders_json, null), chosenBy: o.chosen_by ?? null, proposal: o.proposal_id ?? null,
      createdBy: o.created_by, createdAt: o.created_at, action: o.action_id ?? null, startedBy: o.started_by ?? null,
      startedAt: o.started_at ?? null }));
  }
  #option(planId, optionId) {
    return typeof optionId === "string" ? this.#options(planId).find((o) => o.id === optionId) || null : null;
  }
  #scenarios(planId) {
    const rows = this.#rows(`SELECT * FROM plan_scenarios WHERE plan_id=? ORDER BY scenario, version`, planId);
    const out = new Map();
    for (const r of rows) out.set(r.scenario, { scenario: r.scenario, version: r.version, name: r.name,
      phases: unjson(r.phases_json, []), author: r.author, at: r.at, versions: (out.get(r.scenario)?.versions ?? 0) + 1 });
    return [...out.values()];
  }
  #judgements(planId, scenario, version) {
    return new Map(this.#rows(`SELECT * FROM plan_checkpoints WHERE plan_id=? AND scenario=? AND version=?`,
      planId, scenario, version).map((j) => [j.phase, { judged: j.judged, note: j.note ?? null, author: j.author, at: j.at }]));
  }
  #history(planId) {
    return this.#rows(`SELECT * FROM plan_history WHERE plan_id=? ORDER BY seq`, planId)
      .map((h) => ({ ...unjson(h.entry_json, {}), seq: h.seq, kind: h.kind, author: h.author, at: h.at, reason: h.reason ?? null }));
  }

  /* ===================================================================== *
   * THE FACTS OF A SUBJECT (Terms, R1, R5, R8), read through their owners
   * ===================================================================== */

  /* An inquiry the viewer may see: its state; null when absent, unseen or not an inquiry. */
  #inquiryFacts(id, viewer) {
    const h = typeof id === "string" ? this.record.head(id) : null;
    if (!h || normalizeType(h.type) !== "inquiry") return null;
    if (viewer !== null && viewer !== undefined && !this.membership.inSight(id, viewer)) return null;
    return { state: h.currentState };
  }
  #inquiryOfProject(id, project) {
    const list = this.legEarning.projectsDrawingOn(id) || [];
    return list.includes(project);
  }
  #determination(id, viewer) {
    const d = typeof id === "string" && id ? this.conformance.determinationRead({ id, viewer }) : null;
    return ok(d) ? d : null;
  }

  /** Terms: a subject's support, with why. `established` and `short` for a determined subject (each finding's frozen
   *  pair against the project's bar, per declared axis); `hypothetical` for a suspected one. */
  #support(s, project, viewer) {
    /* K5131: a question the plan's project has concluded (its stance there, basis-versions R18, R22; its own state stays open) is still a
       suspected matter, but it is not described as open. */
    if (s.kind === "inquiry") return this.basisVersions.conclusionOf(project, s.inquiry, viewer)
      ? { support: "hypothetical", why: localize("action-plans.why.suspected_matter_concluded", "a suspected matter: a question concluded in this project, not yet a determination") }
      : { support: "hypothetical", why: localize("action-plans.why.suspected_matter_inquiry", "a suspected matter: an inquiry still open, not a determination") };
    const d = this.#determination(s.determination, viewer);
    if (!d) return { support: "undetermined", why: localize("escalation.determination_answer_reader", "the determination does not answer to this reader") };
    /* R35: what conformance withheld (its R24) is not measured by its absence; support is never computed over the
       visible findings alone. */
    if (d.out_of_view === true)
      return { support: "short", why: localize("action-plans.why.finding_determination_rests", "a finding the determination rests on is not one you may see, so it is not shown to meet the project's bar") };
    const bar = this.strength.projectBar(project) || {};
    const axes = ["capture", "connection"].filter((a) => typeof bar[a] === "string" && bar[a] in GRADE_RANK);
    if (!axes.length) return { support: "established", why: localize("action-plans.why.determined_project_declares", "determined; the project declares no bar, so nothing is measured against one") };
    const findings = Array.isArray(d.findings) ? d.findings : [];
    for (const f of findings) {
      for (const a of axes) {
        const g = f && f.frozen && f.frozen[a] ? f.frozen[a].grade : null;
        if (!(g in GRADE_RANK))
          return { support: "short", why: localize("action-plans.why.finding_grade_graded", "a finding's {first} grade is not graded, so it is not shown to meet the project's bar ({first_2} {bar})", { first: String(a), first_2: String(a), bar: String(bar[a]) }) };
        if (GRADE_RANK[g] > GRADE_RANK[bar[a]])
          return { support: "short", why: localize("action-plans.why.finding_grade_short", "a finding's {first} grade {grade} is short of the project's bar ({first_2} {bar})", { first: String(a), grade: String(g), first_2: String(a), bar: String(bar[a]) }) };
      }
    }
    return { support: "established", why: localize("action-plans.why.determined_finding_rests", "determined; every finding it rests on meets the project's bar on each declared axis") };
  }

  /** R8: a subject's liveness, derived when read; null for a subject the viewer may not see, which R35 withholds whole.
   *  A successor the viewer may not see is left out, the key with it (R35); `withheld` says so. */
  #liveness(s, viewer) {
    if (s.kind === "inquiry") {
      const f = this.#inquiryFacts(s.inquiry, viewer);
      if (!f) return null;
      return CLOSED_INQUIRY_STATES.includes(f.state) ? { state: "closed", inquiry_state: f.state } : { state: "live" };
    }
    const d = this.#determination(s.determination, viewer);
    if (!d) return null;
    if (d.live === true) return { state: "live" };
    if (typeof d.superseded_by !== "string") return { state: "superseded", successor: null };
    if (!this.#determination(d.superseded_by, viewer)) return { state: "superseded", [WITHHELD]: true };
    return { state: "superseded", successor: d.superseded_by };
  }

  /* R35: one read's sight of the objects a plan names, asked once each. `subject(s)` and `action(id)` answer whether the
     viewer may see it; `field(f)` is an option's fields with every unseen subject withheld whole (its `subjects`, an
     `enforces` naming one); `phases(ps)` drops a `when_subject` naming one; `withheld` is set whenever anything is. */
  #sight(viewer) {
    const memo = new Map();
    const ask = (k, f) => { if (!memo.has(k)) memo.set(k, !!f()); return memo.get(k); };
    const v = {
      withheld: false,
      subject: (s) => {
        const seen = !s || typeof s !== "object" ? true : ask(`s:${subjectKey(s)}`, () => (s.kind === "inquiry"
          ? this.#inquiryFacts(s.inquiry, viewer) : this.#determination(s.determination, viewer)));
        if (!seen) v.withheld = true;
        return seen;
      },
      action: (id) => ask(`a:${id}`, () => ok(this.actions.actionRead({ id, viewer }))),
      subjects: (list) => (Array.isArray(list) ? list.filter((s) => v.subject(s)) : list),
      fields: (f) => {
        if (!isObj(f)) return f;
        const out = { ...f, subjects: v.subjects(f.subjects) };
        if (out.enforces && out.enforces.subject && !v.subject(out.enforces.subject)) delete out.enforces;
        return out;
      },
      duty: (id) => {
        const seen = ask(`d:${id}`, () => { const r = this.duties.readDuty({ dutyId: id, viewer: dutyViewer(viewer) }); return ok(r) && r.found === true; });
        if (!seen) v.withheld = true;
        return seen;
      },
      phases: (ps) => (Array.isArray(ps) ? ps.map((ph) => {
        if (!isObj(ph) || !isObj(ph.starts)) return ph;
        if (ph.starts.when_subject && !v.subject(ph.starts.when_subject)) {
          const { when_subject, ...starts } = ph.starts;
          return { ...ph, starts };
        }
        /* R35, R38: an obligation the viewer may not see is withheld whole, as an unseen matter is. */
        if (ph.starts.when_duty && !v.duty(ph.starts.when_duty.duty)) {
          const { when_duty, ...starts } = ph.starts;
          return { ...ph, starts };
        }
        return ph;
      }) : ps),
    };
    return v;
  }

  /* ===================================================================== *
   * THE SHARED REFUSALS OF AN ACT
   * ===================================================================== */

  /** R1, R4, R20, R24: the plan's own acts are a named member's. */
  #member(author) { return isMachine(author) ? machineCannotPlan() : null; }
  /** R9, R11: an option is added, revised or adopted by a named member. */
  #optionMember(author) {
    /* DEC-49 REGION is-option-member */
    if (isMachine(author))
      return refusal("MACHINE_CANNOT_ADD_OPTION", "an option is added, revised or adopted by a named member; a machine "
        + "proposes (op=optionpropose) and never adds. Nothing was written.");
    /* END DEC-49 REGION is-option-member */
    return null;
  }
  /* NO_SUCH_PLAN, PLAN_CLOSED and the joined fence, in that order; `{p}` or a refusal. */
  #openPlan(id, author, viewer, act) {
    const p = this.#plan(id, viewer);
    if (!p) return { r: noSuchPlan(id) };
    if (p.state === "closed") return { r: refusePlanClosed(p.id) };
    const fence = this.membership.projectAuthority(p.project, author, "joined", act);
    if (fence) return { r: fence };
    return { p };
  }

  /** R1, R3, R4: the subjects named, judged stage by stage across the list (malformed, unseen, of the project, live,
   *  free), so two faults at once answer the earlier code. `{items: [{subject, key}]}` or a refusal. */
  #subjects(project, list, viewer, { plan = null } = {}) {
    if (!Array.isArray(list) || !list.length || list.length > SUBJECTS_MAX)
      return refuseNoSubject(`a plan is about 1 to ${SUBJECTS_MAX} matters. Nothing was written.`,
        Array.isArray(list) ? list.length : null);
    const items = [];
    const keys = new Set();
    for (let i = 0; i < list.length; i++) {
      const s = normSubject(list[i]);
      const key = s ? subjectKey(s) : null;
      if (!s || keys.has(key))
        return refuseMalformed(s ? localize("action-plans.index.matter_named_twice", "matter {i} is named twice. Nothing was written.", { i })
          : localize("action-plans.index.matter_is_neither", "matter {i} is neither {kind: inquiry, inquiry} nor {kind: outcome, determination, standard}. Nothing was written.", { i }), i);
      keys.add(key);
      items.push({ subject: s, key });
    }
    const facts = [];
    for (let i = 0; i < items.length; i++) {
      const s = items[i].subject;
      if (s.kind === "inquiry") {
        const f = this.#inquiryFacts(s.inquiry, viewer);
        if (!f) return refuseNoSuchInquiry(s.inquiry, { index: i });
        facts.push(f);
      } else {
        const d = this.#determination(s.determination, viewer);
        if (!d) return noSuchDetermination(s.determination, { index: i });
        if (!(Array.isArray(d.outcomes) ? d.outcomes : []).some((o) => o && o.standard === s.standard))
          return refuseMalformed(`matter ${i} names a standard that determination does not measure. Nothing was written.`, i);
        facts.push(d);
      }
    }
    for (let i = 0; i < items.length; i++) {
      const s = items[i].subject;
      const mine = s.kind === "inquiry" ? this.#inquiryOfProject(s.inquiry, project) : facts[i].project === project;
      /* DEC-49 REGION is-subject-of-project */
      if (!mine)
        return refusal("SUBJECT_NOT_OF_PROJECT", s.kind === "inquiry"
          ? `matter ${i}: the project does not draw on that question. Nothing was written.`
          : `matter ${i}: that determination was made by another project. Nothing was written.`, { index: i });
      /* END DEC-49 REGION is-subject-of-project */
    }
    for (let i = 0; i < items.length; i++) {
      const s = items[i].subject;
      const live = s.kind === "inquiry" ? !CLOSED_INQUIRY_STATES.includes(facts[i].state) : facts[i].live === true;
      /* DEC-49 REGION is-subject-live */
      if (!live)
        return refusal("SUBJECT_NOT_LIVE", s.kind === "inquiry"
          ? `matter ${i}: the question is ${facts[i].state}, no longer open. Nothing was written.`
          : `matter ${i}: the determination has been superseded. Nothing was written.`,
          { index: i, ...(s.kind === "outcome" ? { superseded_by: this.#determination(facts[i].superseded_by, viewer) ? facts[i].superseded_by : null } : {}) });
      /* END DEC-49 REGION is-subject-live */
    }
    for (let i = 0; i < items.length; i++) {
      const held = this.#one(`SELECT s.plan_id FROM plan_subjects s JOIN plans p ON p.plan_id = s.plan_id
                              WHERE s.skey=? AND s.removed_seq IS NULL AND p.project_id=? AND p.state<>'closed'
                              ORDER BY s.plan_id LIMIT 1`, items[i].key, project);
      /* DEC-49 REGION is-subject-free */
      if (held)
        return refusal("SUBJECT_IN_ACTIVE_PLAN", localize("action-plans.index.matter_i_is_already_in", "matter {i} is already in the open plan {plan_id} of this project. Nothing was written.", { i: String(i), plan_id: String(held.plan_id) }), { index: i, plan: held.plan_id, ...(plan && held.plan_id === plan ? { this_plan: true } : {}) });
      /* END DEC-49 REGION is-subject-free */
    }
    return { items };
  }

  /** R9, R10, R12: an option's fields, judged in R9's order after the act's own refusals. `{fields}` or a refusal. */
  #optionFields(a, p, viewer) {
    const summary = typeof a.summary === "string" ? a.summary.trim() : "";
    /* DEC-49 REGION is-option-summary */
    if (!summary || summary.length > SUMMARY_MAX)
      return refusal("OPTION_NO_SUMMARY", `an option has a summary of 1 to ${SUMMARY_MAX} characters. Nothing was written.`,
        { max: SUMMARY_MAX });
    /* END DEC-49 REGION is-option-summary */
    const detail = a.detail === undefined || a.detail === null ? null : String(a.detail);
    /* DEC-49 REGION is-option-detail */
    if (detail !== null && detail.length > DETAIL_MAX)
      return refusal("OPTION_DETAIL_TOO_LONG", `an option's detail is at most ${DETAIL_MAX} characters; this is `
        + `${detail.length}. Nothing was written.`, { max: DETAIL_MAX, length: detail.length });
    /* END DEC-49 REGION is-option-detail */
    /* DEC-49 REGION is-option-category */
    if (!CATEGORIES.includes(a.category))
      return refusal("CATEGORY_UNKNOWN", `a category is one of ${CATEGORIES.join(", ")}. Nothing was written.`,
        { categories: CATEGORIES });
    /* END DEC-49 REGION is-option-category */
    const held = new Map(this.#subjectsOf(p.id).map((s) => [s.key, s.subject]));
    const named = Array.isArray(a.subjects) ? a.subjects : [];
    const subjects = [];
    let foreign = null;
    for (const x of named) {
      const s = typeof x === "string" ? held.get(x) : normSubject(x);
      if (!s || !held.has(subjectKey(s))) { foreign = x; break; }
      if (!subjects.some((y) => subjectKey(y) === subjectKey(s))) subjects.push(s);
    }
    /* DEC-49 REGION is-option-subject */
    if (!subjects.length || foreign !== null)
      return refusal("OPTION_NO_SUBJECT", foreign !== null ? "the option names a matter the plan is not about. Nothing was written."
        : "an option serves at least one of the plan's matters. Nothing was written.");
    /* END DEC-49 REGION is-option-subject */
    let addressee = null;
    if (a.addressee !== undefined && a.addressee !== null) {
      /* DEC-49 REGION is-option-addressee */
      const empty = addresseeEmptyFields(a.addressee);
      if (empty.length)
        return refusal("ADDRESSEE_INCOMPLETE", localize("action-plans.index.addressee_left_part_empty", "an addressee's {empty} was left empty; state it. Nothing was written.",
          { empty: empty.join(" and ") }), { empty });
      if (!addresseeArm(a.addressee))
        return refusal("ADDRESSEE_REFUSED", "an addressee is {state: named, kind?: office, role, body}, {state: named, "
          + "kind: press | organisation | group, role, organisation} or {state: audience, description}; never a private "
          + "individual. Nothing was written.");
      /* END DEC-49 REGION is-option-addressee */
      addressee = addresseeOf(a.addressee);
    }
    const dates = [];
    if (a.dates !== undefined && a.dates !== null) {
      const list = Array.isArray(a.dates) ? a.dates : null;
      const bad = !list || list.length > DATES_MAX
        || list.some((d) => !isObj(d) || !isDay(d.date) || !isLine(d.basis, NOTE_MAX));
      /* DEC-49 REGION is-option-date */
      if (bad)
        return refusal("DATE_REFUSED", localize("action-plans.index.regulated_dates_list", "regulated dates are a list of at most {max} {date: YYYY-MM-DD, basis}, each basis naming the statute, order or commitment that sets it. Nothing was written.", { max: DATES_MAX }));
      /* END DEC-49 REGION is-option-date */
      for (const d of list) dates.push({ date: d.date, basis: d.basis });
    }
    const t = a.tier;
    const given = t !== undefined && t !== null;
    const tier = !given ? undefined : /^[123]$/.test(String(t)) ? Number(t) : t;
    /* DEC-49 REGION is-option-tier */
    if ((given && a.category !== "legal") || (given && !TIERS.includes(tier)))
      return refusal("TIER_REFUSED", a.category !== "legal" ? "a tier is stated only on a legal option. Nothing was written."
        : "a tier is 1, 2, 3 or undetermined. Nothing was written.", { tiers: TIERS });
    /* END DEC-49 REGION is-option-tier */
    const lobbying = a.lobbying === true;
    let enforces = null;
    if (a.enforces !== undefined && a.enforces !== null) enforces = this.#enforces(a.enforces, held, viewer);
    /* DEC-49 REGION is-lobbying-enforces */
    if ((lobbying && !enforces) || (a.enforces !== undefined && a.enforces !== null && !enforces))
      return refusal("LOBBYING_NO_REQUIREMENT", "an option marked lobbying names, in enforces, the standard you can read or "
        + "the determined matter of the plan whose requirement it seeks enforced or restored. Nothing was written.");
    /* END DEC-49 REGION is-lobbying-enforces */
    const keys = refuseKeys(a);
    if (keys) return keys;
    return { fields: { summary, detail, category: a.category, subjects, addressee, dates,
                       tier: a.category === "legal" ? (given ? tier : "undetermined") : null, lobbying, enforces } };
  }
  /* R12: `enforces` names a standard the reader can read, or a determined subject of the plan; null otherwise. */
  #enforces(x, held, viewer) {
    if (typeof x === "string" && held.has(x)) return held.get(x).kind === "outcome" ? { subject: held.get(x) } : null;
    if (isObj(x)) {
      const s = normSubject(x);
      return s && s.kind === "outcome" && held.has(subjectKey(s)) ? { subject: s } : null;
    }
    if (typeof x !== "string" || !isToken(x)) return null;
    const r = this.standards.standardRead({ id: x, viewer });
    return ok(r) ? { standard: x } : null;
  }

  /* ===================================================================== *
   * THE WRITE (R2, R27): every act is one promotion of the plan's document through `promotion`
   * ===================================================================== */

  #snap() { return `${this.now().replace(/[-:]/g, "").replace(/\.\d+/, "")}_${hex8()}`; }

  #append(p, entry, { state, blurb }) {
    const head = this.record.head(p.id);
    const text = this.#text(p.id);
    if (!head || text === null) return noSuchPlan(p.id);
    const seq = logOf(text).length + 1;
    const next = appendEntry(text, { entry, seq, state, fromState: head.currentState, blurb });
    /* DEC-49 REGION is-plan-spliceable */
    if (next === null)
      return refusal("UNSPLICEABLE_PLAN", "the plan's document cannot be extended in place. Nothing was written.");
    /* END DEC-49 REGION is-plan-spliceable */
    const carried = (this.record.livePaths(p.id) || []).filter((x) => x !== "bundle.md").map((path) => {
      const f = this.record.readFile(p.id, path);
      return typeof f.text === "string" ? { path, text: f.text, sha256: f.sha256 }
                                        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes };
    });
    const fm = parseFm(next) || {};
    const r = this.promotion.promote({ bundleId: p.id, base: head.bundleSha, snapKey: this.#snap(), author: entry.author,
      files: [{ path: "bundle.md", text: next }, ...carried],
      meta: { object_type: ACTION_PLAN, title: fm.title, current_state: fm.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: fm.last_updated },
      [ACT]: true });
    return r.ok ? { ok: true, seq } : r;
  }

  /* ---- the registered step (promotion R39) ---- */

  /** R24, R27: a plan's document changes only through this module's acts, never by a machine, and its log only grows;
   *  a replay restores one as it was. R21: a project's `work_kinds`. */
  check(c) {
    const type = normalizeType(c.promotedType);
    const headType = c.head ? normalizeType(c.head.type) : null;
    if (type === "project" || headType === "project") return this.#workKindsCheck(c);
    if (type !== ACTION_PLAN && headType !== ACTION_PLAN) return null;
    if (c.replay) return null;
    /* DEC-49 REGION is-plan-doc-member */
    if (isMachine(c.author))
      return refusal("MACHINE_CANNOT_WRITE_PLAN", "an action plan is written only by a member's act; a machine proposes "
        + "and never acts. Nothing was written.");
    /* END DEC-49 REGION is-plan-doc-member */
    /* DEC-49 REGION is-plan-doc-act */
    if (!c.pkg || c.pkg[ACT] !== true)
      return refusal("PLAN_BY_ACT_ONLY", "an action plan changes only through its acts, so its log and its tables never "
        + "disagree. Nothing was written.");
    /* END DEC-49 REGION is-plan-doc-act */
    if (c.head) {
      const held = logSection(this.#text(c.bundleId)) || "";
      const now = logSection(c.bundleMd && c.bundleMd.text) || "";
      /* DEC-49 REGION is-plan-append-only */
      if (!now.startsWith(held))
        return refusal("PLAN_HISTORY_REWRITTEN", "an action plan's log is append-only. Nothing was written.");
      /* END DEC-49 REGION is-plan-append-only */
    }
    return null;
  }

  /** R21: a project document's `work_kinds`, from the vocabulary, set or changed by an owner only. A replay is not
   *  asked; a project's creation is its creator's, who becomes its owner in the same act. */
  #workKindsCheck(c) {
    if (c.replay) return null;
    const md = c.bundleMd && typeof c.bundleMd.text === "string" ? c.bundleMd.text
      : ((c.files || []).find((f) => f && f.path === "bundle.md") || {}).text;
    const next = (c.docFm && typeof c.docFm === "object" ? c.docFm : parseFm(md)) || {};
    const heldFm = c.head ? parseFm(this.#text(c.bundleId)) || {} : {};
    const norm = (v) => JSON.stringify(v === undefined || v === null ? null : v);
    if (norm(next.work_kinds) === norm(heldFm.work_kinds)) return null;
    /* DEC-49 REGION is-work-kind-member */
    if (isMachine(c.author))
      return refusal("MACHINE_CANNOT_SET_WORK_KIND", "a project's kinds of work are set by an owner of the project; a "
        + "machine credential cannot set or change them. Nothing was written.");
    /* END DEC-49 REGION is-work-kind-member */
    const kinds = next.work_kinds;
    const bad = kinds !== undefined && kinds !== null
      && (!Array.isArray(kinds) || kinds.some((k) => !WORK_KINDS.includes(k)));
    /* DEC-49 REGION is-work-kind-known */
    if (bad)
      return refusal("WORK_KIND_UNKNOWN", `work_kinds is a list drawn from ${WORK_KINDS.join(", ")}. Nothing was written.`,
        { kinds: WORK_KINDS });
    /* END DEC-49 REGION is-work-kind-known */
    if (c.head) {
      const fence = this.membership.projectAuthority(c.bundleId, c.author, "owner", "setting work_kinds");
      if (fence) return fence;
    }
    return null;
  }

  /** R27: the tables, projected from the promoted document in the promotion's transaction. */
  project(c) {
    if (normalizeType(c.promotedType) !== ACTION_PLAN || !c.bundleMd || typeof c.bundleMd.text !== "string") return null;
    const id = c.bundleId, text = c.bundleMd.text;
    const log = logOf(text).filter((x) => !x.unreadable);
    const heldRow = this.#one(`SELECT log_len FROM plans WHERE plan_id=?`, id);
    const from = heldRow ? heldRow.log_len : 0;
    for (const x of log.filter((y) => y.seq > from)) this.#apply(id, x);
    const fm = parseFm(text) || {};
    /* R40, R46 (a): the plan's state is its document's `current_state` (open, paused or closed), which each act writes
       with its Plan Log entry; it is never derived from the log. */
    this.sql.exec(`UPDATE plans SET state=?, log_len=? WHERE plan_id=?`, String(fm.current_state ?? "open"), log.length, id);
    return null;
  }

  #apply(id, x) {
    const reason = typeof x.reason === "string" ? x.reason : null;
    const { seq, ...body } = x;
    this.sql.exec(`INSERT OR REPLACE INTO plan_history (plan_id, seq, kind, author, at, reason, entry_json) VALUES (?,?,?,?,?,?,?)`,
      id, seq, String(x.kind), String(x.author ?? ""), String(x.at ?? ""), reason, JSON.stringify(body));
    const addSubject = (s, ord) => this.sql.exec(`INSERT OR REPLACE INTO plan_subjects (plan_id, seq, ord, skey, subject_json,
        added_by, added_at, removed_seq) VALUES (?,?,?,?,?,?,?,NULL)`, id, seq, ord, s.key, JSON.stringify(s.subject), x.author, x.at);
    switch (x.kind) {
      case "open":
        this.sql.exec(`INSERT OR REPLACE INTO plans (plan_id, project_id, title, state, opened_by, opened_at, log_len)
                       VALUES (?,?,?,?,?,?,0)`, id, String(x.project), String(x.title), "open", x.author, x.at);
        (x.subjects || []).forEach((s, i) => addSubject(s, i));
        break;
      case "subject_add": addSubject({ key: x.key, subject: x.subject }, 0); break;
      case "subject_remove":
        this.sql.exec(`UPDATE plan_subjects SET removed_seq=? WHERE plan_id=? AND skey=? AND removed_seq IS NULL`, seq, id, x.key);
        break;
      case "option_add": {
        const ord = (this.#one(`SELECT COUNT(*) AS n FROM plan_options WHERE plan_id=?`, id) || { n: 0 }).n;
        this.sql.exec(`INSERT OR REPLACE INTO plan_options (plan_id, option_id, ord, fields_json, disposition, proposal_id,
                       created_by, created_at) VALUES (?,?,?,?,'open',?,?,?)`,
          id, x.option, ord, JSON.stringify(x.fields), x.proposal ?? null, x.author, x.at);
        this.sql.exec(`INSERT OR REPLACE INTO plan_option_revisions (plan_id, option_id, rev, seq, fields_json, reason, author, at)
                       VALUES (?,?,1,?,?,NULL,?,?)`, id, x.option, seq, JSON.stringify(x.fields), x.author, x.at);
        if (x.proposal)
          this.sql.exec(`UPDATE plan_option_proposals SET adopted_option=?, adopted_by=?, adopted_at=? WHERE proposal_id=?`,
            x.option, x.author, x.at, x.proposal);
        break;
      }
      case "option_revise": {
        const rev = (this.#one(`SELECT MAX(rev) AS r FROM plan_option_revisions WHERE plan_id=? AND option_id=?`, id, x.option) || {}).r || 0;
        this.sql.exec(`UPDATE plan_options SET fields_json=? WHERE plan_id=? AND option_id=?`, JSON.stringify(x.fields), id, x.option);
        this.sql.exec(`INSERT OR REPLACE INTO plan_option_revisions (plan_id, option_id, rev, seq, fields_json, reason, author, at)
                       VALUES (?,?,?,?,?,?,?,?)`, id, x.option, rev + 1, seq, JSON.stringify(x.fields), reason, x.author, x.at);
        break;
      }
      case "dispose":
        for (const o of x.options || []) {
          const rem = x.disposition === "chosen" ? (x.reminders || {})[o] ?? [] : null;
          this.sql.exec(`UPDATE plan_options SET disposition=?, reminders_json=?, chosen_by=? WHERE plan_id=? AND option_id=?`,
            x.disposition, rem === null ? null : JSON.stringify(rem), x.disposition === "chosen" ? x.author : null, id, o);
        }
        break;
      case "scenario_set": {
        const v = (this.#one(`SELECT MAX(version) AS v FROM plan_scenarios WHERE plan_id=? AND scenario=?`, id, x.scenario) || {}).v || 0;
        this.sql.exec(`INSERT OR REPLACE INTO plan_scenarios (plan_id, scenario, version, seq, name, phases_json, author, at)
                       VALUES (?,?,?,?,?,?,?,?)`, id, x.scenario, v + 1, seq, x.name, JSON.stringify(x.phases), x.author, x.at);
        break;
      }
      case "checkpoint":
        this.sql.exec(`INSERT OR REPLACE INTO plan_checkpoints (plan_id, scenario, version, phase, seq, judged, note, author, at)
                       VALUES (?,?,?,?,?,?,?,?,?)`, id, x.scenario, x.version, x.phase, seq, x.judged, x.note ?? null, x.author, x.at);
        break;
      case "start":
        this.sql.exec(`UPDATE plan_options SET action_id=?, started_by=?, started_at=? WHERE plan_id=? AND option_id=?`,
          x.action, x.author, x.at, id, x.option);
        break;
      case "close":
        this.sql.exec(`UPDATE plans SET closed_by=?, closed_at=?, close_reason=? WHERE plan_id=?`, x.author, x.at, reason, id);
        break;
      default: break;
    }
  }

  /* ===================================================================== *
   * THE ACTS
   * ===================================================================== */

  /** R1–R3: open a plan in a project, about one or more matters. */
  planOpen(args = {}) {
    const { project, subjects, title, author, viewer } = args;
    const m = this.#member(author);
    if (m) return m;
    /* DEC-49 REGION is-plan-titled */
    if (!isLine(title, TITLE_MAX))
      return refusal("PLAN_NO_TITLE", `a plan's title is 1 to ${TITLE_MAX} characters with no quotation mark, backslash `
        + "or line break. Nothing was written.", { max: TITLE_MAX });
    /* END DEC-49 REGION is-plan-titled */
    const h = typeof project === "string" && project ? this.record.head(project) : null;
    if (h && normalizeType(h.type) === "project") {
      const seen = this.membership.existenceAct(project, viewer);
      if (seen) return seen;
    }
    if (!h || normalizeType(h.type) !== "project" || !this.#sees(project, viewer))
      return noSuchProject(typeof project === "string" && project ? project : null);
    const fence = this.membership.projectAuthority(project, author, "joined", "planOpen");
    if (fence) return fence;
    const s = this.#subjects(project, subjects, viewer);
    if (!s.items) return s;
    const at = this.now();
    const r = this.record.transact(() => {
      const id = planId(this.record.allocId("PLN", at.slice(0, 4)).id);
      const entry = { kind: "open", project, title: title.trim(), subjects: s.items, author, at };
      const text = planDoc({ id, project, title: title.trim(), author, at, entry });
      const fm = parseFm(text) || {};
      const p = this.promotion.promote({ bundleId: id, base: null, snapKey: this.#snap(), author,
        files: [{ path: "bundle.md", text }],
        meta: { object_type: ACTION_PLAN, title: fm.title, current_state: fm.current_state, created: fm.created,
                last_updated: fm.last_updated }, [ACT]: true });
      return p.ok ? { ok: true, id } : p;
    });
    if (!r.ok) return r;
    return { ok: true, id: r.id, project, title: title.trim(), state: "open", opened_by: author, at,
             subjects: s.items.map((x) => ({ subject: x.subject, ...this.#support(x.subject, project, viewer) })) };
  }

  /** R4: add a matter to an open plan. */
  planSubjectAdd(args = {}) { return this.#subjectAct("add", args); }
  /** R4: remove a matter from an open plan; options serving it keep it and read `subject_removed` (R8). */
  planSubjectRemove(args = {}) { return this.#subjectAct("remove", args); }
  #subjectAct(kind, { plan, subject, reason, author, viewer } = {}) {
    const m = this.#member(author);
    if (m) return m;
    const o = this.#openPlan(plan, author, viewer, kind === "add" ? "planSubjectAdd" : "planSubjectRemove");
    if (o.r) return o.r;
    const p = o.p;
    const bad = refuseReason(reason, true);
    if (bad) return bad;
    let entry;
    if (kind === "add") {
      const s = this.#subjects(p.project, [subject], viewer, { plan: p.id });
      if (!s.items) return s;
      entry = { kind: "subject_add", subject: s.items[0].subject, key: s.items[0].key };
    } else {
      const s = normSubject(subject);
      const held = this.#subjectsOf(p.id);
      const key = s ? subjectKey(s) : typeof subject === "string" ? subject : null;
      if (!key || !held.some((x) => x.key === key))
        return refuseMalformed("the plan is not about that matter, so it cannot be removed. Nothing was written.", 0);
      if (held.length === 1)
        return refuseNoSubject(localize("action-plans.index.a_plan_is_about_at", "a plan is about at least one matter, and that is its last. Close the plan instead. Nothing was written."), 0);
      entry = { kind: "subject_remove", key, subject: held.find((x) => x.key === key).subject };
    }
    Object.assign(entry, { reason: reason.trim(), author, at: this.now() });
    const w = this.#append(p, entry, { blurb: kind === "add" ? "Matter added" : "Matter removed" });
    if (!w.ok) return w;
    const served = kind === "remove" ? this.#options(p.id).filter((x) => (x.fields.subjects || []).some((y) => subjectKey(y) === entry.key))
      .map((x) => x.id) : [];
    return { ok: true, plan: p.id, [kind === "add" ? "added" : "removed"]: entry.subject, reason: entry.reason, author,
             at: entry.at, ...(kind === "add" ? { support: this.#support(entry.subject, p.project, viewer) } : { options_marked: served }) };
  }

  /** R9: add an option. */
  optionAdd(args = {}) {
    const { plan, author, viewer } = args;
    const m = this.#optionMember(author);
    if (m) return m;
    const o = this.#openPlan(plan, author, viewer, "optionAdd");
    if (o.r) return o.r;
    const f = this.#optionFields(args, o.p, viewer);
    if (!f.fields) return f;
    return this.#addOption(o.p, f.fields, { author });
  }

  #addOption(p, fields, { author, proposal = null, offer = null }) {
    const n = (this.#one(`SELECT COUNT(*) AS n FROM plan_options WHERE plan_id=?`, p.id) || { n: 0 }).n + 1;
    const option = `opt-${n}`;
    const entry = { kind: "option_add", option, fields, ...(proposal ? { proposal } : {}), ...(offer ? { offer } : {}),
                    author, at: this.now() };
    const w = this.#append(p, entry, { blurb: proposal || offer ? "Option adopted" : "Option added" });
    if (!w.ok) return w;
    return { ok: true, plan: p.id, option, fields, disposition: "open", ...(proposal ? { proposal } : {}),
             ...(offer ? { offer } : {}), author, at: entry.at };
  }

  /** R9: revise an option, with a reason; earlier revisions stay readable. */
  optionRevise(args = {}) {
    const { plan, option, reason, author, viewer } = args;
    const m = this.#optionMember(author);
    if (m) return m;
    const o = this.#openPlan(plan, author, viewer, "optionRevise");
    if (o.r) return o.r;
    const held = this.#option(o.p.id, option);
    if (!held) return refuseNoSuchOption(option);
    const bad = refuseReason(reason, true);
    if (bad) return bad;
    const cur = held.fields;
    const pick = (k) => (Object.prototype.hasOwnProperty.call(args, k) ? args[k] : cur[k]);
    const merged = { ...args, summary: pick("summary"), detail: pick("detail"), category: pick("category"),
      subjects: Object.prototype.hasOwnProperty.call(args, "subjects") ? args.subjects : cur.subjects,
      addressee: pick("addressee"), dates: pick("dates"),
      tier: Object.prototype.hasOwnProperty.call(args, "tier") ? args.tier
        : (pick("category") === "legal" && cur.tier !== "undetermined" ? cur.tier : undefined),
      lobbying: pick("lobbying"),
      enforces: Object.prototype.hasOwnProperty.call(args, "enforces") ? args.enforces
        : cur.enforces ? (cur.enforces.standard ?? cur.enforces.subject) : undefined };
    const f = this.#optionFields(merged, o.p, viewer);
    if (!f.fields) return f;
    const entry = { kind: "option_revise", option: held.id, fields: f.fields, reason: reason.trim(), author, at: this.now() };
    const w = this.#append(o.p, entry, { blurb: "Option revised" });
    if (!w.ok) return w;
    return { ok: true, plan: o.p.id, option: held.id, fields: f.fields, reason: entry.reason, author, at: entry.at };
  }

  /** R11, R31: a proposal, by any credential, stored apart from the options. A machine's names its planning run. Two
   *  stamps, neither from the body: `proposer` names the caller for the label and says whether it is machine work;
   *  `principal` is the caller as a run's principal (`<principal>/<tokenId>`), compared with the run's own (N432). */
  async optionPropose(args = {}) {
    const { plan, why, run, sources, proposer, principal, viewer } = args;
    const who = str(proposer);
    /* DEC-49 REGION is-proposer-stamped */
    if (!who)
      return refusal("PROPOSAL_NO_PROPOSER", localize("action-plans.index.a_proposal_names_who_made", "a proposal names who made it, and this one came with no stamped caller. Nothing was written."));
    /* END DEC-49 REGION is-proposer-stamped */
    /* R55 (T53; agent-steps R54): a call carrying an `idem` its principal has already sent answers the first call's
       answer verbatim, `repeated: true`, and stores nothing; it is asked before anything else, since the step that
       re-runs after a stop may find its run stopped. Without an `idem` the call is R11's as before. */
    const idem = typeof args.idem === "string" && args.idem.trim() ? args.idem.trim() : null;
    const idemBy = str(principal) || who;
    if (idem) { const first = this.#repeatedProposal(idemBy, idem); if (first) return first; }
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan);
    if (p.state === "closed") return refusePlanClosed(p.id);
    const machine = isMachineIdentity(who);
    let gate = null;
    if (machine) {
      gate = this.#runGate(run, p, principal, viewer);
      if (!gate.ok) return gate;
    }
    const f = this.#optionFields(args, p, viewer);
    if (!f.fields) return f;
    /* DEC-49 REGION is-proposal-why */
    if (typeof why !== "string" || !why.trim() || why.length > WHY_MAX)
      return refusal("PROPOSAL_WHY_REFUSED", `a proposal says why it is offered, in 1 to ${WHY_MAX} characters. Nothing was written.`,
        { max: WHY_MAX });
    /* END DEC-49 REGION is-proposal-why */
    /* R56 (T53; agent-steps R56): who produced it, the labels of the conversations as agent-model answered them, kept
       deduplicated in order; absent or null is none. A machine's proposal stores it, a member's own stores null. */
    const producedBy = producedByOf(args.produced_by);
    /* DEC-49 REGION is-proposal-produced-by */
    if (producedBy === undefined)
      return refusal("PLAN_PRODUCED_BY_MALFORMED", localize("action-plans.index.produced_by_malformed", "produced_by is not a list of the labels of the conversations that produced this proposal, each holding only a label's fields ({fields}). Nothing was written.", { fields: String(AiRuns.LABEL_FIELDS.join(", ")) }),
        { fields: [...AiRuns.LABEL_FIELDS] });
    /* END DEC-49 REGION is-proposal-produced-by */
    let srcs = null;
    if (machine) {
      const s = this.#sources(sources, viewer);
      if (!s.ok) return s;
      srcs = s.sources;
    }
    let skill = null;
    if (machine) {
      try { const r = await this.aiRuns.read({ run: gate.run.run, viewer }); skill = r && r.session && r.session.principal ? r.session.principal.skill ?? null : null; }
      catch { skill = null; }
    }
    const at = this.now();
    const r = this.record.transact(() => {
      /* R31: the run is asked again inside the transaction, so a bound reached meanwhile is not passed. */
      if (idem) { const first = this.#repeatedProposal(idemBy, idem); if (first) return { ok: true, first }; }
      if (machine) { const again = this.#runGate(run, p, principal, viewer); if (!again.ok) return again; }
      const n = (this.#one(`SELECT COUNT(*) AS n FROM plan_option_proposals WHERE plan_id=?`, p.id) || { n: 0 }).n + 1;
      const id = `${p.id}/proposal/${n}`;
      const ord = machine ? (this.#one(`SELECT COUNT(*) AS n FROM plan_option_proposals WHERE run=?`, gate.run.run) || { n: 0 }).n + 1 : null;
      this.sql.exec(`INSERT INTO plan_option_proposals (proposal_id, plan_id, n, fields_json, why, proposer, machine, run,
                     skill_version, sources_json, run_ord, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, p.id, n, JSON.stringify(f.fields), why.trim(), who, machine ? 1 : 0, machine ? gate.run.run : null, skill,
        srcs ? JSON.stringify(srcs) : null, ord, at);
      if (machine) { const c = this.aiRuns.consumeBound(gate.run.run, "proposals", 1); if (c) return c; }
      if (machine && producedBy !== null)
        this.sql.exec(`UPDATE plan_option_proposals SET produced_by_json=? WHERE proposal_id=?`, JSON.stringify(producedBy), id);
      const answer = { ok: true, plan: p.id, proposal: this.#proposalView(this.#proposalRow(id)), says: PROPOSAL_SAYS };
      if (idem)
        this.sql.exec(`UPDATE plan_option_proposals SET idem=?, idem_by=?, answer_json=? WHERE proposal_id=?`,
          idem, idemBy, JSON.stringify(answer), id);
      return { ok: true, answer };
    });
    if (!r.ok) return r;
    return r.first ?? r.answer;
  }
  /* R55: the first answer to an `idem` this principal sent, verbatim with `repeated: true`, or null. */
  #repeatedProposal(by, idem) {
    const row = this.#one(`SELECT answer_json FROM plan_option_proposals WHERE idem_by=? AND idem=?`, by, idem);
    if (!row) return null;
    return { ...unjson(row.answer_json, {}), repeated: true };
  }

  /* R31: the run a machine's proposal names, in R31's order; `{ok, run}` or a refusal. `caller` is the `principal`
     stamp (R11), never the `proposer` label: an agent's label (`class:ai/<tokenId>`) is not its run's principal. */
  #runGate(run, p, caller, viewer) {
    const r = typeof run === "string" && run.trim() ? this.aiRuns.runFor(run.trim(), viewer) : null;
    /* DEC-49 REGION is-proposal-run */
    if (!r)
      return refusal("PROPOSAL_NO_RUN", "a machine's proposal names the planning run it was made under, one this caller "
        + "can see. Nothing was written.", { run: typeof run === "string" ? run : null });
    /* END DEC-49 REGION is-proposal-run */
    /* DEC-49 REGION is-proposal-run-running */
    if (r.status !== "running")
      return refusal("PROPOSAL_RUN_NOT_RUNNING", `run ${r.run} is ${r.status}, not running. Nothing was written.`,
        { run: r.run, status: r.status });
    /* END DEC-49 REGION is-proposal-run-running */
    if (r.mode !== "plan" || r.plan !== p.id) return refuseRunOtherPlan(r.run);
    const np = runPrincipalGate({ caller: str(caller), principal: r.principal_plane, act: "proposing an option under a planning run" });
    if (np) return np;
    const b = this.aiRuns.boundOf(r.run, "proposals");
    /* DEC-49 REGION is-proposal-bound */
    if (!b || b.consumed >= b.allowed)
      return refusal("PROPOSAL_BOUND_REACHED", `run ${r.run} has made ${b ? b.consumed : 0} of the ${b ? b.allowed : 0} `
        + "proposals it declared. Nothing was written.", { run: r.run, allowed: b ? b.allowed : 0, consumed: b ? b.consumed : 0 });
    /* END DEC-49 REGION is-proposal-bound */
    return { ok: true, run: r };
  }

  /* R31: what a machine's proposal rests on, each something the viewer can see. `{ok, sources}` or a refusal. */
  #sources(list, viewer) {
    const named = Array.isArray(list) ? list : [];
    let hidden = null;
    for (const s of named) {
      if (!this.#sourceSeen(s, viewer)) { hidden = s; break; }
    }
    /* DEC-49 REGION is-proposal-sourced */
    if (!named.length || named.length > SOURCES_MAX || hidden !== null)
      return refusal("PROPOSAL_NO_SOURCE", !named.length || named.length > SOURCES_MAX
        ? `a machine's proposal names 1 to ${SOURCES_MAX} sources it rests on. Nothing was written.`
        : localize("action-plans.index.a_source_named_is_not", "a source named is not a finding, determination, standard, consequence, plan or option this caller can see. Nothing was written."), { max: SOURCES_MAX, ...(hidden !== null && typeof hidden === "string" ? { source: hidden.slice(0, 120) } : {}) });
    /* END DEC-49 REGION is-proposal-sourced */
    return { ok: true, sources: [...new Set(named)] };
  }
  #sourceSeen(s, viewer) {
    if (typeof s !== "string" || !s) return false;
    const m = /^(PLN-[^#]+)(?:#(opt-\d+))?$/.exec(s);
    if (m) {
      const p = this.#plan(m[1], viewer);
      return !!p && (!m[2] || !!this.#option(p.id, m[2]));
    }
    if (/^CONF-/.test(s)) return !!this.#determination(s, viewer);
    if (/^STD-/.test(s)) return ok(this.standards.standardRead({ id: s, viewer }));
    const h = this.record.head(s);
    if (!h || !["inquiry", "consequence"].includes(normalizeType(h.type))) return false;
    return viewer === null || viewer === undefined || this.membership.inSight(s, viewer);
  }

  #proposalRow(id) { return typeof id === "string" ? this.#one(`SELECT * FROM plan_option_proposals WHERE proposal_id=?`, id) : null; }
  /* R11, R32: a proposal as answered: labelled, with its why and sources; a machine's with its disclosure and the
     project's work_kinds as they stood when its run opened; never a score. Read through a plan (`see`, R35), a subject or
     source the viewer may not see is withheld whole; the proposer's own answer is given as stored. */
  #proposalView(r, see = null, viewer = null) {
    const machine = r.machine === 1;
    const kinds = machine ? this.#runRow(r.run) : null;
    const fields = unjson(r.fields_json, {});
    let sources = machine ? unjson(r.sources_json, []) : null;
    if (see && Array.isArray(sources)) {
      const kept = sources.filter((x) => this.#sourceSeen(x, viewer));
      if (kept.length !== sources.length) { see.withheld = true; sources = kept; }
    }
    return { id: r.proposal_id, plan: r.plan_id, ...(see ? see.fields(fields) : fields), why: r.why,
             label: proposalLabel(r.proposer, "plan_option"),
             produced_by: machine ? unjson(r.produced_by_json, null) : null,
             ...(machine ? { run: r.run, skill_version: r.skill_version ?? null, sources,
                             disclosure: DISCLOSURE(r.run, r.skill_version),
                             work_kinds: kinds && kinds.work_kinds_json !== null && kinds.work_kinds_json !== undefined
                               ? { state: "stated", kinds: unjson(kinds.work_kinds_json, []) }
                               : { state: "undetermined", says: localize("action-plans.says.project_work_kinds", "the project's work_kinds when this run opened were not recorded") } }
                         : {}),
             at: r.at, adopted: !!r.adopted_option,
             ...(r.adopted_option ? { adopted_option: r.adopted_option, adopted_by: r.adopted_by, adopted_at: r.adopted_at } : {}) };
  }
  #runRow(run) { return typeof run === "string" ? this.#one(`SELECT * FROM plan_runs WHERE run=?`, run) : null; }

  /** R11: a member adopts a proposal as an option, once. */
  optionAdopt(args = {}) {
    const { proposal, author, viewer } = args;
    const m = this.#optionMember(author);
    if (m) return m;
    if (args.offer !== undefined && args.offer !== null) return this.#adoptOffer(args);
    const row = this.#proposalRow(proposal);
    const p = row ? this.#plan(row.plan_id, viewer) : null;
    if (!row || !p)
      return refuseNoSuchProposal("no proposal answers to that id in a plan this caller may see. Nothing was written.",
        { proposal: typeof proposal === "string" ? proposal : null });
    if (p.state === "closed") return refusePlanClosed(p.id);
    const fence = this.membership.projectAuthority(p.project, author, "joined", "optionAdopt");
    if (fence) return fence;
    /* DEC-49 REGION is-proposal-once */
    if (row.adopted_option)
      return refusal("PROPOSAL_ADOPTED", `that proposal was adopted as ${row.adopted_option}. Nothing was written.`,
        { option: row.adopted_option });
    /* END DEC-49 REGION is-proposal-once */
    const base = unjson(row.fields_json, {});
    const merged = { ...base, enforces: base.enforces ? (base.enforces.standard ?? base.enforces.subject) : undefined,
                     tier: base.category === "legal" && base.tier !== "undetermined" ? base.tier : undefined };
    for (const k of Object.keys(args)) if (!["proposal", "author", "viewer", "plan"].includes(k)) merged[k] = args[k];
    const f = this.#optionFields(merged, p, viewer);
    if (!f.fields) return f;
    const r = this.#addOption(p, f.fields, { author, proposal: row.proposal_id });
    if (!r.ok) return r;
    return { ...r, ...this.#origin(this.#proposalRow(row.proposal_id)) };
  }
  /* R41: a member adopts one of a matter's standing offers as an option (R11's act): the offer's default words, which the
     member may change, through R9's fields. An offer the plan does not stand ready to make answers as an unknown
     proposal does. An offer may be adopted as often as a member chooses; the option records the offer it came from. */
  #adoptOffer(args) {
    const { plan, offer, author, viewer } = args;
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan);
    if (p.state === "closed") return refusePlanClosed(p.id);
    const fence = this.membership.projectAuthority(p.project, author, "joined", "optionAdopt");
    if (fence) return fence;
    const s = isObj(offer) ? (typeof offer.subject === "string" ? subjectOfKey(offer.subject) : normSubject(offer.subject)) : null;
    const held = s ? this.#subjectsOf(p.id).find((x) => x.key === subjectKey(s)) : null;
    const standing = held && OFFER_KINDS.includes(offer.kind) && this.#mayBeInfraction(held.subject, viewer)
      && (offer.kind !== "chance_to_fix" || this.#fixed(held.subject, viewer) !== true);
    if (!standing)
      return refuseNoSuchProposal("the plan stands ready to make no such offer: an offer names a matter of the plan that may "
        + "be an infraction, and document_infraction or chance_to_fix (while the matter is not fixed). Nothing was written.",
        { offer: isObj(offer) ? { kind: typeof offer.kind === "string" ? offer.kind.slice(0, 40) : null } : null });
    const merged = { summary: OFFER_WORDS[offer.kind].summary, category: OFFER_WORDS[offer.kind].category, subjects: [held.subject] };
    for (const k of Object.keys(args)) if (!["proposal", "offer", "author", "viewer", "plan"].includes(k)) merged[k] = args[k];
    const f = this.#optionFields(merged, p, viewer);
    if (!f.fields) return f;
    return this.#addOption(p, f.fields, { author, offer: { subject: held.subject, kind: offer.kind } });
  }

  /* R41: whether a matter may be an infraction: a suspected matter naming standards, or a determined outcome
     noncompliant or unclear. */
  #mayBeInfraction(s, viewer) {
    if (s.kind === "inquiry") return Array.isArray(s.standards) && s.standards.length > 0;
    const d = this.#determination(s.determination, viewer);
    const o = d && Array.isArray(d.outcomes) ? d.outcomes.find((x) => x && x.standard === s.standard) : null;
    return !!o && INFRACTION_OUTCOMES.includes(o.outcome);
  }
  /* R41: whether a determined matter is fixed (a standing cure, conformance R37); null when it cannot be read, which
     never withdraws the offer. A suspected matter is never fixed. */
  #fixed(s, viewer) {
    if (s.kind !== "outcome") return false;
    const c = this.conformance;
    if (typeof c.curesOf !== "function") return null;
    try {
      const r = c.curesOf({ determination: s.determination, standard: s.standard, viewer });
      if (!ok(r)) return null;
      /* conformance R37: per standard, `link` the standing cure or null; the ended links are apart. */
      return (Array.isArray(r.standards) ? r.standards : []).some((x) => x && x.standard === s.standard && isObj(x.link));
    } catch { return null; }
  }
  /* R41, R42: each option adopted from an offer, by option id, `{subject, kind}`; from the history. */
  #offerOptions(planId) {
    const out = new Map();
    for (const h of this.#rows(`SELECT entry_json FROM plan_history WHERE plan_id=? AND kind='option_add' ORDER BY seq`, planId)) {
      const e = unjson(h.entry_json, {});
      if (isObj(e.offer)) out.set(e.option, e.offer);
    }
    return out;
  }
  /* R41: the standing offers of each matter the viewer sees that may be an infraction, derived on read, never stored:
     `document_infraction` first, then `chance_to_fix` while the matter is not fixed, with `offered_again` after the
     latest later step on the matter. */
  #offers(p, subjects, held, viewer, see) {
    const adopted = this.#offerOptions(p.id);
    const out = [];
    for (const s of subjects) {
      if (!this.#mayBeInfraction(s.subject, viewer)) continue;
      const from = (kind) => held.filter((o) => { const f = adopted.get(o.id); return f && f.kind === kind && subjectKey(f.subject) === s.key; })
        .map((o) => ({ option: o.id, started: !!o.action }));
      const offers = [{ kind: "document_infraction", ...OFFER_WORDS.document_infraction, adopted: from("document_infraction") }];
      const fixed = this.#fixed(s.subject, viewer);
      if (fixed !== true) {
        const again = this.#laterStep(p, s.subject, held, viewer, see);
        offers.push({ kind: "chance_to_fix", ...OFFER_WORDS.chance_to_fix, adopted: from("chance_to_fix"),
                      ...(fixed === null && s.subject.kind === "outcome" ? { fixed: { state: "undetermined", says: localize("action-plans.says.whether_cure_stands", "whether a cure stands could not be read; the offer stands") } } : {}),
                      ...(again ? { offered_again: again } : {}) });
      }
      out.push({ subject: s.subject, key: s.key, offers });
    }
    return out;
  }
  /* R41: the latest later step on a matter: an action of the plan serving it sent, a filing on one sent, or its
     escalation's stage advanced; null when none. A step the viewer may not read is not counted. */
  #laterStep(p, subj, held, viewer, see) {
    const key = subjectKey(subj);
    let best = null;
    const take = (step, at, ref) => { if (typeof at === "string" && at && (!best || instantOrder(at, best.at) > 0)) best = { step, at, ref }; };
    for (const o of held) {
      if (!o.action || !(o.fields.subjects || []).some((x) => subjectKey(x) === key) || !see.action(o.action)) continue;
      try {
        const a = this.actions.actionRead({ id: o.action, viewer });
        for (const c of ok(a) && Array.isArray(a.correspondence) ? a.correspondence : [])
          if (c && c.direction === "sent") take("action_sent", c.recorded_at ?? c.at, o.action);
      } catch (e) { if (e instanceof ProviderAbsent) throw e; }
      const fl = this.deps.filings ? this.filings : null;
      if (fl && typeof fl.filingsFor === "function") {
        try {
          const r = fl.filingsFor({ action: o.action, viewer });
          for (const d of ok(r) && Array.isArray(r.drafts) ? r.drafts : [])
            if (d && d.sending) take("filing_sent", d.sending.at ?? d.sending.sent_on, d.filing ?? o.action);
        } catch (e) { if (e instanceof ProviderAbsent) throw e; }
      }
    }
    if (subj.kind === "outcome") {
      try {
        const l = this.escalation.escalationsFor({ determination: subj.determination, viewer });
        for (const e of ok(l) ? l.items || [] : []) {
          const r = this.escalation.escalationRead({ id: e.id, viewer });
          for (const h of ok(r) ? r.history || [] : []) if (h && h.kind === "advance") take("escalation_advanced", h.at, e.id);
        }
      } catch (e) { if (e instanceof ProviderAbsent) throw e; }
    }
    return best;
  }

  /* R32: an option adopted from a machine proposal answers its disclosure and origin, for as long as the plan is read. */
  #origin(row) {
    if (!row || row.machine !== 1) return {};
    return { disclosure: DISCLOSURE(row.run, row.skill_version),
             origin: { assistant: true, run: row.run, proposal: row.proposal_id, adopted_by: row.adopted_by, adopted_at: row.adopted_at } };
  }

  /** R13, R29: dispose of one or more options, all or none; choosing a dated option holds its reminders. */
  optionDispose(args = {}) {
    const { plan, options, disposition, reason, reminders, author, viewer } = args;
    /* DEC-49 REGION is-dispose-member */
    if (isMachine(author))
      return refusal("MACHINE_CANNOT_DISPOSE", "an option is chosen, declined or marked by a named member; a machine "
        + "proposes and never decides. Nothing was written.");
    /* END DEC-49 REGION is-dispose-member */
    const o = this.#openPlan(plan, author, viewer, "optionDispose");
    if (o.r) return o.r;
    /* DEC-49 REGION is-disposition-known */
    if (!DISPOSITIONS.includes(disposition))
      return refusal("DISPOSITION_UNKNOWN", `a disposition is one of ${DISPOSITIONS.join(", ")}. Nothing was written.`,
        { dispositions: DISPOSITIONS });
    /* END DEC-49 REGION is-disposition-known */
    const ids = Array.isArray(options) ? options : typeof options === "string" ? [options] : [];
    if (!ids.length) return refuseNoSuchOption(null);
    const held = new Map(this.#options(o.p.id).map((x) => [x.id, x]));
    const unknown = ids.find((x) => !held.has(x));
    if (unknown !== undefined) return refuseNoSuchOption(unknown);
    const bad = refuseReason(reason, NEEDS_REASON.includes(disposition));
    if (bad) return bad;
    const rem = this.#reminders(reminders, disposition, ids, held);
    if (rem.r) return rem.r;
    const keys = refuseKeys(args);
    if (keys) return keys;
    const unique = [...new Set(ids)];
    const entry = { kind: "dispose", options: unique, disposition, reason: str(reason) || null,
                    ...(disposition === "chosen" ? { reminders: rem.by } : {}), author, at: this.now() };
    const w = this.#append(o.p, entry, { blurb: `Options ${disposition}` });
    if (!w.ok) return w;
    return { ok: true, plan: o.p.id, options: unique, disposition, reason: entry.reason, author, at: entry.at,
             ...(disposition === "chosen" ? { reminders: rem.by } : {}) };
  }
  /* R29: the reminders the member asked for, held with the choice: `{date, on, option?}` each naming a date of its
     option and a day; an option named once may omit `option`. `{by: {option: [{date, on}]}}` or `{r: refusal}`, the
     refusal action-clocks' own, through its one site (`reminderRefused`, its R4; N427), judged before any action exists
     and never by a write. */
  #reminders(list, disposition, ids, held) {
    const none = list === undefined || list === null || (Array.isArray(list) && !list.length);
    const by = Object.fromEntries([...new Set(ids)].map((x) => [x, []]));
    if (none) return { by };
    const refused = (arm, detail, extra) => ({ r: reminderRefused(arm, `${detail} Nothing was written.`, extra) });
    if (disposition !== "chosen")
      return refused("entry", "reminders are set when an option is chosen, and this act does not choose one.", { disposition });
    if (!Array.isArray(list))
      return refused("entry", "reminders are a list of {date, on}, each naming a regulated date of the option and a day.");
    const one = new Set(ids).size === 1 ? ids[0] : null;
    for (const [i, r] of list.entries()) {
      const opt = isObj(r) ? (r.option ?? one) : null;
      if (!isObj(r) || !opt || !by[opt])
        return refused("entry", `reminder ${i} names no option of this act; with several options, each names its option.`,
          { index: i });
      const entry = (held.get(opt).fields.dates || []).findIndex((d) => d.date === r.date);
      if (entry === -1)
        return refused("entry", `reminder ${i} names no regulated date of ${opt}.`, { index: i, option: opt });
      if (!isDay(r.on))
        return refused("on", `reminder ${i}'s on is the day to be reminded, written YYYY-MM-DD.`, { index: i, option: opt });
      if (!by[opt].some((x) => x.date === r.date && x.on === r.on)) by[opt].push({ date: r.date, on: r.on });
    }
    return { by };
  }
  /** R14: set one scenario whole, keeping the earlier version in history. */
  scenarioSet(args = {}) {
    const { plan, scenario, name, phases, author, viewer } = args;
    /* DEC-49 REGION is-scenario-member */
    if (isMachine(author))
      return refusal("MACHINE_CANNOT_SCHEDULE", "a scenario is set by a named member; a machine proposes options and "
        + "never schedules. Nothing was written.");
    /* END DEC-49 REGION is-scenario-member */
    const o = this.#openPlan(plan, author, viewer, "scenarioSet");
    if (o.r) return o.r;
    const n = /^[0-9]+$/.test(String(scenario ?? "")) ? Number(scenario) : NaN;
    /* DEC-49 REGION is-scenario-numbered */
    if (!(Number.isSafeInteger(n) && n >= 1))
      return refusal("SCENARIO_OUT_OF_RANGE", "a scenario is numbered with a positive whole number (1, 2, 3 and on); a plan "
        + "holds any number of them. Nothing was written.");
    /* END DEC-49 REGION is-scenario-numbered */
    /* DEC-49 REGION is-scenario-named */
    if (!isLine(name, TITLE_MAX))
      return refusal("SCENARIO_NAME_REFUSED", `a scenario's name is 1 to ${TITLE_MAX} characters with no quotation mark, `
        + "backslash or line break. Nothing was written.", { max: TITLE_MAX });
    /* END DEC-49 REGION is-scenario-named */
    const ph = this.#scenarioPhases(o.p, phases, viewer);
    if (!ph.phases) return ph;
    const keys = refuseKeys(args) || (Array.isArray(phases) ? phases.map((x) => refuseKeys(x)).find(Boolean) : null);
    if (keys) return keys;
    const entry = { kind: "scenario_set", scenario: n, name: name.trim(), phases: ph.phases, author, at: this.now() };
    const w = this.#append(o.p, entry, { blurb: `Scenario ${n} set` });
    if (!w.ok) return w;
    const v = this.#scenarios(o.p.id).find((x) => x.scenario === n);
    return { ok: true, plan: o.p.id, scenario: n, version: v ? v.version : 1, name: entry.name, phases: ph.phases,
             author, at: entry.at };
  }
  /** R39: set a scenario aside, with a reason; it is kept whole and readable, its checkpoints never due (R17) and its
   *  checks not run (R19). */
  scenarioSetAside(args = {}) { return this.#scenarioAct("aside", args); }
  /** R39: restore a scenario set aside, with a reason; its checkpoints are due again. */
  scenarioRestore(args = {}) { return this.#scenarioAct("restore", args); }
  #scenarioAct(kind, { plan, scenario, reason, author, viewer } = {}) {
    const m = this.#member(author);
    if (m) return m;
    const o = this.#openPlan(plan, author, viewer, kind === "aside" ? "scenarioSetAside" : "scenarioRestore");
    if (o.r) return o.r;
    const n = /^[0-9]+$/.test(String(scenario ?? "")) ? Number(scenario) : NaN;
    const held = this.#scenarios(o.p.id).some((x) => x.scenario === n);
    /* DEC-49 REGION is-scenario-held */
    if (!held)
      return refusal("NO_SUCH_SCENARIO", localize("action-plans.index.the_plan_holds_no_scenario", "the plan holds no scenario {String}. Nothing was written.", { String: String(String(scenario ?? "(none named)").slice(0, 40)) }), { scenario: Number.isFinite(n) ? n : null });
    /* END DEC-49 REGION is-scenario-held */
    const bad = refuseReason(reason, true);
    if (bad) return bad;
    const aside = this.#asides(o.p.id).get(n) || null;
    /* DEC-49 REGION is-scenario-in-use */
    if (kind === "aside" && aside)
      return refusal("SCENARIO_ALREADY_SET_ASIDE", `scenario ${n} was set aside on ${aside.at} by ${aside.by}. Nothing was written.`,
        { scenario: n });
    /* END DEC-49 REGION is-scenario-in-use */
    /* DEC-49 REGION is-scenario-aside */
    if (kind === "restore" && !aside)
      return refusal("SCENARIO_NOT_SET_ASIDE", `scenario ${n} is in use, not set aside. Nothing was written.`, { scenario: n });
    /* END DEC-49 REGION is-scenario-aside */
    const entry = { kind: kind === "aside" ? "scenario_set_aside" : "scenario_restore", scenario: n, reason: reason.trim(),
                    author, at: this.now() };
    const w = this.#append(o.p, entry, { blurb: kind === "aside" ? localize("action-plans.blurb.scenario_set_aside", "Scenario {n} set aside", { n: String(n) }) : `Scenario ${n} restored` });
    if (!w.ok) return w;
    return { ok: true, plan: o.p.id, scenario: n, set_aside: kind === "aside", reason: entry.reason, author, at: entry.at };
  }
  /* R39: the scenarios set aside now, each with the act that set it aside; derived from the history. */
  #asides(planId) {
    const out = new Map();
    for (const h of this.#rows(`SELECT * FROM plan_history WHERE plan_id=? AND kind IN ('scenario_set_aside', 'scenario_restore')
                                ORDER BY seq`, planId)) {
      const e = unjson(h.entry_json, {});
      if (h.kind === "scenario_set_aside") out.set(e.scenario, { reason: h.reason ?? null, by: h.author, at: h.at });
      else out.delete(e.scenario);
    }
    return out;
  }

  #scenarioPhases(p, phases, viewer) {
    const chosen = new Set(this.#options(p.id).filter((x) => x.disposition === "chosen").map((x) => x.id));
    const subjects = new Map(this.#subjectsOf(p.id).map((s) => [s.key, s.subject]));
    let r = checkPhases(phases, { chosen, subjects });
    if (r.phases) {
      r = this.#dutyPhases(r.phases, viewer);
      if (r.phases || r.ok === false) return r;
    }
    const at = { index: r.index, ...(r.phase ? { phase: r.phase } : {}), ...(r.option ? { option: r.option } : {}) };
    /* DEC-49 REGION is-phase-shaped */
    if (r.fault === "malformed")
      return refusal("PHASE_MALFORMED", localize("action-plans.index.phase_v1_is_not_a", "phase {v1} is not a phase this scenario can hold: {detail}. Nothing was written.", { v1: String(r.index ?? "list"), detail: String(r.detail) }), at);
    /* END DEC-49 REGION is-phase-shaped */
    /* DEC-49 REGION is-phase-option-chosen */
    if (r.fault === "not_chosen")
      return refusal("PHASE_OPTION_NOT_CHOSEN", localize("action-plans.index.phase_index_holds_an_option", "phase {index} holds an option the team has not chosen: {detail}. Nothing was written.", { index: String(r.index), detail: String(r.detail) }), at);
    /* END DEC-49 REGION is-phase-option-chosen */
    /* DEC-49 REGION is-branch-known */
    if (r.fault === "branch")
      return refusal("BRANCH_UNKNOWN", localize("action-plans.index.phase_index_names_a_phase", "phase {index} names a phase or a matter this scenario does not hold: {detail}. Nothing was written.", { index: String(r.index), detail: String(r.detail) }), at);
    /* END DEC-49 REGION is-branch-known */
    /* DEC-49 REGION is-phase-acyclic */
    return refusal("PHASE_CYCLE", `following when each phase starts leads back to where it began: ${r.detail}, and no `
      + "phase can start after itself. Nothing was written.",
      at);
    /* END DEC-49 REGION is-phase-acyclic */
  }

  /* R38: each phase started by a duty occurrence's state names a held duty the author may see, else NO_SUCH_DUTY,
     answered through duties' own site (`noSuchDuty`, its R25; N601), one answer for absent and unseen, with the phase's
     index; and an occurrence named is one of its own (else R14's malformed fault, minted at its one site). `{phases}`,
     a refusal, or a fault. */
  #dutyPhases(phases, viewer) {
    const asOf = this.now();
    for (let i = 0; i < phases.length; i++) {
      const s = phases[i].starts;
      if (!isObj(s) || !s.when_duty) continue;
      const { duty, occurrence } = s.when_duty;
      const held = this.duties.readDuty({ dutyId: duty, viewer: dutyViewer(viewer) });
      if (!ok(held) || held.found !== true) return noSuchDuty(duty, { index: i });
      if (occurrence === undefined) continue;
      /* the window reaches two years ahead, so a key of an instance already dated in the record (a dated trigger, a
         recurrence) is one of its own before it falls due */
      const r = this.duties.occurrencesOf({ dutyId: duty, asOf, to: dayOf(msOf(asOf) + 731 * DAY_MS), viewer: dutyViewer(viewer) });
      if (!ok(r)) return r.code === "NO_SUCH_DUTY" ? noSuchDuty(duty, { index: i }) : r;
      const keys = new Set((r.occurrences || []).map((x) => x.key));
      for (const t of (this.duties.transitionsOf({ dutyId: duty, viewer: dutyViewer(viewer) }) || {}).transitions || []) keys.add(t.occurrence_key);
      if (!keys.has(occurrence))
        return { fault: "malformed", index: i, detail: `occurrence ${occurrence} is not one of that obligation's occurrences` };
    }
    return { phases };
  }

  /* R14–R16, R38: a scenario version's phases with when each starts and its checkpoint, read at `nowMs`; `starts` maps a
     phase started by an obligation to what R38 read of it. */
  #timed(p, sc, viewer, nowMs = this.#nowMs()) {
    const judged = this.#judgements(p.id, sc.scenario, sc.version);
    const starts = new Map();
    const times = phaseTimes(sc.phases, { setAt: sc.at, judged, track: (s) => this.#track(p, s, viewer),
      duty: (ph, anchor) => { const d = this.#dutyStart(ph.starts, anchor, nowMs, viewer); starts.set(ph.id, d); return d.holds ? d.since : null; } });
    for (const ph of sc.phases)
      if (isObj(ph.starts) && ph.starts.when_duty && !starts.has(ph.id))
        starts.set(ph.id, { duty: ph.starts.when_duty.duty, occurrence: ph.starts.when_duty.occurrence ?? null, state_asked: ph.starts.state,
                            state: null, holds: false, since: null, says: localize("action-plans.says.phase_leads_here_not_led", "the phase that leads here has not led here yet, so no occurrence is read") });
    return { judged, times, starts };
  }

  /** R38: whether a phase's duty start holds, derived when read and never stored. The occurrence is the one named, else
   *  the first triggered on or after `anchor`'s day; its state is its latest transition recorded by the read's instant
   *  (duties R14), else its state derived as of the read (duties R9, R10), as duties answers it: a question with its
   *  derivation, never a violation. `since` is when the state began to hold, never before `anchor` or after the read. */
  #dutyStart(s, anchor, nowMs, viewer) {
    const { duty, occurrence } = s.when_duty;
    const asOf = iso(nowMs);
    const base = { duty, occurrence: occurrence ?? null, state_asked: s.state };
    const none = (says) => ({ ...base, state: null, holds: false, since: null, says });
    let r;
    try {
      r = this.duties.occurrencesOf({ dutyId: duty, asOf, ...(occurrence ? {} : { from: anchor.slice(0, 10) }), viewer: dutyViewer(viewer) });
    } catch (e) { if (e instanceof ProviderAbsent) throw e; return none(localize("action-plans.obligation_occurrences_read", "the obligation's occurrences could not be read")); }
    if (!ok(r)) return none(localize("action-plans.obligation_answer_reader", "the obligation does not answer to this reader"));
    const list = Array.isArray(r.occurrences) ? r.occurrences : [];
    const occ = occurrence ? list.find((x) => x.key === occurrence)
      : list.filter((x) => dayIn(x.trigger && x.trigger.date) !== null && dayIn(x.trigger.date) >= anchor.slice(0, 10))
          .sort((a, b) => (dayIn(a.trigger.date) < dayIn(b.trigger.date) ? -1 : dayIn(a.trigger.date) > dayIn(b.trigger.date) ? 1 : 0))[0];
    if (!occ) return none(occurrence ? localize("action-plans.occurrence_obligation_derived", "that occurrence of the obligation is not derived as of this read")
      : localize("action-plans.occurrence_obligation_triggered", "no occurrence of the obligation has been triggered since the phase began to wait"));
    const recorded = ((this.duties.transitionsOf({ dutyId: duty, occurrenceKey: occ.key, viewer: dutyViewer(viewer) }) || {}).transitions || [])
      .filter((t) => typeof t.at === "string" && msOf(t.at) <= nowMs);
    const last = recorded.at(-1) || null;
    const state = last ? last.state : occ.state;
    const holds = state === s.state;
    let since = null;
    if (holds) {
      let t = last ? msOf(last.as_of) : derivedSince(occ, nowMs);
      if (!Number.isFinite(t) || t > nowMs) t = nowMs;
      since = iso(Math.max(t, msOf(anchor)));
    }
    return { ...base, occurrence: occ.key, trigger: occ.trigger, due: occ.due, state, read_from: last ? "recorded" : "derived",
             ...(last ? { transition: { state: last.state, as_of: last.as_of, at: last.at, cause: last.cause, by: last.by } } : {}),
             why: last ? last.cause : occ.why, derivation: occ.derivation, ...(occ.question ? { question: occ.question } : {}),
             holds, since };
  }

  /** R15: the instant another subject's track met its point (its escalation reached the stage, or the action started
   *  from an option serving it was resolved), from R6's reads; null when it has not, or cannot be read. */
  #track(p, s, viewer) {
    const subj = s.when_subject;
    try {
      if (s.reaches === "stage") {
        if (subj.kind !== "outcome") return null;
        const l = this.escalation.escalationsFor({ determination: subj.determination, viewer });
        if (!ok(l)) return null;
        let first = null;
        for (const e of l.items || []) {
          const r = this.escalation.escalationRead({ id: e.id, viewer });
          if (!ok(r)) continue;
          for (const h of r.history || [])
            if ((h.kind === "open" || h.kind === "advance") && h.to === s.stage && (!first || instantOrder(h.at, first) < 0)) first = h.at;
        }
        return first;
      }
      const key = subjectKey(subj);
      let first = null;
      for (const o of this.#options(p.id)) {
        if (!o.action || !(o.fields.subjects || []).some((x) => subjectKey(x) === key)) continue;
        const a = this.actions.actionRead({ id: o.action, viewer });
        if (!ok(a) || a.current_state !== "resolved") continue;
        const at = (a.state_history || []).filter((h) => h.state === "resolved").map((h) => h.at).at(-1) || null;
        if (at && (!first || instantOrder(at, first) < 0)) first = at;
      }
      return first;
    } catch (e) { if (e instanceof ProviderAbsent) throw e; return null; }
  }

  /** R16: a member's judgement of a due checkpoint. */
  checkpointRecord(args = {}) {
    const { plan, scenario, phase, judged, note, author, viewer } = args;
    /* DEC-49 REGION is-judge-member */
    if (isMachine(author))
      return refusal("MACHINE_CANNOT_JUDGE", "a checkpoint is judged by a named member; the module never judges a "
        + "condition and a machine never does. Nothing was written.");
    /* END DEC-49 REGION is-judge-member */
    const o = this.#openPlan(plan, author, viewer, "checkpointRecord");
    if (o.r) return o.r;
    const n = /^[0-9]+$/.test(String(scenario ?? "")) ? Number(scenario) : NaN;
    const sc = this.#scenarios(o.p.id).find((x) => x.scenario === n) || null;
    const ph = sc ? sc.phases.find((x) => x.id === phase) : null;
    /* DEC-49 REGION is-checkpoint-named */
    if (!sc || !ph || !ph.checkpoint || !JUDGEMENTS.includes(judged)
        || (note !== undefined && note !== null && (typeof note !== "string" || note.length > NOTE_MAX)))
      return refusal("CHECKPOINT_REFUSED", !sc ? "the plan holds no scenario of that number. Nothing was written."
        : !ph ? "the scenario holds no phase of that id. Nothing was written."
        : !ph.checkpoint ? "that phase has no checkpoint. Nothing was written."
        : !JUDGEMENTS.includes(judged) ? "a judgement is met or not_met. Nothing was written."
        : `a note is at most ${NOTE_MAX} characters. Nothing was written.`);
    /* END DEC-49 REGION is-checkpoint-named */
    const { judged: held, times } = this.#timed(o.p, sc, viewer);
    const t = times.get(ph.id);
    const nowMs = this.#nowMs();
    const aside = this.#asides(o.p.id).has(sc.scenario);
    /* DEC-49 REGION is-checkpoint-due */
    if (aside || !t.due || msOf(t.due) > nowMs)
      return refusal("CHECKPOINT_NOT_DUE", aside ? "the scenario is set aside, and its checkpoints are never due until it is "
        + "restored. Nothing was written." : t.started ? `the checkpoint is due ${t.due}. Nothing was written.`
        : "the phase has not started, so its checkpoint is not due. Nothing was written.", { due: aside ? null : t.due });
    /* END DEC-49 REGION is-checkpoint-due */
    /* DEC-49 REGION is-checkpoint-once */
    if (held.has(ph.id))
      return refusal("CHECKPOINT_JUDGED", localize("action-plans.index.that_checkpoint_was_judged_judged", "that checkpoint was judged {judged} by {author}. Nothing was written.", { judged: String(held.get(ph.id).judged), author: String(held.get(ph.id).author) }), { judged: held.get(ph.id).judged });
    /* END DEC-49 REGION is-checkpoint-once */
    const entry = { kind: "checkpoint", scenario: sc.scenario, version: sc.version, phase: ph.id, judged,
                    note: typeof note === "string" && note.trim() ? note : null, author, at: this.now() };
    const w = this.#append(o.p, entry, { blurb: "Checkpoint judged" });
    if (!w.ok) return w;
    const leads = this.#leadsTo(ph, sc.phases, judged);
    return { ok: true, plan: o.p.id, scenario: sc.scenario, version: sc.version, phase: ph.id, judged, note: entry.note,
             author, at: entry.at, leads_to: leads };
  }
  #leadsTo(ph, phases, judged) {
    const out = new Set();
    if (ph.branches && ph.branches[judged]) out.add(ph.branches[judged]);
    for (const o of phases) if (o.starts && o.starts.branch_of === ph.id && o.starts.when === judged) out.add(o.id);
    return [...out];
  }

  /** R18, R29: start a chosen option: compose its action, promote it, set the reminders asked with the choice, and link
   *  them, in one act; a refusal of either leaves neither. `mode` is this module's own: R37's preview runs this same
   *  path in a transaction it rolls back. */
  optionStart(args = {}, mode = null) {
    const { plan, option, kind, contact, breach, premise_override: override, author, viewer } = args;
    const preview = mode === PREVIEW;
    const done = (r) => (preview ? this.#previewOf(args, r) : r);
    /* DEC-49 REGION is-start-member */
    if (isMachine(author))
      return done(refusal("MACHINE_CANNOT_START", "an option is started by a named member; a machine never creates an action "
        + "from a plan. Nothing was written."));
    /* END DEC-49 REGION is-start-member */
    const o = this.#openPlan(plan, author, viewer, "optionStart");
    if (o.r) return done(o.r);
    const p = o.p;
    const opt = this.#option(p.id, option);
    if (!opt) return done(refuseNoSuchOption(option));
    /* DEC-49 REGION is-start-chosen */
    if (opt.disposition !== "chosen")
      return done(refusal("OPTION_NOT_CHOSEN", `${opt.id} is ${opt.disposition}, not chosen. Nothing was written.`,
        { disposition: opt.disposition }));
    /* END DEC-49 REGION is-start-chosen */
    /* DEC-49 REGION is-start-once */
    if (opt.action)
      return done(refusal("OPTION_STARTED", `${opt.id} was started as ${opt.action}. Nothing was written.`, { action: opt.action }));
    /* END DEC-49 REGION is-start-once */
    /* R18: asked before any write, as actions' write asks it (its R45), and answered through its one site. */
    const member = contactId(contact);
    if (contact !== undefined && contact !== null) {
      let facts = null;
      if (member) { try { facts = this.membership.memberFacts(member); } catch { facts = null; } }
      if (!facts) return done(contactNotAMember());
    }
    /* R42: an outward option serving a matter that may be an infraction whose documentation is not started takes the
       member's reason for going first; documenting is the default, never a gate. */
    const whyFirst = args.why_first;
    const first = this.#documentFirst(p, opt, viewer);
    const givenWhy = whyFirst !== undefined && whyFirst !== null && whyFirst !== "";
    /* DEC-49 REGION is-document-first */
    if ((first.length && !givenWhy) || (givenWhy && !isLine(whyFirst, REASON_MAX)))
      return done(refusal("DOCUMENT_FIRST_NO_REASON", localize("action-plans.index.id_goes_outside_the_team", "{id} goes outside the team before the infraction it serves is documented; say why it goes first, in 1 to {REASON_MAX} characters with no quotation mark, backslash or line break. Nothing was written.", { id: String(opt.id), REASON_MAX: String(REASON_MAX) }), { max: REASON_MAX, matters: first.length }));
    /* END DEC-49 REGION is-document-first */
    const at = this.now();
    const doc = actionDocument({ fields: opt.fields, kind, project: p.project, plan: p.id, option: opt.id, contact: member,
                                 breach: breach === true, override: overrideOf(override), at });
    const r = this.record.transact(() => {
      const a = this.actions.actionCreate({ document: doc, author, viewer });
      if (!ok(a)) return a;
      /* R54: the tier the option states is the action's first risk-tier history entry, by the starter, in this transaction */
      if ([1, 2, 3].includes(opt.fields.tier)) {
        const t = this.actions.actionRiskTier({ target: a.id, tier: opt.fields.tier, author, viewer,
          reason: localize("action-plans.index.tier_stated_by_the_option", "the tier option {option} of plan {plan} states", { option: String(opt.id), plan: String(p.id) }) });
        if (!ok(t)) return t;
      }
      const set = [];
      for (const rem of opt.reminders || []) {
        const entry = (opt.fields.dates || []).findIndex((d) => d.date === rem.date);
        const s = this.clocks.reminderSet({ target: a.id, entry, on: rem.on, author: opt.chosenBy || author, viewer });
        if (!ok(s)) return s;
        set.push({ entry, date: rem.date, on: rem.on, set_by: opt.chosenBy || author });
      }
      const w = this.#append(p, { kind: "start", option: opt.id, action: a.id, ...(first.length && givenWhy ? { why_first: whyFirst.trim() } : {}),
                                  author, at }, { blurb: "Option started" });
      if (!w.ok) return w;
      /* R37: the act went through whole; the preview rolls every row of it back, so no id is spent. */
      if (preview) return { ok: false, [PREVIEW]: true };
      return { ok: true, action: a.id, reminders: set };
    });
    if (preview) return done(r && r[PREVIEW] ? null : r);
    if (!ok(r)) return r;
    return { ok: true, plan: p.id, option: opt.id, action: r.action, reminders: r.reminders, author, at };
  }

  /* R42: the matters of R41 an option going outward would get ahead of: it addresses someone, it is not itself a
     documentation option, and a matter it serves that may be an infraction has no started documentation option. */
  #documentFirst(p, opt, viewer) {
    if (!opt.fields.addressee) return [];
    const offers = this.#offerOptions(p.id);
    const own = offers.get(opt.id);
    if (own && own.kind === "document_infraction") return [];
    const started = this.#options(p.id).filter((o) => o.action && (offers.get(o.id) || {}).kind === "document_infraction")
      .map((o) => subjectKey(offers.get(o.id).subject));
    return (opt.fields.subjects || []).filter((s) => !started.includes(subjectKey(s)) && this.#mayBeInfraction(s, viewer));
  }

  /** R37: what `optionStart` (R18) would do with the same arguments, at this instant, writing nothing: R18's own path,
   *  run in a transaction that is rolled back, so no id is allocated, no reminder set and nothing promoted. */
  optionStartPreview(args = {}) { return this.optionStart(args, PREVIEW); }

  /* R37: the preview's answer. `refused` is R18's refusal, or null when the start would land. A plan or option the
     viewer may not see is answered exactly as R18 answers it; otherwise the action R18 would compose, the reminders
     R29 would set, and `would_start` or the refusal. A matter the viewer may not see is withheld whole (R35). */
  #previewOf(args, refused) {
    const { plan, option, kind, contact, breach, premise_override: override, author, viewer } = args;
    const p = this.#plan(plan, viewer);
    const opt = p ? this.#option(p.id, option) : null;
    if (!p || !opt) return refused;
    const see = this.#sight(viewer);
    const fields = see.fields(opt.fields);
    const stated = overrideOf(override);
    const legs = [];
    for (const s of fields.subjects || []) {
      const target = s.kind === "inquiry" ? s.inquiry : s.determination;
      let leg = legs.find((l) => l.target === target);
      if (!leg) legs.push(leg = { target, kind: "rests_on", subjects: [] });
      leg.subjects.push({ subject: s, ...this.#support(s, p.project, viewer) });
    }
    const reminders = (opt.reminders || []).map((rem) => ({ entry: (opt.fields.dates || []).findIndex((d) => d.date === rem.date),
      date: rem.date, on: rem.on, set_by: opt.chosenBy || author }));
    return {
      ok: true, plan: p.id, option: opt.id, preview: true,
      action: { kind: typeof kind === "string" ? kind : null, addressee: fields.addressee ?? null,
                clock: (fields.dates || []).map((d) => ({ date: d.date, basis: d.basis, status: "pending" })), legs,
                plan: p.id, option: opt.id, contact: contact === undefined || contact === null ? null : contactId(contact) || null,
                breach: breach === true, premise_override: stated },
      reminders, would_start: refused === null, ...(refused === null ? {} : { refusal: refused }),
      says: PREVIEW_SAYS, ...(see.withheld ? { out_of_view: true } : {}),
    };
  }

  /** R20: a member closes a plan, with a reason. */
  planClose(args = {}) {
    const { id, plan, reason, author, viewer } = args;
    /* DEC-49 REGION is-close-member */
    if (isMachine(author))
      return refusal("MACHINE_CANNOT_CLOSE_PLAN", "a plan is closed by a named member with a reason; it never closes "
        + "itself. Nothing was written.");
    /* END DEC-49 REGION is-close-member */
    const o = this.#openPlan(id ?? plan, author, viewer, "planClose");
    if (o.r) return o.r;
    const bad = refuseReason(reason, true);
    if (bad) return bad;
    const { note } = args;
    const noted = note !== undefined && note !== null && note !== "";
    /* DEC-49 REGION is-close-note */
    if (noted && (typeof note !== "string" || !note.trim() || note.length > CLOSE_NOTE_MAX))
      return refusal("CLOSE_NOTE_TOO_LONG", `a closing note is words of 1 to ${CLOSE_NOTE_MAX} characters. Nothing was written.`,
        { max: CLOSE_NOTE_MAX });
    /* END DEC-49 REGION is-close-note */
    const r = this.record.transact(() => {
      /* R44: the registered reader's answer at the instant of closing, frozen with the plan; never a refusal. */
      const entry = { kind: "close", reason: reason.trim(), note: noted ? note : null, summary: this.#closeSummary(o.p.id),
                      author, at: this.now() };
      const w = this.#append(o.p, entry, { state: "closed", blurb: "Plan closed" });
      return w.ok ? { ok: true, entry } : w;
    });
    if (!r.ok) return r;
    return { ok: true, id: o.p.id, state: "closed", reason: r.entry.reason, note: r.entry.note, summary: r.entry.summary,
             closed_by: author, at: r.entry.at };
  }

  /** R44: the one reader of a plan's closing summary (`plan-work` R7 fills it). A second registration is refused. */
  registerCloseSnapshot(module, fn) {
    const refused = listenerRefusal(this.#closeHolder ? { module: this.#closeHolder.module } : null, module, fn);
    if (refused) return refused;
    this.#closeHolder = { module, fn };
    return { ok: true, module };
  }
  /* R20, R44: the summary the reader answers now, as JSON, or undetermined with why; a throwing reader never undoes the
     close. */
  #closeSummary(planId) {
    const h = this.#closeHolder;
    if (!h) return { state: "undetermined", says: localize("action-plans.says.reader_plan_stands", "no reader of where the plan stands is registered, so no summary was kept") };
    try {
      const v = h.fn({ plan: planId });
      if (v === undefined) throw new Error("no answer");
      return { state: "stated", by: h.module, value: JSON.parse(JSON.stringify(v)) };
    } catch {
      return { state: "undetermined", says: localize("action-plans.says.plan_stands_read", "where the plan stands could not be read at the close, so no summary was kept") };
    }
  }
  /* R20, R50: a closed plan's close: `at` the instant the close was recorded (the one field naming the plan's closing
     instant, which other modules read), who, why, the note and the frozen summary. */
  #closedView(p) {
    const h = this.#one(`SELECT * FROM plan_history WHERE plan_id=? AND kind='close' ORDER BY seq DESC LIMIT 1`, p.id);
    const e = h ? unjson(h.entry_json, {}) : {};
    return { by: p.closedBy, at: p.closedAt, reason: p.closeReason, note: e.note ?? null,
             summary: e.summary ?? { state: "undetermined", says: localize("action-plans.says.plan_closed_closing", "this plan was closed before closing summaries were kept") } };
  }

  /** R45: the closing notes of the project's closed plans the viewer may see, newest first, at most 50; the planning run
   *  reads them when the group plans again. */
  closingNotesOf({ project, viewer } = {}) {
    if (typeof project !== "string" || !project || !this.#sees(project, viewer)) return { ok: true, project: project ?? null, items: [] };
    const items = this.#rows(`SELECT * FROM plans WHERE project_id=? AND state='closed' ORDER BY closed_at DESC, plan_id DESC LIMIT ?`,
      project, CLOSING_NOTES_MAX).map((r) => {
      const c = this.#closedView({ id: r.plan_id, closedBy: r.closed_by, closedAt: r.closed_at, closeReason: r.close_reason });
      return { plan: r.plan_id, title: r.title, closed_by: c.by, closed_at: c.at, reason: c.reason, note: c.note };
    });
    return { ok: true, project, items };
  }

  /** R43 (in process, for `plan-work` R10 only): write the re-examination's machine marks on a plan, each labelled
   *  machine work with its cause, the response recorded (`{action, ord}`, or `"<action>#<ord>"`). A mark decides
   *  nothing: it never changes a disposition, scenario, judgement or start (R24), and is answered apart. A mark that is
   *  not one is skipped and named, never written. */
  planMark({ plan, marks, cause } = {}) {
    const p = this.#plan(plan, null);
    if (!p) return noSuchPlan(plan);
    if (p.state === "closed") return refusePlanClosed(p.id);
    const c = causeOf(cause);
    const list = Array.isArray(marks) ? marks.slice(0, MARKS_MAX) : [];
    const skipped = [];
    const good = [];
    list.forEach((m, index) => {
      const why = c ? markFault(m) : "a mark names the response that caused it: {action, ord}";
      if (why) skipped.push({ index, why }); else good.push(normMark(m));
    });
    if (Array.isArray(marks) && marks.length > MARKS_MAX) skipped.push({ index: MARKS_MAX, why: localize("action-plans.why.marks_act", "at most {marks_max} marks in one act", { marks_max: String(MARKS_MAX) }) });
    const at = this.now();
    this.record.transact(() => {
      let n = (this.#one(`SELECT MAX(n) AS n FROM plan_marks WHERE plan_id=?`, p.id) || {}).n || 0;
      for (const m of good)
        this.sql.exec(`INSERT INTO plan_marks (plan_id, n, kind, mark_json, cause_json, at) VALUES (?,?,?,?,?,?)`,
          p.id, ++n, m.kind, JSON.stringify(m), JSON.stringify(c), at);
    });
    return { ok: true, plan: p.id, written: good.length, skipped, at };
  }
  /* R43: the plan's marks, apart from what members decided, oldest first; one about an option or a phase the viewer
     reads with the plan. */
  #marksView(planId) {
    return this.#rows(`SELECT * FROM plan_marks WHERE plan_id=? ORDER BY n`, planId).map((r) => ({
      ...unjson(r.mark_json, {}), cause: unjson(r.cause_json, null), at: r.at, label: MARK_LABEL }));
  }

  /** R40: a member pauses an open plan, with a reason and perhaps a day to look at it again. What the plan set running
   *  (its actions' clocks, escalations, watches) continues; its own checkpoints are not due (R17). */
  planPause(args = {}) { return this.#pauseAct("pause", args); }
  /** R40: a member resumes a paused plan, with a reason. */
  planResume(args = {}) { return this.#pauseAct("resume", args); }
  #pauseAct(kind, { id, plan, reason, look_again: lookAgain, author, viewer } = {}) {
    const m = this.#member(author);
    if (m) return m;
    const o = this.#openPlan(id ?? plan, author, viewer, kind === "pause" ? "planPause" : "planResume");
    if (o.r) return o.r;
    const bad = refuseReason(reason, true);
    if (bad) return bad;
    const given = lookAgain !== undefined && lookAgain !== null && lookAgain !== "";
    /* DEC-49 REGION is-look-again-day */
    if (given && (kind !== "pause" || !isDay(lookAgain)))
      return refusal("LOOK_AGAIN_REFUSED", kind !== "pause" ? "a day to look again is set when a plan is paused. Nothing was written."
        : "look_again is a day written YYYY-MM-DD. Nothing was written.");
    /* END DEC-49 REGION is-look-again-day */
    /* DEC-49 REGION is-plan-pausable */
    if (kind === "pause" && o.p.state !== "open")
      return refusal("PLAN_NOT_OPEN", `plan ${o.p.id} is ${o.p.state}, not open. Nothing was written.`, { state: o.p.state });
    /* END DEC-49 REGION is-plan-pausable */
    /* DEC-49 REGION is-plan-paused */
    if (kind === "resume" && o.p.state !== "paused")
      return refusal("PLAN_NOT_PAUSED", `plan ${o.p.id} is ${o.p.state}, not paused. Nothing was written.`, { state: o.p.state });
    /* END DEC-49 REGION is-plan-paused */
    const entry = { kind, reason: reason.trim(), ...(kind === "pause" ? { look_again: given ? lookAgain : null } : {}),
                    author, at: this.now() };
    /* R46 (a): the document's state moves along record-grammar's edge in the same act as its Plan Log entry. */
    const w = this.#append(o.p, entry, { state: kind === "pause" ? "paused" : "open", blurb: kind === "pause" ? "Plan paused" : "Plan resumed" });
    if (!w.ok) return w;
    return { ok: true, id: o.p.id, state: kind === "pause" ? "paused" : "open", reason: entry.reason,
             ...(kind === "pause" ? { look_again: entry.look_again } : {}), author, at: entry.at };
  }
  /* R40: the plan's current pause (the latest pause act, when the plan is paused), else null. */
  #pause(p) {
    if (p.state !== "paused") return null;
    const h = this.#one(`SELECT * FROM plan_history WHERE plan_id=? AND kind='pause' ORDER BY seq DESC LIMIT 1`, p.id);
    if (!h) return null;
    const e = unjson(h.entry_json, {});
    return { seq: h.seq, since: h.at, by: h.author, reason: h.reason ?? null, look_again: e.look_again ?? null };
  }

  /** R40, R46 (b): each paused plan whose `look_again` day has come at `nowMs`, oldest day first, for `action-producers`
   *  (`plan-look-again`). One item per pause (`pause` names it), so a reader tells it once. The day is `nowMs`'s local
   *  day in the plan's zone (actions' `place()` and `zoneOf`, its R68; K1444 (iii)), never the UTC day; with no zone held
   *  it is undetermined and no plan is answered due by it. Writes nothing. */
  plansToLookAgain({ nowMs, limit } = {}) {
    const now = Number.isFinite(nowMs) ? nowMs : this.#nowMs();
    const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, DUE_MAX) : DUE_MAX;
    const today = this.#localDay(now, this.#zone());
    if (today === null)
      return { ok: true, as_of: iso(now), day: { state: "undetermined", says: LOOK_AGAIN_UNDETERMINED }, items: [], truncated: false, limit: cap };
    const items = [];
    for (const r of this.#rows(`SELECT plan_id FROM plans WHERE state='paused' ORDER BY plan_id`)) {
      const p = this.#plan(r.plan_id, null);
      const pz = this.#pause(p);
      if (!pz || !pz.look_again || pz.look_again > today) continue;
      items.push({ plan: p.id, project: p.project, title: p.title, look_again: pz.look_again, paused_by: pz.by,
                   paused_at: pz.since, reason: pz.reason, pause: `${p.id}#${pz.seq}` });
    }
    items.sort((a, b) => (a.look_again < b.look_again ? -1 : a.look_again > b.look_again ? 1 : a.plan < b.plan ? -1 : 1));
    return { ok: true, as_of: iso(now), day: today, items: items.slice(0, cap), truncated: items.length > cap, limit: cap };
  }
  /* R46 (b), R48: the team's governing zone (jurisdictions R98, K5292: its stated `team_time_zone`, else the profiles'), else the
     zone the place states (actions R68), or null when none is held. */
  #zone() {
    let g = null;
    try { g = governingZone(this.record.getSetting("jurisdiction_profiles"), this.record.getSetting("team_time_zone")); } catch { g = null; }
    return g || zoneOf(this.actions.place()) || null;
  }
  /* R46 (b), R48: the local day of `ms` in `zone`, or null when no zone is held or the day cannot be read (K1444 (iii):
     never the UTC day in its place). */
  #localDay(ms, zone) {
    if (!zone || !Number.isFinite(ms)) return null;
    let d;
    try { d = localDay(iso(ms), zone); } catch { return null; }
    return typeof d === "string" && isDay(d) ? d : null;
  }

  /* ===================================================================== *
   * THE READS
   * ===================================================================== */

  /** R6, R8, R19, R32, R34: the plan as the record stands at `nowMs`; R35: what the viewer may not see withheld whole,
   *  and `out_of_view: true` when anything was. */
  planRead({ id, nowMs, viewer } = {}) {
    const p = this.#plan(id, viewer);
    if (!p) return noSuchPlan(id);
    const now = Number.isFinite(nowMs) ? nowMs : this.#nowMs();
    const see = this.#sight(viewer);
    const all = this.#subjectsOf(p.id, { all: true });
    const current = all.filter((s) => s.removedSeq === null);
    const inPlan = new Set(current.map((s) => s.key));
    const live = new Map();
    const subjects = current.filter((s) => see.subject(s.subject)).map((s) => {
      let lv = this.#liveness(s.subject, viewer);
      if (lv[WITHHELD]) { see.withheld = true; lv = { state: lv.state }; }
      live.set(s.key, lv);
      const out = { subject: s.subject, key: s.key, ...this.#support(s.subject, p.project, viewer), liveness: lv,
                    added_by: s.addedBy, added_at: s.addedAt };
      if (s.subject.kind === "inquiry" && s.subject.act) {
        const since = this.#determinedSince(s.subject, inPlan, viewer);
        if (since.length) out.determined_since = since;
      }
      if (s.subject.kind === "outcome") out.escalation = this.#escalationOf(s.subject, viewer);
      return out;
    });
    const held = this.#options(p.id);
    const options = held.map((o) => this.#optionView(p, o, live, viewer, see));
    const scenarios = this.#scenarios(p.id).map((sc) => this.#scenarioView(p, sc, viewer, see, now));
    const proposals = this.#rows(`SELECT * FROM plan_option_proposals WHERE plan_id=? AND machine=0 ORDER BY n`, p.id)
      .map((r) => this.#proposalView(r, see, viewer));
    const runs = this.#planRuns(p.id).map((run) => ({ run, proposals: this.#tray(p.id, run, see, viewer) }));
    const removed = all.filter((s) => s.removedSeq !== null && !inPlan.has(s.key) && see.subject(s.subject))
      .map((s) => ({ subject: s.subject, key: s.key }));
    const checks = this.#checks(p, options, scenarios, live, now, viewer, new Map(held.map((o) => [o.id, o.fields])));
    const history = this.#historyView(p.id, see);
    const pz = this.#pause(p);
    return {
      ok: true, id: p.id, project: p.project, title: p.title, state: p.state, opened_by: p.openedBy, opened_at: p.openedAt,
      ...(p.state === "closed" ? { closed: this.#closedView(p) } : { close_note_prompt: CLOSE_NOTE_PROMPT }),
      pause: pz ? { since: pz.since, by: pz.by, reason: pz.reason, look_again: pz.look_again,
                    running: this.#running(options, subjects), says: PAUSED_SAYS } : null,
      as_of: iso(now), work_kinds: this.#workKinds(p.project), subjects, removed_subjects: removed,
      offers: this.#offers(p, subjects, held, viewer, see),
      options, proposals, planning_runs: runs, scenarios, checks, marks: this.#marksView(p.id), history,
      decisions: decisionsOf(history), ...(see.withheld ? { out_of_view: true } : {}),
    };
  }

  /* R40: what a paused plan set running and which continues: its started options' actions not yet ended, with their
     states, and its determined matters' escalations not ended. Watches are `plan-work`'s (its R7, R9). */
  #running(options, subjects) {
    const actions = options.filter((o) => o.action && !["resolved", "abandoned"].includes(o.action.state))
      .map((o) => ({ option: o.id, action: o.action.id, state: o.action.state }));
    const escalations = subjects.filter((s) => s.escalation && s.escalation.id && s.escalation.state !== "ended")
      .map((s) => ({ subject: s.subject, escalation: s.escalation.id, state: s.escalation.state, stage: s.escalation.stage }));
    return { actions, escalations };
  }

  /* R6, R35: the plan's history as the viewer may read it. An act about a subject the viewer may not see leaves the
     list; an unseen subject, action or track leaves the entry that names it. When an act is withheld, no entry carries
     its `seq`, so the gap counts nothing. */
  #historyView(planId, see) {
    let dropped = false;
    const out = [];
    for (const h of this.#history(planId)) {
      if ((h.kind === "subject_add" || h.kind === "subject_remove") && !see.subject(h.subject)) { dropped = true; continue; }
      const e = { ...h };
      if (h.kind === "open" && Array.isArray(h.subjects)) e.subjects = h.subjects.filter((x) => see.subject(x && x.subject));
      if (h.fields) e.fields = see.fields(h.fields);
      if (h.phases) e.phases = see.phases(h.phases);
      if (h.kind === "start" && typeof h.action === "string" && !see.action(h.action)) { delete e.action; see.withheld = true; }
      out.push(e);
    }
    return dropped ? out.map(({ seq, ...e }) => e) : out;
  }

  /** R21: the project's `work_kinds` as its document states them, or undetermined; it gates, filters and orders nothing. */
  #workKinds(project) {
    const fm = parseFm(this.#text(project)) || {};
    return Array.isArray(fm.work_kinds) ? { state: "stated", kinds: fm.work_kinds }
      : { state: "undetermined", says: localize("action-plans.says.project_states_kinds", "the project states no kinds of work") };
  }

  /* R5: the outcomes of determinations recorded on a suspected subject's act, beside it; nothing is added without a member. */
  #determinedSince(s, inPlan, viewer) {
    const out = [];
    let after = null;
    for (let page = 0; page < 10; page++) {
      const r = this.conformance.determinationsFor({ act: s.act, live: true, after, viewer });
      if (!ok(r)) break;
      for (const d of r.items || [])
        for (const o of Array.isArray(d.outcomes) ? d.outcomes : []) {
          if (!o || typeof o.standard !== "string") continue;
          if (s.standards && !s.standards.includes(o.standard)) continue;
          const sub = { kind: "outcome", determination: d.id, standard: o.standard };
          if (!inPlan.has(subjectKey(sub))) out.push({ ...sub, outcome: o.outcome ?? null });
        }
      if (!r.truncated) break;
      after = r.cursor ?? (r.items || []).at(-1)?.id ?? null;
      if (!after) break;
    }
    return out;
  }

  /* R6: a determined subject's escalation with its stage (escalation R22). */
  #escalationOf(s, viewer) {
    const l = this.escalation.escalationsFor({ determination: s.determination, viewer });
    if (!ok(l)) return { state: "undetermined", says: localize("action-plans.says.escalations_determination_read", "the escalations of that determination could not be read") };
    const items = l.items || [];
    const cur = items.filter((e) => e.state !== "ended").at(-1) || items.at(-1) || null;
    return cur ? { id: cur.id, state: cur.state, stage: cur.stage, stage_name: cur.stage_name ?? null } : null;
  }

  /* R6, R8, R35: one option as the viewer may read it: a subject they may not see leaves its `subjects`,
     `subjects_liveness` and `available`, and an action they may not see leaves the `action` key. Whether every matter it
     serves is no longer live is said only when every one is seen. */
  #optionView(p, o, live, viewer, see) {
    const f = see.fields(o.fields);
    const whole = (o.fields.subjects || []).length === (f.subjects || []).length;
    const bound = (f.subjects || []).map((s) => ({ key: subjectKey(s), liveness: live.get(subjectKey(s)) || { state: "subject_removed" } }));
    const anyLive = !whole || bound.some((b) => b.liveness.state === "live");
    const revisions = this.#rows(`SELECT * FROM plan_option_revisions WHERE plan_id=? AND option_id=? ORDER BY rev`, p.id, o.id)
      .map((r) => ({ rev: r.rev, fields: see.fields(unjson(r.fields_json, {})), reason: r.reason ?? null, author: r.author, at: r.at }));
    const dispositions = this.#rows(`SELECT * FROM plan_history WHERE plan_id=? AND kind='dispose' ORDER BY seq`, p.id)
      .map((h) => ({ ...unjson(h.entry_json, {}), seq: h.seq })).filter((e) => (e.options || []).includes(o.id))
      .map((e) => ({ disposition: e.disposition, reason: e.reason ?? null, author: e.author, at: e.at }));
    const out = { id: o.id, ...f, disposition: o.disposition, dispositions, revisions, subjects_liveness: bound,
                  ...(anyLive ? {} : { says: localize("action-plans.says.matter_option_serves", "every matter this option serves is no longer live") }),
                  added_by: o.createdBy, added_at: o.createdAt, proposal: o.proposal,
                  reminders: o.disposition === "chosen" ? o.reminders ?? [] : null };
    Object.assign(out, this.#origin(o.proposal ? this.#proposalRow(o.proposal) : null));
    if (o.action) {
      const a = this.actions.actionRead({ id: o.action, viewer });
      if (ok(a)) out.action = { id: o.action, state: a.current_state ?? null, started_by: o.startedBy, started_at: o.startedAt };
      else see.withheld = true;
    } else out.action = null;
    if (f.category === "legal") {
      out.available = (f.subjects || []).filter((s) => s.kind === "outcome").map((s) => {
        const av = this.filings.availableActions({ determination: s.determination, viewer });
        return { determination: s.determination, ...(ok(av) ? { available: av } : { state: "undetermined", says: localize("action-plans.says.available_actions_read", "the available actions could not be read") }) };
      });
    }
    return out;
  }

  #scenarioView(p, sc, viewer, see, now) {
    const { judged, times, starts } = this.#timed(p, sc, viewer, now);
    const shown = see.phases(sc.phases);
    const aside = this.#asides(p.id).get(sc.scenario) || null;
    return { scenario: sc.scenario, version: sc.version, versions: sc.versions, name: sc.name, set_by: sc.author, set_at: sc.at,
             set_aside: aside,
             phases: shown.map((ph) => {
               const t = times.get(ph.id), j = judged.get(ph.id) || null;
               /* R38: a duty start with its occurrence, state, derivation and whether it holds; withheld with its duty (R35). */
               const d = isObj(ph.starts) && ph.starts.when_duty ? starts.get(ph.id) : null;
               return { ...ph, started: t.started, started_at: t.at, earliest: t.earliest, checkpoint_due: t.due,
                        judgement: j, ...(j ? { leads_to: this.#leadsTo(ph, sc.phases, j.judged) } : {}), ...(d ? { duty_start: d } : {}) };
             }),
             history: this.#rows(`SELECT version, name, author, at FROM plan_scenarios WHERE plan_id=? AND scenario=? ORDER BY version`,
               p.id, sc.scenario).map((r) => ({ version: r.version, name: r.name, set_by: r.author, set_at: r.at })) };
  }

  /** R19: the checks, each with its reason; derived on read, they refuse and change nothing. */
  /* `held` maps an option to its fields as recorded: whether an option rests only on suspected matters is the plan's own
     fact, asked of every subject it serves, seen or not (R35 withholds the subject, not what the plan says of it). */
  #checks(p, options, scenarios, live, now, viewer, held) {
    const out = [];
    /* R48: the date checks compare on the plan's local day (R46 (b)'s zone), never the UTC day; with no zone held each is
       answered undetermined with its reason, never computed on the UTC day and never left out. */
    const zone = this.#zone();
    const today = this.#localDay(now, zone);
    const outward = (o) => !!o.addressee;
    const pending = (o) => !["declined", "done"].includes(o.disposition) && !o.action;
    for (const o of options) {
      /* A declined option is set aside: no check is asked of it. */
      if (o.disposition === "declined") continue;
      if (pending(o)) for (const d of o.dates || []) {
        if (today === null)
          out.push({ check: "date_past", option: o.id, date: d.date, state: "undetermined",
                     says: localize("action-plans.says.whether_regulated_date", "whether {id}'s regulated date {date} has passed cannot be told: {day_undetermined}", { id: String(o.id), date: String(d.date), day_undetermined: String(DAY_UNDETERMINED) }) });
        else if (d.date < today) out.push({ check: "date_past", option: o.id, date: d.date, says: localize("action-plans.says.regulated_date_passed", "{id}'s regulated date {date} has passed ({basis})", { id: String(o.id), date: String(d.date), basis: String(d.basis) }) });
      }
      const states = (o.subjects_liveness || []).map((b) => b.liveness.state);
      if (states.length && !states.includes("live") && o.says)
        out.push({ check: "subjects_not_live", option: o.id, says: localize("action-plans.says.matter_serves_longer", "every matter {id} serves is no longer live", { id: String(o.id) }) });
      const hypothetical = ((held.get(o.id) || o).subjects || []).every((s) => s.kind === "inquiry");
      if (outward(o) && hypothetical)
        out.push({ check: "outward_on_hypothesis", option: o.id, says: localize("action-plans.says.addresses_someone_outside", "{id} addresses someone outside the team and rests only on suspected matters: nothing it serves is determined yet", { id: String(o.id) }) });
      if (o.lobbying && o.enforces) {
        let superseded = false;
        if (o.enforces.standard) {
          const s = this.standards.standardRead({ id: o.enforces.standard, viewer });
          superseded = ok(s) && !!(s.superseded_by ?? s.supersededBy);
        } else if (o.enforces.subject) {
          const d = this.#determination(o.enforces.subject.determination, viewer);
          superseded = !!d && d.live === false;
        }
        if (superseded) out.push({ check: "enforces_superseded", option: o.id, says: localize("action-plans.says.requirement_seeks_enforced", "the requirement {id} seeks enforced has been superseded", { id: String(o.id) }) });
      }
    }
    const byId = new Map(options.map((o) => [o.id, o]));
    /* R39: a scenario set aside is not checked. */
    for (const sc of scenarios.filter((x) => !x.set_aside)) {
      for (const ph of sc.phases) {
        const start = ph.earliest ? this.#localDay(msOf(ph.earliest), zone) : null;
        for (const oid of ph.options) {
          const o = byId.get(oid);
          if (o && ph.earliest && start === null) for (const d of o.dates || [])
            out.push({ check: "date_before_phase", scenario: sc.scenario, phase: ph.id, option: oid, date: d.date, start: null, state: "undetermined",
              says: localize("action-plans.says.whether_regulated_date_falls", "whether {oid}'s regulated date {date} falls before phase {id} can start cannot be told: {day_undetermined}", { oid: String(oid), date: String(d.date), id: String(ph.id), day_undetermined: String(DAY_UNDETERMINED) }) });
          if (o && start) for (const d of o.dates || [])
            if (d.date < start) out.push({ check: "date_before_phase", scenario: sc.scenario, phase: ph.id, option: oid, date: d.date, start,
              says: localize("action-plans.says.regulated_date_falls", "{oid}'s regulated date {date} falls before phase {id} can start ({start})", { oid: String(oid), date: String(d.date), id: String(ph.id), start: String(start) }) });
        }
        const miss = unbranched(ph, sc.phases);
        if (miss.length) out.push({ check: "unbranched", scenario: sc.scenario, phase: ph.id, outcomes: miss,
          says: localize("action-plans.says.phase_checkpoint_leads", "phase {id}'s checkpoint leads nowhere when judged {miss}", { id: String(ph.id), miss: String(miss.join(" or ")) }) });
        const hostile = ph.options.some((x) => byId.get(x) && outward(byId.get(x)));
        if (hostile && !(ph.checkpoint && !unbranched(ph, sc.phases).includes("not_met")))
          out.push({ check: "no_hostile_branch", scenario: sc.scenario, phase: ph.id,
            says: localize("action-plans.index.phase_id_addresses_someone_outside", "phase {id} addresses someone outside the team and has no branch for a hostile response (a refusal, obstruction or retaliation): give it a checkpoint whose not_met judgement leads somewhere", { id: String(ph.id) }) });
      }
    }
    return out.map((c) => ({ ...c, informs: CHECK_SAYS }));
  }

  /** R7: the plans the viewer may see, in id order, at most 200 per page. */
  plansFor({ project = null, subject = null, state = null, after = null, limit = null, viewer } = {}) {
    const cap = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), PLANS_PAGE_MAX) : PLANS_PAGE_MAX;
    const s = subject === null || subject === undefined || subject === "" ? null
      : typeof subject === "string" ? subject : (normSubject(subject) ? subjectKey(normSubject(subject)) : "\u0000");
    const see = this.#sight(viewer);
    /* R35: a matter the viewer may not see finds nothing, so a plan's holding it is not told. */
    const asked = s === null ? null : subjectOfKey(s);
    if (asked && !see.subject(asked)) return { ok: true, items: [], truncated: false, cursor: null, limit: cap };
    const where = [], args = [];
    if (project) { where.push("p.project_id=?"); args.push(String(project)); }
    if (state) { where.push("p.state=?"); args.push(String(state)); }
    if (s !== null) { where.push("EXISTS (SELECT 1 FROM plan_subjects x WHERE x.plan_id=p.plan_id AND x.skey=? AND x.removed_seq IS NULL)"); args.push(s); }
    let cursor = after ? String(after) : "";
    const items = [];
    let truncated = false;
    for (;;) {
      const rows = this.#rows(`SELECT * FROM plans p WHERE p.plan_id > ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
                               ORDER BY p.plan_id LIMIT ?`, cursor, ...args, cap + 1);
      for (const r of rows) {
        cursor = r.plan_id;
        if (!this.#sees(r.project_id, viewer)) continue;
        if (items.length === cap) { truncated = true; break; }
        const held = this.#subjectsOf(r.plan_id).map((x) => x.subject);
        const shown = see.subjects(held);
        /* R45: a closed plan's closing note answers here too, so the planning run reads it through the read it has. */
        const closing = r.state === "closed" ? { closing_note: this.#closedView({ id: r.plan_id, closedBy: r.closed_by,
          closedAt: r.closed_at, closeReason: r.close_reason }).note } : {};
        items.push({ id: r.plan_id, project: r.project_id, title: r.title, state: r.state, opened_by: r.opened_by,
                     opened_at: r.opened_at, subjects: shown, ...closing, ...(shown.length !== held.length ? { out_of_view: true } : {}) });
      }
      if (truncated || rows.length <= cap) break;
    }
    return { ok: true, items, truncated, cursor: truncated ? items.at(-1).id : null, limit: cap };
  }

  /** R17: for open plans, the checkpoints whose day has come and that no member has judged, oldest first. */
  checkpointsDue({ nowMs, limit } = {}) {
    const now = Number.isFinite(nowMs) ? nowMs : this.#nowMs();
    const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, DUE_MAX) : DUE_MAX;
    const items = [];
    for (const r of this.#rows(`SELECT plan_id FROM plans WHERE state='open' ORDER BY plan_id`)) {
      const p = this.#plan(r.plan_id, null);
      const asides = this.#asides(p.id);
      for (const sc of this.#scenarios(p.id).filter((x) => !asides.has(x.scenario))) {
        const { judged, times } = this.#timed(p, sc, null, now);
        for (const ph of sc.phases) {
          const t = times.get(ph.id);
          if (!t.due || msOf(t.due) > now || judged.has(ph.id)) continue;
          items.push({ plan: p.id, project: p.project, scenario: sc.scenario, version: sc.version, phase: ph.id,
                       set_by: sc.author, due: t.due, days_since_due: Math.floor((now - msOf(t.due)) / DAY_MS) });
        }
      }
    }
    items.sort((a, b) => instantOrder(a.due, b.due) || (a.plan < b.plan ? -1 : a.plan > b.plan ? 1 : 0)
      || a.scenario - b.scenario || (a.phase < b.phase ? -1 : a.phase > b.phase ? 1 : 0));
    return { ok: true, as_of: iso(now), items: items.slice(0, cap), truncated: items.length > cap, limit: cap };
  }

  /* R34: the plan's planning runs, oldest first: those recorded at their open, and any that proposed. */
  #planRuns(planId) {
    const runs = this.#rows(`SELECT run, opened_at FROM plan_runs WHERE plan_id=?`, planId).map((r) => ({ run: r.run, at: r.opened_at }));
    for (const r of this.#rows(`SELECT run, MIN(at) AS at FROM plan_option_proposals WHERE plan_id=? AND run IS NOT NULL GROUP BY run`, planId))
      if (!runs.some((x) => x.run === r.run)) runs.push({ run: r.run, at: r.at });
    return runs.sort((a, b) => instantOrder(a.at, b.at) || (a.run < b.run ? -1 : 1)).map((r) => r.run);
  }
  /* R34: every proposal of a planning run, in the run's order (R31's submission order, the assistant's order of
     strength, strongest first), with no cut-off and no paging (Actions D17, K2443). */
  #tray(planId, run, see, viewer) {
    return this.#rows(`SELECT * FROM plan_option_proposals WHERE plan_id=? AND run=? ORDER BY run_ord`, planId, run)
      .map((r) => this.#proposalView(r, see, viewer));
  }

  /** R34: the tray: every proposal of a planning run, in the run's order, strongest first; the order is the only sign
   *  of strength, and nothing is cut off or paged. */
  planProposals({ plan, run, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan);
    const runs = this.#planRuns(p.id);
    const named = typeof run === "string" && run.trim() ? run.trim() : null;
    if (named && !runs.includes(named)) return refuseRunOtherPlan(named);
    const r = named ?? runs.at(-1) ?? null;
    if (!r) return { ok: true, plan: p.id, run: null, proposals: [] };
    const see = this.#sight(viewer);
    return { ok: true, plan: p.id, run: r, proposals: this.#tray(p.id, r, see, viewer),
             says: localize("action-plans.says.assistant_proposals_order", "every one of the assistant's proposals in its own order, strongest first; no score is recorded or answered"),
             ...(see.withheld ? { out_of_view: true } : {}) };
  }

  /** R51: a member asks the assistant for options on one plan. It opens the plan's planning run (`ai-runs.open`, mode
   *  `plan`, its R46; the run's proposals reach the tray, R31, R34), over the plan's project, the member its actor, as
   *  `plan-work` opens its re-examination run. While a planning run of this plan is running it opens none and answers
   *  that run (`existed: true`). It records no option, proposal or disposition: a member's own proposal is
   *  `optionPropose` (R11). A refusal of `ai-runs.open` is passed through unchanged. */
  async planAsk(args = {}) {
    const { plan, author, viewer } = args;
    const m = this.#member(author);
    if (m) return m;
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan);
    if (p.state === "closed") return refusePlanClosed(p.id);
    let held = this.#runningRun(p.id);
    if (!held && this.#asking.has(p.id)) {
      const run = await this.#asking.get(p.id);
      if (run) held = run;
    }
    if (held) {
      const fence = this.membership.projectAuthority(p.project, author, "joined", "planAsk");
      if (fence) return fence;
      return { ok: true, plan: p.id, run: held, started: false, existed: true };
    }
    const ai = this.aiRuns;
    const who = str(author);
    const run = `RUN-${hex8()}${hex8()}`;
    const opening = ai.open({ run, contextType: "project", contextId: p.project, mode: "plan", plan: p.id,
      label: localize("action-plans.label.asking_assistant_options", "asking the assistant for options on a plan"), principalPlane: who, principalAi: who, skillVersion: ASK_SKILL,
      bounds: ASK_BOUNDS.map((b) => ({ ...b })), actor: who, viewer: who });
    this.#asking.set(p.id, Promise.resolve(opening).then((r) => (r && r.started === true && r.ok !== false ? run : null), () => null));
    let r;
    try { r = await opening; }
    finally { this.#asking.delete(p.id); }
    if (!r || r.started !== true || r.ok === false) return r;
    return { ok: true, plan: p.id, run: r.run ?? run, started: true };
  }
  /* R51: a planning run of the plan that is running now (recorded at its open, R32), or null. */
  #runningRun(planId) {
    for (const r of this.#rows(`SELECT run FROM plan_runs WHERE plan_id=? ORDER BY opened_at DESC, run DESC`, planId)) {
      let live = null;
      try { live = this.aiRuns.runFor(r.run, null); } catch (e) { if (e instanceof ProviderAbsent) throw e; }
      if (live && live.status === "running") return r.run;
    }
    return null;
  }

  /** R30 (fills ai-runs R47): a planning run is opened over an open plan of its project, by a member who has joined it. */
  planRunCheck({ contextType, contextId, plan, actor, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(typeof plan === "string" ? plan : null);
    /* DEC-49 REGION is-plan-of-context */
    if (contextType !== "project" || contextId !== p.project)
      return refusal("PLAN_NOT_OF_PROJECT", `plan ${p.id} belongs to ${p.project}, and the run is opened over `
        + `${String(contextId ?? "").slice(0, 80) || "no project"}. Nothing was written.`, { plan: p.id });
    /* END DEC-49 REGION is-plan-of-context */
    if (p.state === "closed") return refusePlanClosed(p.id);
    return this.membership.projectAuthority(p.project, actor, "joined", "opening a planning run") || null;
  }

  /** R32: a planning run's opening, recorded with the project's `work_kinds` as they stood then (ai-runs R43). */
  runOpened({ run } = {}) {
    try {
      const r = this.aiRuns.runFor(run, null);
      if (!r || r.mode !== "plan" || typeof r.plan !== "string") return;
      const p = this.#plan(r.plan, null);
      if (!p) return;
      const wk = this.#workKinds(p.project);
      this.sql.exec(`INSERT OR IGNORE INTO plan_runs (run, plan_id, project_id, work_kinds_json, opened_at) VALUES (?,?,?,?,?)`,
        r.run, p.id, p.project, wk.state === "stated" ? JSON.stringify(wk.kinds) : null, this.now());
    } catch { /* a listener never changes the run (ai-runs R43) */ }
  }
}

/* R38: duties' reader for a viewer: an internal read (no viewer) is duties' own internal reader. */
const dutyViewer = (viewer) => (viewer === null || viewer === undefined ? DUTIES_INTERNAL : viewer);
/* R38: the day a civil-time date or due date names (its latest candidate when uncertain), or null. */
function dayIn(d) {
  if (typeof d === "string") return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
  if (!isObj(d) || d.undetermined) return null;
  if (Array.isArray(d.candidates) && d.candidates.length) return dayIn(d.candidates[d.candidates.length - 1]);
  return dayIn(d.value ?? d.date ?? null);
}
/* R38: when a derived state began to hold: overdue the day after the due date (after its latest candidate, K1444 (i)),
   met or met late the matched event's day; otherwise the read itself. */
function derivedSince(occ, nowMs) {
  if (occ.state === "overdue") { const d = dayIn(occ.due && occ.due.date); return d ? Date.parse(`${d}T00:00:00Z`) + DAY_MS : nowMs; }
  if (occ.state === "met" || occ.state === "met_late") {
    const ev = (occ.evidence || []).find((e) => e && e.when);
    const d = ev ? dayIn(ev.when) : null;
    return d ? Date.parse(`${d}T00:00:00Z`) : nowMs;
  }
  return nowMs;
}

/* R6 (T45): the decision log, from the history as the viewer reads it: each choice and decline, scenario set aside or
   restored, pause and resume, start-first reason and the close, with its reason and date, oldest first. */
function decisionsOf(history) {
  const out = [];
  for (const h of history) {
    const base = { by: h.author, at: h.at };
    if (h.kind === "dispose" && (h.disposition === "chosen" || h.disposition === "declined"))
      out.push({ decision: h.disposition, options: h.options || [], reason: h.reason ?? null, ...base });
    else if (h.kind === "scenario_set_aside" || h.kind === "scenario_restore")
      out.push({ decision: h.kind === "scenario_set_aside" ? "set_aside" : "restored", scenario: h.scenario, reason: h.reason ?? null, ...base });
    else if (h.kind === "pause" || h.kind === "resume")
      out.push({ decision: h.kind === "pause" ? "paused" : "resumed", reason: h.reason ?? null,
                 ...(h.kind === "pause" ? { look_again: h.look_again ?? null } : {}), ...base });
    else if (h.kind === "start" && typeof h.why_first === "string")
      out.push({ decision: "started_first", option: h.option, reason: h.why_first, ...base });
    else if (h.kind === "close")
      out.push({ decision: "closed", reason: h.reason ?? null, ...base });
  }
  return out;
}

/* R43: a mark's label: machine work, written by the plan's re-examination; it decides nothing. */
const MARK_LABEL = Object.freeze({ machine_work: true, by: "plan-work", says: word("action-plans.says.marked_plan_examination") });
/* R43: the response that caused a mark, `{action, ord}`; null when it is not one. */
function causeOf(c) {
  if (typeof c === "string") { const m = /^([^#\s]{1,120})#(\d{1,6})$/.exec(c); return m ? { action: m[1], ord: Number(m[2]) } : null; }
  return isObj(c) && isToken(c.action) && Number.isInteger(Number(c.ord)) && Number(c.ord) >= 0 ? { action: c.action, ord: Number(c.ord) } : null;
}
/* R43: what is wrong with a mark, or null. */
function markFault(m) {
  if (!isObj(m) || !MARK_KINDS.includes(m.kind)) return `a mark's kind is one of ${MARK_KINDS.join(", ")}`;
  if (typeof m.why !== "string" || !m.why.trim() || m.why.length > WHY_MAX) return `a mark says why, in 1 to ${WHY_MAX} characters`;
  if (m.kind === "option_changed" && !isToken(m.option)) return "an option_changed mark names the option";
  if (m.kind === "phase_start_holds" && !(Number.isSafeInteger(Number(m.scenario)) && Number(m.scenario) >= 1 && isToken(m.phase)))
    return "a phase_start_holds mark names the scenario and the phase";
  if (m.kind === "next_routes" && !(Array.isArray(m.routes) && m.routes.length >= 1 && m.routes.length <= 20 && m.routes.every((r) => isLine(r, 200))))
    return "a next_routes mark names 1 to 20 routes";
  return null;
}
function normMark(m) {
  return { kind: m.kind, why: m.why, ...(m.kind === "option_changed" ? { option: m.option } : {}),
           ...(m.kind === "phase_start_holds" ? { scenario: Number(m.scenario), phase: m.phase } : {}),
           ...(m.kind === "next_routes" ? { routes: [...m.routes] } : {}) };
}

/* R7, R35: the subject a key (R3's identity) names; null for a string that is not one. */
function subjectOfKey(k) {
  const m = /^inquiry:(.+)$/.exec(k) || /^outcome:([^#]+)#(.+)$/.exec(k);
  if (!m) return null;
  return k.startsWith("inquiry:") ? normSubject({ kind: "inquiry", inquiry: m[1] })
    : normSubject({ kind: "outcome", determination: m[1], standard: m[2] });
}

/* ===================================================================== *
 * THE ACTION AN OPTION STARTS (R18)
 * ===================================================================== */

/* R18 (actions R74): the member's premise override as given, `{ground, reason}` (a bare string is its reason); null
   when none. The ground is passed to the action as stated: actions judges it (OVERRIDE_NO_GROUND, OVERRIDE_GROUND_REFUSED). */
function overrideOf(o) {
  if (o === undefined || o === null) return null;
  if (!isObj(o)) return { reason: String(o) };
  return { ...(o.ground !== undefined ? { ground: o.ground } : {}), reason: typeof o.reason === "string" ? o.reason : o.reason ?? null };
}
/* R18: a ground's lines in the action's front matter, as actions writes them (`ground_kind`, `ground_citation`, ...); a
   ground that is not a flat map is written as its kind, for actions to refuse, never dropped. */
function groundLines(g) {
  const word = (v) => q(typeof v === "string" ? v : JSON.stringify(v ?? ""));
  if (!isObj(g)) return [`  ground_kind: ${word(g)}`];
  return Object.entries(g).filter(([k]) => /^[a-z]{1,20}$/.test(k)).map(([k, v]) => `  ground_${k}: ${word(v)}`);
}

/** R18: the action document composed from a chosen option: its kind, the option's addressee, its regulated dates as
 *  pending clock entries with their bases, a `rests_on` leg to each subject's inquiry or determination, `plan` and
 *  `option`, `contact`, `breach` and `premise_override` when given; and the plan's `project`, so the action is fenced
 *  by the plan's project's sight (promotion R53; R25, DEC-36; K2851). A machine proposal's disclosure is not carried
 *  (R32): the member's adoption made the option the group's. */
export function actionDocument({ fields, kind, project = null, plan, option, contact, breach, override, at }) {
  const legs = [...new Set((fields.subjects || []).map((s) => (s.kind === "inquiry" ? s.inquiry : s.determination)))];
  const a = fields.addressee;
  const cp = a ? ["counterparty:", ...Object.entries(a).map(([k, v]) => `  ${k}: ${q(v)}`)] : [];
  const clock = (fields.dates || []).length
    ? ["clock:", ...fields.dates.flatMap((d) => [`  - text: ${q(fields.summary)}`, `    description: ${q(`regulated date: ${d.basis}`)}`,
        `    date: "${d.date}"`, `    basis: ${q(d.basis)}`, "    status: pending"])] : ["clock: []"];
  const basis = legs.length ? ["action_basis:", ...legs.flatMap((t) => [`  - target: ${t}`, "    kind: rests_on"])] : ["action_basis: []"];
  return ["---", "id: PENDING", "object_type: action", `title: ${q(fields.summary)}`, "current_state: planned",
    `created: "${at}"`, `last_updated: "${at}"`, ...(project ? [`project: ${tok(project)}`] : []),
    `action_kind: ${q(typeof kind === "string" ? kind : "")}`, ...cp, ...clock,
    ...basis, `plan: ${plan}`, `option: ${option}`, ...(contact ? [`contact: ${contact}`] : []),
    ...(breach ? ["breach: true"] : []),
    ...(override ? ["premise_override:", ...(override.ground !== undefined ? groundLines(override.ground) : []),
                    `  reason: ${q(override.reason ?? "")}`] : []),
    "correspondence: []", "---", "", "## Action", "", fields.detail ? fields.detail.replace(/\r/g, "") : fields.summary, ""].join("\n");
}

/* ===================================================================== *
 * THE CODES SEVERAL ACTS ANSWER, each minted once (DEC-49's one code, one site; K231)
 * ===================================================================== */

const NO_SUCH_PLAN_DETAIL = "no action plan answers to that id here. A plan in a project you may not see is answered "
  + "exactly as one that does not exist, so this is not a hint either way.";
const NO_SUCH_PLAN_FIXED = new Set(["ok", "reason", "code", "check", "translation", "plan", "detail"]);
/** R22: the one answer to "no plan the caller may read answers to this id", in `standards` R17's form. Writes nothing
 *  and never throws. */
export function noSuchPlan(planIdAsked, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NO_SUCH_PLAN_FIXED.has(k));
  } catch { own = []; }
  let plan = null;
  try { plan = planIdAsked === undefined || planIdAsked === null ? null : String(planIdAsked); } catch { plan = null; }
  /* DEC-49 REGION is-plan-seen */
  const row = ACTION_PLAN_CHECKS.NO_SUCH_PLAN;
  return { ok: false, reason: "NO_SUCH_PLAN", code: "NO_SUCH_PLAN", check: row.check, translation: row.translation, plan,
           ...Object.fromEntries(own), detail: NO_SUCH_PLAN_DETAIL };
  /* END DEC-49 REGION is-plan-seen */
}

/** R1, R4, R33, R39, R40 (K2851): the one site that mints MACHINE_CANNOT_PLAN (C-124.1, K231): a plan's own acts are a
 *  named member's. `plan-work` answers through it. Writes nothing and never throws. */
export function machineCannotPlan(extra = null) {
  /* DEC-49 REGION is-plan-member */
  return refusal("MACHINE_CANNOT_PLAN", "an action plan is opened, changed and closed by a named member; a machine "
    + "proposes and never acts. Nothing was written.",
    isObj(extra) ? Object.fromEntries(Object.entries(extra).filter(([k]) => !["ok", "reason", "detail"].includes(k))) : {});
  /* END DEC-49 REGION is-plan-member */
}

/** R1: an inquiry absent or unseen is one answer. */
export function refuseNoSuchInquiry(inquiry, extra = null) {
  /* DEC-49 REGION is-inquiry-seen */
  return refusal("NO_SUCH_INQUIRY", "no question answers to that id here; one you may not see is answered exactly as one "
    + "that does not exist. Nothing was written.", { inquiry: typeof inquiry === "string" ? inquiry : null, ...(extra || {}) });
  /* END DEC-49 REGION is-inquiry-seen */
}

/** R1, R4: a plan is about 1 to 50 matters; `count` is how many the act would leave or name. */
export function refuseNoSubject(detail, count) {
  /* DEC-49 REGION is-plan-subjects */
  return refusal("PLAN_NO_SUBJECT", detail || `a plan is about 1 to ${SUBJECTS_MAX} matters. Nothing was written.`,
    { count: count ?? null, max: SUBJECTS_MAX });
  /* END DEC-49 REGION is-plan-subjects */
}

/** R1, R4: a matter that is not one, named twice, measured by no standard named, or not in the plan. */
export function refuseMalformed(detail, index) {
  /* DEC-49 REGION is-subject-shaped */
  return refusal("SUBJECT_MALFORMED", detail || word("refusal.SUBJECT_MALFORMED"), { index: index ?? null });
  /* END DEC-49 REGION is-subject-shaped */
}

/** R4, R9, R13, R14, R16, R18, R20, R30: a closed plan takes no act. */
export function refusePlanClosed(plan) {
  /* DEC-49 REGION is-plan-open */
  return refusal("PLAN_CLOSED", "this plan is closed; it stays readable and nothing is added to it. Nothing was written.",
    { plan });
  /* END DEC-49 REGION is-plan-open */
}

/** R4's text rule: a reason of 1 to 500 characters with no quote, backslash or line break; `needed` says whether one is
 *  required (one given where it is not is still held to the rule). Null when it passes. */
export function refuseReason(reason, needed) {
  const given = reason !== undefined && reason !== null && reason !== "";
  /* DEC-49 REGION is-reason-given */
  if ((needed && !given) || (given && !isLine(reason, REASON_MAX)))
    return refusal("PLAN_NO_REASON", `a reason of 1 to ${REASON_MAX} characters, with no quotation mark, backslash or `
      + "line break, is required here. Nothing was written.", { max: REASON_MAX });
  /* END DEC-49 REGION is-reason-given */
  return null;
}

/** R26: an input carrying a cost, budget, assignee, hours or significance score is refused; null when it carries none. */
export function refuseKeys(args) {
  const found = isObj(args) ? REFUSED_KEYS.filter((k) => k in args) : [];
  /* DEC-49 REGION is-no-cost-or-score */
  if (found.length)
    return refusal("OPTION_KEY_REFUSED", `a plan holds no ${found.join(", ")}: no cost, budget, money to be spent, `
      + "assignee, hours or significance score. Nothing was written.", { keys: found });
  /* END DEC-49 REGION is-no-cost-or-score */
  return null;
}

/** R13, R9, R18: the first option the plan does not hold. */
export function refuseNoSuchOption(option) {
  /* DEC-49 REGION is-option-held */
  return refusal("NO_SUCH_OPTION", `the plan holds no option ${option === null || option === undefined ? "(none named)"
    : String(option).slice(0, 80)}. Nothing was written.`, { option: option ?? null });
  /* END DEC-49 REGION is-option-held */
}

/** R11, R41: no proposal, or no standing offer, of a plan the caller may see answers to what was named. */
export function refuseNoSuchProposal(detail, extra = null) {
  /* DEC-49 REGION is-proposal-seen */
  return refusal("NO_SUCH_PLAN_PROPOSAL", detail || "no proposal answers to that id in a plan this caller may see. Nothing was "
    + "written.", extra || {});
  /* END DEC-49 REGION is-proposal-seen */
}

/** R31, R34: a run that is not a planning run of this plan. */
export function refuseRunOtherPlan(run) {
  /* DEC-49 REGION is-run-of-plan */
  return refusal("PROPOSAL_RUN_OTHER_PLAN", localize("action-plans.index.run_string_is_not_a", "run {String} is not a planning run of this plan. Nothing was written.", { String: String(String(run ?? "").slice(0, 80)) }), { run: run ?? null });
  /* END DEC-49 REGION is-run-of-plan */
}

/** K248: a provider this host has not been given. The act or read that needs it refuses, naming it, and never answers
 *  as though its part were empty. */
export function refuseProviderUnavailable(provider) {
  /* DEC-49 REGION is-provider-present */
  return refusal("PLAN_PROVIDER_UNAVAILABLE", `this answer reads the ${provider} module, which this instance does not have `
    + "yet; nothing is answered in its place.", { provider });
  /* END DEC-49 REGION is-provider-present */
}

class ProviderAbsent extends Error {
  constructor(provider) { super(localize("action-plans.index.action_plans_provider_was_not", "action-plans: {provider} was not given", { provider: String(provider) })); this.provider = provider; }
}

/* Every service answers PROVIDER_UNAVAILABLE, rather than throwing or answering in part, when a provider it reads is
   absent (K248). */
for (const name of ["planOpen", "planSubjectAdd", "planSubjectRemove", "planRead", "plansFor", "optionAdd", "optionRevise",
                    "optionAdopt", "optionDispose", "scenarioSet", "checkpointRecord", "optionStart", "optionStartPreview", "planClose",
                    "checkpointsDue", "planProposals", "planRunCheck", "scenarioSetAside", "scenarioRestore", "planPause",
                    "planResume", "plansToLookAgain", "planMark", "closingNotesOf"]) {
  const f = ActionPlans.prototype[name];
  Object.defineProperty(ActionPlans.prototype, name, { configurable: true, writable: true, value: function (...a) {
    try { return f.apply(this, a); }
    catch (e) { if (e instanceof ProviderAbsent) return refuseProviderUnavailable(e.provider); throw e; }
  } });
}
for (const name of ["optionPropose", "planAsk"]) {
  const f = ActionPlans.prototype[name];
  Object.defineProperty(ActionPlans.prototype, name, { configurable: true, writable: true, value: async function (...a) {
    try { return await f.apply(this, a); }
    catch (e) { if (e instanceof ProviderAbsent) return refuseProviderUnavailable(e.provider); throw e; }
  } });
}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It migrates its tables, declares them to
 *  purge (R27), registers its check and projection with promotion (R21, R24, R27), and its planning-run check and run
 *  listener with ai-runs (R30, R32). */
export function actionPlansOf(host, deps) {
  let i = instances.get(host);
  if (!i) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const base = { record, membership, promotion };
    const lazy = (name, make) => (d[name] !== undefined ? d[name] : () => make());
    i = new ActionPlans({ ...d, storage, record, membership, promotion,
      legEarning: lazy("legEarning", () => legEarningOf(host, base)),
      strength: lazy("strength", () => strengthOf(host, base)),
      basisVersions: lazy("basisVersions", () => basisVersionsOf(host, base)),
      conformance: lazy("conformance", () => conformanceOf(host, base)),
      standards: lazy("standards", () => standardsOf(host, base)),
      actions: lazy("actions", () => actionsOf(host, base)),
      clocks: lazy("clocks", () => actionClocksOf(host, base)),
      escalation: lazy("escalation", () => escalationOf(host, base)),
      filings: lazy("filings", () => filingsOf(host, base)),
      duties: lazy("duties", () => dutiesOf(host, base)),
      aiRuns: lazy("aiRuns", () => aiRunsOf(host)) });
    instances.set(host, i);
    i.migrate();
    record.declarePurge("action-plans", ACTION_PLANS_TABLES);
    promotion.registerStep("action-plans", { check: (c) => i.check(c), project: (c) => i.project(c) });
    let runs = null;
    try { runs = i.aiRuns; } catch { runs = null; }
    if (runs) {
      runs.registerOpenCheck("action-plans", "plan", (a) => i.planRunCheck(a));
      runs.onRunOpened("action-plans", (e) => i.runOpened(e));
    }
  }
  return i;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function actionPlansOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return ACTION_PLANS_TABLES.some((x) => x.name === name);
}

/** The module's ops (K3, K671), as entries of the plane's op map; `plane`'s store (`src/plane/store.mjs`) spreads them
 *  into its dispatch. `viewer`, `author`, `proposer` and `principal` are the control plane's stamps, read from the
 *  query and set after the body, so a caller's own copy never wins. */
export function actionPlansOps(m, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const pick = (k) => (url.searchParams.has(k) ? qp(k) : b[k] ?? null);
  const stamped = (extra = {}) => ({ ...b, ...extra, author: qp("author"), viewer: qp("viewer") });
  const now = () => { const n = Number(qp("now")); return Number.isFinite(n) && qp("now") !== null ? n : undefined; };
  return {
    planopen: () => m.planOpen(stamped({ project: pick("project"), title: pick("title") })),
    plansubjectadd: () => m.planSubjectAdd(stamped({ plan: pick("plan"), reason: pick("reason") })),
    plansubjectremove: () => m.planSubjectRemove(stamped({ plan: pick("plan"), reason: pick("reason") })),
    plan: () => m.planRead({ id: pick("id") ?? pick("plan"), nowMs: now(), viewer: qp("viewer") }),
    plans: () => m.plansFor({ project: pick("project"), subject: b.subject ?? qp("subject"), state: pick("state"),
                              after: pick("after"), limit: pick("limit"), viewer: qp("viewer") }),
    optionadd: () => m.optionAdd(stamped({ plan: pick("plan") })),
    optionrevise: () => m.optionRevise(stamped({ plan: pick("plan"), option: pick("option") })),
    optionpropose: () => m.optionPropose({ ...b, plan: pick("plan"), run: pick("run"), proposer: qp("proposer"),
                                                   principal: qp("principal"), viewer: qp("viewer") }),
    optionadopt: () => m.optionAdopt(stamped({ proposal: pick("proposal") })),
    optiondispose: () => m.optionDispose(stamped({ plan: pick("plan"), disposition: pick("disposition") })),
    scenarioset: () => m.scenarioSet(stamped({ plan: pick("plan"), scenario: pick("scenario") })),
    checkpointrecord: () => m.checkpointRecord(stamped({ plan: pick("plan"), scenario: pick("scenario"), phase: pick("phase"),
                                                         judged: pick("judged") })),
    optionstart: () => m.optionStart(stamped({ plan: pick("plan"), option: pick("option"), kind: pick("kind") })),
    optionstartpreview: () => m.optionStartPreview(stamped({ plan: pick("plan"), option: pick("option"), kind: pick("kind") })),
    planclose: () => m.planClose(stamped({ id: pick("id") ?? pick("plan"), reason: pick("reason") })),
    planproposals: () => m.planProposals({ plan: pick("plan"), run: pick("run"), viewer: qp("viewer") }),
    scenariosetaside: () => m.scenarioSetAside(stamped({ plan: pick("plan"), scenario: pick("scenario"), reason: pick("reason") })),
    scenariorestore: () => m.scenarioRestore(stamped({ plan: pick("plan"), scenario: pick("scenario"), reason: pick("reason") })),
    planpause: () => m.planPause(stamped({ id: pick("id") ?? pick("plan"), reason: pick("reason"), look_again: pick("look_again") })),
    planresume: () => m.planResume(stamped({ id: pick("id") ?? pick("plan"), reason: pick("reason") })),
    planask: () => m.planAsk(stamped({ plan: pick("plan") })),
  };
}

/* R52 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  planopen: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("action-plans.declared.planopen", "project-directed: a member opens a plan for one project over named subjects, keyed by project; writes a PLN- record object"),
    fields: { accepts: ["project","subjects","title"], requires: ["project","title","subjects"] } },
  plansubjectadd: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("action-plans.declared.plansubjectadd", "plan-directed: a member adds a subject to a plan with a reason, keyed by (plan, subject); kept in the plan's history"),
    fields: { accepts: ["plan","subject","reason"], requires: ["plan","subject","reason"] } },
  planclose: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("action-plans.declared.planclose", "plan-directed: a member closes a plan with a reason, keyed by plan id; the plan stays readable"),
    fields: { accepts: ["id","plan","reason","note"], requires: [["id","plan"],"reason"] } },
  optionadd: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("action-plans.declared.optionadd", "plan-directed: a member adds an option to a plan, keyed by plan; writes an option row"),
    fields: { accepts: ["plan","summary","detail","category","subjects","addressee","dates","tier","lobbying","enforces"], requires: ["plan","summary","category","subjects"] } },
  optionadopt: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("action-plans.declared.optionadopt", "proposal-directed: a member adopts a proposal as an option, keyed by proposal; at most once"),
    fields: { accepts: ["proposal","offer","plan","summary","detail","category","subjects","addressee","dates","tier","lobbying","enforces"], requires: [["proposal","offer"]] } },
  optiondispose: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("action-plans.declared.optiondispose", "option-directed: a member disposes of one or more options (open, chosen, declined, done, blocked), keyed by (plan, options); every change kept in the option's history"),
    fields: { accepts: ["plan","options","disposition","reason","reminders"], requires: ["plan","options","disposition"] } },
  scenarioset: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("action-plans.declared.scenarioset", "plan-directed: a member sets one of a plan's scenarios whole, keyed by (plan, scenario); the earlier version kept in history"),
    fields: { accepts: ["plan","scenario","name","phases"], requires: ["plan","scenario","name","phases"] } },
  checkpointrecord: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("action-plans.declared.checkpointrecord", "scenario-directed: a member judges a phase's checkpoint met or not met, keyed by (plan, scenario, phase); judged once"),
    fields: { accepts: ["plan","scenario","phase","judged","note"], requires: ["plan","scenario","phase","judged"] } },
  optionstart: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("action-plans.declared.optionstart", "option-directed: a member starts a chosen option as an action, keyed by (plan, option); composes and promotes the action"),
    fields: { accepts: ["plan","option","kind","contact","breach","premise_override","why_first"], requires: ["plan","option","kind"] } },
  optionstartpreview: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("action-plans.declared.optionstartpreview", "read: what starting a chosen option would do at this instant, keyed by (plan, option) — the action it would compose, the reminders it would set, and whether it would start or the refusal it would answer; allocates no id, sets no reminder and writes nothing"),
    fields: { accepts: ["plan","option","kind","contact","breach","premise_override","why_first"], requires: ["plan","option","kind"] } },
  planask: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("action-plans.declared.planask", "plan-directed: keyed by a plan; a member asks the assistant for options on it, opening one planning run whose proposals reach the member's tray; writes no option and moves no bundle"),
    fields: { accepts: ["plan"], requires: ["plan"] } },
});

/** R56 (T53): a `produced_by` as sent: null when absent or null; the list of label objects, each holding only a label's
 *  fields (`ai-runs`' `LABEL_FIELDS`), with string or null values, deduplicated with the first kept, in order;
 *  `undefined` when malformed. */
function producedByOf(v) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return undefined;
  const out = [], seen = new Set();
  for (const l of v) {
    if (!l || typeof l !== "object" || Array.isArray(l)) return undefined;
    const keys = Object.keys(l);
    if (!keys.length || keys.some((k) => !AiRuns.LABEL_FIELDS.includes(k))) return undefined;
    if (keys.some((k) => l[k] !== null && typeof l[k] !== "string")) return undefined;
    const key = JSON.stringify(AiRuns.LABEL_FIELDS.filter((k) => k in l).map((k) => [k, l[k]]));
    if (!seen.has(key)) { seen.add(key); out.push({ ...l }); }
  }
  return out;
}
