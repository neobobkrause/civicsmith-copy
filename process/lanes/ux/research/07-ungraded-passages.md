Length: 36 lines. Last section: "4. Searched and not found".

# UX research 07: publishing a case while cited passages have no grade (the lane's Q1)

UX lane research, 26 Nov 2026, by a worker for civicsmith ux lane #5, on the owner's instruction of 26 Nov 2026 (`process/decisions-owner.md`, "Lanes and the canon"): "Instruction: lanes use a worker to search the canon for the answer on ungraded passages, and always searches the canon for the answers it needs before bringing questions to me." The lane checked the quotations in section 2 against the files. Ranks as `process/ranking.md` gives them.

## 1. The answer

The canon answers Q1 through the owner's DEC-18 (2 Aug 2026). An ungraded leg (a cited passage on which a conclusion rests) contributes nothing, is always named on the case, and does not hold up a conclusion that has graded legs: that conclusion is graded on its graded legs alone. A conclusion whose every leg is ungraded is UNRATED. The signing check refuses it (`BELOW_PROJECT_STRENGTH`) only where it is a load-bearing member on an axis for which the project declared a required strength; a supporting member, or an axis with no declared strength, publishes showing UNRATED. No rule refuses publication because some cited passages are ungraded. The lane adds no rule.

## 2. Where the canon says it

- `docs/architecture/BIO_Case_Making_v0_1.md:1182-1200`, R1 as amended by the owner (DEC-18, rank 2 as his ruling): "An ungraded leg doesn't contribute to a conclusion, but if there are other graded legs, then it doesn't suspend the conclusion either." "An ungraded leg contributes NOTHING. Not weighed, not averaged, does not floor, does not unrate." "The conclusion is graded on its load-bearing legs". "UNRATED survives as the boundary case. If EVERY leg is ungraded there are no load-bearing legs ... and it is UNRATED." The owner, same review: "more than one leg may have no established grade, in which case every such leg will be named."
- Same file, `:1168-1170` (rank 3): "A case may still publish with strength stated as UNRATED pending that leg — honest, publishable, and impossible to hide."
- Same file, `:1202-1214` (rank 3): the hazard the amendment creates (leaving a leg ungraded keeps it out of the reckoning) and the three things that stand against it: every ungraded leg named on the case and in the index row; the authored completeness statement; invariant 7. "no build session assumes a fourth is needed". Whether that suffices is D-159, a question for use.
- `process/modules/case-authoring.md:26`, R6 [met] (rank 4), the signing check: "On each axis it declares, each load-bearing member's pair (`strength.strengthOf`) must reach it; an unrated or undetermined axis does not: `BELOW_PROJECT_STRENGTH` ... Supporting members and undeclared axes are not asked".
- `process/modules/strength.md:22`, R3 [met] (rank 4): "An ungraded member is inert: it contributes nothing, is never floored and is always named in `not_load_bearing` (DEC-18)."
- Also rank 4, the same rule: `process/modules/inquiry.md:137` R32; `process/modules/citation.md:69` R8; `process/modules/leg-earning.md:66` R10. On the published page, `process/modules/screens-publish.md:128` R81: an axis graded neither A to E draws `screen.published.strength.unrated` or `.undetermined`, "never nothing".
- `docs/development/INVESTIGATIVE-SESSION.md:1082-1085` (rank 3): "An ungraded leg is INERT AND NAMED (DEC-18)".

## 3. Later rulings

Nothing reverses DEC-18. DEC-32 (`docs/development/DECISIONS.md:563`, `:710`) applies the same pattern to branches: a finding suspends "only when every branch is — DEC-18's pattern". DEC-70 (`DECISIONS.md:353-355`): "a severed leg still contributes nothing to strength, gates nothing, and counts toward no bar." The owner's 22 and 23 Nov 2026 words on Q1 (`process/decisions-owner.md:33-36`) leave DEC-18 standing, as the lane read them.

Two cases that look alike and are not: a leg graded only from a hunch is inert too, but hunch debt still refuses publication (`process/modules/strength.md:24` R5; `process/modules/case-disclosures.md:118` R16, `UNCLEARED_HUNCH`).

## 4. Searched and not found

DEC-18 has no entry of its own in `DECISIONS.md` or the archived August ledger; its words survive where quoted (Case Making R1's amendment; `docs/development/research/RECONCILED.md:140`; `INVESTIGATIVE-SESSION.md:362`). `BIO_Design_Requirements_v2` says nothing on ungraded passages. The Content Framework (`:1789-1799`) covers the derivation cap, not publishing. Small citation slip noted, not the lane's: Case Making credits the project's required strength to DEC-15 at `:696` and to DEC-17 at `:1053`. Searched: "DEC-18", "ungraded", "UNRATED", "not graded", "no grade", "contributes nothing", "required strength", `BELOW_PROJECT_STRENGTH`, across `docs/`, `process/` and the archived ledgers.
