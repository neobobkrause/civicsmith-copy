Length: 52 lines. Last section: "An edition waiting to be published (N681; K1833; DEC-147)".

# case-document: requirements

Next number: 88

## Public

### Purpose

The case document's text, split from `case-authoring` (P6): pure functions that compose an unsigned case document (`bio-case-document/7`), its citations, completeness and searched section, its printed lens, its calculations and its timeline, from what `case-authoring` read from the record and the owner's words. Nothing here reads a table or writes, so a document can be rendered without a store.

### Provides

#### Preparing a case: publishCase({project, targets|target, roles, scope, statement, excluded, subjectPosition, subjectJustification, biasAcknowledgement, whatChanged?, caseId?, newCase?, draft?, viewer, author}) (`op=publish`)

- **R14** [met] The document, format `bio-case-document/7` (`case-grammar` R1; `/6` before T31, DEC-124, K1365 (1)), is stored unsigned through `publication.storeCaseDocument` (never over a signed one). It states: the case, edition and project; the scope; the roster with roles and pins; per member its own edition, its frozen pair (capture and connection always, testimony when not unrated) with grounds, and the conclusion it rests on (relationship, reading, claim); the completeness block (statement, subject position and justification, exclusions, `author` the publisher, `statement_by` (`case-inputs` R3) with where the name came from, `statement_sha`, `acknowledged` and the list, `case-inputs` R2); the bias acknowledgement; the bias manifest frozen from `bias.biasManifest` at the project's scope read as the plane (`in_force` true, false or null, with `pins_proposed` count and rows); the lens statements printed whole (R40); the bar, an undeclared axis as null and "no bar set on the <axis> axis"; the attribution statements (`publication.attributionStatements`); the citations (R16); the tensions disclosed (`case-disclosures` R1) and, in each member's block, its tension sentences; the searched section (R17); the `captures:` block (`case-disclosures` R2, R3) and the `sources:` block (its R4); the `method:` block (its R5); the `materials:` and `material_attestations:` blocks (its R7), a marked photo stated as carried by its copy, `obscured: {copy, label}` (`case-disclosures` R6, R7; DEC-180 (4); T37); the `accepted_work:` and `accepted_work_flags:` blocks (its R13, R14); the draft link when named (R9: draft, who named it, when); the "What changed" block and its section for an edition above 1 (R38); the `grading_facts:` and `passages:` blocks (`case-disclosures` R15); a receipt. Its body prints every authored sentence. (The lens statements and the "What changed" block: DEC-101, DEC-103; K1019. The `/6` format and its blocks: DEC-112 (3)(4)(5), DEC-96 item 4; K1268, K1273) (T47; N908) The acknowledgement list is `case-inputs` R2's `statementAcknowledgements` and `statement_by` its R3's `statementWriter`, each asked once per act, and the list's renderers are imported from it, never copied (K1333). (fix round 6, G47; K4687) The document is measured as built: over `publication`'s `CASE_DOCUMENT_BYTES_MAX` the act is refused `CASE_DOCUMENT_TOO_LARGE` (C-136.9) carrying `size`, `bound`, `materials` and `members`, before any side effect; a refusal of the store is the act's refusal, never a prepared document with no `doc_sha`. The document declares its format through `case-grammar`'s `caseDocumentFormatFor` over its attestation rows (`/9` only when a row carries a `sha`, else `/8`).
- **R16** [met] Citations (rule 18): every non-severed `cites` edge of the project at the act, each `pinned` (with its capture), `only_capture` (the one held), `undetermined` (several held; never back-filled), `no_capture` or `no_bytes`. (T51 fix round 2, C67; K4307; amends R16) An edge whose target is a finding (an inquiry) is carried only when that finding is a member of this case; edges to documents are carried as before. Test: a project citing Q (a member) and Q2 (a finding of another draft, not a member) carries Q only; control: with Q2 a member both are carried. (fix round 6, G29; K4607; R86) After every non-severed `cites` edge of the project, one row for each document the members' findings rest on (R86). (fix round 6, G29; K4609, K4610) Every row whose target is a document carries `bundle_sha`, the document's head (`record-core` `head`, the sha256 of its `bundle.md`) as of the prepare act; a row whose target is no document carries none.
- **R17** [met] The searched section is computed from the observation log at authoring over the members' legs and never recomputed (`searchedSection`, subject source `case_basis` only, at most `SEARCHED_SUBJECT_MAX` subjects); it states what was looked for at each level and with what outcome, and why where undetermined.

## Private

### Uses

- `setup-words`: imported by `document.mjs`, `searched.mjs`.
- `observation-log`: imported by `searched.mjs`.
- `strength`: imported by `document.mjs`.
- `case-grammar`: imported by `document.mjs`.
- `publication`: imported by `document.mjs`.
- `ratification`: imported by `document.mjs`, `searched.mjs`.
- `case-disclosures`: imported by `document.mjs`.
- `case-account`: imported by `document.mjs`.
- `case-inputs`: imported by `document.mjs`.

### Invariants

- **R22** [met] Everything a case document asserts arrived as an authored argument, was read from the record at the act (pins, pairs, conclusions, manifest, citations, searched section, acknowledgements), or is a stated fact; nothing is composed, summarised or inferred.
- **R26** [met] Undetermined is stated and never filled: a statement writer, an undeclared bar axis, a bias manifest not established, a citation's version.

#### The lens printed into the signed case (DEC-103; K1019)

- **R40** [met] At publication every statement in the effective set of the frozen manifest (`bias.biasManifest`, every page read) is printed into the document (`case-grammar` R9): its kind in plain words, its subject, its text, its justification, and each of its citations that is public material, being a public web address (`record-grammar`'s public-locator test) or a bundle or hash this copy has published (the published registries). Every other citation is withheld and only counted, per statement, never named. With no manifest in force the block states that none was in force. The unsigned document R14 stores, which `op=publish` answers and R34 checks, holds every byte that will be printed, so the publisher can be shown exactly what will be printed before signing. (DEC-103; K1019)

#### Calculations and the timeline a case carries (C:A-15, C11; K1448, K1494)

- **R56** [met] (C:A-15; DEC-76.4; D370) `publishCase` takes `calculationsDisclosed: [{calc, words}]`. For each calculation a member's chain reaches (a `calculation` leg), it reads the calculation and its recompute status (`calculations.read`, `recompute`). A load-bearing member's calculation that differs on recompute or has an unbound input, and that the list does not name, is `CALCULATION_NOT_DISCLOSED` (a new row of this module's table), naming each calculation and member; nothing is written. No other state of a calculation refuses: a calculation that agrees, a supporting member's, one disclosed, and a second member's check (recorded or not) never block (D370). The `calculations:` block (`case-grammar` R18) is written into the document with each row's recompute status and the owner's words, so the published case states what it discloses.
- **R57** [met] (C11; K1494) After R55's judgments, `publishCase` composes the document's `timeline:` block (`case-grammar` R20) from `events.timeline` (its R28–R30) over the set of the members' subject entities (`inquiry.subjectEntityOf`) and the events their legs cite, read as the publisher sees the record at the act: the world's lane and the registered sources' lane apart, never interleaved, each item with its source, an item with no source left out and counted. People in an item are named only as `case-disclosures` R25 passes them (R55). Nothing is recomputed after signing (`publication` R63). (T45; N855 (6a); Actions D4, D6a, D22; v0.2 rules 15, 17) The `we_did` lane is the case's published record of actions. `publishCase` asks `events.timeline` with `audience: "public"` (`events` R28, R30), and writes only items whose source marks them `public: true`; any other item is left out and counted in the lane's `withheld` count, never written. It adds no item and writes no word a source did not put in its label. Leaving out deliberation, confidential acts and counsel matters is the producers' (`actions` R66, `escalation`'s source, `docket` R26), never a filter here; this mark is the fail-closed guard. An escalation's "stopped pursuing" appears as its source answers it, with its date and without its reason (rule 17). Control: a stub source answering one item without `public: true` and one with it: only the second is written, `withheld: 1`, and `events.timeline` received `audience: "public"`.

#### An edition waiting to be published (N681; K1833; DEC-147)

*The standards a case measures against, judged before it is prepared* (T36; N717; K1723, K1739, K2002, K2004)
- **R60** [met] R14's document states each member's `subject_entity` on its `case_roles:` row (`case-grammar` R22): the `subject_entity` the member's pinned bytes state (the front matter `publication` R72 reads as a criteria row's `body`), or null when they state none; never the inquiry's current subject, another member's, or a value the act's caller sends. (N717; K2002, K2004)
