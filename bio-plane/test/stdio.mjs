/* A SUITE'S OWN EXIT MUST NOT DISCARD THE SUITE'S OWN OUTPUT.
 *
 * Imported for its SIDE EFFECT, not its exports, the way `sandbox.mjs` is, and
 * for the same reason: `process.exit()` on the last line of every suite is a
 * hazard that no suite can see from inside itself.
 *
 * ---- D-282, AND WHAT WAS ACTUALLY MEASURED -----------------------------------
 *
 * The suites of the time ended `process.exit(fail ? 1 : 0)`, so a lingering
 * workerd handle could never turn a green run into a hang (the old
 * `hygiene.test.mjs` required it; it was deleted at T20, and no test enforces
 * that ending now; many suites, and pdf-worker's `runner()`, still end so). The
 * old runner, `scripts/battery.mjs` (deleted at T20), spawned every suite with
 * default stdio, which is a PIPE; `node --test` today also runs each test file
 * as a child and reads its output through a pipe. On darwin, node's writes to a pipe are ASYNCHRONOUS (node's own
 * documentation: pipes are synchronous on Linux and Windows, ASYNCHRONOUS on
 * macOS; files and POSIX TTYs are synchronous). So a suite that writes more than
 * the kernel pipe buffer can absorb leaves bytes QUEUED IN THE PROCESS, and
 * `process.exit` returns to the OS without them. The tail is discarded, and the
 * TALLY — `name: N pass, M fail`, the one line the old runner read a count from,
 * and still what a suite run directly by its package's `npm test` prints —
 * is the last thing a suite prints. D-93 exists precisely because a suite that
 * reports no tally reads as a suite that was never run.
 *
 * MEASURED 2026-08-10 on darwin 25.5.0 / node v26.5.0, one child, two captures of
 * the SAME run, and every figure below is from `MEASUREMENTS.md`:
 *
 *   - 200,093 bytes reached a FILE; 131,099 reached a PIPE; tally MISSING.
 *   - THE THRESHOLD, WHICH D-282's ROW NAMED UNDETERMINED, BISECTS AT THE PIPE
 *     BUFFER: a single write of 65,573 bytes survives and 65,580 does not, and
 *     every partial arrival observed is an exact multiple of 65,536 (64 KiB).
 *   - IT IS NOT ONLY THE BIGGEST LINE. At 2,000,000 bytes total the tally is lost
 *     at EVERY chunk size tried, down to 1,024-byte writes.
 *   - IT IS NONDETERMINISTIC. Three identical runs at 1,024-byte chunks: MISSING,
 *     MISSING, PRESENT. The child's writes race the parent's draining, so the
 *     same failing suite may or may not report its own count run to run.
 *   - IT IS NOT `maxBuffer`. D-282 tested 64 MB and it changed nothing, because
 *     the bytes were never written. That hypothesis is dead; do not re-run it.
 *
 * ---- WHY THIS FIX AND NOT THE OTHER ONE --------------------------------------
 *
 * D-282's row offered two: cap `t()`'s `got` dump the way D-237 already caps its
 * LABEL, or have suites flush before exiting. The cap was measured and rejected,
 * on four grounds rather than on taste:
 *
 *  1. IT MOVES THE THRESHOLD, IT DOES NOT REMOVE IT. With every line already
 *     capped at 512 bytes, the tally still went missing 1 run in 5 at ~1,563
 *     capped failures and stayed lost at 3,125 and 6,250. The cap bounds ONE
 *     LINE; the loss is a function of what is still queued at exit.
 *  2. IT LEAVES THE RACE. A fix that is right most of the time in the instrument
 *     every other item is judged by is not a fix.
 *  3. IT DEFENDS ONE WRITER. `t()` is copy-pasted into every suite, so the cap is
 *     150-odd edits that still say nothing about a stack trace, a probe printing
 *     a corpus, or any `console.log` that is not `t()`.
 *  4. IT IS THE OPPOSITE DEFECT ONE STEP AWAY. A cap TRUNCATES the diagnosis by
 *     construction. With this fix the whole dump ARRIVES — 2,097,176 bytes
 *     through a pipe, byte-identical to the same child's file capture — so a
 *     large-but-readable failure is delivered whole. Readability of a 146,820-
 *     character line is a real but SEPARATE question, and it is a smaller one
 *     than loss; capping is deliberately NOT done here and is named in D-282's
 *     closure rather than smuggled in beside the fix.
 *
 * THE READER SIDE WAS ALSO REJECTED, AND ON A COUNT. Handing children a file
 * descriptor instead of a pipe would have fixed the old runner in one line — but three
 * scripts and some sixty control and probe harnesses in this estate spawn a child
 * and read its stdout, a new one is written for nearly every debt item, and
 * D-282 WAS FOUND BY A CONTROL ARM RATHER THAN BY THE BATTERY. Fixing readers
 * leaves the discovery path open for every reader anyone writes next. The writer
 * is the thing every reader shares.
 *
 * ---- THE MECHANISM, AND ITS ONE HONEST WEAKNESS ------------------------------
 *
 * `uv_stream_set_blocking` is what node itself uses to make a stdio stream
 * synchronous, and it is reached through `_handle.setBlocking`, which is PRIVATE.
 * That is stated rather than hidden: a node release could remove it and this
 * module would silently stop working. It is not left to trust — the module's own
 * tests of R6 and R8 (`test/m/test-support/test-support.test.mjs`) drive a
 * deliberately flooding child through a real pipe and assert every byte and the
 * tally arrive, so the day the private door closes those tests go red instead of
 * going quiet. `synchronousStdio()` also reports
 * what it managed, so a caller can assert on it rather than assume.
 *
 * A blocking write can BLOCK if a reader stops reading, where a non-blocking one
 * would drop. That is the trade and it is taken deliberately: a run that stalls
 * is visible and a count that is quietly wrong is not, and this is the behaviour
 * node already has on Linux, where this defect cannot occur at all. It is also
 * why the same defect would never have been seen on a Linux CI machine, which is
 * part of why nobody caught it for as long as nobody did.
 */

const applied = [];

/* Idempotent: importing this module twice, or importing it and `sandbox.mjs`
   (which imports it), must not double-apply or throw. */
let done = false;

export const synchronousStdio = () => {
  if (done) return { streams: applied.slice(), already: true };
  done = true;
  for (const [name, s] of [["stdout", process.stdout], ["stderr", process.stderr]]) {
    /* A stream with no `_handle` is not a pipe we can change — a file-backed
       stdio is ALREADY synchronous on POSIX, and a destroyed or absent stream
       has nothing to set. Both are fine and neither is an error. */
    try {
      if (s && s._handle && typeof s._handle.setBlocking === "function") {
        s._handle.setBlocking(true);
        applied.push(name);
      }
    } catch { /* a stream we cannot change is one this module says nothing about */ }
  }
  return { streams: applied.slice(), already: false };
};

synchronousStdio();
