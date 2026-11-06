/* report (R4, R6): the measured figures of completed runs as `P-M` rows of PLATFORM.md, one a level, the figures
 * runtime-limits' level rows read. An interrupted run records nothing, so a level's `measured` stays null until a
 * row is recorded (runtime-limits R38, R39). */
import { appendFileSync } from "node:fs";
import { READ_BOUNDS } from "../read-bounds.mjs";

const LEVEL_NAMES = Object.freeze(["team", "institution", "enterprise"]);
/* the ceiling is flagged for Bob, not set, when it is within this factor of the ordinary rate (PL45) */
export const CEILING_FACTOR = 10;

/* R6: a level's interpretation ceiling from a run's densities: the rows held by the last density at which the
 * interpretation screens still held at the rated members, less what those rows would take past the record bound
 * (database and stored files apart); null for a run that measured none */
export function ceilingOf(result, opts = {}) {
  const it = result?.interpretation;
  if (!result?.completed || !it || !it.densities) return null;
  const row = READ_BOUNDS.level[LEVEL_NAMES[result.level - 1]];
  const ds = Object.values(it.densities).filter((d) => !d.skipped);
  if (!ds.length) return null;
  let held = null;
  for (const d of ds) { if (!d.held) break; held = d; }
  let rows = held ? held.rows_total : 0;
  const per = held && held.rows_total > 0 ? { database: held.bytes_total.database / held.rows_total, r2: held.bytes_total.r2 / held.rows_total } : null;
  /* the room left under the record bound, by store */
  if (per) {
    for (const store of ["database", "r2"]) {
      const bound = row.record_bytes[store];
      const used = store === "database" ? result.seed?.database_bytes : result.seed?.r2_bytes;
      if (Number.isFinite(bound) && Number.isFinite(used) && per[store] > 0) rows = Math.min(rows, Math.max(0, Math.floor((bound - used) / per[store])));
    }
  }
  const ordinary = it.densities.ordinary && !it.densities.ordinary.skipped ? it.densities.ordinary.rows_added : null;
  const heavy = it.densities.heavy && !it.densities.heavy.skipped && it.densities.heavy.documents
    ? (it.densities.heavy.rows_added / it.densities.heavy.documents) * (opts.rated_documents ?? result.seed?.documents ?? 0) : null;
  const flagged = !(ordinary > 0) || rows < CEILING_FACTOR * ordinary;
  return {
    rows, bytes: per ? { database: Math.round(rows * per.database), r2: Math.round(rows * per.r2) } : { database: 0, r2: 0 },
    ordinary_rows: ordinary, heavy_rows_at_rated: heavy === null ? null : Math.round(heavy),
    clears_ordinary: ordinary !== null && rows >= ordinary, clears_heavy: heavy !== null && rows >= heavy,
    flagged, set: !flagged,
  };
}

const p90Range = (steps) => {
  const xs = steps.flatMap((s) => Object.values(s.items).map((i) => i.p90)).filter(Number.isFinite);
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
};

/* R4: one row for each level that has a completed run (the last given wins); none for an interrupted run.
 * opts = { commit, date, pm: {<level>: "P-M<n>"}, rated_documents, path } — with `path`, the rows' lines are appended there */
export function report(results, opts = {}) {
  const list = (Array.isArray(results) ? results : [results]).filter((r) => r && r.completed === true && r.interrupted !== true);
  const byLevel = new Map();
  for (const r of list) byLevel.set(r.level, r);
  const rows = [];
  for (const [level, r] of [...byLevel].sort((a, b) => a[0] - b[0])) {
    const all = [...r.steps, ...(r.broken ? [r.broken] : [])];
    const costs = all.map((s) => s.cost);
    const ceiling = ceilingOf(r, opts);
    rows.push({
      pm: opts.pm?.[level] ?? null, level, level_name: LEVEL_NAMES[level - 1],
      members_at_once: r.rated,
      record_bytes: { database: r.seed?.database_bytes ?? null, r2: r.seed?.r2_bytes ?? null },
      upload_bytes: r.seed?.upload_bytes ?? null,
      cost: costs.length && costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) : null,
      first_broken: r.broken ? [...r.broken.broke, ...(r.broken.failing ? ["error_share"] : [])] : [],
      interpretation_rows: ceiling?.set ? ceiling.rows : null,
      interpretation_bytes: ceiling?.set ? ceiling.bytes : null,
      interpretation_ceiling: ceiling,
      copy: r.copy, commit: opts.commit ?? null, date: opts.date ?? null, walkers: "none",
      samples: r.samples, range: { members: all.length ? [all[0].members, all[all.length - 1].members] : null, p90_ms: p90Range(all) },
      measured: true,
    });
  }
  const text = rows.map(lineOf).join("\n");
  if (opts.path && rows.length) appendFileSync(opts.path, `${text}\n`);
  return { rows, text };
}

const f = (v) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const lineOf = (r) => `| ${[r.pm, `Level ${r.level} (${r.level_name})`, r.members_at_once, f(r.record_bytes), r.upload_bytes, r.cost,
  r.first_broken.join(", ") || "none", r.interpretation_ceiling ? `${r.interpretation_ceiling.rows}${r.interpretation_ceiling.flagged ? " (flagged for Bob, not set)" : ""}` : "—",
  r.copy, r.commit, r.date, r.walkers, r.samples, f(r.range)].map(f).join(" | ")} |`;
