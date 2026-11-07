# investigation — requirements

**Status** · Draft, BOB's (K2405, K2418, K2420): a new product module Bob approved (D51 A, D1), placed by BOB, written at T41's opening from `build/plan/draft-T41-investigation.md` §3.3 (N820; D1, D15, D16, D19, D20, D27, D30, D48, H27, H28). Every requirement not yet met (T41). Last changed T42 (T42-21: R12 amended and R23 new, its own codes for C-146.26 and C-146.21, re-coded in place; R18 amended, `watchArrival` records then marks failed reads unread, `watchedProjects()` carries every source; N843, N846; K2566, K2572, K2608), not yet met. Last changed T51 (FR-15: R24, R25 new, amending R18; C65, K4168); met (K4214).

**Size (P6).** About 1,900 lines.

## Public

### Purpose

A project's own working material over its steps and objective: milestones (D27), dated status reports drafted from the record (D30), the intake interview and its narrative (D19, D20), planning proposals (D1), the standing read of the project page and the quiet-project prompt (D16, H28). It publishes nothing and writes only its own tables.

### Provides

#### Milestones (D27, D48)

- **R1** `milestoneSet({project, name, date, waitsOn, by})`, `waitsOn` a list of questions the project draws on and steps its participants see; `milestoneRevise`, `milestoneRemove`, `milestoneItemRemove({milestone, item, reason, by})`, each with history. By a joined participant (`membership` R55); a project not at `FULL` answered as `membership` R44 says. Refusals `MILESTONE_NO_NAME`, `MILESTONE_BAD_DATE`, `MILESTONE_WAITS_ON_NOTHING`, `MILESTONE_ITEM_UNKNOWN` (an item not of this project, answered as absent).
- **R2** (D48 as ruled) State, derived on read: `met` when each item is done (a question: this project's stance is `concluded`, `basis-versions` R22, another project's conclusion not counting; a step: `ended`, whatever its outcome), else `open`; an item this project deferred or dismissed, or a step `set_aside`, is not done and shows the milestone `stuck`, naming it; `nearing` within 7 local days changes only display; `overdue` past its date and not met. Each item shows its own state; a milestone never reads `met` when the work was dropped.
- **R3** `milestonesOverdue({viewer, at})` answers each overdue milestone once to each joined participant (key per milestone and date), for `notice-producers`. `milestoneReminder({milestone, at, by})` is a reminder a member asked for, answered to her alone on that day. Nothing else reminds (DEC-94).
- **R4** Milestones are never shared: another project drawing on the same question sets its own; no answer about a milestone reaches outside its project.
- **R5** (Ladders §10) A milestone is the group's own date: never a duty, standard, clock or finding about a public body, and no other module reads one as such.

#### Status reports (D30)

- **R6** `reportDraft({project, question?, viewer})` composes, by code and with no AI (D42), from the record since the last report kept for that project (or that question in that project): steps taken and ended on the project and its questions, with outcomes and learned lines; what was found (products tied to those steps, legs added, the project's conclusions and withdrawals); what is waiting (step waits, the question's waits `inquiry` R55, R58, open milestones). Each line cites its source. Only what the viewer may see enters. It writes nothing.
- **R7** `reportKeep({project, question?, text, since, by})`, by a joined participant: the member edits the draft and adds her own words; it is kept as she keeps it, dated, with its author, never edited after (a later report may correct it). `reportsOf({project, viewer})` answers the participants.
- **R8** (D30; DEC-68) No draft or report states a figure about an individual member: handles appear only as attribution of a step or act, never counted, ranked or compared.
- **R9** No report is required or scheduled; nothing reminds anyone to write one.
- **R10** (D15) Milestones, reports, the interview, narrative claims and plan proposals are working material: never published, never carried by a case. Tables keyed by project and purged with it. No place is named in behaviour or outward text.

#### The intake interview (D19)

- **R11** `INTAKE_QUESTIONS`, held by `skills` (its R41, K2472; read from there, never re-listed), is the one frozen list of six: what happened; which public body, and where; since when; what was promised or expected, and by whom; what you already have; what you want to come of it. Both paths ask exactly these: by hand, one page (`interviewForm`); with the assistant, a conversation in mode `enquire` (`run-rules` R24) that skips what she has already said and follows up, whose output is the same six answers as a labelled draft.
- **R12** `interviewKeep({project, answers, from_draft?, by})`, by a joined participant: the member checks the answers before they are kept; each answer is kept in her words as **narrative** (`kind: "narrative"`), with whether it began as the assistant's draft and was kept unchanged or edited (`record-grammar` R52). The interview is a project-placed step of the project (`steps` R1), its record the step's product. An interview is never evidence, never a body's statement, never a leg target (a check registered with `promotion` refuses it, `INTERVIEW_NOT_A_LEG`, C-146.26; T42, N843: hypotheses' `NARRATIVE_NOT_A_LEG` names a shared note).
- **R13** `interviewOf({project, viewer})` answers the project's participants the kept interviews, each labelled as the member's own account.

#### Narrative and evidence (D20, H25)

- **R14** `narrativeClaim({project, source, text, about?, by})` records a claim in a member's narrative about what a public body said or did, as a quoted span of an interview answer or of her own words; `claimFindStep({claim, by})` creates (or, from the assistant, proposes, `steps` R24) a "find the record" step on the claim's question or in the project, linked to the claim. By hand the member does the same.
- **R15** A claim reads `as_recalled` until a member ties a record to its find step (`steps` R9) and marks it found (`claimFound({claim, record, by})`), then `found`, naming the record; and states its look: `not_yet_looked_for`, or `looked_for_and_not_found` naming where (the step's looks). No answer shows a claim as what the body said while it is `as_recalled`.
- **R16** A member who was present records her firsthand account through the built `testify` path (`provenance` R28), testimony graded and labelled as hers; nothing here grades it.

#### Planning proposals (D1, D3)

- **R20** `planPropose({project, kind, text, question?, run, by})`, from mode `enquire`, stores a proposed question or step drawn from a member's words, labelled the system's; `planAccept({proposal, form, text?, by})` is the member's one accepting act (`record-grammar` R52): a question by her own promotion (`inquiry`), a step by `steps` R24. Nothing becomes a question or step without it.

#### Where the evidence stands, and when the work goes quiet (D16, H27, H28)

- **R17** `quietState({project, viewer})` answers `quiet: true` when every step of the project and of the questions it draws on is ended or set aside and nothing is awaited (no unmet step wait, dated wait or open capture request); it is a display, never a stage.
- **R18** `quietPrompts({viewer, at})`, for `notice-producers`, answers once per quiet spell to the project's joined participants: the objective, its condition and `intent.progress`/`gaps` as they stand. The members' doors are: write up and act (when `satisfied`); `projectWatch({project, by})` (keep watching the sources `intent` R7 names, `monitoring`, and reopen the work when something arrives); close with the gaps recorded as what remains unknown (`projectCloseWithGaps({project, reason, by})`, the project's `closed_reason`, `intent` R29, with the gaps read at the act kept beside it); or revise the objective or condition with a reason (`intent` R2). Nothing more is asked in that spell. No member act declares the objective met (H28). (K2524) `watchArrival({project, source, at})`, for `monitoring` only, records that a source a watched project keeps watching brought something new: the project's work reads reopened (no longer quiet, so a later quiet spell prompts again), the arrival is answered with the project's reads, and a project not watched is refused, writing nothing. (K2572, wording: the service `monitoring` R70 reads) `watchedProjects()`, for `monitoring` only, answers each watched project with the sources `intent` R7 names for it (its first page). (T42; N846; K2572)
  - `watchArrival` never throws for an arrival it has recorded. Once the arrival is written it answers `ok: true` with each of its reads (`quiet`, `standing`, `milestones`) as read after the write. A read that fails is answered `{unread: <why>}` in its place.
  - A refusal, or a failure before the write, records nothing.
  - `watchedProjects()` answers each watched project with every source `intent` R7 names for it, following R7's `cursor` to its end, never its first page alone. A project whose sources cannot be read whole is answered `watch: null` with `watch_unread` naming why, never a partial set as whole.
- **R24** (amends R18; C65; DEC-381; `project-stage` R2; State Rules v1.5, 'How a project's stage is shown', K356, K362) `projectClose({project, reason, note?, by})` closes a project at its owner's choice, whether or not its work has gone quiet: `closed_reason` one of `resolved`, `superseded`, `abandoned` (`intent` R29), the gaps read at the act kept beside it as R18's close keeps them, the close made through the same revision of the project's document (`promotion`). The close is the owner's recorded act, never a stage the record grows into, so `project-stage` R2 then reads the project `closed` with that reason. Refusals as R18's, none of them `QUIET_NOT_QUIET`: a machine (`INVESTIGATION_MEMBER_ONLY`), a project not seen or not joined (`membership` R44, R55), a reason outside the three (`CLOSE_BAD_REASON`), a note empty or too long (`INVESTIGATION_NO_REASON`), and a joined participant who does not own the project (`PROJECT_ACT_NOT_THE_OWNER`, `membership` R122's one answer for the owner-only condition); each writes nothing. `projectCloseWithGaps` (R18) is the quiet path and stays as it is.
- **R19** `projectStanding({project, viewer})` answers the project page: the objective and its condition, `intent.progress` (or "cannot be computed" with no condition), each question the project draws on with its legs grouped as supporting or cutting against and this project's conclusion beside the bar, and `intent.gaps`. It composes no score and names no member's share.

#### Its declared ops (T51; K4168)
- **R25** (K4168; `op-declarations` R80, `op-grades` R49) The module states, as `DECLARED_OPS`, each op it serves that a screen sends or that this tranche adds, with the fields it accepts and requires: `projectclose` (R24). `investigationOps` serves it, answering as `projectClose` does; a test holds the declaration true by calling the op as the door does.

**Marking, proposing and accepting parts to interpret (T53; N1272, K5445, K5495, K5496)**

- **R26** (T53; N1272; K5445 B; amends R3) **`markForInterpretation({project, capture, parts, by})`: a member's deliberate act, "interpret these parts for this investigation".** For each named part calls `extraction.interpretPart` with `how: marked`. It takes at most 50 parts a call; a part larger than the cell and unit bounds of `extraction` R115 is taken in blocks and the answer lists each block with `next`; more than 50 is refused `TOO_MANY_PARTS` with the number named and the bound. It is refused for a project the member is not in. The whole document may be named as the parts; that is the member's act, in plain sight (`screens-inquiry` R143), and is bounded as `extraction` R119. Test: marking pages 3 to 9 and sheet "Sewer" rows 1 to 5,000 records two rows for the project, `how: marked`; a 51-part call is refused by number. Control: no op interprets a capture without naming parts, and no path interprets a part nobody opened, cited, marked or accepted (D is never built).

- **R27** (T53; N1272; K5445 C; K1471; DEC-77 (3b); `retrieval`) **`proposeParts({project, captures?, viewer})`: candidate parts from the investigation's own words, no AI, no score.** Input: the investigation's questions' titles and text, the names it follows or names, and the amounts and dates in its questions (extracted mechanically, quoted as written); `captures` default to the documents the project holds and may be limited by the member. For each capture the function takes `partsOf` (`reader-contract` R65, as `reading-pipeline` re-exports it) and `retrieval`'s text search for each term and returns `{proposals: [{id, capture, part, why: [{term, kind: word|name|amount|date, unit}], position}], truncated?, shown, total}`. The list is ordered by document, then by position in the document; never by importance, and carries no number a member could read as a rating. A person's name is a search term only: a proposal never says a person is important, suspect or significant (K1471, DEC-89). Each proposal is labelled **a proposal** (machine work, as DEC-77 3b: shown, never preselected) and `why` says which word matched where; each carries a stable `id` so that an acceptance can name it and `extraction` R117 can test that it still stands. At most 200 a call; when more exist `truncated` is true with `shown` and `total`, and the member can narrow by document. A part already live for the project is omitted and the omission counted. Never throws; no `ai-*`, `agent-*` or `skills` in `Uses`. Nothing is written. Test: a fixture project asking about "sewer fund" and the amount "$4.2 million" against a budget PDF returns the pages where either appears, in page order, each with its matched term; no field of a proposal is a score, rank or percentage; a person's name in a question yields proposals whose `why` quotes the unit and nothing else. Control: the answer to the same input twice is identical (deterministic); a project with no questions returns an empty list, not every part.

- **R28** (T53; N1272; K5445 C, K5453 point 3; DEC-77 (3b, c); `contradiction` R30, R37) **`acceptProposals({project, proposals, by})`: accepting a proposal is DEC-77's attributed act, in its acceptance shape; only proposals a member accepts are interpreted, and the member may change a proposal's part first.** Each accepted proposal, standing for the project (`extraction` R117), calls `interpretPart` with `how: accepted_proposal` and basis `accepted` naming it. An accepted proposal not standing is refused `PROPOSAL_NOT_STANDING`, nothing written. A part the member changed (a wider or narrower range) is recorded as the part the member chose, basis `unaided`, with `began_from` the proposal id; it is counted by R29's measure as offered and not accepted as offered. A refused proposal is remembered for that project so it is not offered again unless the member asks; the refusal is recorded with who and when and is no judgment of the document. Test: accepting 2 of 5, changing one's pages from 3 to 6 into 3 to 4, records the unchanged one `accepted` and pages 3 to 4 `unaided` with `began_from`; the refused three are not in the next `proposeParts` for that project; asking for refused ones shows them. Control: nothing is interpreted by `proposeParts` or by leaving the list unanswered.

- **R29** (T53; N1272; K5445 C; the same bar as K491, `contradiction` R9's form) **Proposals are offered for a file kind only once that kind's measure is recorded and met; otherwise the absence is stated.** `PROPOSALS_MEASURED` is a recorded table by kind `{kind: {measured_at, corpus_digest, bar_digest, met}}`, empty until M-N1272 (section 6) has run. `proposeParts` answers for a kind whose entry is absent or not met `{ok: true, proposals: [], unavailable: {kind, why: "not_measured" | "below_bar"}}`, and the screen states it (`screens-inquiry` R145). Opening, citing and marking (R26) work for every kind regardless. The guard against steering is measured as for `contradiction` R39 (DEC-77 3c, K447 (15)): `proposalRates({kind?, since?})` answers per kind the counts `offered` (acts at whose instant a proposal of it stood), `accepted`, `chosen_unaided` and `chose_otherwise`, never a bare percentage, and `review_due` is true when `accepted / offered` is at least 0.95 over at least 30 offered (PROVISIONAL, as R39's); it carries no id and never throws. Test addition: with 30 offered and 29 accepted `review_due` is true; with 29 offered it is false. Test: with the table empty every kind answers `unavailable: not_measured`; with a fixture entry met for `sheet` only, a sheet answers proposals and a PDF answers `unavailable`. Control: no kind is silently skipped; `unavailable` appears in the answer; `proposalRates` states counts only.

- **R30** (T53; N1272; K4636) **`interpretedFor({project, viewer})` lists, per held document, the parts interpreted for the project, by whom, when and how, and the held documents with none.** The list is the project's own (sight as `extraction` R116); it never says "no data of value", only what was and was not interpreted. Test: a project with two documents, one interpreted in part, lists both, the second as "none interpreted". Control: a hidden project's list is never answered to a non-member.

- **R31** (T53; N1272; K4636; K5495) **A later investigation is told what a held document was interpreted for before, and by whom.** `extraction.interpretationOf` (its R116) is the read; for a viewer in project Q looking at a document held by the record, `for_others` carries, for each project the viewer may see, the parts, the member and the date. A project the viewer may not see is not named and its parts are not described. K5495, option A: this is drawn on the document page, in the document view (`screens-inquiry` R147) and as a mark in search results (`screens-daily` R109); option B (a standing list on the investigation) was not chosen and is not built. Test: a viewer in Q and in P sees P's marked pages 3 to 9 with member and date; a viewer in Q only sees none of P's. Control: no row of a project the viewer may not see appears in any answer.

- **R32** (T53; N1272; K5445; N1220) **No assistant proposes parts in this release.** The assistant's panel offers no "interpret" act, and `proposeParts` is mechanical only; assistant proposals are owed to N1220 and, when built, are labelled machine work and accepted by a member in one act (DEC-77 (3b)) like R28's. Test: the `assistant` screen and `airunopen` have no op naming `interpretPart`. Control: none owned here beyond the absence.

## Private

### Uses

- `skills`: `INTAKE_QUESTIONS` (its R41; R11; K2472). A new `modules.json` edge; `skills` is earlier (layer 6).
- `record-grammar`: `acceptanceRecord` (its R52; R12, R20).
- `civil-time`: local days (R2, R3).
- `record-core`: `declareTable`, keyed by project and purged with it (R10).
- `membership`: joined participants and sight (its R44, R55).
- `connections`, `leg-earning`, `inquiry`, `basis-versions`: the project's questions, legs, waits and conclusions (R2, R6, R19).
- `steps`: steps, products, proposals (its R1, R9, R24).
- `intent`: `progress`, `gaps`, the objective and condition, `closed_reason` (its R2–R7, R29).
- `hypotheses`: as `draft-T41-investigation.md` §2.1 places it (the job names the services it reads at its START).

- (T53) `extraction`: `interpretPart`, `interpretationOf`, `interpretationWithdraw` (its R114–R118); `reading-pipeline`: `partsOf` (`reader-contract` R65, which `reading-pipeline` re-exports); `retrieval`: text search per term (R27); `project-roster`: whether the viewer is in the project (R26); `contradiction`: the acceptance shape and `PROPOSAL_NOT_STANDING`'s model (its R30, R37, R39; R28, R29). No `ai-*`, `agent-*` or `skills` module is used for R27 or R32.

### Invariants

- **R21** (D42) Every act here has a by-hand path that needs no AI; mode `enquire` only proposes.
- **R22** (D13) An interview answer or claim naming a person in no public role carries `inquiry` R59's warning at the act, never a refusal.
- **R23** (T42; N843; K231, K2566) R20's `planAccept` refuses a planning proposal that is absent or unseen with `NO_SUCH_PLANNING_PROPOSAL` (C-146.21, its number and translation unchanged), and never with `NO_SUCH_PROPOSAL` (intent's).

### Satisfies

- The investigation design of record (K2417): D1, D15, D16, D19, D20, D27, D30, D48, H27, H28.
- (T53) N1272 (K4636, K5445, K5453, K5495, K5496): R26–R32, R29 measured by M-N1272.

### Suggestions

- Paths: `bio-plane/src/investigation/`; tests `bio-plane/test/m/investigation/`.
- **F1** *(not yet met: BOB grading, coordinator ruling 04:19 5 Nov; layer 11 with op-declarations 430, coordinator ruling 6 Nov)* declare acceptProposals with weight reversible, refused to a machine (surface-declarations R17, BOB's grade; investigation R28)
