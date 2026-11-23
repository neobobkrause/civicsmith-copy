Length: 383 lines. Last section: "What I did not check".

# 14. How the plane is built, bundled, served, started, deployed and tested today

Research worker 14, plane-scope lane, 23 Nov 2026. Base: the code at `origin/p4-tranche` `a26a8da2`. [MEASURED] the main checkout's code is the same: `git diff --stat origin/p4-tranche HEAD` listed research files only. Everything built or run was in a scratch worktree of that commit (`node_modules` symlinked from the main checkout), removed at the end. Machine: 4 vCPU `Intel(R) Xeon(R) Processor @ 2.10GHz` under KVM, 15 GB, Node v26.10.0 (V8 14.6.202.34), esbuild 0.25.12. Nothing was deployed, no credential was used, Cloudflare was not contacted.

Short names: `bp/` is `bio-plane/`; `fb` is `bio-plane/scripts/fleet-bundle.mjs`. "UI modules" below means the 19 modules at positions 176 to 194 of `process/modules/order.txt` (interface-assets, interface-shell, 17 `screens-*`), chosen by position only. Which layer each module belongs to is the lane's finding, not this file's.

Data file: `process/lanes/plane-scope/research/build/bundle-by-module.json` (bytes by file and by module).

## Commands behind the measurements

Scratch scripts were kept outside the repository; each is described so it can be rewritten.

- C1: `node scripts/build-plane.mjs` in the scratch `bio-plane/`, three times, wall time by `date +%s.%N`.
- C2: a script that imports the scratch `fb`, calls `buildMember(planeMember())` (nothing written), and saves esbuild's metafile; a second esbuild call with `optionsFor(plane)` gives the size before the ASCII pass.
- C3: a script that gives each metafile input its owner module (longest matching path over `files` and `tests` of `process/modules/*.json`) and sums `outputs[...].inputs[path].bytesInOutput`.
- C4: a script that imports the built artifact in Node with `cloudflare:workers` stubbed as `fb`'s `measureStart` stubs it, and calls its default export's `fetch` for `/app`, `/`, `/app/shell-0.87.0.js` and the assets the page names, with `env = { VERSION: "0.87.0" }`.
- C5: the served script parsed with the product's vendored acorn (`bp/src/setup-words/vendor/acorn.mjs`), sizes of its parts taken from node ranges.
- C6: `fb`'s `measureStart(planeMember(), { artifact })`, one fresh import per Node process.
- C7: variant bundles built in memory with `fb`'s own `optionsFor` and `asciiOutput`, plus an esbuild `onLoad` plugin that answers named UI files with stub modules. No file of the worktree was edited. The harness with no stub gave the same sha256 as C1.
- C8: V8 precise coverage (`node:inspector`, `Profiler.startPreciseCoverage {callCount, detailed}`) over the source entry `bp/src/plane/index.mjs` imported in Node.
- C9: a scan of the 853 bundle inputs for `env.<NAME>` (comments stripped by a rough pattern) and, for the ten binding names, any `.NAME` or `["NAME"]`.
- C10: the metafile's import edges, each end given its owner module.
- C11: GitHub MCP `actions_list list_workflow_runs` for `module-tests.yml`, six pages of 100 (all 561 runs), parsed from the saved results; `list_workflow_jobs` for 13 runs.
- C12: `git grep -n -I -E "(^|[^-A-Za-z0-9])plane/index\.mjs"` over the repository, bundles and `process/lanes/` excluded.

## Headline answers

1. [MEASURED] The plane's bundle is one ES module of 28,418,158 bytes (27.1 MiB), built by esbuild from one entry in 2.5 s (C1). The committed `bp/dist/bio-plane.bundled.mjs` is not that build: it is 28,267,780 bytes from 852 inputs, and 182 inputs have changed since and one was added.
2. [MEASURED] UI modules are 3,270,897 bytes of the bundle, 11.5 % (C3). The four largest contributors are below the UI: case-checker 23.7 %, setup-words 17.5 %, court-citations 6.2 %; interface-assets is fourth at 4.1 %.
3. [MEASURED] The screens' code is both in the Worker and sent to the browser. The Worker holds each screen as live objects and functions, and composes the browser's script from their source text at the first page request; the script served is 4,423,473 bytes. In a start plus page, script and stylesheet requests, 0.7 % of the characters inside UI modules' functions were executed in the Worker (C8). [READ] one Worker path does call screen code: `deliverOwedRender` calls `CAPTURE_SCREEN.parts.titleOf` and `.promoteDocument` (`bp/src/control-plane/index.mjs:796-797`).
4. [MEASURED] The start-up measure (bundler R31, plane R43/R54) reads 585 ms median on this machine (40 processes), over the 500 ms budget, which only warns. A variant bundle with every UI module stubbed out reads 507 ms; the paired difference is 76 ms (95 % interval ±14 ms), 13 % of the figure.
5. [MEASURED] In the bundle's import graph no module below position 176 imports a UI module; control-plane is the only importer of UI modules (13 import statements); plane imports none (C10).
6. [MEASURED] No UI module's code names any binding or `env.<NAME>` (C9).
7. [READ] Three generated sources read a past commit of the design folders or vendored copies of it; `setup-words/rows.mjs` (position 2) is generated from the design's `words.json` and from `localize()` calls in every product module's code.
8. [MEASURED] 66 of 204 modules have a module-tests run on a `job/<module>.<n>` branch; all 561 runs happened between 22 Nov 18:33 and 23 Nov 18:40 UTC. Whole-run times are mostly 2 to 4 minutes and include a 65 to 143 s full-history checkout; the test step itself, read for 13 runs, ran 9 s to 462 s outside `plane`.

## 1. The build as it exists

**The plane's build, step by step.**

1. [READ] `bp/package.json:8` `"build": "node scripts/build-plane.mjs",`.
2. [READ] `bp/scripts/build-plane.mjs:19-20` `const plane = planeMember();` / `const { built, manifest } = await writeMember(plane);`. These are its only calls besides two `console.log`. It runs no generator: the file's lines 17 to 24 are one import, those two calls and the logs.
3. [READ] The descriptor: `fb:522` `const PLANE_ENTRY = "src/plane/index.mjs";` and `fb:527-541` `planeMember` returns `wholeWordTable: true`, `entry: PLANE_ENTRY`, `bundle: { entry: PLANE_ENTRY, outfile: "dist/bio-plane.bundled.mjs", manifest: "dist/bio-plane.bundle.json", external: [...DEFAULT_EXTERNAL] }`. `fb:392` `export const DEFAULT_EXTERNAL = Object.freeze(["cloudflare:workers", "node:*"]);`.
4. [READ] The tool is esbuild: `fb:96` `import { build, version as ESBUILD_VERSION } from "esbuild";`. The options are one function, `fb:1266-1280` `optionsFor`: `absWorkingDir: member.abs`, `preserveSymlinks: true`, `entryPoints: [b.entry]`, `outfile: b.outfile`, `bundle: true`, `format: RECIPE.format`, `platform: RECIPE.platform`, `external: [...]`, `metafile: true`, `...(asciiOf(member) ? asciiOptions() : {})`. `fb:388` `RECIPE = Object.freeze({ format: "esm", platform: "neutral" })`. `fb:1203-1204` `asciiOptions` adds `charset: "ascii"`, `legalComments: "eof"`, `minifyWhitespace: true`, `supported: { "template-literal": false }`. There is no `loader`, no `define`, no `minifyIdentifiers` and no `minifySyntax` key.
5. [READ] `fb:1514-1553` `buildMember`: `const res = await build(opts);` then `if (asciiOf(member)) bytes = asciiOutput(bytes);` (`fb:1541-1543`), then the write (`fb:1544-1547`). For the plane no plugin runs: `fb:1454` `const trimsWords = (member) => !!member.marker && !member.wholeWordTable;` is false for it, so `opts.plugins` is `[]` (`fb:1524`).
6. [READ] `asciiOutput` (`fb:1231-1259`) rewrites characters above U+007F inside string, regex and comment tokens as `\uXXXX`, and throws `REFUSED [NON_ASCII_REMAINS]` for one anywhere else. [MEASURED] it added 445 bytes to this build (C2: esbuild 28,417,713, final 28,418,158).
7. [READ] `fb:1633-1638` `writeMember` writes the artifact (through `buildMember(member, { write: true })`) and `JSON.stringify(manifest, null, 2)` to `bundle.manifest`.

**What is inlined.** [MEASURED] All 852 inputs that reach the output are `.mjs` modules (C3: extension count `{'mjs': 852}`); 788 are under `bio-plane/`, the other 64 under twelve sibling folders (`doctypes` 12, `pdf-worker` 9, `site-profiles` 9, `roster-reader` 6, `budget-doctypes` 6, `docprofile` 6, `court-doctypes` 5, `file-scanner` 4, `jurisdictions` 3, `court-citations` 2, `legistar-reader` 1, `sheet-worker` 1). So nothing is embedded by a loader: the page's stylesheets, icons and 15 fonts are string literals of one module (`bp/src/interface-assets/index.mjs`, 1,159,280 bytes on disk); the word table is `bp/src/setup-words/rows.mjs` (5,056,965 bytes on disk); the standalone case checker is a JSON string returned by a function in `bp/src/case-checker/program.mjs` (6,820,145 bytes on disk). The screens are ordinary modules, bundled as code. [MEASURED] vendored (`node_modules`) inputs: 0 (C1 prints `853 first-party input(s), 0 vendored`).

**What the manifest holds.** [READ] `fb:1560-1626` `manifestFrom`: `member`, `artifact`, `sha256`, `bytes`, `recipe` (`entry`, `format`, `platform`, `external`, `absWorkingDir: "<member directory>"`, `esbuild`, `ascii`), `inputs` and `vendoredInputs` (each `{path, bytes, sha256}`, member-relative), `assets` only for a member that declares upload parts, `words` only for a fleet member whose inputs reach the word table, and `lock` (`package-lock.json`'s sha256). [MEASURED] the plane's fresh manifest: 853 inputs, 0 vendored, 139,577 bytes.

**The fleet's bundles.** [MEASURED] `ls */fleet-member.json` lists six: agent-runner, agent-worker, file-scanner, ocr-worker, pdf-worker, sheet-worker. [READ] `fb:465-497` `discoverMembers` makes a member of every top-level folder holding that marker; each member's `scripts/build.mjs` is the same thin caller (`agent-worker/scripts/build.mjs`: `const { built, manifest } = await writeMember(member);`). [READ] a member's bundle carries only the word rows its inputs read: `fb:1519-1522` builds a probe with the table stubbed, then `keptWordRows`. [READ] ocr-worker and sheet-worker declare upload parts (`bundle.assets` in their markers: a wasm core, a language model, a wasm engine) that esbuild never sees. [READ] `bp/scripts/bundles.mjs:26` builds "guarded members plus the plane", each by `spawnSync("npm", ["run", "build"], { cwd: member.abs, ... })` (`:39`), then `verifyStatic` and `verifyFresh` (`:53-54`). [MEASURED] tracked build outputs: `git ls-files '*/dist/*'` lists the plane's bundle and manifest and, for seven other folders, only a `.gitignore`; `release/` holds the released copies (`release/bio-plane.bundled.mjs`, 28,202,235 bytes, version 0.87.0 in `release/RELEASE.json`).

**How a deploy binds members.**

- [READ] The plane, release path (`bp/scripts/deploy.mjs`): positional arguments `<slug> <version> <asset>` (`:62`); `const source = readFileSync(assetPath, "utf8");` (`:243`); the upload is one part named `index.mjs`: `main_module: "index.mjs",` (`:277`) and `fd.append("index.mjs", new Blob([source], ...), "index.mjs");` (`:546`). Bindings are derived from `bp/wrangler.jsonc` (`:267-268`, `:282`): `bp/scripts/derive-bindings.mjs:113` and `:116` add `VERSION` and `INSTANCE_NAME`; `:124` each R2 bucket; `:128` each service, `service: s.service === "bio-plane" ? slug : s.service`; `:136` the browser binding. `keep_bindings: ["secret_text", "durable_object_namespace", "service"]` (`deploy.mjs:286`) keeps the Durable Object namespace from the earlier upload. Limits ride the metadata (`:290`); the cron list is PUT to `/schedules` after the upload (`:341`).
- [READ] A member (`bp/scripts/deploy-fleet.mjs`): `wrangler deploy -c` over a generated copy of the member's own `wrangler.jsonc` (`:321`, `:330`), whose `main` is its dist bundle (for example `agent-worker/wrangler.jsonc:58` `"main": "dist/agent-worker.bundled.mjs",`).
- [READ] The development copy (`bp/scripts/dev-copy.mjs`): builds with `bundles.mjs` (`:370`); deploys each member first without service bindings (`:429`); deploys the plane by wrangler with a generated config whose entry is replaced, `main: "dist/bio-plane.bundled.mjs"` (`:432-433`); sends four secrets (`:434-435`, `INSTANCE_VALUES` at `:78`); deploys each member again whole (`:437`). `generatedConfig` (`:108-135`) renames each service and Durable Object target to the copy's names.
- [READ] `deploy-test.yml:105` `run: node bio-plane/scripts/bundles.mjs`, then `deploy-fleet.mjs` for each member (`:111`), then `node scripts/deploy.mjs "$COPY" "$version" dist/bio-plane.bundled.mjs --test-instance $DRY $STORE` (`:119`).
- [READ] `wrangler dev` (`bp/package.json:10`) starts from `bp/wrangler.jsonc:11` `"main": "src/plane/index.mjs",`, that is from source, not from the bundle.

## 2. The build, measured

| what | figure | tag |
|---|---|---|
| wall time of `node scripts/build-plane.mjs` | 4.20 s first run, then 2.50 s and 2.58 s | [MEASURED] C1 |
| in-process `buildMember` alone | 2.27 s | [MEASURED] C2 |
| bundle | 28,418,158 bytes (27.1 MiB), sha256 `da5f1a92...54fc`, same in all three runs | [MEASURED] C1 |
| inputs | 853 read, 852 with bytes in the output (`../roster-reader/directory-refs.mjs` has none) | [MEASURED] C2, C3 |
| bytes attributed to files | 28,417,402; not attributed 756 (311 of esbuild's own, 445 of the ASCII pass) | [MEASURED] C3 |
| size budget | warn past 32 MiB, fail past 48 MiB (`fb:1955`) | [READ] |

**The committed bundle is older than the sources.** [MEASURED] In the scratch worktree before any build, `sha256sum bio-plane/dist/bio-plane.bundled.mjs` gave `da2bfbdc...`, 28,267,780 bytes, manifest of 852 inputs. After C1 the manifest differs in 182 inputs by sha256 and adds `src/screens-action/words-fix-flaws.mjs`. [MEASURED] `verifyStatic(planeMember())` on the main checkout returns 183 findings, the first `STALE BUNDLE — the source ../budget-doctypes/index.mjs has changed since dist/bio-plane.bundled.mjs was built`. So every byte figure below is of a fresh build, not of the committed file.

**Bytes by group** (C3; percentages of esbuild's 28,417,713 bytes; `bytesInOutput` is after tree-shaking and whitespace removal, comments gone). [MEASURED] all rows.

| group | modules | files | bytes in bundle | share |
|---|---|---|---|---|
| interface-assets (176) | 1 | 1 | 1,157,181 | 4.07 % |
| interface-shell (177) | 1 | 2 | 151,339 | 0.53 % |
| all `screens-*` (178 to 194) | 17 | 127 | 1,962,377 | 6.91 % |
| **UI modules together (176 to 194)** | 19 | 130 | **3,270,897** | **11.51 %** |
| control-plane (195) | 1 | 9 | 97,094 | 0.34 % |
| plane (196) | 1 | 5 | 11,076 | 0.04 % |
| `store-*` (171, 173, 174, 175) | 4 | 21 | 159,022 | 0.56 % |
| the rest | 160 | 687 | 24,879,313 | 87.55 % |

Each screens module: screens-entry 59,262; screens-wizards 42,454; screens-account 68,253; screens-settings 193,520; screens-capture 75,997; screens-intake 107,978; screens-find 103,420; screens-daily 123,739; screens-document 138,559; screens-question 141,428; screens-inquiry 170,787; screens-people 92,189; screens-investigate 142,294; screens-public 70,022; screens-publish 160,527; screens-send 93,602; screens-action 178,346. Store modules: store-door 22,916; store-services 82,313; store-assembly 29,944; store-request 23,849. Files under `bp/src/store-assembly/` belong to two modules by the ownership rule (ten of its sixteen files are listed by store-services).

[MEASURED] 185 of 204 modules have a file in the bundle. The 19 with none: documents (1), test-support (9), bundler (12), pdf-worker (34), ocr-worker (35), agent-harness (105), agent-model (106), agent-runner (107), agent-steps (108), agent-worker-routes (109), agent-worker (110), release (197), installer-account (198), installer-steps (199), installer-pages (200), installer (201), site (202), stewards (203), journey-check (204).

**Top 25 modules by bytes** (C3). [MEASURED]

| # | pos | module | files | bytes | share |
|---|---|---|---|---|---|
| 1 | 126 | case-checker | 9 | 6,748,836 | 23.75 % |
| 2 | 2 | setup-words | 2 | 4,977,858 | 17.52 % |
| 3 | 13 | court-citations | 2 | 1,767,014 | 6.22 % |
| 4 | 176 | interface-assets | 1 | 1,157,181 | 4.07 % |
| 5 | 82 | calculations | 6 | 211,845 | 0.75 % |
| 6 | 56 | capture | 6 | 208,598 | 0.73 % |
| 7 | 62 | extraction | 9 | 198,345 | 0.70 % |
| 8 | 181 | screens-settings | 14 | 193,520 | 0.68 % |
| 9 | 194 | screens-action | 13 | 178,346 | 0.63 % |
| 10 | 188 | screens-inquiry | 6 | 170,787 | 0.60 % |
| 11 | 55 | acquisition | 6 | 167,668 | 0.59 % |
| 12 | 61 | reading-pipeline | 4 | 162,898 | 0.57 % |
| 13 | 145 | filings | 4 | 160,656 | 0.57 % |
| 14 | 192 | screens-publish | 8 | 160,527 | 0.56 % |
| 15 | 149 | monitoring | 4 | 157,079 | 0.55 % |
| 16 | 63 | content | 7 | 154,705 | 0.54 % |
| 17 | 166 | instance-setup | 3 | 154,355 | 0.54 % |
| 18 | 177 | interface-shell | 2 | 151,339 | 0.53 % |
| 19 | 71 | standards | 5 | 147,538 | 0.52 % |
| 20 | 190 | screens-investigate | 10 | 142,294 | 0.50 % |
| 21 | 139 | actions | 2 | 142,133 | 0.50 % |
| 22 | 58 | file-safety | 8 | 142,132 | 0.50 % |
| 23 | 187 | screens-question | 2 | 141,428 | 0.50 % |
| 24 | 68 | connections | 8 | 140,600 | 0.49 % |
| 25 | 113 | reevaluation | 3 | 140,110 | 0.49 % |

The top 25 are 63.6 % of the bundle; the top three files alone are `case-checker/program.mjs` 6,627,721, `setup-words/rows.mjs` 4,976,657 and `interface-assets/index.mjs` 1,157,181. [READ] `program.mjs` is itself an esbuild bundle of the standalone checker held as text, built with the whole word table (`bp/src/case-checker/build-program.mjs:31-33`: `buildMember(member, { write: false })` over `entry: "src/case-checker/main.mjs"`; its first bundled input is `// src/setup-words/rows.mjs`, `program.mjs:3`), so the word table is in the plane's bundle twice.

## 3. How UI code reaches the member's browser

**The route.** [READ] `bp/src/control-plane/app.mjs:28-35` `appRouteOf` names three routes for a GET or HEAD: `"asset"` for a path under `/app/assets/`, `"script"` for `/app/shell-<version>.js`, `"page"` for `/app` and below. `bp/src/control-plane/index.mjs:991-992`: `if (appRoute === "script") return appScript(req, url, { source: interfaceScript(APP_SCREENS, appOptions(env)), version: env.VERSION });` / `return appRoute === "page" ? page(req, env, seen) : appAsset(req, url, { assets: ASSET_FILES, version: env.VERSION });`. `GET /` with no `op` answers the same page (`:971-977`).

**Where the screens come from.** [READ] `control-plane/index.mjs:52-65` imports `interfacePage, interfaceScript, interfaceScriptHash, pageWork` from interface-shell, `ASSET_FILES` from interface-assets, `SCREENS` from nine screen modules and `GUIDE` from screens-wizards, and builds `const APP_SCREENS = Object.freeze([...ENTRY_SCREENS, ...SETTINGS_SCREENS, ...])`.

**How the script is made.** [READ] `bp/src/interface-shell/index.mjs:528` `const program = shellProgram.toString();` and `:532` ``const source = `(${program})(${toSource(D)}, ${toSource(screens)}, window, ${toSource(guide)}).start();`;``. `toSource` (`:296-307`) writes `v.toString()` for a function and JSON for everything else. So the browser's script is the source text of functions the Worker holds, plus data. It is made once per isolate: `:523` `if (SCRIPT && SCRIPT.screens === screens && SCRIPT.guide === guide) return SCRIPT;`. The page (`:583-607`) is a short document that links two stylesheets and one external script by hash.

**What is served** (C4, from the built artifact in Node). [MEASURED]

| request | status | type | cache-control | bytes |
|---|---|---|---|---|
| `/app` and `/` | 200 | text/html | no-store | 3,522 |
| `/app/shell-0.87.0.js` | 200 | text/javascript | public, max-age=31536000, immutable | 4,423,473 |
| `/app/assets/civicsmith.css` | 200 | text/css | no-cache | 47,326 |
| `/app/assets/shell.css` | 200 | text/css | no-cache | 35,668 |

[MEASURED] `ASSET_FILES` holds 21 files, 891,879 bytes as served: 15 fonts 787,272 (held as 1,049,712 base64 characters), 2 stylesheets 82,994, 1 icon sheet 8,671, 3 licence texts 12,942 (a script importing `bp/src/interface-assets/index.mjs`).

[MEASURED] The script's parts (C5): the program 129,529 bytes, which is exactly the bundle bytes of `interface-shell/browser.mjs`; the data `D` 1,474,252, of which `D.words` 1,414,444; the 78 screens 2,781,390, of which 2,350,696 lie inside function texts and 342,369 in the screens' own `words`; the guide 38,277. The screens' part is larger than all `screens-*` code in the bundle (1,962,377). INFERENCE from (a) that figure and (b) `toSource` writing a function's text at every place it is referenced: a helper shared by several screens is sent several times. A count of repeated function texts in the script would settle it.

[MEASURED] The first `/app` request did the composing: the door's own log line read `{"event":"control-plane.page","scripts":1,"hashes":1,"checks":1,"ms":1027}` and the second request's `"ms":1` (C4, in Node, not workerd).

**Executed in the Worker, or only carried?** Both, in very different amounts.

- [MEASURED] `shellProgram` is named in two source files of the whole repository, `interface-shell/browser.mjs` (its definition) and `interface-shell/index.mjs` (the import and `.toString()`): `grep -rl "shellProgram" --include=*.mjs --include=*.js .` outside `node_modules` lists those two and the two built bundles.
- [MEASURED] C8, source entry imported in Node, then `/app`, the script and one stylesheet requested. Characters inside functions, and how many lay in ranges V8 reported executed:

| group | files | chars inside functions | executed after import | executed after the requests too |
|---|---|---|---|---|
| interface-shell | 2 | 229,302 | 87 | 13,283 (5.8 %) |
| `interface-shell/browser.mjs` alone | 1 | 213,520 | 0 | 0 |
| `screens-*` | 127 | 2,210,979 | 11,514 | 11,514 (0.5 %) |
| UI modules together | 130 | 3,490,211 | 11,670 | 24,866 (0.7 %) |
| control-plane | 9 | 170,769 | 584 | 19,200 (11.2 %) |
| plane | 5 | 16,139 | 0 | 607 (3.8 %) |
| every module below 176 | 709 | 20,379,023 | 826,770 | 829,853 (4.1 %) |

  These are source characters (comments inside functions count on both sides), not bundle bytes, and the scenario is only start-up plus three GETs.
- [READ] Screen code the Worker does call: `control-plane/index.mjs:39` `import { CAPTURE_SCREEN } from "../screens-intake/capture.mjs";` and `:796-797` `title = CAPTURE_SCREEN.parts.titleOf(cs, {...})`, `const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, {...});`, inside `deliverOwedRender` (`:743`), which `bp/src/plane/store.mjs:41` hands to the store (`assembleStore(ctx, env, { deliver: deliverOwedRender })`). C8 did not exercise it.
- [NOT CHECKED] A byte split of the bundle into "browser-only" and "Worker-executed". What blocks it: the minified bundle carries no file markers, so V8 ranges on the artifact cannot be given to modules without a source map, and "never executed in the Worker" cannot be shown by a scenario. A source-map build with the same options, and coverage over the product's own test suite, would settle it.

## 4. Start-up cost

**The measure.** [READ] `fb:2015` `measureStart`: reads the artifact, stubs each `cloudflare:*` import with empty classes (`fb:2022-2026`), and times a fresh import: `const t0 = performance.now();` / `await import(url);` / `return { measured: true, ms: performance.now() - t0 };` (`fb:2065-2067`). The budget is `fb:1955` `BUDGET = Object.freeze({ sizeWarn: 32 * MIB, sizeFail: 48 * MIB, startWarnMs: 500 })`, and past it is a warning, not a failure (`fb:1983-1989`). The gate prints it for every member (`bp/test/system/fleetbundles.test.mjs:135` `const r = await budgetReport(m);`); the plane's own tests build the artifact and take five fresh imports (`bp/test/m/plane/t47.test.mjs:52-72`, `t48.test.mjs:75-95`). It is Node's time, not workerd's.

**Figures on this machine.** [MEASURED]

- The plane's own R54 test, run in the scratch worktree (`node --import ./test/platform-sqlite.mjs --test --test-name-pattern "^R54" test/m/plane/t48.test.mjs`), printed `R54: the plane's global scope, five fresh imports: 630, 596, 660, 639, 580 ms; median 630 ms, budget 500 ms: warn` and passed.
- C6, one process, five fresh imports: 733, 697, 594, 669, 604 ms. Ten separate processes: 593 to 702 ms.
- C6, 40 separate processes: min 517, quartiles 565 / 585 / 597, max 841, mean 597 ms.

**The UI modules' share** (C7). What was changed, exactly: at build time only, `src/interface-shell/index.mjs` answered with a module exporting `interfacePage`, `interfaceScript`, `interfaceScriptHash`, `pageWork`, `versionOfScriptPath` as empty functions; `src/interface-assets/index.mjs` with `ASSET_FILES = {}`; each `src/screens-*/index.mjs` with `SCREENS = []` and `GUIDE = null`; `src/screens-intake/capture.mjs` with `CAPTURE_SCREEN = { parts: {} }`. These are the twelve UI files control-plane imports; nothing else was touched. [MEASURED]

| variant | bundle bytes | inputs | start-up, 40 processes interleaved: min / median / mean | paired difference from base |
|---|---|---|---|---|
| base (no stub) | 28,418,158 | 853 | 517 / 585 / 597 ms | |
| no UI modules | 25,141,211 (−3,276,947, 11.5 %) | 735 | 448 / 507 / 521 ms | 76 ms mean, ±14 ms (95 %), 12.7 % of base mean |
| no screens, no shell, assets kept | 26,298,364 | 735 | 468 / 512 / 536 ms | 61 ms mean, ±22 ms (95 %) |

The spread between runs (standard deviation 58 to 79 ms) is as large as the effect, so the two stubbed variants cannot be told apart, and the assets' own share is not measured. [MEASURED] a variant with only interface-assets stubbed cannot be built cleanly: its import threw `interface-shell: interface-assets holds no civicsmith.css`, because interface-shell reads `ASSET_FILES` in its global scope (`interface-shell/index.mjs:52`).

[NOT CHECKED] The same figures in workerd, and the `startup_time_ms` Cloudflare reports at upload (`deploy.mjs:236-241` prints it). A `wrangler deploy --dry-run` does not report it; a deploy to the development copy would.

## 5. Generated sources

| file (owner, position) | written by | reads | a past commit? |
|---|---|---|---|
| `bp/src/interface-assets/index.mjs` (interface-assets, 176) | `bp/src/interface-assets/generate.mjs`, by hand | `docs/development/ux-substrate/visual-language/*` and `.../screens/page.src.html` | yes: `const COMMIT = "2a64c5ae77";` (`:12`) and `const at = (path) => git(["show", `${COMMIT}:${path}`]);` (`:122`) |
| `bp/src/setup-words/rows.mjs` (setup-words, 2) | `bp/src/setup-words/build.mjs`, by hand; `--check` | `docs/development/ux-substrate/screens/words.json` from the working tree (`:48`, `:358` `const bytes = readFileSync(wordsPath);`), and every `localize(id, en)` call in every tracked product `.mjs/.js/.cjs` file a module of `build/modules.json` owns (`:119-138`, `:229-233`) | no |
| `bp/src/wizard-scripts/screen-registry.mjs`, `civicsmith-library.mjs`, `front-doors.mjs` (wizard-library, 153) | `bp/src/wizard-scripts/build-data.mjs`, by hand; `--check` | vendored copies in `bp/test/m/wizard-scripts/source/` (`registry.json`, `library.json`, ten `library-<commit>.json`), default `--from` at `:138` | the copies are named by commit (`SOURCES`, `:30-35`); git is not read |
| `site/src/pages.mjs` (site, 202) | `site/build.mjs`, by hand; `--check` | the design's `mock-kit.js` and `mock-screens.js`, run in a `node:vm` sandbox, and `setup-words`' `word()` | yes: `export const SITE_COMMIT = "2a64c5ae77";` (`:15`), `execFileSync("git", ["-C", ROOT.pathname, "show", `${commit}:${SCREENS}${f}`], ...)` (`:54`) |
| `bp/src/case-checker/program.mjs` (case-checker, 126) | `bp/src/case-checker/build-program.mjs`, by hand | the checker's sources through `buildMember` | no |

All [READ]. [READ] none of these runs in the build (step 2 of section 1). [MEASURED] no workflow file names any of them: `git grep` for the five generator paths over `*.yml` returned nothing; the hits in tests import the generators to check staleness (for example `bp/test/m/case-checker/program.test.mjs:26` `"program.mjs is stale: ..."`).

**UI-layer inputs consumed below the UI.** [READ] `rows.mjs` at position 2 is made from the design folder's `words.json` and from sentences written in every module's code, later modules included; its header states `19562 design words` and `7499 sentences written first in code` (`rows.mjs:2-3`). [MEASURED] 185 modules reach the bundle and the word table is imported by 5 of the UI modules and by modules below them (C10: 8 import edges from UI modules to setup-words). [READ] wizard-library (153) carries the design's screen registry and script library. [MEASURED] In the other direction UI modules import from five lower modules only: setup-words (8 edges), record-grammar (1), op-grades (1), wizard-scripts (2), op-declarations (6); and 188 edges among themselves (C10).

## 6. Bindings

[MEASURED] `bp/wrangler.jsonc` parsed with the product's own reader (`bp/scripts/jsonc.mjs`): one Durable Object binding, two R2 buckets, six service bindings, one browser binding, one var, one cron, two limits; no KV, queue, D1 or other class. [MEASURED] C9 over the 853 inputs; "n" is the count of `env.NAME` sites, modules with their positions.

| binding | kind, where declared | modules whose code names it |
|---|---|---|
| `STORE` | Durable Object, class `Store` (`wrangler.jsonc:21`; migration `:24`) | runtime-limits (10) 3, ai-runs (98) 1, instance-setup (166) 1, admission (169) 4, store-assembly (174) 1, control-plane (195) 1, plane (196) 3 |
| `CAPTURES` | R2 `bio-captures` (`:42`) | provenance (51) 3, attestation (52) 3, capture (56) 6, doorbell (57) 5, file-safety (58) 1, extraction (62) 2, ratification (125) 3, instance-setup (166) 15, store-assembly (174) 2, control-plane (195) 6 |
| `PUBLISHED` | R2 `bio-published` (`:43`) | public-read (121) 7, ratification (125) 9, instance-setup (166) 4 |
| `PDF_WORKER` | service `pdf-worker` (`:122`) | reading-pipeline (61) 2; one more `.PDF_WORKER` in store-services (173) |
| `AGENT_WORKER` | service `agent-worker` (`:123`) | ai-runs (98) 5, signin-door (172) 1, store-services (173) 3 |
| `OCR_WORKER` | service `ocr-worker` (`:124`) | reading-pipeline (61) 3, extraction (62) 1, control-plane (195) 2 |
| `SHEET_WORKER` | service `sheet-worker` (`:125`) | store-assembly (174) 1 |
| `FILE_SCANNER` | service `file-scanner` (`:126`) | acquisition (55) 1, file-safety (58) 1, store-assembly (174) 1 |
| `SELF` | service to itself (`:127`) | store-services (173) 5 |
| `BROWSER` | browser rendering (`:138`) | capture-sources (54) 4 |
| `VERSION` | var (`:15`), replaced at deploy | credentials 3, acquisition 3, capture 1, doorbell 1, extraction 4, capture-requests 1, network-notices 1, monitoring 3, instance-setup 4, control-plane 8 |
| cron `*/5 * * * *` | `:146` | handled by plane: `export default { fetch, scheduled: (controller, env) => watchdog(controller, env) };` (`bp/src/plane/index.mjs:71`) [READ] |
| limits | `"limits": { "subrequests": 10000, "cpu_ms": 300000 }` (`:181`) | none in code; sent by the deploy [READ] |

- [MEASURED] UI modules (176 to 194): no site of any `env.<NAME>` and no `.NAME` for the ten bindings (C9: no UI module appears in any name's list; the scan found 45 distinct `env` names).
- [MEASURED] The door, control-plane (195): `STORE` 1, `CAPTURES` 6, `OCR_WORKER` 2, `VERSION` 8, `ADMIN_TOKEN` 4, `KNOCK_FINGERPRINT_KEY` 2. The launcher, plane (196): `STORE` 3, all in `plane/index.mjs:31-32`, where it wraps the namespace to count calls.
- [MEASURED] Other names set at deploy or as secrets and read in code: `INSTANCE_NAME` (16 sites, 9 modules), `BIO_NOW_MS` (25 sites, 24 modules), `DAEMON_TOKEN` (11), `ADMIN_TOKEN` (8), `KNOCK_FINGERPRINT_KEY` (7), `OWN_HOSTS` (1, store-assembly).
- [MEASURED] Members' own bindings (their `wrangler.jsonc` parsed the same way): agent-worker has service `PLANE` to `bio-plane` and Durable Objects `REMOTE` (class in agent-runner), `SEGMENTS`, `CHECKS`; pdf-worker, ocr-worker and sheet-worker each have R2 `CAPTURES` only; file-scanner has `CAPTURES`, Durable Objects `SCANNER` and `RENDERER`, two container classes and cron `*/10 * * * *`; agent-runner has Durable Object `AGENT_RUNNER` and one container class.
- Limit of C9: it reads names written literally after `env.`; a binding reached through a variable name or a destructuring would not be counted. The second pattern (`.NAME`, `["NAME"]`) was run for the ten bindings only.

## 7. The required test run

**Mechanics, from the workflow and the tool.** All [READ] unless tagged.

- `.github/workflows/module-tests.yml:9-10` runs on `pull_request` (types opened, synchronize, reopened, edited, ready_for_review, converted_to_draft); `:13-15` one run per pull request, a newer one cancels the older.
- Job `scope` (`:17-81`, limit 10 minutes): checkout with `fetch-depth: 0` (`:28`), read the tool's commit from the base's `process.json` (`:35-41`), clone the tool and `npm ci` in it (`:52-54`), read the pull request's job-block comment for a `job/` branch (`:60-70`), then `node "$RUNNER_TEMP/process4/tool/p4.mjs" run scope ...` (`:80`). It runs no product code.
- `run scope` is `decideScope` (`tool/lib/scope.mjs:21-66`): scope `nothing` when the base is `main` (`:29`), the pull request is a draft (`:30`), or no changed file has an owner (`:36`). On a job branch (`JOB = /^job\/([a-z0-9-]+)[./](\d+)$/`, `tool/lib/round.mjs:14`): if the job block's kind is `told`, the scope is `related`, the test files the reader relates to the job (`:44-54`, `relatedList`), or `nothing` when that list is empty (`:52`), or the whole module if the reader fails (`:50`); otherwise `whole module`, every `*.test.*` file under the module's `tests` paths that the module owns (`:14-16`, `:57`). On any other branch: every touched module whole (`:65`).
- Job `module-tests` (`:82-133`, limit 45 minutes, no token): checkout (`:107`), setup-node at `process.json`'s `node` (`:111-114`), `npm ci` in each folder of `process.json`'s `lock_files` (`:122`; nine lock files) and the tool (`:123-125`), then `node "$RUNNER_TEMP/process4/tool/p4.mjs" run tests --scope ...` (`:133`). Nothing is built first: no step runs `npm run build` or `bundles.mjs`. A test that needs a bundle builds it itself (for example `t48.test.mjs:85` `writeFileSync(out, (await buildMember(m)).bytes);`).
- `run tests` is `runTests` (`tool/lib/scope.mjs:74-99`): for each module in scope, first the tool's `check` of the module (`:81`), then `process.json`'s `test_command` with all the module's files as arguments in one process: `const r = run(cmd, [...args, ...m.files], { cwd: root, unset: [...NO_TOKENS, 'NODE_TEST_CONTEXT'] });` (`:88`). `process.json:17` `"test_command": "node --import ./bio-plane/test/platform-sqlite.mjs --test",`. `run` is `spawnSync` with no timeout given (`tool/lib/util.mjs:9-14`), so output appears only when the command ends.
- Concurrency: no `--test-concurrency` is in the command. [MEASURED] With Node v26.10.0 on 4 CPUs (`os.availableParallelism()` printed 4), six test files that each sleep 2 s finished in 4.5 s under `node --test`: three files at a time.
- A `told` job therefore runs the `check` and only the related test files, or nothing at all.

**Run times.** [MEASURED] C11. `list_workflow_runs` reported `total_count` 561 and all 561 were read: 368 success, 173 cancelled, 20 failure; created 2026-11-22T18:33:01Z to 2026-11-23T18:40:21Z; 403 on the 111 branches that match the tool's `JOB` pattern, naming 66 modules. **66 of 204 modules have a run; 138 have none.** "Whole run" is `updated_at − run_started_at` of the run: it holds both jobs, the full-history checkout and any wait for a runner, and it does not say which scope ran. Each cell: last non-cancelled run on the module's highest-numbered job branch, as `branch number: seconds result`, then the longest non-cancelled run on any of its job branches, then the count of runs.

| pos | module | last | longest | runs |
|---|---|---|---|---|
| 2 | setup-words | .7: 199 s ok | 214 | 23 |
| 3 | record-grammar | .1: 177 ok | 177 | 3 |
| 9 | test-support | .2: 172 ok | 196 | 6 |
| 12 | bundler | .1: 122 ok | 122 | 3 |
| 18 | office-readers | .1: 230 ok | 230 | 3 |
| 29 | budget-doctypes | .1: 175 ok | 175 | 3 |
| 31 | pdf-pixels | .2: 139 ok | 139 | 4 |
| 33 | doc-clean | .1: 200 ok | 200 | 3 |
| 34 | pdf-worker | .4: 180 ok | 188 | 15 |
| 35 | ocr-worker | .3: 356 ok | 356 | 12 |
| 36 | sheet-worker | .1: 181 ok | 181 | 3 |
| 37 | file-scanner | .1: 178 ok | 178 | 3 |
| 39 | op-grades | .2: 133 ok | 173 | 7 |
| 48 | promotion | .1: 170 ok | 170 | 4 |
| 62 | extraction | .1: 129 ok | 129 | 1 |
| 78 | bias | .2: 160 ok | 160 | 6 |
| 87 | inquiry | .2: 181 ok | 181 | 7 |
| 91 | basis-version-grammar | .1: 126 ok | 126 | 4 |
| 94 | contradiction-words | .1: 121 ok | 156 | 4 |
| 95 | contradiction | .2: 125 ok | 172 | 7 |
| 98 | ai-runs | .1: 164 ok | 164 | 3 |
| 104 | answers | .1: 156 ok | 156 | 3 |
| 105 | agent-harness | .2: 101 ok | 168 | 5 |
| 107 | agent-runner | .2: 101 ok | 193 | 5 |
| 109 | agent-worker-routes | .1: 124 ok | 124 | 2 |
| 110 | agent-worker | .2: 84 ok | 275 | 6 |
| 118 | publication | .2: 120 ok | 214 | 5 |
| 121 | public-read | .1: 123 ok | 123 | 4 |
| 126 | case-checker | .2: 227 ok | 260 (failed) | 7 |
| 127 | case-import | .1: 175 ok | 175 | 3 |
| 137 | action-grammar | .1: 180 ok | 180 | 3 |
| 149 | monitoring | .1: 167 ok | 167 | 3 |
| 153 | wizard-library | .1: 169 ok | 169 | 3 |
| 154 | wizard-scripts | .2: 129 ok | 129 | 5 |
| 162 | notice-producers | .1: 210 ok | 210 | 3 |
| 164 | queue | .1: 167 ok | 167 | 3 |
| 166 | instance-setup | .2: 206 ok | 240 | 6 |
| 168 | op-declarations | .1: 209 ok | 209 | 3 |
| 169 | admission | .3: 198 ok | 229 | 10 |
| 170 | answer-envelope | .1: 185 ok | 185 | 7 |
| 173 | store-services | .2: 154 ok | 177 | 6 |
| 174 | store-assembly | .4: 481 ok | 481 | 10 |
| 175 | store-request | .3: 88 ok | 323 (failed) | 11 |
| 177 | interface-shell | .1: 213 ok | 213 | 8 |
| 178 | screens-entry | .1: 221 ok | 221 | 5 |
| 180 | screens-account | .2: 111 ok | 169 | 5 |
| 181 | screens-settings | .2: 290 ok | 399 | 7 |
| 183 | screens-intake | .1: 545 ok | 545 | 5 |
| 184 | screens-find | .4: 155 ok | 477 | 13 |
| 185 | screens-daily | .1: 397 ok | 397 | 7 |
| 186 | screens-document | .1: 161 ok | 161 | 5 |
| 187 | screens-question | .2: 183 ok | 183 | 6 |
| 188 | screens-inquiry | .1: 612 ok | 612 | 9 |
| 189 | screens-people | .1: 176 ok | 176 | 5 |
| 190 | screens-investigate | .1: 348 ok | 348 | 5 |
| 191 | screens-public | .2: 167 ok | 176 | 7 |
| 192 | screens-publish | .3: 258 ok | 258 | 10 |
| 193 | screens-send | .2: 159 ok | 159 | 12 |
| 194 | screens-action | .2: 261 ok | 261 | 9 |
| 195 | control-plane | .3: 131 ok | 507 | 9 |
| 196 | plane | .1: 2562 ok | 2771 (failed) | 14 |
| 197 | release | .1: 216 ok | 218 | 5 |
| 199 | installer-steps | .1: 98 ok | 111 | 2 |
| 201 | installer | .1: 336 ok | 336 | 6 |
| 203 | stewards | .1: 144 ok | 144 | 2 |
| 204 | journey-check | .1: 93 ok | 132 | 10 |

[MEASURED] Whole-run time of the last run, over the 66: min 84 s, quartiles 130 / 174 / 211 s, max 2562 s. By position: 1 to 100 (21 modules) median 172 s, max 356; 101 to 175 (22) median 167, max 481; 176 to 194 (16) median 217, max 612; 195 to 204 (7) median 144, max 2562 (plane).

**The test step alone, for 13 runs** (`list_workflow_jobs`; step `run the tests in scope`, and the `scope` job's checkout step). [MEASURED]

| run | branch | whole run | scope checkout | test step |
|---|---|---|---|---|
| 45165115063 | job/setup-words.7 | 199 s | 83 s | 48 s |
| 45127849423 | job/agent-worker.2 | 84 | 67 | skipped (nothing in scope) |
| 45172735399 | job/store-assembly.4 | 481 | 78 | 156 |
| 45136734093 | job/store-request.2 | 323 | 106 | 138 (failed) |
| 45140358965 | job/interface-shell.1 | 213 | 65 | 77 |
| 45142481301 | job/screens-entry.1 | 221 | 103 | 53 |
| 45148059188 | job/screens-settings.1 | 399 | 102 | 227 |
| 45150576407 | job/screens-intake.1 | 545 | 102 | 373 |
| 45150706738 | job/screens-find.3 | 477 | 105 | 9 |
| 45155089621 | job/screens-daily.1 | 397 | 97 | 232 |
| 45154552643 | job/screens-inquiry.1 | 612 | 82 | 462 |
| 45151462069 | job/screens-investigate.1 | 348 | 102 | 180 |
| 45154655734 | job/control-plane.2 | 507 | 143 | 284 |

In those 13, the `module-tests` job's fixed steps were: checkout 20 to 33 s, setup-node 4 to 6 s, install 18 to 22 s. The whole run minus the test step was 136 to 468 s (store-assembly.4 and screens-find.3 waited minutes before their first job was created), so the whole-run column above cannot be read as test time. [NOT CHECKED] the test step of the other 53 modules and of `plane`; `03-run-time.md` in this folder reports plane's from job logs.

## 8. Deploy and release facts a re-stacking touches

**What release reads from plane.** [READ]

- `bp/scripts/release-assemble.mjs:186` `const plane = planeMember();`: the entry path comes from `fb:522`, nowhere else in the release scripts.
- `:293-298` `freshArtifact` builds each asset by the member's own `npm run build` (`buildFresh`, `bundles.mjs:33-50`, which first removes the artifact and manifest), so the release's plane bundle is a fresh `bp/dist/bio-plane.bundled.mjs`, checked against its manifest (`:333`).
- `:342-344` reads each member's `wrangler.jsonc` for the upload facts; `:269-282` `workerPart` takes Durable Objects, migrations, buckets and crons from it.
- `:433-434` records `asset: `${m.name}.bundled.mjs``, sha256 and bytes; `:510` `plane: { sha256: planeEntry.sha256, bytes: planeEntry.bytes, asset: "bio-plane.bundled.mjs" },`; `:705` copies each asset into `release/`.
- The installer consumes the release by that asset name and uploads it as `index.mjs`: `newgroup/src/index.mjs:132` fetches `(man.asset || "bio-plane.bundled.mjs")`; `newgroup/src/steps/uploads.mjs:55` `main_module: "index.mjs",`; `newgroup/scripts/embed-release.mjs:167` reads the same asset.

So [READ] the deployed Worker's module is named `index.mjs` and its exports are whatever the bundle exports; no deploy, release or installer script names `src/plane/index.mjs` except through `planeMember()`. [MEASURED] the built artifact exports `Store` and `default` (C4 printed `exports [ 'Store', 'default' ]`), and `wrangler.jsonc:21` binds class `Store`.

**Every place the entry path is named** (C12). [MEASURED] 233 lines in 205 files: 121 lines in `.md`, 14 in `.txt`, and 98 lines in 84 code or config files. Those 84 by owner module:

| owner | files | where |
|---|---|---|
| plane | 74 | `bp/wrangler.jsonc:11` (`"main"`); 17 files in `bp/test/m/plane/`; 20 in `bp/test/m/control-plane/`; 7 in `bp/test/m/screens-inquiry/`; 4 in `bp/test/m/screens-intake/`; 3 in `bp/test/m/capture/`; 2 each in `bp/test/m/screens-daily/`, `bp/test/m/instance-setup/`, `bp/test/system/`; 1 each in `bp/test/m/affordances/`, `host-governor/`, `reevaluation/`, `screens-publish/`; 7 in `bp/test/`; 4 in `agent-worker/test/`; `roster-reader/test/fixtures/capture.mjs` |
| bundler | 2 | `fb:522` (`PLANE_ENTRY`, the build's one naming); `bp/test/m/bundler/recipe/config.test.mjs:19` |
| release | 2 | `bp/test/m/bundler/devcopy.test.mjs:62`, `bp/test/m/bundler/repo.mjs:201` (sample configs) |
| journey-check | 3 | `bp/src/journey-check/local.mjs:4` (a comment); `bp/test/m/promotion/write-path.test.mjs:29`; `build/plan/walk-T51-final/scripts/10b-case.test.mjs` |
| control-plane | 1 | `bp/test/m/control-plane/rows-plane.mjs:14` |
| capture-sources | 1 | `bp/src/browserrender.mjs:30` (a comment) |
| roster-reader | 1 | `roster-reader/test/fixtures/roster-documents.json` |

Most test namings hold the path as text and start a Worker from it, for example `bp/test/m/control-plane/t46-e2e.test.mjs:21` `const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));`; ten lines are import statements, for example `bp/test/m/plane/r10-entry.mjs:7` `export { default } from "../../../src/plane/index.mjs";`. One test pins the config: `bp/test/m/plane/worker.test.mjs:86` `assert.equal(cfg.main, "src/plane/index.mjs");`. In non-test, non-comment code the path is named twice: `fb:522` and `bp/wrangler.jsonc:11`.

**The bundle's file name and `main_module`.** [MEASURED] `git grep -E "main_module|bio-plane\.bundled\.mjs|dist/bio-plane"` over `*.mjs`, `*.yml`, `*.json`, `*.jsonc` outside bundles, `build/`, `docs/` and tests: `deploy-test.yml:119`, `deploy.mjs:277`, `dev-copy.mjs:433`, `fb:536-537`, `release-assemble.mjs:510, 671, 705, 728`, `bp/src/journey-check/account.mjs:28`, `newgroup/scripts/embed-release.mjs:126, 167`, `newgroup/src/index.mjs:132`, `newgroup/src/steps/account.mjs:229`, `load.mjs:32`, `members.mjs:58`, `probes.mjs:22`, `uploads.mjs:55, 127`, `release/RELEASE.json:5`, and two comments. 23 test files name them too.

## After a change

Nothing here is a finding about today's code; it only says which measured facts a re-stacking would meet.

- A move of the page routes out of control-plane would have to carry the 13 import statements of section 3 and the one Worker call into screen code (`deliverOwedRender`).
- A build whose entry omits the UI is possible only as a different entry or a build-time substitution; today the entry is one constant (`fb:522`) and `wrangler.jsonc:11`, pinned by `worker.test.mjs:86` and named as text by 74 plane-owned files.
- The measured sizes of a bundle with the UI stubbed (25,141,211 bytes) and its start-up (507 ms median) are of C7's stubs, not of any designed split.

## What I did not check

- workerd: every time here is Node's. The plane's start-up in workerd, Cloudflare's `startup_time_ms`, and the first page request's cost in a real isolate were not measured.
- A byte split of the bundle into browser-only and Worker-executed code (section 3 says what blocks it). The coverage figures are for one small scenario and count source characters.
- Whether the served script repeats shared function texts (the inference in section 3).
- The fleet members' builds were not run or measured; only their markers, configs and build callers were read. No container image was built.
- `wrangler dev` and `wrangler deploy` were not run, so how wrangler re-bundles `dist/bio-plane.bundled.mjs` for the development copy is not measured.
- The test step's time for 53 of the 66 modules with runs, and for `plane`; which scope (`nothing`, `related`, `whole module`) each listed run had. The job logs would give both.
- Whether the required run of `release` (which owns `bp/test/system/fleetbundles.test.mjs`) passes on a tree whose committed plane bundle is stale; I ran `verifyStatic` only, not that test.
- References to the entry other than the path text `plane/index.mjs` (for example a variable built from parts). The grep is of that text only.
- Bindings reached through a destructured or renamed `env`; the scan reads literal `env.NAME` (all names) and `.NAME` for the ten bindings.
- The three files `answers`, `control-plane` and `interface-shell` (2,182,547 bytes each) that appeared untracked at the repository root at 20:54 to 20:56 on 23 Nov while other workers were running: I did not write them and did not open them.
