/* ai-gate — canaries, divergence and the lifecycle signal (R52, R53, R62). Pure; changes nothing: `ai-catalogue`
 * applies and signs any advisory. */
import { GATE_PARAMS, deepFreeze, refuse, isObj, isNonBlank } from "./params.mjs";
import { wilson } from "./verdict.mjs";
import { itemById } from "./bank.mjs";

/** R52 — the canary: the fixed subset `CANARY_ITEMS` at repeats `REPEATS.canary`, on Civicsmith's own accounts only.
 *  Refused for a lapsed entry, for any account but Civicsmith's, and when `ai-use.retestAllowed` did not answer true. */
export function canaryPlan(entry, { bank, account_kind, retestAllowed, params = GATE_PARAMS } = {}) {
  if (!isObj(entry) || !isNonBlank(entry.entry_id)) return refuse("GATE_CANARY_INPUT");
  if (entry.state === "lapsed" || entry.state === "retired") return refuse("GATE_CANARY_LAPSED");
  if (account_kind !== "civicsmith") return refuse("GATE_CANARY_NOT_CIVICSMITH");
  if (retestAllowed !== true) return refuse("GATE_CANARY_RETEST_OFF");
  const items = params.CANARY_ITEMS.filter((id) => itemById(bank, id));
  return deepFreeze({ ok: true, entry_id: entry.entry_id, items, repeats: params.REPEATS.canary });
}

/** R52, R62 — `same` or `diverged` by interval overlap, per (part, group) present in both; never a bare difference. */
export function canaryCompare(baseline, figures) {
  if (!isObj(baseline) || !isObj(figures)) return refuse("GATE_COMPARE_INPUT");
  const moved = [];
  for (const [part, gs] of Object.entries(figures)) for (const [g, f] of Object.entries(gs ?? {})) {
    const b = baseline[part]?.[g];
    if (!isObj(b) || !isObj(f) || !(b.n > 0) || !(f.n > 0)) continue;
    if (f.wilson_high < b.wilson_low || f.wilson_low > b.wilson_high)
      moved.push({ part, group: g, direction: f.wilson_high < b.wilson_low ? "down" : "up",
        baseline: [b.wilson_low, b.wilson_high], now: [f.wilson_low, f.wilson_high] });
  }
  return deepFreeze({ ok: true, result: moved.length ? "diverged" : "same", moved });
}

/** R62 — a verified bundle's figures against the entry's baseline: the same comparison. */
export const divergence = (reported, baseline) => canaryCompare(baseline, reported);

const rateInterval = (c) => (isObj(c) ? wilson(c.k, c.n) : null);

/** R53 — the advisories proposed from the evidence, each `{entry_id, proposed, reason, evidence}`; drift alone never
 *  proposes `lapsed`. Inputs: `canary` and `bundles` (compare results), `served_model`, `deprecation_date`,
 *  `health` ({errors: {k, n}, window_days}) against `baseline_errors` ({k, n}), `provider_error` (BR26). */
export function lifecycleSignal({ entry, canary = null, served_model = null, bundles = null, deprecation_date = null,
  health = null, baseline_errors = null, provider_error = null, params = GATE_PARAMS } = {}) {
  if (!isObj(entry) || !isNonBlank(entry.entry_id)) return refuse("GATE_SIGNAL_INPUT");
  const id = entry.entry_id;
  const out = [];
  const sig = (proposed, reason, evidence) => out.push({ entry_id: id, proposed, reason, evidence });
  if (canary?.result === "diverged") sig("watch", "canary_drift", { moved: canary.moved });
  if (isNonBlank(served_model) && served_model !== entry.model) sig("watch", "served_mismatch", { served_model, entry_model: entry.model ?? null });
  if (bundles?.result === "diverged") sig("watch", "team_divergence", { moved: bundles.moved });
  if (isNonBlank(deprecation_date)) sig("watch", "deprecation", { date: deprecation_date });
  if (isObj(health) && health.window_days === params.HEALTH_WINDOW_DAYS) {
    const h = rateInterval(health.errors), b = rateInterval(baseline_errors);
    if (h && b && health.errors.n > 0 && baseline_errors.n > 0 && h.low > b.high)
      sig("watch", "health", { health: health.errors, baseline: baseline_errors, window_days: health.window_days });
  }
  if (provider_error === "model_not_found") sig("lapsed", "other", { provider_error });
  return deepFreeze(out);
}
