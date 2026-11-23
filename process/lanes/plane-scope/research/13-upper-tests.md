Length: 226 lines. Last section: "What I did not check".

# Plane scope research 13: how the upper tests get their store, their door and their runtime

Written 23 Nov 2026 by a research worker for the plane-scope lane. It decides nothing. Scope: every file under `tests` of store-services (173), store-assembly (174), store-request (175), interface-assets (176), interface-shell (177), the screens parts (178-194), control-plane (195), release (197) and journey-check (204). plane's own (196) are in `02-test-map.md` and appear here only in totals. Each claim carries one tag: [MEASURED] a command showed it, [READ] the code line is quoted or cited, [NOT CHECKED]. An inference is marked INFERENCE.

## Headline answers

1. **Inventory.** 700 files: 598 test files, 90 helpers, 12 data files [MEASURED]. With plane's 195 (147 test files) these 25 modules hold 895 files under `tests`, 745 of them test files [MEASURED]; modules 198-203 were not asked for. 597 of the 598 test files ran once under recording; the per-file data is `tests/upper-tests.json`.
2. **Does any of these test files refer to a later module? Yes: 432 of the 597 that ran.** None by an import (0 of 598 test files, 0 of 90 helpers) and none by loading a later module's code at run time (0 of 597). All 432 by reading a later module's file as text, and 427 also by listing a later module's folder [MEASURED]. For 430 the latest module reached is journey-check (204), through the shared collector of section 6 or through a design file journey-check owns. For 2, control-plane's `r130-killed-ways-in` and `r135-real-rows`, it is plane (196): they start plane's Worker under workerd.
3. **Screens tests and the door.** No test below control-plane runs the front door: of the 453 test files run there (296 in the screens parts), 0 load control-plane's code and 0 start workerd [MEASURED]. 229 of the 296 files draw a screen over the real store through store-request's world door, a test-side re-making of the door that runs the real admission and the real store request and none of the door's own gates, pages, assets or headers; 61 files use scripted tables only; 6 ask nothing.
4. **control-plane's own 95 test files.** 78 drive the real door (`makeFetch`): 66 over a fake store that echoes, 12 with a real store, record or plane behind it. 11 of the 78 ask the door for an address outside `/api`, 9 of them a page. 17 do not drive the door; 4 of those boot screens in the page harness with no door behind them.
5. **Run times.** GitHub, whole module, test step: control-plane 284 s, store-assembly 156 s, store-request 119 s, screens-action 109 s, interface-shell 77 s, release 59 s, store-services 6 s. Local, 4 CPUs: screens-intake 361.8 s, interface-shell 94.7 s, screens-action 72.7 s.
6. **The helper leak.** 519 test files in the repository reach a call of the collector on the repository's root [MEASURED, static]. Of the 444 outside plane and journey-check, all were run under recording and 430 read at least one later module's file through it [MEASURED].

## Method

Commands ran on the working tree at `/home/user/civicsmith-copy` (`origin/p4-tranche` at `a26a8da2` plus research files: `git diff --name-only a26a8da2 HEAD` names only files under `process/lanes/`) or on scratch worktrees of the same commit. Node 26.10.0, 4 CPUs.

- **Ownership.** A file's owner is the module whose listed path matches it longest over `files` and `tests`, as the tool's `ownerOf` does (`tool/lib/config.mjs:53-62`). A row of this inventory is a tracked file whose longest match is a `tests` path of the module. A test file is a row named `*.test.*`, as the tool's `testFiles` takes them (`tool/lib/scope.mjs:14-16`). A helper is any other `.mjs` or `.js` row; the rest are data.
- **Static trace.** A script of mine read 4,843 tracked `.mjs`, `.js` and `.cjs` files (vendor folders left out) and took, by regular expression, static imports and literal dynamic imports of relative specifiers (query strings dropped). A file's "latest module by imports" is the latest owner in that closure. Other string literals that resolve to a tracked path ("paths held as text") are listed as leads only.
- **Instrumented run.** In a second scratch worktree I added counting calls at 15 places in eight test helpers (interface-shell `harness.mjs`; store-request `door.mjs`; store-assembly `world.mjs` and `fixture.mjs`; plane `fixture.mjs`; control-plane `harness.mjs`; screens-entry `kit.mjs`; screens-wizards `standin.mjs`). No product file was changed. Each module's whole test set was then run with the process's own test command plus a preload, `NODE_OPTIONS="--import spy.mjs" node --import ./bio-plane/test/platform-sqlite.mjs --test <files>`. In every test process the preload records the modules Node loads (a `load` hook), the files read or opened and the folders listed through `node:fs`, the child processes started, the helpers' counters, and the counters' change during each test (through a stand-in for `node:test` that wraps each test's function). A child's record is merged into the test file that started it.
- **Does the instrumentation change results?** Three modules also ran without it: interface-shell 321 of 321 both ways, screens-intake 375 of 375 both ways, screens-action 332 of 332 both ways [MEASURED]. Besides journey-check's (section 4), two instrumented runs differ from a clean pass: screens-investigate had 1 failure of 325 (`explore.test.mjs`, which then passed 15 of 15 twice in the clean worktree), and interface-assets failed 9 of 22 because its test reads git history at commit `2a64c5ae77`, which this shallow clone does not hold (`git cat-file -t 2a64c5ae77`: "Not a valid object name"; `git rev-parse --is-shallow-repository`: `true`).
- **Limits.** `statSync`, `existsSync` and `accessSync` are not recorded. Reads made inside workerd, Chromium or another non-Node child are not recorded. A count "per test" is the counters' change while that test's function ran: a test that only reads what an earlier test or the file's top level made shows no change, so the per-file counts are the firm ones.
- **Two mistakes of mine, cleaned up.** (1) screens-capture has no test file, so my runner called `node --test` with no file and Node's own discovery ran other tests in the scratch worktree for 59 s before I stopped it. Its records are deleted and in no count; its orphaned processes and their folders under `/tmp` are removed. (2) A script of mine wrote three stray files (`answers`, `control-plane`, `interface-shell`, dumps of the owner map) into the main checkout's top folder. I removed them minutes later; `git status --short` shows nothing of mine there now but this report's two files.

The scripts this report names (`*.mjs`) are mine, kept in `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/w13/`, a scratch folder that can be cleared; the JSON's `how` block states each field.

## 1. Inventory

The per-file table is `tests/upper-tests.json`: for every file its module, kind, a lead for what it proves (header text and requirement ids), the static trace, and for a test file the run's record, its harness and the latest module reached by each route. Below, a test file is counted in every column that applies to it [MEASURED, from the run's records].

| module | files: test / helper / data | tests run / passed | page harness | kit, no page | Chromium | workerd | world's door | store, no door | real door in Node | tables only | nothing below | later module: text read / folder listed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| store-services (173) | 5 / 0 / 0 | 26 / 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 / 0 |
| store-assembly (174) | 91 / 9 / 5 | 706 / 706 | 0 | 0 | 0 | 0 | 0 | 59 | 0 | 0 | 32 | 27 / 26 |
| store-request (175) | 23 / 8 / 0 | 120 / 118 | 0 | 0 | 1 | 0 | 22 | 0 | 0 | 0 | 1 | 0 / 0 |
| interface-assets (176) | 1 / 0 / 0 | 22 / 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 / 0 |
| interface-shell (177) | 37 / 8 / 0 | 321 / 321 | 33 | 0 | 3 | 0 | 14 | 0 | 0 | 19 | 2 | 37 / 37 |
| screens-entry (178) | 8 / 1 / 0 | 111 / 111 | 1 | 7 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 2 / 1 |
| screens-wizards (179) | 11 / 3 / 0 | 92 / 92 | 6 | 6 | 0 | 0 | 10 | 0 | 0 | 0 | 1 | 7 / 6 |
| screens-account (180) | 1 / 0 / 0 | 10 / 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 / 0 |
| screens-settings (181) | 24 / 11 / 0 | 277 / 277 | 23 | 0 | 1 | 0 | 24 | 0 | 0 | 0 | 0 | 24 / 24 |
| screens-intake (183) | 41 / 1 / 0 | 375 / 375 | 40 | 0 | 1 | 0 | 40 | 0 | 0 | 0 | 1 | 40 / 40 |
| screens-find (184) | 3 / 0 / 0 | 19 / 19 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 3 / 3 |
| screens-daily (185) | 30 / 4 / 2 | 321 / 321 | 29 | 0 | 3 | 0 | 26 | 0 | 0 | 4 | 0 | 30 / 30 |
| screens-document (186) | 1 / 0 / 0 | 3 / 3 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 / 1 |
| screens-question (187) | 1 / 0 / 0 | 7 / 7 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 / 1 |
| screens-inquiry (188) | 62 / 2 / 1 | 580 / 580 | 62 | 0 | 3 | 0 | 62 | 0 | 0 | 0 | 0 | 62 / 62 |
| screens-people (189) | 1 / 0 / 0 | 5 / 5 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 / 1 |
| screens-investigate (190) | 34 / 3 / 2 | 325 / 324 | 34 | 0 | 0 | 0 | 34 | 0 | 0 | 0 | 0 | 34 / 34 |
| screens-public (191) | 1 / 1 / 0 | 18 / 18 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 / 1 |
| screens-publish (192) | 29 / 2 / 0 | 324 / 322 | 29 | 0 | 2 | 0 | 2 | 0 | 0 | 27 | 0 | 29 / 29 |
| screens-send (193) | 7 / 1 / 0 | 144 / 144 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 1 | 7 / 7 |
| screens-action (194) | 42 / 9 / 0 | 332 / 332 | 40 | 0 | 0 | 0 | 22 | 0 | 0 | 18 | 2 | 40 / 40 |
| control-plane (195) | 95 / 8 / 2 | 564 / 564 | 4 | 0 | 0 | 3 | 5 | 1 | 71 | 1 | 16 | 86 / 84 |
| release (197) | 10 / 5 / 0 | 64 / 64 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 6 | 0 / 0 |
| journey-check (204) | 40 / 14 / 0 | 327 / 196 | 3 | 0 | 0 | 5 | 2 | 0 | 0 | 1 | 31 | 0 / 0 |
| **all** | 598 / 90 / 12 | 5093 / 4948 | 317 | 13 | 14 | 12 | 272 | 60 | 71 | 82 | 100 | 432 / 427 |

Columns (a counter of the run above zero for the file): *page harness* = interface-shell's `boot` ran; *kit, no page* = screens-entry's kit or screens-wizards' stand-in drew a screen; *world's door* = store-request's test door answered; *store, no door* = an assembled store was built (store-assembly's world or fixture) and the world's door was not used; *real door in Node* = control-plane's harness called `makeFetch`; *tables only* = scripted answers and no store; *nothing below* = none of these.

- **screens-capture (182)** owns no file under `tests` [MEASURED: 0 rows].
- **workerd** is started by 12 of these test files: control-plane's `r128-rpc-stub`, `r130-killed-ways-in`, `r135-real-rows`; release's `ascii`, `devcopy`, `system/bundle`, `system/fleetbundles`; journey-check's `journey`, `route-encoding`, `runner`, `promotion/write-path`, `control-plane/t51-round9-seam`. Node read plane's source entry for Miniflare in 4 (the two control-plane files, `journey`, `t51-round9-seam`). What release's four run under workerd is [NOT CHECKED]: Node read no file of `src/plane/` for them, and esbuild's reads are not recorded.
- **Latest module by imports** is the file's own module for all 598 test files and all 90 helpers [MEASURED: static trace]. So the static trace alone would report no later reference anywhere.
- **Later modules' files read as text at run time** [MEASURED], 432 test files: store-assembly 27, interface-shell 37, the screens parts 282, control-plane 86. The files read are (i) the collector's 16 (section 6); (ii) design files journey-check owns under `docs/development/ux-substrate/screens/`: `words-reads.json` (read by 5 screens tests, and by `store-assembly/words`, `interface-shell/words-keys` and one control-plane test), `mock-acts.js` (`op-declarations/t37`, `t38`, `t48`, store-assembly's tests) and `mock-kit.js` (`op-grades/t48`, `t50`, store-assembly's); (iii) plane's five source files, read by Miniflare for the two control-plane tests named in the headline.
- **Paths held as text** (leads, not run-time evidence): `control-plane/rows-plane.mjs` holds `src/plane/index.mjs`; screens-action's `page.mjs`, `naming.mjs` and `real.mjs` hold `docs/development/ux-substrate/`, a folder with journey-check's files in it. The browser helpers hold `site/node_modules/` and `bio-plane/src/journey-check/node_modules/` as places to look for `playwright-core` (`chromium.mjs:15`); neither folder exists on this machine, where `/opt/node-tools/node_modules/` served [MEASURED: `ls`].
- **interface-assets (176)**: its one test file reads git history at a named commit (`assets.test.mjs:22`, `:28` in the failure's stack); 9 of its 22 tests fail in this shallow clone.
- **journey-check (204)**: its run was stopped by me after 14 minutes with 196 of 327 tests passed; see Method and section 4.

## 2. The shared harnesses, from code

`T/` = `bio-plane/test/m/`, `src/` = `bio-plane/src/`. Every statement here is [READ] at the line given unless tagged otherwise.

**The page harness, `T/interface-shell/harness.mjs` (interface-shell, 177), with `dom.mjs`.** `boot(...)` builds the page's HTML with the real `interfacePage(screens, options)` (`:222` `html = html || served(interfacePage(screens, options));`), parses it into `dom.mjs`'s tree (`:223`), and runs the page's real script in Node: `:331` `new Function("window", "setTimeout", "clearTimeout", "Date", scriptOf(html, screens, options))(win, clock.setTimeout, clock.clearTimeout, FakeDate);`. No browser, no HTTP. Real: interface-shell's page and script, and the screens handed in. Stand-ins: the document (`dom.mjs:5` "It runs no script and loads nothing."); `window` with its storages (`:284-301`); the clock (`:262-270`); the nonce (`:143` fills each slot with `"n0nce"`); the session, a record written into `localStorage` (`:133` `SESSION = {t: "tok-1", ...}`, `:276`); and `fetch` (`:228-261`). `fetch` never leaves the process: `:250-253` `let a = answers[op]; if (typeof a === "function") a = await a(req); if (a === undefined && door) a = await counted(door)(req); if (a === undefined) a = ok(null);`. So each request is answered by the test's `plane` table, else by `door` (a function the test hands in), else by `{ok: true, result: null}`. With no `door`, the frame's own reads come from the hand-made `FRAME` (`:122-130`, `whoami: ok(MEMBER)`). The answer object carries only `status`, a `content-type` and the body (`:256-260`): no other response header exists for a page to read. Each request is checked against the owners' declared fields (`:237-249`), which come from `declaredOpsOf(..., "interface-shell")` at import (`:54`): the leak of section 6.

**The real-browser helper, `T/interface-shell/chromium.mjs`** and its copies (`T/screens-settings/measure.mjs`, `T/screens-daily/measure.mjs`, `T/screens-inquiry/phone.mjs`, `T/screens-publish/phone.mjs`). Chromium is launched through `playwright-core` (`chromium.mjs:52`; where it is looked for, `:15`, is in section 1). One `page.route("**/*")` handler stands in for the whole door (`:57-73`): assets are served from `ASSET_FILES` by the test (`:59-63`), every `/api/` request is answered `{ok: true, result: plane}` or a scripted answer (`:64-69`), the script and `/version` are served by the test (`:70-71`), and any other address gets the page's HTML (`:72`). The session is put into `localStorage` by an init script (`:55`). store-request's `routeOf(world, as)` (`T/store-request/door.mjs:679-688`) is the same route handler answered by the world's door.

**The world, `T/store-assembly/world.mjs` (store-assembly, 174).** `storeWorld()` is the real `assembleStore` (`:30`, `:206`) over `node:sqlite` shaped as Durable Object storage (`contextOver`, `:58-85`), an in-memory bucket for R2 (`memoryBucket`, `:119`), a pinned clock (`:272` `BIO_NOW_MS: now`), and a `globalThis.fetch` that refuses every outbound address unless scripted (`:184-193`). `cloudflare:workers` is answered by a resolve hook with a stand-in class (`:21-28`). The founder is claimed through the store's own `claim` route (`:228-234`); `send` passes a request straight to `store.dispatch` (`:294`). No Worker and no door.

**The world's door, `T/store-request/fixtures.mjs` and `door.mjs` (store-request, 175).** `storeWorld()` here is store-assembly's world plus `door`, `signIn`, `boot`, `route` and recipes (`fixtures.mjs:40-56`). `doorOf(world)` (`door.mjs:258-266`) is a test-side re-making of the front door from earlier modules. Real, called by it: op-declarations' tables (`:272-273`), admission's `presentedCredential`, `aiCredentialPresented`, `admit` and `bearerFence` (`:285-292`, `:329`), store-request's `innerRequest` (`:404`), answer-envelope's envelope (`:411-435`), signin-door's three ops (`:351-361`), the modules' own door arms (`gatedArm`, `:439-471`), and the store through `world.send` (`:409`). Sign-in is real: `signIn` makes a member by `memberadd`, `enroll` and `login` through this door (`:613-668`) and the page is given the session that `login` answered (`bootOf`, `:671-674`). Re-made by hand in the test file, not taken from control-plane: `whoami` (`:315-328`), the public relays `claim`, `login`, `recover` and others (`:486-497`), the template and review-copy doors (`:529-564`), the reading that follows a promotion (`:113-196`). It imports nothing of control-plane or plane [MEASURED: `grep -c makeFetch T/store-request/door.mjs` = 0; the instrumented run loaded no control-plane file in any store-request or screens-part test, section 3].

What the real door does that the world's door does not [MEASURED by `grep -c <name>` in `T/store-request/door.mjs` against `src/control-plane/index.mjs`: 0 against 1 or more for each]: `namespaceGate`, `addressGate`, `queryGate`, `confinedNamespaceGate`, `pinnedNamespaceGate` (the namespace and credential-in-address gates), `doorWindowGate` (the public ops' window), `bootstrapToken` and `liveToken` (the bootstrap credential at `claim`: the world relays `claim` with a fingerprint only, `door.mjs:486-488`), `appPage`, `appAsset`, `appScript`, `interfacePage`, `ASSET_FILES` (every page, script and asset route), `withPagePolicy` (the Content-Security-Policy on HTML), `withServerTiming`, `withTrace`, `tallySessionRefusal`, `tallyOnTheWayOut`, `interfaceWordsCache`, `liftDerivation`, `planeInternalError` (the outermost catch). The file's header says the same (`door.mjs:15-19`): a lead; the grep is the evidence.

**The kits of the screens parts.** Each is a thin layer over the two harnesses above:
- Page over the world's door: `T/interface-shell/world.mjs` `inWorld`/`bootAs`/`doorAs` (`:16-45`); `T/screens-wizards/kit.mjs:105`; `T/screens-settings/kit.mjs:172-181`; `T/screens-intake/page.mjs` `openWorld` (`:94-105`); `T/screens-investigate/world.mjs:19-21`; `T/screens-publish/fixtures.mjs` `openWorld` (`:237-244`); `T/screens-action/world.mjs:30` (`bootAs`).
- Page over a scripted table only: `T/screens-intake/page.mjs` `open` (`:83-88`); `T/screens-daily/page.mjs:29`; `T/screens-action/page.mjs:49`; `T/screens-send/kit.mjs:73`; `T/screens-public/fixtures.mjs:65` (no session); `T/screens-publish/fixtures.mjs:282`; `T/screens-inquiry/fixtures.mjs:173`, whose table defaults for some reads are asked of a world built at import (`:53`).
- No page at all: `T/screens-entry/kit.mjs` `open` (`:264-435`) calls the screen's `reads`, `render` and acts through a hand-written stand-in of the shell's kit `cs` (`:303-361`); a request is answered by the test's table, else by the world's door (`:295-300`, `viaDoor` `:162-166`). `T/screens-wizards/standin.mjs` does the same for the guide (`:42-45`).
- A third stand-in for the door: `T/screens-action/real.mjs` `realPlane` (`:34-60`) calls earlier modules' op maps directly over `filings`' test world and sets `viewer`, `author` and `by` itself (`:52-54`); admission is not run.

**control-plane's harness, `T/control-plane/harness.mjs` (control-plane, 195).** The real door in plain Node over a fake store: `call(env, {...})` builds a `Request` and runs `makeFetch(hooks ?? defaultHooks())` (`:120-124`). `makeEnv` (`:39-90`) is a fake `STORE` namespace that records every inner request and answers sessions and credentials from tables and any other route with `{ok: true, echo: route}` (`:82`). The default hooks record and decline (`:133-144`). Real: all of `src/control-plane/` and what it imports, which is every screen module (`src/control-plane/index.mjs:54-62` import the nine `SCREENS`). Fake: the store, and plane's hooks. `T/control-plane/record.mjs` (`:1-9`) is a record store composed of earlier modules over `node:sqlite` for the suites that need a real store behind the door. `register-declared.mjs:15` registers every owner's declared ops through the collector bounded at `control-plane` (section 6).

**The real plane under Miniflare.** `T/control-plane/r8-kit.mjs` (plane's file) starts Miniflare on plane's entry by path (`:17` `SRC = .../src/plane/index.mjs`, `:293-311`), with real Durable Object and R2 emulation, and drives it with `mf.dispatchFetch` (`:312`); the founder is made by `claim` with the bootstrap token and `login` (`:51-55`). `T/control-plane/wrap-entry.mjs` (plane's) gives the same Worker wrapped to count calls: `wrap-entry.worker.txt:17` `import plane, { Store as BaseStore } from "__PLANE__";`, the path filled in at `wrap-entry.mjs:12`. `T/screens-intake/realplane.mjs` (plane's) is the same boot (`:20-27`) joined to the page harness: each op of a list is forwarded from the page's table to the real door (`viaDoor`, `:38-46`). control-plane's own `rows-plane.mjs` (`:10`, `:51`) is another Miniflare boot of the same entry. The two `plane-world.mjs` (capture-requests' and agent-worker's, both plane's files) copy `src/` to a temp folder and add an entry that extends plane's `Store` (`:46-60`, `:45-60`).

**plane's fixture, `T/plane/fixture.mjs` (plane, 196).** plane's `Store` class constructed in Node over `node:sqlite` (`:18`, `:86` `new Store(st.ctx, env)`), with `assembleStore` and control-plane's `deliverOwedRender` (`:19-20`, `:24`). No Worker entry and no door: `fetch` is the object's own (`:102`).

## 3. Screens tests and the door today

All counts here are [MEASURED] from the instrumented run of the 16 screens parts that have tests: 296 test files, 2,943 tests: 2,940 passed, 1 failed (Method), 2 are `todo`. The per-file and per-test values are in the JSON (`belowTheScreen`, `perTest`).

**What stands below the screen, by test file.**

| what the file's screens are drawn over | files |
|---|---|
| (a) the real store through the world's door, nothing scripted | 54 |
| (a) the world's door, with some scripted answers beside it (faults, or ops a test answers itself) | 105 |
| (a) and (b) in one file: some draws over the world's door, some over tables only | 70 |
| (b) scripted tables only | 61 |
| (c) nothing below: no request is made | 6 |

So 229 of 296 files draw at least one screen over the real store, 61 use hand-made answers only, 6 ask nothing. By part: world's door in every file of screens-entry (8), screens-settings (24), screens-investigate (34), screens-inquiry (62) and screens-document (1), in 40 of 41 of screens-intake, 26 of 30 of screens-daily, 10 of 11 of screens-wizards, 22 of 42 of screens-action, 2 of 29 of screens-publish; tables only in all of screens-find (3), screens-question (1), screens-people (1), screens-public (1), in 6 of 7 of screens-send, 27 of 29 of screens-publish, 18 of 42 of screens-action, 4 of 30 of screens-daily. The 6 files with nothing below hold 33 tests (`screens-account/recovery`, `screens-action/counsel-words`, `screens-action/plan-screen-shape`, `screens-intake/r67-supporting-reasons`, `screens-send/steps`, `screens-wizards/words`).

**By test** (the counters' change while each test ran; see the limit in Method): 1,974 tests asked the world's door while drawing (a); 3 asked it without drawing; 814 drew over scripted answers only (b); 150 made no request (c).

**By request.** Page boots: 4,120 with the world's door, 2,496 without. screens-entry's kit: 453 draws with a world, 9 without. Page requests answered by the world's door: 75,498; by a test's table: 33,159, and 5,065 more by a table entry that itself asked the world (counted only in the four parts run after I added that counter; 4,858 are screens-inquiry's fixture defaults); by the harness's hand-made frame defaults: 12,511; by the default null answer: 9,525. 45 of the 61 tables-only files load other modules' test helpers (entities', promotion's and membership's fixtures among them); I did not check which table answers those helpers make.

**Runtime.** Every screens-part test runs in Node. 10 files also launch Chromium (54 launches: screens-intake `phone390` 16, screens-publish `fix3` 7 and `fix4` 2, screens-settings `phone` 6, screens-daily `fix3` 5, `fix10` 4, `fix4` 3, screens-inquiry `fr4-question` 5, `fr4-project` 4, `fr4-document` 2); none of those launches was answered by the world's door (`worldroute` 0), so each ran over the scripted route handler of section 2. No screens-part test started workerd (0 of 296), and no screens-part test process loaded, as code, any file of control-plane, plane or any other later module (0 of 296).

**What of the door is therefore not exercised by any screens-part test.** INFERENCE from (a) no screens-part test loads `src/control-plane/` or starts plane's Worker [MEASURED above], and (b) the functions below exist only in `makeFetch` and are absent from the world's door [MEASURED, section 2]: none of this runs in a screens-part test. A coverage run would settle it line by line.

| door behaviour (`src/control-plane/index.mjs`) | what the screens-part tests use in its place | where it is exercised (test files that drive `makeFetch` or the real plane and name it) |
|---|---|---|
| Page routes: `GET /` (`:970-977`), `/app` and `/app/<path>` (`:981-993`), the "nothing is here" pages (`:999-1006`) | the harness builds the page itself (`harness.mjs:222`) and sets `location.pathname` (`:278`); the door is never asked for a page | control-plane: `doors`, `t46-app`, `t48-door`, `t50-door`, `r8-phase-clock`, `t51-server-timing`, `page-policy`, `t36-door`, `t51-page-log`; plane's `control-plane/t46-e2e`, `t47-e2e`, `t51-bootstrap` (`02-test-map.md`); journey-check `journey.test.mjs` (12 workerd starts) |
| Assets and the script: `/app/assets/<name>`, the versioned script address, the team's logo (`:988-992`) | Chromium helpers serve `ASSET_FILES` and the script from the test (`chromium.mjs:59-70`); the page harness loads no asset | control-plane: `t46-app` (every asset, its type, etag and 304), `t47-door` (the logo); plane's `control-plane/t46-e2e` |
| Content-Security-Policy on HTML (`withPagePolicy`, `:907`) | the harness fills the nonce slot itself (`harness.mjs:143`); 0 of the 334 screens-part test-side files name the header | control-plane: `page-policy`, `doors`, `t46-app`, `t50-door`; plane's `control-plane/t46-e2e` |
| Sign-in at the door: the bootstrap credential at `claim` (`:1094-1101`), the public ops' window and the `source` and `country` stamps (`:1066-1074`) | the store's own `login`, `enroll` and `claim` are real, relayed by the world's door (`door.mjs:486-494`, `:613-668`); the door's checks around them are not made | control-plane: `gates`, `t35-door`, `t49-door`, `envelope`, `declarations` (name `bootstrapToken`), `door-share`, `t37-door`, `t38-door` (the `login` relay); plane: 39 test-side files name `bootstrapToken` |
| Session cookies | none exist to exercise: the session is a bearer token kept in `localStorage` (`harness.mjs:133`, `:276`; [MEASURED] `grep -rni cookie` over `src/control-plane`, `admission`, `interface-shell`, `signin-door`, `credentials`, `store-request`, `plane`, `answer-envelope`: 0 lines) | |
| Admission | real: `admit` and `bearerFence` run in the world's door (`door.mjs:292`, `:329`). Not run: the namespace gates, the credential-in-address gate and the query gate (`:1044-1059`) | control-plane: 15 files name a namespace gate (`doors`, `gates`, `t46-app` among them), 5 the address gate (`converts`, `doors`, `t35-door`, `t36-door`, `t46-app`); plane: 22 test-side files name the address gate |
| `Server-Timing`, the trace, the refusal tallies, the words cache, CORS, `/version`, `/favicon.ico`, the outermost catch (`:893-914`, `:943-964`) | none; the harness answers its own `/version` poll (`harness.mjs:129`) | control-plane: `t51-server-timing`, `r8-phase-clock`, `r128-op-shape`, `refusal-tally`, `r8-words-cache`, `t51-interfacewords`, `r101-favicon`, `envelope`, `doors` |

The right-hand column is a text census of the test-side files by owner joined with the run's record of which files drive the door (section 4): it lists files that name the behaviour. I did not read each assertion.

**The one test that ties the two doors together** is control-plane's: `T/control-plane/r137-parity.test.mjs` builds a world (`:66`), drives `makeFetch({})` (`:35`) and the world's door, and compares the store request each makes for one op of each family (`:65`, lead from its title; [MEASURED] it called the world's door 9 times). It runs at 195, after every screens part.

## 4. control-plane's own tests, and journey-check's

**How each file was classed.** Not by its header. From its code with comments stripped: whether it calls `makeFetch(`, the addresses it asks (`path: "..."` literals outside `/api`), and whether it reads the inner store request (`opCalls`, `.calls`, `.params`, `.route`), asserts a refusal, or reads a response header. From the instrumented run: calls of the harness's `call`, page boots, worlds, fixture stores, workerd starts, and whether `record.mjs` or plane's entry was loaded or read. I read the imports of the 15 files these rules left unclear. Each file's values are in the JSON (`doorClass`) [MEASURED].

**control-plane, 95 test files, 564 tests, all passed in the instrumented run.**

| class | files | which |
|---|---|---|
| Drives the real door over the fake store only, and asks nothing outside `/api` | 55 | for example `stamps`, `gates`, `envelope`, `routes`, `r45-routes`, `t35-door` |
| The same, and also asks an address outside `/api` | 11 | a page (`/` or `/app...`): `doors`, `page-policy`, `t36-door`, `t46-app`, `t48-door`, `t50-door`, `r8-phase-clock`, `t51-server-timing`, `t51-page-log`; not a page: `r101-favicon` (`/favicon.ico`), `t47-door` (the logo asset) |
| Drives the real door with a real store behind it | 12 | control-plane's `record.mjs`: `archive`, `doorbell`, `inbox-door`, `r50-routes`, `r53-routes`, `t34-routes`, `t51-g43-embed`; store-request's world: `r137-parity`, `r48-routes`; store-assembly's fixture: `r72-parted`; plane under workerd: `r130-killed-ways-in`, `r135-real-rows` |
| Does not drive the door: functions called directly | 13 | `declared-disagree`, `declared-registration`, `op-grades-owners`, `owner-ops`, `r128-timing-desc-bytes`, `r129-isolate-age`, `r130-jobs`, `storage-words`, `totality`, `interface-shell/g30`; over `record.mjs`: `provenance-split`, `r124-owed-render`, `t51-visitor-copy` |
| Does not drive the door: boots screens in the page harness | 4 | `interface-shell/declared`, `e12`, `g31`, `t50` (the last three over the world's door) |

Against the three kinds asked about:
- **The door itself** (routing, sign-in, admission, stamps, headers): the 66 files of the first two rows. Behind the door is a fake store that answers `{ok: true, echo: route}` (`harness.mjs:82`), so whatever op a test names, only what the door did with it can be asserted. Of the 78 files that drive the door, 66 read the inner store request, 43 assert a refusal and 19 read a response header [MEASURED, text counts]. The harness made 86,865 door calls in the run.
- **Pages or screens through the door**: 9 files ask the door for a page and 2 more for a plain address. In every file that drives the door the page harness booted nothing (page boots 0) [MEASURED]: control-plane's own tests compare the served page, script and assets as bytes and headers and never run a screen from them. The tests that fetch a page from the real door and then boot it are plane's (`control-plane/t46-e2e`, `t47-e2e`, `t51-bootstrap`: `02-test-map.md`, not re-checked here). The 4 files of the last row draw screens with no door at all; no control-plane source is loaded in them and their latest other module loaded is screens-action (194) [MEASURED].
- **Other modules' ops through the door**: 58 of the 78 name at least one op that another module declares in its `DECLARED_OPS` (most often capture's, review's, promotion's, doorbell's, credentials'); 48 name an op with no `DECLARED_OPS` owner, which I could not attribute. In 66 of the 78 the owner's code is not behind the door; in the 12 of the third row it is.

Also [MEASURED]: 83 load `src/control-plane/`, and with it every screen module, since `src/control-plane/index.mjs:54-62` imports the nine `SCREENS`; for 84 files the latest other module loaded is screens-action (194). And 2 start a later module's Worker (plane's).

**journey-check, 40 test files.** Its run is incomplete (Method): 39 files left a record, 21 of them exited clean, `journey-check/live.test.mjs` left none. The classes below rest on the run where the file ran and on its imports otherwise; for the 18 that failed they are leads.

| class | files | which |
|---|---|---|
| Drives the real plane under workerd | 2 | `journey-check/journey` (12 workerd starts; the walk's local arm), `control-plane/t51-round9-seam` (17 starts before I stopped it; it imports six `r9-seam-*.mjs` section files, five of them plane's by `02-test-map.md`) |
| Boots real screens in the page harness, no door | 3 | `journey-check/conclude-fields`, `invite-box` (both over the world's door), `start-project` |
| Other Workers under workerd | 3 | `journey-check/route-encoding`, `runner`, `promotion/write-path` |
| The walker's own code over fixture pages, a fake plane or nothing | 20 | the rest of `T/journey-check/` (13 of them reach `playwright-core` by import) |
| Another module's test at its own interface, no door driven | 12 | `actions/t45`, `t48`, `answer-envelope/catalogue-end`, `families`, `control-plane/r131-gate`, `docket/reads`, `file-safety/rows`, `following/checks`, `test-support/corpus`, `system/row-census`, `build/tools/test/words-convert`, and `journey-check/unmet-parked` (no test in it) |

Against the three kinds: whether any of the 40 asserts on the door's own routing, sign-in, admission or headers is [NOT CHECKED], since I did not read each assertion; none drives `makeFetch` in Node [MEASURED: 0 harness calls, 0 `makeFetch(` in their text]. Pages through the real door are `journey` alone; other modules' behaviour through the real door is `t51-round9-seam`. `actions/t45`, `t48`, `promotion/write-path` and `system/row-census` load plane's and control-plane's source in Node (their latest other module loaded is stewards, 203) [MEASURED].

## 5. Measured run times

**GitHub** [MEASURED, GitHub's own records read through the GitHub tools on 23 Nov 2026; repository `neobobkrause/civicsmith-copy`, workflow `module-tests.yml`]. "Step" is the step `run the tests in scope` of the job `module-tests`: its `started_at` to `completed_at`. That step runs the tool's `check` of the module and then one `node --test` call, so it is longer than the tests alone. Scope, files and tests are the job log's own summary line where I read the log.

| module | branch, run | scope in the log | files | tests / pass | step | `node --test` `duration_ms` |
|---|---|---|---|---|---|---|
| store-services | job/store-services.2, 45165505978 | whole module | 5 | 26 / 26 | 6 s | not read |
| store-assembly | job/store-assembly.4, 45172735399 | whole module | 91 | 706 / 706 | 156 s | not read |
| store-request | job/store-request.2, 45145864460 | whole module | 23 | 120 / 118 (0 fail) | 119 s | not read |
| interface-shell | job/interface-shell.1, 45140358965 | whole module | 37 | 321 / 321 | 77 s | 71.2 s |
| screens-action | job/screens-action.2, 45147965113 | whole module | 42 | 332 / 332 | 109 s | 76.8 s |
| control-plane | job/control-plane.2, 45154655734 | whole module | 95 | 564 / 564 | 284 s | not read |
| release | job/release.1, 45151385623 | whole module | 10 | 64 / 64 | 59 s | not read |
| screens-intake | job/screens-intake.1, 45150576407 | log not read | | | 373 s | |
| screens-inquiry | job/screens-inquiry.1, 45154552643 | log not read | | | 462 s | |
| screens-settings | job/screens-settings.2, 45165529826 | log not read | | | 158 s | |
| screens-daily | job/screens-daily.1, 45155089621 | log not read | | | 232 s | |
| screens-investigate | job/screens-investigate.1, 45151462069 | log not read | | | 180 s | |

For five more parts I read only the whole run's `created_at` to `updated_at`, which holds both jobs with their checkouts and installs (where I know both, the run lasts 132 to 325 s longer than the step): screens-entry (run 45142481301) 221 s; screens-publish (45143866376) 234 s; screens-send (45145143400) 159 s; screens-find (45153278119) 155 s; screens-public (45142073969) 167 s.

No run exists [MEASURED: `list_workflow_runs` with the branch gave `total_count: 0`] for `job/interface-assets.1`, `job/screens-wizards.1`, `job/screens-capture.1`. store-request's latest run (job/store-request.3, 45150937711) skipped the test step. journey-check: `job/journey-check.1` has 9 successful runs; the five latest lasted 93 to 129 s as whole runs, which is shorter than the two jobs' set-up alone in the rows above, so no test step time was read. INFERENCE from those durations: their scope was "nothing"; reading one job log would settle it. plane's runs are in `03-run-time.md`. Not looked up: screens-account, screens-document, screens-question, screens-people (one test file each).

**Local baseline** [MEASURED]. Machine: 4 CPUs (`nproc`), 15 GB, Node 26.10.0. A clean scratch worktree of the same commit, `node_modules` linked from the main checkout. Command, once per module, one after the other, nothing else of mine running: `node --import ./bio-plane/test/platform-sqlite.mjs --test <every test file of the module>` (no `check`). Load average at the start of the first was 0.83.

| module | files | tests / pass | wall | `duration_ms` |
|---|---|---|---|---|
| interface-shell (177) | 37 | 321 / 321 | 94.7 s | 94.7 s |
| screens-intake (183) | 41 | 375 / 375 | 361.8 s | 361.8 s |
| screens-action (194) | 42 | 332 / 332 | 72.7 s | 72.7 s |

`07-move-held-paging.md` measured screens-intake's 41 base files at 351.7 s on the same machine. The instrumented runs shared the machine with other workers' jobs and are not baselines; two that ran while it was quiet agree with the table: screens-action 72.9 s, screens-intake 368.6 s.

## 6. The helper leak

**What the helper does** [READ `bio-plane/test/declared-ops.mjs`]. `declaredOpsOf(root, upTo)` and `registerDeclared(root, upTo, ...)` both read through `pairsOf` (`:130-142`). With a bound, `boundedModules` (`:98-119`) walks every `files` path of every module up to the bound: `:83` `for (const name of readdirSync(full).sort())` lists each folder, whoever owns what is inside. It then keeps a file when the module that owns it by `files` alone is the module being walked (`:110-118`; `:107` reads `entry.files` only, never `tests`). So a file inside an earlier module's folder that a later module claims through `tests` is kept. `pairsOf` then reads every kept file as text (`:135` `if (!EXPORT_LINE.test(readFileSync(file, "utf8"))) continue;`) and imports it only if it holds the line `export const DECLARED_OPS` (`:136`).

**What that reaches** [MEASURED: `node declread.mjs <bound>`, a script that repeats lines 98-119 and compares with the full owner]. For the bound `interface-shell` the helper reads 1,045 files and lists 539 folders; 16 of the files belong to a later module: 6 of plane (four `agent-worker/test/*.test.mjs`, `agent-worker/test/plane-world.mjs`, `roster-reader/test/fixtures/capture.mjs`) and 10 of journey-check (nine `agent-worker/test/*.control.mjs` and `mutation-tree.mjs`). The same 16 are read for the bounds `store-assembly`, `screens-settings`, `screens-intake`, `screens-daily` and `control-plane`; 17 for `monitoring` and `queue` (those 16 and admission's `pdf-worker/test/structure.test.mjs`); 2 for `answers` and `op-grades` (plane's `roster-reader/test/fixtures/capture.mjs` and admission's `pdf-worker/test/structure.test.mjs`). None of the 16 holds the export line today, so none is imported, as `07-move-held-paging.md` found; the run agrees (no later module's file was loaded as code in any test file run).

**Who calls it** [MEASURED: `grep -rn "declaredOpsOf(\|registerDeclared(" --include=*.mjs --include=*.js .` outside `node_modules`]. 18 files call it. 17 call it on the repository's root with a bound: interface-shell `harness.mjs:54`, `register.mjs:9`; control-plane `register-declared.mjs:15`, `op-grades-owners.test.mjs:15`; store-assembly's `op-declarations/register-owners.mjs:10`, `affordances/register-owners.mjs:12`; `op-grades/declared.mjs:91`; screens-settings `register.mjs:10`; screens-daily `register-declared.mjs:6`, `register-tasks.mjs:7`; plane's `screens-intake/t51-seam-e7.test.mjs:21`, `t51-seam-g126h.test.mjs:18`; and five test files that call it inside a test (`answers`, `monitoring`, `queue`, `store-assembly/declarations`, `affordances/owners-registered`). The 18th, `test-support/declared-ops.test.mjs`, calls it on folders it makes itself.

**Which test files reach it** [MEASURED, static: the import closure of each of the repository's 3,118 test files, `node analyze.mjs`]. 519 hold one of the 17 callers: op-grades 12, answers 1, monitoring 1, queue 1, store-assembly 28, interface-shell 37, screens-entry 1, screens-wizards 6, screens-settings 24, screens-intake 40, screens-find 3, screens-daily 30, screens-document 1, screens-question 1, screens-inquiry 62, screens-people 1, screens-investigate 34, screens-public 1, screens-publish 29, screens-send 7, screens-action 40, control-plane 84, plane 58, journey-check 17. 347 reach it through interface-shell's `harness.mjs` and 130 through control-plane's `register-declared.mjs`; for 494 the call is at a file's top level, so it runs on import.

**Confirmed by running** [MEASURED: `node leak.mjs` over the run's records]. All 444 of those outside plane and journey-check were run with file reads recorded. 430 read at least one later module's file from the collector's set: answers 1 (2 files), monitoring 1 and queue 1 (17 each), store-assembly 26 (19 read all 16, 7 read one), interface-shell 37, the screens parts 280, control-plane 84 (16 each). 14 did not: op-grades' 12 and 2 of store-assembly's, whose caller sits inside a function those runs did not call. plane's 58 were not run by me. journey-check is last in the order, so nothing is later than it.

One test, shown whole: `T/screens-entry/page.test.mjs` loaded 750 modules, read 524 other files as text and listed 540 folders; 16 of the files read belong to a later module, the 16 named above, and none was loaded as code.

## What I did not check

- **What each test asserts.** "What it proves" in the JSON is a lead (header text and ids). Sections 3 and 4 class files by what their code calls and by run-time counters, not by reading every assertion.
- **plane's 147 test files** were not run or re-traced; they are counted from `02-test-map.md`.
- **journey-check's run is incomplete**: stopped at 14 minutes, 128 of 327 tests failed, `live.test.mjs` has no record, `t51-round9-seam` is partial. I did not establish why each failed; one file I checked fails the same way in a clean worktree.
- **Run-time routes not recorded**: `statSync`, `existsSync`, `accessSync`; reads inside workerd, Chromium, esbuild or another non-Node child; the network. "No later module's code was loaded" is about Node's own loads, plus Miniflare's reads of source through `node:fs`.
- **Table answers that ask the world** were counted only in the parts run after I added that counter; for screens-wizards (1 file) and screens-publish (2 files) with both kinds of draw the split is unknown.
- **Per-test counts** are the counters' change during each test and miss state shared between tests.
- **GitHub**: the scope of five runs (screens-intake, screens-inquiry, screens-settings, screens-daily, screens-investigate) was not read from the log; journey-check's runs were not opened; four one-file parts were not looked up; I read one run per module, not several.
- **Local baselines** are one run each on a shared machine; only the starting load average was checked.
- **The static trace** is by regular expression; it sees no path built at run time. The run covers that for the 597 files that ran, not for the 90 helpers on their own.
- **The tool's `check`** was not run; whether the process counts a text read of a later module's file as a use is not mine to say (evidence rule 7 counts it).
