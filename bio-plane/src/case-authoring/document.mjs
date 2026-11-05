/* The case document's text (requirements: `build/requirements/case-authoring.md`, R14, R16, R17, R22, R26, R60). Pure:
 * nothing here touches a table, so a suite can render a document without a store and the gate can be run against bytes
 * this file produced. Moved from `store.mjs` (`#caseDocumentText`, `CASE_CITATION_WORDS`; `#fmSafe` is case-grammar's
 * since N424); the comments moved with them, shortened where they only restated the code. The acknowledgement list's
 * two renderings, `statementSha` and `withheldWriterStated` moved on to `case-inputs` (its R2; T47, N908).
 *
 * THE DOCUMENT IS A DOCUMENT RATHER THAN A SERIALISATION (CASE-5b / DEC-72). The frontmatter is what the gate and the
 * ratify committer read; the BODY is what a person reads, under canonical headings, because what is signed must be a
 * thing a member actually reviewed, and a member cannot review a block of key-value pairs they have to decode. Every
 * authored sentence appears in the body in the words it was authored in.
 *
 * THE GRAMMAR IS THE RESTRICTED FRONTMATTER GRAMMAR: scalars, a map of scalars, or an array of flat objects, never a
 * map holding an array. Hence `completeness` beside `completeness_excluded`, `searched` beside `searched_levels`,
 * `bias_manifest` beside `bias_manifest_bundles`. */

import { fmSafe, whatChangedBlockLines, whatChangedSectionLines, lensBlockLines,
         lensSectionLines, caseDocumentFormatFor, workingOnLines, methodBlockLines, materialBlockLines, acceptedWorkBlockLines,
         gradingFactsLines, passagesLines, memberBasisVersionLines, caseDocumentStatesUngradedAndTyped,
         typedPassagesLines } from "../case-grammar/index.mjs";
/* N529 (K1333): the disclosure renderers and their fixed sentences are `case-disclosures`' (its R1–R4, R7, R13, R14),
   moved there and imported here, never copied, so the signed document is byte-identical before and after the split. */
import { FLAG_SENTENCE, tensionFrontmatterLines, tensionBodyLines, tensionSentence, captureBodyLines, carriesBodyLines,
         acceptedBodyLines, ungradedLines, ungradedBodyLines } from "../case-disclosures/index.mjs";
import { attributionFrontmatterLines, attributionBodyLines, captureBlockLines,
         sourceBlockLines } from "../publication/index.mjs";
import { caseConclusionRowLines } from "../ratification/index.mjs";
/* R14 (T47; N908; K1333): the acknowledgement list's two renderings are `case-inputs`' (its R2), moved there and imported
   here, never copied, so the signed document is byte-identical before and after the split. */
import { ackFrontmatterLines, ackBodyLines } from "../case-inputs/document.mjs";
/* R69 (N839, K1333, K2608): the review comments' body section is `case-account`'s (its R7), moved there and imported
   here, never copied, so the signed document is byte-identical before and after the split. */
import { reviewCommentBodyLines } from "../case-account/document.mjs";
import { barAxisWords } from "../strength/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** Frontmatter-safe: the restricted grammar has no escapes, so a quote, a backslash or a line break in a DERIVED
 *  string (a strength detail, a bar's explanation) is sanitised; an AUTHORED field is refused by name at `op=publish`
 *  instead (R3's `BAD_COMPLETENESS`), which is the difference that matters. Idempotent. It is case-grammar's one
 *  spelling (N424), read rather than copied, and re-exported for this module's importers. */
export { fmSafe };

/** R16: the words the document's prose gives each citation `version` (REC-219 / D-579(a)). */
export const CASE_CITATION_WORDS = Object.freeze({
  pinned: word("case-authoring.pinned"),
  only_capture: word("case-authoring.only_capture"),
  undetermined: word("case-authoring.undetermined.version_undetermined_pin"),
  no_capture: word("case-authoring.no_capture"),
  no_bytes: localize("case-authoring.document.a_question_which_has_no_bytes", "a question, which has no bytes (DEC-21)"),
});

/** R32 (DEC-85): what the ceremony shows before the act for a highlighted candidate. The document's own words for a
 *  tension, a self-attested capture, a source, a material and another group's work are `case-disclosures`' (its R1–R4,
 *  R7, R13, R14), imported above and never copied (N529, K1333). */
export const CEREMONY_HIGHLIGHT_SENTENCE = word("case-authoring.ceremony_highlight_sentence");

/** R14: THE CASE DOCUMENT, in `case-grammar`'s `CASE_DOCUMENT_FORMAT` through `publication`'s re-export (`bio-case-document/10`
 *  from T53, `case-grammar` R35; `/8` from T31, identical in fields to `/6`; DEC-124, K1365 (1)). Everything it asserts arrived as an argument (R22): the authored
 *  sentences as the publisher typed them, and every fact the caller read from the record at the act (`searched`,
 *  `conclusions`, `frozen`, `manifest`, `acks`, `citations`, `attributions`, the writer). Nothing here is composed,
 *  summarised or inferred, and no case-level strength has anywhere to be written (R24).
 *  `subjects` maps each member to the `subject_entity` its pinned bytes state, or null (R60). `basisVersions` maps each
 *  member to the `{name, identity}` its project stood on, or null (R87; case-grammar R34).
 *
 *  `statementBy` null is UNDETERMINED and is STATED, never filled in from `author` (R14, `case-inputs` R3; R26). `searched` is required:
 *  a document that cannot say what was searched fails the ceremony instead (R11). `frozen` maps each member to
 *  `{edition, pair, axes, grounds}` (rule 12 (b): stated once here instead of in the member). `manifest` absent is
 *  written as NOT IN FORCE with that sentence, never as a blank. `attributions` empty writes neither attribution run,
 *  so a case reaching no observation is authored byte for byte as before. `tensions` are the entries `case-disclosures` R1 judged (R55),
 *  each `{candidate, finding, state, kind, unseen_other_side, a, b | side, explanation, words, acknowledged_by,
 *  acknowledged_at}` with its sides as `tensionSide` states them. `captures` are `case-disclosures` R2's rows (one per member
 *  and capture, with its R3's acknowledgement and, on a capture's first row, its signed accounts), `sources` its R4's
 *  `{capture, stated, basis}`. `workingOn` is R41's reference as `noticeReferenceOf` answered it, null for none. */
export function caseDocumentText({ caseId, edition, project, workingOn = null, scope, bias, bar, roster, roles, pins,
                                   statement, position, justification, excluded, author, at,
                                   statementBy = null, statementByStated = "",
                                   searched, conclusions = [], frozen, manifest = null, subjects = null, basisVersions = null,
                                   acks = { statementSha: null, truncated: false, rows: [] },
                                   citations = [], attributions = [], tensions = [],
                                   tensionsUnread = [], captures = [], sources = [], whatChanged = null,
                                   lens: lensRead = null, method = null, materials = null, group = null,
                                   accepted = null, grading = null, passages = null, ungraded = null, typed = null,
                                   calculations = [], calculationsBlock = [], timeline = [], timelineLeftOut = 0,
                                   timelineCut = [], timelineUnread = null, timelineWithheld = 0,
                                   timelineBlock = [], peopleBlock = [], memberTiesBlock = [],
                                   accountBlock = [], accountSection = [], reviewCommentsBlock = [], reviewComments = null,
                                   outcomesBlock = [], outcomesSection = [],
                                   approvalsBlock = [] }) {
  const roleOf = new Map((roles || []).map((r) => [r.target, r.role]));
  const lens = manifest && manifest.in_force === true ? manifest
    : { in_force: manifest && manifest.in_force === null ? null : false,
        scope: "project", scope_id: project, statements_sha: null, bundles: [], lock_violations: 0,
        stated: manifest && manifest.in_force === null ? manifest.stated : word("bias.manifest_force"),
        pins_proposed: (manifest && manifest.pins_proposed) || [] };
  /* REC-219: the adoptions pinning a proposed revision at signing, and the sentence saying what the list is. It says
     nothing about when or whether the revision takes effect (BOB #34). An empty list is a statement, and says so. */
  const pending = Array.isArray(lens.pins_proposed) ? lens.pins_proposed : [];
  const pendingStated = pending.length === 0
    ? word("case-authoring.document.adoption_scope_pinned")
    : localize("case-authoring.document.each_row_is_an_adoption", "each row is an adoption in this scope whose pinned revision the team had proposed and not accepted when this case was signed; that revision was not in force at signing");
  const frozenOf = (m) => (frozen && frozen.get(m)) || null;
  const concOf = new Map((conclusions || []).map((c) => [c.target, c]));
  /* R14 (G47; K4672): the format the document declares, through case-grammar's helper (since its R35, `/10` always; it
     answered `/9` for an attestation `sha`, else `/8`, before). */
  const format = caseDocumentFormatFor((materials && materials.attestations) || []);
  const fm = [
    "---",
    `format: ${format}`,
    `case_id: ${caseId}`,
    `case_edition: ${edition}`,
    `case_project: ${project}`,
    /* R41 (DEC-111; case-grammar R10): the project reference, through case-grammar's one writer (K1144). */
    ...workingOnLines(workingOn),
    `case_scope: "${fmSafe(scope)}"`,
    `bias_acknowledgement: "${fmSafe(bias)}"`,
    /* D-84 — THE BIAS MANIFEST, BESIDE THE ACKNOWLEDGEMENT AND NOT INSIDE IT (DEC-46). `in_force: false` carries "no
       manifest was in force" and an empty pair list: different facts from a lens with nothing in it. */
    "bias_manifest:",
    `  in_force: ${lens.in_force}`,
    `  scope: ${lens.scope}`,
    `  scope_id: ${lens.scope_id}`,
    `  statements_sha: ${lens.statements_sha ?? "null"}`,
    `  lock_violations: ${lens.lock_violations}`,
    `  stated: "${fmSafe(lens.stated)}"`,
    /* REC-219 / §3 rule 18: the count beside the list below, and its sentence (C-41.14). */
    `  pins_proposed: ${pending.length}`,
    `  pins_proposed_stated: "${fmSafe(pendingStated)}"`,
    "bias_manifest_bundles:",
    ...lens.bundles.flatMap((x) => [
      `  - bundle_id: ${x.bundle_id}`,
      `    revision: ${x.revision}`,
      `    scope: ${x.scope}`]),
    "bias_manifest_pins_proposed:",
    ...pending.flatMap((x) => [
      `  - bundle_id: ${x.bundle_id}`,
      `    revision: ${x.revision}`,
      `    scope: ${x.scope}`,
      `    pinned_state: ${x.pinned_state ?? "null"}`]),
    /* R40 (DEC-103): THE LENS, PRINTED WHOLE, in case-grammar R9's blocks: each statement in force and each citation
       that is public material, the rest only counted. Always present, empty with no manifest in force. */
    ...lensBlockLines(lensRead && lensRead.in_force === true ? lensRead.statements : []),
    /* R38 (DEC-101): an edition above 1 says what changed, in case-grammar R8's block; a first edition carries none. */
    ...(whatChanged ? whatChangedBlockLines({ statement: whatChanged.text, began_as: whatChanged.began_as,
                                              draft: whatChanged.draft ?? null,
                                              adopted_as_drafted: whatChanged.adopted_as_drafted ?? null }) : []),
    /* R16 (REC-219 / D-579(a) / §3 rule 18, C-41.15): THE CASE'S CITATION EDGES, EACH WITH THE VERSION IT RESTS ON.
       `capture` is a sha exactly where `pinned` or `only_capture` says one. */
    "case_citations:",
    ...citations.flatMap((x) => [
      `  - target: ${x.target}`,
      `    version: ${x.version}`,
      `    capture: ${x.capture ?? "null"}`,
      ...("bundle_sha" in x ? [`    bundle_sha: ${x.bundle_sha ?? "null"}`] : [])]),
    `case_findings: [${roster.join(", ")}]`,
    "case_roles:",
    ...roster.flatMap((m) => [
      `  - target: ${m}`,
      `    role: ${roleOf.get(m) ?? "null"}`,
      `    version_sha: ${pins.get(m) ?? "null"}`,
      /* D-442: THE MEMBER'S OWN PUBLISHED EDITION of the pinned bytes, beside the pin it numbers (rule 12 (b)). */
      `    edition: ${frozenOf(m) ? frozenOf(m).edition : "null"}`,
      /* R60 (N717; case-grammar R22): the subject the member's pinned bytes state, so `case-checker` R21 reads only the
         criteria rows of that body; null when they state none, never another member's or the inquiry's current one. */
      `    subject_entity: ${(subjects && subjects.get(m)) || "null"}`,
      /* R87 (case-grammar R34): the basis version the member's project stood on, both null where it named none. */
      ...memberBasisVersionLines(basisVersions ? basisVersions.get(m) : null)]),
    /* REC-135 / §7.1 item 4 — THE CONCLUSION EACH MEMBER ENTERED THIS CASE ON, AND WHOSE IT WAS. A `no_project` row is
       a DISCLOSURE, not a defect; `claim_state: undetermined` is a first-class answer, never an empty claim. The rows
       are `ratification`'s one writer of them, so what an edition records and what `editionsRecordingConclusion`
       compares it with are written by one function. */
    "case_conclusions:",
    ...roster.flatMap((m) => caseConclusionRowLines(m, concOf.get(m) || null)),
    /* R55, `case-disclosures` R1 (N345): THE TENSIONS DISCLOSED and each member's tension sentences; always present, zero included. */
    ...tensionFrontmatterLines(tensions, tensionsUnread),
    /* R55, `case-disclosures` R2–R4 (N364): each document's grade and co-attestation, the signed accounts, and each source's statements;
       always present, empty included. */
    ...captureBlockLines(captures),
    ...sourceBlockLines(sources),
    /* R55, `case-disclosures` R5, R7 (DEC-112 (3)(4)): the method signed under, and every material a chain reaches with
       its attestations; its R13, R14: another group's work and its disclosed flags (none when no chain reaches it). */
    ...(method ? methodBlockLines(method) : []),
    ...(materials ? materialBlockLines({ materials: materials.rows, attestations: materials.attestations }) : []),
    ...acceptedWorkBlockLines(accepted || {}),
    /* R55, `case-disclosures` R15 (K1315): each reached finding's grading facts and relied-on passages, signed with the document. */
    ...(grading ? gradingFactsLines(grading) : []),
    ...(passages ? passagesLines(passages) : []),
    /* F2 (`case-grammar` R35–R37; `case-disclosures` R35, R36): a `/10` document states the relied-on passages published
       without a grade (`case-disclosures`' rows, written by its renderer) and the typed ones with who typed and checked
       them, so `case-catalogue` C-41.18 and C-41.19 read what the gate compares; an earlier format states neither. */
    ...(caseDocumentStatesUngradedAndTyped({ format }) ? [...ungradedLines(ungraded || []), ...typedPassagesLines(typed || [])] : []),
    /* R56 (C:A-15): every calculation and workbook a chain reaches, its state at this act and the owner's words where a
       disclosure was needed; R57 (C11): the timeline, two lanes never mixed; R55 (case-disclosures R28): the people the
       case names with each one's basis, and each signer's declared ties. Each block is its owner's one spelling, rendered
       by the caller. */
    ...calculationsBlock,
    ...timelineBlock,
    ...peopleBlock,
    ...memberTiesBlock,
    /* R63 (D56): case-grammar R23's `account:` block, every sentence of the account and of the four statements with what
       it cites; R69 (D61): its R25's review comments chosen and the count left out; R68 (D60): its R26's approvals, last,
       the one block the approval digest leaves out. Each its owner's one spelling, rendered by the caller. */
    ...accountBlock,
    ...reviewCommentsBlock,
    /* R71 (T45): case-grammar R29's `outcomes:` block, the outcomes carried into this edition; none, no line. */
    ...outcomesBlock,
    ...approvalsBlock,
    "completeness:",
    `  statement: "${fmSafe(statement)}"`,
    `  subject_position: ${position}`,
    `  subject_justification: "${fmSafe(justification)}"`,
    `  author: ${author}`,
    /* R14 (`case-inputs` R3; REC-212 / §3 rule 13) — TWO ACTS, TWO NAMES, IN THE SIGNED BLOCK: `author` prepared and published the case;
       this is who wrote the sentence `statement` prints. It sits ABOVE `statement_sha` because the acknowledgement
       splice re-writes the run that STARTS there. */
    `  statement_by: ${statementBy ?? "null"}`,
    `  at: "${at}"`,
    /* REC-217 / R9: the draft the publisher named, who named it and when, above `statement_sha` for the same reason. */
    ...(acks.link ? [`  draft: ${acks.link.draft}`, `  draft_named_by: ${acks.link.by}`,
                     `  draft_named_at: "${acks.link.at}"`] : []),
    /* D-150 / §3 rule 11 (R14, `case-inputs` R2) — THE STATEMENT'S SECOND READERS, IN THE SIGNED BLOCK. ZERO is a statement. */
    ...ackFrontmatterLines(acks),
    "completeness_excluded:",
    ...(excluded || []).flatMap((r) => [
      ...(r.target ? [`  - target: ${r.target}`, `    description: "${fmSafe(r.description || "")}"`]
                   : [`  - description: "${fmSafe(r.description || "")}"`]),
      `    reason: "${fmSafe(r.reason || "")}"`]),
    /* R17 (REC-96 / D-196) — THE `searched` SECTION, IN THE SIGNED BYTES, as two top-level keys (the grammar). */
    "searched:",
    `  computed_at: "${fmSafe(searched.summary.computed_at)}"`,
    `  subject_source: ${searched.summary.subject_source}`,
    `  subjects: ${searched.summary.subjects}`,
    `  looked: ${searched.summary.looked}`,
    `  unidentified: ${searched.summary.unidentified}`,
    `  levels_reported: ${searched.summary.levels_reported}`,
    "searched_levels:",
    ...searched.levels.flatMap((l) => [
      `  - level: ${l.level}`,
      `    subject_kind: ${l.subject_kind}`,
      `    outcome: ${l.outcome}`,
      `    subjects: ${l.subjects}`,
      `    looked: ${l.looked}`,
      `    never_looked: ${l.never_looked}`,
      `    undetermined: ${l.undetermined}`,
      `    unidentified: ${l.unidentified}`,
      `    evidence_one_sided: ${l.evidence_one_sided}`,
      `    detail: "${fmSafe(l.detail)}"`]),
    /* D-442 / rule 12 (b) — THE FROZEN STRENGTH PAIR, PER MEMBER AND PER AXIS, STATED ONCE HERE (R24: never composed;
       there is no case-level row). */
    "case_strength:",
    ...roster.flatMap((m) => {
      const z = frozenOf(m);
      return !z ? [] : z.axes.flatMap((axis) => {
        const a = z.pair[axis];
        return [`  - target: ${m}`,
                `    axis: ${axis}`,
                `    state: ${a.state}`,
                `    grade: ${a.grade ?? "null"}`,
                `    weakest: ${a.weakest ? a.weakest.target_id : "null"}`,
                `    load_bearing: ${a.load_bearing}`,
                `    population: ${a.population}`,
                `    detail: "${fmSafe(a.detail)}"`];
      });
    }),
    /* REC-42 / DEC-32 clause (e): the frozen grounds, per member. The field is always written. */
    "case_strength_grounds:",
    ...roster.flatMap((m) => {
      const z = frozenOf(m);
      return !z ? [] : z.grounds.flatMap(([axis, g]) => [
        `  - target: ${m}`,
        `    axis: ${axis}`,
        `    ground: ${g.ground === null ? "null" : `"${fmSafe(String(g.ground))}"`}`,
        `    state: ${g.state}`,
        `    grade: ${g.grade ?? "null"}`,
        `    weakest: ${g.weakest ? g.weakest.target_id : "null"}`,
        `    load_bearing: ${g.load_bearing}`,
        `    population: ${g.population}`]);
    }),
    /* MK-7 / §4.3 — each reached observation's level, as this edition's statement (`publication`'s one spelling). */
    ...(attributions.length ? attributionFrontmatterLines(attributions) : []),
    "required_strength:",
    `  declared: ${bar.declared}`,
    `  source: ${bar.source}`,
    `  project: ${project}`,
    `  capture: ${bar.capture ?? "null"}`,
    `  connection: ${bar.connection ?? "null"}`,
    `  detail: "${fmSafe(bar.detail)}"`,
    "---",
    "",
  ];
  const body = [
    `# Case ${caseId} — edition ${edition}`,
    "",
    /* R38 (DEC-101): what changed in this edition, and why, at the top of the edition, in case-grammar R8's section. */
    ...(whatChanged ? whatChangedSectionLines(whatChanged.text) : []),
    "## Scope",
    "",
    scope,
    "",
    "## Findings In This Case",
    "",
    ...roster.flatMap((m, i) => [
      word("case-authoring.body.frozen_version", { i: String(i + 1), m: String(m), supporting: String(roleOf.get(m) === "load_bearing" ? "LOAD-BEARING" : "supporting"), unpinned: String(pins.get(m) ?? "(unpinned)") }),
      /* `case-disclosures` R1: its tension sentences, in its own block; its R14: one sentence per open flag disclosed on work it rests on. */
      ...tensions.filter((t) => t.finding === m).map((t) => `   - ${tensionSentence(t)}`),
      ...((accepted && accepted.flags) || []).filter((f) => ((accepted && accepted.rows) || [])
        .some((r) => r.member === m && r.ref === f.ref && r.edition === f.edition))
        .map((f) => `   - ${FLAG_SENTENCE}${f.issue} (flag ${f.flag}).`)]),
    "",
    /* DEC-72 clause 4, in prose: a reader is told, in the document that asserts it, which half claims what. */
    word("case-authoring.body.load_bearing_finding"),
    word("case-authoring.body.supporting_finding_travels"),
    "",
    "## The Conclusions This Case Records",
    "",
    localize("case-authoring.document.a_conclusion_belongs_to_a", "A conclusion belongs to a PROJECT'S RELATIONSHIP with a question, never to the question alone (INVESTIGATIVE-SESSION.md §7.1): an inquiry can be shared, and one team concluding it does not move another team's stance. Each member below is named with the relationship whose conclusion this case rests on, and with the claim that relationship adopted, frozen as it stood at publication."),
    "",
    ...roster.map((m) => {
      const c = concOf.get(m) || null;
      const whose = !c ? localize("case-authoring.document.no_conclusion_was_recorded_for", "NO CONCLUSION WAS RECORDED FOR THIS MEMBER")
        : c.relationship === "project"
        ? word("case-authoring.body.concluded_reading", { project: String(c.project), by: String(c.by ? ` (${c.by})` : ""), at: String(c.at ? ` on ${c.at}` : ""), unnamed: String(c.version ?? "(unnamed)") })
        : localize("case-authoring.document.concluded_in_the_questions_own_bytes", "concluded in the question's own bytes, naming no project — read as the NO-PROJECT relationship's conclusion, which is not this project's (§7.1 item 5)");
      const claim = !c || !c.claim ? "" : c.claim.state === "adopted"
        ? localize("case-authoring.document.the_claim_adopted_text", " The claim adopted: {text}", { text: String(c.claim.text) })
        : localize("case-authoring.document.the_claim_is_undetermined_v1", " The claim is UNDETERMINED: {v1}", { v1: String(c.claim.detail
            || localize("case-authoring.document.this_conclusion_names_no_reading", "this conclusion names no reading, so which claim was concluded cannot be established from the record. It is stated rather than filled in.")) });
      const fals = !c ? "" : c.falsifier
        ? localize("case-authoring.document.what_would_falsify_it_falsifier", " What would falsify it: {falsifier}", { falsifier: String(c.falsifier) })
        : c.falsifier_override
        ? localize("case-authoring.document.no_falsifier_stated_recorded_by", " NO FALSIFIER STATED — recorded by {by} at {at}.", { by: String(c.falsifier_override.by), at: String(c.falsifier_override.at) })
        : localize("case-authoring.document.no_falsifier_is_recorded_for", " NO FALSIFIER IS RECORDED for this conclusion.");
      return `- **${m}** — ${whose}.${claim}${fals}`;
    }),
    "",
    roster.every((m) => (concOf.get(m) || {}).relationship === "project")
      ? word("case-authoring.body.conclusion_case_records", { project: String(project) })
      : word("case-authoring.body.least_member_entered"),
    "",
    /* R63 (D56): the account, the publisher's own, sentence by sentence (case-grammar R23's section). */
    ...accountSection,
    /* R71 (T45): the outcomes carried into this edition, after the account and before what the findings rest on
       (case-grammar R29, R14's order); none, no section. */
    ...outcomesSection,
    ...tensionBodyLines(tensions, tensionsUnread),
    ...captureBodyLines(captures, sources),
    ...(materials ? carriesBodyLines(method, materials, group) : []),
    ...acceptedBodyLines(accepted),
    /* R89 (T53; DEC-461; `case-disclosures` R36): the one fixed sentence that this edition was published with the passages
       its `ungraded_passages:` block lists not graded by the team, from the same rows; none ungraded, no sentence. */
    ...(caseDocumentStatesUngradedAndTyped({ format }) ? ungradedBodyLines(ungraded || []) : []),
    ...(attributions.length ? attributionBodyLines(attributions, format) : []),
    ...calculationBodyLines(calculations),
    ...timelineBodyLines(timeline, timelineLeftOut, { cut: timelineCut, unread: timelineUnread, withheld: timelineWithheld }),
    "## What This Excludes",
    "",
    statement,
    "",
    ...((excluded || []).length
      ? (excluded || []).map((r) =>
          `- ${r.target ? r.target + " — " : ""}${r.description || localize("case-authoring.document.named_above", "(named above)")}: ${r.reason}`)
      : [word("case-authoring.body.material_excluded_case")]),
    "",
    word("case-authoring.body.position_putting_case", { position: String(position), justification: String(justification) }),
    "",
    /* R14 (`case-inputs` R3): WHERE the name came from as well as the name, which makes UNDETERMINED readable rather than blank. ABOVE
       the acknowledgement prose, whose head the splice starts from, so a later acknowledgement leaves it alone. */
    localize("case-authoring.document.who_wrote_this_statement", "**Who wrote this statement.** {stated}", { stated: String(statementByStated) }),
    "",
    ...ackBodyLines(acks, project),
    "",
    /* R17, in prose: a completeness claim discharged only in machine-readable fields would be D-196 closed in form
       and open in substance; the reader outside this project reads the body. */
    "## What Was Searched",
    "",
    word("case-authoring.body.section_computed_observation"),
    "",
    word("case-authoring.body.record_looked_measure"),
    "",
    ...searched.levels.map((l) =>
      word("case-authoring.body.level_subject_recorded", { level: String(l.level), subject_kind: String(l.subject_kind), outcome: String(l.outcome.replace(/_/g, " ").toUpperCase()), subjects: String(l.subjects), looked: String(l.looked), never_looked: String(l.never_looked), undetermined: String(l.undetermined), unidentified_clause: String(l.unidentified ? localize("case-authoring.document.referents_this_case_rests_on", ", {unidentified} referent(s) this case rests on that could not be resolved to a subject at all", { unidentified: String(l.unidentified) }) : ""), detail: String(l.detail) })),
    "",
    searched.summary.subjects === 0
      ? word("case-authoring.body.case_names_subject")
      : word("case-authoring.body.level_reported_undetermined"),
    "",
    /* D-442 / rule 12 (b), in prose: per finding, per axis, never composed (R24). */
    "## What Each Finding Reached, As Read For This Case",
    "",
    word("case-authoring.body.finding_strength_axis"),
    "",
    ...roster.flatMap((m) => {
      const z = frozenOf(m);
      if (!z) return [localize("case-authoring.document.m_no_frozen_strength_was", "- **{m}** — NO FROZEN STRENGTH WAS RECORDED FOR THIS MEMBER.", { m: String(m) })];
      const stateWords = (x) => (x.state === "graded"
        ? localize("case-authoring.document.grade_grade", "grade {grade}", { grade: String(x.grade) }) : String(x.state).toUpperCase());
      return [localize("case-authoring.document.m_its_edition", "- **{m}** (its edition {edition}):", { m: String(m), edition: String(z.edition) }),
        ...z.axes.map((axis) => {
          const a = z.pair[axis];
          return localize("case-authoring.document.axis_state_weakest_detail", "  - {axis}: {state}{weakest}. {detail}",
            { axis: String(axis), state: stateWords(a),
              weakest: a.weakest ? localize("case-authoring.document.no_stronger_than", ", no stronger than {target}", { target: String(a.weakest.target_id) }) : "",
              detail: String(a.detail || "") }).trimEnd();
        }),
        ...z.grounds.map(([axis, g]) => localize("case-authoring.document.axis_group_ground_state", "  - {axis}, group '{ground}': {state}",
          { axis: String(axis), ground: String(g.ground ?? "(unnamed)"), state: stateWords(g) }))];
    }),
    "",
    /* D-84 — THE MANIFEST IN PROSE, named by its pairs and its hash, as it stood at this act. */
    "## Bias Manifest",
    "",
    ...(lens.in_force
      ? [word("case-authoring.body.case_produced_under", { scope_id: String(lens.scope_id) }),
         "",
         ...lens.bundles.map((x) => localize("case-authoring.document.bundle_id_scope_at_revision", "- {bundle_id} ({scope}) at revision {revision}", { bundle_id: String(x.bundle_id), scope: String(x.scope), revision: String(x.revision) })),
         "",
         word("case-authoring.body.hash_effective_statement", { statements_sha: String(lens.statements_sha) }),
         ...(lens.lock_violations
           ? ["", word("case-authoring.body.project_override_named", { lock_violations: String(lens.lock_violations) })]
           : [])]
      : lens.in_force === null
      ? [word("case-authoring.body.manifest_undetermined_claimed", { scope_id: String(lens.scope_id), stated: String(lens.stated) })]
      : [word("case-authoring.body.manifest_force_case", { scope_id: String(lens.scope_id) })]),
    /* REC-219 / §3 rule 18: the second fact, in prose, when there is something to say. */
    ...(pending.length
      ? ["",
         word("case-authoring.body.adoption_pinned_proposed", { adoptions: String(pending.length === 1 ? localize("case-authoring.document.one_adoption", "one adoption") : localize("case-authoring.document.count_adoptions", "{count} adoptions", { count: String(pending.length) })) }),
         "",
         ...pending.map((x) => word("case-authoring.body.pinned_revision_standing", { bundle_id: String(x.bundle_id), scope: String(x.scope), revision: String(x.revision), state: String(x.pinned_state ?? localize("case-authoring.document.an_unrecorded_state", "an unrecorded state")) }))]
      : []),
    "",
    "## Citations",
    "",
    ...(citations.length
      ? [word("case-authoring.body.case_cites_version"),
         "",
         ...citations.map((x) => `- ${x.target}: ${CASE_CITATION_WORDS[x.version] ?? x.version}`
           + (x.capture ? ` ${x.capture}` : "")
           + (x.bundle_sha ? localize("case-authoring.document.head_of_the_document", " (head {sha})", { sha: String(x.bundle_sha) }) : ""))]
      : [word("case-authoring.body.case_project_cited")]),
    "",
    /* R69 (D61): the reviewers' comments the publisher chose to carry, and how many were left out (`case-account` R7). */
    ...reviewCommentBodyLines(reviewComments),
    /* R40 (DEC-103): case-grammar R9's section, which prints the bias acknowledgement first and then the lens; it
       stands where the acknowledgement's own section stood, so the acknowledgement is printed once. */
    ...lensSectionLines({ acknowledgement: bias, format,
                          statements: lensRead && lensRead.in_force === true ? lensRead.statements : [],
                          inForce: lensRead ? lensRead.in_force : false,
                          stated: lensRead ? lensRead.stated : null }),
    "## Standard Of Evidence",
    "",
    /* THE ABSENT BAR IS PRINTED AS ABSENT, IN A SENTENCE (R26): an absent bar is not a bar of zero. */
    bar.declared
      ? word("case-authoring.body.case_production_held", { project: String(project), bar: String(barAxisWords(bar)), bar3: String(`${bar.detail || ""}`.trim()) })
      : localize("case-authoring.document.this_case_is_project_production", "This case is {project}'s production. NO STANDARD OF EVIDENCE WAS DECLARED for it. An absent bar is not a bar of zero: this case claims no cleared standard, and a reader weighs each finding's own frozen strength on its own. {detail}", { project: String(project), detail: String(bar.detail || "") }).trim(),
    "",
    "## Session Log",
    "",
    localize("case-authoring.document.session_at_case_published_author", "### Session {at} | Case published | {author}", { at: String(at), author: String(author) }),
    localize("case-authoring.document.trigger_op_publish_case", "Trigger: op=publish, case {caseId} edition {edition}", { caseId: String(caseId), edition: String(edition) }),
    localize("case-authoring.document.published_by_project_this_case", "Published by: {project} (this case is that project's production, DEC-72)", { project: String(project) }),
    word("case-authoring.body.findings_case", { roster: String(roster.join(", ")) }),
    localize("case-authoring.document.load_bearing_list", "Load-bearing: {list}", { list: roster.filter((m) => roleOf.get(m) === "load_bearing").join(", ") }),
    localize("case-authoring.document.supporting_list", "Supporting: {list}", { list: roster.filter((m) => roleOf.get(m) !== "load_bearing").join(", ") || localize("case-authoring.document.none", "none") }),
    localize("case-authoring.document.excluded_count_items", "Excluded: {count} item(s).", { count: String((excluded || []).length) }),
    /* D-442 / rule 12 (b): THE PUBLISH RECEIPT IS THE CASE DOCUMENT'S HISTORY, never the finding's (R23). */
    ...roster.map((m) => word("case-authoring.body.pinned_written", { member: String(m), pin: String(pins.get(m) ?? "(unpinned)"), edition_clause: String(frozenOf(m) ? localize("case-authoring.document.its_edition", ", its edition {edition}", { edition: String(frozenOf(m).edition) }) : "") })),
    "",
  ];
  return fm.join("\n") + body.join("\n");
}

/** R56 (C:A-15; DEC-76.4): the calculations section, in words a reader reads: each calculation and workbook the case's
 *  findings rest on, what was found of it at publication, and the owner's words where one differs or rests on an unbound
 *  input. A calculation is recomputed at publication; a workbook (its row's `calc` is its capture's SHA-256) is read and
 *  never recomputed here, and its state is its own engine's latest recompute against the values the file stores:
 *  agreement between two engines, never a check of accuracy (workbooks R8). No section when the findings reach none. */
export const CALCULATION_STATE_WORDS = Object.freeze({
  agrees: word("case-grammar.agrees"),
  differs: localize("case-authoring.document.recomputed_at_publication_and_the", "recomputed at publication, and the result DIFFERS from the one stored"),
  unbound: word("case-authoring.unbound.recomputed_publication_least"),
  not_recomputed: word("workbooks.recomputed"),
});
/** R56 (workbooks R8): the same states said of a workbook, which publication reads and never recomputes. */
export const WORKBOOK_STATE_WORDS = Object.freeze({
  agrees: word("case-authoring.agrees.workbook_read_publication"),
  differs: word("case-authoring.differs.workbook_read_publication"),
  unbound: word("case-authoring.unbound.workbook_read_publication"),
  not_recomputed: word("case-authoring.not_recomputed.workbook_read_publication"),
});
const isWorkbookRow = (r) => /^[0-9a-f]{64}$/.test(String(r.calc));
export function calculationBodyLines(rows) {
  if (!rows || !rows.length) return [];
  const books = rows.some(isWorkbookRow);
  return ["## Calculations This Case Rests On", "",
    word("case-authoring.document.calculation_recomputed_case"), "",
    ...(books ? [word("case-authoring.document.workbook_read_case"), ""] : []),
    ...rows.map((r) => `- ${r.calc}: ${(isWorkbookRow(r) ? WORKBOOK_STATE_WORDS : CALCULATION_STATE_WORDS)[r.recompute]
        ?? r.recompute}${isWorkbookRow(r) && r.method_version ? ` (${r.method_version})` : ""}.`
      + (r.disclosed != null ? localize("case-authoring.document.disclosed_by_the_team", " Disclosed by the team: {disclosed}", { disclosed: String(r.disclosed) }) : "")),
    ""];
}

/** R57 (C11; K1494): the timeline, in words: what the world did and what the group did, as two lists, never one; each
 *  item with the source it rests on; how many items had no source and were left out; how many of the group's acts their
 *  source did not mark public (`withheld`, T45) and were left out; each lane events cut at its limit
 *  (`cut`: `they_did`, or `we_did:<source>`), so a cut list never reads as whole; and a read that failed (`unread`),
 *  stated rather than read as an empty timeline (R26). */
export function timelineBodyLines(rows, leftOut = 0, { cut = [], unread = null, withheld = 0 } = {}) {
  if (unread) return ["## Timeline", "", word("case-authoring.document.timeline_read_case", { unread: String(unread) }), ""];
  const cuts = Array.isArray(cut) ? cut : [];
  const kept = Math.max(0, Math.floor(Number(withheld) || 0));
  if ((!rows || !rows.length) && !leftOut && !cuts.length && !kept) return [];
  const lane = (name, title) => {
    const items = (rows || []).filter((r) => r.lane === name);
    return [title, "", ...(items.length ? items.map((r) => localize("case-authoring.document.ord_when_v1_ref_source", "{ord}. {when} — {v1} ({ref}; source {source})", { ord: String(r.ord), when: String(r.when), v1: String(r.label ?? r.ref), ref: String(r.ref), source: String(r.source) }))
      : [word("case-authoring.document.lane")]), ""];
  };
  return ["## Timeline", "",
    word("case-authoring.document.frozen_case_published"), "",
    ...lane("they_did", "### What they did"), ...lane("we_did", "### What we did"),
    ...(leftOut ? [word("case-authoring.document.item_source_record", { left_out: String(leftOut) }), ""] : []),
    /* R57 (T45; v0.2 rules 15, 17): what we did is the case's published record of actions; an act its source did not
       mark for the public is left out and counted, never written. */
    ...(kept ? [word("case-authoring.document.group_act_marked", { kept: String(kept) }), ""] : []),
    ...cuts.map((c) => (c === "they_did" ? word("case-authoring.cuts.map.list_did_stops")
      : word("case-authoring.cuts.map.did_stops_bound", { we_did: String(c.slice("we_did:".length)) }))),
    ...(cuts.length ? [""] : [])];
}
