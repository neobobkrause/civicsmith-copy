Length: 76 lines. Last section: "Suggestions".

# accepted-work: requirements

Next number: 10

**Size (P6).** About 250–400 lines.

## Public

### Purpose

A group's own finding may rest on a finding of another group's case that the group has accepted (DEC-112 (6); DEC-96 item 1). That work is held by `case-import`, late in the order. This module is the one place earlier modules read it. It also refuses a leg on such a finding unless an acceptance of the named edition is in force. It holds nothing itself.

### Provides

Terms.
- An **imported finding reference** (a **ref**) is `inquiry-grammar` R11's spelling.
- An **acceptance in force** is `case-import` R6's, not withdrawn by its R7.

**registerAcceptedWork(module, {finding, openFlags, withdrawals, moves?})** (K31's pattern)

- **R1** [met] One registration, filled by `case-import` (its R16) at start. A registration missing any of the three functions is refused `LISTENER_MALFORMED`, and a second registration is refused `LISTENER_DECLARED`. Both come through `membership`'s `listenerRefusal` (its R81). The three functions: - `finding({ref, edition, viewer})` answers `{ref, import, group, case, edition, finding, manifest_sha, result, pair, acceptance}`, or null when the finding is not held at that edition or the viewer may not see the import. `pair` is the finding's per-axis pair as the edition publishes it. `acceptance` is `{by, at, reason, checked, gaps}` while one is in force, else null. - `openFlags({ref, edition, viewer})` answers `{flags: [{flag, finding, issue, at}], complete}`. It covers the open flags on that edition, both the edition's own and the named finding's. - `withdrawals({after, limit})` answers `{withdrawals: [{withdrawal, import, edition, refs, at}], cursor}` in withdrawal order.

  The registration may also carry a fourth function, `moves` (R8). A registration without it is accepted. (DEC-96 items 1, 2, 4; DEC-101 (3))
- **R2** [met] `acceptedFinding`, `openFlagsOn`, `acceptanceWithdrawals` and `publisherMoves` (R8) take the same arguments and answer the registered functions' answers. - With none registered, each answers `{absent: true}`, stated as `accepted_work_absent`. - When the registered function throws, each answers `{unreadable: true}`.

  None of them writes or throws. They are the one way `strength`, `reevaluation`, `basis-versions` and `publication` read accepted work. (P4; DEC-96)

**acceptedLegRefusals({legs, viewer})**

- **R3** [met] For each leg whose target is a ref: - when R2 answers absent or unreadable, the leg is refused `ACCEPTED_WORK_UNREADABLE` (C-21.5); - when `finding` answers null, or answers `acceptance: null` at the leg's `target_edition`, the leg is refused `IMPORTED_NOT_ACCEPTED` (C-21.4).

  Each refusal is a finding naming the leg's `ord` and ref. Other legs are not asked. It writes nothing and never throws. (DEC-112 (6): "an accepted finding may support the group's own work"; DEC-96 item 1: acceptance names one edition)
- **R4** [met] At start, the module registers with `promotion` (`registerStep`, its R39) a check of every promotion of an inquiry that is not a replay. It runs R3 over each leg whose target is a ref and that is new against the held version, or whose target or `target_edition` changed. A refusal is `BASIS_REFUSED` with R3's findings, as `inquiry` R11 answers it, and nothing is written. An unchanged leg is not asked again, so a withdrawal never refuses an unrelated revision (DEC-96 item 1: a withdrawal sends notices, it does not move work).

**publisherMoves({after, limit})**

- **R8** [met] `publisherMoves({after, limit})` answers the registered `moves({after, limit})` (R1). That answer is `{moves: [{move, import, group, case, kind, edition, seq, date, at, what_changed, reason, key_listed, taken_back}], cursor}`, in the order this copy recorded the moves (`case-import` R18), with `limit` 1–200 (default 200). - `kind` is `edition` or `withdrawal`. - `edition` is a number, or `all` for a withdrawal of every edition. - `at` is the instant this copy recorded the move. - `what_changed` (for an edition) and `reason` (for a withdrawal) are quoted as the entry gives them. - `taken_back` is `{seq, date}` or null.

  With no `moves` registered, it answers `{absent: true}`, stated as `accepted_work_absent`. When the registered function throws, it answers `{unreadable: true}`. It writes nothing and never throws. (DEC-101 (3); DEC-116 item 8; P4)

**flagHistoryOn({ref, edition, since, viewer})** (T47; N947)

- **R9** [met] (T47; N947; K2949; amends R1; `case-carriage` R19) The registration (R1) may also carry a fifth function, `flagHistory({ref, edition, since, viewer})`; a registration without it is accepted, and one whose `flagHistory` is given but is not a function is refused `LISTENER_MALFORMED` (R1). It answers `{flags: [{flag, finding, issue, opened_at, cleared_at}], complete}`: every flag on that edition, the edition's own and the named finding's, that was open at any instant from `since` through the read (opened at or before the read and not cleared before `since`), whether open now or cleared since, in opening order; `opened_at` and `cleared_at` the instants the registered module recorded for the flag and its clear (`case-import` R8), `cleared_at` null while it is open. `flagHistoryOn` takes the same arguments and answers the registered function's answer, as R2 states for its reads: with no `flagHistory` registered it answers `{absent: true}`, stated as `accepted_work_absent`; when it throws, `{unreadable: true}`. So a reader (`case-carriage` R19) knows a flag opened and cleared inside an interval. It writes nothing and never throws.

## Private

### Uses

- `record-grammar`: `parseFrontmatter`, `normalizeType`, the finding shape.
- `membership`: `listenerRefusal` (its R81).
- `promotion`: `registerStep` (its R39).
- `inquiry-grammar`: `IMPORTED_FINDING_RE`, `parseImportedFindingRef` (its R11).
- `record-core`: `recordOf`, `readFile` (the held `bundle.md`, R4; K1304).

### Invariants

- **R5** [met] No table. Nothing here regrades, composes a strength or trust score, or states the source's bar as this group's (DEC-96 item 1, DEC-92, DEC-45).
- **R6** [met] Rows C-21.4 and C-21.5 are held in this module's own `checks.mjs`. `promotion` stamps them, and a change moves `CATALOG_VERSION`. - C-21.4 `IMPORTED_NOT_ACCEPTED`: "This finding rests on another group's finding that this group has not accepted at that edition. Accept that edition first, or take the leg out. Nothing was written." - C-21.5 `ACCEPTED_WORK_UNREADABLE`: "Another group's work this finding rests on could not be read, so whether it is accepted is not known. Try again. Nothing was written."
- **R7** [met] No place is named in this module's behaviour or outward text.

### Satisfies

- DEC-96 items 1 and 4, DEC-112 (6)'s last clause, read through the order (P4). N522.
- DEC-101 response 3 and DEC-116 item 8 (a cited case's new edition or withdrawal, seen on its publisher's docket, read by `reevaluation` through this seam): R8 (N534).

### Suggestions

- **T47 (T47-15).** R9's registered function is filled by `case-import` from R8's flags and clears, which it keeps whole; that registration is `case-import`'s act, not in its plan entry (T47-30) today. Until it is made, R9 answers `absent` in the composed plane and `case-carriage` R19's interval clause (a flag opened and cleared inside the interval) cannot be met in the composed plane: BOB is asked to add the registration to `case-import`'s T47 entry. `since` is passed as given; whether it is an instant is the registered module's to judge (an answer naming none it cannot judge is its own).
- Tests:
  - A leg on an accepted finding is promoted.
  - A leg on an unaccepted finding is refused C-21.4, and so is a leg naming another edition than the one accepted.
  - With nothing registered, the leg is refused C-21.5.
  - After a withdrawal, an unrelated revision of the same inquiry still promotes.
  - A second registration is refused `LISTENER_DECLARED`.
