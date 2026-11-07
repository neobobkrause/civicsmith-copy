# Investigation lane research: principles and canon

Worker: canon and requirements topic, read-only. Tree: tranche at `617b48f5` ("Merge PR 668: lane/investigation-seed into tranche"), cloned to the scratchpad. Every claim cites `file:line`. Paths are relative to the repository root. `IV` means `docs/architecture/BIO_Investigation_v0_1.md`.

---

## 1. Where the principles live, and which rank first

| source | status | cite |
|---|---|---|
| Canon index | Lists every canon document and the part of it that is canon. Bob's DEC rulings are canon. | `requirements/README.md:1-50` |
| Mission | `BIO_Complete_Roadmap_v5.md` §§1–12: 4 core values, 8 operational principles, 15 design requirements in summary | `requirements/README.md:26`; Roadmap `:337-482` |
| Design Requirements | Govern when they conflict with the Roadmap or the Tech Arch. "The system fails if any requirement is violated." | `BIO_Design_Requirements_v2.md:3,5`; `BIO_System_Design.md:60-63` |
| System Design §1 | Purpose, the stance, three governing rules. §1 was amended for investigations on 2026-10-09 (K2420). | `BIO_System_Design.md:3,25-41` |
| Doctrine spine | System Design §7 | `BIO_System_Design.md:254-271` |
| Content Framework invariants | 9 invariants: "a proposal that violates one of these is wrong, not novel" | `BIO_Content_Framework_v0_10.md:304-343` |
| Capability Ladders §10 | "Doctrine every rung keeps", which binds every rung of every construct | `BIO_Capability_Ladders_v0_1.md:1406-1437` |
| Bob's UX principles | Verbatim and standing. Canon for the principles only, not for the phase description. | `docs/development/UI-KICKOFF.md:158-215`; `requirements/README.md:75` |
| Wide path and audiences | DEC-128 and DEC-129 | `BIO_Interaction_Constructs_v0_1.md:854-908` |
| The stance (doctrine) | Its source text survives only in archived CLAUDE files. Today's `CLAUDE.md` carries only the process rules, and System Design §1 quotes the stance. | `docs/archive/CLAUDE-2026-09-18.md:133-150`; `BIO_System_Design.md:33` |
| Requirements conventions | Rule 8: "Satisfies cites the canon by section … never by line" | `build/requirements/README.md:1-12` (lines 106-113 of the concatenated read) |

`build/requirements/standards.md` has nothing general on principles. It applies Operational Principle 1 to standards only (`build/requirements/standards.md:11,158`).

## 2. The principles that bind investigation design

Each line gives the principle, then the source of the binding text.

**Values and operational principles (Roadmap)**
- V3 "Accountability is built on credible facts. Nothing else holds up." V4 "Our government must follow the law and its stated policies." (`BIO_Complete_Roadmap_v5.md:352-356`)
- OP1: hold government to the law and its stated policies, and take no position on what the policies should be. OP2: show your work. OP4: follow the evidence, and when the evidence changes the findings change. OP5: credibility is shown by the work. OP6: pursue to completion. (`:368-382`)
- DR4: quality comes from publishing standards and reproducibility, not from gatekeepers. DR5: each group keeps its own accepted body of work. DR6: every work product carries standardized metadata, and people are named with their acts and ties (K1483). DR12: AI tools are advisory, transparent and optional, and "No tool gates any work product or action". (`:427-468`)

**System Design**
- The purpose is the member's path: "questioning, exploring, discovering, documenting, and impacting". A capability that does not serve the path is not obviously worth building. (`BIO_System_Design.md:27-31`)
- The product is "the trustworthiness of the record". "A defect that lets the record claim more than it can support is worse than a missing feature." (`:33-36`)
- Three rules:
  - undetermined is first-class and must be stated;
  - an outcome that costs nothing is not evidence;
  - **derived things inform, authored acts bind**: the machine looks and the member concludes (DEC-24). (`:38-41`)
- Grade tracks directness and never composes across scales. Absence at one level is not evidence of absence at the next. (`:113-117`)
- Spine (`:259-271`):
  - legs compose by AND/OR;
  - the weakest leg governs across AND and the strongest across OR;
  - sufficiency comes only by an attributed act (DEC-32);
  - a case is a production of a project (DEC-72);
  - inform once at the act and never nag (DEC-69);
  - no structural prior against any class of actor.

**Content Framework invariants**
- Inv 5: uncertainty is carried, not resolved. (`BIO_Content_Framework_v0_10.md:322-324`)
- Inv 6: technical complications are the system's problem. (`:325-329`)
- **Inv 7, as amended:** "Goal-directed work must not become goal-directed collection … a finding that cuts against a goal is surfaced as prominently as one that supports it." (`:330-336`; IV:55 cites it as amended)
- Inv 8: derived things inform, authored acts bind. (`:337-342`)
- Inv 9: the negative result is a finding. (`:343-344`)

**Case Making §4a ("less narrative")**
- "The tool should make a supported case easy to build and an unsupported one hard to state." Strength is shown, exclusions are named, and nothing drafts framing for a member. (`BIO_Case_Making_v0_1.md:331-345`)
- One exception (D56): the system may draft the case's account, labelled, and every sentence is then checked. No stories (D57). (`:345`)

**Capability Ladders §10 (every rung)**
- The machine never concludes. Machine drafts carry a label. Basis, grade and undetermined. Four-level absence.
- "Cause is stated, never inferred". "Hypotheses have a place, never in findings" (K1467). "Machine signals live in the hypothesis layer" (K1473).
- No standing AI run except a member's standing question and exploring that has been turned on (K1481, K2350).
- Closed-book answers. A due threshold raises a question, never a violation. The group's own dates are never findings.
- Citations: `BIO_Capability_Ladders_v0_1.md:1410-1435`.
- Also binding: measure before widening (D40); no drift into BI, case management or dashboards (DEC-48, D224, D231). (`:1437`)

**Interaction Constructs**
- PROPOSAL has three doors only: adopt, defer with a reason, dismiss with a reason. A proposal must visibly be one (D-82). (`BIO_Interaction_Constructs_v0_1.md:389-411`)
- Working and published are two spaces (DEC-106). (`:844-852`)
- The eight wide-path rules: a front door; wizards never gates; any order; many front doors, "no journey assumes everyone starts from a question". (`:870-881`)
- Every journey must work without the assistant (K1547). (`:905-908`)

**Bob's UX principles**
- Minimum visible complexity, layered abstraction, and the user's perspective. (`docs/development/UI-KICKOFF.md:162-174`)
- Relevant load-bearing state is always shown. One semantics table. Change carries as much weight as state. "Alive means live". (`:181-215`)

**The stance:** better government, less narrative, all stakeholders presumed to want better outcomes, and bad actors identified by evidence (`docs/archive/CLAUDE-2026-09-18.md:133-150`).

## 3. Canon: `BIO_Investigation_v0_1.md`, read whole (172 lines)

**Front matter**
- In force, approved by Bob on 2026-10-09 (K2417, K2419, K2420). It is the design of record (`investigation-design.html` on `design/investigation`).
- It states only what is new and cites the rest. It was approved together with amendments to about ten other canon documents, listed at IV:3.
- The lane's `DECISIONS.md` and `HANDOFF.md` "are not canon". (IV:3)

**Place**
- Level 1, under construct 8 (intent and inquiry). It depends on System Design §1, Case Making, CF §8.1, §12 and §14.4, Membership §7, Ladders §2 and §10, AI Roles §3, Declared Bias and Publication. (IV:5)
- "`BIO_Action_v0_1.md` begins where this ends." (IV:5)
- It says its requirements are T41's `steps`, `question-explorer` and `investigation` (`build/plan/draft-T41-investigation.md`). (IV:5)

**Incomplete**
- §3: the names members see for a step, a milestone and a status report, and a name that keeps the investigation's work apart from the action plan, are not ruled (D23, owed with the UX stream). (IV:8)
- §11: readers' re-check under a lens depends on regrade, which is ruled to be built and is not built. (IV:9)

**§1 Purpose and citations (IV:26-46)**
- The document covers how a group investigates a public body, from what comes in to a published case that another group can check and accept.
- "Judgement applies to what a finding signifies … never to what the facts are."
- A table points to where each matter is ruled elsewhere. It names Case Making for questions, legs, basis versions, conclusions and contradiction (DEC-76).
- "The machine proposes. A member accepts on the evidence … The machine never concludes, determines or attests."

**§2 An investigation is a project (IV:48-59)**
- A project has an **objective**. It pursues it by posing questions.
- The objective is the measure throughout, and the evidence decides it.
- The **objective's condition** states what the record must hold, not which answer is hoped for. Progress is computed and never reported. Gaps are the work list.
- An objective with no condition is shown as "cannot be computed", never as met. No member act declares an objective met.
- A determination is complied, did not comply, or unclear (Action §3). Compliance gets the same care (Action §4 rule 4).
- Legs and conclusions show their strength beside the bar. The bar gates publication only, never drawing a leg or concluding.
- Members write the objective and its condition, and revise them with a reason. Contrary finds are shown as prominently as supporting ones.
- The project page shows the objective, its condition, and the evidence for it, against it, and the gaps.
- **A question serves many projects.** Each project keeps its own relationship to it: draws on it, concludes, defers or dismisses. One project's deferral never affects another's.
- **A question shows the non-hidden projects that draw on it.** A hidden project is never shown, named or counted. This replaces the earlier rule that no project is shown, and carries a Membership §7.14 exception.

**§3 Steps (IV:61-79)**
- A step is work toward an answer, for context, to develop a question, or to work out how to respond.
- A member or the system does it. It is never an action, evidence or a leg.
- A records request the step needs is started as an action, and what comes back is the step's product.
- **Visibility follows placement:**
  - on questions: seen wherever any of those questions is seen, naming the project only if that project is not hidden;
  - in a project: seen by its participants;
  - for the group: seen across the group.
- **Ending a step:** it is ended or set aside, with what it produced and, optionally, what was learned. The outcome is per question (helped or dead end), recorded by a person. The system leaves it "not yet judged". Dead ends are kept.
- Products stay in the record whatever the outcome, including "looked, absent".
- **Deletion:** an untouched step can be deleted. One that was worked on keeps its record. Removing a shared step's reference is a *[detail]*.
- **Cost:** a step may carry a money cost (not AI use), as a working figure and never a money fact (K1463).
- **Cost sharing:** when no sharing project is hidden, owners are told the total and the sharing projects, and may relay messages. If any sharing project is hidden, no notice is sent.
- A chance find needs no step.
- Dependencies: a step may wait on a step, a document or a date, and loops are refused *[detail]*. By-when dates have a basis *[detail]*.
- **Going quiet:** shown once, with doors to write up and act, watch, close with gaps, or revise the objective. A display, not a stage.
- Waits on a question are visible like steps. A reminder stays private.
- **Milestones belong to a project:** named, dated, waiting on questions and steps.
  - A question is done only when *this* project has concluded on it. A deferred or dismissed question, or a step set aside, leaves the milestone stuck.
  - A milestone is never "met" when the work was dropped, and is never a finding about government.
- **Status reports:** drafted from the record since the last report. The member edits it and it is kept dated. It is never published, has no per-member figures, and is never scheduled.

**§4 Saving steps and questions (IV:81-94)**
- "The record is the data": a cache with change tracking plus maps.
- Investigations and actions are processes on the data. Steps are mini-investigations.
- A look that found nothing is kept in the **observation log**. A refusal or silence is kept in the records request's correspondence.
- Data found later reaches dead ends through change tracking. The earlier look stays, and a member may revise the outcome.
- **A step is saved** as a record tied to its referring questions. It has no purpose of its own. It keeps its state and dates, its per-question outcome, who did it, its products (through provenance) and what was learned.
- **Steps are searchable** so work is not duplicated. Shared step products serve every referring question. Each project concludes for itself.
- **The unit saved, searched and reused is the question**, carrying its steps, outcomes, evidence and answer. Six uses follow, including that "a published case states what was searched and with what outcome, computed from the record's looks".
- "Why a document is held" is read from the record (step to questions), never written separately.

**§5 The system's part (IV:96-111)**
- **Members** pose, take steps, hold hunches and hypotheses, close steps, decide evidence, conclude, publish, determine and act.
- **The system and AI:**
  - take steps (search, read, capture addresses the record already points to, AI Roles rule 12);
  - explore where an account owner turned exploring on;
  - hold their own hunches;
  - judge how a find bears;
  - offer finds.
- **One accepting act for every proposal:** take it as proposed, take it edited, or write your own. The record keeps which. Where vouching is involved she writes it in her own words. Acceptance rates are measured group-wide only.
- **A fact the AI found loses no strength:** a code-checked quote keeps the document's capture grade. Only text the AI read from a picture is weaker until measured.
- The system's judgement is a **labelled signal** (K1473) with its method and false-alarm rate. It is never a grade or a stored score, and never ranks or hides.
- The system's hunches and hypotheses sit under their own heading. A member who takes one up holds it as her own (K1467).
- Finds go once to the queues of joined members of every drawing project, never by email. Members can follow or stop following.
- Which account paid is shown only to that account's owners.

**§6 AI use (IV:113-128)**
- Accounts, limits, the exploring setting (No, Ask every day, Yes) and the two kinds of "no" are ruled in Ladders §2 and §10 (K2350, K2352, K2353).
- **A project's "no AI"** covers only its own material. Shared material follows the group's setting *[detail]*.
- **The intake interview** has the same six questions on both paths. The member checks the answers, and they are kept as narrative.
- **How answers are worded:** baselines side by side, with no verdict, likelihood or rating words. "Cause not established". A stated cause is quoted. "Late" only where a finding at the bar shows it.
- **Pictures of pages:** the AI may transcribe them. The text is "undetermined" until measured or until a member confirms it against the page.
- **A note beside a source:** every sentence is tied to a quote. It is never shown in place of the source and never cited.
- **Reading guides:**
  - by hand a guide is a checklist, and for the AI it is a skill;
  - Civicsmith's library is approved by Bob or a delegate after measured use;
  - each group keeps its own, reviewed by a second member, and guides are shared across groups;
  - "no guide can loosen" the rules of conduct, and code checks it.
- **Test investigations** gate every AI part (D11, K2064). A group may add its own. Transcripts are used only for grading.
- Several steps at once: one estimate, and each step keeps its own limits.
- **The AI's rules** are approved by Bob in plain language. Working instructions may only quote them, and code checks it.
- Cost is estimated before and shown after, to the paying owners only.
- **Reading inside a document:** a few pages at a time. The AI proposes quoted passages and connections. The machine never grades a connection D.
- Use is tracked per account, per type, over time. Nobody sees another member's spending.

**§7 The first message (IV:130-135)**
- One door: "What happened?". With the assistant, the assistant proposes where to go. By hand, the member gets guided starts, matching existing work, or a blank start.
- **Six destinations:**
  1. a project;
  2. add to an existing question or project;
  3. a lead, optionally watched;
  4. a step for understanding;
  5. an action;
  6. "not something Civicsmith does".
- A member's own matter lives in her hidden project, and nothing private is ever published.
- A tangled message becomes one project when the subjects are shared, otherwise separate projects. Rumours become leads, never questions aimed at a person *[detail]*.

**§8 Narrative and evidence (IV:137-143)**
- Recollection is narrative. Firsthand experience can be testimony (CF §8.1, §14.4).
- A claim in the narrative becomes a "find the record" step, shown as recalled until it is found.
- A shared private note is narrative, never evidence and never published, and can be withdrawn.
- Each baseline in an answer names what it rests on: a document, a firsthand account, or "as recalled", plus the look state ("not yet looked for", or "looked for and not found" with where).

**§9 People (IV:145-150)**
- Investigations reach anyone whose acts bear on a public body. Officials are investigated in their official acts.
- A member is warned at the act when a person with no public role is named.
- The system never explores a person on its own: only a person a member tied to the question, and only up to a fixed amount per run.

**§10 Parts to build (IV:152-159)**
- `steps`, `question-explorer` (built separately so the investigation works fully without AI, and gated by test investigations), `investigation` (milestones and status reports), reading guides (placed by BOB), and **Planning** (the interview, words into questions and steps, claims into find steps, with its own test bar).
- Everything else extends existing parts.

**§11 Publishing a case: what is new (IV:161-172)**
- **The case's account:** the system may draft it, labelled. The member writes it.
- **Every sentence is checked:** unsupported is flagged, contradicted is refused, and bias framing is allowed only when marked and tied to a printed statement. "Lying is not bias."
- **The case's statements about itself** get the same check.
- **No stories.**
- **Readers' re-check under a lens:** as published, bias removed, or the reader's own lens, with an honest-limit sentence.
- **An approval rule** (off by default).
- **Reviewers:** the publisher decides what to include, and a reviewer may add comments after publication.
- **Accepting another group's case:** finding by finding, or all in one act. Accepted findings are read-only, are never stronger than their edition, and are re-raised on withdrawal.

## 4. The other canon that defines investigation terms

**Inquiry: one recursive object**
- Focus, finding and case collapse into one recursive object: a question, which may gather evidence and other inquiries, may conclude, and may be published. (`BIO_Case_Making_v0_1.md:498-529`)
- DEC-72 amends it: a **case** is a *production of a project*, not a phase. (`:588-597`)
- Member-facing names (`:599-614`):
  - *inquiry* while open;
  - *finding* once concluded;
  - *case* once published.
- Machine states: `open → concluded → published`.
- These do not collapse into the inquiry (`:555-572`):
  - `information` (evidence);
  - `action` (engagement);
  - `project`, a container with membership.

**Claim**
- A FIELD of an inquiry. Concluding adopts it.
- Sufficiency is never a threshold inside the object.
- The falsifier is *accounted for*: it is stated, or its absence is stated and attributed (REC-117).
- Cite: `BIO_Case_Making_v0_1.md:667-700`.

**Division**
- It is ruled. Dividing the basis is an authored act. A published case cannot be divided.
- Division is needed because the weakest link governs.
- A case cited as a leg passes on its strength.
- Cite: `:621-665`.

**R1–R4** (`:1153-1311`)
- R1: an UNDETERMINED leg leaves the chain UNRATED.
- R2: the capture and connection scales never compose.
- R3: an explicit cycle guard.
- R4: division costs at least what severance costs, which protects invariant 7.

**Contradiction**
- Three cases (Q14) (`:806-846`):
  - in the WORLD it is a finding;
  - in the RECORD it is a defect with a duty to identify, present and resolve;
  - imprecision is NEITHER.
- DEC-76 (`:864-868`):
  - a contradiction is conditional, "in the same respect";
  - a candidate a member takes up becomes an INQUIRY;
  - its resolution is DISSOLVED, CORRECTED or GENUINE.
- DEC-77 (`:868`):
  - the contradiction is met inline;
  - six forms;
  - acceptance is attributed;
  - the acceptance rate is measured against steering.
- Hazard: CF's "contradicting aspirations" is a different construct. (`:878-886`)
- IDENTIFY is designed at level 2 (`docs/development/CONTRADICTION-IDENTIFY-DESIGN.md:3`).

**Intent (goals, objectives, aspirations)**
- Aspiration never closes. Goal closes eventually. **Objective** closes checkably, with a satisfaction condition. (`BIO_Content_Framework_v0_10.md:1117-1134`)
- Satisfaction conditions (`:1152-1177`):
  - progress is derived, not reported;
  - the gaps are the work list;
  - an AI's contribution is auditable.
- The discovery loop (`:1179-1221`):
  - a finding is a proposal;
  - a deferral is recorded with its reason;
  - a contrary finding takes the same path;
  - "An assistant may propose at any point in the loop and adopt at none of them."
- "An assistant may open a focus unattended" is **superseded by K1481**. (`:1223-1225`)

**Grades and testimony**
- Connection grade A–D (D is a member's assertion, i.e. testimony). (`BIO_Content_Framework_v0_10.md:685-700`)
- The machine never mints D. "An explicit link … is not a hunch". A HUNCH is a suspicion authored with no captured basis, and it is debt that must be cleared before publishing. (`:1870-1888`)

**Hunch debt**
- Bias debt is DISCLOSED. Hunch debt is DISQUALIFYING: uncleared hunch debt refuses publication. (`BIO_Declared_Bias_v0_1.md:283-344`; ruling `:380`)
- Regrade: "to be BUILT, after steps and the question explorer" (D59). (`:581`)

**Hypotheses and signals**
- Hypotheses have a place but never in findings, and a store-side check refuses a hypothesis id in a leg (K1467).
- Signals live in the hypothesis layer, with method and false-alarm rate (K1473).
- Cite: `BIO_Capability_Ladders_v0_1.md` §10 (the table rows "Hypotheses have a place…" and "Machine signals live in the hypothesis layer").

**Questions ladder L0–L5** (`BIO_Capability_Ladders_v0_1.md:1247-1256`)
- L4 investigative questions: a run with capture requests, plus the backward question.
- L5 standing questions: K1481.

**Observation log** (level-2 canon; `docs/development/OBSERVATION-LOG-DESIGN.md`)
- The record and the observation log are separate (line 3).
- Its sections: the one table, writers, the frontier as a view, readers (lines 63-486).
- It is a v0.1 DRAFT "Not yet reviewed by Bob" (line 3), yet it is listed as canon (`requirements/README.md:58`).

**Leads and testimony** (level-2 canon; `docs/development/MEMBER-KNOWLEDGE-DESIGN.md`)
- Testimony is a third grade axis (§3, line 79).
- The lead (§5, line 207).
- "An opinion is not evidence" (§6, line 258).

**Proposal and accept**
- Interaction Constructs §P (`BIO_Interaction_Constructs_v0_1.md:389-411`).
- AI Roles §3 rules 11 and 12, as amended for investigations (`BIO_Assistant_and_AI_Roles_v0_1.md:72-73`).

**Analysis layer**
- Compare to standards, cross-reference, classify fact, analysis or judgment, and judge significance (a human act).
- Outputs: Compliant, Noncompliant, Unclear.
- A surfaced discrepancy is persisted as a "Focus".
- Cite: `BIO_Functional_Architecture_v3.md:244-342`.

**Records not canon**
- `CONSTRUCTS.md` is "a dated inventory of July 2026" and its "Focus" vocabulary is history (`requirements/README.md:91`; `CONSTRUCTS.md:289-319`).
- `construct-status.json` is retired; the build state is `build/` (`requirements/README.md:100`).

## 5. Conflicts and stale points between documents

1. **Action v0.1 vs v0.2 (rule numbers shifted).**
   - IV cites `BIO_Action_v0_1.md` at IV:5 and IV:37, with "Action §4 rule 4" for compliance counting (IV:53) and rules 1, 2, 4 for the breach gate.
   - v0.1 was replaced by v0.2 on 2026-10-11 (K2780; `requirements/README.md:18,41`). IV was approved two days earlier.
   - In v0.2, rule 4 is "No significance, no score" and **rule 5** is "Compliance counts" (`BIO_Action_v0_2.md:44-46`, vs `BIO_Action_v0_1.md:33-34`). IV's rule citations are now off by one.
   - System Design row 16 still names v0.1 as home (`BIO_System_Design.md:95`).
2. **IV's own requirement pointer is stale.**
   - IV:5 cites `build/plan/draft-T41-investigation.md`, which now lives at `build/plan/archive/drafts/draft-T41-investigation.md` (the old path does not exist).
   - IV:5 names only three requirement modules. At least eighteen requirement files cite the investigation design: hypotheses, intent, leg-earning, inquiry, inquiry-grammar, observation-log, contradiction, skills, reading-guides, run-rules, run-productions, ai-runs, ai-use, record-grammar, case-*, bias, extraction (see `requirements.md`).
3. **"Objective" has three shapes.**
   - IV §2: an objective is a project's, with a condition (IV:50-52).
   - CF §12: "an objective is what a `project` carries … an open question is a `focus`" (`BIO_Content_Framework_v0_10.md:1137-1144`).
   - System Design row 8 lists as ABSENT "goals and aspirations as objects (an objective is a zero-leg open inquiry)" (`BIO_System_Design.md:87`).
   - The `intent` module holds goals and aspirations as objects already (`build/requirements/intent.md:15`).
   - So System Design's "absent" and "zero-leg inquiry" are stale or contradictory.
4. **The condition's vocabulary is narrower than IV's example.**
   - IV:52's example: "for every contract award … the solicitation and the public vote, or a records request answered that none exists".
   - `intent`'s condition is one progression × entity × grade × stages (`intent.md:15`, R4). It gained the "records request answered none exists" arm (R33).
   - Neither CF §12 nor `intent` expresses a condition over the project's *questions* (for example, "these questions concluded at the bar"). Unresolved whether IV intends that.
5. **Vocabulary drift: focus, problem, inquiry, question.**
   - CF §12 and its loop diagram use `focus` and `problem` with states `surfaced → elevated → deferred → dismissed` (`BIO_Content_Framework_v0_10.md:1139-1141,1196-1197`).
   - Case Making renamed focus to inquiry (`BIO_Case_Making_v0_1.md:599-623`).
   - IV says "question" throughout.
   - Interaction Constructs §P still offers "adopt (into an objective, a focus, a problem)" (`BIO_Interaction_Constructs_v0_1.md:409`).
   - Functional Architecture persists discrepancies as a "Focus" (`BIO_Functional_Architecture_v3.md:283-288`).
   - The member-facing name for a step, a milestone and a status report is unruled (IV:8, D23).
6. **Case Making's authority is stated two ways.**
   - Its own status: "Superseded as design authority … complete as the reasoning record. Read it for WHY" (`BIO_Case_Making_v0_1.md:3`).
   - The canon index: canon "whole except §2's action paragraphs and §THE ACTION PLAN" (`requirements/README.md:39`).
   - IV cites it as the authority for questions, legs and conclusions (IV:34).
7. **Contradiction PRESENT and RESOLVE.**
   - System Design row 8: "PRESENT and RESOLVE are not yet designed" (`BIO_System_Design.md:87`).
   - They are designed in `docs/development/CONTRADICTION-PRESENT-RESOLVE-DESIGN.md` (DRAFT, ruled by DEC-84, line 3), but that document is **not on the canon list** (only IDENTIFY is, `requirements/README.md:61`).
8. **Regrade: "not built" vs requirements met.**
   - IV §11 is incomplete because regrade "is not built" (IV:9). Declared Bias says the same (`BIO_Declared_Bias_v0_1.md:13`).
   - Yet `case-checker` R23 (a lens re-check: as_published, removed, a reader's own) and `case-import` R23 and R27 (`regradeImported`, `op=importregrade`) are requirements carrying no "not yet met" mark (`build/requirements/case-checker.md:72`; `case-import.md:88,92`).
   - Either the canon is stale or the requirement marks are wrong. For the code worker to verify.
9. **Status of the level-1 and level-2 documents.**
   - System Design, AI Roles, Publication, Declared Bias, Observation Log Design and Contradiction Identify each call themselves "v0.1 DRAFT … awaiting Bob's review" (`BIO_System_Design.md:3`; `BIO_Assistant_and_AI_Roles_v0_1.md:3`; `BIO_Declared_Bias_v0_1.md:1`; `docs/development/OBSERVATION-LOG-DESIGN.md:3`).
   - The canon index makes them canon whole: "unreviewed drafts are canon as they stand" (`requirements/README.md:18`).
   - Not a conflict in force, but a reader of the front matter alone will be misled.
10. **Interaction Constructs file name vs version.**
    - The file is named `_v0_1` while its body is v0.2 (`BIO_Interaction_Constructs_v0_1.md:1,3`).
11. **System Design row 8 does not name IV as a home.**
    - IV places itself under construct 8 (IV:5).
    - Row 8's "home" cell names CF §12 and Case Making only (`BIO_System_Design.md:87`).
    - `CORPUS-STANDARD`'s single-authority idea suggests row 8 should point to IV.
12. **The unattended focus vs K1481 and K2350.**
    - CF §12's "assistant may open a focus unattended" is struck as superseded (`BIO_Content_Framework_v0_10.md:1225`).
    - Exploring (IV §5, §6) is the one new unattended AI run, and it was re-admitted by K2350 (`BIO_Capability_Ladders_v0_1.md` §10, "No standing AI run but …").
    - Consistent now, but CF §12's surrounding text (`:1226-1272`) still argues for the struck behaviour.
13. **The stance's source.**
    - System Design §1 cites "`CLAUDE.md`, 'The stance'" (`BIO_System_Design.md:33`).
    - The current `CLAUDE.md` is the Process3 file and carries no stance. Its text survives only in `docs/archive/CLAUDE-2026-09-18.md:133`.
14. **Analysis outputs vs determination words.**
    - Functional Architecture: Compliant, Noncompliant, Unclear (`BIO_Functional_Architecture_v3.md:330-341`).
    - Action v0.2: compliant, noncompliant or unclear (`BIO_Action_v0_2.md:24`).
    - IV: "complied, did not comply, or unclear" (IV:53).
    - The same meaning in different words: a wording point for the lane.
