/* jurisdictions, T47 (T47-2; N971): R88, `COUNTERPARTY_LEVELS`, the one vocabulary of an office's level (R24), exported
 * for a caller offering it (setup-page R5). Tested at the module's interface: the export, validate and the held profiles.
 * Every refusal is shown beside a well-formed control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, COUNTERPARTY_LEVELS, LAW_LEVELS } from "../index.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/* a held profile with its first counterparty's level changed (or removed, for undefined) */
const withLevel = (id, level, i = 0) => {
  const p = get(id);
  if (level === undefined) delete p.counterparties[i].level; else p.counterparties[i].level = level;
  return validate(p);
};

test("R88 COUNTERPARTY_LEVELS is exported: state, county, city, district, in that order, frozen", async () => {
  assert.ok(Array.isArray(COUNTERPARTY_LEVELS));
  assert.deepEqual([...COUNTERPARTY_LEVELS], ["state", "county", "city", "district"]);
  assert.ok(Object.isFrozen(COUNTERPARTY_LEVELS));
  /* frozen: no caller can change the one vocabulary (a module is strict code, so each attempt throws) */
  assert.throws(() => { COUNTERPARTY_LEVELS.push("region"); }, TypeError);
  assert.throws(() => { COUNTERPARTY_LEVELS[0] = "region"; }, TypeError);
  assert.throws(() => { COUNTERPARTY_LEVELS.length = 0; }, TypeError);
  assert.throws(() => { COUNTERPARTY_LEVELS.sort(); }, TypeError);
  assert.deepEqual([...COUNTERPARTY_LEVELS], ["state", "county", "city", "district"], "unchanged after every attempt");
  /* one vocabulary: every import of the module reads the same list */
  const again = await import("../index.mjs");
  assert.equal(again.COUNTERPARTY_LEVELS, COUNTERPARTY_LEVELS);
});

test("R88 validate reads COUNTERPARTY_LEVELS: a counterparty level is accepted exactly when it is one of them, else LEVEL_UNKNOWN", () => {
  for (const id of [FIRST, TEST]) {
    const p = get(id);
    assert.ok(p.counterparties.length, `${id} holds counterparties`);
    /* controls: every level of the list, on every counterparty of the profile, is accepted */
    for (const level of COUNTERPARTY_LEVELS)
      p.counterparties.forEach((c, i) => {
        const r = withLevel(id, level, i);
        assert.deepEqual(r, { ok: true, errors: [] }, `${id} counterparties[${i}] ${level}`);
      });
    /* refusals: anything outside the list, the law levels it lacks and D-149's local among them, and an absent level */
    for (const level of ["federal", "local", "regional", "national", "municipal", "State", "CITY", " city", "city ", "",
      "state,county", null, 0, 1, true, ["city"], { level: "city" }, undefined]) {
      const r = withLevel(id, level);
      assert.equal(r.ok, false, `${id} ${JSON.stringify(level)}`);
      assert.ok(hasError(r, "LEVEL_UNKNOWN", "counterparties[0].level"), `${id} ${JSON.stringify(level)}`);
      assert.deepEqual(r.errors.map((e) => [e.path, e.code]), [["counterparties[0].level", "LEVEL_UNKNOWN"]],
        `${id} ${JSON.stringify(level)}: that fault only`);
    }
  }
  /* the accepted set is the list, over every level either vocabulary names: nothing more, nothing less */
  for (const level of new Set([...COUNTERPARTY_LEVELS, ...LAW_LEVELS]))
    assert.equal(withLevel(TEST, level).ok, COUNTERPARTY_LEVELS.includes(level), level);
  /* every held office's level is one of them */
  for (const id of [FIRST, TEST]) for (const c of get(id).counterparties)
    assert.ok(COUNTERPARTY_LEVELS.includes(c.level), `${id} ${c.role}`);
});

test("R88 an office's level is not a law's level (R31): district is no law level, federal no office level", () => {
  assert.notDeepEqual([...COUNTERPARTY_LEVELS], [...LAW_LEVELS]);
  assert.ok(!LAW_LEVELS.includes("district") && COUNTERPARTY_LEVELS.includes("district"));
  assert.ok(LAW_LEVELS.includes("federal") && !COUNTERPARTY_LEVELS.includes("federal"));
  /* a law's level is judged by R31's list, never this one */
  const law = (level) => { const p = get(TEST); p.records_laws[0].level = level; return validate(p); };
  assert.ok(hasError(law("district"), "LEVEL_UNKNOWN", "records_laws[0].level"), "district is no law level");
  assert.ok(law("federal").ok, "control: federal is a law level");
  assert.ok(hasError(withLevel(TEST, "federal"), "LEVEL_UNKNOWN", "counterparties[0].level"), "federal is no office level");
  assert.ok(withLevel(TEST, "district").ok, "control: district is an office level");
});
