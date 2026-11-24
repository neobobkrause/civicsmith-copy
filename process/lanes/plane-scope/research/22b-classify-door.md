Length: 218 lines. Last section: "What I did not check".

# Plane scope research 22b: plane's door tests, classed by where they could run

Written 24 Nov 2026 by a worker of the plane-scope lane. It decides nothing. The set is the 46 `.test.mjs` files plane's `tests` names under `bio-plane/test/m/control-plane/` (group B of `02-test-map.md`, "control-plane 46"), 133 `test(...)` calls in all (round 8's 17 sit in control-plane's own section files `r8-seam-capture.mjs` and `r8-seam-misc.mjs`). Every claim carries one tag: [MEASURED] a command showed it, [READ] the code at the line named, [NOT CHECKED]. An inference is marked INFERENCE. Per-test data: `classify/22b.json` (one row per `test(...)`: file, test, line, owner requirement, class, the arms a test-side door would have to compose, whether it needs the UI, reason, the equivalent in control-plane's own 95 files, and the columns A (what is tested), B (why it loads plane now, need or convenience) and C (the route to rebuild it at control-plane)).

## Headline answers

1. **Counts, by test** [MEASURED: `gen2.py` over the 133 rows]: (a) 121, (b) 8, (c) "needs reconstruction" 3, (d) duplicate 1, (e) no route 0. Of the 121 in (a), 35 need nothing but control-plane's `makeFetch` over a real store from lower modules, 86 also need test-side hooks for one or more ops plane's `door.mjs` answers by an arm (`acquire`, `capture`, `caseratify`, `casedocument`, `publishedcase`, `knock`, `bootstrap`, `queue`, `monitor`, `pdfstructure`, `publishedbytes`, `verify`), and 16 of the 121 already drive the door over control-plane's fake store and need no change at all: they are plane's only because their file also holds a plane-booting test.
2. **By file**: 37 files are (a) throughout; 4 mix (a) and (b) (`r8-door-phases`, `t51-round5-press-seam`, `t51-round6-seam`, `t51-round7-seam`); 2 are (b) (`stats-capacity`, `t51-large-pdfs`); 2 need reconstruction (`limits`, `r8-wrap-entry`); `t51-hops` holds one duplicate and one test that needs reconstruction.
3. **Does any test genuinely need the assembled program?** No test in the set was found to need plane's own code for the behaviour it asserts, except two that assert plane's own output (`t51-hops` test 2 reads the `in-` metric plane's Store states, plane R78; `limits` compares with plane's `wrangler.jsonc`) and one whose subject is a wrapper of plane (`r8-wrap-entry`). Each has a route without plane (section 5); one was tried and is green.
4. **The UI.** 14 tests assert on screens booted over the door (`t46-e2e` 4, `t47-e2e` 3, `t51-bootstrap` 1, round 7's G60 pair, round 8's A1b, G108, G109 and F screen) [READ, rows]. Today they can run at control-plane (195), since the screens come earlier. Under the re-stacking (door below the UI), the door's tests may not import the UI. These 14 would then belong to the module that hands the UI to the door. 70 more use screen code only to make inputs (`CAPTURE_SCREEN.parts.promoteDocument`, `PARTS.sitting`, `PARTS.caseArgs`), which store-request's recipes make without the UI. 36 use no UI code.
5. **Samples proved** [MEASURED, section 6]. Four tests were moved on a scratch copy of `a26a8da2`. `r118-shared` and `r8-money-trail-hidden` are (a), run over `makeFetch` and store-request's world. `stats-capacity` is (b), run through a test-only Durable Object (`makeFetch` plus `assembleStore`) under Miniflare. `limits` is a (c) split. control-plane's whole set with the first two moved passed 567 of 567, and `p4 check control-plane` reported "no disagreement found". A runtime trace shows that none of the moved tests loads or reads any file of plane or of a later module.

## Method

- Base: scratch worktrees of `a26a8da2` under the session scratchpad (`base`, `move`), with each `node_modules` linked to the main checkout as research 07/08 did. Node 26.10.0, 4 CPUs, a machine shared with other workers; `/proc/loadavg` is given beside each timing.
- The set: `process/modules/plane.json` `tests` filtered to `bio-plane/test/m/control-plane/*.test.mjs` [MEASURED: 46]. Titles and lines were taken by a regular expression over each file, and round 8's from its two section files [MEASURED: 133].
- Each file was read: its header, its imports, how it boots (Miniflare on `src/plane/index.mjs`, the seam kit `r8-kit.mjs`, or the counting door `wrap-entry.mjs`), the ops it sends, and its assertions. Where a file holds several tests, each title was read, and the body was read where the class could differ (a time bar, a booted screen, a plane-stated header).
- Arm ops: `bio-plane/src/plane/door.mjs:39-131` [READ] lists the ops plane's hooks answer. A test's arm ops were found by a grep of its file for those op names and for the kit's `acquire`, `preparedEdition` and `sitAndSign` [MEASURED; a lead where an op name appears in prose].
- Equivalents in control-plane's own 95 files: a grep of each distinctive op or field over the 97 files control-plane's folder holds outside plane's list. Two of those 97, `t51-round9-seam` and `r131-gate`, are journey-check's by `13-upper-tests.md` [MEASURED, the token list is in the JSON's `owner_equivalent`]. An equivalent named there is a lead to the closest test. It was not compared assertion by assertion, except for `t51-hops` (section 4).
- Ownership: the tool's `ownerOf`, `loadModules` and `testFiles` (`/root/process4/.../tool/lib/config.mjs`, `scope.mjs`).

### The classes, as used here

The ARCH condition decides each class: a test moved to its owner may load only that module and earlier ones. It may not load plane, the door's assembly from plane, any later module, or a copy of any of them. A test-only harness built only from earlier modules is allowed.

- **(a)** It can run at control-plane as a plain Node test: `makeFetch` over a real store from lower modules (store-request's `storeWorld`, which is `assembleStore` over `node:sqlite` with a memory bucket and a pinned clock), as `r137-parity.test.mjs:30-35` already drives it [READ]. Background work runs on the world's `tick(ms)` (`store-assembly/world.mjs:296`) [READ]. For an op that plane's `door.mjs` answers by an arm, the test needs hooks composed from the arm owners' handlers. All of those owners come before control-plane. store-request's `door.mjs:439-471` already makes such a composition (`gatedArm`, not exported) [READ].
- **(b)** It needs the real runtime: an assertion's value depends on workerd. That means a time bar by the test's clock, a cold object, a restart, or the object's real `databaseSize`, which the Node world reports as 0 (`store-assembly/world.mjs:64`) [READ]. Such a test runs at control-plane under Miniflare through a test-only Durable Object built from earlier modules, as research 08 did.
- **(c) needs reconstruction**: as written, it loads plane, or a file of plane's, for something it asserts. Section 5 gives the route for each.
- **(d)** duplicate: another test asserts the same thing or more.
- **(e)** no route: none found.

## 1. Why these tests load plane today

All 46 files start plane's Worker under Miniflare, or one reads plane's `wrangler.jsonc` [READ]. They do it in one of three ways:
- by path in the file (16 files: for example `r100-upload.test.mjs:74-88`, `t51-round7-seam.test.mjs:45-60`);
- through the seam kit, `r8-kit.mjs:17` `const SRC = .../src/plane/index.mjs`, booted at `:293-311` (25 files);
- through the counting door, `wrap-entry.mjs:12` and `wrap-entry.worker.txt:17` `import plane, { Store as BaseStore } from "__PLANE__";` (5 files, and round 8's six Queue sections).

What they get from it is control-plane's own `makeFetch` handed plane's hooks (`plane/index.mjs:28-29`), and the Store plane builds with `assembleStore(ctx, env, {deliver: deliverOwedRender})` (`plane/store.mjs:37`) [READ]. Both the door and the store come before plane, so for the behaviour the tests assert, plane is a convenience. INFERENCE from the two reads: plane adds only its hooks' composition, its counted `object-calls` header (`plane/index.mjs:37-67`), the Store's `server-timing` (`store.mjs:93-97`) and its RPC and retirement code. Of these, only `t51-hops` test 2 asserts one (section 5).

## 2. The table, by file

Classes are counted by test. "arms" lists the ops a test-side door must compose. "UI": `asserts` means a screen is booted and asserted on; `inputs` means screen code only makes inputs; `no` means no UI code is used. The last column is the nearest test in control-plane's own 95 (a lead, see Method).

| file | requirement (first named) | tests | classes | arms | UI | nearest in control-plane's 95 |
|---|---|---|---|---|---|---|
| limits | installer R20 (N336): control-plane PLANE_LIMITS equals p... | 1 | c1 | - | no | none (grep PLANE_LIMITS in control-plane's 95: 0 files) |
| r10-caseratify-chain | ratification R60 (the door's caseratify chain depth <= 12) | 2 | a2 | casedocument, caseratify, publishedcase | inputs | none (caseratify only in r128-timing-desc-bytes, a different requir... |
| r100-upload | control-plane R100 (capture R92, extraction R1, R20) | 4 | a4 | capture | inputs | r123-reading.test.mjs (the door's read after an entry, fake store) |
| r117-held | control-plane R117 (extraction R80, acquisition R96) | 9 | a9 | - | inputs | r123-reading.test.mjs, t51-round5-door.test.mjs (readheldfor over t... |
| r118-shared | control-plane R118 (project-roster R42, review R43) | 2 | a2 | - | no | none (grep shared_drafts: 0 files) |
| r41-sweepset | control-plane R17, R29 (link-sweep R13-R15) | 2 | a2 | - | no | stamps.test.mjs stamps every gated op generically (stamps.test.mjs:... |
| r8-bootstrap-fanout | control-plane G118 (instance-setup partsReport cached for... | 2 | a2 | bootstrap | no | none |
| r8-caseratify-calls | control-plane G120, G121 (ratification, public-read) | 2 | a2 | casedocument, caseratify, publishedcase | inputs | none |
| r8-door-phases | control-plane R129 (G106) | 5 | a4 b1 | acquire | no | r8-phase-clock.test.mjs, t51-server-timing.test.mjs (timings over t... |
| r8-hops | control-plane G119 (object calls per frame op) | 3 | a3 | bootstrap, queue | no | none in control-plane's 95; t51-hops (plane's) holds looser ceilings |
| r8-money-trail-hidden | control-plane R17, R29 (money R12) | 1 | a1 | - | no | t51-routes.test.mjs names moneysets/moneyset routing over the fake ... |
| r8-words-door | control-plane R127 (G113, G114; translations R19, R20; in... | 2 | a2 | bootstrap | no | r8-words-cache.test.mjs (the door half over a hook, its header :1-5) |
| r8-wrap-entry | control-plane R-ONE (the counting door counts right) | 1 | c1 | - | no | none |
| stats-capacity | control-plane R40, G42 (L) | 1 | b1 | - | no | stats.test.mjs (the two stamps over the fake store) |
| t46-e2e | control-plane R75, R82, R83 (the served page end to end) | 4 | a4 | queue | asserts | t46-app.test.mjs, page-policy.test.mjs (routes and policy over the ... |
| t47-e2e | control-plane R81 | 3 | a3 | knock, queue | asserts | t47-door.test.mjs (the door's part over the fake store) |
| t51-bootstrap | control-plane R122 (the shell's and screens' bootstrap re... | 1 | a1 | bootstrap | asserts | none |
| t51-held-failed | control-plane R117 (C5b; extraction R80) | 1 | a1 | acquire, capture | inputs | r117-held.test.mjs tests 1-8 (plane's file, fake store) |
| t51-hops | control-plane R121 (E10); R125 (e) | 2 | c1 d1 | bootstrap, queue | no | none in control-plane's 95 |
| t51-large-pdfs | control-plane R120, R121 (C5a/P8) | 1 | b1 | acquire | inputs | t51-round5-door.test.mjs, t51-round6-door.test.mjs (deferral rules ... |
| t51-reading-follows | control-plane R123 (F1, F2, F6; plane R77, capture R103) | 3 | a3 | acquire, knock | inputs | r123-reading.test.mjs (its header names this file as the whole path) |
| t51-round10-seam-csvprose | control-plane R100 (csv-reader R26) | 1 | a1 | - | no | none |
| t51-round10-seam-htmlparts | control-plane R100, R120, R123 (reading-pipeline R1) | 1 | a1 | acquire | inputs | none |
| t51-round10-seam-imported | citation R18 (the door's author and viewer stamps) | 2 | a2 | - | no | stamps.test.mjs (generic stamps) |
| t51-round10-seam-observation | ratification R2 (promotion R28) | 2 | a2 | casedocument, caseratify | inputs | none |
| t51-round10-seam-publishcheck | control-plane R17, R29 (case-check R1) | 1 | a1 | casedocument | inputs | stamps-publish.test.mjs, r53-routes.test.mjs (publishcheck over the... |
| t51-round5-press-seam | control-plane R125 (b), R117 | 4 | a3 b1 | acquire | inputs | t51-round5-door.test.mjs (E2 over the fake store) |
| t51-round5-seam | control-plane R123, R125 (E1, E3, E5, E6) | 6 | a6 | acquire, knock, pdfstructure | inputs | t51-round5-door.test.mjs |
| t51-round6-seam | control-plane R105, R123, R124, R125 (G2, G5, G7, G13) | 7 | a4 b3 | acquire, queue | inputs | t51-round6-door.test.mjs (the same cases over a store that fails a ... |
| t51-round7-seam | control-plane R105, R123, R124 (G58-G79) | 18 | a17 b1 | acquire, casedocument, caseratify, publishedcase, queue, verify | asserts | none |
| t51-round8-seam | control-plane round 8 (G101-G116) | 17 | a17 | acquire, casedocument, queue | asserts | none |
| walk-calc-tabledeclare | control-plane R17, R29 (calculations R1, R51) | 1 | a1 | - | inputs | none |
| walk-cite-pdfpage-docx | control-plane R17, R29 (content R62) | 1 | a1 | - | inputs | none |
| walk-consequences-escalation-end | control-plane R17, R29 (consequences R27, escalation R14) | 1 | a1 | casedocument, caseratify | inputs | none |
| walk-contradiction-flag | control-plane R17, R29 (contradiction R61) | 1 | a1 | - | inputs | t51-contradictionflag.test.mjs (routing and stamps over the fake st... |
| walk-investigate-door | control-plane R17, R29 (events, law-relations, standards ... | 3 | a3 | - | inputs | none |
| walk-monitoring-checknow-adopt | control-plane R17, R29, R123 (monitoring R9, R79; reevalu... | 1 | a1 | acquire, monitor | inputs | t47-door.test.mjs names monitorset over the fake store |
| walk-people-door | control-plane R17, R29 (people R12, R21) | 2 | a2 | knock | inputs | none |
| walk-photo-step | control-plane R17, R29 (case-carriage R1, R8, R9, R13) | 3 | a3 | - | inputs | none |
| walk-provenance-authority-taskdecide | control-plane R17, R29 (provenance R80, tasks R20) | 1 | a1 | acquire | inputs | t51-taskdecide.test.mjs (the actor stamp over the fake store) |
| walk-publishcheck-held | control-plane R17, R29 (case-check R1; store-request R19) | 1 | a1 | - | inputs | stamps-publish.test.mjs (publishcheck stamps) |
| walk-selection-not-yours | control-plane R17, R29 (retrieval R99) | 1 | a1 | - | inputs | none |
| walk-standards-paywalled | control-plane R17, R29 (standards R41) | 1 | a1 | acquire | inputs | none |
| walk-tasks-filed-project | control-plane R17, R29 (tasks R1) | 1 | a1 | acquire | inputs | none |
| walk10b-docket | control-plane R17, R29 (docket R1, R4) | 2 | a2 | casedocument, caseratify | inputs | r48-routes.test.mjs (docket routing over the fake store) |
| walk10b-recreate | control-plane R17, R29 (case-disclosures R15) | 2 | a2 | casedocument, caseratify, publishedbytes | inputs | r48-routes / r49-routes.test.mjs (caseimport, casechecker routing) |

Notes on the table [READ unless tagged]:
- The UI column takes the strongest use in the file. In `t51-round7-seam` only G60 and its control assert screens (`:780-788`, the ceremony drawn); in round 8, only A1b, G108, G109 and the F screen do (`r8-seam-capture.mjs:16`, `:148-166`; `r8-seam-misc.mjs:53`). The rows give each test's own value.
- In the walk files, `inputs` means `promoteDocument` or `PARTS` called with the test's own `screenCall`. The kit's other helpers (`ownerOf`, `projectOf`, `person`) send ops and use no screen code (`r8-kit.mjs:117-142`).
- Most of the "nearest" files are the door half of the same requirement over a fake store. Those headers name the plane-held file as "the whole path" (for example `r123-reading.test.mjs:1-5`, `t51-round5-door.test.mjs:1-2`). So none is an equivalent of the whole path; each covers the door's own logic.

## 3. Why (a), (b) and (d), file by file in groups

**(a) with no arm, 35 tests.** These send only ops the door forwards generically: sign-in, `promote`, `projectlist`, `casedraft`, `reviewgrant`, `moneysetcreate`, `sweepset`, `tabledeclare`, `contradictionflag`, `select`, `cite`, `standarddeclare`, `findin`, `captureupload` and `reading`. The upload's reading is the door's own path, which `r100-upload.test.mjs:42-55` shows over `defaultHooks()`, where `gatedOp` declines (`harness.mjs:133-144`). Examples: `r118-shared.test.mjs:48-83`, `r8-money-trail-hidden.test.mjs:14-34`, `walk-selection-not-yours.test.mjs:13-46`, `t51-round10-seam-imported.test.mjs:24-38`.

**Already off plane, 16 tests.** `r100-upload` tests 1-3 (`:27-71`), `r117-held` tests 1-8 (`:31-188`), `r118-shared` test 1 (`:15-28`) and `r8-door-phases` tests 1-4 (`:43-112`) drive `makeFetch` over the harness's fake store, or the owner map over doubles. They load nothing of plane. They run in plane's job only because plane.json names their file.

**(a) with arms, 86 tests.** These need ops that plane's hooks answer:
- `acquire`, which goes through capture's `captureOp` with extraction's `acquireReadingOp` (`plane/door.mjs:92-108`; `capture/ops.mjs:280`);
- the published-case chain `casedocument`, `caseratify` and `publishedcase` (publication's, ratification's and public-read's doors);
- `knock` (doorbell), `bootstrap` (instance-setup's `bootstrapOp` through `publicOp`), `queue`, `monitor`, `pdfstructure`, `capture` (opening the original) and `verify`.

All the arms' owners come before control-plane, so a test-side hooks object built from their exported handlers loads nothing later. That composition is a hand-made copy of `plane/door.mjs`'s wiring, made from the arms' real code. INFERENCE: it meets the ARCH condition's words ("a test-only harness built only from earlier modules"). It also sits uneasily with K4990 (`build/rulings.md:4985`: "a test never hand-builds ... a stub of its interface"), since plane's hooks are the interface the door takes, and it would drift from plane's composition. Section 7 gives an alternative.

**Counting tests, 16 of the (a) rows.** `r10-caseratify-chain`, `r8-caseratify-calls`, `r8-hops`, `r8-words-door` and round 8's six Queue sections count calls through the counting door, which wraps plane (section 1). What they assert is a count, a peak or a depth of in-process events (`wrap-entry.mjs:20-72`, `readEvents`, `peak`, `depth`). A counter around the world's `STORE` stub and buckets can keep the same counts in Node. INFERENCE, not tried.

**(b), 8 tests.**
- `stats-capacity`: the real `dbBytes` (`stats-capacity.test.mjs:54-63`, against `world.mjs:64`).
- `r8-door-phases` test 5: a cold first capture under 15 s by the test's clock (`:135-146`).
- `t51-large-pdfs`: three PDFs each answered inside 15 s (`:4`, `:59`).
- `t51-round5-press-seam` "Read it" in under 2 s (`:136`).
- `t51-round6-seam` G5 within 15 s (`:154`), G2 in under 2 s at 0.7 MB/s (`:229`), and G2 at the clock, 11 s or less (`:268`).
- `t51-round7-seam` G63, in under 2 s after the plane's restart (`:223`, `:241`).

I put a time bar in (b) because its number was set for the runtime. INFERENCE: the same code in Node would be timed differently, so the bar would no longer mean the same thing. None of the eight needs plane's own code.

**(d), 1 test.** `t51-hops` test 1 (`:39-50`) holds ceilings for five ops (`:27`: whoami 1, projectlist 2, groupidentity 3, bootstrap 4, queue 2). `r8-hops`' targets for the administrator are the same numbers for the same five ops (`r8-hops.test.mjs:16-27`). `r8-hops` counts every call, while `t51-hops` counts one `do-` metric per distinct route (`t51-hops.test.mjs:46`; the counting door's header). So `r8-hops`' administrator test (`:47-53`) is the stricter of the two [READ; INFERENCE that it subsumes; the two were not run side by side].

`r8-caseratify-calls`' bar of depth 25 (`:41`) is implied by `r10-caseratify-chain`'s bar of 12 over the same events (`:26-27`). Its other assertions (the three reads issued together, a peak of at least 6) are its own, so it stays (a), not (d).

## 4. Equivalents in control-plane's own 95

No control-plane-owned file holds the whole path of any of the 46 [MEASURED, the grep of Method, and READ of the headers named]. What control-plane's own tests hold is the door's half of most of them over the fake store: `stamps.test.mjs` gives every gated op its stamps, generically (`stamps.test.mjs:12`, `GATED = Object.keys(OPS)...`); `t51-round5-door`, `t51-round6-door`, `r123-reading`, `r8-words-cache`, `r8-phase-clock`, `t51-server-timing`, `t46-app`, `page-policy`, `t47-door`, `t51-contradictionflag`, `t51-taskdecide`, `stats`, `r48-routes` and `r49-routes`. Many walk files catch a fault that neither half catches alone: a declaration's stamp form against what the owner's gate expects, such as `t51-round10-seam-publishcheck.test.mjs:1-4` and `r41-sweepset.test.mjs:1-4`. The real door and the real store are needed together for that. INFERENCE from those headers.

## 5. The three that need reconstruction (A, B, C)

**`limits.test.mjs`.**
- (A) installer R20 (N336): control-plane's `PLANE_LIMITS` is frozen, stated in one line, carried on `makeFetch`, and equal to `wrangler.jsonc`'s `limits`.
- (B) It reads `bio-plane/wrangler.jsonc` (`:12`). That file is plane's (196) by `ownerOf` [MEASURED]. This is a need of the comparison as written.
- (C) Split. control-plane keeps the constant's shape, its statement and its carriage, with no file read. The equality moves to plane's own `limits.test.mjs`: plane is later, so it may import control-plane's constant and read its own configuration. **TRIED**, section 6: green, and a mutation of `wrangler.jsonc` turns the plane half red. No re-stacking is needed.

**`r8-wrap-entry.test.mjs`.**
- (A) control-plane R-ONE: the counting door counts the Worker's calls to the object by route, as many as `Server-Timing`'s `do-` metrics, and the object's own R2 puts (`:32-58`).
- (B) Its subject is the counting door, a wrapper of plane's default export and a subclass of plane's Store (`wrap-entry.worker.txt:17`). That is a need as written.
- (C) Rebuild the counter around `makeFetch` and the store's stub in Node, counting the object's R2 by wrapping the bucket handed to store-request's world, or around `door-object-entry.mjs` under Miniflare. Its self-test then moves with it, and the 16 counting rows of section 3 use the new counter. No re-stacking is needed. NOT TRIED.

**`t51-hops.test.mjs` test 2.**
- (A) control-plane R121 and R125 (e): the door tells the object's own time as `in-<route>` beside `do-<route>` (`:52-58`).
- (B) The `in-` metric exists only when the object states `server-timing: object;dur`, and plane's Store states it (`plane/store.mjs:93-97`, plane R78). That is a need for the whole path.
- (C) Split; both halves exist already. The door's derivation over a store that states the header is control-plane's `t51-round5-door.test.mjs:201-207` (`in-projectlist;dur=7`) [READ]. The Store's statement is plane's `r78-timing.test.mjs:9` [READ]. What is left is the join (plane's header reaches the door), which is plane's to hold. The door's set can drop this test once plane holds the join. No re-stacking is needed.

No test was put in (e).

## 6. The samples, on a scratch copy

All on the `move` worktree of `a26a8da2`. Nothing was committed. **Correction (after the first reply):** the first diff, `move.patch` in the session scratchpad, was a plain `git diff`, so it left out the two new untracked files `real-door.mjs` and `door-object-entry.mjs`. The lane's re-run of it failed with ERR_MODULE_NOT_FOUND. The four moves were rebuilt on a fresh worktree of `a26a8da2`, and the two new files were marked with `git add -N` before the diff. The result is saved as `classify/22b-moves.patch` (9 files). On a second clean worktree [MEASURED], `git apply --check` and `git apply` succeeded. Each file then ran alone: `r118-shared` 2/2, `r8-money-trail-hidden` 1/1, `stats-capacity` 1/1, control-plane `limits` 1/1, plane `limits` 4/4. `p4 check control-plane` reported "no disagreement found". With `--test-force-exit`, plane's `limits` showed only 3 tests, because the process left before the test after its top-level `await import` was registered; without that flag all 4 ran and passed. Both worktrees were removed. The earlier `move.patch` was kept, which can be cleared, and the worktree was removed at the end. My first base worktree (`scratchpad/base`) disappeared during the work, while other workers shared the scratchpad. A second one, `base22b`, gave the base `p4 check plane`.

**What changed.**
- New `bio-plane/test/m/control-plane/real-door.mjs`, control-plane's: `storeWorld()` from store-request, its env with `STORE.get()` passing each request to `world.send`, and `makeFetch({})`. It was written after `r137-parity.test.mjs:30-35`.
- `r118-shared.test.mjs`: test 2 is rewritten over `realDoor()`. Its Miniflare boot, imports and `/api/?op=` strings are replaced; sign-in is the real door's `login`; the `assert`s are unchanged in text and value. The project's instant is taken from the world's pinned clock.
- `r8-money-trail-hidden.test.mjs`: rewritten over `realDoor()`. The members are made by the founder's `memberadd`, their `enroll` and their `login`, and the hidden project by `promote`, each sent through the real door with the kit's own bodies (`r8-kit.mjs:117-142`). Its five assertions are kept.
- New `door-object-entry.mjs`, control-plane's: `export class Store extends DurableObject` built with `assembleStore(ctx, env, {deliver: deliverOwedRender})`, `fetch` to `dispatch`, `alarm` to the scheduler, and `export default {fetch: makeFetch({})}`. control-plane's `uses` gains `scheduler` for it (see the checks below).
- `stats-capacity.test.mjs`: its `SRC` names that entry in place of `src/plane/index.mjs`. No assertion changed.
- `limits.test.mjs` is split as section 5 says, and a test is added to `plane/limits.test.mjs`.
- `process/modules/plane.json`: the four lines naming these files are removed, so control-plane's folder entry owns them by the longest match. Before: plane 147 test files, control-plane 95. After: 143 and 99 [MEASURED: `runmod.mjs ... list`, the tool's `testFiles`].

**Runs** [MEASURED].

| run | result | time | load (1-min) before / after |
|---|---|---|---|
| `r118-shared`, moved, alone | 2 of 2 | 1.66 s wall | 1.48 / 1.48 |
| `r118-shared`, original over plane, alone | 2 of 2 | 17.55 s wall | 1.44 / 2.03 |
| `r8-money-trail-hidden`, moved, alone | 1 of 1 | 1.59 s wall | 2.23 / 2.13 |
| control-plane's whole set by the tool's `runTests` (check, then one `node --test`) with these two moved, 97 files | `Check of control-plane: no disagreement found`; tests 567, pass 567, fail 0 | `node --test` 315.1 s; 374.6 s with the check | 4.29 / 8.09 |
| `stats-capacity`, moved (b), alone | 1 of 1 | 21.8 s wall | 6.96 / 7.14 |
| `stats-capacity`, original over plane, alone | 1 of 1 | 23.1 s wall | 6.60 / 6.18 |
| `limits` split: control-plane's and plane's `limits` together | 5 of 5 | | |

The whole-set run used the tool's own `loadModules`, `testFiles` and `runTests` (`/root/process4/.../tool/lib/scope.mjs:14`, `:74`) on the working tree. That is how research 07 reproduced the required run; `run scope` was not called, since it needs a commit. The 567 are base's 564 (`13-upper-tests.md` §1) plus the three moved. The machine was shared and loaded (1-minute load 4 to 13 during the run), so the times compare only roughly with `13-upper-tests.md`'s 284 s on GitHub.

**Checks on the final state (all four moves)** [MEASURED]:
- The first `p4 check control-plane` found 1 disagreement: `door-object-entry.mjs:8` "imports scheduler, which process/modules/control-plane.json does not declare in uses". With the alarm forwarder and its scheduler import removed, the check passed, but `stats-capacity` then failed (`memberadd ruth: STORE_DID_NOT_ANSWER`). INFERENCE: the assembled store sets an alarm, and workerd needs a handler for it.
- Fix: `scheduler` (152) was added to control-plane's declared `uses` (one line of `control-plane.json`, scratch) and the forwarder restored. `p4 check control-plane` then gave "no disagreement found" (exit 0, 41 s at load 6 to 7), and `stats-capacity` passed 1 of 1 in 19.0 s (load 3.7).
- `p4 check plane` on the final state: 48 disagreements, the same 48 lines as on base `a26a8da2` [MEASURED: `diff` of the two outputs' non-"cannot tell" lines is empty]. They are all in agent-worker's harness test types and come before this work.
- The five changed files run together (control-plane's `r118-shared`, `r8-money-trail-hidden`, `stats-capacity` and `limits`, and plane's `limits`): 9 of 9 pass, 19.3 s wall, load 3.51 / 3.00.
- The tool's `testFiles` on the final state: control-plane 99 files, plane 143.

**Mutation checks** [MEASURED, each reverted, `git status` after].
- `store-assembly/owner-ops.mjs:131` made to hand an empty answer for any page of projects: both `r118-shared` tests fail.
- money's fence (`money/index.mjs:1005-1006`) disabled: `r8-money-trail-hidden` fails with "max is answered as absent: {...found: true...}".
- `wrangler.jsonc`'s `subrequests` 10000 changed to 10001: plane's new `limits` test fails, and so does plane's own R13 test, which pins 10000.

**What the moved tests reach** [MEASURED: a preload recording Node's module loads and `fs` reads, then the tool's `ownerOf` over every repository path].
- `r118-shared`: 867 files, latest control-plane (195), none later.
- `r8-money-trail-hidden`: 865 files, latest control-plane, none later.
- `stats-capacity` (Node's side, including Miniflare's reads of the modules it hands workerd): 851 files, latest control-plane, none later. Before the plane.json edit the test file itself counted as plane's; after it, none.

The control-plane harness's leak of 16 later files through `register-declared.mjs` (`13-upper-tests.md` §6) does not occur in these three, since none imports `harness.mjs`. The folder listing was recorded as 0, which suggests the `readdirSync` patch did not take: see "What I did not check".

## 7. After a change

These are inferences for the lane. None is a finding about the code as it is.
- Most of the walk files assert an owner module's behaviour under the door's stamps. store-request's world door makes the same store requests as the real door for the seven op families `r137-parity` compares (`r137-parity.test.mjs:52-79`). So many walk files could sit below control-plane, at store-request (175) or at the screens part whose screen sends the op, over the world's door. Whether the world's door stamps every op these walks send as the real door does was not checked op by op.
- The arms: if the composition in `plane/door.mjs` (131 lines, no Durable Object code) moved to a module before control-plane, a control-plane test could import the real composition instead of re-making it. That would remove the K4990 tension in section 3. The two door trials (`15-trial-door-inversion.md`, `21-trial-combined.md`) already hand the door its parts from the top. This would be an order change and an interface change; neither was tried here.
- Under the re-stacking, the 14 tests that boot screens cannot be the door's. The 70 that use screen code for inputs could use store-request's recipes in its place.

## What I did not check

- control-plane's whole set was run only with the two (a) moves. With all four moves (and the `scheduler` use) there was only `p4 check control-plane` and the five changed files run together, not the whole set again.
- Whether adding `scheduler` to control-plane's declared uses is acceptable to the process, or whether the (b) entry should get the scheduler another way: not decided here.
- No baseline of control-plane's 95 files was run on this machine under the same load; the only comparison is the GitHub figure in 13.
- The real GitHub run and `p4 run scope`: the scope was built with the tool's functions on the working tree.
- 119 of the 121 tests in (a) were not moved. That they would run is an inference from their code. In particular, no test-side arm composition and no rebuilt counter was written. Whether Node's timings, streaming and multipart (the 40 to 52 MB uploads, the 9 MiB parts) behave as the assertions need was not run.
- Assertion-by-assertion comparison with control-plane's own tests was done only for `t51-hops` against `r8-hops`. The other "nearest" entries are greps and header reads.
- Owner modules' own tests (money, contradiction, people, link-sweep and the rest) were not searched for the walk cases.
- The runtime trace: the folder listing was recorded as 0 and may not have been hooked; reads inside workerd are not recorded; `statSync` and `existsSync` are not recorded.
- Mutation of the door's own part (a stamp dropped) for the money test was not tried; only the owner's fence was mutated.
- Flakiness: each moved test ran 1 to 3 times.
- The 16 "already off plane" tests were not re-run on their own.
