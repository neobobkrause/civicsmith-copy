# Qualification of the investigation lane, 2026-11-07

**Session:** the investigation lane's session, started by BOB (`session_018Bhceff4p3dNtYx3XNk4CX`) on 2026-11-06, under the QUALIFICATION brief (Foundations SES-19 to SES-23; Bob, 6 Nov).
**Tree:** the research cites tranche `617b48f5`, and this record lands on tranche `a480dd0e`. The pinned process is `.process` @ `56f8c932`.

## What was researched, and by which workers

Four read-only workers (subagents) ran in parallel. Each cloned its own checkout into the session's scratchpad and wrote nothing in the product checkout. The lane checked a sample of their citations against the tree: INV:85, INV:106 and INV:170, `hypotheses` R1, the missing ledger entries, and `build/modules.json`. All held.

| Worker | Topic | Output |
| --- | --- | --- |
| 1 | The Process3 canon governing the lane: the Foundations (read in full through the Docs connector), the pinned `.process` README, rulebooks, `notes/lane-charters.md` and `tool/lib/lane.mjs`. Also the product's `CLAUDE.md`, `process/config.json`, BD-2, `build/manifest.md` and `build/rulings.md`. | `process-canon.md` |
| 2 | The product's principles, the canon `BIO_Investigation_v0_1.md` read whole, the other architecture documents, and the ledger entries and requirement files of the modules the area serves | `canon.md`, `requirements.md` |
| 3 | The earlier lane's folder on `design/investigation` @ 87134cce (design of record, D1–D66, H1–H43, RESUME, S1), the T41 draft, the K2075 mapping, N1272, and the code in `bio-plane/src/investigation/` and its neighbours. The container restart of 6–7 Nov interrupted it, and it was resumed from its transcript. | `prior-design.md`, `code.md` |
| 4 | Public best practice in investigation method and tooling (24 sources) | `best-practice.md` |

## Sources not read

- **The earlier lane's design document and study** (https://claude.ai/artifact/QjSSFHE78G9PtwKhpW5ZEo and https://claude.ai/artifact/6cHHcybJpV3SPf25wVmeLN). Both answer "artifact not found". Their source files, `investigation-design.html` and `S1-relationships.md` on `design/investigation`, were read in full. BOB confirmed the artifacts no longer resolve (7 Nov) and pointed the lane to the repository's design of record.
- **Primary pages that were blocked or not public.** Story-Based Inquiry, the UK 3×5×2 scheme, the Admiralty scales and the figures on AI citation errors were taken from secondary sources, and `best-practice.md` marks each one.
- **The test suites were not run** (generated `setup-words/rows.mjs` is not built in a plain checkout). The ledger's COMPLETE states are the process's record, not a check by the lane.

## Ground truth the lane now holds

1. **Canon:** `BIO_Investigation_v0_1.md` is the source of truth for the area (K2417, K2419, K2420). The earlier lane's folder, D-register and hand-offs are history. D1–D66 are all ruled, withdrawn or superseded, except D23, the names members see for step, milestone and status report, which is owed with UX. BOB folded every hand-off H1–H43 that asked for something (`prior-design.md` §2–§3).
2. **What the lane decides:** design and wording in `docs/development/investigation-design/`, within the product's principles (`/CLAUDE.md`). Questions of values, policies, mission, audiences, principles, doctrine and Bob's approvals are Bob's, and go to BOB as "decision: Bob's" with options and a recommendation. Merging, sessions, other lanes' and modules' work, `.process/`, `process/` and deploying are not the lane's (`process-canon.md` §1, §4).
3. **Screens belong to the ux lane.** Asks to it go only through BOB (F SES-15).
4. **Nothing in the build reads the lane folder** today (`code.md` §3).
5. **The design largely meets or goes beyond best practice.** It keeps evidence apart from judgment, treats gaps as the work list, accounts for the falsifier, discloses exclusions, declares bias, checks citations in code, and measures the AI before release (`best-practice.md` §7).
6. **Built but unreachable:**
   - No screen sends any steps or investigation operation except "close project". The N1272 functions (`markForInterpretation`, `proposeParts`, `acceptProposals`, `interpretedFor`) are not exposed as operations, and `PROPOSALS_MEASURED` is empty.
   - The test investigations hold no matters, so no AI part passes its gate.
   - The reading-guide library is empty.
   - The front door follows subject doors, not D52's six destinations.
   - See `code.md` §2.
7. **N1272** is further along than `build/plan/next.md` says. C1, C2, C21 and C33 are ruled (K5445, K5495, K5496, K5537), and the requirements exist (extraction R114–R119, investigation R26–R32). What remains is screens, which are the ux lane's (`prior-design.md` §6).

## Open questions

### For BOB (process and records)

- **Q1.** The lane's module `investigation-design` has no ledger entry, requirements file or `build/modules.json` row. Should BOB create it, or drop `module` from the lane's config?
- **Q2.** The seed README says the lane folder holds "working files and hand-offs". The process says it holds only what the build reads. The lane will hold the process's reading and will rewrite the README when it first works in that folder.
- **Q3.** `steps`, `hypotheses`, `observation-log`, `retrieval` and `project-roster` have no ledger entries.
- **Q4.** Several references are stale:
  - The canon cites Action v0.1, which v0.2 replaced. Rule numbers are off by one.
  - The canon's pointer to its own requirements names an archived draft and 3 modules where about 18 cite it.
  - `investigation`'s cross-references to screen requirements point at the wrong ids.
  - `steps.md` and skills R43 still call the canon "owed".
  - DEC-84's design for presenting and resolving contradictions is not on the canon list.
- **Q5.** No convention says where the lane records a Bob decision durably now that D, H and K numbering is retired.
- **Q6.** The border with the publication lane (BD-2) around case making is not drawn: inquiry, leg, basis and conclusion, which the canon cites from `BIO_Case_Making_v0_1.md`.

### Decision: Bob's (canon and principles)

- **Q7.** Who may amend `BIO_Investigation_v0_1.md`, and does an amendment need Bob's approval? The lane's recommendation is that the lane drafts the amendment and Bob approves it, as was done at K2417.
- **Q8.** "Objective" is defined three ways (canon, System Design, `intent`), and focus, problem, inquiry and question name the same thing. The lane's recommendation is one term per concept, fixed in the canon, under the decision Q7 settles.
- **Q9.** These are best-practice departures, for Bob to weigh (`best-practice.md`):
  - Should a question hold rival hypotheses, with each leg marked consistent or inconsistent with each (Heuer's ACH)?
  - Should the lane add a key-assumptions construct and a standing red-team pass?
  - Should a "looked, found nothing" record its query and portal? This reverses INV:85.
  - Should one independent reading of conclusions be the default? Today it is optional (INV:170).
  - Should the AI be tested for recall of evidence against the case?
  - Should each leg give its reasoning, and should a published case disclose its funding?
  - Should published grades be shown in words?
  - The lane will bring these as one paper with options and recommendations, not one by one.

### Lane's own (to settle once asks are open)

- **Q10.** The canon says regrade is not built, but the case checker has lens code, and its requirements carry no "not yet met" mark. The lane will verify this in code and then correct the canon or the requirements.
  - **Settled 2026-11-07: the canon is the stale side; regrade is built.**
  - The lens re-check is case-checker R23 (`bio-plane/src/case-checker/lens.mjs`:24; `check.mjs`:824, :907).
  - Regrading an imported case is case-import R27 and R28, `op=importregrade` (`bio-plane/src/case-import/index.mjs`:146-148, :1146; `checks.mjs`:28). It is tested at the door in `bio-plane/test/m/case-import/regrade.test.mjs`.
  - Rerun is `op=rerunread`, which `bio-plane/src/screens-inquiry/project.mjs`:50 and :1018 draw.
  - The stale lines are INV:9 and `BIO_Declared_Bias_v0_1.md`:13. They were reported to BOB with the Q4 list; as canon, they wait on Q7.

## After landing (2026-11-07, BOB's answers)

- **Q1:** keep `module`. BOB creates `investigation-design` (its modules.json row, ledger entry and stub requirements) after layer 9, mirroring ux-design. The lane then owns the requirements text.
- **Q2:** follow the process. The lane folder's README is rewritten to that.
- **Q3:** BOB adds ledger entries for steps, hypotheses, observation-log, retrieval and project-roster in the same PR.
- **Q4:** BOB files each stale reference as a found mark on its owning module. The canon ones wait on Q7. DEC-84's document is `docs/development/CONTRADICTION-PRESENT-RESOLVE-DESIGN.md`, and the canon list is `requirements/README.md`:46.
- **Q5:** Bob's decisions go in `DECISIONS.md`, quoted with date and source. There is no new numbering.
- **Q6:** the lane drafted the border and BOB sent it to the publication lane. BOB decides after that lane answers.
- **Q7–Q9:** sent to Bob through the coordinator. Q9 comes back as one paper with options.
- **Q11.** Does the explorer's "untested" exception open exploration while the test investigations hold no matters?
