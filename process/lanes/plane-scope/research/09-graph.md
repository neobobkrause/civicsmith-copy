Length: 268 lines. Last section: "What I did not check".

# The dependency graph of the product as it is now

Made 23 Nov 2026 by a worker of civicsmith plane-scope lane #1. Base: the working tree at `/home/user/civicsmith-copy`; its product files are those of `origin/p4-tranche` at `a26a8da2` ([MEASURED] `git diff --stat a26a8da2 HEAD -- . ':!process/lanes'` prints nothing). Nothing here describes what the code could become.

Tags follow `evidence-rules.md`. A number tagged [MEASURED] with no command beside it is a field of `graph/summary.json`, printed by `node -e "console.log(require('./process/lanes/plane-scope/research/graph/summary.json'))"`.

## Answers, as asked

- **a. Are there references that go upward in the order? YES.** [MEASURED] 5,350 references from a file of one module to a file or folder of a later module, at 184 places, over 854 ordered pairs of modules: 3,884 from code (`files`), 1,466 from tests. **None of them is an import the code writes out**: [MEASURED] 0 of the 184 upward rows is an `import`, `export … from`, literal `import()`, comment import or `require` (command in "Finding a"). **Two places do import later modules' files at run time, through a computed `import()`**: `bio-plane/test/declared-ops.mjs:136` (test-support, 9; files of 95 later modules in the traced runs) and `bio-plane/scripts/fleet-bundle.mjs` (bundler, 12; 7 later modules). The others are files read, folders listed, programs started and paths held as text. 52 of the 184 places are settled by the parser alone; the rest come from folder listings, file patterns, traced runs and readings by hand, each kept apart below.
- **b. Declared `uses` against the graph.** [MEASURED] 3,142 uses are declared. 143 of them (in 51 modules) have no reference of any kind in the graph. 1,279 pairs (in 59 modules) are referred to and not declared; **0 of those is by an import**; 75 are by another reference the parser settles (a file read, a path held, a Worker or process started), the rest only by a folder listing (344), a file pattern (163), a traced run (686), a reading by hand (4) or a text lead (7). 0 declared uses name a module that is not earlier in the order.
- **c. Ownership.** [MEASURED] 518 files in the tree are owned by no module; all are process and session files (`process/modules/` 409, `process/lanes/` 100, and nine single files), none is product code. 0 files are matched equally by two claims. 8,337 owned files are matched by more than one module's claims, and the longer path wins.
- **The lane's case is caught.** `bio-plane/test/declared-ops.mjs` (test-support, 9): the parser flags lines 80, 83, 135, 136 as computed; the traced runs saw line 135 read 6 files of plane and 10 of journey-check, and line 83 list 225 folders of journey-check, `build/plan` first. Shown in "Computed references".

## What is in the folder

| file | what |
|---|---|
| `tools/graph.mjs` | the extractor. `node process/lanes/plane-scope/research/tools/graph.mjs` from the top writes every `graph/*.json` but `crosscheck.json` and `validation.json` (about 90 s, about 5 GB; it restarts itself with a larger heap). `--full <file>` also writes every reference, with its expression, to a file of your choice (6.7 MB) |
| `tools/hand-resolutions.json` | the readings by hand, as rules; input of the extractor |
| `tools/runtime-sites.json` | what traced runs saw at each computed place; input of the extractor |
| `tools/trace.mjs`, `tools/trace-run.mjs`, `tools/crosscheck.mjs` | the run-time recorder, the runner of test files under it, the comparisons with the graph |
| `graph/module-edges.json` | every ordered pair of modules with a reference: counts by kind, from code and from tests, and up to 5 examples |
| `graph/files.json` | every owned file with code: owner, code or test, counts of its references, and every reference to another module's file with its line |
| `graph/computed.json` | every computed reference, with how it was resolved; the rules; calls the parser could not tie to Node |
| `graph/upward.json`, `graph/uses-diff.json`, `graph/ownership.json` | the full lists behind findings a, b, c |
| `graph/crosscheck.json`, `graph/validation.json` | the raw results of the validations |
| `graph/summary.json` | the totals quoted here |

Each data file but `summary.json` carries a `format` or `about` field that says how to read it. [MEASURED] `du -cb graph/* tools/*.json` → 1,581,769 bytes: 82 KB over the 1.5 MB aimed at. The file-level data keeps every reference that crosses modules; references that stay inside a module are counted, not listed (`--full` lists them).

## Method

1. **Files and owners.** The file set is `git ls-files -co --exclude-standard` (tracked, and untracked but not ignored). A file's owner is the longest matching path over every module's `files` and `tests`, by the process tool's own rule ([READ] `tool/lib/util.mjs:90`: ``(p.endsWith('/') ? file.startsWith(p) : file === p || file.startsWith(`${p}/`))``). "Code" means the winning path is in `files`, "test" in `tests`.
2. **Parser.** TypeScript 5.6.3 from `~/process4/<process.json's commit>/tool/node_modules/typescript` ([MEASURED] `summary.json` `typescript`), one program over all 4,849 owned `.mjs` and `.js` files, every file read as a module, no import followed by the parser. References in JavaScript are found on the syntax tree, never by a text pattern; text patterns are used only to split a package script into words, to decide whether a text literal looks like a path (the leads), and to name two classes of computed arguments (`env`, `word`). Python and HTML are read with Python's `ast` and `html.parser`; `package.json` with `JSON.parse`, `wrangler.jsonc` with TypeScript's JSON reader.
3. **References recorded**, by kind: `import`, `export-from`, `jsdoc-import` (an import written in a comment), `dynamic-import`, `require`, `require-resolve`, `resolve`, `loader`, `loader-hooks`; `fs-read`, `fs-list`, `fs-stat`, `fs-write` (every `node:fs` and `node:fs/promises` call that takes a path; a copy is a read and a write); `proc` (a path given to `spawn`, `execFile`, `exec`, `fork` and their Sync forms, or to a package script), `proc-cwd`; `worker` (a `worker_threads` Worker, a Miniflare `scriptPath`, a wrangler `main`), `worker-module`, `worker-root`; `bundle` (an esbuild entry); `sqlite-open`; `service-binding` (a Worker named in a wrangler file); `path` (a path the code builds and holds where no call above reads it directly, such as `join(HERE, "../../../src/plane/index.mjs")` put into a Worker's text); `path-text` (a text literal that names an existing file: **a lead, not a use**, always counted apart). Bare package and `node:` imports are recorded with the package name and make no edge.
4. **The evaluator.** A call is tied to Node by following the name to its import (`readFileSync` from `node:fs`, `fs.promises.readFile`, `promisify(execFile)`), not by its spelling. An argument is settled where the code alone settles it: literals, `import.meta.url`, `new URL(x, base)`, `fileURLToPath`, `path.join/resolve/dirname`, constants (also across files, through imports), a `let` written at most 4 times, items of a literal list in `for … of` or `.map`, and a call of a function that has one `return`. [MEASURED] of 3,283 settled references outside import declarations, 1,432 are written as a literal or as `new URL(literal, import.meta.url)` and 1,851 were settled by following names and calls (`summary.json` `settledOutsideImportDeclarations`). 64 of them carry a note where something was assumed (`a || b` with `a` unknown, `b` taken: 34; a `?query` cut from an import: 20; one side of a condition: 7; a path written into a longer text: 3).
5. **Computed references.** Where the argument is not settled the reference is listed in `graph/computed.json` with file, line, kind, expression and enclosing function, and then resolved in this order: its path starts outside the repository (`outside`); it comes from the command line or an environment variable (`argv`, `env`); it is a pattern of file names, matched against the file set (`pattern`); its start is known and one module owns everything under it (`start`); it waits on a parameter and every call the parser ties to the function was read with its arguments (`callers`; the resulting references carry "path given by a caller"); a rule read by hand applies (`hand`); a traced run saw the line (`run`); none of these (`open`).
6. **Edges.** A reference from a file of module A to a file or folder of module B (A ≠ B) adds to the pair A→B under its kind. A listing of a folder also adds, as its own kind, every module that owns a file or a claimed folder directly inside it. A reference to a path that does not exist counts under "(no such file)" for the module whose claim covers the path.
7. **Not in the graph**: see "What I did not check". The largest gap is the last kind of rule 7, "a value it registers that is called".

## Totals

[MEASURED], all from `graph/summary.json`:

- Files in the tree 18,479; owned 17,961 (`.md` 5,611, `.mjs` 4,843, `.png` 3,560, `.txt` 3,339, `.json` 265, `.csv` 63, `.html` 50, `.py` 38, `.js` 6, others under 31 each).
- Read as code: 4,849 JavaScript files (1,192 code, 3,657 tests; 11 of them are files the process reader leaves out: built bundles, vendored code), 38 Python, 52 HTML with 86 inline scripts, 21 `package.json` and `wrangler.jsonc`, 1 program kept as text (`bio-plane/test/m/control-plane/wrap-entry.worker.txt`). 25 files that hold code or commands are read by no parser here (shell, YAML, Dockerfile, Rust, TOML, GraphQL, CSS: `computed.json` `notParsed`).
- References: 32,952, of which 29,734 settled and 3,218 computed.

| kind | settled | computed | more through callers |
|---|---|---|---|
| import | 25,844 | | |
| export-from | 418 | | |
| jsdoc-import | 80 | | |
| dynamic-import | 1,138 | 90 | 4 |
| require, require-resolve, resolve, loader | 37 | 7 | 11 |
| loader-hooks | | 15 | |
| fs-read | 690 | 605 | 319 |
| fs-list | 72 | 82 | 17 |
| fs-stat | 47 | 192 | 10 |
| fs-write | 300 | 857 | 51 |
| proc, proc-cwd | 169 | 400 | 88 |
| worker, worker-module, worker-root | 325 | 40 | 4 |
| bundle, chdir, sqlite-open | 5 | 5 | |
| service-binding | 7 | | |
| path (held) | 602 | 925 | |

- Of the 25,844 imports: 16,795 go to a repository file, 8,639 to a `node:` module, 342 to a package (123 from JavaScript, 196 Python imports, 23 `package.json` dependencies), 53 to an absolute path outside this checkout, 11 to `cloudflare:` or `data:`, 4 to a file that does not exist.
- 767 text leads; 184 paths that only name the file's own folder or a folder above it (anchors, not counted); 997 readings through callers, 504 of them settled (the last column) and 493 with a path that starts outside the repository or is still not known.
- Module pairs with at least one reference: 4,278 (3,424 downward, 854 upward). [MEASURED] 2,820 pairs have an import; 0 upward pairs have one (command in "Finding a").

## Validation

### 1. The process tool's `check` on ten modules

[MEASURED] `node /root/process4/0eec86fd8ddcffbc804b761e18095a52a80a5288/tool/p4.mjs check <module>` for setup-words (2), record-grammar (3), capture (56), retrieval (81), store-assembly (174), store-request (175), interface-shell (177), screens-intake (183), control-plane (195), plane (196). Exit 0 for eight; exit 1 for capture (3 disagreements, all "(b) code disagrees with the stated interface of …") and plane (48: 46 of kind (b), 2 of kind "(a) a comment disagrees with this module's tests"): all about kinds of values, none about uses. What `check` does with uses: [READ] `tool/lib/notice/check.mjs:543-549` collects, from each `.mjs` file of the module, `import`, `export … from`, literal `import()`, `@import` and `import('…')` in comments with a relative name, and maps each to its owner; `:561-567` refuses an import of an undeclared module; `:569-590` reports a declared use with no import as refused or "cannot tell".

Because the command prints those "cannot tell" lines without the module's name, I also called the same `check` function directly and read the names from its result (`graph/validation.json` `processToolCheck.rows`). Compared with the graph's import kinds over the same files:

| | result |
|---|---|
| imports of an undeclared module | tool 0, graph 0, in all ten [MEASURED] |
| declared uses with no import, by name | identical lists in nine modules (0, 0, 4, 2, 1, 1, 0, 2, 16 names) [MEASURED] |
| the same, for plane | tool 24 names, graph 26: the graph also lists `file-scanner` and `screens-wizards` [MEASURED] |
| `import()` the tool "cannot read" | 24 places; the graph leaves 8 of them computed and settles 16 [MEASURED] |
| computed in the graph, silent in the tool | 0 [MEASURED] |

Every difference, explained:
- **plane, 2 names.** The tool counts a use through a name without an import of the module's file ([READ] `check.mjs:585` `if (u.uses.has(p)) continue;`). [READ] `bio-plane/test/m/control-plane/r9-seam-safety.mjs:12` `import { SAFE_VIEW_PAGES_MAX, SAFE_VIEW_BYTES_MAX } from "../../../src/file-safety/index.mjs";` and `bio-plane/src/file-safety/index.mjs:35` takes that name from `file-scanner/src/limits.mjs` and `:68` exports it again: plane's test uses file-scanner's value through file-safety's file. Likewise `GUIDE`, which `bio-plane/test/m/control-plane/t46-e2e.test.mjs:16` takes from a test kit and `bio-plane/src/screens-wizards/index.mjs:35` defines. The graph records file-to-file references, so it has plane → file-safety and no import plane → file-scanner. [MEASURED] the tool's whole-product reading (`analyse`) finds such a use through a name for three of the graph's 26: member-roster, file-scanner, screens-wizards; `check` drops the last two from its list and keeps member-roster. Why it keeps member-roster: INFERENCE from `check.mjs:331` (its own program is the module's files and its providers' interface files, not the whole product): the name is not followed there; printing `u.uses` inside `check` would settle it.
- **16 `import()` places settled by the graph.** They are template texts the evaluator can settle: [READ] `bio-plane/test/m/op-declarations/t36.test.mjs:348` ``await import(`../../../src/op-declarations/index.mjs?second=${Date.now()}`)`` (the file is known, the query is not); `bio-plane/test/m/store-assembly/t41.test.mjs:112-113` ``for (const mod of ["steps", "investigation", "question-explorer"]) { const m = await import(`../../../src/${mod}/index.mjs`);`` (three files). Through four of them (`bio-plane/test/m/plane/t47.test.mjs:103`) the graph has imports from plane's tests to screens-entry, screens-wizards, screens-investigate and screens-action that the tool does not count.

### 2. Run-time cross-check of 14 main files

[MEASURED] `node tools/crosscheck.mjs <scratch checkout> <full.json> graph/crosscheck.json setup-words record-grammar capture retrieval op-declarations store-assembly store-request interface-shell screens-intake control-plane plane scheduler test-support=bio-plane/test/declared-ops.mjs bundler=bio-plane/scripts/fleet-bundle.mjs`. Each main file (`index.mjs` of the module's first `files` folder) was imported in Node under `tools/trace.mjs`, which records every module Node resolves and loads (`module.registerHooks`) and every path given to a file-system call. `cloudflare:workers` was answered with a stand-in so that plane's files load in Node.

| module | files loaded | files predicted (import + export-from closure) | loaded, not predicted | predicted, not loaded | imports resolved | not in graph | graph edges not seen |
|---|---|---|---|---|---|---|---|
| setup-words | 2 | 2 | 0 | 0 | 1 | 0 | 0 |
| record-grammar | 17 | 17 | 0 | 0 | 28 | 0 | 0 |
| capture | 110 | 110 | 0 | 0 | 306 | 0 | 0 |
| retrieval | 236 | 236 | 0 | 0 | 798 | 0 | 0 |
| op-declarations | 566 | 566 | 0 | 0 | 2,306 | 0 | 0 |
| store-assembly | 700 | 700 | 0 | 0 | 3,300 | 0 | 0 |
| store-request | 569 | 569 | 0 | 0 | 2,319 | 0 | 0 |
| interface-shell | 569 | 569 | 0 | 0 | 2,313 | 0 | 0 |
| screens-intake | 9 | 9 | 0 | 0 | 10 | 0 | 0 |
| control-plane | 761 | 761 | 0 | 0 | 2,936 | 0 | 0 |
| plane | 853 | 853 | 0 | 0 | 3,619 | 0 | 0 |
| scheduler | 551 | 551 | 0 | 0 | 2,367 | 0 | 0 |
| test-support (declared-ops.mjs) | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| bundler (fleet-bundle.mjs) | 4 | 4 | 0 | 0 | 3 | 0 | 0 |

No mismatch in any row. File-system calls made by the checkout's own code while loading: 0 in all 14 (the calls seen were Node's loader reading the files it loads).

### 3. The earlier regex tracer

[MEASURED] The lane's scratch tracer, run again from `bio-plane/test/m/screens-intake/page.mjs` and `bio-plane/src/screens-intake/index.mjs` with `realplane.mjs` left out: 737 files, latest module screens-intake (183). The graph's closure by `import`, `export-from` and literal `import()` from the same two files: **739 files, latest module screens-intake (183)**. Same latest module; two more files. Every file of the 737 is in the 739. The two are `bio-plane/src/store-assembly/register.mjs` and `bio-plane/src/store-assembly/declarations.mjs` (both store-services, 173). Why: [READ] `bio-plane/src/store-assembly/assemble.mjs:11` `import "./register.mjs";` is an import with no `from`, and the tracer's pattern `(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["']` needs `from` or `import(`; `register.mjs:6` then imports `declarations.mjs`. By static imports alone (no `import()`) the graph reaches 582 files.

### 4. Traced runs of test files (beyond what was asked)

To resolve computed references by running them, 195 test files (chosen at an earlier pass of the extractor: each holds an unresolved computed place or imports a file that does; files under `build/` left out) were run under `tools/trace.mjs` in a scratch checkout of `origin/p4-tranche`, with the process's test command, a bare environment (no credential passed on, an empty HOME) and a time limit of 240 to 300 s each. [MEASURED] `graph/validation.json` `tracedTestRuns`: 164 passed (7 of them only when the session's proxy certificate was passed on), 27 failed, 4 were stopped at the time limit; 689 Node processes were recorded. A failed or stopped test still leaves the record of what it did before. Two results:

- **Imports.** [MEASURED] 7,806 distinct file-to-file imports were resolved in those processes. 5,854 are the graph's own edges; 251 are a test runner's entry or preload; 66 go to or from outside the checkout; 1,619 leave a file where the graph lists a computed `import()` (12 files, `bio-plane/test/system/row-census.mjs` 986, `bio-plane/test/m/file-safety/rows.test.mjs` 214, `bio-plane/test/m/docket/reads.test.mjs` 173, `bio-plane/test/m/lines/invariants.test.mjs` 132, `bio-plane/test/declared-ops.mjs` 81); **16 are in neither**. Of the 16: 13 are imports made by a one-line program a test starts with `node -e` (the importer is no file); 9 of their targets are in the graph as `path` references of the test that writes the program, 4 were not and are now covered by the rule `r8-timing-hook-text`. 2 import a bundle a test builds first (`file-scanner/dist/…`, `pdf-worker/dist/…`: not in the tree; the graph has them as "no such file"). 1 is a preload named relative to the working folder.
- **Settled file-system references.** [MEASURED] `node tools/crosscheck.mjs settled <raw folders> <full.json> <out.json>` (`graph/validation.json` `settledReferencesAgainstRuns`): of the references the extractor settled at a file-system call by following names and calls, 200 lines were reached in the runs: 199 touched exactly the path the graph names; 1 has two possible values in the graph and the run took the other (`stewards/scripts/deploy.mjs:24`). A first pass had found 1 wrong (`bio-plane/test/m/screens-settings/measure.mjs:30`, an empty text after `||` read as the top folder); the extractor was corrected and the data remade. Of the literal ones, 63 lines were reached and all 63 matched. 301 followed and 191 literal lines were not reached by any run.

## Finding a: references that go upward

[MEASURED] Whole-set commands:

```
node -e "const u=require('./process/lanes/plane-scope/research/graph/upward.json'); console.log(u.rows.filter(r=>/^(import|export-from|dynamic-import|jsdoc-import|require)( \(no such file\))?$/.test(u.kinds[r[3]])).length, 'of', u.rows.length)"
→ 0 of 184
node -e "const e=require('./process/lanes/plane-scope/research/graph/module-edges.json'); let up=0,upImp=0; for (const [f,t,c] of e.edges) if (t>f) { up++; for (let i=0;i<c.length;i+=3) if (/^(import|export-from|dynamic-import|jsdoc-import|require)$/.test(e.kinds[c[i]])) { upImp++; break; } } console.log(up, upImp)"
→ 854 0
```

By how each is known ([MEASURED] from `graph/upward.json`; a "place" is a file:line and kind; "references" counts one for each later module reached from a place):

| how known | code: places | code: references | tests: places | tests: references |
|---|---|---|---|---|
| settled by the parser | 9 | 9 | 43 | 43 |
| a folder that is listed: what lies directly inside | 2 | 21 | 11 | 125 |
| a pattern of files in a package script | 4 | 168 | 0 | 0 |
| seen in a traced run | 28 | 1,060 | 21 | 871 |
| read by hand | 6 | 1,136 | 0 | 0 |
| a text that names a path (lead) | 49 | 49 | 11 | 12 |

**Code, settled by the parser (9), all of them:**

| from | to | place | kind and target |
|---|---|---|---|
| documents (1) | journey-check (204) | `docs/development/ux-substrate/screens/build_words.mjs:16` | fs-read, path given by a caller: `mock-screens.js`, `mock-kit.js`, `mock-shell.js` beside it |
| documents (1) | setup-words (2) | `docs/development/ux-substrate/screens/build_words.mjs:366` | fs-write `words.json` beside it |
| documents (1) | setup-words (2) | `docs/development/ux-substrate/screens/words-modules.src.py:21` | fs-read `words.json` beside it |
| test-support (9) | plane (196) | `bio-plane/package.json:8` | proc: script `build` runs `scripts/build-plane.mjs` |
| test-support (9) | release (197) | `bio-plane/package.json:9` | proc: script `deploy` runs `scripts/deploy.mjs` |
| agent-worker (110) | journey-check (204) | `agent-worker/package.json:9` | proc: script `control` runs `test/agent-worker.control.mjs` |
| agent-worker (110) | plane (196) | `agent-worker/wrangler.jsonc:92` | service-binding to the Worker named `bio-plane` |
| installer (201) | journey-check (204) | `newgroup/scripts/build.mjs:21` and `:41` | path held, then fs-read: `docs/development/ux-substrate/screens/words-reads.json` |

**Tests, settled by the parser (43):**

- 34 places in 27 modules read `docs/development/ux-substrate/screens/words-reads.json` (28 places), `mock-acts.js` (4) or `mock-kit.js` (2), which journey-check (204) owns by name inside a folder documents (1) owns. First of them: `bio-plane/test/m/op-grades/words.test.mjs:13`. The modules: op-grades, member-roster, membership, ai-accounts, capture, extraction, entities, local-facts, retrieval-browse, retrieval, ai-runs, question-explorer, case-import, filings (2), affordances (2), translations, instance-setup, admission, store-assembly (6), interface-shell, screens-entry, screens-wizards, screens-settings, screens-inquiry, screens-publish, control-plane, plane.
- control-plane (195) → plane (196): `bio-plane/test/m/control-plane/rows-plane.mjs:14` holds the path of `bio-plane/src/plane/index.mjs`, and `:53` reads it and starts a Worker from it (4 places).
- image-codecs (30) → pdf-pixels (31): three Python fixture makers read a PDF pdf-pixels owns (`pdf-worker/test/fixtures/make-dct-fixtures.py:118`, `make-jbig2-fixtures.py:980`, `make-jpx-fixtures.py:213`).
- run-rules (96) → agent-harness (105): `bio-plane/test/m/run-rules/deployment.test.mjs:23` stats `agent-harness/src/harness.mjs`.
- wizard-library (153) → wizard-scripts (154): `bio-plane/test/m/wizard-scripts/source/registry.test.mjs:14` holds the path `bio-plane/src/wizard-scripts/`.

**Folders listed (13 places).** A listing names what lies inside. Code: `docs/development/ux-substrate/screens/build_words.mjs:300` (documents; the folder also holds files of setup-words and journey-check); `bio-plane/scripts/fleet-bundle.mjs:467` (bundler, 12) lists the top folder, where 19 later modules own a folder or file. Tests: `bio-plane/test/m/money/refusal-census.test.mjs:21` (money, 73) lists `bio-plane/src/`, 104 later modules; `pdf-worker/test/test-script.test.mjs:12`; `agent-worker/test/t35.test.mjs:607`; seven places in plane's tests; `stewards/test/requirements.test.mjs:619`.

**Patterns in package scripts (4 places, code).** `bio-plane/package.json:6` `test/m/**/*.test.mjs` and `:7` `test/system/**/*.test.mjs` (test-support, 9): the script `test` runs every test file under `bio-plane/test/m/`, files of 161 later modules. `pdf-worker/package.json:8` and `agent-worker/package.json:8` likewise, 2 and 1 later modules.

**Seen in a traced run or read by hand: the walkers.** These are places whose paths are computed; the code was read and, where a test runs it, the run recorded what it touched. [READ] quotes are in `tools/hand-resolutions.json` (`how`), [MEASURED] counts in `graph/computed.json` (`seen`).

| from | place | what it does [READ] | later modules reached |
|---|---|---|---|
| setup-words (2), code | `bio-plane/src/setup-words/build.mjs:120`, `:233` | `extract(root)` reads the text of every tracked `.mjs/.js/.cjs` file that a module of `build/modules.json` owns and that is not a test, generated or vendored | 201 seen in a run [MEASURED] |
| test-support (9), code | `bio-plane/test/declared-ops.mjs:80`, `:83`, `:135`, `:136` | walks every `files` path of every module up to the caller's `upTo`, by folder; reads each file found as text; imports those with `export const DECLARED_OPS` | 188 seen [MEASURED]; 95 of them by the import at `:136` |
| test-support (9), code | `.github/scripts/module-tests.mjs:8-19` | lists every module's `tests` paths of `build/modules.json` and runs the test files | not run; written as every module that owns a test file (183 later) |
| bundler (12), code | `bio-plane/scripts/fleet-bundle.mjs:470` and 22 more lines | reads `<folder>/fleet-member.json` in every top folder; builds a member from its entry with esbuild; reads and writes the member's inputs and outputs; imports a member's word rows and its built bundle | 56 seen [MEASURED]; 7 of them by import |
| member-roster (40), test | `bio-plane/test/m/member-roster/module-order.test.mjs:76` | not read | 145 seen [MEASURED] |
| money (73), test | `bio-plane/test/m/money/refusal-census.test.mjs:13-23` | reads every `.mjs` file in every folder under `bio-plane/src/` | 118 seen [MEASURED] |
| agent-worker (110), test | `agent-worker/test/t35.test.mjs:607-613` | walks the whole repository but five folder names and reads every `.mjs` and `.js` file | 94 seen [MEASURED] |
| store-assembly (174), test | `bio-plane/test/m/store-assembly/sa-parity.test.mjs:15` | not read | plane (196) seen [MEASURED] |
| plane (196), stewards (203), tests | 5 files | not read one by one | 1 to 4 each, seen [MEASURED] |

For a walker, "seen in a run" is a lower bound: what the runs made touched. The two setup-words tests that run `extract` ended with failures in the traced runs ([MEASURED] `validation.json` `notPassed`); the count is what the runs recorded. Every place of this kind is a row of `graph/upward.json` whose kind ends "(seen in a run)".

**Leads (60 places).** Texts that name a later module's file, not shown to be used: 29 in `docs/development/ux-substrate/screens/build_words.mjs` (documents), 7 in `bio-plane/src/setup-words/build.mjs`, 6 in `bio-plane/scripts/fleet-bundle.mjs`, 5 in `newgroup/src/steps/` (installer-account), 6 in `bio-plane/test/m/answer-envelope/envelope.test.mjs`, 7 elsewhere. Full list: rows of `graph/upward.json` whose kind is "path-text (a lead)".

## Finding b: declared `uses` against the graph

[MEASURED] from `graph/uses-diff.json` (one entry for each module, with the names):

- **Declared, no reference found: 143 uses in 51 modules.** The largest: op-declarations 54, control-plane 9, answers 6, screens-daily 5, screens-inquiry 5, capture 4, affordances 4. For the ten modules of validation 1 the tool's own list of declared uses without an import was compared name by name with the graph's (identical in nine, two names apart for plane), and the tool calls them "cannot tell", not refused; for the other 194 modules [NOT CHECKED] against the tool: `p4.mjs check <module>` on each would.
- **Declared, referred to, but by no import: 179 uses in 15 modules** (`declaredNoImport`): the graph reaches them only by a file read, a listing, a run or a lead.
- **Referred to, not declared: 1,279 pairs in 59 modules.** By the strongest evidence for each pair: 0 by an import; 75 by another reference the parser settles (38 of them to a later module); 344 only by a folder listing; 163 only by a file pattern; 686 only by a traced run; 4 only by a reading by hand; 7 only by a text lead. The 75 are in 52 modules; most are a test reading a file of documents (1) or journey-check (204): `foundNotDeclared` in the file, and the upward ones are listed in finding a. The 686 come from the walkers above (test-support, bundler, setup-words, money, agent-worker, member-roster).
- **Declared uses of a module that is not earlier in the order: 0.**

## Finding c: unowned and doubly owned files

[MEASURED] from `graph/ownership.json`:

- **Unowned: 518 files.** `process/modules/` 409, `process/lanes/` 100, and `CLAUDE.md`, `process.json`, `.claude/rules/standing-safety.md`, `.claude/settings.json`, `.github/workflows/module-tests.yml`, `process/decisions-arch.md`, `process/decisions-owner.md`, `process/ranking.md`, `process/waiting-for-arch.md`. The count moves as the lanes add files; none is under a product folder.
- **Matched equally by two claims: 0.**
- **Matched by more than one module's claims: 8,337 files** (the longer path wins). The largest: journey-check inside documents 7,766 (`build/plan/`, `build/tools/` inside `build/`); image-codecs inside pdf-worker 209; plane inside control-plane 53 (plane's `tests` name files under `bio-plane/test/m/control-plane/`); wizard-library inside wizard-scripts 32; installer-steps inside installer 24; store-assembly inside op-declarations 20. Pairs and counts: `nested` in the file.
- [MEASURED] 67 settled references go to a file or folder no module owns (process files, the top folder, `bio-plane/src/` and other folders above module level).

## Computed references

[MEASURED] 3,218: 2,293 at points of use and 925 paths held with only their start known. By how resolved:

| class | n | what it means |
|---|---|---|
| outside | 1,753 | the path starts in a temporary folder made at run time or a system path: it reaches no module |
| argv, env | 276 | given on the command line or in an environment variable: it reaches what the one who starts the program names; `startedBy` lists the starts the graph has |
| pattern, word | 11 | a file pattern matched against the file set (5); a command argument that is a number or data (6) |
| start | 129 | the start of the path is known and one module owns every file under it |
| callers | 309 | read at every call the parser ties to the function |
| run | 303 | resolved only by what traced runs saw at the line (for a computed `import()`: what Node resolved as imported from the file) |
| hand | 96 | a rule read by hand with tag [READ] (19 rules; 55 of the places they cover were also seen in a run) |
| open | 341 | not resolved: 218 under a group rule tagged [NOT CHECKED] (journey-check's files 130, Python programs 63, probes and child programs 22, wrangler `rules` 3) and 123 with no rule, in 84 files |

**The lane's case, shown.** [MEASURED] `node -e "const c=require('./process/lanes/plane-scope/research/graph/computed.json'); for (const r of c.computed['bio-plane/test/declared-ops.mjs']) console.log(JSON.stringify(r))"` prints, among its eight rows:

```
{"l":135,"k":"fs-read","e":"file","by":"hand","in":"pairsOf","hand":"declared-ops-read","seen":{"calls":40904,"paths":1188,"modules":197,"later":"188: runtime-limits, signatures, bundler, court-citations … plane, journey-check", …}}
{"l":83,"k":"fs-list","e":"full","by":"hand","in":"filesOf","params":["root","path"],"callers":{"sites":77,"open":77},"hand":"declared-ops-walk","seen":{"calls":20587,"paths":549,"modules":160,"later":"151: … control-plane, journey-check", …}}
{"l":80,"k":"fs-stat","e":"full","by":"hand","in":"filesOf", … "seen":{"calls":561275,"paths":14812,"modules":197, …}}
{"l":136,"k":"dynamic-import","e":"pathToFileURL(file).href","by":"hand","in":"pairsOf","hand":"declared-ops-read","seen":{"modulesImportedFromTheFileAtRunTime":81,"modules":95,"later":"95: legistar-reader, file-scanner, member-roster, record-core … signin-door, store-services"}}
```

and from the raw records of the runs, by owner ([MEASURED] scratch script over the three `raw` folders): line 135 read 6 files of plane (`roster-reader/test/fixtures/capture.mjs`, `agent-worker/test/agent-worker.test.mjs`, `agent-worker/test/harness.test.mjs`, …) and 10 of journey-check (`agent-worker/test/agent-worker.control.mjs`, …); line 80 stat'ed 8,001 paths of journey-check and 6 of plane; line 83 listed 225 folders of journey-check (`build/plan`, `build/plan/action-design`, `build/plan/archive`, …). These are the lane's own numbers (6, 10, 8,001, 225).

**Module-loading hooks: all 15 read.** [READ] 9 answer `cloudflare:workers`, `cloudflare:email` or `cloudflare:sockets` with a stand-in and pass every other name on; 3 only write down what is asked for; `bio-plane/test/m/case-checker/trace-register.mjs:6` rewrites setup-words' `index.mjs` as it is loaded; `bio-plane/test/m/plane/g42-storage-seam.test.mjs:13` answers `register.mjs` under `src/plane/` with an empty module; `bio-plane/scripts/fleet-bundle.mjs:2042` serves a built bundle's parts. Lines quoted in the rules.

**Calls by a name Node also uses.** [MEASURED] 826 calls named `readFile`, `open`, `stat`, `spawn` and the like could not be tied to Node and are not counted as references (`computed.json` `unbound`, grouped by what they are called on, 62 groups). [READ] the largest group, `….record.readFile(…)`, is record-core's own method (`bio-plane/src/record-core/index.mjs:769` `readFile(bundleId, path) {`), a file kept in the store, not on disk. The other groups [NOT CHECKED].

## How to remake it

```
node process/lanes/plane-scope/research/tools/graph.mjs                      # every graph/*.json but crosscheck and validation
git worktree add --detach <scratch>/wt origin/p4-tranche                     # then link each package's node_modules into it
node …/tools/trace-run.mjs <scratch>/wt <list.json> <scratch>/trace          # test files under the recorder; --net passes the proxy certificate on
node …/tools/trace.mjs merge <scratch>/trace/raw …/tools/runtime-sites.json --modules . --only …/graph/computed.json
node …/tools/graph.mjs --full <scratch>/full.json                            # again, now with what the runs saw
node …/tools/crosscheck.mjs <scratch>/wt <scratch>/full.json …/graph/crosscheck.json <module> …
```

The scratch worktree used here was removed (`git worktree remove --force`). No file outside `process/lanes/plane-scope/research/` was changed, nothing was committed or pushed by this worker.

## What I did not check

- **Rule 7's last kind, "a value it registers that is called", is not in the graph.** An operation one module declares and another calls by name through the door, or a table of the shared store read by name, makes no file reference. [MEASURED] the process tool's own whole-product reading (`analyse` in `tool/lib/notice/notice.mjs`, run once, 226 s) found 0 calls by name through a carrier: no `op:` or `table:` entry in any module's uses, so the tool does not see them either. Reading the `DECLARED_OPS` tables and the `op=` names in callers would establish them.
- **341 computed references are open** (list: `by: "open"` in `graph/computed.json`). For the 130 in journey-check's files nothing later exists, so none can be upward ([MEASURED] journey-check is line 204 of 204). The other 211 could reach any module; 123 of them have no rule at all.
- **"Seen in a run" is a lower bound.** 27 of the 195 traced tests failed and 4 were stopped; why each failed was not established (the bare environment is a likely cause: 7 passed once the proxy certificate was passed on). Tests not in the 195 were not run under the recorder. `journey-check/live.test.mjs` and the other journey-check tests were not rerun with the network.
- **The reach written for two hand rules is an approximation**: setup-words' `build.mjs` and `.github/scripts/module-tests.mjs` take their module list from `build/modules.json`, which I did not compare with `process/modules`.
- **Scripts that deploy, publish or sign were read, not run** (`bio-plane/scripts/deploy-fleet.mjs`, `release-assemble.mjs`, `dev-copy.mjs`, `deploy.mjs`, `stewards/scripts/deploy.mjs`); only the lines the rule `release-scripts-read` quotes were read.
- **25 files no parser here reads** (5 workflow and shell files under `.github/` and `.claude/`, 3 Dockerfiles, 4 shell scripts and 5 GraphQL files under `build/plan/`, 4 CSS, Rust and TOML of `sheet-worker/engine/`) were not read by hand either. `.github/workflows/regression.yml` and `.claude/hooks/session-start.sh` are test-support's.
- **Program text held in strings is not parsed.** A path built by an expression inside such text is recorded (kind `path`); a relative name written literally inside the text (`import "./x.mjs"` inside a template) is not. How many exist was not counted. The 3,339 `.txt` and 5,611 `.md` files were not searched for programs, except `.txt` files outside `build/` and vendored folders. `bio-plane/dist/SECRETS.txt` was not opened.
- **JSON data that names files is not read as references**: the six `fleet-member.json` files (a member's entry and outputs), `build/modules.json`, `release/RELEASE.json`.
- **What a Worker or a bundle loads after its entry** is not listed at the place that starts it: it is the import closure of the entry, which the graph has. Miniflare's inline `script` texts were not parsed. What `workerd` itself reads was not recorded.
- **Code evaluated from text** (`new Function`, `eval`, `node:vm`) was not followed.
- **`check` was run on 10 of 204 modules.** op-declarations (54 declared uses with no reference) was not among them.
- **The 53 imports of absolute paths under `/home/user/bio/`** (old probes under `build/plan/`, journey-check's) point outside this checkout and make no edge; whether they were meant for this repository's files was not established.
- **The evaluator's assumptions** were tested only where a run reached the line (200 of 501 followed file-system lines; 22 of 139 followed `import()`). A `let` written several times, a default after `||`, one side of a condition and a function with one `return` are read as described in "Method"; a wrong reading on a line no run reached would not have been caught.
- **Total size** of the data files is 1.58 MB, not under 1.5 MB.
