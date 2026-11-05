/* F3 (agent-model R35, R53; PR 355) — THE AGENT-MODEL CIRCUIT, KEPT, AND ITS HEALTH READ.
 *
 * `agent-model` keeps one circuit per (account, entry) in a handle the caller supplies, `{get(key), put(key, value)}`,
 * and with none no circuit ever opens (its R53, B4). This member supplies a persistent one: `circuitHandle(env)` over
 * its own Durable Object `HEALTH` (`CircuitState`, one object per pair, R35), holding the record `agent-model` writes
 * (a state, counts and instants: never content, never a secret) and nothing else.
 *
 * AROUND EACH TURN. `/ask`, `/draft` and `/transcribe` call `converse` through the shell's deps, so `circuitDeps` hands
 * them one that asks `circuitAdmit` before the conversation is sent and tells `circuitRecord` its outcome's class after
 * it; a conversation the circuit does not admit is never sent and ends `refused` with type `circuit_open` (or the
 * pair's mark) and its `retry_at`. A `/run` segment's conversations are made inside `agent-steps`, which tells the model
 * half each one's outcome (`spent`): `circuitRun` admits the segment before its first turn and records each
 * conversation through that hook, and a circuit that opens mid-segment ends the segment on its own bound (the meter is
 * closed), so the run stays resumable and the plane dispatches the next segment later.
 *
 * THE PAIR. The account is named by its `account_id` when it carries one, else by its level, member and project:
 * never by its secret. The entry is the conversation's `entry_id` when one is named, else `DEFAULT_ENTRY`: until
 * `agent-model.entryFor` chooses entries (R120), an account's paths share one circuit.
 *
 * THE HEALTH READ. `GET /health?account_id&entry_id` answers `agent-model`'s `pathSource` over the same handle
 * (`{ok: true, state, reset_at?}`), the read the plane's `op=aipathready` asks of this Worker (`ai-runs` R97, R110). */
import { circuitAdmit, circuitRecord, pathSource } from "../../agent-model/src/health.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** The entry a conversation's circuit is kept under when it names none (see THE PAIR). */
export const DEFAULT_ENTRY = "default";
/* A binding ignores the host; this names the request. */
const CIRCUIT_URL = "http://circuit/state";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const namespaceOf = (v) => (v && typeof v.idFromName === "function" && typeof v.get === "function" ? v : null);

/** F3, R35 — the persistent circuit handle over `env.HEALTH`, or null when it is not bound (then no circuit opens and
 *  `health` answers `unknown`, agent-model B4). Each key is its own object. A failure throws, which `agent-model`
 *  takes as nothing kept. */
export function circuitHandle(env) {
  const ns = namespaceOf(env?.HEALTH);
  if (!ns) return null;
  const stub = (key) => ns.get(ns.idFromName(String(key)));
  return {
    async get(key) {
      const res = await stub(key).fetch(CIRCUIT_URL);
      const body = await res.json();
      return body && body.ok === true ? body.value ?? null : null;
    },
    async put(key, value) {
      const res = await stub(key).fetch(CIRCUIT_URL, { method: "POST", headers: { "content-type": "application/json" },
                                                       body: JSON.stringify({ value: value ?? null }) });
      if (res.status !== 200) throw new Error("circuit state not kept");
    },
  };
}

/** F3 — the account's name in the circuit: its `account_id`, else `level:member` (with `project` at that level).
 *  Never its secret. Null when nothing names it. */
export function circuitAccount(account) {
  if (!isObject(account)) return null;
  if (typeof account.account_id === "string" && account.account_id) return account.account_id;
  const level = typeof account.level === "string" && account.level ? account.level : "member";
  const member = typeof account.member === "string" && account.member ? account.member : null;
  if (!member) return null;
  const project = level === "project" && typeof account.project === "string" ? `:${account.project}` : "";
  return `${level}${project}:${member}`;
}

/** F3, agent-model R50 — the class a conversation's outcome tells the circuit: `null` for an answer, R50's class for a
 *  failure (a stated `class` first; else a refusal's status: 429 `rate_limit`, 401/403 `auth`, 404 `model_gone`, 5xx
 *  `overload`; a silent call `timeout`), or `undefined` when the outcome says nothing of the path (a refusal of the
 *  request itself, an ending the meter made before any call). */
export function classOf(out) {
  if (!isObject(out)) return undefined;
  if (typeof out.class === "string" && out.class) return out.class;
  if (isObject(out.error) && typeof out.error.class === "string") return out.error.class;
  if (isObject(out.refused)) {
    const s = Number(out.refused.status);
    if (out.refused.type === "circuit_open") return undefined;
    if (s === 429) return "rate_limit";
    if (s === 401 || s === 403) return "auth";
    if (s === 404) return "model_gone";
    if (s >= 500) return "overload";
    return undefined;
  }
  if (isObject(out.silent)) return "timeout";
  if (out.answer !== undefined || Number(out.calls) > 0) return null;
  return undefined;
}

/** The refusal `converse` ends with when the circuit does not admit a conversation: never sent. */
const notAdmitted = (got) => ({ refused: { status: 503, type: got.class, message: got.class === "circuit_open"
  ? localize("agent-worker.circuit.the_ai_path_is_resting_2", "the AI path is resting after repeated failures, so this call was not sent; it is tried again after {retry_at}.", { retry_at: String(got.retry_at ?? "its rest") })
  : localize("agent-worker.circuit.the_ai_path_is_marked", "the AI path is marked {state}, so this call was not sent.", { state: String(got.class) }) },
  ...(got.retry_at ? { retry_at: got.retry_at } : {}), usage: null, calls: 0 });

/** F3 — `/ask`, `/draft` and `/transcribe`'s deps for one request: `cascadeToken` remembers which account each
 *  reference it hands out serves (by the reference object, so nothing but the circuit's name of the account is held,
 *  and only for this request), and `converse` asks `circuitAdmit` before the conversation and tells `circuitRecord`
 *  its class after it. With no `HEALTH` bound both are the shell's own, unchanged. */
export function circuitDeps(env, deps, { now } = {}) {
  const handle = circuitHandle(env);
  if (!handle) return deps;
  const served = new WeakMap();
  const cascadeToken = async (account) => {
    const got = await deps.cascadeToken(account);
    if (got && isObject(got.reference)) served.set(got.reference, circuitAccount(account));
    return got;
  };
  const converse = async (args) => {
    const account = served.get(args?.reference) ?? null;
    const entry = typeof args?.entry_id === "string" && args.entry_id ? args.entry_id : DEFAULT_ENTRY;
    if (!account) return deps.converse(args);
    const admitted = await circuitAdmit(handle, account, entry, { now });
    if (!admitted.admit) return notAdmitted(admitted);
    const out = await deps.converse(args);
    const cls = classOf(out);
    if (cls !== undefined) await circuitRecord(handle, account, entry, cls, { now });
    return out;
  };
  return { ...deps, cascadeToken, converse };
}

/** F3 — a `/run` segment's circuit: `{admitted}` (with the pair's `class` and `retry_at` when not), and `watch(model)`,
 *  which records each conversation the model half is told of and closes the segment's meter when the circuit opens;
 *  `settle()` waits for those records. Inert (always admitted, nothing kept) with no `HEALTH` bound or no account. */
export async function circuitRun(env, account, { now } = {}) {
  const handle = circuitHandle(env);
  const name = circuitAccount(account);
  const inert = { admitted: true, watch: (m) => m, settle: async () => {} };
  if (!handle || !name) return inert;
  const admitted = await circuitAdmit(handle, name, DEFAULT_ENTRY, { now });
  if (!admitted.admit) return { ...inert, admitted: false, class: admitted.class, retry_at: admitted.retry_at ?? null };
  /* The records are chained, each reading the state the one before it wrote. */
  let chain = Promise.resolve();
  const watch = (model) => {
    if (!model || typeof model.spent !== "function") return model;
    const spent = model.spent.bind(model);
    model.spent = (got, mode) => {
      const cls = classOf(got);
      const entry = typeof got?.entry_id === "string" && got.entry_id ? got.entry_id : DEFAULT_ENTRY;
      if (cls !== undefined) {
        chain = chain.then(() => circuitRecord(handle, name, entry, cls, { now })).then((state) => {
          if (state === "open" && model.meter) model.meter.turnsBound = model.meter.turns;
        });
      }
      return spent(got, mode);
    };
    return model;
  };
  return { admitted: true, watch, settle: () => chain };
}

/** F3, agent-model R35 — `GET /health?account_id=…&entry_id=…`: the pair's health over this member's circuit handle,
 *  `{ok: true, state, reset_at?}` as `pathSource` answers it (`unknown` with no `HEALTH` bound or a pair never seen).
 *  Makes no call to any provider, carries no content or secret, and never throws. */
export async function handleHealth(url, env, { json, now } = {}) {
  const account_id = url.searchParams.get("account_id") ?? undefined;
  const entry_id = url.searchParams.get("entry_id") ?? undefined;
  const said = await pathSource({ circuit: circuitHandle(env), now })({ account_id, entry_id });
  return json({ ok: true, ...said });
}

/** F3, R35 — THE CIRCUIT STATE, in this member's own storage: one object per (account, entry), holding the one record
 *  `agent-model` writes for it and nothing else. `GET /state` answers `{ok: true, value}`; `POST /state` with `{value}`
 *  keeps it (`null` clears it). */
export class CircuitState {
  constructor(state) { this.state = state; }

  async fetch(req) {
    if (new URL(req.url).pathname !== "/state") return Response.json({ ok: false, code: "UNKNOWN" }, { status: 404 });
    if (req.method === "GET") return Response.json({ ok: true, value: (await this.state.storage.get("circuit")) ?? null });
    if (req.method === "POST") {
      const got = await req.json().catch(() => null);
      if (!isObject(got) || !("value" in got) || !(got.value === null || isObject(got.value)))
        return Response.json({ ok: false, code: "BAD_BODY" }, { status: 400 });
      if (got.value === null) await this.state.storage.delete("circuit");
      else await this.state.storage.put("circuit", got.value);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, code: "UNKNOWN" }, { status: 404 });
  }
}
