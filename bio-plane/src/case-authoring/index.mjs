/* case-authoring — preparing a case before anything is signed (requirements: `build/requirements/case-authoring.md`;
 * BIO_Publication_v0_1.md §3 rules 4, 12, 13, 15, 16, 18, §6A). The owner of a project prepares a case: which concluded
 * findings it rests on and in what role, what it covers and excludes, who wrote its statement, what was searched and
 * with what outcome, and what bias it acknowledges. This module judges that preparation (`op=publish`), authors the
 * case document's text from the record and the owner's words (`./document.mjs`), and stores it unsigned through
 * `publication` (its R21). What other acts record about a case before its next edition (the statement's
 * acknowledgements and who wrote the statement, the drafts of what changed, the open requests for comment at signing,
 * the outcomes carried into a next edition) is `case-inputs`', which `publishCase` and `publishPreflight` ask (R14, R34,
 * R38, R74; N908, K2982); this module holds no table. What the case discloses about what it rests on
 * (tensions, grades and co-attestation, sources, materials, accepted work and flags, grading facts, hunch debt) is
 * judged and spelled by `case-disclosures`, which `publishCase` asks in R55's order (N529, K1333). (T41; D56, D57, D60,
 * D61, D63) It writes the case's account and the reviewers' comments the publisher chose into the document (R63), holds
 * the fields a case may carry and no other (R65), the pre-flight's account step (R67) and the approvals the group's rule
 * requires (R68). The account's own machinery (the system's drafts of it, its shape, its judgment against what it cites,
 * a draft's acceptance, the review comments' reader) is `case-account`'s, which `publishCase` asks in R69's order (N839,
 * K2608); its drafts' proposal and list and the reader's registration are `case-account`'s alone, and this module
 * answers none of them (R69; T43, N850).
 *
 * Extracted from the legacy modules (T8, layer 8; K3, K6, K57, K61, K82 (5), K94, K102): `store.mjs` (`publishCase`,
 * `#caseCitations`, `#caseDocumentText`, `#searchedForCase` with its two evidence probes, `COMPLETENESS_MAX`,
 * `MEMBER_ROLES`, `SEARCHED_SUBJECT_MAX`, the dispatch entry `publishcase`), `airun.mjs` (`searchedSection`,
 * `SEARCHED_LEVEL_OUTCOMES`, now `./searched.mjs`; N138) and the check catalogue (C-44.1, C-44.3–C-44.5, now
 * `./checks.mjs`). The acknowledgements, their table and C-82 moved on to `case-inputs` (T47; N908). The legacy code's
 * comments moved with it, shortened where they only restated the code.
 * The record's grammar (front matter, object types, grades, the machine predicate, the hash) is `record-grammar`'s;
 * the one front-matter spelling (`fmSafe`) is `case-grammar`'s (N424).
 *
 * WHAT IS AUTHORED AND WHAT IS STAMPED (R22, R25). Authored, caller-supplied and never prefilled: the scope, the
 * completeness statement, every exclusion row, the subject position with its justification (DEC-13), the bias
 * acknowledgement (DEC-46), the load-bearing partition (DEC-72 clause 4). Stamped or read from the record at the act:
 * the author (the control plane's stamp), the time, the case edition (from the published record, never a parameter),
 * each member's pin, own edition and frozen pair, the conclusion it rests on, the bar, the bias manifest, the
 * citations, the searched section, and the acknowledgements and the statement's writer (`case-inputs` R2, R3). Nothing is composed, summarised or
 * inferred, and no answer or document composes a case-level strength (R24, DEC-44).
 *
 * PUBLISHING WRITES NOTHING ON A MEMBER FINDING (R13, R23; D-442, rule 12): each member is pinned at the `bundle_sha`
 * it has as prepared, so one project's preparation never moves another project's pin.
 *
 * REACHED as `caseAuthoringOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call with `deps`, returned to every later caller. It holds no table and declares none. At creation it creates
 * `case-account`'s and `case-inputs`' one instances on the host, so those modules' tables exist and are declared at
 * every boot (case-account R12, case-inputs R16; the map's doubt 4). It registers with nothing (map §6 item 4); `review`
 * registers its comments' reader with `case-account` itself (its R7; N850).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership   layer 2: `readFile`, `head`, `transact`, `mintOpaqueId`; `viewerPredicate`,
 *                        `isProjectOwner`, `existenceAct`.
 *   inquiry              the basis read of R17's searched section.
 *   basisVersions        `testimonyReach` (R14's attributions).
 *   strength             `strengthOf`, `projectBar` (R6, R14).
 *   bias                 `biasManifest` (R14).
 *   observations         observation-log's `missingCauseAt` (R17).
 *   reevaluation         `raise` (R15).
 *   publishSchedule      `waitingEditionOf` (publish-schedule R7; R58; N823).
 *   account              `case-account` (N839, K2608): the account's shape, its draft, its judgment, the review
 *                        comments chosen and a draft's acceptance (its R4–R7), asked in R69's order: its one instance on
 *                        this host.
 *   inputs               `case-inputs` (N908, K2982): `statementWriter`, `statementAcknowledgements`,
 *                        `whatChangedDraftOf`, `pendingOutcomes`, `openRequestsOn` (its R2, R3, R7–R9): its one instance
 *                        on this host.
 *   publication          `storeCaseDocument`, `reviewProvider` (its R21, R23),
 *                        `criteriaFor` (its R75; R61).
 *   caseTensions         `caseRelation`, `attributionStatements` (case-tensions R1, R5; T33-62).
 *   calculations, workbooks   R56's gather (calculations R8–R10, workbooks R2). events   R57's timeline (its R28–R30).
 *   ratification         `caseConclusionFor`, `editionsRecordingConclusion` (its R1).
 *   networkNotices       `noticeReferenceOf` (its R19; R41, R42: DEC-111).
 *   disclosures          `case-disclosures` (N529, K1333): what a case discloses about what it rests on, asked in R55's
 *                        order: its one instance on this host, which the composition builds with the dependencies it
 *                        reads (N536); this module hands it none and reads none of them itself.
 *   now                  the clock for the instants it writes, `(precision) => ISO string` (default: the wall clock).
 * `case-checker`'s `checkStandardsUse` (its R21; R61) is pure and imported, never a dependency.
 *
 * READ CONTRACTS it joins in its own SQL, each named at its statement: record-core's `bundles` (R37); publication's
 * `cases`, `published_cases`, `published_case_members`, `published_bundles`, `case_documents` (R40); inquiry's `inquiry_basis` (R40); content's `content` (R45); provenance's `register` and
 * `captured_locators` (R48); extraction's `readings` (R58); observation-log's `observation_log` (R29). */

import { recordOf, stampInstant, mintExhausted } from "../record-core/index.mjs";
import { boundOf } from "../read-bounds.mjs";
import { membershipOf, viewerPredicate, noSuchProject } from "../membership/index.mjs";
import { observationLogOf } from "../observation-log/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { basisVersionsOf, BASIS_VERSIONS_LIMIT_MAX } from "../basis-versions/index.mjs";
import { strengthOf, STRENGTH_AXES } from "../strength/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { publicationOf, CASE_SOURCES_CHECKS } from "../publication/index.mjs";
import * as publicationExports from "../publication/index.mjs";
/* R72 (T45; N892): a project's scope, project-roster R23's. */
import { projectRosterOf } from "../project-roster/index.mjs";
/* R58 (N823; K2438): the waiting edition is `publish-schedule`'s (its R1, read through its R7), since publication's
   third split. */
import { publishScheduleOf } from "../publish-schedule/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
/* R85 (fix round 6, G9; K4573): `case-carriage`, the one instance on the host, whose `copyNow` makes a small member
   document's publication copy inside `op=publish`. */
import { caseCarriageOf } from "../case-carriage/index.mjs";
import { ratificationOf, SUBJECT_POSITIONS, completenessFields } from "../ratification/index.mjs";
import { networkNoticesOf } from "../network-notices/index.mjs";
import { parseFrontmatter, normalizeType, isMachineIdentity, OBJECT_TYPES, BASIS_GRADES,
         isPublicHttpsLocator, idPattern, sha256HexSync } from "../record-grammar/index.mjs";
/* R63, R69 (N839, K2608): the account's machinery is `case-account`'s, asked in R69's order. */
import { caseAccountOf } from "../case-account/index.mjs";
/* B10 (K4240): `capture`, the one instance on the host, which records the members who captured each capture (its R69). */
import { captureOf } from "../capture/index.mjs";
import { contentOf } from "../content/index.mjs";
/* R56, R57 (T33): case-grammar's `calculationsLines` and `timelineLines` (its R18, R20), the one spelling of each block. */
import { calculationsLines, timelineLines, materialsOf, passagesOf, memberTiesOf, caseDocumentBlocks,
         caseTensionsOf as tensionsOfDocument } from "../case-grammar/index.mjs";
/* R63, R68 (T41; D56, D60): case-grammar's account and approval blocks (its R23, R26), the one spelling of each, and the
   approval digest an approval names (its R26; K2528). The review comments' block is `case-account` R7's answer. */
import { accountLines, accountSectionLines, approvalsLines, approvalSubjectSha } from "../case-grammar/index.mjs";
/* R74 (T45; T47): case-grammar R29's `outcomes:` block and body section, the one spelling of each. */
import { outcomesLines, outcomesSectionLines } from "../case-grammar/index.mjs";
/* R14, R34, R38, R74 (T47; N908; K2982): what other acts record about a case is `case-inputs`', asked through its one
   instance (`inputs`); its sign-step lines, its unread sentence and the 8,000-character bound are imported, one spelling
   each, never copied (K1333). */
import { caseInputsOf, openRequestLine, OPEN_REQUEST_KEYS, OPEN_REQUESTS_UNREAD_SENTENCE, WHAT_CHANGED_MAX,
         minutesLine } from "../case-inputs/index.mjs";
/* R61 (N717; K2129): how a case uses the standards it measures against, judged by `case-checker`'s pure R21. */
import { checkStandardsUse } from "../case-checker/standards.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { workbooksOf } from "../workbooks/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { caseDisclosuresOf, FLAGS_SAY, SELF_ATTESTED_SENTENCE, TENSIONS_DEPTH_STATED, peopleLines, memberTieLines }
  from "../case-disclosures/index.mjs";
import { PUBLISH_ACT_CHECKS, CASE_DERIVATION_CHECKS } from "./checks.mjs";
import { searchedSection } from "./searched.mjs";
import { caseDocumentText, CEREMONY_HIGHLIGHT_SENTENCE } from "./document.mjs";

export { PUBLISH_ACT_CHECKS, CASE_DERIVATION_CHECKS } from "./checks.mjs";
export { searchedSection, SEARCHED_LEVEL_OUTCOMES } from "./searched.mjs";
export { caseDocumentText, fmSafe, CASE_CITATION_WORDS, CEREMONY_HIGHLIGHT_SENTENCE, CALCULATION_STATE_WORDS,
         WORKBOOK_STATE_WORDS } from "./document.mjs";
/* N529 (K1333): what moved to `case-disclosures`, re-exported for this module's importers (`affordances`, `review`,
   `plane` and their tests) so the split asks nothing of them: the C-120 family (R29) and the disclosure constants and
   renderers this module's document writes (R14). Each is case-disclosures' one spelling, never a copy. */
export { CASE_DISCLOSURE_CHECKS, TENSION_TEMPLATES, tensionSentence, HIGHLIGHT_SENTENCE, NOT_SHOWN_WORDS,
         TENSIONS_DEPTH_STATED, tensionSide, SELF_ATTESTED_SENTENCE } from "../case-disclosures/index.mjs";

/** R3: the longest authored field (the statement, the subject justification, the scope, the bias acknowledgement, and
 *  each exclusion's description and reason). */
export const COMPLETENESS_MAX = 2000;
/** R5: the two designations a case member can carry, spelled as `published_case_members.role` spells them (CASE-1),
 *  `load_bearing` first because a refusal listing them should name the one that carries the case first. */
export const MEMBER_ROLES = Object.freeze(["load_bearing", "supporting"]);
/** R17: how many subjects a case's searched section computes over. A bound rather than a scan (D-225 / REC-70); the
 *  overflow is published as `unidentified`, so a case past it reads `partial`, never `searched` over a truncated set. */
export const SEARCHED_SUBJECT_MAX = 500;
/** R42 (DEC-111; K1119): what step one adds when the project has a notice (R41), one plain sentence until the UX design
 *  stream gives the words. */
export const NOTICE_SEALS_SENTENCE = word("case-authoring.notice_seals_sentence");
/** R75 (N683; DEC-147): what the sign step says of "Publish at…" when ratification's pre-flight is not reached, and
 *  when it is reached and answers no offer; in neither case is one made. */
export const PUBLISH_AT_NOT_REACHED_SENTENCE = word("case-authoring.publish_at_not_reached_sentence");
export const PUBLISH_AT_UNANSWERED_SENTENCE = word("case-authoring.publish_at_unanswered_sentence");
/** R34 (DEC-112 (4)): what step one adds, one plain sentence until the UX design stream gives the words. */
export const REPUBLISH_SENTENCE = word("case-authoring.republish_sentence");
/** R14, R40 (D54; K2442): the viewer the manifest is read as, the plane's machine credential, which sees every bundle
 *  (membership R43's machine arm): the lens is a fact about the project's scope, read inside an act whose own authority
 *  fences (R2) have already admitted the publisher. Never the founder's viewer, which D54 leaves blind to a hidden
 *  project it is neither invited to nor joined. */
export const PLANE_VIEWER = "class:daemon";
/** R16: the id chunk for the citations' grouped read, this module's own copy of `retrieval`'s (K57). */
export const SELECTION_ID_CHUNK = 64;
/** R17: the IN lists of the searched section's reads are chunked at 50, under D-36's 100-bound-parameter ceiling. */
const SEARCHED_CHUNK = 50;
/** R40: the manifest's page, bias R18's largest, so a lens is read in as few pages as the bound allows. */
const LENS_PAGE = 2000;
/** R40: publication R12's `publishedTargets` reads at most 200 ids a call. */
const PUBLISHED_TARGETS_CHUNK = 200;

/** R85 (fix round 6, G9; K4573): the largest member document `op=publish` makes the copy of in the act itself, in bytes;
 *  a larger one keeps the scheduler's alarm path. */
export const COPY_NOW_MAX_BYTES = boundOf("case", "copy_now_bytes");
const HEX64 = /^[0-9a-f]{64}$/;

/** R65 (D57, D63): the authored fields of `op=publish`, exactly: the four statements, the scope, the bias acknowledgement
 *  and the account (R63), with the statements' citations (R63, K2533). A story, context or human-interest passage has
 *  no field. */
export const AUTHORED_FIELDS = Object.freeze(["statement", "subjectJustification", "excluded", "whatChanged", "scope",
  "biasAcknowledgement", "account", "statementCites"]);
/** R65: the act's other arguments, none of them authored prose: what it publishes and in what roles (R3–R9), what the
 *  owner discloses and attests (R55, R56), the account's draft and the review comments chosen (R69), and the
 *  control plane's stamps. Any other field is `CASE_FIELD_NOT_ALLOWED`, naming it. */
export const ACT_FIELDS = Object.freeze(["target", "targets", "project", "roles", "caseId", "newCase", "draft",
  "subjectPosition", "tensionsDisclosed", "selfAttested", "flagsDisclosed", "calculationsDisclosed", "peopleBases",
  "tieAttested", "accountDraft", "reviewComments", "viewer", "author"]);
/** R78 (T51; C1; K4165): the fields a draft keeps, which `review` reads for its draft act (its R4): the authored and the act's
 *  fields without the stamps (`viewer`, `author`), the `project` (the draft's own column), `draft` (a draft does not name a
 *  draft) and `tieAttested` (the signer's confirmation is made in the act, R76). */
export const DRAFT_FIELDS = Object.freeze([...new Set([...AUTHORED_FIELDS, ...ACT_FIELDS])]
  .filter((f) => !["viewer", "author", "project", "draft", "tieAttested"].includes(f)));
/** R78: the pairs of `DRAFT_FIELDS` that state one thing between them (the roster; the case's identity), so a call that
 *  sends either keeps the draft's other out, rather than a call and a draft each naming a half. */
const DRAFT_PAIRS = Object.freeze([["targets", "target"], ["caseId", "newCase"]]);
const str = (v) => String(v ?? "").trim();
/** R56: what a `calculations:` row's `disclosed` states when the publisher listed a calculation that needed disclosure
 *  and gave no words of their own (case-grammar R18: null would read as "none was needed"). */
export const DISCLOSED_WITHOUT_WORDS = word("case-authoring.disclosed_without_words");
/* R56 (N596; calculations R9): a `calculations:` row's inputs, each `{name, sha256}` as `read` states it in
   `calculation.inputs` (`sha`, the lowercase hex SHA-256 of the input's canonical bytes), null where it states none. */
const inputsHashed = (r) => (r.calculation && Array.isArray(r.calculation.inputs) ? r.calculation.inputs : [])
  .filter((x) => x && typeof x === "object")
  .map((x) => ({ name: x.name ?? null, sha256: typeof x.sha === "string" ? x.sha : null }));
/** R56: how deep a member's chain is followed through inquiry legs to the calculations it reaches. */
const CHAIN_DEPTH_MAX = 16;
/** R55 (case-disclosures R24): an entity id in an authored sentence, record-grammar's one spelling of it. */
const ENTITY_ID = idPattern("ENT");
/* R60 (N717; case-grammar R22): the `subject_entity` a member's pinned bytes state, or null when they state none (an
   inquiry's own gate admits only an entity id there, inquiry-grammar's C-2.8). */
const subjectStated = (fm) => (fm && typeof fm.subject_entity === "string" && ENTITY_ID.test(fm.subject_entity.trim())
  ? fm.subject_entity.trim() : null);
/* R55 (case-disclosures R27): the signer's attestation of no undeclared tie is the act's own: `tieAttested: true` from the
   publishing owner, stamped with the author and the act's instant (R25), never a body's names or times. */
const attestedBy = (who, tieAttested, at) => (tieAttested === true ? [{ signer: who, at }] : null);
/** R61: each of `case-checker` R21's refusals, named to the publisher in one sentence: the words are setup-words'
 *  `case-authoring.text.*` rows, read by key with the refusal's own fields as their fills (K3912; no English here). */
function standardsUseWords(r) {
  switch (r && r.code) {
    case "COPYRIGHTED_TEXT_CARRIED":
      return word("case-authoring.text.case_would_carry", { sha: r.sha, standard: r.standard });
    case "COPYRIGHTED_PASSAGE_UNRELIED":
      return word("case-authoring.text.case_quotes_passage", { content: r.content, standard: r.standard });
    case "BENCHMARK_CALLED_NONCONFORMING":
      return word("case-authoring.text.rests_benchmarks_binds", { finding: r.finding, standard: r.standard, word: r.word });
    default:
      return word("case-authoring.text.case_use_standards", { arguments: r && r.field ? r.field : localize("case-authoring.index.its_arguments", "its arguments") });
  }
}
/* R3's set: `targets` as a list, a comma-separated string, or the one `target`. */
const membersOf = (targets, target) => [...new Set((Array.isArray(targets) ? targets
  : typeof targets === "string" && targets.trim() ? targets.split(",") : target ? [target] : [])
  .map((x) => str(x)).filter(Boolean))];
/* R57: an item's `when` as events holds it (case-grammar R20): its value, which carries its precision; `undetermined`
   with its bounds; or `nowhere`. No zone is written (R30). */
function whenWords(when, why) {
  if (when && typeof when === "object" && when.value != null) return String(when.value);
  if (when === "undetermined" || why) return when && when.start ? `undetermined ${when.start}..${when.end}` : "undetermined";
  return "nowhere";
}
/** R34: what the pre-flight throws to roll back its run of op=publish (record-core R32). */
const PREFLIGHT_ROLLBACK = Symbol("case-authoring pre-flight rollback");

/* The one constructor of a refusal with a catalogue row (DEC-49): `reason` and `code` carry the same literal, and the
   row's `check` and `translation` join the site's own `detail` and keys. */
function refusal(family, key, extra = {}) {
  const row = family[key];
  return { ok: false, reason: key, code: key, check: row.check, translation: row.translation, ...extra };
}
/* Each family's own helper, the code its literal first argument, so the DEC-49 guard judges the code at each site
   against the rows that govern it (N259, N275). */
const derivationRefusal = (key, extra) => refusal(CASE_DERIVATION_CHECKS, key, extra);
const actRefusal = (key, extra) => refusal(PUBLISH_ACT_CHECKS, key, extra);

export class CaseAuthoring {
  #deps;

  constructor({ storage, record, membership, host = null, inquiry = null, basisVersions = null, strength = null,
                bias = null, observations = null, reevaluation = null, publication = null, publishSchedule = null,
                ratification = null, account = null, inputs = null, networkNotices = null, disclosures = null, calculations = null,
                workbooks = null, events = null, caseTensions = null, projectRoster = null, caseCarriage = null,
                content = null, now = null } = {}) {
    this.sql = storage.sql;
    this.storage = storage;
    this.record = record;
    this.membership = membership;
    this.#deps = { host, inquiry, basisVersions, strength, bias, observations, reevaluation, publication, publishSchedule,
                   ratification, account, inputs, networkNotices, disclosures, calculations, workbooks, events, caseTensions,
                   projectRoster, caseCarriage, content };
    this.now = typeof now === "function" ? now : (precision) => stampInstant(precision);
  }

  /* F2 (`case-grammar` R37): one `typed_passages:` row per relied-on passage that is a member's typing, as `content`'s
     earned read states it at the act (`standings`, its R20, R64): when it was typed, the typist's credit and each other
     member who had checked it, in time order, each at the credit level in force, a name only where that level shows one;
     no member id is handed on. A passage whose read states no typing is not listed. Never throws: a read that fails
     lists none. */
  #typedPassageRows(passages) {
    const rows = Array.isArray(passages) ? passages : [];
    if (!rows.length) return [];
    let standing = {};
    try { standing = this.content.standings([...new Set(rows.map((p) => p.content_id))]) || {}; } catch { standing = {}; }
    const credit = (c) => ({ level: c && typeof c.credit === "string" ? c.credit : null, shown: c && c.name ? c.name : null });
    return rows.flatMap((p) => {
      const t = standing[p.content_id] && standing[p.content_id].typed;
      if (!t) return [];
      const typist = credit(t.typist);
      return [{ finding: p.finding, ord: p.ord, content_id: p.content_id, typed_at: t.at ?? null,
                typist_level: typist.level, typist_shown: typist.shown,
                checkers: (Array.isArray(t.checkers) ? t.checkers : []).map((c) => ({ ...credit(c), at: c.at ?? null })) }];
    });
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get provenance() { return this.#deps.provenance ||= provenanceOf(this.#deps.host); }
  get inquiry() { return this.#deps.inquiry ||= inquiryOf(this.#deps.host); }
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host); }
  get strength() { return this.#deps.strength ||= strengthOf(this.#deps.host); }
  get bias() { return this.#deps.bias ||= biasOf(this.#deps.host); }
  get observations() { return this.#deps.observations ||= observationLogOf(this.#deps.host); }
  get reevaluation() { return this.#deps.reevaluation ||= reevaluationOf(this.#deps.host); }
  get publication() { return this.#deps.publication ||= publicationOf(this.#deps.host); }
  /* R58: the waiting edition's one read (publish-schedule R7), viewer-free and in-process. */
  get publishSchedule() { return this.#deps.publishSchedule ||= publishScheduleOf(this.#deps.host); }
  get ratification() { return this.#deps.ratification ||= ratificationOf(this.#deps.host); }
  /* R69 (N839, K2608): `case-account`, the one instance on this host, asked in R69's order; created at this module's
     creation (`caseAuthoringOf`), so its tables exist and are declared at every boot (its R12). */
  get account() { return this.#deps.account ||= caseAccountOf(this.#deps.host); }
  /* B10 (K4240): `capture`, the one instance on this host (`captureOf`), read for who captured what the pre-flight lists. */
  get capture() { return this.#deps.capture ||= captureOf(this.#deps.host); }
  /* F2 (`case-grammar` R37): `content`, the one instance on this host, read for who typed and who checked a passage. */
  get content() { return this.#deps.content ||= contentOf(this.#deps.host); }
  /* R14, R34, R38, R74 (T47; N908; K2982): `case-inputs`, the one instance on this host, which holds what other acts
     record about a case (the statement's acknowledgements and writer, the drafts of what changed, the open requests, the
     outcomes carried); created at this module's creation (`caseAuthoringOf`), so its tables exist and are declared at
     every boot (its R16). Created with this module's record, membership and clock when it is the first to ask. */
  get inputs() {
    return this.#deps.inputs ||= caseInputsOf(this.#deps.host, { record: this.record, membership: this.membership,
                                                                  now: this.now });
  }
  get networkNotices() { return this.#deps.networkNotices ||= networkNoticesOf(this.#deps.host); }
  /* R55 (N529, K1333): `case-disclosures`, the one instance on this host, asked in R55's order. The composition builds
     it with what it reads (N536: `plane` composes `caseDisclosuresOf(ctx, {attestation})` first, K1355). */
  get disclosures() { return this.#deps.disclosures ||= caseDisclosuresOf(this.#deps.host); }
  /* R56: the calculations a member's chain reaches, recomputed and read at publication (calculations R8–R10), and the
     workbooks among its captures (workbooks R2; K1570, K1594). */
  get calculations() { return this.#deps.calculations ||= calculationsOf(this.#deps.host); }
  get workbooks() { return this.#deps.workbooks ||= workbooksOf(this.#deps.host); }
  /* R57: the timeline of the members' subjects and the events their legs cite (events R28–R30). */
  get events() { return this.#deps.events ||= eventsOf(this.#deps.host); }
  /* R85 (fix round 6, G9): the one `case-carriage` instance on this host, read for `copyNow` only. */
  get caseCarriage() { return this.#deps.caseCarriage ||= caseCarriageOf(this.#deps.host); }
  /* R72 (T45; N892): `projectScope` (project-roster R23), asking no viewer. */
  get projectRoster() { return this.#deps.projectRoster ||= projectRosterOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  /* R8, R55 (T33-62): `caseRelation` and `attributionStatements` are `case-tensions`' (its R1, R5): its one instance on
     this host, whose provider `publication` registers when it is created (publication R61), so publication is reached
     first. */
  get caseTensions() {
    if (!this.#deps.caseTensions) { void this.publication; this.#deps.caseTensions = caseTensionsOf(this.#deps.host); }
    return this.#deps.caseTensions;
  }

  /* R34: the sign step's `open_requests`, read once from the case and pins the rolled-back run resolved, through
     `case-inputs.openRequestsOn` (its R8); each line is its `openRequestLine` (its R10, R17), the unread sentence its
     `OPEN_REQUESTS_UNREAD_SENTENCE`; this module spells none of them (T47; N908). */
  #openRequestsStep(at, viewer) {
    if (!at) return { read: false, stated: localize("case-authoring.index.not_reached_op_publish_refuses_before", "not reached: op=publish refuses before the case and its pins are known") };
    const r = this.inputs.openRequestsOn({ case: at.case, members: at.members, viewer });
    if (!r.ok) return { read: false, undetermined: true, key: OPEN_REQUEST_KEYS.unread, says: OPEN_REQUESTS_UNREAD_SENTENCE };
    return { read: true, lines: r.rows.map((row) => ({ ...row, ...openRequestLine(row) })) };
  }

  /* R77 (T51; DEC-340): the sign step's minutes comparisons, read once from the same case and pins through
     `case-inputs.minutesComparisonsOn` (its R19), each row with its `minutesLine`; a source unreadable, or the case not
     yet known, or the door unbound, throwing or answering anything but its rows, is `{undetermined: true}` and no rows,
     never `[]` and never a row filled in (fix round 3, K4332, K4356). It carries no sentence of its own. */
  #minutesStep(at, viewer) {
    if (!at) return { undetermined: true };
    let r = null;
    try { r = this.inputs.minutesComparisonsOn({ case: at.case, members: at.members, viewer }); } catch { r = null; }
    if (!r || r.ok !== true || !Array.isArray(r.rows)) return { undetermined: true };
    return r.rows.map((row) => ({ ...row, ...minutesLine(row) }));
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  /* The act's instant, from the clock it was given. A clock that answers no instant is carried as it answers, so the
     searched section refuses it by name (R11) rather than stamping one the clock did not give. */
  #when(precision) { const w = this.now(precision); return typeof w === "string" ? w : stampInstant(precision); }

  /* The review provider publication holds (its R23): with none registered, every door refuses and `deadAnswer()` is
     still C-87.1's answer, so every `draft=` is refused C-44.3 (R9) when none is registered. */
  #review() { return this.publication.reviewProvider(); }

  /* The live `bundle.md` text of a held bundle, or null (blob-backed or absent): record-core R13. */
  #liveText(id) {
    const f = this.record.readFile(id, "bundle.md");
    return f && typeof f.text === "string" ? f.text : null;
  }

  /* ==========================================================================================================
   * op=publish: publishCase (R1–R18)
   *
   * THE ORDER IS THE POINT. Authoring the document CHANGES ITS HASH, so the signature can only be taken afterwards:
   * this act authors, `op=caseratify` signs (ratification). EVERY MEMBER IS JUDGED BEFORE ANY MEMBER MOVES, and every
   * refusal is asked before anything is written; the act runs as one transaction (record-core R32), so a refusal after
   * an id was drawn takes the id back and writes nothing (R11), and a caller's own transaction may roll the whole act
   * back (R18: the review copy's dry run).
   * ========================================================================================================== */
  publishCase(args = {}, calculationFacts = null) {
    return this.record.transact(() => this.#publishCase(this.#withDraft(args), { calculationFacts }));
  }

  /** R85 (fix round 6, G9; K4573; amends R18): `op=publish`'s act. It gathers the calculations (R56), runs `publishCase`, and,
   *  when that refuses `DOCUMENT_COPY_PENDING` (case-disclosures R6), awaits `case-carriage.copyNow` for the documents the
   *  refusal names, at most `COPY_NOW_MAX_BYTES` each, and runs `publishCase` once more over the same facts. `publishCase`
   *  itself stays synchronous (R18): the copy is made here, between the two runs. A copy not made (a larger document, no
   *  `copyNow`, one that throws or rejects) leaves the first refusal as it was, and the alarm path makes it. */
  async publishAct(args = {}) {
    const facts = await this.calculationsAtPublication(args);
    const first = this.publishCase(args, facts);
    if (!first || first.ok !== false || first.code !== "DOCUMENT_COPY_PENDING") return first;
    const shas = [...new Set((Array.isArray(first.pending) ? first.pending : [])
      .flatMap((m) => (Array.isArray(m && m.materials) ? m.materials : []).map((x) => str(x && x.sha))).filter((x) => HEX64.test(x)))];
    if (!shas.length) return first;
    try {
      const cc = this.caseCarriage;
      if (!cc || typeof cc.copyNow !== "function") return first;
      await cc.copyNow({ shas, maxBytes: COPY_NOW_MAX_BYTES });
    } catch { return first; }
    return this.publishCase(args, facts);
  }

  /* R78 (T51; C1; K4165; amends R9): THE DRAFT A CALL NAMES SUPPLIES WHAT THE CALL DID NOT SEND. The screens send the draft,
     the project and the signer's confirmation; the authored fields are the draft's (`review` R4). When `draft` names a
     draft the viewer may read (the review provider's door) and that belongs to `project`, each of `DRAFT_FIELDS` its
     `params` hold that the call does not itself send (absent or null; a pair of `DRAFT_PAIRS` counts as one) is taken
     from it, the call's own winning. A draft not held, or of another project, leaves the call as sent: R9 refuses it. It
     writes nothing, and `args` is not changed. */
  #withDraft(args) {
    const a = args && typeof args === "object" ? args : {};
    const named = str(a.draft), proj = str(a.project);
    if (!named || !proj) return a;
    const stamp = a.viewer && typeof a.viewer === "object" ? a.viewer.stamp ?? null : a.viewer ?? null;
    let d = null, params = null;
    try {
      d = this.#review().draftForMember(named, stamp);
      params = d && d.project_id === proj ? JSON.parse(d.params) : null;
    } catch { params = null; }
    if (!params || typeof params !== "object" || Array.isArray(params)) return a;
    const sent = (k) => a[k] !== undefined && a[k] !== null;
    const taken = {};
    for (const k of DRAFT_FIELDS) {
      const pair = DRAFT_PAIRS.find((g) => g.includes(k));
      if (params[k] !== undefined && params[k] !== null && !(pair ? pair.some(sent) : sent(k))) taken[k] = params[k];
    }
    return { ...a, ...taken };
  }

  /* ==========================================================================================================
   * R56 AT PUBLICATION, BEFORE THE ACT: the calculations a member's chain reaches, recomputed and read, and the
   * workbooks among the captures it rests on, read (J2 (1)). `calculations` and `workbooks` answer promises (their
   * tables' bytes come from the evidence store), and `publishCase` is synchronous inside its caller's transaction (R18),
   * so the async half runs here, before the act, and hands the act what it found. The recompute writes only
   * calculations' own recompute status (its R8: "recomputed … at publication"); a workbook is read, never recomputed
   * (workbooks R8). Nothing of the case is written here.
   * ========================================================================================================== */
  /** R56: `{calculations: [{calc, members, recomputed, read}], workbooks: [{capture, members, read}]}` for `publishCase`'s
   *  inputs, or both empty when R1, R2 or R4 would refuse first (the act then answers that refusal). Never throws for a
   *  calculation or workbook it cannot read: what it could not read is carried as it answered, and judged so. */
  async calculationsAtPublication(args = {}) {
    const a = this.#withDraft(args);
    const empty = { calculations: [], workbooks: [] };
    const who = str(a.author);
    if (!who || isMachineIdentity(who)) return empty;
    const viewer = a.viewer && typeof a.viewer === "object" ? a.viewer.stamp ?? null : a.viewer ?? null;
    const auth = this.#authority(a.project ?? null, viewer, who);
    if (auth.ok === false) return empty;
    const judged = this.#judgeMembers(membersOf(a.targets, a.target), auth.proj, viewer, auth.gate);
    if (judged.ok === false) return empty;
    const calculations = [];
    for (const [calc, members] of this.#calculationsReached(judged.prepared)) {
      let read = null, recomputed = null;
      try { read = await this.calculations.read({ calcId: calc, viewer }); }
      catch (e) { read = { ok: false, reason: "CALCULATION_UNREAD", detail: String(e && e.message || e).slice(0, 200) }; }
      /* calculations R10: one the viewer may not see is withheld whole, and is neither recomputed nor judged here. */
      if (read && read.ok !== false && read.found !== false) {
        try { recomputed = await this.calculations.recompute({ calcId: calc }); }
        catch (e) { recomputed = { ok: false, reason: "RECOMPUTE_FAILED", detail: String(e && e.message || e).slice(0, 200) }; }
      }
      calculations.push({ calc, members, read, recomputed });
    }
    const byCapture = new Map();
    for (const r of this.disclosures.restingCaptures(judged.prepared))
      byCapture.set(r.capture, [...new Set([...(byCapture.get(r.capture) || []), r.member])]);
    const workbooks = [];
    for (const [capture, members] of byCapture) {
      let read = null;
      try { read = await this.workbooks.readWorkbook({ captureSha: capture, project: auth.proj, viewer }); } catch { read = null; }
      if (read && read.ok !== false && read.workbook) workbooks.push({ capture, members, read });
    }
    return { calculations, workbooks };
  }

  /** R56: each calculation a member's chain reaches through its `calculation` legs (inquiry-grammar R14), followed
   *  through inquiry legs (`inquiry.basisFor`), each finding once, at most `CHAIN_DEPTH_MAX` deep: a Map from calculation
   *  id to the members whose chain reaches it, in member order. */
  #calculationsReached(prepared) {
    const out = new Map();
    const kindOf = (t) => normalizeType(OBJECT_TYPES[String(t).split("-")[0]]);
    for (const p of prepared) {
      const seen = new Set([p.id]);
      let frontier = [p.id];
      for (let depth = 0; frontier.length && depth < CHAIN_DEPTH_MAX; depth++) {
        const next = [];
        for (const id of frontier) {
          const basis = this.inquiry.basisFor(id);
          for (const leg of (basis && basis.ok !== false && Array.isArray(basis.legs) ? basis.legs : [])) {
            const t = str(leg.target_id);
            if (!t) continue;
            const kind = kindOf(t);
            if (kind === "calculation") out.set(t, [...new Set([...(out.get(t) || []), p.id])]);
            else if (kind === "inquiry" && !seen.has(t)) { seen.add(t); next.push(t); }
          }
        }
        frontier = next;
      }
    }
    return out;
  }

  /** R56: `{refusal?, rows, money}` — the `calculations:` rows (case-grammar R18) for every calculation and workbook the
   *  gather read, each with its state at this act and the owner's words where a disclosure was needed, and the first
   *  refusal: `calculationsDisclosed` malformed is R3's `BAD_COMPLETENESS` naming the field; facts never gathered while a
   *  chain reaches a calculation is `CALCULATIONS_UNREAD` (a dry run never reads an unread calculation as agreeing);
   *  a load-bearing member's calculation or workbook that differs or is unbound and is not listed is
   *  `CALCULATION_NOT_DISCLOSED`, naming each and its members. No other state refuses (D370). `money` is the money facts
   *  the calculations cite (case-disclosures R27). */
  #calculationsJudged(prepared, memberRoles, calculationsDisclosed, facts) {
    const bad = (field) => ({ refusal: { ok: false, reason: "BAD_COMPLETENESS", field,
      detail: localize("case-authoring.index.field_is_a_list_of", "{field} is a list of {calc, words?}: each names a calculation (or a workbook's capture) by its id, and its words, when given, are at most {COMPLETENESS_MAX} characters with no quote, backslash or line break",
                       { field: String(field), COMPLETENESS_MAX: String(COMPLETENESS_MAX) }) } });
    const listed = new Map();
    if (calculationsDisclosed != null) {
      if (!Array.isArray(calculationsDisclosed)) return bad("calculationsDisclosed");
      for (let i = 0; i < calculationsDisclosed.length; i++) {
        const e = calculationsDisclosed[i];
        if (!e || typeof e !== "object" || Array.isArray(e) || !str(e.calc)) return bad(`calculationsDisclosed[${i}]`);
        if (e.words !== undefined && e.words !== null
            && (typeof e.words !== "string" || e.words.length > COMPLETENESS_MAX || /["\\\r\n]/.test(e.words)))
          return bad(`calculationsDisclosed[${i}].words`);
        const k = str(e.calc);
        if (!listed.has(k)) listed.set(k, e.words == null ? "" : String(e.words).trim());
      }
    }
    const reached = this.#calculationsReached(prepared);
    if (!facts && reached.size)
      return { refusal: { ok: false, reason: "CALCULATIONS_UNREAD", calculations: [...reached.keys()],
        detail: localize("case-authoring.index.this_act_was_asked_without", "this act was asked without the calculations its findings rest on having been recomputed and read, so whether one differs or rests on an unbound input is not known here. Publish through op=publish, which recomputes them first. Nothing was written.") } };
    const roleOf = new Map(memberRoles.map((m) => [m.target, m.role]));
    const loadBearing = (members) => members.some((m) => roleOf.get(m) === "load_bearing");
    const rows = [], undisclosed = [], money = [];
    const judge = (calc, members, state, row) => {
      const needs = loadBearing(members) && (state === "differs" || state === "unbound");
      if (needs && !listed.has(calc)) undisclosed.push({ calc, members, recompute: state });
      rows.push({ calc, ...row, recompute: state,
                  disclosed: needs && listed.has(calc) ? listed.get(calc) || DISCLOSED_WITHOUT_WORDS : null });
    };
    for (const f of (facts && facts.calculations) || []) {
      const r = f.read;
      if (!r || r.ok === false || r.found === false) continue;   /* withheld whole (calculations R10): not written */
      const differs = !f.recomputed || f.recomputed.ok === false || f.recomputed.agrees !== true;
      const unbound = ((r.grade && Array.isArray(r.grade.inputs)) ? r.grade.inputs : []).some((x) => x && x.unbound === true);
      const inputs = (Array.isArray(r.inputs) ? r.inputs : []).filter((x) => x && typeof x === "object");
      for (const x of inputs) if (x.money !== undefined) money.push(...(Array.isArray(x.money) ? x.money : [x.money]));
      judge(f.calc, f.members, differs ? "differs" : unbound ? "unbound" : "agrees", {
        recipe: r.calculation ? r.calculation.recipe ?? null : null,
        /* case-grammar R18: each input's name and SHA-256 as `read` states it (calculations R9; N596): every input's
           canonical bytes, a figure, money, another calculation, a set, a draw or the threshold as well as a table, so
           publication commits them (its R22). One created before T34 states only its tables' hashes: its others are null,
           and case-grammar writes the row's inputs undetermined rather than half-stated. */
        inputs: inputsHashed(r),
        method_version: r.method_version ?? null,
        results: r.calculation ? r.calculation.results ?? null : null,
        result_key: r.result_key ?? null });
    }
    for (const f of (facts && facts.workbooks) || []) {
      const r = f.read;
      const status = r.recompute ? r.recompute.status ?? null : null;
      const differs = status === "differs" || (Array.isArray(r.bindings) ? r.bindings : []).some((b) => b && b.agrees === false);
      const unbound = (Array.isArray(r.inputs) ? r.inputs : []).some((x) => x && x.bound === false);
      judge(f.capture, f.members, differs ? "differs" : unbound ? "unbound" : status === "agrees" ? "agrees" : "not_recomputed", {
        recipe: null, inputs: [], method_version: r.recompute ? [r.recompute.engine, r.recompute.engine_version]
          .filter(Boolean).join(" ") || null : null, results: null, result_key: null });
    }
    /* DEC-49 REGION is-calculation-disclosed */
    if (undisclosed.length)
      return { refusal: actRefusal("CALCULATION_NOT_DISCLOSED", { calculations: undisclosed,
        detail: localize("case-authoring.index.listed_a_load_bearing_finding_rests", "{listed}: a load-bearing finding rests on a calculation that gives a different result when your team's Civicsmith recomputes it, or on an input typed with no source, and this act does not disclose it. List each in calculationsDisclosed, with your own words if you choose, and the published case states it. A disclosed one never blocks (DEC-76 item 4). Nothing was written.",
                         { listed: undisclosed.map((u) => `${u.calc} (${u.recompute}; ${u.members.join(", ")})`).join("; ") }) }), rows, money };
    /* END DEC-49 REGION is-calculation-disclosed */
    return { rows, money: [...new Set(money)] };
  }

  /** R55 (case-disclosures R24): the parts this act assembles that may name a person, in its shape `[{place, where,
   *  people?, event?, fact?}]` — each authored sentence and exclusion (`statement`), each member's claim (`claim`), each
   *  lens statement (`lens`), each of R57's `they_did` items (`timeline`, its event, whose participants case-disclosures
   *  reads) and each money fact the calculations cite (`money`) — and the people it answers they name (each finding's
   *  subject it reads itself). A sentence names a person by an entity id it holds. Asked by `op=publish` and by R34's
   *  pre-flight alike. */
  #namedInCase(prepared, proj, viewer, authored, moneyFacts) {
    const timeline = this.#timelineOf(prepared, viewer);
    const lens = this.#lensStatements(proj);
    const idsIn = (...texts) => [...new Set(texts.flatMap((t) => String(t ?? "").split(/[^A-Za-z0-9-]+/))
      .filter((t) => ENTITY_ID.test(t)))];
    const parts = [];
    const add = (place, where, people) => { if (people.length) parts.push({ place, where, people }); };
    add("statement", "statement", idsIn(authored.statement));
    add("statement", "scope", idsIn(authored.scope));
    add("statement", "subject_justification", idsIn(authored.justification));
    add("statement", "bias_acknowledgement", idsIn(authored.bias));
    (Array.isArray(authored.excluded) ? authored.excluded : []).forEach((r, i) =>
      add("statement", `excluded[${i}]`, idsIn(r && r.target, r && r.description, r && r.reason)));
    /* R63 (D56): each sentence of the account names a person as any authored sentence does */
    (Array.isArray(authored.account) ? authored.account : []).forEach((r, i) =>
      add("statement", `account[${i}]`, idsIn(r && r.text)));
    for (const p of prepared) add("claim", p.id, idsIn(p.conclusion && p.conclusion.claim ? p.conclusion.claim.text : null));
    for (const st of lens.statements) add("lens", st.id ?? st.bundle ?? null, idsIn(st.subject, st.text, st.justification));
    for (const r of timeline.rows) if (r.lane === "they_did") parts.push({ place: "timeline", where: `timeline ${r.ord}`, event: r.ref });
    for (const f of moneyFacts) parts.push({ place: "money", where: f, fact: f });
    const named = this.disclosures.peopleNamed(prepared, parts, viewer);
    return { timeline, lens, named };
  }

  /** R57 (C11; K1494): the timeline of the members' subject entities (`inquiry.subjectEntityOf`) and the events their
   *  legs cite, read through `events.timeline` (its R28–R30) as the publisher sees the record at the act: the world's
   *  lane (`they_did`) and the registered sources' lane (`we_did`) apart, each in its own order, each item with its
   *  source; an item with no source is left out and counted. No row names a person: an event's participants are read by
   *  `case-disclosures` (its R24), and named only as its R25 passes them (R55). */
  #timelineOf(prepared, viewer) {
    const set = [];
    for (const p of prepared) {
      const subject = this.inquiry.subjectEntityOf(p.id);
      if (subject) set.push(subject);
      const basis = this.inquiry.basisFor(p.id);
      for (const leg of (basis && basis.ok !== false && Array.isArray(basis.legs) ? basis.legs : []))
        if (normalizeType(OBJECT_TYPES[str(leg.target_id).split("-")[0]]) === "event") set.push(str(leg.target_id));
    }
    const ids = [...new Set(set)];
    /* `cut` names each lane events answered `truncated` (its R29, R30: cut at its limit), so the document says the list
       stops there rather than reading as whole; `unread` is a read that failed, stated rather than read as empty. */
    /* R57 (T45; N855 (6a); Actions D4, D6a, D22; v0.2 rules 15, 17): `withheld` counts the `we_did` items a source did
       not mark `public: true`, left out of the published record of actions and never written (the fail-closed guard;
       what is left out of it is the producers' to decide, never a filter here). */
    const out = { set: ids, rows: [], left_out: 0, withheld: 0, cut: [], unread: null };
    if (!ids.length) return out;
    /* R57 (T45): the published record of actions is asked for the public (events R28, R30). */
    const read = this.events.timeline({ set: ids, viewer, audience: "public" });
    if (!read || read.ok === false) return { ...out, unread: read ? read.reason ?? "TIMELINE_UNREAD" : "TIMELINE_UNREAD" };
    if (read.world && read.world.truncated === true) out.cut.push("they_did");
    for (const src of (read.ours && read.ours.sources) || []) if (src && src.truncated === true) out.cut.push(`we_did:${src.source}`);
    let ord = 0;
    for (const it of [...((read.world && read.world.items) || []), ...((read.world && read.world.placed_nowhere) || [])]) {
      const ev = this.events.readEvent({ eventId: it.event_id, viewer });
      const e = ev && ev.ok !== false && ev.found ? ev.event : null;
      const atts = e && Array.isArray(e.attestations) ? e.attestations : [];
      const att = atts.find((x) => x.attestation_id === e.governing) || atts.find((x) => x.capture_sha) || atts[0] || null;
      const source = att ? att.capture_sha || `event_attestation:${att.attestation_id}` : null;
      if (!source) { out.left_out += 1; continue; }
      out.rows.push({ lane: "they_did", ord: ++ord, when: whenWords(it.when, it.why), label: [it.kind, it.status]
        .filter(Boolean).join(", "), ref: it.event_id, source });
    }
    ord = 0;
    for (const src of (read.ours && read.ours.sources) || []) {
      if (src.error) { out.left_out += 1; continue; }
      for (const it of src.items || []) {
        if (!it || it.public !== true) { out.withheld += 1; continue; }
        if (!str(it.ref)) { out.left_out += 1; continue; }
        out.rows.push({ lane: "we_did", ord: ++ord, when: it.placed_nowhere || !it.at ? "nowhere" : String(it.at),
                        label: it.label ?? it.kind ?? null, ref: str(it.ref), source: `${src.source}:${str(it.ref)}` });
      }
    }
    return out;
  }

  /* `run` is the pre-flight's (R34): `preflight` skips reevaluation's raise, whose listeners are told synchronously and
     must not hear of an edition a rolled-back run never made, and `seen` receives what the act read, for its steps. */
  #publishCase({ target = null, targets = null, caseId = null, newCase = false, scope = "",
                 statement = "", excluded = null, subjectPosition = "",
                 subjectJustification = "", biasAcknowledgement = "",
                 project = null, roles = null, draft = null, tensionsDisclosed = null, selfAttested = null,
                 flagsDisclosed = null, calculationsDisclosed = null, peopleBases = null, tieAttested = null,
                 whatChanged = undefined, account = null, accountDraft = null, statementCites = null,
                 reviewComments = null, viewer = null, author = null, ...unknown } = {}, run = {}) {
    const seen = run.seen || {};
    const who = str(author);
    /* DEC-49 REGION is-machine-publish — R1 / C-32.6. The fence alone, before anything else is read. */
    if (!who || isMachineIdentity(who))
      return actRefusal("MACHINE_CANNOT_PUBLISH", {
        detail: localize("case-authoring.index.publishing_puts_the_teams_name", "publishing puts the team's name on a case. A machine credential may prepare one and may never author the completeness assertion or the position on putting it to its subject, both of which are declared bias. Sign in as a member.") });
    /* END DEC-49 REGION is-machine-publish */

    /* R2: the authority fences, beside the machine fence (`#authority`). */
    const auth = this.#authority(project, viewer, who);
    if (auth.ok === false) return auth;
    const { proj, gate } = auth;

    /* R3 — REC-44: THE SET. `targets` is the shape; `target` is the one-finding degenerate case (DEC-44 determination
       5), normalised here so nothing below has two arities. A comma-separated string is accepted because a query
       parameter has no arrays. */
    const set = Array.isArray(targets) ? targets
              : typeof targets === "string" && targets.trim() ? targets.split(",")
              : target ? [target] : [];
    const members = set.map((s) => str(s)).filter(Boolean);
    if (!members.length)
      return { ok: false, reason: "PUBLISH_NO_FINDING", code: "PUBLISH_NO_FINDING",
               detail: localize("case-authoring.index.a_published_case_is_a_container", "a published case is a CONTAINER over ONE OR MORE FINDINGS, scoped to the question that brought them together: pass targets=[<inquiry id>, ...]. One finding is legal and is the degenerate case (DEC-44); what is not legal is publishing nothing.") };
    {
      const seen = new Set();
      for (const m of members) {
        if (seen.has(m))
          return { ok: false, reason: "DUPLICATE_MEMBER", target: m,
                   detail: localize("case-authoring.index.m_appears_twice_in_this", "{m} appears twice in this case. A finding is in a case once — listing it twice would give the container two copies of one document and the ordinal no meaning.", { m: String(m) }) };
        seen.add(m);
      }
    }

    const stmt = str(statement);
    const just = str(subjectJustification);
    const pos = str(subjectPosition);
    /* DEC-44 determination 2: the SCOPE is authored, never derived from the findings' titles. Completeness says what
       the case left OUT; scope says what it is ABOUT. */
    const scp = str(scope);
    /* REC-47 / DEC-46 (a): the bias acknowledgement is authored and disclosed, never a bar (DEC-20). */
    const back = str(biasAcknowledgement);
    /* DEC-49 REGION is-publish-statement — R3 / REC-64 / C-33.14. */
    if (!stmt)
      return actRefusal("NO_STATEMENT", {
        detail: localize("case-authoring.index.a_published_case_states_what", "a published case states what it does NOT cover. A case silent about its own limits is claiming to cover everything, which is the overclaim this record exists to refuse.") });
    /* END DEC-49 REGION is-publish-statement */
    if (!SUBJECT_POSITIONS.includes(pos))
      return { ok: false, reason: "NO_SUBJECT_POSITION", allowed: SUBJECT_POSITIONS,
               detail: localize("case-authoring.index.declare_the_teams_position_on", "declare the team's position on putting this case to its subject. The gate is that the position is DECLARED — never that contact happened, and never that the answer was favourable (DEC-13). Deciding not to give notice is a legitimate position and is declared like any other.") };
    if (!just)
      return { ok: false, reason: "NO_SUBJECT_JUSTIFICATION",
               detail: localize("case-authoring.index.a_declared_position_with_no", "a declared position with no reasoning behind it is the checkbox this gate exists to refuse. Say why — including why the team chose not to give notice — and a reader weighs it exactly as they weigh any other declared bias.") };
    if (!Array.isArray(excluded))
      return { ok: false, reason: "NO_EXCLUSION_FIELD",
               detail: localize("case-authoring.index.pass_excluded_an_empty_list", "pass excluded[]. An EMPTY list is a claim — this case left nothing material out — and is legal; an ABSENT field is silence, and silence about what a case excludes is what the completeness assertion exists to refuse.") };
    /* The later items' refusals go LAST, so an existing caller's diagnosis does not change under them. */
    if (!scp)
      return { ok: false, reason: "NO_SCOPE",
               detail: localize("case-authoring.index.a_published_case_states_its", "a published case states its own SCOPE — what brought these findings together and what question the case as a whole answers. It is authored by the team and never derived from the findings' titles: a scope your team's Civicsmith wrote is not a scope the team made (DEC-44). Completeness says what the case left OUT; scope says what it is ABOUT.") };
    if (!back)
      return { ok: false, reason: "NO_BIAS_ACKNOWLEDGEMENT",
               detail: localize("case-authoring.index.a_published_case_carries_the", "a published case carries the bias it was produced under, as a fact the reader weighs. Acknowledge it here, in the ceremony, fresh for this edition — a pre-flight checkbox would be the checkbox this gate exists to refuse (DEC-46). This is a DISCLOSURE and never a bar: declaring a bias does not stop a case being published, and nothing here reads WHICH bias you name (DEC-20). The only bias that disqualifies is an uncleared HUNCH, and that is refused by name before any signature exists.") };
    const rows = [];
    for (let i = 0; i < excluded.length; i++) {
      const r = excluded[i];
      if (!r || typeof r !== "object")
        return { ok: false, reason: "BAD_EXCLUSION", ord: i, detail: localize("case-authoring.index.excluded_i_is_not_an", "excluded[{i}] is not an object", { i: String(i) }) };
      const tgt = typeof r.target === "string" && r.target.trim() !== "" ? r.target.trim() : null;
      const desc = str(r.description);
      const why = str(r.reason);
      /* C-9: target OR prose, NEVER NEITHER. A row may name something not in the record (an outstanding records
         request has no id), so a required target would force the member to invent a referent. */
      if (!tgt && !desc)
        return { ok: false, reason: "BAD_EXCLUSION", ord: i,
                 detail: localize("case-authoring.index.excluded_i_names_neither_a", "excluded[{i}] names neither a target nor a description. Every exclusion row carries a target id OR prose, never neither — otherwise the row asserts nothing and the index cannot answer \"which published cases excluded this document\".", { i: String(i) }) };
      if (!why)
        return { ok: false, reason: "BAD_EXCLUSION", ord: i,
                 detail: localize("case-authoring.index.excluded_i_carries_no_reason", "excluded[{i}] carries no reason. WHAT was left out and WHY are two statements and one does not stand in for the other.", { i: String(i) }) };
      rows.push({ target: tgt, description: desc, reason: why });
    }
    /* The restricted frontmatter grammar has no escapes, so a quote, a backslash or a line break in an authored field
       would produce a document the parser cannot read back: refused by name rather than silently mangled. */
    for (const [name, v] of [["statement", stmt], ["subject_justification", just], ["scope", scp],
                             ["bias_acknowledgement", back],
                             ...rows.flatMap((r, i) => [[`excluded[${i}].description`, r.description],
                                                        [`excluded[${i}].reason`, r.reason]])]) {
      if (v.length > COMPLETENESS_MAX || /["\\\r\n]/.test(v))
        return { ok: false, reason: "BAD_COMPLETENESS", field: name,
                 detail: localize("case-authoring.index.name_is_at_most_completeness", "{name} is at most {COMPLETENESS_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { name: String(name), COMPLETENESS_MAX: String(COMPLETENESS_MAX) }) };
    }
    /* R65 (D57, D63): THE AUTHORED FIELDS ARE EXACTLY THE FOUR STATEMENTS, THE SCOPE, THE BIAS ACKNOWLEDGEMENT AND THE
       ACCOUNT. A case states what its findings rest on and what it leaves out; a story, context or human-interest
       passage has no field, and a field this act does not know is refused by name rather than dropped, so nothing a
       caller sends is silently read as prose the case does not print. Asked last of R3's refusals. */
    const notAllowed = Object.keys(unknown).filter((k) => unknown[k] !== undefined).sort();
    if (notAllowed.length)
      return { ok: false, reason: "CASE_FIELD_NOT_ALLOWED", fields: notAllowed,
               detail: localize("case-authoring.index.notallowed_a_case_carries_no", "{notAllowed}: a case carries no field of that name. What a publisher authors is exactly the four statements (statement, subjectJustification, excluded with its reasons, whatChanged), the scope, the bias acknowledgement and the account, each sentence of which rests on what it cites (D57, D63). A story, context or human-interest passage has no place in a case. Nothing was written.", { notAllowed: String(notAllowed.join(", ")) }) };
    /* R63, R69 (D56): the account's shape, and the statements' citations (K2533), each refused by name before anything is
       read: `case-account` R5, asked last among R3's refusals, after R65. */
    const A = this.account;
    const shaped = A.accountShaped(account, statementCites, rows.length);
    if (shaped.ok === false) return shaped;

    /* R4: every member judged before any member moves (`#judgeMembers`). */
    const judged = this.#judgeMembers(members, proj, viewer, gate);
    if (judged.ok === false) return judged;
    const { prepared } = judged;

    /* R72 (T45; N892; Actions D4; v0.2 rule 15): NOTHING OF A COUNSEL MATTER IS PREPARED FOR PUBLICATION, asked after R2's
       and R4's refusals and before anything is written or an id is drawn (`#counselMatters`). */
    const counsel = this.#counselMatters(proj, prepared);
    if (counsel) return counsel;

    /* R5: the authored load-bearing partition (`#rolesOf`). */
    const partition = this.#rolesOf(prepared, roles, members);
    if (partition.ok === false) return partition;
    const { memberRoles, loadBearing } = partition;

    /* R6: the project's bar, read once, asked of each load-bearing member (`#barJudged`); the first shortfall refuses. */
    const barJudged = this.#barJudged(proj, loadBearing);
    if (barJudged.shortfalls.length) return barJudged.shortfalls[0];
    const bar = barJudged.bar;
    /* AND NOTHING IS ASKED OF THE SUPPORTING MEMBERS (Bob, on DEC-71: "The citation doesn't have to be severed"). */

    /* R55 (N529): WHAT THE CASE DISCLOSES, asked of `case-disclosures` after R6 and before the case identity is derived,
       in this order, each answering its first refusal, so a refusal draws no id and writes nothing. Nothing here
       refuses because a contradiction, an uncertified document, off-the-record material or an open flag exists. */
    const D = this.disclosures;
    const disclosed = (() => {
      /* hunch debt (its R16), asked of every member */
      const hunch = D.hunchDebt(prepared);
      if (hunch) return { refusal: hunch };
      /* the conflicts to disclose (its R1), each member at the bytes R13 pins */
      const tensionsJ = D.tensionsJudged(prepared, viewer, tensionsDisclosed);
      if (tensionsJ.refusals.length) return { refusal: tensionsJ.refusals[0] };
      /* each document's grade and co-attestation, and the owner's acknowledgement of a self-attested one (its R2) */
      const resting = D.restingCaptures(prepared);
      const facts = new Map([...new Set(resting.map((r) => r.capture))].map((sha) => [sha, D.captureFacts(sha)]));
      const selfJ = D.selfAttestedJudged(resting, facts, memberRoles, selfAttested);
      if (selfJ.refusals.length) return { refusal: selfJ.refusals[0] };
      /* what each member's chain reaches, and whether a load-bearing one rests on material not held whole (its R6) */
      const reached = D.materialsJudged(prepared, memberRoles, viewer);
      if (reached.refusals.length) return { refusal: reached.refusals[0] };
      /* another group's work the chains reach, its acceptance in force (its R13), then its open flags (its R14) */
      const accepted = D.acceptedWorkJudged(reached.refs, viewer);
      if (accepted.refusals.length) return { refusal: accepted.refusals[0] };
      const flagsJ = D.flagsJudged(accepted.editions, flagsDisclosed);
      if (flagsJ.refusals.length) return { refusal: flagsJ.refusals[0] };
      /* R56: each calculation and workbook a chain reaches, as the gather recomputed and read it before the act */
      const calcJ = this.#calculationsJudged(prepared, memberRoles, calculationsDisclosed, run.calculationFacts ?? null);
      if (calcJ.refusal) return { refusal: calcJ.refusal };
      /* R57's timeline, composed here so its participants are among the people the case names; the people the case
         names, over the parts this act assembles, and the basis the owner gives each (its R24, R25) */
      const { timeline, lens, named } = this.#namedInCase(prepared, proj, viewer,
        { statement: stmt, scope: scp, justification: just, bias: back, excluded: rows, account: shaped.sentences }, calcJ.money);
      const peopleJ = D.peopleJudged(named, peopleBases, viewer);
      if (peopleJ.refusals.length) return { refusal: peopleJ.refusals[0] };
      /* each signer's attestation of no undeclared tie, the money's payers and payees included (its R27) */
      const tiesJ = D.tieAttestationJudged([who], named, named.money_parties || [], attestedBy(who, tieAttested, this.#when("second")),
                                           viewer);
      if (tiesJ.refusals.length) return { refusal: tiesJ.refusals[0] };
      return { tensionsJ, resting, facts, selfJ, reached, accepted, flagsJ, calcJ, timeline, lens, peopleJ, tiesJ };
    })();
    if (disclosed.refusal) return disclosed.refusal;
    const { tensionsJ, resting, facts, selfJ, reached, accepted, flagsJ, calcJ, timeline, lens: lensRead, peopleJ, tiesJ }
      = disclosed;
    const read = { entries: tensionsJ.entries, unread: tensionsJ.unread };
    const listed = { byCandidate: tensionsJ.byCandidate };

    /* R7 — REC-44: THE CASE IDENTITY, DECIDED FROM THE RECORD. Name one, derive one from what the members already serve,
       or mint one; a caller never mints an identity. D-309 / DEC-72 clause 6: a finding may serve many cases, so the
       derivation is over ALL cases per member (publication R40: `published_case_members`). */
    const belongs = new Map();
    for (const id of members) {
      const rs = this.#rows(
        `SELECT DISTINCT case_id FROM published_case_members WHERE bundle_id=? ORDER BY case_id`, id);
      if (rs.length) belongs.set(id, rs.map((r) => r.case_id));
    }
    const distinct = [...new Set([...belongs.values()].flat())];
    /* THE CASE THIS ACT'S OWN UNSIGNED PREPARATION NAMES (R7's third route), consulted after the published record and
       only so a publisher who prepares again lands on the same case rather than on a second minted id. Since D-442 a
       member's bytes name no case, so the preparation is read where it lives: the unsigned case document pinning the
       member at its current bytes (publication R4's `prepared`). */
    const preparedCases = [...new Set(prepared.map((p) => p.preparedIn).filter(Boolean))];
    /* DEC-49 REGION case-identity-derivation — C-44.1. The line is drawn at MORE THAN ONE CANDIDATE: with none the act
       mints, with one the derivation reads a fact, `caseId` answers the question one way and `newCase` the other.
       With two there is no default that is anybody's meaning, and that is what this refuses. */
    if (newCase && str(caseId))
      return derivationRefusal("CASE_IDENTITY_AMBIGUOUS", {
        cases: [str(caseId)],
        members: [...belongs].map(([id, cs]) => ({ target: id, cases: cs })),
        detail: localize("case-authoring.index.this_act_both_names_case", "this act both NAMES case {str} and asks for a new case to be minted. Those are opposite instructions and the record will not choose between them: name the case to publish a further edition of it, or ask for a new one, not both.", { str: String(str(caseId)) }) });
    if (!newCase && !str(caseId) && distinct.length > 1)
      return derivationRefusal("CASE_IDENTITY_AMBIGUOUS", {
        cases: distinct.slice().sort(),
        members: [...belongs].map(([id, cs]) => ({ target: id, cases: cs })),
        detail: localize("case-authoring.index.these_findings_already_serve_length", "these findings already serve {length} published cases ({sort}), and this act did not say which case it is publishing. A finding can serve many cases (DEC-72 clause 6), so membership no longer says which case this is: name the case to publish a further edition of it, or say so and a new case is minted. The record will not choose for you.", { length: String(distinct.length), sort: String(distinct.slice().sort().join(", ")) }) });
    /* END DEC-49 REGION case-identity-derivation */
    /* `newCase` short-circuits both derivation routes, the prepared-bytes claim included, and mints. */
    let theCase = newCase ? null
                : str(caseId) || distinct[0]
                || (preparedCases.length === 1 ? preparedCases[0] : null) || null;
    if (caseId && !this.#one(`SELECT case_id FROM published_cases WHERE case_id=? LIMIT 1`, theCase))
      return { ok: false, reason: "NO_SUCH_CASE", caseId: theCase,
               detail: localize("case-authoring.index.no_published_case_answers_to", "no published case answers to {theCase}. A case identity is minted by this act and carried in the signed bytes; it is never taken from a caller, because an identity a caller can hand us is one a caller can invent.", { theCase: String(theCase) }) };
    /* R58 (N681, N823; DEC-147 (2), (4)): AN EDITION OF THIS CASE SIGNED AND WAITING TO BE PUBLISHED (publish-schedule
       R1) is asked of publish-schedule's one read (its R7), after R7 and before R8, before anything is written or an id is
       drawn: a new edition is prepared only once the waiting one is published, stopped or cancelled (its R2, R3), so
       this act never prepares an edition over, or beside, one a signature already covers. A minted case has none. A
       case of another project is not answered here: R7's CASE_BELONGS_TO_ANOTHER_PROJECT refuses it below, and
       nothing of another project's waiting edition is named to this one (R33). */
    if (theCase) {
      const waiting = this.publishSchedule.waitingEditionOf(theCase);
      const owner = waiting ? (this.#one(`SELECT project_id FROM cases WHERE case_id=?`, theCase)?.project_id
                               ?? this.#documentProject(theCase, waiting.edition)) : null;
      /* DEC-49 REGION is-case-edition-waiting */
      if (waiting && (!owner || owner === proj))
        return derivationRefusal("CASE_EDITION_WAITING", {
          caseId: theCase, edition: Number(waiting.edition), at: waiting.at ?? null, publish_at: waiting.publish_at ?? null,
          detail: localize("case-authoring.index.edition_edition_of_thecase_is", "edition {edition} of {theCase} is signed and waiting to be published{v1}. The next edition is prepared once it is published, stopped at its time, or cancelled (op=publishatcancel). Nothing was prepared.", { edition: String(waiting.edition), theCase: String(theCase), v1: String(waiting.at && waiting.at.date ? localize("case-authoring.index.on_date_at_time", " on {date} at {time}", { date: String(waiting.at.date), time: String(waiting.at.time) })
                                                   + (waiting.at.zone ? ` (${waiting.at.zone})` : "") : "") }) });
      /* END DEC-49 REGION is-case-edition-waiting */
    }
    /* R8 — D-442: ALREADY_A_CASE_MEMBER IS ASKED OF THE CASE THIS ACT PUBLISHES, AND OF NO OTHER. The same bytes may be
       pinned by several cases (rule 12), and an edition of case X recording this conclusion says nothing about case Y.
       An unsigned preparation of another case, or of another edition of this one, still refuses. Asked before an id is
       minted. */
    /* (K2540) An unsigned preparation of THIS case edition does not refuse: the new preparation replaces it (R14,
       publication R21), which is how later approvals (R68) and a first edition's account from a draft (`case-account`
       R4) are carried. One of another case, or of another edition of this one, still does. */
    const thisEdition = theCase ? this.#highestEdition(theCase) + 1 : null;
    const replaced = (e) => e.state === "prepared" && theCase && e.case_id === theCase && Number(e.edition) === thisEdition;
    for (const p of prepared) {
      const same = p.warrant ? p.warrant.same.filter((e) =>
        ((theCase && e.case_id === theCase) || e.state === "prepared") && !replaced(e)) : [];
      if (same.length)
        return { ok: false, reason: "ALREADY_A_CASE_MEMBER", target: p.id, from: p.b.current_state,
                 project: proj, relationship: p.conclusion.relationship,
                 recorded_by: same.map((e) => ({ case_id: e.case_id, edition: e.edition, state: e.state })),
                 detail: localize("case-authoring.index.this_finding_is_already_a", "this finding is already a member of a published case at the version it stands at now, and that edition already records the conclusion this act would record (the publishing project's relationship, its reading and its claim — INVESTIGATIVE-SESSION.md §7.1 item 9), so there is nothing here a new edition would say differently. An EDITION IS A SEPARATE DOCUMENT (DEC-12): it carries its own conclusion, its own falsifier and its own freshly authored completeness, and minting one that says what an edition already says would make the edition number a count of publish calls rather than a record of what changed. Two routes lead to a new edition, and each leaves a reader able to see what moved: the project withdraws its conclusion and concludes again (op=withdrawconclusion, then op=conclude&project=), or the finding is reopened (op=reopen), worked, concluded again and published — the route DEC-12 built.") };
    }
    /* R9 — REC-217 / §3 rule 13 (BOB #33): THE DRAFT THIS ACT PUBLISHES, NAMED BY THE PUBLISHER. The link is an act,
       recorded with its author and time on the case document row and in words, so the owner who signs signs a stated
       link. Three refusals, each for a link that would be false, asked before an id is minted. The draft door is the
       review provider's (publication R23); with none, every `draft=` is C-44.3. */
    const draftNamed = str(draft) || null;
    let boundDraft = null;
    let namedDraftRow = null;
    if (draftNamed) {
      const review = this.#review();
      const d = review.draftForMember(draftNamed, viewer);
      const predicted = theCase ? this.#highestEdition(theCase) + 1 : 1;
      /* DEC-49 REGION is-publish-draft-found */
      if (!d || d.project_id !== proj)
        return derivationRefusal("PUBLISH_DRAFT_NOT_FOUND", { draft: draftNamed, project: proj,
          detail: localize("case-authoring.index.no_draft_of_proj_that", "no draft of {proj} that you can read answers to {draftNamed}. A draft you cannot read is answered exactly as one that does not exist. Name the draft this case was prepared in, or publish without draft= and its readings are stated as undetermined.", { proj: String(proj), draftNamed: String(draftNamed) }) });
      /* END DEC-49 REGION is-publish-draft-found */
      const di = review.draftIdentity(d);
      /* DEC-49 REGION is-publish-draft-this-case */
      if (di.caseId ? (di.caseId !== theCase || di.edition !== predicted) : predicted !== 1)
        return derivationRefusal("PUBLISH_DRAFT_NOT_THIS_CASE", { draft: draftNamed,
          draft_case: di.caseId ?? null, draft_edition: di.edition,
          case_id: theCase ?? null, edition: predicted,
          detail: localize("case-authoring.index.draft_draftnamed_is_prepared_for", "draft {draftNamed} is prepared for {caseIdentitySentence}, and this act publishes {v1}. Naming it would bind its readings to a case they were not given for. Publish the case the draft names {v2}, or name the draft of this one.", { draftNamed: String(draftNamed), caseIdentitySentence: String(review.caseIdentitySentence(di.caseId, di.edition)), v1: String(theCase ? localize("case-authoring.index.edition_predicted_of_thecase", "edition {predicted} of {theCase}", { predicted: String(predicted), theCase: String(theCase) }) : localize("case-authoring.index.a_new_case", "a new case")), v2: String(di.caseId ? `(case=${di.caseId})` : `(newCase=true)`) }) });
      /* END DEC-49 REGION is-publish-draft-this-case */
      /* publication R40's read contract: one draft, one case edition it produced. */
      const already = this.#one(`SELECT case_id, edition FROM case_documents WHERE draft_id=?
                                   AND NOT (case_id IS ? AND edition=?) LIMIT 1`, d.draft_id, theCase ?? null, predicted);
      /* DEC-49 REGION is-publish-draft-bound */
      if (already)
        return derivationRefusal("PUBLISH_DRAFT_ALREADY_BOUND", { draft: draftNamed,
          bound_to: { case_id: already.case_id, edition: Number(already.edition) },
          detail: localize("case-authoring.index.draft_draftnamed_was_already_named", "draft {draftNamed} was already named as the draft of edition {edition} of {case_id}, and its readings bound to that case at that act. One draft produces one case: binding its readings to a second would list the same readers under two productions.", { draftNamed: String(draftNamed), edition: String(already.edition), case_id: String(already.case_id) }) });
      /* END DEC-49 REGION is-publish-draft-bound */
      boundDraft = d.draft_id;
      namedDraftRow = d;
    }
    const minted = !theCase;
    /* REC-151: a NEW case's id is OPAQUE (record-core R6), unique against every table a case id lives in (publication
       R40) and against the minter's own ledger. Drawn inside this act's transaction, so a later refusal takes it back. */
    if (minted) {
      theCase = this.record.mintOpaqueId("CASE", this.#when("second").slice(0, 4), "", (id) =>
        !!(this.#one(`SELECT 1 FROM cases WHERE case_id=?`, id)
          || this.#one(`SELECT 1 FROM published_cases WHERE case_id=? LIMIT 1`, id)
          || this.#one(`SELECT 1 FROM case_documents WHERE case_id=? LIMIT 1`, id)
          || this.#one(`SELECT 1 FROM published_case_members WHERE case_id=? LIMIT 1`, id)));
      /* N322: no free id is record-core's one answer (its R62, C-59.6), never worded here. */
      if (!theCase) return mintExhausted("CASE");
    }

    /* R7 — CASE-2 / DEC-72: A CASE NEVER CHANGES PROJECT. The bar is read from the publishing project at act time, so a
       case that could change hands is a case whose standard of evidence changes with nobody authoring the change. The
       ratified row is asked first (publication R40: `cases`), then the case's own unsigned preparation, whose
       `case_project` is the project that prepared it. */
    const ownedBy = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, theCase);
    const claimedProject = ownedBy ? ownedBy.project_id : this.#preparedProject(theCase);
    if (claimedProject && claimedProject !== proj)
      return { ok: false, reason: "CASE_BELONGS_TO_ANOTHER_PROJECT", caseId: theCase,
               project: proj, owner: claimedProject, ratified: !!ownedBy,
               detail: localize("case-authoring.index.case_thecase_is_claimedproject_s", "case {theCase} is {claimedProject}'s production, and a case does not change hands between editions (DEC-72). The bar a case is held to is read from its publishing project at the moment of publication, so letting edition 2 name a different project would change this case's standard of evidence with nobody authoring the change. Publish the new edition as {claimedProject_2}, or publish this material as a new case.", { theCase: String(theCase), claimedProject: String(claimedProject), claimedProject_2: String(claimedProject) }) };

    /* R13 — DEC-12 as DEC-44 rehomes it: the CASE's edition is its highest published edition plus one; each member's
       own edition is its own (CASE-5: the next on its own published chain, unless R13's crossed arm below). */
    const edition = this.#highestEdition(theCase) + 1;
    /* R74 (T45; T47; N855 (6c); Actions D5, D6c): every pending, unwithdrawn outcome carried for this case (`case-inputs`
       R9's `pendingOutcomes`, asked once), in the order carried,
       for an edition above its highest ratified one (a minted case has none). */
    const outcomes = minted ? [] : this.inputs.pendingOutcomes(theCase);
    /* R34 (T45; N880; `case-inputs` R8): the case R7 resolved and the members at the bytes R13 pins, for the sign step's open requests
       (read by the pre-flight only; nothing of them enters the document). */
    seen.openRequestsAt = { case: theCase, members: prepared.map((p) => ({ bundle_id: p.id, version_sha: p.bundleSha })) };
    /* R38 (DEC-101 (1)(2)): an edition above 1 says what changed in it and why, judged once the edition is known and
       before anything is written (`#whatChangedJudged`). A first edition carries none. */
    const changed = edition > 1 ? this.#whatChangedJudged(whatChanged, theCase, edition) : null;
    if (changed && changed.ok === false) return changed;
    const memberEditions = new Map();
    for (const id of members) {
      const mt = this.#one(`SELECT MAX(edition) AS m FROM published_bundles WHERE bundle_id=?`, id);
      memberEditions.set(id, (mt && mt.m != null ? Number(mt.m) : 0) + 1);
    }

    /* R10 — C-21.1 AT CASE ALTITUDE, before anything moves: against the previous RATIFIED edition of THIS case, compared
       through ratification's one shape (`completenessFields`). The scope is not compared. Two refusal names, because a
       reprinted statement and a reprinted acknowledgement of bias are two different mistakes; the check is C-21.1.
       Each code is the literal at its own return (N242), never looked up. */
    const priorCase = this.#one(
      `SELECT edition, completeness, bias_acknowledgement FROM published_cases
       WHERE case_id=? AND edition<? AND ratified_at IS NOT NULL ORDER BY edition DESC LIMIT 1`,
      theCase, edition);
    const priorCompleteness = priorCase && priorCase.completeness ? JSON.parse(priorCase.completeness) : null;
    if (priorCompleteness) {
      const now = { ...completenessFields({ completeness: { statement: stmt, subject_justification: just },
                                            completeness_excluded: rows }),
                    bias_acknowledgement: back };
      const was = { ...priorCompleteness, bias_acknowledgement: priorCase.bias_acknowledgement ?? null };
      const LABEL = { statement: "statement", subject_justification: word("case-authoring.label.subject_position_justification"),
                      excluded: word("case-authoring.label.exclusion_list") };
      const carried = (k) => now[k] != null && was[k] != null && now[k] === was[k];
      for (const k of Object.keys(LABEL))
        if (carried(k))
          return { ok: false, reason: "COMPLETENESS_CARRIED_FORWARD", field: k, edition,
                   check: "C-21.1", caseId: theCase, prior: priorCase.edition,
                   detail: localize("case-authoring.index.v1_is_byte_identical_to", "{v1} is byte-identical to edition {edition}'s. A completeness claim carried forward unchanged is a checkbox, and C-21.1 exists to refuse it: every edition is a separate document and states its own limits in its own words, as of its own date. If nothing about the limits changed, say THAT, as of this edition.", { v1: String(LABEL[k]), edition: String(priorCase.edition) }) };
      if (carried("bias_acknowledgement"))
        return { ok: false, reason: "BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", field: "bias_acknowledgement", edition,
                 check: "C-21.1", caseId: theCase, prior: priorCase.edition,
                 detail: localize("case-authoring.index.the_bias_acknowledgement_is_byte", "the bias acknowledgement is byte-identical to edition {edition}'s. An acknowledgement of the bias a case was produced under is AUTHORED at the moment of export and never carried forward (DEC-46): reprinting the last edition's sentence is evidence nobody looked. The lens itself may well be unchanged — what must be fresh is what it means for THIS edition's findings. Say that, as of this edition. Declaring a bias never blocks publication (DEC-20).", { edition: String(priorCase.edition) }) };
    }

    /* R69 (D56; record-grammar R52): after R10, THE DRAFT THE ACCOUNT BEGAN AS, named by the member, and how she took it
       up (`case-account` R4). Her account is hers: adopting the system's words unchanged would make her vouch for a
       statement she did not write, so `as_proposed` is refused ACCEPT_MUST_REAUTHOR, record-grammar's one row. */
    const drafted = A.accountDraftJudged(accountDraft, theCase, shaped.sentences);
    if (drafted.ok === false) return drafted;
    /* R63, R69 (D56–D58, D63): EVERY SENTENCE OF THE ACCOUNT AND OF THE FOUR STATEMENTS, JUDGED AGAINST WHAT IT CITES
       (`case-account` R6, through `case-disclosures` R30), after R55's judgments and before R11, its first refusal
       answered; nothing is written. */
    const accountJ = A.accountJudged({ sentences: shaped.sentences, statementCites: shaped.statementCites, drafted,
      statement: stmt, justification: just, excluded: rows, changed,
      /* R74 (T45; D6c, D63): each pending outcome's text, judged as a statement is (`kind: outcome`, case-account R6) */
      outcomes: outcomes.map(({ outcome, text, cites }) => ({ outcome, text, cites })),
      prepared, reached, lens: lensRead, caseId: theCase, viewer });
    seen.account = accountJ;
    seen.accountDraft = drafted;
    if (accountJ.refusal) return accountJ.refusal;
    /* R69 (D61): THE REVIEWERS' COMMENTS THE PUBLISHER CHOSE (`case-account` R7), read through the one registered reader
       (review R33); an objection travels only when chosen, and the count left out is stated. */
    const comments = A.reviewCommentsChosen(reviewComments, theCase, edition, viewer, boundDraft);
    if (comments.ok === false) return comments;

    const when = this.#when("second");
    const written = [];
    /* R13, R23 — D-442 / rule 12: PUBLISHING WRITES NOTHING ON A MEMBER FINDING. The pin is the `bundle_sha` each
       member has AS PREPARED; everything the old promotion wrote into a member is stated once, in the case document.
       A member's own edition is the published edition of that sha when another case already carried it across (one
       document, one number), else the next on its own chain. */
    const frozen = new Map();
    for (const p of prepared) {
      const { id: memberId, b, fm } = p;
      /* R24 / DEC-21: both axis objects, derived and frozen, per finding; never composed. MK-2: `testimony` is frozen
         only when it carries something (graded, or undetermined). */
      const pair = this.strength.strengthOf(memberId);
      const frozenAxes = STRENGTH_AXES.filter((axis) =>
        axis !== "testimony" || (pair[axis] && pair[axis].state !== "unrated"));
      const frozenGrounds = frozenAxes.flatMap((axis) => (pair[axis].grounds ?? []).map((g) => [axis, g]));
      const already = this.#one(`SELECT edition FROM published_bundles WHERE bundle_id=? AND bundle_sha=?`,
                                memberId, p.bundleSha);
      const memberEdition = already ? Number(already.edition) : memberEditions.get(memberId);
      frozen.set(memberId, { edition: memberEdition, pair, axes: frozenAxes, grounds: frozenGrounds,
                             crossed: !!already });
      written.push({ target: memberId, state: b.current_state, case_id: theCase, case_edition: edition,
                     bundleSha: p.bundleSha,
                     promoted: false,
                     title: fm.title ?? null,
                     edition: memberEdition,
                     strength: frozenAxes.map((axis) => ({ axis, state: pair[axis].state,
                       grade: pair[axis].grade,
                       weakest: pair[axis].weakest ? pair[axis].weakest.target_id : null })),
                     frozen_in: "case_document",
                     required: bar,
                     role: (memberRoles.find((m) => m.target === memberId) || {}).role ?? null,
                     /* REC-157 / §7.1 item 9: why an edition was minted over bytes a case already pins. */
                     ...(p.warrant ? { edition_warranted: {
                         because: "the_publishing_projects_conclusion_moved",
                         pinned_editions: p.warrant.pinned.map((e) => ({
                           case_id: e.case_id, edition: e.edition, state: e.state, recorded: e.recorded })) } }
                       : {}),
                     /* R15 — REC-17 / DEC-12: a NEW edition of the finding above 1 surfaces the re-evaluation
                        obligation on everything whose basis names it (reevaluation R7); bytes another case already
                        carried across are the edition a leg already rests on, so nothing moved under anybody. Raised
                        below, after the act's last refusal (R61), so no listener hears of an edition never made. */
                     ...(!already && memberEdition > 1 ? { reevaluation: null } : {}) });
    }

    /* R14 — CASE-5b / DEC-72: THE CASE DOCUMENT, AUTHORED HERE, after every member's pin is known, naming the whole
       roster at its hashes in one statement. It is stored UNSIGNED (publication R21) and commits nothing: no row
       exists in `cases`, `published_cases` or `published_case_members` until `op=caseratify`. */
    const pinOf = new Map(written.map((w) => [w.target, w.bundleSha]));
    /* R11, R17 — COMPUTED HERE AND ONLY HERE: the signature covers `doc_sha`, taken over these bytes, so computing the
       section later would rewrite what the member reviewed. A section that cannot be computed honestly stops the
       ceremony rather than publishing a blank. */
    const searched = this.#searchedForCase(members, when);
    if (!searched.ok)
      return { ok: false, reason: "CASE_SEARCHED_UNCOMPUTABLE", code: "CASE_SEARCHED_UNCOMPUTABLE", case: theCase, edition,
               detail: localize("case-authoring.index.the_case_documents_searched_section", "the case document's searched section could not be computed: {why}. A case document publishes what was looked for beside what it claims to cover (D-196); it does not publish the claim with the record of the looking left blank.", { why: String(searched.why) }) };
    /* R55 (N529), after R11 and only then: what may be stated of the source of each capture a chain reaches
       (`case-disclosures` R4; reading a source mints its id, sources R1, inside this act's transaction), and which of
       them are off-the-record. */
    const documentsReached = reached.materials.filter((m) => m.kind === "document").map((m) => m.sha);
    const sourceRows = D.sourcesStated([...new Set([...facts.keys(), ...documentsReached])], viewer);
    const withheld = D.withheldOf(sourceRows);
    /* MK-7 / §4.3: each observation this edition reaches (basis-versions R39), at the level its author chose, or
       UNCHOSEN (publication R17); and, K1316, each off-the-record capture a chain reaches, at its attesting member's
       level (publication R60, `case-disclosures` R10), its row keyed by the capture: the section is written when either
       is reached. */
    const reach = this.basisVersions.testimonyReach(members);
    const observations = [...new Set([...reach.self, ...reach.via.map((v) => v.observation)])];
    const attributions = this.caseTensions.attributionStatements(theCase, edition, proj,
      [...observations, ...documentsReached.filter((sha) => withheld.has(sha))]);
    const attributionOf = new Map((Array.isArray(attributions) ? attributions : [])
      .map((r) => [r.capture ?? r.observation, r]));
    /* R55: each reached finding's grading facts and passages (`case-disclosures` R15), the method signed under (its
       R5), and the rows of the captures, materials and flags blocks (its R3, R7, R10, R14). */
    const findingFacts = D.findingFacts(reached.findings, viewer);
    const typedRows = this.#typedPassageRows(findingFacts.passages);
    const method = D.methodOf();
    const { captures: captureRows, materials: materialBlocks, flags: flagRows, group } = D.disclosureBlocks({
      resting, facts, selfAttested: selfJ, reached, flags: flagsJ, withheld, attributionOf, project: proj, author: who,
      at: when });

    /* REC-135: the conclusion each member rests on, from the SAME answer the NOT_CONCLUDED gate decided on. */
    const conclusionRows = prepared.map((p) => ({ target: p.id, ...p.conclusion }));
    /* D-84 — THE BIAS MANIFEST IN FORCE, STAMPED BY THE PLANE AND FROZEN (bias R13–R18), for the project's scope READ AS
       THE PLANE (`PLANE_VIEWER`, a machine credential: since D54 the founder's viewer is blind to a hidden project it is
       not in, K2442): the manifest is a fact about the project's scope, and a reader's sight must not turn it into
       "no manifest was in force". `limit: 1` because the stamp needs the pairs and the hash, which covers the whole set
       before any bound. */
    const lens = this.bias.biasManifest({ scope: "project", scopeId: proj, viewer: PLANE_VIEWER, limit: 1 });
    const manifest = {
      /* REC-187: `null` is the manifest's UNDETERMINED, carried as null with its own sentence (R26). */
      in_force: lens.in_force === null ? null : lens.in_force === true,
      scope: "project", scope_id: proj,
      statements_sha: lens.in_force === true ? (lens.statements_sha ?? null) : null,
      bundles: (lens.in_force === true && Array.isArray(lens.bundles) ? lens.bundles : [])
        .map((x) => ({ bundle_id: x.bundle_id, revision: x.revision, scope: x.scope })),
      lock_violations: Array.isArray(lens.lock_violations) ? lens.lock_violations.length : 0,
      stated: lens.in_force === true
        ? word("case-authoring.stated.effective_bias_set", { proj: String(proj) })
        : lens.in_force === null ? String(lens.stated) : word("bias.manifest_force"),
      /* REC-219 / §3 rule 18: every adoption whose pin is a PROPOSED revision, in all three lens states, naming the
         bundle, the revision, the scope and its own state, never who adopted it (§3 rule 7). */
      pins_proposed: (Array.isArray(lens.pins_proposed) ? lens.pins_proposed : [])
        .map((x) => ({ bundle_id: x.bundle_id, revision: x.revision, scope: x.scope,
                       pinned_state: x.pinned_state ?? null })),
    };
    /* R40 — DEC-103: the lens it was produced under, every statement of the manifest frozen above, read at this act. */
    const lensStatements = lensRead;
    /* R16 — REC-219 / D-579(a): the project's citation edges, with the version each was made against. */
    const citations = this.#caseCitations(proj, members, resting);
    /* R14 (`case-inputs` R3) — REC-212 / §3 rule 13: WHO WROTE THE SENTENCE, established before the list is read, because it decides what
       the list may contain (a reading by the writer is not a second reading). */
    const writer = this.inputs.statementWriter(proj, theCase, edition, stmt, who, namedDraftRow);
    /* R9 / REC-217: the link this act makes, when the publisher named a draft. */
    const draftLink = boundDraft ? { draft: boundDraft, by: who, at: when } : null;
    /* R14 (`case-inputs` R2, the one list) — D-150 / §3 rule 11: who acknowledged this statement, read at the act that authors the document the owner
       signs, so the list is inside the signature. None is required, and none is ever a gate. */
    const acks = this.inputs.statementAcknowledgements(proj, theCase, edition, stmt, who, writer, null, draftLink);
    /* R41 (DEC-111): the project reference, read at this act from the project's notice. */
    const workingOn = this.#workingOn(proj);
    const render = (approvalsBlock) => caseDocumentText({
      caseId: theCase, edition, project: proj, workingOn, scope: scp, bias: back, bar,
      roster: members, roles: memberRoles, pins: pinOf,
      statement: stmt, position: pos, justification: just, excluded: rows,
      author: who, at: when, searched, conclusions: conclusionRows,
      statementBy: writer.by, statementByStated: writer.stated,
      frozen, manifest, acks, citations,
      /* R60: each member's subject as its pinned bytes state it. */
      subjects: new Map(prepared.map((p) => [p.id, subjectStated(p.fm)])),
      /* R87: each member's project's basis version, written on its `case_roles:` row (null where the project named none). */
      basisVersions: new Map(prepared.map((p) => [p.id, p.basisVersion])),
      attributions,
      /* R55: each tension entry, the owner's words marked as the owner's, acknowledged by the `author` stamp at this act. */
      tensions: read.entries.map((e) => ({ ...e, words: listed.byCandidate.get(e.candidate).words,
                                           acknowledged_by: who, acknowledged_at: when })),
      tensionsUnread: read.unread,
      captures: captureRows, sources: sourceRows,
      /* R38: the statement as the member signs it, with the `case-inputs` R6 draft it began as and whether its words were kept. */
      whatChanged: changed ? { text: changed.text, began_as: changed.began_as, draft: changed.draft,
                               adopted_as_drafted: changed.adopted_as_drafted } : null,
      /* R40: the frozen manifest's statements, every page, each citation printed or withheld. */
      lens: lensStatements,
      /* R55: the versions the owner signs under (`case-disclosures` R5). */
      method,
      /* R55: `case-disclosures` R7, R13, R14, R15. */
      materials: materialBlocks, group, accepted: { rows: accepted.rows, flags: flagRows },
      grading: findingFacts.grading, passages: findingFacts.passages,
      /* F2 (`case-grammar` R36, R37): the passages published without a grade (`case-disclosures` R35's rows) and the typed ones. */
      ungraded: findingFacts.ungraded, typed: typedRows,
      /* R56, R57: case-grammar's blocks (its R18, R20); R55: case-disclosures' people and member-ties blocks (its R28). */
      calculations: calcJ.rows, calculationsBlock: calculationsLines(calcJ.rows),
      timeline: timeline.rows, timelineLeftOut: timeline.left_out, timelineCut: timeline.cut, timelineUnread: timeline.unread,
      timelineWithheld: timeline.withheld,
      timelineBlock: timelineLines(timeline.rows),
      peopleBlock: peopleLines(peopleJ.rows), memberTiesBlock: memberTieLines(tiesJ.rows),
      /* R63: case-grammar R23's block, every sentence of the account and of the four statements with what it cites, and
         its body section when the account has a sentence. R69: case-grammar R25's block and the comments in words, as
         `case-account` R7 answers them. */
      accountBlock: accountLines(accountJ.rows),
      accountSection: shaped.sentences.length ? accountSectionLines(accountJ.rows) : [],
      reviewCommentsBlock: comments.block, reviewComments: comments.body,
      /* R74 (T45; T47): case-grammar R29's block and body section, every pending outcome in the order carried. */
      outcomesBlock: outcomesLines(outcomes), outcomesSection: outcomesSectionLines(outcomes),
      approvalsBlock,
    });
    /* R68 (D60; K2528, K2533): THE APPROVALS THIS DOCUMENT CARRIES, case-grammar R26's block: the rule in force and the
       approvals `review` holds for the document's approval digest (`approvalSubjectSha`, the text without that block, so
       the digest is the same before and after it is written), read through `ratification.approvalsInForce` (its R50).
       With no rule in force and none held, no block: a group of one is never blocked. Approvals that arrive later are
       carried by preparing the document again, its digest unchanged. */
    const unapproved = render([]);
    const approvalDigest = approvalSubjectSha(unapproved);
    const approvals = this.#approvalsHeld(theCase, edition, approvalDigest);
    const approvalsBlock = approvals.ok !== false && (approvals.rule || approvals.approvals.length)
      ? approvalsLines({ rule: approvals.rule, approvals: approvals.approvals }) : [];
    const docText = approvalsBlock.length ? render(approvalsBlock) : unapproved;
    /* R14 (G47; K4666, K1881): THE DOCUMENT'S BYTES, measured as built and before any side effect (the reevaluation raise,
       the standards judgment, the store). Over `publication`'s `CASE_DOCUMENT_BYTES_MAX` the act refuses and nothing is
       prepared; the member reads the document before signing, so the bound is stated, never a silent cut. */
    const docBytes = new TextEncoder().encode(docText);
    const docBound = publicationExports.CASE_DOCUMENT_BYTES_MAX;
    const materialCount = materialBlocks && Array.isArray(materialBlocks.rows) ? materialBlocks.rows.length : 0;
    /* DEC-49 REGION is-case-document-too-large */
    if (Number.isFinite(docBound) && docBytes.length > docBound) {
      const mb = (n) => (n / 1048576).toFixed(1);
      return actRefusal("CASE_DOCUMENT_TOO_LARGE", { size: docBytes.length, bound: docBound,
        materials: materialCount, members: members.length,
        detail: localize("case-authoring.index.case_document_too_large", "This case document is {size} MB, over the {bound} MB a case document may be, and it names {materials} materials and {members} findings. The record is unchanged and nothing was prepared. Leave out some of the materials or findings and prepare the case again.",
          { size: mb(docBytes.length), bound: mb(docBound), materials: String(materialCount), members: String(members.length) }) });
    }
    /* END DEC-49 REGION is-case-document-too-large */
    /* R61 (N717; K2002, K2129): THE STANDARDS THIS CASE MEASURES AGAINST, JUDGED OVER THE TEXT IT WOULD STORE, the act's
       last refusal (`#standardsUse`). Nothing is written on a refusal: the act's transaction takes back every row. */
    const standardsUse = this.#standardsUse(docText, written, who, when);
    /* DEC-49 REGION is-standards-use */
    if (standardsUse.ok === false)
      return actRefusal("STANDARDS_USE_REFUSED", { refusals: standardsUse.refusals, unjudged: standardsUse.unjudged,
        detail: localize("case-authoring.index.map_a_published_case_carries", "{map} A published case carries a standard that is not free to read only as the passages a finding relies on, and a finding that rests only on benchmarks says \"slower than\" or \"below\", never \"violated\" or \"nonconforming\" (K1723, K1739). Change the case and prepare it again. Nothing was prepared.", { map: String(standardsUse.refusals.map(standardsUseWords).join(" ")) }) });
    /* END DEC-49 REGION is-standards-use */
    /* R15: the raise for each new member edition above 1, now that nothing refuses; the pre-flight's rolled-back run
       states it and raises nothing (R34). */
    for (const f of written) if (f.reevaluation === null)
      f.reevaluation = run.preflight ? { source: "edition", edition: f.edition, raised_when: "published" }
        : this.reevaluation.raise({ target: f.target, source: "edition", since: when, edition: f.edition, viewer });
    /* publication R21: stored unsigned, replacing an unsigned document of this case edition and never a signed one; the
       exclusions are projected in the same write. What this act answers with is what the store holds after the call. */
    const stored = this.publication.storeCaseDocument({ caseId: theCase, edition, text: docText, author: who, at: when,
                                                        draft: boundDraft });
    /* R14 (G47): a refusal of the store, whatever its reason, is the act's refusal; never a prepared document with no sha. */
    if (!stored || stored.ok === false || !stored.doc_sha) {
      const why = stored && stored.reason ? String(stored.reason) : "CASE_DOCUMENT_NOT_STORED";
      if (why === "CASE_DOCUMENT_TOO_LARGE")
        return actRefusal("CASE_DOCUMENT_TOO_LARGE", { size: docBytes.length, bound: Number.isFinite(docBound) ? docBound : stored.bound ?? null,
          materials: materialCount, members: members.length,
          detail: localize("case-authoring.index.case_document_too_large", "This case document is {size} MB, over the {bound} MB a case document may be, and it names {materials} materials and {members} findings. The record is unchanged and nothing was prepared. Leave out some of the materials or findings and prepare the case again.",
            { size: (docBytes.length / 1048576).toFixed(1), bound: ((Number.isFinite(docBound) ? docBound : stored.bound ?? 0) / 1048576).toFixed(1), materials: String(materialCount), members: String(members.length) }) });
      return { ok: false, reason: why, code: why,
        detail: localize("case-authoring.index.case_document_not_stored", "The case document could not be stored. The record is unchanged and nothing was prepared.") };
    }
    /* R69 (record-grammar R52): after the document is stored, the member's acceptance of the draft her account began as,
       in its one shape (`case-account` R4's `acceptanceRecorded`), inside this act's transaction; none without a draft. */
    if (drafted.draft) A.acceptanceRecorded({ caseId: theCase, edition, drafted, by: who, at: when });
    /* R34's steps read what this act read, from the same values (never a second reading). */
    /* R88 (T53; DEC-461): the passages this edition would be signed with ungraded (`case-disclosures` R35), for the sign step. */
    seen.ungraded = findingFacts.ungraded;
    Object.assign(seen, { outcomes, approvals: { ...approvals, digest: approvalDigest }, workingOn, excluded: rows, searched, manifest, bias: back, captures: captureRows, sources: sourceRows,
                          materials: materialBlocks, accepted: accepted.rows, flags: flagRows,
                          tensions: read.entries, memberEditions: [...frozen].map(([target, z]) =>
                            ({ target, edition: z.edition, crossed: z.crossed })) });

    return { ok: true, caseId: theCase, minted, edition,
             caseDocument: { case_id: theCase, edition, doc_sha: stored ? stored.doc_sha ?? null : null,
                             bytes: docBytes.length,
                             read: `op=casedocument&case=${theCase}&edition=${edition}` },
             /* THE SET, in the order the member published it. */
             findings: written,
             /* DEC-44 determination 5: the one-finding case answers `target`, `bundleSha` and `state` at the top as it
                always did; a case of two answers neither, so no caller reads one member's sha as the case's. */
             ...(written.length === 1 ? { target: written[0].target, bundleSha: written[0].bundleSha,
                                          state: written[0].state } : {}),
             scope: scp,
             project: proj, required: bar,
             roles: memberRoles,
             /* REC-47: BESIDE the completeness block, not inside it (DEC-46). */
             bias_acknowledgement: back,
             bias_manifest: manifest,
             case_citations: citations,
             /* R55: what the document discloses, as it states it (R33: a highlighted one carries its seen side only). */
             tensions: read.entries.map((e) => ({ ...e, words: listed.byCandidate.get(e.candidate).words,
                                                  acknowledged_by: who, acknowledged_at: when })),
             tensions_highlighted: read.entries.filter((e) => e.unseen_other_side).length,
             tensions_legs_unread: read.unread,
             completeness: { statement: stmt, subject_position: pos, subject_justification: just,
                             author: who, at: when, excluded: rows.length,
                             statement_sha: acks.statementSha, acknowledgements: acks.rows,
                             acknowledgements_truncated: acks.truncated,
                             ...(acks.byAuthor ? { acknowledgements_by_author_not_listed: acks.byAuthor } : {}),
                             statement_by: writer.by, statement_by_stated: writer.stated,
                             ...(acks.byWriter ? { acknowledgements_by_statement_writer_not_listed: acks.byWriter } : {}),
                             ...(acks.withheldWriterUndetermined
                               ? { acknowledgements_withheld_writer_undetermined: acks.withheldWriterUndetermined }
                               : {}),
                             ...(acks.unbound ? { acknowledgements_unbindable_to_this_case: acks.unbound } : {}),
                             ...(draftLink ? { draft: { draft_id: draftLink.draft, named_by: draftLink.by,
                                                        named_at: draftLink.at,
                                                        acknowledgements_bound: acks.boundByLink } } : {}),
                             ...(acks.unboundWriterUndetermined
                               ? { acknowledgements_unbindable_writer_undetermined: acks.unboundWriterUndetermined }
                               : {}) },
             author: who, at: when, weight: "single",
             /* R57 (T45): the published record of actions as written, and the count of the group's acts its sources did
                not mark public, left out and never written. */
             timeline: { we_did: timeline.rows.filter((r) => r.lane === "we_did").length, withheld: timeline.withheld },
             /* R63, R69, R68: the account as written into the document, the draft it began as, the review comments
                carried and the count left out, and the approvals carried, each only when there is one. */
             ...(shaped.sentences.length ? { account: { sentences: accountJ.rows.filter((r) => r.kind === "account"),
                                                       draft: drafted.draft ?? null, form: drafted.form ?? null } } : {}),
             ...(comments.carried.length || comments.left_out ? { review_comments: { included: comments.carried.length,
                                                                                     left_out: comments.left_out } } : {}),
             ...(approvalsBlock.length ? { approvals: { rule: approvals.rule, given: approvals.approvals,
                                                        missing: approvals.missing } } : {}),
             /* R61: each criteria row stated "not held", not judged, beside an act that succeeds. */
             ...(standardsUse.unjudged.length ? { unjudged: standardsUse.unjudged } : {}),
             /* THERE IS NO CASE-LEVEL `strength` KEY AND THERE MUST NEVER BE ONE (R24). */
             next: localize("case-authoring.index.review_the_case_document_and_ratify_it", "review the CASE DOCUMENT (op=casedocument&case={caseId}&edition={edition}) and ratify it (op=caseratify): it carries the case's scope, its completeness assertion, its bias acknowledgement, its standard of evidence, the whole roster PINNED AT THE VERSION HASHES each finding has now, and each member's own edition and frozen strength as this case reads it — and your signature over it is what commits them. Nothing was written on any finding (BIO_Publication_v0_1.md §3 rule 12). ",
                            { caseId: String(theCase), edition: String(edition) })
               + (written.length === 1
                 ? localize("case-authoring.index.then_ratify_the_finding_itself", "Then ratify the finding itself (op=ratify): it is signed on its own bytes because the finding is the unit of truth.")
                 : localize("case-authoring.index.then_ratify_each_of_these_findings", "Then ratify EACH of these {count} findings (op=ratify): every finding is signed on its own bytes because the finding is the unit of truth, and this case edition becomes servable as a container when the last of them lands.", { count: String(written.length) })) };
  }

  /** R68 (D60; K2528, K2533): the rule in force and the approvals held for the approval digest `docSha`, read through
   *  `ratification.approvalsInForce` (its R50): `{rule, approvals, missing}`, or `{ok: false, reason}` when they cannot be
   *  read (the pre-flight names it; signing refuses it at ratification R49). */
  #approvalsHeld(caseId, edition, docSha) {
    let a = null;
    try { a = this.ratification.approvalsInForce({ case: caseId, edition, docSha }); } catch { a = null; }
    if (!a || a.ok === false || !Array.isArray(a.approvals))
      return { ok: false, reason: "APPROVALS_UNREAD", rule: null, approvals: [], missing: [] };
    return { ok: true, rule: a.rule ?? null, approvals: a.approvals.map((x) => ({ by: x.by ?? null, at: x.at ?? null })),
             missing: Array.isArray(a.missing) ? a.missing : [] };
  }

  /** R61 (N717, N648; K1723, K1739, K2002): `case-checker.checkStandardsUse` (its R21) over the complete text `text`:
   *  `criteria`, the rows `publication.criteriaFor` (its R75) answers for the members at the bytes R13 pins (`written`),
   *  with the publisher `signer` and the act's instant `at`, each also carrying `captures`, the captures holding its
   *  passages (`content`'s read contract, its R45); `materials` and `passages`, the document's own `materials:` and
   *  `passages:` rows (`case-grammar` R12, R17) read back from `text`. Answers `{ok, refusals?, unjudged}`. */
  #standardsUse(text, written, signer, at) {
    const read = this.publication.criteriaFor({ members: written.map((f) => ({ bundle_id: f.target, version_sha: f.bundleSha })),
                                                signer, at });
    const rows = (read && Array.isArray(read.rows) ? read.rows : []).filter((r) => r && typeof r === "object");
    const contents = [...new Set(rows.flatMap((r) => (Array.isArray(r.passages) ? r.passages : [])
      .map((q) => (q && typeof q.content === "string" ? q.content : null)).filter(Boolean)))];
    const captureOf = new Map();
    for (let i = 0; i < contents.length; i += SEARCHED_CHUNK) {
      const part = contents.slice(i, i + SEARCHED_CHUNK);
      for (const r of this.#rows(`SELECT content_id, capture_sha FROM content WHERE content_id IN (${part.map(() => "?").join(",")})`,
                                 ...part))
        if (typeof r.capture_sha === "string" && r.capture_sha) captureOf.set(r.content_id, r.capture_sha);
    }
    const criteria = rows.map((r) => ({ ...r, captures: [...new Set((Array.isArray(r.passages) ? r.passages : [])
      .map((q) => q && captureOf.get(q.content)).filter(Boolean))] }));
    const fm = parseFrontmatter(text).data || {};
    const materials = (materialsOf(fm) || {}).materials || [];
    const passages = Object.values(passagesOf(fm) || {}).flat();
    const judged = checkStandardsUse({ text, criteria, materials, passages });
    return { ...judged, unjudged: Array.isArray(judged.unjudged) ? judged.unjudged : [] };
  }

  /** R38 (DEC-101 (1)(2); K1019, K1025): the "What changed" statement of an edition above 1, `{text, draft?}`. Absent, not
   *  a string or blank is `NO_WHAT_CHANGED`; over `WHAT_CHANGED_MAX` characters (code points) `BAD_WHAT_CHANGED`; a
   *  named `draft` must be one of this case's drafts (`case-inputs` R6, read through its R7's `whatChangedDraftOf`), else `NO_SUCH_WHAT_CHANGED_DRAFT`. Codes without catalogue
   *  rows (R29 names none). Answers the refusal or `{ok: true, text, began_as, draft, adopted_as_drafted}`: with a draft,
   *  `machine_draft`, its id, and whether `text` is its words unchanged; without one, `member`, null, null
   *  (`case-grammar` R8). */
  #whatChangedJudged(whatChanged, caseId, edition) {
    const wc = whatChanged && typeof whatChanged === "object" && !Array.isArray(whatChanged) ? whatChanged : null;
    const text = wc && typeof wc.text === "string" ? wc.text : null;
    if (text === null || !text.trim())
      return { ok: false, reason: "NO_WHAT_CHANGED", caseId, edition,
               detail: localize("case-authoring.index.edition_of_caseid_must_say_what_changed", "edition {edition} of {caseId} must say what changed in it since the edition before, and why (whatChanged: {text}): a reader of a later edition is owed the difference in the team's own words, not left to compare two documents (DEC-101). A first edition carries none. Nothing was written.",
                                { edition: String(edition), caseId: String(caseId), text: "{text}" }) };
    const length = [...text].length;
    if (length > WHAT_CHANGED_MAX)
      return { ok: false, reason: "BAD_WHAT_CHANGED", caseId, edition, length, max: WHAT_CHANGED_MAX,
               detail: localize("case-authoring.index.what_changed_in_this_edition", "what changed in this edition is at most {WHAT_CHANGED_MAX} characters, and this statement is {length}. Say it shorter. Nothing was written.", { WHAT_CHANGED_MAX: String(WHAT_CHANGED_MAX), length: String(length) }) };
    const named = wc.draft == null ? "" : String(wc.draft).trim();
    if (!named) return { ok: true, text, began_as: "member", draft: null, adopted_as_drafted: null };
    const d = this.inputs.whatChangedDraftOf(caseId, named);
    if (!d)
      return { ok: false, reason: "NO_SUCH_WHAT_CHANGED_DRAFT", caseId, edition, draft: named,
               detail: localize("case-authoring.index.no_draft_of_caseid_statement", "no draft of {caseId}'s statement of what changed answers to {named} (op=whatchangeddrafts&case={caseId} lists them). Name one of them, or write the statement in your own words (whatChanged: {text}) and publish again. Nothing was written.",
                                { caseId: String(caseId), named: String(named), text: "{text}" }) };
    return { ok: true, text, began_as: "machine_draft", draft: d.draft_id, adopted_as_drafted: text === d.text };
  }

  /** R2, asked by `op=publish` and by R32's read alike: the publishing project named, seen, a project, and owned by
   *  `who`. Answers the refusal itself (`ok: false` at the top level, N370) or `{ok: true, proj, gate}`. */
  #authority(project, viewer, who) {
      /* R2 — CASE-2 / DEC-72: PUBLICATION IS A PRODUCTION OF A PROJECT, wielded by an OWNER of it. These authority fences
         fire first, beside the machine fence: a project-less caller is not making a legal call, and ordering their
         diagnosis behind the ceremony would make them author a bias acknowledgement for a request that cannot succeed. */
      const gate = viewerPredicate(viewer);
      const proj = str(project);
      if (!proj)
        return { ok: false, reason: "NO_PUBLISHING_PROJECT",
                 detail: localize("case-authoring.index.a_case_is_a_production_of_a_project", "a case is a PRODUCTION OF A PROJECT (DEC-72): pass project=<project id>. The project is what supplies the standard of evidence this case is held to, read from that project alone at this moment — so a publication naming no project is one whose bar nobody declared, and an absent publisher is not a publisher of none.") };
      /* record-core R37's read contract, through membership's one sight rule (its R43). */
      const pb = this.#one(`SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
                           proj, ...gate.args);
      /* REC-149: at EXISTENCE the positional C-70.1 (membership R77); NONE is membership's one answer (its R78). */
      if (!pb) { const existence = this.membership.existenceAct(proj, viewer); if (existence) return existence; }
      if (!pb) return noSuchProject(proj);
      if (normalizeType(pb.object_type) !== "project")
        return { ok: false, reason: "NOT_A_PROJECT", project: proj, object_type: pb.object_type,
                 detail: localize("case-authoring.index.proj_is_a_object_type", "{proj} is a {object_type}, and only a PROJECT has a standard of evidence to hold a case to (DEC-72). Publication is wielded at the top of a project's roster.", { proj: String(proj), object_type: String(pb.object_type) }) };
      /* Membership's own owner predicate (its R54), never restated. No administrator arm: an administrator sees every
         project and directs none of them (v2 4.9), and publishing is the most directing act there is. */
      if (!this.membership.isProjectOwner(proj, who))
        return { ok: false, reason: "NOT_THE_PROJECT_OWNER", project: proj, author: who,
                 detail: localize("case-authoring.index.publishing_is_proj_s_own", "publishing is {proj}'s own production and is wielded by an OWNER of it (DEC-72). An administrator sees every project and directs none of them, and a participant who is not an owner contributes to the work without putting the project's name on it.", { proj: String(proj) }) };
    return { ok: true, proj, gate };
  }

  /** R4, asked by `op=publish` and by R32's read alike: each member in order, every one judged before any moves.
   *  Answers the refusal itself (N370) or `{ok: true, prepared}`, each prepared member with its current pin (`bundleSha`, R13). */
  #judgeMembers(members, proj, viewer, gate) {
      /* R4 — EVERY MEMBER IS JUDGED BEFORE ANY MEMBER MOVES: a case that took two of three findings and then refused
         the third would assert a case that does not exist. */
      const prepared = [];
      for (const id of members) {
        /* record-core R37's read contract, gated by membership's rule: absent and invisible are one answer. */
        const b = this.#one(`SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
                             WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
        if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
        if (normalizeType(b.object_type) !== "inquiry")
          return { ok: false, reason: "NOT_AN_INQUIRY", target: id, object_type: b.object_type,
                   detail: localize("case-authoring.index.a_finding_is_an_inquiry", "a FINDING is an inquiry that reached a conclusion; nothing else is publishable as a member of a case.") };
        const text = this.#liveText(id);
        if (text === null)
          return { ok: false, reason: "NO_DOCUMENT", target: id,
                   detail: localize("case-authoring.index.this_inquiry_has_no_readable_bundle", "this inquiry has no readable bundle.md, so its state cannot be moved") };
        const fm = parseFrontmatter(text).data || {};
        const head = this.record.head(id);
        /* CASE-4 / DEC-72 and REC-135 / §7.1 item 4: ONLY A CONCLUDED FINDING MAY BE A CASE MEMBER, and `concluded` is
           asked of the PUBLISHING PROJECT'S relationship with the question (ratification R1), never of the shared
           question's own word. THE RULE'S OWN SENTENCE LEADS EVERY BRANCH (CASE-AS-PRODUCTION's supersession table
           verbatim); what the branch adds is WHICH fact was met, because "not concluded" is four different facts. */
        const conc = this.ratification.caseConclusionFor(proj, id, viewer, b.current_state);
        if (conc.state !== "concluded")
          return { ok: false, reason: "NOT_CONCLUDED", target: id, project: proj,
                   from: b.current_state, object_type: fm.object_type ?? b.object_type,
                   relationship: conc.relationship, why: conc.why,
                   stance: conc.stance, concluded_elsewhere: conc.concluded_elsewhere,
                   concluded_elsewhere_bounds: conc.concluded_elsewhere_bounds,
                   detail: localize("case-authoring.index.only_a_concluded_finding_may_be", "only a CONCLUDED finding may be a case member: a material set cannot be asserted over a question with no conclusion, and `concluded` is asked of the PUBLISHING PROJECT'S relationship with it (INVESTIGATIVE-SESSION.md §7.1 item 4). ")
                     + (conc.why === "question_not_case_bearing"
                     ? localize("case-authoring.index.this_question_is_state", "This question is {state}, and a case cannot be asserted over one the team has set down or carried forward. Reopen it (op=reopen) or work the children a division produced (DEC-28); a conclusion a project wrote while the question was open does not survive the question leaving the states a case can rest on. ", { state: String(b.current_state) })
                     : conc.why === "project_withdrew_its_conclusion"
                     ? localize("case-authoring.index.proj_concluded_this_question_and_withdrew", "{proj} concluded this question and WITHDREW that conclusion, so it stands on none today (op=withdrawconclusion; §7.1 item 7 — the withdrawal is history, never the stance). Conclude it again for this project (op=conclude&project={proj}). ", { proj: String(proj) })
                     : conc.why === "project_stance_undetermined"
                     ? localize("case-authoring.index.proj_latest_entry_names_an_act", "{proj}'s latest entry about this question names an act your team's Civicsmith does not know, so what it stands on is UNDETERMINED rather than concluded, and it is not guessed at. ", { proj: String(proj) })
                     : localize("case-authoring.index.proj_has_not_concluded_this_question", "{proj} has not concluded this question. A conclusion belongs to the project's relationship with the inquiry (§7.1): another team's conclusion, and a conclusion written in the question's own bytes with no project, are both readable here and neither is this project's. Conclude it for this project (op=conclude&project={proj}&version=<reading>). ", { proj: String(proj) }))
                     + (conc.concluded_elsewhere.length
                       ? localize("case-authoring.index.count_other_projects_this_viewer_can_see", "{count} other project(s) this viewer can see HAVE concluded it ({projects}) — information, never this project's stance (§7.1 item 8). ",
                                  { count: String(conc.concluded_elsewhere.length), projects: conc.concluded_elsewhere.map((o) => o.project).join(", ") })
                       : "")
                     + localize("case-authoring.index.a_finding_already_in_a_published_case", "A finding already in a published case is REOPENED first (op=reopen) and concluded again, which is what makes the next edition a separate document carrying its own conclusion, its own falsifier and its own freshly authored completeness (DEC-12, DEC-72).") };
        /* R8 — REC-157 / §7.1 item 9: a finding in a case at its current bytes is asked whether some edition pinning
           them ALREADY RECORDS the conclusion this act would record, compared on the SAME answer the gate above was
           decided on (`conc`, never re-read). The refusal itself is asked below, once the case is known (D-442). */
        const rel = this.caseTensions.caseRelation(id);
        const recorded = rel && rel.member ? this.ratification.editionsRecordingConclusion(id, rel, conc) : null;
        prepared.push({ id, b, fm, bundleSha: head ? head.bundleSha : null, conclusion: conc, warrant: recorded,
                        preparedIn: rel && rel.prepared ? rel.prepared.case_id ?? null : null,
                        basisVersion: this.#basisVersionOf(proj, id, viewer) });
      }
    return { ok: true, prepared };
  }

  /** R87 (case-grammar R34): the basis version the project `proj` stands on for finding `id` at this prepare, as
   *  `{name, identity}`: the name basis-versions' `currentOf` answers, and the identity the SHA-256 of that version's
   *  composition (basis-version-grammar R5). Null when the project names no version for the finding, or the version is
   *  not in the listing (never filled). */
  #basisVersionOf(proj, id, viewer) {
    const current = this.basisVersions.currentOf(proj, id, viewer);
    if (!current) return null;
    const listed = this.basisVersions.basisVersions({ id, viewer, limit: BASIS_VERSIONS_LIMIT_MAX });
    const version = listed.ok ? listed.versions.find((v) => v.name === current.version) : null;
    if (!version || typeof version.composition !== "string") return null;
    return { name: current.version, identity: sha256HexSync(version.composition) };
  }

  /** R72 (T45; N892; Actions D4; v0.2 rule 15; `project-roster` R23; `publication` R78): the publishing project and the
   *  project each member finding was committed with (record-core R34's `bundleInfo`), each asked of
   *  `project-roster.projectScope`; any at `counsel_matter` is `COUNSEL_MATTER_NOT_PUBLISHED`, publication R78's one row
   *  (read through its export, no copy held here), naming each project and the members committed with it. Else null. */
  #counselMatters(proj, prepared) {
    const projects = new Map([[proj, []]]);
    for (const p of prepared) {
      const info = this.record.bundleInfo(p.id);
      const of = info && typeof info.project === "string" && info.project ? info.project : null;
      if (of) projects.set(of, [...(projects.get(of) || []), p.id]);
    }
    const counsel = [...projects].filter(([id]) => this.projectRoster.projectScope(id).scope === "counsel_matter")
      .map(([id, members]) => ({ project: id, publishing: id === proj, members }));
    if (!counsel.length) return null;
    const row = CASE_SOURCES_CHECKS.COUNSEL_MATTER_NOT_PUBLISHED || {};
    /* DEC-49 REGION is-counsel-matter-published */
    return { ok: false, reason: "COUNSEL_MATTER_NOT_PUBLISHED", code: "COUNSEL_MATTER_NOT_PUBLISHED", check: row.check ?? null,
             translation: row.translation ?? null, projects: counsel,
             detail: localize("case-authoring.index.map_a_counsel_matter_is", "{map}: a counsel matter is never published, and this case would rest on one. Nothing was prepared.", { map: String(counsel.map((c) => (c.publishing ? localize("case-authoring.index.project_the_publishing_project", "{project} (the publishing project)", { project: String(c.project) })
                       : localize("case-authoring.index.project_holding_members", "{project} (holding {members})", { project: String(c.project), members: c.members.join(", ") }))).join("; ")) }) };
    /* END DEC-49 REGION is-counsel-matter-published */
  }

  /** R5, asked by `op=publish` and by R34's pre-flight alike: the authored load-bearing partition. Answers the refusal
   *  itself or `{ok: true, memberRoles, loadBearing}`. */
  #rolesOf(prepared, roles, members) {
    /* R5 — CASE-2 / DEC-72 clause 4: THE AUTHORED LOAD-BEARING PARTITION. Both halves are authored and neither is a
       default: a member designated by omission was designated by nobody. A map keyed by member id, never a list,
       because a partition that can silently reorder against the roster is not one anybody authored. */
    const roleMap = roles && typeof roles === "object" && !Array.isArray(roles) ? roles : null;
    if (roles != null && !roleMap)
      return { ok: false, reason: "BAD_ROLES", allowed: MEMBER_ROLES,
               detail: localize("case-authoring.index.roles_is_a_map_from_finding_id", 'roles is a map from finding id to designation — {"INQ-…": "load_bearing"} — one entry per member of this case. It is not a list: a list would be positional against the roster, and a partition that can silently reorder is not one anybody authored.') };
    const memberRoles = [];
    for (const p of prepared) {
      const r = roleMap ? str(roleMap[p.id]) : "";
      if (!r)
        return { ok: false, reason: "NO_MEMBER_ROLE", target: p.id, allowed: MEMBER_ROLES,
                 detail: localize("case-authoring.index.id_carries_no_authored_designation", "{id} carries no authored designation. Every member of a case is declared load_bearing or supporting BY THE PUBLISHER (DEC-72): a load-bearing finding is one the case rests on and must meet the project's standard of evidence, and a supporting one travels with the case without being presented as carrying it. There is no default, because a member designated by omission was designated by nobody.", { id: String(p.id) }) };
      if (!MEMBER_ROLES.includes(r))
        return { ok: false, reason: "BAD_MEMBER_ROLE", target: p.id, role: r, allowed: MEMBER_ROLES,
                 detail: localize("case-authoring.index.id_is_designated_r_which", "{id} is designated '{r}', which is not one of: {MEMBER_ROLES}. The two terms are the record's own and are spelled as the schema spells them.", { id: String(p.id), r: String(r), MEMBER_ROLES: String(MEMBER_ROLES.join(", ")) }) };
      memberRoles.push({ target: p.id, role: r });
    }
    /* DEC-72's second ruled default: all-supporting material would assert nothing conclusive while the completeness
       ceremony claims coverage of a question no member answers. */
    const loadBearing = memberRoles.filter((m) => m.role === "load_bearing");
    if (!loadBearing.length)
      return { ok: false, reason: "NO_LOAD_BEARING_MEMBER", members: members.slice(),
               detail: localize("case-authoring.index.a_case_rests_on_at", "a case rests on at least one LOAD-BEARING finding (DEC-72). Every member here is supporting, so the case asserts nothing conclusively — while its completeness assertion claims coverage of a question no member answers. Designate the finding the case actually rests on, or do not publish this as a case yet.") };
    return { ok: true, memberRoles, loadBearing };
  }

  /** R6: `{bar, shortfalls}`, one `BELOW_PROJECT_STRENGTH` per (load-bearing member, declared axis) that does not reach
   *  the bar, in member and axis order: `op=publish` answers the first, R34's pre-flight lists them all. */
  #barJudged(proj, loadBearing) {
    /* R6 — CASE-2 / DEC-72 clause 2: THE BAR, READ FROM THE PUBLISHING PROJECT ALONE, AT ACT TIME, AND ONCE: the bar is
       the case's property, so members stamped with different bars would be the old model surviving in the bytes. THE
       GROUP DEFAULT IS NOT CONSULTED (it seeds new projects and gates no publication). An absent bar gates nothing and
       is not a bar of zero. */
    const bar = this.strength.projectBar(proj);
    const shortfalls = [];
    if (bar.declared) {
      const rank = (g) => BASIS_GRADES.indexOf(g);
      for (const m of loadBearing) {
        const pair = this.strength.strengthOf(m.target);
        for (const axis of STRENGTH_AXES) {
          const want = bar[axis];
          if (!BASIS_GRADES.includes(want)) continue;   /* an axis the project left unset gates nothing */
          const got = pair[axis];
          /* A DERIVED GRADE OF NULL DOES NOT MEET A DECLARED BAR: `unrated` and `undetermined` are frozen facts, not
             grades, and treating either as clearing a bar would claim a standard was met by material nobody graded. */
          if (got.grade === null || rank(got.grade) > rank(want))
            shortfalls.push({ ok: false, reason: "BELOW_PROJECT_STRENGTH", target: m.target, axis,
                     project: proj, required: want, reached: got.grade, state: got.state,
                     detail: localize("case-authoring.index.target_is_load_bearing_in", "{target} is LOAD-BEARING in this case and reaches {axis} {v1}, against {proj}'s declared standard of '{want}'. A case rests on its load-bearing findings, so those are what the project's bar is asked of. A finding below the bar may still travel with this case — designate it SUPPORTING and it is published, marked as not carrying the case (DEC-72). That is the honest move and never severing the citation.", { target: String(m.target), axis: String(axis), v1: String(got.grade === null ? localize("case-authoring.index.state_no_grade", "{state} (no grade)", { state: String(got.state) }) : "'" + got.grade + "'"), proj: String(proj), want: String(want) }) });
        }
      }
    }
    return { bar, shortfalls };
  }

  /* ==========================================================================================================
   * op=publishtensions: tensionsToDisclose (R32; DEC-85: the ceremony tells the publisher before the act)
   * ========================================================================================================== */
  /** R32: the candidates `op=publish` would require this act to disclose (R55), read by `case-disclosures`' `tensionsRead`
   *  exactly as `publishCase` reads them (its R1). R2's refusals, then R4's per member, then C-120.3, its
   *  `tensionsUndetermined` when this read itself throws. Writes nothing and never throws. */
  tensionsToDisclose(args = {}) {
    try {
      const { project = null, targets = null, target = null, viewer = null, author = null } = this.#withDraft(args);
      const who = str(author);
      const auth = this.#authority(project, viewer, who);
      if (auth.ok === false) return auth;
      const { proj, gate } = auth;
      const set = Array.isArray(targets) ? targets
                : typeof targets === "string" && targets.trim() ? targets.split(",")
                : target ? [target] : [];
      const members = [...new Set(set.map((x) => str(x)).filter(Boolean))];
      const judged = this.#judgeMembers(members, proj, viewer, gate);
      if (judged.ok === false) return judged;
      const read = this.disclosures.tensionsRead(judged.prepared, viewer);
      if (read.ok === false) return read;
      const candidates = read.entries.map((e) => (e.unseen_other_side
        ? { ...e, highlighted: true, sentence: CEREMONY_HIGHLIGHT_SENTENCE } : e));
      return { ok: true, wrote: false, project: proj,
               findings: judged.prepared.map((p) => ({ target: p.id, bundleSha: p.bundleSha })),
               candidates, count: candidates.length,
               highlighted: candidates.filter((c) => c.highlighted).length,
               legs_unread: read.unread,
               depth_stated: TENSIONS_DEPTH_STATED,
               says: localize("case-authoring.index.publishing_discloses_each_of_these", "publishing discloses each of these, and is never blocked by a conflict (DEC-76 item 4): list each in tensionsDisclosed at op=publish, with your own words if you choose. A highlighted one rests on a side in conflict with a record you cannot see; the published case will not name that record or who holds it.") };
    } catch (e) {
      return this.disclosures.tensionsUndetermined([{ finding: null, why: String(e && e.message || e).slice(0, 160) }]);
    }
  }

  /* ==========================================================================================================
   * op=publishpreflight: publishPreflight (R34; N364, DEC-80 item 3, REC-15: the ceremony's pre-flight)
   * ========================================================================================================== */
  /** R34: THE REAL REFUSALS, WITHOUT WRITING, BEFORE THE FIRST SCREEN. It runs `publishCase` over the same arguments
   *  inside a transaction it rolls back (R18), then `ratification.caseRatifyPreflight` (its R18) over the text that act
   *  would store, with `author` as signer. It answers `{ok: true, wrote: false, ready, first, blockers, steps}`:
   *  - `first` is exactly the refusal `op=publish` would give (DEC-8), or null when it would publish;
   *  - `blockers` is every other refusal reachable independently: each load-bearing member's shortfall on each axis of
   *    the bar (R6), and `case-disclosures`' R16 (hunch debt), R2, R6 (its photo refusals included: `PHOTO_UNCHECKED`,
   *    signing refused while a photo the case relies on is unchecked, T38; DEC-183 (1)), R13, R14, and R1
   *    as R32 reads it (R53), and
   *    ratification R18's list (reached only when the
   *    act would publish, since it reads the document's bytes);
   *  - `ready` is true only when there is neither and ratification's list was read;
   *  - `steps` is the six steps' content (DEC-80 item 2; the Photos step, DEC-180 (3)), read from the same run.
   *  The rolled-back run does not raise re-evaluation (R15): its listeners are told synchronously and must not hear of
   *  an edition that was never made. It writes nothing.
   *
   *  `viewer` is the control plane's stamp, or `{stamp, aiCred}` when it stamps the caller's minted agent credential
   *  (N435, N407's other half): the act and every read here are asked as `stamp`, and ratification's pre-flight is
   *  given the whole, so its machine fences (its R18) hold an agent whatever its viewer stamp. */
  publishPreflight(args = {}, calculationFacts = null) {
    const given = args && typeof args === "object" ? args : {};
    const carried = given.viewer && typeof given.viewer === "object" ? given.viewer : null;
    const drafted = this.#withDraft(carried ? { ...given, viewer: carried.stamp ?? null } : given);
    /* R34, R75, R76 (fix round 8, G112): the ties were attested when the edition was prepared, and the unsigned document
       holds that attestation; a reload's call sends none, so it is read from the document, in this rolled-back run only. */
    const a = { ...drafted, ...this.#fromPreparation(drafted) };
    const seen = {};
    let answer = null, text = null;
    try {
      this.record.transact(() => {
        answer = this.#publishCase(a, { preflight: true, seen, calculationFacts });
        if (answer && answer.ok === true) {
          const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, answer.caseId, answer.edition);
          text = d ? d.text : null;
        }
        throw PREFLIGHT_ROLLBACK;
      });
    } catch (e) { if (e !== PREFLIGHT_ROLLBACK) throw e; }
    const first = answer && answer.ok === false ? answer : null;
    const ratify = text === null
      ? { reached: false, refusals: [],
          why: localize("case-authoring.index.ratification_pre_flight_reads_the_document", "ratification's pre-flight reads the document op=publish would store, and op=publish refuses first") }
      : this.#ratifyPreflight(text, str(a.author), given.viewer ?? null);
    /* The independent reads, each over the same arguments, each stopping only where its own prerequisite refuses. */
    const found = [];
    const who = str(a.author);
    const auth = who && !isMachineIdentity(who) ? this.#authority(a.project ?? null, a.viewer ?? null, who) : null;
    let judged = null, partition = null, tensions = null, rests = null, accountRead = null, capturesRead = null;
    let stoodAt = null;
    /* R34: IT WRITES NOTHING. These reads reach the two writes `case-disclosures` makes inside its caller's transaction
       (its R23: a source id's minting, and a member document's copy queued by `case-carriage.documentCopy`, its R16;
       T39, N806), so they run inside a transaction this pre-flight rolls back, as the act's own run above does. */
    if (auth && auth.ok !== false) {
      try {
        this.record.transact(() => {
          const set = Array.isArray(a.targets) ? a.targets
                    : typeof a.targets === "string" && a.targets.trim() ? a.targets.split(",") : a.target ? [a.target] : [];
          const members = [...new Set(set.map((x) => str(x)).filter(Boolean))];
          judged = members.length ? this.#judgeMembers(members, auth.proj, a.viewer ?? null, auth.gate) : null;
          /* R83: the case identity the call stands at, told without the act so a refused call states it too. */
          stoodAt = this.#caseStood(members, a.caseId, a.newCase, judged);
          if (judged && judged.ok !== false) {
            partition = this.#rolesOf(judged.prepared, a.roles ?? null, members);
            if (partition.ok !== false) found.push(...this.#barJudged(auth.proj, partition.loadBearing).shortfalls);
            /* `case-disclosures`' judgments, as R55 asks them (R53). */
            const D = this.disclosures;
            const hunch = D.hunchDebt(judged.prepared);
            if (hunch) found.push(hunch);
            if (partition.ok !== false) {
              const resting = D.restingCaptures(judged.prepared);
              const facts = new Map([...new Set(resting.map((r) => r.capture))].map((sha) => [sha, D.captureFacts(sha)]));
              const selfJ = D.selfAttestedJudged(resting, facts, partition.memberRoles, a.selfAttested ?? null);
              found.push(...selfJ.refusals);
              /* R82 (C3; K4303): the captures the case rests on are known here whether or not op=publish refused, so step three
                 lists them from this read when the act's own run did not reach its rows. */
              capturesRead = D.disclosureBlocks({ resting, facts, selfAttested: selfJ, project: auth.proj, author: who,
                                                  at: this.#when("second") }).captures;
              /* its R6, then R53: its R13's acceptances and R14's flags, read as op=publish reads them. */
              const reached = D.materialsJudged(judged.prepared, partition.memberRoles, a.viewer ?? null);
              found.push(...reached.refusals);
              const accepted = D.acceptedWorkJudged(reached.refs, a.viewer ?? null);
              found.push(...accepted.refusals);
              const flags = D.flagsJudged(accepted.editions, a.flagsDisclosed ?? null);
              found.push(...flags.refusals);
              /* R34 (N757; DEC-180 (3); K2206): the ceremony's Photos step, `case-disclosures` R29 over the materials R6
                 answered, as op=publish judges them. (T38; DEC-183 (1); K2220, K2303) The step is a gate: R6's photo
                 refusals, `PHOTO_UNCHECKED` (each photo any chain reaches with no standing mark), `PHOTO_NOT_COVERABLE` and
                 `PHOTO_MARKS_UNDETERMINED`, are in `reached.refusals` above, so each is `first` when op=publish refuses
                 with it and among `blockers` otherwise. */
              rests = { accepted: accepted.rows, flags,
                        photos: D.photosOf(reached.materials, partition.memberRoles, a.viewer ?? null) };
              /* R56's undisclosed calculations, and its R25's and R27's people and signers (R34), as op=publish asks them. */
              const calc = this.#calculationsJudged(judged.prepared, partition.memberRoles, a.calculationsDisclosed ?? null,
                                                    calculationFacts);
              if (calc.refusal) found.push(calc.refusal);
              const shapedHere = this.account.accountShaped(a.account ?? null, null, 0);
              const authored = { statement: str(a.statement), scope: str(a.scope), justification: str(a.subjectJustification),
                                 bias: str(a.biasAcknowledgement), excluded: Array.isArray(a.excluded) ? a.excluded : [],
                                 account: shapedHere.ok ? shapedHere.sentences : [] };
              const { named } = this.#namedInCase(judged.prepared, auth.proj, a.viewer ?? null, authored, calc.money || []);
              found.push(...D.peopleJudged(named, a.peopleBases ?? null, a.viewer ?? null).refusals);
              found.push(...D.tieAttestationJudged([who], named, named.money_parties || [],
                attestedBy(who, a.tieAttested ?? null, this.#when("second")), a.viewer ?? null).refusals);
              /* R63, R69: `case-account` R5 and R6 (case-disclosures R30) over the account and the statements, read
                 here when op=publish refused before it asked (its own read, `seen.account`, otherwise): the case it would
                 publish when it can be told without the act (named, or the one the members serve), and no "what changed"
                 row, the edition not being known. */
              if (!seen.account) {
                const sa = this.account.accountShaped(a.account ?? null, a.statementCites ?? null,
                                                      Array.isArray(a.excluded) ? a.excluded.length : 0);
                if (sa.ok !== false)
                  accountRead = this.account.accountJudged({ sentences: sa.sentences, statementCites: sa.statementCites,
                    statement: str(a.statement), justification: str(a.subjectJustification),
                    excluded: (Array.isArray(a.excluded) ? a.excluded : []).filter((r) => r && typeof r === "object")
                      .map((r) => ({ target: str(r.target) || null, description: str(r.description), reason: str(r.reason) })),
                    prepared: judged.prepared, reached, lens: this.#lensStatements(auth.proj),
                    caseId: this.#caseOfMembers(members, a.caseId), viewer: a.viewer ?? null });
              }
            }
            tensions = D.tensionsJudged(judged.prepared, a.viewer ?? null, a.tensionsDisclosed ?? null);
            found.push(...tensions.refusals);
          }
          throw PREFLIGHT_ROLLBACK;
        });
      } catch (e) { if (e !== PREFLIGHT_ROLLBACK) throw e; }
    }
    /* R63: every refusal of case-disclosures R30 (`case-account` R6), every unanswered flag among them. */
    const account = seen.account || accountRead;
    if (account) found.push(...account.refusals);
    found.push(...ratify.refusals);
    /* R68 (D60; K2528, K2533): the approvals the group's rule requires at the document's approval digest, as op=publish
       read them; APPROVAL_MISSING is ratification R18's (its R49) when its list was read, and stated here only when it
       was not, or when the approvals could not be read at all. */
    const approvals = seen.approvals || null;
    if (approvals && !ratify.refusals.some((x) => x.reason === "APPROVAL_MISSING")) {
      if (approvals.ok === false)
        found.push({ ok: false, reason: "APPROVAL_MISSING", code: "APPROVAL_MISSING", missing: null,
                     detail: localize("case-authoring.index.the_approvals_the_teams_rule", "the approvals the team's rule requires could not be read, so whether every one is given is not known. Signing is refused until they can be. Nothing was written.") });
      else if (approvals.missing.length)
        found.push({ ok: false, reason: "APPROVAL_MISSING", code: "APPROVAL_MISSING", missing: approvals.missing,
                     detail: localize("case-authoring.index.missing_the_team_requires_their", "{missing}: the team requires their approval of this version of the case before it is signed, and it is not given. Ask them to approve it, then prepare it again so the document carries the approvals. Nothing was written.", { missing: String(approvals.missing.join(", ")) }) });
    }
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const blockers = [];
    for (const r of found) if (!(first && same(r, first)) && !blockers.some((b) => same(b, r))) blockers.push(r);
    /* R42: whether the project has a notice, asked only of a project the act's own authority fences let through. */
    const notice = auth && auth.ok !== false ? this.#workingOn(auth.proj) : null;
    /* R42 says so whenever the project has a notice: whatever reference R41 would write. */
    const steps = this.#preflightSteps(a, answer, seen, ratify, notice, rests && capturesRead ? { ...rests, captures: capturesRead } : rests, account);
    /* Ready only when nothing refuses AND ratification's list was read: a list not reached is not a list that is empty. */
    /* R83 (fix round 3, C48, C50; K4356): what the record holds prepared and published for the case the call stands at;
       the act's own run is rolled back, so a minted case (which the record does not hold) states neither. */
    /* A draft that asks for a new case (`newCase`) stands at no case until it is prepared, and a second ask of it is refused as
       a case member already: the document its own preparation made is found by the draft that made it (publication R40). */
    const editions = this.draftEditions({ caseId: answer && answer.ok === true ? (answer.minted ? null : answer.caseId) : stoodAt,
                                          draft: str(a.draft) || null });
    return { ok: true, wrote: false, ready: !first && !blockers.length && ratify.reached, first, blockers, steps, editions };
  }

  /* R34, R75, R76 (fix round 8, G112; round 9, G112b; diagnosis-R8-capture.md F): what the call's own signer already stated,
     in the unsigned document the record holds for the case the call stands at (R83's `draftEditions`), when it holds an
     `attestation` row of `member_ties:` naming her: her ties' confirmation, the bias acknowledgement she typed, the reasons
     she gave for self-attested captures and the words she gave for the tensions she disclosed, each only for a call that
     sends none (a call's own, or its draft's, wins). The ceremony's `publish` body carries all four and the draft holds
     none, so a reload's call is only {draft, project}. It reads and never throws, and it is never handed to `op=publish`,
     which asks them in its own act (R76; DEC-46). Nothing prepared, or prepared by another signer, answers nothing. */
  #fromPreparation(a) {
    try {
      const need = { tie: a.tieAttested !== true, bias: !str(a.biasAcknowledgement),
                     self: a.selfAttested == null, tensions: a.tensionsDisclosed == null };
      if (!Object.values(need).some(Boolean)) return {};
      const who = str(a.author);
      if (!who || isMachineIdentity(who)) return {};
      /* the case identity the call stands at, from the record without the act (R83), as the pre-flight tells it */
      const viewer = a.viewer ?? null;
      const auth = this.#authority(a.project ?? null, viewer, who);
      if (auth.ok === false) return {};
      const members = membersOf(a.targets, a.target);
      const judged = members.length ? this.#judgeMembers(members, auth.proj, viewer, auth.gate) : null;
      const held = this.draftEditions({ caseId: this.#caseStood(members, a.caseId, a.newCase, judged),
                                        draft: str(a.draft) || null });
      if (!held.case || held.prepared === null) return {};
      const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NULL`,
                          held.case, held.prepared);
      if (!d) return {};
      const bare = (x) => String(x ?? "").trim().replace(/^member:/, "");
      const fm = parseFrontmatter(d.text).data || {};
      if (!memberTiesOf(fm).some((r) => r.row === "attestation" && bare(r.signer) === bare(who))) return {};
      const stored = str(fm.bias_acknowledgement);
      const reasons = need.self ? (caseDocumentBlocks(d.text).captures || [])
        .filter((c) => c.self_attested_only && c.acknowledgement && c.acknowledgement.reason && bare(c.acknowledgement.acknowledged_by) === bare(who))
        .map((c) => ({ capture: c.capture, reason: c.acknowledgement.reason })) : [];
      const disclosed = need.tensions ? (tensionsOfDocument(d.text).tensions || [])
        .filter((t) => t.candidate && bare(t.acknowledged_by) === bare(who))
        .map((t) => ({ candidate: t.candidate, ...(t.owner_words ? { words: t.owner_words.text } : {}) })) : [];
      return { ...(need.tie ? { tieAttested: true } : {}), ...(need.bias && stored ? { biasAcknowledgement: stored } : {}),
               ...(reasons.length ? { selfAttested: reasons } : {}), ...(disclosed.length ? { tensionsDisclosed: disclosed } : {}) };
    } catch { return {}; }
  }

  /* R83 (R7, R9): the case identity a call stands at, told from the record without the act: the one named, else the one
     published case the members serve, else the case their unsigned preparation names; `newCase` stands at none. */
  #caseStood(members, caseId, newCase, judged) {
    if (newCase) return null;
    if (str(caseId)) return str(caseId);
    const served = this.#caseOfMembers(members, null);
    if (served) return served;
    const named = judged && judged.ok !== false ? [...new Set(judged.prepared.map((p) => p.preparedIn).filter(Boolean))] : [];
    return named.length === 1 ? named[0] : null;
  }

  /** R83 (K4363): `draftEditions({caseId, draft})` answers `{prepared, published}` for the case identity a draft stands at,
   *  as the record holds them (publication R40's `case_documents` and `published_cases`), the one read the pre-flight and
   *  `review` R19's draft rows share: `prepared` the edition number of the unsigned preparation, else null; `published`
   *  `{edition, address}` for the latest ratified edition, else null. `caseId` is the case the draft's identity names; with
   *  none, the case the draft's own preparation produced (publication R40: a document names the draft that made it,
   *  `draft` an id or a row), else neither is stated. (fix round 4, C48; K4467) `case` is that case id when the record holds
   *  a preparation or a published edition of it, else null, so a reloaded page reads the prepared document by it even for a
   *  draft that asks for a new case. Reads only and never throws. The address is the case page's,
   *  `/app/published/<case>/<edition>`, as the screens link it. */
  draftEditions({ caseId = null, draft = null } = {}) {
    try {
      let id = str(caseId);
      if (!id && draft) {
        const row = typeof draft === "object" ? draft : null;
        id = str(row && (row.case_id ?? row.caseId));
        if (!id) {
          const made = this.#one(`SELECT case_id FROM case_documents WHERE draft_id=? ORDER BY edition DESC LIMIT 1`,
                                 str(row ? row.draft_id : draft));
          id = made ? made.case_id : "";
        }
      }
      if (!id) return { case: null, prepared: null, published: null };
      const prep = this.#one(`SELECT edition FROM case_documents WHERE case_id=? AND sig_armored IS NULL
                              ORDER BY edition DESC LIMIT 1`, id);
      const pub = this.#one(`SELECT MAX(edition) AS m FROM published_cases WHERE case_id=? AND ratified_at IS NOT NULL`, id);
      const published = pub && pub.m != null ? Number(pub.m) : null;
      return { case: prep || published !== null ? id : null, prepared: prep ? Number(prep.edition) : null,
               published: published === null ? null : { edition: published, address: `/app/published/${id}/${published}` } };
    } catch { return { case: null, prepared: null, published: null }; }
  }


  /* R34: ratification R18 over the text op=publish would store, with `signer` the act's author, folded into
     `{reached, refusals, why?}`. With no pre-flight offered, that is stated, never read as none. */
  #ratifyPreflight(text, signer, viewer) {
    const r = this.ratification;
    if (!r || typeof r.caseRatifyPreflight !== "function")
      return { reached: false, refusals: [], why: word("case-authoring.why.ratification_offers_pre") };
    let out = null;
    try { out = r.caseRatifyPreflight({ text, signer, viewer }); } catch { out = null; }
    /* K552 (5): `{ok: true, ready, refusals}`, or `PREFLIGHT_UNDETERMINED`, which is itself the blocker. R75 (N683;
       ratification R44): its `publish_at` offer is carried as it answers it, read from this one call. */
    if (out && out.ok === true && Array.isArray(out.refusals))
      return { reached: true, refusals: out.refusals.filter((x) => x && typeof x === "object"),
               publish_at: out.publish_at && typeof out.publish_at === "object" ? out.publish_at : null };
    const undetermined = out && out.ok === false ? out
      : { ok: false, reason: "PREFLIGHT_UNDETERMINED", detail: localize("case-authoring.index.ratification_pre_flight_gave_no_answer", "ratification's pre-flight gave no answer") };
    return { reached: false, refusals: [undetermined], why: undetermined.detail ?? word("case-authoring.why.ratification_pre_flight") };
  }

  /* B10 (K4240; screens-publish J9 (3)): each capture the case rests on that is not co-attested, with the member the record
     holds as capturing it (`capture`'s R69 actors, the first by time, the `member:` tag dropped; a machine is no member, so
     `by` is null when none) and the findings resting on it, each once. */
  #notCoAttested(captures) {
    const rows = new Map();
    for (const c of captures) {
      if (c.co_attested) continue;
      if (!rows.has(c.capture)) {
        const actors = this.capture.captureAccountsOf(c.capture).actors || [];
        const first = actors.find((x) => typeof x.actor === "string" && /^member:./.test(x.actor) && !isMachineIdentity(x.actor));
        /* C40 (K4365): the facts the capture row already carries, so the screen can say which proof exists late and which is
           missing (case-disclosures R2). */
        rows.set(c.capture, { capture: c.capture, by: first ? first.actor.replace(/^member:/, "") : null, findings: [],
                              timestamp_at: c.timestamp_at ?? null, co_archive: c.co_archive ?? null, missing: c.missing ?? [],
                              late: !!c.late, timestamp_late: !!c.timestamp_late, late_words: c.late_words ?? null });
      }
      const row = rows.get(c.capture);
      if (!row.findings.includes(c.member)) row.findings.push(c.member);
    }
    return [...rows.values()];
  }

  /* R34: the six steps (DEC-80 item 2; the Photos step, DEC-180 (3)), each read from the rolled-back run when it
     published, and each part it could not reach stated as not reached, never filled. Step three carries R32's read as
     the ceremony shows it. */
  #preflightSteps(a, answer, seen, ratify, notice = null, rests = null, account = null) {
    const ok = !!(answer && answer.ok === true);
    const notReached = ok ? null : localize("case-authoring.index.not_reached_op_publish_refuses_first", "not reached: op=publish refuses first ({reason})", { reason: String(answer ? answer.reason : localize("case-authoring.index.no_answer", "no answer")) });
    const tensions = this.tensionsToDisclose({ project: a.project ?? null, targets: a.targets ?? null,
                                               target: a.target ?? null, viewer: a.viewer ?? null, author: a.author ?? null });
    const capturesListed = (captures) => ({
      self_attested: captures.filter((c) => c.self_attested_only)
        .map((c) => ({ capture: c.capture, member: c.member, reason: c.acknowledgement.reason, sentence: SELF_ATTESTED_SENTENCE })),
      not_co_attested: this.#notCoAttested(captures) });
    return [
      { step: 1, name: word("case-authoring.name.becomes_permanent"),
        says: localize("case-authoring.index.signing_publishes_this_case_edition", "Signing publishes this case edition, and each finding in it at the version pinned here. A published edition is never withdrawn or edited: it is corrected only by a later edition.")
            /* R42 (DEC-111; K1031 (3)): the plain sentence until the UX design stream gives the words. */
            /* R34 (DEC-112 (4)): the plain sentence until the UX design stream gives the words. */
            + ` ${REPUBLISH_SENTENCE}`
            + (notice !== null ? ` ${NOTICE_SEALS_SENTENCE}` : ""),
        working_on: notice,
        /* R74 (T45; T47): the outcomes carried into this edition, each as it will be written. */
        ...(ok ? { outcomes: (seen.outcomes || []).map(({ outcome, kind, text, cites, on, carried_by }) =>
                     ({ outcome, kind, text, cites, on, carried_by })) } : {}),
        ...(ok ? { case: answer.caseId, edition: answer.edition, document: answer.caseDocument,
                   pinned: answer.findings.map((f) => ({ target: f.target, bundleSha: f.bundleSha })) }
               : { stated: notReached }) },
      { step: 2, name: word("case-authoring.name.rests"),
        ...(ok ? { roles: answer.roles, required: answer.required,
                   pairs: answer.findings.map((f) => ({ target: f.target, role: f.role, strength: f.strength })) }
               : { stated: notReached }),
        /* R53: each accepted_work: row, as `case-disclosures` R13 reads it. */
        accepted_work: rests ? rests.accepted : { stated: word("case-authoring.stated.reached_members_roles") } },
      { step: 3, name: word("case-authoring.name.leaving_out"),
        tensions: tensions.ok === false ? tensions : { candidates: tensions.candidates, count: tensions.count,
                                                        highlighted: tensions.highlighted, says: tensions.says },
        /* R53: the flags `case-disclosures` R14 requires, read as it reads them, beside R32's tensions. */
        flags: !rests ? { stated: word("case-authoring.stated.reached_members_roles") }
          : rests.flags.refusals.some((x) => x.reason === "FLAGS_UNDETERMINED") ? rests.flags.refusals[0]
          : { open: rests.flags.open.map(({ flag, ref, edition, issue, at }) => ({ flag, ref, edition, issue, at })),
              count: rests.flags.open.length, says: FLAGS_SAY },
        ...(ok ? { excluded: seen.excluded, searched: seen.searched, bias: { acknowledgement: seen.bias,
                                                                              manifest: seen.manifest },
                   ...capturesListed(seen.captures),
                   sources: seen.sources,
                   /* R34 (DEC-112 (5)): each source the case shows as "Withheld" (`case-disclosures` R4). */
                   withheld: seen.sources.filter((x) => x.basis === null) }
               : { stated: notReached,
                   /* R82 (C3; K4303): the captures are listed when known, though op=publish refused; a refusal stays in `first`. */
                   ...(rests && rests.captures ? capturesListed(rests.captures) : {}) }) },
      /* R34 (N757; DEC-180 (3); K2206): each photo the case relies on, its marks and state, and how many are unchecked
         (`case-disclosures` R29). (T38; DEC-183 (1)) An unchecked photo never travels and blocks signing: its
         refusal, `PHOTO_UNCHECKED`, is `first` or among `blockers` (R34), its words R29's. */
      { step: 4, name: "photos",
        ...(rests ? { photos: rests.photos.photos, unchecked: rests.photos.unchecked }
                  : { stated: word("case-authoring.stated.reached_members_roles") }) },
      { step: 5, name: word("case-authoring.name.edition_creates"),
        ...(ok ? { case: answer.caseId, edition: answer.edition, minted: answer.minted, members: seen.memberEditions }
               : { stated: notReached }) },
      /* R67 (D56): each sentence of the account with its citations, its check result (`case-account` R6) and, for a
         system draft (`case-account` R1), its framing; the four statements' rows beside it, judged the same way. */
      { step: 6, name: "the account",
        ...(account ? { sentences: account.rows.map((r) => ({ ord: r.ord, kind: r.kind, text: r.text, cites: r.cites,
                                                            bias_statement: r.bias_statement,
                                                            result: (account.results.get(r.ord) || []).length
                                                              ? account.results.get(r.ord) : "passed",
                                                            ...(r.began_as === "machine_draft" && r.kind === "account"
                                                              ? { draft: r.draft, framing: seen.accountDraft ? seen.accountDraft.framing : null }
                                                              : {}) })),
                        flags: account.flags.length, refusals: account.refusals.length }
                  : { stated: word("case-authoring.stated.reached_members_roles") }) },
      /* R68 (D60; K2533): the rule in force, the approvals it requires and those given for this version, and, while one
         is missing, that the document carries an approval only once it is prepared again after it is given. */
      { step: 7, name: "approvals",
        ...(!ok ? { stated: notReached }
          : !seen.approvals || seen.approvals.ok === false
            ? { stated: word("case-authoring.stated.approvals_group_rule") }
            : { rule: seen.approvals.rule, required: seen.approvals.rule ? seen.approvals.rule.approvers ?? [] : [],
                given: seen.approvals.approvals, missing: seen.approvals.missing, digest: seen.approvals.digest,
                says: !seen.approvals.rule ? localize("case-authoring.index.the_team_requires_no_approval", "The team requires no approval before a case is signed.")
                  : seen.approvals.missing.length
                    ? word("case-authoring.says.signing_waits_until")
                    : word("case-authoring.says.approval_group_requires") }) },
      /* R34 (T45; N880; Actions D13; v0.2 rule 8): the open requests for comment, in this step and nowhere else, never a
         blocker, never `first`, never `ready` (DEC-13: no reason is asked for signing while a window is open). */
      { step: 8, name: "sign", signer: str(a.author) || null,
        /* R88 (T53; DEC-461; K5548): every passage the case would be signed with that the team has not graded, from the
           rolled-back run's read (`case-disclosures` R35), in roster then passage order, with the count; never a blocker,
           never `first`, never `ready`. */
        ungraded_passages: ok ? { rows: (seen.ungraded || []).map(({ finding, ord, title, role }) => ({ finding, ord, title, role })),
                                  count: (seen.ungraded || []).length }
                              : { stated: notReached },
        open_requests: this.#openRequestsStep(seen.openRequestsAt || null, a.viewer ?? null),
        /* R77 (T51; DEC-340): the minutes beside the group's public comment; never a blocker, never `first`, never `ready`. */
        minutes: this.#minutesStep(seen.openRequestsAt || null, a.viewer ?? null),
        ratification: ratify.reached ? { reached: true, refusals: ratify.refusals }
                                     : { reached: false, why: ratify.why },
        /* R75 (T47; N683; DEC-147; ratification R44): "Publish at…" beside "Publish now", exactly as ratification's
           pre-flight answers it, in the group's zone; never a blocker, never `first`, never `ready`. Not reached, it is
           null with the sentence saying so, never an offer. */
        publish_at: ratify.reached && ratify.publish_at ? ratify.publish_at : null,
        ...(ratify.reached && ratify.publish_at ? {} : { publish_at_stated: ratify.reached
          ? PUBLISH_AT_UNANSWERED_SENTENCE : PUBLISH_AT_NOT_REACHED_SENTENCE }),
        next: ok ? localize("case-authoring.index.op_caseratify_over_op_publish_document", "op=caseratify over op=publish's document (case {caseId}, edition {edition})", { caseId: String(answer.caseId), edition: String(answer.edition) })
                 : localize("case-authoring.index.op_publish_first", "op=publish first") },
    ];
  }

  /** R41 (DEC-111; `case-grammar` R10): the project reference a case carries, `network-notices.noticeReferenceOf`
   *  (its R19) exactly as it answers for `project`: the notice id of the project's open or most recent notice, or null
   *  (undefined read as null). It is written only through case-grammar's `workingOnLines`, which writes no line for
   *  null and writes any other value as handed, so a malformed one reaches ratification R38's refusal at signing and is
   *  never corrected or dropped here (K1144). R42 reads the same answer. */
  #workingOn(project) {
    const ref = this.networkNotices.noticeReferenceOf(project);
    return ref === undefined ? null : ref;
  }

  /* The project an unsigned preparation of a case names, or null (publication R40: `case_documents`). */
  #preparedProject(caseId) {
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND sig_armored IS NULL
                         ORDER BY edition DESC LIMIT 1`, caseId);
    const named = d ? str((parseFrontmatter(d.text).data || {}).case_project) : "";
    return named || null;
  }

  /* The project a case edition's document names (publication R40: `case_documents`), signed or not, or null. */
  #documentProject(caseId, edition) {
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, caseId, Number(edition));
    const named = d ? str((parseFrontmatter(d.text).data || {}).case_project) : "";
    return named || null;
  }

  /* R63's pre-flight read: the case an act would publish when it can be told without the act, the one named, or the one
     published case the members serve; else null (a minted case has no drafts or flags yet). */
  #caseOfMembers(members, caseId) {
    if (str(caseId)) return str(caseId);
    const cs = new Set();
    for (const id of members) for (const r of this.#rows(`SELECT DISTINCT case_id FROM published_case_members WHERE bundle_id=?`, id))
      cs.add(r.case_id);
    return cs.size === 1 ? [...cs][0] : null;
  }

  /* A case's highest published edition, 0 when it has none (publication R40: `published_cases`). */
  #highestEdition(caseId) {
    const t = this.#one(`SELECT MAX(edition) AS m FROM published_cases WHERE case_id=?`, caseId);
    return t && t.m != null ? Number(t.m) : 0;
  }

  /** R16 — REC-219 / D-579(a): A CASE'S CITATION EDGES AND THE VERSION EACH RESTS ON, read at the act. The project's
   *  `references[]` entries of `rel: cites` that are not severed, in the document's order, each classified from its
   *  own bytes first: an `extent_capture` on the edge is the pin. Without one, what the record can say depends on how
   *  many captures it holds of the document NOW: one (`only_capture`), several (`undetermined`, never back-filled),
   *  none (`no_capture`). A question has no bytes (`no_bytes`); a finding that is not a member of this case is not cited
   *  (C67; R16). Set-based: one grouped count per chunk of targets
   *  (provenance R48's `register`, extraction R58's `readings`), never one read per edge, except a document with a capture
   *  held in parts, which is counted by identity (R84). (G29, R86) After the project's own edges come the documents the
   *  members' findings rest on (`resting`, `case-disclosures` R2: either role, one level deep), each once and none the
   *  project already cites, classified the same way; a capture the findings name alone, of a document holding several, is
   *  its pin. A case prepared from a question holds one edge, to the question, so these are the evidence's only rows.
   *  (K4609) Every document row, `undetermined` included, also carries `bundle_sha`, the document's head at this act. */
  #caseCitations(project, members, resting = []) {
    const text = this.#liveText(project);
    const refs = text !== null ? (parseFrontmatter(text).data?.references || []) : [];
    /* C67 (T51; K4303): the project cites the findings of all its drafts; this case cites its own. An edge to a finding
       (an inquiry) stays only when that finding is a member of this case; a document's edge stays as before. */
    const isFinding = (t) => normalizeType(OBJECT_TYPES[t.split("-")[0]]) === "inquiry";
    const edges = (Array.isArray(refs) ? refs : []).filter((r) => r && typeof r === "object" && r.rel === "cites"
      && r.status !== "severed" && typeof r.target === "string" && r.target.trim()
      && (!isFinding(r.target.trim()) || (members || []).includes(r.target.trim())));
    const isDocument = (t) => normalizeType(OBJECT_TYPES[t.split("-")[0]]) === "information";
    /* R86: the documents the findings rest on, found by the captures `case-disclosures.restingCaptures` names among the
       registered captures of the documents the members' legs cite. */
    const cited = new Set(edges.map((r) => r.target.trim()));
    const restingDocs = new Map();
    const caps = [...new Set((resting || []).map((x) => x.capture))];
    const legTargets = (members || []).length ? new Set(this.#rows(
      `SELECT DISTINCT target_id AS t FROM inquiry_basis WHERE bundle_id IN (${(members || []).map(() => "?").join(",")})`,
      ...members).map((r) => r.t)) : new Set();
    for (let i = 0; i < caps.length; i += SELECTION_ID_CHUNK) {
      const part = caps.slice(i, i + SELECTION_ID_CHUNK);
      for (const r of this.#rows(`SELECT bundle_id, capture_sha FROM register WHERE capture_sha IN (${part.map(() => "?").join(",")})
                                  ORDER BY bundle_id, capture_sha`, ...part)) {
        if (!legTargets.has(r.bundle_id) || !isDocument(r.bundle_id) || cited.has(r.bundle_id)) continue;
        if (!restingDocs.has(r.bundle_id)) restingDocs.set(r.bundle_id, new Set());
        restingDocs.get(r.bundle_id).add(r.capture_sha);
      }
    }
    const docs = [...new Set([...edges.map((r) => r.target.trim()), ...restingDocs.keys()].filter(isDocument))];
    const held = new Map();
    const half = Math.floor(SELECTION_ID_CHUNK / 2);
    for (let i = 0; i < docs.length; i += half) {
      const part = docs.slice(i, i + half), qs = part.map(() => "?").join(",");
      for (const r of this.#rows(
        `SELECT bundle_id AS t, COUNT(DISTINCT capture_sha) AS n, MIN(capture_sha) AS one, MAX(whole) AS whole FROM (
           SELECT bundle_id, capture_sha, whole FROM register WHERE bundle_id IN (${qs})
           UNION ALL
           SELECT bundle_id, capture_sha, 0 AS whole FROM readings WHERE bundle_id IN (${qs}))
         GROUP BY bundle_id`, ...part, ...part)) held.set(r.t, { n: r.n, one: r.one, whole: Number(r.whole) === 1 });
    }
    /* R84: a document holding a capture in parts counts that capture once, by its whole (provenance R73): a part's row is
       a file of it. Only a bundle with a whole's row is asked again, so the batch above stays one read for the rest. */
    for (const [t, h] of held) {
      if (!h.whole) continue;
      const idents = new Set(this.provenance.capturesOf(t).map((c) => c.capture_sha));
      for (const r of this.#rows(`SELECT DISTINCT capture_sha FROM readings WHERE bundle_id=?`, t)) idents.add(r.capture_sha);
      held.set(t, { n: idents.size, one: [...idents].sort()[0] });
    }
    /* The findings' documents follow as edges of their own: pinned when the findings name one capture of several. */
    const found = [...restingDocs].map(([target, shas]) => ({ target,
      extent_capture: shas.size === 1 && (held.get(target)?.n ?? 0) > 1 ? [...shas][0] : null }));
    return [...edges, ...found].map((r) => {
      const t = r.target.trim();
      const pin = typeof r.extent_capture === "string" && /^[0-9a-f]{64}$/.test(r.extent_capture.trim())
        ? r.extent_capture.trim() : null;
      if (!isDocument(t)) return { target: t, version: "no_bytes", capture: null };
      /* K4609: a document's row also names the head the ceremony's evidence signature is over (ratification R4's
         `expectedSha`, the sha256 of its `bundle.md`), as it stands at this act; a capture's sha is not that head. */
      const bundle_sha = this.record.head(t)?.bundleSha ?? null;
      if (pin) return { target: t, version: "pinned", capture: pin, bundle_sha };
      const h = held.get(t);
      if (!h || !h.n) return { target: t, version: "no_capture", capture: null, bundle_sha };
      return h.n === 1 ? { target: t, version: "only_capture", capture: h.one, bundle_sha }
                       : { target: t, version: "undetermined", capture: null, bundle_sha };
    });
  }

  /** R40 — DEC-103: THE LENS THIS CASE WAS PRODUCED UNDER, READ WHOLE. Every statement in the effective set of the
   *  manifest frozen at this act (bias R13–R18, every page, read as the plane, `PLANE_VIEWER`, like the stamp beside it), each with each
   *  of its citations marked whether it may be printed: public material only, being a public web address
   *  (record-grammar's public-locator test, its R19) or a bundle or hash this copy has published (publication's
   *  registries: R12's `publishedTargets` for a bundle id; R40's `published_shas` and `published_bundles.bundle_sha` for
   *  a hash). Every other citation is handed on as withheld, so case-grammar R9 counts it and never writes it. Answers
   *  `{in_force, stated, statements: [{bundle, id, kind, subject, text, justification, citations: [{citation,
   *  printed}]}]}`; with no manifest in force, or one undetermined, no statement. */
  #lensStatements(project) {
    const read = (offset) => this.bias.biasManifest({ scope: "project", scopeId: project, viewer: PLANE_VIEWER,
                                                      limit: LENS_PAGE, offset });
    let page = read(0);
    if (!page || page.in_force !== true)
      return { in_force: page && page.in_force === null ? null : false,
               stated: page && page.in_force === null ? String(page.stated ?? "") : word("bias.manifest_force"),
               statements: [] };
    const all = [...(Array.isArray(page.statements) ? page.statements : [])];
    while (page.truncated && Array.isArray(page.statements) && page.statements.length) {
      page = read(all.length);
      all.push(...(Array.isArray(page.statements) ? page.statements : []));
    }
    const cited = (s) => (Array.isArray(s.citations) ? s.citations : [])
      .map((c) => (c == null ? "" : String(c).trim())).filter(Boolean);
    const asked = [...new Set(all.flatMap(cited).filter((c) => !isPublicHttpsLocator(c)))];
    const hashes = asked.filter((c) => /^[0-9a-f]{64}$/i.test(c)).map((c) => c.toLowerCase());
    const published = new Set();
    /* Each hash is bound twice, so half a chunk keeps the statement under D-36's ceiling. */
    const half = Math.floor(SEARCHED_CHUNK / 2);
    for (let i = 0; i < hashes.length; i += half) {
      const part = hashes.slice(i, i + half), marks = part.map(() => "?").join(",");
      for (const r of this.#rows(`SELECT sha256 AS h FROM published_shas WHERE sha256 IN (${marks})
                                  UNION SELECT bundle_sha AS h FROM published_bundles WHERE bundle_sha IN (${marks})`,
                                 ...part, ...part)) published.add(String(r.h).toLowerCase());
    }
    const ids = asked.filter((c) => !/^[0-9a-f]{64}$/i.test(c));
    for (let i = 0; i < ids.length; i += PUBLISHED_TARGETS_CHUNK) {
      const t = this.publication.publishedTargets(ids.slice(i, i + PUBLISHED_TARGETS_CHUNK));
      for (const [id, e] of Object.entries((t && t.registry) || {}))
        if (e && e.editions && Object.keys(e.editions).length) published.add(id);
    }
    const isPublic = (c) => isPublicHttpsLocator(c) || published.has(/^[0-9a-f]{64}$/i.test(c) ? c.toLowerCase() : c);
    return { in_force: true, stated: null,
             statements: all.map((s) => ({ bundle: s.bundle_id, id: s.statement_id, kind: s.kind, subject: s.subject,
                                           text: s.text, justification: s.justification,
                                           citations: cited(s).map((c) => ({ citation: c, printed: isPublic(c) })) })) };
  }

  /** R17 — THE CASE'S OWN SUBJECTS, GATHERED DOWNWARD (`OBSERVATION-LOG-DESIGN.md` §8 row 4). `searchedSection` decides
   *  what the answers MEAN; this decides WHAT IS ASKED ABOUT, which is the half a dishonest section gets wrong. The
   *  direction is one-way: subjects come DOWN from the members (inquiry R40's `inquiry_basis.content_id` → content R45's
   *  `content.capture_sha` → provenance R48's `captured_locators.address_norm`), and the log (observation-log R29) is
   *  consulted only to ask what became of a subject the case already named.
   *
   *  A leg with no content row is a referent the case rests on that cannot be named at the content level, which is not
   *  a referent nobody looked at: counted as `unidentified`, capping its level at `partial`. The DOCUMENT level cannot
   *  say `never_looked`: every document-level subject is the address of a capture we hold, so possession IS the look
   *  (`pre_log` always). Past `SEARCHED_SUBJECT_MAX` captures the overflow is folded into `unidentified`. */
  #searchedForCase(members, at) {
    const roster = [...new Set((members || []).filter((m) => typeof m === "string" && m))];
    const chunked = (vals, fn) => { for (let i = 0; i < vals.length; i += SEARCHED_CHUNK) fn(vals.slice(i, i + SEARCHED_CHUNK)); };

    /* THE BASIS LEGS of the findings this case rests on; a member with no legs contributes nothing. */
    const contentIds = new Set();
    let legsUnresolved = 0;
    if (roster.length) chunked(roster, (part) => {
      const marks = part.map(() => "?").join(",");
      for (const r of this.#rows(`SELECT content_id FROM inquiry_basis WHERE bundle_id IN (${marks})`, ...part)) {
        if (typeof r.content_id === "string" && r.content_id) contentIds.add(r.content_id);
        else legsUnresolved += 1;   /* the nullable column, counted where it is met */
      }
    });

    /* THE CAPTURES THOSE LEGS NAME; a content id with no row is unresolved for the same reason a null one is. */
    const captures = new Set();
    let contentUnresolved = 0;
    if (contentIds.size) chunked([...contentIds], (part) => {
      const marks = part.map(() => "?").join(",");
      const seen = new Set();
      for (const r of this.#rows(`SELECT content_id, capture_sha FROM content WHERE content_id IN (${marks})`, ...part)) {
        seen.add(r.content_id);
        if (typeof r.capture_sha === "string" && r.capture_sha) captures.add(r.capture_sha);
      }
      contentUnresolved += part.filter((c) => !seen.has(c)).length;
    });

    const capList = [...captures].slice(0, SEARCHED_SUBJECT_MAX);
    const capOver = Math.max(0, captures.size - capList.length);

    /* THE ADDRESSES (the earliest fetch answers "was this looked for") AND THE REGISTRATION TIMES §5.1's order needs. */
    const addrOf = new Map();
    const registeredOf = new Map();
    if (capList.length) chunked(capList, (part) => {
      const marks = part.map(() => "?").join(",");
      for (const r of this.#rows(
        `SELECT capture_sha, address_norm, MIN(first_retrieved) AS first_retrieved
           FROM captured_locators WHERE capture_sha IN (${marks}) GROUP BY capture_sha`, ...part))
        if (typeof r.address_norm === "string" && r.address_norm) addrOf.set(r.capture_sha, r.address_norm);
      for (const r of this.#rows(`SELECT capture_sha, registered FROM register WHERE capture_sha IN (${marks})`, ...part))
        registeredOf.set(r.capture_sha, r.registered || null);
    });

    /* THE LOOKUP, BATCHED PER LEVEL: the latest row per subject, `MAX(seq) GROUP BY subject` narrowed by level and kind
       (the frontier's own shape), never a point read per subject. */
    const latestMap = (level, kind, subjects) => {
      const out = new Map();
      if (!subjects.length) return out;
      chunked(subjects, (part) => {
        const marks = part.map(() => "?").join(",");
        for (const r of this.#rows(
          `SELECT subject, state FROM observation_log
            WHERE seq IN (SELECT MAX(seq) FROM observation_log
                           WHERE level = ? AND subject_kind = ? AND subject IN (${marks})
                           GROUP BY subject)`, level, kind, ...part))
          out.set(r.subject, r.state ? String(r.state) : null);
      });
      return out;
    };

    const levels = [];
    /* DOCUMENT — addresses. `pre_log` always, never cause (3). The unresolved legs count here too: the chain to an
       address runs through the same missing row, so omitting them would report `no_subjects` about a case resting on
       referents it merely could not name. */
    {
      const addrs = capList.map((sha) => addrOf.get(sha)).filter(Boolean);
      const seen = latestMap("document", "address", addrs);
      const subjects = addrs.map((addr) => {
        const state = seen.get(addr) || null;
        return { subject: addr, state, cause: state ? null : "pre_log" };
      });
      const missingAddr = capList.filter((s) => !addrOf.has(s)).length;
      levels.push({ level: "document", subject_kind: "address", subjects,
                    unidentified: missingAddr + capOver + legsUnresolved + contentUnresolved });
    }
    /* CONTENT — captures, under §5.1's rule with the content level's pre-log evidence (`readings`). */
    {
      const seen = latestMap("content", "capture", capList);
      const subjects = capList.map((sha) => {
        const state = seen.get(sha) || null;
        return { subject: sha, state, cause: state ? null : this.#missingContentCause(sha, registeredOf.get(sha) || null) };
      });
      levels.push({ level: "content", subject_kind: "capture", subjects,
                    unidentified: legsUnresolved + contentUnresolved + capOver });
    }
    /* MEANING — the reader run over each capture. ONLY THE `capture` SUBJECT KIND: the references and entities inside a
       document are what a derivation would discover, so enumerating them from the case would mean enumerating them from
       the log, the one direction this computation refuses. */
    {
      const seen = latestMap("meaning", "capture", capList);
      const subjects = capList.map((sha) => {
        const state = seen.get(sha) || null;
        return { subject: sha, state, cause: state ? null : this.#missingMeaningCause(sha, registeredOf.get(sha) || null) };
      });
      levels.push({ level: "meaning", subject_kind: "capture", subjects,
                    unidentified: legsUnresolved + contentUnresolved + capOver });
    }
    return searchedSection({ at, subjectSource: "case_basis", levels });
  }

  /* REC-94: which of §5.1's causes explains a missing CONTENT-level row: observation-log's rule (its R11), asked with
     this level's pre-log evidence, a reading of the capture (extraction R58's `readings`). One indexed hit. */
  #missingContentCause(captureSha, registeredAt = null) {
    const hasReading = !!this.#one(`SELECT 1 x FROM readings WHERE capture_sha = ?`, captureSha);
    return this.observations.missingCauseAt("content", { hasArtifact: hasReading, registeredAt });
  }

  /* REC-95: the same at the MEANING level for a capture subject, whose pre-log evidence is also a reading; the case's
     searched section computes only the capture kind (above), so the reference and entity probes stay with the log's
     other readers. */
  #missingMeaningCause(captureSha, enteredAt = null) {
    const hasReading = !!this.#one(`SELECT 1 x FROM readings WHERE capture_sha = ?`, captureSha);
    return this.observations.missingCauseAt("meaning", { hasArtifact: hasReading, registeredAt: enteredAt });
  }

}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. This module holds no table (T47; N908; K2982:
 *  its four moved to `case-inputs`, its R11), so it declares nothing to record-core's purge. At creation it creates
 *  `case-account`'s instance (its R12) and `case-inputs`' (its R16) on the host, so those modules' tables exist and are
 *  declared at every boot before `plane` names them (the map's doubt 4); a declaration record-core refuses there is
 *  thrown by that module's factory, and no instance of this one is kept. */
export function caseAuthoringOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    c = new CaseAuthoring({ ...d, host, storage, record, membership });
    void c.account;
    void c.inputs;
    instances.set(host, c);
  }
  return c;
}

/* R56 (J2 (1)): an op that authors or pre-flights a case first gathers the calculations its chains reach (async), then
   runs the synchronous act with what it found. The facts are this arm's own: no body field can supply them. */
async function gathered(c, args, act) {
  return act(args, await c.calculationsAtPublication(args));
}

/* R7, R78: `newCase` from the query or the body, its string forms spelled out so `newCase=false` means false; absent
   stays absent (undefined), so a draft's own `newCase` is not overruled by a default the call never sent. */
function newCaseOf(q, b) {
  const v = q("newCase") != null ? q("newCase") : b.newCase;
  return v == null ? undefined : v === true || v === "true" || v === "1" || v === "yes";
}

/** R81 (T51; K4168, K4202; `op-declarations` R80, `op-grades` R49): the ops this module serves that the screens send,
 *  declared beside the ops map. Class, mutating, weight and description are the op's existing rows' (`op-declarations`,
 *  `op-grades`: the hand row's class and `mutating`; `publish`'s rung and `act.publish.does`; the two reads' `NON_ACTS`
 *  reasons, copied). `accepts` is `AUTHORED_FIELDS` and `ACT_FIELDS` less the stamps, so it cannot drift from what R65
 *  refuses; `requires` is the project and, of each field the act refuses without, that field or the draft that holds it
 *  (R78), and, for `publish`, the signer's confirmation (R76). `publishtensions` requires the project alone: for no finding
 *  it answers an empty list (R32). The stamps `viewer`, `author` and the door's `aiCred` are no fields. */
const ACCEPTED = Object.freeze([...new Set([...AUTHORED_FIELDS, ...ACT_FIELDS])].filter((f) => f !== "viewer" && f !== "author"));
const WORDS_OR_DRAFT = Object.freeze([["targets", "target", "draft"], ["roles", "draft"], ["statement", "draft"],
  ["subjectPosition", "draft"], ["subjectJustification", "draft"], ["excluded", "draft"], ["scope", "draft"],
  ["biasAcknowledgement", "draft"]]);
export const DECLARED_OPS = Object.freeze({
  publish: { classes: ["admin", "member", "probe"], mutating: true, weight: "terminal", description: "act.publish.does",
    fields: { accepts: ACCEPTED, requires: ["project", ...WORDS_OR_DRAFT, "tieAttested"] } },
  publishpreflight: { classes: ["admin", "member", "probe"], mutating: false, weight: "read",
    description: localize("case-authoring.declared.publishpreflight", "read: the publication ceremony's dry run — op=publish's first refusal, every other refusal reachable, and whether the case is ready, over the same arguments, rolled back; writes nothing"),
    fields: { accepts: ACCEPTED, requires: ["project", ...WORDS_OR_DRAFT] } },
  publishtensions: { classes: ["admin", "member", "probe"], mutating: false, weight: "read",
    description: localize("case-authoring.declared.publishtensions", "read: the contradictions a case must disclose before it is published, each side the publisher cannot see highlighted and withheld; writes nothing"),
    fields: { accepts: ACCEPTED, requires: ["project"] } },
});

/** The module's ops (K3), as entries of the plane's op map (`plane/store.mjs`). `viewer` and `author` are the control plane's stamps,
 *  read from the query and spread AFTER the body, so a caller's own copy is overwritten, never honoured. */
export function caseAuthoringOps(c, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  return {
    /* R1–R18. The BODY carries the authored material (an exclusion list and the roles map are what a query string
       cannot express honestly); `targets`, `caseId`, `project` and `draft` also arrive on the query as the one-line
       form a probe can reach, and `newCase` from either, its string forms spelled out so `newCase=false` means false. */
    publishcase: () => c.publishAct({ ...b,
      target: q("target") || b.target,
      targets: b.targets || q("targets") || null,
      caseId: q("caseId") || b.caseId || null,
      newCase: newCaseOf(q, b),
      project: q("project") || b.project || null,
      draft: q("draft") || b.draft || null,
      viewer: q("viewer"),
      author: q("author") }),
    /* R32 (N345): the ceremony's read before op=publish; `viewer` and `author` are the stamps, as op=publish's. */
    publishtensions: () => c.tensionsToDisclose({ ...b,
      target: q("target") || b.target,
      targets: b.targets || q("targets") || null,
      project: q("project") || b.project || null,
      viewer: q("viewer"),
      author: q("author") }),
    /* R34 (N364): the ceremony's pre-flight, over op=publish's own arguments and stamps; it writes nothing. The door
       stamps `aiCred` (the minted agent credential's token id and principal) beside `viewer` for an agent (N435); one
       that does not parse is still an agent's, so ratification's fences hold (fail closed). */
    publishpreflight: () => gathered(c, { ...b,
      target: q("target") || b.target,
      targets: b.targets || q("targets") || null,
      caseId: q("caseId") || b.caseId || null,
      newCase: newCaseOf(q, b),
      project: q("project") || b.project || null,
      draft: q("draft") || b.draft || null,
      viewer: q("aiCred") ? { stamp: q("viewer"), aiCred: (() => {
        try { const v = JSON.parse(q("aiCred")); return v && typeof v === "object" ? v : {}; } catch { return {}; }
      })() } : q("viewer"),
      author: q("author") }, (a, f) => c.publishPreflight(a, f)),
  };
}
