Length: 89 lines. Last section: "What I did not check".

# 20. The two trials on a quiet machine, and the two together

Research worker for plane-scope lane #1, 24 Nov 2026. Base: commit `a26a8da2`. Tags follow `evidence-rules.md`. The door trial is `trial-door/diff.patch` (research 15); the capture trial is `trial-capture/alt1.patch` (research 16, Alternative 1). Raw numbers: `trial-combined/results.json`. No combined patch was written, because no join was made (section 1).

## Headlines

1. **Do the two patches apply together cleanly? No.** Each applies cleanly to `a26a8da2` alone. Together they conflict in one file, `bio-plane/src/control-plane/index.mjs`, in two places. As the brief says, I stopped the combined copy there. [MEASURED, section 1]
2. **plane's l79 restart test on a quiet machine: 0 failures in 30 runs.** Base, door and capture each passed it 5 of 5 times with the whole `l79.test.mjs` file run alone, and 5 of 5 times with the restart test run alone by name. The 1-minute load before each run was 0.61 to 1.85. Inside the file, the restart test's time had medians of 18.2 s (base), 18.5 s (door) and 18.0 s (capture). [MEASURED, section 2]
3. **Step 3, the trials' own proofs on the combined copy, was not run**, because there was no combined copy. [section 3]

## Set-up

- Scratch worktrees `base`, `door`, `capture` and `combined` under `/tmp/claude-0/-home-user-civicsmith-copy/8256d861-74f6-5895-95c0-442c98a7b047/scratchpad/`, made with `git worktree add --detach <dir> a26a8da2`. In each, `node_modules` was symlinked from the main checkout for `agent-runner`, `bio-plane`, `file-scanner`, `newgroup`, `ocr-worker`, `pdf-worker` and `sheet-worker`, as research 15 did. All four were removed with `git worktree remove --force` (`combined` as soon as it was stopped). Scripts and raw outputs are in `…/scratchpad/w20/`, which can be cleared.
- `git apply` of `diff.patch` in `door` and of `alt1.patch` in `capture`: both with no error. `git -C door status --short` listed 25 entries, and `base` listed 0, so the links are ignored. [MEASURED]
- Machine: 4 vCPU Intel Xeon 2.10 GHz, Node v26.10.0 [MEASURED: `nproc`, `/proc/cpuinfo`, `node --version`]. Before the first run the load was `0.60 0.57 0.26`, and `ps aux --sort=-%cpu` showed no test or workerd process [MEASURED]. I ran nothing in parallel with the test runs. During my runs another session moved the main checkout to the branch `work/plane-scope-stage3` (`git worktree list` at the end showed `ef8cab860e`). It did not touch my worktrees, and the load stayed at or below 1.85 [MEASURED].

## 1. Applying both patches together

[MEASURED] In `combined`, after `git apply …/trial-door/diff.patch` (no error), `git apply …/trial-capture/alt1.patch` printed:

```
error: patch failed: bio-plane/src/control-plane/index.mjs:35
error: bio-plane/src/control-plane/index.mjs: patch does not apply
```

and applied nothing. In the other order (capture first, which applied cleanly), `git apply --check -v` of the door patch failed on the same file at `:35`. `git apply -3` of the capture patch over the staged door patch printed `Applied patch to 'bio-plane/src/control-plane/index.mjs' with conflicts.` and applied `screens-intake/capture.mjs` and `process/modules/screens-capture.json` cleanly. The two conflict regions (`git diff` saved in `results.json`, `combine.conflict_diff`):

| place in `cp/index.mjs` (after the door patch) | door patch ("ours") | capture patch ("theirs") |
|---|---|---|
| lines 38 to 44, the R124 import | removes `import { CAPTURE_SCREEN } …` and imports nothing; its comment says the builder is "handed" in | replaces it with `import { titleOf, promoteDocument } from "../capture/filing.mjs";` |
| lines 793 to 799, in `deliverOwedRender` | `composer.titleOf(…)`, `composer.promoteDocument(…)` (the second argument) | `titleOf(…)`, `promoteDocument(…)` (the imported functions) |

The conflict is in substance as well as in text. Each patch removes the door's import of the screen in a different way: the door patch hands the composer in, and the capture patch imports it from below. Making one combined copy needs a choice between them. I did not make one, and I did not write `combined.patch`.

INFERENCE from the two hunks and from 15's description of `pl/ui.mjs` (it builds `DOCUMENT_COMPOSER` from the screen): one join would keep the door patch's `cp/index.mjs` whole, drop the capture patch's hunk to that file, and apply the rest of the capture patch. That would leave the capture patch's change to the door with no effect. A test of that join would settle whether it works. It was not tried.

## 2. plane's l79 restart test, quiet, on each copy

The command, from the tree's top, ran one at a time with nothing else running. Runs were interleaved base, door, capture in each round, so all three trees ran under the same conditions:

`env -u GH_TOKEN -u GITHUB_TOKEN -u ACTIONS_RUNTIME_TOKEN -u ACTIONS_ID_TOKEN_REQUEST_TOKEN -u NODE_TEST_CONTEXT node --import ./bio-plane/test/platform-sqlite.mjs --test --test-reporter=spec --test-reporter=junit bio-plane/test/m/plane/l79.test.mjs`

This is `process.json`'s `test_command` with the same variables removed as `tool/lib/util.mjs:22` `NO_TOKENS` plus `NODE_TEST_CONTEXT`, and with reporter flags added, as in research 15. The second kind of run added `--test-name-pattern="a restart over the same storage"`. `/proc/loadavg` was read before and after every run. The restart test is `l79.test.mjs:69`. Its file's Worker is `l79-entry.mjs`, which imports `src/plane/store.mjs` (`l79-entry.mjs:5` [READ]). The door patch changes that file. The capture patch changes `cp/index.mjs`, which that file imports.

**(a) The whole file alone** (5 tests; the restart test's time is from the junit report) [MEASURED]:

| copy | file result, 5 runs | restart test | restart test seconds (min / median / max) | wall seconds per run | 1-min load before each run |
|---|---|---|---|---|---|
| base | 5/0 ×5 | 5 pass, 0 fail | 17.49 / 18.16 / 19.05 | 56.90, 56.45, 57.23, 56.88, 57.52 | 0.84, 0.86, 0.90, 0.76, 0.78 |
| door | 5/0 ×5 | 5 pass, 0 fail | 17.87 / 18.46 / 18.63 | 57.93, 57.56, 57.10, 57.33, 57.45 | 1.00, 0.77, 1.02, 0.83, 0.64 |
| capture | 5/0 ×5 | 5 pass, 0 fail | 17.64 / 17.98 / 18.10 | 57.48, 57.80, 56.70, 57.00, 57.38 | 1.20, 0.79, 0.98, 0.61, 0.84 |

A trial run on base before these runs (run 0, load 0.42) also passed 5/0, with the restart test at 17.66 s. It is kept in `results.json` and left out of the table.

**(b) The restart test alone, by name** (1 test) [MEASURED]:

| copy | result, 5 runs | restart test seconds (min / median / max) | 1-min load before each run |
|---|---|---|---|
| base | 5 pass, 0 fail | 33.53 / 38.35 / 39.38 | 0.66, 1.45, 1.85, 1.49, 1.55 |
| door | 5 pass, 0 fail | 37.53 / 38.65 / 39.52 | 1.18, 1.30, 1.43, 1.30, 1.69 |
| capture | 5 pass, 0 fail | 38.65 / 38.89 / 39.08 | 1.20, 1.40, 1.46, 1.40, 1.47 |

The load averages include the previous run's own workerd work, since runs followed each other directly.

- The test's own limit is 90 s (`l79.test.mjs:32` `until = async (fn, ms = 90_000)` [READ]). The longest time measured here was 39.5 s.
- The restart test took about twice as long alone (median 38 to 39 s) as it did inside the file (18 to 18.5 s), on all three copies. I did not trace why.
- Research 15 recorded the restart test failing (`timed out`) in 2 of the door tree's 3 set runs at loads of 9 to 16, and passing alone and in the same-time run. Here, at loads at or below 1.85, it passed 10 of 10 times on the door copy and 10 of 10 on each other copy, with medians within 0.5 s of each other. [MEASURED] INFERENCE from these runs and research 15's: on a quiet machine the change does not make this test fail. This does not show whether the change makes it more likely to fail under load. Repeated runs of set b at a controlled high load on both trees would settle that.

## 3. The trials' own proofs on the combined copy

Not run: there was no combined copy (section 1). These are what research 15 and 16 recorded, which a combined run would have been compared against:

- Research 15: control-plane's 95 files 564/564/0 after its test fixes. Bundle 28,419,491 bytes, 855 inputs. 15 requests served with the same bytes under workerd as the base. A UI-less build of 25,141,248 bytes, 724 inputs. `p4 check`: product, interface-shell, screens-intake and screens-action "no disagreement found"; control-plane 52 and plane 159 disagreements in pass 2.
- Research 16: page script 5,270,912 bytes, sha256 `54986cba…749b`, unchanged. 24 of 24 delivered packages the same as the baseline. 151 of 159 tests in the 13 files that reach the delivery, 375/375 screens-intake, 321/321 interface-shell.

## After a change

Not run. If the lane wants both trials in one tree, it must first choose how the door gets the document composer: handed in (door patch) or imported from `capture/filing.mjs` (capture patch). Section 1 gives one possible join as an inference.

## What I did not check

- **Everything in step 3**: control-plane's tests, the bundle build and byte comparison of the served answers and page script, the UI-less build, and `p4 check`, on any combined copy. A chosen join, applied and run as research 15 and 16 ran them, would settle it.
- **Set b (plane's 27 composition-root files) and `r8-timing-hook`'s age test on a quiet machine.** Only `l79.test.mjs` was run, as the brief asks. Research 15's failure was inside set runs, so this report clears the restart test on a quiet machine, not under the load in which it failed.
- **Under load.** No run here was made at research 15's loads of 9 to 16.
- **Why the restart test takes about 38 s alone and about 18 s inside its file.**
- **The new file `capture/filing.mjs` in the three-way attempt.** The output did not name it, and I did not look at it before removing the tree.
- **Other tests on the door and capture copies.** Only l79 was run on them.
