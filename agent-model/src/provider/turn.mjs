/* agent-model (T53) — ONE TURN THROUGH THE PROVIDER INTERFACE: `turn(request, deps)` (R25–R54).
 *
 * The boundary every model call passes. It checks the request (R25), finds the entry, its profile and plan in the
 * catalogue, refuses at the boundary what the entry cannot do (R29–R31, R14, R36, R42, R10), resolves the credential
 * once by the account's means (R46), selects the adapter by `adapter_type` (R37), and then sends: bounded retry
 * (R51) under one idempotency key (R32), every failure classified once (R50), a provider-side limit answered as a limit
 * (R52), the circuit kept per (account, entry) (R53), the served identity checked against the entry (R45), and under
 * `gateway` the payer read from the gateway's log (R47, R48). Every outcome carries R26's envelope; the credential is
 * scrubbed out of everything returned (R8, R49). It never throws (R3) and names no provider.
 *
 * `deps` is what the Worker hands: `catalogue` (`entryOf`, `profileOf`, `plansOf`), `fetch`, `bindings` (by name),
 * `resolveCredential` (the plane's `op=aicredential`), `credentialFailed` (`op=aicredentialfailed`), `gatewayServed`
 * (`op=aigatewayserved`), `circuit` (`{get, put}`), `adapters` (by type; default this copy's), `now`, `sleep` (a backoff
 * wait), `timeout` (a turn's time bound; default a timer) and `random`. */

import * as P from "./params.mjs";
import { usageRecord, blankUsage, sumUsage, scrubValue, cutDetail, cutMessage, silent, refused, errorOf, limitOf,
  servedOf, limitsOf, enveloped, claimValue, NO_SERVED } from "./neutral.mjs";
import { entryFrom, profileFrom, planFrom, capabilitiesOf, costEstimated } from "./catalogue.mjs";
import { circuitAdmit, circuitRecord } from "../health.mjs";
import { ADAPTERS } from "./adapters/index.mjs";

/** R25: the fields a request may carry. */
export const REQUEST_FIELDS = Object.freeze(["account", "entry_id", "messages", "tools", "tool_choice", "output_schema",
  "effort", "max_output", "session_key", "cache_hints", "data_handling", "runtime", "timeout_ms", "idempotency_key",
  "interactive", "test_flow", "onProgress"]);
export const LEVELS = Object.freeze(["member", "project", "group"]);
export const MEANS = Object.freeze(["gateway", "sealed", "reference", "issued", "none"]);
export const RUNTIMES = Object.freeze(["shared_worker", "member_runtime", "member_device"]);
const DATA_HANDLING = Object.freeze({ zero_retention: ["required", "if_offered", "off"], host_pin: ["required", "off"],
  provider_state: ["forbidden", "allowed"] });
const LISTED = Object.freeze(["listed", "watch"]);
const CUSTOM_PROFILE = "custom";
const COUNTED = Object.freeze(["rate_limit", "overload", "timeout"]);
const RETRIED = COUNTED;

const posInt = (v) => Number.isSafeInteger(v) && v > 0;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const utf8 = new TextEncoder();
const nowOf = (deps) => (typeof deps.now === "function" ? deps.now() : Date.now());
const sleepOf = (deps) => (typeof deps.sleep === "function" ? deps.sleep : (ms) => new Promise((r) => setTimeout(r, ms)));
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return null; } };

/** R25: the request's shape; a refusal outcome or null. */
function malformed(req) {
  if (!isObj(req)) return refused("REQUEST_INVALID", { field: "request" });
  for (const k of Object.keys(req)) if (!REQUEST_FIELDS.includes(k)) return refused("REQUEST_INVALID", { field: k });
  const a = req.account;
  if (!isObj(a)) return refused("ACCOUNT_REFERENCE_UNUSABLE");
  if (!LEVELS.includes(a.level)) return refused("ACCOUNT_REFERENCE_UNUSABLE");
  if (!MEANS.includes(a.means)) return refused("ACCOUNT_REFERENCE_UNUSABLE");
  if (!(typeof req.entry_id === "string" && req.entry_id) && !(req.test_flow === true && isObj(req.entry_id)) && !isObj(req.entry_id))
    return refused("REQUEST_INVALID", { field: "entry_id" });
  if (!Array.isArray(req.messages) || !req.messages.length) return refused("REQUEST_INVALID", { field: "messages" });
  if (!(typeof req.idempotency_key === "string" && req.idempotency_key)) return refused("REQUEST_INVALID", { field: "idempotency_key" });
  if (!posInt(req.max_output)) return refused("REQUEST_INVALID", { field: "max_output" });
  if (!posInt(req.timeout_ms)) return refused("REQUEST_INVALID", { field: "timeout_ms" });
  if (!RUNTIMES.includes(req.runtime)) return refused("REQUEST_INVALID", { field: "runtime" });
  const dh = req.data_handling;
  if (!isObj(dh) || Object.entries(DATA_HANDLING).some(([k, vs]) => !vs.includes(dh[k])))
    return refused("REQUEST_INVALID", { field: "data_handling" });
  if (req.tools !== undefined && !Array.isArray(req.tools)) return refused("REQUEST_INVALID", { field: "tools" });
  if (req.onProgress !== undefined && typeof req.onProgress !== "function") return refused("REQUEST_INVALID", { field: "onProgress" });
  return null;
}

const imageIn = (messages) => messages.some((m) => Array.isArray(m?.content) && m.content.some((b) => b && b.type === "image"));

/** R29, R30, R31, R14: the first control the entry cannot meet, by name, or null. */
function unsupported(req, caps) {
  const need = (name, ok) => (ok ? null : name);
  return (Array.isArray(req.tools) && req.tools.length ? need("tools", caps.tools === true) : null)
    ?? (req.output_schema ? need("schema_output", caps.schema_output === true) : null)
    ?? (req.output_schema && Array.isArray(req.tools) && req.tools.length ? need("schema_with_tools", caps.schema_with_tools === true) : null)
    ?? (imageIn(req.messages) ? need("image_input", caps.image_input === true) : null)
    ?? (req.data_handling.zero_retention === "required" ? need("zero_retention", caps.zero_retention === true) : null)
    ?? (req.effort != null ? (caps.effort_set ? need("effort_value", caps.effort_set.includes(req.effort)) : "effort") : null);
}

/** R28: the transcript with every continuation not tagged for this entry and adapter dropped, and how many. */
function continuations(messages, entry) {
  let dropped = 0;
  const out = messages.map((m) => {
    if (!m || m.role !== "assistant" || m.continuation == null) return m;
    const c = m.continuation;
    if (isObj(c) && c.adapter === entry.adapter_type && c.entry_id === entry.entry_id) return m;
    dropped += 1;
    const { continuation, ...rest } = m;
    return rest;
  });
  return { messages: out, dropped };
}

const payerKey = (account, gateway_id) => `payer:${account.account_id ?? ""}:${gateway_id ?? ""}`;
async function payerFlagged(circuit, account) {
  if (!circuit || typeof circuit.get !== "function") return false;
  try { const v = await circuit.get(payerKey(account, account.gateway_id)); return !!(v && v.state === "payer_unverified"); } catch { return false; }
}
async function flagPayer(circuit, account) {
  if (!circuit || typeof circuit.put !== "function") return;
  try { await circuit.put(payerKey(account, account.gateway_id), { state: "payer_unverified" }); } catch { /* kept nowhere */ }
}
/** R47: an administrator's clear lets the caller reset the (account, gateway) mark. */
export async function payerReset(circuit, account) {
  if (!circuit || typeof circuit.put !== "function" || !isObj(account)) return false;
  try { await circuit.put(payerKey(account, account.gateway_id), null); return true; } catch { return false; }
}

async function call(fn, arg) {
  if (typeof fn !== "function") return null;
  try { return (await fn(arg)) ?? null; } catch { return null; }
}

/** R46: the credential for this one turn, by the account's means: `{secret, means}` or a refusal/error outcome. */
async function credentialFor(account, deps) {
  const means = account.means;
  if (means === "gateway") {
    if (!(typeof account.gateway_id === "string" && account.gateway_id)) return { fail: refused("ACCOUNT_REFERENCE_UNUSABLE") };
    return { cred: { secret: null, means } };
  }
  if (means === "none") return { cred: { secret: null, means } };
  if (means === "reference") {
    const v = await call(deps.resolveCredential, { account_id: account.account_id ?? null, means, reference: account.reference ?? null });
    if (!(typeof v === "string" && v)) return { fail: errorOf("auth", { detail: "reference_unresolved" }), authFailed: true };
    return { cred: { secret: v, means } };
  }
  /* sealed, issued: the secret the account carries, else read at the call with `op=aicredential` */
  let secret = typeof account.secret === "string" && account.secret ? account.secret : null;
  if (!secret && account.secret === undefined)
    secret = await call(deps.resolveCredential, { account_id: account.account_id ?? null, means });
  if (!(typeof secret === "string" && secret)) return { fail: refused("ACCOUNT_REFERENCE_UNUSABLE") };
  return { cred: { secret, means } };
}

/** The binding the account names (its gateway or AI binding), or null. `gateway` and `none` need one; a `sealed` key
 *  through a gateway binding goes as a passthrough (R41). */
function bindingFor(account, deps) {
  const name = account.binding;
  const b = typeof name === "string" && deps.bindings ? deps.bindings[name] : null;
  return b && typeof b.fetch === "function" ? b : null;
}

/** A plain lowercase header object from a Headers or a plain object. */
function headersOf(h) {
  const out = {};
  if (!h) return out;
  if (typeof h.forEach === "function") h.forEach((v, k) => { out[String(k).toLowerCase()] = String(v); });
  else for (const [k, v] of Object.entries(h)) out[String(k).toLowerCase()] = String(v);
  return out;
}

/** One attempt: the response read whole (progress on its first bytes), or a fault. Never throws. */
async function attempt(transport, http, timeout_ms, deps, progress) {
  const timer = Symbol("timeout");
  const abort = typeof AbortController === "function" ? new AbortController() : null;
  const send = (async () => {
    try {
      const res = await transport(http.url, { method: http.method, headers: http.headers, body: http.body, ...(abort ? { signal: abort.signal } : {}) });
      progress("reading");
      let text = "";
      if (res && res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let first = true;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (first) { progress("composing"); first = false; }
          text += typeof value === "string" ? value : dec.decode(value, { stream: true });
        }
      } else text = res && typeof res.text === "function" ? await res.text() : "";
      return { status: res?.status, headers: headersOf(res?.headers), text };
    } catch (e) { return { fault: "network", message: String(e?.message ?? e) }; }
  })();
  let clear = null;
  const expiry = typeof deps.timeout === "function"
    ? Promise.resolve(deps.timeout(timeout_ms)).then(() => timer)
    : new Promise((resolve) => { const id = setTimeout(() => resolve(timer), timeout_ms); clear = () => clearTimeout(id); });
  const out = await Promise.race([send, expiry]);
  if (clear) clear();
  if (out === timer) { try { abort?.abort(); } catch { /* abandoned */ } return { fault: "timeout" }; }
  return out;
}

/** R51: the wait before attempt `n + 1` after a retried class. */
function backoff(n, deps) {
  const base = Math.min(P.BACKOFF_CAP_MS, P.BACKOFF_BASE_MS * P.BACKOFF_FACTOR ** (n - 1));
  const r = typeof deps.random === "function" ? deps.random() : Math.random();
  return Math.max(0, Math.round(base * (1 + ((r * 2 - 1) * P.JITTER_PERCENT) / 100)));
}

/** R47, R48: the gateway's log record for the call, read again up to `LOG_REREADS` times; null if unreadable. */
async function gatewayLog(binding, logId, deps) {
  if (!logId || !binding || typeof binding.getLog !== "function") return null;
  for (let i = 0; i <= P.LOG_REREADS; i += 1) {
    const rec = await call(binding.getLog.bind(binding), logId);
    if (isObj(rec)) return rec;
    if (i < P.LOG_REREADS) await sleepOf(deps)(P.LOG_REREAD_WAIT_MS);
  }
  return null;
}

/** R47, R48: whether the log shows the account's own stored key served the call and no platform credit paid. */
function payerOf(log, account) {
  if (!log) return { own_key_served: false, platform_credits_used: null, verified: false };
  const sameGateway = log.gateway_id == null || log.gateway_id === account.gateway_id;
  const own = typeof log.byok === "string" && log.byok.length > 0 && log.wholesale === false && sameGateway;
  const credits = log.wholesale !== false;
  return { own_key_served: own, platform_credits_used: credits, verified: own && !credits };
}

/** R45: the served identity against the entry, under the request's `host_pin`; a refusal or null. */
function pinBreach(served, entry, hostPin) {
  /* a routing host's answer is served by the host its pin names; any other entry's by its own host */
  const hosts = isObj(entry.pin) && Array.isArray(entry.pin.only) && entry.pin.only.length ? entry.pin.only
    : typeof entry.host === "string" ? [entry.host] : [];
  const expectHost = hosts.length === 1 ? hosts[0] : hosts;
  const ids = Array.isArray(entry.served_ids) ? entry.served_ids : [];
  if (served.host != null ? !hosts.includes(served.host) : hostPin === "required")
    return { field: "host", expected: expectHost, got: served.host };
  if (served.model_version != null ? !ids.includes(served.model_version) : hostPin === "required")
    return { field: "model_version", expected: ids, got: served.model_version };
  return null;
}

/** R25–R54: one turn. Never throws. */
export async function turn(request, deps = {}) {
  const secrets = [];
  try {
    const out = await turnRun(request, deps, secrets);
    return scrubValue(out, secrets);
  } catch (e) {
    return scrubValue(enveloped(silent(e?.message ?? e)), secrets);
  }
}

async function turnRun(req, deps, secrets) {
  const bad = malformed(req);
  const account = isObj(req?.account) ? req.account : null;
  if (account && typeof account.secret === "string" && account.secret) secrets.push(account.secret);
  const env0 = { account, entry_id: typeof req?.entry_id === "string" ? req.entry_id : null };
  if (bad) return enveloped(bad, env0);

  /* the entry, its profile and plan (R25, R37, R42) */
  const entry = await entryFrom(deps.catalogue, req.entry_id);
  if (!entry) return enveloped(refused("ENTRY_UNKNOWN"), env0);
  const env = { account, entry_id: entry.entry_id };
  if (entry.lifecycle === "retired") return enveloped(refused("ENTRY_RETIRED"), env);
  const declared = isObj(req.entry_id);
  const profile = (declared && isObj(req.entry_id.host_profile) ? req.entry_id.host_profile : null) ?? await profileFrom(deps.catalogue, entry);
  const adapters = deps.adapters || ADAPTERS;
  const adapter = adapters[entry.adapter_type];
  if (!profile || !adapter || profile.adapter_type !== entry.adapter_type) return enveloped(refused("ADAPTER_MISSING"), env);
  if ((declared || (profile.id === CUSTOM_PROFILE && !LISTED.includes(entry.lifecycle))) && req.test_flow !== true)
    return enveloped(refused("ENTRY_NOT_LISTED"), env);
  /* R10: the profile's base URL is one of its allowed hosts */
  const allowed = Array.isArray(profile.allowed_hosts) ? profile.allowed_hosts : [];
  if (!allowed.includes(hostOf(profile.base_url))) return enveloped(refused("HOST_NOT_ALLOWED"), env);

  const plan = await planFrom(deps.catalogue, entry, account);
  const meansAllowed = claimValue(plan?.means_allowed);
  if (Array.isArray(meansAllowed) && !meansAllowed.includes(account.means)) return enveloped(refused("MEANS_NOT_ALLOWED"), env);
  const runtimes = claimValue(plan?.constraints?.runtimes ?? plan?.runtimes);
  if (Array.isArray(runtimes) && !runtimes.includes(req.runtime) && account.personal !== true)
    return enveloped(refused("RUNTIME_CONSTRAINT_UNMET", { field: "runtime" }), env);
  if (account.means === "none" && !bindingFor(account, deps)) return enveloped(refused("ACCOUNT_REFERENCE_UNUSABLE"), env);
  if (account.means === "gateway" && !bindingFor(account, deps)) return enveloped(refused("ACCOUNT_REFERENCE_UNUSABLE"), env);

  /* R29–R31, R14: what the entry cannot do is refused by name, nothing sent */
  const caps = capabilitiesOf(entry);
  const control = unsupported(req, caps);
  if (control) return enveloped(refused("UNSUPPORTED_CONTROL", { control }), env);
  const effort = req.effort ?? caps.effort_default ?? null;
  const fullEnv = { ...env, effort };

  /* R28 */
  const events = [];
  const { messages, dropped } = continuations(req.messages, entry);
  if (dropped) events.push({ kind: "continuation_dropped", count: dropped });

  /* R53, R47: the circuit, and the (account, gateway) payer mark */
  if (account.means === "gateway" && await payerFlagged(deps.circuit, account))
    return enveloped(refused("PAYER_NOT_VERIFIED"), { ...fullEnv, events });
  const admit = await circuitAdmit(deps.circuit, account, entry.entry_id, { now: deps.now });
  if (!admit.admit) {
    const cls = admit.class === "auth_failed" ? "auth" : admit.class === "retired" ? "model_gone" : "circuit_open";
    if (admit.class === "payer_unverified") return enveloped(refused("PAYER_NOT_VERIFIED"), { ...fullEnv, events });
    return enveloped(errorOf(cls, admit.retry_at ? { retry_at: admit.retry_at } : {}), { ...fullEnv, events });
  }

  /* R46: the credential, once for the turn */
  const got = await credentialFor(account, deps);
  if (got.fail) {
    if (got.authFailed) {
      await call(deps.credentialFailed, { account_id: account.account_id ?? null, entry_id: entry.entry_id, class: "auth" });
      await circuitRecord(deps.circuit, account, entry.entry_id, "auth", { now: deps.now });
    }
    return enveloped(got.fail, { ...fullEnv, events });
  }
  const cred = got.cred;
  if (cred.secret) secrets.push(cred.secret);

  /* R31, R32, R45: what the adapter is handed */
  const dh = req.data_handling;
  const neutral = {
    messages, tools: req.tools, tool_choice: req.tool_choice, output_schema: req.output_schema, effort, max_output: req.max_output,
    session_key: dh.provider_state === "allowed" && caps.session === "provider_state" && req.session_key ? req.session_key : null,
    cache_hints: caps.caching === "automatic" || caps.caching === "explicit" ? req.cache_hints ?? null : null,
    zero_retention: caps.zero_retention === true && dh.zero_retention !== "off",
    pin: isObj(entry.pin) ? entry.pin : null,
    pin_required: dh.host_pin === "required",
    idempotency_key: req.idempotency_key,
    stream: typeof req.onProgress === "function" && (caps.streaming === "text" || caps.streaming === "tool_calls"),
  };
  let http;
  try { http = adapter.encode(neutral, entry, profile, cred); } catch { http = null; }
  if (!http || http.missing) return enveloped(refused("ADAPTER_MISSING", http?.missing ? { option: String(http.missing) } : {}), { ...fullEnv, events });
  if (!allowed.includes(hostOf(http.url))) return enveloped(refused("HOST_NOT_ALLOWED"), { ...fullEnv, events });
  const requestBytes = utf8.encode(String(http.body ?? "")).length;

  /* R33: progress, never text */
  const progress = (kind) => {
    /* where the entry does not stream, progress is turn-level only */
    if (!neutral.stream && kind !== "turn_started" && kind !== "turn_done") return;
    if (typeof req.onProgress === "function") { try { req.onProgress({ kind }); } catch { /* the caller's */ } }
  };
  const binding = bindingFor(account, deps);
  const transport = binding ? binding.fetch.bind(binding) : (deps.fetch || globalThis.fetch);

  /* R51: the attempts */
  const interactive = req.interactive === true;
  const maxAttempts = interactive ? P.INTERACTIVE_ATTEMPTS : P.RETRY_ATTEMPTS;
  const waitMax = interactive ? P.INTERACTIVE_WAIT_MAX_MS : P.RETRY_AFTER_WAIT_MAX_MS;
  let waited = 0;
  let usage = null;
  let last = null;
  let cls = null;
  progress("turn_started");
  for (let n = 1; n <= maxAttempts; n += 1) {
    const r = await attempt(transport, http, req.timeout_ms, deps, progress);
    const resp = r.fault ? r : { ...r, profile, entry };
    try { cls = adapter.classify(resp); } catch { cls = "malformed"; }
    let dec = null;
    if (!r.fault) { try { dec = adapter.decode(resp); } catch { dec = null; } }
    usage = sumUsage(usage, dec ? usageRecord(dec.stated, { cost_reported: dec.cost_reported }) : blankUsage());
    last = { r, dec };
    if (!RETRIED.includes(cls) || n === maxAttempts) break;
    let wait = backoff(n, deps);
    const ra = dec?.limits?.retry_after;
    if (cls === "rate_limit" && typeof ra === "number" && Number.isFinite(ra)) {
      const ms = ra * 1000;
      if (ms > waitMax) break;
      wait = Math.max(wait, ms);
    }
    if (interactive && waited + wait > P.INTERACTIVE_WAIT_TOTAL_MS) break;
    events.push({ kind: "retry", attempt: n, class: cls });
    waited += wait;
    await sleepOf(deps)(wait);
  }
  progress("turn_done");

  const dec = last.dec;
  const served = dec ? servedOf(dec.served) : NO_SERVED;
  const limits = limitsOf(dec?.limits || {});
  const price = (u) => (u ? { ...u, cost_estimated: costEstimated(u, { entry, plan, profile, requestBytes, maxOutput: req.max_output }) } : u);
  const fin = (outcome) => enveloped(outcome, { ...fullEnv, usage: price(usage), served, limits, events });

  /* R50: the class decides */
  if (cls === null) {
    const outcome = dec?.outcome ?? silent("malformed");
    await circuitRecord(deps.circuit, account, entry.entry_id, null, { now: deps.now });
    if (!outcome.result) return fin(outcome);
    const breach = pinBreach(served, entry, dh.host_pin);
    if (breach) {
      events.push({ kind: "pin_violation", field: breach.field });
      return fin(refused("PRIVACY_PIN_VIOLATION", breach));
    }
    if (account.means === "gateway") {
      const log = await gatewayLog(binding, dec.log_id, deps);
      const payer = payerOf(log, account);
      if (log && isObj(log.cost) && typeof log.cost.amount === "number" && usage && usage.cost_reported == null)
        usage.cost_reported = { amount: log.cost.amount, unit: log.cost.unit ?? "usd", source: "gateway_log" };
      else if (log && typeof log.cost === "number" && usage && usage.cost_reported == null)
        usage.cost_reported = { amount: log.cost, unit: "usd", source: "gateway_log" };
      if (!dec.log_id) {
        await flagPayer(deps.circuit, account);
        await circuitRecord(deps.circuit, account, entry.entry_id, "payer_unverified", { now: deps.now });
        await call(deps.gatewayServed, { gateway_id: account.gateway_id, own_key_served: false, platform_credits_used: null });
        events.push({ kind: "payer_unverified" });
        return fin(refused("PAYER_NOT_VERIFIED"));
      }
      if (!payer.verified) {
        await flagPayer(deps.circuit, account);
        await circuitRecord(deps.circuit, account, entry.entry_id, "payer_unverified", { now: deps.now });
        await call(deps.gatewayServed, { gateway_id: account.gateway_id, own_key_served: payer.own_key_served,
          platform_credits_used: payer.platform_credits_used });
        events.push({ kind: "payer_unverified" });
      }
    }
    return fin(outcome);
  }
  if (cls === "content_refusal") {
    const o = dec?.outcome?.refused ? dec.outcome : refused("refusal", { message: "" });
    return fin(o);
  }
  if (cls === "provider_limit") {
    const l = dec?.limit || { kind: "spend", scope: "account", resets_at: null };
    return fin(limitOf(l.kind, l.scope, l.resets_at));
  }
  if (cls === "malformed") return fin(silent(last.r.fault ? (last.r.message ?? "malformed") : "malformed"));
  const status = last.r.status ?? null;
  const message = cutMessage(dec?.message ?? "");
  if (COUNTED.includes(cls)) {
    const state = await circuitRecord(deps.circuit, account, entry.entry_id, cls, { now: deps.now });
    if (state === "open") events.push({ kind: "circuit", state });
    const ra = dec?.limits?.retry_after;
    return fin(errorOf(cls, { status, message, ...(cls === "rate_limit" && typeof ra === "number" ? { retry_after: ra } : {}) }));
  }
  if (cls === "auth") {
    await circuitRecord(deps.circuit, account, entry.entry_id, "auth", { now: deps.now });
    await call(deps.credentialFailed, { account_id: account.account_id ?? null, entry_id: entry.entry_id, class: "auth" });
    return fin(errorOf("auth", { status, message }));
  }
  if (cls === "model_gone") {
    await circuitRecord(deps.circuit, account, entry.entry_id, "model_gone", { now: deps.now });
    events.push({ kind: "model_gone", entry_id: entry.entry_id });
    return fin(errorOf("model_gone", { status, message }));
  }
  return fin(errorOf("request_rejected", { status, message }));
}

export { cutDetail };
