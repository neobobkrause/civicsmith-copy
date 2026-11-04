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
