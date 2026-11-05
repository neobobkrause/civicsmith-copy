/* ai-gate — characterization records (R41, R43–R45, R47, R48). A property not measured is OPEN, never inferred.
 * Pure; never throws. */
import { GATE_PARAMS, GRADES, deepFreeze, refuse, isObj, isNonBlank, isInstant, isCount } from "./params.mjs";
import { wilson } from "./verdict.mjs";

const CONDITIONS = ["endpoint", "window", "adapter_version", "profile_version", "model_version", "subject", "suiteVersions"];

/** R41 — a characterization record `{property, value, method, samples, conditions, ev}`; every condition is stated
 *  (the region or endpoint, the UTC window, adapter, profile and model versions, the entry id or declared plan, the
 *  four suite versions). With no samples the value reads OPEN. */
export function charRecord({ property, value, method, samples, conditions, ev } = {}) {
  if (!isNonBlank(property) || !isNonBlank(method)) return refuse("GATE_CHAR_INVALID", { field: "property" });
  if (!isObj(conditions)) return refuse("GATE_CHAR_CONDITION_MISSING", { condition: "conditions" });
  for (const c of CONDITIONS) if (conditions[c] == null || conditions[c] === "")
    return refuse("GATE_CHAR_CONDITION_MISSING", { condition: c });
  if (!isObj(conditions.window) || !isInstant(conditions.window.from) || !isInstant(conditions.window.to))
    return refuse("GATE_CHAR_CONDITION_MISSING", { condition: "window" });
  if (!isCount(samples)) return refuse("GATE_CHAR_INVALID", { field: "samples" });
  const open = samples === 0;
  return deepFreeze({ ok: true, record: { property, value: open ? GRADES.OPEN : value, method, samples, conditions,
    ev: open ? { grade: GRADES.OPEN, source: null, date: null } : ev } });
}

/** R41 — stale when the model, profile or adapter version changed, or `REVIEW_DAYS` have passed. */
export function isStale(record, { model_version, profile_version, adapter_version, at }, params = GATE_PARAMS) {
  const c = record?.conditions ?? {};
  if (c.model_version !== model_version || c.profile_version !== profile_version || c.adapter_version !== adapter_version)
    return true;
  const t = Date.parse(c.window?.to), now = Date.parse(at);
  return !(Number.isFinite(t) && Number.isFinite(now)) || now - t > params.REVIEW_DAYS * 86400000;
}

const quantile = (s, q) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];

/** R43 — turn latency per streaming kind: median, 90th percentile and spread (p90 − p10), with windows and region;
 *  OPEN with the shortfall below `LATENCY_TURNS_MIN` turns or `LATENCY_WINDOWS_MIN` distinct UTC days. `turns` is
 *  `[{ms, at, streaming, region}]`. */
export function latencyFigure(turns, params = GATE_PARAMS) {
  const out = {};
  for (const streaming of [true, false]) {
    const ts = (Array.isArray(turns) ? turns : []).filter((t) => isObj(t) && t.streaming === streaming && typeof t.ms === "number" && isInstant(t.at));
    if (!ts.length) continue;
    const days = new Set(ts.map((t) => t.at.slice(0, 10)));
    const key = streaming ? "streaming" : "non_streaming";
    if (ts.length < params.LATENCY_TURNS_MIN || days.size < params.LATENCY_WINDOWS_MIN) {
      out[key] = { value: GRADES.OPEN, shortfall: { turns: Math.max(0, params.LATENCY_TURNS_MIN - ts.length),
        windows: Math.max(0, params.LATENCY_WINDOWS_MIN - days.size) } };
      continue;
    }
    const s = ts.map((t) => t.ms).sort((a, b) => a - b);
    out[key] = { value: { median_ms: quantile(s, 0.5), p90_ms: quantile(s, 0.9), spread_ms: quantile(s, 0.9) - quantile(s, 0.1) },
      turns: ts.length, windows: [...days].sort(), regions: [...new Set(ts.map((t) => t.region ?? null))] };
  }
  return deepFreeze(out);
}

/** R44 — error behaviour over all T2 calls: each class `k of n` with its interval, `n` stated. */
export const ERROR_CLASSES = deepFreeze(["rate_limit", "overload", "timeout", "truncation", "content_refusal", "malformed", "identity_mismatch"]);
export function errorBehaviour(calls) {
  const cs = Array.isArray(calls) ? calls : [];
  const n = cs.length;
  return deepFreeze(Object.fromEntries(ERROR_CLASSES.map((c) => {
    const k = cs.filter((x) => x?.error_class === c).length;
    const w = wilson(k, n);
    return [c, { k, n, wilson_low: w.low, wilson_high: w.high }];
  })));
}

/** R45 — the effective context window: the largest depth up to which every depth's recall meets the floor. With no
 *  floor, the curve and no value. `curve` is `[{depth, k, n}]`. */
export function effectiveWindow(curve, { floor = null, stated } = {}) {
  const c = (Array.isArray(curve) ? curve : []).filter((p) => isCount(p?.depth) && isCount(p.k) && isCount(p.n) && p.n > 0)
    .sort((a, b) => a.depth - b.depth).map((p) => ({ depth: p.depth, k: p.k, n: p.n, rate: p.k / p.n }));
  if (typeof floor !== "number") return deepFreeze({ ok: true, curve: c, effective: null, stated: stated ?? null, limit: null });
  let effective = 0;
  for (const p of c) { if (p.rate >= floor) effective = p.depth; else break; }
  const top = c.length ? c[c.length - 1].depth : 0;
  if (effective === top && isCount(stated) && top >= stated) effective = stated;
  const limit = isCount(stated) && effective < stated ? { kind: "context_depth", value: effective } : null;
  return deepFreeze({ ok: true, curve: c, effective, stated: stated ?? null, limit });
}

/** R47 — uptime is evidence with its period: an SLA text (STATED), a status-page history (REPORTED), Civicsmith's
 *  canaries (REPRODUCED). A value with no source or period is refused. */
const UPTIME_GRADES = { sla: GRADES.STATED, status_page: GRADES.REPORTED, canary: GRADES.REPRODUCED };
export function uptimeEvidence(sources) {
  const out = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    if (!isObj(s) || !UPTIME_GRADES[s.kind]) return refuse("GATE_UPTIME_INVALID", { field: "kind" });
    if (!isNonBlank(s.source)) return refuse("GATE_UPTIME_INVALID", { field: "source" });
    if (!isObj(s.period) || !isNonBlank(s.period.from) || !isNonBlank(s.period.to)) return refuse("GATE_UPTIME_INVALID", { field: "period" });
    out.push({ kind: s.kind, value: s.value, source: s.source, period: { ...s.period }, grade: UPTIME_GRADES[s.kind] });
  }
  return deepFreeze({ ok: true, evidence: out });
}

/** R48 — plan-scope limits and the privacy and training answers are linked from the catalogue, never measured:
 *  `lookup(entry_id, kind)` answers the catalogue's record or null, which reads OPEN. */
export function catalogueLinks(entry_id, lookup) {
  const one = (kind) => {
    let r = null;
    try { r = typeof lookup === "function" ? lookup(entry_id, kind) : null; } catch { r = null; }
    return r ? { link: { entry_id, kind }, grade: r.grade ?? GRADES.STATED } : { link: { entry_id, kind }, grade: GRADES.OPEN };
  };
  return deepFreeze({ plan_scope: one("plan_scope"), privacy: one("privacy") });
}
