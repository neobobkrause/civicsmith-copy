# screens-publish: requirements notes

Moved word for word from `build/requirements/screens-publish.md` at the start commit 48566a017fc (job screens-publish, attempt 1, 5 Nov 2026). None of it is a requirement.

## Status history

**Status** · New in T47 (T47-63; K657, K1043, K569, K3027 doubt 2): a module built fresh, layer 11 after `screens-investigate` and before `screens-action` (N897 (1); N788's Photos step, N757's marking on screen, N683's "Publish at…"; DEC-78, DEC-96, DEC-100, DEC-112, DEC-116, DEC-147, DEC-180, DEC-181, DEC-183). Drafted in `build/plan/draft-T47-interface.md` §2.3, worded here by BOB (P5). No ids move. Not yet met (T47). Last changed T48 (T48-75: R18 new, amending R2 and R17, the reader's link's end date, N1038, `review` R34; R19 new, amending R6, the published page's evidence and complete edition, K3190 census P1, DEC-228; K3195); marked not yet met (T48). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R20 new, the common line); marked not yet met (T48). Last changed T49 (T49-27: R22, R23 new; K3334); marked not yet met (T49). Last changed T50 (T50-34: R25–R30 new; R31 new, a project's first case, R32 new, Publish with nothing prepared, R33 new, the public page's "Corrections and orders" (DEC-310 (2), (3), (6); K3683); `imported` draws its list, an imported case's stake, the review link's end in the team's zone, plain ceremony words, the check's third answer, the signing confirmation's explanation; N1087, N933, N1081, N1181, N1144; DEC-263, DEC-275, DEC-299, DEC-304); marked not yet met (T50). Last changed T50 (T50-34: R34 new, DEC-313's words and the public docket, and R35 new, the case editor's account, already in force (K3703, K3707); R26–R29, R34, R35 amended to the drawings DEC-322, DEC-323, DEC-325 and DEC-326 give their held states; R36 new, `publishedcase` is read asynchronously (K3725, K3731); K3726, K3728, K3730); marked not yet met (T50). Last changed T51 (T51-121, BOB #210's L11 fold: R37 one finding's page (DEC-330 A76), R38 "Read it at a minimum strength" (A77), R39 printing (A79), R40 a review copy saved as a stamped file (A81), R41 the first share reads the zone from the copy (N1229; R27's fallback to `publishpreflight` retired); K3807, K3813, K3853; DEC-330; R37 to R39 worded to DEC-335 and DEC-336, K3897: document legs "Named only", the held-for-you keys deleted, the filter notice and print footer keyed with fills); marked not yet met (T51). Last changed T51 (FR-30, K4165, K4168, K4192, K4194, K4197: R44–R68 new, the controls DEC-374 to DEC-378 and DEC-382 draw on the ceremony, docket, case editor, published page, imported page and doorbell, and the live walk's L14–L19, DEC-384's items; written by the job, B9); marked not yet met (T51). Last changed T53 (DEC-463: R82 new, the docket picker; DEC-461, DEC-474: R83, R84 new, ungraded passages at signing and on the edition; DEC-479: R85, R86 new, the Inbox view and the doorbell receipt; DEC-480: R87 new, emails in a case; JOURNEYS: R88–R106 new, K5558–K5560); marked not yet met (T53).

## Size

**Size (P6).** Estimated 2,600–3,200 lines with comments, its own keyed sentences included, measured at its START (M-T47-1, K617). (T51) 1,948 lines of source today (`bio-plane/src/screens-publish/`); R37–R41 add roughly 400–600, so the module stays under ~4,000, and START re-measures it (M-T51-1).

## Satisfies

- Registry screens `case-editor`, `review-copy`, `ceremony`, `published`, `imported`, `docket`, `doorbell` (`docs/development/ux-substrate/screens/registry.json` at `a0fab7abf0`; DEC-139); their drawings in `mock-screens.js` at that commit; N897 (1).
- (T48) DEC-228 (P1, drawn): R19. N1038, DEC-100: R18.
- (T51) K3807, K3813; DEC-330 (A76, A77, A79, A81); DEC-335, DEC-336 (4) (R37–R39, R41); census-legacy-ui rows A76, A77, A79, A81; N1229, K3765: R37–R41.
- DEC-100 (R2, R8); DEC-147 (R5, R6), N683 (R5); DEC-180, DEC-183, N757, N788 (R4); DEC-181 (R5); DEC-112, DEC-96 (R6, R7); DEC-116 (R8); DEC-78 (R9); DEC-88 (R1's acknowledgement reason).
- (T53) DEC-463, K5516 (R82; A7). DEC-461, K5548, DEC-474 (4), (5), DEC-472 (8) (R83, R84, R102). DEC-479, DEC-461 (R85, R86). DEC-480, K5534 (R87). JOURNEYS R-94 to R-124; K5558 (J5), K5559 (J6), K5560 (J7), K5474 (R88–R106).

## Suggestions

- **Owed, before some acts can be drawn** (`draft-T47-interface.md` §5): `statementack`, `reviewcomment`, `publishpreflight` and `publishtensions` are not in `SESSION_OPS.member`, so `interface-shell` R12 draws none of them for a member until `op-declarations` places them there (BOB's); the signer's confirmation of no undeclared tie (R5) is taken by no requirement today; and signing in the browser (R5, R8) has no in-shell signer: the signing page (`/sign`, `signatures` R31) that once signed `bio-ratify` statements with the member's browser-held key is deleted (`control-plane` R109), so the in-browser signer and the hand-over of its signature to the screen are BOB's to fix at this job's START.
- (T51) **Gaps for BOB at the fold** (none is a requirement of this module): (1) DEC-335 gave fills to the finding page's, the filter notice's and the print footer's keys (`{n}`, `{total}`, `{hidden}`, `{leg}`, `{team}`, `{member}`, `{date}`, `{fingerprint}`); the sentences that name a sample document (`screen.published.the.march.2024.rent.schedule`, `…a.letter.from.the.city`, `…a.question.about.whether.the`, `…cut.against.by.a.letter`, `…council.minutes.12.january.2024`) still hold a sample title or place; (2) the design's new review-copy family is spelled `screen.review_copy.*` (underscore) while the screen id and the held keys are `review-copy`; (3) no drawing shows how a finding's page is addressed (the mock switches state in the page), so the address is the job's (R37); (4) the drawing's print footer names the signer and the key's fingerprint, which `publishedcase` states only per finding (`attestor`) and in the case document's signature; the old page's container and rendering hashes are not drawn; (6) `icons.svg` now holds `i-document` (the finding's sources, R37), DEC-335 (4); (5) a finding whose grade is not stated, under a reader's minimum (R38): the drawing has no sentence for it, so it is counted among those not shown; (7) the legs: DEC-336 (4) confirms that a document leg is "Named only" and a leg on another team's published finding is "Served with its own published case"; a named-only leg's answer holds no words for its target, and the sentences for "Leg n", "supports it", "cuts against it", "Rests on:" and "Cut against by:" have no generic key; (8) the minimum choices' words ("No minimum", "C or better", "B or better", "A only"), "Save the file", "Its fingerprint" and "Its author" have no key in `words.json`, and the finding page's not-available sentences (R37) have none either.
- The screens' own sentences are held in `SCREEN_WORDS` (`screen.<id>.<part>`) from the mockups' English at `a0fab7abf0` until the design stream adopts them (DEC-198 (6)).

## Split proposal (job screens-publish, attempt 1, 5 Nov 2026), for BOB

**Why moving text out can't reach the cap.** The cap is 70,000 bytes. `build/requirements/screens-publish.md` was 100,538 bytes at the start commit (48566a017fc). Its 106 requirement lines (R1–R106, no F lines), kept word for word as the START requires, come to **81,719 bytes on their own**. The Status history, Size, Satisfies and Suggestions are moved here word for word, which brings the file to 93,956 bytes. The Uses, Invariants, the two "Rules for the block" paragraphs and the indented specs under R20, R22 and R37 are requirement text, so they stay. The file has to split.

**Proposed split, by screen: the public frame.** `published`, the public docket (`docket-public`) and `doorbell` are drawn in the public frame with no session (`interface-shell` R30). Their code is already in its own files: `published.mjs`, `published-pages.mjs`, `published-parts.mjs`, `docket-public.mjs` and `doorbell.mjs` (67,186 bytes of the module's 320,766).

- **New module `screens-public`** (BOB names it), layer 11, after `screens-publish`. It takes **R6, R9, R19, R21, R22, R29, R33, R36, R37, R38, R39, R49, R54, R56, R67, R76, R84, R86, R100, R101, R102, R104**, with the specs indented under R22 and R37. They are renumbered R1–R22 in the order of their old ids, verbatim with their marks, and each line says "was screens-publish R<n>". That is **26,171 bytes** of requirement text. Of these, R84, R100, R101, R102 and R104 are marked `(not yet met: T53)`.
- **What stays in `screens-publish`:** 67,785 bytes, with its headings, Uses and Invariants. That is under the cap, but only by 2.2 KB.
- **More room (optional):** `imported` (R7, R25, R26, R55, R58, R59, R103: 4,600 bytes) could go with them. It is a member screen, not a public one, so I would leave it unless the margin matters.
- **What it costs:** `screens-public`'s job moves those five source files, their keys rows in `keys.mjs`, and the tests that draw those screens (`public.test.mjs`, `print.test.mjs`, `finding.test.mjs`, `g54-page.test.mjs`, and parts of `fr30.test.mjs`, `t50.test.mjs`, `t51.test.mjs` and `t53.test.mjs`). It also needs a `build/modules.json` row with the same `uses` as `screens-publish`, trimmed to `public-read`, `doorbell`, `interface-shell`, `interface-assets`, `setup-words`, `op-declarations` and `test-support`, plus the `wizard-scripts` registry rows that name those screens.

**Other choices, BOB's or Bob's.** (a) Let this file stay over the cap. (b) Move each line's opening source bracket (the "(T53; JOURNEYS; …)" provenance) into these notes. That is not word for word, so I did not do it.

## Sources of each requirement (moved from the requirements file, attempt 4)

Job screens-publish, attempt 4, 7 Nov 2026. Each line holds the opening bracket that stood after the id, verbatim; "in the text:" gives the dated or sourced brackets that stood inside the requirement (a `*(T51, K4253: …)*` note's obligation stays in the requirement; only its source moved here).

- R1: (none); in the text: (T51 fix round 2; K4320)
- R2: (none); in the text: (K3137; journey 21); (T51 fix round 2; K4320)
- R3: (none)
- R4: (none); in the text: (N757, N788; DEC-180, DEC-183)
- R5: (K1490, K3041; `case-authoring` R76; DEC-208 (2)); in the text: "amended"
- R6: (none); in the text: (T51 fix round 2; K4320); (K5148; WALK-FINAL-10B C5, C6)
- R7: (none)
- R8: (none); in the text: *(T51, K4253: …)*; (T51 K4260); (T51 fix round 6, G20; K4611)
- R9: (none); in the text: (fix round 4, C28; K4429; `doorbell` R11)
- R10: (none)
- R12: (DEC-207 (2), (3))
- R13: (K3080; DEC-207 (4), DEC-208 (1); `ratification` R52); in the text: (T51 fix round 2; K4320); (T51 fix round 2; K4331); (T51 fix round 5, C48/E4; K4536); (T51 fix round 6, G29; K4609, K4611)
- R14: (DEC-207 (5))
- R15: (DEC-207 (6)–(8), DEC-210)
- R16: (DEC-116; R8)
- R17: (DEC-201 (8))
- R18: (T48; N1038; DEC-100; K3147; `review` R34; amends R2, R17)
- R19: (T48; K3190, census P1; DEC-228; `public-read` R3, R5); in the text: K3295; (DEC-228: to draw)
- R20: (T48; K3250, K3254 (1), (5); walk C1, C4, C5; DEC-219 (3); K3052; amends R10); in the text: (K3254 (1)); (DEC-219 (3) applied to every screen is BOB's reading of K3052, K3254 (5); the designed screen-level empty states are kept.)
- R21: (T48; K3240, K3254, K3279; the 0.84.0 walk, signed out; amends R1)
- R22: (T49; N1094; DEC-240 (P1); `public-read` R1, R3; amends R6, R19)
- R23: (T49; N1094; DEC-240 (C2); `case-inputs` R1, R5; `review` R15, R28; amends R17)
- R24: (T49; K3366; DEC-257, DEC-258; `setup-words` R11–R13; amends every requirement here that quotes a member-facing sentence)
- R25: (T50; N1087, N1090; K3302; DEC-236 (B204 (2)); `case-import` R26; amends R7)
- R26: (T50; N933; K3230; DEC-323; K3726, K3729; `case-import` R25; DEC-304 (4); amends R7)
- R27: (T50; N1081; K3295; SCREENS-PUBLISH #2 J2 (2); `review` R35; DEC-299 (2); DEC-304 (3); DEC-323; K3725, K3726; amends R2, R17, R18); in the text: (DEC-323)
- R28: (T50; N1181; V4 B-5, B-6; K3560; DEC-299 (3); DEC-323, DEC-325; K3726, K3728; `case-checker` R26; amends R1, R3); in the text: ("Put these right before you sign", DEC-323); (DEC-325)
- R29: (T50; U10; DEC-263 (3); DEC-240 (P1); DEC-323; K3726; amends R22)
- R30: (T50; N1144; K3412; DEC-275; amends R3, R13); in the text: (case-disclosures R33; DEC-265; K4073)
- R31: (T50; DEC-310 (2); K3683; `review` R36; `interface-shell` R80; amends R1)
- R32: (T50; DEC-310 (3); K3683; amends R3)
- R33: (T50; DEC-310 (6); K3683; `public-read` R37; `interface-shell` R81; amends R6)
- R34: (T50; DEC-313 (2), (3), (6); DEC-322 (2); DEC-326; K3703, K3724, K3730; `public-read` R21, R37; `interface-shell` R30, R81; amends R31, R33); in the text: (DEC-326)
- R35: (T50; DEC-315; DEC-326; K3707, K3730; `case-account` R1–R4, R6; `review` R36; amends R1); in the text: (DEC-326)
- R36: (T50; K3725, K3731; `public-read` R37; amends R6, R19, R22, R33)
- R37: (T51-121; DEC-330 A76; DEC-335, DEC-336 (4), K3897, K3898; census A76; `public-read` R39; K3853; amends R6, R19, R36); in the text: (T51 fix round 2; K4320); DEC-336 (4)
- R38: (T51-121; DEC-330 A77; DEC-335, K3897, K3898; census A77; `op-declarations` R76; `affordances` R69; amends R6, R36)
- R39: (T51-121; DEC-330 A79; DEC-335, K3897, K3898; census A79; `interface-shell` R99, R100; `interface-assets` R10; amends R6)
- R40: (T51-121; DEC-330 A81; census A81; `review` R11, R35; `public-read` R7; `control-plane` R20; `op-declarations` R76; amends R2, R17); in the text: K4073; (T51 fix round 2; K4320)
- R41: (T51-121; N1229, K3765; DEC-335 (3), K3897; `review` R35; amends R27)
- R42: (T51; N880; DEC-340, U366; K3935; `case-authoring` R34, R77; `case-inputs` R8, R10, R17, R19); in the text: (DEC-341; K4025, K4073); (T51 fix round 2; K4320)
- R43: (T51; N858 D10; DEC-340, U366; K3935; `docket` R30; `action-holds` R19)
- R44: (T51 FR-30; C2, C3; DEC-376 (C2); `review` R37, R38; `case-authoring` R78; amends R1, R3); in the text: *(T51, K4253: …)*; (K5148; WALK-FINAL-10A R90 (i))
- R45: (T51 FR-30; C4; amends R15)
- R46: (T51 FR-30; C5; DEC-377 (C5); amends R3)
- R47: (T51 FR-30; C7; DEC-376 (C7); `public-read` R3; `review` R38; amends R1, R6)
- R48: (T51 FR-30; C8; amends R1)
- R49: (T51 FR-30; C16; `doorbell` R11, R14; amends R9); in the text: *(T51, K4253: …)*
- R50: (T51 FR-30; C1; `case-authoring` R78; amends R3, R5)
- R51: (T51 FR-30; C6; DEC-377 (C6); amends R3); in the text: *(T51, K4253: …)*
- R52: (T51 FR-30; C9; DEC-374 (C9); `review` R39; amends R8)
- R53: (T51 FR-30; C53; DEC-376 (C53); amends R1)
- R54: (T51 FR-30; C10; DEC-376 (C10); amends R22)
- R55: (T51 FR-30; C51; DEC-374 (C51); `case-import` R7; amends R7)
- R56: (T51 FR-30; C17; DEC-375 (C17); `sources` R11; amends R9)
- R57: (T51 FR-30; C12; DEC-378 (C12); K4185; `case-inputs`; amends R1, R3, R6); in the text: *(T51, K4253: …)*
- R58: (T51 FR-30; C49; DEC-378 (C49); `case-import`; amends R7)
- R59: (T51 FR-30; C50; DEC-382; K4189; `citation` FR-35; amends R7); in the text: *(T51, K4253: …)*
- R60: (T51 FR-30; L14; K4194; amends R3, R17, R2)
- R61: (T51 FR-30; L15; K4194; `review` FR-19; amends R17)
- R62: (T51 FR-30; L19; K4194; `review`; amends R2)
- R63: (T51 FR-30; L14; DEC-384 (U417; K4197); amends R60)
- R64: (T51 FR-30; I-29, C1, B2; DEC-384; amends R1, R5)
- R65: (T51 FR-30; C4, G6; DEC-384; amends R62)
- R66: (T51 FR-30; L16, D1; DEC-384; amends R3)
- R67: (T51 FR-30; I-20; DEC-384; amends R49)
- R68: (T51 FR-30; H2; DEC-384; amends R3)
- R69: (T51 FR-30; K4245; `case-authoring` R82; amends R51)
- R70: (fix round 2, C48; amends R5, R30); in the text: (T51 fix round 2; K4320); (T51 fix round 5, E4; K4536)
- R71: (fix round 2, C50; amends R3); in the text: (T51 fix round 2; K4320); (T51 fix round 2; K4331)
- R72: (fix round 2, C51; amends R15, R45); in the text: (T51 fix round 2; K4320)
- R80: (fix round 4, C48/N6, C47; K4429; `case-authoring` R83, `public-read` R42)
- R82: (T53; DEC-463; interface-shell R138; amends R8)
- R83: (T53; DEC-461, K5548 (L23 = A); DEC-474 (4); `case-authoring` A5-R88)
- R84: (T53; DEC-461, K5548; DEC-474 (5); DEC-472 (8); `case-authoring` A5-R89, `ratification` A5-R63)
- R85: (T53; DEC-479 (45); after `doorbell`'s `inboxview`)
- R86: (T53; DEC-479 (25))
- R87: (T53; DEC-480; K5534; `case-disclosures` (DEC-480 mark, `mailnameshow`, `mailnamewithhold`)); in the text: DEC-408
- R88: (T53; JOURNEYS; changes R8; answers R-94, BLOCKS; Bob K5558 J5 option A: the project's owner files a correction, a withdrawal or a court order, from the docket page); in the text: (decided, K5558, J5 = A)
- R89: (T53; JOURNEYS; changes R8; answers R-95)
- R90: (T53; JOURNEYS; changes R6, R33; answers R-96; Bob K5559 J6 option A: each new edition is recorded on the docket automatically, with its "what changed" text)
- R91: (T53; JOURNEYS; changes R8; answers R-97)
- R92: (T53; JOURNEYS; changes R62; answers R-98)
- R93: (T53; JOURNEYS; changes R28, R60; answers R-100)
- R94: (T53; JOURNEYS; changes R3; answers R-102)
- R95: (T53; JOURNEYS; changes R71, R80; T52-78 (D-K9 screen half) carries the "Draft:" heading; answers R-103, new parts)
- R96: (T53; JOURNEYS; changes R10 of the module (the status line); T52-78 (D-K6, D-K7) covers the case editor; answers R-104, new parts)
- R97: (T53; JOURNEYS; changes R17; T52-78 (D-K14) carries the "ended" word; answers R-105, new part); in the text: (T52-78)
- R98: (T53; JOURNEYS; changes R17, R63; D-K15 is T52-78 and is not repeated; answers R-106, new part)
- R99: (T53; JOURNEYS; new; answers R-107; Bob K5560 J7 option B: an outside reader's acknowledgement is shown by name only if they tick that it may be); in the text: (decided, K5560, J7 = B: …)
- R100: (T53; JOURNEYS; changes R6, R76; public-read R41 holds the entry fields; answers R-108)
- R101: (T53; JOURNEYS; changes R22, R39; answers R-109)
- R102: (T53; JOURNEYS; new; answers R-110; DEC-472 (8))
- R103: (T53; JOURNEYS; changes R7; answers R-111)
- R104: (T53; JOURNEYS; new; neighbour R6, R9; answers R-122)
- R105: (T53; JOURNEYS; changes R3 of the editor and the ceremony; T52-78 (D-K3, D-K17) carries singular nouns and the ISO instant; answers R-123, new parts)
- R106: (T53; JOURNEYS; changes the editor's generic required-field sentence; answers R-124)
- R11: (K3079 (a)); in the text: "amended"
- R73: (T51 fix round 2, C49; DEC-394 (1), DEC-395; `review` R19; amends R1, R2, R3; K4331)
- R74: (fix round 3; K4398, C40; amends R51; `case-disclosures` R2, `case-authoring` R34)
- R75: (fix round 3; K4398, C46; amends R1, R3, R17, R61; `review` R41)
- R76: (fix round 3; K4398, C47; amends R6, R19, R37; `public-read` R41)
- R77: (fix round 3; K4398, C48, C50; amends R70, R71; `case-authoring` R83, `review` R19); in the text: (T51 fix round 5, E4; K4536)
- R78: (fix round 3; K4398, C51; amends R15, R72; interface-shell R40, R115)
- R79: (fix round 3; K4398, C94, C81, C14; amends R1, R2, R7, R8, R10; interface-shell R111, R113)
- R81: (T51 fix round 10; DEC-439, DEC-440, DEC-441; UX-DESIGN U481-U484; K5303)
- F1: (BOB 5 Nov, Bob's word via the coordinator 23:33; R19, R76)
- Screen headings: **review-copy** DEC-100; **ceremony** DEC-147, DEC-180, DEC-183; N683, N757, N788; **published** DEC-112, DEC-147 (5); **imported** DEC-96, DEC-112; **docket** DEC-116, DEC-100; **doorbell** DEC-78.
- Block headings: "#### T47's L11 fold (K3100)"; "#### T48 (T48-75)"; "**The design walk folded** (T48; WALK-084 #2; K3250, K3254)"; "#### T49 (T49-27)"; "#### T49: words by key (K3366, K3368; DEC-257, DEC-258)" (merged into T49); "#### T50 (T50-34)"; "#### T51 (T51-121): a finding's own page, a reader's minimum strength, printing, a review copy as a file (K3807, K3813; DEC-330 A76, A77, A79, A81; N1229)"; "#### T51 fix round (FR-30; K4165, K4168, K4192, K4194, K4197; DEC-374 to DEC-378, DEC-382, DEC-384)".
- Rules for the T51 block: DEC-335 gave the fills; K3366 (a key with a sample fact reported). The three acts DEC-330 left without an op.
- Uses: `setup-words.word`, `setup-words.hasWord` (K3366, K3368); T48: `publishedbytes`, its R5; R19; T50: `casedraft`'s `targets` and `casedrafts`' `concluded`, its R36; R31; (T51; R37–R41); the print rules `interface-assets` T51-112 carries; (T53; R85) `doorbell` `inboxview` (DEC-479; its line is owed in `doorbell`); (R83) `case-authoring` A5-R88; (R84) `public-read` A5-R89, A5-R63; (R87) `case-disclosures` (DEC-480).

## Notes moved out of requirement text (attempt 4)

Not requirements: remarks to BOB, seams and locators that stood inside requirement lines.

- R24: its key count, "286 keys at `fa3c8b7e8e`" (DEC-258).
- R27: "Seam today: `review-copy.mjs`:46-47, :102-105 read the zone from `publishpreflight`; `review-outside.mjs`:33 names UTC." (R41 since retired the `publishpreflight` read.)
- R33: "The line's heading is a key owed to UX-DESIGN (the drawing has \"Corrections and orders\"; `words.json` holds no key for it)" and "the kind in the design's words, owed to UX-DESIGN": both since given by R34's keys.
- R37: "BOB: check that router change"; the question and the finding's `tensions` "are drawn here, as the signed document states them, only if BOB confirms (reported: no other screen of this module draws a disclosed contradiction)"; "the plan entry names \"graph, parts\"; the graph is \"What rests on what\""; the drawing's sentences quoted in English for the legs ("Served with its own published case; its documents are not held here", "Named only").
- R38: the note's English ("No finding in this case is held and linked as strongly as you asked, so none is shown. Lower the minimum, or go back to the whole case."); the notice's title "A filtered view you built".
- R39: "The container hash and rendering hash the old page printed are not in the drawing and are not drawn (BOB: check)."; "the public frame draws no rail, tabs, dock or menu (`interface-shell` R30)" (why there is no print rule).
- R40: "`interface-assets` R10 holds no print rule at the design commit and adds none, so the file's own markup does it: reported"; "the design's family spells its prefix with an underscore".
- F1: the fault it answers: `published` (bio-plane/src/screens-publish/published.mjs:178, published-pages.mjs:53) takes an edition's evidence as `e.captures || e.materials` read as an array, while `publishedcase` answers `{materials:[...]}`, so the evidence section draws nothing; provider bio-plane/src/public-read/reads.mjs.
- R28 (1)'s English for the gate heading, "Put these right before you sign" (DEC-323).

## Consolidation (attempt 4)

The coordinator asked attempt 4 (7 Nov 2026) to consolidate the file under the cap, with no split (see "Split proposal" above). The file went from 94,751 to about 61,600 bytes. Every id stays, in order, with its marks; the provenance is above; wording is compressed; these folds state each current obligation once:

- R27's fallback to `publishpreflight` for the zone is gone (R41 retired it); R27 keeps the drawing of the end day and the no-zone refusal; R41 keeps where the zone comes from, and its null zone is refused "as R27".
- R18's "until <date>" (`cs.date`) drawing is R27's `screen.review-outside.until.zone`, and its "until you stop sharing" is R27's `screen.review-outside.untilstopped`; R18 keeps `until` as an instant, the lapsed grant, `REVIEW_BAD_UNTIL` and its test.
- R19's "The Verify any hash panel is not drawn" is dropped (R22 retired it); R22 no longer restates the retirement.
- R60's title wording is R63's; R60 keeps the three headings and the identity sentence as body text, its test and control R63's.
- R70, R71, R77, R80: the reload rule "the prepared edition's findings are read from the document's roster" (stated in both R70 and R77) is in R77 only; R77 states the order of sources (pre-flight `editions`, then `casedrafts`, then the older answer as R70/R71 read it); R71 keeps its `publishedcase` by `caseId` read as that fallback and its key; R80 keeps `editions.prepared` and `publishedAddress`; R70 keeps the prepare/sign split, the Ties button's place word and no gate beside a prepared edition.
- R45, R72, R78: R45 keeps the key-making drawn at once; R72 keeps reusing and registering a key the device holds; "load my key file" and "the held or loaded key is the one registered" are in R78 (R72 says "a key file loads as R78").
- R13: its five dated additions are stated as one obligation; "its evidence the document's `citations.rows`" (fix round 5) is narrowed by G29 to the rows carrying `bundle_sha`, so only the G29 form is kept.
- R8: "`writinghelp` on the summary waits on wizard-scripts' registry re-take" is dropped: the following K4260 sentence states it drawn while the assistant is reachable.
- R31 and R34: R31's "its sentence is a key owed to UX-DESIGN" for a project with no concluded question is R34's `screen.case-editor.noconcluded` fold, now stated in R31; R34 says "the no-concluded state is R31's".
- R33 and R34: R33's owed heading and owed kind words are R34's keys; R33 says "worded as R34".
- R6 and R37: R37's "(T51 fix round 2; K4320) As R6." is "words as R6".
- R20: "It covers `cs-note`, which becomes `mk-note`, and `cs-refusal` …" folded into its class-rename item (`cs-note` is in the renamed list).
- R9 and R49, R67, R86: the receipt's order is R86's; R49 and R67 point to it. R9's fix-round sentence (file name and media type) is merged into its `knock` sentence.
- R44: the K4253 role-label note and the K5148 What-changed / `casedocument` sentence are merged into the requirement.
- R49, R51, R57, R59: each K4253 note's keys and acts are merged into the requirement.
- R11, R5: the word "amended" after the id is dropped (it was provenance).
- F1: the fault's description and file locators moved to the notes above; the requirement keeps reading the evidence in the provider's stated shape, its test and control.
- Uses: the per-module op lists are dropped; each op is named in the requirement that reads or sends it, and the modules are listed.
- The "T49: words by key" block heading is merged into "T49".

## Open marks and their owners (attempt 4, 7 Nov 2026; BOB's ruling: lands partial)

None of these can be met inside this module's paths. The module reopens once each owner delivers.

- **ux lane (words owed: no key exists):** R97 "Stop sharing with {reader}"; R99 the acknowledged and comment-sent answers and the show-by-name tick; R101 "re-read at {time}" and why printing cannot be done ("Check it"'s too-short sentence is drawn); R103 what a case file looks like (each departure is listed); R104 a screen's own "Made with Civicsmith" (today `case-grammar.text.made`); R105; R106; R88 the field labels of the manager's kinds (correction, withdrawal, court order) and the "archive copy again" control (the kind list follows `docket`'s `kinds`); R91 a refused or declined entry's state.
- **interface-shell-t53:** R82 the kit's two-scope document picker (its R138).
- **interface-shell:** R104 the browser tab's title (`page.title.public`); R101 a print that failed (`cs.print` reports none); R89 a case-title breadcrumb on the docket (its path word).
- **screens-intake:** R85 the Inbox's "Show it safely".
- **case-disclosures:** R87 `mailnameshow` and `mailnamewithhold`.
- **screens-investigate:** R89 the project page's Docket link.
- **docket / publication:** R90 the edition entry on the public docket, with what changed.
- Also owed, for marks this attempt met: case-authoring's sign-step rows naming the passage's target and part (R83 grades in the finding's fold until then); review's copy carrying grades (DEC-496's gloss on `review-outside`); `.cs-gloss` in interface-assets' served CSS; a provider of CHECK signals and IV-7's other three states (DEC-497).
