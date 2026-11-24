Length: 294 lines. Last section: "What I did not check".

# Plane scope research 23: trial of the arm routing placed below the front door

Written 24 Nov 2026 by a worker of the plane-scope lane. It decides nothing. Everything below describes scratch copies of `a26a8da2`, not the product. Every claim carries one tag: [MEASURED] a command showed it, [READ] the code at the line named, [NOT CHECKED]. An inference is marked INFERENCE. `src/` is `bio-plane/src/`, `T/` is `bio-plane/test/m/`. Order numbers are the base's (store-request 175, control-plane 195, plane 196) unless a variant's own order is named. Raw rows: `trial-routing/results.json`. Patches: `trial-routing/n.patch`, `s.patch`, `c.patch`, and two I added, `n2.patch` and `s2.patch` (headline 4).

## Headline answers

The question: can the arm routing and the four helpers live before (or in) control-plane, with every test still passing, so that control-plane's own tests run over the real routing?

1. **N and S as the brief specifies them: no.** With the routing and the four helpers in one file that `control-plane/index.mjs` imports, every `p4 check` answers as on base (plane's same 48 lines, no disagreement elsewhere) and the three moved sample tests pass over the real routing. But control-plane's whole set fails: 76 of its 98 test files stop at load with `TypeError: op-declarations: adminendorse: a second registration (R81)`; the other 22 files pass 117 tests (base: 564 of 564). plane's `r8-timing-hook` loses 1 of its 3 tests. [MEASURED, sections 2 and 3] Cause: the routing imports `store-assembly/index.mjs`, whose load registers every owner's op declarations. control-plane's load now reaches it, after control-plane's test harness has registered them itself. [READ and MEASURED, section 2]
2. **S also fails a test of its own holder, in either shape.** store-request's `census.test.mjs:29` pins the modules its source imports to eight names. The routing adds 19 more. 1 of store-request's 120 tests fails. [MEASURED, section 3]
3. **C: yes, once two uses are declared.** `plane/door.mjs` moved to `src/control-plane/routing.mjs`, the helpers left where they are. control-plane's whole set passes 569 of 569 (base's 564 and the 5 moved tests). `p4 check control-plane` first refused two undeclared imports of the routing, host-governor and ratification; with both added to `control-plane.json` it found no disagreement. [MEASURED, section 4]
4. **N2, a shape I added: yes.** N2 is N with the four helpers in a second file of the new module (`door-routing/helpers.mjs`). control-plane imports that file; the routing imports the helpers from it. control-plane's whole set passes 569 of 569, the checks answer as on base (door-routing's own finds no disagreement), and plane's own folder runs as it does on base. I added N2 because the failure in 1 comes from the one-file shape, not from where the module sits. The brief's N is kept as specified, with its failure, in `n.patch`. S2 is the same split inside store-request; it passes control-plane's set and fails the census of 2. [MEASURED, section 5]
5. **control-plane's tests over the real routing.** Three plane-held tests were moved to control-plane: `walk-people-door` (arm `knock`, through `publicOp`), `walk-tasks-filed-project` (arm `acquire`, through `gatedOp`), `walk10b-docket` (the published-case chain: `casedocument`, `caseratify`). Every assertion keeps its text and value. In each variant each passes in Node in 1.5 to 2.2 s (18 to 23 s over plane on base). A run-time trace shows 867 or 868 files loaded or read, the latest owner control-plane, none later. Four one-line mutations of the moved routing each turn the moved test red. [MEASURED, section 6]
6. **The check refused the test kit once, in every variant.** `real-kit.mjs:12` imports `src/screens-publish/parts.mjs`, which screens-public (191) owns and control-plane does not declare. With `screens-public` added to `control-plane.json` the check passed. That use comes from the test kit, not from the placement. [MEASURED, section 6]
7. **The UI.** In N, N2, S and S2 the moved routing's import closure holds no UI file (707 or 708 files, 164 modules). In C it holds 130 UI files of 19 UI modules, through its import of `control-plane/index.mjs`, as `plane/door.mjs` does on base. [MEASURED, section 7]
8. **Build.** `npm --prefix bio-plane run build` succeeds on base and on every variant. The bundle is 28,418,158 bytes in each. The inputs are 853 on base, N, S and C, and 854 on N2 and S2. [MEASURED, section 7]
9. **A lead in the brief did not hold.** Base's `p4 check plane` reports 48 disagreements: 23 are in `agent-worker/test/harness.test.mjs` and 25 are in nine other files. They are not all in agent-worker's harness test. In every variant the 48 lines are the same as base's. [MEASURED, section 1]

## Method

- Scratch worktrees of `a26a8da2` under `…/scratchpad/trial-routing/`: `base`, `n`, `s`, `c`, `n2`, `s2`, and a `proof-*` tree for each patch. Each `node_modules` (agent-runner, bio-plane, file-scanner, newgroup, ocr-worker, pdf-worker, sheet-worker) is linked from the main checkout. Node v26.10.0, 4 CPUs. One heavy run at a time. `/proc/loadavg` was read before and after each run; the 1-minute figure at those readings was between 0.13 and 2.98. All worktrees were removed at the end.
- The tool: `node /root/process4/0eec86fd…/tool/p4.mjs check <module>`, run inside the worktree. A module's whole set: the tool's own `loadModules`, `testFiles` and `runTests` on the working tree (`runmod.mjs`), as research 07 and 22b ran it. `runTests` runs the check, then one `node --import ./bio-plane/test/platform-sqlite.mjs --test <files>`. No command reached GitHub.
- Token variables (`GH_TOKEN`, `GITHUB_TOKEN`, the two `ACTIONS_*`, `NODE_TEST_CONTEXT`) were removed from every run.
- Ownership and order: the tool's `ownerOf` over each tree's own records.
- Traces: `research/tools/trace.mjs` as a preload (`NODE_OPTIONS=--import=…`, `GRAPH_TRACE_ROOT` the tree). It records each module Node loads and each path given to `fs` reads, listings and stats, in the process and its children. Reads inside workerd are not recorded; Miniflare's own reads of the modules it hands workerd are. The listing hook works: on base it recorded 549 listed paths for `r49-case-inputs-public` and 2 for `sa-assembly`.
- Each variant was built by a script (`build-variant.mjs`: code and records; `apply-tests.mjs`: tests), so the moved text is cut and pasted by a program, not retyped. The scripts are in the scratchpad and can be cleared; the patches hold their result.
- Each patch is `git add -N .` then `git diff a26a8da2`. On a second clean worktree `git apply --check` and `git apply` exit 0 with no output, the applied tree equals the variant's tree file by file, and the three sample tests pass there. [MEASURED for all five patches]
- **Where the brief was not followed as written.** (1) N2 and S2 and their two patches are additions. (2) plane's folder of 55 files was not run on N and S, which fail outright; it was run on N2 and C. (3) Besides `real-door.mjs` with real hooks, a second helper, `real-kit.mjs`, was written so that the three test bodies could stay as they are. (4) Two facts the brief gave as leads measured differently: its grep lists 18 files, not 17, and base's 48 plane disagreements are not all in agent-worker's harness test (headline 9). (5) N's first four checks ran before its test files were changed; they are kept in `results.json` as `codeonly-…`, and every check quoted here ran on the variant's final state.

## 1. Facts on the base

### (a) What `src/plane/door.mjs` imports

[MEASURED: `facts.mjs`, the TypeScript parser over the file, owner by `ownerOf`] 22 import statements, no dynamic import and no `require`. Owners by order, with the importing line:

record-grammar 3 (`:7`), runtime-limits 10 (`store-place.mjs`, `:30`), signatures 11 (`sshsig.mjs`, `:6`), host-governor 49 (`:15`), provenance 51 (`:12`), attestation 52 (`:13`), capture 56 (`:18`), doorbell 57 (`:17`), extraction 62 (`:20`), connections 68 (`:21`), bias 78 (`:14`), publication 118 (`:9`), public-read 121 (`:8`), ratification 125 (`:22`), monitoring 149 (`:19`), affordances 156 (`:10`), queue 164 (`:11`), instance-setup 166 (`setup.mjs`, `:5`), op-declarations 168 (`:23`), answer-envelope 170 (`:27`), store-assembly 174 (`:24`), control-plane 195 (`:29`).

**The highest is control-plane (195)**, by one line: `:29` `import { SCRATCH, sha256Hex, caseReader, captureKey, storageAbsent } from "../control-plane/index.mjs";` [READ]. Without that line the highest is store-assembly (174), one place before store-request.

### (b) What the four helpers refer to, inside `src/control-plane/index.mjs`

[MEASURED: `facts.mjs`, every identifier in each declaration that is not a parameter, a local or a property name, looked up among the file's top-level names]

| helper | lines (with its comments) | refers to |
|---|---|---|
| `sha256Hex` | 250-262 | `crypto`, `TextEncoder`, `Uint8Array` (globals); no import |
| `caseReader` | 407-425 | `readerOf` (admission, 169), `doAnswer` (answer-envelope, 170) |
| `captureKey` | 427-431 | nothing |
| `storageAbsent` | 433-450 | `evidenceStorageAbsent` (acquisition, 55), `json` (answer-envelope, 170) |

So the four reach admission, answer-envelope and acquisition, all before store-request. No other name of `index.mjs` is used by them. `SCRATCH` is admission's, re-exported at `index.mjs:2184` [READ]. Inside `index.mjs` the door itself calls `sha256Hex` (`:355`, `:787`), `caseReader` (`:455`, `:467`, `:1119`, `:1133`, `:1211`, `:1224`) and `captureKey` (`:512`, `:718`); `storageAbsent` is only declared and exported. After the helpers are cut out, `readerOf` and `evidenceStorageAbsent` have no other use in `index.mjs` [MEASURED: `grep -n`; the remaining matches are comments].

### (c) Who refers to the routing

[MEASURED: `facts.mjs` over the 18,443 tracked files; two bundles over 12 MB were not read (`bio-plane/dist/bio-plane.bundled.mjs`, `release/bio-plane.bundled.mjs`). It finds the text `plane/door.mjs`, every import of the file, every import of `publicOp` or `gatedOp`, and every import of a helper from `control-plane/index.mjs`. For a `.mjs` file the parser says whether a match sits in a comment, a string or code.]

The brief's `grep -rn "plane/door\.mjs" bio-plane agent-worker process/modules` lists 18 files here, not 17: 17 under `bio-plane/` and `process/modules/store-request.md`. Outside `build/` and `process/lanes/` there are 20 files with a hit:

| file:line | owner | how | a reference under rule 7? |
|---|---|---|---|
| `src/plane/index.mjs:13` | plane (196) | static import of `publicOp`, `gatedOp` | yes |
| `src/plane/door.mjs:29` | plane (196) | static import of the four helpers and `SCRATCH` from control-plane | yes (of control-plane) |
| `T/plane/fix4-defer:12`, `g83-location:20`, `t42:31`, `t44:8`, `t45:50` | plane (196) | static import | yes |
| `T/plane/body:10`, `split:8` | plane (196) | `await import("…/plane/door.mjs")` | yes |
| `T/plane/r8-timing-hook:40`, `:98` | plane (196) | the path as text inside a script handed to a child `node -e`, which imports it; `:94-96` also stands in for control-plane's `caseReader` by a module mock | yes |
| `bio-plane/dist/bio-plane.bundle.json:2611` | plane (196) | the built bundle's list of inputs, with the file's size and sha256 | a build output; it goes stale when the file moves |
| `src/attestation/ops.mjs:5`, `src/extraction/ops.mjs:10`, `src/monitoring/index.mjs:3884` | attestation (52), extraction (62), monitoring (149) | comment | no |
| `T/extraction/relays.test.mjs:5`, `T/ratification/relays.test.mjs:7`, `T/store-assembly/round6-extraction.test.mjs:70`, `T/control-plane/r49-case-inputs-public.test.mjs:18` | extraction, ratification (125), store-assembly (174), control-plane (195) | comment | no |
| `T/store-request/door.mjs:8`, `:362`, `:438`, `:474` | store-request (175) | comment | no |
| `process/modules/store-request.md:42`, `:56`, `:57` | none | requirement text | no (a document) |

Under `build/` 69 files and under `process/lanes/` 1 file name the path; all 110 hits are text in `.md` or `.txt` files [MEASURED]. So **every earlier module's naming of `plane/door.mjs` is a comment**. No file outside plane imports it, and no file other than `plane/door.mjs` imports a helper from control-plane by name.

Three references that do not name the path [READ, then MEASURED by trace]:
- `T/store-assembly/sa-assembly.test.mjs:250-252` (store-assembly, 174) lists `src/plane` and reads every `.mjs` in it: `for (const f of readdirSync(planeSrc).filter((x) => x.endsWith(".mjs")))`. On base the trace shows it read five plane files, `door.mjs` among them. This is a real reference from an earlier module's test to plane's routing file. After the move the test reads four files and no longer looks at the routing's imports of store-assembly.
- control-plane's own tests reach the helpers through the harness: `T/control-plane/harness.mjs:22` spreads `control-plane/index.mjs` into `M`, and `converts.test.mjs:118-119`, `door-share.test.mjs:90`, `envelope.test.mjs:367` and `t42-door.test.mjs:35` call `M.sha256Hex`, `M.caseReader` or `M.storageAbsent`. They keep working when control-plane keeps exporting the four.
- test-support's collector (`bio-plane/test/declared-ops.mjs:98-135`) reads every source file of each module up to a bound, so it reads the routing wherever it lives once the bound is at or after its holder. On base `r49-case-inputs-public` (bound control-plane) did not read `plane/door.mjs`; on N2 and C it read the routing's new file.

Other requirement texts name plane's `door.mjs` without the folder: `process/modules/plane.md:51` (R112), `answer-envelope.md:54`, `store-assembly.md:104` (R98) [MEASURED: `git grep`]. They are documents.

**Base's checks** [MEASURED]: `p4 check control-plane` and `p4 check store-request` find no disagreement. `p4 check plane` finds 48: `agent-worker/test/harness.test.mjs` 23, `T/plane/r10-reading-ended.test.mjs` 12, `T/plane/t50.test.mjs` 3, `bio-plane/scripts/build-plane.mjs` 2, `T/control-plane/r8-caseratify-calls.test.mjs` 2, `T/plane/g55-alarm-l-entry.mjs` 2, and one each in `src/plane/index.mjs:67`, `T/plane/g83-location.test.mjs:50`, `T/screens-inquiry/r10-stated.test.mjs:168`, `T/screens-intake/r10-refused-kind.test.mjs:30`.

## 2. Variant N, as specified: a new module after store-request, one file

**What changed** [MEASURED: `git diff --numstat --no-renames a26a8da2`; READ in the scratch tree]:
- New `src/door-routing/index.mjs`, 193 lines. It is `plane/door.mjs` as it stands, with line 29 replaced by `import { SCRATCH, readerOf } from "../admission/index.mjs";` and `import { evidenceStorageAbsent } from "../acquisition/index.mjs";`, the four helpers pasted after the imports with their comments and JSDoc, and a last line `export { sha256Hex, caseReader, captureKey, storageAbsent };`. `plane/door.mjs` is deleted. Its comments were not re-worded: the header still says "plane R6" and one comment still says the helpers "stay control-plane's".
- `control-plane/index.mjs`, 4 lines in, 61 out: the four declarations are gone, `import { sha256Hex, caseReader, captureKey, storageAbsent } from "../door-routing/index.mjs";` is in, `evidenceStorageAbsent` and `readerOf` are dropped from its import lists. Its export line is unchanged, so its importers do not change.
- `plane/index.mjs`, 1 line: `import { publicOp, gatedOp } from "../door-routing/index.mjs";`.
- Records: `order.txt` gains `door-routing` after `store-request` (205 modules; control-plane becomes 196, plane 197). New `door-routing.json`, 35 lines: `files` the folder, `tests` empty, `public` the index, 23 `uses`. `control-plane.json` gains `door-routing` (and `screens-public`, section 6). `plane.json` gains `door-routing` and loses the three moved test lines.
- Tests: 8 plane test files re-pointed (7 by the path alone, 1 line each; `r8-timing-hook`, 4 lines), the 3 samples and 2 new helpers (section 6).
- No requirements file was needed. `p4 check door-routing` passes without `process/modules/door-routing.md` and with no test.

**Runs** [MEASURED]. Load is the 1-minute figure before / after.

| run | result | wall | load |
|---|---|---|---|
| `p4 check door-routing` | no disagreement found | 4.0 s | 1.23 / 1.23 |
| `p4 check control-plane`, first | 1 disagreement, the kit's (section 6) | 30.6 s | 1.23 / 1.30 |
| `p4 check control-plane`, `screens-public` declared | no disagreement found | 31.4 s | 0.99 / 1.00 |
| `p4 check plane` | 48 disagreements, the same 48 lines as base (`diff` of the lines that are not "cannot tell" is empty) | 31.8 s | 1.30 / 1.41 |
| `p4 check store-request` | no disagreement found | 24.4 s | 1.41 / 1.50 |
| control-plane's whole set, 98 files | **tests 193, pass 117, fail 76; exit 1** | 99.7 s (`node --test`), 131 s with the check | 0.65 / 2.30 |
| the 8 plane tests that import the routing, each alone, traced | 7 files pass; **`r8-timing-hook` 2 of 3**; 31 of 32 tests | 169.3 s | 0.47 / 2.49 |
| 6 other test files of 1(c), each alone, traced | 5 pass; `r49-case-inputs-public` 0 of 1, the same R81 stop | 28.1 s | 2.49 / 1.90 |
| the three samples, moved, each alone | 2 of 2, 1 of 1, 2 of 2 | 1.7 s, 1.6 s, 1.9 s | 1.50 / 1.46 |
| `npm --prefix bio-plane run build` | exit 0; 28,418,158 bytes; 853 inputs | 2.3 s | 1.25 / 1.47 |

**The failure, as printed** (76 times, once for each failing file):

```
TypeError: op-declarations: adminendorse: a second registration (R81)
    at registerDeclaredOps (…/n/bio-plane/src/op-declarations/index.mjs:2898:25)
    at assembleDeclaredOps (…/n/bio-plane/src/store-assembly/declarations.mjs:199:38)
    at …/n/bio-plane/src/store-assembly/register.mjs:8:1
    at async …/n/bio-plane/test/m/control-plane/harness.mjs:22:85
```

Why [READ]: `harness.mjs:7` imports `./register-declared.mjs`, which registers every owner's declarations through test-support's collector. `harness.mjs:22` then loads `control-plane/index.mjs`. In N that file imports the routing. The routing's line 24 imports `store-assembly/index.mjs`. `store-assembly/assemble.mjs:11` imports `./register.mjs`, which calls `assembleDeclaredOps()` at its line 8. op-declarations refuses a second registration (`index.mjs:2898`). [MEASURED: `closure.mjs`, static and literal dynamic imports followed] On base control-plane's import closure is 761 files and does not hold `store-assembly/index.mjs`. In N and S it is 849 files and does.

`r8-timing-hook` test 1 fails for the same new edge: `each handler was reached once`, actual `[]`. Its child script loads plane's fixture, then installs module mocks for five handler files, then imports the routing (`:21-40`). The fixture loads control-plane. In N that has already loaded the routing with the real handlers, so the stand-ins are never reached. [READ and MEASURED]

Test 3 of that file stands in for `caseReader` by a module mock of `control-plane/index.mjs` (`:94-96`). With `caseReader` in the routing's own file a module mock cannot replace it for `publicOp`. [MEASURED on N] With only the paths re-pointed and the stand-in left there, test 3 fails as well (1 of 3 pass): `publicOp` calls the `caseReader` of its own file, which a mock of another module does not replace. So in N and S the stand-in was moved to what `caseReader` wraps, admission's `readerOf`, and test 3 passes. This is a change to the test's stand-in point, not only to a path.

Not run on N, because it fails outright: plane's own folder of 55 files (run on N2 and C instead).

## 3. Variant S, as specified: the same file inside store-request

**What changed**: the same 193-line file as `src/store-request/routing.mjs`. `control-plane/index.mjs` and `plane/index.mjs` import from it. No new module and no change to `order.txt`. `store-request.json` is unchanged: the check did not ask for the file in `public`, and all 23 modules the file imports were already in store-request's `uses`. `control-plane.json` gains only `screens-public`; `plane.json` loses the three test lines. The tests are N's, with the path changed. [MEASURED]

**Runs** [MEASURED]:

| run | result | wall | load |
|---|---|---|---|
| `p4 check control-plane` | no disagreement found | 30.2 s | 0.59 / 0.75 |
| `p4 check plane` | 48, the same 48 lines as base | 34.3 s | 0.75 / 0.86 |
| `p4 check store-request` | no disagreement found | 23.9 s | 0.86 / 0.99 |
| control-plane's whole set, 98 files | **tests 193, pass 117, fail 76; exit 1**: the same R81 stop, 76 times | 96.7 s, 128.5 s with the check | 2.11 / 2.98 |
| store-request's whole set, 23 files | **tests 120, pass 117, fail 1, todo 2; exit 1** | 104.3 s, 127.2 s with the check | 2.98 / 0.81 |
| the 8 plane tests that import the routing, each alone, traced | 7 pass; `r8-timing-hook` 2 of 3, as in N | 171.9 s | 1.56 / 2.11 |
| the three samples, moved, each alone | 2 of 2, 1 of 1, 2 of 2 | 1.8 s, 1.9 s, 1.9 s | 0.99 / 0.99 |
| build | exit 0; 28,418,158 bytes; 853 inputs | 2.4 s | 1.47 / 1.47 |

**The holder's own failure**: `T/store-request/census.test.mjs:29`, "R21: store-request imports only modules earlier than itself in build/modules.json, and no module of the platform". It lists the `.mjs` files directly in `src/store-request/`, takes each one's imports, and ends (`:40`) with `assert.deepEqual([...], ["admission", "answer-envelope", "op-declarations", "record-grammar", "setup-words", "signin-door", "skills", "subresources"])` [READ]. With the routing in the folder the actual list holds 19 more: acquisition, affordances, attestation, bias, capture, connections, doorbell, extraction, host-governor, instance-setup, monitoring, provenance, public-read, publication, queue, ratification, runtime-limits, signatures, store-assembly [MEASURED, the run's diff]. Its earlier assertions pass: every one of them is earlier than store-request. So the routing breaks no order rule there; it breaks the pinned list of store-request R21 (`process/modules/store-request.md:61`). The test's listing is not recursive (`readdirSync(SRC)`), so a file in a sub-folder would not be seen by it; that was not tried.

## 4. Variant C: the routing inside control-plane

**What changed** [MEASURED and READ]: `src/control-plane/routing.mjs`, 131 lines, is `plane/door.mjs` with one line changed: line 29 imports the same five names from `"./index.mjs"`. git reads it as a rename at 99 % similarity. `control-plane/index.mjs` is not touched. `plane/index.mjs`, 1 line: `import { publicOp, gatedOp } from "../control-plane/routing.mjs";`. Records: `control-plane.json` gains `host-governor` and `ratification` (the check asked) and `screens-public` (the kit); `plane.json` loses the three test lines; no order change. The check did not ask for `routing.mjs` in `public`. Tests as in N by the path alone; in `r8-timing-hook` only the two path lines change, because the routing still imports `caseReader` from `control-plane/index.mjs` and the test's module mock still reaches it.

**Runs** [MEASURED]:

| run | result | wall | load |
|---|---|---|---|
| `p4 check control-plane`, first | **2 disagreements**: `routing.mjs:15` "imports host-governor, which process/modules/control-plane.json does not declare in uses"; `routing.mjs:22` the same for ratification | 32.4 s | 1.61 / 1.39 |
| `p4 check control-plane`, both declared | no disagreement found | 32.4 s | 1.57 / 1.59 |
| `p4 check plane` | 48, the same 48 lines as base | 32.8 s | 1.39 / 1.51 |
| `p4 check store-request` | no disagreement found | 25.7 s | 1.51 / 1.34 |
| control-plane's whole set, 98 files (the holder's own set) | **tests 569, pass 569, fail 0; exit 0** | 169.0 s, 202.9 s with the check | 0.65 / 2.50 |
| the same before the two uses were declared | tests 569, pass 569; the check's exit 1 | 166.7 s, 197.6 s | 1.89 / 2.20 |
| the 8 plane tests that import the routing, each alone, traced | 8 files, 32 of 32 | 163.3 s | 1.28 / 2.34 |
| 6 other test files of 1(c), each alone, traced | 6 files pass (43 tests and 1 todo) | 27.7 s | 2.34 / 1.89 |
| plane's folder, 55 files, 3 at a time, traced | 53 files exit 0; 279 tests, 274 pass. `l77-size` 0 of 3 and `r8-heal-door` 2 of 4 fail | 758.4 s | 2.50 / 1.25 |
| those two files, alone, not traced | `l77-size` 3 of 3; `r8-heal-door` 3 of 4 | 298.8 s | 0.72 / 0.69 |
| the three samples, moved, each alone | 2 of 2, 1 of 1, 2 of 2 | 2.0 s, 1.9 s, 1.9 s | 1.34 / 1.36 |
| build | exit 0; 28,418,158 bytes; 853 inputs; **sha256 equal to base's bundle** (`da5f1a92…`) | 2.0 s | 1.25 / 1.25 |

The two plane-folder failures are not the variant's [MEASURED]. On unchanged base, alone and not traced, `l77-size` passes 3 of 3 and `r8-heal-door` fails 1 of 4 ("R102 G93 L: a row owed and the alarm deleted, one ordinary read by the founder … sets the alarm"), 292.9 s at load 1.59 / 0.90. `l77-size` fails under the recorder and passes without it on base, N2 and C. INFERENCE: the child process whose memory it caps also loads the recorder. Research 21's headline 2 reports the same `r8-heal-door` file failing on research 15's unchanged baseline [READ].

33 of the 55 folder files reach the routing file (14 load it in Node, 19 only read it, as Miniflare hands it to workerd); the same 33 on N2 and on C [MEASURED by trace].

## 5. N2 and S2, added by me: the helpers in a second file of the holder

The brief did not ask for these. They hold the placement of N and of S and change one thing: the file control-plane imports is not the file that imports `store-assembly/index.mjs`.

**What changed in N2** [MEASURED and READ]: `src/door-routing/helpers.mjs`, 66 lines: three imports (`readerOf` from admission, `evidenceStorageAbsent` from acquisition, `json` and `doAnswer` from answer-envelope), the four helpers as cut, one export line. `src/door-routing/index.mjs`, 132 lines: `plane/door.mjs` with line 29 replaced by `import { SCRATCH } from "../admission/index.mjs";` and `import { sha256Hex, caseReader, captureKey, storageAbsent } from "./helpers.mjs";` (a rename at 98 % to git). `control-plane/index.mjs` imports the four from `../door-routing/helpers.mjs`. `door-routing.json` lists both files in `public`. In `r8-timing-hook` the module mock moves from `control-plane/index.mjs` to `door-routing/helpers.mjs` and stays on `caseReader`: 4 lines, paths only. Everything else is N's. S2 is the same with `src/store-request/door-helpers.mjs` and `src/store-request/routing.mjs`.

[MEASURED: `closure.mjs`] control-plane's import closure is 762 files in N2 and S2 (base 761 and the helpers file) and holds neither `store-assembly/index.mjs` nor the routing file. The helpers file's own closure is 616 files of 149 modules, none of the UI.

**Runs** [MEASURED]:

| run | N2 | S2 |
|---|---|---|
| `p4 check door-routing` | no disagreement found (4.2 s; load 0.81 / 0.83) | no such module |
| `p4 check control-plane` | no disagreement found (30.1 s; 0.83 / 0.90) | no disagreement found (31.6 s; 1.47 / 1.46) |
| `p4 check plane` | 48, the same lines as base (32.7 s; 0.90 / 1.36) | 48, the same lines as base (35.6 s; 1.46 / 1.43) |
| `p4 check store-request` | no disagreement found (24.9 s; 1.36 / 1.18) | no disagreement found (25.0 s; 1.43 / 1.42) |
| control-plane's whole set, 98 files | **569 of 569; exit 0** (184.2 s, 219.7 s with the check; 1.54 / 2.47) | **569 of 569; exit 0** (173.8 s, 204.5 s; 1.84 / 2.54) |
| store-request's whole set, 23 files | not run (nothing of store-request changes) | **120 tests, 117 pass, 1 fail, 2 todo**: the census of section 3 (102.9 s, 131.4 s; 2.54 / 0.84) |
| the 8 plane tests that import the routing | 8 files, 32 of 32 (173.7 s; 1.14 / 1.90) | 8 files, 32 of 32 (178.3 s; 1.43 / 1.84) |
| 6 other test files of 1(c) | 6 pass, 43 tests and 1 todo (29.3 s; 1.90 / 1.54) | not run |
| plane's folder, 55 files, traced | 53 files exit 0; 279 tests, 275 pass; `l77-size` 0 of 3, `r8-heal-door` 3 of 4 (640.1 s; 2.00 / 2.75). Alone and not traced on N2: 3 of 3 and 3 of 4, as base (293.9 s; 0.90 / 0.65) | not run |
| the three samples, each alone | 1.8 s, 1.5 s, 2.2 s; all pass | 1.8 s, 1.7 s, 2.1 s; all pass |
| build | exit 0; 28,418,158 bytes; 854 inputs (2.1 s; 2.75 / 2.61) | exit 0; the same bytes as N2's bundle (sha256 `fccb0013…`); 854 inputs (2.6 s; 0.84 / 0.85) |

Base's store-request set, for comparison: 120 tests, 118 pass, 0 fail, 2 todo (98.8 s, 123 s with the check; load 0.69 / 0.67) [MEASURED].

## 6. The moved samples, the same in every variant

**Two new helpers**, control-plane's by its folder entry [READ in the patches]:
- `T/control-plane/real-door.mjs`, 22 lines, after research 22b's. store-request's `storeWorld` with both buckets bound, the world's own `env` with `STORE.get` answering a stub over `world.send`, and `makeFetch({ publicOp, gatedOp })` with the two hooks imported from the routing's place in the variant. It hands no `publicInstanceGroup` and does not call `bindPublishedPlane`; no sample needed either.
- `T/control-plane/real-kit.mjs`, 238 lines: the helpers of `r8-kit.mjs` that the three files use, with the same names and bodies, over `real-door.mjs`. Three things differ. `plane(url, init)` asks the door in process. An instant a helper writes is the world's pinned clock. `until(fn, ms, every)` moves the world's clock on and runs the scheduler's firing (`world.tick`), where the Miniflare kit waited for the object's alarm. The founder is made by the real door's `claim` with the bootstrap token, as in `r8-kit.mjs`.

**Each test file's change**: 4 lines in, 5 out. The header's last sentence, `import { test }` for `import { after, test }`, the kit's import, and `const kit = await makeKit({ tag })` for the Miniflare kit and its `after(() => kit.mf.dispose())`. [MEASURED: `git diff -U0`] The hunks touch lines 5 to 13 only; no changed line holds `assert` or `test(`; the files hold 26, 8 and 9 `assert.` lines before and after. `plane.json` loses the three lines, so control-plane's folder entry owns the files: by the tool's `testFiles` control-plane has 98 files (base 95) and plane 144 (base 147).

**Two points for the lane** [READ, MEASURED where tagged]:
- `real-kit.mjs` restates helper bodies of `r8-kit.mjs`, and `r8-kit.mjs` is plane's by `ownerOf` (`plane.json` names it; `control-plane.json` also lists it under `public`) [MEASURED]. It copies no product code, and the routing it drives is the real one. Whether a restated test helper of a later module meets ARCH's "no copy of a later one" is not mine to say.
- The kit makes inputs with screen code: `CAPTURE_SCREEN.parts.promoteDocument` (`src/screens-intake/capture.mjs`, screens-capture 182, already in control-plane's `uses`) and `PARTS.sitting` (`src/screens-publish/parts.mjs`, **screens-public 191**, not in them) [MEASURED: `ownerOf`]. The first `p4 check control-plane` on N said: `real-kit.mjs:12 declared uses disagree with the imports: imports screens-public, which process/modules/control-plane.json does not declare in uses`. With `screens-public` added the check passes in every variant. store-request's recipe `published` makes the same sitting from `sshsig.mjs` (signatures, 11) with no screen code (`T/store-request/recipes.mjs:218-226`) [READ]; that route was not tried.

**Time, each file alone, seconds of wall** [MEASURED; 1-minute load 0.1 to 1.6]:

| file (tests) | original over plane, base | N | S | C | N2 | S2 |
|---|---|---|---|---|---|---|
| `walk-people-door` (2) | 23.1 | 1.7 | 1.8 | 2.0 | 1.8 | 1.8 |
| `walk-tasks-filed-project` (1) | 19.2 | 1.6 | 1.9 | 1.9 | 1.5 | 1.7 |
| `walk10b-docket` (2) | 18.4 | 1.9 | 1.9 | 1.9 | 2.2 | 2.1 |

**What the moved tests reach** [MEASURED: the trace, then `ownerOf` over every repository path]. Each of the three, in each of the five variants: 867 files loaded or read (868 in N2 and S2), every one owned, the latest owner control-plane, 0 files of a later module, 0 files under `src/plane/`. The routing's file is among the files loaded. None imports `harness.mjs`, so the collector of research 13 section 6 is not reached.

**Mutations of the moved routing** [MEASURED: `mutate.mjs`]. One line changed, the moved test run alone, the line put back. The same result in all five variants, 20 runs:

| moved test | the change | result |
|---|---|---|
| `walk-people-door` | `publicOp`: `if (knocked) return knocked;` to `if (false) return knocked;` (doorbell's arm declines) | 1 of 2 fails: `a knock: {"ok":true,"service":"bio-plane",…` (the bootstrap report answers in its place). The other test uses no arm and passes |
| `walk-tasks-filed-project` | `gatedOp`: `if (c) return c;` to `if (false) return c;` (capture's arm declines) | 1 of 1 fails: `the capture is held: {"ok":false,"error":"internal error",…` |
| `walk10b-docket` | `publicOp`: `if (pd) return pd;` to `if (false) return pd;` (publication's arm declines) | 2 of 2 fail: `a sitting: {"ok":true,"service":"bio-plane",…` |
| `walk10b-docket` | `gatedOp`: `if (op === "caseratify") return undefined;` put before `return ratificationOp(` | 2 of 2 fail: `200 {"ok":true,"result":{"ok":false,"reason":"NO_SUCH_CASE",…` |

After each revert the sha256 of `git diff a26a8da2` and the text of `git status --short` equal what they were before the mutation, 20 of 20. For N that sha256 is the saved patch's own (`77787f00…`).

## 7. Comparison, facts only

[MEASURED: `stats.mjs` (`git diff --numstat --no-renames a26a8da2`, the records, a parse of every tracked `.mjs` for imports of the moved files), `closure.mjs`, and the runs above.] Order numbers are each tree's own.

| | N | S | C | N2 (added) | S2 (added) |
|---|---|---|---|---|---|
| holder | door-routing, new, 176 of 205 | store-request, 175 | control-plane, 195 | door-routing, 176 of 205 | store-request, 175 |
| moved code | 1 file, 193 lines | 1 file, 193 lines | 1 file, 131 lines; helpers stay | 2 files, 132 and 66 lines | 2 files, 132 and 66 lines |
| code: files; lines in / out | 4; 198 / 193 | 4; 198 / 193 | 3; 132 / 132 | 5; 203 / 193 | 5; 203 / 193 |
| tests: files; lines in / out | 13; 283 / 26 | 13; 283 / 26 | 13; 281 / 24 | 13; 283 / 26 | 13; 283 / 26 |
| records: files; lines in / out | 4; 41 / 5 | 2; 2 / 4 | 2; 4 / 4 | 4; 42 / 5 | 2; 2 / 4 |
| `uses` added for the placement | new record, 23 uses; control-plane +door-routing; plane +door-routing | none | control-plane +host-governor, +ratification | as N | none |
| `uses` added for the kit | control-plane +screens-public | the same | the same | the same | the same |
| check of the holder | no disagreement | no disagreement | 2 first, none once declared | no disagreement | no disagreement |
| `p4 check plane` | 48, as base | 48, as base | 48, as base | 48, as base | 48, as base |
| control-plane's whole set | **117 of 193; 76 files stop at load** | **the same** | 569 of 569 | 569 of 569 | 569 of 569 |
| the holder's own set | no test | **117 of 120, 1 fails** (base 118, 0 fail) | control-plane's | no test | **117 of 120, 1 fails** |
| the 8 plane tests importing the routing | 31 of 32 | 31 of 32 | 32 of 32 | 32 of 32 | 32 of 32 |
| plane's folder, 55 files | not run | not run | as base (2 files fail on base too, or under the recorder only) | as base | not run |
| modules after the holder that import a moved file | 2: control-plane, plane | 2: control-plane, plane | 1: plane | 2: control-plane (its source the helpers file only; its test helper `real-door.mjs` the routing), plane | 2: the same |
| does `control-plane/index.mjs` load the routing file | yes | yes | no | no | no |
| UI files in the routing's import closure | 0 of 707 | 0 of 707 | 130 of 849, in 19 UI modules | 0 of 708 | 0 of 708 |
| direct imports of a UI module by the moved code | 0 | 0 | 0 | 0 | 0 |
| built bundle (28,418,158 bytes in all) | 853 inputs; sha256 `a506c001…` | the same bytes as N's | 853 inputs; **the same bytes as base's** (`da5f1a92…`) | 854 inputs; `fccb0013…` | the same bytes as N2's |
| patch | `n.patch`, 51,948 bytes, 21 files | `s.patch`, 50,644, 19 files | `c.patch`, 39,594, 18 files | `n2.patch`, 52,141, 22 files | `s2.patch`, 50,828, 20 files |

On base the routing is `plane/door.mjs`: its closure is 849 files with the same 130 UI files, and the only files that import it are plane's (`plane/index.mjs` and the 8 tests).

**What a check or a test refused, in one list** [MEASURED]:
1. N and S: 76 control-plane test files, `a second registration (R81)`; `r49-case-inputs-public` alone the same; plane's `r8-timing-hook` test 1.
2. S and S2: store-request's `census.test.mjs:29` (R21's pinned list).
3. C: `p4 check control-plane`, two undeclared imports, until declared.
4. Every variant: `p4 check control-plane`, the kit's import of screens-public, until declared.
5. No check asked for a requirements file, for a test of the new module, or for the moved file in `public`.

## After a change

These are inferences about a state that was not built. None is a finding.

- INFERENCE from sections 2 and 5: what turns control-plane's set red is control-plane's source loading a file that imports `store-assembly/index.mjs`. Any shape in which it does not would avoid it; N2, S2 and C are three. A harness that did not register for itself would be another way. That was not tried, and it is a change to control-plane's tests, not to the placement.
- INFERENCE from section 7's closures: with the door moved below the UI, N2's two files would bring no UI file with them. C's routing imports `control-plane/index.mjs`, which today imports the shell, the assets and nine screen modules (`index.mjs:52-62`); the door trials (research 15, 21) take those imports out of the door. C was not tried on top of those patches.
- INFERENCE: for S or S2 to pass, store-request R21's list and its test would have to change, which is store-request's and ARCH's to settle.
- INFERENCE from 1(c): after any of the moves, `sa-assembly.test.mjs:250` no longer reads the routing, so its rule about what plane imports from store-assembly would no longer cover the routing's `askOp`, `actionDraftOp` and `ACTION_DRAFT_OPS`. The comments and requirement texts of 1(c) that name `plane/door.mjs` would be stale. The committed `dist/` manifest and bundle name `src/plane/door.mjs` and would need a rebuild; the patches leave them as they are.
- INFERENCE from research 22b and section 6: 22b counts 86 tests that need arm hooks; the three files moved here hold 5 tests. The others could be moved the same way, and none was. Tests that wait on real time, count calls or boot screens were not tried over this kit.
- INFERENCE: under the re-stacking, control-plane's tests could not import screen code, so the kit's `promoteDocument` and `PARTS.sitting` would need store-request's recipes in their place.

## What I did not check

- plane's whole set. Of plane's 144 files in the variants, I ran the 55 of its own folder (N2 and C only), the 8 of those that import the routing (all five variants) and nothing else. The Miniflare tests plane holds in other folders, 43 of them in control-plane's folder, were not run on any variant. They boot `plane/index.mjs`, which imports the routing in every variant.
- plane's folder on N, S and S2. The six other test files of 1(c) on S and S2.
- Any other module's test set: journey-check, release, installer, bundler and the rest. Some of them build or boot the plane.
- `p4 check` of any module but the four named (and door-routing).
- control-plane's whole set on base: the 564 is research 13's and 22b's figure.
- GitHub's required run and `p4 run scope`. `p4 listing` and the notice a merge would send for control-plane's four re-exported names: `listing` reads a commit, and nothing was committed.
- Whether the process wants a requirements file and tests for a new module. The check did not ask; that is all I know.
- Whether any gate fails on the stale committed `dist/` and `release/` bundles.
- The built bundles were not started under workerd, and the page script's bytes were not compared (research 15 found they depend on top-level names in the bundle). C's bundle equals base's byte for byte, so that one question is closed for C only.
- Why the bundle is 28,418,158 bytes in every variant when its bytes differ.
- Flakiness. Each heavy run ran once. Each sample ran at least three times in each variant (alone, traced, on the patch's clean tree), green every time it was not mutated.
- The trace does not see reads inside workerd, and one process file was written for each test file; whether the runner's own process wrote one was not looked at.
- A routing file in a sub-folder of store-request, which the census would not list.
- `publicInstanceGroup` and `bindPublishedPlane` were never needed by the three samples; a test that needs one would have to be handed it in the test, and that was not tried.
- Whether the comments inside the moved files should be re-worded; they were left as they stood.
- Why `r8-heal-door` fails on base.
