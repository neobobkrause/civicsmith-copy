/* plan-work — the work of managing an action plan as it goes and handing it over (requirements:
 * `build/requirements/plan-work.md`; `BIO_Action_v0_2.md` §3, §4 rules 1, 16, 17, 18, 20; Actions D14, D21, D27): what
 * the group wants of each matter and how far it has gone, one timeline, reviews, preparation taken up, comments, "where
 * it stands", status reports, taking up an item, and the re-examination a recorded response sets off.
 *
 * A new module at T45 (K2781 (1)), after `action-plans`, which keeps the plan itself; nothing moves here.
 *
 * WHAT IT DECIDES, AND WHAT IT NEVER DOES. A member does every act (R1, R4–R6, R8, R11); the machine marks (R10, through
 * `action-plans.planMark` only) and assembles, labelled (R8). Every fact about a plan, an action, a deadline, an
 * escalation, a cure, a filing or a hold is read through the module that owns it, as the reader may see it; a matter's
 * state, the timeline, where it stands and a review's changes are derived when read, never stored (R2, R3, R7). Nothing
 * here is published or scored, no field holds a cost, hours, assignee or score, and nobody assigns anybody (R12): a
 * take-up is a member routing an item to herself (R5, R11). No place is named in its behaviour or text.
 *
 * REACHED as `planWorkOf(host, deps)` (K61): one instance per host, created on the first call with `deps`. At creation
 * it migrates its tables, declares them to purge (R12), registers its closing summary with `action-plans` (R7, its R44)
 * and its re-examination with `actions` (R10, its R95), each where the provider offers the registration.
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership     layer 2: `transact`, `readFile`, `bundleInfo`, `declarePurge`; `memberFacts`.
 *   actionPlans            `planRead`, `plansFor`, `planMark`, `registerCloseSnapshot` (its R6, R7, R43, R44); its
 *                          `machineCannotPlan` (K2851), the one site of MACHINE_CANNOT_PLAN.
 *   actions                `actionRead`, `registerResponseListener`, `place` (its R29, R95, R68).
 *   actionHolds            `projectHolds`, `holdsDue`, `holdsOf` (its R7, R3, R2; R7, R11); through its factory (K2856).
 *   actionReplies          `aroseFrom`, `arisenFrom` (its R2; R10); through its factory (K2862).
 *   escalation             `escalationsFor`, `escalationRead` (its R22, R2; R2, R3, R11).
 *   filings                `filingsFor` (its R13; R2, R6).
 *   conformance            `curesOf` (its R37; R2).
 *   duties                 `dutiesArisingIn`, `transitionsOf` (its R31, R14; R13, R15).
 *   readingGuides          `procedureGuidesFor` (its R13; R10).
 *   aiRuns                 `open` (its R77; R10).
 *   now                    the instance clock, an ISO string (default: the wall clock, to the second). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, listenerRefusal } from "../membership/index.mjs";
import { actionPlansOf, noSuchPlan, refusePlanClosed, refuseReason, refuseKeys, refuseNoSuchOption,
         machineCannotPlan } from "../action-plans/index.mjs";
import { isObj, str, isDay, isLine, normSubject, subjectKey } from "../action-plans/values.mjs";
import { actionsOf, zoneOf } from "../actions/index.mjs";
import { actionHoldsOf } from "../action-holds/index.mjs";
import { actionRepliesOf } from "../action-replies/index.mjs";
import { escalationOf } from "../escalation/index.mjs";
import { filingsOf } from "../filings/index.mjs";
import { conformanceOf } from "../conformance/index.mjs";
import { dutiesOf, INTERNAL as DUTIES_INTERNAL } from "../duties/index.mjs";
import { readingGuidesOf } from "../reading-guides/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { expandRecurrence, localDay } from "../civil-time/index.mjs";
import { isMachineIdentity, proposalLabel, parseFrontmatter, sha256HexSync, ISO_TS_RE } from "../record-grammar/index.mjs";
import { PLAN_WORK_TABLES, migratePlanWork } from "./schema.mjs";
import { PLAN_WORK_CHECKS, refusal } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { PLAN_WORK_SCHEMA, PLAN_WORK_TABLES } from "./schema.mjs";
export { PLAN_WORK_CHECKS } from "./checks.mjs";

/** R2: a matter's states, in the order the first that holds is answered. */
export const MATTER_STATES = Object.freeze(["ended", "fixed", "stopped", "acting", "fix_offered", "documented", "none"]);
/** R11: the kinds of item a member may take up. */
export const ITEM_KINDS = Object.freeze(["clock", "checkpoint", "escalation_stage", "hold"]);
/** R10: the kinds of mark a re-examination writes through `action-plans.planMark` (its R43, K2848). The chance to fix
 *  re-offered is action-plans R41's derivation on read, never a mark. */
export const MARK_KINDS = Object.freeze(["option_changed", "phase_start_holds", "next_routes"]);
/** R10 (action-plans R43): a mark's `why` is 1 to 500 characters; `next_routes` names at most 20 routes. */
export const MARK_WHY_MAX = 500;
export const MARK_ROUTES_MAX = 20;
/** R10: the skill version and bounds a re-examination run is opened under (a planning run: no search, R46). */
export const REEXAM_SKILL = "planning@1";
export const REEXAM_BOUNDS = Object.freeze([Object.freeze({ bound: "proposals", allowed: 20 }),
                                            Object.freeze({ bound: "wallclock", allowed: 600000 })]);
/** R8: the label every assembled draft carries. */
export const DRAFT_LABEL = Object.freeze({ machine_work: true, by: "system",
  says: word("plan-work.says.assembled_system_where") });
/** R14: who a report that began as the assistant's draft names as its drafter: a machine identity, so its label's state
 *  is `machine_proposed`. */
export const ASSISTANT = "class:ai";
/** R16 (K2978): the label a kept report's `from` carries when its text began as the assistant's draft, at its one site:
 *  `record-grammar`'s `proposalLabel(by, "status_report")` (its R61), its state and sentence that subject's. A report
 *  written by the member alone carries none. */
export const ASSIST_LABEL = Object.freeze(proposalLabel(ASSISTANT, "status_report"));
/** R15: the occurrence states that read a duty met (`duties` Terms; a promise kept late is kept). */
const MET_STATES = Object.freeze(["met", "met_late"]);

export const OUTCOME_MAX = 1000;
export const DECIDED_MAX = 4000;
export const PREP_MAX = 500;
export const COMMENT_MAX = 4000;
export const REPORT_MAX = 8000;
export const NEXT_MAX = 10;
export const DUE_MAX = 500;
export const TAKEUPS_MAX = 500;

const DAY_MS = 86400000;
/** The module's own read (no viewer) of the modules that gate by a viewer: the plane's machine class, which sees every
 *  bundle (membership R43). A member's read passes her own viewer. */
export const PLANE = "class:daemon";
const sightOf = (v) => (v === null || v === undefined ? PLANE : v);
const OFFER_KINDS = Object.freeze(["document_infraction", "chance_to_fix"]);
const msOf = (v) => (typeof v !== "string" || !v ? NaN : /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : Date.parse(v));
const iso = (ms) => stampInstant("second", ms);
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const ok = (r) => !!r && r.ok !== false;
const unjson = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const isMachine = (who) => str(who) === "" || isMachineIdentity(str(who));
const memberOf = (who) => { const s = str(who); return s.startsWith("member:") ? s.slice(7) : s; };
const byDate = (a, b) => (msOf(a.at) - msOf(b.at)) || String(a.kind).localeCompare(String(b.kind));
const seqOf = (rows) => (rows[0] && Number.isInteger(rows[0].n) ? rows[0].n : 0) + 1;

export class PlanWork {
  constructor(deps) {
    this.record = deps.record;
    this.membership = deps.membership;
    this.sql = (deps.storage || {}).sql;
    this.deps = deps;
    this.now = deps.now || (() => stampInstant("second"));
    this.watchReader = null;
  }

  /* The providers, reached when first needed (layer 9 and earlier). */
  get actionPlans() { return this.#dep("actionPlans"); }
  get actions() { return this.#dep("actions"); }
  get actionHolds() { return this.#dep("actionHolds"); }
  get actionReplies() { return this.#dep("actionReplies"); }
  get escalation() { return this.#dep("escalation"); }
  get filings() { return this.#dep("filings"); }
  get conformance() { return this.#dep("conformance"); }
  get duties() { return this.#dep("duties"); }
  get readingGuides() { return this.#dep("readingGuides"); }
  get aiRuns() { return this.#dep("aiRuns"); }
  #dep(name) {
    const d = this.deps[name];
    let v;
    try { v = typeof d === "function" ? d() : d; } catch { v = null; }
    if (!v) throw new ProviderAbsent(name);
    return v;
  }
  /* A provider, or null when this host has none (a read that can say "undetermined" in its place). */
  #maybe(name) { try { return this.#dep(name); } catch { return null; } }

  /** R12: the module's tables; run at creation, and safe to run again. */
  migrate() { migratePlanWork(this.sql); }

  #rows(qy, ...a) { return [...this.sql.exec(qy, ...a)]; }
  #nowMs(explicit) { return Number.isFinite(explicit) ? explicit : msOf(this.now()); }

  /* ===================================================================== *
   * THE PLAN, AS ITS READER MAY SEE IT
   * ===================================================================== */

  /* The plan as `action-plans` answers it to `viewer` (null: the module's own read); null when it does not. */
  #plan(id, viewer, nowMs) {
    if (typeof id !== "string" || !id) return null;
    const p = this.actionPlans.planRead({ id, viewer: sightOf(viewer), ...(Number.isFinite(nowMs) ? { nowMs } : {}) });
    return ok(p) ? p : null;
  }

  /** Every act: a named member first (`MACHINE_CANNOT_PLAN`, action-plans' row), then a plan she may see
   *  (`NO_SUCH_PLAN`), then not closed (`PLAN_CLOSED`); a paused plan takes every act (action-plans R40). */
  #act(planId, author, viewer) {
    if (isMachine(author)) return { r: machineCannotPlan() };
    const p = this.#plan(planId, viewer);
    if (!p) return { r: noSuchPlan(typeof planId === "string" ? planId : null) };
    if (p.state === "closed") return { r: refusePlanClosed(p.id) };
    return { p };
  }

  /** R1, R13: the matter named, one of the plan's own; `{s, key}` or `{r}`. */
  #matter(p, subject) {
    const s = typeof subject === "string" ? null : normSubject(subject);
    const key = s ? subjectKey(s) : typeof subject === "string" ? subject : null;
    const held = (p.subjects || []).find((x) => x.key === key);
    /* DEC-49 REGION is-matter-of-plan */
    if (!held)
      return { r: refusal("MATTER_NOT_OF_PLAN", localize("plan-work.index.the_plan_is_not_about", "the plan is not about that matter. Nothing was written."),
        { plan: p.id, subject: s ?? (typeof subject === "string" ? subject.slice(0, 200) : null) }) };
    /* END DEC-49 REGION is-matter-of-plan */
    return { s: held.subject, key: held.key };
  }

  /* The options serving a matter (by key), and the actions started from them the reader may see. */
  #serving(p, key) { return (p.options || []).filter((o) => (o.subjects || []).some((s) => s && subjectKey(s) === key)); }
  #actionOf(id, viewer, nowMs) {
    if (typeof id !== "string" || !id) return null;
    const a = this.actions.actionRead({ id, viewer: sightOf(viewer), ...(Number.isFinite(nowMs) ? { now: nowMs } : {}) });
    return ok(a) ? a : null;
  }
  /* The plan's actions the reader may see, each with the option it was started from. */
  #planActions(p, viewer, nowMs) {
    const out = [];
    for (const o of p.options || []) {
      if (!o.action || typeof o.action.id !== "string") continue;
      const a = this.#actionOf(o.action.id, viewer, nowMs);
      if (a) out.push({ option: o, action: a });
    }
    return out;
  }

  /* ===================================================================== *
   * R1, R2: EACH MATTER — its intended outcome and its state
   * ===================================================================== */

  /** R1: the group's intended outcome for a matter, each revision kept. */
  matterOutcomeSet(args = {}) {
    const { plan, subject, text, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const m = this.#matter(o.p, subject);
    if (m.r) return m.r;
    if (!isLine(text, OUTCOME_MAX)) return { ...refuseReason(typeof text === "string" && text ? text : "", true), max: OUTCOME_MAX };
    const at = this.now();
    const seq = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_outcomes WHERE plan_id=? AND skey=?`, o.p.id, m.key));
      this.sql.exec(`INSERT INTO pw_outcomes (plan_id, skey, seq, subject_json, text, author, at) VALUES (?,?,?,?,?,?,?)`,
        o.p.id, m.key, n, JSON.stringify(m.s), text.trim(), author, at);
      return n;
    });
    return { ok: true, plan: o.p.id, subject: m.s, key: m.key, text: text.trim(), revision: seq, author, at };
  }

  #outcomeOf(planId, key) {
    const rows = this.#rows(`SELECT * FROM pw_outcomes WHERE plan_id=? AND skey=? ORDER BY seq`, planId, key)
      .map((r) => ({ text: r.text, revision: r.seq, by: r.author, at: r.at }));
    return { outcome: rows.at(-1) ?? null, history: rows };
  }

  /** R2: a matter's state, derived when read: the first of `MATTER_STATES` that holds, never a percentage or score.
   *  `undetermined` with why when a read it needs cannot be made. */
  #stateOf(p, s, key, viewer, nowMs) {
    try {
      const esc = [];
      if (s.kind === "outcome") {
        const l = this.escalation.escalationsFor({ determination: s.determination, viewer: sightOf(viewer) });
        if (!ok(l)) return { state: "undetermined", why: word("plan-work.why.matter_escalations_read") };
        esc.push(...(l.items || []));
      }
      const ended = esc.find((e) => e.state === "ended");
      if (ended) return { state: "ended", escalation: ended.id };
      if (s.kind === "outcome") {
        const c = this.conformance.curesOf({ determination: s.determination, standard: s.standard, viewer: sightOf(viewer) });
        if (!ok(c)) return { state: "undetermined", why: word("plan-work.why.matter_cures_read") };
        const cure = standingCure(c, s.standard);
        if (cure) return { state: "fixed", cure };
      }
      const stopped = esc.find((e) => e.state === "stopped_pursuing");
      if (stopped) return { state: "stopped", escalation: stopped.id };
      let acting = null, offered = null, documented = null;
      /* the options adopted from action-plans' standing offers (its R41) for this matter */
      const offerOptions = new Set((p.offers || []).filter((x) => x.key === key)
        .flatMap((x) => (x.offers || []).flatMap((f) => (f.adopted || []).map((a) => a.option))));
      for (const o of this.#serving(p, key)) {
        if (!o.action || typeof o.action.id !== "string") continue;
        const a = this.#actionOf(o.action.id, viewer, nowMs);
        if (!a) continue;
        const f = this.filings.filingsFor({ action: a.id, viewer: sightOf(viewer) });
        const drafts = ok(f) ? f.drafts || [] : [];
        const offer = offerOptions.has(o.id) || drafts.some((d) => OFFER_KINDS.includes(d.purpose));
        if (drafts.some((d) => d.purpose === "chance_to_fix" && d.sending)) offered = offered || a.id;
        if (drafts.some((d) => d.purpose === "document_infraction" && d.approval)) documented = documented || a.id;
        const sent = (a.correspondence || []).some((e) => e && e.direction === "sent");
        if (sent && !offer && o.addressee) acting = acting || a.id;
      }
      if (acting) return { state: "acting", action: acting };
      if (offered) return { state: "fix_offered", action: offered };
      if (documented) return { state: "documented", action: documented };
      return { state: "none" };
    } catch (e) {
      if (e instanceof ProviderAbsent) throw e;
      return { state: "undetermined", why: word("plan-work.why.read_state_needs") };
    }
  }

  /** R1, R2: each matter of the plan with its intended outcome (and its history) and its state. Writes nothing. */
  matters({ plan, nowMs, viewer } = {}) {
    const now = this.#nowMs(nowMs);
    const p = this.#plan(plan, viewer, now);
    if (!p) return noSuchPlan(plan ?? null);
    return { ok: true, plan: p.id, as_of: iso(now), matters: (p.subjects || []).map((x) => ({
      subject: x.subject, key: x.key, ...this.#outcomeOf(p.id, x.key), ...this.#stateOf(p, x.subject, x.key, viewer, now) })) };
  }

  /* ===================================================================== *
   * R3: THE TIMELINE
   * ===================================================================== */

  /* R3: the dated items of the plan as the reader may see it. `coming` marks a date still ahead of `now`. */
  #timeline(p, viewer, now) {
    const items = [];
    for (const { option, action: a } of this.#planActions(p, viewer, now)) {
      for (const e of a.correspondence || [])
        if (e && typeof e.at === "string")
          items.push({ at: e.at, kind: e.direction, action: a.id, option: option.id, ord: e.ord, done: true });
      for (const r of Array.isArray(a.receipts) ? a.receipts : [])
        if (r && typeof r.at === "string")
          items.push({ at: r.at, kind: r.kind === "service" ? "service" : "receipt", action: a.id, option: option.id, ord: r.ord ?? null, done: true });
      for (const h of a.state_history || [])
        if (h && typeof h.at === "string") items.push({ at: h.at, kind: "move", to: h.state, action: a.id, option: option.id, done: true });
      (a.clock || []).forEach((c, entry) => {
        if (!c || !isDay(String(c.date ?? "")) || c.status !== "pending") return;
        items.push({ at: c.date, kind: "clock", action: a.id, option: option.id, entry, text: c.text ?? null,
                     basis: c.basis ?? null, owed_by: ["group", "body"].includes(c.owed_by) ? c.owed_by : "undetermined" });
      });
    }
    for (const sc of p.scenarios || []) {
      if (sc.set_aside) continue;
      for (const ph of sc.phases || []) {
        const start = ph.started ? ph.started_at : ph.earliest;
        if (typeof start === "string" && start)
          items.push({ at: start, kind: "phase_start", scenario: sc.scenario, phase: ph.id, started: !!ph.started, ...(ph.started ? { done: true } : {}) });
        if (typeof ph.checkpoint_due === "string" && ph.checkpoint_due && !ph.judgement)
          items.push({ at: ph.checkpoint_due, kind: "checkpoint", scenario: sc.scenario, phase: ph.id });
      }
    }
    const escalations = new Set();
    for (const s of p.subjects || []) {
      const e = s.escalation;
      if (!e || typeof e.id !== "string" || escalations.has(e.id)) continue;
      escalations.add(e.id);
      const r = this.escalation.escalationRead({ id: e.id, nowMs: now, viewer: sightOf(viewer) });
      if (!ok(r)) continue;
      for (const x of r.proposed || [])
        if (typeof x.instant === "string")
          items.push({ at: x.instant, kind: "escalation_stage", escalation: e.id, from: x.from, to: x.to, stage: x.stage ?? null });
    }
    items.sort(byDate);
    return items.map((x) => ({ ...x, coming: !x.done && msOf(x.at) >= now - (/^\d{4}-\d{2}-\d{2}$/.test(x.at) ? DAY_MS - 1 : 0) }))
      .map(({ done, ...x }) => x);
  }

  /** R3: every act the group did on the plan's actions and every coming date, in date order, and `next`, the coming
   *  dates from `nowMs`, at most 10. What the viewer may not see is withheld whole. Writes nothing. */
  planTimeline({ plan, nowMs, viewer } = {}) {
    const now = this.#nowMs(nowMs);
    const p = this.#plan(plan, viewer, now);
    if (!p) return noSuchPlan(plan ?? null);
    const items = this.#timeline(p, viewer, now);
    return { ok: true, plan: p.id, as_of: iso(now), items, next: items.filter((x) => x.coming).slice(0, NEXT_MAX),
             ...(p.out_of_view ? { out_of_view: true } : {}) };
  }

  /* ===================================================================== *
   * R4: REVIEWS
   * ===================================================================== */

  /** R4: a member sets her own repeating review reminder on a plan, or removes it (`recurrence: null`). */
  planReviewRhythm(args = {}) {
    const { plan, recurrence, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    let held = null;
    if (recurrence !== null) {
      const zone = isObj(recurrence) && typeof recurrence.zone === "string" ? recurrence.zone : this.#zone();
      const r = isObj(recurrence) && typeof recurrence.rrule === "string" && isDay(String(recurrence.dtstart ?? "")) && zone
        ? safeExpand({ rrule: recurrence.rrule, dtstart: recurrence.dtstart, zone, from: recurrence.dtstart,
                       to: dayOf(msOf(recurrence.dtstart) + 400 * DAY_MS) }) : null;
      /* DEC-49 REGION is-review-rhythm */
      if (!r || !Array.isArray(r.instances) || !r.instances.length)
        return refusal("REVIEW_RHYTHM_REFUSED", !zone ? localize("plan-work.index.no_time_zone_was_given", "no time zone was given and none is held for this place. Nothing was written.")
          : localize("plan-work.index.a_rhythm_is_recurrence", "a rhythm is {rrule, dtstart: YYYY-MM-DD, zone?} in the recurrence subset (weekly, monthly or yearly){why}. Nothing was written.",
            { why: r && r.reason ? `: ${r.reason}` : "" }));
      /* END DEC-49 REGION is-review-rhythm */
      held = { rrule: recurrence.rrule, dtstart: recurrence.dtstart, zone };
    }
    const at = this.now();
    this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_rhythms WHERE plan_id=? AND member=?`, o.p.id, author));
      this.sql.exec(`INSERT INTO pw_rhythms (plan_id, member, seq, recurrence_json, at) VALUES (?,?,?,?,?)`,
        o.p.id, author, n, held ? JSON.stringify(held) : null, at);
    });
    return { ok: true, plan: o.p.id, member: author, recurrence: held, at };
  }

  #zone() {
    try { const a = this.#maybe("actions"); return a && typeof a.place === "function" ? zoneOf(a.place()) : null; } catch { return null; }
  }

  #lastReview(planId) {
    const r = this.#rows(`SELECT * FROM pw_reviews WHERE plan_id=? ORDER BY seq DESC LIMIT 1`, planId)[0];
    return r ? { decided: r.decided, by: r.author, at: r.at, seq: r.seq } : null;
  }

  /** R4: one item per due review, for `action-producers` (`plan-review-due`): for each member's standing rhythm on a
   *  plan not closed, the latest occurrence at or before `nowMs`, after the rhythm was set, with no review entry
   *  recorded since it. Each occurrence is one item, so a review is told once. No rhythm, no item. R18: each item also
   *  carries `recurrence`, the rhythm as the member set it with who and when, and `since`, the local day (in the
   *  rhythm's zone) of the plan's last review entry, else of the rhythm's setting. Writes nothing. */
  planReviewsDue({ nowMs, limit } = {}) {
    const now = this.#nowMs(nowMs);
    const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, DUE_MAX) : DUE_MAX;
    const latest = this.#rows(`SELECT r.* FROM pw_rhythms r WHERE r.seq = (SELECT MAX(seq) FROM pw_rhythms x
                                 WHERE x.plan_id=r.plan_id AND x.member=r.member) ORDER BY r.plan_id, r.member`);
    const items = [];
    for (const r of latest) {
      const rec = unjson(r.recurrence_json, null);
      if (!rec) continue;
      const p = this.#plan(r.plan_id, null, now);
      if (!p || p.state === "closed") continue;
      const from = dayOf(Math.max(msOf(r.at), now - 400 * DAY_MS));
      const x = safeExpand({ rrule: rec.rrule, dtstart: rec.dtstart, zone: rec.zone, from, to: dayOf(now + DAY_MS) });
      const due = (x && Array.isArray(x.instances) ? x.instances : [])
        .filter((i) => msOf(i.instant) <= now && msOf(i.instant) >= msOf(r.at) - DAY_MS).at(-1);
      if (!due) continue;
      const last = this.#lastReview(p.id);
      if (last && msOf(last.at) >= msOf(due.instant)) continue;
      items.push({ plan: p.id, project: p.project, member: r.member, due: due.instant, day: due.value, zone: rec.zone,
                   recurrence: { rrule: rec.rrule, dtstart: rec.dtstart, zone: rec.zone, by: r.member, at: r.at },
                   since: last ? { day: dayIn(last.at, rec.zone), from: "review" } : { day: dayIn(r.at, rec.zone), from: "rhythm_set" } });
    }
    items.sort((a, b) => msOf(a.due) - msOf(b.due) || (a.plan < b.plan ? -1 : a.plan > b.plan ? 1 : 0));
    return { ok: true, as_of: iso(now), items: items.slice(0, cap), truncated: items.length > cap, limit: cap };
  }

  /** R4: what changed since the last review entry (else since the plan opened): responses recorded, dates passed and
   *  the machine's marks. Writes nothing. */
  planReviewOpen({ plan, nowMs, viewer } = {}) {
    const now = this.#nowMs(nowMs);
    const p = this.#plan(plan, viewer, now);
    if (!p) return noSuchPlan(plan ?? null);
    const last = this.#lastReview(p.id);
    const since = last ? last.at : p.opened_at;
    const sinceMs = msOf(since);
    const responses = [];
    for (const { action: a } of this.#planActions(p, viewer, now))
      for (const e of a.correspondence || [])
        if (e && e.direction === "received" && msOf(e.recorded_at ?? e.at) > sinceMs)
          responses.push({ action: a.id, ord: e.ord, at: e.at, recorded_at: e.recorded_at ?? null });
    const passed = this.#timeline(p, viewer, now)
      .filter((x) => ["clock", "checkpoint", "phase_start"].includes(x.kind) && !x.coming && msOf(x.at) > sinceMs - DAY_MS && msOf(x.at) <= now);
    const marks = (Array.isArray(p.marks) ? p.marks : []).filter((m) => m && msOf(m.at) > sinceMs);
    return { ok: true, plan: p.id, as_of: iso(now), since, last_review: last, responses, dates_passed: passed, marks };
  }

  /** R4: a dated review entry, what the members decided in 1 to 4,000 characters. */
  planReviewRecord(args = {}) {
    const { plan, decided, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const bad = refuseText(decided, DECIDED_MAX, "decided");
    if (bad) return bad;
    const at = this.now();
    const seq = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_reviews WHERE plan_id=?`, o.p.id));
      this.sql.exec(`INSERT INTO pw_reviews (plan_id, seq, decided, author, at) VALUES (?,?,?,?,?)`, o.p.id, n, decided, author, at);
      return n;
    });
    return { ok: true, plan: o.p.id, review: seq, decided, author, at };
  }

  /** R4: the plan's review entries, oldest first, and the reader's own rhythm. */
  planReviews({ plan, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan ?? null);
    const mine = viewer ? this.#rows(`SELECT * FROM pw_rhythms WHERE plan_id=? AND member=? ORDER BY seq DESC LIMIT 1`, p.id, viewer)[0] : null;
    return { ok: true, plan: p.id, reviews: this.#rows(`SELECT * FROM pw_reviews WHERE plan_id=? ORDER BY seq`, p.id)
      .map((r) => ({ review: r.seq, decided: r.decided, by: r.author, at: r.at })),
             rhythm: mine ? unjson(mine.recurrence_json, null) : null };
  }

  /* ===================================================================== *
   * R5, R6: PREPARATION ITEMS AND COMMENTS
   * ===================================================================== */

  /** R5: a member adds a preparation item to one of the plan's options. */
  prepItemAdd(args = {}) {
    const { plan, option, text, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const keys = refuseKeys(args);
    if (keys) return keys;
    if (!(o.p.options || []).some((x) => x.id === option)) return refuseNoSuchOption(option ?? null);
    const bad = refuseText(text, PREP_MAX, "text", { line: true });
    if (bad) return bad;
    const at = this.now();
    const r = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_prep WHERE plan_id=?`, o.p.id));
      const item = `prep-${this.#rows(`SELECT COUNT(*) AS n FROM pw_prep WHERE plan_id=? AND act='add'`, o.p.id)[0].n + 1}`;
      this.sql.exec(`INSERT INTO pw_prep (plan_id, seq, item, act, option_id, text, target, author, at) VALUES (?,?,?,?,?,?,?,?,?)`,
        o.p.id, n, item, "add", option, text.trim(), null, author, at);
      return item;
    });
    return { ok: true, plan: o.p.id, item: r, option, text: text.trim(), author, at };
  }

  /** R5: the author takes a preparation item up herself, with her own target date; nobody assigns anybody. */
  prepItemTakeUp(args = {}) { return this.#prepAct("take_up", args); }
  /** R5: a member marks a preparation item done. */
  prepItemDone(args = {}) { return this.#prepAct("done", args); }

  #prepAct(act, args) {
    const { plan, item, target, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const keys = refuseOthers(args, author);
    if (keys) return keys;
    const held = this.#prepItem(o.p.id, item);
    if (held.r) return held.r;
    /* DEC-49 REGION is-prep-item-open */
    if (held.done)
      return refusal("PREP_ITEM_DONE", localize("plan-work.index.item_was_marked_done_by", "{item} was marked done by {by}. Nothing was written.", { item: String(held.item), by: String(held.done.by) }), { item: held.item });
    /* END DEC-49 REGION is-prep-item-open */
    if (act === "take_up" && target !== undefined && target !== null && !isDay(target))
      return refuseText(null, 10, "target", { says: word("plan-work.says.target_date_day") });
    const at = this.now();
    this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_prep WHERE plan_id=?`, o.p.id));
      this.sql.exec(`INSERT INTO pw_prep (plan_id, seq, item, act, option_id, text, target, author, at) VALUES (?,?,?,?,?,?,?,?,?)`,
        o.p.id, n, held.item, act, held.option, null, act === "take_up" ? target ?? null : null, author, at);
    });
    return { ok: true, plan: o.p.id, item: held.item, act, ...(act === "take_up" ? { by: author, target: target ?? null } : { by: author }), at };
  }

  /* R5: one preparation item with what was done with it. */
  #prepItem(planId, item) {
    const rows = typeof item === "string" ? this.#rows(`SELECT * FROM pw_prep WHERE plan_id=? AND item=? ORDER BY seq`, planId, item) : [];
    /* DEC-49 REGION is-prep-item-held */
    if (!rows.length || rows[0].act !== "add")
      return { r: refusal("NO_SUCH_PREP_ITEM", localize("plan-work.index.the_plan_holds_no_preparation", "the plan holds no preparation item of that id. Nothing was written."),
        { item: typeof item === "string" ? item.slice(0, 80) : null }) };
    /* END DEC-49 REGION is-prep-item-held */
    return prepView(rows);
  }

  /** R5: the plan's preparation items, each with its option, text, take-ups and whether it is done; seen by whoever
   *  sees the plan. */
  prepItems({ plan, option, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan ?? null);
    const byItem = new Map();
    for (const r of this.#rows(`SELECT * FROM pw_prep WHERE plan_id=? ORDER BY seq`, p.id)) {
      if (!byItem.has(r.item)) byItem.set(r.item, []);
      byItem.get(r.item).push(r);
    }
    const items = [...byItem.values()].map(prepView).filter((x) => !x.r && (!option || x.option === option))
      .map(({ item, option: opt, text, by, at, take_ups, done }) => ({ item, option: opt, text, by, at, take_ups, done }));
    return { ok: true, plan: p.id, items };
  }

  /** R6: a comment on an option, an action or a draft of the plan, under the plan's sight; never published. */
  planComment(args = {}) {
    const { plan, on, text, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const t = this.#commentTarget(o.p, on, viewer);
    if (t.r) return t.r;
    const bad = refuseText(text, COMMENT_MAX, "text");
    if (bad) return bad;
    const at = this.now();
    const seq = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_comments WHERE plan_id=?`, o.p.id));
      this.sql.exec(`INSERT INTO pw_comments (plan_id, seq, on_kind, on_id, text, author, at) VALUES (?,?,?,?,?,?,?)`,
        o.p.id, n, t.kind, t.id, text, author, at);
      return n;
    });
    return { ok: true, plan: o.p.id, comment: seq, on: { [t.kind]: t.id }, text, author, at };
  }

  /* R6: what a comment is on: an option of the plan, an action started from one, or a draft of such an action, each
     one the reader may see. `{kind, id}` or `{r}`. */
  #commentTarget(p, on, viewer) {
    const kind = isObj(on) ? ["option", "action", "draft"].find((k) => typeof on[k] === "string" && on[k]) : null;
    let found = false;
    if (kind === "option") found = (p.options || []).some((o) => o.id === on.option);
    else if (kind === "action") found = this.#planActions(p, viewer).some((x) => x.action.id === on.action);
    else if (kind === "draft") found = this.#drafts(p, viewer).has(on.draft);
    /* DEC-49 REGION is-comment-target */
    if (!found)
      return { r: refusal("COMMENT_TARGET_REFUSED", localize("plan-work.index.a_comment_is_on_one",
        "a comment is on an option, an action or a draft of this plan, one you can see. Nothing was written.")) };
    /* END DEC-49 REGION is-comment-target */
    return { kind, id: on[kind] };
  }
  /* The drafts prepared for the plan's actions the reader may see, by id, with their action. */
  #drafts(p, viewer) {
    const out = new Map();
    for (const { action: a } of this.#planActions(p, viewer)) {
      const f = this.filings.filingsFor({ action: a.id, viewer: sightOf(viewer) });
      for (const d of ok(f) ? f.drafts || [] : []) out.set(d.filing, a.id);
    }
    return out;
  }

  /** R6: the plan's comments, oldest first, optionally on one thing; a comment on an action or draft the reader may not
   *  see is withheld whole. Under the plan's sight only: an outsider reads the plan as absent. */
  planComments({ plan, on, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan ?? null);
    const actions = new Set(this.#planActions(p, viewer).map((x) => x.action.id));
    const drafts = this.#drafts(p, viewer);
    const kind = isObj(on) ? ["option", "action", "draft"].find((k) => typeof on[k] === "string") : null;
    let withheld = false;
    const comments = this.#rows(`SELECT * FROM pw_comments WHERE plan_id=? ORDER BY seq`, p.id).filter((c) => {
      const seen = c.on_kind === "option" || (c.on_kind === "action" ? actions.has(c.on_id) : drafts.has(c.on_id));
      if (!seen) withheld = true;
      return seen && (!kind || (c.on_kind === kind && c.on_id === on[kind]));
    }).map((c) => ({ comment: c.seq, on: { [c.on_kind]: c.on_id }, text: c.text, by: c.author, at: c.at }));
    return { ok: true, plan: p.id, comments, ...(withheld ? { out_of_view: true } : {}) };
  }

  /* ===================================================================== *
   * R7, R8, R9: WHERE IT STANDS, STATUS REPORTS, WATCHES
   * ===================================================================== */

  /** R9: one registration, filled by `following`; a second is refused (`membership.listenerRefusal`). */
  registerWatchReader(module, fn) {
    const no = listenerRefusal(this.watchReader, module, fn);
    if (no) return no;
    this.watchReader = { module, fn };
    return { ok: true, module };
  }

  /* R9: the watches the plan set running with their end dates; `undetermined` when the reader throws or none is held. */
  #watches(planId, viewer) {
    if (!this.watchReader) return { state: "undetermined", why: word("plan-work.why.watch_reader_registered") };
    try {
      const r = this.watchReader.fn({ plan: planId, viewer });
      const list = Array.isArray(r) ? r : r && Array.isArray(r.watches) ? r.watches : null;
      if (!list) return { state: "undetermined", why: word("plan-work.why.watch_reader_gave") };
      return { state: "read", watches: list.map((w) => ({ ...w, source: { module: this.watchReader.module } })) };
    } catch { return { state: "undetermined", why: word("plan-work.why.watch_reader_read") }; }
  }

  /** R7: where the plan stands at `nowMs`, as the reader may see it: each wait with its basis, the next dates (R3),
   *  the holds on its actions and project, overrides with reasons, declined options and set-aside scenarios with their
   *  reasons, escalations with their state, the matters (R1, R2) and the watches with their end dates (R9). Each item
   *  names its source. Writes nothing. */
  whereItStands({ plan, nowMs, viewer } = {}) {
    const now = this.#nowMs(nowMs);
    const p = this.#plan(plan, viewer, now);
    if (!p) return noSuchPlan(plan ?? null);
    const acts = this.#planActions(p, viewer, now);
    const waits = [];
    const overrides = [];
    for (const { option, action: a } of acts) {
      (a.clock || []).forEach((c, entry) => {
        if (c && c.status === "pending")
          waits.push({ action: a.id, option: option.id, entry, date: c.date ?? null, text: c.text ?? null, basis: c.basis ?? null,
                       owed_by: ["group", "body"].includes(c.owed_by) ? c.owed_by : "undetermined",
                       source: { module: "actions", id: a.id, entry } });
      });
      if (a.current_state === "awaiting_response") {
        const sent = (a.correspondence || []).filter((e) => e && e.direction === "sent").at(-1);
        waits.push({ action: a.id, option: option.id, waiting: "response", since: sent ? sent.at : null,
                     basis: word("plan-work.basis.action_awaits_response"), source: { module: "actions", id: a.id } });
      }
      const ov = a.premise_override;
      if (ov && (ov.reason || ov.stated))
        overrides.push({ action: a.id, ground: ov.ground ?? null, reason: ov.reason ?? null, by: ov.by ?? null, at: ov.at ?? null,
                         source: { module: "actions", id: a.id } });
    }
    const declined = (p.options || []).filter((o) => o.disposition === "declined").map((o) => ({ option: o.id, summary: o.summary,
      reason: ((o.dispositions || []).filter((d) => d.disposition === "declined").at(-1) || {}).reason ?? null,
      source: { module: "action-plans", id: p.id, option: o.id } }));
    const setAside = (p.scenarios || []).filter((s) => s.set_aside || s.state === "set_aside").map((s) => ({ scenario: s.scenario,
      name: s.name, reason: (isObj(s.set_aside) ? s.set_aside.reason : s.set_aside_reason) ?? null,
      source: { module: "action-plans", id: p.id, scenario: s.scenario } }));
    const escalations = (p.subjects || []).filter((s) => s.escalation && s.escalation.id).map((s) => ({ subject: s.subject,
      escalation: s.escalation.id, state: s.escalation.state ?? null, stage: s.escalation.stage ?? null,
      source: { module: "escalation", id: s.escalation.id } }));
    const timeline = this.#timeline(p, viewer, now);
    return {
      ok: true, plan: p.id, project: p.project, title: p.title, state: p.state, as_of: iso(now),
      matters: (p.subjects || []).map((x) => ({ subject: x.subject, ...this.#outcomeOf(p.id, x.key),
        ...this.#stateOf(p, x.subject, x.key, viewer, now), source: { module: "plan-work", id: p.id, matter: x.key } })),
      waits, next: timeline.filter((x) => x.coming).slice(0, NEXT_MAX).map((x) => ({ ...x, source: { module: "plan-work", read: "timeline" } })),
      holds: this.#holds(p, acts, viewer), overrides, declined, set_aside: setAside, escalations,
      watches: this.#watches(p.id, viewer), ...(p.out_of_view ? { out_of_view: true } : {}),
    };
  }

  /* R7: the holds on the plan's project (`action-holds` R7) and those due on its actions or project (its R3). */
  #holds(p, acts, viewer) {
    const h = this.#maybe("actionHolds");
    if (!h) return { state: "undetermined", why: word("plan-work.why.instance_holds_litigation") };
    try {
      const project = h.projectHolds({ projects: [p.project], viewer: sightOf(viewer) });
      const ids = new Set(acts.map((x) => x.action.id));
      const due = h.holdsDue({ viewer: sightOf(viewer) });
      return { state: "read",
               project: ok(project) ? project.projects || [] : { state: "undetermined", why: word("plan-work.why.project_holds_read") },
               due: ok(due) ? (due.items || []).filter((x) => ids.has(x.action) || x.project === p.project) : { state: "undetermined", why: word("plan-work.why.holds_due_read") },
               source: { module: "action-holds" } };
    } catch { return { state: "undetermined", why: word("plan-work.why.holds_read") }; }
  }

  /** R7 (action-plans R44): the closing summary, read at the instant of closing as the module's own read. */
  closeSnapshot({ plan } = {}) {
    const r = this.whereItStands({ plan, viewer: null });
    if (!ok(r)) throw new Error("plan-work: the plan's standing could not be read");
    return r;
  }

  /** R8: a sourced list assembled by the system from R7, each item naming its source, labelled machine work; no
   *  assistant text (that is R14's arm, drafted outside this module) and no sentence that is not one of R7's items.
   *  Writes nothing. */
  statusReportDraft({ plan, nowMs, viewer } = {}) {
    const w = this.whereItStands({ plan, nowMs, viewer });
    if (!ok(w)) return w;
    return { ok: true, plan: w.plan, as_of: w.as_of, label: DRAFT_LABEL, items: reportItems(w), ...(w.out_of_view ? { out_of_view: true } : {}) };
  }

  /** R14: the items the assistant drafts a status report from: past sight (a plan the viewer may not see answers
   *  `NO_SUCH_PLAN`), R8's items exactly as `statusReportDraft` assembles them, and nothing else. It answers no AI
   *  refusal, drafts nothing and calls no model: the plane's draft door gates the draft and hands it these items. Writes
   *  nothing. */
  statusReportAssist({ plan, nowMs, viewer } = {}) {
    const w = this.whereItStands({ plan, nowMs, viewer });
    if (!ok(w)) return w;
    return { ok: true, plan: w.plan, as_of: w.as_of, items: reportItems(w), ...(w.out_of_view ? { out_of_view: true } : {}) };
  }

  /** R8, R14: a member keeps a status report with the plan, 1 to 8,000 characters; never required, never published.
   *  `from` is one line of the member's own (as R8 took it), or `{assistant: true, as_of?}`: the text began as the
   *  assistant's draft (R14), read back as `{draft: "assistant", as_of, label}`, labelled by R16's `status_report`
   *  label; the report is the member's. */
  statusReportSave(args = {}) {
    const { plan, text, from, author, viewer } = args;
    const o = this.#act(plan, author, viewer);
    if (o.r) return o.r;
    const bad = refuseText(text, REPORT_MAX, "text");
    if (bad) return bad;
    const held = reportFrom(from);
    if (held.r) return held.r;
    const at = this.now();
    const seq = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_reports WHERE plan_id=?`, o.p.id));
      this.sql.exec(`INSERT INTO pw_reports (plan_id, seq, text, from_json, author, at) VALUES (?,?,?,?,?,?)`,
        o.p.id, n, text, held.stored, author, at);
      return n;
    });
    return { ok: true, plan: o.p.id, report: seq, text, from: fromOf(held.stored), author, at };
  }

  /** R8: the plan's kept reports, oldest first. */
  statusReports({ plan, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan ?? null);
    return { ok: true, plan: p.id, reports: this.#rows(`SELECT * FROM pw_reports WHERE plan_id=? ORDER BY seq`, p.id)
      .map((r) => ({ report: r.seq, text: r.text, from: fromOf(r.from_json), by: r.author, at: r.at })) };
  }

  /* ===================================================================== *
   * R10: RE-EXAMINATION ON EACH RECORDED RESPONSE
   * ===================================================================== */

  /** R10: `actions`' response listener (its R95). Re-examines every open or paused plan of the response's project and
   *  of the projects linked to it by `arose_from` both ways, writing marks through `action-plans.planMark` only, and,
   *  where AI is enabled, opens one re-examination run per plan. Never throws, and never changes a disposition,
   *  scenario, judgement or start. Answers what it did, per plan. */
  async onResponse({ action, ord, project, recorder, at } = {}) {
    const done = [];
    try {
      const response = `${action}#${ord}`;
      /* an action started from a plan may carry no project of its own: its plan's project is the response's */
      const own = typeof project === "string" && project ? project : this.#projectOfAction(action);
      const projects = this.#linkedProjects(action, ord, own);
      const plans = new Set();
      for (const pr of projects) {
        const l = this.actionPlans.plansFor({ project: pr, viewer: PLANE });
        for (const x of ok(l) ? l.items || [] : []) if (x.state === "open" || x.state === "paused") plans.add(x.id);
      }
      /* claimed and marked with no await between, so a response re-examines each plan once */
      const claimed = [];
      for (const id of [...plans].sort()) {
        if (this.#rows(`SELECT 1 AS x FROM pw_reexams WHERE plan_id=? AND response=?`, id, response).length) continue;
        const marks = this.#reexamine(id, action, ord, recorder);
        let marked = null;
        if (marks.length) {
          try { marked = this.actionPlans.planMark({ plan: id, marks, cause: { action, ord } }); }
          catch (e) { marked = { ok: false, why: String(e && e.message || e).slice(0, 200) }; }
        }
        this.sql.exec(`INSERT INTO pw_reexams (plan_id, response, at, marks_json, marked_json) VALUES (?,?,?,?,?)`,
          id, response, this.now(), JSON.stringify(marks), marked ? JSON.stringify(marked) : null);
        claimed.push({ plan: id, marks });
      }
      for (const c of claimed) {
        const run = await this.#openRun(c.plan, response, recorder, at);
        this.sql.exec(`INSERT OR IGNORE INTO pw_reexam_runs (plan_id, response, run, run_json, at) VALUES (?,?,?,?,?)`,
          c.plan, response, run.run ?? null, JSON.stringify(run), this.now());
        done.push({ ...c, run });
      }
    } catch (e) { done.push({ failed: String(e && e.message || e).slice(0, 200) }); }
    return { ok: true, reexamined: done };
  }

  /* R10: the response's project and the projects linked to it by `arose_from` both ways (`action-replies` R2): those
     that arose from a response on the responded action or on an action started from one of the project's plans
     (`aroseFrom`, every response of each), and those whose responses the project arose from (`arisenFrom`). A link is
     recorded on a response after it is held, so the project's links, not the new response's, are what reach further. */
  #linkedProjects(action, ord, project) {
    const out = new Set(typeof project === "string" && project ? [project] : []);
    const r = this.#maybe("actionReplies");
    if (!r || !out.size) return out;
    try {
      const actions = new Set([action]);
      const l = this.actionPlans.plansFor({ project, viewer: PLANE });
      for (const x of ok(l) ? l.items || [] : []) {
        const p = this.#plan(x.id, null);
        for (const o of p ? p.options || [] : []) if (o.action && typeof o.action.id === "string") actions.add(o.action.id);
      }
      for (const a of actions) {
        const fwd = r.aroseFrom({ target: a, viewer: PLANE });
        for (const x of ok(fwd) ? fwd.items || [] : []) {
          const ar = isObj(x.arising) ? x.arising : x;
          if (typeof ar.project === "string") out.add(ar.project);
          if (typeof ar.plan === "string") { const p = this.#plan(ar.plan, null); if (p) out.add(p.project); }
        }
      }
      const back = r.arisenFrom({ project }, PLANE);
      for (const x of ok(back) ? back.items || [] : []) {
        const src = typeof x.action === "string" ? x.action : x.target;
        const p = typeof src === "string" ? this.#projectOfAction(src) : null;
        if (p) out.add(p);
      }
    } catch { /* an unreadable link reaches no further project */ }
    return out;
  }
  #projectOfAction(id) {
    const info = this.record.bundleInfo(id);
    if (info && info.project) return info.project;
    const a = this.#actionOf(id, null);
    const p = a && typeof a.plan === "string" ? this.#plan(a.plan, null) : null;
    return p ? p.project : null;
  }

  /* R10: rule 1's marks for one plan after the response, in action-plans R43's kinds: an option whose premise or
     regulated date changed (`option_changed`), a phase whose start now holds (`phase_start_holds`), and the procedure
     guide's next routes for the action's kind after the response's outcome (`next_routes`); a mark the plan already
     holds is not written again. The chance to fix re-offered is action-plans R41's own derivation, never marked here. */
  #reexamine(planId, action, ord, recorder) {
    const p = this.#plan(planId, null);
    if (!p) return [];
    const held = new Set((Array.isArray(p.marks) ? p.marks : []).map(markKey));
    const marks = [];
    const add = (m) => { const x = { ...m, why: m.why.slice(0, MARK_WHY_MAX) }; if (!held.has(markKey(x))) { held.add(markKey(x)); marks.push(x); } };
    const checks = Array.isArray(p.checks) ? p.checks : [];
    for (const o of p.options || []) {
      if (["declined", "done"].includes(o.disposition)) continue;
      const notLive = (o.subjects_liveness || []).length && !(o.subjects_liveness || []).some((b) => b.liveness && b.liveness.state === "live");
      const dated = checks.filter((x) => x.option === o.id && (x.check === "date_past" || x.check === "date_before_phase"));
      if (o.action && o.action.id === action)
        add({ kind: "option_changed", option: o.id, why: word("plan-work.why.response_recorded_action", { action: String(action) }) });
      else if (notLive)
        add({ kind: "option_changed", option: o.id, why: word("action-plans.says.matter_option_serves") });
      else if (dated.length)
        add({ kind: "option_changed", option: o.id, why: dated[0].says ?? dated[0].check });
    }
    for (const sc of p.scenarios || []) {
      if (sc.set_aside) continue;
      for (const ph of sc.phases || [])
        if (ph.started && !ph.judgement)
          add({ kind: "phase_start_holds", scenario: sc.scenario, phase: ph.id, why: word("plan-work.why.phase_start_holds", { now: String(ph.started_at ?? "now") }) });
    }
    const outcome = this.#outcomeAt(action, ord);
    const a = this.#actionOf(action, null);
    const g = this.#maybe("readingGuides");
    if (a && g && typeof a.kind === "string" && outcome) {
      const r = g.procedureGuidesFor({ kind: a.kind, viewer: recorder });
      const routes = [];
      for (const guide of ok(r) ? r.guides || [] : [])
        for (const it of guide.items || [])
          if (isObj(it) && Array.isArray(it.after) && it.after.includes(outcome) && typeof it.route === "string" && !routes.includes(it.route))
            routes.push(it.route);
      if (routes.length)
        add({ kind: "next_routes", routes: routes.slice(0, MARK_ROUTES_MAX), why: word("plan-work.why.procedure_guide_next", { kind: String(a.kind), outcome: String(outcome) }) });
    }
    return marks;
  }

  /* R10: the outcome the response at `ord` states, read from the action's document; null when it states none. */
  #outcomeAt(action, ord) {
    try {
      const f = this.record.readFile(action, "bundle.md");
      const fm = f && typeof f.text === "string" ? parseFrontmatter(f.text).data : null;
      const e = fm && Array.isArray(fm.correspondence) ? fm.correspondence[Number(ord)] : null;
      return e && typeof e.outcome === "string" ? e.outcome : null;
    } catch { return null; }
  }

  /* R10: one re-examination run on the plan, where AI is enabled: mode `plan`, origin `reexamination`, the response as
     `"<action id>#<ord>"` (K2820), the recording member as actor, so the account is the project's own where it holds
     one, else hers (ai-runs R52, R77). A refusal is kept and never undoes anything. */
  async #openRun(planId, response, recorder, at) {
    const ai = this.#maybe("aiRuns");
    const who = str(recorder);
    if (!ai || typeof ai.open !== "function") return { opened: false, why: word("plan-work.why.assistant_instance") };
    if (!who || isMachineIdentity(who)) return { opened: false, why: word("plan-work.why.response_recorded_member") };
    const p = this.#plan(planId, null);
    if (!p) return { opened: false, why: word("plan-work.why.plan_read") };
    const stamp = at ?? this.now();
    const run = `RXM-${stamp.slice(0, 10).replace(/-/g, "")}-${sha256HexSync(`${planId}|${response}`).slice(0, 12)}`;
    try {
      const r = await ai.open({ run, contextType: "project", contextId: p.project, mode: "plan", plan: planId,
        origin: "reexamination", response, label: word("plan-work.label.re_examining_plan"),
        principalPlane: who, principalAi: who, principalAiRef: who, skillVersion: REEXAM_SKILL, bounds: REEXAM_BOUNDS.map((b) => ({ ...b })),
        actor: who, viewer: who });
      if (r && r.started !== false && r.ok !== false) return { opened: true, run };
      return { opened: false, run: null, refused: { code: r && (r.code ?? r.reason) || null, detail: r && (r.detail ?? r.note) || null } };
    } catch (e) { return { opened: false, why: String(e && e.message || e).slice(0, 200) }; }
  }

  /** R10: the re-examinations the plan has had, oldest first: the response, the marks written and the run. */
  reexaminations({ plan, viewer } = {}) {
    const p = this.#plan(plan, viewer);
    if (!p) return noSuchPlan(plan ?? null);
    return { ok: true, plan: p.id, items: this.#rows(`SELECT x.*, r.run_json FROM pw_reexams x LEFT JOIN pw_reexam_runs r
        ON r.plan_id = x.plan_id AND r.response = x.response WHERE x.plan_id=? ORDER BY x.at, x.response`, p.id)
      .map((r) => ({ response: r.response, at: r.at, marks: unjson(r.marks_json, []), run: unjson(r.run_json, null) })) };
  }

  /* ===================================================================== *
   * R11: TAKING UP AN ITEM
   * ===================================================================== */

  /** R11: a member who can see an item routes its to-dos to herself from then; nobody assigns anybody. */
  itemTakeUp(args = {}) {
    const { item, author, viewer } = args;
    if (isMachine(author)) return machineCannotPlan();
    const it = this.#item(item, viewer);
    if (it.r) return it.r;
    const keys = refuseOthers(args, author);
    if (keys) return keys;
    const at = this.now();
    const seq = this.record.transact(() => {
      const n = seqOf(this.#rows(`SELECT MAX(seq) AS n FROM pw_takeups`));
      this.sql.exec(`INSERT INTO pw_takeups (seq, owner_id, item_key, item_json, member, at) VALUES (?,?,?,?,?,?)`,
        n, it.owner, it.key, JSON.stringify(it.item), author, at);
      return n;
    });
    return { ok: true, take_up: seq, item: it.item, by: author, at };
  }

  /* R11: the item named, as its owner answers it to the reader; `{item, key, owner}` or `{r}` (absent and unseen alike). */
  #item(item, viewer) {
    let found = null;
    try {
      const k = isObj(item) ? item.kind : null;
      if (k === "clock" && typeof item.action === "string" && Number.isInteger(Number(item.entry))) {
        const a = this.#actionOf(item.action, viewer);
        const e = a && (a.clock || [])[Number(item.entry)];
        if (e) found = { item: { kind: k, action: a.id, entry: Number(item.entry) }, owner: a.id };
      } else if (k === "checkpoint" && typeof item.plan === "string") {
        const p = this.#plan(item.plan, viewer);
        const sc = p && (p.scenarios || []).find((x) => String(x.scenario) === String(item.scenario));
        const ph = sc && (sc.phases || []).find((x) => x.id === item.phase && x.checkpoint);
        if (ph) found = { item: { kind: k, plan: p.id, scenario: sc.scenario, phase: ph.id }, owner: p.id };
      } else if (k === "escalation_stage" && typeof item.escalation === "string") {
        const r = this.escalation.escalationRead({ id: item.escalation, viewer: sightOf(viewer) });
        const stage = Number(item.stage);
        if (ok(r) && (r.proposed || []).some((x) => x.to === stage))
          found = { item: { kind: k, escalation: r.id, stage }, owner: r.id };
      } else if (k === "hold") {
        const h = this.#maybe("actionHolds");
        const place = typeof item.target === "string" ? { target: item.target, ...(item.ord !== undefined ? { ord: item.ord } : {}) }
          : typeof item.project === "string" ? { project: item.project } : null;
        const r = h && place ? h.holdsOf({ ...place, viewer: sightOf(viewer) }) : null;
        if (ok(r) && Array.isArray(r.holds) && r.holds.length)
          found = { item: { kind: k, ...place }, owner: place.target ?? place.project };
      }
    } catch (e) { if (e instanceof ProviderAbsent) throw e; found = null; }
    /* DEC-49 REGION is-item-seen */
    if (!found)
      return { r: refusal("NO_SUCH_ITEM", localize("plan-work.index.no_deadline_checkpoint_proposed_stage", "no deadline, checkpoint, proposed stage or hold you may see answers to that item. Nothing was written.")) };
    /* END DEC-49 REGION is-item-seen */
    return { ...found, key: JSON.stringify(found.item) };
  }

  /** R11: the take-ups, oldest first after `after`, for `action-producers`: as the plane (no viewer) every one; for a
   *  viewer, those whose item she may still see. At most 500 per page, `cursor` and `truncated`. Writes nothing. */
  takeUpsFor({ after, limit, viewer } = {}) {
    const cap = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), TAKEUPS_MAX) : TAKEUPS_MAX;
    const from = Number.isInteger(Number(after)) ? Number(after) : 0;
    const items = [];
    let truncated = false;
    for (const r of this.#rows(`SELECT * FROM pw_takeups WHERE seq > ? ORDER BY seq`, from)) {
      const item = unjson(r.item_json, {});
      if (viewer !== null && viewer !== undefined && this.#item(item, viewer).r) continue;
      if (items.length === cap) { truncated = true; break; }
      items.push({ take_up: r.seq, item, member: r.member, at: r.at });
    }
    return { ok: true, items, truncated, cursor: truncated ? items.at(-1).take_up : null, limit: cap };
  }

  /* ===================================================================== *
   * R13: A MATTER'S PROMISE-DUTIES
   * ===================================================================== */

  /** R13, R15: the adopted duties arising in the captures of the `received` entries of the plan's actions serving the
   *  matter (`duties.dutiesArisingIn`), with `all_met`, `partial` and `met_at`: when `all_met`, the instant the last of
   *  them was read met (R15), else null. Writes nothing; never throws. */
  matterPromiseDuties({ plan, matter, nowMs, viewer } = {}) {
    try {
      const now = this.#nowMs(nowMs);
      const p = this.#plan(plan, viewer, now);
      if (!p) return noSuchPlan(plan ?? null);
      const m = this.#matter(p, matter);
      if (m.r) return m.r;
      const captures = new Set();
      for (const o of this.#serving(p, m.key)) {
        const a = o.action ? this.#actionOf(o.action.id, viewer, now) : null;
        for (const e of a ? a.correspondence || [] : [])
          if (e && e.direction === "received" && typeof e.artifact_sha === "string" && /^[0-9a-f]{64}$/.test(e.artifact_sha))
            captures.add(e.artifact_sha);
      }
      const none = { ok: true, plan: p.id, matter: m.s, captures: [], duties: [], all_met: false, partial: false, met_at: null };
      if (!captures.size) return none;
      const sight = viewer === null || viewer === undefined ? DUTIES_INTERNAL : viewer;
      const r = this.duties.dutiesArisingIn({ captures: [...captures].slice(0, 200), asOf: iso(now), viewer: sight });
      if (!ok(r)) return { ...none, captures: [...captures], undetermined: { why: word("plan-work.why.duties_read") } };
      const duties = r.duties || [];
      const allMet = r.all_met === true;
      const met = allMet ? this.#metAt(duties, sight) : { met_at: null };
      return { ok: true, plan: p.id, matter: m.s, captures: [...captures], duties, all_met: allMet,
               partial: r.partial === true, ...met, ...(r.undetermined ? { undetermined: r.undetermined } : {}) };
    } catch (e) {
      if (e instanceof ProviderAbsent) return refuseProviderUnavailable(e.provider);
      return { ok: true, plan: plan ?? null, matter: matter ?? null, captures: [], duties: [], all_met: false, partial: false,
               met_at: null, undetermined: { why: word("case-disclosures.why.read_failed") } };
    }
  }

  /* R15: the instant the last of the duties was read met: for each occurrence, the start of the run of `met` or
     `met_late` readings that ends its recorded transitions (`duties.transitionsOf`, its R13, R14), at its `as_of`; the
     latest of those. Null, with why, when an occurrence's recorded readings do not end met (the derivation has moved on
     and no reading is recorded yet) or cannot be read: never an instant guessed from the derivation. */
  #metAt(duties, sight) {
    const no = (why) => ({ met_at: null, met_at_why: why });
    const d = this.duties;
    if (typeof d.transitionsOf !== "function") return no(word("plan-work.no.duties_recorded_readings"));
    let last = null;
    for (const duty of duties)
      for (const o of duty.occurrences || []) {
        let t;
        try { t = d.transitionsOf({ dutyId: duty.duty_id, occurrenceKey: o.key, viewer: sight }); }
        catch { return no(word("plan-work.no.duties_recorded_readings_read")); }
        const list = ok(t) && Array.isArray(t.transitions)
          ? t.transitions.filter((x) => x && x.duty_id === duty.duty_id && x.occurrence_key === o.key) : null;
        if (!list) return no(word("plan-work.no.duties_recorded_readings_read"));
        let start = null;
        for (const x of list) start = MET_STATES.includes(x.state) ? start ?? x : null;
        if (!start || !Number.isFinite(msOf(start.as_of))) return no(word("plan-work.no.reading_met_recorded", { duty_id: String(duty.duty_id) }));
        if (!last || msOf(start.as_of) > msOf(last)) last = start.as_of;
      }
    return last ? { met_at: last } : no(word("plan-work.no.duty_occurrence_read"));
  }
}

/* ===================================================================== *
 * PURE HELPERS
 * ===================================================================== */

/* R8, R14: the items of a status report, in R7's order, each one of R7's whole with its section. */
function reportItems(w) {
  const items = [];
  for (const section of ["matters", "waits", "next", "overrides", "declined", "set_aside", "escalations"])
    for (const x of w[section] || []) items.push({ section, ...x });
  for (const section of ["holds", "watches"]) items.push({ section, ...w[section] });
  return items;
}

/* R8, R14: a report's `from` as kept: `{stored}` (null, the member's one line, or the assistant's draft as JSON), or
   `{r}`. A one-line `from` holds no quotation mark, so a stored JSON object is never one. */
function reportFrom(from) {
  if (from === undefined || from === null) return { stored: null };
  if (typeof from === "string") return isLine(from, 200) ? { stored: from } : { r: refuseText(null, 200, "from") };
  const asOf = isObj(from) ? from.as_of : undefined;
  if (isObj(from) && from.assistant === true && Object.keys(from).every((k) => k === "assistant" || k === "as_of")
      && (asOf === undefined || asOf === null || (typeof asOf === "string" && ISO_TS_RE.test(asOf))))
    return { stored: JSON.stringify({ draft: "assistant", as_of: asOf ?? null }) };
  return { r: refuseText(null, 200, "from", { says: localize("plan-work.index.from_is_one_line_of_your",
    "from is one line of your own, or {assistant: true, as_of?} when the text began as the assistant's draft") }) };
}
/* R8, R14, R16: a kept `from` as read back; the assistant's draft with R16's label, whatever label an earlier row held. */
function fromOf(stored) {
  if (typeof stored !== "string") return null;
  if (!stored.startsWith("{")) return stored;
  const f = unjson(stored, null);
  return isObj(f) && f.draft === "assistant" ? { draft: "assistant", as_of: f.as_of ?? null, label: ASSIST_LABEL } : stored;
}

/* R2: the standing cure link `conformance.curesOf` (its R37) answers for a standard: `{standards: [{standard, link,
   ended}]}`, the link null when none stands; a link whose curing determination has been superseded reads
   `cure_standing: false` and is no standing cure. Null when none. */
function standingCure(r, standard) {
  const s = (Array.isArray(r && r.standards) ? r.standards : []).find((x) => isObj(x) && x.standard === standard);
  return s && isObj(s.link) && s.link.cure_standing !== false ? s.link : null;
}

/* R10: a mark's identity: its kind and what it names. */
function markKey(m) {
  if (!isObj(m)) return "";
  return [m.kind, m.option ?? "", m.scenario ?? "", m.phase ?? "", Array.isArray(m.routes) ? [...m.routes].sort().join(",") : ""].join("|");
}

/* R5: a preparation item's rows folded: its addition, take-ups and whether it is done. */
function prepView(rows) {
  const add = rows[0];
  const done = rows.find((r) => r.act === "done");
  return { item: add.item, option: add.option_id, text: add.text, by: add.author, at: add.at,
           take_ups: rows.filter((r) => r.act === "take_up").map((r) => ({ by: r.author, target: r.target ?? null, at: r.at })),
           done: done ? { by: done.author, at: done.at } : null };
}

/* R18: the calendar day in `zone` on which an instant falls (`civil-time.localDay`, its R1); null when it cannot say. */
function dayIn(instant, zone) {
  try { const d = localDay(instant, zone); return typeof d === "string" ? d : null; } catch { return null; }
}

/* R4: civil-time's expansion, read as null when it throws, refuses or is undetermined. */
function safeExpand(a) {
  try { const r = expandRecurrence(a); return r && Array.isArray(r.instances) ? r : { reason: r && (r.why || r.reason || r.code) || null }; }
  catch { return null; }
}

/* ===================================================================== *
 * THE CODES, each minted once (DEC-49's one code, one site; K231)
 * ===================================================================== */

/** R4–R6, R8: a text of 1 to `max` characters (one line, with no quotation mark, backslash or line break, when `line`);
 *  null when it passes. */
export function refuseText(text, max, field, { line = false, says = null } = {}) {
  const good = typeof text === "string" && text.trim().length > 0 && text.length <= max && (!line || isLine(text, max));
  /* DEC-49 REGION is-text-written */
  if (!good)
    return refusal("PLAN_WORK_TEXT_REFUSED", says ? localize("plan-work.index.says_nothing_was_written", "{says}. Nothing was written.", { says: String(says) })
      : localize("plan-work.index.field_is_1_to_max", "{field} is 1 to {max} characters{v1}. Nothing was written.", { field: String(field), max: String(max), v1: String(line ? " on one line, with no quotation mark or backslash" : "") }),
      { field, max });
  /* END DEC-49 REGION is-text-written */
  return null;
}

/** R5, R11: a key naming another member (`for`), or a cost, assignee, hours or score, is refused through action-plans'
 *  one site (`refuseKeys`, its R26); `for` naming the author herself lands. Null when it passes. */
export function refuseOthers(args, author) {
  const k = refuseKeys(args);
  if (k) return k;
  if (isObj(args) && args.for !== undefined && args.for !== null && memberOf(args.for) !== memberOf(author))
    return { ...refuseKeys({ for: args.for, assignee: args.for }), keys: ["for"],
             detail: localize("plan-work.index.a_member_takes_an_item", "a member takes an item up herself; nobody assigns anybody, so for may name only you. Nothing was written.") };
  return null;
}

/** K248: a provider this host has not been given; the act or read refuses, naming it, never answering in part. */
export function refuseProviderUnavailable(provider) {
  /* DEC-49 REGION is-provider-present */
  return refusal("PLAN_WORK_PROVIDER_UNAVAILABLE", localize("plan-work.index.this_answer_reads_the_provider", "this answer reads the {provider} module, which this instance does not have; nothing is answered in its place.", { provider: String(provider) }), { provider });
  /* END DEC-49 REGION is-provider-present */
}

class ProviderAbsent extends Error {
  constructor(provider) { super(localize("plan-work.index.plan_work_provider_was_not", "plan-work: {provider} was not given", { provider: String(provider) })); this.provider = provider; }
}

for (const name of ["matterOutcomeSet", "matters", "planTimeline", "planReviewRhythm", "planReviewsDue", "planReviewOpen",
                    "planReviewRecord", "planReviews", "prepItemAdd", "prepItemTakeUp", "prepItemDone", "prepItems", "planComment",
                    "planComments", "whereItStands", "statusReportDraft", "statusReportAssist", "statusReportSave", "statusReports", "reexaminations",
                    "itemTakeUp", "takeUpsFor"]) {
  const f = PlanWork.prototype[name];
  Object.defineProperty(PlanWork.prototype, name, { configurable: true, writable: true, value: function (...a) {
    try { return f.apply(this, a); }
    catch (e) { if (e instanceof ProviderAbsent) return refuseProviderUnavailable(e.provider); throw e; }
  } });
}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It migrates its tables, declares them to
 *  purge (R12), registers its closing summary with `action-plans` (R7, its R44) and its re-examination with `actions`
 *  (R10, its R95). */
export function planWorkOf(host, deps) {
  let i = instances.get(host);
  if (!i) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const base = { record, membership };
    const lazy = (name, make) => (d[name] !== undefined ? d[name] : () => make());
    i = new PlanWork({ ...d, storage, record, membership,
      actionPlans: lazy("actionPlans", () => actionPlansOf(host, base)),
      actions: lazy("actions", () => actionsOf(host, base)),
      escalation: lazy("escalation", () => escalationOf(host, base)),
      filings: lazy("filings", () => filingsOf(host, base)),
      conformance: lazy("conformance", () => conformanceOf(host, base)),
      duties: lazy("duties", () => dutiesOf(host, base)),
      readingGuides: lazy("readingGuides", () => readingGuidesOf(host, base)),
      aiRuns: lazy("aiRuns", () => aiRunsOf(host)),
      actionHolds: lazy("actionHolds", () => actionHoldsOf(host, base)), actionReplies: lazy("actionReplies", () => actionRepliesOf(host, base)) });
    instances.set(host, i);
    i.migrate();
    record.declarePurge("plan-work", PLAN_WORK_TABLES);
    i.registered = register(i);
  }
  return i;
}

/* R7, R10: the two registrations made at start, each where its provider offers it; what each answered is kept. */
function register(i) {
  const out = {};
  let ap = null, ac = null;
  try { ap = i.actionPlans; } catch { ap = null; }
  try { ac = i.actions; } catch { ac = null; }
  out.close_snapshot = ap && typeof ap.registerCloseSnapshot === "function"
    ? ap.registerCloseSnapshot("plan-work", (a) => i.closeSnapshot(a)) : { ok: false, why: word("plan-work.why.action_plans_offers") };
  out.response_listener = ac && typeof ac.registerResponseListener === "function"
    ? ac.registerResponseListener("plan-work", (e) => i.onResponse(e)) : { ok: false, why: word("plan-work.why.actions_offers_response") };
  return out;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function planWorkOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return PLAN_WORK_TABLES.some((x) => x.name === name);
}

/** The module's ops (K3, K671), as entries of the plane's op map. `viewer` and `author` are the control plane's stamps,
 *  read from the query and set after the body, so a caller's own copy never wins. */
export function planWorkOps(m, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const pick = (k) => (url.searchParams.has(k) ? qp(k) : b[k] ?? null);
  /* A stamp the control plane did not set is the empty string, never null: a null viewer is the module's own read
     (R12: nothing reachable without a viewer's sight). */
  const stamp = (k) => qp(k) ?? "";
  const stamped = (extra = {}) => ({ ...b, ...extra, author: stamp("author"), viewer: stamp("viewer") });
  const now = () => { const n = Number(qp("now")); return Number.isFinite(n) && qp("now") !== null ? n : undefined; };
  const read = (extra = {}) => ({ plan: pick("plan"), nowMs: now(), viewer: stamp("viewer"), ...extra });
  return {
    matteroutcomeset: () => m.matterOutcomeSet(stamped({ plan: pick("plan") })),
    matters: () => m.matters(read()),
    plantimeline: () => m.planTimeline(read()),
    planreviewrhythm: () => m.planReviewRhythm(stamped({ plan: pick("plan") })),
    planreviewopen: () => m.planReviewOpen(read()),
    planreviewrecord: () => m.planReviewRecord(stamped({ plan: pick("plan") })),
    planreviews: () => m.planReviews(read()),
    prepitemadd: () => m.prepItemAdd(stamped({ plan: pick("plan"), option: pick("option") })),
    prepitemtakeup: () => m.prepItemTakeUp(stamped({ plan: pick("plan"), item: pick("item") })),
    prepitemdone: () => m.prepItemDone(stamped({ plan: pick("plan"), item: pick("item") })),
    prepitems: () => m.prepItems(read({ option: pick("option") })),
    plancomment: () => m.planComment(stamped({ plan: pick("plan") })),
    plancomments: () => m.planComments(read({ on: b.on ?? null })),
    whereitstands: () => m.whereItStands(read()),
    statusreportdraft: () => m.statusReportDraft(read()),
    statusreportassist: () => m.statusReportAssist(read()),
    statusreportsave: () => m.statusReportSave(stamped({ plan: pick("plan") })),
    statusreports: () => m.statusReports(read()),
    itemtakeup: () => m.itemTakeUp(stamped()),
    matterpromiseduties: () => m.matterPromiseDuties(read({ matter: b.matter ?? pick("matter") })),
  };
}

/* R19 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  itemtakeup: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("plan-work.declared.itemtakeup", "a member routes a clock entry's, a checkpoint's, a proposed stage's or a hold's to-dos to herself from then; nobody assigns anybody (plan-work R11)"),
    fields: { accepts: ["item","for"], requires: ["item"] } },
});
