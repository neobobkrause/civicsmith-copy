/* registers' figures (requirements: `build/requirements/registers.md`). Each is a `READ_BOUNDS` row of kind `register` when
 * runtime-limits records it (M-R3, M-R7 and PLATFORM's `SLICE_TX_MS`, R11, R20, R23); until then it is BOB's draft below, and
 * `registersOf(ctx, {bounds})` overrides any of them, so a test states the figure it runs under. */
import { boundOf } from "../read-bounds.mjs";

const figure = (name, draft) => {
  try { const v = boundOf("register", name); return Number.isFinite(v) ? v : draft; } catch { return draft; }
};

/** R3: the phase this release is. A register whose definition has `phase: beta` is refused while it is `alpha`. */
export const PRODUCT_PHASE = "alpha";
/** R11: imports queued or running in one instance. */
export const MAX_ACTIVE_IMPORTS = figure("max_active_imports", 2);
/** R20: the longest one write batch holds the object's one worker (ms). */
export const SLICE_TX_MS = figure("slice_tx_ms", 100);
/** R23: the most a slice holds beyond the reader's two windows (MB). */
export const SLICE_MEMORY_MB = figure("slice_memory_mb", 32);
/** R23, R12 (M-R7): the most a register piece may stream and the most one stored segment may hold, bytes. `read-bounds` has no `register` row until M-R7 is
 *  recorded (`acquisition` R126), so BOB's drafts stand here and are handed to `streamRegister` as `bounds`. */
export const STREAM_MAX = figure("stream_max", 5 * 1024 ** 3);
export const SEGMENT_MAX = figure("segment_max", 64 * 1024 * 1024);
/** R12: the time one slice of fetching may take (ms) and the bytes it may read. */
export const SLICE_FETCH_MS = figure("slice_fetch_ms", 5000);
export const SLICE_FETCH_BYTES = figure("slice_fetch_bytes", 32 * 1024 * 1024);
/** R12: a slice that fails is retried this many times with a growing delay (ms). */
export const SLICE_RETRIES = 3;
export const RETRY_BASE_MS = 30000;
/** R9: bytes per millisecond when no import of the register has been timed (M-R7 sets it). */
export const THROUGHPUT_DEFAULT = figure("throughput_bytes_per_ms", 1000);
/** R9: the probe's default budget (ms). */
export const DELTA_BUDGET_MS = 1200;
/** R24: search paging and time. */
export const SEARCH_LIMIT_DEFAULT = 50, SEARCH_LIMIT_MAX = 200;
export const SEARCH_BUDGET_DEFAULT = 1500, SEARCH_BUDGET_MAX = 10000;
export const MATCH_COUNT_MAX = 10000;
/** R27: the most rows a search of a register with a use limit pages to. */
export const RESULT_CAP = 1000;
/** R29: a compare page. */
export const COMPARE_PAGE_MAX = 200;
/** R23: the shelf's warning and refusal marks (percent of the object used). */
export const SHELF_WARN_PCT = 70, SHELF_REFUSE_PCT = 90;
/** R23: the object's storage ceiling (bytes) when the host does not state one (a Durable Object's SQLite database). */
export const SHELF_BYTES = 10 * 1024 ** 3;
/** R34: changesSince's page. */
export const CHANGES_PAGE_MAX = 200;
/** R6: a proposal's text fields. */
export const PROPOSAL_TEXT_MAX = 300;
/** R2/R20: rows one ingest batch writes, a ceiling beside SLICE_TX_MS. */
export const INGEST_BATCH_ROWS = 500;
/** R12: batches one reading slice runs (each a transaction within SLICE_TX_MS) before it yields the alarm. */
export const INGEST_SLICE_BATCHES = figure("ingest_slice_batches", 20);
