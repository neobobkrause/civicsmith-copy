/* civil-time's invariants at its interface (R26–R28): no clock is read and the same inputs give the same answers; no
 * place is held in code (answers follow the view's facts, and with no view's facts every answer that needs one is
 * undetermined); every undetermined answer and refusal says which kind of no and why. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ct from "../../../src/civil-time/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { firstView, testView, ruleOf, day, minute, single, refusal, open, coded, answered } from "./helpers.mjs";
/** @import { View, Rule, Reason } from "../../../src/civil-time/kinds.mjs" */

const LA = "America/Los_Angeles", HFX = "America/Halifax";

/** One call of every service, on a view.
 * @param {View} v */
function battery(v) {
  const tz = v.time_zone, tzValue = tz ? tz.value : undefined;
  const z = tzValue === undefined ? "UTC" : tzValue;
  /** @type {Rule} */
  const stand = { rule: "x", units: "days", amount: 3, count: "business", starts: "act" };
  const rule = (v.deadlines || []).find((d) => d.units === "days") || stand;
  return [
    ct.localDay("2026-10-05T12:00:00Z", z), ct.bounds(day("2026-11-01", z)), ct.parseEdtf("2026-21?"),
    ct.compare(day("2026-10-05", z), minute("2026-10-05T12:00", z)), ct.isCalendarDate("2026-02-29"), ct.dayRange("2026-10-01", "2026-10-05", z),
    ct.joinLocal("2026-10-05", "6:00 PM", z), ct.validAt({ valid: { from: "2026-01-01", to: null, precision: "day" } }, day("2026-06-01", z), { view: v }),
    ct.evaluateRule({ rule, anchor: day("2026-10-07", z), view: v, factOf: () => ({ status: "unconfirmed" }) }),
    ct.due({ basis: "dependency", precedes: day("2026-10-20", z), lead: { amount: 3, count: "business" }, view: v }),
    ct.overdueOn({ due: { candidates: [day("2026-10-09", z), day("2026-10-12", z)] }, at: "2026-10-10T19:00:00Z", side: "body" }),
    ct.span(day("2026-10-05", z), day("2026-10-15", z), { unit: "business days", view: v }),
    ct.expandRecurrence({ rrule: "FREQ=MONTHLY;BYDAY=1TU", dtstart: "2026-01-06T18:00", zone: z, from: "2026-01-01", to: "2026-12-31" }),
    ct.fiscalPeriod({ date: day("2026-10-05", z), body: "Port Ellery Selectboard", view: v }),
  ];
}

test("R26 pure: with every clock made to throw (Date.now, a Date with no argument, Temporal.Now), every service answers, and answers the same each time", () => {
  const views = [firstView(), testView()];
  const before = views.map((v) => JSON.stringify(battery(v)));
  const RealDate = globalThis.Date;
  const hadTemporal = "Temporal" in globalThis;
  const realTemporal = globalThis.Temporal;
  class ClocklessDate extends RealDate {
    constructor(...a) { if (!a.length) throw new Error("a clock was read: new Date()"); super(...a); }
    static now() { throw new Error("a clock was read: Date.now()"); }
  }
  globalThis.Date = ClocklessDate;
  globalThis.Temporal = { Now: new Proxy({}, { get() { throw new Error("a clock was read: Temporal.Now"); } }) };
  try {
    for (const [i, v] of views.entries()) {
      assert.equal(JSON.stringify(battery(v)), before[i], "the same answers, with no clock");
      assert.equal(JSON.stringify(battery(v)), before[i], "and again");
    }
  } finally {
    globalThis.Date = RealDate;
    if (hadTemporal) globalThis.Temporal = realTemporal; else delete globalThis.Temporal;
  }
  /* the view is not changed by any service */
  for (const make of [firstView, testView]) {
    const v = make(), copy = structuredClone(v);
    battery(v);
    assert.deepEqual(v, copy);
  }
});

test("R27 no place in code: the test profile's answers come from its facts alone, and change exactly as its facts change", () => {
  const t = testView();
  /** @type {(v: View) => string} */
  const r = (v) => single(answered(ct.evaluateRule({ rule: ruleOf(v, "records_answer"), anchor: day("2026-03-12", HFX), view: v })).due).value;
  assert.equal(r(t), "2026-03-19");
  const friSat = testView(); friSat.weekend = { ...friSat.weekend, days: ["fri", "sat"] };
  assert.equal(r(friSat), "2026-03-22", "a Friday and Saturday weekend: Sun 15, Mon 16, (Tue 17 closed), Wed 18, Thu 19, (Fri 20, Sat 21), Sun 22");
  const noHoliday = testView(); noHoliday.holidays = (noHoliday.holidays || []).map((h) => (h.list === "town" ? { ...h, days: [] } : h));
  assert.equal(r(noHoliday), "2026-03-18");
  /* a zone moved: the anchor's local time and day move with it (12:00Z is 09:00 in Halifax, 21:00 in Tokyo, past the
     16:30 cutoff) */
  const tokyo = testView(); tokyo.time_zone = { ...tokyo.time_zone, value: "Asia/Tokyo" };
  /** @type {(v: View) => string} */
  const at = (v) => single(answered(ct.evaluateRule({ rule: ruleOf(v, "records_answer"), anchor: "2026-03-12T12:00:00Z", view: v })).due).value;
  assert.equal(at(t), "2026-03-19");
  assert.equal(at(tokyo), "2026-03-20");
  /* the first profile likewise: its records rule from its own closure list and weekend */
  assert.equal(single(answered(ct.evaluateRule({ rule: ruleOf(firstView(), "records_response"), anchor: day("2026-09-15", LA), view: firstView() })).due).value, "2026-09-28");
});

test("R27, R28 with no active profile every service that needs a local fact is undetermined, never a default; absence is never an open day, a closed day or a zero", () => {
  /** @type {View} */
  const empty = combine([]).view;
  /** @type {Rule} */
  const rule = { rule: "x", units: "days", amount: 3, count: "business", starts: "act", citation: "c", status: "researched", basis: "2026-10-05" };
  const b = coded(ct.evaluateRule({ rule, anchor: day("2026-10-07", LA), view: empty }));
  assert.equal(b.undetermined, true);
  const cal = coded(ct.evaluateRule({ rule: { ...rule, count: "calendar", roll: true }, anchor: day("2026-10-07", LA), view: empty }));
  assert.equal(cal.undetermined, true, "a roll on no calendar");
  assert.equal(coded(ct.evaluateRule({ rule: { ...rule, units: "business_hours" }, anchor: minute("2026-10-07T10:00", LA), view: empty })).undetermined, true);
  assert.equal(coded(ct.span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "business days", view: empty })).undetermined, true);
  assert.equal(coded(ct.fiscalPeriod({ date: day("2026-10-05", LA), body: "x", view: empty })).undetermined, true);
  assert.equal(open(ct.validAt({ valid: { from: "2026-01-01", to: "2026-12-31", precision: "day" } }, day("2026-06-01", LA), { view: empty })).undetermined, true);
  /* weekend present but no closure list for the year: not an open day */
  const wk = { ...empty, weekend: { days: ["sat", "sun"] } };
  const y = coded(ct.evaluateRule({ rule, anchor: day("2026-10-07", LA), view: wk }));
  assert.equal(y.code, "CALENDAR_UNCOVERED");
  /* a calendar count with no roll needs no local fact, and the anchor's own zone serves */
  assert.equal(single(answered(ct.evaluateRule({ rule: { ...rule, count: "calendar" }, anchor: day("2026-10-07", LA), view: empty })).due).value, "2026-10-10");
});

test("R28 every undetermined answer and every refusal says which kind of no and why", () => {
  const v = firstView();
  const fiscal = (v.fiscal_year || []).filter((f) => f.body !== "*");
  const refusals = [
    refusal(ct.localDay("x", LA)), refusal(ct.localDay("2026-10-05T12:00:00Z", "X/Y")), refusal(ct.bounds(day("2026-02-30", LA))),
    refusal(ct.parseEdtf("Y17E7")), refusal(ct.parseEdtf("x")), refusal(ct.dayRange("2026-10-05", "2026-10-01", LA)),
    refusal(ct.joinLocal("2026-11-01", "25:00", LA)), refusal(ct.due({ basis: "nope" })),
    refusal(ct.span(day("2026-10-05", LA), day("2026-10-15", LA), { unit: "weeks" })),
    refusal(ct.expandRecurrence({ rrule: "FREQ=DAILY", dtstart: "2026-10-06T18:00", zone: LA, from: "2026-10-01", to: "2026-12-31" })),
    refusal(ct.validAt({ valid: { from: { value: "2026-01-01", event: "EVT-1" }, to: null, precision: "day", zone: LA } }, day("2026-06-01", LA))),
  ];
  const opens = [
    open(ct.compare(day("2026-10-05", LA), day("2026-10-05", LA))), open(ct.joinLocal("2026-03-08", "2:30 AM", LA)),
    open(ct.joinLocal("2026-11-01", "1:30 AM", LA)),
    open(ct.validAt({ valid: { from: "2026-01-01", to: null, precision: "day", zone: LA } }, day("2026-06-01", LA))),
  ];
  const codes = [
    coded(ct.evaluateRule({ rule: ruleOf(v, "records_response"), anchor: day("2026-12-28", LA), view: v })),
    coded(ct.evaluateRule({ rule: { rule: "x", units: "weeks", amount: 1 }, anchor: day("2026-12-28", LA), view: v })),
    coded(ct.evaluateRule({ rule: ruleOf(v, "records_response"), anchor: day("2026-10-01", LA), view: v, factOf: () => ({ status: "disputed" }) })),
    coded(ct.overdueOn({ due: { undetermined: true, why: "w" }, at: "2026-10-01T00:00:00Z", side: "body" })),
    /* a body with no entry of its own, in a view whose fiscal years name no `*` (jurisdictions R49: `*` is every body) */
    coded(ct.fiscalPeriod({ date: day("2026-10-05", LA), body: "nobody", view: { ...firstView(), fiscal_year: fiscal } })),
  ];
  for (const n of refusals) {
    assert.match(n.refused, /^[A-Z_]+$/, JSON.stringify(n));
    assert.ok(n.why.length > 10, JSON.stringify(n));
  }
  /* R30: a reason is {key, vars} where the module answers it */
  /** @type {Reason[]} */
  const whys = [...opens.map((n) => n.why), ...codes.map((n) => n.why)];
  for (const why of whys) assert.ok(typeof why.key === "string" && typeof why.vars === "object", JSON.stringify(why));
  for (const n of [...opens, ...codes]) assert.equal(n.undetermined, true, JSON.stringify(n));
});
