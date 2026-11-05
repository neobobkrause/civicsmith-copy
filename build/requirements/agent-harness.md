# agent-harness — requirements

**Status** · In force: reviewed (K1505; banner cleared K1599). Split from `agent-worker` by copy (K617, K1439; T33-54), meaning unchanged: R1–R7 name their `agent-worker` ids, R8 new. Last changed T34 (T34-37: R9); every requirement met (K1808). Last changed T46 (T46-63: R10, `MODES.plan` deployed, K2892, K2920). Last changed T47 (T47-23: R2's public text re-worded, the deployed modes since `plan`'s deployment; N949, K2961); marked not yet met (T47). Last changed T50 (T50-66: R18, R19; K3637); marked not yet met (T50).

| old (`agent-worker`) | new | |
|---|---|---|
| R13 | R1 | `CONTROL_FLOW`, `nextStep` |
| R14 | R2 | `gate-mode` |
| R15 | R3 | `stopBecause`, the pass limit |
| R16 | R4 | judgements, `JUDGEMENT_OVERREACH` |
| R20 | R5 | the report contract |
| R50 | R6 | `PLAN_FLOW` |
| R41 | R7 | invariant: one sub-session per level |
| — | R8 | new: pure |

**Size (P6).** `agent-worker/src/harness.mjs` 1,253 lines and `subsession.mjs` 588 (entries C, facts checked): about 1,850. Well under 4,000.

## Public

### Purpose

The deterministic control-flow tables an AI run walks, and the contracts of what a sub-session is sent and may return, as pure functions: the table decides every step, the pass count and the stop; a judgement may fill only the fields it is allowed; a report is held to an exact shape. It calls nothing, reads no clock and holds no state, so the Worker shell (`agent-worker`) and any test drive it alike.

### Provides

Terms. A **run state** is the plain object the shell passes in and receives back. A **judgement** is the model's answer inside one judged row. A **refusal** is `{ok:false, reason, code, detail}` with `reason` equal to `code`.

The control-flow table (`CONTROL_FLOW`, `nextStep`, pure):
- **R1** (was `agent-worker` R13) Rows `gate-mode`, `resume`, `plan`, `fanout`, `collect`, `compose`, `dedup`, `submit`, `adjust`, `next-pass`, `close`; each declares the steps it may go to, and `nextStep` never returns a step outside them. There is no edge from `compose` to `submit` and none from `submit` back to itself on a refusal. An unknown step closes with `completed` and says so.
- **R2** (was `agent-worker` R14) `gate-mode` is first. A mode that is not deployed closes the run with bound `mode-not-deployed` at its first step, after only the run and log reads (`agent-worker` R9, R11) and before any fan-out, request or suggestion; its log entry and close are still written; its `why` distinguishes a mode the table holds and has not deployed from a word it does not hold, and names the deployed modes. The deployed modes are those `MODES` marks deployed, which agree with `run-rules`' `DEPLOYED_MODES` (R10): `check` and, since T46, `plan` (which walks `PLAN_FLOW`, R6); `investigate` and `extract` are not. (T47; N949: wording only, no behaviour moved)
- **R3** (was `agent-worker` R15) Above every row after the gate, `stopBecause` asks `fetches`, `subsessions`, `wallclock` in that order and closes on the first whose consumed ≥ its positive allowance; an absent or non-positive allowance never stops a run. Then pass count ≥ the pass limit closes `completed`. The pass limit is the run's `max_passes` when positive, else 3; a pass counts when it is done (`next-pass`).
- **R4** (was `agent-worker` R16) Judgements are taken in order, one per judged row (`plan`, `collect`, `compose`, `dedup`, `adjust`); a row with none carries the state on. A judgement naming `pass`, `maxPasses`, `step`, `budget`, `mode`, `bound`, `run`, `store` or `target`: 400 `JUDGEMENT_OVERREACH` with `step` and `fields`. Only `targets`, `reports`, `candidates`, `queue`, `adjusted`, `submission`, `level`, `observed`, `governed`, `condition` are applied.

The report contract (`checkReport`, pure):
- **R5** (was `agent-worker` R20) A report has only the keys `level, state, observed_at, summary, citations, governed, condition`; `level` and `state` are required; `level` is one of the four; `state` one of `NEVER_LOOKED`, `LOOKED_ABSENT`, `LOOKED_INDETERMINATE`, `PRESENT`, `partial`; every state but `NEVER_LOOKED` needs `observed_at`; `PRESENT` and `partial` need a citation; at most 20 citations, each exactly `{address}`, non-empty, at most 200 characters; `summary` a string of at most 500; the whole at most `REPORT_MAX_BYTES`. Each breach is refused by its own code (`REPORT_UNKNOWN_FIELD`, `REPORT_INCOMPLETE`, `REPORT_LEVEL_UNKNOWN`, `REPORT_STATE_UNKNOWN`, `REPORT_UNLOCATED`, `REPORT_NO_CITATION`, `REPORT_OVER_BOUND`, …).

Mode `plan`'s table (K660; `BIO_Action_v0_1.md` §4):
- **R6** (was `agent-worker` R50; §4 rules 1, 3, 8; K660 (1), (3)) Mode `plan` walks its own control-flow table, `PLAN_FLOW`, pure and held beside `CONTROL_FLOW`: rows `gate-mode`, `resume`, `read`, `compose`, `dedup`, `submit`, `adjust`, `close`; one pass (R3's pass limit is 1 for this table); `stopBecause` asks `proposals` then `wallclock`. It has no `fanout`: it calls no `airunspawn`, `capturerequest` or `suggest`, makes no fetch and drafts no communication.
- **R11** (R085-11; K3486 (B); R5) The spawn contract's `returns` carries `conditions`: the condition kinds `run-rules` admits (the vocabulary `checkCondition` checks), in a fixed order, so the sub-session's tool can offer them (`agent-model` R17). Test: a contract's `returns.conditions` is non-empty and each kind passes `checkCondition`; control: a kind not in it is refused by `checkCondition`.
- **R12** (R085-16; K3501 (C1, C3)) `spawnContract({level, payload, arms, targets})` adds two keys after `scope`: `subjects`, the payload's `subjects.items` (`ai-runs` R85) followed by `targets` (the level's targets the plan judgement named, each `{id, extent}` as given, `kind: "target"`), deduplicated by `id` and `extent`, at most 50, frozen; and `arms`, the meaning arms the caller passes (names, in the caller's order), frozen. An absent `subjects`, `targets` or `arms` gives an empty list. Test: a payload with two subjects and one target gives three, in that order, frozen; control: a duplicate of a subject among the targets appears once.
- **R13** (R085-23; K3510; `screens-inquiry` R39) An empty-level candidate's description (`emptyLevelCandidates`) names the target as "this question", never its record id. Test: a target `INQ-…` gives a description holding "this question" and not the id; control: its name stays `level-empty-<level>`.
- **R14** (R085-29; K3528; `walk-085-r5` item (e); extends R13) A candidate's member-facing text never carries the sub-session's free-text summary or any raw record id; the report and its words stay in the run log. Test: an empty-level candidate from a report whose summary quotes `INQ-2026-0002` and `INFO-2026-0006-council-minutes` has a description holding neither id nor the summary. Control: the candidate's name stays `level-empty-<level>`.
- **R15** (R085-29; K3529; `diag-085-slow` option 2; Bob, 2026-10-16: "there's no value in continuing at that point") A check run's `next-pass` closes the run, with condition `completed` and a log entry saying the pass added nothing new, when the pass just ended added no new candidate: every candidate it composed was dropped by `dedup` as already held, or it composed none. `maxPasses` stays the upper bound. Test: a pass whose candidates are all dropped as held closes before the next pass and logs why; control: a pass that submits a new candidate goes on to the next pass, below `maxPasses`.

**What a role needs, the part it belongs to, and the first recipient (T53; K5457)**

- **R20** (T53; AIR5, BR3) **`ROLE_NEEDS`, pure.** A frozen table from each role (`gate-mode`'s judged rows, `subsession`, `ask`, each draft kind, `transcribe`, `reading`, the standing question's AI half) to `{capabilities, cost}`: `capabilities` a subset of the closed vocabulary this module holds as a constant, `CAPABILITY_NAMES` (`tools`, `schema_output`, `image_input`, `parallel_tools`, and `min_context`, a number tested against `context_window`), to which `agent-model`'s `capabilities` is tested equal (the harness is before `agent-model`, so the names live here; FOLD-AI §2.2), `cost` `low`, `standard` or `high`. `needOf(role)` answers it; an unknown role answers `null`. No entry holds a model name, an id or a price. Test: total over the roles the modules use; each capability is in the vocabulary; a scan finds no model-id pattern; control: a role added to a mode without a row fails the totality test.

- **R21** (T53; AIR5, AD14) **`partOf(role)`, pure.** Each role and mode maps to one of the six part ids (`check`, `plan`, `investigate`, `explore` to `run`; `extract` and `read` to `read`; `transcribe`; `ask` and a standing question's AI half to `ask`; draft kinds and `enquire` to `draft`; `case_account` and `account_check` to `account`); the map's values are exactly the six gate parts, `run-rules` `GATE_PART_OF`'s values, both ways (a part with no role, or a role with none, fails). Test: both directions; control: a role mapped to a fine name such as `draft:reading` fails.

- **R22** (T53; AD14, AD37) **`disclosureGate(account, recipient)`, pure.** Answers `{ok: true}` when `recipient` `{provider, host}` is in `account.disclosed`, else `{ok: false, recipient}`; the recipient of an entry is read from the catalogue by the caller. Test: member in, member out; control: same provider, other host, is not disclosed.

- **R23** (T53; AIR7) **No provider-held state in the resumable state.** `RESUMABLE` holds no key named or shaped as a session, response, conversation or continuation id; `publishableState` drops none silently: a state carrying one is refused `STATE_HOLDS_PROVIDER_STATE` naming the key. Test: a state with `continuation` is refused; control: the existing keys publish.

- **R24** (T53; AIR28) **`resumeAt(state, step)`, pure.** For a step abandoned at a stop, answers the state unchanged and the same step as next, pass count and bounds unspent; for a completed step it answers `advance`'s result. Test: a stop at `collect` leaves `nextStep` `collect`, the pass unchanged and nothing consumed; control: a completed `collect` advances to `compose`.

## Private

### Uses

- `observation-log`: its condition vocabulary `CONDITION_KINDS` (R11; K3491).
- (T53) `run-rules`: `GATE_PART_OF`'s values, the six gate parts, which `partOf` equals both ways (R21).
- `runtime-limits`, as Rule 3's table names it. Neither `harness.mjs` nor `subsession.mjs` imports anything outside the two files today (checked on `tranche/T32`); see Suggestions.

### Invariants

- **R7** (was `agent-worker` R41) Sub-sessions run, one per level, each under its spawn contract (`agent-worker` R17) and returning only reports (R5).
- **R8** (new; Q0-1) Every export of this module is pure: it makes no network call, reads no binding, environment, clock or storage, and keeps no state between calls, so the same arguments always give the same answer. A test calls each exported function twice on equal inputs with the global `fetch` and `Date.now` replaced by throwing stubs and finds equal answers and no stub called.
- **R9** (N586; K1615) It exports none of `PLANE_OPS`, `NAMESPACES` and `MEANING_ARM`: the run's plane ops, the namespace list and the meaning arm are `agent-worker`'s (its R37, R4, R44, R19 and R22), declared once there, so no name is declared in both modules. A test imports each of this module's files and finds none of the three among their exports.
- **R10** (T46; N919; Bob's, K2892; amends R44's copies held in `harness.mjs`) `MODES.plan` is deployed by the same reviewed edit that sets `run-rules`' `DEPLOYED_MODES` (its R14) and `agent-worker`'s (its R53): the harness's copy agrees with both, `check` stays deployed, and every other mode stays as it is. A copy that disagrees with `run-rules` R14 fails this module's test.
- **R16** (R085; S4 N4; K3557) A run that composed a candidate and wrote none never closes `completed`: it closes with the reason stated (`nothing written`, and why) in the member's result. Test: composed count 1, written count 0, at the last pass: the close is not `completed` and names the reason.
- **R17** *(retired (T53, K5457, with `agent-runner` R38; coordinator 5 Nov): R17 was CONDITIONAL on `agent-runner` R38's proof (K3615), and R38 is retired: the remote conversation and its route are unbuilt and out of this design, so remoteBrief is not built. No replacement requirement.)*
- **R18** (T50; N1169; K3501 (C2); `diag-085-r4` C2; `run-rules` R35; amends `emptyLevelCandidates`) **No absence is written for a level that had nothing in scope.** The table's state carries `scope`, `{<level>: {reads, documents}}`: for each level the number of reads its sub-session made and the greatest `documents` the plane's four-level statement (`retrieval` R13) answered over them (so any read that found a document in scope makes it 1 or more), set by the shell from those answers, never from a report's words and never by a judgement (`scope` is not in `JUDGEABLE`, R4); it is in `RESUMABLE`. `levelsWithoutScope(state)` (pure) lists each level that reported `LOOKED_ABSENT` and whose `scope` shows no read or `documents` below 1, with `run-rules` R35's answer; `emptyLevelCandidates` composes no candidate for any of them. Test: `content` reported empty with `documents: 0` and `document` reported empty with `documents: 3` give the one `level-empty-documents` candidate; a level reported empty with no read at all gives none. Control: a level with one read of `documents: 0` and one of `documents: 2` keeps its candidate.
- **R19** (T50; N1187; K3557; amends R4; the resumable state gains `disagreed`) **A disagreement between levels is named by the judgement and acted on by the table, once.** `JUDGEABLE` (R4) gains `disagreements`, a list of at most 10 `{record, levels}` (`record` a non-empty id, `levels` two different members of `LEVELS`), applied at `compose` only. `disagreementsToSettle(state)` (pure) lists the named pairs not yet in the state's `disagreed` (a key of record and levels, in `RESUMABLE`) and `advance` adds them when the step leaves `compose`, so each pair is settled once per run, whatever the pass; at most 10 pairs in all. A pair neither adds a candidate nor changes `passAdded` (R15), the pass limit or any bound: a disagreement never opens a pass. The shell states each (`agent-worker` R116). Test: a judgement naming two pairs lists both; after the step, the same two named in the next pass list none and the next pass is not entered because of them. Control: an eleventh pair, a pair naming one level twice and a pair with an empty record are refused as `JUDGEMENT_OVERREACH` naming the key.

### Satisfies

- `docs/development/INVESTIGATIVE-SESSION.md` §14b.1 (reports, never documents), §14b.4 (scripted and judged), §14b.6 (bounded, the bound recorded), §14 (the search half never receives the lens).
- `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md` §3 rules 4, 5 and 10.
- `docs/architecture/BIO_Action_v0_1.md` §4 rules 1, 3 and 8 (R6; K660).
- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §9.4 (Q0: the `agent-worker` split, K1439); §10 "A module fits in one reading" (P6, K617).
- DEC-24, DEC-55; D-112, D-199.
- (T53) AIR5, AD14, AD37, AIR7, AIR28, BR3 (K5457): R20–R24.

### Suggestions

- **Files.** `agent-harness/src/harness.mjs` and `subsession.mjs`, copied byte for byte, with `agent-worker`'s `index.mjs` importing from here once re-pointed (T33-57). Tests: `harness.*`, `fanout.*`, `versions.*` and the R44 parts of `wire-vocabulary.*` move with the files, the R13–R16, R20, R41, R50 cases of `agent-worker.test.mjs` and `plan.test.mjs` with them.
- **Open for BOB (the seam's edge).** Three things live in `harness.mjs` but belong to requirements T33-54 does not list as moved: R39 (no judgement sets control; enforced by `applyJudgement`, R4 here), R44's copies (`LEVELS`, `REPORT_STATES`, `REPORTING_LEVEL`, `NAMESPACES`, `MODES`, held in these two files) and R52's judged fields (`applyPlanJudgement`, `PLAN_JUDGEABLE`, `planDedup`). The draft leaves them in `agent-worker`; moving R39 and R44's copy test here would keep each requirement beside its code. `PLANE_OPS` (R37) was also declared in `harness.mjs` and stays `agent-worker`'s requirement; with `NAMESPACES` and `MEANING_ARM` it now lives in `agent-worker`'s `ops.mjs`, and R9 removes the copies here (T34-37).
- **`runtime-limits` in `uses`.** Rule 3 names it; no import exists. Either drop the edge or name the export used (BOB's).
- Keep R8 a test of the module, not a lint: the stubbed globals make it checkable at the interface.
