Length: 227 lines. Last section: "Not checked".
# Experiment: move `r10-held-paging.test.mjs` from plane to screens-intake

A throwaway experiment, done in a detached scratch worktree of `origin/p4-tranche` at `a26a8da2`. Nothing in that worktree was committed or pushed. The worktree has been removed. Note: the local `p4-tranche` ref is stale (`d3cb895b`, where plane.json does not name the test). I used `origin/p4-tranche`, where `process/modules/plane.json:103` names it.

## Answer for the owner

**Does the rewritten test refer to any module later than screens-intake (183)? YES, by one route: reading files as text at run time.** It imports and runs nothing later than 183. But while it runs, the shared screen harness reads, as text, 16 files that later modules claim. 6 belong to **plane (196)** and 10 to **journey-check (204)**. It also lists and stats folders that journey-check claims.

The route: `interface-shell/harness.mjs:54` (177) calls test-support's `declaredOpsOf(root, "interface-shell")` (`bio-plane/test/declared-ops.mjs`, module 9). That function walks the `files` folders of modules 1-177. Two of those folders are `agent-worker/` (agent-worker, 110) and `build/` (documents, 1). Inside them, plane's and journey-check's `tests` and `files` entries claim particular files. `declared-ops.mjs` decides ownership by `files` only. So it counts those files as agent-worker's, reads each one, and checks it for an `export const DECLARED_OPS` line (`pairsOf`, about line 136). None has that line, so none is imported. Their contents cannot change the result today. If someone ever adds that line to one of them, the harness would import it.

This route is not new. The original test, and every screens-intake test that uses page.mjs, goes the same way. The runtime spy below shows the same 16 reads for the original test.

**Static and literal dynamic imports: nothing later than 183.** Computed loads that load or run code: nothing later than 183.

**Can this test work in screens-intake's job instead of plane's? Yes.** It passes in screens-intake's whole-module run: 378 of 378, including the moved test's 3. All of its assertions are kept. It costs the module's run about 4.5 s of test time (4.1 + 0.3 + 0.1 s). In a whole run of about 350 s across parallel workers, the difference in wall time was too small to measure: 349.6 s with the test, 351.7 s without it, which is noise. Inside plane's job the same test cost 30.5 s (28.5 s of that is Miniflare plus 60 uploads).

## What changed

- The test was rewritten in place, at the same path. It no longer uses `realplane.mjs` or Miniflare. Instead, `members({ mai: CAN })` builds store-request's real world, and `openWorld` opens the served page over that world's door. The 60 documents are uploaded through `world.door` (`captureupload`) and filed by the screen's own `CAPTURE_SCREEN.parts.promoteDocument`, as before. Its `call` now goes to the world's door. A `heldcaptures` entry in openWorld's `plane` table forwards each read to `t.world.door(req, t.mai)` and keeps every answer. This works the same way as the original's `viaDoor` edit, and the same way `t51-fix4.test.mjs` already does it. Nothing is scripted: every answer comes from capture's real code.
- `process/modules/plane.json`: the line naming the test was removed. `screens-intake.json` `"tests"` already names the folder `bio-plane/test/m/screens-intake/`, so it needed no change. After the move, ownership by longest match makes the test screens-intake's.
- `realplane.mjs` was left alone. It is still used by plane's other three r10 tests.

Differences that are not assertions, which I am stating so nothing is hidden:
- The viewer is now `mai`, a member who has `contribute` and `create_projects`. Before, it was the founder (`admin`). `me` is still the real `whoami` answer, and every `member` assertion compares against `me.member`.
- In test titles and one assertion message, "the real plane" became "the real store", and "the plane says" became "the store says".
- The unused imports `after` and `before` and the Miniflare dispose were removed. The `ids` list is still built but, as before, no assertion reads it.

Assertions: every one is kept with the same comparison and the same expected value. 14 in test 1, 8 in test 2, 4 in test 3, plus the 2 setup checks (upload ok, filing not refused). None was dropped or weakened.

Mutation check: I made the screen send a wrong `after` (`held.mjs:293`, `after` → `"x"+after`). Test 1 then failed and tests 2 and 3 passed, which is what should happen. The file was restored afterwards.

```diff
diff --git a/bio-plane/test/m/screens-intake/r10-held-paging.test.mjs b/bio-plane/test/m/screens-intake/r10-held-paging.test.mjs
index d33f930f..09976ed9 100644
--- a/bio-plane/test/m/screens-intake/r10-held-paging.test.mjs
+++ b/bio-plane/test/m/screens-intake/r10-held-paging.test.mjs
@@ -1,44 +1,43 @@
 /* screens-intake fix round 10, cause R33 (G6; walks E1c, E1d; R4; DEC-97 clause 1): the Held list was cut at 50 with a "more" sentence and no way on, and its release
  * ticked every project's rows. It is now per member and per project: it opens on the viewer's own captures ("mine", `member` sent) with a filter to everyone's, and pages by the
- * answer's `next` (`after`). The served `held` page over the REAL plane (`realplane.mjs`) with SIXTY documents held: each uploaded and filed as the screen files an upload. */
-import { test, after, before } from "node:test";
+ * answer's `next` (`after`). The served `held` page over the REAL store (`openWorld`, store-request's world: K5054, K4990) with SIXTY documents held: each uploaded through the
+ * world's door and filed as the screen files an upload (`promoteDocument`). Every `heldcaptures` answer is the owner's (capture's), read through the world's door. */
+import { test } from "node:test";
 import assert from "node:assert/strict";
 import { createHash } from "node:crypto";
-import { open, main, text, idle, press, btn, word, hasWord } from "./page.mjs";
-import { realPlane } from "./realplane.mjs";
+import { openWorld, members, main, text, idle, press, btn, word, hasWord } from "./page.mjs";
 import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
 
-const plane = realPlane("r10held");
-after(() => plane.dispose());
 const N = 60;
+const CAN = ["contribute", "create_projects"];
 /* the design's rows for the filter and the doors are owed (K4269); the nearest held rows stand in until they are held */
 const said = (key, held) => word(hasWord(key) ? key : held);
 
-let world;
-const held = () => world ||= (async () => {
-  const auth = await plane.founder();
-  const kit = { now: () => Date.now(), digest: async (t) => createHash("sha256").update(t).digest("hex"),
-    call: async (op, { query = {}, body } = {}) => (await plane.door(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
-      headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() };
+let made;
+const held = () => made ||= (async () => {
+  const t = await members({ mai: CAN });
+  const kit = { now: () => t.world.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
+    call: async (op, { query = {}, body } = {}) => (await t.world.door({ url: `/api/?${new URLSearchParams({ op, ...query })}`, init: body === undefined ? { method: "GET" }
+      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, t.mai)).json };
   const ids = [];
   for (let i = 0; i < N; i++) {
-    const bytes = Buffer.from(`Held capture number ${i}, a line the plane reads.\n`);
-    const up = await (await plane.door(`/api/?op=captureupload&statement=r10&name=${encodeURIComponent(`held-${String(i).padStart(2, "0")}.txt`)}&type=text%2Fplain`, { method: "POST", headers: auth, body: bytes })).json();
+    const name = `held-${String(i).padStart(2, "0")}`;
+    const up = (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: "r10", name: `${name}.txt`, type: "text/plain" })}`,
+      init: { method: "POST", headers: { "content-type": "text/plain" }, body: new TextEncoder().encode(`Held capture number ${i}, a line the store reads.\n`) } }, t.mai)).json;
     assert.equal(up.ok, true, JSON.stringify(up).slice(0, 200));
-    const made = await CAPTURE_SCREEN.parts.promoteDocument(kit, { doc: up.result.document, title: `held-${String(i).padStart(2, "0")}`, locator: up.result.document.locator, project: "" });
-    assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 200));
-    ids.push(made.bundleId);
+    const filed = await CAPTURE_SCREEN.parts.promoteDocument(kit, { doc: up.result.document, title: name, locator: up.result.document.locator, project: "" });
+    assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 200));
+    ids.push(filed.bundleId);
   }
-  const me = (await (await plane.door("/api/?op=whoami", { headers: auth })).json()).result;
-  return { auth, ids, me };
+  const me = await t.mai.read("whoami");
+  return { t, ids, me };
 })();
 
-/* the page over the real plane; the first page's answer is kept so the test can name its `next` */
+/* the page over the real store; every `heldcaptures` answer is the world's door's, kept so the test can name its `next` */
 async function heldPage(path = "/app/held") {
-  const { auth, me } = await held();
+  const { t, me } = await held();
   const seen = [];
-  const via = plane.viaDoor(auth, { heldcaptures: (json) => { seen.push(json); return json; } });
-  const p = await open(path, { plane: via, me });
+  const p = await openWorld(path, { world: t.world, as: t.mai, plane: { heldcaptures: async (req) => { const a = await t.world.door(req, t.mai); seen.push(a.json); return a; } } });
   await idle(p, 3000);
   return { p, seen, me };
 }
@@ -46,7 +45,7 @@ const rows = (p) => main(p).querySelectorAll('[id^="pick-held-"]').map((e) => e.
 const pageReads = (p) => p.byOp("heldcaptures").filter((r) => !r.query.bundle_ids && !r.query.state);
 const moreLine = (p) => main(p).querySelector("[data-more]");
 
-test("R4 (cause 33; the real plane) sixty held: the first page names fifty of the viewer's own, the sentence that more are waiting comes with its door, and the door reads from the answer's `next`", async () => {
+test("R4 (cause 33; the real store) sixty held: the first page names fifty of the viewer's own, the sentence that more are waiting comes with its door, and the door reads from the answer's `next`", async () => {
   const { p, seen, me } = await heldPage();
   assert.equal(pageReads(p).length, 1);
   assert.equal(pageReads(p)[0].query.member, me.member, "mine: the viewer's own captures, sent as `member`");
@@ -54,7 +53,7 @@ test("R4 (cause 33; the real plane) sixty held: the first page names fifty of th
   const first = rows(p);
   assert.equal(first.length, 50, "the page names fifty");
   const answer = seen.find((a) => a.result && Array.isArray(a.result.held) && a.result.held.length === 50);
-  assert.ok(answer && answer.result.truncated === true && typeof answer.result.next === "string" && answer.result.next, "the plane says there are more and where: " + JSON.stringify(answer && answer.result.next));
+  assert.ok(answer && answer.result.truncated === true && typeof answer.result.next === "string" && answer.result.next, "the store says there are more and where: " + JSON.stringify(answer && answer.result.next));
   assert.ok(moreLine(p), "the sentence that more are waiting");
   const door = btn(p, "heldcaptures", `[data-after]`);
   assert.ok(door, "and its door to the next page");
@@ -71,7 +70,7 @@ test("R4 (cause 33; the real plane) sixty held: the first page names fifty of th
   assert.ok(btn(p, "heldcaptures", `[data-back]`), "a way back");
 });
 
-test("R4 (cause 33; the real plane) 'Everyone's' is a filter between the viewer's own and the team's: the page is read again with no `member`, from the first page", async () => {
+test("R4 (cause 33; the real store) 'Everyone's' is a filter between the viewer's own and the team's: the page is read again with no `member`, from the first page", async () => {
   const { p, me } = await heldPage();
   const choice = p.doc.getElementById("ch-who");
   assert.ok(choice, "the filter is drawn");
@@ -94,7 +93,7 @@ test("R4 (cause 33; the real plane) 'Everyone's' is a filter between the viewer'
   assert.equal(back[back.length - 1].query.member, me.member);
 });
 
-test("R4 (cause 33; the real plane) a project's page carries the project with the filter, and a list that fits one page draws no sentence and no door", async () => {
+test("R4 (cause 33; the real store) a project's page carries the project with the filter, and a list that fits one page draws no sentence and no door", async () => {
   const { p, me } = await heldPage("/app/held/PROJ-2026-0001-pothole-repairs-at");
   const r = pageReads(p)[0];
   assert.equal(r.query.project, "PROJ-2026-0001-pothole-repairs-at");
diff --git a/process/modules/plane.json b/process/modules/plane.json
index cc602757..a9993e8e 100644
--- a/process/modules/plane.json
+++ b/process/modules/plane.json
@@ -100,7 +100,6 @@
     "bio-plane/test/m/screens-inquiry/r10-stated.test.mjs",
     "bio-plane/test/m/screens-inquiry/r9-refusal.test.mjs",
     "bio-plane/test/m/screens-inquiry/r9-seam.test.mjs",
-    "bio-plane/test/m/screens-intake/r10-held-paging.test.mjs",
     "bio-plane/test/m/screens-intake/r10-open-file.test.mjs",
     "bio-plane/test/m/screens-intake/r10-pending.test.mjs",
     "bio-plane/test/m/screens-intake/r10-refused-kind.test.mjs",
```

## Order check a: the import tracer

The new test, after the move:
```
files 738 latest: 183 screens-intake via bio-plane/test/m/screens-intake/r10-held-paging.test.mjs
accepted-work(85):2 acquisition(55):6 act-help(155):1 action-clocks(141):5 action-grammar(137):5 action-holds(140):3 action-plans(147):5 action-producers(159):2 action-records(138):2 action-replies(142):3 actions(139):2 admission(169):3 affordances(156):4 ai-accounts(45):3 ai-runs(98):2 ai-use(97):3 answer-envelope(170):3 answers(104):10 attestation(52):4 basis-version-grammar(91):3 basis-versions(92):6 bias(78):3 budget-doctypes(29):6 calc-grammar(7):6 calculations(82):6 calibration(60):4 capture(56):6 capture-requests(100):3 capture-sources(54):8 case-account(129):4 case-authoring(132):2 case-carriage(116):3 case-catalogue(124):1 case-check(134):3 case-checker(126):9 case-disclosures(128):6 case-document(131):2 case-grammar(114):20 case-import(127):4 case-inputs(130):5 case-tensions(117):3 citation(90):4 civil-time(6):9 conformance(135):3 connection-grammar(8):7 connections(68):8 consequences(136):4 content(63):7 contradiction(95):4 contradiction-words(94):2 corpus-export(115):4 court-citations(13):2 court-doctypes(28):5 credentials(47):1 credentials-tables(46):2 csv-reader(17):1 doc-clean(33):6 docket(120):4 docprofile(24):6 doctypes(25):12 doorbell(57):4 duties(75):4 entities(64):4 escalation(146):5 events(65):9 explore(77):11 extraction(62):9 file-safety(58):8 file-scanner(37):4 filing-templates(143):4 filing-texts(144):2 filings(145):4 following(150):6 format-registry(21):1 host-governor(49):2 hypotheses(88):3 id-spaces(14):1 image-codecs(30):6 image-cover(32):5 inquiry(87):7 inquiry-grammar(84):3 instance-setup(166):3 intent(111):5 interface-assets(176):1 interface-shell(177):4 investigation(112):4 jurisdiction-profiles(4):2 jurisdictions(5):1 law-relations(70):3 leg-earning(86):2 legistar-reader(26):1 lines(66):4 link-sweep(151):5 local-facts(67):5 machinery-producers(158):1 member-roster(40):5 membership(43):4 money(73):3 money-checks(74):3 monitoring(149):4 network-notices(123):4 notice-producers(162):2 observation-log(69):4 odf-reader(19):1 office-readers(18):5 ooxml(16):1 op-capabilities(167):1 op-declarations(168):10 op-grade-tranches(38):16 op-grades(39):2 pdf-pixels(31):3 pdf-reader(20):1 people(76):3 plan-work(148):3 progressions(72):3 project-roster(44):3 project-stage(122):1 promotion(48):9 provenance(51):2 provenance-register(50):4 provenance-routes(53):4 public-read(121):12 publication(118):5 publish-schedule(119):4 query-language(79):1 question-explorer(103):4 queue(164):4 queue-catalogue(163):1 queue-producers(161):2 queue-words(160):1 ratification(125):9 reading-guides(101):5 reading-pipeline(61):4 record-core(42):1 record-core-tables(41):2 record-grammar(3):15 reevaluation(113):3 retrieval(81):9 retrieval-browse(80):6 review(133):3 roster-reader(27):7 run-productions(99):4 run-rules(96):7 runtime-limits(10):5 scheduler(152):1 screens-capture(182):1 screens-intake(183):10 setup-words(2):2 sheet-worker(36):1 signatures(11):3 signin-door(172):2 site-profiles(23):9 skills(102):2 sources(59):3 standards(71):5 steps(89):3 store-assembly(174):7 store-door(171):3 store-request(175):10 store-services(173):8 strength(93):7 subresources(15):1 tasks(157):3 test-support(9):5 text-chain(22):1 translations(165):4 wizard-library(153):4 wizard-scripts(154):6 workbooks(83):7
```
The original, at the base, for comparison:
```
files 742 latest: 196 plane via bio-plane/test/m/screens-intake/r10-held-paging.test.mjs
```
A gap in the tracer: it counts a file with no owner as -1, so it would ignore such a file without saying so. I checked this separately: all 738 traced files have an owner, and no relative specifier is left unresolved.

## Order check b: computed loads

`trace2.mjs` printed 443 candidate lines. 115 of them are rows in word tables (`setup-words/rows.mjs` 113, `capture/schema.mjs` 1, `op-grades/marks.mjs` 1) that matched the English word "from". Most of the rest are prose or string text, or methods named `#import(...)` / `readFile` that do not touch the file system. To narrow it down, I listed every traced file that imports `node:fs`, `node:fs/promises`, `node:module`, `node:url`, `child_process`, `worker_threads` or `vm`, or any bare package:
```
bio-plane/src/case-checker/main.mjs        | node:url,node:fs/promises
bio-plane/test/declared-ops.mjs            | node:fs,node:url
bio-plane/test/m/interface-shell/harness.mjs | node:url
bio-plane/test/m/store-assembly/world.mjs  | node:module
bio-plane/test/m/store-request/recipes-team.mjs | node:fs
(browserrender.mjs, account.mjs, grammar.mjs, doc.mjs, walk.mjs: false matches; "@cloudflare/puppeteer" appears only in comments)
```
Each of these, and what it loads or reads:
- `case-checker/main.mjs:58-62`: dynamic imports of `node:*` and `fs.readFile`, used only when the file is run as the main program (`argv[1]`). Never during this test.
- `store-assembly/world.mjs:21` (174): `registerHooks` swaps `cloudflare:workers` for an inline `data:` stand-in. It then imports store-assembly (174) and scheduler (152) by literal path.
- `store-request/recipes-team.mjs:72` (175): reads `doctypes/test/fixtures/fw18-doctypes.json`, which belongs to doctypes (25).
- `interface-shell/harness.mjs:54` → `declared-ops.mjs:100-142` (9): reads `process.json`, `process/modules/order.txt` and all 204 `process/modules/*.json` files. These are process configuration with no module owner. Bounded to modules 1-177, it walks their `files` folders, reads each file found as text, and `import(pathToFileURL(file))` only the files that carry `export const DECLARED_OPS`. **This is where plane and journey-check files get read** (see the runtime result below).
- `platform-sqlite.mjs`, loaded by the test command's `--import`, belongs to test-support (9).

Runtime confirmation. I ran the test with a loader hook and `fs` spies (`syncBuiltinESMExports`) and mapped every path touched to its owner, by `files` plus `tests` and longest match:
```
new test   load: 749 paths, latest owner 183; later than 183: none
new test   fs.readFileSync: 1273 paths; later than 183: plane(196):6 journey-check(204):10
new test   fs.readdirSync: 540 paths; later than 183: journey-check(204):225   (build/plan/..., build/tools/...)
new test   fs.statSync: 14654 paths; later than 183: journey-check(204):8001 plane(196):6
original   load: latest owner 196 (plane: realplane.mjs); readFileSync also of control-plane, plane and every screens-* module after 183 (Miniflare reading the plane's sources)
```
The 16 files read, all from inside `declared-ops.mjs`: plane's are `agent-worker/test/{agent-worker,harness,requirements,versions}.test.mjs`, `agent-worker/test/plane-world.mjs` and `roster-reader/test/fixtures/capture.mjs`. journey-check's are the 10 `agent-worker/test/*.control.mjs` files and `mutation-tree.mjs`. None contains `DECLARED_OPS`, so none was loaded.

## Order check c: `p4.mjs check screens-intake`

With `--files` set to the moved test (41 s):
```
Check of screens-intake: no disagreement found
  (25 lines "cannot tell, not refused": lines 5, 7 "a module from outside the product that the reader has no description of" (node:assert/strict, node:crypto); the rest "a kind that no comment states" / "plain code: no structured comment states what this contradicts"; two on screens-intake.json "calls by names, tables or values of unknown kind ... may make this use")
ok   (exit 0)
```
The whole module, run by `run tests` before the tests: `Check of screens-intake: no disagreement found`. The log has 2376 "cannot tell" lines across the module.

## Run results

How the required run works (`.github/workflows/module-tests.yml`): `p4.mjs run scope` writes `scope.json`. Then `p4.mjs run tests --scope` runs `p4.mjs check <module>`, followed by `node --import ./bio-plane/test/platform-sqlite.mjs --test <the module's test files>`. I rebuilt the scope a job branch for screens-intake would get ("whole module"), using the tool's own `loadModules` and `testFiles` on the working tree, so the plane.json edit was counted. That gave 42 files, including the moved test (41 at the base). Then I ran the tool's real `run tests`. The machine had 4 cores and Node 26.10.0.

```
screens-intake: exit 0; 42 file(s) ...; tests 378, pass 378, fail 0
duration_ms 349572 (tests); 389 s wall including the check
✔ ... sixty held ... (4105 ms)
✔ ... 'Everyone's' is a filter ... (296 ms)
✔ ... a project's page carries the project ... (106 ms)
Passed. ok
```
Baseline: the 41 base files alone, same command, no check: tests 375, pass 375, fail 0, duration_ms 351716.
The moved test alone: 3 of 3 pass, 5.5 s wall (4036 + 283 + 78 ms).
The original test alone in plane's form: 3 of 3 pass, 30.6 s wall (28493 + 346 + 52 ms).

## Not checked

- Not checked: GitHub's real runner. Everything ran locally with the tool's own commands. `run scope` itself was not run, because it needs a pull request's merge commit and the job block. I built its "whole module" output by hand using the tool's functions.
- Not checked: plane's own job after the move. Plane runs one test fewer, and I did not run plane's tests.
- Not checked: repeated timing runs. The wall-time difference comes from one run of each, and is within noise.
- Not checked: whether the process counts reading text that a shared harness does (declared-ops' folder walk) as "using" a later module. I report it as a reference above because it is one. The process text I read (`01b-the-commands.md`, item 18) describes `check` in terms of imports, and `check` found no disagreement.
