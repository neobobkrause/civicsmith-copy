Length: 256 lines. Last section: "Not checked".

# Moving `l77.test.mjs` out of plane: an experiment

Research for the plane-scope lane, 23 Nov 2026. This was a throwaway experiment in a scratch worktree, a detached checkout of `origin/p4-tranche` at `a26a8da2`. The local `p4-tranche` was stale (`d3cb895b`, with no `store-services` module), so I did not use it. I made one local commit in the detached scratch worktree, needed by `run scope`, which reads the module files at `HEAD`. It was never pushed. The worktree was removed at the end. Nothing in the main checkout changed except this file. Node 26.10.0, miniflare 4.20260722.0. Case study: `05-case-l77.md`.

## Answer for the owner

- **Target module: `store-services` (173),** the owner of `pending.mjs`. Both halves of the test stay on workerd there. The Node half and the real-runtime half both work with nothing later than 173, so I did not need the store-assembly (174) fallback.
- **Does the rewritten test refer to any module later than store-services, by any route? No.** I checked three ways: static imports, computed loads, and the files Miniflare actually read and handed to workerd at boot. The latest module reached is store-services itself (173), and after it scheduler (152). Nothing from store-assembly's composition, control-plane or plane is loaded. The details are in "Order checks".
- **Does it pass in store-services' run? Yes.** The whole-module run as the job's required run does it (`p4 run scope`, then `p4 run tests`): 27 tests, 27 pass, 0 fail, exit 0. `p4 check store-services` reports "no disagreement found".
- **Assertions:** all 8 are kept word for word, and none was dropped or loosened. What changed is the object the test boots: a small test-only Durable Object in place of plane's `Store`. The list is in "What the rewrite keeps and changes".
- **Cost to the module's run:** it adds about 21 s. Before the move, `node --test` took 2.4 to 2.6 s and the whole run about 9.3 s. After it, `node --test` took 22.6 to 23.9 s and the whole run 29.7 to 31.8 s. The moved test takes 20.5 to 21.3 s alone or inside the run. Measured the same way, the test took 47.2 s at plane, so plane's run would lose that much.
- **Verdict: yes.** The test can run in store-services' job, not plane's, and it checks the same things on the real runtime. It costs that module's run about 21 s of extra time, and it needs Miniflare, which is already a bio-plane dependency and already used by record-core (42).

## Why store-services and not store-assembly

- The behaviour is in `bio-plane/src/store-assembly/pending.mjs`, a file of `store-services` (its json `files`).
- The test needs `pendingOf`, the scheduler, `extractionOf(ctx).readHeld` and record-core's migration. All four are declared `uses` of store-services: record-core, scheduler, extraction and test-support.
- The real-runtime half needs a Durable Object class. Plane's `Store` was the only one, because it calls `assembleStore`, which belongs to store-assembly (174). I replaced it with a test-only entry, `l77-entry.mjs`, that builds just the parts the rule needs, the way `assembleStore` does (`assemble.mjs:580` and `:754`, `store.mjs:76`):
  - `recordOf(ctx).migrate()` and `pendingOf(ctx).migrate()`;
  - the scheduler's registration of the `pending-work` consumer before the scheduler's start;
  - `schedulerOf(ctx, env).start()`;
  - `alarm()` forwarded to the scheduler.
  This follows an existing pattern: record-core (42) already has a test-only Worker under Miniflare (`test/m/record-core/counter-worker.mjs`).
- Ownership: the folder `bio-plane/test/m/store-assembly/` belongs to store-assembly as a whole. Listing the two files by name in `store-services.json` makes them store-services' by the longest match. The tool's `ownerOf` and `trace.mjs` both agree.
- I made no edit to `plane.json`. Its `"tests"` is the folder `bio-plane/test/m/plane/` and names no file, so the test leaves plane's run when the file moves out of that folder.

## What the rewrite keeps and changes

All 8 assertions are kept, unchanged in text and value:

1. Every request answers status 200 (`ask`, `assert.equal(r.status, 200, t)`).
2. Filing the hung reading answers `owed` = `{ok: true}`.
3. Within 10 s, the real alarm begins the read by itself: `readHeld.length === 1`, "the alarm began the read".
4. The row has `attempts === 1`: its try was counted before the owner ran.
5. The row has `running === true`.
6. After `dispose()` and a second boot over the same persisted storage: `interrupted === 1`, "found started and not finished: an interrupted run".
7. `state === "owed"`.
8. `running === false`.

The 120 s timeout, the polling loops and the two Miniflare boots over one `durableObjectsPersist` folder are all unchanged.

Changed, outside the assertions:

- **Booted class.** The test boots a test-only `Held extends DurableObject` (store-services) instead of `Held extends Store` (plane). So `assembleStore`, store-assembly's composition, is no longer on the path. The ledger, the real scheduler (default owners), the real alarm and the real SQLite are still on it.
- **Scheduler consumers.** In the slim object, 5 of the scheduler's own consumers end their ticks with `outcome: "error"` (`selection-sweep`, `archive-monitor`, `connection-derive`, `overdue-scan`, `interest-checks`). The tables of their owner modules are not migrated here. `task-drain`, which is registered by the composition, is absent. In the original run all of them were `ok`. The scheduler keeps each consumer's failure to itself, and `pending-work` ran `ok` in every run. This is a fidelity difference, not an assertion change. Passing the scheduler `deps.owners: {}` would leave `pending-work` alone in the scheduler. I did not try that variant.
- **R2.** The R2 buckets `CAPTURES` and `PUBLISHED` were dropped. Nothing on this path used them.
- **Route and names.** The route prefix is now `/l77/`, the persist prefix is now `store-services-l77-`, and the title and header now cite "store-services R64 (was plane R77)".
- **Pre-existing gap, unchanged.** The title says "and does not run it first again", but no assertion checks that, in either version. `fix5-r77.test.mjs` (store-assembly) checks it in Node.

**Mutation check.** I disabled `reapInterrupted(at)` in the consumer's tick (`pending.mjs:917`) in scratch and reran the moved test. It failed at assertion 6 (actual 0, expected 1), so the moved test still catches a broken reap. The mutation was then reverted.

## The diff

Scratch commit `71654472` against `a26a8da2`:

```diff
diff --git a/bio-plane/test/m/store-assembly/l77-entry.mjs b/bio-plane/test/m/store-assembly/l77-entry.mjs
new file mode 100644
index 00000000..f6afe5dc
--- /dev/null
+++ b/bio-plane/test/m/store-assembly/l77-entry.mjs
@@ -0,0 +1,38 @@
+/* store-services R64 (was plane R77; T51 fix round 5, E2; K4530), the platform check L: a test-only Durable Object for
+   `l77.test.mjs`, booted on workerd under Miniflare. It holds only what the ledger's rule needs and builds it as the real store
+   does (`store-assembly`'s `assembleStore`, `plane`'s `Store`): record-core's and the ledger's tables migrated, the ledger's
+   `pending-work` consumer registered with the instance's real scheduler before the scheduler's start, and the platform's alarm
+   forwarded to the scheduler (plane R4's one line). No module later than store-services is imported. `/l77/hang` owes a reading
+   whose owner never returns; `/l77/state` reads the ledger back. */
+import { DurableObject } from "cloudflare:workers";
+import { recordOf } from "../../../src/record-core/index.mjs";
+import { schedulerOf } from "../../../src/scheduler/index.mjs";
+import { extractionOf } from "../../../src/extraction/index.mjs";
+import { pendingOf } from "../../../src/store-assembly/pending.mjs";
+
+const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
+
+export class Held extends DurableObject {
+  readHeldCalls = [];
+  constructor(ctx, env) {
+    super(ctx, env);
+    this.ctx = ctx; this.env = env;
+    const pending = pendingOf(ctx, { env });
+    schedulerOf(ctx, env).register("plane", pending.consumer());   /* as assembleStore: before the scheduler's start (scheduler R11) */
+    ctx.blockConcurrencyWhile(async () => { recordOf(ctx).migrate(); pending.migrate(); });
+    ctx.blockConcurrencyWhile(async () => schedulerOf(ctx, env).start());
+  }
+  async alarm() { await schedulerOf(this.ctx, this.env).alarm(); }   /* plane R4's forwarder, the one line */
+  async fetch(req) {
+    const url = new URL(req.url), ctx = this.ctx, step = url.pathname.replace(/^\/l77\//, "");
+    if (step === "state") return json({ pending: pendingOf(ctx).list(), alarm: await ctx.storage.getAlarm(), now: Date.now(), readHeld: this.readHeldCalls });
+    if (step === "hang") {
+      /* an owner that never returns, as an isolate killed in the middle of a read; the test then ends this runtime */
+      const d = url.searchParams.get("sha");
+      // fixtures-own: synthetic the owner of the reading never answers: the rule under test is the ledger's stamp and reap, not what the reader returns
+      extractionOf(ctx).readHeld = async (a) => { this.readHeldCalls.push({ ...a, at: Date.now() }); return new Promise(() => {}); };
+      return json({ owed: await pendingOf(ctx).owe({ kind: "reading", sha: d }), at: Date.now() });
+    }
+    return json({ error: "unknown l77 step" }, 404);
+  }
+}
diff --git a/bio-plane/test/m/plane/l77.test.mjs b/bio-plane/test/m/store-assembly/l77.test.mjs
similarity index 73%
rename from bio-plane/test/m/plane/l77.test.mjs
rename to bio-plane/test/m/store-assembly/l77.test.mjs
index 1aa67325..0bd4db90 100644
--- a/bio-plane/test/m/plane/l77.test.mjs
+++ b/bio-plane/test/m/store-assembly/l77.test.mjs
@@ -1,5 +1,5 @@
-/* plane R77 (T51 fix round 5; E2; K4530), the platform check L on workerd under Miniflare, with the real Durable Object alarm and the real
-   object storage: a reading that never returns (the isolate killed in the middle of it) is found started by the next runtime over the
+/* store-services R64 (was plane R77; T51 fix round 5; E2; K4530), the platform check L on workerd under Miniflare, with the real Durable
+   Object alarm, the real scheduler and the real object storage, through a test-only object of this module's (`l77-entry.mjs`), not plane's: a reading that never returns (the isolate killed in the middle of it) is found started by the next runtime over the
    same storage, counted as an interrupted run, and not run first again; the ledger of the round before gains its columns. The runtimes
    are Miniflare's, which enforces no 128 MB and no CPU limit: the numbers of a read at the object's real share are the job's record's. */
 import { test } from "node:test";
@@ -10,24 +10,24 @@ import { join } from "node:path";
 import { fileURLToPath } from "node:url";
 import { Miniflare } from "miniflare";
 
-const ENTRY = fileURLToPath(new URL("./l75-entry.mjs", import.meta.url));
-const persist = mkdtempSync(join(tmpdir(), "plane-l77-"));
+const ENTRY = fileURLToPath(new URL("./l77-entry.mjs", import.meta.url));
+const persist = mkdtempSync(join(tmpdir(), "store-services-l77-"));
 const boot = () => new Miniflare({
   modules: true, modulesRoot: "/", scriptPath: ENTRY, script: readFileSync(ENTRY, "utf8"),
   modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
   compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
   durableObjects: { STORE: { className: "Held", useSQLite: true } },
-  r2Buckets: ["CAPTURES", "PUBLISHED"], bindings: { INSTANCE_NAME: "l77", VERSION: "test" },
+  bindings: { INSTANCE_NAME: "l77", VERSION: "test" },
   durableObjectsPersist: persist,
 });
 const ask = async (mf, path) => {
   const ns = await mf.getDurableObjectNamespace("STORE");
-  const r = await ns.get(ns.idFromName("bio")).fetch(`http://do/l75/${path}`);
+  const r = await ns.get(ns.idFromName("bio")).fetch(`http://do/l77/${path}`);
   const t = await r.text(); assert.equal(r.status, 200, t); return JSON.parse(t);
 };
 const d = "c".repeat(64);
 
-test("R77 L: on workerd a run that never returns is stamped started with its try counted; the next runtime over the storage reaps it as an interrupted run and does not run it first again", { timeout: 120_000 }, async () => {
+test("R64 (was plane R77) L: on workerd a run that never returns is stamped started with its try counted; the next runtime over the storage reaps it as an interrupted run and does not run it first again", { timeout: 120_000 }, async () => {
   const first = boot();
   try {
     const filed = await ask(first, `hang?sha=${d}`);
diff --git a/process/modules/store-services.json b/process/modules/store-services.json
index 31b91527..78b747a7 100644
--- a/process/modules/store-services.json
+++ b/process/modules/store-services.json
@@ -17,7 +17,9 @@
     "bio-plane/test/m/store-assembly/cp-declared-ops.test.mjs",
     "bio-plane/test/m/store-assembly/cp-declared-registration.test.mjs",
     "bio-plane/test/m/store-assembly/cp-owner-ops.test.mjs",
-    "bio-plane/test/m/store-assembly/r9-bookkeeping.test.mjs"
+    "bio-plane/test/m/store-assembly/r9-bookkeeping.test.mjs",
+    "bio-plane/test/m/store-assembly/l77.test.mjs",
+    "bio-plane/test/m/store-assembly/l77-entry.mjs"
   ],
   "public": [
     "bio-plane/src/store-assembly/acquire-timings.mjs",
```

## Order checks

### a. `trace.mjs` (static and literal dynamic relative imports, owner by json)

The test reaches its entry only through `new URL("./l77-entry.mjs")`, a computed load. So I passed the entry explicitly as well. Run from the scratch root:

```
$ node trace.mjs bio-plane/test/m/store-assembly/l77.test.mjs bio-plane/test/m/store-assembly/l77-entry.mjs
files 554 latest: 173 store-services via bio-plane/test/m/store-assembly/l77.test.mjs
accepted-work(85):2 acquisition(55):6 action-clocks(141):5 action-grammar(137):5 action-holds(140):3 action-plans(147):5 action-records(138):2 action-replies(142):3 actions(139):2 ai-accounts(45):3 ai-runs(98):2 ai-use(97):3 answers(104):10 attestation(52):4 basis-version-grammar(91):3 basis-versions(92):6 bias(78):3 calc-grammar(7):6 calculations(82):6 calibration(60):4 capture(56):6 capture-requests(100):3 capture-sources(54):7 case-account(129):4 case-authoring(132):2 case-carriage(116):3 case-catalogue(124):1 case-check(134):3 case-checker(126):9 case-disclosures(128):6 case-document(131):2 case-grammar(114):20 case-import(127):4 case-inputs(130):5 case-tensions(117):3 citation(90):4 civil-time(6):9 conformance(135):3 connection-grammar(8):7 connections(68):7 consequences(136):4 content(63):7 contradiction(95):4 contradiction-words(94):2 corpus-export(115):4 court-citations(13):2 credentials(47):1 credentials-tables(46):2 csv-reader(17):1 doc-clean(33):6 docket(120):4 docprofile(24):6 doctypes(25):12 doorbell(57):4 duties(75):4 entities(64):4 escalation(146):5 events(65):9 extraction(62):8 filing-templates(143):4 filing-texts(144):2 filings(145):4 following(150):6 format-registry(21):1 host-governor(49):2 id-spaces(14):1 image-codecs(30):5 image-cover(32):5 inquiry(87):7 inquiry-grammar(84):3 intent(111):5 investigation(112):3 jurisdiction-profiles(4):2 jurisdictions(5):1 law-relations(70):3 leg-earning(86):2 legistar-reader(26):1 lines(66):4 link-sweep(151):5 local-facts(67):5 member-roster(40):5 membership(43):4 money(73):3 money-checks(74):3 monitoring(149):4 network-notices(123):4 observation-log(69):4 odf-reader(19):1 office-readers(18):5 ooxml(16):1 pdf-pixels(31):2 pdf-reader(20):1 people(76):3 plan-work(148):3 progressions(72):3 project-roster(44):3 project-stage(122):1 promotion(48):9 provenance(51):1 provenance-register(50):4 provenance-routes(53):4 public-read(121):10 publication(118):4 publish-schedule(119):4 query-language(79):1 ratification(125):9 reading-guides(101):5 reading-pipeline(61):4 record-core(42):1 record-core-tables(41):2 record-grammar(3):15 reevaluation(113):3 retrieval(81):9 retrieval-browse(80):6 run-productions(99):4 run-rules(96):7 runtime-limits(10):5 scheduler(152):1 setup-words(2):2 sheet-worker(36):1 signatures(11):2 site-profiles(23):9 skills(102):1 sources(59):3 standards(71):5 steps(89):3 store-services(173):3 strength(93):7 subresources(15):1 text-chain(22):1 workbooks(83):7
```

The latest module reached is 173, store-services. The highest positions in the list are 151 (link-sweep), 152 (scheduler) and 173 (store-services); nothing from 174 on appears. Run alone, the test gives `files 1 latest: 173 store-services`, and the entry alone gives `files 553 latest: 173 store-services via ...l77-entry.mjs`. Almost all of the 553 files come from `pending.mjs`'s own imports: on its own, `pending.mjs` reaches 552 files, latest 173.

### b. `trace2.mjs` (candidate computed loads)

`node trace2.mjs <test> <entry>` printed 367 candidate lines over the 554 files. The lines in the two moved files:

```
bio-plane/test/m/store-assembly/l77.test.mjs:11: import { Miniflare } from "miniflare";
bio-plane/test/m/store-assembly/l77.test.mjs:13: const ENTRY = fileURLToPath(new URL("./l77-entry.mjs", import.meta.url));
bio-plane/test/m/store-assembly/l77.test.mjs:16: modules: true, modulesRoot: "/", scriptPath: ENTRY, script: readFileSync(ENTRY, "utf8"),
bio-plane/test/m/store-assembly/l77-entry.mjs:7: import { DurableObject } from "cloudflare:workers";
bio-plane/test/m/store-assembly/l77-entry.mjs:27: const url = new URL(req.url), ctx = this.ctx, step = url.pathname.replace(/^\/l77\//, "");
```

- `l77.test.mjs:13` and `:16`: Miniflare is given `scriptPath`/`script` = `l77-entry.mjs`, owned by **store-services (173)**, with `modulesRoot: "/"` and the rule `**/*.mjs`. Miniflare therefore collects the entry's imports from disk at boot.
- `l77.test.mjs:11` loads the `miniflare` package, and `l77-entry.mjs:7` loads `cloudflare:workers`, a workerd built-in. Neither is a module.
- `l77-entry.mjs:27`: `new URL(req.url)` parses a request; it loads nothing.

The other 362 lines in the imported source fall into four groups, and none reads a file:
- `new URL(<runtime string>)` parsing addresses: subresources, acquisition, capture, render, following and others.
- Strings or comments containing "from": 113 in `setup-words/rows.mjs`, plus the grammar files.
- `case-import`'s private `#import(id)` method.
- `case-checker/main.mjs:58-61`, `await import("node:path"|"node:url"|"node:fs/promises")`, which are built-ins only.

There is no `readFileSync`, `require` or non-literal `import()` of a product file anywhere in the graph except the test's own read of its entry.

**What Miniflare actually loaded.** I booted Miniflare exactly as the test does, from a probe script, and recorded every file Node read during the boot and the first request (`fs.readFileSync` and `fs.promises.readFile` patched). It read 553 product files. Compared with the static walk of the entry, the two sets were identical except for two files:
- the entry itself, which is passed as `script` and was read with the unpatched call;
- `.wrangler/cache/cf.json`, Miniflare's own `cf` cache, which is no module (owner: none).

Ownership of the 553 files: none is unowned or after 173 apart from that cache file, and the latest is store-services via `pending.mjs`. Workerd is handed modules by Miniflare and does not read the product's disk itself. I did not check that separately (see "Not checked").

### c. `p4.mjs check store-services` (declared uses, comments, interfaces)

```
$ node /root/process4/0eec86fd8ddcffbc804b761e18095a52a80a5288/tool/p4.mjs check store-services
Check of store-services: no disagreement found
  cannot tell, not refused: ... (358 lines; 343 before the move)
ok            (exit 0)
```

The 15 new "cannot tell" lines are all in the two moved files, of these kinds:
- "a module from outside the product that the reader has no description of": `miniflare`, `cloudflare:workers` and the `node:` imports;
- "a kind that no comment states";
- "a Node name the reader is not told of".

No declared use is missing. The entry imports only record-core, scheduler, extraction and store-services' own `pending.mjs`, all of which store-services declares and all of which come before it.

## Runs

**The job's required run, reproduced locally.**
- Scope command: `p4.mjs run scope --base a26a8da2 --base-ref p4-tranche --branch job/store-services.1 --draft false --job-block <empty>`.
- It answered `whole module, because job branch for store-services; no job block was read`, with 6 test files: the 5 existing ones plus `l77.test.mjs`. `l77-entry.mjs` is not a `*.test.*` file, so the tool does not run it as a test, as intended.
- Then `p4.mjs run tests --scope scope.json`. This runs `p4 check`, then `node --import ./bio-plane/test/platform-sqlite.mjs --test <6 files>`, without `--test-force-exit`, and it exited cleanly.

| Run | tests | pass | fail | `node --test` duration | wall (incl. check) |
|---|---|---|---|---|---|
| store-services before (5 files), run 1 | 26 | 26 | 0 | 2.40 s | 9.2 s |
| store-services before, run 2 | 26 | 26 | 0 | 2.64 s | 9.4 s |
| store-services after (6 files), run 1 | 27 | 27 | 0 | 22.62 s | 29.7 s |
| store-services after, run 2 | 27 | 27 | 0 | 23.90 s | 31.8 s |
| moved test inside the run | 1 | 1 | 0 | 21.33 s | |
| moved test alone (`--test --test-force-exit`) | 1 | 1 | 0 | 20.47 s (file 20.83 s) | 22.4 s |
| original `plane/l77.test.mjs` alone, same machine | 1 | 1 | 0 | 47.21 s | |
| moved test with `reapInterrupted` disabled | 1 | 0 | 1 | | |

Run time added to store-services' run: about 21 s (`node --test` from about 2.5 s to about 23 s; wall from about 9.3 s to about 31 s). The moved test is about half as long as the original. Its slim object builds no `assembleStore`, so each boot is cheaper.

**One platform fact seen.** Both versions log workerd's `SQLite alarm overdue, running despite AlarmManager mismatch` on the second boot. The stored alarm was past due at the restart, and workerd ran it. This partly answers 05's open question about P2: a past-due stored alarm, not a re-fired unfinished one.

## Not checked

- not checked: the real GitHub run. I reproduced `run scope` and `run tests` locally, on a detached local commit with one parent (no merge commit), a hypothetical job branch name and an empty job block.
- not checked: `p4.mjs check plane` after the file leaves plane's folder.
- not checked: plane's whole run time before and after. Plane's saving was measured only as the original test alone (47.2 s).
- not checked: flakiness beyond 3 passing runs of the moved test, in particular whether the 5 erroring scheduler consumers could ever delay `pending-work`'s tick past the 10 s polls.
- not checked: the variant with `deps.owners: {}` (only `pending-work` in the scheduler).
- not checked: what workerd itself resolves at run time apart from the modules Miniflare hands it. I recorded only Node-side file reads.
- not checked: the real 128 MB kill. Neither version reproduces it; Miniflare has no memory or CPU cap.
- not changed: `l75-entry.mjs`'s `hang` step in plane is now used by nothing. Also unchanged: the docs that name the old path (`02-test-map.md`, `03-run-time.md`, `build/jobs/T51/plane.md`, some `build/plan/` files) and the requirement text naming plane R77.
