/* ai-gate — the cost estimate before a run, the ceiling during it, and the consent record (R49–R51). Pure. */
import { GATE_PARAMS, deepFreeze, refuse, isObj, isNonBlank, isInstant, isPositive } from "./params.mjs";
import { planRun } from "./plan.mjs";
import { itemById } from "./bank.mjs";

const M = 1_000_000;
const money = (price) => isObj(price) && isNonBlank(price.unit) && typeof price.input_per_mtok === "number"
  && typeof price.output_per_mtok === "number";

/* The cost of one call of `tokens` at `price`: the long-context tier where the table has one and the input exceeds
   it; `cached` input tokens at the cached rate where the entry claims caching. */
function callCost(tokens, price, cached = 0) {
  const lc = isObj(price.long_context) && tokens.input > price.long_context.above_tokens ? price.long_context : null;
  const inRate = lc ? lc.input_per_mtok : price.input_per_mtok;
  const outRate = lc ? lc.output_per_mtok : price.output_per_mtok;
  const cachedRate = typeof price.cached_input_per_mtok === "number" ? price.cached_input_per_mtok : inRate;
  const c = Math.min(cached, tokens.input);
  return ((tokens.input - c) * inRate + c * cachedRate + tokens.output * outRate) / M;
}

/** R49 — `{low, expected, high, unit, basis}` before any call: each planned item's token profile × repeats × the price
 *  (its date and grade in `basis`), plus session start for each repeat, `RETRY_ALLOWANCE`, the cache effect the entry
 *  claims (low only), and the long-context tier where it applies. For an unlisted plan the price is the person's
 *  (`declaredPrice`), and `basis` says so. A plan reporting no money answers calls, tokens and the allowance, no unit
 *  of money, never zero. `plan` is a `planRun` result, or its inputs are given to build one. */
export function estimateRun({ entry = null, plan = null, price = null, declaredPrice = null, params = GATE_PARAMS, bank,
  ...planInputs } = {}) {
  const p = plan ?? planRun({ entry, bank, ...planInputs });
  if (!p?.ok) return p ?? refuse("GATE_PLAN_INPUT");
  const pr = entry ? price : declaredPrice;
  const session = isObj(entry?.session_start) ? entry.session_start : { input: 0, output: 0 };
  const cachedClaim = entry?.capabilities?.caching === true ? session.input : 0;
  let calls = 0, tin = 0, tout = 0, low = 0, expected = 0;
  for (const step of p.tiers) for (const it of step.items) {
    const item = itemById(bank, it.item_id);
    const tp = item?.token_profile ?? { input: 0, output: 0 };
    const call = { input: tp.input + session.input, output: tp.output + session.output };
    calls += it.repeats; tin += call.input * it.repeats; tout += call.output * it.repeats;
    if (money(pr)) {
      low += callCost(call, pr, cachedClaim) * it.repeats;
      expected += callCost(call, pr, 0) * it.repeats;
    }
  }
  const allowance = params.RETRY_ALLOWANCE;
  const basis = { price_from: entry ? "catalogue" : "declared_by_person", price_date: pr?.date ?? null,
    price_grade: pr?.grade ?? null, retry_allowance: allowance, cache_claimed: cachedClaim > 0 };
  if (!money(pr))
    return deepFreeze({ ok: true, unit: null, measure: { calls, input_tokens: tin, output_tokens: tout,
      calls_high: Math.ceil(calls * (1 + allowance)) }, basis: { ...basis, money: "not_reported" } });
  return deepFreeze({ ok: true, low, expected, high: expected * (1 + allowance), unit: pr.unit,
    measure: { calls, input_tokens: tin, output_tokens: tout }, basis });
}

/** R50 — `ok` or `stop` before each call, from provider-reported spend, else estimated spend; calls and seconds
 *  likewise. `next_max_output` caps the next call's output so its cost cannot pass the high estimate for one call. */
export function meter(usage, ceiling, { price = null, callHigh = null } = {}) {
  if (!isObj(ceiling) || !isPositive(ceiling.spend) || !isPositive(ceiling.calls) || !isPositive(ceiling.seconds))
    return refuse("GATE_CEILING_REQUIRED");
  const u = isObj(usage) ? usage : {};
  const spend = typeof u.spend_reported === "number" ? u.spend_reported : typeof u.spend_estimated === "number" ? u.spend_estimated : 0;
  if (spend >= ceiling.spend) return Object.freeze({ ok: true, decision: "stop", reason: "ceiling_spend", spend });
  if ((u.calls ?? 0) >= ceiling.calls) return Object.freeze({ ok: true, decision: "stop", reason: "ceiling_calls", spend });
  if ((u.seconds ?? 0) >= ceiling.seconds) return Object.freeze({ ok: true, decision: "stop", reason: "ceiling_time", spend });
  let next_max_output = null;
  if (money(price) && typeof callHigh === "number")
    next_max_output = Math.max(1, Math.floor((callHigh * M) / price.output_per_mtok));
  return Object.freeze({ ok: true, decision: "ok", spend, next_max_output, overshoot_bound: callHigh });
}

/** R50 — a ceiling below the low estimate is accepted and shown with its warning key. */
export function ceilingCheck(estimate, ceiling) {
  if (!isObj(ceiling) || !isPositive(ceiling.spend) || !isPositive(ceiling.calls) || !isPositive(ceiling.seconds))
    return refuse("GATE_CEILING_REQUIRED");
  const low = typeof estimate?.low === "number" && ceiling.spend < estimate.low;
  return Object.freeze({ ok: true, warnings: low ? ["gate.warn.ceiling_low"] : [] });
}

/** R51 — the consent record the caller stores. No record, and no run, without an explicit consent from a person:
 *  `who` is `{person_id, consented: true}`. */
export function consentRecord({ who, at, estimate, ceiling, plan, tiers } = {}) {
  if (!isObj(who) || !isNonBlank(who.person_id) || who.consented !== true) return refuse("GATE_CONSENT_MISSING");
  if (!isInstant(at)) return refuse("GATE_CONSENT_INVALID", { field: "at" });
  if (!isObj(estimate)) return refuse("GATE_CONSENT_INVALID", { field: "estimate" });
  if (!isObj(ceiling)) return refuse("GATE_CONSENT_INVALID", { field: "ceiling" });
  if (!Array.isArray(tiers) || !tiers.length) return refuse("GATE_CONSENT_INVALID", { field: "tiers" });
  return deepFreeze({ ok: true, record: { person_id: who.person_id, at, estimate: structuredClone(estimate),
    ceiling: { ...ceiling }, plan: plan ?? null, tiers: [...tiers] } });
}

/** R51 — after the run, the difference between the estimate and the actual. */
export function estimateError(estimate, actual) {
  if (!isObj(estimate) || typeof actual !== "number") return refuse("GATE_ESTIMATE_INPUT");
  if (typeof estimate.expected !== "number") return refuse("GATE_ESTIMATE_NO_MONEY");
  return Object.freeze({ ok: true, difference: actual - estimate.expected,
    ratio: estimate.expected > 0 ? actual / estimate.expected : null, within: actual >= estimate.low && actual <= estimate.high });
}

