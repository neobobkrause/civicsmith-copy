# Investigation lane research: requirements of the modules this area serves

Tree: tranche `617b48f5`. Sources:
- `process/ledger/<id>.json`: the ledger entry, its `status` and `uses`;
- `build/modules.json`: layer, order and uses;
- `build/requirements/<id>.md`: the requirement ids.

"Unmet" lists the ids whose requirement line carries `*(not yet met …)*`, found by a grep of `**Rn**` lines. Ledger `status` is the state of the module's latest job, not of every requirement. The counts were produced by a script over these files, and the script's output is quoted in section 4.

## 0. The lane's own module: `investigation-design`

- `process/config.json` declares the lane `{name: "investigation", dir: "docs/development/investigation-design/", module: "investigation-design"}`.
- The other lanes are ux (`ux-design`) and publication (`publication-design`).
- **No ledger entry** `process/ledger/investigation-design.json` exists. Only `ux-design.json` exists among the design modules.
- **No** `build/requirements/investigation-design.md` exists. **No** `docs/requirements-notes/investigation-design.md` exists.
- **No** `build/modules.json` row exists. `ux-design` has none either: design modules exist only as ledger entries (`process/ledger/ux-design.json`, layer 11, `uses: [setup-words]`, status COMPLETE 2026-11-06T05:29:36Z).
- The research area `docs/development/investigation-design-research/` does not exist yet. BD-2 says the research "lands as a lane-only PR before the lane takes any ask" (`DECISIONS.md:25-40`).
- The lane folder holds only `README.md`, seeded by BOB (`docs/development/investigation-design/README.md:1-9`).
- `build/manifest.md:64` still describes the earlier INVESTIGATION-DESIGN lane on branch `design/investigation`, recording D-numbers (D1–D24 from the study, D25 onwards) and H-numbers.

## 1. Summary table

L = layer. Pos = place in `build/modules.json`'s total order (0-based index).

| module | L | pos | ledger | ledger state (at) | R ids (count, range) | unmet ids | investigation canon it serves |
|---|---|---|---|---|---|---|---|
| **investigation** | 7 | 119 | yes | COMPLETE 2026-11-06T13:46Z | 32, R1–R32 | none on R lines; **F1** suggestion open | IV §3 milestones and status reports, §6 interview, §8 narrative, §10 planning, §2 project page and quiet |
| **steps** | 6 | 96 | **no** | none | 30, R1–R30 (R25 retired) | none | IV §3, §4 |
| **question-explorer** | 6 | 111 | yes | COMPLETE 2026-11-05T16:18Z | 17, R1–R17 | none (F1 suggestion) | IV §5, §6, §9 |
| **reading-guides** | 6 | 109 | yes | COMPLETE 2026-11-05T01:44Z | 20, R1–R20 | none | IV §6 reading guides |
| intent | 7 | 118 | yes | COMPLETE 2026-11-04T11:53Z | 37, R1–R37 | none | IV §2 objective, condition, progress, gaps, close |
| inquiry | 6 | 94 | yes | COMPLETE 2026-11-05T21:49Z | 70, R1–R90 | R31 | IV §2 shared questions, §1 legs and conclusions; waits |
| inquiry-grammar | 6 | 91 | yes | COMPLETE 2026-11-05T05:08Z | 22, R1–R70 | none | IV §11 `bias_applied` on a leg (R18) |
| hypotheses | 6 | 95 | **no** | none | 24, R1–R24 | none | IV §5 the system's hypotheses, §8 shared notes |
| leg-earning | 6 | 93 | yes | COMPLETE 2026-11-04T05:52Z | 20, R1–R20 | none | IV §2 drawing projects, §5 AI-found fact grade, §6 transcription |
| contradiction | 6 | 101 | yes | COMPLETE 2026-11-05T01:39Z | 62, R1–R62 | R34, R41, R57 | IV §1 (DEC-76); §2 non-hidden parties (R50, R55) |
| observation-log | 5 | 75 | **no** | none | 41, R1–R41 | none | IV §4 looks, "looked, absent", later-found (R37) |
| retrieval | 5 | 87 | **no** | none | 99, R1–R99 | none | IV §4 search; investigation R27 term search |
| reading-pipeline | 4 | 67 | yes | COMPLETE 2026-11-04T16:52Z | 45, R1–R68 (R45–R58, R60–R67 moved to `reader-contract`) | R68 | IV §6 reading inside documents (`partsOf`) |
| project-roster | 2 | 44 | **no** | none | 45, R1–R45 | none | IV §2 who sees a project; investigation R26 |
| skills | 6 | 110 | yes | COMPLETE 2026-11-05T08:13Z | 51, R1–R51 | none | IV §6 interview questions, guides as skills, AI rules (R40–R44) |
| screens-inquiry | 11 | 195 | yes | COMPLETE 2026-11-05T05:47Z | 153, R1–R153 | R140–R152 (T53) | project home, question page, objective screen (R106), close (R109), proposals (R142, R143) |
| screens-investigate | 11 | 198 | yes | COMPLETE 2026-11-05T10:01Z | 93, R1–R93 | R67–R93 (T53) | **not IV's steps or milestones**: people, explore, timeline, money, calculations, proceedings |
| case-grammar | 8 | 121 | yes | COMPLETE 2026-11-04T09:34Z | 39, R1–R39 | none | IV §11 account block (R23), bias applications (R24), review comments (R25), approvals (R26) |
| case-authoring | 8 | 138 | yes | COMPLETE 2026-11-05T12:36Z | 91, R1–R91 | none | IV §11 account, statements, no stories (R63, R65, R67, R68) |
| case-checker | 8 | 133 | yes | COMPLETE 2026-11-05T11:26Z | 32, R1–R32 | R29–R32 (registers, T53) | IV §11 lens re-check (R23), account check (R24) |
| case-disclosures | 8 | 135 | yes | COMPLETE 2026-11-05T04:39Z | 46, R1–R46 | R37–R45 (T53) | IV §11 sentence checks (R30), bias applications (R31) |
| case-tensions | 8 | 124 | yes | COMPLETE 2026-11-04T15:29Z | 12, R1–R12 | none | contradictions printed in a case |
| case-inputs | 8 | 137 | yes | COMPLETE 2026-11-04T15:37Z | 29, R1–R29 | none | outcomes carried into an edition (Action v0.2); little that is IV-specific |
| case-account | 8 | — | yes | — | (see notes) | — | IV §11 the drafted account (R1, R5, R6) |
| case-import | 8 | — | — | — | (see notes) | — | IV §11 accept the whole case (R22), importer's lens (R23), `regradeImported` (R27) |

Other modules that carry requirements tied to IV (each cites `draft-T41-investigation.md`, D-numbers or K2417 and K2418), found by grep:
- `ai-runs` (R74 several steps at once, R75 test bar, R76 actual cost);
- `ai-use` (R2–R4, R9–R11: limits, the exploring ask, estimates);
- `run-rules` (R24 mode `enquire`, R25 draft kinds, R26 `pages` bound);
- `run-productions` (R21 reading proposals, R22 the one accept act, R23 bearing note);
- `record-grammar` (R52 `ACCEPTANCE_FORMS`);
- `extraction` (R71 page transcription; R114–R118 interpretation of parts);
- `basis-versions` (R48);
- `bias` (R49);
- `queue` (R52);
- `notice-producers` (R17);
- `op-declarations` (R43);
- `affordances` (the investigation's acts);
- `scheduler` (R26);
- `monitoring`, `plan-work`, `wizard-scripts`, `answers`, `publish-schedule`, `review`, `control-plane`, `text-chain`.

Two lists were used to find these:
- `grep -l -E "BIO_Investigation|draft-T41-investigation|investigation-design|K2417|K2418" build/requirements/*.md`;
- ledger entries naming `investigation` or `inquiry` in `uses`: action-plans, actions, affordances, ai-runs, answer-envelope, basis-versions, capture-requests, case-account, case-authoring, case-disclosures, citation, conformance, consequences, contradiction, control-plane, docket, inquiry, intent, investigation, monitoring, notice-producers, op-declarations, plane, project-stage, publication, question-explorer, queue-producers, queue, ratification, reevaluation, run-productions, scheduler, screens-document, screens-inquiry, store-assembly, store-door, store-jobs, strength.

## 2. Per-module notes

### investigation (`build/requirements/investigation.md`)

**Status**
- "Draft, BOB's", written at T41 from `draft-T41-investigation.md` §3.3 (line 3).
- The latest history line says met (K4214). T53 added R26–R32.

**Purpose**
- A project's own working material: milestones, status reports, the interview and its narrative, planning proposals, the project page, and the quiet prompt.
- It publishes nothing. (line 11)

**Requirements**
- **Milestones, R1–R5**:
  - R2: met, open, stuck, nearing, overdue. Only *this* project's `concluded` stance counts. A step `set_aside` or a question deferred leaves the milestone stuck.
  - R3: told once (DEC-94).
  - R4: never shared.
  - R5: never a duty or a finding. (lines 17-21)
- **Status reports, R6–R10**:
  - R6: drafted by code with no AI (D42).
  - R8: no figure about an individual member.
  - R9: never scheduled.
  - R10: working material, never published. (lines 25-29)
- **Interview, R11–R13**:
  - R11: `INTAKE_QUESTIONS` is held by `skills` R41.
  - R12: kept as `kind: "narrative"`, a project-placed step. `INTERVIEW_NOT_A_LEG` is C-146.26. (lines 33-35)
- **Narrative, R14–R16**:
  - R14: `narrativeClaim` and `claimFindStep`.
  - R15: `as_recalled` until a record is tied, then `found`. The look states are `not_yet_looked_for` and `looked_for_and_not_found`.
  - R16: testimony goes through the `testify` path of `provenance` R28. (lines 39-41)
- **Planning, R20**: `planPropose` and `planAccept`, one accepting act, in mode `enquire`. (line 45)
- **Quiet and standing, R17–R19, R24**:
  - R17: `quietState` is a display.
  - R18: `quietPrompts` once per quiet spell, plus `projectWatch`, `projectCloseWithGaps` and `watchArrival`.
  - R24: an owner's close at any time, with `closed_reason` resolved, superseded or abandoned.
  - R19: `projectStanding`, no score. (lines 49-55)
- **Ops, R25**: `projectclose` declared. (line 58)
- **T53 interpretation of parts, R26–R32** (N1272; K5445, K5495):
  - R26: `markForInterpretation`.
  - R27: `proposeParts`, mechanical, no AI, no score, ordered by document position.
  - R28: `acceptProposals`, DEC-77's acceptance shape.
  - R29: proposals only for a file kind whose measure is met; `proposalRates`.
  - R30: `interpretedFor`.
  - R31: told to later investigations, naming only projects the viewer may see.
  - R32: "No assistant proposes parts in this release". (lines 62-74)
- **Invariants**:
  - R21: every act has a by-hand path.
  - R22: a person with no public role warns and never refuses.
  - R23: `NO_SUCH_PLANNING_PROPOSAL`. (lines 94-96)
- **F1** *(not yet met)*: declare `acceptProposals` as reversible and refused to a machine (`surface-declarations` R17, BOB's grade). (line 106)

**Satisfies**
- "The investigation design of record (K2417): D1, D15, D16, D19, D20, D27, D30, D48, H27, H28", plus N1272 (lines 100-101).
- These are the lane's D and H numbers, which IV:3 says "are not canon". `build/requirements/README.md` convention 8 requires citing canon by section.

**Defects found**
- **Cross-references point at the wrong screen ids.**
  - R26 cites `screens-inquiry` R143 for marking a whole document. R29 cites `screens-inquiry` R145 for "unavailable". R31 cites `screens-inquiry` R147 and `screens-daily` R109.
  - In the files: `screens-inquiry` R143 is "proposals unavailable", R145 is "who it is about", R147 is "Ask to join" (`screens-inquiry.md:289-293`).
  - The document-page items moved to `screens-document-beta` R64–R68, and the search mark is `screens-daily` R111 (`screens-document-beta.md:19-27`; `screens-daily.md:237`). K5564 moved the document page to `screens-document`.
- **Uses mismatch.** The Private Uses names `hypotheses` (line 88), but neither `build/modules.json` nor the ledger lists `hypotheses` in investigation's `uses`.

**Dependencies (ledger `uses`)**
record-grammar, jurisdictions, civil-time, record-core, membership, promotion, provenance, extraction, content, entities, connections, observation-log, leg-earning, inquiry, basis-versions, capture-requests, steps, skills, intent, setup-words, test-support, contradiction, project-roster, reading-pipeline, retrieval.

**Used by**
monitoring, affordances, notice-producers, queue, op-declarations, answer-envelope, store-assembly, screens-inquiry, screens-document, control-plane, plane.

### steps (`build/requirements/steps.md`)

**Status and gaps in the record**
- "Draft, BOB's", from §3.1 of the T41 draft. Later lines say met.
- **No ledger entry.**
- **Satisfies is stale**: "canon `BIO_Investigation_v0_1.md` once approved (owed, K2418)" (line 101). IV was approved on 2026-10-09.

**What it requires (IV §3, §4)**
- R1: `stepCreate` with exactly one place (questions, project or group). `work` is 1–500 characters. No purpose, method or parent field.
- R2, R3: sight. A hidden project is never named or implied.
- R4: reads, and `stepsOn`'s header carries the drawing projects.
- R5: states `planned → underway → ended | set_aside`. Per-question outcomes are `helped`, `dead_end` or `undetermined`. A machine never records helped or dead end.
- R6: deletion. Touched steps keep their record.
- R7, R8: `stepsLike` and `stepRefer`. A machine is refused `STEP_ALIKE_EXISTS`.
- R9: products, and why a record is held (`stepsOf`).
- R10: learned.
- R11: waits, with a cycle refused.
- R12: by-when, told once (DEC-94).
- R29, R30: one date and one reminder with `action-clocks`.
- R13–R15: cost and the cost notice. Nothing is sent when a hidden project shares the step. The relayed message names no project.
- R16, R17: following a question.
- R23: later-found data through `observation-log` R37.
- R24: proposed steps and one accept act.
- R18: the `step` authority resolver, and `STEP_NOT_A_LEG`.
- R26: acceptance counts, group-wide only.
- **Invariants:**
  - R19: working material;
  - R20: nothing measures a member;
  - R21: a step holds no step;
  - R27: steps never read the project's bar.
- Lines 15-97.

**Uses**
record-grammar, jurisdictions, civil-time, calc-grammar, connection-grammar, record-core, membership, promotion, provenance, extraction, content, entities, connections, observation-log, leg-earning, setup-words. It deliberately does not use `inquiry` (line 87).

**Open (Suggestions)**
- `laterFound` reads the oldest 5,000 entries only (line 107).
- IV §4 "change tracking brings it to the questions that rest on it" is therefore bounded.

### question-explorer (`build/requirements/question-explorer.md`)

**Built but not offered.** "Built and tested; offered to no member until R7's gate (D11's bar) opens" (line 5).

**Requirements (IV §5, §6, §9)**
- R1: scheduler hooks, plus `ai-use.exploreAllowed` and `exploreAsk`.
- R2: "worth exploring", at most 200 a tick.
- R3: the run is a system step, origin `explore`.
- R4: the gauge is `supports`, `cuts_against` or `unclear`, with `false_alarm_rate`, and is "never a grade, never stored as a score, never hides, ranks or orders".
- R5: told once to `steps.findRecipients`.
- R6: the member's doors (dismiss, accept, hold a hypothesis, start a step).
- R7: the gate, a D11 bar with false alarms at most 20%.
- R8: limits.
- R9, R10: persons only when a member tied them, at most 20 a run.
- R11: a group's own test investigations.
- R12: cost.
- R13: reading inside documents.
- R14: contrary finds equally prominent (CF invariant 7).
- R15–R17: factory, test-instance exception, awaited close.
- Lines 15-31.

**Open**
- F1 (K5821, REC-11): the run's accountable member is the one who enabled exploring (line 62).

**Uses**
record-grammar, civil-time, record-core, membership, credentials, content, entities, connections, retrieval, leg-earning, inquiry, steps, basis-versions, run-rules, ai-use, ai-runs, run-productions, capture-requests, ai-accounts, setup-words.

### reading-guides (`build/requirements/reading-guides.md`)

- R1: `CIVICSMITH_GUIDES` is frozen. Each guide is approved by Bob or a delegate and carries its measured-use record (line 17). This matches IV §6.
- R3: a second member reviews (line 19).
- R4: `checkGuide` refuses `GUIDE_CARRIES_CONDUCT` (line 20).
- R5: `guideFor` resolves the member's own guide, then the group's, then Civicsmith's (line 21).
- R6: offer and adopt across groups (line 22).
- R13 and R15: procedure guides for actions (Action v0.2 rule 11) (lines 26, 28).
- IV §10 says its "placement and name are BOB's". It sits in layer 6 after capture-requests (`build/modules.json` status, T41 amendment).

### intent (`build/requirements/intent.md`)

**Purpose:** aspirations, goals and objectives with a condition. Progress is computed. Gaps are proposals. The discovery loop (line 11, citing CF §12).

**Requirements**
- R1: a project must state an objective (C-2.9).
- R2: `setCondition`, refused to a machine (`MACHINE_CANNOT_SET_OBJECTIVE`), with a reason required.
- R3: "progress cannot be computed … never reads as zero".
- R4, R5: matched, meeting and short.
- R6: gaps, as `objective-gap` proposals.
- R7: `watchSet` for monitoring.
- R29: `closed_reason`.
- R31: money filters.
- R32: the person warning, from T41.
- R33: "records request answered that none exists" meets a stage (H30 (1)).
- Lines 17-69.

**Gap against IV**
- The condition is one progression × entity × grade × stages (line 15).
- IV §2's "the objective is the measure … whether or not every question has been answered" has no condition form over questions or conclusions.

### inquiry, inquiry-grammar, leg-earning, hypotheses, contradiction, observation-log

**inquiry** (`inquiry.md`)
- It is the recursive object, citing Case Making's collapse (purpose).
- R39: deferral and dismissal per project (H10, H38, D64).
- R54, R55, R58: waits.
- R59: the person warning (D13).
- R60: every read of a question answers its non-hidden `projects` (H38).
- R61: `bias_applied` must be in force.
- R85: a partition labels supporting legs only.
- Unmet: **R31**, an opinion is refused as a leg (MK-5).
- Lines 21-195.

**inquiry-grammar**
- R18: the leg's `bias_applied` encoding (D59) (`inquiry-grammar.md:53`).

**leg-earning**
- R13: `projectsDrawingOnPaged`.
- R14: `projectsShownOn`. A hidden project is never answered, named or counted.
- R15: the AI transcription's capture ceiling is undetermined unless attested.
- Lines 38-40.

**hypotheses**
- R16: `hypothesisPropose`, the machine's only door: stored apart, labelled with method and false-alarm rate.
- R17: `hypothesisTakeUp`.
- R18: a proposal set aside stays readable, and `MACHINE_CANNOT_HYPOTHESISE` stands.
- R19–R21: `noteShare`, `noteUnshare`, `sharesOf`.
- R14: notes are never cited, published or counted.
- Lines 42-71.
- **No ledger entry.**

**contradiction**
- R50 and R55 were amended in T41: non-hidden parties are named (D64).
- Unmet: R34, R41 (N345) and R57 (the over-strictness gate) (`contradiction.md:147,182,210`).
- Its status says the "K5 arms of five requirements" wait on "no measured recommender run, K488" (line 3).

**observation-log**
- R1: levels and states (`LOOKED_ABSENT`, `LOOKED_INDETERMINATE`, `partial`, `PRESENT`, `NEVER_LOOKED`), with the authority kind `step` added by T41.
- R13: visibility.
- R37: `onLookAnswered` (H39).
- Lines 18, 50, 73.
- **No ledger entry.**
- Its canon design `OBSERVATION-LOG-DESIGN.md` is "Not yet reviewed by Bob" (line 3).

### skills, run-rules, run-productions, record-grammar (the AI side of IV §6)

**skills** (`skills.md:69-73`)
- R40: the `reading_guide` layer.
- R41: the `enquire` layer and `INTAKE_QUESTIONS` (six, frozen).
- R42: the `explore` and `reading` layers.
- **R43: every clause of R40–R44 must be found in "the plain-language AI rules Bob approved … as canon holds them (`BIO_Investigation_v0_1.md`, owed)".** The "owed" is stale, since IV is canon. Whether IV holds the AI rules as normalisable plain-language clauses needs checking: IV §6 says the rules are "approved by Bob in plain language, as part of this design", but IV itself gives only one example.
- R44: the `case_account` and `account_check` layers.

**run-rules**
- R24: mode `enquire` (interview and planning), deployed by its own flag once its test bar is held.
- R25: draft kinds `case_account`, `account_check`, `bearing_note`.
- R26: the `pages` bound.
- Lines 48-50.

**run-productions**
- R21: passages and connections while reading.
- R22: `proposalAccept`.
- R23: `bearingNote`, sentence by quote.
- Lines 39-42.

**record-grammar**
- R52: `ACCEPTANCE_FORMS = [as_proposed, edited, own_instead]`, the one acceptance shape across steps, hypotheses, run-productions, question-explorer, investigation and case-account (line 100).

### case-* (IV §11)

**case-grammar**
- R23: the `account:` block, with `began_as` `member` or `machine_draft` and `bias_statement`.
- R24: `bias_applications:`.
- R25: `review_comments:` with the count left out.
- R26: `approvals:` and `approvalSubjectSha`.
- Lines 141-144.
- R29: outcomes (Action v0.2) (line 176).

**case-account**
- R1: `accountPropose` in `ACCOUNT_FRAMINGS` (`time_order`, `by_question`, `by_rule`).
- R5: shape.
- R6: judgment.
- R14: counsel matter.
- `case-account.md:34-88`.

**case-authoring**
- R63: the account.
- R65: only the four statements plus scope, bias acknowledgement and account. "a field carrying a story … is refused `CASE_FIELD_NOT_ALLOWED`" (D57).
- R67: pre-flight shows each sentence.
- R68: `APPROVAL_MISSING` (D60).
- `case-authoring.md:213-218`.

**case-checker**
- **R23**: the lens re-check (as_published, removed, a reader's own) with the honest-limit sentence (D59). It has no unmet mark, which matters for IV §11's "regrade … not built" (see the conflicts in `canon.md`, item 8).
- R24: `checkAccount`.
- Lines 72-73.
- Unmet R29–R32 are register extracts (T53), not about investigation.

**case-disclosures**
- R30: `accountJudged`.
- R31: `biasApplicationsOf`.
- Lines 162-163.
- Unmet R37–R45 are typed passages, registers and personal data (T53).

**case-import**
- R22: `acceptImported({findings: "all"})` (D62).
- R23: the importer's own lens.
- R27: `regradeImported`, `op=importregrade`.
- `case-import.md:87-92`.

**case-tensions**
- All met. It prints contradictions in the case.
- It is a copy split from `publication` (`case-tensions.md:3`).

**case-inputs**
- An edition's pending outcomes. No IV-specific requirement was found.

### screens

**screens-inquiry**
- Purpose: "The investigation's working screens: a project's home, one question …, and the assistant's panel" (purpose section).
- R106: the `objective` screen (`intent` R2–R18).
- R109: "Close this project now" (`projectclose`).
- R142, R143: the parts-proposals list and the unavailable notice (T53, unmet).
- R140–R152: all unmet (T53).

**screens-investigate**
- Purpose: "a person … connections …, a project's timeline, a money trail, a calculation …, a court or regulatory proceeding …" (line 9).
- **It does not draw steps, milestones or status reports.**
- R67–R93 are unmet (T53: follow from here, explore paths, empty states).

**Coverage gap: no screen requirement draws IV's own working material.**
- A grep of `build/requirements/screens-*.md` and `wizard-scripts.md` finds no requirement that draws:
  - milestones;
  - the intake interview;
  - status reports (`reportDraft`, `reportKeep`);
  - narrative claims (`as_recalled`);
  - `projectStanding`;
  - `planPropose`;
  - `stepCreate` or `stepsOn`;
  - cost sharing;
  - `questionFollow`;
  - the explorer's finds (`question-find`).
- The ops are declared: `op-declarations` R43 lists the steps ops and investigation's `milestoneset` and the rest (`op-declarations.md:183`). `affordances` has "The investigation's acts" (`affordances.md:83`). `queue` R52 gives the `question-find` dispositions (`queue.md:97`).
- The design stream has words for milestones (`docs/development/ux-substrate/screens/words-*.json`), but no screen requirement uses them.
- Only `plan-work`'s status report for an action plan is drawn (`plan-work.md:31,44`), and it is a different construct.
- This matches IV:8: the member-facing names of a step, a milestone and a status report are unruled (D23, "owed with the UX stream").

### project-roster, retrieval, reading-pipeline (providers)

**project-roster**
- No ledger entry. Layer 2.
- Who is in a project, and `projectScope` (`counsel_matter`), which `case-account` R14 and `case-authoring` R72 read.
- investigation R26 reads whether the viewer is in the project.

**retrieval**
- No ledger entry.
- R78: the question row in search answers `projects` (`inquiry` R60).
- investigation R27 uses its text search per term.

**reading-pipeline**
- R1–R44, R59 and R68 are its own. R45–R58 and R60–R67 moved to `reader-contract` (BOB, 4 Nov, PR 274).
- `partsOf` is `reader-contract` R65, which `reading-pipeline` re-exports. investigation R27 uses it.
- Unmet: R68.

## 3. Open questions for the lane, from the requirements side

1. Should `investigation-design` get a ledger entry and a requirements file like `ux-design`'s, with R1 to keep the research and decisions honest? Today nothing exists for it.
2. **D23** is unruled: the member-facing names for a step, a milestone, a status report, and investigation work versus the action plan (IV:8). Owing to that, no screen requirement draws milestones, steps, the interview, status reports, narrative claims or the explorer's finds. This is the largest gap between the built services and what a member reaches.
3. Should the investigation and steps "Satisfies" lines move from lane D and H numbers to IV sections (README convention 8)? Should the stale "owed" in `steps.md:101` and `skills.md` R43 be cleared?
4. Investigation R26, R29 and R31's screen cross-references (`screens-inquiry` R143, R145, R147; `screens-daily` R109) no longer point at the right requirements.
5. Does IV intend an objective's condition over questions, beyond `intent`'s progression form? See `canon.md` §5 item 4.
6. Regrade: is the case-checker R23 and case-import R27 lens re-check the "regrade" IV §11 and Declared Bias say is not built? If so, IV's incomplete line is stale.
7. `skills` R43 requires the AI's rules to exist as clauses in canon that a normaliser finds. Does IV carry them, or does it still owe them?
8. The investigation module says it uses `hypotheses`, but `modules.json` does not list that edge.
9. `steps` R23 `laterFound` reads only the oldest 5,000 entries (`steps.md:107`), so IV §4's later-found guarantee is bounded.

## 4. Raw counts as produced

Produced by a script over `build/modules.json`, `process/ledger/*.json` and `build/requirements/*.md`, run in the scratchpad.

```
investigation | layer 7 | pos 119 | ledger COMPLETE 2026-11-06T13:46:23Z | 106 lines; 32 ids R1–R32
steps | layer 6 | pos 96 | ledger: none | 107 lines; 30 ids
question-explorer | layer 6 | pos 111 | COMPLETE 2026-11-05T16:18:38Z | 62 lines; 17 ids
reading-guides | layer 6 | pos 109 | COMPLETE 2026-11-05T01:44:38Z | 72 lines; 20 ids
intent | layer 7 | pos 118 | COMPLETE 2026-11-04T11:53:51Z | 136 lines; 37 ids
inquiry | layer 6 | pos 94 | COMPLETE 2026-11-05T21:49:49Z | 245 lines; 70 ids R1–R90
inquiry-grammar | layer 6 | pos 91 | COMPLETE 2026-11-05T05:08:25Z | 100 lines; 22 ids R1–R70
hypotheses | layer 6 | pos 95 | ledger: none | 93 lines; 24 ids
leg-earning | layer 6 | pos 93 | COMPLETE 2026-11-04T05:52:29Z | 92 lines; 20 ids
contradiction | layer 6 | pos 101 | COMPLETE 2026-11-05T01:39:15Z | 415 lines; 62 ids
observation-log | layer 5 | pos 75 | ledger: none | 133 lines; 41 ids
retrieval | layer 5 | pos 87 | ledger: none | 226 lines; 99 ids
reading-pipeline | layer 4 | pos 67 | COMPLETE 2026-11-04T16:52:44Z | 135 lines; 45 ids R1–R68
project-roster | layer 2 | pos 44 | ledger: none | 120 lines; 45 ids
skills | layer 6 | pos 110 | COMPLETE 2026-11-05T08:13:04Z | 148 lines; 51 ids
screens-inquiry | layer 11 | pos 195 | COMPLETE 2026-11-05T05:47:11Z | 306 lines; 153 ids
screens-investigate | layer 11 | pos 198 | COMPLETE 2026-11-05T10:01:40Z | 167 lines; 93 ids
case-grammar 121 | case-tensions 124 | case-checker 133 | case-disclosures 135 | case-inputs 137 | case-authoring 138 (all layer 8, ledger COMPLETE 4–5 Nov)
```
