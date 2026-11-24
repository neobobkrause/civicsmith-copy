Length: 308 lines. Last section: "What I did not check".

# Reaches by path to a later module, in the plan's new order

Written 24 Nov 2026 by a worker of the civicsmith plane-scope lane, for ARCH's request: every reach by path to a LATER module that remains after the plan. I decide nothing. Tags follow `evidence-rules.md`. Base: the working tree; its product files and `process/modules/` equal `a26a8da2` ([MEASURED] `git diff --stat a26a8da2 -- . ':!process/lanes'` names only three `process/*.md` files).

**The order used** (design section 2, step 7): modules 1 to 175 as today (to `store-request`), then `control-plane` (176), `plane` (177), the 19 UI modules (178 to 196), a new module `top` (197) owning `bio-plane/src/plane/index.mjs` and `bio-plane/src/plane/ui.mjs`, then `release` (198) and the rest (205 modules in all). Every module keeps today's `files` and `tests`; `top` has no tests. `src/plane/ui.mjs` does not exist today ([MEASURED] `ls bio-plane/src/plane/`), so `top` owns one file here.

**What counts.** A "reference" is one later module reached from one place; a "place" is a file:line. Left out: static `import`, `export … from`, a literal `import("…")`, a comment import, `require`, and text leads (`path-text`). Kept: every other kind (read, listing, stat, write, child process, script pattern, Worker started, service binding, path held), by every evidence class, and an `import()` whose argument is not one literal text even where the graph settled it.

## Headline answers

[MEASURED] all counts from `reaches/places.json` `totals`, made by the command in "How it was made".

- **Yes, reaches by path to a later module remain after the plan's order: 251 places, 3,459 references.** 49 places are code (in 12 files), 202 are tests. They sit in 130 files of 39 modules.
- **Upward today and still upward: 112 places, 3,114 references** (code 48 places, 2,195 references; tests 64 places, 919 references). No place that is upward today stops being upward: the move takes away no reach by path, because no UI file reaches `control-plane` or `plane` by path.
- **Made upward by the move: 139 places that were not upward before, and 345 references** (code: 1 place, 1 reference, `bio-plane/wrangler.jsonc:11`; tests: 138 places, all held by `control-plane` and `plane`, 344 references). 7 more test places that are upward today gain references to the UI.
- **18 more places reach `top`'s entry by the code's reading**, which the run data cannot show (it names modules, not files). They are marked `topByReading` and are not in the counts above.
- Left out as imports: 172 upward rows, all literal: control-plane's code 13 (its UI imports, which step 5 removes), control-plane's tests 48, plane's tests 111. `p4 check` sees those.

The three named:

- **(a) The entry.** `bio-plane/wrangler.jsonc:11` (plane) names `src/plane/index.mjs` as `main`, and `bio-plane/scripts/fleet-bundle.mjs:522` (bundler, 12) holds the same path as the plane bundle's entry. After the move both point at `top`'s file; `build-plane.mjs` (plane) names no path but builds it through bundler and writes plane's `dist/`, which then holds a built copy of `top` and the 19 UI modules.
- The graph counts wrangler's `main` as a Worker started (settled); it counts `PLANE_ENTRY` only as a text lead, though bundler hands it to esbuild as the entry. `bio-plane/package.json` (test-support, 9) runs the build and `wrangler dev`; every other file that builds or deploys the entry is `release`'s or later, so it reaches downward.
- **(b) `extract(root)`** (setup-words, 2) reads the source of every module of `build/modules.json` but tests and generated files, and writes `rows.mjs` and `words-unreviewed.json` in setup-words' own folder. It is run by hand from the command line and by setup-words' own tests over the real tree (`--check`, `--pseudo`); no package script or workflow runs it ([MEASURED] whole-tree grep below).
- It reaches 203 later modules after the move (202 today, plus `top`). The output is committed in setup-words' folder; the reach is the input, not the output.
- **(c) `fleet-bundle.mjs`** (bundler, 12) is a library: 22 of its 24 places use a path built from what its caller hands in (a member, or a file path), and 2 list the top folder and read each folder's `fleet-member.json` by themselves. Its computed `import()` reached 7 later modules in the runs: pdf-worker, ocr-worker, sheet-worker, file-scanner, agent-runner, agent-worker, case-checker. Each of the 7 has a build script that calls bundler (pdf-worker's and case-checker's hand their own member; for the other five I read the import lines only); which caller handed which member in the runs is not recorded.
- The move changes none of the 7 (all before control-plane). Handed the plane's descriptor (by build-plane, release's scripts and tests), bundler reads all 852 inputs of the plane bundle, 177 later modules' files after the move, `top` and the UI among them.

Other findings, each in its section below:

- **121 places in 61 files start a Worker from `top`'s entry by its path** (Miniflare `scriptPath`); 60 of the files are plane's. Step 6 takes its list "from `p4 check`'s refusals", and `check` reads imports only: INFERENCE from the two, that list would not hold these files unless they also import the entry.
- **9 test places of control-plane and plane import a UI module or the entry through a computed `import()`** (a template over a list of names, or a name bound to the path).
- **Census tests** (a walk of all of `src/`, of the repository, or of every module's paths): 20 places, plane's own among them.

## How it was made

```
node process/lanes/plane-scope/research/reaches/reaches.mjs <scratch-folder>
```

From the top folder (about 80 s, 5 GB). It writes into the scratch folder the module files, the new `order.txt` and `top.json`; a copy of `research/tools/graph.mjs` with four lines changed (ROOT, OUT and the two module-file reads); `hand-resolutions.json`; `runtime-sites.json` renumbered to the new order. It runs the copy and writes the places from its `upward.json`. `--order old`: today's order; `--no-run`: reuse the last run; `--write <file>`: where the places go (`reaches/places.json` was written so).

Checks [MEASURED]: with `--order old` the copy's `upward.json`, `module-edges.json`, `files.json` and `computed.json` equal `research/graph/`'s byte for byte (`cmp`), and give 112 places (09-graph's 184 rows less 60 leads, merged by file:line). A second full run from `research/reaches/` gave the same `places.json` (`cmp`, `made` aside).

Limit: the runs record modules, not files, so plane and `top` are one there. For run-known places I read the code for `src/plane/index.mjs` (`topByReading`: 18 add `top`; `fleet-bundle.mjs:1133`, `module-order.test.mjs:76`, `refusal-census.test.mjs:21`, `sa-parity.test.mjs:15` reach plane, not `top`).

## Every place

`*` after a module: the pair is made upward by the move (not upward today; `top` counted as plane today). "+top (read)": the code's reading adds `top`. Owner numbers are places in the new order. `S/` = `bio-plane/src/`, `T/` = `bio-plane/test/m/`, `bp/` = `bio-plane/`. The full list, with every module reached, is `reaches/places.json`.

### Code places (49)

setup-words' 2 places are in (b), bundler's 24 in (c). The other 23:

| from | place | kind | later modules reached | how known |
|---|---|---|---|---|
| documents (1) | `docs…/screens/build_words.mjs:16` | fs-read (caller) | 1: journey-check | callers |
| documents (1) | `docs…/screens/build_words.mjs:300` | fs-list (listing) | 2: setup-words, journey-check | listing |
| documents (1) | `docs…/screens/build_words.mjs:366` | fs-write | 1: setup-words | settled |
| documents (1) | `docs…/screens/words-modules.src.py:21` | fs-read | 1: setup-words | settled |
| test-support (9) | `.github/scripts/module-tests.mjs:8`, `:9`, `:10`, `:19` | stat, list, proc (hand) | 183 each: runtime-limits, signatures, bundler, … | hand |
| test-support (9) | `bp/package.json:6` | proc (pattern) | 161: runtime-limits, signatures, bundler, … | pattern |
| test-support (9) | `bp/package.json:7` | proc (pattern) | 4: plane, release, installer, journey-check | pattern |
| test-support (9) | `bp/package.json:8` | proc | 1: plane | settled |
| test-support (9) | `bp/package.json:9` | proc | 1: release | settled |
| test-support (9) | `bp/test/declared-ops.mjs:80` | fs-stat (run) | 188 +top (read) | run |
| test-support (9) | `bp/test/declared-ops.mjs:83` | fs-list (run) | 151 | run |
| test-support (9) | `bp/test/declared-ops.mjs:135` | fs-read (run) | 188 +top (read) | run |
| test-support (9) | `bp/test/declared-ops.mjs:136` | computed import() (run) | 95: legistar-reader, file-scanner, member-roster, … | run |
| pdf-worker (34) | `pdf-worker/package.json:8` | proc (pattern) | 2: ocr-worker, admission | pattern |
| agent-worker (110) | `agent-worker/package.json:8` | proc (pattern) | 1: plane | pattern |
| agent-worker (110) | `agent-worker/package.json:9` | proc | 1: journey-check | settled |
| agent-worker (110) | `agent-worker/wrangler.jsonc:92` | service-binding | 1: plane | settled |
| plane (177) | `bp/wrangler.jsonc:11` | worker | 1: top* | settled |
| installer (202) | `newgroup/scripts/build.mjs:21`, `:41` | path, then fs-read | 1: journey-check | settled |

What each is for [READ]:
- `build_words.mjs` (documents): the design's word-list generator, run by hand (header `:9`, a lead). `:16` reads the mockup scripts (journey-check's); `:300` lists its own folder; `:366` writes `words.json` (setup-words'). `words-modules.src.py:21` reads `words.json`.
- `module-tests.mjs` (test-support): runs every module's tests listed in `build/modules.json` (`regression.yml:61` runs it): a census meant to cover every module.
- `bio-plane/package.json` (test-support): `test` (`:6`) runs every `test/m/**/*.test.mjs`, a census pattern; `test:system` (`:7`); `build` (`:8`) runs `scripts/build-plane.mjs` (plane); `deploy` (`:9`) runs `scripts/deploy.mjs` (release); `dev` (`:10`) runs `wrangler dev`, which reads `wrangler.jsonc` (the graph does not follow wrangler).
- `declared-ops.mjs` (test-support, a helper under `files`): `filesOf` (`:80`, `:83`) walks each module's `files` paths; `pairsOf` reads each file (`:135`) and imports those exporting `DECLARED_OPS` (`:136`). With `upTo` it stops at that module of `order.txt`; without it, all of `build/modules.json` (`:122-125`, `:133`). `src/plane/index.mjs` has no `DECLARED_OPS` ([MEASURED] grep), so `:136` does not import `top`.
- `pdf-worker/package.json:8`, `agent-worker/package.json:8`: `test/*.test.mjs`, a folder holding other modules' tests (ocr-worker and admission; plane's agent-worker files). `agent-worker/package.json:9` runs journey-check's `test/agent-worker.control.mjs`.
- `agent-worker/wrangler.jsonc:92`: deployment config, service binding `PLANE` → the Worker named `bio-plane`.
- `bio-plane/wrangler.jsonc:11`: deployment config, `"main": "src/plane/index.mjs"`. See (a).
- `newgroup/scripts/build.mjs:21`, `:41` (installer): build tool; reads journey-check's `words-reads.json` to cut the installer's word rows.

### Tests of control-plane, plane and the UI modules (159 places)

Every place is here, one row (or list entry) per file and group, with all its lines. "22a/b/c": what research 22a to 22c say of the file (class a: plain test at the owner; b: test-only Worker at the owner; c: needs reconstruction; d: duplicate, dropped). "-": not a row there (a helper, or one of plane's own files). `top` owns no tests here, so none are `top`'s.

| owner | group | file | lines | later modules | 22a-c |
|---|---|---|---|---|---|
| control-plane | boots-entry | T/control-plane/rows-plane.mjs | 14, 53 | top, plane | - |
| control-plane | computed-import | T/interface-shell/declared.test.mjs | 85 | 9: screens-entry*, screens-wizards*, … | - |
| control-plane | computed-import | T/interface-shell/e12.test.mjs | 11 | 9 screens* | - |
| control-plane | computed-import | T/interface-shell/g30.test.mjs | 15 | 9 screens* | - |
| control-plane | computed-import | T/interface-shell/g31.test.mjs | 13 | 9 screens* | - |
| control-plane | computed-import | T/interface-shell/t50.test.mjs | 44, 576 | 9 screens* | - |
| control-plane | words-reads-table | T/control-plane/t49-door.test.mjs | 273 | journey-check | - |
| interface-shell | words-reads-table | T/interface-shell/words-keys.test.mjs | 16 | journey-check | - |
| screens-entry | words-reads-table | T/screens-entry/common.test.mjs | 149 | journey-check | - |
| screens-wizards | words-reads-table | T/screens-wizards/words.test.mjs | 9 | journey-check | - |
| screens-settings | words-reads-table | T/screens-settings/contract.test.mjs | 73 | journey-check | - |
| screens-inquiry | words-reads-table | T/screens-inquiry/words.test.mjs | 12 | journey-check | - |
| screens-publish | words-reads-table | T/screens-publish/common.test.mjs | 16 | journey-check | - |
| plane | census | T/lines/invariants.test.mjs | 34, 39 | 20: the 19 UI*, journey-check; +top (read) | 22c c |
| plane | census | T/plane/g83-census.test.mjs | 46, 48, 66 | 20: the 19 UI*, journey-check; +top (read) | - |
| plane | census | T/plane/worker.test.mjs | 145, 166, 169 | 22: the 19 UI*, release, installer, journey-check; +top (read) | - |
| plane | census | T/store-assembly/sa-assembly.test.mjs | 252 | top* | 22c a |
| plane | computed-import | T/plane/t47.test.mjs | 103 | 9 screens* | - |
| plane | computed-import | T/plane/t50.test.mjs | 115 | 9 screens* | - |
| plane | computed-import | T/plane/worker.test.mjs | 15 | top* | - |
| plane | plane-world-copy | agent-worker/test/plane-world.mjs | 47, 50 | release, installer, site, stewards; +top (read)* | - |
| plane | plane-world-copy | T/capture-requests/plane-world.mjs | 48, 51 | release, installer, site, stewards; +top (read)* | - |
| plane | test-cache | T/screens-daily/c25-seam.test.mjs | 20, 25, 26, 27, 28, 31 | screens-daily* | 22c a |
| plane | words-reads-table | T/plane/store.test.mjs | 95 | journey-check | - |
| plane | worker-program-text | T/interface-shell/page-contention.probe.mjs | 16, 23 | 10: interface-shell*, 9 screens* | - |


**Plane's 60 boots-entry files** (all reach `top*` only; lines in each file), by what 22a to 22c say:

- 22b a (asserts screens): `T/control-plane/t46-e2e.test.mjs` 21, 26; `T/control-plane/t47-e2e.test.mjs` 19, 24; `T/control-plane/t51-bootstrap.test.mjs` 18, 23.
- 22b a: `T/control-plane/r100-upload.test.mjs` 74, 77; `T/control-plane/r117-held.test.mjs` 191, 194; `T/control-plane/r118-shared.test.mjs` 31, 34; `T/control-plane/t51-held-failed.test.mjs` 19, 55; `T/control-plane/t51-reading-follows.test.mjs` 19, 50; `T/control-plane/t51-round5-seam.test.mjs` 20, 70.
- 22b a, b: `T/control-plane/r8-door-phases.test.mjs` 116, 120; `T/control-plane/t51-round5-press-seam.test.mjs` 19, 50; `T/control-plane/t51-round6-seam.test.mjs` 23, 80.
- 22b b: `T/control-plane/stats-capacity.test.mjs` 12, 26; `T/control-plane/t51-large-pdfs.test.mjs` 17, 44.
- 22b d, c: `T/control-plane/t51-hops.test.mjs` 14, 17.
- 22b a, b (part asserts screens): `T/control-plane/t51-round7-seam.test.mjs` 23, 47.
- 22c a: `T/affordances/plane.test.mjs` 43, 46, 47; `T/capture/plane.test.mjs` 14, 21; `T/capture/r7-upload-plane.test.mjs` 13, 19; `T/host-governor/ops.test.mjs` 253, 267; `T/instance-setup/reports.test.mjs` 160, 165; `T/reevaluation/r14-regrade-door.test.mjs` 16, 41; `T/screens-daily/c25-seam.test.mjs` 19, 55; `T/screens-inquiry/fr5-seam.test.mjs` 19, 22; `T/screens-inquiry/fr6-seam.test.mjs` 19, 22; `T/screens-inquiry/g41-document.test.mjs` 79, 82; `T/screens-inquiry/r10-question-seam.test.mjs` 18, 21; `T/screens-inquiry/r10-stated.test.mjs` 25, 28; `T/screens-inquiry/r9-refusal.test.mjs` 20, 23; `T/screens-inquiry/r9-seam.test.mjs` 20, 23; `T/screens-intake/r10-open-file.test.mjs` 16, 19; `T/screens-intake/t51-seam-e7.test.mjs` 23, 32.
- 22c b: `T/affordances/door-events.test.mjs` 17, 19, 20.
- 22c c: `T/instance-setup/worker-reports.test.mjs` 17, 41; `T/screens-daily/casedrafts-seam.test.mjs` 19, 25; `T/screens-intake/t51-seam-g126h.test.mjs` 20, 25; `T/screens-publish/door-seam.test.mjs` 12, 15.
- 22c d: `bp/test/cap13-reuse-pages.test.mjs` 56, 80; `bp/test/conclude-project.test.mjs` 86, 87; `bp/test/d526-refusal-order.test.mjs` 44, 57; `bp/test/d57selflink.test.mjs` 44, 65; `bp/test/d606-perpage-ocr.test.mjs` 46, 92; `bp/test/members.test.mjs` 39, 42; `bp/test/mk6-bundle-names-no-author.test.mjs` 67, 71; `bp/test/stats-disclosure.test.mjs` 75, 77; `bp/test/tier2-wire.test.mjs` 73, 120; `T/capture/g41b-plane.test.mjs` 9, 15.
- 22a b: `bp/test/system/pdf-worker-binding.test.mjs` 31, 85.
- 22a c: `agent-worker/test/agent-worker.test.mjs` 613, 615; `agent-worker/test/harness.test.mjs` 136; `agent-worker/test/requirements.test.mjs` 79, 98; `agent-worker/test/versions.test.mjs` 119, 120, 204.
- not a row there (helpers and plane's own files): `roster-reader/test/fixtures/capture.mjs` 20, 24; `T/control-plane/r8-kit.mjs` 17, 293; `T/control-plane/r9-seam-documents.mjs` 24; `T/control-plane/r9-seam-reading.mjs` 24; `T/control-plane/wrap-entry.mjs` 12; `T/plane/t42.test.mjs` 113, 115; `T/plane/worker.test.mjs` 13, 20; `T/screens-intake/realplane.mjs` 13, 21.

"9 screens": screens-entry, -wizards, -settings, -intake, -daily, -inquiry, -investigate, -publish, -action.

What each group is for [READ]:
- **boots-entry**: the test (or its helper) holds `src/plane/index.mjs` and starts Miniflare with it, e.g. `T/control-plane/t46-e2e.test.mjs:26` `scriptPath: SRC, script: readFileSync(SRC, "utf8")`. Running the entry loads all it imports, the door and the UI among them; the graph counts the entry file only.
- **computed-import**: e.g. `T/interface-shell/e12.test.mjs:11` ``await import(`../../../src/${m}/index.mjs`)`` over a list; `T/plane/worker.test.mjs:15` `await import(ENTRY)` (`:13` `ENTRY = join(SRC, "plane", "index.mjs")`). The five interface-shell files are control-plane's tests (its `tests` list).
- **census**: `lines/invariants.test.mjs:34-39` imports every `src/*/index.mjs` (looking for a second `holderAt`); `g83-census.test.mjs:45-66` reads every `.mjs` of `src/` (`idFromName(`); `worker.test.mjs:140-171` (R8) reads all of `src/`, `test/`, `scripts/` (imports of three removed files); `sa-assembly.test.mjs:250-256` (R99) reads every `.mjs` of `src/plane/`.
- **plane-world-copy**: `agent-worker/test/plane-world.mjs:47-58` links every top folder into a temporary folder, copies all of `bio-plane/src` there and writes an entry importing the copy of `./index.mjs`: a copy of `top` and every module. The graph sees only the listing.
- **test-cache**: `c25-seam.test.mjs:20-31` downloads a pinned PDF into `T/screens-daily/.cache/` (screens-daily's test folder) and reads it.
- **words-reads-table**: the test reads its module's `reads` list from `docs/…/screens/words-reads.json`, which journey-check claims by name inside documents' folder.
- **worker-program-text**: `page-contention.probe.mjs:16-23` writes a Worker program whose text imports interface-shell and the nine screens modules by path. [MEASURED] `git grep -l page-contention` names no code file but the probe itself (only `plane.json` and requirement and job texts).
- **rows-plane.mjs** (control-plane's helper): `:14` holds `PLANE_ENTRY = join(HERE, "../../../src/plane/index.mjs")`, `:53` starts Miniflare from it.

### Other modules' tests (43 places), grouped

| owner | group | places | files | later modules |
|---|---|---|---|---|
| image-codecs (30) | fixture-maker | 3 | `pdf-worker/test/fixtures/make-{dct,jbig2,jpx}-fixtures.py` | pdf-pixels |
| pdf-worker (34) | census | 1 | `pdf-worker/test/test-script.test.mjs:12` | ocr-worker, admission |
| member-roster (40) | census | 1 | `T/member-roster/module-order.test.mjs:76` | 145 |
| money (73) | census | 4 | `T/money/refusal-census.test.mjs:13, 15, 21, 23` | 118, +top (read) |
| agent-worker (110) | census | 3 | `agent-worker/test/t35.test.mjs:607, 608, 613` | 94, +top (read) |
| stewards (204) | census | 2 | `stewards/test/requirements.test.mjs:619, 624` | journey-check |
| 19 modules (39 to 174) | words-reads-table | 26 | `T/op-grades/words.test.mjs:13` and 25 more | journey-check |
| run-rules (96) | single-file-check | 1 | `T/run-rules/deployment.test.mjs:23` | agent-harness |
| wizard-library (153) | single-file-check | 1 | `T/wizard-scripts/source/registry.test.mjs:14` | wizard-scripts |
| store-assembly (174) | child-fixture | 1 | `T/store-assembly/sa-parity.test.mjs:15` | plane |

The 19 words-reads modules: op-grades, member-roster, membership, ai-accounts, capture, extraction, entities, local-facts, retrieval-browse, retrieval, ai-runs, question-explorer, case-import, filings (2), affordances (2), translations, instance-setup, admission, store-assembly (6). All 43 are upward today; the move adds only `top`, by reading, to money's and agent-worker's census.

## (a) The Worker entry: every file that names it, builds it or deploys it

| file | owner (new place) | what it does with the entry [READ] | after the move |
|---|---|---|---|
| `bio-plane/wrangler.jsonc:11` | plane (177) | `"main": "src/plane/index.mjs"`; read by `wrangler dev` | plane → top, made upward (graph: worker, settled) |
| `bio-plane/scripts/fleet-bundle.mjs:522`, `:527-541` | bundler (12) | `const PLANE_ENTRY = "src/plane/index.mjs"`; `planeMember()` gives it as the entry, with outfile and manifest in plane's `dist/`; esbuild takes it as `entryPoints: [b.entry]` (`:1271`, called by `buildMember`) | bundler → top (to plane today); the graph has `:522` as a lead only, `:1271` as computed with a hand rule naming no module |
| `bio-plane/scripts/build-plane.mjs:17-22` | plane (177) | names no path: `planeMember()` then `writeMember(plane)`, which writes plane's `dist/` | no path of its own; it runs bundler's reads of all 852 inputs (below) |
| `bio-plane/package.json:8`, `:10` | test-support (9) | `build`: `node scripts/build-plane.mjs`; `dev`: `wrangler dev` | test-support → plane (settled); `wrangler dev` → `wrangler.jsonc` → top (not in the graph) |
| `process.json` `build_and_serve` | no module (process config) | `npm --prefix bio-plane run build && npm --prefix bio-plane run dev` | outside the module list |
| `bio-plane/dist/bio-plane.bundle.json`, `bio-plane.bundled.mjs` | plane (177) | the committed build: `inputs` lists `src/plane/index.mjs` as text; the bundle holds the code of all inputs | see below |
| `bundles.mjs:87,115`, `release-assemble.mjs:186`, `resolve-version.mjs:85` (all `bio-plane/scripts/`) | release (198) | `planeMember()`; `bundles.mjs` builds it by `npm run build` in `bio-plane/` | downward |
| `bio-plane/scripts/deploy.mjs:243,268,277,546` | release (198) | uploads the built asset given on its command line as the part `index.mjs` (an upload name, not the source path); reads `../wrangler.jsonc` | downward |
| `bio-plane/scripts/dev-copy.mjs:433`; `deploy-test.yml:105,119`, `release-sign.yml:54,58` | release (198) | the dev copy deploys `main: "dist/bio-plane.bundled.mjs"`; the workflows run `bundles.mjs`, `deploy.mjs`, `release-assemble.mjs` | downward |
| `newgroup/scripts/embed-release.mjs:163-167` | installer (202) | reads plane's `wrangler.jsonc` and the release's plane bundle | downward |
| 121 test places (boots-entry), `T/plane/worker.test.mjs:86` | plane, control-plane | start Miniflare from the entry; `:86` asserts `cfg.main === "src/plane/index.mjs"` (text) | see the table above |

[MEASURED] `git grep -n -I -E "src/plane/(index|ui)\.mjs|plane/index\.mjs"` outside tests, docs, `dist/` and `release/` names `fleet-bundle.mjs:519,522`, `wrangler.jsonc:11`, two comments and lines that name `control-plane/index.mjs`; nothing else.

**What the plane's build reads and holds.** [MEASURED] the committed manifest `bio-plane/dist/bio-plane.bundle.json` lists 852 inputs owned by 186 modules (owners by the new order, longest claim). After the move, 20 of those modules are later than plane: the 19 UI modules and `top`. 177 are later than bundler. So:
- Handed the plane, bundler reads files of 177 later modules (`:1482`, `:1562`, `:1729`).
- After the move, plane's committed `dist/bio-plane.bundled.mjs` holds code of 20 later modules. ARCH's condition 6 keeps `dist/` with plane.
- [NOT CHECKED] whether any plane-owned test loads that committed file. [MEASURED] grep of `bio-plane.bundled.mjs` in test files names only release's tests, plane's `t47`/`t48` (a build into a temporary folder), and other modules' fixtures.

**Options for (a)**, as facts about the code:

1. `wrangler.jsonc` moves to `top` (`plane.json`, `top.json` change). Its earlier readers then reach upward: plane's `limits` half (design section 3), `worker.test.mjs:86`, and `agent-worker/wrangler.jsonc:92`'s service name, which the graph maps to it; release, installer and stewards are later. This contradicts ARCH's condition 6.
2. `main` names a file plane owns. `dist/bio-plane.bundled.mjs` is one: `dev-copy.mjs:433` already deploys that. `wrangler dev` would then run the built bundle, not the sources, so a build would come before each dev run (INFERENCE). The comment at `fleet-bundle.mjs:518-520` (T20, K846: "the bundle and a wrangler deploy start from one module") would no longer hold. Only `wrangler.jsonc` changes; `worker.test.mjs:86` changes its expected text. A plane-owned file that imports `top` is not an option: it would be an upward import.
3. `PLANE_ENTRY` and `planeMember()` move from bundler to a module at or after `top`. Callers: `build-plane.mjs` (plane) and plane's `t47`/`t48` would then import a later module, so they move with it. Release's scripts and tests, and installer's tests, are later and keep working. The fleet's own build code stays in bundler.
4. Callers build the plane's descriptor themselves: bundler holds no plane path, but `build-plane.mjs` (plane) then names `top`'s file; release's `release.test.mjs`, `r46.test.mjs`, `ascii.test.mjs` change.
5. Accept it as "a path held as text" (design 2.4); evidence rule 7 counts a path "held as text and used", and both use it.

## (b) `setup-words` `extract(root)`

[READ] `bio-plane/src/setup-words/build.mjs`:
- **Reads.** `ownedFiles(root)` (`:119-139`) reads `build/modules.json` (documents' file, by the longest claim), lists tracked files by `git ls-files`, and keeps every `.mjs`/`.js`/`.cjs` file under a module's `paths`. It skips the 8 `GENERATED_FILES` (`:103-112`), `node_modules`, `dist`, `vendor`, `fixtures` and the like (`:113`), and test files and `tests` paths (`:115`, `:134`). `extract` (`:230-241`) reads each kept file (`:233`) and parses it with the vendored acorn for `localize(id, en)` calls.
- **Writes.** `build()` (`:357-362`) combines `words.json` (setup-words' own) with the calls. `main` (`:364-390`) writes `bio-plane/src/setup-words/rows.mjs` and `words-unreviewed.json`, or with `--check` writes nothing and exits 1 when either is stale, or with `--pseudo` writes `rows.pseudo.mjs` (ignored by git, `.gitignore:343`). All three are in setup-words' own folder. `rows.mjs` and `words-unreviewed.json` are committed ([MEASURED] `git ls-files bio-plane/src/setup-words/`).
- **What the output holds.** [MEASURED] `words-unreviewed.json` has 7,499 entries from 151 module ids of `build/modules.json`. So the committed table carries sentences written in later modules' code.
- **Who runs it.** [MEASURED] `git grep -l "setup-words/build"` outside `process/lanes`, `build/jobs`, `build/plan` and `build/extraction` names, besides docs:
  - `bio-plane/src/journey-check/pseudo.mjs` and journey-check's `dec340`/`pseudo-route` tests import `pseudo` only;
  - case-checker's `fixture.mjs` and `words.test.mjs` import `callsOf` only;
  - setup-words' `extraction.test.mjs` runs `node build.mjs --root ROOT --check` (`:141`) and `--pseudo` (`:174`) on the real tree. Its other runs use fixture trees in a temporary folder.
  - `word-list.test.mjs` runs `--check` on the real tree (`:83`).
  - [MEASURED] no `package.json` script, workflow, `.claude` hook or `process.json` names it. So the regeneration is by hand (job texts say "BOB regenerates at the layer close", a lead).
- **Who reads the output.** `setup-words/index.mjs` imports `rows.mjs`; every module calling `word` or `localize` reads it through that (imports, downward). Tests importing it directly: case-checker's `fixture.mjs`, `words.test.mjs`; installer's `newgroup/test/t50.test.mjs`; `newgroup/scripts/build.mjs:19` holds its path. `words-unreviewed.json`: setup-words' `extraction.test.mjs:16` reads it.
- **Reach.** 203 later modules after the move (202 today, plus `top` by the hand rule "every module that owns a JavaScript file under `files`"). Places `build.mjs:120` and `:233`. The 7 leads at `:105-111` are the generated-file names (data, not reads).

**Options for (b):**
1. The extractor moves to the last module; `rows.mjs` stays committed at setup-words as data. R10, R15, R16 and the real-tree runs (`extraction.test.mjs:141`, `:174`, `word-list.test.mjs:83`) move with it. journey-check imports `pseudo` and case-checker `callsOf` from `build.mjs`, so those two would stay at setup-words in a file of their own.
2. The extractor stays; its real-tree check moves. setup-words' own tests run only on fixture trees, and the `--check` on the real tree moves to the last module. Then the code still reads every module when run by hand, so the code place remains; only the test place leaves setup-words' job.
3. Each module publishes its own code rows. Each module's job writes its own `localize` rows into a file in its own folder, and the table is put together at or after the last module. `rows.mjs` at setup-words then holds design rows only. [READ] `setup-words/index.mjs:73-77`: `localize` answers the row's text when a row exists, else the `en` it is given; and a code row's text is the call's own `en` (`build.mjs:253-256`). INFERENCE from the two: the code rows change no English the product shows; whether translations or the review list need them in setup-words' file is not settled. This changes setup-words' generator and requirements, and adds a file to each module that calls `localize`.
4. Not a reach, because the target is the reacher's own output. That holds for the writes (`rows.mjs`, `words-unreviewed.json`, in its own folder). It does not hold for the reads of 203 modules' source, which evidence rule 7 counts.

This is a census meant to cover every module (R15: "every file a module of `build/modules.json` owns"). The move changes it only by adding `top`.

## (c) `bundler` `bio-plane/scripts/fleet-bundle.mjs`

[READ] each line; reach from `places.json`, after the move (all upward today too).

| line | function | what it does | later modules |
|---|---|---|---|
| 467 | `discoverMembers` | lists the top folder (`readdirSync(repoRoot)`) | 19 (listing) |
| 470 | `discoverMembers` | reads `<dir>/fleet-member.json` in each folder; absent is "not a member" | 19 (run) |
| 593 | `npmProductionPackages` | reads a lockfile the caller names | 6 |
| 639 | `statementPackages` | reads a container's package statement | file-scanner |
| 708 | `containerInstanceTypes` | reads `<member>/wrangler.jsonc` | file-scanner, agent-runner |
| 1133 | `releaseBindingFindings` | reads each member's `wrangler.jsonc`, the plane's among them | 7: six members, plane |
| 1482 | `keptWordRows` | reads each first-party input of a build to find word keys | 43 |
| 1546, 1547 | `buildMember` | makes `<member>/dist/` and writes the bundle (`write: true`) | 5 |
| 1562 | `manifestFrom` | hashes each input | 44 |
| 1569 | `manifestFrom` | hashes `<member>/package-lock.json` | 6 |
| 1619 | `manifestFrom` | sizes each asset | ocr-worker, sheet-worker |
| 1634, 1637 | `writeMember` | makes `dist/`; writes the manifest | 5 |
| 1702, 1710 | `verifyStatic` | reads the committed manifest; the committed bundle | 6 |
| 1729 | `verifyStatic` | re-hashes each input the manifest names | 44 |
| 1787 | `verifyStatic` | re-hashes each asset | 2 |
| 1811 | `verifyStatic` | re-hashes the lockfile | 6 |
| 1884 | `verifyFresh` | reads the committed manifest | agent-worker |
| 2019 | `measureStart` | reads the built artifact | 7 |
| 2033 | `measureStart` | reads each asset to serve it to the import | 2 |
| 2062 | `measureStart` | `await import(url)` of the built artifact, its parts served by the hooks at `:2042` | 7 (run) |
| 2081 | `budgetReport` | reads the artifact's size | 6 |

- **The 7 of the computed import.** pdf-worker (34), ocr-worker (35), sheet-worker (36), file-scanner (37), agent-runner (107), agent-worker (110), case-checker (126). [MEASURED] `computed.json`: `:2062` seen modules, and `:1487` (`keptWordRows`' `import()` of the member's word table) has the same seven. The run data hold a file's imports for the file, not the line, so the two lines are not told apart.
- **The member is the caller's.** [READ] `pdf-worker/scripts/build.mjs:29-33` finds its own member by name with `discoverMembers()` and calls `writeMember(member)`; agent-runner, agent-worker, file-scanner, ocr-worker and sheet-worker import `discoverMembers` and a build function in their `scripts/build.mjs` [READ the import lines only]. `bio-plane/src/case-checker/build-program.mjs:14-15` hands its own descriptor. Tests of release (`test/m/bundler/r46.test.mjs:46`, `release.test.mjs:721`) hand every discovered member. The run data do not say which caller handed which member. Discovery (`:467`, `:470`) reads every top folder by itself.
- **Who runs it.** Each member's `npm run build`; `bio-plane/scripts/bundles.mjs` (release), which `deploy-test.yml:105` and `release-sign.yml` run; `build-plane.mjs` (plane, through `bio-plane/package.json:8`); `case-checker/build-program.mjs` by hand (its header, a lead); tests of bundler (fixture members), release (`test/m/bundler/`, `test/system/`), plane (`t47`, `t48`), case-checker, the members and installer.
- **What it writes and who reads it.** Each member's `dist/<name>.bundled.mjs` and manifest, in the member's own folder. For a container member it records the digest into the member's `fleet-member.json` and `wrangler.jsonc` (`:968`, `:969`). Readers: `deploy-fleet.mjs`, `release-assemble.mjs`, `deploy.mjs` (release), the fleet gate `test/system/fleetbundles.test.mjs` (release), and the members' own tests.
- **The move.** It changes none of the 24 places' modules. The plane's descriptor makes bundler read the UI's and `top`'s files (see (a)), which the runs did not record.

**Options for (c):**
1. `fleet-bundle.mjs` moves to a module at or after the latest it reaches (`stewards` by discovery, `top` by the plane). Every member's `scripts/build.mjs` (modules 34 to 110) and `case-checker/build-program.mjs` import it, so they would import a later module. Not possible without moving them too.
2. Not a reach, because the path is given by the caller. Fact: 22 of the 24 places use a path built from what the caller hands in. A member's own build hands its own folder; release's tests and scripts hand every member, and they are later than every member. Whether a library's read of a path its caller hands counts is not settled by the evidence rules' wording ("a file or folder read at run time").
3. Discovery stops listing every folder. Each member's build reads its own marker (`<own dir>/fleet-member.json`) and hands it in, and the full list (for `bundles.mjs`, `deploy-fleet.mjs`, `release-assemble.mjs`, `resolve-version.mjs`, `dev-copy.mjs`, `release-advisories.mjs`, and `deploy-test.yml:109`) is made in `release` or later. Files: `fleet-bundle.mjs`'s `discoverMembers` and its six member callers; bundler R1 ("a list maintained by hand…", comment at `:407-409`) would need rewording [NOT CHECKED: R1's text]. Discovery is a census meant to cover every top folder.
4. `planeMember` leaves bundler: as (a) option 3.

## Options by group (the other places)

"Today": upward before and after the move.

- **design-words-builder** (documents → setup-words, journey-check; today). (i) documents claims `words.json` (two JSON entries change; no code, same path). (ii) documents claims the `mock-*.js` files. (iii) `build_words.mjs` moves to journey-check.
- **test-runner** (test-support 9, pdf-worker 34, agent-worker 110; today). These are census patterns meant to run every module's tests.
  - (i) The runner (`module-tests.mjs`, the `test` scripts) moves to the last module.
  - (ii) The process's own run replaces them (`module-tests.yml:133` runs `p4.mjs run tests`); `regression.yml`, the scripts and, if `build`/`dev` went, `process.json` change.
  - (iii) `agent-worker/package.json:8`, `pdf-worker/package.json:8` reach other modules' tests in the package's folder; step 3 gives agent-worker's plane-held files to agent-worker (22a), which ends the first if they stay in `agent-worker/test/` (INFERENCE). `bio-plane/package.json:8`, `:9` end only if `package.json` (the manifest of all bio-plane's dependencies) moves to release or later, or the scripts go.
- **declared-ops-collector** (test-support; today). Step 8 of the plan already ends it ("stops reading later modules' files"). Facts: with `upTo` it is bounded by `order.txt`, so it follows whatever order the list states. Without `upTo` it reads every module of `build/modules.json`. [NOT CHECKED] which of the 35 call sites pass `upTo`.
- **service-binding** (agent-worker → plane; today). A Worker name, not a repository path; the installer templates it per instance (`agent-worker/wrangler.jsonc:86-90`, comment). agent-worker (110) cannot move after plane.
- **installer-words** and **words-reads-table** (34 test places in 27 modules, and installer's build; today). (i) `words-reads.json` is claimed by documents (it sits in documents' folder; journey-check claims it by name). Its generator `words-reads.src.mjs` (journey-check) then writes an earlier module's file. Only the two JSON entries change; no test changes. (ii) Each module keeps its own `reads` list in its own folder; each test changes its path, and the generator writes 27 files.
- **census** (20 places; money, agent-worker, member-roster, stewards and pdf-worker today; plane's g83, R8 and lines made upward). Each is meant to cover every module, or every file of `src/`.
  - (i) It moves to a module at or after the latest it reaches: the last module, or a proof module after `top` (design section 7).
  - (ii) It reads only modules up to its owner (as `declared-ops`' `boundedModules`); each later module then runs the same check on its own files, through a test-support helper.
  - (iii) `sa-assembly.test.mjs:252` (R99 at plane, design section 3 "plane's imports of store-assembly"): it reads every file in `src/plane/`, `top`'s entry among them. Either plane's check skips `index.mjs` and `top` checks its own file, or the check moves to `top`.
  - `lines/invariants.test.mjs` goes to lines per 22c (class c).
- **boots-entry** (121 places, 61 files; all made upward). Steps 3 and 6 end most (next section): rebuilt at owners over `real-door.mjs` or a test-only Durable Object (design section 3), dropped, or given to `top` (the 14 screen-asserting door tests are in 5 files, 4 of them here: `t46-e2e`, `t47-e2e`, `t51-bootstrap`, part of `t51-round7-seam`).
  - What stays with plane: `T/plane/t42.test.mjs` and `worker.test.mjs:13,20` (plane's own), and the helpers `r8-kit.mjs`, `r9-seam-documents.mjs`, `r9-seam-reading.mjs`, `wrap-entry.mjs`, `realplane.mjs`, `roster-reader/test/fixtures/capture.mjs`. Control-plane's `rows-plane.mjs` stays with control-plane.
  - Options for those: they move to `top` with their users, or they are rebuilt not to start the entry.
  - Because these reach the entry by path, `p4 check` at a moved test's owner does not judge this reach. The list for each owner can come from `places.json` (group `boots-entry`).
- **computed-import** (9 places; control-plane's five interface-shell tests, plane's `t47`, `t50`, `worker.test.mjs:15`; made upward). (i) Step 5's "9 page test files take the UI from a test helper" may cover the five [NOT CHECKED which nine files step 5 means]. (ii) The tests that check the UI's screens move to the UI module or to `top`. (iii) Written as literal imports, they become visible to `p4 check`; the reach stays.
- **plane-world-copy** (4; made upward by reading). It is a copy of every module, `top` included, which ARCH's condition forbids for a moved test. Its users are agent-worker's plane-held tests (22a, contract checks) and capture-requests' tests [NOT CHECKED which]. Options: it moves to `top` with its users, or the users are rebuilt.
- **child-fixture** (`sa-parity.test.mjs:15`, store-assembly → plane; today). A child imports plane's fixture by a path, on purpose (`:14`: "a path, never an import of a later module (P4)"). (i) The parity check moves to plane. (ii) Plane publishes its route keys.
- **worker-program-text** (`page-contention.probe.mjs`, plane's file in interface-shell's folder; made upward). It is a probe no code file names (above). It moves to interface-shell or `top` (its `tests` entry changes), or it goes.
- **test-cache** (`c25-seam.test.mjs:20-31`; made upward). The target is the test's own download, in screens-daily's folder. Step 3 moves `c25-seam` to screens-daily (22c class a), and then it is its own folder.
- **fixture-maker** (image-codecs → pdf-pixels; today). [READ] `make-dct-fixtures.py:118` `open(…, "wb").write(pdf)`: the maker writes the PDF the graph counts as read, its own output in pdf-pixels' folder. (i) image-codecs claims the PDFs. (ii) pdf-pixels claims the makers.
- **single-file-check** (run-rules → agent-harness; wizard-library → wizard-scripts; today). Each checks one named file or folder of a later module. It moves to the later module's tests, or it checks only what its own module states.

## What steps 3 and 6 already end

[READ] design section 5, joined with `classify/22a-22c.json` (the `classified` field of each place):

- Ended by step 3, if each file is rebuilt as 22a to 22c give it: boots-entry files of 22b (16; `t51-hops` is d and c), 22c a and b (17), 22c c (4, reconstructed), 22c d (10, dropped), 22a (5: agent-worker's four as contract checks, `pdf-worker-binding` as b at reading-pipeline); `c25-seam`'s test-cache; `lines/invariants` (to lines).
  - The design's condition is "`p4 check` at the owner's job is the judge". INFERENCE: `check` does not see a Worker started by path, so a rebuilt test that still started the entry would pass `check`. These places show where to look.
- Ended by step 6: the 4 screen-asserting door files above move to `top`, where the entry is their own module's.
- Ended by step 8 (not 3 or 6): `declared-ops.mjs` (test-support).
- **Not ended by the plan as written:** (a) `wrangler.jsonc:11`, `fleet-bundle.mjs:522`, plane's `dist/`; (b); (c); the code test-runners; the census tests, plane's `g83-census`, `worker.test.mjs` (`:13-20`, `:15`, R8) and `t42.test.mjs` among them; `sa-assembly.test.mjs:252` (R99 stays at plane); the boots-entry helpers; the computed-import tests; `page-contention.probe.mjs`; `plane-world.mjs` (unless all its users leave); the words-reads, fixture-maker, single-file-check and child-fixture groups (upward today).

## What I did not check

- **Plane's and `top`'s files in the run data.** The runs name modules, not files. I read the code of each run-known place that reaches plane, and of plane's own walkers in `topByReading`; other run-known places in plane's tests may touch `top` by a route I did not read. Traced runs with file lists would settle it.
- **`src/plane/ui.mjs`** does not exist yet. What it will reach is not known.
- **Steps 2, 4 and 5 change files** (`door.mjs` into control-plane, the splits, `launch.mjs`). The graph is of today's files: places in files those steps change are as they stand now.
- **What `p4 check` sees.** I took "imports only" from the brief. I did not run it on the new order, and did not confirm that it ignores template `import()` and Miniflare `scriptPath`. Running `p4.mjs check control-plane` and `check plane` on a scratch copy with the new `order.txt` would settle it.
- Which of `declared-ops`' 35 call sites pass `upTo`; which files step 5's "9 page test files" are; which tests use `capture-requests/plane-world.mjs`; bundler R1's exact text.
- The computed references the graph leaves open (341 in `09-graph.md`, 218 of them under rules tagged NOT CHECKED: Python fixture makers, probes, wrangler `rules`, journey-check's own files) are not in this list unless a run saw them. `09-graph.md` "What I did not check" applies here unchanged: references through a registered value that is called, and the 25 files no parser reads (shell, YAML, Dockerfile and others), are not in the graph. The workflows' `run:` lines named in (a) and (c) I read by hand.
- Whether any plane-owned test loads the committed `dist/bio-plane.bundled.mjs`.
- I ran no test.
