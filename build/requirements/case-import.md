# case-import — requirements

**Status** · In force: a new product module, placed by BOB (K1256, K1257); folded at T28's opening (N520, DEC-96; K1268, K1277), R16 and R6–R9's changes N522's (K1273); N534 reviewed (K1369). Last changed T34 (T34-94: R5, K1828); every requirement met (K1833). Last changed T41 (T41-41's text: R22, R23 new; N820; D59, D62; K2405, K2417, K2418); marked not yet met (T41). Last changed T46 (T46-24: R4 amended, the source group's `group_fields` recorded at import and answered from `importedCase`, for `conformance` R32; N903; K2832); met (K2969). Last changed T47 (T47-30: R17's citation of the docket address corrected, wording only, N951; R24 new, amending R16, `flagHistory` registered with `accepted-work` (its R9), R8's flags with their opening and clearing instants, N947, K3033); R17 and R24 marked not yet met (T47). Last changed T48 (T48-42: R16's null answer for a viewer who is not an active member stated of the reads that take a viewer, `finding`, `openFlags` and R24's `flagHistory`, not `withdrawals` or `moves`, which take only `{after, limit}`; N1020, K3113, K3195, wording only, as built); R16 marked not yet met (T48). Last changed T50 (T50-15: R25 `matter_stake`, R26 the imported list; K3635); marked not yet met (T50). Last changed T51 (FR-16: R27–R32 regrade another group's case under a lens and re-run its work, C49, K4169, UC-076; R31 amended, `title` on each finding row, K4259; R33 the declared ops, K4168, K4202; the withdraw act, C51, DEC-374, tested at R7); marked not yet met (T51).

**Size (P6).** About 1,600–2,300 lines: the import and its tables, recreation, completion, the reads, the four acts and its catalogue rows. Acceptance is split out if it grows (K1256).

## Public

### Purpose

A Civicsmith copy imports another group's case file into a new, read-only project. It confirms each finding by recreating it from the case file, and shows each finding against the importing group's own bar. The group may then accept an edition, by a reasoned act, for the findings that recreated, and may flag and clear issues on it. Recreating is not endorsing. (DEC-112 (6); DEC-96; Publication §5C "Import")

### Provides

Terms.
- An **import** is the read-only project an imported case lands in. There is one per source group, case and lens (K1134 reading 4; DEC-46 (3)). Its id is the SHA-256 of the canonical JSON `{group, case, lens}`: `group` is the source group's slug the manifest names, and `lens` is the bias manifest's fingerprint the signed case document states.
- An **imported edition** is one case edition held in an import. Editions sit side by side, and a later one never replaces an earlier one.
- A **result** is `case-checker`'s (its R11).
- Every refusal names `reason` and carries its catalogue row (R14).
- The words a member sees (the origin marks, the statement that recreating is not endorsing) are the UX stream's, cited and never decided here.
- A **watch** is a member's standing request that this copy read the publisher's docket for one import. Its **docket address** is composed by R17. (N534)
- A **docket read** is one fetch of that address, made by `monitoring` (its R67).
- An **entry seen** is one public docket entry recorded from a read, either `verified` or `refused`.
- (T51; K4169) A **regrade** is R27's read; a **rerun** is a project of this group its owner declares a redoing of an imported edition's work under its own lens (R29); a **pairing** is a member's statement that one of the project's findings answers the same claim as one imported finding (R30).
- A **publisher move** is a verified entry of kind `edition` or `withdrawal`. Only a move raises re-evaluation causes (`reevaluation` R33); every other verified entry reaches only the watch's setter (R20; K1339, K1366 F1).

**importCaseFile({parts, by, viewer})** (`op=caseimport`; member session; mutating)

- **R1** Refusals, in order, each writing nothing:
  - an empty or machine `by`, or an operator token, is `MACHINE_CANNOT_IMPORT`;
  - a `viewer` who is not an active member of this group is `IMPORT_NOT_A_MEMBER`;
  - parts whose manifest fails `case-grammar.caseFileManifestCheck` (its R13) are `IMPORT_NOT_A_CASE_FILE`, naming each departure;
  - a part over the part bound (`public-read` R5's 64 MiB) is `IMPORT_PART_TOO_LARGE`;
  - an edition already held in this import with different bytes (another manifest SHA-256) is `IMPORT_EDITION_DIFFERS`, naming both hashes. An edition is immutable, so the difference is reported, never resolved.

  The same edition with the same bytes answers `existed: true`. Otherwise the act creates the import if it is absent and stores every file of the case file by its SHA-256. It records the edition with its source group, case, edition, lens, `by` and instant. It then runs `case-checker.checkCaseFile` and records each finding's result, with the checker's versions (R3). (DEC-112 (6); Publication §5C; K1134 reading 4)
- **R2** Read-only. Nothing an import holds is a record bundle. No act of this copy edits, promotes, ratifies or publishes it, and this module offers no act that changes an imported file. The only later writes are R5's completion, R6's acceptance and its withdrawal, and R8's flags. (DEC-112 (6) "a new, read-only project")
- **R3** Recreation is recorded per finding: the result, what is missing, what differs, the recomputed pair, and the checker's grading and checks versions; and per calculation the case carries, as R21 records it. It is recomputed only by R5. (DEC-112 (6); Bob, DEC-112 response 2: "the system confirms the findings according to the structured case file")

- **R21** (C:A-14; K1448; D312) At an import (R1) and at a completion (R5), each calculation the case carries (`case-grammar` R18) is recreated, never trusted: its recipe is evaluated by `calc-grammar.evaluate` (which writes nothing to the record) over the inputs the case file carries, each first checked against its stated SHA-256, and the result recorded per calculation as `recreated` (every result agrees), `differs` (naming each result, the source's value and the recomputed one) or `not_recreated` (an input missing or differing from its hash, or a method version this copy does not hold, each named). The source's stated results are held only as the source's statement: no act of this module writes a `CALC-`, a money fact, or any record row from them, and a later use of the figure in this group's record is a member's own calculation over its own inputs (`calculations`).

**importedCases({viewer}), importedCase({import, edition?, viewer})** (`op=importedcases`, `op=importedcase`; member session; reads)

- **R4** `importedCases` lists every import with its source group, case, lens, editions and when each was imported. `importedCase` answers one import's editions, the latest by default, each with: (K5148; WALK-FINAL-10B R98) `importedCase` and `importedCases` carry the case's `scope` (its reading name), and each finding of an edition its `title` (the finding file's front matter, R31's rule), never only the ids.
  - for each finding, its role, its result with what is missing or what differs, and its recomputed pair;
  - the source's bar as the case states it, labelled as the source's and never as this group's (DEC-45);
  - each finding against this group's own bar. That is the group default (`strength.strengthBarOf` with no project, its R16), and with none set, that no bar is set (K1134 reading 3). The axis is reached or not, as `case-checker` R6 reads it, with `not_asked` for a supporting finding;
  - its origin mark facts (DEC-92): `another_groups` (with the edition and whether its signature verified), the acceptance in force (by, when, why, what was checked, the gaps stated) or none, and the open flags;
  - the statement that recreating shows the case intact and consistent, not true (`case-checker` R1's `statement`);
  - each calculation the edition carries, with its result as recreated here (R21) beside the value the source states, labelled as the source's.

  A `viewer` who is not an active member is answered as if no import exists, with the same bytes for each. It writes nothing. (DEC-112 (6); DEC-92; DEC-96 item 1)

  (T46; N903; K2832; `public-read` R34; `conformance` R32) The source group's public identity and declared stake are recorded at import and answered here, since they are never in the signed edition or the case file's bytes (`public-read` R34, R23).
  - **At import.** `importCaseFile` (R1) also takes `groupFields`: the `group_fields` of the source's `publishedCase` answer for that case (`public-read` R34: `group`, `name`, `domain`, `domain_verified_at`, `stake`, `detail`), with `read_at`, the instant the caller read them. They are recorded with the edition when R1 first records it, as the source's own statement current at `read_at`: unsigned, never verified as part of the edition, never this group's. A repeat of the same edition (`existed: true`) writes nothing. Fields that are absent, not in R34's shape, or whose `group` is not the slug the manifest names, are not recorded, and the import is never refused for them.
  - **In the answer.** `importedCase` answers, per edition, `group_fields: {group, name, domain, domain_verified_at, stake, detail, read_at}`, labelled as the source's declaration current when read, never as of the edition's signing; an edition recorded without them (before T46, or with none given or none recorded) answers `group_fields: null` with a sentence saying why, never a guess, so `conformance` R32 reads `identity: null, stake: "undetermined"` for it.

  Control: an import given the source's fields answers them with `read_at`; the same import without them answers `group_fields: null` with its sentence; fields naming another group are not recorded.

**completeImportedDocument({import, edition, bytes, by, viewer})** (`op=caseimportdocument`; mutating)

- **R5** It applies R1's first two refusals. Bytes whose SHA-256 matches a material that an edition of this import records as missing are stored, and every finding of that edition is re-checked (R3). A calculation's input (R21) counts as missing here when the case file does not carry it or carries it with bytes that differ from its stated SHA-256 (K1828; as `case-checker` R9 fills it), so supplying its bytes completes the calculation and R21 recreates it. Bytes matching no missing material are `IMPORT_DOCUMENT_NOT_MISSING`, naming the fingerprint they have. Nothing else about the edition changes. (Publication §5C "a fetched document that matches its fingerprint completes it")

**acceptImported({import, edition, findings, checked, reason, gaps?, by, viewer})** (`op=importaccept`) **and withdrawAcceptance({import, edition, reason, by, viewer})** (`op=importacceptwithdraw`); mutating, each a reasoned act

- **R6** Refusals, in order, each writing nothing:
  - R1's first two refusals;
  - an edition this import does not hold is `IMPORT_NO_SUCH_EDITION`;
  - `checked` (what the member checked) or `reason` absent, blank or over 2,000 characters is `IMPORT_ACCEPT_NO_REASON`;
  - a finding not in the edition is `IMPORT_NO_SUCH_FINDING`;
  - a finding whose result is `did_not_recreate` is `IMPORT_ACCEPT_NOT_RECREATED`, naming each one;
  - a `recreated_in_part` finding for which `gaps` does not state each missing entry in the member's words is `IMPORT_ACCEPT_GAPS_UNSTATED`, naming each gap left unstated.

  Otherwise the act records the acceptance of that one edition for those findings, with `by`, the instant, `checked`, `reason` and `gaps`. It changes no grade: the edition's grades stand as published. A later edition of the same case reads as another group's until it is accepted. The answer names, for each accepted finding, its imported finding reference (`inquiry-grammar.importedFindingRef`), the spelling a leg names. (DEC-96 item 1; DEC-112 (6): "only for findings recreated, or recreated in part with the gaps stated"; N522)
- **R7** `withdrawAcceptance` applies R1's first two refusals and R6's `IMPORT_NO_SUCH_EDITION`. It refuses `IMPORT_ACCEPT_NO_REASON` for a missing `reason`, and `IMPORT_NOTHING_ACCEPTED` when no acceptance of the edition is in force. Otherwise it records the withdrawal with `by`, the instant and `reason`. The acceptance stays in the history, corrected forward and never erased. After the withdrawal commits, it calls `reevaluation.acceptanceWithdrawn` (its R31). The reply carries that answer as `reevaluation`. A failure there never undoes the withdrawal and is named in the reply (`reevaluation` R8's `listeners_failed`). (DEC-96 item 1; N522)

**flagImported({import, edition, finding?, issue, by, viewer})** (`op=importflag`) **and clearFlag({flag, reason, by, viewer})** (`op=importflagclear`); mutating, each a reasoned act

- **R8** A flag is a member's recorded evaluation naming the specific issue, never a machine's. Each act applies R1's first two refusals. An `issue` or `reason` absent, blank or over 2,000 characters is `IMPORT_FLAG_NO_ISSUE`. An edition or finding not held is `IMPORT_NO_SUCH_EDITION` or `IMPORT_NO_SUCH_FINDING`. Clearing a flag that is not open is `IMPORT_FLAG_NOT_OPEN`. A flag records `by`, the instant and the issue. A clear records `by`, the instant and the reason, and the flag stays in the history. Flags are seen only by those who may see the import (R4), and never on a public path, except as a published case of this group discloses an open flag on work it relies on (`case-disclosures` R14; DEC-96 item 4). (DEC-96 items 2, 4; N522)

**acceptanceOf({import, edition, finding}), openFlagsOn({import, edition})** (services for later modules)

- **R9** `acceptanceOf` answers the acceptance in force for a finding of an edition (by, when, why, what was checked, the gaps) or null. `openFlagsOn` answers the open flags with their issues. They are read as the plane. They are the one answer to "is this accepted or flagged" for every later module, including a case of this group that rests on accepted work. `case-disclosures` R13–R14 now read it, for `case-authoring` (its R55). (DEC-96 items 1, 2, 4; N522)

**Whole-case acceptance and the importer's lens** (T41; N820; `draft-T41-investigation.md` §3.6; K2405, K2417, K2418; D59, D62)

- **R22** (D62) `acceptImported` takes `findings: "all"`: one act, one reason, accepts every finding of the edition that `recreated` (and `recreated_in_part` ones with gaps stated, R6) and answers the findings not accepted, listed with why; each accepted finding as R6 records it.
- **R23** (D59, D62; K2471) R4's assessment also answers each finding under the importing group's own lens, beside the source's lens and the importer's bar. That lens is `case-checker` R23's reader lens: its `statements` are the group statements in force (`bias.statementInForce`, its R49, at scope `instance`, with the importing member as viewer), and its `applications` are the carried `case-grammar` R24 rows whose statement is in force there; a carried application whose statement is not in force there reads as removed. An answer of `null` (undetermined) is stated, not read as false. An accepted finding stays read-only evidence marked as another group's, never stronger than its edition.

**Regrade and rerun** (T51; K4169; UC-076; Declared Bias "Differential traversal", "Regrade (mechanical)", "Rerun (human)"; Investigation §11; D59; `archive/draft-req-T51-K4169.md` §2). The lenses are three, settled by canon: as published, bias removed, the reader's own (R23's). Two details are BOB's (K4169): the rerun comparison (R31) reads the rerun project's own effective lens (project scope, `bias.biasManifest`) as "own", since the rerun is the project's work; and a `null` (undetermined) lens is stated, never read as false (R23). Nothing here is sent to the source group (`BIO_Publication_v0_1.md` §5D: nothing is pushed).

- **R27** (K4169; D59) **`regradeImported({import, edition, lens, viewer})`** (`op=importregrade`; member session; a read). `lens` is `as_published`, `removed` or `own` (R23's reader lens). A `viewer` who is not an active member, an import not held and an edition not held are answered as R4 answers (`IMPORT_NO_SUCH_EDITION`, the same bytes as no import; the draft's `NO_SUCH_IMPORT` is this one answer). Another `lens` is `REGRADE_LENS_UNKNOWN`, naming `lens`. Otherwise it answers, per finding of the edition in the edition's order, from `case-checker.reweigh` (its R23): the finding's pair and `bar_met` as the source published them (`as_published`); its pair under `lens`; `against_own_bar` and `against_source_bar` under `lens` (R4's reading against this group's bar and against the source's, labelled as R4 labels them); `moved` (true when the pair or either `bar_met` differs from the published one); and, for each statement that made the difference, `because: [{statement, kind, subject, text, touched}]`, `touched` being the leg, inference or conclusion the case file's application of that statement records (`case-grammar` R24: its target, `ord`, effect, `from` and `to`) and nothing guessed, `kind`, `subject` and `text` the statement as the edition prints it (`case-grammar` R9's `lens_statements`; null where the edition prints none). A finding the file records no application for answers `moved: false` and `because: []`, with the sentence that nothing in the lens touches it. Every answer carries the limit sentence of `case-checker` R23 ("A re-check re-weighs the analysis that exists; it cannot write what another lens would have written"), read by its key. It writes nothing and never throws. Test: a fixture edition with one lowered grade: `removed` restores it and names the statement; `as_published` moves nothing. Control: a finding with no application is `moved: false`, `because: []`.
- **R28** (R23; `bias` R15) `lens: own`, when none of the statements the edition applies is in this group's lens (`bias` R49, at scope `instance`, with the viewer), answers the same findings as `removed` and says, by key, that this group's lens holds none of them (`lens_note`). A lens that cannot be read (R23's `null`: a statement the edition applies is asked of `bias` and answers `in_force: null`, or the re-weighing cannot be made) answers `lens: "undetermined"`, its sentence, and for each finding no `moved`, no pair under the lens and no `bar_met`, never false. Test: both. Control: with statements in force the `own` answer differs from `removed`.
- **R29** (Declared Bias "Rerun (human)") **`rerunStart({project, import, edition, by, viewer})`** (`op=rerunstart`; mutating) declares an existing project of this group a rerun of an imported edition. Refusals, in order, each writing nothing: `MACHINE_CANNOT_RERUN` (a machine, AI or operator credential, or an unstamped `by`); a project the viewer cannot see, one that is absent and one that is not a project, alike `NO_SUCH_PROJECT` (`membership` R78, relayed); the owner refusal of `membership` R55 and R122 (relayed; `PROJECT_ACT_NOT_THE_OWNER`); an import or an edition not held, and a viewer who is not an active member, `IMPORT_NO_SUCH_EDITION` (R4's absence: one condition, one code); `RERUN_ALREADY` for a project already declared a rerun of this edition (a different edition is allowed: one project may rerun a later edition). It records `{project, import, edition, by, at}` in a table of this module and nothing else: the import stays read-only (R2), the project's record is not touched, and the rerun is not an acceptance (R6) and not an endorsement. Test: an owner declares; each refusal. Control: a second declaration for the same pair is `RERUN_ALREADY`; for the next edition it succeeds.
- **R30** (the same) **`rerunPair({project, source_finding, own_finding, edition?, withdraw?, by, viewer})`** (`op=rerunpair`; mutating). The project's owner or a joined participant states that `own_finding`, a finding (inquiry bundle) of the project, answers the same claim as `source_finding`, an imported finding reference (`inquiry-grammar` R11's spelling) of an edition the project is declared a rerun of; `edition` names that edition, and absent it is the latest edition of that import the project is declared a rerun of. Refusals, in order, each writing nothing: `MACHINE_CANNOT_RERUN`; `NO_SUCH_PROJECT` (`membership` R78); `PROJECT_ACT_NOT_A_PARTICIPANT` (`membership` R55; it holds for the owner, a joined participant); `NO_SUCH_SOURCE_FINDING` for a `source_finding` that is absent or is no reference, naming `source_finding`; `NOT_A_RERUN` (the project is declared no rerun of that import, or of that edition); `NO_SUCH_SOURCE_FINDING` again for a finding the declared edition does not hold; `NO_SUCH_OWN_FINDING` (absent, not seen by the viewer, or not a finding of this project, alike; the project's findings are `basis-versions` R41's `projectQuestions`), naming `own_finding`. A pairing is append-only: `withdraw: true` appends its withdrawal, and the latest entry for a pair stands. One own finding may pair with several source findings and the reverse. Test: pair, withdraw, re-pair, read back in order. Control: an own finding of another project is `NO_SUCH_OWN_FINDING`.
- **R31** (the same; "the disagreement is localised to named lens differences") **`rerunRead({project, viewer})`** (`op=rerunread`; a read) answers a project's reruns to a viewer who sees the project at `FULL` (`membership.inSight`); any other viewer, an absent project and one that is not a project are answered `NO_SUCH_PROJECT`. Per declared rerun, in the order declared, and per source finding, in the edition's order: its `title` (K4259), read from the `title` of the imported finding's file `findings/<id>/finding.md` front matter through `fileOf`, `null` where the file or the title is absent and never the id (the case grammar defines no case-level title, so none is answered); the source's pair as published and the lens statements the edition's applications name for it (as R27 prints them); `paired`; for each standing pairing the own finding, its pair (`strength.strengthOf`, read at the read) and `agree` (true when the two pairs are equal on both the capture and the connection axis, false when they differ on either, `"undetermined"` when either pair is not graded on both axes); and, once per rerun, `lens_difference: {only_source, only_own, shared}`: the statements of the edition's printed lens that are not in this project's effective lens, those of the project's lens not in the edition's, and the count in both, a statement matching another by `kind`, `subject` and `text`; where either lens cannot be read it is `null` with its sentence, never an empty difference. The pairings' history is answered in order beside. Findings with no pairing answer `paired: false`. Every answer states that the disagreement it names is the lens difference computed from the two printed lenses and the members' pairings, not a cause the system established, and carries R27's limit sentence, both by key. It writes nothing and never throws. Test: a finding row carries its title, and one whose file states none answers `null` (control). A rerun with two source findings, one paired and disagreeing: the pairing shows both pairs, `agree: false` and the differing statements; the other `paired: false`. Control: with the lens statements equal `lens_difference` is empty, and `agree` is `"undetermined"` for an unrated own finding.
- **R32** (K4164 goal 1; K4168) **Invariants.** (a) Nothing here edits an imported file or finding, writes a record bundle, a bias statement or an acceptance, or sends anything to the source group. (b) An own finding is always the project's own and never takes the source's grade; a pairing never feeds `strength`. (c) The tables of R29 and R30 are declared whole to purge (R13). Test: a rerun and a pairing leave every imported edition's bytes, every acceptance and every finding of the project unchanged; both tables are in the purge declaration.
- **R33** (K4168, K4202; `op-declarations` R80, `op-grades` R49) **The ops are declared by this module.** Beside `caseImportOps` it exports `DECLARED_OPS`, the declaration of each op it serves that a screen sends or this tranche adds: `caseimport`, `importaccept`, `importacceptwithdraw`, `importflag`, `importwatch` and R27, R29, R30 and R31's `importregrade`, `rerunstart`, `rerunpair` and `rerunread`. Each row's class, `mutating`, weight and description are the op's existing rows' (`op-declarations`, `op-grades`) where it has them, and R32's table where it is new; `fields.accepts` is every field the op's arm reads from `url` and `body` (the stamps `viewer` and `by` excluded), `fields.requires` each field it refuses without. The four new ops are routed by `caseImportOps` with the stamps read from the query only. Test: `declaredOpHolds` on each of the nine (only its `requires` raise no refusal naming a declared field; without each one the op refuses naming it; a field outside `accepts` is dropped or refused naming it).

| op | fields | class | mutating | weight |
|---|---|---|---|---|
| `importregrade` | `import`, `edition`, `lens`, stamped `viewer` | `admin`, `member` sessions | no | read |
| `rerunstart` | `project`, `import`, `edition`, stamped `by`, `viewer` | `admin`, `member` sessions; `machineClasses: []` | yes | `reversible` |
| `rerunpair` | `project`, `source_finding`, `own_finding`, `edition?`, `withdraw?`, stamped `by`, `viewer` | `admin`, `member` sessions; `machineClasses: []` | yes | `reversible` (a withdrawal appends) |
| `rerunread` | `project`, stamped `viewer` | `admin`, `member` sessions | no | read |

**The registration it fills** (K31's pattern; `accepted-work` R1; N522)

- **R16** At start, the module registers with `accepted-work` (its R1) the following, each read as the plane:
  - `finding` (R4's facts for one finding at one edition, with R9's `acceptanceOf`);
  - `openFlags` (R9's `openFlagsOn`, the edition's own flags and the finding's);
  - `withdrawals` (R7's records, in order, paged);
  - `moves` (R18's publisher moves, in the order recorded, paged; `accepted-work` R8).

  The reads that take a viewer (`finding`, `openFlags`, and R24's `flagHistory`) answer null to a viewer who is not an active member, as R4 answers. `withdrawals` and `moves` take only `{after, limit}` (`accepted-work` R1, R8), name no viewer, and are answered as the plane. (DEC-96 items 1, 4; P4) (T48; N1020; K3113: worded as built)

- **R24** (T47; N947; K3033, K2949; amends R16; `accepted-work` R9; `case-carriage` R19) The registration R16 makes also carries `flagHistory({ref, edition, since, viewer})`, read as the plane: for the imported finding reference `ref` (`inquiry-grammar.importedFindingRef`) at `edition`, every flag R8 recorded on that edition, its own and the named finding's (as R16's `openFlags` answers them), that was open at any instant from `since` through the read (recorded at or before the read and not cleared before `since`), open now or cleared since, in the order flagged, each `{flag, finding, issue, opened_at, cleared_at}`: `opened_at` the instant R8 recorded the flag, `cleared_at` the instant of its clear, null while it is open; and `complete: true` when every such flag is answered. A `since` that is not an instant `record-core` stamps answers `complete: false` and no flags, so a reader fails closed. A viewer who is not an active member is answered null, as R4 answers. It writes nothing and never throws. So `case-carriage` R19's interval clause holds in the composed plane: a flag opened and cleared after a check was made is still seen. Controls: a flag flagged and cleared after `since` is answered with both instants; one cleared before `since` is not; one open is answered with `cleared_at: null`.
- **R25** (T50; N933; K3230, Bob's "N933: B"; `public-read` R36; amends R4's T46 amendment) The `groupFields` given at import may also carry `matter_stake`, in `public-read` R36's shape or `null`: the source's stake for the matter the case was made in, as it declared it when read. It is recorded and answered with the other fields (`importedCase`'s `group_fields`), labeled as they are: the source's declaration current when read, never as of the signing, never this team's. The six fields and `read_at` keep R4's shape check, and a key other than these and `matter_stake` is still `not_its_shape`. An absent `matter_stake` (a source before T50) reads `null` and is no fault; a malformed one is recorded `null` with a sentence saying why (`group_fields_note`, a key of `words.json`) and never makes the other fields unrecorded. The import is never refused for it. An edition recorded without any fields still answers `group_fields: null` with R4's sentence. Test: fields with a `matter_stake` are recorded and read back whole; fields without it still record the six fields and answer `matter_stake: null`. Control: a `matter_stake` that is neither an object nor `null` is recorded `null` with its sentence, the other fields intact; an unknown extra key is still not recorded.
- **R26** (T50; N1087, N1090; K3302; DEC-236 (B204 (2)); amends R4) `importedCases({viewer})` answers what the team's list of imported cases draws, with no read per case: each import carries `latest_edition`; each of its editions carries `importer` `{member, handle}` beside the unchanged `imported_by` and `imported_at` (the handle as `membership.memberFacts` gives it, `null` where none is held; the founder as `membership.founderHandle()`, R144, names her, with `founder: true`), and `findings`, `recreated`, `recreated_in_part` and `did_not_recreate`, counted over the latest recreation recorded for the edition (R3), each `null` where none is recorded. The order is today's. With no import held, or a viewer who is not an active member (answered as R4 answers), it is `imports: []`, `count: 0`: the list's empty state. It writes nothing. Test: two imports, one edition with a finding recreated in part: the counts, the importer's handle and `latest_edition` are answered. Control: a viewer who is not an active member gets the bytes of an instance with no import; an edition with no recreation recorded answers its counts `null`, not zero.

**watchImport({import, publisher, by, viewer})** (`op=importwatch`) **and unwatchImport({import, by, viewer})** (`op=importunwatch`); member session; each mutating (N534)

- **R17** Refusals, in order, each writing nothing:
  - R1's first two refusals;
  - an import that is absent, or one the viewer may not see, is `IMPORT_NO_SUCH_EDITION` (K1319's one answer);
  - for `watchImport`, a `publisher` that is not a public https locator (`record-grammar.isPublicHttpsLocator`), or that carries a query or a fragment, is `IMPORT_WATCH_BAD_ADDRESS`;
  - for `unwatchImport`, an import with no watch in force is `IMPORT_NOT_WATCHED`.

  Otherwise `watchImport` records a watch with `by`, the instant, `publisher` and the docket address. The docket address is `publisher` with the query `op=docketpublic&case=<the import's case, percent-encoded>&captures=omit`: the route `public-read` R21 and R25 serve, answering `docket` R24's public answer (T47; N951: was cited as `docket` R23, which states the addresses the docket itself answers, not this one). A watch with the same docket address already in force answers `existed: true` and writes nothing. A different address replaces the watch in force. `unwatchImport` records the end of the watch, with `by` and the instant. Every watch and every end stays in the history. A watch is never a default: an import is not watched until a member asks. A case is watched only once it is imported, since the import holds the case's id and keys, against which its entries are verified (K1339 F2: "cites or follows" read as imported). (DEC-101 (3): "can be configured"; Publication §5A)

**watchedImports({after, limit}) and recordDocketRead({import, docket, at, outcome, reason?, answer?})** (services for `monitoring`; read as the plane)

- **R18** `watchedImports` answers each watch in force, in import order after `after`, at most `limit` (1–200, default 200), with `cursor`. Each is `{import, group, case, docket, set_by, set_at, last_read}`, where `last_read` is `{at, outcome, reason}` or null. It writes nothing and never throws.

  `recordDocketRead` refuses `IMPORT_NO_SUCH_EDITION` for an unknown import. It refuses `IMPORT_NOT_WATCHED` when no watch is in force, or when the watch in force names another docket address. Each refusal writes nothing. Otherwise it records the read `{at, outcome, reason, entries_seen, last_entry}` and answers `{ok: true, outcome, new_entries, new_moves, new_refused}`. It never throws.
  - With `outcome: "unreadable"`, `reason` is kept as `monitoring` gives it.
  - With `outcome: "read"`, an `answer` whose `group` is not the import's group, or whose `case` is not the import's case, is recorded as `unreadable` with reason `not_this_case`. Otherwise each entry of `answer.entries` (`docket` R24) whose `seq` this import does not yet hold is checked, and it is recorded `verified` only when all three checks hold:
    1. **The digest and the form.** The SHA-256 of `json`'s UTF-8 bytes is `digest`. `json` parses to an object whose `format` is `civicsmith-docket-entry/1` or `civicos-docket-entry/1` (one format under two labels, `docket` R6; DEC-124, K1365), whose `group` and `case` are the import's, and whose `seq` is the entry's.
    2. **The signature.** `signatures.verifySshsig(signature, docketStatement(case, seq, digest), NS_DOCKET, …)` verifies against the key the signature embeds. `key_listed` is true when that key is among the keys that the manifest of any edition held in this import lists (`case-grammar` R13), and false otherwise. An entry signed by an unlisted key is kept and verified, labelled `key_listed: false`, and is never refused for it: refusing it would silently drop a real withdrawal signed by a newer manager's key, and silence must be earned (K1339 F3; `case-checker` R3's kind; `reevaluation` R21).
    3. **The chain.** `previous` is the digest of the held entry `seq − 1`, or null when `seq` is 1. When `seq − 1` is not held, the chain is `unchecked`, which does not refuse the entry.

    An entry that fails a check is recorded `refused`, naming the check. It is never a move. An entry whose `seq` is held with another digest is recorded `refused` with `differs: true` and both digests, and the held entry stands.
  - A verified `take-back` entry naming the `seq` of a move is stated beside that move as `taken_back`.
  - After the read commits, the act calls `reevaluation.citedCaseMoved({move})` (its R33) once for each new move. A throw there never undoes the read, and the answer names it under `listeners_failed`.

  (DEC-116 items 6, 8; DEC-101 (3); signatures R39, R40)

**What a member reads** (N534)

- **R19** `importedCases` and `importedCase` (R4) also answer, for each import:
  - `watch`: `{docket, set_by, set_at, last_read}`, or null;
  - when `last_read.outcome` is `unreadable`, `docket_unreadable`: `DOCKET_UNREADABLE`'s sentence ("Could not read the publisher's docket"; `docket` R15) with the reason and the instant, never a statement that nothing changed;
  - and, per edition, `publisher`: the newest `edition` move (its edition, `date`, `what_changed`, `key_listed`), the `withdrawal` move covering that edition by `reevaluation` R33's rule (its `seq`, `date`, `reason`, `key_listed`), each with `taken_back`, or null. A `publisher` of null means only that no move has been seen, and the answer says so together with `last_read`.

  Every entry seen, verified or refused, is answered in order under `docket_entries`. A non-member is answered as R4 says. (DEC-116 item 8: "never that nothing changed")
- **R20** `watchItems({viewer})` (a service for `queue-producers`, read as the plane) answers the following, each naming the import, its group and case, and the watch's `set_by`:
  - `entries`: each verified entry seen, of any kind, with its `seq`, kind, edition, `date`, `key_listed`, the instant this copy read it (`seen_at`; N546) and, for a move, `what_changed` or `reason`;
  - `refused`: each refused entry, with its `seq`, the check it failed and `seen_at` (N546; K1419);
  - `unreadable`: each watch in force whose latest read is `unreadable`, with the reason and the instant.

  A viewer who is not an active member is answered empty. It writes nothing and never throws. (DEC-101 (3): "telling the members"; K1339 F1: a verified entry that is not a move reaches only the watch's setter, through `queue-producers` R35)

  **Settled readings of R16, R18–R20** (CASE-IMPORT #2's questions, K1381, K1383): (1) R18 skips an entry when this import already holds one with the same bytes served (`seq`, `digest`, `json` and `signature`; verified or refused), so a refused tampered copy never hides the genuine entry served later; a `seq` held by a verified entry with another digest makes the new one `refused`, `differs: true`, both digests; a `seq` held only by refused entries is checked afresh. (2) `new_entries` counts every entry the read newly recorded, `new_moves` and `new_refused` being parts of it; `entries_seen` is the length of `answer.entries`, `last_entry` is `answer.last_entry`. (3) `outcome: "read"` without an object carrying an `entries` list is recorded `unreadable`, reason `not_a_docket`; any other outcome than `read` or `unreadable` is `unreadable`, reason `outcome_unknown`; a missing or unreadable `at` is this copy's instant. (4) R19's `publisher.edition` is the newest `edition` move naming an edition later than this one (R33 (a)'s rule); `publisher` is `{edition, withdrawal}`, each null when none, itself null when neither, with `publisher_note` saying no move has been seen, beside `last_read`. (5) R20's `entries` and `refused` cover every entry seen for each import, also under an ended or replaced watch, each naming the `set_by` of the watch whose read saw it; `unreadable` covers watches in force only. (6) R16's move ids are `IMM-<n>`; `after` null or `""` starts from the first.

#### T53 additions

- **R34** (T53; DEC-461; amends R1) **The new format imports, and its statement is recorded.** A case file whose document is of the new format imports as an earlier one (manifest check unchanged) and records with the edition `ungraded_passages` as the document states it: `{stated: true, rows}` (empty with no block) or `{stated: false}` for an earlier format. The source's statement, once, append-only (R12), never recomputed or filled; the block never makes an edition "differ" (R1's hash is the manifest's) and never refuses an import. Test: two rows record two; earlier format `stated: false`; re-import `existed: true`. Control: no block is `stated: true, rows: []`, not `stated: false`.
- **R35** (T53; DEC-461; amends R4, R26) **A member reads what the source published ungraded.** `importedCase` answers per edition `ungraded_passages: {stated, count, rows}` and per finding its rows `{ord, content_id, title}`, labelled the source's statement, never this group's grade (R11); `stated: false` reads "the source does not say" by key, never none. `importedCases` carries `ungraded_count` per edition (null when not stated). A non-member gets the bytes of no import. `accepted-work`'s `finding` read carries them. Test: editions with 2 rows and earlier format: counts 2 and null. Control: non-member bytes equal an instance with no import; accepting a finding with a listed passage succeeds and changes no grade or bar reading; no composed strength (R10).

## Private

### Uses

- `record-grammar`: canonical JSON, `isMachineIdentity`, `createSha256`; `isPublicHttpsLocator` (R17; N534).
- `record-core`: `transact`, `stampInstant`, `declarePurge`.
- `membership`: the session stamp and whether a viewer is an active member.
- `strength`: `strengthBarOf` (its R16; R4).
- `case-grammar`: `caseFileManifestCheck`, `methodOf`, `materialsOf` (its R11–R13).
- `case-checker`: `checkCaseFile` (its R1), whose `calculations` (its R20) R21 compares with its own recreation. (T41) Its `lens` (its R23; R23 here).
- `bias` (T41; D59; K2471): `statementInForce` (its R49; R23). A new `modules.json` edge; `bias` is earlier (layer 5).
- `calc-grammar` (T33-67; K2534): `evaluate` (R21).
- `inquiry-grammar`: `importedFindingRef` (its R11; R6).
- `accepted-work`: `registerAcceptedWork` (its R1, with its R8's `moves`; R16; with its R9's `flagHistory`, R24, T47).
- `reevaluation`: `acceptanceWithdrawn` (its R31; R7); `citedCaseMoved` (its R33; R18; N534).
- `signatures` (N534): `verifySshsig` (its R2), `NS_DOCKET` (its R39), `docketStatement` (its R40), for R18's check 2.
- `docket` (N534): `DOCKET_UNREADABLE` (its R15), for R19; the public answer's form (its R24) that R18 reads, and the entry format's two labels (its R6).
- (T51; K4169) `membership`: `inSight`, `noSuchProject` (its R78), `projectAuthority` (its R55, R122) for R29–R31. `strength`: `strengthOf` (R31). `bias`: `biasManifest` at project scope (its R15, R31). `basis-versions`: `projectQuestions` (its R41, R30). `case-grammar`: `lensOf`, `lensStatementKey` (its R9) and `biasApplicationsOf` (its R24, R27). `test-support`: `declaredOpHolds` (the tests of R33).
- `public-read` (G50, fix round 6; tests only): `buildCaseFile` and the container writer, which make the `/4` case file that `g50-import.test.mjs` imports (the discriminated paths of two captures of one `ref`). No call is made to it from the module.
- `public-read` (T46; N903): the shape of R34's `group_fields`, which R4 records as the caller hands it; no call is made to it. Its user: `conformance` reads R4's `group_fields` (its R32).
- `case-grammar` (T53; A5 (DEC-461)): the `ungraded_passages:` block reader `ungradedPassagesOf` (its R36), for R34 and R35.

### Invariants

- **R10** No answer composes a case-level strength or a trust score. Origin marks are never composed with grades (DEC-92, DEC-44).
- **R11** The source's bar is never stated or used as this group's (DEC-45). An acceptance changes no grade (DEC-96 item 1).
- **R12** Every act is append-only. An import, its results, acceptances, withdrawals, flags and clears, and its watches, their ends, docket reads and entries seen, are never edited or deleted by any act of this module.
- **R13** This module's tables are declared to `record-core`'s purge as the import's own record (K23). The stored case-file bytes are purged with their import. The watch, read and entry tables are the import's own record, purged with it.
- **R14** Each refusal carries its row in this module's own table (`checks.mjs`), a new family, its number given by `promotion`'s stamp. The translations are drafted by BOB and stamped by promotion. A change moves `CATALOG_VERSION`. (T51; K4169) Six more rows follow, C-130.17 onward, awaiting promotion's stamp, their sentences written once by `localize` (a row's key list is the design stream's): `MACHINE_CANNOT_RERUN` (R29, R30), `RERUN_ALREADY` (R29), `NOT_A_RERUN` (R30), `NO_SUCH_SOURCE_FINDING` (R30), `NO_SUCH_OWN_FINDING` (R30), `REGRADE_LENS_UNKNOWN` (R27). Two new rows of the family C-130, stamped by promotion (N534):
  - C-130.15 `IMPORT_WATCH_BAD_ADDRESS`: "That is not the public https address of the publishing group's copy. Give the address of their copy, with no query and no fragment. Nothing was written."
  - C-130.16 `IMPORT_NOT_WATCHED`: "This imported case is not being watched, so there is no watch to end. Nothing was written."
- **R15** No place is named in this module's behaviour or outward text.
- **R36** (T53; DEC-461; invariant) **The source's ungrading is not this group's.** The statement changes no result (R3), acceptance (R6), flag (R8) or re-evaluation cause; this group's own case resting on accepted work lists only its own ungraded passages. Test: accept a finding with a listed passage, run case-disclosures R35 on an own case resting on it: none of the source's listed. Control: an own ungraded passage in that case is listed.

### Satisfies

- DEC-112 response 4 (6), with response 2, as K1134 (2) readings 3–5 read it; `BIO_Publication_v0_1.md` §5C ("Import"); `BIO_Complete_Roadmap_v5.md` §11 (import before acceptance).
- DEC-96 items 1 and 2 (the accept, withdraw, flag and clear acts); DEC-92 (the origin mark's facts for imported work); DEC-45, DEC-46 (3). K1256, K1257 (the module).
- DEC-96 item 1's withdrawal notice and item 4 (R16, R7; N522, K1273).
- DEC-101 response 3; DEC-116 item 8 (the citing copy, 'Could not read the publisher's docket'); `BIO_Publication_v0_1.md` §5A, §5D: R17–R20 (N534; K1339, K1366).
- `BIO_Action_v0_2.md` §4 rule 21 (the group's public identity and declared stake; Actions D16, D16a, D28d), for another group's accepted finding (`conformance` R32): R4's T46 amendment (N903; K2832).

### Suggestions

- **Bytes.** Store the case file's bytes in the plane's object store under this module's own key prefix, as `provenance` keeps evidence, and never in SQL rows.
- **Grades.** The four acts are graded `reasoned` by `affordances` (DEC-96: "a reasoned act"). The grade of the import act and the completion act is BOB's at L11.
- **Tests.**
  - A clean import recreates every finding.
  - A re-import answers `existed: true`.
  - A tampered edition with the same id is `IMPORT_EDITION_DIFFERS`.
  - An in-part acceptance without gaps is refused, and with gaps is accepted.
  - A `did_not_recreate` finding cannot be accepted.
  - A withdrawal leaves the history intact.
  - A non-member reads byte-identical absence.
  - No answer carries a composed strength.
  - Every refusal has a negative control.
- **The docket watch (N534).** For R18's check 2, pass the manifests' keys to `verifySshsig`. On `UNKNOWN_KEY`, verify again against the `keyB64` it names, and record `key_listed: false`. Tests:
  - a verified run of entries;
  - a tampered `json`;
  - a signature in another namespace;
  - an unlisted key, which is verified with `key_listed: false`;
  - a broken `previous`;
  - a re-served `seq` with another digest;
  - an entry with the old label `civicos-docket-entry/1` verifies as one with `civicsmith-docket-entry/1`;
  - `not_this_case`;
  - a non-member reads absence;
  - each refusal, with a negative control.
