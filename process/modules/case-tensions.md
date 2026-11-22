Length: 89 lines. Last section: "Suggestions".

# case-tensions: requirements

Next number: 13

| old (`publication`) | new | |
|---|---|---|
| R4 | R1 | `caseRelation` |
| R5 | R2 | revision flags, `dischargeCaseFlags` |
| R6 | R3 | `caseFlags` |
| R50 | R4 | `caseTensions` |
| R17 | R5 | `attributeObservation` and the attribution reads |
| R39 | R6 | `attributionInForce` |
| R60 | R7 | a capture's attribution |
| R26 | R8 | invariant: no case-level strength (a copy; `publication` keeps R26) |
| R33, C-92 rows | R9 | invariant: the C-92 rows |
| R31, flags and attributions | R10 | invariant: purge classes |
| R34 | R11 | invariant: no place (a copy) |

**Size (P6).** From `bio-plane/src/publication/index.mjs` on `tranche/T32`: `caseTensions` and `#caseTensionsOne` (1033–1230), `caseRelation`, `#caseClaimInBytes`, `flagCasesOnRevision`, `dischargeCaseFlags`, `caseFlags` (1231–1500), the attribution methods `observationsNamingAuthor` … `attributeObservation` (1754–2100), the C-92 rows of `checks.mjs` and their tables in `schema.mjs`: about 900 lines. Well under 4,000.

## Public

### Purpose

What a case says about the record after it is signed, and how a member's words are credited in it: which case editions a finding serves, the flags raised when a pinned finding is revised and their discharge, the tensions found after publication, and the attribution level each member chooses for their observation (or attested capture) in a case edition. `publication` calls it inside its own acts; `queue-producers`, `review` and `ratification` read it.

### Provides

Terms. A **case**, **edition**, **case document**, **pin** and **stamp** are `publication`'s (its Provides, Terms). Every refusal names `reason`; one with a catalogue row carries its `check`, `code` and `translation`.

#### The case relation and revision flags

- **R1** [met] (was `publication` R4) `caseRelation(id)` answers the ratified editions pinning the finding's current sha and any unsigned preparation naming it; registered with `promotion` as the fact `caseMember`.
- **R2** [met] (was `publication` R5) When a promotion replaces a sha ratified editions pin, one flag per case edition, member and new sha is written with the owning project (null for a case older than DEC-72) and the instant, never twice; a projection registered with `promotion`. `dischargeCaseFlags(case, edition, by, at)` discharges a case's outstanding flags when a newer edition is ratified, recording by whom and at which edition.
- **R3** [met] (was `publication` R6) `caseFlags({case?, target?, outstanding?, limit})` (`op=caseflags`) answers flags ordered by instant, case, edition, member; `limit` clamped to [1, 500], 500 by default; `truncated`.

#### Tensions after publication: caseTensions({project?, after, limit}) (N345; read as the plane, for `queue`)

- **R4** [met] (was `publication` R50; DEC-84 item 13) `caseTensions({project?, after, limit})` answers, for each case whose latest ratified edition is owned by `project` (every such case when absent), in case id order after `after`, at most `limit` (1–200, default 200), with `cursor`: the candidates `contradiction.unresolvedRecordOn` (its R29) answers over each member at its pinned sha that the edition did not disclose. Each carries the case, the edition, the member, the candidate and its state. A candidate the edition disclosed and that has since been resolved is answered as `resolved_since`. A candidate with a side the project's owners may not see is answered as `unresolvedRecordOn` answers it, `unseen_other_side: true` with nothing of that side (DEC-85). It is read as the plane, for `queue`. It writes nothing, never throws, and composes no strength (R8). The signed edition never changes (`publication` R24). A later edition discloses or resolves the tension.

#### Attribution: attributeObservation({caseId, edition, observation, level, reason, by}) (`op=attribute`)

- **R5** [met] (was `publication` R17) Refusals: C-92.1 (not a member), C-92.2 (no level), `ATTRIBUTION_NO_REASON` (C-92.13: the `reason`, the author's words on why this level, absent, not a string, blank or over 2,000 characters; its translation: "Choosing how a published case shows who said your observation records why, in your own words, and no reason was given, or it is longer than 2,000 characters. Write one. Nothing was written."; DEC-88, K1025), C-92.3 (a level not `group`, `project`, `cover`, `name`), C-92.4 (not an observation), C-92.5 (not its author), C-92.6 (author not active), C-92.7 (the edition does not reach it), C-92.8 (the edition is signed), C-92.9 (`name` with no handle). A choice is recorded per case, observation and edition, dated, with its reason, and re-authors the unsigned document's attribution section (through `publication`'s `reauthorSection`, its R21). The level in force is the latest choice at or before the edition; `attributionFacts(doc)`, `attributionStatedFor(observation)`, `observationsNamingAuthor(ids)` and `attributionStatements(case, edition, project)` (the section's text, one spelling: `case-grammar` R2) answer what the gates and the author read.
- **R6** [met] (was `publication` R39) `attributionInForce(caseId, edition, observation)` answers the attribution level in force, with the `reason` its author gave (null before DEC-88; K1076), for that observation in that case edition (R5's statement read at a case edition), read by `review` R16 (K240).
- **R7** [met] (was `publication` R60; DEC-119 (3); N523) `attributeObservation` (R5) also takes `capture` in place of `observation`, for a capture whose source's identity a case states as "Withheld" (`case-disclosures` R8). The capture's attesting member (its `actor`, `acquisition` R16) then chooses how a case credits their attestation, at the same four levels, by the same act and with the same refusals. C-92.4 reads "not an observation or such a capture", and C-92.5 reads "not its author or attesting member". The choice is recorded per case, capture and edition, dated, with its reason. When the choice is recorded while the document is unsigned, the act also re-authors its `attestations` section (`case-grammar` R3, R12; `publication` R21): the chooser's `member` row for that capture is replaced by one stating the chosen level, written by `materialAttestationLines`, carrying the handle, key and signature only at `cover` or `name` (`case-disclosures` R10; K1317). `attributionFacts`, `attributionInForce` (R6) and `attributionStatements` answer it beside the observations, keyed by the capture's SHA-256, so `ratification` R2, R35 and R36 read it as they read an observation's. (DEC-119 (3); DEC-102 items 1–3; K1275, K1277) (Amended, fix round 6, G47; K4672, K4682.) When several captures of one source share a `ref`, choosing one capture's level re-authors only the attesting member rows that carry that capture's `sha` (or carry none); rows of other captures are kept as written. Test: `g47-reauthor.test.mjs`.

## Private

### Uses

`publication`'s current uses that these services need (Rule 3):
- `record-grammar`: `parseFrontmatter`, `canonicalJson`.
- `case-grammar`: `ATTRIBUTION_LEVELS`, `attributionFrontmatterLines`, the attribution run and section locators (its R2, R3), `caseTensionsOf`, `disclosedCandidates`, `materialAttestationLines`.
- `record-core`: `recordOf(ctx)`, `transact`, `stampInstant`, `declarePurge`, the `bundles` read contract.
- `membership`: `viewerPredicate`, `isProjectOwner`, members' handles, covers and status (R5).
- `promotion`: `registerStep` (R2's projection), `registerFact` (R1's `caseMember`).
- `provenance`: `observerRef` (R5).
- `basis-versions`: `testimonyReach` (the observations an edition reaches, R5).
- `contradiction`: `unresolvedRecordOn` (its R29; R4).
- `capture`: a capture's `actor` and `source` (R7).
- **Open (the seam):** `publication`'s tables (`cases`, `published_case_members`, `case_documents`) and `reauthorSection` (its R21), which R1, R2, R4, R5 and R7 read or call, belong to a later module. See Suggestions.

### Invariants

- **R8** [met] (a copy of `publication` R26) No answer, document or row this module serves composes a case-level strength: every pair is per member and per axis (DEC-44, DEC-21).
- **R9** [met] (`publication` R33's share) Each check of R5 and R7 is this module's invariant with its test (K6): C-92.1–C-92.9 and C-92.13, moved with their numbers and translations unchanged, and leave `publication`'s table, so no row id is held twice. A change to any row moves `CATALOG_VERSION` (rule 17).
- **R10** [met] (`publication` R31's share) The case flags and the attribution choices are declared to `record-core`'s purge as today (K23).
- **R11** [met] (a copy of `publication` R34) No place is named in this module's behaviour or outward text.

### Satisfies

- `docs/architecture/BIO_Publication_v0_1.md` §3 rule 7 and §7 (attribution), §4 (the case relation).
- `docs/development/MEMBER-KNOWLEDGE-DESIGN.md` §4 (MK-7 attribution levels).
- DEC-44, DEC-72, DEC-88 (R5's reason), DEC-119 (3) and DEC-102 items 1–3 (R7).
- N345 (R4): DEC-84 item 13 ("discloses, never blocks"); DEC-85; `CONTRADICTION-PRESENT-RESOLVE-DESIGN.md` §10.
- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §10 "A module fits in one reading" (the split; P6, K617).

### Suggestions

- **Open for BOB: the seam runs both ways.** `publication`'s commit calls `dischargeCaseFlags` (R2) and `caseDocumentFacts` (its R2) reads `attributionFacts` (R5), so `publication` uses this module, which fits the order. But R1 and R4 read `publication`'s `cases`, `published_case_members` and `case_documents`, and R5 and R7 call `publication.reauthorSection` to re-author a section, which a module placed before `publication` may not use (P4). Three ways, BOB's (K617): (a) `publication` registers one provider at start (the K31 pattern, as its R23's review provider): the ratified editions pinning a sha, the case document of an edition, and the section splice; with no provider, R1 and R4 answer undetermined and R5 refuses before writing. (b) The three tables' stated read contract (`publication` R40, R56) is extended to name this module as an earlier reader created by `publication`'s factory, the case-carriage precedent; the splice still needs (a). (c) Place `case-tensions` after `publication` and let `publication` reach R2's discharge through a registration instead. (a) keeps every table and write in `publication` (its R24, one way) and needs one new requirement here and one in `publication`.
- **Tables.** `case_flags` and `observation_attributions` move here with their writers (one table, one writer, P7); `publication` keeps the rest.
- **Registrations.** `promotion.registerFact("caseMember", "case-tensions", …)` and the revision step `registerStep("case-tensions", …)` replace `publication`'s; the promotion order of the step does not change, since `case-tensions` sits directly before `publication`.
- **Ops.** `caseflags` and `attribute` are this module's arms (K1122's pattern), spread by the plane.
- **Callers to re-point.** `queue-producers` R6 (`caseTensions`) and R23 (attribution facts through `publication.caseDocumentFacts`, unchanged), `review` R16 (`attributionInForce`), `ratification` R2, R35, R36 and R5's arms.
- **Tests.** The C-92 negative controls, the N345 tests of `publication`'s Suggestions that concern R50, and the flag and discharge cases move with the code.

- **R12** [met] (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `attribute`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
