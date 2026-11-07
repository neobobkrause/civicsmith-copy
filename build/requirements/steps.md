# steps — requirements

**Status** · Draft, BOB's (K2405, K2418, K2420): a new product module Bob approved (D51 A, D1), placed by BOB, written at T41's opening from `build/plan/draft-T41-investigation.md` §3.1 (N820; D27–D50, H38, H39, D64). Every requirement marked unmet (T41). Last changed T42 (T42-14: R28 new, its own code for C-142.28, re-coded in place; N843; K2566, K2608), marked unmet. Last changed T44 (T44-6: R23 amended, `looked_at`; N873; K2726), marked unmet. Last changed T46 (T46-12: R12 amended, `stepsDue`'s two 1,000 bounds stated with a `truncated` mark; Private Uses names `jurisdictions`, `calc-grammar` and `connection-grammar`, which it imports, and no longer `inquiry`, which it does not; N899); marked unmet (T46). Last changed T47 (T47-16: R23 amended, `laterFound`'s `truncated` stated and tested by name; N973); marked unmet (T47). **All met (layer 11, `steps` job, 7 Nov 2026):** the module's code and tests were on the tranche with no ledger entry (investigation lane, Q3); every live id, R1–R24 and R26–R30 (R25 retired), is met by `bio-plane/src/steps/` and named by a test in `bio-plane/test/m/steps/` (48 pass, 0 todo), the T46 and T47 controls among them (R12's 1,001/1,000, R23's 5,001/5,000), so none of the five marks above stands.

**Size (P6).** About 2,150 lines; past about 2,500, the cost relay, follows and later-found move to a module directly after it (BOB's, at the job's report).

## Public

### Purpose

A step is work done by a member or the system in pursuit of an answer to a question, or to give members context, develop a question, or understand how to respond to findings (D32, D35). This module holds each step: where it was taken and so who sees it, who does it, its state and per-question outcome, what it produced, what it waits on and by when, what it costs in money, the search that keeps work from being duplicated, each member's following of a question (D36), and the later arrival of data a dead end looked for (H39). A step is never evidence and writes no leg (D33).

### Provides

Terms. A **step** is `STP-` (`record-grammar` R51). Its **place** is exactly one of `{questions: [inquiry ids]}`, `{project: id}` or `{group: true}`, fixed at creation. A **reference** is a question's link to a question-placed step. **Doer** is a member's handle, or `system` with `enabled_by` (`ai-use` R6's label). **Taken in** is the project the creating act named (`project`, the caller's own joined project), or none. **Touched**: started, or holding a product, a look, a learned line or a cost. A viewer is the control plane's stamp; an absent viewer fails closed. Every refusal names its reason and nothing is written.

#### Creating and seeing

- **R1** (D32, D35, D44) `stepCreate({place, work, byWhen?, project?, by})` records a step at `planned`. `work` is the doer's words on what the work is (1–500 characters); no purpose, method or parent field is held. `project`, when given, is the project the step is taken in. Refusals in order: `STEP_NO_WORK`; `STEP_BAD_PLACE` (no place, more than one kind, or an empty list); a question the caller may not see, or not an inquiry, answered as absent (`NO_SUCH_BUNDLE`); a project (place or `project`) at `EXISTENCE` `PROJECT_SEEN_NOT_A_PARTICIPANT`, at `NONE` as absent, and a caller not joined `PROJECT_ACT_NOT_A_PARTICIPANT` (`membership` R44, R55); `byWhen` malformed (R12). A machine credential may create a step only for a run it holds, with doer `system` and that run's `enabled_by`, and only R8 permitting. Answers `{ok, step, place, at}`.
- **R2** (D35, D40) A viewer sees a step when: question-placed, she may see at least one of its referring questions; project-placed, she is at `FULL` sight of the project; group-placed, she is an active member. Any other step answers exactly as one that does not exist, and is counted nowhere.
- **R3** (D41 as revised by H38, D64) A question-placed step names its doer by handle, and names the project it was taken in only while that project is not hidden (`membership` R85) and the viewer may see its name (`membership` R44); a step taken in a hidden project, or in none, names no project. No answer about a step counts or implies a hidden project, and the answer is the same whether a step was taken in a hidden project or in none.
- **R4** Reads: `step({step, viewer})`; `stepsOn({question, viewer, state?, after?, limit?})` (the work done on a question, D45); `stepsIn({project, viewer, …})`; `stepsOfGroup({viewer, …})`. Each answers `{step, place, work, doer, taken_in, state, outcomes, byWhen, waits, learned, cost, later_found, at}`, `taken_in` as R3 allows; `stepsOn`'s header answers the question's `projects`, `leg-earning` R14's answer for that viewer (`inquiry` R60's share, K2472); bounded (default 200, at most 1,000, `truncated`, `next`). Never throws.

#### State, outcome, deletion

- **R5** (D32 (b), D47 B) States: `planned` → `underway` (`stepStart`) → `ended` or `set_aside` (`stepEnd({step, end, outcomes?, learned?, by})`). For each referring question, `outcomes` records `helped` or `dead_end`, default `undetermined` ("not yet judged"); a project- or group-placed step records one outcome. A member records an outcome; a machine ends only its own step, with `end: ended` and every outcome `undetermined`, or `set_aside` with its reason (a limit reached, a refusal), and never records `helped` or `dead_end` (D33). A member may set or revise an outcome later; each change kept with who and when. An ended step reopens only by `stepStart`, recorded.
- **R6** (D28) `stepDelete({step, question?, by})` deletes an untouched step outright. When more than one question refers to it, `question` names the reference removed and only it is removed (`STEP_SHARED_NAME_THE_QUESTION` without it); the last reference's removal deletes the step. A touched step is refused `STEP_WORKED_KEEPS_RECORD`, the route being R5's `set_aside`. A machine deletes only its own untouched steps. A deletion leaves no row.

#### Shared steps and the duplicate search

- **R7** (D45) `stepsLike({work, questions?, viewer, limit?})` answers the steps the viewer may see whose work matches, open and ended alike, each with its place, state and outcomes, at most 50. `stepRefer({step, question, by})` adds a question's reference to an existing step: refused `STEP_NARROWER_THAN_QUESTION` for a project-placed step (its sight would widen), and as absent for a step or question the caller may not see. What a shared step produces serves every referring question (R9), in whichever projects draw on them; each project concludes for itself.
- **R8** (D45) A machine's `stepCreate` on a question is refused `STEP_ALIKE_EXISTS`, naming the step, when R7 finds, among steps its principal may see, an open step on that question whose normalised work is the same; it refers or uses that step instead. A member is answered R7's matches beside her new step and is never refused for them.

#### What a step produced

- **R9** (D32 (b), (c); D5, D50) `stepProduct({step, record, by})` ties a record to a step: a record id `record-grammar` knows, a capture digest, a content id, a lead, or a connection id. A member ties one she may see (a chance find, D32 (c)); `recordProduct` is the in-process door for `capture-requests`, `ai-runs`, `run-productions` and `control-plane`. A look made for a step is logged under authority kind `step` (`observation-log` R1, R13), which this module resolves (R18). `productsOf({step, viewer})` answers products and looks the viewer may see, the rest left out uncounted. `stepsOf({record, viewer})` answers the steps that produced a record and their questions, so "why we hold it" is read from provenance, never written separately (D50); a record with no step answers none, and its own capture's actor and source say who brought it.
- **R10** (D32 (b)) `learned` is the doer's or a member's own words (at most 2,000 characters), revisable by its writer with history. A machine writes none.

#### Waits and dates (the lane's details, BOB's)

- **R11** `stepWait({step, on, by})`, `on` one of `{step}`, `{arrival: {kind, id}}`, `{date}`; `stepWaitRemove`. A step with an unmet wait reads `waiting`, naming each wait; `stepStart` on it is refused `STEP_WAITING`, naming them. A wait closing a loop is refused `STEP_WAIT_CYCLE`, naming the path; a wait on a step seen more narrowly than the waiting one `STEP_WAIT_NARROWER`. A step wait is met when that step is `ended` or `set_aside` (the read says which). Arrivals are answered by sources later modules register (`registerArrivalSource(kind, read)`: `capture-requests` for a capture request, `actions` for a records request); an arrival nobody can read is `undetermined`, never met.
- **R12** `byWhen` is `{date, basis, source?}`, `basis` `law`, `meeting` or `own`. A date within 7 local days (`civil-time`) answers `nearing: true` and changes nothing else. `stepsDue({viewer, at})` answers, to the member who set the date only, each step past its date and not ended, with a stable key per step and date, for `notice-producers` (told once, DEC-94). `stepReminder({step, at, by})` records a reminder the member asked for, answered by `stepsDue` on that day to her alone. (T46; N899; STEPS #4 J1, K2823) `stepsDue` reads, at each call, at most 1,000 of that member's dated steps not ended (in step order) and at most 1,000 of her reminders due by that day (in the order she asked them); when either read reaches its 1,000, the answer carries `truncated: true` beside `due`, and otherwise no `truncated`, so a bound reached is never silent. Nothing else in R12 or R29 changes. Test: a member with 1,001 open dated steps is answered `truncated: true`; control: with 1,000, none.
- **R29** (T45; Actions DESIGN §2.6; v0.2 rule 6; S1 §C 1) One date, one reminder. `registerDueHolder(module, fn)`: one later module (`action-clocks`, its R16) registers once at start (`membership.listenerRefusal`). `fn({step, byWhen, waits})` answers null or `{entry}` when that module holds the same date as an action's clock entry. `stepsDue` (R12) leaves out a step whose `byWhen` a holder answers held, and every read of a step (R4) answers `by_when_held: {module, entry}` beside `byWhen` (null when not held). A holder that throws or answers anything else is read as not held, so the step's own item stays. Control: with no holder, R12 answers as today.
- **R30** (T45; v0.2 rule 6) `stepsWaitingOn({kind, id})` (in process, for `action-clocks`) answers the steps with an arrival wait (R11) on `{kind, id}`, each `{step, byWhen, state}`, at most 200 with `truncated`; never answered to a member; writes nothing.

#### Money cost (D29, D49, D64)

- **R13** `stepCostAdd({step, kind, amount, currency, what, by})`, `kind` `fee` or `purchase`, `amount` exact decimal (`calc-grammar`), appended with who and when; `stepCostRemove` by its writer, recorded. AI use is never a step cost (it follows the AI settings). Costs are the group's own money: never `money`'s facts, never a finding (K1463).
- **R14** (D29; D64) `costShares({viewer, at})` answers, for each costed question-placed step, when the projects drawing on any of its questions (`leg-earning` R13, over every project) are two or more and none is hidden (`membership` R85), to each owner of each of them only: `{step, totals (per currency), projects: [{id, name}], key}`, the sharing projects named (D64), `key` stable per step, totals and project set, so each change is told once. When any is hidden, or the read is incomplete or fails, it answers nothing about that step to anyone.
- **R15** (D49 A) `costMessage({step, text, by})`, by an owner of a project R14 answers for that step (re-judged at the act, else answered as absent), relays `text` (1–2,000 characters) once to the owners of each other such project; `costMessages({viewer})` answers those relayed to her. Each message carries its text and its writer's handle, and names no project unless she writes it in. Civicsmith records no split and no payment.

#### Following a question (D36)

- **R16** `questionFollow({question, on, by})` records a member's own choice to follow (`on: true`) or stop following a question she may see. It is answered to her alone; nothing names, lists or counts who follows.
- **R17** `findRecipients({question})` (in-process, for `question-explorer` and R23): the joined participants of every project drawing on the question (`leg-earning` R13), less those who stopped following it, plus those who chose to follow it, each only while she may see the question. Bounded and paged; never answered to a member.

#### Data found later (H39)

- **R23** At start this module registers with `observation-log` (its R37) for a look answered later: when an observation of state `PRESENT` is appended for a subject and level at which a step's look (authority `step`) stands `LOOKED_ABSENT` or `LOOKED_INDETERMINATE`, the step gains a `later_found` entry `{look, observation, at}` and the step's questions are told. The earlier look stays as it was, dated (the log is append-only); no outcome moves by itself. `laterFound({viewer, at})` answers, for `notice-producers`, each such entry once to each of R17's recipients of each referring question who may see both the step and what arrived (keyed per step and observation), and to the member who did the step; a member may then revise the per-question outcome by R5. (T44; N873; K2726) Each `laterFound` entry also answers `looked_at`, the instant of the look (its `observation-log` `look` entry's `at`), beside `at`, the instant the later observation arrived; `notice-producers` fills `queue.step-later-found.detail`'s `{date}` from it (DEC-189 (2)). (T47; N973) `laterFound` answers `{ok: true, found, truncated}`: it reads at each call at most `LATER_FOUND_SCAN` (5,000, exported) later-found entries, oldest first, before any entry is filtered by `at`, sight or recipient, and `truncated` is `true` when more are held than it read, else `false` (always present, as `stepsDue`'s is when a bound is reached, R12), so a bound reached is never silent; a viewer naming no member, or a read that fails, answers `found: []` and `truncated: false`. Test, naming `truncated`: 5,001 entries answer `truncated: true`; control: 5,000 answer `false`.

#### A proposed step, accepted (D3)

- **R24** `stepPropose({place, work, why, run, by})` records a machine's or an assistant's proposed step apart, labelled the system's (`record-grammar` R42), never a step until accepted. `stepAccept({proposal, form, work?, project?, by})` is a member's act: `form` is one of `record-grammar` R52's forms (`as_proposed` creates the step as proposed; `edited` with her `work`; `own_instead` records the proposal set aside and her own step created by R1), recording which and who. Any joined member of a project drawing on the proposal's question may accept (`membership` R55); others are refused as R1 refuses. A proposal set aside stays readable with her reason.
  - (T42; K2661) A decided proposal names the step it created only while that step is held; once that step is deleted, it names none, and the decision itself is kept.

#### Several AI steps at once (D7)

- **R25** *(retired: moved to `ai-runs` R74, T41; the batch act must sit after `ai-runs`, which uses this module, K2472)*

#### Registrations and counts

- **R18** At start it registers with `observation-log` (its R13) the resolver for authority kind `step`: a row is visible when the viewer sees the step (R2). With `promotion` (its R39) it registers a check refusing, inside `BASIS_REFUSED`, a leg whose target is a step id (`STEP_NOT_A_LEG`).
- **R26** (D3) `acceptanceCounts()` answers, group-wide only, how many proposed steps were accepted in each form, naming no member, project or proposal; registered with `record-core`'s counts (its R63).

## Private

### Uses

- `record-grammar`: `ID_TABLE`'s `STP` and `isStepId` (its R51), `ACCEPTANCE_FORMS` and `acceptanceRecord` (its R52), the proposal labels (its R42).
- `civil-time`: local days, for R12's `nearing` and `stepsDue`.
- `record-core`: `declareTable`, the counts registry (its R63), transactions and purge (R22, R26).
- `membership`: sight (`R44`, `R85`'s hidden projects, `R55`'s joined participants), handles (R1–R4, R14, R15, R24).
- `promotion`: its R39 check registration (R18, `STEP_NOT_A_LEG`).
- `connections`: a connection id as a product (R9).
- `observation-log`: authority kind `step` and the resolver registration (its R1, R13; R9, R18), `onLookAnswered` (its R37; R23).
- `leg-earning`: `projectsDrawingOnPaged` (its R13) for R14 and R17; `projectsShownOn` (its R14).
- (T46; N899) `jurisdictions`: `combine`, the active profiles' view (R12's local day). `calc-grammar`: the exact decimals of R13's costs. `connection-grammar`: `isRecordId` and `derivedId`, for R9's products. No `inquiry`: whether a record is an inquiry, and who may see it, is read from the record's type through `record-core` and `membership`'s sight (R1, R2, R7, R24), and this module imports nothing of `inquiry`.
- (T45) `membership`: `listenerRefusal`, for R29's registration (an existing edge). The edge `action-clocks` → `steps` (R29, R30) is `action-clocks`' (L9 → L6, earlier).

### Invariants

- **R19** (D15) Steps, learned lines, costs and messages are working material: no case, edition or export to the public carries them; no figure, tally or work product is made from them.
- **R20** (DEC-68, D42) Nothing measures a member: no answer counts steps, outcomes or costs per member. Every act here has a member's path that needs no AI.
- **R21** (D44) A step holds no step; nothing here nests one step in another.
- **R22** Tables are declared through `record-core.declareTable`: project-placed steps keyed and purged with their project; question-placed steps purged when their last referring question is; group steps with the whole store; follows `sight: "owner"`. No place is named in behaviour or outward text.
- **R27** (H30 (2)) Nothing here reads the project's bar or gates a leg, a conclusion or a step by it.
- **R28** (T42; N843; K231, K2566) R24's `stepAccept` refuses a proposed step that is absent or unseen with `NO_SUCH_STEP_PROPOSAL` (C-142.28, its number and translation unchanged), and never with `NO_SUCH_PROPOSAL` (intent's).

### Satisfies

- Canon `docs/architecture/BIO_Investigation_v0_1.md`, in force, approved by Bob 2026-10-09 (K2417, K2419, K2420): §3 "Steps" (place and sight, ending and outcomes per question, removal, cost and the cost notice, chance finds, dependencies, by when, waits on a question; R1–R6, R9–R15, R21, R29, R30), §4 "Saving steps and questions" (what is saved for a step, the search that keeps work from being duplicated, why a document is held, later-found data reaching dead ends; R7–R9, R23), §5 "The system's part" (one accepting act for every proposal, measured group-wide only; who receives a find, following; R16, R17, R24, R26, R28), §1's table (working material never published, nothing measures a member; R19, R20) and §10 "The parts to be built" (this module's scope). The canon is approved, not owed.
- The design of record it places (`investigation-design.html`, K2417): the D and H ids cited beside each requirement (D27–D50, H38, H39, D64) are that design's, as `build/plan/draft-T41-investigation.md` §1 and §2.2 placed them before the canon was written; the canon sections above are what they are now read against.
- `BIO_Action_v0_2.md` rule 6 (K2780; T45, N893): one date, one reminder, a step's date held by an action's clock entry (R29, R30); the actions design §2.6.

### Suggestions

- Paths: `bio-plane/src/steps/`; tests `bio-plane/test/m/steps/`.
- **T47 (T47-16).** R23's `truncated` is what the code answers today (`LATER_FOUND_SCAN`, `index.mjs`); the fold states it and a test names it. Not changed here: the read takes the oldest 5,000 entries, so once more are held the newer ones are never read by `laterFound`; whether it should read past them (a cursor, or newest first) is `notice-producers`' reading and a later entry's, reported to BOB.
