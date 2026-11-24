/* contradiction (layer 6): Contradiction's IDENTIFY (`build/requirements/contradiction.md`;
   `docs/development/CONTRADICTION-IDENTIFY-DESIGN.md`). The pairing read (R5–R12) and the one door a run's judgement
   enters the record by (R13–R16), reached through `contradictionOf(ctx)` (K61). Moved from `store.mjs` (REC-146's
   pairing, REC-147's candidate door, their dispatch), the old catalogue (C-60, C-93, now `checks.mjs`) and
   `schema.mjs` (`contradiction_candidates`, now `schema.mjs` here). The judgement's words stay in
   `../contradiction.mjs` and are re-exported here. Whether a run is visible, running and the caller's is asked of a
   run gate `ai-runs` registers (R21, K31); `legacy-store` registered it until then.

   WHAT THIS IS AND, MORE IMPORTANTLY, WHAT IT IS NOT. Section 2 splits the detector in two and the split is the whole
   audit story: PAIRING — which two assertions are worth comparing — is deterministic, in the plane, and auditable;
   JUDGEMENT — whether a pair conflicts, and how — is the machine's, inside a run, labelled machine work. This module
   pairs, and holds what a run PROPOSED about a formed pair. It judges nothing, grades nothing, edits or closes no
   side, and a candidate is shown to a member only by PRESENT's reads (R25–R29), at the weight R24 gives it (R19).

   THE ONE THING THIS SURFACE CAN GET WRONG THAT NOTHING ELSE CAN. The old `CLAUDE.md` (archived at
   `docs/archive/CLAUDE-2026-09-26-old-process.md`): *sparse is normal at every level, and
   absence at one level is not evidence of absence at the next. Saying WHICH is true is a first-class obligation.* An
   empty pair list here is SIX different facts — nobody has asked a question; the questions hold no readings; the
   readings state no claim; the claims share no subject; the sources cannot be told apart for want of a date nobody
   recorded; or this caller was shown nothing at all. Printed bare, every one of them reads as THE RECORD IS
   CONSISTENT. So no key ever returns a bare zero: `absence` names the LEVEL and the ladder that found it is
   published beside it (R11).

   WHAT IT READS OF OTHER MODULES' TABLES, each in its own SQL so the per-key bound stays a bound on the statement
   (D-365): `bundles` (record-core R37), `content` (content R45), `readings.content_type` (extraction R58) and the
   reading's date through `extraction.readingOf` (R30), and `inquiry_basis`, `inquiry_bundle_facts.inquiry_subject_entity`
   (inquiry R40; on `bundles` until N136's rest moved it, T19), `inquiry_basis_versions`, `inquiry_basis_version_legs`
   and `resolutions` as their owners' read contracts (CONTRADICTION #1 QUESTION J1).

   T33-48 (K1470, K1487): K4's dates are the documents' own, as `events` holds them for each capture (its dated facts,
   R27's `datedFactsFor`), compared by `civil-time.compare` and never as raw strings (R9); a sixth key, K6, pairs two
   amounts `money` holds for one transfer (its read contract `money_facts`, R19 there, and `reconcile`, R11 there); the
   module registers as a connection owner (`connection-grammar`, R58 here) and declares its tables explicitly (R59). */
import { recordOf } from "../record-core/index.mjs";
import { viewerMember, baseViewer, ROOT_ADMIN } from "../member-roster/index.mjs";
import { viewerPredicate, GATE_MARK, membershipOf, noSuchProject, notAParticipant } from "../membership/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { basisVersionsOf, versionsIn } from "../basis-versions/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { canonicalExtent, checkContentExtent, describeExtent, contentOf } from "../content/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { compare, bounds } from "../civil-time/index.mjs";
import { defaultRegistry, derivedId, isRecordId, BOUNDS, LOWEST_GRADE } from "../connection-grammar/index.mjs";
/* `inquiry`'s N345 services (its R46–R48) are read through the namespace, so a name its job has not yet exported reads
   `undefined` rather than failing the import: this module is built against their stated interface (START, K481). */
import * as inquiryModule from "../inquiry/index.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { CONTRADICTION_LABELS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, judgementSide,
         renderJudgementInput, RECOMMEND_PROMPT, RECOMMEND_PROMPT_SHA256 } from "../contradiction.mjs";
import { CONTRADICTION_SCHEMA, CONTRADICTION_COLUMNS } from "./schema.mjs";
import { CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS } from "./checks.mjs";
import { WEIGHTS, STATES, K5_GATE_MEASURED, K5_UNSHOWN_WHY, K6_GATE_MEASURED, K6_UNSHOWN_WHY, weightOf, stateOf, isClosed,
         isProjectConflict, isStanding } from "./derive.mjs";
import { fmSafe, setFrontmatterLines, appendSessionLog, setOrAddScalar, rand } from "./text.mjs";

export { CONTRADICTION_LABELS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, judgementSide, renderJudgementInput,
         RECOMMEND_PROMPT, RECOMMEND_PROMPT_SHA256, CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS,
         CONTRADICTION_SCHEMA, WEIGHTS, STATES, K5_GATE_MEASURED, K6_GATE_MEASURED };

/* R22, R47 (K23): the tables this module owns, each keyed to a bundle by both sides' (and, for an opt-in or a
   response, by its project too). */
export const CONTRADICTION_TABLES = Object.freeze(["contradiction_candidates", "contradiction_acts",
  "contradiction_recommendations", "contradiction_optins", "contradiction_responses"]);

/** R6: the per-key bound. Section 6: *it is bounded, and the bound is stated* — a capped answer that drops its bound
 *  reads as COMPLETENESS. */
export const CONTRADICTION_PAIRS_MAX = 50;

/** R15: a proposal's reason, at most. */
export const CANDIDATE_REASON_MAX = 2000;

/** K5's scan: at most this many inquiries are examined for two concluded stances; reaching it with more left is
 *  truncation, stated (R7). */
export const K5_INQUIRIES_EXAMINED = 1000;

/** R24, R49: the reach of a duty and a candidate's parties, bounded per inquiry and per content row. */
export const REACH_PROJECTS_MAX = 32;
export const REACH_INQUIRIES_MAX = 32;

/** R25, R50, R54: a page of candidates, notices or responses. */
export const PAGE_MAX = 50;
/** R25: the candidates a subject's read examines; reaching it with more left is `truncated`. */
export const CANDIDATES_SCAN_MAX = 2000;
/** R27: referents in one request. */
export const TENSIONS_REFERENTS_MAX = 200;
/** R27 (N368, K544): the candidates one referent's marks are read from; past it the referent says `truncated`. */
export const TENSIONS_CANDIDATES_MAX = 200;
/** R28 (N368, K544): each side's resolved entities; past it that fact says `truncated`. */
export const FACTS_ENTITIES_MAX = 500;
/** R29: candidates per finding. */
export const UNRESOLVED_MAX = 200;
/** R30, R51, R53: the caps on a member's free text, by field. */
export const TEXT_CAPS = Object.freeze({ explanation: 1000, reason: 500, words: 500, qualifier: 200, question: 500,
                                         text: 2000 });
/** R53: an email address, at most. */
export const EMAIL_MAX = 254;
/** R54: the relayed responses carried in one notice. */
export const NOTICE_RESPONSES_MAX = 20;
/** R31 (DEC-84 item 17): the three reasons a lead is dismissed for. */
export const DISMISSAL_REASONS = Object.freeze(["same_fact_different_precision", "not_same_matter",
                                                "real_conflict_not_pursued"]);
/** R40: the two that count as a false conflict. */
export const FALSE_CONFLICT_REASONS = Object.freeze(["same_fact_different_precision", "not_same_matter"]);
/** R32–R34: the answers to "how do these differ?". */
export const CLARIFY_CHOICES = Object.freeze(["differs", "one_wrong", "no_difference"]);
/** R39: when an acceptance rate is due for review (DEC-77 item 3; §15 point 15). PROVISIONAL, as IDENTIFY's was. */
export const ACCEPTANCE_REVIEW = Object.freeze({ rate: 0.95, min_offered: 30, status: "PROVISIONAL" });
/** R61: the key a member's own flag of two documents is held under. It is no pairing key (R5, R18): the plane forms no
 *  pair for it, a member names the two passages, so `pairs` never answers it and R5 refuses it. */
export const FLAG_KEY = "FLAG";
/* R61: the pages of a reading's units read to find a flagged passage (a reading is read page by page, never whole). */
const FLAG_UNIT_PAGES_MAX = 200;
/** R61: a flag is a source against a source, the `world` label, so it is a lead (R24) and creates no duty of its own. */
export const FLAG_LABEL = "world";

/** R50: the one sentence a notice carries. */
export const NOTICE_SENTENCE = word("contradiction.notice_sentence");
/** R50 (T41, D64): the one sentence a notice carries instead when it names another party, a non-hidden project the
 *  viewer may see by name. */
export const NOTICE_NAMED_SENTENCE = word("contradiction.notice_named_sentence");

/* The viewer the module's own internal reads are made as (a machine credential sees every bundle, membership R43): the
   reach of a duty and a candidate's parties are about the record, never about who asks. What a viewer is then shown
   is gated separately. */
const INTERNAL = "class:daemon";
/* A side's home that is no longer held: seen by nobody (fail closed). */
const MISSING = Symbol("missing");

/** The keys, section 4, as the VOCABULARY rather than as four spellings in four places (PL-17's rule: the vocabulary
 *  travels with the answer). Section 4: *keys are ADDED, not tuned* (R18) — a fifth key is a design change and a new
 *  row, never a widened join inside an existing key, because a key whose meaning drifts makes the per-key figures
 *  incomparable across runs. */
export const CONTRADICTION_KEYS = Object.freeze({
  K1: Object.freeze({ key: "K1", name: word("contradiction.name.inquiry_opposite_roles"), feeds: "world",
        join: "a supports leg and a cuts_against leg of the SAME inquiry, each resting on a passage",
        why: word("contradiction.why.inquiry_already_holds") }),
  K2: Object.freeze({ key: "K2", name: word("contradiction.name.subject_two_held"), feeds: "record",
        join: "two inquiries with the same subject entity, each with an ACCEPTED reading carrying a claim",
        why: word("contradiction.why.two_things_group") }),
  K3: Object.freeze({ key: "K3", name: word("contradiction.name.referent_two_held"), feeds: "record",
        join: "two accepted readings, of different inquiries, whose legs rest on the SAME passage "
            + "(or, where no passage is named, the same captured document)",
        why: word("contradiction.why.read_text_two") }),
  K4: Object.freeze({ key: "K4", name: word("contradiction.name.entity_two_sources"), feeds: "world",
        join: "two cited passages whose documents RESOLVE (established) to the same entity, of different doctypes "
            + "AS THEIR READERS STATE THEM, or with own dates the record holds in a SETTLED ORDER",
        why: word("contradiction.why.rule_against_act") }),
  /* N345, DEC-84 item 3: added, not tuned (R18). Two projects' conclusions are plurality, not a defect, until a member
     finds no named difference between them (R24, R34). */
  K5: Object.freeze({ key: "K5", name: word("contradiction.name.question_two_projects"), feeds: "record",
        join: "two projects whose stances on the SAME inquiry are both concluded, adopting claims whose text differs",
        why: word("contradiction.why.two_projects_answered") }),
  /* T33-48 (ladders §5C.4): added, not tuned (R18). Two readings of the amount of one transfer: the same payer and
     payee, kind and phase or stage, over overlapping periods, whose amounts `money.reconcile` does not find consistent. */
  K6: Object.freeze({ key: "K6", name: word("contradiction.name.two_amounts_transfer"), feeds: "world",
        join: "two money facts naming the same payer and payee entities, the same kind and phase or stage, and periods "
            + "that overlap, whose amounts money's reconciliation does not find consistent",
        why: word("contradiction.why.two_sources_state") }),
});

/* R11: each key's own last level, named when every rung of its ladder is present and the join still formed nothing. */
const LAST_LEVEL = Object.freeze({ K1: "shared_side", K2: "shared_subject", K3: "shared_referent", K4: "discriminator",
                                   K5: "shared_question", K6: "shared_transfer" });

/** R11: the sentence a member reads when a key found nothing. ONE place, so a surface renders what the plane holds
 *  and never composes this itself — the second place a distinction is made is the first place it can drift. */
export const CONTRADICTION_ABSENCE = Object.freeze({
  viewer: word("contradiction.viewer"),
  inquiry: word("contradiction.inquiry.question_scope_all"),
  leg: word("contradiction.leg"),
  role: word("contradiction.role"),
  referent: word("contradiction.referent"),
  subject: word("contradiction.subject.questions_exist_names"),
  reading: word("contradiction.reading"),
  claim: word("contradiction.claim"),
  shared_entity: word("contradiction.shared_entity"),
  content: word("contradiction.content"),
  cited: word("contradiction.cited"),
  resolution: word("contradiction.resolution"),
  shared_side: word("contradiction.shared_side"),
  shared_subject: word("contradiction.shared_subject"),
  shared_referent: word("contradiction.shared_referent"),
  drawing_projects: word("contradiction.drawing_projects"),
  concluded_stances: word("contradiction.concluded_stances"),
  differing_claim: word("contradiction.differing_claim"),
  shared_question: word("contradiction.shared_question"),
  money_fact: word("contradiction.money_fact"),
  same_parties: word("contradiction.same_parties"),
  same_stage_period: word("contradiction.same_stage_period"),
  differing_amount: word("contradiction.differing_amount"),
  shared_transfer: word("contradiction.shared_transfer"),
  discriminator: word("contradiction.discriminator"),
});

/* R15, R16: a candidate's stored row as every answer gives it. */
const STORED_ROW = `candidate, key, a_kind, a_ref, a_version, a_bundle_id, b_kind, b_ref, b_version, b_bundle_id, run,
  proposed_by, label, reason, state, origin, at, a_side, b_side`;

const RUN_GATE_DECLARED = "RUN_GATE_DECLARED";
const RUN_GATE_MALFORMED = "RUN_GATE_MALFORMED";

const instances = new WeakMap();
/* R58 (K1563 (1)): every instance this isolate made, so the owner registered at load finds the one there is when the
   registry passes no host. */
const live = new Set();

/** K61: the one Contradiction for this object's storage. `opts` is read on the first call only: `record`
 *  (`recordOf(ctx)`), `extraction` (`extractionOf(ctx)`), `membership`, `promotion`, `entities`, `basisVersions`,
 *  `events`, `money`, `content` (each its module's factory), `inquiry` (inquiry's N345 services, R46–R48: by default its module's
 *  exports and its instance's `contradictionLink` and `inquiryOfCandidate`), `now` (a clock). Every service but
 *  `record` is reached on first use. A test may pass its own. The promotion check (R38) is registered here, once. */
export function contradictionOf(ctx, opts = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let c = instances.get(storage);
  if (!c) {
    const record = opts.record ?? recordOf(ctx);
    const lazy = (given, make) => given ?? make;
    c = new Contradiction(storage, {
      ...opts, record,
      extraction: lazy(opts.extraction, () => extractionOf(ctx)),
      membership: lazy(opts.membership, () => membershipOf(ctx, { record })),
      promotion: lazy(opts.promotion, () => promotionOf(ctx, { record })),
      entities: lazy(opts.entities, () => entitiesOf(ctx, { record })),
      basisVersions: lazy(opts.basisVersions, () => basisVersionsOf(ctx, { record })),
      events: lazy(opts.events, () => eventsOf(ctx, { record })),
      money: lazy(opts.money, () => moneyOf(ctx, { record })),
      content: lazy(opts.content, () => contentOf(ctx, { record })),
      inquiry: lazy(opts.inquiry, () => inquiryServices(ctx)),
    });
    instances.set(storage, c);
    live.add(c);
    const promotion = typeof opts.promotion === "object" && opts.promotion ? opts.promotion : promotionOf(ctx, { record });
    if (promotion && typeof promotion.registerStep === "function")
      promotion.registerStep("contradiction", { check: (step) => c.promotionCheck(step) });
  }
  return c;
}

/** `inquiry`'s N345 services as this module reads them (its R46–R48): the frozen vocabularies and helpers from its
 *  module, the two reads from its instance. A name inquiry does not yet export reads `undefined`, and every use here
 *  answers what it cannot judge rather than guessing. */
export function inquiryServices(ctx) {
  const m = inquiryModule;
  let k = null;
  const inst = () => (k ||= m.inquiryOf(ctx));
  return {
    CONTRADICTION_COORDINATES: m.CONTRADICTION_COORDINATES, PLURALITY_DIFFERENCES: m.PLURALITY_DIFFERENCES,
    DISSOLVED_BY: m.DISSOLVED_BY, RESOLUTION_KINDS: m.RESOLUTION_KINDS, NORM_CANONS: m.NORM_CANONS,
    resolutionFamily: m.resolutionFamily, resolutionLines: m.resolutionLines,
    deriveInquiryTitle: m.deriveInquiryTitle,
    contradictionLink: (id) => { const i = inst(); return typeof i.contradictionLink === "function" ? i.contradictionLink(id) : null; },
    inquiryOfCandidate: (cand) => { const i = inst(); return typeof i.inquiryOfCandidate === "function" ? i.inquiryOfCandidate(cand) : null; },
  };
}

/* ---- R58: the connection owner (connection-grammar R2, R6–R9; K1487) ---- */

/** R58: the owner, its one kind with the members' word (K1486) and its class (K1521). A candidate is the pairing's and a
 *  run's derivation, labelled machine work; it is never evidence, and a chain through it is a lead. */
export const CONNECTION_OWNER = "contradiction";
export const CONNECTION_KIND = "in_tension_with";
export const CONNECTION_KINDS = Object.freeze([Object.freeze({ kind: CONNECTION_KIND, word: word("contradiction.word.tension"), class: "derived" })]);
/* A candidate states no dates: its `valid` is unstated, so at any date asked it is undetermined, never out. The zone
   names no place (R23); with no bound stated it is never read. */
const UNDATED = Object.freeze({ from: null, to: null, precision: "day", zone: "UTC" });
const UNDATED_WHY = Object.freeze({ key: "contradiction.undated_why", vars: Object.freeze({}) });

/** R58 (K1563 (1)): the read the owner registers at load. The registry passes `host` through unchanged: with one, that
 *  host's instance answers; without one, the isolate's one instance; otherwise `OWNER_HOST_AMBIGUOUS`. */
export function ownerNeighbours(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const { host, ...rest } = a;
  let c = null;
  if (host !== undefined && host !== null) c = instances.get(host.storage ? host.storage : host) ?? null;
  else if (live.size === 1) c = [...live][0];
  if (!c) return { refused: "OWNER_HOST_AMBIGUOUS",
                   why: host ? word("contradiction.why.contradiction_instance_made")
                     : word("contradiction.why.contradiction_instances_made", { size: live.size }) };
  return c.neighbours(rest);
}
/* R58: registered once, at load, into the registry the plane wires (connection-grammar R5). A refusal leaves the owner
   unregistered, never the module unloaded. */
export const OWNER_REGISTRATION = (() => {
  try { return defaultRegistry.registerOwner({ owner: CONNECTION_OWNER, kinds: CONNECTION_KINDS.map((k) => ({ ...k })),
                                               neighbours: ownerNeighbours }); }
  catch (e) { return { refused: "OWNER_FAILED", why: String(e && e.message || e) }; }
})();

export class Contradiction {
  #sql; #record; #extraction; #now; #runGate = null; #declared = false;
  #membership; #promotion; #entities; #bv; #inquiry; #events; #money; #content;

  constructor(storage, { record, extraction = null, now = null, membership = null, promotion = null, entities = null,
                         basisVersions = null, inquiry = null, events = null, money = null, content = null } = {}) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#extraction = extraction;
    this.#membership = membership;
    this.#promotion = promotion;
    this.#entities = entities;
    this.#bv = basisVersions;
    this.#inquiry = inquiry;
    this.#events = events;
    this.#money = money;
    this.#content = content;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #x() { return typeof this.#extraction === "function" ? (this.#extraction = this.#extraction()) : this.#extraction; }
  /** The member id a viewer's session names, as membership R154 reads it (`member-roster` R73): the id in `member:<id>`,
   *  and for the founder's bare `admin` the founder's own id, so the founder is judged a joined participant (or not)
   *  like any member. Null for a machine credential and for a spelling nothing admits. */
  #memberOf(viewer) {
    return viewerMember(viewer, baseViewer(viewer) === ROOT_ADMIN ? `member:${ROOT_ADMIN}` : null);
  }

  /* Each service reached on first use: a function given is called once and its answer kept. */
  #m() { return typeof this.#membership === "function" ? (this.#membership = this.#membership()) : this.#membership; }
  #p() { return typeof this.#promotion === "function" ? (this.#promotion = this.#promotion()) : this.#promotion; }
  #e() { return typeof this.#entities === "function" ? (this.#entities = this.#entities()) : this.#entities; }
  #b() { return typeof this.#bv === "function" ? (this.#bv = this.#bv()) : this.#bv; }
  #i() { return typeof this.#inquiry === "function" ? (this.#inquiry = this.#inquiry()) : (this.#inquiry || {}); }
  #ev() { return typeof this.#events === "function" ? (this.#events = this.#events()) : this.#events; }
  #ct() { return typeof this.#content === "function" ? (this.#content = this.#content()) : this.#content; }
  #mo() { return typeof this.#money === "function" ? (this.#money = this.#money()) : this.#money; }

  /* ---- boot (K4) ---- */

  /** This module's tables at every boot, idempotent (the columns added since a table was first created included),
   *  and their declaration (R59) once. */
  migrate() {
    const bare = CONTRADICTION_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    for (const [table, col, type] of CONTRADICTION_COLUMNS) {
      const held = this.#rows(`SELECT name FROM pragma_table_info(?)`, table).some((r) => r.name === col);
      if (!held) this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    }
    this.declareTables();
  }

  /** R59 (plan T33, Rules (6); record-core R21), keeping R17, R22 and R47 (K23, record-core R46): every table declared
   *  explicitly, each row keyed to the bundles both sides of its candidate live in, so a purge of either end takes it
   *  (D-113), and an opt-in and a response also by their project. Each is append-only (`version_chain: true`: nothing
   *  updates or deletes a row but a purge, R17, R42) and seen with the sight of the bundles its keys name (R10: the
   *  sides', and for an opt-in or a response its project's too). The other classes are `declarePurge`'s default form's.
   *  Once per instance. */
  declareTables() {
    if (this.#declared) return { ok: true, already: true };
    const both = ["a_bundle_id", "b_bundle_id"];
    const cls = { purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: true };
    const r = this.#record.declareTable("contradiction", [
      { name: "contradiction_candidates", keys: both, ...cls },
      { name: "contradiction_acts", keys: both, ...cls },
      { name: "contradiction_recommendations", keys: both, ...cls },
      { name: "contradiction_optins", keys: [...both, "project_id"], ...cls },
      { name: "contradiction_responses", keys: [...both, "project_id"], ...cls },
    ]);
    if (r && r.ok !== false) this.#declared = true;
    return r;
  }

  /** The name this declaration had before R59; the same act. */
  declarePurge() { return this.declareTables(); }

  /* ---- the run gate (R21, K31) ---- */

  /** R21 (K182): the slot `ai-runs` fills (its R37), as `legacy-store` did until then. `gate(run, viewer, caller)` answers
   *  `{found, running, refusal}`: `found` false for a blank, absent or invisible run alike (§7.9); `running` whether
   *  it is still running; `refusal` null, or ai-runs R5's `AI_RUN_NOT_PRINCIPAL` (C-22.12) for a caller who is not
   *  the run's principal, which R13 relays. One gate: a second registration is refused. */
  registerRunGate(module, gate) {
    if (typeof module !== "string" || !module.trim() || typeof gate !== "function")
      return { ok: false, reason: RUN_GATE_MALFORMED, detail: "a run gate is registered by a module name and a function" };
    if (this.#runGate)
      return { ok: false, reason: RUN_GATE_DECLARED, module: this.#runGate.module,
               detail: `the run gate is already registered by ${this.#runGate.module}` };
    this.#runGate = { module, gate };
    return { ok: true, module };
  }

  /* ---- sight (membership R43; R10) ---- */

  /** The viewer gate compiled into a statement over a QUALIFIED bundle column: a machine sees everything, an absent
   *  or unrecognised viewer nothing, a member through membership's predicate over record-core's `bundles` (its R37).
   *  A NULL column names no bundle and passes; one naming a bundle that is gone is withheld (fail closed).
   *
   *  THE COLUMN MUST BE QUALIFIED, and this refuses an unqualified one rather than trusting a caller to remember:
   *  inside the EXISTS subquery a bare `bundle_id` resolves against `bundles` — the INNER table — so the gate would
   *  pass every row while looking exactly like a gate. */
  #gate(col, viewer) {
    if (typeof col !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
      throw new Error(`REFUSED: the D-15 bundle gate needs a QUALIFIED column (got ${col}). `
        + "An unqualified name binds to `bundles` inside the gate's own subquery and passes everything.");
    const g = viewerPredicate(viewer);
    if (g.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (g.scope === "DENY") return { sql: g.sql, args: [] };
    return { sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_id = ${col} AND (${g.sql})))`,
             args: g.args };
  }

  /* ===================================================================== *
   * THE PAIRING READ (REC-146 / IC-167; R5–R12). Section 9 item 1.
   * ===================================================================== */

  /** R48 (DEC-77 item 1): aspirations are in contact, never in contradiction, so no key pairs a side that lives in
   *  one. A condition on a qualified bundle column, as the gate is. */
  static #notAspiration(col) {
    return `NOT EXISTS (SELECT 1 FROM bundles asp WHERE asp.bundle_id = ${col} AND asp.object_type = 'aspiration')`;
  }

  /** R9: the doctype and the document's OWN DATE for one capture, never as this module infers them. BOTH ARE
   *  THREE-VALUED AND THE THIRD VALUE IS THE POINT (section 4): *a document date or a doctype that is not stated is
   *  UNDETERMINED, and a pair that needs one is not formed on a guess.* So `null` here is returned and counted, and
   *  `read` keeps apart a capture nobody has read from a reading that states no value.
   *
   *  The doctype is the reading's `content_type` (extraction R58), as its reader states it. The date is the document's
   *  own, as `events` holds it for the capture (its dated facts, `datedFactsFor`, events R27), read under `viewer`:
   *  one held is the date; several are the date when they agree, or else the one whose value the reading itself states
   *  (extraction R30's `readingOf`) when exactly one does. An "on or before" bound (events R24) is a bound, not the
   *  document's date. None held, or several the reading does not settle, is no date — never the content row's,
   *  the capture's or the registration's time, which are facts about US. Answers `{read, doctype, date, dated}`:
   *  `date` the value as stated, `dated` the civil-time value `{value, precision, zone}` it is compared as. */
  #doc(captureSha, memo, viewer = INTERNAL) {
    const k = `${captureSha}\u0000${viewer ?? ""}`;
    if (memo.has(k)) return memo.get(k);
    const row = this.#one(`SELECT content_type FROM readings WHERE capture_sha=? LIMIT 1`, captureSha);
    const s = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const out = { read: !!row, doctype: row ? s(row.content_type) : null, date: null, dated: null };
    const dated = this.#ownDate(captureSha, viewer, row);
    if (dated) Object.assign(out, { date: dated.value, dated });
    memo.set(k, out);
    return out;
  }

  /** R9: a capture's own date as `events` holds it, or null (see `#doc`). */
  #ownDate(captureSha, viewer, readingRow) {
    const ev = this.#ev();
    if (!captureSha || !ev || typeof ev.datedFactsFor !== "function") return null;
    let held;
    try { held = ev.datedFactsFor({ captureSha, viewer }); } catch { return null; }
    const facts = (held && held.ok !== false && Array.isArray(held.dated_facts) ? held.dated_facts : [])
      .filter((f) => f && !f.upper_bound && typeof f.value === "string" && f.value.trim());
    const val = (f) => ({ value: f.value.trim(), precision: f.precision, zone: f.zone ?? null });
    const same = (x, y) => x.value === y.value && x.precision === y.precision && x.zone === y.zone;
    if (!facts.length) return null;
    const vs = facts.map(val);
    if (vs.every((v) => same(v, vs[0]))) return vs[0];
    let stated = null;
    if (readingRow) {
      const r = this.#x() && typeof this.#x().readingOf === "function" ? this.#x().readingOf(captureSha) : null;
      const reading = r && r.reading && typeof r.reading === "object" ? r.reading : null;
      stated = reading && typeof reading.date === "string" && reading.date.trim() ? reading.date.trim() : null;
    }
    const match = stated ? vs.filter((v) => v.value === stated) : [];
    return match.length && match.every((v) => same(v, match[0])) ? match[0] : null;
  }

  /** R9: two own dates compared through `civil-time.compare` at their precision (never as raw strings): `before`,
   *  `after`, `same` (one value at one precision and zone: the dates agree) or `undetermined` (a band, a coarser
   *  precision, a zone not stated, or anything compare does not settle). */
  static #order(x, y) {
    if (!x || !y) return "undetermined";
    if (x.value === y.value && x.precision === y.precision && x.zone === y.zone) return "same";
    if (typeof x.zone !== "string" || typeof y.zone !== "string") return "undetermined";
    let c;
    try { c = compare(x, y); } catch { return "undetermined"; }
    return c === "before" || c === "after" ? c : "undetermined";
  }

  /** R8: one leg's side of a pair, with the passage it rests on RESOLVED — the ref a member reads and the capture it
   *  is a part of (content R45). The leg alone names a content id, which is a hash and tells a reader nothing about
   *  what was cited. Section 5 requires both sides to travel with their referents; null when the row is not held. */
  #extent(kind, side) {
    const row = side.content_id
      ? this.#one(`SELECT capture_sha, ref, extent_kind, stale FROM content WHERE content_id=? LIMIT 1`, side.content_id)
      : null;
    return { kind, ...side,
             capture_sha: row ? row.capture_sha : null,
             ref: row ? row.ref : null,
             extent_kind: row ? row.extent_kind : null,
             stale: row ? !!row.stale : null };
  }

  /** R8 K1 — one inquiry, opposite roles. A `supports` leg and a `cuts_against` leg of the SAME inquiry, each with a
   *  content referent. BOUNDED AT THE SQL AND NOT IN JAVASCRIPT (D-365): a published `truncated` over a scan that
   *  read everything is an envelope staying honest about a read that was not bounded at all. The statement
   *  OVER-FETCHES BY ONE so truncation is OBSERVED rather than inferred from equality with the bound (R7). */
  #k1(viewer, cap) {
    const g = this.#gate("s.bundle_id", viewer);
    const rows = this.#rows(
      `SELECT s.bundle_id AS inquiry, s.ord AS a_ord, s.target_id AS a_target,
              s.content_id AS a_content, s.note AS a_note,
              c.ord AS b_ord, c.target_id AS b_target, c.content_id AS b_content, c.note AS b_note
         FROM inquiry_basis s
         JOIN inquiry_basis c ON c.bundle_id = s.bundle_id
        WHERE s.role = 'supports' AND c.role = 'cuts_against'
          AND s.content_id IS NOT NULL AND c.content_id IS NOT NULL
          AND ${Contradiction.#notAspiration("s.bundle_id")}
          AND (${g.sql})
        ORDER BY s.bundle_id, s.ord, c.ord
        LIMIT ?`, ...g.args, cap + 1);
    const truncated = rows.length > cap;
    const pairs = (truncated ? rows.slice(0, cap) : rows).map((r) => ({
      key: "K1", inquiry: r.inquiry,
      a: this.#extent("leg", { inquiry: r.inquiry, ord: r.a_ord, role: "supports",
                               target: r.a_target, content_id: r.a_content, note: r.a_note }),
      b: this.#extent("leg", { inquiry: r.inquiry, ord: r.b_ord, role: "cuts_against",
                               target: r.b_target, content_id: r.b_content, note: r.b_note }),
      why: word("contradiction.why.question_already_rests"),
    }));
    return { pairs, truncated, notes: [] };
  }

  /** R8 K2 — one subject, two held claims. Two inquiries with the same subject entity (inquiry R40's
   *  `inquiry_bundle_facts.inquiry_subject_entity`; a bundle with no row has none), each with an
   *  ACCEPTED, unhidden reading carrying a `claim`. `hidden = 0` AND `state = 'accepted'` ARE BOTH REQUIRED AND THEY
   *  ARE DIFFERENT RULES: a suggested, considering or rejected version is not held (section 3), and a HIDDEN accepted
   *  version is one the group PRUNED. `bundle_id >` RATHER THAN `<>` IS WHAT MAKES A PAIR ONE PAIR: without it every
   *  pair appears twice, once from each side (R8). */
  #k2(viewer, cap) {
    const ga = this.#gate("v1.bundle_id", viewer);
    const gb = this.#gate("v2.bundle_id", viewer);
    const rows = this.#rows(
      `SELECT v1.bundle_id AS a_inquiry, v1.name AS a_version, v1.claim AS a_claim,
              v2.bundle_id AS b_inquiry, v2.name AS b_version, v2.claim AS b_claim,
              f1.inquiry_subject_entity AS entity_id, d1.title AS a_title, d2.title AS b_title
         FROM inquiry_basis_versions v1
         JOIN inquiry_bundle_facts f1 ON f1.bundle_id = v1.bundle_id
         JOIN inquiry_bundle_facts f2 ON f2.inquiry_subject_entity = f1.inquiry_subject_entity
                                     AND f2.bundle_id > f1.bundle_id
         JOIN bundles d1 ON d1.bundle_id = f1.bundle_id
         JOIN bundles d2 ON d2.bundle_id = f2.bundle_id
         JOIN inquiry_basis_versions v2 ON v2.bundle_id = d2.bundle_id
        WHERE v1.state = 'accepted' AND v2.state = 'accepted'
          AND v1.hidden = 0 AND v2.hidden = 0
          AND v1.claim IS NOT NULL AND v1.claim <> ''
          AND v2.claim IS NOT NULL AND v2.claim <> ''
          AND f1.inquiry_subject_entity IS NOT NULL AND f1.inquiry_subject_entity <> ''
          AND d1.object_type <> 'aspiration' AND d2.object_type <> 'aspiration'
          AND (${ga.sql}) AND (${gb.sql})
        ORDER BY f1.inquiry_subject_entity, v1.bundle_id, v1.name, v2.bundle_id, v2.name
        LIMIT ?`, ...ga.args, ...gb.args, cap + 1);
    const truncated = rows.length > cap;
    const pairs = (truncated ? rows.slice(0, cap) : rows).map((r) => ({
      key: "K2", subject_entity: r.entity_id,
      a: { kind: "claim", inquiry: r.a_inquiry, title: r.a_title ?? null, version: r.a_version, claim: r.a_claim },
      b: { kind: "claim", inquiry: r.b_inquiry, title: r.b_title ?? null, version: r.b_version, claim: r.b_claim },
      why: word("contradiction.why.two_questions_registered"),
    }));
    return { pairs, truncated, notes: [] };
  }

  /** K3 arm (a) — two accepted readings, of DIFFERENT inquiries, whose version legs rest on the SAME content row. */
  #k3Same(viewer, cap) {
    const ga = this.#gate("v1.bundle_id", viewer);
    const gb = this.#gate("v2.bundle_id", viewer);
    const rows = this.#rows(
      `SELECT v1.bundle_id AS a_inquiry, v1.name AS a_version, v1.claim AS a_claim, l1.ord AS a_ord,
              v2.bundle_id AS b_inquiry, v2.name AS b_version, v2.claim AS b_claim, l2.ord AS b_ord,
              l1.content_id AS content_id
         FROM inquiry_basis_version_legs l1
         JOIN inquiry_basis_versions v1 ON v1.bundle_id = l1.bundle_id AND v1.name = l1.name
         JOIN inquiry_basis_version_legs l2 ON l2.content_id = l1.content_id
                                           AND l2.bundle_id > l1.bundle_id
         JOIN inquiry_basis_versions v2 ON v2.bundle_id = l2.bundle_id AND v2.name = l2.name
        WHERE l1.content_id IS NOT NULL
          AND ${Contradiction.#notAspiration("v1.bundle_id")} AND ${Contradiction.#notAspiration("v2.bundle_id")}
          AND v1.state = 'accepted' AND v2.state = 'accepted'
          AND v1.hidden = 0 AND v2.hidden = 0
          AND v1.claim IS NOT NULL AND v1.claim <> ''
          AND v2.claim IS NOT NULL AND v2.claim <> ''
          AND (${ga.sql}) AND (${gb.sql})
        ORDER BY l1.content_id, v1.bundle_id, v1.name, v2.bundle_id, v2.name
        LIMIT ?`, ...ga.args, ...gb.args, cap + 1);
    const truncated = rows.length > cap;
    return { rows: truncated ? rows.slice(0, cap) : rows, truncated };
  }

  /** K3 arm (b) — THE SAME QUESTION WHERE NO PASSAGE IS NAMED, as a SECOND STATEMENT rather than a `UNION`: D-36's
   *  workerd ceiling of five compound terms, and a union would publish ONE figure over two joins that mean different
   *  things. A NULL `content_id` is one of three facts — the leg rests on an INQUIRY, the record holds no bytes of the
   *  document, or the row is a replay — and only the last two name a DOCUMENT, so this arm requires `target_type =
   *  'information'` on both sides: two claims resting on the same sub-QUESTION are not two readings of one text. */
  #k3Doc(viewer, cap) {
    const ga = this.#gate("v1.bundle_id", viewer);
    const gb = this.#gate("v2.bundle_id", viewer);
    const rows = this.#rows(
      `SELECT v1.bundle_id AS a_inquiry, v1.name AS a_version, v1.claim AS a_claim, l1.ord AS a_ord,
              v2.bundle_id AS b_inquiry, v2.name AS b_version, v2.claim AS b_claim, l2.ord AS b_ord,
              l1.target_id AS target_id
         FROM inquiry_basis_version_legs l1
         JOIN inquiry_basis_versions v1 ON v1.bundle_id = l1.bundle_id AND v1.name = l1.name
         JOIN inquiry_basis_version_legs l2 ON l2.target_id = l1.target_id
                                           AND l2.bundle_id > l1.bundle_id
                                           AND l2.content_id IS NULL
         JOIN inquiry_basis_versions v2 ON v2.bundle_id = l2.bundle_id AND v2.name = l2.name
        WHERE l1.content_id IS NULL AND l1.target_type = 'information'
          AND l2.target_type = 'information'
          AND ${Contradiction.#notAspiration("v1.bundle_id")} AND ${Contradiction.#notAspiration("v2.bundle_id")}
          AND v1.state = 'accepted' AND v2.state = 'accepted'
          AND v1.hidden = 0 AND v2.hidden = 0
          AND v1.claim IS NOT NULL AND v1.claim <> ''
          AND v2.claim IS NOT NULL AND v2.claim <> ''
          AND (${ga.sql}) AND (${gb.sql})
        ORDER BY l1.target_id, v1.bundle_id, v1.name, v2.bundle_id, v2.name
        LIMIT ?`, ...ga.args, ...gb.args, cap + 1);
    const truncated = rows.length > cap;
    return { rows: truncated ? rows.slice(0, cap) : rows, truncated };
  }

  /** R7, R8 K3 — both arms, each bounded on its own and each SAID in `arms`. */
  #k3(viewer, cap) {
    const same = this.#k3Same(viewer, cap);
    const doc = this.#k3Doc(viewer, cap);
    const mk = (r, referent) => ({
      key: "K3", ...referent,
      a: { kind: "claim", inquiry: r.a_inquiry, version: r.a_version, claim: r.a_claim, ord: r.a_ord },
      b: { kind: "claim", inquiry: r.b_inquiry, version: r.b_version, claim: r.b_claim, ord: r.b_ord },
      why: referent.content_id
        ? word("contradiction.why.two_questions_whose")
        : word("contradiction.why.two_questions_whose_accepted"),
    });
    const pairs = [
      ...same.rows.map((r) => mk(r, { content_id: r.content_id, referent_grain: "passage" })),
      ...doc.rows.map((r) => mk(r, { content_id: null, document: r.target_id, referent_grain: "document" })),
    ];
    return { pairs, truncated: same.truncated || doc.truncated,
             arms: { passage: { formed: same.rows.length, truncated: same.truncated },
                     document: { formed: doc.rows.length, truncated: doc.truncated } },
             notes: [] };
  }

  /** A content row cited by a leg or a version leg of an inquiry this viewer may see (the gate on the CITING
   *  inquiry: a passage cited only by a question the viewer cannot see is not cited as this viewer can see it, so
   *  neither the pair nor the ladder discloses that the hidden question cites it). */
  #citedBy(col, viewer) {
    const gi = this.#gate("ib.bundle_id", viewer);
    const gl = this.#gate("vl.bundle_id", viewer);
    return { sql: `(EXISTS (SELECT 1 FROM inquiry_basis ib WHERE ib.content_id = ${col} AND (${gi.sql}))
                    OR EXISTS (SELECT 1 FROM inquiry_basis_version_legs vl WHERE vl.content_id = ${col} AND (${gl.sql})))`,
             args: [...gi.args, ...gl.args] };
  }

  /** R8, R9 K4 — one entity, two sources of different kind or DATE.
   *
   *  THE SQL FINDS CANDIDATES AND THE JAVASCRIPT DECIDES, and the division is the item's honesty requirement: the
   *  join can say *these two documents resolve, established, to one entity, and somebody has cited a passage of
   *  each*; it CANNOT say whether their kinds or dates differ, because a reader's date lives inside the reading. So
   *  the discriminator is applied here, where the third answer — UNDETERMINED — can be COUNTED and the pair left
   *  unformed.
   *
   *  `established = 1` ON BOTH ENDS IS SECTION 4's WORD AND IT IS LOAD-BEARING: a C-tier correspondence is expressly
   *  flagged for a member to confirm, and pairing on it would manufacture a world-contradiction candidate out of two
   *  documents nobody has agreed are about one thing. `DISTINCT` IS NOT COSMETIC: `resolutions` holds one row per
   *  (capture, reference, entity), so one document naming a subject five times would count one pair five times. */
  #k4(viewer, cap) {
    const ga = this.#gate("c1.bundle_id", viewer);
    const gb = this.#gate("c2.bundle_id", viewer);
    const ca = this.#citedBy("c1.content_id", viewer);
    const cb = this.#citedBy("c2.content_id", viewer);
    const rows = this.#rows(
      `SELECT DISTINCT c1.content_id AS a_content, c1.capture_sha AS a_capture, c1.ref AS a_ref,
              c1.extent_kind AS a_kind,
              c2.content_id AS b_content, c2.capture_sha AS b_capture, c2.ref AS b_ref,
              c2.extent_kind AS b_kind, r1.entity_id AS entity_id
         FROM content c1
         JOIN resolutions r1 ON r1.capture_sha = c1.capture_sha AND r1.established = 1
         JOIN resolutions r2 ON r2.entity_id = r1.entity_id AND r2.established = 1
                            AND r2.capture_sha > r1.capture_sha
         JOIN content c2 ON c2.capture_sha = r2.capture_sha
        WHERE ${ca.sql} AND ${cb.sql}
          AND ${Contradiction.#notAspiration("c1.bundle_id")} AND ${Contradiction.#notAspiration("c2.bundle_id")}
          AND (${ga.sql}) AND (${gb.sql})
        ORDER BY r1.entity_id, c1.content_id, c2.content_id
        LIMIT ?`, ...ca.args, ...cb.args, ...ga.args, ...gb.args, cap + 1);
    const truncated = rows.length > cap;
    const memo = new Map();
    const pairs = []; let undetermined = 0, indistinct = 0;
    const missing = { never_read: 0, no_doctype: 0, no_date: 0, order_undetermined: 0 };
    const side = (r, s, d) => ({ kind: "extent", content_id: r[`${s}_content`], capture_sha: r[`${s}_capture`], ref: r[`${s}_ref`],
                                 extent_kind: r[`${s}_kind`], doctype: d.doctype, date: d.date,
                                 ...(d.dated ? { date_precision: d.dated.precision, date_zone: d.dated.zone } : {}), read: d.read });
    for (const r of truncated ? rows.slice(0, cap) : rows) {
      const da = this.#doc(r.a_capture, memo, viewer);
      const db = this.#doc(r.b_capture, memo, viewer);
      const kindsKnown = !!da.doctype && !!db.doctype;
      const datesKnown = !!da.dated && !!db.dated;
      /* R9: the dates tell the two apart only when civil-time settles their order; equal values agree. */
      const order = datesKnown ? Contradiction.#order(da.dated, db.dated) : null;
      const discriminator = kindsKnown && da.doctype !== db.doctype ? "doctype"
                          : order === "before" || order === "after" ? "date" : null;
      if (discriminator) {
        pairs.push({
          key: "K4", entity_id: r.entity_id, discriminator, ...(discriminator === "date" ? { order: order === "before" ? "a_first" : "b_first" } : {}),
          a: side(r, "a", da), b: side(r, "b", db),
          why: discriminator === "doctype"
            ? word("contradiction.why.two_documents_record")
            : word("contradiction.why.two_documents_record_established"),
        });
        continue;
      }
      if (kindsKnown && order === "same") { indistinct += 1; continue; }
      /* UNDETERMINED, AND IT IS COUNTED RATHER THAN ROUNDED TO EITHER NEIGHBOUR (R9). Section 4: *a pair that needs a
         date or a doctype that is not stated is not formed on a guess*, and neither is one whose dates' order the
         precision held does not settle. The count is what stops that refusal reading as "these two agree". */
      undetermined += 1;
      if (!da.read || !db.read) missing.never_read += 1;
      else if (!kindsKnown) missing.no_doctype += 1;
      else if (!datesKnown) missing.no_date += 1;
      else missing.order_undetermined += 1;
    }
    return { pairs, truncated, undetermined, indistinct, missing,
             notes: undetermined
               ? [word("contradiction.notes.candidate_pair_formed", { undetermined, never_read: missing.never_read,
                   no_doctype: missing.no_doctype, no_date: missing.no_date, order_undetermined: missing.order_undetermined })]
               : [] };
  }

  /** K5 (N345, DEC-84 item 3) — one question, two projects' conclusions. For each inquiry this viewer may see, in id
   *  order, the projects the viewer may see that draw on it (`basis-versions` R37, at `FULL`, membership R44) and each
   *  one's stance read through `conclusionOf` (its R22): two stances both `concluded`, adopting claims whose text
   *  differs, are a pair, counted once (the lower project id is side A). The same scan answers K5's ladder (R11), so a
   *  rung and the join cannot disagree. At most `K5_INQUIRIES_EXAMINED` inquiries are examined; reaching it with more
   *  left is truncation, and a note says so. */
  #k5(viewer, cap) {
    const bv = this.#b();
    const found = { inquiry: false, drawing_projects: false, concluded_stances: false, differing_claim: false };
    const pairs = [];
    let truncated = false, examinedCut = false;
    const claims = new Set();
    if (!bv || typeof bv.projectsDrawingOn !== "function" || typeof bv.conclusionOf !== "function")
      return { pairs, truncated, found, notes: [word("contradiction.notes.basis_versions_reads")] };
    const vp = viewerPredicate(viewer);
    let after = "", examined = 0;
    outer: for (;;) {
      const page = this.#rows(
        `SELECT b.bundle_id AS id FROM bundles b WHERE b.object_type='inquiry' AND b.bundle_id > ? AND (${vp.sql})
          ORDER BY b.bundle_id LIMIT 100`, after, ...vp.args);
      if (!page.length) break;
      for (const r of page) {
        after = r.id;
        if (examined >= K5_INQUIRIES_EXAMINED) { truncated = true; examinedCut = true; break outer; }
        examined += 1;
        found.inquiry = true;
        const projects = bv.projectsDrawingOn(r.id, viewer) || [];
        if (projects.length) found.drawing_projects = true;
        const stances = [];
        for (const pr of projects) {
          const st = bv.conclusionOf(pr.id, r.id, viewer);
          const text = st ? (typeof st.claim === "string" ? st.claim : st.claim && typeof st.claim.text === "string" ? st.claim.text : null) : null;
          if (!st || text === null || !text.trim()) continue;
          found.concluded_stances = true;
          stances.push({ project: pr.id, version: st.version ?? null, claim: text });
          claims.add(text.trim());
        }
        if (claims.size > 1) found.differing_claim = true;
        stances.sort((x, y) => (x.project < y.project ? -1 : x.project > y.project ? 1 : 0));
        for (let i = 0; i < stances.length; i++) for (let j = i + 1; j < stances.length; j++) {
          const a = stances[i], b = stances[j];
          if (a.claim.trim() === b.claim.trim()) continue;
          if (pairs.length === cap) { truncated = true; break outer; }
          pairs.push({
            key: "K5", inquiry: r.id,
            a: { kind: "stance", inquiry: r.id, project: a.project, version: a.version, claim: a.claim },
            b: { kind: "stance", inquiry: r.id, project: b.project, version: b.version, claim: b.claim },
            why: word("contradiction.why.two_projects_concluded"),
          });
        }
      }
      if (page.length < 100) break;
    }
    return { pairs, truncated, found,
             notes: examinedCut ? [word("contradiction.notes.key_examined_first", { k5_inquiries_examined: K5_INQUIRIES_EXAMINED })] : [] };
  }

  /** Whether `money`'s read contract is held in this store (its R19): K6 compares nothing, and says so, without it. */
  #moneyHeld() {
    return !!this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='money_facts'`);
  }

  /** R8 K6 — two amounts for one transfer (ladders §5C.4). THE SQL FINDS CANDIDATES OVER MONEY'S READ CONTRACT (its R19)
   *  AND MONEY DECIDES: two standing facts with the same payer and payee ENTITIES (a fund or an unresolved name is not
   *  one), the same kind, phase and stage, and periods that overlap, both seen by the viewer through their source's
   *  sight (`sight_bundle`, money R21; R10); `money.reconcile` then says whether the amounts differ beyond the coarser
   *  figure's precision, and its differing dimensions travel with the pair as context (R28), so a member can see
   *  whether a basis, period or rounding difference explains it. A period whose end is not stated does not settle an
   *  overlap: the pair is not formed, and is counted. Bounded at the statement, over-fetching one (D-365, R7). */
  #k6(viewer, cap) {
    const empty = { pairs: [], truncated: false, notes: [] };
    if (!this.#moneyHeld()) return { ...empty, notes: [word("contradiction.notes.money_facts_held")] };
    const mo = this.#mo();
    if (!mo || typeof mo.reconcile !== "function")
      return { ...empty, notes: [word("contradiction.notes.money_reconciliation_reachable")] };
    const ga = this.#gate("f1.sight_bundle", viewer);
    const gb = this.#gate("f2.sight_bundle", viewer);
    const rows = this.#rows(
      `SELECT f1.fact_id AS a_fact, f2.fact_id AS b_fact, f1.from_entity AS payer, f1.to_entity AS payee,
              f1.period_end AS a_end, f2.period_end AS b_end
         FROM money_facts f1
         JOIN money_facts f2 ON f2.from_entity = f1.from_entity AND f2.to_entity = f1.to_entity
                            AND f2.kind = f1.kind AND f2.phase = f1.phase AND f2.stage IS f1.stage
                            AND f2.fact_id > f1.fact_id
        WHERE f1.withdrawn_at IS NULL AND f2.withdrawn_at IS NULL
          AND f1.from_entity IS NOT NULL AND f1.to_entity IS NOT NULL
          AND (f1.period_end IS NULL OR f1.period_end > f2.period_start)
          AND (f2.period_end IS NULL OR f2.period_end > f1.period_start)
          AND (${ga.sql}) AND (${gb.sql})
        ORDER BY f1.from_entity, f1.to_entity, f1.fact_id, f2.fact_id
        LIMIT ?`, ...ga.args, ...gb.args, cap + 1);
    const truncated = rows.length > cap;
    const pairs = [];
    let openPeriod = 0, agreeing = 0;
    for (const r of truncated ? rows.slice(0, cap) : rows) {
      if (r.a_end === null || r.b_end === null) { openPeriod += 1; continue; }
      let rec;
      try { rec = mo.reconcile({ a: r.a_fact, b: r.b_fact, viewer }); } catch { rec = null; }
      if (!rec || rec.ok === false || rec.consistent || rec.amounts !== "differ") { agreeing += 1; continue; }
      pairs.push({
        key: "K6", payer: r.payer, payee: r.payee,
        a: this.#moneySide(r.a_fact), b: this.#moneySide(r.b_fact),
        differs: rec.differs,
        why: word("contradiction.why.two_sources_state_amounts"),
      });
    }
    const undetermined = openPeriod;
    return { pairs, truncated, undetermined, consistent: agreeing,
             notes: [
               ...(openPeriod ? [word("contradiction.notes.candidate_pair_formed_because", { open_period: openPeriod })] : []),
               ...(agreeing ? [word("contradiction.notes.candidate_pair_formed_because_money", { agreeing })] : []) ] };
  }

  /** R8: a K6 side, `{kind: "money", fact, capture_sha, ref, amount, period, stage}`, from money's read contract (its
   *  R19): the capture its source extent is in (through the facts it cites, at most 32 deep), the reference a member
   *  reads, the figure as stated with its currency and precision, its accounting period and its stage. */
  #moneySide(factId) {
    const f = this.#one(`SELECT * FROM money_facts WHERE fact_id=?`, factId);
    if (!f) return { kind: "money", fact: factId, capture_sha: null, ref: null, amount: null, period: null, stage: null };
    let root = f, capture = f.source_capture_sha ?? null;
    for (let i = 0; !capture && root && root.source_fact && i < 32; i++) {
      root = this.#one(`SELECT * FROM money_facts WHERE fact_id=?`, root.source_fact);
      capture = root ? root.source_capture_sha ?? null : null;
    }
    const content = f.source_content_id
      ? this.#one(`SELECT ref FROM content WHERE content_id=?`, f.source_content_id) : null;
    const ref = content ? content.ref
      : f.source_table ? word("contradiction.text.row_table", { source_row: f.source_row, source_table: f.source_table })
      : f.source_fact ? `money fact ${f.source_fact}` : null;
    const amount = f.precision === "range"
      ? { low: f.amount_low, high: f.amount_high, currency: f.currency, precision: f.precision, as_read: f.as_read }
      : { value: f.amount, currency: f.currency, precision: f.precision, as_read: f.as_read };
    return { kind: "money", fact: f.fact_id, capture_sha: capture, ref, amount,
             period: { from: f.period_from, to: f.period_to, precision: f.period_precision, zone: f.period_zone },
             stage: f.stage ?? null };
  }

  /** R11: WHICH LEVEL WAS EMPTY, SAID RATHER THAN LEFT TO BE INFERRED. A LADDER OF EXISTENCE PROBES, and existence is
   *  deliberately not a count: a census would cost an unbounded scan per rung on the one surface whose subject is
   *  that the record is sparse. Each probe is `LIMIT 1` and rides the same viewer gate as the key's own join, so a
   *  rung never reports material this caller may not see.
   *
   *  THE FIRST RUNG THAT IS EMPTY IS THE ANSWER, because absence at one level is not evidence of absence at the next.
   *  `viewer` IS A RUNG AND IT IS THE FIRST ONE: a read made with no viewer stamp, or one the gate does not recognise,
   *  is empty for a reason that is not about the record at all (R10), and nothing below it can be believed when it
   *  fires. */
  #ladder(key, viewer, scope, out = null) {
    const rung = (level, sql, ...args) => ({ level, present: !!this.#one(sql, ...args) });
    if (scope === "DENY") return [{ level: "viewer", present: false }];
    /* K5's rungs are read from its own scan, under the same gate, rather than probed a second time. */
    if (key === "K5") {
      const f = (out && out.found) || {};
      return [{ level: "viewer", present: true }, { level: "inquiry", present: !!f.inquiry },
              { level: "drawing_projects", present: !!f.drawing_projects },
              { level: "concluded_stances", present: !!f.concluded_stances },
              { level: "differing_claim", present: !!f.differing_claim }];
    }
    if (key === "K6") return this.#moneyLadder(viewer);
    const gi = this.#gate("ib.bundle_id", viewer);
    const gv = this.#gate("v.bundle_id", viewer);
    const gs = this.#gate("s.bundle_id", viewer);
    const vp = viewerPredicate(viewer);
    const anyInquiry = () => rung("inquiry",
      `SELECT 1 AS x FROM bundles b WHERE b.object_type='inquiry' AND (${vp.sql}) LIMIT 1`, ...vp.args);
    const heldReading = (extra) => this.#one(
      `SELECT 1 AS x FROM inquiry_basis_versions v
        WHERE v.state='accepted' AND v.hidden=0 ${extra} AND (${gv.sql}) LIMIT 1`, ...gv.args);
    if (key === "K1") return [
      { level: "viewer", present: true }, anyInquiry(),
      rung("leg", `SELECT 1 AS x FROM inquiry_basis ib WHERE (${gi.sql}) LIMIT 1`, ...gi.args),
      rung("role", `SELECT 1 AS x FROM inquiry_basis s JOIN inquiry_basis c ON c.bundle_id=s.bundle_id
                     WHERE s.role='supports' AND c.role='cuts_against' AND (${gs.sql}) LIMIT 1`, ...gs.args),
      rung("referent", `SELECT 1 AS x FROM inquiry_basis s JOIN inquiry_basis c ON c.bundle_id=s.bundle_id
                         WHERE s.role='supports' AND c.role='cuts_against'
                           AND s.content_id IS NOT NULL AND c.content_id IS NOT NULL
                           AND (${gs.sql}) LIMIT 1`, ...gs.args),
    ];
    if (key === "K2") return [
      { level: "viewer", present: true }, anyInquiry(),
      rung("subject", `SELECT 1 AS x FROM inquiry_bundle_facts f JOIN bundles b ON b.bundle_id = f.bundle_id
                        WHERE f.inquiry_subject_entity IS NOT NULL AND f.inquiry_subject_entity <> ''
                          AND (${vp.sql}) LIMIT 1`, ...vp.args),
      { level: "reading", present: !!heldReading("") },
      { level: "claim", present: !!heldReading("AND v.claim IS NOT NULL AND v.claim <> ''") },
    ];
    if (key === "K3") return [
      { level: "viewer", present: true }, anyInquiry(),
      { level: "reading", present: !!heldReading("") },
      { level: "claim", present: !!heldReading("AND v.claim IS NOT NULL AND v.claim <> ''") },
      rung("referent", `SELECT 1 AS x FROM inquiry_basis_version_legs l
                         JOIN inquiry_basis_versions v ON v.bundle_id=l.bundle_id AND v.name=l.name
                        WHERE v.state='accepted' AND v.hidden=0
                          AND v.claim IS NOT NULL AND v.claim <> ''
                          AND (l.content_id IS NOT NULL OR l.target_type='information')
                          AND (${gv.sql}) LIMIT 1`, ...gv.args),
    ];
    const gc = this.#gate("c.bundle_id", viewer);
    const cited = this.#citedBy("c.content_id", viewer);
    const g1 = this.#gate("c1.bundle_id", viewer);
    const g2 = this.#gate("c2.bundle_id", viewer);
    return [
      { level: "viewer", present: true },
      rung("content", `SELECT 1 AS x FROM content c WHERE (${gc.sql}) LIMIT 1`, ...gc.args),
      rung("cited", `SELECT 1 AS x FROM content c WHERE ${cited.sql} AND (${gc.sql}) LIMIT 1`, ...cited.args, ...gc.args),
      rung("resolution", `SELECT 1 AS x FROM content c
                           JOIN resolutions r ON r.capture_sha=c.capture_sha AND r.established=1
                          WHERE (${gc.sql}) LIMIT 1`, ...gc.args),
      /* The same sight as every rung above: two established resolutions of different documents to one entity, each
         document holding a passage this viewer may see (the key's own join is gated on its content rows). */
      rung("shared_entity", `SELECT 1 AS x FROM resolutions r1
                              JOIN resolutions r2 ON r2.entity_id=r1.entity_id AND r2.established=1
                                                 AND r2.capture_sha > r1.capture_sha
                             WHERE r1.established=1
                               AND EXISTS (SELECT 1 FROM content c1 WHERE c1.capture_sha=r1.capture_sha AND (${g1.sql}))
                               AND EXISTS (SELECT 1 FROM content c2 WHERE c2.capture_sha=r2.capture_sha AND (${g2.sql}))
                             LIMIT 1`, ...g1.args, ...g2.args),
    ];
  }

  /** R11 K6's rungs, each an existence probe under the viewer gate on both facts' sight: a standing fact; two naming one
   *  payer and one payee entity; two of those of one kind, phase and stage over periods that overlap (or whose ends are
   *  not stated); two of those whose figures differ as stated. With every rung present and nothing formed, K6's own
   *  last level names the join (money's reconciliation, or an unstated end). */
  #moneyLadder(viewer) {
    if (!this.#moneyHeld()) return [{ level: "viewer", present: true }, { level: "money_fact", present: false }];
    const g1 = this.#gate("f1.sight_bundle", viewer);
    const g2 = this.#gate("f2.sight_bundle", viewer);
    const g = this.#gate("f.sight_bundle", viewer);
    const pair = (extra) => !!this.#one(
      `SELECT 1 AS x FROM money_facts f1
         JOIN money_facts f2 ON f2.from_entity = f1.from_entity AND f2.to_entity = f1.to_entity AND f2.fact_id > f1.fact_id
        WHERE f1.withdrawn_at IS NULL AND f2.withdrawn_at IS NULL
          AND f1.from_entity IS NOT NULL AND f1.to_entity IS NOT NULL ${extra}
          AND (${g1.sql}) AND (${g2.sql}) LIMIT 1`, ...g1.args, ...g2.args);
    const same = `AND f2.kind = f1.kind AND f2.phase = f1.phase AND f2.stage IS f1.stage
                  AND (f1.period_end IS NULL OR f1.period_end > f2.period_start)
                  AND (f2.period_end IS NULL OR f2.period_end > f1.period_start)`;
    return [
      { level: "viewer", present: true },
      { level: "money_fact", present: !!this.#one(`SELECT 1 AS x FROM money_facts f WHERE f.withdrawn_at IS NULL AND (${g.sql}) LIMIT 1`, ...g.args) },
      { level: "same_parties", present: pair("") },
      { level: "same_stage_period", present: pair(same) },
      { level: "differing_amount", present: pair(`${same} AND (f1.amount IS NOT f2.amount OR f1.amount_low IS NOT f2.amount_low
                                                     OR f1.amount_high IS NOT f2.amount_high)`) },
    ];
  }

  /** op=contradictionpairs — THE PAIRING READ (R5–R12). A READ: it judges nothing and writes nothing, and both are
   *  said in the answer: `judgement.state` is `HELD_APART` and `wrote` is false.
   *
   *  WHY `judgement` IS PUBLISHED AS A FIELD AT ALL: a list of pairs with no verdict beside it reads as a list of
   *  CONTRADICTIONS. NO LABEL VOCABULARY IS PUBLISHED HERE (R12): the five labels are the JUDGEMENT's output, and
   *  publishing them from a surface that assigns none would read as a detector that had declined to label.
   *
   *  EACH KEY IS RUN EXACTLY ONCE (R7) and its result feeds both the per-key envelope and the flat pair list: two runs
   *  of one key over a store written between them would publish a `formed` figure that does not match the pairs. */
  pairs({ key = null, limit = null, viewer = null } = {}) {
    const names = Object.keys(CONTRADICTION_KEYS);
    const asked = key == null || String(key).trim() === "" ? null : String(key).trim().toUpperCase();
    /* DEC-49 REGION is-contradiction-key-unknown */
    if (asked !== null && !Object.prototype.hasOwnProperty.call(CONTRADICTION_KEYS, asked)) {
      const row = CONTRADICTION_PAIR_CHECKS.CONTRADICTION_KEY_UNKNOWN;
      return { ok: false, reason: "CONTRADICTION_KEY_UNKNOWN", code: "CONTRADICTION_KEY_UNKNOWN",
               check: row.check, translation: row.translation, keys: names,
               detail: localize("contradiction.index.pairs_holds_key", "the record pairs by {keys} and holds no key '{key}'",
                                { keys: names.join(", "), key: String(key).slice(0, 40) }) };
    }
    /* END DEC-49 REGION is-contradiction-key-unknown */
    /* R6: THE BOUND IS CLAMPED AND PUBLISHED, never refused. `truncated` is then a fact about THIS answer at THIS
       bound. */
    const max = CONTRADICTION_PAIRS_MAX;
    const n = limit === null || limit === undefined || limit === "" ? NaN : Number(limit);
    const cap = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), max) : max;
    const scope = viewerPredicate(viewer).scope;
    const denied = scope === "DENY";
    const run = new Set(asked ? [asked] : names);
    const pairs = [];

    const keys = names.map((name) => {
      const spec = CONTRADICTION_KEYS[name];
      if (!run.has(name))
        return { ...spec, ran: false, formed: 0, limit: cap, truncated: false, levels: null, notes: [],
                 absence: { level: "not_run",
                            says: word("contradiction.says.key_run_request", { asked, name }) } };
      const out = denied ? { pairs: [], truncated: false, notes: [] }
        : name === "K1" ? this.#k1(viewer, cap)
        : name === "K2" ? this.#k2(viewer, cap)
        : name === "K3" ? this.#k3(viewer, cap)
        : name === "K4" ? this.#k4(viewer, cap)
        : name === "K6" ? this.#k6(viewer, cap)
        : this.#k5(viewer, cap);
      pairs.push(...out.pairs);
      const ladder = this.#ladder(name, viewer, scope, out);
      /* THE FIRST EMPTY RUNG IS THE ANSWER. Where every rung is populated and the key still formed nothing, the join
         itself is what came back empty and the key's own last level names it — never a bare zero. */
      const empty = ladder.find((r) => !r.present);
      const level = out.pairs.length ? null : empty ? empty.level : LAST_LEVEL[name];
      return { ...spec, ran: true, formed: out.pairs.length, limit: cap, truncated: out.truncated,
               levels: ladder, notes: out.notes,
               absence: level === null ? null : { level, says: CONTRADICTION_ABSENCE[level] },
               ...(name === "K3" ? { arms: out.arms ?? { passage: { formed: 0, truncated: false },
                                                         document: { formed: 0, truncated: false } } } : {}),
               ...(name === "K4" && !denied
                 ? { undetermined: out.undetermined, indistinct: out.indistinct, undetermined_detail: out.missing }
                 : {}),
               ...(name === "K6" && !denied ? { undetermined: out.undetermined ?? 0, consistent: out.consistent ?? 0 } : {}) };
    });

    const formed = pairs.length;
    const undetermined = keys.reduce((a, k) => a + (k.undetermined || 0), 0);
    return {
      ok: true, wrote: false, pairs_formed: formed, limit: cap, bound: max, bounded: true,
      viewer_scope: scope, keys, pairs,
      /* R12 (N345): a run's judgements over these pairs are held APART from the pairing, and read through
         `candidatesFor` (R25), which shows each only at the weight its label and key give it. */
      judgement: {
        state: "HELD_APART",
        read: "candidatesFor",
        by: localize("contradiction.index.judgement_by", "the machine, inside an investigative run, as labelled machine work (DEC-24)"),
        why: word("contradiction.why.either_side_pair"),
      },
      says: denied
        ? word("contradiction.says.read_compared_because")
        : word("contradiction.says.candidate_pair_over", { formed, keys: [...run].join(", "),
            undetermined_clause: undetermined ? word("contradiction.says.further_pair_formed", { undetermined }) : "" }),
    };
  }

  /* ===================================================================== *
   * THE CANDIDATE DOOR (REC-147 / IC-318; R13–R17). Section 5, section 8, section 9 item 3.
   * ===================================================================== */

  /** R14: a side of a formed pair AS A REFERENT AT A VERSION (§8). A claim is the reading it is held on
   *  (`inquiry|version`), versioned by the SHA-256 of the claim text compared; a leg or an extent is its content row
   *  (or its capture where none is named), versioned by the capture, whose bytes never change. `bundle` is where the
   *  side lives, for purge (R22, D-113). */
  #side(s) {
    if (s && s.kind === "claim")
      return { kind: "claim", ref: `${String(s.inquiry ?? "")}|${String(s.version ?? "")}`,
               version: sha256HexSync(String(s.claim ?? "")), bundle: s.inquiry == null ? null : String(s.inquiry) };
    /* K5 (N345): a stance is its project's adoption on one inquiry at one version, versioned by the adopted claim's
       digest; it lives in its project's document, so the project is where a purge takes it. */
    if (s && s.kind === "stance")
      return { kind: "stance",
               ref: `${String(s.inquiry ?? "")}|${String(s.project ?? "")}|${String(s.version ?? "")}`,
               version: sha256HexSync(String(s.claim ?? "")), bundle: s.project == null ? null : String(s.project) };
    /* K6 (T33-48): a money fact is its id, versioned by the digest of what was compared (its figure, period and
       stage, as the plane read them); it lives where its source does (money R21), so that bundle's purge takes it. */
    if (s && s.kind === "money") {
      const f = s.fact == null ? null : this.#one(`SELECT sight_bundle FROM money_facts WHERE fact_id=?`, String(s.fact));
      return { kind: "money", ref: String(s.fact ?? ""),
               version: sha256HexSync(canonicalJson({ amount: s.amount ?? null, period: s.period ?? null, stage: s.stage ?? null })),
               bundle: f ? f.sight_bundle : null };
    }
    const cap = s?.capture_sha == null ? "" : String(s.capture_sha);
    const cid = s?.content_id == null || s.content_id === "" ? null : String(s.content_id);
    const home = cid ? this.#one(`SELECT bundle_id FROM content WHERE content_id=?`, cid)
      : cap ? this.#one(`SELECT bundle_id FROM content WHERE capture_sha=? ORDER BY bundle_id LIMIT 1`, cap) : null;
    return { kind: s?.kind === "leg" ? "leg" : "extent", ref: cid ?? cap, version: cap,
             bundle: home ? home.bundle_id : null };
  }

  /** R15, R17: THE ONE APPEND SITE of `contradiction_candidates` (§8). INSERT OR IGNORE on the candidate digest: a row
   *  over the same key and the same two referents at the same versions is already there, and is left exactly as it
   *  was. Answers whether a row was written. Nothing updates or deletes a candidate but its bundles' purge. */
  #append(row) {
    if (this.#one(`SELECT candidate FROM contradiction_candidates WHERE candidate=?`, row.candidate)) return false;
    const seq = (this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM contradiction_candidates`)?.n ?? 0) + 1;
    this.#sql.exec(
      `INSERT OR IGNORE INTO contradiction_candidates (candidate, key, a_kind, a_ref, a_version, a_bundle_id,
         b_kind, b_ref, b_version, b_bundle_id, run, proposed_by, label, reason, state, origin, at, a_side, b_side, seq)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'proposed',?,?,?,?,?)`,
      row.candidate, row.key, row.a.kind, row.a.ref, row.a.version, row.a.bundle,
      row.b.kind, row.b.ref, row.b.version, row.b.bundle, row.run, row.proposed_by, row.label, row.reason,
      row.origin ?? "machine", row.at,
      JSON.stringify(row.a_side), JSON.stringify(row.b_side), seq);
    return true;
  }

  /** op=contradictionpropose — A RUN'S JUDGEMENT OVER FORMED PAIRS ENTERS THE RECORD AS PROPOSED CANDIDATES (R13–R16).
   *
   *  The plane cannot judge (§2); what it holds is WHAT WAS COMPARED and WHAT WAS PROPOSED about it. So every refusal
   *  is asked of the whole batch before anything is written (a refused batch leaves nothing), and a proposal is
   *  written only when it names a pair the plane ITSELF forms for this viewer now, with the referents and versions
   *  the PLANE read — a pair a caller hands in is a provenance hop a caller can invent. A claim side must carry the
   *  claim text it judged: a claim that changed since is a different referent (R14), so that proposal is about a
   *  pair that is no longer formed and is refused rather than written against text the machine never saw.
   *
   *  THE LABEL IS A PROPOSAL (DEC-24): every row is `origin = 'machine'`, `state = 'proposed'`, and nothing here
   *  grades, edits or closes either side (R19). §7's over-strictness gate is a property of the JUDGEMENT (M-162
   *  measured the prompt `../contradiction.mjs` pins, R2, R57). */
  propose({ run, proposals, proposedBy, viewer = null, caller = null, at = null } = {}) {
    const refusal = (code, detail, extra) => {
      const row = CONTRADICTION_CANDIDATE_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation,
               detail, ...(extra || {}) };
    };
    /* R13's first four: proposer, run (sight), principal, running, asked of the registered run gate (R21). */
    const gate = this.#runRefusals({ run, proposedBy, viewer, caller });
    if (gate) return gate;
    const runId = Contradiction.#runId(run);
    const list = Array.isArray(proposals) ? proposals : [];
    /* DEC-49 REGION is-candidate-no-proposals */
    if (list.length === 0)
      return refusal("CANDIDATE_NO_PROPOSALS",
        localize("contradiction.index.no_proposals_detail", "an empty batch is not a judgement that found nothing; that is an observation for the run's log"),
        { run: runId });
    /* END DEC-49 REGION is-candidate-no-proposals */
    const item = (i) => (list[i] && typeof list[i] === "object" ? list[i] : {});
    /* R13: each refusal asked of the WHOLE batch in turn — every label, then every reason, then every pair. */
    for (let i = 0; i < list.length; i++) {
      const p = item(i);
      /* DEC-49 REGION is-candidate-label-unknown */
      if (!CONTRADICTION_LABELS.includes(p.label))
        return refusal("CANDIDATE_LABEL_UNKNOWN",
          localize("contradiction.index.label_unknown_detail", "proposal {index} carries '{label}', which is not one of {labels}",
                   { index: i, label: String(p.label).slice(0, 30), labels: CONTRADICTION_LABELS.join(", ") }),
          { run: runId, index: i, labels: [...CONTRADICTION_LABELS] });
      /* END DEC-49 REGION is-candidate-label-unknown */
    }
    for (let i = 0; i < list.length; i++) {
      const p = item(i);
      /* DEC-49 REGION is-candidate-no-reason */
      if (typeof p.reason !== "string" || !p.reason.trim())
        return refusal("CANDIDATE_NO_REASON", localize("contradiction.index.no_reason_detail", "proposal {index} carries no reason", { index: i }),
                       { run: runId, index: i });
      /* END DEC-49 REGION is-candidate-no-reason */
    }
    /* THE PAIRS AS THIS VIEWER'S PAIRING FORMS THEM NOW — the op's own read, so what may be proposed over is exactly
       what the member could have been shown (§6), bounded as it is bounded. */
    const read = this.pairs({ viewer });
    const handle = (x) => `${x.kind}|${x.ref}@${x.version}`;
    const formed = new Map();
    for (const q of Array.isArray(read.pairs) ? read.pairs : []) {
      const a = this.#side(q.a), b = this.#side(q.b);
      formed.set(`${q.key}:${[handle(a), handle(b)].sort().join(" <> ")}`, { key: q.key, a, b, pair: q });
    }
    const cutKeys = (read.keys ?? []).filter((k) => k.truncated).map((k) => k.key);
    const stamp = at || this.#now();
    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const p = item(i);
      const key = String(p.key ?? "").trim().toUpperCase();
      const a = this.#side(p.a), b = this.#side(p.b);
      const f = formed.get(`${key}:${[handle(a), handle(b)].sort().join(" <> ")}`);
      /* DEC-49 REGION is-candidate-pair-not-formed */
      if (!f)
        return refusal("CANDIDATE_PAIR_NOT_FORMED",
          cutKeys.length
            ? localize("contradiction.index.pair_not_formed_cut_detail", "proposal {index} names a {key} pair the pairing does not form for this viewer now (the read was cut at its bound on {keys}, and a pair past the bound is not formed here)",
                       { index: i, key: key || "(no key)", keys: cutKeys.join(", ") })
            : localize("contradiction.index.pair_not_formed_detail", "proposal {index} names a {key} pair the pairing does not form for this viewer now",
                       { index: i, key: key || "(no key)" }),
          { run: runId, index: i, cut_keys: cutKeys });
      /* END DEC-49 REGION is-candidate-pair-not-formed */
      /* R15: the PLANE's referents, ordered so the row reads the way its digest was taken. */
      const inOrder = handle(f.a) <= handle(f.b);
      const [x, y] = inOrder ? [f.a, f.b] : [f.b, f.a];
      /* The sides as the plane formed them, in the row's order, with the pair's own context (its referent, subject or
         entity, and the sentence saying why it was paired), so a read shows them verbatim without re-pairing. */
      const { a: pa, b: pb, key: _k, ...context } = f.pair;
      const [sx, sy] = inOrder ? [pa, pb] : [pb, pa];
      rows.push({ candidate: sha256HexSync(canonicalJson({ v: 1, key: f.key, sides: [handle(x), handle(y)] })),
                  key: f.key, a: x, b: y, run: runId, proposed_by: proposedBy.trim(),
                  a_side: { ...sx, context }, b_side: { ...sy, context },
                  label: p.label, reason: p.reason.trim().slice(0, CANDIDATE_REASON_MAX), at: stamp });
    }
    const written = this.#record.transact(() => rows.map((row) => this.#append(row)));
    const candidates = rows.map((row, i) => ({
      new: written[i], ...this.#one(`SELECT ${STORED_ROW} FROM contradiction_candidates WHERE candidate=?`, row.candidate) }));
    const n = written.filter(Boolean).length;
    return { ok: true, run: runId, proposed: rows.length, written: n, unchanged: rows.length - n, candidates,
             says: word("contradiction.says.candidate_written_proposed", { n, n2: rows.length - n }) };
  }
  /* ===================================================================== *
   * PRESENT (N345; R24–R29). What a candidate IS at a read is derived from the candidate, its acts and its inquiry's
   * document (`./derive.mjs`), never stored (R42).
   * ===================================================================== */

  /** A viewer's sight of one bundle (membership R43): a machine sees every bundle; a member through the gate; an
   *  absent or unrecognised viewer nothing. A null bundle names nothing to withhold and passes; one that is gone is
   *  withheld from a member (fail closed). */
  #sees(bundleId, viewer) {
    const g = viewerPredicate(viewer);
    if (g.scope === "DENY") return false;
    if (bundleId === MISSING) return false;
    if (g.scope === "member") return true;
    if (bundleId === null || bundleId === undefined || bundleId === "") return true;
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id = ? AND (${g.sql})`, String(bundleId), ...g.args);
  }

  /** The bundle a content row is filed in, or null when the row is not held. */
  #contentHome(contentId) {
    if (!contentId) return null;
    const r = this.#one(`SELECT bundle_id FROM content WHERE content_id=?`, String(contentId));
    return r ? r.bundle_id : null;
  }

  /** Where a side lives (R10): a claim in its inquiry; a leg in its inquiry and its content row's bundle; an extent in
   *  its content row's bundle; a stance in its inquiry and its project. */
  #homes(side) {
    if (!side) return [];
    if (side.kind === "claim") return [side.inquiry];
    if (side.kind === "stance") return [side.inquiry, side.project];
    /* K6: a money fact is seen as its source is (money R21); one no longer held is withheld (fail closed). */
    if (side.kind === "money") {
      const f = this.#moneyHeld() ? this.#one(`SELECT sight_bundle FROM money_facts WHERE fact_id=?`, String(side.fact ?? "")) : null;
      return f ? [f.sight_bundle] : [MISSING];
    }
    if (side.kind === "leg") return [side.inquiry, this.#contentHome(side.content_id)];
    return [this.#contentHome(side.content_id)];
  }

  /** R10: a viewer may see a side when they may see every bundle it lives in. */
  #sideSeen(side, viewer) {
    return this.#homes(side).every((b) => this.#sees(b, viewer));
  }

  /** A candidate row read back: its sides as the plane formed them. A row written before the sides were kept is read
   *  from its referents (a claim's inquiry and version, a part's content id), which is all it holds. */
  #candidate(id) {
    if (typeof id !== "string" || !id.trim()) return null;
    const r = this.#one(`SELECT ${STORED_ROW}, seq FROM contradiction_candidates WHERE candidate=?`, id.trim());
    if (!r) return null;
    const side = (json, kind, ref) => {
      try { if (json) return JSON.parse(json); } catch { /* read from the referent below */ }
      if (kind === "claim") { const [inquiry, version] = String(ref).split("|"); return { kind, inquiry, version }; }
      if (kind === "stance") { const [inquiry, project, version] = String(ref).split("|"); return { kind, inquiry, project, version }; }
      return { kind, content_id: ref };
    };
    return { ...r, a: side(r.a_side, r.a_kind, r.a_ref), b: side(r.b_side, r.b_kind, r.b_ref) };
  }

  /** A candidate's acts, oldest first, with their JSON columns read. */
  #acts(candidate) {
    const j = (v) => { try { return v === null || v === undefined ? null : JSON.parse(v); } catch { return null; } };
    return this.#rows(`SELECT * FROM contradiction_acts WHERE candidate=? ORDER BY seq`, candidate).map((a) => ({
      ...a, coordinates: j(a.coordinates), evidence: j(a.evidence), qualifiers: j(a.qualifiers),
      acceptance: j(a.acceptance), standing: j(a.standing) }));
  }

  /** The candidate's contradiction inquiry (`inquiry` R48): its id and its link, or nulls. A read that fails answers
   *  none, never a guess. */
  #linkOf(candidate) {
    const i = this.#i();
    try {
      const id = typeof i.inquiryOfCandidate === "function" ? i.inquiryOfCandidate(candidate) : null;
      if (!id) return { inquiry: null, link: null };
      const link = typeof i.contradictionLink === "function" ? i.contradictionLink(id) : null;
      return { inquiry: id, link };
    } catch { return { inquiry: null, link: null }; }
  }

  /** R24, R26: what a candidate is now. */
  #view(row) {
    const acts = this.#acts(row.candidate);
    const noDifference = acts.some((a) => a.act === "clarify" && a.choice === "no_difference");
    const { weight, why } = weightOf(row.label, row.key, noDifference);
    const { inquiry, link } = this.#linkOf(row.candidate);
    const st = stateOf(acts, link, inquiry);
    return { weight, unshown_why: why, ...st, acts, no_difference: noDifference };
  }

  /** The family of a resolution kind, through `inquiry` R46; null when it is not a kind or cannot be read. */
  #family(kind) {
    const f = this.#i().resolutionFamily;
    if (typeof f === "function") { try { return f(kind); } catch { return null; } }
    return null;
  }

  /** R24, R49: the projects reached through one side, and whether the list was cut. A claim, leg or stance side reaches
   *  the projects drawing on its inquiry (`basis-versions` R37); an extent side, those drawing on each inquiry with a leg
   *  on its content row (`inquiry` R40), at most `REACH_INQUIRIES_MAX` inquiries; a stance side of K5, its own project.
   *  At most `REACH_PROJECTS_MAX` projects per inquiry.
   *
   *  `viewer` is whose sight the list is read under (N366). R49's parties are about the record, never about who asks,
   *  so the notice, the opt-in, the reveal and the marks read it as `INTERNAL`, the default. What a viewer is SHOWN as a
   *  duty's reach is read under that viewer: only projects they see (membership R43, R80), through only the inquiries
   *  they see, so neither a hidden project's id nor a bound it fills reaches them (R19, R55). */
  #reachOf(side, viewer = INTERNAL) {
    const out = { projects: [], truncated: false };
    const add = (id) => { if (id && !out.projects.includes(id)) out.projects.push(id); };
    if (!side) return out;
    if (side.kind === "stance") { if (side.project && this.#sees(side.project, viewer)) add(side.project); return out; }
    let inquiries = [];
    if (side.kind === "claim" || side.kind === "leg")
      inquiries = side.inquiry && this.#sees(side.inquiry, viewer) ? [side.inquiry] : [];
    else if (side.content_id || side.kind === "money") {
      /* K6: a money fact reaches the inquiries resting on the passage it was read from (money R19's source extent). */
      const cid = side.kind === "money"
        ? (this.#moneyHeld() ? this.#one(`SELECT source_content_id AS c FROM money_facts WHERE fact_id=?`, String(side.fact ?? ""))?.c ?? null : null)
        : side.content_id;
      const g = this.#gate("ib.bundle_id", viewer);
      const rows = cid ? this.#rows(`SELECT DISTINCT ib.bundle_id AS bundle_id FROM inquiry_basis ib
                                WHERE ib.content_id=? AND (${g.sql}) ORDER BY ib.bundle_id LIMIT ?`,
                              String(cid), ...g.args, REACH_INQUIRIES_MAX + 1) : [];
      if (rows.length > REACH_INQUIRIES_MAX) out.truncated = true;
      inquiries = rows.slice(0, REACH_INQUIRIES_MAX).map((r) => r.bundle_id);
    }
    const bv = this.#b();
    for (const inq of inquiries) {
      const list = bv && typeof bv.projectsDrawingOn === "function" ? bv.projectsDrawingOn(inq, viewer) || [] : [];
      if (list.truncated) out.truncated = true;
      for (const p of list.slice(0, REACH_PROJECTS_MAX)) add(p.id);
    }
    out.projects.sort();
    return out;
  }

  /** R24: the reach of a candidate (the projects its duty is held for), and R49's parties, which are the same set read
   *  side by side; under `viewer`'s sight when one is given (N366), else as the record holds it. */
  #parties(row, viewer = INTERNAL) {
    const a = this.#reachOf(row.a, viewer), b = this.#reachOf(row.b, viewer);
    const all = [...new Set([...a.projects, ...b.projects])].sort();
    return { a, b, all, truncated: a.truncated || b.truncated };
  }

  /** The stated doctype and date of a capture (R9), as the pairing reads them. */
  #docOf(capture) {
    if (!capture) return { read: false, doctype: null, date: null, dated: null };
    try { return this.#doc(capture, new Map()); } catch { return { read: false, doctype: null, date: null, dated: null }; }
  }

  /** A side as a member reads it (R25, R50): verbatim, with its source, stated date, doctype and capture, from what
   *  the record holds now. */
  #shown(side) {
    if (!side) return null;
    const { context: _c, ...s } = side;
    if (s.kind === "money") {
      const f = this.#moneyHeld() ? this.#one(`SELECT sight_bundle, source_content_id FROM money_facts WHERE fact_id=?`, String(s.fact ?? "")) : null;
      return { ...s, text: s.amount && typeof s.amount.as_read === "string" ? s.amount.as_read : null,
               source: { fact: s.fact ?? null, bundle: f ? f.sight_bundle : null, ref: s.ref ?? null,
                         content_id: f ? f.source_content_id ?? null : null },
               date: null, doctype: null, capture_sha: s.capture_sha ?? null };
    }
    if (s.kind === "claim" || s.kind === "stance") {
      const t = s.inquiry ? this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, s.inquiry) : null;
      return { ...s, text: s.claim ?? null, source: { inquiry: s.inquiry ?? null, title: t ? t.title : null,
               ...(s.kind === "stance" ? { project: s.project ?? null } : {}) },
               date: null, doctype: null, capture_sha: null };
    }
    const row = s.content_id
      ? this.#one(`SELECT capture_sha, bundle_id, ref, extent_kind, stale FROM content WHERE content_id=?`, s.content_id) : null;
    const capture = row ? row.capture_sha : (s.capture_sha ?? null);
    const d = this.#docOf(capture);
    return { ...s, capture_sha: capture, ref: row ? row.ref : (s.ref ?? null),
             source: { bundle: row ? row.bundle_id : null, ref: row ? row.ref : (s.ref ?? null) },
             date: d.date, date_precision: d.dated ? d.dated.precision : null, date_zone: d.dated ? d.dated.zone : null,
             doctype: d.doctype, stale: row ? !!row.stale : (s.stale ?? null) };
  }

  /** R37: the recommendations standing for a candidate now (its state open or explained), each labelled machine work. */
  #standing(row, view) {
    if (!isStanding(view.state)) return [];
    return this.#rows(`SELECT recommendation, run, coordinate, proposed_by, reason, origin, at
                         FROM contradiction_recommendations WHERE candidate=? ORDER BY seq`, row.candidate)
      .map((r) => ({ ...r, machine_work: true,
                     says: word("contradiction.says.machine_recommendation_respect") }));
  }

  /** R25's `default_question`: the plane's stated default wording, which a member accepts or rewrites (R35). It is
   *  shown, never sent for them. */
  #defaultQuestion(row) {
    const t = (s) => { const v = this.#shown(s); return String(v?.text ?? v?.ref ?? v?.content_id ?? "").replace(/\s+/g, " ").trim(); };
    const q = word("contradiction.q", { a: t(row.a).slice(0, 180), b: t(row.b).slice(0, 180) });
    return q.slice(0, TEXT_CAPS.question);
  }

  /** The machine's label and reason, labelled as the machine's (DEC-24). */
  #machine(row) {
    return { label: row.label, reason: row.reason, run: row.run, proposed_by: row.proposed_by, at: row.at,
             origin: "machine", machine_work: true, says: word("contradiction.says.proposed_machine_work") };
  }

  /** R26's resolution as a member reads it: the kind, who made it and how. */
  #resolutionOf(view) {
    if (view.state !== "resolved") return null;
    if (view.inquiry) return { kind: view.kind, family: this.#family(view.kind), by: "inquiry", inquiry: view.inquiry,
                               resolution: view.resolution };
    const a = view.act;
    return { kind: view.kind, family: view.kind === "corrected" ? "CORRECTED" : "DISSOLVED", by: "act",
             member: a.author, at: a.at, choice: a.choice, coordinates: a.coordinates, explanation: a.explanation,
             evidence: a.evidence, wrong_side: a.wrong_side, reason: a.wrong_reason, qualifiers: a.qualifiers };
  }

  /** A project's name, for a revealed party (R52): the bundle's title. */
  #projectName(id) {
    const r = this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, id);
    return r ? r.title : null;
  }

  /** R51, R52: a candidate's opt-ins and whether a reveal is recorded. */
  #optins(candidate) {
    const rows = this.#rows(`SELECT * FROM contradiction_optins WHERE candidate=? ORDER BY seq`, candidate);
    const optins = rows.filter((r) => r.kind === "optin");
    const revealed = rows.find((r) => r.kind === "revealed") || null;
    return { optins, revealed, opted: [...new Set(optins.map((r) => r.project_id))] };
  }

  /** R50–R54's per-party view of a conflict between projects, for `project`. Nothing here names the other side or
   *  counts the parties; before a reveal, no other party is named. */
  #partyView(row, project) {
    const { optins, revealed, opted } = this.#optins(row.candidate);
    const own = optins.find((r) => r.project_id === project) || null;
    const isRevealed = !!revealed && opted.includes(project);
    const parties = isRevealed ? opted.filter((p) => p !== project).map((p) => ({ id: p, name: this.#projectName(p) })) : null;
    return {
      opted_in: own ? { member: own.author, at: own.at, words: own.words ?? null } : null,
      asked_by_another: opted.some((p) => p !== project),
      revealed: isRevealed,
      ...(isRevealed ? { parties } : {}),
      ...this.#relayed(row, project, isRevealed, opted),
    };
  }

  /** R54: the responses relayed to `project` in its notice: the other opted-in parties' responses made after this
   *  project's own latest one (all of them when it has none), newest first, at most `NOTICE_RESPONSES_MAX`. Nothing is
   *  relayed before the reveal. A relayed response carries its text, its chosen disclosures, its project and its
   *  instant, and never its author. */
  #relayed(row, project, isRevealed, opted) {
    if (!isRevealed) return { responses: [], responses_truncated: false };
    const ownLast = this.#one(`SELECT MAX(seq) AS s FROM contradiction_responses WHERE candidate=? AND project_id=?`,
                              row.candidate, project)?.s ?? 0;
    const others = opted.filter((p) => p !== project);
    if (!others.length) return { responses: [], responses_truncated: false };
    const rs = this.#rows(`SELECT * FROM contradiction_responses WHERE candidate=? AND seq > ?
                             AND project_id IN (SELECT value FROM json_each(?)) ORDER BY seq DESC LIMIT ?`,
                          row.candidate, ownLast, JSON.stringify(others), NOTICE_RESPONSES_MAX + 1);
    return { responses: rs.slice(0, NOTICE_RESPONSES_MAX).map((r) => this.#relay(r)),
             responses_truncated: rs.length > NOTICE_RESPONSES_MAX };
  }

  /** One response as relayed (R54): what its responder chose to share, and nothing else. */
  #relay(r) {
    return { response: r.response, text: r.text,
             ...(r.cover !== null && r.cover !== undefined ? { cover: r.cover } : {}),
             ...(r.email ? { email: r.email, email_says: word("contradiction.email_says.stated_verified") } : {}),
             project: { id: r.project_id, name: this.#projectName(r.project_id) }, at: r.at };
  }

  /** A candidate as R25 answers it to a viewer who sees it whole. */
  #present(row, view, viewer) {
    const reaches = view.weight === "duty" || view.weight === "plurality" || view.weight === "lead";
    /* R49's parties are read whole (a joined participant of any of them is answered its party's view), and the reach is
       read under the viewer's own sight: a project hidden from them is neither named nor counted (N366; R19, R55). */
    const parties = reaches ? this.#parties(row) : null;
    const shownReach = reaches ? this.#parties(row, viewer) : null;
    const member = this.#memberOf(viewer);
    const m = this.#m();
    /* R25: who took it up and in what words, from the `take_up` act the view already holds; kept once it is resolved. */
    const takeUp = view.state === "taken_up" || view.state === "resolved" ? view.acts.find((a) => a.act === "take_up") : null;
    const between = parties && isProjectConflict(view.weight, view.state) && member
      ? parties.all.filter((p) => m && typeof m.isJoinedParticipant === "function" && m.isJoinedParticipant(p, member))
          .map((p) => ({ project: p, ...this.#partyView(row, p) }))
      : [];
    return {
      candidate: row.candidate, key: row.key, why: row.a?.context?.why ?? CONTRADICTION_KEYS[row.key]?.why ?? null,
      a: this.#shown(row.a), b: this.#shown(row.b),
      machine: row.origin === "member" ? null : this.#machine(row), weight: view.weight, state: view.state,
      resolution: this.#resolutionOf(view), inquiry: view.inquiry,
      recommendations: this.#standing(row, view),
      reach: shownReach ? { projects: shownReach.all, truncated: shownReach.truncated } : null,
      default_question: this.#defaultQuestion(row),
      ...(row.origin === "member" ? { flagged_by: { member: row.proposed_by, at: row.at, reason: row.reason } } : {}),
      ...(takeUp ? { taken_up: { member: takeUp.author, at: takeUp.at, words: takeUp.words ?? null } } : {}),
      ...(between.length ? { between_projects: between } : {}),
    };
  }

  /** R25's subject: exactly one of the six. */
  #subjectOf(on) {
    const o = on && typeof on === "object" && !Array.isArray(on) ? on : {};
    const named = ["inquiry", "content", "entity", "bundle", "project", "candidate"]
      .filter((k) => typeof o[k] === "string" && o[k].trim());
    return named.length === 1 ? { kind: named[0], id: o[named[0]].trim() } : null;
  }

  /** The candidates a subject names, newest first, at most `CANDIDATES_SCAN_MAX` (+1, to observe truncation). */
  #candidatesNaming(subject) {
    const cap = CANDIDATES_SCAN_MAX + 1;
    const side = (col) => `json_extract(${col}, '$.inquiry')`;
    const q = (where, ...args) => this.#rows(
      `SELECT candidate FROM contradiction_candidates WHERE ${where} ORDER BY seq DESC, candidate LIMIT ?`, ...args, cap)
      .map((r) => r.candidate);
    switch (subject.kind) {
      case "candidate": return q(`candidate = ?`, subject.id);
      case "inquiry": return q(`(${side("a_side")} = ? OR ${side("b_side")} = ?)`, subject.id, subject.id);
      case "content": return q(`(json_extract(a_side, '$.content_id') = ? OR json_extract(b_side, '$.content_id') = ?
                                  OR (a_kind IN ('leg','extent') AND a_ref = ?) OR (b_kind IN ('leg','extent') AND b_ref = ?))`,
                               subject.id, subject.id, subject.id, subject.id);
      case "entity": return q(`(json_extract(a_side, '$.context.subject_entity') = ? OR json_extract(a_side, '$.context.entity_id') = ?
                                 OR json_extract(a_side, '$.context.payer') = ? OR json_extract(a_side, '$.context.payee') = ?)`,
                              subject.id, subject.id, subject.id, subject.id);
      case "bundle": return q(`(a_bundle_id = ? OR b_bundle_id = ? OR ${side("a_side")} = ? OR ${side("b_side")} = ?)`,
                              subject.id, subject.id, subject.id, subject.id);
      case "project": {
        /* R25 (Suggestion): the project's inquiries (`basis-versions` R41), then the candidates whose side's inquiry, or
           content row cited by one of them, is among them, or whose stance is the project's own. */
        const ids = this.#projectInquiries(subject.id);
        const j = JSON.stringify(ids);
        return q(`(${side("a_side")} IN (SELECT value FROM json_each(?)) OR ${side("b_side")} IN (SELECT value FROM json_each(?))
                   OR json_extract(a_side, '$.project') = ? OR json_extract(b_side, '$.project') = ?
                   OR json_extract(a_side, '$.content_id') IN (SELECT content_id FROM inquiry_basis
                        WHERE content_id IS NOT NULL AND bundle_id IN (SELECT value FROM json_each(?)))
                   OR json_extract(b_side, '$.content_id') IN (SELECT content_id FROM inquiry_basis
                        WHERE content_id IS NOT NULL AND bundle_id IN (SELECT value FROM json_each(?))))`,
                 j, j, subject.id, subject.id, j, j);
      }
      default: return [];
    }
  }

  /** Every inquiry a project draws on (`basis-versions` R41, page by page). */
  #projectInquiries(project) {
    const bv = this.#b();
    if (!bv || typeof bv.projectQuestions !== "function") return [];
    const out = [];
    let after = null;
    for (let i = 0; i < 64; i++) {
      const page = bv.projectQuestions({ project, after, limit: 500 }) || { items: [] };
      for (const it of page.items || []) out.push(it.inquiry);
      if (!page.cursor) break;
      after = page.cursor;
    }
    return out;
  }

  /** R25 `{entity}` (R9): candidates in the own date of their earlier-dated side, read as R9 reads it and compared by
   *  `civil-time.compare`, never as raw strings. A candidate with no own date on either side is undated; one whose
   *  sides' order, or whose place beside its neighbour, compare does not settle is listed apart with them, never
   *  placed by guess. Two at one value, precision and zone are at the same date (R9's agreeing dates), kept together
   *  in candidate id order. Answers the ordered items then the rest, and both counts. */
  #byOwnDate(items) {
    const dt = (side) => { const v = this.#shown(side);
      return v && typeof v.date === "string" && v.date_precision ? { value: v.date, precision: v.date_precision, zone: v.date_zone } : null; };
    const dated = [], undated = [], apart = [];
    for (const x of items) {
      const a = dt(x.row.a), b = dt(x.row.b);
      if (!a && !b) { undated.push(x); continue; }
      const o = a && b ? Contradiction.#order(a, b) : a ? "before" : "after";
      if (o === "undetermined") { apart.push(x); continue; }
      const d = o === "after" ? b : a;
      if (typeof d.zone !== "string") { apart.push(x); continue; }
      let bd;
      try { bd = bounds(d); } catch { bd = null; }
      if (!bd || bd.refused || bd.undetermined || typeof bd.earliest !== "string") { apart.push(x); continue; }
      dated.push({ ...x, d, lo: bd.earliest, hi: bd.latest ?? "" });
    }
    /* Sorted by the instants civil-time bounds each date by; every neighbour's order is then asked of compare. Of two
       neighbours it does not settle, the coarser date (the wider span) leaves the line, or both when they are equally
       wide, until every neighbour's order is settled. */
    const width = (x) => (Date.parse(x.hi) || Infinity) - (Date.parse(x.lo) || 0);
    let line = dated.sort((p, q) => (p.lo < q.lo ? -1 : p.lo > q.lo ? 1 : p.hi < q.hi ? -1 : p.hi > q.hi ? 1
      : p.row.candidate < q.row.candidate ? -1 : 1));
    for (let moved = true; moved;) {
      moved = false;
      const out = new Set();
      for (let i = 0; i + 1 < line.length; i++) {
        if (["before", "same"].includes(Contradiction.#order(line[i].d, line[i + 1].d))) continue;
        const wa = width(line[i]), wb = width(line[i + 1]);
        if (wa >= wb) out.add(i);
        if (wb >= wa) out.add(i + 1);
      }
      if (out.size) { apart.push(...line.filter((_, i) => out.has(i))); line = line.filter((_, i) => !out.has(i)); moved = true; }
    }
    return { items: [...line, ...apart, ...undated], undated: undated.length, unordered: apart.length };
  }

  /** op=contradictioncandidates — R25: the candidates shown to a viewer about one thing. */
  candidatesFor({ on = null, label = null, weight = null, state = null, after = null, limit = null, viewer = null } = {}) {
    try {
      const subject = this.#subjectOf(on);
      /* DEC-49 REGION is-candidates-no-subject */
      if (!subject) {
        const row = CONTRADICTION_PAIR_CHECKS.CANDIDATES_NO_SUBJECT;
        return { ok: false, reason: "CANDIDATES_NO_SUBJECT", code: "CANDIDATES_NO_SUBJECT", check: row.check,
                 translation: row.translation,
                 detail: localize("contradiction.index.candidates_no_subject_detail", "name exactly one of inquiry, content, entity, a record (bundle), project or candidate") };
      }
      /* END DEC-49 REGION is-candidates-no-subject */
      const n = Number(limit);
      const cap = limit === null || limit === undefined || limit === "" || !Number.isFinite(n) || n < 1
        ? PAGE_MAX : Math.min(Math.floor(n), PAGE_MAX);
      /* N366 (R19; C-93.9's rule): `{project}` for a project the viewer may not see, at existence only or not at all
         (membership R43, R44), answers exactly as an id that names nothing: its candidates are never matched. */
      const fenced = subject.kind === "project" && !this.#sees(subject.id, viewer);
      const ids = fenced ? [] : this.#candidatesNaming(subject);
      const scanCut = ids.length > CANDIDATES_SCAN_MAX;
      const notShown = { precision: 0, unrelated: 0 };
      const unmeasuredBy = { K5: 0, K6: 0 };
      let visible = 0, shown = 0;
      let items = [];
      for (const id of ids.slice(0, CANDIDATES_SCAN_MAX)) {
        const row = this.#candidate(id);
        if (!row || !this.#sideSeen(row.a, viewer) || !this.#sideSeen(row.b, viewer)) continue;
        visible += 1;
        const view = this.#view(row);
        if (view.weight === "not_shown") {
          if (view.unshown_why === K5_UNSHOWN_WHY) unmeasuredBy.K5 += 1;
          else if (view.unshown_why === K6_UNSHOWN_WHY) unmeasuredBy.K6 += 1;
          else if (notShown[row.label] !== undefined) notShown[row.label] += 1;
          continue;
        }
        shown += 1;
        if (subject.kind === "project") {
          const reach = this.#parties(row);
          if (!reach.all.includes(subject.id)) continue;
        }
        if (label !== null && label !== undefined && label !== "" && row.label !== label) continue;
        if (weight !== null && weight !== undefined && weight !== "" && view.weight !== weight) continue;
        if (state !== null && state !== undefined && state !== "" && view.state !== state) continue;
        items.push({ row, view });
      }
      /* K5 and K6 candidates withheld until their gate arms are measured: counted, by key, each with why. */
      const unmeasured = unmeasuredBy.K5 + unmeasuredBy.K6;
      const whys = [unmeasuredBy.K5 ? K5_UNSHOWN_WHY : null, unmeasuredBy.K6 ? K6_UNSHOWN_WHY : null].filter(Boolean);
      const held = unmeasured ? { unmeasured, unmeasured_why: whys.length === 1 ? whys[0] : whys,
                                  unmeasured_by_key: Object.fromEntries(Object.entries(unmeasuredBy).filter(([, n]) => n)) } : {};
      /* {entity}: in the own date of the earlier-dated side (R9), undated last and counted, never placed by guess. */
      let undated = 0, unordered = 0;
      if (subject.kind === "entity") {
        const r = this.#byOwnDate(items);
        undated = r.undated; unordered = r.unordered;
        items = r.items;
      }
      if (typeof after === "string" && after) {
        const at = items.findIndex((x) => x.row.candidate === after);
        items = at === -1 ? [] : items.slice(at + 1);
      }
      const page = items.slice(0, cap);
      const truncated = items.length > cap || scanCut;
      const candidates = page.map((x) => this.#present(x.row, x.view, viewer));
      const empty = candidates.length ? null
        : visible === 0
          ? { level: "none_judged", says: word("contradiction.says.candidate_viewer_see") }
          : shown === 0
            ? { level: "none_shown", says: word("contradiction.says.candidates_held_record"),
                not_shown: notShown, ...held }
            : { level: "none_matching", says: word("contradiction.says.candidates_shown_matches") };
      return { ok: true, wrote: false, on: { [subject.kind]: subject.id }, limit: cap, truncated,
               cursor: candidates.length ? candidates[candidates.length - 1].candidate : null,
               candidates, not_shown: notShown, ...held,
               ...(subject.kind === "entity" ? { undated, order_undetermined: unordered } : {}), empty };
    } catch (e) {
      return { ok: true, wrote: false, candidates: [], truncated: false, undetermined: true,
               empty: { level: "undetermined", says: word("contradiction.says.read_failed_claimed", { e: String(e && e.message || e).slice(0, 120) }) } };
    }
  }

  /** A referent as asked (R27): `{ref, version}`, or a side as the pairing forms it, read as R14 reads it. */
  #referentOf(x) {
    if (!x || typeof x !== "object") return null;
    if (typeof x.ref === "string" && x.ref && typeof x.version === "string" && x.version)
      return { ref: x.ref, version: x.version };
    if (typeof x.kind === "string") { const s = this.#side(x); return s.ref ? { ref: s.ref, version: s.version } : null; }
    return null;
  }

  /** Which side of a candidate a referent is: `a`, `b` or null. */
  static #whichSide(row, ref) {
    if (row.a_ref === ref.ref && row.a_version === ref.version) return "a";
    if (row.b_ref === ref.ref && row.b_version === ref.version) return "b";
    return null;
  }

  /** R27's marks one candidate puts on one of its sides, for a viewer. */
  #marksOn(row, which, viewer) {
    const other = which === "a" ? "b" : "a";
    if (!this.#sideSeen(row[which], viewer)) return [];
    const view = this.#view(row);
    const c = row.candidate;
    if (!this.#sideSeen(row[other], viewer)) {
      /* DEC-85: seen half. Told only to a joined participant of a party reached through the side they may see, and
         carrying nothing of the other side. */
      if (!isProjectConflict(view.weight, view.state)) return [];
      const member = this.#memberOf(viewer);
      const m = this.#m();
      if (!member || !m || typeof m.isJoinedParticipant !== "function") return [];
      return this.#reachOf(row[which]).projects.filter((p) => m.isJoinedParticipant(p, member))
        .map((p) => ({ mark: "unseen_conflict", candidate: c, weight: view.weight, project: p }));
    }
    if (view.weight === "not_shown") return [];
    const res = view.inquiry ? (view.resolution || {}) : null;
    const act = view.act;
    if (view.state === "open" && view.weight === "lead") return [{ mark: "lead", candidate: c }];
    if (view.state === "open" && view.weight === "plurality") return [{ mark: "plurality", candidate: c }];
    if ((view.state === "open" || view.state === "taken_up") && view.weight === "duty")
      return [{ mark: "in_tension", candidate: c, ...(view.inquiry ? { inquiry: view.inquiry } : {}) }];
    if (view.state === "taken_up") return [];
    if (view.state === "explained_not_shown")
      return [{ mark: "softened", candidate: c, explanation: act.explanation ?? null, member: act.author,
                coordinates: act.coordinates ?? [], qualifier: act.qualifiers ? act.qualifiers[which] ?? null : null,
                qualifier_standing: "hypothesis" }];
    if (view.state !== "resolved") return [];
    const family = view.inquiry ? this.#family(view.kind) : view.kind === "corrected" ? "CORRECTED" : "DISSOLVED";
    if (family === "CORRECTED") {
      const wrong = view.inquiry ? res.wrong_side : act.wrong_side;
      if (wrong !== which) return [];
      const says = word("contradiction.says.side_named_wrong");
      if (!view.inquiry)
        return [{ mark: "stale", candidate: c, corrected: true, kind: view.kind, reason: act.wrong_reason,
                  member: act.author, at: act.at, act: act.act_id, says }];
      /* N359: concluded by its contradiction inquiry, the member and the instant are R36's concluding act's (the latest
         `resolve` naming that inquiry). A conclusion reached only by basis-versions' own door has no act of this module,
         and says so rather than guessing either. */
      const concluding = [...view.acts].reverse().find((a) => a.act === "resolve" && a.inquiry === view.inquiry) || null;
      return [{ mark: "stale", candidate: c, corrected: true, kind: view.kind, reason: res.reason ?? null,
                member: concluding ? concluding.author : null, at: concluding ? concluding.at : null,
                inquiry: view.inquiry, ...(concluding ? { act: concluding.act_id }
                  : { why: word("contradiction.why.concluded_through_basis") }), says }];
    }
    if (view.kind === "dissolved")
      return [{ mark: "qualified", candidate: c,
                coordinates: (view.inquiry ? res.coordinates : act.coordinates) ?? [],
                qualifier: (view.inquiry ? res.qualifiers : act.qualifiers)?.[which] ?? null,
                explanation: view.inquiry ? null : act.explanation ?? null, qualifier_standing: "evidenced" }];
    if (view.kind === "irreconcilable") return [{ mark: "held_irreconcilable", candidate: c, inquiry: view.inquiry }];
    return [];
  }

  /** op=contradictiontensions — R27: each referent's marks, at its version, from every candidate the viewer may see on
   *  it. Every surface that shows a side reads this, so none holds a copy of the rule. */
  tensionsOn({ referents = null, viewer = null } = {}) {
    try {
      const list = Array.isArray(referents) ? referents : [];
      /* DEC-49 REGION is-tensions-too-many */
      if (list.length > TENSIONS_REFERENTS_MAX) {
        const row = CONTRADICTION_PAIR_CHECKS.TENSIONS_TOO_MANY;
        return { ok: false, reason: "TENSIONS_TOO_MANY", code: "TENSIONS_TOO_MANY", check: row.check,
                 translation: row.translation, max: TENSIONS_REFERENTS_MAX,
                 detail: localize("contradiction.index.tensions_too_many_detail", "{count} referents were asked about; at most {max} are read at once",
                                  { count: list.length, max: TENSIONS_REFERENTS_MAX }) };
      }
      /* END DEC-49 REGION is-tensions-too-many */
      const out = list.map((x) => {
        const ref = this.#referentOf(x);
        if (!ref) return { referent: x ?? null, marks: [], undetermined: true, why: word("contradiction.why.referent_version") };
        /* N368 (entities R39's class): bounded at the statement, over-fetching one so the cut is observed. */
        const ids = this.#rows(`SELECT candidate FROM contradiction_candidates
                                 WHERE (a_ref=? AND a_version=?) OR (b_ref=? AND b_version=?) ORDER BY seq LIMIT ?`,
                               ref.ref, ref.version, ref.ref, ref.version, TENSIONS_CANDIDATES_MAX + 1).map((r) => r.candidate);
        const truncated = ids.length > TENSIONS_CANDIDATES_MAX;
        const marks = [];
        for (const id of ids.slice(0, TENSIONS_CANDIDATES_MAX)) {
          const row = this.#candidate(id);
          const which = row ? Contradiction.#whichSide(row, ref) : null;
          if (which) marks.push(...this.#marksOn(row, which, viewer));
        }
        return { referent: ref, marks, truncated };
      });
      return { ok: true, wrote: false, referents: out, limit: TENSIONS_CANDIDATES_MAX,
               truncated: out.some((r) => r.truncated === true) };
    } catch (e) {
      return { ok: true, wrote: false, referents: [], undetermined: true, why: String(e && e.message || e).slice(0, 160) };
    }
  }

  /** The refusal every act and read answers for an absent candidate, or one the viewer may not see. */
  static #noSuch(detail, extra = {}) {
    const row = CONTRADICTION_CANDIDATE_CHECKS.NO_SUCH_CANDIDATE;
    /* DEC-49 REGION is-no-such-candidate */
    return { ok: false, reason: "NO_SUCH_CANDIDATE", code: "NO_SUCH_CANDIDATE", check: row.check,
             translation: row.translation, detail, ...extra };
    /* END DEC-49 REGION is-no-such-candidate */
  }

  /** The established resolutions of a capture (entities R35's read contract): the entities it is about, at most
   *  `FACTS_ENTITIES_MAX` in id order, with `truncated` observed by reading one past (R28, N368). */
  #entitiesOf(capture) {
    if (!capture) return { ids: null, truncated: false };
    const rows = this.#rows(`SELECT DISTINCT entity_id FROM resolutions WHERE capture_sha=? AND established=1
                              ORDER BY entity_id LIMIT ?`, capture, FACTS_ENTITIES_MAX + 1).map((r) => r.entity_id);
    return { ids: rows.slice(0, FACTS_ENTITIES_MAX), truncated: rows.length > FACTS_ENTITIES_MAX };
  }

  /** R28's facts for a candidate, computed from what its sides already carry. */
  #facts(row) {
    if (row.key === "K6") return this.#moneyFacts(row);
    const A = this.#shown(row.a), B = this.#shown(row.b);
    const isPart = (s) => s && (s.kind === "leg" || s.kind === "extent");
    const fact = (coordinate, name, a, b, whyA, whyB) => {
      const miss = [];
      if (a === null || a === undefined || (Array.isArray(a) && !a.length)) miss.push(`side A: ${whyA}`);
      if (b === null || b === undefined || (Array.isArray(b) && !b.length)) miss.push(`side B: ${whyB}`);
      return { coordinate, fact: name, a: a ?? null, b: b ?? null, source: "record", machine_work: false,
               ...(miss.length ? { undetermined: true, why: miss.join("; ") } : {}) };
    };
    const noDate = (s) => (isPart(s) ? (s.capture_sha ? word("contradiction.text.reader_states_date") : word("contradiction.text.passage_held"))
                                     : word("contradiction.text.held_claim_states"));
    const noType = (s) => (isPart(s) ? (s.capture_sha ? word("contradiction.text.reader_states_kind") : word("contradiction.text.passage_held"))
                                     : word("contradiction.text.held_claim_document"));
    const subject = (s) => {
      if (isPart(s)) return this.#entitiesOf(s.capture_sha);
      const r = s && s.inquiry ? this.#one(`SELECT inquiry_subject_entity AS e FROM inquiry_bundle_facts WHERE bundle_id=?`, s.inquiry) : null;
      return { ids: r && r.e ? [r.e] : null, truncated: false };
    };
    const sa = subject(A), sb = subject(B);
    const entities = fact("subject", "resolved_entities", sa.ids, sb.ids, word("contradiction.fact.established_resolution_subject"),
                          word("contradiction.fact.established_resolution_subject"));
    /* R28 (N368): a side's list cut at its bound says so, and is never answered as whole. */
    if (sa.truncated || sb.truncated) Object.assign(entities, { truncated: true, limit: FACTS_ENTITIES_MAX,
      ...(sa.truncated ? { a_truncated: true } : {}), ...(sb.truncated ? { b_truncated: true } : {}) });
    const facts = [
      fact("time_or_occasion", "stated_date", A.date, B.date, noDate(A), noDate(B)),
      fact("observer_or_method", "doctype", A.doctype, B.doctype, noType(A), noType(B)),
      fact("observer_or_method", "capture", A.capture_sha, B.capture_sha,
           isPart(A) ? word("contradiction.text.passage_held") : word("contradiction.facts.held_claim_rests"),
           isPart(B) ? word("contradiction.text.passage_held") : word("contradiction.facts.held_claim_rests")),
      entities,
    ];
    if (row.key === "K5") facts.push(fact("scope", "project", A.project ?? null, B.project ?? null, "no project", "no project"));
    return facts;
  }

  /** R28 for K6 (R8): the facts money holds for each side — its stated period, basis, figure as read with its precision,
   *  capture and parties — and what `money.reconcile` says differs between them now, each labelled the record's. A fact
   *  no longer held is undetermined, with why. */
  #moneyFacts(row) {
    const read = (side) => (this.#moneyHeld() ? this.#one(`SELECT * FROM money_facts WHERE fact_id=?`, String(side?.fact ?? "")) : null);
    const fa = read(row.a), fb = read(row.b);
    const fact = (coordinate, name, a, b) => {
      const miss = [];
      if (a === null || a === undefined) miss.push(`side A: ${fa ? word("contradiction.push.money_states_value") : word("contradiction.push.money_fact_held")}`);
      if (b === null || b === undefined) miss.push(`side B: ${fb ? word("contradiction.push.money_states_value") : word("contradiction.push.money_fact_held")}`);
      return { coordinate, fact: name, a: a ?? null, b: b ?? null, source: "record", machine_work: false,
               ...(miss.length ? { undetermined: true, why: miss.join("; ") } : {}) };
    };
    const period = (f) => (f ? { from: f.period_from, to: f.period_to, precision: f.period_precision, zone: f.period_zone } : null);
    const figure = (f) => (f ? { as_read: f.as_read, precision: f.precision, currency: f.currency } : null);
    const parties = (f) => (f ? [f.from_entity, f.to_entity].filter(Boolean) : null);
    const facts = [
      fact("time_or_occasion", "accounting_period", period(fa), period(fb)),
      fact("observer_or_method", "basis", fa ? fa.basis : null, fb ? fb.basis : null),
      fact("meaning", "figure_as_read", figure(fa), figure(fb)),
      fact("observer_or_method", "capture", this.#shown(row.a)?.capture_sha ?? null, this.#shown(row.b)?.capture_sha ?? null),
      fact("subject", "parties", parties(fa), parties(fb)),
    ];
    let rec = null;
    try { rec = fa && fb && this.#mo() ? this.#mo().reconcile({ a: fa.fact_id, b: fb.fact_id, viewer: INTERNAL }) : null; } catch { rec = null; }
    facts.push(rec && rec.ok !== false
      ? { coordinate: "scope", fact: "reconciliation", a: null, b: null, source: "record", machine_work: false,
          consistent: !!rec.consistent, amounts: rec.amounts, differs: rec.differs ?? [] }
      : { coordinate: "scope", fact: "reconciliation", a: null, b: null, source: "record", machine_work: false,
          undetermined: true, why: rec && rec.reason ? word("contradiction.why.money_reconciliation_refused", { rec: rec.reason })
                                                    : word("contradiction.why.money_reconciliation_reachable") });
    return facts;
  }

  /** op=contradictionfacts — R28: the facts the record holds that bear on each coordinate, each labelled the record's. */
  contextFacts({ candidate = null, viewer = null } = {}) {
    try {
      const row = this.#candidate(candidate);
      if (!row || !this.#sideSeen(row.a, viewer) || !this.#sideSeen(row.b, viewer))
        return Contradiction.#noSuch(localize("contradiction.index.no_such_detail", "no contradiction you can see answers to that id"));
      const facts = this.#facts(row);
      return { ok: true, wrote: false, candidate: row.candidate, key: row.key, facts,
               limit: FACTS_ENTITIES_MAX, truncated: facts.some((f) => f.truncated === true),
               says: word("contradiction.says.fact_record_sides") };
    } catch (e) {
      return Contradiction.#noSuch(localize("contradiction.index.candidate_unreadable", "the candidate could not be read ({e})",
                                            { e: String(e && e.message || e).slice(0, 80) }));
    }
  }

  /** R29's referents of a finding pinned at `sha`, held one level deep. `null` when no text answers to the bytes. */
  #heldAt(finding, sha) {
    const text = this.#record.textAtSha(finding, sha);
    if (typeof text !== "string") return null;
    const fm = parseFrontmatter(text).data || {};
    const refs = new Set();
    const held = (v) => v && v.state === "accepted" && !v.hidden && typeof v.claim === "string" && v.claim.trim();
    for (const v of versionsIn(fm)) if (held(v)) refs.add(`${finding}|${v.name}@${sha256HexSync(String(v.claim))}`);
    const current = this.#one(`SELECT bundle_sha FROM bundles WHERE bundle_id=?`, finding);
    const atHead = !!current && current.bundle_sha === sha;
    const legs = Array.isArray(fm.basis) ? fm.basis : [];
    let undetermined = 0;
    legs.forEach((leg, ord) => {
      if (!leg || typeof leg !== "object") return;
      const target = String(leg.target ?? "");
      const t = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, target);
      if (t && t.object_type === "inquiry") {
        for (const v of this.#rows(`SELECT name, claim FROM inquiry_basis_versions WHERE bundle_id=? AND state='accepted'
                                      AND hidden=0 AND claim IS NOT NULL AND claim <> ''`, target))
          refs.add(`${target}|${v.name}@${sha256HexSync(String(v.claim))}`);
        return;
      }
      let cid = typeof leg.content_id === "string" && /^[0-9a-f]{64}$/.test(leg.content_id) ? leg.content_id : null;
      if (!cid && atHead) cid = this.#one(`SELECT content_id FROM inquiry_basis WHERE bundle_id=? AND ord=?`, finding, ord)?.content_id ?? null;
      if (!cid) { undetermined += 1; return; }
      const c = this.#one(`SELECT capture_sha FROM content WHERE content_id=?`, cid);
      if (c) refs.add(`${cid}@${c.capture_sha}`);
    });
    return { refs, undetermined_legs: undetermined };
  }

  /** R29 (in-process; read as the plane): the candidates a case pinning `finding` at `sha` must disclose. */
  unresolvedRecordOn({ finding = null, sha = null, viewer = undefined } = {}) {
    try {
      const f = typeof finding === "string" ? finding.trim() : "";
      const h = typeof sha === "string" ? sha.trim() : "";
      const held = f && h ? this.#heldAt(f, h) : null;
      if (!held) return { ok: true, wrote: false, finding: f || null, sha: h || null, candidates: [], truncated: false,
                          undetermined: true, why: word("contradiction.why.text_finding_answers") };
      /* Only the candidates with a side on a held referent, selected in SQL (never a scan of every candidate). */
      const refs = JSON.stringify([...held.refs]);
      const ids = this.#rows(`SELECT candidate FROM contradiction_candidates
                               WHERE (a_ref || '@' || a_version) IN (SELECT value FROM json_each(?))
                                  OR (b_ref || '@' || b_version) IN (SELECT value FROM json_each(?))
                               ORDER BY seq`, refs, refs).map((r) => r.candidate);
      const out = [];
      let truncated = false;
      for (const id of ids) {
        const row = this.#candidate(id);
        const view = this.#view(row);
        if (view.weight !== "duty") continue;
        const standing = view.state === "open" || view.state === "explained_not_shown" || view.state === "taken_up"
          || (view.state === "resolved" && view.kind === "irreconcilable");
        if (!standing) continue;
        if (out.length === UNRESOLVED_MAX) { truncated = true; break; }
        const asked = viewer !== undefined && viewer !== null;
        const seenA = !asked || this.#sideSeen(row.a, viewer), seenB = !asked || this.#sideSeen(row.b, viewer);
        const explanation = view.state === "explained_not_shown" ? view.act?.explanation ?? null : null;
        if (seenA && seenB)
          out.push({ candidate: row.candidate, key: row.key, a: this.#shown(row.a), b: this.#shown(row.b), state: view.state,
                     ...(view.kind ? { kind: view.kind } : {}), explanation, inquiry: view.inquiry, depth: 1 });
        else {
          /* DEC-85: a side the stated viewer may not see is withheld whole, and so is anything that may quote it. */
          const seen = seenA ? "a" : seenB ? "b" : null;
          out.push({ candidate: row.candidate, unseen_other_side: true, state: view.state, depth: 1,
                     ...(seen ? { side: this.#shown(row[seen]) } : {}) });
        }
      }
      return { ok: true, wrote: false, finding: f, sha: h, candidates: out, truncated, bound: UNRESOLVED_MAX,
               ...(held.undetermined_legs ? { undetermined_legs: held.undetermined_legs } : {}),
               says: word("contradiction.says.tension_something_finding") };
    } catch (e) {
      return { ok: true, wrote: false, candidates: [], truncated: false, undetermined: true,
               why: String(e && e.message || e).slice(0, 160) };
    }
  }

  /* ===================================================================== *
   * THE CONNECTION OWNER (T33-48; R58; connection-grammar R2, R6–R9, K1487).
   * ===================================================================== */

  /** R58: the node a side is presented at: a claim at its inquiry, a stance at its project, a leg or an extent at the
   *  document its passage is filed in (a leg naming no held passage, at its target), a money side at its fact. */
  #nodeOf(side) {
    if (!side) return null;
    if (side.kind === "claim") return side.inquiry ?? null;
    if (side.kind === "stance") return side.project ?? null;
    if (side.kind === "money") return side.fact ?? null;
    return this.#contentHome(side.content_id) ?? (side.kind === "leg" ? side.target ?? null : null);
  }

  /** R58 (`connection-grammar`'s `neighbours` contract, its R6–R8): for a node that is a side's bundle (an inquiry, a
   *  document) or a money fact, each candidate on it of weight other than `not_shown` and state other than `dismissed`
   *  (R24, R26) whose both sides `viewer` may see (R10), as one derived connection "in tension with" between its two
   *  sides' nodes. It is labelled machine work and graded the lowest grade: a candidate is a proposal, never evidence,
   *  so a chain through it is a lead (connection-grammar R13) and never a basis. A candidate states no dates, so each
   *  item is undetermined at any date asked; it holds no hunch, so `scope` changes nothing. A candidate the viewer may
   *  not see is neither returned nor counted (connection-grammar R7). Writes nothing and records no reader. */
  neighbours({ node = null, kinds = null, at: _at = null, page = null, viewer = null, scope: _scope = null } = {}) {
    if (viewer === undefined || viewer === null || viewer === "")
      return { refused: "VIEWER_MISSING", why: localize("contradiction.index.read_names_member", "a read names the member reading; an absent viewer is neither an administrator nor the public") };
    if (Array.isArray(kinds) && !kinds.includes(CONNECTION_KIND)) return { items: [] };
    if (typeof node !== "string" || !node.trim()) return { items: [] };
    const n = node.trim();
    const side = (col) => `json_extract(${col}, '$.inquiry') = ? OR json_extract(${col}, '$.project') = ?
                           OR json_extract(${col}, '$.target') = ? OR json_extract(${col}, '$.fact') = ?`;
    const ids = this.#rows(`SELECT candidate FROM contradiction_candidates
                             WHERE a_bundle_id = ? OR b_bundle_id = ? OR ${side("a_side")} OR ${side("b_side")}
                             ORDER BY candidate`, n, n, n, n, n, n, n, n, n, n).map((r) => r.candidate);
    const items = [];
    for (const id of ids) {
      const row = this.#candidate(id);
      if (!row || !this.#sideSeen(row.a, viewer) || !this.#sideSeen(row.b, viewer)) continue;
      const from = this.#nodeOf(row.a), to = this.#nodeOf(row.b);
      if (from !== n && to !== n) continue;
      const view = this.#view(row);
      if (view.weight === "not_shown" || view.state === "dismissed") continue;
      const item = this.#connection(row, view, from, to);
      if (item) items.push(item);
    }
    if (items.length > BOUNDS.hub)
      return { items: [], hub: { set_size: items.length,
               why: word("contradiction.why.candidates_see_tension", { hub: BOUNDS.hub }) } };
    items.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    const after = page && typeof page === "object" && typeof page.after === "string" ? page.after : null;
    const rest = after ? items.filter((i) => i.id > after) : items;
    const shown = rest.slice(0, BOUNDS.fanout);
    return { items: shown, ...(rest.length > shown.length ? { next: { after: shown[shown.length - 1].id } } : {}) };
  }

  /** R58: one candidate as a connection in `connection-grammar`'s shape (its R1, R11): its id `derivedId` of the kind,
   *  the two nodes, the instant it was proposed and the method naming the key and the candidate (R15's id), so a leg
   *  could cite it and a checker re-derive it. Null when a side has no node the id grammar names. */
  #connection(row, view, from, to) {
    if (!isRecordId(from) || !isRecordId(to) || typeof row.at !== "string" || !row.at) return null;
    const method = `contradiction ${row.key}: candidate ${row.candidate}`;
    const ref = (k) => ({ kind: row[`${k}_kind`], ref: row[`${k}_ref`], version: row[`${k}_version`] });
    return {
      id: derivedId({ kind: CONNECTION_KIND, from, to, as_of: row.at, method }),
      from, to, kind: CONNECTION_KIND, owner: CONNECTION_OWNER, valid: { ...UNDATED }, evidence: [],
      grade: { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, LOWEST_GRADE] },
      derived: { method, as_of: row.at,
                 inputs: [{ candidate: row.candidate, key: row.key, a: ref("a"), b: ref("b"), run: row.run, label: row.label }] },
      candidate: row.candidate, key: row.key, weight: view.weight, state: view.state,
      machine_work: row.origin !== "member",
      judgement: { label: row.label, reason: row.reason, run: row.run, proposed_by: row.proposed_by, origin: row.origin ?? "machine" },
      says: row.origin === "member"
        ? localize("contradiction.says.two_documents_flagged", "two documents a member set side by side as contradicting, with their reason: a proposal for the project to settle, never evidence. A chain through it is a lead")
        : word("contradiction.says.two_things_paired"),
      undetermined: { why: { key: UNDATED_WHY.key, vars: { ...UNDATED_WHY.vars } } },
    };
  }

  /* ===================================================================== *
   * RESOLVE (N345; R30–R38). A member's attributed act says what a candidate turned out to be; the machine may only
   * recommend in which respects the sides may differ. Nothing here edits a side (R19).
   * ===================================================================== */

  /** A refusal from this module's rows (R20), with its catalogue fields. */
  static #refuse(code, detail, extra = {}) {
    const row = CONTRADICTION_CANDIDATE_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
  }

  /** The coordinate vocabulary for a key (R32): `inquiry` R46's, or null while it cannot be read. */
  #vocab(key) {
    const i = this.#i();
    const v = key === "K5" ? i.PLURALITY_DIFFERENCES : i.CONTRADICTION_COORDINATES;
    return Array.isArray(v) ? v : null;
  }

  /** R30's refusals common to every act, first and in order: a machine or empty author; no candidate; one absent, one
   *  with a side the viewer may not see, or one `not_shown` (the same answer); free text over its cap. Answers
   *  `{refusal}` or `{row, view}`. */
  #actRefusals({ candidate, author, viewer, texts = {} }) {
    const machine = this.#machineRefusal(author);
    if (machine) return { refusal: machine };
    const none = Contradiction.#noCandidate(candidate);
    if (none) return { refusal: none };
    const row = this.#candidate(candidate);
    const view = row && this.#sideSeen(row.a, viewer) && this.#sideSeen(row.b, viewer) ? this.#view(row) : null;
    if (!view || view.weight === "not_shown")
      return { refusal: Contradiction.#noSuch(localize("contradiction.index.no_such_detail", "no contradiction you can see answers to that id")) };
    const over = this.#overCap(texts);
    if (over) return { refusal: over };
    return { row, view };
  }

  /** R30's first refusal (and R36's, R51's): an empty or machine author. */
  #machineRefusal(author) {
    /* DEC-49 REGION is-machine-cannot-act-on-candidate */
    if (typeof author !== "string" || !author.trim() || isMachineIdentity(author))
      return Contradiction.#refuse("MACHINE_CANNOT_ACT_ON_CANDIDATE",
        localize("contradiction.index.machine_refusal_detail", "saying what a contradiction turned out to be is a member's act; this one names no member"));
    /* END DEC-49 REGION is-machine-cannot-act-on-candidate */
    return null;
  }

  /** R30's second refusal (and R51's, R54's): no candidate named. */
  static #noCandidate(candidate) {
    /* DEC-49 REGION is-no-candidate */
    if (typeof candidate !== "string" || !candidate.trim())
      return Contradiction.#refuse("NO_CANDIDATE", localize("contradiction.index.no_candidate_detail", "name the candidate this act is about by its id"));
    /* END DEC-49 REGION is-no-candidate */
    return null;
  }

  /** R30's caps (and R51's, R53's): the first free-text field over its cap, as `WORDS_MALFORMED` naming it. */
  #overCap(texts) {
    for (const [field, value] of Object.entries(texts)) {
      const cap = TEXT_CAPS[field.startsWith("qualifier") ? "qualifier" : field];
      /* DEC-49 REGION is-words-malformed */
      if (typeof value === "string" && cap && value.length > cap)
        return Contradiction.#refuse("WORDS_MALFORMED", localize("contradiction.index.words_malformed_detail", "{field} is {length} characters; at most {cap}",
                                     { field, length: value.length, cap }), { field, limit: cap });
      /* END DEC-49 REGION is-words-malformed */
    }
    return null;
  }

  /** R31's closed-state refusals, asked after R30's by every act but R37. `takeUp` asks only the first. */
  static #closed(view, { takenUp = true } = {}) {
    /* DEC-49 REGION is-candidate-closed */
    if (isClosed(view.state))
      return Contradiction.#refuse("CANDIDATE_CLOSED",
        view.act
          ? localize("contradiction.index.closed_by_detail", "this contradiction was {state} by {author}, and it stays as they left it",
                     { state: view.state, author: view.act.author })
          : localize("contradiction.index.closed_detail", "this contradiction was {state}, and it stays as they left it", { state: view.state }),
        { state: view.state, by: view.act ? view.act.author : null, ...(view.inquiry ? { inquiry: view.inquiry } : {}) });
    /* END DEC-49 REGION is-candidate-closed */
    /* DEC-49 REGION is-candidate-taken-up */
    if (takenUp && view.state === "taken_up")
      return Contradiction.#refuse("CANDIDATE_TAKEN_UP",
        localize("contradiction.index.taken_up_detail", "this contradiction was taken up as {inquiry}", { inquiry: view.inquiry }),
        { inquiry: view.inquiry });
    /* END DEC-49 REGION is-candidate-taken-up */
    return null;
  }

  /** R30's acceptance basis for the coordinates an act records: each `accepted`, naming the standing recommendation it
   *  accepts, else `unaided`. Refuses an acceptance naming a recommendation not standing for this candidate
   *  (C-93.25), or one whose coordinate the act does not record (C-93.26). Answers `{refusal}` or `{basis, standing}`,
   *  `standing` the recommendations standing at the act's instant. */
  #acceptance(row, view, accepted, recorded) {
    const standing = this.#standing(row, view);
    const named = Contradiction.#named(accepted);
    const refusal = Contradiction.#acceptanceRefusal(standing, named, recorded);
    if (refusal) return { refusal };
    const basis = {};
    for (const id of named) {
      const rec = standing.find((r) => r.recommendation === id);
      basis[rec.coordinate] = { basis: "accepted", recommendation: rec.recommendation };
    }
    for (const c of recorded) if (!basis[c]) basis[c] = { basis: "unaided" };
    return { basis, standing: standing.map((r) => ({ recommendation: r.recommendation, coordinate: r.coordinate })) };
  }

  /** The recommendation ids an act names as accepted. */
  static #named(accepted) {
    return accepted === null || accepted === undefined || accepted === "" ? []
      : (Array.isArray(accepted) ? accepted : [accepted]).map((x) => String(x ?? "").trim());
  }

  /** R30's two acceptance refusals over the recommendations standing and the coordinates the act records, or null. */
  static #acceptanceRefusal(standing, named, recorded) {
    for (const id of named) {
      const rec = standing.find((r) => r.recommendation === id);
      /* DEC-49 REGION is-acceptance-not-standing */
      if (!rec) return Contradiction.#refuse("ACCEPTANCE_NOT_STANDING",
        localize("contradiction.index.acceptance_not_standing_detail", "recommendation '{id}' is not standing for this contradiction",
                 { id: id.slice(0, 64) }), { recommendation: id || null });
      /* END DEC-49 REGION is-acceptance-not-standing */
      /* DEC-49 REGION is-acceptance-value-differs */
      if (!recorded.includes(rec.coordinate)) return Contradiction.#refuse("ACCEPTANCE_VALUE_DIFFERS",
        localize("contradiction.index.acceptance_value_differs_detail", "the recommendation accepted names {coordinate}, which this act does not record",
                 { coordinate: rec.coordinate }),
        { recommendation: id, coordinate: rec.coordinate });
      /* END DEC-49 REGION is-acceptance-value-differs */
    }
    return null;
  }

  /** The one append site of `contradiction_acts` (R30, R42). Answers the row as written. */
  #appendAct(row, view, fields) {
    const seq = (this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM contradiction_acts`)?.n ?? 0) + 1;
    const at = fields.at || this.#now();
    const id = sha256HexSync(canonicalJson({ v: 1, candidate: row.candidate, seq, at, author: fields.author }));
    const j = (v) => (v === undefined || v === null ? null : JSON.stringify(v));
    this.#sql.exec(
      `INSERT INTO contradiction_acts (act_id, candidate, act, choice, author, at, seq, reason, words, coordinates,
         explanation, evidence, wrong_side, wrong_reason, qualifiers, acceptance, standing, inquiry, kind,
         a_bundle_id, b_bundle_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, row.candidate, fields.act, fields.choice ?? null, fields.author, at, seq, fields.reason ?? null,
      fields.words ?? null, j(fields.coordinates), fields.explanation ?? null, j(fields.evidence),
      fields.wrong_side ?? null, fields.wrong_reason ?? null, j(fields.qualifiers), j(fields.acceptance),
      j(fields.standing), fields.inquiry ?? null, fields.kind ?? null, row.a_bundle_id, row.b_bundle_id);
    return this.#acts(row.candidate).find((a) => a.act_id === id);
  }

  /** op=contradictiondismiss — R31: a lead is dismissed, with one of three reasons. */
  dismiss({ candidate = null, reason = null, words = null, viewer = null, author = null, at = null } = {}) {
    const g = this.#actRefusals({ candidate, author, viewer, texts: { reason, words } });
    if (g.refusal) return g.refusal;
    const { row, view } = g;
    const closed = Contradiction.#closed(view);
    if (closed) return closed;
    /* DEC-49 REGION is-record-cannot-be-dismissed */
    if (view.weight === "duty" || view.weight === "plurality")
      return Contradiction.#refuse("RECORD_CANNOT_BE_DISMISSED",
        localize("contradiction.index.record_cannot_be_dismissed_detail", "this is a conflict the record holds; it closes only by a resolution"),
        { weight: view.weight });
    /* END DEC-49 REGION is-record-cannot-be-dismissed */
    /* DEC-49 REGION is-dismissal-reason-unknown */
    if (!DISMISSAL_REASONS.includes(reason))
      return Contradiction.#refuse("DISMISSAL_REASON_UNKNOWN",
        localize("contradiction.index.dismissal_reason_detail", "a lead is dismissed for one of {reasons}", { reasons: DISMISSAL_REASONS.join(", ") }),
        { reasons: [...DISMISSAL_REASONS] });
    /* END DEC-49 REGION is-dismissal-reason-unknown */
    const act = this.#record.transact(() => this.#appendAct(row, view, {
      act: "dismiss", author: author.trim(), reason, words: typeof words === "string" && words.trim() ? words.trim() : null, at }));
    return { ok: true, candidate: row.candidate, state: "dismissed", act,
             says: word("contradiction.says.lead_dismissed_member") };
  }

  /** R32's evidence items, each one the viewer may see: `{content}`, `{inquiry, ord}` or `{fact: coordinate}` (a fact R28
   *  states for that coordinate). Answers the first item that fails, or null. */
  #evidenceRefusal(row, evidence, viewer) {
    const facts = this.#facts(row);
    for (let i = 0; i < evidence.length; i++) {
      const e = evidence[i];
      let ok = false;
      if (e && typeof e === "object" && !Array.isArray(e)) {
        if (typeof e.content === "string" && e.content) {
          const home = this.#one(`SELECT bundle_id FROM content WHERE content_id=?`, e.content);
          ok = !!home && this.#sees(home.bundle_id, viewer);
        } else if (typeof e.inquiry === "string" && e.inquiry && e.ord !== undefined && e.ord !== null) {
          const leg = this.#one(`SELECT 1 AS x FROM inquiry_basis WHERE bundle_id=? AND ord=?`, e.inquiry, Number(e.ord));
          ok = !!leg && this.#sees(e.inquiry, viewer);
        } else if (typeof e.fact === "string" && e.fact) {
          ok = facts.some((f) => f.coordinate === e.fact && !f.undetermined);
        }
      }
      /* DEC-49 REGION is-evidence-not-seen */
      if (!ok) return Contradiction.#refuse("EVIDENCE_NOT_SEEN",
        localize("contradiction.index.evidence_not_seen_detail", "evidence item {index} is not one you can see, or is a fact the record does not state",
                 { index: i }), { index: i });
      /* END DEC-49 REGION is-evidence-not-seen */
    }
    return null;
  }

  /** op=contradictionclarify — R32–R34: a member says how the two differ, that one is wrong, or (K5) that they found no
   *  named difference. */
  clarify({ candidate = null, choice = null, coordinates = null, explanation = null, evidence = null, qualifiers = null,
            wrongSide = null, reason = null, accepted = null, viewer = null, author = null, at = null } = {}) {
    const q = qualifiers && typeof qualifiers === "object" && !Array.isArray(qualifiers) ? qualifiers : {};
    const g = this.#actRefusals({ candidate, author, viewer,
      texts: { explanation, reason, qualifier_a: q.a, qualifier_b: q.b } });
    if (g.refusal) return g.refusal;
    const { row, view } = g;
    const closed = Contradiction.#closed(view);
    if (closed) return closed;
    /* DEC-49 REGION is-clarify-not-a-tension */
    if (view.weight === "lead")
      return Contradiction.#refuse("CLARIFY_NOT_A_TENSION", localize("contradiction.index.clarify_not_a_tension_detail", "a lead is dismissed or taken up, never clarified"));
    /* END DEC-49 REGION is-clarify-not-a-tension */
    /* DEC-49 REGION is-clarify-choice-unknown */
    if (!CLARIFY_CHOICES.includes(choice) || (choice === "no_difference" && row.key !== "K5"))
      return Contradiction.#refuse("CLARIFY_CHOICE_UNKNOWN",
        localize("contradiction.index.clarify_choice_detail", "the answers here are {choices}",
                 { choices: (row.key === "K5" ? CLARIFY_CHOICES : CLARIFY_CHOICES.filter((c) => c !== "no_difference")).join(", ") }),
        { choices: row.key === "K5" ? [...CLARIFY_CHOICES] : CLARIFY_CHOICES.filter((c) => c !== "no_difference") });
    /* END DEC-49 REGION is-clarify-choice-unknown */
    const who = author.trim();
    if (choice === "differs") {
      const vocab = this.#vocab(row.key) || [];
      const coords = Array.isArray(coordinates) ? [...new Set(coordinates)] : [];
      /* DEC-49 REGION is-clarify-coordinate-unknown */
      if (!coords.length || coords.some((c) => !vocab.includes(c)))
        return Contradiction.#refuse("CLARIFY_COORDINATE_UNKNOWN",
          localize("contradiction.index.clarify_coordinate_detail", "name at least one of {vocab}",
                   { vocab: vocab.join(", ") || localize("contradiction.index.vocabulary_not_held", "(the vocabulary is not held here)") }),
          { coordinates: [...vocab] });
      /* END DEC-49 REGION is-clarify-coordinate-unknown */
      const acc = this.#acceptance(row, view, accepted, coords);
      if (acc.refusal) return acc.refusal;
      const allAccepted = coords.every((c) => acc.basis[c].basis === "accepted");
      const words = typeof explanation === "string" && explanation.trim() ? explanation.trim() : null;
      /* DEC-49 REGION is-clarify-no-explanation */
      if (!words && !allAccepted)
        return Contradiction.#refuse("CLARIFY_NO_EXPLANATION", localize("contradiction.index.clarify_no_explanation_detail", "explain in your own words how the two differ"));
      /* END DEC-49 REGION is-clarify-no-explanation */
      const items = Array.isArray(evidence) ? evidence : [];
      const bad = this.#evidenceRefusal(row, items, viewer);
      if (bad) return bad;
      const quals = {};
      for (const k of ["a", "b"]) if (typeof q[k] === "string" && q[k].trim()) quals[k] = q[k].trim();
      const evidenced = items.length > 0;
      return this.#record.transact(() => {
        const act = this.#appendAct(row, view, {
          act: "clarify", choice, author: who, coordinates: coords, explanation: words, evidence: items,
          qualifiers: Object.keys(quals).length ? quals : null, acceptance: acc.basis, standing: acc.standing, at });
        /* K4's `subject`: the resolutions that paired the two sides are reported as a defect (entities R38), with the
           member's explanation as the reason and this candidate as the source. */
        const defects = row.key === "K4" && coords.includes("subject") ? this.#reportDefects(row, words, who) : null;
        if (defects && defects.refusal) return defects.refusal;
        return { ok: true, candidate: row.candidate, choice,
                 state: evidenced ? "resolved" : "explained_not_shown", ...(evidenced ? { kind: "dissolved" } : {}),
                 qualifier_standing: evidenced ? "evidenced" : "hypothesis", act,
                 ...(words ? {} : { own_words: false, says_words: word("contradiction.says_words") }),
                 ...(defects ? { defects: defects.reports } : {}),
                 says: evidenced
                   ? word("contradiction.says.member_found_two")
                   : word("contradiction.says.member_explained_how") };
      });
    }
    if (choice === "one_wrong") {
      /* DEC-49 REGION is-wrong-side-unnamed */
      if (wrongSide !== "a" && wrongSide !== "b")
        return Contradiction.#refuse("WRONG_SIDE_UNNAMED", localize("contradiction.index.wrong_side_unnamed_detail", "name the side that is wrong: a or b"));
      /* END DEC-49 REGION is-wrong-side-unnamed */
      /* DEC-49 REGION is-wrong-side-no-reason */
      if (typeof reason !== "string" || !reason.trim())
        return Contradiction.#refuse("WRONG_SIDE_NO_REASON", localize("contradiction.index.wrong_side_no_reason_detail", "say why that side is wrong"));
      /* END DEC-49 REGION is-wrong-side-no-reason */
      if (row.key === "K5") return Contradiction.#noWrongSide(localize("contradiction.index.no_wrong_side_detail", "two projects' conclusions have no wrong side"));
      const acc = this.#acceptance(row, view, accepted, []);
      if (acc.refusal) return acc.refusal;
      const act = this.#record.transact(() => this.#appendAct(row, view, {
        act: "clarify", choice, author: who, wrong_side: wrongSide, wrong_reason: reason.trim(),
        acceptance: acc.basis, standing: acc.standing, at }));
      return { ok: true, candidate: row.candidate, choice, state: "resolved", kind: "corrected", wrong_side: wrongSide, act,
               says: word("contradiction.says.member_named_side") };
    }
    /* R34: no_difference (K5 only). */
    const acc = this.#acceptance(row, view, accepted, []);
    if (acc.refusal) return acc.refusal;
    const act = this.#record.transact(() => this.#appendAct(row, view, {
      act: "clarify", choice, author: who, explanation: typeof explanation === "string" && explanation.trim() ? explanation.trim() : null,
      acceptance: acc.basis, standing: acc.standing, at }));
    return { ok: true, candidate: row.candidate, choice, state: "open", weight: "duty", act,
             says: word("contradiction.says.member_found_named") };
  }

  /** K4 `subject` (R32): report a defect on each established resolution that paired the two sides. */
  #reportDefects(row, words, who) {
    const e = this.#e();
    const entity = row.a?.context?.entity_id ?? null;
    if (!e || typeof e.reportResolutionDefect !== "function" || !entity) return { reports: [] };
    const reason = words || word("contradiction.text.member_found_two", { candidate: row.candidate });
    const reports = [];
    for (const side of [row.a, row.b]) {
      const cap = side.capture_sha ?? this.#one(`SELECT capture_sha FROM content WHERE content_id=?`, side.content_id)?.capture_sha;
      if (!cap) continue;
      for (const r of this.#rows(`SELECT ref FROM resolutions WHERE capture_sha=? AND entity_id=? AND established=1 ORDER BY ref`, cap, entity)) {
        const out = e.reportResolutionDefect({ captureSha: cap, ref: r.ref, entityId: entity, reason,
                                               source: { module: "contradiction", id: row.candidate }, by: who });
        if (out && out.ok === false) return { refusal: out };
        reports.push({ capture_sha: cap, ref: r.ref, entity_id: entity, already: !!(out && out.already) });
      }
    }
    return { reports };
  }

  /** The frontmatter of a new contradiction inquiry (R35): open, surfaced by a member, titled from the question,
   *  linked to the candidate, both sides as legs (the framed side supporting), with no grade. */
  #takeUpDocument(id, row, question, frame, who, at) {
    const i = this.#i();
    const title = typeof i.deriveInquiryTitle === "function" ? i.deriveInquiryTitle(question) : null;
    const leg = (side, name) => {
      /* K6: a money side is a leg on the document its figure was read from, naming the passage when one is held. */
      const fact = side.kind === "money" && this.#moneyHeld()
        ? this.#one(`SELECT sight_bundle, source_content_id FROM money_facts WHERE fact_id=?`, String(side.fact ?? "")) : null;
      const target = side.kind === "claim" || side.kind === "stance" ? side.inquiry
        : side.kind === "money" ? (fact ? fact.sight_bundle : null) : this.#contentHome(side.content_id);
      return { target, content_id: side.kind === "leg" || side.kind === "extent" ? side.content_id
                 : side.kind === "money" && fact ? fact.source_content_id ?? null : null,
               note: word("contradiction.note.side_contradiction", { name, candidate: row.candidate }) };
    };
    const framed = frame === "a" ? leg(row.a, "a") : leg(row.b, "b");
    const other = frame === "a" ? leg(row.b, "b") : leg(row.a, "a");
    if (!framed.target || !other.target) return null;
    const targets = [...new Set([framed.target, other.target])];
    const legLines = (l, role) => [`  - target: ${l.target}`, `    role: ${role}`,
      ...(l.content_id ? [`    content_id: ${l.content_id}`] : []), `    note: "${fmSafe(l.note)}"`];
    const text = ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1",
      `title: "${fmSafe(title ?? question)}"`, "current_state: open", "prior_state: null",
      `created: "${at}"`, `last_updated: "${at}"`, "surfaced_by: human",
      "contradiction:", `  candidate: "${row.candidate}"`,
      "references:", ...targets.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"]),
      "basis:", ...legLines(framed, "supports"), ...legLines(other, "cuts_against"),
      "state_history: []", "---", "", "## Question", "", fmSafe(question), "", "## Session Log", "",
      word("contradiction.text.taken_up_contradiction", { at, who, candidate: row.candidate, frame }), ""].join("\n");
    /* R62: the envelope's title is the document's own safe form, or promotion's comparison refuses any quote. */
    return { text, title: fmSafe(title ?? question) };
  }

  /** op=contradictiontakeup — R35: take a candidate up as a contradiction inquiry, in one act through
   *  `promotion.promote`. */
  takeUp({ candidate = null, question = null, frame = null, viewer = null, author = null, at = null } = {}) {
    const g = this.#actRefusals({ candidate, author, viewer, texts: { question } });
    if (g.refusal) return g.refusal;
    const { row, view } = g;
    const closed = Contradiction.#closed(view, { takenUp: false });
    if (closed) return closed;
    if (view.state === "taken_up")
      return { ok: true, existed: true, candidate: row.candidate, inquiry: view.inquiry, wrote: false,
               says: word("contradiction.says.contradiction_already_taken") };
    /* DEC-49 REGION is-take-up-no-question */
    if (typeof question !== "string" || !question.trim())
      return Contradiction.#refuse("TAKE_UP_NO_QUESTION",
        localize("contradiction.index.take_up_no_question_detail", "word the question, or accept the default shown with the candidate"),
        { default_question: this.#defaultQuestion(row) });
    /* END DEC-49 REGION is-take-up-no-question */
    /* DEC-49 REGION is-take-up-no-frame */
    if (frame !== "a" && frame !== "b")
      return Contradiction.#refuse("TAKE_UP_NO_FRAME", localize("contradiction.index.take_up_no_frame_detail", "choose the side the question is asked around: a or b"));
    /* END DEC-49 REGION is-take-up-no-frame */
    const who = author.trim();
    const when = at || this.#now();
    const p = this.#p();
    return this.#record.transact(() => {
      const id = `${this.#record.allocId("INQ", String(when).slice(0, 4)).id}-contradiction`;
      const doc = this.#takeUpDocument(id, row, question.trim(), frame, who, when);
      if (!doc) return Contradiction.#noSuch(localize("contradiction.index.side_no_longer_held", "a side of this contradiction is no longer held"));
      const promoted = p.promote({ bundleId: id, base: null, snapKey: `takeup_${String(when).replace(/[-:.]/g, "")}_${rand(4)}`,
        author: who, actorIdentity: who, actorViewer: viewer,
        files: [{ path: "bundle.md", text: doc.text }],
        meta: { object_type: "inquiry", title: doc.title, current_state: "open", prior_state: null,
                created: when, last_updated: when } });
      /* A promotion refusal is relayed whole, and nothing is written (the transaction rolls back on it). */
      if (promoted.ok === false) return promoted;
      const act = this.#appendAct(row, view, { act: "take_up", author: who, inquiry: id, at: when,
                                                words: question.trim() });
      return { ok: true, candidate: row.candidate, inquiry: id, state: "taken_up", frame, act,
               promoted: { bundleId: promoted.bundleId, bundleSha: promoted.bundleSha },
               says: word("contradiction.says.contradiction_taken_up") };
    });
  }

  /** The live files of a bundle, carried whole into a revision (promotion R7: a revision drops no path unnamed). */
  #liveFiles(id) {
    const paths = this.#record.livePaths(id) || [];
    return paths.map((path) => {
      const f = this.#record.readFile(id, path);
      return f && typeof f.text === "string" ? { path, text: f.text } : { path, blobSha: f.blobSha, bytes: f.bytes };
    });
  }

  /** R36's C-93.27 check and R56's one predicate: the candidate a contradiction inquiry names, when the inquiry is held
   *  and one the viewer may see, it names a candidate this module holds (`inquiry` R48's `contradictionLink`), and the
   *  viewer may see both of its sides (R10); else null. */
  #linkedCandidate(id, viewer) {
    const i = this.#i();
    const link = id && this.#sees(id, viewer) && this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, id)
      && typeof i.contradictionLink === "function" ? i.contradictionLink(id) : null;
    const row = link && typeof link.candidate === "string" ? this.#candidate(link.candidate) : null;
    return row && this.#sideSeen(row.a, viewer) && this.#sideSeen(row.b, viewer) ? row : null;
  }

  /** R56 (N365; in-process, read as the viewer, for `affordances` R14): whether R36's `NOT_A_CONTRADICTION_INQUIRY`
   *  check passes for this viewer, answered by the very predicate `resolve` applies, so the offer and the act cannot
   *  disagree. `false` for an absent viewer and for anything it cannot read. Writes nothing; never throws. */
  candidateSidesSeen({ inquiry = null, viewer = null } = {}) {
    try {
      const id = typeof inquiry === "string" ? inquiry.trim() : "";
      return !!this.#linkedCandidate(id, viewer);
    } catch { return false; }
  }

  /** op=contradictionresolve — R36: a contradiction inquiry's conclusion, with its resolution. */
  resolve({ inquiry = null, resolution = null, conclusion = null, version = null, falsifier = null, noFalsifier = false,
            accepted = null, viewer = null, author = null, at = null } = {}) {
    const machine = this.#machineRefusal(author);
    if (machine) return machine;
    const id = typeof inquiry === "string" ? inquiry.trim() : "";
    const i = this.#i();
    const row = this.#linkedCandidate(id, viewer);
    if (!row)
      return Contradiction.#notContradictionInquiry(localize("contradiction.index.not_a_contradiction_inquiry_detail", "no question you can see answers to that id as one taken up from a contradiction"));
    const res = resolution && typeof resolution === "object" && !Array.isArray(resolution) ? resolution : {};
    const family = this.#family(res.kind);
    if (row.key === "K5" && (family === "CORRECTED" || res.kind === "double_speak_or_reversal"))
      return Contradiction.#noWrongSide(localize("contradiction.index.no_wrong_side_or_double_speak_detail", "two projects' conclusions have no wrong side and no double-speak"));
    const view = this.#view(row);
    const coords = Array.isArray(res.coordinates) ? res.coordinates.filter((c) => typeof c === "string") : [];
    const acc = this.#acceptance(row, view, accepted, coords);
    if (acc.refusal) return acc.refusal;
    const who = author.trim();
    const when = at || this.#now();
    return this.#record.transact(() => {
      const head = this.#record.head(id);
      const files = this.#liveFiles(id);
      const md = files.find((f) => f.path === "bundle.md");
      if (!head || !md || typeof md.text !== "string")
        return Contradiction.#notContradictionInquiry(localize("contradiction.index.document_not_text_detail", "the question's document is not held as text"));
      let lines = i.resolutionLines(res);
      lines = Array.isArray(lines) ? lines : String(lines ?? "").split("\n").filter(Boolean);
      if (!lines.length || !/^resolution:/.test(lines[0])) lines = ["resolution:", ...lines.map((l) => `  ${l.replace(/^\s*/, "")}`)];
      let text = setFrontmatterLines(md.text, "resolution", lines);
      text = setOrAddScalar(text, "last_updated", `"${when}"`);
      text = appendSessionLog(text, localize("contradiction.index.resolution_recorded", "- {when} · {who} · resolution recorded as {kind} (contradiction {candidate})",
                                             { when, who, kind: fmSafe(res.kind), candidate: row.candidate }));
      const written = this.#p().promote({ bundleId: id, base: head.bundleSha, snapKey: `resolve_${String(when).replace(/[-:.]/g, "")}_${rand(4)}`,
        author: who, actorIdentity: who, actorViewer: viewer,
        files: files.map((f) => (f.path === "bundle.md" ? { path: "bundle.md", text } : f)),
        meta: { object_type: "inquiry", last_updated: when } });
      if (written.ok === false) return written;
      /* R36: no named version means no reading to adopt on a freshly taken-up question, so the member's conclusion is her
         own reading, accepted and concluded on in one act (`basis-versions` R51; its BAD_READING reaches her). */
      const named = typeof version === "string" ? version.trim() : "";
      const concluded = this.#b().conclude({ target: id, conclusion: conclusion ?? "", version: named,
        ...(named ? {} : { reading: String(conclusion ?? "") }),
        falsifier: falsifier ?? "", noFalsifier: !!noFalsifier, viewer, author: who, identity: who });
      if (concluded.ok === false) return concluded;
      const act = this.#appendAct(row, view, { act: "resolve", author: who, inquiry: id, kind: res.kind ?? null,
        coordinates: coords.length ? coords : null, wrong_side: res.wrong_side ?? null, wrong_reason: res.reason ?? null,
        qualifiers: res.qualifiers ?? null, acceptance: acc.basis, standing: acc.standing, at: when });
      return { ok: true, inquiry: id, candidate: row.candidate, state: "resolved", kind: res.kind, family, act,
               conclusion: concluded,
               says: word("contradiction.says.question_concluded_resolution") };
    });
  }

  /** R61: one passage a member names, `{capture, extent}`: the capture it is of and the extent in it (`content` R1's), found
   *  as the content row held for exactly that capture and canonical extent (`content` R45's read contract) and filed in a
   *  bundle the viewer may see. A passage that is not named whole, is not held, or is not seen is one answer. */
  #flagPassage(name, passage, viewer) {
    const missing = (why) => ({ refusal: Contradiction.#refuse("FLAG_NO_PASSAGE",
      localize("contradiction.index.flag_no_passage_detail", "{name}: {why}", { name, why }), { passage: name }) });
    const p = passage && typeof passage === "object" && !Array.isArray(passage) ? passage : null;
    const capture = p && typeof p.capture === "string" ? p.capture.trim() : "";
    const extent = p && p.extent && typeof p.extent === "object" && !Array.isArray(p.extent) ? p.extent : null;
    /* DEC-49 REGION is-flag-no-passage */
    if (!capture || !extent || typeof extent.kind !== "string")
      return missing(localize("contradiction.index.flag_passage_unnamed", "name the capture and the extent in it"));
    let canon;
    try { canon = canonicalExtent(extent); } catch { canon = null; }
    const row = canon ? this.#rows(`SELECT content_id, capture_sha, bundle_id, ref, extent_kind, stale FROM content
                                     WHERE capture_sha=? AND extent=? ORDER BY content_id LIMIT 16`, capture, canon)
      .find((r) => this.#sees(r.bundle_id, viewer)) : null;
    if (row) return { row };
    /* (K5148) a passage no content row yet holds, of a reading the viewer may see, is made citable by the flagging member in
       `flag` below, once every other refusal has passed; here it is only found, and a page the reading does not hold,
       a bundle not seen and a capture never read stay one answer. */
    const unit = canon ? this.#readUnit(capture, canon, viewer) : null;
    if (!unit) return missing(localize("contradiction.index.flag_passage_unheld", "no passage you can see is held there"));
    const ctx = this.#ct().contentContextFor(capture, { searched: false });
    if (checkContentExtent(extent, ctx)) return missing(localize("contradiction.index.flag_passage_unheld", "no passage you can see is held there"));
    /* END DEC-49 REGION is-flag-no-passage */
    return { row: { content_id: null, capture_sha: capture, bundle_id: unit.bundle_id, ref: describeExtent(extent),
                    extent_kind: extent.kind, stale: 0 }, mint: { extent } };
  }

  /** The reading's own unit at a canonical extent, `{bundle_id}`, when the capture has a reading filed in a bundle the viewer
   *  may see and its indexed units (extraction R36) include that extent; null otherwise. Reads the units page by page, bounded. */
  #readUnit(capture, canon, viewer) {
    const filed = this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, capture);
    const x = this.#x();
    if (!filed || !this.#sees(filed.bundle_id, viewer) || !x || typeof x.unitsOf !== "function") return null;
    let after = null;
    for (let pages = 0; pages < FLAG_UNIT_PAGES_MAX; pages++) {
      const page = x.unitsOf(capture, after === null ? {} : { after });
      for (const u of page && Array.isArray(page.units) ? page.units : []) {
        let at = null;
        try { at = canonicalExtent(u.extent); } catch { at = null; }
        if (at === canon) return { bundle_id: filed.bundle_id };
      }
      after = page && Number.isInteger(page.next) ? page.next : null;
      if (after === null) return null;
    }
    return null;
  }

  /** op=contradictionflag — R61: a member sets a passage of one document beside a passage of another as a contradiction
   *  their project settles, with their reason. It is recorded as a run's judgement would be (R15), under the key `FLAG`,
   *  label `world`, as the member's own act (`origin: "member"`, `proposed_by` the member): never machine work, and a lead
   *  (R24), settled as any candidate (R31–R36). A candidate already held over the same two passages (any key, shown) is
   *  answered and nothing is written. It never edits a document. */
  flag({ here = null, other = null, reason = null, viewer = null, author = null, at = null } = {}) {
    const machine = this.#machineRefusal(author);
    if (machine) return machine;
    const found = [["here", here], ["other", other]].map(([name, p]) => this.#flagPassage(name, p, viewer));
    const lost = found.find((f) => f.refusal);
    if (lost) return lost.refusal;
    const [x, y] = found.map((f) => f.row);
    const mints = found.map((f) => f.mint ?? null);
    /* DEC-49 REGION is-flag-same-document */
    if (x.bundle_id === y.bundle_id || x.capture_sha === y.capture_sha)
      return Contradiction.#refuse("FLAG_SAME_DOCUMENT",
        localize("contradiction.index.flag_same_document_detail", "both passages are in the same document"));
    /* END DEC-49 REGION is-flag-same-document */
    /* DEC-49 REGION is-flag-no-reason */
    if (typeof reason !== "string" || !reason.trim())
      return Contradiction.#refuse("FLAG_NO_REASON",
        localize("contradiction.index.flag_no_reason_detail", "say in your own words how the two disagree: no reason was given"));
    /* END DEC-49 REGION is-flag-no-reason */
    const over = this.#overCap({ reason });
    if (over) return over;
    const who = author.trim();
    const stamp = at || this.#now();
    /* (K5148) the flagging member makes each unheld passage citable (`content`'s mint, minted by them), with the candidate in one
       write: the rows of this call, never a refusal's. */
    const rows = this.#record.transact(() => [x, y].map((r, k) => {
      if (!mints[k]) return r;
      const m = this.#ct().mint({ bundleId: r.bundle_id, captureSha: r.capture_sha, extent: mints[k].extent, mintedBy: who, at: stamp });
      return m.ok ? this.#one(`SELECT content_id, capture_sha, bundle_id, ref, extent_kind, stale FROM content WHERE content_id=?`, m.content_id) : null;
    }));
    if (rows.some((r) => !r))
      return Contradiction.#refuse("FLAG_NO_PASSAGE", localize("contradiction.index.flag_passage_unheld", "no passage you can see is held there"));
    return this.#flagWritten({ x: rows[0], y: rows[1], reason, who, stamp, viewer });
  }

  #flagWritten({ x, y, reason, who, stamp, viewer }) {
    const memo = new Map();
    const side = (r) => {
      const d = this.#doc(r.capture_sha, memo, viewer);
      return { kind: "extent", content_id: r.content_id, capture_sha: r.capture_sha, ref: r.ref, extent_kind: r.extent_kind,
               doctype: d.doctype, date: d.date,
               ...(d.dated ? { date_precision: d.dated.precision, date_zone: d.dated.zone } : {}), read: d.read };
    };
    const handle = (q) => `${q.kind}|${q.ref}@${q.version}`;
    const [sx, sy] = [side(x), side(y)];
    const [rx, ry] = [this.#side(sx), this.#side(sy)];
    const inOrder = handle(rx) <= handle(ry);
    const [a, b] = inOrder ? [rx, ry] : [ry, rx];
    const [pa, pb] = inOrder ? [sx, sy] : [sy, sx];
    const id = sha256HexSync(canonicalJson({ v: 1, key: FLAG_KEY, sides: [handle(a), handle(b)] }));
    /* A candidate already held over the same two passages, whichever key formed it, is the one answered; one withheld as
       `not_shown` is not shown to this member, so it is no answer to a flag. */
    const held = this.#rows(`SELECT candidate FROM contradiction_candidates
                              WHERE (a_ref=? AND a_version=? AND b_ref=? AND b_version=?)
                                 OR (a_ref=? AND a_version=? AND b_ref=? AND b_version=?) ORDER BY seq`,
                            a.ref, a.version, b.ref, b.version, b.ref, b.version, a.ref, a.version)
      .map((r) => ({ id: r.candidate, row: this.#candidate(r.candidate) }))
      .map((c) => ({ ...c, view: this.#view(c.row) }))
      .find((c) => c.view.weight !== "not_shown" && this.#sideSeen(c.row.a, viewer) && this.#sideSeen(c.row.b, viewer));
    if (held)
      return { ok: true, already: true, wrote: false, candidate: held.id, state: held.view.state,
               says: localize("contradiction.says.flag_already_held", "these two passages are already set side by side as a contradiction, and it stays as it is") };
    const why = localize("contradiction.flag_why", "a member set these two documents side by side as contradicting, with their reason");
    const row = { candidate: id, key: FLAG_KEY, a, b, run: "", proposed_by: who, label: FLAG_LABEL, reason: reason.trim(),
                  origin: "member", at: stamp, a_side: { ...pa, context: { why } }, b_side: { ...pb, context: { why } } };
    this.#record.transact(() => this.#append(row));
    return { ok: true, wrote: true, candidate: id, key: FLAG_KEY, weight: "lead", state: "open",
             flagged_by: { member: who, at: stamp, reason: row.reason },
             says: localize("contradiction.says.flag_written", "these two passages are set side by side as a contradiction for your project to settle: a lead, not a finding. Neither document is changed") };
  }

  /** op=contradictionrecommend — R37: the machine's one act. */
  recommend({ run = null, candidate = null, coordinates = null, proposedBy = null, viewer = null, caller = null, at = null } = {}) {
    const gate = this.#runRefusals({ run, proposedBy, viewer, caller });
    if (gate) return gate;
    const runId = Contradiction.#runId(run);
    const list = Array.isArray(coordinates) ? coordinates : [];
    /* DEC-49 REGION is-recommend-no-coordinates */
    if (!list.length)
      return Contradiction.#refuse("RECOMMEND_NO_COORDINATES",
        localize("contradiction.index.recommend_no_coordinates_detail", "name at least one respect in which the sides may differ"), { run: runId });
    /* END DEC-49 REGION is-recommend-no-coordinates */
    const row = typeof candidate === "string" ? this.#candidate(candidate) : null;
    const vocab = row ? (this.#vocab(row.key) || [])
      : [...new Set([...(this.#vocab("K1") || []), ...(this.#vocab("K5") || [])])];
    for (let n = 0; n < list.length; n++) {
      const c = list[n] && typeof list[n] === "object" ? list[n].coordinate : null;
      /* DEC-49 REGION is-recommend-coordinate-unknown */
      if (!vocab.includes(c))
        return Contradiction.#refuse("RECOMMEND_COORDINATE_UNKNOWN",
          localize("contradiction.index.recommend_coordinate_detail", "recommendation {index} names '{coordinate}'", { index: n, coordinate: String(c).slice(0, 40) }),
          { run: runId, index: n, coordinates: [...vocab] });
      /* END DEC-49 REGION is-recommend-coordinate-unknown */
    }
    for (let n = 0; n < list.length; n++) {
      /* DEC-49 REGION is-recommend-no-reason */
      if (typeof list[n].reason !== "string" || !list[n].reason.trim())
        return Contradiction.#refuse("RECOMMEND_NO_REASON",
          localize("contradiction.index.recommend_no_reason_detail", "recommendation {index} carries no reason", { index: n }), { run: runId, index: n });
      /* END DEC-49 REGION is-recommend-no-reason */
    }
    const seen = row && this.#sideSeen(row.a, viewer) && this.#sideSeen(row.b, viewer);
    const view = seen ? this.#view(row) : null;
    /* DEC-49 REGION is-recommend-candidate-not-standing */
    if (!view || view.weight === "not_shown" || !isStanding(view.state))
      return Contradiction.#refuse("RECOMMEND_CANDIDATE_NOT_STANDING",
        localize("contradiction.index.recommend_not_standing_detail", "that contradiction is not open to recommendation"), { run: runId });
    /* END DEC-49 REGION is-recommend-candidate-not-standing */
    const when = at || this.#now();
    const written = this.#record.transact(() => list.map((x) => {
      const id = sha256HexSync(canonicalJson({ v: 1, run: runId, candidate: row.candidate, coordinate: x.coordinate }));
      if (this.#one(`SELECT 1 AS x FROM contradiction_recommendations WHERE recommendation=?`, id)) return { id, new: false };
      const seq = (this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM contradiction_recommendations`)?.n ?? 0) + 1;
      this.#sql.exec(`INSERT INTO contradiction_recommendations (recommendation, candidate, run, coordinate, proposed_by,
          reason, origin, at, seq, a_bundle_id, b_bundle_id) VALUES (?,?,?,?,?,?,'machine',?,?,?,?)`,
        id, row.candidate, runId, x.coordinate, proposedBy.trim(), x.reason.trim().slice(0, CANDIDATE_REASON_MAX), when, seq,
        row.a_bundle_id, row.b_bundle_id);
      return { id, new: true };
    }));
    const recs = written.map((w) => ({ new: w.new, ...this.#one(`SELECT recommendation, candidate, run, coordinate, proposed_by,
      reason, origin, at FROM contradiction_recommendations WHERE recommendation=?`, w.id), machine_work: true }));
    const n = written.filter((w) => w.new).length;
    return { ok: true, run: runId, candidate: row.candidate, written: n, unchanged: written.length - n, recommendations: recs,
             says: word("contradiction.says.machine_recommendation_respect_two") };
  }

  /** R13's first four refusals, shared by `propose` and `recommend` (R37): proposer, run, principal, running. Answers
   *  the refusal, or null. */
  #runRefusals({ run, proposedBy, viewer, caller }) {
    /* DEC-49 REGION is-candidate-no-proposer */
    if (typeof proposedBy !== "string" || !proposedBy.trim())
      return Contradiction.#refuse("CANDIDATE_NO_PROPOSER",
        localize("contradiction.index.no_proposer_detail", "machine work records who proposed it; the plane stamps that from the credential that asked, so an empty one means the act arrived by a route that does not attribute it"));
    /* END DEC-49 REGION is-candidate-no-proposer */
    const runId = Contradiction.#runId(run);
    const r = runId && this.#runGate ? this.#runGate.gate(runId, viewer, caller) : null;
    /* DEC-49 REGION is-candidate-no-run */
    if (!r || r.found !== true)
      return Contradiction.#refuse("CANDIDATE_NO_RUN",
        runId ? localize("contradiction.index.no_run_detail", "no run named '{run}' is open in this store", { run: runId.slice(0, 60) })
              : localize("contradiction.index.no_run_named_detail", "pass run=<the run whose work this is>: machine work names the run it came from"),
        { run: runId || null });
    /* END DEC-49 REGION is-candidate-no-run */
    const np = r.refusal;
    if (np)
      return { ok: false, reason: np.code, code: np.code, check: np.check, translation: np.translation,
               detail: np.detail, run: runId, note: word("contradiction.note.machine_work_names") };
    /* DEC-49 REGION is-candidate-run-not-running */
    if (r.running !== true)
      return Contradiction.#refuse("CANDIDATE_RUN_NOT_RUNNING",
        localize("contradiction.index.run_not_running_detail", "the run '{run}' has ended; its work is read against the conditions it was formed under",
                 { run: runId.slice(0, 60) }), { run: runId });
    /* END DEC-49 REGION is-candidate-run-not-running */
    return null;
  }

  /** A run named by a request, trimmed; empty when none. */
  static #runId(run) { return typeof run === "string" ? run.trim() : ""; }

  /** R38: the promotion check registered with `promotion` (its R39). A non-replay promotion whose document names a
   *  candidate this module does not hold, or one with a side its author may not see, is refused `CANDIDATE_NOT_HELD`
   *  (C-93.32): `inquiry` R47's link is enforced at the record's one door. */
  promotionCheck(c) {
    try {
      if (!c || c.replay || (c.pkg && c.pkg.replay)) return null;
      const fm = c.docFm && typeof c.docFm === "object" ? c.docFm : null;
      const link = fm && fm.contradiction && typeof fm.contradiction === "object" ? fm.contradiction : null;
      if (!link || link.candidate === undefined || link.candidate === null) return null;
      const who = (c.pkg && (c.pkg.actorViewer || c.pkg.actorIdentity)) || c.author || null;
      const row = typeof link.candidate === "string" ? this.#candidate(link.candidate) : null;
      if (!row || !this.#sideSeen(row.a, who) || !this.#sideSeen(row.b, who))
        return Contradiction.#notHeld(typeof link.candidate === "string" ? link.candidate : null,
          localize("contradiction.index.candidate_not_held_detail", "this question names a contradiction the record does not hold, or one whose side its author may not see"));
      return null;
    } catch (e) {
      return Contradiction.#notHeld(null, localize("contradiction.index.candidate_unreadable", "the candidate could not be read ({e})",
                                                   { e: String(e && e.message || e).slice(0, 80) }));
    }
  }

  /** R38's one refusal (C-93.32). */
  static #notHeld(candidate, detail) {
    /* DEC-49 REGION is-candidate-not-held */
    const row = CONTRADICTION_CANDIDATE_CHECKS.CANDIDATE_NOT_HELD;
    return { ok: false, reason: "CANDIDATE_NOT_HELD", code: "CANDIDATE_NOT_HELD",
             check: row.check, translation: row.translation,
             detail, candidate };
    /* END DEC-49 REGION is-candidate-not-held */
  }

  /** R36's first refusal after the author's (C-93.27): absent, invisible and plain answer alike. */
  static #notContradictionInquiry(detail) {
    /* DEC-49 REGION is-not-a-contradiction-inquiry */
    const row = CONTRADICTION_CANDIDATE_CHECKS.NOT_A_CONTRADICTION_INQUIRY;
    return { ok: false, reason: "NOT_A_CONTRADICTION_INQUIRY", code: "NOT_A_CONTRADICTION_INQUIRY",
             check: row.check, translation: row.translation,
             detail };
    /* END DEC-49 REGION is-not-a-contradiction-inquiry */
  }

  /** R33, R36 (C-93.22): two projects' conclusions have no wrong side. */
  static #noWrongSide(detail) {
    /* DEC-49 REGION is-plurality-has-no-wrong-side */
    const row = CONTRADICTION_CANDIDATE_CHECKS.PLURALITY_HAS_NO_WRONG_SIDE;
    return { ok: false, reason: "PLURALITY_HAS_NO_WRONG_SIDE", code: "PLURALITY_HAS_NO_WRONG_SIDE",
             check: row.check, translation: row.translation,
             detail };
    /* END DEC-49 REGION is-plurality-has-no-wrong-side */
  }

  /* ===================================================================== *
   * THE MEASURES (N345; R39–R41).
   * ===================================================================== */

  /** R39: acceptance per coordinate, counted over the acts that record a coordinate (clarify, resolve). Counts only,
   *  never a bare percentage; `review_due` by `ACCEPTANCE_REVIEW`, PROVISIONAL. Never throws. */
  acceptanceRates({ coordinate = null, since = null } = {}) {
    const per = {};
    const slot = (c) => (per[c] ||= { coordinate: c, offered: 0, accepted: 0, chosen_unaided: 0, chose_otherwise: 0 });
    try {
      const acts = this.#rows(`SELECT act, at, coordinates, acceptance, standing FROM contradiction_acts
                                WHERE act IN ('clarify', 'resolve') ORDER BY seq`);
      for (const a of acts) {
        if (typeof since === "string" && since && !(a.at >= since)) continue;
        const j = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
        const recorded = j(a.coordinates) || [];
        const basis = j(a.acceptance) || {};
        const standing = [...new Set((j(a.standing) || []).map((r) => r.coordinate))];
        for (const c of standing) {
          const s = slot(c);
          s.offered += 1;
          if (!recorded.includes(c)) s.chose_otherwise += 1;
        }
        for (const c of recorded) {
          const s = slot(c);
          if (basis[c] && basis[c].basis === "accepted") s.accepted += 1;
          else s.chosen_unaided += 1;
        }
      }
    } catch { /* never throws: what was counted stands */ }
    const rows = Object.values(per).filter((r) => !coordinate || r.coordinate === coordinate)
      .sort((x, y) => (x.coordinate < y.coordinate ? -1 : 1))
      .map((r) => ({ ...r, review_due: r.offered >= ACCEPTANCE_REVIEW.min_offered
                                          && r.accepted / r.offered >= ACCEPTANCE_REVIEW.rate }));
    return { ok: true, wrote: false, coordinates: rows, threshold: { ...ACCEPTANCE_REVIEW },
             says: word("contradiction.says.counts_bare_percentage") };
  }

  /** R40: dismissed leads, counted by reason, by key and by label; `false_conflicts` counts only the first two reasons.
   *  Never throws. */
  dismissalMeasure({ since = null } = {}) {
    const byReason = Object.fromEntries(DISMISSAL_REASONS.map((r) => [r, 0]));
    const byKey = {}, byLabel = {};
    let total = 0;
    try {
      for (const a of this.#rows(`SELECT a.reason, a.at, c.key, c.label FROM contradiction_acts a
                                    JOIN contradiction_candidates c ON c.candidate = a.candidate
                                   WHERE a.act = 'dismiss' ORDER BY a.seq`)) {
        if (typeof since === "string" && since && !(a.at >= since)) continue;
        total += 1;
        byReason[a.reason] = (byReason[a.reason] || 0) + 1;
        byKey[a.key] = (byKey[a.key] || 0) + 1;
        byLabel[a.label] = (byLabel[a.label] || 0) + 1;
      }
    } catch { /* never throws */ }
    return { ok: true, wrote: false, dismissed: total, by_reason: byReason, by_key: byKey, by_label: byLabel,
             false_conflicts: FALSE_CONFLICT_REASONS.reduce((n, r) => n + (byReason[r] || 0), 0),
             says: word("contradiction.says.real_conflict_pursued") };
  }

  /* ===================================================================== *
   * A CONFLICT WITH A SIDE THE MEMBER CANNOT SEE (DEC-85 as K456 clarified it; R49–R55). A member who sees a conflict
   * between projects half is told on their own side only: never the other side, its kind, bundle, source, project or
   * members, the key or the machine's words, or how many parties there are.
   * ===================================================================== */

  /** R50's three refusals for `project`, in order: the existence answer (membership R77), no such project (R78), a
   *  viewer who is not a joined participant (R87). Answers a refusal or `{member}`. */
  #projectRefusals(project, viewer) {
    const m = this.#m();
    const pid = typeof project === "string" ? project.trim() : "";
    const ex = pid && m && typeof m.existenceAct === "function" ? m.existenceAct(pid, viewer) : null;
    if (ex) return { refusal: ex };
    const held = pid ? this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, pid) : null;
    if (!held || held.object_type !== "project" || !this.#sees(pid, viewer)) return { refusal: noSuchProject(pid || null) };
    const member = this.#memberOf(viewer);
    if (!member || !m || !m.isJoinedParticipant(pid, member)) return { refusal: notAParticipant(pid, member) };
    return { project: pid, member };
  }

  /** The candidates `project` is a party of (R49), in id order: those whose side's inquiry the project draws on, whose
   *  side's content row one of its inquiries cites, or whose stance is its own. */
  #partyCandidates(project) {
    return this.#candidatesNaming({ kind: "project", id: project }).sort();
  }

  /** R49, R50: whether `project` is a party through a side the viewer may see, and which side that is. */
  #seenPartySide(row, project, viewer) {
    for (const which of ["a", "b"]) {
      if (!this.#sideSeen(row[which], viewer)) continue;
      if (this.#reachOf(row[which]).projects.includes(project)) return which;
    }
    return null;
  }

  /** R50 (T41, D64), R55: the other parties a notice names: each project reached through the side the viewer does not
   *  see, other than `project`, that is not hidden (membership R85) and whose name the viewer may see (its R44 `sight`
   *  is not `NONE`), as `{id, name}` in id order. A hidden party is never named or counted, whatever the viewer's
   *  sight; a project reached only through the viewer's own side is on their side and is not named. */
  #namedParties(row, which, project, viewer) {
    const m = this.#m();
    if (!m || typeof m.visibilityOf !== "function" || typeof m.sight !== "function") return [];
    const other = which === "a" ? "b" : "a";
    return this.#reachOf(row[other]).projects
      .filter((p) => p !== project && m.visibilityOf(p) === "discoverable" && m.sight(p, viewer) !== "none")
      .map((p) => ({ id: p, name: this.#projectName(p) }));
  }

  /** op=contradictionnotices — R50: the notices to a project's members, on their own side. */
  conflictNotices({ project = null, after = null, limit = null, viewer = null } = {}) {
    try {
      const g = this.#projectRefusals(project, viewer);
      if (g.refusal) return g.refusal;
      const n = Number(limit);
      const cap = limit === null || limit === undefined || limit === "" || !Number.isFinite(n) || n < 1
        ? PAGE_MAX : Math.min(Math.floor(n), PAGE_MAX);
      const notices = [];
      let truncated = false;
      for (const id of this.#partyCandidates(g.project)) {
        if (typeof after === "string" && after && !(id > after)) continue;
        const row = this.#candidate(id);
        const seenA = this.#sideSeen(row.a, viewer), seenB = this.#sideSeen(row.b, viewer);
        if (seenA === seenB) continue;                 /* whole, or not at all: not a notice */
        const which = seenA ? "a" : "b";
        if (!this.#reachOf(row[which]).projects.includes(g.project)) continue;
        const view = this.#view(row);
        if (!isProjectConflict(view.weight, view.state)) continue;
        if (notices.length === cap) { truncated = true; break; }
        const parties = this.#parties(row);
        const named = this.#namedParties(row, which, g.project, viewer);
        notices.push({ candidate: row.candidate, project: g.project, weight: view.weight, state: view.state,
                       side: this.#shown(row[which]), named, says: named.length ? NOTICE_NAMED_SENTENCE : NOTICE_SENTENCE,
                       ...this.#partyView(row, g.project),
                       ...(parties.truncated ? { reveal_undetermined: true,
                         reveal_why: word("contradiction.reveal_why") } : {}) });
      }
      return { ok: true, wrote: false, project: g.project, limit: cap, truncated,
               cursor: notices.length ? notices[notices.length - 1].candidate : null, notices };
    } catch (e) {
      return { ok: true, wrote: false, notices: [], truncated: false, undetermined: true,
               why: String(e && e.message || e).slice(0, 160) };
    }
  }

  /** R51's refusals shared with R53 (its first seven), in order. Answers `{refusal}` or `{row, view, project, member}`. */
  #partyRefusals({ candidate, project, viewer, author }) {
    const machine = this.#machineRefusal(author);
    if (machine) return { refusal: machine };
    const none = Contradiction.#noCandidate(candidate);
    if (none) return { refusal: none };
    const g = this.#projectRefusals(project, viewer);
    if (g.refusal) return { refusal: g.refusal };
    const row = this.#candidate(candidate);
    if (!row || (!this.#sideSeen(row.a, viewer) && !this.#sideSeen(row.b, viewer)))
      return { refusal: Contradiction.#noSuch(localize("contradiction.index.no_such_detail", "no contradiction you can see answers to that id")) };
    const view = this.#view(row);
    const party = Contradiction.#partyRefusal(!!this.#seenPartySide(row, g.project, viewer), view.weight, g.project);
    if (party) return { refusal: party };
    const closed = Contradiction.#closed(view, { takenUp: false });
    if (closed) return { refusal: closed };
    return { row, view, project: g.project, member: g.member };
  }

  /** R51's party refusals, in order: not a party through a side the viewer may see; not a conflict between projects. */
  static #partyRefusal(isParty, weight, project) {
    /* DEC-49 REGION is-not-a-party */
    if (!isParty)
      return Contradiction.#refuse("NOT_A_PARTY",
        localize("contradiction.index.not_a_party_detail", "the project named does not rest on the side of this conflict you can see"), { project });
    /* END DEC-49 REGION is-not-a-party */
    /* DEC-49 REGION is-not-a-project-conflict */
    if (weight !== "duty" && weight !== "plurality")
      return Contradiction.#refuse("NOT_A_PROJECT_CONFLICT",
        localize("contradiction.index.not_a_project_conflict_detail", "a lead is not a conflict the record holds between projects"));
    /* END DEC-49 REGION is-not-a-project-conflict */
    return null;
  }

  /** op=contradictionoptin — R51, R52: a project asks to resolve the conflict; the opt-in that leaves every party opted
   *  in records the reveal in the same act. */
  optIn({ candidate = null, project = null, words = null, viewer = null, author = null, at = null } = {}) {
    const g = this.#partyRefusals({ candidate, project, viewer, author });
    if (g.refusal) return g.refusal;
    const over = this.#overCap({ words });
    if (over) return over;
    const { row } = g;
    const who = author.trim();
    const when = at || this.#now();
    return this.#record.transact(() => {
      const held = this.#optins(row.candidate);
      const first = held.optins.find((r) => r.project_id === g.project);
      if (first)
        return { ok: true, already: true, wrote: false, candidate: row.candidate, project: g.project,
                 opted_in: { member: first.author, at: first.at, words: first.words ?? null },
                 says: word("contradiction.says.project_already_asked") };
      const seq = () => (this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM contradiction_optins`)?.n ?? 0) + 1;
      const put = (kind, fields) => {
        const s = seq();
        const id = sha256HexSync(canonicalJson({ v: 1, candidate: row.candidate, kind, seq: s, at: when }));
        this.#sql.exec(`INSERT INTO contradiction_optins (optin, candidate, kind, project_id, author, at, seq, words,
            parties, a_bundle_id, b_bundle_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          id, row.candidate, kind, fields.project ?? null, fields.author ?? null, when, s, fields.words ?? null,
          fields.parties ? JSON.stringify(fields.parties) : null, row.a_bundle_id, row.b_bundle_id);
      };
      put("optin", { project: g.project, author: who, words: typeof words === "string" && words.trim() ? words.trim() : null });
      /* R52: the parties re-read here, inside the act, so two last opt-ins at once record one reveal. */
      const parties = this.#parties(row);
      const now = this.#optins(row.candidate);
      let revealed = !!now.revealed;
      if (!now.revealed && !parties.truncated && parties.all.length > 0 && parties.all.every((p) => now.opted.includes(p))) {
        put("revealed", { parties: parties.all });
        revealed = true;
      }
      return { ok: true, candidate: row.candidate, project: g.project, wrote: true,
               revealed: revealed && this.#optins(row.candidate).opted.includes(g.project),
               ...(parties.truncated ? { reveal_undetermined: true } : {}),
               says: revealed
                 ? word("contradiction.says.project_asked_resolve")
                 : word("contradiction.says.project_asked_resolve_projects") };
    });
  }

  /** R53's disclosure refusals, in order: malformed, then someone else's. Answers the refusal, or null. */
  #disclosureRefusal(disclose, member, who) {
    if (disclose === undefined || disclose === null) return null;
    /* DEC-49 REGION is-disclosure-malformed */
    const part = Contradiction.#malformedPart(disclose);
    if (part) return Contradiction.#refuse("DISCLOSURE_MALFORMED",
      localize("contradiction.index.disclosure_malformed_detail", "the part of the disclosure that is not one of cover or email: {part}", { part }), { part });
    /* END DEC-49 REGION is-disclosure-malformed */
    const own = this.#ownCover(member);
    const e = typeof disclose.email === "string" ? disclose.email.trim() : null;
    const taken = e ? this.#one(`SELECT 1 AS x FROM contradiction_responses WHERE lower(email) = lower(?) AND author <> ?`,
                                e, who) : null;
    /* DEC-49 REGION is-disclosure-not-yours */
    if ((typeof disclose.cover === "string" && disclose.cover !== own) || taken)
      return Contradiction.#refuse("DISCLOSURE_NOT_YOURS",
        localize("contradiction.index.disclosure_not_yours_detail", "a response may share only your own cover or your own email address"),
        { part: taken ? "email" : "cover" });
    /* END DEC-49 REGION is-disclosure-not-yours */
    return null;
  }

  /** The part of a disclosure that is not a cover or one email address, or null when it is well formed. */
  static #malformedPart(disclose) {
    if (typeof disclose !== "object" || Array.isArray(disclose)) return word("contradiction.text.disclosure_itself");
    const extra = Object.keys(disclose).find((k) => k !== "cover" && k !== "email");
    if (extra) return extra;
    const cover = disclose.cover, email = disclose.email;
    if (cover !== undefined && cover !== true && typeof cover !== "string") return "cover";
    if (email !== undefined && (typeof email !== "string" || email.length > EMAIL_MAX
        || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email.trim()))) return "email";
    return null;
  }

  /** The author's own cover, as membership holds it (its R68), or null. */
  #ownCover(member) {
    const m = this.#m();
    const facts = m && typeof m.memberFacts === "function" ? m.memberFacts(member) : null;
    return facts && typeof facts.cover === "string" ? facts.cover : null;
  }

  /** What a well-formed disclosure shares: the author's own cover (filled from membership for `cover: true`, never
   *  taken otherwise) and the email as stated. */
  #disclosed(disclose, member) {
    if (!disclose || typeof disclose !== "object") return { cover: null, email: null };
    const cover = disclose.cover === true ? this.#ownCover(member) : typeof disclose.cover === "string" ? disclose.cover : null;
    return { cover, email: typeof disclose.email === "string" ? disclose.email.trim() : null };
  }

  /** op=contradictionrespond — R53: a member responds to the notice, sharing only what they choose. */
  respond({ candidate = null, project = null, text = null, disclose = undefined, viewer = null, author = null, at = null } = {}) {
    const g = this.#partyRefusals({ candidate, project, viewer, author });
    if (g.refusal) return g.refusal;
    const { row } = g;
    /* DEC-49 REGION is-response-before-opt-in */
    if (!this.#optins(row.candidate).opted.includes(g.project))
      return Contradiction.#refuse("RESPONSE_BEFORE_OPT_IN",
        localize("contradiction.index.response_before_opt_in_detail", "this project has not asked to resolve it yet"), { project: g.project });
    /* END DEC-49 REGION is-response-before-opt-in */
    /* DEC-49 REGION is-response-no-text */
    if (typeof text !== "string" || !text.trim())
      return Contradiction.#refuse("RESPONSE_NO_TEXT",
        localize("contradiction.index.response_no_text_detail", "a response says something in the responder's own words"));
    /* END DEC-49 REGION is-response-no-text */
    const over = this.#overCap({ text });
    if (over) return over;
    const bad = this.#disclosureRefusal(disclose, g.member, author.trim());
    if (bad) return bad;
    const d = this.#disclosed(disclose, g.member);
    const who = author.trim();
    const when = at || this.#now();
    return this.#record.transact(() => {
      const seq = (this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM contradiction_responses`)?.n ?? 0) + 1;
      const id = sha256HexSync(canonicalJson({ v: 1, candidate: row.candidate, project: g.project, seq, at: when }));
      this.#sql.exec(`INSERT INTO contradiction_responses (response, candidate, project_id, author, at, seq, text, cover,
          email, a_bundle_id, b_bundle_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        id, row.candidate, g.project, who, when, seq, text.trim(), d.cover, d.email, row.a_bundle_id, row.b_bundle_id);
      return { ok: true, candidate: row.candidate, project: g.project, response: id, at: when,
               shared: { cover: d.cover !== null, email: d.email !== null },
               ...(d.email ? { email_says: word("contradiction.email_says.stated_verified") } : {}),
               says: word("contradiction.says.response_held_reaches") };
    });
  }

  /** op=contradictionresponses — R54's read: this project's own responses, attributed, and once revealed the other
   *  parties' as relayed, in the order written. */
  conflictResponses({ candidate = null, project = null, after = null, limit = null, viewer = null } = {}) {
    try {
      const g = this.#projectRefusals(project, viewer);
      if (g.refusal) return g.refusal;
      const none = Contradiction.#noCandidate(candidate);
      if (none) return none;
      const row = this.#candidate(candidate);
      if (!row || (!this.#sideSeen(row.a, viewer) && !this.#sideSeen(row.b, viewer)) || !this.#seenPartySide(row, g.project, viewer))
        return Contradiction.#noSuch(localize("contradiction.index.no_such_project_detail", "no contradiction you can see answers to that id for this project"));
      const n = Number(limit);
      const cap = limit === null || limit === undefined || limit === "" || !Number.isFinite(n) || n < 1
        ? PAGE_MAX : Math.min(Math.floor(n), PAGE_MAX);
      const { revealed, opted } = this.#optins(row.candidate);
      const isRevealed = !!revealed && opted.includes(g.project);
      const others = isRevealed ? opted.filter((p) => p !== g.project) : [];
      const afterSeq = typeof after === "string" && after
        ? this.#one(`SELECT seq FROM contradiction_responses WHERE response=?`, after)?.seq ?? Infinity : 0;
      const rows = this.#rows(`SELECT * FROM contradiction_responses WHERE candidate=? AND seq > ?
                                  AND (project_id = ? OR project_id IN (SELECT value FROM json_each(?)))
                                ORDER BY seq LIMIT ?`, row.candidate, afterSeq, g.project, JSON.stringify(others), cap + 1);
      const items = rows.slice(0, cap).map((r) => (r.project_id === g.project
        ? { response: r.response, own: true, author: r.author, text: r.text, cover: r.cover, email: r.email,
            ...(r.email ? { email_says: word("contradiction.email_says.stated_verified") } : {}), project: g.project, at: r.at }
        : { own: false, ...this.#relay(r) }));
      return { ok: true, wrote: false, candidate: row.candidate, project: g.project, revealed: isRevealed, limit: cap,
               truncated: rows.length > cap, cursor: items.length ? (items[items.length - 1].response) : null,
               responses: items };
    } catch (e) {
      return { ok: true, wrote: false, responses: [], truncated: false, undetermined: true,
               why: String(e && e.message || e).slice(0, 160) };
    }
  }

}

/* The Durable Object routes this module answers, as entries of the plane's one route map (`plane/store.mjs` spreads
   them in, K3; the legacy store's op map did until the plane took it). `url` carries the control plane's stamps (`viewer`, `author`, `proposedBy`, `principal`), never the
   caller's; `body` the parsed body, from which each op reads only its own named fields (a stamp in the body is never
   read). `key` and `limit` are the caller's, and both are answered rather than trusted (R5, R6). The control plane
   routes the thirteen N345 ops at layer 11 (control-plane's entry). */
export function contradictionOps(c, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  const v = (k) => (b[k] !== undefined ? b[k] : q(k));
  const stamps = () => ({ viewer: q("viewer"), author: q("author") });
  return {
    contradictionpropose: () => c.propose({ run: b.run, proposals: b.proposals, at: b.at || null,
                                            proposedBy: q("proposedBy"), viewer: q("viewer"), caller: q("principal") }),
    contradictionpairs: () => c.pairs({ key: q("key"), limit: q("limit"), viewer: q("viewer") }),
    contradictioncandidates: () => c.candidatesFor({ on: b.on && typeof b.on === "object" ? b.on
        : Object.fromEntries(["inquiry", "content", "entity", "bundle", "project", "candidate"].filter((k) => q(k)).map((k) => [k, q(k)])),
      label: v("label"), weight: v("weight"), state: v("state"), after: v("after"), limit: v("limit"), viewer: q("viewer") }),
    contradictiontensions: () => c.tensionsOn({ referents: b.referents, viewer: q("viewer") }),
    contradictionfacts: () => c.contextFacts({ candidate: v("candidate"), viewer: q("viewer") }),
    contradictiondismiss: () => c.dismiss({ candidate: v("candidate"), reason: v("reason"), words: v("words"), ...stamps() }),
    contradictionclarify: () => c.clarify({ candidate: v("candidate"), choice: v("choice"), coordinates: b.coordinates,
      explanation: v("explanation"), evidence: b.evidence, qualifiers: b.qualifiers, wrongSide: v("wrongSide"),
      reason: v("reason"), accepted: b.accepted, ...stamps() }),
    contradictiontakeup: () => c.takeUp({ candidate: v("candidate"), question: v("question"), frame: v("frame"), ...stamps() }),
    contradictionflag: () => c.flag({ here: b.here, other: b.other, reason: v("reason"), ...stamps() }),
    contradictionresolve: () => c.resolve({ inquiry: v("inquiry"), resolution: b.resolution, conclusion: v("conclusion"),
      version: v("version"), falsifier: v("falsifier"), noFalsifier: v("noFalsifier"), accepted: b.accepted, ...stamps() }),
    contradictionrecommend: () => c.recommend({ run: b.run, candidate: b.candidate, coordinates: b.coordinates, at: b.at || null,
                                                proposedBy: q("proposedBy"), viewer: q("viewer"), caller: q("principal") }),
    contradictionnotices: () => c.conflictNotices({ project: v("project"), after: v("after"), limit: v("limit"), viewer: q("viewer") }),
    contradictionoptin: () => c.optIn({ candidate: v("candidate"), project: v("project"), words: v("words"), ...stamps() }),
    contradictionrespond: () => c.respond({ candidate: v("candidate"), project: v("project"), text: v("text"),
                                            disclose: b.disclose, ...stamps() }),
    contradictionresponses: () => c.conflictResponses({ candidate: v("candidate"), project: v("project"), after: v("after"),
                                                        limit: v("limit"), viewer: q("viewer") }),
  };
}

/* R60 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  contradictionresolve: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.contradictionresolve.label.contradiction",
    fields: { accepts: ["inquiry","resolution","conclusion","version","falsifier","noFalsifier","accepted"], requires: ["inquiry","resolution","conclusion"] } },
  contradictiondismiss: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("contradiction.declared.contradictiondismiss", "candidate-directed: keyed by a candidate, reached where its sides are shown; sets a lead aside for one of three stated reasons, kept, never deleted"),
    fields: { accepts: ["candidate","reason","words"], requires: ["candidate","reason"] } },
  contradictionclarify: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("contradiction.declared.contradictionclarify", "candidate-directed: keyed by a candidate, reached where its sides are shown; records how the sides differ, or which is wrong and why, and never edits a side"),
    fields: { accepts: ["candidate","choice","coordinates","explanation","evidence","qualifiers","wrongSide","reason","accepted"], requires: ["candidate","choice"] } },
  contradictiontakeup: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("contradiction.declared.contradictiontakeup", "candidate-directed: keyed by a candidate, reached where its sides are shown; opens one contradiction inquiry framed around one side"),
    fields: { accepts: ["candidate","question","frame"], requires: ["candidate","question","frame"] } },
  contradictionflag: { classes: ["admin","member","probe"], machineClasses: [], mutating: true, stamps: ["author","viewer"], needs: "contribute", weight: "reasoned", description: localize("contradiction.declared.contradictionflag", "document-directed: keyed by a passage in each of two documents the member may see, reached from either document; sets them side by side as a contradiction for the project to settle, with the member's reason, and changes neither document"),
    fields: { accepts: ["here","other","reason"], requires: ["here","other","reason"] } },
  contradictionoptin: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("contradiction.declared.contradictionoptin", "conflict-directed: keyed by a candidate and the member's project, reached from the conflict's notice; the project asks to resolve a conflict with a record its members cannot see, never withdrawn"),
    fields: { accepts: ["candidate","project","words"], requires: ["candidate","project"] } },
  contradictionrespond: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("contradiction.declared.contradictionrespond", "conflict-directed: keyed by a candidate and the member's project, reached from the conflict's notice; a response disclosing only what its author chooses, relayed once the projects are named to each other"),
    fields: { accepts: ["candidate","project","text","disclose"], requires: ["candidate","project","text"] } },
});
