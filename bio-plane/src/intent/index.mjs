/* intent — what the group is trying to achieve, turned into checkable work (requirements: `build/requirements/intent.md`;
 * Content Framework §12). Aspirations (standing, never close, set priority), goals (bounded pursuits that close) and
 * objectives (a project's aim, with a satisfaction condition the record is measured against). Progress on an objective
 * is computed from the record on every read and never stored or reported (R19); its gaps are the work list. Unasked-
 * for findings arrive as proposals, and only a member's act adopts one, sets it aside with a recorded reason, or (a
 * machine too) opens a question from it (the discovery loop).
 *
 * A new module (K102): C-2.9's objective arm was extracted from `legacy-checks` (`checkProjectExtension`) as R1 here,
 * run at the write as a registered promotion check and in the audit as a registered audit check, so neither loses it
 * (R22); C-2.9's `closed_reason` arm followed in T19 (R29) as this module's grammar (`./grammar.mjs`), registered with
 * record-core's grammar seam in record-grammar's `checkProjectExtension` slot (its `workproduct_state` and
 * `evaluations` arms and C-9.1 retired, K899 (3)). Aspirations and goals are record
 * documents of their own types (R26, `./doc.mjs`), written through `promotion` like every other record object, with
 * history, the gate and authored revisions; this module's
 * registered check holds their state machines (`held → retired`, `open → closed`) and who may write them.
 *
 * REACHED as `intentOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps` and returned to every later caller. At creation it registers its check with `promotion` (R39), its
 * audit check with `record-core` (R59), its tables with purge (R24) and its project grammar with record-core's grammar
 * seam (R29, `./grammar.mjs`). `deps`:
 *   record, membership, promotion, entities   the modules it uses, through their factories on the same host unless a
 *                test passes its own.
 *   progressions through its factory on the same host, reached on first use (N179: the plane's own instance, built
 *                with the plane's `env`, is the one read), unless a test passes its own.
 *   inquiry      `dispose` (R17) and `personFacts` (R32: the record's facts for the persons a text names, which
 *                inquiry's pure `personWarning`, its R59, judges); aiRuns `open` (R18); retrieval `selectionCreate` (R17: inquiry's dispose takes a
 *                selection, K198); captureRequests `requestById`, one request's outcome by key (R14, its R43; N291),
 *                and `captureRequests` and `bundlesOf`, a request's address and target (R28). Each through its
 *                factory on the same host, reached lazily on first use, unless a test passes its own.
 *   money        `moneyOf` and `summable` (R31: the `amount` filter over a matched instance's money facts), through
 *                its factory on the same host, reached lazily on first use, unless a test passes its own.
 *   now          the module's clock, an ISO instant (default: the wall clock). */

import { isMachineIdentity, normalizeType } from "../record-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, noSuchProject, notAnAdmin } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { entitiesOf, gradeRank, noSuchEntity } from "../entities/index.mjs";
import { progressionsOf } from "../progressions/index.mjs";
import { inquiryOf, personWarning } from "../inquiry/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { captureRequestsOf } from "../capture-requests/index.mjs";
import { moneyOf, kinds as moneyKinds, phases as moneyPhases, LIST_LIMIT_MAX as MONEY_LIST_MAX } from "../money/index.mjs";
import { add } from "../calc-grammar/index.mjs";
import { dec, cmpD, readingOf } from "../calc-grammar/decimal.mjs";
import { INTENT_CHECKS, refusal } from "./checks.mjs";
import { INTENT_TABLES, migrateIntent } from "./schema.mjs";
import { registerProjectGrammar } from "./grammar.mjs";
import { ASPIRATION, GOAL, ASPIRATION_SCOPES, GRADES, TOKEN, quotable, q, parseFm, setField, removeBlock, setBlock,
         appendItem, appendHistory, readSection, setSection, appendSection, logEntry, deadEndsOf, aspirationDoc,
         goalDoc, pursuitId, CONDITION_KEY, AMOUNT_PERIOD_FIELDS, conditionLines, conditionOf } from "./doc.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { INTENT_CHECKS } from "./checks.mjs";
export { INTENT_SCHEMA, INTENT_TABLES } from "./schema.mjs";
export { ASPIRATION_SCOPES } from "./doc.mjs";
export { PROJECT_GRAMMAR, CLOSED_REASONS, checkProjectExtension, registerProjectGrammar } from "./grammar.mjs";

/** R9 (N327, DEC-83): the group aspiration's fixed act, and its next step, for `membership.notAnAdmin` (its R84), which
 *  answers `NOT_AN_ADMIN` in place of the retired `GROUP_ASPIRATION_NOT_ADMIN` (C-111.16, its number not reused). */
export const GROUP_ASPIRATION_ACT = localize("intent.index.declaring_revising_retiring_group_aspiration",
  "declaring, revising or retiring an aspiration the whole team holds");
export const GROUP_ASPIRATION_REMEDY = word("intent.ask_active_administrator");
/** R9: an aspiration names one scope, and an owner unless it is the team's; `refuseBadScope` answers the others. */
const ASPIRATION_SCOPE_NAMED = localize("intent.index.aspiration_scope_named",
  "an aspiration is the team's (naming no owner), a project's or a member's (naming which). Nothing was written.");
/** R16: the four acts on a proposal. */
export const TRIAGE_ACTS = Object.freeze(["adopt", "question", "defer", "dismiss"]);
/** R17 (Suggestions): the ageing interval's setting in record-core, and its default in days (C-10.1's staleness age). */
export const AGEING_SETTING = "intent_ageing_days", AGEING_DEFAULT_DAYS = 30;
/** R17: the plane actor the ageing act is taken under, and the machine sight it selects and disposes with (a scheduler's
 *  tick has no member behind it; membership R43 lets a machine credential see every bundle). */
export const PLANE_ACTOR = "plane:intent", PLANE_VIEWER = "class:daemon";
/** R6: the kind a gap is offered as (`queue`'s vocabulary, D-76). */
export const GAP_KIND = "objective-gap";
/** R16: a reason's bound, the restricted grammar's edge reason (a reason may travel into a document's front matter). */
export const REASON_MAX = 160;
/** R33: the words stated beside a required stage met by a records request answered that no such record exists. */
export const NONE_EXISTS_SAYS = word("intent.answered_none_exists");
/** R32: the most entities an adopted proposal's warning asks about (its basis's entity and its instances'), the cap on
 *  persons one warning names elsewhere (K1881's 20). */
export const WARNING_SUBJECTS_MAX = 20;
/** N181: the bound on each read that grows with the record, published in each answer that it can cut, and read one
 *  past so a cut says so. MEASURE_MAX: the instances one condition measures (R4); WATCH_LIMIT_MAX: the captures one
 *  page of `watchSet` answers (R7), followed with its cursor; DEPARTURES_MAX: one project's departures in force (R10);
 *  GOALS_MAX, TRIAGED_MAX: the goals and triage acts one pursuit record answers (R14); SET_ASIDE_MAX: the proposals
 *  set aside that `proposals` lists beside the open ones, newest first (R16); SERVES_MAX: the subjects one `servesOf`
 *  call answers (R28); ASPIRATIONS_MAX: the held aspirations `aspirationsFor` reads and `contacts` pairs, the first in
 *  id order (R12, R13; N209, K338); CONTACTS_MAX: the pairs `contacts` lists (R13). N305 (K367), the internal reads:
 *  CONTEXT_MAX: the held aspirations in force one `servesOf` call measures against, and the projects it walks for
 *  those with a condition, each the first in id order (R28; K391); PROJECTS_MAX: the projects `proposals` reads with no project named, the first in id
 *  order (R15); REQUESTS_MAX: the capture requests one pursuit record reads, in the order the basis names them (R14).
 *  N323 (K408): GOALS_READ_MAX: the goals one pursuit record reads to find the aspiration's, the first in id order
 *  whatever aspiration each names (R14); AGEING_READ_MAX: the questions at `surfaced` the ageing reads judge, those whose
 *  last entry is oldest first (R17, R27). ASPIRATIONS_MAX and CONTEXT_MAX count every aspiration read, held or retired,
 *  of any scope (R12, R13, R28). */
/** R31: the money facts one instance's `amount` filter reads, money's own ceiling on `moneyOf` (its R9); a read it cuts
 *  makes the instance undetermined, never totalled short. */
export const AMOUNT_FACTS_MAX = MONEY_LIST_MAX;
export const MEASURE_MAX = 1000, WATCH_LIMIT_MAX = 1000, DEPARTURES_MAX = 1000, GOALS_MAX = 200, TRIAGED_MAX = 1000,
             SET_ASIDE_MAX = 200, SERVES_MAX = 1000, ASPIRATIONS_MAX = 1000, CONTACTS_MAX = 1000, CONTEXT_MAX = 1000,
             PROJECTS_MAX = 1000, REQUESTS_MAX = 1000, GOALS_READ_MAX = 1000, AGEING_READ_MAX = 1000;

/* R17, R27: the distinct authors of one question read per statement (`#machineOnly`). */
const AUTHORS_PAGE = 64;
const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
/* An empty author is a machine's: nothing a person did (R2's "an empty or machine author"). */
const machine = (who) => !str(who) || isMachineIdentity(str(who));
const second = (iso) => String(iso).replace(/\.\d+Z$/, "Z");
/* R2, R18 (DEC-88): a member's reason, their own words, trimmed; null when absent, not a string or blank. Unbounded, as
   R8's is (K1030). */
const reasonOf = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
/* A member's own words kept whole in a body section: a line that would open a heading is set in by one space. */
const bodyText = (s) => String(s).trim().replace(/^#/gm, " #");

export class Intent {
  #sources = new Map();   // kind -> reader (R15)
  #noneExists = null;     // R33: the reader of records requests answered that no such record exists

  constructor({ storage, record, membership, promotion, entities, progressions, inquiry = null, aiRuns = null,
                retrieval = null, captureRequests = null, money = null, now = null } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.entities = entities;
    this.progressionsRef = progressions;
    this.inquiryRef = inquiry;
    this.aiRunsRef = aiRuns;
    this.retrievalRef = retrieval;
    this.captureRequests = captureRequests;
    this.moneyRef = money;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  #rows(qs, ...a) { return [...this.sql.exec(qs, ...a)]; }
  #one(qs, ...a) { const r = this.#rows(qs, ...a); return r.length ? r[0] : null; }
  #lazy(ref) { return typeof ref === "function" ? ref() : ref; }
  /* N179: progressions as the host holds it, reached on first use, so the instance the plane builds with its `env`
     (progressions R16's configured clock) is the one read here, whichever module reached the host first. */
  get progressions() { return this.#lazy(this.progressionsRef); }
  get money() { return this.#lazy(this.moneyRef); }
  #when() { return second(this.now()); }

  /** The module's tables (R24). */
  migrate() { migrateIntent(this.sql); }

  /* ===================================================================== *
   * READING THE RECORD
   * ===================================================================== */

  /* A held document: its head, text and front matter; null when the bundle is not held. */
  #doc(id) {
    if (typeof id !== "string" || !id) return null;
    const head = this.record.head(id);
    if (!head) return null;
    const f = this.record.readFile(id, "bundle.md");
    const text = f && typeof f.text === "string" ? f.text : null;
    return { id, head, text, fm: parseFm(text) || {}, type: normalizeType(head.type) };
  }

  /* R23: a project the viewer may see, or the one answer an absent project gets. A viewer who sees the project at
     existence only is told so (membership R77, C-70.1), before the absent answer. */
  #project(projectId, viewer) {
    const d = this.#doc(projectId);
    if (d && d.type === "project" && viewer !== null && viewer !== undefined) {
      const seen = this.membership.existenceAct(projectId, viewer);
      if (seen) return { refused: seen };
    }
    if (!d || d.type !== "project" || (viewer !== null && viewer !== undefined && !this.membership.inSight(projectId, viewer)))
      return { refused: noSuchProject(typeof projectId === "string" ? projectId : null) };
    return { doc: d };
  }

  /* An aspiration or goal the viewer may see (R8: absent and unseen are one answer). A project's aspiration is that
     project's material: it is seen only by a viewer who sees the project it names (R23, N199), whatever the
     aspiration's own bundle answers; the group's and a member's are seen by every member (R9). */
  #pursuit(id, type, viewer) {
    const d = this.#doc(id);
    const who = viewer ?? null;
    if (!d || d.type !== type || (who !== null && !this.membership.inSight(id, who))) return null;
    if (who !== null && type === ASPIRATION && d.fm.scope === "project" && this.#project(d.fm.owner, who).refused)
      return null;
    return d;
  }

  /* The member id behind an author (membership R76), null for a machine; the founder's session is `admin` (R9: an
     administrator's act, the founder included). */
  #memberOf(author) {
    if (str(author) === "admin") return "admin";
    return this.membership.positionalMember(str(author), str(author));
  }

  /* ===================================================================== *
   * THE WRITE (R2, R8–R11, R16, R26): every document intent writes goes through `promotion`, whose check runs this
   * module's own (below), so an act and a raw promotion meet one rule.
   * ===================================================================== */

  #create(id, type, text, author, extra = {}) {
    const fm = parseFm(text) || {};
    return this.promotion.promote({ bundleId: id, base: null, snapKey: `${this.#when().replace(/[-:]/g, "")}_${rand(4)}`,
      author, files: [{ path: "bundle.md", text }],
      meta: { object_type: type, title: fm.title, current_state: fm.current_state, created: fm.created,
              last_updated: fm.last_updated }, ...extra });
  }

  #revise(d, text, author, viewer, extra = {}) {
    const fm = parseFm(text) || {};
    const carried = this.record.livePaths(d.id).filter((p) => p !== "bundle.md").map((path) => {
      const f = this.record.readFile(d.id, path);
      return typeof f.text === "string" ? { path, text: f.text, sha256: f.sha256 }
                                        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes };
    });
    const member = this.#memberOf(author);
    return this.promotion.promote({ bundleId: d.id, base: d.head.bundleSha,
      snapKey: `${this.#when().replace(/[-:]/g, "")}_${rand(4)}`, author,
      files: [{ path: "bundle.md", text }, ...carried],
      meta: { object_type: d.type, title: fm.title, current_state: fm.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: fm.last_updated },
      actorIdentity: author, actorViewer: viewer ?? author, actorMemberId: member, ...extra });
  }

  /* ===================================================================== *
   * THE REGISTERED CHECK (promotion R39): R1, R2's grammar, R9's authority and R26's state machines, at the write.
   * ===================================================================== */

  check(c) {
    const type = c.promotedType;
    if (type === "project" && !c.replay) return this.#checkProject(c);
    if (type === ASPIRATION || type === GOAL) return this.#checkPursuit(c, type);
    return null;
  }

  #checkProject(c) {
    const fm = c.docFm || {};
    const heldFm = c.head ? parseFm(this.record.readFile(c.bundleId, "bundle.md")?.text) || {} : null;
    /* R32: the objective and condition as held before this write, for the projection to tell a statement or revision
       of either from one left alone (by projection time the record holds the new bytes) */
    if (c.state && c.state.intent)
      Object.assign(c.state.intent, { priorObjective: heldFm ? str(heldFm.objective) : null,
                                      priorCondition: heldFm ? conditionOf(heldFm)?.condition ?? null : null });
    /* R1, C-2.9's objective arm (K6): moved from the catalogue, the id unchanged. */
    /* DEC-49 REGION is-objective-stated */
    if (typeof fm.objective !== "string" || fm.objective.trim() === "")
      return refusal("NO_OBJECTIVE", "this project's document states no objective, or an empty one (C-2.9). A project "
                     + "says what it is trying to achieve. Nothing was written.");
    /* END DEC-49 REGION is-objective-stated */
    /* R2's grammar, asked when the condition changes (Suggestions): a condition carried unchanged was judged when set. */
    const now = conditionOf(fm);
    const held = heldFm ? conditionOf(heldFm) : null;
    if (now && JSON.stringify(now.condition) !== JSON.stringify(held ? held.condition : null))
      return this.#conditionRefusal(now.condition);
    return null;
  }

  #checkPursuit(c, type) {
    const fm = c.docFm || {};
    const author = c.author;
    const who = this.#memberOf(author);
    /* R20: an assistant proposes at any point and declares, revises, closes or retires at none. */
    const notMember = type === GOAL ? goalMachineRefusal(author, !!who) : aspirationMachineRefusal(author, !!who);
    if (notMember) return notMember;
    /* R26: the state machine. A creation starts at the first state; a revision moves only forward, once. */
    const [first, last] = type === GOAL ? ["open", "closed"] : ["held", "retired"];
    const from = c.head ? c.head.currentState : null, to = c.promotedState;
    const legal = c.head ? (to === from || (from === first && to === last)) : to === first;
    /* DEC-49 REGION is-pursuit-state-move */
    if (!legal)
      return refusal("PURSUIT_STATE_MOVE_UNDECLARED",
        `a ${type} ${c.head ? `at '${from}' moves only to '${last}', once` : `is created '${first}'`}, and this `
        + `promotion names '${String(to).slice(0, 40)}'. Nothing was written.`,
        { object_type: type, from, to: to ?? null });
    /* END DEC-49 REGION is-pursuit-state-move */
    const text = typeof c.bundleMd?.text === "string" ? c.bundleMd.text : "";
    if (!readSection(text, "Statement") || (type === GOAL && !readSection(text, "Bounds")))
      return refusePursuitUnstated(`a ${type} states ${type === GOAL ? "what it pursues and its bounds" : "what it holds to"}, `
                     + "in its Statement section. Nothing was written.");
    if (type === GOAL) {
      if (to === "closed" && from !== "closed" && !readSection(text, word("intent.closed")))
        return refuseNoReason("a goal is closed with the reason it closed. Nothing was written.");
      return null;
    }
    if (to === "retired" && from !== "retired" && !readSection(text, "Taught"))
      return refuseNoLesson("retiring an aspiration records what pursuing it taught. Nothing was written.");
    /* R9: who may write it, by its scope (its creation's, which a revision keeps). */
    const heldFm = c.head ? parseFm(this.record.readFile(c.bundleId, "bundle.md")?.text) || {} : fm;
    if (c.head && (fm.scope !== heldFm.scope || String(fm.owner ?? null) !== String(heldFm.owner ?? null)))
      return refuseBadScope("an aspiration keeps the scope and owner it was declared with. Nothing was written.");
    return this.#aspirationAuthority(heldFm.scope, heldFm.owner ?? null, author, c.pkg?.actorViewer ?? author);
  }

  /* R9: a member's aspiration is that member's; a project's, a member joined in it; the group's, an active administrator's
     (the founder included), anyone else answered through membership's `notAnAdmin` with the next step (N327). */
  #aspirationAuthority(scope, owner, author, viewer) {
    const who = this.#memberOf(author);
    if (!ASPIRATION_SCOPES.includes(scope) || (scope !== "group" && !str(owner)) || (scope === "group" && owner != null))
      return refuseBadScope(ASPIRATION_SCOPE_NAMED, { scope: scope ?? null, scopes: ASPIRATION_SCOPES });
    if (scope === "member" && str(owner) !== who)
      /* DEC-49 REGION is-aspiration-yours */
      return refusal("NOT_YOURS", localize("intent.index.a_members_aspiration_is_declared", "a member's aspiration is declared, revised and retired by that member alone. Nothing was written."), { owner });
      /* END DEC-49 REGION is-aspiration-yours */
    if (scope === "project") {
      const p = this.#project(owner, viewer);
      if (p.refused) return p.refused;
      const denied = this.membership.projectAuthority(owner, author, "joined", "aspiration");
      if (denied) return denied;
    }
    /* R9 through membership R84 (N327) */
    if (scope === "group" && !this.membership.isAdministrator(who))
      return notAnAdmin(str(author) || null, GROUP_ASPIRATION_ACT, { remedy: GROUP_ASPIRATION_REMEDY });
    return null;
  }

  /* R2: the condition's shape, then what it names, in R2's order; null when it is readable and names what exists. */
  #conditionRefusal(c) {
    const shaped = isObj(c) && TOKEN.test(str(c.progression)) && TOKEN.test(str(c.entity))
      && (c.relation == null || (typeof c.relation === "string" && this.entities.relationKinds().includes(c.relation)))
      && (c.filter == null || (isObj(c.filter) && Object.entries(c.filter).every(([k, v]) => /^[a-z][a-z0-9_]{0,39}$/.test(k)
                                                                && (k === "amount" ? amountShape(v).ok : TOKEN.test(String(v))))))
      && isObj(c.required) && (c.required.stages == null || (Array.isArray(c.required.stages)
                                                               && c.required.stages.every((s) => TOKEN.test(String(s)))))
      && isObj(c.satisfied);
    /* DEC-49 REGION is-condition-shaped */
    if (!shaped)
      return refusal("CONDITION_UNREADABLE", localize("intent.index.condition_shape_unreadable",
                       "a condition is {shape}, each name a bare key or id; a filter's `amount` is {amount_shape}, with at least one bound, each an exact decimal. Nothing was written.",
                       { shape: "{progression, entity, relation?, filter?, required: {grade?, stages?}, satisfied: {share}}",
                         amount_shape: "{min?, max?, currency, kinds?, phases?, period?}" }),
                     amountFault(c));
    /* END DEC-49 REGION is-condition-shaped */
    const def = this.progressions.readProgression({ progressionKey: str(c.progression) });
    if (!def || def.ok === false || !def.found)
      return refuseNoSuchProgression("the condition names a flow the record has not declared. Nothing was written.",
                     { progression: str(c.progression) });
    /* N285: entities' one answer to this condition (its R36), in place of C-111.5 */
    if (!this.entities.has(str(c.entity))) return noSuchEntity(str(c.entity));
    const declared = new Set(def.stages.map((s) => s.stage_key));
    const bad = (c.required.stages || []).map(String).filter((s) => !declared.has(s));
    /* DEC-49 REGION is-condition-stage */
    if (bad.length)
      return refusal("INTENT_BAD_STAGE", `the flow '${str(c.progression)}' declares no stage ${bad.join(", ")}. Nothing was written.`,
                     { stages: bad, declared: [...declared] });
    /* END DEC-49 REGION is-condition-stage */
    /* DEC-49 REGION is-condition-grade */
    if (c.required.grade != null && !GRADES.includes(c.required.grade))
      return refusal("CONDITION_BAD_GRADE", "a required grade is one of A, B, C, D. Nothing was written.", { grades: GRADES });
    /* END DEC-49 REGION is-condition-grade */
    const share = c.satisfied.share;
    /* DEC-49 REGION is-condition-share */
    if (!Number.isInteger(share) || share < 1 || share > 100)
      return refusal("BAD_SHARE", "a share is a whole number from 1 to 100. Nothing was written.");
    /* END DEC-49 REGION is-condition-share */
    return null;
  }

  /** R32 (D13; promotion R39's projection): a promotion of a project that states its `objective` (its creation) or
   *  revises it, or sets or changes its condition, carries inquiry R59's warning when the objective's text, or the
   *  entity the condition names, names a person in no public role; never refused. The warning is recorded
   *  (`intent_person_warnings`) with her choice, `went_on` when the package says she saw it before the act
   *  (`personWarningSeen: true`), else `warned_at_act`; a machine's promotion records `pending`. A condition removed,
   *  or a revision leaving both alone, asks nothing. Never throws into the promotion: a test that cannot be read warns
   *  of nothing. */
  project(c) {
    try {
      if (!c || c.promotedType !== "project" || c.replay) return null;
      const fm = c.docFm || {};
      const prior = (c.state && c.state.intent) || {};
      const objective = str(fm.objective);
      const cond = conditionOf(fm)?.condition ?? null;
      const objectiveActed = !c.head || objective !== (prior.priorObjective ?? "");
      const conditionActed = !!cond && JSON.stringify(cond) !== JSON.stringify(prior.priorCondition ?? null);
      if (!objectiveActed && !conditionActed) return null;
      const author = str(c.author);
      const warning = this.#warningFor(objectiveActed ? objective : "", conditionActed ? [str(cond.entity)] : [], author);
      if (!warning) return null;
      const act = [objectiveActed ? "objective" : null, conditionActed ? "condition" : null].filter(Boolean).join("+");
      return { warning: this.#recordWarning(c.bundleId, act, null, warning, author, c.pkg && c.pkg.personWarningSeen) };
    } catch { return null; }
  }

  /* R32: inquiry R59's warning for `text` and the entities `subjects` names (each read as a subject, at most
     WARNING_SUBJECTS_MAX), over the record's facts for the persons named (`inquiry.personFacts`, read as `viewer`);
     null when they name none, or when the test cannot be asked (a warning, never a refusal). */
  #warningFor(text, subjects, viewer) {
    try {
      const inq = this.#lazy(this.inquiryRef);
      if (!inq || typeof inq.personFacts !== "function") return null;
      const who = machine(viewer) ? null : str(viewer);
      const facts = new Map();
      const ask = (t, subject) => {
        const got = inq.personFacts({ text: t, subject, viewer: who });
        for (const f of Array.isArray(got) ? got : []) if (isObj(f) && typeof f.entity_id === "string") facts.set(f.entity_id, f);
      };
      const named = [...new Set((subjects || []).map(str).filter(Boolean))].slice(0, WARNING_SUBJECTS_MAX);
      if (str(text) || named.length) ask(str(text), named[0] ?? null);
      for (const subject of named.slice(1)) ask("", subject);
      return personWarning({ text: str(text), entities: [...facts.values()], viewer: who }) ?? null;
    } catch { return null; }
  }

  /* R32: the warning recorded with her choice (`went_on` when she saw it before the act, else `warned_at_act`;
     `pending` for a machine), answered with the choice. */
  #recordWarning(project, act, proposalKey, warning, author, seen) {
    const choice = machine(author) ? "pending" : seen === true ? "went_on" : "warned_at_act";
    this.sql.exec(`INSERT INTO intent_person_warnings (project_id, act, proposal_key, persons, author, choice, at)
                   VALUES (?,?,?,?,?,?,?)`, project, act, proposalKey, JSON.stringify(warning.persons), author || null,
                  choice, this.#when());
    return { ...warning, act, choice };
  }

  /** record-core R59: C-2.9's objective arm in the audit, beside the grammar's `closed_reason` arm (R29), over the same image
   *  (R22). */
  auditCheck(image) {
    const md = image && image.files ? image.files.get("bundle.md") : null;
    const fm = parseFm(typeof md === "string" ? md : null);
    if (!fm || fm.object_type !== "project") return [];
    if (typeof fm.objective !== "string" || fm.objective.trim() === "")
      return [{ check: INTENT_CHECKS.NO_OBJECTIVE.check, code: "NO_OBJECTIVE", severity: "error",
                message: "objective is missing or empty" }];
    return [];
  }

  /* ===================================================================== *
   * THE OBJECTIVE (R2–R7)
   * ===================================================================== */

  /** R2: set, replace or (with a null condition) remove a project's satisfaction condition, as a new revision of the
   *  project's document through `promotion`, with the author's reason (DEC-88) carried on that revision's log entry;
   *  the earlier revision stays in history. */
  setCondition({ project, condition, reason, author, viewer = null, personWarningSeen = false } = {}) {
    /* DEC-49 REGION is-condition-member */
    if (machine(author))
      return refusal("MACHINE_CANNOT_SET_OBJECTIVE", localize("intent.index.objective_measure_member_act",
                     "setting or changing an objective's measure is a named member's act (DEC-24 rule 2). Nothing was written."));
    /* END DEC-49 REGION is-condition-member */
    const p = this.#project(project, viewer);
    if (p.refused) return p.refused;
    const denied = this.membership.projectAuthority(project, author, "joined", "setCondition");
    if (denied) return denied;
    /* R2 (DEC-88): why progress is measured this way, in the author's words; a removal too. Asked before the
       condition's shape, so nothing is written. */
    const why = reasonOf(reason);
    if (!why) return refuseNoReason(localize("intent.index.setting_changing_or_removing_an", "setting, changing or removing an objective's measure records why, in your own words. Nothing was written."));
    const c = condition == null ? null
      : { ...condition, required: isObj(condition.required) ? { grade: condition.required.grade ?? null,
                                                               stages: condition.required.stages ?? [] } : condition.required,
          relation: condition.relation ?? null, filter: condition.filter ?? null };
    if (c) { const bad = this.#conditionRefusal(c); if (bad) return bad; }
    /* R31: the amount filter held in its one written shape, so what is set reads back unchanged */
    if (c && isObj(c.filter) && "amount" in c.filter) c.filter = { ...c.filter, amount: amountShape(c.filter.amount).amount };
    const at = this.#when();
    let text = removeBlock(p.doc.text, CONDITION_KEY);
    if (c) text = setBlock(text, CONDITION_KEY, conditionLines(c, str(author), at, why));
    text = setField(text, "last_updated", q(at));
    text = logEntry(text, at, c ? word("intent.objective_condition_set") : word("intent.objective_condition_removed"), str(author),
                    `${c ? `the objective's satisfaction condition is ${JSON.stringify(c)}.` : "the objective states no condition."}`
                    + `\nReason: ${bodyText(why)}`);
    /* R32: the promotion carries inquiry R59's warning when the condition names a person in no public role */
    const r = this.#revise(p.doc, text, str(author), viewer, { personWarningSeen: personWarningSeen === true });
    if (!r.ok) return r;
    return { ok: true, project, condition: c, reason: why, set_by: str(author), at, bundleSha: r.bundleSha,
             ...(r.warning ? { warning: r.warning } : {}) };
  }

  /* The matched instances of a condition (R4), each assembled by progressions and judged; derived, never stored. */
  #measure(cond, viewer) {
    const key = str(cond.progression), anchor = str(cond.entity);
    const related = new Set([anchor]);
    if (cond.relation) {
      const e = this.entities.readEntity({ entityId: anchor });
      for (const r of (e && e.found && e.entity && e.entity.relations) || []) {
        if (r.relation !== cond.relation || r.withdrawn) continue;
        /* X stands in the relation to the condition's entity: an edge from X to it; `overlaps` reads both ways. */
        if (r.to_entity === anchor && r.from_entity) related.add(r.from_entity);
        else if (cond.relation === "overlaps" && r.from_entity === anchor && r.to_entity) related.add(r.to_entity);
      }
    }
    /* N181: the instances of the related entities only, at most MEASURE_MAX of them, read one past so a cut says so. */
    const rows = this.#rows(`SELECT DISTINCT entity_id FROM progression_instances WHERE progression_key=?
                               AND entity_id IN (SELECT value FROM json_each(?)) ORDER BY entity_id LIMIT ?`,
                            key, JSON.stringify([...related]), MEASURE_MAX + 1);
    const truncated = rows.length > MEASURE_MAX;
    const threaded = rows.slice(0, MEASURE_MAX).map((r) => r.entity_id);
    const need = cond.required || {};
    const stages = (need.stages || []).map(String);
    const matched = [], meeting = [], short = [], undetermined = [];
    for (const eid of threaded) {
      const inst = this.progressions.readInstance({ progressionKey: key, entityId: eid, viewer });
      if (!inst || inst.ok === false || !inst.found) continue;
      /* The filter: what the record can evaluate narrows; what it cannot makes the instance undetermined (R4). The
         keys it evaluates are `entity_kind` and `amount` (R31), the money read only once the kind has passed. */
      let unevaluable = null, passes = true, amount = null;
      const filter = isObj(cond.filter) ? cond.filter : {};
      for (const [k, v] of Object.entries(filter)) {
        if (k === "entity_kind") { if (!inst.entity || inst.entity.kind !== String(v)) passes = false; }
        else if (k !== "amount" && unevaluable === null)
          unevaluable = word("intent.record_cannot_evaluate", { key: String(k) });
      }
      if (passes && "amount" in filter) {
        amount = this.#amount(eid, filter.amount, viewer);
        if (amount.passes === false) passes = false;
        else if (amount.passes === null && unevaluable === null) unevaluable = word("intent.amount_filter_undetermined", { why: String(amount.why) });
      }
      if (!passes) continue;
      const row = { entity_id: eid, entity_label: inst.entity ? inst.entity.label : null,
                    grade: inst.grade ?? null, grade_determined: inst.grade_determined === true,
                    definition_version: inst.definition_version, ...(amount ? { amount } : {}) };
      matched.push(row);
      if (unevaluable) {
        undetermined.push({ ...row, why: unevaluable });
        continue;
      }
      const placed = new Set((inst.stages || []).filter((s) => s.present).map((s) => s.stage_key));
      /* R33 (H30 (1)): a required stage not placed is met when the record holds a records request for it answered
         that no such record exists, stated beside the instance; met is still computed from the record (R4). */
      const answered = [];
      for (const s of stages)
        if (!placed.has(s)) { const a = this.#noneExistsFor(key, eid, s, viewer); if (a) answered.push(a); }
      if (answered.length) row.none_exists = answered;
      const missing = stages.filter((s) => !placed.has(s) && !answered.some((a) => a.stage === s));
      /* R4 (K200): a missing required stage is short whatever the grade; the grade decides only once the stages are in. */
      if (missing.length) {
        short.push({ ...row, why: { stages_missing: missing }, documents: this.#documents(inst) });
        continue;
      }
      if (need.grade == null) { meeting.push(row); continue; }
      if (!row.grade_determined || gradeRank[row.grade] === undefined) {
        undetermined.push({ ...row, why: word("intent.why.instance_grade_undetermined") });
        continue;
      }
      if (gradeRank[row.grade] >= gradeRank[need.grade]) { meeting.push(row); continue; }
      const weakest = (inst.chain || []).find((l) => l.grade === inst.grade) || null;
      short.push({ ...row, why: { grade_reached: inst.grade, grade_required: need.grade, weakest_link: weakest },
                   documents: this.#documents(inst) });
    }
    return { key, related: [...related].sort(), matched, meeting, short, undetermined, truncated };
  }

  /* R33: the first answer the registered reader gives for one stage of one instance, `{stage, action, ord, at, says}`,
     or null: none registered, an empty answer, or a reader that throws or answers otherwise meets no stage. */
  #noneExistsFor(progression, entity, stage, viewer) {
    if (!this.#noneExists) return null;
    let got;
    try { got = this.#noneExists({ progression, entity, stage, viewer: viewer ?? null }); } catch { return null; }
    const first = Array.isArray(got) ? got.find((x) => isObj(x) && typeof x.action === "string" && x.action) : null;
    if (!first) return null;
    return { stage, action: first.action, ord: first.ord ?? null, at: first.at ?? null, says: NONE_EXISTS_SAYS };
  }

  /** R33: `actions` registers, once at start (K31's pattern), its reader of records requests answered that no such
   *  record exists: `reader({progression, entity, stage, viewer})` → `[{action, ord, at}]`. With none registered, or
   *  one answering `[]`, no stage is met this way. */
  registerNoneExistsReader(reader) {
    if (typeof reader !== "function")
      /* DEC-49 REGION is-none-exists-shaped */
      return refusal("NONE_EXISTS_READER_MALFORMED", "the reader of records requests answered that no such record exists "
                     + "is a function of {progression, entity, stage, viewer}.");
      /* END DEC-49 REGION is-none-exists-shaped */
    /* DEC-49 REGION is-none-exists-once */
    if (this.#noneExists)
      return refusal("NONE_EXISTS_READER_DECLARED", "the reader of records requests answered that no such record exists "
                     + "is already registered.");
    /* END DEC-49 REGION is-none-exists-once */
    this.#noneExists = reader;
    return { ok: true };
  }

  /* R5: the documents placed at each stage, with bundle ids the viewer may not see withheld (progressions R13). */
  #documents(inst) {
    return (inst.stages || []).filter((s) => s.present)
      .map((s) => ({ stage_key: s.stage_key, documents: (s.documents || []).map((d) => ({ capture_sha: d.capture_sha,
                                                                                       bundle_id: d.bundle_id ?? null,
                                                                                       grade: d.grade ?? null })) }));
  }

  /* R31: one matched instance's `amount` filter, over the money facts `moneyOf` answers for its entity in the named
     kinds, phases and period, totalled in calc-grammar's exact decimals and compared with the bounds, inclusive.
     `passes` is true when the total's reading lies within them, false when it lies outside, and null with why when it
     cannot be settled: a total `summable` refuses, a fact whose period is undetermined, a read `moneyOf` cuts or
     refuses, a currency other than the filter's, an approximate total or a reading across a bound, or no fact held
     (never counted as zero). The total is taken under the plane's sight, so every reader's counts are the same (R5); a
     fact the viewer may not see is listed as null. Derived on read, never stored (R19). */
  #amount(entityId, amount, viewer) {
    const a = amountShape(amount).amount;
    const base = { currency: a.currency, min: a.min ?? null, max: a.max ?? null, total: null, facts: [] };
    const open = (why, extra = {}) => ({ ...base, ...extra, passes: null, why });
    const ask = { entity: entityId, kinds: a.kinds, phases: a.phases, ...(a.period ? { period: a.period } : {}),
                  limit: AMOUNT_FACTS_MAX };
    let read;
    try { read = this.money.moneyOf({ ...ask, viewer: PLANE_VIEWER }); }
    catch (e) { return open(word("intent.money_answer", { entry: String(String(e && e.message || e).slice(0, 120)) })); }
    if (!read || read.ok === false)
      return open(word("intent.money_refuses_read", { read: String(read ? read.reason : "no answer"), read_2: String(read && read.detail ? `: ${read.detail}` : "") }),
                  read && read.reason ? { code: read.reason } : {});
    const ids = (read.facts || []).map((f) => f.fact_id);
    const shown = this.#factsSeen(ask, ids, viewer);
    if (read.truncated)
      return open(word("intent.money_facts_answer", { amount_facts_max: String(AMOUNT_FACTS_MAX) }),
                  { facts: shown });
    if ((read.undetermined || []).length)
      return open(word("intent.money_fact_state", { undetermined: String(read.undetermined.length) }), { facts: shown });
    if (!ids.length)
      return open(word("intent.record_holds_money"));
    let sum;
    try { sum = this.money.summable({ factIds: ids, viewer: PLANE_VIEWER }); }
    catch (e) { return open(word("intent.money_answer", { entry: String(String(e && e.message || e).slice(0, 120)) }), { facts: shown }); }
    if (!sum || sum.ok !== true)
      return open(word("intent.facts_summed", { sum: String(sum ? sum.reason : "no answer"), sum_2: String(sum && sum.detail ? `: ${sum.detail}` : "") }),
                  { facts: shown, ...(sum && sum.reason ? { code: sum.reason } : {}) });
    let total = null;
    for (const f of read.facts) {
      const fig = figureOfFact(f);
      total = total === null ? fig : add(total, fig);
      if (total && total.refused) return open(word("intent.facts_amounts_add", { refused: String(total.refused), why: String(total.why) }), { facts: shown });
    }
    const out = { ...base, total, facts: shown };
    if (total.currency !== a.currency)
      return open(word("intent.facts_filter_names", { currency: String(total.currency), currency_2: String(a.currency) }),
                  { total, facts: shown });
    if (total.approximate || total.precision === "approximate")
      return open(word("intent.total_approximate_approximate"), { total, facts: shown });
    const r = readingOf(total);
    const below = a.min != null ? [cmpD(r.hi, dec(a.min)) < 0, cmpD(r.lo, dec(a.min)) >= 0] : [false, true];
    const above = a.max != null ? [cmpD(r.lo, dec(a.max)) > 0, cmpD(r.hi, dec(a.max)) <= 0] : [false, true];
    if (below[0] || above[0]) return { ...out, passes: false };
    if (below[1] && above[1]) return { ...out, passes: true };
    return open(word("intent.total_reading_rounded"), { total, facts: shown });
  }

  /* R5, R31: the fact ids beside an instance, each null when the viewer may not see that fact. */
  #factsSeen(ask, ids, viewer) {
    if (viewer == null || viewer === PLANE_VIEWER || !ids.length) return ids;
    let seen;
    try { seen = this.money.moneyOf({ ...ask, viewer }); } catch { seen = null; }
    const visible = new Set([...((seen && seen.facts) || []), ...((seen && seen.undetermined) || [])].map((f) => f.fact_id));
    return ids.map((id) => (visible.has(id) ? id : null));
  }

  /** R3–R5: progress on a project's objective, derived on read against its condition and never stored. */
  progress({ project, viewer = null } = {}) {
    const p = this.#project(project, viewer);
    if (p.refused) return p.refused;
    const objective = typeof p.doc.fm.objective === "string" ? p.doc.fm.objective : null;
    const held = conditionOf(p.doc.fm);
    const computed_at = this.#when();
    if (!held)
      return { ok: true, project, objective, condition: null, computable: false,
               why: word("intent.why.progress_cannot_computed"),
               matched: null, meeting: null, short: null, undetermined: null, satisfied: null, computed_at };
    const bad = this.#conditionRefusal(held.condition);
    if (bad)
      return { ok: true, project, objective, condition: held.condition, computable: false,
               why: word("intent.why.progress_cannot_computed_condition", { reason: String(bad.reason) }),
               matched: null, meeting: null, short: null, undetermined: null, satisfied: null, computed_at };
    const m = this.#measure(held.condition, viewer);
    const n = m.matched.length, k = m.meeting.length, u = m.undetermined.length, share = held.condition.satisfied.share;
    /* R4: reached, cannot be reached even if every undetermined instance met it, or not yet decidable. A measure cut at
       its bound (N181) decides nothing: the instances past the cut could move the share either way. */
    const satisfied = n === 0 || m.truncated ? null
      : k * 100 >= share * n ? true : (k + u) * 100 < share * n ? false : null;
    const why = n === 0 ? word("intent.instance_matches_condition")
      : m.truncated ? word("intent.instances_match_condition", { measure_max: String(MEASURE_MAX) }) : null;
    return { ok: true, project, objective, condition: held.condition, set_by: held.set_by, set_at: held.set_at,
             set_reason: held.set_reason,
             computable: true, matched: n, meeting: k, short: m.short, undetermined: m.undetermined, satisfied,
             ...(why ? { satisfied_why: why } : {}), limit: MEASURE_MAX, truncated: m.truncated,
             instances: { meeting: m.meeting }, computed_at };
  }

  /** R6: one gap per short instance, each a proposal of kind `objective-gap`. */
  gaps({ project, viewer = null } = {}) {
    const pr = this.progress({ project, viewer });
    if (pr.ok === false) return pr;
    if (!pr.computable) return { ok: true, project, condition: pr.condition, gaps: [], why: pr.why };
    return { ok: true, project, condition: pr.condition, gaps: pr.short.map((s) => this.#gap(project, pr.condition, s)),
             limit: pr.limit, truncated: pr.truncated };
  }

  #gap(project, cond, s) {
    const key = `${project}::${cond.progression}::${s.entity_id}`;
    const basis = s.why.stages_missing
      ? { project, progression: cond.progression, entity: s.entity_id, stages_missing: s.why.stages_missing,
          says: word("intent.says.records_stages_hold", { stages_missing: String(s.why.stages_missing.join(", ")) }),
          ...(s.none_exists ? { none_exists: s.none_exists } : {}) }
      : { project, progression: cond.progression, entity: s.entity_id, grade_reached: s.why.grade_reached,
          grade_required: s.why.grade_required, link: s.why.weakest_link,
          says: word("intent.says.weakest_link_instance") };
    return { key: `intent::${key}`, source: "intent", kind: GAP_KIND, grade: s.grade_determined ? s.grade : null, basis,
             instances: [{ entity_id: s.entity_id, entity_label: s.entity_label, documents: s.documents }],
             surfaced_by: "machine" };
  }

  /** R7: what the condition reads, so `monitoring` watches exactly those. The captures come a page at a time (N181):
   *  at most `limit` (default and ceiling WATCH_LIMIT_MAX), those after `after` in capture order, with `cursor` the
   *  last one answered and `truncated` whether more follow, so a watcher follows the whole set with the cursor. */
  watchSet({ project, after = null, limit = null } = {}) {
    const cap = Number.isInteger(limit) && limit >= 1 && limit <= WATCH_LIMIT_MAX ? limit : WATCH_LIMIT_MAX;
    const none = { entities: [], progressions: [], captures: [], limit: cap, truncated: false, cursor: null };
    const d = this.#doc(project);
    const held = d && d.type === "project" ? conditionOf(d.fm) : null;
    if (!held || this.#conditionRefusal(held.condition)) return none;
    const m = this.#measure(held.condition, null);
    const rows = this.#rows(`SELECT DISTINCT capture_sha FROM progression_instances WHERE progression_key=?
                               AND entity_id IN (SELECT value FROM json_each(?)) AND capture_sha > ?
                             ORDER BY capture_sha LIMIT ?`,
                            m.key, JSON.stringify(m.matched.map((r) => r.entity_id)), typeof after === "string" ? after : "",
                            cap + 1);
    const truncated = rows.length > cap;
    const captures = rows.slice(0, cap).map((r) => r.capture_sha);
    return { entities: m.related, progressions: [m.key], captures, limit: cap, truncated,
             cursor: truncated ? captures[captures.length - 1] : null, measure_truncated: m.truncated };
  }

  /* ===================================================================== *
   * WHAT A SUBJECT SERVES (R28), for `scheduler`'s rank (its R10): read as the plane, orders work only, never shown.
   * ===================================================================== */

  /** R28: for each named address, bundle and request (at most SERVES_MAX in all, the first in the order given, with
   *  `truncated`), the open gaps it serves in any project and the held aspirations in force for its project that it
   *  serves (member aspirations aside, §12.1). A subject serving nothing, or unknown, answers empty lists. What it
   *  measures against is bounded (N305, K391): `context_truncated` says the held aspirations or the projects walked
   *  for conditions were cut at CONTEXT_MAX. Writes nothing; never throws. */
  servesOf({ addresses = [], bundles = [], requests = [] } = {}) {
    const named = [];
    for (const [kind, list] of [["address", addresses], ["bundle", bundles], ["request", requests]])
      for (const id of Array.isArray(list) ? list : []) named.push({ kind, id: typeof id === "string" ? id : null });
    const truncated = named.length > SERVES_MAX;
    const subjects = named.slice(0, SERVES_MAX);
    const empty = (x) => ({ kind: x.kind, id: x.id, gaps: [], aspirations: [] });
    let ctx;
    try { ctx = this.#servesContext(); }
    catch { return { ok: true, serves: subjects.map(empty), truncated, context_truncated: false }; }
    const serves = subjects.map((x) => {
      try {
        if (!x.id) return empty(x);
        const held = x.kind === "bundle" ? [x.id] : x.kind === "address" ? this.#bundlesAt(x.id) : ctx.requestBundles(x.id);
        const gaps = new Set(), aspirations = new Set();
        for (const b of held) {
          for (const g of ctx.gapsOf(b)) gaps.add(g);
          for (const a of ctx.aspirationsOf(b)) aspirations.add(a);
        }
        return { kind: x.kind, id: x.id, gaps: [...gaps].sort(), aspirations: [...aspirations].sort() };
      } catch { return empty(x); }
    });
    return { ok: true, serves, truncated, context_truncated: ctx.cut };
  }

  /* R28: what every subject in one call is measured against, gathered once under the plane's sight: the open gaps by
     the bundles documenting their short instances, and each held group or project aspiration with what it names.
     N305 (K391): of the first CONTEXT_MAX projects in id order, those with a condition; and of the first CONTEXT_MAX
     aspirations in id order, held or retired and of any scope (N323), the held ones of group or project scope; `cut`
     says either walk was cut. */
  #servesContext() {
    const gapsByBundle = new Map();
    const all = [];
    const walked = this.#projectsInOrder(PLANE_VIEWER, CONTEXT_MAX);
    for (const pid of walked.ids) {
      const d = this.#doc(pid);
      if (!d || !conditionOf(d.fm)) continue;
      const g = this.gaps({ project: pid, viewer: PLANE_VIEWER });
      if (g.ok) all.push(...g.gaps);
    }
    const decided = this.#decidedAmong(all.map((g) => g.key));
    for (const g of all) {
      if (decided.has(g.key)) continue;
      for (const inst of g.instances || [])
        for (const stage of inst.documents || [])
          for (const d of stage.documents || [])
            if (d.bundle_id) {
              if (!gapsByBundle.has(d.bundle_id)) gapsByBundle.set(d.bundle_id, new Set());
              gapsByBundle.get(d.bundle_id).add(g.key);
            }
    }
    const inForce = this.#heldAspirations(PLANE_VIEWER, CONTEXT_MAX);
    const held = inForce.held.filter((a) => a.scope === "group" || a.scope === "project");
    const departures = new Map(), concerned = new Map(), requestsRead = { rows: null };
    const departed = (project) => {
      if (!departures.has(project)) departures.set(project, this.#departures(project).latest);
      return departures.get(project);
    };
    /* the bundles a named entity's documents are filed in (entities R15), once per entity per call */
    const concerns = (entityId) => {
      if (!concerned.has(entityId)) {
        const r = this.entities.concerns({ entityId, limit: 5000, viewer: PLANE_VIEWER });
        concerned.set(entityId, new Set(((r && r.documents) || []).map((d) => d.bundle_id).filter(Boolean)));
      }
      return concerned.get(entityId);
    };
    const placedIn = (bundleId, keys) => keys.length > 0 && !!this.#one(
      `SELECT 1 AS x FROM progression_instances WHERE bundle_id=? AND progression_key IN (SELECT value FROM json_each(?))
       LIMIT 1`, bundleId, JSON.stringify(keys));
    return {
      cut: walked.truncated || inForce.truncated,
      gapsOf: (bundleId) => gapsByBundle.get(bundleId) || [],
      /* R12's in force for the bundle's project (the group's less its departures, and the project's own); a bundle in
         no project is under the group's alone */
      aspirationsOf: (bundleId) => {
        const project = this.record.bundleInfo(bundleId)?.project ?? null;
        const gone = project ? departed(project) : new Map();
        return held.filter((a) => (a.scope === "group" ? !gone.has(a.id) : project !== null && a.owner === project))
          .filter((a) => placedIn(bundleId, a.progressions) || a.entities.some((e) => concerns(e).has(bundleId)))
          .map((a) => a.id);
      },
      /* a request serves what its address and its target question serve (capture-requests R23, R28) */
      requestBundles: (request) => {
        if (requestsRead.rows === null) {
          const read = this.#lazy(this.captureRequests).captureRequests({ viewer: PLANE_VIEWER, state: "requested",
                                                                          limit: 1000 });
          requestsRead.rows = new Map(((read && read.requests) || []).map((r) => [r.request, r]));
        }
        const row = requestsRead.rows.get(request);
        const b = this.#lazy(this.captureRequests).bundlesOf?.(request) ?? null;
        const target = (b && b.target) || (row && row.target) || null;
        return [...(row && row.address ? this.#bundlesAt(row.address) : []), ...(target ? [target] : [])];
      },
    };
  }

  /* R28: the bundles the captures taken from an address are filed in (provenance R48's read contract), at most
     SERVES_MAX of them. */
  #bundlesAt(address) {
    return this.#rows(`SELECT DISTINCT r.bundle_id FROM captured_locators c JOIN register r ON r.capture_sha = c.capture_sha
                        WHERE c.address_norm = ? OR c.address = ? ORDER BY r.bundle_id LIMIT ?`,
                      address, address, SERVES_MAX).map((r) => r.bundle_id).filter(Boolean);
  }

  /* ===================================================================== *
   * GOALS (R8, R26)
   * ===================================================================== */

  /** R8: declare a goal, bounded, optionally under an aspiration. */
  declareGoal({ statement, bounds, aspiration = null, author, viewer = null } = {}) {
    const byMachine = goalMachineRefusal(author);
    if (byMachine) return byMachine;
    if (!str(statement) || !str(bounds))
      return refusePursuitUnstated("a goal states what it pursues and what bounds it. Nothing was written.");
    if (aspiration != null && aspiration !== "") {
      const a = this.#pursuit(aspiration, ASPIRATION, viewer ?? author);
      if (!a) return refuseNoSuchAspiration("no aspiration answers to that id here. Nothing was written.",
                             { aspiration });
      if (a.head.currentState === "retired")
        return refusePursuitEnded("a goal is not opened under a retired aspiration. Nothing was written.", { aspiration });
    }
    const at = this.#when();
    const id = pursuitId(this.record.allocId("GOAL", at.slice(0, 4)).id, GOAL);
    const r = this.#create(id, GOAL, goalDoc({ id, statement, bounds, aspiration: aspiration || null, author: str(author), at }),
                           str(author));
    if (!r.ok) return r;
    return { ok: true, goal: id, state: "open", aspiration: aspiration || null, author: str(author), at };
  }

  /** R8: record that a project's objective serves a goal, as the author's dated claim; the author has joined it. */
  linkObjective({ goal, project, author, viewer = null } = {}) {
    const byMachine = goalMachineRefusal(author);
    if (byMachine) return byMachine;
    const g = this.#pursuit(goal, GOAL, viewer ?? author);
    if (!g) return refuseNoSuchGoal("no goal answers to that id here. Nothing was written.", { goal: goal ?? null });
    if (g.head.currentState === "closed")
      return refusePursuitEnded("a closed goal takes no new objective. Nothing was written.", { goal });
    const p = this.#project(project, viewer ?? author);
    if (p.refused) return p.refused;
    const denied = this.membership.projectAuthority(project, author, "joined", "linkObjective");
    if (denied) return denied;
    if ((Array.isArray(g.fm.objectives) ? g.fm.objectives : []).some((o) => isObj(o) && o.project === project))
      return { ok: true, goal, project, already: true };
    const at = this.#when();
    let text = appendItem(g.text, "objectives", { project, by: TOKEN.test(str(author)) ? str(author) : q(author), at: q(at) });
    text = setField(text, "last_updated", q(at));
    text = logEntry(text, at, "Objective linked", str(author), word("intent.objective_serves_goal", { project: String(project) }));
    const r = this.#revise(g, text, str(author), viewer);
    if (!r.ok) return r;
    return { ok: true, goal, project, by: str(author), at };
  }

  /** R8: close a goal with its reason; it stays readable with its objectives and reason. */
  closeGoal({ goal, reason, author, viewer = null } = {}) {
    const byMachine = goalMachineRefusal(author);
    if (byMachine) return byMachine;
    const g = this.#pursuit(goal, GOAL, viewer ?? author);
    if (!g) return refuseNoSuchGoal("no goal answers to that id here. Nothing was written.", { goal: goal ?? null });
    if (!str(reason)) return refuseNoReason("a goal is closed with the reason it closed. Nothing was written.");
    if (g.head.currentState === "closed")
      return refusePursuitEnded("this goal is already closed. Nothing was written.", { goal });
    const at = this.#when();
    let text = appendHistory(g.text, { at, from: "open", to: "closed", blurb: word("intent.blurb.closed_reason_document"),
                                       author: str(author) });
    text = setField(setField(setField(text, "prior_state", "open"), "current_state", "closed"), "last_updated", q(at));
    text = setSection(text, word("intent.closed"), bodyText(reason));
    text = logEntry(text, at, "Closed", str(author), word("intent.open_closed"));
    const r = this.#revise(g, text, str(author), viewer);
    if (!r.ok) return r;
    return { ok: true, goal, state: "closed", reason: str(reason), author: str(author), at };
  }

  /** R8: a goal as the record holds it: its statement, bounds, aspiration, the objectives linked (each a project the
   *  viewer may see), its state and, once closed, its reason. No progress figure: its objectives carry theirs. */
  readGoal({ goal, viewer = null } = {}) {
    const g = this.#pursuit(goal, GOAL, viewer);
    if (!g) return refuseNoSuchGoal("no goal answers to that id here.", { goal: goal ?? null });
    return { ok: true, goal: this.#goalView(g, viewer) };
  }

  #goalView(g, viewer) {
    const objectives = (Array.isArray(g.fm.objectives) ? g.fm.objectives : []).filter(isObj)
      .filter((o) => viewer == null || this.membership.inSight(o.project, viewer))
      .map((o) => ({ project: o.project, by: o.by ?? null, at: o.at ?? null }));
    /* R23 (N199): the aspiration pointer is shown only to a viewer who may see that aspiration; to any other it reads
       as a goal opened under none, the answer an absent one gets. */
    const asp = typeof g.fm.aspiration === "string" && g.fm.aspiration ? g.fm.aspiration : null;
    const aspiration = asp && (viewer == null || this.#pursuit(asp, ASPIRATION, viewer)) ? asp : null;
    return { id: g.id, statement: readSection(g.text, "Statement"), bounds: readSection(g.text, "Bounds"),
             aspiration, objectives, state: g.head.currentState,
             closed_reason: g.head.currentState === "closed" ? readSection(g.text, word("intent.closed")) : null,
             author: g.fm.author ?? null, at: g.fm.created ?? null };
  }

  /* ===================================================================== *
   * ASPIRATIONS (R9–R14, R26)
   * ===================================================================== */

  /** R9: declare an aspiration of the group, a project or a member. */
  declareAspiration({ scope, owner = null, statement, entities = [], progressions = [], author, viewer = null } = {}) {
    const byMachine = aspirationMachineRefusal(author);
    if (byMachine) return byMachine;
    const own = scope === "group" ? null : str(owner) || null;
    if (!ASPIRATION_SCOPES.includes(scope) || (scope !== "group" && !own) || (scope === "group" && str(owner)))
      return refuseBadScope(ASPIRATION_SCOPE_NAMED, { scope: scope ?? null, scopes: ASPIRATION_SCOPES });
    if (!str(statement)) return refusePursuitUnstated("an aspiration states what it holds to. Nothing was written.");
    const denied = this.#aspirationAuthority(scope, own, author, viewer ?? author);
    if (denied) return denied;
    const ents = (Array.isArray(entities) ? entities : []).map(str).filter(Boolean);
    const progs = (Array.isArray(progressions) ? progressions : []).map(str).filter(Boolean);
    const badEnt = ents.find((e) => !TOKEN.test(e) || !this.entities.has(e));
    if (badEnt) return noSuchEntity(badEnt);
    const badProg = progs.find((k) => { const d = TOKEN.test(k) && this.progressions.readProgression({ progressionKey: k });
                                        return !d || d.ok === false || !d.found; });
    if (badProg) return refuseNoSuchProgression("the aspiration names a flow the record has not declared. Nothing "
                                + "was written.", { progression: badProg });
    const at = this.#when();
    const id = pursuitId(this.record.allocId("ASP", at.slice(0, 4)).id, ASPIRATION);
    const r = this.#create(id, ASPIRATION, aspirationDoc({ id, scope, owner: own, statement, entities: ents,
                                                         progressions: progs, author: str(author), at }), str(author),
                           { actorViewer: viewer ?? str(author) });
    if (!r.ok) return r;
    return { ok: true, aspiration: id, scope, owner: own, state: "held", author: str(author), at };
  }

  /** R10: a project records its departure from a held group aspiration, with a reason. */
  departFrom({ project, aspiration, reason, author, viewer = null } = {}) {
    const byMachine = aspirationMachineRefusal(author);
    if (byMachine) return byMachine;
    const p = this.#project(project, viewer ?? author);
    if (p.refused) return p.refused;
    const a = this.#pursuit(aspiration, ASPIRATION, viewer ?? author);
    if (!a) return refuseNoSuchAspiration("no aspiration answers to that id here. Nothing was written.",
                           { aspiration: aspiration ?? null });
    if (a.fm.scope !== "group")
      return refuseBadScope(localize("intent.index.project_departs_group_only", "a project departs only from an aspiration the whole team holds; a project's or a member's own is not held by other projects. Nothing was written."), { scope: a.fm.scope ?? null });
    if (a.head.currentState === "retired")
      return refusePursuitEnded(localize("intent.index.a_retired_aspiration_is_held", "a retired aspiration is held by no project, so there is nothing to depart from. Nothing was written."), { aspiration });
    if (!str(reason)) return refuseNoReason(localize("intent.index.a_departure_from_the_teams", "a departure from the team's aspiration records why. Nothing was written."));
    const denied = this.membership.projectAuthority(project, author, "joined", "departFrom");
    if (denied) return denied;
    const at = this.#when();
    this.record.transact(() => this.sql.exec(
      `INSERT INTO intent_departures (project_id, aspiration_id, reason, author, at) VALUES (?,?,?,?,?)`,
      project, aspiration, str(reason).slice(0, 4000), str(author), at));
    return { ok: true, project, aspiration, reason: str(reason), author: str(author), at, notable: true };
  }

  /** R11: a dead end, appended to the aspiration's pursuit record, dated and authored, never removed. */
  recordDeadEnd({ aspiration, note, author, viewer = null } = {}) {
    const byMachine = aspirationMachineRefusal(author);
    if (byMachine) return byMachine;
    const a = this.#pursuit(aspiration, ASPIRATION, viewer ?? author);
    if (!a) return refuseNoSuchAspiration("no aspiration answers to that id here. Nothing was written.",
                           { aspiration: aspiration ?? null });
    /* DEC-49 REGION is-dead-end-noted */
    if (!str(note))
      return refusal("NO_NOTE", "a dead end records what was tried and why it went nowhere. Nothing was written.");
    /* END DEC-49 REGION is-dead-end-noted */
    const denied = this.#aspirationAuthority(a.fm.scope, a.fm.owner ?? null, author, viewer ?? author);
    if (denied) return denied;
    const at = this.#when();
    let text = appendSection(a.text, "Dead Ends",
                             `### ${at} | ${str(author)}\n${bodyText(note)}`);
    text = setField(text, "last_updated", q(at));
    text = logEntry(text, at, word("intent.dead_end_recorded"), str(author), word("intent.dead_end_appended"));
    const r = this.#revise(a, text, str(author), viewer);
    if (!r.ok) return r;
    return { ok: true, aspiration, note: str(note), author: str(author), at };
  }

  /** R11: retire an aspiration with what pursuing it taught; it and its pursuit record stay readable. */
  retireAspiration({ aspiration, taught, author, viewer = null } = {}) {
    const byMachine = aspirationMachineRefusal(author);
    if (byMachine) return byMachine;
    const a = this.#pursuit(aspiration, ASPIRATION, viewer ?? author);
    if (!a) return refuseNoSuchAspiration("no aspiration answers to that id here. Nothing was written.",
                           { aspiration: aspiration ?? null });
    if (a.head.currentState === "retired")
      return refusePursuitEnded("this aspiration is already retired. Nothing was written.", { aspiration });
    if (!str(taught))
      return refuseNoLesson("retiring an aspiration records what pursuing it taught. Nothing was written.");
    const denied = this.#aspirationAuthority(a.fm.scope, a.fm.owner ?? null, author, viewer ?? author);
    if (denied) return denied;
    const at = this.#when();
    let text = appendHistory(a.text, { at, from: "held", to: "retired", blurb: word("intent.blurb.retired_taught_document"),
                                       author: str(author) });
    text = setField(setField(setField(text, "prior_state", "held"), "current_state", "retired"), "last_updated", q(at));
    text = setSection(text, "Taught", bodyText(taught));
    text = logEntry(text, at, "Retired", str(author), word("intent.held_retired"));
    const r = this.#revise(a, text, str(author), viewer);
    if (!r.ok) return r;
    return { ok: true, aspiration, state: "retired", taught: str(taught), author: str(author), at };
  }

  /* R12, R13, R28 (N209, K338, N323): the first `max` aspirations the viewer may see, in id order, held or retired and
     of any scope, walked a page at a time and read one past so a cut says so; answers the held ones among them. An
     aspiration the viewer may not see (a project's, of a project hidden from the viewer) is skipped and never counted,
     so a cut says nothing of it (DEC-36, K391). The retired ones among them are answered beside (R37), each with what
     pursuing it taught and its dead ends. */
  #heldAspirations(viewer, max = ASPIRATIONS_MAX) {
    const out = [], gone = [];
    let after = "", read = 0, truncated = false;
    for (;;) {
      const page = this.record.listByType({ type: ASPIRATION, after, limit: 200 });
      for (const id of page.ids) {
        const a = this.#pursuit(id, ASPIRATION, viewer);
        if (!a) continue;
        if (read === max) { truncated = true; break; }
        read += 1;
        if (a.head.currentState === "held") out.push(this.#aspirationView(a));
        else if (a.head.currentState === "retired")
          gone.push({ ...this.#aspirationView(a), taught: readSection(a.text, "Taught"), dead_ends: deadEndsOf(a.text) });
      }
      if (truncated || page.ids.length < 200 || !page.cursor) break;
      after = page.cursor;
    }
    return { held: out, retired: gone, truncated };
  }

  #aspirationView(a) {
    const list = (v) => (Array.isArray(v) ? v.map(String).filter((x) => x !== "") : []);
    return { id: a.id, scope: a.fm.scope ?? null, owner: a.fm.owner ?? null, statement: readSection(a.text, "Statement"),
             entities: list(a.fm.entities), progressions: list(a.fm.progressions), state: a.head.currentState,
             author: a.fm.author ?? null, at: a.fm.created ?? null };
  }

  /* R10: the departure in force for each (project, aspiration): the latest recorded, at most DEPARTURES_MAX of them
     (N181), read one past so a cut says so. */
  #departures(project) {
    const rows = this.#rows(`SELECT d.aspiration_id, d.reason, d.author, d.at FROM intent_departures d
                              WHERE d.project_id=? AND d.seq = (SELECT MAX(x.seq) FROM intent_departures x
                                                                  WHERE x.project_id=d.project_id
                                                                    AND x.aspiration_id=d.aspiration_id)
                              ORDER BY d.seq LIMIT ?`, project, DEPARTURES_MAX + 1);
    const latest = new Map();
    for (const r of rows.slice(0, DEPARTURES_MAX))
      latest.set(r.aspiration_id, { aspiration: r.aspiration_id, reason: r.reason, author: r.author, at: r.at, notable: true });
    return { latest, truncated: rows.length > DEPARTURES_MAX };
  }

  /** R12: the aspirations in force for a project, a member, or (neither named) the group, each with its scope. The
   *  group's less any departure, each departure listed with its reason; no precedence is stated or implied. Those in
   *  force are taken among the first ASPIRATIONS_MAX aspirations the viewer may see, held or retired (N323). R37: with
   *  `retired: true` it lists instead the project's retired aspirations and the named member's own, in id order, each
   *  with `taught` and its `dead_ends`, over the same bounded read; the default read is unchanged. */
  aspirationsFor({ project = null, member = null, viewer = null, retired = false } = {}) {
    if (project != null && project !== "") {
      const p = this.#project(project, viewer);
      if (p.refused) return p.refused;
    }
    const { held, retired: gone, truncated } = this.#heldAspirations(viewer);
    if (retired === true)
      return { ok: true, project: project || null, member: member || null, retired: true,
               aspirations: gone.filter((a) => (project && a.scope === "project" && a.owner === project)
                                              || (member && a.scope === "member" && a.owner === str(member))),
               limit: ASPIRATIONS_MAX, truncated };
    const dep = project ? this.#departures(project) : { latest: new Map(), truncated: false };
    const departed = dep.latest;
    const group = held.filter((a) => a.scope === "group" && !departed.has(a.id));
    const own = project ? held.filter((a) => a.scope === "project" && a.owner === project) : [];
    const mine = member ? held.filter((a) => a.scope === "member" && a.owner === str(member)) : [];
    const departures = [...departed.values()].filter((d) => held.some((a) => a.id === d.aspiration));
    return { ok: true, project: project || null, member: member || null, aspirations: [...group, ...own, ...mine],
             limit: ASPIRATIONS_MAX, truncated, departures, departures_limit: DEPARTURES_MAX,
             departures_truncated: dep.truncated, precedence: null,
             says: word("intent.says.held_side_side") };
  }

  /** R13: each pair of held aspirations naming a common entity or progression, with what they share. The held ones
   *  among R12's read (the first ASPIRATIONS_MAX the viewer may see, in id order, held or retired; N323) are paired, and
   *  at most CONTACTS_MAX pairs are listed, in the order of their first and then second aspiration's id; `truncated`
   *  says either was cut (N209, K338). */
  contacts({ viewer = null } = {}) {
    const { held, truncated: cut } = this.#heldAspirations(viewer);
    const pairs = [];
    let truncated = cut;
    outer: for (let i = 0; i < held.length; i++)
      for (let j = i + 1; j < held.length; j++) {
        const a = held[i], b = held[j];
        const entities = a.entities.filter((e) => b.entities.includes(e));
        const progressions = a.progressions.filter((k) => b.progressions.includes(k));
        if (!entities.length && !progressions.length) continue;
        if (pairs.length === CONTACTS_MAX) { truncated = true; break outer; }
        pairs.push({ a: a.id, b: b.id, shared: { entities, progressions },
                     says: word("intent.says.name_listed_record") });
      }
    return { ok: true, contacts: pairs, limit: CONTACTS_MAX, truncated };
  }

  /** R14: an aspiration's pursuit record: the goals opened under it and their objectives, the proposals triaged under
   *  them with each act and reason, the capture requests named in them with their outcome, and the dead ends. */
  pursuitOf({ aspiration, viewer = null } = {}) {
    const a = this.#pursuit(aspiration, ASPIRATION, viewer);
    if (!a) return refuseNoSuchAspiration("no aspiration answers to that id here.", { aspiration: aspiration ?? null });
    /* N323 (K408): the first GOALS_READ_MAX goals held, in id order, whatever aspiration each names, walked a page at a
       time and read one past so a cut says so (a goal is readable by every member, R23, so the cut hides nothing); of
       those naming this aspiration, at most GOALS_MAX are answered, read one past (N181). */
    const goals = [];
    let after = "", read = 0, goalsSeen = 0, goals_read_truncated = false;
    for (;;) {
      const page = this.record.listByType({ type: GOAL, after, limit: 200 });
      for (const id of page.ids) {
        if (read === GOALS_READ_MAX) { goals_read_truncated = true; break; }
        read += 1;
        const g = this.#pursuit(id, GOAL, viewer);
        if (g && g.fm.aspiration === aspiration) { goalsSeen += 1; if (goals.length < GOALS_MAX) goals.push(this.#goalView(g, viewer)); }
        if (goalsSeen > GOALS_MAX) break;
      }
      if (goals_read_truncated || goalsSeen > GOALS_MAX || page.ids.length < 200 || !page.cursor) break;
      after = page.cursor;
    }
    const goals_truncated = goalsSeen > GOALS_MAX;
    /* N181: the triage acts under those goals' projects, oldest first, at most TRIAGED_MAX, read one past. */
    const projects = [...new Set(goals.flatMap((g) => g.objectives.map((o) => o.project)))];
    const acts = projects.length
      ? this.#rows(`SELECT proposal_key, source, kind, act, project_id, inquiry_id, reason, grade, basis_json, author, at
                      FROM intent_triage WHERE project_id IN (SELECT value FROM json_each(?)) ORDER BY seq LIMIT ?`,
                   JSON.stringify(projects), TRIAGED_MAX + 1)
      : [];
    const triaged_truncated = acts.length > TRIAGED_MAX;
    const triaged = acts.slice(0, TRIAGED_MAX)
      .map((r) => ({ proposal: r.proposal_key, source: r.source, kind: r.kind, act: r.act, project: r.project_id,
                     inquiry: r.inquiry_id, reason: r.reason, grade: r.grade, basis: safeJson(r.basis_json),
                     author: r.author, at: r.at }));
    /* N305: at most REQUESTS_MAX named requests, in the order the basis names them, read one past so a cut says so. */
    const named = [];
    for (const t of triaged) {
      for (const id of captureRequestsNamed(t.basis)) if (!named.includes(id)) named.push(id);
      if (named.length > REQUESTS_MAX) break;
    }
    const requests_truncated = named.length > REQUESTS_MAX;
    named.length = Math.min(named.length, REQUESTS_MAX);
    /* capture-requests' one read by key (its R43; N291), under the viewer's sight: a request it answers null for is not
       held, or is one the viewer may not see, and reads so; never a guessed outcome. */
    const byId = named.length ? this.#lazy(this.captureRequests) : null;
    const capture_requests = named.map((id) => {
      let r = null;
      try { r = byId.requestById({ request: id, viewer }); } catch { r = null; }
      if (!r) return { request: id, outcome: null, why: word("intent.why.request_held_see") };
      return { request: id, outcome: { state: r.state, code: r.code ?? null, capture_sha: r.capture_sha ?? null,
                                       captured_at: r.captured_at ?? null } };
    });
    return { ok: true, aspiration: this.#aspirationView(a), goals, goals_limit: GOALS_MAX, goals_truncated,
             goals_read_limit: GOALS_READ_MAX, goals_read_truncated, triaged,
             triaged_limit: TRIAGED_MAX, triaged_truncated, capture_requests, requests_limit: REQUESTS_MAX,
             requests_truncated,
             dead_ends: deadEndsOf(a.text), taught: a.head.currentState === "retired" ? readSection(a.text, "Taught") : null };
  }

  /* ===================================================================== *
   * THE DISCOVERY LOOP (R15–R17)
   * ===================================================================== */

  /** R15: a later module registers a proposal source once, at start (K31's pattern). `reader({project, viewer})`
   *  answers its proposals, `{key, kind, grade, basis, instances, surfaced_by}`. */
  registerSource(kind, reader) {
    if (typeof kind !== "string" || !TOKEN.test(kind) || typeof reader !== "function" || kind === "progressions" || kind === "intent")
      /* DEC-49 REGION is-source-shaped */
      return refusal("SOURCE_MALFORMED", "a source names its kind (a key, not 'progressions' or 'intent', which are read "
                     + "directly) and gives a reader function.", { kind: typeof kind === "string" ? kind : null });
      /* END DEC-49 REGION is-source-shaped */
    /* DEC-49 REGION is-source-once */
    if (this.#sources.has(kind))
      return refusal("SOURCE_DECLARED", `the source '${kind}' is already registered.`, { kind });
    /* END DEC-49 REGION is-source-once */
    this.#sources.set(kind, reader);
    return { ok: true, kind };
  }

  /* Every proposal from every source, open or not, keyed `<source>::<its key>`; with no project named, the gaps of the
     first PROJECTS_MAX projects the viewer may see, in id order (N305), `projects_truncated` saying they were cut. */
  #allProposals(project, viewer) {
    const out = [];
    const feed = this.progressions.proposalsFeed(null);
    for (const g of (feed && feed.proposals) || [])
      out.push({ key: `progressions::${g.key}`, source: "progressions", source_key: g.key, kind: "missing_predecessor",
                 grade: g.grade ?? null, grade_determined: g.grade_determined === true,
                 basis: { progression_key: g.progression_key, stage_key: g.stage_key, required: g.required,
                          definition_version: g.definition_version, overdue: g.overdue === true,
                          /* progressions R16 (K1444 (ii)): an overdue it cannot settle is counted apart, never as not
                             overdue */
                          overdue_count: Number.isInteger(g.overdue_count) ? g.overdue_count : 0,
                          overdue_undetermined_count: Number.isInteger(g.overdue_undetermined_count)
                            ? g.overdue_undetermined_count : 0 },
                 instances: g.instances || [], surfaced_by: g.surfaced_by || "machine" });
    for (const [kind, reader] of this.#sources) {
      let got = [];
      try { got = reader({ project, viewer }) || []; } catch { got = []; }
      for (const p of Array.isArray(got) ? got : [])
        if (isObj(p) && typeof p.key === "string" && p.key)
          out.push({ key: `${kind}::${p.key}`, source: kind, source_key: p.key, kind: p.kind ?? kind, grade: p.grade ?? null,
                     basis: p.basis ?? null, instances: Array.isArray(p.instances) ? p.instances : [],
                     surfaced_by: p.surfaced_by ?? "machine" });
    }
    const projects = project ? { ids: [project], truncated: false } : this.#projectsInOrder(viewer, PROJECTS_MAX);
    for (const pid of projects.ids) {
      const g = this.gaps({ project: pid, viewer });
      if (g.ok) for (const gap of g.gaps) out.push({ ...gap, source_key: gap.key.slice("intent::".length) });
    }
    return { list: out, projects_truncated: projects.truncated };
  }

  /* N305 (K391): the first `max` projects the viewer may see (every project for a null viewer), in id order, walked a
     page at a time and read one past, so `truncated` says a cut was made. A project the viewer may not see is not
     counted, so a cut says nothing of it (R23, DEC-36). */
  #projectsInOrder(viewer, max) {
    const ids = [];
    let after = "", truncated = false;
    for (;;) {
      const page = this.record.listByType({ type: "project", after, limit: 200 });
      for (const id of page.ids) {
        if (viewer != null && !this.membership.inSight(id, viewer)) continue;
        if (ids.length === max) { truncated = true; break; }
        ids.push(id);
      }
      if (truncated || page.ids.length < 200 || !page.cursor) break;
      after = page.cursor;
    }
    return { ids, truncated };
  }

  /* R16: whether a proposal key has a triage act recorded (any act takes it off the open list); one row, read through
     the key's index (N181 (4)). */
  #isDecided(key) {
    return !!this.#one(`SELECT 1 AS x FROM intent_triage WHERE proposal_key=? LIMIT 1`, typeof key === "string" ? key : "");
  }

  /* R15: which of these keys have a triage act recorded, read through the key's index, as many rows as keys. */
  #decidedAmong(keys) {
    if (!keys.length) return new Set();
    return new Set(this.#rows(`SELECT DISTINCT proposal_key FROM intent_triage
                                WHERE proposal_key IN (SELECT value FROM json_each(?)) LIMIT ?`,
                              JSON.stringify(keys), keys.length).map((r) => r.proposal_key));
  }

  /* R16, R23 (N199): the project a triage act concerns: the one named with it, else the project a gap's key names
     (`intent::<project>::…`), so a gap set aside without naming its project is still that project's material. */
  #projectOfAct(r) {
    if (r.project) return r.project;
    const m = /^intent::([^:]+)::/.exec(r.key || "");
    return m ? m[1] : null;
  }

  /* R16: the proposals set aside (deferred or dismissed), newest first, at most SET_ASIDE_MAX, read one past so a cut
     says so (N181); an act concerning a project the viewer may not see is not listed to them (R23, N199). */
  #setAside(viewer) {
    const rows = this.#rows(`SELECT proposal_key, act, project_id, inquiry_id, reason, author, at FROM intent_triage
                              WHERE act IN ('defer', 'dismiss') ORDER BY seq DESC LIMIT ?`, SET_ASIDE_MAX + 1);
    const truncated = rows.length > SET_ASIDE_MAX;
    const list = rows.slice(0, SET_ASIDE_MAX)
      .map((r) => ({ key: r.proposal_key, act: r.act, project: r.project_id, inquiry: r.inquiry_id, reason: r.reason,
                     author: r.author, at: r.at }))
      .filter((d) => { const pid = this.#projectOfAct(d);
                       return !pid || viewer == null || !this.#project(pid, viewer).refused; });
    return { list, truncated };
  }

  /** R15, R16: every open proposal from every source, each with its grade and basis; beside them, every proposal set
   *  aside (deferred or dismissed) with its reason, so a decision ages a proposal without hiding it. */
  proposals({ project = null, viewer = null } = {}) {
    if (project != null && project !== "") {
      const p = this.#project(project, viewer);
      if (p.refused) return p.refused;
    }
    const all = this.#allProposals(project || null, viewer);
    const decided = this.#decidedAmong(all.list.map((p) => p.key));
    const open = all.list.filter((p) => !decided.has(p.key));
    const aside = this.#setAside(viewer);
    return { ok: true, project: project || null, proposals: open, count: open.length, set_aside: aside.list,
             set_aside_limit: SET_ASIDE_MAX, set_aside_truncated: aside.truncated, projects_limit: PROJECTS_MAX,
             projects_truncated: all.projects_truncated };
  }

  /** R16: a member's act on a proposal: adopt it into a project's objective, open a question from it (a machine may
   *  do only this), or defer or dismiss it with a reason. */
  triage({ proposal, act, project = null, reason = null, author = null, viewer = null, run = null,
           assistantPrincipal = null, personWarningSeen = false } = {}) {
    /* DEC-49 REGION is-triage-act */
    if (!TRIAGE_ACTS.includes(act))
      return refusal("TRIAGE_ACT_UNKNOWN", `a proposal is triaged by one of ${TRIAGE_ACTS.join(", ")}. Nothing was written.`,
                     { acts: TRIAGE_ACTS });
    /* END DEC-49 REGION is-triage-act */
    const isMachine = machine(author);
    /* DEC-49 REGION is-triage-member */
    if (isMachine && act !== "question")
      return refusal("MACHINE_CANNOT_TRIAGE", "an assistant may open a question from a proposal and take no other act on "
                     + "it. Nothing was written.");
    /* END DEC-49 REGION is-triage-member */
    let proj = null;
    if (project != null && project !== "") {
      const p = this.#project(project, viewer ?? (isMachine ? null : author));
      if (p.refused) return p.refused;
      proj = p.doc;
    }
    const found = this.#isDecided(proposal) ? null
      : this.#allProposals(proj ? proj.id : null, viewer).list.find((p) => p.key === proposal);
    /* DEC-49 REGION is-proposal-open */
    if (!found)
      return refusal("NO_SUCH_PROPOSAL", "no open proposal answers to that key; a decided one stays readable with its "
                     + "reason. Nothing was written.", { proposal: typeof proposal === "string" ? proposal : null });
    /* END DEC-49 REGION is-proposal-open */
    const why = str(reason);
    if ((act === "defer" || act === "dismiss") && !why)
      return refuseNoReason("a proposal is deferred or dismissed with a reason in your own words. Nothing was written.");
    if (act === "adopt" && !proj)
      return noSuchProject(null);
    if (proj && !isMachine) {
      const denied = this.membership.projectAuthority(proj.id, author, "joined", `triage:${act}`);
      if (denied) return denied;
    }
    const at = this.#when();
    let inquiry = null, extra = {}, warning = null;
    if (act === "adopt") {
      /* R32 (D13): adopting a proposal into the objective carries inquiry R59's warning when the proposal names a person
         in no public role (its question's words, its basis's entity, its instances' entities); never refused. */
      const b = isObj(found.basis) ? found.basis : {};
      warning = this.#warningFor(questionOf(found), [b.entity, ...(Array.isArray(found.instances) ? found.instances : [])
        .map((x) => (isObj(x) ? x.entity_id : null))].filter((x) => typeof x === "string"), str(author));
      let text = appendItem(proj.text, "objective_adoptions",
                            { proposal: q(found.key), source: found.source, by: TOKEN.test(str(author)) ? str(author) : q(author),
                              at: q(at) });
      /* DEC-49 REGION is-adoptions-spliceable */
      if (text === null) return refusal("ADOPTIONS_UNSPLICEABLE", "the project's objective_adoptions block is not in a "
                                         + "shape this grammar can extend. Nothing was written.");
      /* END DEC-49 REGION is-adoptions-spliceable */
      text = setField(text, "last_updated", q(at));
      text = logEntry(text, at, "Proposal adopted", str(author), word("intent.proposal_adopted_objective", { key: String(found.key) }));
      const r = this.#revise(proj, text, str(author), viewer);
      if (!r.ok) return r;
    } else if (act === "question") {
      const opened = this.#openQuestion(found, author, viewer, run, assistantPrincipal, at);
      if (!opened.ok) return opened;
      inquiry = opened.bundleId;
      extra = { inquiry, surfaced_by: isMachine ? "agent" : "human" };
    } else if (found.source === "progressions") {
      /* A progression proposal is decided through progressions (its R20–R22), which ages its finding there too. */
      const d = this.progressions.disposeProposal({ key: found.source_key, to: act === "defer" ? "deferred" : "dismissed",
                                                    reason: why, definitionVersion: found.basis.definition_version,
                                                    decidedBy: str(author) });
      if (!d || d.ok !== true) return d;
      extra = { progressions: { key: d.key, state: d.state, definition_version: d.definition_version } };
    }
    const recorded = this.record.transact(() => {
      this.sql.exec(
        `INSERT INTO intent_triage (proposal_key, source, kind, act, project_id, inquiry_id, reason, grade, basis_json, author, at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        found.key, found.source, found.kind ?? null, act, proj ? proj.id : this.#projectOfAct({ key: found.key }), inquiry,
        why || null, found.grade ?? null,
        JSON.stringify(found.basis ?? null), str(author) || PLANE_ACTOR, at);
      return warning ? this.#recordWarning(proj.id, "adopt", found.key, warning, str(author), personWarningSeen) : null;
    });
    return { ok: true, proposal: found.key, act, project: proj ? proj.id : null, reason: why || null,
             author: str(author) || null, at, ...extra, ...(recorded ? { warning: recorded } : {}) };
  }

  /* R16's `question`: a new inquiry at `surfaced`, through promotion (so inquiry's check and ai-runs' surfacing step,
     its R25, run inside it), the proposal as its basis. */
  #openQuestion(found, author, viewer, run, assistantPrincipal, at) {
    const id = `${this.record.allocId("INQ", at.slice(0, 4)).id}-question`;
    const question = questionOf(found);
    const who = str(author) || PLANE_ACTOR;
    const text = ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: ${q(question.slice(0, 120))}`,
      "current_state: surfaced", "prior_state: null", `created: ${q(at)}`, `last_updated: ${q(at)}`,
      "produced_by:", `  mode: ${machine(author) ? "agent" : "human"}`, "  capability_tier: session", "references: []",
      "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null",
      "visuals: []", `surfaced_by: ${machine(author) ? "agent" : "human"}`, 'disposition_reason: ""',
      `surfaced_from: ${q(found.key)}`, "---", "", "## Question", "", question, "", word("conformance.rests"), "",
      word("intent.surfaced_proposal", { key: String(found.key), source: String(found.source), kind: String(found.kind ?? "finding"), basis: String(JSON.stringify(found.basis ?? null)) }),
      "", "## Conclusion", "", word("conformance.falsify"), "", "## Session Log", "",
      `### Session ${at} | Surfaced | ${who}`, word("intent.changes_opened_proposal", { key: String(found.key) }), "", "## Review Notes", ""].join("\n");
    return this.promotion.promote({ bundleId: id, base: null, snapKey: `${at.replace(/[-:]/g, "")}_${rand(4)}`, author: who,
      files: [{ path: "bundle.md", text }],
      meta: { object_type: "inquiry", current_state: "surfaced", created: at, last_updated: at },
      ...(run ? { run } : {}), ...(str(assistantPrincipal) ? { assistantPrincipal: str(assistantPrincipal) } : {}),
      actorViewer: viewer ?? null });
  }

  /** R17 (called by `scheduler`): a question an assistant surfaced that no member has acted on within the instance's
   *  ageing interval moves to `deferred`, with its reason, through inquiry's dispose act under the plane's actor.
   *  Nothing is deleted. It judges the questions R27's bounded read takes, answering `limit` and `truncated` (N323). */
  async ageSurfaced(now) {
    const nowMs = this.#instantMs(now);
    const days = this.ageingDays();
    const reason = word("intent.surfaced_assistant_member", { days: String(days) });
    const aged = [], refused = [];
    const read = this.#ageable();
    const due = read.list.filter((x) => x.at <= nowMs).map((x) => x.id);
    const inquiry = this.#lazy(this.inquiryRef), retrieval = this.#lazy(this.retrievalRef);
    for (const id of due) {
      /* One question per selection, so one refused question never holds back another (inquiry R22 moves a set whole). */
      const sel = await retrieval.selectionCreate({ ids: [id], kind: "enumerated", owner: PLANE_ACTOR, viewer: PLANE_VIEWER });
      if (!sel || !sel.handle) { refused.push({ id, reason: sel && sel.reason ? sel.reason : "NO_SELECTION" }); continue; }
      const r = inquiry.dispose({ handle: sel.handle, to: "deferred", reason, viewer: PLANE_VIEWER, owner: PLANE_ACTOR,
                                  author: PLANE_ACTOR });
      if (r && r.ok) aged.push(id); else refused.push({ id, reason: r ? r.reason : "DISPOSE_FAILED" });
    }
    return { ok: true, aged, refused, interval_days: days, reason, limit: AGEING_READ_MAX, truncated: read.truncated };
  }

  /* R17, R27: an instant given as milliseconds or ISO text; none given is the module's clock. */
  #instantMs(now) {
    return now == null || now === "" ? Date.parse(this.now()) : Number.isFinite(Number(now)) ? Number(now) : Date.parse(now);
  }

  /* R27 (N323, K408): the first AGEING_READ_MAX questions at `surfaced`, those whose last entry is oldest first (then
     by id), read one past so `truncated` says more follow; among them alone, each ageable one (R17 would move it:
     surfaced by a machine, no member's entry) with its ageing instant, its last entry's time plus the ageing interval,
     in milliseconds. One statement over record-core's `bundles` and `manifest` (its R37 read contract; the manifest's
     rowid ranks a bundle's entries, R16), so the walk itself is bounded; a question past the read is reached once
     earlier ones leave `surfaced` or take a newer entry. */
  #ageable() {
    const span = this.ageingDays() * 86400000;
    const rows = this.#rows(`SELECT id, last FROM (
                               SELECT b.bundle_id AS id, (SELECT m.created FROM manifest m WHERE m.bundle_id = b.bundle_id
                                                           ORDER BY m.rowid DESC LIMIT 1) AS last
                                 FROM bundles b WHERE b.object_type = 'inquiry' AND b.current_state = 'surfaced')
                             ORDER BY julianday(last), last, id LIMIT ?`, AGEING_READ_MAX + 1);
    const truncated = rows.length > AGEING_READ_MAX;
    const out = [];
    for (const { id, last } of rows.slice(0, AGEING_READ_MAX)) {
      const d = this.#doc(id);
      if (!d || d.head.currentState !== "surfaced" || d.fm.surfaced_by !== "agent") continue;
      if (!this.#machineOnly(id)) continue;
      const since = Date.parse(last ?? d.fm.created);
      if (Number.isFinite(since)) out.push({ id, at: since + span });
    }
    return { list: out, truncated };
  }

  /* R17, R27: whether a question has entries and every one of them is a machine's (no member acted on it). Its distinct
     authors are read a page at a time in author order, each statement bounded, stopping at the first member's. */
  #machineOnly(id) {
    let after = null, any = false;
    for (;;) {
      const page = this.#rows(`SELECT DISTINCT author FROM manifest WHERE bundle_id = ? AND (? IS NULL OR author > ?)
                               ORDER BY author LIMIT ?`, id, after, after, AUTHORS_PAGE).map((r) => r.author);
      if (page.some((who) => !machine(who))) return false;
      any = any || page.length > 0;
      if (page.length < AUTHORS_PAGE) return any;
      after = page[page.length - 1];
    }
  }

  /** R27 (for `scheduler`, beside R17 as its tick): the earliest ageing instant of any ageable question among the
   *  bounded read (N323), past or not, in milliseconds; null when there is none. A question R17 tried and could not move is still ageable, so it stays
   *  due and is tried again at a later firing. Writes nothing; never throws. */
  ageDue(now) {
    try {
      let best = null;
      for (const x of this.#ageable().list) if (best === null || x.at < best) best = x.at;
      return best;
    } catch { return null; }
  }

  /** R27: the earliest ageing instant later than `now` (milliseconds or ISO; none given is the module's clock), in
   *  milliseconds; null when there is none. One already due is never woken for. Writes nothing; never throws. */
  ageWake(now) {
    try {
      const nowMs = this.#instantMs(now);
      if (!Number.isFinite(nowMs)) return null;
      let best = null;
      for (const x of this.#ageable().list) if (x.at > nowMs && (best === null || x.at < best)) best = x.at;
      return best;
    } catch { return null; }
  }

  /** R17: the instance's ageing interval in days, a record-core setting (default 30). */
  ageingDays() {
    const v = Number(this.record.getSetting(AGEING_SETTING));
    return Number.isInteger(v) && v > 0 ? v : AGEING_DEFAULT_DAYS;
  }

  /* ===================================================================== *
   * WORKING AN OBJECTIVE (R18)
   * ===================================================================== */

  /** R18: a member sets an assistant to work a project's objective: a run through `ai-runs` with the project as its
   *  context, the objective and its current gaps as its instructions, its looks named under authority kind
   *  `objective`. `run` carries what `ai-runs.open` takes (its id, principals, skill version, bounds, …). The member's
   *  reason (DEC-88 (4)) is recorded on the run's opening as its `label`, which ai-runs stores at the open, never
   *  changes, and answers with the run's budget and context (its R10, R19), and is carried in the instructions. */
  async workObjective({ project, reason, author, viewer = null, run = {} } = {}) {
    /* DEC-49 REGION is-objective-member */
    if (machine(author))
      return refusal("MACHINE_CANNOT_CHOOSE_THE_QUESTION", localize("intent.index.setting_an_assistant_to_work", "setting an assistant to work an objective is a member's act (DEC-24 rule 2). No run was opened."));
    /* END DEC-49 REGION is-objective-member */
    /* R18 (DEC-88 (4)): why the run is opened, in the member's words, asked before the project is read; no run opened. */
    const why = reasonOf(reason);
    if (!why) return refuseNoReason("setting an assistant to work an objective records why, in your own words. No run "
                                    + "was opened.");
    const p = this.#project(project, viewer ?? author);
    if (p.refused) return p.refused;
    const g = this.gaps({ project, viewer: viewer ?? author });
    const instructions = { objective: p.doc.fm.objective ?? null, condition: g.condition ?? null, gaps: g.gaps || [],
                           authority: { kind: "objective", ref: project }, reason: why };
    const opened = await this.#lazy(this.aiRunsRef).open({ ...(isObj(run) ? run : {}), contextType: "project",
      contextId: project, label: why, state: { instructions }, actor: this.#memberOf(author), viewer: viewer ?? author });
    return { ...(isObj(opened) ? opened : {}), project, reason: why, instructions };
  }
}

/* DEC-49: a code several acts answer is minted at one site, its own function here, which builds the refusal whole
   from its row (D-484's shape); each act relays it with its own detail. `NO_SUCH_PROJECT` and `NO_SUCH_ENTITY` are not
   among them: each is one condition across modules, answered through membership's `noSuchProject` (its R78; N208,
   K275) and entities' `noSuchEntity` (its R36; N285). */
function refuseNoSuchGoal(detail, extra) {
  /* DEC-49 REGION is-goal-held */
  const row = INTENT_CHECKS.NO_SUCH_GOAL;
  return { ok: false, reason: "NO_SUCH_GOAL", code: "NO_SUCH_GOAL", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-goal-held */
}

function refuseNoSuchAspiration(detail, extra) {
  /* DEC-49 REGION is-aspiration-held */
  const row = INTENT_CHECKS.NO_SUCH_ASPIRATION;
  return { ok: false, reason: "NO_SUCH_ASPIRATION", code: "NO_SUCH_ASPIRATION", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-aspiration-held */
}

function refuseNoSuchProgression(detail, extra) {
  /* DEC-49 REGION is-named-progression */
  const row = INTENT_CHECKS.INTENT_NO_SUCH_PROGRESSION;
  return { ok: false, reason: "INTENT_NO_SUCH_PROGRESSION", code: "INTENT_NO_SUCH_PROGRESSION", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-named-progression */
}

function refuseNoReason(detail, extra) {
  /* DEC-49 REGION is-reason-stated */
  const row = INTENT_CHECKS.INTENT_NO_REASON;
  return { ok: false, reason: "INTENT_NO_REASON", code: "INTENT_NO_REASON", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-reason-stated */
}

function refusePursuitUnstated(detail, extra) {
  /* DEC-49 REGION is-pursuit-stated */
  const row = INTENT_CHECKS.PURSUIT_UNSTATED;
  return { ok: false, reason: "PURSUIT_UNSTATED", code: "PURSUIT_UNSTATED", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-pursuit-stated */
}

function refuseNoLesson(detail, extra) {
  /* DEC-49 REGION is-retirement-taught */
  const row = INTENT_CHECKS.NO_LESSON;
  return { ok: false, reason: "NO_LESSON", code: "NO_LESSON", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-retirement-taught */
}

function refuseBadScope(detail, extra) {
  /* DEC-49 REGION is-aspiration-scoped */
  const row = INTENT_CHECKS.BAD_SCOPE;
  return { ok: false, reason: "BAD_SCOPE", code: "BAD_SCOPE", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-aspiration-scoped */
}

function refusePursuitEnded(detail, extra) {
  /* DEC-49 REGION is-pursuit-live */
  const row = INTENT_CHECKS.PURSUIT_ENDED;
  return { ok: false, reason: "PURSUIT_ENDED", code: "PURSUIT_ENDED", check: row.check,
           translation: row.translation, detail, ...(extra || {}) };
  /* END DEC-49 REGION is-pursuit-live */
}

/* R8, R9, R20: a goal's and an aspiration's acts are a named member's. Each answers its refusal when the author is a
   machine (or no one), or is not a member (`member` false, the registered check's case), and null otherwise. */
function goalMachineRefusal(author, member = true) {
  /* DEC-49 REGION is-goal-member */
  if (str(author) && !isMachineIdentity(str(author)) && member) return null;
  const row = INTENT_CHECKS.MACHINE_CANNOT_DECLARE_GOAL;
  return { ok: false, reason: "MACHINE_CANNOT_DECLARE_GOAL", code: "MACHINE_CANNOT_DECLARE_GOAL", check: row.check,
           translation: row.translation,
           detail: "declaring, linking and closing a goal are a named member's acts. Nothing was written." };
  /* END DEC-49 REGION is-goal-member */
}

function aspirationMachineRefusal(author, member = true) {
  /* DEC-49 REGION is-aspiration-member */
  if (str(author) && !isMachineIdentity(str(author)) && member) return null;
  const row = INTENT_CHECKS.MACHINE_CANNOT_DECLARE_ASPIRATION;
  return { ok: false, reason: "MACHINE_CANNOT_DECLARE_ASPIRATION", code: "MACHINE_CANNOT_DECLARE_ASPIRATION",
           check: row.check, translation: row.translation,
           detail: "declaring, departing from, revising and retiring an aspiration are a named member's acts. Nothing "
                 + "was written." };
  /* END DEC-49 REGION is-aspiration-member */
}

/* The capture request ids a proposal's basis names (`capture_request`, `capture_requests`, `requests`). */
function captureRequestsNamed(basis) {
  if (!isObj(basis)) return [];
  const out = [];
  for (const k of ["capture_request", "capture_requests", "requests"]) {
    const v = basis[k];
    for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) if (typeof x === "string" && x) out.push(x);
  }
  return out;
}

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

/* R31: an exact decimal bound, written as a signed decimal string or a safe integer, never another number (a float is
   not exact); its string, or null. */
const BOUND = /^-?\d{1,40}(?:\.\d{1,20})?$/;
const boundOf = (v) => (typeof v === "string" && BOUND.test(v.trim()) ? v.trim()
                        : Number.isSafeInteger(v) ? String(v) : null);
const AMOUNT_KEYS = Object.freeze(["min", "max", "currency", "kinds", "phases", "period"]);

/** R31: whether a filter's `amount` has its shape, `{min?, max?, currency, kinds?, phases?, period?}`: at least one bound,
 *  each an exact decimal, `min` no higher than `max`; the currency a bare key; the kinds and phases money's closed lists
 *  (its R17); the period money's own fields (its R9 reads it), each a string the front matter holds. Answers `{ok,
 *  amount}` in its one written shape (absent fields left out), or `{ok: false, why}`. */
export function amountShape(v) {
  const no = (why) => ({ ok: false, why });
  if (!isObj(v)) return no("the amount filter is a map");
  const extra = Object.keys(v).find((k) => !AMOUNT_KEYS.includes(k));
  if (extra !== undefined) return no(`the amount filter has no field '${String(extra).slice(0, 40)}'`);
  if (typeof v.currency !== "string" || !TOKEN.test(v.currency.trim())) return no("the amount filter names its currency");
  const out = {};
  for (const k of ["min", "max"]) {
    if (v[k] == null) continue;
    const b = boundOf(v[k]);
    if (b === null) return no(`the amount filter's ${k} is an exact decimal, written as a string`);
    out[k] = b;
  }
  if (out.min === undefined && out.max === undefined) return no("the amount filter states a min, a max or both");
  if (out.min !== undefined && out.max !== undefined && cmpD(dec(out.min), dec(out.max)) > 0)
    return no("the amount filter's min is above its max");
  out.currency = v.currency.trim();
  for (const [k, closed] of [["kinds", moneyKinds()], ["phases", moneyPhases()]]) {
    if (v[k] == null) continue;
    if (!Array.isArray(v[k]) || v[k].some((x) => !closed.includes(x)))
      return no(`the amount filter's ${k} are a list of ${closed.join(", ")}`);
    if (v[k].length) out[k] = [...new Set(v[k])];
  }
  if (v.period != null) {
    if (!isObj(v.period) || !Object.keys(v.period).length) return no("the amount filter's period is a map of money's period fields");
    const p = {};
    for (const [k, x] of Object.entries(v.period)) {
      if (!AMOUNT_PERIOD_FIELDS.includes(k)) return no(`a period has no field '${String(k).slice(0, 40)}'`);
      if (typeof x !== "string" || !x.trim() || !quotable(x)) return no(`the period's ${k} is a string with no quote or line break`);
    }
    for (const k of AMOUNT_PERIOD_FIELDS) if (v.period[k] != null) p[k] = v.period[k].trim();
    out.period = p;
  }
  return { ok: true, amount: out };
}

/* CONDITION_UNREADABLE's extra field: why the amount filter is unreadable, when it is. */
function amountFault(c) {
  const f = isObj(c) && isObj(c.filter) && "amount" in c.filter ? amountShape(c.filter.amount) : null;
  return f && !f.ok ? { amount_why: f.why } : {};
}

/* R31: a money fact's amount as calc-grammar's figure, signed: a range's bounds (money answers them unsigned, the sign
   apart) swap under a minus. */
function figureOfFact(f) {
  const neg = f.sign === "-";
  if (isObj(f.amount))
    return { low: neg ? `-${f.amount.high}` : f.amount.low, high: neg ? `-${f.amount.low}` : f.amount.high, sign: f.sign,
             precision: "range", currency: f.currency };
  return { value: f.amount, sign: f.sign, precision: f.precision, currency: f.currency };
}

/* R16: the question a proposal opens, in words a member can read; an obstacle reads as such (Suggestions). */
function questionOf(p) {
  const b = isObj(p.basis) ? p.basis : {};
  if (p.source === "progressions")
    return word("intent.stage_missing_flow", { stage_key: String(b.stage_key), progression_key: String(b.progression_key) });
  if (p.kind === GAP_KIND)
    return b.stages_missing
      ? word("intent.fill_stages", { stages_missing: String(b.stages_missing.join(", ")), progression: String(b.progression), entity: String(b.entity) })
      : word("intent.strengthen_weakest_link", { progression: String(b.progression), entity: String(b.entity) });
  return word("intent.finding_show", { key: String(p.key) });
}

/** The ops whose handlers are this module's (K3): the control plane routes, authenticates and stamps them (`author`
 *  in the body; `viewer` in the URL, read after the body so a body cannot set it). The plane's route map spreads them. */
export function intentOps(i, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = body || {};
  return {
    objectivecondition: () => i.setCondition({ ...b, viewer: qp("viewer") }),
    objectiveprogress: () => i.progress({ project: qp("project"), viewer: qp("viewer") }),
    objectivegaps: () => i.gaps({ project: qp("project"), viewer: qp("viewer") }),
    goaldeclare: () => i.declareGoal({ ...b, viewer: qp("viewer") }),
    goallink: () => i.linkObjective({ ...b, viewer: qp("viewer") }),
    goalclose: () => i.closeGoal({ ...b, viewer: qp("viewer") }),
    goal: () => i.readGoal({ goal: qp("id"), viewer: qp("viewer") }),
    aspirationdeclare: () => i.declareAspiration({ ...b, viewer: qp("viewer") }),
    aspirationdepart: () => i.departFrom({ ...b, viewer: qp("viewer") }),
    aspirationdeadend: () => i.recordDeadEnd({ ...b, viewer: qp("viewer") }),
    aspirationretire: () => i.retireAspiration({ ...b, viewer: qp("viewer") }),
    aspirations: () => i.aspirationsFor({ project: qp("project"), member: qp("member"), viewer: qp("viewer"),
                                          retired: qp("retired") === "true" }),
    aspirationcontacts: () => i.contacts({ viewer: qp("viewer") }),
    pursuit: () => i.pursuitOf({ aspiration: qp("id"), viewer: qp("viewer") }),
    intentproposals: () => i.proposals({ project: qp("project"), viewer: qp("viewer") }),
    triage: () => i.triage({ ...b, viewer: qp("viewer") }),
    workobjective: () => i.workObjective({ ...b, viewer: qp("viewer") }),
  };
}

/* R34 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  objectivecondition: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.objectivecondition", "objective-directed: sets, replaces or removes a project's satisfaction condition, keyed by project, with the author's reason for measuring progress this way, now required (intent R2, R30; DEC-88: `reasoned`); a new revision of the project's document"),
    fields: { accepts: ["project","condition","reason","personWarningSeen"], requires: ["project","reason"] } },
  goaldeclare: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.goaldeclare", "goal-directed: a member declares a goal, keyed by the new goal; acts on no existing bundle's state"),
    fields: { accepts: ["statement","bounds","aspiration"], requires: ["statement","bounds"] } },
  goallink: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("intent.declared.goallink", "goal-directed: the author's dated claim that a project's objective serves a goal, keyed by (goal, project)"),
    fields: { accepts: ["goal","project"], requires: ["goal","project"] } },
  goalclose: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.goalclose", "goal-directed: a member closes a goal with its reason, keyed by goal id"),
    fields: { accepts: ["goal","reason"], requires: ["goal","reason"] } },
  aspirationdeclare: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.aspirationdeclare", "aspiration-directed: a member declares an aspiration of the group, a project or a member, keyed by its scope"),
    fields: { accepts: ["scope","owner","statement","entities","progressions"], requires: ["scope","statement"] } },
  aspirationdepart: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.aspirationdepart", "aspiration-directed: a project records its departure from a held group aspiration with a reason, keyed by (project, aspiration)"),
    fields: { accepts: ["project","aspiration","reason"], requires: ["project","aspiration","reason"] } },
  aspirationdeadend: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.aspirationdeadend", "aspiration-directed: a dead end appended to an aspiration's pursuit record, keyed by aspiration id"),
    fields: { accepts: ["aspiration","note"], requires: ["aspiration","note"] } },
  aspirationretire: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.aspirationretire", "aspiration-directed: a member retires an aspiration with what pursuing it taught, keyed by aspiration id"),
    fields: { accepts: ["aspiration","taught"], requires: ["aspiration","taught"] } },
  triage: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("intent.declared.triage", "proposal-directed: a member adopts, opens a question from, defers or dismisses one proposal, keyed by proposal key"),
    fields: { accepts: ["proposal","act","project","reason","run","personWarningSeen"], requires: ["proposal","act"] } },
});

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It registers its check with promotion
 *  (R39; and its projection, R32's warning), its audit check with record-core (R59), its tables with purge (R24) and
 *  its project grammar, C-2.9's
 *  `closed_reason` arm, in record-grammar's `checkProjectExtension` slot (R29). */
export function intentOf(host, deps) {
  let i = instances.get(host);
  if (!i) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    i = new Intent({ ...d, storage, record, membership, promotion,
                     entities: d.entities || entitiesOf(host, { record, membership }),
                     progressions: d.progressions || (() => progressionsOf(host, { record })),
                     inquiry: d.inquiry || (() => inquiryOf(host)), aiRuns: d.aiRuns || (() => aiRunsOf(host)),
                     retrieval: d.retrieval || (() => retrievalOf(host)),
                     captureRequests: d.captureRequests || (() => captureRequestsOf(host)),
                     money: d.money || (() => moneyOf(host)) });
    instances.set(host, i);
    record.declarePurge("intent", INTENT_TABLES);
    promotion.registerStep("intent", { check: (c) => i.check(c), project: (c) => i.project(c) });
    record.registerAuditCheck("intent", (image) => i.auditCheck(image));
    registerProjectGrammar(record);
  }
  return i;
}
