/* case-disclosures — what a case discloses about what it rests on, judged and written before anything is signed
 * (requirements: `build/requirements/case-disclosures.md`; BIO_Publication_v0_1.md §3 rules 4 and 16, §5C; DEC-76 item 4,
 * DEC-81, DEC-96 item 4, DEC-112, DEC-119). The unresolved conflicts on a case's findings (R1); each document's grade and
 * co-attestation, and the owner's acknowledgement of a self-attested one (R2, R3); what may be said of a source (R4); the
 * method the case is signed under (R5); every document and observation a finding's chain reaches, with what this copy
 * holds whole and who attests it, every photo and member document carried only as its copy and an unchecked photo
 * refused (R6–R12; T39, N806: a member document's copy, `case-carriage` R16), and the
 * photos it relies on for the ceremony's Photos step (R29; T37, N757; T38, DEC-183); another group's work it rests on, with its acceptance and open flags (R13,
 * R14); each reached finding's grading facts and passages (R15); hunch debt (R16); and the people it names, each with a
 * recorded basis, and each signer's attestation of no undeclared tie (R24–R28); (T41) the account and the four statements,
 * each sentence against what it cites (R30), and the bias applications of the findings it reaches (R31). Each judgment
 * answers its
 * refusals in order and the rows the case document writes; `case-authoring`'s `publishCase` asks them in its order (its
 * R55), answers the first refusal, and writes the rows through this module's renderers (`./document.mjs`).
 *
 * Split from `case-authoring` for size (K617, N529, K1333): its private methods moved here with their bodies unchanged
 * (`#x` → `x`), `materials.mjs` and `accepted.mjs` whole, the C-120 family (`./checks.mjs`) with its ids, codes and
 * translations, and the disclosure renderers, moved and not copied, so the signed document is byte-identical. Each
 * comment's requirement id is this module's; an id of `case-authoring`'s is named as its.
 *
 * THE SEAM (R23). Every service is synchronous and never throws on a failed read of another module: that read states
 * less, never more. It writes nothing of its own; it reaches two writes, each inside the caller's transaction, so the
 * caller can roll it back: `sources.sourceOf`'s minting of a source id (R4), and (T39) `case-carriage.documentCopy`'s
 * queueing of a member document neither queued nor derived (R6; its R16; K2374). It holds no table and no op, so it
 * declares nothing to purge and registers nothing.
 *
 * REACHED as `caseDisclosuresOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call with `deps`, returned to every later caller. `deps` (each reached through its factory on the same host
 * unless given; a test passes its own):
 *   record               layer 2: `readFile` (R6, R13).
 *   inquiry              `basisFor` (R16).
 *   strength             `gradingFacts` (its R35; R15).
 *   contradiction        `unresolvedRecordOn` (its R29; R1).
 *   provenance           `captureGrade` (its R24–R27, R51; R2).
 *   attestation          `attestationsOf` (its R7; R2).
 *   capture              `lateAttestationsOf`, `captureAccountsOf` (its R68, R69; R2, R3, R10).
 *   sources              `sourceOf`, then `publishableAt` (its R1, R8; R4).
 *   extraction           `unitsOf` (its R36; R6, R15).
 *   promotion            the fact `producingGroup` (R7's group row); `CATALOG_VERSION` is imported (R5).
 *   caseImport           `acceptanceOf`, `openFlagsOn`, `importedCase` (its R4, R9; R13, R14).
 *   entities             `readEntity` (a referenced entity's kind; R24).
 *   events               `readEvent` (a timeline item's participants, an act's date; R24, R25).
 *   lines                `readLine`, `structureAt` (a basis' line and its validity at the act's date; R25).
 *   money                `readFact` (a cited money fact's parties; R24).
 *   people               `identityOf`, `interestsOf`, `personAt`, `tiesConcerning` (its R5, R15, R14, R20; R24–R27).
 *   membership           `memberFacts` (a signer's cover or handle, at the level they chose; R27).
 *   caseCarriage         `photoMarks` (its R10; R6, R29); `OBSCURED_LABEL` and (T40) `PUBLISHED_LABEL` (its R11) are
 *                        imported (T37; N757);
 *                        `documentCopy` (its R16; R6; T39, N806), its cleaned copy's `obscured` object, label and
 *                        (T47, R32) `kind` marker its own, handed on whole. A member
 *                        document neither queued nor derived is queued by that read, case-carriage's one write, inside
 *                        the caller's transaction (its R16).
 *   bias                 `statementInForce` (its R49; R30: the statements this case's lens prints).
 *   caseChecker          `checkAccount` (its R24; R30), pure; imported unless given.
 *   retrieval            `zone` (its R69: the team's governing time zone; R33).
 *   now                  the judgment's instant, for the day `personAt` is read at (R26).
 * (T41) R31 asks `inquiry.biasAppliedFindings` (its R61's one in-force test, `biasNotInForce` its one spelling).
 *
 * READ CONTRACTS it joins in its own SQL, each named at its statement: record-core's `bundles` (R37); inquiry's
 * `inquiry_basis` (R40); content's `content` (R45); provenance's `register` and `captured_locators` (R48). Sight is
 * membership's one rule (`viewerPredicate`, its R43). */

import { recordOf } from "../record-core/index.mjs";
import { viewerPredicate, membershipOf } from "../membership/index.mjs";
import { inquiryOf, biasNotInForce } from "../inquiry/index.mjs";
import { strengthOf, DEPTH_BOUND, GRADING_METHOD_VERSION, VERSION_STRENGTH_INERT_SOURCES } from "../strength/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { promotionOf, CATALOG_VERSION } from "../promotion/index.mjs";
import { parseImportedFindingRef, readBiasApplied, flattenBiasApplied } from "../inquiry-grammar/index.mjs";
import { caseImportOf } from "../case-import/index.mjs";
import { sourceStatement, unnamedSourceStatement } from "../publication/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { attestationOf } from "../attestation/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { sourcesOf } from "../sources/index.mjs";
import { parseFrontmatter, normalizeType, EARNED_CAPTURE_CEILING, canonicalJson,
         createSha256 } from "../record-grammar/index.mjs";
import { extractedTextOf, sourceRowWithheld, ACCOUNT_CITE_KINDS } from "../case-grammar/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { linesOf } from "../lines/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { peopleOf as peopleModuleOf } from "../people/index.mjs";
import { caseCarriageOf, OBSCURED_LABEL, PUBLISHED_LABEL } from "../case-carriage/index.mjs";
import * as caseCheckerModule from "../case-checker/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { localDay } from "../civil-time/index.mjs";
import { DRAFT_KINDS } from "../run-rules/index.mjs";
import { CASE_DISCLOSURE_CHECKS, ACCOUNT_ARMS } from "./checks.mjs";
import { basesListed, basisCitation, placesStated, subjectNaming, PERSON_PLACES, TIE_LINE_KINDS, TIE_ANONYMOUS_LEVELS } from "./people.mjs";
import { chainsOf, materialHeld, materialRows, photoRead, documentRead, PHOTO_NOT_COVERABLE_WORDS,
         PHOTO_UNCHECKED_WORDS } from "./materials.mjs";
import { flagsListed, flagsJudged, acceptedWorkRow } from "./accepted.mjs";
import { NOT_SHOWN_WORDS, tensionSide, SELF_ATTESTED_SENTENCE } from "./document.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { contentOf } from "../content/index.mjs";
import { typedStepOf } from "../textchain.mjs";
import { TYPED_FROZEN_UNCHECKED_KEY, TYPED_FROZEN_CHECKED_KEY } from "../basis-versions/index.mjs";

const NO_ANSWER = localize("case-disclosures.why.no_answer", "no answer");

export { CASE_DISCLOSURE_CHECKS, PHOTO_WORDS, DOCUMENT_WORDS, ACCOUNT_ARMS } from "./checks.mjs";
export { PERSON_BASES, PERSON_PLACES, TIE_LINE_KINDS, TIE_ANONYMOUS_LEVELS, basesListed, basisCitation, placesStated,
         subjectNaming,
         peopleLines, memberTieLines, peopleOf, memberTiesOf } from "./people.mjs";
export { chainsOf, materialHeld, materialRows, photoRead, documentRead, obscuredRead, PHOTO_STATES, DOCUMENT_STATES,
         PHOTO_NOT_COVERABLE_WORDS, PHOTO_UNCHECKED_WORDS } from "./materials.mjs";
export { flagsListed, acceptedWorkRow, FLAG_SENTENCE, FLAGS_SAY } from "./accepted.mjs";
export { SELF_ATTESTED_SENTENCE, TENSION_TEMPLATES, HIGHLIGHT_SENTENCE, NOT_SHOWN_WORDS, TENSIONS_DEPTH_STATED,
         tensionSide, tensionTemplate, tensionSentence, tensionsUnreadStated, tensionFrontmatterLines,
         tensionBodyLines, captureBodyLines, carriesBodyLines, acceptedBodyLines, ungradedLines, ungradedBodyLines,
         UNGRADED_BODY_KEY } from "./document.mjs";

/** The longest owner's words in a list (`tensionsDisclosed`, `selfAttested`): this module's own copy of
 *  `case-authoring`'s `COMPLETENESS_MAX` (K57), the bound its R3 sets on every authored field. */
export const COMPLETENESS_MAX = 2000;
/** R2: the IN lists of the captures' reads are chunked at 50, under D-36's 100-bound-parameter ceiling; this module's
 *  own copy of `case-authoring`'s `SEARCHED_CHUNK` (K57). */
const SEARCHED_CHUNK = 50;

/* The one constructor of a refusal with a catalogue row (DEC-49): `reason` and `code` carry the same literal, and the
   row's `check` and `translation` join the site's own `detail` and keys. */
function refusal(family, key, extra = {}) {
  const row = family[key];
  return { ok: false, reason: key, code: key, check: row.check, translation: row.translation, ...extra };
}
/* The family's own helper, the code its literal first argument, so the DEC-49 guard judges the code at each site
   against the rows that govern it (N259, N275). */
const disclosureRefusal = (key, extra) => refusal(CASE_DISCLOSURE_CHECKS, key, extra);

/** R38: the key a typist or checker with no credit choice (or `group`, `project`) is named by. */
export const TEAM_MEMBER_CREDIT_KEY = "credit.team_member";

export class CaseDisclosures {
  #deps;
  #now;

  constructor({ storage, record, host = null, inquiry = null, strength = null, contradiction = null, provenance = null,
                attestation = null, capture = null, sources = null, extraction = null, caseImport = null,
                promotion = null, entities = null, events = null, lines = null, money = null, people = null,
                membership = null, caseCarriage = null, bias = null, caseChecker = null, retrieval = null,
                content = null, now = null } = {}) {
    this.sql = storage.sql;
    this.storage = storage;
    this.record = record;
    this.#deps = { host, inquiry, strength, contradiction, provenance, attestation, capture, sources, extraction,
                   caseImport, promotion, entities, events, lines, money, people, membership, caseCarriage, bias,
                   caseChecker, retrieval, content };
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get inquiry() { return this.#deps.inquiry ||= inquiryOf(this.#deps.host); }
  get strength() { return this.#deps.strength ||= strengthOf(this.#deps.host); }
  get contradiction() { return this.#deps.contradiction ||= contradictionOf(this.#deps.host); }
  get provenance() { return this.#deps.provenance ||= provenanceOf(this.#deps.host); }
  get attestation() { return this.#deps.attestation ||= attestationOf(this.#deps.host); }
  get capture() { return this.#deps.capture ||= captureOf(this.#deps.host); }
  get sources() { return this.#deps.sources ||= sourcesOf(this.#deps.host); }
  get extraction() { return this.#deps.extraction ||= extractionOf(this.#deps.host); }
  get promotion() { return this.#deps.promotion ||= promotionOf(this.#deps.host); }
  /* R13, R14: `case-import`'s reads (its R4, R9). A read that throws fails closed here: a leg on another group's
     finding is not in force (C-120.10), its flags undetermined (C-120.12). */
  get caseImport() { return this.#deps.caseImport ||= caseImportOf(this.#deps.host); }
  /* R24–R27 (T33-68): the people a case names, through the modules that hold them. */
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host); }
  get events() { return this.#deps.events ||= eventsOf(this.#deps.host); }
  get lines() { return this.#deps.lines ||= linesOf(this.#deps.host); }
  get money() { return this.#deps.money ||= moneyOf(this.#deps.host); }
  get people() { return this.#deps.people ||= peopleModuleOf(this.#deps.host); }
  get membership() { return this.#deps.membership ||= membershipOf(this.#deps.host); }
  /* R6, R29 (T37; N757): the marks on a photo and its copy (`case-carriage` R10); R6 (T39; N806): a member document's
     publication copy (its R16). */
  get caseCarriage() { return this.#deps.caseCarriage ||= caseCarriageOf(this.#deps.host); }
  /* R30 (T41): whether a statement is in the lens this case prints (`bias` R49); the account's five arms
     (`case-checker` R24, pure, imported unless a test passes its own). */
  get bias() { return this.#deps.bias ||= biasOf(this.#deps.host); }
  get caseChecker() { return this.#deps.caseChecker ||= caseCheckerModule; }
  /* R33 (T51): the team's governing time zone (`retrieval` R69), the zone a photo's day is read in. */
  get retrieval() { return this.#deps.retrieval ||= retrievalOf(this.#deps.host); }
  /* R37, R39 (T53; DEC-464): a typed passage's words (`content.passageText`) and its typing (`transcriptionRead`). */
  get content() { return this.#deps.content ||= contentOf(this.#deps.host); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* The live `bundle.md` text of a held bundle, or null (blob-backed, absent, or a read that failed): record-core R13. */
  #liveText(id) {
    let f = null;
    try { f = this.record.readFile(id, "bundle.md"); } catch { f = null; }
    return f && typeof f.text === "string" ? f.text : null;
  }

  /* R2, R16 (C39): the targets a member's own `references[]` records as withdrawn. `inquiry_basis` is a projection that
     drops the status, so the live set is read from the document, which stays the authority. Severance only narrows on
     evidence (connections R22): a document that cannot be read has none, and the first entry for a target decides it. */
  #severedTargets(id) {
    const text = this.#liveText(id);
    if (text === null) return new Set();
    let refs = null;
    try { refs = parseFrontmatter(text).data?.references; } catch { refs = null; }
    const first = new Map();
    for (const x of Array.isArray(refs) ? refs : [])
      if (x && typeof x === "object" && typeof x.target === "string" && !first.has(x.target)) first.set(x.target, x.status);
    return new Set([...first].filter(([, status]) => status === "severed").map(([t]) => t));
  }

  /* R6, R8, R31: the reads `chainsOf` walks, as `viewer` sees the record (membership R43's one rule). */
  #chainIo(viewer) {
    const gate = viewerPredicate(viewer);
    return {
      rows: (q, ...a) => this.#rows(q, ...a), one: (q, ...a) => this.#one(q, ...a), normalizeType,
      parseRef: (t) => parseImportedFindingRef(t),
      visible: (id) => gate.scope !== "DENY"
        && !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args),
      readFile: (b, p) => this.record.readFile(b, p),
      registeredFor: (b) => this.provenance.registeredFor(b), partsNamed: (b, sha) => this.provenance.partsNamed(b, sha),
      unitsOf: (sha) => this.extraction.unitsOf(sha),
      sha256: (s) => createSha256().update(new TextEncoder().encode(s)).hex(), extractedTextOf,
    };
  }

  /** R5 (DEC-112 (3)): the versions the owner signs under, read at the call: the grading method `strength` grades by
   *  and the catalogue version promotion stamps (rule 17). `case-grammar`'s `methodBlockLines` (its R11) writes them in
   *  the frontmatter, and `carriesBodyLines` in the body, so the version is inside what the owner signs. */
  methodOf() {
    return { grading: GRADING_METHOD_VERSION, checks: CATALOG_VERSION };
  }

  /** R16 — HUNCH DEBT REFUSES PUBLICATION (Publication §3 rule 4; DEC-20; Declared Bias, "HUNCH DEBT"): the one bias
   *  that must be cleared before a case publishes. Cleared means the case holds without the hunch, so a member whose
   *  live basis still carries a leg whose grade source is `hunch` carries the debt. Asked of EVERY member, load-bearing
   *  or supporting, before the case identity is derived, so a refusal draws no id and writes nothing (K240); `case-authoring`
   *  R34's pre-flight answers it before the first screen. Answers C-120.7 or null. */
  hunchDebt(prepared) {
    const hunches = [];
    const undetermined = [];
    for (const p of prepared) {
      /* R23, R18: a basis that cannot be read is not a basis without a hunch. It fails closed, stated beside the
         hunches as undetermined, and never throws (J1's reading). */
      let basis = null;
      try { basis = this.inquiry.basisFor(p.id); }
      catch (e) { undetermined.push({ target: p.id, why: String(e && e.message || e).slice(0, 160) }); continue; }
      if (!basis || basis.ok === false) {
        undetermined.push({ target: p.id, why: basis ? basis.reason ?? word("case-disclosures.why.read_failed") : NO_ANSWER });
        continue;
      }
      const severed = this.#severedTargets(p.id);
      for (const leg of (Array.isArray(basis.legs) ? basis.legs : []))
        if (leg && leg.grade_source === "hunch" && !severed.has(leg.target_id)) hunches.push({ target: p.id, ord: leg.ord, leg_target: leg.target_id });
    }
    if (!hunches.length && !undetermined.length) return null;
    /* DEC-49 REGION is-hunch-cleared */
    return disclosureRefusal("UNCLEARED_HUNCH", { hunches, ...(undetermined.length ? { undetermined } : {}),
      detail: localize("case-disclosures.index.v1_a_hunch_is_temporary", "{v1}A hunch is temporary declared bias, and it is the one bias that must be cleared before publication (DEC-20): the case must still hold with the hunch removed. Give each leg a grade the record earns, or take the hunch out of the basis, and publish again. Nothing was written.", { v1: String((hunches.length ? localize("case-disclosures.index.hunch_legs", "{count} basis leg(s) of this case's findings rest on a HUNCH ({legs}). ", { count: String(hunches.length), legs: String(hunches.map((h) => localize("case-disclosures.index.hunch_leg", "{target} leg {ord} on {leg_target}", { target: String(h.target), ord: String(h.ord), leg_target: String(h.leg_target) })).join("; ")) }) : "")
            + (undetermined.length ? localize("case-disclosures.index.hunch_unread", "The basis of {unread} could not be read, so whether it rests on a hunch is not known. ", { unread: String(undetermined.map((u) => localize("case-disclosures.index.target_why", "{target} ({why})", { target: String(u.target), why: String(u.why) })).join("; ")) }) : "")) }) });
    /* END DEC-49 REGION is-hunch-cleared */
  }

  /** R1 — N345 (DEC-76 item 4, DEC-84 items 11–13, DEC-85): A CASE DISCLOSES EVERY UNRESOLVED CONFLICT ON WHAT IT RESTS
   *  ON, ONE LEVEL DEEP, AND IS NEVER REFUSED BECAUSE ONE EXISTS. Each member is read at the bytes the act pins
   *  (`case-authoring` R13), as the viewer, so a side the publisher may not see comes back highlighted with nothing of
   *  it (R17). Answers
   *  `{refusals, entries, unread, byCandidate}`: the list's own malformation or C-120.3 alone, else C-120.1 and C-120.2
   *  in that order, each once; `op=publish` answers the first, `case-authoring` R34's pre-flight lists them all. */
  tensionsJudged(prepared, viewer, tensionsDisclosed) {
    const listed = this.#disclosuresListed(tensionsDisclosed);
    if (listed.ok === false) return { refusals: [listed], entries: [], unread: [], byCandidate: new Map() };
    const read = this.tensionsRead(prepared, viewer);
    if (read.ok === false) return { refusals: [read], entries: [], unread: [], byCandidate: listed.byCandidate };
    const refusals = [];
    const undisclosed = read.entries.filter((e) => !listed.byCandidate.has(e.candidate));
    /* DEC-49 REGION is-tension-disclosed */
    if (undisclosed.length)
      refusals.push(disclosureRefusal("TENSION_NOT_DISCLOSED", {
        undisclosed: undisclosed.map((e) => this.#namedInRefusal(e)),
        detail: localize("case-disclosures.index.length_unresolved_conflict_s_on", "{length} unresolved conflict(s) on what this case rests on are not disclosed ({map}). A case is published with its conflicts disclosed, never refused because one exists (DEC-76 item 4): list each in tensionsDisclosed, or resolve it first. Nothing was published.", { length: String(undisclosed.length), map: String(undisclosed.map((e) => `${e.candidate} on ${e.finding}`
                + (e.unseen_other_side ? `, ${NOT_SHOWN_WORDS}` : "")).join("; ")) }) }));
    /* END DEC-49 REGION is-tension-disclosed */
    const standing = new Set(read.entries.map((e) => e.candidate));
    const notStanding = [...listed.byCandidate.values()].filter((d) => !standing.has(d.candidate));
    /* DEC-49 REGION is-disclosure-standing */
    if (notStanding.length)
      refusals.push(disclosureRefusal("DISCLOSURE_NOT_STANDING", {
        not_standing: notStanding.map((d) => ({ candidate: d.candidate, ord: d.ord })),
        detail: localize("case-disclosures.index.candidates_not_unresolved_conflict", "{candidates} is not an unresolved conflict on this case's findings at the bytes this act pins: it may have been resolved since, or it names nothing this case rests on. Read the list again (op=publishtensions). Nothing was published.", { candidates: String(notStanding.map((d) => d.candidate).join(", ")) }) }));
    /* END DEC-49 REGION is-disclosure-standing */
    return { refusals, entries: read.entries, unread: read.unread, byCandidate: listed.byCandidate };
  }

  /** R2 — WHAT EACH MEMBER RESTS ON, AS CAPTURES, ONE LEVEL DEEP (as `case-authoring` R29 and R1 read): each document leg of the
   *  member's basis at the bytes this act pins, either role, names its content row's capture, else every capture its
   *  target registers (provenance R48's `register`); an inquiry leg names none (that finding states its own when it is
   *  published). Answers `[{member, capture}]` in member order, then leg order, each pair once. Set-based: one read per
   *  chunk of ids over inquiry R40's `inquiry_basis`, content R45's `content`, record-core R37's `bundles` and provenance
   *  R48's `register`. */
  restingCaptures(prepared) {
    const chunked = (vals, fn) => { for (let i = 0; i < vals.length; i += SEARCHED_CHUNK) fn(vals.slice(i, i + SEARCHED_CHUNK)); };
    const marks = (part) => part.map(() => "?").join(",");
    const legsOf = new Map(prepared.map((p) => [p.id, []]));
    chunked(prepared.map((p) => p.id), (part) => {
      for (const r of this.#rows(`SELECT bundle_id, ord, target_id, content_id FROM inquiry_basis
                                   WHERE bundle_id IN (${marks(part)}) ORDER BY bundle_id, ord`, ...part))
        legsOf.get(r.bundle_id).push(r);
    });
    /* C39: a leg whose citation the member severed is no longer what the question rests on. */
    for (const [id, list] of legsOf) {
      const severed = this.#severedTargets(id);
      if (severed.size) legsOf.set(id, list.filter((l) => !severed.has(l.target_id)));
    }
    const legs = [...legsOf.values()].flat();
    const captureOfContent = new Map();
    chunked([...new Set(legs.map((l) => l.content_id).filter((c) => typeof c === "string" && c))], (part) => {
      for (const r of this.#rows(`SELECT content_id, capture_sha FROM content WHERE content_id IN (${marks(part)})`, ...part))
        if (typeof r.capture_sha === "string" && r.capture_sha) captureOfContent.set(r.content_id, r.capture_sha);
    });
    const whole = [...new Set(legs.filter((l) => !captureOfContent.has(l.content_id)).map((l) => l.target_id)
      .filter((t) => typeof t === "string" && t))];
    const documents = new Set();
    const registered = new Map();
    chunked(whole, (part) => {
      for (const r of this.#rows(`SELECT bundle_id, object_type FROM bundles WHERE bundle_id IN (${marks(part)})`, ...part))
        if (normalizeType(r.object_type) === "information") documents.add(r.bundle_id);
    });
    chunked([...documents], (part) => {
      for (const r of this.#rows(`SELECT bundle_id, capture_sha FROM register WHERE bundle_id IN (${marks(part)})
                                   ORDER BY bundle_id, capture_sha`, ...part)) {
        if (!registered.has(r.bundle_id)) registered.set(r.bundle_id, []);
        registered.get(r.bundle_id).push(r.capture_sha);
      }
    });
    const out = [];
    for (const p of prepared) {
      const had = new Set();
      for (const l of legsOf.get(p.id)) {
        const caps = captureOfContent.has(l.content_id) ? [captureOfContent.get(l.content_id)]
                   : documents.has(l.target_id) ? (registered.get(l.target_id) || []) : [];
        for (const c of caps) if (!had.has(c)) { had.add(c); out.push({ member: p.id, capture: c }); }
      }
    }
    return out;
  }

  /** R2, R3: one capture's grade (`provenance.captureGrade`) and co-attestation, read at the act. It is co-attested
   *  only when it holds both a timestamp and a co-archive: first as recorded at capture (`attestation.attestationsOf`),
   *  else a late one that succeeded (`capture.lateAttestationsOf`; a late co-archive whose replay holds other bytes
   *  corroborates nothing and is not counted), a late one stated as late. The capturing member's signed accounts
   *  (`capture.captureAccountsOf`) travel with it, their exact text and signature (publication R20 writes them as
   *  base64 of the exact bytes, so each still verifies). Never throws: a read that fails states less, never more. */
  captureFacts(sha) {
    const safe = (fn) => { try { return fn(); } catch { return null; } };
    const g = safe(() => this.provenance.captureGrade(sha)) || {};
    const att = safe(() => this.attestation.attestationsOf(sha));
    const late = safe(() => this.capture.lateAttestationsOf(sha));
    const acc = safe(() => this.capture.captureAccountsOf(sha));
    const held = att && att.ok !== false && Array.isArray(att.attestations) ? att.attestations : [];
    const lateHeld = late && Array.isArray(late.late_attestations) ? late.late_attestations : [];
    const onTs = held.find((a) => a && a.kind === "rfc3161");
    const onCa = held.find((a) => a && a.kind === "co_archive" && a.locator);
    const lateTs = lateHeld.find((a) => a && a.kind === "timestamp" && a.ok === true);
    const lateCa = lateHeld.find((a) => a && a.kind === "co_archive" && a.ok === true && a.matches !== false
                                        && a.archived_locator);
    const ts = onTs ? { at: onTs.at ?? null, late: false } : lateTs ? { at: lateTs.at ?? null, late: true } : null;
    const ca = onCa ? { locator: onCa.locator, late: false } : lateCa ? { locator: lateCa.archived_locator, late: true } : null;
    const accounts = acc && Array.isArray(acc.accounts) ? acc.accounts : [];
    return { capture: sha, grade: g.grade ?? null, grade_basis: g.basis ?? null, grade_why: g.why ?? null,
             co_attested: !!(ts && ca), missing: [...(ts ? [] : ["timestamp"]), ...(ca ? [] : ["co_archive"])], timestamp_at: ts ? ts.at : null, co_archive: ca ? ca.locator : null,
             late: !!((ts && ts.late) || (ca && ca.late)),
             /* C40: a timestamp made by `reattest` is the attempt it is: marked late, with when it proves the bytes existed. */
             timestamp_late: !!(ts && ts.late),
             late_words: ts && ts.late && ts.at ? localize("case-disclosures.index.late_proves", "late: proves the bytes existed by {at}, not at capture", { at: String(ts.at) }) : null,
             accounts_read: accounts.map((a) => ({ by: a.by ?? null, at: a.at ?? null, text: String(a.text ?? ""),
                                                  signature: a.signature == null ? null : String(a.signature) })) };
  }

  /** R2 (DEC-81 item 3 (b), (d)): `selfAttested: [{capture, reason}]`, the owner's attributed acknowledgement of a
   *  document published as self-attested only. Any malformed shape is `BAD_COMPLETENESS` (`case-authoring` R3's code)
   *  naming the field (the pattern of `tensionsDisclosed`, K498); a capture listed twice is acknowledged once, its first reason kept. Then, in
   *  R2's order: a load-bearing capture at `EARNED_CAPTURE_CEILING` (Grade B, provenance R24's one definition) not
   *  co-attested and not listed is C-120.4, naming each; a listed one with an empty reason C-120.5; a listed one that
   *  is co-attested, or not in the case, C-120.6. Answers `{refusals, byCapture}`; `op=publish` answers the first,
   *  `case-authoring` R34's pre-flight lists them all. Nothing here refuses a case because a document is not co-attested. */
  selfAttestedJudged(resting, facts, memberRoles, list) {
    const byCapture = new Map();
    const bad = (field, detail) => ({ refusals: [{ ok: false, reason: "BAD_COMPLETENESS", field, detail }], byCapture });
    if (list != null) {
      if (!Array.isArray(list))
        return bad("selfAttested", "selfAttested is a list of {capture, reason}, one per document published as "
                                 + "self-attested only");
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const capture = d && typeof d === "object" && !Array.isArray(d) && typeof d.capture === "string"
          ? d.capture.trim().toLowerCase() : "";
        if (!capture) return bad(`selfAttested[${i}]`, `selfAttested[${i}] is not {capture, reason} naming a capture`);
        if (d.reason != null && typeof d.reason !== "string")
          return bad(`selfAttested[${i}].reason`, `selfAttested[${i}].reason is the owner's reason, a string`);
        const reason = typeof d.reason === "string" ? d.reason.trim() : "";
        if (reason.length > COMPLETENESS_MAX || /["\\\r\n]/.test(reason))
          return bad(`selfAttested[${i}].reason`, `selfAttested[${i}].reason is at most ${COMPLETENESS_MAX} characters `
            + `and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes`);
        if (!byCapture.has(capture)) byCapture.set(capture, { capture, ord: i, reason });
      }
    }
    const roleOf = new Map(memberRoles.map((m) => [m.target, m.role]));
    const membersOf = new Map();
    for (const r of resting) {
      if (!membersOf.has(r.capture)) membersOf.set(r.capture, []);
      membersOf.get(r.capture).push(r.member);
    }
    const refusals = [];
    /* C40: which of the two a capture lacks, as `captureFacts` states it; facts handed in without it are read from their own fields. */
    const lacks = (f) => Array.isArray(f.missing) ? f.missing
      : [...(f.timestamp_at ? [] : ["timestamp"]), ...(f.co_archive ? [] : ["co_archive"])];
    const unacknowledged = [...facts.values()].filter((f) => f.grade === EARNED_CAPTURE_CEILING && !f.co_attested
      && membersOf.get(f.capture).some((m) => roleOf.get(m) === "load_bearing") && !byCapture.has(f.capture))
      .map((f) => ({ ...f, missing: lacks(f), timestamp_late: !!f.timestamp_late, late_words: f.late_words ?? null }));
    /* DEC-49 REGION is-co-attestation-acknowledged */
    if (unacknowledged.length)
      refusals.push(disclosureRefusal("CO_ATTESTATION_UNACKNOWLEDGED", {
        unacknowledged: unacknowledged.map((f) => ({ capture: f.capture, members: membersOf.get(f.capture), grade: f.grade,
                                                     timestamp_at: f.timestamp_at, co_archive: f.co_archive,
                                                     missing: f.missing, timestamp_late: f.timestamp_late, late_words: f.late_words })),
        detail: localize("case-disclosures.index.length_load_bearing_grade_earned", "{length} load-bearing Grade {EARNED_CAPTURE_CEILING} document(s) hold no trusted timestamp and co-archive ({map}). Retry them (op=reattest), or list each in selfAttested with your reason to publish it as self-attested only (DEC-81 item 3). The case is never refused because a document is not co-attested. Nothing was written.", { length: String(unacknowledged.length), EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING), map: String(unacknowledged.map((f) => localize("case-disclosures.index.capture_lacking", "{capture} under {members}, lacking {missing}", { capture: String(f.capture), members: String(membersOf.get(f.capture).join(", ")), missing: String(f.missing.map((m) => m === "timestamp" ? localize("case-disclosures.index.missing_timestamp", "the trusted timestamp") : localize("case-disclosures.index.missing_co_archive", "the co-archive")).join(" and ")) })).join("; ")) }) }));
    /* END DEC-49 REGION is-co-attestation-acknowledged */
    const noReason = [...byCapture.values()].filter((d) => !d.reason);
    /* DEC-49 REGION is-self-attested-reasoned */
    if (noReason.length)
      refusals.push(disclosureRefusal("SELF_ATTESTED_NO_REASON", {
        no_reason: noReason.map((d) => ({ capture: d.capture, ord: d.ord })),
        detail: localize("case-disclosures.index.map_gives_no_reason_publishing", "{map} gives no reason. Publishing a document as self-attested only is an attributed act with a stated reason (DEC-81 item 3 (b)). Nothing was written.", { map: String(noReason.map((d) => `selfAttested[${d.ord}]`).join(", ")) }) }));
    /* END DEC-49 REGION is-self-attested-reasoned */
    const notStanding = [...byCapture.values()].filter((d) => !facts.has(d.capture) || facts.get(d.capture).co_attested);
    /* DEC-49 REGION is-self-attestation-standing */
    if (notStanding.length)
      refusals.push(disclosureRefusal("SELF_ATTESTATION_NOT_STANDING", {
        not_standing: notStanding.map((d) => ({ capture: d.capture, ord: d.ord,
                                                why: facts.has(d.capture) ? "co_attested" : "not_in_case" })),
        detail: localize("case-disclosures.index.map_needs_no_acknowledgement_map", "{map} needs no acknowledgement: {map_2}. Remove it from selfAttested. Nothing was written.", { map: String(notStanding.map((d) => d.capture).join(", ")), map_2: String(notStanding.map((d) => (facts.has(d.capture) ? `${d.capture} is co-attested` : `${d.capture} is not a `
                + `document this case rests on`)).join("; ")) }) }));
    /* END DEC-49 REGION is-self-attestation-standing */
    return { refusals, byCapture };
  }

  /** R6, R8, R12 (DEC-112 (4); K1134 reading 1): each member's chain (`chainsOf`, as `viewer` sees the record), each
   *  material it reaches with what this copy holds of it (`materialHeld`), and C-120.8 for every load-bearing member
   *  whose chain reaches material not held whole, naming each member and each material. Material only supporting
   *  members reach is listed `included: false` and never refused.
   *  A PHOTO (T37; N757; DEC-180 (3), (4); K2206; T38: N779, K2248; DEC-183 (1), K2220, K2291, K2303): each
   *  document's marks are read (`case-carriage.photoMarks`, its R10, as `viewer`; `photoRead`, a withdrawn mark counted
   *  as withdrawn) and answered on the material as `photo`. A photo never travels whole: it is `included: false`
   *  whatever is held of it, and never C-120.8. In order:
   *  - a document whose marks cannot be read is `PHOTO_MARKS_UNDETERMINED`, naming it, wherever the answer decides what
   *    travels (`marksDecide`: held whole, or reached by a load-bearing member): fail closed;
   *  - an `unchecked` photo (no standing mark) that any member's chain reaches, load-bearing or supporting, is
   *    `PHOTO_UNCHECKED`, naming each such photo and the members reaching it (K2291's reading of "relies on");
   *  - a checked photo whose cover was refused, marked or not, is neither carried whole nor left out: a load-bearing
   *    chain reaching it is `PHOTO_NOT_COVERABLE`, naming each such photo and member; one only supporting members reach
   *    is listed `included: false` with no `obscured`;
   *  - otherwise (`marked` or `nothing_to_obscure`, with a copy) it is presentable through its copy, `obscured: {copy,
   *    label, marked, kind, label_key}`, case-carriage's object handed on whole (R32; its R22: `kind` "photo") with
   *    `label_key` beside it: `label` `OBSCURED_LABEL` when `marked` (`photo.obscured.label`), else
   *    `PUBLISHED_LABEL` (`photo.published.label`; T40, DEC-185 (1): every photo a published case carries is labelled,
   *    replacing K2291's null), `marked` whether it is `marked`, and `label_key` the key a reader's surface shows the
   *    label by (K2483, as `public-read` R3 answers it).
   *  A MEMBER DOCUMENT (T39; N806; K2315, K2333): a document `photoRead` finds no photo is asked of its publication copy
   *  (`case-carriage.documentCopy`, its R16; `documentRead`), answered on the material as `document`. In R6's order:
   *  - a state that cannot be read (`undetermined`) is `DOCUMENT_COPY_UNDETERMINED`, naming it, whichever chain reaches
   *    it: fail closed;
   *  - `pending` is `DOCUMENT_COPY_PENDING` when a load-bearing chain reaches it, naming each document and member;
   *  - `refused` is `DOCUMENT_NOT_CLEANABLE` when a load-bearing chain reaches it, naming each document, member and
   *    `doc-clean`'s code; pending or refused material only supporting members reach is listed `included: false` with
   *    no `obscured`;
   *  - `copy` is presentable through its copy, `included: false`, `obscured: {copy, label: COPY_CLEANED_LABEL,
   *    kind: "document", label_key: "document.cleaned.label"}`, case-carriage's object handed on whole (R32; its R22)
   *    with K2483's key beside it (the words stay `case-carriage`'s);
   *  - `clean` and `public` are judged as any document, by what is held.
   *  None of the first four is C-120.8. A member-supplied archive is never carried (`case-carriage` R8): this module
   *  answers materials, never an archive.
   *  Supporting-only material not held whole travels in no case, so it is listed `included: false`. Each photo
   *  refusal but the unread carries `photo`, the photos named, which fills its translation's `{photo}`; each document
   *  refusal carries `document`, the documents named, which fills `{document}`. Refusals: C-120.8, then the photos' in
   *  that order, then the documents' in that order; each writes nothing. Answers `{refusals, materials, refs, findings}`;
   *  `op=publish` answers the first refusal, `case-authoring` R34's pre-flight lists them all. */
  materialsJudged(prepared, memberRoles, viewer) {
    const io = this.#chainIo(viewer);
    const roleOf = new Map(memberRoles.map((m) => [m.target, m.role]));
    const chains = chainsOf(prepared.map((p) => ({ id: p.id, role: roleOf.get(p.id) })), io, DEPTH_BOUND);
    const materials = chains.materials.map((m) => {
      const held = materialHeld(m, io);
      const photo = m.kind === "document"
        ? photoRead(() => this.caseCarriage.photoMarks({ captureSha: m.sha, viewer })) : null;
      const isPhoto = !!(photo && photo.photo === true);
      const document = photo && photo.photo === false
        ? documentRead(() => this.caseCarriage.documentCopy(m.sha)) : null;
      /* R32 (T47; N953): case-carriage's own `obscured` object, `kind` included, handed on unchanged; K2483's `label_key`
         beside it for a reader's surface, never written (R7) */
      const obscured = isPhoto && photo.obscured
        ? { ...photo.obscured, label_key: photoLabel(photo.state === "marked").label_key }
        : document && document.state === "copy" && document.obscured
          ? { ...document.obscured, label_key: "document.cleaned.label" }
          : null;
      const plain = !(photo && photo.unread) && !isPhoto && !(document && !AS_HELD.includes(document.state));
      return { ...m, held, included: plain && held.whole, obscured, photo, document };
    });
    const loadBearing = memberRoles.filter((r) => r.role === "load_bearing");
    const byMember = (list, row) => loadBearing
      .map((r) => ({ target: r.target, materials: list.filter((m) => m.members.includes(r.target)).map(row) }))
      .filter((x) => x.materials.length);
    /* a photo is presentable only through its copy and refused below on its own terms, and the load-bearing unread are
       PHOTO_MARKS_UNDETERMINED (a copy may yet make them presentable): none is C-120.8 */
    const short = materials.filter((m) => !m.included && m.rests_under === "load_bearing"
                                          && !(m.photo && (m.photo.unread || m.photo.photo === true))
                                          && !(m.document && !AS_HELD.includes(m.document.state)));
    const unread = materials.filter((m) => m.photo && m.photo.unread && marksDecide(m));
    const unchecked = materials.filter((m) => m.photo && m.photo.photo === true && m.photo.state === "unchecked");
    const uncoverable = materials.filter((m) => m.rests_under === "load_bearing" && m.photo && m.photo.photo === true
                                                && m.photo.state !== "unchecked" && m.photo.refused);
    const docIn = (state, lb) => materials.filter((m) => m.document && m.document.state === state
                                                       && (!lb || m.rests_under === "load_bearing"));
    const docUnread = docIn("undetermined", false), docPending = docIn("pending", true), docRefused = docIn("refused", true);
    const refsNamed = (list) => [...new Set(list.map((m) => m.ref))].join(", ");
    const refusals = [];
    /* DEC-49 REGION is-relied-on-presentable */
    if (short.length) {
      const named = byMember(short, (m) => ({ ref: m.ref, kind: m.kind, sha: m.sha, missing: m.held.missing }));
      refusals.push(disclosureRefusal("RELIED_ON_NOT_PRESENTABLE", { not_presentable: named,
        detail: localize("case-disclosures.index.length_document_s_or_observation", "{length} document(s) or observation(s) a load-bearing finding of this case rests on are not held whole by your team's Civicsmith ({map}). Everything a case relies on travels with it in full (DEC-112 (4)): find a presentable copy, stop relying on the material, or make the finding supporting. Nothing was written.", { length: String(short.length), map: String(named.map((x) => `${x.target}: ` + x.materials.map((m) => `${m.ref} `
                + `${m.sha} lacks ${m.missing.join(" and ")}`).join(", ")).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-relied-on-presentable */
    /* DEC-49 REGION is-photo-marks-determined */
    if (unread.length) {
      const named = unread.map((m) => ({ ref: m.ref, sha: m.sha, members: m.members, why: m.photo.why }));
      refusals.push(disclosureRefusal("PHOTO_MARKS_UNDETERMINED", { undetermined: named,
        detail: localize("case-disclosures.index.length_document_s_this_case", "{length} document(s) this case relies on could not be checked for the people and number plates marked in them ({map}), so what the published case would show of them is not known. Try again. Nothing was written.", { length: String(unread.length), map: String(named.map((m) => `${m.ref} ${m.sha}: ${m.why}`).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-photo-marks-determined */
    /* DEC-49 REGION is-photo-checked */
    if (unchecked.length) {
      const named = unchecked.map((m) => ({ ref: m.ref, sha: m.sha, members: m.members }));
      refusals.push(disclosureRefusal("PHOTO_UNCHECKED", { unchecked: named, photo: refsNamed(unchecked),
        detail: localize("case-disclosures.index.length_photo_s_this_case", "{length} photo(s) this case relies on have not been checked for people and number plates to obscure ({map}). Mark each, or mark it as having nothing to obscure, before signing. Nothing was written.", { length: String(unchecked.length), map: String(named.map((m) => `${m.ref} ${m.sha}, relied on by ${m.members.join(", ")}`).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-photo-checked */
    /* DEC-49 REGION is-photo-coverable */
    if (uncoverable.length) {
      const named = byMember(uncoverable, (m) => ({ ref: m.ref, sha: m.sha, refused: m.photo.refused.code }));
      refusals.push(disclosureRefusal("PHOTO_NOT_COVERABLE", { not_coverable: named, photo: refsNamed(uncoverable),
        detail: localize("case-disclosures.index.length_photo_s_a_load", "{length} photo(s) a load-bearing finding of this case relies on cannot be covered in their format ({map}), and a photo travels only as its covered copy, so the case can neither carry them whole nor leave them out. Capture each again as an ordinary photo, or stop relying on it. Nothing was written.", { length: String(uncoverable.length), map: String(named.map((x) => `${x.target}: ` + x.materials.map((m) =>
                `${m.ref} ${m.sha}, ${m.refused}`).join(", ")).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-photo-coverable */
    /* DEC-49 REGION is-document-copy-determined */
    if (docUnread.length) {
      const named = docUnread.map((m) => ({ ref: m.ref, sha: m.sha, members: m.members, why: m.document.why }));
      refusals.push(disclosureRefusal("DOCUMENT_COPY_UNDETERMINED", { undetermined: named, document: refsNamed(docUnread),
        detail: localize("case-disclosures.index.length_document_s_this_case_2", "{length} document(s) this case relies on could not be checked for the details a member's file can carry ({map}), so what the published case would show of them is not known. Try again. Nothing was written.", { length: String(docUnread.length), map: String(named.map((m) => `${m.ref} ${m.sha}: ${m.why}`).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-document-copy-determined */
    /* DEC-49 REGION is-document-copy-made */
    if (docPending.length) {
      const named = byMember(docPending, (m) => ({ ref: m.ref, sha: m.sha }));
      refusals.push(disclosureRefusal("DOCUMENT_COPY_PENDING", { pending: named, document: refsNamed(docPending),
        detail: localize("case-disclosures.index.the_publication_copy_of_length", "the publication copy of {length} document(s) a member supplied, which a load-bearing finding of this case relies on, is still being made ({map}). A member's document travels only as its cleaned copy. Try again in a few minutes. Nothing was written.", { length: String(docPending.length), map: String(named.map((x) => `${x.target}: `
                + x.materials.map((m) => `${m.ref} ${m.sha}`).join(", ")).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-document-copy-made */
    /* DEC-49 REGION is-document-cleanable */
    if (docRefused.length) {
      const named = byMember(docRefused, (m) => ({ ref: m.ref, sha: m.sha, refused: m.document.refused.code }));
      refusals.push(disclosureRefusal("DOCUMENT_NOT_CLEANABLE", { not_cleanable: named, document: refsNamed(docRefused),
        detail: localize("case-disclosures.index.length_document_s_a_member", "{length} document(s) a member supplied, which a load-bearing finding of this case relies on, cannot be cleaned of the details that could show who made them ({map}), and a member's document travels only as its cleaned copy. Capture each from where it was published, supply a plainer copy, or stop relying on it. Nothing was written.", { length: String(docRefused.length), map: String(named.map((x) => `${x.target}: `
                + x.materials.map((m) => `${m.ref} ${m.sha}, ${m.refused}`).join(", ")).join("; ")) }) }));
    }
    /* END DEC-49 REGION is-document-cleanable */
    return { refusals, materials, refs: chains.refs, findings: chains.findings };
  }

  /** R29 (T37; N757; DEC-180 (3); K2206; T38: DEC-183 (1), K2220, K2303): the ceremony's Photos step, over the
   *  `materials` R6 answered. One entry per document material whose capture is a photo, in materials order, `{ref, sha,
   *  taken_by, dated, relied_on_by, state, marks, copy, refused, words, unread}`: `taken_by` its attesting member (R8: the
   *  capture's first actor, as `capture.captureAccountsOf` lets `viewer` see them), `dated` the day it was taken (R33:
   *  the local day, in the team's zone, of that actor's instant, else null), `relied_on_by` `[{target, role}]` of
   *  the members whose chains reach it; `state`, `marks` (with their withdrawals), `copy` (its SHA-256) and `refused` as
   *  `photoMarks` answers them (R6's read, `photo`, else read here); `words` `PHOTO_UNCHECKED_WORDS`
   *  (`photo.refused.unchecked`) for an unchecked photo, `PHOTO_NOT_COVERABLE_WORDS` (`photo.refused.format`) for a
   *  refused cover, marked or not, `OBSCURED_LABEL` for a marked photo with a copy, `PUBLISHED_LABEL` for one with
   *  nothing to obscure (T40; DEC-185 (2)), else null. The step's sentence on camera details and its gate sentence
   *  (`photo.step.gate`) are the screens' words, read from `words.json`: this module answers neither. A photo whose marks
   *  cannot be read is listed `state: null, unread: true` where R6 refuses it (`marksDecide`); unread material R6 does
   *  not refuse is no photo it can show. `unchecked` counts the photos with no standing mark, each of which blocks
   *  signing (R6's `PHOTO_UNCHECKED`) and never travels. Writes nothing; never throws. */
  photosOf(materials, memberRoles, viewer) {
    const roleOf = new Map((Array.isArray(memberRoles) ? memberRoles : [])
      .filter((r) => r && typeof r === "object").map((r) => [r.target, r.role ?? null]));
    const photos = [];
    let zone;
    for (const m of Array.isArray(materials) ? materials : []) {
      if (!m || typeof m !== "object" || m.kind !== "document" || typeof m.sha !== "string") continue;
      const p = m.photo && typeof m.photo === "object" && (m.photo.photo === false || m.photo.photo === true || m.photo.unread)
        ? m.photo : photoRead(() => this.caseCarriage.photoMarks({ captureSha: m.sha, viewer }));
      if (p.photo === false || (p.unread && !marksDecide(m))) continue;
      const members = Array.isArray(m.members) ? m.members : [];
      const first = this.#firstActor(m.sha, viewer);
      if (zone === undefined) zone = this.#teamZone();
      const entry = { ref: m.ref ?? null, sha: m.sha, taken_by: first ? first.actor : null, dated: dayOf(first, zone),
                      relied_on_by: members.map((t) => ({ target: t, role: roleOf.get(t) ?? null })) };
      if (p.unread) {
        photos.push({ ...entry, state: null, marks: null, copy: null, refused: null, words: null, unread: true });
        continue;
      }
      const words = p.state === "unchecked" ? PHOTO_UNCHECKED_WORDS : p.refused ? PHOTO_NOT_COVERABLE_WORDS
        : p.copy ? photoLabel(p.state === "marked").label : null;
      photos.push({ ...entry, state: p.state, marks: p.marks, copy: p.copy, refused: p.refused, words, unread: false });
    }
    return { photos, unchecked: photos.filter((p) => p.state === "unchecked").length };
  }

  /* R8, R29, R33: a capture's attesting member and the instant they made it, its first actor `{actor, at}`
     (`acquisition` R16; a pulled knock's puller, `capture` R65), as the viewer may see them; null when none is held or
     seen, or the read fails. */
  #firstActor(sha, viewer) {
    let a = null;
    try { a = this.capture.captureAccountsOf(sha, { viewer }); } catch { a = null; }
    return a && Array.isArray(a.actors) ? a.actors.find((x) => x && typeof x.actor === "string") || null : null;
  }

  /* R33: the team's governing time zone (`retrieval` R69), or null when none is held or the read fails: no zone is never
     read as UTC. */
  #teamZone() {
    let z = null;
    try { z = this.retrieval.zone(); } catch { z = null; }
    return typeof z === "string" && z ? z : null;
  }

  /* R37, R39 (T53; DEC-464): a leg on a `typed` chain (text-chain R107, `typedStepOf`). `quoted` is the typed words as
     `content.passageText` holds them, byte for byte (null only when content holds none); `typed` is the label as of
     signing, `{label_key, typist, checked_by: [{checker, at}], frozen_at}`: `frozen_at` the instant the document is
     prepared (this call), `checked_by` the members other than the typist whose attestation is at or before it, in time
     order, and `label_key` `basis-versions`' frozen key (its R59), never the live "not yet checked". The typist and each
     checker are credited as `#typingCredit` says. Null for a leg on no typed chain. Never throws. */
  #typedAsSigned(contentId, chain, frozenAt, viewer) {
    let step = null;
    try { step = Array.isArray(chain) ? typedStepOf(chain) : null; } catch { step = null; }
    if (!step) return null;
    let quoted = null, read = null;
    try { quoted = this.content.passageText(contentId); } catch { quoted = null; }
    try { read = this.content.transcriptionRead({ id: contentId, viewer }); } catch { read = null; }
    const typist = read && read.ok === true ? read.transcriber : (typeof step.member === "string" ? step.member : null);
    const atOrBefore = (t) => typeof t === "string" && Date.parse(t) <= Date.parse(frozenAt);
    const first = new Map();
    for (const a of read && read.ok === true && Array.isArray(read.attestations) ? read.attestations : [])
      if (a && a.attestor !== typist && atOrBefore(a.at)
          && (!first.has(a.attestor) || Date.parse(a.at) < Date.parse(first.get(a.attestor)))) first.set(a.attestor, a.at);
    const checked_by = [...first].sort((x, y) => Date.parse(x[1]) - Date.parse(y[1]) || (x[0] < y[0] ? -1 : 1))
      .map(([member, at]) => ({ checker: this.#typingCredit(member), at }));
    return { quoted: typeof quoted === "string" ? quoted : null,
             typed: { label_key: checked_by.length ? TYPED_FROZEN_CHECKED_KEY : TYPED_FROZEN_UNCHECKED_KEY,
                      typist: this.#typingCredit(typist), checked_by, frozen_at: frozenAt } };
  }

  /* R38's credit of a typist or a checker. The credit act for a typing is `case-tensions`' and it holds none yet
     (requirements, Uses), so every typing stands at "no choice": no handle, key, signature or member id, named by the
     key `credit.team_member`. The shape is `case-grammar` R37's credit (`{level, shown}`) with that key beside it. A
     missing choice never blocks signing. */
  #typingCredit(_member) {
    return { level: null, shown: null, key: TEAM_MEMBER_CREDIT_KEY };
  }

  /** R15 (DEC-112 (3); K1305, K1315): for each finding a member's chain reaches (R8), its legs exactly as
   *  `strength.gradingFacts` (its R35) answers them at the act, with `levels` null (`recomputePair` takes the levels the
   *  signed attribution section states), one `grading_facts:` row each, `{finding, ord}` beside the answer's fields; and
   *  each relied-on passage, one `passages:` row per leg naming a content row, `{finding, ord, content_id, capture_sha,
   *  extent, chain, quoted}` (`chain` as minted, null when none: K1317), `quoted` the text of the extracted unit at that extent (`extraction.unitsOf`), null where the copy
   *  holds none there. A finding `gradingFacts` refuses contributes no row, and the refusal is kept in `unread`, stated.
   *  R35 (T53; DEC-461): `ungraded`, from the same read, one `{finding, ord, content_id, title, role}` per leg with a
   *  `passages:` row whose `grading_facts:` row holds no counted grade (strength R9: `grade` null; a hunch leg, R16, and a
   *  leg a record-derived grade counts, a typed passage's among them, strength R46, are not listed), in the order the
   *  findings are handed (members first, R6) then `ord`; `title` the document's title as its record states it (as R7's
   *  `materials:` row), else null; `role` the leg's own role in the basis. A refused finding adds no entry. */
  findingFacts(findings, viewer) {
    const frozenAt = this.#now();
    const grading = [], passages = [], unread = [], ungraded = [];
    const titles = new Map();
    const titleOf = (bundle) => {
      if (!titles.has(bundle)) {
        let t = null;
        try { t = (this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, bundle) || {}).title; } catch { t = null; }
        titles.set(bundle, typeof t === "string" && t.trim() ? t : null);
      }
      return titles.get(bundle);
    };
    const units = new Map();
    const unitsOf = (sha) => {
      if (!units.has(sha)) { let u = null; try { u = this.extraction.unitsOf(sha); } catch { u = null; } units.set(sha, u); }
      return units.get(sha);
    };
    for (const id of [...new Set(findings.map((f) => f.id))]) {
      let gf = null;
      try { gf = this.strength.gradingFacts({ inquiry: id, levels: null, viewer }); } catch (e) { gf = { ok: false, reason: String(e && e.message || e).slice(0, 160) }; }
      if (!gf || gf.ok !== true) { unread.push({ finding: id, reason: gf ? gf.reason ?? null : null }); continue; }
      gf.legs.forEach((leg, ord) => grading.push({ finding: id, ord, ...leg }));
      for (const leg of this.#rows(`SELECT b.ord, c.content_id, c.capture_sha, c.bundle_id, c.extent, c.chain FROM inquiry_basis b
                                    JOIN content c ON c.content_id = b.content_id WHERE b.bundle_id=? ORDER BY b.ord`, id)) {
        const facts = gf.legs[Number(leg.ord)];
        if (facts && (facts.grade === null || facts.grade === undefined)
            && !VERSION_STRENGTH_INERT_SOURCES.includes(facts.grade_source))
          ungraded.push({ finding: id, ord: Number(leg.ord), content_id: leg.content_id, title: titleOf(leg.bundle_id),
                          role: typeof facts.role === "string" && facts.role ? facts.role : null });
        const u = unitsOf(leg.capture_sha);
        const at = u && Array.isArray(u.units) ? u.units.find((x) => canonicalJson(x.extent) === leg.extent) : null;
        const chain = leg.chain == null ? null : JSON.parse(leg.chain);
        const typed = this.#typedAsSigned(leg.content_id, chain, frozenAt, viewer);
        passages.push({ finding: id, ord: Number(leg.ord), content_id: leg.content_id, capture_sha: leg.capture_sha,
                        extent: JSON.parse(leg.extent), chain,
                        quoted: typed ? typed.quoted : (at && !at.truncated ? at.text : null),
                        ...(typed ? { typed: typed.typed } : {}) });
      }
    }
    return { grading, passages, unread, ungraded };
  }

  /** R4, R8, R10 (K1316): the off-the-record captures, those whose `sources:` row (R4) states the identity "Withheld":
   *  `case-grammar`'s `sourceRowWithheld`, the one reading of such a row. */
  withheldOf(sourceRows) {
    return new Set(sourceRows.filter(sourceRowWithheld).map((r) => r.capture));
  }

  /** R13 (DEC-96 item 4; N522): for each leg a member's chain reaches on another group's finding, the acceptance in force
   *  at the leg's `target_edition` (`case-import.acceptanceOf`, its R9) and the imported edition's facts
   *  (`importedCase`, its R4), as `accepted_work:` rows. A leg with none in force is C-120.10, naming each member, leg,
   *  source case and edition. The edition is read from the inquiry's own `bundle.md` `basis[ord]` (K1305 (2)). Answers
   *  `{refusals, rows, editions}`, `editions` each (import, edition) named with its refs, for R14. */
  acceptedWorkJudged(refs, viewer) {
    const rows = [], missing = [], editions = new Map();
    for (const leg of refs) {
      const parsed = parseImportedFindingRef(leg.ref);
      const text = this.#liveText(leg.leg_of);
      const basis = text !== null ? (parseFrontmatter(text).data || {}).basis : null;
      const at = Array.isArray(basis) ? basis[leg.ord] : null;
      const ed = at && Number.isInteger(Number(at.target_edition)) && Number(at.target_edition) > 0
        ? Number(at.target_edition) : null;
      const read = (fn) => { try { return fn(); } catch { return null; } };
      const imported = ed === null ? null : read(() => this.caseImport.importedCase({ import: parsed.import, edition: ed, viewer }));
      /* case-import R4: the import's source group and case at the top, the named edition in full under `edition`. */
      const view = imported && imported.ok !== false && imported.edition && Number(imported.edition.edition) === ed
        ? imported.edition : null;
      const edition = view ? { group: imported.group ?? null, case: imported.case ?? null,
                               manifest_sha: view.manifest_sha ?? null, findings: view.findings } : null;
      const acceptance = ed === null ? null
        : read(() => this.caseImport.acceptanceOf({ import: parsed.import, edition: ed, finding: parsed.finding }));
      const source = { group: edition ? edition.group ?? null : null, case: edition ? edition.case ?? null : null, edition: ed };
      if (!acceptance || acceptance.ok === false) {
        missing.push({ target: leg.member, leg_of: leg.leg_of, ord: leg.ord, ref: leg.ref, source });
        continue;
      }
      const found = edition && Array.isArray(edition.findings)
        ? edition.findings.find((f) => f.finding === parsed.finding) || null : null;
      rows.push(acceptedWorkRow({ ...leg, target_edition: ed }, parsed, acceptance, edition, found));
      const key = `${parsed.import}#${ed}`;
      if (!editions.has(key)) editions.set(key, { import: parsed.import, edition: ed, refs: [] });
      editions.get(key).refs.push({ ref: leg.ref, finding: parsed.finding, member: leg.member });
    }
    const refusals = [];
    /* DEC-49 REGION is-accepted-work-in-force */
    if (missing.length)
      refusals.push(disclosureRefusal("ACCEPTED_WORK_NOT_IN_FORCE", { not_in_force: missing,
        detail: localize("case-disclosures.index.length_leg_s_of_this", "{length} leg(s) of this case's findings rest on another team's finding with no acceptance of that edition in force ({map}). Accept that edition again (op=importaccept), or take the leg out. Nothing was written.", { length: String(missing.length), map: String(missing.map((m) => `${m.target}: ${m.leg_of} leg ${m.ord} on ${m.ref}, `
                + `${m.source.case ?? "an imported case"} edition ${m.source.edition ?? "not stated"}`).join("; ")) }) }));
    /* END DEC-49 REGION is-accepted-work-in-force */
    return { refusals, rows, editions: [...editions.values()] };
  }

  /** R14 (DEC-96 items 2, 4; DEC-84 (13)): the open flags on each edition R13 names (`case-import.openFlagsOn`, its
   *  R9), judged against `flagsDisclosed` (`flagsJudged`): a failed or incomplete read C-120.12 alone; else an open flag
   *  not listed C-120.11, naming each, and a listed one not open C-120.13. Never refused because a flag is open. Answers
   *  `{refusals, open, byFlag}`. */
  flagsJudged(editions, flagsDisclosed) {
    const listed = flagsListed(flagsDisclosed);
    if (listed.ok === false) return { refusals: [listed], open: [], byFlag: new Map() };
    const reads = editions.map((e) => {
      let answer;
      try { answer = this.caseImport.openFlagsOn({ import: e.import, edition: e.edition }); }
      catch (x) { answer = { failed: String(x && x.message || x).slice(0, 160) }; }
      return { ...e, answer };
    });
    const j = flagsJudged(reads, listed);
    const refusals = [];
    /* DEC-49 REGION is-flags-determined */
    if (j.failed.length)
      return { refusals: [disclosureRefusal("FLAGS_UNDETERMINED", { undetermined: j.failed,
        detail: localize("case-disclosures.index.the_flags_on_another_teams", "the flags on another team's work this case rests on could not be read whole ({map}), so what this case must disclose is not known. Try again. Nothing was published.", { map: String(j.failed.map((f) => `edition ${f.edition} of import ${f.import}: ${f.why}`).join("; ")) }) })],
        open: [], byFlag: listed.byFlag };
    /* END DEC-49 REGION is-flags-determined */
    /* DEC-49 REGION is-flag-disclosed */
    if (j.undisclosed.length)
      refusals.push(disclosureRefusal("FLAG_NOT_DISCLOSED", {
        undisclosed: j.undisclosed.map((f) => ({ flag: f.flag, ref: f.ref, edition: f.edition, issue: f.issue })),
        detail: localize("case-disclosures.index.length_open_flag_s_on", "{length} open flag(s) on another team's work this case rests on are not disclosed ({map}). A case is published with its open flags disclosed, never refused because one is open (DEC-96 item 4): list each in flagsDisclosed, or clear it first. Nothing was published.", { length: String(j.undisclosed.length), map: String(j.undisclosed.map((f) => `flag ${f.flag} on ${f.ref} edition ${f.edition}`).join("; ")) }) }));
    /* END DEC-49 REGION is-flag-disclosed */
    /* DEC-49 REGION is-flag-disclosure-standing */
    if (j.notStanding.length)
      refusals.push(disclosureRefusal("FLAG_DISCLOSURE_NOT_STANDING", {
        not_standing: j.notStanding.map((d) => ({ flag: d.flag, ord: d.ord })),
        detail: localize("case-disclosures.index.flags_not_open", "{flags} is not an open flag on work this case rests on: it may have been cleared since. Read the list again (op=publishpreflight). Nothing was published.", { flags: String(j.notStanding.map((d) => d.flag).join(", ")) }) }));
    /* END DEC-49 REGION is-flag-disclosure-standing */
    return { refusals, open: j.open, byFlag: listed.byFlag };
  }

  /** R4 (DEC-78 item 5): what may be stated of the source of each capture given to the group rather than fetched. The
   *  capture's source is found through `sources.sourceOf` (a capture no source stands behind, a fetched one, has none,
   *  and nothing is stated: the capturing member is never its source), and for each source only what
   *  `sources.publishableAt({audience: "public"})` answers is stated, spelled by publication's `sourceStatement`, with its
   *  basis. With nothing publishable, publication's `unnamedSourceStatement`: "an unnamed source" and the receipt's
   *  digest and time, basis null. Rows are `{capture, stated, basis}` (K549); no authored field adds to them, and no
   *  source or entry id is written (an opaque id in two cases would itself link them). A source read that fails states
   *  the unnamed row: less, never more. */
  sourcesStated(shas, viewer) {
    const rows = [];
    const unnamed = (capture, receipt) => ({ capture, basis: null,
      stated: unnamedSourceStatement({ capture: receipt && receipt.sha256 ? receipt.sha256 : capture,
                                       received: receipt && receipt.received ? receipt.received : null }) });
    for (const sha of shas) {
      let of = null;
      try { of = this.sources.sourceOf({ captureSha: sha, viewer }); } catch { of = null; }
      if (of && of.ok === false && of.reason === "NO_SUCH_SOURCE") continue;
      if (!of || of.ok !== true) { rows.push(unnamed(sha, null)); continue; }
      const each = Array.isArray(of.sources) && of.sources.length ? of.sources
        : [{ sourceId: of.sourceId, source: of.source }];
      for (const s of each) {
        let pa = null;
        try { pa = this.sources.publishableAt({ source: s.sourceId, audience: "public" }); } catch { pa = null; }
        const entries = (pa && pa.ok === true && Array.isArray(pa.entries) ? pa.entries : [])
          .map((e) => ({ stated: sourceStatement(e), basis: e.basis ?? null })).filter((e) => e.stated);
        /* The unnamed statement is the capture's, from its first pulled knock (`sourceOf`'s own `source`), whichever
           source says nothing: publication R51 re-derives it that way at the commit. */
        if (!entries.length) { rows.push(unnamed(sha, of.source && of.source.receipt)); continue; }
        for (const e of entries) rows.push({ capture: sha, stated: e.stated, basis: e.basis });
      }
    }
    /* Each statement once: two knockers of the same bytes with nothing publishable are one unnamed statement. */
    const once = new Set();
    return rows.filter((r) => { const k = JSON.stringify([r.capture, r.stated, r.basis]); return once.has(k) ? false : once.add(k); });
  }

  /** R24 (Design Requirement 6 as amended, K1483; K1494): EVERY PERSON THE CASE NAMES, EACH ONCE, WITH EVERY PLACE IT IS
   *  NAMED. The places are each finding's subject (`inquiry.subjectEntityOf`, read from `prepared`) and the caller's
   *  `parts`, `[{place, where, people?, event?, fact?}]` (`PERSON_PLACES`): an authored statement or claim, the published
   *  lens or a docket entry names `people` (entity ids); a timeline item names its `event`, whose participants are read
   *  (`events.readEvent`, superseded rows left out); a cited money `fact` names its payer and payee (`money.readFact`).
   *  A person is a `person` entity (`entities.readEntity`) with its identity cluster (`people.identityOf`, `linked`), so
   *  one person under two references is one, keyed by its least member id. A reference the record does not resolve to
   *  a person entity, where a person was named, is answered in `unresolved` with where it is, never dropped; so is a
   *  timeline item or money fact that cannot be read, and a party named by its words only. Answers `{named: [{person,
   *  members, places}], unresolved, entities, money_parties}`: `entities` every registered entity the case names, any
   *  kind, and `money_parties` the payers' and payees' entity ids, which R27 takes. Writes nothing, never throws (R23). */
  peopleNamed(prepared, parts, viewer) {
    const safe = (fn) => { try { return fn(); } catch { return null; } };
    const refs = [], unresolved = [];
    const moneyParties = new Set();
    for (const p of Array.isArray(prepared) ? prepared : []) {
      const s = p && typeof p.id === "string" ? safe(() => this.inquiry.subjectEntityOf(p.id)) : null;
      if (typeof s === "string" && s) refs.push({ id: s, place: "subject", where: p.id, person: false });
    }
    for (const part of Array.isArray(parts) ? parts : []) {
      const place = part && typeof part === "object" ? part.place ?? null : null;
      const where = part && part.where != null ? String(part.where) : null;
      if (!PERSON_PLACES.includes(place)) { unresolved.push({ place, where, ref: null, why: word("case-disclosures.why.place_case_document") }); continue; }
      if (place === "timeline") {
        const ev = typeof part.event === "string" && part.event ? safe(() => this.events.readEvent({ eventId: part.event, viewer })) : null;
        if (!ev || ev.ok === false || !ev.found || !ev.event) {
          unresolved.push({ place, where, ref: part.event ?? null, why: word("case-disclosures.why.timeline_item_event") });
          continue;
        }
        for (const x of Array.isArray(ev.event.participants) ? ev.event.participants : [])
          if (x && !x.superseded && typeof x.entity_id === "string")
            refs.push({ id: x.entity_id, place, where, person: false, role: x.role ?? null });
      } else if (place === "money") {
        const f = typeof part.fact === "string" && part.fact ? safe(() => this.money.readFact({ factId: part.fact, viewer })) : null;
        if (!f || f.ok === false || !f.found || !f.fact) {
          unresolved.push({ place, where, ref: part.fact ?? null, why: word("case-disclosures.why.cited_money_fact") });
          continue;
        }
        for (const side of ["from", "to"]) {
          const party = f.fact[side];
          if (party && typeof party.entity === "string" && party.entity) {
            moneyParties.add(party.entity);
            refs.push({ id: party.entity, place, where, person: false, side });
          } else if (party && !party.fund)
            unresolved.push({ place, where, ref: part.fact, side, why: word("case-disclosures.why.party_record_names") });
        }
      } else {
        const named = Array.isArray(part.people) ? part.people : [];
        for (const r of named)
          if (typeof r === "string" && r.trim()) refs.push({ id: r.trim(), place, where, person: true });
          else unresolved.push({ place, where, ref: r ?? null, why: word("case-disclosures.why.reference_person_names") });
      }
    }
    /* each reference's kind, once; a person's cluster, once */
    const kinds = new Map(), clusters = new Map();
    const kindOf = (id) => {
      if (!kinds.has(id)) {
        const e = safe(() => this.entities.readEntity({ entityId: id, viewer }));
        kinds.set(id, e && e.ok !== false && e.found && e.entity ? e.entity.kind ?? null : undefined);
      }
      return kinds.get(id);
    };
    const clusterOf = (id) => {
      if (!clusters.has(id)) {
        const c = safe(() => this.people.identityOf({ entityId: id, viewer }));
        const members = c && c.ok !== false && c.found && c.state === "linked" && Array.isArray(c.members)
          ? c.members.map((m) => (typeof m === "string" ? m : m && m.entity_id)).filter((m) => typeof m === "string" && m) : [];
        clusters.set(id, [...new Set([id, ...members])]);
      }
      return clusters.get(id);
    };
    const entities = new Set();
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); };
    const personRefs = [];
    for (const r of refs) {
      const kind = kindOf(r.id);
      if (kind === undefined) {
        unresolved.push({ place: r.place, where: r.where, ref: r.id, ...(r.side ? { side: r.side } : {}),
                          why: word("case-disclosures.why.record_holds_registered") });
        continue;
      }
      entities.add(r.id);
      if (kind !== "person") {
        if (r.person) unresolved.push({ place: r.place, where: r.where, ref: r.id, why: word("case-disclosures.why.names_entity_kind", { kind: String(kind) }) });
        continue;
      }
      const members = clusterOf(r.id);
      for (const m of members) { entities.add(m); if (!parent.has(m)) parent.set(m, m); }
      for (const m of members) union(members[0], m);
      personRefs.push(r);
    }
    const byKey = new Map();
    for (const r of personRefs) {
      const key = find(r.id);
      if (!byKey.has(key)) byKey.set(key, { person: key, places: [], seen: new Set() });
      const held = byKey.get(key);
      const place = { place: r.place, where: r.where, ref: r.id, ...(r.role ? { role: r.role } : {}), ...(r.side ? { side: r.side } : {}) };
      const k = JSON.stringify(place);
      if (!held.seen.has(k)) { held.seen.add(k); held.places.push(place); }
    }
    const named = [...byKey.values()].sort((a, b) => (a.person < b.person ? -1 : a.person > b.person ? 1 : 0))
      .map((h) => ({ person: h.person, members: [...parent.keys()].filter((m) => find(m) === h.person).sort(), places: h.places }));
    return { named, unresolved, entities: [...entities].sort(), money_parties: [...moneyParties].sort() };
  }

  /** R46: `subjectNaming` (`people.mjs`), the pure judgment, as a service of this instance. */
  subjectNaming(args) { return subjectNaming(args && typeof args === "object" ? args : {}); }

  /** R25, R26 (K1483, K1493): `peopleBases: [{person, basis, ref, words?}]`, the owner's recorded basis for each person
   *  R24 named, judged against the record at the act. A listed person is matched to a named one through its identity
   *  cluster (any member's id). Answers `{refusals, rows}`. Refusals, in order: a malformed list `BAD_COMPLETENESS` naming
   *  the field, alone (words carrying a named person's address or phone number, R26, are malformed words); C-120.14,
   *  naming each named person the list gives no basis; C-120.15, naming each listed basis whose `ref` the record does not
   *  hold or, for `act_or_position`, whose line is not valid at the event's date. These name a person to the publisher's
   *  act only and are never written into the document. `rows` are the `people:` block's rows (R28), one per named person
   *  whose basis stands: the places named, the basis kind and its citation, the owner's words; never a judgment of the
   *  person, never a person fact. */
  peopleJudged(named, peopleBases, viewer) {
    const listed = basesListed(peopleBases);
    if (listed.ok === false) return { refusals: [listed], rows: [] };
    const persons = named && Array.isArray(named.named) ? named.named : [];
    const keyOf = new Map();
    for (const p of persons) for (const m of [p.person, ...(Array.isArray(p.members) ? p.members : [])]) keyOf.set(m, p.person);
    const basisOf = new Map();
    for (const d of listed.byPerson.values()) {
      const key = keyOf.get(d.person);
      if (key !== undefined && !basisOf.has(key)) basisOf.set(key, d);
    }
    /* R26: the owner's words never carry a named person's home address or phone number */
    const contacts = this.#contactValues(persons, viewer);
    for (const d of basisOf.values()) {
      const words = d.words ? d.words.toLowerCase() : "";
      if (words && contacts.some((v) => words.includes(v)))
        return { refusals: [{ ok: false, reason: "BAD_COMPLETENESS", field: `peopleBases[${d.ord}].words`,
          detail: localize("case-disclosures.index.peoplebases_ord_words_carries_a", "peopleBases[{ord}].words carries a person's address or phone number as the record holds it, and a case never publishes either (K1493). Say why the person is named without it.", { ord: String(d.ord) }) }], rows: [] };
    }
    const unrecorded = persons.filter((p) => !basisOf.has(p.person));
    const standing = new Map(), notStanding = [];
    for (const p of persons) {
      const d = basisOf.get(p.person);
      if (!d) continue;
      const why = this.#basisStanding(p, d, viewer);
      if (why === null) standing.set(p.person, d);
      else notStanding.push({ person: p.person, ord: d.ord, basis: d.basis, ref: d.ref, why });
    }
    const refusals = [];
    /* DEC-49 REGION is-person-basis-recorded */
    if (unrecorded.length)
      refusals.push(disclosureRefusal("PERSON_BASIS_UNRECORDED", {
        unrecorded: unrecorded.map((p) => ({ person: p.person, places: p.places })),
        detail: localize("case-disclosures.index.persons_no_recorded_basis", "{length} person(s) this case names have no recorded basis ({map}). Every person a case names is named on a basis the record holds (Design Requirement 6): list each in peopleBases with its basis and reference. Nothing was written.", { length: String(unrecorded.length), map: String(unrecorded.map((p) => localize("case-disclosures.index.person_named_in_v1", "{person}, named in {v1}", { person: String(p.person), v1: String(placesStated(p.places) || localize("case-disclosures.index.the_case", "the case")) })).join("; ")) }) }));
    /* END DEC-49 REGION is-person-basis-recorded */
    /* DEC-49 REGION is-person-basis-standing */
    if (notStanding.length)
      refusals.push(disclosureRefusal("PERSON_BASIS_NOT_STANDING", { not_standing: notStanding,
        detail: localize("case-disclosures.index.map_a_basis_stands_only", "{map}. A basis stands only on what the record holds. Read the list again. Nothing was written.", { map: String(notStanding.map((x) => `peopleBases[${x.ord}] (${x.person}, ${x.basis}): ${x.why}`).join("; ")) }) }));
    /* END DEC-49 REGION is-person-basis-standing */
    const rows = persons.filter((p) => standing.has(p.person)).map((p) => {
      const d = standing.get(p.person);
      return { person: p.person, places: placesStated(p.places), basis: d.basis, citation: basisCitation(d.basis, d.ref),
               words: d.words };
    });
    return { refusals, rows };
  }

  /* R25: why a listed basis does not stand, or null when the record holds what it cites. Never throws: a read that
     fails holds nothing, so the basis does not stand. */
  #basisStanding(p, d, viewer) {
    const members = new Set([p.person, ...(Array.isArray(p.members) ? p.members : [])]);
    const safe = (fn) => { try { return fn(); } catch { return null; } };
    const liveLine = (id) => {
      const r = safe(() => this.lines.readLine({ lineId: id, viewer }));
      return r && r.ok !== false && r.found && r.line && !r.line.withdrawn ? r.line : null;
    };
    switch (d.basis) {
      case "act_or_position": {
        const line = liveLine(d.ref.line);
        if (!line) return word("case-disclosures.line_record_holds", { line: String(d.ref.line) });
        if (line.kind !== "holds" || !members.has(line.from)) return word("case-disclosures.post_person_holds", { line: String(d.ref.line) });
        const ev = safe(() => this.events.readEvent({ eventId: d.ref.event, viewer }));
        if (!ev || ev.ok === false || !ev.found || !ev.event) return word("case-disclosures.event_record_holds", { event: String(d.ref.event) });
        const when = ev.event.when;
        if (!when || typeof when !== "object" || typeof when.value !== "string")
          return word("case-disclosures.placed_date_record", { event: String(d.ref.event) });
        const at = { value: when.value, precision: when.precision ?? null, zone: when.zone ?? null };
        const s = safe(() => this.lines.structureAt({ entity: line.from, at, kinds: ["holds"], viewer }));
        if (!s || s.ok === false) return word("case-disclosures.whether_held_date", { line: String(d.ref.line), event: String(d.ref.event) });
        if ((s.held || []).some((l) => l && l.line_id === line.line_id)) return null;
        const u = (s.undetermined || []).find((x) => x && x.line && x.line.line_id === line.line_id);
        return u ? word("case-disclosures.whether_held_date_settled", { line: String(d.ref.line), event: String(d.ref.event), why: String(u.why) })
                 : word("case-disclosures.held_date", { line: String(d.ref.line), event: String(d.ref.event) });
      }
      case "tie": {
        const line = liveLine(d.ref);
        if (!line) return word("case-disclosures.line_record_holds", { line: String(d.ref) });
        if (!TIE_LINE_KINDS.includes(line.kind) || !(members.has(line.from) || members.has(line.to)))
          return word("case-disclosures.tie_person", { ref: String(d.ref) });
        return null;
      }
      case "interest": {
        for (const m of members) {
          const r = safe(() => this.people.interestsOf({ entityId: m, viewer }));
          if (!r || r.ok === false) continue;
          if ((r.interests || []).some((l) => l && l.line_id === d.ref) || (r.money || []).some((f) => f && f.fact_id === d.ref)) return null;
        }
        return word("case-disclosures.interest_record_holds", { ref: String(d.ref) });
      }
      case "consent": case "prior_publication":
        return this.#captureSeen(d.ref, viewer) ? null : word("case-disclosures.capture_record_holds", { ref: String(d.ref) });
      case "private_party":
        return d.words ? null : word("case-disclosures.private_person_named");
      default:
        return word("case-disclosures.basis");
    }
  }

  /* R25: a capture the record registers in a bundle `viewer` may see (provenance R48's `register`, sight by membership
     R43); one that cannot be seen is as one not held. */
  #captureSeen(sha, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return false;
    return !!this.#one(`SELECT 1 AS x FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id WHERE r.capture_sha=?
                        AND (${gate.sql}) LIMIT 1`, sha, ...gate.args);
  }

  /* R26: the values of the named persons' address and contact facts the viewer may read (`people.personAt` marks them
     `publishable: false`), lower-cased, held or undetermined at the judgment's day; used only to keep them out. */
  #contactValues(persons, viewer) {
    const day = String(this.#now()).slice(0, 10);
    const out = new Set();
    for (const p of persons)
      for (const m of new Set([p.person, ...(Array.isArray(p.members) ? p.members : [])])) {
        let r = null;
        try { r = this.people.personAt({ entityId: m, at: day, viewer }); } catch { r = null; }
        if (!r || r.ok === false) continue;
        for (const f of [...(r.facts || []), ...(r.undetermined || [])])
          if (f && f.publishable === false && f.value != null) {
            const v = String(f.value).trim().toLowerCase();
            if (v.length >= 3) out.add(v);
          }
      }
    return [...out];
  }

  /** R27 (K1490): each member who signs the case attests that they hold no undeclared tie to any entity the case names,
   *  the payers and payees of its money facts included. `signers` are the signing members' ids; `named` R24's answer (its
   *  `entities`, every person's cluster with them); `moneyParties` the money facts' parties (R24's `money_parties`);
   *  `attested: [{signer, at}]` the attestations the caller stamped. A signer with none is C-120.16, named to themself
   *  only: the refusal names a missing signer when `viewer` is that signer, and counts the others. For each tie a signer
   *  declared to such an entity (`people.tiesConcerning`, its R20, read as that signer), a `member_ties:` row at the level
   *  the member chose for it: at `group` or `project` with no handle, key or signature; at `cover` or `name` with their
   *  cover or handle (R10's levels). Each attestation is its own row, with its signer and instant, in the document they
   *  sign (no table here, R23). A ties read that fails is answered in `undetermined`, never filled (R18). Answers
   *  `{refusals, rows, undetermined}`. */
  tieAttestationJudged(signers, named, moneyParties, attested, viewer) {
    const bad = (field, detail) => ({ refusals: [{ ok: false, reason: "BAD_COMPLETENESS", field, detail }], rows: [], undetermined: [] });
    const bare = (s) => (typeof s === "string" ? s.trim().replace(/^member:/, "") : "");
    if (!Array.isArray(signers) || signers.some((s) => !bare(s))) return bad("signers", "signers is a list of the signing members' ids");
    const by = new Map();
    if (attested != null) {
      if (!Array.isArray(attested)) return bad("attested", "attested is a list of {signer, at}, one per signer's attestation");
      for (let i = 0; i < attested.length; i++) {
        const a = attested[i];
        if (!a || typeof a !== "object" || Array.isArray(a) || !bare(a.signer) || (a.at != null && typeof a.at !== "string"))
          return bad(`attested[${i}]`, `attested[${i}] is not {signer, at} naming a signer`);
        if (!by.has(bare(a.signer))) by.set(bare(a.signer), { signer: bare(a.signer), at: a.at ?? null });
      }
    }
    const who = [...new Set(signers.map(bare))];
    const ids = new Set([...(named && Array.isArray(named.entities) ? named.entities : []),
                         ...(named && Array.isArray(named.named) ? named.named.flatMap((p) => [p.person, ...(p.members || [])]) : []),
                         ...(Array.isArray(moneyParties) ? moneyParties : [])].filter((x) => typeof x === "string" && x));
    const me = bare(typeof viewer === "string" ? viewer : "");
    const missing = who.filter((s) => !by.has(s));
    const refusals = [];
    /* DEC-49 REGION is-tie-attested */
    if (missing.length) {
      const mine = missing.filter((s) => s === me);
      refusals.push(disclosureRefusal("TIE_ATTESTATION_MISSING", { missing: mine, others_missing: missing.length - mine.length,
        detail: (mine.length ? localize("case-disclosures.index.you_not_attested_tie", "You have not attested that you hold no undeclared tie to anyone or anything this case names. ") : "")
              + (missing.length - mine.length ? localize("case-disclosures.index.others_not_attested", "{count} other signer(s) have not attested. ", { count: String(missing.length - mine.length) }) : "")
              + localize("case-disclosures.index.each_signer_attests", "Each signer attests before the case is signed, or declares the tie first (op=membertie). Nothing was written.") }));
    }
    /* END DEC-49 REGION is-tie-attested */
    const rows = [], undetermined = [];
    for (const s of who) {
      if (by.has(s)) rows.push({ row: "attestation", signer: s, at: by.get(s).at, entity: null, kind: null, level: null, shown: null });
      if (!ids.size) continue;
      let t = null;
      try { t = this.people.tiesConcerning({ entities: [...ids], member: s, viewer: `member:${s}` }); }
      catch (e) { t = { ok: false, reason: String(e && e.message || e).slice(0, 160) }; }
      if (!t || t.ok === false || !Array.isArray(t.ties)) { undetermined.push({ signer: s, why: t ? t.reason ?? word("case-disclosures.why.read_failed") : NO_ANSWER }); continue; }
      let facts = null;
      for (const tie of t.ties) {
        const level = tie.attribution ?? null;
        /* R10's levels: a handle only at `cover` or `name`; at `group`, `project` or none, nobody is shown */
        const open = !TIE_ANONYMOUS_LEVELS.includes(level) && (level === "cover" || level === "name");
        if (open && facts === null) { try { facts = this.membership.memberFacts(s) || {}; } catch { facts = {}; } }
        const shown = !open ? null : level === "cover" ? facts.cover ?? null : facts.handle ?? null;
        rows.push({ row: "tie", signer: null, at: null, entity: tie.entity, kind: tie.kind, level, shown });
      }
    }
    return { refusals, rows, undetermined };
  }

  /** R1's input: `tensionsDisclosed`, `[{candidate, words?}]`, as a map by candidate (a candidate listed twice is
   *  disclosed once, its first words kept). Absent or null is none. Any malformed shape is `BAD_COMPLETENESS`
   *  (`case-authoring` R3's code) naming the field (K498): a list that is not one, an entry that is not an object naming a `candidate` string, and
   *  words over `COMPLETENESS_MAX` or holding a character the grammar cannot carry (a double quote, a backslash, a line
   *  break; an apostrophe is legal inside its quoted string). C-120.2 is only for a well-formed candidate. */
  #disclosuresListed(list) {
    const byCandidate = new Map();
    const bad = (field, detail) => ({ ok: false, reason: "BAD_COMPLETENESS", field, detail });
    if (list == null) return { ok: true, byCandidate };
    if (!Array.isArray(list))
      return bad("tensionsDisclosed", "tensionsDisclosed is a list of {candidate, words?}, one per conflict disclosed");
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const candidate = d && typeof d === "object" && !Array.isArray(d) && typeof d.candidate === "string"
        ? d.candidate.trim() : "";
      if (!candidate)
        return bad(`tensionsDisclosed[${i}]`, `tensionsDisclosed[${i}] is not {candidate, words?} naming a candidate`);
      if (d.words != null && typeof d.words !== "string")
        return bad(`tensionsDisclosed[${i}].words`, `tensionsDisclosed[${i}].words is the owner's words, a string`);
      const words = typeof d.words === "string" ? d.words.trim() || null : null;
      if (words !== null && (words.length > COMPLETENESS_MAX || /["\\\r\n]/.test(words)))
        return bad(`tensionsDisclosed[${i}].words`, `tensionsDisclosed[${i}].words is at most ${COMPLETENESS_MAX} `
          + `characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has `
          + `no escapes`);
      if (!byCandidate.has(candidate)) byCandidate.set(candidate, { candidate, ord: i, words });
    }
    return { ok: true, byCandidate };
  }

  /** R1 (and `case-authoring` R32): THE ONE READ of what a case over `prepared` must disclose: `contradiction.unresolvedRecordOn` (its R29)
   *  for each member at its pin, as `viewer`. A read that fails or is truncated is C-120.3 (what cannot be read cannot
   *  be disclosed). A leg the read could name no referent for (`undetermined_legs`: a document leg with no content row)
   *  is stated, never filled (R18): counted per member in `unread`. Answers C-120.3 itself or `{ok: true, entries, unread}`, one
   *  entry per candidate and member, each with its sides as the document states them, and a highlighted one with its
   *  seen side only (R17). Never throws. */
  tensionsRead(prepared, viewer) {
    const entries = [];
    const failed = [];
    const unread = [];
    for (const p of prepared) {
      let r = null;
      try { r = this.contradiction.unresolvedRecordOn({ finding: p.id, sha: p.bundleSha, viewer }); }
      catch (e) { r = { undetermined: true, why: String(e && e.message || e).slice(0, 160) }; }
      if (!r || r.ok === false || r.undetermined || r.truncated || !Array.isArray(r.candidates)) {
        failed.push({ finding: p.id, sha: p.bundleSha,
                      why: !r ? NO_ANSWER : r.truncated ? word("case-disclosures.why.candidates", { bound: String(r.bound ?? word("case-disclosures.why.bound")) })
                         : r.why || word("case-disclosures.why.read_failed") });
        continue;
      }
      if (Number(r.undetermined_legs) > 0) unread.push({ finding: p.id, legs: Number(r.undetermined_legs) });
      for (const c of r.candidates) {
        if (c.unseen_other_side)
          entries.push({ candidate: c.candidate, finding: p.id, state: c.state, kind: null, unseen_other_side: true,
                         side: tensionSide(c.side), depth: 1 });
        else
          entries.push({ candidate: c.candidate, finding: p.id, state: c.state, kind: c.kind ?? null,
                         unseen_other_side: false, a: tensionSide(c.a), b: tensionSide(c.b),
                         explanation: c.explanation ?? null, depth: 1 });
      }
    }
    if (failed.length) return this.tensionsUndetermined(failed);
    return { ok: true, entries, unread };
  }

  /** R1: C-120.3's one site, a read of conflicts that could not be made whole, naming each finding and why; also the
   *  refusal for a caller's own failed read (`case-authoring` R32). */
  tensionsUndetermined(failed) {
    /* DEC-49 REGION is-tensions-determined */
    return disclosureRefusal("TENSIONS_UNDETERMINED", { undetermined: failed,
      detail: localize("case-disclosures.index.record_not_read_whole_conflicts", "the record could not be read whole for conflicts on {map}, so what this case must disclose is not known. Nothing was published.", { map: String(failed.map((f) => localize("case-disclosures.index.finding_why", "{finding} ({why})", { finding: String(f.finding ?? localize("case-disclosures.index.this_cases_findings", "this case's findings")), why: String(f.why) })).join("; ")) }) });
    /* END DEC-49 REGION is-tensions-determined */
  }

  /* R1, R17: how C-120.1 names an undisclosed entry. A half-seen one by its candidate and its finding only. */
  #namedInRefusal(e) {
    return e.unseen_other_side
      ? { candidate: e.candidate, finding: e.finding, unseen_other_side: true, says: NOT_SHOWN_WORDS }
      : { candidate: e.candidate, finding: e.finding, state: e.state, kind: e.kind, a: e.a, b: e.b };
  }

  /** R30 (T41; N820; D56–D58, D63; K2405, K2418, K2471): THE ACCOUNT SAYS ONLY WHAT THE RECORD HOLDS. Every sentence of
   *  the account and of the four statements (`case-grammar` R23's rows `{ord, text, cites, kind, bias_statement?,
   *  began_as?}`) is judged against what it cites by `case-checker.checkAccount` (its R24), one body of check code online
   *  and offline: `cited` as the caller read it as the viewer (`answers` R33's `{holdings, rules, looks}`, as `case-account`
   *  R6 builds it), translated here, the one site, into `checkAccount`'s list (`checkerCited`; T46, N901), `printed` the
   *  statements the sentences frame by that `bias.statementInForce` (its R49) answers in force in this case's `lens`
   *  (its scope shape), and `conclusions` the record's at the act, as the caller read them. Its departures `{ord, code}`
   *  are answered in R30's arm order (`ACCOUNT_ARMS`), one refusal per code naming each sentence; the first arm,
   *  `ACCOUNT_SENTENCE_UNSUPPORTED`, refuses account sentences only (K2533: a statement's sentence may cite, and when it
   *  cites nothing the other arms still judge it), so its departure on a statement's sentence is not one. A check that cannot be
   *  run (no `checkAccount`, a throw, any other answer, a code that is no arm's) fails closed:
   *  `ACCOUNT_CHECK_UNDETERMINED`, naming every sentence (R23). Then each `account_check` flag (`run-rules` R25's draft
   *  kind) `{kind, ord, text, cites}` (each cite as `case-grammar` R23 spells it, `{kind, ref, ord}`) the member has not answered — the flagged sentence still stands with its text and
   *  cites nothing it did not cite when flagged — is `ACCOUNT_FLAG_UNANSWERED`, naming it; removing the sentence, or tying
   *  it to evidence it did not cite, answers it. A malformed list is `BAD_COMPLETENESS` naming the field, alone. Answers
   *  `{refusals, sentences, printed}`. The answer's shape, `conclusions` and `flags` are K2531's. Writes nothing; never
   *  throws. */
  accountJudged({ account = null, statements = null, cited = null, lens = null, conclusions = null, flags = null,
                  viewer = null } = {}) {
    const bad = (field, detail) => ({ refusals: [{ ok: false, reason: "BAD_COMPLETENESS", field, detail }], sentences: [], printed: [] });
    const sentences = [];
    for (const [field, list] of [["account", account], ["statements", statements]]) {
      if (list == null) continue;
      if (!Array.isArray(list)) return bad(field, `${field} is a list of sentences {ord, text, cites, kind, bias_statement?}`);
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.text !== "string" || !r.text.trim()
            || (r.cites != null && (!Array.isArray(r.cites) || r.cites.some((c) => !c || (typeof c !== "string" && typeof c !== "object"))))
            || (r.bias_statement != null && typeof r.bias_statement !== "string"))
          return bad(`${field}[${i}]`, `${field}[${i}] is not a sentence {ord, text, cites, kind, bias_statement?}`);
        sentences.push({ ...r, ord: Number.isInteger(r.ord) ? r.ord : sentences.length + 1, text: r.text.trim(),
                         cites: Array.isArray(r.cites) ? r.cites : [], kind: r.kind ?? (field === "account" ? "account" : null),
                         bias_statement: typeof r.bias_statement === "string" && r.bias_statement.trim() ? r.bias_statement.trim() : null });
      }
    }
    const marked = (list) => list.map((x) => ({ ord: x.ord, kind: x.kind, text: x.text }));
    /* the printed statements: each one a sentence frames by, asked of the lens in force for this case */
    const printed = [];
    for (const statement of [...new Set(sentences.map((x) => x.bias_statement).filter(Boolean))]) {
      let r = null;
      try { r = this.bias.statementInForce({ statement, scope: lens ?? "instance", viewer }); } catch { r = null; }
      if (r && r.ok === true && r.in_force === true) printed.push(statement);
    }
    const refusals = [];
    let answer = null;
    try {
      const check = this.caseChecker && this.caseChecker.checkAccount;
      answer = typeof check === "function" ? check({ account: sentences, cited: checkerCited(cited), printed, conclusions }) : null;
    } catch { answer = null; }
    const byOrd = new Map(sentences.map((x) => [x.ord, x]));
    const all = answer && answer.ok === true && Array.isArray(answer.departures) ? answer.departures : null;
    const known = all && all.every((d) => d && ACCOUNT_ARMS.includes(d.code) && byOrd.has(d.ord));
    const departures = known ? all.filter((d) => d.code !== "ACCOUNT_SENTENCE_UNSUPPORTED" || byOrd.get(d.ord).kind === "account") : null;
    if (!known) {
      /* DEC-49 REGION is-account-checked */
      if (sentences.length)
        refusals.push(disclosureRefusal("ACCOUNT_CHECK_UNDETERMINED", { sentences: marked(sentences),
          detail: localize("case-disclosures.index.account_not_checked", "the account could not be checked against what it cites ({why}), so whether each of its {length} sentence(s) stands is not known. Try again. Nothing was written.", { why: String(answer && answer.ok === false
            ? localize("case-disclosures.index.check_answered", "the check answered {reason}", { reason: String(answer.reason ?? localize("case-disclosures.index.a_refusal", "a refusal")) })
            : localize("case-disclosures.index.check_answered_nothing", "the check answered nothing it states")), length: String(sentences.length) }) }));
      /* END DEC-49 REGION is-account-checked */
    } else {
      const named = (code) => marked([...new Set(departures.filter((d) => d.code === code).map((d) => d.ord))]
        .map((o) => byOrd.get(o)));
      const say = (list) => list.map((x) => localize("case-disclosures.index.sentence_quoted", "sentence {ord} (\"{text}\")", { ord: String(x.ord), text: String(x.text.slice(0, 80)) })).join("; ");
      let n;
      /* DEC-49 REGION is-account-sentence-supported */
      if ((n = named("ACCOUNT_SENTENCE_UNSUPPORTED")).length)
        refusals.push(disclosureRefusal("ACCOUNT_SENTENCE_UNSUPPORTED", { sentences: n,
          detail: localize("case-disclosures.index.sentence_cites_nothing", "{say} cites nothing and is not marked as following a printed bias statement. Cite what it rests on, or take it out. Nothing was written.", { say: say(n) }) }));
      /* END DEC-49 REGION is-account-sentence-supported */
      /* DEC-49 REGION is-account-fact-cited */
      if ((n = named("ACCOUNT_FACT_NOT_IN_CITED")).length)
        refusals.push(disclosureRefusal("ACCOUNT_FACT_NOT_IN_CITED", { sentences: n,
          detail: localize("case-disclosures.index.sentence_fact_not_cited", "{say} states a figure, date, name or quotation that what it cites does not hold. Nothing was written.", { say: say(n) }) }));
      /* END DEC-49 REGION is-account-fact-cited */
      /* DEC-49 REGION is-account-consistent-with-record */
      if ((n = named("ACCOUNT_CONTRADICTED_BY_RECORD")).length)
        refusals.push(disclosureRefusal("ACCOUNT_CONTRADICTED_BY_RECORD", { sentences: n,
          detail: localize("case-disclosures.index.sentence_contradicts_record", "{say} says other than the record holds, and cannot be tied to evidence. Nothing was written.", { say: say(n) }) }));
      /* END DEC-49 REGION is-account-consistent-with-record */
      /* DEC-49 REGION is-account-bias-printed */
      if ((n = named("ACCOUNT_BIAS_NOT_PRINTED")).length)
        refusals.push(disclosureRefusal("ACCOUNT_BIAS_NOT_PRINTED", { sentences: n,
          detail: localize("case-disclosures.index.sentence_bias_not_printed", "{say} is framed by a bias statement this case's lens does not print. Nothing was written.", { say: say(n) }) }));
      /* END DEC-49 REGION is-account-bias-printed */
      /* DEC-49 REGION is-account-bias-not-a-claim */
      if ((n = named("ACCOUNT_CLAIM_NOT_BIAS")).length)
        refusals.push(disclosureRefusal("ACCOUNT_CLAIM_NOT_BIAS", { sentences: n,
          detail: localize("case-disclosures.index.sentence_claim_not_bias", "{say} is marked as following a bias statement and states a fact. Lying is not bias. Nothing was written.", { say: say(n) }) }));
      /* END DEC-49 REGION is-account-bias-not-a-claim */
    }
    /* the machine's flags, judged here (R30): answered by the sentence's removal, or by evidence it did not cite */
    if (flags != null) {
      if (!Array.isArray(flags)) return bad("flags", "flags is a list of the account_check flags {kind, ord, text, cites}");
      const unanswered = [];
      for (let i = 0; i < flags.length; i++) {
        const f = flags[i];
        if (!f || typeof f !== "object" || Array.isArray(f) || f.kind !== "account_check" || !DRAFT_KINDS.includes(f.kind)
            || typeof f.text !== "string" || !f.text.trim() || (f.cites != null && !Array.isArray(f.cites)))
          return bad(`flags[${i}]`, `flags[${i}] is not an account_check flag {kind, ord, text, cites}`);
        const was = new Set((Array.isArray(f.cites) ? f.cites : []).map(citeKey));
        unanswered.push(...sentences.filter((x) => x.text === f.text.trim() && x.cites.every((c) => was.has(citeKey(c)))));
      }
      const n = marked([...new Map(unanswered.map((x) => [x.ord, x])).values()]);
      /* DEC-49 REGION is-account-flag-answered */
      if (n.length)
        refusals.push(disclosureRefusal("ACCOUNT_FLAG_UNANSWERED", { sentences: n,
          detail: localize("case-disclosures.index.machine_flagged_sentences", "the machine flagged {say} as not supported by what it cites, and it stands as flagged. Tie it to evidence, or take it out. Nothing was written.", { say: String(n.map((x) => localize("case-disclosures.index.sentence_quoted", "sentence {ord} (\"{text}\")", { ord: String(x.ord), text: String(x.text.slice(0, 80)) })).join("; ")) }) }));
      /* END DEC-49 REGION is-account-flag-answered */
    }
    return { refusals, sentences, printed };
  }

  /** R31 (T41; D59; K2472): the `bias_applications:` rows (`case-grammar` R24) of every finding a member's chain
   *  reaches (R8, as `viewer` sees the record): each application a leg of its live `bundle.md` carries (`inquiry-grammar`
   *  R18's one encoding, `readBiasApplied`), `{finding, ord, target: "leg", statement, effect, from, to}` in `case-grammar`
   *  R24's fields. Whether each statement
   *  is in force is `inquiry`'s one test (`biasAppliedFindings`, its R61, at the finding's project scope as the viewer),
   *  never re-derived here; one not in force is answered as inquiry spells it (`biasNotInForce`, C-2.19), naming the
   *  finding, the leg and the statement. A test that cannot be had refuses each application through the same spelling
   *  (fail closed, R23). A reached finding whose document cannot be read is stated in `unread` (R18). A conclusion's
   *  applications live on the project's document (`basis-versions` R48), which this module does not read: the caller
   *  passes them (K2531), `conclusions: [{finding, project, bias_applied}]` as `basis-versions`' `conclusionRecordOf`
   *  answers them, each answered as a row with `ord` null and `target: "conclusion"`, and judged by the same test at its
   *  project's scope. A malformed list is `BAD_COMPLETENESS` naming the field, alone. Answers `{refusals, rows,
   *  unread}`. Writes nothing; never throws. */
  biasApplicationsOf(prepared, viewer, conclusions = null) {
    const rows = [], refusals = [], unread = [];
    if (conclusions != null && (!Array.isArray(conclusions) || conclusions.some((c) => !c || typeof c !== "object"
        || typeof (c.finding ?? c.inquiry) !== "string" || (c.bias_applied != null && !Array.isArray(c.bias_applied))
        || flattenBiasApplied(c.bias_applied || []) === null)))
      return { refusals: [{ ok: false, reason: "BAD_COMPLETENESS", field: "conclusions",
        detail: "conclusions is a list of {finding, project, bias_applied}, as basis-versions' conclusionRecordOf answers them" }],
        rows, unread };
    let findings = [];
    try {
      findings = chainsOf((Array.isArray(prepared) ? prepared : []).filter((p) => p && typeof p.id === "string")
        .map((p) => ({ id: p.id, role: null })), this.#chainIo(viewer), DEPTH_BOUND).findings;
    } catch (e) { unread.push({ finding: null, why: String(e && e.message || e).slice(0, 160) }); }
    for (const id of [...new Set(findings.map((f) => f.id))]) {
      const text = this.#liveText(id);
      const fm = text === null ? null : parseFrontmatter(text).data;
      if (!fm || typeof fm !== "object") { unread.push({ finding: id, why: word("case-disclosures.why.document_read") }); continue; }
      const legs = Array.isArray(fm.basis) ? fm.basis : [];
      const project = typeof fm.project === "string" ? fm.project : null;
      const applied = legs.map((leg) => readBiasApplied(leg));
      applied.forEach((list, ord) => list.forEach((a) => rows.push({ finding: id, ord, target: "leg", statement: a.statement ?? null,
        effect: a.effect ?? null, from: a.from ?? null, to: a.to ?? null })));
      if (!applied.some((l) => l.length)) continue;
      let found = null;
      try { found = this.inquiry.biasAppliedFindings({ legs, project, viewer }); } catch { found = null; }
      if (!Array.isArray(found))
        found = applied.flatMap((list, i) => list.map((a, j) => biasNotInForce({ statement: a.statement ?? null,
          where: `basis[${i}].bias_applied[${j}]`, inForce: null, scope: project ? { type: "project", id: project } : { type: "instance" } })));
      for (const f of found)
        if (f && f.code === "BIAS_APPLICATION_NOT_IN_FORCE")
          refusals.push({ ok: false, reason: f.code, ...f, finding: id });
    }
    for (const c of conclusions || []) {
      const id = c.finding ?? c.inquiry, project = typeof c.project === "string" ? c.project : null;
      const list = Array.isArray(c.bias_applied) ? c.bias_applied : [];
      if (!list.length) continue;
      for (const a of list) rows.push({ finding: id, ord: null, target: "conclusion", statement: a.statement ?? null,
                                        effect: a.effect ?? null, from: a.from ?? null, to: a.to ?? null });
      let found = null;
      try { found = this.inquiry.biasAppliedFindings({ legs: [flattenBiasApplied(list)], project, viewer }); } catch { found = null; }
      if (!Array.isArray(found))
        found = list.map((a, j) => biasNotInForce({ statement: a.statement ?? null, where: `basis[0].bias_applied[${j}]`, inForce: null,
                                                    scope: project ? { type: "project", id: project } : { type: "instance" } }));
      for (const f of found)
        if (f && f.code === "BIAS_APPLICATION_NOT_IN_FORCE")
          refusals.push({ ok: false, reason: f.code, ...f,
                          where: typeof f.where === "string" ? f.where.replace(/^basis\[0\]/, "conclusion") : f.where, finding: id });
    }
    return { refusals, rows, unread };
  }

  /** R3, R7, R10, R14 (K1134 Q6, BOB's decision 15; K1316): the rows the case document writes for what R2, R6 and R14
   *  judged, once the caller is past its last refusal and has read R4's sources and the attribution run. Its arguments
   *  are those answers as the caller holds them: `resting` (R2's captures), `facts` (a map of R2's facts by capture,
   *  extended here by every document R6 reached), `selfAttested` (R2's judgment, or its `byCapture`), `reached` (R6's
   *  judgment), `flags` (R14's judgment), `withheld` (R4's off-the-record captures, `withheldOf`), `attributionOf` (the
   *  attribution rows by capture or observation, `case-tensions.attributionStatements`, its R5 and R7), `project`, and the act's
   *  `author` stamp and instant `at`. Answers `{captures, materials: {rows, attestations}, flags, group}`:
   *  - `captures`: one row per (member, capture), R2's facts with `self_attested_only` and, on an acknowledged capture's
   *    rows, `{reason, acknowledged_by, at, sentence}` (R3); each capture's signed accounts on its first row only, an
   *    off-the-record one's text only unless its member chose to be named (R10);
   *  - `materials`: `materialRows` over R6's materials (R7), an off-the-record capture's origin not stated (R10);
   *  - `flags`: one row per open flag disclosed, the owner's words marked as the owner's, acknowledged by the `author`
   *    stamp at `at` (R14); the flagging member is not named;
   *  - `group`: the producing group's slug (promotion's fact `producingGroup`), or null.
   *  Reads nothing it was not handed but the facts of a reached document, its origin and its register row. */
  disclosureBlocks({ resting = [], facts = new Map(), selfAttested = null, reached = null, flags = null,
                     withheld = new Set(), attributionOf = new Map(), project = null, author = null, at = null } = {}) {
    const who = author, when = at;
    const byCapture = selfAttested instanceof Map ? selfAttested
      : selfAttested && selfAttested.byCapture instanceof Map ? selfAttested.byCapture : new Map();
    const factsOf = (sha) => { if (!facts.has(sha)) facts.set(sha, this.captureFacts(sha)); return facts.get(sha); };
    /* R10: a member credited at `cover` or `name` is named as they chose; at `group`, `project` or none yet, never by
       handle, key or signature. */
    const named = (sha) => { const l = (attributionOf.get(sha) || {}).level; return l === "cover" || l === "name"; };
    /* R2, R3: each (member, capture) row, the owner's acknowledgement (the `author` stamp at this act) on every row of
       an acknowledged capture, and each capture's signed accounts, an off-the-record one's text only unless its member
       chose to be named (R10). */
    const accountsCarried = new Set();
    const captures = resting.map((r) => {
      const { accounts_read, ...f } = factsOf(r.capture);
      const ack = byCapture.get(r.capture) || null;
      /* A capture's accounts ride on its first row only, so each is written once (publication R20 reads them back by
         capture). */
      const first = !accountsCarried.has(r.capture);
      accountsCarried.add(r.capture);
      const hidden = withheld.has(r.capture) && !named(r.capture);
      return { ...f, member: r.member, self_attested_only: !!ack,
               ...(ack ? { acknowledgement: { reason: ack.reason, acknowledged_by: who, at: when,
                                              sentence: SELF_ATTESTED_SENTENCE } } : {}),
               accounts: !first ? [] : hidden ? accounts_read.map((x) => ({ ...x, by: null, signature: null })) : accounts_read };
    });
    /* R7 (K1134 Q6, BOB's decision 15): each material a chain reaches and its attestations. */
    const group = (() => {
      let f = null;
      try { f = this.promotion.fact("producingGroup"); } catch { f = null; }
      return f && f.ok ? f.value ?? null : null;
    })();
    const materials = materialRows(reached && Array.isArray(reached.materials) ? reached.materials : [],
                                   { project, group, at: when, facts: factsOf,
      origin: (sha) => withheld.has(sha) ? null : (this.#one(`SELECT address FROM captured_locators WHERE capture_sha=?
                         AND address NOT LIKE 'knock:%' ORDER BY first_retrieved, address LIMIT 1`, sha) || {}).address ?? null,
      registered: (sha) => this.#one(`SELECT bundle_id, registered FROM register WHERE capture_sha=?`, sha),
      /* R7 (C47; K4438): the title the document's record states (record-core R37's `bundles.title`, the title acquisition
         R98 read from the capture and promotion filed), words only; a blank or unreadable one is none */
      title: (m) => {
        let t = null;
        try { t = (this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, m.ref) || {}).title; } catch { t = null; }
        return typeof t === "string" && t.trim() ? t.trim() : null;
      },
      member: (m, f) => {
        const attr = attributionOf.get(m.kind === "observation" ? m.ref : m.sha) || null;
        if (m.kind === "observation")
          return [{ by: attr ? attr.shown ?? null : null, level: attr ? attr.level ?? null : null, at: null, signature: null }];
        const accounts = f && Array.isArray(f.accounts_read) ? f.accounts_read : [];
        /* A capture whose source is not withheld: its signed accounts are in the capturing member's own name (DEC-81
           item 3), so their row states that level and carries the handle and signature (case-grammar R12). */
        if (!withheld.has(m.sha)) return accounts.map((x) => ({ by: x.by, level: "name", at: x.at, signature: x.signature }));
        const level = attr ? attr.level ?? null : null, open = named(m.sha);
        const shown = open ? attr.shown ?? null : null;
        return accounts.length ? accounts.map((x) => ({ by: shown, level, at: x.at, signature: open ? x.signature : null }))
                               : [{ by: shown, level, at: null, signature: null }];
      } });
    /* R14: each open flag disclosed, the owner's words marked as the owner's, acknowledged by the `author` stamp. */
    const byFlag = flags && flags.byFlag instanceof Map ? flags.byFlag : new Map();
    const flagRows = (flags && Array.isArray(flags.open) ? flags.open : []).map((f) => ({ ref: f.ref, edition: f.edition,
      flag: f.flag, issue: f.issue, flagged_at: f.at, words: (byFlag.get(f.flag) || {}).words ?? null,
      acknowledged_by: who, acknowledged_at: when }));
    return { captures, materials, flags: flagRows, group };
  }
}

/* R30 (T46; N901; K2829): `cited` as `case-account` R6 builds it, `answers` R33's `{holdings, rules, looks}`, each holding
   `{address, quote}`, translated into `case-checker.checkAccount`'s `cited` (its R24): one `{kind, ref, ord?, text}` per
   holding, `kind` the address before its first colon, `ref` what follows, a leg's `ord` the `#<digits>` that ends it (a
   ref of any other kind keeps a `#` it holds), `text` the holding's `quote`. The provider's shape is kept: the address is
   read as case-account spells it, never re-spelled there. A holding whose address names no kind of `case-grammar` R23's
   cites (`ACCOUNT_CITE_KINDS`), or a leg with no `ord`, answers nothing the account can cite, so it is not handed on;
   `rules` and `looks` hold nothing a sentence cites. Any other `cited` is handed on as given, and `checkAccount` judges
   it (a shape it does not take fails closed, `ACCOUNT_CHECK_UNDETERMINED`). */
export function checkerCited(cited) {
  if (!cited || typeof cited !== "object" || Array.isArray(cited) || !Array.isArray(cited.holdings)) return cited;
  const out = [];
  for (const h of cited.holdings) {
    if (!h || typeof h !== "object" || typeof h.address !== "string") continue;
    const at = h.address.indexOf(":");
    const kind = at > 0 ? h.address.slice(0, at) : "";
    let ref = at > 0 ? h.address.slice(at + 1) : "";
    if (!ACCOUNT_CITE_KINDS.includes(kind) || !ref) continue;
    let ord = null;
    if (kind === "leg") {
      const m = /^(.+)#(\d+)$/.exec(ref);
      if (!m) continue;
      ref = m[1]; ord = Number(m[2]);
    }
    out.push({ kind, ref, ...(ord === null ? {} : { ord }), text: typeof h.quote === "string" ? h.quote : String(h.quote ?? "") });
  }
  return out;
}

/* R30: one cite as a comparable key, a string as itself and `case-grammar` R23's `{kind, ref, ord}` by those fields. */
const citeKey = (c) => (typeof c === "string" ? c : JSON.stringify([c && c.kind ? c.kind : null, c && c.ref != null ? c.ref : null,
                                                                    c && c.ord != null ? c.ord : null]));

/* R6, R29 (T40; DEC-185 (1); K2483): the label a photo's copy carries, `case-carriage`'s words (its R11), and the key a
   reader's surface shows it by. */
function photoLabel(marked) {
  return marked
    ? { label: OBSCURED_LABEL, marked: true, label_key: "photo.obscured.label" }
    : { label: PUBLISHED_LABEL, marked: false, label_key: "photo.published.label" };
}

/* R33: the local day, in `zone`, of an actor's instant (`civil-time.localDay`); null when there is no actor, no zone or
   an instant the clock cannot read (a refusal), never a UTC day. */
function dayOf(first, zone) {
  if (!first || typeof first.at !== "string" || !zone) return null;
  try {
    const day = localDay(first.at, zone);
    return typeof day === "string" ? day : null;
  } catch { return null; }
}

/* R6 (T39; N806): the publication-copy states (`case-carriage` R16) a document is judged in by what is held, as any
   document; every other state travels only as its copy or not at all. */
const AS_HELD = Object.freeze(["public", "clean"]);

/* R6, R29 (T37; N757): whether a document's marks decide what of it travels — held whole (it would travel whole), or
   reached by a load-bearing member (a copy may make it presentable). Supporting-only material not held whole travels in no
   case. A material that does not say (no `held`, no `rests_under`) decides: fail closed. */
function marksDecide(m) {
  const whole = m.held && typeof m.held === "object" ? m.held.whole !== false : true;
  return whole || m.rests_under !== "supporting";
}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It holds no table, so it creates none and
 *  declares nothing to purge (R23). */
export function caseDisclosuresOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    c = new CaseDisclosures({ ...d, host, storage, record });
    instances.set(host, c);
  }
  return c;
}
