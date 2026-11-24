Length: 60 lines. Last section: "6. What is not known".

# The plane module's scope and the layers: design

The plane-scope lane's design. First written 23 Nov 2026 by civicsmith plane-scope lane #1 (sections 1 and 2, options A, B, C); rewritten 24 Nov 2026 by lane #2 after the layer research the owner asked for on 23 Nov (research 09 to 21, index `research/README.md`). The report of that research is the lane's second design page, https://claude.ai/artifact/HA4xENnaXEjX8cx4SQeAoL; the first page, https://claude.ai/artifact/X5PJuyRPjLtP9G7Wsry37L, holds options A, B, C. The module list, the order and interfaces are ARCH's to decide and build. Nothing here is built while development is halted, before the owner chooses a direction, or before ARCH says it can be built as given. Tags: measured, read, not checked (`research/evidence-rules.md`).

## 1. What plane is for

- Plane is the shell that makes civicsmith one running program on the hosting service: the store's class, the Worker's entry, the door's hooks, the watchdog, the build of its bundle and its deployment config (research 01, 02). Its own requirements are the 27 about that shell; its own proof is its 27 A1 tests.
- It is not the home of other modules' proof. It holds that proof because whole-program tests use every module and only the end of the order may, and because only plane's entry starts the real runtime (research 01, 02).

## 2. Option B, unchanged, with ARCH's terms

Plane keeps only its own proof; the whole-program proofs move to proof modules placed after plane. ARCH #11, 23 Nov 2026: B can be built as given: both modules directly after plane and before `release` (the platform-shape module, then the door module, planned as door A and door B, split further if a run passes about 20 minutes on GitHub); every test there names a requirement of its own module, which ARCH writes; the group C kits are their code; A2's 10 store-only tests judged at the build; plane #1's pull request (1259) keeps only A1. Plane's requirements file is corrected either way (research 01, item 3).

## 3. The re-stacking: the design

The owner's wanted order, lowest first: model, middleware, front door (control-plane), launcher (plane), UI (interface-assets, interface-shell, the screens parts). Today the door and the launcher sit after the UI.

1. **Order.** control-plane and plane directly after store-request; then the UI; then a new top module that owns the entry `bio-plane/src/plane/index.mjs` (path kept) and the UI plug-in `src/plane/ui.mjs`; then option B's proof modules; then release.
2. **The door knows no screen.** `makeFetch` is handed the UI as ready-made functions (page, script, script hash) plus the asset table and the public addresses, read from `hooks.ui`. With nothing handed in, every page route answers 404 JSON `NO_INTERFACE`; ops answer as before. (The trial handed in the builders, `interfacePage` and the rest, to change fewer lines; the design hands in composed functions so the door knows neither screens nor guide.)
3. **The launcher** keeps its start-up code in `src/plane/launch.mjs`, `Store` unchanged in `src/plane/store.mjs`. plane keeps `wrangler.jsonc`, `scripts/build-plane.mjs` and `dist/`, which name the entry only as a path held as text.
4. **The document builder moves below the door.** `titleOf` and `promoteDocument` move, unchanged, from the capture screen's file to `capture/filing.mjs` (capture, 56). The door's `deliverOwedRender` imports them; it keeps one argument and the store hands nothing in. K4493 names only the earlier process's session ("BOB's"), so by `process/ranking.md` it is rank 5; the lane decides this. capture's Purpose line "It writes no bundle" is reworded by ARCH.
5. **Shared text.** The 12 addresses and words the door and the UI each write (research 11, N01, N03 to N13) stay as they are through the move; afterwards each UI module may take them from the door by import, as its own job.
6. **Not part of this design:** the 20 modules that fit no one layer, and the layer definitions (research 10). `skills` is misplaced there as a shared foundation and belongs with the model: a correction to the map, not to code.

**Proven on a scratch copy (research 21, the design's join of research 15 and 16), measured on a quiet machine:** control-plane 564 of 564; plane A1 98 of 99 (the one failure fails on base); capture 366 of 366; screens-intake 375 of 375; interface-shell 321 of 321; the 13 delivery files 151 of 159, the same 8 failing as on base; 15 served answers and the page script byte-identical to base; the UI-less build answers ops and refuses pages; `p4 check` finds no disagreement in any code file. Code 7 files +261 -209; tests 10 files +23 -10. plane's l79 restart test: 30 of 30 on a quiet machine across base and both trials (research 20).

## 4. The lane's recommendation

- **First: option B and the capture move.** B is the only choice that fixes plane's scope, the problem the lane was opened for. The capture move is the cheapest measured step toward the owner's order and removes the one call of UI code from background work.
- **Then the re-stacking, as small steps, if the owner chooses that direction.** After B, the tests the re-stacking must move shrink from 121 to about 27 (control-plane's 20 and plane's 7 A1 files that reach the entry; worked out from research 15's refused list, not run).
- **The case against re-stacking now** (research 19): it does not fix plane's scope; it costs the most text (163 requirements in 26 modules pin today's order, about 112 likely to need rewording); the door still refers to the UI by what it is handed; no recorded user needs the UI-less program; it overlaps PR 1259. **The case for:** the door imports nothing of the UI, a UI-less program builds and runs, nothing users get changes, and the order then allows screens tests to use the real door and the UI to take shared text from the door (both not checked).
- The direction is the owner's: he asked for this order, but there is no marked decision for it.

## 5. The plan

Each step is one merge that passes on its own (Process4 design part 2, section 8). Requirement text and the module list are ARCH's; "job" is one module's job.

1. ARCH: B's list change (proof modules after plane; requirements; tests by path).
2. Job plane: PR 1259 keeps only A1 and goes on; its blocked record (store-assembly's `deliver` option) is separate.
3. ARCH: capture's Purpose reworded; requirements for the two functions.
4. Job capture: `capture/filing.mjs` with the two functions; nothing uses it yet.
5. Job screens-capture: the screen uses capture's copy and drops its own (page script byte-identical, research 16).
6. Job control-plane: `deliverOwedRender` imports from capture; its six test files re-pointed.
7. Job control-plane: `makeFetch` accepts `hooks.ui`, keeping its own UI imports as a fallback.
8. Job plane: `launch.mjs` split from the entry; the entry hands the UI in (plane is still after the UI).
9. ARCH rewords the door's page requirements; job control-plane drops its UI imports and the fallback, adds `NO_INTERFACE`, and its 9 page test files take the UI from a test helper.
10. ARCH: the top module after plane, owning the entry and `ui.mjs`, and the 27 test files that reach the entry; UI names out of plane's `uses`.
11. ARCH: the remaining requirements that state today's order; its "Module list" decision and the rulings that name today's places (K5046, K5052) rewritten in place.
12. ARCH: control-plane and plane moved to directly after store-request, merged only once `p4 check` on that list finds nothing for either.
13. Follow-ons, each its own job: UI modules import the shared text from the door; screens tests may use the real door; `bio-plane/test/declared-ops.mjs` stops reading later modules' files (test-support).

Dependencies: the halt and the owner's choice; PR 1259 shares 2 files with steps 7 to 9 and none with steps 3 to 6; `control-plane.md` (121 KB) and `interface-shell.md` (120 KB) are over the 60 KB single-text maximum and are split by ARCH before steps 9 and 11; after step 12 the 19 UI modules are later modules of the door and the launcher, so their changes tell more modules.

## 6. What is not known

- Which of the 112 requirements truly need rewording; whether `p4 check` passes at step 12; how many notices the door's changes cause after it; B's proof modules' run times.
- About 190 test files that reach changed files were not run on a changed copy; each set ran once on the joined copy; an owed render delivered by the alarm in the built program; screens tests over the real door.
- The full list is the report's section "What is not known".
