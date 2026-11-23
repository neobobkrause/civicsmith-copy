/* R109, R110, R111 — THE ONE ROAD TO A MEMBER'S ASSISTANT: THE REMOTE SESSION, AND WHETHER IT MAY BE TAKEN YET
 * (N1196; K3607–K3611, K3615; DEC-301).
 *
 * The assistant runs in a Claude Code cloud session that `agent-runner`'s second class (bound here as `REMOTE`, a
 * Durable Object namespace with no container) creates on the member's own sign-in. Every path of this member that
 * reaches a runner (`/ask`, `/run`, `/draft` in every task, `/transcribe` and `/signin`) reaches it through `remoteOf`,
 * which answers `env.REMOTE` and nothing else: the local container binding (`RUNNER`) is not declared, not read and
 * not named by any code here (R109). The binding is passed to `agent-model` as the `runner` it already takes, because
 * `REMOTE` accepts the conversation's connection and request unchanged (`agent-runner` R36).
 *
 * WHETHER IT MAY BE TAKEN (R110; K3610: until the remote path works on a copy, that copy's assistant does not run).
 * `remoteVersion` asks the remote class its `GET /remote/version` (`agent-runner` R40) on an instance named
 * `VERSION_INSTANCE`, there being no member in that question. `remoteReady` is true exactly when that answered and the
 * member's check record, kept in this member's own storage (`CheckRecord`, bound `CHECKS`, one instance per member; BOB's
 * K3693), states a passed check at that very version (R111's `check` step writes it with `recordCheck`). A check from
 * another version is no check, and a copy with no `CHECKS` binding has none. Nothing here throws, and nothing here keeps
 * anything but that one record, a version and a time (R36): each answer is asked of the instances and used once. */

/* A binding ignores the host; this names the request, it does not route it (as `agent-model`'s `RUNNER_URL`). */
/**
 * A Durable Object namespace that names its instances: what `remoteOf` answers and `agent-model` takes as its `runner`.
 * @typedef {Object} RunnerNamespace
 * @property {(name: string) => any} idFromName
 * @property {(id: any) => {fetch: (url: string, init?: any) => Promise<Response>}} get
 */
/**
 * R110: whether the remote class answered `GET /remote/version`.
 * @typedef {Object} RemoteVersion
 * @property {boolean} answered
 * @property {string} [version] when answered: the version it names, not empty
 * @property {string} [why] when not answered: `absent` or `silent`
 * @bound why: absent (no `REMOTE` binding) or silent (no answer of R5's shape)
 */
/**
 * R110: whether the member's assistant may be taken.
 * @typedef {Object} RemoteReadiness
 * @property {boolean} ready
 * @property {string} [version] when ready: the version the passed check was at
 * @property {string} [why] when not ready: `absent`, `silent` or `unchecked`
 * @bound why: absent, silent or unchecked
 */

const REMOTE_ORIGIN = "https://agent-runner";
/** R110: the request `GET /remote/version` is sent as; a binding ignores the host.
 *  @type {string} */
export const REMOTE_VERSION_URL = `${REMOTE_ORIGIN}/remote/version`;
/** R110: the instance `GET /remote/version` is asked of, there being no member in `GET /version`'s question.
 *  @type {string} */
export const VERSION_INSTANCE = "version";

const namespaceOf = (v) => (v && typeof v.idFromName === "function" && typeof v.get === "function" ? v : null);

/** R109 — the one function that answers a runner: `env.REMOTE` as a namespace that names instances, else null.
 *  @param {any} env the Worker's bindings
 *  @returns {RunnerNamespace|null} */
export const remoteOf = (env) => namespaceOf(env?.REMOTE);

/** R110 — `{answered: true, version}` when the remote class answers `GET /remote/version` as `agent-runner` R5's shape
 *  (`{ok: true, version, …}`), else `{answered: false}`. Never throws.
 *  @param {any} env the Worker's bindings
 *  @returns {Promise<RemoteVersion>} */
export async function remoteVersion(env) {
  const ns = remoteOf(env);
  if (!ns) return { answered: false, why: "absent" };
  try {
    const res = await ns.get(ns.idFromName(VERSION_INSTANCE)).fetch(REMOTE_VERSION_URL);
    if (!res || res.status !== 200) return { answered: false, why: "silent" };
    const body = await res.json();
    if (!body || body.ok !== true || typeof body.version !== "string" || !body.version) return { answered: false, why: "silent" };
    return { answered: true, version: body.version };
  } catch {
    return { answered: false, why: "silent" };
  }
}

/* The check record's address: a binding ignores the host, this names the request. */
const CHECK_URL = "http://check/check";
/** One instance per member, named for the member (the record is the member's own act). */
const checkInstance = (member) => `member:${member}`;

/** R110 — the member's check record: `{checked, version}` as `CheckRecord` states it, or null when `CHECKS` is not bound
 *  or does not answer. Never throws. */
async function checkRecord(env, member) {
  const ns = namespaceOf(env?.CHECKS);
  if (!ns) return null;
  try {
    const res = await ns.get(ns.idFromName(checkInstance(member))).fetch(CHECK_URL);
    if (!res || res.status !== 200) return null;
    const body = await res.json();
    return body && body.ok === true ? { checked: body.checked === true, version: typeof body.version === "string" ? body.version : null } : null;
  } catch {
    return null;
  }
}

/** R111 — records that the member's check passed at `version`; true when `CheckRecord` took it. Never throws.
 *  @param {any} env the Worker's bindings
 *  @param {string} member the member's reference
 *  @param {string} version the remote class's version the check passed at
 *  @returns {Promise<boolean>} */
export async function recordCheck(env, member, version) {
  const ns = namespaceOf(env?.CHECKS);
  if (!ns || typeof version !== "string" || !version) return false;
  try {
    const res = await ns.get(ns.idFromName(checkInstance(member))).fetch(CHECK_URL, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
    return !!res && res.status === 200;
  } catch {
    return false;
  }
}

/** R110 — `{ready: true}` exactly when the remote class answers its version and the member's check record states a
 *  passed check at that version; else `{ready: false, why}`, `why` one of `absent`, `silent`, `unchecked`. Never throws.
 *  @param {any} env the Worker's bindings
 *  @param {string} member the member's reference
 *  @returns {Promise<RemoteReadiness>} */
export async function remoteReady(env, member) {
  const v = await remoteVersion(env);
  if (!v.answered) return { ready: false, why: v.why };
  const record = await checkRecord(env, member);
  return record && record.checked && record.version === v.version
    ? { ready: true, version: v.version } : { ready: false, why: "unchecked" };
}
