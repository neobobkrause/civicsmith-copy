/* case-grammar — the case document's grammar, one spelling for every module (requirements:
 * `build/requirements/case-grammar.md`; BIO_Publication_v0_1.md §3 rules 2, 7, 12, 16 and §7; MEMBER-KNOWLEDGE-DESIGN.md
 * §4; N345, N364; D-431, D-442). Text in, values out: the formats and their predicates (R1, `./formats.mjs`), the `/5`
 * blocks (R1, `./blocks.mjs`) and tension section (R1, `./tensions.mjs`), the attribution run's text (R2), the
 * sections a later act re-authors (R3), the citations a signed document carries (R4), the edge set a finding rests
 * on (R5), what changed in an edition and the lens it was produced under (R8, R9, `./edition.mjs`), and the project
 * reference a case carries (R10, `./reference.mjs`), the method and materials a `/6` case carries and the other
 * group's work it rests on (R11, R12, R16, `./materials.mjs`), each finding's signed grading facts and passages and the
 * one extracted text (R17, `./facts.mjs`), the case file's format (R13, `./casefile.mjs`), the
 * complete edition (R14, `./complete.mjs`), a finding's standing against the bar (R15, `./standing.mjs`), the
 * calculations a case rests on with their PROV-O rendering (R18, R19, `./calculations.mjs`), the published timeline
 * (R20, `./timeline.mjs`), the people a case names with its signers' ties (R21, `./people.mjs`) and a member's subject
 * (R22, `./subject.mjs`), the basis version a finding stood on (R34, `./basisversion.mjs`), the account, bias
 * applications, review comments and approvals a case carries (R23–R26, `./account.mjs`), the two blocks read as one and the sources that still hold (R27, R28, `./blocks.mjs`), and the
 * outcomes carried into an edition (R29, `./outcomes.mjs`), and a `/10` document's ungraded and typed passages (R35-R37,
 * `./passages.mjs`) and register extracts (R38, R39, `./materials.mjs`). It reads no table,
 * holds no store and never throws.
 *
 * Split from `publication` by copy (K651, K624 (1)): the format block of `publication/checks.mjs`, and `fmSafe`,
 * `SECTIONS`, `REAUTHORABLE_SECTIONS`, `signedCitations`, the attribution renderers and `publishedGraphEdges` of
 * `publication/index.mjs`, with their comments. `publication`'s job deleted its copies and re-exports this module, so
 * its importers import what they imported before the split; a later importer imports this module directly. */

import { parseFrontmatter } from "../record-grammar/index.mjs";
import { caseDocumentRequiresV4Disclosures } from "./formats.mjs";
import { fmSafe } from "./blocks.mjs";
import { WHAT_CHANGED_HEAD } from "./edition.mjs";
import { wordsOfFormat } from "./words.mjs";
import { SENTENCES } from "./sentences.mjs";

export { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5, CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3,
         CASE_DOCUMENT_FORMAT_V2, CASE_DOCUMENT_FORMAT_LEGACY, CASE_DOCUMENT_FORMATS_ACCEPTED,
         caseDocumentStatesMemberBlocks, caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures,
         caseDocumentRequiresTensionSection, caseDocumentRequiresMaterials, caseDocumentFormatFor,
         caseDocumentStatesUngradedAndTyped } from "./formats.mjs";
export { UNGRADED_PASSAGE_FIELDS, TYPED_PASSAGE_FIELDS, TYPED_CHECKER_FIELDS, UNGRADED_PREDATE_SENTENCE,
         UNGRADED_UNREADABLE_SENTENCE, TYPED_PREDATE_SENTENCE, TYPED_UNREADABLE_SENTENCE, ungradedPassagesLines,
         ungradedPassagesFrom, ungradedPassagesOf, typedPassagesLines, typedPassagesOf } from "./passages.mjs";
export { caseDocumentBlocks, captureBlockLines, sourceBlockLines, sourceStatement, unnamedSourceStatement,
         withheldSourceStatement, sourceRowWithheld, WITHHELD_SOURCE_LABEL, WITHHELD_SOURCE_REASON,
         sourceRowsStanding, CAPTURE_FIELDS, ACKNOWLEDGEMENT_FIELDS, SOURCE_FIELDS, SOURCE_BASES,
         BLOCKS_PREDATE_SENTENCE, BLOCK_UNREADABLE_SENTENCE, NOT_RECORDED_STATED, fmSafe } from "./blocks.mjs";
export { caseTensionsOf, disclosedCandidates, TENSION_STATE_WORDS, TENSION_HIGHLIGHT_SENTENCE, TENSION_DEPTH_SENTENCE,
         TENSIONS_PREDATE_SENTENCE, TENSIONS_UNREADABLE_SENTENCE } from "./tensions.mjs";
export { WHAT_CHANGED_HEAD, WHAT_CHANGED_ORIGINS, whatChangedText, whatChangedBlockLines, whatChangedSectionLines,
         whatChangedOf, LENS_HEAD, LENS_STATEMENT_FIELDS, LENS_CITATION_FIELDS, LENS_KIND_WORDS, LENS_CLOSING_SENTENCES,
         lensClosingSentencesOf, LENS_NONE_SENTENCE, LENS_UNDETERMINED_SENTENCE, lensStatementKey, lensBlockLines, lensSectionLines, lensOf,
         editionStatementsOf } from "./edition.mjs";
export { WORDS, caseWordsOf } from "./words.mjs";
export { SENTENCES } from "./sentences.mjs";
export { WORKING_ON_KEY, NOTICE_REFERENCE_PATTERN, isNoticeReference, workingOnLines, workingOnOf } from "./reference.mjs";
export { METHOD_FIELDS, methodBlockLines, methodOf, MATERIAL_FIELDS, MATERIAL_TITLE_FIELD, MATERIAL_OBSCURED_FIELDS, MATERIAL_OBSCURED_MARKED_FIELD, MATERIAL_OBSCURED_KIND_FIELD,
         MATERIAL_OBSCURED_KINDS, MATERIAL_ATTESTATION_FIELDS, MATERIAL_ATTESTATION_SHA_FIELD, MATERIAL_KINDS,
         MATERIAL_RESTS_UNDER, ATTESTATION_BY_KINDS, ATTESTATION_LEVELS, ANONYMOUS_ATTESTATION_LEVELS,
         GROUP_ATTESTATION_SIGNATURE, MATERIAL_EXTRACT_FIELDS, MATERIAL_EXTRACT_USE_LIMIT_FIELDS, EXTRACT_LABEL_KEY,
         EXTRACT_INVALID, extractTextOf, registerExtractRow, materialsLines, materialAttestationLines, materialBlockLines, materialsOf, ACCEPTED_WORK_FIELDS, ACCEPTED_WORK_FLAG_FIELDS,
         PAIR_AXES, pairLine, pairOf, acceptedWorkBlockLines, acceptedWorkOf } from "./materials.mjs";
export { CASE_FILE_FORMAT, CASE_FILE_FORMAT_V4, CASE_FILE_FORMAT_V2, CASE_FILE_FORMAT_V1, CASE_FILE_FORMATS_ACCEPTED, CASE_FILE_MANIFEST_PATH, CASE_FILE_PROV_PATH,
         CASE_FILE_KINDS, CASE_FILE_V2_KINDS, CASE_FILE_V3_KINDS, CASE_FILE_ORIGINAL_KINDS, CASE_FILE_SINGLE_KINDS, CASE_FILE_OPTIONAL_SINGLE_KINDS, CASE_FILE_MANIFEST_FIELDS,
         CASE_FILE_KEY_FIELDS, CASE_FILE_PART_FIELDS, CASE_FILE_FILE_FIELDS, caseFilePath, caseFileEntryOf,
         caseFileFormatFor, refsOnSeveralRows, materialFileKey, casePartDigest, caseFileManifestCheck } from "./casefile.mjs";
export { GRADING_FACT_FIELDS, GRADING_FACT_TYPED_FIELD, PASSAGE_FIELDS, gradingFactsLines, passagesLines, gradingFactsOf, passagesOf,
         extractedTextOf } from "./facts.mjs";
export { BAR_AXES, STANDING_ROLE_WORDS, standingOf } from "./standing.mjs";
export { CALCULATION_FIELDS, RECOMPUTE_STATUSES, calculationsLines, calculationsOf, PROV_NAMESPACE, provIds, provOf,
         calculationFileText } from "./calculations.mjs";
export { TIMELINE_FIELDS, TIMELINE_LANES, timelineLines, timelineOf } from "./timeline.mjs";
export { PEOPLE_FIELDS, MEMBER_TIE_FIELDS, peopleLines, memberTieLines, peopleOf, memberTiesOf } from "./people.mjs";
export { memberSubjectOf } from "./subject.mjs";
export { memberBasisVersionLines, memberBasisVersionOf } from "./basisversion.mjs";
export { ACCOUNT_FIELDS, ACCOUNT_KINDS, ACCOUNT_ORIGINS, ACCOUNT_CITE_KINDS, ACCOUNT_HEAD, accountBiasMark, accountLines,
         accountOf, accountSectionLines, BIAS_APPLICATION_FIELDS, BIAS_APPLICATION_TARGETS, BIAS_APPLICATION_EFFECTS,
         biasApplicationsLines, biasApplicationsOf, REVIEW_COMMENT_FIELDS, REVIEW_COMMENTS_LEFT_OUT_KEY, reviewCommentsLines,
         reviewCommentsOf, APPROVAL_RULE_KEY, APPROVAL_RULE_FIELDS, APPROVAL_FIELDS, approvalsLines, approvalsOf,
         approvalSubjectSha } from "./account.mjs";
export { OUTCOME_FIELDS, OUTCOME_KINDS, OUTCOMES_HEAD, OUTCOME_KIND_WORDS, outcomesLines, outcomesOf, outcomeCitesWords,
         outcomeWords, outcomesSectionLines } from "./outcomes.mjs";
export { COMPLETE_EDITION_HEADINGS, TIMELINE_HEADING, CALCULATIONS_HEADING, ACCOUNT_HEADING, REVIEW_COMMENTS_HEADING, APPROVALS_HEADING, OUTCOMES_HEADING, TIMELINE_LANE_WORDS, RECOMPUTE_WORDS, TWO_STRENGTHS_SENTENCE, GRADE_MEANINGS, PRODUCT_NAMES, editionProductOf,
         madeWithLine, CHECKER_READS, OBSCURED_WORDS, PASSAGE_WORDS_V10, completeEditionOf } from "./complete.mjs";


/** MK-7 — THE ATTRIBUTION LEVELS (MEMBER-KNOWLEDGE-DESIGN.md §4, §4.6), MOST PROTECTIVE FIRST (R2).
 *  `group` is the floor every level shares (§4.3): every published case is the group's. `name`
 *  publishes the member's HANDLE — §4.6's reading of "to the member by name", which is a PROVISIONAL
 *  carried to Bob (the record holds no legal name and must not start to). The member id is never
 *  published at any level. */
export const ATTRIBUTION_LEVELS = Object.freeze(["group", "project", "cover", "name"]);

/* MK-7 — THE TWO RENDERINGS OF THE STATEMENTS, ONE SPELLING EACH (R2): written when op=publish authors a document
   reaching an observation, and spliced when the author's act lands on one authored and unsigned. The frontmatter
   run starts at `observation_attributions:` and ends at the next top-level key; the prose starts at
   `ATTRIBUTION_PROSE_HEAD` and ends before the next `## ` heading. A document reaching NO observation
   carries neither, so every other case document's bytes are exactly what they were. */
export const ATTRIBUTION_PROSE_HEAD = "## Whose Words These Are";
/* The rows a renderer writes: each object of an array; anything else writes none, so neither renderer throws. */
const rowsOf = (rows) => (Array.isArray(rows) ? rows.filter((r) => r && typeof r === "object") : []);
export function attributionFrontmatterLines(rows) {
  return ["observation_attributions:",
    ...rowsOf(rows).flatMap((r) => [
      /* K1315 (publication R60): an off-the-record capture's attesting member is keyed by the capture's SHA-256. */
      r.observation == null && r.capture != null ? `  - capture: ${r.capture}` : `  - observation: ${r.observation}`,
      `    level: ${r.level ?? "null"}`,
      `    shown: ${r.shown == null ? "null" : `"${fmSafe(r.shown)}"`}`,
      `    chosen_at_edition: ${r.chosen_at_edition ?? "null"}`])];
}
/* R33: the section is spelled in the words of the version `format` names (the format in force when none is given), so a
   prepared `/7` document re-authored later keeps its `/7` words and a `/8` one says "team". */
export function attributionBodyLines(given, format) {
  const rows = rowsOf(given);
  const words = wordsOfFormat(format);
  const said = words.attributionSaid;
  return [ATTRIBUTION_PROSE_HEAD, "",
    `This case rests, directly or through another finding, on ${rows.length} firsthand observation`
    + `${rows.length === 1 ? "" : "s"} recorded by ${words.attributionMember}. What it shows of who SAID each one is `
    + "that member's own choice, made for this edition and never filled in for them (MEMBER-KNOWLEDGE-DESIGN.md "
    + "§4). An observation names no person in its own bytes; the words below are the whole of the attribution.",
    "",
    ...rows.map((r) => ({ ...r, observation: r.observation == null && r.capture != null ? r.capture : r.observation }))
      .map((r) => !r.level
      ? SENTENCES.noLevel(r.observation, r.why)
      : `- **${r.observation}** — attributed to ${said[r.level]}${r.shown == null ? " (this record names no "
        + "producing group, so none is printed)" : `: ${r.shown}`} — level \`${r.level}\`, chosen at edition `
        + `${r.chosen_at_edition}.`),
    ""];
}

/* R3 (publication R21's locators): the sections of a case document a module other than the one that authored it may
   re-author, each a front matter run and a prose run. Each locator takes the document's lines and answers the run's
   half-open line range `{f0, f1, b0, b1}`, or null when the document carries no such run (it was authored before the
   section existed, or `lines` is not an array of lines); `reauthorSection` then leaves the document as it is. */
const located = (locate) => (lines) => {
  try { return Array.isArray(lines) ? locate(lines.map((l) => String(l))) : null; } catch { return null; }
};
export const SECTIONS = Object.freeze({
  /* MK-7: `observation_attributions:` to the next top-level key; `## Whose Words These Are` to the next `## `. */
  attribution: located((lines) => {
    const f0 = lines.indexOf("observation_attributions:");
    let f1 = f0 + 1;
    while (f0 >= 0 && f1 < lines.length && lines[f1].startsWith("  ")) f1++;
    const b0 = lines.indexOf(ATTRIBUTION_PROSE_HEAD);
    let b1 = b0 + 1;
    while (b0 >= 0 && b1 < lines.length && !lines[b1].startsWith("## ")) b1++;
    return f0 < 0 || b0 < 0 || b1 >= lines.length ? null : { f0, f1, b0, b1 };
  }),
  /* D-150 / REC-212: the statement's acknowledgement list — from `  statement_sha: ` to `completeness_excluded:`,
     and from `**Who else read this statement.**` to the blank line before `## What Was Searched`. R8's runs are never
     this one's: its `what_changed:` block has a `  statement_sha: ` line of its own, and its section holds a member's
     words, which may begin a line `**Who else read this statement.**`; lines inside either are skipped, so a document
     without them locates exactly as before. */
  acknowledgements: located((lines) => {
    const runOf = (head, inside) => {
      const a = lines.indexOf(head);
      let b = a + 1;
      while (a >= 0 && b < lines.length && inside(lines[b])) b++;
      return [a, b];
    };
    const runs = [runOf("what_changed:", (l) => l.startsWith("  ")),
                  runOf(WHAT_CHANGED_HEAD, (l) => !l.startsWith("## "))];
    const ours = (i) => runs.every(([a, b]) => a < 0 || i < a || i >= b);
    const f0 = lines.findIndex((l, i) => l.startsWith("  statement_sha: ") && ours(i));
    const f1 = lines.indexOf("completeness_excluded:");
    const b0 = lines.findIndex((l, i) => l.startsWith(SENTENCES.whoElse) && ours(i));
    const b1 = lines.indexOf("## What Was Searched");
    return f0 < 0 || f1 < f0 || b0 < 0 || b1 < b0 + 1 ? null : { f0, f1, b0, b1: b1 - 1 };
  }),
  /* K1317 (case-authoring R48, publication R60): the material attestations, re-authored when an attesting member
     chooses a level — from `material_attestations:` to the next top-level key, with no prose run. Its prose run is
     answered empty at the document's end (`b0 === b1 === lines.length`), so a splice with no body lines leaves every
     other line as it was. */
  attestations: located((lines) => {
    const f0 = lines.indexOf("material_attestations:") >= 0 ? lines.indexOf("material_attestations:")
      : lines.indexOf("material_attestations: []");
    let f1 = f0 + 1;
    while (f0 >= 0 && f1 < lines.length && lines[f1].startsWith("  ")) f1++;
    return f0 < 0 ? null : { f0, f1, b0: lines.length, b1: lines.length };
  }),
});
export const REAUTHORABLE_SECTIONS = Object.freeze(Object.keys(SECTIONS));

/* R4, R6: the citations a signed case document carries. A `/4`, `/5` or `/6` document carrying `case_citations` answers them
   as signed; every other document states that its citation versions are undetermined, never filled. */
export const CITATIONS_UNDETERMINED_SENTENCE = "version undetermined (signed before capture pins): this document was "
  + "signed before a case's citation edges were pinned to the capture they were made against, and it carries neither";
export function signedCitations(text) {
  try {
    const fm = parseFrontmatter(String(text || "")).data || {};
    if (caseDocumentRequiresV4Disclosures(fm) && Array.isArray(fm.case_citations))
      return { state: "signed", rows: fm.case_citations };
  } catch { /* an unreadable document signed nothing this module can read: undetermined, below */ }
  return { state: "undetermined", rows: null, stated: CITATIONS_UNDETERMINED_SENTENCE };
}

/* ===== D-431 — WHAT A FINDING "RESTS ON", NAMED ONCE, AND READ BY BOTH THE SERVING AND THE REFUSAL (R5) =====
   BIO_Publication_v0_1.md §3 rule 2, the second note (BOB #16, 2026-09-19): *"Rests on is the edge set the
   published graph already uses to decide it may serve an edge, named by the builder from the code and proved
   identical at both sites."* NAMED FROM THE CODE: the published graph is written by `publishEdges` from the
   edges `op=ratify` reads out of the RATIFIED BYTES, and it SERVES an edge only when the edge is of the
   `serve` class and its target is itself published. The `serve` class is every `references[]` entry (its
   `rel` as the kind, `cites` when none is authored); the two division disclosures are NAME-ONLY by kind and
   are never served. So a finding RESTS ON exactly the targets of its `serve`-class edges.
   This one function IS that edge set: `ratification` builds the graph it hands `publishEdges` from it, and
   `publication`'s `ratifiedFindingsRestingOn` asks it of each pinned finding's bytes — one function, two readers,
   so the refusal and the serving cannot come to read different quantities. A second spelling of this list
   anywhere is the defect it exists to prevent. */
export function publishedGraphEdges(fm) {
  try {
    const d = fm && typeof fm === "object" ? fm : {};
    const refs = Array.isArray(d.references) ? d.references : [];
    return [
      ...refs.filter((r) => r && typeof r.target === "string")
        .map((r) => ({ to: r.target, kind: typeof r.rel === "string" && r.rel ? r.rel : "cites",
                       disclosure: "serve" })),
      ...(typeof d.division_parent === "string" && d.division_parent !== "null"
        ? [{ to: d.division_parent, kind: "division_parent", disclosure: "name" }] : []),
      ...(Array.isArray(d.division_siblings) ? d.division_siblings : [])
        .filter((s) => typeof s === "string" && s)
        .map((s) => ({ to: s, kind: "division_sibling", disclosure: "name" })),
    ];
  } catch {
    return [];
  }
}
