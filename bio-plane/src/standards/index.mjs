/* standards — what a government act is measured against (requirements: `build/requirements/standards.md`; Functional
 * Architecture, Layer 2 Function 1). A standard is a statute, regulation, ordinance, court decision or order, adopted
 * policy or public commitment, held as content in the record: its citation, kind and issuer, its own words as captured
 * (content ids), where it comes from (a jurisdiction profile's `standard_sources`, or undetermined) and the period it
 * was in force. It answers which standards were in force at a date. It judges nothing about a government act
 * (`conformance` does) and nothing about a standard's merit (R12).
 *
 * A new module (K102, K171): nothing moves (its map, §1). A standard is a record document of type `standard` (R15),
 * `STD-<year>-NNNN-<kind>`, promoted through `promotion` outside any project (K171 (12)); `record-grammar` knows the
 * type (one state, `recorded`, no edges: N129). It is never edited: a correction is a new standard that supersedes
 * it, at most once (R4, R6). It is recorded with the declarer's reason, the member's own words on why the group
 * holds its government to it (R1, R10; DEC-88), never the proposer's `why`. Its registered check refuses every other
 * write of a standard (R11). The reads answer from this module's own tables (`./schema.mjs`), written once per act
 * and never updated (R14). A proposal (the Legal/Policy Lookup skill's work, or a member's suggestion) is stored apart
 * and labelled by `record-grammar`'s `proposalLabel(proposer, "standard")` (R9); a member's adoption records a
 * standard naming it (R10).
 *
 * No place is named here (R13): where a citation comes from is read from the active profiles' combined view
 * (`jurisdictions.combine` over record-core's `jurisdiction_profiles`), and a fact they do not supply is undetermined.
 *
 * REACHED as `standardsOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps` and returned to every later caller. At creation it creates its tables (R16), registers its check
 * with `promotion` (R39) and its tables with purge (R14). `deps`:
 *   record, membership, promotion, content   the modules it uses, through their factories on the same host unless a
 *                test passes its own (`content` is reached lazily, on first use).
 *   combine      `jurisdictions.combine` (default); a test passes its own, which resolves profiles it wrote by id.
 *   now          the module's clock, an ISO instant (default: the wall clock).
 *   events       `events`' instance, or a function answering it (R19, R20, R28: an event's `when`, through its
 *                `readEvent({eventId, viewer})`, events R26); `eventsOf(host)` by default (K1563 (1), K1574). Without
 *                one, an event bound or node answers undetermined, saying so, never a default.
 *   keyedStore   the store `acquisition.citationLookup` reads the group's key through (R25: `{credentials, env,
 *                governor}`), or a function answering it; absent, the keyed lookup answers that it is off.
 *   citationLookup, recognise   test seams: `acquisition.citationLookup` and `id-spaces.recogniseCitations` by default.
 *
 * T33 (T33-31; K1438, K1442, K1446, K1447, K1449): the module moved to layer 5. A declaration may name where the
 * standard sits in its law (R18, R19): its instrument key (composed only from profile data, `./instrument.mjs`), a
 * portion, the passages it requires, its copy, how current the copy is and what its period rests on. In force at a date
 * is R20's `inForceAt`, through `civil-time.validAt` over each version's period, bounded by adopted temporal relations
 * and by a codifier copy's lag; `inForce` stays its alias (Choices 18). Law relations, court links and treatment rows,
 * the citation resolver and the owner's read are `law-relations`' (K1961), constructed over this instance's reads and
 * delegated to (R48); the owner's registration at load stays here.
 *
 * T35 (T35-31): how much of a standard is held (text, cited, absent), its family, force per provision, the copy and what
 * it says of itself, sight from its source and its release, versions from captures, overrides, the source of force,
 * designation, edition and issuer, adoptions and the edition in force, access, targets, binding or benchmark, the
 * members' words (`./words.mjs`), a found extent and the question beside a declaration (R33–R47).
 *
 * T36 (T36-15): a version read from captures reads only their own receipts (R38, `provenance.receiptsOfCapture`); who
 * recorded what from a passage, in `events` R49's shape (R49, `recordedBy`); and a version known in force through a date
 * by a member's record from a source checked that day (R50), which R20 reads where no end is stated (R51).
 *
 * T45 (T45-7; Actions D7; v0.2 §3 Standard): a spoken commitment is a standard only once confirmed in writing or stated
 * publicly. A `commitment` resting only on members' "as heard" accounts (`provenance` R28's authored observations, read
 * through its R48 contract) is refused (R52), and so is one resting only on the group's own sending, which a later
 * module (`actions`) tells this one through the check it registers at start (R53, `registerOwnSendingCheck`).
 *
 * T46 (T46-10; DEC-194, N913): the two refusals' translations are `words.json`'s `refusal.<CODE>`, read by key
 * (R55, `./checks.mjs` `REFUSAL_WORDS`); no code, number, `where` or behaviour moved.
 *
 * T48 (T48-21; N1029, K3145): a proposal may name the project it is made for, one its proposer sees whole (R56), and
 * `proposalsFor` lists a project's proposals and what became of them, by the project's sight (R57). */

import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { normalizeType } from "../record-grammar/types.mjs";
import { proposalLabel } from "../record-grammar/labels.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { Membership, membershipOf, viewerPredicate, listenerRefusal, noSuchProject } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { contentOf, contentIdFor, canonicalExtent, describeExtent, extentRelation,
         CONTENT_EXTENT_KINDS } from "../content/index.mjs";
import { noSha } from "../extraction/index.mjs";
import { combine as combineProfiles, governingZone, STANDARD_SOURCE_KINDS } from "../../../jurisdictions/index.mjs";
import { entitiesOf, noSuchEntity } from "../entities/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { parseFigure } from "../calc-grammar/index.mjs";
import { validAt, localDay, isCalendarDate } from "../civil-time/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { registerOwner, isRecordId } from "../connection-grammar/index.mjs";
import { citationLookup as acquisitionCitationLookup } from "../acquisition/index.mjs";
import { recogniseCitations, recogniseSeries } from "../idspaces.mjs";
import { STANDARDS_CHECKS, refusal } from "./checks.mjs";
import { STANDARDS_TABLES, migrateStandards } from "./schema.mjs";
import { instrumentKey, matchSource, referenceKey, sourceCopy, foldCite, isPortionPath } from "./instrument.mjs";
import { COPY_STATES, HELD_STATES, ACCESS_STATES, FORCES, POLICY_FORCES, ownerWords, forceWords, bindingWords, heldWords,
         accessWords, notPublicWords, copyWords, captureWords, textWithheldWords, noteWords, inForceKnownWords } from "./words.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { LawRecords, LAW_RELATIONS, COURT_LINKS, TREATMENTS, CONNECTION_KINDS, CONNECTION_OWNER, IN_FORCE_METHOD,
         weakestCeiling, machineRelate, refuseNoCitation } from "../law-relations/index.mjs";

export { STANDARDS_CHECKS, REFUSAL_WORDS } from "./checks.mjs";
export { STANDARDS_SCHEMA, STANDARDS_TABLES } from "./schema.mjs";
export { instrumentKey, referenceKey, isPortionPath, PORTION_PATH_MAX } from "./instrument.mjs";
export { LAW_RELATIONS, COURT_LINKS, TREATMENTS, CONNECTION_KINDS, CONNECTION_OWNER, IN_FORCE_METHOD };
export { FORCES, POLICY_FORCES, COPY_STATES, HELD_STATES, ACCESS_STATES } from "./words.mjs";

export const STANDARD = "standard";
/** R1, R12: the seven kinds, `jurisdictions`' own list (its R23's `STANDARD_SOURCE_KINDS`, K1902 (1)), never a copy:
 *  the whole vocabulary of a standard. */
export const STANDARD_KINDS = STANDARD_SOURCE_KINDS;
/** R7, R20: the four answers of `inForceAt` and its alias `inForce`, `overridden` (R38) included (K1973). */
export const IN_FORCE_STATES = Object.freeze(["in_force", "not_in_force", "undetermined", "overridden"]);
/** R1: a citation's bound; R9: a proposal's `why`; R8: a page; R2: the passages one standard's text names; the bound on
 *  a proposal's named act; R1: the declarer's reason, in characters (DEC-88). */
export const CITE_MAX = 200, WHY_MAX = 240, PAGE_MAX = 200, TEXTS_MAX = 50, ACT_MAX = 200, REASON_MAX = 2000;
/** R12: the fields each act takes. Anything else is refused by name, never ignored: a field silently dropped is a view
 *  the caller believes was recorded. */
const DECLARE_KEYS = Object.freeze(["cite", "kind", "issuer", "reason", "text", "period", "supersedes", "instrument",
                                    "portion", "requires", "copy", "current_through", "period_basis", "held", "cited_by",
                                    "search", "family", "copy_claimed", "version_basis", "overrides", "force_source",
                                    "designation", "edition", "access", "target", "question", "author", "viewer"]);
/** R39: a designation's and an edition's bounds, in characters; R34: a searched place's. */
export const DESIGNATION_MAX = 200, EDITION_MAX = 50, PLACE_MAX = 500, PLACES_MAX = 50;
/** R38: where a standard's force comes from. R40: how a body adopts an edition. R42: a target's comparators. */
export const FORCE_SOURCES = Object.freeze(["delegation", "resolution", "oversight_approval", "court_order", "contract"]);
export const ADOPTION_MODES = Object.freeze(["by_reference", "voluntary", "by_accreditation"]);
export const COMPARATORS = Object.freeze(["at_least", "at_most", "within"]);
/** R43: the kinds that are a benchmark when nothing binds them; the laws, undetermined instead. */
const BENCHMARK_KINDS = Object.freeze(["policy", "standard", "commitment"]);
/** R21: the reverse index's page, clamped. */
export const FOR_LIMIT_MAX = 500, FOR_LIMIT_DEFAULT = 100;
/* R20: the viewer an internal read (no viewer named) asks `events` as: the machine's stamp (DEC-52). */
const INTERNAL_READER = "class:daemon";
/* R21: the most reference rows one reverse read scans; past it the answer says it is truncated. */
const SCAN_FOR = 5000;
const PROPOSE_KEYS = Object.freeze(["cite", "kind", "issuer", "text", "why", "act", "project", "proposer", "viewer"]);
/** R57: the states `proposalsFor` lists, and its page: default 50, clamped 1 to 200 (R8's cap). */
export const PROPOSAL_STATES = Object.freeze(["open", "adopted", "all"]);
export const PROPOSALS_LIMIT_DEFAULT = 50;
/* R9, R57: the sentence every proposal is answered with. */
const PROPOSAL_SAYS = word("standards.proposal_standard_record");
/* R35, R40: the fields of the T35 acts. */
const FORCE_KEYS = Object.freeze(["standard", "portion", "force", "holder", "criteria", "citation", "reason", "author", "viewer"]);
const FORCE_PROPOSE_KEYS = Object.freeze(["standard", "portion", "force", "holder", "criteria", "citation", "why", "proposer",
                                          "viewer"]);
const ADOPTION_KEYS = Object.freeze(["standard", "act", "edition", "from", "amendments", "mode", "citation", "reason",
                                     "author", "viewer"]);
/* R37: the project a bundle is filed in (a project's own bundle is its project), as membership reads it. */
const PROJECT_OF = "CASE WHEN b.object_type='project' THEN b.bundle_id ELSE b.project END";
/* R41: a member viewer, `member:<id>`, never a machine credential. */
const isMemberViewer = (v) => typeof v === "string" && /^member:./.test(v) && !isMachineIdentity(v);
const ADOPT_KEYS = Object.freeze([...DECLARE_KEYS, "proposal"]);
/* R50: the fields of `inForceThroughRecord`. */
const THROUGH_KEYS = Object.freeze(["standard", "through", "source", "reason", "author", "viewer"]);

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
/* A token the front matter holds bare; any other string is quoted, with no quote, backslash or line break. */
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,199}$/;
const q = (s) => `"${String(s).replace(/["\\\r\n]/g, " ")}"`;
const bare = (s) => (TOKEN.test(String(s)) ? String(s) : q(s));
/* A member's words kept whole in a body section: a line that would open a heading is set in by one space. */
const bodyText = (s) => String(s).trim().replace(/^#/gm, " #");

/* R1 (DEC-88): what is wrong with a declarer's reason, or null when it is one: a string with something other than white
   space in it, at most `REASON_MAX` characters. */
const reasonFault = (reason) =>
  reason === undefined || reason === null ? word("law-relations.carries_reason")
  : typeof reason !== "string" ? `carries a reason that is not text (${Array.isArray(reason) ? "a list" : typeof reason})`
  : !reason.trim() ? "carries a reason with nothing in it"
  : [...reason].length > REASON_MAX ? `carries a reason of ${[...reason].length} characters, over the ${REASON_MAX} kept`
  : null;

/** R1, R7: a calendar date, `YYYY-MM-DD`, that exists. */
export function isDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** R7: a stated period against a date, with why, as R20 answers it with no event bound, relation or copy to read: the
 *  state is `civil-time.validAt`'s (`in`, `out`, undetermined). `not_in_force` only when a stated bound excludes the
 *  date; `undetermined` when a bound needed to decide is null; never a default. Bounds are inclusive. */
export function periodInForce(period, date) {
  const from = period ? period.from ?? null : null, to = period ? period.to ?? null : null;
  if (from !== null && date < from)
    return { state: "not_in_force", why: word("standards.why.period_force_starts", { from: String(from), date: String(date) }) };
  if (to !== null && date > to)
    return { state: "not_in_force", why: word("standards.why.period_force_ended", { to: String(to), date: String(date) }) };
  if (from !== null && to !== null)
    return { state: "in_force", why: word("standards.why.lies_within_period", { date: String(date), from: String(from), to: String(to) }) };
  const missing = [from === null ? word("standards.came_force") : null, to === null ? word("standards.ceased_force") : null]
    .filter(Boolean).join(" or ");
  return { state: "undetermined",
           why: word("standards.why.record_state_whether", { missing: String(missing), date: String(date) }) };
}

export class Standards {
  #writing = null;   // the standard this module is promoting, for its own check (R11)
  #law;              // R48: `law-relations`' LawRecords, over this instance's internal reads
  #ownSending = null;   // R53: {module, fn}, the one check a later module registers at start

  constructor({ storage, record, membership, promotion, content = null, combine = combineProfiles, now = null,
                events = null, keyedStore = null, citationLookup = acquisitionCitationLookup,
                recognise = recogniseCitations, entities = null, capture = null, provenance = null } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.contentRef = content;
    this.combine = combine;
    this.eventsRef = events;
    this.keyedStoreRef = keyedStore;
    this.lookupFn = citationLookup;
    this.recognise = recognise;
    this.entitiesRef = entities;
    this.captureRef = capture;
    this.provenanceRef = provenance;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    migrateStandards(this.sql);   // R16: the tables exist once the instance does, so no caller migrates (N220, N267)
    this.#law = new LawRecords(this.#internal());
  }

  #rows(qs, ...a) { return [...this.sql.exec(qs, ...a)]; }
  #one(qs, ...a) { const r = this.#rows(qs, ...a); return r.length ? r[0] : null; }
  get content() { return typeof this.contentRef === "function" ? this.contentRef() : this.contentRef; }
  get events() { return typeof this.eventsRef === "function" ? this.eventsRef() : this.eventsRef; }
  get entities() { return typeof this.entitiesRef === "function" ? this.entitiesRef() : this.entitiesRef; }
  get capture() { return typeof this.captureRef === "function" ? this.captureRef() : this.captureRef; }
  /* R38: the receipts of where and when a capture was retrieved; `content`'s own provenance unless one is passed */
  get provenance() {
    const p = typeof this.provenanceRef === "function" ? this.provenanceRef() : this.provenanceRef;
    return p || (this.content ? this.content.provenance : null);
  }
  #when() { return stampInstant("second", Date.parse(this.now())); }

  /* R48 (law-relations R13): the reads `law-relations` works through: this instance's tables and the modules it uses,
     never a copy of them. */
  #internal() {
    return {
      sql: this.sql, record: this.record, membership: this.membership,
      rows: (q, ...a) => this.#rows(q, ...a), one: (q, ...a) => this.#one(q, ...a),
      row: (id) => this.#row(id), texts: (id) => this.#texts(id), readable: (id, v) => this.#readable(id, v),
      content: () => this.content, when: () => this.#when(), nonce: () => rand(8),
      noSuchStandard, portionUnknown: (end, standard, portion) => portionUnknown(standard, portion, { end }), refuseNoId, refuseDateInvalid, refuseFieldUnknown, refuseReason: refuseLawReason,
      refuseNoSuchProposal, refuseProposalAdopted, refuseProposerUnnamed, refuseWhyInvalid,
      inForceAt: (a) => this.inForceAt(a), periodOf: (row) => this.#periodOf(row, null),
      eventDay: (event, edge, viewer) => this.#eventDay(event, edge, viewer),
      eventWhen: (event, viewer) => { const d = this.#eventDay(event, "start", viewer); return d.day ? d : null; },
      gradeOf: (ids) => weakestCeiling(ids.length ? this.content.standings(ids) : {}, ids), zone: () => this.#zone(),
      /* law-relations R13: the standards at an instrument key, of a kind, and whose stated period does not exclude a day */
      idsAtKey: (key, portion) => this.#rows(`SELECT standard_id FROM standards WHERE instrument=?
                                              ${portion !== null && portion !== undefined ? "AND portion_path=?" : ""} ORDER BY standard_id`,
                                             ...(portion !== null && portion !== undefined ? [key, portion] : [key])).map((r) => r.standard_id),
      idsOfKind: (kind, limit) => this.#rows(`SELECT standard_id FROM standards WHERE kind=? ORDER BY standard_id LIMIT ?`,
                                             kind, limit).map((r) => r.standard_id),
      idsCovering: (day) => this.#rows(`SELECT standard_id FROM standards WHERE NOT ((period_from IS NOT NULL AND period_from > ?)
                                          OR (period_to IS NOT NULL AND period_to < ?)) ORDER BY standard_id`, day, day)
        .map((r) => r.standard_id),
      recognise: (t) => this.recognise(t),
      citationLookup: ({ text, viewer }) => this.lookupFn(
        (typeof this.keyedStoreRef === "function" ? this.keyedStoreRef() : this.keyedStoreRef) || {}, { text, viewer }),
    };
  }

  #texts(id) {
    return this.#rows(`SELECT content_id FROM standard_texts WHERE standard_id=? ORDER BY ord`, id).map((t) => t.content_id);
  }

  /* The zone a day is compared in: the view's `time_zone`. Two calendar days compared in one zone compare alike in
     every zone, so with none stated the days are compared in UTC and nothing depends on it. */
  #zone() {
    const { view } = this.#view();
    let g = null; /* K5292 (jurisdictions R98): the team's governing zone first */
    try { g = governingZone(this.record.getSetting("jurisdiction_profiles"), this.record.getSetting("team_time_zone")); } catch { g = null; }
    return g || (view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : "UTC");
  }

  /** The module's tables (R14), created at construction (R16); kept, idempotent, for a caller that still calls it. */
  migrate() { migrateStandards(this.sql); }

  /* ===================================================================== *
   * R3: WHERE A CITATION COMES FROM
   * ===================================================================== */

  /* The active profiles' combined view (record-core R26, jurisdictions R12–R16), or why there is none. */
  #view() {
    const ids = this.record.getSetting("jurisdiction_profiles");
    if (!Array.isArray(ids) || !ids.length)
      return { view: null, why: word("standards.why.group_civicsmith_active") };
    const c = this.combine(ids);
    if (!c || !c.ok)
      return { view: null, why: word("standards.why.active_jurisdiction_profiles", { set: String([...new Set(((c && c.errors) || []).map((e) => e.code))].join(", ") || "unreadable") }) };
    return { view: c.view, why: null };
  }

  /** R3: the citation against every `standard_sources` entry of the active profiles, in order. The first match gives
   *  the source; entries of different profiles that match and disagree are a fact the profiles withhold between them
   *  (jurisdictions R15: nothing chooses between profiles that disagree), so the answer is undetermined. A declared
   *  kind or issuer that differs from the match's is stated beside it, never corrected. Never throws. */
  sourceOf(cite, declared = {}) {
    const undetermined = (why, extra) => ({ state: "undetermined", why, ...(extra || {}) });
    const { view, why } = this.#view();
    if (!view) return undetermined(why);
    const entries = Array.isArray(view.standard_sources) ? view.standard_sources : [];
    if (!entries.length) return undetermined(word("standards.active_jurisdiction_profiles"));
    const text = String(cite ?? "");
    const matches = entries.filter((e) => {
      try { return !!e.cite && new RegExp(e.cite.re, e.cite.flags || "").test(text); } catch { return false; }
    });
    if (!matches.length)
      return undetermined(localize("standards.index.no_source_matches_citation", "the citation matches the citation form of no source the active jurisdiction profiles list; the standard is held all the same, and where it comes from is undetermined"));
    const first = matches[0];
    const key = (e) => JSON.stringify([e.source, e.kind, e.issuer, e.level ?? null]);
    const disagree = matches.filter((m) => m.profile !== first.profile && key(m) !== key(first));
    if (disagree.length)
      return undetermined(localize("standards.index.sources_disagree_none_chosen", "the citation matches sources of different active jurisdiction profiles that disagree about it, and none is chosen between them, so where it comes from is undetermined"),
                          { disagreeing: [first, ...disagree].map((e) => ({ profile: e.profile, source: e.source,
                            kind: e.kind, issuer: e.issuer, level: e.level ?? null, basis: e.basis })) });
    const level = typeof first.level === "string" && first.level ? first.level : "undetermined";
    const differs = [];
    for (const f of ["kind", "issuer"])
      if (str(declared[f]) && str(declared[f]) !== first[f])
        differs.push({ field: f, declared: str(declared[f]), source: first[f],
                       says: word("standards.says.recorded_declared_matched", { finding: String(f), first: String(first[f]) }) });
    return { state: "matched", source: first.source, kind: first.kind, issuer: first.issuer, level,
             ...(level === "undetermined" ? { level_why: word("standards.matched_source_states") } : {}),
             profile: first.profile, basis: first.basis, ...(differs.length ? { differs } : {}) };
  }

  /* ===================================================================== *
   * THE REGISTERED CHECK (promotion R39): R11, R4 at the write
   * ===================================================================== */

  /** R11: a standard is written only by this module's R1 and R10, as a creation; every other promotion of one (a raw
   *  promotion, a revision) is refused. A replay (a restore of the record's own history) is admitted. */
  check(c) {
    const headType = c.head ? normalizeType(c.head.type) : null;
    if (c.promotedType !== STANDARD && headType !== STANDARD) return null;
    return this.#checkStandard(c);
  }

  #checkStandard(c) {
    if (c.replay || (c.creation && this.#writing !== null && c.bundleId === this.#writing)) return null;
    /* DEC-49 REGION is-standard-written-here */
    return refusal("STANDARD_WRITTEN_ELSEWHERE", c.head
      ? "a standard is never edited: a correction is a new standard that supersedes it. Nothing was written."
      : "a standard is recorded by a member's act, never by a raw promotion. Nothing was written.",
      { bundleId: c.bundleId ?? null });
    /* END DEC-49 REGION is-standard-written-here */
  }

  /* ===================================================================== *
   * DECLARING (R1–R4, R6)
   * ===================================================================== */

  /** R1–R4, R6: record a standard. */
  standardDeclare(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, DECLARE_KEYS);
    if (unknown) return unknown;
    /* R60: a found extent content holds no row for is minted while the declaration is checked, so the whole act is one
       transaction: a refusal anywhere takes the minted rows back with it (record-core R32), and nothing is minted. */
    return this.record.transact(() => {
      const d = this.#declareRefusal(a);
      if (d.ok === false) return d;
      return this.#write(d.fields, str(a.author), a.viewer ?? null, null);
    });
  }

  /* R1's refusals after the author, in R1's order, then R6's; `{ok: true, fields}`, checked, when none applies. */
  #declareRefusal(a) {
    const cite = str(a.cite);
    if (!cite || cite.length > CITE_MAX) return refuseNoCite(cite.length);
    if (!STANDARD_KINDS.includes(a.kind)) return refuseKindUnknown(a.kind);
    const issuer = str(a.issuer);
    /* DEC-49 REGION is-standard-issuer */
    if (!issuer)
      return refusal("STANDARD_NO_ISSUER", "a standard names the body that made it. Nothing was written.");
    /* END DEC-49 REGION is-standard-issuer */
    const fault = reasonFault(a.reason);
    /* DEC-49 REGION is-standard-reason */
    if (fault)
      return refusal("STANDARD_NO_REASON", `this declaration ${fault}. The reason is the declarer's own words on why the `
                     + "team holds its government to this standard, kept with it and read back with it. Nothing was "
                     + "written.", { max_chars: REASON_MAX });
    /* END DEC-49 REGION is-standard-reason */
    const heldAs = this.#heldFields(a);
    if (heldAs.ok === false) return heldAs;
    const texts = heldAs.texts;
    const period = periodOf(a.period);
    /* DEC-49 REGION is-standard-period */
    if (!period)
      return refusal("STANDARD_PERIOD_INVALID", "a period is {from, to}, each a YYYY-MM-DD date or null, and `to` is "
                     + "not before `from`. Nothing was written.");
    /* END DEC-49 REGION is-standard-period */
    const supersedes = a.supersedes == null || a.supersedes === "" ? null : String(a.supersedes);
    if (supersedes !== null) {
      /* DEC-49 REGION is-superseded-held */
      if (!this.#row(supersedes))
        return refusal("STANDARD_SUPERSEDES_UNKNOWN", localize("standards.index.no_standard_answers_to_the", "no standard answers to the id this one is said to supersede. Nothing was written."), { supersedes });
      /* END DEC-49 REGION is-superseded-held */
      const later = this.#successorOf(supersedes);
      /* DEC-49 REGION is-supersession-once */
      if (later)
        return refusal("STANDARD_ALREADY_SUPERSEDED", `${supersedes} is already superseded by ${later}. Nothing was `
                       + "written.", { supersedes, superseded_by: later });
      /* END DEC-49 REGION is-supersession-once */
    }
    const viewer = a.viewer ?? null;
    const law = this.#lawFields(a, cite, texts, period, viewer);
    if (law.ok === false) return law;
    const t35 = this.#t35Fields(a, { cite, kind: a.kind, issuer, texts, period, supersedes, viewer, copy: law.fields.copy });
    if (t35.ok === false) return t35;
    /* R52, R53: after every refusal R1 lists, before anything is written */
    const heard = this.#commitmentRefusal(a.kind, heldAs.held, texts, heldAs.detail);
    if (heard) return heard;
    return { ok: true, fields: { cite, kind: a.kind, issuer, reason: a.reason, texts, period, supersedes, held: heldAs.held,
                                 held_detail: heldAs.detail, ...law.fields, ...t35.fields } };
  }

  /* R2, R34, R47: how much of the standard is held, and its text. `held: "text"` (the default) names one or more
     passages, each a content id or a found extent (R47); `cited` names who cited it and where, `absent` the searches
     made, and neither names text. `{ok: true, held, texts, detail}`, or a refusal. */
  #heldFields(a) {
    const viewer = a.viewer ?? null;
    const held = a.held == null || a.held === "" ? "text" : a.held;
    if (!HELD_STATES.includes(held))
      return refuseFieldInvalid("held", `is one of ${HELD_STATES.join(", ")}`);
    if (held === "text") {
      const texts = this.#textIdsResolved(a.text, str(a.author), viewer);
      if (texts && texts.unresolved) return refuseTextUnresolved(texts.unresolved);
      /* DEC-49 REGION is-standard-text */
      if (!texts || !texts.ids.length || texts.ids.length > TEXTS_MAX)
        return refusal("STANDARD_NO_TEXT", texts && texts.ids.length > TEXTS_MAX
          ? `a standard's text names at most ${TEXTS_MAX} passages. Nothing was written.`
          : "a standard is held with its own words as captured: name one or more content ids. Nothing was written.",
          { max: TEXTS_MAX });
      /* END DEC-49 REGION is-standard-text */
      const unresolved = this.#unresolvedText(texts.ids, viewer);
      if (unresolved) return refuseTextUnresolved(unresolved);
      return { ok: true, held, texts: texts.ids, detail: null };
    }
    const named = a.text != null && !(Array.isArray(a.text) && !a.text.length) && a.text !== "";
    /* DEC-49 REGION is-held-text */
    if (named)
      return refusal("STANDARD_TEXT_NOT_HELD_AS", localize("standards.index.a_standard_held_held_holds", "a standard held {held} holds none of its own words, so it names no text. Nothing was written.", { held: String(held) }), { held });
    /* END DEC-49 REGION is-held-text */
    if (held === "cited") {
      const c = a.cited_by;
      const ok = isObj(c) && Object.keys(c).every((k) => k === "captureSha" || k === "extent") && typeof c.captureSha === "string"
        && isObj(c.extent) ? this.#extentRow(c.captureSha, c.extent, viewer) : null;
      /* DEC-49 REGION is-cited-by-held */
      if (!ok)
        return refusal("STANDARD_CITED_BY_MISSING", localize("standards.index.cited_by_names_where_cited", "a standard held cited names where it is cited: cited_by {captureSha, extent}, a passage of a held capture you may see. Nothing was written."));
      /* END DEC-49 REGION is-cited-by-held */
      return { ok: true, held, texts: [], detail: { captureSha: c.captureSha.trim().toLowerCase(), extent: c.extent,
                                                    content_id: ok.content_id, bundle_id: ok.bundle_id } };
    }
    const sr = a.search;
    const placeOk = (p) => (typeof p === "string" && p.trim() && [...p].length <= PLACE_MAX)
      || (isObj(p) && Object.keys(p).every((k) => k === "captureSha" || k === "extent") && typeof p.captureSha === "string"
          && isObj(p.extent) && !!this.#extentRow(p.captureSha, p.extent, viewer));
    const searchOk = isObj(sr) && Object.keys(sr).every((k) => ["places", "request", "answer"].includes(k))
      && Array.isArray(sr.places) && sr.places.length > 0 && sr.places.length <= PLACES_MAX && sr.places.every(placeOk)
      && (sr.request == null || (typeof sr.request === "string" && sr.request.trim() && sr.request.length <= ACT_MAX))
      && (sr.answer == null || (isObj(sr.answer) && typeof sr.answer.captureSha === "string" && isObj(sr.answer.extent)
                                && !!this.#extentRow(sr.answer.captureSha, sr.answer.extent, viewer)));
    /* DEC-49 REGION is-search-stated */
    if (!searchOk)
      return refusal("STANDARD_SEARCH_MISSING", "a standard looked for and not found names the searches made: search "
                     + `{places, request?, answer?}, places a list of 1 to ${PLACES_MAX} portals, sites or offices (each at most `
                     + `${PLACE_MAX} characters) or held captures of the page searched, request a records request's reference, `
                     + "answer a held passage of its reply. Nothing was written.", { max_places: PLACES_MAX });
    /* END DEC-49 REGION is-search-stated */
    return { ok: true, held, texts: [], detail: {
      places: sr.places.map((p) => (typeof p === "string" ? p.trim()
                                     : { captureSha: p.captureSha.trim().toLowerCase(), extent: p.extent })),
      request: sr.request == null ? null : sr.request.trim(),
      answer: sr.answer == null ? null : { captureSha: sr.answer.captureSha.trim().toLowerCase(), extent: sr.answer.extent } } };
  }

  /* ===================================================================== *
   * R52, R53: A SPOKEN COMMITMENT, AND THE GROUP'S OWN LETTER (T45; Actions D7; v0.2 §3 Standard)
   * ===================================================================== */

  /** R53 (`membership` R125's form): the one check a later module (`actions`) registers once at start, answering whether
   *  a capture is the group's own sending: `fn({captureSha})` → true or false. The slot takes one registration whoever
   *  makes it, so its refusals are `membership.listenerRefusal`'s (its R81), naming the holder. */
  registerOwnSendingCheck(module, fn) {
    const refused = listenerRefusal(this.#ownSending, module, fn);
    if (refused) return refused;
    this.#ownSending = { module, fn };
    return { ok: true, module };
  }

  /* R52: whether a capture is a member's authored observation (`provenance` R28: the register entry its testimony path
     wrote, `authored` 1, its R48 read contract). */
  #authoredCapture(captureSha) {
    return typeof captureSha === "string" && captureSha !== ""
      && !!this.#one(`SELECT 1 AS x FROM register WHERE capture_sha=? AND authored=1 LIMIT 1`, captureSha);
  }

  /* R53: whether the registered check answers a capture is the group's own sending. A check that throws or answers
     anything but true or false (a promise included) is read as true for that capture (fail closed); with none
     registered, false, and only R52's authored test applies. */
  #ownSendingCapture(captureSha) {
    const check = this.#ownSending;
    if (!check) return false;
    let r;
    try { r = check.fn({ captureSha }); } catch { return true; }
    if (r === true || r === false) return r;
    if (r && typeof r.then === "function") r.then(null, () => {});
    return true;
  }

  /* R52, R53: a commitment held `text` whose every text row, or held `cited` whose citing passage, is of a member's
     authored observation (COMMITMENT_AS_HEARD), or of such observations and the group's own sending with at least one
     of the latter (COMMITMENT_OWN_LETTER): it rests on no confirmation by the body. Null for any other kind, a
     commitment held `absent`, or one with at least one row from another capture (the body's letter, its minutes, a
     recording or its own publication). Writes nothing. */
  #commitmentRefusal(kind, held, texts, detail) {
    if (kind !== "commitment" || (held !== "text" && held !== "cited")) return null;
    const rows = held === "text"
      ? texts.map((id) => { const row = this.content.contentRow(id); return { content_id: id, capture_sha: row ? row.capture_sha : null }; })
      : [{ content_id: detail.content_id, capture_sha: detail.captureSha }];
    if (!rows.length) return null;
    const seen = new Map();
    const of = (sha) => {
      if (!seen.has(sha)) {
        const heard = this.#authoredCapture(sha);
        seen.set(sha, heard ? "heard" : this.#ownSendingCapture(sha) ? "own" : "other");
      }
      return seen.get(sha);
    };
    const marked = rows.map((r) => ({ ...r, is: of(r.capture_sha) }));
    if (marked.some((r) => r.is === "other")) return null;
    const ids = marked.map((r) => r.content_id);
    if (marked.every((r) => r.is === "heard")) {
      /* DEC-49 REGION is-commitment-confirmed */
      return refusal("COMMITMENT_AS_HEARD", `${ids.join(", ").slice(0, 400)} ${ids.length === 1 ? "is" : "are each"} a `
                     + "member's account of what was heard. A spoken commitment is a standard only once confirmed in writing "
                     + "or stated publicly. Nothing was written.", { content_ids: ids });
      /* END DEC-49 REGION is-commitment-confirmed */
    }
    /* DEC-49 REGION is-commitment-not-own-letter */
    return refusal("COMMITMENT_OWN_LETTER", `${ids.join(", ").slice(0, 400)} ${ids.length === 1 ? "is" : "are each"} of the `
                   + "team's own sending or a member's account of what was heard; the team's confirming letter is not the "
                   + "body's confirmation. Nothing was written.",
                   { content_ids: ids, own_sending: marked.filter((r) => r.is === "own").map((r) => r.content_id),
                     as_heard: marked.filter((r) => r.is === "heard").map((r) => r.content_id) });
    /* END DEC-49 REGION is-commitment-not-own-letter */
  }

  /* R2, R47, R60: a standard's named text as content ids: each a content id, or a found extent ({capture_sha, extent}, a
     find's match, `retrieval` R73) resolved to `content`'s row for that extent, exactly as a content id named directly;
     an extent content holds no row for is minted by the declaring member's act (`#mintFound`). `{ids}`, `{ids,
     unresolved}` naming the first extent that is neither held nor mintable, or null when not in that shape. */
  #textIdsResolved(v, author = "", viewer = null) {
    const list = typeof v === "string" || isObj(v) ? [v] : Array.isArray(v) ? v : null;
    if (!list) return null;
    const ids = [];
    for (const x of list) {
      if (typeof x === "string") { if (x.trim()) ids.push(x.trim()); continue; }
      if (!isObj(x) || typeof (x.capture_sha ?? x.captureSha) !== "string" || !isObj(x.extent)) return null;
      const row = this.#extentRow(x.capture_sha ?? x.captureSha, x.extent, null)
        ?? this.#mintFound(x.capture_sha ?? x.captureSha, x.extent, author, viewer ?? author);
      if (!row) return { ids, unresolved: `${String(x.capture_sha ?? x.captureSha).slice(0, 64)}` };
      ids.push(row.content_id);
    }
    return { ids: [...new Set(ids)] };
  }

  /* R60 (N1177; `content` R12, R13): a found extent `content` holds no row for, made the standard's text by the declaring
     member's own act: the row is minted by `author` (labelled by `content` R16 as a member's), for the capture and extent,
     in a bundle that holds the capture and the viewer may see, as `events` mints the passages a use cites (R43). Null (so
     `STANDARD_TEXT_UNRESOLVED`) for a capture not held or not visible, an extent `content` refuses (its R7), or no author;
     a mint of a row already held finds it, never rewriting it (`content` R13). Called inside the act's transaction, so a
     refusal after it takes the row back. */
  #mintFound(captureSha, extent, author, viewer) {
    try {
      const sha = String(captureSha).trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(sha) || !author || !isObj(extent)) return null;
      const home = this.provenance && typeof this.provenance.homeOf === "function" ? this.provenance.homeOf(sha) : null;
      const bundles = [...(home ? [home.bundleId] : []),
                       ...this.#rows(`SELECT DISTINCT bundle_id FROM register WHERE capture_sha=? ORDER BY bundle_id`, sha)
                         .map((r) => r.bundle_id)];
      const bundleId = bundles.find((b) => b && this.membership.inSight(b, viewer));
      if (!bundleId) return null;
      const m = this.content.mint({ bundleId, captureSha: sha, extent, mintedBy: author });
      return m && m.ok === true ? this.content.contentRow(m.content_id) : null;
    } catch { return null; }
  }

  /* R33, R36–R42, R47: the fields T35 adds, each asked in R1's order (family, copy, versions, designation and issuer,
     access, target, the question); `{ok: true, fields}` when none is refused. Each refusal writes nothing. */
  #t35Fields(a, f) {
    const fam = this.#familyField(a, f.cite);
    if (fam.ok === false) return fam;
    const copy = this.#copyFields(a, f);
    if (copy.ok === false) return copy;
    const ver = this.#versionFields(a, f);
    if (ver.ok === false) return ver;
    const des = this.#designationFields(a, f, fam.recognised);
    if (des.ok === false) return des;
    const acc = this.#accessFields(a, f);
    if (acc.ok === false) return acc;
    const tgt = this.#targetField(a, f);
    if (tgt.ok === false) return tgt;
    const qn = this.#questionField(a);
    if (qn.ok === false) return qn;
    return { ok: true, fields: { family: fam.family, copy: copy.copy, ...ver.fields, ...des.fields, access: acc.access,
                                 target: tgt.target, question: qn.question, sight: this.#sightOf(f.kind, f.texts) } };
  }

  /* R33: the family, from the cite's series reading (`id-spaces.recogniseSeries` over the active view), a declared one
     kept as declared with the difference stated; a declared key/series pair no active profile holds is refused. */
  #familyField(a, cite) {
    const { view, why } = this.#view();
    let recognised = null;
    try {
      const r = view ? recogniseSeries(view, cite) : null;
      recognised = r && Array.isArray(r.citations) && r.citations.length ? r.citations[0] : null;
    } catch { recognised = null; }
    const read = recognised ? { key: recognised.key, series: recognised.series,
                                number: recognised.normal ?? recognised.number } : null;
    if (a.family == null) {
      if (read) return { ok: true, recognised, family: { state: "matched", ...read, family_key: familyKey(read),
                                                         label: recognised.label ?? null } };
      return { ok: true, recognised, family: { state: "undetermined", key: null, family_key: null,
        why: view ? word("standards.why.citation_matches_series")
                  : why } };
    }
    const d = a.family;
    if (!isObj(d) || Object.keys(d).some((k) => !["key", "series", "number"].includes(k)) || typeof d.key !== "string"
        || typeof d.series !== "string" || typeof d.number !== "string" || !d.number.trim() || d.number.length > CITE_MAX)
      return refuseFieldInvalid("family", "is {key, series, number}: an active profile's source key and series key, and the "
                                + "item's number in that series");
    const entries = view && Array.isArray(view.standard_sources) ? view.standard_sources : [];
    const held = entries.find((e) => e && e.key === d.key.trim() && isObj(e.series) && e.series.key === d.series.trim());
    /* DEC-49 REGION is-family-known */
    if (!held)
      return refusal("FAMILY_UNKNOWN", `no active jurisdiction profile lists the series ${d.key.slice(0, 40)}/`
                     + `${d.series.slice(0, 40)}. Nothing was written.`, { family: { key: d.key.slice(0, 40), series: d.series.slice(0, 40) } });
    /* END DEC-49 REGION is-family-known */
    const fam = { key: d.key.trim(), series: d.series.trim(), number: d.number.trim() };
    const differs = read && (read.key !== fam.key || read.series !== fam.series || read.number !== fam.number)
      ? { differs: { read, says: word("standards.says.recorded_declared_citation", { key: String(read.key), series: String(read.series), number: String(read.number) }) } } : {};
    return { ok: true, recognised, family: { state: "declared", ...fam, family_key: familyKey(fam),
                                             label: held.series.label ?? null, ...differs } };
  }

  /* R19, R36: the copy as the member declares it, and what the copy says of itself, held apart, never merged. */
  #copyFields(a, f) {
    const bad = (detail, extra) => {
      /* DEC-49 REGION is-copy-known */
      return refusal("COPY_UNKNOWN", `${detail} is one of ${COPY_STATES.join(", ")}. Nothing was written.`,
                     { copies: [...COPY_STATES], ...extra });
      /* END DEC-49 REGION is-copy-known */
    };
    if (a.copy != null && !COPY_STATES.includes(a.copy)) return bad("a copy", { field: "copy" });
    let claimed = null;
    if (a.copy_claimed != null) {
      const c = a.copy_claimed;
      if (!isObj(c) || !COPY_STATES.includes(c.says)) return bad("what a copy says of itself", { field: "copy_claimed" });
      const ext = typeof c.extent === "string" ? c.extent.trim() : "";
      /* DEC-49 REGION is-copy-claim-cited */
      if (!ext || !f.texts.includes(ext) || Object.keys(c).some((k) => k !== "says" && k !== "extent"))
        return refusal("COPY_CLAIM_NOT_CITED", "what a copy says of itself names the passage of its text that says it: "
                       + "copy_claimed {says, extent}, extent one of the standard's text passages. Nothing was written.");
      /* END DEC-49 REGION is-copy-claim-cited */
      claimed = { says: c.says, extent: ext };
    }
    const copy = { ...f.copy };
    if (claimed) {
      copy.claimed = claimed;
      if (claimed.says !== copy.copy)
        copy.claim_differs = word("standards.copy_says_recorded", { says: String(claimed.says), copy: String(copy.copy) });
    }
    return { ok: true, copy };
  }

  /* R38: a version read from two captures, overrides, and where the standard's force comes from. */
  #versionFields(a, f) {
    const fields = { version_basis: null, overrides: [], force_source: null };
    if (a.version_basis != null) {
      const vb = this.#versionBasis(a.version_basis, f);
      /* DEC-49 REGION is-version-basis */
      if (!vb.ok)
        return refusal("VERSION_BASIS_INVALID", `${vb.why}. Nothing was written.`);
      /* END DEC-49 REGION is-version-basis */
      fields.version_basis = vb.basis;
    }
    if (a.overrides != null) {
      const list = Array.isArray(a.overrides) ? a.overrides : null;
      const bad = (field, why) => {
        /* DEC-49 REGION is-override-form */
        return refusal("OVERRIDE_INVALID", `an override's ${field} ${why}. Nothing was written.`, { field });
        /* END DEC-49 REGION is-override-form */
      };
      if (!list || !list.length || list.length > TEXTS_MAX) return bad("list", `is a list of 1 to ${TEXTS_MAX} overrides`);
      for (const o of list) {
        if (!isObj(o) || Object.keys(o).some((k) => !["target", "portion", "until"].includes(k))) return bad("form", "is {target, portion, until}");
        if (typeof o.target !== "string" || !o.target.trim()) return bad("target", "names a held standard");
        const t = this.#row(o.target.trim());
        if (!t || (f.viewer !== null && !this.#readable(t.standard_id, f.viewer))) return noSuchStandard(o.target.trim(), { id: o.target.trim(), field: "target" });
        if (!isPortionPath(o.portion) || (t.portion_path && o.portion.trim() !== t.portion_path))
          return portionUnknown(t.standard_id, o.portion, { field: "portion" });
        const u = o.until;
        const until = typeof u === "string" && /^EVT-/.test(u) && isRecordId(u) ? { event: u }
          : u === "revision" ? { revision: true } : null;
        if (!until) return bad("until", "is an event (EVT-…) or \"revision\", a later revision of this standard's own key");
        fields.overrides.push({ target: t.standard_id, portion: o.portion.trim(), until });
      }
    }
    if (a.force_source != null) {
      const fs = a.force_source;
      const ok = isObj(fs) && Object.keys(fs).every((k) => k === "kind" || k === "citation") && FORCE_SOURCES.includes(fs.kind)
        && typeof fs.citation === "string" && f.texts.includes(fs.citation.trim());
      /* DEC-49 REGION is-force-source */
      if (!ok)
        return refusal("FORCE_SOURCE_INVALID", `force_source is {kind, citation}: kind one of ${FORCE_SOURCES.join(", ")}, `
                       + "citation one of the standard's text passages stating it. Nothing was written.", { kinds: [...FORCE_SOURCES] });
      /* END DEC-49 REGION is-force-source */
      fields.force_source = { kind: fs.kind, citation: fs.citation.trim() };
    }
    return { ok: true, fields };
  }

  /* R38: two held captures of one address whose texts differ, the version they bound named by `supersedes`. The period's
     start is the band after the earlier capture's retrieval and on or before the later's, never an enactment date. */
  #versionBasis(v, f) {
    if (!isObj(v) || Object.keys(v).some((k) => k !== "captures") || !Array.isArray(v.captures) || v.captures.length !== 2
        || !v.captures.every((c) => typeof c === "string" && /^[0-9a-f]{64}$/.test(c.trim().toLowerCase())))
      return { ok: false, why: "version_basis is {captures: [earlier, later]}, two capture digests" };
    if (!f.supersedes) return { ok: false, why: word("standards.why.version_read_two") };
    const [e, l] = v.captures.map((c) => c.trim().toLowerCase());
    if (e === l) return { ok: false, why: word("standards.why.two_captures_texts") };
    /* T36 (N725): each named capture's own receipts (`provenance.receiptsOfCapture`, its R60), never every receipt */
    const rows = [e, l].flatMap((c) => this.#receiptsOf(c));
    const pairs = [];
    for (const re of rows.filter((r) => r.capture_sha === e))
      for (const rl of rows.filter((r) => r.capture_sha === l && r.address_norm === re.address_norm))
        pairs.push({ address: re.address_norm, after: re.first_retrieved, through: rl.first_retrieved });
    const pair = pairs.find((p) => Date.parse(p.after) < Date.parse(p.through));
    if (!pair) return { ok: false, why: pairs.length ? word("standards.why.earlier_capture_retrieved")
                                                     : word("standards.why.two_captures_held") };
    return { ok: true, basis: { captures: [e, l], address: pair.address, after: pair.after, through: pair.through,
                                says: localize("standards.index.period_starts_after_captures", "the period starts after the earlier capture and on or before the later one: it rests on the captures, never on an enactment date") } };
  }

  /* R38, R50: the receipts naming one capture (`provenance.receiptsOfCapture`, its R60), each as its R16 answers it;
     none when provenance cannot answer. */
  #receiptsOf(captureSha) {
    try {
      const p = this.provenance;
      const r = p && typeof p.receiptsOfCapture === "function" ? p.receiptsOfCapture({ captureSha }) : null;
      return r && Array.isArray(r.rows) ? r.rows : [];
    } catch { return []; }
  }

  /* R39: designation and edition as the cite reads them, a declared one kept as declared with the difference stated;
     the issuer may be a registered entity. An edition is never defaulted. */
  #designationFields(a, f, recognised) {
    const read = { designation: recognised ? `${recognised.label ? `${recognised.label} ` : ""}${recognised.normal ?? recognised.number}` : null,
                   edition: recognised && typeof recognised.edition === "string" ? recognised.edition : null };
    const out = {};
    for (const [field, max] of [["designation", DESIGNATION_MAX], ["edition", EDITION_MAX]]) {
      const d = a[field];
      if (d != null && (typeof d !== "string" || !d.trim() || [...d].length > max))
        return refuseFieldInvalid(field, `is the ${field} as written, at most ${max} characters`);
      const value = d != null ? d.trim() : read[field];
      out[field] = { value, declared: d != null, read: read[field],
                     ...(d != null && read[field] !== null && read[field] !== value
                       ? { says: word("standards.says.recorded_declared_citation_reads", { read: String(read[field]) }) } : {}),
                     ...(value === null ? { why: field === "edition" ? word("standards.why.edition_stated_none")
                                                                     : word("standards.why.citation_states_designation") } : {}) };
    }
    let issuerEntity = null;
    if (/^ENT-/.test(f.issuer)) {
      const e = this.#entity(f.issuer, f.viewer);
      if (!e) return noSuchEntity(f.issuer, { field: "issuer" });
      issuerEntity = f.issuer;
    }
    return { ok: true, fields: { designation: out.designation, edition: out.edition, issuer_entity: issuerEntity } };
  }

  /* An entity the viewer may read (`entities.readEntity`), or null. */
  #entity(id, viewer) {
    try {
      const r = this.entities ? this.entities.readEntity({ entityId: id, viewer: viewer ?? INTERNAL_READER }) : null;
      return r && r.ok !== false && r.found ? r.entity : null;
    } catch { return null; }
  }

  /* R41: access; a reading-room or paywalled standard takes text only from a capture a member made by their own act. */
  #accessFields(a, f) {
    if (a.access != null && !ACCESS_STATES.includes(a.access)) {
      /* DEC-49 REGION is-access-known */
      return refusal("ACCESS_UNKNOWN", `access is one of ${ACCESS_STATES.join(", ")}. Nothing was written.`,
                     { access: [...ACCESS_STATES] });
      /* END DEC-49 REGION is-access-known */
    }
    const access = a.access ?? null;
    if (access === "reading_room" || access === "paywalled")
      for (const id of f.texts) {
        const row = this.content.contentRow(id);
        const by = row ? this.#memberCaptured(row.capture_sha) : false;
        /* DEC-49 REGION is-text-member-captured */
        if (!by)
          return refusal("TEXT_NOT_MEMBER_CAPTURED", `${String(id).slice(0, 80)} is not from a capture a member made by `
                         + "their own act. Nothing was written.", { content_id: String(id).slice(0, 80) });
        /* END DEC-49 REGION is-text-member-captured */
      }
    return { ok: true, access };
  }

  /* R41: whether a member (never a machine credential) captured these bytes by their own act (`capture`'s actors). */
  #memberCaptured(captureSha) {
    try {
      const c = this.capture;
      const r = c && typeof c.captureAccountsOf === "function" ? c.captureAccountsOf(captureSha, { viewer: INTERNAL_READER }) : null;
      /* capture records the bare id or `member:<id>` (its R69 reads both as one member); a machine identity is neither */
      return !!r && Array.isArray(r.actors)
        && r.actors.some((x) => typeof x.actor === "string" && x.actor.replace(/^member:/, "") !== ""
          && !isMachineIdentity(x.actor) && !isMachineIdentity(x.actor.replace(/^member:/, "")));
    } catch { return false; }
  }

  /* R42: a target of a commitment, policy or standard: metric, threshold, period and definition. */
  #targetField(a, f) {
    if (a.target == null) return { ok: true, target: null };
    const bad = (field, why) => {
      /* DEC-49 REGION is-target-form */
      return refusal("TARGET_INVALID", `a target's ${field} ${why}. Nothing was written.`, { field });
      /* END DEC-49 REGION is-target-form */
    };
    const t = a.target;
    if (!BENCHMARK_KINDS.includes(f.kind)) return bad("kind", `is held only by a ${BENCHMARK_KINDS.join(", ")}`);
    if (!isObj(t) || Object.keys(t).some((k) => !["metric", "threshold", "period", "definition"].includes(k)))
      return bad("form", "is {metric, threshold, period, definition}");
    const m = t.metric;
    if (!isObj(m) || typeof m.words !== "string" || !m.words.trim() || m.words.length > CITE_MAX
        || typeof m.content_id !== "string" || !f.texts.includes(m.content_id.trim()))
      return bad("metric", "is {words, content_id}: the measured quantity in words, and the passage of the standard's text stating it");
    const th = t.threshold;
    if (!isObj(th) || !COMPARATORS.includes(th.comparator)) return bad("threshold", `names a comparator, one of ${COMPARATORS.join(", ")}`);
    let fig = null;
    try { fig = typeof th.value === "string" ? parseFigure(th.value) : null; } catch { fig = null; }
    if (!fig || fig.refused || fig.precision !== "exact")
      return bad("threshold", "value is an exact decimal, written as the text states it");
    if (typeof th.unit !== "string" || !th.unit.trim() || th.unit.length > EDITION_MAX)
      return bad("threshold", "unit is the unit as the text states it");
    const p = t.period;
    let period = null;
    if (isObj(p) && typeof p.recurrence === "string") {
      if (!p.recurrence.trim() || p.recurrence.length > CITE_MAX || typeof p.content_id !== "string" || !f.texts.includes(p.content_id.trim()))
        return bad("period", "as a recurrence is {recurrence, content_id}, the passage stating it");
      period = { recurrence: p.recurrence.trim(), content_id: p.content_id.trim() };
    } else {
      period = isObj(p) ? periodOf(p) : null;
      if (!period) return bad("period", "is {from, to}, each a YYYY-MM-DD date or null, or a recurrence the text states");
    }
    const d = t.definition;
    if (d !== "none" && !(typeof d === "string" && this.#heldFor(d, f.viewer)))
      return bad("definition", "is the passage of the body's own definition of the metric, or \"none\"");
    return { ok: true, target: { metric: { words: m.words.trim(), content_id: m.content_id.trim() },
                                 threshold: { comparator: th.comparator, value: `${fig.sign === "-" ? "-" : ""}${fig.value}`, unit: th.unit.trim(),
                                              as_read: th.value },
                                 period, definition: d === "none" ? "none" : d.trim(),
                                 ...(d === "none" ? { definition_says: word("standards.definition_stated") } : {}) } };
  }

  /* R47: the question beside a declaration, an inquiry's bundle the author may see. */
  #questionField(a) {
    if (a.question == null || a.question === "") return { ok: true, question: null };
    const q = typeof a.question === "string" ? a.question.trim() : "";
    const b = q ? this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, q) : null;
    /* DEC-49 REGION is-question-held */
    if (!b || b.object_type !== "inquiry" || !this.membership.inSight(q, str(a.author)))
      return refusal("QUESTION_NOT_HELD", localize("standards.index.no_question_your_teams_record", "no question your team's record holds that you may see answers to that id. Nothing was written."), { question: q.slice(0, 80) || null });
    /* END DEC-49 REGION is-question-held */
    return { ok: true, question: q };
  }

  /* R37: a policy whose text is filed in a project's bundle is held with that bundle's sight; any other, group. */
  #sightOf(kind, texts) {
    if (kind !== "policy") return { class: "group" };
    const bundles = new Set();
    for (const id of texts) {
      const row = this.content.contentRow(id);
      if (!row) continue;
      const b = this.#one(`SELECT bundle_id, ${PROJECT_OF} AS project FROM bundles b WHERE bundle_id=?`, row.bundle_id);
      if (b && b.project) bundles.add(b.bundle_id);
    }
    return bundles.size ? { class: "bundle", bundles: [...bundles].sort() } : { class: "group" };
  }

  /* `content`'s row for a capture's extent, read and never minted (the id `content` gives that extent under the
     capture's chain), or null; with a viewer, only a row in a document the viewer may see. */
  #extentRow(captureSha, extent, viewer) {
    try {
      const sha = String(captureSha).trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(sha)) return null;
      const chain = extent.kind === "bytes" ? null : this.content.contentContextFor(sha).chain;
      const row = this.content.contentRow(contentIdFor(sha, extent, chain));
      if (!row || (viewer !== null && !this.membership.inSight(row.bundle_id, viewer))) return null;
      return row;
    } catch { return null; }
  }

  /* R18, R19: where the standard sits in its law, each field checked, in the order R18–R19 name them; `{ok: true,
     fields}` when none is malformed. The instrument key is composed, never typed: a declared one must be the key the
     profiles compose. */
  #lawFields(a, cite, texts, period, viewer) {
    const { view } = this.#view();
    const key = instrumentKey({ cite, view });
    const bad = refuseFieldInvalid;
    if (a.instrument != null && a.instrument !== "" && a.instrument !== key.key)
      return bad("instrument", key.key ? `is composed from the profiles as ${key.key}, and a different key was given`
                                       : `cannot be given: ${key.why}`);
    let portion = null;
    if (a.portion != null) {
      const p = a.portion;
      if (!isObj(p) || Object.keys(p).some((k) => k !== "path" && k !== "content_id") || !isPortionPath(p.path)
          || typeof p.content_id !== "string")
        return bad("portion", "is {path, content_id}: a path within the instrument of at most 200 characters and the "
                   + "content id of its extent");
      /* DEC-49 REGION is-portion-in-text */
      if (!texts.includes(p.content_id.trim()))
        return refusal("STANDARD_PORTION_NOT_IN_TEXT", `${p.content_id.slice(0, 80)} is not one of this standard's text `
                       + "passages. Nothing was written.", { content_id: p.content_id.slice(0, 80) });
      /* END DEC-49 REGION is-portion-in-text */
      portion = { path: p.path.trim(), content_id: p.content_id.trim() };
    }
    let requires = [];
    if (a.requires != null) {
      const r = textIds(a.requires);
      if (!r || !r.length || r.length > TEXTS_MAX || r.some((c) => !texts.includes(c)))
        return bad("requires", "is a list of the standard's own text passages (content ids among its text), quoted as "
                   + "captured, never paraphrased");
      requires = r;
    }
    const m = matchSource(view, cite);
    const sourceCopyIs = m ? sourceCopy(view, m.entry) : "undetermined";
    /* R36: the declared copy's form is asked in R36's place (#copyFields), after the family (R1's order) */
    const copy = a.copy ?? sourceCopyIs;
    const copyAnswer = { copy, source_copy: sourceCopyIs, declared: a.copy != null,
                         ...(a.copy != null && a.copy !== sourceCopyIs
                           ? { says: word("standards.says.recorded_declared_matched_source", { source_copy_is: String(sourceCopyIs) }) } : {}) };
    let currentThrough = null;
    if (a.current_through != null) {
      const c = a.current_through;
      if (!isObj(c) || !isDate(c.date) || typeof c.basis !== "string" || !this.#heldFor(c.basis, viewer))
        return bad("current_through", "is {date, basis}: the date the copy states it is current through (YYYY-MM-DD) "
                   + "and the captured passage stating it, which you may read");
      currentThrough = { date: c.date, basis: c.basis.trim() };
    }
    let periodBasis = null;
    if (a.period_basis != null) {
      const pb = a.period_basis;
      if (!isObj(pb) || Object.keys(pb).some((k) => k !== "from" && k !== "to"))
        return bad("period_basis", "is {from?, to?}, each a cited passage {passage} or an enactment event {event, edge}");
      periodBasis = {};
      for (const side of ["from", "to"]) {
        const b = pb[side];
        if (b == null) continue;
        if (isObj(b) && typeof b.passage === "string" && Object.keys(b).length === 1 && this.#heldFor(b.passage, viewer))
          periodBasis[side] = { passage: b.passage.trim() };
        else if (isObj(b) && typeof b.event === "string" && /^EVT-/.test(b.event) && isRecordId(b.event)
                 && (b.edge === "start" || b.edge === "end") && Object.keys(b).length === 2) {
          if (period[side] !== null)
            return bad("period_basis", `gives an event for the period's ${side}, which also states a date: a bound is a date `
                       + "or an event, never both");
          periodBasis[side] = { event: b.event, edge: b.edge };
        } else return bad("period_basis", localize("standards.index.side_is_held_passage", "'s {side} is a held passage {passage: content id} or an enactment event {event: EVT-…, edge: start or end}", { side }));
      }
    }
    return { ok: true, fields: { instrument: key, portion, requires, copy: copyAnswer, current_through: currentThrough,
                                 period_basis: periodBasis } };
  }

  /* A content id `content` holds, in a document the viewer may see. */
  #heldFor(contentId, viewer) {
    if (typeof contentId !== "string" || !contentId.trim()) return false;
    const row = this.content.contentRow(contentId.trim());
    return !!row && (viewer === null || this.membership.inSight(row.bundle_id, viewer));
  }

  /* R2: the first named content id `content.contentRow` does not hold (or, for a viewer, whose document the viewer
     may not see: one answer), or null. */
  #unresolvedText(texts, viewer) {
    for (const id of texts) {
      const row = this.content.contentRow(id);
      if (!row || (viewer !== null && !this.membership.inSight(row.bundle_id, viewer))) return id;
    }
    return null;
  }

  /* R1, R10: the one write. The id is allocated, the document promoted and the rows written in one transaction, so a
     refusal anywhere leaves nothing (record-core R32). */
  #write(f, author, viewer, proposalId) {
    return this.record.transact(() => {
      const at = this.#when();
      const id = `${this.record.allocId("STD", at.slice(0, 4)).id}-${f.kind}`;
      const source = this.sourceOf(f.cite, f);
      const text = standardDoc({ id, ...f, source, proposal: proposalId, author, at });
      this.#writing = id;
      let r;
      try {
        r = this.promotion.promote({ bundleId: id, base: null, snapKey: `${at.replace(/[-:]/g, "")}_${rand(4)}`, author,
          files: [{ path: "bundle.md", text }],
          meta: { object_type: STANDARD, title: titleOf(f.cite), current_state: "recorded", created: at, last_updated: at },
          actorIdentity: author, actorViewer: viewer ?? author });
      } finally { this.#writing = null; }
      if (!r || !r.ok) return r;
      /* one row, written once (R14): R1, R3, R4, R10's fields, R18–R19's, and T35's (R33–R42, R47) */
      const cols = {
        standard_id: id, cite: f.cite, kind: f.kind, issuer: f.issuer, period_from: f.period.from, period_to: f.period.to,
        supersedes: f.supersedes, source_json: JSON.stringify(source), proposal_id: proposalId, declared_by: author,
        declared_at: at, reason: f.reason, instrument: f.instrument.key, instrument_json: JSON.stringify(f.instrument),
        portion_path: f.portion ? f.portion.path : null, portion_content: f.portion ? f.portion.content_id : null,
        requires_json: JSON.stringify(f.requires), copy: f.copy.copy, copy_json: JSON.stringify(f.copy),
        current_through: f.current_through ? f.current_through.date : null,
        current_through_basis: f.current_through ? f.current_through.basis : null,
        period_basis_json: f.period_basis ? JSON.stringify(f.period_basis) : null,
        family_json: JSON.stringify(f.family), family_key: f.family.family_key ?? null, held: f.held,
        held_json: f.held_detail ? JSON.stringify(f.held_detail) : null,
        copy_claimed_json: f.copy.claimed ? JSON.stringify(f.copy.claimed) : null, sight_json: JSON.stringify(f.sight),
        version_basis_json: f.version_basis ? JSON.stringify(f.version_basis) : null,
        force_source_json: f.force_source ? JSON.stringify(f.force_source) : null, designation: f.designation.value,
        designation_json: JSON.stringify({ designation: f.designation, edition: f.edition }), edition: f.edition.value, issuer_entity: f.issuer_entity,
        access: f.access, target_json: f.target ? JSON.stringify(f.target) : null, question: f.question,
      };
      const names = Object.keys(cols);
      this.sql.exec(`INSERT INTO standards (${names.join(", ")}) VALUES (${names.map(() => "?").join(",")})`,
                    ...names.map((n) => cols[n]));
      f.overrides.forEach((o, i) => this.sql.exec(`INSERT INTO standard_overrides (standard_id, ord, target, portion, until_json)
                                                   VALUES (?,?,?,?,?)`, id, i, o.target, o.portion, JSON.stringify(o.until)));
      f.texts.forEach((c, i) => this.sql.exec(`INSERT INTO standard_texts (standard_id, ord, content_id) VALUES (?,?,?)`,
                                              id, i, c));
      if (proposalId)
        this.sql.exec(`INSERT INTO standard_adoptions (proposal_id, standard_id, adopted_by, adopted_at) VALUES (?,?,?,?)`,
                      proposalId, id, author, at);
      return { ok: true, ...this.#answer(this.#row(id), viewer ?? author), bundleSha: r.bundleSha };
    });
  }

  /* ===================================================================== *
   * READING (R5–R8)
   * ===================================================================== */

  #row(id) {
    return typeof id === "string" && id ? this.#one(`SELECT * FROM standards WHERE standard_id=?`, id) : null;
  }

  #successorOf(id) {
    const r = this.#one(`SELECT standard_id FROM standards WHERE supersedes=?`, id);
    return r ? r.standard_id : null;
  }

  /* R1's fields, R3's source, the declarer, time and reason (R4), both ends of a supersession (R6), the proposal (R10).
     A standard recorded before the reason was asked for answers `reason: null`. */
  #answer(row, viewer = null) {
    const texts = this.#rows(`SELECT content_id FROM standard_texts WHERE standard_id=? ORDER BY ord`, row.standard_id)
      .map((t) => t.content_id);
    return { id: row.standard_id, cite: row.cite, kind: row.kind, issuer: row.issuer, reason: row.reason ?? null,
             text: texts,
             period: { from: row.period_from ?? null, to: row.period_to ?? null }, source: safeJson(row.source_json),
             declared_by: row.declared_by, declared_at: row.declared_at, supersedes: row.supersedes ?? null,
             superseded_by: this.#successorOf(row.standard_id), proposal: row.proposal_id ?? null,
             ...this.#lawAnswer(row), ...this.#t35Answer(row, viewer) };
  }

  /* R33–R42, R45, R47 as read back: a standard recorded before T35 is held `text`, at group sight, with no family,
     edition, target or question stated (each said so, never invented). */
  #t35Answer(row, viewer) {
    const held = row.held || "text";
    const heldDetail = safeJson(row.held_json);
    const issuerEntity = row.issuer_entity ? this.#entity(row.issuer_entity, viewer) : null;
    const issuerLabel = issuerEntity ? issuerEntity.label : row.issuer;
    const access = row.access ?? (row.kind === "standard" ? "undetermined" : null);
    const sight = this.#sight(row);
    const notPublic = sight.class === "bundle" && !sight.released ? { release_by: this.#releaseBy(sight) } : null;
    const qn = row.question && viewer !== null && this.membership.inSight(row.question, viewer) ? row.question : null;
    const says = { ...(ownerWords(row.kind, issuerLabel) ? { owner: ownerWords(row.kind, issuerLabel) } : {}),
                   ...(heldWords(held, heldDetail, sourceWords) || {}),
                   ...(accessWords(access) ? { access: accessWords(access) } : {}),
                   ...(row.copy && copyWords(row.copy) ? { copy: copyWords(row.copy) } : {}),
                   ...(notPublic ? notPublicWords(notPublic.release_by) : {}) };
    return {
      family: safeJson(row.family_json) || { state: "undetermined", key: null, family_key: null,
                                             why: word("standards.why.recorded_family_read") },
      owner: { issuer: row.issuer, label: issuerLabel, entity: row.issuer_entity ?? null,
               sector: issuerEntity ? issuerEntity.sector ?? null : null },
      held, ...(held === "cited" ? { cited_by: heldDetail } : {}), ...(held === "absent" ? { search: heldDetail } : {}),
      version_basis: safeJson(row.version_basis_json), overrides: this.#overridesBy(row.standard_id),
      force_source: safeJson(row.force_source_json),
      designation: row.designation ?? null, edition: row.edition ?? null,
      designation_read: (safeJson(row.designation_json) || {}).designation
        || { value: null, declared: false, read: null, why: word("standards.why.recorded_designation_read") },
      edition_read: (safeJson(row.designation_json) || {}).edition
        || { value: null, declared: false, read: null, why: word("standards.why.recorded_edition_read") },
      access, target: safeJson(row.target_json), question: qn,
      sight: sight.class === "bundle" ? { class: sight.released ? "group" : "bundle", released: sight.released || null }
                                      : { class: "group" },
      ...(notPublic ? { not_public: notPublic } : {}),
      says,
    };
  }

  /* R37: a standard's sight as recorded, with its release. */
  #sight(row) {
    const s = safeJson(row.sight_json) || { class: "group" };
    if (s.class !== "bundle") return { class: "group" };
    const rel = this.#one(`SELECT reason, released_by, released_at FROM standard_releases WHERE standard_id=?`, row.standard_id);
    return { class: "bundle", bundles: Array.isArray(s.bundles) ? s.bundles : [],
             released: rel ? { by: rel.released_by, at: rel.released_at, reason: rel.reason } : null };
  }

  /* R37: the projects whose owners may release a standard held at a source's sight, and those owners. */
  #releaseBy(sight) {
    const projects = new Set();
    for (const b of sight.bundles || []) {
      const r = this.#one(`SELECT ${PROJECT_OF} AS project FROM bundles b WHERE bundle_id=?`, b);
      if (r && r.project) projects.add(r.project);
    }
    return [...projects].sort().map((p) => {
      let owners = [];
      try { owners = this.membership.projectOwners(p) || []; } catch { owners = []; }
      return { project: p, owners };
    });
  }

  /* R38: the overrides a standard makes. */
  #overridesBy(id) {
    return this.#rows(`SELECT target, portion, until_json FROM standard_overrides WHERE standard_id=? ORDER BY ord`, id)
      .map((o) => ({ target: o.target, portion: o.portion, until: safeJson(o.until_json) }));
  }

  /* R18, R19 as read back: a standard recorded before them states none (its key undetermined, said so). */
  #lawAnswer(row) {
    const instrument = safeJson(row.instrument_json)
      || { state: "undetermined", key: null, why: word("standards.why.recorded_instrument_keys") };
    return { instrument,
             portion: row.portion_path ? { path: row.portion_path, content_id: row.portion_content } : null,
             requires: safeJson(row.requires_json) || [],
             copy: safeJson(row.copy_json) || { copy: "undetermined", source_copy: null, declared: false,
                                                 says: word("standards.says.recorded_copy_status") },
             current_through: row.current_through ? { date: row.current_through, basis: row.current_through_basis } : null,
             period_basis: safeJson(row.period_basis_json) };
  }

  /** R5: one standard, with each text passage's standing and whether a newer capture of its document holds it. */
  standardRead({ id = null, viewer = null } = {}) {
    const sid = str(id);
    if (!sid) return refuseNoId("standard");
    const row = this.#row(sid);
    if (!row || !this.#readable(sid, viewer)) return refuseNoSuchStandard(sid);
    const a = this.#answer(row, viewer);
    const standings = this.content.standings(a.text);
    const texts = a.text.map((contentId) => ({ content_id: contentId, standing: standings[contentId] ?? null,
                                               newer: this.content.passageNotice({ contentId, viewer }) }));
    /* R41: a reading-room or paywalled standard's words are answered only to a member viewer, kept inside the group */
    const withheld = (a.access === "reading_room" || a.access === "paywalled") && !isMemberViewer(viewer);
    const quoted = a.requires.map((contentId) => ({ content_id: contentId,
                                                    text: withheld ? null : this.content.passageText(contentId) }));
    /* R50: the standing records of the version known in force through a date */
    const through = this.#throughRecords(sid).filter((x) => !x.withdrawn);
    return { ok: true, ...a, texts, requires_quoted: quoted, in_force_through: through, bindings: this.#bindingsOf(sid, viewer),
             ...(withheld ? { text_withheld: textWithheldWords() } : {}),
             says: { ...a.says, note: noteWords() } };
  }

  /* R63 (DEC-438): whom the standard binds, as recorded: each adoption (R40), imposition and benchmark declaration (R43),
     newest first (`at`, then insertion order within a table, then the kinds in that order), each with its words (R45,
     R59). Called only for a standard the viewer may read (R37), so a record takes its standard's sight; the act or law of
     a record that is itself a standard the viewer may not read is not named, nor is its passage. */
  #bindingsOf(sid, viewer) {
    const kinds = ["adoption", "imposition", "benchmark"];
    const readable = (id) => { const r = this.#row(id); return !r || this.#readable(id, viewer); };
    const label = (body) => { const e = body ? this.#entity(body, viewer) : null; return e ? e.label : body; };
    const of = (kind, r, fields, ref) => {
      const hidden = ref !== null && !readable(ref);
      return { kind, ...fields(hidden), at: r.at, order: [r.at, kinds.indexOf(kind), r.rowid] };
    };
    const out = [
      ...this.#rows(`SELECT rowid, * FROM standard_body_adoptions WHERE standard_id=?`, sid).map((r) => of("adoption", r, (h) => ({
        id: r.adoption_id, body: r.body ?? null, act: h ? null : r.act, edition: r.edition, from: safeJson(r.from_json), mode: r.mode,
        citation: h ? null : r.citation, by: r.author, at: r.at,
        says: bindingWords("binds", label(r.body)) }), r.act)),
      ...this.#rows(`SELECT rowid, * FROM standard_impositions WHERE standard_id=?`, sid).map((r) => of("imposition", r, (h) => ({
        id: r.imposition_id, body: r.body, law: h ? null : r.law, citation: h ? null : r.citation, by: r.author, at: r.at,
        says: bindingWords("binds", label(r.body)) }), r.law)),
      ...this.#rows(`SELECT rowid, * FROM standard_benchmarks WHERE standard_id=?`, sid).map((r) => of("benchmark", r, () => ({
        id: r.benchmark_id, body: r.body, by: r.author, at: r.at,
        says: bindingWords("benchmark", label(r.body)) }), null)),
    ];
    out.sort((x, y) => cmp(y.order[0], x.order[0]) || x.order[1] - y.order[1] || y.order[2] - x.order[2]);
    return out.map(({ order, ...rest }) => rest);
  }

  /* R5: what a viewer may read. A standard is a bundle outside any project, so membership R43 lets every member, machine
     credential and the founder see it; any other viewer, and none, is answered as for an absent standard. */
  #readable(id, viewer) {
    if (viewer === null || viewer === undefined || !this.membership.inSight(id, viewer)) return false;
    const row = this.#row(id);
    return !row || this.#sightAdmits(row, viewer);
  }

  /* R37: a policy held at its source's sight is answered only to a viewer who may see every bundle its text is filed
     in, until released; any other standard, and a released one, to every viewer the record admits. */
  #sightAdmits(row, viewer) {
    const s = this.#sight(row);
    if (s.class !== "bundle" || s.released) return true;
    return viewer !== null && viewer !== undefined && s.bundles.every((b) => this.membership.inSight(b, viewer));
  }

  /** R7: whether a standard was in force on a date, with why: the alias of R20's `inForceAt({standard: id, date})`,
   *  answering exactly its state and why (Choices 18), so its callers need no change. */
  inForce(id, date) {
    if (!str(id)) return refuseNoId("standardinforce");
    if (!isDate(date)) return refuseDateInvalid(date);
    const r = this.inForceAt({ standard: str(id), date });
    if (r.ok === false) return r;
    return { ok: true, id: str(id), date, state: r.state, why: r.why, ...(r.known_through ? { known_through: r.known_through } : {}) };
  }

  /* ===================================================================== *
   * R20: IN FORCE AT A DATE
   * ===================================================================== */

  /* A day an event's `when` gives at `edge` (events R9, R26), or why there is none. */
  #eventDay(eventId, edge, viewer) {
    const ev = this.events;
    if (!ev || typeof ev.readEvent !== "function")
      return { day: null, why: word("standards.why.event_cannot_read", { event_id: String(eventId) }) };
    let r;
    /* a caller that names no viewer is internal and is not asked sight (membership's terms); events fails closed on an
       absent viewer, so the internal read is asked as the machine's stamp, which sees every bundle (membership R43) and
       only reads */
    try { r = ev.readEvent({ eventId, viewer: viewer ?? INTERNAL_READER }); } catch { r = null; }
    if (!r || r.ok === false || r.found === false)
      return { day: null, why: word("standards.why.event_held_read", { event_id: String(eventId) }) };
    const w = r.when !== undefined ? r.when : r.event ? r.event.when : undefined;
    if (!w || w === "undetermined" || w.undetermined) {
      /* K3992: events' reason passes on as given, a string or {key, vars}; never String() of a keyed one */
      const reason = w && w.why ? w.why : null;
      if (reason && typeof reason === "object") return { day: null, why: reason };
      return { day: null, why: word("standards.why.event_record_read", { event_id: String(eventId), words: String(reason ?? "placed nowhere") }) };
    }
    if (w.precision === "edtf") return { day: null, why: word("standards.why.event_band_day", { event_id: String(eventId), value: String(w.value ?? w.start) }) };
    if (w.precision === "upper_bound")
      return { day: null, why: word("standards.why.event_upper_bound", { event_id: String(eventId) }) };
    /* events R9: `start` and `end` are the half-open span of instants the when covers, in its zone; the edge's day is
       the local day of its first or last instant */
    let d = null;
    try {
      const at = edge === "end" ? (typeof w.end === "string" ? new Date(Date.parse(w.end) - 1000).toISOString().replace(/\.\d{3}Z$/, "Z") : null)
        : w.start;
      d = typeof at === "string" && typeof w.zone === "string" ? localDay(at, w.zone) : null;
    } catch { d = null; }
    return isDate(d) ? { day: d, why: null } : { day: null, why: word("standards.why.event_states_day", { event_id: String(eventId), edge: String(edge) }) };
  }

  /* R20: a version's period as the record states it: its stated bounds, a bound given as an event read from that
     event's when, and its end bounded by each adopted temporal relation that amends, repeals, renumbers or recodifies it
     (the day before its effective date). `{from, to, why: {from?, to?}, bound_by}`; a bound that cannot be read is
     null with why. */
  #periodOf(row, viewer) {
    const out = { from: row.period_from ?? null, to: row.period_to ?? null, why: {}, bound_by: [] };
    const basis = safeJson(row.period_basis_json) || {};
    for (const side of ["from", "to"]) {
      const b = basis[side];
      if (!b || !b.event) continue;
      const d = this.#eventDay(b.event, b.edge, viewer);
      if (d.day) out[side] = d.day; else out.why[side] = d.why;
    }
    for (const r of this.#law.boundsOn(row.standard_id)) {
      const eff = r.effective_date ? { day: r.effective_date } : this.#eventDay(r.effective_event, r.effective_edge, viewer);
      if (!eff.day) { out.why.to = typeof eff.why === "object" ? eff.why : word("standards.bounds", { relation_id: String(r.relation_id), type: String(r.type), why: String(eff.why) }); out.unread = true; continue; }
      const end = new Date(Date.parse(`${eff.day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      if (out.to === null || end < out.to) out.to = end;
      out.bound_by.push({ relation: r.relation_id, type: r.type, effective: eff.day });
    }
    return out;
  }

  /* R20: one version against a date: civil-time.validAt over its period, then a codifier copy's lag. */
  #versionAt(row, date, viewer) {
    const v = this.#versionAtState(row, date, viewer);
    /* K5178 (R7): a later rule (R38's version basis or an override) that moves the state off `in_force` leaves no record resting it */
    if (v.state !== "in_force" && v.known_through) { const { known_through, ...rest } = v; return rest; }
    return v;
  }

  #versionAtState(row, date, viewer) {
    /* R34: a standard whose text is not held is never a measure, and never in force */
    if ((row.held || "text") !== "text")
      return { state: "undetermined", why: word("standards.why.text_held_measure"),
               period: { from: row.period_from ?? null, to: row.period_to ?? null }, bound_by: [] };
    const v0 = this.#versionAtPeriod(row, date, viewer);
    if (v0.state === "not_in_force") return v0;
    /* R38: a version read from two captures starts in the band between them, never at an enactment date */
    const vb = safeJson(row.version_basis_json);
    if (vb) {
      const zone = this.#zone();
      const after = localDay(vb.after, zone), through = localDay(vb.through, zone);
      if (date < after)
        return { ...v0, state: "not_in_force", why: word("standards.why.version_first_captured", { after: String(after), after_2: String(after) }) };
      if (date < through)
        return { ...v0, state: "undetermined", why: word("standards.why.version_text_changed", { after: String(after), through: String(through), date: String(date) }) };
    }
    /* R38: a portion another held standard overrides on the date */
    const ov = this.#overriddenAt(row, date, viewer);
    if (ov) return { ...v0, ...ov };
    return v0;
  }

  /* R38: the override in force on `date` over this version's portion, as `{state, why, overridden_by}`, or null. An
     override whose `until` event has no day, or a revision whose order against the date is not decided, answers
     undetermined, never in force. */
  #overriddenAt(row, date, viewer) {
    if (!row.portion_path) return null;
    const os = this.#rows(`SELECT o.standard_id, o.until_json, s.instrument, s.portion_path FROM standard_overrides o
                           JOIN standards s ON s.standard_id = o.standard_id
                           WHERE o.target=? AND o.portion=? ORDER BY o.standard_id`, row.standard_id, row.portion_path);
    for (const o of os) {
      const by = this.#row(o.standard_id);
      if (!by || (viewer !== null && !this.#sightAdmits(by, viewer))) continue;
      const own = this.#versionAtPeriod(by, date, viewer);
      if (own.state === "not_in_force") continue;
      const u = safeJson(o.until_json) || {};
      let until = null, why = null;
      if (u.event) { const d = this.#eventDay(u.event, "start", viewer); until = d.day; why = d.why; }
      else if (u.revision) {
        const next = by.instrument ? this.#one(`SELECT period_from FROM standards WHERE instrument=? AND supersedes=?`,
                                               by.instrument, by.standard_id) : null;
        until = next ? next.period_from ?? null : undefined;
        if (until === null) why = word("standards.why.revision_ends_states");
      }
      const overriding = { overridden_by: { standard: by.standard_id, portion: by.portion_path ?? null } };
      if (until === null || own.state === "undetermined")
        return { state: "undetermined", ...overriding,
                 why: (why || own.why) && typeof (why || own.why) === "object" ? (why || own.why)
                   : word("standards.why.overrides_portion_whether", { standard_id: String(by.standard_id), why: String(why || own.why), date: String(date) }) };
      if (until === undefined || date < until)
        return { state: "overridden", ...overriding,
                 why: word("standards.why.displaces_portion", { standard_id: String(by.standard_id), portion_path: String(by.portion_path ? ` (${by.portion_path})` : ""), date: String(date), until: String(until ? `, until ${until}` : ", until its own key's next revision") }) };
    }
    return null;
  }

  #versionAtPeriod(row, date, viewer) {
    const p = this.#periodOf(row, viewer);
    const zone = this.#zone();
    const bound = (side) => (p[side] !== null ? p[side] : p.why[side] ? { event: "unread", edge: side } : null);
    let v;
    try {
      v = validAt({ valid: { from: bound("from"), to: p.unread && p.to === null ? { event: "unread", edge: "to" } : bound("to"),
                             precision: "day", zone } }, { value: date, precision: "day", zone });
    } catch { v = { undetermined: true, why: word("standards.why.period_read") }; }
    const by = p.bound_by.length ? ` (bounded by ${p.bound_by.map((b) => `${b.relation}, which ${b.type.replace(/s$/, "s")} it `
                                                     + `effective ${b.effective}`).join("; ")})` : "";
    let state, why;
    if (v === "out") {
      state = "not_in_force";
      why = p.from !== null && date < p.from ? word("standards.period_force_starts", { from: String(p.from), date: String(date), by: String(by) })
        : word("standards.period_force_ended", { to: String(p.to), date: String(date), by: String(by) });
    } else if (v === "in") {
      state = "in_force"; why = word("standards.why.lies_within_period_force", { date: String(date), from: String(p.from), to: String(p.to), by: String(by) });
    } else {
      state = "undetermined";
      const missing = [p.from === null ? p.why.from || word("standards.came_force") : null,
                       p.to === null ? p.why.to || word("standards.ceased_force") : null].filter(Boolean);
      /* K3992: a bound's reason from events or civil-time, keyed, is passed on as given */
      const keyed = missing.find((x) => typeof x === "object");
      why = keyed ? keyed
        : missing.length && !p.why.from && !p.why.to
        ? word("standards.why.record_state_whether", { missing: String(missing.join(" or ")), date: String(date) })
        : missing.length ? word("standards.whether_force_undetermined", { missing: String(missing.join("; ")), date: String(date) })
        : (v && v.why) || word("standards.whether_it_was_in_force", { date: String(date) });
    }
    /* R51: a version whose end is not stated (a null `to`, or an end event with no when), known in force through a date
       by a member's standing record (R50): a date within {from, to: through} is in force, naming the record; any other
       date answers as before. An end a relation states but whose effective date is not read stays as it is. A stated
       end decides as before, the record answered beside it. */
    const known = this.#throughOf(row.standard_id);
    let restsOnRecord = false;
    if (known && state === "undetermined" && p.to === null && !p.unread) {
      let k;
      try {
        k = validAt({ valid: { from: bound("from"), to: known.through, precision: "day", zone } }, { value: date, precision: "day", zone });
      } catch { k = null; }
      if (k === "in") { state = "in_force"; why = known.says; restsOnRecord = true; }
    }
    /* codifier lag (`measures-T33/time-law.md` §4): a codifier's copy speaks only through its current-through date */
    if (state !== "not_in_force" && row.copy === "codifier" && row.current_through && date > row.current_through) {
      const later = row.instrument ? this.#one(`SELECT standard_id FROM standards WHERE instrument=? AND standard_id<>?
                                                 AND period_from IS NOT NULL AND period_from > ? LIMIT 1`,
                                               row.instrument, row.standard_id, row.current_through) : null;
      if (!later) { state = "undetermined"; why = word("standards.why.versions_held_copy", { current_through: String(row.current_through), current_through_2: String(row.current_through), date: String(date) }); }
    }
    /* K5178 (R7): `known_through` only where the answer rests on the R50 record, the record's own fields for a screen to draw */
    return { state, why, period: { from: p.from, to: p.to }, bound_by: p.bound_by, ...(known ? { in_force_through: known } : {}),
             ...(known && restsOnRecord && state === "in_force" ? { known_through: known.ref } : {}) };
  }

  /* R51: the latest `through` among a version's standing records (R50), with its source, author and the words naming it;
     null when none stands. */
  #throughOf(standardId) {
    const r = this.#one(`SELECT t.* FROM standard_in_force_through t WHERE t.standard_id=? AND NOT EXISTS
                           (SELECT 1 FROM standard_in_force_through_withdrawals w WHERE w.record_id=t.record_id)
                         ORDER BY t.through DESC, t.record_id DESC LIMIT 1`, standardId);
    if (!r) return null;
    const source = sourceWords(r.capture_sha, safeJson(r.extent_json));
    return { record: r.record_id, through: r.through, source, by: r.author,
             ref: { through: r.through, source: { captureSha: r.capture_sha, extent: safeJson(r.extent_json) }, by: r.author },
             says: inForceKnownWords({ through: r.through, source, author: String(r.author ?? "").replace(/^member:/, "") }) };
  }

  /** R20: `inForceAt({key | standard, portion?, date, viewer?})` → `{state, why, standard, version}`. With a standard,
   *  that version; with a key, the version whose period covers the date, two that both cover it or none deciding it
   *  answering undetermined naming them (never the later one preferred). Writes nothing and never throws. */
  inForceAt({ key = null, standard = null, portion = null, date = null, viewer = null } = {}) {
    try {
      if (!str(key) && !str(standard)) return refuseNoId("inforceat");
      if (!isDate(date)) return refuseDateInvalid(date);
      if (str(standard)) {
        const row = this.#row(str(standard));
        if (!row || (viewer !== null && !this.#readable(row.standard_id, viewer))) return refuseNoSuchStandard(str(standard));
        const v = this.#versionAt(row, date, viewer);
        return { ok: true, date, state: v.state, why: v.why, standard: row.standard_id,
                 version: { standard: row.standard_id, ...v.period, bound_by: v.bound_by },
                 ...(v.overridden_by ? { overridden_by: v.overridden_by } : {}),
                 ...(v.in_force_through ? { in_force_through: v.in_force_through } : {}),
                 ...(v.known_through ? { known_through: v.known_through } : {}) };
      }
      const p = portion == null || portion === "" ? null : String(portion);
      const rows = this.#rows(`SELECT * FROM standards WHERE instrument=? ${p !== null ? "AND portion_path=?" : ""}
                               ORDER BY standard_id LIMIT ?`, ...(p !== null ? [str(key), p] : [str(key)]), PAGE_MAX + 1)
        .filter((r) => viewer === null || this.#readable(r.standard_id, viewer));
      const base = { ok: true, date, key: str(key), portion: p };
      if (!rows.length)
        return { ...base, state: "undetermined", standard: null, version: null,
                 why: word("standards.why.version_held_whether", { key: String(str(key)), item: String(p !== null ? ` at ${p}` : "") }) };
      const vs = rows.slice(0, PAGE_MAX).map((r) => ({ id: r.standard_id, ...this.#versionAt(r, date, viewer) }));
      const inn = vs.filter((v) => v.state === "in_force" || v.state === "overridden"), unsure = vs.filter((v) => v.state === "undetermined");
      if (inn.length === 1 && !unsure.length)
        return { ...base, state: inn[0].state, why: inn[0].why, standard: inn[0].id, version: { standard: inn[0].id, ...inn[0].period },
                 ...(inn[0].overridden_by ? { overridden_by: inn[0].overridden_by } : {}),
                 ...(inn[0].in_force_through ? { in_force_through: inn[0].in_force_through } : {}),
                 ...(inn[0].known_through ? { known_through: inn[0].known_through } : {}) };
      if (inn.length > 1)
        return { ...base, state: "undetermined", standard: null, version: null, versions: inn.map((v) => v.id),
                 why: word("standards.why.cover_none_preferred", { inn: String(inn.map((v) => v.id).join(" and ")), date: String(date) }) };
      if (unsure.length)
        return { ...base, state: "undetermined", standard: null, version: null, versions: [...inn, ...unsure].map((v) => v.id),
                 why: word("standards.why.held_version_decides", { date: String(date), unsure: String(unsure.map((v) => `${v.id}: ${v.why}`).join("; ")) }) };
      return { ...base, state: "not_in_force", standard: null, version: null, versions: vs.map((v) => v.id),
               why: word("standards.why.held_version_period", { date: String(date), vs: String(vs.map((v) => `${v.id}: ${v.why}`).join("; ")) }),
               ...(rows.length > PAGE_MAX ? { truncated: true } : {}) };
    } catch {
      return { ok: true, date, state: "undetermined", standard: null, version: null, why: word("standards.why.versions_read") };
    }
  }

  /** R8: the standards the filters admit, in id order, at most `PAGE_MAX` per page; with `at`, each with R7's answer
   *  and the ones not in force left out. The stated period filters in SQL (a superset: a stated bound that excludes
   *  the date excludes it in R7 too), then R7 (with its relations and event bounds) is asked of each row, reading on
   *  until the page and the row past it are found, so the page and its cut are exact. */
  standardsIn({ at = null, kind = null, source = null, cite = null, family = null, after = null, limit = null,
                viewer = null } = {}) {
    const date = at == null || at === "" ? null : at;
    if (date !== null && !isDate(date)) return refuseDateInvalid(date);
    if (kind != null && kind !== "" && !STANDARD_KINDS.includes(kind)) return refuseKindUnknown(kind);
    const n = Number.isInteger(Number(limit)) && limit !== null && limit !== "" ? Math.min(PAGE_MAX, Math.max(1, Number(limit)))
      : PAGE_MAX;
    const gate = viewerPredicate(viewer);
    const where = [`(${gate.sql})`], args = [...gate.args];
    if (kind) { where.push("s.kind=?"); args.push(kind); }
    if (str(source) === "undetermined") where.push(`json_extract(s.source_json, '$.state')='undetermined'`);
    else if (str(source)) { where.push(`json_extract(s.source_json, '$.source')=?`); args.push(str(source)); }
    if (str(cite)) { where.push("instr(lower(s.cite), lower(?)) > 0"); args.push(str(cite)); }
    /* R33: a family filter, by its key (`familyKey`) or {key, series} */
    const fk = isObj(family) ? familyKey(family) : str(family) || null;
    if (family != null && family !== "") { where.push("s.family_key=?"); args.push(fk ?? ""); }
    if (date) { where.push("NOT ((s.period_from IS NOT NULL AND s.period_from > ?) OR (s.period_to IS NOT NULL AND s.period_to < ?))");
                args.push(date, date); }
    const kept = [];
    let cursor = str(after) || null;
    for (;;) {
      const page = this.#rows(`SELECT s.* FROM standards s JOIN bundles b ON b.bundle_id = s.standard_id
                                WHERE ${[...where, ...(cursor ? ["s.standard_id > ?"] : [])].join(" AND ")}
                                ORDER BY s.standard_id LIMIT ?`, ...args, ...(cursor ? [cursor] : []), n + 1);
      for (const r of page) {
        if (!this.#sightAdmits(r, viewer)) continue;
        const f = date ? this.#versionAt(r, date, viewer) : null;
        if (f && f.state === "not_in_force") continue;
        kept.push({ r, f });
        if (kept.length > n) break;
      }
      if (kept.length > n || page.length < n + 1) break;
      cursor = page[page.length - 1].standard_id;
    }
    const truncated = kept.length > n;
    const page = kept.slice(0, n);
    const items = page.map(({ r, f }) => ({ ...this.#answer(r, viewer), ...(f ? { in_force: { state: f.state, why: f.why } } : {}) }));
    return { ok: true, items, count: items.length, limit: n, truncated,
             cursor: truncated ? page[page.length - 1].r.standard_id : null,
             ...(date ? { at: date, says: word("standards.says.standards_force_period", { date: String(date) }) }
                      : {}) };
  }

  /* ===================================================================== *
   * R32: READS BY KEY AND PORTION, AND BY A PORTION'S CONTENT ID (N590)
   * ===================================================================== */

  /** R32: the held standards whose instrument key is `key` (its versions), with `portion` only those recording that
   *  portion path. `{ok, items, truncated}`, in id order, at most `PAGE_MAX`; a viewer naming no member reads none; a
   *  blank key answers none. Writes nothing. */
  standardsAt({ key = null, portion = null, viewer = null } = {}) {
    const k = str(key);
    if (!k) return { ok: true, items: [], truncated: false };
    const p = portion == null || portion === "" ? null : String(portion);
    return this.#versionsWhere(p === null ? "s.instrument=?" : "s.instrument=? AND s.portion_path=?",
                               p === null ? [k] : [k, p], viewer);
  }

  /** R32: the held standards whose portion's content id is `contentId`, as `standardsAt` answers them. */
  standardsWithPortion({ contentId = null, viewer = null } = {}) {
    const c = str(contentId);
    if (!c) return { ok: true, items: [], truncated: false };
    return this.#versionsWhere("s.portion_content=?", [c], viewer);
  }

  /* R32's one read: the rows the condition admits that the viewer may read (R8's gate), one past the cap. */
  #versionsWhere(cond, args, viewer) {
    const gate = viewerPredicate(viewer);
    const rows = this.#rows(`SELECT s.* FROM standards s JOIN bundles b ON b.bundle_id = s.standard_id
                             WHERE (${gate.sql}) AND ${cond} ORDER BY s.standard_id`,
                            ...gate.args, ...args).filter((r) => this.#sightAdmits(r, viewer)).slice(0, PAGE_MAX + 1);
    const items = rows.slice(0, PAGE_MAX).map((r) => ({
      id: r.standard_id, instrument: r.instrument ?? null,
      portion: r.portion_path ? { path: r.portion_path, content_id: r.portion_content } : null,
      period: { from: r.period_from ?? null, to: r.period_to ?? null },
      supersedes: r.supersedes ?? null, superseded_by: this.#successorOf(r.standard_id),
      family: safeJson(r.family_json), says: this.#t35Answer(r, viewer).says }));
    return { ok: true, items, truncated: rows.length > PAGE_MAX };
  }

  /* ===================================================================== *
   * R21: THE REVERSE INDEX (LAW N4)
   * ===================================================================== */

  /** R21: `standardsFor({target, limit, viewer})`: for a held standard, or an instrument key (`/eli/…`, or `{key,
   *  portion?}`), every document whose reading cites it (a reference `extraction` holds whose recognised key or cite
   *  matches, by R3's patterns); for a document (a bundle id or a capture digest), the held standards its readings
   *  cite. Each item says how it matched. A document the viewer may not see is neither answered nor counted. Reads
   *  `extraction`'s `reading_refs` under its read contract (R58 there). Writes nothing and never throws. */
  standardsFor({ target = null, limit = null, viewer = null } = {}) {
    const n = Number.isInteger(Number(limit)) && limit !== null && limit !== ""
      ? Math.min(FOR_LIMIT_MAX, Math.max(1, Number(limit))) : FOR_LIMIT_DEFAULT;
    const t = isObj(target) ? str(target.key) : str(target);
    if (!t) return refuseNoId("standardsfor");
    try {
      const { view } = this.#view();
      const row = this.#row(t);
      if (row || t.startsWith("/eli/")) {
        if (row && !this.#readable(row.standard_id, viewer)) return refuseNoSuchStandard(t);
        const key = row ? row.instrument ?? null : t;
        const cite = row ? foldCite(row.cite) : null;
        /* a prefilter, a superset of what matches: the key's number, else the cite's last word */
        const probe = key ? key.slice(key.lastIndexOf("/") + 1) : cite.split(" ").pop();
        const refs = this.#rows(`SELECT DISTINCT capture_sha, bundle_id, ref, ref_kind, ref_key, label FROM reading_refs
                                 WHERE instr(lower(coalesce(label,'') || ' ' || coalesce(ref_key,'') || ' ' || ref), lower(?)) > 0
                                 ORDER BY capture_sha, ref LIMIT ?`, probe, SCAN_FOR);
        const docs = new Map();
        for (const r of refs) {
          const rk = key ? referenceKey(view, r) : null;
          const how = rk && rk.key === key ? rk.how
            : cite && [r.label, r.ref_key, r.ref].some((x) => typeof x === "string" && foldCite(x) === cite) ? "cite" : null;
          if (!how) continue;
          if (!docs.has(r.capture_sha)) {
            if (!this.membership.inSight(r.bundle_id, viewer)) continue;
            if (docs.size > n) break;
            docs.set(r.capture_sha, { capture_sha: r.capture_sha, bundle_id: r.bundle_id, references: [] });
          }
          docs.get(r.capture_sha).references.push({ ref: r.ref, label: r.label ?? null, how });
        }
        const items = [...docs.values()].slice(0, n);
        return { ok: true, target: t, of: row ? "standard" : "instrument", key, items, count: items.length, limit: n,
                 truncated: docs.size > n || refs.length >= SCAN_FOR,
                 says: localize("standards.index.documents_cite_it_as_stated", "documents whose readings cite it, as the readings state their references; a document you may not see is neither answered nor counted") };
      }
      const byCapture = /^[0-9a-f]{64}$/.test(t);
      const refs = this.#rows(`SELECT DISTINCT capture_sha, bundle_id, ref, ref_kind, ref_key, label FROM reading_refs
                               WHERE ${byCapture ? "capture_sha" : "bundle_id"}=? ORDER BY ref LIMIT ?`, t, SCAN_FOR);
      const visible = refs.filter((r) => this.membership.inSight(r.bundle_id, viewer));
      const found = new Map();
      for (const r of visible) {
        const rk = referenceKey(view, r);
        const byKey = rk ? this.#rows(`SELECT standard_id FROM standards WHERE instrument=? ORDER BY standard_id LIMIT ?`,
                                      rk.key, n + 1).map((x) => [x.standard_id, rk.how]) : [];
        const byCite = [r.label, r.ref_key].filter((x) => typeof x === "string" && x.trim()).flatMap((x) =>
          this.#rows(`SELECT standard_id FROM standards WHERE lower(cite)=? ORDER BY standard_id LIMIT ?`, foldCite(x), n + 1)
            .map((y) => [y.standard_id, "cite"]));
        for (const [sid, how] of [...byKey, ...byCite]) {
          if (!found.has(sid)) found.set(sid, { standard: sid, references: [] });
          const e = found.get(sid);
          if (!e.references.some((x) => x.ref === r.ref && x.how === how)) e.references.push({ ref: r.ref, label: r.label ?? null, how });
        }
      }
      const all = [...found.values()].sort((a, b) => (a.standard < b.standard ? -1 : 1));
      const items = all.slice(0, n).map((e) => ({ ...e, cite: this.#row(e.standard).cite }));
      return { ok: true, target: t, of: "document", items, count: items.length, limit: n,
               truncated: all.length > n || refs.length >= SCAN_FOR,
               says: visible.length || !refs.length ? word("standards.says.held_standards_document")
                 : word("standards.says.document_see_answers") };
    } catch {
      return { ok: true, target: t, items: [], count: 0, limit: n, truncated: false,
               undetermined: { why: word("standards.why.readings_references_read") } };
    }
  }

  /* ===================================================================== *
   * R48: LAW RELATIONS, COURT LINKS, TREATMENTS, THE RESOLVER, THE OWNER'S READ (`law-relations`, delegated)
   * ===================================================================== */

  lawRelate(args) { return this.#law.lawRelate(args); }
  lawRelationsOf(args) { return this.#law.lawRelationsOf(args); }
  lawWithdraw(args) { return this.#law.lawWithdraw(args); }
  lawPropose(args) { return this.#law.lawPropose(args); }
  courtLink(args) { return this.#law.courtLink(args); }
  courtTreat(args) { return this.#law.courtTreat(args); }
  stillStanding(args) { return this.#law.stillStanding(args); }
  addressesOf(args) { return this.#law.addressesOf(args); }
  resolveCourtCitation(args) { return this.#law.resolveCourtCitation(args); }
  neighbours(args) { return this.#law.neighbours(args); }

  /* ===================================================================== *
   * T35: MEASURES, FORCES, SIGHT, ADOPTIONS AND BINDING (R34, R35, R37, R38, R40, R43)
   * ===================================================================== */

  /** R34: true only for a standard held `text` that the viewer may read; a later module that judges an act against a
   *  standard asks this first. Writes nothing and never throws. */
  isMeasure(id, viewer = null) {
    try {
      const row = this.#row(str(id));
      /* a caller naming no viewer is internal, and asks of the record as a whole (membership's terms) */
      return !!row && (row.held || "text") === "text" && (viewer === null || this.#readable(row.standard_id, viewer));
    } catch { return false; }
  }

  /* R35: a provision's force, checked in R35's order after the author; `{ok: true, fields}` or a refusal. */
  #forceRefusal(a) {
    const viewer = a.viewer ?? null;
    const sid = str(a.standard);
    const row = this.#row(sid);
    if (!row || !this.#readable(sid, viewer ?? INTERNAL_READER)) return noSuchStandard(sid || null, { id: sid || null });
    if ((row.held || "text") !== "text") return refuseTextNotHeld(sid, row.held);
    if (!isPortionPath(a.portion) || (row.portion_path && a.portion.trim() !== row.portion_path))
      return portionUnknown(sid, a.portion);
    const portion = a.portion.trim();
    const allowed = row.kind === "policy" ? [...FORCES, ...POLICY_FORCES] : [...FORCES];
    /* DEC-49 REGION is-force-known */
    if (!allowed.includes(a.force))
      return refusal("FORCE_UNKNOWN", `a ${row.kind}'s provision's force is one of ${allowed.join(", ")}. Nothing was written.`,
                     { forces: allowed, kind: row.kind });
    /* END DEC-49 REGION is-force-known */
    let holder = null, criteria = null;
    if (a.force === "discretionary") {
      holder = str(a.holder);
      /* DEC-49 REGION is-force-holder */
      if (!holder || !this.#entity(holder, viewer))
        return refusal("FORCE_NO_HOLDER", "a discretion names the office or body holding it, a registered entity you may "
                       + "read. Nothing was written.", { holder: holder ? holder.slice(0, 80) : null });
      /* END DEC-49 REGION is-force-holder */
      const texts = this.#texts(sid);
      criteria = a.criteria === "none" ? "none" : typeof a.criteria === "string" && texts.includes(a.criteria.trim())
        ? a.criteria.trim() : null;
      /* DEC-49 REGION is-force-criteria */
      if (criteria === null)
        return refusal("FORCE_NO_CRITERIA", "a discretion names the passage of the standard's text stating its criteria, "
                       + "or \"none\", read \"no criteria stated\". Nothing was written.");
      /* END DEC-49 REGION is-force-criteria */
    }
    const citation = typeof a.citation === "string" ? a.citation.trim() : "";
    /* DEC-49 REGION is-force-cited */
    if (!citation)
      return refusal("FORCE_NO_CITATION", "a provision's force is recorded with the content id of the provision's own "
                     + "words that state it. Nothing was written.");
    /* END DEC-49 REGION is-force-cited */
    if (!this.#texts(sid).includes(citation))
      return refusal("STANDARD_PORTION_NOT_IN_TEXT", localize("standards.index.citation_is_not_one_of", "{citation} is not one of this standard's text passages. Nothing was written.", { citation: String(citation.slice(0, 80)) }), { content_id: citation.slice(0, 80) });
    return { ok: true, fields: { standard: sid, portion, force: a.force, holder, criteria, citation } };
  }

  /* R35: a confirmed force held on the provision, not withdrawn, or null. */
  #confirmedForce(standard, portion) {
    return this.#one(`SELECT f.* FROM standard_forces f WHERE f.standard_id=? AND f.portion=? AND NOT EXISTS
                        (SELECT 1 FROM standard_force_withdrawals w WHERE w.force_id=f.force_id) ORDER BY f.at LIMIT 1`,
                     standard, portion);
  }

  /** R35: `forceDeclare` (`op=standardforce`): the force of one provision, by a member's act, citing the provision's own
   *  words. At most one confirmed force a provision; a correction withdraws it first. */
  forceDeclare(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, FORCE_KEYS);
    if (unknown) return unknown;
    return this.#forceWrite(a, null);
  }

  #forceWrite(a, proposalId) {
    const r = this.#forceRefusal(a);
    if (r.ok === false) return r;
    const f = r.fields;
    const held = this.#confirmedForce(f.standard, f.portion);
    /* DEC-49 REGION is-force-once */
    if (held)
      return refusal("FORCE_ALREADY_CONFIRMED", `${f.standard} at ${f.portion} already holds the confirmed force ${held.force} `
                     + `(${held.force_id}); withdraw it with a reason first. Nothing was written.`,
                     { force_id: held.force_id, force: held.force });
    /* END DEC-49 REGION is-force-once */
    const fault = reasonFault(a.reason);
    if (fault) return refuseReason(fault);
    return this.record.transact(() => {
      const at = this.#when();
      const id = `force-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_forces (force_id, standard_id, portion, force, holder, criteria, citation, proposal_id,
                       reason, author, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, id, f.standard, f.portion, f.force, f.holder,
                    f.criteria, f.citation, proposalId, a.reason, str(a.author), at);
      return { ok: true, force: this.#forceAnswer(this.#one(`SELECT * FROM standard_forces WHERE force_id=?`, id), a.viewer ?? null) };
    });
  }

  #forceAnswer(f, viewer) {
    const w = this.#one(`SELECT * FROM standard_force_withdrawals WHERE force_id=?`, f.force_id);
    const holder = f.holder ? this.#entity(f.holder, viewer) : null;
    let words = null;
    try { words = this.content.passageText(f.citation); } catch { words = null; }
    const row = this.#row(f.standard_id);
    if (row && (row.access === "reading_room" || row.access === "paywalled") && !isMemberViewer(viewer)) words = null;
    return { id: f.force_id, standard: f.standard_id, portion: f.portion, force: f.force, holder: f.holder ?? null,
             holder_label: holder ? holder.label : null, criteria: f.criteria ?? null, citation: f.citation,
             reason: f.reason, by: f.author, at: f.at, proposal: f.proposal_id ?? null,
             withdrawn: w ? { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } : null,
             says: forceWords({ force: f.force, holderLabel: holder ? holder.label : f.holder, criteria: f.criteria, words }) };
  }

  /** R35: a proposed force, stored apart, labelled through `proposalLabel(proposer, "standard")`, R9's way; never a
   *  force until a member confirms it. */
  forcePropose(args = {}) {
    const a = isObj(args) ? args : {};
    const unknown = refuseFieldUnknown(a, FORCE_PROPOSE_KEYS);
    if (unknown) return unknown;
    const who = str(a.proposer);
    if (!who) return refuseProposerUnnamed();
    const why = str(a.why);
    if (!why || why.length > WHY_MAX) return refuseWhyInvalid();
    const r = this.#forceRefusal({ ...a, viewer: a.viewer ?? null });
    if (r.ok === false) return r;
    return this.record.transact(() => {
      const at = this.#when();
      const id = `fprop-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_force_proposals (proposal_id, standard_id, fields_json, why, proposed_by, proposed_at)
                     VALUES (?,?,?,?,?,?)`, id, r.fields.standard, JSON.stringify(r.fields), why, who, at);
      return { ok: true, proposal: this.#forceProposalAnswer(this.#one(`SELECT * FROM standard_force_proposals WHERE proposal_id=?`, id)),
               force: false, says: localize("standards.index.proposed_force_moves_no_answer", "this is a proposed force and not a force: it moves no answer until a member confirms it naming this proposal") };
    });
  }

  #forceProposalAnswer(p) {
    const adopted = this.#one(`SELECT force_id FROM standard_forces WHERE proposal_id=?`, p.proposal_id);
    return { id: p.proposal_id, ...safeJson(p.fields_json), why: p.why, at: p.proposed_at,
             ...proposalLabel(p.proposed_by, STANDARD), confirmed_as: adopted ? adopted.force_id : null };
  }

  /** R35: `forceConfirm` is `forceDeclare` by a member naming the proposal, refused as it is. */
  forceConfirm(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, ["proposal", "reason", "author", "viewer"]);
    if (unknown) return unknown;
    const p = typeof a.proposal === "string" && a.proposal
      ? this.#one(`SELECT * FROM standard_force_proposals WHERE proposal_id=?`, a.proposal) : null;
    if (!p) return refuseNoSuchProposal(str(a.proposal) || null);
    const done = this.#one(`SELECT force_id FROM standard_forces WHERE proposal_id=?`, p.proposal_id);
    if (done) return refuseProposalAdopted(p.proposal_id, done.force_id);
    return this.#forceWrite({ ...safeJson(p.fields_json), reason: a.reason, author: a.author, viewer: a.viewer ?? null },
                            p.proposal_id);
  }

  /** R35: withdraw a confirmed force, kept with who, when and why. */
  forceWithdraw({ force = null, reason = null, author = null, viewer = null } = {}) {
    const byMachine = machineRefusal(author);
    if (byMachine) return byMachine;
    const f = typeof force === "string" && force ? this.#one(`SELECT * FROM standard_forces WHERE force_id=?`, force) : null;
    /* DEC-49 REGION is-force-held */
    if (!f || (viewer !== null && !this.#readable(f.standard_id, viewer)))
      return refusal("NO_SUCH_FORCE", "no confirmed force answers to that id here. Nothing was written.",
                     { force: str(force) || null });
    /* END DEC-49 REGION is-force-held */
    const fault = reasonFault(reason);
    if (fault) return refuseReason(fault);
    const w = this.#one(`SELECT * FROM standard_force_withdrawals WHERE force_id=?`, f.force_id);
    if (w) return { ok: true, already: true, force: f.force_id, withdrawn: { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } };
    return this.record.transact(() => {
      const at = this.#when();
      this.sql.exec(`INSERT INTO standard_force_withdrawals (force_id, standard_id, reason, withdrawn_by, withdrawn_at)
                     VALUES (?,?,?,?,?)`, f.force_id, f.standard_id, reason, str(author), at);
      return { ok: true, force: f.force_id, withdrawn: { by: str(author), at, reason },
               says: word("standards.says.withdrawn_deleted_row") };
    });
  }

  /** R35: each portion's confirmed force with its citation, holder and criteria, and its proposals apart, labelled. */
  forcesOf({ standard = null, viewer = null } = {}) {
    const sid = str(standard);
    if (!sid) return refuseNoId("forcesof");
    if (!this.#row(sid) || !this.#readable(sid, viewer)) return refuseNoSuchStandard(sid);
    const all = this.#rows(`SELECT * FROM standard_forces WHERE standard_id=? ORDER BY portion, at, force_id`, sid)
      .map((f) => this.#forceAnswer(f, viewer));
    return { ok: true, standard: sid, forces: all.filter((f) => !f.withdrawn), withdrawn: all.filter((f) => f.withdrawn),
             proposals: this.#rows(`SELECT * FROM standard_force_proposals WHERE standard_id=? ORDER BY proposal_id`, sid)
               .map((p) => this.#forceProposalAnswer(p)),
             says: { ...this.#t35Answer(this.#row(sid), viewer).says,
                     note: localize("standards.index.force_read_from_provision_words", "a force is read from the provision's own words and confirmed by a member; a proposal moves nothing") } };
  }

  /** R37: `releaseStandard` (`op=standardrelease`): an owner of the source's project moves a policy held at its source's
   *  sight to the group's, from then on, never undone. */
  releaseStandard({ standard = null, reason = null, author = null, viewer = null } = {}) {
    const byMachine = machineRefusal(author);
    if (byMachine) return byMachine;
    const sid = str(standard);
    const row = this.#row(sid);
    if (!row || !this.#readable(sid, viewer ?? str(author))) return refuseNoSuchStandard(sid || null);
    const s = this.#sight(row);
    /* DEC-49 REGION is-held-from-source */
    if (s.class !== "bundle" || s.released)
      return refusal("NOT_HELD_FROM_SOURCE", localize("standards.index.sid_is_v1_seen_by", "{sid} is {v1}seen by every member of your team. Nothing was written.", { sid: String(sid), v1: String(s.released ? "already released and " : "") }), { standard: sid });
    /* END DEC-49 REGION is-held-from-source */
    const who = str(author).replace(/^member:/, "");
    const owners = this.#releaseBy(s);
    /* DEC-49 REGION is-release-owner */
    if (!owners.length || !owners.every((p) => p.owners.includes(who)))
      return refusal("RELEASE_NOT_OWNER", localize("standards.index.only_an_owner_of_the", "only an owner of the project its source material is filed in may release it. Nothing was written."), { release_by: owners });
    /* END DEC-49 REGION is-release-owner */
    const fault = reasonFault(reason);
    if (fault) return refuseReason(fault);
    return this.record.transact(() => {
      const at = this.#when();
      this.sql.exec(`INSERT INTO standard_releases (standard_id, reason, released_by, released_at) VALUES (?,?,?,?)`,
                    sid, reason, str(author), at);
      return { ok: true, standard: sid, released: { by: str(author), at, reason },
               says: word("standards.says.released_member_group") };
    });
  }

  /** R38: the overrides naming or made by a standard. */
  overridesOf({ standard = null, viewer = null } = {}) {
    const sid = str(standard);
    if (!sid) return refuseNoId("overridesof");
    if (!this.#row(sid) || !this.#readable(sid, viewer)) return refuseNoSuchStandard(sid);
    const made = this.#overridesBy(sid);
    const naming = this.#rows(`SELECT standard_id, target, portion, until_json FROM standard_overrides WHERE target=?
                               ORDER BY standard_id, ord`, sid)
      .filter((o) => this.#readable(o.standard_id, viewer))
      .map((o) => ({ by: o.standard_id, portion: o.portion, until: safeJson(o.until_json) }));
    return { ok: true, standard: sid, makes: made, overridden_by: naming };
  }

  /** R40: `adoptionRecord` (`op=standardadoption`): by a member's act, that a body adopted an edition of a held standard,
   *  named by the act that adopted it and the act's passage stating it. */
  adoptionRecord(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRelate(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, ADOPTION_KEYS);
    if (unknown) return unknown;
    const viewer = a.viewer ?? null;
    const sid = str(a.standard);
    if (!this.#row(sid) || !this.#readable(sid, viewer ?? str(a.author))) return noSuchStandard(sid || null, { id: sid || null, end: "standard" });
    const act = str(a.act);
    const actRow = /^EVT-/.test(act) ? null : this.#row(act);
    const actEvent = /^EVT-/.test(act) ? this.#eventDay(act, "start", viewer) : null;
    if (!actRow && !(actEvent && (actEvent.day || !/not held/.test(actEvent.why || ""))))
      return noSuchStandard(act || null, { id: act || null, end: "act" });
    if (actRow && !this.#readable(act, viewer ?? str(a.author))) return noSuchStandard(act, { id: act, end: "act" });
    /* DEC-49 REGION is-adoption-mode */
    if (!ADOPTION_MODES.includes(a.mode))
      return refusal("ADOPTION_MODE_UNKNOWN", `an adoption is ${ADOPTION_MODES.join(", ")}. Nothing was written.`,
                     { modes: [...ADOPTION_MODES] });
    /* END DEC-49 REGION is-adoption-mode */
    const edition = typeof a.edition === "string" ? a.edition.trim() : "";
    /* DEC-49 REGION is-adoption-edition */
    if (!edition || [...edition].length > EDITION_MAX)
      return refusal("ADOPTION_NO_EDITION", localize("standards.index.an_adoption_names_the_edition", "an adoption names the edition adopted, at most {EDITION_MAX} characters. Nothing was written.", { EDITION_MAX: String(EDITION_MAX) }), { max: EDITION_MAX });
    /* END DEC-49 REGION is-adoption-edition */
    const citation = typeof a.citation === "string" ? a.citation.trim() : "";
    /* DEC-49 REGION is-adoption-cited */
    if (!citation || (actRow ? !this.#texts(act).includes(citation) : !this.#heldFor(citation, viewer)))
      return refusal("ADOPTION_NO_CITATION", "an adoption names the passage of the adopting act stating it. Nothing was "
                     + "written.", { citation: citation.slice(0, 80) || null });
    /* END DEC-49 REGION is-adoption-cited */
    const from = isDate(a.from) ? { date: a.from }
      : isObj(a.from) && typeof a.from.event === "string" && /^EVT-/.test(a.from.event) && isRecordId(a.from.event)
        && (a.from.edge === "start" || a.from.edge === "end") ? { event: a.from.event, edge: a.from.edge } : null;
    if (!from) return refuseFieldInvalid("from", "is a date (YYYY-MM-DD) or an event {event, edge}");
    const amendments = a.amendments == null ? [] : Array.isArray(a.amendments) && a.amendments.every(isPortionPath)
      && a.amendments.length <= TEXTS_MAX ? a.amendments.map((x) => x.trim()) : null;
    if (!amendments) return refuseFieldInvalid("amendments", "is a list of portion paths of the adopting act");
    const fault = reasonFault(a.reason);
    if (fault) return refuseReason(fault);
    const body = actRow ? actRow.issuer_entity ?? actRow.issuer : this.#eventBody(act, viewer);
    return this.record.transact(() => {
      const at = this.#when();
      const id = `adopt-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_body_adoptions (adoption_id, standard_id, act, body, edition, from_json,
                       amendments_json, mode, citation, reason, author, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    id, sid, act, body, edition, JSON.stringify(from), JSON.stringify(amendments), a.mode, citation,
                    a.reason, str(a.author), at);
      return { ok: true, adoption: this.#adoptionAnswer(this.#one(`SELECT * FROM standard_body_adoptions WHERE adoption_id=?`, id)) };
    });
  }

  /* R40: the body that adopted through an event (an act of the body held as an event, `events` R26): the one entity the
     event concerns or has as its decider, the body of a meeting being what the meeting concerns (`events` R22); none,
     or two, answers null and the adoption names no body, never one guessed. */
  #eventBody(eventId, viewer) {
    let r = null;
    try { r = this.events && typeof this.events.readEvent === "function" ? this.events.readEvent({ eventId, viewer: viewer ?? INTERNAL_READER }) : null; }
    catch { r = null; }
    const ev = r && r.ok !== false && r.found !== false ? r.event : null;
    if (!ev) return null;
    const ids = new Set([...(ev.concerns || []).filter((x) => typeof x === "string" && !/^EVT-/.test(x)),
                         ...(ev.participants || []).filter((x) => x.role === "decider" && !x.superseded).map((x) => x.entity_id)]);
    return ids.size === 1 ? [...ids][0] : null;
  }

  #adoptionAnswer(r) {
    return { id: r.adoption_id, standard: r.standard_id, act: r.act, body: r.body ?? null, edition: r.edition,
             from: safeJson(r.from_json), amendments: safeJson(r.amendments_json) || [], mode: r.mode, citation: r.citation,
             reason: r.reason, by: r.author, at: r.at };
  }

  /* R40: an adoption's start as a day, or why there is none. */
  #adoptionFrom(r, viewer) {
    const f = safeJson(r.from_json) || {};
    if (f.date) return { day: f.date };
    return this.#eventDay(f.event, f.edge, viewer);
  }

  /** R40: the edition a body's adoptions put in force on a date: each adoption from its start up to the next one's,
   *  with the adoption it rests on and the lag between the edition's own date, where held, and the adoption's start. */
  editionInForce({ designation = null, standard = null, body = null, date = null, viewer = null } = {}) {
    try {
      if (!isDate(date)) return refuseDateInvalid(date);
      const b = str(body);
      if (!b) return refuseFieldInvalid("body", "names the adopting body");
      let ids;
      if (str(standard)) ids = [str(standard)];
      else if (str(designation))
        ids = this.#rows(`SELECT standard_id FROM standards WHERE designation=? ORDER BY standard_id LIMIT ?`, str(designation),
                         PAGE_MAX).map((r) => r.standard_id);
      else return refuseNoId("editioninforce");
      ids = ids.filter((id) => this.#row(id) && (viewer === null || this.#readable(id, viewer)));
      const rows = ids.length ? this.#rows(`SELECT * FROM standard_body_adoptions WHERE standard_id IN (${ids.map(() => "?").join(",")})
                                            AND body=? ORDER BY adoption_id`, ...ids, b) : [];
      const dated = rows.map((r) => ({ r, from: this.#adoptionFrom(r, viewer) }));
      const unread = dated.filter((d) => !d.from.day);
      const base = { ok: true, body: b, date, designation: str(designation) || null, standard: str(standard) || null };
      if (unread.length)
        return { ...base, state: "undetermined", adoptions: unread.map((d) => d.r.adoption_id),
                 why: word("standards.why.took_effect_read", { unread: String(unread.map((d) => d.r.adoption_id).join(", ")), unread_2: String(unread.map((d) => d.from.why).join("; ")) }) };
      const sorted = dated.sort((x, y) => (x.from.day < y.from.day ? -1 : x.from.day > y.from.day ? 1 : 0));
      const before = sorted.filter((d) => d.from.day <= date);
      if (!before.length)
        return { ...base, state: "undetermined", edition: null, adoptions: [],
                 why: word("standards.why.adoption_held_takes", { second: String(b), date: String(date) }) };
      const lastDay = before[before.length - 1].from.day;
      const deciding = before.filter((d) => d.from.day === lastDay);
      if (deciding.length > 1 && new Set(deciding.map((d) => d.r.edition)).size > 1)
        return { ...base, state: "undetermined", edition: null, adoptions: deciding.map((d) => d.r.adoption_id),
                 why: word("standards.why.take_effect_none", { deciding: String(deciding.map((d) => d.r.adoption_id).join(" and ")), last_day: String(lastDay) }) };
      const d = deciding[0];
      const own = this.#row(d.r.standard_id);
      const editionDate = own && own.period_from ? own.period_from : null;
      const lag = editionDate ? Math.round((Date.parse(`${d.from.day}T00:00:00Z`) - Date.parse(`${editionDate}T00:00:00Z`)) / 86400000) : null;
      return { ...base, state: "in_force", edition: d.r.edition, adoption: this.#adoptionAnswer(d.r),
               lag: lag === null ? { days: null, why: word("standards.why.edition_date_held") }
                                 : { days: lag, edition_from: editionDate, adopted_from: d.from.day },
               why: word("standards.why.adopted_edition_effective", { second: String(b), edition: String(d.r.edition), day: String(d.from.day), adoption_id: String(d.r.adoption_id), date: String(date) }) };
    } catch {
      return { ok: true, state: "undetermined", why: word("filings.why.adoptions_read") };
    }
  }

  /** R43: `impositionRecord`: by a member's act, a held law imposes the standard on a body, citing the law's passage. */
  impositionRecord(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRelate(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, ["standard", "body", "law", "citation", "reason", "author", "viewer"]);
    if (unknown) return unknown;
    const reader = a.viewer ?? str(a.author);
    const sid = str(a.standard), law = str(a.law), body = str(a.body);
    if (!this.#row(sid) || !this.#readable(sid, reader)) return noSuchStandard(sid || null, { id: sid || null, end: "standard" });
    if (!this.#row(law) || !this.#readable(law, reader)) return noSuchStandard(law || null, { id: law || null, end: "law" });
    if (!this.#entity(body, a.viewer ?? null)) return noSuchEntity(body || null, { field: "body" });
    const citation = typeof a.citation === "string" ? a.citation.trim() : "";
    if (!citation || !this.#texts(law).includes(citation) || !this.#heldFor(citation, a.viewer ?? null))
      return refuseNoCitation(law, a.citation);
    const fault = reasonFault(a.reason);
    if (fault) return refuseReason(fault);
    return this.record.transact(() => {
      const at = this.#when();
      const id = `impose-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_impositions (imposition_id, standard_id, body, law, citation, reason, author, at)
                     VALUES (?,?,?,?,?,?,?,?)`, id, sid, body, law, citation, a.reason, str(a.author), at);
      return { ok: true, imposition: { id, standard: sid, body, law, citation, reason: a.reason, by: str(a.author), at } };
    });
  }

  /** R43: a member declares a comparison a benchmark, with who, when and why; it never makes a standard bind. */
  benchmarkDeclare(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, ["standard", "body", "reason", "author", "viewer"]);
    if (unknown) return unknown;
    const sid = str(a.standard), body = str(a.body);
    if (!this.#row(sid) || !this.#readable(sid, a.viewer ?? str(a.author))) return refuseNoSuchStandard(sid || null);
    if (!this.#entity(body, a.viewer ?? null)) return noSuchEntity(body || null, { field: "body" });
    const fault = reasonFault(a.reason);
    if (fault) return refuseReason(fault);
    return this.record.transact(() => {
      const at = this.#when();
      const id = `bench-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_benchmarks (benchmark_id, standard_id, body, reason, author, at) VALUES (?,?,?,?,?,?)`,
                    id, sid, body, a.reason, str(a.author), at);
      return { ok: true, benchmark: { id, standard: sid, body, reason: a.reason, by: str(a.author), at },
               says: word("standards.says.declared_benchmark_comparison") };
    });
  }

  /** R43: whether a held standard binds a body on a date: `binds` on its issuer, an adoption, an incorporating standard
   *  that binds the body, or an imposition, in force on the date; else a policy, standard or commitment is a labelled
   *  `benchmark`, and a law `undetermined`; undetermined too where a date or adoption needed is. Each answer names what
   *  it rests on. Writes nothing and never throws. */
  bindsAt({ standard = null, body = null, date = null, viewer = null } = {}) {
    try {
      const sid = str(standard), b = str(body);
      if (!sid) return refuseNoId("bindsat");
      if (!isDate(date)) return refuseDateInvalid(date);
      const row = this.#row(sid);
      if (!row || (viewer !== null && !this.#readable(sid, viewer))) return refuseNoSuchStandard(sid);
      const ent = this.#entity(b, viewer);
      const bodyLabel = ent ? ent.label : b || word("standard.binding.body.none");
      const answer = (state, why, rests_on) => ({ ok: true, standard: sid, body: b || null, date, state, why, rests_on,
                                                  says: { binding: bindingWords(state, bodyLabel),
                                                          ...this.#t35Answer(row, viewer).says } });
      const r = this.#bindingOf(row, b, date, viewer, new Set());
      if (r.state === "binds") return answer("binds", r.why, r.rests_on);
      if (r.state === "undetermined") return answer("undetermined", r.why, r.rests_on);
      if (BENCHMARK_KINDS.includes(row.kind))
        return answer("benchmark", word("standards.nothing_held_puts", { sid: String(sid), body_label: String(bodyLabel), date: String(date) }), r.rests_on);
      return answer("undetermined", word("standards.whether_law_binds"), r.rests_on);
    } catch {
      return { ok: true, standard: str(standard), body: str(body) || null, date, state: "undetermined",
               why: word("standards.why.binds_body_read"), rests_on: [] };
    }
  }

  /* R43: the grounds on which `row` binds `body` on `date`: `{state: binds | none | undetermined, why, rests_on}`. */
  #bindingOf(row, body, date, viewer, seen) {
    const sid = row.standard_id;
    seen.add(sid);
    const rests = [];
    const unsure = [];
    const inForce = this.#versionAt(row, date, viewer);
    if ((row.issuer_entity && row.issuer_entity === body) || (!row.issuer_entity && row.issuer === body)) {
      rests.push({ issuer: body });
      if (inForce.state === "in_force") return { state: "binds", why: word("standards.why.issued_force", { body: String(body), date: String(date) }), rests_on: rests };
      if (inForce.state === "undetermined") unsure.push(word("standards.text", { body: String(body), why: String(inForce.why) }));
    }
    /* an adoption by the body puts it in force (R40) only while this version is itself in force on the date (R20, R51):
       adopted, then ended, binds no longer; adopted with no end stated and no record of it in force through the date
       is undetermined, never binding by default */
    let started = null;
    for (const ad of this.#rows(`SELECT * FROM standard_body_adoptions WHERE standard_id=? AND body=? ORDER BY adoption_id`, sid, body)) {
      const f = this.#adoptionFrom(ad, viewer);
      rests.push({ adoption: ad.adoption_id });
      if (!f.day) { unsure.push(word("standards.start_read", { adoption_id: String(ad.adoption_id), why: String(f.why) })); continue; }
      if (f.day <= date && (!started || f.day < started.day)) started = { ad, day: f.day };
    }
    if (started) {
      const by = word("standards.adopted_effective", { body: String(body), adoption_id: String(started.ad.adoption_id), day: String(started.day) });
      if (inForce.state === "in_force") return { state: "binds", why: word("standards.why.force", { by: String(by), date: String(date), why: String(inForce.why) }), rests_on: rests };
      if (inForce.state === "undetermined") unsure.push(`${by}, and ${inForce.why}`);
    }
    for (const im of this.#rows(`SELECT * FROM standard_impositions WHERE standard_id=? AND body=? ORDER BY imposition_id`, sid, body)) {
      const law = this.#row(im.law);
      if (!law) continue;
      rests.push({ imposition: im.imposition_id, law: im.law });
      const lf = this.#versionAt(law, date, viewer);
      /* the imposing law binds from its own in-force date (R20), and puts in force only a version itself in force (R43) */
      if (lf.state === "in_force" && inForce.state === "in_force")
        return { state: "binds", why: word("standards.why.imposes_force_force", { law: String(im.law), body: String(body), date: String(date), date_2: String(date), why: String(inForce.why) }),
                 rests_on: rests };
      if (lf.state === "undetermined") unsure.push(word("standards.imposes", { law: String(im.law), why: String(lf.why) }));
      else if (lf.state === "in_force" && inForce.state === "undetermined") unsure.push(word("standards.imposes", { law: String(im.law), why: String(inForce.why) }));
    }
    for (const inc of this.#incorporatedBy(sid, viewer)) {
      if (seen.has(inc.from)) continue;
      const from = this.#row(inc.from);
      if (!from) continue;
      const r = this.#bindingOf(from, body, date, viewer, seen);
      rests.push({ incorporated_by: inc.from, relation: inc.id });
      /* an incorporating standard that binds the body puts in force only a version itself in force (R43, R20) */
      if (r.state === "binds" && inForce.state === "in_force")
        return { state: "binds", why: word("standards.why.incorporates_binds_force", { from: String(inc.from), body: String(body), why: String(r.why), date: String(date), why_2: String(inForce.why) }),
                 rests_on: rests };
      if (r.state === "undetermined") unsure.push(word("standards.incorporates", { from: String(inc.from), why: String(r.why) }));
      else if (r.state === "binds" && inForce.state === "undetermined") unsure.push(word("standards.incorporates_binds", { from: String(inc.from), body: String(body), why: String(inForce.why) }));
    }
    return unsure.length ? { state: "undetermined", why: unsure.join("; "), rests_on: rests } : { state: "none", why: null, rests_on: rests };
  }

  /* R43: the adopted `incorporates` relations naming `sid` as their end (`law-relations` R9, through R11). */
  #incorporatedBy(sid, viewer) {
    try {
      const r = this.#law.lawRelationsOf({ standard: sid, viewer: viewer ?? null });
      const refs = r && Array.isArray(r.referential) ? r.referential : [];
      return refs.filter((x) => x.type === "incorporates" && x.direction === "in" && !x.withdrawn)
        .map((x) => ({ id: x.id, from: x.from.standard }));
    } catch { return []; }
  }

  /* ===================================================================== *
   * T36: KNOWN IN FORCE THROUGH A DATE (R50, R51) AND WHO RECORDED FROM A PASSAGE (R49)
   * ===================================================================== */

  /** R50: `inForceThroughRecord` (`op=standardinforcethrough`): by a member's act, that one version is known to be in
   *  force through `through`, from a held capture extent of the source checked that day. Append-only; the record takes
   *  the standard's sight (R14, R37). A source with a receipt is checked against the day it was last retrieved. */
  inForceThroughRecord(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, THROUGH_KEYS);
    if (unknown) return unknown;
    const viewer = a.viewer ?? null;
    const reader = viewer ?? str(a.author);
    const sid = str(a.standard);
    const row = this.#row(sid);
    if (!row || !this.#readable(sid, reader)) return noSuchStandard(sid || null, { id: sid || null });
    if ((row.held || "text") !== "text") return refuseTextNotHeld(sid, row.held);
    const from = this.#periodOf(row, viewer).from;
    /* DEC-49 REGION is-through-date */
    if (!isCalendarDate(a.through) || (from !== null && a.through < from))
      return refusal("THROUGH_INVALID", isCalendarDate(a.through)
        ? `${a.through} is before ${from}, when ${sid} came into force. Nothing was written.`
        : "through is a day written YYYY-MM-DD that exists. Nothing was written.",
        { through: typeof a.through === "string" ? a.through.slice(0, 40) : null, from });
    /* END DEC-49 REGION is-through-date */
    const src = a.source;
    const srcRow = isObj(src) && Object.keys(src).every((k) => k === "captureSha" || k === "extent")
      && typeof src.captureSha === "string" && isObj(src.extent) ? this.#extentRow(src.captureSha, src.extent, reader) : null;
    /* DEC-49 REGION is-through-sourced */
    if (!srcRow)
      return refusal("THROUGH_NO_SOURCE", "a version known in force through a date names the source checked that day: "
                     + "source {captureSha, extent}, a passage of a held capture you may see. Nothing was written.");
    /* END DEC-49 REGION is-through-sourced */
    const captureSha = src.captureSha.trim().toLowerCase();
    const last = this.#receiptsOf(captureSha).map((r) => r.last_retrieved).filter((x) => typeof x === "string")
      .sort().pop() ?? null;
    let checkedDay = null;
    if (last) {
      try { checkedDay = localDay(last, this.#zone()); } catch { checkedDay = null; }
      if (checkedDay === null) checkedDay = last.slice(0, 10);
      /* DEC-49 REGION is-through-checked */
      if (a.through > checkedDay)
        return refusal("THROUGH_AFTER_CHECK", localize("standards.index.the_source_was_last_retrieved", "the source was last retrieved on {checkedDay}, and {through} is after it. Nothing was written.", { checkedDay: String(checkedDay), through: String(a.through) }), { through: a.through, last_retrieved: checkedDay });
      /* END DEC-49 REGION is-through-checked */
    }
    const fault = reasonFault(a.reason);
    if (fault) return refuseReason(fault);
    return this.record.transact(() => {
      const at = this.#when();
      const id = `through-${rand(12)}`;
      this.sql.exec(`INSERT INTO standard_in_force_through (record_id, standard_id, through, capture_sha, extent_json, content_id,
                       checked, checked_day, reason, author, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                    id, sid, a.through, captureSha, JSON.stringify(src.extent), srcRow.content_id, last ? "retrieved" : "stated",
                    checkedDay, a.reason, str(a.author), at);
      return { ok: true, record: this.#throughAnswer(this.#one(`SELECT * FROM standard_in_force_through WHERE record_id=?`, id)) };
    });
  }

  #throughAnswer(r) {
    const w = this.#one(`SELECT * FROM standard_in_force_through_withdrawals WHERE record_id=?`, r.record_id);
    const extent = safeJson(r.extent_json);
    return { id: r.record_id, standard: r.standard_id, through: r.through,
             source: { captureSha: r.capture_sha, extent, content_id: r.content_id, says: sourceWords(r.capture_sha, extent) },
             checked: r.checked, ...(r.checked === "retrieved" ? { checked_day: r.checked_day } : {}),
             reason: r.reason, by: r.author, at: r.at,
             withdrawn: w ? { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } : null };
  }

  /** R50: withdraw a record, kept with who, when and why; a repeat answers `already: true`. */
  inForceThroughWithdraw({ record = null, reason = null, author = null, viewer = null } = {}) {
    const byMachine = machineRefusal(author);
    if (byMachine) return byMachine;
    const r = typeof record === "string" && record ? this.#one(`SELECT * FROM standard_in_force_through WHERE record_id=?`, record) : null;
    /* DEC-49 REGION is-through-record-held */
    if (!r || !this.#readable(r.standard_id, viewer ?? str(author)))
      return refusal("NO_SUCH_RECORD", localize("standards.index.no_record_of_a_version", "no record of a version known in force through a date answers to that id here. Nothing was written."), { record: str(record) || null });
    /* END DEC-49 REGION is-through-record-held */
    const fault = reasonFault(reason);
    if (fault) return refuseReason(fault);
    const w = this.#one(`SELECT * FROM standard_in_force_through_withdrawals WHERE record_id=?`, r.record_id);
    if (w) return { ok: true, already: true, record: r.record_id,
                    withdrawn: { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } };
    return this.record.transact(() => {
      const at = this.#when();
      this.sql.exec(`INSERT INTO standard_in_force_through_withdrawals (record_id, standard_id, reason, withdrawn_by, withdrawn_at)
                     VALUES (?,?,?,?,?)`, r.record_id, r.standard_id, reason, str(author), at);
      return { ok: true, record: r.record_id, withdrawn: { by: str(author), at, reason },
               says: word("standards.says.withdrawn_deleted_record") };
    });
  }

  /** R50: every record of a standard, standing and withdrawn, with its source, how it was checked, author and time. */
  inForceThroughOf({ standard = null, viewer = null } = {}) {
    const sid = str(standard);
    if (!sid) return refuseNoId("inforcethroughof");
    if (!this.#row(sid) || !this.#readable(sid, viewer)) return refuseNoSuchStandard(sid);
    const all = this.#throughRecords(sid);
    return { ok: true, standard: sid, records: all.filter((x) => !x.withdrawn), withdrawn: all.filter((x) => x.withdrawn) };
  }

  #throughRecords(sid) {
    return this.#rows(`SELECT * FROM standard_in_force_through WHERE standard_id=? ORDER BY through, record_id`, sid)
      .map((r) => this.#throughAnswer(r));
  }

  /** R49: `recordedBy({captureSha, extent?, limit?, viewer})`, in `events` R49's shape: every row of this module that
   *  cites an extent of the capture (a content id read as its row's capture and extent, `content` R45), each with the
   *  field citing it, who recorded it and when, and whether it is withdrawn or superseded. A row is answered only to a
   *  viewer who may read its standard (R14, R37); a capture not held or not visible answers no items. No item carries a
   *  standard's text (R41). An in-process read: writes nothing, never throws. */
  recordedBy({ captureSha = null, extent = null, limit = null, viewer = null } = {}) {
    try {
      if (viewer === null || viewer === undefined || (typeof viewer === "string" && !viewer.trim()))
        return readRefusal("VIEWER_MISSING", localize("standards.index.read_names_the_member_reading", "a read names the member reading; an absent viewer is neither an administrator nor the public"));
      if (typeof captureSha !== "string" || !captureSha.trim())
        return noSha("who recorded something from a passage is read for a captured document, by its capture sha256");
      let asked = null;
      if (extent !== null && extent !== undefined) {
        /* K2114: an extent given that is not an object of one of content's kinds */
        if (!isObj(extent) || !Object.prototype.hasOwnProperty.call(CONTENT_EXTENT_KINDS, extent.kind))
          return readRefusal("EXTENT_MALFORMED", "the extent named is not one the record can read");
        asked = extent;
      }
      const n = Number.isInteger(Number(limit)) && limit !== null && limit !== ""
        ? Math.min(FOR_LIMIT_MAX, Math.max(1, Number(limit))) : FOR_LIMIT_DEFAULT;
      const sha = captureSha.trim().replace(/^sha256:/i, "").toLowerCase();
      const base = { ok: true, module: CONNECTION_OWNER, capture_sha: sha };
      /* a viewer membership refuses (K2114) sees nothing, as a capture not held or not visible */
      if (typeof viewer !== "string" || !/^[0-9a-f]{64}$/.test(sha) || !this.#captureVisible(sha, viewer))
        return { ...base, items: [], truncated: false };
      const items = new Map();
      const readable = new Map();
      const may = (sid) => { if (!readable.has(sid)) readable.set(sid, this.#readable(sid, viewer)); return readable.get(sid); };
      const add = (record, kind, field, sid, ext, by, at, withdrawn) => {
        if (!may(sid)) return;
        /* K2114: the extent as content's canonical string parsed back to an object; ordered by that string */
        const canon = typeof ext === "string" ? ext : canonicalExtent(ext);
        const object = safeJson(canon);
        let relation = null;
        if (asked) {
          relation = extentRelation(asked, object);
          if (!["same", "narrower", "wider"].includes(relation)) return;
        }
        const key = JSON.stringify([canon, record, field]);
        if (!items.has(key)) items.set(key, { canon, item: { module: CONNECTION_OWNER, record, kind, field, extent: object, relation,
                                                             by, at, withdrawn: !!withdrawn } });
      };
      /* the capture's content rows, each content id read as its extent (content's read contract, R45) */
      const ext = new Map(this.#rows(`SELECT content_id, extent FROM content WHERE capture_sha=?`, sha).map((r) => [r.content_id, r.extent]));
      const superseded = (sid) => this.#successorOf(sid) !== null;
      for (const sr of this.#standardsCiting(sha, ext)) {
        const w = superseded(sr.standard_id);
        for (const [field, e] of this.#citedIn(sr, sha, ext))
          add(sr.standard_id, "standard", field, sr.standard_id, e, sr.declared_by, sr.declared_at, w);
      }
      const ids = [...ext.keys()];
      const inIds = (col) => (ids.length ? `${col} IN (SELECT content_id FROM content WHERE capture_sha=?)` : "0");
      for (const f of this.#rows(`SELECT f.*, (SELECT 1 FROM standard_force_withdrawals w WHERE w.force_id=f.force_id) AS gone
                                  FROM standard_forces f WHERE ${inIds("f.citation")} OR ${inIds("f.criteria")}
                                  ORDER BY f.force_id`, ...(ids.length ? [sha, sha] : []))) {
        if (ext.has(f.citation)) add(f.force_id, "force", "citation", f.standard_id, ext.get(f.citation), f.author, f.at, f.gone);
        if (ext.has(f.criteria)) add(f.force_id, "force", "criteria", f.standard_id, ext.get(f.criteria), f.author, f.at, f.gone);
      }
      if (ids.length) {
        for (const r of this.#rows(`SELECT * FROM standard_body_adoptions WHERE ${inIds("citation")}`, sha))
          add(r.adoption_id, "adoption", "citation", r.standard_id, ext.get(r.citation), r.author, r.at, false);
        for (const r of this.#rows(`SELECT * FROM standard_impositions WHERE ${inIds("citation")}`, sha))
          add(r.imposition_id, "imposition", "citation", r.standard_id, ext.get(r.citation), r.author, r.at, false);
      }
      for (const r of this.#rows(`SELECT t.*, (SELECT 1 FROM standard_in_force_through_withdrawals w WHERE w.record_id=t.record_id)
                                  AS gone FROM standard_in_force_through t WHERE t.capture_sha=?`, sha))
        add(r.record_id, "in_force_through", "source", r.standard_id, ext.get(r.content_id) ?? safeJson(r.extent_json),
            r.author, r.at, r.gone);
      const all = [...items.values()]
        .sort((x, y) => cmp(x.canon, y.canon) || cmp(x.item.record, y.item.record) || cmp(x.item.field, y.item.field))
        .map((x) => x.item);
      return { ...base, items: all.slice(0, n), truncated: all.length > n };
    } catch {
      return { ok: true, module: CONNECTION_OWNER, capture_sha: typeof captureSha === "string" ? captureSha.trim().toLowerCase() : null,
               items: [], truncated: false, undetermined: { why: word("standards.why.rows_citing_capture") } };
    }
  }

  /* R49: whether the viewer may see a bundle holding the capture (provenance's `register`, its R48 read contract, or a
     content row's document, content R45). */
  #captureVisible(sha, viewer) {
    const bundles = new Set([
      ...this.#rows(`SELECT DISTINCT bundle_id FROM register WHERE capture_sha=?`, sha).map((r) => r.bundle_id),
      ...this.#rows(`SELECT DISTINCT bundle_id FROM content WHERE capture_sha=?`, sha).map((r) => r.bundle_id)]);
    return [...bundles].some((b) => b && this.membership.inSight(b, viewer));
  }

  /* R49: the standards whose row cites the capture: a text, portion, requirement, copy claim, force source or target
     passage among its content ids, a `cited_by` or searched place of the capture, or a capture of its version basis. */
  #standardsCiting(sha, ext) {
    const ids = new Set();
    if (ext.size) {
      for (const r of this.#rows(`SELECT DISTINCT standard_id FROM standard_texts WHERE content_id IN
                                  (SELECT content_id FROM content WHERE capture_sha=?)`, sha)) ids.add(r.standard_id);
      for (const r of this.#rows(`SELECT standard_id FROM standards WHERE portion_content IN
                                  (SELECT content_id FROM content WHERE capture_sha=?)`, sha)) ids.add(r.standard_id);
      /* the passages that need not be among the standard's own text (R19, R42; K2116) */
      for (const r of this.#rows(`SELECT standard_id FROM standards WHERE json_extract(target_json, '$.definition') IN (${OWN})
                                  OR json_extract(target_json, '$.period.content_id') IN (${OWN}) OR current_through_basis IN (${OWN})
                                  OR json_extract(period_basis_json, '$.from.passage') IN (${OWN})
                                  OR json_extract(period_basis_json, '$.to.passage') IN (${OWN})`, sha, sha, sha, sha, sha))
        ids.add(r.standard_id);
    }
    for (const r of this.#rows(`SELECT standard_id FROM standards WHERE instr(coalesce(held_json,''), ?) > 0
                                OR instr(coalesce(version_basis_json,''), ?) > 0`, sha, sha)) ids.add(r.standard_id);
    return [...ids].sort().map((id) => this.#row(id)).filter(Boolean);
  }

  /* R49: each field of one standard's row citing the capture, with the extent cited (canonical, or the object). */
  #citedIn(row, sha, ext) {
    const out = [];
    const id = (field, c) => { if (typeof c === "string" && ext.has(c)) out.push([field, ext.get(c)]); };
    const at = (field, x) => {
      if (isObj(x) && typeof x.captureSha === "string" && x.captureSha.trim().toLowerCase() === sha && isObj(x.extent))
        out.push([field, x.extent]);
    };
    for (const c of this.#texts(row.standard_id)) id("text", c);
    id("portion", row.portion_content);
    for (const c of safeJson(row.requires_json) || []) id("requires", c);
    const held = safeJson(row.held_json);
    if (row.held === "cited") at("cited_by", held);
    if (row.held === "absent" && held) {
      for (const p of held.places || []) at("search", p);
      at("search", held.answer);
    }
    id("copy_claimed", (safeJson(row.copy_claimed_json) || {}).extent);
    const vb = safeJson(row.version_basis_json);
    if (vb && Array.isArray(vb.captures) && vb.captures.includes(sha)) out.push(["version_basis", { kind: "document" }]);
    id("force_source", (safeJson(row.force_source_json) || {}).citation);
    const t = safeJson(row.target_json);
    if (t) {
      id("target.metric", t.metric && t.metric.content_id); id("target.definition", t.definition);
      id("target.period", t.period && t.period.content_id);
    }
    /* K2116: a codifier copy's current-through basis and a period's cited passages (R19) */
    id("current_through.basis", row.current_through_basis);
    const pb = safeJson(row.period_basis_json) || {};
    for (const side of ["from", "to"]) id(`period_basis.${side}`, pb[side] && pb[side].passage);
    return out;
  }

  /* ===================================================================== *
   * PROPOSALS (R9, R10)
   * ===================================================================== */

  /** R9: a proposal, stored apart from standards and labelled with who proposed it and whether it is machine work. */
  standardPropose(args = {}) {
    const a = isObj(args) ? args : {};
    /* R56: the project, asked before any other check (membership's terms: sight first), by the proposer's viewer */
    const project = a.project == null || a.project === "" ? null : a.project;
    if (project !== null) {
      const unseen = this.#projectUnseen(project, a.viewer ?? (str(a.proposer) || null));
      if (unseen) return unseen;
    }
    const unknown = refuseFieldUnknown(a, PROPOSE_KEYS);
    if (unknown) return unknown;
    const who = str(a.proposer);
    /* DEC-49 REGION is-proposer-named */
    if (!who)
      return refusal("STANDARD_PROPOSER_UNNAMED", "the plane stamps the proposer from the credential that asked, and this "
                     + "call carries nobody. Nothing was written.");
    /* END DEC-49 REGION is-proposer-named */
    const cite = str(a.cite);
    if (!cite || cite.length > CITE_MAX) return refuseNoCite(cite.length);
    if (a.kind != null && a.kind !== "" && !STANDARD_KINDS.includes(a.kind)) return refuseKindUnknown(a.kind);
    const texts = a.text == null ? [] : textIds(a.text);
    if (texts === null || texts.length > TEXTS_MAX) return refuseTextUnresolved(null);
    const unresolved = this.#unresolvedText(texts, a.viewer ?? null);
    if (unresolved) return refuseTextUnresolved(unresolved);
    const why = str(a.why);
    /* DEC-49 REGION is-proposal-why */
    if (!why || why.length > WHY_MAX)
      return refusal("STANDARD_WHY_INVALID", `a proposal says why, in 1 to ${WHY_MAX} characters. Nothing was written.`,
                     { max: WHY_MAX });
    /* END DEC-49 REGION is-proposal-why */
    const act = a.act == null || a.act === "" ? null : a.act;
    /* DEC-49 REGION is-proposal-act */
    if (act !== null && (typeof act !== "string" || !act.trim() || act.length > ACT_MAX))
      return refusal("STANDARD_ACT_INVALID", localize("standards.index.the_act_a_proposal_names", "the act a proposal names is an id of at most {ACT_MAX} characters. Nothing was written.", { ACT_MAX: String(ACT_MAX) }), { max: ACT_MAX });
    /* END DEC-49 REGION is-proposal-act */
    return this.record.transact(() => {
      const at = this.#when();
      const id = this.record.allocId("STDP", at.slice(0, 4)).id;
      const kind = a.kind || null, issuer = str(a.issuer) || null;
      this.sql.exec(`INSERT INTO standard_proposals (proposal_id, cite, kind, issuer, text_json, why, act, proposed_by,
                       proposed_at, project) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                    id, cite, kind, issuer, JSON.stringify(texts), why, act === null ? null : act.trim(), who, at, project);
      return { ok: true, proposal: this.#proposalAnswer(this.#proposal(id)), standard: false,
               says: PROPOSAL_SAYS
                   + (texts.length ? "" : localize("standards.index.proposal_stored_no_text", " It is stored with no captured text, and cannot be adopted until a member names the captured passages that hold the standard's words (R9).")),
               ...(texts.length ? {} : { text_held: false }) };
    });
  }

  #proposal(id) {
    return typeof id === "string" && id ? this.#one(`SELECT * FROM standard_proposals WHERE proposal_id=?`, id) : null;
  }

  #proposalAnswer(p) {
    const adopted = this.#one(`SELECT standard_id, adopted_by, adopted_at FROM standard_adoptions WHERE proposal_id=?`,
                              p.proposal_id);
    return { id: p.proposal_id, cite: p.cite, kind: p.kind ?? null, issuer: p.issuer ?? null,
             text: safeJson(p.text_json) || [], why: p.why, act: p.act ?? null, project: p.project ?? null, at: p.proposed_at,
             ...proposalLabel(p.proposed_by, STANDARD),
             adoption: adopted ? { standard: adopted.standard_id, by: adopted.adopted_by, at: adopted.adopted_at } : null };
  }

  /** R54 (K2806; read by `duties` R30): one proposal (R9) the viewer may see, `{ok: true, proposal: {id, kind, adoption}}`,
   *  `adoption` null until a member adopts it (R10), then `{standard, by, at}` naming the adopted standard. An id naming
   *  no proposal, one asked by a viewer the record admits to nothing, and one adopted as a standard the viewer may not
   *  read (R37) are answered alike, through R10's `STANDARD_NO_SUCH_PROPOSAL` (the bare `NO_SUCH_PROPOSAL` is `intent`'s,
   *  for another condition: one code, one condition), with nothing read beyond it. Writes nothing and never throws. */
  standardProposalRead({ proposal = null, viewer = null } = {}) {
    try {
      const p = typeof proposal === "string" && proposal.trim() ? this.#proposal(proposal.trim()) : null;
      const visible = !!p && viewer !== null && viewer !== undefined && viewerPredicate(viewer).scope !== "DENY";
      const a = visible ? this.#proposalAnswer(p).adoption : null;
      if (!visible || (a && !this.#readable(a.standard, viewer))) return refuseNoSuchProposal(str(proposal) || null);
      /* R56: the project it was made for, named only to a viewer who sees that project whole */
      const project = p.project && this.#projectUnseen(p.project, viewer) === null ? p.project : null;
      return { ok: true, proposal: { id: p.proposal_id, kind: p.kind ?? null, project, adoption: a } };
    } catch {
      return refuseNoSuchProposal(typeof proposal === "string" ? proposal.trim().slice(0, 80) || null : null);
    }
  }

  /* R56, R57: null when `viewer` sees `project` at `membership.sight`'s full level (R44) and it names a project; else
     the refusal membership answers a read naming that project's id: `PROJECT_SEEN_NOT_A_PARTICIPANT` at existence
     (membership R77, minted there), and at none, or for an id naming no project, as a project that does not exist
     (membership R78). A viewer never named sees nothing (fail closed). */
  #projectUnseen(project, viewer) {
    const id = typeof project === "string" ? project.trim() : "";
    if (!id || viewer === null || viewer === undefined) return noSuchProject(id || null);
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id);
    if (!b || b.object_type !== "project") return noSuchProject(id);
    const level = this.membership.sight(id, viewer);
    if (level === Membership.SIGHT_FULL) return null;
    if (level === Membership.SIGHT_EXISTENCE) return this.membership.existenceAct(id, viewer) || noSuchProject(id);
    return noSuchProject(id);
  }

  /** R57: `proposalsFor({project, state?, after?, limit?, viewer})` (`op=standardproposals`): the proposals (R9) made for
   *  `project` (R56), newest first (`proposed_at`, then id), each with its label, whether it names captured text and
   *  what became of it (R54's adoption). `state` `open` (the default), `adopted` or `all`. A viewer below full sight of
   *  the project is answered as R56 refuses, nothing listed or counted. An adoption whose standard the viewer may not
   *  read (R37) is answered as R54 answers it, and that proposal is listed only as open. Writes nothing, never throws. */
  proposalsFor({ project = null, state = null, after = null, limit = null, viewer = null } = {}) {
    try {
      const st = state == null || state === "" ? "open" : state;
      if (!PROPOSAL_STATES.includes(st)) return refuseProposalsArgument("state", PROPOSAL_STATES.join(", "), st);
      const unseen = this.#projectUnseen(project, viewer);
      if (unseen) return unseen;
      const pid = project.trim();
      const n = Number.isInteger(Number(limit)) && limit !== null && limit !== ""
        ? Math.min(PAGE_MAX, Math.max(1, Number(limit))) : PROPOSALS_LIMIT_DEFAULT;
      let cursor = null;
      if (after != null && after !== "") {
        cursor = typeof after === "string"
          ? this.#one(`SELECT proposal_id, proposed_at FROM standard_proposals WHERE proposal_id=? AND project=?`, after.trim(), pid)
          : null;
        if (!cursor) return refuseProposalsArgument("after", "the id of a proposal this read listed for the project", after);
      }
      const kept = [];
      let from = cursor;
      for (;;) {
        const page = this.#rows(`SELECT * FROM standard_proposals WHERE project=?
                                   ${from ? "AND (proposed_at < ? OR (proposed_at = ? AND proposal_id < ?))" : ""}
                                 ORDER BY proposed_at DESC, proposal_id DESC LIMIT ?`,
                                pid, ...(from ? [from.proposed_at, from.proposed_at, from.proposal_id] : []), n + 1);
        for (const p of page) {
          const a = this.#proposalAnswer(p).adoption;
          /* R37, R54: an adoption the viewer may not read is not answered, and the proposal counts only as open */
          const adoption = a && this.#readable(a.standard, viewer) ? a : null;
          if ((st === "open" && adoption) || (st === "adopted" && !adoption)) continue;
          kept.push({ p, adoption });
          if (kept.length > n) break;
        }
        if (kept.length > n || page.length < n + 1) break;
        from = page[page.length - 1];
      }
      const truncated = kept.length > n;
      const items = kept.slice(0, n).map(({ p, adoption }) => {
        const label = proposalLabel(p.proposed_by, STANDARD);
        return { id: p.proposal_id, cite: p.cite, kind: p.kind ?? null, issuer: p.issuer ?? null, why: p.why, label,
                 project: p.project, proposed_by: p.proposed_by, proposed_at: p.proposed_at, has_text: (safeJson(p.text_json) || []).length > 0,
                 adoption, standard: false, says: PROPOSAL_SAYS };
      });
      return { ok: true, project: pid, state: st, items, count: items.length, limit: n, truncated,
               cursor: truncated ? items[items.length - 1].id : null };
    } catch {
      return { ok: true, project: typeof project === "string" ? project.trim() : null, items: [], count: 0, truncated: false,
               cursor: null, undetermined: { why: word("standards.why.proposals_read") } };
    }
  }

  /** R10: a member adopts a proposal: R1 by that member, naming it. A field the member does not state is the
   *  proposal's, and the answer says which were; the standard records the proposal, and the proposal its adoption. The
   *  reason is never taken from the proposal: the adopting member's own is R1's, and the proposal's `why` is the
   *  proposer's (DEC-88), answered beside it as theirs. */
  standardAdopt(args = {}) {
    const a = isObj(args) ? args : {};
    const byMachine = machineRefusal(a.author);
    if (byMachine) return byMachine;
    const unknown = refuseFieldUnknown(a, ADOPT_KEYS);
    if (unknown) return unknown;
    const p = this.#proposal(str(a.proposal));
    /* DEC-49 REGION is-proposal-held */
    if (!p || (a.viewer != null && viewerPredicate(a.viewer).scope === "DENY"))
      return refusal("STANDARD_NO_SUCH_PROPOSAL", "no proposal of a standard answers to that id here. Nothing was "
                     + "written.", { proposal: str(a.proposal) || null });
    /* END DEC-49 REGION is-proposal-held */
    const done = this.#adoptRefusal(p);
    if (done) return done;
    const fromProposal = [];
    const take = (k, v) => { if (a[k] == null || a[k] === "") { if (v != null) fromProposal.push(k); return v; } return a[k]; };
    const fields = { ...a, cite: take("cite", p.cite), kind: take("kind", p.kind), issuer: take("issuer", p.issuer),
                     /* R9: a proposal adopted as cited (or absent) takes no text from it: it is held without its words */
                     text: a.held === "cited" || a.held === "absent" ? a.text
                       : take("text", (safeJson(p.text_json) || []).length ? safeJson(p.text_json) : null) };
    /* R60: one transaction, as `standardDeclare`'s: a found extent minted while checking is taken back by a refusal */
    const r = this.record.transact(() => {
      const d = this.#declareRefusal(fields);
      if (d.ok === false) return d;
      return this.#write(d.fields, str(a.author), a.viewer ?? null, p.proposal_id);
    });
    if (!r || !r.ok) return r;
    return { ...r, adopted: { proposal: p.proposal_id, from_proposal: fromProposal, why: p.why, why_by: p.proposed_by,
                              says: fromProposal.length ? word("standards.says.taken_proposal_made", { from_proposal: String(fromProposal.join(", ")) })
                                                        : word("standards.says.field_stated_adopting") } };
  }

  /* R10: a proposal is adopted at most once. */
  #adoptRefusal(p) {
    const held = this.#one(`SELECT standard_id FROM standard_adoptions WHERE proposal_id=?`, p.proposal_id);
    /* DEC-49 REGION is-proposal-open */
    if (held)
      return refusal("STANDARD_PROPOSAL_ADOPTED", `${p.proposal_id} was adopted as ${held.standard_id}. Nothing was written.`,
                     { proposal: p.proposal_id, standard: held.standard_id });
    /* END DEC-49 REGION is-proposal-open */
    return null;
  }
}

/* ---- the document (R15) ---- */

/** The title a standard's document carries: its citation, as the front matter can hold it. */
const titleOf = (cite) => String(cite).replace(/["\\\r\n]/g, " ").slice(0, CITE_MAX);

/* The core fields every record document states (C-2.2): a member's act, nothing pending, nothing drawn. `group` is
   stamped by `promotion` (its R13). */
const CORE_TAIL = Object.freeze(["produced_by:", "  mode: human", "  capability_tier: session", "references: []",
  "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null",
  "visuals: []"]);

/** R15: a new standard's document, `recorded`. The citation, issuer and the declarer's reason, which may hold any
 *  character, are kept whole in body sections; the front matter holds what the grammar holds bare. */
function standardDoc({ id, cite, kind, issuer, reason, texts, period, supersedes, source, proposal, author, at }) {
  const src = source && source.state === "matched"
    ? word("standards.matched_level_profile", { source: String(source.source), kind: String(source.kind), issuer: String(source.issuer), level: String(source.level), profile: String(source.profile), basis: String(source.basis) })
    : `Undetermined: ${source ? source.why : "not read"}.`;
  return ["---", `id: ${id}`, `object_type: ${STANDARD}`, `schema: ${STANDARD}@1`, `title: ${q(titleOf(cite))}`,
    "current_state: recorded", "prior_state: null", `created: ${q(at)}`, `last_updated: ${q(at)}`, `kind: ${kind}`,
    `period_from: ${period.from === null ? "null" : q(period.from)}`, `period_to: ${period.to === null ? "null" : q(period.to)}`,
    `supersedes: ${supersedes ?? "null"}`, `adopted_from: ${proposal ?? "null"}`, `texts: [${texts.join(", ")}]`,
    `author: ${bare(author)}`, ...CORE_TAIL, "---", "", "## Citation", "", bodyText(cite), "", "## Issuer", "",
    bodyText(issuer), "", "## Reason", "", bodyText(reason), "", "## Source", "", bodyText(src), "", "## Session Log", "",
    `### Session ${at} | Recorded | ${author}`,
    `Changes: standard recorded${supersedes ? `, superseding ${supersedes}` : ""}${proposal ? `, adopting ${proposal}` : ""}.`,
    ""].join("\n");
}

/* ---- the fields ---- */

/* R2: one or more content ids, as a string or a list; null when not in that shape. Repeats are kept once. */
function textIds(v) {
  const list = typeof v === "string" ? [v] : Array.isArray(v) ? v : null;
  if (!list || !list.every((x) => typeof x === "string")) return null;
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))];
}

/* R1: `{from, to}`, each a date or null (absent is null); the period with nulls, or null when invalid. */
function periodOf(p) {
  if (p === undefined || p === null) return { from: null, to: null };
  if (!isObj(p) || Object.keys(p).some((k) => k !== "from" && k !== "to")) return null;
  const from = p.from ?? null, to = p.to ?? null;
  if ((from !== null && !isDate(from)) || (to !== null && !isDate(to))) return null;
  if (from !== null && to !== null && to < from) return null;
  return { from, to };
}

/* DEC-49: a code several acts answer is minted at one site, its own function here, which builds the refusal whole from
   its row; each act relays it with its own detail. */

/* R1, R10, R11: recording a standard is a named member's act. */
function machineRefusal(author) {
  /* DEC-49 REGION is-standard-member */
  if (str(author) && !isMachineIdentity(str(author))) return null;
  return refusal("MACHINE_CANNOT_DECLARE_STANDARD", "recording a standard is a named member's act; a machine proposes one "
                 + "(standardPropose). Nothing was written.");
  /* END DEC-49 REGION is-standard-member */
}

function refuseFieldUnknown(a, keys) {
  const unknown = Object.keys(a).filter((k) => !keys.includes(k)).sort();
  /* DEC-49 REGION is-standard-field */
  if (unknown.length)
    return refusal("STANDARD_FIELD_UNKNOWN", `this act takes ${keys.join(", ")}, and not ${unknown.join(", ")}. Nothing `
                   + "was written.", { rejected: unknown, accepted: [...keys] });
  /* END DEC-49 REGION is-standard-field */
  return null;
}

/** R33: a family's key, composed from its source `key` and series `key` (`jurisdictions` R50, R63). Pure. */
export function familyKey(family) {
  const k = family && typeof family.key === "string" ? family.key.trim() : "";
  const s = family && typeof family.series === "string" ? family.series.trim() : "";
  return k && s ? `${k}/${s}` : null;
}

/* R35, R50: a standard held without its text, so nothing is read from its words (minted here, DEC-49). */
function refuseTextNotHeld(sid, held) {
  /* DEC-49 REGION is-force-text-held */
  return refusal("FORCE_TEXT_NOT_HELD", localize("standards.index.sid_is_held_held_without", "{sid} is held {held}, without its text, so nothing is read from its words. Nothing was written.", { sid: String(sid), held: String(held) }), { standard: sid, held });
  /* END DEC-49 REGION is-force-text-held */
}

/* R49: a read's refusal (`VIEWER_MISSING`, `EXTENT_MALFORMED`), answered as the connection reads answer one: a code and
   why, no catalogue row (the code is shared by every module's read in `events` R49's shape). */
const readRefusal = (code, why) => ({ ok: false, refused: code, reason: code, code, why });

/* R49: the content ids of one capture (content's read contract, R45), as a subquery bound to the capture's digest. */
const OWN = "SELECT content_id FROM content WHERE capture_sha=?";

/* R49: compare two strings for a stable order. */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* R57: the required-argument refusal (the control plane's C-61 shape, answered from the store as `capture`'s
   store-side refusals are), naming the argument and the values it takes; nothing was read. */
function refuseProposalsArgument(argument, shape, given) {
  return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op: "standardproposals", argument, shape, status: 400,
           error: `${argument} must be ${argument === "state" ? "one of " : ""}${shape}; ${JSON.stringify(String(given)).slice(0, 80)} is not`,
           detail: `op=standardproposals needs '${argument}' in the shape ${shape}, and this request carried none the `
                 + "operation could use. Nothing was read." };
}

/* R50, R51: a source capture extent in words: the capture's first twelve hex digits and the extent's human form. */
function sourceWords(captureSha, extent) {
  let where = "";
  try { where = describeExtent(isObj(extent) ? extent : {}); } catch { where = ""; }
  return captureWords(captureSha, where);
}

/* R18, R19, R33, R39, R40: a field not in the form it takes, named. */
function refuseFieldInvalid(field, why) {
  /* DEC-49 REGION is-standard-law-field */
  return refusal("STANDARD_FIELD_INVALID", `${field} ${why}. Nothing was written.`, { field });
  /* END DEC-49 REGION is-standard-law-field */
}

/* R48 (law-relations R13): the refusals `law-relations`' acts answer as the host's, each minted as R1's, R9's and R10's are. */
const refuseReason = (fault) => refuseLawReason(fault);
function refuseLawReason(fault) {
  /* DEC-49 REGION is-standard-reason */
  return refusal("STANDARD_NO_REASON", `this act ${fault}. The reason is the member's own words on why the record holds `
                 + "this row. Nothing was written.", { max_chars: REASON_MAX });
  /* END DEC-49 REGION is-standard-reason */
}
function refuseNoSuchProposal(id) {
  /* DEC-49 REGION is-proposal-held */
  return refusal("STANDARD_NO_SUCH_PROPOSAL", "no proposal of that kind answers to that id here. Nothing was written.",
                 { proposal: id });
  /* END DEC-49 REGION is-proposal-held */
}
function refuseProposalAdopted(id, as) {
  /* DEC-49 REGION is-proposal-open */
  return refusal("STANDARD_PROPOSAL_ADOPTED", `${id} was adopted as ${as}. Nothing was written.`, { proposal: id, adopted_as: as });
  /* END DEC-49 REGION is-proposal-open */
}
function refuseProposerUnnamed() {
  /* DEC-49 REGION is-proposer-named */
  return refusal("STANDARD_PROPOSER_UNNAMED", "the plane stamps the proposer from the credential that asked, and this call "
                 + "carries nobody. Nothing was written.");
  /* END DEC-49 REGION is-proposer-named */
}
function refuseWhyInvalid() {
  /* DEC-49 REGION is-proposal-why */
  return refusal("STANDARD_WHY_INVALID", `a proposal says why, in 1 to ${WHY_MAX} characters. Nothing was written.`,
                 { max: WHY_MAX });
  /* END DEC-49 REGION is-proposal-why */
}

function refuseNoCite(length) {
  /* DEC-49 REGION is-standard-cited */
  return refusal("STANDARD_NO_CITE", length ? localize("standards.index.a_citation_is_at_most", "a citation is at most {CITE_MAX} characters, and this one is {length}. Nothing was written.", { CITE_MAX: String(CITE_MAX), length: String(length) }) : "a standard is recorded with its citation. Nothing was written.",
                 { max: CITE_MAX });
  /* END DEC-49 REGION is-standard-cited */
}

function refuseKindUnknown(kind) {
  /* DEC-49 REGION is-standard-kind */
  return refusal("STANDARD_KIND_UNKNOWN", `a standard's kind is one of ${STANDARD_KINDS.join(", ")}. Nothing was written.`,
                 { kind: typeof kind === "string" ? kind.slice(0, 40) : null, kinds: [...STANDARD_KINDS] });
  /* END DEC-49 REGION is-standard-kind */
}

function refuseTextUnresolved(contentId) {
  /* DEC-49 REGION is-standard-text-held */
  return refusal("STANDARD_TEXT_UNRESOLVED", contentId
    ? `no content row is held for ${String(contentId).slice(0, 80)}. Nothing was written.`
    : `a proposal's text is a list of at most ${TEXTS_MAX} content ids. Nothing was written.`,
    { content_id: contentId === null ? null : String(contentId).slice(0, 80) });
  /* END DEC-49 REGION is-standard-text-held */
}

/** R17 (N309, K231, K275): THE answer to one condition, no standard the caller may read answers to `standardId`
 *  (absent, or any id for a viewer naming no member, answered alike). The code is minted here and nowhere else: R5 and
 *  R7 answer through it, and so does every later module answering this condition (`conformance` R1). `standard` is the
 *  id as asked (null when none) and `detail` one fixed sentence; `extra` adds a caller's own fields and never replaces
 *  these. It writes nothing and never throws. */
export function noSuchStandard(standardId, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NO_SUCH_STANDARD_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-standard-held */
  const row = STANDARDS_CHECKS.NO_SUCH_STANDARD;
  return { ok: false, reason: "NO_SUCH_STANDARD", code: "NO_SUCH_STANDARD", check: row.check,
           translation: row.translation, standard: standardId ?? null, ...Object.fromEntries(own),
           detail: NO_SUCH_STANDARD_DETAIL };
  /* END DEC-49 REGION is-standard-held */
}
const NO_SUCH_STANDARD_DETAIL = "no standard answers to that id here. One your credential may not read is answered "
  + "exactly as one that does not exist.";
const NO_SUCH_STANDARD_FIXED = new Set(["ok", "reason", "code", "check", "translation", "standard", "detail"]);

/** R23 (K1563 (10)): THE answer to one condition, a portion named that the standard does not record (`PORTION_UNKNOWN`):
 *  minted here and nowhere else; R23, R26 and `progressions` R39 answer through it. `extra` adds a caller's own fields
 *  and never replaces these. It writes nothing and never throws. */
export function portionUnknown(standardId, portion, extra = null) {
  let own = [];
  try { if (extra && typeof extra === "object" && !Array.isArray(extra)) own = Object.entries(extra); } catch { own = []; }
  const p = portion == null ? null : String(portion).slice(0, 200);
  /* DEC-49 REGION is-portion-held */
  return refusal("PORTION_UNKNOWN", `${standardId ?? "the standard"} records no portion '${p ?? ""}'. Nothing was written.`,
                 { ...Object.fromEntries(own.filter(([k]) => !["ok", "reason", "code", "check", "translation", "detail",
                                                                "standard", "portion"].includes(k))),
                   standard: standardId ?? null, portion: p });
  /* END DEC-49 REGION is-portion-held */
}

/* R5, R7: this module's own answer, through R17, naming the id also as `id` (the field its readers key on, filings R14). */
const refuseNoSuchStandard = (id) => noSuchStandard(id, { id });

/* R5, R7: a read that names no standard (N269: its own coded row, never a codeless `NO_ID`; K275). */
function refuseNoId(op) {
  /* DEC-49 REGION is-standard-named */
  return refusal("STANDARD_NO_ID", `a standard is read by its id, and none was named: ${op} takes id=<standard id>. `
                 + "Nothing was answered.", { op });
  /* END DEC-49 REGION is-standard-named */
}

function refuseDateInvalid(date) {
  /* DEC-49 REGION is-date-readable */
  return refusal("STANDARD_DATE_INVALID", "a date is written YYYY-MM-DD and names a day that exists.",
                 { date: typeof date === "string" ? date.slice(0, 40) : null });
  /* END DEC-49 REGION is-date-readable */
}

/** The ops whose handlers are this module's (K3): the control plane routes, authenticates and stamps them (`author` and
 *  `proposer` in the body; `viewer` in the URL, read after the body so a body cannot set it). `plane` spreads them into
 *  its route table (`src/plane/store.mjs`). The body is passed whole, so a declaration's `reason` reaches R1. */
export function standardsOps(s, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = body || {};
  return {
    standarddeclare: () => s.standardDeclare({ ...b, viewer: qp("viewer") }),
    standard: () => s.standardRead({ id: qp("id"), viewer: qp("viewer") }),
    standards: () => s.standardsIn({ at: qp("at"), kind: qp("kind"), source: qp("source"), cite: qp("cite"), family: qp("family"),
                                     after: qp("after"), limit: qp("limit"), viewer: qp("viewer") }),
    standardinforce: () => s.inForce(qp("id"), qp("date")),
    standardpropose: () => s.standardPropose({ ...b, viewer: qp("viewer") }),
    standardadopt: () => s.standardAdopt({ ...b, viewer: qp("viewer") }),
    /* T33-31: R20, R21, R23–R27 (the ops are declared by op-declarations, T33-88) */
    inforceat: () => s.inForceAt({ key: qp("key"), standard: qp("id"), portion: qp("portion"), date: qp("date"),
                                   viewer: qp("viewer") }),
    standardsfor: () => s.standardsFor({ target: qp("target"), limit: qp("limit"), viewer: qp("viewer") }),
    lawrelate: () => s.lawRelate({ ...b, viewer: qp("viewer") }),
    lawrelations: () => s.lawRelationsOf({ standard: qp("id"), viewer: qp("viewer") }),
    lawwithdraw: () => s.lawWithdraw({ relation: b.relation ?? null, reason: b.reason ?? null, author: b.author ?? null }),
    lawpropose: () => s.lawPropose({ ...b, viewer: qp("viewer") }),
    lawaddresses: () => s.addressesOf({ key: qp("key"), portion: qp("portion"), viewer: qp("viewer") }),
    courtlink: () => s.courtLink({ ...b, viewer: qp("viewer") }),
    courttreat: () => s.courtTreat({ ...b, viewer: qp("viewer") }),
    stillstanding: () => s.stillStanding({ decision: qp("id"), date: qp("date"), viewer: qp("viewer") }),
    citationresolve: () => s.resolveCourtCitation({ citation: qp("citation"), lookup: qp("lookup") === "1",
                                                   viewer: qp("viewer") }),
    /* T35-31: R35, R37, R38, R40, R43 (the ops are declared by op-declarations, T35-70) */
    standardforce: () => (b.proposal != null ? s.forceConfirm({ ...b, viewer: qp("viewer") })
                                             : s.forceDeclare({ ...b, viewer: qp("viewer") })),
    standardforcepropose: () => s.forcePropose({ ...b, viewer: qp("viewer") }),
    standardforcewithdraw: () => s.forceWithdraw({ force: b.force ?? null, reason: b.reason ?? null, author: b.author ?? null,
                                                   viewer: qp("viewer") }),
    forcesof: () => s.forcesOf({ standard: qp("id"), viewer: qp("viewer") }),
    standardrelease: () => s.releaseStandard({ standard: b.standard ?? null, reason: b.reason ?? null, author: b.author ?? null,
                                               viewer: qp("viewer") }),
    overridesof: () => s.overridesOf({ standard: qp("id"), viewer: qp("viewer") }),
    standardadoption: () => s.adoptionRecord({ ...b, viewer: qp("viewer") }),
    editioninforce: () => s.editionInForce({ designation: qp("designation"), standard: qp("id"), body: qp("body"),
                                             date: qp("date"), viewer: qp("viewer") }),
    bindsat: () => s.bindsAt({ standard: qp("id"), body: qp("body"), date: qp("date"), viewer: qp("viewer") }),
    standardimpose: () => s.impositionRecord({ ...b, viewer: qp("viewer") }),
    standardbenchmark: () => s.benchmarkDeclare({ ...b, viewer: qp("viewer") }),
    /* T36-15: R50 (the ops are declared by op-declarations, T36-35) */
    standardinforcethrough: () => s.inForceThroughRecord({ ...b, viewer: qp("viewer") }),
    standardinforcethroughwithdraw: () => s.inForceThroughWithdraw({ record: b.record ?? null, reason: b.reason ?? null,
                                                                     author: b.author ?? null, viewer: qp("viewer") }),
    inforcethroughof: () => s.inForceThroughOf({ standard: qp("id"), viewer: qp("viewer") }),
    /* T48-21: R57 (declared by op-declarations and routed by control-plane at their L11 jobs) */
    standardproposals: () => s.proposalsFor({ project: qp("project"), state: qp("state"), after: qp("after"), limit: qp("limit"),
                                              viewer: qp("viewer") }),
  };
}

/* R61 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  standardinforce: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("standards.declared.standardinforce", "read: whether one standard was in force on a date, with why; writes nothing"),
    fields: { accepts: ["id","date"], requires: ["id","date"] } },
  standarddeclare: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("standards.declared.standarddeclare", "standard-directed: a member records a standard (citation, kind, issuer, captured text, period), optionally superseding an earlier one, with the declarer's reason for holding the government to it, now required (standards R1; DEC-88: `reasoned`); writes an STD- bundle"),
    fields: { accepts: ["cite","kind","issuer","reason","text","period","supersedes","instrument","portion","requires","copy","current_through","period_basis","held","cited_by","search","family","copy_claimed","version_basis","overrides","force_source","designation","edition","access","target","question"], requires: ["cite","kind","issuer","reason"] } },
  standardadopt: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("standards.declared.standardadopt", "proposal-directed: a member adopts a standard proposal, keyed by proposal id, with the adopter's own reason, now required (standards R10, through R1; DEC-88: `reasoned`) — the proposal's why is the proposer's; writes an STD- bundle naming it"),
    fields: { accepts: ["cite","kind","issuer","reason","text","period","supersedes","instrument","portion","requires","copy","current_through","period_basis","held","cited_by","search","family","copy_claimed","version_basis","overrides","force_source","designation","edition","access","target","question","proposal"], requires: ["proposal"] } },
  lawrelate: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("standards.declared.lawrelate", "standard-directed: keyed by a new relation between two standards or portions; writes standards' rows and moves no bundle"),
    fields: { accepts: ["type","from","to","citation","effective","edition","reason","proposal"], requires: [["type","proposal"],["from","proposal"],["to","proposal"],["citation","proposal"],["reason","proposal"]] } },
  courtlink: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("standards.declared.courtlink", "standard-directed: keyed by a court standard and a portion; writes standards' rows and moves no bundle"),
    fields: { accepts: ["type","from","to","citation","reason","proposal"], requires: [["type","proposal"],["from","proposal"],["to","proposal"],["citation","proposal"],["reason","proposal"]] } },
});

const instances = new WeakMap();
/* R48 (K1563 (1)): the instance the module's one registration in connection-grammar's default registry reads: the
   host's, when the registry passes `host`, else the isolate's one instance; with several and no host, ambiguous. */
let current = null, constructed = 0;
function ownerRead(a) {
  const { host, ...rest } = a && typeof a === "object" ? a : {};
  const s = host !== undefined && host !== null ? instances.get(host) : constructed === 1 ? current : null;
  if (s) return s.neighbours(rest);
  return host !== undefined && host !== null
    ? { refused: "OWNER_NOT_READY", why: word("standards.why.standards_instance_constructed") }
    : constructed === 0 ? { refused: "OWNER_NOT_READY", why: word("standards.why.no_standards_instance_is_constructed") }
    : { refused: "OWNER_HOST_AMBIGUOUS", why: word("standards.why.standards_instances_held", { constructed: String(constructed) }) };
}
/** R48: the owner's registration (`connection-grammar` R2), over an instance, for a registry a caller holds. */
export const connectionOwnerOf = (s) => ({ owner: CONNECTION_OWNER, kinds: CONNECTION_KINDS.map((k) => ({ ...k })),
                                          neighbours: (a) => s.neighbours(a) });
/* R48: registered once at load as the connection owner `standards` of law-relations' kinds. */
registerOwner({ owner: CONNECTION_OWNER, kinds: CONNECTION_KINDS.map((k) => ({ ...k })),
  neighbours: ownerRead });

/** K61: the one instance per host, created on the first call with `deps`. Its tables are created with it (R16); it
 *  registers its check with promotion (R39, for R11) and its tables with purge (R14). */
export function standardsOf(host, deps) {
  let s = instances.get(host);
  if (!s) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    s = new Standards({ ...d, storage, record, membership, promotion,
                        content: d.content || (() => contentOf(host, { record, membership })),
                        events: d.events || (() => eventsOf(host, { record, membership })),
                        entities: d.entities || (() => entitiesOf(host, { record, membership })),
                        capture: d.capture || (() => captureOf(host, { record })) });
    instances.set(host, s);
    current = s;
    constructed++;
    record.declareTable("standards", STANDARDS_TABLES.map((t) => ({ ...t })));
    promotion.registerStep("standards", { check: (c) => s.check(c) });
  }
  return s;
}
