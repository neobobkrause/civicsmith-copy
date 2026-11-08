# screens-daily — requirements notes

Non-requirement text moved out of `build/requirements/screens-daily.md` on 4 Nov 2026 (job screens-daily, attempt 1), kept verbatim, so that file holds requirement lines and their blocks only (REQ-6, the 70,000-byte cap). Every **R** and **F** line and its mark stayed there; `bio-plane/test/m/screens-daily/requirements-ids.test.mjs` pins the ids and unmet marks to the start commit's (84d87b4b).

The requirement lines alone (every **R** and **F** line, verbatim) are about 77,500 bytes, over the cap by themselves, so no move of other text brings the file under it: a split of the module's requirements is owed (BOB's, REQ-6).

## Status (moved verbatim)

**Status** · New in T46 (T46-57; K657, K1043): a module built fresh, layer 11 after `screens-intake` (N897 (1), Bob's K2816; DEC-110, DEC-131, DEC-139, DEC-164; N698's screen part). Drafted in `build/plan/draft-T46-interface.md` §2.5, worded here by BOB (P5). No ids move. Not yet met (T46). Last changed T47 (T47-60: R8 new, amending R1, Home's projects from `projectlist` with each one's question count from `projectquestions`, N972; R9 new, the front door "What happened?" from `startfrom`'s doors, its scripts started through the wizard runner, DEC-198 (4)); marked not yet met (T47). Last changed T48 (T48-72: R14 new, amending R9, Home's sixth door; R15, R16 new, the screen `elsewhere`, N847, DEC-227; R17 new, amending R1 and R11, Home as every member's nerve centre, arrangement C, N1036, DEC-218, DEC-219, K3146, K3189, K3211; R18 new, `queuemute`'s case form, K3190 census Q1; R19 new, the update to-do, N1047, DEC-226 (1); R20 new, Projects links to `imported`, DEC-228 (4); K3195); marked not yet met (T48). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R21 new, the common line; R22 new, amending R2 and R17, source notices keyed, one per kind with a count; R23 new, door cards, the title on press, "Your group", the name as a first step); marked not yet met (T48). Last changed T49 (T49-24: R24–R33 new; K3334); marked not yet met (T49). Last changed T50 (T50-31: R40–R52 new; a new team's first steps, the empty queue, a member who may not start projects, Themes and Find's filter, Find's browse, watch and flag, results as people read them, Find in's recording, titles, the queue's foot, Home's counts, the ask's progress; N1101, N1165, N1092, N1166, N1177, N1192, N1123, N1094, N1180, N1195; DEC-238, DEC-242, DEC-285, DEC-286, DEC-298, DEC-299, DEC-300); marked not yet met (T50). Last changed T50 (T50-31, the re-fold of DEC-318 to DEC-327, BOB #205: R40, R43–R45 and R47–R51 amended in place; R53 (DEC-314, K3706) is also new in T50; a new team's Home headed and led by "Name your team", Themes without counts, Find's browse paging and its no-`since` state, watch, flag and clear by the drawn keys, the person-fact and money forms Find in draws, the muted list as `queue` R55 answers it, "Open the item", the untitled subject's date, the strip item's explanation; DEC-318, DEC-321, DEC-322, DEC-323, DEC-324; K3720, K3724, K3726, K3728, K3730); amended lines marked not yet met (T50). Last changed T51 (T51-118, L11 fold, BOB #210: R54 new, Find's words field, choices and the kit options; R55 new, the whole record as one sortable table (A14); R56 new, Find's scope, three routes counted apart and what the search covered (A15); R57 new, citing the whole held set (A17); R58 new, choosing several queue items and each item's outcome (A58; the provider's per-item outcomes are existing requirements); R59 new, what you answered (A61); R60 new, the feeds' honesty (A62); R61 new, set-aside findings and a muted item named (A63, N1238); R62 new, a sheet match's row (N1238); R36 and R37 not reused; K3807, K3806, K3839, K3775; DEC-329 (4), DEC-330, U350; R54–R62 worded to DEC-335 and DEC-336, K3897: the table's, scope's, subjects', multi-choice and answered words keyed, the 12-hour clock, no forward note); marked not yet met (T51). Last changed T53 (A6, DEC-462: R108, R109 new, a signing-key item per key; N1260: R110 new, Follow from here in Find; N1272, DEC-476: R111 new, the not-interpreted mark; K4354, P24: R112 new, heldcaptures out of the first wave; JOURNEYS: R113–R116 new); marked not yet met (T53).

## Size (moved verbatim)

**Size (P6).** Estimated 2,200–2,800 lines with comments, its own keyed sentences included, measured at its START (M-T46-1, K617).

## Block notes (moved verbatim)

From the head of "T51 (T51-118)":

R36 and R37 were withdrawn from an earlier cut (K3551) and are not reused. A sentence the design holds only as a drawn sample (a name, a day or a count written into its key) or does not hold at all is never drawn as English here (R34): the job REPORTs the key and the fills it needs to BOB for the design lane; those found at this fold are named in the requirement that needs them.

From the head of "T51 fix round (FR-27; K4165, K4168; DEC-374, DEC-376, DEC-378, DEC-384)":

Words rule (R34) stands: a sentence the design does not hold is never invented; the nearest held key is used and the missing one is a REPORT to BOB (the J-record of this fix round lists each).

## Private (moved verbatim; the F2 found mark stayed in the requirements)

### Uses

- `setup-words.word`, `setup-words.hasWord` (K3366, K3368): every member-facing sentence, by key.

- `interface-shell`: the kit `cs` and the screen contract (its R21).
- `setup-words`: `WORD_ROWS` keys.
- (T47) Through the plane: `project-roster` (`projectlist`, R26; R8), `basis-versions` (`projectquestions`, R50; R8), `wizard-scripts` (`startfrom`, R23, R33; R9). `screens-wizards`' runner, reached through the shell's `cs.wizard` (`interface-shell` R31), never imported.
- Through the plane: `queue` (R6, R17, R48, R49), `tasks`, `project-roster` (`projectdirectory`), `promotion`, `retrieval` (`search`, `select`, `selection`, `findin`, `frontier`), `calculations`, `people`, `events`, `standards`, `money`, `citation`, `answers` (`rule`, the standing questions), `agent-worker` R54, `reevaluation`, `action-clocks`, `inquiry`, `credentials`, `ai-use`, `instance-setup` (`groupidentity`).
- (T48) Through the plane: `wizard-scripts` (`startfrom`, its R37; R14–R16), `membership` (`lookedsince`, its R143; R17), `instance-setup` (`bootstrap`, `profiles`, `grouplanguages`; R17), `ai-use` (`aiuseovertime`, its R14; R17), `queue` (R54's section; R19), `updatelater` (`instance-setup` R90; R19).
- Tests only: `op-declarations` (`OPS`).
- (T51) Through the plane: `retrieval-browse` R10, R12, R13 (`browse`'s `state`, `total`, `awaiting_review`; the scopes), `retrieval` R87–R89 (`searchfields`' scopes, `ROUTES_CROSSED`, `existence_only_projects`), `entities` R59 (`subjectsnamed`), `citation` R1–R3 (`cite` over a selection), `queue` R58–R61 (the muted title, `answered: true`, `feeds`, `all_clear`, `aside: true`), `tasks` R3 and `record-core` R50–R52 (the set acts' per-item answers), `retrieval-browse` R8 (a sheet match's `row`). `interface-shell` R90, R93, R95 (the kit options, a list that re-reads itself, state chips).
- (T53; R108–R111) Through the plane: `queue` R97 and `queue-producers` R56–R57 (the per-key options), `credentials` R7, R83 (`signerset`, `signerknown`), `affordances` `followfrom` (R74), `investigation` `interpretedFor` (its R30, owed by N1272); `interface-shell`: `cs.follow` (R139), `cs.memberName`. All in earlier modules.

### Invariants

None numbered here: `interface-shell` R23 and R24 (no place named; no log of who opened what) bind this module's screens as every screen's.

### Satisfies

- Registry screens `home`, `queue`, `finder`, `find-in`, `answers` (DEC-139 (3), (7)); N897 (1). (T47) N972 (R8); DEC-129, DEC-198 (4), D52, N821's screen side (R9).
- DEC-110, DEC-131 (R2, R3); DEC-164, N698 (R5); K1468 (R5).
- (T48) Registry screen `elsewhere` and DEC-227 (R14–R16); DEC-218, DEC-219 (R17); DEC-226 (1) (R19); DEC-228 (4) (R20).
- (T51) DEC-329 (4) (R54); DEC-330 A10, A14, A15, A17, A58, A61, A62, A63 (R55–R61); U350; N1238 (R61, R62); DEC-335 and DEC-336 (9) (R54–R62: keys given, the clock, snooze per case).
- (T53) DEC-462, K5456 (R108, R109; A6). N1260, DEC-410, DEC-447 (4) (R110). N1272, K4571, K5495, DEC-476 (R111). K4354, P24 (R112). JOURNEYS R-15, R-16, R-27, R-63 (R113–R116).

### Suggestions

- The front doors ("What brought you here?") come from `startfrom`'s `doors` (`wizard-scripts` R23), `[]` until the design stream gives them; `startfrom` is T47's with the wizard runner.
- `mark.origin.search.means`, `queue.step-cost-shared.detail` and `ai.refused.limit.unjudged` are drawn from this module's own rows (`interface-shell` R5: each names Civicsmith bare).

## The 8 Nov 2026 rewording (job screens-daily, attempt 8)

On BOB's ruling (8 Nov 2026), the requirement lines were reworded to bring the file under the 70,000-byte cap without changing what any requirement means. No id was renumbered, merged or dropped, and every unmet mark, `code span`, quoted phrase and requirement reference stayed in its block. The verbatim text before the rewording is `build/requirements/screens-daily.md` at commit f0083736ea. Provenance ids dropped inside the lines (T, N, K, DEC, U, C and walk ids) are in that commit. Each line's leading citation, moved here verbatim (its "amends"/"changes" part stayed on the line):

- R8: (T47; N972; K3027 doubt 5; amends R1; `project-roster` R26, `basis-versions` R50)
- R9: (T47; N821, its screen side; DEC-129 (7), (2); DEC-198 (4); D52; `wizard-scripts` R23, R33; `interface-shell` R31)
- R10: (DEC-201 (8))
- R11: (DEC-201 (7), DEC-202 (4))
- R12: (DEC-201 (13))
- R13: (DEC-212; `action-producers` R25)
- R14: (T48; N847; DEC-227 (1); `wizard-scripts` R37; amends R9)
- R15: (T48; N847; DEC-227 (2), (4))
- R16: (T48; DEC-227 (1))
- R17: (T48; N1036; DEC-218 (arrangement C), DEC-219; amends R1, R8, R10, R11)
- R18: (T48; K3190, census Q1; `queue` R19, R20)
- R19: (T48; N1047; DEC-226 (1); `machinery-producers` R11; `queue` R54)
- R20: (T48; DEC-228 (4); K3190)
- R21: (T48; K3250, K3254 (1), (5); walk C1, C4, C5; DEC-219 (3); K3052; amends R7)
- R22: (T48; K3250, K3254; walk C6, row 5; amends R2, R17; `queue-producers` R40)
- R23: (T48; K3250, K3254 (3); walk rows 3, 4, 19; DEC-218, DEC-219; amends R1, R9, R10, R11, R14, R17)
- R24: (T49; D7 **B**; `citation` R14's `found` form; amends R5)
- R25: (T49; D11 **M**, D30 **m**, D31 **m**; amends R1, R9, R10, R23)
- R26: (T49; D16 **M**; amends R5)
- R27: (T49; D17 **M**; `agent-worker` R89; amends R6)
- R28: (T49; D21 **M**; amends R2, R17)
- R29: (T49; D25 **M**; `project-roster` R26, R29; amends R10, R17)
- R30: (T49; N1091; DEC-237 (projects); `promotion` R19; amends R1, R10, R23)
- R31: (T49; N1093; DEC-239 ("everywhere"); `action-producers` R1; amends R2, R17)
- R32: (T49; N1072; DEC-230 (4); `project-roster` R29; amends R10)
- R33: (T49; N1100; DEC-245; amends R10, R12)
- R34: (T49; K3366; DEC-257, DEC-258; `setup-words` R11–R13; amends every requirement here that quotes a member-facing sentence)
- R35: (R085-12; K3486 (Find); R4; `retrieval` R15)
- R38: (R085; JOURNEYS #2 B-25; K3562; amends R5)
- R39: (R085; JOURNEYS #2 B-26; K3562; amends R5, R24)
- R40: (T50; U7; DEC-285; DEC-292 D17; DEC-321 (6); K3724; amends R17, R23, R9)
- R41: (T50; U8b; DEC-292 D13; amends R12)
- R42: (T50; N1163 M-F1; U8; DEC-286; Membership §5, §7.14; amends R1, R10, R11, R30)
- R43: (T50; N1101, N1165; DEC-242; DEC-321 (3); K3326, K3380, K3724; `connections` R39–R46; amends R10, R4; clears the base red `contract.test.mjs` on `projects`)
- R44: (T50; N1092; DEC-238 (F1, F2); DEC-322 (3); K3724; `retrieval` R85, R86; `membership` R148; amends R4)
- R45: (T50; N1092; DEC-238 S23 "A"; DEC-321 (7); K3724; `following` R32–R34; amends R4)
- R46: (T50; N1166, N1183; K3501; WALK-085 F4; J-5; DEC-299 (5); `query-language` R33; `retrieval` R80, R82; amends R4, R26)
- R47: (T50; N1177; DEC-318 (1); DEC-324 (3); K3547, K3598, K3630, K3720; JOURNEYS J-8, J-9, V4 B-28; `people` R9; `standards` R47, R60; `retrieval` R81; amends R5)
- R48: (T50; N1192, N1191 (b), (d), N1193; V4 B-29, B-34, B-38, B-39; DEC-300 (2), (3), (6); DEC-303 (4); DEC-318 (2)–(5); DEC-324 (2), (5); K3720, K3726; `retrieval` R83, R84; amends R5, R39, R24)
- R49: (T50; N1123; DEC-323; K3373, K3726; SCREENS-DAILY #4 J2; `queue`'s `subject.title` (T50-21), `retrieval` R80; amends R26, R28)
- R50: (T50; N1094; N1106; N1144, N1145; N1183; DEC-240 (Q2); DEC-248 (2)–(4); DEC-275, DEC-276; DEC-299 (4); DEC-321 (4); DEC-323; DEC-324 (6); K3724, K3726; `queue` R14, R55; amends R2, R3, R28, R29, R31)
- R51: (T50; N1180; N1183; DEC-299 (1), (6), (12); DEC-321 (5); K3724; amends R17, R10)
- R52: (T50; N1195; K3602, K3605; DEC-298 (3), (4); DEC-304; `agent-worker` R113; `interface-shell` R78; amends R6)
- R53: (T50; DEC-314 (1); K3706; `agent-worker` R110, R113; amends R52)
- R54: (T51; N1232, K3767; DEC-329 (4), DEC-330 (A15); DEC-335, K3897; `interface-shell` R90; amends R44, R50)
- R55: (T51; K3807; DEC-330 A14; DEC-335, DEC-336 (9), K3897; census A14; `retrieval-browse` R10, R12; `interface-shell` R93, R95; amends R4, R44)
- R56: (T51; K3807; DEC-330 A15; DEC-335, DEC-336 (9), K3897; B312; census A15; `retrieval` R6, R11, R13, R14, R87–R89; `retrieval-browse` R13; `entities` R59; amends R4, R12, R35)
- R57: (T51; K3807; DEC-330 A17; DEC-335, K3897; census A17; `retrieval` R18–R20; `citation` R1–R3; amends R4)
- R58: (T51; K3807; DEC-330 A58; DEC-335, K3897; census A58; `queue` R12, R21, R27, R40; `tasks` R3; `record-core` R50–R52; amends R3)
- R59: (T51; K3807, K3806; DEC-330 A61; U350; DEC-335 (2), (3), (5), K3897; census A61; `queue` R59; amends R2)
- R60: (T51; K3807, K3806; DEC-330 A62; DEC-335, K3897; census A62; `queue` R60; `interface-shell` R93; amends R12, R41)
- R61: (T51; K3807, K3839; DEC-330 A63; N1238; DEC-299 (8), DEC-329 (11); DEC-335, K3897; census A63; `queue` R58, R61; amends R2, R50)
- R62: (T51; N1238; K3775; DEC-336 (9), K3897; `retrieval-browse` R8; amends R48)
- R63: (T51; N1184 B-23; DEC-340, U366; K3935; amends R10; `project-roster` R38)
- R64: (T51; N1088, K3189, K4059; DEC-218, DEC-219; amends R17)
- R65: (T51; C13, C14, C15; DEC-374; amends R17; `capture` R77, `doorbell` R3)
- R66: (T51; C27; DEC-374; amends R43)
- R67: (T51; C33; DEC-376 (C33: facet counts not drawn); amends R44, R56)
- R68: (T51; C58; DEC-376 ("defer" for putting a proposal off); amends R3)
- R69: (T51; C59; amends R3; `queue` R40, R21)
- R70: (T51; C60; amends R3, R61; `progressions` R-`NO_DEFINITION_VERSION`)
- R71: (T51; C61; amends R28, R49)
- R72: (T51; C84; amends R10; `project-roster` R39, `screens-inquiry` R30)
- R73: (T51; C47; DEC-374; amends R3)
- R74: (T51; C48; DEC-374; amends R3, R17)
- R75: (T51; C62; DEC-378; K4169; amends R3, R17; `tasks`, `queue-producers` R46–R48)
- R76: (T51; L7; amends R56)
- R77: (T51; L8; amends R67)
- R78: (T51; I-13, I-14; DEC-384 (U417; K4197); amends R44)
- R79: (T51; G1, G2, G4, T-15; DEC-384 (U417; K4197); amends R3, R28)
- R80: (T51; T-20; DEC-384 (U417; K4197); amends R30)
- R81: (T51; B14, K4221; `interface-shell` R104; amends R3, R9, R40, R48)
- R82: (fix round 2, C4; `screens-settings` R2; amends R3, R17)
- R83: (T51 fix round 2, C21; retrieval R92; K4326)
- R84: (T51 fix round 2, C72; K4326)
- R85: (T51 fix round 2, C94; interface-shell R111; K4326)
- R86: (T51 fix round 2, C14; capture R77; K4326)
- R87: (K4399; fix round 3, C14, P2.2; project-roster R42; amends R8, R10, R64)
- R88: (K4399; C14, P2.3; capture R77; amends R65, R86)
- R89: (K4399; C22; amends R67)
- R90: (K4399; C23)
- R91: (K4399; C70; interface-shell R96; amends R17)
- R92: (K4399; C81)
- R93: (K4399; queue-producers R52)
- R94: (K4399; interface-shell R113)
- R95: (fix round 4, C70; K4429)
- R96: (fix round 4, C22; R89; K4474)
- R97: (fix round 4, C25; screens-intake R54; K4474)
- R98: (fix round 4, C14; K4474)
- R99: (fix round 6, G12c; review R19; K4606)
- R100: (fix round 6, G16; K4571)
- R101: (fix round 6, G16; K4571)
- R102: (fix round 6, G20; K4571)
- R103: (fix round 10, cause R17a; K5056, K5094)
- R104: (03b §4, project-roster R12)
- R105: (03b §5, §6; queue R95, queue-producers R54; amends R3, R59)
- R106: (03b §17, 06 §19 (d); amends R26, R92)
- R107: (T51 fix round 10; DEC-439, DEC-440, DEC-441; UX-DESIGN U481-U484; K5303)
- R108: (T53; DEC-462; amends R79 (e), R107; `queue` R97; `queue-producers` R56, R57)
- R109: (T53; DEC-462; amends R58)
- R110: (T53; N1260; DEC-410 "finder results"; DEC-447 (4))
- R111: (T53; N1272; K4571; K5495 A; DEC-476)
- R112: (T53; K4354, P24; `platform/time-budgets-draft.md` §3; `platform/combined-read-and-fold-draft.md` PL10, PL11)
- R113: (T53; JOURNEYS; changes R86, R97; answers R-15)
- R114: (T53; JOURNEYS; changes R48, R54; T52-62 carries the snippet half; answers R-16 (parts not carried))
- R115: (T53; JOURNEYS; new; answers R-27)
- R116: (T53; JOURNEYS; new; answers R-63, help half; the records-help half is in part 3)
