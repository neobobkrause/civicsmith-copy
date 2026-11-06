// @ts-check
/* investigation (layer 7; T41-33, N820; D1, D15, D16, D19, D20, D27, D30, D48, H27, H28): a project's own working
 * material over its steps and objective. It publishes nothing and writes only its own tables (R10).
 *
 *   milestoneSet, milestoneRevise, milestoneRemove, milestoneItemRemove,   milestones, their state derived on read, and
 *   milestonesOf, milestonesOverdue, milestoneReminder (R1–R5)            the one notice each overdue one gives
 *   reportDraft, reportKeep, reportsOf (R6–R9)                            status reports, drafted by code from the record
 *   interviewForm, interviewKeep, interviewOf (R11–R13)                   the intake interview, kept as narrative
 *   narrativeClaim, claimFindStep, claimFound, claimsOf (R14, R15)        a remembered claim, turned into something to find
 *   firsthandAccount (R16)                                                a member who was there: provenance's testimony
 *   planPropose, planProposals, planAccept (R20)                          the assistant's planning proposals, accepted
 *   quietState, quietPrompts, projectWatch, projectCloseWithGaps,         when the work goes quiet, and where the evidence
 *   watchedProjects, watchArrival, projectStanding (R17–R19)              stands
 *   projectClose (R24)                                                    the owner's close, quiet or not
 *   check (R12)                                                           registered with `promotion`
 *
 * SHAPE (K61). `investigationOf(host, deps)` answers the one instance per host; making it creates and declares the
 * tables (R10) and registers the leg check with `promotion` (its R39). `deps` may give `record`, `membership`,
 * `promotion`, `steps`, `legEarning`, `inquiry`, `basisVersions`, `intent`, `captureRequests`, `provenance` (each
 * otherwise its factory on the same host, reached on first use), `view` (the active jurisdiction view, whose
 * `time_zone` gives the local day), `now` (a clock answering an ISO instant) and `personWarning` (a stand-in for
 * inquiry R59's test, for a test).
 *
 * A viewer, and every act's `by`, is the control plane's stamp; an absent one fails closed. Every act here has a path
 * by hand that needs no AI (R21): the assistant only proposes (`planPropose`, a proposed find step, a drafted
 * interview), and a member's act takes it up. Every refusal is `{ok: false, reason, code, check, translation, detail}`
 * and writes nothing. */
import { isMachineIdentity, ACCEPTANCE_FORMS, acceptanceRecord, lawProposalState, sha256HexSync, isStepId }
  from "../record-grammar/index.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, noSuchProject, listenerRefusal } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { inquiryOf, personWarning as inquiryPersonWarning } from "../inquiry/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { captureRequestsOf } from "../capture-requests/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { INTAKE_QUESTIONS } from "../skilldoctrine.mjs";
import { intentOf, CLOSED_REASONS } from "../intent/index.mjs";
import { localDay, isCalendarDate } from "../civil-time/index.mjs";
import { combine as combineProfiles, governingZone } from "../../../jurisdictions/index.mjs";
import { INVESTIGATION_SCHEMA, INVESTIGATION_TABLES } from "./schema.mjs";
import { INVESTIGATION_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { partsOf } from "../reading-pipeline/index.mjs";
import { MARK_PARTS_MAX, PROPOSALS_MAX, PROPOSAL_REVIEW, FILE_KINDS, termsOf, fileKindOf, partIndexOf, proposalId, blocksOf, samePart }
  from "./parts.mjs";

export { INVESTIGATION_SCHEMA, INVESTIGATION_TABLES, INVESTIGATION_CHECKS };
export { MARK_PARTS_MAX, PROPOSALS_MAX, PROPOSAL_REVIEW, FILE_KINDS };

/** R29 (T53; N1272; K5445 C): the recorded measure of proposals by file kind, `{kind: {measured_at, corpus_digest,
 *  bar_digest, met}}`. Empty until M-N1272 (section 6) has run: until then every kind answers `unavailable: not_measured`. */
export const PROPOSALS_MEASURED = Object.freeze({});

/** The module's name: its tables' declarer and its promotion step. */
export const OWNER = "investigation";
/** R2: a milestone's states, and how near a date reads as nearing (local days). */
export const MILESTONE_STATES = Object.freeze(["met", "open", "stuck"]);
export const NEARING_DAYS = 7;
/** R1: what a milestone waits on. */
export const ITEM_KINDS = Object.freeze(["question", "step"]);
/** R20: what a planning proposal is. */
export const PLAN_KINDS = Object.freeze(["question", "step"]);
/** R15: how a claim stands, and how its look stands. */
export const CLAIM_STATES = Object.freeze(["as_recalled", "found"]);
export const LOOK_STATES = Object.freeze(["not_yet_looked_for", "looked_for_and_not_found"]);
/** R11: the interview's six questions are `skills`' (its R41), read from there and never re-listed. */
export { INTAKE_QUESTIONS };
/** The work an interview's step names (R12) and a claim's find step names (R14). */
export const INTERVIEW_WORK = "Intake interview";
export const FIND_WORK_PREFIX = "Find the record: ";
export const NAME_MAX = 200, REASON_MAX = 2000, REPORT_MAX = 20000, ANSWER_MAX = 20000, CLAIM_MAX = 2000, PLAN_MAX = 500,
  ABOUT_MAX = 500;
/** The plane's own viewer, which sees every record: R17's quiet is judged the same for every reader. */
export const PLANE_VIEWER = "class:daemon";
const STEP_CLOSED = Object.freeze(["ended", "set_aside"]);
/** R18 (N846): the most captures `watchedProjects` carries for one project; past it the project's watch is unread. */
export const WATCH_CAPTURES_MAX = 100000;
const QUESTION_PAGE = 500, QUESTIONS_MAX = 2000, STEP_PAGE = 1000, STEPS_MAX = 5000;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const json = (v) => JSON.stringify(v);
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const chars = (s) => [...s].length;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const dayNumber = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;
const yamlString = (s) => `"${String(s).replace(/\\/g, "'").replace(/"/g, "'").replace(/[\r\n]+/g, " ").trim()}"`;

/** Every refusal (Provides): its row's `check` and `translation`, a `detail`, and the caller's fields beside them. */
function refuse(code, detail, extra = {}) {
  const row = INVESTIGATION_CHECKS[code];
  return { ...extra, ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
}

const instances = new WeakMap();
const storageOf = (host) => (host && host.storage ? host.storage : host);

/** K61: the one instance per host, made on the first call (`deps` read then only). */
export function investigationOf(host, deps = {}) {
  const storage = storageOf(host);
  let s = instances.get(storage);
  if (!s) {
    const record = deps.record ?? recordOf(host);
    const membership = deps.membership ?? membershipOf(host, { record });
    const promotion = deps.promotion ?? promotionOf(host, { record, membership });
    s = new Investigation(storage, { ...deps, record, membership, promotion, host });
    instances.set(storage, s);
    s.migrate();
    const r = promotion.registerStep(OWNER, { check: (c) => s.check(c) });
    if (r && r.ok === false) throw new Error(`investigation: registerStep refused: ${r.reason || r.code}`);
  }
  return s;
}

export class Investigation {
  #sql; #record; #membership; #promotion; #host; #deps; #viewFn; #now; #personWarning;
  #runHolder = null;                 // R20: {module, fn(by, run) → {principal} | null}
  #disposition = null;               // R2: {module, fn({project, question}) → "deferred" | "dismissed" | null}
  #declared = false;

  constructor(storage, { record, membership, promotion, host = null, view = null, now = null, personWarning = null, ...rest }) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#promotion = promotion;
    this.#host = host;
    this.#deps = { ...rest };
    this.#viewFn = typeof view === "function" ? view : null;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
    this.#personWarning = typeof personWarning === "function" ? personWarning : null;
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #at() { return stampInstant("second", Date.parse(this.#now())); }

  /* The modules this one reads, each the one `deps` gave or its factory on the same host, reached on first use. */
  #dep(name, make) {
    if (!this.#deps[name] && this.#host) { try { this.#deps[name] = make(this.#host); } catch { this.#deps[name] = null; } }
    return this.#deps[name] ?? null;
  }
  get #steps() { return this.#dep("steps", (h) => stepsOf(h)); }
  get #legEarning() { return this.#dep("legEarning", (h) => legEarningOf(h)); }
  get #inquiry() { return this.#dep("inquiry", (h) => inquiryOf(h)); }
  get #basisVersions() { return this.#dep("basisVersions", (h) => basisVersionsOf(h)); }
  get #intent() { return this.#dep("intent", (h) => intentOf(h)); }
  get #captureRequests() { return this.#dep("captureRequests", (h) => captureRequestsOf(h)); }
  get #provenance() { return this.#dep("provenance", (h) => provenanceOf(h)); }
  get #extraction() { return this.#dep("extraction", (h) => extractionOf(h)); }
  get #retrieval() { return this.#dep("retrieval", (h) => retrievalOf(h)); }
  /* R29: the measure table, `deps.proposalsMeasured` when a test states one, else the recorded table. */
  get #measured() { return isObj(this.#deps.proposalsMeasured) ? this.#deps.proposalsMeasured : PROPOSALS_MEASURED; }

  /* ---- boot (R10) ---- */

  /** The tables, their triggers and their declaration (R10). Idempotent; a refused declaration is a defect of the
   *  wiring and throws. */
  migrate() {
    const bare = INVESTIGATION_SCHEMA.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
    for (const part of bare.split(/(?=CREATE TRIGGER)/)) {
      if (part.startsWith("CREATE TRIGGER")) {
        const end = part.indexOf("END;");
        this.#sql.exec(part.slice(0, end + 4));
        for (const st of part.slice(end + 4).split(";")) if (st.trim()) this.#sql.exec(st.trim());
      } else for (const st of part.split(";")) if (st.trim()) this.#sql.exec(st.trim());
    }
    if (this.#declared) return { ok: true, already: true };
    /* R10: working material, never carried in any export to the public; the group's own administrators may export it;
       every row goes with its project. */
    const base = { purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false };
    const d = this.#record.declareTable(OWNER, INVESTIGATION_TABLES.map((t) => ({ ...base, name: t.name, keys: [...t.keys] })));
    if (d && d.ok === false) throw new Error(`investigation: declareTable refused: ${d.reason}`);
    this.#declared = true;
    return { ok: true };
  }

  /* ---- registrations (R2, R20) ---- */

  /** R20: the read of whether a machine credential holds a run, registered once (as `steps` R1's): `fn(by, run)`
   *  answers `{principal}` (the member viewer the run acts for) or null. */
  registerRunHolder(module, fn) {
    const refused = listenerRefusal(this.#runHolder ? { module: this.#runHolder.module } : null, module, fn);
    if (refused) return refused;
    this.#runHolder = { module, fn };
    return { ok: true, module };
  }
  /** R2: a later module that holds a project's own deferral or dismissal of a question (`queue`'s project arm, inquiry
   *  R39) registers its read once: `fn({project, question})` answers `"deferred"`, `"dismissed"` or null. */
  registerProjectDisposition(module, fn) {
    const refused = listenerRefusal(this.#disposition ? { module: this.#disposition.module } : null, module, fn);
    if (refused) return refused;
    this.#disposition = { module, fn };
    return { ok: true, module };
  }

  /* ---- who is asking ---- */

  /* The act's stamp read: a machine credential, a member (with her viewer stamp), or null (absent, fails closed). */
  #actor(by) {
    if (!filled(by)) return null;
    if (isMachineIdentity(by)) return { machine: true, by, member: null, viewer: by.replace(/\/.*$/, "") };
    let m = null;
    try { m = this.#membership.positionalMember(by); } catch { m = null; }
    return filled(m) ? { machine: false, by, member: m, viewer: `member:${m}` } : null;
  }
  #memberOf(viewer) {
    if (!filled(viewer) || isMachineIdentity(viewer)) return null;
    try { const m = this.#membership.positionalMember(viewer); return filled(m) ? m : null; } catch { return null; }
  }
  #handle(member) {
    try { const f = this.#membership.memberFacts(member); return f && filled(f.handle) ? f.handle : null; } catch { return null; }
  }
  #shown(stamp) { const m = this.#memberOf(stamp); return m ? this.#handle(m) : stamp; }

  /* ---- the project (membership R44, R55) ---- */

  /* R1's read gate: a project the viewer sees at FULL; at EXISTENCE C-70.1, otherwise absent. Null to proceed. */
  #projectSeen(project, viewer) {
    const b = filled(project) ? this.#record.bundleInfo(project) : null;
    const ex = b && b.type === "project" && filled(viewer) ? this.#membership.existenceAct(project, viewer) : null;
    if (ex) return ex;
    if (!b || b.type !== "project" || !filled(viewer) || !this.#membership.inSight(project, viewer))
      return noSuchProject(filled(project) ? project : null);
    return null;
  }
  /* An act's gate: a member (`INVESTIGATION_MEMBER_ONLY` for a machine), seeing the project, joined in it. */
  #memberGate(project, by, act) {
    const a = this.#actor(by);
    if (a && a.machine) return { refusal: refuse("INVESTIGATION_MEMBER_ONLY", `${act} is a member's act`) };
    if (!a) return { refusal: noSuchProject(filled(project) ? project : null) };
    const seen = this.#projectSeen(project, a.viewer);
    if (seen) return { refusal: seen };
    const bad = this.#membership.projectAuthority(project, a.viewer, "joined", act);
    return bad ? { refusal: bad } : { actor: a };
  }

  /* ---- the local day ---- */

  #zone() {
    let view = null;
    try {
      if (this.#viewFn) view = this.#viewFn();
      else {
        const ids = this.#record.getSetting("jurisdiction_profiles");
        const c = Array.isArray(ids) && ids.length ? combineProfiles(ids) : null;
        view = c && c.ok ? c.view : null;
      }
    } catch { view = null; }
    let g = null; /* K5292 (jurisdictions R98): the team's governing zone first */
    try { g = governingZone(this.#record.getSetting("jurisdiction_profiles"), this.#record.getSetting("team_time_zone")); } catch { g = null; }
    const z = g || (view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null);
    if (!z) return null;
    try { return typeof localDay("2026-01-01T00:00:00Z", z) === "string" ? z : null; } catch { return null; }
  }
  #today(instant) {
    const zone = this.#zone();
    if (!zone || !filled(instant)) return null;
    try { const d = localDay(String(instant).replace(/\.\d+Z$/, "Z"), zone); return typeof d === "string" ? d : null; } catch { return null; }
  }

  /* ---- what the project works on (basis-versions R41, R22; steps R4) ---- */

  /* Every question the project draws on, with this project's stance (basis-versions R41), in id order; null when the
     read fails or passes its bound. Viewer-free: the caller fences the project and each question. */
  #questionsOf(project) {
    const bv = this.#basisVersions;
    if (!bv || typeof bv.projectQuestions !== "function") return null;
    const out = [];
    let after = null;
    try {
      for (;;) {
        const r = bv.projectQuestions({ project, after, limit: QUESTION_PAGE });
        if (!isObj(r) || !Array.isArray(r.items)) return null;
        out.push(...r.items);
        if (!filled(r.cursor) || !r.items.length) break;
        if (out.length > QUESTIONS_MAX) return null;
        after = r.cursor;
      }
    } catch { return null; }
    return out;
  }
  /* The project's questions a viewer sees. */
  #questionsSeen(project, viewer) {
    const qs = this.#questionsOf(project);
    return qs === null ? null : qs.filter((q) => this.#seenBundle(q.inquiry, viewer));
  }
  #seenBundle(id, viewer) { try { return !!this.#record.bundleInfo(id) && this.#membership.inSight(id, viewer) === true; } catch { return false; } }

  /* Every page of one of steps' reads (R4), as `viewer`; null when it fails or passes its bound. */
  #allSteps(read, args) {
    const s = this.#steps;
    if (!s || typeof s[read] !== "function") return null;
    const out = [];
    let after = null;
    try {
      for (;;) {
        const r = s[read]({ ...args, after, limit: STEP_PAGE });
        if (!isObj(r) || r.ok === false || !Array.isArray(r.steps)) return null;
        out.push(...r.steps);
        if (!r.truncated) break;
        if (out.length > STEPS_MAX) return null;
        after = r.next && r.next.after;
      }
    } catch { return null; }
    return out;
  }
  /* The project's steps and those on the questions it draws on, each once, as `viewer` sees them; null when a read
     fails. `question` narrows to one question's. */
  #workSteps(project, viewer, questions, question = null) {
    const by = new Map();
    const own = question ? [] : this.#allSteps("stepsIn", { project, viewer });
    if (own === null) return null;
    for (const s of own) by.set(s.step, s);
    for (const q of question ? [question] : questions.map((x) => x.inquiry)) {
      const on = this.#allSteps("stepsOn", { question: q, viewer });
      if (on === null) return null;
      for (const s of on) by.set(s.step, s);
    }
    return [...by.values()].sort((a, b) => (a.step < b.step ? -1 : 1));
  }

  /* ---- milestones (R1–R5) ---- */

  /* R1: a `waitsOn` list read for an actor: `[{kind, ref}]`, or a refusal. An item not of this project, or not seen, is
     `MILESTONE_ITEM_UNKNOWN`, answered as absent. */
  #items(project, waitsOn, viewer) {
    if (!Array.isArray(waitsOn) || waitsOn.length === 0)
      return { refusal: refuse("MILESTONE_WAITS_ON_NOTHING", "a milestone names at least one question or step it waits on") };
    const qs = this.#questionsSeen(project, viewer);
    if (qs === null) return { refusal: refuse("MILESTONE_ITEM_UNKNOWN", word("investigation.questions_project_draws")) };
    const qids = new Set(qs.map((q) => q.inquiry));
    const out = [];
    for (const raw of waitsOn) {
      const it = typeof raw === "string" ? { kind: isStepId(raw.trim()) ? "step" : "question", ref: raw.trim() }
        : isObj(raw) ? { kind: raw.kind, ref: typeof raw.ref === "string" ? raw.ref.trim() : (raw.question ?? raw.step ?? "") } : null;
      if (it && !filled(it.kind) && isObj(raw)) it.kind = raw.question ? "question" : raw.step ? "step" : "";
      if (!it || !ITEM_KINDS.includes(it.kind) || !filled(it.ref))
        return { refusal: refuse("MILESTONE_ITEM_UNKNOWN", "an item is a question or a step, by id", { item: raw ?? null }) };
      if (it.kind === "question" && !qids.has(it.ref))
        return { refusal: refuse("MILESTONE_ITEM_UNKNOWN", "no question this project draws on by that id that you can see", { item: it.ref }) };
      if (it.kind === "step" && !this.#stepOfProject(it.ref, project, qids, viewer))
        return { refusal: refuse("MILESTONE_ITEM_UNKNOWN", "no step of this project by that id that you can see", { item: it.ref }) };
      if (!out.some((o) => o.kind === it.kind && o.ref === it.ref)) out.push({ kind: it.kind, ref: it.ref });
    }
    return { items: out };
  }
  /* A step the viewer sees, placed in this project or on a question it draws on. */
  #stepOfProject(stepId, project, qids, viewer) {
    try {
      const s = this.#steps.step({ step: stepId, viewer });
      if (!s || s.ok !== true) return false;
      return s.place.project === project || (Array.isArray(s.place.questions) && s.place.questions.some((q) => qids.has(q)));
    } catch { return false; }
  }

  #history(milestoneId, project, act, detail, by, at) {
    this.#sql.exec(`INSERT INTO inv_milestone_history (milestone_id, project_id, act, detail_json, by_actor, at) VALUES (?,?,?,?,?,?)`,
      milestoneId, project, act, detail === null ? null : json(detail), by, at);
  }

  /** R1: `milestoneSet({project, name, date, waitsOn, by})`, by a joined participant; history kept. */
  milestoneSet({ project = null, name = null, date = null, waitsOn = null, by = null } = {}) {
    const g = this.#memberGate(project, by, "milestoneSet");
    if (g.refusal) return g.refusal;
    if (!filled(name) || chars(name.trim()) > NAME_MAX) return refuse("MILESTONE_NO_NAME", `a milestone's name is 1–${NAME_MAX} characters`);
    if (!filled(date) || !isCalendarDate(date)) return refuse("MILESTONE_BAD_DATE", "a milestone's date is YYYY-MM-DD");
    const it = this.#items(project, waitsOn, g.actor.viewer);
    if (it.refusal) return it.refusal;
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_milestones (project_id, name, date, by_actor, at) VALUES (?,?,?,?,?)`, project, name.trim(), date, by, at);
      const id = Number(this.#one(`SELECT MAX(milestone_id) AS id FROM inv_milestones`).id);
      for (const i of it.items)
        this.#sql.exec(`INSERT INTO inv_milestone_items (milestone_id, project_id, kind, ref, by_actor, at) VALUES (?,?,?,?,?,?)`, id, project, i.kind, i.ref, by, at);
      this.#history(id, project, "set", { name: name.trim(), date, waitsOn: it.items }, by, at);
      return { ok: true, milestone: id, project, at };
    });
  }

  /* A milestone held and not removed, and the act's gate on its project. */
  #milestoneGate(milestone, by, act) {
    const m = Number.isSafeInteger(Number(milestone)) && milestone !== null && milestone !== ""
      ? this.#one(`SELECT * FROM inv_milestones WHERE milestone_id = ? AND removed_at IS NULL`, Number(milestone)) : null;
    const noSuch = refuse("NO_SUCH_MILESTONE", "no milestone by that number is held that you can see", { milestone: milestone ?? null });
    if (!m) return { refusal: noSuch };
    const a = this.#actor(by);
    if (!a || a.machine || this.#projectSeen(m.project_id, a.viewer)) return { refusal: a && a.machine ? refuse("INVESTIGATION_MEMBER_ONLY", `${act} is a member's act`) : noSuch };
    const bad = this.#membership.projectAuthority(m.project_id, a.viewer, "joined", act);
    return bad ? { refusal: bad } : { m, actor: a };
  }

  /** R1: `milestoneRevise({milestone, name?, date?, waitsOn?, by})`: a new name, date or added items, with history. */
  milestoneRevise({ milestone = null, name = undefined, date = undefined, waitsOn = undefined, by = null } = {}) {
    const g = this.#milestoneGate(milestone, by, "milestoneRevise");
    if (g.refusal) return g.refusal;
    const { m } = g;
    if (name !== undefined && (!filled(name) || chars(name.trim()) > NAME_MAX)) return refuse("MILESTONE_NO_NAME", `a milestone's name is 1–${NAME_MAX} characters`);
    if (date !== undefined && (!filled(date) || !isCalendarDate(date))) return refuse("MILESTONE_BAD_DATE", "a milestone's date is YYYY-MM-DD");
    let add = [];
    if (waitsOn !== undefined) {
      const it = this.#items(m.project_id, waitsOn, g.actor.viewer);
      if (it.refusal) return it.refusal;
      const held = this.#itemRows(m.milestone_id).filter((r) => !r.removed_at);
      add = it.items.filter((i) => !held.some((h) => h.kind === i.kind && h.ref === i.ref));
    }
    const at = this.#at();
    return this.#record.transact(() => {
      const detail = {};
      if (name !== undefined && name.trim() !== m.name) { this.#sql.exec(`UPDATE inv_milestones SET name = ? WHERE milestone_id = ?`, name.trim(), m.milestone_id); detail.name = { from: m.name, to: name.trim() }; }
      if (date !== undefined && date !== m.date) { this.#sql.exec(`UPDATE inv_milestones SET date = ? WHERE milestone_id = ?`, date, m.milestone_id); detail.date = { from: m.date, to: date }; }
      for (const i of add)
        this.#sql.exec(`INSERT INTO inv_milestone_items (milestone_id, project_id, kind, ref, by_actor, at) VALUES (?,?,?,?,?,?)`, m.milestone_id, m.project_id, i.kind, i.ref, by, at);
      if (add.length) detail.added = add;
      this.#history(m.milestone_id, m.project_id, "revise", detail, by, at);
      return { ok: true, milestone: Number(m.milestone_id), at };
    });
  }

  /** R1: `milestoneRemove({milestone, reason, by})`: it leaves every read; its history stays. */
  milestoneRemove({ milestone = null, reason = null, by = null } = {}) {
    const g = this.#milestoneGate(milestone, by, "milestoneRemove");
    if (g.refusal) return g.refusal;
    if (!filled(reason) || chars(reason) > REASON_MAX) return refuse("INVESTIGATION_NO_REASON", `say why, in 1–${REASON_MAX} characters`);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE inv_milestones SET removed_by = ?, removed_at = ?, removed_reason = ? WHERE milestone_id = ?`, by, at, reason.trim(), g.m.milestone_id);
      this.#history(g.m.milestone_id, g.m.project_id, "remove", { reason: reason.trim() }, by, at);
      return { ok: true, milestone: Number(g.m.milestone_id), removed: true, at };
    });
  }

  /** R1, R2: `milestoneItemRemove({milestone, item, reason, by})`: a member takes an item off, recorded. */
  milestoneItemRemove({ milestone = null, item = null, reason = null, by = null } = {}) {
    const g = this.#milestoneGate(milestone, by, "milestoneItemRemove");
    if (g.refusal) return g.refusal;
    const ref = typeof item === "string" ? item.trim() : isObj(item) ? String(item.ref ?? item.question ?? item.step ?? "").trim() : "";
    const row = this.#itemRows(g.m.milestone_id).find((r) => !r.removed_at && r.ref === ref);
    if (!row) return refuse("MILESTONE_ITEM_UNKNOWN", "this milestone waits on no item by that id", { item: ref || null });
    if (!filled(reason) || chars(reason) > REASON_MAX) return refuse("INVESTIGATION_NO_REASON", `say why, in 1–${REASON_MAX} characters`);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE inv_milestone_items SET removed_by = ?, removed_at = ?, removed_reason = ? WHERE item_id = ?`, by, at, reason.trim(), row.item_id);
      this.#history(g.m.milestone_id, g.m.project_id, "item_remove", { item: { kind: row.kind, ref }, reason: reason.trim() }, by, at);
      return { ok: true, milestone: Number(g.m.milestone_id), item: { kind: row.kind, ref }, removed: true, at };
    });
  }

  #itemRows(milestoneId) { return this.#rows(`SELECT * FROM inv_milestone_items WHERE milestone_id = ? ORDER BY item_id`, milestoneId); }

  /* R2: a question's own deferral or dismissal for this project: its own state, or the registered read; null else. */
  #disposed(project, question) {
    try {
      const h = this.#record.head(question);
      if (h && (h.currentState === "deferred" || h.currentState === "dismissed")) return h.currentState;
    } catch { /* read below */ }
    if (!this.#disposition) return null;
    try { const r = this.#disposition.fn({ project, question }); return r === "deferred" || r === "dismissed" ? r : null; } catch { return null; }
  }

  /* R2: one item's state for a viewer: `done`, `open`, `stuck` (naming why) or `undetermined`. */
  #itemState(project, item, viewer, stances) {
    if (item.kind === "question") {
      if (!this.#seenBundle(item.ref, viewer)) return { state: "undetermined", why: word("investigation.why.question_see") };
      const stance = stances.get(item.ref);
      if (stance === "concluded") return { state: "done", why: word("investigation.why.project_concluded") };
      const d = this.#disposed(project, item.ref);
      if (d) return { state: "stuck", why: d };
      return { state: "open", ...(stance === undefined ? { why: word("investigation.why.project_longer_draws") } : {}) };
    }
    let s = null;
    try { s = this.#steps.step({ step: item.ref, viewer }); } catch { s = null; }
    if (!s || s.ok !== true) return { state: "undetermined", why: word("investigation.why.step_see") };
    if (s.state === "ended") return { state: "done", why: "ended" };
    if (s.state === "set_aside") return { state: "stuck", why: "set_aside" };
    return { state: "open", step_state: s.state };
  }

  /* R2: a milestone as a viewer reads it. */
  #milestoneView(m, viewer, today, stances) {
    const items = this.#itemRows(m.milestone_id).map((r) => {
      const base = { kind: r.kind, ref: r.ref };
      if (r.removed_at) return { ...base, removed: { by: this.#shown(r.removed_by), at: r.removed_at, reason: r.removed_reason } };
      return { ...base, ...this.#itemState(m.project_id, r, viewer, stances) };
    });
    const live = items.filter((i) => !i.removed);
    const stuck = live.filter((i) => i.state === "stuck");
    const state = stuck.length ? "stuck" : live.length && live.every((i) => i.state === "done") ? "met" : "open";
    const delta = today ? dayNumber(m.date) - dayNumber(today) : null;
    return {
      milestone: Number(m.milestone_id), project: m.project_id, name: m.name, date: m.date, state,
      ...(stuck.length ? { stuck_on: stuck.map((i) => ({ kind: i.kind, ref: i.ref, why: i.why })) } : {}),
      nearing: delta === null ? null : state !== "met" && delta >= 0 && delta <= NEARING_DAYS,
      overdue: delta === null ? null : state !== "met" && delta < 0,
      ...(today ? {} : { why: word("steps.why.time_zone_held") }),
      items, by: this.#shown(m.by_actor), at: m.at,
      history: this.#rows(`SELECT act, detail_json, by_actor, at FROM inv_milestone_history WHERE milestone_id = ? ORDER BY seq`, m.milestone_id)
        .map((h) => ({ act: h.act, detail: parse(h.detail_json), by: this.#shown(h.by_actor), at: h.at })),
    };
  }
  #stances(project) {
    const qs = this.#questionsOf(project) ?? [];
    return new Map(qs.map((q) => [q.inquiry, q.stance]));
  }

  /** R1, R2, R4: `milestonesOf({project, viewer})`: the project's milestones, to a viewer at FULL sight of it. */
  milestonesOf({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    try {
      const today = this.#today(this.#now());
      const stances = this.#stances(project);
      const milestones = this.#rows(`SELECT * FROM inv_milestones WHERE project_id = ? AND removed_at IS NULL ORDER BY date, milestone_id`, project)
        .map((m) => this.#milestoneView(m, viewer, today, stances));
      return { ok: true, project, milestones };
    } catch { return noSuchProject(project); }
  }

  /* The projects a member is joined in (membership R120's read contract). */
  #joinedProjects(member) {
    try { return this.#rows(`SELECT project_id FROM project_participants WHERE member_id = ? AND state = 'joined' ORDER BY project_id`, member).map((r) => r.project_id); }
    catch { return []; }
  }

  /** R3: `milestonesOverdue({viewer, at})`, for `notice-producers`: each overdue milestone once to each joined
   *  participant (key per milestone and date), and each reminder she asked for, on its day, to her alone. Nothing
   *  else reminds (DEC-94). */
  milestonesOverdue({ viewer = null, at = null } = {}) {
    const member = this.#memberOf(viewer);
    if (!member) return { ok: true, due: [] };
    const today = filled(at) ? this.#today(at) : null;
    if (!today) return { ok: true, due: [], undetermined: true, why: word("steps.why.time_zone_held_group") };
    const due = [];
    try {
      for (const project of this.#joinedProjects(member)) {
        if (!this.#membership.isJoinedParticipant(project, member) || this.#projectSeen(project, viewer)) continue;
        const stances = this.#stances(project);
        for (const m of this.#rows(`SELECT * FROM inv_milestones WHERE project_id = ? AND removed_at IS NULL AND date < ? ORDER BY milestone_id`, project, today)) {
          const v = this.#milestoneView(m, viewer, today, stances);
          if (v.state === "met") continue;
          due.push({ kind: "overdue", milestone: v.milestone, project, name: v.name, date: v.date, state: v.state,
                     key: sha256HexSync(`investigation:overdue:${v.milestone}:${v.date}`) });
        }
      }
      for (const r of this.#rows(`SELECT r.seq, r.day, m.* FROM inv_milestone_reminders r JOIN inv_milestones m ON m.milestone_id = r.milestone_id
                                   WHERE r.member = ? AND r.day = ? AND m.removed_at IS NULL ORDER BY r.seq`, member, today)) {
        if (this.#projectSeen(r.project_id, viewer)) continue;
        due.push({ kind: "reminder", milestone: Number(r.milestone_id), project: r.project_id, name: r.name, date: r.date,
                   key: sha256HexSync(`investigation:reminder:${r.seq}`) });
      }
    } catch { return { ok: true, due: [] }; }
    return { ok: true, due };
  }

  /** R3: `milestoneReminder({milestone, at, by})`: a reminder she asked for, answered to her alone on that day. */
  milestoneReminder({ milestone = null, at = null, by = null } = {}) {
    const g = this.#milestoneGate(milestone, by, "milestoneReminder");
    if (g.refusal) return g.refusal;
    if (!filled(at) || !isCalendarDate(at)) return refuse("MILESTONE_BAD_DATE", "a reminder names a calendar day, YYYY-MM-DD");
    const when = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_milestone_reminders (milestone_id, project_id, member, day, at) VALUES (?,?,?,?,?)`,
        g.m.milestone_id, g.m.project_id, g.actor.member, at, when);
      return { ok: true, milestone: Number(g.m.milestone_id), day: at, at: when };
    });
  }

  /* ---- status reports (R6–R9) ---- */

  /* R6: the last report kept for the project (question null) or for that question in the project. */
  #lastReport(project, question) {
    return question
      ? this.#one(`SELECT * FROM inv_reports WHERE project_id = ? AND question_id = ? ORDER BY report_id DESC LIMIT 1`, project, question)
      : this.#one(`SELECT * FROM inv_reports WHERE project_id = ? AND question_id IS NULL ORDER BY report_id DESC LIMIT 1`, project);
  }
  /* R6: the question a report is on, among the project's questions the viewer sees; a refusal else. */
  #reportQuestion(project, question, viewer) {
    if (question === undefined || question === null || question === "") return { question: null, qs: this.#questionsSeen(project, viewer) };
    const qs = this.#questionsSeen(project, viewer);
    if (!qs || !qs.some((q) => q.inquiry === question))
      return { refusal: refuse("NO_SUCH_QUESTION", "no question this project draws on by that id that you can see", { question }) };
    return { question, qs };
  }

  /** R6, R8: `reportDraft({project, question?, viewer})` composes, by code and with no AI, from the record since the
   *  last report kept for that project (or that question in it): steps taken and ended, with outcomes and learned
   *  lines; what was found; what is waiting. Each line cites its source; only what the viewer sees enters; handles
   *  appear only as attribution, never counted. It writes nothing. */
  reportDraft({ project = null, question = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const rq = this.#reportQuestion(project, question, viewer);
    if (rq.refusal) return rq.refusal;
    if (rq.qs === null) return { ok: false, reason: "UNDETERMINED", project, detail: "the questions this project draws on could not be read, so no draft was made" };
    return this.#draft(project, rq.question, rq.qs, viewer);
  }

  #draft(project, question, qs, viewer) {
    const last = this.#lastReport(project, question);
    const since = last ? last.at : null;
    const before = last ? parse(last.steps_json) ?? {} : {};
    const after = (t) => filled(t) && (since === null || t > since);
    const steps = this.#workSteps(project, viewer, qs, question);
    if (steps === null) return { ok: false, reason: "UNDETERMINED", project, detail: "the steps could not be read, so no draft was made" };
    const lines = [];
    const line = (section, text, source) => lines.push({ section, text, source });
    const outcomeWords = { helped: "helped", dead_end: word("investigation.dead_end"), undetermined: word("investigation.judged") };
    const ended = [];
    for (const s of steps) {
      const doer = s.doer === "system" ? "the system" : s.doer;
      if (after(s.at)) line("taken", word("investigation.took_step", { doer: String(doer), work: String(s.work) }), { kind: "step", id: s.step });
      if (STEP_CLOSED.includes(s.state) && !STEP_CLOSED.includes(before[s.step])) {
        ended.push(s);
        const outs = (s.outcomes ?? []).map((o) => `${o.question ? `for ${o.question} ` : ""}${outcomeWords[o.outcome] ?? o.outcome}`).join("; ");
        line("ended", `${s.state === "ended" ? "Ended" : "Set aside"}: ${s.work}${outs ? ` (${outs})` : ""}`, { kind: "step", id: s.step });
        for (const l of s.learned ?? []) line("ended", word("investigation.wrote_learned", { by: String(l.by ?? "a member"), text: String(l.text) }), { kind: "step", id: s.step });
      }
    }
    /* what was found: products of the steps taken or ended since, legs added, the project's conclusions and withdrawals */
    const touched = steps.filter((s) => after(s.at) || ended.includes(s));
    for (const s of touched) {
      let p = null;
      try { p = this.#steps.productsOf({ step: s.step, viewer }); } catch { p = null; }
      for (const x of (p && p.ok ? p.products : [])) line("found", word("investigation.step_produced", { work: String(s.work), kind: String(x.kind), id: String(x.id) }), { kind: x.kind, id: x.id, step: s.step });
    }
    const scope = question ? qs.filter((q) => q.inquiry === question) : qs;
    for (const q of scope) {
      let b = null;
      try { b = this.#legEarning.basisFor(q.inquiry); } catch { b = null; }
      for (const l of (b && b.ok ? b.legs : [])) {
        if (!after(l.at) || !this.#legSeen(l, viewer)) continue;
        line("found", word("investigation.leg_added_resting", { role: String(l.role === "cuts_against" ? "cutting against" : "supporting"), inquiry: String(q.inquiry), target_id: String(l.target_id), grade: String(l.grade ? ` at grade ${l.grade}` : "") }),
          { kind: "leg", id: q.inquiry, target: l.target_id });
      }
      let rec = null;
      try { rec = this.#basisVersions.conclusionRecordOf(project, q.inquiry, viewer); } catch { rec = null; }
      for (const h of (rec && Array.isArray(rec.history) ? rec.history : [])) {
        if (!after(h.at)) continue;
        if (h.act === "concluded") line("found", word("investigation.project_concluded", { inquiry: String(q.inquiry), claim: String(h.claim ?? word("investigation.claim_cannot_read")) }), { kind: "conclusion", id: q.inquiry });
        else if (h.act === "withdrawn") line("found", word("investigation.project_withdrew_conclusion", { inquiry: String(q.inquiry) }), { kind: "conclusion", id: q.inquiry });
      }
    }
    /* what is waiting: step waits, the questions' waits (inquiry R55, R58), open milestones */
    for (const s of steps) {
      if (STEP_CLOSED.includes(s.state)) continue;
      for (const w of s.waits ?? []) {
        if (w.met === true) continue;
        const on = w.on.step ? `the step ${w.on.step}` : w.on.date ? `the date ${w.on.date}` : w.on.arrival ? `${w.on.arrival.kind} ${w.on.arrival.id}` : word("investigation.something_cannot_see");
        line("waiting", localize("investigation.index.work_waits_on_on", "\"{work}\" waits on {on}", { work: String(s.work), on: String(on) }), { kind: "step", id: s.step });
      }
    }
    for (const q of scope) {
      let w = null;
      try { w = this.#inquiry.questionWaits({ question: q.inquiry, viewer }); } catch { w = null; }
      for (const x of (w && Array.isArray(w.waits) ? w.waits : []))
        if (x.state !== "ended") line("waiting", `${q.inquiry} waits on ${x.text}${x.date ? ` by ${x.date}` : ""}`, { kind: "wait", id: q.inquiry, index: x.index });
    }
    let dw = null;
    try { dw = scope.length ? this.#inquiry.documentWaits({ questions: scope.map((q) => q.inquiry), viewer }) : null; } catch { dw = null; }
    for (const e of (dw && Array.isArray(dw.questions) ? dw.questions : []))
      for (const x of (Array.isArray(e.waits) ? e.waits : [])) line("waiting", word("investigation.waits_document_set", { question: String(e.question), document: String(x.document) }), { kind: "document-wait", id: e.question, document: x.document });
    if (!question) {
      const today = this.#today(this.#now());
      const stances = new Map(qs.map((q) => [q.inquiry, q.stance]));
      for (const m of this.#rows(`SELECT * FROM inv_milestones WHERE project_id = ? AND removed_at IS NULL ORDER BY date, milestone_id`, project)) {
        const v = this.#milestoneView(m, viewer, today, stances);
        if (v.state !== "met") line("waiting", word("investigation.milestone", { name: String(v.name), date: String(v.date), state: String(v.state) }), { kind: "milestone", id: v.milestone });
      }
    }
    const heads = { taken: "Steps taken", ended: "Steps ended", found: word("investigation.found"), waiting: word("investigation.waiting") };
    const text = Object.entries(heads).map(([k, h]) => {
      const ls = lines.filter((l) => l.section === k);
      return ls.length ? `${h}\n${ls.map((l) => `- ${l.text} [${l.source.kind} ${l.source.id}]`).join("\n")}` : null;
    }).filter(Boolean).join("\n\n");
    return { ok: true, project, question, since, lines, text, drafted_by: "code", machine_work: false };
  }
  /* A leg the viewer may see: one on a bundle she sees, or on a target that is no bundle (a passage, a derived
     connection), which the inquiry's own sight covers. */
  #legSeen(leg, viewer) {
    const t = leg && typeof leg.target_id === "string" ? leg.target_id : "";
    if (!t) return false;
    try { return this.#record.bundleInfo(t) ? this.#membership.inSight(t, viewer) === true : true; } catch { return false; }
  }

  /** R7, R9: `reportKeep({project, question?, text, since, corrects?, by})`, by a joined participant: kept as she keeps
   *  it, dated, with its author, never edited after; a later report may correct it. Nothing requires or schedules one. */
  reportKeep({ project = null, question = null, text = null, since = null, corrects = null, by = null } = {}) {
    const g = this.#memberGate(project, by, "reportKeep");
    if (g.refusal) return g.refusal;
    const rq = this.#reportQuestion(project, question, g.actor.viewer);
    if (rq.refusal) return rq.refusal;
    if (!filled(text) || chars(text) > REPORT_MAX) return refuse("REPORT_NO_TEXT", `a report is 1–${REPORT_MAX} characters`);
    const at = this.#at();
    if (since !== null && since !== undefined && (!filled(since) || !ISO.test(since) || Date.parse(since) > Date.parse(at) + 1000))
      return refuse("REPORT_BAD_SINCE", "since is an ISO instant no later than now");
    let corr = null;
    if (corrects !== null && corrects !== undefined) {
      corr = this.#one(`SELECT report_id FROM inv_reports WHERE report_id = ? AND project_id = ?`, Number(corrects), project);
      if (!corr) return refuse("REPORT_NO_TEXT", "the report it corrects is not one of this project's", { corrects });
    }
    const steps = rq.qs === null ? null : this.#workSteps(project, g.actor.viewer, rq.qs, rq.question);
    const snapshot = Object.fromEntries((steps ?? []).map((s) => [s.step, s.state]));
    const last = this.#lastReport(project, rq.question);
    const from = filled(since) ? since : last ? last.at : at;
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_reports (project_id, question_id, text, since, corrects, steps_json, author, at) VALUES (?,?,?,?,?,?,?,?)`,
        project, rq.question, text, from, corr ? Number(corr.report_id) : null, json(snapshot), g.actor.member, at);
      return { ok: true, report: Number(this.#one(`SELECT MAX(report_id) AS id FROM inv_reports`).id), project, question: rq.question, at };
    });
  }

  /** R7: `reportsOf({project, viewer})`: the kept reports, newest first, to the project's participants. */
  reportsOf({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const reports = this.#rows(`SELECT * FROM inv_reports WHERE project_id = ? ORDER BY report_id DESC LIMIT 500`, project)
      .filter((r) => !r.question_id || this.#seenBundle(r.question_id, viewer))
      .map((r) => ({ report: Number(r.report_id), question: r.question_id ?? null, text: r.text, since: r.since,
                     ...(r.corrects ? { corrects: Number(r.corrects) } : {}), author: this.#handle(r.author), at: r.at }));
    return { ok: true, project, reports };
  }

  /* ---- the warning about a person in no public role (R22) ---- */

  /* inquiry R59's test over `text`, for `viewer`: null when it names no person in no public role, or when the test
     cannot be asked (a warning, never a refusal). */
  #warning(text, viewer) {
    try {
      if (this.#personWarning) return this.#personWarning({ text, viewer }) ?? null;
      const inq = this.#inquiry;
      const facts = inq && typeof inq.personFacts === "function" ? inq.personFacts({ text, viewer }) : [];
      return inquiryPersonWarning({ text, entities: facts, viewer }) ?? null;
    } catch { return null; }
  }

  /* ---- the intake interview (R11–R13) ---- */

  /** R11: `interviewForm({project, viewer})`: the one page the by-hand path asks, the six questions as `skills` holds
   *  them. */
  interviewForm({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    return { ok: true, project, questions: INTAKE_QUESTIONS.map((q, i) => ({ index: i, question: q })), path: "by_hand" };
  }

  /* R12: six answers read from an array of strings or of `{answer}`; null when not six strings. */
  static #answers(a) {
    if (!Array.isArray(a) || a.length !== INTAKE_QUESTIONS.length) return null;
    const out = a.map((x) => (typeof x === "string" ? x : isObj(x) && typeof x.answer === "string" ? x.answer : null));
    if (out.some((x) => x === null || chars(x) > ANSWER_MAX) || !out.some((x) => x.trim() !== "")) return null;
    return out.map((x) => x.trim());
  }

  /** R12, R22: `interviewKeep({project, answers, from_draft?, by})`, by a joined participant, after she checks them:
   *  each answer kept in her words as narrative, with whether it began as the assistant's draft and was kept unchanged
   *  or edited (record-grammar R52). The interview is a project-placed step of the project, its record the step's
   *  product, held here. */
  interviewKeep({ project = null, answers = null, from_draft = null, by = null } = {}) {
    const g = this.#memberGate(project, by, "interviewKeep");
    if (g.refusal) return g.refusal;
    const mine = Investigation.#answers(answers);
    if (!mine) return refuse("INTERVIEW_BAD_ANSWERS", `six answers, each 0–${ANSWER_MAX} characters, at least one written`);
    let draft = null;
    if (from_draft !== null && from_draft !== undefined) {
      draft = isObj(from_draft) ? Investigation.#answers(from_draft.answers) : null;
      if (!draft) return refuse("INTERVIEW_BAD_ANSWERS", "the assistant's draft holds the same six answers");
    }
    const kept = mine.map((answer, i) => {
      const began = !!draft && draft[i] !== "";
      return { index: i, question: INTAKE_QUESTIONS[i], answer, kind: "narrative", began_as_draft: began,
               kept: began ? (draft[i] === answer ? "unchanged" : "edited") : null };
    });
    const warning = this.#warning(mine.join("\n"), g.actor.viewer);
    const at = this.#at();
    return this.#record.transact(() => {
      const s = this.#steps;
      const made = s.stepCreate({ place: { project }, work: INTERVIEW_WORK, project, by });
      if (!made || made.ok !== true) return made;
      const st = s.stepStart({ step: made.step, by });
      if (!st || st.ok !== true) return st;
      const en = s.stepEnd({ step: made.step, end: "ended", by });
      if (!en || en.ok !== true) return en;
      const acceptance = draft
        ? acceptanceRecord({ proposal: `interview-draft:${made.step}`, form: kept.every((k) => !k.began_as_draft || k.kept === "unchanged") ? "as_proposed" : "edited",
                             by, at, kind: "interview" })
        : null;
      this.#sql.exec(`INSERT INTO inv_interviews (project_id, step_id, answers_json, acceptance_json, run, warning_json, author, at) VALUES (?,?,?,?,?,?,?,?)`,
        project, made.step, json(kept), acceptance ? json(acceptance) : null, draft && filled(from_draft.run) ? from_draft.run : null,
        warning ? json(warning) : null, g.actor.member, at);
      const id = Number(this.#one(`SELECT MAX(interview_id) AS id FROM inv_interviews`).id);
      return { ok: true, interview: id, project, step: made.step, answers: kept, ...(acceptance ? { acceptance } : {}),
               ...(warning ? { warning } : {}), at };
    });
  }

  /** R13: `interviewOf({project, viewer})`: the kept interviews, each labelled as the member's own account. */
  interviewOf({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const interviews = this.#rows(`SELECT * FROM inv_interviews WHERE project_id = ? ORDER BY interview_id`, project).map((r) => {
      const handle = this.#handle(r.author);
      return { interview: Number(r.interview_id), step: r.step_id, author: handle,
               label: word("investigation.label.account_words_narrative", { handle: String(handle ?? "a member") }),
               evidence: false, answers: parse(r.answers_json) ?? [], acceptance: parse(r.acceptance_json),
               ...(r.warning_json ? { warning: parse(r.warning_json) } : {}), at: r.at };
    });
    return { ok: true, project, interviews };
  }

  /* ---- narrative claims (R14, R15) ---- */

  /** R14, R22: `narrativeClaim({project, source, text, about?, by})`: a claim in a member's narrative about what a
   *  public body said or did, a quoted span of an interview answer (`{interview, answer}`) or her own words
   *  (`{own: true}`). */
  narrativeClaim({ project = null, source = null, text = null, about = null, by = null } = {}) {
    const g = this.#memberGate(project, by, "narrativeClaim");
    if (g.refusal) return g.refusal;
    if (!filled(text) || chars(text.trim()) > CLAIM_MAX) return refuse("CLAIM_NO_TEXT", `a claim is 1–${CLAIM_MAX} characters`);
    if (about !== null && about !== undefined && (!filled(about) || chars(about) > ABOUT_MAX)) return refuse("CLAIM_NO_TEXT", `what it is about is 1–${ABOUT_MAX} characters`);
    let src;
    if (isObj(source) && source.own === true && Object.keys(source).length === 1) src = { own: true };
    else if (isObj(source) && source.interview !== undefined && Number.isInteger(source.answer)) {
      const iv = this.#one(`SELECT * FROM inv_interviews WHERE interview_id = ? AND project_id = ?`, Number(source.interview), project);
      if (!iv) return refuse("NO_SUCH_INTERVIEW", "no interview of this project by that number", { interview: source.interview });
      const a = (parse(iv.answers_json) ?? [])[source.answer];
      if (!a || typeof a.answer !== "string" || !a.answer.includes(text.trim()))
        return refuse("CLAIM_BAD_SOURCE", "the claim is not a quoted span of that answer");
      src = { interview: Number(iv.interview_id), answer: source.answer };
    } else return refuse("CLAIM_BAD_SOURCE", "a claim's source is {interview, answer} or {own: true}");
    const warning = this.#warning(`${text}\n${about ?? ""}`, g.actor.viewer);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_claims (project_id, source_json, text, about, warning_json, author, at) VALUES (?,?,?,?,?,?,?)`,
        project, json(src), text.trim(), filled(about) ? about.trim() : null, warning ? json(warning) : null, g.actor.member, at);
      const id = Number(this.#one(`SELECT MAX(claim_id) AS id FROM inv_claims`).id);
      return { ok: true, claim: id, project, stated_as: "as_recalled", ...(warning ? { warning } : {}), at };
    });
  }

  #claimRow(claim) {
    return Number.isSafeInteger(Number(claim)) && claim !== null && claim !== "" ? this.#one(`SELECT * FROM inv_claims WHERE claim_id = ?`, Number(claim)) : null;
  }

  /** R14, R21: `claimFindStep({claim, question?, run?, by})`: a member creates the "find the record" step, on the
   *  claim's question (one the project draws on) or in the project; the assistant proposes it (`steps` R24). */
  claimFindStep({ claim = null, question = null, run = null, by = null } = {}) {
    const c = this.#claimRow(claim);
    const a = this.#actor(by);
    const noSuch = refuse("NO_SUCH_CLAIM", "no claim by that number is held that you can see", { claim: claim ?? null });
    if (!c || !a) return noSuch;
    const viewer = a.machine ? this.#principal(by, run) : a.viewer;
    if (!viewer) return refuse("PLAN_NOT_YOUR_RUN", "the assistant proposes only for a run it holds", { run: run ?? null });
    if (this.#projectSeen(c.project_id, viewer)) return noSuch;
    if (filled(question)) {
      const qs = this.#questionsSeen(c.project_id, viewer);
      if (!qs || !qs.some((q) => q.inquiry === question)) return refuse("NO_SUCH_QUESTION", "no question this project draws on by that id that you can see", { question });
    }
    const place = filled(question) ? { questions: [question] } : { project: c.project_id };
    const work = `${FIND_WORK_PREFIX}${c.text}`.slice(0, 500);
    if (a.machine) {
      const p = this.#steps.stepPropose({ place, work, why: word("investigation.why.member_recalls_record"), run, by });
      if (!p || p.ok !== true) return p;
      this.#sql.exec(`UPDATE inv_claims SET find_proposal = ? WHERE claim_id = ?`, Number(p.proposal), c.claim_id);
      return { ok: true, claim: Number(c.claim_id), proposal: p.proposal, label: p.label };
    }
    if (c.find_step) return { ok: true, claim: Number(c.claim_id), step: c.find_step, already: true };
    return this.#record.transact(() => {
      const made = this.#steps.stepCreate({ place, work, project: c.project_id, by });
      if (!made || made.ok !== true) return made;
      this.#sql.exec(`UPDATE inv_claims SET find_step = ? WHERE claim_id = ?`, made.step, c.claim_id);
      return { ok: true, claim: Number(c.claim_id), step: made.step, at: made.at };
    });
  }

  /** R15: `claimFound({claim, record, by})`: a member ties the record to the claim's find step (`steps` R9) and marks
   *  the claim found. */
  claimFound({ claim = null, record = null, step = null, by = null } = {}) {
    const c = this.#claimRow(claim);
    const a = this.#actor(by);
    if (a && a.machine) return refuse("INVESTIGATION_MEMBER_ONLY", "marking a claim found is a member's act");
    if (!c || !a || this.#projectSeen(c.project_id, a.viewer)) return refuse("NO_SUCH_CLAIM", "no claim by that number is held that you can see", { claim: claim ?? null });
    /* a find step the assistant proposed and a member accepted is named by `step` */
    const find = c.find_step ?? (filled(step) ? step : null);
    if (!find) return refuse("CLAIM_NO_FIND_STEP", "the claim has no find step yet");
    const at = this.#at();
    return this.#record.transact(() => {
      const t = this.#steps.stepProduct({ step: find, record, by });
      if (!t || t.ok !== true) return t;
      this.#sql.exec(`UPDATE inv_claims SET find_step = ?, found_record = ?, found_by = ?, found_at = ? WHERE claim_id = ?`,
        find, t.product.id, a.member, at, c.claim_id);
      return { ok: true, claim: Number(c.claim_id), stated_as: "found", record: t.product.id, at };
    });
  }

  /* R15: a claim's look: the find step's looks (observation-log), "looked for and not found" naming where. */
  #look(c, viewer) {
    if (!c.find_step) return { state: "not_yet_looked_for" };
    let p = null;
    try { p = this.#steps.productsOf({ step: c.find_step, viewer }); } catch { p = null; }
    const absent = (p && p.ok && Array.isArray(p.looks) ? p.looks : []).filter((l) => l.state === "LOOKED_ABSENT" || l.state === "LOOKED_INDETERMINATE");
    if (!absent.length) return { state: "not_yet_looked_for" };
    return { state: "looked_for_and_not_found", where: absent.map((l) => ({ level: l.level, subject_kind: l.subject_kind, subject: l.subject, state: l.state, at: l.at })) };
  }

  /** R15: `claimsOf({project, viewer})`: each claim as recalled until found, with its look; never shown as what the body
   *  said while it is as recalled. */
  claimsOf({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const claims = this.#rows(`SELECT * FROM inv_claims WHERE project_id = ? ORDER BY claim_id`, project).map((c) => {
      const handle = this.#handle(c.author);
      const found = !!c.found_record && this.#recordSeen(c.found_record, viewer);
      return { claim: Number(c.claim_id), source: parse(c.source_json), text: c.text, about: c.about ?? null, author: handle,
               stated_as: found ? "found" : "as_recalled",
               label: found ? word("investigation.label.found_record", { found_record: String(c.found_record) }) : word("investigation.label.recalls_body_said", { handle: String(handle ?? "a member") }),
               ...(found ? { found: { record: c.found_record, by: this.#handle(c.found_by), at: c.found_at } } : { look: this.#look(c, viewer) }),
               find_step: c.find_step ?? null, ...(c.find_proposal ? { find_proposal: Number(c.find_proposal) } : {}),
               ...(c.warning_json ? { warning: parse(c.warning_json) } : {}), at: c.at };
    });
    return { ok: true, project, claims };
  }
  #recordSeen(id, viewer) { try { return this.#record.bundleInfo(id) ? this.#membership.inSight(id, viewer) === true : true; } catch { return false; } }

  /* ---- a firsthand account (R16) ---- */

  /** R16: `firsthandAccount({words, observedAt, title?, by})`: a member who was present records it through the built
   *  `testify` path (`provenance` R28), testimony graded and labelled as hers; this module grades nothing and keeps
   *  nothing of it. */
  firsthandAccount({ words = null, observedAt = null, title = null, by = null } = {}) {
    const a = this.#actor(by);
    if (!a || a.machine) return refuse("INVESTIGATION_MEMBER_ONLY", "a firsthand account is a person's own word");
    const r = this.#provenance.testify({ words, observedAt, title, author: by });
    if (!r || r.ok !== true) return r;
    const handle = this.#handle(a.member);
    return { ...r, label: word("investigation.label.firsthand_account_testimony", { handle: String(handle ?? "a member") }) };
  }

  /* ---- planning proposals (R20) ---- */

  #principal(by, run) {
    let held = null;
    try { held = this.#runHolder && filled(run) ? this.#runHolder.fn(by, run) : null; } catch { held = null; }
    return isObj(held) && filled(held.principal) ? held.principal : null;
  }

  /** R20, R21: `planPropose({project, kind, text, question?, run, by})`, from mode `enquire`: a proposed question or step
   *  drawn from a member's words, stored apart and labelled the system's; never a question or step until accepted. */
  planPropose({ project = null, kind = null, text = null, question = null, run = null, by = null } = {}) {
    if (!isMachineIdentity(by)) return refuse("PLAN_NOT_A_MACHINE", "a proposal is the assistant's; a member writes her own");
    const viewer = this.#principal(by, run);
    if (!viewer) return refuse("PLAN_NOT_YOUR_RUN", "the assistant proposes only for a run it holds", { run: run ?? null });
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    if (!PLAN_KINDS.includes(kind)) return refuse("PLAN_BAD_KIND", `a proposal is a ${PLAN_KINDS.join(" or a ")}`);
    if (!filled(text) || chars(text.trim()) > PLAN_MAX) return refuse("PLAN_NO_TEXT", `1–${PLAN_MAX} characters`);
    if (filled(question)) {
      const qs = this.#questionsSeen(project, viewer);
      if (!qs || !qs.some((q) => q.inquiry === question)) return refuse("NO_SUCH_QUESTION", "no question this project draws on by that id", { question });
    }
    const at = this.#at();
    const state = lawProposalState(by);
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_plan_proposals (project_id, kind, text, question_id, run, by_actor, label_state, status, at) VALUES (?,?,?,?,?,?,?,?,?)`,
        project, kind, text.trim(), filled(question) ? question : null, run, by, state, "proposed", at);
      const id = Number(this.#one(`SELECT MAX(proposal_id) AS id FROM inv_plan_proposals`).id);
      return { ok: true, proposal: id, label: { by, state, machine_work: state === "machine_proposed" }, at };
    });
  }

  #planView(p) {
    return { proposal: Number(p.proposal_id), project: p.project_id, kind: p.kind, text: p.text, question: p.question_id ?? null,
             label: { by: p.by_actor, state: p.label_state, machine_work: p.label_state === "machine_proposed" }, status: p.status, at: p.at,
             ...(p.status !== "proposed" ? { form: p.form, made: p.made, reason: p.reason, acceptance: parse(p.acceptance_json),
                                              decided_by: this.#handle(p.decided_by), decided_at: p.decided_at } : {}) };
  }

  /** R20: `planProposals({project, viewer})`: the project's proposals, a set-aside one with her reason. */
  planProposals({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    return { ok: true, project, proposals: this.#rows(`SELECT * FROM inv_plan_proposals WHERE project_id = ? ORDER BY proposal_id`, project).map((p) => this.#planView(p)) };
  }

  /** R20: `planAccept({proposal, form, text?, reason?, by})`: the member's one accepting act (record-grammar R52): a
   *  question by her own promotion, a step by `steps` R1 in her name; `own_instead` sets the proposal aside for her own
   *  words. Nothing becomes a question or step without it. R23: a proposal absent or unseen is refused with this
   *  module's own `NO_SUCH_PLANNING_PROPOSAL` (C-146.21), never intent's `NO_SUCH_PROPOSAL`. */
  planAccept({ proposal = null, form = null, text = null, reason = null, by = null } = {}) {
    const p = Number.isSafeInteger(Number(proposal)) && proposal !== null && proposal !== ""
      ? this.#one(`SELECT * FROM inv_plan_proposals WHERE proposal_id = ?`, Number(proposal)) : null;
    const a = this.#actor(by);
    if (a && a.machine) return refuse("INVESTIGATION_MEMBER_ONLY", "accepting a proposal is a member's act");
    if (!p || !a || this.#projectSeen(p.project_id, a.viewer)) return refuse("NO_SUCH_PLANNING_PROPOSAL", "no planning proposal by that number is held that you can see", { proposal: proposal ?? null });
    const g = this.#memberGate(p.project_id, by, "planAccept");
    if (g.refusal) return g.refusal;
    if (p.status !== "proposed") return refuse("PLAN_DECIDED", `this proposal was ${p.status === "accepted" ? "taken up" : "set aside"}`, { proposal: Number(p.proposal_id) });
    if (!ACCEPTANCE_FORMS.includes(form)) return refuse("PLAN_BAD_FORM", `the form is one of ${ACCEPTANCE_FORMS.join(", ")}`);
    const words = form === "as_proposed" ? p.text : text;
    if (!filled(words) || chars(words.trim()) > PLAN_MAX) return refuse("PLAN_NO_TEXT", `1–${PLAN_MAX} characters`);
    if (reason !== null && reason !== undefined && (!filled(reason) || chars(reason) > REASON_MAX)) return refuse("INVESTIGATION_NO_REASON", `1–${REASON_MAX} characters`);
    const at = this.#at();
    return this.#record.transact(() => {
      let made;
      if (p.kind === "step") {
        const r = this.#steps.stepCreate({ place: p.question_id ? { questions: [p.question_id] } : { project: p.project_id }, work: words.trim(), project: p.project_id, by });
        if (!r || r.ok !== true) return r;
        made = r.step;
      } else {
        const r = this.#openQuestion(words.trim(), p, by, a.viewer, at);
        if (!r || r.ok !== true) return r;
        made = r.bundleId;
      }
      const acceptance = acceptanceRecord({ proposal: `plan:${p.proposal_id}`, form, by, at, kind: `plan-${p.kind}` });
      this.#sql.exec(`UPDATE inv_plan_proposals SET status = ?, form = ?, acceptance_json = ?, made = ?, reason = ?, decided_by = ?, decided_at = ? WHERE proposal_id = ?`,
        form === "own_instead" ? "set_aside" : "accepted", form, json(acceptance), made, filled(reason) ? reason.trim() : null, a.member, at, p.proposal_id);
      return { ok: true, proposal: Number(p.proposal_id), form, kind: p.kind, made, acceptance, at };
    });
  }

  /* R20: a question opened by the member's own promotion, at `surfaced`, in her name. */
  #openQuestion(question, p, by, viewer, at) {
    const id = `${this.#record.allocId("INQ", at.slice(0, 4)).id}-question`;
    const text = ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: ${yamlString(question.slice(0, 120))}`,
      "current_state: surfaced", "prior_state: null", `created: "${at}"`, `last_updated: "${at}"`,
      "produced_by:", "  mode: human", "  capability_tier: session", "references: []", "state_history: []",
      "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
      "surfaced_by: human", 'disposition_reason: ""', "---", "", "## Question", "", question, "", word("conformance.rests"), "",
      word("investigation.taken_member_planning", { by_actor: String(p.by_actor), run: String(p.run) }), "", "## Conclusion", "",
      word("conformance.falsify"), "", "## Session Log", "", `### Session ${at} | Surfaced | ${by}`,
      word("investigation.changes_opened_member"), "", "## Review Notes", ""].join("\n");
    return this.#promotion.promote({ bundleId: id, base: null, snapKey: `${at.replace(/[-:]/g, "")}_plan${p.proposal_id}`, author: by,
      files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry", current_state: "surfaced", created: at, last_updated: at },
      actorIdentity: by, actorViewer: viewer, actorMemberId: this.#memberOf(by) });
  }

  /* ---- when the work goes quiet (R17, R18) ---- */

  /* R17: whether the project's work is quiet, judged as the plane (the same for every reader): `{quiet}` or
     `{quiet: false, undetermined: why}`. A project with no step has not gone quiet: its work has not begun. */
  #quiet(project) {
    const qs = this.#questionsOf(project);
    if (qs === null) return { quiet: false, undetermined: word("investigation.questions_project_draws") };
    const steps = this.#workSteps(project, PLANE_VIEWER, qs);
    if (steps === null) return { quiet: false, undetermined: word("investigation.steps_read") };
    if (!steps.length) return { quiet: false, why: word("investigation.why.step_taken") };
    /* R18 (K2524): something arrived from a watched source, and no step has been taken since: the work is reopened */
    const arrival = this.#one(`SELECT at FROM inv_watch_arrivals WHERE project_id = ? ORDER BY seq DESC LIMIT 1`, project);
    if (arrival && !steps.some((s) => s.at >= arrival.at)) return { quiet: false, why: word("investigation.why.something_arrived_watched"), reopened: true };
    if (steps.some((s) => !STEP_CLOSED.includes(s.state))) return { quiet: false, why: word("investigation.why.step_open") };
    for (const q of qs) {
      let w = null;
      try { w = this.#inquiry.questionWaits({ question: q.inquiry, viewer: PLANE_VIEWER }); } catch { w = null; }
      if (!w || !Array.isArray(w.waits)) return { quiet: false, undetermined: word("investigation.question_waits_read") };
      if (w.waits.some((x) => x.state !== "ended")) return { quiet: false, why: word("investigation.why.dated_wait_awaited") };
      for (const state of ["requested", "draining"]) {
        let r = null;
        try { r = this.#captureRequests.captureRequests({ target: q.inquiry, state, limit: 1, viewer: PLANE_VIEWER }); } catch { r = null; }
        const rows = r && (Array.isArray(r.requests) ? r.requests : Array.isArray(r.rows) ? r.rows : null);
        if (!rows) return { quiet: false, undetermined: word("investigation.capture_requests_read") };
        if (rows.length) return { quiet: false, why: word("investigation.why.capture_request_open") };
      }
    }
    return { quiet: true };
  }
  /* R18: the open spell of quiet for a project, opened or closed to match `quiet`; its id, or null. */
  #spell(project, quiet) {
    const open = this.#one(`SELECT * FROM inv_quiet_spells WHERE project_id = ? AND ended_at IS NULL ORDER BY spell_id DESC LIMIT 1`, project);
    try {
      if (quiet && !open) {
        this.#sql.exec(`INSERT INTO inv_quiet_spells (project_id, began_at) VALUES (?, ?)`, project, this.#at());
        return Number(this.#one(`SELECT MAX(spell_id) AS id FROM inv_quiet_spells WHERE project_id = ?`, project).id);
      }
      if (!quiet && open) { this.#sql.exec(`UPDATE inv_quiet_spells SET ended_at = ? WHERE spell_id = ?`, this.#at(), open.spell_id); return null; }
    } catch { /* a spell not recorded changes no answer */ }
    return open ? Number(open.spell_id) : null;
  }

  /** R17: `quietState({project, viewer})`: `quiet: true` when every step of the project and of its questions is ended
   *  or set aside and nothing is awaited; a display, never a stage. */
  quietState({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const q = this.#quiet(project);
    this.#spell(project, q.quiet);
    return { ok: true, project, quiet: q.quiet, display: q.quiet ? "quiet" : null, stage: null,
             ...(q.undetermined ? { undetermined: q.undetermined } : {}), ...(q.why ? { why: q.why } : {}) };
  }

  /** R18: `quietPrompts({viewer, at})`, for `notice-producers`: once per quiet spell, to each joined participant, the
   *  objective, its condition, progress and gaps, and the doors open to the members. Nothing more is asked in that
   *  spell once a member acted on it. No member act declares the objective met (H28). */
  quietPrompts({ viewer = null, at = null } = {}) {
    void at;
    const member = this.#memberOf(viewer);
    if (!member) return { ok: true, prompts: [] };
    const prompts = [];
    for (const project of this.#joinedProjects(member)) {
      try {
        if (!this.#membership.isJoinedParticipant(project, member) || this.#projectSeen(project, viewer)) continue;
        const q = this.#quiet(project);
        const spell = this.#spell(project, q.quiet);
        if (!q.quiet || spell === null) continue;
        if (this.#one(`SELECT 1 AS x FROM inv_quiet_acts WHERE project_id = ? AND spell_id = ? LIMIT 1`, project, spell)) continue;
        const progress = this.#intent.progress({ project, viewer });
        const gaps = this.#intent.gaps({ project, viewer });
        const satisfied = progress && progress.ok !== false && progress.satisfied === true;
        prompts.push({ project, spell, key: sha256HexSync(`investigation:quiet:${project}:${spell}`),
                       objective: progress && progress.ok !== false ? progress.objective : null,
                       condition: progress && progress.ok !== false ? progress.condition : null, progress,
                       gaps: gaps && gaps.ok !== false ? gaps.gaps : null,
                       doors: satisfied ? ["write_up_and_act"] : ["watch", "close_with_gaps", "revise_objective"] });
      } catch { /* a project that cannot be read is not prompted */ }
    }
    return { ok: true, prompts };
  }

  /* R18: a door's gate: a joined participant, on a project whose work is quiet; the spell, or a refusal. */
  #doorGate(project, by, act) {
    const g = this.#memberGate(project, by, act);
    if (g.refusal) return g;
    const q = this.#quiet(project);
    if (!q.quiet) return { refusal: refuse("QUIET_NOT_QUIET", q.undetermined ?? q.why ?? "the work has not gone quiet", { project }) };
    return { actor: g.actor };
  }

  /** R18: `projectWatch({project, by})`: keep watching the sources `intent` R7 names (`monitoring` reads
   *  `watchedProjects`) and reopen the work when something arrives. */
  projectWatch({ project = null, by = null } = {}) {
    const g = this.#doorGate(project, by, "projectWatch");
    if (g.refusal) return g.refusal;
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_quiet_acts (project_id, spell_id, act, by_actor, at) VALUES (?,?,?,?,?)`, project, this.#spell(project, true), "watch", by, at);
      return { ok: true, project, watching: true, at };
    });
  }

  /** R18: `watchedProjects()` (in-process, for `monitoring`): each project a member chose to watch, with every source
   *  `intent` R7 names for it, its `cursor` followed to the end (T42, N846). A project whose sources cannot be read
   *  whole answers `watch: null` with `watch_unread` naming why, never a partial set as whole. */
  watchedProjects() {
    const out = [];
    for (const r of this.#rows(`SELECT project_id, MAX(at) AS at FROM inv_quiet_acts WHERE act = 'watch' GROUP BY project_id ORDER BY project_id`)) {
      if (!this.#watched(r.project_id)) continue;
      const w = this.#watchSetWhole(r.project_id);
      out.push({ project: r.project_id, since: r.at, watch: w.watch, ...(w.unread ? { watch_unread: w.unread } : {}) });
    }
    return { ok: true, projects: out };
  }

  /* R18 (N846): intent R7's `watchSet` for `project`, every page: `{watch}` with its captures whole and `cursor` null, or
     `{watch: null, unread}`. Its entities and progressions are the same on every page; a page that repeats its cursor,
     an answer not of R7's shape, a measure intent says it cut (`measure_truncated`) or more than WATCH_CAPTURES_MAX
     captures cannot be read whole. */
  #watchSetWhole(project) {
    const intent = this.#intent;
    if (!intent || typeof intent.watchSet !== "function") return { watch: null, unread: "no intent module is present to name the sources" };
    let first = null, after = null;
    const captures = [];
    try {
      for (let page = 1; ; page++) {
        const r = intent.watchSet({ project, after });
        if (!isObj(r) || !Array.isArray(r.captures) || !Array.isArray(r.entities) || !Array.isArray(r.progressions))
          return { watch: null, unread: `intent's watch set, page ${page}, could not be read` };
        if (r.measure_truncated === true) return { watch: null, unread: "intent cut the condition's measure, so its entities are not whole" };
        first = first ?? r;
        captures.push(...r.captures);
        if (captures.length > WATCH_CAPTURES_MAX) return { watch: null, unread: `more than ${WATCH_CAPTURES_MAX} captures are watched` };
        if (r.truncated !== true && !filled(r.cursor)) break;
        if (!filled(r.cursor) || r.cursor === after) return { watch: null, unread: `intent's watch set, page ${page}, names no next page` };
        after = r.cursor;
      }
    } catch (e) { return { watch: null, unread: `intent's watch set could not be read: ${String((e && e.message) || e).slice(0, 160)}` }; }
    return { watch: { entities: first.entities, progressions: first.progressions, captures, truncated: false, cursor: null } };
  }

  /* R18: whether a member's latest door on the project is to watch it. */
  #watched(project) {
    const r = this.#one(`SELECT act FROM inv_quiet_acts WHERE project_id = ? ORDER BY seq DESC LIMIT 1`, project);
    return !!r && r.act === "watch";
  }

  /** R18 (K2524): `watchArrival({project, source, at})`, for `monitoring` only: a source a watched project keeps
   *  watching brought something new. The project's work reads reopened (no longer quiet, so a later quiet spell
   *  prompts again), and the arrival is answered with the project's reads. A project not watched is refused, writing
   *  nothing. (T42, N846) Once the arrival is written it never throws: each read is taken after the write, one that
   *  fails answered `{unread}` in its place; a refusal, or a failure before the write, records nothing. */
  watchArrival({ project = null, source = null, at = null } = {}) {
    const src = typeof source === "string" ? source.trim() : isObj(source) ? json(source) : "";
    if (!src || chars(src) > REASON_MAX || !filled(at) || !ISO.test(at)) return refuse("ARRIVAL_BAD", "an arrival is {project, source, at: an ISO instant}");
    const b = filled(project) ? this.#record.bundleInfo(project) : null;
    if (!b || b.type !== "project" || !this.#watched(project))
      return refuse("PROJECT_NOT_WATCHED", "no member chose to watch this project's sources", { project: filled(project) ? project : null });
    const when = this.#at();
    const done = this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO inv_watch_arrivals (project_id, source, arrived_at, at) VALUES (?,?,?,?)`, project, src, at, when);
      this.#spell(project, false);
      return { ok: true };
    });
    if (!done || done.ok !== true) return done;
    /* R18 (T42, N846): the arrival is written; from here nothing throws. Each read is taken after the write, and a read
       that fails is answered `{unread}` in its place: one that throws, or one that refuses the plane's own viewer, who
       sees every record of a project that exists (`milestonesOf` answers a failed read as absent). */
    const read = (fn) => {
      try {
        const x = fn();
        return isObj(x) && x.ok === false ? { unread: String(x.detail || x.reason || word("investigation.read_refused")).slice(0, 160) } : x;
      } catch (e) { return { unread: String((e && e.message) || e || word("case-disclosures.why.read_failed")).slice(0, 160) }; }
    };
    return { ok: true, project, arrival: { source: src, at }, reopened: true,
             reads: { quiet: read(() => this.quietState({ project, viewer: PLANE_VIEWER })),
                      standing: read(() => this.projectStanding({ project, viewer: PLANE_VIEWER })),
                      milestones: read(() => this.milestonesOf({ project, viewer: PLANE_VIEWER })) } };
  }

  /** R18: `projectCloseWithGaps({project, reason, note?, by})`: the project closes with `closed_reason` `reason`
   *  (`intent` R29), the gaps read at the act kept beside it as what remains unknown. The quiet path. */
  projectCloseWithGaps({ project = null, reason = null, note = null, by = null } = {}) {
    const g = this.#doorGate(project, by, "projectCloseWithGaps");
    if (g.refusal) return g.refusal;
    return this.#closeKept(project, reason, note, by, g.actor, () => this.#spell(project, true));
  }

  /** R24 (amends R18; C65): `projectClose({project, reason, note?, by})`: the owner's recorded close, whether or not the
   *  work has gone quiet. Refusals are R18's but never `QUIET_NOT_QUIET`, and `PROJECT_ACT_NOT_THE_OWNER` (membership
   *  R122) for a joined participant who does not own the project. */
  projectClose({ project = null, reason = null, note = null, by = null } = {}) {
    const g = this.#memberGate(project, by, "projectClose");
    if (g.refusal) return g.refusal;
    const notOwner = this.#membership.projectAuthority(project, g.actor.viewer, "owner", "projectClose");
    if (notOwner) return notOwner;
    /* a spell already open is the one the close belongs to; none is opened for it */
    return this.#closeKept(project, reason, note, by, g.actor, () => {
      const open = this.#one(`SELECT spell_id FROM inv_quiet_spells WHERE project_id = ? AND ended_at IS NULL ORDER BY spell_id DESC LIMIT 1`, project);
      return open ? Number(open.spell_id) : null;
    });
  }

  /* R18, R24: the close both doors make, past each one's gate: the reason and note checked, the gaps read at the act, the
     document revised through `promotion`, the act kept with the gaps beside it. */
  #closeKept(project, reason, note, by, actor, spellOf) {
    if (!CLOSED_REASONS.includes(reason)) return refuse("CLOSE_BAD_REASON", `the reason is one of ${CLOSED_REASONS.join(", ")}`);
    if (note !== null && note !== undefined && (!filled(note) || chars(note) > REASON_MAX)) return refuse("INVESTIGATION_NO_REASON", `1–${REASON_MAX} characters`);
    const gaps = this.#intent.gaps({ project, viewer: actor.viewer });
    const kept = gaps && gaps.ok !== false ? { gaps: gaps.gaps ?? [], ...(gaps.why ? { why: gaps.why } : {}) } : { gaps: null, why: word("investigation.why.gaps_read") };
    const at = this.#at();
    return this.#record.transact(() => {
      const w = this.#closeProject(project, reason, note, by, actor.viewer, at);
      if (!w || w.ok !== true) return w;
      this.#sql.exec(`INSERT INTO inv_quiet_acts (project_id, spell_id, act, closed_reason, note, gaps_json, by_actor, at) VALUES (?,?,?,?,?,?,?,?)`,
        project, spellOf(), "close", reason, filled(note) ? note.trim() : null, json(kept), by, at);
      return { ok: true, project, closed_reason: reason, gaps: kept.gaps, at };
    });
  }

  /* R18: the project's close as a revision of its document through `promotion`: `closed`, `closed_reason`, an entry. */
  #closeProject(project, reason, note, by, viewer, at) {
    const head = this.#record.head(project);
    const f = this.#record.readFile(project, "bundle.md");
    if (!head || !f || typeof f.text !== "string") return noSuchProject(project);
    const from = head.currentState;
    let text = f.text;
    const lines = text.split("\n");
    const end = lines.indexOf("---", 1);
    if (lines[0] !== "---" || end === -1) return noSuchProject(project);
    const set = (key, value) => {
      const ls = text.split("\n"); const e = ls.indexOf("---", 1);
      for (let i = 1; i < e; i++) if (ls[i].startsWith(`${key}:`)) { ls[i] = `${key}: ${value}`; text = ls.join("\n"); return; }
      ls.splice(e, 0, `${key}: ${value}`); text = ls.join("\n");
    };
    set("current_state", "closed");
    set("prior_state", from);
    set("closed_reason", reason);
    set("last_updated", `"${at}"`);
    const entry = [`  - timestamp: "${at}"`, `    from_state: ${from}`, "    to_state: closed",
                   `    blurb: ${yamlString(`closed with the gaps recorded as what remains unknown${filled(note) ? `: ${note}` : ""}`)}`, `    author: ${by}`];
    const ls = text.split("\n"); const e = ls.indexOf("---", 1);
    const at0 = ls.findIndex((l, i) => i > 0 && i < e && /^state_history:/.test(l));
    if (at0 === -1) ls.splice(e, 0, "state_history:", ...entry);
    else if (ls[at0].slice("state_history:".length).trim() === "[]") ls.splice(at0, 1, "state_history:", ...entry);
    else { let last = at0; for (let i = at0 + 1; i < e && /^\s/.test(ls[i]) && ls[i].trim() !== ""; i++) last = i; ls.splice(last + 1, 0, ...entry); }
    text = ls.join("\n");
    const carried = (typeof this.#record.livePaths === "function" ? this.#record.livePaths(project) : []).filter((p) => p !== "bundle.md").map((path) => {
      const x = this.#record.readFile(project, path);
      return typeof x.text === "string" ? { path, text: x.text, sha256: x.sha256 } : { path, blobSha: x.blobSha, sha256: x.sha256, bytes: x.bytes };
    });
    return this.#promotion.promote({ bundleId: project, base: head.bundleSha, snapKey: `${at.replace(/[-:]/g, "")}_close`, author: by,
      files: [{ path: "bundle.md", text }, ...carried],
      meta: { object_type: head.type, title: head.title, current_state: "closed", prior_state: from, last_updated: at },
      actorIdentity: by, actorViewer: viewer, actorMemberId: this.#memberOf(by) });
  }

  /* ---- the project page (R19) ---- */

  /** R19: `projectStanding({project, viewer})`: the objective and its condition, progress (or that it cannot be
   *  computed), each question the project draws on with its legs grouped as supporting or cutting against and this
   *  project's conclusion beside the bar, and the gaps. No score, and no member's share. */
  projectStanding({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const progress = this.#intent.progress({ project, viewer });
    if (progress && progress.ok === false) return progress;
    const gaps = this.#intent.gaps({ project, viewer });
    const qs = this.#questionsSeen(project, viewer);
    const bar = progress && isObj(progress.condition) && isObj(progress.condition.required) ? progress.condition.required.grade ?? null : null;
    const questions = (qs ?? []).map((q) => {
      let b = null;
      try { b = this.#legEarning.basisFor(q.inquiry); } catch { b = null; }
      const legs = (b && b.ok ? b.legs : []).filter((l) => this.#legSeen(l, viewer))
        .map((l) => ({ target: l.target_id, grade: l.grade ?? null, axis: l.grade_axis ?? null }));
      const roles = (b && b.ok ? b.legs : []).filter((l) => this.#legSeen(l, viewer)).map((l) => l.role);
      let stance = null;
      try { const r = this.#basisVersions.conclusionRecordOf(project, q.inquiry, viewer); stance = r && r.stance ? r.stance : null; } catch { stance = null; }
      return { question: q.inquiry,
               legs: { supporting: legs.filter((_, i) => roles[i] !== "cuts_against"), cutting_against: legs.filter((_, i) => roles[i] === "cuts_against") },
               conclusion: stance ? { state: stance.state, claim: stance.claim ?? null, at: stance.at ?? null } : null, bar };
    });
    return { ok: true, project, objective: progress ? progress.objective ?? null : null, condition: progress ? progress.condition ?? null : null,
             progress: progress && progress.computable === false ? { computable: false, why: progress.why ?? word("investigation.why.cannot_computed") } : progress,
             questions, ...(qs === null ? { questions_undetermined: word("investigation.questions_project_draws") } : {}),
             gaps: gaps && gaps.ok !== false ? gaps.gaps : null };
  }

  /* ---- parts to interpret (R26-R32; T53; N1272; K5445, K5453, K5495, K5496) ---- */

  /* This lane's refusals mint no check row, as `extraction`'s interpretation refusals mint none (its R47 catalogue is
     unmoved): `{ok: false, reason, code, status, detail}`, the detail a sentence a member can read (K3985). */
  static #no(code, status, detail, more = {}) { return { ...more, ok: false, reason: code, code, status, detail }; }

  /* R27, R30: the documents the project holds that the viewer may see and that carry a reading, each once, in the order the
     project came to hold them: the project's own register first, then each bundle placed in it (`provenance` R12, `record-core`
     R35). `[{capture, bundle, held_at, reading}]`, or null when a provider is absent. */
  #heldDocuments(project, viewer) {
    const prov = this.#provenance, x = this.#extraction;
    if (!prov || !x) return null;
    const bundles = [project];
    let after = "";
    for (let i = 0; i < 1000; i++) {
      const r = this.#record.listBundles({ project, after, limit: 1000 });
      bundles.push(...r.ids);
      if (!r.cursor || r.ids.length < 1000) break;
      after = r.cursor;
    }
    const out = [], seen = new Set();
    for (const b of bundles) {
      if (!this.#seenBundle(b, viewer)) continue;
      for (const c of prov.capturesOf(b)) {
        if (seen.has(c.capture_sha)) continue;
        const reading = x.readingOf(c.capture_sha);
        if (!reading) continue;
        seen.add(c.capture_sha);
        out.push({ capture: c.capture_sha, bundle: b, held_at: c.held_at, reading });
      }
    }
    return out;
  }

  /* R26, R27: a held document's candidate parts (`reading-pipeline.partsOf`, its R65), from its reading and its units'
     places and headings (`extraction.unitsOf`, page by page; no unit's text is kept but a heading's). */
  #partsOfDoc(doc) {
    if (doc.parts) return doc.parts;
    const units = [];
    let after = null;
    for (let i = 0; i < 10000; i++) {
      const u = this.#extraction.unitsOf(doc.capture, { after });
      for (const x of (u && Array.isArray(u.units) ? u.units : []))
        units.push({ extent: x.extent, kind: x.kind, ...(x.kind === "heading" && typeof x.text === "string" ? { text: x.text.slice(0, 200) } : {}) });
      if (!u || !Number.isInteger(u.next)) break;
      after = u.next;
    }
    const got = partsOf({ reading: isObj(doc.reading.reading) ? doc.reading.reading : {}, text_units: units });
    doc.parts = got && Array.isArray(got.parts) ? got.parts : [];
    return doc.parts;
  }

  /* R26: a sheet's used columns, as its reading states them, for the blocks a large part is taken in. */
  static #colsOf(doc, sheet) {
    const ext = doc && isObj(doc.reading) && isObj(doc.reading.reading) ? doc.reading.reading.container_extent : null;
    const s = ext && Array.isArray(ext.sheets) ? ext.sheets.find((x) => x && x.name === sheet) : null;
    return s ? (Number.isInteger(s.usedCols) ? s.usedCols : Number.isInteger(s.cols) ? s.cols : 1) : 1;
  }

  /** R26 (T53; N1272; K5445 B): `markForInterpretation({project, capture, parts, by})`, a member's deliberate act,
   *  "interpret these parts for this investigation": each named part of the held document is interpreted for the
   *  project through `extraction.interpretPart` with `how: marked`. At most MARK_PARTS_MAX parts a call (more is refused
   *  `TOO_MANY_PARTS` with the count and the bound); a sheet part larger than R115's cell bound is taken in blocks, each
   *  listed with `next`. `parts: "whole"` names every part of the document, the member's act in plain sight, bounded as
   *  `extraction` R119 bounds it. No part is interpreted that the member did not name (`NO_PARTS_NAMED`). Refused for a
   *  machine and for a project the member is not in. Never throws. */
  async markForInterpretation({ project = null, capture = null, parts = null, by = null } = {}) {
    try {
      const g = this.#memberGate(project, by, "markForInterpretation");
      if (g.refusal) return g.refusal;
      const viewer = g.actor.viewer, member = `member:${g.actor.member}`;
      const whole = parts === "whole" || (isObj(parts) && parts.whole === true);
      if (!whole && (!Array.isArray(parts) || parts.length === 0))
        return Investigation.#no("NO_PARTS_NAMED", 400, localize("investigation.parts.none_named", "a part is interpreted only when you name it, and none was named; nothing was interpreted"));
      if (!whole && parts.length > MARK_PARTS_MAX)
        return Investigation.#no("TOO_MANY_PARTS", 400, localize("investigation.parts.too_many", "one mark takes at most {bound} parts and this names {count}; name fewer; nothing was interpreted",
          { bound: String(MARK_PARTS_MAX), count: String(parts.length) }), { count: parts.length, bound: MARK_PARTS_MAX });
      const sha = typeof capture === "string" ? capture.trim().toLowerCase() : "";
      const doc = (this.#heldDocuments(project, viewer) ?? []).find((d) => d.capture === sha);
      if (!doc) return Investigation.#no("NO_SUCH_DOCUMENT", 404, localize("investigation.parts.no_document", "this investigation holds no document by that fingerprint that you can see; nothing was interpreted"));
      const named = whole ? this.#partsOfDoc(doc) : parts;
      const marked = [];
      let stopped = null;
      for (const part of named) {
        if (stopped) break;
        const blocks = blocksOf(part, isObj(part) ? Investigation.#colsOf(doc, part.sheet) : 1);
        const done = [];
        for (let i = 0; i < blocks.length; i++) {
          const r = await this.#extraction.interpretPart({ capture: sha, part: blocks[i], project, how: "marked", by: member, viewer });
          const next = i + 1 < blocks.length ? blocks[i + 1] : null;
          if (!r || r.ok !== true) {
            done.push({ part: blocks[i], refused: r ?? null, next });
            if (r && r.code === "INTERPRETATION_LIMIT") stopped = r;
            break;
          }
          done.push({ part: blocks[i], id: r.id, recorded: r.recorded, next });
        }
        marked.push({ part, ok: done.every((b) => !b.refused), blocks: done });
      }
      return { ok: true, project, capture: sha, how: "marked", whole, marked, ...(stopped ? { stopped } : {}) };
    } catch (e) {
      return Investigation.#no("INTERPRET_UNREAD", 500, localize("investigation.parts.failed", "the parts could not be interpreted just now ({why}); nothing more was interpreted",
        { why: String((e && e.message) || e).slice(0, 160) }));
    }
  }

  /** R27 (T53; N1272; K5445 C; K1471; DEC-77 (3b)): `proposeParts({project, captures?, viewer, refused?})`: candidate
   *  parts from the investigation's own words, by code: no AI, no score. The terms are its questions' titles (words, the
   *  names they name, their amounts and dates, quoted as written: `parts.mjs`' `termsOf`); for each held document (or each
   *  of `captures`) its parts are `reading-pipeline.partsOf`'s and each term is found by `retrieval`'s text search. Each
   *  proposal `{id, capture, part, why: [{term, kind, unit}], position, kind, labelled: "proposal", machine_work: true}`;
   *  ordered by document, then by place in it; never by importance. At most PROPOSALS_MAX (`truncated`, `shown`, `total`).
   *  A part already live for the project is omitted, and so is one a member said is not for it unless `refused` asks for
   *  those; each omission is counted. A kind whose measure is absent or not met (R29) offers none and is named in
   *  `unavailable`. Writes nothing. Never throws. */
  proposeParts({ project = null, captures = null, viewer = null, refused = false } = {}) {
    try {
      const r = this.#proposeParts({ project, captures, viewer, refused });
      if (!r.ok) return r;
      const { all, ...out } = r;
      return out;
    } catch (e) {
      return Investigation.#no("PROPOSALS_UNREAD", 500, localize("investigation.parts.proposals_unread", "the proposals could not be read just now ({why})",
        { why: String((e && e.message) || e).slice(0, 160) }));
    }
  }

  #proposeParts({ project, captures, viewer, refused }) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const held = this.#heldDocuments(project, viewer);
    if (held === null) return Investigation.#no("PROPOSALS_UNREAD", 500, localize("investigation.parts.no_provider", "the documents this investigation holds cannot be read here"));
    const want = Array.isArray(captures) && captures.length ? new Set(captures.map((c) => String(c).trim().toLowerCase())) : null;
    const docs = want ? held.filter((d) => want.has(d.capture)) : held;
    const texts = [];
    for (const q of this.#questionsSeen(project, viewer) ?? []) {
      const b = this.#record.bundleInfo(q.inquiry);
      if (b && filled(b.title)) texts.push(b.title);
    }
    const terms = termsOf(texts);
    /* R29: a kind offers proposals only once its measure is recorded and met */
    const unavailable = new Map();
    const offerable = [];
    for (const d of docs) {
      d.kind = fileKindOf(this.#partsOfDoc(d));
      const m = d.kind && Object.hasOwn(this.#measured, d.kind) ? this.#measured[d.kind] : null;
      if (isObj(m) && m.met === true) { offerable.push(d); continue; }
      const k = d.kind ?? "unknown";
      const u = unavailable.get(k) ?? { kind: k, why: isObj(m) ? "below_bar" : "not_measured", captures: [] };
      u.captures.push(d.capture);
      unavailable.set(k, u);
    }
    /* the terms, found by `retrieval`'s text search over the project's documents, each hit placed in its part */
    const byCapture = new Map(offerable.map((d) => [d.capture, d]));
    const hits = new Map();
    let searchCut = false;
    if (terms.length && offerable.length) {
      const search = this.#retrieval;
      if (!search || typeof search.findIn !== "function")
        return Investigation.#no("PROPOSALS_UNREAD", 500, localize("investigation.parts.no_search", "the text search these proposals are made with cannot be read here"));
      /* each document searched on its own, so one document's many hits never crowd out another's (a find answers at most
         its item cap, stated `truncated`) */
      for (const t of terms) for (const doc of offerable) {
        let cursor = null;
        for (let i = 0; i < 1000; i++) {
          const f = search.findIn({ scope: { capture: doc.capture }, kinds: ["term"], term: t.term, limit: 500, cursor, viewer });
          if (!f || f.ok !== true) break;
          const k = Array.isArray(f.kinds) ? f.kinds.find((x) => x.kind === "term") : null;
          if (k && k.truncated) searchCut = true;
          for (const it of (k && Array.isArray(k.items) ? k.items : [])) {
            const d = byCapture.get(it.capture_sha);
            if (!d) continue;
            const at = partIndexOf(d.parts, it.extent, it.sheet ?? null);
            if (at < 0) continue;
            const unit = typeof it.sheet === "string" && it.sheet && !isObj(it.extent) ? { sheet: it.sheet, range: it.extent } : it.extent;
            const key = `${d.capture}\u0000${at}`;
            const why = hits.get(key) ?? [];
            if (!why.some((w) => w.term === t.term && w.kind === t.kind && json(w.unit) === json(unit))) why.push({ term: t.term, kind: t.kind, unit });
            hits.set(key, why);
          }
          if (!filled(f.next)) break;
          cursor = f.next;
        }
      }
    }
    const refusedIds = new Set(this.#rows(`SELECT proposal_id FROM inv_part_refusals WHERE project_id = ?`, project).map((r) => r.proposal_id));
    let omittedLive = 0, omittedRefused = 0;
    const list = [];
    for (const d of offerable) {
      const of = this.#extraction.interpretationOf({ capture: d.capture, project, viewer });
      const live = of && of.ok === true ? of.for_this.map((x) => x.part) : [];
      d.parts.forEach((part, i) => {
        const why = hits.get(`${d.capture}\u0000${i}`);
        if (!why) return;
        if (live.some((p) => samePart(p, part))) { omittedLive += 1; return; }
        const id = proposalId(d.capture, part, why);
        const wasRefused = refusedIds.has(id);
        if (wasRefused && refused !== true) { omittedRefused += 1; return; }
        list.push({ id, capture: d.capture, part, why, position: i, kind: d.kind, labelled: "proposal", machine_work: true,
                    ...(wasRefused ? { refused: true } : {}) });
      });
    }
    const shown = list.slice(0, PROPOSALS_MAX);
    return { ok: true, project, proposals: shown, shown: shown.length, total: list.length,
             ...(list.length > PROPOSALS_MAX || searchCut ? { truncated: true } : {}),
             omitted: { already_interpreted: omittedLive, refused: omittedRefused },
             ...(unavailable.size ? { unavailable: [...unavailable.values()] } : {}),
             terms, all: list };
  }

  /** R28 (T53; N1272; K5445 C, K5453 (3); DEC-77 (3b, c)): `acceptProposals({project, proposals, by})`, the member's
   *  attributed act of acceptance. `proposals` lists `{id, part?}` (or an id) to accept and `{id, refused: true}` for one
   *  that is not for this investigation. Each accepted proposal standing for the project now (as `proposeParts` answers
   *  it, refused ones included) is interpreted through `extraction.interpretPart` with `how: accepted_proposal`, the
   *  proposals standing for its document beside it: unchanged it is recorded basis `accepted` naming it; with a part the
   *  member changed, as the member's own choice, basis `unaided` with `began_from` (`extraction` R117). One that does not
   *  stand refuses the whole act `PROPOSAL_NOT_STANDING`, nothing written. A refusal is remembered for the project with
   *  who and when, and judges no document. Each answer is counted for R29's measure. Refused for a machine. */
  async acceptProposals({ project = null, proposals = null, by = null } = {}) {
    try {
      const g = this.#memberGate(project, by, "acceptProposals");
      if (g.refusal) return g.refusal;
      const viewer = g.actor.viewer, member = `member:${g.actor.member}`;
      if (!Array.isArray(proposals) || proposals.length === 0)
        return Investigation.#no("NO_PARTS_NAMED", 400, localize("investigation.parts.none_accepted", "a proposal is interpreted only when you accept it, and none was named; nothing was interpreted"));
      if (proposals.length > PROPOSALS_MAX)
        return Investigation.#no("TOO_MANY_PARTS", 400, localize("investigation.parts.too_many_accepted", "one acceptance takes at most {bound} proposals and this names {count}; nothing was interpreted",
          { bound: String(PROPOSALS_MAX), count: String(proposals.length) }), { count: proposals.length, bound: PROPOSALS_MAX });
      const now = this.#proposeParts({ project, captures: null, viewer, refused: true });
      if (!now.ok) return now;
      const byId = new Map(now.all.map((p) => [p.id, p]));
      const asks = proposals.map((raw) => (typeof raw === "string" ? { id: raw } : isObj(raw) ? raw : {}));
      for (const a of asks) {
        if (!filled(a.id) || !byId.has(a.id.trim()))
          return Investigation.#no("PROPOSAL_NOT_STANDING", 409, localize("investigation.parts.not_standing", "that proposal is not standing for this investigation, so it was not accepted; nothing was interpreted"),
            { proposal: filled(a.id) ? a.id.trim() : null });
      }
      const at = this.#at();
      const answers = [];
      for (const a of asks) {
        const p = byId.get(a.id.trim());
        if (a.refused === true) {
          this.#record.transact(() => {
            /* a proposal already refused is answered as refused and counted once (R29) */
            if (this.#one(`SELECT 1 AS x FROM inv_part_refusals WHERE project_id = ? AND proposal_id = ?`, project, p.id)) return;
            this.#sql.exec(`INSERT INTO inv_part_refusals (project_id, proposal_id, capture_sha, part_json, by_actor, at) VALUES (?,?,?,?,?,?)`,
              project, p.id, p.capture, json(p.part), by, at);
            this.#sql.exec(`INSERT INTO inv_proposal_acts (project_id, proposal_id, kind, outcome, by_actor, at) VALUES (?,?,?,?,?,?)`,
              project, p.id, p.kind, "chose_otherwise", by, at);
          });
          answers.push({ ok: true, proposal: p.id, refused: true });
          continue;
        }
        const part = a.part === undefined || a.part === null ? p.part : a.part;
        const standing = now.all.filter((s) => s.capture === p.capture).map((s) => ({ id: s.id, capture: s.capture, part: s.part, why: s.why }));
        const r = await this.#extraction.interpretPart({ capture: p.capture, part, project, how: "accepted_proposal", by: member, viewer,
                                                         proposal: { id: p.id, matched: p.why }, standing });
        if (r && r.ok === true && r.recorded) {
          const outcome = r.interpretation && r.interpretation.basis === "accepted" ? "accepted" : "chosen_unaided";
          this.#sql.exec(`INSERT INTO inv_proposal_acts (project_id, proposal_id, kind, outcome, by_actor, at) VALUES (?,?,?,?,?,?)`,
            project, p.id, p.kind, outcome, by, at);
        }
        answers.push({ proposal: p.id, ...(r ?? { ok: false }) });
      }
      return { ok: true, project, answers };
    } catch (e) {
      return Investigation.#no("INTERPRET_UNREAD", 500, localize("investigation.parts.failed", "the parts could not be interpreted just now ({why}); nothing more was interpreted",
        { why: String((e && e.message) || e).slice(0, 160) }));
    }
  }

  /** R29 (T53; N1272; K5445 C; `contradiction` R39's form): `proposalRates({kind?, since?})` answers per file kind the
   *  counts of proposals `offered` (each a member answered), `accepted` (as offered), `chosen_unaided` (accepted with a
   *  part the member changed) and `chose_otherwise` (said not for this investigation); never a bare percentage.
   *  `review_due` when accepted / offered reaches PROPOSAL_REVIEW's rate over at least its offered (PROVISIONAL). No id;
   *  never throws. */
  proposalRates({ kind = null, since = null } = {}) {
    const per = {};
    try {
      for (const r of this.#rows(`SELECT kind, outcome, at FROM inv_proposal_acts ORDER BY seq`)) {
        if (filled(since) && !(r.at >= since)) continue;
        const s = (per[r.kind] ||= { kind: r.kind, offered: 0, accepted: 0, chosen_unaided: 0, chose_otherwise: 0 });
        s.offered += 1;
        if (["accepted", "chosen_unaided", "chose_otherwise"].includes(r.outcome)) s[r.outcome] += 1;
      }
    } catch { /* never throws: what was counted stands */ }
    const kinds = Object.values(per).filter((r) => !filled(kind) || r.kind === kind)
      .sort((a, b) => (a.kind < b.kind ? -1 : 1))
      .map((r) => ({ ...r, review_due: r.offered >= PROPOSAL_REVIEW.min_offered && r.accepted / r.offered >= PROPOSAL_REVIEW.rate }));
    return { ok: true, wrote: false, kinds, threshold: { ...PROPOSAL_REVIEW } };
  }

  /** R30 (T53; N1272; K4636): `interpretedFor({project, viewer})` lists, for each document the project holds, the parts
   *  interpreted for it, by whom, when and how (`extraction.interpretationOf`, sight as its R116), and states a document
   *  with none as `none_interpreted`; never "no data of value". A project the viewer may not see is answered as absent. */
  interpretedFor({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const docs = this.#heldDocuments(project, viewer);
    if (docs === null) return Investigation.#no("PROPOSALS_UNREAD", 500, localize("investigation.parts.no_provider", "the documents this investigation holds cannot be read here"));
    const documents = docs.map((d) => {
      const r = this.#extraction.interpretationOf({ capture: d.capture, project, viewer });
      const rows = r && r.ok === true ? r.for_this : [];
      const b = this.#record.bundleInfo(d.bundle);
      return { capture: d.capture, bundle: d.bundle, title: b ? b.title : null,
               interpreted: rows.map((x) => ({ id: x.id, part: x.part, by: this.#handle(x.by) ?? x.by, at: x.at, how: x.how, basis: x.basis })),
               none_interpreted: rows.length === 0,
               ...(r && r.ok === true ? { not_interpreted: r.not_interpreted, read: r.read } : { unread: r ? r.reason ?? null : null }) };
    });
    return { ok: true, project, documents };
  }

  /** R31 (T53; N1272; K4636, K5495 A): `interpretedElsewhere({capture, project, viewer})`: what a held document was
   *  interpreted for before, and by whom, for a viewer in `project`: `extraction.interpretationOf`'s `for_others`, each
   *  `{project, part, by, at, how}`; a project the viewer may not see is never named and its parts never described. */
  interpretedElsewhere({ capture = null, project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen) return seen;
    const r = this.#extraction.interpretationOf({ capture, project, viewer });
    if (!r || r.ok !== true) return r;
    return { ok: true, capture: r.capture, project,
             for_others: r.for_others.map((x) => ({ project: x.project, part: x.part, by: this.#handle(x.by) ?? x.by, at: x.at, how: x.how })) };
  }

  /* ---- registered with promotion (R12) ---- */

  /** R12 (promotion R39): no leg's target is an interview, refused inside `BASIS_REFUSED` as `INTERVIEW_NOT_A_LEG`
   *  (T42, N843: hypotheses' `NARRATIVE_NOT_A_LEG` names a shared note). */
  check(c) {
    if (!isObj(c) || !isObj(c.docFm) || !Array.isArray(c.docFm.basis)) return null;
    const findings = [];
    c.docFm.basis.forEach((leg, ord) => {
      const target = isObj(leg) && typeof leg.target === "string" ? leg.target.trim() : null;
      if (!target || !isStepId(target)) return;
      if (!this.#one(`SELECT 1 AS x FROM inv_interviews WHERE step_id = ? LIMIT 1`, target)) return;
      const row = INVESTIGATION_CHECKS.INTERVIEW_NOT_A_LEG;
      findings.push({ check: row.check, code: "INTERVIEW_NOT_A_LEG", severity: "error", translation: row.translation,
                      detail: localize("investigation.index.basis_ord_rests_on_target", "basis[{ord}] rests on {target}, an intake interview: a member's narrative is never evidence (D20)", { ord: String(ord), target: String(target) }), ord, target });
    });
    return findings.length ? { ok: false, reason: "BASIS_REFUSED", findings, detail: "a leg rests on an interview, which is narrative and never evidence. Nothing was written." } : null;
  }
}
