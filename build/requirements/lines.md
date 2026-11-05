# lines — requirements

**Status** · In force: a new product module, reviewed (K1505; T33-27; banner cleared K1577); its meaning the canon ladders' and Bob's rulings (K1441, K1443, K1452, K1453, K1455, K1464, K1470, K1487, K1489). Last changed T34 (T34-18: Terms, R1, R9; K1592); every requirement met (K1795). Last changed T48 (K3207: R23 new; one site for `NOT_A_PROCEEDING`, K231); marked not yet met (T48).

**Size (P6).** About 1,800–2,300 lines (constructs-2 §4.1). Under 4,000.

## Public

### Purpose

The dated, cited, graded lines between registered entities: the structure of bodies and offices (part of, reports to, oversees, appoints, funds, contracts with, acts for, responsible for, custodian of, successor of), who held each post and in what capacity, people's memberships, education, credentials, interests and ties, and the parties and links of proceedings. Lines are claims about the world, each with its assertion and each end's resolution graded apart. It answers the structure and the holder of an office as of a date, `undetermined` where the record does not settle it. It is the one home of `holderAt`. It holds no amount (money given is a money fact) and walks no chain (that is `explore`'s).

### Provides

Terms.
- A **line** is `{line_id, kind, from, to, role?, capacity?, title?, valid, basis, asserted_by, assertion, ends, at}`.
- **title** (on `holds` only): the post's title as the line's basis words it (a passage's words, a register row's own field, or the member's testimony), kept exactly as written and never normalised or mapped to a capacity; absent, the line answers `title: null`, "not stated". *(T34, N573)*
- **Kinds** (closed, revised only by spec, K1441):
  - structure: `part_of`, `post_in`, `holds`, `reports_to`, `oversees`, `appoints`, `seat_on`, `funds`, `contracts_with`, `acts_for`, `responsible_for`, `custodian_of`, `successor_of`;
  - people: `belongs_to`, `educated_at`, `credentialed_by`, `owns_interest_in`, `related_to`, `associate_of` (K1455: `related_to` without condition);
  - proceedings: `party_to`, `appeal_of`, `consolidated_with`, `remanded_to`, `arises_from`.
- **Capacity** (closed, on `holds` only): employee, elected, appointed, acting, interim, ex officio, board member, officer or director, partner, military service, volunteer, contractor, other.
- **Role** (closed per kind): `reports_to` takes `administrative`, `functional` or `budgetary`; `contracts_with` takes a party role of the OCDS party-role codelist; `party_to` takes a role from the profile's party-role vocabulary (`jurisdictions`). Other kinds take none.
- **valid** is `{from, to, precision, zone}`; each bound is a date-time value or `{event, edge}` (`edge` `start` or `end` of the event's `when`), never both; a null bound means "not stated", never "always" or "current". Its resolved instants are held in a `bound_cache`.
- **basis** is one of: a passage (`{captureSha, extent}`), a system rule (`{rule, source}`: the profile's office entry at setup, or a source-native register row, K1443), or a member's testimony (`{statement}`).
- **assertion** is the grade of the basis (a passage: its extent's capture grade; a system rule: its source's; testimony: D). **ends** is `{from, to}`, each end's resolution grade in the cited capture (`entities`), A for a scheme identifier, D for testimony. The two axes are always answered apart and never combined.
- The **viewer**, the refusal shape and `by` are as in `entities` (the control plane's stamps; DEC-52).

**recordLine({kind, from, to, role?, capacity?, title?, valid?, basis, by})**
- **R1** Refusals, in order: `UNKNOWN_LINE_KIND` (naming the closed list; the detail says money given or received is a money fact); `NO_ENDS`, `SELF_LINE`; each end `NO_SUCH_ENTITY` (`entities.noSuchEntity`); `BAD_ROLE` (a role outside the kind's list, or a role on a kind that takes none); `NO_CAPACITY` / `UNKNOWN_CAPACITY` (`holds` only; any other kind with a capacity is `BAD_CAPACITY`); `BAD_TITLE` (a `title` on a kind other than `holds`, or one that is not a non-blank string); `NO_BASIS` (each basis form's own refusal: R1 of `events` for a passage's capture and extent; `NO_STATEMENT` for blank testimony). Otherwise it allocates `LIN-<year>-<tail>` (`record-core`'s opaque allocator) and writes the line in one transaction with its `bound_cache`.
- **R2** End kinds: `seat_on` runs from an entity of kind `office` to one of kind `body` only (`SEAT_ON_ENDS`); `party_to`'s `to`, and both ends of `appeal_of`, `consolidated_with` and `remanded_to`, are of kind `proceeding` (`PROCEEDING_ENDS`). Other kinds take any registered kinds.
- **R3** A bound that gives both a value and an event is refused `BOUND_BOTH`; an event bound names a held event (`NO_SUCH_EVENT`) and an edge (`BAD_EDGE`); a value is validated by `civil-time` (`BAD_DATE`) and carries precision and zone, the zone by default the profile's. A `from` after its `to` (when `civil-time` settles it) is refused `BOUNDS_REVERSED`.
- **R4** The machine records a line only from a system rule whose two ends are identified by scheme identifiers (K1443: Legistar seats and holders; profile offices seeded at setup). A machine-stamped line with any other basis, or whose end resolves by name only, is refused `MACHINE_NEEDS_IDENTIFIERS`. A line from a name match is a member's act.
- **R5** A line whose basis is a Legistar register row records the source's own record instant and answers its bounds labelled "as recorded by Legistar on <instant>", never as the record's finding (M-P2 (c)).
- **R6** `bound_cache` holds each bound's resolved instants: a value as given, an event bound as that event's `when` edge (`events`' `when_cache`), unresolved (`null`, "not stated") when the event has no `when`. The module registers once on `events.onWhenChanged` and, in the same transaction, moves the `bound_cache` of every line bounded by the event whose `when` changed.
- **R7** A read of a line whose `bound_cache` differs from its rebuild fails closed: the line is answered with `valid: undetermined` with `why` the key `lines.why.cache_stale` and its fills (R24) and is not counted by R10 or R11.

**withdrawLine({lineId, reason, by}), readLine({lineId, viewer}), linesOf({entity, kinds?, direction?, limit, viewer})**
- **R8** `withdrawLine` refuses `NO_REASON` and `NO_SUCH_LINE`; a repeat answers `already: true` and writes nothing. A withdrawn line remains, shown withdrawn with who, when and why, and is never counted by R10–R13. A correction is a withdrawal and a new line. Nothing is deleted.
- **R9** `readLine` answers `NO_LINE` for an empty id and `found: false` for an absent one; otherwise every field above (a `holds` line's `title` among them, R1), its basis with its citation, both grade axes, its bounds as given and as cached, and its withdrawal if any. `linesOf` answers the lines with the entity at the given end (`from`, `to` or both), oldest first, each with every field above, bounded 1–500 (default 100) with `truncated` by reading one past.

**structureAt({entity, at, kinds?, viewer})**
- **R10** Answers the structure lines (structure kinds, or the given subset) at either end of the entity, each judged at `at` by `civil-time.validAt`: those `in` are answered as held, those `undetermined` are listed apart with why (an unstated bound, a band straddling `at`, an unresolved event bound), and those `out` are not answered. `at` is required (`NO_DATE`).

**holderAt({office, at, viewer})** (the one home)
- **R11** Refuses `NO_ENTITY`, `NO_SUCH_ENTITY`, `NOT_AN_OFFICE` (an entity not of kind `office`), `NO_DATE`. It counts only `holds` lines to the office (a line to an organisation is a career, never a holder). Exactly one counted line `in` at `at` answers `{holder, line, capacity, basis, assertion, ends}`. No line `in` answers `undetermined` with `why` the key `lines.why.no_line_covers`; two or more `in`, or any counted line `undetermined` at `at`, answers `undetermined` with `why` the key `lines.why.lines_disagree` (`{lines}`, the lines it names); never the most recent line by default.
- **R12** A holder is a `person` entity, the same entity across every role it has held (K1452); `holderAt` never answers text.
- **R21** (K1505 (10), K1577) A `holds` line with no stated end is `in` at a date no later than a held `current_through` (a member's, or a source's own "current as of" statement, recorded on the line with its citation and day) and `undetermined` after it; with none held it is `undetermined` after its start (civil-time R22). Recording one is a member's act or a system rule's (R4); a later one supersedes, the earlier kept.
- **R22** (T42; K2610; record-grammar R29; K231) Every refusal this module answers with the code `NO_BASIS` answers with `record-grammar`'s shared row C-33.40 (`SHARED_ACT_CHECKS`), its check, number and translation, never a bare code, so a member reads the one sentence every module gives for it.
- **R23** (T48; K231; K3207; amends R13) `partiesOf`'s `NOT_A_PROCEEDING` is `entities.notAProceeding`'s answer (its R53); this module mints no such code.
- **R24** (T51; N1250; K3870; PEOPLE #8 J2; `civil-time` R30; `people` R40; amends R7, R10, R11, R21) **Every reason is a key.** Wherever a read of this module answers a line, a holder or a state `undetermined` and says why, `why` is `{key, vars}`, never English, as `people` R40 expects: R7's stale cache `lines.why.cache_stale`; R11's `lines.why.no_line_covers` and `lines.why.lines_disagree`; R21's `lines.why.stated_current_through` (`{why, day}`, `why` the reason `civil-time` answers, a key with its fills, passed on and never flattened to a sentence); and every other reason of `structureAt` (R10), `holderAt` and `partiesOf`, each a `lines.why.*` row of the word table. A `neighbours` item's `undetermined.why` is `{key, vars}`, as `connection-grammar`'s contract judges it (its R6), with no `why_key`; a hub answer keeps its string `why` with `why_key: {key, vars}` beside it (its R20) (K3997). A reason with no row is a REPORT to BOB, never inline English. Test: each site answers an object with a string `key` that is a word-table row and a `vars` holding every fill the row names, and `word(key, vars)` is non-empty: a stale-cache line, a date after a stated current-through, an office with no line `in` and one with two. Control: no `why` of these reads is a string; the test asserts keys and fills, never a sentence's text.

**partiesOf({proceeding, at?, viewer}), proceedingLinks({proceeding, viewer})** (C1; scope §1 COURTS)
- **R13** `partiesOf` refuses `NOT_A_PROCEEDING`; it answers the `party_to` lines to the proceeding with their roles (as of `at` when given, by R10's rule). `proceedingLinks` answers the proceeding's `appeal_of`, `consolidated_with`, `remanded_to` and `arises_from` lines in both directions, one hop; a longer walk is `explore`'s.

**neighbours({node, kinds, at, page})** (the connection owner)
- **R14** The module registers once through `connection-grammar.registerOwner`, owner `lines`, one evidentiary kind per line kind (with `holds` by capacity), the members' words as `affordances` publishes them. `neighbours` answers the node's lines valid as of `at` (R10's rule; undetermined ones marked) in `connection-grammar`'s shape, both grade axes kept, from the indexes `(from, kind, bound_cache)` and `(to, kind, bound_cache)`, paged by `connection-grammar`'s bounds. It passes `connection-grammar.ownerConformance`. There is no `chain` read in this module.

**kinds(), capacities(), roles(kind)**
- **R15** Answer the closed lists above, frozen, for `affordances` to publish with the members' words (K1486).

**The ops map; the read contract**
- **R16** The module publishes `linesOps(lines, url, body)`, one route arm per act and read above, on `entities` R40's pattern; one append site, stamped by the control plane.
- **R17** The table of lines (`line_id`, `kind`, `from_entity`, `to_entity`, `capacity`, withdrawal) and its `bound_cache` (`line_id`, `from_instant`, `to_instant`, `precision`, `zone`) are a stated read contract on the terms of `record-core` R37 (`local-facts`' `part_of`, `strength`'s one issuing source, `query-language`'s `holder:`); every write stays this module's.

## Private

### Uses

- `record-grammar`: `ID_TABLE`, `isHypothesisId` (R1, R18).
- `civil-time`: date-time values, calendar validation, `validAt` (R3, R10, R11).
- `connection-grammar`: the shape, the owner registry and battery, the bounds (R14).
- `record-core`: `transact`, the opaque allocator, `declareTable`, the derived-cache convention (R1, R7, R19).
- `membership`: `viewerPredicate`, `listenerRefusal` (R19).
- `promotion`: `registerStep`, for lines projected from a capture's reading.
- `provenance`: whether a capture is held (R1).
- `entities`: `has`, `noSuchEntity`, kinds, scheme identifiers, `resolutionsFor` (R1, R2, R4, R11).
- `events`: `onWhenChanged`, the `when_cache` read contract, `readEvent` (R3, R6).
- `jurisdictions` (not in the plan's list): the party-role vocabulary and the default zone (Terms, R3). *(a new edge; BOB's)*

### Invariants

- **R18** One home per fact, checked at the store's gate: a line holds no amount; no `HYP-` id is an end or a basis; `holderAt` has no second implementation in any module; every `bound_cache` equals its rebuild. Structure is never written into `entities`' declared relations by this module.
- **R19** Sight (K1489): the registry is group-wide; a line whose basis is a passage follows that capture's visibility; testimony inside a hidden project is fenced and uncounted. The table is declared through `record-core.declareTable`, `bound_cache` derived-rebuildable.
- **R20** The machine never concludes from lines: no read answers "knows", a score, a rank, centrality or "most connected"; a count of one kind of line is the only figure (K1471). No place is named in behaviour, defaults or outward text.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2 ORGANISATIONS (lines a store of their own; two-axis grading; holders are people; `holds` with capacity; `holderAt` only to an office), §2 PEOPLE (every fact in its owner's home), §2 COURTS (party and proceeding families), §2 TIME (one validity value, event bounds, `bound_cache`), §2 CONNECTIONS (owner, indexes), §2 "Cross-cutting rulings" (sight), §5.4 L1 to L2, §5A, §7, §10 (declared relations walked as labels, lines evidentiary; one home per fact; world date-times carry precision and zone).
- Bob's rulings K1452, K1455 (people and ties), K1489 (sight); BOB's K1441 (closed kinds), K1443 (machine writes), K1453 (`sector`, organisations of every kind as ends), K1470 (the line model).

### Suggestions

- Factory `linesOf(ctx)` (K61). Tables `lines`, `line_bound_cache`, `line_withdrawals`.
- Op names are BOB's (T33-88): `linerecord`, `linewithdraw`, `line`, `linesof`, `structureat`, `holderat`, `partiesof`, `proceedinglinks`.
- Open (BOB's): (1) M-P2's staleness rule for Legistar seats (an open or future end with no recent `present`/`voted` participation) is not settled by the sources: R5 only labels; a rule would be a new requirement; (2) whether `post_in`, `funds` and the people kinds constrain their end kinds (the sources fix only `seat_on`'s and the proceeding families'); (3) the party-role vocabulary's home: proposed as profile data in `jurisdictions` (ECF and the CPUC service list are jurisdiction-specific), a new edge; (4) whether a member line may be adopted from a machine proposal (EXTRACT is stage 3, outside T33).
- Tests: two overlapping `holds` (R11 undetermined); an acting holder with an elected holder; a bound on an event whose `when` moves (R6, same transaction); a stale cache (R7); a machine line by name only (R4); a fictional profile's role vocabulary (R20).

- **R25** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `recordline`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
- **R26** (fix round 10; K5182; `audit-r10-1.md`'s undeclared ops; amends R25) `DECLARED_OPS` also declares `linewithdraw`, by R25's rules (its class, weight and description from its existing rows; `fields` the ones `withdrawLine` reads, `requires` the line and its reason as the arm requires them). Test `declared-ops.test.mjs` R26: its requires alone raise no refusal naming a field; without the line the refusal names it; a field outside accepts is dropped; `interface-shell`'s census reads `linewithdraw` declared.
- **F1** citation R28 (citation.md:57): the interest-line arm. When a cited row is removed (registers R30: content.cellsAt answers {cells:null, reason:'removed'}), an interest line built from that row reads it as removed (bio-plane/src/lines/vocab.mjs), with its words under words-unreviewed.
