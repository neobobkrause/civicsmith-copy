Length: 216 lines. Last section: "What I did not check".

# 16. Trial: the delayed-capture tie (T17), measured

Made 23 and 24 Nov 2026 by a worker of civicsmith plane-scope lane #1, on `origin/p4-tranche` at `a26a8da2`. The main checkout holds only this file and `trial-capture/` from it. Scratch trees, left in place as the brief asks (so evidence-rules' "removed when you finish" is not followed here), under `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/`: `trialB` (unchanged: every baseline), `trialB-alt1` (Alternative 1), `trialB-neg` (section 7's control). Scripts, logs and outputs: `w16/` there. A fourth tree, `trialB-alt1b`, is Alternative 1 with control-plane's own tests re-pointed (section 5). Paths below are under `bio-plane/src/` unless they say otherwise; `cp` is `control-plane`; `T/` is `bio-plane/test/m/`. The machine has 4 CPUs shared with other workers: `uptime` load was 5 to 19 before a restart of the container at 23:56 UTC and 0.1 to 17 after it; it is given beside each timing. What the restart cost is in the last section.

## Headlines

1. **Do the three composers produce the same bundle? No.** [MEASURED M4] For each of six documents, the screen's composer (as `deliverOwedRender` runs it), `cp/archive.mjs` and `store-door/pull.mjs` each asked the record to store a different package: 18 of 18 pairs differ. They differ in the id's slug, the title, the text of `bundle.md`, the bytes of `data/provenance.json` (indent 1 against 2; the same JSON once parsed), and `meta`; only the screen's sends `data/dataset.json` and attestation files; `pull` sends one file where the document has parts. Section 2 lists every difference.
2. **What the ruling requires.** [READ, a lead] K4493 (`build/rulings.md:4488`, "BOB's", 22 Oct 2026): the door exports `deliverOwedRender`, the plane "carries no promotion code", and "the bundle is built by screens-intake's own builder, not a second copy (a QUESTION if it cannot run in the door)". The order sent to the door's job adds the reason and a way out: "rather than a second copy (K4164); if it cannot run in the door (browser kit), say so by QUESTION with the smallest piece you need moved". So it asks for one builder and foresaw moving a piece; it does not say the builder must live in a screen. [MEASURED M4] The code does what it says: the delivery sends what the screen's two functions compose.
3. **Alternative 1 (the two functions moved to `capture`, module 56). Does the door still reference the UI through this tie? Yes, from its tests; no, from its source.** [MEASURED M7] `cp/index.mjs` no longer imports `screens-intake/capture.mjs` (13 edges from door files into UI files become 12); the new file imports nothing. Seven test and kit files that control-plane owns still import the screen's file; six of them only for `promoteDocument`. With those six re-pointed as well (`trialB-alt1b`, 13 more lines) one is left, `r8-seam-capture.mjs`, which uses other screen parts and is another tie. **Page script byte-identical? Yes** [MEASURED M6]: 5,270,912 bytes, sha256 `54986cba…749b`, before and after. **Tests** [MEASURED M8, M9]: 0 of 91 test files changed result. The 13 files that reach the delivery: 151 of 159 tests pass and the same 8 fail in both trees. screens-intake's 41 own files: 375 of 375 tests pass in both. interface-shell's 37: 321 of 321 in both. screens-capture has no test. **Size** [MEASURED]: 4 files, 115 lines added, 108 removed; 101 of the added lines are the two functions moved as they were.
4. **Alternative 2 (use a composer already below): stopped, as the brief says.** [MEASURED M4; READ] No composer below the door produces the screen's bundle; the differences are headline 1's. One lower helper, provenance's `releasableBundle` (module 51), does reproduce the screen's three text files byte for byte when handed the screen's own `bundle.md` [MEASURED M5], but it composes no title, id, front matter or register and refuses documents the screen accepts.
5. **Is T17 the only call from background work into UI code? Yes, by every enumeration made here.** [MEASURED M7] The import closures of store-assembly's 16 files and of scheduler's one hold 0 UI-owned files; the cron handler's closure is 2 files, 0 UI-owned; the object's class reaches UI files only through `cp/index.mjs`, from which it takes one name, `deliverOwedRender`. In the code that function reaches, the UI names are `CAPTURE_SCREEN` and nothing else. One thing beside it is not a call: the object's isolate loads `cp/index.mjs`, whose load-time statements build the list of all screens (section 8).

## Commands

All from `w16/`; tests run by `process.json`'s `test_command`, one process a file, in a bare environment.

- **M1** `node graph.mjs trialB graph-base.json`: esbuild's own parse (`metafile`) of every `*.test.mjs` outside `node_modules`, `dist`, `release`, `vendor`: `tests 3118 inputs 4572 failed 7`. Each of the 3,118 has a module owner. The 7 esbuild could not bundle were run all the same (M3).
- **M2** Candidates for reaching `deliverOwedRender`. `grep -rn "deliverOwedRender\|deliver:"` over source outside tests: defined at `cp/index.mjs:743`, imported and handed on only at `plane/store.mjs:12, 41`. So a test reaches it (a) in its own process only if its import closure holds `cp/index.mjs` (115 tests), or (b) in workerd only if its closure holds a file naming the `miniflare` package (167 tests; a scan of every import specifier in the graph finds no other package that can start workerd). Union with the 7 unparsed: **282 candidates**. 183 other tests have only a `child_process` or `worker_threads` user in their closure: not traced.
- **M3** `node run.mjs trialB trace-list.json trace --jobs 3 --timeout 900 --preload mark.mjs`. `mark.mjs` changes no file: in Node it adds one statement to `deliverOwedRender` as the module loads (`module.registerHooks`), and it answers Miniflare's own read of `cp/index.mjs` with the same statement, which writes a mark (a file in Node, a console line from workerd). Checked on known cases first: `r124-owed-render.test.mjs` 28 marks in Node; `t51-round6-seam.test.mjs` loaded in workerd, 1 mark; `archive.test.mjs` loads the file and leaves no mark. `grep -rn handleRuntimeStdio` over tests and source: no hit, so no test takes workerd's output away. Pass 1 (before the restart; 88 minutes, load 5 to 19): 282 files, 242 exit 0, 40 not; `cp/index.mjs` was loaded in Node by 117 files and read for workerd by 119; 12 left a mark. Pass 2 (after it): the 40 again, with what they lacked here (section 4).
- **M4** `node --import ./bio-plane/test/platform-sqlite.mjs w16/compose.mjs <tree> <out>`, then `node compose-diff.mjs <out>`.
- **M5** `node w16/releasable.mjs trialB snapshots/rendered.html`: `chain true: … whole list same true`; `chain false: releasableBundle refuses: NO_CHAIN`; with the file not under `snapshots/`: `refuses: NO_SNAPSHOT`.
- **M6** `node w16/script.mjs <tree> <out.js>`: imports `store-assembly/register.mjs`, then the nine `SCREENS` in the door's order (`cp/index.mjs:63`) and `GUIDE`, then `interface-shell`, and writes `interfaceScript(screens, {guide})`. `sha256sum`, `cmp`.
- **M7** `node bg.mjs <tree>` (closures by esbuild's metafile; a bundle cut from one export, every module marked free of load-time effects, to see which files keep bytes) and `node bg2.mjs <tree> deliverOwedRender` (what of `cp/index.mjs` stays in it).
- **M8** `node pair.mjs own-ui-list.json pair-ui --a trialB --b trialB-alt1 --jobs 1`: each file run in the unchanged tree, then at once in the changed one, so both meet the same load. `pair-chromium`: four of them again with `--env TMPDIR=/tmp/c16` (a link to a scratch folder), because Chromium refuses a socket path as long as the runner's own temp folder ("Socket path too long").
- **M9** The same over the tests M3 found: `pair-reach` (12 files), `pair-reach9` (the thirteenth); `pair-alt1b` (six files, `trialB` against `trialB-alt1b`); `pair-extra` (capture's 49 own test files and `T/store-assembly/words.test.mjs`, not asked for: the new file's owner).
- **M10** `node w16/astext.mjs <tree>` (each function made again from `toSource`'s text alone and called); `pair.mjs` over three tests, `trialB-alt1` against `trialB-neg`.
- **M11** `git log -S'import { CAPTURE_SCREEN } from "../screens-intake/capture.mjs"' origin/p4-tranche -- bio-plane/src/control-plane/index.mjs`: one commit, `42995c5f` (22 Nov 2026), the oldest this shallow clone holds, where the file already has the import.

## 1. The tie as the code has it

- [READ] `cp/index.mjs:39` `import { CAPTURE_SCREEN } from "../screens-intake/capture.mjs";` under the comment at `:38` "R124 (fix round 4b; K4493): the alarm's delivery of an owed render is this door's promotion, built by screens-intake's own builder". The file's owner is screens-capture (182): `process/modules/screens-capture.json` `files`.
- [READ] `:796` `try { title = CAPTURE_SCREEN.parts.titleOf(cs, { reading: answer.reading, doc, address }); } catch { title = address; }` and `:797` `const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc, title, locator: address, project });`. The kit `cs` is built at `:787` to `:793`: `now`, `digest`, `w` (setup-words' `word`), `date` (`toLocaleDateString("en-US", …)`, where the page's kit draws a date from the words `date.daymonthyear`, `interface-shell/browser.mjs:49`), and `call`, which answers `allocid` from `record.allocId` and `promote` from `promotion.promote({ ...body, ...who })`.
- [READ] `screens-intake/capture.mjs:102` `function titleOf(cs, o) {` and `:144` `async function promoteDocument(cs, o) {`. Neither uses a name outside itself but its parameters and the language's globals [MEASURED M10: each, made again from its text alone, runs]. `:1407` lists both in the screen's `parts`.
- [READ] The page calls the same two through `view.parts`: `capture.mjs:734`, `:755`, `:793` `const made = await view.parts.promoteDocument(cs, { doc, title, locator: address, project: filed.id });`, `:1193`, `:1194`. So the page itself composes the bundle and sends `op=promote` [MEASURED M8: 13 test files read it from the served page] (requirement lines screens-capture R1, R21, R23 say the screen promotes: leads).
- [READ] `plane/store.mjs:41` `this.#assembled = assembleStore(ctx, env, { deliver: deliverOwedRender });`; `store-assembly/pending.mjs:720` and `:732` wrap it for the job kinds `subresources` and `fetch`.

## 2. What the composers ask the record to store

**The tests that exercise each, with owners** [MEASURED: `grep -rlE` over `bio-plane/test` and `agent-worker/test`, owners from the module records].

| Composer | Tests | Owners |
|---|---|---|
| The screen's two functions called directly (`parts.promoteDocument`, `parts.titleOf`) | 48 files | plane 39 (28 under `T/control-plane/`, 7 under `T/screens-inquiry/`, 4 under `T/screens-intake/`), control-plane 6, screens-intake 2 (`r9-register`, `t51-fix7`), journey-check 1 |
| The screen's promote in the served page (`byOp("promote")`) | 27 files | screens-intake 13, interface-shell 5, screens-daily 2, screens-inquiry 2, plane 2, control-plane 1, journey-check 1, screens-investigate 1 |
| `cp/archive.mjs` (`promoteArchive`, `archiveDocuments`) | 4 files | control-plane 4: `archive`, `t51-g43-embed`, `r133-r134-follow`, `t49-door` |
| `store-door/pull.mjs` (`pullAndFile`, route `inboxpullfile`, `op=inboxpull`) | 15 files | control-plane 7, store-door 2 (`pull`, `routes`), op-grades 2, plane 2, doorbell 1, store-request 1 |
| `deliverOwedRender` | 13 files | control-plane 3, plane 8, journey-check 2 (section 4) |

screens-capture, the owner of the screen's file, has no test of its own: its `tests` is `bio-plane/test/m/screens-capture/`, a folder that does not exist [MEASURED: `ls`]. The screen's tests are screens-intake's.

**The run** [MEASURED M4]. `compose.mjs` builds a fresh real record for each run (control-plane's own fixture, `T/control-plane/record.mjs`, the author made a participant of the project as `r124-owed-render.test.mjs` does), holds the clock at one instant, and records the argument of the record's `promote` before it runs:

- **delivery**: the real `deliverOwedRender` for a capture session opened by `ann` under `PROJ-2026-0001`, handed the document as `answer.document`.
- **screenDirect** (a control): the two functions called with a test's kit (`w: (k) => k`), as `r124-owed-render.test.mjs:24` builds one.
- **archive**: `promoteArchive({stub, doAnswer, docs: [doc], project, who})` over the record's own `allocid` and `promote`, as `archive.test.mjs` drives it.
- **pull**: `pullAndFile(deps, …)` with the real record, promotion and provenance, and a stand-in doorbell whose `pullKnock` hands this document to `within`. In the product the pull only ever receives a document the doorbell built [READ `store-door/pull.mjs:125` to `:127`]; the stand-in is what makes the input the same.

Six documents, the shape `r124-owed-render.test.mjs:27` (`docOf`) gives: (1) a page with a reading that states a title; (2) an uploaded PDF with no title, its file name stated; (3) a page with no title whose file name is only the address's last segment; (4) the same with a `content-disposition` kept; (5) nothing stated and no address; (6) two parts and an attestation (the shape of `r9-register.test.mjs:22`).

**Titles and ids sent** [MEASURED]:

| Input | delivery (the screen's functions, the door's kit) | archive | pull |
|---|---|---|---|
| 1 | "Council agenda, 3 March 2026"; `INFO-2026-0001-council-agenda-3-march-2026` | "Archive captured from https://example.org/rendered.html"; `…-archive-file` | "Material handed in at the doorbell on 22 October 2026"; `…-doorbell-knock` |
| 2 | "minutes 2026-03.pdf" | "Archive captured from upload:6d28…" | the same doorbell title |
| 3 | "A page from city.example.gov, captured November 2, 2026" | "Archive captured from https://city.example.gov/docs/report.html" | the same |
| 4 | "report.html" | as 3 | the same |
| 5 | "Untitled capture" | "Archive captured from " | the same |
| 6 | "A stated title" | "Archive captured from upload:cc31…" | the same |

**Every difference, delivery against the other two** [MEASURED: `compose-base/diff.json`; `diff -u` of the files]:

| Part of the package | The screen's functions | `cp/archive.mjs` | `store-door/pull.mjs` |
|---|---|---|---|
| `bundleId` | minted id plus a slug of the title (at most 40 characters) | minted id plus `-archive-file` | minted id plus `-doorbell-knock` |
| Title | `titleOf`: reading's title, document's title, stated file name, host and day, "Untitled capture" | "Archive captured from <locator>" | "Material handed in at the doorbell on <date>" |
| `meta` | 5 keys | adds `prior_state: null`, `criticality: "supporting"` | as archive |
| `bundle.md`, front matter | `created`, `last_updated` unquoted; `produced_by`, `annotations_open`, `reeval_pending`, `visuals`, `monitoring` blocks; `project: PROJ-2026-0001`; `source.authority: member-entered`; `source.retrieved` is now | dates quoted; none of those five blocks; `project: "PROJ-2026-0001"` (quoted, placed earlier); no `authority`; `retrieved` is the document's own | dates quoted; the five blocks present; **no `project` line**; no `authority`; `retrieved` the document's own |
| `content_hash` | sha256 of `data/dataset.json` | the capture's sha256 | the capture's sha256 |
| `bundle.md`, body | Summary is the title; Provenance Notes and Session Log empty | fixed sentences in all three sections | fixed sentences naming the knock and the puller |
| `data/provenance.json` | `JSON.stringify(…, null, 1)`: 828 bytes for input 1 | indent 2: 965 bytes; equal once parsed | as archive (the two files are identical) |
| `data/dataset.json` | sent (150 bytes for input 1) | **not sent** | **not sent** |
| Blob files, input 6 | both parts and the attestation | both parts; **no attestation** | **the whole as one file**; no parts, no attestation |
| `register`, inputs 1 to 5 | one row, `encoding` from the document | one row, `encoding: "binary"` (equal here: the documents say `binary`) | as archive |
| `register`, input 6 | one row for the whole carrying `parts`, and a row for the attestation | **one row for each part**, none for the whole | one row for the whole, no `parts` |
| Stamps (`author`, `actorMemberId`, `actorIdentity`, `actorViewer`) | equal in all three (the same caller was given) | | |

What the record answered [MEASURED]: all three accepted for inputs 1 to 4; input 5 refused (`PROVENANCE_REGISTER_REFUSED`) from the screen's and the archive's package, accepted from the pull's; input 6 accepted from the screen's and the pull's, refused from the archive's. The packages, not these answers, are the finding.

**The control** [MEASURED]: delivery and screenDirect sent identical packages for inputs 1, 2, 4 and 6. For 3 and 5 they differ only in the title and what follows from it, because the test's kit answers a word's key and the door's kit answers the word ("document.untitled.web" against "A page from city.example.gov, captured November 2, 2026").

**Other composers found** [MEASURED: `grep -rn "schema: information@2" bio-plane/src agent-worker agent-harness agent-steps`: 5 files]. Besides the three: `capture-requests/index.mjs:1045` `#promoteCapture` (module 100) and `monitoring/index.mjs:2925` `#land` (module 149). [READ, not run] Each writes its own title (`word("capture-requests.requested_capture", …)`; `localize("monitoring.gathered", …)`), `produced_by: mode: agent`, no `data/dataset.json` and indent 2 (`capture-requests/index.mjs:1089`, `monitoring/index.mjs:2962`), so neither is the screen's bundle. provenance's `releasableBundle` (`provenance/releasable.mjs:40`, module 51) composes files only; its header says of the dataset's shape "copied: that file is served to the browser and keeps its own" (`:4`, a lead).

## 3. Why the screen holds the composer

Leads, in the order written; none is evidence of what the code does.

- `build/jobs/T51/plane.md:362` (the plane's question J23): "The promotion is not plain for plane to do: screens-intake's `promoteDocument` mints the INFO id (`allocid`), builds the information bundle text … Best reading: it belongs to the door"; `:366`: "If you would rather plane do the promotion itself … it would duplicate screens-intake's bundle building."
- `build/rulings.md:4488`, K4493, quoted in headline 2. It cites K4164 (`:4161`), which records the owner's words of 20 Oct 2026: "a source tree that isn't fragile so that a small change doesn't result in multiple modules at multiple layers needing to be rebuilt. An architecturally clean source tree".
- `build/jobs/T51/control-plane.bob.md:268`, the order to the door's job: "Build the bundle with screens-intake's own builder (`promoteDocument`'s text, id and register; screens-intake is earlier in the order) rather than a second copy (K4164); if it cannot run in the door (browser kit), say so by QUESTION with the smallest piece you need moved, and add the `uses` edge you need".
- `build/jobs/T51/control-plane.md:480`, the job's answer: "It runs in the browser-free part of screens-intake (`promoteDocument` is self-contained over `cs.call/digest/now`), so nothing needed moving."
- `process/modules/control-plane.md:155`, R124: "promotes the rendered document … as the capture screen promotes an acquired one (screens-intake's `promoteDocument`, through the record's `promote`)". The requirement names the screen's function; Alternative 1 would need its words changed.

INFERENCE from these and section 1: the builder sits in a screen because the page promotes by itself and its script is made of function text; the door borrowed it so that there would be one builder, while the door stood after the screens and the borrowing was no upward reference. Nothing found says the builder must be UI code. The owner, or BOB's record of K4493, would settle the intent.

## 4. Baseline

**How the tests that reach `deliverOwedRender` were found.** By name [MEASURED: `grep -rn deliverOwedRender bio-plane/test agent-worker`]: 15 test-side files name it; four call or hand on the real one: `T/control-plane/r124-owed-render.test.mjs`, `t51-g43-embed.test.mjs`, `t51-visitor-copy.test.mjs` (control-plane's) and `T/plane/fixture.mjs` (plane's kit). By running [MEASURED M2, M3]: all 282 candidates under the mark. **13 files reach it**; no other file left a mark in any pass.

| File | Owner | Where it runs | Marks |
|---|---|---|---|
| `T/control-plane/r124-owed-render.test.mjs` | control-plane (195) | Node, called by the test | 28 |
| `T/control-plane/t51-g43-embed.test.mjs` | control-plane | Node, called by the test | 2 |
| `T/control-plane/t51-visitor-copy.test.mjs` | control-plane | Node, handed to acquisition's `owedRun` | 1 |
| `T/control-plane/t51-held-failed`, `t51-large-pdfs`, `t51-round5-press-seam`, `t51-round7-seam` | plane (196) | the plane in workerd | 2 each |
| `T/control-plane/t51-round5-seam`, `t51-round6-seam`, `t51-round10-seam-htmlparts` | plane | workerd | 1 each |
| `T/control-plane/t51-round8-seam.test.mjs` | plane | workerd | 8 |
| `T/control-plane/t51-round9-seam.test.mjs` | journey-check (204) | workerd | 4 |
| `build/plan/walk-T51-final/scripts/05-vouch.test.mjs` | journey-check | workerd | 1 |

No test owned by a module below the door is among them. Pass 2 [MEASURED]: of the 40 files that had not exited 0 in pass 1, 25 did once `playwright-core` (installed in a scratch folder), the other packages' `node_modules` and a short `TMPDIR` were given; `plane/g83-location.test.mjs` passed 15 of 15 in a third run alone. **12 files still do not pass on this machine and left no mark in what they ran; for the parts that did not run, whether they reach the delivery is not settled**: four cannot start (`walk-T51-final/scripts/02-people.test.mjs` does not parse; `03/03-projects.test.mjs` imports from `/home/user/bio/`; `T/answer-envelope/families.test.mjs`, 2 of 18, imports `src/plane/register.mjs`, which does not exist; `test/system/migrate-released.test.mjs` reads released bundles from commits this shallow clone lacks) and eight stop part-way (`T/journey-check/journey.test.mjs` 10 of 24: its local walk stops at the installer's step, alone on a quiet machine too; the walks `07-money-time` 0 of 1, `06-read-cite` 22 of 25 and `08-law` 14 of 15; `T/journey-check/live.test.mjs` 11 of 17, which walks a fake plane; `T/journey-check/group.test.mjs` 4 of 5; `test/system/fleetbundles.test.mjs` 6 of 8; `T/control-plane/t51-round10-seam-csvprose.test.mjs` 0 of 1).

**The sets and their baseline results** (unchanged tree; M8, M9):

| Set | Files | Baseline result | Seconds, load |
|---|---|---|---|
| Tests that reach the delivery | 13 | 151 of 159 tests pass; 8 fail (1 in `t51-round7-seam`, 7 in `t51-round9-seam`) | 1,148 for 12 files, load 6 to 16; 1,258 for `t51-round9-seam.test.mjs` alone, load 0.3 |
| screens-capture's own | 0 | none exists | |
| screens-intake's own (`T/screens-intake/` less 6 files plane owns) | 41 | 375 of 375 tests pass | 1,104, load 8 to 19 |
| interface-shell's own (`T/interface-shell/` less 5 control-plane owns and 1 screens-wizards owns) | 37 | 321 of 321 tests pass | 316, load 8 to 19 |

Of the eight failing tests of the first set, one is in `t51-round7-seam.test.mjs` (17 of 18): "R105 (G60): a case whose cited document the case gate finds a problem in …", `200 !== 409`, the same in every run of either tree; seven are in `t51-round9-seam.test.mjs` (74 of 81), four of them titled "red until …". Four real-browser files (`T/screens-intake/phone390`, `T/interface-shell/fixround7`, `phone390`, `r120`) failed in the first run of both trees for the runner's long temp path and passed in both with a short one (8 of 8, 15 of 15, 2 of 2, 5 of 5); the figures above count the second run for them.

**The page script before the change** [MEASURED M6]: 78 screens, 5,270,912 bytes, sha256 `54986cba78d7d4a6e7e207faefde0b1f174e77f0a37901a5c0b9437faaae749b`; `interfaceScriptHash` `sha256-VJhsunjX1Kbn4gf6794LHxdOd/CjeQGlwLlDf6qudJs=`; saved as `w16/script-base.js`.

## 5. Alternative 1: the two functions moved below

**The owner chosen: capture (56), a new file `capture/filing.mjs`.** Why, by what the functions do: (a) the bundle they compose must pass capture's own grammar: `capture/grammar.mjs:1` "capture — the information grammar, C-2.7 … the content hash (recomputed from the canonical dataset when both exist)", and the function's own comment names it ("capture grammar C-2.7") [READ]; (b) their input is the provenance document that, by `process/modules/capture.md`'s Purpose, capture "returns … a caller promotes", and the title rule reads capture's fields (`capture.file_name`, `capture.transport.http_headers`) [READ]; (c) capture stands after promotion (48), provenance (51) and acquisition (55), so tests of the functions over those modules' real code (as `r9-register.test.mjs` runs `promoteDocument` over the real provenance) could move with them without an upward reference, which they could not if promotion owned the file; (d) 56 is below store-door (171) and store-request (175), the highest the door's non-UI code reaches. Against it: the same Purpose says of capture "It writes no bundle" [READ]; the moved function asks `promote` through the kit its caller hands in and imports nothing, but an owner may read that line as excluding it. **What the new file imports: nothing** [MEASURED M7: `capture/filing.mjs owner: capture 56 imports: []`].

**The change** (`trial-capture/alt1.patch`, 281 lines; `git diff --stat`: 4 files changed, 115 insertions, 108 deletions):

| File | Owner | Added | Removed | What |
|---|---|---|---|---|
| `capture/filing.mjs` (new) | capture (56) | 107 | 0 | the two functions and their comments as they were (101 lines), `export` before each, a 4-line header |
| `screens-intake/capture.mjs` | screens-capture (182) | 3 | 103 | the two functions out; one import; `parts` at `:1407` untouched |
| `control-plane/index.mjs` | control-plane (195) | 4 | 4 | the import and the two calls |
| `process/modules/screens-capture.json` | none | 1 | 1 | `"uses": []` becomes `["capture"]` |

**Import walk** [MEASURED M7, both trees]. Edges from non-UI files into UI-owned files in the closure of `plane/index.mjs`: 13 before, 12 after; the one gone is `control-plane/index.mjs -> screens-intake/capture.mjs`. After: `who imports capture/filing.mjs: screens-intake/capture.mjs [screens-capture], control-plane/index.mjs [control-plane]`; `who imports screens-intake/capture.mjs: screens-intake/held.mjs, screens-intake/index.mjs` (in the door's closure). `cp/index.mjs` still imports 11 UI files for the page (interface-shell, interface-assets, nine screens modules): the other ties of report 11, not this one. **Tests still tied** [MEASURED M1's graph]: 65 files import the screen's file directly; control-plane owns 8 of them: its source file (cut by this change) and seven test or kit files: `r124-owed-render`, `r130-killed-ways-in`, `r135-real-rows`, `t51-g43-embed`, `t51-visitor-copy` (tests), `r8-seam-misc.mjs`, `r8-seam-capture.mjs` (kits). Six use only `promoteDocument` or `titleOf`; `r8-seam-capture.mjs` uses `refusalHtml` and `watchFetch`, other screen parts. plane owns 40 more.

**The page script** [MEASURED M6]: after the change 5,270,912 bytes, sha256 `54986cba78d7d4a6e7e207faefde0b1f174e77f0a37901a5c0b9437faaae749b`; `cmp` of the two files: identical. `Function.prototype.toString` does not include `export`, so the text shipped is the same.

**What the delivery sends** [MEASURED M4 on `trialB-alt1`]: 24 of 24 packages (six documents, four runs each) identical to the baseline's.

**Tests** [MEASURED M8, M9]:

| Set | Files | Before | After | Files whose results differ |
|---|---|---|---|---|
| Tests that reach the delivery | 13 | 151 of 159 tests pass; 8 fail (1 in `t51-round7-seam`, 7 in `t51-round9-seam`) | 151 of 159; the same 8 fail | 0 |
| screens-intake's own | 41 | 375 of 375 | 375 of 375 | 0 |
| interface-shell's own | 37 | 321 of 321 | 321 of 321 | 0 |
| Not asked: capture's own 49 files and `T/store-assembly/words.test.mjs` | 50 | 369 of 369 | 369 of 369 | 0 |

"Differ" compares every test's name and outcome, not only the counts. `t51-round9-seam.test.mjs` took two runs in the changed tree: the first ended three tests early (73 of 78) on `ENOENT … trialB-alt1/pdf-worker/dist/pdf-worker.bundled.mjs`, a built file that tests of trace pass 2 had made in the baseline tree only. With the same links and built files in both trees (six members' bundles, sha256 equal in both), it gave 74 of 81, the names and outcomes the baseline's.

**One step further, not in the brief** (`trialB-alt1b`; the diff is `git -C …/trialB-alt1b diff`): the six control-plane files that take `promoteDocument` from the screen (`r124-owed-render`, `r130-killed-ways-in`, `r135-real-rows`, `t51-g43-embed`, `t51-visitor-copy` tests and the kit `r8-seam-misc.mjs`) import it from `capture/filing.mjs` instead: 13 lines added, 13 removed. [MEASURED M9] The five tests and `t51-round8-seam.test.mjs`, which uses the kit: 43 of 43 pass before and after.

## 6. Alternative 2: a composer already below

Stopped at the brief's condition: no lower composer produces the same bundle [MEASURED M4 for `store-door/pull.mjs`, 171; READ for capture-requests, 100, and monitoring, 149; `cp/archive.mjs` is the door's own file, not below it]. What the delivery would change for a member if it used one of them is section 2's table: another title and id, another `bundle.md`, no `data/dataset.json` (which the screen's comment says is there "so that `release` is not refused `ENTRY_REQUIREMENTS`", `capture.mjs:140` to `:141`, a lead), no attestation file, and for `pull` no project line and no parts. No patch was made and no test run.

One measured fact bears on it [M5]: `releasableBundle({md, doc, locator, snapshots, indent: 1})` from provenance (51), handed the screen's own `bundle.md` and blob files, answers the screen's file list byte for byte. It refuses a document with no chain (`NO_CHAIN`) and one with no file under `snapshots/` (`NO_SNAPSHOT`); the screen's composer refuses neither, and `r124-owed-render.test.mjs`'s documents have neither. The title rule, the id, the front matter, the register rows and the bound that drops an oversize reading (`capture.mjs:176`) have no lower copy.

## 7. The browser side of the constraint

- [READ] `interface-shell/index.mjs:298` `const src = v.toString();` in `toSource`, which writes "a function by its own text, every other value as JSON"; `:532` `` const source = `(${program})(${toSource(D)}, ${toSource(screens)}, window, ${toSource(guide)}).start();` ``.
- [READ] The page tests run that text: `T/interface-shell/harness.mjs:331` `new Function("window", "setTimeout", "clearTimeout", "Date", scriptOf(html, screens, options))(win, …)`.
- [MEASURED M6] A function imported from another module and listed in `parts` is shipped as before: after Alternative 1 the script is byte-identical and holds `function titleOf(cs, o)` and `async function promoteDocument(cs, o)` at the same offsets (2,328,989 and 2,307,595).
- [MEASURED M8] It works in the page: the 13 test files of screens-intake that read what the served page sends to `promote` (`capture`, `phone390`, `r7-project-picker`, `r9-parts`, `r9-register`, `t51-capture`, `t51-fix2`, `t51-fix3`, `t51-fix4`, `t51-fix6`, `t51-fix7`, `t51-pending`, `t51-watching`) pass 197 of 197 tests in both trees (`phone390`'s 8 in the short-temp run).
- **What the mechanism requires of such a function** [MEASURED M10, the control in `trialB-neg`]: Alternative 1 plus one line, `import { INLINE_MAX } from "../promotion/index.mjs";` in `capture/filing.mjs`, used inside `promoteDocument` in place of the figure `1048576`. Then: the script still composes, with no refusal (5,270,915 bytes, sha256 `d43db3b8…62f9`), and holds `INLINE_MAX - 65536` with no import beside it; the door's delivery passes (`r124-owed-render.test.mjs` 14 of 14); the page fails (`t51-fix7.test.mjs` 9 of 10, `r9-register.test.mjs` 2 of 4, each failure "Cannot read properties of undefined (reading 'body')": no `promote` was sent); and the function made from its text alone throws `ReferenceError: INLINE_MAX is not defined`. So a function in `parts` may be defined in any module, and must not use any name of its module's scope: no import, no module constant, no sibling function. Nothing in `interfaceScript`'s checks catches a breach; a test that runs the page does. The functions as they stand meet this, and say so (`capture.mjs:176`: "inside the function: the page is served function by function").

## 8. Other background work and UI code

- [MEASURED M7] `store-assembly: 16 source files, closure 700 files, UI-owned files in it: 0`; `scheduler: 1 source files, closure 551 files, UI-owned files in it: 0`. In a bundle cut from `assembleStore` or from `schedulerOf`, 0 UI-owned files keep bytes.
- [MEASURED M7] `plane/watchdog.mjs`, the cron handler's file (`plane/index.mjs:71` `scheduled: (controller, env) => watchdog(controller, env)`): closure 2 files, 0 UI-owned.
- [MEASURED M7] `plane/store.mjs`, the object's class: closure 846 files, 130 UI-owned; with the edges into control-plane's files cut, 701 files and 0. [READ] It takes one name from control-plane: `plane/store.mjs:12` `import { deliverOwedRender } from "../control-plane/index.mjs";`, used once at `:41`. Its alarm is `:76` `await schedulerOf(this.ctx, this.env).alarm();`.
- [MEASURED: `grep -rnE "\.register\("` for the scheduler over source] Work is registered with the scheduler at five places: `store-assembly/assemble.mjs:580, 582, 630`, `tasks/index.mjs:1269`, `queue/index.mjs:2643`. `scheduler/index.mjs` is imported by `tasks`, `queue`, `store-assembly/pending.mjs`, `store-assembly/assemble.mjs` and `plane/store.mjs` only. No UI file is among them.
- [MEASURED: every `from "../<folder>/…"` in the 131 UI files that leaves the UI folders, 18 statements] UI files import from five modules, and take only `OPS`, `NEEDS`, `SESSION_OPS`, the namespace of op-declarations (read once, for `BROWSER_ACTS`, `interface-shell/index.mjs:185`), `RUNGS`, `RUNG_ABSENT`, `IRREVERSIBLE_WEIGHT`, `MARKS`, `phoneOf`, `sha256HexSync`, `WORD_ROWS`, `word`, `hasWord`, `SCREEN_REGISTRY`, `ADMIN_ACTS`, `ADMIN_SCREENS`. None registers a value that lower code calls.
- [MEASURED M7, `bg2.mjs`] In the bundle cut from `deliverOwedRender`, `cp/index.mjs` keeps 147 lines: the function, `openerForms`, `sha256Hex`, and load-time `Object.freeze` statements. The UI names in the function and its two helpers: `CAPTURE_SCREEN` (`.parts.titleOf`, `.parts.promoteDocument`), no other. The UI names in the load-time statements: `APP_SCREENS = Object.freeze([...SCREENS, …])` over the nine modules' lists and `APP_OPTIONS = Object.freeze({ guide: GUIDE })` (`cp/index.mjs:63` to `:65`).
- So **T17 is the only call.** The other thing is a load: any isolate that loads `cp/index.mjs`, the object's included, evaluates the nine screens modules and builds that list, which is why 129 UI-owned files keep bytes in the cut bundle before and after Alternative 1. INFERENCE: cutting T17 alone does not take UI code out of the object's isolate; that needs the object's class to stop importing a file that imports the screens. A trial build would settle it.

## After a change

Not a design; what the measurements allow.

- Alternative 1 leaves the door's source with no reference to the UI through this tie, the page script the same bytes and the delivery's packages the same; with six of control-plane's test files re-pointed too (tried, section 5), what is left in control-plane is `r8-seam-capture.mjs`, a kit that uses the screen's `watchFetch` and `refusalHtml`: another tie. plane's 40 files and journey-check's 11 that import the screen's file stand above the UI either way.
- R124's words (`process/modules/control-plane.md:155`) and the comment inside the moved function ("no edge to it from here, and this module is served to the browser") would need rewriting; the comment was left as it was so that the script's bytes could be compared.
- The committed bundles (`bio-plane/dist/bio-plane.bundled.mjs`, `release/bio-plane.bundled.mjs`) hold the old layout and would be rebuilt.
- `interfaceScript` has no check that a function in `parts` uses no name of its module's scope (section 7); with such functions outside screen files, only the page tests guard it.

## What I did not check

- **The 12 files that do not pass on this machine** (section 4): whether the parts of them that never ran reach the delivery. What would settle it: full git history (`migrate-released`), the package `playwright` (walks 06 and 08), an installer step that completes (`journey.test.mjs`), and repairs to the two walk scripts that cannot load.
- **183 tests with only a child process or worker thread in their closure** (M2): not traced. What would settle it: the same trace with the statement written into the file on disk, which a child with a replaced environment also loads.
- **The mark from workerd** rests on Miniflare passing a Worker's console lines to the test's output: shown for 10 files; not shown for a workerd started from a child process.
- **capture-requests' and monitoring's composers** were read, not run.
- **The process's own module check** (ownership, format, any comment form an exported function must carry) on Alternative 1's tree: its tools are not in this checkout. Whether `capture.md:13` "It writes no bundle" admits the new file is the owner's reading.
- **Tests outside the named sets** after Alternative 1: only capture's own 49 files and one of store-assembly's were added. Not run: the other tests of the repository, among them any that compares the committed bundles with source; plane's 40 and journey-check's 11 files that import the screen's file were not re-pointed.
- **Alternative 2** was not built: the brief says to stop.
- **Unequal trees for a while.** From trace pass 2 until the last run the baseline tree held links and built files the changed tree lacked. Pairs made in that window agreed in both trees (`pair-extra`, `05-vouch`) but for `t51-round9-seam`, repeated once the trees were equal (section 5).
- **The door's kit in another language**: its `date` is fixed to `en-US` and the page's draws from words; read, not run.
- **History**: the clone is shallow; who added the import and when is not in it.
- **The restart.** Before it the machine was at load 5 to 19 and near its memory limit. Kept from then: only runs that ended by themselves (trace pass 1, `pair-ui`, `pair-chromium`, `pair-reach`, `pair-alt1b`, the control, the composer runs, the import walks, the scripts); every file that had not exited 0 was run again afterwards. Discarded and repeated: trace pass 2 (7 of 40 done) and `pair-extra` (4 of 50), and two runs made after the restart while 28 workerd processes orphaned by this trial's own failed tests filled memory (`w16/before-restart/` holds all four; none is used). I stopped those 28. Eight more, from another worker's trees (`trialA`, `trialA-base`, about 2.9 GB), were left alone.
- **Left on disk, not by choice**: `w16/tmp-short/` holds temp folders of tests the restart killed; the harness refused their removal. The walk scripts under `build/plan/walk-T51-final/scripts/` write reports and screenshots into the tree they run in; I restored `trialB` and `trialB-alt1` with `git checkout` and `git clean` on that folder each time.
