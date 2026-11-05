/* ai-gate — planning a run: the plan fixed before the first call, the tiers in order, early stops, declared plans and
 * where the items come from (R10, R11, R13, R15–R18, R20, R38). Pure; never throws. */
import { sha256HexSync } from "../../bio-plane/src/record-grammar/index.mjs";
import { CATALOGUE_ADDRESS } from "../../bio-plane/src/ai-catalogue/index.mjs";
import { GATE_PARAMS, TIERS, deepFreeze, refuse, isObj, isNonBlank } from "./params.mjs";
import { PARTS, DEPENDS_ON } from "./groups.mjs";
import { selectItems, itemById } from "./bank.mjs";

const RUN_TIERS = ["T0", "T1", "T2"];

/** R11, R15, R16 — the repeats of an item at a tier: T0 once, T1 `REPEATS.T1`, T2 `REPEATS.T2` (a G6 item
 *  `REPEATS.consistency`). */
export function repeatsFor(tier, item, params = GATE_PARAMS) {
  if (tier === "T0") return 1;
  if (tier === "T1") return params.REPEATS.T1;
  return item?.group === "G6" ? params.REPEATS.consistency : params.REPEATS.T2;
}

/** R10 — the sampling settings as the role uses them in production, from the entry's declaration. */
function samplingOf(entry, nonce) {
  const s = isObj(entry?.sampling) ? entry.sampling : {};
  return Object.freeze({
    temperature: typeof s.temperature === "number" ? s.temperature : null,
    effort: s.effort ?? null,
    max_output: Number.isSafeInteger(s.max_output) ? s.max_output : null,
    seed: entry?.capabilities?.seed === true ? parseInt(sha256HexSync(`seed\n${nonce}`).slice(0, 8), 16) : null,
  });
}

/** R10, R11 — the run's plan, fixed before the first call: per tier the item list in order, each item's repeats and
 *  a fresh session key per repeat (no two repeats share one), and the sampling settings. `bank` is the public bank and
 *  `selection_seed` the challenge's (R6, R60). The same inputs give an identical plan; no function adds an item to it. */
export function planRun({ entry, tiers, parts, nonce, selection_seed, bank, suiteVersions, declared = null } = {}) {
  if (!isObj(entry) && !isObj(declared)) return refuse("GATE_PLAN_INPUT", { field: "entry" });
  if (!isNonBlank(nonce)) return refuse("GATE_PLAN_INPUT", { field: "nonce" });
  if (!isObj(suiteVersions)) return refuse("GATE_PLAN_INPUT", { field: "suiteVersions" });
  if (!Array.isArray(tiers) || !tiers.length || !tiers.every((t) => RUN_TIERS.includes(t)))
    return refuse("GATE_TIER_NOT_A_RUN");
  const ordered = RUN_TIERS.filter((t) => tiers.includes(t));
  if (!Array.isArray(parts) || !parts.length || !parts.every((p) => PARTS.includes(p))) return refuse("GATE_PART_UNKNOWN");
  const steps = [];
  for (const tier of ordered) {
    const ids = selectItems(bank, selection_seed, tier, parts);
    if (!Array.isArray(ids)) return ids;
    const items = ids.map((id) => {
      const it = itemById(bank, id);
      const repeats = repeatsFor(tier, it);
      return Object.freeze({ item_id: id, group: it.group, repeats,
        sessions: Object.freeze(Array.from({ length: repeats }, (_, r) => sha256HexSync(`${nonce}\n${tier}\n${id}\n${r}`).slice(0, 32))) });
    });
    steps.push(Object.freeze({ tier, items: Object.freeze(items) }));
  }
  return deepFreeze({ ok: true, entry_id: entry?.entry_id ?? null, declared: declared ?? null, parts: [...parts],
    nonce, suiteVersions: { ...suiteVersions }, sampling: samplingOf(entry ?? declared, nonce), tiers: steps });
}

/** R10, R18 — the record of a run that ended before its plan did: only R50's ceiling or R18's early stop end one. */
export const END_REASONS = deepFreeze(["ceiling_spend", "ceiling_calls", "ceiling_time", "early_stop_identity",
  "early_stop_pin", "early_stop_no_tools", "secret_in_payload"]);
export function endedEarly(reason, at_tier) {
  return END_REASONS.includes(reason) ? Object.freeze({ ended_early: true, reason, at_tier }) : refuse("GATE_END_REASON_UNKNOWN");
}

/** R13 — the tier after `result` ({tier, completed, early_stop}), or a refusal: the next only when the one before
 *  completed and no early stop fired; T3 by `admitT3` alone. */
export function nextTier(result) {
  if (!isObj(result) || !TIERS.includes(result.tier)) return refuse("GATE_TIER_UNKNOWN");
  if (result.completed !== true) return refuse("GATE_TIER_INCOMPLETE", { tier: result.tier });
  if (result.early_stop) return refuse("GATE_TIER_STOPPED", { tier: result.tier });
  const i = TIERS.indexOf(result.tier);
  if (i === TIERS.length - 1) return refuse("GATE_TIER_LAST");
  if (TIERS[i + 1] === "T3") return admitT3(result.verdicts);
  return Object.freeze({ ok: true, tier: TIERS[i + 1] });
}

/** R17 — T3 only for an entry that passed at least one part at T2. `verdicts` is `{part: verdict}` or a list of
 *  `{part, verdict}`. */
export function admitT3(verdicts) {
  const vs = Array.isArray(verdicts) ? verdicts.map((v) => v?.verdict) : isObj(verdicts) ? Object.values(verdicts) : [];
  return vs.some((v) => v === "passes" || v === "passes_with_limits")
    ? Object.freeze({ ok: true, tier: "T3" }) : refuse("GATE_T3_NOT_ADMITTED");
}

/** R18 — early stops. At T0 (`t0`: {identity_ok, pin_ok, tools_ok, tools_needed}) a wrong identity, an unhonoured pin
 *  or no tool calling where the roles need it stops the run. At T1 (`outcomes`: [{group, part, outcome}]) a group
 *  failing every item stops the groups that depend on it, per part. */
export function earlyStops({ t0 = null, outcomes = [] } = {}) {
  const stops = [];
  if (isObj(t0)) {
    if (t0.identity_ok === false) stops.push({ scope: "run", reason: "early_stop_identity" });
    if (t0.pin_ok === false) stops.push({ scope: "run", reason: "early_stop_pin" });
    if (t0.tools_ok === false && t0.tools_needed !== false) stops.push({ scope: "run", reason: "early_stop_no_tools" });
  }
  const by = new Map();
  for (const o of Array.isArray(outcomes) ? outcomes : []) {
    if (!isObj(o) || o.outcome === "not_run" || o.outcome === "not_applicable" || o.outcome == null) continue;
    const k = `${o.group}\n${o.part}`;
    const s = by.get(k) ?? { pass: 0, n: 0 };
    s.n++; if (o.outcome === "pass") s.pass++;
    by.set(k, s);
  }
  for (const [g, deps] of Object.entries(DEPENDS_ON))
    for (const part of PARTS)
      for (const d of deps) {
        const s = by.get(`${d}\n${part}`);
        if (s && s.n > 0 && s.pass === 0) stops.push({ scope: "group", group: g, part, reason: `depends_on_${d}` });
      }
  return deepFreeze(stops);
}

/* ------------------------------------------------------------------ R20: a declared plan */

const ROUTES = ["cloudflare", "team", "machine", "civicsmith"];
const ISSUER_HOSTS = [new URL(CATALOGUE_ADDRESS).hostname];
const DNS_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const PRIVATE_SUFFIX = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".private"];

function hostOf(host) {
  if (!isNonBlank(host)) return null;
  let h = host.trim().toLowerCase();
  if (h.startsWith("https://")) h = h.slice(8);
  else if (/^[a-z]+:\/\//.test(h)) return { scheme: false };
  h = h.replace(/\/.*$/, "");
  return { scheme: true, name: h };
}

/** R20 — check a declared plan `{provider, host, model, plan, scope_declared, terms_page?, price?, route}`. Refuses a
 *  host that is not a DNS name over https, a wildcard, Civicsmith's issuer, or (unless `route` is `machine`) an
 *  address or a private name. */
export function checkDeclared(declared, { issuerHosts = ISSUER_HOSTS } = {}) {
  if (!isObj(declared)) return refuse("GATE_DECLARED_INVALID", { field: "declared" });
  for (const f of ["provider", "host", "model", "plan", "route"])
    if (!isNonBlank(declared[f])) return refuse("GATE_DECLARED_INVALID", { field: f });
  if (!ROUTES.includes(declared.route)) return refuse("GATE_DECLARED_INVALID", { field: "route" });
  if (typeof declared.scope_declared !== "string") return refuse("GATE_DECLARED_INVALID", { field: "scope_declared" });
  const h = hostOf(declared.host);
  if (!h || !h.scheme) return refuse("GATE_DECLARED_HOST", { reason: "not_https" });
  const name = h.name.replace(/:\d+$/, "");
  if (name.includes("*")) return refuse("GATE_DECLARED_HOST", { reason: "wildcard" });
  if (issuerHosts.includes(name)) return refuse("GATE_DECLARED_HOST", { reason: "issuer" });
  const address = IPV4_RE.test(name) || name.startsWith("[") || name.includes(":");
  const privateName = name === "localhost" || PRIVATE_SUFFIX.some((s) => name.endsWith(s)) || !name.includes(".");
  if (address || privateName) {
    if (declared.route !== "machine") return refuse("GATE_DECLARED_HOST", { reason: address ? "address" : "private_name" });
  } else if (!DNS_RE.test(name)) return refuse("GATE_DECLARED_HOST", { reason: "not_dns" });
  if (declared.terms_page != null && !/^https:\/\//.test(String(declared.terms_page)))
    return refuse("GATE_DECLARED_INVALID", { field: "terms_page" });
  return Object.freeze({ ok: true, host: name, test_flow: true });
}

/* ------------------------------------------------------------------ R38: where items come from */

/** R38 — Civicsmith's own runs use its set and the synthetic bank; a bundle's run the synthetic bank only. */
export function itemSources(runKind) {
  if (runKind === "civicsmith") return deepFreeze({ ok: true, sources: ["civicsmith_set", "synthetic_bank"] });
  if (runKind === "bundle") return deepFreeze({ ok: true, sources: ["synthetic_bank"] });
  return refuse("GATE_RUN_KIND_UNKNOWN");
}
