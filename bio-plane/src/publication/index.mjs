/* publication — the published record (requirements: `build/requirements/publication.md`; BIO_Publication_v0_1.md
 * §1–§4, §6A.2, §6A.3, §7; Membership v2 §8). Publication is the one irreversible act: what the group stands behind
 * leaves the instance, content-addressed and signed, so a stranger can verify without this instance that the group
 * said what it claims and rested it on what it says. This module holds every case document (unsigned and signed) and
 * the published projection, and answers which case editions pin a finding and what each committed; the verified working-corpus export is `corpus-export`'s (K1024), which this module creates and no
 * longer answers for (N483: its ops are corpus-export's `corpusExportOps`). The two signing ceremonies (`ratification`)
 * and preparing a case (`case-authoring`) write through it (R21, R22), so one module keeps R24: nothing updates or deletes a published
 * row, a signed document or a published object.
 *
 * Extracted from the legacy modules (T8, layer 8; K3, K31, K57, K94, K102): `store.mjs` (the case relation and the
 * revision flags, the case document reads, the MK-7 attribution act, the verified export and its log (moved on to
 * `corpus-export` by the second split, K1024), the pinning helpers and the commits, and the dispatch entries), `index.mjs` (the door's `caseflags` and `casedocument` arms,
 * `./door.mjs`) and the check catalogue (C-92.1–.9, now `./checks.mjs`, with C-122.1 new there). Its tables are
 * `./schema.mjs`. It reads the record's shared grammar (the front-matter parser, actor identity, the one SHA-256, the
 * section locator) from `record-grammar`, never from the catalogue (T19, rule 1). The legacy code's comments moved with it; where one names a store
 * method that is not this module's (`publishCase`, `ratifyCaseDocument`, `publish`, `#caseDocumentText`,
 * `#reauthorAcknowledgements`) it names the act as it stands.
 *
 * Split four ways for size (K617, K651): the case document's grammar is `case-grammar`'s (read from there and
 * re-exported unchanged); the published record served without a credential (verify, the lists, the published case,
 * the manifest) is `public-read`'s, which reads this module's tables under R40 and calls its services R53–R55; a
 * project's stage is `project-stage`'s. Every table and every write stays here. `./worker.mjs`, `../container.mjs`
 * and `../inband.mjs` are `public-read`'s (K697, K702); `../deliverer.mjs` (R14) is this module's.
 *
 * Split a fourth time for size (K617, K1505; T33-62, T33-63): the case relation and revision flags, the tensions after
 * publication and observation attribution are `case-tensions`', with their three tables and the C-92 rows. This module
 * creates it and registers with it the provider its moved code reads this module's tables and splice through (R61).
 * Since T35 (N597) it serves none of case-tensions' names and re-exports none: each importer reads case-tensions
 * directly. Since T36 (N597, K1643) `caseRelation` is gone too: every reader of a case relation reads case-tensions'.
 *
 * T34 (T34-44, T34-79): the set-wide read of the court-order stamps (R64), the group's self-description as the public is
 * told it (R65), and publishing at a set time (was R66–R71, R74; `publish-schedule`'s since T41, below). Case-tensions'
 * ops are the plane's to spread since T33-90 (N597); this module's map no longer spreads them.
 *
 * T35 (T35-54): the published criteria (R72; N649): at a case edition's commit, each standard its members' legs target,
 * read from `standards` (and the body's name from `entities`), frozen on the edition's row: a benchmark labeled "not
 * binding on" its body, a copyrighted standard by its edition, citation and access with only the passages relied on.
 * The waiting edition read `case-authoring` calls (was R74) and C-122.5 (was R33's) moved with publishing at a set
 * time; the review copy's secret read from the request body, never the address (R73, `./door.mjs`; F1).
 *
 * T36 (T36-26): the address's secret admits nothing and its fingerprint reaches the store op in the store request's
 * body, never its address (R73; K2111); `criteriaFor` answers the criteria a commit would record, for case-authoring's
 * pre-flight (R75; N717, K2129).
 *
 * T37 (T37-18): each criteria row freezes `captures`, only the captures holding its passages that the edition carries
 * (R72; N763, K2140), so case-checker judges a copyrighted text carried offline; and the commit refuses a photo whose
 * marks changed since the case was prepared, `PHOTO_MARKS_CHANGED_SINCE` (R57, C-122.6; N757, DEC-180 (4), K2206).
 *
 * T38 (T38-29): C-122.6's translation is `words.json`'s `photo.refused.changed`, verbatim; a mark withdrawn since the
 * case was prepared (case-carriage R14) and a photo carried whole are such changes, as case-carriage R13 answers them
 * (R33, R57; N788, DEC-183 (4), K2291).
 *
 * T39 (T39-11): the commit refuses a member document whose publication copy is not the one the case was prepared with,
 * `DOCUMENT_COPY_CHANGED_SINCE` (R57, C-122.7; N806, K2333), from case-carriage R13's `document` rows; its photo rows
 * stay C-122.6, and both are answered when both hold.
 *
 * T41 (T41-36): C-122.6's words are `words.json`'s `photo.refused.changed.signed` (DEC-187 (4)) and C-122.7's
 * `document.refused.changed` (DEC-188 (7)), read by key (R33); the published-work fact membership's handle guard asks
 * (R76; DEC-186 (1)); and split a fifth time for size (N823; K617, K624, K2438): publishing at a set time (was R66–R69,
 * R71, R74, the table `scheduled_editions` and C-122.5) is `publish-schedule`'s, which fills the source of waiting
 * editions (R77; K2529: `isWaiting`, `signedAtOf`, `signerOf`) through which R21's waiting clause, R70's set-time
 * signing instant and R76 read, this module naming its table in no SQL; and a commit no member signs reads the criteria as a machine
 * viewer, never the founder's (K2483, D54).
 *
 * T45 (T45-17; N892, N893): nothing of a counsel matter is published. The commit refuses, before its own other
 * refusals, a case whose owning project or any member finding's project `project-roster` answers `counsel_matter`
 * (R78, C-122.8 `COUNSEL_MATTER_NOT_PUBLISHED`, the one row `case-authoring` and `docket` answer through this module's
 * export); `case-check` joins R40's readers.
 *
 * REACHED as `publicationOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps`, returned to every later caller. At creation it creates its tables and declares them to
 * record-core (R31; plan T33 Rules (6): each with its classes), registers with record-core the published registry as
 * audit context (its R69, for the audit's C-21.2) and its opaque case ids as mint-ledger seeds (its R70, K783),
 * registers the facts `publishedRegistry` and `publishedCaseRegistry` with promotion (R7; the registration rule, K206,
 * N152), creates `case-tensions` and registers its provider (R61), and registers a case's cited parts and the ratified
 * cases (R41, R43) with reevaluation (its R26, K359). A later module fills the court-order source (R62, K1632).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `transact`, `head`, `readFile`, `textAtSha` (R60), `declarePurge`, the
 *                                   `bundles` table (R21's type column, the standing test);
 *                                   `viewerPredicate`, `memberFacts`; `registerStep`, `registerFact`, the fact
 *                                   `producingGroup`.
 *   credentials    `attestingKeys` (its R11; R2's signers), reached lazily (K757).
 *   inquiry        `exclusionsNaming` (R12).
 *   caseTensions   `attributionFacts` (R2), `dischargeCaseFlags` (R22), the provider registration (R61); created at
 *                  creation on the same host with this module's record, membership, promotion and clock, a given
 *                  `basisVersions`, `contradiction` and `capture` forwarded to it (test injection), and the provider
 *                  (R61) registered with it.
 *   caseCarriage   `holdMaterials`, `heldMaterialsOf`, `publishedMaterialText`, `acceptedWorkLapsed`, `sourcesLapsed`
 *                  (its R1–R5) and `marksLapsed` (its R13), for R51, R57 and R59 (N532, N757); created at creation with this module's storage, record,
 *                  membership, promotion and clock, so its two tables exist and are declared at every boot (its R6). A
 *                  given `sources`, `acceptedWork` or `extraction` is forwarded to it (test injection), and a given
 *                  `bucket` and `store` (T37, K2226: the evidence bucket and namespace its R11's obscured copy needs).
 *   reevaluation   `registerCaseParts` (its R26), at creation only (R41, R43).
 *   standards      `standardRead` (its R5) and `bindsAt` (its R43), at a case edition's commit only (R72).
 *   entities       `readEntity` (its R5): a criteria row's body by name (R72).
 *   roster         project-roster's `projectScope` (its R23), at a case edition's commit only (R78); reached lazily as
 *                  `projectRosterOf(host)` on this module's record and membership unless given.
 *   corpusExport   created at creation with this module's clock, so `export_log` exists and is declared at every boot
 *                  (its R4); its ops are spread by the plane's op map (`corpusExportOps`, N483), and nothing here calls it.
 *   now            the clock for the instants it writes, an ISO string (default: the wall clock).
 *
 * READ CONTRACTS it joins in its own SQL: record-core's `bundles` (R21's type column, the standing test),
 * provenance's `register` (R42's captures) and content's `content` (its R45; R72's `captures`). */

import { recordOf, instantOrder } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { parseFrontmatter, createSha256, sectionText as caseSectionText,
         BUNDLE_ID_RE } from "../record-grammar/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { delivererOf } from "../deliverer.mjs";
import { rowOf } from "./checks.mjs";
import { PUBLICATION_TABLES, PUBLICATION_EXEMPT, PUBLICATION_DECLARATIONS, migratePublication,
         registerCaseDocumentSha, caseDocumentPath, ATTESTATION_SHA_UPSERT } from "./schema.mjs";
import { corpusExportOf } from "../corpus-export/index.mjs";
import { caseCarriageOf } from "../case-carriage/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
/* The case document's grammar is `case-grammar`'s (K651): the formats and predicates, the /5 blocks and tension
   section, the attribution run's text, the section locators, the signed citations and the edge set a finding rests on.
   This module reads them from there and re-exports, unchanged, every name it exported before the split, so its
   importers import exactly what they imported. */
import { caseDocumentStatesMemberBlocks, caseDocumentBlocks, SECTIONS, REAUTHORABLE_SECTIONS, signedCitations,
         publishedGraphEdges, caseDocumentRequiresMaterials, calculationsOf, timelineOf,
         caseFilePath, materialsOf } from "../case-grammar/index.mjs";

export { CASE_SOURCES_CHECKS, rowOf as publicationRowOf } from "./checks.mjs";
export { WORDS, caseWordsOf, lensClosingSentencesOf } from "../case-grammar/index.mjs";
export { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3,
         CASE_DOCUMENT_FORMAT_V2,
         CASE_DOCUMENT_FORMAT_LEGACY, CASE_DOCUMENT_FORMATS_ACCEPTED, caseDocumentStatesMemberBlocks,
         caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures, caseDocumentRequiresTensionSection,
         caseTensionsOf, TENSION_STATE_WORDS, TENSION_HIGHLIGHT_SENTENCE, TENSION_DEPTH_SENTENCE,
         TENSIONS_PREDATE_SENTENCE, TENSIONS_UNREADABLE_SENTENCE,
         caseDocumentBlocks, captureBlockLines, sourceBlockLines, sourceStatement, unnamedSourceStatement,
         CAPTURE_FIELDS, ACKNOWLEDGEMENT_FIELDS, SOURCE_FIELDS, SOURCE_BASES, BLOCKS_PREDATE_SENTENCE,
         BLOCK_UNREADABLE_SENTENCE, NOT_RECORDED_STATED, REAUTHORABLE_SECTIONS, ATTRIBUTION_LEVELS,
         ATTRIBUTION_PROSE_HEAD, attributionFrontmatterLines, attributionBodyLines,
         publishedGraphEdges } from "../case-grammar/index.mjs";
export { PUBLICATION_SCHEMA, PUBLICATION_TABLES, PUBLICATION_EXEMPT, PUBLICATION_DECLARATIONS,
         caseDocumentPath } from "./schema.mjs";

/** R62 (K1480): the effects a court order may have on a ratified edition. */
export const EDITION_STAMP_EFFECTS = Object.freeze(["remove", "redact", "seal", "unseal"]);
/** R37: the ratified editions one `publishedEditionsOf` read answers. */
export const EDITIONS_OF_MAX = 500;
/** R21 (G47; K4666): the most a case document's text may be, in UTF-8 bytes. A protective bound, above the 1 MiB a stored
 *  row value keeps to (K4639) and 0.5 MiB under the platform's 2,098,176 B bound on a bound value; BOB reports it (K1881). */
export const CASE_DOCUMENT_BYTES_MAX = 1572864;
const utf8Exact = (t) => new TextEncoder().encode(t).length;
/** R15 (G54; K4426, K4565, K4566): the case file's ledger on `published_cases`. The states a caller writes (`stopped` is
 *  the writer's own: it follows the bound below), the steps an attempt names (`why.step`; the log's `step`), and the
 *  provisional constants the sweep's backoff and bound are made of (set by the job; pinned by `g54-casefile.test.mjs`). */
export const CASEFILE_STATES = Object.freeze(["building", "failed", "stopped", "built"]);
export const CASEFILE_STEPS = Object.freeze(["facts", "copy", "materials", "build", "bucket_put", "quartet", "record", "manifest_put"]);
/** `MATERIAL_MISSING` failures in a row, with the evidence store's absence confirmed, after which an edition is `stopped`. */
export const CASEFILE_MISSING_MAX_ATTEMPTS = 6;
/** A never-attempted edition is due this long after `ratified_at`, so a sweep does not race the request still copying. */
export const CASEFILE_GRACE_MS = 120000;
/** A `building` is waited on at least this long; a `failed` waits `min(FIRST * 2^(attempts-1), MAX)`. */
export const CASEFILE_BUILDING_WAIT_MS = 120000;
export const CASEFILE_BACKOFF_FIRST_MS = 15000;
export const CASEFILE_BACKOFF_MAX_MS = 3600000;
/** The editions one `caseFilesOwed` read answers at most, and the bound on a stored `casefile_why`, in UTF-8 bytes, and on
 *  the error name and message it carries, in characters (the row bound is 2,098,176 B). */
export const CASEFILES_OWED_MAX = 100;
export const CASEFILE_WHY_BYTES_MAX = 1024;
export const CASEFILE_TEXT_MAX = 160;
const CASEFILE_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;
/** R15 (G54): a caller's `why`, reduced to its known keys and cut to the bounds; null when it names no code or step. */
function caseFileWhy(why, bounded = true) {
  if (!why || typeof why !== "object") return null;
  if (typeof why.code !== "string" || !CASEFILE_CODE.test(why.code) || !CASEFILE_STEPS.includes(why.step)) return null;
  const out = { code: why.code, step: why.step };
  for (const k of ["error", "detail"]) if (typeof why[k] === "string" && why[k]) out[k] = why[k].slice(0, CASEFILE_TEXT_MAX);
  for (const k of ["bytes", "files", "run"]) if (Number.isInteger(why[k]) && why[k] >= 0) out[k] = why[k];
  if (bounded) for (const k of ["detail", "error"])
    if (new TextEncoder().encode(JSON.stringify(out)).length > CASEFILE_WHY_BYTES_MAX) delete out[k];
  return out;
}
const backoffMs = (attempts) => Math.min(CASEFILE_BACKOFF_FIRST_MS * 2 ** (Math.max(1, Number(attempts) || 1) - 1), CASEFILE_BACKOFF_MAX_MS);
/** R41: the cited parts one `caseCitedParts` read answers. */
export const CITED_PARTS_MAX = 1000;
/** R42, R43: the page of `restingCapturesOf` and of `ratifiedCases`, its default and its ceiling. */
export const RESTING_CAPTURES_MAX = 1000;
export const RATIFIED_CASES_MAX = 1000;
/** R42 (N315, K380): the resting findings one capture answers, and those one page answers in all. */
export const RESTING_FINDINGS_PER_CAPTURE = 200;
export const RESTING_FINDINGS_PER_PAGE = 10000;
/** R38: the pins one `ratifiedFindingsRestingOn` page reads, its default and its ceiling. */
export const RESTING_PINS_MAX = 1000;
/* A caller's page size: a whole number of rows, floored, clamped to 1–max, the default when absent or not a number. */
const pageOf = (limit, max) => Math.max(1, Math.min(Math.floor(Number(limit)) || max, max));
/* R38: a pin cursor `<case>#<member>#<sha>` as its three keys, the case up to the first `#` and the sha after the last
   (a sha is hex); absent, the start. A string that is not a pin cursor is read as a case id alone: the page starts
   after that case. */
function pinCursor(after) {
  const s = typeof after === "string" ? after : "";
  const i = s.indexOf("#"), j = s.lastIndexOf("#");
  if (i < 0 || j === i) return [s, "\u{10FFFF}", ""];
  return [s.slice(0, i), s.slice(i + 1, j), s.slice(j + 1)];
}

/* R41 (C-41.15's vocabulary): the citation versions that name the capture a case edition cited. */
const CITATION_NAMES_CAPTURE = Object.freeze(["pinned", "only_capture"]);
/* CPDF-10: a column this module WROTE as JSON, read back; null rather than a throw on a malformed value. */
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const HEX64 = /^[0-9a-f]{64}$/;
/* R72: a leg's target that names a held standard (inquiry-grammar R13): a bundle id of the `STD` prefix, slug included. */
const isStandardId = (v) => BUNDLE_ID_RE.test(v) && v.startsWith("STD-");
/* R72: what an edition committed before T35 states of its criteria. */
const CRITERIA_NOT_RECORDED = word("public-read.criteria_recorded_edition");
/* R72 (DEC-145 (6)): a standard's access in the members' words. */
const ACCESS_WORDS = Object.freeze({ free: word("label.standardaccess.free"), reading_room: word("label.standardaccess.reading_room"),
                                     paywalled: word("label.standardaccess.paywalled") });
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
/* R77 (K2438, K2529): the doors the source of waiting editions gives. */
const WAITING_DOORS = Object.freeze(["isWaiting", "signedAtOf", "signerOf"]);
/* K2483 (D54): the viewer of an internal read that no member makes (R72's criteria with no signer), a machine one. */
const MACHINE_VIEWER = "class:daemon";
const shaOf = (text) => createSha256().update(new TextEncoder().encode(String(text))).hex();

/* R23 (K240, K244): the doors a review provider gives, and the answer each gives when no module has registered one: no
   draft reads, no grant admits, no identity or edition is stated, and the dead answer is a bare NO_REVIEW_COPY refusal;
   `case-authoring` (its R9) and `case-inputs` (every grant door of its R1; T47, N908) read it through `reviewProvider()`.
   It carries no catalogue row: review holds C-87 and is not a use of this module, and this answers only while no
   module has filled R23. */
const REVIEW_DOORS = Object.freeze(["draftForMember", "draftIdentity", "caseIdentitySentence", "statedEdition",
                                    "liveGrant", "grantAdmitsCaseEdition", "deadAnswer"]);
const NO_REVIEW_PROVIDER = Object.freeze({
  registered: false, module: null,
  draftForMember: () => null, draftIdentity: () => null, caseIdentitySentence: () => null, statedEdition: () => null,
  liveGrant: () => null, grantAdmitsCaseEdition: () => false,
  deadAnswer: () => ({ ok: false, reason: "NO_REVIEW_COPY", code: "NO_REVIEW_COPY" }),
  detail: localize("publication.index.no_module_has_registered_the", "no module has registered the review provider, so no grant admits and no draft is read through it"),
});

/* R78: what a refused counsel-matter commit says, from its parts: the project, the findings made in a counsel matter,
   or both. The closing sentence is one for all of them. */
function counselDetail(counsel) {
  const list = counsel.findings.join(", "), many = counsel.findings.length > 1;
  const lead = counsel.project
    ? (counsel.findings.length
        ? (many ? localize("publication.index.the_project_this_case_belongs_were",
                           "the project this case belongs to is a counsel matter, and {findings} were made in a counsel matter", { findings: list })
                : localize("publication.index.the_project_this_case_belongs_was",
                           "the project this case belongs to is a counsel matter, and {findings} was made in a counsel matter", { findings: list }))
        : localize("publication.index.the_project_this_case_belongs", "the project this case belongs to is a counsel matter"))
    : (counsel.findings.length
        ? (many ? localize("publication.index.findings_were_made_in_a", "{findings} were made in a counsel matter", { findings: list })
                : localize("publication.index.findings_was_made_in_a", "{findings} was made in a counsel matter", { findings: list }))
        : "");
  return `${lead}${localize("publication.index.a_counsel_matter_is_never", ". A counsel matter is never published, so nothing was committed.")}`;
}

/* THE ONE "NO SUCH CASE DOCUMENT" ANSWER (REC-130). Both the genuinely-absent
   branch and the no-standing branch return THIS, so "does not exist" and "you
   may not see it" are the same bytes by construction rather than by care. */
function noCaseDocument(id, ed) {
  return { ok: false, reason: "NO_CASE_DOCUMENT", caseId: id, edition: ed,
           detail: localize("publication.index.no_case_document_has_been", "no case document has been authored for {id} edition {ed}. A case document is written by op=publish, which is the act that authors the assertions it carries — this plane does not compose one.", { id: String(id), ed: String(ed) }) };
}

export class Publication {
  #deps;
  #review = null;        // R23: {module, ...doors}, filled once
  #orders = null;        // R62 (K1632): {module, courtOrderOf}, filled once by docket
  #waiting = null;       // R77 (K2438, K2529): {module, isWaiting, signedAtOf, signerOf}, filled once by publish-schedule
  purgeDeclaration = null;   // R31: record-core's answer to this module's purge declaration, set at creation
  handleGuard = null;        // R76: membership's answer to this module's handle guard registration, set at creation

  constructor({ storage, record, membership, promotion, host = null, inquiry = null, basisVersions = null,
                contradiction = null, sources = null, credentials = null, corpusExport = null, acceptedWork = null,
                capture = null, extraction = null, standards = null, entities = null, bucket = null, store = null,
                roster = null, now = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.#deps = { host, storage, inquiry, basisVersions, contradiction, sources, credentials, corpusExport, acceptedWork,
                   capture, extraction, standards, entities, bucket, store, roster };
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get inquiry() { return this.#deps.inquiry ||= inquiryOf(this.#deps.host); }
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host); }
  /* R72: read at a case edition's commit only. */
  get standards() {
    return this.#deps.standards ||= standardsOf(this.#deps.host, { record: this.record, membership: this.membership,
                                                                   promotion: this.promotion });
  }
  /* R78: read at a case edition's commit only. */
  get roster() {
    return this.#deps.roster ||= projectRosterOf(this.#deps.host, { record: this.record, membership: this.membership });
  }
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get credentials() {
    return this.#deps.credentials ||= credentialsOf(this.#deps.host, { record: this.record, membership: this.membership });
  }
  /* T33-63 (K1505, K1634): case-tensions, one per host, forwarded the uses a test gave this module; its provider is
     registered by the factory below. */
  get caseTensionsModule() {
    const { host, storage, basisVersions, contradiction, capture } = this.#deps;
    return caseTensionsOf(host, { storage, record: this.record, membership: this.membership, promotion: this.promotion,
                                  now: this.now, ...(basisVersions ? { basisVersions } : {}),
                                  ...(contradiction ? { contradiction } : {}), ...(capture ? { capture } : {}) });
  }
  /* N532: case-carriage, one per host, forwarded the uses a test gave this module (its Suggestions' factory). */
  get caseCarriage() {
    const { host, storage, sources, acceptedWork, extraction, bucket, store } = this.#deps;
    /* (T37; K2226) the evidence bucket and the store's namespace, when given, so case-carriage holds an obscured copy
       (its R11); the plane passes them. */
    return caseCarriageOf(host, { storage, record: this.record, membership: this.membership, promotion: this.promotion,
                                  now: this.now, ...(sources ? { sources } : {}), ...(acceptedWork ? { acceptedWork } : {}),
                                  ...(extraction ? { extraction } : {}), ...(bucket ? { bucket } : {}),
                                  ...(store != null ? { store } : {}) });
  }
  get corpusExport() {
    return this.#deps.corpusExport ||= corpusExportOf(this.#deps.host, { storage: this.#deps.storage, record: this.record,
                                                                        now: this.now });
  }

  migrate() { migratePublication(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #when() { const w = this.now(); return typeof w === "string" && w ? w : new Date().toISOString(); }

  /* A held bundle's current `bundle_sha`, from record-core (R41), or null. */
  #headRow(bundleId) { const s = this.#headSha(bundleId); return s ? { bundle_sha: s } : null; }

  #headSha(bundleId) {
    let h = null;
    try { h = this.record.head(bundleId); } catch { h = null; }
    return h && typeof h.bundleSha === "string" ? h.bundleSha : null;
  }

  /* ---------------------------------------------------------------- R23: the review provider */

  /** R23 (K240): a later module fills, once at start, the review doors this module, `case-authoring` and `case-inputs`
   *  (T47, N908) read:
   *  `draftForMember(id, viewer)` (a draft the member may read, or null), `draftIdentity(draft)` (its case identity),
   *  `caseIdentitySentence(caseId, edition, newCase)` and `statedEdition(identity, newCase)` (the sentence and edition a
   *  draft states), `liveGrant(secretSha)`, `grantAdmitsCaseEdition(secretSha, caseId, edition)` and `deadAnswer()`.
   *  Called as `registerReviewProvider(provider)` or `registerReviewProvider(module, provider)`. A second
   *  registration is refused `PROVIDER_DECLARED`; one missing a door `PROVIDER_MALFORMED`. `review` fills
   *  it (legacy-store did until its retirement). */
  registerReviewProvider(moduleOrProvider, maybeProvider = undefined) {
    const provider = typeof moduleOrProvider === "string" ? maybeProvider : moduleOrProvider;
    const module = typeof moduleOrProvider === "string" ? str(moduleOrProvider)
                 : str(provider && provider.module) || "unnamed";
    if (!provider || typeof provider !== "object" || !REVIEW_DOORS.every((d) => typeof provider[d] === "function"))
      return { ok: false, reason: "PROVIDER_MALFORMED",
               detail: localize("publication.index.the_review_provider_gives_the", "the review provider gives the doors {doors}", { doors: REVIEW_DOORS.join(", ") }) };
    if (this.#review)
      return { ok: false, reason: "PROVIDER_DECLARED", module: this.#review.module,
               detail: localize("publication.index.the_review_provider_is_already", "the review provider is already registered by {module}", { module: String(this.#review.module) }) };
    this.#review = { module, ...Object.fromEntries(REVIEW_DOORS.map((d) => [d, provider[d]])) };
    return { ok: true, module };
  }

  /** R23: the registered review provider, or the answer that none is: no draft reads, no grant admits, no identity is
   *  stated, and the dead answer is a bare NO_REVIEW_COPY. */
  reviewProvider() {
    return this.#review ? { registered: true, ...this.#review } : NO_REVIEW_PROVIDER;
  }

  /* ---------------------------------------------------------------- R62: the court-order source */

  /** R62 (K1632): `docket` fills, once at start, the one source that says whether a docket entry is a posted
   *  `court-order` entry of a case: `courtOrderOf(case, entry)` → `{seq, effect, editions, parts}` or null. Called as
   *  `registerOrderSource(source)` or `registerOrderSource(module, source)`; a second registration is refused
   *  `PROVIDER_DECLARED`, one without the door `PROVIDER_MALFORMED`. With none, every stamp is refused STAMP_NO_ORDER. */
  registerOrderSource(moduleOrSource, maybeSource = undefined) {
    const source = typeof moduleOrSource === "string" ? maybeSource : moduleOrSource;
    const module = typeof moduleOrSource === "string" ? str(moduleOrSource) : str(source && source.module) || "unnamed";
    if (!source || typeof source !== "object" || typeof source.courtOrderOf !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED", detail: localize("publication.index.the_court_order_source_gives", "the court-order source gives the door courtOrderOf") };
    if (this.#orders)
      return { ok: false, reason: "PROVIDER_DECLARED", module: this.#orders.module,
               detail: localize("publication.index.the_court_order_source_is", "the court-order source is already registered by {module}", { module: String(this.#orders.module) }) };
    this.#orders = { module, courtOrderOf: source.courtOrderOf };
    return { ok: true, module };
  }

  /** R62: whether a court-order source is registered, and by whom. */
  orderSource() { return this.#orders ? { registered: true, module: this.#orders.module } : { registered: false, module: null }; }

  /* ---------------------------------------------------------------- R77: the source of waiting editions */

  /** R77 (N823; K2438; K31's pattern): `publish-schedule` fills, once at start, the source of the editions it holds
   *  waiting to be published at a set time (its R8): `isWaiting(caseId, edition)` → whether that edition's document waits
   *  (R21: it counts as signed) and `signedAtOf(caseId, edition)` → the instant it was signed at the ceremony, or null
   *  (R70), and `signerOf(caseId, edition)` → `{signer, delivered_by}` while it waits, else null (R76; K2529). Called as `registerWaitingEditions(source)` or `registerWaitingEditions(module, source)`; a second
   *  registration is refused `PROVIDER_DECLARED`, one missing a door `PROVIDER_MALFORMED`, each registering nothing.
   *  With none, no edition waits and no signing instant is answered. No SQL of this module names its table. */
  registerWaitingEditions(moduleOrSource, maybeSource = undefined) {
    const source = typeof moduleOrSource === "string" ? maybeSource : moduleOrSource;
    const module = typeof moduleOrSource === "string" ? str(moduleOrSource) : str(source && source.module) || "unnamed";
    if (!source || typeof source !== "object" || !WAITING_DOORS.every((d) => typeof source[d] === "function"))
      return { ok: false, reason: "PROVIDER_MALFORMED", detail: localize("publication.index.the_waiting_editions_source_gives", "the waiting editions' source gives the doors {doors}", { doors: WAITING_DOORS.join(", ") }) };
    if (this.#waiting)
      return { ok: false, reason: "PROVIDER_DECLARED", module: this.#waiting.module,
               detail: localize("publication.index.the_waiting_editions_source_is", "the waiting editions' source is already registered by {module}", { module: String(this.#waiting.module) }) };
    this.#waiting = { module, ...Object.fromEntries(WAITING_DOORS.map((d) => [d, source[d]])) };
    return { ok: true, module };
  }

  /** R77: whether the waiting editions' source is registered, and by whom. */
  waitingSource() { return this.#waiting ? { registered: true, module: this.#waiting.module } : { registered: false, module: null }; }

  /* R21, R76 (R77): whether a case edition's document waits, asked of the source inside the caller's transaction; with
     none, false. A source that throws is answered as waiting, so R21 never replaces a document that may be signed. */
  #waits(caseId, edition) {
    let w = false;
    if (this.#waiting) { try { w = !!this.#waiting.isWaiting(caseId, Number(edition)); } catch { w = true; } }
    return w;
  }

  /* R70 (R77): the instant a waiting edition was signed, or null; with no source, or one that throws, null. */
  #signedAtOf(caseId, edition) {
    let at = null;
    if (this.#waiting) { try { at = this.#waiting.signedAtOf(caseId, Number(edition)); } catch { at = null; } }
    return str(at) || null;
  }

  /* ---------------------------------------------------------------- R65: the group's self-description, publicly */

  /** R65 (DEC-132 (3); K1541): exactly what `membership.groupDescription` (its R110) answers the public: the four texts
   *  while the group's latest chosen visibility is `public`, else `{description: null}`; never the history, who set it
   *  or when. No credential and no viewer; writes nothing and never throws. */
  publicGroupDescription() {
    try {
      const d = this.membership.groupDescription({ viewer: null });
      const x = d && d.description && typeof d.description === "object" ? d.description : null;
      return { description: x ? { kinds: x.kinds, otherKind: x.otherKind, focus: x.focus, purpose: x.purpose } : null };
    } catch { return { description: null }; }
  }

  /* ---------------------------------------------------------------- R76: a member's published work */

  /** R76 (DEC-186 (1); K2376 (4); membership R125): whether the member's work appears in a published case: `{case,
   *  edition}` for the earliest (by `signed_at`) case edition that is ratified (R22) or waits (R77's `isWaiting`: signed,
   *  its bytes fixed) whose signer, deliverer (R14) or preparer (`authored_by`) is the member, or whose document names
   *  the member's handle in a row that carries one (`material_attestations:` at `cover` or `name`, `member_ties:`, an
   *  attribution at `cover` or `name`); null when none; `{unreadable: true}` when its tables or the source cannot be
   *  read. A waiting edition's signer and deliverer are its source's `signerOf` (R77; K2529). Synchronous; writes nothing; never throws. Registered with `membership.registerHandleGuard` at start; while no handle is changed (membership R129, T46) no act of membership asks it. */
  publishedWorkOf({ memberId = null } = {}) {
    try {
      const id = str(memberId);
      if (!id) return null;
      const as = [id, `member:${id}`];
      let handle = "";
      try { const f = this.membership.memberFacts(id); handle = f ? str(f.handle) : ""; } catch { handle = ""; }
      const named = handle ? ` OR instr(d.text, ?) > 0` : "", byHandle = handle ? [handle] : [];
      const hits = [];
      for (const r of this.#rows(
        `SELECT d.case_id, d.edition, d.text, d.attestor_member, d.delivered_by, d.authored_by, d.ratified_at, c.signed_at
           FROM case_documents d JOIN published_cases c ON c.case_id=d.case_id AND c.edition=d.edition
          WHERE d.sig_armored IS NOT NULL AND (d.attestor_member IN (?,?) OR d.delivered_by=? OR d.authored_by IN (?,?)${named})`,
        ...as, as[1], ...as, ...byHandle))
        if (as.includes(r.attestor_member) || r.delivered_by === as[1] || as.includes(r.authored_by)
            || this.#namesHandle(r.text, handle))
          hits.push({ case: r.case_id, edition: Number(r.edition), at: r.signed_at || r.ratified_at || "" });
      /* a waiting edition: its document unsigned here, its signer and deliverer held by R77's source (K2529), asked of
         it directly, so a source that throws is the unreadable answer */
      const src = this.#waiting;
      for (const r of this.#rows(`SELECT case_id, edition, text, authored_by, authored_at FROM case_documents
                                   WHERE sig_armored IS NULL ORDER BY case_id, edition`)) {
        const ed = Number(r.edition);
        if (!src || !src.isWaiting(r.case_id, ed)) continue;
        const who = src.signerOf(r.case_id, ed);
        const signer = who && typeof who === "object" ? who.signer : null, by = who && typeof who === "object" ? who.delivered_by : null;
        if (!as.includes(signer) && by !== as[1] && !as.includes(r.authored_by) && !this.#namesHandle(r.text, handle)) continue;
        hits.push({ case: r.case_id, edition: ed, at: str(src.signedAtOf(r.case_id, ed)) || r.authored_at || "" });
      }
      if (!hits.length) return null;
      const ms = (t) => { const n = Date.parse(t); return Number.isFinite(n) ? n : Infinity; };
      hits.sort((a, b) => ms(a.at) - ms(b.at) || (a.case < b.case ? -1 : a.case > b.case ? 1 : a.edition - b.edition));
      return { case: hits[0].case, edition: hits[0].edition };
    } catch { return { unreadable: true }; }
  }

  /* R76: whether a case document names `handle` in a row that carries one: a member's `material_attestations:` row
     (its `by`) or an `observation_attributions:` row (its `shown`) at `cover` or `name`, or a `member_ties:` row (its
     `shown`, a handle only at `cover` or `name`). */
  #namesHandle(text, handle) {
    if (!handle) return false;
    const fm = parseFrontmatter(String(text ?? "")).data || {};
    const open = (r) => r && typeof r === "object" && (r.level === "cover" || r.level === "name");
    const rows = (k) => (Array.isArray(fm[k]) ? fm[k] : []);
    return rows("material_attestations").some((r) => open(r) && r.by_kind === "member" && String(r.by ?? "") === handle)
      || rows("observation_attributions").some((r) => open(r) && String(r.shown ?? "") === handle)
      || rows("member_ties").some((r) => open(r) && String(r.shown ?? "") === handle);
  }

  /* R1, R2: whether a live review grant admits exactly this case edition. With no provider, none does. */
  #grantAdmitsCaseEdition(secretSha, caseId, edition) {
    if (!secretSha) return false;
    try { return !!this.reviewProvider().grantAdmitsCaseEdition(secretSha, caseId, edition); } catch { return false; }
  }

  /* ---------------------------------------------------------------- R21: the case document's writes */

  /** R21: store one case edition's UNSIGNED document, replacing an unsigned one of the same edition and never a signed
   *  one (nor one R77's source answers waiting to be published at a set time, which counts as signed), and project its
   *  exclusions (R3). Inside the caller's transaction; never throws on a signed document; answers what the store holds
   *  after the call, read back, so a caller sees a write that did not happen. */
  storeCaseDocument({ case: caseArg = null, caseId = null, edition = null, text = null, author = null, at = null,
                      draft = null } = {}) {
    const id = str(caseArg ?? caseId), ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1 || typeof text !== "string" || !text)
      return { ok: false, reason: "MALFORMED", detail: localize("publication.index.a_case_document_names_its", "a case document names its case, a positive edition and its text") };
    /* R21 (G47): a text over the bound is refused before anything is read or written (the prefilter is 3 bytes a UTF-16 unit). */
    if (text.length * 3 > CASE_DOCUMENT_BYTES_MAX) {
      const bytes = utf8Exact(text);
      if (bytes > CASE_DOCUMENT_BYTES_MAX) return { ok: false, reason: "CASE_DOCUMENT_TOO_LARGE", bytes, bound: CASE_DOCUMENT_BYTES_MAX };
    }
    const docSha = shaOf(text);
    /* R21, R77: a document R77's source answers waiting counts as signed; asked first, in the caller's transaction. */
    const waits = this.#waits(id, ed);
    if (!waits)
      this.sql.exec(
        `INSERT INTO case_documents (case_id,edition,doc_sha,text,authored_at,authored_by,draft_id)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(case_id,edition) DO UPDATE SET doc_sha=excluded.doc_sha, text=excluded.text,
           authored_at=excluded.authored_at, authored_by=excluded.authored_by, draft_id=excluded.draft_id
         WHERE case_documents.sig_armored IS NULL`,
        id, ed, docSha, text, str(at) || this.#when(), author ?? null, draft ?? null);
    this.projectCaseExclusions(id, ed);
    const held = this.#one(`SELECT doc_sha, sig_armored FROM case_documents WHERE case_id=? AND edition=?`, id, ed);
    return { ok: true, case_id: id, edition: ed, doc_sha: held ? held.doc_sha : null,
             stored: !waits && !!held && held.doc_sha === docSha && !held.sig_armored };
  }

  /** R21: replace one named section's lines (`attribution`, `acknowledgements`: SECTIONS above) of an UNSIGNED case
   *  document still at `docSha`. `lines` is `{frontmatter, body}`, each an array of lines the section's owner built.
   *  Only those runs change; the document's hash moves, so a signature over the old bytes is refused as stale. A
   *  signed or moved document, or one carrying no such section, is left as it is and the answer says so. */
  reauthorSection({ case: caseArg = null, caseId = null, edition = null, docSha = null, section = null,
                    lines = null } = {}) {
    const id = str(caseArg ?? caseId), ed = Number(edition);
    const locate = typeof section === "string" && Object.prototype.hasOwnProperty.call(SECTIONS, section) ? SECTIONS[section] : null;
    const fmLines = lines && Array.isArray(lines.frontmatter) ? lines.frontmatter.map(String) : null;
    const bodyLines = lines && Array.isArray(lines.body) ? lines.body.map(String) : null;
    if (!id || !Number.isInteger(ed) || ed < 1 || !locate || !fmLines || !bodyLines)
      return { ok: false, reason: "MALFORMED",
               detail: localize("publication.index.a_reauthor_names_a_case", "a re-author names a case edition, one of the sections {sections}, and its front matter and body lines", { sections: REAUTHORABLE_SECTIONS.join(", ") }) };
    const doc = this.#one(`SELECT case_id, edition, doc_sha, text, sig_armored FROM case_documents
                            WHERE case_id=? AND edition=?`, id, ed);
    const held = { case_id: id, edition: ed, doc_sha: doc ? doc.doc_sha : null };
    if (!doc) return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_held") };
    if (doc.sig_armored) return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_signed") };
    /* R21, R77: a document waiting to be published at a set time is signed, and its signature is over these bytes. */
    if (this.#waits(id, ed))
      return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_signed_waits") };
    if (str(docSha) && doc.doc_sha !== str(docSha))
      return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_moved") };
    const all = doc.text.split("\n");
    const at = locate(all);
    if (!at) return { ok: true, ...held, reauthored: false, why: word("publication.why.case_document_carries", { section: String(section) }) };
    const text = [...all.slice(0, at.f0), ...fmLines, ...all.slice(at.f1, at.b0), ...bodyLines, ...all.slice(at.b1)].join("\n");
    if (text === doc.text) return { ok: true, ...held, reauthored: false };
    /* R21 (G47): a splice whose result is over the bound AND larger than the stored text is refused; one that shrinks or
       keeps an over-bound unsigned text is allowed, so a document stored before the bound can be mended. */
    if (text.length * 3 > CASE_DOCUMENT_BYTES_MAX) {
      const bytes = utf8Exact(text);
      if (bytes > CASE_DOCUMENT_BYTES_MAX && bytes > utf8Exact(doc.text))
        return { ok: true, ...held, reauthored: false, too_large: { bytes, bound: CASE_DOCUMENT_BYTES_MAX },
                 why: localize("publication.index.the_case_document_would_pass", "the case document would pass {bound} bytes ({bytes}) and was left as it was", { bytes, bound: CASE_DOCUMENT_BYTES_MAX }) };
    }
    const newSha = shaOf(text);
    this.sql.exec(`UPDATE case_documents SET doc_sha=?, text=? WHERE case_id=? AND edition=? AND doc_sha=?
                   AND sig_armored IS NULL`, newSha, text, id, ed, doc.doc_sha);
    this.projectCaseExclusions(id, ed);
    const now = this.#one(`SELECT doc_sha FROM case_documents WHERE case_id=? AND edition=?`, id, ed);
    return { ok: true, case_id: id, edition: ed, doc_sha: now ? now.doc_sha : null,
             reauthored: !!now && now.doc_sha === newSha,
             read: `op=casedocument&case=${id}&edition=${ed}` };
  }

  /* ---------------------------------------------------------------- R22, R35: the commits the ceremonies make */

  /** R22 (K241): commit one published edition of a bundle a member signed, inside the caller's transaction — the
   *  whole of what `op=ratify`'s committer did after its authority and scope arms (those are ratification's, R5):
   *  the rule-12 frozen pair read from the ratified case documents pinning these bytes, the edition's two refusals
   *  (`EDITION_EXISTS`, `EDITION_NOT_INCREMENTED`), `CASE_ASSERTION_DIVERGED` against every legacy case pinning it,
   *  the per-case discharge of revision flags (R5), the bar projection, the `published_bundles` row, every file's hash
   *  and the published graph (R35). Re-committing bytes already published at that edition is a retry and answers
   *  `existed: true`, writing nothing new. Who may publish is ratification's. */
  commitEdition({ bundleId = null, bundleSha = null, edition = null, title = null, completeness = null, strength = null,
                  memberCarriesBlocks = false, group = null, edges = [], shas = null, attestorKey = null,
                  attestorMember = null, gateVersion = null, sigArmored = null, deliveredBy = null, at = null } = {}) {
    if (!bundleId || !bundleSha || !attestorKey || !gateVersion || !sigArmored || !Array.isArray(shas))
      return { ok: false, reason: "MALFORMED" };
    const pinnedBy = this.pinnedCaseEditionsOf(bundleId, bundleSha);
    const top = this.#one(`SELECT MAX(edition) AS m FROM published_bundles WHERE bundle_id=?`, bundleId);
    const highest = top && top.m != null ? Number(top.m) : 0;
    /* Re-ratifying bytes that are ALREADY published is a retry, not a
       revision: it answers with the edition those bytes already carry rather
       than minting a second one for the same document. */
    const already = this.#one(
      `SELECT edition FROM published_bundles WHERE bundle_id=? AND bundle_sha=?`, bundleId, bundleSha);
    /* A CASE states its edition in the bytes the signature covers, so it
       arrives here and is checked. ANYTHING ELSE — an information bundle, a
       project — has no authored edition, and each ratification of new bytes
       is the next one: that is what closes D-144 for every bundle type
       rather than only for cases, since the defect was that a re-ratification
       DESTROYED the prior signature, attestor, time and gate version. */
    /* ===== D-442 / BIO_Publication_v0_1.md §3 rule 12 (b), (d): THE MEMBER'S EDITION AND ITS
       FROZEN PAIR FOLLOW THEIR BLOCK INTO THE CASE DOCUMENT. =====================================
       A finding published under rule 12 carries neither in its own bytes — op=publish wrote nothing
       on it — so they are read from the RATIFIED case documents that pin exactly these bytes
       (`pinnedBy`, the same relation the authority check above was decided on). Still committed
       FROM SIGNED BYTES, one signature over: #publishEdges' doctrine, as CASE-5b applied it to the
       bar. Several cases may pin one sha now, each with its own reading of it; where they agree the
       projection takes it, and where they do not it is left null and SAID (`strengthUndetermined`,
       the `barUndetermined` precedent below) — the per-case pair is always one read away, on
       op=publishedcase, from that case's own document. Legacy bytes keep the member's own blocks
       (rule 12 (e)): nothing here runs for them. */
    const docFrozen = !memberCarriesBlocks && pinnedBy.length
      ? this.frozenFromPinningDocuments(bundleId, bundleSha, pinnedBy) : null;
    const ed = Number.isInteger(edition) ? edition
             : already ? Number(already.edition)
             : docFrozen && Number.isInteger(docFrozen.edition) ? docFrozen.edition
             : highest + 1;
    const frozenStrength = memberCarriesBlocks ? strength : docFrozen ? docFrozen.strength : strength;
    const same = this.#one(`SELECT bundle_sha FROM published_bundles WHERE bundle_id=? AND edition=?`, bundleId, ed);
    const existed = !!(same && same.bundle_sha === bundleSha);
    if (same && !existed)
      return { ok: false, reason: "EDITION_EXISTS", bundleId, edition: ed, published: same.bundle_sha,
               detail: localize("publication.index.edition_of_is_already_published", "edition {ed} of {bundleId} is already published at a different sha. An edition is a SEPARATE DOCUMENT and answers forever: republishing different bytes under the same number would leave a reader who cited edition {ed} unable to say which one they read.", { ed: String(ed), bundleId: String(bundleId) }) };
    /* CASE-5 corrects the WORDING and not the rule: this refusal always keyed
       `published_bundles`, which is one BUNDLE's chain, and said "this case".
       Before the flip a bundle's chain and its case's editions were the same
       numbers so the sentence read true; after it they are not, and a member
       told "this case is published through edition 3" while ITS OWN chain is
       at 3 inside a case at edition 5 would go looking at the wrong altitude. */
    if (!existed && highest && ed <= highest)
      return { ok: false, reason: "EDITION_NOT_INCREMENTED", bundleId, edition: ed, highest,
               detail: localize("publication.index.is_published_through_edition_on", "{bundleId} is published through edition {highest} on its OWN version chain; a revision must increment it (DEC-12). Editions do not overwrite each other — edition {highest} keeps its own signature, attestor, time and gate version, and a new one joins it. This is the FINDING's edition, not the edition of any case it is a member of: since CASE-5 the two are separate numbers.", { bundleId: String(bundleId), highest: String(highest) }) };
    const now = str(at) || this.#when();
    /* REC-44: THE CASE ROW AND THE MEMBERSHIP, both written from the RATIFIED
       BYTES the control plane read out of the signed document and out of
       nothing else — #publishEdges' doctrine, for #publishEdges' reason: the
       working record moves under a published edition every time somebody
       promotes, and what the signature covers is what the published record
       must say.
       THE DIVERGENCE REFUSALS ARE THE POINT. Each member finding carries the
       case's scope, its completeness assertion and the whole roster in its
       OWN signed bytes, so the second member to ratify is checked against
       what the first one signed. Without this the case row would be whatever
       the last ratification happened to say, and two members could disagree
       about what case they are in with nothing noticing. */
    /* ===== CASE-5 / DEC-72: THE CASE'S EDITION IS THE CASE'S ==============
       `ed` above is THE MEMBER'S — it keys `published_bundles` and the two
       refusals that keep a finding's own chain honest. Every statement in the
       case block below keys `published_cases` / `published_case_members`
       instead, and those take the CASE's number, which arrives in the signed
       bytes as `case_edition`. Before the flip the two were ONE VARIABLE,
       which is the conflation `schema.mjs`'s `version_sha` comment names and
       the reason a finding could only ever belong to one case.

       IT COMES OUT OF THE SIGNED BYTES, like every other case fact here and
       for `#publishEdges`' reason: a case edition taken off the request would
       place a member into an edition nobody signed for, and the divergence
       refusals below would then be checking a number this plane chose against
       a roster the members did.

       FALLING BACK TO `ed` IS DEFENCE IN DEPTH AND NOT A POLICY DEFAULT, and
       the distinction is worth being exact about because a silent default is
       how a fact stops being authored. **The GATE for this field is C-2.8**,
       which requires `case_edition` on a published inquiry and names it when
       it is missing — the same door CASE-2 put `case_project` and `case_roles`
       behind, and for CASE-1's stated reason: a refusal belongs where it can
       say what is absent. What the fallback covers is the one case the gate
       cannot: bytes signed before this field existed, whose two numbers WERE
       equal, being replayed through the idempotent re-ratification path. For
       those bytes `ed` is the right answer and is the answer they already got.

       DECLARED OUTSIDE THE `if (caseId)` BLOCK BECAUSE `#caseEditionState` AT
       THE FOOT OF THIS METHOD NEEDS IT. That call is the ratify path's answer
       to "is this case edition complete", and reading it at the member's
       number was the same conflation one level up: a case at edition 2 whose
       new member is at its own edition 1 would have been asked about a case
       edition 1 that had already completed, and this act would have reported a
       DIFFERENT edition's state to the container assembler. */
    /* ===== CASE-5b / DEC-72: THE MEMBER NO LONGER COMMITS THE CASE ========

       EVERYTHING THIS BLOCK USED TO WRITE IS WRITTEN BY `ratifyCaseDocument`
       NOW, out of the one signed case document, BEFORE any member ratifies.
       `cases`, `published_cases` and the roster rows with their pins are all
       committed there. What is left here is the only thing that was ever
       genuinely this act's: confirming that THIS member, at THIS sha, is where
       the case said it would be.

       THE RELATION COMES OFF THE PIN AND NOT OFF THE BYTES. A finding's
       frontmatter no longer names a case at all, so "which case is this
       member of" is answered by the column CASE-3 built for it: is this
       finding's `bundle_sha` the `version_sha` some ratified roster froze?
       That is `#caseRelationOf`'s own question, which CASE-4 already asks from
       the member's side — one comparison over one column read two ways, and
       no second mechanism.

       FOUR DIVERGENCE REFUSALS WENT AWAY WITH THE FORMAT AND ONE STAYED, and
       the split is the whole argument. CASE_MEMBERSHIP_DIVERGED,
       CASE_ROLES_DIVERGED, CASE_PRODUCTION_DIVERGED and the case-side half of
       CASE_ASSERTION_DIVERGED existed to notice that N COPIES OF ONE FACT had
       stopped agreeing. There is one copy now and it cannot disagree with
       itself, so those are not fences that were lowered — they are fences
       around a hole that has been filled. CASE_ASSERTION_DIVERGED SURVIVES,
       under its own name, because it now compares two things that really are
       separate: what the CASE's signer asserted about the case's limits, and
       what THIS member's own signed bytes froze as theirs. Those are two
       members' signatures and they can genuinely differ.

       `CASE_ROSTER_EXCLUDES_SELF` IS GONE FOR THE SAME REASON AND IT IS WORTH
       NAMING: it refused a finding that claimed a case whose roster did not
       include it. A finding cannot claim a case any more. The shape it
       refused is unrepresentable rather than merely refused, which is the
       better outcome and the one this record reaches for everywhere else. */
    /* ===== D-309 / DEC-72 clause 6, 2026-09-10: SITE 2 OF CASE-6's NINE — THE
       CONTAINER'S `rel` LOOKUP, AND THE DECISION IS **ALL OF THEM**.

       WHAT IT USED TO DO: `ORDER BY m.case_id, m.edition DESC LIMIT 1` — the
       lowest-sorting case's highest edition. With the fence up that was one
       case and the sort was a formality. With the fence down it is a GUESS, and
       it is the worst-placed one of the nine, because THREE separate things
       keyed off it and each would have gone wrong differently:

         - `CASE_ASSERTION_DIVERGED` would have checked this member's signed
           completeness against ONE of the case documents it is a member of and
           let the others through unchecked. A divergence refusal that examines
           half its subject is a fence that has stopped biting.
         - `#dischargeCaseFlags` would have discharged ONE case's revision flags
           and left the other case's outstanding FOREVER with nothing to raise
           them again — set-but-never-clear inverted into never-set.
         - `published_bundles.required` would have frozen one case's bar onto a
           member two cases hold to two standards of evidence.

       SO IT IS A LOOP NOW, one iteration per CASE this member's bytes are
       pinned by, and each of the three is decided on its own below. The JOIN on
       `published_cases` is unchanged and still does its job: only case editions
       that exist are membership. `#soleCase` collapses several editions of ONE
       case to that case at its newest, so a single-case member takes exactly
       the path it took yesterday, with exactly one iteration. */
    const byCase = this.pinnedCaseEditionsOf(bundleId, bundleSha);
    const rel = this.soleCase(byCase);
    const caseId = rel ? rel.case_id : null;
    const cEd = rel ? Number(rel.edition) : ed;
    for (const one of byCase) {
      const oneEd = Number(one.edition);
      const cRow = this.#one(
        `SELECT completeness, bias_acknowledgement, bar FROM published_cases WHERE case_id=? AND edition=?`,
        one.case_id, oneEd);
      const cComp = completeness ? JSON.stringify(completeness) : null;
      /* ONE COMPARISON, AND IT IS BETWEEN TWO SIGNATURES RATHER THAN BETWEEN
         TWO COPIES. The case document's signer asserted what this case does
         not cover. This member's own bytes carry the completeness block
         `op=publish` wrote into them before their sha was taken. If a member
         re-promoted between the publishing act and their signature, editing
         that block, the two statements now differ — and a case edition asserts
         ONE completeness claim. Refused rather than reconciled, which is what
         the name has always meant. */
      /* D-309: CHECKED FOR EVERY CASE, not for one of them. Two case documents
         may each assert their own limits and this member's bytes must agree
         with BOTH — they are two signatures and either can genuinely differ. */
      /* D-442: ASKED ONLY OF A LEGACY (/1) CASE DOCUMENT. Under rule 12 a /2 document is the ONE
         place its completeness is stated and no member's bytes carry a copy to disagree with — so a
         legacy member (its own old block in its bytes) pinned by a NEW case would otherwise be
         refused for carrying another case's words, which is the very cross-case write rule 12
         removes, arriving as a refusal. */
      const legacyDoc = !this.caseDocMemberFrozen(one.case_id, oneEd);
      if (legacyDoc && cRow && cComp && (cRow.completeness ?? null) !== cComp)
        return { ok: false, reason: "CASE_ASSERTION_DIVERGED", bundleId, caseId: one.case_id, edition: oneEd,
                 detail: localize("publication.index.this_findings_signed_bytes_freeze", "this finding's signed bytes freeze a different completeness assertion for case {caseId} edition {ed} than the CASE DOCUMENT a member signed for it. A case edition asserts ONE completeness claim, and since CASE-5b that claim is signed once, in the case's own document — so a member whose bytes say something else has not been re-published through op=publish since the case was authored.", { caseId: String(one.case_id), ed: String(oneEd) }) };
      /* ==== CASE-4 / DEC-72: THE DISCHARGE. THE OWNING PROJECT HAS ACTED. ===
         *"New editions are each owning project's deliberate act."* A ratified
         edition of this case IS that act, and this is the moment it becomes
         real — the bytes are signed, the pin is written, the edition is on the
         record. So the outstanding flags on THIS CASE are stamped with what
         was done about them.

         STAMPED AND NOT DELETED, which is the literal content of
         set-but-never-clear: the row keeps saying a revision was flagged, and
         now also says which edition, published by whom, at what instant,
         answered it. A reader can still see that the case carried a stale pin
         between those two dates, which is a fact about the record that
         deleting the row would destroy.

         SCOPED TO `caseId`, WHICH IS THE WHOLE OF D-266 ARRIVING HERE. Another
         project publishing another case cannot reach these rows, and this
         project publishing THIS case cannot reach another case's — the
         statement's WHERE clause names one case_id and there is no statement
         anywhere that names more. So where several flagged cases are owned by
         several projects, one project acting leaves every other project's
         flags outstanding, structurally rather than by anyone remembering to.

         `attestorMember` is who is credited, not the project: the act is a
         ratification and a ratification is performed by a member. The project
         is already on the flag row, written when it was raised.

         D-309: DISCHARGED PER CASE, INSIDE THE LOOP, AND D-266's SCOPING IS
         STRENGTHENED RATHER THAN LOOSENED BY IT. The statement still names ONE
         case_id and there is still no statement in this plane that names more;
         what changed is that the loop names EVERY case this member's ratified
         bytes are actually in, instead of one of them. A member serving two
         cases discharges both cases' flags on the same act because the act
         genuinely answered both — and a case this member is NOT in is as
         unreachable from here as it ever was. */
      this.caseTensionsModule.dischargeCaseFlags(one.case_id, oneEd, attestorMember ?? null, now);
    }
    /* ===== CASE-5b: `published_bundles.required` IS NOW A PROJECTION OF THE
       CASE'S BAR, AND IT IS STATED AS ONE RATHER THAN QUIETLY DERIVED. =======

       It used to be committed from THIS member's `required_strength` block,
       which is the shape CASE-5 already diagnosed: the bar is the CASE's
       property (DEC-72 clause 2), and one stamp per member is how one case
       edition came to have two standards of evidence when a project's bar moved
       between two ratifications. CASE-5 moved the authority to
       `published_cases.bar` and left this column reading the member's copy
       because that copy was where the signature was. The signature is over the
       case document now, so this column reads the authority instead.

       IT IS STILL COMMITTED FROM SIGNED BYTES — just not from THESE signed
       bytes. `published_cases.bar` was committed by `ratifyCaseDocument` out of
       the case document a member signed, so nothing here is taken from a
       request; #publishEdges' doctrine holds, one document over.

       WHY THE COLUMN IS KEPT AT ALL RATHER THAN DROPPED: five reader sites and
       the UI's per-finding bar render off it, and a column that silently went
       NULL would have every one of them print "bar: none declared" over a case
       that declared one — an absent bar is not a bar of zero, and this is the
       one place the record could have made that false by accident. Moving those
       readers onto the case's own field is a SURFACE change and belongs with
       CASE-6, which owns the published case page. Recorded in IC-71 as such. */
    /* ===== D-309: THE BAR PROJECTION UNDER CLAUSE 6, AND THIS IS THE ONE
       DECISION ON THIS SITE THAT IS NOT "ALL OF THEM".

       THE PROBLEM STATED HONESTLY: the bar is the CASE's (DEC-72 clause 2), and
       a member serving two cases is held by two cases to two standards of
       evidence. This is ONE column on `published_bundles`, keyed on the
       FINDING's (bundle_id, edition). A set does not fit in it.

       WHAT IS NOT DONE, AND WHY. Widening the schema is not this item's (the
       brief says so, and the surface half of clause 6 does not need it —
       CASE-6 moved the published page onto `published_cases.bar`, which is per
       case and already correct for any n). Picking one case's bar is the
       nine-silent-guesses defect arriving in a WRITE, which is worse than in a
       read because the guess is then frozen and signed-adjacent forever.
       Refusing the ratification is over-strict: two cases legitimately
       declaring different bars over one shared finding is exactly the shape
       clause 6 exists to permit, and a fence tighter than its rule is an
       undeclared interface change wearing the costume of caution.

       SO: PROJECTED WHEN THE CASES AGREE, NULL WHEN THEY DO NOT — and the
       disagreement is STATED in this act's answer (`barUndetermined`) rather
       than left to read as an absence. That distinction is the whole of it.
       CASE-5b's comment names the hazard precisely — *"a column that silently
       went NULL would have every one of them print 'bar: none declared' over a
       case that declared one — an absent bar is not a bar of zero"* — so the
       null is NOT silent here: the act names the cases and their differing
       bars, and `published_cases.bar` answers per case for anyone who asks.
       Undetermined is first-class and must be stated; inventing one of two real
       bars to fill a column would be exactly the attribution CLAUDE.md forbids.

       MEASURED, NOT ASSUMED, ABOUT HOW OFTEN THIS BITES: `published_bundles`
       carries `ON CONFLICT(bundle_id,edition) DO NOTHING`, so this column is
       written at a member's FIRST ratification at that edition and a later
       case adopting the same finding rewrites nothing. The disagreement is
       therefore reachable only when both cases pin the member before it first
       ratifies. Stated rather than claimed either way. */
    const bars = byCase.map((one) => {
      const b = this.#one(`SELECT bar FROM published_cases WHERE case_id=? AND edition=?`,
                          one.case_id, Number(one.edition));
      return { case_id: one.case_id, edition: Number(one.edition), bar: b && b.bar ? b.bar : null };
    });
    const distinctBars = [...new Set(bars.map((x) => x.bar))];
    const barUndetermined = distinctBars.length > 1;
    const required = !barUndetermined && distinctBars.length === 1 && distinctBars[0]
      ? JSON.parse(distinctBars[0])
      : null;
    this.sql.exec(
      `INSERT INTO published_bundles (bundle_id,edition,title,bundle_sha,ratified_at,attestor_key,attestor_member,delivered_by,gate_version,sig_armored,strength,required,parts)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(bundle_id,edition) DO NOTHING`,
      /* REC-128: who DELIVERED, as the control plane read it off the SESSION;
         never defaulted to the signer. A retry of bytes already published
         writes nothing (DO NOTHING), so the first delivery stands. */
      bundleId, ed, title ?? null, bundleSha, now, attestorKey, attestorMember ?? null, deliveredBy ?? null,
      gateVersion, sigArmored,
      frozenStrength ? JSON.stringify(frozenStrength) : null,
      required ? JSON.stringify(required) : null,
      JSON.stringify(shas.map((s) => ({ path: s.path, sha256: s.sha256, kind: s.kind, bytes: s.bytes ?? null }))));
    /* Append-only: a hash once published stays answerable forever, across
       any number of re-ratifications. */
    for (const s of shas)
      this.sql.exec(
        `INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)
         ON CONFLICT(sha256,bundle_id,path) DO NOTHING`,
        s.sha256, bundleId, s.path, s.kind, s.bytes ?? null, now);
    const graph = this.publishEdges(bundleId, edges, now);
    /* R35: publishing this target turns every name edge a published finding holds to it into a serve edge; R22
       (N256): and every reference held privately for it becomes one. */
    const promoted = this.#promoteNamedEdges(bundleId);
    const linked = this.#linkHeldReferences(bundleId, now);
    /* IS THE CASE EDITION COMPLETE? A case edition is servable as a container
       only when every member finding has been ratified — each on its own
       bytes, because the finding is the unit of truth. Until then the edition
       EXISTS and is stated as incomplete, which is honest: the findings that
       did ratify are published and answerable, and the container that would
       claim to carry all of them is not yet assemblable. */
    const caseState = caseId ? this.caseEditionState(caseId, cEd, group) : null;
    /* CASE-5: `edition` here is and always was THE MEMBER'S — this method
       commits one bundle. `caseEdition` is stated beside it rather than left
       to be inferred from `case.edition`, because the control plane's
       container assembler branches on the pair and an assembler reading one
       number for two altitudes is the defect this item exists to remove. */
    /* D-309 / IC-74: `caseId` and `caseEdition` keep their names and are the
       SOLE membership or ABSENT. A consumer still reading them therefore never
       receives a guess — it receives what it already receives for a loose
       bundle. The old field can only become MORE absent, never wrong. `case`
       (the container state) is served only for a sole membership, because it IS
       one case edition's state and there is no such thing as the state of two.

       `caseCount` IS A NUMBER AND NOT THE LIST, AND THAT IS A RATCHET DOING ITS
       JOB RATHER THAN A COMPROMISE. The first draft returned the memberships as
       a `cases` ARRAY here, and `meaning-bounds.test.mjs` went red: that put
       `op=publish` onto the BARE roster — a collection published off an
       unbounded row source — taking the ceiling 40 -> 41. The ceiling could only
       FALL, and moving it up to accommodate a new read was precisely what it
       existed to prevent, so the answer changed rather than the figure (that
       suite was deleted in T20; the decision stands on its own reason below).

       THE OBVIOUS FIX IS THE WRONG ONE AND IS REJECTED EXPLICITLY: bounding the
       list with `limit`/`truncated`, the spelling the bounded roster uses,
       would mean a member could be told their finding serves TWO cases when it
       serves five. **A truncated membership list is a record claiming a finding
       serves fewer cases than it does** — the overclaim class, arriving through
       a pagination convention, in the one item whose whole subject is not
       answering a set-valued question with part of the set.

       SO THE SEPARATION IS: AN ACT ANSWERS ABOUT THE ACT, A READ ENUMERATES.
       `caseCount` tells a caller whether the scalar above is the whole truth —
       which is the one thing they cannot otherwise tell an absent `caseId`
       ("in no case") from a set-valued one ("in several") — and
       `op=publishededitions` / `op=publishedlist` serve the memberships
       themselves, as they already did before this item and with the `cases`
       array this item gave them. Nothing is lost; it is one read away, and it
       is where reads live. */
    return { ok: true, bundleId, bundleSha, edition: ed, existed, ratifiedAt: now, edges: graph,
             ...(promoted ? { namesServed: promoted } : {}),
             ...(linked ? { heldLinked: linked } : {}),
             caseCount: byCase.length,
             /* A BOOLEAN AND NOT THE LIST, for `caseCount`'s reason exactly and
                measured the same way. The first draft returned `bars` — the
                per-case bars themselves — and `meaning-bounds.test.mjs` moved
                `op=publish` onto the OPAQUE roster: a collection off an
                unbounded row source, inside a conditional SPREAD, so the walk
                could not even bucket it as bare (that suite was deleted in
                T20). **An op the classifier cannot
                see is worse than one it grades badly** — that is the state
                `op=airunlog` was in while a ratchet read green over it — so the
                array came off rather than the roster growing a blind spot.
                The FACT survives, which is the part that matters: a member is
                told their finding's bar is undetermined here rather than being
                handed one case's standard as though it were the answer, and
                `published_cases.bar` answers per case for whoever asks. */
             ...(barUndetermined ? { barUndetermined: true } : {}),
             /* D-442: WHERE THIS FINDING'S EDITION AND FROZEN PAIR WERE READ FROM — its own bytes
                (legacy) or the case document(s) pinning them (rule 12) — and whether those
                documents disagreed about the pair (a boolean, for `barUndetermined`'s reason). */
             frozenFrom: memberCarriesBlocks ? "member_bytes" : docFrozen ? "case_document" : "none",
             /* D-442 / rule 12: EVERY case edition pinning these bytes that this ratification
                COMPLETED and that has no container yet, where there is no sole case to carry it as
                `case` (IC-74 keeps `case` for a sole membership only). Before rule 12 a shared sha
                could not arise — each case pinned the bytes its own promotion minted — so a case
                over a finding several cases pin would otherwise never be assembled. An INTERNAL
                hop: the control plane builds each container and forwards none of these states. */
             ...(!caseId && byCase.length ? (() => {
               const pending = byCase.map((one) => this.caseEditionState(one.case_id, Number(one.edition), group))
                 .filter((st) => st && st.complete && !st.manifest_sha);
               return pending.length ? { containerCases: pending } : {};
             })() : {}),
             ...(docFrozen && docFrozen.strengthUndetermined ? { strengthUndetermined: true } : {}),
             ...(caseId ? { caseId, caseEdition: cEd, case: caseState } : {}) };

  }

  /* R35 (ratification R16): publishing a target turns every `name` edge to it FROM A PUBLISHED FINDING into a `serve`
     edge, in the same transaction — the one change R24 permits to a published row. A name edge was classified name
     only because its target was not yet published (a division's disclosures are name-only BY KIND and never turn);
     both ends are now covered by signatures, so serving it states nothing either signature does not.
     SET-WISE (N237, N277; K351): one count and one statement, so no edge is read into the worker's memory however many
     findings name the target; the count is what the statement then turns, inside the caller's transaction. */
  #promoteNamedEdges(targetId) {
    const turnable = `FROM published_edges e
        WHERE e.to_bundle=? AND e.disclosure='name' AND e.kind NOT IN ('division_parent','division_sibling')
          AND EXISTS (SELECT 1 FROM published_bundles p WHERE p.bundle_id=e.from_bundle)`;
    const n = Number((this.#one(`SELECT COUNT(*) AS n ${turnable}`, targetId) || {}).n) || 0;
    if (n)
      this.sql.exec(`UPDATE published_edges SET disclosure='serve'
                      WHERE rowid IN (SELECT e.rowid ${turnable})`, targetId);
    return n;
  }

  /* R22, R35 (N256; Bob, K283): publishing a target turns every reference HELD PRIVATELY for it (a serve-class edge a
     published finding named before the target was published, `publishEdges` below) into a `serve` edge of the
     published graph, in the same transaction, and stamps the held row with the instant. Set-wise as
     `#promoteNamedEdges` is: one count, one insert, one update, no edge read into memory. Only a reference from a
     finding that is itself published is linked; a row whose target is not this one is untouched. */
  #linkHeldReferences(targetId, now) {
    const held = `FROM published_held_references h
        WHERE h.to_bundle=? AND h.linked_at IS NULL
          AND EXISTS (SELECT 1 FROM published_bundles p WHERE p.bundle_id=h.from_bundle)`;
    const n = Number((this.#one(`SELECT COUNT(*) AS n ${held}`, targetId) || {}).n) || 0;
    if (!n) return 0;
    this.sql.exec(
      `INSERT INTO published_edges (from_bundle,to_bundle,kind,disclosure,published)
       SELECT h.from_bundle, h.to_bundle, h.kind, 'serve', ? ${held}
       ON CONFLICT(from_bundle,to_bundle,kind) DO UPDATE SET disclosure='serve'`, now, targetId);
    this.sql.exec(`UPDATE published_held_references SET linked_at=?
                    WHERE rowid IN (SELECT h.rowid ${held})`, now, targetId);
    return n;
  }

  /** R22 (K241): commit one case edition from its SIGNED document, inside the caller's transaction: the case's owning
   *  project (at its first edition), the edition's scope, completeness (as the caller computed it from the signed
   *  bytes), bias acknowledgement and bar, the roster with roles and pins, and the signature, signer and deliverer on
   *  its document, whose hash joins the published hashes (D-734). The same signature on an already signed document
   *  answers `existed: true` and writes nothing; any other signed document is `CASE_EDITION_ALREADY_RATIFIED`, and a
   *  case another project owns `CASE_PRODUCTION_DIVERGED`, nothing written. It answers `awaiting` (roster members not
   *  yet published at their pins) and `state`, the case edition's state (`caseEditionState`). Who may sign, the
   *  document's staleness and the flag discharge are ratification's. */
  commitCaseEdition({ case: caseArg = null, caseId = null, edition = null, project = null, scope = null,
                      completeness = null, biasAcknowledgement = null, bar = null, roster = [], sigArmored = null,
                      attestorKey = null, attestorMember = null, gateVersion = null, deliveredBy = null, at = null } = {}) {
    const id = str(caseArg ?? caseId), ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1 || !str(sigArmored) || !str(attestorKey) || !str(gateVersion)
        || !Array.isArray(roster))
      return { ok: false, reason: "MALFORMED",
               detail: localize("publication.index.a_case_edition_names_its", "a case edition names its case, a positive edition, the signature, the attesting key, the gate version and its roster") };
    const members = roster.filter((m) => m && typeof m.bundle_id === "string" && m.bundle_id);
    const doc = this.#one(`SELECT doc_sha, text, sig_armored FROM case_documents WHERE case_id=? AND edition=?`, id, ed);
    if (!doc) return noCaseDocument(id, ed);
    const outcome = (existed) => {
      const awaiting = members.filter((m) => !this.#one(
        `SELECT bundle_id FROM published_bundles WHERE bundle_id=? AND bundle_sha=?`, m.bundle_id, m.version_sha ?? ""))
        .map((m) => m.bundle_id);
      /* D-442: the group is read off the first member's pinned bytes, the field op=ratify passes. */
      const mt = members.length ? this.record.textAtSha(members[0].bundle_id, members[0].version_sha ?? null) : null;
      const grp = mt ? ((parseFrontmatter(mt).data || {}).group ?? null) : null;
      return { ok: true, existed, caseId: id, edition: ed, doc_sha: doc.doc_sha, awaiting,
               state: this.caseEditionState(id, ed, grp) };
    };
    if (doc.sig_armored)
      return doc.sig_armored === sigArmored ? outcome(true)
        : { ok: false, reason: "CASE_EDITION_ALREADY_RATIFIED", caseId: id, edition: ed,
            detail: localize("publication.index.case_is_already_signed_and", "case {id} edition {ed} is already signed, and a signed edition answers forever; a correction is a new edition", { id: String(id), ed: String(ed) }) };
    const owner = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, id);
    if (owner && owner.project_id !== (project ?? null))
      return { ok: false, reason: "CASE_PRODUCTION_DIVERGED", caseId: id, edition: ed,
               declared: owner.project_id, signed: project ?? null,
               detail: localize("publication.index.case_is_the_production_and", "case {id} is {owner}'s production and this signed case document names {project}. A case does not change hands between editions (DEC-72).", { id: String(id), owner: String(owner.project_id), project: String(project) }) };
    /* R78 (T45; N892; Actions D4; v0.2 rule 15): NOTHING OF A COUNSEL MATTER ENTERS A CASE OR AN EDITION, asked before
       every other refusal of this commit's own and writing nothing. The scope is project-roster's (its R23), read here, at
       the commit, and never earlier: an edition already signed answered above whatever its project's scope is now, so a
       scope changes nothing already committed (R24; project-roster R21). */
    const counsel = this.#counselMatterIn(owner ? owner.project_id : project, members);
    if (counsel) {
      /* DEC-49 REGION is-counsel-matter-published */
      return { ok: false, reason: "COUNSEL_MATTER_NOT_PUBLISHED", ...rowOf("COUNSEL_MATTER_NOT_PUBLISHED"), caseId: id,
               edition: ed, ...counsel,
               detail: counselDetail(counsel) };
      /* END DEC-49 REGION is-counsel-matter-published */
    }
    /* R58 (DEC-112; K1268, BOB's decision 5): EVERY EDITION COMMITTED FROM T28 ON CARRIES ITS METHOD AND MATERIALS, so a
       preparation made before T28 (any format but /6) is never committed, nothing written: the remedy is a new
       preparation, which carries them. A retry of an edition already signed answered above, whatever its format. A /7
       document (T31, DEC-124) is /6 in every field and is read as /6 here, as everywhere in this module: every reading of
       a document's shape is `case-grammar`'s predicates (its R1), never a format named here (N538, K1367). */
    const docFm = parseFrontmatter(doc.text).data || {};
    if (!caseDocumentRequiresMaterials(docFm)) {
      /* DEC-49 REGION is-case-format-current */
      return { ok: false, reason: "CASE_FORMAT_SUPERSEDED", ...rowOf("CASE_FORMAT_SUPERSEDED"), caseId: id, edition: ed,
               format: typeof docFm.format === "string" ? docFm.format : null,
               detail: localize("publication.index.this_case_document_was_prepared", "this case document was prepared in a format that carries no method and no materials, so nothing was committed. Prepare the case again, and sign the new preparation.") };
      /* END DEC-49 REGION is-case-format-current */
    }
    const when = str(at) || this.#when();
    /* R51, R52 (N364; DEC-78 item 5(d)): WHAT THE DOCUMENT STATES OF ITS SOURCES IS RE-READ AT THE COMMIT. A consent
       withdrawn binds only later publications, and this is one: every row of the `sources:` block must still be what
       `sources.publishableAt({audience: "public", at})` answers now, or the capture's unnamed statement, read through
       case-carriage (its R5). Any other row stops the commit, nothing written; the remedy is a new preparation. */
    const lapsed = this.caseCarriage.sourcesLapsed(doc.text, when);
    if (lapsed.length) {
      /* DEC-49 REGION is-source-consent-withdrawn */
      return { ok: false, reason: "SOURCE_CONSENT_WITHDRAWN", ...rowOf("SOURCE_CONSENT_WITHDRAWN"), caseId: id,
               edition: ed, captures: [...new Set(lapsed.map((x) => x.capture))].slice(0, 200),
               detail: localize("publication.index.statements_this_case_document_makes", "{count} statement(s) this case document makes about a source are no longer what may be published of that source, so nothing was committed. What is published under a consent stays published; this edition was not, and a new preparation leaves the detail out.", { count: String(lapsed.length) }) };
      /* END DEC-49 REGION is-source-consent-withdrawn */
    }
    /* R57 (T37; N757, DEC-180 (4), K2206): A PHOTO WHOSE MARKS CHANGED SINCE THE CASE WAS PREPARED IS RE-READ AT THE
       COMMIT, R51's pattern, after it and before R59: every `materials:` row case-carriage answers lapsed (its R13: an
       obscured row whose copy is no longer the photo's current copy, a mark withdrawn since preparation (its R14) among
       them; a photo carried whole, always (T38; N779, DEC-183 (4)); marks that cannot be read) stops the commit, nothing
       written; the remedy is a new preparation.
       (T39; N806; K2333) In the same step, a row case-carriage answers with `kind` `document` (a member document's copy
       no longer its current copy, one carried whole that needs a copy, or one whose state cannot be read) is C-122.7
       `DOCUMENT_COPY_CHANGED_SINCE`; every other row is a photo's, C-122.6. Both are answered when both hold: the answer
       is the first of them, and `refusals` lists each (one or both), C-122.6 then C-122.7. An answer that is not a list is the photos'
       marks unread (fail closed, as before T39). */
    const answered = this.caseCarriage.marksLapsed(docFm);
    const lapses = Array.isArray(answered) ? answered : [{ ref: null, sha: null, why: word("publication.why.photos_marks_read") }];
    const named = (m) => ({ ref: m?.ref ?? null, sha: m?.sha ?? null, why: m?.why ?? null });
    const docs = lapses.filter((m) => m?.kind === "document"), marks = lapses.filter((m) => m?.kind !== "document");
    const refusals = [];
    if (marks.length) {
      /* DEC-49 REGION is-photo-marks-current */
      /* R33 (DEC-187 (4)): its words `photo.refused.changed.signed`; `photo` names the photos for their `{photo}` */
      const photos = marks.slice(0, 200).map(named);
      refusals.push({ reason: "PHOTO_MARKS_CHANGED_SINCE", ...rowOf("PHOTO_MARKS_CHANGED_SINCE"), photos,
                      photo: photos.map((x) => x.ref ?? x.sha ?? "a photo").join(", "),
                      detail: localize("publication.index.photos_this_case_document_carries", "{count} photo(s) this case document carries cannot be published as prepared (a mark made or withdrawn after the case was prepared, a photo carried whole rather than as the copy the team marked, or marks that cannot be read), so nothing was committed. Prepare the case again.", { count: String(marks.length) }) });
      /* END DEC-49 REGION is-photo-marks-current */
    }
    if (docs.length) {
      /* DEC-49 REGION is-document-copy-current */
      refusals.push({ reason: "DOCUMENT_COPY_CHANGED_SINCE", ...rowOf("DOCUMENT_COPY_CHANGED_SINCE"),
                      documents: docs.slice(0, 200).map(named),
                      detail: localize("publication.index.documents_a_member_supplied_that", "{count} document(s) a member supplied that this case document carries cannot be published as prepared (a copy that is no longer the document's current copy, a document carried whole that needs a copy, or one whose state cannot be read), so nothing was committed. Prepare the case again.", { count: String(docs.length) }) });
      /* END DEC-49 REGION is-document-copy-current */
    }
    if (refusals.length)
      return { ok: false, ...refusals[0], caseId: id, edition: ed, refusals };
    /* R59 (DEC-96 items 1, 4; N522): ANOTHER GROUP'S WORK THE DOCUMENT RESTS ON IS RE-READ AT THE COMMIT, R51's pattern.
       Each `accepted_work:` row's acceptance must still be in force at its edition, and every open flag on that edition
       must be one `accepted_work_flags:` discloses, read through case-carriage (its R4); otherwise nothing is committed
       and the remedy is a new preparation. */
    const standing = this.caseCarriage.acceptedWorkLapsed(docFm, attestorMember);
    if (standing) {
      /* DEC-49 REGION is-accepted-work-standing */
      if (standing.withdrawn.length)
        return { ok: false, reason: "ACCEPTANCE_WITHDRAWN_SINCE", ...rowOf("ACCEPTANCE_WITHDRAWN_SINCE"), caseId: id,
                 edition: ed, accepted_work: standing.withdrawn,
                 detail: localize("publication.index.acceptances_of_another_teams_work", "{count} acceptance(s) of another team's work this case document rests on are no longer known to be in force, so nothing was committed. Prepare the case again.", { count: String(standing.withdrawn.length) }) };
      return { ok: false, reason: "FLAG_OPENED_SINCE", ...rowOf("FLAG_OPENED_SINCE"), caseId: id, edition: ed,
               flags: standing.undisclosed,
               detail: localize("publication.index.open_flags_on_another_teams", "{count} open flag(s) on another team's work this case document rests on are not disclosed by it, so nothing was committed. Prepare the case again, disclosing them.", { count: String(standing.undisclosed.length) }) };
      /* END DEC-49 REGION is-accepted-work-standing */
    }
    /* R72 (N649): the published criteria, read after every refusal and frozen on the edition's row below; R75's read. */
    const criteria = this.#withCaptures(this.#criteriaOf(members, when, attestorMember), docFm);
    if (!owner)
      this.sql.exec(`INSERT INTO cases (case_id,project_id,opened) VALUES (?,?,?) ON CONFLICT(case_id) DO NOTHING`,
                    id, project ?? null, when);
    /* R70, R40 (DEC-147 (5); K1826): when it was signed beside when it is published, on the row: a set time's signing
       (R77's `signedAtOf`), else this commit's instant; published at this commit. */
    const signedAt = this.#signedAtOf(id, ed) || when;
    this.sql.exec(
      `INSERT INTO published_cases (case_id,edition,scope,completeness,bias_acknowledgement,bar,opened,signed_at,published_at,
         criteria)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(case_id,edition) DO UPDATE SET scope=excluded.scope,
         completeness=excluded.completeness, bias_acknowledgement=excluded.bias_acknowledgement, bar=excluded.bar,
         signed_at=excluded.signed_at, published_at=excluded.published_at, criteria=excluded.criteria`,
      id, ed, typeof scope === "string" ? scope : null, completeness ? JSON.stringify(completeness) : null,
      typeof biasAcknowledgement === "string" ? biasAcknowledgement : null,
      bar && typeof bar === "object" ? JSON.stringify(bar) : null, when, signedAt, when, JSON.stringify(criteria));
    /* THE ROSTER AND THE PINS, IN ONE ACT: the publisher authored all N pins in one document and a member signed it,
       so the freeze is one statement somebody made. The ordinal is the roster's own order. */
    members.forEach((m, i) => {
      this.sql.exec(
        `INSERT INTO published_case_members (case_id,edition,ord,bundle_id,version_sha,role)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(case_id,edition,bundle_id) DO UPDATE SET ord=excluded.ord,
           version_sha=excluded.version_sha, role=excluded.role`,
        id, ed, i, m.bundle_id, m.version_sha ?? null, m.role ?? null);
    });
    /* REC-128: `deliveredBy` is the control plane's reading of the SESSION, written as handed — never defaulted to
       the signer. */
    this.sql.exec(
      `UPDATE case_documents SET sig_armored=?, attestor_key=?, attestor_member=?, gate_version=?, delivered_by=?,
         ratified_at=? WHERE case_id=? AND edition=? AND sig_armored IS NULL`,
      sigArmored, attestorKey, attestorMember ?? null, gateVersion, deliveredBy ?? null, when, id, ed);
    /* D-734 (BOB #36, D-731 (b); BIO_Publication_v0_1.md §4): THE SIGNED DOCUMENT'S OWN HASH IS PUBLISHED, in the same
       act and transaction that signs it, so op=verify answers for the one hash a member signed here. */
    registerCaseDocumentSha(this.sql, id, ed, doc.doc_sha, doc.text, when);
    /* R57 (DEC-112 (3)(4); K1316): EVERYTHING THE CASE INCLUDES, HELD BY SHA-256 IN THE SAME ACT, so public-read carries it
       in the case file from the published projection alone: case-carriage holds them (its R1) and this module registers
       every file it answers by hash, every write to `published_shas` being this module's. A material this copy cannot
       hold at its stated digest never refuses the commit: it is named, and the case file shows it missing. */
    const held = this.caseCarriage.holdMaterials(docFm, { caseId: id, edition: ed, at: when });
    for (const f of held.files) {
      /* G47t (K4677): an attestation token records the capture it stamps. A stored capture that differs from the new
         one is cleared to NULL (the token is shared: edition 2 adds capture B naming edition 1's token); a stored NULL
         is never rewritten to a value (an old row keeps the ref join); the same capture again changes nothing. */
      if (f.kind === "attestation") {
        const cap = typeof f.capture_sha === "string" && f.capture_sha ? f.capture_sha.toLowerCase() : null;
        this.sql.exec(ATTESTATION_SHA_UPSERT, f.sha256, f.ref, f.path, f.kind, f.bytes ?? null, when, cap);
      } else
        this.sql.exec(`INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)
                       ON CONFLICT(sha256,bundle_id,path) DO NOTHING`, f.sha256, f.ref, f.path, f.kind, f.bytes ?? null, when);
    }
    /* R22 (K1632; public-read R23): EACH CALCULATION'S INPUTS, COMMITTED AS A MATERIAL'S. Every input a `calculations:` row
       names (case-grammar R18) is registered by its SHA-256 at its case-file path, and answered `held: "evidence"`: a
       declared table's canonical bytes are held in the evidence store under that hash (calculations R1), so ratification's
       Worker copies them to the published bucket after the commit as it copies a material held there (its R39). */
    const inputs = this.#calculationInputs(docFm);
    for (const x of inputs)
      this.sql.exec(`INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)
                     ON CONFLICT(sha256,bundle_id,path) DO NOTHING`, x.sha, id, x.path, "calculation_input", null, when);
    return { ...outcome(false), materials: this.#withInputs(held.materials, inputs), materials_unheld: held.unheld };
  }

  /* R78: what of a counsel matter a commit would publish: `project` the case's owning project when project-roster answers
     it `counsel_matter`, else null; `findings` each roster member (at most 200, in roster order) whose project, the one
     its pinned bytes were committed with (their front matter's `project:`; record-core's row when those bytes cannot be
     read), it answers so. Null when neither. Another project is never named: a member's project may be one the signer
     cannot see. Each project is asked once; a scope that cannot be read is R23's (`none`). */
  #counselMatterIn(owning, members) {
    const asked = new Map();
    const counsel = (p) => {
      const id = str(p);
      if (!id) return false;
      if (!asked.has(id)) {
        let scope = null;
        try { const a = this.roster.projectScope(id); scope = a && typeof a.scope === "string" ? a.scope : null; }
        catch { scope = null; }
        asked.set(id, scope === "counsel_matter");
      }
      return asked.get(id);
    };
    const project = counsel(owning) ? str(owning) : null;
    const findings = [];
    for (const m of members) {
      if (findings.includes(m.bundle_id)) continue;
      if (counsel(this.#committedProject(m.bundle_id, m.version_sha ?? null))) findings.push(m.bundle_id);
    }
    return project || findings.length ? { project, findings: findings.slice(0, 200) } : null;
  }

  /* R78: the project a member finding was committed with at its pin: its pinned bytes' top-level `project:` (promotion
     R53's field), else, when those bytes cannot be read, the project record-core holds for the bundle; null for none. */
  #committedProject(bundleId, sha) {
    let text = null;
    try { text = this.record.textAtSha(bundleId, sha); } catch { text = null; }
    if (typeof text === "string") {
      const fm = parseFrontmatter(text).data || {};
      return typeof fm.project === "string" ? str(fm.project) || null : null;
    }
    try { const info = this.record.bundleInfo(bundleId); return info ? str(info.project) || null : null; }
    catch { return null; }
  }

  /* R72 (N649; K1723, K1739; DEC-145 (2), (6)): THE CRITERIA AN EDITION IS MEASURED AGAINST, read at its commit and
     frozen with it: one row per distinct standard, portion and body that a leg of a member finding targets at the
     member's pinned bytes (a `STD-` target, inquiry-grammar R13), in member order then leg order. Read from `standards`
     as the signer reads it, on the commit's day; the body's name from `entities`. A benchmark is labeled "not binding
     on" its body and never nonconforming; a standard's text reaches a row only as the passages its legs rely on (a
     leg's own `content_id` among the standard's text, else the portion's `requires` passages), quoted as `standards`
     answers them. A standard `standards` no longer answers is stated "not held" and never refuses the commit (that is
     `case-checker`'s, its R21). Never throws. */
  #criteriaOf(members, when, signer) {
    /* K2483 (D54): with no member signing, an internal read as a machine viewer, never the founder's (`admin`), which no
       longer sees a hidden project it is not in. */
    const viewer = str(signer) ? `member:${str(signer)}` : MACHINE_VIEWER;
    const day = String(when).slice(0, 10);
    const rows = new Map();
    for (const m of members) {
      let text = null;
      try { text = this.record.textAtSha(m.bundle_id, m.version_sha ?? null); } catch { text = null; }
      if (typeof text !== "string") continue;
      const fm = parseFrontmatter(text).data || {};
      const body = str(fm.subject_entity) || null;
      for (const leg of Array.isArray(fm.basis) ? fm.basis : []) {
        const standard = leg && typeof leg === "object" ? str(leg.target) : "";
        if (!isStandardId(standard)) continue;
        const portion = str(leg.target_portion) || null;
        const key = JSON.stringify([standard, portion, body]);
        if (!rows.has(key)) rows.set(key, { standard, portion, body, named: [], requires: false });
        const r = rows.get(key);
        const cid = str(leg.content_id).toLowerCase();
        if (!HEX64.test(cid)) r.requires = true;
        else if (!r.named.includes(cid)) r.named.push(cid);
      }
    }
    return [...rows.values()].map((r) => this.#criterion(r, day, viewer));
  }

  /** R75 (N717; K2002, K2129): the criteria R72 would record for `members` (each `{bundle_id, version_sha}`, read at
   *  those bytes) at a commit by `signer` on the UTC day of `at`, composed exactly as the commit composes them (the same
   *  read), so a preparation and its commit disagree only by a change in the record between them: `{rows}`. Writes
   *  nothing, is no op, and never throws: a member whose bytes cannot be read contributes no row. */
  criteriaFor(args = {}) {
    try {
      const { members = [], signer = null, at = null } = args && typeof args === "object" ? args : {};
      const list = (Array.isArray(members) ? members : [])
        .filter((m) => m && typeof m === "object" && typeof m.bundle_id === "string" && m.bundle_id);
      const when = str(at) || this.#when();
      return { rows: this.#criteriaOf(list, when, typeof signer === "string" ? signer : null) };
    } catch { return { rows: [] }; }
  }

  /* R72: one criteria row, as `standards` answers the standard at the commit. */
  #criterion({ standard, portion, body, named, requires }, day, viewer) {
    let s = null;
    try { s = this.standards.standardRead({ id: standard, viewer }); } catch { s = null; }
    if (!s || s.ok !== true)
      return { standard, portion, designation: null, edition: null, issuer: null, citation: null, access: null, body: null,
               binds: null, passages: null, label: null, access_words: null, stated: "not held" };
    let binds = false;
    if (body) {
      try { const b = this.standards.bindsAt({ standard, body, date: day, viewer }); binds = !!b && b.ok === true && b.state === "binds"; }
      catch { binds = false; }
    }
    const held = new Set((Array.isArray(s.texts) ? s.texts : []).map((t) => t && t.content_id));
    const quoted = new Map((Array.isArray(s.requires_quoted) ? s.requires_quoted : []).map((q) => [q.content_id, q.text ?? null]));
    const ids = [...new Set([...named.filter((c) => held.has(c)), ...(requires && Array.isArray(s.requires) ? s.requires : [])])];
    const name = body ? this.#entityName(body) : null;
    return { standard, portion, designation: s.designation ?? null, edition: s.edition ?? null,
             issuer: (s.owner && s.owner.label) || s.issuer || null, citation: s.cite ?? null, access: s.access ?? null,
             body, binds, passages: ids.map((c) => ({ content: c, text: quoted.has(c) ? quoted.get(c) : null })),
             label: binds ? word("standard.binding.binds", { body: String(name) })
                  : body ? word("standard.binding.benchmark", { body: String(name) }) : word("publication.label.benchmark_binding"),
             access_words: ACCESS_WORDS[s.access] ?? null };
  }

  /* R72 (T37; N763, K2140): each row's `captures`, the SHA-256 of each capture holding one of its passages (`content`'s
     read contract, its R45, as case-authoring R61 reads it) that the edition's `materials:` block lists `included: true`,
     each once, in the order first met. A capture the edition does not carry is never stated, so no withheld capture's
     digest is published; a row stated "not held" carries `captures: null`. An unreadable `content` table states none.
     A `materials:` row's `included` is read as case-carriage reads it (`true`, or the string a flat block may hold). */
  #withCaptures(rows, fm) {
    let carried = new Set();
    try {
      const m = materialsOf(fm);
      carried = new Set((m && Array.isArray(m.materials) ? m.materials : [])
        .filter((r) => r && typeof r === "object" && (r.included === true || r.included === "true"))
        .map((r) => str(r.sha).toLowerCase()).filter((x) => HEX64.test(x)));
    } catch { carried = new Set(); }
    const contents = [...new Set(rows.flatMap((r) => (Array.isArray(r.passages) ? r.passages : [])
      .map((q) => (q && typeof q.content === "string" ? q.content : null)).filter(Boolean)))];
    const captureOf = new Map();
    try {
      /* one bound list, never a variable per id (workerd refuses about 100 bound variables, D-390) */
      if (contents.length)
        for (const r of this.#rows(`SELECT content_id, capture_sha FROM content
                                     WHERE content_id IN (SELECT value FROM json_each(?))`, JSON.stringify(contents)))
          if (typeof r.capture_sha === "string" && r.capture_sha) captureOf.set(r.content_id, r.capture_sha.toLowerCase());
    } catch { captureOf.clear(); }
    return rows.map((r) => ({ ...r, captures: r.stated === "not held" || !Array.isArray(r.passages) ? null
      : [...new Set(r.passages.map((q) => q && captureOf.get(q.content)).filter((c) => c && carried.has(c)))] }));
  }

  /* R72: an entity's name as `entities` holds it; its id when it holds none. */
  #entityName(id) {
    try { const e = this.entities.readEntity({ entityId: id }); return (e && e.found && e.entity && e.entity.label) || id; }
    catch { return id; }
  }

  /* R22: every input a document's `calculations:` rows name, `{calc, sha, path}`, once per (calculation, input), in the
     document's order; a row whose input or id the case file cannot spell carries nothing. */
  #calculationInputs(fm) {
    const out = [], seen = new Set();
    for (const r of calculationsOf(fm)) {
      for (const sha of Object.values(r && r.inputs && typeof r.inputs === "object" ? r.inputs : {})) {
        const path = r.calc ? caseFilePath("calculation", [r.calc, sha]) : null;
        if (!path || seen.has(path)) continue;
        seen.add(path);
        out.push({ calc: r.calc, sha, path });
      }
    }
    return out;
  }

  /* R22: the materials answer with each calculation input not already among them, `held: "evidence"`. */
  #withInputs(materials, inputs) {
    const list = Array.isArray(materials) ? [...materials] : [];
    const have = new Set(list.map((m) => m && m.sha));
    for (const x of inputs) if (!have.has(x.sha)) { have.add(x.sha); list.push({ sha: x.sha, held: "evidence" }); }
    return list;
  }

  /** R57 (K1317): what a committed case edition held, as case-carriage answers it (its R2), with each calculation input
   *  its signed document names (R22), so a retried ratification copies what is left (ratification R39). */
  heldMaterialsOf(caseId, edition) {
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`,
                        str(caseId), Number(edition));
    const inputs = d ? this.#calculationInputs(parseFrontmatter(d.text).data || {}) : [];
    return this.#withInputs(this.caseCarriage.heldMaterialsOf(caseId, edition), inputs);
  }

  /** R57 (K1316): a held material's text by its SHA-256, as case-carriage answers it (its R3), for `public-read`. */
  publishedMaterialText(sha) { return this.caseCarriage.publishedMaterialText(sha); }

  /* D-734: THE BYTES op=publishedbytes SERVES FOR A `case_document` HASH, read from `case_documents.text` — the signed
     bytes themselves, which never reach the published bucket. Answered ONLY for a sha that BOTH a `case_document` row
     of `published_shas` names AND a RATIFIED case document carries, so an unsigned document's text is unreachable here.
     The control plane re-hashes before serving; this read does not vouch for the bytes. */
  publishedCaseDocumentText(sha) {
    const d = this.#one(
      `SELECT d.case_id, d.edition, d.text FROM case_documents d
         JOIN published_shas p ON p.sha256 = d.doc_sha AND p.bundle_id = d.case_id AND p.kind = 'case_document'
        WHERE d.doc_sha=? AND d.ratified_at IS NOT NULL ORDER BY d.case_id, d.edition LIMIT 1`, String(sha ?? ""));
    return d ? { found: true, case_id: d.case_id, edition: Number(d.edition), text: d.text, path: caseDocumentPath(d.edition) }
             : { found: false };
  }

  /* ---------------------------------------------------------------- R62: a court order complied with openly */

  /* The editions of a case whose case document is signed, in edition order. */
  #signedEditions(caseId) {
    return this.#rows(`SELECT edition FROM case_documents WHERE case_id=? AND sig_armored IS NOT NULL ORDER BY edition`,
                      caseId).map((r) => Number(r.edition));
  }

  /** R62 (K1480, K1632): stamp each named ratified edition of `case` for the posted `court-order` docket entry `entry`,
   *  `effect` one of EDITION_STAMP_EFFECTS, `parts` the parts the order names (a list of strings; none named, null).
   *  Called by `docket` (its R25) inside the transaction that posts the entry, and writes only inside it. `editions` is a
   *  non-empty list of edition numbers, or `all`, read at the stamp as every ratified edition then held. A stamp is a
   *  new row beside the edition and never alters a published row, a signed document or a published object (R24); the
   *  same stamp again answers `existed: true` and writes nothing. Refusals, each writing nothing: a malformed call
   *  `MALFORMED`; an edition that is not a ratified edition of the case `NO_SUCH_CASE_EDITION`; an entry the registered
   *  source does not answer as a posted `court-order` entry of that case with this effect (or no source registered)
   *  `STAMP_NO_ORDER`. Never throws. */
  stampEdition({ case: caseArg = null, caseId = null, editions = null, entry = null, effect = null, parts = null,
                 at = null } = {}) {
    const id = str(caseArg ?? caseId);
    const fx = str(effect);
    const named = editions === "all" ? "all"
      : Array.isArray(editions) && editions.length && editions.every((e) => Number.isInteger(Number(e)) && Number(e) >= 1)
        ? [...new Set(editions.map(Number))] : null;
    const partsList = parts == null ? null
      : Array.isArray(parts) && parts.every((x) => typeof x === "string" && x.trim()) ? parts.map((x) => x.trim()) : undefined;
    if (!id || !EDITION_STAMP_EFFECTS.includes(fx) || !named || partsList === undefined || entry == null)
      return { ok: false, reason: "MALFORMED",
               detail: localize("publication.index.a_stamp_names_its_case", "a stamp names its case, the editions (a list of numbers, or all), the docket entry, one of the effects {effects}, and the parts as a list of names when it names any", { effects: EDITION_STAMP_EFFECTS.join(", ") }) };
    const signed = this.#signedEditions(id);
    const eds = named === "all" ? signed : named;
    const missing = eds.filter((e) => !signed.includes(e));
    if (!eds.length || missing.length)
      return { ok: false, reason: "NO_SUCH_CASE_EDITION", case: id, editions: eds.length ? missing : [],
               detail: eds.length ? localize("publication.index.editions_of_are_not_ratified", "edition(s) {editions} of {id} are not ratified editions, so nothing was stamped", { editions: missing.join(", "), id: String(id) })
                                  : localize("publication.index.holds_no_ratified_edition_so", "{id} holds no ratified edition, so nothing was stamped", { id: String(id) }) };
    let order = null;
    try { order = this.#orders ? this.#orders.courtOrderOf(id, entry) : null; } catch { order = null; }
    const seq = order && Number.isInteger(Number(order.seq)) ? Number(order.seq) : null;
    if (!order || seq == null || str(order.effect) !== fx)
      return { ok: false, reason: "STAMP_NO_ORDER", case: id,
               detail: this.#orders ? localize("publication.index.that_entry_is_not_a", "that entry is not a posted court-order entry of this case with this effect, so nothing was stamped")
                                    : localize("publication.index.no_courtorder_source_is_registered", "no court-order source is registered, so no entry can be confirmed and nothing was stamped") };
    const when = str(at) || this.#when();
    const json = partsList && partsList.length ? JSON.stringify(partsList) : null;
    let wrote = 0;
    for (const e of eds) {
      const had = this.#one(`SELECT 1 AS h FROM edition_stamps WHERE case_id=? AND edition=? AND entry_seq=?`, id, e, seq);
      if (had) continue;
      this.sql.exec(`INSERT INTO edition_stamps (case_id,edition,entry_seq,effect,parts,stamped_at) VALUES (?,?,?,?,?,?)`,
                    id, e, seq, fx, json, when);
      wrote++;
    }
    return { ok: true, case: id, entry: seq, effect: fx, parts: json ? partsList : null, editions: eds, existed: wrote === 0,
             stamps: eds.flatMap((e) => this.stampsOf({ case: id, edition: e }).stamps.filter((x) => x.entry === seq)) };
  }

  /** R62: one edition's court-order stamps, in the order they were made: `{ok, case, edition, stamps: [{case, edition,
   *  effect, parts, entry, stamped_at}]}`, for `public-read` to answer beside the edition. `NO_ID` without a case;
   *  an edition never stamped answers `stamps: []`. Writes nothing. */
  stampsOf({ case: caseArg = null, caseId = null, edition = null } = {}) {
    const id = str(caseArg ?? caseId), ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1)
      return { ok: false, reason: "NO_ID", detail: localize("publication.index.stampsof_names_a_case_and", "stampsOf names a case and a positive edition") };
    const stamps = this.#rows(`SELECT case_id, edition, effect, parts, entry_seq, stamped_at FROM edition_stamps
                                WHERE case_id=? AND edition=? ORDER BY rowid`, id, ed)
      .map((r) => ({ case: r.case_id, edition: Number(r.edition), effect: r.effect, parts: safeJson(r.parts),
                     entry: Number(r.entry_seq), stamped_at: r.stamped_at }));
    return { ok: true, case: id, edition: ed, stamps };
  }

  /** R64 (N598, K1644): every edition holding at least one R62 stamp, in one read over the whole store, in case id and
   *  edition order, each edition's `stamps` exactly as `stampsOf` answers them (in the order made): `{ok: true,
   *  editions: [{case, edition, stamps}]}`. Takes no viewer, writes nothing and never throws. */
  stampedEditions() {
    try {
      const editions = [];
      for (const r of this.#rows(`SELECT case_id, edition, effect, parts, entry_seq, stamped_at FROM edition_stamps
                                   ORDER BY case_id, edition, rowid`)) {
        const s = { case: r.case_id, edition: Number(r.edition), effect: r.effect, parts: safeJson(r.parts),
                    entry: Number(r.entry_seq), stamped_at: r.stamped_at };
        const last = editions[editions.length - 1];
        if (last && last.case === s.case && last.edition === s.edition) last.stamps.push(s);
        else editions.push({ case: s.case, edition: s.edition, stamps: [s] });
      }
      return { ok: true, editions };
    } catch { return { ok: true, editions: [] }; }
  }

  /* ---------------------------------------------------------------- R63: the published timeline, frozen at signing */

  /** R63 (C11; K1494, K1632): a ratified edition's timeline, the `timeline:` block of its signed document as signed
   *  (`case-grammar.timelineOf`): `{ok, case, edition, they_did, we_did}`, the two lanes apart, never a later read of
   *  the record. A document without the block answers both lanes empty; an edition not ratified (or never authored)
   *  `NO_SUCH_CASE_EDITION`. Writes nothing. */
  editionTimeline({ case: caseArg = null, caseId = null, edition = null } = {}) {
    const id = str(caseArg ?? caseId), ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1)
      return { ok: false, reason: "NO_ID", detail: localize("publication.index.editiontimeline_names_a_case_and", "editionTimeline names a case and a positive edition") };
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`, id, ed);
    if (!d) return { ok: false, reason: "NO_SUCH_CASE_EDITION", case: id, edition: ed,
                     detail: localize("publication.index.no_ratified_edition_of_that", "no ratified edition of that case answers here, so it states no published timeline") };
    return { ok: true, case: id, edition: ed, ...this.#timelineOfText(d.text) };
  }

  /* R63: the two lanes a signed document's text states. */
  #timelineOfText(text) {
    const t = timelineOf(parseFrontmatter(String(text ?? "")).data || {});
    return { they_did: t.they_did, we_did: t.we_did };
  }

  /* ---------------------------------------------------------------- R37: the editions a finding is published in */

  /** R37 (K171 (4)): every RATIFIED case edition whose members include `finding`, each with its case, edition, owning
   *  project (null for a case older than DEC-72), the member's pinned version and role, and its frozen pair per axis as
   *  that case's document states it (R7's frozen pair), never composed. `version` keeps the editions pinning that
   *  version, `project` the cases that project owns. An unsigned preparation is never an edition here. The read
   *  `conformance` R2 uses. */
  publishedEditionsOf({ finding = null, version = null, project = null } = {}) {
    const id = str(finding);
    if (!id) return { ok: false, reason: "NO_ID", detail: localize("publication.index.publishededitionsof_requires_a_finding", "publishedEditionsOf requires a finding") };
    const where = [`m.bundle_id=?`, `c.ratified_at IS NOT NULL`], args = [id];
    if (str(version)) { where.push(`m.version_sha=?`); args.push(str(version)); }
    if (str(project)) { where.push(`k.project_id=?`); args.push(str(project)); }
    const rows = this.#rows(
      `SELECT m.case_id, m.edition, m.version_sha, m.role, k.project_id FROM published_case_members m
         JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
         LEFT JOIN cases k ON k.case_id=m.case_id
        WHERE ${where.join(" AND ")} ORDER BY m.case_id, m.edition LIMIT ?`, ...args, EDITIONS_OF_MAX + 1);
    const truncated = rows.length > EDITIONS_OF_MAX;
    if (truncated) rows.length = EDITIONS_OF_MAX;
    const items = rows.map((r) => {
      const frozen = this.caseDocMemberFrozen(r.case_id, Number(r.edition));
      const own = frozen ? frozen.get(id) || null : null;
      /* A legacy (/1) case froze the pair in the member's own signed bytes: read from that edition's published row. */
      const legacy = !frozen && r.version_sha
        ? this.#one(`SELECT strength FROM published_bundles WHERE bundle_id=? AND bundle_sha=? ORDER BY edition LIMIT 1`,
                    id, r.version_sha) : null;
      const rowsOfPair = own ? own.strength : legacy && legacy.strength ? safeJson(legacy.strength) : null;
      const strength = {};
      for (const a of Array.isArray(rowsOfPair) ? rowsOfPair : [])
        if (a && a.axis) strength[a.axis] = { state: a.state ?? null, grade: a.grade ?? null };
      return { case: r.case_id, edition: Number(r.edition), project: r.project_id ?? null,
               version_sha: r.version_sha ?? null, role: r.role ?? null,
               strength: Array.isArray(rowsOfPair) ? strength : null };
    });
    return { ok: true, finding: id, items, limit: EDITIONS_OF_MAX, truncated };
  }

  /* ---------------------------------------------------------------- R41, R43: a case's cited parts, for reevaluation */

  /** R41 (N210, N163 (a); K363): a ratified case edition's cited parts, the latest ratified edition when `edition` is
   *  absent: `{case, edition, project, parts: [{bundle_id, capture_sha}], limit, truncated}`, at most CITED_PARTS_MAX,
   *  viewer-free. A cited part is a document the edition cites as evidence: a row of its SIGNED document's
   *  `case_citations` (`{target, version, capture}`, C-41.15) whose version names the capture it was pinned to
   *  (`pinned`, `only_capture`), once per (document, capture), in the document's order; `reevaluation` R14 grades that
   *  capture. A row naming no capture (`undetermined`, `no_capture`, `no_bytes`) has nothing to grade and is no part,
   *  and neither is a member finding (it holds no capture). A document older than /4 signed no citations: no parts.
   *  The part is the capture, not a `bundle_sha`: the edition pins a capture, never the cited document's version
   *  (K365). `project` is
   *  the case's owning project, null for a case older than DEC-72. Registered with R43 as reevaluation's
   *  `registerCaseParts` (its R26). A case with no ratified edition (or not that one) answers `NO_SUCH_CASE_EDITION`;
   *  no case named, `NO_ID`. Writes nothing. */
  caseCitedParts({ case: caseArg = null, caseId = null, edition = null } = {}) {
    const id = str(caseArg ?? caseId);
    if (!id) return { ok: false, reason: "NO_ID", detail: localize("publication.index.casecitedparts_names_a_case", "caseCitedParts names a case") };
    const want = edition == null || edition === "" ? null : Number(edition);
    const row = Number.isInteger(want)
      ? this.#one(`SELECT edition FROM published_cases WHERE case_id=? AND edition=? AND ratified_at IS NOT NULL`, id, want)
      : want === null
        ? this.#one(`SELECT MAX(edition) AS edition FROM published_cases WHERE case_id=? AND ratified_at IS NOT NULL`, id)
        : null;
    if (!row || row.edition == null)
      return { ok: false, reason: "NO_SUCH_CASE_EDITION", case: id, edition: Number.isInteger(want) ? want : null,
               detail: localize("publication.index.no_ratified_edition_of_that_2", "no ratified edition of that case answers here, so it cites nothing yet") };
    const ed = Number(row.edition);
    const owner = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, id);
    /* The signed bytes, and nothing else: an unsigned re-authoring of the same edition cannot reach here. */
    const doc = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`, id, ed);
    const signed = doc ? signedCitations(doc.text) : { state: "undetermined", rows: null };
    const seen = new Set(), parts = [];
    for (const c of Array.isArray(signed.rows) ? signed.rows : []) {
      const target = c && typeof c.target === "string" ? c.target.trim() : "";
      const capture = c && typeof c.capture === "string" ? c.capture.trim().toLowerCase() : "";
      if (!target || !CITATION_NAMES_CAPTURE.includes(c.version) || !/^[0-9a-f]{64}$/.test(capture)) continue;
      const k = `${target}\u0000${capture}`;
      if (seen.has(k)) continue;
      seen.add(k);
      parts.push({ bundle_id: target, capture_sha: capture });
    }
    const truncated = parts.length > CITED_PARTS_MAX;
    return { ok: true, case: id, edition: ed, project: owner ? owner.project_id ?? null : null,
             parts: parts.slice(0, CITED_PARTS_MAX), limit: CITED_PARTS_MAX, truncated };
  }

  /** R43 (N210; K359): the cases holding at least one ratified edition, in case id order after `after`, at most `limit`
   *  (default RATIFIED_CASES_MAX, clamped to 1–RATIFIED_CASES_MAX): `{cases: [case_id], cursor}`, `cursor` the last case
   *  answered when more follow, else null, so reevaluation pages through them (a case is no bundle; only this module
   *  can list them). Viewer-free; writes nothing. */
  ratifiedCases({ after = null, limit = null } = {}) {
    const cap = pageOf(limit, RATIFIED_CASES_MAX);
    const rows = this.#rows(
      `SELECT DISTINCT case_id FROM published_cases WHERE ratified_at IS NOT NULL AND case_id > ?
        ORDER BY case_id LIMIT ?`, typeof after === "string" ? after : "", cap + 1);
    const more = rows.length > cap;
    const cases = rows.slice(0, cap).map((r) => r.case_id);
    return { ok: true, cases, limit: cap, cursor: more ? cases[cases.length - 1] : null };
  }

  /* ---------------------------------------------------------------- R61: what moved to case-tensions, and its provider */

  /* The case relation and revision flags (R4–R6), the tensions after publication (R50) and observation attribution (R17,
     R39, R60) are `case-tensions`' since T33 (its R1–R7; K617, K1505), retired here as moved, and since T35 (N597) each
     importer reads them there; since T36 (K1643) `caseRelation` too, so this module serves none of them (R61). */

  /** R61 (K1505 (3), K1634): the provider this module registers with `case-tensions` at start, its seven doors each
   *  answering exactly the rows the moved code read from this module's tables before the split, and the splice (R21).
   *  Every table and write stays here (R24); the one write is R21's, inside the caller's transaction. */
  publicationProvider() {
    return {
      module: "publication",
      /* the roster rows of existing case editions pinning `sha` of `bundleId`, with the case's owning project */
      pins: (bundleId, sha) => this.#rows(
        `SELECT m.case_id, m.edition, m.version_sha, m.role, k.project_id FROM published_case_members m
           LEFT JOIN cases k ON k.case_id=m.case_id
          WHERE m.bundle_id=? AND m.version_sha=? ORDER BY m.case_id, m.edition`, String(bundleId ?? ""), String(sha ?? ""))
        .map((r) => ({ case_id: r.case_id, edition: Number(r.edition), version_sha: r.version_sha, role: r.role ?? null,
                       project_id: r.project_id ?? null })),
      /* the unsigned case documents whose text names `bundleId` as a list entry (the index; the caller parses), and
         whether that case edition is ratified */
      preparations: (bundleId) => this.#rows(
        `SELECT d.case_id, d.edition, d.text, c.ratified_at FROM case_documents d
           LEFT JOIN published_cases c ON c.case_id=d.case_id AND c.edition=d.edition
          WHERE d.ratified_at IS NULL AND instr(d.text, ?) > 0 ORDER BY d.case_id, d.edition`,
        `  - target: ${String(bundleId ?? "")}\n`)
        .map((r) => ({ case_id: r.case_id, edition: Number(r.edition), text: r.text, ratified: r.ratified_at != null })),
      /* one edition's case document, read as the plane (no viewer: case-tensions' acts fence their own answers) */
      caseDocument: (caseId, edition) => {
        const d = this.#one(`SELECT d.case_id, d.edition, d.doc_sha, d.text, d.sig_armored, k.project_id FROM case_documents d
                               LEFT JOIN cases k ON k.case_id=d.case_id WHERE d.case_id=? AND d.edition=?`,
                            String(caseId ?? ""), Number(edition));
        return d ? { case_id: d.case_id, edition: Number(d.edition), doc_sha: d.doc_sha, text: d.text,
                     signed: !!d.sig_armored, project_id: d.project_id ?? null } : null;
      },
      /* an edition's roster, in its order */
      members: (caseId, edition) => this.#rows(
        `SELECT bundle_id, version_sha FROM published_case_members WHERE case_id=? AND edition=? ORDER BY ord`,
        String(caseId ?? ""), Number(edition)).map((r) => ({ bundle_id: r.bundle_id, version_sha: r.version_sha ?? null })),
      /* each case's latest ratified edition, owned by `project` when given, in case id order after `after` */
      latestRatified: ({ project = null, after = "", limit = 1 } = {}) => {
        const pid = str(project);
        return this.#rows(
          `SELECT l.case_id, l.edition, k.project_id FROM (SELECT case_id, MAX(edition) AS edition FROM published_cases
              WHERE ratified_at IS NOT NULL GROUP BY case_id) l LEFT JOIN cases k ON k.case_id=l.case_id
            WHERE l.case_id > ? ${pid ? "AND k.project_id = ?" : ""} ORDER BY l.case_id LIMIT ?`,
          typeof after === "string" ? after : "", ...(pid ? [pid] : []), Math.max(1, Math.floor(Number(limit)) || 1))
          .map((r) => ({ case_id: r.case_id, edition: Number(r.edition), project_id: r.project_id ?? null }));
      },
      /* the ratified case documents whose text holds `text`, at most `limit` */
      signedDocumentsNaming: (text, limit) => this.#rows(
        `SELECT text FROM case_documents WHERE ratified_at IS NOT NULL AND instr(text, ?) > 0
          ORDER BY case_id, edition LIMIT ?`, String(text ?? ""), Math.max(1, Math.floor(Number(limit)) || 1))
        .map((r) => ({ text: r.text })),
      /* R21's one splice */
      reauthorSection: (args) => this.reauthorSection(args),
    };
  }

  /* ---------------------------------------------------------------- R42: the captures published findings rest on */

  /** R42 (N230): in capture order after `after`, each capture a ratified finding's published basis rests on, with those
   *  findings and each one's owning projects: `{captures: [{capture_sha, findings: [{bundle_id, projects}]}], limit,
   *  truncated, cursor}`. `limit` defaults to RESTING_CAPTURES_MAX and is clamped to 1–RESTING_CAPTURES_MAX; `cursor`
   *  is the last capture answered when more follow, else null, so `monitoring` R33 follows it to the end (as intent R7).
   *  N315 (K380): each capture answers at most RESTING_FINDINGS_PER_CAPTURE of its findings, in finding id order, and
   *  `findings_truncated`, true when more rest on it; a page answers at most RESTING_FINDINGS_PER_PAGE findings in all,
   *  ending early (its `cursor` the last capture answered whole) rather than exceed it.
   *  Read as the plane: viewer-free, and it writes nothing.
   *  THE SOURCE ROWS, CONFIRMED (the R42 note): what a finding RESTS ON is its `serve`-class edge set (D-431,
   *  `publishedGraphEdges`), which the published graph holds as `published_edges` rows of disclosure `serve`, and, for
   *  a target not yet published, as the reference held privately for it (N256, `published_held_references`, until it
   *  is linked); a captured byte sequence is the register's (provenance's read contract), homed on a bundle that
   *  exists. A RATIFIED finding is one with a published edition that a committed case edition's roster names; its
   *  owning projects are those cases' (`cases`), null for a case older than DEC-72. `published_bundles` names no
   *  capture, and the published basis files would be a parse per finding, unpageable in capture order. */
  restingCapturesOf({ after = null, limit = null } = {}) {
    const cap = pageOf(limit, RESTING_CAPTURES_MAX);
    const rests = `WITH rests(finding, target) AS (
        SELECT e.from_bundle, e.to_bundle FROM published_edges e WHERE e.disclosure='serve'
        UNION SELECT h.from_bundle, h.to_bundle FROM published_held_references h WHERE h.linked_at IS NULL),
      ratified(finding, project) AS (
        SELECT DISTINCT m.bundle_id, k.project_id FROM published_case_members m
          JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
          LEFT JOIN cases k ON k.case_id=m.case_id
         WHERE EXISTS (SELECT 1 FROM published_bundles p WHERE p.bundle_id=m.bundle_id))`;
    const held = `FROM register r JOIN bundles b ON b.bundle_id=r.bundle_id
        JOIN rests x ON x.target=r.bundle_id JOIN ratified f ON f.finding=x.finding`;
    /* N315 (K380): each capture of the page with how many findings rest on it, counted to one past the per-capture
       bound, so the page can end before the 10,000th finding without reading one it will not answer. */
    const page = this.#rows(
      `${rests}, caps(capture_sha) AS (
          SELECT DISTINCT r.capture_sha ${held} WHERE r.capture_sha > ? ORDER BY r.capture_sha LIMIT ?)
       SELECT k.capture_sha, (SELECT COUNT(*) FROM (SELECT DISTINCT f.finding ${held}
                                WHERE r.capture_sha=k.capture_sha LIMIT ?)) AS n
         FROM caps k ORDER BY k.capture_sha`,
      typeof after === "string" ? after : "", cap + 1, RESTING_FINDINGS_PER_CAPTURE + 1);
    let truncated = page.length > cap;
    if (truncated) page.length = cap;
    const answered = [];
    let total = 0;
    for (const c of page) {
      const n = Math.min(Number(c.n) || 0, RESTING_FINDINGS_PER_CAPTURE);
      if (total + n > RESTING_FINDINGS_PER_PAGE) { truncated = true; break; }
      total += n;
      answered.push({ capture_sha: c.capture_sha, cut: Number(c.n) > RESTING_FINDINGS_PER_CAPTURE });
    }
    const by = new Map(answered.map((c) => [c.capture_sha, new Map()]));
    if (answered.length)
      for (const r of this.#rows(
        `${rests}, picked(capture_sha, finding) AS (
            SELECT capture_sha, finding FROM (
              SELECT DISTINCT r.capture_sha, f.finding, DENSE_RANK() OVER (PARTITION BY r.capture_sha ORDER BY f.finding) AS nth
                ${held} WHERE r.capture_sha IN (SELECT value FROM json_each(?))) WHERE nth <= ?)
         SELECT DISTINCT r.capture_sha, f.finding, f.project ${held}
           JOIN picked q ON q.capture_sha=r.capture_sha AND q.finding=f.finding
          ORDER BY r.capture_sha, f.finding, f.project`,
        JSON.stringify(answered.map((c) => c.capture_sha)), RESTING_FINDINGS_PER_CAPTURE)) {
        const fs = by.get(r.capture_sha);
        if (!fs) continue;
        if (!fs.has(r.finding)) fs.set(r.finding, []);
        fs.get(r.finding).push(r.project ?? null);
      }
    return { ok: true,
             captures: answered.map((c) => ({ capture_sha: c.capture_sha,
               findings: [...by.get(c.capture_sha)].map(([bundle_id, projects]) => ({ bundle_id, projects })),
               findings_truncated: c.cut })),
             limit: cap, truncated,
             cursor: truncated && answered.length ? answered[answered.length - 1].capture_sha : null };
  }

  /* ---------------------------------------------------------------- moved from the store */
  /* CASE-5b / DEC-72: THE FACTS THE CASE RATIFICATION NEEDS, out of the one
     place that holds the rows — `gateFacts`' own shape one altitude up, and for
     `gateFacts`' own reason: the gate and the write path must judge against the
     same published record, so they read it from one method rather than probing
     for it separately.

     `priorCase` IS C-21.1's FACT AT CASE ALTITUDE — what the previous RATIFIED
     edition of THIS case asserted about its own limits and its own bias. Passing
     it null does not soften C-21.1, it blinds it, which is the sentence `runGate`
     already carries about `publishedRegistry`.

     THE TEXT COMES BACK WHOLE. A ceremony whose subject is "a thing a member
     actually reviewed" cannot hand the member a summary of the thing. */
  caseDocumentFacts(caseId, edition, viewer, secretSha = null) {
    const id = String(caseId ?? "").trim();
    const ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1) return { ok: false, reason: "MALFORMED" };
    const doc = this.#one(
      `SELECT case_id, edition, doc_sha, text, authored_at, authored_by,
              sig_armored, attestor_key, attestor_member, delivered_by, gate_version, ratified_at
         FROM case_documents WHERE case_id=? AND edition=?`, id, ed);
    if (!doc) return noCaseDocument(id, ed);
    /* REC-130 / IC-141, 2026-09-18 — AN UNSIGNED CASE DOCUMENT IS WORKING
       MATERIAL, AND IT ANSWERS ONLY TO STANDING IN ITS OWNING PROJECT. DECIDED by
       BOB #14 as an application of the publication fence (unratified working
       material never crosses to the public), no new doctrine. CASE-5b answered it
       to anybody, and case ids come off a sequence, so a stranger could walk
       CASE-2026-0001, -0002, … and read every group's scope, roster, exclusions
       and bias acknowledgement before any member had signed a word of it.

       ABSENT AND INVISIBLE ARE ONE ANSWER — `contentRead`'s rule and
       `#queueCaseFor`'s. A caller without standing gets the object the branch
       above returns, built by the SAME function from the SAME two values, so the
       two cannot drift apart: a refusal saying FORBIDDEN or NOT_PERMITTED would
       tell an enumerator that the case exists, which is the one thing the
       enumerator is looking for.

       A RATIFIED document is untouched: it is signed published bytes a stranger
       is entitled to check, and the stranger-verification path must not depend
       on this instance's goodwill.

       THIS SITE SERVES BOTH `op=casedocument` AND `op=caseratify`'s facts read,
       and the second is not incidental. `caseratify` answers a session member
       CASE_RATIFY_STALE with the document's `expected` sha, and
       TESTIMONY_CASE_UNPUBLISHABLE with finding ids, so a member of ANOTHER
       project could otherwise probe an unsigned case through the signing op. A
       member cannot sign what they may not read, so the one gate covers both. */
    /* REC-126 / IC-145 — AND A LIVE GRANT HOLDER FOR THIS CASE EDITION, which is the
       party §6A.2's precondition names beside project standing and REC-130 left for
       this item to build. The grant is asked through `#liveReviewGrant`, the one
       predicate the review copy itself reads, so a revoked grant, a grant whose
       draft has moved to another edition and a secret that never existed are all
       answered here exactly as a stranger is: the no-such-document object above. */
    if (!doc.ratified_at && !this.hasCaseStanding(doc, viewer)
        && !this.#grantAdmitsCaseEdition(secretSha, doc.case_id, doc.edition))
      return noCaseDocument(id, ed);
    return {
      ok: true, doc,
      signers: this.credentials.attestingKeys(),   /* credentials R11: the ONE predicate (D-158) */
      priorCase: this.#one(
        `SELECT edition, completeness, bias_acknowledgement FROM published_cases
          WHERE case_id=? AND edition<? AND ratified_at IS NOT NULL ORDER BY edition DESC LIMIT 1`, id, ed),
      /* MK-1 (A): whether any finding THIS DOCUMENT names rests on a member's
         authored observation (C-53.12). The roster is read from the document's
         own bytes — `case_findings`, the same field `ratifyCaseDocument` commits
         from — so the fence judges exactly what the signature would publish. */
      testimony: this.basisVersions.testimonyReach((() => {
        const cf = (parseFrontmatter(doc.text).data || {}).case_findings;
        return (Array.isArray(cf) ? cf : []).map((x) => String(x ?? "").trim());
      })()),
      /* MK-7 / §4.4: the attribution this document states for each observation it reaches, beside what the
         authors' acts say now and which reached observations still name their author (§4.1) — the facts
         op=caseratify's attribution gate judges, read off the same bytes the signature would publish
         (`case-tensions` R5, was this module's R17). */
      attribution: this.caseTensionsModule.attributionFacts(doc),
      /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): each roster member's `basis` AT THE BYTES
         THIS DOCUMENT PINS, for the C-2.8 arms that followed the frozen pair into the case document
         (the testimony row, the per-ground rows). Read at the PIN and never at the working version:
         the frozen pair is this case's reading of those bytes. A member whose pinned bytes this store
         cannot produce is ABSENT from the map, which leaves those two arms unasked for it rather than
         asked of a basis nobody pinned — `checkCaseDocument` reads absence as absence. Each entry is `{basis, references}`
         (R79): the member's basis array and the references its pinned bytes state. */
      memberBasis: this.#pinnedMemberBasis(doc.text),
      /* R2, R20 (N364): a /5 document's `captures:` and `sources:` blocks, as its bytes state them; null (with
         `blocks_detail`) for an older format or a block it does not carry. */
      ...(() => { const b = caseDocumentBlocks(doc.text);
                  return { captures: b.captures, sources: b.sources, blocks_detail: b.detail }; })(),
    };
  }

  #pinnedMemberBasis(docText) {
    const dfm = parseFrontmatter(String(docText || "")).data || {};
    const out = {};
    for (const r of Array.isArray(dfm.case_roles) ? dfm.case_roles : []) {
      if (!r || typeof r !== "object" || typeof r.target !== "string") continue;
      const text = this.record.textAtSha(r.target, typeof r.version_sha === "string" ? r.version_sha : null);
      if (text === null) continue;
      const mfm = parseFrontmatter(text).data || {};
      /* R79 (fix round 10): the member's references travel with its basis, as case-catalogue's live-leg filter reads them
         from the member's own frontmatter; a severed citation the pinned bytes state must reach the case's member arm. */
      out[r.target] = {
        basis: Array.isArray(mfm.basis) ? mfm.basis : [],
        references: Array.isArray(mfm.references) ? mfm.references : [],
      };
    }
    return out;
  }

  /* D-442 — `case_exclusions`, projected WHOLE for one case edition from its stored document, by the
     delete-then-insert discipline every projection here takes. A signed document cannot change, so a
     re-projection of one only rewrites the same rows. */
  projectCaseExclusions(caseId, edition) {
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, caseId, Number(edition));
    this.sql.exec(`DELETE FROM case_exclusions WHERE case_id=? AND edition=?`, caseId, Number(edition));
    if (!d || typeof d.text !== "string") return;
    const dfm = parseFrontmatter(d.text).data || {};
    const comp = dfm.completeness && typeof dfm.completeness === "object" ? dfm.completeness : {};
    const rows = Array.isArray(dfm.completeness_excluded) ? dfm.completeness_excluded : [];
    const project = typeof dfm.case_project === "string" && dfm.case_project !== "null" ? dfm.case_project : null;
    const members = (Array.isArray(dfm.case_roles) ? dfm.case_roles : [])
      .filter((r) => r && typeof r === "object" && typeof r.target === "string");
    for (const m of members)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object") continue;
        this.sql.exec(
          `INSERT INTO case_exclusions (case_id,edition,bundle_id,ord,member_edition,project_id,target_id,description,reason,author,at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          caseId, Number(edition), m.target, i, Number.isInteger(m.edition) ? m.edition : null, project,
          typeof row.target === "string" ? row.target : null,
          typeof row.description === "string" ? row.description : "",
          typeof row.reason === "string" ? row.reason : "",
          typeof comp.author === "string" ? comp.author : "",
          typeof comp.at === "string" ? comp.at : "");
      }
  }

  /* R55 (K651): the one reader of a case document's per-member frozen facts, a service to `public-read` (its R3, R4)
     as to R53 and the commit; it writes nothing and never throws.
     D-442 / BIO_Publication_v0_1.md §3 rule 12 — WHAT A CASE DOCUMENT STATES ABOUT ONE MEMBER, OR
     NULL FOR A LEGACY (/1) DOCUMENT, whose members carried these blocks in their own bytes (rule 12
     (e)). THE ONE READER of `case_roles[].edition`, `case_strength` and `case_strength_grounds`:
     the ratify committer and `caseEditionState` both ask here, so the per-case frozen facts are
     parsed one way. `strength` is the member-bytes block's row shape exactly (`axis`, `state`,
     `grade`, `weakest`, `load_bearing`, `population`, `detail`), so every consumer of the old
     `published_strength` reads it unchanged. */
  caseDocMemberFrozen(caseId, edition) {
    /* R55: never throws; a document this read cannot read or parse states nothing it can answer. */
    try { return this.#caseDocMemberFrozen(caseId, edition); } catch { return null; }
  }

  #caseDocMemberFrozen(caseId, edition) {
    const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, caseId, Number(edition));
    if (!d || typeof d.text !== "string") return null;
    const dfm = parseFrontmatter(d.text).data || {};
    if (!caseDocumentStatesMemberBlocks(dfm)) return null;
    const strip = ({ target, ...rest }) => rest;
    const rowsOf = (key, m) => (Array.isArray(dfm[key]) ? dfm[key] : [])
      .filter((r) => r && typeof r === "object" && String(r.target ?? "") === m).map(strip);
    const out = new Map();
    /* The case's `## What This Excludes`, which a member published under rule 12 no longer carries
       in its own bytes: served beside each member so the public read prints the CASE's words and
       says so (op=publishedcase's `excludes_from`). */
    const excludes = caseSectionText(parseFrontmatter(d.text).body || "", "## What This Excludes");
    for (const r of Array.isArray(dfm.case_roles) ? dfm.case_roles : []) {
      if (!r || typeof r !== "object" || typeof r.target !== "string") continue;
      out.set(r.target, { edition: Number.isInteger(r.edition) ? r.edition : null, excludes,
                          version_sha: typeof r.version_sha === "string" ? r.version_sha : null,
                          strength: rowsOf("case_strength", r.target),
                          grounds: rowsOf("case_strength_grounds", r.target) });
    }
    return out;
  }


  /* REC-130: STANDING IN THE OWNING PROJECT, ASKED THROUGH D-15's ONE
     COMPILATION POINT rather than restated. `viewerPredicate` already answers
     "may this viewer see this project" — an identified member sees it if they
     participate in it (invited, joined or leaving) or are an active
     administrator (Membership Architecture 7.3/7.9), an instance-level machine
     credential sees it unfiltered, and anything else is DENY. A second
     implementation of that rule here would be this repository's most-repeated
     defect class, so the predicate is run against the project's own bundle row.

     THE OWNING PROJECT is every project the record names for this case: the
     `cases` row, written at an earlier edition's ratification, and the document's
     own `case_project`, which is what this edition's signature would commit.
     Standing is required in EACH — they agree on every case the ceremony can
     produce, and where they did not, reading the document would need both.

     A DOCUMENT NAMING NO PROJECT answers only the unfiltered scope. The ceremony
     cannot author one (DEC-72 removed the project-less path before CASE-5b built
     case documents), so this arm is defence rather than policy, and it fails
     closed for every identified member rather than guessing an owner. */
  hasCaseStanding(doc, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return false;
    if (gate.scope === "member") return true;
    const named = String((parseFrontmatter(doc.text).data || {}).case_project ?? "").trim();
    const row = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, doc.case_id);
    const projects = [...new Set([named, row?.project_id ?? ""].filter(Boolean))];
    if (!projects.length) return false;
    return projects.every((p) => !!this.#one(
      `SELECT 1 AS seen FROM bundles b WHERE b.bundle_id=? AND b.object_type='project' AND ${gate.sql}`,
      p, ...gate.args));
  }

  /* Read-only, for the member who is about to sign — and, once RATIFIED, for
     anybody, because a ratified document is the signed bytes a stranger is
     entitled to check (the posture `op=publishedbytes` takes one altitude
     down). REC-130 CORRECTED the other half of this comment: it said "scoped to
     nothing" of the UNRATIFIED document too, which was a mechanism choice with
     no ruling behind it. The scoping now lives in `caseDocumentFacts`. */
  caseDocument(caseId, edition, viewer, secretSha = null) {
    const facts = this.caseDocumentFacts(caseId, edition, viewer, secretSha);
    if (!facts.ok) return facts;
    const d = facts.doc;
    return { ok: true, case_id: d.case_id, edition: d.edition, doc_sha: d.doc_sha, text: d.text,
             authored_at: d.authored_at, authored_by: d.authored_by,
             /* THE WINDOW, STATED. `ratified: false` is a real state of this
                record — a ceremony authored and not yet signed — and it is named
                rather than inferred from a null. */
             ratified: !!d.ratified_at, ratified_at: d.ratified_at ?? null,
             /* R70: when a published edition was signed and when it was published; null while unsigned. */
             ...(d.ratified_at ? this.#editionDates(d.case_id, d.edition, d.ratified_at)
                               : { signed_at: null, published_at: null }),
             sig_armored: d.sig_armored ?? null, attestor_member: d.attestor_member ?? null,
             /* REC-128: who DELIVERED the signature, beside who MADE it. Null
                while the document is unsigned — there is no delivery yet, which
                is a different fact from a delivery nobody recorded. */
             delivered_by: d.ratified_at ? this.#deliveredBy(d) : null,
             gate_version: d.gate_version ?? null,
             /* REC-219 / D-579(a) (BOB #34, 2026-09-25 02:30Z): WHICH VERSION EACH CITATION RESTS ON, as the
                SIGNED BYTES say it. A /4 document signed its edges with their versions, and they are read
                straight out of the bytes above, never recomputed. An older document signed NO edge and no
                version, so the answer states that rather than reading the project's edges as they stand
                today — which would be the case claiming citations it never signed — and it is never
                re-signed (rule 1). */
             citations: signedCitations(d.text),
             /* T51 E4: THE FINDINGS THE DOCUMENT PINS, under its own names, beside the citations (whose rows are the
                project's citation edges, never the roster). A reloaded ceremony rebuilds what the edition names from
                this; null when the bytes state no roster (R28). */
             findings: this.#pinnedFindings(d.text) };
  }

  /* `case_findings` in the document's order, each with the pin and role its `case_roles` row states (null where the
     roster names a finding no row pins). Null, never `[]`, when the bytes state no roster; never throws. */
  #pinnedFindings(docText) {
    try {
      const dfm = parseFrontmatter(String(docText || "")).data || {};
      if (!Array.isArray(dfm.case_findings)) return null;
      const rows = new Map((Array.isArray(dfm.case_roles) ? dfm.case_roles : [])
        .filter((r) => r && typeof r === "object" && typeof r.target === "string").map((r) => [r.target, r]));
      return dfm.case_findings.map((f) => {
        const target = String(f ?? "").trim();
        const r = rows.get(target);
        return { target, version_sha: typeof r?.version_sha === "string" ? r.version_sha : null,
                 role: typeof r?.role === "string" ? r.role : null };
      });
    } catch { return null; }
  }

  /* D-442 / BIO_Publication_v0_1.md §3 rule 12: a member's edition and frozen pair as the RATIFIED
     case documents pinning exactly these bytes state them. Null when every pinning document is
     legacy (/1) — those members carried the blocks in their own bytes. The edition and the pair are
     each taken only where every /2 document agrees; a disagreement is returned as undetermined and
     never resolved by picking one (CLAUDE.md §4: undetermined is first-class). */
  frozenFromPinningDocuments(bundleId, bundleSha, pins) {
    const seen = [];
    for (const pin of pins) {
      const map = this.caseDocMemberFrozen(pin.case_id, Number(pin.edition));
      const row = map ? map.get(bundleId) : null;
      if (row && row.version_sha === bundleSha) seen.push(row);
    }
    if (!seen.length) return null;
    const eds = [...new Set(seen.map((r) => r.edition))];
    const pairs = [...new Set(seen.map((r) => JSON.stringify(r.strength)))];
    return { edition: eds.length === 1 ? eds[0] : null,
             strength: pairs.length === 1 && seen[0].strength.length ? seen[0].strength : null,
             strengthUndetermined: pairs.length > 1 };
  }

  /* R53 (K651): the one answer to what a case edition is, a service to `public-read` (its R3, R6) as to this module's
     commit (R22); it composes no case-level strength (R26), and its one write is the completion stamp below.
     REC-44: what a case edition is, and whether it is COMPLETE. One place, so
     the ratify path (which must know whether to assemble the container) and the
     public read path (which must say so) cannot disagree about it. Returns the
     facts the control plane needs to build the manifest and nothing derived:
     in particular NO case-level strength, because there is no such thing —
     every member's frozen PAIR travels with that member. */
  caseEditionState(caseId, ed, group = null) {
    const c = this.#one(`SELECT scope, completeness, bias_acknowledgement, bar, opened, ratified_at, manifest_sha, criteria
                         FROM published_cases WHERE case_id=? AND edition=?`, caseId, ed);
    if (!c) return null;
    /* CASE-5 / DEC-72 clause 2: WHOSE PRODUCTION, on the one accessor that
       answers "what IS this case edition". It is the case IDENTITY's project
       (`cases` is keyed on `case_id` alone, CASE-1's sharpest call), so it is
       read once here rather than per edition — a case does not change hands
       between editions and a per-edition read would imply it could. NULL for a
       case published before DEC-72, which CASE-1's schema comment says is the
       honest answer and not a gap. */
    const owner = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, caseId);
    /* CASE-3: `version_sha` — THE PIN — travels with the roster row, because a
       reader of a case edition must be able to say WHICH VERSION of each member
       the case froze, and a freeze nobody can read is not one the reader can
       rely on. It is served beside `bundle_sha` and is NOT a second spelling of
       it: `bundle_sha` is what the published row HOLDS NOW and `version_sha` is
       what the case COMMITTED TO. NULL means rostered and not yet pinned,
       exactly as the column comment says.

       ===== CASE-5 / DEC-72: THE ARTIFACT FLIP, AND THIS PREDICATE IS ITS HEART.
       CASE-3 landed the pin and handed this line on in terms: *"resolving a
       member BY THE PIN instead of by the CASE'S edition number is NOT done …
       CASE-5 is where they can diverge and where the pin starts doing work no
       other column can."* This is that line.

       WHAT IT WAS: `published_bundles WHERE bundle_id=? AND edition=?` at the
       CASE'S edition number — the conflation `schema.mjs`'s `version_sha`
       comment names, *"only correct while one case owns one finding"*. Now that
       `op=publish` stamps a member's OWN edition, a member of case edition 2 can
       sit at its own edition 1, and the old predicate does not merely return a
       different row: IT RETURNS NOTHING. The member falls into `awaiting`, the
       edition reads INCOMPLETE forever, and no container is ever assembled — a
       published case silently claiming it is still waiting for a finding that
       ratified. That is what the negative control arms and it fails by name.

       THE PIN IS THE ONLY COLUMN THAT CAN ANSWER IT, and that is the point
       rather than a preference: a hash identifies a version, and the case
       committed to a hash. `AND version_sha IS NOT NULL` is not needed on the
       lookup — a NULL pin never reaches it, because the fallback below owns that
       row.

       THE FALLBACK IS FOR ROWS WRITTEN BEFORE CASE-3, WHOSE PIN IS HONESTLY
       NULL, and it is the OLD predicate unchanged. Those editions were published
       under the slaved model where the two numbers were equal, so reading them
       at the case's number is not a guess — it is the fact those rows were
       written under. A row that is pinned is never read that way, so a pin can
       never be silently bypassed by the compatibility path. */
    const roster = this.#rows(
      `SELECT ord, bundle_id, version_sha, role FROM published_case_members
       WHERE case_id=? AND edition=? ORDER BY ord`, caseId, ed);
    const MEMBER_COLS = `bundle_id, edition, title, bundle_sha, ratified_at, attestor_key, attestor_member,
                         delivered_by, gate_version, sig_armored, strength, required, parts`;
    const findings = [], awaiting = [];
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (b), (d): THE PER-CASE FROZEN FACTS FOLLOW THEIR
       BLOCK. Under /2 each member's edition, frozen pair and grounds are what THIS CASE'S document
       states — this case's reading of that finding at the pinned sha — and not the finding row's
       projection, which carries one reading however many cases pin the bytes. So op=publishedcase and
       the container (both built from this method) read each member's frozen facts from the case
       document; a legacy (/1) case keeps reading the member's own ratified pair, as it always did. */
    const docFrozen = this.caseDocMemberFrozen(caseId, ed);
    for (const m of roster) {
      const r = m.version_sha
        ? this.#one(`SELECT ${MEMBER_COLS} FROM published_bundles WHERE bundle_id=? AND bundle_sha=?`,
                    m.bundle_id, m.version_sha)
        : this.#one(`SELECT ${MEMBER_COLS} FROM published_bundles WHERE bundle_id=? AND edition=?`,
                    m.bundle_id, ed);
      if (!r) { awaiting.push(m.bundle_id); continue; }
      const frozenHere = docFrozen ? docFrozen.get(m.bundle_id) || null : null;
      findings.push({ ord: m.ord, bundle_id: r.bundle_id, title: r.title, bundle_sha: r.bundle_sha,
                      version_sha: m.version_sha ?? null,
                      /* CASE-5: THE MEMBER'S OWN EDITION, served rather than
                         implied. Before the flip a reader could take the case's
                         edition as every member's and be right; now they cannot,
                         and a surface that has to guess would guess wrong on
                         exactly the members the pin exists for. */
                      edition: r.edition,
                      /* CASE-5: the AUTHORED designation on the one accessor
                         that answers what a case edition IS. CASE-2 wrote it into
                         the roster row and into every member's signed bytes; the
                         container manifest and the public read both need it, and
                         both of them come through here. */
                      role: m.role ?? null,
                      ratified_at: r.ratified_at, gate_version: r.gate_version, sig_armored: r.sig_armored,
                      attestor: { member: r.attestor_member, key_b64: r.attestor_key },
                      /* REC-128: who SIGNED is `attestor`; who DELIVERED is this. */
                      delivered_by: this.#deliveredBy(r),
                      strength: frozenHere ? frozenHere.strength : (r.strength ? JSON.parse(r.strength) : null),
                      /* D-442: the frozen BRANCHES, where the case document states them. A legacy
                         member's grounds are in its own signed bytes and were never on this row. */
                      ...(frozenHere ? { grounds: frozenHere.grounds } : {}),
                      frozen_from: frozenHere ? "case_document" : "member_bytes",
                      ...(frozenHere ? { case_excludes: frozenHere.excludes ?? null } : {}),
                      required: r.required ? JSON.parse(r.required) : null,
                      parts: r.parts ? JSON.parse(r.parts) : [] });
    }
    const complete = roster.length > 0 && awaiting.length === 0;
    /* The instant the LAST member landed is the instant the case edition was
       ratified. Stamped once and never re-stamped: a re-ratification of the
       same bytes is a retry, not a revision. */
    if (complete && !c.ratified_at) {
      const at = findings.reduce((mx, x) => (instantOrder(x.ratified_at, mx) > 0 ? x.ratified_at : mx), findings[0].ratified_at);
      this.sql.exec(`UPDATE published_cases SET ratified_at=? WHERE case_id=? AND edition=?`, at, caseId, ed);
      c.ratified_at = at;
    }
    return { caseId, edition: ed, group: group ?? null,
             /* CASE-5 / DEC-72 clause 2, and the pair is one fact in two halves:
                WHOSE production this case is, and WHAT STANDARD it was held to.
                They belong together because the second is only meaningful as the
                first's property — "bar: B/B" with no publisher is a requirement
                nobody asserted, which is the shape DEC-72 spent a whole ruling
                removing. Both are served here rather than derived by any caller,
                so the ratify path and the public read cannot disagree about them
                any more than they can about the scope. */
             project: owner ? owner.project_id : null,
             bar: c.bar ? safeJson(c.bar) : null,
             scope: c.scope ?? null,
             /* ===== CASE-5b: THE SIGNED CASE DOCUMENT, ON THE ONE ACCESSOR THAT
                ANSWERS WHAT A CASE EDITION IS — and it is here rather than in the
                container assembler for REC-44's stated reason: the ratify path
                and the public read must not be able to disagree about the answer.

                WHY A STRANGER NEEDS IT, which is the whole reason this item did
                not stop at deleting six keys. Before CASE-5b a stranger holding
                one member's bundle.md could read the case's scope, roster,
                partition, bias acknowledgement and bar out of that member's
                signed bytes — REC-44's property, and the container manifest's
                whole premise (S9). Those facts are no longer in a member's
                bytes. If the container carried them only as manifest FIELDS,
                they would be assertions THIS INSTANCE made, checkable against
                nothing — exactly the ambiguity the manifest's own format comment
                says it exists to refute. Carrying the document and its signature
                puts the stranger back where they were, holding bytes somebody
                signed, verifiable with ssh-keygen against a key the artifact
                names, WITHOUT contacting this instance.

                NULL UNTIL RATIFIED, and never a partial. An unsigned case
                document is a ceremony in progress and there is nothing for a
                stranger to check in it. */
             document: (() => {
               const d = this.#one(
                 `SELECT doc_sha, text, sig_armored, attestor_key, attestor_member, delivered_by, gate_version, ratified_at
                    FROM case_documents WHERE case_id=? AND edition=? AND ratified_at IS NOT NULL`,
                 caseId, ed);
               /* R70 (DEC-147 (5)): `signed_at` the signature's instant at the ceremony, `published_at` the commit's; one
                  instant for both when published at signing or committed before T34. */
               return d ? { doc_sha: d.doc_sha, text: d.text, sig_armored: d.sig_armored,
                            attestor: { member: d.attestor_member, key_b64: d.attestor_key },
                            delivered_by: this.#deliveredBy(d),
                            gate_version: d.gate_version, ratified_at: d.ratified_at,
                            ...this.#editionDates(caseId, ed, d.ratified_at) } : null;
             })(),
             /* REC-47 / DEC-46 (a): the bias the case was produced under travels
                with it, on every surface that serves the case block. DEC-20 is
                the reason it is a plain disclosure here and not a verdict —
                the reader weighs it; this plane never does. */
             bias_acknowledgement: c.bias_acknowledgement ?? null,
             completeness: c.completeness ? JSON.parse(c.completeness) : null,
             /* `opened` STAYS, DECIDED 2026-08-05 (REC-58) — a decision, not an
                omission, which is what that item was raised to leave here.
                It is the instant the case edition was opened, off the
                `published_cases` row this method already reads.

                IT IS COMPUTED HERE AND PUBLISHED NOWHERE, and both halves are
                deliberate. REC-58 re-measured the consumers across the whole
                repository — 228 files, 7,804,893 characters, both embeds of the
                bundled plane excluded structurally and the GENERATOR kept in —
                and found ZERO reads outside this file. The only reads that
                exist are this method reading its own SQL row.

                So why keep it. Removing it would not retire a publication,
                because there is none to retire: both callers of this method
                pick their fields by name (`publishedCase()` since IC-22, and
                the control plane on `publish()`'s side, twice). What removal
                WOULD do is delete a real recorded fact from the one accessor
                whose job is to answer "what IS this case edition" — REC-44 put
                it here precisely so the ratify path and the public read cannot
                disagree about the answer, and a future consumer that needs the
                instant work began should find it here rather than re-deriving
                it from SQL at a second site.

                WHAT THIS IS NOT: it is not a claim that the field is wanted.
                Nothing wants it today, and that is stated rather than dressed
                up. It is the narrower claim that an unconsumed COMPUTATION on
                the internal accessor costs a reader nothing, while an
                unconsumed PUBLICATION costs them a field they must reason
                about — which is the distinction IC-22 acted on and this keeps.

                THE FENCE IS THE PART THAT MATTERS: R53 names `opened` in this
                answer and its test (`test/m/publication/services.test.mjs`)
                holds the key, so deleting it fails; that each consumer NAMES
                its fields and none spreads this state is the consumer's to
                keep (`public-read` reads it, its R3, R6). */
             /* R63 (K1632): the timeline its signed document states, the lanes apart; null until it is ratified. */
             timeline: (() => {
               const d = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND ratified_at IS NOT NULL`,
                                   caseId, ed);
               return d ? this.#timelineOfText(d.text) : null;
             })(),
             opened: c.opened, ratified_at: c.ratified_at ?? null,
             manifest_sha: c.manifest_sha ?? null,
             /* R72 (N649): the criteria frozen at the commit, in member then leg order, each with its label; null for an
                edition committed before T35, stated as not recorded and never filled. */
             criteria: c.criteria == null ? null : safeJson(c.criteria),
             ...(c.criteria == null ? { criteria_detail: CRITERIA_NOT_RECORDED } : {}),
             complete, awaiting, findings,
             detail: complete
               ? localize("publication.index.every_finding_in_this_case", "every finding in this case edition is ratified, so the container can be assembled whole")
               : localize("publication.index.this_case_edition_is_incomplete", "this case edition is INCOMPLETE: {awaiting} of {total} findings are not yet ratified. The findings that are published answer individually; the container cannot be assembled until the last one lands, because it would otherwise claim to carry findings it does not have.", { awaiting: String(awaiting.length), total: String(roster.length) }) };
  }

  /* REC-44: the case CONTAINER's manifest, handed back by the control plane
     (which is where the SHA-256 and the R2 copy live) once the edition
     completed. Stored on the case row rather than on any member's, because the
     manifest describes the CASE — one manifest per case per edition, naming
     every member finding's parts and every member's own signature. The
     published_shas row is what makes it answerable by its own hash and what
     op=publishedbytes checks before serving anything. */
  recordCaseManifest({ caseId, edition, manifest, manifestSha, bytes = null, built = undefined } = {}) {
    /* R15: a case id, a whole edition, a manifest object, its SHA-256 as 64 lowercase hex, a byte count that is a
       whole number or absent, and `built` absent or a boolean; anything else is MALFORMED and nothing is written (never a
       throw). `built: true` (fix round 10, cause 27a; K5084) records the case file built in the same transaction, the caller
       passing it only after every file of the manifest, its own bytes included, is stored. */
    if (!(built == null || typeof built === "boolean")) built = Symbol.for("malformed");
    if (typeof caseId !== "string" || !caseId.trim() || !Number.isInteger(Number(edition)) || Number(edition) < 1
        || !manifest || typeof manifest !== "object" || typeof manifestSha !== "string" || !/^[0-9a-f]{64}$/.test(manifestSha)
        || !(bytes == null || (Number.isInteger(bytes) && bytes >= 0)) || typeof built === "symbol")
      return { ok: false, reason: "MALFORMED",
               detail: localize("publication.index.a_case_manifest_names_its", "a case manifest names its case, its edition, the manifest and its SHA-256 (64 lowercase hex)") };
    const ed = Number(edition);
    return this.record.transact(() => {
      const c = this.#one(`SELECT manifest_sha FROM published_cases WHERE case_id=? AND edition=?`, caseId, ed);
      if (!c) return { ok: false, reason: "NO_SUCH_CASE_EDITION", caseId, edition: ed };
      /* R15, R24: recorded once. The same hash again is a retry and writes nothing (the manifest held is the one that
         hash was recorded for, whatever this call carries); another hash is refused. */
      if (c.manifest_sha === manifestSha) {
        if (built === true) this.#markCaseFileBuilt(caseId, ed);
        return { ok: true, caseId, edition: ed, manifest_sha: manifestSha, existed: true };
      }
      if (c.manifest_sha)
        return { ok: false, reason: "MANIFEST_EXISTS", caseId, edition: ed, manifest_sha: c.manifest_sha,
                 detail: localize("publication.index.case_edition_already_has_a", "case {caseId} edition {ed} already has a manifest at a different hash. An edition is a SEPARATE DOCUMENT and its container answers forever; a second manifest under the same number would leave a reader unable to say which container they checked.", { caseId: String(caseId), ed: String(ed) }) };
      this.sql.exec(`UPDATE published_cases SET manifest_sha=?, manifest=? WHERE case_id=? AND edition=?`,
                    manifestSha, JSON.stringify(manifest), caseId, ed);
      this.sql.exec(
        `INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)
         ON CONFLICT(sha256,bundle_id,path) DO NOTHING`,
        manifestSha, caseId, "MANIFEST.json", "manifest", bytes ?? null, this.#when());
      /* R15 (K1315): every file the manifest lists is registered in the same act, so each is served by hash. */
      let files = 0;
      for (const f of Array.isArray(manifest.files) ? manifest.files : []) {
        if (!f || typeof f !== "object" || typeof f.sha256 !== "string" || !HEX64.test(f.sha256)
            || typeof f.path !== "string" || !f.path) continue;
        this.sql.exec(
          `INSERT INTO published_shas (sha256,bundle_id,path,kind,bytes,published) VALUES (?,?,?,?,?,?)
           ON CONFLICT(sha256,bundle_id,path) DO NOTHING`,
          f.sha256, caseId, f.path, typeof f.kind === "string" && f.kind ? f.kind : "case_file",
          Number.isInteger(f.bytes) ? f.bytes : null, this.#when());
        files++;
      }
      if (built === true) this.#markCaseFileBuilt(caseId, ed);
      return { ok: true, caseId, edition: ed, manifest_sha: manifestSha, ...(files ? { files } : {}) };
    });
  }

  /* R15: the case file built, for an edition whose manifest is recorded, inside the caller's transaction; a built file is
     left as it is. Written by `recordCaseManifest`'s `built: true`; `recordCaseFileAttempt` writes `built` itself. */
  #markCaseFileBuilt(caseId, ed) {
    this.sql.exec(`UPDATE published_cases SET casefile_state='built', casefile_attempted_at=?, casefile_why=NULL
                   WHERE case_id=? AND edition=? AND manifest_sha IS NOT NULL AND casefile_state IS NOT 'built'`,
                  this.#when(), caseId, ed);
  }

  /* R15 (G54; K4426, K4565, K4566, K4571): the one writer of the case file's ledger, the four `casefile_*` columns of
     `published_cases`. `building` and `failed` add one to `casefile_attempts` (a `building` left by a cancelled request or a
     memory kill is therefore already an attempt); `built` is written only on an edition whose manifest is recorded (the
     caller puts the manifest's own bytes first) and adds none. `stopped` is this writer's own: a `failed` whose
     `why.code` is `MATERIAL_MISSING`, with `absent: true` (the caller's probe of the evidence store confirmed the object
     gone), that is the `CASEFILE_MISSING_MAX_ATTEMPTS`th in a row (counted in `why.run`) is stored `stopped`. A built or
     stopped edition is not rewritten by a late `building` or `failed`; a `built` is accepted over anything. It is a
     store-internal hop (`recordcasefile`), no caller's op, and `recordCaseManifest` leaves these columns alone but for `built: true`. */
  recordCaseFileAttempt({ caseId, edition, state, why = null, at = null, absent = false } = {}) {
    const ed = Number(edition);
    const whyOf = state === "built" ? null : caseFileWhy(why);
    if (typeof caseId !== "string" || !caseId.trim() || !Number.isInteger(ed) || ed < 1
        || !["building", "failed", "built"].includes(state)
        || (at != null && !(typeof at === "string" && Number.isFinite(Date.parse(at))))
        || (state === "failed" && !whyOf) || (why != null && state === "building" && !whyOf))
      return { ok: false, reason: "MALFORMED" };
    return this.record.transact(() => {
      const c = this.#one(`SELECT manifest_sha, casefile_state, casefile_attempts, casefile_why FROM published_cases
                           WHERE case_id=? AND edition=?`, caseId, ed);
      if (!c) return { ok: false, reason: "NO_SUCH_CASE_EDITION", caseId, edition: ed };
      const when = at ?? this.#when();
      const attempts = Number(c.casefile_attempts) || 0;
      if (state === "built") {
        if (!c.manifest_sha) return { ok: false, reason: "NO_MANIFEST", caseId, edition: ed };
        if (c.casefile_state === "built") return { ok: true, caseId, edition: ed, state: "built", attempts, existed: true };
        this.sql.exec(`UPDATE published_cases SET casefile_state='built', casefile_attempted_at=?, casefile_why=NULL
                       WHERE case_id=? AND edition=?`, when, caseId, ed);
        return { ok: true, caseId, edition: ed, state: "built", attempts };
      }
      if (c.casefile_state === "built" || c.casefile_state === "stopped")
        return { ok: true, caseId, edition: ed, state: c.casefile_state, attempts, existed: true };
      let prev = null;
      try { prev = c.casefile_why ? JSON.parse(c.casefile_why) : null; } catch { prev = null; }
      const missingBefore = prev && prev.code === "MATERIAL_MISSING" ? Number(prev.run) || 0 : 0;
      let next = state, kept = whyOf;
      if (state === "failed" && whyOf.code === "MATERIAL_MISSING") {
        kept = caseFileWhy({ ...whyOf, run: missingBefore + 1 });
        if (absent === true && missingBefore + 1 >= CASEFILE_MISSING_MAX_ATTEMPTS) next = "stopped";
      } else if (state === "building" && !whyOf && prev) kept = prev;   // a `building` keeps the run it interrupts
      else if (state === "building" && whyOf && prev && prev.code === "MATERIAL_MISSING" && whyOf.code === "MATERIAL_MISSING")
        kept = caseFileWhy({ ...whyOf, run: missingBefore });
      this.sql.exec(`UPDATE published_cases SET casefile_state=?, casefile_attempts=?, casefile_attempted_at=?, casefile_why=?
                     WHERE case_id=? AND edition=?`, next, attempts + 1, when, kept ? JSON.stringify(kept) : null, caseId, ed);
      return { ok: true, caseId, edition: ed, state: next, attempts: attempts + 1 };
    });
  }

  /* R15 (G54): the complete case editions owing a case file, each with the instant it is next due, oldest due first.
     One rule, here: an edition is owed when it is complete (`caseEditionState`) and not `stopped` and either has no
     manifest or has a ledger state that is not `built`. It is due at `ratified_at` + `CASEFILE_GRACE_MS` while never
     attempted, else at `casefile_attempted_at` + `min(FIRST * 2^(attempts-1), MAX)` (a `building` waits at least
     `CASEFILE_BUILDING_WAIT_MS`). An edition with a manifest and no ledger state is built and never owed (R-OLD). */
  #caseFilesOwing() {
    const out = [];
    for (const r of this.#rows(
      `SELECT case_id, edition, ratified_at, manifest_sha, casefile_state, casefile_attempts, casefile_attempted_at, casefile_why
         FROM published_cases WHERE casefile_state IS NOT 'stopped'
          AND (manifest_sha IS NULL OR casefile_state IN ('building', 'failed')) ORDER BY case_id, edition`)) {
      const s = this.caseEditionState(r.case_id, Number(r.edition));
      if (!s || !s.complete) continue;
      const ratified = Date.parse(s.ratified_at ?? r.ratified_at);
      let base = ratified + CASEFILE_GRACE_MS;
      if (r.casefile_state) {
        const attempted = Date.parse(r.casefile_attempted_at);
        const wait = backoffMs(r.casefile_attempts);
        if (Number.isFinite(attempted)) base = attempted + (r.casefile_state === "building" ? Math.max(CASEFILE_BUILDING_WAIT_MS, wait) : wait);
      }
      if (!Number.isFinite(base)) continue;
      let why = null;
      try { why = r.casefile_why ? JSON.parse(r.casefile_why) : null; } catch { why = null; }
      out.push({ case: r.case_id, edition: Number(r.edition), manifest_sha: r.manifest_sha ?? null, state: r.casefile_state ?? null,
                 attempts: Number(r.casefile_attempts) || 0, attempted_at: r.casefile_attempted_at ?? null, why,
                 ratified_at: s.ratified_at ?? r.ratified_at ?? null, due: base });
    }
    return out.sort((a, b) => a.due - b.due || (a.case < b.case ? -1 : a.case > b.case ? 1 : a.edition - b.edition));
  }

  /** R15 (G54): the editions owed a case file and due at `now` (default the module's clock), oldest due first, at most `limit`
   *  (default and ceiling `CASEFILES_OWED_MAX`); each carries the instant it was due (`next_at`). Writes nothing but
   *  `caseEditionState`'s completion stamp; never throws. */
  caseFilesOwed({ now = null, limit = null } = {}) {
    try {
      const t = typeof now === "number" ? now : Date.parse(now ?? this.#when());
      if (!Number.isFinite(t)) return [];
      return this.#caseFilesOwing().filter((x) => x.due <= t).slice(0, pageOf(limit, CASEFILES_OWED_MAX))
        .map(({ due, ...x }) => ({ ...x, next_at: new Date(due).toISOString() }));
    } catch { return []; }
  }

  /** R15 (G54): the earliest instant an owed case file is due (an ISO string, as `publishWake`), null when none is owed. */
  caseFileNextAt() {
    try { const o = this.#caseFilesOwing(); return o.length ? new Date(o[0].due).toISOString() : null; } catch { return null; }
  }

  /* REC-22 / R4: the PUBLISHED GRAPH, written inside the publishing act's own
     transaction from the RATIFIED BYTES (the control plane reads references[]
     and the division disclosure out of the document the signature covers and
     hands them here) -- never from the working `refs` table, which is a
     projection of whatever bundle.md says TODAY and moves under a published
     edition every time somebody promotes.

     TWO CLASSES AND ONE RESTRICTION.
       - a SERVE edge is admitted only when its target is ITSELF published.
         That restriction is what stops the published graph naming working
         material, and it is checked HERE against published_bundles rather than
         being asserted by the caller.
       - a NAME edge is admitted whatever the target's state, and carries an id
         and nothing else. R4's disclosure lands here and had to: a divided
         parent is TERMINAL and can never be published, so the restriction as
         BUILD-ORDER first wrote it made R4's disclosure impossible on the exact
         surface R4 was written for. The control plane classifies -- a division's
         parent and siblings are name-only BY KIND, even when the target happens
         to be published, because "names its parent and its siblings while
         serving neither" is a rule about the DISCLOSURE and not about what is
         reachable.

     Idempotent on (from, to, kind) so a second edition re-asserting an edge
     does not double it, and the class is REFRESHED on re-publication: whether a
     target is published is a fact about the record now, not about the edition
     that first named it.

     N256 / K283 (Bob, 2026-09-28): A SERVE-CLASS EDGE WHOSE TARGET IS NOT YET
     PUBLISHED IS HELD PRIVATELY, no longer dropped. It is written to
     `published_held_references`, which the public read path never reads, so the
     target's id stays unpublished; when the target is published, `commitEdition`
     turns it into a `serve` edge (R22, R35). `held` counts them; `dropped` is
     kept in the answer and is now always 0 (nothing is dropped). */
  publishEdges(bundleId, edges, now) {
    if (!Array.isArray(edges)) return { serve: 0, name: 0, held: 0, dropped: 0 };
    const out = { serve: 0, name: 0, held: 0, dropped: 0 };
    for (const e of edges) {
      if (!e || typeof e.to !== "string" || !e.to || typeof e.kind !== "string" || !e.kind) continue;
      /* A self-edge discloses nothing and is not a graph. */
      if (e.to === bundleId) continue;
      const nameOnly = e.disclosure === "name";
      if (!nameOnly && !this.#one(`SELECT bundle_id FROM published_bundles WHERE bundle_id=? LIMIT 1`, e.to)) {
        this.sql.exec(
          `INSERT INTO published_held_references (from_bundle,to_bundle,kind,held_at) VALUES (?,?,?,?)
           ON CONFLICT(from_bundle,to_bundle,kind) DO NOTHING`, bundleId, e.to, e.kind, now);
        out.held++;
        continue;
      }
      this.sql.exec(
        `INSERT INTO published_edges (from_bundle,to_bundle,kind,disclosure,published) VALUES (?,?,?,?,?)
         ON CONFLICT(from_bundle,to_bundle,kind) DO UPDATE SET disclosure=excluded.disclosure`,
        bundleId, e.to, e.kind, nameOnly ? "name" : "serve", now);
      out[nameOnly ? "name" : "serve"]++;
    }
    return out;
  }

  /* R70 (K1826): a published edition's two instants, from its `published_cases` row; a row this boot's migration has
     not yet filled (none in a running store) reads as its document's ratification instant, never null. */
  #editionDates(caseId, edition, fallback) {
    const r = this.#one(`SELECT signed_at, published_at FROM published_cases WHERE case_id=? AND edition=?`,
                        caseId, Number(edition));
    return { signed_at: (r && r.signed_at) || fallback, published_at: (r && r.published_at) || fallback };
  }

  /* REC-128 — THE ONE READ CHOKEPOINT FOR WHO DELIVERED A RATIFICATION. Every
     read that serves a ratification (the finding rows, the case document, the
     public case read and so the container that travels) answers through here,
     from the stored `delivered_by` column and from NOTHING ELSE: in particular
     never from `attestor_member`, so a row written before the column existed
     reads UNDETERMINED, stated, rather than back-filled from its signer.
     R14's, R27's and R28's tests (`test/m/publication/convert-deliverer.test.mjs`,
     `published.test.mjs`) read every such answer against its stored column and
     its signer, so a back-fill here fails them. */
  #deliveredBy(row) { return delivererOf(row ? row.delivered_by : null); }

  /* Which case a published finding belongs to, at a given edition or at its
     latest. ONE lookup on published_case_members' bundle_id index — the query
     that earns the table its second keel. */
  /* Which case a WORKING document is being published into — CORRECTED BY
     CASE-5b, for the reason `#caseClaimInBytes` above carries in full.

     IT WAS READ OUT OF THE DOCUMENT'S OWN `case_id`, and the comment said
     exactly why: C-21.1's freshness comparison is "this case edition against the
     previous edition of THAT SAME CASE", and the case had to be the document's
     own assertion — inside the bytes the member would sign — rather than
     something the projection substituted. That reasoning is UNCHANGED and is why
     this now reads the CASE DOCUMENT: the assertion is still signed, by the
     case's own signer, over bytes that name this finding at this finding's hash.
     What would NOT be acceptable is falling back to `published_case_members`
     alone, because that is the projection, and a document could then be gated
     against a case it is no longer prepared into.

     PINNED FIRST, PREPARED SECOND: a ratified relation is the record's answer
     and an unratified case document is this act's own preparation — the same
     order `publishCase()` resolves a case identity in, and for the same reason. */
  /* ===== D-309 / DEC-72 clause 6, 2026-09-10: SITE 5 OF CASE-6's NINE, AND THE
     DECISION HERE IS **ALL CASES**.

     WHAT THIS ANSWERS AND FOR WHOM. Its one caller is `gateFacts`, which feeds
     `publishedCaseRegistryFor` — the registry C-21.1's freshness rule reads. The
     question is "what case, or cases, is the document being gated prepared into",
     and the freshness comparison is against *the previous edition of THAT SAME
     CASE*. Under clause 6 a finding can be prepared into several, so the honest
     answer is every one of them: giving the registry ONE case would gate the
     document against one case's prior edition and leave the others unexamined,
     which is a check that has quietly stopped asking about half its subject.

     THE CALLER ALREADY WANTED A LIST. `publishedCaseRegistryFor` takes an ARRAY
     and always has; the old scalar was being wrapped in `[ ]` at the call site.
     So this site cost nothing to correct, which is worth recording: the shape was
     right before the fence came down and only the reader was narrow.

     PINNED FIRST, PREPARED SECOND is UNCHANGED and its reasoning above still
     holds in full — a ratified relation is the record's answer and an unratified
     case document is this act's own preparation. What changed is only that each
     half may now answer with more than one. */
  caseClaimsOf(bundleId) {
    const b = this.#headRow(bundleId);
    if (!b) return [];
    const pinned = this.#rows(
      `SELECT DISTINCT case_id FROM published_case_members WHERE bundle_id=? AND version_sha=?
        ORDER BY case_id`, bundleId, b.bundle_sha).map((r) => r.case_id);
    if (pinned.length) return pinned;
    const claim = this.#preparedClaim(bundleId, b.bundle_sha);
    return claim ? [claim] : [];
  }

  /* R38: the case an UNSIGNED case document prepares this finding into at its current sha, or null: the prepared arm
     of the case relation (`case-tensions` R1), read here over the same rows the provider's `preparations` door answers
     (R61), the text match the index and the parse the authority. A refusal input only; it commits nothing. */
  #preparedClaim(bundleId, sha) {
    for (const d of this.publicationProvider().preparations(bundleId)) {
      const rows = (parseFrontmatter(d.text).data || {}).case_roles;
      if ((Array.isArray(rows) ? rows : []).some((r) => r && r.target === bundleId && r.version_sha === sha)) return d.case_id;
    }
    return null;
  }

  /* ===== D-309: SITES 6 AND 7 OF CASE-6's NINE (the `AND edition=?` spelling and
     the `ORDER BY edition DESC LIMIT 1` spelling), AND THE DECISION IS **ALL
     CASES**, RETURNED AS A SET OF DISTINCT CASE IDS.

     `DISTINCT` IS LOAD-BEARING RATHER THAN TIDY, and it is what keeps the
     over-strictness promise. A finding can be rostered by SEVERAL EDITIONS OF ONE
     CASE — that has always been true and has nothing to do with clause 6 — so a
     row-per-membership answer would report two entries for a finding that serves
     exactly one case, and every caller deciding "is this set-valued" on
     `length > 1` would start calling single-case findings ambiguous. The
     set-valued question this item opened is over CASES, so the set is over cases.

     The old scalar took the HIGHEST edition. Nothing here needs an edition at all
     — the one caller (`publishedRegistryFor`) is building a per-edition registry
     entry and wants the case identity — so the edition sort is dropped rather
     than carried forward unused. */
  #casesOf(bundleId, edition = null) {
    return (edition != null
      ? this.#rows(`SELECT DISTINCT case_id FROM published_case_members WHERE bundle_id=? AND edition=?
                     ORDER BY case_id`, bundleId, edition)
      : this.#rows(`SELECT DISTINCT case_id FROM published_case_members WHERE bundle_id=?
                     ORDER BY case_id`, bundleId)).map((r) => r.case_id);
  }

  /* R54 (K651): pure, never throws; a service to `public-read` as to this module's commit (R22) and registry (R7).
     THE SOLE MEMBERSHIP, OR NULL — D-309's ONE MIGRATION RULE, WRITTEN ONCE SO
     FIVE READ OPS CANNOT SPELL IT FIVE WAYS.

     Every op that used to answer `case_id` / `case_edition` as a scalar now
     serves a `cases` ARRAY beside it and keeps the scalar for the shape that has
     exactly one answer. This computes that scalar, and the ONLY thing it will
     ever return is a case the record genuinely holds alone: **it returns null
     rather than choosing**, which is the entire difference between this item and
     the nine silent `LIMIT 1` guesses CASE-6 refused to ship.

     IT COLLAPSES EDITIONS AND NOT CASES, for `#casesOf`'s reason one paragraph
     up. A finding pinned by editions 1 and 2 of ONE case is NOT set-valued and
     answers with that case at its NEWEST edition — byte-identical to what the old
     `ORDER BY edition DESC LIMIT 1` returned. That equality is the whole of
     D-309's over-strictness arm: a single-case finding answers exactly as it did
     yesterday, and it does so by construction here rather than by care at five
     call sites. */
  soleCase(list) {
    /* R54: never throws; anything that is not a `{case_id, edition}` row names no case. */
    const rows = (Array.isArray(list) ? list : []).filter((x) => x && typeof x === "object" && x.case_id != null);
    const ids = [...new Set(rows.map((x) => x.case_id))];
    if (ids.length !== 1) return null;
    let top = null;
    for (const x of rows) if (top == null || Number(x.edition) > top) top = Number(x.edition);
    return { case_id: ids[0], edition: top };
  }

  /* D-431 (b): WHICH FINDINGS OF A RATIFIED CASE REST ON THIS BUNDLE, and each one's publishing project.
     Asked over every roster row a RATIFIED case edition PINNED (`version_sha` set, joined to
     `published_cases`, which only `ratifyCaseDocument` writes), at the PINNED bytes — the bytes the case
     froze and the finding will be signed at, never whatever `bundle.md` says today (the working `refs`
     table is a projection of today's document and would be a second edge set). The bytes are read from the
     live file when it is still at the pin and from `history` when the finding has moved since. PINNED BYTES
     THIS STORE CANNOT READ rest on nothing here: the question is then undeterminable, and admitting a
     bundle on an undetermined answer is the direction this defect runs in.
     R38 (N308, K380): PAGED BY THE PIN. One call reads at most `limit` pins (a ratified case edition's member with a
     pinned sha, other than `id`; the editions of one case pinning one sha are one pin), in case id, member id and
     pinned sha order after `after`, and `cursor` is the last pin read (`<case>#<member>#<sha>`) when more follow, else
     null. A page may answer no finding while `cursor` is set; a caller follows it to null, so nothing is decided on
     part of the pins (a truncated list would change who may sign, K380). */
  ratifiedFindingsRestingOn(bundleId, { after = null, limit = null } = {}) {
    const id = String(bundleId ?? "");
    const cap = pageOf(limit, RESTING_PINS_MAX);
    const [aCase, aMember, aSha] = pinCursor(after);
    const pins = this.#rows(
      `SELECT DISTINCT m.case_id, m.bundle_id, m.version_sha, cs.project_id
         FROM published_case_members m
         JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
         LEFT JOIN cases cs ON cs.case_id=m.case_id
        WHERE m.version_sha IS NOT NULL AND m.bundle_id<>?
          AND (m.case_id>? OR (m.case_id=? AND (m.bundle_id>? OR (m.bundle_id=? AND m.version_sha>?))))
        ORDER BY m.case_id, m.bundle_id, m.version_sha LIMIT ?`,
      id, aCase, aCase, aMember, aMember, aSha, cap + 1);
    const more = pins.length > cap;
    if (more) pins.length = cap;
    const findings = [];
    for (const p of pins) {
      const text = this.record.textAtSha(p.bundle_id, p.version_sha);
      if (typeof text !== "string") continue;
      const fm = parseFrontmatter(text).data || {};
      if (publishedGraphEdges(fm).some((e) => e.disclosure === "serve" && e.to === id))
        findings.push({ case_id: p.case_id, finding: p.bundle_id, project: p.project_id ?? null });
    }
    const last = pins[pins.length - 1];
    return { findings, limit: cap, cursor: more ? `${last.case_id}#${last.bundle_id}#${last.version_sha}` : null };
  }

  /* D-309: SITE 2's QUERY, LIFTED OUT OF `publish()` AND PUT BESIDE ITS SIBLINGS,
     AND THE REASON IS A MEASUREMENT RATHER THAN TIDINESS — stated in full because
     a reader could otherwise take it for evasion, and it is the opposite.

     `meaning-bounds.test.mjs` (deleted in T20) graded an op OPAQUE when its method
     contained a `#rows(` call and published no collection: *"rows came out of the
     store and this reader could not say what happened to them."* Correcting site 2
     put the first `#rows(` into `publish()`'s own body, and the walk moved `op=publish`
     out of NO-COLLECTION and into OPAQUE — a blind spot on the heaviest act in
     the system, which is the state `op=airunlog` was in while a ratchet read
     green over it.

     THE OLD CLASSIFICATION WAS AND REMAINS THE TRUE ONE. These rows do NOT reach
     the wire: they drive a divergence refusal, a per-case flag discharge, and a
     scalar bar projection, and the act answers with `caseCount` — a number — and
     nothing else. `publish()` genuinely publishes no collection. The `#rows(` in
     its body was the only thing making it look otherwise, so the query moved to
     where the file's other which-case readers already live rather than the
     roster growing a member that would have been describing the wrong thing.

     IT IS NOT HIDDEN FROM ANYTHING. This helper is a public method of this module,
     R38's `pinnedCaseEditionsOf`, and its tests (`test/m/publication/
     relation.test.mjs`, `convert-ratify-authority.test.mjs`) drive it at the
     interface.

     WHAT IT ANSWERS: which case editions froze THESE EXACT BYTES, one entry per
     CASE at that case's newest edition holding them — the same collapse every
     other D-309 site takes, so "how many cases is this member in" has one answer
     across the file. The JOIN on `published_cases` is unchanged and still does its
     job: only case editions that exist are membership. */
  pinnedCaseEditionsOf(bundleId, bundleSha) {
    const rels = this.#rows(
      `SELECT m.case_id, m.edition, m.role FROM published_case_members m
         JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
        WHERE m.bundle_id=? AND m.version_sha=?
        ORDER BY m.case_id, m.edition DESC`, bundleId, bundleSha);
    const byCase = [];
    for (const r of rels) if (!byCase.some((x) => x.case_id === r.case_id)) byCase.push(r);
    return byCase;
  }

  /* REC-22: which of these ids have a published edition, and what each one FROZE
     -- the one indexed lookup that lets the public read path say, per basis leg,
     whether it is a leg the page can SERVE or one it can only NAME. Reuses
     publishedRegistryFor, which C-21.2 already reads: a leg names an edition
     (DEC-12) and the comparison is against THAT edition's frozen pair, so the
     shape a check needs and the shape a reader needs are the same shape. */
  publishedTargets(ids) {
    const list = (Array.isArray(ids) ? ids : String(ids || "").split(","))
      .map((s) => String(s || "").trim()).filter(Boolean).slice(0, 200);
    return { ok: true, registry: this.publishedRegistryFor(null, list) };
  }
  /* REC-14 / P8's justifying query, and the reason inquiry_exclusions exists as
     a TABLE and not only as bytes: "WHICH CASES EXCLUDED THIS DOCUMENT" —
     invariant 7's only mechanical enforcement point at the case level — as ONE
     indexed lookup on inquiry_exclusions_target, never a scan of every
     completeness block in the store.

     Each row carries the case's CURRENT STATE and the EDITION the assertion was
     taken from, so "which PUBLISHED cases excluded it" is a filter the caller
     can apply on what it is given rather than a distinction this read makes on
     their behalf: a case that was reopened after excluding a document has still
     excluded it in every edition already published, and hiding those rows would
     be the surface deciding what the record forgets.

     D-15: viewer-gated like every other read that can name a bundle, and fails
     closed on an absent viewer. */
  excludedBy(targetId, viewer = null) {
    if (!targetId) return { ok: false, reason: "NO_ID", detail: localize("publication.index.excludedby_requires_id", "excludedby requires ?id=") };
    const gate = viewerPredicate(viewer);
    /* inquiry R18: the live exclusions naming the target that the viewer may see, from `inquiry_exclusions`. */
    const rows = [...this.inquiry.exclusionsNaming(targetId, viewer)];
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): AND THE CASES WHOSE DOCUMENT STATES THE EXCLUSION —
       every case published under rule 12, whose members carry no exclusion of their own. ONE indexed,
       gated statement over `case_exclusions_target`, never a scan of case documents and no read per row:
       the projection already holds one row per MEMBER (the finding a row has always named), with the
       member's own edition and the publishing project. A member the viewer cannot see is gated out by the
       SAME predicate as above. An UNSIGNED document is working material and answers only to standing in its
       project (REC-130's rule, `hasCaseStanding`'s predicate spelled as SQL: a member-scope viewer has it,
       a denied one never, and any other only where it can see the project); a ratified one is public.
       Legacy members keep answering through the first read (rule 12 (e)). */
    const standing = gate.scope === "member" ? "1"
      : gate.scope === "DENY" ? "0"
      : `EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_id = x.project_id AND b.object_type='project' AND (${gate.sql}))`;
    rows.push(...this.#rows(
      `SELECT x.bundle_id, x.ord, x.member_edition AS edition, x.description, x.reason, x.author, x.at,
              b.current_state, b.title, x.case_id, x.edition AS case_edition, 'case_document' AS "from"
         FROM case_exclusions x
         JOIN case_documents d ON d.case_id = x.case_id AND d.edition = x.edition
         JOIN bundles b ON b.bundle_id = x.bundle_id
        WHERE x.target_id=? AND (${gate.sql}) AND (d.ratified_at IS NOT NULL OR ${standing})
        ORDER BY x.case_id, x.edition, x.bundle_id, x.ord`,
      targetId, ...gate.args, ...(standing.startsWith("EXISTS") ? gate.args : [])));
    return { ok: true, targetId, cases: rows,
             detail: localize("publication.index.each_row_is_a_case", "each row is a case that named this document in its completeness exclusions, with the edition the assertion was taken from and the case's current state.") };
  }

  /* REC-14: the published projection as the CHECK CATALOG needs it — the shape
     C-21.1 and C-21.2 read. Built for the bundle being written or gated AND for
     every target its basis names, in ONE indexed query rather than a probe per
     leg: a case's own prior edition (freshness) and the frozen pair of every
     published case beneath it (inheritance) are the two facts neither the
     checker nor a caller can supply for itself. */
  /* REC-44: THIS REGISTRY IS PER FINDING AND STAYS PER FINDING. It carries the
     frozen PAIR of every published finding and it is what C-21.2 reads: a
     basis leg rests on a FINDING (one proposition, one falsifier — DEC-32) and
     inherits THAT finding's frozen strength on THAT axis at THAT edition. It no
     longer carries `completeness`, which went up one altitude to the CASE with
     C-21.1 (publishedCaseRegistryFor below). The two must not be collapsed:
     collapsing them is what DEC-44 names as the mistake, one level down. */
  publishedRegistryFor(bundleId, extraTargets = []) {
    const ids = [...new Set([bundleId, ...extraTargets].filter(Boolean))];
    if (!ids.length) return {};
    /* D-390 (2026-09-23): THE LIST IS BOUND AS ONE JSON VALUE, not one variable per id. `publishedTargets`
       hands this a list cut at 200 and a finding's basis is unbounded, and one statement binding more than
       ~100 variables is refused by workerd (D-36) — reproduced through `/publishedtargets` by the system suite
       `frontier-chunk.test.mjs` (deleted in T20). `json_each(?)` is this file's own precedent (the authored-capture read)
       and binds ONE variable whatever the list's length. Not chunked: one statement reads the whole bounded
       list, and a loop around it would add statements while the per-row work is unchanged. */
    /* D-598 (BOB #34, 2026-09-25 03:00Z; BIO_Publication_v0_1.md §3 rule 5): EACH ENTRY IS KEYED ON ITS
       OBJECT TYPE, because C-21.2's inheritance rule applies to published INQUIRIES only. A document or an
       observation published as a case's EVIDENCE (D-431(b)) sits in `published_bundles` beside the findings
       and freezes no strength of its own, so a registry that did not say which was which read every
       evidence document as a published finding and forced every later leg on it to `grade_source:
       inherited` — from nothing. The type is read from `bundles`, the record's own row, never from a
       caller; a published row with no `bundles` row answers `object_type: null`, UNDETERMINED, and
       checkInheritedLeg holds the inquiry rule over it rather than guessing it is evidence. The key is
       carried rather than the non-inquiries dropped because `publishedTargets` serves this same registry
       to the public read path, where a published evidence document is still a leg the page can SERVE. */
    const rows = this.#rows(
      `SELECT p.bundle_id, p.edition, p.title, p.bundle_sha, p.ratified_at, p.strength, b.object_type
       FROM published_bundles p LEFT JOIN bundles b ON b.bundle_id = p.bundle_id
       WHERE p.bundle_id IN (SELECT value FROM json_each(?)) ORDER BY p.bundle_id, p.edition`,
      JSON.stringify(ids));
    const reg = {};
    for (const r of rows) {
      const e = reg[r.bundle_id]
        || (reg[r.bundle_id] = { object_type: r.object_type ?? null, latest: 0, editions: {} });
      const strength = r.strength ? JSON.parse(r.strength) : null;
      const byAxis = {};
      for (const a of Array.isArray(strength) ? strength : [])
        if (a && a.axis) byAxis[a.axis] = { state: a.state, grade: a.grade ?? null };
      e.editions[String(r.edition)] = {
        edition: r.edition, title: r.title, bundle_sha: r.bundle_sha, ratified_at: r.ratified_at,
        /* D-309: **ALL** OF THEM. This registry is per FINDING and stays per
           finding (the header above), and a finding's case membership is now a
           set — so `case_ids` carries every one and `case_id` keeps its old name
           as the sole membership or null. No check reads either key (measured
           when this was written: zero hits for this registry's `case_id` in the
           check catalogue, whose readers of it are inquiry-grammar's since T19),
           so the correction is to the shape rather than
           to a live gate — which is why it is worth making now, before something
           starts reading a field that would have been quietly guessing. */
        case_ids: this.#casesOf(r.bundle_id, r.edition),
        case_id: this.soleCase(
          this.#casesOf(r.bundle_id, r.edition).map((c) => ({ case_id: c, edition: r.edition })))?.case_id ?? null,
        capture: byAxis.capture || null, connection: byAxis.connection || null,
        /* MK-2 / IC-142: the testimony axis ONLY where the edition froze one, so
           every edition published without it answers byte-identically, and
           checkInheritedLeg reads its absence as ABSENT rather than as a grade. */
        ...(byAxis.testimony ? { testimony: byAxis.testimony } : {}) };
      if (Number(r.edition) > e.latest) e.latest = Number(r.edition);
    }
    return reg;
  }

  /* REC-44 / C-21.1: the published projection AT CASE ALTITUDE — what each
     EDITION OF A CASE asserted about its own limits. The freshness gate needs
     exactly this and nothing from any finding: "was this completeness claim
     carried forward byte-identical from the previous edition" is a question
     about the CASE, because what a reader was given is a case edition.
     Deliberately a SECOND function beside publishedRegistryFor rather than one
     registry serving both: they answer at different altitudes and one shape
     serving two altitudes is how the collapse DEC-44 corrects happened. */
  publishedCaseRegistryFor(caseIds = []) {
    const ids = [...new Set((Array.isArray(caseIds) ? caseIds : [caseIds]).filter(Boolean))];
    if (!ids.length) return {};
    const reg = {};
    /* D-443: ONE json_each value, `publishedRegistryFor`'s precedent above (D-36). */
    for (const r of this.#rows(
      `SELECT case_id, edition, scope, completeness, bias_acknowledgement, ratified_at FROM published_cases
       WHERE case_id IN (SELECT value FROM json_each(?)) AND ratified_at IS NOT NULL ORDER BY case_id, edition`, JSON.stringify(ids))) {
      const e = reg[r.case_id] || (reg[r.case_id] = { latest: 0, editions: {} });
      e.editions[String(r.edition)] = {
        edition: r.edition, scope: r.scope ?? null, ratified_at: r.ratified_at,
        /* REC-47: carried BESIDE completeness, never folded into it — C-21.1
           compares both and they are two claims (DEC-46). */
        bias_acknowledgement: r.bias_acknowledgement ?? null,
        completeness: r.completeness ? JSON.parse(r.completeness) : null };
      if (Number(r.edition) > e.latest) e.latest = Number(r.edition);
    }
    return reg;
  }
}

const instances = new WeakMap();

/** The one instance for a host (K61). The first call creates it with `deps` (a test passes its own), creates its
 *  tables, declares them with their classes (R31), creates corpus-export (K1024; its tables and declaration only),
 *  case-carriage (N532) and case-tensions (T33-63, which declares its own three tables and registers the fact
 *  `caseMember` and the revision step), registers with case-tensions this module's provider (R61), with promotion the
 *  facts `publishedRegistry` and `publishedCaseRegistry` (R7; K206, N152), with reevaluation its cited parts and
 *  ratified cases (R41, R43), and with membership its published-work guard (R76). */
export function publicationOf(host, deps) {
  let p = instances.get(host);
  if (!p) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    p = new Publication({ ...d, host, storage, record, membership, promotion });
    instances.set(host, p);
    p.migrate();
    /* R31: the declaration's answer is kept, so a refused one (TABLE_DECLARED: nothing declared) is seen. */
    p.purgeDeclaration = record.declareTable("publication", PUBLICATION_DECLARATIONS.map((t) => ({ ...t })));
    /* K1024: corpus-export created here, eagerly, so `export_log` exists and is declared exempt at every boot (its R4). */
    void p.corpusExport;
    /* N532: case-carriage created here too, after this module's declaration, so its two tables exist and are declared
       exempt at every boot (its R6). */
    void p.caseCarriage;
    /* T33-63 (K1634, R61): case-tensions created here, after this module's declaration, so its three tables exist and
       are declared at every boot; it registers `caseMember` and the revision step itself. Its provider is this module's. */
    p.caseTensionsModule.registerPublicationProvider("publication", p.publicationProvider());
    promotion.registerFact("publishedRegistry", "publication", (id, targets) => p.publishedRegistryFor(id, targets));
    promotion.registerFact("publishedCaseRegistry", "publication", (ids) => p.publishedCaseRegistryFor(ids));
    /* R7, record-core R69 (K783): the audit judges each bundle's inherited legs (C-21.2) against the registry this
       module holds, for the bundle and every target its basis names (inquiry R16), as the gate does through the fact. */
    record.registerAuditContext("publication", (id) => {
      const basis = p.inquiry.basisFor(id);
      const targets = basis && basis.ok ? basis.legs.map((l) => l.target_id).filter((t) => typeof t === "string") : [];
      return { publishedRegistry: p.publishedRegistryFor(id, targets) };
    });
    /* R40, record-core R70 (K783): the opaque case ids this module's published tables hold, so the mint ledger never
       draws one again. `cases` and `case_documents` are ratification's registration (record-core R70). */
    record.registerMintSeed("publication", [["CASE", "published_cases", "case_id"],
                                            ["CASE", "published_case_members", "case_id"]]);
    /* R41, R43 (N210; K359): reevaluation's R14 case half reads a case's cited parts and pages the ratified cases through
       this one registration (its R26). the plane's store (`plane/store.mjs`) builds reevaluation first, with its `env` (its R25). */
    (d.reevaluation || reevaluationOf(host)).registerCaseParts("publication", {
      parts: (a) => p.caseCitedParts(a || {}), cases: (a) => p.ratifiedCases(a || {}) });
    /* R76 (membership R125): the one guard membership's slot holds; its answer kept, so a refused one is seen. While no
       handle is changed (membership R129, T46; DEC-197) no act of membership asks it; the registration stands. */
    p.handleGuard = typeof membership.registerHandleGuard === "function"
      ? membership.registerHandleGuard("publication", (a) => p.publishedWorkOf(a || {})) : null;
  }
  return p;
}

/** Which purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function publicationOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return PUBLICATION_TABLES.some((x) => (typeof x === "string" ? x : x.name) === name) || PUBLICATION_EXEMPT.includes(name);
}

/** The module's ops (K3), as entries of the plane's op map (`plane/store.mjs`). `viewer` and `by` are the control plane's
 *  stamps, read from the query, so a caller's own copy in a body never wins. `secretSha` (R73) is the door's too, and
 *  travels in the store request's body, never its address: `op=casedocument` reads it from the body alone (a string). The public reads
 *  (`publishededitions`, `publishedcase`, `publishedmanifest`, `verify`, `publishedlist`) are `public-read`'s
 *  `publicReadOps` and `projectstage` is `project-stage`'s `projectStageOps` since K651; the plane's op map
 *  spreads them beside these (K671). */
export function publicationOps(p, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  return {
    /* `caseflags` and `attribute` are case-tensions' arms (its `caseTensionsOps`), which the plane's op map spreads
       itself since T33-90; this module no longer spreads them (N597). */
    /* REC-44: internal only, and no caller's op (R15). */
    recordcasemanifest: () => p.recordCaseManifest(b),
    /* G54: the case file's ledger, internal like the manifest's and no caller's op (R15). */
    recordcasefile: () => p.recordCaseFileAttempt(b),
    publishedtargets: () => p.publishedTargets(q("ids")),
    excludedby: () => p.excludedBy(q("id"), q("viewer")),
    /* REC-130: both carry the viewer the control plane STAMPS, and fail closed on its absence. */
    casedocfacts: () => p.caseDocumentFacts(q("case"), q("edition"), q("viewer")),
    casedocument: () => p.caseDocument(q("case"), q("edition"), q("viewer"),
                                       typeof b.secretSha === "string" && b.secretSha ? b.secretSha : null),
    /* D-734: internal, the signed text behind a published case-document hash; the control plane re-hashes it. */
    publishedcasedoctext: () => p.publishedCaseDocumentText((q("sha256") || "").toLowerCase()),
  };
}
