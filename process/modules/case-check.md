Length: 59 lines. Last section: "Suggestions".

# case-check: requirements

Next number: 6

**Size (P6).** New. About 300 lines; one table.

## Public

### Purpose

A case run through every check publication makes, and held unsigned by the project's choice, with no limit (D23). This module records that check and answers, at each read, whether it still stands, so a determination may rest on findings checked for publication and not yet published (D24; `conformance` R2). A held check is a state, never a fault.

### Provides

Terms are `publication`'s and `case-authoring`'s. A **check** is one record of a preparation that passed every check at an instant. Every refusal names `reason`; one with a catalogue row carries its `check`, `code` and `translation`.

**checkAndHold({…publishCase's inputs, viewer, author})** (`op=publishcheck`; mutating)
- **R1** [met] (T45; N828; Actions D23, D24; v0.2 §3 Determination, rule 2) Inside one transaction it runs `case-authoring.publishPreflight` (its R34) over the inputs. - When `ready` is false it answers R34's `{ready: false, first, blockers}`, and nothing is written: no preparation and no check. - When `ready` is true it runs `case-authoring.publishCase` (its R14 stores the preparation) and records a check `{check, case, edition, doc_sha, members: [{bundle_id, version_sha, role}], checked_at, by}`: `doc_sha` the stored preparation's; `members` the pins R13 of `case-authoring` made; `checked_at` `record-core`'s instant; `by` the stamp. It answers `{ok: true, held: true, check, caseDocument}`. - Every refusal is `publishCase`'s or the pre-flight's, in their order; `MACHINE_CANNOT_PUBLISH` and the owner-only authority come first, unchanged. - A repeat while the latest check of that edition reads `held` (R2) answers that check with `existed: true`, writing nothing. - A check has no expiry. Holding is the act itself: no further act is needed to keep the case unsigned.

  Controls: a pre-flight with one blocker writes nothing and stores no preparation; a ready one stores the preparation and the check.

**caseCheckOf({case, edition?, check?, viewer?})** (`op=casecheck`; a read)
- **R2** [met] (T45; Actions D23, D24) Answers one check's state, computed at the read: the named `check`, else the latest check of `edition`, else of the case's latest prepared edition. - **The states:** - `held`; - `void`, with `why`, each of: `document_replaced` (the stored preparation of that case edition is no longer at `doc_sha`, `publication`'s `case_documents`, its R40, R56); `member_moved` (naming each member whose current `bundle_sha` is not the one the check pins); `source_lapsed` (`case-carriage.sourcesLapsed`, its R5, answers a row); `accepted_work_lapsed` (`case-carriage.acceptedWorkLapsed`, its R4, answers one, read as the check's `by`); `marks_lapsed` (`case-carriage.marksLapsed`, its R13, answers a row); - `published`, with the edition, once that edition is ratified (`publication`'s `published_cases`, its R40); - `none`, when there is no check; - `undetermined`, when any of those reads fails. It fails closed: a failed read never answers `held`. - It answers `checked_at` and `by` with every state but `none`. - With `viewer`, it is fenced as `publication` R1 is (`hasCaseStanding`): no standing in the case's project answers `NO_SUCH_CASE`, the same answer as an absent case. Without `viewer` it is read as the plane. - It writes nothing and never throws. A void check stays void when its cause is undone: re-running R1 makes a new check. For `document_replaced` and `member_moved` (latched by the pinned preparation and by record-core's `row_version`); (T46; N907; K2833) for the three lapse causes, latched through `case-carriage`'s reads over the interval from the check's `checked_at` to the read (its R19–R21): `source_lapsed` when `sourcesLapsedSince(text, checked_at)` answers a row, `accepted_work_lapsed` when `acceptedWorkLapsedSince(fm, by, checked_at)` answers one, read as the check's `by`, and `marks_lapsed` when `marksLapsedSince(fm, checked_at)` answers a row, so a lapse undone before the read still voids the check, as far as those reads answer it (an acceptance withdrawn and restored, a mark's copy changed and derived again, in T46; a flag cleared or a consent restored once N947 gives `case-carriage` those histories, K2949); a failed read is `undetermined`, as above, and the commit still re-reads all three at its own instant.

  Controls: each `why`, against an untouched check that reads `held`; a re-authored acknowledgement list (`case-inputs` R2, was `case-authoring` R20) reads `document_replaced` (l8 doubt 3); a failed read reads `undetermined`; after ratification it reads `published`; an outsider gets the same answer as an absent case, byte-identical. (T46) For each lapse cause, a lapse made after the check and undone before the read reads `void` with that `why`, and its control, nothing lapsed since the check, reads `held`.

**heldFindingVersions({finding, version?, project?})** (no op)
- **R3** [met] (T45; N828; Actions D24; the plan's reconciliation R4) Answers `{items: [{case, edition, project, version_sha, role, check, checked_at}]}`: every check reading `held` (R2) whose members include `finding`, in `publication` R37's shape with `check` and `checked_at` in place of the frozen pair. `version` keeps those pinning that version, `project` those of that project. `NO_ID` for an empty `finding`; a finding no held check names answers `items: []`. Viewer-free; it writes nothing. It is the read `conformance` R2 uses beside `publication` R37, with R2 for voiding. Control: a void check is not listed.

## Private

### Uses

- `case-authoring`: `publishPreflight` (its R34) and `publishCase` (its R14, R18), for R1.
- `publication`: `hasCaseStanding` (its R1), for R2's fence; the `cases`, `published_cases`, `published_case_members` and `case_documents` read contracts (its R40, R56), for R2 and R3.
- `case-carriage`: `acceptedWorkLapsed`, `sourcesLapsed` (its R4, R5) and `marksLapsed` (its R13), for R2's `void`. (T46; N907) In their place for R2's latch, `acceptedWorkLapsedSince`, `marksLapsedSince` and `sourcesLapsedSince` (its R19–R21).
- `record-grammar`: `parseFrontmatter`, the front matter the lapse reads take.
- `record-core`: `transact`, `stampInstant`, `allocId` (a check's opaque id), `declarePurge`; the `bundles` read contract (its R37), for `member_moved`.
- `membership`: `viewerPredicate`, for R2's fence beside `hasCaseStanding`.
- Its users: `conformance` reads R2 and R3 (its R2, R31, R33; the plan's reconciliation R4); `affordances` and `op-declarations` grade and specify `publishcheck` (mutating, graded as `publish`) and `casecheck` (a read) in layer 11.

### Invariants

- **R4** [met] (T45; Actions D23) Checks are append-only, and a check row is never rewritten. They are declared to `record-core`'s purge as working material, cleared with the unsigned documents they name (`publication` R29, R31). No answer composes a case-level strength. No place is named in this module's behaviour or outward text (`layers.md`).
- **R5** [met] (T45; Actions D23) The states `held`, `void` (with each `why`) and `undetermined` are answered to be shown to members as a state, never a fault: no answer of this module carries a refusal row for a held or void check. Their words are the UX stream's, keyed `case.check.held`, `case.check.void.<why>` (`document_replaced`, `member_moved`, `source_lapsed`, `accepted_work_lapsed`, `marks_lapsed`) and `case.check.undetermined`, and each answer carries its key.

### Satisfies

- `BIO_Action_v0_2.md` §3 (Determination: findings checked for publication and held, disclosed) and §4 rule 2 (K2780; Actions D23, D24; T45, N893): R1–R5. N828; K2781 (1) (the module's place).

### Suggestions

- **The table.** `case_checks` (`check`, `case_id`, `edition`, `doc_sha`, `members` as canonical JSON, `checked_at`, `by`), append-only; the check's id minted opaque (`record-grammar` R55's form) with a prefix the job proposes at its START.
- **Every publication check** (l8 doubt 2) is R34's `ready`: everything `op=publish` and signing would refuse, the group's required approvals (`case-authoring` R68) included.
- **What voids** (l8 doubt 3): any move of the stored preparation's `doc_sha`, which fails closed, plus moved member pins and the commit's three lapse reads (`publication` R51, R57, R59). A narrower digest (like `approvalSubjectSha`) was considered and not taken.
- **Queue.** A checked-and-held edition is a state, so `action-producers`' and `queue-producers`' unsigned-edition items should not nag it (D23); that is theirs to state, reading R2.
- **Tests:** each refusal through R1 with a negative control; R2's arms as listed; R3 with a void and a held check side by side; a rolled-back R1 leaves no row.
