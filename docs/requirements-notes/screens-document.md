# screens-document — requirements notes

Text moved out of `build/requirements/screens-document.md` toward the requirements cap (70,000 bytes), unchanged in wording (job screens-document, T53). No requirement lives here: every **R<n>** line, its sub-bullets and its mark stay in the requirements file. `bio-plane/test/m/screens-document/requirements-ids.test.mjs` asserts the move changed no id and no mark.

## The requirements file's former Status line

**Status** · New in T53 (K5564, plan "Before R1" (9); K617, K624): a new module, layer 11 after `screens-inquiry`, split from `screens-inquiry` by copy: it takes the Document page (the registry screen `document`; `bio-plane/src/screens-inquiry/document.mjs` and its states) with its requirement lines and its tests. R1–R47 are `screens-inquiry`'s `document` requirements moved here, renumbered in the order of their old ids (monotone), meaning unchanged, each carrying "(was screens-inquiry R<old>; T53, K5564)"; `screens-inquiry` marks each of its own "moved to screens-document R<k>" and never reuses the id. R48–R57 are the requirements `screens-inquiry` states over `document` and its other screens (the shell's rules for every grade, the common line, the subject guard, words by key, the page's grade read, the themes, a project one is not in, state chips, pages drawn from one, the walker's keys), copied and reworded for `document`; where a line was cut, `screens-inquiry` keeps the original without the Document part and says where the part went. R58 onward are new in T53 (the plan's entries for this module, `planning/plan-T53-draft.md` and its detail files). The split map (old id → new id) is at the end (K3946's form). A bare `R<n>` in a moved line that names no module is a `screens-inquiry` id: the map gives its place here when the line moved. The unmet T53 lines are marked, and so are R1–R57 (T53; K5564, K5571): the moved and copied lines are met only when this module's job has moved the Document page's code from `screens-inquiry` and its tests with it (see Suggestions), so the coverage check counts them until then and clears each as its test is moved and green.

## Satisfies

- Registry screen `document` (DEC-139 (1), (7)); DEC-190 (R1); (T51) K3807, K3812, K3813, K3815; DEC-330 (A26, A27, A30, A31, A34), DEC-335, DEC-336 (5), DEC-337 (R8–R12); K3869, K4089, K4103, K4104 (R13–R16); the moved lines cite their own sources.
- (T53) K5564 (the split); DEC-459, K5518, K5519, K5544, K5545 (R58); DEC-464, K5524, K5525, K5549 (R59); N1260, DEC-410, DEC-447 (R60); DEC-454, DEC-467, DEC-473 (R61–R63); N1272, K5445, K5495, K5496, DEC-476, DEC-478 (R64–R68); DEC-474 (R69); DEC-463, K5516 (R70); K4354, P24 (R71); DEC-479 (R72); JOURNEYS R-18, R-30, R-40 (R73–R75).

## Suggestions

- (T51) `document`'s "Earlier revisions" compare is the browser's: the two `bundle.md` texts are read from the `op=image` answer the page already holds, so the compare adds no read.
- (T53) The tests of the Document page move with it from `bio-plane/test/m/screens-inquiry/` (the files named for `document`: `document.test.mjs`, `fr28-document.test.mjs`, `t51-document.test.mjs` and the others whose names carry `document`, with the tests that name only Document ids): the split job reads each test for the ids it names and moves the ones that name only Document ids (BOB's list at the job's START).

## Split map (K5564)

**Moved, `screens-inquiry` old → `screens-document` new** (monotone; 47 ids, meaning unchanged; `screens-inquiry` marks each "moved to screens-document R<k>" and never reuses the id): R3 → R1, R15 → R2, R22 → R3, R32 → R4, R49 → R5, R55 → R6, R61 → R7, R65 → R8, R66 → R9, R67 → R10, R68 → R11, R69 → R12, R80 → R13, R81 → R14, R82 → R15, R83 → R16, R84 → R17, R85 → R18, R86 → R19, R92 → R20, R93 → R21, R95 → R22, R96 → R23, R97 → R24, R98 → R25, R99 → R26, R100 → R27, R108 → R28, R111 → R29, R112 → R30, R113 → R31, R118 → R32, R123 → R33, R124 → R34, R125 → R35, R126 → R36, R127 → R37, R129 → R38, R130 → R39, R131 → R40, R132 → R41, R133 → R42, R134 → R43, R135 → R44, R136 → R45, R137 → R46, R138 → R47.

**Copied and reworded for `document`** (the original stays in `screens-inquiry`, which says where a cut part went): R5 → R48, R20 → R49, R21 → R50, R44 → R51, R54 (its document sentence) → R52, R56 (its document part) → R53, R60 → R54, R70 → R55, R78 (its document part) → R56, R139 (its Document part) → R57.

**New in T53** (no old id): R58–R75.

**Moved to `screens-document-beta`** (BOB's split, PR 474, 5 Nov 2026; verbatim, same numbers): R58–R75, the group "T53: the Document page in the beta". This file keeps R1–R57.

## Split proposal (job screens-document, T53; BOB's to rule)

After this move the requirements file is 75,948 bytes, still over the cap of 70,000: its R1–R75 lines with their sub-bullets (R4, R8, R12, R49), kept verbatim, come to 73,293 bytes on their own, so no consolidation brings it under without changing requirement text. Proposed split along the file's own groups, verbatim and under the same numbers (as `op-grades` → `op-grades-folds`): R1–R57 (the moved lines, 46,849 bytes, and the copied lines, 9,801 bytes) stay in `screens-document`, about 59,000 bytes with its headings; R58–R75 ("T53: the Document page in the beta", 16,643 bytes) go to a new module `screens-document-beta`, about 18,000 bytes with its headings. Both sides stay under the cap with room.
