/* CR2-29 (ai-runs R97, R98, F1; agent-model R35; agent-worker's `GET /health`): THE AI PATH'S SOURCE. ai-runs' `op=aipathready`
   reads whether an (account, entry) path is ready through the one source registered with it (`registerPathReady`), "the
   plane's op=aipathready, agent-model's health(account, entry) read over the Worker, registered once at start by the module
   that serves it". The plane serves it: the Store registers this source once at construction (`store.mjs`). It asks the
   `AGENT_WORKER` binding's `GET /health?account_id&entry_id` (agent-worker's `handleHealth`, agent-model's `pathSource` over
   the Worker's circuit) and answers `{state, reset_at?}` as the Worker says it. It makes no model call, sends no content and no
   secret, and never throws: with no binding, an answer that is not the Worker's `{ok: true, state}`, a failure or no answer
   within `PATH_HEALTH_WAIT_MS`, it answers `unknown`, which ai-runs reads not ready (fail closed). */

/** The module name the source is registered under (ai-runs' `registerPathReady(module, fn)`). */
export const PATH_SOURCE_MODULE = "plane";
/** The longest a health read waits for the Worker before it reads `unknown`. */
export const PATH_HEALTH_WAIT_MS = 5000;
/* a binding ignores the host; this names the request */
const HEALTH_URL = "https://agent-worker/health";

const UNKNOWN = Object.freeze({ state: "unknown" });

/** The source over `env.AGENT_WORKER`: `({account_id, entry_id}) → Promise<{state, reset_at?}>`. */
export function pathSourceOf(env) {
  return async ({ account_id, entry_id } = {}) => {
    const worker = env && env.AGENT_WORKER;
    if (!worker || typeof worker.fetch !== "function") return UNKNOWN;
    const q = new URLSearchParams();
    if (typeof account_id === "string") q.set("account_id", account_id);
    if (typeof entry_id === "string") q.set("entry_id", entry_id);
    let timer = null;
    try {
      const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), PATH_HEALTH_WAIT_MS); });
      const res = await Promise.race([worker.fetch(`${HEALTH_URL}?${q}`, { method: "GET" }), late]);
      if (!res || res.status !== 200) return UNKNOWN;
      const body = await Promise.race([res.json(), late]);
      if (!body || body.ok !== true || typeof body.state !== "string") return UNKNOWN;
      return typeof body.reset_at === "string" ? { state: body.state, reset_at: body.reset_at } : { state: body.state };
    } catch {
      return UNKNOWN;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

/** Registers the source with `runs` (ai-runs' instance for this object) once; a second registration on the same object is
 *  ai-runs' own refusal, answered and not raised. Never throws. */
export function registerPathSource(runs, env) {
  try { return runs.registerPathReady(PATH_SOURCE_MODULE, pathSourceOf(env)); }
  catch { return { ok: false }; }
}
