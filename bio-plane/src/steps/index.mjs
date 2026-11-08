// @ts-check
/* steps (layer 6; T41-17, N820; D27–D50, H38, H39, D64): the work done in pursuit of an answer, held apart from the
 * evidence. A step is never evidence and writes no leg (D33, R18).
 *
 *   stepCreate, step, stepsOn, stepsIn, stepsOfGroup (R1–R4)       creating a step, and who sees it
 *   stepStart, stepEnd, stepOutcome, stepDelete (R5, R6)          its state, its outcome per question, deletion
 *   stepsLike, stepRefer (R7, R8)                                 the duplicate search and the shared step
 *   stepProduct, recordProduct, productsOf, stepsOf, stepLearn    what it produced, and what was learned
 *   (R9, R10)
 *   stepWait, stepWaitRemove, stepByWhen, stepsDue, stepReminder  waits and dates
 *   (R11, R12)
 *   registerDueHolder, stepsWaitingOn (R29, R30)                  one date, one reminder: a date an action's clock
 *                                                                 holds, and the steps waiting on an arrival
 *   stepCostAdd, stepCostRemove, costShares, costMessage,         money cost, and the relay between the projects
 *   costMessages (R13–R15)                                        that share one
 *   questionFollow, following, findRecipients (R16, R17)          following a question
 *   laterFound (R23)                                              data a dead end looked for, found later
 *   stepPropose, stepAccept, stepProposals, acceptanceCounts      a proposed step, accepted by a member
 *   (R24, R26)
 *   check, resolveStepAuthority (R18)                             registered with `promotion` and `observation-log`
 *   registerRivalSource, stepsOfRival (R31)                       a step opened from a rival, and the steps a rival
 *                                                                 opened, with what they produced (BD-17)
 *
 * SHAPE (K61). `stepsOf(host, deps)` answers the one instance per host; making it creates and declares the tables
 * (R22), registers the leg check with `promotion` (its R39), the authority resolver and the later-found listener with
 * `observation-log` (its R13, R37), and the acceptance counts with `record-core` (its R63). `deps` may give `record`,
 * `membership`, `promotion`, `observationLog`, `legEarning` (whose `projectsDrawingOnPaged` and `projectsShownOn`,
 * its R13 and R14, R4, R14, R17 and R24 read), `view` (a function answering the active jurisdiction view, whose
 * `time_zone` gives the local day, R12) and `now` (a clock answering an ISO instant).
 *
 * A viewer, and every act's `by`, is the control plane's stamp; an absent one fails closed. A step any viewer may not
 * see is answered exactly as one that does not exist (R2). Every refusal is `{ok: false, reason, code, check,
 * translation, detail}` and writes nothing. */
import { isStepId, isMachineIdentity, ACCEPTANCE_FORMS, acceptanceRecord, lawProposalState, sha256HexSync, canonicalJson }
  from "../record-grammar/index.mjs";
import { recordOf, stampInstant, instantOrder, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, noSuchProject, listenerRefusal } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { observationLogOf } from "../observation-log/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { isRecordId, derivedId } from "../connection-grammar/index.mjs";
import { localDay, isCalendarDate } from "../civil-time/index.mjs";
import { dec, decStr, addD } from "../calc-grammar/decimal.mjs";
import { combine as combineProfiles, governingZone } from "../../../jurisdictions/index.mjs";
import { STEPS_SCHEMA, STEPS_TABLES, FOLLOWS_TABLE } from "./schema.mjs";
import { STEPS_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { STEPS_SCHEMA, STEPS_TABLES, FOLLOWS_TABLE, STEPS_CHECKS };

/** The module's name: its tables' declarer, its promotion step, the holder of authority kind `step`. */
export const OWNER = "steps";
export const STATES = Object.freeze(["planned", "underway", "ended", "set_aside"]);
/** R5: the states a step is closed in, and the outcomes a member records. */
export const CLOSED = Object.freeze(["ended", "set_aside"]);
export const OUTCOMES = Object.freeze(["helped", "dead_end", "undetermined"]);
/** R12: what sets a date. */
export const BASES = Object.freeze(["law", "meeting", "own"]);
export const NEARING_DAYS = 7;
/** R13: the kinds of a cost. */
export const COST_KINDS = Object.freeze(["fee", "purchase"]);
/** R9: what a step may produce. */
export const PRODUCT_KINDS = Object.freeze(["record", "capture", "content", "lead", "connection"]);
export const WORK_MAX = 500, LEARNED_MAX = 2000, MESSAGE_MAX = 2000, WHY_MAX = 2000, REASON_MAX = 2000, WHAT_MAX = 500, SOURCE_MAX = 500;
/** R4: the reads' page; R7: the duplicate search's bound, and how many rows it reads at most. */
export const READ_LIMIT = Object.freeze({ default: 200, max: 1000 });
export const LIKE_MAX = 50;
export const LIKE_SCAN = 5000;
/** R17: the recipients' page; and how many drawing projects one read pages through at most. */
export const RECIPIENTS_LIMIT = Object.freeze({ default: 500, max: 1000 });
const DRAW_PAGE = 500, DRAW_MAX = 10000;
/** R23: how many later-found entries one `laterFound` read takes at most, oldest first. */
export const LATER_FOUND_SCAN = 5000;
/** R12 (T46): the most dated steps, and the most reminders, one `stepsDue` reads; a read reaching past it says `truncated`. */
export const DUE_READ_MAX = 1000;
/** R30: the most steps one `stepsWaitingOn` answers. */
export const WAITING_ON_MAX = 200;
/** R26: the figures registered with record-core's counts, one per acceptance form. */
export const ACCEPTANCE_COUNT_KEYS = Object.freeze(["stepsAcceptedAsProposed", "stepsAcceptedEdited", "stepsAcceptedOwnInstead"]);

const HEX64 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;
const AMOUNT = /^\d+(?:\.\d+)?$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const json = (v) => JSON.stringify(v);
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const chars = (s) => [...s].length;
const limitOf = (v, { default: d, max }) => {
  const n = Number(v);
  return v === undefined || v === null || v === "" || !Number.isInteger(n) ? d : Math.min(max, Math.max(1, n));
};

/** Every refusal (Provides): its row's `check` and `translation`, a `detail`, and the caller's fields beside them. */
function refuse(code, detail, extra = {}) {
  const row = STEPS_CHECKS[code];
  return { ...extra, ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
}
/* R31 (CR2-18, BD-17): the one refusal of a rival on a step. It has no row of C-142 (`check: null`), so no census
   of the family moves; its sentence is written here, once. */
export const RIVAL_CODES = Object.freeze(["STEP_NOT_A_RIVAL"]);
function refuseRival(detail, extra = {}) {
  return { ...extra, ok: false, reason: "STEP_NOT_A_RIVAL", code: "STEP_NOT_A_RIVAL", check: null,
           translation: localize("steps.rivals.not_a_rival", "That is not one of this question's rival explanations, so no step was opened from it. Nothing was written."),
           detail };
}
/** One finding as `inquiry` R11 carries them inside `BASIS_REFUSED` (R18). */
function finding(code, detail, extra = {}) {
  const row = STEPS_CHECKS[code];
  return { check: row.check, code, severity: "error", translation: row.translation, detail, ...extra };
}

/** R7, R8: work folded for comparison: Unicode-normalised, lower-cased, every run of what is not a letter or a digit one
 *  space. Two steps' work is "the same" when these are equal. */
export function normaliseWork(work) {
  return String(work ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
/* R7: how far two folded works match: 1 when equal, else the share of distinct words they hold in common (Jaccard). */
function likeness(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / (A.size + B.size - common);
}
/** R7: the least likeness a step's work must have to be answered as matching. */
export const LIKE_THRESHOLD = 0.5;

/* Day arithmetic on calendar days, for R12's window. */
const dayNumber = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400000;

const instances = new WeakMap();
const storageOf = (host) => (host && host.storage ? host.storage : host);

/** K61: the one instance per host, made on the first call (`deps` read then only). */
export function stepsOf(host, deps = {}) {
  const storage = storageOf(host);
  let s = instances.get(storage);
  if (!s) {
    const record = deps.record ?? recordOf(host);
    const membership = deps.membership ?? membershipOf(host, { record });
    const promotion = deps.promotion ?? promotionOf(host, { record, membership });
    const observationLog = deps.observationLog ?? observationLogOf(host, { record, membership });
    s = new Steps(storage, { ...deps, record, membership, observationLog, host });
    instances.set(storage, s);
    s.migrate();
    const fail = (what, r) => { if (r && r.ok === false) throw new Error(`steps: ${what} refused: ${r.reason || r.code}`); };
    fail("registerStep", promotion.registerStep(OWNER, { check: (c) => s.check(c) }));
    fail("registerAuthority", observationLog.registerAuthority("step", (authority, viewer) => s.resolveStepAuthority(authority, viewer)));
    fail("onLookAnswered", observationLog.onLookAnswered(OWNER, (e) => s.lookAnswered(e)));
    fail("registerCounts", record.registerCounts(OWNER, [...ACCEPTANCE_COUNT_KEYS], () => {
      const c = s.acceptanceCounts();
      return { stepsAcceptedAsProposed: c.as_proposed, stepsAcceptedEdited: c.edited, stepsAcceptedOwnInstead: c.own_instead };
    }));
  }
  return s;
}

export class Steps {
  #sql; #record; #membership; #log; #legEarning; #host; #viewFn; #now;
  #runHolder = null;                 // R1: {module, fn(by, run) → {enabled_by, principal} | null}
  #dueHolder = null;                 // R29: {module, fn({step, byWhen, waits}) → {entry} | null}
  #arrivals = new Map();             // R11: kind → {module, read(id)}
  #productSight = new Map();         // R9: id prefix → {module, fn(id, viewer)}
  #rivalSource = null;               // R31: {module, fn({question, rival, viewer}) → true when a rival of the question}
  #declared = false;

  constructor(storage, { record, membership, observationLog, legEarning = null, host = null, view = null, now = null }) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#log = observationLog;
    this.#legEarning = legEarning;
    this.#host = host;
    this.#viewFn = typeof view === "function" ? view : null;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #at() { return stampInstant("second", Date.parse(this.#now())); }

  /* ---- boot (R22) ---- */

  /** The tables, their triggers and their declaration (R22). Idempotent; a refused declaration is a defect of the
   *  wiring and throws. */
  migrate() {
    const bare = STEPS_SCHEMA.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
    /* a trigger's body holds semicolons, so each trigger is one statement */
    for (const part of bare.split(/(?=CREATE TRIGGER)/)) {
      if (part.startsWith("CREATE TRIGGER")) {
        const end = part.indexOf("END;");
        this.#sql.exec(part.slice(0, end + 3));
        for (const st of part.slice(end + 4).split(";")) if (st.trim()) this.#sql.exec(st.trim());
      } else for (const st of part.split(";")) if (st.trim()) this.#sql.exec(st.trim());
    }
    this.#lookedAtColumn();
    if (this.#declared) return { ok: true, already: true };
    /* R19: working material, never carried in any export to the public; the group's own administrators may export it. */
    const base = { purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false };
    const d = this.#record.declareTable(OWNER, [
      ...STEPS_TABLES.map((t) => ({ ...base, ...t, keys: [...t.keys] })),
      { ...base, name: FOLLOWS_TABLE, keys: ["question_id"], sight: "owner", export: "never" },
    ]);
    if (d && d.ok === false) throw new Error(`steps: declareTable refused: ${d.reason}`);
    this.#declared = true;
    return { ok: true };
  }

  /* R23 (T44): a store made before `looked_at` gains the column, and each entry without it is filled from its look's
     own row (observation-log R29's read contract: `seq`, `at`); the log is append-only, so the look's instant is the
     one it was logged with. An entry whose look the log no longer holds stays null, answered as not known. */
  #lookedAtColumn() {
    const cols = this.#rows(`PRAGMA table_info(step_later_found)`).map((c) => c.name);
    if (cols.length && !cols.includes("looked_at")) this.#sql.exec(`ALTER TABLE step_later_found ADD COLUMN looked_at TEXT`);
    try {
      this.#sql.exec(`UPDATE step_later_found SET looked_at = (SELECT o.at FROM observation_log o WHERE o.seq = step_later_found.look_seq)
                      WHERE looked_at IS NULL`);
    } catch { /* no log table yet: filled at the next start */ }
  }

  /* ---- registrations (R1, R9, R11) ---- */

  /** R1: `ai-runs` registers, once, the read of whether a machine credential holds a run: `fn(by, run)` answers
   *  `{enabled_by, principal}` (the run's enabling label and the member viewer it acts for) or null. */
  registerRunHolder(module, fn) {
    const refused = listenerRefusal(this.#runHolder ? { module: this.#runHolder.module } : null, module, fn);
    if (refused) return refused;
    this.#runHolder = { module, fn };
    return { ok: true, module };
  }
  /** R29: one later module (`action-clocks`, its R16) registers, once, whether it holds a step's date as an action's
   *  clock entry: `fn({step, byWhen, waits})` answers null or `{entry}`. One date, one reminder. */
  registerDueHolder(module, fn) {
    const refused = listenerRefusal(this.#dueHolder ? { module: this.#dueHolder.module } : null, module, fn);
    if (refused) return refused;
    this.#dueHolder = { module, fn };
    return { ok: true, module };
  }
  /** R11: a later module registers the read of one kind of arrival: `read(id)` answers true (arrived), false, or
   *  anything else (undetermined). One per kind. */
  registerArrivalSource(kind, read, module = String(kind)) {
    const held = this.#arrivals.get(kind);
    const refused = listenerRefusal(held ? { module: held.module } : null, filled(kind) ? module : "", read, { kind: kind ?? null });
    if (refused) return refused;
    this.#arrivals.set(kind, { module, read });
    return { ok: true, kind };
  }
  /** R9: the owner of a record id held in its own table (not a bundle: `HYP-`, `CALC-`, …) registers, per prefix,
   *  whether a viewer sees one: `fn(id, viewer)` true or anything else (not seen). */
  registerProductSight(prefix, module, fn) {
    const held = this.#productSight.get(prefix);
    const refused = listenerRefusal(held ? { module: held.module } : null, filled(prefix) ? module : "", fn, { prefix: prefix ?? null });
    if (refused) return refused;
    this.#productSight.set(prefix, { module, fn });
    return { ok: true, prefix };
  }

  /** R31 (CR2-18, BD-17): `hypotheses` registers, once, whether an id is one of a question's rival explanations for a
   *  viewer: `fn({question, rival, viewer})` answers true, or anything else (not a rival). */
  registerRivalSource(module, fn) {
    const refused = listenerRefusal(this.#rivalSource ? { module: this.#rivalSource.module } : null, module, fn);
    if (refused) return refused;
    this.#rivalSource = { module, fn };
    return { ok: true, module };
  }
  /* R31: whether `rival` is one of `question`'s rivals for `viewer`, by the registered source; false when none is
     registered, or it throws or answers anything but true. */
  #isRival(question, rival, viewer) {
    if (!this.#rivalSource) return false;
    try { return this.#rivalSource.fn({ question, rival, viewer }) === true; } catch { return false; }
  }
  /* R31: the rival a step was opened from, `{question, rival}`, shown only while the viewer sees that question. */
  #rivalOf(stepId, viewer) {
    const r = this.#one(`SELECT question_id, rival_id FROM step_rivals WHERE step_id = ?`, stepId);
    return r && this.#membership.inSight(r.question_id, viewer) ? { question: r.question_id, rival: r.rival_id } : null;
  }

  /* ---- who is asking ---- */

  /* The act's stamp read: a machine credential, a member (with her viewer stamp), or null (absent, fails closed). */
  #actor(by) {
    if (!filled(by)) return null;
    /* a machine credential reads as its class (an assistant's `class:ai/<token>` as `class:ai`), which sees every record */
    if (isMachineIdentity(by)) return { machine: true, by, member: null, viewer: by.replace(/\/.*$/, "") };
    let m = null;
    try { m = this.#membership.positionalMember(by); } catch { m = null; }
    return filled(m) ? { machine: false, by, member: m, viewer: `member:${m}` } : null;
  }
  /* A viewer's member id, or null for a machine, an absent or an unrecognised viewer. */
  #memberOf(viewer) {
    if (!filled(viewer) || isMachineIdentity(viewer)) return null;
    try { const m = this.#membership.positionalMember(viewer); return filled(m) ? m : null; } catch { return null; }
  }
  /* An active member, or an administrator (the founder included). */
  #activeMember(member) {
    if (!filled(member)) return false;
    try {
      const f = this.#membership.memberFacts(member);
      return (f && f.status === "active") || this.#membership.isAdministrator(member);
    } catch { return false; }
  }
  #handle(member) {
    try { const f = this.#membership.memberFacts(member); return f && filled(f.handle) ? f.handle : null; } catch { return null; }
  }
  /* A stamp as the reads show it: a member by her handle, a machine as itself. */
  #shown(stamp) {
    const m = this.#memberOf(stamp);
    return m ? this.#handle(m) : stamp;
  }

  /* ---- sight (R2, R3) ---- */

  #isQuestion(id) {
    const b = filled(id) ? this.#record.bundleInfo(id) : null;
    return !!b && b.type === "inquiry";
  }
  #questionSeen(id, viewer) { return this.#isQuestion(id) && this.#membership.inSight(id, viewer); }
  #refs(stepId) { return this.#rows(`SELECT question_id FROM step_refs WHERE step_id = ? ORDER BY question_id`, stepId).map((r) => r.question_id); }

  /** R2: whether `viewer` sees the step `row`. */
  #seen(row, viewer) {
    if (!row || !filled(viewer)) return false;
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return false;
    if (gate.scope === "member") return true;                       /* a machine credential sees every record */
    if (row.place_kind === "project") return this.#membership.inSight(row.project_id, viewer);
    if (row.place_kind === "group") return this.#activeMember(gate.member) || viewer === "admin";
    return this.#refs(row.step_id).some((q) => this.#membership.inSight(q, viewer));
  }
  #held(stepId) { return isStepId(stepId) ? this.#one(`SELECT * FROM steps WHERE step_id = ?`, stepId) : null; }
  static #noStep(id) { return refuse("NO_SUCH_STEP", "no step by that id is held, or it is not one you may see", { step: filled(id) ? id : null }); }

  /* R1: a project named by an act (its place, or the project it is taken in): C-70.1 at EXISTENCE, absent at NONE or
     for anything that is not a project, then the act's need of a joined participant; null to proceed. */
  #projectRefusal(project, by, act) {
    const b = filled(project) ? this.#record.bundleInfo(project) : null;
    const ex = b && b.type === "project" ? this.#membership.existenceAct(project, by) : null;
    if (ex) return ex;
    if (!b || b.type !== "project" || !this.#membership.inSight(project, by)) return noSuchProject(filled(project) ? project : null);
    return this.#membership.projectAuthority(project, by, "joined", act);
  }

  /* R3: the project a step was taken in, when it is not hidden and the viewer may see its name; else null, the same
     for a hidden project and for none. */
  #takenIn(row, viewer) {
    const p = row.taken_in;
    if (!filled(p)) return null;
    try {
      if (this.#membership.visibilityOf(p) !== "discoverable") return null;
      if (this.#membership.sight(p, viewer) === "none") return null;
      const b = this.#record.bundleInfo(p);
      return b ? { id: p, name: b.title ?? null } : null;
    } catch { return null; }
  }

  /* ---- the local day (R12) ---- */

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
    if (!zone) return null;
    try { const d = localDay(String(instant).replace(/\.\d+Z$/, "Z"), zone); return typeof d === "string" ? d : null; } catch { return null; }
  }

  /* ---- the duplicate search's projects (leg-earning R13, R14) ---- */

  #le() {
    if (!this.#legEarning && this.#host) {
      try { this.#legEarning = legEarningOf(this.#host); } catch { this.#legEarning = null; }
    }
    return this.#legEarning;
  }
  /* Every project drawing on a question (leg-earning R13, over every project), or null when the read is incomplete,
     absent or fails. */
  #drawing(question) {
    const le = this.#le();
    if (!le || typeof le.projectsDrawingOnPaged !== "function") return null;
    const out = [];
    let after = null;
    try {
      for (;;) {
        const r = le.projectsDrawingOnPaged({ id: question, after, limit: DRAW_PAGE });
        if (!isObj(r) || !Array.isArray(r.projects)) return null;
        for (const p of r.projects) out.push(isObj(p) ? p.id : p);
        if (!filled(r.cursor) || r.projects.length === 0) break;
        if (out.length > DRAW_MAX) return null;
        after = r.cursor;
      }
    } catch { return null; }
    return [...new Set(out.filter(filled))].sort();
  }

  /* ---- waits (R11) ---- */

  #waitRows(stepId) {
    return this.#rows(`SELECT * FROM step_waits WHERE step_id = ? AND removed_at IS NULL ORDER BY wait_id`, stepId);
  }
  /* One wait, read: `{wait, on, met, ...}`; `met` is true, false or "undetermined" (never met). */
  #waitView(w, viewer, today) {
    if (w.on_kind === "step") {
      const t = this.#held(w.on_step);
      const shown = t && this.#seen(t, viewer);
      const closed = !!t && CLOSED.includes(t.state);
      return { wait: Number(w.wait_id), on: { step: shown ? w.on_step : null }, met: closed, ...(closed ? { which: t.state } : {}) };
    }
    if (w.on_kind === "date") {
      if (!today) return { wait: Number(w.wait_id), on: { date: w.on_date }, met: "undetermined",
                           why: word("steps.why.time_zone_held") };
      return { wait: Number(w.wait_id), on: { date: w.on_date }, met: w.on_date <= today };
    }
    const src = this.#arrivals.get(w.arrival_kind);
    let r;
    try { r = src ? src.read(w.arrival_id) : undefined; } catch { r = undefined; }
    const on = { arrival: { kind: w.arrival_kind, id: w.arrival_id } };
    if (r === true) return { wait: Number(w.wait_id), on, met: true };
    if (r === false) return { wait: Number(w.wait_id), on, met: false };
    return { wait: Number(w.wait_id), on, met: "undetermined",
             why: src ? word("steps.why.source_say_whether") : word("steps.why.nothing_read_arrival") };
  }
  #unmet(stepId, viewer, today) {
    return this.#waitRows(stepId).map((w) => this.#waitView(w, viewer, today)).filter((w) => w.met !== true);
  }

  /* ---- the read (R4) ---- */

  /* The state a step reads: `waiting` while it is not closed and a wait is unmet. */
  #readState(row, waits) { return !CLOSED.includes(row.state) && waits.some((w) => w.met !== true) ? "waiting" : row.state; }

  #outcomes(row, viewer) {
    const keys = row.place_kind === "questions" ? this.#refs(row.step_id).filter((q) => this.#membership.inSight(q, viewer)) : [""];
    return keys.map((q) => {
      const hist = this.#rows(`SELECT outcome, by_actor, at FROM step_outcomes WHERE step_id = ? AND question_id = ? ORDER BY seq`, row.step_id, q)
        .map((h) => ({ outcome: h.outcome, by: this.#shown(h.by_actor), at: h.at }));
      return { ...(q ? { question: q } : {}), outcome: hist.length ? hist[hist.length - 1].outcome : "undetermined", history: hist };
    });
  }
  #learned(stepId) {
    const rows = this.#rows(`SELECT writer, text, at FROM step_learned WHERE step_id = ? ORDER BY seq`, stepId);
    const by = new Map();
    for (const r of rows) { if (!by.has(r.writer)) by.set(r.writer, []); by.get(r.writer).push({ text: r.text, at: r.at }); }
    return [...by.entries()].map(([w, h]) => ({ by: this.#handle(w), text: h[h.length - 1].text, at: h[h.length - 1].at, history: h }));
  }
  #cost(stepId) {
    const rows = this.#rows(`SELECT * FROM step_costs WHERE step_id = ? ORDER BY cost_id`, stepId);
    const item = (c) => ({ cost: Number(c.cost_id), kind: c.kind, amount: c.amount, currency: c.currency, what: c.what,
                           by: this.#shown(c.by_actor), at: c.at,
                           ...(c.removed_at ? { removed: { by: this.#shown(c.removed_by), at: c.removed_at } } : {}) });
    return { totals: Steps.#totals(rows.filter((c) => !c.removed_at)), items: rows.filter((c) => !c.removed_at).map(item),
             removed: rows.filter((c) => c.removed_at).map(item) };
  }
  static #totals(rows) {
    const t = {};
    for (const c of rows) { const d = dec(c.amount); if (d) t[c.currency] = t[c.currency] ? addD(t[c.currency], d) : d; }
    return Object.fromEntries(Object.keys(t).sort().map((k) => [k, decStr(t[k])]));
  }
  #laterFoundOf(stepId, viewer) {
    return this.#rows(`SELECT look_seq, observation_seq, at, looked_at FROM step_later_found WHERE step_id = ? ORDER BY seq`, stepId)
      .filter((r) => this.#observationSeen(r.observation_seq, viewer))
      .map((r) => ({ look: Number(r.look_seq), observation: Number(r.observation_seq), at: r.at, looked_at: r.looked_at ?? null }));
  }
  #observationSeen(seq, viewer) {
    try {
      const row = this.#one(`SELECT * FROM observation_log WHERE seq = ?`, Number(seq));
      return !!row && this.#log.rowVisible(row, viewer);
    } catch { return false; }
  }
  #byWhenView(row, today) {
    const b = parse(row.by_when_json);
    if (!isObj(b)) return null;
    const nearing = today ? (dayNumber(b.date) - dayNumber(today) >= 0 && dayNumber(b.date) - dayNumber(today) <= NEARING_DAYS) : null;
    return { ...b, nearing, ...(today ? {} : { why: word("steps.why.time_zone_held") }) };
  }

  /* R29: whether the registered holder holds the step's date as an action's clock entry: `{module, entry}`, or null
     when the step has no date, nothing is registered, or the holder throws or answers anything but `{entry}` (so the
     step's own item stays). The holder is told the step, its date as set and its live waits, as R11 records them. */
  #heldBy(row) {
    const b = parse(row.by_when_json);
    if (!this.#dueHolder || !isObj(b)) return null;
    const waits = this.#waitRows(row.step_id).map((w) => ({
      wait: Number(w.wait_id),
      on: w.on_kind === "step" ? { step: w.on_step } : w.on_kind === "date" ? { date: w.on_date }
        : { arrival: { kind: w.arrival_kind, id: w.arrival_id } },
    }));
    let r;
    try { r = this.#dueHolder.fn({ step: row.step_id, byWhen: b, waits }); } catch { return null; }
    const entry = isObj(r) ? r.entry : undefined;
    return filled(entry) || isObj(entry) ? { module: this.#dueHolder.module, entry } : null;
  }

  /** R4: one step as every read answers it, for a viewer who sees it. */
  #view(row, viewer, today = this.#today(this.#now())) {
    const waits = this.#waitRows(row.step_id).map((w) => this.#waitView(w, viewer, today));
    const place = row.place_kind === "project" ? { project: row.project_id }
      : row.place_kind === "group" ? { group: true }
      : { questions: this.#refs(row.step_id).filter((q) => this.#membership.inSight(q, viewer)) };
    return {
      step: row.step_id, place, work: row.work,
      doer: row.doer_member ? this.#handle(row.doer_member) : "system",
      ...(row.doer_member ? {} : { enabled_by: row.enabled_by }),
      taken_in: this.#takenIn(row, viewer), state: this.#readState(row, waits), outcomes: this.#outcomes(row, viewer),
      byWhen: this.#byWhenView(row, today), by_when_held: this.#heldBy(row), waits, learned: this.#learned(row.step_id), cost: this.#cost(row.step_id),
      later_found: this.#laterFoundOf(row.step_id, viewer), rival: this.#rivalOf(row.step_id, viewer), at: row.at,
    };
  }

  /** R4: `step({step, viewer})`. */
  step({ step = null, viewer = null } = {}) {
    try {
      const row = this.#held(step);
      return row && this.#seen(row, viewer) ? { ok: true, ...this.#view(row, viewer) } : Steps.#noStep(step);
    } catch { return Steps.#noStep(step); }
  }

  /* R4: a bounded page of steps from `rows` (already ordered by id) that the viewer sees, in `state` when given. */
  #page(rows, viewer, { state, after, limit }) {
    const lim = limitOf(limit, READ_LIMIT);
    const today = this.#today(this.#now());
    const out = [];
    let truncated = false;
    for (const r of rows) {
      if (filled(after) && r.step_id <= after) continue;
      if (!this.#seen(r, viewer)) continue;
      const v = this.#view(r, viewer, today);
      if (filled(state) && v.state !== state) continue;
      if (out.length === lim) { truncated = true; break; }
      out.push(v);
    }
    return { steps: out, limit: lim, truncated, next: truncated ? { after: out[out.length - 1].step } : null };
  }

  /** R4: `stepsOn({question, viewer, state?, after?, limit?})`: the work done on a question; its header answers the
   *  question's `projects`, leg-earning R14's answer for this viewer. */
  stepsOn({ question = null, viewer = null, state = null, after = null, limit = undefined } = {}) {
    try {
      if (!this.#questionSeen(question, viewer))
        return refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: filled(question) ? question : null });
      const rows = this.#rows(`SELECT s.* FROM steps s JOIN step_refs r ON r.step_id = s.step_id WHERE r.question_id = ? ORDER BY s.step_id`, question);
      return { ok: true, question, projects: this.#shownOn(question, viewer), ...this.#page(rows, viewer, { state, after, limit }) };
    } catch { return refuse("NO_SUCH_BUNDLE", "the question's steps could not be read", { question: filled(question) ? question : null }); }
  }
  #shownOn(question, viewer) {
    const le = this.#le();
    try {
      const r = le && typeof le.projectsShownOn === "function" ? le.projectsShownOn({ id: question, viewer }) : null;
      if (isObj(r) && Array.isArray(r.projects)) return { projects: r.projects, truncated: r.truncated === true };
    } catch { /* answered undetermined below */ }
    return { undetermined: true, why: word("steps.why.projects_drawing_question") };
  }

  /** R4: `stepsIn({project, viewer, ...})`: a project's own steps, to a viewer at FULL sight of it. */
  stepsIn({ project = null, viewer = null, state = null, after = null, limit = undefined } = {}) {
    try {
      const b = filled(project) ? this.#record.bundleInfo(project) : null;
      const ex = b && b.type === "project" ? this.#membership.existenceAct(project, viewer) : null;
      if (ex) return ex;
      if (!b || b.type !== "project" || !this.#membership.inSight(project, viewer)) return noSuchProject(filled(project) ? project : null);
      const rows = this.#rows(`SELECT * FROM steps WHERE place_kind = 'project' AND project_id = ? ORDER BY step_id`, project);
      return { ok: true, project, ...this.#page(rows, viewer, { state, after, limit }) };
    } catch { return noSuchProject(filled(project) ? project : null); }
  }

  /** R4: `stepsOfGroup({viewer, ...})`: the group's own steps, to an active member. */
  stepsOfGroup({ viewer = null, state = null, after = null, limit = undefined } = {}) {
    try {
      const rows = this.#rows(`SELECT * FROM steps WHERE place_kind = 'group' ORDER BY step_id`);
      return { ok: true, ...this.#page(rows, viewer, { state, after, limit }) };
    } catch { return { ok: true, steps: [], limit: limitOf(limit, READ_LIMIT), truncated: false, next: null }; }
  }

  /* ---- creating (R1, R8) ---- */

  /* R1: the place read, with its refusal, for the acting viewer: `{kind, questions?, project?}`. */
  #place(place, by, act) {
    if (!isObj(place)) return { refusal: refuse("STEP_BAD_PLACE", localize("steps.index.place_names_its_place", "a step names its place: {questions}, {project} or {group: true}", { questions: "{questions}", project: "{project}" })) };
    const kinds = ["questions", "project", "group"].filter((k) => place[k] !== undefined && place[k] !== null && place[k] !== false);
    if (kinds.length !== 1 || Object.keys(place).some((k) => !["questions", "project", "group"].includes(k)))
      return { refusal: refuse("STEP_BAD_PLACE", localize("steps.index.place_exactly_one_kind", "a step's place is exactly one of {questions}, {project} or {group: true}, and never a step (R21)", { questions: "{questions}", project: "{project}" })) };
    if (kinds[0] === "group") {
      if (place.group !== true) return { refusal: refuse("STEP_BAD_PLACE", localize("steps.index.team_place_is_group", "a team step's place is {group: true}")) };
      return { kind: "group" };
    }
    if (kinds[0] === "project") {
      const bad = this.#projectRefusal(place.project, by, act);
      return bad ? { refusal: bad } : { kind: "project", project: place.project };
    }
    const qs = place.questions;
    if (!Array.isArray(qs) || qs.length === 0 || qs.some((q) => typeof q !== "string"))
      return { refusal: refuse("STEP_BAD_PLACE", "a step on questions names at least one question, by id") };
    const list = [...new Set(qs.map((q) => q.trim()))];
    const absent = list.find((q) => !this.#questionSeen(q, by));
    if (absent !== undefined) return { refusal: refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: absent }) };
    return { kind: "questions", questions: list.sort() };
  }

  /* R12: a `byWhen` read, or a refusal. */
  static #byWhen(b) {
    if (b === undefined || b === null) return { value: null };
    if (!isObj(b) || !filled(b.date) || !isCalendarDate(b.date) || !BASES.includes(b.basis)
        || (b.source !== undefined && b.source !== null && (!filled(b.source) || chars(b.source) > SOURCE_MAX)))
      return { refusal: refuse("STEP_BAD_BY_WHEN", localize("steps.index.by_when_shape", "a date is {date: YYYY-MM-DD, basis: {bases}, source?}", { bases: BASES.join(" | ") })) };
    return { value: { date: b.date, basis: b.basis, ...(filled(b.source) ? { source: b.source.trim() } : {}) } };
  }

  /* R1, R24: who creates, read for an act: a member, or a machine through a run it holds (its principal's sight). */
  #creator(by, run) {
    const a = this.#actor(by);
    if (!a) return { refusal: refuse("STEP_NOT_YOUR_RUN", "the act carries no member and no run") };
    if (!a.machine) return { actor: a, viewer: a.viewer };
    let held = null;
    try { held = this.#runHolder && filled(run) ? this.#runHolder.fn(by, run) : null; } catch { held = null; }
    if (!isObj(held) || !filled(held.principal))
      return { refusal: refuse("STEP_NOT_YOUR_RUN", "a machine credential takes a step only for a run it holds", { run: filled(run) ? run : null }) };
    return { actor: a, viewer: held.principal, enabledBy: held.enabled_by ?? null, run };
  }

  /** R1: `stepCreate({place, work, byWhen?, project?, by, run?})` records a step at `planned`. A machine names the run
   *  it holds (`run`). A member is answered R7's matches beside her new step (R8). */
  stepCreate({ place = null, work = null, byWhen = null, project = null, by = null, run = null, rival = null } = {}) {
    if (!filled(work) || chars(work.trim()) > WORK_MAX) return refuse("STEP_NO_WORK", `the work is the doer's words, 1–${WORK_MAX} characters`);
    const c = this.#creator(by, run);
    if (c.refusal) return c.refusal;
    return this.#create({ place, work: work.trim(), byWhen, project, creator: c, rival });
  }

  #create({ place, work, byWhen, project, creator, rival = null }) {
    const { actor, viewer } = creator;
    const p = this.#place(place, viewer, "stepCreate");
    if (p.refusal) return p.refusal;
    if (filled(project)) { const bad = this.#projectRefusal(project, viewer, "stepCreate"); if (bad) return bad; }
    /* R31: a step opened from a rival is placed on the question whose rival it is; the first of its questions (in id
       order) the registered source confirms is recorded with it. */
    let rivalOn = null;
    if (rival !== undefined && rival !== null) {
      if (!filled(rival)) return refuseRival("a rival is named by its id", { rival: null });
      if (p.kind !== "questions") return refuseRival("only a step on a question is opened from one of its rivals", { rival });
      rivalOn = p.questions.find((q) => this.#isRival(q, rival.trim(), viewer)) ?? null;
      if (!rivalOn) return refuseRival("the id is not one of the step's questions' rival explanations", { rival });
    }
    const w = Steps.#byWhen(byWhen);
    if (w.refusal) return w.refusal;
    const norm = normaliseWork(work);
    /* R8: a machine is refused an open step of the same work on its question, among those its principal sees. */
    if (actor.machine && p.kind === "questions") {
      for (const q of p.questions) {
        const same = this.#rows(`SELECT s.* FROM steps s JOIN step_refs r ON r.step_id = s.step_id
                                 WHERE r.question_id = ? AND s.work_norm = ? AND s.state IN ('planned', 'underway') ORDER BY s.step_id`, q, norm)
          .find((r) => this.#seen(r, viewer));
        if (same) return refuse("STEP_ALIKE_EXISTS", `an open step on ${q} holds the same work: ${same.step_id}`, { step: same.step_id, question: q });
      }
    }
    const at = this.#at();
    const made = this.#record.transact(() => {
      const id = this.#record.allocId("STP", at.slice(0, 4));
      if (!id || !filled(id.id)) return isObj(id) && id.ok === false ? id : mintExhausted("STP");
      this.#sql.exec(`INSERT INTO steps (step_id, place_kind, project_id, work, work_norm, doer_member, enabled_by, run, created_by,
                      taken_in, state, by_when_json, by_when_by, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id.id, p.kind, p.project ?? null, work, norm, actor.member, actor.machine ? creator.enabledBy : null,
        actor.machine ? creator.run : null, actor.by, filled(project) ? project : null, "planned",
        w.value ? json(w.value) : null, w.value && actor.member ? actor.member : null, at);
      for (const q of p.questions ?? [])
        this.#sql.exec(`INSERT INTO step_refs (step_id, question_id, by_actor, at) VALUES (?,?,?,?)`, id.id, q, actor.by, at);
      if (rivalOn)
        this.#sql.exec(`INSERT INTO step_rivals (step_id, question_id, rival_id, by_actor, at) VALUES (?,?,?,?,?)`, id.id, rivalOn, rival.trim(), actor.by, at);
      this.#event(id.id, "create", null, "planned", null, actor.by, at);
      return { ok: true, step: id.id };
    });
    if (!made || made.ok !== true) return made;
    const placeOut = p.kind === "project" ? { project: p.project } : p.kind === "group" ? { group: true } : { questions: p.questions };
    const rivalOut = rivalOn ? { rival: { question: rivalOn, rival: rival.trim() } } : {};
    if (actor.machine) return { ok: true, step: made.step, place: placeOut, ...rivalOut, at };
    const alike = this.stepsLike({ work, questions: p.questions ?? null, viewer }).steps.filter((s) => s.step !== made.step);
    return { ok: true, step: made.step, place: placeOut, ...rivalOut, at, alike };
  }

  #event(stepId, act, from, to, reason, by, at) {
    this.#sql.exec(`INSERT INTO step_events (step_id, act, from_state, to_state, reason, by_actor, at) VALUES (?,?,?,?,?,?,?)`,
      stepId, act, from, to, reason, by, at);
  }

  /* ---- acting on a step: who may (R5, R6, R9–R13) ---- */

  /* The step an act names, seen by its actor, with the actor's standing: a machine only on its own step, and, where
     `memberOnly`, refused; a member in a project-placed step a joined participant of it. */
  #gate(stepId, by, act, { memberOnly = false } = {}) {
    const a = this.#actor(by);
    const row = this.#held(stepId);
    if (!a || !row || !this.#seen(row, a.viewer)) return { refusal: Steps.#noStep(stepId) };
    if (a.machine && memberOnly) return { refusal: refuse("STEP_MEMBER_ONLY", `${act} is a member's act`) };
    if (a.machine && row.created_by !== by) return { refusal: refuse("STEP_NOT_ITS_OWN", `the system acts only on the steps it took; ${row.step_id} is not one`, { step: row.step_id }) };
    if (!a.machine && row.place_kind === "project") {
      const bad = this.#membership.projectAuthority(row.project_id, a.viewer, "joined", act);
      if (bad) return { refusal: bad };
    }
    return { row, actor: a };
  }

  /* R6: a step is touched when it was started, or holds a product, a look, a learned line or a cost. */
  #touched(row) {
    if (Number(row.started) === 1) return true;
    const any = (t) => !!this.#one(`SELECT 1 AS x FROM ${t} WHERE step_id = ? LIMIT 1`, row.step_id);
    if (any("step_products") || any("step_learned") || any("step_costs")) return true;
    try { return this.#log.byAuthority("step", row.step_id, { limit: 1 }).length > 0; } catch { return true; }
  }

  /* ---- state and outcome (R5) ---- */

  /** R5: `stepStart({step, by})`: planned to underway; an ended or set-aside step reopens, recorded. */
  stepStart({ step = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepStart");
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    if (row.state === "underway") return { ok: true, step: row.step_id, state: "underway", already: true };
    const unmet = this.#unmet(row.step_id, actor.viewer, this.#today(this.#now()));
    if (unmet.length) return refuse("STEP_WAITING", `the step waits on ${unmet.length} thing(s) not yet met`, { step: row.step_id, waits: unmet });
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE steps SET state = 'underway', started = 1 WHERE step_id = ?`, row.step_id);
      this.#event(row.step_id, CLOSED.includes(row.state) ? "reopen" : "start", row.state, "underway", null, by, at);
      return { ok: true, step: row.step_id, state: "underway", from: row.state, at };
    });
  }

  /* R5: an outcome map read against the step's place: `[[question, outcome]]` or a refusal. */
  #outcomeList(row, outcomes, viewer) {
    if (outcomes === undefined || outcomes === null) return { list: [] };
    if (row.place_kind !== "questions") {
      const o = isObj(outcomes) ? outcomes.outcome : outcomes;
      return OUTCOMES.includes(o) ? { list: [["", o]] } : { refusal: refuse("STEP_BAD_OUTCOME", `an outcome is one of ${OUTCOMES.join(", ")}`) };
    }
    if (!isObj(outcomes)) return { refusal: refuse("STEP_BAD_OUTCOME", localize("steps.index.outcome_per_question", "a step on questions records an outcome per question: {<question>: outcome}")) };
    const refs = this.#refs(row.step_id).filter((q) => this.#membership.inSight(q, viewer));
    const list = [];
    for (const [q, o] of Object.entries(outcomes)) {
      if (!refs.includes(q) || !OUTCOMES.includes(o))
        return { refusal: refuse("STEP_BAD_OUTCOME", `an outcome is one of ${OUTCOMES.join(", ")}, for a question this step is on`, { question: q }) };
      list.push([q, o]);
    }
    return { list };
  }
  #currentOutcome(stepId, q) {
    const r = this.#one(`SELECT outcome FROM step_outcomes WHERE step_id = ? AND question_id = ? ORDER BY seq DESC LIMIT 1`, stepId, q);
    return r ? r.outcome : "undetermined";
  }
  #writeOutcomes(stepId, list, by, at) {
    for (const [q, o] of list)
      if (this.#currentOutcome(stepId, q) !== o)
        this.#sql.exec(`INSERT INTO step_outcomes (step_id, question_id, outcome, by_actor, at) VALUES (?,?,?,?,?)`, stepId, q, o, by, at);
  }

  /** R5: `stepEnd({step, end, outcomes?, learned?, reason?, by})`: `ended` or `set_aside`. A machine ends only its own
   *  step, `ended` with every outcome undetermined or `set_aside` with its reason, and writes no learned line. */
  stepEnd({ step = null, end = null, outcomes = null, learned = null, reason = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepEnd");
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    if (!CLOSED.includes(end) || CLOSED.includes(row.state))
      return refuse("STEP_BAD_END", `a step ends as ${CLOSED.join(" or ")}, once, from planned or underway; it is ${row.state}`, { step: row.step_id, state: row.state });
    const o = this.#outcomeList(row, outcomes, actor.viewer);
    if (o.refusal) return o.refusal;
    if (reason !== null && reason !== undefined && (!filled(reason) || chars(reason) > REASON_MAX))
      return refuse("STEP_BAD_TEXT", `a reason is 1–${REASON_MAX} characters`);
    if (actor.machine) {
      if (o.list.some(([, v]) => v !== "undetermined") || (learned !== null && learned !== undefined))
        return refuse("STEP_MACHINE_NO_OUTCOME", localize("steps.index.machine_no_outcome", "the system records neither an outcome nor a learned line (D33)"), { step: row.step_id });
      if (end === "set_aside" && !filled(reason))
        return refuse("STEP_MACHINE_NO_OUTCOME", "the system sets its step aside only with its reason (a limit reached, a refusal)", { step: row.step_id });
    }
    if (learned !== null && learned !== undefined && (!filled(learned) || chars(learned) > LEARNED_MAX))
      return refuse("STEP_BAD_TEXT", `what was learned is 1–${LEARNED_MAX} characters`);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE steps SET state = ? WHERE step_id = ?`, end, row.step_id);
      this.#event(row.step_id, "end", row.state, end, filled(reason) ? reason.trim() : null, by, at);
      this.#writeOutcomes(row.step_id, o.list, by, at);
      if (filled(learned)) this.#sql.exec(`INSERT INTO step_learned (step_id, writer, text, at) VALUES (?,?,?,?)`, row.step_id, actor.member, learned.trim(), at);
      return { ok: true, step: row.step_id, state: end, at };
    });
  }

  /** R5: `stepOutcome({step, question?, outcome, by})`: a member sets or revises an outcome, kept with who and when. */
  stepOutcome({ step = null, question = null, outcome = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepOutcome", { memberOnly: true });
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    const o = this.#outcomeList(row, row.place_kind === "questions" ? { [String(question)]: outcome } : outcome, actor.viewer);
    if (o.refusal) return o.refusal;
    const at = this.#at();
    return this.#record.transact(() => {
      this.#writeOutcomes(row.step_id, o.list, by, at);
      return { ok: true, step: row.step_id, ...(row.place_kind === "questions" ? { question } : {}), outcome, at };
    });
  }

  /** R10: `stepLearn({step, text, by})`: the member's own words on what was learned, revisable by its writer with history. */
  stepLearn({ step = null, text = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepLearn", { memberOnly: true });
    if (g.refusal) return g.refusal;
    if (!filled(text) || chars(text) > LEARNED_MAX) return refuse("STEP_BAD_TEXT", `what was learned is 1–${LEARNED_MAX} characters`);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_learned (step_id, writer, text, at) VALUES (?,?,?,?)`, g.row.step_id, g.actor.member, text.trim(), at);
      return { ok: true, step: g.row.step_id, at };
    });
  }

  /* ---- deletion (R6) ---- */

  /** R6: `stepDelete({step, question?, by})`: an untouched step goes outright; a shared one loses only the named
   *  question's reference, and the last reference's removal deletes it. A deletion leaves no row. */
  stepDelete({ step = null, question = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepDelete");
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    if (this.#touched(row))
      return refuse("STEP_WORKED_KEEPS_RECORD", "work was done on this step; set it aside instead", { step: row.step_id });
    if (row.place_kind === "questions") {
      const refs = this.#refs(row.step_id);
      const viewer = actor.viewer;
      if (refs.length > 1) {
        if (!filled(question)) return refuse("STEP_SHARED_NAME_THE_QUESTION", "name the question whose reference is removed", { step: row.step_id });
        if (!refs.includes(question) || !this.#membership.inSight(question, viewer))
          return refuse("NO_SUCH_BUNDLE", "the step is on no question by that id that you can see", { question });
        return this.#record.transact(() => {
          this.#sql.exec(`DELETE FROM step_refs WHERE step_id = ? AND question_id = ?`, row.step_id, question);
          return { ok: true, step: row.step_id, removed: { question }, deleted: false };
        });
      }
    }
    return this.#record.transact(() => {
      this.#sql.exec(`DELETE FROM steps WHERE step_id = ?`, row.step_id);
      return { ok: true, step: row.step_id, deleted: true };
    });
  }

  /* ---- shared steps and the duplicate search (R7, R8) ---- */

  /** R7: `stepsLike({work, questions?, viewer, limit?})`: the steps the viewer sees whose work matches, open and ended
   *  alike, best first, at most 50. */
  stepsLike({ work = null, questions = null, viewer = null, limit = undefined } = {}) {
    const lim = limitOf(limit, { default: LIKE_MAX, max: LIKE_MAX });
    const norm = normaliseWork(work);
    if (!norm || !filled(viewer)) return { ok: true, steps: [], limit: lim, truncated: false };
    const within = Array.isArray(questions) && questions.length ? new Set(questions) : null;
    const rows = this.#rows(`SELECT * FROM steps ORDER BY at DESC, step_id LIMIT ?`, LIKE_SCAN + 1);
    const scanned = rows.length > LIKE_SCAN;
    const found = [];
    for (const r of rows.slice(0, LIKE_SCAN)) {
      const score = likeness(norm, r.work_norm);
      if (score < LIKE_THRESHOLD) continue;
      if (within && !this.#refs(r.step_id).some((q) => within.has(q))) continue;
      if (!this.#seen(r, viewer)) continue;
      found.push({ r, score });
    }
    found.sort((a, b) => b.score - a.score || (a.r.step_id < b.r.step_id ? -1 : 1));
    const today = this.#today(this.#now());
    const steps = found.slice(0, lim).map(({ r, score }) => {
      const v = this.#view(r, viewer, today);
      return { step: v.step, place: v.place, work: v.work, state: v.state, outcomes: v.outcomes, likeness: Math.round(score * 100) / 100 };
    });
    return { ok: true, steps, limit: lim, truncated: found.length > lim || scanned };
  }

  /** R7: `stepRefer({step, question, by})`: a question's reference to an existing step on questions. */
  stepRefer({ step = null, question = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepRefer");
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    const viewer = actor.viewer;
    if (!this.#questionSeen(question, viewer))
      return refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: filled(question) ? question : null });
    if (row.place_kind === "project")
      return refuse("STEP_NARROWER_THAN_QUESTION", "a project's step is seen only in its project; a question's use would widen it", { step: row.step_id });
    if (row.place_kind === "group") return refuse("STEP_BAD_PLACE", localize("steps.index.team_place_fixed", "a team step is the team's, and its place is fixed at creation"), { step: row.step_id });
    if (this.#refs(row.step_id).includes(question)) return { ok: true, step: row.step_id, question, already: true };
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_refs (step_id, question_id, by_actor, at) VALUES (?,?,?,?)`, row.step_id, question, by, at);
      this.#event(row.step_id, "refer", null, null, question, by, at);
      return { ok: true, step: row.step_id, question, at };
    });
  }

  /* ---- products (R9) ---- */

  /* R9: what a product names, read: `{kind, id, derivation?}` or a refusal. A bare string is a record id or a lead. */
  static #product(record) {
    const bad = (why) => ({ refusal: refuse("STEP_BAD_PRODUCT", why) });
    let p = record;
    if (typeof record === "string") p = { kind: /^LEAD-/.test(record.trim()) ? "lead" : "record", id: record };
    if (!isObj(p) || !PRODUCT_KINDS.includes(p.kind) || !filled(p.id)) return bad(`a product is {kind: ${PRODUCT_KINDS.join(" | ")}, id}`);
    const id = p.id.trim();
    if (p.kind === "record" && !isRecordId(id)) return bad("a record is named by an id the record's id grammar knows");
    if ((p.kind === "capture" || p.kind === "content") && !HEX64.test(id)) return bad(`a ${p.kind} is named by its 64-character digest`);
    if (p.kind === "lead" && !/^LEAD-\d{4}-\d{4}-[0-9a-f]{12}$/.test(id)) return bad("a lead is named by its LEAD- id");
    if (p.kind === "connection") {
      let ok = false;
      try { ok = HEX64.test(id) && isObj(p.derivation) && derivedId(p.derivation) === id; } catch { ok = false; }
      if (!ok) return bad("a derived connection is named by its id with the derivation it is worked out from");
      const d = p.derivation;
      return { kind: "connection", id, derivation: { kind: d.kind, from: d.from, to: d.to, as_of: d.as_of, method: d.method } };
    }
    return { kind: p.kind, id };
  }

  /* R9: whether `viewer` sees a product; anything this module cannot judge is not seen (fail closed). */
  #productSeen(kind, id, derivation, viewer) {
    try {
      if (!filled(viewer)) return false;
      if (viewerPredicate(viewer).scope === "member") return true;
      const bundleSeen = (b) => !!this.#record.bundleInfo(b) && this.#membership.inSight(b, viewer);
      if (kind === "record") {
        if (this.#record.bundleInfo(id)) return this.#membership.inSight(id, viewer);
        const reg = this.#productSight.get(id.split("-")[0]);
        return !!reg && reg.fn(id, viewer) === true;
      }
      if (kind === "capture") return this.#rows(`SELECT bundle_id FROM register WHERE capture_sha = ?`, id).some((r) => bundleSeen(r.bundle_id));
      if (kind === "content") { const r = this.#one(`SELECT bundle_id FROM content WHERE content_id = ?`, id); return !!r && bundleSeen(r.bundle_id); }
      if (kind === "lead") { const r = this.#log.leadRead({ id, viewer, limit: 1 }); return isObj(r) && r.ok !== false; }
      if (kind === "connection") { const d = isObj(derivation) ? derivation : parse(derivation); return isObj(d) && bundleSeen(d.from) && bundleSeen(d.to); }
    } catch { return false; }
    return false;
  }

  #tie(row, p, by) {
    const at = this.#at();
    return this.#record.transact(() => {
      const had = this.#one(`SELECT 1 AS x FROM step_products WHERE step_id = ? AND kind = ? AND ref = ?`, row.step_id, p.kind, p.id);
      if (had) return { ok: true, step: row.step_id, product: { kind: p.kind, id: p.id }, already: true };
      this.#sql.exec(`INSERT INTO step_products (step_id, kind, ref, derivation, by_actor, at) VALUES (?,?,?,?,?,?)`,
        row.step_id, p.kind, p.id, p.derivation ? json(p.derivation) : null, by, at);
      return { ok: true, step: row.step_id, product: { kind: p.kind, id: p.id }, at };
    });
  }

  /** R9: `stepProduct({step, record, by})`: a member ties to a step a record she may see (a chance find). */
  stepProduct({ step = null, record = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepProduct", { memberOnly: true });
    if (g.refusal) return g.refusal;
    const p = Steps.#product(record);
    if (p.refusal) return p.refusal;
    if (!this.#productSeen(p.kind, p.id, p.derivation, g.actor.viewer))
      return refuse("NO_SUCH_PRODUCT", "nothing by that id is held that you may see", { product: { kind: p.kind, id: p.id } });
    return this.#tie(g.row, p, by);
  }

  /** R9: `recordProduct({step, record, by})`: the in-process door for `capture-requests`, `ai-runs`, `run-productions`
   *  and `control-plane`, which have made the product themselves: its form is checked, and the step must be held. */
  recordProduct({ step = null, record = null, by = null } = {}) {
    const row = this.#held(step);
    if (!row) return Steps.#noStep(step);
    const p = Steps.#product(record);
    if (p.refusal) return p.refusal;
    return this.#tie(row, p, filled(by) ? by : "plane");
  }

  /** R9: `productsOf({step, viewer})`: the products and looks the viewer may see, the rest left out uncounted. */
  productsOf({ step = null, viewer = null } = {}) {
    try {
      const row = this.#held(step);
      if (!row || !this.#seen(row, viewer)) return Steps.#noStep(step);
      const products = this.#rows(`SELECT * FROM step_products WHERE step_id = ? ORDER BY seq`, row.step_id)
        .filter((p) => this.#productSeen(p.kind, p.ref, p.derivation, viewer))
        .map((p) => ({ kind: p.kind, id: p.ref, by: this.#shown(p.by_actor), at: p.at }));
      const looks = this.#log.byAuthority("step", row.step_id, { limit: 2000 }).filter((r) => this.#log.rowVisible(r, viewer));
      return { ok: true, step: row.step_id, products, looks };
    } catch { return Steps.#noStep(step); }
  }

  /** R9: `stepsOf({record, viewer})`: the steps that produced a record, and their questions; none for a record no step
   *  produced. */
  stepsOf({ record = null, viewer = null } = {}) {
    const p = Steps.#product(record);
    if (p.refusal) return p.refusal;
    try {
      const steps = this.#rows(`SELECT s.* FROM step_products p JOIN steps s ON s.step_id = p.step_id WHERE p.kind = ? AND p.ref = ? ORDER BY s.step_id`, p.kind, p.id)
        .filter((r) => this.#seen(r, viewer))
        .map((r) => ({ step: r.step_id, work: r.work,
                       ...(r.place_kind === "questions" ? { questions: this.#refs(r.step_id).filter((q) => this.#membership.inSight(q, viewer)) }
                         : r.place_kind === "project" ? { project: r.project_id } : { group: true }) }));
      return { ok: true, record: { kind: p.kind, id: p.id }, steps };
    } catch { return { ok: true, record: { kind: p.kind, id: p.id }, steps: [] }; }
  }

  /** R31 (CR2-18, BD-17): `stepsOfRival({question, rival, viewer, after?, limit?})`: the steps opened from `rival` on
   *  `question` that the viewer sees, each as R4 reads it with `products`, what it produced that the viewer may see
   *  (R9's `productsOf`), so the rival lists the legs those steps found. Bounded as R4's reads. A question the viewer may
   *  not see answers `NO_SUCH_BUNDLE`; a rival no step was opened from answers none. Writes nothing; never throws. */
  stepsOfRival({ question = null, rival = null, viewer = null, after = null, limit = undefined } = {}) {
    try {
      if (!this.#questionSeen(question, viewer))
        return refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: filled(question) ? question : null });
      const rows = filled(rival)
        ? this.#rows(`SELECT s.* FROM steps s JOIN step_rivals v ON v.step_id = s.step_id WHERE v.question_id = ? AND v.rival_id = ? ORDER BY s.step_id`, question, rival)
        : [];
      const page = this.#page(rows, viewer, { state: null, after, limit });
      const steps = page.steps.map((v) => { const pr = this.productsOf({ step: v.step, viewer }); return { ...v, products: pr.ok ? pr.products : [] }; });
      return { ok: true, question, rival: filled(rival) ? rival : null, ...page, steps };
    } catch { return refuse("NO_SUCH_BUNDLE", "the rival's steps could not be read", { question: filled(question) ? question : null }); }
  }

  /* ---- waits and dates (R11, R12) ---- */

  /* R11: the breadth of a step's sight, for the narrower test: who sees `on` must include who sees `waiting`. */
  #narrower(waiting, on) {
    if (on.place_kind === "group") return false;
    if (waiting.place_kind === "group") return true;
    if (on.place_kind === "project") return !(waiting.place_kind === "project" && waiting.project_id === on.project_id);
    const onRefs = this.#refs(on.step_id);
    if (waiting.place_kind === "questions") return !this.#refs(waiting.step_id).every((q) => onRefs.includes(q));
    /* a project's step waiting on a step on questions: seen by that project's participants when one question is the
       project's own */
    return !onRefs.some((q) => { const b = this.#record.bundleInfo(q); return b && b.project === waiting.project_id; });
  }
  /* R11: the path by which `on` already waits, through step waits, on `stepId`, or null. */
  #cycle(stepId, on) {
    const seen = new Set();
    const walk = (cur, path) => {
      if (cur === stepId) return path;
      if (seen.has(cur)) return null;
      seen.add(cur);
      for (const w of this.#rows(`SELECT on_step FROM step_waits WHERE step_id = ? AND on_kind = 'step' AND removed_at IS NULL`, cur)) {
        const p = walk(w.on_step, [...path, w.on_step]);
        if (p) return p;
      }
      return null;
    };
    const p = walk(on, [stepId, on]);
    return p;
  }

  /** R11: `stepWait({step, on, by})`, `on` one of `{step}`, `{arrival: {kind, id}}`, `{date}`. */
  stepWait({ step = null, on = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepWait");
    if (g.refusal) return g.refusal;
    const { row, actor } = g;
    const viewer = actor.viewer;
    const keys = isObj(on) ? Object.keys(on) : [];
    if (keys.length !== 1 || !["step", "arrival", "date"].includes(keys[0]))
      return refuse("STEP_BAD_WAIT", localize("steps.index.wait_shape", "a wait is on one of {step}, {arrival: {kind, id}} or {date}", { step: "{step}", date: "{date}" }));
    let cols;
    if (keys[0] === "step") {
      const t = this.#held(on.step);
      if (!t || !this.#seen(t, viewer)) return Steps.#noStep(on.step);
      const path = this.#cycle(row.step_id, t.step_id);
      if (path) return refuse("STEP_WAIT_CYCLE", `the wait would close the loop ${path.join(" → ")}`, { path });
      if (this.#narrower(row, t)) return refuse("STEP_WAIT_NARROWER", `${t.step_id} is seen by fewer than see ${row.step_id}`, { on: { step: t.step_id } });
      cols = ["step", t.step_id, null, null, null];
    } else if (keys[0] === "date") {
      if (!filled(on.date) || !isCalendarDate(on.date)) return refuse("STEP_BAD_WAIT", "a date wait names a calendar day, YYYY-MM-DD");
      cols = ["date", null, null, null, on.date];
    } else {
      const a = on.arrival;
      if (!isObj(a) || !filled(a.kind) || !filled(a.id)) return refuse("STEP_BAD_WAIT", "an arrival names its kind and its id");
      cols = ["arrival", null, a.kind.trim(), a.id.trim(), null];
    }
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_waits (step_id, on_kind, on_step, arrival_kind, arrival_id, on_date, by_actor, at) VALUES (?,?,?,?,?,?,?,?)`,
        row.step_id, ...cols, by, at);
      const w = this.#one(`SELECT MAX(wait_id) AS id FROM step_waits WHERE step_id = ?`, row.step_id);
      return { ok: true, step: row.step_id, wait: Number(w.id), at };
    });
  }

  /** R11: `stepWaitRemove({wait, by})`: the wait ends, recorded with who and when. */
  stepWaitRemove({ wait = null, by = null } = {}) {
    const w = Number.isSafeInteger(Number(wait)) ? this.#one(`SELECT * FROM step_waits WHERE wait_id = ? AND removed_at IS NULL`, Number(wait)) : null;
    const g = w ? this.#gate(w.step_id, by, "stepWaitRemove") : null;
    if (!w || g.refusal) return refuse("NO_SUCH_WAIT", "no wait by that number is held on a step you may act on", { wait: wait ?? null });
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE step_waits SET removed_by = ?, removed_at = ? WHERE wait_id = ?`, by, at, Number(w.wait_id));
      return { ok: true, step: w.step_id, wait: Number(w.wait_id), removed: true, at };
    });
  }

  /** R30: `stepsWaitingOn({kind, id})`, in process for `action-clocks`: the steps with a live arrival wait (R11) on
   *  `{kind, id}`, each `{step, byWhen, state}` (`state` as R4 reads it, `waiting` included), at most
   *  `WAITING_ON_MAX` by step id, with `truncated`. It asks no viewer and is never answered to a member; it writes
   *  nothing and never throws. */
  stepsWaitingOn({ kind = null, id = null } = {}) {
    if (!filled(kind) || !filled(id)) return { ok: true, steps: [], truncated: false };
    try {
      const rows = this.#rows(`SELECT s.* FROM steps s WHERE s.step_id IN (SELECT w.step_id FROM step_waits w
                                 WHERE w.on_kind = 'arrival' AND w.arrival_kind = ? AND w.arrival_id = ? AND w.removed_at IS NULL)
                               ORDER BY s.step_id LIMIT ?`, kind.trim(), id.trim(), WAITING_ON_MAX + 1);
      const today = this.#today(this.#now());
      const steps = rows.slice(0, WAITING_ON_MAX).map((r) => {
        const waits = this.#waitRows(r.step_id).map((w) => this.#waitView(w, null, today));
        return { step: r.step_id, byWhen: parse(r.by_when_json), state: this.#readState(r, waits) };
      });
      return { ok: true, steps, truncated: rows.length > WAITING_ON_MAX };
    } catch { return { ok: true, steps: [], truncated: false }; }
  }

  /** R12: `stepByWhen({step, byWhen, by})`: a member sets (or, with null, clears) the date; she alone is told it is due. */
  stepByWhen({ step = null, byWhen = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepByWhen", { memberOnly: true });
    if (g.refusal) return g.refusal;
    const w = Steps.#byWhen(byWhen);
    if (w.refusal) return w.refusal;
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE steps SET by_when_json = ?, by_when_by = ? WHERE step_id = ?`, w.value ? json(w.value) : null, w.value ? g.actor.member : null, g.row.step_id);
      this.#event(g.row.step_id, "by_when", null, null, w.value ? json(w.value) : null, by, at);
      return { ok: true, step: g.row.step_id, byWhen: w.value, at };
    });
  }

  /** R12: `stepReminder({step, at, by})`: a reminder on the day `at` (a calendar day), answered by `stepsDue` to her alone. */
  stepReminder({ step = null, at = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepReminder", { memberOnly: true });
    if (g.refusal) return g.refusal;
    if (!filled(at) || !isCalendarDate(at)) return refuse("STEP_BAD_REMINDER", "a reminder names a calendar day, YYYY-MM-DD");
    const when = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_reminders (step_id, member, day, at) VALUES (?,?,?,?)`, g.row.step_id, g.actor.member, at, when);
      return { ok: true, step: g.row.step_id, day: at, at: when };
    });
  }

  /** R12: `stepsDue({viewer, at})`, for `notice-producers`: to the member who set each date only, each step past its
   *  date and not closed, and each reminder she asked for, from its day; each with a stable key. R29: a step whose
   *  date the registered holder holds draws no past-date item (the action's clock entry is the one item); her own
   *  reminders stay. T46: each read takes at most `DUE_READ_MAX` rows (her dated steps not closed, in step order; her
   *  reminders due by that day, in the order she asked them); when either holds more, the answer carries
   *  `truncated: true` beside `due`, and otherwise no `truncated`, so a bound reached is never silent. */
  stepsDue({ viewer = null, at = null } = {}) {
    const member = this.#memberOf(viewer);
    const today = filled(at) ? this.#today(at) : null;
    if (!member) return { ok: true, due: [] };
    if (!today) return { ok: true, due: [], undetermined: true, why: word("steps.why.time_zone_held_group") };
    const due = [];
    const dated = this.#rows(`SELECT * FROM steps WHERE by_when_by = ? AND state NOT IN ('ended', 'set_aside') ORDER BY step_id LIMIT ?`, member, DUE_READ_MAX + 1);
    const reminders = this.#rows(`SELECT m.seq, m.day, s.* FROM step_reminders m JOIN steps s ON s.step_id = m.step_id
                                  WHERE m.member = ? AND m.day <= ? AND s.state NOT IN ('ended', 'set_aside') ORDER BY m.seq LIMIT ?`, member, today, DUE_READ_MAX + 1);
    const truncated = dated.length > DUE_READ_MAX || reminders.length > DUE_READ_MAX;
    for (const r of dated.slice(0, DUE_READ_MAX)) {
      const b = parse(r.by_when_json);
      if (!isObj(b) || !(b.date < today) || !this.#seen(r, viewer)) continue;
      if (this.#heldBy(r)) continue;                 /* R29: the action's clock entry is that date's one item */
      due.push({ step: r.step_id, work: r.work, kind: "past_date", date: b.date, key: sha256HexSync(`steps:due:${r.step_id}:${b.date}`) });
    }
    for (const m of reminders.slice(0, DUE_READ_MAX)) {
      if (!this.#seen(m, viewer)) continue;
      due.push({ step: m.step_id, work: m.work, kind: "reminder", date: m.day, key: sha256HexSync(`steps:reminder:${m.seq}`) });
    }
    return truncated ? { ok: true, due, truncated: true } : { ok: true, due };
  }

  /* ---- money cost (R13–R15) ---- */

  /** R13: `stepCostAdd({step, kind, amount, currency, what, by})`, appended with who and when. */
  stepCostAdd({ step = null, kind = null, amount = null, currency = null, what = null, by = null } = {}) {
    const g = this.#gate(step, by, "stepCostAdd", { memberOnly: true });
    if (g.refusal) return g.refusal;
    const amt = typeof amount === "string" ? amount.trim() : "";
    if (!COST_KINDS.includes(kind) || !AMOUNT.test(amt) || !dec(amt) || typeof currency !== "string" || !CURRENCY.test(currency)
        || !filled(what) || chars(what) > WHAT_MAX)
      return refuse("STEP_BAD_COST", localize("steps.index.cost_shape", "a cost is {kind: {kinds}, amount: an exact decimal string, currency: a three-letter code, what}", { kinds: COST_KINDS.join(" | ") }));
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_costs (step_id, kind, amount, currency, what, by_actor, at) VALUES (?,?,?,?,?,?,?)`,
        g.row.step_id, kind, amt, currency, what.trim(), by, at);
      const c = this.#one(`SELECT MAX(cost_id) AS id FROM step_costs WHERE step_id = ?`, g.row.step_id);
      return { ok: true, step: g.row.step_id, cost: Number(c.id), at };
    });
  }

  /** R13: `stepCostRemove({cost, by})`, by its writer only, recorded. */
  stepCostRemove({ cost = null, by = null } = {}) {
    const c = Number.isSafeInteger(Number(cost)) ? this.#one(`SELECT * FROM step_costs WHERE cost_id = ? AND removed_at IS NULL`, Number(cost)) : null;
    const a = this.#actor(by);
    if (!c || !a || a.machine || this.#memberOf(c.by_actor) !== a.member || !this.#seen(this.#held(c.step_id), a.viewer))
      return refuse("NO_SUCH_COST", "no cost by that number is held that you recorded", { cost: cost ?? null });
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE step_costs SET removed_by = ?, removed_at = ? WHERE cost_id = ?`, by, at, Number(c.cost_id));
      return { ok: true, step: c.step_id, cost: Number(c.cost_id), removed: true, at };
    });
  }

  /* R14: the share of one costed step on questions: `{totals, projects}` when two or more projects draw on its questions
     and none is hidden; null otherwise, and whenever a read is incomplete or fails. */
  #share(row) {
    if (row.place_kind !== "questions") return null;
    const costs = this.#rows(`SELECT * FROM step_costs WHERE step_id = ? AND removed_at IS NULL`, row.step_id);
    if (!costs.length) return null;
    const projects = new Set();
    for (const q of this.#refs(row.step_id)) {
      const d = this.#drawing(q);
      if (d === null) return null;
      for (const p of d) projects.add(p);
    }
    if (projects.size < 2) return null;
    const list = [...projects].sort();
    try { if (list.some((p) => this.#membership.visibilityOf(p) !== "discoverable")) return null; } catch { return null; }
    return { totals: Steps.#totals(costs), projects: list };
  }

  /** R14: `costShares({viewer, at})`: to each owner of each project sharing a costed step, the step's totals and the
   *  sharing projects, with a key stable per step, totals and project set. */
  costShares({ viewer = null, at = null } = {}) {
    void at;
    const member = this.#memberOf(viewer);
    if (!member) return { ok: true, shares: [] };
    const shares = [];
    try {
      for (const row of this.#rows(`SELECT DISTINCT s.* FROM steps s JOIN step_costs c ON c.step_id = s.step_id
                                    WHERE s.place_kind = 'questions' AND c.removed_at IS NULL ORDER BY s.step_id`)) {
        const sh = this.#share(row);
        if (!sh || !sh.projects.some((p) => this.#membership.isProjectOwner(p, member)) || !this.#seen(row, viewer)) continue;
        shares.push({ step: row.step_id, totals: sh.totals,
                      projects: sh.projects.map((p) => ({ id: p, name: this.#record.bundleInfo(p)?.title ?? null })),
                      key: sha256HexSync(canonicalJson({ step: row.step_id, totals: sh.totals, projects: sh.projects })) });
      }
    } catch { return { ok: true, shares: [] }; }
    return { ok: true, shares };
  }

  /** R15: `costMessage({step, text, by})`: an owner of a project R14 answers for the step relays her text, once, to the
   *  owners of each other such project. */
  costMessage({ step = null, text = null, by = null } = {}) {
    const a = this.#actor(by);
    if (a && a.machine) return refuse("STEP_MEMBER_ONLY", "a cost message is a member's own words");
    const row = this.#held(step);
    const sh = row && a && this.#seen(row, a.viewer) ? this.#share(row) : null;
    const mine = sh ? sh.projects.filter((p) => this.#membership.isProjectOwner(p, a.member)) : [];
    if (!sh || !mine.length) return Steps.#noStep(step);
    if (!filled(text) || chars(text) > MESSAGE_MAX) return refuse("STEP_BAD_TEXT", `a message is 1–${MESSAGE_MAX} characters`);
    const to = new Set();
    for (const p of sh.projects) if (!mine.includes(p)) for (const o of this.#membership.projectOwners(p)) if (o !== a.member) to.add(o);
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_cost_messages (step_id, text, writer, at) VALUES (?,?,?,?)`, row.step_id, text.trim(), a.member, at);
      const id = Number(this.#one(`SELECT MAX(message_id) AS id FROM step_cost_messages`).id);
      for (const m of to) this.#sql.exec(`INSERT INTO step_cost_message_to (message_id, member) VALUES (?,?)`, id, m);
      return { ok: true, step: row.step_id, message: id, at };
    });
  }

  /** R15: `costMessages({viewer})`: the messages relayed to her, newest first, each with its text and its writer's
   *  handle, naming no project. */
  costMessages({ viewer = null } = {}) {
    const member = this.#memberOf(viewer);
    if (!member) return { ok: true, messages: [] };
    const messages = this.#rows(`SELECT m.* FROM step_cost_messages m JOIN step_cost_message_to t ON t.message_id = m.message_id
                                 WHERE t.member = ? ORDER BY m.message_id DESC LIMIT 200`, member)
      .map((m) => ({ message: Number(m.message_id), step: m.step_id, text: m.text, writer: this.#handle(m.writer), at: m.at }));
    return { ok: true, messages };
  }

  /* ---- following a question (R16, R17) ---- */

  /** R16: `questionFollow({question, on, by})`: a member's own choice to follow a question she may see, or to stop. */
  questionFollow({ question = null, on = null, by = null } = {}) {
    const a = this.#actor(by);
    if (a && a.machine) return refuse("STEP_MEMBER_ONLY", "following a question is a member's own choice");
    if (!a || !this.#questionSeen(question, a.viewer))
      return refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: filled(question) ? question : null });
    const flag = on === true ? 1 : 0;
    const at = this.#at();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO question_follows (member, question_id, on_flag, at) VALUES (?,?,?,?)
                      ON CONFLICT (member, question_id) DO UPDATE SET on_flag = excluded.on_flag, at = excluded.at`, a.member, question, flag, at);
      return { ok: true, question, following: flag === 1, at };
    });
  }

  /** R16: `following({question, viewer})`: her own choice, to her alone. */
  following({ question = null, viewer = null } = {}) {
    const member = this.#memberOf(viewer);
    if (!member || !this.#questionSeen(question, viewer))
      return refuse("NO_SUCH_BUNDLE", "no question by that id is held, or it is not one you may see", { question: filled(question) ? question : null });
    const r = this.#one(`SELECT on_flag, at FROM question_follows WHERE member = ? AND question_id = ?`, member, question);
    return { ok: true, question, choice: r ? (Number(r.on_flag) === 1 ? "following" : "stopped") : "none" };
  }

  /* R17: every recipient of a question, as member ids, or null when a read is incomplete or fails. */
  #recipients(question) {
    if (!this.#isQuestion(question)) return [];
    const drawing = this.#drawing(question);
    if (drawing === null) return null;
    const set = new Set();
    for (const p of drawing) for (const j of this.#membership.joinedParticipants(p)) set.add(j.member);
    const follows = this.#rows(`SELECT member, on_flag FROM question_follows WHERE question_id = ?`, question);
    for (const f of follows) { if (Number(f.on_flag) === 1) set.add(f.member); else set.delete(f.member); }
    return [...set].filter((m) => this.#activeMember(m) && this.#membership.inSight(question, `member:${m}`)).sort();
  }

  /** R17: `findRecipients({question, after?, limit?})` (in-process): the joined participants of every project drawing
   *  on the question, less those who stopped following it, plus those who chose to, each while she may see it. */
  findRecipients({ question = null, after = null, limit = undefined } = {}) {
    const lim = limitOf(limit, RECIPIENTS_LIMIT);
    let all = null;
    try { all = this.#recipients(question); } catch { all = null; }
    if (all === null) return { ok: false, reason: "RECIPIENTS_UNREADABLE", question, detail: "the projects drawing on the question could not be read whole" };
    const rest = filled(after) ? all.filter((m) => m > after) : all;
    const page = rest.slice(0, lim);
    return { ok: true, question, recipients: page, limit: lim, truncated: rest.length > lim, next: rest.length > lim ? { after: page[page.length - 1] } : null };
  }

  /* ---- data found later (R23) ---- */

  /** R23 (observation-log R37): an earlier look made for a step, answered by a `PRESENT` at its subject and level. The
   *  entry keeps both instants: `at`, when what arrived was logged, and `looked_at`, when the step looked (T44). */
  lookAnswered({ earlier = null, observation = null } = {}) {
    if (!isObj(earlier) || !isObj(observation) || earlier.authority_kind !== "step") return;
    if (!this.#held(earlier.authority)) return;
    this.#sql.exec(`INSERT OR IGNORE INTO step_later_found (step_id, look_seq, observation_seq, at, looked_at) VALUES (?,?,?,?,?)`,
      earlier.authority, Number(earlier.seq), Number(observation.seq), String(observation.at), filled(earlier.at) ? earlier.at : null);
  }

  /** R23: `laterFound({viewer, at})`, for `notice-producers`: each entry once, to each of R17's recipients of a
   *  referring question who sees both the step and what arrived, and to the member who did the step. Each entry answers
   *  `at` (what arrived) and `looked_at` (the look). Entries logged after `at` wait for a later call; at most
   *  `LATER_FOUND_SCAN` entries are read, and `truncated` says when more are held. */
  laterFound({ viewer = null, at = null } = {}) {
    const member = this.#memberOf(viewer);
    if (!member) return { ok: true, found: [], truncated: false };
    const found = [];
    const rcache = new Map();
    let truncated = false;
    try {
      const rows = this.#rows(`SELECT f.*, s.doer_member FROM step_later_found f JOIN steps s ON s.step_id = f.step_id ORDER BY f.seq LIMIT ?`, LATER_FOUND_SCAN + 1);
      truncated = rows.length > LATER_FOUND_SCAN;
      for (const e of rows.slice(0, LATER_FOUND_SCAN)) {
        /* compared as instants, never as strings: `…:00Z` and `…:00.000Z` are one instant (record-core R48) */
        if (filled(at) && !(instantOrder(e.at, at) <= 0)) continue;
        const row = this.#held(e.step_id);
        if (!this.#seen(row, viewer) || !this.#observationSeen(e.observation_seq, viewer)) continue;
        const qs = this.#refs(e.step_id);
        const told = e.doer_member === member || qs.some((q) => {
          if (!rcache.has(q)) rcache.set(q, this.#recipients(q) ?? []);
          return rcache.get(q).includes(member);
        });
        if (!told) continue;
        found.push({ step: e.step_id, look: Number(e.look_seq), observation: Number(e.observation_seq), at: e.at,
                     looked_at: e.looked_at ?? null, questions: qs.filter((q) => this.#membership.inSight(q, viewer)),
                     key: sha256HexSync(`steps:later:${e.step_id}:${e.observation_seq}`) });
      }
    } catch { return { ok: true, found: [], truncated: false }; }
    return { ok: true, found, truncated };
  }

  /* ---- a proposed step, accepted (R24, R26) ---- */

  /** R24: `stepPropose({place, work, why, run, by})`: a machine's or an assistant's proposed step, held apart and
   *  labelled the system's; never a step until a member accepts it. */
  stepPropose({ place = null, work = null, why = null, run = null, by = null } = {}) {
    if (!isMachineIdentity(by)) return refuse("STEP_PROPOSE_NOT_A_MACHINE", "a proposal is the system's or an assistant's; a member creates a step themselves");
    const c = this.#creator(by, run);
    if (c.refusal) return c.refusal;
    if (!filled(work) || chars(work.trim()) > WORK_MAX) return refuse("STEP_NO_WORK", `the work is 1–${WORK_MAX} characters`);
    if (!filled(why) || chars(why) > WHY_MAX) return refuse("STEP_BAD_TEXT", `why is 1–${WHY_MAX} characters`);
    const p = this.#place(place, c.viewer, "stepPropose");
    if (p.refusal) return p.refusal;
    const at = this.#at();
    const state = lawProposalState(by);
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO step_proposals (place_kind, project_id, work, why, run, by_actor, label_state, at, status) VALUES (?,?,?,?,?,?,?,?,?)`,
        p.kind, p.project ?? null, work.trim(), why.trim(), run, by, state, at, "proposed");
      const id = Number(this.#one(`SELECT MAX(proposal_id) AS id FROM step_proposals`).id);
      for (const q of p.questions ?? []) this.#sql.exec(`INSERT INTO step_proposal_refs (proposal_id, question_id) VALUES (?,?)`, id, q);
      return { ok: true, proposal: id, label: { by, state, machine_work: state === "machine_proposed" }, at };
    });
  }

  #proposalRefs(id) { return this.#rows(`SELECT question_id FROM step_proposal_refs WHERE proposal_id = ? ORDER BY question_id`, id).map((r) => r.question_id); }
  #proposalSeen(pr, viewer) {
    if (!pr || !filled(viewer)) return false;
    return this.#seen({ step_id: null, place_kind: pr.place_kind, project_id: pr.project_id }, viewer)
      || (pr.place_kind === "questions" && this.#proposalRefs(pr.proposal_id).some((q) => this.#membership.inSight(q, viewer)));
  }
  #proposalView(pr, viewer) {
    const place = pr.place_kind === "project" ? { project: pr.project_id } : pr.place_kind === "group" ? { group: true }
      : { questions: this.#proposalRefs(pr.proposal_id).filter((q) => this.#membership.inSight(q, viewer)) };
    return { proposal: Number(pr.proposal_id), place, work: pr.work, why: pr.why,
             label: { by: pr.by_actor, state: pr.label_state, machine_work: pr.label_state === "machine_proposed" },
             status: pr.status, at: pr.at,
             ...(pr.status !== "proposed" ? { form: pr.form, step: pr.step_id, reason: pr.reason, decided_by: this.#handle(pr.decided_by), decided_at: pr.decided_at } : {}) };
  }

  /** R24: `stepProposals({viewer, after?, limit?})`: the proposals the viewer sees, a set-aside one with its reason. */
  stepProposals({ viewer = null, after = null, limit = undefined } = {}) {
    const lim = limitOf(limit, READ_LIMIT);
    const from = Number.isSafeInteger(Number(after)) && after !== null && after !== "" ? Number(after) : 0;
    const out = [];
    let truncated = false;
    for (const pr of this.#rows(`SELECT * FROM step_proposals WHERE proposal_id > ? ORDER BY proposal_id`, from)) {
      if (!this.#proposalSeen(pr, viewer)) continue;
      if (out.length === lim) { truncated = true; break; }
      out.push(this.#proposalView(pr, viewer));
    }
    return { ok: true, proposals: out, limit: lim, truncated, next: truncated ? { after: out[out.length - 1].proposal } : null };
  }

  /* R24: whether a member may accept: a joined participant of a project drawing on the proposal's question (or, where
     none draws, one who sees it); of the project, for a project's proposal; any active member, for the group's. */
  #mayAccept(pr, a) {
    if (pr.place_kind === "project") return this.#membership.projectAuthority(pr.project_id, a.viewer, "joined", "stepAccept");
    if (pr.place_kind === "group") return null;
    const drawing = new Set();
    for (const q of this.#proposalRefs(pr.proposal_id)) {
      const d = this.#drawing(q);
      if (d === null) return this.#notJoined(null, a);
      for (const p of d) drawing.add(p);
    }
    if (!drawing.size) return null;
    if ([...drawing].some((p) => this.#membership.isJoinedParticipant(p, a.member))) return null;
    return this.#notJoined([...drawing][0], a);
  }
  /* membership R55's refusal, its code minted there; the drawing project it was asked of is not named (it may be hidden). */
  #notJoined(project, a) {
    const r = this.#membership.projectAuthority(project ?? "", a.viewer, "joined", "stepAccept")
      ?? { ok: false, reason: "PROJECT_ACT_NOT_A_PARTICIPANT", code: "PROJECT_ACT_NOT_A_PARTICIPANT" };
    return { ...r, project: null, detail: "accepting this proposed step is work inside a project drawing on its question, and you have not joined one. Nothing was written." };
  }

  /** R24: `stepAccept({proposal, form, work?, project?, reason?, by})`: a member takes a proposal up as proposed, edited
   *  with her `work`, or sets it aside (`reason`) for her own step; the record keeps which (record-grammar R52). */
  stepAccept({ proposal = null, form = null, work = null, project = null, reason = null, by = null } = {}) {
    const a = this.#actor(by);
    if (a && a.machine) return refuse("STEP_MEMBER_ONLY", "accepting a proposed step is a member's act");
    const pr = Number.isSafeInteger(Number(proposal)) && proposal !== null && proposal !== "" ? this.#one(`SELECT * FROM step_proposals WHERE proposal_id = ?`, Number(proposal)) : null;
    if (!a || !this.#proposalSeen(pr, a.viewer)) return refuse("NO_SUCH_STEP_PROPOSAL", "no proposed step by that id is held that you may see", { proposal: proposal ?? null });
    if (pr.status !== "proposed") return refuse("STEP_PROPOSAL_DECIDED", `this proposal was ${pr.status === "accepted" ? "taken up" : "set aside"}`, { proposal: Number(pr.proposal_id) });
    if (!ACCEPTANCE_FORMS.includes(form)) return refuse("STEP_BAD_FORM", `the form is one of ${ACCEPTANCE_FORMS.join(", ")}`);
    const bad = this.#mayAccept(pr, a);
    if (bad) return bad;
    const words = form === "as_proposed" ? pr.work : work;
    if (!filled(words) || chars(words.trim()) > WORK_MAX) return refuse("STEP_NO_WORK", `the work is 1–${WORK_MAX} characters`);
    if (form === "own_instead" && (!filled(reason) || chars(reason) > REASON_MAX)) return refuse("STEP_BAD_TEXT", `say why it is set aside, in 1–${REASON_MAX} characters`);
    const place = pr.place_kind === "project" ? { project: pr.project_id } : pr.place_kind === "group" ? { group: true }
      : { questions: this.#proposalRefs(pr.proposal_id) };
    const at = this.#at();
    return this.#record.transact(() => {
      const made = this.#create({ place, work: words.trim(), byWhen: null, project, creator: { actor: a, viewer: a.viewer } });
      if (!made || made.ok !== true) return made;
      const acceptance = acceptanceRecord({ proposal: String(pr.proposal_id), form, by: a.by, at, kind: "step" });
      this.#sql.exec(`UPDATE step_proposals SET status = ?, form = ?, step_id = ?, reason = ?, decided_by = ?, decided_at = ? WHERE proposal_id = ?`,
        form === "own_instead" ? "set_aside" : "accepted", form, made.step, form === "own_instead" ? reason.trim() : null, a.member, at, Number(pr.proposal_id));
      return { ok: true, proposal: Number(pr.proposal_id), form, step: made.step, acceptance, at, alike: made.alike };
    });
  }

  /** R26: `acceptanceCounts()`: group-wide only, how many proposals were accepted in each form, naming no one. */
  acceptanceCounts() {
    const out = { as_proposed: 0, edited: 0, own_instead: 0 };
    try {
      for (const r of this.#rows(`SELECT form, COUNT(*) AS n FROM step_proposals WHERE form IS NOT NULL GROUP BY form`))
        if (Object.hasOwn(out, r.form)) out[r.form] = Number(r.n);
    } catch { /* an unreadable table counts nothing */ }
    return out;
  }

  /* ---- registrations' answers (R18) ---- */

  /** R18 (observation-log R13): a row of authority kind `step` is visible when the viewer sees the step; a step not
   *  held withholds the row. */
  resolveStepAuthority(authority, viewer) {
    try { const row = this.#held(authority); return !!row && this.#seen(row, viewer); } catch { return false; }
  }

  /** R18 (promotion R39): no leg's target is a step, refused inside `BASIS_REFUSED` as `STEP_NOT_A_LEG`. */
  check(c) {
    if (!isObj(c) || !isObj(c.docFm) || !Array.isArray(c.docFm.basis)) return null;
    const findings = [];
    c.docFm.basis.forEach((leg, ord) => {
      const target = isObj(leg) && typeof leg.target === "string" ? leg.target.trim() : null;
      if (target && isStepId(target))
        findings.push({ ...finding("STEP_NOT_A_LEG", localize("steps.index.basis_ord_rests_on_target", "basis[{ord}] rests on {target}, a step: a step is never evidence (D33)", { ord: String(ord), target: String(target) })), ord, target });
    });
    return findings.length ? { ok: false, reason: "BASIS_REFUSED", findings, detail: "a leg rests on a step, which is never evidence. Nothing was written." } : null;
  }
}
