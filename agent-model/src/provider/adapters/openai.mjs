/* agent-model (T53, R38–R42) — THE GENERIC OPENAI-COMPATIBLE ADAPTER: one adapter for every host of that shape, each
 * host described by its host profile (catalogue data, `ai-catalogue` R53).
 *
 * The profile names the base URL and allowed hosts, the auth style (`bearer`, `header:<name>`, `binding`, `none`), the
 * field mappings both ways (`mappings`), the pin (`pin_map`), where the served host and model are reported
 * (`served_report`), whether the host honours an idempotency key, and its quirks from the closed set this adapter
 * implements. A mapping key or quirk this adapter does not know is answered `{missing}` by `encode`, which the module
 * refuses `ADAPTER_MISSING` (R37). The profiles `openrouter`, `workers_ai`, `ai_gateway` and `custom` are data only:
 * nothing here branches on a profile's id. */

import { sseFrames, isStream } from "./sse.mjs";
import { pathRead } from "../neutral.mjs";

export const ADAPTER_TYPE = "openai_compatible";
/** The quirks this adapter implements (R38's closed set). */
export const QUIRKS = Object.freeze(["return_reasoning_unchanged"]);
/** The mapping options this adapter reads; a profile naming another is one this copy lacks. */
export const MAPPING_KEYS = Object.freeze(["path", "model_field", "max_output_field", "effort_field", "session_field",
  "state_flag", "zero_retention", "usage", "cost", "cost_unit", "text", "tool_calls", "stop_field", "refusal", "reasoning",
  "stop", "limit_codes", "limit_statuses", "request_id_header", "log_id_header", "schema_field"]);

const DEFAULTS = Object.freeze({
  path: "/chat/completions", model_field: "model", max_output_field: "max_tokens", effort_field: "reasoning_effort",
  text: "choices.0.message.content", tool_calls: "choices.0.message.tool_calls", stop_field: "choices.0.finish_reason",
  refusal: "choices.0.message.refusal", reasoning: "choices.0.message.reasoning_details", cost: "usage.cost",
  cost_unit: "usd", request_id_header: "x-request-id", log_id_header: "cf-aig-log-id", schema_field: "response_format",
  usage: Object.freeze({ input_tokens: "usage.prompt_tokens", output_tokens: "usage.completion_tokens",
    cache_read_input_tokens: "usage.prompt_tokens_details.cached_tokens", cache_creation_input_tokens: null,
    reasoning_tokens: "usage.completion_tokens_details.reasoning_tokens" }),
  stop: Object.freeze({ stop: "end", tool_calls: "tool_call", length: "length", content_filter: "filtered" }),
  limit_codes: Object.freeze({}),
  limit_statuses: Object.freeze({ 402: "spend" }),
});

const mapOf = (profile) => {
  const m = profile && profile.mappings && typeof profile.mappings === "object" ? profile.mappings : {};
  return { ...DEFAULTS, ...m, usage: { ...DEFAULTS.usage, ...(m.usage || {}) }, stop: { ...DEFAULTS.stop, ...(m.stop || {}) },
    limit_codes: { ...DEFAULTS.limit_codes, ...(m.limit_codes || {}) }, limit_statuses: { ...DEFAULTS.limit_statuses, ...(m.limit_statuses || {}) } };
};
const textOf = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? null));
const quirk = (profile, q) => Array.isArray(profile?.quirks) && profile.quirks.includes(q);

/** What this adapter lacks to serve `profile`, or null. */
export function lacking(profile) {
  for (const q of Array.isArray(profile?.quirks) ? profile.quirks : []) if (!QUIRKS.includes(q)) return `quirk:${q}`;
  for (const k of Object.keys(profile?.mappings || {})) if (!MAPPING_KEYS.includes(k)) return `mapping:${k}`;
  return null;
}

/* ------------------------------------------------------------------ encode */

function part(b) {
  if (!b || typeof b !== "object") return { type: "text", text: textOf(b) };
  if (b.type === "image") return { type: "image_url", image_url: { url: `data:${b.media_type};base64,${b.data}` } };
  if (b.type === "search_result")
    return { type: "text", text: JSON.stringify({ source: b.source, title: b.title,
      content: (Array.isArray(b.content) ? b.content : [b.content]).map((c) => textOf(c?.text ?? c)).join("\n") }) };
  return { type: "text", text: textOf(b.text) };
}
const parts = (content) => (Array.isArray(content) ? content.map(part) : textOf(content ?? ""));
const joinText = (content) => (Array.isArray(content) ? content.map((b) => textOf(b?.text ?? b)).join("\n") : textOf(content ?? ""));

function transcript(messages, entry, profile) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "system") out.push({ role: "system", content: joinText(m.content) });
    else if (m.role === "user") out.push({ role: "user", content: parts(m.content) });
    else if (m.role === "assistant") {
      const a = { role: "assistant", content: m.content == null ? null : joinText(m.content) };
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      if (calls.length) a.tool_calls = calls.map((t) => ({ id: t.id, type: "function",
        function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) } }));
      const c = m.continuation;
      if (quirk(profile, "return_reasoning_unchanged") && c && c.adapter === ADAPTER_TYPE && c.entry_id === entry.entry_id)
        a.reasoning_details = c.data;
      out.push(a);
    } else if (m.role === "tool_result") {
      const content = Array.isArray(m.content) && m.content.some((b) => b && b.type === "image") ? parts(m.content) : joinText(m.content);
      out.push({ role: "tool", tool_call_id: m.tool_call_id, content });
    }
  }
  return out;
}

function toolChoice(tc) {
  if (tc == null) return undefined;
  if (tc === "auto" || tc === "none") return tc;
  if (tc === "any" || tc === "required") return "required";
  if (typeof tc === "object" && typeof tc.name === "string") return { type: "function", function: { name: tc.name } };
  return undefined;
}

/** R39, R45: the pin in the profile's `pin_map` shape: `{field, <pin key>: name | {field, value}}`. */
function pinBody(pin, pinMap) {
  const out = {};
  for (const [k, spec] of Object.entries(pinMap)) {
    if (k === "field" || pin[k] === undefined) continue;
    if (typeof spec === "string") out[spec] = pin[k];
    else if (spec && typeof spec === "object" && typeof spec.field === "string") { if (pin[k] === true) out[spec.field] = spec.value; }
  }
  return out;
}

function auth(profile, credential) {
  const secret = credential && typeof credential.secret === "string" ? credential.secret : null;
  /* R41: under `gateway` (and `none`) no provider key header is sent: the gateway adds its stored key only when the
     authorization header is absent. */
  if (!secret || credential.means === "gateway" || credential.means === "none") return {};
  const style = String(profile?.auth_style ?? "");
  if (style === "bearer") return { authorization: `Bearer ${secret}` };
  if (style.startsWith("header:")) return { [style.slice(7).toLowerCase()]: secret };
  return {};
}

const idempotencyHeader = (profile) => {
  const i = profile?.idempotency;
  if (i === "honoured") return "idempotency-key";
  if (i && typeof i === "object" && i.state === "honoured") return typeof i.header === "string" ? i.header : "idempotency-key";
  return null;
};

/** R37 encode. */
export function encode(neutral, entry, profile, credential) {
  const lack = lacking(profile);
  if (lack) return { missing: lack };
  const m = mapOf(profile);
  const body = { [m.model_field]: entry.model, messages: transcript(neutral.messages, entry, profile), [m.max_output_field]: neutral.max_output };
  if (Array.isArray(neutral.tools) && neutral.tools.length)
    body.tools = neutral.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const tc = toolChoice(neutral.tool_choice);
  if (tc) body.tool_choice = tc;
  if (neutral.output_schema) body[m.schema_field] = { type: "json_schema", json_schema: { name: "output", schema: neutral.output_schema, strict: true } };
  if (neutral.effort) body[m.effort_field] = neutral.effort;
  if (neutral.stream) { body.stream = true; body.stream_options = { include_usage: true }; }
  if (neutral.session_key) {
    if (typeof m.session_field !== "string") return { missing: "session" };
    body[m.session_field] = neutral.session_key;
    if (m.state_flag && typeof m.state_flag === "object") Object.assign(body, m.state_flag);
  }
  if (neutral.pin) {
    const pm = profile.pin_map;
    if (pm && typeof pm === "object" && typeof pm.field === "string") body[pm.field] = pinBody(neutral.pin, pm);
    else if (neutral.pin_required) return { missing: "pin_map" };
  }
  if (neutral.zero_retention && !neutral.pin) {
    if (!m.zero_retention || typeof m.zero_retention !== "object") return { missing: "zero_retention" };
    Object.assign(body, m.zero_retention);
  }
  const headers = { "content-type": "application/json", ...auth(profile, credential) };
  const ih = idempotencyHeader(profile);
  if (ih && neutral.idempotency_key) headers[ih] = neutral.idempotency_key;
  const base = String(profile.base_url).replace(/\/$/, "");
  return { url: base + m.path, method: "POST", headers, body: JSON.stringify(body) };
}

/* ------------------------------------------------------------------ decode */

function assemble(frames) {
  let first = null;
  let content = "";
  let finish = null;
  let usage = null;
  let reasoning = null;
  const calls = [];
  for (const { data } of frames) {
    if (!data || typeof data !== "object") continue;
    first = first || data;
    if (data.usage) usage = data.usage;
    const ch = Array.isArray(data.choices) ? data.choices[0] : null;
    if (!ch) continue;
    const d = ch.delta || {};
    if (typeof d.content === "string") content += d.content;
    if (Array.isArray(d.reasoning_details)) reasoning = [...(reasoning || []), ...d.reasoning_details];
    for (const t of Array.isArray(d.tool_calls) ? d.tool_calls : []) {
      const c = calls[t.index ?? 0] || (calls[t.index ?? 0] = { id: null, type: "function", function: { name: "", arguments: "" } });
      if (t.id) c.id = t.id;
      if (t.function?.name) c.function.name += t.function.name;
      if (t.function?.arguments) c.function.arguments += t.function.arguments;
    }
    if (ch.finish_reason) finish = ch.finish_reason;
  }
  if (!first) return null;
  const message = { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}), ...(reasoning ? { reasoning_details: reasoning } : {}) };
  return { ...first, choices: [{ index: 0, message, finish_reason: finish }], usage };
}

const bodyOf = (r) => {
  if (isStream(r.headers || {})) return assemble(sseFrames(r.text));
  try { return JSON.parse(r.text); } catch { return null; }
};
const str = (v) => (typeof v === "string" && v ? v : null);

function servedFrom(body, headers, profile, m) {
  const rep = profile?.served_report && typeof profile.served_report === "object" ? profile.served_report : {};
  const host = str(rep.host_header ? headers[String(rep.host_header).toLowerCase()] : pathRead(body, rep.host));
  return { provider: str(pathRead(body, rep.provider)), host, model_version: str(pathRead(body, rep.model ?? "model")),
    request_id: str(headers[String(m.request_id_header).toLowerCase()]) ?? str(body?.id), fingerprint: str(body?.system_fingerprint) };
}

const errorCode = (body) => str(body?.error?.code) ?? str(body?.error?.type) ?? (typeof body?.error?.code === "number" ? String(body.error.code) : null);

/** R37 decode. */
export function decode(response) {
  const { status, headers = {}, profile, entry } = response;
  const m = mapOf(profile);
  const body = bodyOf(response);
  const stated = {};
  for (const [k, p] of Object.entries(m.usage)) stated[k] = p ? pathRead(body, p) : undefined;
  const amount = pathRead(body, m.cost);
  const ra = Number(headers["retry-after"]);
  const out = { stated, cost_reported: typeof amount === "number" && Number.isFinite(amount) ? { amount, unit: m.cost_unit, source: "provider" } : null,
    served: servedFrom(body, headers, profile, m),
    limits: { remaining: headers["x-ratelimit-remaining-requests"] != null ? Number(headers["x-ratelimit-remaining-requests"]) : null,
      reset_at: str(headers["x-ratelimit-reset-requests"]), retry_after: headers["retry-after"] != null && Number.isFinite(ra) ? ra : null },
    message: str(body?.error?.message) ?? "", log_id: str(headers[String(m.log_id_header).toLowerCase()]), body };
  if (status !== 200) {
    const kind = m.limit_codes[errorCode(body)] ?? m.limit_statuses[String(status)];
    if (kind) out.limit = { kind, scope: kind === "spend" || kind === "plan_window" ? "account" : "entry",
      resets_at: str(headers["x-ratelimit-reset-requests"]) ?? str(body?.error?.resets_at) };
    return out;
  }
  if (!body || typeof body !== "object") return out;
  const refusal = pathRead(body, m.refusal);
  if (typeof refusal === "string" && refusal) { out.outcome = { refused: { type: "refusal", message: refusal } }; return out; }
  const stop = m.stop[pathRead(body, m.stop_field)];
  if (!stop) { out.outcome = { silent: { detail: "stop_unmapped" } }; return out; }
  if (stop === "refusal" || stop === "filtered") {
    out.outcome = { refused: { type: stop, message: textOf(pathRead(body, m.text) ?? "") } };
    return out;
  }
  const calls = pathRead(body, m.tool_calls);
  const reasoning = pathRead(body, m.reasoning);
  out.outcome = { result: {
    text: typeof pathRead(body, m.text) === "string" ? pathRead(body, m.text) : "",
    tool_calls: (Array.isArray(calls) ? calls : []).map((t) => {
      let input = {};
      try { input = typeof t.function?.arguments === "string" ? JSON.parse(t.function.arguments || "{}") : (t.function?.arguments ?? {}); } catch { input = {}; }
      return { id: t.id, name: t.function?.name, input };
    }),
    stop,
    continuation: quirk(profile, "return_reasoning_unchanged") && reasoning != null
      ? { adapter: ADAPTER_TYPE, entry_id: entry.entry_id, data: reasoning } : null,
  } };
  return out;
}

/* ------------------------------------------------------------------ classify */

/** R37, R50 classify. */
export function classify(r) {
  if (!r || r.fault) return r && r.fault === "timeout" ? "timeout" : "malformed";
  const m = mapOf(r.profile);
  const body = bodyOf(r);
  const { status } = r;
  if (status === 200) {
    if (!body || typeof body !== "object" || pathRead(body, m.stop_field) === undefined) return "malformed";
    const refusal = pathRead(body, m.refusal);
    if (typeof refusal === "string" && refusal) return "content_refusal";
    const stop = m.stop[pathRead(body, m.stop_field)];
    return stop === "refusal" || stop === "filtered" ? "content_refusal" : null;
  }
  if (m.limit_codes[errorCode(body)] || m.limit_statuses[String(status)]) return "provider_limit";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status === 404 || status === 410) return "model_gone";
  if (status === 408) return "timeout";
  if (status >= 500) return "overload";
  return "request_rejected";
}

export const openaiAdapter = Object.freeze({ adapter_type: ADAPTER_TYPE, encode, decode, classify });
