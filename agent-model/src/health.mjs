/* R35, R53 — THE PATH'S HEALTH, AND THE CIRCUIT IT IS READ FROM.
 *
 * One circuit per (account, entry). Its state lives in a handle the caller supplies, `{get(key), put(key, value)}`
 * (either may answer a promise), and holds only names, counts and instants: never content, never a secret. With no
 * handle nothing is kept, no circuit opens and `health` answers `unknown` (B4).
 *
 * `circuitRecord` is told each turn's class (`null` for a success, else R50's class); `circuitAdmit` says whether a
 * turn may be sent now (closed, or the one probe after the cooldown) or is refused `circuit_open` with its `retry_at`.
 * `health` reads the same state with the entry's lifecycle: it makes no call and never throws. `pathSource` is the
 * function `ai-runs.registerPathReady` takes (its R97): `({account_id, entry_id}) → health`.
 *
 * Parameters are BOB's (B3), named here as the draft proposes them until START sets them. */

export const BREAKER_FAILURES = 5;
export const BREAKER_COOLDOWN_MS = 30_000;

/** R35: the states `health` may answer, the same closed set `ai-runs`' `PATH_REASONS` reads. */
export const HEALTH_STATES = Object.freeze(["ok", "degraded", "open", "half_open", "auth_failed", "payer_unverified", "retired", "unknown"]);
/** R53: the classes the circuit counts. */
export const COUNTED_CLASSES = Object.freeze(["rate_limit", "overload", "timeout"]);
/* What a class sets beyond counting: neither of these is counted (R53); `payer_unverified` is R47's mark. */
const MARKS = Object.freeze({ auth: "auth_failed", model_gone: "retired", payer_unverified: "payer_unverified" });
/* An entry the catalogue no longer offers reads `retired`, whatever its circuit says. */
const LIFECYCLE_RETIRED = Object.freeze(["retired", "lapsed"]);

const iso = (ms) => new Date(ms).toISOString();
const nowOf = (now) => {
  const v = typeof now === "function" ? now() : now;
  return Number.isFinite(v) ? v : Date.now();
};
const idOf = (account) => {
  if (typeof account === "string") return account || null;
  if (account && typeof account === "object" && typeof account.account_id === "string") return account.account_id || null;
  return null;
};
const keyOf = (account, entry_id) => {
  const a = idOf(account);
  return a && typeof entry_id === "string" && entry_id ? `circuit:${a}:${entry_id}` : null;
};
const usable = (h) => !!h && typeof h.get === "function" && typeof h.put === "function";

async function read(handle, key) {
  if (!usable(handle) || !key) return null;
  try {
    const v = await handle.get(key);
    return v && typeof v === "object" && HEALTH_STATES.includes(v.state) ? v : null;
  } catch { return null; }
}
async function write(handle, key, v) {
  if (!usable(handle) || !key) return false;
  try { await handle.put(key, v); return true; } catch { return false; }
}
/* Only names, counts and instants are kept: the record is rebuilt field by field, so nothing else can ride in it. */
const record = ({ state, failures = 0, since, reset_at = null, last_error_class = null, probing = false }) =>
  ({ state, failures, since, reset_at, last_error_class, probing });

/** R53: whether a turn on (account, entry) may be sent at `now`: `{admit: true, probe}` or
 *  `{admit: false, class: "circuit_open", retry_at}`; a marked pair (`auth_failed`, `retired`, `payer_unverified`) is
 *  `{admit: false, class: <its state>}`. With no handle every turn is admitted. Never throws. */
export async function circuitAdmit(handle, account, entry_id, { now } = {}) {
  const key = keyOf(account, entry_id);
  const s = await read(handle, key);
  if (!s) return { admit: true, probe: false };
  const t = nowOf(now);
  if (s.state === "open") {
    const reset = Date.parse(s.reset_at);
    if (Number.isFinite(reset) && t < reset) return { admit: false, class: "circuit_open", retry_at: s.reset_at };
    await write(handle, key, record({ ...s, state: "half_open", since: iso(t), probing: true }));
    return { admit: true, probe: true };
  }
  if (s.state === "half_open") {
    if (s.probing) return { admit: false, class: "circuit_open", retry_at: s.reset_at };
    await write(handle, key, record({ ...s, probing: true }));
    return { admit: true, probe: true };
  }
  if (s.state === "auth_failed" || s.state === "retired" || s.state === "payer_unverified") return { admit: false, class: s.state };
  return { admit: true, probe: false };
}

/** R53: record one turn's class on (account, entry): `null` a success, else R50's class. Answers the new state's name,
 *  or null when nothing is kept (no handle, no pair, or a class the circuit does not track). Never throws. */
export async function circuitRecord(handle, account, entry_id, cls, { now } = {}) {
  const key = keyOf(account, entry_id);
  if (!usable(handle) || !key) return null;
  const t = nowOf(now);
  const s = await read(handle, key);
  if (cls == null) {
    if (s && (s.state === "auth_failed" || s.state === "retired" || s.state === "payer_unverified")) return s.state;
    const next = record({ state: "ok", since: s && s.state === "ok" ? s.since : iso(t) });
    return (await write(handle, key, next)) ? "ok" : null;
  }
  if (MARKS[cls]) {
    const next = record({ state: MARKS[cls], since: iso(t), last_error_class: cls });
    return (await write(handle, key, next)) ? next.state : null;
  }
  if (!COUNTED_CLASSES.includes(cls)) return s ? s.state : null;
  if (s && (s.state === "auth_failed" || s.state === "retired" || s.state === "payer_unverified")) return s.state;
  /* a failed probe reopens at once; otherwise failures count from the last success */
  const failures = (!s ? 0 : s.state === "half_open" ? BREAKER_FAILURES - 1 : s.failures) + 1;
  const opens = failures >= BREAKER_FAILURES;
  const state = opens ? "open" : "degraded";
  const next = record({ state, failures, since: s && s.state === state ? s.since : iso(t),
                        reset_at: opens ? iso(t + BREAKER_COOLDOWN_MS) : null, last_error_class: cls });
  return (await write(handle, key, next)) ? state : null;
}

/** R47, R53: an administrator's clear (`op=aicreditsclear`) or a rotated credential lets the caller reset a pair's mark:
 *  the pair reads `unknown` again until its next turn. Never throws. */
export async function circuitReset(handle, account, entry_id) {
  const key = keyOf(account, entry_id);
  return write(handle, key, null);
}

/* The catalogue's uptime evidence (characterization CH9), passed on only as the record the catalogue states it. */
function uptimeOf(entry) {
  const ev = entry && entry.characterization && entry.characterization.CH9;
  return ev && typeof ev === "object" ? ev : null;
}

/** R35: `health(account, entry_id, {circuit, entryOf, now})` → `{state, since, reset_at?, last_error_class?,
 *  uptime_evidence?}`. `state` is the entry's lifecycle where it is retired or lapsed, else the circuit's: an open
 *  circuit whose cooldown has passed reads `half_open`; a pair never observed (or no handle) reads `unknown`, with the
 *  catalogue's uptime evidence beside it. Makes no call, carries no content or secret, and never throws. */
export async function health(account, entry_id, { circuit, entryOf, now } = {}) {
  try {
    const t = nowOf(now);
    let entry = null;
    try { entry = typeof entryOf === "function" ? await entryOf(entry_id) : null; } catch { entry = null; }
    const uptime = uptimeOf(entry);
    const out = (state, since = null, extra = {}) => {
      const o = { state, since, ...extra };
      if (uptime) o.uptime_evidence = uptime;
      return o;
    };
    if (entry && LIFECYCLE_RETIRED.includes(entry.lifecycle)) return out("retired");
    const s = await read(circuit, keyOf(account, entry_id));
    if (!s) return out("unknown");
    const last = s.last_error_class ? { last_error_class: s.last_error_class } : {};
    if (s.state === "open") {
      const reset = Date.parse(s.reset_at);
      if (Number.isFinite(reset) && t >= reset) return out("half_open", s.reset_at, last);
      return out("open", s.since, { reset_at: s.reset_at, ...last });
    }
    return out(s.state, s.since, last);
  } catch {
    return { state: "unknown", since: null };
  }
}

/** R35, `ai-runs` R97: the path source `ai-runs.registerPathReady(module, fn)` takes, over the same circuit handle and
 *  catalogue read the Worker's turns use: `({account_id, entry_id}) → {state, reset_at?}`. Never throws. */
export function pathSource({ circuit, entryOf, now } = {}) {
  return async ({ account_id, entry_id } = {}) => {
    const h = await health(account_id, entry_id, { circuit, entryOf, now });
    return h.reset_at ? { state: h.state, reset_at: h.reset_at } : { state: h.state };
  };
}
