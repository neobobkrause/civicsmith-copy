/* strength — what a claim is worth, derived and never stated (requirements: `build/requirements/strength.md`; DEC-21,
 * DEC-32, DEC-44). A PAIR of independent measurements, the weakest capture among the documents a conclusion reaches
 * and the weakest connection among the edges it rests on, with testimony beside them, never composed into one value.
 * This module derives the pair over an inquiry's live basis (R1–R6), over one version of it (R7–R10) and over a
 * candidate's legs (R26); says whether the parts of a reading share an upstream origin (R11, R12, R27); judges an
 * observation credited anonymously by what bears it out (R29, R30); answers the pair the search cache holds (R13); and
 * holds the bar, the standard of evidence a project declares, set by its own act, and the group's default for new
 * projects (R14–R16, R40).
 *
 * Extracted from the legacy modules (T7, layer 6; K3, K86, K102, N60): `store.mjs` (the bar, DEC-72; the axes and the
 * walk, REC-12, REC-42, MK-2, REC-105; `op=inquirystrength`, REC-34; the pair over a version, PL-14; independence,
 * D-195, D-271, REC-161, REC-192), `schema.mjs` (`group_strength_bar`, now `./schema.mjs`) and the check catalogue
 * (C-30, C-71, C-32.9, now `./checks.mjs`). The arithmetic is `./arithmetic.mjs`. The legacy code's comments moved
 * with it, shortened where they only restated the code.
 *
 * R5 (K102) is new with the extraction: a hunch leg is inert in every pair, so the live pair and the pair over a
 * version agree. Every walk now bounds a capture grade by what the record earns for its target (R1), the pair over a
 * version and over a candidate included, so an inquiry leg contributes the target's own answer (R2) on every path.
 *
 * T22 (layer 6): every pair answer states how many hunch legs it left out (R5; DEC-104, H10); the group's default bar
 * is set with the administrator's reason and answered with it, its note carrying DEC-105's words (R15, R16; DEC-88,
 * H12); and a caller may state each observation's credit level, under which an anonymous observation counts only
 * beside something independent that bears it out (R29, R30; DEC-102).
 *
 * T28 (layer 6): the grading method is versioned and stated in plain words, and a pair recomputes from a case file's
 * facts alone (R31, R32; DEC-112), by the one arithmetic the live walk composes by (`./method.mjs`); a leg on another
 * group's accepted finding counts at what that edition publishes, read through `accepted-work` (R33; DEC-96 item 1);
 * and `levels` may name an off-the-record capture, whose anonymously attested evidence counts only beside something
 * independent (R34; DEC-119 (3)).
 *
 * T31 (layer 6): the product is named Civicsmith (DEC-124): the bar's honest note says so (R15), and the method's words
 * take the product's name from their caller, "CivicOS" answering the words that version answered before (R31; K1365 (1)).
 *
 * T33 (layer 6, T33-47; K1447, K1470): independence fails on more than a shared document, capture or address: one
 * issuing source, a shared person, a shared event, a shared ledger table, or an `acts_for` or `within` tie, each named,
 * and a tie undetermined on the documents' dates is named undetermined (R12, `./origins.mjs`); a calculation, a held
 * standard and a duty occurrence are legs on the capture axis, their grades derived from what they rest on (R36–R38,
 * `./legs.mjs`), so the method moved to version 2 (R31); and the tables are declared explicitly, the cache read through
 * record-core's derived-cache convention so a stale row is never answered as current (R39).
 *
 * T34 (layer 6): a calculation leg is graded through calculations' synchronous read of its grade facts (its R30;
 * T34-31, N576), with the method's version named beside the grade; and the sentences a member reads name the group's
 * Civicsmith as "your group's Civicsmith", or need no name (DEC-149; T34-86).
 *
 * T47 (layer 6, T47-19; N976, K3003): a project's own bar is set by a served act, `projectBarSet` (`op=projectbarset`),
 * written into the project's document with a Session Log entry and promoted through promotion, distinct from the
 * group's default (R40); `MACHINE_CANNOT_DECLARE` and `BAD_GRADE` are each minted at one site both bar acts answer
 * through (K231).
 *
 * REACHED as `strengthOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps`, returned to every later caller. At creation it declares its tables to record-core's purge
 * (`strength_cache` by bundle, `group_strength_bar` exempt, R23), registers its projection with promotion (the cache,
 * R13, promotion R39) and the pair with `inquiry`'s grouping act (`onGrounded("strength", …)`, R17, N152). The cache's
 * columns are registered with retrieval as the `capture` and `connection` fields (R23, retrieval R62; N137) by the first
 * call that hands `retrieval` in, whenever it comes (the plane store's, at boot), as basis-versions takes it; a host with no
 * retrieval (a test's) is not given one, which would join retrieval's projection to every promotion there.
 * `deps`:
 *   record       `recordOf(host)` unless given: `readFile` (a project's bundle.md, R14), `head` and `livePaths` (R40),
 *                `declareTable`, and the derived-cache convention's `rebuildDerived`, `readDerived`, `markStale` (its
 *                R21, R77; R39).
 *   membership   `membershipOf(host)` unless given: `inSight(id, viewer)` (R6, R22), `isAdministrator(id)` (R15),
 *                `projectAuthority` and `positionalMember` (its R55; R40).
 *   inquiry      the walk's one reader: `basisFor(id) → {legs}`, `earned(subject, targets) → {earned: {capture,
 *                connection, testimony}, subject_entity, subject_known}`, `legCapped(stated, earned, targetId)` and
 *                `restingOn(id)` (leg-earning R1, R2, R4), `subjectEntityOf(id)` and `onGrounded(module, fn)` (inquiry's,
 *                its R42) when it offers one. Default: `legEarningOf(host)` with its module-level `legCapped`, and
 *                `inquiryOf(host)`, each reached lazily as the other modules are (N218; K1612).
 *   acceptedWork `acceptedFinding({ref, edition, viewer})` (accepted-work R2; R33). Default: `acceptedWorkOf(host)`,
 *                reached lazily on the first ref read (K1307); with nothing registered there, a ref reads `{absent: true}`.
 *   versions     `currentOf(project, inquiry, viewer) → {version} | null` (basis-versions R11). Default:
 *                `basisVersionsOf(host)`, reached lazily on the first read that names a project. The version rows and
 *                legs are read from `inquiry_basis_versions` and `inquiry_basis_version_legs`.
 *   promotion    `promotionOf(host)` unless given: `registerStep(module, {project})` (R13), `fact("producingGroup")`,
 *                `promote(pkg)` (R40).
 *   retrieval    when given: `registerField(module, field, {table, key, col})` (R23).
 *   producingGroup  the store's recorded group or null; default: promotion's fact `producingGroup`.
 *   now          the clock for the instants it writes, an ISO string (default: the wall clock).
 *   events, lines, people, money, duties, calculations   the layer-5 modules R12, R36 and R38 read, each `<name>Of(host)`
 *                unless given (K1563 (1)): `events.readEvent`, `lines.structureAt` and `linesOf`, `people.identityOf`,
 *                `money.readFact`, `duties.readDuty` and `occurrencesOf`, and `calculations.gradeFactsOf` (its R30: R9's
 *                grade facts, read synchronously; T34-31).
 *
 * READ CONTRACTS it joins in its own SQL: record-core's `bundles` (`bundle_id`, `object_type`, its R37) and
 * provenance's `register` (with `authored` and `author`, R29, R30) and `captured_locators` (its R48); since T33 events'
 * `event_attestations` (its R37) and entities' `entities.kind` (its R35), read by `./origins.mjs`. */

import { recordOf } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, noSuchProject } from "../membership/index.mjs";
import { promotionOf, PROMOTION_ROW_CHECKS } from "../promotion/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { legEarningOf, legCapped } from "../leg-earning/index.mjs";
import { acceptedWorkOf } from "../accepted-work/index.mjs";
import { basisVersionsOf, BASIS_VERSION_LEGS_MAX, VERSION_MACHINE } from "../basis-versions/index.mjs";
import { BASIS_GRADES, TESTIMONY_GRADE, normalizeType, OBJECT_TYPES, BUNDLE_ID_RE, parseFrontmatter,
         isMachineIdentity, idPattern } from "../record-grammar/index.mjs";
import { IMPORTED_FINDING_RE, parseImportedFindingRef } from "../inquiry-grammar/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { linesOf } from "../lines/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { peopleOf } from "../people/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { STRENGTH_AXES, DEPTH_BOUND, GRADE_RANK } from "./arithmetic.mjs";
import { legKind, parseOccurrenceRef, OCCURRENCE_REF_RE, DERIVED_KINDS } from "./legs.mjs";
import { originsReader, ORIGIN_LIMIT, RECORD_READER } from "./origins.mjs";
import { levelPair, anonymityOf, levelsGiven, HUNCH_WHY, UNCORROBORATED_WHY, UNCORROBORATED_EVIDENCE_WHY,
         GRADING_METHOD_VERSION } from "./method.mjs";
import { VERSION_STRENGTH_CHECKS, VERSION_STRENGTH_DEFAULT_STATES, VERSION_STRENGTH_INERT_SOURCES,
         PARTITION_INDEPENDENCE_CHECKS, STRENGTH_BAR_CHECKS } from "./checks.mjs";
import { STRENGTH_EXEMPT_TABLES, STRENGTH_PURGED_TABLES, STRENGTH_CACHE_TABLE, STRENGTH_CACHE_FIELDS,
         migrateStrength } from "./schema.mjs";

export { STRENGTH_AXES, DOCUMENT_AXES, DEPTH_BOUND, GRADE_RANK, STRENGTH_STATES } from "./arithmetic.mjs";
export { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS, gradingMethodText, recomputePair, CREDIT_LEVELS,
         PRODUCT_NAME } from "./method.mjs";
export { VERSION_STRENGTH_CHECKS, VERSION_STRENGTH_DEFAULT_STATES, VERSION_STRENGTH_INERT_SOURCES,
         PARTITION_INDEPENDENCE_CHECKS, STRENGTH_BAR_CHECKS } from "./checks.mjs";
export { STRENGTH_SCHEMA, STRENGTH_EXEMPT_TABLES, STRENGTH_PURGED_TABLES, STRENGTH_CACHE_TABLE,
         STRENGTH_CACHE_FIELDS } from "./schema.mjs";

/* R8: the legs one version is measured over, and (R11) the most a proposed partition may place, is basis-versions' own
   per-version bound (its R9), `BASIS_VERSION_LEGS_MAX`, read from it and never restated (N184); re-exported under the
   name this module's callers use. */
export { BASIS_VERSION_LEGS_MAX as VERSION_LEGS_MAX } from "../basis-versions/index.mjs";
export { ORIGIN_LIMIT, SHARED_NAMED_MAX } from "./origins.mjs";
export { OCCURRENCE_REF_RE, parseOccurrenceRef } from "./legs.mjs";
/** R7: how many state words a caller may name; the machine's own size, so it cannot go stale. */
export const VERSION_STRENGTH_STATES_MAX = VERSION_MACHINE.legal.length;
/** R26: the longest error message a candidate pair answers. */
export const CANDIDATE_ERROR_MAX = 200;
/** R44: the most inquiries one `inquirystrength` call may name in `ids`. */
export const INQUIRY_STRENGTH_IDS_MAX = 50;

/* R10: every spelling this record has reached for when it meant "the strength". The guard fails on the NAME, before
   anybody reasons about the value; `pair` is checked separately, by totality. */
const PAIR_COMPOSED_KEYS = Object.freeze(["strength", "grade", "score", "overall", "composed", "letter", "rating", "value"]);
/* R6: the fields of a named member that hold a bundle id; a member naming an unseen one in any but `through` is
   withheld whole. */
const MEMBER_ID_FIELDS = Object.freeze(["bundle_id", "target_id", "inherited_from", "through"]);
/* R6 (DEC-36): the one sentence a swept prose string ends in, the same whatever and however much was withheld. */
const OUT_OF_VIEW_WORDS = word("strength.out_of_view_words");
/* R33: a leg on an imported finding reference, by `inquiry-grammar`'s one spelling (its R11; K1305). */
const isImportedRef = (id) => parseImportedFindingRef(id) !== null;
/* R6: a record id as it appears in a sentence, derived from the catalogue's own patterns by dropping their anchors, so
   they cannot come to disagree about what an id looks like; a ref (R33) is matched whole, before the record id its
   tail would otherwise be read as. */
const unanchored = (re) => re.source.replace(/^\^/, "").replace(/\$$/, "");
/* T33 (R36–R38): a calculation's, a standard's and an occurrence's ids too, which name no bundle. */
const ID_IN_PROSE = new RegExp(`(?:${unanchored(IMPORTED_FINDING_RE)}|${unanchored(OCCURRENCE_REF_RE)}`
  + `|${unanchored(BUNDLE_ID_RE)}|${unanchored(idPattern("CALC"))}|STD-\\d{4}-\\d{4,})`, "g");
/** R15 (DEC-88): the longest reason an administrator may give for the group's default bar. */
export const BAR_REASON_MAX = 2000;
/* R15 (DEC-105, H12): the bar's honest note, in the ruling's words, the product named as DEC-124 names it. */
const BAR_HONEST_NOTE = word("strength.bar_honest_note");

const isHunch = (source) => typeof source === "string" && VERSION_STRENGTH_INERT_SOURCES.includes(source);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
/* R5: how many of these legs are hunches, each left out of the pair. */
const hunchCount = (legs) => legs.filter((l) => isHunch(l.grade_source)).length;

const typeOfId = (id) => normalizeType(OBJECT_TYPES[String(id ?? "").split("-")[0]]) ?? "";

/* D-450: an axis nobody set is stated in words, never as a grade, a dash or "null". */
export function barAxisWords(bar) {
  return ["capture", "connection"]
    .map((axis) => bar[axis] == null ? word("strength.map.bar_set_axis", { axis }) : `${axis} ${bar[axis]}`)
    .join(", ");
}

/* R15, R40: a refusal of the bar's own rows (C-32.9, C-107), with its code, row and translation (DEC-49). */
function barRefusal(code, detail, extra) {
  const row = STRENGTH_BAR_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}

/* R15, R40 (K231): the one site `MACHINE_CANNOT_DECLARE` (C-32.9) is minted, for the group's default and a project's
   own bar alike: a bar is a declaration by people about their own work, so an empty or machine author is refused.
   `whose` is "team" or "project": whose declaration it is. Null to proceed. */
function machineCannotDeclare(author, whose) {
  const who = String(author ?? "").trim();
  /* DEC-49 REGION is-machine-strength-bar */
  if (!who || isMachineIdentity(who))
    return barRefusal("MACHINE_CANNOT_DECLARE", whose === "project"
      ? localize("strength.index.the_required_evidentiary_strength_project",
          "the required evidentiary strength is the PROJECT's declaration about its own work. A machine credential may not make it. Sign in as a member.")
      : localize("strength.index.the_required_evidentiary_strength_team",
          "the required evidentiary strength is the TEAM's declaration about its own work. A machine credential may not make it. Sign in as a member."));
  /* END DEC-49 REGION is-machine-strength-bar */
  return null;
}

/* R15, R40 (N208, K275, K231): the one site `BAD_GRADE` (C-107.2) is minted: an axis given that is not a grade. Null to
   proceed; an axis not given (null or absent) is not asked. */
function badGrade(capture, connection) {
  /* DEC-49 REGION is-strength-bar-grade */
  for (const [axis, v] of [["capture", capture], ["connection", connection]])
    if (v != null && !BASIS_GRADES.includes(v))
      return barRefusal("BAD_GRADE", localize("strength.index.axis_must_be_one_of_or_null",
        "{axis} must be one of {grades}, or null", { axis, grades: BASIS_GRADES.join(", ") }), { axis });
  /* END DEC-49 REGION is-strength-bar-grade */
  return null;
}

/* R45 (K5157): `expected`, the bar the writer saw (`{capture, connection}`, each null for none), against the bar the
   project holds now (`previous`, R14's answer). Absent (undefined or null) is not asked, R40's last writer standing; a
   value that is not a pair of grades-or-null is `BAD_GRADE` naming `expected`; a bar changed since is `BAR_STALE` with
   `previous`. The sentence names the bar, never who changed it. Null to proceed. */
function staleBar(expected, previous, project) {
  if (expected == null) return null;
  if (typeof expected !== "object" || Array.isArray(expected))
    return barRefusal("BAD_GRADE", localize("strength.index.expected_must_be_the_bar_you_saw",
      "{axis} must be the bar you saw, as a capture and a connection grade, each null for none", { axis: "expected" }), { axis: "expected" });
  const bad = badGrade(expected.capture, expected.connection);
  if (bad) return { ...bad, axis: "expected", detail: localize("strength.index.expected_must_be_the_bar_you_saw",
    "{axis} must be the bar you saw, as a capture and a connection grade, each null for none", { axis: "expected" }) };
  /* DEC-49 REGION is-project-bar-fresh */
  if ((expected.capture ?? null) === (previous.capture ?? null) && (expected.connection ?? null) === (previous.connection ?? null))
    return null;
  return barRefusal("BAR_STALE", localize("strength.index.the_projects_bar_changed_after_you_read_it",
    "The project's bar is now {bar}; it changed after you read it. Nothing was changed.",
    { bar: barLogWords(previous) }), { project, previous });
  /* END DEC-49 REGION is-project-bar-fresh */
}

/* R40: a bar as a Session Log states it: an absent one as "no bar", never as a bar of zero. */
const barLogWords = (bar) => (bar && bar.declared ? barAxisWords(bar) : "no bar");

/* R40: the project document with `required_strength` replaced by `bar` (both axes, null where not given) and
   `last_updated` set, every other line as it stood; null when the document has no front-matter block to splice. */
function spliceProjectBar(text, bar, at) {
  const lines = String(text).split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1) return null;
  const fm = lines.slice(1, end);
  const block = ["required_strength:", `  capture: ${bar.capture ?? "null"}`, `  connection: ${bar.connection ?? "null"}`];
  const out = [];
  let placed = false, skipping = false;
  for (const l of fm) {
    if (skipping && /^\s/.test(l)) continue;
    skipping = false;
    if (/^required_strength\s*:/.test(l)) { out.push(...block); placed = true; skipping = true; continue; }
    if (/^last_updated\s*:/.test(l)) continue;
    out.push(l);
  }
  if (!placed) out.push(...block);
  out.push(`last_updated: "${at}"`);
  return ["---", ...out, ...lines.slice(end)].join("\n");
}

/* R40: one Session Log entry, appended at the end of the `## Session Log` section (opened when the document has none),
   as every act that revises a document writes it (C-13.2). */
function appendSessionLog(text, entry) {
  const at = text.indexOf("## Session Log");
  if (at < 0) return `${text.replace(/\n*$/, "\n")}\n## Session Log\n\n${entry}`;
  const nxt = text.indexOf("\n## ", at + 1);
  const cut = nxt === -1 ? text.length : nxt + 1;
  const head = text.slice(0, cut);
  return `${head}${head.endsWith("\n") ? "" : "\n"}${entry}${nxt === -1 ? "" : "\n"}${text.slice(cut)}`;
}

/* N218, T33 (K1612): the reads the walk makes as one reader: the earned registry, the cap and the resting-on reads from
   `leg-earning` (its R1, R2, R4, with its module-level `legCapped`), and the subject and the grouping act's slot from
   `inquiry` (its R13's subject, R42), each module reached on first use. */
function inquiryReader(earning, inquiry) {
  return { basisFor: (id, o) => earning().basisFor(id, o), earned: (s, t, c) => earning().earned(s, t, c), legCapped,
           restingOn: (id) => earning().restingOn(id),
           subjectEntityOf: (id) => inquiry().subjectEntityOf(id), onGrounded: (m, fn) => inquiry().onGrounded(m, fn) };
}

export class Strength {
  #deps;
  #joined = false;
  #versionEdition = undefined;
  #projecting = null;

  constructor({ storage, record, membership, inquiry = null, versions = null, acceptedWork = null, promotion = null,
                producingGroup = null, now = null, host = null, calculations = null, duties = null, events = null,
                lines = null, people = null, money = null }) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.#deps = { inquiry, versions, acceptedWork, promotion, host, calculations, duties, events, lines, people, money };
    this.producingGroup = typeof producingGroup === "function" ? producingGroup : () => null;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  /* The providers reached lazily (K61, N218): each is created on the same host on first use, unless a caller passed
     its own. A test may replace one by assignment. */
  get inquiry() {
    const opts = { record: this.record, membership: this.membership };
    return this.#deps.inquiry ||= inquiryReader(() => legEarningOf(this.#deps.host, opts), () => inquiryOf(this.#deps.host, opts));
  }
  set inquiry(v) { this.#deps.inquiry = v; }
  /* R40: the one write path a project's own bar is promoted through (promotion's `promote`). */
  get promotion() { return this.#deps.promotion; }
  /* R33: accepted-work's read (its R2), on the same host, reached on the first ref read (K1307). */
  get acceptedWork() {
    if (!this.#deps.acceptedWork && this.#deps.host)
      this.#deps.acceptedWork = acceptedWorkOf(this.#deps.host,
        { record: this.record, ...(this.#deps.promotion ? { promotion: this.#deps.promotion } : {}) });
    return this.#deps.acceptedWork;
  }
  /* T33 (R12, R36, R38): the layer-5 modules the origins and the derived legs read, each on the same host, reached on
     first use (K1563 (1)); a module that cannot be built here is null and its reads answer nothing. */
  #upstream(name, make) {
    if (this.#deps[name] == null && this.#deps.host) {
      try { this.#deps[name] = make(this.#deps.host); } catch { this.#deps[name] = false; }
    }
    return this.#deps[name] || null;
  }
  get events() { return this.#upstream("events", (h) => eventsOf(h, { record: this.record, membership: this.membership })); }
  get lines() { return this.#upstream("lines", (h) => linesOf(h, { record: this.record })); }
  get money() { return this.#upstream("money", (h) => moneyOf(h, { record: this.record, membership: this.membership })); }
  get people() { return this.#upstream("people", (h) => peopleOf(h, { record: this.record, membership: this.membership })); }
  get duties() { return this.#upstream("duties", (h) => dutiesOf(h, { record: this.record, membership: this.membership })); }
  get calculations() {
    return this.#upstream("calculations", (h) => calculationsOf(h, { record: this.record, membership: this.membership }));
  }
  get versions() {
    if (!this.#deps.versions && this.#deps.host)
      this.#deps.versions = basisVersionsOf(this.#deps.host, { record: this.record, membership: this.membership });
    return this.#deps.versions;
  }

  /** R17 (N152): the pair the grouping act carries before and after (inquiry R28, R42), registered by this module
   *  itself. Answers the registration's own answer, or null when the inquiry reached offers no slot. */
  registerGrounded() {
    const k = this.inquiry;
    if (!k || typeof k.onGrounded !== "function") return null;
    return k.onGrounded("strength", (id) => {
      const s = this.strengthOf(id);
      return { ...Object.fromEntries(STRENGTH_AXES.map((a) => [a, s[a]])), hunches_left_out: s.hunches_left_out };
    });
  }

  migrate() { migrateStrength(this.sql); }

  /** R23 (N137): registers the cache's two grade columns with retrieval as the `capture` and `connection` fields (its
   *  R62), once per instance; answers retrieval's answers, or null when this instance has registered already. */
  joinRetrieval(retrieval) {
    if (this.#joined || !retrieval || typeof retrieval.registerField !== "function") return null;
    this.#joined = true;
    return Object.entries(STRENGTH_CACHE_FIELDS).map(([field, relation]) => retrieval.registerField("strength", field, relation));
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { return this.#rows(q, ...a)[0] ?? null; }

  /* R22: whether the viewer may see one bundle, by membership's one rule (its R43); an absent id and an unseen one are
     the same answer. */
  #visible(id, viewer) {
    if (!id) return false;
    const g = viewerPredicate(viewer);
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${g.sql})`, id, ...g.args);
  }

  /* R6: the same question of ONE id, as a function: a visible id passes, an unseen one answers null, a value naming no
     bundle is left alone. A ref (R33) is seen only when `accepted-work` answers this viewer a finding for it at the
     edition the walk read (`refs`), as an import the viewer may not see answers null. Memoised for the one answer it
     serves. */
  #redactor(viewer, refs = new Map()) {
    const g = viewerPredicate(viewer);
    if (g.scope === "member") return (id) => id ?? null;          /* a machine credential: not filtered */
    if (g.scope === "DENY") return (id) => (id ? null : id ?? null);
    const memo = new Map();
    const seesRef = (id) => {
      const edition = refs.get(id) ?? null;
      if (edition == null) return false;
      const f = this.#acceptedFinding(id, edition, viewer);
      return !!(f && typeof f === "object" && !f.absent && !f.unreadable);
    };
    return (id) => {
      if (!id) return id ?? null;
      if (!memo.has(id))
        memo.set(id, isImportedRef(id) ? seesRef(id) : this.#sees(id, viewer, g));
      return memo.get(id) ? id : null;
    };
  }

  /* R6 for one id the redactor asks about: a bundle by membership's rule; a calculation as `calculations` answers it
     to this viewer (its R10: an input unseen withholds it whole); an occurrence as `duties` answers its obligation to
     this viewer; a held standard is the group's law, seen by every viewer the gate admits. */
  #sees(id, viewer, g) {
    const kind = Strength.#kindOf({ target_id: id });
    if (kind === "calculation") { const f = this.#calcFacts(id, viewer); return !!(f && f.found); }
    if (kind === "standard") return true;
    if (kind === "occurrence") {
      const ref = parseOccurrenceRef(id);
      try { const d = this.duties && this.duties.readDuty({ dutyId: ref.duty, viewer }); return !!(d && d.found); }
      catch { return false; }
    }
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${g.sql})`, id, ...g.args);
  }

  /* R1 (REC-105, D-373): the walk's whole document-target set, collected once, so the registry is asked once. It
     traverses the same edges the walk will, under the same bound, so the set is exactly the set the walk asks about. The
     subject is null on purpose: the registry's capture arm does not branch on one. Null when there is nothing to ask.
     Another group's finding (R33) is not a document and is not asked about. */
  #captureBoundsFor(bundleId, bound, topLegs = null) {
    const targets = new Set(), contentIds = new Set();
    const visit = (legs, depth) => {
      for (const leg of legs) {
        if (typeof leg.target_id !== "string" || !leg.target_id) continue;
        const kind = Strength.#kindOf(leg);
        if (kind === "imported" || DERIVED_KINDS.includes(kind)) continue;
        if (kind === "inquiry") {
          if (depth + 1 <= bound) visit(this.#legsOf(leg.target_id), depth + 1);
          continue;
        }
        targets.add(leg.target_id);
        if (kind === "document" && typeof leg.content_id === "string" && leg.content_id) contentIds.add(leg.content_id);
      }
    };
    visit(topLegs ?? this.#legsOf(bundleId), 0);
    if (!targets.size) return null;
    const reg = this.inquiry.earned(null, [...targets], [...contentIds]);
    const bounds = new Map(Object.entries((reg && reg.earned && reg.earned.capture) || {}));
    /* R1, R46 (leg-earning R15, R18): a passage the record grades at its own grain (an AI transcription's passage, a
       member's typing) bounds a leg naming that row by its own ceiling, in place of the document's. */
    bounds.passages = new Map(Object.entries((reg && reg.earned && reg.earned.content) || {})
      .filter(([, st]) => st && st.capture && st.capture.grain === "passage").map(([cid, st]) => [cid, st.capture]));
    return bounds;
  }

  /* R1, R46: the capture ceiling a leg is bounded by: its passage's own (leg-earning R15, R18) when it names one the
     record grades at the passage's grain, else its target document's. */
  static #ceilingOf(leg, captureBounds) {
    if (!captureBounds) return undefined;
    const p = captureBounds.passages && typeof leg.content_id === "string" ? captureBounds.passages.get(leg.content_id) : null;
    return p ?? captureBounds.get(leg.target_id);
  }

  /* R46 (leg-earning R18, R19): the ceiling of the typed passage a leg names, which the record grades with no letter
     stated, or null for any other leg. */
  static #typedOf(leg, captureBounds) {
    const c = Strength.#ceilingOf(leg, captureBounds);
    return c && c.record_graded === true ? c : null;
  }

  /* R46 (leg-earning R19): a leg on a typed passage as the walk counts it: on the capture axis, its stated capture
     letter kept beside (`typed_stated`, null when none) so the cap reads it, and a letter standing in for a leg stating
     none, which the cap always replaces with the record's grade or why it is unknown. A hunch stays a hunch (R5), and a
     leg stating a grade on another axis keeps it. Any other leg is unchanged. */
  static #asWalkLeg(leg, captureBounds) {
    if (!leg || isHunch(leg.grade_source) || !Strength.#typedOf(leg, captureBounds)) return leg;
    if (leg.grade != null && leg.grade_axis != null && leg.grade_axis !== "capture") return leg;
    const stated = leg.grade_axis === "capture" && GRADE_RANK[leg.grade] ? leg.grade : null;
    return { ...leg, grade_axis: "capture", grade: stated ?? BASIS_GRADES[BASIS_GRADES.length - 1], typed_stated: stated };
  }

  /* R43: an inquiry's LIVE legs. The projected basis keeps a leg whose citation the question has withdrawn (its
     reference entry marked `severed`; the projection drops the status), so the legs are read against the question's own
     bundle.md, as `connections.edgeSevered` reads it: the first reference entry naming the target. Evidence narrows
     only: an unreadable document, or no entry for the target, is live. A bounded read that was cut short and lost a leg
     to this is read again whole, so the bound counts live legs. */
  #legsOf(id, opts = undefined) {
    const b = this.inquiry.basisFor(id, opts);
    const legs = (b && Array.isArray(b.legs)) ? b.legs : [];
    const live = this.#liveLegs(id, legs);
    if (live.length === legs.length || !b.truncated) return live;
    const whole = this.inquiry.basisFor(id);
    return this.#liveLegs(id, (whole && Array.isArray(whole.legs)) ? whole.legs : []);
  }

  #liveLegs(id, legs) {
    if (!legs.length || !id || typeof this.record?.readFile !== "function") return legs;
    const md = this.record.readFile(id, "bundle.md");
    const fm = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data || {}) : {};
    /* R46: the content row a document leg names in its authored `basis[ord]` (the projected basis leg-earning R4 reads
       back does not carry it), so a leg on a passage the record grades at its own grain (a typing) is bounded by it. */
    const basis = Array.isArray(fm.basis) ? fm.basis : [];
    const named = (l) => {
      const w = basis[l.ord];
      const cid = w && typeof w === "object" && w.target === l.target_id && typeof w.content_id === "string" ? w.content_id.trim() : "";
      return cid && !l.content_id ? { ...l, content_id: cid } : l;
    };
    const refs = fm.references;
    if (!Array.isArray(refs)) return legs.map(named);
    const seen = new Set(), severed = new Set();
    for (const x of refs) {
      if (!x || typeof x !== "object" || seen.has(x.target)) continue;
      seen.add(x.target);
      if (x.status === "severed") severed.add(x.target);
    }
    return (severed.size ? legs.filter((l) => !severed.has(l.target_id)) : legs).map(named);
  }

  /* A leg's kind as the walk reads it (R2, R33, R36–R38): another group's finding by its reference, an occurrence by
     its reference, a question by its type, a calculation or a held standard by its id, else a document. */
  static #kindOf(leg) { return legKind(leg); }

  /* R33: the edition a leg on another group's finding names: the leg's own `target_edition` when it carries one, else,
     for a leg of the inquiry's own projected basis (`authored`), its authored `basis[ord]` in its bundle.md (the
     projection does not hold it). A version's or a candidate's leg carries its own. Null when none. */
  #editionOf(bundleId, leg, authored) {
    const own = Number(leg.target_edition);
    if (leg.target_edition != null && Number.isInteger(own) && own > 0) return own;
    if (!authored || !bundleId || typeof this.record?.readFile !== "function") return null;
    const md = this.record.readFile(bundleId, "bundle.md");
    const fm = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data || {}) : {};
    const written = Array.isArray(fm.basis) ? fm.basis[leg.ord] : null;
    const ed = written && written.target === leg.target_id ? Number(written.target_edition) : NaN;
    return Number.isInteger(ed) && ed > 0 ? ed : null;
  }

  /* R33: `accepted-work.acceptedFinding`'s answer for a ref at an edition: its R2 answer, `{absent: true}` when nothing
     is registered or given, `{unreadable: true}` when the read throws. */
  #acceptedFinding(ref, edition, viewer = null) {
    const aw = this.acceptedWork;
    if (!aw || typeof aw.acceptedFinding !== "function") return { absent: true };
    try { return aw.acceptedFinding({ ref, edition, viewer }); } catch { return { unreadable: true }; }
  }

  /* R33 (DEC-96 item 1): what a leg on another group's finding contributes: the pair the accepted edition publishes for
     it, read as an inquiry leg's target answer with nothing walked past it, or why it cannot be read. An acceptance
     withdrawn since changes nothing: the edition's grades stand as published. The read is a record fact, so no viewer
     narrows it (R6 withholds afterwards). */
  #importedAnswer(bundleId, leg, ctx, authored) {
    const edition = this.#editionOf(bundleId, leg, authored);
    if (ctx && ctx.refs) ctx.refs.set(leg.target_id, edition);
    if (edition == null)
      return { stopped: word("strength.stopped.leg_rests_group"), unknown: true };
    const f = this.#acceptedFinding(leg.target_id, edition, null);
    if (f && f.absent)
      return { stopped: word("strength.stopped.leg_rests_group_finding"), unknown: true };
    if (f && f.unreadable)
      return { stopped: word("strength.stopped.leg_rests_group_finding_read"), unknown: true };
    if (!f || typeof f !== "object")
      return { stopped: word("strength.stopped.leg_rests_group_finding_group", { edition }), unknown: true };
    return { pair: f.pair && typeof f.pair === "object" ? f.pair : {}, from: leg.target_id,
             another_groups: { group: f.group ?? null, case: f.case ?? null, edition: f.edition ?? edition,
                               finding: f.finding ?? null } };
  }

  /* THE WALK (R1–R5, R29, R33, R34). The top level's legs are the inquiry's projected basis, or those a caller hands
     in (a version's, R9; a candidate's, R26) — one parameter rather than a second walk, so one arithmetic serves every
     path. The recursion below always reads each sub-inquiry's own stored basis. Each level resolves its legs against
     the record (the capture ceiling, a sub-inquiry's own walk, another group's published pair, who bears out an
     anonymous leg) and composes them by the method's one arithmetic (`method.mjs`'s `levelPair`), which
     `recomputePair` composes by too.

     There is deliberately no visited set and no memo: the depth bound is what makes it terminate, so a cycle written
     around the write-time guard costs a bounded walk and reports `undetermined` (R2). */
  #walk(bundleId, depth, bound, legsOverride, ctx) {
    const captureBounds = ctx.captureBounds;
    /* R46: a leg on a typed passage is counted on the capture axis at the record's grade, at every level. */
    const legs = (legsOverride ?? this.#legsOf(bundleId)).map((l) => Strength.#asWalkLeg(l, captureBounds));
    return levelPair(bundleId, legs, {
      bound,
      kindOf: (l) => Strength.#kindOf(l),
      capCapture: (l, stated) => this.#capped(l, stated, captureBounds),
      derive: (l) => this.#derive(l, ctx),
      /* R29, R34: which legs of THIS basis are credited anonymously, and which something independent in the same basis
         bears out. The pair is a record fact, so no viewer narrows it (R6). */
      anonymous: this.#anonymousOf(legs, ctx.levels, captureBounds),
      inherit: (l) => {
        if (Strength.#kindOf(l) === "imported") return this.#importedAnswer(bundleId, l, ctx, depth > 0 || ctx.ownTop);
        if (depth + 1 > bound) return { stopped: word("strength.stopped.walk_reached_depth", { bound }) };
        return { pair: this.#walk(l.target_id, depth + 1, bound, null, ctx), from: l.target_id };
      },
    });
  }

  /* One pair over the given top-level legs (or the inquiry's own, read once), capture-bounded throughout (R1), with the
     levels R29 and R34 apply; answers the pair, the top-level legs it was taken over, and the refs it read (R33) with
     the edition each named. */
  #pairOver(bundleId, topLegs = null, levels = null) {
    const legs = topLegs ?? this.#legsOf(bundleId);
    /* `ownTop`: the top level's legs are the inquiry's own projected basis, so their editions are its authored ones. */
    const ctx = { captureBounds: this.#captureBoundsFor(bundleId, DEPTH_BOUND, legs), levels, refs: new Map(),
                  ownTop: topLegs == null };
    return { pair: this.#walk(bundleId, 0, DEPTH_BOUND, legs, ctx), legs, refs: ctx.refs };
  }

  /* R1, R37: a stated capture letter under what the record earns for its target, or null when it stands. A held
     standard the registry earns nothing for is unknown, never counted at its stated letter (R37). */
  #capped(leg, stated, captureBounds) {
    const earned = Strength.#ceilingOf(leg, captureBounds);
    if (Strength.#kindOf(leg) === "standard" && !earned)
      return { grade: null, why: word("strength.why.establishes_record_holds", { target_id: leg.target_id }) };
    /* R46: a typed passage counts at the grade the record gives it (leg-earning R19), the typist's word, one step more
       once a second member checked it; a weaker stated letter stands. */
    if (Object.hasOwn(leg, "typed_stated") && earned && earned.record_graded === true) {
      const res = this.inquiry.legCapped(leg.typed_stated ?? undefined, earned, leg.target_id);
      if (!res) return null;
      if (res.grade == null) return res;
      const typed = earned.typed && typeof earned.typed.label === "string" ? earned.typed.label : "";
      return { grade: res.grade, typed: true,
               why: leg.typed_stated
                 ? localize("strength.why.typed_passage_stated", "{target_id} rests on a member's typing ({typed}), so it counts at {grade}: a typing is worth its typist's word, one step more once another member has checked it. The letter {stated} the leg states is not taken.", { target_id: String(leg.target_id), typed, grade: String(res.grade), stated: String(leg.typed_stated) })
                 : localize("strength.why.typed_passage", "{target_id} rests on a member's typing ({typed}), so it counts at {grade}: a typing is worth its typist's word, one step more once another member has checked it.", { target_id: String(leg.target_id), typed, grade: String(res.grade) }) };
    }
    return captureBounds ? this.inquiry.legCapped(stated, earned, leg.target_id) : null;
  }

  /* R36, R38: a derived leg's capture grade, `{grade, why}`, or `{stopped: why}`; memoised for one walk. */
  #derive(leg, ctx = null) {
    const memo = ctx ? (ctx.derived ||= new Map()) : new Map();
    if (!memo.has(leg.target_id))
      memo.set(leg.target_id, Strength.#kindOf(leg) === "calculation" ? this.#deriveCalculation(leg.target_id)
                              : this.#deriveOccurrence(leg.target_id));
    return memo.get(leg.target_id);
  }

  /* R36 (`calculations` R30, T34-31): a calculation's grade facts through calculations' synchronous read, or null when
     they cannot be read (a provider answering a promise is not consumed). */
  #calcFacts(id, viewer = RECORD_READER) {
    const c = this.calculations;
    if (!c || typeof c.gradeFactsOf !== "function") return null;
    try {
      const f = c.gradeFactsOf({ calcId: id, viewer });
      return f && typeof f.then !== "function" ? f : null;
    } catch { return null; }
  }

  /* R36 (K1447 (ii)): the weakest of the inputs' captures, each capped by its derivation (the calculation's own grade
     facts, calculations R9); recipe arithmetic weakens nothing; a value another program computed is unknown until its
     agreement is measured; the method is named beside the grade, never graded. Not accepted, an input that cannot be
     read, or no facts at all: unknown, with why. */
  #deriveCalculation(id) {
    const f = this.#calcFacts(id);
    if (!f) return { stopped: word("strength.stopped.grade_facts_read", { id }) };
    if (!f.found) return { stopped: word("strength.stopped.calculation_group_civicsmith", { id }) };
    if (!f.accepted) return { stopped: word("strength.stopped.result_accepted_leg", { id }) };
    const inputs = Array.isArray(f.inputs) ? f.inputs : [];
    const engine = inputs.find((i) => i && i.engine && !i.engine_measured);
    if (engine)
      return { stopped: word("strength.stopped.uses_value_program",
                             { id, input: String(engine.name ?? localize("strength.index.an_input", "an input")) }) };
    const cap = f.capture || {};
    if (!GRADE_RANK[cap.grade])
      return { stopped: word("strength.stopped.capture_strength_unknown",
                             { id, grade: String(cap.why ?? word("strength.stopped.input_carries_capture")) }) };
    /* The method named beside the grade (its version, and its note when it has one), never graded. */
    const said = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const m = f.method && typeof f.method === "object" ? f.method : {};
    const named = [said(m.version) && `method ${said(m.version)}`, said(m.note)].filter(Boolean).join(": ");
    return { grade: cap.grade,
             why: word("strength.why.counts_weakest_capture", { id, grade: cap.grade, named: named ? ` (${named})` : "" }) };
  }

  /* R38 (K1447 (i); leg-earning R9): an occurrence's derivation (the source in force, the trigger date, the due date
     and the level searched, `duties` R9), graded at the weaker of the source's text at its version (its capture ceiling,
     leg-earning R8) and the trigger date's attestation (`events`); the state is named beside it, never grading it. */
  #deriveOccurrence(ref) {
    const parts = parseOccurrenceRef(ref);
    const unknown = (why) => ({ stopped: word("strength.stopped.leg_rests_unknown", { ref, why }) });
    const d = this.duties;
    if (!parts || !d) return unknown(word("strength.unknown.obligation_read"));
    const duty = (() => { try { return d.readDuty({ dutyId: parts.duty, viewer: RECORD_READER }); } catch { return null; } })();
    if (!duty || !duty.found) return unknown(word("strength.unknown.obligation_group_civicsmith", { duty: parts.duty }));
    let read = null;
    try { read = d.occurrencesOf({ dutyId: parts.duty, asOf: this.#asOf(), viewer: RECORD_READER }); } catch { read = null; }
    const occ = read && Array.isArray(read.occurrences) ? read.occurrences.find((o) => o && o.key === parts.key) : null;
    if (!occ) return unknown(word("strength.unknown.occurrence_key_derived"));
    const dv = occ.derivation || {};
    if (!occ.due || occ.due.undetermined) return unknown(word("strength.unknown.due_date_undetermined", { why: occ.due && occ.due.why ? `: ${occ.due.why}` : "" }));
    const inForce = dv.source_in_force || {};
    if (inForce.state === "undetermined") return unknown(word("strength.unknown.source_force_undetermined", { why: inForce.why ?? "" }).trim());
    const source = duty.duty && duty.duty.source ? duty.duty.source : {};
    if (!source.standard) return unknown(word("strength.unknown.source_holds_captured"));
    const reg = this.inquiry.earned(null, [source.standard]);
    const ceil = reg && reg.earned && reg.earned.capture ? reg.earned.capture[source.standard] : null;
    if (!ceil || !GRADE_RANK[ceil.grade])
      return unknown(word("strength.unknown.record_holds_text", { standard: source.standard, why: ceil && ceil.why ? `: ${ceil.why}` : "" }));
    let grade = ceil.grade, setter = word("strength.setter.text", { standard: source.standard });
    const trig = occ.trigger || {};
    if (trig.kind === "event") {
      let ev = null;
      try { ev = this.events ? this.events.readEvent({ eventId: trig.ref, viewer: RECORD_READER }) : null; } catch { ev = null; }
      const e = ev && ev.found ? ev.event : null;
      const gov = e && e.governing != null && Array.isArray(e.attestations)
        ? e.attestations.find((a) => Number(a.attestation_id) === Number(e.governing)) : null;
      if (!gov || !GRADE_RANK[gov.grade]) return unknown(word("strength.unknown.date_started_attested", { ref: trig.ref }));
      if (GRADE_RANK[gov.grade] < GRADE_RANK[grade]) { grade = gov.grade; setter = word("strength.setter.record_date", { ref: trig.ref }); }
    } else if (!trig.date || (typeof trig.date === "object" && trig.date.undetermined)) {
      return unknown(word("strength.unknown.date_started_undetermined"));
    }
    return { grade,
             why: word("strength.why.counts_set_weaker", { ref, grade, setter, g: String(occ.state ?? "undetermined").replace(/_/g, " ") }) };
  }

  /* The day an occurrence's state is stated as of (duties R9 reads no clock itself). */
  #asOf() {
    const n = String(this.now() || "");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(n) ? `${n.slice(0, 19)}Z` : new Date().toISOString().slice(0, 19) + "Z";
  }

  /* R29, R30 (DEC-102): the register's author of an authored observation (provenance R48's `register.author`), read and
     never answered; `observation` false for a bundle holding no authored capture. Memoised for one judgement. */
  #observationReader() {
    const memo = new Map();
    return (id) => {
      if (!memo.has(id)) {
        const r = this.#one(`SELECT author FROM register WHERE bundle_id=? AND authored=1 ORDER BY capture_sha LIMIT 1`, id);
        memo.set(id, r ? { observation: true, author: str(r.author) } : { observation: false, author: null });
      }
      return memo.get(id);
    };
  }

  /* A leg's own grade as the walk would count it on its own axis (R1, R9): null when it would count nothing. */
  #ownGrade(leg, captureBounds) {
    if (isHunch(leg.grade_source) || leg.grade == null || !STRENGTH_AXES.includes(leg.grade_axis)) return null;
    if (Strength.#kindOf(leg) !== "document") return null;
    if (leg.grade_axis === "testimony") return TESTIMONY_GRADE;
    if (leg.grade_axis === "capture" && captureBounds) {
      const capped = this.#capped(leg, leg.grade, captureBounds);
      return capped ? capped.grade : leg.grade;
    }
    return leg.grade;
  }

  /* R29, R30, R34: the method's judgement (`anonymityOf`) over ONE basis, with the record's facts: an observation and
     its author from the register, a document's captures from the register, origins by R12's one reading. `seen` (R30)
     withholds a leg the viewer may not see from bearing anything out. Empty when no levels were given. Writes nothing;
     names no author. */
  #anonymousOf(legs, levels, captureBounds, seen = () => true) {
    if (!levels) return new Map();
    const observed = this.#observationReader();
    const origins = new Map();
    const captures = new Map();
    return anonymityOf(legs, levels, {
      kindOf: (l) => {
        const k = Strength.#kindOf(l);
        return k === "document" && typeof l.target_id === "string" && l.target_id && observed(l.target_id).observation
          ? "observation" : k;
      },
      ownGrade: (l) => this.#ownGrade(l, captureBounds),
      originsOf: (l) => {
        if (!origins.has(l.target_id)) origins.set(l.target_id, this.#originsOf([l.target_id]));
        return origins.get(l.target_id);
      },
      authorOf: (l) => observed(l.target_id).author,
      capturesOf: (l) => {
        if (!captures.has(l.target_id))
          captures.set(l.target_id, this.#rows(`SELECT capture_sha FROM register WHERE bundle_id=? ORDER BY capture_sha`,
                                               l.target_id).map((r) => r.capture_sha));
        return captures.get(l.target_id);
      },
      seen: (l) => seen(l.target_id),
    });
  }

  /** R1–R5, R29, R33, R34: the derived pair for one inquiry, computed on read. One answer per axis and no scalar: a case does not
   *  have one strength. This is the authority every consumer that must be right goes through (the gated read, the
   *  pair frozen into a signed case, the grouping act's before and after, re-evaluation, the cache). It states how many
   *  hunch legs it left out (R5), and, given `levels`, which levels it applied (R29). */
  strengthOf(bundleId, { levels = null } = {}) {
    return this.#strength(bundleId, levels).answer;
  }

  /* `strengthOf`'s answer beside the refs its walk read (R33), for R6's withholding. */
  #strength(bundleId, levels) {
    if (!bundleId) return { answer: { ok: false, reason: "NO_ID", detail: localize("strength.index.strength_requires_id", "strength requires ?id=") }, refs: new Map() };
    const lv = levelsGiven(levels);
    const { pair, legs, refs } = this.#pairOver(bundleId, null, lv);
    return { answer: { ok: true, bundleId, depth_bound: DEPTH_BOUND,
                       capture: pair.capture, connection: pair.connection, testimony: pair.testimony,
                       hunches_left_out: hunchCount(legs), ...(lv ? { levels: lv } : {}) }, refs };
  }

  /** R6 (REC-34, N303): `op=inquirystrength`, the pair gated. An inquiry the viewer may not see is withheld whole,
   *  byte for byte as one that does not exist. Inside a visible answer, every member the viewer may not see is withheld
   *  whole, in the members and the prose, with no id, title, state, placeholder or count, and `out_of_view: true`
   *  states only that something was (DEC-36); every record fact about the axes stands (a derivation that changed with
   *  its reader would claim different things to different people). Computed on read, never from the cache (R13). */
  inquiryStrength({ id = null, viewer = null } = {}) {
    if (!id) return { ok: false, reason: "NO_ID",
      detail: localize("strength.index.the_derived_pair_is_asked", "the derived pair is asked of one inquiry: pass id=<record id>") };
    if (!this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    /* Refused rather than answered UNRATED: a document has no basis and no pair, and "unrated" would state a strength
       about a thing that cannot carry one. Reachable only after visibility, so it discloses nothing. */
    const row = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id);
    const ty = normalizeType(row?.object_type);
    if (ty !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target: id, object_type: ty ?? null,
        detail: localize("strength.index.is_a_not_an_inquiry_derived_pair",
          "{id} is a {type}, not an inquiry. The derived pair is a property of a question and what it rests on; a document has no basis to derive one from.",
          { id, type: ty ?? localize("strength.index.record", "record") }) };
    const { answer: s, refs } = this.#strength(id, null);
    if (!s.ok) return s;
    const keep = this.#redactor(viewer, refs);
    /* A top-level leg to an unseen target is a member of every axis's population, named in a list or not. */
    const legs = this.#legsOf(id);
    const hidden = legs.some((l) => l.target_id && keep(l.target_id) === null);
    const axes = Object.fromEntries(STRENGTH_AXES.map((a) => [a, redactAxis(s[a], keep, hidden)]));
    const withheld = STRENGTH_AXES.some((a) => axes[a].out_of_view === true);
    /* R5: the hunch legs this answer names, so a hunch on a target the viewer may not see is neither named nor counted. */
    const seenHunches = hunchCount(legs.filter((l) => !(l.target_id && keep(l.target_id) === null)));
    /* R6 (T51; K4259): the ungraded members, after the redaction above: those inert on every axis, once each by target. */
    const ungraded = ungradedEverywhere(axes);
    return { ok: true, target: id, depth_bound: s.depth_bound, ...axes, ungraded, ungraded_count: ungraded.length,
             hunches_left_out: seenHunches, ...(withheld ? { out_of_view: true } : {}) };
  }

  /** R44 (fix round 6; G12c): `op=inquirystrength` with `ids`, one `inquiryStrength` per id in one call: `{ok: true,
   *  results: {<id>: that id's single answer}}`, in the order asked, an id named twice answered once. Each id is gated
   *  exactly as the single read gates it, so an inquiry the viewer may not see has its result, `NO_SUCH_BUNDLE` as an
   *  absent one, never an omission. More than `INQUIRY_STRENGTH_IDS_MAX` ids, or anything but ids, is `BAD_IDS`, whole;
   *  none named is `NO_ID`. Computed on read, as the single read is. */
  inquiryStrengthMany({ ids = null, viewer = null } = {}) {
    const list = idsOf(ids);
    if (list === null)
      return { ok: false, reason: "BAD_IDS", limit: INQUIRY_STRENGTH_IDS_MAX,
        detail: localize("strength.index.ids_must_be_a_list_of_record_ids",
          "ids must be a list of at most {max} record ids, each named once: pass ids=<record id>,<record id>…",
          { max: INQUIRY_STRENGTH_IDS_MAX }) };
    if (!list.length)
      return { ok: false, reason: "NO_ID",
        detail: localize("strength.index.the_derived_pairs_are_asked_of_ids",
          "the derived pairs are asked of the inquiries named: pass ids=<record id>,<record id>…") };
    return { ok: true, results: Object.fromEntries(list.map((id) => [id, this.inquiryStrength({ id, viewer })])) };
  }

  /** R13: the pair the search cache holds for an inquiry, `{capture: {grade, state}, connection: {grade, state}}`, or
   *  null for any other bundle. A cache, marked so wherever it is read; nothing here answers strength from it. */
  cacheOf(bundleId, isInquiry) {
    if (!isInquiry) return null;
    const s = this.strengthOf(bundleId);
    return { capture: { grade: s.capture.grade, state: s.capture.state },
             connection: { grade: s.connection.grade, state: s.connection.state }, pair: s };
  }

  /** R13, R39: writes the cache for one bundle, `strength_cache`'s row, from R1–R5 over the legs as they now stand, and
   *  answers what it wrote (null for a bundle that is not an inquiry, whose row, if a former revision left one, goes:
   *  only an inquiry has a pair). It goes through record-core's derived-cache convention (its R77): the row is rebuilt
   *  by the table's own `rebuild`, and any mark that it had gone stale is cleared with it. Called inside the promotion
   *  that writes the legs, so the row is never a revision behind them. It is still a cache: a leg raised beneath this
   *  inquiry, or a document re-read, does not re-promote it, so the row can go stale (REC-108, D-379); the promotion of
   *  what it rests on marks it stale (`project`), and `cachedOf` never answers a stale row as current. `strengthOf` is
   *  what anything needing the truth calls. */
  writeProjection(bundleId, isInquiry) {
    this.#projecting = { bundleId, isInquiry: !!isInquiry };
    try { this.record.rebuildDerived("strength", STRENGTH_CACHE_TABLE, { bundle_id: bundleId }); }
    finally { this.#projecting = null; }
    const row = this.#one(`SELECT capture_grade, capture_state, connection_grade, connection_state FROM ${STRENGTH_CACHE_TABLE}
                             WHERE bundle_id=?`, bundleId);
    return row ? { capture: { grade: row.capture_grade, state: row.capture_state },
                   connection: { grade: row.connection_grade, state: row.connection_state } } : null;
  }

  /** R39: the cache's `rebuild` (record-core R77): R13's row for each inquiry in `scope` (one `bundle_id`, or every
   *  inquiry the record holds), computed now. A promotion in progress says whether its bundle is an inquiry. */
  rebuildCache(scope = null) {
    const id = scope && typeof scope.bundle_id === "string" ? scope.bundle_id : null;
    const ids = id ? [id] : this.#rows(`SELECT bundle_id, object_type FROM bundles ORDER BY bundle_id`)
      .filter((r) => normalizeType(r.object_type) === "inquiry").map((r) => r.bundle_id);
    const rows = [];
    for (const b of ids) {
      const p = this.#projecting;
      const isInquiry = p && p.bundleId === b ? p.isInquiry
        : normalizeType(this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, b)?.object_type) === "inquiry";
      const c = this.cacheOf(b, isInquiry);
      if (c) rows.push({ bundle_id: b, capture_grade: c.capture.grade, capture_state: c.capture.state,
                         connection_grade: c.connection.grade, connection_state: c.connection.state });
    }
    return rows;
  }

  /** R13 (promotion R39): this module's projection in every promotion, run after inquiry's (which writes the legs) in
   *  the modules' order, inside the one transaction. It adds nothing to the promotion's answer. */
  project(c) {
    if (!c || !c.bundleId) return null;
    this.writeProjection(c.bundleId, c.promotedType === "inquiry");
    this.#markDependantsStale(c.bundleId);
    return null;
  }

  /* R39 (record-core R77): every cached inquiry resting on `id`, to the depth bound, is marked stale in the promotion's
     own transaction, so its row is not answered as current until its own promotion rebuilds it. Read through the
     resting-on read (`leg-earning` R4, through `inquiry` until re-pointed); a provider offering none marks nothing. */
  #markDependantsStale(id) {
    const k = this.inquiry;
    if (!k || typeof k.restingOn !== "function") return;
    const seen = new Set([id]);
    let frontier = [id];
    for (let depth = 0; depth < DEPTH_BOUND && frontier.length; depth++) {
      const next = [];
      for (const t of frontier) {
        let r = null;
        try { r = k.restingOn(t); } catch { r = null; }
        for (const d of (r && Array.isArray(r.dependents) ? r.dependents : [])) {
          if (!d || seen.has(d.bundle_id)) continue;
          seen.add(d.bundle_id);
          next.push(d.bundle_id);
          if (this.#one(`SELECT 1 AS x FROM ${STRENGTH_CACHE_TABLE} WHERE bundle_id=?`, d.bundle_id))
            this.record.markStale("strength", STRENGTH_CACHE_TABLE, d.bundle_id);
        }
      }
      frontier = next;
    }
  }

  /** R13, R23, R39 (N137; record-core R77): the row the cache holds for one bundle, read fail-closed: `{stale: false,
   *  row}` when it is current, `{stale: true}` when it is marked stale or there is none, never a stale row as current. */
  cachedOf(bundleId) {
    const r = this.record.readDerived("strength", STRENGTH_CACHE_TABLE, bundleId);
    if (!r || r.stale) return { stale: true };
    const { bundle_id: _id, ...row } = r.row;
    return { stale: false, row };
  }

  /* ============================================================ the pair over a version (R7–R10; PL-14, §12) */

  /* R9: the version's legs as the walk's members, each grade resolved from what the record earns rather than read off
     the frozen row. One registry call for the whole version. `why` travels on every leg the arithmetic will find inert,
     and the three published lists (`ungraded`, `hunches`, `graded`) are this layer's facts: where a grade came from is
     about the record, and is published beside the arithmetic's own explanation rather than overwriting it. With `levels`
     (R29), an anonymous observation nothing independent in the version bears out is in `ungraded`, named so. */
  #versionLegsAsMembers(rows, subjectEntity, levels = null) {
    const targets = rows.filter((r) => typeof r.target_id === "string" && r.target_id
      && !["imported", ...DERIVED_KINDS].includes(Strength.#kindOf(r))).map((r) => r.target_id);
    const reg = this.inquiry.earned(subjectEntity || null, targets);
    const earnedConn = (reg && reg.earned && reg.earned.connection) || {};
    const earnedCap = (reg && reg.earned && reg.earned.capture) || {};
    const earnedTest = (reg && reg.earned && reg.earned.testimony) || {};
    const placed = [];
    const legs = rows.map((r) => {
      const axis = STRENGTH_AXES.includes(r.grade_axis) ? r.grade_axis : null;
      const authored = typeof r.grade === "string" && r.grade ? r.grade : null;
      const source = typeof r.grade_source === "string" && r.grade_source ? r.grade_source : null;
      const base = { ord: r.ord, target_id: r.target_id, target_type: r.target_type,
                     role: r.role, ground: r.ground, grade_axis: axis, grade_source: source,
                     ...(r.target_edition != null ? { target_edition: r.target_edition } : {}) };
      const inert = (why, bucket) => {
        placed.push([bucket, { target_id: r.target_id, ord: r.ord, ground: r.ground,
                               role: r.role, grade_axis: axis, grade_source: source, why }]);
        return { ...base, grade: null, why };
      };
      /* R42: a cutting leg is listed with its own grade and its role, never as part of the supported answer. */
      const cutting = r.role === "cuts_against" ? { role: r.role } : {};
      const carries = (grade, why) => {
        placed.push(["graded", { target_id: r.target_id, ord: r.ord, ground: r.ground,
                                 grade_axis: axis, grade_source: source, grade, authored, why, ...cutting }]);
        return { ...base, grade };
      };
      if (isHunch(source)) return inert(HUNCH_WHY, "hunches");
      /* R33: a leg on another group's finding carries no grade of its own; the walk counts it at what the accepted
         edition publishes (DEC-96 item 1). */
      if (isImportedRef(r.target_id))
        return inert(word("strength.inert.leg_rests_group"), "ungraded");
      /* R36, R38: a calculation or an occurrence carries no grade of its own; its capture grade is derived from what it
         rests on, and the walk derives it the same way (unknown there when it is unknown here). */
      if (DERIVED_KINDS.includes(Strength.#kindOf(r))) {
        const d = this.#derive(r);
        if (d.stopped) { inert(d.stopped, "ungraded"); return { ...base, grade_axis: "capture", grade: null }; }
        placed.push(["graded", { target_id: r.target_id, ord: r.ord, ground: r.ground, grade_axis: "capture",
                                 grade_source: source, grade: d.grade, authored: null, why: d.why, ...cutting }]);
        return { ...base, grade_axis: "capture", grade: null };
      }
      if (!axis) return inert(word("strength.inert.leg_states_axis"), "ungraded");
      if (axis === "connection") {
        /* The registry holds the letter, so the leg is worth that letter and no other. A member's signed testimony
           about the connection is the one authored grade that survives: the recogniser never mints a D, and erasing
           one would overrule a signed account. */
        const e = earnedConn[r.target_id];
        if (e && e.grade) return carries(e.grade, e.why);
        if (source === "testimony" && authored)
          return carries(authored, word("strength.carries.carries_member_signed", { target_id: r.target_id }));
        return inert(word("strength.inert.record_earned_connecting", { target_id: r.target_id }), "ungraded");
      }
      if (axis === "testimony") {
        if (normalizeType(r.target_type) === "inquiry")
          return inert(word("strength.inert.target_inquiry_document"), "ungraded");
        const t = earnedTest[r.target_id];
        if (t && t.grade) return carries(t.grade, t.why);
        return inert(word("strength.inert.member_firsthand_observation", { target_id: r.target_id }), "ungraded");
      }
      /* CAPTURE: the earned entry is a ceiling, not a value, so the member's letter stands and is capped. Two empty
         levels are different facts (REC-88, D-349): no bytes held, and bytes held with no measured fidelity. */
      const c = earnedCap[r.target_id];
      /* R37: a held standard whose text the record does not hold is unknown: named here, and the walk, which bounds the
         authored letter again, finds it undetermined. */
      if (Strength.#kindOf(r) === "standard" && (!c || !c.grade)) {
        inert(c && c.why ? c.why : word("strength.why.establishes_record_holds", { target_id: r.target_id }), "ungraded");
        return { ...base, grade: authored };
      }
      if (c && c.grade == null && c.undetermined_because) return inert(c.why, "ungraded");
      if (!c || !c.grade)
        return inert(word("strength.inert.record_holds_captured", { target_id: r.target_id }), "ungraded");
      if (!authored)
        return inert(word("strength.inert.captured_capture_grade", { target_id: r.target_id }), "ungraded");
      const capped = GRADE_RANK[authored] > GRADE_RANK[c.grade] ? c.grade : authored;
      return carries(capped, capped === authored ? c.why
        : word("strength.carries.leg_authored_reported", { why: c.why, authored, capped }));
    });
    /* R29, R34: the grades above are already the record's, so the judgement needs no capture bound of its own; the walk
       makes the same judgement over the same legs. */
    for (const [i, a] of this.#anonymousOf(legs, levels, null)) {
      if (a.corroborated || placed[i][0] !== "graded") continue;
      const { grade, authored: _authored, ...entry } = placed[i][1];
      placed[i] = ["ungraded", { ...entry, role: rows[i].role,
                                 why: a.kind === "evidence" ? UNCORROBORATED_EVIDENCE_WHY : UNCORROBORATED_WHY }];
    }
    const named = { ungraded: [], hunches: [], graded: [] };
    for (const [bucket, entry] of placed) named[bucket].push(entry);
    return { legs, ...named, subject_entity: reg ? reg.subject_entity : null,
             subject_known: reg ? reg.subject_known : false };
  }

  /** R7–R10: `op=versionstrength`, the pair over ONE reading of one question's evidence (IS-7, §12). A pure read: it
   *  writes nothing and makes no version current. */
  versionStrength(a = {}) {
    const args = a || {};
    const refusal = (code, detail, extra) => {
      const row = VERSION_STRENGTH_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    /* DEC-49 REGION is-version-strength: every refusal below names its code as a string literal at its site. */
    const inq = String(args.id ?? "").trim();
    if (!inq)
      return refusal("VERSION_STRENGTH_NO_INQUIRY",
        localize("strength.index.this_answers_for_one_question_strength",
          "this answers for ONE question: pass id=<INQ-…>. A strength belongs to a question's reading of its evidence, and there is no default question."));
    if (typeOfId(inq) !== "inquiry")
      return refusal("VERSION_STRENGTH_NOT_AN_INQUIRY",
        localize("strength.index.is_not_a_question_so_it_holds_no_readings",
          "{inq} is not a question, so it holds no readings of evidence and has no strength to report.", { inq: inq.slice(0, 60) }),
        { inquiry: inq });
    /* §6 rule 6's argument, defaulting to accepted. A comma-separated list or an array, so a query string and a body
       say the same thing. */
    const rawStates = args.states == null || args.states === ""
      ? null
      : (Array.isArray(args.states) ? args.states : String(args.states).split(","));
    const asked = rawStates ? rawStates.map((s) => String(s).trim()).filter(Boolean) : null;
    if (asked && asked.length > VERSION_STRENGTH_STATES_MAX)
      return refusal("VERSION_STRENGTH_TOO_MANY_STATES",
        localize("strength.index.kinds_of_reading_were_named_and_this_record_has",
          "{count} kinds of reading were named and this record has {limit}. The bound is published here rather than applied silently, so nothing is dropped without the caller being told.",
          { count: asked.length, limit: VERSION_STRENGTH_STATES_MAX }),
        { inquiry: inq, limit: VERSION_STRENGTH_STATES_MAX });
    const unknown = asked ? asked.filter((s) => !VERSION_MACHINE.legal.includes(s)) : [];
    if (unknown.length)
      return refusal("VERSION_STRENGTH_UNKNOWN_STATE",
        localize("strength.index.is_not_one_of_the_states_a_reading_can_be_in",
          "'{state}' is not one of the states a reading can be in: {legal}. The set is closed, because a strength that quietly counted readings in states nobody recognises is a number no reader could check.",
          { state: unknown[0].slice(0, 40), legal: VERSION_MACHINE.legal.join(", ") }),
        { inquiry: inq, unknown, legal: VERSION_MACHINE.legal });
    /* Deduped and in the machine's own order, so two callers naming one set get one sentence and one `state_set`. */
    const stateSet = asked
      ? VERSION_MACHINE.legal.filter((s) => asked.includes(s))
      : [...VERSION_STRENGTH_DEFAULT_STATES];
    /* R22: an inquiry the viewer may not see is refused exactly as one that does not exist. */
    if (!this.#visible(inq, args.viewer ?? null))
      return refusal("VERSION_STRENGTH_NOT_AN_INQUIRY",
        localize("strength.index.no_question_by_that_id_is_readable_no_reading",
          "no question by that id is readable here, so there is no reading of it to measure."),
        { inquiry: inq });
    /* Which reading: named outright, or the one THIS PROJECT stands on (§7: current is a property of the project's
       relationship to the inquiry, so there is no default project). */
    const wantVersion = String(args.version ?? "").trim();
    const project = String(args.project ?? "").trim();
    const versions = project ? this.versions : null;
    const current = versions ? versions.currentOf(project, inq, args.viewer ?? null) : null;
    const name = wantVersion || (current ? current.version : "");
    if (!name)
      return refusal("VERSION_STRENGTH_NO_VERSION",
        project
          ? localize("strength.index.has_not_said_which_reading_it_stands_on",
              "{project} has not said which reading of {inq} it stands on, and there is no default reading. Name one explicitly to measure it.",
              { project: project.slice(0, 60), inq })
          : localize("strength.index.name_the_reading_to_measure_or_name_the_project",
              "name the reading to measure (version=<name>), or name the project asking (project=<PROJ-…>) so the reading it stands on can be used. There is no default reading here."),
        { inquiry: inq, project: project || null });
    const row = this.#one(
      `SELECT name, state, description, relationship, hidden, derived_from, kind, run, author, at, leg_count
         FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, inq, name);
    if (!row)
      return refusal("VERSION_STRENGTH_NO_SUCH_VERSION",
        [localize("strength.index.no_reading_named_belongs_to", "no reading named '{name}' belongs to {inq}.", { name: name.slice(0, 60), inq }),
         ...(current && current.version === name
           ? [localize("strength.index.points_at_it_so_the_pointer_has_outlived",
               "{project} points at it, so the pointer has outlived the reading it names.", { project: project.slice(0, 60) })]
           : [])].join(" "),
        { inquiry: inq, version: name });
    /* §6 rule 6: a reading outside the state set is not measured, and the refusal names the widening that turns the
       request into an honest what-if, never making the reading current. */
    if (!stateSet.includes(row.state))
      return refusal("VERSION_STRENGTH_STATE_EXCLUDED",
        localize("strength.index.is_and_this_answer_counts_ask_again",
          "'{name}' is {state} and this answer counts {states}. Ask again naming {state} among the states to see what it would come to — the answer will say on its face that it is a view you constructed and not what this record stands on.",
          { name: name.slice(0, 60), state: row.state, states: stateSet.join(", ") }),
        { inquiry: inq, version: name, version_state: row.state, state_set: stateSet });
    /* END DEC-49 REGION is-version-strength */

    const legRows = this.#versionLegs(inq, name, true);
    const lv = levelsGiven(args.levels);
    const resolved = this.#versionLegsAsMembers(legRows, this.inquiry.subjectEntityOf(inq), lv);
    const { pair } = this.#pairOver(inq, resolved.legs, lv);
    const whatIf = !(stateSet.length === VERSION_STRENGTH_DEFAULT_STATES.length
                     && stateSet.every((s, i) => s === VERSION_STRENGTH_DEFAULT_STATES[i]));
    /* DEC-40's line, in band, on every answer: the what-if says whose view it is, the default says it is not filtered,
       because absence of the line is the ambiguity the ruling names. */
    const filter = word(whatIf ? "strength.text.view_constructed_record" : "strength.text.computed_over_reading",
                        { name, state_set: stateSet.join(", ") });
    const out = {
      ok: true, inquiry: inq, version: name, version_state: row.state,
      ...(project ? { project, current: current ? current.version : null } : {}),
      state_set: stateSet, what_if: whatIf, filter, depth_bound: DEPTH_BOUND,
      /* One measurement per axis, over its own population; nothing beside the axes stands for all of them. */
      pair: Object.fromEntries(STRENGTH_AXES.map((ax) => [ax, pair[ax]])),
      ungraded: resolved.ungraded, hunches: resolved.hunches, graded: resolved.graded,
      /* R5: every hunch this answer names, and no other. */
      hunches_left_out: resolved.hunches.length,
      ...(lv ? { levels: lv } : {}),
      grades_from: "earnedBasisRegistry",
      subject_entity: resolved.subject_entity, subject_known: resolved.subject_known,
      legs_read: legRows.length, legs_complete: legRows.length === row.leg_count,
      hidden: row.hidden === 1, derived_from: row.derived_from,
      /* R12 (D-271, D-195): recomputed against the record as it stands, not replayed from the write, so provenance
         recorded after the write can reveal a shared origin the write could not see. Parts are the distinct non-blank
         groups of the legs read. */
      independence: this.#independenceOf(legRows, distinctParts(legRows)),
    };
    return refusePairComposed(out) ?? out;
  }

  /* The legs of one stored version, in order, at most `BASIS_VERSION_LEGS_MAX` (R8), with the edition a leg on another
     group's finding names (R33) where `basis-versions` stores one. */
  #versionLegs(inq, name, withGrades) {
    if (this.#versionEdition === undefined)
      this.#versionEdition = this.#rows(`PRAGMA table_info(inquiry_basis_version_legs)`).some((c) => c.name === "target_edition");
    const cols = (withGrades ? "ord, target_id, target_type, role, grade, grade_axis, grade_source, ground"
                             : "ord, target_id, target_type, role, ground")
      + (withGrades && this.#versionEdition ? ", target_edition" : "");
    return this.#rows(
      `SELECT ${cols} FROM inquiry_basis_version_legs WHERE bundle_id=? AND name=? ORDER BY ord LIMIT ?`,
      inq, name, BASIS_VERSION_LEGS_MAX);
  }

  /* ============================================================ independence (R11, R12, R27; D-195) */

  /* The reader R12's one implementation walks (`./origins.mjs`), fresh for each answer: the store and the layer-5 reads. */
  #origins() {
    return originsReader({ rows: (q, ...a) => this.#rows(q, ...a), events: this.events, lines: this.lines,
                           people: this.people, money: this.money, calcFacts: (id) => this.#calcFacts(id) });
  }

  /* R30, R34: some bundles' own provenance (the document, its captures, their addresses), `{set, complete}`. */
  #originsOf(bundleIds) { return this.#origins().provenanceOf(bundleIds); }

  /* THE ONE IMPLEMENTATION (R12), for the pair over a version, a partition and a candidate alike, so the write gate
     and the ceremony's read cannot come to disagree about what "independent" means. `checked: false` says there was
     nothing to compare (one part), which is different from looked and found nothing; `complete` is null then. */
  #independenceOf(legs, parts) { return this.#origins().independenceOf(legs, parts); }

  /** R11–R12: `op=partitionindependence`, D-195's derivation over a PROPOSED partition of a question's existing reasons
   *  (REC-161), or over a stored version's groups (REC-192), answering independence on its own with no strength key.
   *  Gated as `op=versionstrength` is; it writes nothing. No state set: the reading a member affirms at the accept
   *  ceremony is by construction not yet accepted. */
  partitionIndependence(a = {}) {
    const args = a || {};
    const refusal = (code, detail, extra) => {
      const row = PARTITION_INDEPENDENCE_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    /* DEC-49 REGION is-partition-independence */
    const inq = String(args.id ?? "").trim();
    if (!inq)
      return refusal("PARTITION_INDEPENDENCE_NO_INQUIRY",
        localize("strength.index.this_answers_for_one_question_partition",
          "this answers for ONE question: pass id=<INQ-…>. A partition is a grouping of one question's reasons, and there is no default question."));
    if (typeOfId(inq) !== "inquiry")
      return refusal("PARTITION_INDEPENDENCE_NOT_AN_INQUIRY",
        localize("strength.index.is_not_a_question_so_it_has_no_reasons",
          "{inq} is not a question, so it has no reasons to group.", { inq: inq.slice(0, 60) }), { inquiry: inq });
    if (!this.#visible(inq, args.viewer ?? null))
      return refusal("PARTITION_INDEPENDENCE_NOT_AN_INQUIRY",
        localize("strength.index.no_question_by_that_id_is_readable_no_reasons",
          "no question by that id is readable here, so there are no reasons of it to group."),
        { inquiry: inq });
    const wantVersion = String(args.version ?? "").trim();
    const partitionNamed = args.partition != null && args.partition !== "";
    if (wantVersion && partitionNamed)
      return refusal("PARTITION_INDEPENDENCE_TWO_SUBJECTS",
        localize("strength.index.name_either_a_written_reading_or_a_proposed_grouping",
          "name EITHER a written reading (version=<name>) OR a proposed grouping (partition=<JSON>), not both: this answers for one of them, and does not guess which one was meant."),
        { inquiry: inq });
    let legs, head;
    if (wantVersion) {
      const row = this.#one(
        `SELECT name, state, leg_count FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, inq, wantVersion);
      if (!row)
        return refusal("PARTITION_INDEPENDENCE_NO_SUCH_VERSION",
          localize("strength.index.no_reading_named_belongs_to", "no reading named '{name}' belongs to {inq}.",
            { name: wantVersion.slice(0, 60), inq: inq.slice(0, 60) }),
          { inquiry: inq, version: wantVersion.slice(0, 200) });
      /* The same rows the pair over a version reads, with no grade column: nothing here may carry a grade. */
      legs = this.#versionLegs(inq, row.name, false);
      head = { version: row.name, version_state: row.state, legs_read: legs.length,
               legs_complete: legs.length === row.leg_count };
    } else {
      /* The partition as the elicitation holds it: groups, each a list of positions in the question's `basis[]`, or
         `{label, legs}` so a caller that will write the partition under names asks under the same names. An unnamed
         group is filed by its position, never under a word this plane made up about somebody's argument. */
      let raw = args.partition;
      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch { raw = undefined; }
      }
      const unreadable = (why) => refusal("PARTITION_INDEPENDENCE_UNREADABLE", why, { inquiry: inq });
      if (!Array.isArray(raw) || !raw.length)
        return unreadable(localize("strength.index.pass_partition_a_non_empty_list_of_groups",
          "pass partition=<JSON>: a non-empty list of groups, each a list of reason positions (e.g. [[0,1],[2]]) or {\"label\":…,\"legs\":[…]} — or version=<name> to read a written reading's groups instead."));
      if (raw.length > BASIS_VERSION_LEGS_MAX)
        return refusal("PARTITION_INDEPENDENCE_TOO_MANY_LEGS",
          localize("strength.index.groups_were_proposed_and_a_written_reading_holds",
            "{count} groups were proposed and a written reading holds at most {limit} reasons.",
            { count: raw.length, limit: BASIS_VERSION_LEGS_MAX }),
          { inquiry: inq, limit: BASIS_VERSION_LEGS_MAX });
      const parts = [];
      for (let k = 0; k < raw.length; k++) {
        const g = raw[k];
        const named = g && typeof g === "object" && !Array.isArray(g);
        const ords = named ? g.legs : g;
        const label = named ? String(g.label ?? "").trim() : `part ${k + 1}`;
        if (!label)
          return unreadable(localize("strength.index.group_carries_no_name",
            "group {n} carries no name; leave the name out altogether to have it filed by its position.", { n: k + 1 }));
        if (label.length > 200)
          return unreadable(localize("strength.index.groups_name_is_longer_than_200_characters",
            "group {n}'s name is longer than 200 characters.", { n: k + 1 }));
        if (!Array.isArray(ords) || !ords.length)
          return unreadable(localize("strength.index.group_lists_no_reasons",
            "group {n} lists no reasons; every group holds at least one.", { n: k + 1 }));
        if (!ords.every((o) => Number.isInteger(o) && o >= 0))
          return unreadable(localize("strength.index.group_names_something_other_than_a_position",
            "group {n} names something other than a reason's position.", { n: k + 1 }));
        if (parts.some((p) => p.label === label))
          return unreadable(localize("strength.index.two_groups_are_both_named",
            "two groups are both named '{label}'.", { label: label.slice(0, 60) }));
        parts.push({ label, ords: [...ords] });
      }
      /* The question's own reasons, read one past the bound so a basis larger than a reading may hold is observed. */
      /* Bounded in SQL by inquiry's R16 `limit`; the slice holds the bound for a provider that reads whole. */
      const legRows = this.#legsOf(inq, { limit: BASIS_VERSION_LEGS_MAX + 1 }).slice(0, BASIS_VERSION_LEGS_MAX + 1)
        .map((l) => ({ ord: l.ord, target_id: l.target_id, target_type: l.target_type, role: l.role }));
      if (legRows.length > BASIS_VERSION_LEGS_MAX)
        return refusal("PARTITION_INDEPENDENCE_TOO_MANY_LEGS",
          localize("strength.index.rests_on_more_than_reasons", "{inq} rests on more than {limit} reasons.",
            { inq: inq.slice(0, 60), limit: BASIS_VERSION_LEGS_MAX }), { inquiry: inq, limit: BASIS_VERSION_LEGS_MAX });
      const byOrd = new Map(legRows.map((l) => [l.ord, l]));
      const placed = new Map();
      for (const p of parts)
        for (const o of p.ords) {
          if (!byOrd.has(o))
            return refusal("PARTITION_INDEPENDENCE_UNKNOWN_LEG",
              legRows.length
                ? localize("strength.index.names_reason_position_and_has_reasons_at_positions",
                    "'{label}' names reason position {ord}, and {inq} has {count} reason(s) at positions {positions}.",
                    { label: p.label.slice(0, 60), ord: o, inq: inq.slice(0, 60), count: legRows.length,
                      positions: legRows.map((l) => l.ord).join(", ") })
                : localize("strength.index.names_reason_position_and_has_reasons",
                    "'{label}' names reason position {ord}, and {inq} has {count} reason(s).",
                    { label: p.label.slice(0, 60), ord: o, inq: inq.slice(0, 60), count: legRows.length }),
              { inquiry: inq, ord: o });
          if (placed.has(o))
            return refusal("PARTITION_INDEPENDENCE_LEG_TWICE",
              localize("strength.index.reason_position_is_in_both_and",
                "reason position {ord} is in both '{first}' and '{second}'.",
                { ord: o, first: placed.get(o).slice(0, 60), second: p.label.slice(0, 60) }),
              { inquiry: inq, ord: o });
          placed.set(o, p.label);
        }
      const unplaced = legRows.filter((l) => !placed.has(l.ord)).map((l) => l.ord);
      if (unplaced.length)
        return refusal("PARTITION_INDEPENDENCE_NOT_TOTAL",
          localize("strength.index.reason_positions_are_in_no_group",
            "reason position(s) {positions} are in no group.", { positions: unplaced.slice(0, 20).join(", ") }),
          { inquiry: inq, unplaced: unplaced.slice(0, 20) });
      legs = legRows.map((l) => ({ ...l, ground: placed.get(l.ord) }));
      head = { partition: parts.map((p) => ({ label: p.label, legs: p.ords,
                 targets: p.ords.map((o) => byOrd.get(o).target_id) })),
               legs_read: legRows.length };
    }
    /* END DEC-49 REGION is-partition-independence */
    return { ok: true, inquiry: inq, ...head, wrote: false,
             independence: this.#independenceOf(legs, distinctParts(legs)) };
  }

  /* ============================================================ a candidate's legs (R26, R27; N60) */

  /* A candidate leg `{target, role, grade, grade_axis, grade_source, ground, target_edition?}` as the walk's leg, its position its ord
     and its type read from its id's prefix. */
  static #candidateLeg(l, k) {
    const target = str(l?.target) ?? "";
    return { ord: k, target_id: target, target_type: typeOfId(target),
             role: typeof l?.role === "string" ? l.role : "",
             grade: l?.grade ?? null, grade_axis: l?.grade_axis ?? null,
             grade_source: l?.grade_source ?? null, ground: str(l?.ground),
             /* R46: the passage a candidate leg names, so a typed passage counts at its own grade there too. */
             ...(str(l?.content_id) ? { content_id: str(l.content_id) } : {}),
             ...(l?.target_edition != null ? { target_edition: l.target_edition } : {}) };
  }

  /** R26: R1–R5's three axes over `legs` given in place of the inquiry's live basis, walking inquiry legs to the depth
   *  bound exactly as `strengthOf` does, with how many hunch legs it left out (R5) and, given `levels`, R29's rule and
   *  the levels it applied. Writes nothing. A leg whose target cannot be read makes its axis undetermined or leaves it
   *  inert, never an error; a failure of the arithmetic itself is answered `{pair: null, error}`, never thrown. */
  candidatePair({ inquiry = null, legs = [], levels = null } = {}) {
    try {
      const walkLegs = (Array.isArray(legs) ? legs : []).map((l, k) => Strength.#candidateLeg(l, k));
      const lv = levelsGiven(levels);
      const { pair } = this.#pairOver(String(inquiry ?? ""), walkLegs, lv);
      return { pair, error: null, hunches_left_out: hunchCount(walkLegs), ...(lv ? { levels: lv } : {}) };
    } catch (e) {
      return { pair: null, error: String(e && e.message ? e.message : e).slice(0, CANDIDATE_ERROR_MAX) };
    }
  }

  /** R27: R12's independence over `legs` grouped by their `ground` into `parts` declared parts, by the one
   *  implementation. */
  candidateIndependence({ legs = [], parts = 0 } = {}) {
    const walkLegs = (Array.isArray(legs) ? legs : []).map((l, k) => Strength.#candidateLeg(l, k));
    return this.#independenceOf(walkLegs, Number.isInteger(parts) ? parts : distinctParts(walkLegs));
  }

  /* ============================================================ anonymous testimony (R29, R30; DEC-102) */

  /** R30, R34: for each testimony leg of the inquiry's live basis, or of the named version, on an observation `levels`
   *  states at `group` or `project`, and each leg on a document whose capture it states at those levels (answered with
   *  `kind: "evidence"` and that capture), whether something independent in the same basis bears it out (`corroborated`, with the
   *  legs that do) or not (`uncorroborated`), by the one judgement R29's pair makes. Refusals as R6's, and for a named
   *  version R7's `VERSION_STRENGTH_NO_SUCH_VERSION`. A leg the viewer may not see is withheld whole and bears nothing
   *  out; `out_of_view: true` says only that something was withheld. For `ratification` (its R35), the caller that
   *  states the levels; this module reads none itself. Writes nothing; never names an author. */
  testimonyCorroboration({ inquiry = null, version = null, levels = null, viewer = null } = {}) {
    const id = str(inquiry);
    if (!id) return { ok: false, reason: "NO_ID",
      detail: localize("strength.index.this_answers_for_one_question_pass_inquiry",
        "this answers for one question: pass inquiry=<record id>.") };
    if (!this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    const ty = normalizeType(this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id)?.object_type);
    if (ty !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target: id, object_type: ty ?? null,
        detail: localize("strength.index.is_a_not_an_inquiry_only_a_question_rests_on_testimony",
          "{id} is a {type}, not an inquiry. Only a question rests on testimony.",
          { id, type: ty ?? localize("strength.index.record", "record") }) };
    const name = str(version);
    let legs, captureBounds;
    if (name) {
      const row = this.#one(`SELECT name FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, id, name);
      if (!row) {
        const r = VERSION_STRENGTH_CHECKS.VERSION_STRENGTH_NO_SUCH_VERSION;
        return { ok: false, reason: "VERSION_STRENGTH_NO_SUCH_VERSION", code: "VERSION_STRENGTH_NO_SUCH_VERSION",
                 check: r.check, translation: r.translation, inquiry: id, version: name.slice(0, 200),
                 detail: localize("strength.index.no_reading_named_belongs_to", "no reading named '{name}' belongs to {inq}.",
                                  { name: name.slice(0, 60), inq: id }) };
      }
      legs = this.#versionLegsAsMembers(this.#versionLegs(id, name, true), this.inquiry.subjectEntityOf(id)).legs;
      captureBounds = null;
    } else {
      legs = this.#legsOf(id);
      captureBounds = this.#captureBoundsFor(id, 0, legs);
    }
    const lv = levelsGiven(levels) ?? Object.freeze({});
    const keep = this.#redactor(viewer);
    const seen = (t) => !(t && keep(t) === null);
    let withheld = false;
    const answered = [];
    for (const [i, a] of this.#anonymousOf(legs, lv, captureBounds, seen)) {
      const leg = legs[i];
      if (!seen(leg.target_id)) { withheld = true; continue; }
      answered.push({ ord: leg.ord, target_id: leg.target_id, level: a.level,
                      ...(a.kind === "evidence" ? { kind: "evidence", capture: a.capture } : {}),
                      state: a.corroborated ? "corroborated" : "uncorroborated", corroborated_by: a.by });
    }
    return { ok: true, inquiry: id, ...(name ? { version: name } : {}), levels: lv, legs: answered, wrote: false,
             ...(withheld ? { out_of_view: true } : {}) };
  }

  /* ============================================================ a finding's grading facts (R35; DEC-112 (3)) */

  /** R35 (K1305): for one finding, the legs exactly as `recomputePair` (R32) reads them, so a case file that states this
   *  answer recomputes the pair `strengthOf` answers (or, for a named version, `versionStrength`'s pair over it). Per
   *  leg `{target, kind, role, grade, grade_axis, grade_source, ground, target_edition?, answer?, another_groups?,
   *  origins, origins_complete, captures, author_key?}`: a document's grade as the walk counts it (a capture letter
   *  under its ceiling, R1; a version leg's grade from the record, R9); a question's or another group's finding's
   *  `answer`, its per-axis pair as the walk read it (R2, R33); the origins R12 reads; the captures the register holds
   *  (R34); and, for an observation, an opaque `author_key` equal for the same member within this answer and never an
   *  account (R29). Refusals as R30's. A leg the viewer may not see is withheld whole, `out_of_view: true` saying only
   *  that something was, and the pair over what remains is then not the record's. Writes nothing; names no author. */
  gradingFacts({ inquiry = null, version = null, levels = null, viewer = null } = {}) {
    const id = str(inquiry);
    if (!id) return { ok: false, reason: "NO_ID", detail: localize("strength.index.this_answers_for_one_question_pass_inquiry",
      "this answers for one question: pass inquiry=<record id>.") };
    if (!this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    const ty = normalizeType(this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id)?.object_type);
    if (ty !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target: id, object_type: ty ?? null,
        detail: localize("strength.index.is_a_not_an_inquiry_only_a_question_has_grading_facts",
          "{id} is a {type}, not an inquiry. Only a question has grading facts.",
          { id, type: ty ?? localize("strength.index.record", "record") }) };
    const name = str(version);
    const lv = levelsGiven(levels);
    let legs, captureBounds, ownTop;
    if (name) {
      if (!this.#one(`SELECT name FROM inquiry_basis_versions WHERE bundle_id=? AND name=?`, id, name)) {
        const r = VERSION_STRENGTH_CHECKS.VERSION_STRENGTH_NO_SUCH_VERSION;
        return { ok: false, reason: "VERSION_STRENGTH_NO_SUCH_VERSION", code: "VERSION_STRENGTH_NO_SUCH_VERSION",
                 check: r.check, translation: r.translation, inquiry: id, version: name.slice(0, 200),
                 detail: localize("strength.index.no_reading_named_belongs_to", "no reading named '{name}' belongs to {inq}.",
                                  { name: name.slice(0, 60), inq: id }) };
      }
      legs = this.#versionLegsAsMembers(this.#versionLegs(id, name, true), this.inquiry.subjectEntityOf(id)).legs;
      captureBounds = this.#captureBoundsFor(id, DEPTH_BOUND, legs);
      ownTop = false;
    } else {
      legs = this.#legsOf(id);
      captureBounds = this.#captureBoundsFor(id, DEPTH_BOUND, legs);
      /* R46, R47: a leg on a typed passage stated as the walk counts it (its recorded grade on the capture axis). */
      legs = legs.map((l) => Strength.#asWalkLeg(l, captureBounds));
      ownTop = true;
    }
    const ctx = { captureBounds, levels: lv, refs: new Map(), ownTop };
    const observed = this.#observationReader();
    const keys = new Map();
    const keyOf = (author) => {
      if (author == null) return null;
      if (!keys.has(author)) keys.set(author, `a${keys.size + 1}`);
      return keys.get(author);
    };
    const facts = legs.map((leg) => {
      const kind0 = Strength.#kindOf(leg);
      const isObs = kind0 === "document" && typeof leg.target_id === "string" && leg.target_id
        && observed(leg.target_id).observation;
      const kind = isObs ? "observation" : kind0;
      const o = this.#originsOf(leg.target_id ? [leg.target_id] : []);
      const out = { target: leg.target_id, kind, role: leg.role ?? "", grade: leg.grade ?? null,
                    grade_axis: leg.grade_axis ?? null, grade_source: leg.grade_source ?? null, ground: leg.ground ?? null,
                    origins: [...o.set], origins_complete: o.complete,
                    captures: kind0 === "document" && leg.target_id
                      ? this.#rows(`SELECT capture_sha FROM register WHERE bundle_id=? ORDER BY capture_sha`, leg.target_id)
                          .map((r) => r.capture_sha)
                      : [] };
      if (kind === "observation") {
        const k = keyOf(observed(leg.target_id).author);
        if (k) out.author_key = k;
      }
      /* R1: a capture letter as the walk counts it, under its ceiling (null when the ceiling is undetermined). */
      if (kind0 === "document" && leg.grade_axis === "capture" && leg.grade != null && captureBounds) {
        const capped = this.#capped(leg, leg.grade, captureBounds);
        if (capped) out.grade = capped.grade;
        /* R47: a leg on a typed passage says it is typed, and whether a second member checked it; no names. */
        const typed = Object.hasOwn(leg, "typed_stated") ? Strength.#typedOf(leg, captureBounds) : null;
        if (typed) {
          out.typed = { checked: typed.determinant === "second_member" };
          if (capped && capped.grade == null) out.undetermined = capped.why;
        }
      }
      /* R36–R38: a calculation's or an occurrence's derived capture grade, or why it is unknown; a held standard's
         letter under its text's ceiling, or why that text is unknown. */
      if (DERIVED_KINDS.includes(kind0) && !isHunch(leg.grade_source)) {
        const d = this.#derive(leg, ctx);
        out.grade_axis = "capture";
        out.grade = d.stopped ? null : d.grade;
        if (d.stopped) out.undetermined = d.stopped;
      }
      if (kind0 === "standard" && leg.grade_axis === "capture" && leg.grade != null && !isHunch(leg.grade_source)) {
        const capped = this.#capped(leg, leg.grade, captureBounds);
        /* The stated letter stays beside why its text is unknown, so the recomputation finds it unknown too (R32). */
        if (capped && capped.grade == null) out.undetermined = capped.why;
        else if (capped) out.grade = capped.grade;
      }
      if (kind0 === "inquiry" && !isHunch(leg.grade_source)) {
        const sub = this.#walk(leg.target_id, 1, DEPTH_BOUND, null, ctx);
        out.answer = Object.fromEntries(STRENGTH_AXES.map((a) => [a, sub[a]]));
      }
      if (kind0 === "imported" && !isHunch(leg.grade_source)) {
        const got = this.#importedAnswer(id, leg, ctx, ownTop);
        const ed = ctx.refs.get(leg.target_id);
        if (ed != null) out.target_edition = ed;
        if (!got.stopped) { out.answer = got.pair; out.another_groups = got.another_groups; }
      }
      return out;
    });
    const keep = this.#redactor(viewer, ctx.refs);
    const seen = facts.filter((f) => !(f.target && keep(f.target) === null));
    return { ok: true, inquiry: id, ...(name ? { version: name } : {}), method: GRADING_METHOD_VERSION,
             ...(lv ? { levels: lv } : {}), legs: seen, wrote: false,
             ...(seen.length < facts.length ? { out_of_view: true } : {}) };
  }

  /* ============================================================ the bar (R14–R16; DEC-17, DEC-72) */

  /** R14: the project's own declared bar, read from its bundle.md at act time (the caller freezes it). An authored,
   *  dated, on-the-record declaration rather than a settings row, because a group may lower its own bar and may not
   *  do it quietly. MK-2: the bar stays a pair; testimony has no bar anyone has ruled. An absent bar is not a bar of
   *  zero, and says so. */
  projectBar(projectId) {
    const md = this.record.readFile(projectId, "bundle.md");
    const pfm = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data || {}) : {};
    const rq = pfm.required_strength;
    const declared = { capture: null, connection: null };
    let named = false;
    if (rq && typeof rq === "object")
      for (const axis of ["capture", "connection"]) {
        if (!BASIS_GRADES.includes(rq[axis])) continue;
        declared[axis] = rq[axis];
        named = true;
      }
    if (named)
      return { declared: true, source: "project", project: projectId,
               capture: declared.capture, connection: declared.connection,
               detail: localize("strength.index.required_by_the_project_whose_production_this_case_is",
                 "required by {project}, the project whose production this case is: {bar}. The bar is the project's own declaration about its own work, stated in advance, and is never set by who a reader is.",
                 { project: projectId, bar: barAxisWords(declared) }) };
    return { declared: false, source: "none", project: projectId, capture: null, connection: null,
             detail: localize("strength.index.declares_no_required_evidentiary_strength",
               "{project} declares no required evidentiary strength, so nothing in this case was measured against one. An absent bar is not a bar of zero, and this case makes no claim to have cleared any standard. A project declares its bar by its own act, written into the project's document as an authored, dated, on-the-record entry.",
               { project: projectId }) };
  }

  /** R15: the group's default bar, the one a new project starts from (DEC-17 as amended). A pair: a scalar would
   *  re-collapse the two axes in the one field a reader is most likely to quote. It is recorded with the administrator's
   *  reason (DEC-88), and its answer carries DEC-105's honest note. */
  strengthBarSet({ group = null, capture = null, connection = null, reason = undefined, author = null } = {}) {
    const machine = machineCannotDeclare(author, "team");
    if (machine) return machine;
    const who = String(author).trim();
    /* DEC-49 REGION is-admin-strength-bar */
    if (!this.membership.isAdministrator(who))
      return barRefusal("STRENGTH_BAR_NOT_ADMIN",
        localize("strength.index.the_default_bar_is_declared_for_the_whole_team",
          "the default bar is declared for the whole team, so only an active administrator may set it. Nothing was declared."));
    /* END DEC-49 REGION is-admin-strength-bar */
    /* D-436: the default is the store's recorded group, never a literal; with none recorded and none named there is no
       group for the declaration to belong to. */
    const gid = String(group ?? "").trim() || this.producingGroup();
    if (!gid) {
      /* C-64.1, promotion's row (it mints the same refusal in `#promote`). */
      const row = PROMOTION_ROW_CHECKS.GROUP_UNDETERMINED;
      return { ok: false, reason: "GROUP_UNDETERMINED", code: "GROUP_UNDETERMINED", check: row.check,
               translation: row.translation, act: "strengthbar",
               detail: localize("strength.index.the_default_bar_is_the_teams_declaration",
                 "the default bar is the TEAM's declaration, keyed by its team; this request names no team and this store records none. Nothing was declared.") };
    }
    const bad = badGrade(capture, connection);
    if (bad) return bad;
    if (capture == null && connection == null)
      return { ok: false, reason: "NO_BAR",
               detail: localize("strength.index.declare_at_least_one_axis",
                 "declare at least one axis. Withdrawing a bar entirely is a different act from setting one, and an absent bar is stated as absent rather than written as a blank row.") };
    /* DEC-49 REGION is-strength-bar-reason */
    /* DEC-88: the administrator's words, judged trimmed and recorded as judged. Asked last, so nothing is written. */
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why || why.length > BAR_REASON_MAX)
      return barRefusal("BAR_NO_REASON",
        typeof reason !== "string"
          ? localize("strength.index.give_the_reason_the_team_sets_this_bar",
              "give the reason the team sets this bar, as text in your own words (reason=…). Nothing was declared.")
          : !why
          ? localize("strength.index.the_reason_given_is_blank_why_the_team",
              "the reason given is blank; say in your own words why the team sets this bar. Nothing was declared.")
          : localize("strength.index.the_reason_given_is_characters_team",
              "the reason given is {length} characters, and a reason is at most {max}. Nothing was declared.",
              { length: why.length, max: BAR_REASON_MAX }),
        { limit: BAR_REASON_MAX });
    /* END DEC-49 REGION is-strength-bar-reason */
    const at = this.now();
    this.sql.exec(
      `INSERT INTO group_strength_bar (group_id,capture,connection,author,at,reason) VALUES (?,?,?,?,?,?)
       ON CONFLICT(group_id) DO UPDATE SET capture=excluded.capture, connection=excluded.connection,
         author=excluded.author, at=excluded.at, reason=excluded.reason`,
      gid, capture, connection, who, at, why);
    return { ok: true, group: gid, capture, connection, author: who, at, reason: why,
             note: word("strength.note.default_project_starts", { bar_honest_note: BAR_HONEST_NOTE }) };
  }

  /* R16, R40: null when `pid` is a project the viewer may see; else the answer: an absent or unseen project
     membership's (its R78, N208: minted there), one not a project `NOT_A_PROJECT`. */
  #projectUnseen(pid, viewer) {
    const gate = viewerPredicate(viewer);
    const pb = pid ? this.#one(
      `SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, pid, ...gate.args) : null;
    if (!pb) return noSuchProject(pid || null);
    if (normalizeType(pb.object_type) !== "project")
      return { ok: false, reason: "NOT_A_PROJECT", project: pid, object_type: pb.object_type,
               detail: localize("strength.index.is_a_and_a_standard_of_evidence_is_a_property",
                 "{id} is a {type}, and a standard of evidence is a property of a PROJECT (DEC-72).",
                 { id: pid, type: pb.object_type }) };
    return null;
  }

  /** R40 (T47; N976, K3003; DEC-72, DEC-17): `op=projectbarset`, a project's own bar, the `required_strength` R14 reads,
   *  set by a member who has joined the project. An authored, dated, on-the-record act: the bar is written into the
   *  project's document with `last_updated` and one Session Log entry naming the author, the bar before and after and
   *  the reason, and promoted at the project's current state through `promotion.promote`, whose refusal is answered
   *  unchanged. Given neither axis it withdraws the bar (both axes null, which R14 reads as absent, never a bar of zero).
   *  It never reads or changes the group's default (R15), and it gates nothing (R21). */
  projectBarSet({ project = null, capture = null, connection = null, reason = undefined, author = null, viewer = null,
                  identity = null, expected = undefined } = {}) {
    const machine = machineCannotDeclare(author, "project");
    if (machine) return machine;
    const who = String(author).trim();
    const pid = String(project ?? "").trim();
    const unseen = this.#projectUnseen(pid, viewer);
    if (unseen) return unseen;
    /* membership R55: the act is work inside the project, so the author must have joined it. The control plane's
       identity stamp when it gives one, else the author's own. */
    const asked = str(identity) ?? `member:${who}`;
    const fence = this.membership.projectAuthority(pid, asked, "joined", "projectBarSet");
    if (fence) return fence;
    const bad = badGrade(capture, connection);
    if (bad) return bad;
    /* DEC-49 REGION is-project-bar-reason */
    /* The member's words, judged trimmed and recorded as judged. Asked last, so nothing is written. */
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why || why.length > BAR_REASON_MAX)
      return barRefusal("PROJECT_BAR_NO_REASON",
        typeof reason !== "string"
          ? localize("strength.index.give_the_reason_the_project_sets_this_bar",
              "give the reason the project sets this bar, as text in your own words (reason=…). Nothing was changed.")
          : !why
          ? localize("strength.index.the_reason_given_is_blank_why_the_project",
              "the reason given is blank; say in your own words why the project sets this bar. Nothing was changed.")
          : localize("strength.index.the_reason_given_is_characters_project",
              "the reason given is {length} characters, and a reason is at most {max}. Nothing was changed.",
              { length: why.length, max: BAR_REASON_MAX }),
        { limit: BAR_REASON_MAX });
    /* END DEC-49 REGION is-project-bar-reason */
    const head = this.record.head(pid);
    const doc = this.record.readFile(pid, "bundle.md");
    if (!head || !doc || typeof doc.text !== "string") return noSuchProject(pid);
    const previous = this.projectBar(pid);
    /* R45: the bar the writer saw, asked after every other refusal and before anything is written. */
    const stale = staleBar(expected, previous, pid);
    if (stale) return stale;
    const at = this.now();
    const next = { capture: capture ?? null, connection: connection ?? null };
    const spliced = spliceProjectBar(doc.text, next, at);
    if (spliced === null)
      return { ok: false, reason: "PROJECT_DOCUMENT_UNREADABLE", project: pid,
               detail: localize("strength.index.the_projects_document_has_no_front_matter_block",
                 "the project's document has no front-matter block to hold its bar. Nothing was changed.") };
    const withdrawing = next.capture == null && next.connection == null;
    const after = withdrawing ? "no bar" : barAxisWords(next);
    const text = appendSessionLog(spliced,
      `### Session ${at} | ${withdrawing ? "Withdrew" : "Set"} the project's bar | ${who}\n`
      + `Trigger: op=projectbarset on ${pid}\n`
      + `${localize("strength.index.changes_the_projects_standard_of_evidence_from",
          "Changes: the project's standard of evidence from {before} to {after}.", { before: barLogWords(previous), after })}\n`
      /* One line, so a reason's own line breaks never open a section of the document. */
      + `Reason: ${why.replace(/\s+/g, " ")}\n`);
    const fm = parseFrontmatter(text).data || {};
    const carried = (this.record.livePaths(pid) || []).filter((p) => p !== "bundle.md").map((path) => {
      const f = this.record.readFile(pid, path);
      return typeof f.text === "string" ? { path, text: f.text, sha256: f.sha256 }
                                        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes };
    });
    const nonce = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const r = this.promotion.promote({
      bundleId: pid, base: head.bundleSha, snapKey: `${at.replace(/[-:.]/g, "")}_bar${nonce}`, author: who,
      files: [{ path: "bundle.md", text }, ...carried],
      meta: { object_type: head.type, title: head.title, current_state: fm.current_state ?? head.currentState,
              prior_state: fm.prior_state ?? null, created: fm.created, last_updated: at },
      actorIdentity: asked, actorViewer: viewer, actorMemberId: this.membership.positionalMember(viewer, asked) });
    if (!r || r.ok !== true) return r;
    return { ok: true, project: pid, bar: this.projectBar(pid), previous, author: who, at, reason: why,
             bundleSha: r.bundleSha };
  }

  /** R16: the bar read. `project=` is the answer under DEC-72; `group=` is DEC-17's surviving half, the default that
   *  seeds a new project, answered with its reason (R15; null on a default set before DEC-88); `target=` is refused by
   *  name, because no bar attaches to a finding. A project the viewer
   *  may not see is answered as one that does not exist. Two members who can both see a project are told the same bar
   *  ("never set by who a reader is"). */
  strengthBarOf({ group = null, target = null, project = null, viewer = null } = {}) {
    if (target)
      return { ok: false, reason: "BAR_IS_A_PROJECT_PROPERTY", target,
               detail: localize("strength.index.a_standard_of_evidence_is_a_property_of_a_project",
                 "a standard of evidence is a property of a PROJECT, not of a finding or a claim (DEC-72). No bar attaches to this finding, and none ever did on its own behalf: what governed it was whichever project published it, at the moment it published. Ask the project — op=strengthbarof&project=<project id> — or op=strengthbarof&group= for the default a new project starts from.") };
    if (project) {
      const pid = String(project).trim();
      const unseen = this.#projectUnseen(pid, viewer);
      if (unseen) return unseen;
      return { ok: true, project: pid, bar: this.projectBar(pid) };
    }
    const gid = String(group ?? "").trim() || this.producingGroup();
    if (!gid)
      return { ok: true, group: null, bar: null, seeds_new_projects: true,
               detail: localize("strength.index.no_team_is_named_and_this_store_records_no_producing_team",
                 "no team is named and this store records no producing team, so there is no team default to read. An absent bar gates nothing and is not a bar of zero.") };
    const g = this.#one(`SELECT group_id, capture, connection, author, at, reason FROM group_strength_bar WHERE group_id=?`,
                        gid);
    return { ok: true, group: gid, bar: g || null, seeds_new_projects: true,
             detail: g ? null : localize("strength.index.no_team_default_is_declared",
               "no team default is declared. An absent bar gates nothing and is not a bar of zero.") };
  }
}

/* R44: the inquiry ids `ids` names, as a list of at most `INQUIRY_STRENGTH_IDS_MAX` distinct non-blank strings: a
   comma-separated string (the op's query) is split and its blanks dropped; a list holds only non-blank strings; anything
   else, or more than the bound, is null, a refusal. */
function idsOf(ids) {
  const list = typeof ids === "string" ? ids.split(",").map((i) => i.trim()).filter(Boolean) : ids;
  if (!Array.isArray(list) || list.some((i) => typeof i !== "string" || !i.trim() || i.length > 300)) return null;
  const distinct = [...new Set(list.map((i) => i.trim()))];
  return distinct.length > INQUIRY_STRENGTH_IDS_MAX ? null : distinct;
}

/* The distinct non-blank groups a set of legs carries: a leg naming no part is not a part anybody declared. */
function distinctParts(legs) {
  return new Set(legs.map((l) => String(l.ground ?? "").trim()).filter(Boolean)).size;
}

/* R6 (N303, DEC-36): one axis object with every member the viewer may not see WITHHELD WHOLE, in the members and the
   prose alike, and every record fact about the axis left as derived. A member is unseen when a bundle it is the leg of,
   points at or inherits from is one the viewer may not see: it leaves every list it was in, and a `weakest` it was
   loses the key, never a null or a stand-in. A seen member's `through` naming an unseen leg loses the key the same way.
   Prose is swept too, because a `why` or `detail` can carry an id from several levels down that no field of this answer
   holds: an unseen id leaves a list that still names a seen one, `(through …)` and `, which is …` go, and a sentence still naming one is
   dropped; a swept string then ends in one fixed sentence, whatever was taken. The counts (`load_bearing`,
   `population`) count unseen members too, so they go whenever anything is withheld (`hidden`, which also covers a
   load-bearing member no list names). Nothing says how much was withheld: `out_of_view: true` states only that
   something was. Returns the original object when nothing is withheld. */
/* R6 (T51; K4259): a member inert on every axis carries no grade at all, so it is ungraded; a leg graded on one axis
   is inert on the others and is not. One entry per target, in the order the first axis names them. */
function ungradedEverywhere(axes) {
  const keyOf = (m) => m.target_id ?? m.bundle_id;
  const inert = STRENGTH_AXES.map((a) => new Set((axes[a].not_load_bearing ?? []).map(keyOf)));
  const seen = new Set();
  return (axes[STRENGTH_AXES[0]].not_load_bearing ?? []).filter((m) => {
    const key = keyOf(m);
    if (seen.has(key) || !inert.every((set) => set.has(key))) return false;
    seen.add(key);
    return true;
  });
}

function redactAxis(axis, keep, hidden) {
  let touched = !!hidden;
  const unseen = (id) => id != null && keep(id) === null;
  const prose = (v) => {
    if (typeof v !== "string") return v;
    let hit = false;
    const gone = (id) => { if (!unseen(id)) return false; hit = true; return true; };
    const id = ID_IN_PROSE.source;
    /* A list keeps its seen ids; one left with none keeps them all, and its sentence goes below. */
    let t = v.replace(new RegExp(`\\s*\\(through (${id})\\)`, "g"), (m, x) => gone(x) ? "" : m)
      .replace(new RegExp(`, which is (${id})`, "g"), (m, x) => gone(x) ? "" : m)
      .replace(new RegExp(`(?:${id})(?:, (?:${id}))+`, "g"), (run) => {
        const ids = run.split(", ");
        const kept = ids.filter((x) => !unseen(x));
        if (!kept.length || kept.length === ids.length) return run;
        hit = true;
        return kept.join(", ");
      });
    const still = (x) => [...x.matchAll(new RegExp(id, "g"))].some((m) => gone(m[0]));
    t = t.split(/(?<=[.:])\s+/).filter((x) => !still(x)).join(" ");
    if (!hit) return v;
    touched = true;
    return t ? `${t} ${OUT_OF_VIEW_WORDS}` : OUT_OF_VIEW_WORDS;
  };
  const seen = (m) => !MEMBER_ID_FIELDS.some((f) => f !== "through" && unseen(m[f]));
  const named = (m) => {
    const out = { ...m };
    if (unseen(out.through)) { delete out.through; touched = true; }
    if (out.why != null) out.why = prose(out.why);
    return out;
  };
  const list = (ms) => (ms ?? []).flatMap((m) => {
    if (seen(m)) return [named(m)];
    touched = true;
    return [];
  });
  const withWeakest = (o, w) => {
    if (!w) return { ...o, weakest: w };
    if (seen(w)) return { ...o, weakest: named(w) };
    touched = true;
    const { weakest, ...rest } = o;
    return rest;
  };
  const uncounted = (o) => { if (!hidden) return o; const { load_bearing, population, ...rest } = o; return rest; };
  const part = (o) => uncounted(withWeakest({ ...o,
    not_load_bearing: list(o.not_load_bearing),
    ...(o.undetermined_at ? { undetermined_at: list(o.undetermined_at) } : {}) }, o.weakest));
  const out = { ...part(axis),
    /* REC-42: each ground names its own weakest, inert and unfinished members, so it gets the same sweep; the ground
       label is authored on the visible subject itself and is a record fact. */
    ...(axis.grounds ? { grounds: axis.grounds.map(part) } : {}),
    detail: prose(axis.detail) };
  return touched ? { ...out, out_of_view: true } : axis;
}

/* R10 (DEC-44, DEC-40), enforced over the answer on its way out: null when well formed, else the refusal itself. */
function refusePairComposed(out) {
  const refusal = (code, detail) => {
    const row = VERSION_STRENGTH_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
  };
  if (!out || out.ok !== true) return null;
  /* DEC-49 REGION is-pair-composed */
  for (const k of PAIR_COMPOSED_KEYS)
    if (Object.prototype.hasOwnProperty.call(out, k))
      return refusal("VERSION_STRENGTH_COMPOSED",
        localize("strength.index.this_answer_carries_a_top_level",
          "this answer carries a top-level '{key}', which can only be one figure standing for every axis. Strength is one measurement PER AXIS, each over its own population — {axes} — and there is no value that is all of them.",
          { key: String(k).slice(0, 40), axes: STRENGTH_AXES.join(", ") }));
  const pair = out.pair;
  if (!pair || typeof pair !== "object")
    return refusal("VERSION_STRENGTH_COMPOSED",
      localize("strength.index.this_answer_carries_no_pair_at_all",
        "this answer carries no pair at all, so whatever it reports is not the per-axis measurements this record makes."));
  /* Totality, both ways: exactly the axes, no more and no fewer. */
  const keys = Object.keys(pair).sort();
  const want = [...STRENGTH_AXES].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i]))
    return refusal("VERSION_STRENGTH_COMPOSED",
      localize("strength.index.the_pair_holds_where_it_must_hold_exactly",
        "the pair holds {held} where it must hold exactly {want}. One answer per population, and nothing beside them that reads as a summary of all of them.",
        { held: JSON.stringify(keys), want: JSON.stringify(want) }));
  if (typeof out.filter !== "string" || out.filter.trim().split(/\s+/).length < 5)
    return refusal("VERSION_STRENGTH_UNFILTERED",
      localize("strength.index.this_answer_does_not_state_which_readings",
        "this answer does not state which readings it was computed over. Every answer says so on its face — the record's own as plainly as a view somebody constructed — because absence of the line is exactly what makes the two indistinguishable."));
  if (!Array.isArray(out.state_set) || !out.state_set.length)
    return refusal("VERSION_STRENGTH_UNFILTERED",
      localize("strength.index.this_answer_carries_no_machine_readable_state_set",
        "this answer carries no machine-readable state set beside its sentence, so a consumer would have to parse prose to learn what it counted."));
  /* END DEC-49 REGION is-pair-composed */
  return null;
}

/** R10's guard as a function a test can drive over any answer (C-30.7, C-30.8). */
export { refusePairComposed };

/** The module's ops (K3): `strength` (in-process), `inquirystrength`, `versionstrength`, `partitionindependence`,
 *  `strengthbar` and `strengthbarset` (R41), `projectbarset` (R40), `strengthbarof`; `inquirystrength` reads one `id` or a list of `ids` (R44). `viewer` and `author` are the control plane's stamps. */
export function strengthOps(s, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    strength: () => s.strengthOf(q("id")),
    /* R44: `ids` (the body's list, else the query's comma-separated one) asks many in one call; absent, the single read. */
    inquirystrength: () => {
      const ids = body && body.ids != null ? body.ids : q("ids");
      return ids == null ? s.inquiryStrength({ id: q("id"), viewer: q("viewer") })
                         : s.inquiryStrengthMany({ ids, viewer: q("viewer") });
    },
    versionstrength: () => s.versionStrength({ id: q("id"), version: q("version"), project: q("project"),
                                               states: q("states"), viewer: q("viewer") }),
    partitionindependence: () => s.partitionIndependence({ id: q("id"),
      partition: (body && body.partition !== undefined) ? body.partition : q("partition"),
      version: q("version"), viewer: q("viewer") }),
    strengthbar: () => s.strengthBarSet({ ...(body || {}), author: q("author") }),
    /* R41 (T51; K4258): the same act under the name the screens send; `strengthbar` stays served until its hand row goes. */
    strengthbarset: () => s.strengthBarSet({ ...(body || {}), author: q("author") }),
    /* R40: the project from the body, else the query; `author`, `viewer` and `identity` are the control plane's stamps,
       never the body's. */
    projectbarset: () => s.projectBarSet({ ...(body || {}), project: (body && body.project != null) ? body.project : q("project"),
                                           author: q("author"), viewer: q("viewer"), identity: q("identity") }),
    /* `target` still reaches the method, so a withdrawn arm is refused by name rather than 404'd at the router. */
    strengthbarof: () => s.strengthBarOf({ group: q("group"), target: q("target"), project: q("project"),
                                           viewer: q("viewer") }),
  };
}

/* R41 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  strengthbarset: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", needs: "publish", description: localize("strength.declared.strengthbarset", "governance: the GROUP's declared default required strength, keyed by group and not by any bundle — a declaration about the group's own work, never a property of an object or of a reader"),
    fields: { accepts: ["group","capture","connection","reason"], requires: [["capture","connection"],"reason"] } },
  inquirystrength: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("strength.declared.inquirystrength", "read: the derived pair for one question — the panel the acts are rendered under, never an act on an object"),
    fields: { accepts: ["id","ids"], requires: [["id","ids"]] } },
  projectbarset: { classes: ["admin","member","probe"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("strength.declared.projectbarset", "project-directed: keyed by a project; the project's own required strength, set with the member's reason; never the group's bar, and it gates nothing (`strength` R21)"),
    fields: { accepts: ["project","capture","connection","reason","expected"], requires: ["project","reason"] } },
});

const instances = new WeakMap();

/** R39 (plan T33, Rules (6); record-core R21, R77): this module's tables, each with its classes. The cache is
 *  derived-rebuildable, keyed by `bundle_id`, with the sight of the bundle it names, rebuilt by R13's computation; the
 *  group's default bar is exempt from purge as an instance setting (R23), group-wide; the rest as `declarePurge`'s
 *  default form gives them. */
export function strengthTables(s) {
  const rest = { expunge: "none", export: "admin-only", version_chain: false };
  return [
    { name: STRENGTH_CACHE_TABLE, purge: "clear", sight: "bundle", derive: "derived-rebuildable", key: ["bundle_id"],
      rebuild: (scope) => s.rebuildCache(scope), ...rest },
    ...STRENGTH_EXEMPT_TABLES.map((name) => ({ name, purge: "exempt", sight: "group", derive: "stored", ...rest })),
  ];
}

/** K61: the one instance per host, created on the first call with `deps`. It creates its tables and declares them to
 *  purge (R23), joins every promotion with its cache projection (R13) and registers its pair with inquiry's grouping
 *  act (R17). Any call handing `retrieval` in registers the cache's columns with it, once (R23, N137). */
export function strengthOf(host, deps) {
  let s = instances.get(host);
  if (!s) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const producingGroup = d.producingGroup || (() => {
      const f = promotion.fact("producingGroup");
      return f && f.ok ? (f.value || null) : null;
    });
    s = new Strength({ ...d, host, storage, record, membership, promotion, producingGroup });
    instances.set(host, s);
    s.migrate();
    const declared = record.declareTable("strength", strengthTables(s));
    if (!declared || declared.ok === false) throw new Error(`strength's tables could not be declared: ${JSON.stringify(declared)}`);
    promotion.registerStep("strength", { project: (c) => s.project(c) });
    s.registerGrounded();
  }
  if (deps && deps.retrieval) s.joinRetrieval(deps.retrieval);
  return s;
}
