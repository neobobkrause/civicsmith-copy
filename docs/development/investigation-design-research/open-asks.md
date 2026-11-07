# Investigation lane: open asks at the account switch (2026-11-07)

This is the lane's handoff at Bob's account switch. The switch was cancelled on 7 Nov, and work resumed on the same account; the file stays as the list of open asks. A successor session reads `index.md`, then this file, then the two design documents below. It holds every ask still open, who owns it, and where its content lives.

## Design documents (claude.ai artifacts, recorded with `p3 lane artifact`)

| Document | Link | What it holds |
| --- | --- | --- |
| Investigation: best-practice departures (Q9) | https://claude.ai/artifact/THTtouNJzkhmHqyR4Pfa4g | The seven departures from best practice, with options and the lane's recommendations. Bob answered it as BD-14. |
| Investigation: requirements for BD-14 | https://claude.ai/artifact/UgRF58WWCfuDu88ztaKNbL | Draft requirements IV-1 to IV-11, and IV-H1 to IV-H4 (held), with the module and layer for each. It also gives the rival-hypotheses model for the ux lane and the screens owed to the ux lane. |

Snapshots of both are in `claude-ai/` (PR 765). The artifacts remain the working copies.

## Open asks

| # | Ask | Owner | State | Where |
| --- | --- | --- | --- | --- |
| A1 | IV-9's release-bar numbers for contrary recall. The lane recommends at least 0.8, with a gap to supporting recall of at most 0.1. Until Bob sets them, the measure is recorded and not enforced. | Bob, through the coordinator | Sent 7 Nov | BD-14 doc, Q9.5 |
| A2 | Q9.1: option B (IV-H2, full marks) or the rules-out fallback (IV-H4). Bob decides after the ux lane's clickable walkthrough. No job builds either until then. | Bob, after the ux lane | Walkthrough pending | BD-14 doc, Q9.1 |
| A3 | Q7: who may amend `BIO_Investigation_v0_1.md`. The lane's recommendation: the lane drafts as an artifact, Bob approves, and the module's job or BOB places it, as at K2417–K2420. | Bob, through the coordinator | Sent 7 Nov | `qualification-2026-11-07.md` Q7 |
| A4 | Canon lines waiting on A3: INV:85 gains "A look keeps where and how it searched; the path a step took is still not kept" (IV-4). INV:9 and `BIO_Declared_Bias_v0_1.md`:13 say regrade is "not built", but it is built (Q10). INV:5, :37 and :53 cite Action v0.1 rule numbers, which v0.2 shifted, and INV:5 points at an archived T41 draft. | the lane drafts once A3 is answered | Waiting | `qualification-2026-11-07.md` Q4, Q10 |
| A5 | Q8: one term per concept. "Objective" has three definitions; focus, problem, inquiry and question name one thing. The lane's recommendation: fix one term in the canon, under A3. | Bob, through the coordinator | Sent 7 Nov | `canon.md` §5 |
| A6 | Placement of IV-1 to IV-11 as found marks by layer. IV-2 rides the steps reopen and IV-4 the observation-log reopen (layer 11). IV-H1 to IV-H4 are placed marked held. | BOB | Paused for the account switch | BD-14 doc, Placement |
| A7 | IV-5 (a case states each look's parameters) and IV-7 (signing refuses `SECOND_READING_MISSING`, or the case states no second reading) are proposals to the publication lane under BD-13. | BOB, to the publication lane | Sent when placement resumes | BD-14 doc, Q9.3, Q9.4 |
| A8 | IV-3: CHECK's design (it runs when a conclusion is adopted and before signing; signals only). IV-8 to IV-10: the measures belong to the ai-design lane. | each module's job, from the BD-14 drafts | Routed as found marks (coordinator ruling (b), 7 Nov; no ai-design lane): CHECK (IV-3) to run-rules, with ratification for the signals at signing; contrary recall (IV-8, IV-9) to ai-gate and ai-runs; the counter-proposal pass (IV-10) to contradiction | BD-14 doc, Q9.2, Q9.5 |
| A9 | Screens owed to the ux lane for each draft. These include the Q9.7 grade-letter gloss and the Q9.1 walkthrough. The ux lane's seven questions on Q9.1 were answered on 7 Nov. | ux lane, through BOB | Answers sent | BD-14 doc, Screens owed |
| A10 | Found marks on owning modules for the stale references in the qualification record's Q4 list. | BOB | Recorded; filing paused | `qualification-2026-11-07.md` Q4 |

## Decisions already recorded

- **BD-13 (7 Nov):** the border with the publication lane.
- **BD-14 (7 Nov, PR 758):** Bob's answers to Q9. Q9.1 is B on a condition; his fallback is rules-out marks only; the UX check comes first.

Both are in `DECISIONS.md`, and their text is in `qualification-2026-11-07.md`.
