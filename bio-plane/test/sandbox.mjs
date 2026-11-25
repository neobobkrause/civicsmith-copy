/* The suite's own temp sandbox — imported for its SIDE EFFECT, not its exports.
 *
 * D-186: the battery leaked 23,263 `miniflare-*` directories holding 41.0 GB
 * into the machine's `$TMPDIR` and filled the disk to zero, at which point
 * every command failed before it started and nothing could be committed or
 * pushed. The cost was never the disk.
 *
 * THE MECHANISM, MEASURED 2026-08-04 rather than assumed, because the obvious
 * reading is wrong in an instructive way. `Miniflare#dispose()`
 * (miniflare 4.20260722.0, `dist/src/index.js:104655`) does two things in this
 * order:
 *
 *     this.#removeExitHook?.();                              // disarm
 *     removeDir(this.#tmpPath, { fireAndForget: true });     // and do not wait
 *
 * The exit hook is miniflare's own `process.on("exit")` handler, and it removes
 * the sandbox SYNCHRONOUSLY. `dispose()` unregisters it and then starts the
 * removal without awaiting it. The suites of the time ended
 * `await mf.dispose(); process.exit(fail ? 1 : 0)`, so a lingering handle could
 * never turn a green run into a hang (the old `hygiene.test.mjs` required it; it
 * was deleted at T20, and no test enforces that ending now), and
 * `process.exit()` on the next line kills the process before the unawaited
 * removal lands, with the safety net already taken down. Any suite that still
 * ends that way has the same race, which is why this module stays.
 *
 * So the leak is on the SUCCESS path, which inverts the intuition this fix was
 * commissioned on: a suite that THROWS mid-run cleans up perfectly, because it
 * never reaches `dispose()` and miniflare's exit hook is still armed. Probed
 * three ways, three runs each: `dispose()`+`process.exit()` leaked 3 of 3;
 * throwing without disposing leaked 0 of 3; `dispose()` plus a 250 ms settle
 * leaked 0 of 3. A `finally` around the suite body would therefore have fixed
 * NOTHING, and sleeping to let the race resolve is not a mechanism.
 *
 * THE FIX IS TO OWN THE GROUND INSTEAD OF CHASING THE RACE. `os.tmpdir()` reads
 * `$TMPDIR` on every call, so this module makes one directory, points the whole
 * process at it, and removes it synchronously when the process exits. Miniflare
 * still picks its own random name and still fails to finish removing it — but
 * it now does that INSIDE a directory we delete outright, and `rmSync` in an
 * `exit` listener cannot be outrun because `process.exit()` runs `exit`
 * listeners to completion before it returns to the OS.
 *
 * It covers the suites that mint their own sandboxes for free, for the same
 * reason: `ratify-`, `sshsig-`, `signpage-`, `attest-`, `reuse-ratify-`,
 * `publish-`, `publishedcase-` and `reeval-` all `mkdtempSync(join(tmpdir(),…))`
 * and so land inside the owned directory too. Nothing else changes for a suite;
 * the import is the whole contract. Every suite that builds a Miniflare or
 * mkdtemps should import it. The old `hygiene.test.mjs` required that of every
 * suite; it was deleted at T20, and no test enforces the rule now.
 *
 * WHO RUNS THE SUITES NOW: `node --test` (bio-plane's `npm test` runs
 * `test/m/**`), each package's own `npm test`, and the `regression` workflow,
 * which runs every package's `npm test` and the kept suites under `node --test`.
 * The old runner, `scripts/battery.mjs`, was deleted at T20.
 *
 * WHAT THIS DOES NOT COVER: a process killed with SIGKILL runs no handler at
 * all, and its directory stays. Its name carries the pid, so whoever cleans the
 * host's temp directory can tell a dead owner's directory from a live one. The
 * old runner swept such orphans; nothing sweeps them now.
 *
 * A probe (`*.probe.mjs`, `*-probe.mjs`) is run by hand, never by a test
 * command, and imports this module or not as it needs. One that keeps a
 * deliberately PERSISTENT cache in `$TMPDIR` must not import it, because this
 * module would delete the cache (as the since-deleted
 * `tier1-coverage-probe.mjs`'s PDF cache would have been).
 *
 * D-282, 2026-08-10: THIS MODULE NOW TAKES A SECOND SIDE EFFECT, and it is stated
 * here rather than left to be discovered. `./stdio.mjs` makes stdout and stderr
 * synchronous, so the `process.exit()` on the last line of every suite — the same
 * line this module's whole header is about — cannot discard the suite's own tally
 * when a reader hands it a pipe. It is imported here as well as by every suite so
 * that the CONTROL and PROBE harnesses which already take this module's side
 * effect take that one too; D-282 was found by a control arm, not by the old
 * battery runner.
 */
import "./stdio.mjs";
import { chmodSync, existsSync, lstatSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Read the host's temp directory BEFORE redirecting, so a suite spawned by a
   process that has already redirected (a test, or a runner that imports this
   module) still nests rather than escaping. */
const HOST_TMP = tmpdir();

/* The pid is in the NAME because it is the only thing a surviving directory can
   tell a later cleanup about its owner: a directory whose pid is gone is garbage,
   and one whose pid is alive may be a concurrent test run in flight.
   Deleting that second kind is the failure this whole item exists to avoid — a
   live sandbox WAS in flight during the manual cleanup that found D-186, and
   removing it would have broken a verification in progress. */
export const SANDBOX = mkdtempSync(join(HOST_TMP, `bio-battery-${process.pid}-`));

/* os.tmpdir() consults $TMPDIR on every call and caches nothing, so this
   redirects miniflare, the suites' own mkdtemps, and anything else in the
   process that asks the platform where to put temporary files. */
process.env.TMPDIR = SANDBOX;

let swept = false;
export const sweepSandbox = () => {
  if (swept) return;
  swept = true;
  /* Synchronous on purpose. The whole defect is an asynchronous removal losing
     a race with process exit; an async sweep here would reproduce it.

     2026-09-23, GitHub run 35815539592 (282/282 green, RED on "LEAKING 2 miniflare
     sandbox(es) in 1 director(ies): bio-battery-3964-eIXKeF"): THE SENTENCE ABOVE
     WAS HALF TRUE. This sweep is synchronous, but the removal it races is not
     gone: `Miniflare#dispose()` has already STARTED `fs.promises.rm` on its
     `miniflare-*` directory, and its queued unlinks keep running on libuv's
     threadpool while this listener blocks the main thread. When one of them
     deletes an entry under `rmSync`'s walk, `rmSync` RETURNS NORMALLY WITH THE TREE
     STILL THERE — no throw, so the catch below never saw it. MEASURED on node
     26.10.0: the old single `rmSync`, driven by a child that imports this module,
     builds two miniflare-shaped trees, fires dispose()'s exact `rm` on each and
     exits, left 21 directories holding 35 sandboxes in 300 endings, the leaked
     shape exactly the runner's (`bio-battery-<pid>-*: [miniflare-…, miniflare-…]`).
     THE FIX TAKES THE TREE OUT FROM UNDER THE RACE instead of out-running it: a
     `rename` is atomic, every queued removal addresses the OLD path and fails
     ENOENT harmlessly, and at most the few syscalls already inside the kernel can
     still touch the moved tree — so the removal is repeated until the tree is
     verified GONE, never read as gone from the absence of a throw. The moved name
     keeps the `bio-battery-<pid>-` prefix, so a cleanup can still attribute it
     to its owner if even this fails. Same driver, this sweep: 0 of 300. */
  let target = SANDBOX;
  try { renameSync(SANDBOX, `${SANDBOX}-swept`); target = `${SANDBOX}-swept`; } catch { /* gone already, or unmovable: sweep in place */ }
  for (let i = 0; i < 5 && existsSync(target); i++) {
    try { rmSync(target, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {
      /* N22: a test that left a directory read-only makes its entries
         unremovable to a process that is not root (root's override hides
         this). The tree is ours, so it is made writable and the next pass
         retries; any other refusal goes to the next pass as before. */
      if (e?.code === "EACCES") makeWritable(target);
    }
  }
};

/* Gives the owner full access to every directory in the tree, parents before
   children so a directory with no access at all can then be listed. lstat, so
   a link is never followed: nothing outside the tree changes mode (R9). Files
   are left alone; removing one needs only its directory writable. */
const makeWritable = (dir) => {
  let st;
  try { st = lstatSync(dir); } catch { return; }
  if (!st.isDirectory()) return;
  try { chmodSync(dir, (st.mode & 0o7777) | 0o700); } catch { /* not ours to change; the next pass tries regardless */ }
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) makeWritable(join(dir, n));
};

process.on("exit", sweepSandbox);

/* A signal kills the process WITHOUT running `exit` listeners unless something
   is listening for the signal itself, so these are not redundant with the line
   above. Miniflare installs its own SIGINT/SIGTERM handlers, but only while an
   instance is undisposed, and half the suites here outlive their instances. */
for (const [sig, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]) {
  process.on(sig, () => { sweepSandbox(); process.exit(code); });
}
