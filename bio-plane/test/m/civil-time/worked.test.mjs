/* R29: the worked examples of `build/plan/measures-T33/time-law.md` §3 are this module's tests. Each positive row
 * reaches its expected due and its negative control is not reached; E1 and E2's published answers are not matched;
 * F1–F3 and the derived timed checks are tested as derived rows, labelled so (P7). The court rules (CCP §§ 1005,
 * 2030.260, 1013, 1010.6) are given to `evaluateRule` as rules in R26's shape; the records, claims, meeting and FOIA
 * rules are the first profile's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule } from "../../../src/civil-time/index.mjs";
import { firstView, ruleOf, day, minute, need, single, practiceDue, answered } from "./helpers.mjs";
/** @import { Rule, When, RuleDue } from "../../../src/civil-time/kinds.mjs" */

const Z = "America/Los_Angeles";
/** @typedef {{ units: string, amount: number, count: string, citation?: string, direction?: string, roll?: boolean }} Count */
/** A court rule in R26's shape: the part every row shares, and the row's own count.
 * @param {Count} over
 * @returns {Rule} */
const court = (over) => {
  /** @type {Rule} */
  const rule = { rule: "court", applies_to: "claim", starts: "served", computation: "ccp_12", closures: "judicial",
                 citation: over.citation ?? "Code Civ. Proc.", status: "researched", basis: "2026-10-05", units: over.units, amount: over.amount, count: over.count };
  const direction = over.direction, roll = over.roll;
  if (direction !== undefined) rule.direction = direction;
  if (roll !== undefined) rule.roll = roll;
  return rule;
};
/** @type {(r: RuleDue) => string} */
const dueOf = (r) => single(r.due).value;
/** @type {(rule: Rule, anchor: When) => RuleDue} */
const run = (rule, anchor) => answered(evaluateRule({ rule, anchor, view: firstView() }));
/** @param {string} name
 * @param {Rule} rule
 * @param {When} anchor
 * @param {string} expected
 * @param {string} [negative]
 * @returns {RuleDue} */
function row(name, rule, anchor, expected, negative) {
  const r = run(rule, anchor);
  const got = dueOf(r);
  assert.equal(got, expected, `${name}: expected ${expected}`);
  if (negative) assert.notEqual(got, negative, `${name}: the negative control ${negative} is reached`);
  return r;
}

const ccp1005 = court({ units: "days", amount: 16, count: "business", direction: "backward", citation: "Code Civ. Proc. § 1005(b)" });
const ccp1005mail = court({ units: "days", amount: 5, count: "calendar", direction: "backward", roll: true, citation: "Code Civ. Proc. § 1005(b), mail" });
/** @type {(n: number, roll?: boolean) => Rule} */
const days = (n, roll = true) => court({ units: "days", amount: n, count: "calendar", roll });

test("R29 P1: 16 court days back from a hearing on Mon 2018-06-18, Memorial Day not counted, is 2018-05-24 (never 05-25)", () => {
  const r = row("P1", ccp1005, day("2018-06-18", Z), "2018-05-24", "2018-05-25");
  assert.ok((r.trace.skipped || []).some((s) => s.day === "2018-05-28" && s.why.includes("Memorial")));
});

test("R29 P2: the mail period's 5 calendar days back from P1's day rolls back from Sat 2018-05-19 to Fri 2018-05-18", () => {
  const p1 = run(ccp1005, day("2018-06-18", Z));
  const r = row("P2", ccp1005mail, single(p1.due), "2018-05-18", "2018-05-19");
  assert.deepEqual((r.trace.roll || []).map((x) => [x.from, x.to]), [["2018-05-19", "2018-05-18"]]);
});

test("R29 P3: 30 calendar days from service on 2026-04-01 under CCP § 12 is Fri 2026-05-01 (the first day is not counted)", () => {
  row("P3", days(30), day("2026-04-01", Z), "2026-05-01", "2026-04-30");
});

test("R29 P4: 20 calendar days from Fri 2026-04-03 is Thu 2026-04-23: a court holiday inside the period has no effect", () => {
  row("P4", days(20), day("2026-04-03", Z), "2026-04-23", "2026-04-24");
});

test("R29 P5: 30 days from 2020-10-01 ends on Sat 10-31 and rolls under CCP § 12a to Mon 2020-11-02", () => {
  row("P5", days(30), day("2020-10-01", Z), "2020-11-02", "2020-10-31");
});

test("R29 P6: 16 court days back from Fri 2020-10-30 on the 2020 calendar (Columbus Day then a judicial holiday) is 2020-10-07", () => {
  row("P6", ccp1005, day("2020-10-30", Z), "2020-10-07", "2020-10-08");
});

test("R29 E1 (negative only): 30 days plus CCP § 1013(a)'s 5 mail days from 2020-10-01 is 2020-11-05; the published 11-06 is not matched", () => {
  const r = run(court({ units: "days", amount: 35, count: "calendar", roll: true, citation: "Code Civ. Proc. §§ 1013(a), 12a" }), day("2020-10-01", Z));
  assert.equal(dueOf(r), "2020-11-05");
  assert.notEqual(dueOf(r), "2020-11-06");
});

test("R29 E2 (negative only): 30 days then CCP § 1010.6's 2 court days, counted from day 30, is 2020-11-03; the published 11-04 is not matched", () => {
  const thirty = run(days(30, false), day("2020-10-01", Z));
  assert.equal(dueOf(thirty), "2020-10-31");
  const r = run(court({ units: "days", amount: 2, count: "business", citation: "Code Civ. Proc. § 1010.6" }), single(thirty.due));
  assert.equal(dueOf(r), "2020-11-03");
  assert.notEqual(dueOf(r), "2020-11-04");
});

test("R29 R1: six months from the mailing of a rejection on 2023-11-17 is 2024-05-17 (Gov. Code § 945.6(a)(1))", () => {
  row("R1", ruleOf(firstView(), "claim_suit_after_rejection"), day("2023-11-17", Z), "2024-05-17", "2024-05-18");
});

test("R29 C1: a special meeting on Mon 2026-10-19 is timely noticed by noon on Fri 2026-10-16; 12:01 is late (OMC 2.20.070(C))", () => {
  const r = row("C1", ruleOf(firstView(), "omc_special_meeting_monday"), minute("2026-10-19T18:00", Z), "2026-10-16T12:00");
  const due = single(r.due);
  assert.notEqual(due.value, "2026-10-16T12:01");
  assert.equal(due.precision, "minute");
});

/** @type {() => Rule} */
const cpra = () => ruleOf(firstView(), "records_response");
/** A records request received `from` is due `expected` on the law's calendar and on the City's practice alike.
 * @type {(name: string, from: string, expected: string, negative: string) => void} */
const lawAndPractice = (name, from, expected, negative) => {
  const r = row(name, cpra(), day(from, Z), expected, negative);
  assert.equal(single(practiceDue((r.observed || [])[0]).due).value, expected);
};
test("R29 O1: a records request received 2026-10-05 is due 2026-10-15 (10 days), on the law's calendar and on the City's practice alike", () => {
  lawAndPractice("O1", "2026-10-05", "2026-10-15", "2026-10-14");
});
test("R29 O2: a records request received 2026-10-01 is due 2026-10-12 (Sun rolls to Mon), on the law's calendar and on the City's practice alike", () => {
  lawAndPractice("O2", "2026-10-01", "2026-10-12", "2026-10-11");
});
test("R29 O3: a records request received 2026-09-30 is due 2026-10-12 (Sat rolls to Mon), on the law's calendar and on the City's practice alike", () => {
  lawAndPractice("O3", "2026-09-30", "2026-10-12", "2026-10-10");
});
test("R29 O4: a records request received 2026-08-26 is due 2026-09-08 (Sat, Sun and Labor Day roll to Tue), on the law's calendar and on the City's practice alike", () => {
  lawAndPractice("O4", "2026-08-26", "2026-09-08", "2026-09-07");
});
test("R29 O5: a records request received 2026-10-02 is due 2026-10-12 (Columbus Day is not a closure), on the law's calendar and on the City's practice alike", () => {
  lawAndPractice("O5", "2026-10-02", "2026-10-12", "2026-10-13");
});

test("R29 O6 and N6: received Tue 2026-09-15, the law (CCP §§ 12a, 135) answers Mon 2026-09-28; the City's practice, Fri 2026-09-25, is answered beside it, labelled", () => {
  const r = row("N6", cpra(), day("2026-09-15", Z), "2026-09-28", "2026-09-25");
  const observed = need(r.observed, "the practice's answers");
  assert.equal(observed.length, 1);
  const practice = practiceDue(observed[0]);
  assert.equal(practice.label, "observed practice");
  assert.equal(practice.closures, "city");
  assert.equal(single(practice.due).value, "2026-09-25", "O6: the City's practice");
});

/** @type {() => Rule} */
const foia = () => ruleOf(firstView(), "foia_response");
test("R29 F1 (derived row): FOIA's 20 working days from Mon 2026-10-05, Columbus Day not counted, is Tue 2026-11-03", () => {
  row("F1", foia(), day("2026-10-05", Z), "2026-11-03", "2026-11-02");
});
test("R29 F2 (derived row): FOIA's 10-working-day extension, Veterans Day not counted, is Wed 2026-11-18", () => {
  const r = run(foia(), day("2026-10-05", Z));
  const extended = single(need(r.extension, "the extension").due).value;
  assert.notEqual(extended, "2026-11-17");
  assert.equal(extended, "2026-11-18");
});
test("R29 F3 (derived row): FOIA from Wed 2026-11-04, Veterans Day and Thanksgiving not counted, is Fri 2026-12-04", () => {
  row("F3", foia(), day("2026-11-04", Z), "2026-12-04", "2026-12-03");
});

test("R29 derived timed check: the Brown Act's 72 hours before a regular meeting on Tue 2026-10-20 18:00 is Sat 2026-10-17 18:00 (not 18:01)", () => {
  const r = row("Brown", ruleOf(firstView(), "agenda_posting_regular"), minute("2026-10-20T18:00", Z), "2026-10-17T18:00", "2026-10-17T18:01");
  assert.equal(single(r.due).precision, "minute");
});

test("R29 derived timed check: OMC's 48 business hours before Wed 2026-10-14 18:00 is Mon 2026-10-12 18:00 (Columbus Day is not a City holiday; K1513)", () => {
  row("OMC48", ruleOf(firstView(), "omc_special_meeting_notice"), minute("2026-10-14T18:00", Z), "2026-10-12T18:00", "2026-10-09T18:00");
});
