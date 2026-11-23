/* R30: no Logpush job may keep a record of each request of the copy's Workers. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { cf } from "./api.mjs";
/** @import { Emit, Session } from './api.mjs' */

/* R46 (T36; K1892 "no log", K1946 T8) — NO LOG OF WHO OPENED WHICH FILE.
 *
 * A Logpush job over `workers_trace_events` keeps a record of each request a Worker serves, and a request for a file
 * names the file and its caller: on the copy's Workers that would be a log of who opened which file, which K1892 rules
 * out. Before `verify` can succeed, the account's Logpush jobs are listed, and each job over that dataset whose filter
 * does not exclude every one of the copy's Workers (the plane and its members, by script name) is named as a failure;
 * no success is claimed while one is. A filter excludes them only when, read as Logpush's filter grammar, its `where`
 * (alone, or one condition of a top-level `and`) is a `ScriptName` condition that leaves every one of them out:
 * `!in` or `!eq` naming them all, or `in` or `eq` naming none of them. Anything else, a filter that does not parse
 * included, does not exclude them. A list the permission cannot read leaves the check UNDETERMINED, said so, never
 * passed (CFG.LOGPUSH_SCOPE: every Logpush API call needs "Logs Write", which R2 does not ask). */
/** @type {string} the Logpush dataset that records each request a Worker serves */
export const PER_REQUEST_DATASET = "workers_trace_events";
/**
 * Whether a Logpush job's filter leaves out every one of `names` by `ScriptName`.
 * @param {any} filter the job's filter, as JSON text or already parsed; absent or unparsable excludes nothing
 * @param {string[]} names the copy's Workers' script names
 * @returns {boolean}
 */
export function filterExcludes(filter, names) {
  if (filter === null || filter === undefined || filter === "") return false;
  let f;
  try { f = typeof filter === "string" ? JSON.parse(filter) : filter; } catch { return false; }
  const w = f && typeof f === "object" ? f.where : null;
  if (!w || typeof w !== "object") return false;
  const conds = typeof w.key === "string" ? [w] : Array.isArray(w.and) ? w.and : [];
  return conds.some((c) => {
    if (!c || c.key !== "ScriptName") return false;
    const vals = (Array.isArray(c.value) ? c.value : [c.value]).map(String);
    const op = String(c.operator);
    if (op === "!in" || op === "!eq") return names.every((n) => vals.includes(n));
    if (op === "in" || op === "eq") return names.every((n) => !vals.includes(n));
    return false;
  });
}
/**
 * Lists the account's Logpush jobs and names each over PER_REQUEST_DATASET that does not exclude `names`.
 * @param {Session} token the run's Session
 * @param {string} acct the account's id
 * @param {string[]} names the copy's Workers' script names
 * @returns {Promise<{state: "undetermined", why: string, jobs?: undefined} | {state: "named", jobs: any[], why?: undefined} | {state: "clear", why?: undefined, jobs?: undefined}>}
 *   `why` when the list could not be read; `jobs`, the jobs named, when any is
 */
async function logpushCheck(token, acct, names) {
  let jobs;
  try { jobs = await cf(token, `/accounts/${acct}/logpush/jobs`); }
  catch (e) { return { state: "undetermined", why: e.message }; }
  if (!Array.isArray(jobs)) return { state: "undetermined", why: word("installer.logs.unreadable") };
  const named = jobs.filter((j) => j && j.dataset === PER_REQUEST_DATASET && !filterExcludes(j.filter, names));
  return named.length ? { state: "named", jobs: named } : { state: "clear" };
}
/**
 * @param {any} j a Logpush job as the API lists it
 * @param {string[]} names the copy's Workers' script names
 * @returns {string} the job named as a lag, paused or not
 */
const logLag = (j, names) => {
  const vars = { name: String(j.name || word("installer.lag.logjob.unnamed")), id: j.id ?? word("installer.lag.logjob.unknownid"), dataset: PER_REQUEST_DATASET, programs: names.join(", ") };
  return j.enabled === false ? word("installer.lag.logjob.paused", vars) : word("installer.lag.logjob", vars);
};
/** The step itself: listed, said, and its named jobs returned as lags for the verdict (R15's rule: no success over one).
 * @param {Emit} emit
 * @param {Session} token the run's Session
 * @param {string} acct the account's id
 * @param {string[]} names the copy's Workers' script names
 * @returns {Promise<{lags: string[], state: string}>}
 */
async function logsStep(emit, token, acct, names) {
  await emit.step("logs", word("installer.step.logs"));
  const r = await logpushCheck(token, acct, names);
  if (r.state === "clear") {
    emit.ok("logs", word("installer.logs.clear"));
    return { lags: [], state: r.state };
  }
  if (r.state === "undetermined") {
    emit.no("logs", word("installer.logs.undetermined", { said: r.why, programs: names.join(", ") }));
    return { lags: [], state: r.state };
  }
  const lags = r.jobs.map((j) => logLag(j, names));
  emit.no("logs", lags.length === 1 ? word("installer.logs.named.one", { list: lags.join("; ") }) : word("installer.logs.named.other", { n: lags.length, list: lags.join("; ") }));
  return { lags, state: r.state };
}

export { logpushCheck, logLag, logsStep };
