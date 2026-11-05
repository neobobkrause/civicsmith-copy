/* ai-gate — figures, verdicts, the gate record, grades, the results library's rows and their joining
 * (R33–R40, R61, R63, R64, R67). Pure; never throws. A person's note is never an input to a verdict (R40). */
import { checkGateRecord } from "../../bio-plane/src/run-rules/index.mjs";
import { GATE_PARAMS, LIMIT_KINDS, GRADES, EMPTY_THRESHOLDS_VERSION, deepFreeze, refuse, isObj, isNonBlank, isCount,
  isInstant } from "./params.mjs";
import { PARTS, GROUP_NEEDS, PARTIAL_COVERAGE, needsOf } from "./groups.mjs";

/* ------------------------------------------------------------------ R33: figures with their intervals */

const Z = { 80: 1.2815515655446004, 90: 1.6448536269514722, 95: 1.959963984540054, 99: 2.5758293035489004 };

/** R33 — the Wilson score interval of k successes in n at `level` percent. n = 0 gives the whole range. */
export function wilson(k, n, level = GATE_PARAMS.CI_LEVEL) {
  const z = Z[level];
  if (!z || !isCount(k) || !isCount(n) || k > n) return null;
  if (n === 0) return { low: 0, high: 1 };
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return { low: Math.max(0, c - h), high: Math.min(1, c + h) };
}

const figure = (k, n, not_run, not_applicable) => {
  const w = wilson(k, n);
  return { k, n, wilson_low: w.low, wilson_high: w.high, not_run, not_applicable };
};

/** R33 — per part and group `{k, n, wilson_low, wilson_high, not_run, not_applicable}` from item outcomes
 *  `[{group, parts | part, outcome}]`. `not_run` and `not_applicable` items stay outside `n`; a G8 item (outcome null)
 *  is not counted. Never a bare percentage. */
export function groupFigures(outcomes) {
  const acc = {};
  for (const o of Array.isArray(outcomes) ? outcomes : []) {
    if (!isObj(o) || !isNonBlank(o.group)) continue;
    const parts = Array.isArray(o.parts) ? o.parts : [o.part];
    for (const p of parts) {
      if (!PARTS.includes(p) || o.outcome == null) continue;
      const a = ((acc[p] ??= {})[o.group] ??= { k: 0, n: 0, not_run: 0, not_applicable: 0 });
      if (o.outcome === "pass") { a.k++; a.n++; }
      else if (o.outcome === "fail") a.n++;
      else if (o.outcome === "not_run") a.not_run++;
      else if (o.outcome === "not_applicable") a.not_applicable++;
    }
  }
  const out = {};
  for (const [p, gs] of Object.entries(acc))
    out[p] = Object.fromEntries(Object.entries(gs).map(([g, a]) => [g, figure(a.k, a.n, a.not_run, a.not_applicable)]));
  return deepFreeze(out);
}

/* ------------------------------------------------------------------ R34–R36: thresholds, verdicts, limits */

/** R34 — the shipped threshold table: empty, no number in code. Bob sets the floors after measurement (AD13). */
export const GATE_THRESHOLDS = deepFreeze({ kind: "thresholds", version: EMPTY_THRESHOLDS_VERSION, floors: {} });
export const FLOOR_COMPARES = deepFreeze(["rate", "lower"]);

const floorOf = (thresholds, group, part) => {
  const f = isObj(thresholds?.floors) ? thresholds.floors[`${group}:${part}`] : null;
  return isObj(f) && typeof f.floor === "number" && FLOOR_COMPARES.includes(f.compares) ? f : null;
};
const meets = (fig, f) => fig && fig.n > 0 && (f.compares === "rate" ? fig.k / fig.n >= f.floor : fig.wilson_low >= f.floor);

/** R36 — which part each limit kind narrows. */
const LIMIT_PARTS = deepFreeze({ no_image_input: ["read", "transcribe"], no_streaming: ["ask"],
  no_parallel_tools: ["run"], context_depth: ["ask", "read", "run"], output_cap: ["draft", "account", "transcribe"] });

/** R36 — the limits of a part, derived (never typed): from the capabilities the entry declares it lacks (the source of
 *  its `not_applicable` outcomes) and from R45's effective window (`caps.context_effective` below the stated window). */
export function deriveLimits(entry, part, caps = {}) {
  const c = isObj(entry?.capabilities) ? entry.capabilities : {};
  const out = [];
  const on = (kind) => LIMIT_PARTS[kind].includes(part);
  if (c.image_input === false && on("no_image_input")) out.push({ kind: "no_image_input", value: true });
  if (c.streaming === false && on("no_streaming")) out.push({ kind: "no_streaming", value: true });
  if (c.parallel_tools === false && on("no_parallel_tools")) out.push({ kind: "no_parallel_tools", value: true });
  const stated = entry?.limits?.context_stated ?? c.context_window;
  if (isCount(caps?.context_effective) && isCount(stated) && caps.context_effective < stated && on("context_depth"))
    out.push({ kind: "context_depth", value: caps.context_effective });
  if (isCount(caps?.output_cap) && on("output_cap")) out.push({ kind: "output_cap", value: caps.output_cap });
  return deepFreeze(out.filter((l) => LIMIT_KINDS.includes(l.kind)));
}

/** R35 — a part's verdict: `passes` when every needed group meets its floor, `passes_with_limits` when it does with a
 *  limit named, `not_suitable` otherwise; `not_yet_rated` with no table or no floor for a needed group (R34). */
export function partVerdict({ entry, part, figures, thresholds, caps = {}, needs = GROUP_NEEDS } = {}) {
  const row = needsOf(part, needs);
  if (!row.ok) return row;
  const limits = deriveLimits(entry, part, caps);
  const figs = isObj(figures?.[part]) ? figures[part] : {};
  const needed = Object.entries(row.needs).filter(([, v]) => v === "needed").map(([g]) => g);
  const base = { part, limits, partial_coverage: PARTIAL_COVERAGE[part] === true, figures: figs };
  if (!isObj(thresholds) || needed.some((g) => !floorOf(thresholds, g, part)))
    return deepFreeze({ ok: true, verdict: "not_yet_rated", ...base });
  const failing = needed.filter((g) => {
    const fig = figs[g];
    if (fig && fig.n === 0 && fig.not_applicable > 0 && limits.length) return false; /* the limit names it */
    return !meets(fig, floorOf(thresholds, g, part));
  });
  const verdict = failing.length ? "not_suitable" : limits.length ? "passes_with_limits" : "passes";
  return deepFreeze({ ok: true, verdict, ...base, failing });
}

/** R35 — a verdict for each part, never one score for the model. */
export function verdictsFor(entry, { figures, thresholds, caps = {}, parts = PARTS } = {}) {
  return deepFreeze(parts.map((part) => partVerdict({ entry, part, figures, thresholds, caps })));
}

/** R39 — re-rate stored figures under a new threshold table: no model call, nothing stored rewritten. */
export function rerate(figures, thresholds, { entry = {}, caps = {}, parts = PARTS } = {}) {
  return verdictsFor(entry, { figures, thresholds, caps, parts });
}

/** R39 — an entry tested under an older bank reads `tested_on: <bank version>` until it is re-run. */
export function testedOn(record, currentBank) {
  const v = record?.suiteVersions?.bank;
  return isNonBlank(v) && v !== currentBank ? Object.freeze({ tested_on: v }) : null;
}

/* ------------------------------------------------------------------ R37, R38: the gate record */

/** R37 — the extended test-bar record (`ai-runs` R75 writes it; `run-rules` R19/R29 read it per entry). With
 *  Civicsmith's set run (R38), `set`, `set_version`, `false_alarm_rate` and `graded_by` are kept. */
export function gateRecord({ entry_id, part, verdict, limits = [], partial_coverage = false, figures = {}, suiteVersions,
  tier, run_ref, grade, source, at, set = null } = {}) {
  const rec = { entry_id, part, verdict, limits, partial_coverage: partial_coverage === true, figures, suiteVersions,
    tier, run_ref, grade, source, at };
  if (isObj(set)) Object.assign(rec, { set: set.set, set_version: set.set_version,
    false_alarm_rate: set.false_alarm_rate, graded_by: set.graded_by });
  const bad = checkGateRecord(rec);
  if (bad) return refuse("GATE_RECORD_UNFIT", { field: bad });
  if (!["T2", "T3"].includes(tier)) return refuse("GATE_RECORD_UNFIT", { field: "tier" });
  if (!["civicsmith", "bundle"].includes(source)) return refuse("GATE_RECORD_UNFIT", { field: "source" });
  if (grade !== gradeOf(source)) return refuse("GATE_RECORD_UNFIT", { field: "grade" });
  return deepFreeze({ ok: true, record: structuredClone(rec) });
}

/* ------------------------------------------------------------------ R40: the reasonableness reading */

/** R40 — a person's reading, kept apart from every verdict and labelled REPORTED. */
export function readingNote({ entry_id, part, rubric_version, sample_ids, outcome, reviewer, at } = {}) {
  if (!isNonBlank(entry_id) || !PARTS.includes(part) || !isNonBlank(rubric_version) || !Array.isArray(sample_ids)
    || !isNonBlank(outcome) || !isNonBlank(reviewer) || !isInstant(at)) return refuse("GATE_NOTE_INVALID");
  return deepFreeze({ ok: true, note: { entry_id, part, rubric_version, sample_ids: [...sample_ids], outcome, reviewer, at,
    words: "gate.note.reasonableness", grade: GRADES.REPORTED } });
}

/* ------------------------------------------------------------------ R61: grade */

/** R61 — the only place a grade is assigned: from the run's source, never from a manifest field. */
export function gradeOf(source) {
  if (source === "civicsmith") return GRADES.REPRODUCED;
  if (source === "bundle") return GRADES.REPORTED;
  return null;
}

const sameVersions = (a, b) => isObj(a) && isObj(b) && ["bank", "scorer", "thresholds", "image"].every((k) => a[k] === b[k]);

/** R61 — REPORTED results with no REPRODUCED one for the same subject and versions, for Bob to choose from. A
 *  REPRODUCED result is kept beside the REPORTED one, never an edit of it. */
export function awaitingReproduction(results) {
  const rs = Array.isArray(results) ? results : [];
  return deepFreeze(rs.filter((r) => r?.grade === GRADES.REPORTED && !rs.some((o) => o?.grade === GRADES.REPRODUCED
    && o.subject_id === r.subject_id && sameVersions(o.suiteVersions, r.suiteVersions)))
    .map((r) => ({ subject_id: r.subject_id, suiteVersions: r.suiteVersions, verdicts: r.verdicts ?? null, tested_at: r.tested_at })));
}

/* ------------------------------------------------------------------ R63: the results library's row */

/** R63 — the row the library publishes (`ai-catalogue` R43): parts with verdicts and limits, speed, task cost, who
 *  tested and when, grade, versions. No figures, transcript or exchange; no team name without `consent_ref`. A team's
 *  result builds a row only from a `verified` bundle. */
export function resultRow({ subject_id, verdicts, speed = null, task_cost = null, grade, suiteVersions, tested_at, tested_by,
  verification = null, consent_ref = null, team_name = null } = {}) {
  if (!isNonBlank(subject_id)) return refuse("GATE_ROW_INVALID", { field: "subject_id" });
  if (!["civicsmith", "team"].includes(tested_by)) return refuse("GATE_ROW_INVALID", { field: "tested_by" });
  if (tested_by === "team" && verification !== "verified") return refuse("GATE_ROW_UNVERIFIED");
  if (grade !== gradeOf(tested_by === "team" ? "bundle" : "civicsmith")) return refuse("GATE_ROW_INVALID", { field: "grade" });
  if (!isInstant(tested_at)) return refuse("GATE_ROW_INVALID", { field: "tested_at" });
  if (!isObj(suiteVersions)) return refuse("GATE_ROW_INVALID", { field: "suiteVersions" });
  const parts = {};
  for (const v of Array.isArray(verdicts) ? verdicts : []) {
    if (!PARTS.includes(v?.part)) return refuse("GATE_ROW_INVALID", { field: "verdicts" });
    parts[v.part] = { verdict: v.verdict, limits: [...(v.limits ?? [])] };
  }
  const row = { subject_id, parts, speed, task_cost, tested_by, grade, suiteVersions: { ...suiteVersions }, tested_at,
    repeated_by_civicsmith: false };
  if (isNonBlank(consent_ref) && isNonBlank(team_name)) Object.assign(row, { consent_ref, team_name });
  return deepFreeze({ ok: true, row });
}

/* ------------------------------------------------------------------ R67: the statistical join */

const monthsBefore = (at, months) => { const d = new Date(at); d.setUTCMonth(d.getUTCMonth() - months); return d.getTime(); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** R67 — Bob's "statistically joined": results active at `at` (tested less than `activeMonths` before it) and scored
 *  under `suiteVersions`' bank and scorer (an older one first re-scored by `rescore`, else counted in `left_out`) are
 *  pooled per (subject, part): k and n summed per group, the Wilson interval and `partVerdict` on the pooled figures,
 *  the union of limits, the median of speed medians and the largest p90, the lowest low and highest high cost, the
 *  count by grade. Returns `ai-catalogue` R55's records. */
export function combineResults(results, { at, activeMonths, suiteVersions, thresholds, rescore = null } = {}) {
  if (!isInstant(at) || !isCount(activeMonths) || !isObj(suiteVersions)) return refuse("GATE_COMBINE_INPUT");
  const from = monthsBefore(at, activeMonths), to = Date.parse(at);
  let left_out = 0;
  const kept = [];
  for (const r0 of Array.isArray(results) ? results : []) {
    const t = Date.parse(r0?.tested_at);
    if (!Number.isFinite(t) || t < from || t > to) continue;
    let r = r0;
    if (r.suiteVersions?.bank !== suiteVersions.bank || r.suiteVersions?.scorer !== suiteVersions.scorer) {
      r = typeof rescore === "function" ? rescore(r0) : null;
      if (!r) { left_out++; continue; }
    }
    kept.push(r);
  }
  const bySubject = new Map();
  for (const r of kept) for (const part of Object.keys(r.figures ?? {})) {
    const k = `${r.subject_id}\n${part}`;
    if (!bySubject.has(k)) bySubject.set(k, { subject_id: r.subject_id, part, rs: [] });
    bySubject.get(k).rs.push(r);
  }
  const records = [];
  for (const { subject_id, part, rs } of bySubject.values()) {
    const pooled = {};
    for (const r of rs) for (const [g, f] of Object.entries(r.figures[part] ?? {})) {
      const a = (pooled[g] ??= { k: 0, n: 0, not_run: 0, not_applicable: 0 });
      a.k += f.k; a.n += f.n; a.not_run += f.not_run ?? 0; a.not_applicable += f.not_applicable ?? 0;
    }
    const groups = Object.fromEntries(Object.entries(pooled).map(([g, a]) => [g, figure(a.k, a.n, a.not_run, a.not_applicable)]));
    const limits = [];
    for (const r of rs) for (const l of r.limits?.[part] ?? [])
      if (!limits.some((x) => x.kind === l.kind && x.value === l.value)) limits.push(l);
    const v = partVerdict({ entry: {}, part, figures: { [part]: groups }, thresholds });
    const speeds = rs.map((r) => r.speed).filter((s) => isObj(s) && typeof s.median_ms === "number");
    const costs = rs.map((r) => r.task_cost).filter((c) => isObj(c) && typeof c.low === "number");
    const reproduced = rs.filter((r) => r.grade === GRADES.REPRODUCED).length;
    const verdict = v.verdict === "passes" && limits.length ? "passes_with_limits" : v.verdict;
    records.push({
      subject_id, part, as_of: at, window: { from: new Date(from).toISOString(), to: at },
      results: { total: rs.length, reproduced, reported: rs.length - reproduced }, left_out,
      groups: Object.fromEntries(Object.entries(groups).map(([g, f]) => [g, { k: f.k, n: f.n, wilson_low: f.wilson_low, wilson_high: f.wilson_high }])),
      verdict, limits,
      speed: speeds.length ? { median_ms: median(speeds.map((s) => s.median_ms)), p90_ms: Math.max(...speeds.map((s) => s.p90_ms ?? 0)) } : null,
      task_cost: costs.length ? { low: Math.min(...costs.map((c) => c.low)), high: Math.max(...costs.map((c) => c.high)),
        unit: costs[0].unit ?? null, price_date: costs[0].price_date ?? null } : null,
      suiteVersions: { ...suiteVersions }, confirmed: reproduced === rs.length,
    });
  }
  return deepFreeze({ ok: true, records, left_out });
}

/* ------------------------------------------------------------------ R64: the parts refused */

/** R64 — the parts the entry has not passed (`not_suitable` or `not_yet_rated`, as `run-rules` R19's `gateAdmits`
 *  decides: only `passes` and `passes_with_limits` admit), each with the words key that names the chosen AI. */
export function partsRefused(entry) {
  const gate = isObj(entry?.gate) ? entry.gate : {};
  return deepFreeze(PARTS.filter((p) => !["passes", "passes_with_limits"].includes(gate[p]?.verdict))
    .map((part) => ({ part, entry_id: entry?.entry_id ?? null, words: "ai.refused.partnotpassed" })));
}
