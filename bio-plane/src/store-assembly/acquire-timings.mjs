/* plane R73, R75 (T51; K4231, K4234; fix round 4 C5a, K4429; control-plane R115, acquisition R95): THE STAGE TIMES OF AN `acquire` THE DOOR STOPPED WAITING FOR.
   `acquire` runs in the object, and an object does not cross the fetch boundary, so the door's own timings object stays empty.
   The route map hands the arm a fresh `timings` object, held here under the door's `trace` (a string the door mints per request
   and capture sends with `/acquire`); the store-internal read `acquiretimings?trace=` answers `stageTimes` of the held object, the
   stages that ran and the one running. The holder is bounded (`HOLD_MAX`) and each entry lives `HOLD_TTL_MS` past its start, so
   it cannot grow; an entry whose acquire has ended stays until then, so a door that asks just after the end still reads it.
   (R75) The record is also written to the object's storage (`acquire_stages`) each time the acquisition begins or ends a stage,
   under the same bound, so an object that was restarted or evicted mid-call still answers what it had recorded: the stages that
   ran and the one running when it last wrote, marked `restarted`. A running stage's time in such an answer is as of that write
   (the clock `acquisition` times with does not span a restart), so it names the stage, which is what a stalled call needs. */
import { stageTimes } from "../acquisition/index.mjs";

export const HOLD_MAX = 64;
export const HOLD_TTL_MS = 60_000;
export const ACQUIRE_STAGES_DDL = `CREATE TABLE IF NOT EXISTS acquire_stages (
  trace TEXT PRIMARY KEY, started_at INTEGER NOT NULL, saved_at INTEGER NOT NULL, snapshot TEXT NOT NULL)`;

const HOLDERS = new WeakMap();

/** The holder of a host: `{open(trace), read(trace), record(trace), size}`; `now` is the clock for the time to live (a test passes its own). */
export function acquireTimingsOf(host, { now = () => Date.now() } = {}) {
  let h = HOLDERS.get(host);
  if (h) return h;
  const held = new Map();
  const sql = host && host.storage && host.storage.sql && typeof host.storage.sql.exec === "function" ? host.storage.sql : null;
  let ready = false;
  /* storage is a record kept beside the memory, never a reason for an acquire to fail */
  const stored = (work) => {
    if (!sql) return undefined;
    try { if (!ready) { sql.exec(ACQUIRE_STAGES_DDL); ready = true; } return work(sql); } catch { return undefined; }
  };
  const sweep = () => {
    const t = now();
    for (const [k, v] of held) if (t - v.at > HOLD_TTL_MS) held.delete(k);
    while (held.size > HOLD_MAX) held.delete(held.keys().next().value);
    stored((q) => {
      q.exec(`DELETE FROM acquire_stages WHERE started_at < ?`, t - HOLD_TTL_MS);
      q.exec(`DELETE FROM acquire_stages WHERE trace NOT IN (SELECT trace FROM acquire_stages ORDER BY started_at DESC, rowid DESC LIMIT ?)`, HOLD_MAX);
    });
  };
  /* an entry pushed out of the bound writes nothing more, so storage never outgrows the memory it mirrors */
  const save = (trace, entry) => held.get(trace) === entry && stored((q) => q.exec(
    `INSERT INTO acquire_stages (trace, started_at, saved_at, snapshot) VALUES (?,?,?,?)
     ON CONFLICT(trace) DO UPDATE SET saved_at=excluded.saved_at, snapshot=excluded.snapshot`,
    trace, entry.at, now(), JSON.stringify(stageTimes(entry.t))));
  h = {
    /** A fresh timings object for an `acquire`; kept under `trace` when it is a non-empty string, else only returned. A kept one
     *  writes its record to storage each time the acquisition sets one of its fields (a stage begins or ends). */
    open(trace) {
      const t = {};
      if (typeof trace !== "string" || trace === "") return t;
      sweep();
      const entry = { t, at: now() };
      held.set(trace, entry);
      save(trace, entry);
      sweep();
      return new Proxy(t, { set(target, key, value) { target[key] = value; save(trace, entry); return true; } });
    },
    /** `stageTimes` of the object held under `trace`, or null when none is held (never opened, expired or pushed out). */
    read(trace) {
      const r = h.record(trace);
      return r ? r.stageTimes : null;
    },
    /** `{stageTimes, restarted?}` for `trace`: the live object's, else the record the object's storage holds (`restarted: true`), else null. */
    record(trace) {
      sweep();
      if (typeof trace !== "string" || trace === "") return null;
      const e = held.get(trace);
      if (e) return { stageTimes: stageTimes(e.t) };
      const row = stored((q) => [...q.exec(`SELECT snapshot FROM acquire_stages WHERE trace=?`, trace)][0]);
      if (!row) return null;
      try { return { stageTimes: JSON.parse(row.snapshot), restarted: true }; } catch { return null; }
    },
    get size() { return held.size; },
  };
  HOLDERS.set(host, h);
  return h;
}

export const TRACE_HEADER = "x-civicsmith-trace";
const TRACE_VALUE = /^[\x21-\x7e]{1,200}$/;

/** The request as the route map sees it: for `acquire`, the door's trace from the header `x-civicsmith-trace` (capture R99) is set as the
 *  in-process `trace` parameter (store-door hands on only the headers it names), and a `trace` a caller put in the address is removed, so
 *  the key is the door's alone. Any other request is returned as it came. */
export async function traceStamped(req) {
  let url;
  try { url = new URL(req.url); } catch { return req; }
  if (url.pathname.replace(/^\/+/, "") !== "acquire" || req.method !== "POST") return req;
  const h = req.headers.get(TRACE_HEADER);
  url.searchParams.delete("trace");
  if (typeof h === "string" && TRACE_VALUE.test(h)) url.searchParams.set("trace", h);
  return new Request(url, { method: req.method, headers: req.headers, body: await req.text() });
}

/** The handler parts `captureOps` takes as `h`: `timings` is made when the `acquire` arm reads it, keyed by this request's `trace`. */
export function acquireHandlerParts(host, url) {
  const trace = url.searchParams.get("trace");
  return { get timings() { return acquireTimingsOf(host).open(trace); } };
}

/** The store-internal read, an entry of the route map: no caller's own, reached by the door with the stamps it sets. */
export function acquireTimingsOps(host, url) {
  return { acquiretimings: () => {
    const r = acquireTimingsOf(host).record(url.searchParams.get("trace"));
    return { ok: true, stageTimes: r ? r.stageTimes : null, ...(r && r.restarted ? { restarted: true } : {}) };
  } };
}
