/* civil-time's tests: the jurisdiction views every service is tested against (R27): the first profile and the test
 * profile, through `jurisdictions.combine`, on the profiles' own facts (T33-2 merged; K1526). The one fact added here
 * is a historical closure-list year the first profile does not hold and a worked example counts through (R1 reaches
 * 2024): fixture data for that example, with its citation (K1523). A year the profile holds is never replaced.
 * Beside them, the readers the tests take an answer apart with: each checks the answer's kind (R28: which kind of no)
 * and fails the test when it is another. */
import assert from "node:assert/strict";
import { combine } from "../../../../jurisdictions/index.mjs";
/** @import { Refusal, Undetermined, UndeterminedCode, RuleUndetermined, DateTime, View, Rule, HolidayEntry, ClosureDay, Due, ObservedDue, ObservedOpen } from "../../../src/civil-time/kinds.mjs" */
/** @import { FiscalPeriod } from "../../../src/civil-time/recurrence.mjs" */

/** @typedef {HolidayEntry & { citation: string, status: string }} SourcedYear a closure list's year with its source */
/** @typedef {Undetermined | Undetermined<string> | Undetermined<FiscalPeriod>} Open an undetermined answer that names no code */
/** @typedef {UndeterminedCode | RuleUndetermined} Coded an undetermined answer that names its code */

/** @type {(date: string, name: string) => ClosureDay} */
const h = (date, name) => ({ date, name });
/** @type {(list: string, year: number, days: ClosureDay[], citation: string, basis: string) => SourcedYear} */
const yearList = (list, year, days, citation, basis) => ({ year, list, days, citation, status: "researched", basis });

/* CCP § 135 judicial holidays, 2024, as the Superior Court's calendar lists them. */
/** @type {SourcedYear[]} */
const HISTORICAL = [
  yearList("judicial", 2024, [h("2024-01-01", "New Year's Day"), h("2024-01-15", "Martin Luther King Jr. Day"), h("2024-02-12", "Lincoln Day"),
    h("2024-02-19", "Washington Day"), h("2024-04-01", "Cesar Chavez Day (observed)"), h("2024-05-27", "Memorial Day"),
    h("2024-06-19", "Juneteenth"), h("2024-07-04", "Independence Day"), h("2024-09-02", "Labor Day"), h("2024-09-09", "Admission Day"),
    h("2024-09-27", "Native American Day"), h("2024-11-11", "Veterans Day"), h("2024-11-28", "Thanksgiving Day"),
    h("2024-11-29", "Day after Thanksgiving"), h("2024-12-25", "Christmas Day")], "Code Civ. Proc. § 135 (2024)", "2026-10-05"),
];

/** @param {string} id
 * @param {SourcedYear[]} [extra]
 * @returns {View} */
function viewOf(id, extra = []) {
  const r = combine([id]);
  if (!r.ok) throw new Error(`combine([${id}]) failed: ${JSON.stringify(r.errors)}`);
  const v = r.view;
  for (const x of extra) {
    /** @type {(y: HolidayEntry) => boolean} */
    const sameYear = (y) => y.list === x.list && y.year === x.year;
    if (!v.holidays.some(sameYear)) v.holidays.push(x);
  }
  return v;
}

/** The first profile's view and the test profile's, each a fresh copy. */
/** @type {() => View} */
export const firstView = () => viewOf("oakland-alameda", HISTORICAL);
/** @type {() => View} */
export const testView = () => viewOf("test-port-ellery");
/** @param {View} view
 * @param {string} name
 * @returns {Rule} */
export const ruleOf = (view, name) => {
  const r = (view.deadlines || []).find((d) => d.rule === name);
  if (!r) throw new Error(`no rule ${name} in ${view.id}`);
  return r;
};
/** @type {(value: string, zone: string) => DateTime} */
export const day = (value, zone) => ({ value, precision: "day", zone });
/** @type {(value: string, zone: string) => DateTime} */
export const minute = (value, zone) => ({ value, precision: "minute", zone });

/** The test profile's zone and the first profile's, as their views state them.
 * @param {View} view
 * @returns {string} */
export function zoneOf(view) {
  const tz = view.time_zone, value = tz ? tz.value : undefined;
  if (value === undefined) throw new Error(`no time_zone in ${view.id}`);
  return value;
}

/**
 * A value a lookup found, else the test fails.
 * @template T
 * @param {T | undefined} x
 * @param {string} what
 * @returns {T}
 */
export function need(x, what) {
  if (x === undefined) return assert.fail(`${what} is not held`);
  return x;
}

/** A due that is one date (R17: not an uncertain date's candidates), else the test fails.
 * @param {Due | undefined} d
 * @returns {DateTime} */
export function single(d) {
  if (d === undefined) return assert.fail("no due");
  if ("candidates" in d) return assert.fail(`expected one date: ${JSON.stringify(d)}`);
  return d;
}

/** An uncertain due's candidates (R17), else the test fails.
 * @param {Due | undefined} d
 * @returns {DateTime[]} */
export function candidates(d) {
  if (d === undefined) return assert.fail("no due");
  if ("candidates" in d) return d.candidates;
  return assert.fail(`expected candidates: ${JSON.stringify(d)}`);
}

/** A practice calendar's due, answered beside the rule (R10), else the test fails.
 * @param {ObservedDue | ObservedOpen | undefined} o
 * @returns {ObservedDue} */
export function practiceDue(o) {
  if (o === undefined) return assert.fail("no practice answered");
  if ("due" in o) return o;
  return assert.fail(`expected the practice's due: ${JSON.stringify(o)}`);
}

/**
 * An answer that is a refusal (R28), else the test fails.
 * @template T
 * @param {T | Refusal} x
 * @returns {Refusal}
 */
export function refusal(x) {
  if (x !== null && typeof x === "object" && "refused" in x) return x;
  return assert.fail(`expected a refusal: ${JSON.stringify(x)}`);
}

/**
 * An answer that is undetermined and names no code (R28), else the test fails.
 * @template T
 * @param {T | Open | Refusal} x
 * @returns {Open}
 */
export function open(x) {
  if (x !== null && typeof x === "object" && "undetermined" in x && !("code" in x)) return x;
  return assert.fail(`expected an undetermined answer: ${JSON.stringify(x)}`);
}

/**
 * An answer that is undetermined and names its code (R16, R28), else the test fails.
 * @template T
 * @param {T | Coded | Refusal} x
 * @returns {Coded}
 */
export function coded(x) {
  if (x !== null && typeof x === "object" && "undetermined" in x && "code" in x) return x;
  return assert.fail(`expected an undetermined answer with its code: ${JSON.stringify(x)}`);
}

/**
 * An answer that is neither a refusal nor undetermined, else the test fails.
 * @template T
 * @param {T | Refusal | Open | Coded} x
 * @returns {T}
 */
export function answered(x) {
  if (x !== null && typeof x === "object" && ("refused" in x || "undetermined" in x)) return assert.fail(`expected an answer: ${JSON.stringify(x)}`);
  return x;
}
