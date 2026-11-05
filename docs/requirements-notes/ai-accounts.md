# ai-accounts — requirements notes

Text moved word for word out of `build/requirements/ai-accounts.md` on 5 Nov 2026 (job ai-accounts, attempt 4), so that the requirements file holds requirements. No requirement lives here: every **R<n>** and **F<n>** line and its mark stayed in the requirements file, and `bio-plane/test/m/ai-accounts/requirements-ids.test.mjs` checks that against the start commit 4da7a52d.

## For BOB: moving text out cannot bring the file under the cap

The requirements file was 84,919 bytes against the cap of 70,000. Its R and F lines alone, kept word for word as the START requires, come to **72,661 bytes**, over the cap before any heading. With everything that is not a requirement moved here the file is still over the cap (the requirements-ids test records the size).

**Two ways under the cap, BOB's to choose:**

- **(a) Move the closed lines out (about 4,400 bytes; the cheaper one).** The met found marks F1, F2 and F4 (about 3,000 bytes) and the retired R8, R12, R13, R18 and R35 (about 1,400 bytes) move here verbatim, and the coverage check is told that a met F line and a retired R line may live in the notes. That leaves the file at about 69,000 bytes, with little room for the next round's lines.
- **(b) Split by copy, as op-grades split into op-grades-folds.** A new module file `ai-accounts-lists` takes the lists, opt-in and hop block (R41, R46, R49, R50, R70, R72, R77; about 13,000 bytes), each line moved as `- **R<n>** (moved from ai-accounts:R<m>) …`, and this file keeps `- **R<m>** *(retired: moved to ai-accounts-lists:R<n>)*`. It needs a module entry and its job, so it is BOB's act.

**BOB's ruling (5 Nov 08:23): (b).** PR 463 added `ai-accounts-lists` with the seven lines verbatim; the requirements file keeps one line where they stood and is now under the cap (`requirements-ids.test.mjs` rebuilds the start commit's lines from both files).

## Change history (the requirements file's former Status line)

**Status** · New in T48 (T48-10; N996; `build/extraction/credentials-split.md`, reviewed and adopted, K3101; placed by the opening act, K3196): split by copy from `credentials` for size (K617, K624), layer 2, directly after `project-roster` and before `credentials`. R1–R23 are `credentials` R22–R25, R33–R37, R54, R56, R58, R59, R55, R60–R62, R43, R70, R51, R52, R57 and R64, copied whole as they stood at T48's START, meaning unchanged, each marked "was" and retired in `credentials` with a pointer; "this module" in them is ai-accounts, and their cross-references are re-pointed to the ids here (a reference to an id that stays is written `credentials` R<n>). R24–R33 are the split's seams and its shares of credentials' invariants (map §4). R34 is T48's one addition on top of the copy (N1041; N1026's series moved to `ai-use`, K3198). Every requirement not yet met (T48). Last changed T50 (T50-4: R26 amended, a refused sign-in tells its listeners; N1060, K3218, K3224); that line marked not yet met (T50). Last changed T51 (R35, R36 met; R37 new, `accountusesset` declared; K4168, K4206, K4214). Last changed T53 (BOB #325, from AI-DESIGN's READY drafts `build/plan/lane-ai-design/draft-ai-accounts.md` (AD-n, K5457, K5475–K5479), `draft-ai-accounts-dec465.md` (DEC-465, DEC-466, DEC-471, K5478, K5486, K5493) and `build/plan/beta/planning/lines-K5501-role-change.md`): the account model of R40 on; R1–R3, R5–R7, R9–R11, R14–R17, R19, R25–R28, R31, R36–R38 amended, R8, R12, R13, R18, R35 retired, R40–R77 new (R63, R64 under Invariants); the Terms of the first section and R4 are read through R40; every changed line marked not yet met (T53). `uses` gains `ai-catalogue` (layer 2, directly before this module).

## Size

**Size (P6).** About 2,085 lines of its own code (map §0), measured at its START (M-T48-1, K617, K2513).

## The group's API key: the section's former introduction

As DEC-172 restates K1755's choice (K1957): whether the group pays (an API key at the group level); a member may always connect their own account (R1–R4); and, a separate choice, whether the group keeps its material away from every assistant (R20).

## The T40 codes note (formerly under R13)

Codes (T40; K231): `PROJECT_NOT_SOLE_MEMBER` and `SIGNIN_NOT_CONNECTED` (R10), `SWITCH_VALUE_INVALID` (R14), `AI_USE_SWITCHED_OFF` (R11), `PROJECT_AI_KEPT_AWAY` (R22) and `PROJECT_KEY_NOTICE_DUE` (R12) are rows of C-29, each the next free number at the job's START, with its test; promotion's T40-4 stamps them (credentials merges before promotion). (T41; DEC-188 (7)) Each of the six reads its member-facing sentence by key from `words.json`, as R10–R12, R14 and R22 name it, never a copy of the sentence; promotion's T41-6 stamps the rows whose translation changes. (T53) `PROJECT_NOT_SOLE_MEMBER`, `SIGNIN_NOT_CONNECTED` and `PROJECT_KEY_NOTICE_DUE` leave with R10, R12 and R13; R58 lists the rows that arrive.

## Satisfies (moved from the requirements file)

- `credentials`' Satisfies for its R22–R25, R33–R37, R43, R51, R52, R54–R62, R64 and R70: `BIO_Capability_Ladders_v0_1.md` §2 QUESTIONS and "Cross-cutting rulings" (the member's own account; the suggestion and standing-question switches), `BIO_Assistant_and_AI_Roles_v0_1.md` §6 and ASSISTANT-PILOT as K1503 amended them; K1449–K1503, K1755–K1761, K1798, K1819, K1957; DEC-156, DEC-172, DEC-188; INVESTIGATION-DESIGN D34, D37, D38, D39; K2350–K2404, K2425, K2442, K2480, K3060, K3061, K3068, K3076.
- K3148 (R34).
- (T53) AIR1, AIR3, AIR10, AIR17, AIR25, AIR27, AIR31, AIR32, AIR34, AIR39, AIR41–AIR45; AD14, AD21, AD27, AD28, AD30, AD32–AD37, AD39; BR13–BR21; K1755, K2352, K2353, K3061 (`build/plan/lane-ai-design/RULINGS-FOR-BOB.md` §2): R40–R68. DEC-465 (the sealed hold, the owner opt-in, a member's list order, "whose checks apply"), DEC-466 U3 and U5 (the readiness summary, the refusal naming who grants the gateway), DEC-471 and K5478 (the credits stop's clear act and Queue item), K5493 (a dated terms change is a notice), AIR32, AIR44, AD37, BR13, BR18: R49, R54, R68–R76. K5501 and K5502 (a member who can no longer place a shared account loses her placements): R27, R77.
- (T50) N1060 (K3218, K3224: a refusal ends her run credentials): R26.

## Suggestions that state no requirement (moved from the requirements file)

- **The copy (K624; split map §2, §6).** The code is copied from `src/credentials/` as the map's §2 lists it, its line numbers re-taken on `tranche/T48` (K3101), with the eleven tables' DDL and additive columns, `AI_WORDS` and the moved C-29 rows as `AI_ACCOUNT_CHECKS`. In the copy no refusal text, code, number or translation changes, and the seal's salt, info and AAD are byte-identical. `#retiredReferences`' grant `DELETE` is dropped (doubt 5; a standing grant lives 900 seconds, so none from T38 survives); its reference half stays. `#carryHistory` stays a one-off at `migrate`. The seal key may be cached per owner.
- **Tests (split map §6).** A new `fixture.mjs` builds real membership, a stub record-core and `node:sqlite`, with `membership.registerClaimed` given a test fact; it never builds credentials, which is later. credentials' account tests move here with their arms (each keeping its old id under its new number, K874), with new arms for R24–R28 and R34.
- **The seal (from `credentials`' T33-20 note).** A test shows a sentinel secret in no answer, log, error or export; for R24, a sentinel sealed and opened, and the wrong owner does not open it.
- **T41 (from `credentials`' T41-5 note).** R16's records may be one table keyed by `owner`, declared under R28 (exempt from purge, a project's rows deleted with its project). The retired routes `accountswitchset` and `groupswitchset` (R4, R9) are not in this module's ops map; their callers re-point to `accountusesset` in their own jobs (`setup-words`' act words, `wizard-scripts`' screen registry and library, `op-declarations`). Outside this module, `answers`' and `agent-worker`'s standing path and `question-explorer` R3 admit a sign-in principal whose `standing` or `explore` switch is on (N796, K2425; their entries).
- **T47's disclosure (from `credentials`' T47-9 note).** R23's registration is made by `instance-setup` or the plane's composition root in their own jobs; until then R1's `DISCLOSURE_DUE` refusal is not asked in the composed plane. `DISCLOSURE_DUE`'s code and member-facing sentence are unchanged by the move (C-29.40).
- **The thirty-day use series (N1026)** is `ai-use`'s (T48-29), not this module's: the counts and limits are `ai-use`'s and it is later in the order (K3198).
- **Callers' obligations.** `ai-runs` reads R9's `groupKeySwitches`. A caller across the store's boundary that gets no answer from `aiKeptAway` answers a silence, as `admission` R6 answers a store that does not answer (502 `STORE_DID_NOT_ANSWER`), never `AI_KEPT_AWAY` without its row (N1041; `wizard-scripts`' `writingHelp`). Until each user re-points (split map §5), it reaches these services through `credentials`' delegates (`credentials` R72).
