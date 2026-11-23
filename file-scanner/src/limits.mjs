/* file-scanner's fixed sets and limits (R15, R16), exported by name and stated in /version's `bounds` (R8).
 *
 * `MEMBER_LIMITS_STATEMENT` is the configuration's own `limits` (`wrangler.jsonc`), stated in the bundle so the signed
 * release carries what the installer uploads as the Worker's limits (installer R39, as sheet-worker R17). It names only
 * the Worker's Cloudflare limits: the installer sends every key it names as one, so the named bounds below stay out of
 * it (question J1 to BOB, this reading). */

import { boundOf, READ_BOUNDS } from '../../bio-plane/src/read-bounds.mjs';

/** R15: the stores a request may name, as sheet-worker R11. Frozen.
 * @type {readonly string[]} */
export const NAMESPACES = Object.freeze(['bio', 'scratch']);
/** R15: no plane op of its own. Frozen, empty.
 * @type {readonly string[]} */
export const PLANE_OPS = Object.freeze([]);

/** R16, R2: the most bytes one target, and one batch's staged targets, may hold; quoted from `READ_BOUNDS`.
 * @type {number}
 * @bound whole number of bytes, greater than zero */
export const SCAN_MAX_BYTES = boundOf('scan', 'max_bytes');
/** R16, R1: the most targets one `/scan` request may carry.
 * @type {number} */
export const SCAN_BATCH_MAX = 200;
/** R16, R4: past this age, in milliseconds, the newest signature set is stale.
 * @type {number} */
export const SIGNATURES_MAX_AGE_MS = 259_200_000;
/** R16, R7: the resolution a safe view's pages are rendered at.
 * @type {number} */
export const SAFE_VIEW_DPI = 150;
/** R16, R7: the most source pages a safe view converts; quoted from `READ_BOUNDS`.
 * @type {number}
 * @bound whole number of pages, greater than zero */
export const SAFE_VIEW_PAGES_MAX = boundOf('render', 'safe_view_pages');
/** R16, R7: the most bytes a safe view's PDF may hold; quoted from `READ_BOUNDS`.
 * @type {number}
 * @bound whole number of bytes, greater than zero */
export const SAFE_VIEW_BYTES_MAX = boundOf('render', 'safe_view_bytes');
/** R16, R5: how long, in milliseconds, an outside call may take.
 * @type {number} */
export const PROVIDER_TIMEOUT_MS = 120_000;
/** R16, R23: how long, in milliseconds after submission, a sandbox may still be running.
 * @type {number} */
export const SANDBOX_TIMEOUT_MS = 3_600_000;
/** R16, R25: past this age, in milliseconds, a hash-prefix tool's local list is stale.
 * @type {number} */
export const REPUTATION_LIST_MAX_AGE_MS = 86_400_000;

/** R16: `file-safety` R35's kinds, the only keys a forwarded counts record may hold (R27). Frozen.
 * @type {readonly string[]} */
export const LOG_COUNT_KINDS = Object.freeze([
  'files_scanned', 'files_found', 'holds_placed', 'holds_released', 'deeper_checks', 'sandbox_submissions',
  'safe_views', 'safe_copies', 'reputation_listed', 'signin', 'credential', 'rate', 'handover', 'through',
]);

/** R16: the time budgets, measured at the job (record T36/file-scanner): a ClamAV run over one request's targets, and
 *  one safe-view render, each in the container; past them the run is stopped (R3 `unknown`, R7 `TIME_LIMIT`).
 *  `SCAN_TIME_MS` is quoted from `READ_BOUNDS`.
 * @type {number} */
export const SCAN_TIME_MS = boundOf('scan', 'time_ms');
/** R16, R7: one safe-view render's time budget, in milliseconds.
 * @type {number} */
export const RENDER_TIME_MS = 600_000;

/** R35: every limit a ClamAV run is told, quoted from the table (G136a). The images cannot import the table, so the
 *  Worker sends this whole object with each scan and the image refuses a scan that lacks one of them. Frozen.
 * @type {Readonly<Record<string, number>>} */
export const SCAN_LIMITS = Object.freeze({
  max_filesize: SCAN_MAX_BYTES, max_scansize: boundOf('archive', 'unpacked_bytes'), max_files: boundOf('archive', 'members'),
  max_recursion: boundOf('archive', 'depth'), scan_time_ms: SCAN_TIME_MS, embedded_pe: boundOf('scan', 'embedded_pe'),
  html_normalize: boundOf('scan', 'html_normalize'), script_normalize: boundOf('scan', 'script_normalize'),
  zip_type_rcg: boundOf('scan', 'zip_type_rcg'), partitions: boundOf('scan', 'partitions'), icons_pe: boundOf('scan', 'icons_pe'),
  zip_directory: boundOf('archive', 'directory'),
});

/** R16, R8: each read bound by its name, with the table row it is quoted from. */
const READ_BOUND_ROWS = Object.freeze({
  SCAN_MAX_BYTES: ['scan', 'max_bytes'], SCAN_TIME_MS: ['scan', 'time_ms'], SAFE_VIEW_PAGES_MAX: ['render', 'safe_view_pages'],
  SAFE_VIEW_BYTES_MAX: ['render', 'safe_view_bytes'], SCAN_MAX_SCANSIZE: ['archive', 'unpacked_bytes'],
  SCAN_MAX_FILES: ['archive', 'members'], SCAN_MAX_RECURSION: ['archive', 'depth'], SCAN_EMBEDDED_PE: ['scan', 'embedded_pe'],
  SCAN_HTML_NORMALIZE: ['scan', 'html_normalize'], SCAN_SCRIPT_NORMALIZE: ['scan', 'script_normalize'],
  SCAN_ZIP_TYPE_RCG: ['scan', 'zip_type_rcg'], SCAN_PARTITIONS: ['scan', 'partitions'], SCAN_ICONS_PE: ['scan', 'icons_pe'],
  SCAN_ZIP_DIRECTORY: ['archive', 'directory'],
});
const READ_BOUND_STATED = Object.freeze(Object.fromEntries(Object.entries(READ_BOUND_ROWS).map(([name, [kind, row]]) => {
  const value = boundOf(kind, row);
  return [name, Object.freeze({ value, source: READ_BOUNDS[kind][row].alpha === value ? 'alpha' : 'standard' })];
})));

/** The configuration's `limits`, parsed; and its statement (installer R39). A test pins both to `wrangler.jsonc`.
 * @type {Readonly<{cpu_ms: number}>} */
export const MEMBER_LIMITS = Object.freeze({ cpu_ms: 300000 });
/** R16: the configuration's `limits` as the bundle states them, `bio-member-limits/1 <key>=<value>...`.
 * @type {string} */
export const MEMBER_LIMITS_STATEMENT = "bio-member-limits/1 cpu_ms=300000";

/** R8, R16: every bound `/version` states, by name: the plain figures as they are, each read bound as
 *  `{value, source}`, `source` the table's column (`alpha` or `standard`). Frozen.
 * @type {Readonly<Record<string, *>>} */
export const BOUNDS = Object.freeze({
  SCAN_BATCH_MAX, SIGNATURES_MAX_AGE_MS, SAFE_VIEW_DPI, PROVIDER_TIMEOUT_MS, SANDBOX_TIMEOUT_MS, REPUTATION_LIST_MAX_AGE_MS,
  RENDER_TIME_MS, LOG_COUNT_KINDS, ...READ_BOUND_STATED,
});
