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
| A1 | IV-9, the release bar for contrary recall. | decided | Decided as PD-8 (process3 PR 247, 7 Nov): a parity rule from the first Gate 1 run (contrary-recall interval wholly below supporting-recall fails), with no number; the absolute floor is unset until after the first measuring run (AD13), Bob's unless delegated. Placed as ai-gate F4 (PR 929). | BD-14 doc, Q9.5 |
| A2 | Q9.1, rival explanations. | decided | Decided by Bob's 7 Nov ruling, superseding BD-14's Q9.1: rivals are hypotheses; a member's "Explore this next" mark only orders exploring; a rival changes only through a conclusion at the bar that names it (BD-17, PR 940). Bob approved the ux lane's walkthrough v5. The redraft (https://claude.ai/artifact/B8gA6JgeBfYVYpWSD5j2tm, rev 7) is placed as hypotheses F1 (IV-H1, IV-H2) and inquiry F2 (IV-H3) (PR 939). Its IV-1 and IV-10 rewordings go to BOB under A6. | redraft doc |
| A3 | Q7: who may amend `BIO_Investigation_v0_1.md`. | decided | Decided as BD-16 (7 Nov): the lane drafts each amendment as an artifact, Bob approves, and BOB or the module's job places it. | `qualification-2026-11-07.md` Q7 |
| A4 | The canon lines that waited on A3: INV:85 (look parameters), INV:3, :5, :9, :37, :53, and Declared Bias :13. | decided | Drafted as C1–C8 in "Investigation canon amendments (BD-16)", https://claude.ai/artifact/THyuxTMAiQHUSo6rDLYVX4. Bob approved it as written on 8 Nov. BOB places it after layer merge 11 and records it under BD-16. | amendments doc |
| A5 | Q8: one term per concept. | decided | Bob, 7 Nov (BD-16): "every reasonable effort should be made to use one unique term per concept". The term table and changes T1–T3 are in the amendments doc, approved as written on 8 Nov: question (identifier `inquiry`; focus and problem fold into it), objective, step, action, goal and aspiration. | amendments doc |
| A6 | Placement of IV-1 to IV-11 and IV-H1 to IV-H3 as found marks. | decided | Placed by BOB: rivals as hypotheses F1 and inquiry F2 (PR 939); IV-1 as inquiry F3 and IV-10 as contradiction F2, both from the redraft (PR 944); IV-9 as ai-gate F4 (PR 929). The rest of BD-14's drafts follow the BD-14 doc's placement table. | BD-14 doc, redraft doc |
| A7 | IV-5 (a case states each look's parameters) and IV-7 (signing refuses `SECOND_READING_MISSING`, or the case states no second reading) are proposals to the publication lane under BD-13. | BOB, to the publication lane | Sent when placement resumes | BD-14 doc, Q9.3, Q9.4 |
| A8 | IV-3: CHECK's design (it runs when a conclusion is adopted and before signing; signals only). IV-8 to IV-10: the measures belong to the ai-design lane. | each module's job, from the BD-14 drafts | Routed as found marks (coordinator ruling (b), 7 Nov; no ai-design lane): CHECK (IV-3) to run-rules, with ratification for the signals at signing; contrary recall (IV-8, IV-9) to ai-gate and ai-runs; the counter-proposal pass (IV-10) to contradiction | BD-14 doc, Q9.2, Q9.5 |
| A9 | Screens owed to the ux lane for each draft. These include the Q9.7 grade-letter gloss and the Q9.1 walkthrough. The ux lane's seven questions on Q9.1 were answered on 7 Nov. | ux lane, through BOB | Answers sent | BD-14 doc, Screens owed |
| A10 | Found marks on owning modules for the stale references in the qualification record's Q4 list. | BOB | Recorded; filing paused | `qualification-2026-11-07.md` Q4 |

## Decisions already recorded

- **BD-13 (7 Nov):** the border with the publication lane.
- **BD-14 (7 Nov, PR 758):** Bob's answers to Q9. Q9.1 is B on a condition; his fallback is rules-out marks only; the UX check comes first.

Both are in `DECISIONS.md`, and their text is in `qualification-2026-11-07.md`.
