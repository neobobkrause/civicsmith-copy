/* agent-model (T53) — THE NEUTRAL SHAPES every adapter answers in: usage (R5, R54), outcomes and their envelope (R26),
 * the closed sets (R27, R29, R50), and the secret scrub (R8, R49). Nothing here names a provider. */

import { DETAIL_CHARS_MAX, PROVIDER_MESSAGE_CHARS_MAX, SECRET_SUBSTRING_MIN } from "./params.mjs";

/** R5: the token figures of the neutral usage record, each the provider's number or `null`. */
export const TOKEN_FIGURES = Object.freeze(["input_tokens", "output_tokens", "cache_read_input_tokens",
  "cache_creation_input_tokens", "reasoning_tokens"]);
/** R27: the neutral stop reasons. */
export const STOPS = Object.freeze(["end", "tool_call", "length", "refusal", "filtered"]);
/** R29: the controls a request may be refused by name for. */
export const CONTROLS = Object.freeze(["tools", "parallel_tools", "schema_output", "schema_with_tools", "image_input",
  "streaming", "session", "cache_hints", "zero_retention", "effort", "effort_value"]);
/** R50: the error classes. */
export const CLASSES = Object.freeze(["rate_limit", "provider_limit", "overload", "timeout", "auth", "model_gone",
  "content_refusal", "malformed", "pin_violation", "unsupported_control", "request_rejected", "circuit_open"]);
/** R26 (and R50's `model_gone`): the event kinds; an event holds a kind, names and counts, never text. */
export const EVENT_KINDS = Object.freeze(["retry", "circuit", "pin_violation", "payer_unverified", "continuation_dropped",
  "model_gone"]);
/** R33: the progress kinds. */
export const PROGRESS_KINDS = Object.freeze(["reading", "composing", "checking", "turn_started", "turn_done"]);

const finite = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** R5: the neutral usage record from the figures an adapter read (`stated`: a figure → a number, or absent), the
 *  money the provider reported (or null), and `calls`. A figure not stated is `null` and named in `unstated`. */
export function usageRecord(stated = {}, { cost_reported = null, calls = 1 } = {}) {
  const u = {};
  const unstated = [];
  for (const k of TOKEN_FIGURES) {
    u[k] = finite(stated?.[k]);
    if (u[k] == null) unstated.push(k);
  }
  return { ...u, calls, cost_reported: cost_reported ?? null, cost_estimated: null, unstated };
}

/** R54: an attempt that reached the provider but left no figures (it timed out): every figure null, one call. */
export const blankUsage = () => usageRecord({}, { calls: 1 });

const addMoney = (a, b) => {
  if (a == null || b == null) return null;
  if (a.unit !== b.unit) return null;
  return { ...a, amount: a.amount + b.amount };
};

/** R54, R6: two usage records summed: a figure null in either stays null; `calls` add; money adds only in one unit. */
export function sumUsage(a, b) {
  if (!a) return b ? { ...b, unstated: [...b.unstated] } : null;
  if (!b) return { ...a, unstated: [...a.unstated] };
  const out = {};
  for (const k of TOKEN_FIGURES) out[k] = a[k] == null || b[k] == null ? null : a[k] + b[k];
  out.calls = (a.calls ?? 0) + (b.calls ?? 0);
  out.cost_reported = addMoney(a.cost_reported, b.cost_reported);
  out.cost_estimated = addMoney(a.cost_estimated, b.cost_estimated);
  out.unstated = TOKEN_FIGURES.filter((k) => out[k] == null);
  return out;
}

/* ------------------------------------------------------------------ SECRETS (R8, R49) */

const REDACTED = "[secret]";

/** R49: `text` with every copy of each secret, and every substring of one of `SECRET_SUBSTRING_MIN` or more
 *  characters, removed. A secret shorter than the bound is removed whole. */
export function scrubText(text, secrets) {
  let s = String(text ?? "");
  for (const secret of secrets) {
    if (typeof secret !== "string" || !secret) continue;
    s = s.split(secret).join(REDACTED);
    if (secret.length <= SECRET_SUBSTRING_MIN) continue;
    for (let i = 0; i + SECRET_SUBSTRING_MIN <= secret.length; i += 1) {
      const w = secret.slice(i, i + SECRET_SUBSTRING_MIN);
      if (s.includes(w)) s = s.split(w).join(REDACTED);
    }
  }
  return s;
}

/** R8, R49: a value with every string in it scrubbed; keys too. The same value back when it holds no secret. */
export function scrubValue(value, secrets) {
  const list = (secrets || []).filter((x) => typeof x === "string" && x);
  if (!list.length) return value;
  const walk = (v) => {
    if (typeof v === "string") return scrubText(v, list);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [scrubText(k, list), walk(x)]));
    return v;
  };
  return walk(value);
}

export const cutDetail = (text) => String(text ?? "").slice(0, DETAIL_CHARS_MAX);
export const cutMessage = (text) => String(text ?? "").slice(0, PROVIDER_MESSAGE_CHARS_MAX);

/* ------------------------------------------------------------------ OUTCOMES (R3, R26, R50, R52) */

export const result = (r) => ({ result: r });
export const silent = (detail) => ({ silent: { detail: cutDetail(detail) } });
export const refused = (type, fields = {}) => ({ refused: { type, ...fields } });
export const errorOf = (cls, fields = {}) => ({ error: { class: cls, ...fields } });
export const limitOf = (kind, scope, resets_at) => ({ limit: { kind, scope, resets_at: resets_at ?? null } });

/** R26: a served identity, each field null where the provider stated none. */
export function servedOf(s = {}) {
  const v = (x) => (typeof x === "string" && x ? x : null);
  return { provider: v(s.provider), host: v(s.host), model_version: v(s.model_version), request_id: v(s.request_id),
    fingerprint: v(s.fingerprint) };
}
export const NO_SERVED = Object.freeze(servedOf());

/** R26: rate-limit figures, null where not given. */
export function limitsOf(l = {}) {
  const n = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const s = (x) => (typeof x === "string" && x ? x : null);
  return { remaining: n(l.remaining), reset_at: s(l.reset_at), retry_after: n(l.retry_after) };
}

/** R26, BR29: the one label a machine result carries. */
export function labelOf(served, effort, account) {
  return { provider: served.provider, host: served.host, model_version: served.model_version, effort: effort ?? null,
    account_level: account && typeof account.level === "string" ? account.level : null,
    owner: account && typeof account.owner === "string" ? account.owner : null };
}

/** R26: an outcome with its envelope. */
export function enveloped(outcome, { usage = null, served = NO_SERVED, effort = null, account = null, limits = null,
  events = [], entry_id = null } = {}) {
  return { ...outcome, usage, served, label: labelOf(served, effort, account), limits: limits ?? limitsOf(),
    events, entry_id: typeof entry_id === "string" ? entry_id : null };
}

/* ------------------------------------------------------------------ CLAIMS (the catalogue's `{value, ev}`, OPEN) */

/** A catalogue claim's value: `{value}` gives it, OPEN or absent gives null; a bare value is itself. */
export function claimValue(c) {
  if (c === undefined || c === null) return null;
  if (typeof c === "object" && !Array.isArray(c)) {
    if (c.open === true) return null;
    if ("value" in c) return c.value ?? null;
  }
  return c;
}

/** A dotted path read: `"a.b.0.c"` from an object; undefined where any step is missing. */
export function pathRead(obj, path) {
  if (typeof path !== "string" || !path) return undefined;
  let v = obj;
  for (const p of path.split(".")) {
    if (v == null || typeof v !== "object") return undefined;
    v = v[p];
  }
  return v;
}
