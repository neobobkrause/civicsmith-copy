/* agent-model (T53, R43) — THE ANTHROPIC ADAPTER: the Messages API behind R37's contract.
 *
 * `{adapter_type, encode, decode, classify}` and nothing else (R37): no policy, no retry, no retention. It carries
 * the API-key path of R2 (the secret in the header the host profile names, today `x-api-key`, and nowhere else), the
 * caching marks of R4 at the neutral `cache_hints` boundary, and the held-token route of R16 (an `issued` secret sent
 * the same way, only in this one request). Record text reaches the model only in a `tool_result` block (R12, R14).
 *
 * The host, path, version header and stop table are the profile's (`mappings`); the defaults below are the API's own
 * names, used only where the profile leaves one out. */

import { sseFrames, isStream } from "./sse.mjs";

export const ADAPTER_TYPE = "anthropic_messages";
const DEFAULT_PATH = "/messages";
const DEFAULT_VERSION = "2023-06-01";
/* R27: the API's stop reasons in the neutral set; a reason not here (nor in the profile's table) is unmapped. */
const DEFAULT_STOP = Object.freeze({ end_turn: "end", stop_sequence: "end", tool_use: "tool_call", max_tokens: "length",
  refusal: "refusal" });
/* R52: the error types that are a provider-side limit, by kind. */
const DEFAULT_LIMITS = Object.freeze({ enforced_spend_limit_reached: "spend" });
const EPHEMERAL = Object.freeze({ type: "ephemeral" });

const mapOf = (profile) => (profile && profile.mappings && typeof profile.mappings === "object" ? profile.mappings : {});
const textOf = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? null));

/* ------------------------------------------------------------------ encode */

function block(b) {
  if (!b || typeof b !== "object") return { type: "text", text: textOf(b) };
  if (b.type === "image") return { type: "image", source: { type: "base64", media_type: b.media_type, data: b.data } };
  if (b.type === "search_result")
    return { type: "search_result", source: String(b.source ?? ""), title: String(b.title ?? ""),
      content: (Array.isArray(b.content) ? b.content : [b.content]).map((c) => ({ type: "text", text: textOf(c?.text ?? c) })),
      citations: { enabled: true } };
  return { type: "text", text: textOf(b.text) };
}
const blocks = (content) => (Array.isArray(content) ? content.map(block) : [{ type: "text", text: textOf(content ?? "") }]);

/** The neutral transcript as the API's `system` and `messages`. Adjacent tool results go in one `user` turn. */
function transcript(messages, entry) {
  const system = [];
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "system") { system.push(...blocks(m.content)); continue; }
    if (m.role === "user") { out.push({ role: "user", content: blocks(m.content) }); continue; }
    if (m.role === "assistant") {
      const content = [];
      const c = m.continuation;
      if (c && c.adapter === ADAPTER_TYPE && c.entry_id === entry.entry_id && Array.isArray(c.data)) content.push(...c.data);
      if (m.content != null && m.content !== "") content.push(...blocks(m.content).filter((b) => b.type !== "text" || b.text));
      for (const t of Array.isArray(m.tool_calls) ? m.tool_calls : [])
        content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input ?? {} });
      out.push({ role: "assistant", content });
      continue;
    }
    if (m.role === "tool_result") {
      const r = { type: "tool_result", tool_use_id: m.tool_call_id, content: blocks(m.content), ...(m.is_error ? { is_error: true } : {}) };
      const last = out[out.length - 1];
      if (last && last.role === "user" && last.content.every((b) => b.type === "tool_result")) last.content.push(r);
      else out.push({ role: "user", content: [r] });
    }
  }
  return { system, messages: out };
}

function toolChoice(tc) {
  if (tc == null) return undefined;
  if (tc === "auto") return { type: "auto" };
  if (tc === "any" || tc === "required") return { type: "any" };
  if (tc === "none") return { type: "none" };
  if (typeof tc === "object" && typeof tc.name === "string") return { type: "tool", name: tc.name };
  return undefined;
}

const mark = (b) => ({ ...b, cache_control: EPHEMERAL });

/** R4: the prefix marks at the hint's boundary: the last tool, the system prompt's last block, and the last block of
 *  the message before `boundary` (the skill pack's resident layer ends there). With no hint, none. */
function cached(body, hints) {
  if (!hints || typeof hints !== "object") return body;
  const out = { ...body };
  if (Array.isArray(out.tools) && out.tools.length) {
    out.tools = out.tools.slice();
    out.tools[out.tools.length - 1] = mark(out.tools[out.tools.length - 1]);
  }
  if (Array.isArray(out.system) && out.system.length) {
    out.system = out.system.slice();
    out.system[out.system.length - 1] = mark(out.system[out.system.length - 1]);
  }
  const at = Number.isInteger(hints.boundary) ? Math.min(hints.boundary, out.messages.length) - 1 : -1;
  if (at >= 0) {
    out.messages = out.messages.slice();
    const m = out.messages[at];
    const c = m.content.slice();
    if (c.length) c[c.length - 1] = mark(c[c.length - 1]);
    out.messages[at] = { ...m, content: c };
  }
  return out;
}

const idempotencyHeader = (profile) => {
  const i = profile?.idempotency;
  if (i === "honoured") return "idempotency-key";
  if (i && typeof i === "object" && i.state === "honoured") return typeof i.header === "string" ? i.header : "idempotency-key";
  return null;
};

function authHeaders(profile, credential) {
  const secret = credential && typeof credential.secret === "string" ? credential.secret : null;
  if (!secret) return {};
  const style = String(profile?.auth_style ?? "");
  if (style === "bearer") return { authorization: `Bearer ${secret}` };
  if (style.startsWith("header:")) return { [style.slice(7).toLowerCase()]: secret };
  return {};
}

/** R37 encode: the neutral request as one HTTP request. */
export function encode(neutral, entry, profile, credential) {
  const m = mapOf(profile);
  const { system, messages } = transcript(neutral.messages, entry);
  let body = { model: entry.model, max_tokens: neutral.max_output, messages };
  if (system.length) body.system = system;
  if (Array.isArray(neutral.tools) && neutral.tools.length)
    body.tools = neutral.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const tc = toolChoice(neutral.tool_choice);
  if (tc) body.tool_choice = tc;
  if (neutral.output_schema) body.output_format = { type: "json_schema", schema: neutral.output_schema };
  if (neutral.effort) body.output_config = { effort: neutral.effort };
  if (neutral.stream) body.stream = true;
  body = cached(body, neutral.cache_hints);
  const headers = { "content-type": "application/json", "anthropic-version": typeof m.api_version === "string" ? m.api_version : DEFAULT_VERSION,
    ...authHeaders(profile, credential) };
  const ih = idempotencyHeader(profile);
  if (ih && neutral.idempotency_key) headers[ih] = neutral.idempotency_key;
  const base = String(profile.base_url).replace(/\/$/, "");
  return { url: base + (typeof m.path === "string" ? m.path : DEFAULT_PATH), method: "POST", headers, body: JSON.stringify(body) };
}

/* ------------------------------------------------------------------ decode */

/** A stream's frames as the non-streamed answer. */
function assemble(frames) {
  let msg = null;
  const content = [];
  for (const { data } of frames) {
    if (!data || typeof data !== "object") continue;
    if (data.type === "message_start") msg = { ...data.message, content };
    else if (data.type === "content_block_start") content[data.index] = { ...data.content_block, _json: "" };
    else if (data.type === "content_block_delta") {
      const b = content[data.index];
      const d = data.delta || {};
      if (!b) continue;
      if (d.type === "text_delta") b.text = (b.text || "") + d.text;
      else if (d.type === "input_json_delta") b._json += d.partial_json || "";
      else if (d.type === "thinking_delta") b.thinking = (b.thinking || "") + d.thinking;
      else if (d.type === "signature_delta") b.signature = (b.signature || "") + d.signature;
    } else if (data.type === "message_delta") {
      msg = msg || { content };
      msg.stop_reason = data.delta?.stop_reason ?? msg.stop_reason;
      msg.usage = { ...(msg.usage || {}), ...(data.usage || {}) };
    } else if (data.type === "error") return { type: "error", error: data.error };
  }
  for (const b of content) {
    if (!b) continue;
    if (b.type === "tool_use") { try { b.input = b._json ? JSON.parse(b._json) : (b.input ?? {}); } catch { b.input = {}; } }
    delete b._json;
  }
  return msg;
}

function figures(u) {
  if (!u || typeof u !== "object") return {};
  return { input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read_input_tokens: u.cache_read_input_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens, reasoning_tokens: u.reasoning_tokens };
}

function limitsFrom(h) {
  const n = (x) => (x == null || x === "" ? null : Number(x));
  const ra = n(h["retry-after"]);
  return { remaining: n(h["anthropic-ratelimit-requests-remaining"]), reset_at: h["anthropic-ratelimit-requests-reset"] ?? null,
    retry_after: Number.isFinite(ra) ? ra : null };
}

/** R37 decode: one HTTP response as `{outcome?, stated, cost_reported, served, limits, message, limit?}`. */
export function decode(response) {
  const { status, headers = {}, text, profile, entry } = response;
  const m = mapOf(profile);
  let body = null;
  if (isStream(headers)) body = assemble(sseFrames(text));
  else { try { body = JSON.parse(text); } catch { body = null; } }
  const served = { provider: null, host: null, model_version: body && typeof body.model === "string" ? body.model : null,
    request_id: headers["request-id"] ?? (body && typeof body.id === "string" ? body.id : null), fingerprint: null };
  const out = { stated: figures(body?.usage), cost_reported: null, served, limits: limitsFrom(headers),
    message: body?.error?.message ?? "", body };
  if (status !== 200) {
    const kind = { ...DEFAULT_LIMITS, ...(m.limit_codes || {}) }[body?.error?.type];
    if (kind) out.limit = { kind, scope: kind === "spend" || kind === "plan_window" ? "account" : "entry",
      resets_at: headers["anthropic-ratelimit-tokens-reset"] ?? headers["anthropic-ratelimit-requests-reset"] ?? null };
    return out;
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.content)) return out;
  const table = { ...DEFAULT_STOP, ...(m.stop || {}) };
  const stop = table[body.stop_reason];
  if (!stop) { out.outcome = { silent: { detail: "stop_unmapped" } }; return out; }
  if (stop === "refusal" || stop === "filtered") {
    out.outcome = { refused: { type: stop, message: String(body?.stop_details?.explanation ?? textAll(body.content)) } };
    return out;
  }
  const thinking = body.content.filter((b) => b && (b.type === "thinking" || b.type === "redacted_thinking"));
  out.outcome = { result: {
    text: textAll(body.content),
    tool_calls: body.content.filter((b) => b && b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} })),
    stop,
    continuation: thinking.length ? { adapter: ADAPTER_TYPE, entry_id: entry.entry_id, data: thinking } : null,
  } };
  return out;
}
const textAll = (content) => content.filter((b) => b && b.type === "text").map((b) => String(b.text ?? "")).join("");

/* ------------------------------------------------------------------ classify */

/** R37, R50 classify: a response or a fault as one error class, or null for an answer. */
export function classify(r) {
  if (!r || r.fault) return r && r.fault === "timeout" ? "timeout" : "malformed";
  const { status, text, headers = {}, profile } = r;
  const m = mapOf(profile);
  let body = null;
  if (isStream(headers)) body = assemble(sseFrames(text));
  else { try { body = JSON.parse(text); } catch { body = null; } }
  if (status === 200) {
    if (!body || typeof body !== "object" || body.type === "error" || !Array.isArray(body.content)) return "malformed";
    const stop = { ...DEFAULT_STOP, ...(m.stop || {}) }[body.stop_reason];
    return stop === "refusal" || stop === "filtered" ? "content_refusal" : null;
  }
  const type = body?.error?.type;
  if ({ ...DEFAULT_LIMITS, ...(m.limit_codes || {}) }[type]) return "provider_limit";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403 || type === "authentication_error" || type === "permission_error") return "auth";
  if (status === 404 || type === "not_found_error") return "model_gone";
  if (status === 408) return "timeout";
  if (status >= 500) return "overload";
  return "request_rejected";
}

export const anthropicAdapter = Object.freeze({ adapter_type: ADAPTER_TYPE, encode, decode, classify });
