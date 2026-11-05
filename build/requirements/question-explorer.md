# question-explorer — requirements

**Status** · Draft, BOB's (K2405, K2418, K2420): a new product module Bob approved (D51 A, D1), placed by BOB, written at T41's opening from `build/plan/draft-T41-investigation.md` §3.2 (N815, N820; D33, D36, D39, D11–D14, D66). Every requirement not yet met (T41). Last changed T42 (T42-19: R15 new, the factory migrates at creation; N845; K2571, K2608), not yet met. Last changed T46 (T46-17: R16 new, the gate open on the test-instance exception, finds labelled; N897 (2), K2816, `draft-T46-trial.md` §1.2); marked not yet met (T46). Last changed T48 (T48-35: `accountUses` and `aiKeptAway` read from `ai-accounts`, `credentials` dropped from its uses, its tests following; R3 and R13's citations re-pointed, meaning unchanged; N996 §5; K3195): no requirement's meaning changed, so none is marked. Last changed T50 (T50-68: R17; K3637); marked not yet met (T50).

**Size (P6).** About 1,450 lines. Built and tested; offered to no member until R7's gate (D11's bar) opens.

## Public

### Purpose

The system exploring a question on its own where an account owner turned exploring on (D33, D39; N815): choosing what is worth exploring, running a bounded exploring run as a system step, gauging how each find bears on the question, and offering finds once to the members following it. Members decide what becomes evidence.

### Provides

- **R1** (D39; `ai-use` R6, R9) `exploreDue(now)`, `exploreWake(now)`, `exploreTick(now)` for `scheduler`. For each account owner and each question in its scope, `ai-use.exploreAllowed` decides; `{ask: true}` records `ai-use.exploreAsk` with the questions and their estimate (R12), and nothing runs that day without approval.
- **R2** (BOB's detail) A question is **worth exploring** when it is open or surfaced, at least one member receives its finds (`steps` R17), and it was never explored or the record gained, since its last exploring run, a capture whose resolved entities include its subject entity (`inquiry` R43). Read bounded (at most 200 questions a tick). R9 holds before it.
- **R3** (H30 (5); AI Roles rule 12) An exploring run is opened through `ai-runs` in the `investigate` mode's run path with `origin: "explore"`, use `explore`, the paying owner as principal and `ai-use` R6's label, as a system step on the question (`steps` R1, R8), the step created by `ai-runs` once the run is open (its R73; this module passes `place` and `work`, never a step of its own; K2490). A principal served by a sign-in (`ai-accounts` R7) explores only while that sign-in account's `explore` use is on (`ai-accounts` R14, off by default, its owner's own act; N796, Bob K2425; K2472); otherwise it is refused as any account whose `explore` use is off. It reads within its principal's sight: a member's account, that member's; a project's, its participants'; the group's, what every member may see. It asks to capture only through `capture-requests` and only an address the record already holds, each request carrying the step; a page it finds anywhere else is named to the members R5 reaches, who capture it (`capture-requests` R49).
- **R4** (D33; K1473) Each find (a capture, content row or connection the run located) is gauged `supports`, `cuts_against` or `unclear` against the question's live basis, answered as `{bearing, how, false_alarm_rate, gold_set, label: "machine", enabled_by}`. The gauge is never a grade, never stored as a score, and never hides, ranks or orders what members see.
- **R5** (D36) `findsFor({viewer, at})`, for `notice-producers`: each find, once, to each of `steps.findRecipients` who may see both the find and the question, keyed per find and question. A find is labelled the system's work, never a project's; which account paid is answered only to that account's owners (D64).
- **R6** (D3) A find's only doors are a member's: dismiss it (a project-scoped disposition, `queue` R27; a follower outside every drawing project mutes it), accept it into the evidence by one act (`record-grammar` R52's forms: a leg the member draws by her own promotion, as found or edited, or her own instead), hold a hypothesis, or start a step. Nothing here writes a leg, a grade, a conclusion or a member's hypothesis.
- **R7** (D11, D14; K1504) Finds are offered only while the gauge's gate is open: the explorer has passed D11's bar on Civicsmith's test investigations (`ai-runs` R75), its false-alarm rate there at most 20% and recorded, and `run-rules` R19 lets `investigate` deploy and the explorer's use. Closed, R5 answers nothing and counts nothing, and no member is offered exploring.
- **R8** An exploring run stopped by a limit ends its step `set_aside` with the reason (`steps` R5); only its enabling owner is told (`ai-use` R5). No place is named in behaviour or outward text.
- **R9** (D13) The system never explores a person on its own. An exploring run gathers about a person (searches, captures or reads aimed at a person entity, `entities`) only when a member has tied that person to the question (its subject or named entities, or a connection a member drew to it); any other look aimed at a person is refused inside the run `EXPLORE_PERSON_NOT_TIED`, recorded on the run, and the run goes on. R2 never chooses a question for a person no member tied to it.
- **R10** (D13; BOB's detail) An exploring run gathers about at most 20 distinct persons (`EXPLORE_PERSON_CAP`); a look past the cap is refused `EXPLORE_PERSON_CAP_REACHED` and the run ends its step `set_aside` with that reason (R8). The cap is a constant here, changed only by a reviewed change.
- **R11** (D14) A group's own test investigations (`ai-runs` R75) measure the explorer too; the result, with its false-alarm rate, is answered to that group's members only, and never opens or closes R7's gate. Test transcripts are kept for grading only (D15).
- **R12** (D12) Each Ask item and each run carries `ai-use` R10's estimate before (a range, or "not known yet") and, at its close, `ai-runs` R76's actual cost, each answered to the paying account's owners only.
- **R13** (D2) An exploring run may read inside documents the record holds, a few pages at a time within `run-rules` R26's reading bound, never a document under a "no AI" material limit (`ai-accounts` R22); what it proposes while reading is `run-productions` R21's, each tied to the step.
- **R14** (D66; CF invariant 7 as amended) A find that cuts against what the question's members hold is offered exactly as prominently as one that supports it: the same item, kind, place and order rule; no answer here orders, groups or filters finds by bearing.
- **R15** (T42; N845; K2571) `questionExplorerOf(host, deps?)` answers one instance per host with its tables already created: it runs its `migrate()` before declaring them to purge, as `publish-schedule`'s factory does. A host that builds it and never calls `migrate()` therefore reads, ticks and purges without error. `migrate()` stays callable and idempotent.
- **R16** (T46; N897 (2); K2816 (2); amends R4, R7) The gate is also open, on the test-instance exception, when `ai-runs.partAdmitted` (its R78) admits both `investigate` and the explorer's use `explore` with the label (`run-rules` R29): R4's answer then carries `false_alarm_rate` null, `gold_set` null and `untested` the label, and each find R5 offers carries the label. Whenever the bar is held, R7's recorded false-alarm rate of at most 20% applies as now and no label is carried. The exception lifts only the bar: R7's other conditions (the verification chain that lets `investigate` deploy) stand, and nothing here counts toward any bar. Test: on a test instance with no record and `investigate`'s chain held, finds are offered labelled; control: a non-test instance with no record stays shut, R5 answering nothing.
- **R17** (T50; N1164; K3485; DEC-293, DEC-297; amends R3, R8, R10) **A run's end is closed in the record's own words and awaited.** Every call this module makes to `ai-runs` that answers asynchronously (`open` and `close`) is awaited; `end`, `look` (when R10's cap ends the run) and the opening of a run answer after `ai-runs` has answered, `closed: true` only when `close` accepted it. The close names a `bound` of `run-rules`' `RUN_BOUNDS` and `RUN_ENDINGS` and a `condition` that is null or a key of observation-log's `CONDITION_KINDS` (as `run-rules.checkCondition` judges it): this module's own reasons (`EXPLORE_PERSON_CAP_REACHED`, a limit's text) are the step's `reason` (R8) only, never the run's condition. A run it ends by its own rule (the cap, a limit) closes with the bound `completed` and no condition; the step is set aside with the reason. A refused close is carried in the answer (`closed: false`, the plane's code) and the run's row records that the end was not accepted; it never throws. So `propose`, like `end` and `look`, answers a promise; `end` takes an optional `condition` (checked as above) and, on a refused close, answers `ok: false` with `closed: false`. Test: a stub `ai-runs` whose `open` and `close` are asynchronous and that refuses an unknown condition: the cap ends the run `closed: true`, the stub's close received `condition` null and the step's reason is `EXPLORE_PERSON_CAP_REACHED`; a stub that refuses the close gives `closed: false` with its code and the run recorded as not closed. Control: `end({end: "ended"})` closes with bound `completed`; the words members read for the ending are `ai.run.ending.*` (screens-inquiry's), not this module's.

## Private

### Uses

- `run-productions`: proposals while reading (its R21; R13; K2472). A new `modules.json` edge; `run-productions` is earlier (layer 6).
- `record-grammar`: `ACCEPTANCE_FORMS` (its R52; R6), the proposal labels.
- `civil-time`, `record-core`, `membership`: days, tables, sight.
- `ai-accounts` (T48; N996, split map §5; was `credentials`, which this module no longer uses): `aiKeptAway`, the material limits (its R7, R22; R13), and `accountUsesOf`, the account's uses as read in the plane (its R17; R3).
- `connections`, `retrieval`: what a run located and reads (R4).
- `inquiry`: a question's state and subject entity (its R43; R2), R59's person test (R9).
- `leg-earning`, `basis-versions`, `contradiction`: the question's drawing projects and live basis (R4).
- `steps`: `stepCreate`, `stepEnd`, `findRecipients` (its R1, R5, R8, R17).
- `run-rules`: R19's deploy gate, R23's `explore` origin, R26's `pages` bound.
- `ai-use`: `exploreAllowed`, `exploreAsk`, `estimate` (its R6, R9, R10).
- `ai-runs`: the `investigate` run path, R75's test bar, R76's actual cost.
- `capture-requests`: captures asked only through it (its R49, R55).

### Invariants

Stated with its services above: R4 (a gauge is never a grade), R6 (members' doors only), R7 (the gate), R9 and R10 (persons), R14 (as prominently).

### Satisfies

- The investigation design of record (K2417): D33, D36, D39, D11–D14, D66; N815.
- K2816 (2) (Bob: the deployer-set test-instance exception, every output labelled; R16).

### Suggestions

- Paths: `bio-plane/src/question-explorer/`; tests `bio-plane/test/m/question-explorer/`.
- **F1** K5821, Bob's REC-11: R3's exploring run opens with the member who turned exploring on as its accountable member, judged by run-rules R18 at each run; R7 and R16's admission, ai-runs.partAdmitted, is judged on the paying account's entry, which R7 and R16 did not name. If the enabling member is gone or no longer allowed, the run is refused with a reason the screen shows and exploring stays off until a member turns it on again; test through the providers' real code, not stand-ins.
