/* Measuring what a capture actually costs in compute, and finding out where the
 * runtime cuts it off.
 *
 * The subrequest ceiling was found by being refused: the runtime throws a
 * distinguishable error, the code catches it, records the count, and stops on
 * its own terms next time. CPU is not like that. Exceeding the CPU limit
 * TERMINATES THE ISOLATE. There is no catch block, no chance to write a record,
 * and nothing for the next invocation to read. The caller sees an opaque error.
 *
 * So "determine and record limits empirically" has to mean two different things
 * for CPU, and both are here.
 *
 * 1. CONSUMPTION is measured continuously, in every real capture, and recorded.
 *    That is the useful number: knowing a capture spends 6ms against a 10ms
 *    ceiling tells you the headroom before anything breaks, which is strictly
 *    better than learning the ceiling by being killed at it.
 *
 * 2. The CEILING is found by a deliberate stepped probe that checkpoints after
 *    every step. When the isolate is killed, the checkpoint from the last
 *    completed step survives, and the NEXT probe reads it and knows the ceiling
 *    lies between that step and the one after. It converges without any single
 *    invocation ever having to report its own death.
 *
 * MEASURED 2026-07-29 and it changed this file. The first version timed
 * synchronous segments with Date.now() and reported ZERO for every segment of
 * every capture. Cloudflare freezes the clock during synchronous execution as a
 * timing-attack defence, so a Worker cannot time its own compute at all. The
 * clock advances only at I/O boundaries, which is why the stepped probe below
 * DOES produce rising numbers: each step is followed by a durable checkpoint,
 * and that write is the I/O that lets the clock move.
 *
 * So consumption is counted in WORK (bytes hashed, references parsed, entries
 * serialised) and the ceiling is measured in REFERENCE ITERATIONS. Neither is a
 * millisecond, and that is honest rather than a limitation: a millisecond
 * reported from inside a Worker would be a fabrication.
 *
 * The first live probe, on Workers Free, completed 20 steps of 2,000,000
 * iterations, 40,000,000 in total, before the isolate was killed during step 21.
 * The documented free-plan figure is 10ms of CPU per invocation, and 40 million
 * modular multiplications is not 10ms of anything. Whatever is enforced here is
 * not the documented number, which is the entire argument for measuring.
 */

/** A meter that counts WORK, because time cannot be measured here.
 *
 *  The first version of this timed synchronous segments with Date.now() and
 *  reported zero for every segment of every capture, on every real page. That is
 *  not a bug in the meter. Cloudflare FREEZES THE CLOCK during synchronous
 *  execution as a timing-attack defence: Date.now() returns the same value
 *  throughout a block of compute and only advances at an I/O boundary. Nothing
 *  running inside a Worker can time its own compute, and any design that
 *  depends on doing so is dead on arrival.
 *
 *  What CAN be measured is the work itself, and the work is what drives the
 *  cost: bytes hashed, references parsed, entries serialised. Those are exact,
 *  they are comparable between runs and between instances, and they are the
 *  numbers that would explain a kill after the fact. So this counts calls and
 *  bytes per segment and reports no times at all rather than reporting zeros
 *  that look like measurements.
 *
 *  The CEILING is found in the same currency by cpuProbe below: reference
 *  iterations, not milliseconds. */
/**
 * @typedef {Object} Segment one label's counts
 * @property {number} calls
 * @property {number} bytes
 */
/**
 * @typedef {Object} MeterReport
 * @property {number} work_calls
 * @property {number} work_bytes
 * @property {{ [label: string]: Segment }} segments
 * @property {null} measured_ms
 * @property {string} note
 */
/**
 * @typedef {Object} Meter
 * @property {<T>(label: string, fn: () => T, bytes?: unknown) => T} sync
 * @property {<T>(label: string, fn: () => T | Promise<T>, bytes?: unknown) => Promise<T>} cpuAwait
 * @property {() => MeterReport} report
 */

/**
 * @returns {Meter}
 */
export function makeMeter() {
  /* each label's counts, in the order of first use */
  const seg = new Map(/** @type {[string, Segment][]} */ ([]));
  /**
   * @param {string} label
   * @param {unknown} bytes counted only when a finite number
   */
  const bump = (label, bytes) => {
    const had = seg.get(label);
    const e = had ?? { calls: 0, bytes: 0 };
    if (!had) seg.set(label, e);
    e.calls++;
    if (typeof bytes === "number" && Number.isFinite(bytes)) e.bytes += bytes;
  };
  return {
    /** Run a synchronous block, counting it. `bytes` is the size of what it
     *  worked on, when that is known and meaningful.
     *  @template T
     *  @param {string} label
     *  @param {() => T} fn
     *  @param {unknown} [bytes] counted only when a finite number
     *  @returns {T} */
    sync(label, fn, bytes) { bump(label, bytes); return fn(); },
    /** Same, for an await that is compute rather than I/O: a crypto digest is
     *  async in the Workers API and is not a network wait.
     *  @template T
     *  @param {string} label
     *  @param {() => T | Promise<T>} fn
     *  @param {unknown} [bytes] counted only when a finite number
     *  @returns {Promise<T>} */
    async cpuAwait(label, fn, bytes) { bump(label, bytes); return await fn(); },
    report() {
      // A copy down to each segment, so a report is a fixed reading: later calls on the meter
      // do not change it, and changing it does not change the meter.
      // Each label is an own data property, `__proto__` and `constructor` among them.
      /** @type {{ [label: string]: Segment }} */
      const segments = {};
      for (const [k, e] of seg) {
        Object.defineProperty(segments, k, { value: { calls: e.calls, bytes: e.bytes }, writable: true, enumerable: true, configurable: true });
      }
      const calls = Object.values(segments).reduce((a, e) => a + e.calls, 0);
      const bytes = Object.values(segments).reduce((a, e) => a + e.bytes, 0);
      return { work_calls: calls, work_bytes: bytes, segments,
        measured_ms: null,
        note: "COUNTS, not times. Cloudflare freezes Date.now() during synchronous execution as a "
            + "timing-attack defence, so a Worker cannot measure its own compute and any millisecond "
            + "figure reported from inside one is meaningless. These are the quantities that DRIVE "
            + "the cost and that would explain a kill afterwards. The ceiling is measured separately, "
            + "in reference iterations, by op=cpuprobe." };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Finding the ceiling
 * ------------------------------------------------------------------ */

/** Busy-work with no allocation growth and no optimiser escape, so a step costs
 *  roughly the same every time. Deliberately not crypto: a digest's cost depends
 *  on input size and platform acceleration, which makes steps incomparable.
 *  @param {unknown} iterations anything but a number is no work
 *  @returns {number} */
export function burn(iterations) {
  // Anything but a number is no work: comparing a Symbol, or an object whose valueOf throws,
  // would throw inside the loop, and this never throws.
  const n = typeof iterations === "number" ? iterations : 0;
  let x = 1;
  for (let i = 0; i < n; i++) x = (x * 1103515245 + 12345) % 2147483647;
  return x;
}

/**
 * @typedef {Object} ProbeOptions
 * @property {(step: number, elapsedMs: number) => unknown} [checkpoint] awaited after each completed step; it has no default, and without it the probe throws a TypeError
 * @property {number} [startStep] absent is 0
 * @property {number} [maxStep] absent is 40
 * @property {number} [iterationsPerStep] absent is 2,000,000
 * @property {number} [budgetMs] absent is 20,000
 * @property {() => number} [now] absent is Date.now
 */
/**
 * @typedef {Object} ProbeResult
 * @property {number} completed
 * @property {number} elapsed_ms
 * @property {"BUDGET_REACHED" | "MAX_STEP_REACHED"} reason
 */

/** One probe pass. Burns in increasing steps, calling `checkpoint(step, ms)`
 *  after each, and returns when the declared budget is reached.
 *
 *  If the isolate is killed mid-step, this function never returns and never
 *  reports anything: the checkpoint written after the LAST COMPLETED step is
 *  the whole record, which is why the checkpoint has to be durable rather than
 *  buffered until the end. That is the entire design of this thing.
 *  @param {ProbeOptions} [options]
 *  @returns {Promise<ProbeResult>}
 *  @throws {TypeError} when `checkpoint` is not callable; otherwise whatever `checkpoint` throws or rejects with */
export async function cpuProbe({ checkpoint, startStep = 0, maxStep = 40,
                                 iterationsPerStep = 2_000_000, budgetMs = 20_000,
                                 now = () => Date.now() } = {}) {
  // Refused before any work: without a checkpoint the probe leaves no trail, which is its whole point.
  if (typeof checkpoint !== "function") throw new TypeError("cpuProbe: checkpoint must be a function");
  const t0 = now();
  let step = startStep, elapsed = 0;
  for (; step < maxStep; step++) {
    burn(iterationsPerStep);
    elapsed = now() - t0;
    await checkpoint(step + 1, elapsed);
    if (elapsed >= budgetMs) return { completed: step + 1, elapsed_ms: elapsed, reason: "BUDGET_REACHED" };
  }
  // The elapsed time of the last completed step, the one its checkpoint recorded (0 when none ran).
  return { completed: step, elapsed_ms: elapsed, reason: "MAX_STEP_REACHED" };
}
