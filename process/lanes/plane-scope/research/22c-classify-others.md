Length: 153 lines. Last section: "What I did not check".

# Plane scope research 22c: plane's group-B tests that prove other modules' requirements (not control-plane's)

Written 24 Nov 2026 by a worker of the plane-scope lane. Research only; it decides nothing. Base: commit `a26a8da2`, read through a scratch worktree of it; the moves were made in a second scratch worktree, both since removed. Tags as in `evidence-rules.md`: [MEASURED] a command showed it, [READ] the code line is cited, [NOT CHECKED]. An inference is marked INFERENCE. The per-test rows are `classify/22c.json`.

## The question and the answer

The owner's concern: a whole-program test at the end of the order finds a flaw only after the faulty module's own job, and only if the proving module happens to run. So: for each of plane's group-B tests whose owner is not control-plane, can it be proven by the owning module's own tests?

The set [MEASURED: the 40 files of `02-test-map.md` group B outside `cp/`, each checked to be plane's by the longest-match owner over `process/modules/*.json` at `a26a8da2`: `node owner.mjs . <40 files>` printed `40 plane`]: the 9 legacy root suites (`bio-plane/test/*.test.mjs`) and 31 files under `bio-plane/test/m/<module>/`. `r10-held-paging` was classified by research 06 and moved by research 07; it is cited, not redone.

ARCH's added condition is applied to every class: a test moved to its owner may load only that module and earlier ones, never plane, the door, a later module, or a copy of them. A test-only harness built only from earlier modules is allowed; `p4 check <owner>` judges.

**Counts, by file** [READ, one row each in `classify/22c.json`]:

| class | files | meaning |
|---|---|---|
| (a) plain Node test over the real store (store-request's world and door) | 24 | 13 can sit at the owner itself (the screens parts, plus office-readers, scheduler/invariants, store-assembly); 11 have an owner earlier than the assembled store (store-assembly, 174), so their "earliest module holding the behaviour" is store-assembly or store-request (175), not the owner |
| (b) real runtime, no assembled program: a test-only Durable Object | 1 | `affordances/door-events` |
| (c) needs reconstruction (renamed by the lane) | 5 | each has a route that loads only its owner and earlier modules; one route was tried (section "The five that need reconstruction") |
| (e) no route found | 0 | |
| (d) duplicate: drop from plane | 10 | the 9 legacy suites (converted under K619, kept only until the release deletes them) and `capture/g41b-plane` |

**Sample moves** [MEASURED, section "The sample moves"]: `screens-intake/r10-pending` and `r10-refused-kind`, both (a), moved to screens-intake over store-request's world: 3 of 3 pass each, every assertion kept, a mutation of the owner's code turns each red; screens-intake's whole set with both moved: 381 of 381 pass; `p4 check screens-intake`: "no disagreement found".

Three findings that change the picture:
1. **The platform's value limit is already in Node.** Many of these tests give "the platform's own value limit" as their reason to boot workerd (`screens-inquiry/g41-document.test.mjs:4`). test-support's preload `bio-plane/test/platform-sqlite.mjs:1-14`, which every module's required run loads, already makes node:sqlite refuse a value over the Durable Object limit with SQLITE_TOOBIG [READ]. So the size cases are (a), not (b).
2. **Owners before store-assembly cannot hold the composed-store half themselves.** For 11 of the (a) files the owner (capture 56, capture-requests 100, affordances 156, host-governor 49, instance-setup 166, reevaluation 113, scheduler 152) comes before store-assembly (174), whose world is the only real composed store in Node. Their whole-store half can move down to 174/175, i.e. 21-22 places before plane, but not to the owner's own job. Where the owner already proves the behaviour at its own interface, it is named.
3. **The world's door re-makes some door arms by hand.** `store-request/door.mjs` re-makes control-plane's reading gate (`inlineVerdictOf`, `:135-155`) and the batch `reviewcopy` relay (`:555`) [READ]. A test whose point is the real door's arm (3 of the 5 (c)) cannot be (a) as it stands without testing that re-making instead; each can be split so that the arm is proven at control-plane and the screen's half over the world, or kept whole after the re-stacking.

## Method

- Read each file's header, imports, test titles and the lines that decide the class; cited as `file:line`. Paths below: `T/` = `bio-plane/test/`, `m/` = `bio-plane/test/m/`.
- Owner of a requirement: from the header and `build/jobs/T17/legacy-tests.md` for the legacy suites. Owner of a file: longest match over `files` and `tests` (my `owner.mjs`, as research 13 did).
- "Owner-equivalent": a file of the owner (by longest match, so not plane's) that names the same requirement id, found by `grep -lE <ids>` over the owner's test files [MEASURED]; where I compared assertions I say so. A name match is a lead, not proof of equivalence.
- Placement under ARCH's condition: the world (`m/store-assembly/world.mjs`, store-assembly 174) and the world's door (`m/store-request/door.mjs`, store-request 175) are the earliest composed store and door in Node; a test that uses them sits at 175 or later.

## The legacy root suites: (d), 9 files

K619 (`build/rulings.md:622`) [READ]: "each `convert` suite ... becomes an entry for its owning module's next job, which writes the requirement-named module test in its own layer; (3) the converted old suites and the rest of the battery are deleted in one pass at the next release". Each of the nine is a CONVERT row of `build/jobs/T17/legacy-tests.md` [READ], and each has a converted module test that names it [MEASURED: `grep -rl <suite name> bio-plane/test/m`]:

| suite | CONVERT row | owner's converted test |
|---|---|---|
| `cap13-reuse-pages` | `:54` capture, subresources | `m/capture/converts.test.mjs:1-6` ("`cap13-reuse-pages` stays until the release deletes it (K619 (3))") |
| `conclude-project` | `:45` basis-versions, queue-producers | `m/basis-versions/conclude-project.test.mjs:5`, `m/queue-producers/shared.test.mjs:4` |
| `d526-refusal-order` | `:105` promotion, actions, control-plane | `m/promotion/converts.test.mjs:23`, `:46`; `m/actions/t18`, `m/admission/admission` |
| `d57selflink` | `:41` capture | `m/capture/services.test.mjs:218-245`, `m/acquisition/selflink-render.test.mjs:1-3` |
| `d606-perpage-ocr` | `:83` extraction, ocr-worker | `m/reading-pipeline/convert-ocr.test.mjs:1-7` |
| `members` | `:121` membership, control-plane | `m/membership/converts.test.mjs:2` |
| `mk6-bundle-names-no-author` | `:86` provenance, publication, ratification | `m/publication/convert-mk6-bundle-names-no-author.test.mjs` and two more |
| `stats-disclosure` | kept for REPORT (`legacy-tests.md:14`) | `m/control-plane/stats.test.mjs:1-12` (B2, B3); `m/record-core/record-core.test.mjs:1814` (R64 R65, the disclosure K621 gave record-core) |
| `tier2-wire` | `:101` extraction | `m/extraction/convert-tiers.test.mjs:35-75`, `m/reading-pipeline/convert-tiers.test.mjs` |

Each is a script with its own `check` counter and `process.exit` (`cap13-reuse-pages.test.mjs:227-228`) [READ], booting plane's entry under Miniflare (`:79-80`). What was not carried is recorded for one: `stats-disclosure`'s arm D (`op=selftest`, `op=livefire`, legacy hooks; `build/jobs/T17/control-plane.md:34`) [READ]. Whether every other assertion was carried I did not check per assertion. They are dropped from plane by the release's deletion already ruled; nothing has to move.

## The 31 module files

One line each: owner and requirement; class; the reason with its line; where it would go. Owner-equivalents are in the JSON.

### affordances (156)

- `m/affordances/door-events.test.mjs`, affordances R39: **(b)**. The door's arm already runs in Node (`:30-45`, `affordancesOp` with the door's helpers handed in); the Durable Object is booted only so that the store's `affordancevocab` answer is composed in an isolate where `events` started, while this process's registry has no `events` (`:1-6`, `:48`). The answer is `facts.mjs:469-503` `profileVocabularies()`, its `events_vocabularies` from `composedVocabularies()` (`:500-502`) [READ]. INFERENCE: a test-only Durable Object at affordances that starts `events` (65) and answers `affordancesOf(...).profileVocabularies()` would do, as would a worker thread; not tried. `:72` is already a plain unit test.
- `m/affordances/plane.test.mjs`, R13-R24, R26, R51-R55: **(a)** at store-request (175). Its facts are answered by many owners composed (`:1-7`), its stamps (`viewer`, `identity`, `by`) come from the door (`:263-296`); the world's door makes these stamps with the real admission (research 13 section 2). The owner holds per-owner halves at its interface (`*-backing.test.mjs`, e.g. `t33-backing.test.mjs:1-4`).

### capture (56) and capture-requests (100)

- `m/capture/plane.test.mjs`, capture R21 R27 R73: **(a)** at store-request (175). One test: four ops reached behind the token through `captureOp`, the acquire's grade note, an anonymous call refused (`:66-89`). The world's door runs the modules' own door arms (`store-request/door.mjs:439-471`, research 13). Whether it answers `op=capture`'s raw-byte GET [NOT CHECKED].
- `m/capture/g41b-plane.test.mjs`, capture R107: **(d)**. Asserts two parts and the stored format (`:73-91`); capture's own `m/capture/g41b-t51.test.mjs:1-3` proves the same through `uploadCapture` "with real parts and no stub". The plane file adds only the door path.
- `m/capture/r7-upload-plane.test.mjs`, capture R103 (G79): **(a)** at store-request (175). It asserts what the answer says and what the record holds after the alarm; its times are printed only (`:1-4`). The value limit is the preload's, the alarm is `world.tick`, the bucket's multipart is the world's (`store-assembly/world.mjs`, the bucket's `createMultipartUpload`). Real R2's part rules and the isolate's memory [NOT CHECKED].
- `m/capture-requests/plane.test.mjs`, R30, R16, R31 (R14 R19 R38 R42 R48 R56): **(a)** at store-request (175). It boots a copy of `src/` with plane's door and `Store` (`plane-world.mjs:22-60`), which ARCH's condition counts as loading plane. The copy exists to give run-rules' test set one matter (`plane-world.mjs:1-9`); INFERENCE: a resolve hook substituting `run-rules/test-set.mjs` (96, earlier) over the world would do, not tried. The owner already proves R16 (`drain.test.mjs:284`), R19 (`:335`), R31 (`retry.test.mjs:68`), R48 (`t34.test.mjs`), R56 (`t47.test.mjs`); R30's class table (`:155`) is admission's work and has no owner-side equivalent found.

### host-governor (49), instance-setup (166), lines (66), office-readers (18), reevaluation (113), scheduler (152)

- `m/host-governor/ops.test.mjs`, R18 R19 R27 R28: **(a)**. Eight tests already run at the module's interface over a stub that answers with the real governor's routes (`:13-21`, `:23-240`); they can move as they are. Four go through the plane (`:299`, `:318`, `:349`, `:364`): which token classes and sessions reach each op, which is admission's decision; they go to store-request (175), whose door runs the real `admit` and `bearerFence`. The founder there is claimed without the door's bootstrap-token gate (research 13, `door.mjs:486-488`).
- `m/instance-setup/reports.test.mjs`, R3 R10 R11 R17-R19: **(a)**. Five tests use the module's fixture; the two livefire tests (`:196`, `:215`) run the canary against a scratch store in Miniflare. INFERENCE: livefire over the world's store at store-assembly (174); not tried.
- `m/instance-setup/worker-reports.test.mjs`, R17-R19, R33-R42, R102: **(c, needs reconstruction)**. It proves the Worker entry's bindings and environment (`:95-153`; R102 `STORE_LOCATION` `:207`) and that plane's entry hands the report ops to the module (`:1-8`); it reads `dist/SECRETS.txt` for the published values (`:17-20`). The entry is plane's (`src/plane/index.mjs` imports `setup.mjs`, `02-test-map.md`), so re-stacking the door does not change this. Only `:155` (R42, capture's compute listener) could go to store-assembly.
- `m/lines/invariants.test.mjs`, R18-R20: **(c, needs reconstruction)** for one test. `:33` imports every `src/*/index.mjs` (`:34-40`), later modules included: a census of the whole program. It needs no runtime and no door, only the last place in the order (or a per-module restatement). The other three tests use lines' own fixture (`:8`) and can stay.
- `m/office-readers/r46-memory.test.mjs`, R46: **(a)**. Tests `:22-72` use the module's fixtures and generator; `:96` runs plane's shape probe `T/m/plane/shape/g41.probe.mjs` as a child (owner plane 196 [MEASURED]), and the header names plane's `g41-shape.test.mjs` as the whole case (`:4-5`). With `:96` left to plane, the file moves to office-readers.
- `m/reevaluation/r14-regrade-door.test.mjs`, R41: **(a)** at store-request (175): one walk through ops and the alarm's notice sweep (`:177`); no time is asserted from the object (`:5-6`). The owner proves R41 at its interface in `r14-regrade-after-read.test.mjs:39-93`.
- `m/scheduler/invariants.test.mjs`, R14 R18-R20: **(a)** with one test left to plane. Four tests use the module's fixture; `:12` reads `bio-plane/wrangler.jsonc`, plane's file [MEASURED: owner plane 196], and asserts the deployed cron: a statement about plane's configuration.
- `m/scheduler/plane.test.mjs`, R5 R8 R9 R12: **(a)** at store-assembly (174). The registry it checks is the assembly's (`:72`); the alarm is driven through `onAlarm(now)` on a virtual clock (`:1-4`), which is what `world.tick` does (`store-assembly/world.mjs:298-299`). It boots the same copy of `src/` as capture-requests, for the same reason (`:5-8`).

### screens-daily (185), screens-publish (192), screens-intake (183), screens-inquiry (188)

- `m/screens-daily/c25-seam.test.mjs`, C25 (R54 R17 R89): **(a)** at screens-daily over the world's door, the world's scripted network serving the pinned bytes. It downloads the IRS file with `curl` when not cached (`:27-29`).
- `m/screens-daily/casedrafts-seam.test.mjs`, G12c (R87 R64): **(c, needs reconstruction)**. One of its three named providers is "the control plane's forwarding of `projects`" (`:1-5`); the world's door does not run it. The screen's one read is already proven over the world in `roster-real.test.mjs:36` and `home.test.mjs:793`.
- `m/screens-publish/door-seam.test.mjs`, R73 C49: **(c, needs reconstruction)**. Its point is the real door (`:1-3`): the batch `reviewcopy` with `drafts` is the door's own arm (`src/control-plane/index.mjs:1142`), re-made in the world's door (`store-request/door.mjs:555`). The screen half could run over the world now.
- `m/screens-intake/r10-held-paging.test.mjs`, R4: (a), research 06 and 07 (moved, 378 of 378).
- `m/screens-intake/r10-open-file.test.mjs`, R68: **(a)**, the same pattern as the two moved here (`:1-4`; its own Miniflare boot, `:16-20`).
- `m/screens-intake/r10-pending.test.mjs`, R65, and `r10-refused-kind.test.mjs`, R64: **(a)**, moved (below).
- `m/screens-intake/t51-seam-e7.test.mjs`, R38: **(a)**. Its inputs are an acquire with a scripted fetch and a whole removed from `CAPTURES` and put back (`:1-6`); the world has a scripted network and an R2-shaped bucket (`store-assembly/world.mjs:1-15`).
- `m/screens-intake/t51-seam-g126h.test.mjs`, R61 with control-plane R131 and plane R97: **(c, needs reconstruction)**. It is "red by name until control-plane R131 (the door's gate) and plane's job table (plane R97, `op=owedwork`) merge" (`:1-5`): it proves the door's gate and plane's table. The screen's own R61 is tested "at its interface, in `t51-fix7.test.mjs`" (`:5`). The world's door re-makes the gate (`store-request/door.mjs:135-155`). After re-stacking, the gate half could be (a) at control-plane over a real store.
- `m/screens-inquiry/fr5-seam.test.mjs` (R129, citation R21), `r10-question-seam.test.mjs` (R30a), `r9-seam.test.mjs` (R130 R131): **(a)** at screens-inquiry. Each makes its inputs by real ops and draws over the page (`:1-4`/`:1-5`); nothing runtime-specific found.
- `m/screens-inquiry/fr6-seam.test.mjs` (R96 R129 R1 R9 R128 R3) and `g41-document.test.mjs` (R3 R44 R96): **(a)**. Their sizes meet the value limit, which the preload gives Node (finding 1); `g41-document`'s five other tests are already scripted-table tests (`:4`).
- `m/screens-inquiry/r10-stated.test.mjs` (R1 R2a R4 R9 R37 R62 R96 R133 R134) and `r9-refusal.test.mjs` (R130): **(a)**, with the OCR member booted by its own helper (`ocr-worker/test/memberworker.mjs`, owner ocr-worker 35 [MEASURED]) and handed to the world as the `OCR_WORKER` service plane binds (`r9-refusal.test.mjs:27`). That the world accepts it as a binding [NOT CHECKED].

### store-assembly (174)

- `m/store-assembly/sa-assembly.test.mjs`, R1 R4 R5 R7 R8 R96-R99: **(a)** with one test left to plane. Fourteen tests use store-assembly's fixture only (`:9`); `:250` reads `src/plane/*.mjs` (`:251-253`) to check what plane imports of store-assembly: a statement about a later module's file.

## The sample moves

Scratch worktree of `a26a8da2`, `node_modules` and `bio-plane/node_modules` symlinked from the main checkout. Diff (47 lines) [MEASURED: `git diff` in the worktree]: a new `m/screens-intake/realworld.mjs` with `realplane.mjs`'s API (`founder`, `uploaded`, `ticksUntil`, `deferred`, `dispose`) over `members()` and `openWorld()` of screens-intake's own `page.mjs` (store-request's world); in each test file the import and one line changed (`realPlane("tag")` to `realWorld()`); the two lines removed from `process/modules/plane.json`. No assertion was changed. `ticksUntil` moves the world's alarm (`world.tick`) with the page's clock, where the plane's alarm ran on its own; the signed-in member is a member with `contribute` and `create_projects`, where it was the founder.

**The patch, corrected.** My first saved patches (`w22c/move.patch`, `move-all.patch` in the scratchpad) were made with plain `git diff`, which leaves out untracked files, so they lacked the new `realworld.mjs`. The lane applied them and both moved tests failed with ERR_MODULE_NOT_FOUND. I rebuilt the move on a fresh worktree of `a26a8da2`, marked the new file with `git add -N` and saved `classify/22c-moves.patch`. It holds 5 files: the new `realworld.mjs`, the two screens-intake tests, `lines/invariants.test.mjs` and `plane.json` (three lines removed). On another clean worktree of `a26a8da2`, `git apply --check` and `git apply` succeeded, and the two moved files with `lines/invariants` passed 10 of 10 [MEASURED; load 3.28]. Both worktrees are removed.

Results [MEASURED; `node --import ./bio-plane/test/platform-sqlite.mjs --test --test-force-exit <file>`; load average beside each]:

| run | tests | wall | loadavg at start |
|---|---|---|---|
| `r10-refused-kind`, moved | 3 / 3 pass | 3.2 s | 0.19 |
| `r10-pending`, moved | 3 / 3 pass | 2.1 s | 0.23 |
| `r10-pending`, original (plane's form, base worktree) | 3 / 3 pass | 26.8 s | 0.41 |
| `r10-refused-kind`, original | 3 / 3 pass | 17.8 s | (after the above) |
| screens-intake whole set with both moved (43 files) | 381 / 381 pass | 455 s | 2.13 at start, 6.89 at end, up to 13.4 between (other workers' jobs) |

Mutation checks [MEASURED, each reverted]: `reading-pipeline/index.mjs:2595` made to answer `tiff` for a GIF: `r10-refused-kind`'s seam test failed, its two table tests passed. `screens-intake/capture.mjs:273` (the stored-reading branch, R65) disabled: `r10-pending`'s two R65 tests failed, its control passed.

`p4 check screens-intake` (node `/root/process4/0eec86fd.../tool/p4.mjs check screens-intake`, in the moved worktree, 27 s, load 2.03) [MEASURED]: "Check of screens-intake: no disagreement found", `ok`, exit 0, with 2,387 "cannot tell" lines.

What the moved tests load [MEASURED: both files run with a `load` hook recording every file Node loaded, each mapped to its owner]: 745 files, the latest owner screens-intake (183) (`realworld.mjs`); none of a later module. The shared page harness's text reads of later modules' files (research 07, 13) were not re-counted.

The whole set's 455 s is not comparable with research 07's 351.7 s for the 41 base files: the machine's load rose from 2 to 13 during my run. The two files' own time inside it: R65 and R64 tests 0.1 to 1.8 s each (single runs above).

## The five that need reconstruction

The lane changed the brief while I worked: (c) is "needs reconstruction", and each such test gets (A) what it tests, (B) why it loads plane, the door or a later module, (C) a route that loads only its owner and earlier modules. The JSON carries A, B and C for every row; for these five in full. I found a route for all five, so no row is (e).

**`m/lines/invariants.test.mjs` :33 (lines R18), TRIED.** (A) `holderAt` has one implementation in the product, plus two checks over lines' fixture. (B) `:34-40` imports every `src/*/index.mjs`: 134 folders, 102 of them owned by modules after lines (66) [MEASURED: owner of each `src/<d>/index.mjs`]. Needed only for the claim about later modules. (C) Split: the census bounded at lines through the order, and each later module answering for itself (a census its own job runs, for example a helper test-support publishes). No re-stacking, no order change. On a scratch copy [MEASURED]: the folder list filtered to those whose `index.mjs` is owned by lines or an earlier module (32 folders), the line removed from `plane.json`; 4 of 4 pass; lines' whole set 38 of 38 in 4 s (load 6.7); a `load` hook saw 239 files, none of a module after 66; `export function holderAt` appended to `civil-time/index.mjs` turned the test red naming `civil-time`; `p4 check lines` reports 3 disagreements at `src/lines/index.mjs:628`, `:664`, `:682` (setup-words' stated interface), which the unchanged base reports identically, so none is about the test. What is lost: the check that no LATER module adds a `holderAt`, until each later module carries it.

**`m/instance-setup/worker-reports.test.mjs` (instance-setup R17-R19, R33-R42, R102).** (A) The report ops answer from the instance's bindings (no R2, a published `ADMIN_TOKEN`, a dead `DAEMON_TOKEN`, a retired member key, `STORE_LOCATION`) and its store; R42's compute listener. (B) Miniflare over plane's entry (`:17`) so the entry builds `env` and hands the ops on; `dist/SECRETS.txt` read for the published values (`:18-20`). Need only for "the entry hands these ops with its env", which is plane's own. (C) Split: the reports at instance-setup with each env variant through its fixture (`envOver`, `stubOver`; `reports.test.mjs:9`), the published values from `tokens.mjs`'s denylist as `reports.test.mjs:13-18` does; the store half over the world at store-assembly (174); the hand-off residue as a plane test. No re-stacking. Not tried.

**`m/screens-daily/casedrafts-seam.test.mjs` (screens-daily R87, R64).** (A) Home sends one `casedrafts` for the projects that share a draft; the answer holds each project's drafts. (B) The real door's arm for `casedrafts` (control-plane R20: a body list set as `projects` on the address, answered through `reviewAnswer`, `src/control-plane/index.mjs:2040-2046`); the world's door has no such arm [MEASURED: `grep casedrafts` in `store-request/door.mjs`: none]. (C) Split: the screen's one read over the world (already in `roster-real.test.mjs:36`, `home.test.mjs:793`), review's batch at review, control-plane R20 at control-plane over a real store. The single seam through the real door at the screen needs the re-stacking. Not tried.

**`m/screens-publish/door-seam.test.mjs` (screens-publish R73, C49).** (A) The ceremony asks for the other three copies in one `reviewcopy` with `drafts` and names each by its scope. (B) The real door's batch arm (`src/control-plane/index.mjs:1142`), which the world's door re-makes by hand (`store-request/door.mjs:555`). (C) Split as above (screen half over the world, the arm at control-plane, the batch at review); the whole seam needs the re-stacking, or the batch relay moved into an earlier module that both doors import (an interface change). Not tried.

**`m/screens-intake/t51-seam-g126h.test.mjs` (control-plane R131, the owed-work row, screens-intake R61).** (A) A sheet past the gate's ceiling is not read inline, its owed row exists (`op=owedwork`, now declared by store-assembly, `src/store-assembly/declared.mjs:25`, over store-services' `pending.mjs`), and its last row is found after the ticks; control: a small text is read inline. (B) The real gate, `src/control-plane/reading-gate.mjs` (owner control-plane 195 [MEASURED]), re-made by hand in the world's door (`store-request/door.mjs:135-155`). (C) Either move `reading-gate.mjs` (a function of size and kind over `READ_BOUNDS`) to an earlier module both doors import, then run at screens-intake over the world (an interface change, not the whole re-stacking); or split: the gate's rule at control-plane, deferral then ledger then search at store-assembly over the world, R61 in `t51-fix7` as now. Not tried.

Three more single tests, inside files I class (a), read a file of plane's: `scheduler/invariants.test.mjs:12` (plane's `wrangler.jsonc`), `store-assembly/sa-assembly.test.mjs:250` (plane's imports), `office-readers/r46-memory.test.mjs:96` (plane's shape probe). Each states something about plane's own files, so its route is to become a plane test, not a reconstruction.

## After a change

If the real door sat below the screens (the re-stacking of research 15 and 21), `casedrafts-seam`, `door-seam` and the door half of `t51-seam-g126h` would become (a) at their owners (INFERENCE from their reasons above). `worker-reports` and `lines/invariants :33` would not change: the first proves plane's entry, the second needs every module.

## What I did not check

- Per-assertion equivalence of the owner-equivalents: matched by requirement id and headers, not by comparing assertions (except where a line is cited).
- That each (a) placement actually runs: only `r10-pending` and `r10-refused-kind` were moved, and of the five needing reconstruction only `lines/invariants`. The (b) of `door-events` was not tried. The resolve-hook substitution for capture-requests' and scheduler's test set, livefire over the world's store, the OCR member as a world binding, and `op=capture`'s raw bytes through the world's door are all untried.
- Real R2 part rules and the 128 MB isolate memory, which the world does not emulate; no test of my set asserts memory except `office-readers :96`, which I leave to plane.
- Whether `stats-disclosure`'s arm D and the other legacy suites' uncarried assertions are proven elsewhere.
- GitHub's runner; `run scope`; plane's own run after the move. Timings are single runs on a machine shared with other workers (loads above).
- Whether the process counts the shared harness's text reads of later modules' files (research 07, 13) as use; `p4 check` did not.
