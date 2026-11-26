/* civil-time at its interface: bounded recurrences (R20, with R25's trace) and fiscal periods (R21), in each
 * profile's zone and on each profile's fiscal-year facts (R27). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expandRecurrence, fiscalPeriod, reasonText } from "../../../src/civil-time/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { firstView, testView, day, minute, zoneOf, need, refusal, open, coded, answered } from "./helpers.mjs";
/** @import { Expansion, FiscalPeriod } from "../../../src/civil-time/recurrence.mjs" */
/** @import { When, Conflict } from "../../../src/civil-time/kinds.mjs" */

const LA = zoneOf(firstView()), HFX = zoneOf(testView());
/** @type {(rrule: string, dtstart: When, zone: string, from: When, to: When) => Expansion} */
const ex = (rrule, dtstart, zone, from, to) => answered(expandRecurrence({ rrule, dtstart, zone, from, to }));
/** @type {(r: Expansion) => string[]} */
const values = (r) => r.instances.map((i) => i.value);

test("R20 WEEKLY with INTERVAL and BYDAY, wall time kept across daylight-saving changes in both profiles' zones", () => {
  for (const zone of [LA, HFX]) {
    const r = ex("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH", "2026-10-06T18:00", zone, "2026-10-01", "2026-11-30");
    assert.deepEqual(values(r), ["2026-10-06T18:00", "2026-10-08T18:00", "2026-10-20T18:00", "2026-10-22T18:00",
      "2026-11-03T18:00", "2026-11-05T18:00", "2026-11-17T18:00", "2026-11-19T18:00"], zone);
    assert.equal(r.truncated, false);
    assert.ok(r.instances.every((i) => i.precision === "minute" && i.zone === zone));
  }
  const la = ex("FREQ=WEEKLY;BYDAY=TU", "2026-10-27T18:00", LA, "2026-10-01", "2026-11-09");
  assert.deepEqual(la.instances.map((i) => i.instant), ["2026-10-28T01:00:00Z", "2026-11-04T02:00:00Z"], "the UTC instant moves; the wall time does not");
  /* no BYDAY: dtstart's weekday */
  assert.deepEqual(values(ex("FREQ=WEEKLY", "2026-10-07T09:00", HFX, "2026-10-01", "2026-10-22")), ["2026-10-07T09:00", "2026-10-14T09:00", "2026-10-21T09:00"]);
});

test("R20 MONTHLY with ordinal BYDAY, BYMONTHDAY (negative too) and BYSETPOS; YEARLY; a wall time the clocks skip moves past the gap", () => {
  assert.deepEqual(values(ex("FREQ=MONTHLY;BYDAY=1TU,3TU", "2026-01-06T18:00", LA, "2026-10-01", "2026-12-31")),
    ["2026-10-06T18:00", "2026-10-20T18:00", "2026-11-03T18:00", "2026-11-17T18:00", "2026-12-01T18:00", "2026-12-15T18:00"]);
  assert.deepEqual(values(ex("FREQ=MONTHLY;BYDAY=-1FR", "2026-01-30T10:00", HFX, "2026-09-01", "2026-12-31")),
    ["2026-09-25T10:00", "2026-10-30T10:00", "2026-11-27T10:00", "2026-12-25T10:00"]);
  assert.deepEqual(values(ex("FREQ=MONTHLY;BYMONTHDAY=15,-1", "2026-01-15T09:00", LA, "2026-01-01", "2026-03-31")),
    ["2026-01-15T09:00", "2026-01-31T09:00", "2026-02-15T09:00", "2026-02-28T09:00", "2026-03-15T09:00", "2026-03-31T09:00"]);
  /* the last weekday of each month */
  assert.deepEqual(values(ex("FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1", "2026-01-30T17:00", LA, "2026-01-01", "2026-06-01")),
    ["2026-01-30T17:00", "2026-02-27T17:00", "2026-03-31T17:00", "2026-04-30T17:00", "2026-05-29T17:00"]);
  /* a 31st: months without one are skipped (RFC 5545) */
  assert.deepEqual(values(ex("FREQ=MONTHLY", "2026-01-31T09:00", LA, "2026-01-01", "2026-06-01")), ["2026-01-31T09:00", "2026-03-31T09:00", "2026-05-31T09:00"]);
  /* YEARLY: Feb 29 only in leap years; BYDAY with an ordinal in the year */
  assert.deepEqual(values(ex("FREQ=YEARLY", "2024-02-29T12:00", LA, "2024-01-01", "2025-12-31")), ["2024-02-29T12:00"]);
  assert.deepEqual(values(ex("FREQ=YEARLY;BYDAY=1MO", "2026-01-05T12:00", HFX, "2026-01-01", "2027-12-31")), ["2026-01-05T12:00", "2027-01-04T12:00"]);
  /* 02:30 on the spring change does not occur: the instance is the time after the gap */
  const gap = ex("FREQ=WEEKLY;BYDAY=SU", "2026-03-01T02:30", LA, "2026-03-01", "2026-03-16");
  assert.deepEqual(values(gap), ["2026-03-01T02:30", "2026-03-08T03:30", "2026-03-15T02:30"]);
  assert.match(gap.trace.notes.join(" "), /does not occur/);
});

test("R20 the test profile's stated meeting schedules (its recurrences) expand in its zone", () => {
  const t = testView();
  const sb = need((t.recurrences || []).find((r) => r.body === "Port Ellery Selectboard"), "the Selectboard's schedule");
  assert.deepEqual(values(ex(sb.rrule, sb.dtstart, zoneOf(t), "2026-10-01", "2026-12-31")), ["2026-10-13T19:00", "2026-11-10T19:00", "2026-12-08T19:00"]);
  const hd = need((t.recurrences || []).find((r) => r.body === "Port Ellery Harbour District"), "the Harbour District's schedule");
  const r = ex(hd.rrule, hd.dtstart, zoneOf(t), "2026-12-01", "2027-03-01");
  /* fortnightly from Thu 01-08; its UNTIL (2026-12-31) ends it before 2027 */
  assert.deepEqual(values(r), ["2026-12-10T10:00", "2026-12-24T10:00"]);
});

test("R20 EXDATE and UNTIL; at most 24 months after from or 500 instances, whichever first, truncated: true", () => {
  assert.deepEqual(values(ex("FREQ=WEEKLY;BYDAY=TU;EXDATE=20261013T180000", "2026-10-06T18:00", LA, "2026-10-01", "2026-10-31")),
    ["2026-10-06T18:00", "2026-10-20T18:00", "2026-10-27T18:00"]);
  assert.deepEqual(values(ex("RRULE:FREQ=WEEKLY;BYDAY=TU\nEXDATE:20261020", "2026-10-06T18:00", LA, "2026-10-01", "2026-10-31")),
    ["2026-10-06T18:00", "2026-10-13T18:00", "2026-10-27T18:00"]);
  assert.deepEqual(values(ex("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261020T235959Z", "2026-10-06T18:00", LA, "2026-10-01", "2026-12-31")),
    ["2026-10-06T18:00", "2026-10-13T18:00"]);
  assert.deepEqual(values(ex("FREQ=WEEKLY;BYDAY=TU;UNTIL=20261020", "2026-10-06T18:00", LA, "2026-10-01", "2026-12-31")),
    ["2026-10-06T18:00", "2026-10-13T18:00", "2026-10-20T18:00"]);
  /* 24 months */
  const long = ex("FREQ=MONTHLY;BYMONTHDAY=1", "2020-01-01T09:00", LA, "2026-10-01", "2035-01-01");
  assert.equal(long.truncated, true);
  assert.equal(long.instances.length, 24);
  const first = need(long.instances[0], "the first instance"), last = need(long.instances.at(-1), "the last instance");
  assert.equal(first.value, "2026-10-01T09:00");
  assert.equal(last.value, "2028-09-01T09:00");
  /* 500 instances */
  const daily = ex("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU", "2026-01-01T09:00", HFX, "2026-01-01", "2027-12-31");
  assert.equal(daily.instances.length, 500);
  assert.equal(daily.truncated, true);
  /* within both limits: not truncated */
  assert.equal(ex("FREQ=MONTHLY;BYMONTHDAY=1", "2026-01-01T09:00", LA, "2026-01-01", "2026-12-31").truncated, false);
  assert.ok(long.trace.runtime && typeof long.trace.runtime.tz === "string", "R25: the trace");
});

test("R20 any other part is refused RRULE_UNSUPPORTED, naming it; a malformed rule DATE_INVALID; an unknown zone ZONE_INVALID", () => {
  /** @type {[string, string][]} */
  const outside = [["FREQ=DAILY", "FREQ=DAILY"], ["FREQ=HOURLY", "FREQ=HOURLY"], ["FREQ=WEEKLY;COUNT=5", "COUNT"], ["FREQ=YEARLY;BYMONTH=3", "BYMONTH"],
    ["FREQ=WEEKLY;BYHOUR=9", "BYHOUR"], ["FREQ=WEEKLY;WKST=SU", "WKST"], ["FREQ=MONTHLY;BYYEARDAY=1", "BYYEARDAY"], ["FREQ=MONTHLY;BYWEEKNO=1", "BYWEEKNO"],
    ["FREQ=WEEKLY;BYMINUTE=0", "BYMINUTE"], ["FREQ=WEEKLY;BYSECOND=0", "BYSECOND"], ["FREQ=WEEKLY;RDATE=20261001", "RDATE"]];
  for (const [rule, part] of outside) {
    const r = refusal(expandRecurrence({ rrule: rule, dtstart: "2026-10-06T18:00", zone: LA, from: "2026-10-01", to: "2026-12-31" }));
    assert.equal(r.refused, "RRULE_UNSUPPORTED", rule);
    assert.match(r.why, new RegExp(part), rule);
  }
  for (const rule of ["", "BYDAY=TU", "FREQ=WEEKLY;INTERVAL=0", "FREQ=WEEKLY;BYDAY=XX", "FREQ=WEEKLY;BYDAY=1TU", "FREQ=MONTHLY;BYMONTHDAY=0", "FREQ=WEEKLY;UNTIL=2026",
    "FREQ=WEEKLY;FREQ=WEEKLY", "FREQ=WEEKLY;BYSETPOS=0", "FREQ"])
    assert.equal(refusal(expandRecurrence({ rrule: rule, dtstart: "2026-10-06T18:00", zone: LA, from: "2026-10-01", to: "2026-12-31" })).refused, "DATE_INVALID", rule);
  assert.equal(refusal(expandRecurrence({ rrule: "FREQ=WEEKLY", dtstart: "2026-10-06T18:00", zone: "Moon/Base", from: "2026-10-01", to: "2026-12-31" })).refused, "ZONE_INVALID");
  assert.throws(() => expandRecurrence({ rrule: "FREQ=WEEKLY", zone: LA, from: "2026-10-01", to: "2026-12-31" }), TypeError);
});

test("R21 fiscalPeriod: the fiscal year holding a date under the body's fiscal_year fact, with start and end days; none held, or a band across two, undetermined", () => {
  const v = firstView(), t = testView();
  /* a profile holding no fiscal_year: undetermined, never a guessed year (the first profile keeps Oakland's since
     jurisdictions R49, so the fact is removed here) */
  delete v.fiscal_year;
  const none1 = coded(fiscalPeriod({ date: day("2026-10-05", LA), body: "Oakland City Council", view: v }));
  assert.equal(none1.undetermined, true);
  assert.deepEqual(none1.why, { key: "civil-time.missing.fiscal_year_absent", vars: { body: "Oakland City Council" } });
  /* the test profile: every body from April, named by its start; the Harbour District from October, named by its end */
  const SB = "Port Ellery Selectboard", HD = "Port Ellery Harbour District";
  assert.deepEqual(fiscalPeriod({ date: day("2026-03-31", HFX), body: SB, view: t }), { label: "FY2025-26", start: "2025-04-01", end: "2026-03-31" });
  assert.deepEqual(fiscalPeriod({ date: day("2026-04-01", HFX), body: SB, view: t }), { label: "FY2026-27", start: "2026-04-01", end: "2027-03-31" });
  assert.deepEqual(fiscalPeriod({ date: "2026-04-01", body: "any body", view: t }), { label: "FY2026-27", start: "2026-04-01", end: "2027-03-31" });
  assert.deepEqual(fiscalPeriod({ date: day("2026-10-05", HFX), body: HD, view: t }), { label: "HD2027", start: "2026-10-01", end: "2027-09-30" });
  assert.deepEqual(fiscalPeriod({ date: day("2026-09-30", HFX), body: HD, view: t }), { label: "HD2026", start: "2025-10-01", end: "2026-09-30" });
  /* the local day governs: 2026-04-01T02:00Z is still 03-31 in Halifax */
  assert.equal(answered(fiscalPeriod({ date: { value: "2026-04-01T02:00:00", precision: "second", zone: HFX }, body: SB, view: t })).label, "FY2026-27");
  assert.equal(answered(fiscalPeriod({ date: { value: "2026-04-01T02:00:00", precision: "second", zone: "UTC" }, body: SB, view: t })).label, "FY2026-27");
  assert.equal(answered(fiscalPeriod({ date: minute("2026-03-31T22:00", HFX), body: SB, view: t })).label, "FY2025-26");
  /* EDTF across two fiscal years */
  const two = open(fiscalPeriod({ date: { value: "2026", precision: "edtf", zone: HFX }, body: SB, view: t }));
  assert.equal(two.undetermined, true);
  /** @type {string[]} */
  const labels = [];
  for (const c of two.candidates || []) labels.push(typeof c === "string" ? c : c.label);
  assert.deepEqual(labels, ["FY2025-26", "FY2026-27"]);
  assert.equal(answered(fiscalPeriod({ date: { value: "2026-08", precision: "edtf", zone: HFX }, body: SB, view: t })).label, "FY2026-27");
  /* withheld as a conflict */
  const withheld = { at: "fiscal_year", values: [], says: "disagree" };
  /** @type {Conflict[]} */
  const conflicts = [withheld];
  const c = testView(); delete c.fiscal_year; c.conflicts = conflicts;
  assert.deepEqual(coded(fiscalPeriod({ date: day("2026-10-05", HFX), body: SB, view: c })).why, { key: "civil-time.missing.fiscal_year_withheld", vars: { body: SB, at: "fiscal_year" } });
  assert.throws(() => fiscalPeriod({ date: day("2026-10-05", LA), view: v }), TypeError);
});

test("R30 R20 R21 the reasons of expandRecurrence and fiscalPeriod are {key, vars}: an open window, an open date, a band across two fiscal years, a fiscal fact of the wrong form", () => {
  const t = testView();
  const window = open(expandRecurrence({ rrule: "FREQ=WEEKLY", dtstart: "2026-10-06T18:00", zone: LA, from: "2026-10-01", to: { value: "2026-12-01/..", precision: "edtf", zone: LA } }));
  assert.equal(window.undetermined, true);
  const whyWindow = window.why;
  assert.deepEqual(whyWindow, { key: "civil-time.window_open_end", vars: {} });
  const openDate = open(fiscalPeriod({ date: { value: "2026/..", precision: "edtf", zone: HFX }, body: "Port Ellery Selectboard", view: t }));
  const whyOpenDate = openDate.why;
  assert.deepEqual(whyOpenDate, { key: "civil-time.date_open_unknown", vars: {} });
  const across = open(fiscalPeriod({ date: { value: "2026", precision: "edtf", zone: HFX }, body: "Port Ellery Selectboard", view: t }));
  const whyAcross = across.why;
  assert.deepEqual(whyAcross, { key: "civil-time.spans_two_fiscal", vars: { value: "2026", label: "FY2025-26", label_2: "FY2026-27" } });
  const bad = testView(); bad.fiscal_year = [{ body: "Odd Body", start: "13-40", named_by: "start" }];
  const form = coded(fiscalPeriod({ date: day("2026-10-05", HFX), body: "Odd Body", view: bad }));
  assert.equal(form.code, "FACT_INVALID");
  const whyForm = form.why;
  assert.deepEqual(whyForm, { key: "civil-time.recurrence.fiscal_year_form", vars: { body: "Odd Body" } });
  for (const why of [whyWindow, whyOpenDate, whyAcross, whyForm]) {
    for (const v of Object.values(why.vars)) assert.equal(typeof v, "string");
    assert.ok(reasonText(why).length > 5, why.key);
    if (hasWord(why.key)) assert.equal(word(why.key, why.vars), reasonText(why));
  }
});
