/* The reader of `wrap-entry.mjs`'s counts, for the tests that run the counting door under Miniflare. Pure: it imports nothing of the plane. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** The counting door as Miniflare takes it: `{scriptPath, script}`. The Worker's source is `wrap-entry.worker.txt`, the plane's default export wrapped (its header says what it counts); it is
 *  read as text and named the plane's module by path here, so this file names no module of a later layer. */
const HERE = dirname(fileURLToPath(import.meta.url));
/** @type {string} the counting door's module path */
export const WRAP = join(HERE, "wrap-entry.worker.mjs");
/** @type {() => {scriptPath: string, script: string}} */
export const wrapScript = () => ({ scriptPath: WRAP, script: readFileSync(join(HERE, "wrap-entry.worker.txt"), "utf8").replace("__PLANE__", join(HERE, "../../../src/plane/index.mjs")) });

/**
 * @typedef {Record<string, {n: number, ms: number, bytes?: number}>} CallGroup counts by key
 * @typedef {{do: CallGroup, rpc: CallGroup, r2: CallGroup, object: CallGroup}} WrapCalls what a counted answer carries
 * @typedef {{kind: string, name: string, start: number, end: number}} WrapEvent one call of the Worker's
 */
/** The counts a counted answer carries: `{do, rpc, r2, object}`, each a map of `{n, ms, bytes?}` by key (all empty when the header is absent).
 * @param {Response} res
 * @returns {WrapCalls}
 */
export function readCalls(res) {
  const raw = res.headers.get("x-wrap-calls");
  const none = { do: {}, rpc: {}, r2: {}, object: {} };
  if (!raw) return none;
  try { return { ...none, ...JSON.parse(raw) }; } catch { return none; }
}

/** The number of calls to the object (by route) a counted answer made, all routes or the ones named.
 * @param {WrapCalls} calls
 * @param {string[] | null} [routes]
 * @returns {number}
 */
export function doCalls(calls, routes = null) {
  return Object.entries(calls.do).filter(([route]) => !routes || routes.includes(route)).reduce((n, [, e]) => n + e.n, 0);
}

/** The number of R2 calls a counted answer made, by the Worker and inside the object, optionally of one method (`get`, `put`, `head`...).
 * @param {WrapCalls} calls
 * @param {string | null} [method]
 * @returns {number}
 */
export function r2Calls(calls, method = null) {
  const count = (group) => Object.entries(group).filter(([key]) => !method || key.endsWith(`.${method}`)).reduce((n, [, e]) => n + e.n, 0);
  return count(calls.r2) + count(calls.object);
}

/** The Worker's calls in the order they began and ended, `[{kind, name, start, end}]`, from an answer to a request that carried the header `x-wrap-events: 1`.
 * @param {Response} res
 * @returns {WrapEvent[]}
 */
export function readEvents(res) {
  try { return JSON.parse(res.headers.get("x-wrap-events") || "[]").map(([kind, name, start, end]) => ({ kind, name, start, end })); } catch { return []; }
}
/** The most calls in flight at once among the events that `pick` keeps (two overlap exactly when neither ended before the other began).
 * @param {WrapEvent[]} events
 * @param {(e: WrapEvent) => boolean} [pick]
 * @returns {number}
 */
export function peak(events, pick = () => true) {
  const keep = events.filter(pick);
  let best = 0;
  for (const e of keep) best = Math.max(best, keep.filter((x) => x.start <= e.start && x.end > e.start).length);
  return best;
}
/** The longest chain of calls awaited one after another: each began after the one before it ended.
 * @param {WrapEvent[]} events
 * @param {(e: WrapEvent) => boolean} [pick]
 * @returns {number}
 */
export function depth(events, pick = () => true) {
  const keep = events.filter(pick).sort((a, b) => a.start - b.start);
  const best = [];
  keep.forEach((e, i) => { best[i] = 1 + Math.max(0, ...keep.slice(0, i).filter((x) => x.end < e.start).map((x) => best[keep.indexOf(x)])); });
  return Math.max(0, ...best);
}
