# op-declarations: requirements notes

## Split proposal (job op-declarations, attempt 1, 2026-11-04), for BOB

**Why moving text out can't work.** `build/requirements/op-declarations.md` is 126,484 bytes, and the cap is 70,000. Its 92 requirement lines (R1–R93, no R44; no F lines), kept word for word as the START requires, come to **71,521 bytes on their own**. That is over the cap before any heading, the Terms, or a test sub-bullet. Only R93 is marked `(not yet met: T53)`. Stripping each line's opening source bracket would save 4,937 bytes, but that is not word for word, and the file would still sit at about 66.6k plus headings, too close to the cap to hold. So the file has to split.

**Proposed split.** The break is by tranche. R1–R75 are the tables, the act gate, the invariants and the op specs of K921 through T50. R76–R93 are T51's browser acts and reads, the T51 fix round, and T53's combined read, budget classes, founder's acts and assistant ops. Together R76–R93 are 24,077 bytes of requirement lines.

- **New module `surface-declarations`** (layer 11) takes R76–R93, renumbered R1–R18. Each line says "was op-declarations R<n>", and the meaning does not change (the same precedent as K617/K624, by which `control-plane` R34 and R31 became this module's R1 and R6). It owns `BROWSER_ACTS`, `T51_SHARES`/`T51_FAMILIES`, the owners' declarations (`declared.mjs`, R80/R81), the screens' read waves and `screenread`, the `budget_class` rows, and the assistant's ops. It exports them as rows that `op-declarations` composes, the way it already composes `op-capabilities`' `needsRows()` into `NEEDS` (R3).
- **`op-declarations` keeps** R1–R75 with their ids. It gains a "Uses `surface-declarations`" line, and its R6 totality reads the composed rows. Expected size is about 47.4k of requirement lines plus headings and Terms, which leaves room under the cap.

**`build/modules.json`.** Insert this row between `op-capabilities` (line 165) and `op-declarations` (line 166):

```json
{"id": "surface-declarations", "layer": 11, "paths": ["bio-plane/src/surface-declarations/"], "tests": ["bio-plane/test/m/surface-declarations/"], "uses": ["setup-words", "test-support", "runtime-limits", "capture", "promotion", "basis-versions", "entities", "project-roster", "filing-templates", "standards", "calculations", "member-roster", "ai-use", "ai-runs", "ai-gate", "ai-catalogue", "notice-producers", "mail-door", "registers"]},
```

Then add `"surface-declarations"` to `op-declarations`' `uses`. Every owner listed above is already in `op-declarations`' uses. So that each one sits earlier in the order than the new row, check where the order places it; the new row must come after all of them.

**`build/layers.md`.** Add `surface-declarations` to layer 11's module list, just before `op-declarations`, and add this table row:

```
| surface-declarations | 11 | op-capabilities (before op-declarations) | T51's browser acts and reads, the screens' declared read waves and `screenread`, every op's and screen's budget class, and the assistant's and other lanes' ops; split from `op-declarations` by copy for size, meaning unchanged (R76–R93 → R1–R18); pure data like it (K617, K624, K651) |
```

**What the split costs.** The code moves out of `op-declarations/t51.mjs`, `declared.mjs` and the T51/T53 parts of `index.mjs`, and `t51.test.mjs`, `declared.test.mjs`, `fix3.test.mjs` and `browser.mjs` move with it. That is one job for `surface-declarations` plus a re-run of `op-declarations`' job to consolidate R1–R75 and answer the notices.

**Other choices, BOB's or Bob's.** (a) Let this file go over the cap. (b) Let each requirement line move its opening source bracket into these notes. That is not enough by itself (see above), but it would help if combined with moving the "Test:" sub-bullets out.

**Not done this attempt.** Following the START, I stopped at the cap. No requirement text was moved, and the provider notices `calculations:70`, `connections:71` and `membership:77` are not answered.

## Second split proposal (job op-declarations, attempt 2, 4 Nov 2026), for BOB

**Done on this branch.** R76–R93 are retired, each one line naming its new id (`surface-declarations:R1` to `:R18`). The Status history, Size, the K1396 settled readings, Satisfies, Suggestions, Open for Bob and Decided by BOB are moved here, verbatim (below). `bio-plane/test/m/op-declarations/requirements-ids.test.mjs` pins every id and unmet mark to the start commit (128357dd88c), checks every kept R line word for word, and checks that each retired id names its new id and that the new id's line in `surface-declarations` is the old line verbatim. The file is now **94,350 bytes**, down from 126,484.

**Why it is still over the cap.** Attempt 1 counted only the R lines. The specs under them are requirement text too: R1–R75's own lines are 46,424 bytes, and the indented specs under them (one bullet per op, with its classes, stamps, `NEEDS` row and the "R34 holds" and "R6 holds" lines) add 35,231 bytes. That is 81,655 bytes of requirement text before any heading. Moving the Uses lines out as well would still leave about 86 KB. Moving the op specs out of the file would leave R lines that point at nothing.

**Proposed split, along the code's own files.** The op specs of T45 to T50 already live in their own files, `t45.mjs` to `t50.mjs` (and their tests `t45.test.mjs` to `t50.test.mjs`), apart from `index.mjs` for size.

- **New module `op-specs-late`** (the name is BOB's to choose), layer 11, after `surface-declarations` and before `op-declarations`. It takes **R49–R75** (T45's to T50's specs, with T47's L11 fold) and the specs under them, renumbered R1–R27 in the order of their old ids, verbatim and with their marks (none is unmet). It also takes their section headings and the Uses lines tagged T45 to T50. That is 26,553 bytes of requirement text. Its code is `t45.mjs`–`t50.mjs`, and it exports the shares that `op-declarations`' `family()` merges today. Its job moves the code; this job does not.
- **R77** (T51's reads, 3,435 bytes with its specs) goes to `surface-declarations` as its R19. Its code is already in `t51.mjs`, which moves there.
- **What `op-declarations` keeps:** R1–R48 and the invariants R6 and R7. Simulated with R49–R75 and R77 retired one line each, the file is **66,747 bytes**. With the T45–T50 Uses lines gone too, it is about 64 KB, which leaves about 6 KB of room. Without R77's move it is 69,755 bytes, too close to the cap to hold.

**`build/modules.json`.** Insert after `surface-declarations` (line 168):

```json
{"id": "op-specs-late", "layer": 11, "paths": [], "tests": [], "uses": ["setup-words", "test-support", "op-capabilities", "progressions", "escalation", "explore", "answers", "following", "standards", "sources", "ai-runs", "ai-use", "ai-accounts", "inquiry", "capture-requests", "actions", "action-clocks", "action-holds", "action-replies", "action-plans", "action-records", "membership", "retrieval", "acquisition", "capture", "instance-setup", "case-authoring", "case-check", "citation", "plan-work", "filings", "conformance", "consequences", "project-roster", "local-facts", "connections"]},
```

These are the owners that R49–R75 and their Uses lines name, limited to those already in `op-declarations`' uses, so no new edge is added. `paths` and `tests` stay empty until its job merges (K1043). Add `"op-specs-late"` to `op-declarations`' uses.

**`build/layers.md`.** In layer 11's list, put `op-specs-late` right after `surface-declarations`, and add this row:

```
| op-specs-late | 11 | surface-declarations (before op-declarations) | The op specs of T45 to T50 (`t45.mjs`–`t50.mjs`); split from `op-declarations` by copy for size, meaning unchanged (R49–R75 → R1–R27); pure data like it (K617, K624, K651) |
```

The `surface-declarations` row would also note R77 → R19.

**Suite at this branch's head.** 242 of 252 pass. The 10 that fail are R19, R20, R24, R30, R34, R41, R47 and R68 tests that call `ai-accounts`' old interface, which its T53 rewrite removed. They are not caused by this branch, which changes no code, and no notice to this module names `ai-accounts`. They are in `t33.test.mjs` (2), `t34.test.mjs` (1), `t35.test.mjs` (2), `t36.test.mjs` (1), `t41.test.mjs` (1), `t42.test.mjs` (1) and `t48.test.mjs` (2).

**Not done.** The provider notices `calculations:70`, `connections:71` and `membership:77` wait until the split lands, since the specs they touch may move.

## Moved out of the requirements file (job op-declarations, attempt 2, 4 Nov 2026)

Verbatim, for the record; not requirements. R76–R93 are not here: they live in `build/requirements/surface-declarations.md` R1–R18.

### Status (from the head of the requirements file)

**Status** · In force: split from `control-plane` for size (K617, K624): R1 and R6 are its R34 and R31, moved with meaning unchanged; R2–R5 state, with ids, the tables its Terms defined. Last changed T35 (T35-70: R6, R21, R27 amended; R30 new; K1901, K1943; R6's `doorwindow`, K2038); every requirement met (OP-DECLARATIONS #12, K2054). Last changed T37 (T37-31, its first share: R35 new, `translationdraft`'s declaration with its `direction`; N669; K2200, K2201); the rest of T37-31's requirements are BOB's at its START; R35 marked not yet met (T37). T37-31's second share at its START: R21, R27, R34 amended, R36–R39 new (`subscriptionsignin`, the translation ops, `obscuremark` and `photomarks`, `setpassword`; N669, N701, N708, N757, N776; DEC-182); marked not yet met (T37). Last changed T38 (T38-15: R21 amended, R40 new; N788; DEC-183; K2300); marked not yet met (T38). Last changed T40 (T40-23: R41 new, N812's ops, `aiceilingset` and `aicopyceilingset` retired to `ailimitset`; R42 new, `handlecheck` and `handlechange`; N797, N799, N812; DEC-184, DEC-186; K2373, K2394); marked not yet met (T40). Last changed T41 (T41-58's text: R43 new, the investigation's ops; N820; K2405, K2417, K2418); marked not yet met (T41). Last changed T42 (T42-26: R47 new, `pagetranscribe`, and R34's `ACT_HELP_ABSENT` naming it; N832; K2611), not yet met. Last changed T42 (K2656: R47 re-worded to the merged interface; R48 new, `case-account` the owner of `accountpropose` and `accountdrafts`; R6 and R9 re-pointed to `doorbell`, wording only; N826, N832, N839; K2613, K2635), not yet met. Last changed T44 (T44-11: R47 amended, `pagetranscribe` served in the registry; N878; K2732), not yet met. Last changed T46 (T46-51: R50 new, `infolevelset` and `infolevel` specified, R34 holding; R51 new, `statusreportassist` an `ownread` in `plan-work`'s family, escalation's stop and reopening, the member-run door's op, `joindoors` and `textcheck` specified; R52 new, amending R21 and R27, the registry and the library read as PR #28 merged them; R53 new, amending R42, `handlechange` kept as a refusing op; N897, N920, N919, N654, N917, N937, N934; DEC-162, DEC-194, DEC-197; K2952, K2960); marked not yet met (T46). Last changed T47 (T47-53: R54 new, amending R21, R27, R34 and R52, the registry and the library read at PR #31's merge `a0fab7abf0`, clearing eight reds, N992, DEC-198, DEC-199; R55 new, the specs of `projectlist`, `projectquestions`, `drawquestion`, `projectbarset` and `monitorset`, N969, N972, N974–N977, N955; R56 new, `sourceof` and `sourcerung` in both session sets, N980); marked not yet met (T47). Citations re-pointed (K3038): R10's `case-authoring` R39 now cites `case-inputs` R6, R43's `actions` R73 `action-records` R3; wording only, no mark. Last changed T48 (T48-63: R64 new, the specs of `actionreplyquoting`, `proceedingdates` and `readtranslate` and `followregister`'s `proceeding`, N880, N882, N670; R65 new, amending R21, R27 and R60, the registry and library read at PR #34's merge, N847, N1054, DEC-227; R66 new, the update ops, N1047, DEC-226; R67 new, the ops T48's lower layers add, `aiuseovertime` beside `ailimits` among them, N1026, N1027, N1029, N1030, N1034, N1035, N1038, N1043; R68 new, amending R24, R33 and R41, the moved account ops an `ai-accounts` family, N996; R69 new, amending R5, the frozen tables built lazily, N1039; R70 new, amending R56, its control held at the door, N1045; K3101, K3149, K3150, K3189, K3190, K3192, K3195, K3197–K3207, K3211); marked not yet met (T48). N996's citation re-points (K3101) in R20, R24, R33, R36 and R41 are unmarked (K3038). Last changed T50 (L11 fold, BOB #201: R73 the 15 new ops, R74 gained request fields; K3643, K3627, K3637; re-checked, BOB #205: R73's `secondlookclear` help, R74 re-stated (`timeline`'s `captures` in the query or the body, K3672; no field refusal at the door), R75 new); marked not yet met (T50). Last changed T51 (L11 fold, BOB #210: R76 new, the seven browser acts DEC-330 draws, a class of their own; R77 new, the seven plane reads T51's lower layers add (and `projectlist`'s `after`), `heldat` with the member stamp `by`, `publishedfrozen` public; DEC-330 owed, U348, K3810, K3826, K3829, K3839, K3843, K3852, K3853); marked not yet met (T51). Last changed T51 fix round (FR-68, K4219, K3268; R14, R16, R19, R51, R73, R80 read as tests): the tests that name case-import's ops and member-roster's `expertisewithdraw` read them from their owners' `DECLARED_OPS`, registered by `test/m/op-declarations/register-owners.mjs` (R80); R73's owed acts are those no registered owner declares. Every owner is registered by `register-owners.mjs`, through test-support's `declaredOpsOf` (R16), so no test lists another module's ops (K3268, K4226); R82 new (K4227: `standardinforce` in both session sets), R83 new (K4237: `export` in the founder's set, with its `NEEDS` row); R80's and R73's tests read the owners' declarations; marked not yet met (T51 fix round). Last changed T53 (BOB's worker pass for #325: R84 new, the all-doors test of N858; R85 and R86 new, screens declare reads by wave and `screenread`; R87 new, every op and screen a budget class; R88 new, `heldcaptures` leaves the first wave; R89 new, the founder's acts; R90 new, the assistant's ops declared and the alpha's removed; R91 new, the budget classes of the ops other lanes add; R92 new, the grades and classes of the mail, interpretation and layer ops, owed and drafted from the recommendations); marked not yet met (T53).

### Size (P6)

**Size (P6).** About 2,110 lines move (`bio-plane/src/control-plane/ops.mjs` whole: `OPS`, the act lists, `SESSION_OPS`, `NEEDS`, `ACT_GATE`, `decorateAct`, `UNATTENDED_BY_DECISION`), most of it a table and its comments; about 150 written with the Action layer's specs (N-A12's share, N-A21). Well under the mark.

### Settled readings (K1396), from Provides

**Settled readings (K1396):** the readings of op-declarations's T31 question stand as K1396 states them; they bind this module's tests.

### Satisfies, Suggestions, Open for Bob, Decided by BOB (from the end of the requirements file)

### Satisfies

- `docs/architecture/BIO_Membership_Architecture_v2.md` §4.9 (governance acts are a named administrator's own session), §4.10 (the session ops), §5 (capabilities enforced at the op layer).
- `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md` §6 (the `ai` class admitted by its scope, never by a table row; D-199).
- `docs/architecture/BIO_Interaction_Constructs_v0_1.md` §P (an act published with the gate that admits it).
- `docs/architecture/BIO_Action_v0_1.md` (canon whole, K608): the Action layer's ops, each a member's act (§4).
- `BIO_Action_v0_2.md` rules 1, 18 and 19 (K2780; T45, N893): every op T45's owners serve declared, each member's act a session's, each machine draft labelled and proposed (R49).
- Bob's rulings K3 and K23; `layers.md` ruling 2 (declarations stay with the door, handlers move); K617, K624.
- DEC-152, DEC-153 (the assistant's two labelled drafts, their layer-11 share, K1837) and DEC-158 (4) (`baseupdates`): R29, R15; K1818 (T34-90–T34-92).
- (T35) DEC-167 and K1844, K1940 (ZIP archives; the co-archive setting, K1888): R30. DEC-144 (a member revises and deletes their own note): R30. DEC-164 ("Find in this"): R30. DEC-165 (the security screen): R30. DEC-146 (the credit page): R30. `plan/draft-T35-security-review.md` F14 (sign-out) and F3 (recovery under the sign-in window), K1881: R30. K1888 (recovery codes; two administrators): R30. K1901 (the registry as PR #12 left it): R21. N701, K1869 (3): R27.
- (T53) K4599, N1264, K4354, K5438, `combined-read-and-fold-draft.md` PL10, PL11, `time-budgets-draft.md` PL3, PL4: R85 to R88, R91. N858, K5460 (4), K5508 to K5512: R84. K5562, K5563, K5566, K5568: R89. N1220, K5457, K5482 to K5489, DEC-420, DEC-465, DEC-471, DEC-475: R90. N1259, N824, N1257, N1272: R92.

### Suggestions

- **Paths.** `bio-plane/src/op-declarations/index.mjs`, `ops.mjs`' content as it stands, exporting every name `ops.mjs` exports; tests in `bio-plane/test/m/op-declarations/`. `control-plane/ops.mjs` is left untouched by this job; `control-plane`'s job deletes it and re-exports what `legacy-index` (`src/index.mjs`: `decorateAct`, `ACT_GATE`) and its own files import.
- **The comments that cite `src/control-plane/ops.mjs`** (in `UNATTENDED_BY_DECISION`'s citations) keep their words: a citation names where the decision was recorded, not where the table lives now.
- **Tests.** R1 as `control-plane`'s R34 tests read it today (moved and renamed); R2's no-`ai` row and R3's "no unattended op without a citation" structurally over the tables; R4 every listed op in `OPS`; R6 against the store routes and handlers the door serves (the door's route map is `control-plane`'s, so the totality arm reads it from `control-plane` as `legacy-tests` does, or `control-plane` keeps a test of its own that names this R through its use).
- **T35 (T35-70).** `adminrecoverystep` and `agentpack` are this draft's names (`instance-setup` R66; `control-plane` R41). R30's ops go in their owners' families as T34's did (`acquisition`'s ops may sit in `capture`'s family, which passes them through, the job's choice). The `t34.test.mjs`:64 and :129 cases follow R21 as amended (red 9). A HANDOFF to UX-DESIGN asks the registry to drop its stale `owed:placewanted` mark; R21 reads it as served either way.
- **For callers.** A module that gains an op asks BOB to add its spec here, one reviewable table (`control-plane`'s Suggestions, "Declarations stay, handlers move").

## Open for Bob

None: the split is BOB's (K617, K624).

## Decided by BOB (for rulings)

- The seam (K624 (2)): what each op is (`ops.mjs`) here; who may call it (`admission`); the door (`control-plane`). The Rs that state a gate's refusal go with the gate (`admission`), and this module's tables are what those gates read.

## T53 member ops named under ACT_HELP_ABSENT (BOB's ruling, 4 Nov 2026)

On BOB's ruling of 4 Nov, this job named under R34's grounds the 48 member ops that owners declare on tranche with no `ACT_HELP` text yet. Each read is under the read ground and each act under the unexplained ground. The three that had no spec now have rows (`t53-rows.test.mjs`): `eventwithdraw` (events R61, an open act), `moneyfiscalyears` (money R39, R40, a read) and `federaloffices` (entities R68, a read for a member's session). Each leaves its ground once `affordances`' `ACT_HELP` holds its text. These are the lines that should later give the ops their words:

- `adminproposalcancel` (act) and `adminremovals` (read): `surface-declarations` R14 (an `ACT_HELP` text for the act), `member-roster` R89, R91; `screens-settings` R92, R93.
- The assistant's acts (`aiaccountadd`, `aiownadd`, `aiaccountremove`, `aiaccountswitch`, `aiorderset`, `aiprojectorder`, `aimemberallow`, `aiprojectuse`, `aimineuse`, `aicheckset`, `aiprojectcheckset`, `aimycheckset`, `aikeyenter`, `aikeycloudflare`, `aikeyseal`, `aitermsaccept`, `aitermswithdraw`, `aipersonalchoose`, `aicreditsclear`, `aisend`, `aioptinset`): `surface-declarations` R15, R18; `ai-accounts`' T53 lines; `affordances`.
- The mail door's ops (`mailaddress`, `mailbringin`, `maildelete` acts; `mailwaiting`, `mailread`, `mailtally` reads): `surface-declarations` R17 (1); `mail-door`.
- The layer entries and reports (`layerentrydraft`, `layerentryconfirm`, `layerentrywithdraw`, `layerreport`, `layerreportcarry` acts; `layerentries`, `layerreports` reads): `surface-declarations` R17; their owner's T53 lines.
- `eventwithdraw` (act): events R61; grades T53-604.
- Reads: `previewmore`, `inboxview`, `ruleresolve`, `standardsbinding`, `fiscalyears`, `moneyby`, `moneyfiscalyears` (T53-604 grades), `federaloffices` (entities R68), `exploreall`, `explorepath`, `exploreshorter`, `explorecontinue` (`surface-declarations` R16, the explore class): `surface-declarations` R17 for the other lanes' ops; `affordances` for the texts.

## T53: ai-accounts' old door retired (R20, R24, R30, R41 restated; BOB, 4 Nov)

BOB ruled option (b): `ai-accounts` R35 retires the old door ops with no aliases, so this module's declarations follow T53's
op set. The 17 retired ops (`accountreferenceset`, `accountreferenceremove`, `accountreference`, `groupkeyset`,
`groupkeyremove`, `groupkeyswitch`, `groupkeystate`, `groupkeynotice`, `groupkeynoticeseen`, `subscriptiondisconnect`,
`projectkeyset`, `projectsigninset`, `projectaccountremove`, `projectaccountswitch`, `projectaccountstate`,
`projectkeynotice`, `projectkeynoticeseen`) have no spec and are in no table. ai-accounts' family is its map's 36 ops:
the 7 kept, 5 owners' reads (`accountstate`, `accountsof`, `aichecks`, `aioffered`, `personalchoice`), the Worker's 3
plane ops (`aicredential` a setting read stamped `by` alone, `aigatewayserved` and `aicredentialfailed` acts any credential
reaches at admission, the owner refusing every principal but the Worker's, R65 to R67) and the 21 acts ai-accounts
declares (R61, R71), named in the family so they are stamped `by` (a declaration with no `stamps` is stamped the viewer
alone, and every one of those arms reads `by`).

Named back to BOB (R21: a function its owner serves through no op has no spec):
- the live screen registry (`wizard-scripts`' `SCREEN_REGISTRY`) still draws retired ops: `groupkeyset` and
  `groupkeyswitch` (setup, teamai), `groupkeyremove` (teamai), `groupkeynoticeseen`, `accountreferenceset`,
  `accountreferenceremove` and `subscriptiondisconnect` (connect), `projectkeyset` (queue, projectai), `projectsigninset`,
  `projectaccountswitch`, `projectaccountremove` and `projectkeynoticeseen` (projectai). The screens library's steps name
  `groupkeyset`, `accountreferenceset` and `subscriptiondisconnect`. Those screens and steps are not this module's.
- `REAUTH_ACTS` no longer names `accountreferenceset`, `groupkeyset`, `projectkeyset` or `projectsigninset`. Which of
  ai-accounts' T53 credential acts (`aiaccountadd`, `aiownadd`, `aikeyseal`, `aikeyenter`, `aipersonalchoose`) should ask
  the password again is not decided (op-specs-late R6 to R15, was R58 to R63).
- The Worker's plane ops sit in both session sets (their kinds put them there), so a member's session reaches ai-accounts,
  which refuses it `AI_CREDENTIAL_NOT_SERVED`. `aigatewayserved` and `aicredentialfailed` are not on `AI_GRANT_OPS`.
- Four ai-use ops the tranche added with no spec were declared for R19's census, as BOB ruled for T53's other rows:
  `aiusebymember` (ai-use R27) and `aihealthpreview` (R33), owners' reads; `airetestset` (R28) and `aihealthset` (R32),
  administrators' acts.

## Layer 11, job op-declarations attempt 6 (7 Nov 2026)

- **F2 met.** On layer/11, five member ops had neither an `ACT_HELP` text nor a ground: ai-use F3's `aibudgetset` and `aiprojectbudget`, extraction's `interpretmark` and `interpretationwithdraw`, and instance-setup R115's `assistantreadiness`. The four acts take the unexplained ground and the read the read ground, until `affordances`' `ACT_HELP` holds their text. This turns green R34 (t36), R47/R34 (t42) and the ai-use:105 notice. Test: `layer11-act-help.test.mjs`. The design stream still owes texts for all five.
- **F3 (BD-1).** `exportwhole` and `exportwholepart` are declared now that op-capabilities F1 (PR 752) holds their present-null rows. The hand-written row count goes from 323 to 325 (t49, tables census). This module adds no `FOUNDER_SESSION_NEEDS` row for them. Test: `bd1-exportwhole.test.mjs`. corpus-export still keeps `wholeExportOps` out of the plane's map, so the door does not serve them until corpus-export spreads it (its own job).
- **Provider notices confirmed, no code change.** filing-templates:712, actions:715, action-plans:726, filings:727, following:744, investigation:628, publication:632, case-import:635, public-read:642, case-carriage:658, case-authoring:681, action-records:696 and affordances:374 are confirmed with no change here. Every op each declares has a spec, and its classes, mutating flag and stamps agree with the tables. Every member op each serves is explained or named under one ground. The existing suite already holds this: t33 checks each served map's totality, with its in-process routes; tables.test.mjs and the declared tests check the declared rows; t36 and t42 check R34's partition. The gate's revert check refuses a test that only confirms, because it passes with this module's change reverted, so I added no confirmation-only test.

## Layer 11, job op-declarations attempt 7 (7 Nov 2026)

- **R34 after affordances PR 808.** `ACT_HELP` now explains `aiaccountadd` and `aiaccountswitch`, so both leave `ACT_HELP_ABSENT`'s unexplained ground (t36, t42, t50 were red with both explained and named).
- **instance-setup's new ops.** `layersset`, `maildomainset` and `maildoorset` (its R107, R114) are administrator acts and `mailsetup` a read. All four reach `OPS` and both session sets from instance-setup's own `DECLARED_OPS` (R6). None has an `ACT_HELP` text yet, so the three acts take the unexplained ground and `mailsetup` the read ground (layer11-act-help, t36).
- **The move test after surface-declarations landed (d9a45aba8).** surface-declarations struck the marks on R10, R12, R16 and R18 (op-declarations' R85, R87, R91, R93) and reworded R11's mark. `requirements-ids.test.mjs` now compares a moved line with its mark removed, against the start line with its mark removed. A moved id's mark must be the start mark or struck, never another mark. Text changes outside the mark are still caught.
- **Provider notices filing-templates:712, actions:715, action-plans:726, filings:727 confirmed, no code change.** None of them adds, renames or retires an op. action-plans:726's `idem` and `produced_by` are body fields of `optionpropose` and reach `optionPropose` through action-plans' own map. Test: `notice-layer11-providers.test.mjs`.
