# case-catalogue — requirements

**Status** · In force: split from `ratification` for size by copy (K617, K1824, BOB's), meaning unchanged: R1–R4 name their `ratification` ids, R5 a copy of its R15, which stays; `ratification` keeps both registrations with `promotion` (its R8, R9) and deleted its copy (K1839). Every requirement met (CASE-CATALOGUE #1, K1829).

**Size (P6).** About 1,000 lines (`ratification/checks.mjs` 13–962 and 1246–1281), leaving `ratification` about 3,005.

## Public

### Purpose

The case-document catalogue and the case-member arm of C-2.8: what a case document must carry to be well-formed (C-41.1–C-41.19, with the case arms of C-2.8, C-3.1 and C-21.1), and what a document claiming membership of a published case must carry. Pure: it reads no table, writes nothing, registers nothing and decides no ceremony; `ratification` registers it with `promotion` and runs it at its gates.

### Provides

- **R1** (was `ratification` R8, its catalogue; T53: C-41.18 and C-41.19 join, R7 and R8) `checkCaseDocument(fm, ctx)` answers the findings of C-41.1–C-41.19 and the case arms of C-2.8, C-3.1 and C-21.1 over a case document of any accepted format (`case-grammar` R1), each naming its check; pure, never throws; an absent member basis in `ctx` leaves those arms unasked. `CASE_DOCUMENT_FAMILY`, `CASE_CITATION_VERSIONS` (`pinned`, `only_capture`, `undetermined`, `no_capture`, `no_bytes`) and `SEARCHED_SUBJECT_SOURCES` (only `case_basis`; C-41.10 refuses any other) are exported. C-41.16 finds a case document whose edition is above 1 and which carries no "What changed" statement (`case-grammar` R8), or a blank one. Its translation: "A new edition of a case says what changed in it, and why, before it is signed. This one does not. Write the statement, then sign. Nothing was signed." (C-41.16: DEC-101 (2); K1019)
- **R2** (was `ratification` R9, its definitions) `checkPublishedExtension` is C-2.8's case-member arm, asked only of bytes `isCaseMemberBytes(fm)` answers true for; `caseMemberFindings(fm)`, `caseMemberImageFindings(image, parse)` and `withCaseMemberChecks(image, gate, parse)` run it over front matter, an image and a gate's findings. `caseEditionClaimed(fm)`, `isCaseMemberBytes(fm)`, `completenessFields(fm)` (the one shape C-21.1 compares, a string comparison), `biasAcknowledgementOf(fm)`, `CASE_MEMBER_ROLES` (`load_bearing`, `supporting`) and `SUBJECT_POSITIONS` (`sought_and_answered`, `sought_no_answer`, `not_sought`) are exported, pure. (Fix round 10, cause 31; K5056) The case arm counts only live legs, as `strength` does: a ground whose every leg is severed has no row to ask for and is no finding. Test: a member whose second ground's only leg is severed, with rows for the first ground only, answers no C-2.8 finding; control: the same with the leg live and its row absent answers the finding.
- **R3** (was `ratification` R38; DEC-111; `case-grammar` R10; K1119) `checkCaseDocument` refuses a case document whose `working_on` is present and not a notice reference by `case-grammar` R10's rule, under C-41.17, before any write.
- **R6** (T51 fix round 10; CASE-AUTHORING #45/#46 J29; K5187; amends R2, R31) The case document's member arm reads each member's `references` at its pinned bytes beside its `basis`: a `memberBasis` entry is the member's basis array, or `{basis, references}`, and the member's frontmatter it checks carries both, so a leg whose citation is severed is dropped there exactly as on the member's own arm (R31), and a ground left with no live leg needs no frozen row.

#### T53 additions

- **R7** (T53; DEC-461; amends R1, R4) **C-41.18 `UNGRADED_PASSAGES_MISMATCH` (name BOB's).** Over a document `case-grammar` R35's predicate holds for: a finding when the `ungraded_passages:` rows are not exactly (as a set) the `(finding, ord, content_id)` of the `passages:` rows whose `grading_facts:` row `strength.isLegUngraded` answers true for; a row naming a passage with no `passages:` row; a repeated row; a block present and unreadable (R36). A document of an earlier format is not asked, except that one carrying an `ungraded_passages:` key is found (a statement no reader would read). Pure. Translation (BOB's draft, UX stream's words): "The list of passages this case was published without a grade for does not match the passages that have none. Prepare the case again, and sign it. Nothing was signed." Test: one ungraded passage with its row passes; without the row, a row for a graded passage, a duplicate, a scalar block each give the finding. Control: all graded with no block passes; a `/9` document without the key is not asked; a typed leg graded by the record and not listed passes.
- **R8** (T53; DEC-464; amends R1, R4) **C-41.19 `TYPED_PASSAGES_MISMATCH` (name BOB's).** Over a `/10` document: a finding when the `typed_passages:` rows are not exactly the relied-on passages whose `chain` is a typed chain (`text-chain.typedStepOf`); a row whose `checked` disagrees with its `checkers` (true with an empty list, or false with entries); a `level` outside `ATTRIBUTION_LEVELS`; a `*_shown` other than null at `group`/`project` or non-blank at `cover`/`name`. Pure. Translation (BOB's draft): "A page a member typed is not listed, or is listed with a credit the member's choice does not allow. Prepare the case again. Nothing was signed." Test: a typed passage with no row, `checked: true` with `[]`, a name shown at `group` each give the finding. Control: a typed passage listed correctly passes; a document without typed passages and without the block passes.

## Private

### Uses

- `record-grammar`: `ISO_TS_RE`, `BUNDLE_ID_RE`, `BASIS_GRADES`, `GRADE_AXES`.
- `strength`: `STRENGTH_STATES` (R2, C-2.8's frozen-axis states), read from its pure `arithmetic.mjs` only, never its store-bound index (K1317), so `case-checker`'s standalone program bundles only pure code.
- `case-grammar`: the accepted formats and their three predicates (its R1), `whatChangedOf` (its R8; C-41.16), `isNoticeReference` and `WORKING_ON_KEY` (its R10; R3).
- `case-grammar` (T53): `caseDocumentStatesUngradedAndTyped`, `ungradedPassagesOf`, `typedPassagesOf` (its R35–R37) and `ATTRIBUTION_LEVELS` (its R2), for R7 and R8.
- `text-chain` (T53): the pure `typedStepOf` (A58), read from its pure part only so `case-checker`'s standalone program bundles only pure code (K1317); `strength`: the pure `isLegUngraded(gradingFactsRow)` (A58; in its `arithmetic.mjs`, K1317). `text-chain` is layer 1 and `strength` layer 6; a `modules.json` edge to `text-chain`, BOB's.

### Invariants

- **R4** (was `ratification` R14, its C-41 share; T53: C-41.18 and C-41.19) Each check is an invariant with its test (K6): C-41.1–C-41.19 with the case arms of C-2.8, C-3.1 and C-21.1. They are gate findings, not refusal rows: `CASE_DOCUMENT_FAMILY` is not named `*_CHECKS` and carries no `where`. A change to any moves `CATALOG_VERSION` (rule 17).
- **R5** (copy of `ratification` R15) No place is named in this module's findings or vocabularies.

### Satisfies

- `docs/architecture/BIO_Publication_v0_1.md` §3 rules 1–3, 17 (the catalogue version), as `ratification` satisfies them for the case document's form.
- DEC-44, DEC-46, DEC-72; DEC-101 (2) (C-41.16); DEC-111 (C-41.17).

### Suggestions

- **The copy (K624 (1), K1824).** This module's job copies `ratification/checks.mjs` 13–962 and 1246–1281 (with the finding shape `f`) into `bio-plane/src/case-catalogue/checks.mjs`, and the pure arms of `test/m/ratification/checks.test.mjs` (74–262, 350–383, with their helpers 14–73) into `test/m/case-catalogue/`, re-labelled with these ids; it merges early in layer 8, after `case-grammar`. In production nothing imports it until `ratification`'s job (T34-85) deletes its copy and re-exports this file (`export * from "../case-catalogue/checks.mjs"`); `case-checker`'s job (T34-47) then imports it directly and regenerates its program. Accepted reds by name: `case-checker`'s program test from `ratification`'s merge until `case-checker`'s, and the row census counting C-41 twice while both copies are held.

## Decided by BOB (for rulings)

1. `SUBJECT_POSITIONS` is this module's (was `ratification` Decided 4): C-2.8's case arm and C-41 read it; `case-authoring` and `affordances` read it through `ratification`'s re-export.
2. `SEARCHED_SUBJECT_SOURCES` is this module's (was `ratification` Decided 5; C-41.10 reads it).
3. `caseEditionClaimed` and `isCaseMemberBytes` are this module's (was `ratification` Decided 6); `record-grammar` keeps its own `isCaseMemberBytes` for C-3.1's heading rule (its R33).

## Open for Bob

None.
