/* The platform-shaped alarm double (requirements/test-support.md R26; fix round 9, G123c first half; plan section 2c.6).
 * Not product code; importing it has no side effect. It imports nothing at all, so a module that does not use the
 * plane (scheduler) takes it through its own `uses: test-support` edge (rB D3).
 *
 * A Durable Object's alarm as the platform runs it, where the old doubles (`scheduler/fixture.mjs`) did not:
 * `getAlarm()` answers null while the handler runs (unless the handler set a new alarm), a spent alarm stays set
 * until it is deleted, and a handler that throws is run again, up to 6 retries. PLATFORM_FIGURES (K4838) adds that a
 * completed handler can be re-run once (retryCount 1): `rerunAfterSuccess` models it, so a handler is tested idempotent.
 * The fault injectors (restartAt, storeFailAt, killPage, ...) are the plane harness's (plane-1), not this double's. */

/**
 * `alarmDouble({maxRetries = 6, rerunAfterSuccess = false})` -> `{storage, getAlarm(), setAlarm(t), deleteAlarm(),
 * run(fn), retries}`. `storage` is a key-value storage double (`get`, `put`, `delete`, `list`, and the same three alarm
 * methods), each call logged in `storage.log`. `run(fn)` runs `fn({retryCount, isRetry})` as the alarm handler and
 * answers `{ok, retries, error}`; `retries` counts the retries of every run so far.
 */
export function alarmDouble({ maxRetries = 6, rerunAfterSuccess = false } = {}) {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error("alarmDouble: maxRetries must be a whole number");
  const kv = new Map();
  const log = [];
  let alarm = null;
  let running = false, setInRun = false;
  let retries = 0;

  const getAlarm = async () => { log.push(["getAlarm"]); return running && !setInRun ? null : alarm; };
  const setAlarm = async (t) => {
    if (typeof t !== "number" && !(t instanceof Date)) throw new Error("alarmDouble: setAlarm takes a time in ms or a Date");
    log.push(["setAlarm", +t]);
    alarm = +t;
    if (running) setInRun = true;
  };
  const deleteAlarm = async () => { log.push(["deleteAlarm"]); alarm = null; if (running) setInRun = true; };

  const storage = {
    log, kv,
    async get(k) { log.push(["get", k]); return kv.has(k) ? structuredClone(kv.get(k)) : undefined; },
    async put(k, v) { log.push(["put", k]); kv.set(k, structuredClone(v)); },
    async delete(k) { log.push(["delete", k]); return kv.delete(k); },
    async list({ prefix = "" } = {}) { log.push(["list", prefix]); return new Map([...kv].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, structuredClone(v)])); },
    getAlarm, setAlarm, deleteAlarm,
  };

  async function attempt(fn, retryCount) {
    running = true; setInRun = false;
    try { await fn({ retryCount, isRetry: retryCount > 0 }); return null; } catch (e) { return e; } finally { running = false; setInRun = false; }
  }

  async function run(fn) {
    if (typeof fn !== "function") throw new Error("alarmDouble: run takes the handler function");
    let mine = 0, error = null;
    for (let k = 0; ; k++) {
      error = await attempt(fn, k);
      if (!error) break;
      if (k >= maxRetries) break;
      mine++; retries++;
    }
    if (!error && rerunAfterSuccess) { mine++; retries++; error = await attempt(fn, 1); }
    return { ok: !error, retries: mine, error };
  }

  return { storage, getAlarm, setAlarm, deleteAlarm, run, get retries() { return retries; } };
}
