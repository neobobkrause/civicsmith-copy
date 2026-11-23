Length: 248 lines. Last section: "What I did not check".

# 11. The front door and the launcher as they are now

Worker for plane-scope lane #1, 23 Nov 2026. Base: the working tree, which is identical to `origin/p4-tranche` `a26a8da2` under `bio-plane`, `process/modules` and `docs` [MEASURED: `git diff --quiet a26a8da2 -- bio-plane process/modules docs`, exit 0]. Scope: CODE files. Tests were not traced. Tags follow `evidence-rules.md`. Line numbers are of the files as checked out. `cp/` means `bio-plane/src/control-plane/`, `pl/` means `bio-plane/src/plane/`, other paths are under `bio-plane/src/` unless written whole. "UI layer" here means the 19 modules at 176 to 194 of `order.txt` (interface-assets, interface-shell, 17 screens parts); that reading of "UI" is the brief's, not a finding.

## Headlines

1. **Does the door's code refer to UI-layer modules? Yes.** 13 import edges from 2 control-plane files into 12 UI modules, and through them every one of the 19 UI modules (130 UI files). [MEASURED M2]
2. **What the door does with the UI.** 17 imported UI symbols. 16 are used only to serve the page, its script and its assets (the door hands the nine screen lists and the guide to interface-shell's three builders and serves what comes back). 1 (`CAPTURE_SCREEN`) is used only in `deliverOwedRender`, which runs two of the capture screen's functions inside the Durable Object. [MEASURED M7, READ below]
3. **Does the launcher's code reach the UI? Yes, and only through control-plane.** No plane file imports a UI file. `pl/index.mjs`, `pl/door.mjs` and `pl/store.mjs` each import `cp/index.mjs`; with every edge into control-plane files cut, no plane file reaches any UI file. [MEASURED M4]
4. **What else places the door and the launcher above 176 to 194? In code, nothing found.** With edges into UI files cut, the latest module `cp/index.mjs` reaches is store-request (175). With edges into control-plane cut, the latest module the plane files reach is store-assembly (174). [MEASURED M3, M4]
5. **Does UI code refer to the door or the launcher? Not by import. Yes by text.** No UI code file imports a control-plane or plane file, or any file of modules 169 to 175; the latest non-UI module UI code reaches is op-declarations (168). UI code holds the door's routes, one header, the query parameters `op`, `background` and `v`, and several answer fields as text. [MEASURED M5, M11]

## Commands

Scratch scripts: `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/w11/` (`graph.mjs`, `q.mjs`, `q2.mjs`, `q3.mjs`, `graph-ui.mjs`, `strip.mjs`). The graph is esbuild's own parse, not a regex: `build({entryPoints, bundle: true, write: false, metafile: true, format: "esm", platform: "neutral", external: ["cloudflare:workers", "node:*"]})` from `bio-plane/node_modules/esbuild`, reading `metafile.inputs[*].imports`. A file's owner is the module whose `files` or `tests` path matches it most specifically.

- **M1** `find bio-plane/src/control-plane bio-plane/src/plane -type f | xargs wc -lc`: 10 and 5 files, sizes in sections 1 and 5.
- **M2** `node graph.mjs <the 15 files>` then an edge listing: `entries 15 inputs 854 unowned []`; `edges from control-plane/plane files into UI-layer files: 13 ; UI modules directly imported: 12`; closure of `cp/index.mjs`: `files 761 modules 170`, with every module 176 to 194 present (file counts 1, 2, 8, 4, 6, 14, 1, 8, 10, 13, 3, 2, 6, 7, 10, 7, 8, 7, 13 = 130).
- **M3** `node q3.mjs` (closure with edges into UI-owned files cut): `control-plane/index.mjs: UI cut -> files 631, latest non-own store-request(175)`; modules at 150 or later reached: `following(150) link-sweep(151) scheduler(152) wizard-library(153) wizard-scripts(154) act-help(155) affordances(156) tasks(157) queue(164) translations(165) instance-setup(166) op-capabilities(167) op-declarations(168) admission(169) answer-envelope(170) signin-door(172) store-request(175)`; `store-door`, `store-services`, `store-assembly`, `plane` `reached by control-plane/index.mjs (uncut): false`.
- **M4** `node q2.mjs <5 plane files>` (closure with edges into control-plane-owned files cut): `plane/index.mjs: files 853; UI files reached 130; with control-plane cut: files 711, UI files reached 0`; same shape for `door.mjs` (849, 130, 707, 0) and `store.mjs` (846, 130, 701, 0); `watchdog.mjs` 2 files, 0 UI; `arrival.mjs` 1 file, 0 UI. Modules at 169 or later reached with the cut: `admission(169) answer-envelope(170) store-door(171) signin-door(172) store-services(173) store-assembly(174) plane(196)`.
- **M5** `node graph-ui.mjs <all 131 .mjs under interface-assets, interface-shell, screens-*>`: `inputs 697 UI-owned inputs 131`; `control-plane or plane file among inputs: []`; `reached modules >= 160: op-capabilities(167) op-declarations(168)` and the 19 UI modules; edges out of UI files to non-UI modules: setup-words(2), record-grammar(3), op-grades(39), wizard-scripts(154), op-declarations(168), and `node:` builtins from `interface-assets/generate.mjs` only. The 11 UI directories hold no subdirectory and no other kind of file (`find -type d` = 11; `find ! -name "*.mjs"` empty).
- **M6** `grep -n -o "hooks\.[A-Za-z_]*" cp/index.mjs`: `hooks.publicOp` (667 comment, 1247), `hooks.gatedOp` (668 comment, 1385, 1594 twice, 1861, 1866), `hooks.acquireBoundMs` (1554, 1673). No other name.
- **M7** Comment-free copies of the 15 files (`esbuild.transform`, comments dropped), then `grep -n -i -E "/app|assets|\.css|\.svg|shell|interface|text/html|text/javascript|text/css|<[a-z!/]|nonce|content-security|doorbell|/tour|screen|favicon|fonts?/|cs-|localStorage|cookie|set-cookie"`. Every hit is listed in section 3; plane files gave no hit but `doorbellPublicOp` (the doorbell module, 57).
- **M8** `grep -rn "CAPTURE_SCREEN" bio-plane/src --include=*.mjs`: 6 lines in 3 files (`screens-intake/capture.mjs:1403`, `screens-intake/index.mjs:44, 262`, `cp/index.mjs:39, 796, 797`).
- **M9** `grep -rn "deliver\b|deliverOwedRender|deliver:" bio-plane/src` (code lines): `pl/store.mjs:12, 41`; `store-assembly/assemble.mjs:220, 498`; `store-assembly/pending.mjs:720, 721, 732, 733`; `acquisition/index.mjs:2485, 2486, 2498, 2512, 2580, 2612`; `cp/index.mjs:743`; and two lines of promotion's own private `#deliver` (`promotion/index.mjs:319, 322`), which is another thing.
- **M10** `grep -n -E "readFileSync|readFile\(|readdir|node:fs|import\(|require\(|import\.meta" cp/*.mjs pl/*.mjs`: no hit. `grep -o -h -E "env\??\.[A-Z][A-Z0-9_]+"`: control-plane reads `ADMIN_TOKEN, CAPTURES, KNOCK_FINGERPRINT_KEY, OCR_WORKER, STORE, VERSION`; plane reads `STORE`. `grep -i cookie` over `cp/*.mjs pl/*.mjs admission/index.mjs answer-envelope/index.mjs`: no hit.
- **M11** Comment-free copies of 130 UI files plus `interface-assets/index.mjs` raw, grepped per name. Zero files for: `cookie`, `x-bio-`, `x-civicsmith`, `server-timing`, `control-plane/`, `../plane/`, `makeFetch`, `deliverOwedRender`, `wrangler`, `env.[A-Z]`, `x-capture-sha256|x-derived-sha256`, `etag|if-none-match`. Hits are in section 7.
- **M12** `grep -rn -E "(from|import)...control-plane/..."` and `.../plane/...` over all `.mjs`/`.js` outside tests, `build/`, `release/`, `process/`: control-plane files are imported by `pl/store.mjs:12`, `pl/door.mjs:29`, `pl/index.mjs:8` and nothing else; no file imports a plane file. Path text: `bio-plane/wrangler.jsonc:11` and `bio-plane/scripts/fleet-bundle.mjs:522` name `src/plane/index.mjs`.
- **M13** `bio-plane/dist/bio-plane.bundle.json`: `inputs 852`, `entry src/plane/index.mjs`, 129 inputs under `src/interface-*` or `src/screens-*`, 9 control-plane inputs (not `storage-words.mjs`), 5 plane inputs.
- **M14** Module records read with `node -e`: quoted where used.
- **M15** Column-0 statements that are not declarations, in the comment-free copies: UI code has `Object.freeze(...)` of its own values and `generate.mjs`'s `main()` guard, nothing else; door and launcher have `bindPublishedPlane({` (`pl/index.mjs:19`) and nothing else.

## 1. control-plane's code files

`process/modules/control-plane.json` `files` is `["bio-plane/src/control-plane/"]` [READ]. Ten files [MEASURED M1]:

| file | lines / bytes | what the code does | imports (module, index) |
|---|---|---|---|
| `index.mjs` | 2184 / 171,099 | `makeFetch(hooks)` (line 889) and everything in section 2; `deliverOwedRender` (743) | 45 files of 33 modules (49 import statements); see sections 3 and 6 |
| `app.mjs` | 109 / 7,830 | which page route a request names; the page, script and asset answers; the two public aliases; the logo's name | interface-shell (177) only |
| `archive.mjs` | 114 / 8,941 | composes and promotes one Information bundle per document an unpack filed (`promoteArchive`, line 83) | record-grammar (3), promotion (48), setup-words (2) |
| `draft.mjs` | 125 / 9,512 | the assistant's draft: which ops are due one, the ask, the check of the answer | wizard-scripts (154), setup-words (2) |
| `jobs.mjs` | 44 / 3,385 | `jobRegistrar`: writes a job row through the store route `pendingadd`, one retry on a fresh stub | runtime-limits (10, `store-place.mjs`), answer-envelope (170) |
| `job-state.mjs` | 38 / 2,775 | `jobStateOf(rows)`: the `job` object `op=reading` answers | none |
| `reading-gate.mjs` | 105 / 8,289 | whether a reading is made in the request (`inlineVerdict`, `readingVerdict`) | runtime-limits (10, `read-bounds.mjs`), ooxml (16), odf-reader (19) |
| `phase-clock.mjs` | 228 / 14,558 | the request clock, the clocked `env.STORE`, the `Server-Timing` value | `node:async_hooks` only |
| `words-cache.mjs` | 114 / 7,655 | cache headers, `etag`, 304 and gzip for the answer of `op=interfacewords` | none |
| `storage-words.mjs` | 16 / 1,765 | ten `localize("screen.group.storage.…", "…")` sentences | setup-words (2) |

All rows: sizes [MEASURED M1], imports [MEASURED M2], purpose [READ] at the lines named. `storage-words.mjs` is imported by no source file: its only importer in the repository is `bio-plane/test/m/control-plane/storage-words.test.mjs`, and it is not among the bundle's inputs [MEASURED: `grep -rn "storage-words\|STORAGE_WORDS"` over the repository; M13].

## 2. The door's responsibilities

File is `cp/index.mjs` unless named. Each row [READ] at its lines; a quoted fragment is within the lines named beside it. "Calls" lists the modules whose symbols the lines use.

| # | responsibility | entry points | calls | touches the UI layer |
|---|---|---|---|---|
| A | The Worker's entry and its one frame | 889 `export function makeFetch(hooks = {})`; 893 `planeDoor`; 898 `catch (e) { res = planeInternalError(e, req); }`; 907 `withPagePolicy` | answer-envelope | only by 907 (tie T04) |
| B | Routing | 943 `if (req.method === "OPTIONS")`; 957 `/version`; 963 `/favicon.ico`; 1009 `let op = url.searchParams.get("op") \|\| path.slice(1) \|\| "selftest"`; 1013 aliases; 1015 `OPS[op]`; 1023 to 1028 `inboxresolve` at `pulled` becomes `inboxpull`; 1035 `UNKNOWN_OP` | op-declarations, answer-envelope | no |
| C | The member page, its script, its assets, the unknown-address page | 970 to 976 `return page(req, env, seen)`; 981 to 992 `appRouteOf`; 999 to 1005 `addressPageOf`; 920 to 928 `function page`; `app.mjs` whole | admission (two gates), answer-envelope (`json`), instance-setup (`groupLogoAsset`, 989), ai-runs (159), interface-shell, interface-assets, nine screens modules | **yes**: ties T01 to T16, N01 to N04 |
| D | Namespace and address gates, admission | 1044 to 1059 `namespaceGate(url)` …; 1066 `doorWindowGate`; 1256 `admit({ url, env, op, spec, …})`; 654 and 1260 `grantAdmit`; 1349 `bearerFence(op, caller)`; 532 and 1353 `replayVerdict`; 1369 purge's `confirm` | admission, credentials, store-request (`promotedTypeOf`), record-grammar | no |
| E | Public ops the door answers itself | 1089 `claim`; 1129 `reviewcopy`, `reviewcomment`, `statementack`; 1162 `login`; 1171 `recover`; 1182 `passwordresetlook`, `passwordreset`; 1189 `invitelook`, `enroll`; 1196 `grouplanguages`; 1202 `websiteinvite`, `joinlinkinvite`; 1210 `groupdescription`; 1220 `handlecheck`; 1231 template grant doors; 1232 `instancegroup`, `groupidentity`; 1233 `knockerconsent`; 1239 to 1244 registered public reads; else 1247 `return hooks.publicOp({…})` | runtime-limits (`liveToken`, `storeStub`), answer-envelope, store-request (`innerRequest`, 375), public-read, filing-templates, instance-setup, admission (`readerOf`, 421) | no |
| F | Admitted ops the door answers itself | 1300 `whoami`; 1382 `agentpack`; 1449 a member's `capture` GET, sent to the store's `openoriginal`; 1463 to 1475 `subscriptionsignin`, `signintrace`, `subscriptiondisconnect`; 1494 `textcheck`, `readtranslate`; 1506 `airundispatch`; 1516 `acquire`'s `for`; 1594 `hooks.gatedOp({…})`; 1960 `aicredentialmint`; 1990 `reviewgrant`; 2011 `templatereviewgrant`; 2029 byte ops; 2045 `casedrafts`; 2051 the generic forward; 2055 `stats` grain; 2116 drafts | membership, signin-door, store-request (`door-ops.mjs`), skills, acquisition, admission, public-read, `draft.mjs` | no import; answer fields the UI reads (section 7) |
| G | The request the store is asked | 1905 `const built = innerRequest({ op, url, method: req.method, body: passBody, caller: …})` | store-request | no |
| H | What follows a capture | 187 `ACQUIRE_BOUND_MS = 25000`; 1551 to 1569 the bound; 1435 `promoteAcquired` (`archive.mjs`); 1693 `followEntries`; 1748 `readUploaded`; 1817 `readHeldAfterAcquire`; 1658 `pendReading`; 1328 `jobRegistrar` (`jobs.mjs`); `reading-gate.mjs`; 1845 `tieToStep`; 2069 to 2085 job state (`job-state.mjs`) | acquisition, extraction (`acquireReadingOp`, 1790), promotion, runtime-limits, ooxml, odf-reader, answer-envelope | no |
| I | Delivery of an owed render or fetch | 743 `export async function deliverOwedRender({ ctx, env, storeName = "bio", answer, session } = {})` | capture, record-core, promotion, extraction, setup-words, `jobs.mjs`, `reading-gate.mjs`, screens-capture | **yes**: tie T17 |
| J | The words answer's cache | 902 `if (seen.op === "interfacewords") { const kept = await interfaceWordsCache(res, req, env); …}`; `words-cache.mjs:75` | none | no import; tie N05 |
| K | Timing | 894 `makeClock()`; 898 `withClock(clock, () => fetch(req, clockedEnv(env, clock), seen))`; 913 `withServerTiming(res, clock.header(metric))`; 123 `liftDerivation`; 868 to 878 the two log lines | `phase-clock.mjs` | no |
| L | Tallies and the trace | 106 `tallySessionRefusal`; 136 `tallyOnTheWayOut` (`securityTally`); 169 `withTrace`; 1488 `mintTrace()` | admission, signin-door, answer-envelope | no import; tie N10 |
| M | The plane's limits and cron, stated in code | 634 `PLANE_LIMITS`; 639 `PLANE_LIMITS_STATEMENT`; 644 `PLANE_CRONS_STATEMENT = "bio-plane-crons/1 */5 * * * *"`; 915 to 917 set on the door | runtime-limits (`byte-ledger.mjs`) | no |
| N | Helpers exported to the launcher | 2180 to 2184 `export { …, PUBLISHED_STORE, sha256Hex, fingerprint, caseReader, reviewAnswer, captureKey, …, storageAbsent, … }` and `SCRATCH, NAMESPACES` | admission | no |
| O | Words of the `group` screen's storage gauge | `storage-words.mjs:5` to 16 | setup-words | by key: tie N08 |

Sign-in by handle and password is row E's `login`, relayed to the store route `login` (1165, `http://do/login`) [READ]. A session is read by admission's `admit` (1256) and `readerOf` (421) [READ]. No cookie is set or read by the door, the launcher, admission or answer-envelope [MEASURED M10]. `signin-door` is a member's Claude subscription sign-in, not the member's sign-in to the record (section 8).

## 3. Every tie between the door and the UI

Machine-readable: `door/ties.json` (30 ties: 17 import symbols, 13 not imports; class a 16, b 2, c 12).

### 3a. Imports: 13 edges, 17 symbols [MEASURED M2; uses MEASURED M7 and READ at each line]

| id | import (file:line) | symbol, from | every use | class |
|---|---|---|---|---|
| T01 | `cp/app.mjs:21` | `versionOfScriptPath`, interface-shell | `app.mjs:32` `if (versionOfScriptPath(p) !== null) return "script";`; `app.mjs:53` `if (versionOfScriptPath(url.pathname) !== here) return notFound();` | b |
| T02 | `cp/index.mjs:52` | `interfacePage`, interface-shell | 924 `appPage(req, { interfacePage, screens: APP_SCREENS, options, status })`, called at `app.mjs:40` `const html = interfacePage(screens, options);` | a |
| T03 | `cp/index.mjs:52` | `interfaceScript`, interface-shell | 991 `appScript(req, url, { source: interfaceScript(APP_SCREENS, appOptions(env)), version: env.VERSION })` | a |
| T04 | `cp/index.mjs:52` | `interfaceScriptHash`, interface-shell | 923 `seen.scriptHashes = [interfaceScriptHash(APP_SCREENS, options)];` then 907 `withPagePolicy(res, { scriptHashes: seen.scriptHashes })` | a |
| T05 | `cp/index.mjs:52` | `pageWork`, interface-shell | 927 `console.log(JSON.stringify({ event: "control-plane.page", ...pageWork(), ms: Date.now() - began }));` | a |
| T06 | `cp/index.mjs:53` | `ASSET_FILES`, interface-assets | 992 `appAsset(req, url, { assets: ASSET_FILES, version: env.VERSION })`; read at `app.mjs:93` to 100 (`assets[name]`, its `type`, `encoding`, `body`) | a |
| T07 to T15 | `cp/index.mjs:54` to 62 | `SCREENS` of screens-entry, -settings, -intake, -daily, -inquiry, -wizards, -investigate, -publish, -action | 63 to 64 `const APP_SCREENS = Object.freeze([...ENTRY_SCREENS, …])`; `APP_SCREENS` is used at 923, 924, 991 and nowhere else | a |
| T16 | `cp/index.mjs:59` | `GUIDE`, screens-wizards | 65 `const APP_OPTIONS = Object.freeze({ guide: WIZARD_GUIDE });`; 162 `appOptions`; used at 922 and 991 | a |
| T17 | `cp/index.mjs:39` | `CAPTURE_SCREEN`, `screens-intake/capture.mjs` (module screens-capture, 182) | 796 `CAPTURE_SCREEN.parts.titleOf(cs, { reading: answer.reading, doc, address })`; 797 `await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc, title, locator: address, project })` | b |

The door never reads a screen's fields: the only expressions over `APP_SCREENS` are the three calls above [MEASURED M7]. `app.mjs`'s three answer functions already take the builder, the screens, the script source and the asset table as arguments (`app.mjs:39`, `:51`, `:90`) [READ]; the binding to the UI is the import lines of `index.mjs` and `app.mjs:21`.

### 3b. Ties that are not imports [found by M7, M10, M11, M13, M15; each READ at its lines]

| id | door side | UI side | what it is | class |
|---|---|---|---|---|
| N01 | `cp/app.mjs:23` `const APP = "/app";` `:24` `const ASSETS = "/app/assets/";` | `interface-shell/index.mjs:53` `return "/app/assets/" + name;`; `interface-shell/browser.mjs:1115` `if (!/^\/app(\/\|$)/.test(p))`; 15 `/app/assets/fonts/…` addresses in the stylesheet text at `interface-assets/index.mjs:11`; `screens-action/request.mjs:129`, `screens-settings/settings.mjs:20` (`/app/assets/icons.svg`) | the same addresses written on both sides | c |
| N02 | `cp/app.mjs:67` `export const PUBLIC_ALIASES = Object.freeze(["/doorbell", "/tour"]);` | `interface-shell/index.mjs:172` `export const PUBLIC_ADDRESSES = Object.freeze({ doorbell: "doorbell", tour: "tour" });`, read at `browser.mjs:1119` | the door keeps its own copy of the shell's two public addresses, to answer 200 and not 404 | a |
| N03 | `cp/app.mjs:108` `export const GROUP_LOGO = "group-logo";`; `cp/index.mjs:988` to 989 | `screens-entry/front.mjs:35` `src="/app/assets/group-logo"` | one asset name the door serves from the store, not from the table | c |
| N04 | `cp/index.mjs:162` `const appOptions = (env) => ({ ...APP_OPTIONS, testInstance: testInstanceOf(env), ...(… { version: env.VERSION } …) });` | `interface-shell/index.mjs:585` to 589 read `options.version`, `options.testInstance` | facts of the environment the door hands the page builder | c |
| N05 | `cp/words-cache.mjs:90` ``const key = … `${version}~${seen.language ?? ""}~${seen.words_version}` ``, `:91` compares the request's `v` | `interface-shell/index.mjs:596` `<meta name="cs-version" …>`; `browser.mjs:2764` `r + "~" + n.l + "~" + n.s`; `browser.mjs:2777` `call("interfacewords", v ? { query: { v } } : {})` | the cache key's format is composed separately on each side | c |
| N06 | `cp/index.mjs:942` `const background = url.searchParams.get("background") === "1";` | `browser.mjs:153` `if (req.background) qs.set("background", "1");` | a query parameter | c |
| N07 | `cp/index.mjs:907`; `answer-envelope/index.mjs:136` uses the hash policy only when `!hasInlineScript(text)` | `interface-shell/index.mjs:604` `<script src="${scriptPath(version)}" integrity="${hash}"></script>` | the page must hold no inline script for the hash policy to apply | c |
| N08 | `cp/storage-words.mjs:6` to 15, ten `screen.group.storage.*` sentences; `cp/index.mjs:2057` `Math.floor(body.result.dbBytes / STATS_GRAIN) * STATS_GRAIN` | `screens-settings/group.mjs:259` ``W(S + "storage.size", { used: (Math.floor(n / 1e8) / 10).toFixed(1), …})``; `setup-words/rows.mjs:26436` to 26445 hold the rows; `screens-settings/keys.mjs:1267` to 1275 lists nine of the ten keys | a control-plane file declares words one screen draws; both sides hold the 100 MB grain | c |
| N09 | `cp/index.mjs:2002` `secretIsShownOnce: word("screen.review-copy.link.once")` | `screens-publish/review-copy.mjs:120` `cs.w("screen.review-copy.link.once")` | the door answers a sentence under a key a screen also draws, each through the words | c |
| N10 | `cp/index.mjs:176` `JSON.stringify({ ...body, trace })` | `browser.mjs:341` `a.fields.trace` | an answer field the door adds and the shell draws | c |
| N11 | `cp/index.mjs:1567` to 1568 `reason: "ACQUIRE_TIMED_OUT", … kept, timings`; 2085 `job: jobStateOf(…)` | `screens-intake/capture.mjs:1414` `refusal.kept === "held" \|\| refusal.kept === "undetermined"`; `:858`, `:1279` `a.job` | answer fields the door adds and the capture screen reads (a sample: see section 7) | c |
| N12 | `cp/archive.mjs:22` `export const PROV_EMBED_MAX = INLINE_MAX - 65536;` | `screens-intake/capture.mjs:176` `const PROV_EMBED_MAX = 1048576 - 65536;` | one bound written on both sides | c |
| N13 | `bio-plane/dist/bio-plane.bundle.json` (a plane file) lists 129 UI inputs [MEASURED M13] | | the built bundle's manifest names UI files | c |

Searched for and not found in door or launcher code: a UI file path held as text other than import specifiers, a file or folder read at run time, a dynamic import, HTML, CSS or script text of the door's own, a registry the UI fills at load [MEASURED M7, M10, M15]. The content-security-policy hash is tie T04: interface-shell computes it (`interface-shell/index.mjs:554` `made.hash = "sha256-" + base64(sha256HexSync(made.source));`), the door carries it from 923 to 907, answer-envelope writes the header (`answer-envelope/index.mjs:137`) [READ].

### 3c. What the door needs from the UI, by class

- **(a) Data or a builder it could be handed at start: T02 to T16, N02.** The door's whole use is the three calls quoted in 3a and the asset lookup; the values depend on the screens, the guide and, for the page, `{testInstance, version}`. `interface-shell/index.mjs:524` `if (SCRIPT && SCRIPT.screens === screens && SCRIPT.guide === guide) return SCRIPT;` keeps the composed script and its hash while the same screens and guide are handed in, and `:532` builds the source from the shell's program, the screens and the guide alone [READ].
- **(b) UI logic the door runs itself: T17 and T01.** T17: two functions of the capture screen run in the Durable Object over a stand-in kit the door builds at `cp/index.mjs:787` to 793 (`now`, `digest`, `w`, `date`, `call`) [READ]. T01: the shell's parser of its own script address, run by the door to route [READ].
- **(c) Agreements held as text on both sides: N01, N03 to N13.** No symbol crosses; a change on one side is not seen by the other through an import.

## 4. The `CAPTURE_SCREEN` tie, both ends

- **Defined** at `screens-intake/capture.mjs:1403` `export const CAPTURE_SCREEN = Object.freeze({`, a screen spec with `id: "capture"`, `reads`, `render`, `parts` (27 functions, line 1407) and `acts` [READ]. The file imports nothing [MEASURED M2: its input has no import]. The file's owner is screens-capture (182), not screens-intake (183): `process/modules/screens-capture.json` `files` is `["bio-plane/src/screens-intake/capture.mjs"]` [READ].
- **Used in source** in three files only [MEASURED M8]: its own, `screens-intake/index.mjs:262` (in that module's `SCREENS`), and `cp/index.mjs:796` and `:797`.
- **What the two functions do** [READ]: `titleOf(cs, o)` (`capture.mjs:102`) answers a document's name from its reading's title, its file name, or its host and day. `promoteDocument(cs, o)` (`capture.mjs:144`) asks `cs.call("allocid", …)` (148), composes `bundle.md`, `data/provenance.json`, `data/dataset.json` and the register, and asks `cs.call("promote", …)` (205).
- **Where the door uses them**: only inside `deliverOwedRender` (`cp/index.mjs:743` to 835) [MEASURED M7]. Its kit answers `allocid` from `recordOf(ctx).allocId` (790) and `promote` from `promotionOf(ctx).promote` (791) [READ]: owner instances over the object's `ctx`, so the function works in the Durable Object, not in the Worker's request path.
- **Who calls `deliverOwedRender`**: `pl/store.mjs:41` `this.#assembled = assembleStore(ctx, env, { deliver: deliverOwedRender });` and nothing else in source [MEASURED M9, M12]. `store-assembly/assemble.mjs:498` hands `deliver` to `pendingOf`; `store-assembly/pending.mjs:720` and `:732` wrap it as `deps.deliver({ ctx, env, storeName: store(), ...a })` for the job kinds `subresources` (716) and `fetch` (728); acquisition calls it at `acquisition/index.mjs:2486` and `:2512` (`owedRun`, 2467) and `:2612` (`owedFetch`, 2574) [READ].
- **Is it the alarm?** `pl/store.mjs:76` `async alarm() { … await schedulerOf(this.ctx, this.env).alarm(); }`; `scheduler/index.mjs:595` `async alarm() { return await this.onAlarm(); }` and `:552` `r = await c.tick(now, rank, started)`; `store-assembly/assemble.mjs:580` `schedulerOf(ctx, env).register("plane", pending.consumer());` [READ]. So the comment the lane was told (`cp/index.mjs:38`, "the alarm's delivery of an owed render") is confirmed, and is narrower than the code: the same function also delivers an owed large fetch (`pending.mjs:728` to 733).
- A second and third composer of the same kind of bundle exist outside the UI: `cp/archive.mjs:38` `function filing(…)` and `store-door/pull.mjs:119` `pullAndFile` [READ]. Whether the three produce the same bundle is [NOT CHECKED]; a comparison of their outputs for one document would settle it.

## 5. The launcher (`plane`)

`process/modules/plane.json` `files`: `bio-plane/src/plane/`, `bio-plane/wrangler.jsonc`, `.gitignore`, `.dev.vars.example`, `DEPLOY.md`, `DEPLOY-DASHBOARD.md`, `SETUP.md`, `scripts/build-plane.mjs`, `dist/` [READ].

| file | lines / bytes | exports and what each does [READ] | direct imports [MEASURED M2] |
|---|---|---|---|
| `pl/index.mjs` | 71 / 4,102 | default `{ fetch, scheduled }` (71): `fetch` logs an upload's arrival, counts calls to the object and calls the door (64 to 69); `scheduled` calls `watchdog`. Re-exports `Store` (17). At load: `bindPublishedPlane({…})` (19) and `const door = makeFetch({ publicOp, gatedOp, publicInstanceGroup: … })` (22) | store-assembly (174, a bare `import "../store-assembly/index.mjs"` at line 7), control-plane (195), answer-envelope (170), public-read (121, `publication/worker.mjs`), instance-setup (166, `setup.mjs`), own three files |
| `pl/door.mjs` | 131 / 11,553 | `publicOp(ctx)` (41) and `gatedOp(ctx)` (70), below | instance-setup, signatures (11), record-grammar (3), public-read, publication (118), affordances (156), queue (164), provenance (51), attestation (52), bias (78), host-governor (49), doorbell (57), capture (56), monitoring (149), extraction (62), connections (68), ratification (125), op-declarations (168), store-assembly, answer-envelope, control-plane, runtime-limits (10) |
| `pl/store.mjs` | 105 / 8,346 | `class Store extends DurableObject` (27): constructor calls `assembleStore` (41); RPC methods `ask`, `draft`, `dispatchMemberRun`, `groupFields`, `watchdog`, `schedAlarmAt`; `alarm`, `onAlarm`; `fetch` runs `this.#assembled.dispatch(req)` (91). `OBJECT_TIMING_HEADER` (18) | `cloudflare:workers`, store-assembly, scheduler (152), ai-runs (98), public-read, control-plane |
| `pl/watchdog.mjs` | 45 / 3,065 | `watchdog(controller, env)` (37): asks the objects `bio` and `scratch` to `watchdog(at)`; `WATCHDOG_BOUND_MS`, `WATCHDOG_OBJECTS` | runtime-limits (`store-place.mjs`) |
| `pl/arrival.mjs` | 19 / 1,384 | `logArrival(req)` (14): one log line for a `captureupload`; `ARRIVAL_EVENT` | none |

Other files: `wrangler.jsonc` names `"main": "src/plane/index.mjs"` (11), binds `STORE` to class `Store` (21), two buckets, six services, a browser, one cron `*/5 * * * *` (146), `limits` (181); it has no `assets` or `site` key [READ; MEASURED by grep for `"assets"|"site"`]. `scripts/build-plane.mjs` imports `./fleet-bundle.mjs` (owner bundler, 12) [READ]. `dist/` holds the committed bundle, its manifest and `SECRETS.txt` [MEASURED `ls`]. The three `.md` files and `.gitignore` were not read.

**The hooks.** `makeFetch` reads three names from `hooks` and no other [MEASURED M6]:
- `publicOp` (`pl/door.mjs:41` to 67) asks in turn `publicReadDoorOp` (public-read), `publicationDoorOp` (publication), `doorbellPublicOp` (doorbell), then `bootstrapOp` (instance-setup) with a caller read by control-plane's `caseReader` [READ].
- `gatedOp` (`pl/door.mjs:70` to 131) routes to `askOp` and `actionDraftOp` (store-assembly's `index.mjs`, from `ask.mjs`, a store-services file), `affordancesOp`, `queueOp`, `registerAuditOp`, `instanceSetupOp`, `connectionsOp`, `governorOpResponse`, `captureOp` (whose `readAcquired` calls the door's `deferReading`, then `acquireReadingOp`), `extractionOp`, `pageTranscribeOp`, `attestOp`, `monitorOp`, and last `ratificationOp` for every other op [READ].
- `acquireBoundMs` is read at `cp/index.mjs:1554` and `:1673`; `pl/index.mjs` does not supply it [READ].
- `publicInstanceGroup` is supplied at `pl/index.mjs:23` and read nowhere in control-plane [MEASURED M6].

**What the plane takes from control-plane** [READ]: `pl/index.mjs:8` `makeFetch, PUBLISHED_STORE`; `pl/door.mjs:29` `SCRATCH, sha256Hex, caseReader, captureKey, storageAbsent`; `pl/store.mjs:12` `deliverOwedRender`. Eight names; `deliverOwedRender` is the one whose body uses the UI.

**Import chains to the UI** [MEASURED M2, M4]: `pl/index.mjs` (or `door.mjs`, or `store.mjs`) -> `cp/index.mjs` -> `interface-shell/index.mjs`, `interface-assets/index.mjs`, nine `screens-*/index.mjs`, `screens-intake/capture.mjs`; and `cp/index.mjs` -> `cp/app.mjs` -> `interface-shell/index.mjs`. The Durable Object class file reaches the UI by its one import of `deliverOwedRender`.

## 6. What else fixes their place in the order

**Modules 176 to 194 referenced by code.** control-plane: by import, directly 12 (interface-assets 176, interface-shell 177, screens-entry 178, screens-wizards 179, screens-settings 181, screens-capture 182, screens-intake 183, screens-daily 185, screens-inquiry 188, screens-investigate 190, screens-publish 192, screens-action 194) and through them all 19 [MEASURED M2]; by text, the addresses and names of 3b. plane: by import none directly, all 19 through control-plane [MEASURED M4]; by a listing, N13.

**The latest non-UI module each part of the door references** [MEASURED M3 for files; READ for the symbols of `index.mjs`, whose import lines are 9 to 95]:

| part | latest non-UI module it references |
|---|---|
| `cp/index.mjs` as a whole | store-request (175): `innerRequest`, `promotedTypeOf`, `BODY_STAMPS`, `ACT_CLOCK_OPS`, `CASE_IMPORT_ACTIONS` (92), `agentPackOp`, `airunDispatchOp`, `draftCheckOp` (93) |
| its subscription sign-in, trace and member ref (rows F, L) | signin-door (172), line 68 |
| its envelope, relays and page policy (A, E) | answer-envelope (170), line 25 |
| its gates and admission (D) | admission (169), lines 15, 21, 22 |
| its routing tables (B) | op-declarations (168), lines 87, 90 |
| its group reads and the logo (C, E) | instance-setup (166), line 78 |
| `cp/draft.mjs` | wizard-scripts (154) |
| `cp/jobs.mjs` | answer-envelope (170) |
| `cp/archive.mjs` | promotion (48) |
| `cp/reading-gate.mjs` | odf-reader (19) |
| `cp/storage-words.mjs` | setup-words (2) |
| `cp/app.mjs` (less its line 21), `words-cache.mjs`, `phase-clock.mjs`, `job-state.mjs` | none |
| the page route's own non-UI inputs (C) | answer-envelope (170) for `json` (973); admission (169) for the two gates; instance-setup (166) for the logo; ai-runs (98) for `testInstance` |
| `deliverOwedRender` (I), less the two screen functions | extraction (62) and `cp/jobs.mjs`, so answer-envelope (170) |
| plane's `index.mjs`, `door.mjs`, `store.mjs`, less control-plane | store-assembly (174) |
| plane's `watchdog.mjs` / `arrival.mjs` | runtime-limits (10) / none |

control-plane's code does not import store-door (171), store-services (173) or store-assembly (174) [MEASURED M3].

**A start-order tie that is not an import.** `pl/index.mjs:7` imports store-assembly first, "before control-plane reads the op tables when it loads" (a comment, a lead). The code: `store-assembly/register.mjs` calls `assembleDeclaredOps()` at load; `op-declarations/index.mjs:2897` `if (loaded) throw new TypeError(… "registered after the first read (R81)")`; `cp/index.mjs:381` spreads `TEMPLATE_DOOR_ACTIONS` at load [READ]. INFERENCE from these three: the tables the door and interface-shell (`interface-shell/index.mjs:10` imports `OPS, NEEDS, SESSION_OPS`) read are completed by store-assembly's registration, which today only the launcher's entry triggers; running the start with the import moved would settle whether any file must precede it.

**Module records, not code** [READ, M14]: `control-plane.json` `uses` names store-door, store-services and store-assembly, which its code does not import; `tests` lists 5 files under `bio-plane/test/m/interface-shell/`. `plane.json` `uses` names 13 UI modules, which its code does not import directly; `tests` lists 18 files under `test/m/interface-*` or `test/m/screens-*`. 13 of the 19 UI records name `store-request` in `uses` and 2 name `answer-envelope`, which UI code does not import [MEASURED M5]. INFERENCE: these come from tests; the lane's test map (`02-test-map.md`) or a trace of the test files would settle it.

## 7. The reverse direction: what UI code assumes of the door

No import [MEASURED M5]. The agreements found, with both sides [READ at each line; presence per file MEASURED M11]:

| what | UI side | door side |
|---|---|---|
| the API address and op parameter | `interface-shell/browser.mjs:150` `qs.set("op", op);` `:160` `win.fetch("/api/?" + qs.toString(), init)` | `cp/index.mjs:1008` `url.pathname.replace(/^\/api\/?/, "/")`, `:1009` |
| the credential header | `browser.mjs:155` `init.headers.Authorization = "Bearer " + …` | `admission/index.mjs:358` `req.headers.get("authorization")`, called at `cp/index.mjs:937` |
| `background=1` | `browser.mjs:153` | `cp/index.mjs:942` |
| `/version` | `browser.mjs:1939` `win.fetch("/version", { cache: "no-store" })` | `cp/index.mjs:957` |
| `/app` and below | `browser.mjs:1115`, `:1122` | `cp/app.mjs:23`, `:33` |
| `/app/assets/<name>` | `interface-shell/index.mjs:53`; `interface-assets/index.mjs:11` (15 font addresses); two screens files | `cp/app.mjs:24`, `:92` |
| `/app/assets/group-logo` | `screens-entry/front.mjs:35` | `cp/app.mjs:108`, `cp/index.mjs:988` |
| `/app/shell-<version>.js` | `interface-shell/index.mjs:559` `scriptPath`, `:604` | `cp/app.mjs:32`, `:53` through the shell's own parser (T01) |
| `/doorbell`, `/tour` | `interface-shell/index.mjs:172`, `browser.mjs:1119`; links at `screens-entry/front.mjs:72`, `:73`, `tour.mjs:22` | `cp/app.mjs:67` |
| any other address draws `unavailable` | `browser.mjs:1120` | `cp/app.mjs:75` answers status 404 with the same page |
| the words key `v` and `cs-version` | `interface-shell/index.mjs:596`; `browser.mjs:2760` to 2764, `:2777` | `cp/words-cache.mjs:87` to 91; `cp/index.mjs:163` |
| a locked session is `401` with `SESSION_LOCKED` | `browser.mjs:162` to 166 | admission's refusal, relayed at `cp/index.mjs:1264` |
| `trace` in an answer | `browser.mjs:341` | `cp/index.mjs:176` |
| `tokenClass` in an answer | `browser.mjs:229` `ME.tokenClass === "admin"` | `cp/index.mjs:1302` and the forward's `tokenClass: cls` (2177) |
| `kept` on `ACQUIRE_TIMED_OUT`; `job` on `reading` | `screens-intake/capture.mjs:1414`; `:858`, `:1279` | `cp/index.mjs:1567`; `:2085` |
| the credit link | `browser.mjs:1430` `href="/api/?op=credit"` | `public-read/door.mjs:207`, reached through `hooks.publicOp` |
| a streamed `ask` (`ndjson`) | `browser.mjs:177` | `cp/index.mjs:576` `watchedAsk` passes the plane's stream on |

Op names: screens name ops in their specs and the shell lists `SHELL_OPS` (`interface-shell/index.mjs:223`); both the UI and the door read op-declarations (168) for what an op is (`interface-shell/index.mjs:10`, `cp/index.mjs:87`) [READ]. The answer-field rows are a sample: 20 field, code or parameter names that the door's code writes or reads, picked by me while reading `cp/index.mjs`, were grepped in the 130 comment-free UI files; 9 appear there (`reading_pending`, `kept`, `job`, `trace`, `tokenClass`, `not_promoted`, `words_version`, `ACQUIRE_TIMED_OUT`, `background`), 11 do not [MEASURED]. A name's presence in a UI file does not by itself show it is the door's field; the rows of the table are the ones read on both sides. A full list of the fields the door adds to answers was not made.

## 8. The modules near the door

- **admission (169).** `admission/index.mjs:1` to 9: the gates of who may call an op, "Copied from `control-plane/index.mjs` at the control-plane split" (a comment, a lead). Code: it exports `namespaceGate` (189), `presentedCredential` (355), `credentialAddressGate` (384), `classify` (445), `admit` (905), `bearerFence` (1084), `readerOf` (1153), `doorWindowGate` (1391), `securityTally` (1487) and others [READ]; the door calls them in section 2's rows C, D, E, L. Its importers in `bio-plane/src`: `cp/index.mjs`, `store-request/index.mjs`, `store-assembly/assemble.mjs`, `answer-envelope/families.mjs` [MEASURED `grep -rl`]. In function it is the door's admission step.
- **answer-envelope (170).** Exports `json`, `doAnswer`, `storeRefusal`, `storeSilent`, `relayAnswer`, `planeInternalError`, `withPagePolicy`, the row readers and `CHECK_FAMILIES` (`answer-envelope/index.mjs:527`) [READ]. Importers: both control-plane files that answer, `pl/door.mjs`, `pl/index.mjs`, signin-door, `store-door/dispatch.mjs`, `store-request/door-ops.mjs` [MEASURED]. It is the shape of every answer, used on both sides of the hop to the object; it also holds the page policy and its own `NONCE_SLOT = "__CSP_NONCE__"` (62), the same literal as `interface-shell/index.mjs:44`, with no import between them [READ]. Part of the door in function for the Worker's answers; AMBIGUOUS as a whole, because the object's door uses it too.
- **store-door (171).** `store-door/dispatch.mjs:374` `export async function dispatch(req, store)`: the one frame of every request inside the Durable Object, with `controlPlaneRoutes` (444), `pullAndFile` (`pull.mjs:119`) and `promotionStep` (`step.mjs:17`) [READ]. Imported only by store-assembly (`assemble.mjs:102`, `:103`, `declarations.mjs:92`) [MEASURED]; control-plane's code does not import it [MEASURED M3]. It is a door, but the object's inner one, behind the hop, not the HTTP front door.
- **signin-door (172).** A member's own Claude subscription sign-in relayed to agent-worker: `subscriptionSignin` (151), `subscriptionDisconnect` (254), `signintrace` (273), `tokenRefusedSeen` (263), `leaverOf` (230), `signoutLeaver` (242), `mintTrace` (90), `memberRefOf` (96) [READ]. The door calls these at `cp/index.mjs:1464`, `:1468`, `:1472`, `:581`, `:2061`, `:2062`, `:1488`, `:1489` [READ]. Its `ops.mjs` is a store-internal map imported by store-assembly [MEASURED]. Its Worker half is a door arm; it is not the member's sign-in to the record.
- **store-request (175).** `store-request/index.mjs:132` `export function innerRequest(args = {})`: makes the request the store is asked from the admitted caller and the page's request; `door-ops.mjs` holds three door arms (`agentPackOp` 35, `airunDispatchOp` 49, `draftCheckOp` 72) [READ]. Its only importer in `bio-plane/src` is `cp/index.mjs` [MEASURED]. Its header says it was "Split by copy from `control-plane`'s door" (a comment, a lead). In function it is part of the front door, and it is the module that fixes the door's lowest possible place by imports.

## 9. Requirements about the UI in `process/modules/control-plane.md` (leads only)

Found by `grep -n -o -E "^- \*\*R[0-9]+\*\* …" | grep -i -E "interface|screen|page|asset|words|shell|script|html|/app|logo|guide|favicon"`, then read for subject. R1 (`GET /` answers the interface's page). R75 (`/app`, the page policy by script hash, the versioned script, assets). R81 (the nine screen modules' `SCREENS`). R82 (`/` answers `interfacePage`). R84 (`/app/assets/group-logo`). R95 (`testInstance` to the page). R99 (words by key; its key list is in `docs/development/ux-substrate/screens/words-reads.json`). R101 (`/favicon.ico`). R104 (an unknown address draws the public page; `/doorbell`, `/tour`). R109 (no signing page). R116 and R127 (`interfacewords` cached; the `v` key). R122 (the page asks `bootstrap` once per load; its text says the shell's side is met by interface-shell). R124 (the owed render, "as the capture screen promotes"). R126 (the `control-plane.page` log line). R83 names `background=1` and R93 the trace the shell shows. R75's text says "the four screen modules" and R81 "nine"; the code imports nine (3a).

## After a change

Not a design; the inversion each tie plainly allows.

- T02 to T16, N02, N04: `makeFetch` already takes `hooks`; the page builder, script source, script hash, asset table, public addresses and work counter could arrive there, as `appPage`, `appScript` and `appAsset` already take them as arguments. The door would then import no screens module.
- T01, N01, N03, N05: an address or key format with one owner. If the UI may depend on the door, the door could own `/app`, `/app/assets/`, the script address and the `v` format, and the shell import them.
- T17: the object needs a title rule and a bundle composer callable with a five-function kit. The page carries each screen function as its source text (`interface-shell/index.mjs:298` `const src = v.toString();`, used at `:532`) [READ], so a screen function cannot lean on an import; either they are handed to `assembleStore` as `deliver` is now, or a composer below the door is used (4's last point).
- N08: `storage-words.mjs` holds only a screen's sentences; nothing in the Worker imports it.
- INFERENCE from M12 and M13: the bundle is cut from `src/plane/index.mjs` and holds only what that file reaches. If no door or launcher file imports the UI, the UI is in the bundle only if the file named by `main` and `PLANE_ENTRY` is, or imports, a file at or above the UI. A trial build with the UI imports removed would show what leaves the bundle.

## What I did not check

- Tests: no test file was traced, so nothing here says what a move does to the tests the two modules own or to the UI tests they own.
- The `uses` inference in section 6, and whether any test pins `PUBLIC_ALIASES` to `PUBLIC_ADDRESSES` or the two `PROV_EMBED_MAX` values together.
- `process/modules/plane.md` and the other modules' requirement files; section 9 read control-plane's only, by a word filter, so a UI requirement worded otherwise is missed.
- Whether the committed bundle's bytes match the tree. Its manifest's inputs differ from the live closure of `pl/index.mjs` by one file, `src/screens-action/words-fix-flaws.mjs`, in the tree and not in the manifest [MEASURED: set difference of M13's inputs and M2's closure, paths normalised].
- The scheduler's internals beyond the three lines quoted in section 4, and `ratificationOp`'s answer for an op it does not serve.
- The op tables' `lazy` reader: that the spread at `cp/index.mjs:381` counts as the "first read" was not run.
- A complete list of answer fields the door adds; section 7's list is a sample of 20 names.
- Whether the three bundle composers of section 4 agree.
- Nothing was run: no test, no build, no Worker. Every [MEASURED] is a static command over the files.
- plane's `DEPLOY.md`, `DEPLOY-DASHBOARD.md`, `SETUP.md`, `.gitignore`, and the 28 MB bundle's text.
