# Prior design: the investigation lane's earlier work

Research worker for the `investigation` design lane, 2026-11-07. Read-only. Sources read whole unless marked.

Short names used below:
- **design branch:** `origin/design/investigation` @ `87134cce`, folder `docs/development/investigation-design/`. Cited as `DB:<file>:<line>`.
- **tranche:** `origin/tranche` @ `617b48f5`. Cited as `<path>:<line>`.
- **canon:** `docs/architecture/BIO_Investigation_v0_1.md` on the tranche.

## 0. Sources, and what could not be read

| source | state |
|---|---|
| `docs/development/investigation-design/` on the tranche | Only `README.md`, BOB's seed (6 Nov 2026). It names the area (K2076) and canon `BIO_Investigation_v0_1.md`, and says research lands in `docs/development/investigation-design-research/` first (README:3-9). |
| DB:investigation-design.html (336 lines) | Read whole. This is the design of record. Its header says "Approved by Bob, 9 October 2026" (html text line 9). |
| DB:DECISIONS.md (182), DB:HANDOFF.md (255, H1–H43), DB:RESUME.md (3), DB:S1-relationships.md (51) | Read whole. |
| DB:page-1.html, page-2.html, page-3.html | Each is a 14-line "Moved" stub that points to artifact QjSSFHE78G9PtwKhpW5ZEo. No content. |
| claude.ai artifact `QjSSFHE78G9PtwKhpW5ZEo` (the design document) | **Could not read.** Artifact `read` returned HTTP 404 twice: "no such artifact, or not one this account can open". Its source is DB:investigation-design.html (HANDOFF H3, H40: DB:HANDOFF.md:23, 197), so the content is covered. |
| claude.ai artifact `6cHHcybJpV3SPf25wVmeLN` (the S1 study) | Not tried after the first 404. Its source is DB:S1-relationships.md (HANDOFF H2: DB:HANDOFF.md:17), which was read. |
| `build/plan/archive/drafts/draft-T41-investigation.md` (432), `study-K2075-mapping.md` (101), `draft-canon-investigation.md` | Outlined; key sections read. |
| canon `BIO_Investigation_v0_1.md` (172) | Header, §1, §10 and §11 read. |

**RESUME.md** (DB:RESUME.md:1-3): "Complete." Bob approved the design on 2026-10-09. It was placed in canon as `BIO_Investigation_v0_1.md` (In force, `tranche/T40` @ 8f7f7d0805; K2419–K2421). "The canon document is the source of truth. This folder … is the history." A future session starts here only if Bob asks for more design work, and reads H40–H43 first.

## 1. The design of record, summarised

Source: DB:investigation-design.html. Section numbers are the html's own (§1.0–§1.12, §2 Grandview). Canon `BIO_Investigation_v0_1.md` restates it as §1–§11: only what is new, with the rest cited (canon:1-47).

- **§1.0 Purpose.** System Design §1 as Bob revised it on 9 Oct: BETTER GOVERNMENT through understanding, accountability and "the separation of narrative from evidence". Also "Facts are verifiable, analysis is reproducible, and judgment is debatable". Judgement applies to what a finding signifies, never to what the facts are.
- **§1.1 An investigation is a project.**
  - A project has an objective and poses questions.
  - The objective is the measure, and the evidence decides it, never anyone's say-so.
  - The objective's condition states what the record must hold for a decision, not the hoped-for answer. A records request answered "none exists" can satisfy it.
  - Progress is computed and never reported. Gaps are the work list. With no condition, the page says "cannot be computed".
  - Only conclusions at the bar carry a published case. A breach claim rests on a determination.
  - Each project has its own relationship to a question (draws on it, concludes, defers or dismisses it), and that never affects another project.
  - A question shows the non-hidden projects that draw on it. Hidden ones are never shown, named or counted.
  - Administrators see a hidden project's existence, name and owners only.
- **§1.2 Steps.**
  - A step is work in pursuit of an answer to a question. It can also give context, develop a question, or help understand how to respond to findings.
  - A step is done by a member or the system.
  - Sight follows where the step is taken: on question(s), in a project, or for the group. Nobody chooses. A step in a hidden project names no project.
  - When it ends, a step is ended or set aside, with what it produced and an optional "learned" note.
  - Each question records its own outcome (helped or dead end). The system never records it; it shows "not yet judged".
  - An untouched step can be deleted. A worked step keeps its record.
  - A step can carry a money cost. When a costed step is shared, a cost notice goes out only if no sharing project is hidden. Messages carry the writer's handle. Civicsmith splits nothing.
  - A chance find needs no step.
  - Dependencies: a step can wait on a step, a document or a date. Loops are refused. *[detail]*
  - "By when" dates. *[detail]*
  - Quiet project: when work goes quiet, the system shows once where the evidence stands, then offers watch, close or revise.
  - Waits on a question are seen wherever the question is.
  - Milestones belong to the project.
    - A question counts as done when this project has concluded on it.
    - A step counts as done when it has ended.
    - Deferred, dismissed or set-aside items are stuck. Removing one is recorded.
- **§1.3 Saving steps and questions.**
  - The record is a read-through cache with change tracking. Looks, including "looked, absent", sit in the observation log.
  - When data is found later, a dead-end step is updated (H39).
  - A step keeps: the questions or project that refer to it, its state and dates, its outcome per question, who did it, what it produced (by provenance), and an optional "learned" note. It keeps no purpose and no method.
  - Steps are searchable, so work is not duplicated.
  - The question is what is saved, searched and reused.
  - Why a document is held is read from provenance and never written separately.
  - Status reports: any member, system-drafted from the record since the last report, kept with the project, never published, no per-member figures, no schedule.
- **§1.4 Evidence.**
  - Members decide what becomes evidence, by grade and the rules of evidence.
  - The system takes steps. It asks to capture only addresses the record already holds; a page found elsewhere is named to a member.
  - The system explores where an account owner has turned exploring on.
  - The system's hunches are labelled signals, shown with method and false-alarm rate, never evidence.
  - One accepting act covers every proposal: as proposed, edited, or "my own instead". Any joined member of a drawing project may act. Vouching statements are re-authored.
  - Grades:
    - A verified-quote fact keeps the document's capture grade.
    - Numbers and dates are read by code and checked by the member.
    - AI-read image text is undetermined until measured.
  - The system's hunches are listed apart from the members' list.
  - Finds go to the joined members of every drawing project, once, in the queue, with follow and unfollow.
  - Which account paid is shown only to that account's owners.
- **§1.5 The chain.**
  - Project (objective, bar) → Questions → Steps → documents, content, connections, looks → Legs (members only) → Basis versions → Conclusion (a finding) → Case → Determination → Action plan and actions.
  - Conflicting conclusions name the other non-hidden project.
  - Without a determination, a breach action is refused unless the member gives a reason stated openly.
- **§1.6 AI use.**
  - Accounts at group, project and member level.
  - Each type of use is switched on or off.
  - Limits: an overall limit and per-use limits, each per-use limit inclusive or exclusive.
  - The exploring setting is No, Ask every day, or Yes.
  - "No AI at all" binds everyone's material. "Not on my dime" binds only that account.
  - Intake interview: the same six questions on both paths.
  - Answer wording: baselines side by side, no verdict, and "cause not established" unless a concluded finding establishes it.
  - AI transcription of image-only pages is labelled undetermined.
  - A quote-bound note may sit beside a source. It is never content and never cited.
  - Reading guides: Civicsmith's library and each group's, shared across groups. A guide is the AI's skill for its document kind and never sets conduct. The AI never approves a guide.
  - Test investigations gate every AI part.
  - One act can start several steps under one estimate.
  - Bob approves the AI's rules in plain language. Instructions may only quote them, and code checks that.
  - Cost: an estimate before and the actual after, shown to the payer only.
  - Bounded reading inside a held document. It proposes citable content and connections, each quote-bound.
  - Usage is tracked per account and per type of use.
- **§1.7 What holds throughout.** Records are by handle, and nothing measures a member. No nagging. Working material is never published. The group's own dates are never findings. The machine never concludes, determines or attests.
- **§1.8 Front door.**
  - One door: "What happened?".
  - Six routes: a new project; an existing question or project; a lead (optionally watched); a step for understanding; an action; or "not Civicsmith's".
  - A member's own matter goes in her hidden project.
  - Rumours become leads, never questions aimed at a person. *[detail]*
- **§1.9 Narrative and evidence.**
  - The interview and a member's story are narrative.
  - A narrative claim becomes a "find the record" step, shown "as recalled" until found.
  - A firsthand account is testimony, which is evidence labelled as such.
  - Shared notes are narrative and can be withdrawn.
  - Each baseline names its basis.
- **§1.10 People.**
  - People are in scope through their part in a public matter.
  - A private person's private life is never the subject; the member is warned at the act.
  - The system never explores a person on its own, and gathers about a person only up to a per-run cap.
- **§1.11 Parts to build.**
  - `steps`, `question-explorer`, `investigation` (milestones and status reports) and reading guides.
  - Planning: a new AI job (`enquire`) with its own test bar.
  - Everything else extends existing modules.
- **§1.12 Publishing.**
  - The system drafts the account, in one or more labelled framings.
  - The member writes the account. Every sentence is checked: unsupported → tie it to evidence or remove it; contradicted → refused. Lying is not bias.
  - A case carries six statements about itself, with no stories.
  - Bias disclosure is required. Bias framing must be marked.
  - Regrade gives readers a re-check under a lens.
  - A group may require approvers (off by default).
  - The publisher decides which reviewer comments go in. A reviewer left out may add hers later through the docket.
  - Whole-case accept, or accept finding by finding.
- **§2 Grandview** walks one investigation through every stage above.

Canon's own **Incomplete sections** (canon:5-7):
- §3: the member-facing names for step, milestone and status report, and the name that tells the investigation's plan from the action plan (D23). These are owed with the UX stream. **Screens and names are the ux lane's.**
- §11: re-check under a lens depends on regrade, which is not built.

## 2. Decision register D1–D66 (DB:DECISIONS.md)

D1–D24 come from the study (`study/investigation`, synthesis §6.1). D25 onward are this lane's. "Final" is the last state recorded in DECISIONS.md. Line numbers are DB:DECISIONS.md.

| D | subject | final state |
|---|---|---|
| D1 | engine's parts | ruled "D1: approved" (restated: one new module, reading guides; planning a new AI job; rest extends existing), Bob 10-09 (:146, :150); module list per D51 |
| D2 | AI reads bounded spans of a held document | ruled A, widened: proposes quote-bound content rows and connections while reading; never under "no AI" (:136) |
| D3 | one accepting act | ruled A (:134) |
| D4 | grade of an AI-located fact | ruled A in substance: verified quote keeps the document grade (:134); amends extraction R43 and AI Roles EXTRACT |
| D5 | purpose at the door is provenance | settled K2064 (:13) |
| D6 | machine-proposed explanations | settled in substance by D33 (:52); refined by D46 |
| D7 | what authorises targeted AI work | ruled A: one act starts several AI steps under one estimate (:141); (a)/(b) superseded by D50, D2 |
| D8 | reading-guide libraries | ruled A + cross-group sharing (:144) |
| D9 | `standards` kind `contract` | settled K2064 (:17) |
| D10 | school districts and state school-construction bodies; a second state | settled K2064 (:18) |
| D11 | live check + test bar for every AI mode | settled K2064 (:19) |
| D12 | AI cost estimate before, actual after | ruled A, to payer only (:136) |
| D13 | private-person fence | restated after B8, ruled B (:124, :128) |
| D14 | test investigations | restated, ruled C (both Civicsmith's and the group's) (:125, :128) |
| D15 | working material never published | settled K2064 (:23) |
| D16 | watch or close | ruled A, with "objective is the measure" (:144); lane's "members judge met" reading withdrawn by Bob's correction (:148): met = computed by `intent` R3–R6 |
| D17 | waits on a question | ruled A (:144); dependent set-asides superseded by H10 |
| D18 | member notes shared to a project | ruled A (:144) |
| D19 | intake interview | ruled B (same questions, form or conversation, member checks) (:139) |
| D20 | answer vocabulary | ruled A, with narrative-vs-evidence direction (:139) |
| D21 | AI transcription of image pages | ruled A (:144) |
| D22 | the bearing note | ruled A (:144) |
| D23 | member-facing names | **open**, owed to the UX stream (:31, :132; canon Incomplete §3). **Screens and names are the ux lane's.** |
| D24 | AI rules text | ruled B (Bob approves plain-language rules; instructions quote only) (:141) |
| D25 | teams, subgoals, leaders | **withdrawn** by Bob 10-08 (:33) |
| D26 | assignments | **withdrawn** by Bob 10-08 (:34) |
| D27 | milestones | ruled A (:95) |
| D28 | removing steps | ruled A (:105) |
| D29 | resources and cost | ruled in Bob's words: a costed shared step gets a cost notice and relayed messages; Civicsmith splits nothing (:106) |
| D30 | status reports | ruled B (member-written, system-drafted) (:108) |
| D31 | AI budget per investigation | subsumed by D34/D37 (:58) |
| D32 | what a step is | Bob's direction; answers (a)–(c) given (:45-48) |
| D33 | who decides evidence; system may explore | Bob's direction (:50) |
| D34 | AI use across groups, projects, members | Bob's direction; replaced A/B/C (:57-58) |
| D35 | steps that serve no question | ruled: sight is the sight of where the step is taken; no choice (:81) |
| D36 | who receives finds | ruled C (all joined members of drawing projects, with follow/unfollow) (:79) |
| D37 | a project's own AI settings | settled (owners, Membership §7) (:59) |
| D38 | group/project/member settings differ | ruled C; confirmed: a project may bar AI on its material (:60, :70) |
| D39 | unasked exploring | ruled; settled as No / Ask every day / Yes (:61-68); amends K1481 (K2421) |
| D40 | outsiders' sight of a non-hidden project | withdrawn as a question (option A, existing ruling) (:77) |
| D41 | a step on a shared question from a hidden project | ruled A (:84); principle later revised by Bob's §1.1 comment and D64 (:175) |
| D42 | both audiences optimally served | Bob's direction (:89); study done; approved "A" (:117) |
| D43 | action-plan support | Bob's direction; future lane (actions lane, K2433) (:93) |
| D44 | can a step contain steps | ruled "no" (:102) |
| D45 | doing a step again | withdrawn; replaced by "steps searchable to avoid duplication" (:103) |
| D46 | system's own hunches | ruled A (kept apart) (:119) |
| D47 | shared step's outcome | ruled B (one end, per-question outcome) (:119) |
| D48 | when a milestone is met | ruled as recommended (:119) |
| D49 | who a shared-cost message names | ruled A (handle) (:119) |
| D50 | why a document is held | ruled as recommended (provenance only) (:119) |
| D51 | three new modules | ruled A (`steps`, `question-explorer`, `investigation`) (:119) |
| D52 | where a first message leads | ruled B (six places) (:128) |
| D53 | a member's own matter | ruled A (her hidden project) (:128) |
| D54 | administrators' sight of hidden projects | ruled B (existence, name, owners) (:130) |
| D55 | Action §3 wording "determination" | ruled A (:155) |
| D56 | system drafts the case's account, sentence check | ruled A + "Lying is not simply bias" (:168) |
| D57 | narrative in a case | ruled B (no stories) (:168) |
| D58 | bias disclosure | ruled A (:168) |
| D59 | reader re-check (regrade) | ruled A (:168) |
| D60 | approval rule | ruled B (group-set approvers, off by default) (:168) |
| D61 | unresolved reviewer objection | ruled as restated by Bob: publisher decides; left-out reviewer adds later via docket (:168) |
| D62 | accepting another group's case | ruled A (:168) |
| D63 | case's authored statements | ruled A (kept, under D56 check); lane's later reading makes six (H42 pt 8) (:171) |
| D64 | knock-ons of showing non-hidden projects | agreed (:176, :180) |
| D65 | reading guides as AI skills | agreed (:178, :180) |
| D66 | CF invariant 7 "as prominently" | agreed (:178, :180) |

**Open after the lane closed:** only D23 (names), which is the UX stream's. The register has no D67 or later; it ends at D66 (:182).

Also settled as the lane's detail, with BOB to confirm (:41):
- step dependencies (cycles refused);
- the plan lands in `steps` and `investigation`;
- expertise reuses membership;
- information is `holdings`, later dropped by D50.

## 3. Hand-offs H1–H43 and their fold status

How BOB folded the lane's work:
- **Rulings:** K2064, K2076, K2329, K2348, K2350, K2361, K2371, K2382, K2398, K2401, K2405–K2410, K2416–K2421.
- **Plans:** the T41 plan (`build/plan/archive/T41.md`, opened by K2424) and requirement text (K2448, K2472, K2480).

"Read" means BOB acknowledged the entry. "Folded" names the K and where it landed.

| H | carries | fold status |
|---|---|---|
| H1 | page 1: K2075 plan construct + D25–D31 | read, nothing asked (K2091, rulings.md:2093); superseded by H2 |
| H2 | Bob narrows K2075; S1 study | read (K2329, rulings.md:2331) |
| H3 | one working document; D32/D33 | read (K2329) |
| H4 | D34 AI use | folded as N812 (K2348, rulings.md:2350) → ai-runs, credentials, agent-model, instance-setup |
| H5 | D38 ruled | folded N812 (K2348) |
| H6 | D39 ruled | folded N812 (K2348) |
| H7 | D39 exploring setting | folded (K2350, rulings.md:2352); Capability Ladders §2/§10; K2421 |
| H8 | D36; D40 withdrawn | read, held with N748 (K2361, rulings.md:2363) |
| H9 | D41 A | read, held with N748 (K2361) |
| H10 | per-project deferral/dismissal | folded N814 → inquiry R39 (K2371, rulings.md:2373); T41-15 |
| H11 | document restructured | read; owes nothing (K2371) |
| H12 | D42, D43 | folded: D42 binds N748; D43 → N817, the actions lane (K2382, K2433) |
| H13 | step model complete | folded: holds lifted, N820 draft owed (K2398, rulings.md:2400) |
| H14 | #2 takeover; BOB's Q1–Q5 to Bob | read (K2401) |
| H15 | D46–D51 | folded (K2405, rulings.md:2407) → steps R5/R15, hypotheses R16–R18, investigation R2 |
| H16 | D42 study; D52/53/13/14 put | folded via K2406/K2407; N821 |
| H17 | review of canon draft | folded: six replacements (K2406, rulings.md:2408) |
| H18 | D52, D53, D13, D14 ruled | folded (K2407, K2409) → question-explorer R7, R9–R11; run-rules R19; N821 |
| H19 | D54 | folded as N822 (K2408, rulings.md:2410) → membership sight |
| H20 | canon draft checked | folded with H20–H41 in one pass (K2416, K2418) |
| H21 | remaining D's taken up | read (K2416) |
| H22 | canon approval withdrawn (K2410) | consistent with K2410 |
| H23 | D3, D4 | folded (K2418 into draft-T41 §3.6; K2448 applies extraction R42/R43 etc.) |
| H24 | D12, D2 | folded (K2418; K2448 run-rules R20, run-productions R21–R24) |
| H25 | D19, D20 narrative | folded (K2418; K2448 answers R31–R33) |
| H26 | D24, D7 | folded (K2418; K2448 skills R40–R44; ai-runs R74, K2472) |
| H27 | batch 3; objective as measure | folded as corrected by H28 (K2416, K2418) |
| H28 | objective met = computed | folded (K2416): nothing new for "met"; intent R3–R6 |
| H29 | D1 approved | folded (K2416, K2418); T41 module openings (K2424) |
| H30 | canon audit, 16 corrections; D55 | folded (K2418); intent R33 / action-grammar R13 `none_exists` (K2505, rulings.md:2507) |
| H31 | D55; three elements | folded (K2418) |
| H32 | D56–D62 put | folded (K2418) |
| H33 | D56–D62 ruled | folded into canon §11 (K2418–K2420); regrade (D59) planned in T41 (K2424) |
| H34 | D63; whole design to Bob | folded (K2418) |
| H35 | document reduced to design of record | no fold needed |
| H36 | System Design §1 revision | folded: canon amendment A–S (K2419, K2420) |
| H37 | CF invariant 7 | folded: D66 amendment (K2420) |
| H38 | non-hidden projects shown | folded: inquiry R39 amended (T41-15, `build/plan/archive/T41.md:113`); Membership §7.14 |
| H39 | later data updates dead-end steps | folded: steps "later-found data reaching dead ends" (canon §10, :154) |
| H40 | approval; placement plan | folded (K2417, rulings.md:2419) |
| H41 | single-source-of-truth placement | folded (K2418, rulings.md:2420) |
| H42 | review of refolded canon, Part 3 | folded (K2418) |
| H43 | canon placed; lane complete | acknowledged (K2715, rulings.md:2716: "investigation lane H43 … nothing new") |

The hand-offs run to H43. Every one is read, and every one that asked something is folded. No H is left unfolded.

Later "H43" mentions in rulings (K3095 onward) belong to other lanes' registers, chiefly the actions lane. Those were not traced.

## 4. Rulings traced (the coordinator's list)

- **K2064** (rulings.md:2066, 2026-10-07): the study's D1–D24 re-presented. BOB settles D5, D9, D10, D11 and D15. The rest are left open with Bob.
- **K2075** (cited in next-T36..T40.md:7; its own line not located with the grep used): Bob's plan construct (steps, dependencies, resources, deadlines and milestones, teams and subgoals, status reports). Narrowed by Bob on 10-08 (H2: no roles or subgoals). `study-K2075-mapping.md` is a worker's report mapping it to canon (no team, leader or subgoal construct exists; "deleted" meant retire-with-reason).
- **K2076** (rulings.md:2078): the lane is created on branch `design/investigation`, writing only its own folder. Decisions are numbered D; hand-offs are numbered H. Screens are owed to the UX stream. Requirements stay BOB's.
- **K2398** (rulings.md:2400): #1 to #2 takeover. H13 read: the step model is complete, and N820 is owed.
- **K2417** (rulings.md:2419): Bob approves the design. The design of record is the html after 5a04b1d54d, not DECISIONS.md. The canon is refolded.
- **K2418** (rulings.md:2420): H41 and H42 folded into the canon draft (Part 1, plus amendments A–S) and into draft-T41.
- **K2419** (rulings.md:2421): Bob approves change list A–S.
- **K2420** (rulings.md:2422): Bob approves Part 1. The canon is placed, In force. The building hold is lifted.
- **K2421** (rulings.md:2423): K1481 amended. Exploring that an account owner enables is a second exception to "AI starts at a member's act".
- **Follow-on:**
  - K2422 / K2424: T40 closed early and T41 opened with N820–N822. `steps`, `reading-guides`, `question-explorer` and `investigation` opened.
  - K2448 / K2472 / K2480: L4–L7 requirement text and catalogue families C-142..C-146.

## 5. The T41 draft, the K2075 mapping and later plans

- `build/plan/archive/drafts/draft-T41-investigation.md` (N820): BOB's requirements draft.
  - §1 the ruled model; §2 where each decision lands.
  - §3.1 `steps` (L6, `bio-plane/src/steps/`); §3.2 `question-explorer` (L6); §3.3 `investigation` (L7, `bio-plane/src/investigation/`); §3.4 `reading-guides` (L6).
  - §3.5 D54 sight; §3.6 amendments to existing modules.
  - §4 open items; §6 services the screens need ("screens are the UX stream's", line 417).
  - Adopted as T41's text (K2424, K2448).
- `study-K2075-mapping.md`: read-only mapping. Its conclusions are superseded by H2 and D32–D45.
- `build/plan/archive/T41.md`: T41-1 record-grammar `STP` and `GUD` ids (:74); T41-2 text-chain `ai_transcription` (:75); T41-15 inquiry R39 per project and non-hidden naming, R55, R59, R60 (:113); T41-21 run-rules R19–R26, mode `enquire` (:119).
- Later tranches mention investigation work: T42–T44, T48, T49 archives; T52-R1; T53-R1, with rows `build/plan/T53-R1/investigation.md`, `steps.md`, `question-explorer.md`; `current.md`:61-167.

## 6. N1272 (open item, shared with screens-inquiry and UX)

**What it is.** `build/plan/next.md:47`: "N1272 · extraction, screens-inquiry (with INVESTIGATION-DESIGN and UX-DESIGN) · (Bob, K4636 …) The means of choosing what of a document to interpret for an investigation, beyond the range a member opens or cites (G41): what is proposed, by whom, how it is stated on the document page, and how a later investigation finds data in a held document not yet interpreted. hard reason: Bob's: the design and its options to him are not yet made (K4636)."

**Its state is further along than next.md says.** The entry's hard reason looks stale. Rulings since:
- **K4636** (rulings.md:4631, 10-22): every document is read whole and searchable. Interpretation is selective "by a designed means". Origin of N1272.
- **K5445** (rulings.md:5439, 10-27, C1): what is interpreted:
  - what a member opens or cites;
  - a member's deliberate "interpret these parts for <investigation>";
  - as the objective (C), Civicsmith's own proposals from the investigation's words, without AI. These are labelled proposals, interpreted only when accepted, and built in the beta if they test well;
  - the assistant's proposals only with N1220;
  - never "everything up to a size".
- **K5495** (C2): the document page and search say what was interpreted, for which investigation, by whom and when. A visible margin or shade marks interpreted parts. **Drawing it is UX-DESIGN's (screen item, ux lane).**
- **K5496** (C21): finding names, organisations and dates across a document is reading, not interpretation.
- **K5537** (C33): BOB prepares the answer key; Bob marks the parts for the M-N1272 test.
- **K5725** (rulings.md:5719): reading-pipeline R64 `interpretUnits` and R65 `partsOf` written.

**Requirements already written (T53):**
- `build/requirements/extraction.md:165-172`: R114–R119 (`interpretPart`, `interpretationOf`, `interpretationWithdraw`, storage bounds).
- `build/requirements/investigation.md:60+`: R26 `markForInterpretation` and R27 `proposeParts` (no AI, no score), plus following lines.
- T53 rows: `build/plan/T53-R1.md:260-267, 473, 822, 836, 872`.

**Still open for the lanes:**
- The screens: the document page's statement, the interpreted-part mark, the "interpret parts for this investigation" offer, and the "not interpreted for this investigation" mark in search. These are **ux lane / screens-inquiry and screens-document items, not this lane's**.
- Whether the no-AI proposals (K5445 C) tested well enough for the beta (the M-N1272 run).
- The assistant's proposals, which wait on N1220.
- The next.md text itself, which needs refreshing by BOB.
