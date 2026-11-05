/* agent-model (T53) — WHAT THE CATALOGUE SAYS OF AN ENTRY: its capabilities (R30), whether it serves a role's need
 * (R1), which entry of an account serves a role (R55), what a task may cost (R34) and what a turn cost (R13).
 *
 * Everything here is read from `ai-catalogue`'s entry, plan and profile, handed in as `cat` (`entryOf`, `profileOf`,
 * `plansOf`, each sync or a promise). It makes no call to a provider, never throws, and names no model or price. A
 * figure the catalogue does not state is `null`, never false or zero. */

import { claimValue, TOKEN_FIGURES } from "./neutral.mjs";

const BOOL_CAPS = Object.freeze(["tools", "parallel_tools", "schema_output", "schema_with_tools", "image_input", "batch"]);
const ENUM_CAPS = Object.freeze(["streaming", "session", "caching"]);

async function safe(fn, ...args) {
  try { return typeof fn === "function" ? (await fn(...args)) ?? null : null; } catch { return null; }
}

/** The entry `entry_id` names (or the declared entry handed whole), or null. */
export async function entryFrom(cat, entry_id) {
  if (entry_id && typeof entry_id === "object") return entry_id;
  if (typeof entry_id !== "string" || !entry_id) return null;
  return safe(cat?.entryOf?.bind(cat), entry_id);
}
export async function profileFrom(cat, entry) {
  const id = entry && entry.profile && entry.profile.id;
  if (typeof id !== "string") return null;
  return safe(cat?.profileOf?.bind(cat), id);
}
/** The plan the account names (else the entry's first), or null. */
export async function planFrom(cat, entry, account) {
  const want = account && typeof account.plan_id === "string" ? account.plan_id : null;
  const groups = await safe(cat?.plansOf?.bind(cat), want ? { plan_id: want } : { entry_id: entry?.entry_id });
  const plans = Array.isArray(groups) ? groups.flatMap((g) => (Array.isArray(g?.plans) ? g.plans : [])) : [];
  return plans[0] ?? null;
}

/** R30: the capability answer from an entry. */
export function capabilitiesOf(entry) {
  const c = entry?.capabilities || {};
  const out = {};
  for (const k of BOOL_CAPS) { const v = claimValue(c[k]); out[k] = typeof v === "boolean" ? v : null; }
  for (const k of ENUM_CAPS) { const v = claimValue(c[k]); out[k] = typeof v === "string" ? v : null; }
  const set = entry?.effort_set;
  out.effort_set = set && Array.isArray(set.values) && set.values.length ? [...set.values] : null;
  out.effort_default = out.effort_set && typeof set.default === "string" ? set.default : null;
  const classes = entry?.effort_classes;
  out.effort_classes = classes && typeof classes === "object"
    ? Object.fromEntries(Object.entries(classes).filter(([k, v]) => k !== "ev" && typeof v === "string")) : null;
  const lim = entry?.limits || {};
  const num = (x) => { const v = claimValue(x); return typeof v === "number" && Number.isFinite(v) ? v : null; };
  out.context_window = num(lim.context_effective) ?? num(lim.context_stated);
  out.max_output = num(lim.max_output);
  out.image_max_bytes = num(lim.image_max_bytes);
  const zr = claimValue(entry?.zero_retention);
  out.zero_retention = typeof zr === "boolean" ? zr : null;
  out.lifecycle = typeof entry?.lifecycle === "string" ? entry.lifecycle : null;
  return out;
}

/** R30: `capabilities(entry_id)`; an unknown entry answers `{refused: {type: "ENTRY_UNKNOWN"}}`. */
export async function capabilities(entry_id, { catalogue } = {}) {
  try {
    const entry = await entryFrom(catalogue, entry_id);
    return entry ? capabilitiesOf(entry) : { refused: { type: "ENTRY_UNKNOWN" } };
  } catch { return { refused: { type: "ENTRY_UNKNOWN" } }; }
}

/* A capability a need names is had when it is true or a value other than `none`; `null` (OPEN) is not had. */
const has = (caps, name) => {
  const v = caps[name];
  return v === true || (typeof v === "string" && v !== "none");
};

/** R1: whether an entry's capabilities meet a need `{capabilities, cost, min_context?}`. */
export function servesCaps(caps, need) {
  const lacks = [];
  for (const name of Array.isArray(need?.capabilities) ? need.capabilities : []) {
    if (name === "min_context") {
      const min = Number(need.min_context);
      if (!(Number.isFinite(min) && caps.context_window != null && caps.context_window >= min)) lacks.push(name);
    } else if (!has(caps, name)) lacks.push(name);
  }
  return lacks.length ? { ok: false, lacks } : { ok: true };
}

/** R1: `serves(entry_id, need)` → `{ok: true}` | `{ok: false, lacks}`; an unknown entry lacks everything asked. */
export async function serves(entry_id, need, { catalogue } = {}) {
  const entry = await entryFrom(catalogue, entry_id);
  if (!entry) return { ok: false, lacks: [...(Array.isArray(need?.capabilities) ? need.capabilities : [])], unknown: true };
  return servesCaps(capabilitiesOf(entry), need);
}

/* ------------------------------------------------------------------ COST */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const measured = (entry) => {
  const s = entry?.standard_task_costs;
  return s && typeof s === "object" && s.open !== true && s.by_part && typeof s.by_part === "object" ? s : null;
};
const priced = (entry) => {
  const p = entry?.prices;
  return p && typeof p === "object" && p.open !== true && ["input", "output", "cache_read", "cache_write"].some((k) => isNum(p[k]))
    ? p : null;
};

/** R34: `estimate({entry_id, task: {kind, count?}})` → `{low, high, unit, basis}`. Never zero for an unknown. */
export async function estimate({ entry_id, task } = {}, { catalogue } = {}) {
  const none = { low: null, high: null, unit: null, basis: "not_known" };
  try {
    const entry = await entryFrom(catalogue, entry_id);
    if (!entry) return none;
    const count = Number.isInteger(task?.count) && task.count > 0 ? task.count : 1;
    const m = measured(entry);
    const r = m && typeof task?.kind === "string" ? m.by_part[task.kind] : null;
    if (r && isNum(r.low) && isNum(r.high))
      return { low: r.low * count, high: r.high * count, unit: typeof m.unit === "string" ? m.unit : null, basis: "measured" };
    const p = priced(entry);
    if (p) return { low: null, high: null, unit: typeof p.unit === "string" ? p.unit : null, basis: "price_only" };
    return none;
  } catch { return none; }
}

const RATE_OF = Object.freeze({ input_tokens: "input", output_tokens: "output", cache_read_input_tokens: "cache_read",
  cache_creation_input_tokens: "cache_write" });
const INPUT_SIDE = Object.freeze(["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]);
const PER_MILLION = 1e6;

/** R13: the copy's estimate of what a turn cost, `{amount, unit, price_date, estimate_open?}`, or null when the entry
 *  carries no price or the plan's cost is not per token. A figure the provider left null is never priced as zero: the
 *  input side is bounded by the request's bytes (a token covers at least one byte) and the output by `max_output`,
 *  each bound priced at the highest of the entry's rates. Reasoning tokens follow the profile's `reasoning_billing`:
 *  `in_output` adds nothing (they are in the output figure), `apart` prices them at the output rate, and OPEN prices
 *  them at the output rate and flags `estimate_open`. */
export function costEstimated(usage, { entry, plan, profile, requestBytes = 0, maxOutput = 0 } = {}) {
  if (!usage) return null;
  const p = priced(entry);
  if (!p) return null;
  const basis = plan && plan.price_basis && typeof plan.price_basis.basis === "string" ? plan.price_basis.basis : null;
  if (basis !== null && basis !== "per_token") return null;
  const rates = ["input", "output", "cache_read", "cache_write"].map((k) => p[k]).filter(isNum);
  const top = Math.max(...rates);
  const rate = (figure) => (isNum(p[RATE_OF[figure]]) ? p[RATE_OF[figure]] : top);
  let amount = 0;
  for (const k of Object.keys(RATE_OF)) if (usage[k] != null) amount += usage[k] * rate(k);
  if (INPUT_SIDE.some((k) => usage[k] == null)) {
    const stated = INPUT_SIDE.reduce((n, k) => n + (usage[k] ?? 0), 0);
    amount += Math.max(0, requestBytes - stated) * top;
  }
  if (usage.output_tokens == null) amount += Math.max(0, maxOutput) * top;
  const billing = profile ? profile.reasoning_billing : null;
  let open = false;
  if (billing !== "in_output") {
    if (usage.reasoning_tokens != null) amount += usage.reasoning_tokens * rate("output_tokens");
    if (billing !== "apart") open = true;
  }
  const out = { amount: amount / PER_MILLION, unit: unitOf(p.unit), price_date: typeof p.date === "string" ? p.date : null };
  if (open) out.estimate_open = true;
  return out;
}
const unitOf = (u) => (u === "usd_per_million_tokens" ? "usd" : typeof u === "string" ? u : null);
export { TOKEN_FIGURES };

/* ------------------------------------------------------------------ R55 entryFor */

const lowCost = (entry) => {
  const m = measured(entry);
  if (m) {
    const lows = Object.values(m.by_part).map((r) => r?.low).filter(isNum);
    if (lows.length) return [0, Math.min(...lows)];
  }
  const p = priced(entry);
  if (p && isNum(p.output)) return [1, p.output];
  return [2, 0];
};

/** R55: `entryFor(account, role, need)` → `{entry_id}` | `{refused: {type, control?}}`. Of `account.entries` that
 *  `entryOffered` offers for the act (every entry when no `entryOffered` is handed), those whose capabilities serve
 *  the need; `low` cost picks the cheapest, `standard` and `high` the account's head entry when it serves, else the
 *  first in list order. Makes no call; never throws. */
export async function entryFor(account, role, need, { catalogue, entryOffered } = {}) {
  try {
    const list = Array.isArray(account?.entries) ? account.entries.filter((x) => typeof x === "string") : [];
    const serving = [];
    let lacking = null;
    for (const id of list) {
      if (typeof entryOffered === "function") {
        let o = null;
        try { o = await entryOffered({ entry_id: id, role, account_id: account?.account_id ?? null }); } catch { o = null; }
        if (!o || o.ok !== true) continue;
      }
      const entry = await entryFrom(catalogue, id);
      if (!entry) continue;
      const s = servesCaps(capabilitiesOf(entry), need);
      if (s.ok) serving.push(entry); else if (!lacking) lacking = s.lacks[0];
    }
    if (!serving.length)
      return lacking ? { refused: { type: "UNSUPPORTED_CONTROL", control: lacking } } : { refused: { type: "NO_ENTRY_OFFERED" } };
    if (need?.cost === "low") {
      const ranked = serving.map((e, i) => ({ e, i, c: lowCost(e) }))
        .sort((a, b) => a.c[0] - b.c[0] || a.c[1] - b.c[1] || a.i - b.i);
      return { entry_id: ranked[0].e.entry_id };
    }
    const head = serving.find((e) => e.entry_id === account?.entry_id);
    return { entry_id: (head || serving[0]).entry_id };
  } catch { return { refused: { type: "NO_ENTRY_OFFERED" } }; }
}
