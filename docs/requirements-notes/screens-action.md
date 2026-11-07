# screens-action — requirements notes

Non-requirement text moved out of `build/requirements/screens-action.md` on 4 Nov 2026 (job screens-action, attempt 1, replacement session), kept verbatim, so that file holds requirement lines only (REQ-6, the 70,000-byte cap). Every **R** line and its mark stayed there; `bio-plane/test/m/screens-action/requirements-ids.test.mjs` pins the ids and unmet marks to the start commit's.

## Status (moved verbatim)

**Status** · New in T47 (T47-64; K657, K1043, K569, K3027 doubt 2): a module built fresh, layer 11 after `screens-publish`, last of the screen modules, before `control-plane` (N897 (1): the v0.2 constructs the design stream has drawn, `plan`, `start-send`, `request`, `action`, `matter`; `BIO_Action_v0_2.md` rules 1–3, 6, 15, 18–21; K608, K2780; DEC-89, DEC-113, DEC-115, DEC-194). Drafted in `build/plan/draft-T47-interface.md` §2.4, worded here by BOB (P5). No ids move. Not yet met (T47). Last changed T48 (T48-76: R11 new, amending R3, the prepared draft re-read on reload, N1034, `filings` R59; R12 new, amending R5, the action's project, title and pressure marks, N1035, `actions` R102, `action-holds` R16; R13 new, amending R1, "Ask the assistant for options" as a planning run, N1043, `action-plans` R51; K3145, K3149, K3195, K3207); marked not yet met (T48). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R14 new, the common line); marked not yet met (T48). Last changed T49 (T49-28: R15–R18 new; K3334); marked not yet met (T49). Last changed T50 (T50-80: R20–R23 new; Request records with no office known, the matter's stake at preparation, the records help from the profile, an action opens a question; N1182, N933, N1121, N1093; DEC-231, DEC-239, DEC-262); marked not yet met (T50). Last changed T50 (T50-80, the re-fold of DEC-320, BOB #205: R20, R21 and R22 amended in place; the no-office state drawn whole with `screen.request.nooffice.admin`, the stake lines on both screens and the question on `start-send` alone, the records help's none line `screen.help-records.notheld`; DEC-231, DEC-320; K3720); amended lines marked not yet met (T50). Last changed T51 (T51-122, BOB #210's L11 fold: R24 `actionnew`, the composer for an action of any kind (DEC-330 A68); R25 `plan` on a project in its three states (DEC-329 (6)); R26 asking about the silence as the design draws it, amending R23 (A71); R27 the read-only sentence (A13); R28 each action kind worded twice and a profile's own label (DEC-329 (5)); R29 the door from `request` to `actionnew`; R30 `dash-action` new; K3807, K3815; N1234, N1237; R24, R28 and R30 worded to DEC-335 and DEC-336, K3897: "Another kind", "Who", "Not determined yet", `refusal.ACTION_BASIS_REFUSED` and the dashboard's tile and column words keyed, "A named office or public body"); marked not yet met (T51). Fix round 6 (T51): R45 amended, the matter's pickers over held documents read every page and say when they show part (G20; S11). Last changed T53 (N1257, DEC-404, K5458: R60, R61 new, the laws that govern an office and the layer drawn; N858: R62 new, a guide's review said; JOURNEYS: R63–R81 new); marked not yet met (T53).

## Size (moved verbatim)

**Size (P6).** Estimated 2,400–3,000 lines with comments, its own keyed sentences included, measured at its START (M-T47-1, K617). (T51) 2,072 lines of source today (`bio-plane/src/screens-action/`); R24–R30 add roughly 700–1,000 (a composer, a dashboard, the plan's list), which stays under ~4,000; START re-measures it (M-T51-1).

## Block intros (moved verbatim)

Under "#### T51 (T51-122)":

Rules for the block. Each requirement follows the drawing (`SCR.actionnew`, `SCR.plan`, `SCR.action`, `SCR.request`, `SCR['dash-action']` in `mock-screens.js` at the START's design commit): its sections, its order, its states. A sentence is read by key (R19); a key that holds a sample fact and no placeholder is reported to BOB as missing (K3366), and the module draws no English in its place. Dates are drawn by `cs.date` (DEC-333; `interface-shell` R6).

Under "#### T51 fix round (FR-31)":

Each line is one of BOB's entries to this module (START B9; ids R36–R54 confirmed at B10). A sentence is read by key (R19) and a member-facing sentence the design has not written a row for is reported to BOB, never worded here. Every request these screens send is checked by `interface-shell` R104's harness against the owner's declared fields.

## Moved to screens-plan

4 Nov 2026 (PR 111, accepted by the coordinator): R1, R13, R15, R18, R25, R44, R53, R67, R68, R69 moved to `screens-plan` as its R1–R10, in that order. Each is retired in `build/requirements/screens-action.md` as `*(retired: moved to screens-plan:R<n>)*` and never reused. `bio-plane/test/m/screens-action/requirements-moved.test.mjs` checks both ends. The code (`plan.mjs`, `words-fix-plan.mjs`) stays here until `screens-plan`'s own job moves it.

## Uses

- `setup-words.word`, `setup-words.hasWord` (K3366, K3368): every member-facing sentence, by key.

- `interface-shell`: the kit `cs` and the screen contract (its R21), rows and the hold strip (its R19).
- `setup-words`: `WORD_ROWS` keys (the Action layer's words, DEC-194).
- `wizard-scripts`: `SCREEN_REGISTRY` (its R13, R31), in tests only.
- Through the plane: `action-plans` (`plan`, `planproposals`, the plan acts, `optionstartpreview`, `optionstart`), `plan-work` (`itemtakeup`), `filings` (`communicationprepare`, `filingprepare`, `filingapprove`, `filingsecondapprove`, `filingsent`), `actions` (`action`, `actioncreate`, `actionlaws`, `actionmove`, `actioncorrespond`, `addresseesuggest`), `action-records` (`actionscope`), `action-holds` (`actionhold`, `actionpressure`), `action-clocks` (`reminderset`), `conformance` (`determination`), `consequences` (`consequencesof`), `escalation` (the escalation acts and reads).
- (T48) Through the plane: `filings` (`filingread`, its R59; R11), `actions` (`action`'s `project` and `title`, its R102; R12), `action-holds` (`pressurefor`, its R16; R12), `action-plans` (`planask`, its R51; R13).
- (T51; R24–R30) Through the plane: `actions` (`actioncreate`, `actions` as its R30, `action`, `addresseesuggest`), `affordances` (`op=affordances`: `action_kind`, `action_kind_labels`, `action_basis_kinds`, `risk_tiers`; R4, R26, R68), `basis-versions` (`projectquestions`), `action-plans` (`plans`, its R7; `plan` for a started option's action), `action-clocks` and `action-replies` (the clock and replies an action states), `filings` (`filingsfor`, its R13), `queue` (`queue`, the member's items; R1, R12), `action-records` (`actioninquiry`, its R19). `filings` `approvedUnsent` (R53) and `action-plans` `checkpointsDue` (R17) are services with no op: not used (R30). The kit's strip, reading and read-only sentence (`interface-shell` R44, T51-113). No new `modules.json` edge.
- (T51, K4569; R3 join-first) Through the plane: `project-roster` (`projectlist`'s `participation`, its R34); the held row `refusal.PROJECT_ACT_NOT_A_PARTICIPANT` (`membership`). Tests (R-SEAM): `membership`, `project-roster` booted real (K4559).
- Tests only: `op-declarations` (`OPS`).
- (T53; R60, R61) Through the plane: `jurisdictions` (`governs`, its R106; `response`, its R96; the layer of a name, its R99, R121) and `actions` (`actionlaws` with `layer`, `actions` R113/R112); (R62) `reading-guides` (`procedureGuidesFor`, its R19, R20) and `jurisdictions` R125, R126 (a text's review). All in earlier modules.

## Invariants

None numbered here: `interface-shell` R23 and R24 (no place named; no log of who opened what) bind this module's screens as every screen's.

## Satisfies

- Registry screens `plan`, `start-send`, `request`, `action`, `matter` (`docs/development/ux-substrate/screens/registry.json` at `a0fab7abf0`; DEC-139); their drawings in `mock-screens.js` and `views/plan-page.html`, `views/start-and-send.html`, `views/matter-page.html` (ACTION_DESIGN #1) at that commit; N897 (1).
- (T51) K3807, K3815; DEC-329 (5), (6), DEC-330 (A13, A68, A71); DEC-335, DEC-336 (9) (R24, R28, R30); census-legacy-ui rows A13, A68, A71; N1234, N1237: R24–R30. The census's two lines (`request.mjs`:76 icon, `send-steps.mjs`:143 `role="group"`) are identifiers, recorded.
- `BIO_Action_v0_2.md` rules 1–3 (refusals first, a reason in place, a premise override stated: R2), 6 (one date, canon's question: R5), 15 (scope: R5), 18 (take-up, nobody assigned: R1), 19 (labelled drafts: R1, R3), 20, 21; DEC-115 (R2, R3); DEC-113 (R5); DEC-89 (R6); DEC-194 (the words); K608 (4) (R1).
- (T53) N1257, DEC-404, K5458 (R60, R61). N858, K5508–K5512 (R62). JOURNEYS R-117, R-119, R-120, R-118, R-113, R-125, R-112, R-78, R-68, R-26, R-67, R-77, R-63, R-114, R-121, R-128, R-129, R-127 (R63–R81); K5474, K5561; DEC-472 (7).

## Suggestions

- (T51) **Gaps for BOB at the fold** (none is a requirement of this module): (1) "whose move it is" (R30) is stated by no provider as one fact; BOB ruled it derived from the action's correspondence, `reply_owed`, unsent filings and due checkpoints; the two reads that would answer the last two, `approvedUnsent` and `checkpointsDue`, are no ops (R30), so BOB declares them in `op-declarations` or names another read; "replies to read" and "the plan's next step is ready" have no provider; Home's Action block and `interface-shell` R81 do not yet open `dash-action`; (2) `action-plans` R7 says `plansFor` lists plans "in id order" and does not state the row's fields (the code answers `id`, `project`, `title`, `state`, `opened_by`, `opened_at`): R25 needs them stated; (3) BOB ruled "A named office or person" as R9's arms (R24); the drawing's one "Who" field and R9's structured arms differ, and the drawing asks no `description` for a clock entry; (4) R23's "on success the new question opens" and the drawing's receipt-and-reference differ; R26 follows the drawing; (5) the `{noun}` fill of `shell.readonly` for each screen has no key (R27); (6) DEC-335 keyed `dash-action`'s four readings' labels, its "Every action" head and the columns "To", "Whose move", "The clock" and "Next", and `dash-project`'s tile labels and "Activity" head; still without a key are the readings' notes ("1 due this week", "due Friday", the day a reply came) and the table's first column head "Action" (`screens-inquiry` R79 holds `dash-project`'s); each is reported to BOB as a missing key and asked of UX-DESIGN (K3366; plan rule 10); (7) the registry still lists `actioninquiry` as `owed:actioninquiry DEC-239` and `actionstake` as `owed:actionstake K3230`; both ops are declared, so `wizard-scripts` registers them by their op names once its registry is regenerated.
- The screens' own sentences are held in `SCREEN_WORDS` (`screen.<id>.<part>`) from the mockups' English at `a0fab7abf0` until the design stream adopts them (DEC-198 (6)).
- `views/*.html` draw more than the registry lists for these screens (a plan's "Decline with reason" on picked options, a pressure record's "Open an inquiry"); only the registry's acts are drawn (`interface-shell` R21), the rest named back to the design stream (`draft-T47-interface.md` §3).

## Attempt 4 (T53, 7 Nov 2026): what was met, what was not, and why

Met and struck, each with its test: R60, R61, R73, R74, R76 (`t53-request.test.mjs`); R63, R64, R65, R66, R77, R79 (`t53-action.test.mjs`); R70, R72, R80, R81 (`t53-hold-dash-new.test.mjs`).

Left unmet, each for want of something outside this module's paths:

- **R62**: the read side is drawn (a profile guide not offered with what it lacks, "No profile text for this yet", "reviewed by", "last checked", "Not reviewed" with who and when). The opt-out offer to a team's sole member is not: `guideoptout` is declared by `reading-guides` but not in `op-declarations`' `OPS` nor in the shell's screen registry for `action`, so no screen may draw it. Owed: `op-declarations` (the op) and `interface-shell` (the registry row for `action`).
- **R75**: the recording sentence is drawn ("Recorded: you sent the notice in person on …"). The notice's own text (the project by its title, the time in the group's zone in words, no doubled full stop, the list in plain sentences) is assembled by `filings` R47 (`holdNoticePrepare`) and drawn here as the owner answers it; a screen rewriting the owner's text would be a second author. Owed: `filings`.
- **R78**: "Choose the office" is drawn from the start with the offices the team holds (`entitieskind`), a press with none known says so, and with none the sentence and the door to Request's add are drawn. The add itself cannot be drawn on `actionnew`: the shell's screen registry lists `entitycreate` for `request` and not for `actionnew` (`checkScreens` refuses it). Owed: `interface-shell` (the registry row), then a one-line change here.

Provider notices: filing-templates:712, filings:727, actions:715 and action-plans:726 confirmed over the real providers (`notice-t53.test.mjs`); this module imports none of the changed exports. Its adaptation is R60/R61's: the law list follows `governs` and `actionlaws` carries a law's `layer` only where two layers give it (actions R113). publication:632 (`renderingsByPixels` added) changes nothing here: no screen reads renderings; the matter tests' world (`world-A.mjs`) publishes its case through the real `publication`, and they pass with it (the R81 matter case in `t53-hold-dash-new.test.mjs` among them).

## Layer 11, job screens-action attempt 7 (7 Nov 2026)

- **Re-tested against op-declarations' new interface (PR 847, land 92f5416be9).** That change moved `aiaccountadd` and `aiaccountswitch` out of `ACT_HELP_ABSENT`'s unexplained ground and added instance-setup's `layersset`, `maildomainset`, `maildoorset` and `mailsetup` to it. None is an op this module draws or sends; `OPS` and `OP_ALIASES`, which this module reads, kept their shape. After the sync, the suite passes with no code change.
- **The move test after screens-matter PR 863.** screens-matter met R7 (moved from R71) and struck its mark. `requirements-moved.test.mjs` now accepts a moved id carrying its mark from here or no mark, never another.
