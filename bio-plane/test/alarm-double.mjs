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
 * @typedef {Object} AlarmDoubleOptions
 * @property {number} [maxRetries] the retries after a handler throws; absent is 6
 * @property {boolean} [rerunAfterSuccess] whether a completed handler is run once more (retryCount 1); absent is false
 */
/**
 * One storage call, as logged: its name, and its key, list prefix or alarm time where it has one.
 * @typedef {[string] | [string, string | number]} StorageCall
 */
/**
 * What the alarm handler is given.
 * @typedef {Object} AlarmInfo
 * @property {number} retryCount
 * @property {boolean} isRetry
 */
/** @typedef {(info: AlarmInfo) => unknown} AlarmHandler the handler; it may answer a promise */
/**
 * @typedef {Object} AlarmRun
 * @property {boolean} ok whether the last attempt completed
 * @property {number} retries the retries this run took
 * @property {unknown} error what the last attempt threw, or null
 */
/**
 * @typedef {Object} AlarmStorage
 * @property {StorageCall[]} log every call, in order
 * @property {Map<string, unknown>} kv the stored values
 * @property {(k: string) => Promise<unknown>} get a copy of the value, or undefined
 * @property {(k: string, v: unknown) => Promise<void>} put
 * @property {(k: string) => Promise<boolean>} delete
 * @property {(options?: {prefix?: string}) => Promise<Map<string, unknown>>} list copies, in key order
 * @property {() => Promise<number | null>} getAlarm
 * @property {(t: number | Date) => Promise<void>} setAlarm
 * @property {() => Promise<void>} deleteAlarm
 */
/**
 * @typedef {Object} AlarmDouble
 * @property {AlarmStorage} storage
 * @property {() => Promise<number | null>} getAlarm
 * @property {(t: number | Date) => Promise<void>} setAlarm
 * @property {() => Promise<void>} deleteAlarm
 * @property {(fn: AlarmHandler) => Promise<AlarmRun>} run
 * @property {number} retries
 */
/**
 * `alarmDouble({maxRetries = 6, rerunAfterSuccess = false})` -> `{storage, getAlarm(), setAlarm(t), deleteAlarm(),
 * run(fn), retries}`. `storage` is a key-value storage double (`get`, `put`, `delete`, `list`, and the same three alarm
 * methods), each call logged in `storage.log`. `run(fn)` runs `fn({retryCount, isRetry})` as the alarm handler and
 * answers `{ok, retries, error}`; `retries` counts the retries of every run so far.
 * @param {AlarmDoubleOptions} [options]
 * @returns {AlarmDouble}
 */
export function alarmDouble({ maxRetries = 6, rerunAfterSuccess = false } = {}) {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error("alarmDouble: maxRetries must be a whole number");
  /** @type {Map<string, unknown>} */
  const kv = new Map([]);
  /** @type {StorageCall[]} */
  const log = [];
  /** @type {number | null} */
  let alarm = null;
  let running = false, setInRun = false;
  let retries = 0;

  const getAlarm = async () => { log.push(["getAlarm"]); return running && !setInRun ? null : alarm; };
  const setAlarm = async (/** @type {number | Date} */ t) => {
    if (typeof t !== "number" && !(t instanceof Date)) throw new Error("alarmDouble: setAlarm takes a time in ms or a Date");
    log.push(["setAlarm", +t]);
    alarm = +t;
    if (running) setInRun = true;
  };
  const deleteAlarm = async () => { log.push(["deleteAlarm"]); alarm = null; if (running) setInRun = true; };

  /** @type {AlarmStorage} */
  const storage = {
    log, kv,
    async get(k) { log.push(["get", k]); return kv.has(k) ? structuredClone(kv.get(k)) : undefined; },
    async put(k, v) { log.push(["put", k]); kv.set(k, structuredClone(v)); },
    async delete(k) { log.push(["delete", k]); return kv.delete(k); },
    async list({ prefix = "" } = {}) { log.push(["list", prefix]); return new Map([...kv].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, structuredClone(v)])); },
    getAlarm, setAlarm, deleteAlarm,
  };

  /**
   * @param {AlarmHandler} fn
   * @param {number} retryCount
   * @returns {Promise<unknown>} null, or what the handler threw
   */
  async function attempt(fn, retryCount) {
    running = true; setInRun = false;
    try { await fn({ retryCount, isRetry: retryCount > 0 }); return null; } catch (e) { return e; } finally { running = false; setInRun = false; }
  }

  /**
   * @param {AlarmHandler} fn
   * @returns {Promise<AlarmRun>}
   */
  async function run(fn) {
    if (typeof fn !== "function") throw new Error("alarmDouble: run takes the handler function");
    let mine = 0;
    /** @type {unknown} */
    let error = null;
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
