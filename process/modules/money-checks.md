Length: 81 lines. Last section: "Suggestions".

# money-checks: requirements

Next number: 18

**Size (P6).** About 600–1,000 lines (est. 15 requirements). Under 4,000.

## Public

### Purpose

Checks over money facts that raise questions, never verdicts. An **amount check** compares held facts with each other on one contract or one progression instance (committed against paid, a signed amount against its award, change orders against the award). A **detector** is a data-defined pattern the machine runs on its own over the facts held (K1491), with its denominator and cited derivation; its results are held in a table and reach the queue only as "Noticed", the machine's, in the hypothesis layer, and none is shown before its false-alarm rate is measured. Nothing here is a fact, a finding about a person, or a score standing for a judgment.

### Provides

Terms. A **detector** is `{detector_id, version, label, population, condition, denominator, derivation, origin: shipped | member, by}`: `population` a filter over money facts, `condition` a closed `calc-grammar` recipe, `denominator` the population it is counted over. A **result** is `{result_id, detector_id, version, subject, numerator, denominator, derivation, inputs, at}`; `subject` is a money fact, a money set, a contract or a pattern over facts, never a person. A **gate** is a detector version's measured false-alarm rate on a named gold set. The viewer, the refusal shape and `by` are as in `entities`.

**junctionCheck({progressionKey, entityId, viewer})** (`progressions` R32, moved; Framework §8.2)
- **R1** [met] A junction check is data over a progression instance (`progressions`' read of the instance) and its money facts (`money`): a signed amount differing from the award, and amendments (change orders) past a stated share of the award; the amount-free checks (one response, a payment placed after the term) are `progressions`' R31–R32 (K1521, K1563). The award and signed stages are the check's parameters `award_stage`, `signed_stage`. Shown at once, as member-declared (K1505 (8)). Each answers `{check, holds: true | false | undetermined, why, derivation}` with the facts and stages it read, as a question shown as "Noticed", never a violation. It is derived on read and never stored.

**amountChecks({contract, viewer})**
- **R2** [met] Over `money.committedAgainstPaid` for the contract: paid above committed, a signed amount differing from its award's, and change orders summing above a stated share of the award each answer as R1's shape, with the facts read and both sums. A comparison `money.summable` refuses is answered as that refusal, not a check.
- **R3** [met] A threshold or share a check reads is a parameter stated in the check's definition with its citation (a held standard or the member's own word), never a default the module assumes. A check with none answers `undetermined: "no threshold stated"`.

**defineDetector({label, population, condition, denominator, derivation, by}), switchDetector({detectorId, project, on, by}), detectors({viewer})**
- **R4** [met] `defineDetector` refuses `NO_LABEL`, `NO_POPULATION`, `BAD_RECIPE` (`calc-grammar`'s refusal of the condition), `NO_DENOMINATOR`, `NO_DERIVATION`, and a condition or population naming a person entity as its subject (`SUBJECT_IS_PERSON`). A member's definition is recorded as theirs; a change is a new version, earlier versions kept. Shipped detectors are data, versioned the same way. `defineDetector` is a member's act: an author that is not a member (a machine credential, `class:<cls>`, or none) is refused `MEMBER_ACT_ONLY` before any other refusal, and nothing is written; shipped detectors are the module's own data and are not defined through it (N618).
- **R5** [met] `switchDetector` is a member's act per project (`MEMBER_ACT_ONLY`; `NO_SUCH_DETECTOR`; `NO_PROJECT`), held only by a participant of the project: an administrator's sight is never a position (`membership` R60), so a viewer whose sight is existence only is refused `PROJECT_SEEN_NOT_A_PARTICIPANT` through `membership.existenceAct` (R77), and any other non-participant through `membership.notAParticipant` (R87) (MONEY-CHECKS #4 J1, K2467); a detector switched off for a project raises nothing for it. A detector is **switched on** for a project only when the latest `switchDetector` act for that project switched it on; with no act it is off, and `detectors` answers that default (K1787). `detectors` answers every detector with its versions, origin, gate and per-project switch.

**runDetectors({budgetMs?, cursor?})** (the scheduler's consumer, registered by `scheduler`, T33-80)
- **R6** [met] Runs each detector over the facts held, in slices within `budgetMs` on the one alarm, answering a cursor to resume; it is a computation, never a model run. Each run writes its results, keyed by (detector, version, subject, inputs), so a rerun over unchanged inputs writes nothing new. Without `budgetMs` it runs within its stated default budget of 1,000 ms (as `duties` and `people` state theirs); a `budgetMs` that is given and is not a number above zero is refused `NO_BUDGET`, and nothing runs (N604). It runs only detectors switched on (R5) for at least one project: a detector switched on in no project is skipped, run over nothing and leaving no work due, so an instance where no project switches a detector on keeps no detector work for `scheduler` (N607).
- **R7** [met] A result carries its numerator, denominator and derivation with each input cited; a result with no denominator is never written.

**recordGate({detectorId, version, goldSet, falseAlarmRate, by}), noticed({project, viewer, limit})**
- **R8** [met] `recordGate` records a measured false-alarm rate for one detector version on a named gold set, with who and when; it refuses `NO_GOLD_SET` and a rate outside 0–1.
- **R9** [met] `noticed` answers, for a project, only the results of detector versions whose recorded rate is at most 20% (K1504) and that are switched on for it, each labelled as the machine's, "Noticed", with its derivation; every other result is withheld and not counted. Bounded 1–500 with `truncated`.
- **R10** [met] A result is never written on a person's or entity's row, never cited as a basis, never moves a grade or a finding, and no read answers it as a fact or as "conflict" (K1473, K1491).

**Its refusal rows** (DEC-49 arm A: a code is held once; N608, K1679)
- **R15** [met] A missing citation (R3's threshold or share, a detector's parameter) is refused `MONEY_CHECK_NO_CITATION`, no longer `NO_CITATION`, which `record-grammar` holds; `MEMBER_ACT_ONLY` stays this module's, the first family to hold it. Every row of its refusals carries as `check` a catalogue id once `promotion` stamps it, and null until then, never a requirement's name such as `"money-checks R2"` (as `events`' rows).

**onDetectorSwitchedOn(module, fn)** (`scheduler` R9's notice; N605, K1666)
- **R16** [met] One registration per module (a malformed registration, or a second by the same module, refused through `membership`'s `listenerRefusal`, its R81). After `switchDetector` switches a detector on for a project, each registered `fn({detector_id, project})` is called once, after the act's transaction, so `scheduler` arms its `money-detectors` wake at once instead of at the next local day. A switch that leaves the detector as it was, or switches it off, notifies nobody. A throwing `fn` never undoes the act or stops another listener.

**The hint's mark** (T35-33; N694, K1863; DEC-131)
- **R17** [met] Every answer this module labels "Noticed" that an op relays to a member carries the mark `"Hint · machine work"` (DEC-131's words, exactly, with its middle dot) as `mark`, beside its `label`, which stays `"Noticed"`: each check of `junctionCheck` (R1, `op=moneyjunction`), each check of `amountChecks` (R2, `op=moneyamountchecks`) and each item of `noticed` (R9, `op=moneynoticed`), and the answer that carries them. Any member-facing sentence such an answer composes (a `why`, a derivation's words) calls what the machine raised a "hint", never a "signal". No key, code, `kind` or field is renamed; an answer that is a refusal carries no mark.

**The ops map**
- **R11** [met] The module publishes `moneyChecksOps(checks, url, body)`, one route arm per act and read above; one append site, stamped by the control plane. `op=moneydetectorsrun` runs R6 only for the machine (`class:daemon`) or an administrator; any other author is refused `NOT_AN_ADMIN` through `membership.notAnAdmin` (its R84), and nothing runs (N618).

## Private

### Uses

- `record-grammar`: `isHypothesisId` (R12).
- `calc-grammar`: recipes, comparison, exact decimals (R2, R4, R6).
- `record-core`: `transact`, `declareTable` (R6, R13).
- `membership`: `viewerPredicate`, projects (R5, R9, R13); `notAnAdmin` (R11), `listenerRefusal` (R16) (T34); `existenceAct`, `notAParticipant`, participation (R5, R13; K2467).
- `progressions`: the instance read (R1).
- `money`: facts, `summable`, `committedAgainstPaid`, the read contract (R1, R2, R6).
- `events`, `civil-time` (not in the plan's list): sequence and dates for payments past the term and payments before approval (R1). *(new edges; BOB's)*

### Invariants

- **R12** [met] No `HYP-` id is an input, subject or parameter of a check or detector (K1467).
- **R13** [met] Sight: a result is answered only to a viewer who may see every input it cites; results inside a hidden project stay fenced and uncounted (K1489). A read naming a project the viewer sees at existence only (`noticed` among them) is answered `PROJECT_SEEN_NOT_A_PARTICIPANT` through `membership.existenceAct` (R77; C-70.1 minted only there), never `NO_SUCH_PROJECT` (K2467). The results table is declared through `record-core.declareTable` as derived-rebuildable from its detectors and inputs.
- **R14** [met] No result, label or text says "violation", "breach", "conflict", "suspicious" or ranks a person; a detector's output is a signal with its method, inputs and measured rate (K1473). No place is named in behaviour or defaults.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §5C.4 L3, §5C.5 L4 (detectors, K1491), §2 "Cross-cutting rulings" (machine checks), §10 (machine signals live in the hypothesis layer; a due threshold raises a question, never a violation; the machine never concludes; one home per fact).
- `docs/architecture/BIO_Content_Framework_v0_10.md` §8.2 (junction checks; progressions R32's source).
- Bob's rulings K1471, K1473, K1491; BOB's K1504 (the 20% gate).
- DEC-131 ("Hint · machine work", "hint" never "signal"; K1863, N694): R17.

### Suggestions

- Factory `moneyChecksOf(ctx)` (K61). Tables `money_detectors`, `money_detector_versions`, `money_detector_switches`, `money_detector_results`, `money_detector_gates`.
- Op names are BOB's (T33-88). The "Noticed" queue item is `notice-producers`' (T33-82), reading R9.
- **T35 (T35-33).** The mark's string is DEC-131's; `notice-producers` (a later module) exports the same string as `HINT_MARK`, and its R11 marks the queue items it builds from R9. This module holds the string as its own export, and a test in this module's suite asserts it equal, character for character, to DEC-131's text. Tests name each of the three ops' answers with the mark.
- Open (BOB's): (1) the ladders place amount-free junction checks (one response; payments past the term by date) in `progressions` (§5C.4, R-2 M-E6), while Choices 11 moves R32 whole here: R1 keeps all four clauses here; BOB to confirm or leave the amount-free two in `progressions`; (2) whether R1's junction results are member-declared (shown at once, as `progressions`' findings are) or machine-raised (gated by R9); proposed: shown, since the member declared the flow; (3) who may `recordGate` (proposed: an administrator, recording BOB's desk measurement); (4) the shipped detector list (split contracts under a threshold, change-order growth, payments before approval, vendor concentration as a named quantity) and their gold sets are owed by M-C8.
