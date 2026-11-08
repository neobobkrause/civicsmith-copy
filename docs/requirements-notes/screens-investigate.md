# screens-investigate — requirements notes

Text moved out of `build/requirements/screens-investigate.md` toward the requirements cap (70,000 bytes), unchanged in wording (job screens-investigate, T53). No requirement lives here: every **R<n>** line and its mark stays in the requirements file. `bio-plane/test/m/screens-investigate/requirements-ids.test.mjs` asserts the move changed no id and no mark.

## Change history (the requirements file's former Status line)

**Status** · New in T47 (T47-62; K657, K1043, K569, K3027 doubt 2): a module built fresh, layer 11 after `screens-inquiry`, first of three (`screens-investigate`, `screens-publish`, `screens-action`), before `control-plane` (N897 (1); N719, N728, N735's spot-check; DEC-139, DEC-142, DEC-160, DEC-164, DEC-170, DEC-176, DEC-181; K1462, K1490, K1494, K1457, K1468, K1469, K1487, K1431, K1444). Drafted in `build/plan/draft-T47-interface.md` §2.2, worded here by BOB (P5). No ids move. Not yet met (T47). Last changed T48 (T48-74: R15 new, amending R12, R13, "Added at setup" from `today.machine`, N1050, K3178; R16 new, amending R6, "Follow its register" names the proceeding, N882; R17 new, amending R2, a source attached to a declared step by `stepsource`; R18 new, amending R1, R2 and R4, the connection graph, N1027, N1030, DEC-215 (2); R19 new, amending R8, a project's standard proposals, N1029; R20 new, amending R3, participants, grades and order on the timeline, N1031; R21 new, amending R1, an identity claim withdrawn by its id, N1032; K3145, K3190, K3195, K3203); marked not yet met (T48). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R22 new, the common line; R23 new, no id fields; R24 new, explore's five groups; R25 new, people's empty state; R26 new, the subject guard); marked not yet met (T48). Last changed T49 (T49-26: R27–R29 new; K3334); marked not yet met (T49). Last changed T50 (T50-33: R31–R37 new; R38 new, the person page's "Same person?" in the design's words, N1161 F9, K3664; the `theme` screen, Person's every fact, ties and names, Timeline's matters and dated facts, forms that choose, named graph nodes, a proceeding's court and kind, People; N1101, N1127, N1102, N1193, N1079, N1086, N1090, N1190; DEC-242, DEC-243, DEC-294, DEC-300, DEC-301, DEC-303); marked not yet met (T50). Last changed T50 (T50-33: R31, R32, R33 (5), R36, R38, R39 amended to the drawings DEC-319 and DEC-323 give: a theme's "Taken out by" row, the person's undetermined and withdrawn facts and the claim form with `label.claimbases.<id>`, the timeline's "Dated in the documents", the proceeding's court and kind; K3720, K3726; DEC-319, DEC-323); marked not yet met (T50). Last changed T51 (T51-120, BOB #210's L11 fold: R40 `people` lists the record's other kinds, R41 `person` opens a subject of any kind, R42 adding one after a near-match check, R43 the unnamed node's `why` and the explored hop, R44 an undetermined fact's reason by `word`, R45 a finding's state and the Define and Revise fields by key, R46 pages from one, R47 a proceeding's kinds from the profiles new; R32 (2)'s record-data clause retired; K3807, K3815; DEC-308, DEC-329 (3), DEC-330 A50, A51; N1207, N1226, N1233, N1236; R40 to R42 worded to DEC-335 and DEC-336, K3897: no facts on another kind's page, no proceeding in the add form, near-match and held-by keys); marked not yet met (T51). Last changed T51 (fix round, FR-29: R49–R59 new: a flow defined from the timeline, an organization's offices' records, was it in force on a date, vouched documents chosen, the organization's page, the due-date page's reminder, counterparty and rule pick, the standard's path; K4194, K4197, K4210; DEC-374, DEC-375, DEC-384). Fix round 6 (T51): R52 amended (G20, K4571: every "Which document" picker reads on by the cursor and says how many it shows past its bound; SCREENS-INVESTIGATE #15, K4592). Last changed T53 (N1260, DEC-447: R67–R70 new, Follow from here, the most direct path, a shorter path, chains that stop; N1257, K5458: R71 new, the layer on `due-date`; DEC-463: R72 new, the shared document picker; DEC-474: R73 new, the ceiling chips; JOURNEYS: R74–R92 new); marked not yet met (T53).

## Size

**Size (P6).** Estimated 2,600–3,200 lines with comments, its own keyed sentences included, measured at its START (M-T47-1, K617). (T51) 2,662 lines of source today (`bio-plane/src/screens-investigate/`); R40–R47 add roughly 400–600, so the module stays under ~4,000, and START re-measures it (M-T51-1).

## Uses (the requirements file's Private › Uses)

- `setup-words.word`, `setup-words.hasWord` (K3366, K3368): every member-facing sentence, by key.

- `interface-shell`: the kit `cs` and the screen contract (its R21), rows and the hold strip (its R19), `cs.download` (its R21).
- `setup-words`: `WORD_ROWS` keys.
- `wizard-scripts`: `SCREEN_REGISTRY` (its R13, R31), in tests only.
- Through the plane: `people` (`person`, `samepersoncandidates`, `personfact`, `identityclaim`, `identitywithdraw`, `personexpunge`, `memberties`, `membertie`, `membertiewithdraw`), `explore` (`explore`, `explorepreset`, `exploreverify`), `connections` (`connectionassert`; T48: `stepsource`, `stepsourcewithdraw`, its R68; R17), (T48) `explore` (`exploregraph`, `exploreverify` with `chain`, its R21–R23; R18), `standards` (`standardproposals`, its R57; R19), `people` (`today.machine`, `claims`, its R38, R39; R15, R21), `events` (participants, grades, `precedes`, its R50, R51; R20), `following` (`followregister` with `proceeding`, its R29; R16), `promotion` (`promote`), `events` (`timeline`, `eventcreate`, `participantadd`, `eventrelate`, `datedfact`), `hypotheses` (`hypothesishold`), `retrieval` (`findin`), `money` (`moneyset`, `moneyof`, the money acts), `capture` (`gradenote`), `acquisition` (`acquire`), `actions` (`actioncreate`, `action`), `tasks` (`checkrequest`), `calculations` (`calculation`, `spotcheck`, the calculation acts, `spotcheckvisit`), `workbooks`, `entities` and `provenance` (`testify`, `entitycreate`, `entity`), `lines` (`partiesof`, `linerecord`), `following` (`follows`, `followregister`), `duties` (`dutiesof`, `dutydeclare`), `law-relations` (`courtlink`, `lawrelate`, `lawrelations`), `action-clocks` (`clockpropose`, `clockadopt`, `clockproposals`, `reminderset`, `clocksics`), `standards` (`standard`, `standarddeclare`, `standardadopt`), `progressions` (`proposals`).
- (T51; R40–R47) Through the plane: `people` (`peopledirectory`'s `show` of other kinds, its R41; `person`'s keyed `why`, its R40), `entities` (`entitysimilar`, `entityidonly`, its R57, R60; `entitycreate`, `entity`, `concerns`, `entityalias`, `relationdeclare`), `lines` (`linesof`, for an office's holders), `progressions` (a finding's `state`, its R46), `affordances` (`proceeding_kinds`, its R67). `subjectsnamed` (`entities` R59) is Find's, `screens-daily`'s. No new `modules.json` edge.
- Tests only: `op-declarations` (`OPS`).
- (T53; R67–R70) `interface-shell`: `cs.follow` (R139); over the door: `followfrom` (`affordances` R74), `exploreall`, `explorepath`, `exploreshorter`, `explorecontinue`, `moneyby`, `search`. (R72) `interface-shell` R138, the shared picker. No new edge (N1260 part (b), section 12).

## Invariants

None numbered here: `interface-shell` R23 and R24 (no place named; no log of who opened what) bind this module's screens as every screen's.

## Satisfies

- Registry screens `person`, `explore`, `timeline`, `money`, `calculation`, `proceeding`, `due-date`, `standard`, `ties` (`docs/development/ux-substrate/screens/registry.json` at `a0fab7abf0`; DEC-139); their drawings in `mock-screens.js` at that commit; N897 (1).
- (T51) K3807, K3815; DEC-308 (3), DEC-329 (3), DEC-330 (A50, A51); DEC-335, DEC-336 (3) (R40–R42); census-legacy-ui rows A50, A51; N1207, N1226, N1233, N1236: R40–R47.
- N719, DEC-142, DEC-170, DEC-181 (R1); K1469, K1486, K1487 (R2); K1462, K1494 (R3); N728, K1457, K1468, DEC-176 (R4); N735, U115 (R5); K1431, K1444 (R7); K1490 (R9); DEC-160 (R10).
- (T53) N1260, DEC-409, DEC-410, DEC-411, DEC-447, K4354, K4403 (8), (9) (R67–R70). N1257, K5458 (R71). DEC-463, K5516 (R72). DEC-474 (R73). JOURNEYS R-69, R-70, R-71, R-72, R-80, R-81, R-83, R-85, R-75, R-76, R-74, R-91, R-92, R-93, R-89, R-84, R-86, R-79, R-13; K5557 (J4) (R74–R92).

## Suggestions

- "Record what you found at a report" sends `spotcheckvisit` after `testify`; the registry names only `testify` there, so `interface-shell` R21 admits `spotcheckvisit` on `calculation` as a re-point until the design stream lists it (a registry correction, BOB's channel act; `draft-T47-interface.md` §3).
- The `help` page ("How spot-checks work") is a registry screen with no act and no module in T47 (`draft-T47-interface.md` §5): until one is placed the link draws a card only (`interface-shell` R16).
- (T51) **Gaps for BOB at the fold** (none is a requirement of this module): the option words of People's "Show" choice for the other kinds ("Offices", "Ordinances", "Contracts", "Funds and programs", "Sources") and of the add form's kinds ("An ordinance", "A contract", "A fund", "A program", "A place", "A parcel", "A source"), are not keyed in `words.json` (`screen.people.show.*` holds four values; DEC-335 and DEC-336 gave `people.nearmatch.*`, `screen.people.today.heldby` and `find.row.kind.*`, which R40 and R42 now use); the rest are asked of UX-DESIGN (R30; plan rule 10). How the add form's state g is reached is not drawn: R42 reads it as the form that "Add someone the record follows" opens when a non-person kind is in view.
- The screens' own sentences are held in `SCREEN_WORDS` (`screen.<id>.<part>`) from the mockups' English at `a0fab7abf0` until the design stream adopts them (DEC-198 (6)).

## Split proposal for BOB (job screens-investigate, T53)

After the move the requirements file is 89,689 bytes, still over the 70,000 cap: its 93 R lines with their sub-bullets, kept verbatim, come to about 87,300 bytes; the headings, Purpose and the T51 block's rules about 2,400. The file cannot go under the cap without a split, which is BOB's call (a new module id). Recommended, by screen, so each module's lines follow its source files:

- **New module `screens-people`** (the `people` and `person` screens; `bio-plane/src/screens-investigate/people.mjs`, `person.mjs`): R1, R12, R13, R15, R21, R25, R26, R32, R37, R38, R39, R40, R41, R42, R44, R48, R50, R53, R58, R74, R75, R76, R77, R78, R93, each line kept and marked "was screens-investigate R<n>"; about 27,800 bytes of lines, about 30,000 with its headings. Unmet there: R74, R75, R76, R77, R78, R93.
- **Stays in `screens-investigate`** (explore, timeline, money, calculation, proceeding, due-date, standard, ties, theme, help, common): the other 68 lines, about 59,500 bytes of lines (explore's 16 lines about 14,800 of them), about 62,000 with its headings.

R67 (Follow from here) and R72, R73, R81 name both sides' screens; they stay here, and the `people`/`person` halves are met by the shared code unless BOB rules them across. Requirements are unchanged by the split.

## Sources by requirement (consolidation, T53)

Each requirement's sources and amendment tags, moved here word for word from its line when job screens-investigate consolidated the requirements file under the 70,000-byte cap (attempt 4). The wording before the consolidation is `build/requirements/screens-investigate.md` at `79b44d620f`. Where a later requirement superseded part of an earlier one, the earlier now states only what still binds; quoted English that only identified a key was dropped where the key is named (R30); one-time START acts already done (R38's read of `samepersoncandidates` on biosmoke8 for WALK-085) and seams that described old code were dropped. No requirement lives here.

Section headings' sources: person N719, DEC-142, DEC-170, DEC-181 (the registry's 6 acts); explore K1469, K1487 (5 acts); timeline K1462, K1494 (6); money N728, K1457, K1468, DEC-176 (14); calculation N735's spot-check (8); proceeding (5); due-date K1431, K1444 (3); standard (3); ties K1490 (2). T47's L11 fold K3100; the design walk folded T48, WALK-084 #2, K3250, K3254; T49 words by key K3366, K3368, DEC-257, DEC-258; T51 (T51-120) K3807, K3815, DEC-308, DEC-329 (3), DEC-330, N1207, N1226, N1233, N1236, DEC-333.

- R1: (K5148; WALK-FINAL-05 R149, R59)
- R3: (T51 fix round 2; K4328) … "tied to what the project names" is no longer in force (C54, C6)
- R4: (Fix round 3, C8; K4395)
- R8: (K5148; WALK-FINAL-08 D2, D4, D7, D8, D9, D10, R70.12)
- R11: (N997)
- R12: (DEC-203 (1)–(3); K3061 D8)
- R13: (DEC-203 (4)–(6))
- R14: (DEC-200 (4); amends R5)
- R15: (T48; N1050; K3177, K3178; `people` R38; amends R12, R13)
- R16: (T48; N882; `following` R29; amends R6)
- R17: (T48; N1030; `connections` R68; `interface-shell` R55; amends R2) · (T51 K4267)
- R18: (T48; N1027, N1030; DEC-215 (2); K1469, K1486, K1487; `explore` R21–R23; `interface-assets` R5; amends R1, R2, R4)
- R19: (T48; N1029; `standards` R57; amends R8)
- R20: (T48; N1031; `events` R50, R51; amends R3)
- R21: (T48; N1032; `people` R39; amends R1)
- R22: (T48; K3250, K3254 (1), (5); walk C1, C4, C5; DEC-219 (3); K3052; amends R10) · DEC-219 (3) applied to every screen is BOB's reading of K3052, K3254 (5); an ASK to UX-DESIGN to draw a class none fits (K3254 (1))
- R23: (T48; K3250, K3254; walk C8, row 15; amends R1, R6, R8, R9)
- R24: (T48; K3250, K3254; walk row 15; amends R2; `affordances` R59)
- R25: (T48; K3250, K3254; walk row 18; amends R12, R13)
- R26: (T48; K3250, K3254; walk C7, row 6)
- R27: (T49; N1090; DEC-236 (B204 (3)); `affordances` R60; amends R18, R24)
- R28: (T49; N1094; DEC-240 (proceeding); DEC-232; `following` R30; amends R6)
- R29: (T49; D30 **m**; amends R2)
- R30: (T49; K3366; DEC-257, DEC-258; `setup-words` R11–R13; amends every requirement here that quotes a member-facing sentence)
- R31: (T50; N1101; DEC-242 (S4); DEC-323; K3326, K3380, K3726; `connections` R39–R46; amends R10)
- R32: (T50; N1127, N1193; N1183; K3376; V4 B-32; DEC-299 (6), (12); DEC-319 (1); K3720; owners §6; amends R1, R10)
- R33: (T50; N1127, N1102; N1193; DEC-243; DEC-303 (3); DEC-319 (5); K3720; `progressions` R44, R45; `events` R53; amends R3) · (T51 K4267) · (T51 fix round 2; K4328) · (K5148; WALK-FINAL-07 R60, R61)
- R34: (T50; N1079; K3295, K3627; N1183; B-17, B-18; DEC-299 (8), (9); N1177; amends R23, R4, R5, R8) · (T51 fix round 2; K4328) · (Fix round 3, C59, C95, C14; K4395) · (K5148; WALK-FINAL-07 R158, WALK-FINAL-08 D3, D6)
- R35: (T50; N1086, N1090; K3302; DEC-236 (B204 (3)); `explore` R25; `entities` R56; amends R18) · (T51 K4267)
- R36: (T50; N1190; V4 B-27; DEC-300 (1); DEC-301 (4); DEC-319 (3); K3720; owners §4; `entities` R54, R45; `jurisdictions` R94; amends R6, R23)
- R37: (T50; U16; DEC-294; DEC-292 D18; amends R12, R13, R25)
- R38: (T50; N1161 F9; K3664; WALK-085 F9; DEC-233; DEC-319 (2); K3720; `people` R1, R2, R4, R7; amends R1, R21, R32)
- R39: (T50; DEC-313 (4); DEC-319 (2); K3703, K3720; amends R38)
- R40: (T51-120; DEC-330 A50; DEC-335, DEC-336 (3), (9), K3897; census A50; `people` R37, R41; amends R12, R13, R25, R37)
- R41: (T51-120; DEC-330 A50; DEC-336 (3), K3897, K3898; census A50; `people` R41; `entities` R5, R6, R15; `lines` `linesOf`; amends R1, R10, R21, R26)
- R42: (T51-120; DEC-330 A51; DEC-335, DEC-336 (3), K3897; census A51; `entities` R1, R2, R60; amends R37)
- R43: (T51-120; N1207; K3665; DEC-308 (3); `entities` R57; `explore` R25; amends R35)
- R44: (T51-120; N1226; K3742; N1116; `people` R40; `setup-words` R11–R13; amends R1, R32)
- R45: (T51-120; DEC-329 (3); N1233, K3806; `progressions` R46; amends R33)
- R46: (T51-120; K3815, usability review B-11, B-30, B-31; amends R1, R2, R41)
- R47: (T51-120; N1236; K3771; `affordances` R67; `jurisdictions` R51; amends R36)
- R48: (T51; N1184 B-21; DEC-340, U366; K3935; amends R32)
- R49: (T51 fix round; C26; amends R33 (3))
- R50: (T51 fix round; DEC-374, C68; `lines` `recordline`; amends R1) · (T51 K4267)
- R51: (T51 fix round; DEC-375, C40; `standards` `standardinforce`; amends R8)
- R52: (T51 fix round; K4194 L2; fix round 6, G20, K4571; `capture` R88; amends R34) · (T51 fix round 2; K4328)
- R53: (T51 fix round; K4194 L10; amends R41)
- R54: (T51 fix round; K4194 L21; amends R7)
- R55: (T51 fix round; K4194 L22; amends R7)
- R56: (T51 fix round; K4194 L24; amends R8)
- R57: (T51 fix round; DEC-384, I-30, `interface-shell` R110; amends R56)
- R58: (T51 fix round; DEC-384, I-32; amends R53)
- R59: (T51 fix round; DEC-384, E6; `action-clocks`; amends R7)
- R60: (T51 fix round 10; DEC-435 (B523's rows); SCREENS-INVESTIGATE #16 J28; K5195; amends R3, R32)
- R61: (T51 fix round 10, live walk C/E; K5271) · (walk C C-B1, C-M8, C-M9, C-M10; walk E C1, H2)
- R62: (T51 fix round 10; K5292; walk E N2; amends R60)
- R63: (T51 fix round 10; K5292; re-walk C new 3)
- R64: (T51 fix round 10; DEC-438 (UX-DESIGN U480); K5299; walk E C2a, the alpha's design blocker; amends `standard`)
- R65: (T51 fix round 10; DEC-439, DEC-440, DEC-441; UX-DESIGN U481-U484; K5303) · (C-M9)
- R66: (T51 fix round 10; DEC-442 (UX-DESIGN U485); K5308; amends R64)
- R67: (T53; N1260; DEC-410 (1); DEC-447 (1)-(3); R12, R13, R18 there)
- R68: (T53; N1260; DEC-410 (2), DEC-411; DEC-447 "the stop"; K4403 (8), (9); amends R2, R18)
- R69: (T53; N1260; DEC-410 (2) "A chain you built", DEC-411; K1467, K1487, K4403 (8); amends R18)
- R70: (T53; N1260; DEC-410 "Chains that stop at a name the record lacks" (`screen.explore.all.stops`); DEC-447)
- R71: (T53; N1257; K5458; UX-DESIGN; amends R7, R59)
- R72: (T53; DEC-463; interface-shell R138; amends R34, R52)
- R73: (T53; DEC-474 (1); DEC-461)
- R74: (T53; JOURNEYS; changes R1, R32; answers R-69)
- R75: (T53; JOURNEYS; changes R32; answers R-70)
- R76: (T53; JOURNEYS; changes R12, R25; answers R-71)
- R77: (T53; JOURNEYS; changes R53, R32; answers R-72; Bob K5557 J4 option A: a person's page can add memberships and credentials)
- R78: (T53; JOURNEYS; changes R38; the owner half is in `people`; answers R-80)
- R79: (T53; JOURNEYS; changes R33, R49; answers R-81)
- R80: (T53; JOURNEYS; changes R33; answers R-83 (the hunch form))
- R81: (T53; JOURNEYS; changes R63, R34; answers R-85)
- R82: (T53; JOURNEYS; changes R4; answers R-75)
- R83: (T53; JOURNEYS; changes R4; answers R-76)
- R84: (T53; JOURNEYS; changes R17, R18; answers R-74)
- R85: (T53; JOURNEYS; changes R35; answers R-91, V-S3-27)
- R86: (T53; JOURNEYS; new; answers R-92)
- R87: (T53; JOURNEYS; changes R17; answers R-93)
- R88: (T53; JOURNEYS; changes R35; answers R-89; neighbour R-61)
- R89: (T53; JOURNEYS; new, but T52-74 carries it after W7 is green; answers R-84, screen half)
- R90: (T53; JOURNEYS; new; owner `screens-investigate` with `explore`; answers R-86)
- R91: (T53; JOURNEYS; changes R7, R54; answers R-79)
- R92: (T53; JOURNEYS; new; answers R-13; module not traced — the ties preview, `screens-settings` or `screens-investigate` R9, to be located by the job)
- R93: (T53; JOURNEYS R-40, `person` half; changes R26; K5571 (6))
