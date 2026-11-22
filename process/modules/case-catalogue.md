Length: 42 lines. Last section: "Suggestions".

# case-catalogue: requirements

Next number: 7

**Size (P6).** About 1,000 lines (`ratification/checks.mjs` 13–962 and 1246–1281), leaving `ratification` about 3,005.

## Public

### Purpose

The case-document catalogue and the case-member arm of C-2.8: what a case document must carry to be well-formed (C-41.1–C-41.17, with the case arms of C-2.8, C-3.1 and C-21.1), and what a document claiming membership of a published case must carry. Pure: it reads no table, writes nothing, registers nothing and decides no ceremony; `ratification` registers it with `promotion` and runs it at its gates.

### Provides

- **R1** [met] (was `ratification` R8, its catalogue) `checkCaseDocument(fm, ctx)` answers the findings of C-41.1–C-41.17 and the case arms of C-2.8, C-3.1 and C-21.1 over a case document of any accepted format (`case-grammar` R1), each naming its check; pure, never throws; an absent member basis in `ctx` leaves those arms unasked. `CASE_DOCUMENT_FAMILY`, `CASE_CITATION_VERSIONS` (`pinned`, `only_capture`, `undetermined`, `no_capture`, `no_bytes`) and `SEARCHED_SUBJECT_SOURCES` (only `case_basis`; C-41.10 refuses any other) are exported. C-41.16 finds a case document whose edition is above 1 and which carries no "What changed" statement (`case-grammar` R8), or a blank one. Its translation: "A new edition of a case says what changed in it, and why, before it is signed. This one does not. Write the statement, then sign. Nothing was signed." (C-41.16: DEC-101 (2); K1019)
- **R2** [met] (was `ratification` R9, its definitions) `checkPublishedExtension` is C-2.8's case-member arm, asked only of bytes `isCaseMemberBytes(fm)` answers true for; `caseMemberFindings(fm)`, `caseMemberImageFindings(image, parse)` and `withCaseMemberChecks(image, gate, parse)` run it over front matter, an image and a gate's findings. `caseEditionClaimed(fm)`, `isCaseMemberBytes(fm)`, `completenessFields(fm)` (the one shape C-21.1 compares, a string comparison), `biasAcknowledgementOf(fm)`, `CASE_MEMBER_ROLES` (`load_bearing`, `supporting`) and `SUBJECT_POSITIONS` (`sought_and_answered`, `sought_no_answer`, `not_sought`) are exported, pure. (Fix round 10, cause 31; K5056) The case arm counts only live legs, as `strength` does: a ground whose every leg is severed has no row to ask for and is no finding. Test: a member whose second ground's only leg is severed, with rows for the first ground only, answers no C-2.8 finding; control: the same with the leg live and its row absent answers the finding.
- **R3** [met] (was `ratification` R38; DEC-111; `case-grammar` R10; K1119) `checkCaseDocument` refuses a case document whose `working_on` is present and not a notice reference by `case-grammar` R10's rule, under C-41.17, before any write.
- **R6** [met] (T51 fix round 10; CASE-AUTHORING #45/#46 J29; K5187; amends R2, R31) The case document's member arm reads each member's `references` at its pinned bytes beside its `basis`: a `memberBasis` entry is the member's basis array, or `{basis, references}`, and the member's frontmatter it checks carries both, so a leg whose citation is severed is dropped there exactly as on the member's own arm (R31), and a ground left with no live leg needs no frozen row.

## Private

### Uses

- `record-grammar`: `ISO_TS_RE`, `BUNDLE_ID_RE`, `BASIS_GRADES`, `GRADE_AXES`.
- `strength`: `STRENGTH_STATES` (R2, C-2.8's frozen-axis states), read from its pure `arithmetic.mjs` only, never its store-bound index (K1317), so `case-checker`'s standalone program bundles only pure code.
- `case-grammar`: the accepted formats and their three predicates (its R1), `whatChangedOf` (its R8; C-41.16), `isNoticeReference` and `WORKING_ON_KEY` (its R10; R3).

### Invariants

- **R4** [met] (was `ratification` R14, its C-41 share) Each check is an invariant with its test (K6): C-41.1–C-41.17 with the case arms of C-2.8, C-3.1 and C-21.1. They are gate findings, not refusal rows: `CASE_DOCUMENT_FAMILY` is not named `*_CHECKS` and carries no `where`. A change to any moves `CATALOG_VERSION` (rule 17).
- **R5** [met] (copy of `ratification` R15) No place is named in this module's findings or vocabularies.

### Satisfies

- `docs/architecture/BIO_Publication_v0_1.md` §3 rules 1–3, 17 (the catalogue version), as `ratification` satisfies them for the case document's form.
- DEC-44, DEC-46, DEC-72; DEC-101 (2) (C-41.16); DEC-111 (C-41.17).

### Suggestions

- **The copy (K624 (1), K1824).** This module's job copies `ratification/checks.mjs` 13–962 and 1246–1281 (with the finding shape `f`) into `bio-plane/src/case-catalogue/checks.mjs`, and the pure arms of `test/m/ratification/checks.test.mjs` (74–262, 350–383, with their helpers 14–73) into `test/m/case-catalogue/`, re-labelled with these ids; it merges early in layer 8, after `case-grammar`. In production nothing imports it until `ratification`'s job (T34-85) deletes its copy and re-exports this file (`export * from "../case-catalogue/checks.mjs"`); `case-checker`'s job (T34-47) then imports it directly and regenerates its program. Accepted reds by name: `case-checker`'s program test from `ratification`'s merge until `case-checker`'s, and the row census counting C-41 twice while both copies are held.
