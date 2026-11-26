/* civil-time at its interface: time rules (R9–R17), basis kinds (R18), overdue (R19), spans (R24) and traces (R25),
 * each against the first profile's view and the test profile's (R27), on the profiles' own facts. The test profile's
 * weekend is Sunday alone, so no answer below can come from an assumed weekend. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule, due, overdueOn, span } from "../../../src/civil-time/index.mjs";
import { firstView, testView, ruleOf, day, minute, zoneOf, need, single, candidates, practiceDue, refusal, open, coded, answered } from "./helpers.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { reasonText } from "../../../src/civil-time/index.mjs";
/** @import { EvaluateArgs } from "../../../src/civil-time/rules.mjs" */
/** @import { Extension, View, Rule, When, Unsettled, Refusal, RuleDue, RuleUndetermined, BasisOf, StatedDue, Due, DateTime, Office, Tolled, FactOf, CalendarFact, ClosureDay, HolidayEntry, Conflict, UndeterminedCode, Reason, SpanAnswer, ExtensionTrace, ExtensionUndetermined } from "../../../src/civil-time/kinds.mjs" */

/** @typedef {RuleDue | RuleUndetermined | Refusal} RuleAnswer */
/** @typedef {{ office?: Office, tolled?: Tolled[], factOf?: FactOf, practice?: string }} Beside what a call names beside the rule */

const LA = "America/Los_Angeles", HFX = "America/Halifax";
/** @param {Rule} rule
 * @param {When | Unsettled} anchor
 * @param {View} view
 * @param {Beside} [extra]
 * @returns {RuleAnswer} */
function evalWith(rule, anchor, view, extra = {}) {
  const office = extra.office, tolled = extra.tolled, factOf = extra.factOf, practice = extra.practice;
  /** @type {EvaluateArgs} */
  const args = { rule, anchor, view };
  if (office !== undefined) args.office = office;
  if (tolled !== undefined) args.tolled = tolled;
  if (factOf !== undefined) args.factOf = factOf;
  if (practice !== undefined) args.practice = practice;
  return evaluateRule(args);
}
/** @type {(view: View, name: string, anchor: When | Unsettled, extra?: Beside) => RuleAnswer} */
const ev = (view, name, anchor, extra = {}) => evalWith(ruleOf(view, name), anchor, view, extra);
/** @type {(r: RuleAnswer) => string} */
const val = (r) => single(answered(r).due).value;
/** @type {(r: RuleAnswer) => RuleDue} */
const done = (r) => answered(r);
/** @typedef {{ units: string, amount?: number, count?: string, direction?: string, roll?: boolean | string, closures?: string | number,
 *  due_at?: string, applies_on?: string[] | string, extension?: Extension, computation?: string, basis?: string }} Form */
/** A rule in R26's shape for this test: the parts every custom rule shares, and its own form.
 * @param {Form} over
 * @returns {Rule} */
const custom = (over) => {
  /** @type {Rule} */
  const rule = { rule: "custom", applies_to: "claim", starts: "act", citation: "a test citation", status: "researched", basis: over.basis ?? "2026-10-05", units: over.units };
  const amount = over.amount, count = over.count, direction = over.direction, roll = over.roll, closures = over.closures;
  const dueAt = over.due_at, appliesOn = over.applies_on, extension = over.extension, computation = over.computation;
  if (amount !== undefined) rule.amount = amount;
  if (count !== undefined) rule.count = count;
  if (direction !== undefined) rule.direction = direction;
  if (roll !== undefined) rule.roll = roll;
  if (closures !== undefined) rule.closures = closures;
  if (dueAt !== undefined) rule.due_at = dueAt;
  if (appliesOn !== undefined) rule.applies_on = appliesOn;
  if (extension !== undefined) rule.extension = extension;
  if (computation !== undefined) rule.computation = computation;
  return rule;
};
/** A view's facts disagreeing about one path (`jurisdictions` R15).
 * @param {string} at
 * @returns {Conflict[]} */
const disagreeing = (at, says = "the profiles disagree") => {
  const conflict = { at, values: [], says };
  return [conflict];
};
/** An extension's trace where it was counted (R12, R25), else the test fails.
 * @type {(x: ExtensionTrace | ExtensionUndetermined | undefined) => ExtensionTrace} */
const extensionTrace = (x) => (x && "days" in x ? x : assert.fail(`no extension counted: ${JSON.stringify(x)}`));
/** The runtime's own statement of its tz or ICU version (`process.versions`), or "unknown", as a trace states it (R25).
 * @param {"tz" | "icu"} name
 * @returns {string} */
function hostVersion(name) {
  const p = globalThis.process;
  const held = "versions" in p ? p.versions : undefined;
  const o = typeof held === "object" && held !== null ? held : null;
  const tz = o && "tz" in o ? o.tz : undefined, icu = o && "icu" in o ? o.icu : undefined;
  const v = name === "tz" ? tz : icu;
  return typeof v === "string" && v ? v : "unknown";
}
/** @typedef {{ why?: string, value?: ClosureDay[] | HolidayEntry, corrected?: boolean, by?: string | null, at?: string | null,
 *  says?: string }} Said what a calendar reader says of an entry beside its status */
/** A calendar reader that gives every entry `status`, with what else it says (`action-clocks` R12's shape).
 * @type {(status: string, extra?: Said) => FactOf} */
const st = (status, extra = {}) => () => {
  /** @type {CalendarFact} */
  const fact = { status };
  const why = extra.why, value = extra.value, corrected = extra.corrected, by = extra.by, at = extra.at, says = extra.says;
  if (why !== undefined) fact.why = why;
  if (value !== undefined) fact.value = value;
  if (corrected !== undefined) fact.corrected = corrected;
  if (by !== undefined) fact.by = by;
  if (at !== undefined) fact.at = at;
  if (says !== undefined) fact.says = says;
  return fact;
};

test("R9 a day count: CCP § 12 (first day excluded, last included), forward and backward, calendar skipping nothing, business skipping every closed day", () => {
  const v = firstView(), t = testView();
  /* calendar: 10 days from 10-05 is 10-15 on both profiles' records rules (the first's a calendar count) */
  assert.equal(val(ev(v, "records_response", day("2026-10-05", LA))), "2026-10-15");
  /* business, test profile: weekend Sunday, 03-17 (Harbour Day) on its town list: Fri 13, Sat 14, Mon 16, Wed 18, Thu 19 */
  const r = ev(t, "records_answer", day("2026-03-12", HFX));
  assert.equal(val(r), "2026-03-19");
  const skipped = done(r).trace.skipped || [];
  assert.deepEqual(skipped.map((s) => s.day), ["2026-03-15", "2026-03-17"]);
  assert.match(need(skipped[0], "the first day skipped").why, /weekend \(sun\)/);
  assert.match(need(skipped[1], "the second day skipped").why, /Harbour Day \(town\)/);
  /* backward, business: 3 business days before Thu 2026-03-19 on the test profile: Wed 18, Mon 16, Sat 14 */
  const back = evaluateRule({ rule: custom({ units: "days", amount: 3, count: "business", direction: "backward", closures: "town" }),
                              anchor: day("2026-03-19", HFX), view: t });
  assert.equal(val(back), "2026-03-14");
  /* calendar counts skip nothing, closures or weekend */
  const cal = evaluateRule({ rule: custom({ units: "days", amount: 5, count: "calendar", closures: "town" }), anchor: day("2026-03-12", HFX), view: t });
  assert.equal(val(cal), "2026-03-17");
  assert.deepEqual(done(cal).trace.skipped, []);
});

test("R9 with no closures selector, the holiday entries for all offices and those naming the office; with one, that list alone", () => {
  const v = firstView();
  const one = custom({ units: "days", amount: 1, count: "business" });
  /* 2026-11-11 is on the State Controller's list (M-191), not on the City offices' (M-190) */
  assert.equal(val(evaluateRule({ rule: one, anchor: day("2026-11-10", LA), view: v, office: "City Council" })), "2026-11-11");
  assert.equal(val(evaluateRule({ rule: one, anchor: day("2026-11-10", LA), view: v, office: "State Controller" })), "2026-11-12");
  /* a venue's entries, named {venue: kind} */
  assert.equal(val(evaluateRule({ rule: one, anchor: day("2026-09-24", LA), view: v, office: { venue: "records_petition" } })), "2026-09-28");
  /* an office no entry names, with no entry for all offices: the year is not covered */
  const none = coded(evaluateRule({ rule: one, anchor: day("2026-11-10", LA), view: v, office: "Civil Grand Jury" }));
  assert.equal(none.undetermined, true);
  assert.equal(none.code, "CALENDAR_UNCOVERED");
  /* a selector: the federal list, whatever the office */
  assert.equal(val(evaluateRule({ rule: { ...one, closures: "federal" }, anchor: day("2026-10-09", LA), view: v, office: "City Council" })), "2026-10-13");
  /* the test profile: an entry for one office adds to every office's year */
  const t = testView();
  assert.equal(val(evaluateRule({ rule: one, anchor: day("2026-08-13", HFX), view: t, office: "Town Clerk" })), "2026-08-15", "Fri 14 is the Clerk's records day");
  assert.equal(val(evaluateRule({ rule: one, anchor: day("2026-08-13", HFX), view: t, office: "Selectboard" })), "2026-08-14");
});

test("R9 the weekend is never assumed: with no weekend fact, a business count or a roll is undetermined with why; a calendar count without a roll is not", () => {
  for (const make of [firstView, testView]) {
    const v = make();
    delete v.weekend;
    const zone = zoneOf(v);
    const b = coded(evaluateRule({ rule: custom({ units: "days", amount: 3, count: "business" }), anchor: day("2026-10-05", zone), view: v }));
    assert.equal(b.undetermined, true);
    assert.deepEqual(b.why, { key: "civil-time.missing.weekend_counting_absent", vars: {} });
    const roll = coded(evaluateRule({ rule: custom({ units: "days", amount: 3, count: "calendar", roll: true }), anchor: day("2026-10-05", zone), view: v }));
    assert.equal(roll.undetermined, true);
    const bh = coded(evaluateRule({ rule: custom({ units: "business_hours", amount: 3 }), anchor: minute("2026-10-05T10:00", zone), view: v }));
    assert.equal(bh.undetermined, true);
    assert.equal(val(evaluateRule({ rule: custom({ units: "days", amount: 3, count: "calendar" }), anchor: day("2026-10-05", zone), view: v })), "2026-10-08");
  }
});

test("R10 roll: a closed last day moves forward to the next open day, or backward to the previous; with no roll the last day stands", () => {
  const v = firstView();
  const r = ruleOf(v, "records_response");
  assert.equal(val(evaluateRule({ rule: r, anchor: day("2026-10-01", LA), view: v })), "2026-10-12");
  assert.equal(val(evaluateRule({ rule: { ...r, roll: undefined }, anchor: day("2026-10-01", LA), view: v })), "2026-10-11");
  /* test profile, backward (its filing_reply): 7 days before Mon 09-07 is Mon 08-31 (court vacation) → Sun 08-30 (weekend) → Sat 08-29 */
  const t = ev(testView(), "filing_reply", day("2026-09-07", HFX));
  assert.equal(val(t), "2026-08-29");
  assert.deepEqual(need((done(t).trace.roll || [])[0], "the roll").passed.map((p) => p.day), ["2026-08-31", "2026-08-30"]);
  /* and forward on a month period (its appeal_window): 06-30 + 2 months is Sun 08-30 → Mon 08-31 (closed) → Tue 09-01 */
  assert.equal(val(ev(testView(), "appeal_window", day("2026-06-30", HFX))), "2026-09-01");
});

test("R10 a statutory period rolls on the closures its law names; a practice calendar is answered beside it, labelled observed practice, never as the rule", () => {
  const v = firstView();
  const r = done(ev(v, "records_response", day("2026-09-15", LA)));
  assert.equal(single(r.due).value, "2026-09-28");
  assert.equal(r.trace.closures, "judicial");
  assert.deepEqual(need(r.observed, "the practices").map((o) => { const p = practiceDue(o); return [p.label, p.closures, single(p.due).value]; }), [["observed practice", "city", "2026-09-25"]]);
  /* a practice calendar the caller passes: answered beside, the rule's answer unchanged */
  const t = testView();
  /* the test profile's own observed list: the court closes 12-24 too (Tue 22, Wed 23, Thu 24, Sat 26, Mon 28 against Tue 29) */
  const o = done(ev(t, "records_answer", day("2026-12-21", HFX)));
  const oPractice = practiceDue((o.observed || [])[0]);
  assert.deepEqual([single(o.due).value, oPractice.closures, single(oPractice.due).value], ["2026-12-28", "court", "2026-12-29"]);
  const p = done(evaluateRule({ rule: { ...ruleOf(t, "records_answer"), observed: undefined }, anchor: day("2026-12-21", HFX), view: t, practice: "court" }));
  assert.equal(single(p.due).value, "2026-12-28");
  const pPractice = practiceDue((p.observed || [])[0]);
  assert.equal(pPractice.label, "observed practice");
  assert.equal(single(pPractice.due).value, "2026-12-29");
});

test("R11 hours count clock hours from the anchor's instant, forward or backward, across a daylight-saving change, and never roll", () => {
  const v = firstView();
  /** @type {(amount: number, direction: string, anchor: When) => RuleAnswer} */
  const h = (amount, direction, anchor) => evaluateRule({ rule: custom({ units: "hours", amount, direction }), anchor, view: v });
  assert.equal(val(h(24, "forward", minute("2026-11-01T00:00", LA))), "2026-11-01T23:00", "the 25-hour day");
  assert.equal(val(h(24, "backward", minute("2026-03-09T00:00", LA))), "2026-03-07T23:00", "the 23-hour day");
  const sat = h(72, "backward", minute("2026-10-20T18:00", LA));
  assert.equal(val(sat), "2026-10-17T18:00");
  assert.deepEqual(done(sat).trace.roll, [], "an hours due on a Saturday stands");
  assert.equal(single(done(sat).due).precision, "minute");
  /* a day-precision anchor has no time to count from */
  assert.equal(coded(h(24, "forward", day("2026-10-20", LA))).code, "ANCHOR_UNDETERMINED");
});

test("R11 business hours count only the hours of days not closed, forward and backward, on the rule's closure list", () => {
  const t = testView();
  /* its harbour_notice, 16 business hours back from Mon 03-16 10:00: Mon 10 h, Sun skipped, Sat 6 h → Sat 03-14 18:00 */
  assert.equal(val(ev(t, "harbour_notice", minute("2026-03-16T10:00", HFX))), "2026-03-14T18:00");
  /* forward: Sat 20:00 + 4 h, Sun skipped, Mon 12 h → Mon 03-16 12:00 */
  const fwd = evaluateRule({ rule: { ...ruleOf(t, "harbour_notice"), direction: "forward" }, anchor: minute("2026-03-14T20:00", HFX), view: t });
  assert.equal(val(fwd), "2026-03-16T12:00");
  assert.deepEqual((done(fwd).trace.skipped || []).map((s) => s.day), ["2026-03-15"]);
  /* across the holiday: back from Wed 03-18 06:00: Wed 6 h, Tue 03-17 (Harbour Day) skipped, Mon 10 h → Mon 03-16 14:00 */
  assert.equal(val(ev(t, "harbour_notice", minute("2026-03-18T06:00", HFX))), "2026-03-16T14:00");
  /* the first profile, OMC's 48 business hours on the City's list */
  assert.equal(val(ev(firstView(), "omc_special_meeting_notice", minute("2026-09-09T18:00", LA))), "2026-09-04T18:00", "Labor Day skipped");
});

test("R12 an extension is computed from the original due as R9–R10 count it; where its start is left open, an uncertain date with both candidates", () => {
  const v = firstView();
  /* FOIA: a business count ends on an open day, so both readings of the extension's start agree */
  /** @type {(r: RuleAnswer) => { due: Due, when: string | null, citation: string | null }} */
  const extension = (r) => need(done(r).extension, "the extension");
  assert.equal(single(extension(ev(v, "foia_response", day("2026-10-05", LA))).due).value, "2026-11-18");
  /* CPRA: day 10 is 09-25 (Native American Day, a judicial holiday), rolled to 09-28; +14 from either: 10-09 or 10-12 */
  const r = ev(v, "records_response", day("2026-09-15", LA));
  assert.deepEqual(candidates(extension(r).due).map((c) => c.value), ["2026-10-09", "2026-10-12"]);
  assert.match(extensionTrace(done(r).trace.extension).notes.join(" "), /K1504 \(2\)/);
  /* where both readings agree, one date */
  assert.equal(single(extension(ev(v, "records_response", day("2026-10-05", LA))).due).value, "2026-10-29");
  /* the test profile: due Sat 03-14; 5 business days more: Mon 16, (Tue 17 closed), Wed 18, Thu 19, Fri 20, Sat 21 */
  const t = ev(testView(), "records_answer", day("2026-03-09", HFX));
  assert.equal(single(done(t).due).value, "2026-03-14");
  const tExtension = extension(t);
  assert.equal(single(tExtension.due).value, "2026-03-21");
  assert.equal(tExtension.citation, "Test Stat. § 1.141");
});

test("R13 a month or year period lands on the same day-number; with no such day, the target month's last day and the next month's first", () => {
  const v = firstView();
  /** @type {(amount: number, units?: string) => Rule} */
  const m = (amount, units = "months") => custom({ units, amount });
  /** @type {(r: RuleAnswer) => string[]} */
  const both = (r) => candidates(done(r).due).map((c) => c.value);
  assert.equal(val(evaluateRule({ rule: m(6), anchor: day("2026-04-17", LA), view: v })), "2026-10-17");
  const end = evaluateRule({ rule: m(6), anchor: day("2026-08-31", LA), view: v });
  assert.deepEqual(both(end), ["2027-02-28", "2027-03-01"]);
  assert.deepEqual(both(evaluateRule({ rule: m(1), anchor: day("2028-01-31", LA), view: v })), ["2028-02-29", "2028-03-01"]);
  assert.deepEqual(both(evaluateRule({ rule: m(1, "years"), anchor: day("2024-02-29", LA), view: v })), ["2025-02-28", "2025-03-01"]);
  assert.deepEqual(both(evaluateRule({ rule: { ...m(3), direction: "backward" }, anchor: day("2026-05-31", LA), view: v })), ["2026-02-28", "2026-03-01"]);
  /* the test profile: 07-31 + 2 months has no 31st; and its own appeal_window rolls on the court list */
  assert.deepEqual(both(evaluateRule({ rule: m(2), anchor: day("2026-07-31", HFX), view: testView() })), ["2026-09-30", "2026-10-01"]);
  assert.deepEqual(val(ev(testView(), "appeal_window", day("2026-06-29", HFX))), "2026-08-29");
});

test("R14 tolled days are not counted; a rule due by close of business is due at the governing office's close, or at the day with why", () => {
  const v = firstView();
  /* 10 calendar days from 10-05 with 10-07..10-09 tolled: 10-18 (Sun), rolled to Mon 10-19 */
  const r = ev(v, "records_response", day("2026-10-05", LA), { tolled: [{ from: "2026-10-07", to: "2026-10-09" }] });
  assert.equal(val(r), "2026-10-19");
  assert.deepEqual((done(r).trace.skipped || []).filter((s) => s.why.includes("tolled")).map((s) => s.day), ["2026-10-07", "2026-10-08", "2026-10-09"]);
  assert.equal(refusal(ev(v, "records_response", day("2026-10-05", LA), { tolled: [{ from: "2026-10-09", to: "2026-10-07" }] })).refused, "DATE_INVALID");
  /* close of business: the test profile's registry_answer (4 business days, court list) at the Town Clerk's close,
     12:00 on Fridays */
  const t = testView();
  assert.deepEqual(done(ev(t, "registry_answer", day("2026-10-05", HFX), { office: "Town Clerk" })).due, { value: "2026-10-09T12:00", precision: "minute", zone: HFX });
  /* a due day the hours list no opening for (Saturday): the day, with why */
  const sat = done(ev(t, "registry_answer", day("2026-10-06", HFX), { office: "Town Clerk" }));
  assert.deepEqual(sat.due, { value: "2026-10-10", precision: "day", zone: HFX });
  assert.match((sat.trace.notes || []).join(" "), /close of business is undetermined/);
  /* the test profile's tolling: its claim_notice, 90 days from 01-05 is Sun 04-05 → Mon 04-06; with 03-01..03-03 tolled, Wed 04-08 */
  assert.equal(val(ev(t, "claim_notice", day("2026-01-05", HFX))), "2026-04-06");
  assert.equal(val(ev(t, "claim_notice", day("2026-01-05", HFX), { tolled: [{ from: "2026-03-01", to: "2026-03-03" }] })), "2026-04-08");
  /* the first profile: the City Auditor closes at 17:00; the City Council has no hours held */
  const cob = custom({ units: "days", amount: 2, count: "business", due_at: "close_of_business" });
  assert.equal(val(evaluateRule({ rule: cob, anchor: day("2026-10-05", LA), view: v, office: "City Auditor" })), "2026-10-07T17:00");
  const none = done(evaluateRule({ rule: cob, anchor: day("2026-10-05", LA), view: v, office: "City Council" }));
  assert.equal(single(none.due).value, "2026-10-07");
  assert.match((none.trace.notes || []).join(" "), /holds no hours/);
  /* a stated time */
  assert.equal(val(evaluateRule({ rule: { ...cob, due_at: "09:30" }, anchor: day("2026-10-05", LA), view: v, office: "City Council" })), "2026-10-07T09:30");
});

test("R15 the anchor: its local day in the governing zone; after a channel's cutoff, the next open day; a closed day moves only where a receipt rule says so", () => {
  const v = firstView();
  /* 2026-10-06T05:00Z is 22:00 on 10-05 in the view's zone */
  assert.equal(val(ev(v, "records_response", "2026-10-06T05:00:00Z")), "2026-10-15");
  /* the first profile's records venue: received on Sunday 10-04 counts from Monday 10-05 (the City Attorney's guide) */
  const sun = done(ev(v, "records_response", day("2026-10-04", LA)));
  assert.equal(single(sun.due).value, "2026-10-15");
  assert.equal(need(sun.trace.receipt, "the receipt rule's trace").to, "2026-10-05");
  /* the test profile: its records venue's cutoff is 16:30, and a request received on a closed day counts from the next
     open day on the rule's list (Sun 03-15 → Mon 03-16; Harbour Day 03-17 → 03-18) */
  const t = testView();
  assert.equal(val(ev(t, "records_answer", minute("2026-03-12T16:29", HFX))), "2026-03-19");
  const late = done(ev(t, "records_answer", minute("2026-03-12T16:31", HFX)));
  assert.equal(single(late.due).value, "2026-03-20");
  const cutoff = need(late.trace.cutoff, "the cutoff's trace");
  assert.deepEqual([cutoff.from, cutoff.to], ["2026-03-12", "2026-03-13"]);
  assert.equal(val(ev(t, "records_answer", day("2026-03-15", HFX))), "2026-03-23");
  assert.equal(val(ev(t, "records_answer", day("2026-03-17", HFX))), "2026-03-24");
  /* a rule whose venue holds no channel facts counts from the actual day, closed or not */
  assert.equal(val(evaluateRule({ rule: custom({ units: "days", amount: 1, count: "calendar" }), anchor: minute("2026-03-14T23:00", HFX), view: t })), "2026-03-15");
  assert.equal(val(evaluateRule({ rule: custom({ units: "days", amount: 1, count: "business", closures: "town" }), anchor: day("2026-03-15", HFX), view: t })), "2026-03-16");
  /* applies_on: the Monday rule answers only a Monday meeting; the test profile's, only Friday or Saturday */
  const tue = coded(ev(v, "omc_special_meeting_monday", minute("2026-10-20T18:00", LA)));
  assert.equal(tue.code, "RULE_NOT_APPLICABLE");
  assert.equal(val(ev(t, "notice_of_sitting_friday", minute("2026-10-09T19:00", HFX))), "2026-10-07T15:00");
  assert.equal(coded(ev(t, "notice_of_sitting_friday", minute("2026-10-08T19:00", HFX))).code, "RULE_NOT_APPLICABLE");
});

/* DEC-149 (K1847; N690): what the count says of a calendar entry's status in the group's own copy says "your group's
   Civicsmith", never "this instance"; each of the four strings, whole. */
test("R16 R25 DEC-149: a disputed or unreadable entry, and a correction counted on, are named in your group's Civicsmith", () => {
  const v = firstView();
  /** @type {(r: RuleAnswer) => string[]} */
  const calendarNotes = (r) => need(done(r).trace.calendar, "the calendar's trace").notes;
  const dis = ev(v, "records_response", day("2026-10-01", LA), { factOf: st("disputed") });
  const disNo = coded(dis);
  assert.equal(disNo.code, "FACT_DISPUTED");
  assert.deepEqual(disNo.why, { key: "civil-time.calendar.list_disputed", vars: { list: "judicial", year: "2026", offices: "" } });
  const abs = ev(v, "records_response", day("2026-10-01", LA), { factOf: st("absent", { why: word("case-disclosures.why.read_failed") }) });
  const absNo = coded(abs);
  assert.equal(absNo.code, "FACT_ABSENT");
  assert.deepEqual(absNo.why, { key: "civil-time.calendar.list_cannot_read_why", vars: { list: "judicial", year: "2026", offices: "", why: word("case-disclosures.why.read_failed") } });
  const bare = ev(v, "records_response", day("2026-10-01", LA), { factOf: st("absent") });
  assert.deepEqual(coded(bare).why, { key: "civil-time.calendar.list_cannot_read", vars: { list: "judicial", year: "2026", offices: "" } });
  /** @type {ClosureDay[]} */
  const fixed = [{ date: "2026-10-12", name: "corrected in" }];
  const gov = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("confirmed", { corrected: true, value: fixed, says: "corrected locally by a member, 2026-10-02" }) });
  assert.ok(calendarNotes(gov).includes(word("civil-time.counted_correction_governs", { status: "confirmed", says: " (corrected locally by a member, 2026-10-02)", year: "2026" })), JSON.stringify(calendarNotes(gov)));
  const cor = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("corrected", { value: fixed, by: "a member", at: "2026-10-02" }) });
  assert.ok(calendarNotes(cor).includes("counted on a calendar corrected in your team's Civicsmith by a member, 2026-10-02 (2026)"), JSON.stringify(calendarNotes(cor)));
  const plain = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("corrected", { value: fixed }) });
  assert.ok(calendarNotes(plain).includes("counted on a calendar corrected in your team's Civicsmith (2026)"), JSON.stringify(calendarNotes(plain)));
  for (const r of [dis, abs, bare, gov, cor, plain]) assert.doesNotMatch(JSON.stringify(r), /this instance|the plane/);
});

test("R16 undetermined with why: an uncovered year, a withheld fact, a disputed or absent entry, an UNMEASURED basis, an undetermined anchor, a rule form not counted", () => {
  const v = firstView();
  /* the judicial list holds no 2027 */
  const y = coded(ev(v, "records_response", day("2026-12-28", LA)));
  assert.equal(y.code, "CALENDAR_UNCOVERED");
  assert.deepEqual(y.why, { key: "civil-time.calendar.uncovered_list", vars: { list: "judicial", year: "2027" } });
  /* withheld as a conflict */
  const c = firstView();
  delete c.weekend;
  c.conflicts = disagreeing("weekend");
  assert.equal(coded(ev(c, "records_response", day("2026-10-01", LA))).code, "FACT_WITHHELD");
  /* factOf: disputed and absent are undetermined; unconfirmed and corrected compute and say so */
  /** @type {(r: RuleAnswer) => import("../../../src/civil-time/kinds.mjs").CalendarStated} */
  const stated = (r) => need(done(r).trace.calendar, "the calendar's trace");
  assert.equal(coded(ev(v, "records_response", day("2026-10-01", LA), { factOf: st("disputed") })).code, "FACT_DISPUTED");
  assert.equal(coded(ev(v, "records_response", day("2026-10-01", LA), { factOf: st("absent", { why: "no fact" }) })).code, "FACT_ABSENT");
  assert.equal(coded(ev(v, "records_response", day("2026-10-01", LA), { factOf: () => null })).code, "FACT_ABSENT");
  const un = ev(v, "records_response", day("2026-10-01", LA), { factOf: st("unconfirmed") });
  assert.equal(val(un), "2026-10-12");
  assert.match(stated(un).notes.join(" "), /unconfirmed calendar/);
  const cor = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("corrected", { value: [{ date: "2026-10-12", name: "corrected in" }], by: "a member", at: "2026-10-02" }) });
  assert.equal(val(cor), "2026-10-13", "the corrected list governs");
  assert.match(stated(cor).notes.join(" "), /corrected in your team's Civicsmith by a member/);
  /* N603 (local-facts R2, R3): a correction governs until a later act and a later confirm confirms it, so it is counted
     on whenever the answer says the governing value is a correction, whatever the status reads now; never otherwise */
  /** @type {ClosureDay[]} */
  const fixed = [{ date: "2026-10-12", name: "corrected in" }];
  for (const status of ["confirmed", "unconfirmed"]) {
    const r = ev(v, "records_response", day("2026-09-30", LA), { factOf: st(status, { corrected: true, value: fixed, says: "corrected locally by a member, 2026-10-02" }) });
    assert.equal(val(r), "2026-10-13", `the confirmed correction governs (${status})`);
    assert.ok(stated(r).notes.includes(word("civil-time.counted_correction_governs", { status, says: " (corrected locally by a member, 2026-10-02)", year: "2026" })), JSON.stringify(stated(r).notes));
    assert.ok(stated(r).entries.some((e) => e.governs === "correction" && e.status === status));
    assert.match((done(r).trace.notes || []).join(" "), new RegExp(`counted on its correction, now ${status}`));
  }
  const whole = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("confirmed", { corrected: true, value: { year: 2026, days: fixed } }) });
  assert.equal(val(whole), "2026-10-13", "a correction given as the whole entry governs by its days");
  const notCorr = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("confirmed", { corrected: false, value: fixed }) });
  assert.equal(val(notCorr), "2026-10-12", "a profile value is not a correction: the view's days govern");
  assert.ok(!stated(notCorr).entries.some((e) => e.governs));
  const dis = ev(v, "records_response", day("2026-09-30", LA), { factOf: st("disputed", { corrected: true, value: fixed }) });
  assert.equal(coded(dis).code, "FACT_DISPUTED", "a dispute after a correction is still undetermined");
  /* UNMEASURED */
  assert.equal(coded(evaluateRule({ rule: custom({ units: "days", amount: 1, count: "calendar", basis: "UNMEASURED" }), anchor: day("2026-10-01", LA), view: v })).code, "UNMEASURED");
  /* an undetermined anchor */
  assert.equal(coded(evaluateRule({ rule: ruleOf(v, "records_response"), anchor: { undetermined: true, why: "x" }, view: v })).code, "ANCHOR_UNDETERMINED");
  assert.equal(coded(ev(v, "records_response", { value: "2026-10/..", precision: "edtf", zone: LA })).code, "ANCHOR_UNDETERMINED");
  /* rule forms */
  /** @type {[Form, string][]} */
  const forms = [[{ units: "weeks", amount: 1 }, "units"], [{ units: "days", amount: 0, count: "calendar" }, "amount"],
    [{ units: "days", amount: 1.5, count: "calendar" }, "amount"], [{ units: "days", amount: 1, count: "court" }, "count"],
    [{ units: "days", amount: 1 }, "count"], [{ units: "hours", amount: 1, count: "calendar" }, "count"],
    [{ units: "days", amount: 1, count: "calendar", direction: "sideways" }, "direction"], [{ units: "days", amount: 1, count: "calendar", roll: "yes" }, "roll"],
    [{ units: "days", amount: 1, count: "calendar", due_at: "noon" }, "due_at"], [{ units: "days", amount: 1, count: "calendar", extension: { days: 0 } }, "extension"]];
  for (const [over, field] of forms) {
    const r = coded(evaluateRule({ rule: custom(over), anchor: day("2026-10-01", LA), view: v }));
    assert.equal(r.code, "RULE_INVALID", field);
    assert.equal(r.field, field);
  }
  /* a computation the view does not hold, or one not counted here */
  assert.equal(coded(evaluateRule({ rule: custom({ units: "days", amount: 1, count: "calendar", computation: "nope" }), anchor: day("2026-10-01", LA), view: v })).code, "FACT_ABSENT");
  const odd = firstView();
  odd.computation = [{ key: "ccp_12", rule: "include_both" }];
  assert.equal(coded(ev(odd, "records_response", day("2026-10-01", LA))).code, "RULE_INVALID");
  /* a closure list the view does not hold */
  assert.equal(coded(evaluateRule({ rule: custom({ units: "days", amount: 1, count: "business", closures: "lunar" }), anchor: day("2026-10-01", LA), view: v })).code, "FACT_ABSENT");
  /* the legacy shape (days: n, no units) reads as a day count */
  assert.equal(val(evaluateRule({ rule: { rule: "x", days: 3, count: "calendar", starts: "act" }, anchor: day("2026-10-01", LA), view: v })), "2026-10-04");
  assert.throws(() => evaluateRule({ rule: ruleOf(v, "records_response"), view: v }), TypeError);
  assert.throws(() => evaluateRule({ rule: ruleOf(v, "records_response"), anchor: day("2026-10-01", LA) }), TypeError);
});

test("R17 an uncertain date is {due: {candidates: [earliest, latest]}}: from an EDTF anchor, a month end or an open extension", () => {
  const v = firstView();
  const r = candidates(done(ev(v, "records_response", { value: "2026-10", precision: "edtf", zone: LA })).due);
  /* 10-01 → 10-12; 10-31, a Saturday, is received Monday 11-02 (the venue's receipt rule) → 11-12 */
  assert.deepEqual(r.map((c) => c.value), ["2026-10-12", "2026-11-12"]);
  for (const c of r) assert.equal(c.precision, "day");
  const t = candidates(done(ev(testView(), "records_answer", { value: "2026-03-12/2026-03-13", precision: "edtf", zone: HFX })).due);
  assert.deepEqual(t.map((c) => c.value), ["2026-03-19", "2026-03-20"]);
});

test("R18 due: the four basis kinds; law_set only for rule; dependency moves with the event it precedes; an unknown kind is refused", () => {
  const v = firstView();
  /** @typedef {((RuleDue | RuleUndetermined | Refusal) & BasisOf) | StatedDue | Refusal} DueAnswer */
  /** A due with its basis kind, else the test fails.
   * @type {(x: DueAnswer) => (RuleDue & BasisOf) | StatedDue} */
  const settled = (x) => ("refused" in x || "undetermined" in x ? assert.fail(JSON.stringify(x)) : x);
  /** A due that is one date, else the test fails.
   * @type {(d: Due | When) => DateTime} */
  const dateOf = (d) => (typeof d === "string" || "candidates" in d ? assert.fail(JSON.stringify(d)) : d);
  const rule = settled(due({ basis: "rule", rule: ruleOf(v, "records_response"), anchor: day("2026-10-05", LA), view: v }));
  assert.deepEqual([dateOf(rule.due).value, rule.basis_kind, rule.law_set], ["2026-10-15", "rule", true]);
  assert.ok(rule.trace);
  const com = settled(due({ basis: "commitment", date: day("2026-11-01", LA), citation: "the body's letter of 2026-10-02" }));
  assert.deepEqual([dateOf(com.due).value, com.basis_kind, com.law_set, com.trace.citation], ["2026-11-01", "commitment", false, "the body's letter of 2026-10-02"]);
  const win = settled(due({ basis: "window", date: day("2026-11-03", LA) }));
  assert.deepEqual([win.basis_kind, win.law_set], ["window", false]);
  /** @type {(meeting: string) => (RuleDue & BasisOf) | StatedDue} */
  const dep = (meeting) => settled(due({ basis: "dependency", precedes: day(meeting, LA), lead: 7, why: "comments before the hearing", view: v }));
  assert.deepEqual([dateOf(dep("2026-10-20").due).value, dateOf(dep("2026-10-27").due).value], ["2026-10-13", "2026-10-20"]);
  assert.equal(dep("2026-10-20").law_set, false);
  const bus = settled(due({ basis: "dependency", precedes: day("2026-03-18", HFX), lead: { amount: 3, count: "business", closures: "town" }, view: testView() }));
  assert.equal(dateOf(bus.due).value, "2026-03-13", "Mon 16, Sat 14, Fri 13 (Tue 17 and Sun 15 closed)");
  assert.equal(refusal(due({ basis: "deadline" })).refused, "BASIS_UNKNOWN");
  assert.throws(() => due({}), TypeError);
  const undet = due({ basis: "rule", rule: ruleOf(v, "records_response"), anchor: day("2026-12-28", LA), view: v });
  /** The basis an undetermined due keeps, else the test fails.
   * @type {(x: DueAnswer) => UndeterminedCode & BasisOf} */
  const openBasis = (x) => ("undetermined" in x && "basis_kind" in x ? x : assert.fail(JSON.stringify(x)));
  const undetNo = openBasis(undet);
  assert.deepEqual([undetNo.undetermined, undetNo.basis_kind, undetNo.law_set], [true, "rule", true]);
});

test("R19 overdueOn: on the at's local day in the due's zone, never the UTC day; group takes the earliest candidate, body only after the latest", () => {
  const d = day("2026-10-15", LA);
  /* 2026-10-16T05:00Z is still 10-15 in LA: not overdue, though the UTC day is 10-16 */
  assert.equal(overdueOn({ due: d, at: "2026-10-16T05:00:00Z", side: "group" }), "not_overdue");
  assert.equal(overdueOn({ due: d, at: "2026-10-16T07:00:00Z", side: "body" }), "overdue");
  /* a minute due: overdue from the next minute on */
  const noon = minute("2026-10-16T12:00", LA);
  assert.equal(overdueOn({ due: noon, at: "2026-10-16T19:00:59Z", side: "body" }), "not_overdue");
  assert.equal(overdueOn({ due: noon, at: "2026-10-16T19:01:00Z", side: "body" }), "overdue");
  /* candidates */
  const u = { candidates: [day("2026-10-09", LA), day("2026-10-12", LA)] };
  assert.equal(overdueOn({ due: u, at: "2026-10-10T19:00:00Z", side: "group" }), "overdue");
  const between = coded(overdueOn({ due: u, at: "2026-10-10T19:00:00Z", side: "body" }));
  const betweenWhy = between.why;
  assert.equal(between.undetermined, true);
  assert.deepEqual(Object.keys(betweenWhy.vars), ["value", "value_2", "day", "zone"]);
  assert.equal(betweenWhy.key, "civil-time.rules.possibly_overdue_day");
  assert.equal(overdueOn({ due: u, at: "2026-10-13T19:00:00Z", side: "body" }), "overdue");
  assert.equal(overdueOn({ due: u, at: "2026-10-09T19:00:00Z", side: "body" }), "not_overdue");
  /* a result of evaluateRule or due is read through its due; undetermined stays undetermined */
  const r = evaluateRule({ rule: ruleOf(firstView(), "records_response"), anchor: day("2026-10-05", LA), view: firstView() });
  assert.equal(overdueOn({ due: r, at: "2026-10-16T08:00:00Z", side: "body" }), "overdue");
  assert.equal(coded(overdueOn({ due: { undetermined: true, why: "x" }, at: "2026-10-16T08:00:00Z", side: "body" })).undetermined, true);
  assert.equal(refusal(overdueOn({ due: d, at: "2026-10-16", side: "body" })).refused, "DATE_INVALID");
  assert.equal(refusal(overdueOn({ due: d, at: "2026-10-16T08:00:00Z", side: "agency" })).refused, "SIDE_UNKNOWN");
  assert.throws(() => overdueOn({ due: d, side: "body" }), TypeError);
});

test("R24 span: days, business days, hours, months and years on local days; min and max bound every reading and are equal when exact", () => {
  const v = firstView(), t = testView();
  assert.deepEqual(pick(span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "days" })), [10, 10]);
  assert.deepEqual(pick(span(day("2026-10-15", LA), day("2026-10-05", LA), { unit: "days" })), [-10, -10]);
  assert.deepEqual(pick(span({ value: "2026-10", precision: "edtf", zone: LA }, day("2026-11-15", LA), { unit: "days" })), [15, 45]);
  /* local days: 2026-10-06T05:00Z is 10-05 in LA */
  assert.deepEqual(pick(span("2026-10-06T05:00:00Z", day("2026-10-06", LA), { unit: "days" })), [0, 0]);
  /* business days as R9 counts: the test profile, 10-07 to 10-15 */
  assert.deepEqual(pick(span(day("2026-03-12", HFX), day("2026-03-19", HFX), { unit: "business days", view: t, closures: "town" })), [5, 5]);
  assert.deepEqual(pick(span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "business days", view: v, office: "City Council" })), [8, 8]);
  const noWk = firstView(); delete noWk.weekend;
  assert.equal(coded(span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "business days", view: noWk })).undetermined, true);
  /* hours across the autumn change */
  assert.deepEqual(pick(span(minute("2026-11-01T00:00", LA), minute("2026-11-02T00:00", LA), { unit: "hours" })), [25, 25]);
  assert.deepEqual(pick(span(day("2026-11-01", LA), day("2026-11-02", LA), { unit: "hours" })), [0, 49]);
  /* months and years */
  assert.deepEqual(pick(span(day("2026-01-31", LA), day("2026-02-28", LA), { unit: "months" })), [0, 0]);
  assert.deepEqual(pick(span(day("2026-01-15", LA), day("2026-03-15", LA), { unit: "months" })), [2, 2]);
  assert.deepEqual(pick(span(day("2020-02-29", LA), day("2026-02-28", LA), { unit: "years" })), [5, 5]);
  assert.deepEqual(pick(span({ value: "2020", precision: "edtf", zone: LA }, day("2026-06-30", LA), { unit: "years" })), [5, 6]);
  assert.equal(coded(span({ value: "2020/..", precision: "edtf", zone: LA }, day("2026-06-30", LA), { unit: "days" })).undetermined, true);
  assert.equal(refusal(span(day("2026-01-01", LA), day("2026-02-01", LA), { unit: "weeks" })).refused, "UNIT_UNKNOWN");
  assert.throws(() => span(day("2026-01-01", LA), day("2026-02-01", LA)), TypeError);
});
/** @type {(r: SpanAnswer | UndeterminedCode | Refusal) => number[]} */
const pick = (r) => { const a = answered(r); assert.ok(Number.isInteger(a.min), JSON.stringify(r)); assert.ok(a.trace); return [a.min, a.max]; };

test("R25 traces: the rule and citation, the anchor, each skipped day with why, roll, extension, cutoff, each entry's status, and the runtime's tz and ICU versions", () => {
  const v = firstView();
  const r = done(ev(v, "records_response", day("2026-09-04", LA), { factOf: () => ({ status: "unconfirmed" }) }));
  const tr = r.trace;
  const records = ruleOf(v, "records_response");
  assert.equal(tr.rule, "records_response");
  assert.equal(tr.citation, records.citation);
  assert.deepEqual(tr.anchor, day("2026-09-04", LA));
  assert.equal(tr.anchor_day, "2026-09-04");
  assert.equal(single(r.due).value, "2026-09-14");
  assert.equal(tr.closures, "judicial");
  assert.ok(need(tr.calendar, "the calendar's trace").entries.every((e) => e.status === "unconfirmed" && e.list === "judicial"));
  assert.equal(extensionTrace(tr.extension).citation, need(records.extension ?? undefined, "the rule's extension").citation);
  const runtime = need(tr.runtime, "the runtime's versions");
  assert.equal(typeof runtime.tz, "string");
  assert.equal(typeof runtime.icu, "string");
  assert.equal(runtime.tz, hostVersion("tz"));
  assert.equal(runtime.icu, hostVersion("icu"));
  /* a rolled and a skipped day, each with why */
  const s = done(ev(v, "records_response", day("2026-08-26", LA)));
  assert.deepEqual(need((s.trace.roll || [])[0], "the roll").passed.map((p) => [p.day, p.why]),
    [["2026-09-05", "weekend (sat)"], ["2026-09-06", "weekend (sun)"], ["2026-09-07", "Labor Day (judicial)"]]);
  const b = done(ev(testView(), "records_answer", minute("2026-03-12T16:45", HFX)));
  const cutoff = need(b.trace.cutoff, "the cutoff's trace");
  assert.equal(cutoff.time, "16:30");
  assert.equal(cutoff.citation, "Test Stat. § 1.105");
  assert.ok((b.trace.skipped || []).every((x) => typeof x.why === "string" && x.why.length));
  /* due, span and expandRecurrence carry one too (expandRecurrence: recurrence.test.mjs) */
  const windowDue = due({ basis: "window", date: day("2026-11-03", LA) });
  assert.ok(!("refused" in windowDue) && !("undetermined" in windowDue) && windowDue.trace.runtime);
  assert.ok(answered(span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "days" })).trace.runtime);
});

/* R30: every undetermined answer of the counting services is {key, vars}, whatever the kind of no */
test("R30 R16 R9 R19 R24 every undetermined why of the rules is {key, vars}: invalid rule forms, withheld and absent facts, uncovered years, offices, anchors, due dates, spans", () => {
  const v = firstView(), zone = LA;
  /** @type {Rule} */
  const base = { rule: "x", units: "days", amount: 3, count: "business", starts: "act" };
  /** @type {(extra?: Rule) => Rule} */
  const rule = (extra = {}) => ({ ...base, ...extra });
  /** @param {RuleAnswer | UndeterminedCode | SpanAnswer | "overdue" | "not_overdue"} answer
   * @param {string} key
   * @param {string} [code] */
  const keyed = (answer, key, code) => {
    const a = coded(answer);
    assert.equal(a.undetermined, true, JSON.stringify(a));
    if (code) assert.equal(a.code, code);
    const why = a.why;
    assert.equal(typeof why, "object", JSON.stringify(a));
    for (const x of Object.values(why.vars)) assert.equal(typeof x, "string");
    assert.ok(reasonText(why).length > 5, key);
    assert.equal(why.key, key);
    return a;
  };
  /** @type {(r: Rule, anchor?: When | Unsettled, extra?: Beside) => RuleAnswer} */
  const run = (r, anchor = day("2026-10-05", zone), extra = {}) => evalWith(r, anchor, v, extra);
  keyed(run(rule({ units: "weeks" })), "civil-time.rules.invalid_units", "RULE_INVALID");
  keyed(run(rule({ amount: 0 })), "civil-time.rules.invalid_amount");
  keyed(run(rule({ direction: "sideways" })), "civil-time.rules.invalid_direction");
  keyed(run(rule({ count: undefined })), "civil-time.rules.invalid_count_unstated");
  keyed(run(rule({ count: "lunar" })), "civil-time.rules.invalid_count");
  keyed(run(rule({ units: "months", count: "calendar" })), "civil-time.rules.invalid_count_with_units");
  keyed(run(rule({ roll: "yes" })), "civil-time.rules.invalid_roll");
  keyed(run(rule({ closures: 5 })), "civil-time.rules.invalid_closures");
  keyed(run(rule({ due_at: "late" })), "civil-time.rules.invalid_due_at");
  keyed(run(rule({ applies_on: "tue" })), "civil-time.rules.invalid_applies_on");
  keyed(run(rule({ extension: { days: 0 } })), "civil-time.rules.invalid_extension_days");
  keyed(run(rule({ extension: { days: 3, count: "lunar" } })), "civil-time.rules.invalid_extension_count");
  keyed(run(rule({ computation: "nope" })), "civil-time.missing.computation_absent", "FACT_ABSENT");
  keyed(run(rule({ basis: "UNMEASURED" })), "civil-time.rules.unmeasured", "UNMEASURED");
  keyed(run(rule({ units: "hours", count: undefined }), day("2026-10-05", zone)), "civil-time.rules.anchor_hours_precision", "ANCHOR_UNDETERMINED");
  keyed(run(rule(), { value: "2026-10-05/..", precision: "edtf", zone }), "civil-time.rules.anchor_open_end");
  keyed(run(rule({ applies_on: ["tue"] }), day("2026-10-05", zone)), "civil-time.rules.not_applicable_day", "RULE_NOT_APPLICABLE");
  keyed(run(rule({ applies_on: ["tue"] }), { value: "2026-10", precision: "edtf", zone }), "civil-time.rules.not_applicable_span");
  keyed(run(rule({ closures: "nolist" })), "civil-time.missing.closure_list_absent");
  keyed(run(rule({ closures: "nolist" }), day("2026-10-05", zone), {}), "civil-time.missing.closure_list_absent");
  /* a caller's own reason is passed on as given; a sentence of the caller's is a fill */
  /** @type {Reason} */
  const mine = { key: "civil-time.end_stated", vars: {} };
  assert.deepEqual(coded(run(rule(), { undetermined: true, why: mine })).why, mine);
  keyed(run(rule(), { undetermined: true, why: "x" }), "civil-time.rules.anchor_undetermined");
  keyed(run(rule(), { undetermined: true }), "civil-time.rules.anchor_undetermined_unsaid");
  assert.deepEqual(coded(overdueOn({ due: { undetermined: true, why: mine }, at: "2026-10-16T08:00:00Z", side: "body" })).why, mine);
  keyed(overdueOn({ due: { undetermined: true, why: "w" }, at: "2026-10-16T08:00:00Z", side: "body" }), "civil-time.rules.due_undetermined");
  keyed(overdueOn({ due: { undetermined: true }, at: "2026-10-16T08:00:00Z", side: "body" }), "civil-time.rules.due_undetermined_unsaid");
  keyed(overdueOn({ due: { value: "2026-10-05/..", precision: "edtf", zone }, at: "2026-10-16T08:00:00Z", side: "body" }), "civil-time.rules.due_open_end");
  const instant = overdueOn({ due: { candidates: [minute("2026-10-09T10:00", zone), minute("2026-10-12T10:00", zone)] }, at: "2026-10-10T20:00:00Z", side: "body" });
  keyed(instant, "civil-time.rules.possibly_overdue_instant", "POSSIBLY_OVERDUE");
  keyed(span({ value: "2026-10-05/..", precision: "edtf", zone }, day("2026-10-15", zone), { unit: "days" }), "civil-time.rules.span_open_end", "OPEN_END");
  keyed(span(day("2026-10-05", zone), day("2026-10-15", zone), { unit: "business days" }), "civil-time.rules.span_needs_view", "FACT_ABSENT");
  /* withheld facts: each subject, and the weekend under a count */
  const w = firstView(); delete w.weekend; w.conflicts = disagreeing("weekend", "disagree");
  const wh = evaluateRule({ rule: rule(), anchor: day("2026-10-05", zone), view: w });
  keyed(wh, "civil-time.missing.weekend_counting_withheld", "FACT_WITHHELD");
  assert.equal(coded(wh).why.vars.at, "weekend");
  keyed(span(day("2026-10-05", zone), day("2026-10-15", zone), { unit: "business days", view: w }), "civil-time.missing.weekend_withheld");
  const comp = firstView(); comp.conflicts = disagreeing("computation", "disagree");
  keyed(evaluateRule({ rule: rule({ computation: "nope" }), anchor: day("2026-10-05", zone), view: comp }), "civil-time.missing.computation_withheld");
  const lst = firstView(); lst.holidays = (lst.holidays || []).filter((h) => h.list !== "judicial"); lst.conflicts = disagreeing("holidays", "disagree");
  keyed(evaluateRule({ rule: rule({ closures: "judicial" }), anchor: day("2026-10-05", zone), view: lst }), "civil-time.missing.closure_list_withheld");
  /* a year of the calendar withheld, and uncovered for a named office, with and without a list */
  const yr = firstView(); yr.conflicts = disagreeing("holidays.2027", "disagree");
  keyed(ev(yr, "records_response", day("2026-12-28", LA)), "civil-time.calendar.list_year_withheld", "FACT_WITHHELD");
  keyed(evaluateRule({ rule: rule(), anchor: day("2026-12-28", zone), view: v, office: "clerk" }), "civil-time.calendar.uncovered_office_office", "CALENDAR_UNCOVERED");
  keyed(evaluateRule({ rule: rule({ closures: "judicial" }), anchor: day("2026-12-30", zone), view: v, office: { venue: "court" } }), "civil-time.calendar.uncovered_list_office");
  keyed(evaluateRule({ rule: rule(), anchor: day("2026-12-28", zone), view: v }), "civil-time.calendar.uncovered_office");
});
