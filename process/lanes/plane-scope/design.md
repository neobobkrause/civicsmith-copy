Length: 92 lines. Last section: "8. What is not known".

# The plane module's scope and the layers: design

The plane-scope lane's design as it stands on 24 Nov 2026 (civicsmith plane-scope lane #3). It states the current design only. The evidence is the lane's research (index `research/README.md`); the owner's report is https://claude.ai/artifact/HA4xENnaXEjX8cx4SQeAoL, the first page https://claude.ai/artifact/X5PJuyRPjLtP9G7Wsry37L. The module list, the order, interfaces and requirement text are ARCH's to decide and build. Nothing here is built while development is halted, or before the owner chooses the direction. ARCH has said it can be built as given (section 6). Tags: measured, read, not checked (`research/evidence-rules.md`).

## 1. The rule

- Each module's promises are proven by that module's own tests, so that its own job finds its flaws. A whole-program test moves to the module it proves. A test that today loads a later module is rebuilt so that it does not. A test stays at the end of the order only when its route fails as it is built; its reason is then written at the test, and only then is a proof module after plane made for it.
- ARCH's condition (24 Nov 2026): a test moved to its owner loads only that module and earlier ones, and no copy of a later one. `p4 check` at the owner's job is the judge.
- Plane is the launcher: the store's class, the Worker's start-up, the watchdog, the build and the deployment config (research 01, 02). Its own proof is its 27 own test files. The other 120 files its record names prove other modules' promises (research 02).
- None of the 120 was found to need the assembled program (research 22a, 22b, 22c: each test read). 17 of the 120 were moved or rebuilt on scratch copies and pass at the owner with `p4 check` clean there: 12 in research 22a to 22c, 2 in research 07 and 08, 3 in research 23.

## 2. The architecture

The owner's layers, lowest first: model, middleware, front door, launcher, UI. Today the door (`control-plane`, 195) and the launcher (`plane`, 196) sit after the UI (176 to 194).

1. **Order.** After `store-request` (175): `control-plane`, `plane`, the 19 UI modules, one new top module, then `release` and what follows it.
2. **The routing belongs to the door.** `plane/door.mjs` (`publicOp`, `gatedOp`: which owner's handler answers each op, with the stamps it hands) moves unchanged into `control-plane` as `src/control-plane/routing.mjs`, importing the four helpers from `./index.mjs`. Plane hands it to `makeFetch` as today. control-plane declares `host-governor` and `ratification`, which the routing imports. The door's own tests then import the real routing; no test re-makes it (K4990). Research 23, variant C.
3. **The door knows no screen.** `makeFetch` is handed the UI as ready-made functions (page, script, script hash), the asset table and the public addresses, read from `hooks.ui`. With nothing handed in, every page route answers 404 JSON `NO_INTERFACE`; ops answer as before.
4. **The launcher** keeps its start-up code in `src/plane/launch.mjs`, `Store` unchanged in `src/plane/store.mjs`, and `wrangler.jsonc`, `scripts/build-plane.mjs` and `dist/`, which name the entry only as a path held as text.
5. **The document builder sits below the door.** `titleOf` and `promoteDocument` move unchanged from the capture screen's file to `capture/filing.mjs` (capture, 56); the door's `deliverOwedRender` imports them. K4493 names only the earlier process's session, so it ranks 5 (`process/ranking.md`) and this is the lane's call. capture's Purpose line "It writes no bundle" is reworded by ARCH.
6. **The top module** owns the entry `bio-plane/src/plane/index.mjs` (path kept) and `src/plane/ui.mjs`. Its promise is the assembled program: the UI plugged into the launcher, the page served end to end. Its tests are the only ones that boot the entry.
7. **Shared text.** The 11 addresses and words the door and the UI each still write (research 11, N01, N03 to N12) and the built manifest's list of UI files (N13) stay as they are through the move; afterwards each UI module may take them from the door by import, as its own job.
8. **Not part of this design:** the 20 modules that fit no one layer and the layer definitions (research 10). `skills` belongs with the model: a correction to the map, not to code.

Why the routing goes into the door and not into a module before it (research 23, measured on scratch copies of `a26a8da2`): placed in the door, control-plane's whole set passes 569 of 569 and the built bundle is byte-identical to base's. A new module after `store-request` passes too, but only with the four helpers in a second file (variant N2): one file that both the routing and the door import makes 76 of control-plane's 98 test files fail at load ("a second registration"), because the routing's import of `store-assembly/index.mjs` registers every owner's ops before the door's test harness does. Inside `store-request` it also breaks that module's own census test (R21). The door is the routing's natural owner: deciding which handler answers an op is front-door work, and it needs no new module or order entry.

## 3. Where each whole-program test goes

By class (22a, 22b by test; 22c by file):

| Tests of | Plain test at the owner | Real runtime, test-only store at the owner | Rebuilt by a route found | Duplicate, dropped | No route |
|---|---|---|---|---|---|
| Platform behaviour and the odd ones (34 files) | 12 | 10 | 11 | 1 | 0 |
| The door's promises (46 files, 133 tests) | 121 | 8 | 3 | 1 | 0 |
| Other modules' promises (40 files) | 24 | 1 | 5 | 10 | 0 |

Where they land (`research/classify/22a.json`, `22b.json`, `22c.json` give each test's destination, its reason and its route):

- **control-plane:** the 46 door files, `g42-storage-seam`, `r8-wave`, and the door's halves of the split tests. Plain tests run `makeFetch` with the real routing over store-request's world (`real-door.mjs`); the 8 runtime tests run under Miniflare through a test-only Durable Object built from earlier modules (`door-object-entry.mjs`, which adds `scheduler` to control-plane's declared uses). The seam kit `r8-kit.mjs` becomes control-plane's, rewritten over the real door; it is moved, not copied. Inputs the tests now make with screen code (`promoteDocument`, `PARTS.sitting`, `PARTS.caseArgs`; 70 tests) are made with store-request's recipes instead.
- **The top module:** the 14 door tests that assert screens drawn over the door, and plane's own test files that boot the entry (taken from `p4 check`'s refusals at that step).
- **The composed store** (`store-services`, `store-assembly`, `store-request`, 173 to 175): the platform tests and the other-module tests whose behaviour exists only once the store is assembled. An owner earlier than 173 cannot hold these; its own interface tests stay as they are.
- **Each UI module** (screens-intake, screens-inquiry, screens-daily, screens-publish): its seam tests, over store-request's world now, over the real door once the door is below it.
- **Their own modules:** affordances, host-governor, instance-setup, lines, office-readers, reading-pipeline, scheduler, test-support, extraction's split half.
- **agent-worker's four:** their checks of later modules become contract checks at the provider (admission, control-plane, answer-envelope), as K4995 rules for a later provider; their checks of earlier modules use those modules' published fixtures.
- **`migrate-released`:** properties 3 to 5 at store-assembly over the captured stores; property 2, the door's answers on a migrated store, at control-plane, whose routing now answers `selftest` too. This needs ARCH's decision "Stores written by past releases" rewritten.
- **Plane keeps** its 27 own files and the halves of split tests that state plane's own files: `limits` against `wrangler.jsonc`, `t51-hops`' join of plane's timing header, `r9-memory`'s total with the bundle (plane R100), the deployed cron, plane's imports of store-assembly.
- **Dropped:** 12 duplicates; 9 are legacy suites already ruled for deletion at the release (K619).

## 4. What is proven on scratch copies

All on `a26a8da2`, measured, each re-run by the lane from the saved patch: the capture move and the door taking its UI from outside, joined (research 21: control-plane 564 of 564, capture 366 of 366, the served answers and page script byte-identical); the routing in the door with three door tests over the real routing (research 23: control-plane 569 of 569, re-run by the lane from the saved patch (179 s, load 0.8 to 2.5), three arm paths, mutations of the routing turn each red); 12 whole-program test files moved or rebuilt at store-assembly, test-support, control-plane, plane, screens-intake and lines (research 22a to 22c, each with `p4 check` clean at the owner; the lane re-ran the 10 held in the saved patches). Moved door tests run in 1.5 to 2.2 s in Node against 17 to 23 s over plane.

## 5. The plan

One sequence. Each step is one merge that passes on its own (Process4 design part 2, section 8). "ARCH" is the module list or requirement text, which runs no tests; "job" is one module's job. Tests move with the step that makes their route possible, so no test moves twice.

1. **The capture move.** ARCH rewords capture's Purpose and adds requirements for the two functions. Job capture adds `capture/filing.mjs`. Job screens-capture uses it and drops its own copy. Job control-plane's `deliverOwedRender` imports it; its 6 test files re-point.
2. **The routing into the door.** ARCH writes the routing's requirements at control-plane (from plane R6, R112 and their kin), adds `host-governor` and `ratification` to its uses, and rewords plane R6 (plane hands the door the door's own routing). Job control-plane adds `routing.mjs`. Job plane's entry imports it, deletes `door.mjs`, and re-points the 8 plane tests that import it.
3. **Tests to their owners.** For each owner, ARCH gives it the tests and places the rebuild as its work. The owner's job writes each rebuilt test as its own new file in its own tests folder, declaring only earlier modules; the module that holds the old file removes it in its next job, so no test stays in two places. Inputs are made with store-request's recipes, never with screen code; where a recipe is missing, the job reports it to ARCH as a flaw in store-request, placed before the test moves. Owners earliest in the order first. The door's 46 files and `r8-wave` follow step 2. agent-worker's contract checks and `migrate-released` come with ARCH's rewritten decision. The 14 screen-asserting door tests stay with plane until step 6. Duplicates are dropped in the same pass. No module's whole run may approach the 45-minute limit: store-assembly takes the memory-capped shape runs only if its run stays clearly under it, otherwise ARCH splits it.
4. **Splits.** Job control-plane moves a part out of `index.mjs`; ARCH splits `control-plane` and then `interface-shell` along existing file boundaries, keeping requirement numbers (ARCH's steps 8a and 8b).
5. **The door takes its UI from outside.** Job control-plane accepts `hooks.ui` and keeps its own UI imports as the fallback (accept-both). Job plane splits `launch.mjs` from the entry; the entry hands the UI in. ARCH rewords the door's page requirements and writes `NO_INTERFACE`; job control-plane drops its UI imports and the fallback, adds `NO_INTERFACE`, and its 9 page test files take the UI from a test helper.
6. **The top module.** ARCH adds it after plane, owning the entry and `ui.mjs`, with the 14 screen-asserting door tests and the test files that reach the entry (the list taken from `p4 check`'s refusals at this step); the UI leaves plane's declared uses.
7. **The move.** ARCH rewords the remaining requirements that state today's order and rewrites its "Module list" decision and the rulings that name today's places (K5046, K5052); then moves `control-plane` and `plane` to directly after `store-request`, merged only once `p4 check` on that list finds nothing in either's code. If it finds something in code, the boundary is an architecture bug and the step comes back to the lane; it is not worked round.
8. **After the move, each its own job:** the screens' seam tests that need the real door (`casedrafts-seam`, `door-seam`, `t51-seam-g126h`) take it; the UI modules take the shared text from the door; `bio-plane/test/declared-ops.mjs` stops reading later modules' files (test-support).

## 6. ARCH's answer and conditions

ARCH #11, 24 Nov 2026: this can be built as given, the routing in control-plane included (`src/control-plane/routing.mjs`; control-plane declares `host-governor` and `ratification`), on these conditions:

1. It is built on main's code. The owner has dropped tranche t1 (ARCH reports his decision of 24 Nov); however the drop is carried out, the plan starts from the code as it stands after it. The lane's trials ran on `a26a8da2`, tranche code: they are evidence, not proof. Every route is proven again at its own job on the code as it is then; that job's run with `p4 check` is the judge.
2. Each step waits on the owner's marked choice of this direction and on the halt being lifted. ARCH then records its decisions (the routing into the door; tests to their owners; "Stores written by past releases" rewritten; agent-worker's checks as contract checks), one pull request each.
3. Step 3's mechanics as section 5 gives them: a new file at the owner, the old one removed by its holder's next job; no test in two places.
4. A missing store-request recipe is a flaw in store-request, reported to ARCH and placed before the test moves. No test makes its input with screen code.
5. No module's whole run may approach the 45-minute limit; store-assembly takes the shape runs only if it stays clearly under, otherwise ARCH splits it.
6. Rewordings of the order-stating requirements at step 7: a clearer wording ARCH makes and names in the account; one that changes what the product does goes to the owner first.
7. Step 7 merges only when `p4 check` finds nothing in either module's code; otherwise it comes back to the lane.

ARCH's eight conditions of 24 Nov on the earlier plan stand where this plan keeps them: (1) nothing built while the halt stands or before the owner's choice; (2) the splits (step 4) before the door drops its UI imports (step 5); (3) step 5's fallback in the accept-both form, removed only after plane's entry hands the UI in; (4) `NO_INTERFACE` written as a new requirement of an unshipped build and named in the account; (5) the move as step 7 says; (6) plane keeps `wrangler.jsonc`, `build-plane.mjs` and `bio-plane/dist/`; (7) the owed render delivered by the alarm inside the built program is a walk area of the round that lands step 5, and the notice load after step 7 and the owners' run times are measured as they come and reported; (8) step 6's test list is taken from `check`'s refusals at that step.

## 7. If a route fails

A test whose route fails as it is built stays with plane until the end of the plan, with its reason written at the test. If any remain then, ARCH makes one proof module directly after the top module for them, as the earlier option B gave (both after plane and before `release`; each test naming a requirement of its own module). None is planned.

## 8. What is not known

- Whether every route holds as built on main's code: 17 test files of 120 were moved or rebuilt, on tranche code (`a26a8da2`); the rest are classed by reading.
- The run times of the owners that gain tests, store-assembly most (it gains the memory-capped shape runs).
- Whether store-request's recipes make every input the 70 door tests now make with screen code (not checked test by test).
- Which of the 163 requirements that state today's order truly need rewording (about 112 judged); whether `p4 check` passes at step 7; the notices the door's changes send after it.
- About 190 test files that reach changed files were not run on a changed copy; the owed render delivered by the alarm in the built program; the screens' tests over the real door.
