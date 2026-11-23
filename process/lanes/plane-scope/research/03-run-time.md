Length: 132 lines. Last section: "Facts not found".

# Where the time goes in plane's required test run

Research for the plane-scope lane, 23 Nov 2026. Read-only: workflow file, the process tool at commit 0eec86fd, the job logs of four complete module-tests runs on PR 1259 (branch `job/plane.1`), and the test sources at each run's head commit. Nothing was re-run.

Names: `bp/` means `bio-plane/test/`. "s" is seconds.

## How the run works

- Workflow `.github/workflows/module-tests.yml`, two jobs, both on `ubuntu-latest`. The repository is public, so that is GitHub's standard 4-vCPU, 16 GB Linux runner (image `ubuntu-26.04`, version 20261116.202.1 in the logs).
- Job `scope` (limit 10 min) checks out with full history (`fetch-depth: 0`, about 1.5 to 1.8 min in every run seen), fetches the tool, reads the job block, and runs `p4.mjs run scope`. For `job/plane.1` the answer is "whole module": 147 test files (4 in `agent-worker/test/`, 143 in `bio-plane/test/`).
- Job `module-tests` has `timeout-minutes: 45`. That limit covers checkout (about 20 s), setup-node (5 s), every `npm ci` in `process.json`'s nine lock files plus the tool (about 16 to 20 s), and then the test step.
- The test step runs `p4.mjs run tests`. In `tool/lib/scope.mjs` (`runTests`), for each module it first runs the tool's `check` of the module, then runs `process.json`'s `test_command`, `node --import ./bio-plane/test/platform-sqlite.mjs --test`, with **all 147 files as arguments in one Node process**. Node is 26.10.0 (`process.json` `node`).
- No `--test-concurrency` is given anywhere (not in `process.json`, the workflow or the tool). Node's runner therefore runs **one child process per file, at most `os.availableParallelism() - 1` at once: 3 on this runner**. Files start in the order given (alphabetical by path, as scope lists them). Tests inside one file run one after another unless the file asks otherwise.
- No per-file timeout is set by the tool or the command; Node's default test timeout is none. 68 of the 147 files set a `timeout:` on some of their own tests.
- The tool starts the test command with `spawnSync` and no timeout (`tool/lib/util.mjs` `run`). Output is buffered and printed only when the whole command exits. So every log line carries the same end timestamp, and **a run killed by the 45-minute limit prints no test output at all**.
- The reporter is Node's default `spec` reporter. It prints each top-level test with its duration, and a file with no `node:test` tests (a plain script) as one line named by its path. It does not print a per-file time for files that use `node:test`, and it does not print start times.
- The step's own time is the reporter's `duration_ms` plus about 30 s (the `check`, and Node start-up).

## The runs seen

All runs of module-tests on `job/plane.1` (14 in all; the short ones ran scope "nothing" while the pull request was a draft). The run times are from the API's start and update times; "tests" is the reporter's `duration_ms`.

| run id | started (UTC, 23 Nov) | run | tests | outcome | head commit, what it changed |
|---|---|---|---|---|---|
| 45143750217 | 09:04 | 2.2 min | none | success | 8dcd8c0, start (draft, nothing run) |
| 45145766396, 45149186412, 45150199123 | 09:18 to 09:47 | under 2 min | none | success | draft, nothing run |
| 45153717371 | 10:10 | 38.9 min | 2144 s (35.7 min) | **success** | e4b4f59, migrate-released reads committed stores |
| 45160480147 | 10:55 | 35.3 min | unknown | cancelled (by a newer push) | 2c0f85e |
| 45165860269 | 11:30 | 41.7 min | unknown | cancelled (by a newer push) | 18c202f |
| 45172042267 | 12:12 | 46.8 min | unknown | cancelled: the test step ran 12:14:23 to 12:58:49, so it **hit the 45-minute limit** | 8fb5e0e |
| 45179857787 (attempt 2) | 14:21 | 46.9 min | unknown | cancelled, by its times also at the limit (jobs not read) | 3fb0b7d |
| 45208833265 | 15:45 | 46.2 min | 2560 s (42.7 min) | failure: `r46-memory` peak 85.4 % of cap (limit 85 %) | 53bff0d, migrate-released boots stores in up to 4 child processes |
| 45219676935 | 16:43 | 44.2 min | 2450 s (40.8 min) | failure: `r46-memory` peak 89.4 % of cap | 89caa76, migrate-released builds the plane bundle once |
| 45227944385 | 17:27 | 36.6 min | 2002 s (33.4 min) | failure: `r8-wave` "derived the feed 2 times; at most 1" | 821c1cf, merge of p4-tranche |
| 45236029125 | 18:13 | in progress when read | unknown | unknown | f0a8c9a, migrate-released two stores at a time, not four |

In the four complete runs: 591 top-level tests; the failures were one test each, both of them load-sensitive measurements, not time-outs. The two runs that reached the limit left no test output, so what was slow in them is unknown.

## How the per-file figures were made

The `spec` reporter gives no per-file time for `node:test` files. Each file's top-level tests are printed together, in file order, so each top-level test line was given to a file by finding its name in that file's source (or in the test helpers it imports) at the run's head commit, moving forward through the file list. 118 of 591 test names are built at run time and could not be matched; they were given to the file being read at that point, which is right when a file's tests are printed together. Plain-script files (migrate-released, tier2-wire, harness, d606 and others) are exact: the reporter times the whole file.

Two limits on these figures. They are a **lower bound** for `node:test` files: a file's start-up, imports and `before`/`after` hooks (where most files boot workerd through Miniflare) are not in any test's time. And they are **wall times under load**: three files share four CPUs, so the same file is 30 to 50 % slower in a slow run than in a fast one.

## Slowest files

Sorted by run 45153717371 (the one success). Columns: 45153717371 (success), 45208833265, 45219676935, 45227944385. "tests" is the count of top-level tests (1 for a plain script).

| # | file | 45153717371 s | 45208833265 s | 45219676935 s | 45227944385 s | top-level tests |
|---|---|---|---|---|---|---|
| 1 | bp/system/migrate-released.test.mjs | 641 | 614 | 294 | 222 | 1 |
| 2 | bp/m/control-plane/t51-reading-follows.test.mjs | 278 | 285 | 286 | 281 | 3 |
| 3 | agent-worker/test/harness.test.mjs | 177 | 210 | 262 | 205 | 1 |
| 4 | bp/d606-perpage-ocr.test.mjs | 159 | 212 | 244 | 192 | 1 |
| 5 | bp/m/plane/g83-location.test.mjs | 132 | 182 | 202 | 160 | 9 |
| 6 | bp/m/instance-setup/worker-reports.test.mjs | 116 | 161 | 168 | 145 | 10 |
| 7 | bp/m/plane/corpus-r.test.mjs | 112 | 162 | 191 | 141 | 65 |
| 8 | bp/tier2-wire.test.mjs | 106 | 284 | 272 | 206 | 1 |
| 9 | bp/m/plane/r8-headofline.test.mjs | 100 | 117 | 129 | 115 | 3 |
| 10 | bp/m/plane/l75.test.mjs | 100 | 132 | 157 | 124 | 5 |
| 11 | bp/m/plane/r8-heal-door.test.mjs | 92 | 121 | 125 | 110 | 4 |
| 12 | bp/m/plane/g55-alarm-l.test.mjs | 84 | 117 | 131 | 104 | 2 |
| 13 | bp/m/plane/g128i-over-24mib.test.mjs | 82 | 125 | 140 | 104 | 11 |
| 14 | bp/m/control-plane/t51-round8-seam.test.mjs | 82 | 95 | 97 | 86 | 17 |
| 15 | bp/m/control-plane/t51-round6-seam.test.mjs | 77 | 100 | 94 | 87 | 7 |
| 16 | bp/m/control-plane/t51-round7-seam.test.mjs | 72 | 85 | 90 | 75 | 18 |
| 17 | bp/m/plane/l79.test.mjs | 56 | 69 | 73 | 63 | 5 |
| 18 | bp/m/plane/r10-lag-figure.test.mjs | 53 | 57 | 62 | 48 | 2 |
| 19 | agent-worker/test/requirements.test.mjs | 52 | 63 | 75 | 58 | 1 |
| 20 | bp/m/instance-setup/reports.test.mjs | 51 | 70 | 76 | 55 | 7 |
| 21 | bp/m/control-plane/t51-round5-seam.test.mjs | 49 | 52 | 54 | 51 | 5 |
| 22 | bp/m/plane/g123h-preload.test.mjs | 49 | 71 | 83 | 63 | 11 |
| 23 | bp/m/plane/l77-traffic.test.mjs | 48 | 63 | 64 | 57 | 1 |
| 24 | bp/m/control-plane/t51-round5-press-seam.test.mjs | 44 | 52 | 56 | 49 | 7 |
| 25 | bp/m/plane/r7-contention.test.mjs | 44 | 52 | 58 | 51 | 5 |

Wall time of each run: 2144, 2560, 2450 and 2002 s. The 147 files' times add up to 5068, 6491, 6783 and 5520 s. Divided by the wall time, that is 2.4 to 2.8 files running at once, against a ceiling of 3.

## Shares by group

Each group's seconds and its share of the summed file time, per run. Each file is in the first group that matches it.

| group | files | 45153717371 s (share) | 45208833265 s (share) | 45219676935 s (share) | 45227944385 s (share) |
|---|---|---|---|---|---|
| migrate-released | 1 | 641 (13%) | 614 (9%) | 294 (4%) | 222 (4%) |
| tier2-wire | 1 | 106 (2%) | 284 (4%) | 272 (4%) | 206 (4%) |
| control-plane t51 seam files (t51-*seam*) | 10 | 416 (8%) | 503 (8%) | 507 (7%) | 446 (8%) |
| r9-seam* files | 1 | 17 (0%) | 26 (0%) | 25 (0%) | 20 (0%) |
| walk-* and walk10b-* files | 15 | 314 (6%) | 425 (7%) | 475 (7%) | 373 (7%) |
| other control-plane t51-* (bootstrap, held-failed, hops, large-pdfs, reading-follows) | 5 | 388 (8%) | 417 (6%) | 427 (6%) | 409 (7%) |
| other control-plane files | 16 | 338 (7%) | 442 (7%) | 485 (7%) | 405 (7%) |
| m/plane/* (incl. L load tests) | 55 | 1378 (27%) | 1869 (29%) | 2097 (31%) | 1670 (30%) |
| other *seam* files (screens-*) | 8 | 198 (4%) | 246 (4%) | 280 (4%) | 221 (4%) |
| agent-worker/* | 4 | 299 (6%) | 367 (6%) | 446 (7%) | 353 (6%) |
| everything else | 31 | 972 (19%) | 1298 (20%) | 1475 (22%) | 1195 (22%) |
| total (sum of top-level test times) | | 5068 | 6491 | 6783 | 5520 |

Inside the groups ARCH named:

- **Control-plane seam files** (10 files, `bp/m/control-plane/t51-*seam*`): the round 5 to 8 files take 44 to 100 s each (round 6: 77 to 100 s, round 7: 72 to 90 s, round 8: 82 to 97 s, round 5: 49 to 54 s, round 5 press: 44 to 56 s). The five round-10 files take 14 to 34 s each.
- **r9-seam**: the `r9-seam-*.mjs` helpers in `bp/m/control-plane/` are imported only by `t51-round9-seam.test.mjs` and `r131-gate.test.mjs`, **and neither file is in plane's 147**. The one file in plane's run with that name is `bp/m/screens-inquiry/r9-seam.test.mjs`, 17 to 26 s.
- **walk files** (15): 12 to 33 s each, with `walk10b-recreate` at 40 to 58 s. Each is one or two tests over one booted plane, so most of a walk file's time is its own boot and its one walk.
- **Other t51 files** (5): `t51-reading-follows` alone is 278 to 286 s in every run, almost all in one test (R123 F1: a 3 MB PDF left unfiled until the alarm gives up on it, then filed, 253 s in run 45153717371). That test's time is set by the alarm's own give-up schedule, not by load: it is the same in all four runs.
- `bp/m/plane/*` (55 files) is the largest group by far, at 27 to 31 %. Its big files are the L-load tests (g83-location, corpus-r, l75, r8-headofline, r8-heal-door, g55-alarm-l, g128i-over-24mib, l77-*, l79), each 50 to 200 s.

## What dominates, and why

1. **The run is mostly throughput-bound now.** With migrate-released down to 222 s (run 45227944385), the files add up to 5520 s over 3 slots: at best 1840 s; the run took 2002 s. Nothing but more parallel slots, or less work per file, takes much more off. In run 45153717371 (migrate-released 641 s) the run took 2144 s against a best case of 1689 s, so about 455 s was the tail (next point).
2. **migrate-released was the tail.** It is file 144 of 147 in the order Node starts them, so it starts when nearly everything else is done, and the run cannot end before it does. At e4b4f59 it took 641 s; with its stores booted in four child processes (53bff0d) still 614 s; with the plane bundle built once and booted from that bundle (89caa76) 294 s; at 821c1cf 222 s. What it boots, at 821c1cf: one fresh reference store, then 34 committed stores (29 releases from 0.58.0 on, plus 5 "born on 0.58.0, through a withdrawn release, back" paths), **each booted twice** (the second boot must be clean). That is **69 Miniflare/workerd boots in one file**, 617 checks.
3. **migrate-released's own child processes overload the runner.** Node already runs 3 files at once on 4 CPUs; migrate-released's up-to-4 child processes (53bff0d onward) put 6 heavy processes on 4 CPUs for its last minutes. The failures in 45208833265, 45219676935 (`r46-memory`, a memory peak 85.4 % and 89.4 % of its cap, limit 85 %) and 45227944385 (`r8-wave`, a timing bound) are load-sensitive tests running beside it. The current head (f0a8c9a) cuts it to two at a time for that reason; its run 45236029125 was still in progress.
4. **Almost every file boots workerd, and nothing shares a boot across files.** 102 of the 147 files contain a Miniflare boot call (`new Miniflare`, the control-plane kit's `makeKit`, or the shells' `boot`), 158 call sites in all, not counting helpers called more than once. Each file is its own Node process, so a boot cannot be shared between files under the current runner. Inside a file, most boot once in module scope and close in `after`; some boot more than once (tier2-wire: 5 boots; t51-round8-seam: 2, one with a counting wrapper; migrate-released: 69).
5. **Most boots load the plane's unbundled source.** The control-plane kit (`r8-kit.mjs`), the seam files and the walk files hand Miniflare `scriptPath: src/index.mjs` with an `ESModule` rule for `**/*.mjs`, so workerd loads the plane's source tree module by module on each boot. migrate-released's commit 89caa76 measured a boot from the built bundle at about half the time of a boot from source.
6. **Some files build a bundle when they start.** tier2-wire builds the pdf-worker bundle (`pdf-worker/test/subject.mjs` runs `buildMember` on import); d606-perpage-ocr builds the ocr-worker bundle (`ocr-worker/test/memberworker.mjs`); migrate-released builds the plane bundle once (`buildCurrent`); `agent-worker/test/requirements.test.mjs`, `bp/m/plane/t47`, `t48` and `worker.test.mjs` also call the bundler. Each is a separate process, so a bundle built by one is not reused by another.
7. **Fixed waits.** Several of the slowest tests wait on the plane's own clocks (alarm give-up, alarm slices, a 10 s watchdog, 4 s traffic gaps, five runs of a measurement): t51-reading-follows (about 280 s), g55-alarm-l, l79, l77-traffic, r8-headofline, r10-lag-figure. These do not get faster with more CPU.
8. **Load swings every file.** The same files are 30 to 50 % slower in 45219676935 than in 45153717371 (g83-location 132 vs 202 s, corpus-r 112 vs 191 s, harness 177 vs 262 s). Runner speed varies run to run by enough to cross the limit, as 45172042267 did.

Could boots be shared? Within one file, yes, where a file boots more than once with the same settings (migrate-released already reuses one built bundle; its two boots per store are what it tests). Across files, only by putting files in one process (several files' tests in one suite file, or `--test-isolation=none`), which changes what each file can assume about global state. Booting from the built bundle rather than from source, which migrate-released now does, is the change that applies to all 102 booting files without merging any.

## Other modules

Of the 40 most recent completed module-tests runs (to 18:25 UTC on 23 Nov), every module but plane took 3.8 minutes or less, except one store-assembly run (45172735399, 8.0 min). doc-clean, office-readers, journey-check, case-checker, promotion, op-grades and control-plane all finished in 1.6 to 3.8 min. Only plane is near the 45-minute limit.

## Facts not found

- Per-file start and end times: unknown. The tool buffers the output, and the spec reporter prints no start times, so which files overlapped is inferred, not read.
- The true per-file time of `node:test` files, including start-up, imports and hooks: unknown; the figures above leave those out.
- What ran slowly in the runs that hit the 45-minute limit (45172042267, and by its times 45179857787): unknown; such a run prints nothing.
- The outcome and times of the running run 45236029125 (migrate-released two at a time): unknown when this was written.
- The time of a single workerd boot from source and from the bundle, measured on the runner: unknown here; only commit 89caa76's message claims "half a boot's time".
- The exact CPU count was not printed in any log read; 4 vCPUs is GitHub's documented size for `ubuntu-latest` on a public repository, and the observed 2.4 to 2.8 files at once fits a ceiling of 3.
