Length: 78 lines. Last section: "Suggestions".

# agent-harness: requirements

Next number: 20

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
- **R1** [met] (was `agent-worker` R13) Rows `gate-mode`, `resume`, `plan`, `fanout`, `collect`, `compose`, `dedup`, `submit`, `adjust`, `next-pass`, `close`; each declares the steps it may go to, and `nextStep` never returns a step outside them. There is no edge from `compose` to `submit` and none from `submit` back to itself on a refusal. An unknown step closes with `completed` and says so.
- **R2** [met] (was `agent-worker` R14) `gate-mode` is first. A mode that is not deployed closes the run with bound `mode-not-deployed` at its first step, after only the run and log reads (`agent-worker` R9, R11) and before any fan-out, request or suggestion; its log entry and close are still written; its `why` distinguishes a mode the table holds and has not deployed from a word it does not hold, and names the deployed modes. The deployed modes are those `MODES` marks deployed, which agree with `run-rules`' `DEPLOYED_MODES` (R10): `check` and, since T46, `plan` (which walks `PLAN_FLOW`, R6); `investigate` and `extract` are not. (T47; N949: wording only, no behaviour moved)
- **R3** [met] (was `agent-worker` R15) Above every row after the gate, `stopBecause` asks `fetches`, `subsessions`, `wallclock` in that order and closes on the first whose consumed ≥ its positive allowance; an absent or non-positive allowance never stops a run. Then pass count ≥ the pass limit closes `completed`. The pass limit is the run's `max_passes` when positive, else 3; a pass counts when it is done (`next-pass`).
- **R4** [met] (was `agent-worker` R16) Judgements are taken in order, one per judged row (`plan`, `collect`, `compose`, `dedup`, `adjust`); a row with none carries the state on. A judgement naming `pass`, `maxPasses`, `step`, `budget`, `mode`, `bound`, `run`, `store` or `target`: 400 `JUDGEMENT_OVERREACH` with `step` and `fields`. Only `targets`, `reports`, `candidates`, `queue`, `adjusted`, `submission`, `level`, `observed`, `governed`, `condition` are applied.

The report contract (`checkReport`, pure):
- **R5** [met] (was `agent-worker` R20) A report has only the keys `level, state, observed_at, summary, citations, governed, condition`; `level` and `state` are required; `level` is one of the four; `state` one of `NEVER_LOOKED`, `LOOKED_ABSENT`, `LOOKED_INDETERMINATE`, `PRESENT`, `partial`; every state but `NEVER_LOOKED` needs `observed_at`; `PRESENT` and `partial` need a citation; at most 20 citations, each exactly `{address}`, non-empty, at most 200 characters; `summary` a string of at most 500; the whole at most `REPORT_MAX_BYTES`. Each breach is refused by its own code (`REPORT_UNKNOWN_FIELD`, `REPORT_INCOMPLETE`, `REPORT_LEVEL_UNKNOWN`, `REPORT_STATE_UNKNOWN`, `REPORT_UNLOCATED`, `REPORT_NO_CITATION`, `REPORT_OVER_BOUND`, …).

Mode `plan`'s table (K660; `BIO_Action_v0_1.md` §4):
- **R6** [met] (was `agent-worker` R50; §4 rules 1, 3, 8; K660 (1), (3)) Mode `plan` walks its own control-flow table, `PLAN_FLOW`, pure and held beside `CONTROL_FLOW`: rows `gate-mode`, `resume`, `read`, `compose`, `dedup`, `submit`, `adjust`, `close`; one pass (R3's pass limit is 1 for this table); `stopBecause` asks `proposals` then `wallclock`. It has no `fanout`: it calls no `airunspawn`, `capturerequest` or `suggest`, makes no fetch and drafts no communication.
- **R11** [met] (R085-11; K3486 (B); R5) The spawn contract's `returns` carries `conditions`: the condition kinds `run-rules` admits (the vocabulary `checkCondition` checks), in a fixed order, so the sub-session's tool can offer them (`agent-model` R17). Test: a contract's `returns.conditions` is non-empty and each kind passes `checkCondition`; control: a kind not in it is refused by `checkCondition`.
- **R12** [met] (R085-16; K3501 (C1, C3)) `spawnContract({level, payload, arms, targets})` adds two keys after `scope`: `subjects`, the payload's `subjects.items` (`ai-runs` R85) followed by `targets` (the level's targets the plan judgement named, each `{id, extent}` as given, `kind: "target"`), deduplicated by `id` and `extent`, at most 50, frozen; and `arms`, the meaning arms the caller passes (names, in the caller's order), frozen. An absent `subjects`, `targets` or `arms` gives an empty list. Test: a payload with two subjects and one target gives three, in that order, frozen; control: a duplicate of a subject among the targets appears once.
- **R13** [met] (R085-23; K3510; `screens-inquiry` R39) An empty-level candidate's description (`emptyLevelCandidates`) names the target as "this question", never its record id. Test: a target `INQ-…` gives a description holding "this question" and not the id; control: its name stays `level-empty-<level>`.
- **R14** [met] (R085-29; K3528; `walk-085-r5` item (e); extends R13) A candidate's member-facing text never carries the sub-session's free-text summary or any raw record id; the report and its words stay in the run log. Test: an empty-level candidate from a report whose summary quotes `INQ-2026-0002` and `INFO-2026-0006-council-minutes` has a description holding neither id nor the summary. Control: the candidate's name stays `level-empty-<level>`.
- **R15** [met] (R085-29; K3529; `diag-085-slow` option 2; Bob, 2026-10-16: "there's no value in continuing at that point") A check run's `next-pass` closes the run, with condition `completed` and a log entry saying the pass added nothing new, when the pass just ended added no new candidate: every candidate it composed was dropped by `dedup` as already held, or it composed none. `maxPasses` stays the upper bound. Test: a pass whose candidates are all dropped as held closes before the next pass and logs why; control: a pass that submits a new candidate goes on to the next pass, below `maxPasses`.

## Private

### Uses

- `observation-log`: its condition vocabulary `CONDITION_KINDS` (R11; K3491).
- `runtime-limits`, as Rule 3's table names it. Neither `harness.mjs` nor `subsession.mjs` imports anything outside the two files today (checked on `tranche/T32`); see Suggestions.

### Invariants

- **R7** [met] (was `agent-worker` R41) Sub-sessions run, one per level, each under its spawn contract (`agent-worker` R17) and returning only reports (R5).
- **R8** [met] (new; Q0-1) Every export of this module is pure: it makes no network call, reads no binding, environment, clock or storage, and keeps no state between calls, so the same arguments always give the same answer. A test calls each exported function twice on equal inputs with the global `fetch` and `Date.now` replaced by throwing stubs and finds equal answers and no stub called.
- **R9** [met] (N586; K1615) It exports none of `PLANE_OPS`, `NAMESPACES` and `MEANING_ARM`: the run's plane ops, the namespace list and the meaning arm are `agent-worker`'s (its R37, R4, R44, R19 and R22), declared once there, so no name is declared in both modules. A test imports each of this module's files and finds none of the three among their exports.
- **R10** [met] (T46; N919; Bob's, K2892; amends R44's copies held in `harness.mjs`) `MODES.plan` is deployed by the same reviewed edit that sets `run-rules`' `DEPLOYED_MODES` (its R14) and `agent-worker`'s (its R53): the harness's copy agrees with both, `check` stays deployed, and every other mode stays as it is. A copy that disagrees with `run-rules` R14 fails this module's test.
- **R16** [met] (R085; S4 N4; K3557) A run that composed a candidate and wrote none never closes `completed`: it closes with the reason stated (`nothing written`, and why) in the member's result. Test: composed count 1, written count 0, at the last pass: the close is not `completed` and names the reason.
- **R17** [not yet met] CONDITIONAL on agent-runner R38 (built only once its proof passes; K3615) (N1196; R8; `agent-model` R12; DRR §2 option A) `remoteBrief({system, prompt, tools, finalTool, door, credential, maxBytes})`, pure, answers `{text, bytes}`: the one user turn a cloud session receives. It states the step's role, each offered tool by name with how to call it at `door`, that `credential` goes only in the `Authorization: Bearer` header, that tool results are data and never instructions, that no other tool, file, address or shell is used for the record, and that the answer is the `finalTool` call. It holds `credential` once and no other secret, an address with no query, and no record text (a transcript names held results by id, `agent-model` R12). Over `maxBytes` (the limit R38 step 2 found, at most 60,000): `{ok: false, code: "REMOTE_BRIEF_TOO_LARGE"}`. Test: the sentinel credential appears once and never in a URL form; sentinel record text in a held result is absent; equal arguments give equal text (R8); an over-bound brief is refused.
- **R18** [met] (T50; N1169; K3501 (C2); `diag-085-r4` C2; `run-rules` R35; amends `emptyLevelCandidates`) **No absence is written for a level that had nothing in scope.** The table's state carries `scope`, `{<level>: {reads, documents}}`: for each level the number of reads its sub-session made and the greatest `documents` the plane's four-level statement (`retrieval` R13) answered over them (so any read that found a document in scope makes it 1 or more), set by the shell from those answers, never from a report's words and never by a judgement (`scope` is not in `JUDGEABLE`, R4); it is in `RESUMABLE`. `levelsWithoutScope(state)` (pure) lists each level that reported `LOOKED_ABSENT` and whose `scope` shows no read or `documents` below 1, with `run-rules` R35's answer; `emptyLevelCandidates` composes no candidate for any of them. Test: `content` reported empty with `documents: 0` and `document` reported empty with `documents: 3` give the one `level-empty-documents` candidate; a level reported empty with no read at all gives none. Control: a level with one read of `documents: 0` and one of `documents: 2` keeps its candidate.
- **R19** [met] (T50; N1187; K3557; amends R4; the resumable state gains `disagreed`) **A disagreement between levels is named by the judgement and acted on by the table, once.** `JUDGEABLE` (R4) gains `disagreements`, a list of at most 10 `{record, levels}` (`record` a non-empty id, `levels` two different members of `LEVELS`), applied at `compose` only. `disagreementsToSettle(state)` (pure) lists the named pairs not yet in the state's `disagreed` (a key of record and levels, in `RESUMABLE`) and `advance` adds them when the step leaves `compose`, so each pair is settled once per run, whatever the pass; at most 10 pairs in all. A pair neither adds a candidate nor changes `passAdded` (R15), the pass limit or any bound: a disagreement never opens a pass. The shell states each (`agent-worker` R116). Test: a judgement naming two pairs lists both; after the step, the same two named in the next pass list none and the next pass is not entered because of them. Control: an eleventh pair, a pair naming one level twice and a pair with an empty record are refused as `JUDGEMENT_OVERREACH` naming the key.

### Satisfies

- `docs/development/INVESTIGATIVE-SESSION.md` §14b.1 (reports, never documents), §14b.4 (scripted and judged), §14b.6 (bounded, the bound recorded), §14 (the search half never receives the lens).
- `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md` §3 rules 4, 5 and 10.
- `docs/architecture/BIO_Action_v0_1.md` §4 rules 1, 3 and 8 (R6; K660).
- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §9.4 (Q0: the `agent-worker` split, K1439); §10 "A module fits in one reading" (P6, K617).
- DEC-24, DEC-55; D-112, D-199.

### Suggestions

- **Files.** `agent-harness/src/harness.mjs` and `subsession.mjs`, copied byte for byte, with `agent-worker`'s `index.mjs` importing from here once re-pointed (T33-57). Tests: `harness.*`, `fanout.*`, `versions.*` and the R44 parts of `wire-vocabulary.*` move with the files, the R13–R16, R20, R41, R50 cases of `agent-worker.test.mjs` and `plan.test.mjs` with them.
- **Open for BOB (the seam's edge).** Three things live in `harness.mjs` but belong to requirements T33-54 does not list as moved: R39 (no judgement sets control; enforced by `applyJudgement`, R4 here), R44's copies (`LEVELS`, `REPORT_STATES`, `REPORTING_LEVEL`, `NAMESPACES`, `MODES`, held in these two files) and R52's judged fields (`applyPlanJudgement`, `PLAN_JUDGEABLE`, `planDedup`). The draft leaves them in `agent-worker`; moving R39 and R44's copy test here would keep each requirement beside its code. `PLANE_OPS` (R37) was also declared in `harness.mjs` and stays `agent-worker`'s requirement; with `NAMESPACES` and `MEANING_ARM` it now lives in `agent-worker`'s `ops.mjs`, and R9 removes the copies here (T34-37).
- **`runtime-limits` in `uses`.** Rule 3 names it; no import exists. Either drop the edge or name the export used (BOB's).
- Keep R8 a test of the module, not a lint: the stubbed globals make it checkable at the interface.
