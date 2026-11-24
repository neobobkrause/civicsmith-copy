Length: 291 lines. Last section: "What I did not check".

# 15. Trial: the door and the launcher below the UI, the UI handed in from a top entry

Research worker for plane-scope lane #1, 23 to 24 Nov 2026. A working trial on a scratch copy, not a design. Base: `origin/p4-tranche` `a26a8da2`. Tags follow `evidence-rules.md`. `cp/` is `bio-plane/src/control-plane/`, `pl/` is `bio-plane/src/plane/`; test paths without a root are under `bio-plane/test/m/`. "UI" means the 19 modules at 176 to 194 of the commit's `order.txt`. Data: `trial-door/results.json`; the change: `trial-door/diff.patch`. "After" always describes the scratch copy, never the product.

## Headlines

1. **Does the door's or the launcher's code reach any UI file after the change? No by import, by path held as text or by run-time read: 0 UI files from each of the 10 control-plane files and the 5 launcher files, by esbuild's metafile and by an import walk that agree. Yes in rule 7's last sense: the door calls 7 functions and reads 4 values that the top entry hands it, and at run time those are the UI's.** Latest module reached: `cp/index.mjs` store-request (175); the launcher's files control-plane, then store-request and store-assembly. [MEASURED, section 4]
2. **Tests, before and after** (tests / pass / fail): control-plane's whole set 564 / 564 / 0 before; 564 / 533 / 31 after the change with tests untouched; 564 / 564 / 0 after 12 of its test files had their setup changed. plane's 27 composition-root files: 97 of 99 pass before; 95 after, with tests untouched and again with one test fixed; 99 of 99 in a run of both trees at the same time, where the unchanged tree passed 97. The sample of 12 whole-plane files 39 / 37 / 2 before and after, the same two failing. interface-shell 321 / 321 and screens-intake 375 / 375, before and after. [MEASURED, sections 1 and 5]
3. **35 tests changed result with the tests untouched. 32 are tests that made the door, the delivery or the Store themselves without what the top entry now hands in (class i); 0 real differences in behaviour found (class ii); 0 unclear; 3 are timing tests of alarms and restarts, not classed.** Two of those, in `plane/r8-heal-door.test.mjs`, fail by turns on both trees. The third, `plane/l79.test.mjs` "a restart over the same storage", failed in 2 of the changed tree's 3 set runs and in neither of the unchanged tree's 2; alone, and with both trees run at the same time, it passed on both. I think it is load; I did not establish it. [MEASURED, section 5]
4. **Bundle 28,418,158 bytes and 853 inputs before; 28,419,491 (+1,333) and 855 after: the same inputs plus the two new files. Start-up: no difference outside the noise** (eight interleaved rounds, median of five-import medians 688 ms before and 633 ms after, paired differences from -192 to +94 ms, 3 up and 5 down). The built program serves the same bytes for 15 requests under workerd, but only because one top-level variable kept its name. [MEASURED, section 6]
5. **A program with no UI builds and runs**: 25,141,248 bytes, 724 inputs, start-up lower than the full program in 8 rounds of 8 (median 56 ms lower); under workerd `/version` and `op=bootstrap` answer 200 as before and `/app` answers 404 JSON `NO_INTERFACE`, my choice of answer. [MEASURED, section 7]
6. **`p4 check` on the scratch order** (door and launcher directly after store-request, a new last module `product` owning the top entry): product, interface-shell, screens-intake and screens-action "no disagreement found"; control-plane 52 disagreements, plane 159 (48 of them it had before), every new one an import of a later module by a test-side file, none by a code file. [MEASURED, section 8]
7. **Test files that the new order would refuse where they are: 20 of control-plane's 95 and 101 of plane's 147.** 100 of plane's 101 start or import the top entry. [MEASURED, static, section 8]
8. **Size**: 6 code files, +170 -107 (59 of the added lines are the old entry moved); 14 test files, +33 -14; 4 module-list files and one trial-only entry. [MEASURED, section 9]
9. My 15 choices and their alternatives are in section 10. The least-change variant (the top entry keeps the path `src/plane/index.mjs`) met no trouble that a new path would cure, so the other was not tried.

## Set-up and commands

- **Scratch worktree, left in place:** `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/trialA` (`git worktree add --detach … origin/p4-tranche`; `node_modules` symlinked for `bio-plane`, `agent-runner`, `file-scanner`, `newgroup`, `ocr-worker`, `pdf-worker`, `sheet-worker`). It holds the change, the test fixes of section 5 and the scratch module list of section 8; nothing is committed. `git status --short` there lists 20 modified and 5 new files; `git reset -q && git checkout -- . && git clean -fdq` returns it to the base (the `node_modules` links are ignored and stay).
- **My scripts (named below as `x.mjs`) and every raw output:** the scratch folder `…/scratchpad/tA/`, which can be cleared; `trial-door/results.json` keeps the tables.
- Two twins made beside it and removed at the end: `trialA-draft` (the change was written there while the baseline ran in `trialA`) and `trialA-base` (unchanged, to run the old code beside the new).
- **Machine:** 4 vCPU Xeon 2.10 GHz, 15 GB, Node 26.10.0, esbuild 0.25.12, miniflare 4.20260722.0, a shallow clone. Other workers ran tests on it throughout: the 1-minute load was between 3 and 19 and is written beside every timing. The container was restarted once, at about 23:56; the one run then in flight (the start-up rounds) was discarded and run again. Every result used is from a run that finished.
- **How a set was run.** The required run's part two runs `cfg.test_command` over a module's test files in one call, from the top folder, token variables and `NODE_TEST_CONTEXT` removed (`tool/lib/scope.mjs:79-88` [READ]). `runset.mjs` runs that command, `node --import ./bio-plane/test/platform-sqlite.mjs --test <files>`, with spec and junit reporter flags added so that each test's result is kept; I did not drive `p4 run tests` for the measured runs. A module's files are the tool's own `testFiles()` (`scope.mjs:14-16`). Counts are the runner's summary lines; tests are compared by the junit file's leaf cases, keyed by file and full name, whose totals equal the runner's for every set [MEASURED].
- **One module through the tool itself:** `p4.mjs run tests --scope <a hand-made scope naming interface-assets>` on the unchanged twin printed `Check of interface-assets: no disagreement found` and `tests 22, pass 13, fail 9`, the counts `runset.mjs` gave for that file [MEASURED] (9 fail for want of commit `2a64c5ae77` in this shallow clone).

## 1. Baseline (step 0), in the scratch worktree before any change

| set | files | tests / pass / fail | seconds (1-min load, start to end) |
|---|---|---|---|
| (a) control-plane's whole own set | 95 | 564 / 564 / 0 | 491.6 (11.1 to 10.2) |
| (b) plane's 27 composition-root files (A1 of `02-test-map.md`) | 27 | 99 / 97 / 1, and 1 cancelled | 374.7 (5.3 to 8.0) |
| (c) sample of 12 whole-plane Miniflare files | 12 | 39 / 37 / 2 | 224.9 (8.0 to 8.8) |
| (d) interface-shell's whole own set | 37 | 321 / 321 / 0 | 143.8 (8.8 to 6.2) |
| (d) screens-intake's whole own set | 41 | 375 / 375 / 0 | 557.7 (6.2 to 11.1) |
| (e) `plane/t48.test.mjs --test-name-pattern=R54` | 1 | 1 / 1 / 0 | 9.8 (4.9 to 5.3) |

All [MEASURED]. Baseline failures, none of them the trial's:

- (b) `plane/r8-heal-door.test.mjs`, 2 tests: `R102 G93 L: a row owed and the alarm deleted…` (`test timed out after 180000ms`) and `R102 G93 L: a member's ordinary read (op=whoami) re-arms a lost alarm as well` (`1 live row(s) and no alarm: ["owed"]`). Timing tests; section 5 shows them failing by turns.
- (c) `control-plane/t51-round10-seam-csvprose.test.mjs`, `R100 (csv-reader R26)…`: `a real three-column CSV named .txt is a table` is false. Not investigated; it fails the same way after the change.
- (c) `bio-plane/test/tier2-wire.test.mjs` fails as a file at load: `ENOENT … pdf-worker/dist/pdf-worker.bundled.mjs`, a built bundle that is not tracked and that I did not build. So 11 of the sample's 12 files really ran, on both sides.

**The sample (c).** Pool: the 81 rows of `02-test-map.md` section B whose "boots" column starts `MF`, that exist, are named `*.test.mjs` and are plane's by `ownerOf` (all 86 rows of B are). Shuffle: `mulberry32` seeded 20261123, Fisher-Yates over the sorted pool, first 12 (`sets.mjs`). The 12: `bio-plane/test/d526-refusal-order`, `tier2-wire`; `control-plane/t51-hops`, `t51-round10-seam-csvprose`, `t51-round10-seam-htmlparts`, `walk-investigate-door`, `walk-selection-not-yours`; `host-governor/ops`; `scheduler/plane`; `screens-inquiry/g41-document`, `r10-question-seam`; `screens-intake/t51-seam-g126h` (each `.test.mjs`).

**Build and start, before.** `node scripts/build-plane.mjs`: 28,418,158 bytes, sha256 `da5f1a92c71a13f4bb99eeb66b5db289c080f808f3decba3c8ea2cffa18754fc`, 853 inputs, 0 vendored, the same twice. The R54 test printed `five fresh imports: 640, 723, 828, 940, 752 ms; median 752 ms, budget 500 ms: warn`.

## 2. The change (step 1), in the scratch copy

Six product files and one trial-only entry; the whole `git diff` is `trial-door/diff.patch`. All [READ] in the scratch worktree.

| file | owner in the trial | what changed |
|---|---|---|
| `cp/index.mjs` | control-plane | The 12 UI import statements are gone (old lines 39, 52 to 62) with `APP_SCREENS` and `APP_OPTIONS`. `makeFetch` reads `hooks.ui` once; `page()`, the script route and the asset route call `ui.interfaceScriptHash(ui.screens, options)`, `ui.interfacePage`, `ui.pageWork()`, `ui.interfaceScript(ui.screens, …)` and read `ui.assets`; `appOptions(env, ui)` puts `ui.guide` where `WIZARD_GUIDE` was. `deliverOwedRender(args, composer = {})` takes the capture screen's two functions as a second argument. New: `noInterface()`, the answer when nothing was handed in. |
| `cp/app.mjs` | control-plane | Its one import (T01) is gone: `appRouteOf(req, url, { versionOfScriptPath } = {})` and `appScript(…, { source, version, versionOfScriptPath })` are handed the parser. `PUBLIC_ALIASES` is gone (N02): `addressPageOf(req, url, { opNamed, publicAddresses = [] })`. |
| `pl/launch.mjs` (new, 82 lines: the old `index.mjs`, 59 of its 71 lines unchanged) | plane | Today's launcher code. Its end is `export function launch(parts = {})`, which makes the door over `parts.ui` and returns `{ fetch, scheduled }`; it re-exports `Store` and `storeWith`. `bindPublishedPlane({…})` still runs when the file loads. The door-maker is a top-level `const door`, a name kept on purpose (section 6). |
| `pl/store.mjs` | plane | The constructor takes a third argument, `composer = null`, and hands `assembleStore` `deliver: (a) => deliverOwedRender(a, composer \|\| {})`. New: `storeWith(composer)`, which returns a subclass whose constructor passes the composer on. The file still exports `Store`, now a class with no composer. |
| `pl/ui.mjs` (new, 31 lines) | the trial's top module | The only file that imports the UI for the program: interface-shell, interface-assets, the nine `SCREENS`, `GUIDE`, `CAPTURE_SCREEN`. Exports `INTERFACE` (the door's `hooks.ui`) and `DOCUMENT_COMPOSER` (`{titleOf, promoteDocument}`). |
| `pl/index.mjs` (rewritten, 11 lines) | the trial's top module | `import { launch, storeWith } from "./launch.mjs";` then `import { INTERFACE, DOCUMENT_COMPOSER } from "./ui.mjs";`; `export const Store = storeWith(DOCUMENT_COMPOSER);` `export default launch({ ui: INTERFACE });`. |
| `bio-plane/trial-door/launcher-only.mjs` (new, 7 lines) | none (trial only) | The UI-less entry of step 4: `export { Store }` from `launch.mjs` and `export default launch();`. |

`bio-plane/wrangler.jsonc:11`, `bio-plane/scripts/fleet-bundle.mjs:522` and every test were left as they were for the first measurement. The door hands the page builder `{guide, testInstance, version}` as before (`appOptions`), so it still knows those three option names (tie N04 of research 11).

**Ownership this variant implies.** `pl/index.mjs` and `pl/ui.mjs` sit in plane's folder but belong to a new last module of the stack, named by their exact paths in its record; plane keeps the folder. The tool accepts that (section 8). plane's `wrangler.jsonc` then names a file of the module above it.

## 3. The start order, by running

`order.mjs` imports named pieces one after another in one Node process (`cloudflare:workers` answered by a stand-in class); `order2.mjs` loads one file, then `store-assembly/index.mjs`. All [MEASURED].

| run | tree | result |
|---|---|---|
| `cp/index.mjs`, then `store-assembly/index.mjs` | unchanged | second step throws `op-declarations: adminendorse: registered after the first read (R81)` |
| the 12 UI files the door imported, then `store-assembly/index.mjs` | unchanged | the same throw; `OPS` then holds 1,029 keys, not 1,068 |
| the 12 UI files, then `interfacePage(nine lists)` | unchanged | throws `interface-shell: screen members's act names expertisewithdraw, which OPS does not hold` |
| `store-assembly/index.mjs`, the UI files, `interfacePage` | unchanged | a page of 3,512 characters |
| one file, then `store-assembly/index.mjs`, for 19 files | unchanged | the registration throws after `screens-daily/index.mjs`, `screens-action/index.mjs` and `store-request/index.mjs`; not after the other 16 (interface-assets, interface-shell's two files, the other seven screens modules' `index.mjs`, `capture.mjs`, `op-grades`, `wizard-scripts`, `cp/app.mjs`, `admission`, `answer-envelope`) |
| `pl/index.mjs`, then `GET /app` through its default export | changed | 200; `OPS` 1,068 |
| `pl/ui.mjs`, then `pl/launch.mjs` | changed | the second throws the R81 message |
| an entry with the two import lines swapped (`ui.mjs` first) | changed | throws the R81 message at load |
| `store-assembly/index.mjs`, `pl/ui.mjs`, `pl/launch.mjs` | changed | all load; `OPS` 1,068 |

So, measured: the registration (`store-assembly/register.mjs:8` `assembleDeclaredOps();`, at load [READ]) must load before `cp/index.mjs`, before `store-request/index.mjs`, and before two UI modules, screens-daily and screens-action, which read the op tables when they load (`screens-daily/home.mjs:19`, `queue.mjs:19`, `screens-action/action.mjs:9`, `start-send.mjs:6` import `OPS` [READ]; which statement reads it was not traced). It must also have loaded before interface-shell composes a page, which happens at the first page request, not at load.

**What guarantees it in the trial's arrangement:** two things, both orderings of import lines. `pl/launch.mjs:10` keeps `import "../store-assembly/index.mjs";` as its first import, and `pl/index.mjs:6-7` imports `./launch.mjs` before `./ui.mjs`. Swapping the entry's two lines fails loudly at load (row 8), not silently. An alternative that does not rest on the entry's line order: `ui.mjs` importing `store-assembly/index.mjs` itself (the last row shows that order loads); not tried further.

**A silent form of the same fault exists in tests.** [MEASURED] A test helper of mine that imported `pl/ui.mjs` statically beside control-plane's `register-declared.mjs` (which registers with a top-level `await`) left the tables at 1,029 ops: the screens' load-time read came first, the registration then threw R81, and `test/m/control-plane/register-declared.mjs:14-18` lets exactly that refusal pass. Nine tests then failed, with that `expertisewithdraw` message or the door's internal-error answer for it. Importing `ui.mjs` with `await import(...)` after the harness cured it.

One input of the entry, `case-checker/main.mjs`, holds a top-level `await` in a Node-only branch (`:58`) [MEASURED: esbuild refuses a `cjs` build of the entry for it]. What the module standard's rules for such a module do to the order was not analysed; the runs above, the built bundle under workerd (section 6) and the Miniflare tests from source (sets b, c) are the evidence that the trial's order holds.

## 4. Is the inversion real? (step 2.1)

`reach.mjs` gives each file's closure twice: by esbuild's metafile (research 11's `build({… bundle: true, metafile: true …})`, one file at a time) and by my own walk (a regular expression over static and literal dynamic imports of relative paths). The two closures were the same set for every file below (`only-esbuild 0 only-walk 0`, no unresolved specifier). "UI files" are files owned by the 19 modules at 176 to 194 of the commit's order. [MEASURED]

| file | files reached | UI files | latest other module reached (trial's order) |
|---|---|---|---|
| `cp/index.mjs` | 631 | 0 | store-request (175); then signin-door, answer-envelope |
| `cp/jobs.mjs` / `draft.mjs` / `archive.mjs` / `reading-gate.mjs` / `storage-words.mjs` | 581 / 321 / 46 / 14 / 3 | 0 each | answer-envelope / wizard-scripts / promotion / odf-reader / setup-words |
| `cp/app.mjs`, `job-state.mjs`, `phase-clock.mjs`, `words-cache.mjs` | 1 each | 0 | none |
| `pl/launch.mjs` | 723 | 0 | control-plane; then store-request (175), store-assembly (174) |
| `pl/store.mjs` / `pl/door.mjs` | 716 / 719 | 0 / 0 | control-plane; then store-request, store-assembly |
| `pl/watchdog.mjs` / `pl/arrival.mjs` | 2 / 1 | 0 / 0 | runtime-limits (10) / none |
| `trial-door/launcher-only.mjs` | 724 | 0 | plane |
| for contrast, `pl/index.mjs` (top entry) / `pl/ui.mjs` | 855 / 697 | 130 / 130 | screens-action |

Before the change `cp/index.mjs` reached 761 files, 130 of them UI (research 11, M2); the 631 here is research 11's "UI cut" figure (M3). The other direction is unchanged: the 131 UI code files reach 697 files, none under `src/control-plane/` or `src/plane/` [MEASURED: one esbuild call over the 131 files].

**Rule 7's other routes, in the 15 door and launcher code files** (`nonimport.mjs`, on comment-free text from esbuild's transform) [MEASURED]:

- a file read, folder listing, dynamic `import(`, `import.meta`, `require(`, child process: 0 hits in all 15;
- a UI folder name (`interface-shell`, `interface-assets`, `screens-…`) in any string or identifier: 0 hits in all 15;
- **values handed in and called or read: yes, 11.** `cp/index.mjs` calls `ui.interfaceScriptHash`, `ui.interfacePage` (through `appPage`), `ui.pageWork`, `ui.interfaceScript`, `ui.versionOfScriptPath` (through `app.mjs`), `composer.titleOf`, `composer.promoteDocument`, and reads `ui.screens`, `ui.guide`, `ui.assets`, `ui.publicAddresses`. At run time these are the UI's functions and tables. This is rule 7's "a value it registers that is called": the reference is by a handed value, with no name or path of the UI in the door's text.
- page addresses still written in the door (ties N01, N03): `cp/app.mjs` `const APP = "/app";`, `const ASSETS = "/app/assets/";`, `const GROUP_LOGO = "group-logo";`, and two content types. Untouched by the trial.

**Launcher-owned files that are not code.** `bio-plane/wrangler.jsonc:11` `"main": "src/plane/index.mjs",` [READ] is a plane file naming, as text wrangler uses, a file the trial gives to the top module; `scripts/build-plane.mjs` builds from that path through `fleet-bundle.mjs:522`, and `dist/` holds the result. These three stayed with plane.

## 5. The tests after the change (step 2.2)

Each set was run before, after the code change with every test untouched, and (sets a and b) after the tests' setup was changed; nothing changed in c, d or e, so they have no third run. `tests / pass / fail`; seconds; 1-minute load at start and end. [MEASURED]

| set | before | after, tests untouched | after, setup fixed |
|---|---|---|---|
| (a) control-plane, 95 files | 564 / 564 / 0; 491.6 s; 11.1 to 10.2 | 564 / 533 / 31; 490.7 s; 10.6 to 11.5 | 564 / 564 / 0; 473.3 s; 8.4 to 11.9 |
| (b) plane A1, 27 files | 99 / 97 / 1 + 1 cancelled; 374.7 s; 5.3 to 8.0 | 99 / 95 / 4; 625.6 s; 10.7 to 9.7 | 99 / 95 / 4; 671 s; 11.9 to 8.6 (and see the timing table) |
| (c) sample of 12 | 39 / 37 / 2; 224.9 s; 8.0 to 8.8 | 39 / 37 / 2; 495.9 s; 9.7 to 14.7 | not run again |
| (d) interface-shell, 37 files | 321 / 321 / 0; 143.8 s; 8.8 to 6.2 | 321 / 321 / 0; 239.2 s; 14.7 to 13.2 | not run again |
| (d) screens-intake, 41 files | 375 / 375 / 0; 557.7 s; 6.2 to 11.1 | 375 / 375 / 0; 631.7 s; 13.2 to 10.6 | not run again |
| (e) R54 start-up test | 1 / 1 / 0 | 1 / 1 / 0 | not run again |

In c, d and e no test changed result (0 of 39, 321, 375 and 1). In c the same two fail before and after (section 1).

**Every test whose result changed with the tests untouched: 35** (31 in a, 4 in b). Classes, by reading each test:

- **(i) the test makes the door, the delivery or the Store itself without what the top entry now hands in: 32 tests in 13 files.**
  - 17 tests in 9 control-plane files ask the door for a page, the shell's script or an asset: `doors` 2, `page-policy` 2, `r8-phase-clock` 1, `t46-app` 5, `t48-door` 3, `t50-door` 1, `t51-interfacewords` 1, `t51-page-log` 1, `t51-server-timing` 1. Each makes its door through `control-plane/harness.mjs:120` `const fetch = makeFetch(hooks ?? defaultHooks());` or its own `makeFetch({})` / `makeFetch(defaultHooks())` (`t46-app.test.mjs:44`, `t51-interfacewords.test.mjs:107`) [READ]: hooks with no `ui`. Failure text, for example: `/app: {"ok":false,"reason":"NO_INTERFACE",…} 404 !== 200`.
  - 14 tests in 3 control-plane files call `deliverOwedRender({...})` with one argument (`r124-owed-render` 11, `t51-g43-embed` 2) or hand acquisition a `deliver` that does (`t51-visitor-copy.test.mjs:80`, 1) [READ]. Failure text: `{"ok":false,"reason":"NO_DOCUMENT_COMPOSER"} false !== true`.
  - 1 test, `plane/worker.test.mjs:38` `assert.equal(entry.Store, PlaneStore, "the class is R1's");` [READ]: `PlaneStore` is the class the fixture takes from `pl/store.mjs`, the launcher's, with no composer; the entry's is now the subclass. Failure text: `[class Store extends Store]` against `[class Store extends DurableObject]`. An assertion pinned to the old structure more than a setup; counted here for want of a class of its own.
- **(ii) a real difference in behaviour: 0 found. (iii) unclear: 0.**
- **Timing, not classed: 3**, all in set b, Miniflare tests of alarms and restarts: `plane/l79.test.mjs` `R79 L: a restart over the same storage…` pass to fail (`timed out`, its own 90 s wait at `l79.test.mjs:75`), and in `plane/r8-heal-door.test.mjs` one test fail to pass and one pass to fail.

**The fixes (all class i): 33 lines added, 14 removed, in 14 test files** [MEASURED: `git diff HEAD --numstat -- bio-plane/test`]:

- one new helper, `control-plane/harness-ui.mjs` (13 lines): `harness.mjs` whole, with `makeFetch`, `defaultHooks` and `call` handing the door `INTERFACE` from `pl/ui.mjs`;
- the nine page files import the harness from it (one line each; `t46-app` one more, its own `makeFetch({ ui: INTERFACE })`);
- the three delivery files wrap the door's function, `const deliverOwedRender = (a) => deliverWith(a, DOCUMENT_COMPOSER);` (three lines for one, each);
- `worker.test.mjs:38` compares `Object.getPrototypeOf(entry.Store)` with `PlaneStore`.

No product file was changed to make a test pass. **After the fixes** set a is 564 / 564 / 0 and the 31 pass. In set b `worker.test.mjs` passes; what remained failing there is timing:

| run of set b's files | unchanged tree | changed tree |
|---|---|---|
| set run, each at its own time | 97 pass, 2 not (both `r8-heal-door`) | tests untouched: 95 pass, 4 not (`l79` 1, `r8-heal-door` 2, `worker` 1); fixed: 95 pass, 4 not (`l79` 1, `r8-heal-door` 2, `r8-timing-hook` 1: `an instance started later is younger`) |
| set run, both trees at the same time, 1-minute load 6.9 at the start | 97 pass, 2 cancelled (both `r8-heal-door`, 180 s) | **99 pass, 0 not** |
| the same again after the restart | spoiled, not used: the kernel killed test processes for lack of memory (`dmesg`: `Memory cgroup out of memory: Killed process … (node-MainThread)`); 95 of 99 tests reported, three files failed whole | spoiled the same way; not used |
| `l79.test.mjs` alone, twice, trees in turn | 5 of 5, 5 of 5 | 5 of 5, 5 of 5 |
| `l79.test.mjs` within the unspoiled set runs | 5 of 5, 5 of 5 | 4 of 5, 4 of 5, 5 of 5 |
| `r8-heal-door.test.mjs` alone, twice | 4 of 4, 4 of 4 | 4 of 4, 3 of 4 (the test that timed out in the unchanged tree's first set run) |

All [MEASURED]. What this shows: `r8-heal-door`'s tests fail by turns on both trees. `l79`'s restart test failed in 2 of the changed tree's 3 unspoiled set runs and `r8-timing-hook`'s age test in 1, both in runs at loads of 9 to 16; neither failed on the unchanged tree (2 set runs), alone, or in the same-time run. INFERENCE from the table and from the change (two more modules in a graph of 853, one more call around the delivery): they are load-sensitive timing tests and not the change's. It is not established: 2 of 3 against 0 of 2 is too few runs to tell. Set b on a quiet machine, both trees, several times, would settle it; other workers loaded the machine throughout.

## 6. The build, the start, and what the built program serves (step 2.3)

`node scripts/build-plane.mjs` in the scratch `bio-plane/`, twice each side; `dist/` restored afterwards (`git checkout -- dist`), the artifacts kept in `tA/bundles/`. [MEASURED]

| | before | after |
|---|---|---|
| bundle bytes | 28,418,158 | 28,419,491 (+1,333) |
| sha256 | `da5f1a92…54fc`, both runs | `1460daa3…4b64`, both runs |
| inputs in the manifest | 853 | 855 |
| inputs under `src/interface-*` or `src/screens-*` | 130 | 130 |
| wall time (1-minute load) | 4.62 s, 4.48 s (4.0, 4.7) | 5.79 s, 6.35 s (9.0, 9.5) |

The after list is the before list plus `src/plane/launch.mjs` and `src/plane/ui.mjs`; no input left; four inputs changed content (`cp/app.mjs`, `cp/index.mjs`, `pl/index.mjs`, `pl/store.mjs`) [MEASURED: set difference of the two manifests' `inputs`, by path and by sha256].

**Start-up.** The R54 test (five fresh imports of a bundle it builds itself) printed a median of 752 ms before at load 4.9 and 1,031 ms after at load 10.0: two runs at different loads, which say nothing about the change. So `start.mjs` (the same `measureStart`, five fresh imports per process) was run on the three saved bundles in turn, eight rounds, after the restart while the load rose from 3.3 to 9.2 [MEASURED]:

| bundle | the eight five-import medians, ms | median of them |
|---|---|---|
| before | 690, 547, 644, 842, 686, 704, 754, 673 | 688 |
| after | 540, 575, 738, 650, 616, 784, 750, 523 | 633 |
| launcher only (section 7) | 517, 513, 657, 600, 613, 577, 542, 500 | 560 |

After minus before, round by round: -150, +28, +94, -192, -70, +80, -4, -150 (median -37, 3 up, 5 down). One bundle's own medians span up to 295 ms, so **the difference is within the noise**: the after bundle is shown neither slower nor faster. An earlier pass of these rounds was cut off by the restart and is not used.

**Served bytes, both bundles under workerd.** `mf-run.mjs` starts a built bundle under Miniflare with the options of `plane/worker.test.mjs:19-27` and makes 15 requests (`/version`, six ops, `/`, `/app`, the script, an asset, the logo, `/doorbell`, an unknown address, `/favicon.ico`). For all 15 the status, content type, body sha256 and `content-security-policy` value are the same before and after. From source in Node (`probe.mjs`, 14 requests through the entry's default export) the bodies and the headers other than `server-timing` are the same too. [MEASURED]

**That sameness hangs on a variable's name.** My first version named the launcher's top-level constant `doorOver`. Its bundle served a script 24 characters shorter with another hash, so a page with another `integrity` value [MEASURED: 4,422,372 against 4,422,396 characters; the only identifiers whose counts differ are `door`, 136 against 112, and `door2`, 0 against 24]. Cause [READ + MEASURED]: the page's script is the source text of the shell's and the screens' functions as they stand in the bundle (`interface-shell/index.mjs:532`), and esbuild renames a nested `door`, one of them a local in a screen's function, when the bundle's top level holds a `door`; the old `pl/index.mjs:22` had `const door = makeFetch(…)` there. Keeping a top-level `const door` in `pl/launch.mjs` gave the identical script. So the bytes the browser gets depend on top-level names anywhere in the 855 inputs.

## 7. A program with no UI (step 2.4)

Entry `bio-plane/trial-door/launcher-only.mjs`: `import { launch, Store } from "../src/plane/launch.mjs"; export { Store }; export default launch();`. Built with the product's own `buildMember` over `planeMember()` with the entry replaced (`buildvar.mjs`; nothing written into the tree). [MEASURED]

- Bundle: 25,141,248 bytes (3,278,243 fewer than the full one, 11.5 %), 724 inputs, none under `src/interface-*` or `src/screens-*`; the full bundle's 132 other inputs are the 130 UI files and `pl/index.mjs`, `pl/ui.mjs`.
- Start-up (section 6's rounds): lower than the full after bundle in 8 rounds of 8, by 3 to 208 ms, median 56 ms; its median of medians 560 ms against 633 ms. Research 14 measured 76 ms for a bundle with the UI stubbed out; the two agree in direction and size.
- Under workerd, the same 15 requests: the nine that are not pages answer exactly as the full program does (same status, type and body sha256): `/version` 200 `9.9.9`; `op=bootstrap` 200 `{ok: true, service: "bio-plane", version, bootstrapConfigured, claimed, …}`; `op=stats` and `op=affordances` with the admin bearer 200 `{ok: true, result, store: "bio", tokenClass: "admin"}`; `op=selftest` with no credential 401 `NOT_AUTHENTICATED` (as in the baseline: it is not a public op); an unknown op 400 `UNKNOWN_OP`; `/favicon.ico` 204; the group logo 404 with no body; `/bootstrap` 200.
- `/app`, `/`, the script address, an asset, `/doorbell` and an unknown address each answer **404, `application/json`, `{"ok": false, "reason": "NO_INTERFACE", "detail": "this plane was started with no interface; its ops answer under /api/"}`** (116 characters), after the namespace and address gates the page routes already run.

What the door should say here is a design question; this is the simplest honest answer I could write (one function, `noInterface()`, called in `page()` and before the script and asset branch). Alternatives: section 10, item 11. Two things about this choice: `/doorbell` and `/tour` are 404 with no UI, because the list of public addresses is the UI's; and `GET /` does not fall through to an op.

## 8. The order, and what it would refuse (step 2.5)

**The scratch module list** (`reorder.py`, in the scratch worktree only). `process/modules/order.txt`: control-plane and plane directly after store-request, a new line `product` after screens-action; 205 lines. Positions: store-request 175, control-plane 176, plane 177, interface-assets 178, interface-shell 179, the 17 screens parts 180 to 196, product 197, release 198. `process/modules/product.json`: `files` `["bio-plane/src/plane/index.mjs", "bio-plane/src/plane/ui.mjs"]`, `tests` `[]`, `uses` plane, interface-shell, interface-assets, the nine screens modules and screens-capture. plane's `files` still names the folder; the two exact paths win as the longer match. Pass 1 changed nothing else; pass 2 also took out of the `uses` of control-plane and plane every module no longer before them (12 and 13 names, all UI modules). No `tests` list was changed.

**`p4.mjs check <module>`, first line of its output and its disagreements by kind** [MEASURED; whole outputs in `tA/check-base/`, `check-pass1/`, `check-pass2/`]:

| module | before the trial | pass 1 (`uses` untouched) | pass 2 (`uses` pruned) |
|---|---|---|---|
| control-plane | `no disagreement found` | `16 disagreement(s)`: 12 "declares … in uses, but … is later in the order", 4 "imports product, which … does not declare" | `52 disagreement(s)`: all "imports <module>, which … does not declare in uses; <module> is later in the order" |
| plane | `48 disagreement(s)`: 46 code against a provider's stated interface, 2 comment against tests | `75 disagreement(s)`: the 48, 13 declared uses of later modules, 14 imports of product | `159 disagreement(s)`: the 48 and 111 imports of later modules |
| product | no such module | not run | `no disagreement found` |
| interface-shell | `no disagreement found` | not run | `no disagreement found` |
| screens-intake | `no disagreement found` | not run | `no disagreement found` |
| screens-action | `no disagreement found` | not run | `no disagreement found` |

- The 48 of plane are the same lines before and after but one, which moved with its code from `pl/index.mjs:67` to `pl/launch.mjs:78` (`Expected 2 arguments, but got 3`) [MEASURED: `diff` of the sorted lines]. They exist today and are not the trial's.
- In pass 2 no disagreement is in a code file: control-plane's 52 are in 15 test-side files (11 test files, 4 helpers), plane's 111 in 64 (50 test files, 14 helpers and test entries) [MEASURED]. By module imported, control-plane: interface-shell 19, screens-capture 7, product 4, the other ten UI modules 22. plane: screens-capture 40, interface-shell 17, screens-inquiry 16, product 14, screens-intake 10, five others 14.
- `check` reads imports. It did not refuse a test that starts the top entry from its path held as text, nor `wrangler.jsonc:11`. It printed 1,756 to 6,671 "cannot tell, not refused" lines for each module but product (none); I counted them and did not read them.
- With the scratch list in place control-plane's whole set ran again: 564 / 564 / 0, 269 s, load 8.2 to 7.2 [MEASURED]. Its tests bound their op registration at control-plane's place in `order.txt` (`control-plane/register-declared.mjs:15`); no file under the UI's folders, `cp/` or `pl/` holds `export const DECLARED_OPS` [MEASURED: `grep -lE`, no hit].

**Test files the new order would refuse where they are.** `later.mjs` takes every `*.test.*` file owned by control-plane or plane under the scratch records and lists what it references that is UI-owned or later than its owner, by three routes on comment-free text: the import walk (static and literal dynamic, through helpers and source); paths held as text in the test file and the test-side files of its closure (literals that resolve to a file, `join(...)` of literal segments, the two `plane-world.mjs` helpers that write an entry over a copy of `src/`); and, where the top entry's path is so held, the entry's own closure. It runs nothing. [MEASURED]

| owner | test files | refused | of them: import a UI file / import a `product` file / hold the top entry's path | not refused |
|---|---|---|---|---|
| control-plane (176) | 95 | **20** | 19 / 12 / 2 | 75 |
| plane (177) | 147 | **101** | 66 / 5 / 95 | 46 |

- control-plane's 20: the 12 files I changed in section 5 (they now import `pl/ui.mjs`); `r130-killed-ways-in` and `r135-real-rows`, which start the Worker from the entry's path and import `screens-intake/capture.mjs`; the five files it owns under `interface-shell/` (`declared`, `e12`, `g30`, `g31`, `t50`), which import interface-shell; and `t49-door`, which only holds the path of a design file journey-check owns, as it does today.
- plane's 101: 100 reach the top entry (95 hold its path, 5 import it); 1, `plane/store.test.mjs`, only holds a journey-check path, as today. By folder: `control-plane/` 45, `plane/` 15, `bio-plane/test/` 9, `screens-inquiry/` 7, `screens-intake/` 6, `agent-worker/test/` 4, `capture/` 3, eight other folders 10, `test/system/` 2. Of the 27 A1 files, 20 are not refused; the 7 refused are `worker`, `t42` (path), `watchdog`, `t47`, `t50`, `r10-arrival-log` (import of the entry) and `store` (the journey-check path).
- The same script on the unchanged tree and order: 86 of control-plane's 95 test files reach a UI file by import (through the door's own imports) and 127 of plane's 147 reach a UI file or a later module; the UI is earlier there, so the order allows it.
- The list as data: `results.json`, `order_trial.tests_refused_where_they_are.rows`. Nothing was moved.

## 9. What the change cost (step 2.6)

`git diff HEAD --numstat` in the scratch worktree, each path given its owner under the scratch records (`cost.mjs`) [MEASURED]: 25 files, +237 -148.

| what | files | lines added / removed |
|---|---|---|
| control-plane, code (`cp/index.mjs`, `cp/app.mjs`) | 2 | 32 / 36 |
| plane, code (`pl/launch.mjs` new, `pl/store.mjs`) | 2 | 98 / 2 (59 of the 98 are the old entry's lines, moved) |
| the top module, code (`pl/index.mjs` rewritten, `pl/ui.mjs` new) | 2 | 40 / 69 |
| control-plane, tests (12 test files, 1 new helper) | 13 | 32 / 13 |
| plane, tests (`plane/worker.test.mjs`) | 1 | 1 / 1 |
| trial only: `bio-plane/trial-door/launcher-only.mjs` | 1 | 7 / 0 |
| the scratch module list (`order.txt`, three records) | 4 | 27 / 27 |

Product code: 6 files, +170 -107. Test code: 14 files, +33 -14. `diff.patch` holds all of it in four parts: code, tests, the trial-only entry, the module list.

## 10. Every choice I made, with the alternatives I saw

None of these is the only way; each was taken as the least change I could see.

1. **What the door is handed: the UI's own builders and data, one object `hooks.ui`** (`interfacePage`, `interfaceScript`, `interfaceScriptHash`, `pageWork`, `versionOfScriptPath`, `assets`, `screens` as one list, `guide`, `publicAddresses`). Why: the door's three calls keep their shape, so its lines change by a prefix. Alternatives: (a) already-composed functions (`page(options)`, `script(options)`, `scriptHash(options)`), a smaller surface that hides screens and guide from the door, but `appPage` and its direct test would change; (b) the nine lists, spread by the door as today; (c) the script text and hash made once at start, which moves that work into start-up; (d) separate hooks.
2. **The nine lists are joined in the top file, not in the door.** The order of control-plane R81 therefore lives in `pl/ui.mjs`.
3. **T01: the shell's parser is handed in.** Alternative: the door owns the script address and the shell imports it from the door, possible only once the UI is above the door.
4. **N02: the two public addresses are derived from interface-shell's `PUBLIC_ADDRESSES` in `ui.mjs`** (`Object.keys(...).map((n) => "/" + n)`), so the door's own copy is gone. Alternatives: the door keeps its list (then it still holds two UI addresses as text); the top file writes the list again.
5. **T17: `deliverOwedRender` takes the composer as a second argument, and the entry's `Store` is a subclass made by `storeWith(composer)`.** Alternatives: a factory with the whole class nested in it; a setter the top entry calls at load; the composer on `env`; the composer below the door (the other worker's trial).
6. **`pl/store.mjs` still exports a `Store`, with no composer.** Why: 12 test-side files take it from there (10 by import, 2 by an entry they write over a copy of `src/`), and 46 of plane's test files then need nothing above the launcher (section 8). Alternative: export only `storeWith`, and change those 12 files to take it from the top entry.
7. **The top entry keeps the path `src/plane/index.mjs`; the launcher's code moved to `src/plane/launch.mjs`.** Alternative: a new entry path, with `wrangler.jsonc:11`, `fleet-bundle.mjs:522` and the test files that name the path changed. The variant met no trouble that a new path would cure, so the other was not tried.
8. **The UI's assembly is its own file, `pl/ui.mjs`, beside the entry.** Why: the door's tests that ask for a page need the same assembly, and the entry may export only `default` and `Store` (`test/m/plane/worker.test.mjs:37`). Alternative: one file, with the tests assembling the UI themselves.
9. **The launcher is imported before the UI in the entry** (section 3), so the load order rests on two import lines. Alternative: `ui.mjs` imports the registration itself.
10. **The launcher's top-level constant keeps the name `door`** (section 6: with another name the served script changes by 24 bytes). Alternative: accept the changed script and hash.
11. **With no UI, every page route answers 404 JSON `{ok: false, reason: "NO_INTERFACE", detail}`** (section 7). Alternatives: 501; the door's plain-text `Not found`; falling through to the op door (`GET /` would answer `selftest`'s refusal, an unknown address `UNKNOWN_OP`); a built-in page; refusing to start with no UI.
12. **With no composer, an owed render answers `{ok: false, reason: "NO_DOCUMENT_COMPOSER"}` at the point of promotion**, so the path that links an existing document still works. Alternatives: refuse at the start of the delivery; throw when the Store is built.
13. **Tests: one helper, `control-plane/harness-ui.mjs`, and a changed import line in each door test that asks for a page.** Alternatives: put the UI into `harness.mjs` for every test (then every door test would reach the UI); pass `ui` at each call.
14. **The trial's top module is named `product`**, owns `pl/index.mjs` and `pl/ui.mjs`, has no tests of its own, and sits after screens-action. `wrangler.jsonc`, `scripts/build-plane.mjs` and `dist/` were left with plane.
15. **Reporter flags were added to the test command** so each test's result could be compared; `p4 run tests` itself was not used for the measured runs. The sample's seed is the date, 20261123.

## After a change

Not a design; what the measurements leave open if the lane took this route.

- The text ties of research 11 (N01, N03 to N12) are untouched: the door still writes `/app`, `/app/assets/`, `group-logo`, the content types and the words cache key. The trial removed the 13 import edges and the door's copy of the two public addresses, not the shared text.
- The door's requirements about the page (research 11, section 9) and the tests of section 8 would go to whichever module owns the top entry, or be reworded as what the door does with what it is handed.
- `wrangler.jsonc:11`, `scripts/build-plane.mjs` and `dist/` name or are built from the top entry and stayed with plane here. INFERENCE: a launcher that names no file above it would hand these up too; moving them in the scratch list and running `check` again would show what follows.
- The served script depends on top-level names anywhere in the bundle (section 6). No test in the sets noticed my first version's 24-character difference; a test pinning the built script's hash would. Not tried.
- The load order rests on two import lines (section 3); only a failed start says so.

## What I did not check

- **Tests outside the five sets.** By a static scan (`touched.mjs`: import closure, plus paths held as text in test-side files) 307 of the tree's 3,118 test files reach one of the four existing files I changed; 117 are in the sets I ran; 190 are not: 93 more of plane's, 28 of ratification's, 12 of journey-check's, 10 of installer's, 9 of release's, 6 each of bundler's and agent-runner's, 26 of eleven other modules. None of the 190 was run after the change. So "0 real differences in behaviour" is a statement about the five sets, 1,399 tests, not about the product.
- Set b on a quiet machine: `l79`'s restart test and `r8-timing-hook`'s age test are cleared of the change only as far as section 5's table goes.
- `p4 run tests` for the measured runs; one module went through the tool itself to compare counts.
- The start-up difference on a quiet machine.
- `wrangler dev`, a deploy, the development copy, a browser: nothing was deployed or opened. The page was compared by bytes, not drawn.
- An owed render delivered by the alarm inside workerd through the entry's `Store` with the composer handed in. The delivery's own tests run it in Node with the composer passed by the test; whether any test in the sets takes that path under workerd, I did not establish.
- The other variant (a new entry path), and the other worker's alternative for T17.
- The requirement texts (`control-plane.md`, `plane.md`) against the changed code. I marked my comments TRIAL and did not rewrite the files' older header comments, some of which now describe the old arrangement.
- `check`'s "cannot tell" lines.
- Run-time routes of section 8's list beyond imports and paths held as text: nothing ran under a recorder of loaded modules or file reads, and the shared collector's text reads of every module's files (research 13) are not in the list.
- What the module standard's rules for a module with a top-level `await` imply for the entry's load order, beyond section 3's runs.
- Sets c, d and e after the test fixes, and sets b to e under the scratch module list.
