# w4: the existing code of the ux lane's area (docs/development/ux-substrate/)

Checkout: `705f8823d1` (tranche = lane/ux tip, 6 Nov 2026 17:34 UTC). All paths are relative to the repo root. Sizes are in bytes. `max_file_bytes` = 1,048,576 (process/config.json:10).
I ran generators only in a scratch copy (`scratchpad/w4b`). Nothing was written to /home/user/civicsmith-copy or to w4.

## 1. File inventory (90 tracked files)

Kind: **S** = hand-edited source. **G** = committed output of a generator in the folder. **N** = notes or data that no build reads. **T** = tool or checker.

### Top level, marks/, visual-language/

| file | size | kind | built by | read by |
|---|---|---|---|---|
| README.md | 1,854 | S | – | people |
| layouts.html | **1,551,051** | G (frozen) | screens/build_page.py | journey-check design.mjs:15 (MOCK_PATH, `git show` at ASSETS_COMMIT); live.test.mjs:152; check_walk.mjs; check_words_drawn.mjs |
| marks/civicsmith-plumb-bob.svg | 444 | N | – | no code. Cited only in docs/architecture/BIO_Publication_v0_1.md:709. The same path is also `i-mark` in icons.svg:6 |
| visual-language/palette.json | 4,563 | S | – | build.py:6, check_contrast.py:37 |
| visual-language/tokens.head.css | 3,687 | S | – | build.py:8 |
| visual-language/components.css | 35,646 | S | – | build.py:10 |
| visual-language/build.py | 813 | T | – | runs by hand, or via build_page.py:74 |
| visual-language/check_contrast.py | 2,156 | T | – | build.py:12 (its exit code). No CI runs it |
| visual-language/civicsmith.css | 42,755 | G | build.py (tokens.head + palette + components) | interface-assets/generate.mjs:131 and site/test/browser.test.mjs:36, **at the pinned commit 1b6f2bc383** via `git show`; build_page.py:90 |
| visual-language/faces.css | 5,525 | S | – (README:9 wrongly says build.py builds it) | generate.mjs:132; browser.test.mjs:35; build_page.py:90 |
| visual-language/icons.svg | 8,671 | S | – (same: README:9 says it is built) | generate.mjs:157; browser.test.mjs:39; build_page.py:91 |
| visual-language/fonts/*.woff2 (15) + OFL-*.txt (3) | 4K–130K each, ~800K total | S (vendored) | – | interface-assets generate.mjs (git ls-tree at ASSETS_COMMIT); assets.test.mjs:29 |

### screens/ — the build's sources

| file | size | kind | built by / writes | read by |
|---|---|---|---|---|
| registry.src.py | 57,615 | S | – | check_library.py |
| library.src.py | 32,232 | S | – | check_library.py |
| check_library.py | 11,074 | T | writes registry.json, library.json (:125–130) | build_page.py:73. Not in CI |
| registry.json | 140,160 | G | check_library.py | journey-check/screens.mjs:10; build_words.mjs:33; build_page.py:76; 34 test read sites (op-declarations, screens-*, interface-shell…); snapshots in wizard-scripts/screen-registry.mjs:6 (commit 30af4350f2) |
| library.json | 47,202 | G | check_library.py | build_words.mjs:34; build_page.py:77; wizard-scripts/library.test.mjs:15, op-declarations t34/t46/t47/t48; snapshots in wizard-scripts/civicsmith-library.mjs:13–26 and front-doors.mjs:8 |
| mock-acts.js | 78,938 | S | – | build_words.mjs:23; build_page.py:88; tests op-declarations t37:237, t38:101, t48:280; affordances t36:437 |
| mock-kit.js | 19,630 | S | – | build_words.mjs:23; build_page.py:88; site/build.mjs:53 (`git show` at SITE_COMMIT); op-grades t48:228 and t50:95 (regex over the source in the working tree) |
| mock-screens.js | **915,652** (87% of the cap) | S | – | build_words.mjs:23,124; build_page.py:88; site/build.mjs:53 (at SITE_COMMIT); assets.test.mjs:505 (at ASSETS_COMMIT) |
| mock-shell.js | 39,040 | S | – | build_words.mjs:23,28; build_page.py:88; interface-shell design.test:57, frame.test:119 |
| mock-refs.js | 92,766 | S | – | build_words.mjs:23; build_page.py:88; assets.test.mjs:505 |
| mock-journeys.js | 35,318 | S | – | build_page.py:88; cited in journey-check/journeys.mjs |
| page.src.html | 146,563 | S | – | build_words.mjs:27 (`var G` marks table); build_page.py:89; interface-assets generate.mjs:16 (at ASSETS_COMMIT); browser.test.mjs:33; 6 other tests |
| question.html | 17,959 | S | – | build_page.py:91 only |
| build_page.py | 3,254 | T | writes ../layouts.html | nobody. Not in CI |
| team_words.py | 3,159 | S/T | – | words-modules.src.py:176 |

### screens/ — the word stream

| file | size | kind | built by / writes | read by |
|---|---|---|---|---|
| build_words.mjs | 79,487 | T **and S** | writes words.json (:551) and runs words-drawn.src.py (:47). Also holds 183 `add(...)` wording rows inline (sections 1–4e, 4i, 4o–4t at :368–478, 5–10) | config generated[1]; CI regression.yml:52, deploy-test.yml:108, release-sign.yml:57; pretest in bio-plane/agent-runner/agent-worker package.json. **Parsed as text** by journey-check/group-words.mjs:13–27 and site/test/site.test.mjs:513 (the regexes `TEAM_WORD` :53 and `GROUP_SENSE` :54) |
| words-actions.src.py → words-actions.json | 36,167 → 52,864 | S → G | python | build_words.mjs:351 |
| words-t46.src.py → words-t46.json | 14,383 → 17,864 | S → G | python | build_words.mjs:353 |
| words-t47.src.py → .json | 8,506 → 8,687 | S → G | python | build_words.mjs:355 |
| words-t48.src.py → .json | 88,221 → 113,710 | S → G | python | build_words.mjs:357 |
| words-t49.src.py → .json | 88,681 → 135,601 | S → G | python | build_words.mjs:39; words-reads.src.mjs:362,421 |
| words-mod-1..4.src.py → words-mod-1..4.json | 242–264K → 322–362K | S → G | python | build_words.mjs:366 (readdir `words-mod-\d+.json`) |
| words-modules.dump.mjs | 2,260 | T | writes a dump from a tranche extract | words-modules.src.py (argv) |
| words-modules.src.py → words-modules.json | 2,532 → 423,716 | T → G | needs the dump **and a built words.json** (:166) | build_words.mjs:359 |
| words-drawn.src.py + words-drawn-1..4.src.py | 2,044 + 420–424K each | S | writes words-drawn.json (gitignored, ~1.94 MB) | config generated[0]; build_words.mjs:47–48 |
| words.json | not tracked (~4.86 MB) | G | build_words.mjs | setup-words/build.mjs:19 → rows.mjs (bundled into the plane); 54 test files; 25 src comments; ux-design inventory.test.mjs:13 |
| words-reads.src.mjs | 53,178 | T | writes words-reads.json (:605). **Imports product modules** (:442,466,474,538), so it needs `setup-words/rows.mjs` built first | config generated[3] (regenerate `--build`, verify without it); regression.yml:54 |
| words-reads-mod-1..4, -6.json | 275K, 529K, 146K, 624K, 730 | **N/S: hand-kept, no generator** (words-mod-2..4.src.py only cite them in comments) | – | words-reads.src.mjs:569 |
| words-reads-mod-5.src.mjs → words-reads-mod-5.json | 4,676 → 33,866 | T → G | needs a tranche extract | words-reads.src.mjs:569 |
| words-reads-handoffs.json | 237,547 | S (hand-kept, DEC-344) | – | words-reads.src.mjs:598 |
| words-reads-requirements.mjs | 1,410 | S | – | words-reads.src.mjs:30; ux-design/module-entries.test.mjs:10 |
| words-reads.json | not tracked (~2.6 MB) | G | words-reads.src.mjs | newgroup/scripts/build.mjs:21; 29 test read sites; module-entries.test.mjs:14 |

### screens/ — checkers, baselines, notes

| file | size | kind | read by |
|---|---|---|---|
| check_walk.mjs | 4,640 | T (Playwright over layouts.html) | nobody. Not in CI |
| check_words_drawn.mjs | 13,839 | T (Playwright, layouts.html against words.json) | nobody. Not in CI |
| words-drawn-baseline.json, words-drawn-tips-baseline.json | 1,325, 1,340 | G (by `check_words_drawn.mjs --write-baseline`) | check_words_drawn.mjs only |
| refusals-dec342-skipped.json | 20,016 | N (DEC-342 record, origin/main as of 18 Oct) | nothing |
| slice-DEC-283.json | 17,999 | N (a one-off slice for tranche/R085) | nothing |
| parked-T52.md | 3,895 | N (notes) | cited only in a comment in words-drawn-4.src.py |
| later-ux-T52-triage.md | 4,609 | N (notes) | nothing |
| walk-T51b-triage.md | 9,787 | N (notes) | nothing |

## 2. Build graph

```
palette.json + tokens.head.css + components.css --build.py--> civicsmith.css --(check_contrast.py)
civicsmith.css, faces.css, icons.svg, fonts/ ...(pinned 1b6f2bc383, git show)...> bio-plane/src/interface-assets/generate.mjs -> index.mjs (ASSETS_COMMIT, :11) -> interface-shell, newgroup, site
page.src.html ......................................(pinned 1b6f2bc383)...> interface-assets shell.css ; site/test/browser.test.mjs
mock-kit.js + mock-screens.js ......................(pinned SITE_COMMIT 1b6f2bc383, site/build.mjs:15,53)...> site/src/pages.mjs

registry.src.py, library.src.py --check_library.py (git archive <ref> build/requirements)--> registry.json, library.json
registry/library/mock-*.js/page.src.html/question.html/civicsmith.css/faces/icons --build_page.py--> layouts.html (1.55 MB, frozen)
layouts.html ...(at ASSETS_COMMIT)...> journey-check/design.mjs (R6 mock pairs)

words-actions|t46|t47|t48|t49|mod-1..4 .src.py --python--> matching .json (committed)
words-modules.dump.mjs(tranche extract) + words.json --words-modules.src.py--> words-modules.json (committed)
words-drawn.src.py (+1..4) --> words-drawn.json            [generated row 0, untracked]
mock-*.js + page.src.html + registry + library + all *.json above + inline add() rows --build_words.mjs--> words.json   [row 1, untracked]
words.json + product source --setup-words/build.mjs--> rows.mjs, words-unreviewed.json                              [row 2, untracked]
words.json + rows.mjs + product source + words-reads-mod-*.json + handoffs + requirements.mjs --words-reads.src.mjs--> words-reads.json [row 3, untracked]
words-reads.json --> newgroup/scripts/build.mjs:21 (bundle key filter)
```

Run in w4b, all green: build_words (0.9 s, 19,981 words, 1,208 protected), then `setup-words build` (6 s), then `words-reads --build` (28 s, 168 modules, 19,766 keys read, 6,036 unkeyed), then verify. `setup-words --check` and `build_words --check` pass. `visual-language/build.py` reproduces civicsmith.css byte for byte, and contrast passes.

## 3. process/config.json and the process checks

| item | where | note |
|---|---|---|
| lane row `ux`, dir, module `ux-design` | process/config.json:28–32 | |
| generated[0] words-drawn.json | :59–71 | verify = `setup-words build --check` |
| generated[1] words.json | :72–84 | verify is the same |
| generated[2] rows.mjs, words-unreviewed.json | :85–97 | |
| generated[3] words-reads.json | :98–117 | regenerate `. --build`; verify `.` |
| untracked: words.json, words-drawn.json, words-reads.json | .gitignore:351–355 | "over max_file_bytes, built and never committed" |
| lane PR = records-only path: no suite, no install, **no build or generated rows** | .process/tool/lib/gate.mjs:253–265, util.mjs:452 | Only the record checks run. A committed generated output is a finding (:258) |
| lane files count as records after a job's green run | gate.mjs:268–271 | A lane land does not send a job back through its suite |
| size: record check refuses any commit writing a blob > max (waived only if the head is ≤ max and the blob ≤ 2×max) | .process/tool/lib/record.mjs:359–414 | |
| pushcheck refuses a push that grows a file over the cap | .process/tool/lib/pushcheck.mjs:34 | |
| ux-design ledger entry: paths = lane dir + build/requirements/ux-design.md + docs/requirements-notes/ux-design.md; tests bio-plane/test/m/ux-design/; uses setup-words; layer 11 | process/ledger/ux-design.json | Not in build/modules.json (no `ux-design` entry there) |

## 4. Product code that reads this folder or is shaped by it

**Live working-tree reads** (a lane edit takes effect at the next build or test):
- `bio-plane/src/setup-words/build.mjs:19,22`: words.json → rows.mjs, bundled into the plane. This is the route every shipped word takes.
- `bio-plane/src/journey-check/screens.mjs:10`: registry.json (the sweep's screens).
- `bio-plane/src/journey-check/group-words.mjs:13–27`: regex-extracts `TEAM_WORD` and `GROUP_SENSE` from build_words.mjs source. The pattern is `^const NAME = /…/;` on one line.
- `site/test/site.test.mjs:513`: the same extraction of `GROUP_SENSE`.
- `newgroup/scripts/build.mjs:21`: words-reads.json.
- Tests: 54 files read words.json, 29 sites read words-reads.json, 34 read registry.json, 5 library.json, 4 mock-acts.js, 2 mock-kit.js (regex over the source, op-grades t48:228), 2 mock-shell.js, 7 page.src.html, plus `bio-plane/test/m/ux-design/inventory.test.mjs:13,73` (words.json, words-unreviewed.json) and `module-entries.test.mjs:10,14`.
- Build commands: `.github/workflows/regression.yml:52,54`, `deploy-test.yml:108`, `release-sign.yml:57`, `bio-plane/package.json:6`, `agent-runner/package.json:15`, `agent-worker/package.json:8`, `bio-plane/scripts/release-assemble.mjs:111,286`.

**Pinned reads** (a lane edit has no effect until a requirement moves the pin):
- `bio-plane/src/interface-assets/generate.mjs:12–16` and `index.mjs:11`: `ASSETS_COMMIT = "1b6f2bc383"`, for visual-language/ and screens/page.src.html.
- `site/build.mjs:15` and `site/src/pages.mjs:3`: `SITE_COMMIT = "1b6f2bc383"`, for mock-kit.js and mock-screens.js (site/build.mjs:53), and page.src.html, faces, civicsmith.css and icons (browser.test.mjs:28–39). `site.test.mjs:496` asserts SITE_COMMIT equals ASSETS_COMMIT.
- `bio-plane/src/journey-check/design.mjs:15,26–29`: layouts.html at ASSETS_COMMIT.
- `bio-plane/src/wizard-scripts/screen-registry.mjs:6` (registry at 30af4350f2), `civicsmith-library.mjs:13–26`, `front-doors.mjs:8` (library at 1cc4a957f0, with sha256).
- `bio-plane/src/affordances/act-help.mjs:7`: mock-acts.js at f498560a37 (a copy).

All of these need the pinned commit in the clone, so a shallow clone fails them. Everything at 1b6f2bc383 equals HEAD apart from the two files the cleanup removed (`git diff --stat 1b6f2bc383 HEAD`).

## 5. Recent history

`git log -40 -- docs/development/ux-substrate` (newest first, selected):

| commit | date | what |
|---|---|---|
| 4f21de194b | 11-06 | merge tranche into lane/ux |
| 25433af739 | 11-06 | ux-design: write act.guideoptout.does (reading-guides R20) |
| ef9a2c7fde | 11-06 | revert of the revert: the cleanup stands |
| 8352f1b9b9, d8643a67f5 | 11-06 | guideoptout written, then reverted |
| 429f06210d | 11-06 | "Revert the ux-substrate folder cleanup; BOB holds it for later" |
| **dea48973e3** | 11-06 | cleanup: 49 files, −40,887 lines |
| c4ac9c5370 … 0afcdf5720 (10) | 11-05 | ux-design R3 batches "carried from lane PR 525–539" |
| ab178e8823 | 11-05 | words-drawn.src.py (1.68 MB) split into 4 batches |
| b7212b12f9 | 11-05 | untrack words.json and words-drawn.json |
| b3a217f17c | 11-05 | build_words builds words-drawn first; gains `--check` |
| 598e386275, 848fcb7911 | 11-04 | words-reads.json built, not committed; `--build` |
| 30784d14d9 | 11-04 | .cs-btn min-height var(--tap) (civicsmith.css) |
| 9b799bb7ea | 10-28 | DEC-488: **the last write of layouts.html** |

**dea48973e3 removed:** HANDOFF.md, NEXT-SESSION-PROMPT.md, T50-requirements-gaps-2026-10-17.md, archive/ (22 handoff files), the design pages (brand-and-voice, dashboards, design-principles, journeys, measures-map, new-name, question-federal-office, questions-alpha-walk, ux-substrate, visual-language .html, views/*.html), build_ux.py, build_ux2.py, oq-research/out0–2.json, ux-experience.json (17,740 lines), ux-substrate.json, ux-substrate-v2.json, visual-language/build_page.py and page.src.html. It rewrote the README. No product code reads any removed file: the only code hit is a comment at `bio-plane/src/machinery-producers/index.mjs:918` (`ux-experience.json` UC-035). Old job notes under build/jobs/ still cite ux-substrate-v2.json and ux-experience.json; these are historical.

**Remote lane branches** (`git ls-remote`). None is an ancestor of HEAD (fetched at depth 2, so ancestry is approximate). By their subjects, their content was carried into the tranche by cherry-pick ("carried from lane PR …"), so they are leftovers. Sessions may not delete them; the cleanup workflow will not either, because a cherry-picked commit is not "in the tranche".

| branch | tip | subject |
|---|---|---|
| lane/ux | 705f8823d1 | = tranche HEAD |
| job/ux-design | 8d38a4bf80 | merge row for ux-design (PR 622) |
| lane/ux-ai-availability | 3d42d347fa | AI availability words |
| lane/ux-ai-use-r13, -built | f355159ad2, 45c507ed05 | ai-use R13 words settled |
| lane/ux-document-beta, -built | c14c0c175d, 86cd6096b1 | screens-document-beta words |
| lane/ux-guideoptout | 95f1ebed19 | act.guideoptout.does |
| lane/ux-notices, -built | d88c10c9e4, e0df7e26c5 | queue and notice words |
| lane/ux-screens-named | df53b4a158 | inventory flips (screens-action R62 …) |
| lane/ux-screens-owed-1..4 | 3118d41c37, 02bb088e66, 12fa64f72f, 1ae26328f3 | inventory flips / owed words |
| lane/ux-screens-small | 9c9c398853 | inventory flips (case-import R36 …) |
| lane/ux-team-words | 16aeb2fda2 | team, never group |
| lane/ux-words-built | 53dfaf4d2b | words.json and words-drawn.json built, not committed |

## 6. Health findings

| # | finding | evidence |
|---|---|---|
| H1 | **layouts.html is over the size cap and frozen.** At 1,551,051 bytes it is 148% of max_file_bytes. Any commit that writes it is a record-check finding and cannot be waived, because the head stays over the cap. README:3 and :8 present it as built, and CLAUDE.md says a lane's large built files are "never committed". | record.mjs:359–414; .gitignore has no entry for it; last write 9b799bb7ea (10-28) |
| H2 | **layouts.html is stale and cannot be rebuilt green.** civicsmith.css changed after it was built (30784d14d9, .cs-btn). build_page.py stops when check_library.py fails, and check_library.py fails at HEAD with 15 FAILs: registry acts that are no longer ops (groupkeyset, groupkeyswitch, groupkeyremove, groupkeynoticeseen, accountreferenceset/remove, subscriptiondisconnect, projectkeyset, projectsigninset, projectaccountswitch/remove, projectkeynoticeseen; screens setup, connect, teamai, queue, projectai). | build_page.py:73; check_library.py output in w4b |
| H3 | **check_library.py's default ref does not exist.** It defaults to `origin/main` (:61), but this clone and /home/user/civicsmith-copy have no `refs/remotes/origin/main`. It silently falls back to HEAD (:36), so the committed `checkedAgainst: "origin/main"` cannot be reproduced. Rebuilding also rewrites the module lists in registry.json (+99/−135 lines). | registry.json:2; w4b diff |
| H4 | **words-actions.src.py and words-actions.json disagree.** The source says `door.escalationdecline` = "Hold at this stage" (DEC-376 draft, 3e7d30cec4). The committed JSON, and so the shipped words.json, says "Decline to escalate". Nothing checks that a `.src.py` matches its `.json`. The other 8 word sources regenerate identically. | words-actions.src.py:282; words-actions.json:1695–1696; b7212b12f9^:words.json:3771 |
| H5 | **build_words.mjs is both generator and source.** It holds 183 inline `add()` rows plus the lane's T53 wording (sections 4o–4t, :368–478). Product code reads it as text: group-words.mjs:17–27 and site.test.mjs:513–514 regex out `TEAM_WORD`/`GROUP_SENSE` (:53–54). Reformatting either line breaks journey-check R17 and site R16. | as cited |
| H6 | **Lane PRs run no suite and no build, yet the folder feeds the plane.** words.json → rows.mjs is bundled. 54 test files read words.json, and others read registry, mock-kit.js, mock-acts.js and mock-shell.js from the working tree. A lane PR that breaks build_words (a duplicate key, empty text, a missing reword target) or changes a word a test asserts lands green. It surfaces only at the next code PR or layer close. | gate.mjs:253–265 (no generated rows on that path); build_words.mjs:57–60 fail() |
| H7 | **The inventory rule conflicts with the lane-only path.** ux-design R1 wants docs/requirements-notes/ux-design.md updated in the same commit as any words change (ledger prior_work; inventory.test.mjs:1–4). That file is outside the lane folder, so such a PR is not lane-only and takes the code path. | process/ledger/ux-design.json paths |
| H8 | **"Holds only what the build reads" (README:3) is not true.** Read by no build or test: marks/civicsmith-plumb-bob.svg (and it duplicates icons.svg `i-mark`); refusals-dec342-skipped.json; slice-DEC-283.json; parked-T52.md; later-ux-T52-triage.md; walk-T51b-triage.md. Run by nothing in CI or the process: check_walk.mjs, check_words_drawn.mjs and its two baselines, build_page.py, question.html (build_page only), mock-journeys.js (build_page only), check_library.py, check_contrast.py. | grep results §1 |
| H9 | **README:9 is inaccurate.** build.py builds only civicsmith.css; faces.css, icons.svg and fonts/ are hand sources. And "site/test/browser.test.mjs and the interface read them" is true only at the pinned 1b6f2bc383, so the working copy reaches neither. README:7–8 omit the live-tree consumers that matter most: setup-words, journey-check (registry, build_words text), newgroup (words-reads.json), and the tests reading mock-*.js. | README.md:7–9 |
| H10 | **Some committed inputs have no generator, and some need a full rebuild to reproduce.** words-reads-mod-1..4 and -6 (about 1.6 MB together) are hand-kept with no generator. words-modules.json is reproducible only from a tranche dump plus a built words.json: words.json is built from words-modules.json, and words-modules.src.py reads words.json (:163–167). words-reads-mod-5.json and words-modules.json both need an external tranche extract. | words-reads.src.mjs:569; words-modules.src.py:163–167; words-reads-mod-5.src.mjs:6–8 |
| H11 | **words-drawn.src.py runs twice per build.** Generated row 0 runs it, and build_words.mjs:47 runs it again as row 1. This is harmless. Separately, words-reads.src.mjs imports product modules and needs rows.mjs built first, an order dependency that the config's row order alone guarantees (rows 1 → 2 → 3). | process/config.json:59–117 |
| H12 | **mock-screens.js is near the cap.** It is at 915,652 bytes (87%), and the words-drawn batches are at about 420K each. Its next big growth will need a split, as words-drawn and words-mod were split. | sizes |
| H13 | **Committed files duplicate pinned copies.** wizard-scripts carries 10 historical library.json pins and one registry pin with sha256 (civicsmith-library.mjs:13–26). interface-assets/index.mjs carries a full copy of civicsmith.css, icons and fonts. Edits to registry, library or visual-language reach the product only when a module requirement moves its pin. That is by design, but nothing in the lane folder says so. | as cited |
| H14 | **Branch clutter.** 17 remote lane/ux-* branches (including `-built` twins) whose content was cherry-picked into the tranche. | §5 |

## Open questions

1. Should layouts.html leave the tree (built at layer close or deploy like words.json, with design.mjs reading a built file), or be split under the cap? While it is pinned via ASSETS_COMMIT, journey-check can keep reading the old blob from git. What should the plan be when the pin moves?
2. Is check_library.py's 15-FAIL state known? Are the registry's groupkey/projectkey acts meant to be renamed to the DEC-420 AI-account acts (aiaccount*), or marked `owed:`?
3. Which wording for `door.escalationdecline` is intended, the source's "Hold at this stage" or the shipped "Decline to escalate"? Should a check compare each `words-*.src.py` with its JSON (or should the JSONs be generated and untracked)?
4. Should the inline wording in build_words.mjs (4o–4t, and sections 1–10) move into a `words-*.src.py`, so the generator holds no wording and the `TEAM_WORD`/`GROUP_SENSE` regexes become a data file that group-words.mjs and site.test.mjs read as JSON?
5. Should a lane PR at least run `build_words --check` (or the generated rows 0, 1 and 3), given the gate skips them on the lane path?
6. Do the notes and data that no build reads (H8) go to artifacts or history, as the cleanup did for the rest? Do the hand-kept words-reads-mod-*.json and handoffs.json count as sources (they are read)?
7. Who deletes the 17 stale lane/ux-* branches, given the session rule forbids it and the cleanup workflow will not touch cherry-picked branches?

## Ground truth

- Checkout `705f8823d1`; 90 tracked files in the folder; the process is pinned at the submodule in tree.
- Ran in scratch copy w4b: 9 word `.src.py` (only words-actions drifts), visual-language/build.py (no diff), build_words.mjs then `setup-words build`, `words-reads --build` and verify, `setup-words --check`, and `build_words --check` (all exit 0), and check_library.py (exit 1, 15 FAIL, against HEAD).
- I did not run build_page.py, check_walk.mjs or check_words_drawn.mjs (no Playwright run; build_page is gated on check_library).
- Lane branch subjects came from a depth-2 fetch, so the "carried" judgement rests on commit subjects, not patch-id comparison.
