/* civil-time at its interface: local days, bounds, EDTF, comparison, calendar dates, day ranges, the zone-less join
 * and validity (R1–R8, R22, R23). The zones used are the two profiles' (`time_zone`) and zones whose changes fall at
 * midnight or by half an hour, so no answer can rest on a zone's habits. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localDay, localClock, bounds, parseEdtf, compare, isCalendarDate, dayRange, joinLocal, validAt, reasonText } from "../../../src/civil-time/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { firstView, testView, day, minute, zoneOf, refusal, open, answered } from "./helpers.mjs";
/** @import { Bound, BoundObject, ValidityRecord } from "../../../src/civil-time/values.mjs" */
/** @import { Reason, DateTime, When } from "../../../src/civil-time/kinds.mjs" */
/** @import { EdtfReading } from "../../../src/civil-time/edtf.mjs" */

const LA = zoneOf(firstView()), HFX = zoneOf(testView());
const ZONES = [LA, HFX, "UTC", "Australia/Sydney", "America/Santiago", "Australia/Lord_Howe", "Asia/Kolkata", "Pacific/Chatham"];
/** @type {(ms: number) => string} */
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
/* An independent reading of a local day: the runtime's own calendar formatting. */
/** @type {(ms: number, zone: string) => string} */
const oracleDay = (ms, zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

test("R1 localDay: every half hour of 2026 in eight zones falls on the day the runtime's calendar names, across every daylight-saving change", () => {
  const t0 = Date.UTC(2026, 0, 1), t1 = Date.UTC(2027, 0, 1);
  for (const z of ZONES) for (let t = t0; t < t1; t += 1800e3) assert.equal(localDay(iso(t), z), oracleDay(t, z), `${iso(t)} in ${z}`);
  /* the seconds either side of local midnight, on change days */
  assert.equal(localDay("2026-03-08T07:59:59Z", LA), "2026-03-07");
  assert.equal(localDay("2026-03-08T08:00:00Z", LA), "2026-03-08");
  assert.equal(localDay("2026-11-02T07:59:59Z", LA), "2026-11-01");
  assert.equal(localDay("2026-11-02T08:00:00Z", LA), "2026-11-02");
  assert.equal(localDay("2026-09-06T03:59:59Z", "America/Santiago"), "2026-09-05");
  assert.equal(localDay("2026-09-06T04:00:00Z", "America/Santiago"), "2026-09-06");
});

/* An independent reading of a wall time to the second, in the runtime's own formatting. */
/** @type {(ms: number, zone: string) => string} */
const oracleWall = (ms, zone) => {
  /** @type {Map<string, string>} */
  const v = new Map([]);
  for (const p of new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms))) v.set(p.type, p.value);
  return `${v.get("year")}-${v.get("month")}-${v.get("day")}T${v.get("hour")}:${v.get("minute")}:${v.get("second")}`;
};
/** @type {(ms: number, zone: string) => number} */
const oracleOffset = (ms, zone) => Date.parse(`${oracleWall(ms, zone)}Z`) - ms;

test("R1 R2 the offsets at every second either side of each change agree with the runtime's reading, read again from the cache, including changes off the hour (N565)", () => {
  /* each zone's changes in 2026, found by the oracle hour by hour, plus changes at odd seconds and quarter hours */
  /** @type {[number, string][]} */
  const changes = [];
  const t0 = Date.UTC(2026, 0, 1), t1 = Date.UTC(2027, 0, 1);
  for (const z of ZONES) {
    for (let t = t0; t < t1; t += 3600e3) {
      if (oracleOffset(t, z) === oracleOffset(t + 3600e3, z)) continue;
      let lo = t, hi = t + 3600e3;
      while (hi - lo > 1000) { const m = lo + Math.floor((hi - lo) / 2000) * 1000; if (oracleOffset(m, z) === oracleOffset(t, z)) lo = m; else hi = m; }
      changes.push([hi, z]);
    }
  }
  assert.ok(changes.length >= 10, "the zones change in 2026");
  changes.push([Date.parse("1883-11-18T20:00:00Z"), LA]);                     /* local mean time to PST: 12:07:02 */
  changes.push([Date.parse("1986-01-01T00:00:00Z") - 5.5 * 3600e3, "Asia/Kathmandu"]);  /* +05:30 to +05:45 */
  for (const pass of [1, 2]) {
    for (const [c, z] of changes) {
      for (let t = c - 120e3; t <= c + 120e3; t += 1000) {
        const w = oracleWall(t, z);
        assert.equal(localDay(iso(t), z), w.slice(0, 10), `pass ${pass}: ${iso(t)} in ${z}`);
        const read = bounds({ value: w, precision: "second", zone: z });
        assert.ok(!("refused" in read), `pass ${pass}: ${w} in ${z} is a wall time`);
        const b = answered(read);
        const lo = Date.parse(String(b.earliest)), hi = Date.parse(String(b.latest));
        assert.ok(lo <= t && t < hi, `pass ${pass}: ${iso(t)} lies within the bounds of ${w} in ${z}`);
        assert.equal(oracleWall(lo, z), w, `pass ${pass}: the bounds of ${w} in ${z} begin at it`);
      }
    }
  }
});

test("R1 localDay: an unknown zone is refused ZONE_INVALID; a malformed instant DATE_INVALID; a wrong type throws TypeError", () => {
  for (const z of ["Mars/Olympus", "", "+05:00", "PST8PDT/x", "America/"]) assert.equal(refusal(localDay("2026-10-05T12:00:00Z", z)).refused, "ZONE_INVALID", z);
  for (const s of ["2026-10-05", "2026-10-05T12:00:00", "2026-10-05T12:00:00.000Z", "2026-13-05T12:00:00Z", "2026-02-30T12:00:00Z", "2026-10-05T24:00:00Z"])
    assert.equal(refusal(localDay(s, LA)).refused, "DATE_INVALID", s);
  assert.throws(() => localDay(1, LA), TypeError);
  assert.throws(() => localDay("2026-10-05T12:00:00Z"), TypeError);
});

test("R2 bounds: a day covers its local day, 23 or 25 hours across a change, and in every zone [first instant, next day's first instant)", () => {
  assert.deepEqual(bounds(day("2026-03-08", LA)), { earliest: "2026-03-08T08:00:00Z", latest: "2026-03-09T07:00:00Z" });
  assert.deepEqual(bounds(day("2026-11-01", LA)), { earliest: "2026-11-01T07:00:00Z", latest: "2026-11-02T08:00:00Z" });
  /* midnight swallowed by the change: the day begins at 01:00 */
  assert.deepEqual(bounds(day("2026-09-06", "America/Santiago")), { earliest: "2026-09-06T04:00:00Z", latest: "2026-09-07T03:00:00Z" });
  /* a half-hour change */
  assert.deepEqual(bounds(day("2026-04-05", "Australia/Lord_Howe")), { earliest: "2026-04-04T13:00:00Z", latest: "2026-04-05T13:30:00Z" });
  for (const z of ZONES) {
    for (let n = 0; n < 365; n++) {
      const d = new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
      const b = answered(bounds(day(d, z)));
      const lo = Date.parse(String(b.earliest)), hi = Date.parse(String(b.latest));
      assert.equal(oracleDay(lo, z), d, `${d} ${z} start`);
      assert.notEqual(oracleDay(lo - 1000, z), d, `${d} ${z} the instant before`);
      assert.notEqual(oracleDay(hi, z), d, `${d} ${z} end`);
      assert.equal(oracleDay(hi - 1000, z), d, `${d} ${z} last second`);
    }
  }
});

test("R2 bounds: a minute covers its minute and a second its second; a wall time met twice covers both; one skipped is refused", () => {
  assert.deepEqual(bounds(minute("2026-10-05T18:00", LA)), { earliest: "2026-10-06T01:00:00Z", latest: "2026-10-06T01:01:00Z" });
  assert.deepEqual(bounds({ value: "2026-10-05T18:00:07", precision: "second", zone: LA }), { earliest: "2026-10-06T01:00:07Z", latest: "2026-10-06T01:00:08Z" });
  assert.deepEqual(bounds(minute("2026-11-01T01:30", LA)), { earliest: "2026-11-01T08:30:00Z", latest: "2026-11-01T09:31:00Z" });
  assert.equal(refusal(bounds(minute("2026-03-08T02:30", LA))).refused, "DATE_INVALID");
});

test("R2 bounds: an EDTF value covers its widest reading; an open end is null; malformed values and values not of their precision's form are refused", () => {
  assert.deepEqual(bounds({ value: "2026", precision: "edtf", zone: "UTC" }), { earliest: "2026-01-01T00:00:00Z", latest: "2027-01-01T00:00:00Z" });
  assert.deepEqual(bounds({ value: "2026-10", precision: "edtf", zone: LA }), { earliest: "2026-10-01T07:00:00Z", latest: "2026-11-01T07:00:00Z" });
  assert.deepEqual(bounds({ value: "2026-10-05/..", precision: "edtf", zone: "UTC" }), { earliest: "2026-10-05T00:00:00Z", latest: null });
  assert.deepEqual(bounds({ value: "/2026-10-05", precision: "edtf", zone: "UTC" }), { earliest: null, latest: "2026-10-06T00:00:00Z" });
  /** @type {[string, string][]} */
  const malformed = [["2026-10-5", "day"], ["2026-02-29", "day"], ["2026-10-05T18:00", "day"], ["2026-10-05", "minute"],
    ["2026-10-05T25:00", "minute"], ["2026-10-05T18:00", "second"], ["2026-10-05T18:00:60", "second"], ["nope", "edtf"], ["2026-10-05", "week"]];
  for (const [value, precision] of malformed)
    assert.equal(refusal(bounds({ value, precision, zone: "UTC" })).refused, "DATE_INVALID", `${value} at ${precision}`);
  assert.equal(refusal(bounds({ value: "2026-10-05", precision: "day", zone: "Nowhere/Town" })).refused, "ZONE_INVALID");
  assert.throws(() => bounds({ value: 20261005, precision: "day", zone: "UTC" }), TypeError);
  assert.throws(() => bounds(null), TypeError);
});

test("R3 parseEdtf: level 1 read whole: qualifiers, unspecified digits, seasons, open and unknown interval ends, Y-years", () => {
  /** @type {(s: string) => EdtfReading} */
  const p = (s) => { const r = parseEdtf(s); assert.ok(!("refused" in r), `${s}: ${JSON.stringify(r)}`); return answered(r); };
  /** @type {(s: string) => (string | null)[]} */
  const ends = (s) => { const r = p(s); return [r.earliest, r.latest]; };
  assert.deepEqual(ends("2026"), ["2026-01-01", "2026-12-31"]);
  assert.deepEqual(ends("2024-02"), ["2024-02-01", "2024-02-29"]);
  assert.deepEqual(ends("2026-10-05"), ["2026-10-05", "2026-10-05"]);
  assert.deepEqual(ends("2026-10-05T18:00:00Z"), ["2026-10-05", "2026-10-05"]);
  assert.deepEqual(ends("-0044-03-15"), ["-0044-03-15", "-0044-03-15"]);
  /** @type {[string, string][]} */
  const qualified = [["2026?", "uncertain"], ["2026~", "approximate"], ["2026-10%", "both"]];
  for (const [s, q] of qualified) {
    const r = p(s);
    assert.equal(r.qualifiers.uncertain, q !== "approximate", s);
    assert.equal(r.qualifiers.approximate, q !== "uncertain", s);
  }
  assert.deepEqual(ends("201X"), ["2010-01-01", "2019-12-31"]);
  assert.deepEqual(ends("20XX"), ["2000-01-01", "2099-12-31"]);
  assert.deepEqual(ends("2004-XX"), ["2004-01-01", "2004-12-31"]);
  assert.deepEqual(ends("1985-04-XX"), ["1985-04-01", "1985-04-30"]);
  assert.deepEqual(ends("1985-XX-XX"), ["1985-01-01", "1985-12-31"]);
  assert.equal(p("1985-04-XX").qualifiers.unspecified, true);
  assert.deepEqual(ends("2001-21"), ["2001-03-01", "2001-05-31"]);
  assert.deepEqual(ends("2001-22"), ["2001-06-01", "2001-08-31"]);
  assert.deepEqual(ends("2001-23"), ["2001-09-01", "2001-11-30"]);
  assert.deepEqual(ends("2001-24"), ["2001-01-01", "2002-02-28"]);
  assert.equal(p("2001-24").qualifiers.season, true);
  assert.deepEqual(ends("1964/2008"), ["1964-01-01", "2008-12-31"]);
  assert.deepEqual(ends("2004-06/2006-08"), ["2004-06-01", "2006-08-31"]);
  assert.deepEqual(ends("1985-04-12/.."), ["1985-04-12", null]);
  assert.deepEqual(ends("../1985-04-12"), [null, "1985-04-12"]);
  assert.deepEqual(ends("1985-04-12/"), ["1985-04-12", null]);
  assert.deepEqual(ends("/1985-04-12"), [null, "1985-04-12"]);
  assert.equal(p("1985-04-12/..").qualifiers.end, "open");
  assert.equal(p("1985-04-12/").qualifiers.end, "unknown");
  assert.equal(p("../1985").qualifiers.start, "open");
  assert.deepEqual(ends("1984?/2004~"), ["1984-01-01", "2004-12-31"]);
  assert.deepEqual(ends("Y170000002"), ["+170000002-01-01", "+170000002-12-31"]);
  assert.deepEqual(ends("Y-170000002"), ["-170000002-01-01", "-170000002-12-31"]);
});

test("R4 parseEdtf: every level-2 feature is refused EDTF_UNSUPPORTED naming it; anything not EDTF is refused DATE_INVALID", () => {
  /** @type {[string, string][]} */
  const level2 = [["[1667,1668]", "set"], ["{1667,1668}", "set"], ["Y17E7", "exponential"], ["1950S2", "significant"],
    ["2004-?06-11", "component"], ["?2004-06-11", "component"], ["2004?-06-11", "component"], ["2001-25", "grouping 25"], ["2001-41", "grouping 41"],
    ["1XXX", "unspecified digits"], ["156X-12-25", "unspecified"], ["1985-XX-12", "unspecified month"]];
  for (const [s, feature] of level2) {
    const r = refusal(parseEdtf(s));
    assert.equal(r.refused, "EDTF_UNSUPPORTED", s);
    assert.match(r.why, new RegExp(feature, "i"), s);
  }
  for (const s of ["", "abc", "2026-13", "2026-02-30", "26-10-05", "Y2026", "2026/2025", "../..", "2026-10-05T18:00:00Z?", "2001-42", "2026 ", "1/2/3"])
    assert.equal(refusal(parseEdtf(s)).refused, "DATE_INVALID", JSON.stringify(s));
  assert.throws(() => parseEdtf(2026), TypeError);
});

test("R5 compare: before or after only when the spans do not overlap; otherwise undetermined, naming the overlap; a day is never its midnight", () => {
  const a = day("2026-10-05", LA);
  assert.equal(compare(a, day("2026-10-06", LA)), "before");
  assert.equal(compare(day("2026-10-06", LA), a), "after");
  const same = open(compare(a, day("2026-10-05", LA)));
  assert.equal(same.undetermined, true);
  assert.deepEqual(same.why, { key: "civil-time.precision_precision_held", vars: { value: "2026-10-05", precision: "day" } });
  /* a minute inside the day: neither before nor after */
  const inside = open(compare(a, minute("2026-10-05T00:00", LA)));
  assert.equal(inside.undetermined, true);
  const insideWhy = inside.why;
  assert.equal(insideWhy.key, "civil-time.values.overlap");
  assert.deepEqual(insideWhy.vars, { value: "2026-10-05", precision: "day", zone: LA, value_2: "2026-10-05T00:00", precision_2: "minute", zone_2: LA });
  assert.equal(compare(minute("2026-10-04T23:59", LA), a), "before");
  /* zones: the same named day in two zones overlaps; 18:00 in LA is after the UTC day 2026-10-05 */
  assert.equal(open(compare(day("2026-10-05", "UTC"), day("2026-10-05", LA))).undetermined, true);
  assert.equal(compare(minute("2026-10-05T18:00", LA), day("2026-10-05", "UTC")), "after");
  /* instants are second-precision spans; the same instant twice is undetermined */
  assert.equal(compare("2026-10-05T00:00:00Z", "2026-10-05T00:00:01Z"), "before");
  assert.equal(open(compare("2026-10-05T00:00:00Z", "2026-10-05T00:00:00Z")).undetermined, true);
  /* EDTF bands */
  assert.equal(compare({ value: "2004", precision: "edtf", zone: "UTC" }, { value: "2005-01", precision: "edtf", zone: "UTC" }), "before");
  assert.equal(open(compare({ value: "200X", precision: "edtf", zone: "UTC" }, { value: "2005", precision: "edtf", zone: "UTC" })).undetermined, true);
});

test("R5 compare: an open or unknown end makes undetermined any comparison it could decide, and leaves one its known end decides", () => {
  /** @type {(value: string) => DateTime} */
  const e = (value) => ({ value, precision: "edtf", zone: "UTC" });
  const openEnd = open(compare(e("2004/.."), e("2010")));
  assert.equal(openEnd.undetermined, true);
  assert.deepEqual(openEnd.why, { key: "civil-time.values.end_open", vars: { value: "2004/.." } });
  assert.deepEqual(open(compare(e("2004/"), e("2010"))).why, { key: "civil-time.values.end_unknown", vars: { value: "2004/" } });
  assert.deepEqual(open(compare(e("../2012"), e("2010"))).why, { key: "civil-time.values.start_open", vars: { value: "../2012" } });
  assert.deepEqual(open(compare(e("/2012"), e("2010"))).why, { key: "civil-time.values.start_unknown", vars: { value: "/2012" } });
  /* both open: the first is the reason, the second rides in `also` */
  const both = open(compare(e("2004/.."), e("../2010")));
  const bothWhy = both.why;
  assert.equal(bothWhy.key, "civil-time.values.end_open");
  assert.deepEqual(both.also, [{ key: "civil-time.values.start_open", vars: { value: "../2010" } }]);
  assert.equal(compare(e("2012/.."), e("2010")), "after");
  assert.equal(compare(e("../2004"), e("2010")), "before");
  assert.equal(open(compare(e("../2012"), e("2010"))).undetermined, true);
  /* refusals pass through */
  assert.equal(refusal(compare(e("2004"), day("2026-02-30", "UTC"))).refused, "DATE_INVALID");
});

test("R6 isCalendarDate: true exactly for real days of the proleptic Gregorian calendar, checked against every day of 1599–2401", () => {
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(isCalendarDate("2026-02-31"), false);
  assert.equal(isCalendarDate("2026-13-01"), false);
  for (const s of ["2026-1-01", "2026-01-1", "20260101", " 2026-01-01", "2026-01-01T00:00", "2026-00-10", "2026-01-00", "", null, 20260101])
    assert.equal(isCalendarDate(s), false, String(s));
  const MS = 86400e3;
  for (let t = Date.UTC(1599, 0, 1); t < Date.UTC(2402, 0, 1); t += MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    assert.equal(isCalendarDate(d), true, d);
  }
  for (let y = 1599; y <= 2401; y++) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    assert.equal(isCalendarDate(`${y}-02-29`), leap, `${y}-02-29`);
    for (const m of ["04", "06", "09", "11"]) assert.equal(isCalendarDate(`${y}-${m}-31`), false);
  }
  assert.equal(isCalendarDate("0000-02-29"), true);
  assert.equal(isCalendarDate("1900-02-29"), false);
});

test("R7 dayRange: the first instant of the first day to the first instant after the last, in the zone; inverted and invalid days refused", () => {
  assert.deepEqual(dayRange("2026-10-01", "2026-10-05", LA), { start: "2026-10-01T07:00:00Z", end: "2026-10-06T07:00:00Z" });
  assert.deepEqual(dayRange("2026-11-01", "2026-11-01", LA), { start: "2026-11-01T07:00:00Z", end: "2026-11-02T08:00:00Z" });
  assert.deepEqual(dayRange("2026-03-01", "2026-03-31", HFX), { start: "2026-03-01T04:00:00Z", end: "2026-04-01T03:00:00Z" });
  for (const z of ZONES) {
    const r = answered(dayRange("2026-01-01", "2026-12-31", z));
    assert.equal(r.start, answered(bounds(day("2026-01-01", z))).earliest);
    assert.equal(r.end, answered(bounds(day("2026-12-31", z))).latest);
  }
  assert.equal(refusal(dayRange("2026-10-05", "2026-10-04", LA)).refused, "RANGE_INVERTED");
  assert.equal(refusal(dayRange("2026-02-30", "2026-03-04", LA)).refused, "DATE_INVALID");
  assert.equal(refusal(dayRange("2026-03-01", "2026-3-04", LA)).refused, "DATE_INVALID");
  assert.equal(refusal(dayRange("2026-03-01", "2026-03-04", "Atlantis/Main")).refused, "ZONE_INVALID");
  assert.throws(() => dayRange("2026-03-01", null, LA), TypeError);
});

test("R8 joinLocal: a zone-less date (or with T00:00:00) and an h:mm AM/PM time, case and spacing folded, give a minute in the zone", () => {
  const want = { value: "2026-10-05T18:00", precision: "minute", zone: LA };
  for (const t of ["6:00 PM", "06:00 PM", "6:00PM", "6:00 pm", " 6:00   p.m. ", "6 : 00 Pm"]) assert.deepEqual(joinLocal("2026-10-05", t, LA), want, t);
  assert.deepEqual(joinLocal("2026-10-05T00:00:00", "6:00 PM", LA), want);
  assert.equal(answered(joinLocal("2026-10-05", "12:00 AM", LA)).value, "2026-10-05T00:00");
  assert.equal(answered(joinLocal("2026-10-05", "12:30 PM", LA)).value, "2026-10-05T12:30");
  assert.equal(answered(joinLocal("2026-10-05", "11:59 PM", LA)).value, "2026-10-05T23:59");
  /* every minute of a day written both ways agrees */
  for (let m = 0; m < 1440; m++) {
    const h24 = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    assert.equal(answered(joinLocal("2026-10-05", `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`, HFX)).value, `2026-10-05T${String(h24).padStart(2, "0")}:${mm}`);
  }
});

test("R8 joinLocal: a wall time met twice is undetermined with both instants; one that never occurs is undetermined with why; unreadable is refused", () => {
  const twice = open(joinLocal("2026-11-01T00:00:00", "1:30 AM", LA));
  assert.equal(twice.undetermined, true);
  assert.deepEqual(twice.candidates, ["2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z"]);
  const gap = open(joinLocal("2026-03-08", "2:30 AM", LA));
  assert.equal(gap.undetermined, true);
  assert.deepEqual(gap.why, { key: "civil-time.occur_clocks_move", vars: { value: "2026-03-08T02:30", zone: LA } });
  assert.deepEqual(twice.why, { key: "civil-time.occurs_twice_clocks", vars: { value: "2026-11-01T01:30", zone: LA } });
  for (const t of ["18:00", "6 PM", "13:00 PM", "0:30 AM", "6:60 PM", "six PM", ""]) assert.equal(refusal(joinLocal("2026-10-05", t, LA)).refused, "DATE_INVALID", t);
  for (const d of ["2026-10-05T18:00:00", "10/05/2026", "2026-02-30"]) assert.equal(refusal(joinLocal(d, "6:00 PM", LA)).refused, "DATE_INVALID", d);
  assert.equal(refusal(joinLocal("2026-10-05", "6:00 PM", "Not/AZone")).refused, "ZONE_INVALID");
  assert.throws(() => joinLocal("2026-10-05", 18, LA), TypeError);
});

/** @type {(from: Bound, to: Bound, zone?: string) => ValidityRecord} */
const valid = (from, to, zone = LA) => ({ valid: { from, to, precision: "day", zone }, basis: "M-1" });
test("R22 validAt: out wholly before from or wholly after to; in wholly within both; otherwise undetermined; a null bound is not stated, never always", () => {
  const v = valid("2026-01-01", "2026-12-31");
  assert.equal(validAt(v, day("2025-12-31", LA)), "out");
  assert.equal(validAt(v, day("2027-01-01", LA)), "out");
  assert.equal(validAt(v, day("2026-01-01", LA)), "in");
  assert.equal(validAt(v, day("2026-12-31", LA)), "in");
  assert.equal(validAt(v, minute("2026-06-01T12:00", LA)), "in");
  assert.equal(validAt(v, "2026-06-01T12:00:00Z"), "in");
  /* a band straddling a bound */
  const straddle = open(validAt(v, { value: "2025-12/2026-01", precision: "edtf", zone: LA }));
  assert.equal(straddle.undetermined, true);
  /* null bounds */
  const noEnd = open(validAt(valid("2026-01-01", null), day("2026-06-01", LA)));
  assert.equal(noEnd.undetermined, true);
  const noEndWhy = noEnd.why;
  assert.deepEqual(noEndWhy, { key: "civil-time.end_stated", vars: {} });
  assert.equal(word(noEndWhy.key, noEndWhy.vars), reasonText(noEndWhy));
  assert.equal(validAt(valid("2026-01-01", null), day("2025-06-01", LA)), "out");
  const noStart = open(validAt(valid(null, "2026-12-31"), day("2026-06-01", LA)));
  assert.deepEqual(noStart.why, { key: "civil-time.start_stated", vars: {} });
  assert.equal(validAt(valid(null, "2026-12-31"), day("2027-06-01", LA)), "out");
  assert.equal(open(validAt(valid(null, null), day("2027-06-01", LA))).undetermined, true);
  /* bounds compared as R5 compares: the day 2026-01-01 in LA against a UTC instant just before its start */
  assert.equal(validAt(v, "2026-01-01T07:59:59Z"), "out");
  assert.equal(validAt(v, "2026-01-01T08:00:00Z"), "in");
  /* EDTF bounds */
  assert.equal(validAt({ valid: { from: "2026", to: "2026", precision: "edtf", zone: "UTC" } }, day("2026-07-01", "UTC")), "in");
});

test("R23 validAt: an event bound resolves through its `at`; without it the bound is undetermined; value and event together are refused; the view gives the zone", () => {
  /** @type {(at?: When) => Bound} */
  const ev = (at) => {
    /** @type {BoundObject} */
    const bound = { event: "EVT-0000000000000001", edge: "start" };
    if (at) bound.at = at;
    return bound;
  };
  assert.equal(validAt(valid(ev(minute("2026-03-01T09:00", LA)), "2026-12-31"), day("2026-06-01", LA)), "in");
  assert.equal(validAt(valid(ev("2026-03-01T17:00:00Z"), "2026-12-31"), day("2026-02-01", LA)), "out");
  const un = open(validAt(valid(ev(), "2026-12-31"), day("2026-06-01", LA)));
  assert.equal(un.undetermined, true);
  assert.deepEqual(un.why, { key: "civil-time.values.event_unresolved", vars: { event: "EVT-0000000000000001", edge: "start" } });
  assert.equal(validAt(valid(ev(), "2026-12-31"), day("2027-06-01", LA)), "out", "the stated bound still decides");
  assert.equal(refusal(validAt(valid({ value: "2026-01-01", event: "EVT-0000000000000001", edge: "start" }, null), day("2026-06-01", LA))).refused, "BOUND_BOTH");
  /* the zone defaults to the view's time_zone */
  /** @type {ValidityRecord} */
  const noZone = { valid: { from: "2026-01-01", to: "2026-12-31", precision: "day" } };
  assert.equal(validAt(noZone, "2026-01-01T07:59:59Z", { view: firstView() }), "out");
  assert.equal(validAt(noZone, "2026-01-01T07:59:59Z", { view: testView() }), "in", "Halifax's day had begun");
  assert.equal(open(validAt(noZone, day("2026-06-01", LA))).undetermined, true, "no zone stated and no view");
  assert.throws(() => validAt(null, day("2026-06-01", LA)), TypeError);
});

test("R30 localClock: the wall clock of an instant in a zone, hour 0–23 and minute 0–59, across daylight-saving changes, beside localDay", () => {
  assert.deepEqual(localClock("2026-10-12T23:30:00Z", LA), { hour: 16, minute: 30 });
  /* the autumn change in Los Angeles: 08:30Z and 09:30Z both read 01:30 */
  assert.deepEqual(localClock("2026-11-01T08:30:00Z", LA), { hour: 1, minute: 30 });
  assert.deepEqual(localClock("2026-11-01T09:30:00Z", LA), { hour: 1, minute: 30 });
  assert.deepEqual(localClock("2026-11-01T10:30:00Z", LA), { hour: 2, minute: 30 });
  /* the spring change: 09:59:59Z is 01:59, 10:00Z is 03:00 */
  assert.deepEqual(localClock("2026-03-08T09:59:59Z", LA), { hour: 1, minute: 59 });
  assert.deepEqual(localClock("2026-03-08T10:00:00Z", LA), { hour: 3, minute: 0 });
  /* a half-hour and a quarter-hour zone */
  assert.deepEqual(localClock("2026-10-05T00:00:00Z", "Asia/Kolkata"), { hour: 5, minute: 30 });
  assert.deepEqual(localClock("2026-10-05T00:00:00Z", "Pacific/Chatham"), { hour: 13, minute: 45 });
  /* every half hour of 2026 in eight zones agrees with the runtime's own wall clock and with localDay's day */
  const t0 = Date.UTC(2026, 0, 1), t1 = Date.UTC(2027, 0, 1);
  for (const z of ZONES) {
    for (let t = t0; t < t1; t += 1800e3) {
      const w = oracleWall(t, z), c = localClock(iso(t), z);
      assert.deepEqual(c, { hour: +w.slice(11, 13), minute: +w.slice(14, 16) }, `${iso(t)} in ${z}`);
      assert.equal(localDay(iso(t), z), w.slice(0, 10), `${iso(t)} in ${z}: the day beside the clock`);
    }
  }
});

test("R30 localClock: an unknown zone is refused ZONE_INVALID, a malformed instant DATE_INVALID (as localDay refuses them); a wrong type throws TypeError", () => {
  for (const z of ["Mars/Olympus", "", "+05:00", "PST8PDT/x", "America/"]) assert.equal(refusal(localClock("2026-10-05T12:00:00Z", z)).refused, "ZONE_INVALID", z);
  for (const s of ["2026-10-05", "2026-10-05T12:00:00", "2026-10-05T12:00:00.000Z", "2026-13-05T12:00:00Z", "2026-10-05T24:00:00Z"])
    assert.equal(refusal(localClock(s, LA)).refused, "DATE_INVALID", s);
  assert.equal(refusal(localClock("x", "Mars/Olympus")).refused, refusal(localDay("x", "Mars/Olympus")).refused, "an instant is judged before the zone, as localDay judges it");
  assert.throws(() => localClock(1, LA), TypeError);
  assert.throws(() => localClock("2026-10-05T12:00:00Z"), TypeError);
});

test("R30 reasons are keys: every undetermined answer of values.mjs carries why as {key, vars}, never a string, and a key the list holds reads as non-empty English", () => {
  /** @type {(value: string) => DateTime} */
  const e = (value) => ({ value, precision: "edtf", zone: "UTC" });
  const answers = [
    compare(day("2026-10-05", LA), day("2026-10-05", LA)), compare(day("2026-10-05", LA), minute("2026-10-05T00:00", LA)),
    compare("2026-10-05T00:00:00Z", "2026-10-05T00:00:00Z"), compare(e("2004/.."), e("2010")), compare(e("2004/"), e("2010")),
    compare(e("../2012"), e("2010")), compare(e("/2012"), e("2010")), compare(e("2004/.."), e("../2010")),
    joinLocal("2026-03-08", "2:30 AM", LA), joinLocal("2026-11-01", "1:30 AM", LA),
    validAt(valid("2026-01-01", null), day("2026-06-01", LA)), validAt(valid(null, "2026-12-31"), day("2026-06-01", LA)),
    validAt(valid(null, null), day("2026-06-01", LA)), validAt(valid("2026-01-01", "2026-12-31"), { value: "2025-12/2026-01", precision: "edtf", zone: LA }),
    validAt(valid("2026-01-01", "2026-12-31"), { value: "2026-12/2027-01", precision: "edtf", zone: LA }),
    validAt(valid({ event: "EVT-0000000000000001", edge: "start" }, "2026-12-31"), day("2026-06-01", LA)),
    validAt(valid({ event: "EVT-0000000000000001" }, "2026-12-31"), day("2026-06-01", LA)),
    validAt({ valid: { from: "2026-01-01", to: "2026-12-31", precision: "day" } }, day("2026-06-01", LA)),
  ];
  /** @type {Set<string>} */
  const keys = new Set();
  for (const answer of answers) {
    const a = open(answer);
    assert.equal(a.undetermined, true, JSON.stringify(a));
    /** @type {Reason[]} */
    const whys = [a.why, ...(a.also || [])];
    for (const why of whys) {
      assert.equal(typeof why, "object", JSON.stringify(a));
      assert.equal(typeof why.key, "string");
      assert.ok(why.vars && typeof why.vars === "object" && !Array.isArray(why.vars));
      for (const v of Object.values(why.vars)) assert.equal(typeof v, "string", `${why.key}: a fill is a value, not a sentence made here`);
      assert.ok(reasonText(why).length > 5, why.key);
      if (hasWord(why.key)) assert.equal(word(why.key, why.vars), reasonText(why), `${why.key}: the list is read as the module reads it`);
      keys.add(why.key);
    }
  }
  /* each reason of R30's list is reached: no end, no start, the overlap, the unresolved event, the zone */
  for (const k of ["civil-time.end_stated", "civil-time.start_stated", "civil-time.values.overlap", "civil-time.precision_precision_held",
    "civil-time.values.event_unresolved", "civil-time.values.event_unresolved_edgeless", "civil-time.validity_states_zone",
    "civil-time.occur_clocks_move", "civil-time.occurs_twice_clocks", "civil-time.values.end_open", "civil-time.values.end_unknown",
    "civil-time.values.start_open", "civil-time.values.start_unknown", "civil-time.values.overlaps_start", "civil-time.values.overlaps_end"])
    assert.ok(keys.has(k), `${k} is reached`);
  /* a validity that fails two ways gives the first as why and the other as `also` */
  const two = open(validAt(valid(null, null), day("2026-06-01", LA)));
  const twoWhy = two.why, twoAlso = two.also || [];
  assert.deepEqual([twoWhy.key, ...twoAlso.map((w) => w.key)], ["civil-time.start_stated", "civil-time.end_stated"]);
  /* the date refusals stay refusals: a code and the detail */
  assert.equal(refusal(validAt(valid("2026-01-01", "2026-12-31"), day("2026-02-30", LA))).refused, "DATE_INVALID");
  assert.equal(refusal(validAt(valid("2026-01-01", "2026-12-31", "Nowhere/Town"), day("2026-06-01", LA))).refused, "ZONE_INVALID");
});
