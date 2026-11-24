Length: 182 lines. Last section: "What I did not check".

# 21. The two trials joined by the capture route, measured

Research worker for plane-scope lane #1, 24 Nov 2026. Base: commit `a26a8da2`. Tags follow `evidence-rules.md`. `cp/` is `bio-plane/src/control-plane/`, `pl/` is `bio-plane/src/plane/`; test paths without a root are under `bio-plane/test/m/`. The join is `trial-combined/combined.patch`; raw numbers are in `trial-combined/results.json` under the key `joined`. "Research 15" is the door trial (`trial-door/diff.patch`), "research 16" the capture trial (`trial-capture/alt1.patch`, Alternative 1), "research 20" the report that found the two patches conflict. Everything below describes the scratch copy, not the product.

## Headlines

1. **The join applies and builds.** `alt1.patch` whole, then `diff.patch` without its composer hand-over (`pl/store.mjs` untouched, four hunks of `cp/index.mjs` left out, three delivery test fixes left out), then four small edits: 23 files, +319 -247. The result applies cleanly to a clean `a26a8da2` with `git apply --check`. [MEASURED, section 1]
2. **Tests on the joined copy, quiet machine (1-minute load 0.03 to 3.19):** control-plane's 95 files 564 / 564 / 0, with the three delivery files unchanged; plane's 27 A1 files 99 / 98 / 1, the one failure an `r8-heal-door` test that also failed in research 15's unchanged baseline; the 13 delivery-reaching files 159 / 151 / 8, the same 8 failures by name as research 16's baseline; screens-intake 375 / 375; interface-shell 321 / 321; capture's 49 files 366 / 366. `plane/worker.test.mjs` passed 7 / 7 unfixed, so its fix was not applied. [MEASURED, section 2]
3. **Bundle: 28,418,968 bytes and 856 inputs** (base 28,418,158 and 853, rebuilt here byte-identical to research 15's base). The new inputs are `capture/filing.mjs`, `pl/launch.mjs` and `pl/ui.mjs`. **All 15 served answers under workerd have the same status, type, CSP, length and full-body sha256 as the base bundle's. The page script composed as research 16 M6 did is byte-identical to base** (5,270,912 bytes, `54986cba…749b`). [MEASURED, section 3]
4. **UI-less build: 25,146,334 bytes, 725 inputs, 0 UI inputs.** The 9 non-page requests answer as the full program does. The 6 page routes answer 404 `NO_INTERFACE` (116 bytes), as in research 15. [MEASURED, section 3]
5. **`p4 check`:** control-plane 49 disagreements (research 15: 52), plane 159 (research 15: 159), the top module `product` 1 (research 15: none), capture 3 (the same 3 as on base). None of the new disagreements is in a `src/` file. [MEASURED, section 4]
6. **Size:** product code 7 files, +261 -209; tests 10 files, +23 -10; module list 5 files, +28 -28; one trial-only entry +7. Against research 15 the join drops `pl/store.mjs`'s change, 3 test files and `worker.test.mjs`'s fix, and adds research 16's 3 code files and one module record. [MEASURED, section 5]

## 1. The join

Scratch worktree `joined` from `git worktree add --detach … a26a8da2` under `…/scratchpad/`, with `node_modules` linked for `agent-runner`, `bio-plane`, `file-scanner`, `newgroup`, `ocr-worker`, `pdf-worker` and `sheet-worker`, as research 15 did. A second, unchanged worktree `base21` held the base builds of section 3. Both were removed at the end (`git worktree remove --force`; `git worktree list` then shows only the main checkout). Scripts and raw outputs are in `…/scratchpad/w21/`, which can be cleared. [MEASURED]

Steps, all [MEASURED]:

1. `git apply alt1.patch`: no error.
2. `diff.patch`, filtered by a script (`w21/door-filtered.patch`), then `git apply --recount`. The script left out:
   - the whole sections for `pl/store.mjs`, `control-plane/r124-owed-render.test.mjs`, `t51-g43-embed.test.mjs`, `t51-visitor-copy.test.mjs` and `plane/worker.test.mjs`;
   - four hunks of `cp/index.mjs`. `@@ -35,8` is the R124 import, where alt1's `import { titleOf, promoteDocument } from "../capture/filing.mjs";` stays. `@@ -740,7` is `deliverOwedRender`'s second argument. `@@ -783,6` is the `NO_DOCUMENT_COMPOSER` refusal. `@@ -793,8` is the `composer.` calls, where alt1's calls stay.

   Every other section applied cleanly, four hunks of `cp/index.mjs` at an offset of -2 lines.
3. Edits by hand, each matched once in its file:
   - `pl/launch.mjs`: `export { Store } from "./store.mjs";` in place of `export { Store, storeWith } …`, and its header comment no longer names `storeWith`.
   - `pl/index.mjs`: `import { launch } from "./launch.mjs";`, `import { INTERFACE } from "./ui.mjs";`, `export { Store } from "./launch.mjs";`, `export default launch({ ui: INTERFACE });`.
   - `pl/ui.mjs`: the `CAPTURE_SCREEN` import and `DOCUMENT_COMPOSER` are gone, and its header comment no longer names the Store or the capture screen.
   - `control-plane/harness-ui.mjs` (the door patch's helper): it destructures and re-exports `INTERFACE` only. The brief did not name this edit. Without it the helper would re-export a name `ui.mjs` no longer has, and the value would be `undefined`.

What the code says after the join [READ in the scratch tree, before removal]:

- `cp/index.mjs:39` `import { titleOf, promoteDocument } from "../capture/filing.mjs";`
- `:733` `export async function deliverOwedRender({ ctx, env, storeName = "bio", answer, session } = {}) {` (one argument)
- `:786` to `:787`: `titleOf(cs, …)` and `await promoteDocument(cs, …)`
- `pl/store.mjs:12` and `:41` unchanged: `assembleStore(ctx, env, { deliver: deliverOwedRender })`
- `grep -nE 'from "\.\./(screens-|interface-)'` over `cp/*.mjs`, `pl/launch.mjs`, `pl/store.mjs` and `pl/door.mjs` printed nothing (exit 1). So no door or launcher code file imports a UI folder by a relative path of that form. [MEASURED]

**The brief's "12 page test fixes".** The door patch, less the three delivery files, changes 9 page test files (`doors`, `page-policy`, `r8-phase-clock`, `t46-app`, `t48-door`, `t50-door`, `t51-interfacewords`, `t51-page-log`, `t51-server-timing`) and adds `harness-ui.mjs`. Research 15's "12" counted the three delivery files with them (its section 5). All 9 were applied. [MEASURED: the patch's file list]

**The module records** are the door patch's (control-plane and plane after store-request, a new last module `product` owning `pl/index.mjs` and `pl/ui.mjs`) plus alt1's `screens-capture.json` `uses: ["capture"]`. `product.json`'s `uses` still names `screens-capture`, as the door patch wrote it. Section 4 shows what the check says of that.

**`combined.patch`** is `git diff a26a8da2` in the scratch tree, after `git add -N .`: 911 lines, 23 files. Running the 13 delivery files wrote one report file into the tree, `build/plan/walk-T51-final/05-vouch.rows.md`, from the walk script `05-vouch.test.mjs` (research 16 notes this). I removed it before taking the final diff, so it is not in the patch. `git apply --check combined.patch` in the clean `base21` tree printed no error. [MEASURED]

## 2. Tests

Command, as research 15 and 20 used it: from the tree's top, with `GH_TOKEN`, `GITHUB_TOKEN`, `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_ID_TOKEN_REQUEST_TOKEN` and `NODE_TEST_CONTEXT` removed, `node --import ./bio-plane/test/platform-sqlite.mjs --test --test-reporter=spec --test-reporter=junit <files>`. That is `process.json`'s `test_command` with reporter flags. There was one call per set, as in research 15. The 13 delivery files ran one call per file, as research 16's `pair.mjs` ran them. The file lists are research 15's `sets` (a, b, d) and research 16's `testsThatReachTheDelivery` + `thirteenthReachingTest` and `extra` (capture's 49, without `store-assembly/words.test.mjs`) from the two `results.json`. All files exist in the tree. I ran the sets one after another and nothing else alongside. Before the first run `ps` showed no `workerd` or `node --test` process. Research 16's equal-trees runs had the members' bundles built, so before the runs I built the seven members' bundles in the scratch tree (`node scripts/build.mjs` in each; `dist/` is ignored by git there). The base tree's sets were not run again here. "Before" figures are the trials' recorded ones. [MEASURED]

| set | files | joined: tests / pass / fail | seconds | 1-min load, start → end | recorded before | recorded after the trial |
|---|---|---|---|---|---|---|
| control-plane, whole | 95 | 564 / 564 / 0 | 197.4 | 0.75 → 2.38 | 564 / 564 / 0 (r15) | door: 564 / 564 / 0 after 12 test fixes (r15) |
| plane A1 (set b) | 27 | 99 / 98 / 1 | 254.2 | 2.38 → 1.94 | 99 / 97 / 1 + 1 cancelled (r15) | door: 99 / 95 / 4 (loaded), 99 / 99 in the same-time run (r15) |
| reach the delivery | 13 | 159 / 151 / 8 | 1,902.5 | 3.19 → 0.16 | 151 of 159 (r16) | alt1: 151 of 159, same 8 (r16) |
| screens-intake | 41 | 375 / 375 / 0 | 350.5 | 1.94 → 1.70 | 375 / 375 (r15, r16) | 375 / 375 (both) |
| interface-shell | 37 | 321 / 321 / 0 | 95.0 | 1.70 → 2.49 | 321 / 321 (r15, r16) | 321 / 321 (both) |
| capture's own | 49 | 366 / 366 / 0 | 32.4 | 2.49 → 3.19 | 366 / 366 (r16 `extra`, 49 capture files) | 366 / 366 (r16) |
| `plane/worker.test.mjs` alone | 1 | 7 / 7 / 0 | 23.9 | 0.03 → 0.77 | | door, unfixed: 1 failed (r15) |

Details [MEASURED]:

- **control-plane.** All 564 pass with `r124-owed-render`, `t51-g43-embed` and `t51-visitor-copy` as on `a26a8da2`. These are the 14 tests research 15 found failing `NO_DOCUMENT_COMPOSER` with the door patch alone. With the delivery calling `filing.mjs` directly they need no change. The 9 page files pass with the door patch's fixes.
- **plane A1.** The one failure is `r8-heal-door.test.mjs` "R102 G93 L: a member's ordinary read (op=whoami) re-arms a lost alarm as well" (`the first firing did not end with a row owed`, 145 s). Research 15 recorded this test failing in its unchanged baseline and found `r8-heal-door`'s tests failing by turns on both trees. `l79`'s 5 tests passed (the restart test 22.0 s). `r8-timing-hook`'s 3 passed. `worker.test.mjs`'s 7 passed.
- **`worker.test.mjs`.** Its assertion `assert.equal(entry.Store, PlaneStore, "the class is R1's")` passes unfixed: the entry now re-exports `pl/store.mjs`'s own `Store`, so the fix of research 15 was not applied.
- **The 13 delivery files, per file** (tests / pass, joined; research 16's baseline in brackets where it differs: none):

  | file | tests / pass |
  |---|---|
  | `r124-owed-render` | 14 / 14 |
  | `t51-visitor-copy` | 1 / 1 |
  | `t51-g43-embed` | 5 / 5 |
  | `t51-held-failed` | 1 / 1 |
  | `t51-large-pdfs` | 1 / 1 |
  | `t51-round10-seam-htmlparts` | 1 / 1 |
  | `t51-round5-press-seam` | 4 / 4 |
  | `t51-round5-seam` | 8 / 8 |
  | `t51-round6-seam` | 7 / 7 |
  | `t51-round7-seam` | 18 / 17 |
  | `t51-round8-seam` | 17 / 17 |
  | `05-vouch` | 1 / 1 |
  | `t51-round9-seam` | 81 / 74 |

  The failure in `t51-round7-seam` is "R105 (G60): a case whose cited document the case gate finds a problem in …", as in research 16. The 7 failures in `t51-round9-seam` equal research 16's baseline list by name (a sorted comparison printed `true`). `t51-round9-seam` took 1,255.8 s; research 16 recorded 1,258 s at load 0.29.
- **screens-intake, interface-shell, capture, per file.** Each of the 127 files has the same test and pass counts as research 16's changed-tree per-file record (`perfile.mjs`: `compared 41 / 37 / 49, differing 0`). For the four real-browser files research 16's short-temp rerun was used. Here they passed in the set run, with `TMPDIR=/tmp`.

INFERENCE from the table: on these sets, the join gives the results each trial recorded on its own, with fewer test changes than the door trial needed. This is not established beyond these sets (see "What I did not check").

## 3. Build, served bytes, page script, UI-less build

Builds used the product's own `buildMember` over `planeMember()` (`bio-plane/scripts/fleet-bundle.mjs`) with `write: false`, so nothing was written into either tree (`w21/buildvar.mjs`). This was research 15's method for its UI-less build. Research 15 built the full bundles with `scripts/build-plane.mjs`, which writes the same bytes through `writeMember`. Each full bundle was built twice. [MEASURED]

| bundle | bytes | sha256 | inputs | UI inputs |
|---|---|---|---|---|
| base (`base21`), both builds | 28,418,158 | `da5f1a92…54fc` | 853 | 130 |
| joined, both builds | 28,418,968 (+810) | `9c11f0e9…e0a4` | 856 | 130 |
| joined, `trial-door/launcher-only.mjs` | 25,146,334 | `fba95b67…1992` | 725 | 0 |
| research 15 door trial (recorded) | 28,419,491 (+1,333) | `1460daa3…4b64` | 855 | 130 |
| research 15 launcher-only (recorded) | 25,141,248 | `b140d9db…7282` | 724 | 0 |

- The base build equals research 15's recorded base byte for byte (same sha256).
- The joined inputs are base's 853 plus `src/capture/filing.mjs`, `src/plane/launch.mjs` and `src/plane/ui.mjs`. None was removed (set difference of the two input lists).
- The launcher-only inputs are the joined inputs less 132 (the 130 UI files, `pl/index.mjs` and `pl/ui.mjs`), plus its own entry. INFERENCE from the counts: the one input more than research 15's 724 is `capture/filing.mjs`, which the door now imports. Its 5,086 more bytes are that file and the delivery code that was cut out of research 15's launcher-only bundle. Not traced further.

**Served answers under workerd** (`w21/mfrun.mjs`, research 15's `mf-run` method). Miniflare runs the built bundle with `plane/worker.test.mjs:19-27`'s options and the same 15 requests: `/version`, six ops, `/app`, `/`, the script at the address the page names, `civicsmith.css`, the group logo, `/doorbell`, an unknown address, `/favicon.ico` and `/bootstrap`. [MEASURED]

- base against joined: status, content type, `content-security-policy`, body length and full-body sha256 are equal for **15 of 15**. The script is 4,423,473 bytes, sha256 prefix `ac144ee84971f903`. The page is 3,520 bytes, `bb573c6f7d273a8d`.
- The first 16 hex digits of every base body hash, and every status, equal research 15's recorded "before" rows (15 of 15).
- Unlike research 15's door copy, the join keeps the same top-level `const door` in `pl/launch.mjs`, from the door patch. I did not try another name.

**Page script, research 16 M6** (its `script.mjs`, saved in `trial-capture/results.json`, run with `--import platform-sqlite.mjs`) [MEASURED]:

- Base and joined each produced 78 screens, 5,270,912 bytes, sha256 `54986cba78d7d4a6e7e207faefde0b1f174e77f0a37901a5c0b9437faaae749b`, and `interfaceScriptHash` `sha256-VJhsunjX1Kbn4gf6794LHxdOd/CjeQGlwLlDf6qudJs=`.
- `cmp` of the two files: identical.
- `function titleOf(cs, o)` is at 2,328,989 and `promoteDocument` at 2,307,595, the offsets research 16 recorded.

**The UI-less bundle under workerd** [MEASURED]:

- These 9 answer exactly as the base bundle (same status, type and sha256): `/version`, `selftest` 401, `bootstrap`, `stats` and `affordances` with the admin bearer, `nosuchop` 400, the group logo 404, `/favicon.ico` 204, `/bootstrap`.
- These 6 answer 404 `application/json`, 116 bytes, sha256 prefix `1264b4f4aed68b9d`: `/app`, `/`, the script, the stylesheet, `/doorbell`, `/nothing-here`. This is research 15's `NO_INTERFACE` answer, also 116 characters there.

## 4. `p4 check`

`node /root/process4/0eec86fd8ddcffbc804b761e18095a52a80a5288/tool/p4.mjs check <module>`, from each tree's top, token variables removed. Outputs are in `w21/check/`. The first line of each output and its disagreements [MEASURED]:

| module | base (`a26a8da2`) | joined | research 15 (door, pass 2) |
|---|---|---|---|
| control-plane | no disagreement found | **49** | 52 |
| plane | 48 | **159** | 159 |
| product | no such module | **1** | no disagreement found |
| capture | 3 | **3** (the same lines) | not run |
| screens-capture | no disagreement found | no disagreement found | not run |

- **control-plane's 49** are all "imports <module>, which … does not declare in uses; <module> is later in the order". They are in 15 test-side files and 0 `src/` files. By module imported: interface-shell 19, screens-capture 7, product 1, the ten other UI modules 22.
  - The 7 screens-capture imports are `r124-owed-render`, `r130-killed-ways-in`, `r135-real-rows`, `t51-g43-embed`, `t51-visitor-copy`, `r8-seam-capture.mjs` and `r8-seam-misc.mjs`. These are research 16's seven control-plane files that still import the screen's file.
  - The one product import is `harness-ui.mjs:8`. Research 15 had 4 product imports. INFERENCE: the other 3 were the delivery files' fixes, which the join does not apply.
- **plane's 159** are the base's 48, with one line moved from `pl/index.mjs` to `pl/launch.mjs` (`Expected 2 arguments, but got 3`; a `diff` of the other lines is otherwise empty), and 111 later-module imports in 64 files, 0 in `src/`. By module: screens-capture 40, interface-shell 17, screens-inquiry 16, product 14, screens-intake 10, screens-public 5, screens-daily 4, screens-settings 2, screens-publish 2, interface-assets 1. These are the same totals as research 15's 48 + 111 in 64 files.
- **product's 1** is `process/modules/product.json declared uses disagree with the imports: declares screens-capture in uses, but neither its source nor its tests import it or call it by name`. The join's `ui.mjs` no longer imports the capture screen. Taking `screens-capture` out of `product.json`'s `uses` would answer it; I did not try it.
- **capture's 3** are the base's own: `capture/index.mjs:1938`, `:1939` and `t50-words.test.mjs:15`, all against setup-words' stated interface. `filing.mjs` adds none.
- I did not read the "cannot tell, not refused" lines: control-plane 3,707, plane 6,668, capture 4,220, screens-capture 260, product 0, by `grep -c`.

## 5. Size, against `a26a8da2`, by owner

`git diff a26a8da2 --numstat` in the scratch tree. Owners come from the scratch module records, using the longest listed path that matches across `files` and `tests`, as research 15 section 9 counted. [MEASURED]

| what | files | added / removed | research 15 | research 16 |
|---|---|---|---|---|
| capture, code (`capture/filing.mjs`, new) | 1 | 107 / 0 | | 1, 107 / 0 |
| control-plane, code (`cp/index.mjs` 21 / 27, `cp/app.mjs` 8 / 8) | 2 | 29 / 35 | 2, 32 / 36 | 1, 4 / 4 |
| plane, code (`pl/launch.mjs`, new) | 1 | 82 / 0 | 2, 98 / 2 (with `pl/store.mjs`) | |
| top module `product`, code (`pl/index.mjs` 12 / 71, `pl/ui.mjs` 28 / 0) | 2 | 40 / 71 | 2, 40 / 69 | |
| screens-capture, code (`screens-intake/capture.mjs`) | 1 | 3 / 103 | | 1, 3 / 103 |
| control-plane, tests (9 page test files, `harness-ui.mjs`) | 10 | 23 / 10 | 13, 32 / 13 | |
| plane, tests | 0 | 0 / 0 | 1, 1 / 1 | |
| trial only (`trial-door/launcher-only.mjs`) | 1 | 7 / 0 | 1, 7 / 0 | |
| module list (`order.txt` 3 / 2, `control-plane.json` 0 / 12, `plane.json` 0 / 13, `product.json` 24 / 0, `screens-capture.json` 1 / 1) | 5 | 28 / 28 | 4, 27 / 27 | 1, 1 / 1 |
| **total** | **23** | **319 / 247** | 25, 237 / 148 | 4, 115 / 108 |

Product code: 7 files, +261 -209. Of the added lines, 101 are research 16's two functions moved as they were and 59 are research 15's old entry moved into `launch.mjs` (both counts as those reports give them; not recounted here). Test code: 10 files, +23 -10.

## After a change

Not a design. These are what the measurements leave open if the lane takes this join.

- `product.json`'s `uses` would drop `screens-capture` to clear `check`'s one product disagreement (section 4).
- control-plane's seven test and kit files that import the screen's file are 7 of its 49 disagreements. Research 16's `trialB-alt1b` re-pointed six of them to `capture/filing.mjs`, and its tests passed there. That was not tried on the join.
- INFERENCE from `launcher-only.mjs` and the unchanged `pl/store.mjs`: a program with no UI now carries the document composer and can deliver an owed render, which research 15's UI-less program refused with `NO_DOCUMENT_COMPOSER`. An owed render delivered under workerd by the UI-less bundle would settle it. Not run.
- Research 15's and 16's own "After a change" points stand: R124's words in `control-plane.md:155`, `capture.md`'s "It writes no bundle", the door's text ties N01 and N03 to N12, and the load order resting on two import lines in `pl/index.mjs`.

## What I did not check

- **The base sets on this machine at this load.** I ran only the joined copy. Each comparison is with the trials' recorded runs, made at loads of 3 to 19, while here the load was 0.03 to 3.19. Only the builds, the served answers and the page script had base run beside them here.
- **Tests outside the named sets.** Research 15 counted 190 test files that reach its changed files and were not run. The join adds `filing.mjs`, whose other importers (plane's 40 and journey-check's 11 files that import the screen's file) were not run.
- **Repeated runs.** Each set ran once. The `r8-heal-door` failure and the passing `l79` and `r8-timing-hook` tests are single observations.
- **An owed render delivered inside workerd by the joined bundle's `Store`.** Eleven of the 13 delivery files run the plane in workerd from source (research 16's marks). I did not trace whether any of them takes the alarm path through the built bundle.
- **Start-up time** of the joined bundle (research 15's R54 rounds) was not measured.
- **`check`'s "cannot tell" lines**, and `check` for interface-shell, screens-intake and screens-action, which research 15 ran.
- **Research 16's composer comparison (M4) and import walk (M7)** were not repeated on the join. Here the delivery's packages are covered only by the 13 files' tests.
- **`p4 run tests`** itself: the sets ran through `test_command` directly, as research 15 and 16 did.
- **The workerd answers' timing** (`ms`) is recorded in `results.json` but not compared.
- **Nothing was deployed** or opened in a browser.
