# Plan: the beta's build, round 2 · T53

**Status** · **PAUSED by Bob, 2026-10-30:** "Stop CS development while we assess the state of the neoprocess's health." No job, layer, round or lane starts until Bob lifts the pause; at the pause no job was running and the queue was empty (BOB #342). Written by BOB #336 (session_01RAN5epEXLXkbCvXFBvpYo6), 2026-10-30, the first round under neoProcess. It holds the work that remains of round 1 (`archive/T53-R1.md`, carried from `carried/T53` by `proc tranche carry`). Layers 1 to 4 closed in round 1. Of layer 5, 18 of 20 jobs merged; money and registers did not. Their branches stay on the remote, and the new jobs take them in. Layers 6 to 11 are carried whole, with the onboarding entries ONB-2 and ONB-3 placed (P19, PLN 3). The completion round is `T53-completion.md` (process flaw 3 in `process-issues/2026-10-30-bob336.md`).

**Legacy census** (PLN 8) · No module is legacy (`modules.json` carries no `from`; legacy-ui retired at T51, K4100).

**Reading an entry** · As in round 1: `first: settle X`, `[waits: X]` (an act or measurement), `[owed: X]` (BOB's at writing, or a point settled at START), `after X` (a same-layer dependency). `T53-n` is new; `C T52-n` is carried (its text in the rows file, from `carried-T52-R1.md`). A job reads its module's rows file whole at START: `build/plan/T53-R1/<module>.md`.

**Before each layer starts (BOB's acts)**
1. Every module whose own requirements are over the 40 KB reading set is pruned or split first (REQ 8, SES 4): 60 in layers 5 to 11.
2. `proc layer start` starts nothing on this product until the neoProcess lane fixes the reading-set measure (flaw 1, ibid.).
3. ONB-4: an R2 bucket for walk captures with a 30-day expiry, on account 20b533579290b9b93168345edd3b7f72, named in the manifest.
4. ONB-6: `.github/workflows/regression.yml` installs `site/`, so site's browser test imports `playwright-core`.
5. ONB-5 is an act of Bob's (the grants walkthrough, `build/GRANTS.md`), walked through in steps; nothing waits on it.

## Layer 5

**money**
- first: take in the round-1 job's branch `job/T53/money` (996730f4) by a merge. Its report is `build/jobs/T53/money.md`: R34, R36-R38 and R42 met; R39-R41's tests made real on that branch after local-facts merged. Then confirm every entry against the requirements as they stand.
- T53-154 · N1260 (DEC-409) · five money kinds, `moneyByParty`
- T53-155 · A2 · fiscal keys by the government's year
- T53-156 · K5471 (6) · JOURNEYS's defects: its rows
- T53-157 · K5565 · English in tests: its entry
- K5806 · BOB · R42's list of dimensions is R11's (wording fixed; a different source is no difference); `neighbours` asked with no `at` keeps `connection-grammar`'s registry rule (a null date is undetermined), unchanged
- K5812 · BOB (from the code at 996730f4, `build/plan/trims/money.settle.md`) · four defects the requirements as now stated refuse: F1 `reconcile` answers only `rounding` when amounts disagree across precisions (index.mjs:1077; rules.test.mjs:70-71): R11, R42 name `amount` with both values; F2 `parties` compares only entity or fund (index.mjs:1071): names as written differ too; F3 `createSet` takes any string as a trail's `concerns` and refuses a non-string `NO_LABEL` (index.mjs:1097-1099): R28's id checked, its own code; F4 `moneysets`, `moneyby`, `fiscalyears` are untested under `declaredOpHolds` (R27)
- rows: `build/plan/T53-R1/money.md`
**registers**
- first: take in the round-1 job's branch `job/T53/registers` (fd326eb: its code and tests, 4,204 lines). It waited only because its `tests` path was not yet on the tranche.
- T53-173 · N1259, K4403, K4405 · CAPABILITIES rows
- K5808 · BOB · the trim's ambiguities settled in the requirements (R2, R7, R8, R9, R11, R65, R66, Status, R73's heading)
- rows: `build/plan/T53-R1/registers.md`
**query-language**
- T53-622 · the independent audit (K5794) · the English regex sites at grammar.test.mjs:154-156 and :283 read by key, and the baseline lines its report said it removed (grammar.test.mjs 1, t33.test.mjs 2)
- rows: `build/plan/T53-R1/query-language.md`
**people**
- T53-623 · the independent audit (K5794) · identity.test.mjs:111's copied grade-C sentence read by `word(...)`, as in the grade B and D cases two lines away
- K5811 · BOB (from the code, `build/plan/trims/people.settle.md`) · F1 `listChecks` (index.mjs:1772-1778) is required by no line yet answers every check's condition, denominator and gate to any viewer not denied, and notice-producers (index.mjs:417) calls it: the job states it as an in-process read under R24's gate and R31's sight, or retires it with its caller's read moved to `checkResults`, and reports which; F2 `neighbours` sums the three identity kinds against `BOUNDS.hub` (index.mjs:1809-1827); R26 and `connection-grammar` R6 judge a hub per kind by `hubBoundOf(kind)`
- rows: `build/plan/T53-R1/people.md`
**events**
- T53-624 · the independent audit (K5794) · R60's test uses the walked standard's fixture and 200 captures, as its Test says (register.test.mjs uses synthetic captures only)
- K5809 · BOB (from the code, `build/plan/trims/events.settle.md`) · five defects the requirements as now stated refuse: F1 `sequence` treats an absent viewer as an administrator (index.mjs:1385; Terms: fail closed); F7 `usesOf` answers a use withdrawn by `withdrawEvent` (uses.mjs:228; R46 "Unwithdrawn", R61); F10 `vote_value_checked` worked out at read time (index.mjs:1069; R11: recorded as checked or not when written); F11 `eventsFor`, `statementsOf` drop events with no `when` under `from`/`to` (index.mjs:1181; R27, R29: listed apart); F12 `orderByWhen` compares only 25 neighbours each side (time.mjs:92; R29: every undetermined order shown)
- rows: `build/plan/T53-R1/events.md`
## Layer 6

**inquiry-grammar**
- T53-174 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/inquiry-grammar.md`
**leg-earning**
- T53-175 · A8 · typed passage's ceiling at its grain
- T53-176 · A1 · "no subject named" as a `why`
- T53-177 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/leg-earning.md`
**inquiry**
- T53-178 · A1 (DEC-457) · `setSubject`, `subjectHistory` `[UX need]`
- T53-179 · DEC-481 · each subject change answered with its record
- T53-180 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/inquiry.md`
**hypotheses**
- T53-181 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/hypotheses.md`
**steps**
- T53-182 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/steps.md`
**citation**
- T53-183 · A8 · typed passage citable; A4-R11 "the file says" (K5514)
- T53-184 · N1259, K4403 · CAPABILITIES rows
- T53-185 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/citation.md`
**basis-version-grammar**
- T53-186 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/basis-version-grammar.md`
**basis-versions**
- T53-187 · A5, A8 · ungraded and typed passages listed, labelled
- T53-188 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/basis-versions.md`
**strength**
- T53-189 · A8 · leg on a typed passage at its grade
- T53-190 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/strength.md`
**contradiction**
- T53-191 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/contradiction.md`
**run-rules**
- T53-192 · K5457 · bar per AI and part, `GATE_PART_OF`
- T53-193 · K5565 · English in tests: its entry
- T53-601 · observation-log's report (K5786) · its tests pin the C-22 set: add C-22.32 `OBSERVATION_FIELD_MALFORMED` and C-22.33 `OBSERVATION_FIELD_NOT_ALLOWED` (table.test.mjs R11, t46.test.mjs:120 R30)
- rows: `build/plan/T53-R1/run-rules.md`
**agent-harness**
- T53-194 · K5457 · `ROLE_NEEDS`, `needOf`, `partOf`
- rows: `build/plan/T53-R1/agent-harness.md`
**agent-model**
- T53-195 · K5457 · interface and Anthropic adapter `first: the interface`
- T53-196 · K5457 · OpenAI-compatible adapter, host profiles `[waits: live checks L2, L3]`
- T53-197 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/agent-model.md`
**ai-use**
- T53-198 · K5457 · neutral usage record, thresholds
- T53-199 · K5459 · members' use shown to a payer
- T53-200 · K5480 · `airetestset`
- T53-201 · K5480-K5487 · re-test cap, opt-in health counts
- T53-202 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/ai-use.md`
**ai-runs**
- T53-203 · K5457 · `principal_ai`, Gate 1 per part, segments, hops, ops
- T53-204 · N1219, DEC-466 · reads passed through, `airunparts`
- T53-205 · BOB · idem lines for `airunspawn`, `airunclose`, the ai-runs tick `[written: K5748: ai-runs R106]`
- T53-206 · K5565 · English in tests: its entry
- T53-602 · observation-log R40, R41 (K5786) · R99, R100 build on observation-log's writer and readers; `op=airunlog` serves the `read` and `disagree` columns; observation-log R40's fields name them
- T53-627 · agent-steps R56 (K5815) · R107: a tick's report entry keeps `produced_by`, checked as R72 and R104 check a label, served by `op=airunlog` (R100)
- rows: `build/plan/T53-R1/ai-runs.md`
**run-productions**
- T53-207 · K5571 · agent-steps R54's idem obligations get lines (6)
- T53-208 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/run-productions.md`
**capture-requests**
- T53-209 · K5574, K5575 · challenge or CAPTCHA recognised, refused, counted per host; her file matches the waiting request
- T53-210 · K5571 · agent-steps R54's idem obligations get lines (6)
- T53-211 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/capture-requests.md`
**reading-guides**
- T53-212 · N1257 · guides side by side per layer
- T53-213 · N1257, N858, K5508 · CAPABILITIES rows
- T53-214 · K5565 · English in tests: its entry
- T53-531 · jurisdictions R126 (N858) · check that the guide offer calls `attributionLacks` `[written: K5748: reading-guides R19]`
- rows: `build/plan/T53-R1/reading-guides.md`
**skills**
- T53-215 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/skills.md`
**question-explorer**
- T53-216 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/question-explorer.md`
**answers**
- T53-217 · K5565 · English in tests: its entry
- T53-548 · K5666 · `ASK_SCOPE` gains `aicredential`, as credentials' `AI_GRANT_OPS` (ai-accounts R65; scope.test.mjs R1)
- rows: `build/plan/T53-R1/answers.md`
**agent-steps**
- T53-218 · K5457 · entry by need, Gate 1 per part, `idem`
- T53-219 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/agent-steps.md`
**agent-runner**
- T53-220 · K5457 · Claude Code route retired `first: N1205's split`
- T53-221 · K5457 · Gate 1 test container `[waits: offline keys]`
- T53-222 · K5576 · R44-R60 `after ai-gate; after BOB moves agent-runner after ai-gate`
- T53-223 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/agent-runner.md`
**agent-worker**
- T53-224 · K5576 · `first: remove t47.test.mjs's import of agent-runner, drop the uses edge`; merges first in the AI group
- T53-225 · K5485 · beta offers every built part
- T53-226 · N1205 · the split off `/signin` and REMOTE `first: agent-model's interface`
- T53-227 · K5457 · entry by need, sealed key by `aicredential`
- T53-228 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/agent-worker.md`
**ai-gate**
- T53-229 · K5457 · Gate 1 suite and verdicts `[waits: Bob's pass marks]`
- T53-230 · K5457 · cost shown, consent, canaries
- T53-231 · K5457 · results bundle, `partsRefused` `[waits: ai-issuer]`
- T53-232 · K5482 · `combineResults`
- rows: `build/plan/T53-R1/ai-gate.md`
## Layer 7

**intent**
- T53-233 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/intent.md`
**investigation**
- T53-234 · N1272, K5445, K5496 · CAPABILITIES rows
- T53-235 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/investigation.md`
**reevaluation**
- T53-236 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/reevaluation.md`
## Layer 8

**case-grammar**
- T53-237 · A5, A8 · case-document `/10`, edition statements, credits
- T53-238 · N1259, K4403 · CAPABILITIES rows
- T53-239 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-grammar.md`
**corpus-export**
- T53-240 · K5441, K5443 · whole-record export by parts
- T53-241 · N1259, K1493 · CAPABILITIES rows
- T53-242 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/corpus-export.md`
**case-carriage**
- T53-243 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-carriage.md`
**case-tensions**
- T53-244 · K5571 · the typist's and checker's credit applied (content R64, citation R27)
- T53-245 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-tensions.md`
**publication**
- T53-246 · A5, A8 · case-document `/10`, edition statements, credits
- T53-247 · K5471 (6) · JOURNEYS's defects: its rows; its one row (R-96 owner half, retired publication R83) moved to docket T53-251 (K5816): nothing of it is publication's
- T53-248 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/publication.md`
**publish-schedule**
- T53-249 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/publish-schedule.md`
**docket**
- T53-250 · K5471 (6) · JOURNEYS's defects: its rows
- T53-251 · K5571 · publication R83 moves here, as docket R33 (JOURNEYS R-96 owner half, K5816)
- T53-252 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/docket.md`
**public-read**
- T53-253 · A5, A8 · case-document `/10`, edition statements, credits
- C T52-23
- T53-254 · N1259 · CAPABILITIES rows
- T53-255 · K5471 (6) · JOURNEYS's defects: its rows
- T53-256 · DEC-481 · `screen.published.subjectchanged.*`
- T53-257 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/public-read.md`
**network-notices**
- T53-258 · K5507, K5527 (6) · R23 prepares a submission, not the list
- T53-259 · N1110, K5507 · CAPABILITIES rows
- T53-260 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/network-notices.md`
**case-catalogue**
- T53-261 · A5, A8 · case-document `/10`, edition statements, credits
- T53-262 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-catalogue.md`
**ratification**
- T53-263 · A5 · refused only when statement missing
- C T52-24
- T53-264 · K5006 · reds: first settle, then fix
- T53-265 · K5565 · English in tests: its entry
- T53-628 · docket R33 (K5816) · ratifying an edition calls docket's `docketRecordEdition`, as docket R33 says "the module that ratifies an edition calls it" `[owed: BOB's requirement line and the `uses` edge to docket (earlier in the order) before START]`
- rows: `build/plan/T53-R1/ratification.md`
**case-checker**
- T53-266 · N1259 · CAPABILITIES rows
- T53-267 · DEC-482 · regenerate the case-checker bundle with the words (BOB)
- T53-268 · K5006 · reds: first settle, then fix
- T53-269 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-checker.md`
**case-import**
- T53-270 · A5, A8 · case-document `/10`, edition statements, credits
- T53-271 · K5471 (6) · JOURNEYS's defects: its rows
- T53-272 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-import.md`
**case-disclosures**
- T53-273 · A5, A8 · ungraded and typed passages listed, labelled
- C T52-25
- T53-274 · N1259, K1483, K1493 · CAPABILITIES rows
- T53-275 · DEC-480 · per-name mark on forwarded email names (`mailnameshow`, `mailnamewithhold`)
- T53-276 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-disclosures.md`
**case-account**
- T53-277 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-account.md`
**case-inputs**
- C T52-26
- T53-278 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-inputs.md`
**case-authoring**
- T53-279 · A5 · sign step lists ungraded passages
- C T52-27
- T53-280 · K5471 (6) · JOURNEYS's defects: its rows
- T53-281 · K4354, P15, P24 · the count of drafts Home reads
- T53-282 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-authoring.md`
**review**
- T53-283 · K5471 (6) · JOURNEYS's defects: its rows
- T53-284 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/review.md`
**case-check**
- C T52-28
- T53-285 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/case-check.md`
## Layer 9

**conformance**
- C T52-29
- T53-286 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/conformance.md`
**consequences**
- T53-287 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/consequences.md`
**action-grammar**
- T53-288 · CAPABILITIES · CAPABILITIES rows
- T53-289 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-grammar.md`
**action-records**
- T53-290 · CAPABILITIES · CAPABILITIES rows
- T53-291 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-records.md`
**actions**
- T53-292 · N1257 · R112 two laws, two clocks
- C T52-30
- T53-293 · N1257, K5458 · CAPABILITIES rows
- T53-294 · K5471 (6) · JOURNEYS's defects: its rows
- T53-295 · K5565 · English in tests: its entry
- T53-543 · K5650, jurisdictions R102 · `actionZone` reads `governingZone(ids, team, layer)`, not a profile's `time_zone`
- rows: `build/plan/T53-R1/actions.md`
**action-holds**
- T53-296 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-holds.md`
**action-clocks**
- T53-297 · N1257 · R27 layer a list comes from
- T53-298 · CAPABILITIES · CAPABILITIES rows
- T53-299 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-clocks.md`
**action-replies**
- rows: `build/plan/T53-R1/action-replies.md`
**filing-templates**
- T53-300 · N1257 · R36 places may name layers
- T53-301 · K5528 · `attributionLacks`, `second_approval` `[written: K5748: filing-templates R38]`
- T53-302 · K5528 · CAPABILITIES rows
- T53-303 · K5565 · English in tests: its entry
- T53-532 · jurisdictions R126 · R15 and R35 against R126 `[written: K5748: R15, R35 cite R126]`
- rows: `build/plan/T53-R1/filing-templates.md`
**filings**
- T53-304 · K5527 (4) · R29 template `sha` equals counted review
- C T52-31
- T53-305 · CAPABILITIES · CAPABILITIES rows
- T53-306 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/filings.md`
**escalation**
- T53-307 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/escalation.md`
**action-plans**
- C T52-32
- C T52-33
- T53-308 · K5571 · agent-steps R54's idem obligations get lines (6)
- T53-309 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-plans.md`
**plan-work**
- T53-310 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/plan-work.md`
## Layer 10

**monitoring**
- T53-311 · K4403 · CAPABILITIES rows
- T53-312 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/monitoring.md`
**following**
- T53-313 · N1259 · watch a number, a followed docket daily
- C T52-34
- T53-314 · N1259, K1484, K4403 · CAPABILITIES rows
- T53-315 · K5006 · reds: first settle, then fix
- T53-316 · K5565 · English in tests: its entry
- T53-577 · K5715, acquisition R130 · the store's `followStanding({follow, service})` answers whether a member still follows the case, for `keyedFetch`'s daily check
- rows: `build/plan/T53-R1/following.md`
**link-sweep**
- T53-317 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/link-sweep.md`
**scheduler**
- T53-561 · K5693, doorbell R30 · R35 calls `clearDiscarded`, `discardClearDue` and `discardClearWake`; while a hold is in place the wake instant stays past (the due read ignores holds)
- T53-318 · K4403, N824 · CAPABILITIES rows
- T53-319 · K5565 · English in tests: its entry
- T53-564 · mail-door R6 · the `mail-clear` consumer calls `clearWaitingMail`, `mailClearDue` and `mailClearWake`, as R35 does doorbell's
- rows: `build/plan/T53-R1/scheduler.md`
## Layer 11

**wizard-scripts**
- C T52-35
- C T52-36
- T53-320 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-321 · K5565 · English in tests: its entry
- T53-607 · money's report (K5786) · t47.test.mjs:143 names `money_flow`: read as money's five `money_*` kinds
- rows: `build/plan/T53-R1/wizard-scripts.md`
**op-grades**
- T53-559 · K5693, doorbell R31 · `inboxview` graded (a read)
- T53-322 · N1220 · AI ops declared with grade and class `[owed: "AI act" class, P1]`
- T53-323 · N1220 · every machine result labelled with its AI
- T53-324 · BOB · R57 AI op grades confirmed `[written: K5748: op-grades R57 checked against draft §4]`
- C T52-37
- C T52-38
- T53-325 · K4168, N824, N858 · CAPABILITIES rows
- T53-326 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-327 · K5565 · English in tests: its entry
- T53-565 · mail-door R12 · the member acts `mailaddress`, `mailwaiting`, `mailread`, `mailbringin`, `maildelete` graded from mail-door's `DECLARED_OPS`
- T53-604 · K5786 · grades for `eventwithdraw`, `moneyby` and `moneyfiscalyears`
- rows: `build/plan/T53-R1/op-grades.md`
**affordances**
- T53-328 · N1260 (DEC-447) · "Follow from here" in this module
- C T52-39
- T53-329 · K5471 (6) · JOURNEYS's defects: its rows
- T53-330 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-331 · K5565 · English in tests: its entry
- T53-605 · DEC-447 (moved from explore T53-163, K5786) · `followfrom`
- T53-606 · money's report (K5786) · `money_flow` in words.mjs:39 and :57, R72 and t48.test.mjs read as money's five `money_*` kinds; `moneyby` and `moneyfiscalyears` carried (t33 R12 R24)
- rows: `build/plan/T53-R1/affordances.md`
**tasks**
- C T52-40
- T53-332 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/tasks.md`
**machinery-producers**
- T53-333 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/machinery-producers.md`
**action-producers**
- T53-334 · CAPABILITIES · CAPABILITIES rows
- T53-335 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/action-producers.md`
**queue-producers**
- T53-336 · A6 (DEC-462) · one item per member for new keys
- T53-337 · N1257 · `place-profile-arrived` for any layer
- T53-338 · K5574, K5575 · hand-off: Queue item with the link; her file matched by address
- T53-339 · CAPABILITIES · CAPABILITIES rows
- T53-340 · K5571 · the same notices as reads it calls; owed lines
- T53-341 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/queue-producers.md`
**notice-producers**
- T53-342 · K4403 · CAPABILITIES rows
- T53-343 · K5571 · ai-accounts' and ai-use's notices to owners are reads it calls; owed lines (R45, R72, R75-R77, termsNoticesDue)
- T53-344 · K5565 · English in tests: its entry
- T53-549 · K5670, record-core R92 · read settings through `getSetting`, not its own SQL (index.mjs ~1595, 1600)
- T53-566 · mail-door R6 · the member told when unconfirmed mail is removed after 14 days: a notice per removed row's owner, read from `clearWaitingMail`'s answer (`owners`)
- rows: `build/plan/T53-R1/notice-producers.md`
**queue**
- T53-345 · K5480, K5478 · `retesting-off`, `ai-credits-stop`
- T53-346 · A6 · per-key choice of act passed through
- T53-347 · N1259 · CAPABILITIES rows
- T53-348 · K4354, P15, P24 · Home and Queue read kept counts, not whole lists
- T53-349 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/queue.md`
**translations**
- T53-350 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/translations.md`
**instance-setup**
- T53-351 · DEC-466 U5, K5471 (2) · AI gateway's two permissions `[first: settle "AI Gateway - Edit" or "Read", Secrets Store scope]`
- C T52-41
- T53-352 · N824, K5504, N1257 · CAPABILITIES rows
- T53-353 · K5565 · English in tests: its entry
- T53-544 · K5650, jurisdictions R14, R105 · `seeds.test.mjs:408` compares the unmatched bodies as a set; `setup.mjs:3052` copies `records_help` as a list
- ONB-2 · onboarding (`build/GRANTS.md` open rows; `next.md` ONB-2, placed here) · `setup.mjs:458`: the release address and the contact URL name `believeinoakland/bio`: they name `civicsmith/civicsmith`, while the old raw address keeps answering for copies already installed (it answered 200 on 29 Oct)
- rows: `build/plan/T53-R1/instance-setup.md`
**op-capabilities**
- T53-354 · K4168, N824, N858 · CAPABILITIES rows
- rows: `build/plan/T53-R1/op-capabilities.md`
**op-declarations**
- T53-558 · K5693, doorbell R31 · `inboxview` declared (a read, member session only)
- T53-556 · K5678, ai-accounts R35 and the ops K5457 retired · the tests of retired ops (R19, R20, R24, R30, R34, R41, R47, R68) re-pointed to the nineteen new ops, red on the tranche until then
- T53-355 · K4599 · `screenread`, budget class per op
- T53-356 · N1220 · AI ops declared with grade and class `[owed: "AI act" class, P1]`
- T53-357 · N1220 · every machine result labelled with its AI
- T53-358 · BOB · R90 AI op grades confirmed `[written: K5748: op-declarations R90 checked against draft §4]`
- C T52-42
- T53-359 · K4168, N824, N858 · CAPABILITIES rows
- T53-360 · K4354, P24 · `heldcaptures` out of each screen's first wave
- T53-361 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-362 · K5565 · English in tests: its entry
- T53-567 · mail-door R12 · mail-door's five member acts declared from its `DECLARED_OPS` (member session only)
- T53-603 · events R61, money R39-R40, calculations R53 (K5786) · rows for `eventwithdraw`, `moneyby` and `moneyfiscalyears`; the calculations family's `extra` becomes `{ spotcheckvisit: ["by"], calculationcreate: ["owner"], calculationevaluate: ["owner"] }`
- rows: `build/plan/T53-R1/op-declarations.md`
**admission**
- T53-363 · N1264 · `admit` in the room, parity
- C T52-43
- T53-364 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- rows: `build/plan/T53-R1/admission.md`
**answer-envelope**
- T53-365 · K4168, N824, N858 · CAPABILITIES rows
- T53-366 · K5565 · English in tests: its entry
- T53-563 · K5692, mail-door (C-157) · `families.mjs` registers family C-157 (mail-door's codes C-157.1-.9) so its refusals carry their envelope
- rows: `build/plan/T53-R1/answer-envelope.md`
**store-door**
- T53-553 · K5677, credentials R72 retired · `routes.test.mjs` calls `aiAccountsOf(ctx)` and reads `ai-accounts`' `AI_ACCOUNT_CHECKS`, never credentials' delegates or its `ACCOUNT_CHECKS` view
- T53-367 · N1264 · one RPC admits, stamps, runs
- C T52-44
- C T52-45
- T53-368 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-369 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/store-door.md`
**signin-door**
- T53-370 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-371 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/signin-door.md`
**store-assembly**
- T53-557 · K5693, doorbell R31 · `t42.test.mjs`'s `DOORBELL_METHODS` gains `inboxview: "inboxView"` (ten routes)
- T53-552 · K5677, credentials R72 retired · `ask.test.mjs` calls `aiAccountsOf(ctx)`, never credentials' R72 delegates
- C T52-46
- C T52-47
- T53-372 · N1259, N824 · CAPABILITIES rows
- T53-373 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-374 · K5565 · English in tests: its entry
- T53-534 · court-doctypes' finding · `wiring.mjs:28` registers the court API types
- T53-576 · K5705, file-safety R1, R60 · the `safe_view` job is registered for `.png`/`.jpg` names, as file-safety R1's name rule reads them
- T53-578 · K5715, capture R119 · `r9-jobs.test.mjs`:481 (R75 R2) uploads a 200 MiB file named `.pdf`, now `TOO_LARGE` under a document's 100 MB bound: its input is a kind with the archive bound (a `.zip`)
- T53-593 · connections' report (T53-587) · drop the plane's own `connections` project-reach registration (`assemble.mjs` R58, `wiring.mjs` `projectReachReaders`): `connections` now registers itself through `membership.registerProjectReach`, and a second registration is refused `LISTENER_DECLARED`
- rows: `build/plan/T53-R1/store-assembly.md`
**store-request**
- C T52-48
- T53-375 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-376 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/store-request.md`
**interface-shell**
- T53-555 · K5677, credentials R66 · the re-authentication prompt reads `ai.reauth.connect` (no provider named)
- T53-377 · N1220 · AI ops declared with grade and class `[owed: "AI act" class, P1]`
- T53-378 · N1220 · every machine result labelled with its AI
- T53-379 · K4599 · one `screenread` per screen
- T53-380 · A7 · one document-picker, two scopes
- T53-381 · N1260 (DEC-447) · "Follow from here" in this module
- C T52-49
- C T52-50
- C T52-51
- C T52-52
- C T52-53
- T53-382 · K5471 (6) · JOURNEYS's defects: its rows
- T53-383 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-384 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/interface-shell.md`
**screens-entry**
- C T52-54
- C T52-55
- C T52-56
- T53-385 · K5471 (6) · JOURNEYS's defects: its rows
- T53-386 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-387 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/screens-entry.md`
**screens-wizards**
- C T52-57
- T53-388 · K5471 (6) · JOURNEYS's defects: its rows
- T53-389 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/screens-wizards.md`
**screens-settings**
- T53-390 · N1257 (K5450) · places as a tree; install asks where work focuses
- T53-391 · K5444 (K5454) · level at install, gauge, outgrowing
- T53-392 · N1273 · region picker, move by export `[screen need to UX-DESIGN]`
- T53-393 · K5443 · whole-record import, the one way to move
- T53-394 · DEC-470 · `registerfileimport` key read by `keys.mjs`
- T53-395 · P9 (BOB #324) · `CONSENSUS_REQUIRED` clears a shown invite link · DEC-483
- T53-396 · K5562, K5563 · Members: founder's remove, endorsement, cancel · DEC-484, DEC-485
- T53-397 · N1220 · `connect`, `teamai`, `projectai` retired
- C T52-58
- T53-398 · N1257 · CAPABILITIES rows
- T53-399 · K5471 (6) · JOURNEYS's defects: its rows
- T53-400 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-401 · K5565 · English in tests: its entry
- T53-608 · local-facts' report (R29, K5786) · R45's test reads `factStatus` by the layer's path, as local-facts R29 now names it, not `factStatus({})` for `<package>/time_zone`
- rows: `build/plan/T53-R1/screens-settings.md`
**screens-ai**
- T53-402 · N1220 (DEC-420) · seven AI screens `[waits: UX-DESIGN's rows, B555]`
- T53-403 · DEC-465 · origin check, owner opt-in, `aiorderset`, `aikeyseal`
- T53-404 · DEC-466 · labels name the AI; Setup states
- T53-405 · K5459 · `aiusebymember`
- T53-406 · DEC-475, DEC-476 · results, health share, re-test, wait-then-switch
- T53-407 · BOB · a drawer for `aiuseovertime`'s bars `[written: K5748: screens-ai R15]`
- rows: `build/plan/T53-R1/screens-ai.md`
**screens-intake**
- T53-408 · N1269 (K5446) · largest file stated; over-limit refused, a way in
- T53-585 · PLATFORM P-29, P-30 (K5733, K5735) · after a failed upload or promote (a quick 5xx) the Add door says whether the file was kept (after a promote failure it is held, no document made) and offers a retry; today it names the fault only
- T53-409 · K5425 (b) · fixtures-run line 27 orphan: marker or delete
- T53-410 · A3, DEC-454-456 · R72, R73, display rows `[waits: design's row, r9-states R65]`
- T53-411 · K5574, K5575 · hand-off: Queue item with the link; her file matched by address
- C T52-59
- C T52-60
- C T52-61
- T53-412 · N1272, K5445, K5496 · CAPABILITIES rows
- T53-413 · K5471 (6) · JOURNEYS's defects: its rows
- T53-414 · K4354, P24 · `heldcaptures` out of Add's first wave
- T53-415 · K5006 · reds: first settle, then fix
- T53-416 · K5565 · English in tests: its entry
- T53-575 · K5705, file-safety R60 · `open-file.test.mjs` (F-B15) pins a PNG photograph as having no safe view: it now reads kind `picture` and `safeview?picture=1`, and the screen draws it
- rows: `build/plan/T53-R1/screens-intake.md`
**screens-daily**
- T53-417 · A6 · a line and two acts per key
- T53-418 · N1260 (DEC-447) · "Follow from here" in this module
- C T52-62
- C T52-63
- C T52-64
- C T52-65
- C T52-104
- T53-419 · N1260, N1272, K5495 · CAPABILITIES rows
- T53-420 · K5471 (6) · JOURNEYS's defects: its rows
- T53-421 · K4354, P24 · `heldcaptures` out of Home and Queue's first wave; Home reads kept counts
- T53-422 · K5006 · reds: first settle, then fix
- T53-423 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-424 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/screens-daily.md`
**screens-inquiry**
- T53-562 · K5698, provenance's word `provenance.testify.provenance_notes` · `document.mjs` (~176, ~1735) tells testimony by its English (`/Authored through op=testify/`): read provenance's own mark instead; `fr28-document.test.mjs:438`, `fr3-document.test.mjs:184` copy the sentence (the words check's testcopy 2, red until this entry)
- T53-425 · A1 · subject at opening and its change
- T53-426 · A7 · the pickers
- T53-427 · N1260 · "Follow from here" outside Document
- T53-428 · BOB · retire its `projectai` mention, follow screens-settings R9 (a CHANGE) `[written: K5748: R14, R37 retired, R153]`
- C T52-66
- C T52-67
- C T52-68
- C T52-69
- C T52-72
- C T52-73
- T53-429 · K5471 (6) · JOURNEYS's defects: its rows
- T53-430 · DEC-481 · "Who it is about" and the team's notes of each change
- T53-431 · K5006 · reds: first settle, then fix
- T53-432 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-433 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/screens-inquiry.md`
**screens-document**
- T53-434 · A3 · source line
- T53-435 · A8 · Cite on typed words
- T53-436 · N1260 · "Follow from here"
- T53-437 · DEC-454, DEC-467 · display rows; held, refused, converted
- T53-438 · DEC-474 · chips drawn on `ceiling`
- T53-439 · BOB · R1-R57 marked not yet met (T53), tests moved by its job `[written: K5748: screens-document R1-R57 marked]`
- C T52-66
- C T52-67
- C T52-70
- C T52-71
- C T52-72
- T53-440 · N1272, K5495, K5496 · CAPABILITIES rows
- T53-441 · K5471 (6) · JOURNEYS's defects: its rows
- T53-442 · DEC-479 (51) · `screen.document.text.unsure`, dotted marks and card
- T53-443 · K4354, P24 · `heldcaptures` out of Document's first wave
- T53-444 · K5006 · reds: first settle, then fix
- rows: `build/plan/T53-R1/screens-document.md`
**screens-investigate**
- T53-445 · N1260 (DEC-447) · "Follow from here" in this module
- T53-446 · A7 · document pickers
- C T52-74
- C T52-75
- C T52-76
- C T52-77
- T53-447 · N1257, N1259 · CAPABILITIES rows
- T53-448 · K5471 (6) · JOURNEYS's defects: its rows
- T53-449 · K5571 · R-40's `person` half (6)
- T53-450 · K5565 · English in tests: its entry
- T53-550 · K5671, promotion R53, R62 · `explore.mjs` (~218-239) sends a raw-id title and no project to promotion; send both as R53 asks
- rows: `build/plan/T53-R1/screens-investigate.md`
**screens-publish**
- T53-451 · A7 · document pickers
- T53-452 · A5 · signing step, published statement
- C T52-78
- C T52-79
- C T52-80
- T53-453 · K5471 (6) · JOURNEYS's defects: its rows
- T53-454 · DEC-479, DEC-480 · Inbox "Show it safely", receipt reorder; the ceremony's "Emails in this case"
- T53-455 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/screens-publish.md`
**screens-action**
- T53-456 · N1260 (DEC-447) · "Follow from here" in this module
- T53-457 · N1257 · `request` offers laws by `governs`
- C T52-81
- C T52-82
- C T52-83
- C T52-84
- T53-458 · N1257, N858 · CAPABILITIES rows
- T53-459 · K5471 (6) · JOURNEYS's defects: its rows
- T53-460 · K5565 · English in tests: its entry
- T53-533 · jurisdictions R105 (N1257, DEC-404) · `help-records.mjs` picks the chosen law's block
- T53-545 · K5650, jurisdictions R105 · `help-records.mjs:33-35` reads `view.records_help` as a list
- rows: `build/plan/T53-R1/screens-action.md`
**control-plane**
- T53-560 · K5693, doorbell R31 · routes `inboxview` to doorbell
- T53-554 · K5677, credentials R72 retired · `r53-routes.test.mjs` as T53-553
- T53-461 · N1264, K4599 · routes `screenread`, folded admission
- T53-462 · K5425 (b) · fixtures-run lines 23, 29 orphans: delete or name stand-in
- C T52-85
- C T52-86
- C T52-87
- C T52-88
- T53-463 · N1259, N824 · CAPABILITIES rows
- T53-464 · K5006 · reds: first settle, then fix
- T53-465 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-466 · K5565 · English in tests: its entry
- T53-536 · reader-container's report · the routing of `reader-container` as a fleet member
- T53-568 · mail-door R12 · routes the five member acts to mail-door (`mailDoorOps`)
- rows: `build/plan/T53-R1/control-plane.md`
**plane**
- T53-467 · N1264, K4599 · routes `screenread`, folded admission
- C T52-89
- C T52-90
- C T52-91
- T53-468 · N1259, N824 · CAPABILITIES rows
- T53-469 · K5438 · per-week counts kept per copy: record bytes, members at once, share of screens over class (PL26)
- T53-470 · K5565 · English in tests: its entry
- T53-546 · K5655 · `g41.probe.mjs` sizes its xlsx cases from `boundOf('xlsx', 'declared_text')` (25 MB), not 150,000/200,000 rows
- T53-569 · mail-door R12 and its composition note · composes `mailDoorOf(ctx, {capture, settings})`, `settings()` from instance-setup R114 (the mail domain and switch); the `email()` export waits on M1 (K5692 (3))
- T53-579 · K5715, acquisition R130, R136; capture R117 · wires `store.followStanding`, a `member` row's tick calling `fileMember(store, row.detail)`, and `emailCapture`'s attachments registered with `memberRow(...)`
- T53-584 · K5726, content R64 · composes content's `creditOf({member, row})` resolver from the module that holds the attribution levels (DEC-102), so a typed row names its typist only as credited
- rows: `build/plan/T53-R1/plane.md`
**installer-steps**
- T53-471 · N1257 (K5450) · places as a tree; install asks where work focuses
- T53-472 · K5444 (K5454) · level at install, gauge, outgrowing
- T53-473 · N1273 · region picker, move by export `[screen need to UX-DESIGN]`
- T53-474 · K5443 · whole-record import, the one way to move
- T53-475 · DEC-466 U5, K5471 (2) · AI gateway's two permissions `[first: settle "AI Gateway - Edit" or "Read", Secrets Store scope]`
- C T52-92
- T53-476 · K5471 (6) · JOURNEYS's defects: its rows
- T53-477 · K5571 · the refusal for runtime-limits R45 (R47)
- T53-478 · K5565 · English in tests: its entry
- ONB-2 · onboarding (`next.md` ONB-2, placed here) · `newgroup/src/steps/api.mjs:118-120`: the installer fetches `main` or the version tag from `believeinoakland/bio`: from `civicsmith/civicsmith`, as instance-setup ONB-2
- rows: `build/plan/T53-R1/installer-steps.md`
**installer**
- T53-479 · N1257 (K5450) · places as a tree; install asks where work focuses
- T53-480 · K5444 (K5454) · level at install, gauge, outgrowing
- T53-481 · N1273 · region picker, move by export `[screen need to UX-DESIGN]`
- T53-482 · K5443 · whole-record import, the one way to move
- T53-483 · DEC-466 U5, K5471 (2) · AI gateway's two permissions `[first: settle "AI Gateway - Edit" or "Read", Secrets Store scope]`
- T53-484 · K5471 (5) · read-only Logs scope `[first: Bob's act registering it]`
- T53-485 · N1265 · check and gate; R2 scopes `[written: K5748: installer R2, installer-steps R45]`
- C T52-93
- C T52-94
- C T52-95
- T53-486 · N1265, K5449, DEC-416 · CAPABILITIES rows
- T53-487 · K5565 · English in tests: its entry
- T53-535 · runtime-limits R38, PL25 · the copy declares `{design_stage, cf_plan}` in the shape `levelOf` reads
- rows: `build/plan/T53-R1/installer.md`
**site**
- C T52-96
- T53-488 · N1110 · CAPABILITIES rows
- T53-489 · K5471 (6) · JOURNEYS's defects: its rows
- T53-490 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/site.md`
**stewards**
- T53-491 · N1110, DEC-255, DEC-270 · CAPABILITIES rows
- T53-492 · K5565 · English in tests: its entry
- rows: `build/plan/T53-R1/stewards.md`
**ai-issuer**
- T53-493 · K5457 · serves catalogue, advisories, seal key `[waits: BOB's deploy to 20b5…7f72, tools; R18 retention]`
- T53-494 · K5482, K5487 · `airesultown`, `POST /ai/health`
- T53-551 · K5674 · the index at ai-catalogue's `CATALOGUE_ADDRESS`, payloads beneath it, in the shape its `receive` reads; reads `ADVISORY_REASONS` and `validatePayload` from ai-catalogue
- rows: `build/plan/T53-R1/ai-issuer.md`
**journey-check**
- T53-495 · N1260 (K4354) · act counter, 2 s assertion, Sewer Service Fund `[first: BOB's K lines for target files]`
- T53-496 · K4354 · budget walk 1280 and 390 px
- T53-497 · N1268 · acceptance corpus walk
- C T52-97
- C T52-98
- T53-498 · N1259, K4354, DEC-407 · CAPABILITIES rows
- T53-499 · K5457 · off the retired AI ops (FOLD-AI §2.8)
- T53-500 · K5565 · English in tests: its entry
- ONB-3 · onboarding (`next.md` ONB-3, placed here) · `run.mjs:31-33, 53-70, 306`: the live walk launches Chromium on the direct route; K4733 (`build/situations/deploy-and-walk.md`) requires the environment proxy unchanged
- rows: `build/plan/T53-R1/journey-check.md`
**load-check**
- T53-501 · N1274 · `runProfile`, `seedCopy`, `report`
- T53-590 · K5350, K5747 · `deploy-test.yml` refuses a copy without a store and never re-points the shared `agent-worker`; a fresh copy goes through the installer (`seedCopy`'s route)
- rows: `build/plan/T53-R1/load-check.md`

## Measurements

K5567: at once unless it measures R1's code; scratch copies are BOB's under K5120, never biosmoke8. **At once, alongside R1:** registers M-R3 (index storage at 73,043 / 1M / 5M rows, decides S1-S4 before registers' START), M-R7 (streaming, sets `REGISTER_STREAM_MAX`, `SLICE_*` before register-readers' START), M-R4, M-R8, M-R10, M-R11, M-R12, the federal zips BOB's download; PLATFORM: Levels 2-3 study S1-S4 (N1271 waits, K5570), S1 baseline and soak on plat-s1, per-table bytes, P-M17 and FILES' L1-L6 on the alpha's reader, budget walks of today's screens, S2 prototypes B and C, Enterprise quote, load test's short "before" run, Level 1's figures; preparation: N1257's F4, N1268's corpus files, M-N1272's files and Bob's blind gold set (K5537), N824 P1-P2 with M1 and P3 once Bob's Email Routing domain exists (N1159). **After the code it measures** (on a scratch copy, when its module merges): M-N1272 after extraction (L4); interpretation timings and the per-level ceiling (R119, K5535) after extraction and investigation; N824's door CPU at 25 MiB after mail-reader and mail-door; N1268's walk after journey-check and the readers; the registers journey after registers and its screen; PLATFORM's fold, combined-read and work-fix figures after PL12-PL14, per-type load after the readers (L1), the N1273 picker and `eu` rehearsal after the installer, the whole-record move at 1, 5, 25 GB after corpus-export and the import, Institution after N1271; the load test per level (N1274) and budget walk L2, L3 after load-check and layer 11's deploy. **No R3:** a defect found goes to its module's job, open until its layer closes (P10); a closed layer's goes to the completion round.

## Left out of T53 (P19)

CAPABILITIES' (`plan-T53-capabilities.md` §E, each with its hard reason): webhooks (paid), OpenFEC (bulk needs no key), OpenCorporates (Bob: never), assisted register acts (Bob, after the alpha), company officers' bulk import until its line, Form 700 and unmeasured registers, the listing desk, payment probe (Bob, K5449 B1), Tier 2 texts, court-petition templates (Bob: never), interpreting everything (K5445), K5458's unlisted names (outside its list). K5424 `noindex` stays until the 1.0 release is deployed (Bob, K5526). K5447 (B) over-limit partial read waits until proposals work well (K5445). N1270 audio, video, forum formats after 1.0 (Bob, K4628; held and named, K5436). K5454 Enterprise support: built with the first team that wants it, listed "not yet available" (PL29). FILES Tier 3 readers (PST/OST, Access): each by Bob's ruling when a real file is shown (K5437). N1267a XLSX by window: Bob has not decided; the beta keeps 250,000 cells (K4831 (10)).