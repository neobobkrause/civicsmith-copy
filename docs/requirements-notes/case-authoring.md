# case-authoring — requirements notes

Text moved out of `build/requirements/case-authoring.md` on 5 Nov 2026 to bring it under the 70,000-byte cap, word for word (job case-authoring, T53). None of it is a requirement: every **R** and **F** line stays in the requirements file, with its mark. `bio-plane/test/m/case-authoring/requirements-ids.test.mjs` asserts the move changed no id and no mark.

## Status history and Size (moved from the requirements file)

**Status** · In force: approved by Bob 2026-09-26 (K102), split from `publication`'s draft (K94); DEC folds approved by Bob (K1019). Split for size (N529, K617, K1333): ids moved to `case-disclosures` are retired here; the disclosure renderers are `case-disclosures`' and imported, never copied (K1333). Last changed T35 (T35-59: R58, R59, C-44.6) and T37 (T37-21: R14, R34 amended; R62 new; N757, N761; K2129, K2175, K2206; DEC-180); those marked not yet met (T37), every other requirement met (K2014). Last changed T41 (T41-43's text: R63–R68 new; N820; D56, D57, D60, D61, D63; K2405, K2417, K2418); marked not yet met (T41). Split for size a third time (N839, K617, K1333, K2608; T42-23; `build/extraction/case-account-split.md`): R64 and R66 are retired here as moved to `case-account` R1–R4 and R7, R63's shape and judgment are its R5 and R6, R63, R65, R67 and R8 are re-pointed and R69 is new, marked not yet met (T42). Last changed T43 (T43-12: R69 amended, the three pass-throughs deleted, `case-account`'s alone; Uses struck; N850; K2608, K2689), not yet met. Last changed T46 (T46-27: R73 new, wording only, four of R71's rows and two of the sign step's open-request sentences read by key from `words.json`, `BAD_CARRIED_OUTCOME`, `.nowindow` and `.unread` kept and returned to BOB; DEC-194, N913); met (K2969). Split for size a fourth time (N908, K617, K624, K2982; T47-31, T47-32; `build/extraction/case-authoring-split-2.md`): R19–R21, R28, R39, R59, R62, R70, R71 and R73 are retired here as moved to `case-inputs` R1–R11; R74 (R71's clauses inside `publishCase`) and R75 (the sign step's `publish_at`, N683; ratification R44) new; R9, R14, R25, R27, R29, R34, R38, R65 re-pointed, meaning unchanged; this module holds no table; marked not yet met (T47). Fix round 6 (T51): R85 new, `op=publish` makes the small document copy in the act (G9; K4573).

**Size (P6).** About 3,340 lines move (about 1,610 without comment-only and blank lines): `store.mjs` 2,818 (1,370 code) plus about 42 of dispatch, `airun.mjs` 234 (101), `bio-checks.mjs` 218 (85), `schema.mjs` 23 (13). Under 4,000 of code. Measured 4,010 at T28's merge (K1328). After N529's split, about 2,940 (`case-disclosures` about 1,210). Measured 4,139 after T41-43 (N839); after the account's split, about 3,700 (`case-account` about 550). Measured 4,132 with comments on T46 (N908; K617's mark as measured with comments, M-T45-6); after `case-inputs`' split, about 3,020 (`case-inputs` about 1,265; K2982).

## Satisfies (moved from the requirements file)

- DEC-101 (1)(2) and `BIO_Publication_v0_1.md` §5A (R14, R38; the drafts `case-inputs` R6, T47); DEC-103 and `BIO_Declared_Bias_v0_1.md`, "RULED 2026-10-01 by Bob (DEC-103)" (R14, R40); K1019.
- DEC-112 response 4 (3)–(5), as restored by DEC-119; `BIO_Publication_v0_1.md` §5C ("Everything a conclusion rests on must be presentable"; "Off-the-record sources", restored 2026-10-02) (R14, R34, R55; `case-disclosures` R4–R11; K1275).
- DEC-96 item 4 (R53, R55; `case-disclosures` R12–R14; N522, K1273).
- `docs/architecture/BIO_Publication_v0_1.md` §3 rules 4, 12, 13, 15, 16, 18 (preparing the case, its statement, its citations), §6A (the acknowledgements beside the review copy).
- `docs/architecture/BIO_Declared_Bias_v0_1.md` (the manifest travels with publication; the acknowledgement authored at export).
- `docs/development/INVESTIGATIVE-SESSION.md` §7.1 items 4, 7, 9 (the project's conclusion a case records).
- DEC-147 (2), (4) (a signed edition waits, not public, until its time, cancel or move; N681, K1833): R58 (R59's half `case-inputs` R4, T47).
- DEC-180 (3), (4) (Bob, K2108): R14, R34's Photos step (N757, K2206). F1's rule for digests (K1874; N761, K2129, K2175): `case-inputs` R5 (was R62, T47).
- DEC-20, DEC-31, DEC-44, DEC-72; D-442, REC-96, REC-188, REC-212, REC-217, REC-219.
- `BIO_Action_v0_2.md` §3 (Success record) and §4 rules 8, 15, 17 (K2780; Actions D4, D5, D6a, D6c, D13, D22; T45, N893): R34's open requests, R57's published record of actions, R65, R72, R74 (R70 and R71's services `case-inputs` R8, R9, T47).
- N364 (R14's blocks, R32's step, R34; `case-disclosures` R2–R4, R16): DEC-80 item 3 (the ceremony, REC-15); DEC-81 items 1 and 3 (each document's grade and co-attestation, the self-attested acknowledgement); DEC-78 item 5 (a source stated only as consented or already public); Bob's rulings K509 (3), (4).
- N345 (R14's `/5`, R32, R33; `case-disclosures` R1): DEC-76 item 4; DEC-84 items 11–13; `BIO_Publication_v0_1.md` §3 rule 16 (what the case states about itself); DEC-85 (the highlight, and the ceremony told before the act); `CONTRADICTION-PRESENT-RESOLVE-DESIGN.md` §10.

### Open for Bob

None: answered by Bob 2026-09-26 (K102).

### Decided by BOB (for rulings)

1. `searchedSection` and `SEARCHED_LEVEL_OUTCOMES` (airun.mjs 1405–1638) move into this module's paths (K82 (5), K94); nothing in `ai-runs` calls them, so its next job deletes them from `airun.mjs` and keeps no copy (a job writes only its own paths). The `SEARCHED_SUBJECT_SOURCES` re-export there points at `ratification` until then (`case-catalogue`'s since K1824, re-exported by `ratification`).
2. `SEARCHED_SUBJECT_MAX`, `COMPLETENESS_MAX` and `MEMBER_ROLES` are this module's.
3. C-44.1, C-44.3–C-44.5 are this module's; C-44.2 is `publication`'s (its raiser, `#resolveOneCase`, is there).
4. `statement_acknowledgements` is this module's table; every other table it writes is `publication`'s, through its R21. (T47; N908; K2982) It moved, with `what_changed_drafts`, `carried_outcomes` and `carried_outcome_withdrawals`, to `case-inputs` (its R11): this module holds no table, and writes `publication`'s through its R21 only.
5. `from`: `legacy-store`, `legacy-checks` (nothing moves from `index.mjs`: `op=publish` and `op=statementack` have only routing and stamps there). Uses as above; not `promotion`, `connections` or `retrieval`. (`promotion` reversed at T28: K1268, BOB's decision 10; dropped again at N529, its use moving with R43 to `case-disclosures`.)
6. N529 (K1333): `case-disclosures` sits directly before this module. R32, R34 and R53 stay here, because they run `#authority`, `#judgeMembers` and `#publishCase`. R12 moves with the C-120 family (D1). The renderers are moved, not copied.
7. N839 (K2608): `case-account` sits directly before this module, after `case-disclosures`, since `publishCase` calls it (P4). It takes R64, R66 and R63's shape and judgment; R63's `publishCase` half, R65, R67 and R68 stay here, because they run inside `#publishCase` and `publishPreflight`, and R69 states the order. Three pass-throughs stand until T43 (N850): a full copy would declare `account_drafts` and `account_acceptances` twice and lose this module's purge declarations.

### Old ids (publication's draft → this file)

R1–R21 → R1–R21, unchanged; R52 → R22; R56 → R23; R51 → R24 (copy); R53 → R25 (its authorship half); R54's writer, bar-axis, bias-manifest and citation arms → R26; R55 → R27; R58's `statement_acknowledgements` → R28; R60's share → R29; R61 → R30. Open for Bob 1 → 1.

N529 (K1333): R31, R35, R36, R37, R43–R52, R54 → `case-disclosures` R1–R15; R12 → its R16; R33 copied as its R17; R29's C-120 share → its R22. New: R55.

N839 (K2608): R64 → `case-account` R1–R4; R66 → its R7; R63's shape and judgment → its R5, R6; R28's share (the two account tables) → its R8. New: R69.

N908 (K2982): R19 → `case-inputs` R1; R20 → its R2; R21 → its R3; R59 → its R4; R62 → its R5; R39 → its R6; R70 → its R8; R71 → its R9 (its clauses inside `publishCase` → R74 here); R73 → its R10; R28 → its R11; R29's C-82 and C-136.3–.8 share → its R12; R25, R27, R30 copied as its R13–R15. New: R74, R75 (N683).
