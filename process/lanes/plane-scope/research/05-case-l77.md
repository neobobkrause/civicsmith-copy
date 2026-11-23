Length: 106 lines. Last section: "Facts not found".

# Case study: `l77.test.mjs` (plane R77, now store-assembly R64 / store-services R64)

Research for the plane-scope lane, 23 Nov 2026. Read-only except this file. The test was run once locally (`node --test --test-force-exit bio-plane/test/m/plane/l77.test.mjs`, node 26.10.0): 1 of 1 pass, about 40 s, almost all of it two Miniflare/workerd boots and their waits.

## Summary for the owner

- **What the product does here.** Some work, like reading a big PDF, takes too long to do while a person waits. The product writes that work down in a to-do list (the "owed-work ledger") and works through the list later, when the object's alarm clock goes off. A very large read can crash the object: the platform kills it for using too much memory, and no error ever comes back. The ledger guards against this. It writes "started, try number N" *before* it begins each job. When the object comes back up, it finds a job marked started that nothing is running, counts it as "interrupted", and moves on to the next job. Without this, the same job would crash the object again and again.
- **What the test checks.** It boots the real product on the real Cloudflare runtime in a local simulator. It hands the ledger a read that never finishes, then shuts the runtime down mid-read, the way a crash would. It boots a fresh runtime over the same saved data and checks that the stuck job is counted as interrupted once, is waiting again, and is no longer marked running.
- **Whose code does the work.** Not plane's. The logic is in `bio-plane/src/store-assembly/pending.mjs`, a file of the module `store-services` (173). Plane's only part is a one-line forwarder from the platform's alarm to the scheduler (`store.mjs:76`).
- **Is it already proven elsewhere?** Yes, and more fully. `bio-plane/test/m/store-assembly/fix5-r77.test.mjs`, a Node test that belongs to `store-assembly` (174), checks the same rule plus the third interruption, the next job running, and a failure that is not an interruption. It does not start workerd.
- **What only this test adds.** It shows that three platform facts hold on the real runtime: memory is lost when the object restarts but its saved data is not; the alarm fires again by itself after the restart; and the ledger's database calls work on the platform's SQLite. It does **not** reproduce the real crash. The simulator has no 128 MB memory cap, so the "crash" here is the test shutting the runtime down.
- **Verdict: (d) mixed, so split it.** The ledger's rule belongs with its owner and is already proven in Node. A small residue about the platform's restart behaviour needs workerd, but it needs only the ledger and the scheduler inside some Durable Object, not plane's whole program. Confidence: high on where the logic lives and what is duplicated; medium on where the workerd residue should live, because no earlier module today has a workerd harness.

## 1. The test, line by line

File `bio-plane/test/m/plane/l77.test.mjs` (50 lines).

- `:1-4` header: "plane R77 (T51 fix round 5; E2; K4530), the platform check L on workerd under Miniflare, with the real Durable Object alarm and the real object storage". It also says Miniflare "enforces no 128 MB and no CPU limit".
- `:13` the entry is `l75-entry.mjs`, a test file of plane's. It is shared with `l75.test.mjs` (R75).
- `:15-22` `boot()` creates a Miniflare instance over that entry. It sets up the Durable Object class `Held` with SQLite storage (`useSQLite: true`), two R2 buckets, and **a persist directory on disk** (`durableObjectsPersist`), so a second boot sees the first one's storage.
- `:23-27` `ask()` sends a request **straight to the Durable Object** named `bio` at `/l75/<step>`. It skips the Worker, so the door, `control-plane` and `index.mjs`'s fetch are not on the path.
- `:33-34` step `hang`. In `l75-entry.mjs:48-53` this replaces `extractionOf(ctx).readHeld` with a function that logs the call and **never returns**, then calls `pendingOf(ctx).owe({kind: "reading", sha})`, which writes a `reading` row and arms the alarm. The test checks the answer `{ok: true}`.
- `:36-37` the test polls `state` for up to 10 s until the fake reader has been called. This proves **the real alarm fired by itself** and the ledger ran the row. The test never calls the alarm.
- `:38-40` the row shows `attempts: 1` (the try was counted before the reader ran) and `running: true`.
- `:41` `first.dispose()` ends the runtime while the reader is still hanging. This stands in for the isolate being killed.
- `:42-48` second boot over the same storage. The test polls `state` until `interrupted >= 1`, then checks `interrupted === 1`, `state === "owed"` and `running === false`.

Test title (`:30`): "...the next runtime over the storage reaps it as an interrupted run and does not run it first again". The test never actually checks the "not first again" part. It runs no second row, and only `fix5-r77` checks that.

`l75-entry.mjs:18-22`: `Held extends Store`, so the constructor (`assembleStore`, the whole program) and `alarm()` are plane's real ones. Only `/l75/` paths are intercepted.

## 2. The requirement and its home

- `build/requirements/plane.md:198`: "**R77** *(retired: moved to `store-assembly` R64, K5046)*".
- `build/requirements/store-assembly.md:123`: R64 "(was `plane` R77) **The owed-work ledger never forgets.**" The sentence this test proves is: "A row is stamped started and its try counted before its owner runs; a started row found by a later alarm, of an isolate no longer running it, is an interrupted run, counted in `interrupted` (kept across a re-registration), which does not end the row".
- The same R64 is listed `[met]` in `process/modules/store-services.md:37`, the module that owns `pending.mjs` (`process/modules/store-services.json`, `files`). Related: R76 (was plane R101, `store-assembly.md:135`), the poison rule (three kills of one unit).
- The test's header still says "plane R77". The 02-test-map row (`02-test-map.md:77`) lists it as "plane R77 / store-assembly".

## 3. The code path

1. `ask` → workerd → `Held.fetch` (`l75-entry.mjs:20`) → `pendingOf(ctx).owe` (`pending.mjs`, store-services).
2. The alarm fires → `Store.alarm()` (`store.mjs:76`, plane: `schedulerOf(...).alarm()`) → scheduler (152) runs its consumers. The log shows `pending-work` among about 9 others (`selection-sweep`, `task-drain`, ...), all built by the whole store.
3. `pending-work`'s tick → `run` (`pending.mjs:765-781`) → `stamp` (`:612-623`: `started_at`, `attempts+1`, back-off, unit stamp) → `running.add` → owner `readNow` → `extractionOf(ctx).readHeld` (the fake, which hangs).
4. After restart: `pendingOf` is a new holder, because `HOLDERS` is keyed by `ctx` (`:338`) and the `running` Set is in memory (`:355-356`). The consumer's `due`/`wake` answer "now" while a started row exists (`:909-914`). `reapInterrupted` (`:643-662`) finds the row started and not in `running`, then sets `interrupted+1`, `started_at=NULL`, `last_why="OBJECT_STOPPED"` and state `queued`/`partial`.
5. `state` reads `pendingOf(ctx).list()` → `view` (`:787`), where `running` = `started_at !== null && running.has(key)`.

All of the behaviour under test is in `pending.mjs` (store-services). Plane contributes `store.mjs:76` (the alarm forwarder, plane R4) and the constructor's `assembleStore` call (R1).

## 4. Why it boots plane's program: platform facts and convenience

**Platform facts it depends on:**
- (P1) A workerd restart drops module memory (the `running` Set and the `HOLDERS` WeakMap) while the SQLite storage persists. The whole reap rule rests on this.
- (P2) An alarm comes after the restart without any request. In the run log, the second runtime's `scheduler_alarm` carried `scheduled_for` far in the past and started at once. So the stored alarm left by the hung run fired on the new boot. I did not trace whether workerd re-fires an unfinished alarm or the stored alarm was simply past due ("unknown" on the exact mechanism).
- (P3) The Durable Object SQL API (`ctx.storage.sql.exec`) on workerd's SQLite, as against `node:sqlite` stand-ins.
- (P4) The real alarm runs the consumer without a test calling it.

**What it only uses because it was the convenient harness:**
- Plane's `Store` class and `assembleStore`: the whole program (every consumer, every module) is built only to reach `pendingOf` and the scheduler. Nothing about the other ~200 modules is checked.
- `l75-entry.mjs` existed already for R75 (fix round 4). R77's job added the `hang` step to it (`l75-entry.mjs:48-53`).
- The door and the Worker are skipped (`:25`), so plane's routing is not tested.

**What it does not prove although it is "at the real shape":**
- The real crash: no 128 MB cap and no CPU limit in Miniflare (`l77.test.mjs:3-4`; the job record `build/jobs/T51/plane.md:409` says the same: "the runs above prove the ledger's accounting on workerd, not the size").
- A deployed eviction or a code deploy cutting an alarm. `dispose()` is a local stand-in.

**History.** The shallow clone shows only the import commit (`42995c5f`). The reasons come from the records:
- fix round 4's R-FOUR (`build/plan/fix-round-4-T51.md:7`) requires, "where behaviour depends on the live platform, a check at the platform's real shape before the deploy", form **L** = "local workerd/miniflare run with the real limits".
- Bob's K4426 item (4) (`build/rulings.md:4422`).
- K4530 put fix round 5 in force (`:4525`).
- The live cause, E2: the oldest owed row killed the object at every tick and blocked every row behind it (`build/plan/fix-round-5-step0.md:28-33`). E2 was a platform kill, so its fix had to carry an L check.
- PLANE #50's record (`build/jobs/T51/plane.md:395-409`) shows the failing-first proof was `fix5-r77.test.mjs`, in Node, red then green. `l77.test.mjs` was added beside it as the L check (35 s).
- Later (K5046, the composition moved to store-assembly), `fix5-r77` was copied to `bio-plane/test/m/store-assembly/` ("store-assembly's copy of plane's test", its `:1`). `l77` stayed with plane.

## 5. Could the owner prove it?

**Already done one step later.** `bio-plane/test/m/store-assembly/fix5-r77.test.mjs:38-82` drives the assembled store in Node through `alarmed-store.mjs`. It abandons the never-returning promise and constructs a second store over the same db as "the restart" (`:51-52`). It checks everything l77 checks, and also that "not first again" holds, that a third interruption ends the row stated, that `owedwork` reports it, and a control in which a returned failure is not an interruption. `store-assembly.json` lists the whole `bio-plane/test/m/store-assembly/` directory, so this test is store-assembly's (174).

**At the owner, store-services (173).** The rule needs only `pendingOf` on a SQL storage, a scheduler, and a stubbed `extractionOf(ctx).readHeld`. These are store-services' own `uses` (record-core, extraction, scheduler, test-support). store-services' `r9-bookkeeping.test.mjs:13-19` already builds `pendingOf` on record-core's storage stand-in with no assembled store. test-support offers `alarm-double.mjs` (platform-shaped alarm: retries, re-run after success) and `platform-sqlite.mjs` (the 2.1 MB value limit). A test of "new ctx over the same storage = new isolate" is a few lines there. It would lose P1-P4, which a Node stand-in can only assume.

**The workerd residue (P1-P4).** These are facts about the platform, not about plane's composition. A Miniflare entry with a tiny Durable Object class that holds `pendingOf` plus the scheduler would check them. No module before plane has such a harness today: test-support has none, and only `journey-check` and `browserrender` import Miniflare in `src`. Plane is the only module whose code is a Durable Object class. Moving the residue earlier would therefore mean a new test-support kit, not a move. Lost by leaving it as it is: nothing. Lost by dropping it entirely: the one check that P1-P2 hold on workerd. These facts are stable platform behaviour, so the risk is low but not nil.

**Verdict: (d) mixed. Split it.**
- The ledger rule: (c) a store-services module test (today (b), at store-assembly, `fix5-r77`). l77 duplicates it.
- The platform residue: needs workerd but not plane's program. With today's harnesses its cheapest home is plane, or a slimmed entry that skips `assembleStore`.

Confidence: high that l77 adds no ledger logic beyond `fix5-r77`. Medium on placing the residue.

## 6. If it fails during plane's job

Likely causes, by whose code:
- `pending.mjs` stamp, reap or consumer `due`/`wake`: **store-services**.
- The scheduler's alarm loop or arming: **scheduler** (152).
- A storage or alarm change in `assembleStore`: **store-assembly** (174).
- `store.mjs:76` (alarm forwarding) or the `Held` entry: **plane** itself.
- Miniflare/workerd version behaviour (P1-P2): no module's. Test-support's harness, or a platform change to report.

A failure whose cause is in store-services, scheduler or store-assembly is a flaw in another module. Under Process4 as the brief states it (design part 2 §3), plane's job reports it to ARCH, which places it against that module. Plane's job is recorded blocked until that module's fix merges, and only then does plane's run go green. The same fault would normally show first, and more cheaply, in `fix5-r77` at store-assembly, which runs earlier in the order. If both fail, the owner's test points at the code. If only l77 fails, the cause is most likely P1-P4 (the platform or harness) or plane's own forwarder. I did not read the Process4 design itself (neobobkrause/process4 is not cloned here).

## Facts not found

- The exact reason the second runtime's alarm fires at once (an unfinished alarm re-fired, or a past-due stored alarm): unknown, not traced.
- Full git history of the file: the clone is shallow (only `42995c5f`). The account above is from the job records.
- Whether any requirement text still names "plane R77" as l77's proof outside the test header and `02-test-map.md`: not searched beyond `build/requirements` and `process/modules`.
- This lane's `research/README.md` index was not updated (one-file limit). It needs a line for this file.
