/* load-check R5, R6: interpretation seeded at the three densities through the members' acts, measured by the gauge
 * and judged against the budgets; the interpretation ceiling report states from it. */
import test from "node:test";
import assert from "node:assert/strict";
import { runProfile, seedCopy, report, ceilingOf, CEILING_FACTOR, STRESS_PAGES } from "../../../src/load-check/index.mjs";
import { budgetOf } from "../../../src/read-bounds.mjs";
import { fixtureCopy, profile, fast, INTERPRETATION_ACTS, INTERPRETATION_READS } from "./fixture-copy.mjs";

/* screens only in the ramp, so every interpretation row the copy holds came from the densities */
const screensOnly = (interpretation) => profile({
  items: { home: { weight: 25, reads: ["whoami", "queue"] }, proposalsScreen: { weight: 10, reads: ["proposals"] } },
  interpretation: { acts: INTERPRETATION_ACTS, reads: INTERPRETATION_READS, screens: ["proposalsScreen"], ...interpretation },
});

async function measured(opts = {}, interpretation = {}) {
  const copy = fixtureCopy(opts);
  await seedCopy(copy, { database_bytes: 3000000, r2_bytes: 6000000, mix: "text", stress_pages: STRESS_PAGES }, { seed_id: "p3dev-load-r5" });
  const r = await runProfile(copy, screensOnly(interpretation), [5, 10], fast);
  return { copy, r };
}

test("R5 a seeded copy's measured rows per part equal the change the gauge reports", async () => {
  const { copy, r } = await measured();
  const ds = r.interpretation.densities;
  assert.deepEqual(Object.keys(ds), ["ordinary", "heavy", "stress"]);
  let total = 0;
  for (const [name, d] of Object.entries(ds)) {
    assert.ok(d.landed > 0, `${name} ${JSON.stringify(d)}`);
    assert.equal(d.landed, d.parts, `${name}: every part landed`);
    assert.equal(d.rows_per_part * d.landed, d.rows_added, name);
    /* the copy adds one row an act, two acts a part */
    assert.equal(d.rows_per_part, INTERPRETATION_ACTS.length, name);
    assert.equal(d.bytes_per_part.database, 300 * INTERPRETATION_ACTS.length, name);
    assert.ok(Number.isFinite(d.hold.median), name);
    total += d.rows_added;
  }
  assert.equal(total, copy.state.interpretation_rows);
  assert.equal(ds.stress.parts, STRESS_PAGES);
  for (const k of Object.keys(INTERPRETATION_READS)) assert.ok(Number.isFinite(ds.stress.reads[k].p90), k);
  /* ordinary is a part per 20th page of the busiest 10 % of documents; heavy every 5th page of all */
  assert.ok(ds.ordinary.parts < ds.heavy.parts);
  assert.equal(ds.ordinary.documents, 1);
});

test("R5 no density passes a budget silently", async () => {
  /* interpretationOf takes 1,600 ms (read_act's p90 allows 1,500); the proposals screen slows once 10 rows are held */
  const latency = (op, members, state) => (op === "extractproposals" ? 1600 : op === "proposals" && state.interpretation_rows > 10 ? 3500 : 30);
  const { r } = await measured({ latency });
  const ds = r.interpretation.densities;
  assert.equal(ds.ordinary.held, true);
  assert.equal(ds.heavy.held, false);
  assert.ok(ds.heavy.breaks.some((b) => b.name === "proposalsScreen"));
  assert.equal(ds.stress.held, false);
  assert.ok(ds.stress.breaks.some((b) => b.name === "interpretationOf" && b.over === "p90"));
  /* a density that held has no time over its budget */
  for (const d of Object.values(ds).filter((x) => x.held)) {
    for (const [op, t] of Object.entries(d.acts)) assert.ok(t.p90 <= budgetOf("write_act").ceiling_ms * 1.5, op);
  }
});

test("R6 the ceiling of a seeded copy is at least the heavy density's total", async () => {
  const { r } = await measured();
  const c = ceilingOf(r);
  assert.ok(c.rows >= r.interpretation.densities.heavy.rows_total);
  assert.equal(c.rows, r.interpretation.densities.stress.rows_total);
  assert.equal(c.flagged, false);
  assert.equal(c.clears_ordinary, true);
  const [row] = report([r], { commit: "c", date: "2026-11-05", pm: { 1: "P-M9" } }).rows;
  assert.equal(row.interpretation_rows, c.rows);
  assert.deepEqual(row.interpretation_bytes, c.bytes);
});

test("R6 an unmeasured level has none", async () => {
  const copy = fixtureCopy();
  await seedCopy(copy, { database_bytes: 20000, r2_bytes: 40000, mix: "text" }, { seed_id: "p3dev-load-r6u" });
  const r = await runProfile(copy, profile(), [5], fast);
  assert.equal(ceilingOf(r), null);
  const [row] = report([r], { commit: "c", date: "2026-11-05" }).rows;
  assert.equal(row.interpretation_rows, null);
  assert.equal(row.interpretation_ceiling, null);
});

test("R6 a stress run refuses at the figure plus one", async () => {
  /* the screens break past 1,000 rows (heavy holds some hundreds, stress adds 10,000), so the ceiling is the heavy density's total; a copy holding that figure (extraction R119) refuses the next */
  const { r } = await measured({ latency: (op, m, state) => (op === "proposals" && state.interpretation_rows > 1000 ? 3500 : 30) });
  const figure = ceilingOf(r).rows;
  assert.equal(figure, r.interpretation.densities.heavy.rows_total);
  const { copy, r: again } = await measured({ figure });
  const stress = again.interpretation.densities.stress;
  assert.equal(stress.refused.code, "INTERPRETATION_CEILING");
  assert.equal(stress.refused.figure, figure);
  assert.equal(stress.refused.held, figure);
  assert.equal(copy.state.interpretation_rows, figure);
  assert.ok(stress.landed < stress.parts);
});

test("R6 control: a ceiling within a factor of 10 of the ordinary rate is flagged and not recorded as set", async () => {
  const { r } = await measured({ latency: (op, m, state) => (op === "proposals" && state.interpretation_rows > 2 ? 3500 : 30) });
  const c = ceilingOf(r);
  assert.equal(c.rows, r.interpretation.densities.ordinary.rows_total);
  assert.ok(c.rows < CEILING_FACTOR * c.ordinary_rows);
  assert.equal(c.flagged, true);
  assert.equal(c.set, false);
  const [row] = report([r], { commit: "c", date: "2026-11-05" }).rows;
  assert.equal(row.interpretation_rows, null);
  assert.equal(row.interpretation_bytes, null);
  assert.equal(row.interpretation_ceiling.flagged, true);
});
