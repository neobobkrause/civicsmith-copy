# The action canon, the earlier lanes' decisions, and what is in force now

Research for the `publication` design lane (qualification). Read-only. Written 2026-11-06.

**Refs used in citations**
- **T** = `tranche` at `705f8823d1`. Paths without a ref are on T.
- **DA** = `origin/design/actions` at `9185526c7d` (the ended ACTIONS-DESIGN lane). Paths are under `docs/development/actions-design/` unless given in full.
- Line numbers in `HANDOFF.md`, `DECISIONS.md` (DA), `RESUME.md`, `DESIGN.md` and `REQUIREMENTS-HANDOFF.md` are the file's own lines.
- `build/rulings.md` is 5,814 lines. A K-number is usually one more than its line number (K590 is at :593, K2780 at :2781).

**Read in full:** canon `docs/architecture/BIO_Action_v0_2.md` and `BIO_Action_v0_1.md`; DA `RESUME.md`, `HANDOFF.md` (H1–H31), `DECISIONS.md`, `DESIGN.md`, `REQUIREMENTS-HANDOFF.md`, `research/R4-prior-lane.md`, and the canon-draft `BIO_Action_v0_2.md` (diffed against T); T `docs/development/action-design/ACTION-PLAN.md`, and `MATRIX.md` §6–§7; every K-line cited below; T `DECISIONS.md` (BD-1, BD-2); T `docs/development/publication-design/README.md`; Publication v0.1 §3 rule 15 and §5D (T); the four artifacts named in the brief.

**Read in part (headings, plus the sections cited):** DA R1, R2, R3, R5, R6, and S1 (§B13 and §D in full). U1–U20 were not read: they are cited only through S1 and DESIGN. Parts of the T requirement files were also read: their status lines, and lines found by grep.

**The artifacts.** JH9AK7rgmxRNR9QjPL3s5d (Actions Design) and 8Ke3MafpR8R4knFDtiMEWx (Action Canon Draft) were downloaded. Once the artifact wrapper is stripped, their text is identical to DA `actions-design.html` and `canon-draft/action-canon-draft.html`. So the artifacts and the branch agree, and the artifacts' sections can be cited as DA file sections.

---

## 1. The Action canon v0.2 in brief

**Status and place.**
- Bob approved v0.2 as a whole on 2026-10-11 ("Approve the canon draft as a whole"), and BOB placed it (K2780). It replaces v0.1 as the level-1 home of the Action layer. Case Making's action sections remain "history for why" (`docs/architecture/BIO_Action_v0_2.md:3`).
- It was approved together with Ladders §9A ACTIONS and State Rules §4.4/§5.1 edits (same line).
- `requirements/README.md:26` lists v0.2 as canon, whole.
- Its place in the system: construct 16; build layer 9, whose numbering governs. It depends on Investigation v0.1, Publication v0.1, Capability Ladders, Membership v2 and AI Roles, and does not restate them (`:5`).

**§1 Purpose** (`:7-13`).
- The layer runs from the first suspicion to the recorded end. It covers many shapes of action: asking for records or comment, enforcing the group's own requests, complaints to oversight, testimony, formal party participation, press, meeting officials, recognition, joint action, briefing counsel and defence.
- A plan may be acted on before any case is published, so a published case may carry a record of the actions taken (`:11`).
- Everything works without AI; the AI's proposals are labelled (`:13`).

**§2 Contract** (`:17`).
- An action rests on the record.
- A breach-asserting action rests on a member's determination, against a standard in the group's own record, on findings of three kinds: published; checked for publication and held; or another group's findings that the group has accepted.
- The AI never files or sends. Compliance is recorded as carefully as noncompliance. Every deadline names its basis. Civicsmith takes no policy position and "is never their instrument".

**§3 Eight constructs** (`:21-34`): Standard, Determination, Consequence, Success record, Action plan, Action, Filing and communication, Escalation.
- **Standard** (`:23`): a spoken commitment becomes a standard only once confirmed in writing or stated publicly.
- **Determination** (`:24`):
  - It may rest on "checked for publication and held" findings, which move to the edition on publication.
  - It may rest on accepted foreign findings: read-only, and never stronger than the source edition.
  - It reads undetermined if the check is voided or the source group withdraws or revises; dependent actions are marked meanwhile.
- **Success record** (`:26`): new in v0.2.
- **Action plan** (`:27`): any number of scenarios; plan states open, paused or closed.
- **Escalation** (`:30`): it "ends" when compliance is restored and the consequences are addressed, or a member "stops pursuing" it, which is not an ending.
- **Module homes** (`:32`): `standards` (L5); `conformance`, `consequences`, `actions`, `action-clocks`, `filings`, `escalation`, `action-plans` (L9); watches with `monitoring` and `following` (L10).

**§4 Twenty-one rules** (`:36-78`):
1. Humans decide. The machine's writes are named mechanical marks (`:38`).
2. The gate is at the outward act (`:40`):
   - Asking or seeking evidence is never held back.
   - Assertion phrasings are pointed out and resolved by the member.
   - The override needs one of two grounds: a cited legal deadline, or an imminent irreversible act.
   - When the window is short, a quick one-finding case is offered.
   - An action sent on grounds may join the escalation later.
3. Everything sent gets the case's sentence-by-sentence record check. A contradicted sentence is held by default. Prepared text carries the disclosure lines for held or accepted findings (`:42`).
4. No significance and no score. Every option is listed, with no cut-off and no catalogue (`:44`).
5. Compliance counts; recognition (`:46`).
6. Deadlines carry one of five basis kinds. One date gives one reminder. A missed date is a "Noticed" question. "Our deadlines" are held separately (`:48`).
7. Addressees are roles, not people. A reporter is addressed by role and outlet, the name kept inside (`:50`).
8. Who speaks; press terms; the quoting rule for requests for comment; **at signing**, one fact line per open request for comment (`:52`).
9. The doctrine's limits: no policy positions; advocacy text gets an evidence check only, in the member's hidden project (`:54`).
10. The work varies, not the person (`:56`).
11. Jurisdiction lives in data: templates, guides and member-drafted rules (`:58`).
12. Hope for good faith; prepare for opposition: holds, counsel at any stage, a defence packet (`:60`).
13. The venue sets the standard of evidence (`:62`).
14. Nothing leaves by a system path. The in-band stamp. Joint texts by matching fingerprint. A plan and a counsel packet are never published (`:64`).
15. What stays inside: a confidential act, a counsel matter, a member as source. **A published case's record of actions** holds outward acts only (`:66`).
16. Responses change the plan only through members (`:68`):
   - A re-examination follows each recorded response.
   - A response that is an infraction becomes a new matter.
   - A member's act puts a relevant reply "on the published case's docket at once".
   - Promises are adopted as duties.
17. Endings are honest (`:70`):
   - A curing act; harm addressed in plain words.
   - A member's act puts a dated outcome entry on the docket at once, and the determination goes with the next edition.
   - "Stopped pursuing"; the closing summary; watches end.
18. Work carries on when people change: "where it stands"; take-up (`:72`).
19. Infractions: document first, and always offer the chance to fix (`:74`).
20. Managing the work: the matter's state, timeline, reviews, paused, decision log, preparation items, second approval, notes (`:76`).
21. Power without misuse: open items shown as facts; no self-benefit asks; naming in role; identity and stake visible; a stewards' report path (`:78`).

**The remaining sections.**
- **§5 Records requests** (`:80-82`): Case Making D-147–149 given a home here.
- **§6 Things kept distinct** (`:84-89`):
  - three outcome vocabularies;
  - plan against escalation;
  - product kinds against profile kinds, and tiers;
  - links `action_basis`, `responds_to`, `references`, `arose_from`, `cures`;
  - fields `partners` and `confidential`; the state "stopped pursuing".
- **§7 Words and screens** (`:91-93`): "Matters" (DEC-114). The bound sketches (DEC-115): the plan page; the start-and-send sketch; the Tier 2 and Tier 3 panels.
- **§8 Not yet** (`:95-97`): licensed certification and court-petition templates; compensation claims; the backward question.

**What changed from v0.1** (`docs/architecture/BIO_Action_v0_1.md`, 99 lines, now marked superseded at `:3`):
- **Contract.** v0.1 `:13`: a breach action rests on "a published finding". v0.2 adds held findings (D24) and accepted findings (D16, D16a).
- **Constructs.** v0.1 `:17-25` had seven constructs, at most three scenarios, and escalation only "until compliance is restored". v0.2 adds the success record (D6c), unlimited scenarios with set-aside (D19), plan states, "stopped pursuing" (D6a), and action `partners` and `confidential`.
- **Rules.** v0.1 had 13 (`:31-43`); v0.2 has 21.
  - Rule 2: v0.1's override took any reason (`:32`); it is narrowed to two grounds (D18), and the classes come from D1.
  - New rules: 3 (D2), 8 (D12, D13), 15–21 (D4–D6, D14, D20–D21, D25–D28).
  - Rule 9 widened by D11a/D11b. Rule 11 widened by D8. Rule 12 by D9 and D10.
- **Records requests.** v0.1 had no §5 on them; v0.2 §5 homes D-147–149.
- **History moved out.** v0.1's reconciliation table (§5, 16 rows), canon edits (§6), Bob's rulings (§7) and reasoning (§8) are absorbed into v0.2 or dropped, as Bob directed ("needn't have a history", DA `HANDOFF.md:173`, H25).
- **Two v0.1 rulings reversed.** v0.1 §8 deferred joint action (`:56-60`); v0.2 rule 14 brings in partners and joint approval (D16). v0.1 §7 (2) said an overridden action never joins an escalation (K600 (a)); v0.2 rule 2 lets it join (D3).

**Canon file on T compared with the approved draft on DA.** The two texts differ in one place only, the status line: DA "BOB places it" became T "placed by BOB (K2780)". The body is otherwise identical (`diff`).
- **Artifact quirk.** The Canon Draft artifact's header says "Approved by Bob as a whole · 11 October 2026". Its embedded Status still reads "Draft for Bob's approval" (DA `canon-draft/action-canon-draft.html:69,74`). This is cosmetic.

**Sibling canon placed with v0.2 (on T).**
- Capability Ladders §9A ACTIONS: `docs/architecture/BIO_Capability_Ladders_v0_1.md:1317` ff.; Amended line at `:13`.
  - That Amended line cites "D1–D24, D11a, D11b, D16a" only. Rules 19–21 come from D25–D28, so the citation is incomplete. This is a record nit.
- State Rules §4.4/§5.1: `BIO_State_Rules_Consistency_v1_5.md:928` (`partners`), `:935` (`stopped_pursuing`), `:1068-1069` (`arose_from`, `cures`).

---

## 2. Lane history

### 2.1 ACTION_DESIGN #1 (2026-09-29/30)
- **Charter.** Bob's brainstorm on the action plan: a design-only session (K592, `build/rulings.md:595`). It wrote only on its own branch, never `build/`, canon or `main`.
- **Session and branch.** `session_01AvsM94TwTtNzadzkdQdU58`, branch `claude/brave-johnson-5fqmix`, draft PR #5, never merged (DA `research/R4-prior-lane.md:195-198`).
- **Outputs on T** (`docs/development/action-design/`):
  - `ACTION-PLAN.md`: Bob's rulings 1–10 at `:5-16`, D1–D6 at `:18`, rules A1–A17 at `:28-61`.
  - `INVENTORY.md`.
  - `MATRIX.md`: D1–D6 at §6 `:74-81`; the "no cell is a gap" re-run at §7 `:83` ff.
  - `sources/*`.
  - `BIO_Action_v0_1.md`, approved whole (K608, `build/rulings.md:611`).
  - The `action-plans` module drafts, folded and built from T18 on (K591, K611; R4 `:199-209`).
- **Rulings recorded.**
  - K590 (`:593`): rulings 1–10, D1–D6, the close rule.
  - K597 (`:600`): good faith with opposition; the venue sets the evidence standard; certification deferred; confidential referral.
  - K600 (`:603`): override option (c), "never joins an escalation"; joint action deferred; "nothing open with Bob".
  - K608 (`:611`): canon whole; drafts correct; plan-page UX approved; priority.
  - K613–K615: reminders and templates. K660: the planning run, five at a time.
- **End.** It hand-offed with "nothing open" (K600). Its folder was copied onto the tranche line as history (R4 `:208`). BD-2 calls it "the ended ACTION_DESIGN #1 lane's history (K592)" (`DECISIONS.md:30`).

### 2.2 ACTIONS-DESIGN (#1 and #2, 2026-10-09 to 10-11; ended 10-15)
- **Charter: K2433** (`build/rulings.md:2435`). Bob, 2026-10-09: "dive every bit as deeply into the requirements, current capabilities, additional capabilities needed, design, and use cases of Actions", in a separate channel.
  - Branch `design/actions` from `main` @ `8af83ac942`.
  - It wrote only `docs/development/actions-design/`. Bob's decisions were "Actions D<n>". It handed off as `H<n>`, answered by K. Requirements stayed BOB's; screens belonged to the UX stream.
  - DA `RESUME.md:5-15` restates this.
- **Sessions.** #1 `session_01VDxYUZBV7s4gVx8xWwmCVY` (started by BOB #146). #2 `session_01RukQneSYmxg4FvfJ9aXccd`, after Bob's pause and account move (`RESUME.md:3`; H9 `HANDOFF.md:70-72`; H10 `:74-76`).
- **Outputs (DA).**
  - Research R1–R6.
  - Twenty traced use cases U1–U20 (Oakland/California).
  - S1, the synthesis: §B decisions, §C 27 details, §D 19 defects, §E capabilities.
  - The working page (artifact JH9AK7…, sections 1–9; §7 holds D1–D28 with options, §8 the design).
  - `DECISIONS.md` (D1–D28, C1); `HANDOFF.md` H1–H31; `DESIGN.md` (§1–§12).
  - `canon-draft/` (v0.2 and `ladder-ACTIONS.md`; artifact 8Ke3…).
  - `REQUIREMENTS-HANDOFF.md`: module by module, the H31 fold list.
- **BOB's reviews of the draft.** K2757 (`:2758`): about 15 drops of the H-notes and 5 of v0.1. K2759 (`:2760`): 9 points left. K2760 (`:2761`): no further objection.
- **Approval and placement.** K2775 (`:2776`) approved. K2780 (`:2781`) placed v0.2, §9A and the State Rules edits, and recorded the K readings.
- **The fold.** K2781 (`:2782`) packaged the fold as N893 in T45, with splits: new modules `case-check` (L8), and `action-holds`, `action-replies`, `plan-work` and an L11 action to-do module. All exist on T (`build/requirements/`). Inference: `action-producers` is that L11 module.
- **End.** K3469 (`:3468`), Bob, 2026-10-15: "...not is the ACTIONS-DESIGN lane needed any more." Both lanes ended and their branches were kept as history. "Every hand-off was folded (actions H31, K2775–K2780…)".
- **Successor.** BD-2 (T `DECISIONS.md:25-40`, BOB, 6 Nov). Bob ~17:05Z: "Yes, publication design is the ACTIONS-DESIGN area".
  - The new `publication` lane owns "ACTIONS-DESIGN's 'Publication & action' area (K2433): publication, ratification, docket, case making and the actions around them".
  - It gets a new folder, `docs/development/publication-design/` (seeded README).
  - First ask: ratification F1's second-signature design over `docketStatement`.
- **Attribution note** (inference). K2433's own text names only "Actions". The label "Publication & action", covering layers 8–10 and the canon Publication, Case Making (case) and Action v0.2, comes from BOB #333's area table, where that row's lane was "none". Sources: artifact J8E73nE7Y4qNczAVPTB5Sn §"Ten product areas", and FXfQapxoZFhKbJ4c3UzX3E §1, which is identical.
  - So the lane's scope is **wider than K2433's charter**. It now spans Publication and the docket, which the earlier lane treated only as seams.

---

## 3. Decisions and K-rulings: one line each, and their status now

Status key:
- **CANON**: folded into v0.2 or §9A on T.
- **REQ**: folded into T requirements (N893 and its successors). Build state was not verified; the new modules' status lines say "not yet met (T45)", later amended.
- **SUPERSEDED**: replaced by a later ruling.
- **DRAFT-ONLY**: only on DA.

**The `DECISIONS.md` register (DA) runs to D28 plus C1**, not just D1–D24 as BD-2 says. D25–D28 (rules 19–21) were added at `DECISIONS.md:31-34`.

| D | One line (DA `DECISIONS.md` line) | Status now |
|---|---|---|
| D1 | Outward acts classed by what the text does; assertions flagged and resolved by the member (:7) | CANON rule 2 (`BIO_Action_v0_2.md:40`); REQ (`REQUIREMENTS-HANDOFF.md:58`) |
| D2 | Case-account check on everything sent; a contradicted sentence held by default (:8) | CANON rule 3 (`:42`); REQ (RH `:83`) |
| D3 | Window shown, plus a quick one-finding case; an overridden action may join the escalation once determined. Revises K600 (a) (:9) | CANON rule 2; K-reading in K2780 |
| D4 | Three scopes (confidential act, counsel matter, source) and promises noted (:10) | CANON rule 15 (`:66`); REQ (RH `:18-19, :61`); K2782 (1): her hidden project never rescued |
| D5 | Curing act; harm addressed in plain words; docket outcome entry, then determination with the next edition (:11) | CANON rule 17 (`:70`); REQ (RH `:36, :47, :93`) |
| D6 | 6a stopped pursuing; 6b closing summary; 6c success record; 6d watch end dates (:12) | CANON §3, rule 17; REQ. 6d moved to `following` by K2781 (2) |
| D7 | A spoken promise binds only once confirmed in writing or public (:13) | CANON §3 Standard (`:23`); REQ (RH `:25`) |
| D8 | Templates, guides, legal facts, other states, member-drafted rules (:14) | CANON rule 11 (`:58`); REQ. K2781 (6): `@records-request` withheld until a named writer and review exist. K5509: beta texts kinds (`build/rulings-product/scope.md:21`) |
| D9 | Counsel packet at any stage; defence purpose (:15) | CANON rule 12; REQ (RH `:82`) |
| D10 | Any member may place a hold; plain hold notice (:16) | CANON rule 12; REQ (RH `:64, :121`) |
| D11 / a / b | Civicsmith never takes a policy position; advocacy gets an evidence check only; the assistant stays factual (:17) | CANON rule 9 (`:54`); REQ (RH `:38, :89, :104`) |
| D12 | Who speaks; reporter by role; press terms; thanks (:18) | CANON rules 5, 7, 8; REQ (`action-grammar` R20 ff.) |
| D13 | Replies quotable unless they say otherwise; open requests for comment shown once at signing (:19) | CANON rule 8 (`:52`); REQ `action-replies` R3 registers with `case-inputs.registerOpenRequests` (`build/requirements/action-replies.md:23-24`). K2780 reads K1483/K1484 row 14 with rule 8 |
| D14 | Departed member's items; "where it stands"; status reports (:20) | CANON rule 18; REQ |
| D15 | Formal party is Tier 2; "our deadlines"; compensation later (:21) | CANON rules 6, 13, §8; REQ |
| D16 / D16a | Partners now, joint approval designed; breach claims may rest on accepted foreign findings, determined by the claiming group (:22) | CANON §2, §3, rule 14; REQ (`conformance` R2 read with §3, K2780) |
| D17 | All options listed (:23) | CANON rule 4; REQ by K2443 (`build/rulings.md:2445`). SUPERSEDES K660 (2) |
| D18 | Override narrowed to two grounds (:24) | CANON rule 2; REQ (RH `:58`) |
| D19 | No limit on scenarios; set aside with a reason (:25) | CANON §3; REQ. SUPERSEDES K590 ruling 8 (K2780) |
| D20 | A response that is an infraction becomes a new matter, in the same or a linked project (:26) | CANON rule 16; REQ (`arose_from`; `action-replies` R6 `AROSE_FROM_REFUSED`) |
| D21 | Re-examination on each recorded response (:27) | CANON rule 16; REQ (RH `:105`) |
| D22 | Acting before publication; the published case carries a record of actions (:28) | CANON §1, rule 15; REQ (RH `:37`) |
| D23 | A case checked against every publication check, then held (:29) | CANON §3, rule 3; REQ new module `case-check` (L8) (`build/requirements/case-check.md:3`) |
| D24 | A determination may rest on a checked, held case (:30) | CANON §2, §3; REQ (`conformance` R2) |
| D25 / a / b | Infractions documented first, for named audiences; AI drafts where enabled (:31) | CANON rule 19 (`:74`); REQ (RH `:87, :103`) |
| D26 | Chance to fix offered before and after every step, never withdrawn (:32) | CANON rule 19; REQ |
| D27 | Managing the work: six additions plus A, B and C (:33) | CANON rule 20 (`:76`); REQ (`plan-work`) |
| D28 | Misuse guards a–e (:34) | CANON rule 21 (`:78`); REQ. D28e changed by K2782 (2), then K2799 (`:2800`): the `stewards` module is built now, with its address before release |
| C1 | Canon draft approved (:35) | Placed (K2780) |
| H2 readings | K1466 "activate"; R29 reason; addressee ≠ obligor; Action governs over Case Making (:37) | Confirmed by BOB, K2440 (`build/rulings.md:2442`) |

| K | One line (`build/rulings.md` line) | Status now |
|---|---|---|
| K590 | Rulings 1–10 and D1–D6 of ACTION_DESIGN #1; a member closes a plan (:593) | In force through v0.2, **except** ruling 8 "up to three scenarios", superseded by D19 (K2780); ruling 9's categories survive only in requirements (not checked) |
| K591 | Drafts staged for the fold at T17's close (:594) | History (done) |
| K592 | Design sessions do design only (:595) | Its principle carries into the lane rule in `CLAUDE.md`; "history" per BD-2 |
| K597 | Good faith with opposition; venue sets the evidence standard; certification deferred; confidential referral (:600) | CANON rules 12, 13, §8 |
| K600 | (a) refuse by default, override openly, never joins an escalation; (b) venue standard; (c) joint action deferred (:603) | (a) revised by D3 and narrowed by D18; (b) CANON rule 13; (c) partly lifted by D16 |
| K608 | v0.1 canon whole; drafts correct; plan-page UX approved; priority (:611) | v0.1 superseded (K2780); UX approval carried in v0.2 §7 (DEC-115) |
| K2433 | Charter of ACTIONS-DESIGN (:2435) | Lane ended (K3469); its area re-chartered by BD-2 |
| K2775 | Bob approves v0.2 and §9A; BOB owes placement and the T45 fold (:2776) | Done (K2780, K2781) |
| K2776–K2779 | **Not action rulings:** BOB #155 refresh, BOB #156 takeover, PLANE #32, T44's L11 close (:2777-2780) | Irrelevant to this topic |
| K2780 | Placement of v0.2, §9A, State Rules; the K-readings list (:2781) | In force |
| K2781 | N893 packaging: module splits; (3) **docket entries by a member's act are filed at once and made public by the manager's signing (DEC-116)**; (4) breach needs a *noncompliant* determination; (5) phrasings English only; (6) templates withheld (:2782) | In force (BOB's readings) |
| K2782 / K2799 | Own hidden project never rescued; stewards' reporting service built now (:2783, :2800) | In force (`build/rulings-product/stewards.md:5`, K2819) |
| K3469 | ACTIONS-DESIGN ended (:3468) | In force; superseded in effect by BD-2's new lane |
| K4942 | **Not about actions:** a throwaway Cloudflare account for the new-team rehearsal (:4937) | Irrelevant to this topic (it governs `CS_TEST_CF_ACCOUNT_ID`) |
| K5558 | Who files a correction, withdrawal or court order on the docket: "the project's owner, from the docket page" (scope.md:52; rulings :5552) | In force. Publication §5D says "manager" (see §4) |
| K5559 | A new edition is recorded on the docket automatically, with its "what changed" text (scope.md:53) | In force; **unbuilt**: ratification F1 (`build/requirements/ratification.md:220`) |
| K5820 | Bob halts Civicsmith development, 30 Oct (:5814) | Context: the process changed to Process3 afterwards |

**Readings recorded at placement** (K2780; RH `:14`). K590 ruling 8 superseded. K600 (a) revised. K660 (2) superseded. K1483/K1484 row 14 read with rule 8. `conformance` R2 read with §3. K1431 gains the fifth basis kind. D-147–149 homed at §5.

---

## 4. What touches publication, ratification, the docket and signing

1. **Checked-and-held** (D23/D24). A case passes every publication check and is held unsigned, with no time limit. Any change to the evidence voids the check. A determination rests on the held edition, then re-pins to the published edition (canon `:24`; DA `HANDOFF.md:68` H8; RH `:34, :43-46`).
   - Built as a new L8 module, `case-check` (K2781 (1); `build/requirements/case-check.md:3`).
   - It is a new state on the publication path itself, between authoring and signing.
2. **Signing view: open requests for comment** (D13; rule 8 `:52`). One fact line per open request, shown once, no reason asked, no gate.
   - Layer 8 cannot read layer 9, so it goes through a registration seam (H17 `HANDOFF.md:125`).
   - Implemented as `action-replies` R3 → `case-inputs.registerOpenRequests` (`build/requirements/action-replies.md:24`).
   - DEC-13 stays a declaration (right of reply is not a gate).
3. **The quoting rule** (D13). A reply is quotable "on the record unless the reply says otherwise". It amends the reading of K1483/K1484 row 14 (H17 `:124`; K2780).
4. **Publication §3 rule 15(d) is stale and still unchanged.** T `docs/architecture/BIO_Publication_v0_1.md:174`: "(d) a quote is read 'by' the action's own counterparty name, matched EXACTLY … NOT BUILT".
   - It predates role-based addressees (v0.2 rule 7). DA H2 flagged it (`HANDOFF.md:17`); so did R2 `:104, :296, :309` and S1 §D 18.
   - K2440 said the stale texts "go into that draft". v0.2 does not mention 15(d), and Publication v0.1 was not amended.
   - **This one belongs to the lane now.**
5. **Docket writes by a member's act "at once"** (rules 16 and 17: relevant replies, dated outcome entries) **against Publication §5D**, where "Only the project's manager places an entry in public, signing with their registered key" (`BIO_Publication_v0_1.md:370`).
   - BOB reconciled the two by reading: filed at once, made public by the manager's signing (K2781 (3)). The canon text is unchanged.
   - Separately, K5558 names "the project's owner" for corrections, withdrawals and court orders, against §5D's "manager".
   - Inference: the vocabulary of manager, owner and signer needs one canonical wording.
6. **A docket entry for each new edition** (K5559): not yet met. Ratification F1 (`build/requirements/ratification.md:220`) says nothing calls `docket.docketRecordEdition` after an edition commits.
   - BD-2's first ask frames F1 as a "second-signature design over docketStatement". Docket entries are signed SSHSIG over `signatures.docketStatement(case, seq, digest)` in `NS_DOCKET` (`build/requirements/docket.md:57, :127`; `screens-publish.md:47`).
   - Inference: the open design question is whose key signs the automatic edition entry, and when, because ratification signs the edition.
7. **The published record of actions** (D22, D4, D6a; rule 15 `:66`; rule 17).
   - It holds outward acts only. Never deliberation, confidential acts or counsel matters. Escalations are shown with "stopped pursuing, <date>".
   - Produced by `actions` R66 and registered to publication (DESIGN `:222`).
   - S1 §D 9 found that R66 leaked confidential entries; it was resolved in requirements by D4.
8. **The success record into the next edition** (D6c). A member's act in L9 calls an L8 op; L8 never reads it (DESIGN `:218`; RH `:39`).
9. **Docket pressure → litigation hold** (D10). L8 cannot call `actions`, so `queue-producers` raises the to-do from a docket `legal` mark (DESIGN `:224`; RH `:36, :121`). This was S1 §D 10.
10. **Holds against scheduled publication.** `actions` R69 registers `holdsOn` with ratification, so a hold placed since signing stops a publish-at-a-set-time (K1830/K1847, cited by R3 `:124`). S1 §D 11 noted conflicting reports and left it for BOB to verify; it is not verified here.
11. **Accepted foreign findings** (D16a). Import and recreation (Publication §5C), and the disclosure line on what is prepared (rule 3 `:42`). A withdrawal or revision by the source raises re-evaluation.
12. **The in-band stamp** (Publication §3 rule 9; v0.2 rule 14). Per-group stamp fields and the actor's identity and stake (D16, D28d; RH `:67, :86`).
13. **The never-published set** (rule 14 `:64`; rule 15). The plan, the counsel packet, status reports, the closing summary, notes and set-aside scenarios.

---

## 5. Ground truth to inherit, and what to re-verify

**Inherit as ground truth: canon approved by Bob, in force on T.**
- `BIO_Action_v0_2.md` whole, Ladders §9A and the State Rules §4.4/§5.1 edits (K2775, K2780).
- Publication v0.1 §5D (DEC-100, DEC-116, "RULED 2026-10-01 by Bob").
- Bob's verbatim D-rulings, DA `DECISIONS.md:7-35`. Bob's words are quoted there; D12–D16 and D18 were relayed through BOB #155's session and verified (K2742–K2752).
- The product rulings K5558 and K5559, and K5509 (beta kinds with texts).

**Re-verify before relying on it.**
1. **Build state.** Every new T45 module's status line says "not yet met (T45)", with later amendments. Whether `case-check`, `action-replies` R3 (the signing seam), `action-holds`, `plan-work`, `conformance` R2 and `escalation` "stopped pursuing" are built and green is unknown here. Note BD-1's lesson: met at the door, not at the interface.
2. **The S1 §D defects.** RH `:144` says §D 1, 2, 4, 5, 12, 13 and 15–19 "stand for BOB", and §D 3, 11 and 14 are "for BOB to verify". No later ruling closing them was traced in this read.
3. **Publication v0.1's own status.** `BIO_Publication_v0_1.md:3` says "v0.1 DRAFT … Awaiting Bob's review. It RULES NOTHING", yet `requirements/README.md:30` lists it as canon, whole. Its stale passages (rule 15(d)) and the "manager" wording need re-reading against v0.2 and K5558.
4. **The scope of "Publication & action".** BD-2 attributes it to K2433. K2433 chartered Actions only (`build/rulings.md:2435`), and the area label is BOB #333's (28 Oct, an artifact proposal). Bob's 6 Nov words confirm the mapping.
5. **D-numbers.** BD-2 cites "Actions D1-D24". The register goes to D28 plus sub-rulings. Rules 19–21 rest on D25–D28.
6. **DESIGN.md and REQUIREMENTS-HANDOFF.md** are DRAFT-ONLY lane documents. Where they and canon differ, canon governs (RH `:3`; DESIGN `:3`).
   - BOB changed several placements at the fold: D6d moved to `following` only, so the `monitoring` → `action-plans` edge was not needed (K2781 (2)).
   - Read the requirements, not DESIGN §11, for where things live.
7. **The artifacts are frozen copies** of DA files. The Actions Design page §3 ("What is built") and §4 ("The gaps") describe 2026-10-09 state (724/725 tests), which is long stale.
8. **K592's design-session rule versus Process3 lanes.** The CLAUDE.md lane rule now governs: the lane decides design and wording in its folder, and design documents are artifacts. Under the old process, Bob decided D-items.
   - Inference: which of the old "for Bob" items are now the lane's own calls should be read against the current lane rules, not K592.

---

## 6. Open questions, and whose call

| # | Question | Source | Whose call (inference unless cited) |
|---|---|---|---|
| 1 | Ratification F1: who signs the automatic edition entry on the docket (a second signature over `docketStatement`), and when | BD-2 `DECISIONS.md:39`; `ratification.md:220`; K5559 | **The lane** first. If it touches who may sign publicly (DEC-116, K5558), Bob's. BD-2: "If the lane rules it Bob's, it goes to the coordinator" |
| 2 | Rewrite Publication §3 rule 15(d) for role-based addressees (attribute a quote to the office by role; undetermined otherwise) | `BIO_Publication_v0_1.md:174`; H2 | Lane drafts. A canon change, so Bob approves it |
| 3 | One wording for who makes docket entries public: manager, owner, or signer (§5D against K5558 against v0.2 rules 16–17 "at once") | `BIO_Publication_v0_1.md:370`; K2781 (3); K5558 | Lane (wording); Bob if the actor changes |
| 4 | Publication v0.1's status: "DRAFT, awaiting Bob's review" but listed as canon whole | `BIO_Publication_v0_1.md:3`; `requirements/README.md:30` | Bob (canon status); lane proposes a v0.2 |
| 5 | Whether holds reliably stop a scheduled publication (S1 §D 11) | S1 §D 11; K1830/K1847 | BOB or the lane (verify in code) |
| 6 | Deferred by Bob, with triggers: licensed certification and court-petition templates; intervenor compensation; the backward question (D-165); full joint actions beyond partners | v0.2 §8 `:97`; D15; R4 `:175-189` | Bob (each lifts on its trigger) |
| 7 | Terms of use for Civicsmith (from D28) | H30 `HANDOFF.md:198`; K2774 | Bob |
| 8 | Stewards' contact address before a public release | K2799; `rulings-product/stewards.md:5` | Bob |
| 9 | The S1 §D defects still standing (the old form's bare-name addressee, queue doors, `@records-request`, affordances' four acts, `minutes_due_days`, profile gaps such as 2027 holidays and legal organisations) | S1 §D; RH `:144` | BOB (defects); lane only where they touch publication (§D 9, 10, 11, 18) |
| 10 | Whether D25–D28 should be cited in Ladders' Amended line (record nit) | `BIO_Capability_Ladders_v0_1.md:13` | Lane or BOB (record) |
| 11 | DEC-25 "a plan is never published": still provisional per R4 `:181` | R4 §5 item 3 | Bob (it is doctrine) |
