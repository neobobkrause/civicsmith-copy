Length: 223 lines. Last section: "What I did not check".

# 22a. Plane's group A2 and group D tests, classified by owner

Written 24 Nov 2026 by a research worker for the plane-scope lane. This was read-only research. Nothing changed in the main tree except this file and `classify/22a.json`. Every change was made in three scratch worktrees of `a26a8da2` (`wt-a`, `wt-b`, `wt-c`, all under the session scratchpad, with `node_modules` symlinked). A local commit was made in `wt-a` and `wt-b` only because `run scope` reads `HEAD`. Nothing was pushed. The worktrees were removed at the end. The test list is research 02's: group A2 has 27 `.test.mjs` files and group D has 7 (`02-test-map.md`, "Grouped counts").

Classes, as the brief and the lane's later message define them:

- **a**: the test can run at its owner as a plain Node test over real lower modules.
- **b**: the test needs workerd but not the assembled program. It can run at its owner (or at the earliest module that holds the behaviour) through a test-only Durable Object or Worker built from earlier modules.
- **needs reconstruction**: this was class (c). As written, the test loads plane or a later module. For each such test I record A (what is tested), B (why it loads plane) and C (the route back to its owner).
- **d**: the test duplicates an owner's test.
- **e**: no route found.

ARCH's condition applies to every class. A moved test may load only its owner and modules before the owner. It may not load plane, the door's assembly, any later module, or a copy of any of them. `p4 check <owner>` is the judge.

## Headline

- **Counts** [MEASURED: `node mkjson.mjs` over the 34 rows printed `34 {"a":12,"b":10,"d":1,"needs-reconstruction":11}`]: a 12, b 10, needs reconstruction 11, d 1, e 0.
- **No test needs the re-stacking** (door below the UI) to be reconstructed. INFERENCE from the C routes below: each route uses a module earlier than the owner, a published fixture, a split of the rule from a residue, or a contract check placed at the provider. Three routes need a different change:
  - r8-wave needs the door's arms to be handed over by their owners, not by plane's `door.mjs`. Plane R6 already foresees this.
  - migrate-released needs ARCH's decision changed, because the decision names plane.
  - Agent-worker's checks against admission and control-plane move to those modules, as contract tests on the provider side.
- **Sample moves.** Four moves made and run, plus one reconstruction from class (c):
  - g48-classify (a) went to store-assembly.
  - l75 (b) went to store-assembly through a test-only Durable Object.
  - shape-harness (a), with its harness, went to store-assembly.
  - g123h-preload (a) went to test-support.
  - The reconstruction: the store's half of r10-nohome-filed-later, as a Node test at store-assembly.
  - Every moved test passed, and `p4 check` found no disagreement once one `uses` entry was added for the harness. Both store-assembly whole-module runs passed: 719/719 and 709/709.
- **One measured fidelity difference.** The capped shape runs lose something when they leave plane. Swapping plane's fixture for store-assembly's leaves the capped child about 9 MB less heap at idle: 93.3 MB against 84.2 MB [MEASURED, below]. Those runs become that much more lenient against the object's cap. I kept them as (a) and name the difference. r9-memory is the one test whose requirement counts the bundle in its total, so it is in "needs reconstruction".

## How I decided

- **Owner.** The module whose requirement or code the assertion exercises. I read each test file and its entry. Where a plane R number has retired, I use the requirement it moved to (`build/requirements/plane.md`: R24 to store-assembly R23, R25 to R59, R75 to R62, R77 to R64, R87 to R70, R97 to R74, R105 to R78) [READ].
- **What the store needs.** Plane's `Store` (`bio-plane/src/plane/store.mjs:27-105`) adds five things to `assembleStore`'s store: the retired-room check, the RPC methods, the alarm forwarders, `heal` on each request, and the timing header [READ]. A test that uses none of those, through a stub or `onAlarm`, gets the same store from store-assembly's own fixtures:
  - `bio-plane/test/m/store-assembly/fixture.mjs:69-89`: `assembleStore`, plus `fetch` = `dispatch(traceStamped(req))` [READ].
  - `alarmed-store.mjs:9-14`: the scheduler's `alarm`, `onAlarm` and `watch` [READ].
  - Plane's fixture adds one thing on top: control-plane's `deliverOwedRender` (`plane/fixture.mjs:20,24`) [READ].
- **Through the door.** A test is "through the door" when it calls plane's Worker (`mf.dispatchFetch("http://.../api?op=...")`), which is control-plane's `makeFetch` over plane's `door.mjs` hooks (`src/plane/index.mjs:8,13`) [READ]. Under ARCH's condition, the door's assembly is plane's.
- **Placement test.** If a test asserts only on the object (the ledger row, the order of passes, the store's answer) and uses the door only for setup, it is (a) or (b). If the assertion itself is measured through the door (whoami latency, the door's calls to the object), it needs reconstruction.
- **Ownership.** The tool I wrote applies the rule in `evidence-rules.md`: the longest match across `files` and `tests` (`scratchpad/tools/owner.mjs`) [MEASURED: it gives `bio-plane/src/store-assembly/wiring.mjs` as store-assembly 174, `pending.mjs` as store-services 173, `bio-plane/package.json` as test-support 9, `control-plane/wrap-entry.mjs` and `r8-kit.mjs` as plane 196].
- **Import closure.** Measured with `scratchpad/tools/walk.mjs`, a regex walk of static and literal dynamic relative imports. It does not see computed loads (see "What I did not check").

## Group A2 (27)

Tag for every row: [READ], the test file at the line given. Moves and runs: [MEASURED], in "Sample moves".

| # | test | owner | class | reason (file:line) | owner equivalent |
|---|---|---|---|---|---|
| 1 | corpus-r | store-assembly (the composed reading at shape) | a | `corpus-r.test.mjs:8,27` → `shape/harness.mjs:141` loads plane's fixture Store; the swap to `alarmed-store.mjs` is shown under move 3 | none found |
| 2 | g123f-cells | store-assembly (content R52, calculations R1) | a | `:9,16` same harness | partial: `content/g41-cells.test.mjs` (fixture `cellsOf`), `calculations/r9-cells.test.mjs` (G123f read-on) |
| 3 | g123f-workerd | store-assembly | b | `:23,45` `Probe extends Store`, but uses only `this.fetch` for `pendingadd` (`:71`) and `tabledeclare` (`:111`) and `onAlarm` (`:77`): dispatch and scheduler | partial: as row 2 |
| 4 | g124f-bounds | store-assembly (read bounds through the store) | a | `:14,27` harness | none found |
| 5 | g128i-over-24mib | store-assembly | a | `:12,24` harness | none found |
| 6 | g41-shape | store-assembly; the pure bar tests (`:35-76`) need no store | a | `:9` via `shape/g41.probe.mjs:9` | none found |
| 7 | g42-storage-seam | control-plane (the floor is `control-plane/index.mjs:2055-2057`); screens-settings draws | a | plane Worker default (`:22`) and plane fixture Store (`:21`) are used only as the door and the object; at control-plane, `makeFetch` (its own module) over store-assembly's fixture object is the same door code and the same real record | partial: `control-plane/stats.test.mjs:45-60` proves the floor over a hand-made store answer ("The store is the fake of record-core's `stats` rule", `:46`), the gap K4990 names |
| 8 | g44-shape | store-assembly (workbooks, file-safety) | a | `:8` via `g44.probe.mjs:14` | none found |
| 9 | g48-classify | store-assembly (`registerReaders`, `wiring.mjs:25`) | a | imports nothing later than 174 (`g48-corpus.mjs:11`); **moved and run** | none |
| 10 | g54-l | store-assembly R70 (sweep on the alarm); ratification R6, R57 | b | `g54-l-entry.mjs:7,16` `G54Plane extends Store`; 5 of 6 tests use the object's stub only; test 6 (`:141-146`) reads `publishedcase` through plane's public door, a residue | `ratification/g54-l.test.mjs` (workerd, ratification's own `G54Held` from earlier modules, `g54-entry.mjs:1-24`), `store-assembly/g54-sweep.test.mjs` (Node) |
| 11 | g55-alarm-l | store-assembly (calculations R14's consumer composed; scheduler R15, R24) | b | `g55-alarm-l-entry.mjs:7,26` extends Store; the door (`:35-37` of the test) only starts the ingest; a store route with its stated stamps can start it in a test-only object | partial: `calculations/g55-ingest.test.mjs` (Node) |
| 12 | g57-heal | ratification R57, R6 | d | plane adds only `op=ratify` through its hook (`:40`) and the composed alarm; the rule is proven at ratification in Node and on workerd, and the registration at `store-assembly/g54-sweep.test.mjs:37` | `ratification/g57-heal.test.mjs` (real `ratifyOp`, `sweepCaseFiles`), `ratification/g57-l.test.mjs` (workerd) |
| 13 | l75 | store-assembly R62 (test 3: store-services R64) | b | `l75-entry.mjs:6,18` `Held extends Store`; **moved and run** | `store-assembly/fix4-r75.test.mjs` (Node) |
| 14 | l77-size | store-services R64 and reading-pipeline (bounded PDF read through the ledger) | a | `l77-size-child.mjs:7` imports plane's fixture; the cap is the measured idle + 88 MB (`l77-size.test.mjs:20-21`), so a smaller idle does not loosen it | none found |
| 15 | l77-traffic | store-services R64 and scheduler | b | `:12,25` the l75 entry through the stub only; a test-only object must call `heal` on each request as `Store.fetch` does (`store.mjs:89`), or it proves less | none found |
| 16 | l77 | store-services R64 | b | research 08 moved it and ran it (27/27) | `store-assembly/fix5-r77.test.mjs` |
| 17 | r10-filing-stall | store-assembly R23 | needs reconstruction | see A/B/C | none found |
| 18 | r10-lag-figure | store-assembly R78 (`pending.mjs`) | b | asserts the ledger row only; the door is setup (`:46`) and read (`:57`) | partial: row 21; `store-assembly/r9-jobs.test.mjs:460` names the figure |
| 19 | r10-land-yields | extraction R111 through the ledger | needs reconstruction | see A/B/C | see C |
| 20 | r10-nohome-filed-later | store-assembly R59, R74 + control-plane R123 | needs reconstruction | see A/B/C; **reconstructed and run** | partial: `control-plane/r123-reading.test.mjs` (the door sends `pendingadd`, fake store), `store-assembly/r9-jobs.test.mjs:637` (`NO_HOME` waits, scripted answer) |
| 21 | r10-run-statements | store-assembly R78 | a | `:10` plane fixture used only as the store | partial: `r9-jobs.test.mjs:460` |
| 22 | r7-contention | store-assembly (the composed consumer's share); reading-pipeline R40 | needs reconstruction | see A/B/C | `reading-pipeline/r7-contention.test.mjs` (its own test-only object, the read's share, p95 asserted) |
| 23 | r8-headofline | scheduler (budget, rotation) and file-safety, composed at store-assembly | b | asserts order and counts; the upload through the door (`:66`) is setup; `owedwork` (`:75`) is the store's route | none found |
| 24 | r8-lag | store-assembly R78 | b | asserts the ledger row only (`:19-32`) | partial: `r9-jobs.test.mjs:460` |
| 25 | r8-wave | control-plane (hops, Server-Timing counts) and queue (one derivation) | needs reconstruction | see A/B/C | partial: `control-plane/r8-hops.test.mjs`, itself plane-listed and booted through plane |
| 26 | r9-memory | plane R100 (its own: the total counted whole, bundle included) and runtime-limits R32 | needs reconstruction | see A/B/C | none found |
| 27 | shape-harness | store-assembly (with the harness) | a | `shape/harness.mjs:141` is the only plane tie; **moved and run** | none |

## Group D (7)

| # | test | owner | class | reason | owner equivalent |
|---|---|---|---|---|---|
| 28 | agent-worker/test/agent-worker.test.mjs | agent-worker (110); section 8: retrieval's meaning arm | needs reconstruction | section 8 boots `bio-plane/src/plane/index.mjs` (`:607-613`) [READ] | the other sections are agent-worker's own (plane mock) |
| 29 | agent-worker/test/harness.test.mjs | agent-worker; section R: ai-runs, run-rules | needs reconstruction | `plane-world.mjs:1-25` copies `src/` and adds plane's entry, which counts as a copy of plane under ARCH's condition (`harness.test.mjs:136,1647-1670`) [READ] | as row 28 |
| 30 | agent-worker/test/requirements.test.mjs | agent-worker; R4/R44 admission's `NAMESPACES` (169), R48 control-plane's agentpack (195) | needs reconstruction | `:79` plane entry; `:429`, `:1216`, `:1455` [READ] | as row 28 |
| 31 | agent-worker/test/versions.test.mjs | agent-worker; Part B: provenance (51) and retrieval (81) | needs reconstruction | `:119-120,204` plane entry [READ] | Part A is its own |
| 32 | bio-plane/test/system/migrate-released.test.mjs | store-assembly R3 (every migration composed) | needs reconstruction | boots plane index on released bundles from git (`:175`, `:229-230`) [READ]; ARCH's decision "Stores written by past releases" (`process/decisions-arch.md:68-71`) keeps it at plane on captured stores [READ] | not checked which store-assembly migration tests overlap |
| 33 | bio-plane/test/system/pdf-worker-binding.test.mjs | reading-pipeline (the escalation, `reading-pipeline/index.mjs:126-152`, `env.PDF_WORKER` at `:150-152`) | b | plane Worker from source (`:31`), only to reach the escalation through `op=pdfstructure`; a test-only Worker at reading-pipeline with `PDF_WORKER` bound to pdf-worker's build (34) holds the binding behaviour; routing is extraction R31's Node test (`extraction/pdfstructure.test.mjs:72`) [READ] | partial: `extraction/pdfstructure.test.mjs` (scripted fleet member) |
| 34 | bio-plane/test/m/plane/g123h-preload.test.mjs | test-support (`package.json`, `platform-sqlite.mjs`, `module-tests.mjs` are its files) | a | reads only those (`:11-20`); **moved and run** | partial: `test-support/platform-sqlite.test.mjs` (R18, one run, not the two-command parity) |

## The eleven that need reconstruction: A, B, C

**17. r10-filing-stall** (store-assembly R23, was plane R24 b2)
- A: After a 7.9 MB text is filed, the alarm's next firings must not hold the object. The test measures this as a member's `whoami` through the deployed Worker every 20 ms, with a bar of 150 ms (`:4`, `:42`, `:60-77`) [READ].
- B: `r10-entry.mjs:4,7` makes `Stalled extends Headline extends Store` and re-exports plane's Worker [READ]. The door supplies two things: the upload (through plane's `captureOp` hook, `door.mjs:18`) and the probe. For the stall, which happens in the object, that is convenience. For the bar as written ("through the door"), it is need.
- C: Split. The object's stall can be measured at store-assembly with a test-only object over `assembleStore`: upload through capture's own `uploadCapture` (as `shape/harness.mjs` does) and probe a cheap store route. The door's hop is the residue and stays where the door is assembled. No re-stacking is needed.

**19. r10-land-yields** (extraction R111 `indexUnits`, through the ledger)
- A: A tick that lands units must yield between batches. The test measures 12 `whoami` calls at a time through the door while the real alarm reads a 7.9 MB text, with p95 under 100 ms and max under 250 ms (`:1-6`, `:44-66`) [READ].
- B: `r8-headofline-entry.mjs:5,13` extends Store and re-exports plane's Worker [READ]. The door is the probe.
- C: Split. The yield belongs to extraction and reading-pipeline, and the pattern already exists there: `reading-pipeline/r7-contention.test.mjs` boots its own object from earlier modules and asserts the p95 [READ, `:1-8` of that file]. The composed version can sit at store-assembly as in row 17. The door's hop is the residue. No re-stacking.

**20. r10-nohome-filed-later** (store-assembly R59, R74, and control-plane R123)
- A: An unfiled upload's reading waits `NO_HOME`, backed off. Filing the document through `op=promote` brings the row forward, before the backoff ends, and the reading runs (`:1-5`, `:13-36`) [READ].
- B: The test boots `r8-wave-kit.mjs:5` → `control-plane/r8-kit.mjs` → the counting door over plane's Worker [READ]. The bringing-forward comes from control-plane's follow on promote (`control-plane/index.mjs:2100-2101`, `followEntries` → `pendSha`, `:1693-1701`) [READ], which needs a door. The waiting and the re-arm are the ledger's.
- C: Split, **reconstructed** (move 5). The store's half runs at store-assembly in Node: real upload, `pendingadd` as the door sends it, the real `NO_HOME`, real `promote`, `pendingadd` again, and the row read before its backoff. The door's half, sending `pendingadd` on promote, is control-plane R123's own test (`control-plane/r123-reading.test.mjs:1-3`) [READ]. That test uses a fake store; giving it store-assembly's fixture would close the K4990 gap. No re-stacking.

**22. r7-contention** (the composed consumer's share; plane R93)
- A: With the reading owner stubbed, the store's own consumer and alarm keep 12 cheap reads through the door under 500 ms at p95. The second test checks that an `ocr` row states `wait_ms` apart from its own time over a real service binding (`:1-10`, `:66`, `:94`) [READ].
- B: `r7-contention-entry.mjs:7,13,34` has `Contended extends Store` and re-exports the Worker [READ]. The door is the probe.
- C: Split, as row 17. The `wait_ms` test (`:94`) concerns only the object, so it is (b) at store-assembly. The read's own share is already at reading-pipeline (row 22's equivalent). No re-stacking.

**25. r8-wave** (control-plane hops and counts; queue's one derivation)
- A: Each read of the Queue screen's set stays within the hop table and states its count of calls to the object in Server-Timing. A wave derives the feed once (`:1-8`) [READ].
- B: The counting door is plane's Worker wrapped (`r8-wave-kit.mjs:5`; `wrap-entry.mjs` and `r8-kit.mjs` are owned by plane [MEASURED, owner.mjs]). The queue arm reaches the door through plane's `door.mjs:11` (`queueOp`) [READ]. The door and its arms are the subject, so this is need.
- C: At control-plane, in Node: `makeFetch` over store-assembly's assembled store, with a counting `STORE` and the arms taken from their owners (`queue/door.mjs` and the rest, all earlier than 195) instead of plane's `door.mjs`. That needs the interface change plane R6 foresees ("each the arms' owners' once their arms have moved", `process/modules/plane.md:22`) [READ], or a test that composes the arms itself. It does not need the re-stacking.
  - Shown: the file copied unchanged into control-plane's folder fails `p4 check control-plane` with "2 disagreement(s) ... imports plane, which process/modules/control-plane.json does not declare in uses; plane is later in the order, so declaring it would not settle this" [MEASURED].

**26. r9-memory** (plane R100, the object's total, and runtime-limits R32)
- A: The largest CSV the alpha accepts, read by the ledger, stays inside the object's total. A leak fails the same judge. No plane requirement says "above idle" (`:22-41`) [READ].
- B: R100 counts the total "whole: the bundle, the heap and the backing stores" (`process/modules/plane.md:47`) [READ]. Plane's fixture loads control-plane and every screen: the harness's import closure is 855 files, latest 196, against 711 files, latest 174, for store-assembly's [MEASURED, walk.mjs]. The idle heap is 93.3 MB against 84.2 MB [MEASURED, move 3]. By R100's words, this is need.
- C: Split. The ledger's bounded read under the cap goes to store-assembly (a). The total with the bundle is plane's own requirement and stays with plane. Alternatively, the bundle's owner could publish its idle figure and the store-assembly run could add it as ballast. No re-stacking.

**28-31. agent-worker's four**

- A:
  - Row 28: the member's handler under workerd over a service binding. Section 8 checks that the old meaning-arm spelling is refused by the real plane.
  - Row 29: the run harness's table. Section R checks that the step log meets the plane's refusal and that the plane records the run.
  - Row 30: every agent-worker requirement. Three of them ask the real plane: the namespace set (R4, R44) and the agentpack answer (R48).
  - Row 31: the run reads versions as versions. Part B gets the real `search` and `versionchain` [READ, the headers].
- B: Every one loads plane's entry or a copy of `src/` with it (rows above). The answers come from:
  - retrieval (81), provenance (51) and ai-runs (98), all earlier than agent-worker (110);
  - admission (`NAMESPACES`, `bio-plane/src/admission/index.mjs:155`, 169) [READ];
  - control-plane (agentpack, 195);
  - the door's envelope (answer-envelope 170 and control-plane), later than agent-worker.
- C:
  - For the earlier providers: their published fixtures made from their real code (K4990). The test files already import some of them: `retrieval/fixtures.mjs` `meaningRowsUnknownArm`, `provenance/fixtures.mjs` `versionChainNoSuchVersion`, `ai-runs/fixtures.mjs` `tickStateTooLarge` (`requirements.test.mjs:37-40`) [READ]. A test-only object from ai-runs and run-rules could serve section R.
  - For the later providers (admission, control-plane, the envelope): a contract check on the provider side. The provider's tests import agent-worker's expectations, which come earlier in the order (for example `agent-worker/src/ops.mjs:21` `NAMESPACES` [READ]), and assert that their own answers match.
  - The rest of each file stays agent-worker's.
  - No re-stacking. The checks move to modules before plane.

**32. migrate-released** (store-assembly R3)
- A: For each release: the old plane wrote a store; the current plane answers on it (`bootstrap`, `stats`, `audit`, `selftest`); the migrated shape equals a fresh store's; the rows survive; a second boot is clean (`:11-30`) [READ].
- B: The released bundles are read from git and booted (`:175`, `:221-230`) [READ]. Making the stores once is need; ARCH has decided they become captured data. The current plane is used for two things:
  - `assembleStore`'s migration, which store-assembly alone needs;
  - the door ops. Of those, only `selftest` is a plane hook (`door.mjs:5` `instanceSetupOp`) [READ]; the rest is convenience.
- C: With ARCH's captured stores as data, properties (3) to (5) can run at store-assembly over its fixture on `node:sqlite` (a), or in a test-only object (b). Property (2) can run at control-plane over the migrated assembled store, leaving `selftest` as the residue. This needs ARCH's decision to change, since it says the test is plane's. It does not need the re-stacking.

No test fell in class e.

## Sample moves and their runs

The machine is shared and had 4 cores [MEASURED: `nproc` = 4]. `/proc/loadavg` is given before and after each run. My own runs overlapped during the first store-assembly run, which pushed the load to 13. The quiet reruns are at 3-4.

**Move 1, g48-classify → store-assembly (a)** (`wt-a`)
- Change: `git mv` of `g48-classify.test.mjs`, `g48-corpus.mjs`, `make-g48-plane-answers.mjs` and `fixtures/g48-plane-answers.json` into `bio-plane/test/m/store-assembly/`. Relative paths are unchanged because the depth is the same. Two comment lines were edited.
- `p4 check store-assembly --files <the three>`: "no disagreement found", 82 "cannot tell" lines. 29 s, load 0.47 → 1.61 [MEASURED].
- Alone: 13/13 pass, 19.1 s (load 1.48 → 2.03). Original at plane: 13/13, 18.9 s (load 3.87) [MEASURED].
- Whole module (`run scope --branch job/store-assembly.1` → 92 files including the moved test, then `run tests`): "Check of store-assembly: no disagreement found"; tests 719, pass 719, fail 0; `duration_ms` 322112; 360 s wall; load 2.13 → 11.30 [MEASURED].
- Import closure: 505 files, latest store-assembly 174 [MEASURED].

**Move 2, l75 → store-assembly through a test-only Durable Object (b)** (`wt-b`)
- New entry `store-assembly/l75-entry.mjs`:
  - `Held extends DurableObject` (from `cloudflare:workers`);
  - the constructor calls `assembleStore(ctx, env, {deliver: null})`;
  - `alarm()` forwards to `schedulerOf(...).alarm()`;
  - any path outside `/l75/` goes to `dispatch`;
  - the `/l75/` debug routes are copied from plane's entry.
- The test was moved with `git mv`, its header edited and its persist prefix renamed. All assertions are unchanged.
- Alone: 3/3 pass, 23.7 s (load 3.09 → 5.68); quiet rerun 17.4 s (load 3.62). Original at plane: 49.7 s under load 13.05; quiet rerun 19.8 s (load 3.95) [MEASURED].
- Mutation: line 580 of `assemble.mjs` (`register("plane", pending.consumer())`) was replaced. Test 1 then failed with "the entry is removed once its work has ended (60078 ms)", and tests 2 and 3 still passed. The file was restored [MEASURED].
- `p4 check store-assembly --files l75.test.mjs,l75-entry.mjs`: "no disagreement found", 28 "cannot tell" lines [MEASURED].
- Whole module (92 files): no disagreement; 709/709 pass; `duration_ms` 170730; 206 s wall; load 8.69 → 4.81 [MEASURED].
- Import closure: test plus entry is 702 files, latest 174. The original test plus plane's entry is 855 files, latest 196, reaching plane, control-plane and all 17 screens parts [MEASURED, walk.mjs].
- Plane's `l75-entry.mjs` stays, because l77 and l77-traffic use it.

**Move 3, shape-harness → store-assembly (a), with the harness** (`wt-c`)
- Copied `shape/harness.mjs`, `cap.mjs`, `bars.mjs` and `g44-gen.mjs` to `store-assembly/shape/`. In `harness.mjs:141`, `../fixture.mjs` became `../alarmed-store.mjs`. The test was moved with `git mv`.
- `p4 check store-assembly` reported "2 disagreement(s): ... harness.mjs:385, :401 imports csv-reader, which process/modules/store-assembly.json does not declare in uses". With `csv-reader` (module 17) added to store-assembly's `uses` in the scratch copy: "no disagreement found" [MEASURED]. A real move needs that one-line edit to the module record.
- Moved: 7/7, 15.6 s. Original: 7/7, 16.3 s. Load 4.02 for both [MEASURED].
- Idle heap: `scratchpad/tools/idle.mjs` called `shapeRun` on a 3 MiB CSV three times with each harness. Plane's gave `idleMB` 93.3 each time; store-assembly's gave 84.2 each time. Both read the file whole. Tick peaks were 115.8-132.3 MB against 106.6-118.5 MB [MEASURED, load 11.50 → 10.27; heap figures, not times].
- Import closure: 711 files, latest 174, against 855, latest 196 [MEASURED].

**Move 4, g123h-preload → test-support (a)** (`wt-c`)
- `git mv` to `bio-plane/test/m/test-support/`. The relative depth is unchanged.
- `p4 check test-support`: no disagreement. 2/2 pass, 0.25 s. Import closure: 1 file, latest 9 [MEASURED].

**Reconstruction 5, from "needs reconstruction": r10-nohome-filed-later's store half → store-assembly (a)** (`wt-c`)
- New Node test `store-assembly/r10-nohome-refiled.test.mjs` over `alarmed-store.mjs`:
  - capture's `uploadCapture` of a 400 KB text;
  - `pendingadd` through the store's `fetch`;
  - `onAlarm`, after which the row is `NO_HOME` with `next_try` ahead;
  - promotion's `promote` of an information document whose file is the capture;
  - `pendingadd` again;
  - assert the row is brought forward and is read before the backoff.
- 1/1 pass, 1.6 s (load 3.66). The original at plane: 1/1, 20.2 s (load 3.28) [MEASURED].
- The logged rows show `attempts` 1, `why` `NO_HOME`, `next_try` = `last_try` + 15000 ms. After the re-registration: `attempts` 0, `next_try` at once [MEASURED].
- Mutation: with the second `pendingadd` removed, the test fails ("brought forward: ... "why":"NO_HOME" ...") [MEASURED].
- `p4 check store-assembly` at first reported 4 disagreements of the kind "'waiting.next_try' is possibly 'null'" against store-services' stated interface. After the values were guarded with `Number(...)`: no disagreement [MEASURED].
- Import closure: 704 files, latest 174 [MEASURED].
- The door's half is not run here; it is control-plane's `r123-reading.test.mjs` (row 20).

**The patch.** `classify/22a-moves.patch` (against `a26a8da2`, new files included) rebuilds moves 1, 2 and reconstruction 5. Checked on a second clean worktree: `git apply` applies it; g48-classify 13/13, l75 3/3, r10-nohome-refiled 1/1; `p4 check store-assembly` on the six files: no disagreement (load 2.80 to 1.99) [MEASURED]. Moves 3 and 4 are not in it.

**Class (c) at its would-be owner, shown failing the judge:** r8-wave copied into control-plane's folder (imports re-pointed only) fails `p4 check control-plane` with 2 disagreements, both "imports plane ... later in the order" [MEASURED]. I did not run it there.

## What the counts mean for the owner's concern

- 22 of the 34 (a 12, b 10) can be run at the owning module by moving or rewriting the test. INFERENCE from the class reasons: a flaw in those owners would then fail in the owner's own job.
  - For each of the 22, the owner is store-assembly (174), store-services (173), control-plane (195), reading-pipeline (61) or test-support (9) [READ, the owner column].
  - For the store-composition tests, store-assembly is the earliest module that holds the composed store. A flaw inside a lower module (extraction's yields, the ledger) is found there, at 173-174, not at its own module. Only splitting the rule out can bring it earlier. The l77 and r10-nohome cases show both halves.
- The 11 that need reconstruction each have a route, and none of the routes needs the re-stacking.

## What I did not check

- Computed loads in the moved tests. I used a static import walk and `p4 check`. A Node-side trace with the lane's `tools/trace.mjs` recorded only 3 loaded files for the Miniflare run of l75, so it did not see Miniflare's module collection. Research 08's patched-`fs` probe was not repeated. Not checked: what Miniflare hands workerd for the new l75 entry.
- Runs of the other (a) and (b) tests in their new places. Only the five above were run. For the remaining 9 (a) rows, the store-assembly swap is shown only by move 3 for the harness, not run per test. The heavy shape runs (g41, g44, g124f, g128i, corpus-r, r9-memory, l77-size) were not run in either place.
- Whether the 9 MB of idle-heap slack would hide any real overrun in the capped runs.
- `p4 check plane` after the moves. Plane's whole-module run. GitHub's real runner: scopes were built locally on detached commits.
- Which store-assembly tests overlap migrate-released's shape assertion. Whether `fix4-r75` and `g54-sweep` cover every assertion of their plane twins line by line: compared by title and header only.
- Repeated timing runs. Each time was taken once or twice on a shared machine at load 3 to 13.
- The agent-worker routes beyond reading the import lines and the section headers. I did not try the provider-side contract tests.
- The "none found" equivalence searches (rows 1-8, 14, 15, 17, 23) were grep searches by tag and name, not a full read of every owner's tests.
