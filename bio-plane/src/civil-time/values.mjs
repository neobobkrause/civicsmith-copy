/* civil-time: date-times and their spans (R1, R2, R5–R8, R22, R23). A date-time is `{value, precision, zone}`; an
 * instant is a string in `record-grammar`'s `ISO_TS_RE`. Inside the module a value is a half-open span of instants
 * `[lo, hi)` in seconds, an open or unknown EDTF end held as null (never a date). A day is its whole local day, never
 * its midnight (K1464). */
import { parseDay, dayText, DAY_RE } from "./days.mjs";
import { isZone, startOfDay, wallToInstants, instantText, parseInstant, localDayNumber, wallOf } from "./zone.mjs";
import { readEdtf } from "./edtf.mjs";
import { reason } from "./reasons.mjs";

/**
 * A date-time (R2): a value held at a precision, in a zone.
 * @typedef {Object} DateTime
 * @property {string} value the date or time as written
 * @property {string} precision how much of the value is known
 * @property {string} zone the zone the value is read in
 * @bound precision: one of day, minute, second, edtf; any other is refused DATE_INVALID
 * @bound value: day YYYY-MM-DD, minute YYYY-MM-DDTHH:MM, second YYYY-MM-DDTHH:MM:SS, edtf an EDTF level-1 string (R3); a value not of its precision's form is refused DATE_INVALID
 * @bound zone: an IANA name the runtime knows, never a bare offset; any other is refused ZONE_INVALID
 */
/**
 * An instant: a string of `record-grammar`'s `ISO_TS_RE` (YYYY-MM-DDTHH:MM:SSZ), naming a real second.
 * @typedef {string} Instant
 */
/**
 * A reason (R30): a key of the word list with the values it fills, never English. A reason a caller handed in is
 * passed on as it came.
 * @typedef {Object} Reason
 * @property {string} key
 * @property {Object<string, *>} vars the values it fills; empty where it fills none
 * @bound key: a row of the word list, or one this module writes first by `localize`; `REASON_KEYS` lists the module's own
 */
/**
 * A refusal: a code and a detail string; its sentence is `refusal.<CODE>`. It may carry further fields of the answer
 * it stands in for (`due` adds its basis kind).
 * @typedef {{refused: string, why: Detail, undetermined?: undefined, [more: string]: *}} Refusal
 * @bound refused: ZONE_INVALID, DATE_INVALID, EDTF_UNSUPPORTED, RANGE_INVERTED, BOUND_BOTH, BASIS_UNKNOWN, SIDE_UNKNOWN, UNIT_UNKNOWN or RRULE_UNSUPPORTED
 */
/**
 * An undetermined answer: which kind of no and why (R28). Never read as yes, no or zero. It may carry further fields
 * of the answer it stands in for (a rule's `trace`, `due`'s basis kind).
 * @typedef {{undetermined: true, why: Reason, refused?: undefined, candidates?: Array<*>, also?: Array<Reason>, code?: string, field?: string, [more: string]: *}} Undetermined
 * @bound candidates: the readings that remain, where there are some
 * @bound also: the reasons after the first
 * @bound code: the kind of no, where the answer names one (rules, calendars, fiscal years); field: for RULE_INVALID, the rule's field at fault
 */
/**
 * A refusal's detail: a string of English for a log, with no key; its sentence for people is `refusal.<CODE>`.
 * @typedef {string & {key?: undefined, vars?: undefined}} Detail
 */
/**
 * The span of instants a date-time covers, as the module holds it: whole seconds since 1970-01-01T00:00:00Z.
 * @typedef {Object} Span
 * @property {number|null} lo the first second covered; null at an open or unknown start
 * @property {number|null} hi the first second not covered; null at an open or unknown end
 * @property {DateTime} dt the date-time read; an instant string reads as a second in UTC
 * @property {boolean} [twice] a minute or second whose wall time occurs twice
 * @property {string} [start] an EDTF value's start: known, open or unknown
 * @property {string} [end] an EDTF value's end: known, open or unknown
 * @property {*} [qualifiers] an EDTF value's qualifiers
 * @property {undefined} [refused] absent
 * @property {undefined} [undetermined] absent
 * @property {undefined} [none] absent
 */
/**
 * What every answer that is neither a refusal nor undetermined also states: none of their fields, so that a caller
 * may ask any answer whether it is one.
 * @typedef {Object} Answered
 * @property {undefined} [refused] absent
 * @property {undefined} [undetermined] absent
 * @property {undefined} [why] absent
 * @property {undefined} [also] absent
 * @property {undefined} [code] absent
 * @property {undefined} [field] absent
 * @property {undefined} [candidates] absent
 */
/**
 * The span of instants a date-time covers.
 * @typedef {Object} Bounds
 * @property {Instant|null} earliest the first instant covered; null at an open or unknown start
 * @property {Instant|null} latest the first instant not covered; null at an open or unknown end
 * @bound half-open: [earliest, latest)
 */
/**
 * A local wall clock (R30).
 * @typedef {Object} Clock
 * @property {number} hour
 * @property {number} minute
 * @bound hour: whole number, 0 to 23
 * @bound minute: whole number, 0 to 59
 */
/**
 * A bound of a validity (R22, R23): a value in the validity's precision and zone, one with its own, an event's edge,
 * or null for "not stated".
 * @typedef {string|{value?: string|null, precision?: string, zone?: string, event?: string|null, edge?: string, at?: DateTime|Instant|null}|null|undefined} ValidityBound
 * @bound a bound giving both a value and an event is refused BOUND_BOTH; an event with no `at` is undetermined
 */
/**
 * A validity (R22, R23).
 * @typedef {Object} Validity
 * @property {{from?: ValidityBound, to?: ValidityBound, precision?: string, zone?: string}} valid
 * @property {*} [basis]
 * @bound valid.precision: absent is day; "instant" reads a string bound as an instant
 * @bound valid.zone: absent is the view's time_zone; with neither, a bound that needs one is undetermined
 */

/** @type {(code: string, why: string) => Refusal} */
export const refuse = (code, why) => ({ refused: code, why });
/** @type {(why: Reason, candidates?: Array<*>) => Undetermined} */
export const undetermined = (why, candidates) => (candidates ? { undetermined: true, why, candidates } : { undetermined: true, why });
/* R30: the reasons after the first, each a `{key, vars}` too. */
const withAlso = (answer, more) => (more.length ? { ...answer, also: more } : answer);
/** @type {(r: *) => r is Refusal | Undetermined} */
export const isNo = (r) => !!(r && (r.refused || r.undetermined));

const PRECISIONS = ["day", "minute", "second", "edtf"];
const MINUTE_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const SECOND_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export function zoneRefusal(zone) {
  return isZone(zone) ? null : refuse("ZONE_INVALID", `'${String(zone)}' is not a time zone the runtime knows (an IANA name)`);
}

/** The wall time `day`T`h:m:s` as seconds counted as though UTC, or null when not a real time. */
function wallSeconds(day, h, m, s) {
  const n = parseDay(day);
  if (n === null || h > 23 || m > 59 || s > 59) return null;
  return n * 86400 + h * 3600 + m * 60 + s;
}

/**
 * A date-time as a span `{lo, hi, dt}` of instants, or a refusal. An instant string is a second's span in UTC.
 * @param {*} x a DateTime or an Instant
 * @returns {Span|Refusal}
 * @throws {TypeError} when `x` is neither a string nor an object, or its value, precision or zone is not a string
 */
export function spanOf(x) {
  if (typeof x === "string") {
    const t = parseInstant(x);
    if (t === null) return refuse("DATE_INVALID", `'${x}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
    return { lo: t, hi: t + 1, dt: { value: x, precision: "second", zone: "UTC" } };
  }
  if (!x || typeof x !== "object") throw new TypeError("a date-time is an object {value, precision, zone} or an instant string");
  const { value, precision, zone } = x;
  if (typeof value !== "string" || typeof precision !== "string" || typeof zone !== "string")
    throw new TypeError("a date-time's value, precision and zone are strings");
  const z = zoneRefusal(zone);
  if (z) return z;
  if (!PRECISIONS.includes(precision)) return refuse("DATE_INVALID", `'${precision}' is not a precision (day, minute, second, edtf)`);
  const bad = (why) => refuse("DATE_INVALID", `'${value}' is not a ${precision}-precision value: ${why}`);
  if (precision === "day") {
    const n = parseDay(value);
    if (n === null) return bad(DAY_RE.test(value) ? "no such day" : "a day is YYYY-MM-DD");
    return { lo: startOfDay(n, zone), hi: startOfDay(n + 1, zone), dt: x };
  }
  if (precision === "minute" || precision === "second") {
    const m = (precision === "minute" ? MINUTE_RE : SECOND_RE).exec(value);
    if (!m) return bad(precision === "minute" ? "a minute is YYYY-MM-DDTHH:MM" : "a second is YYYY-MM-DDTHH:MM:SS");
    const wall = wallSeconds(m[1], +m[2], +m[3], m[4] === undefined ? 0 : +m[4]);
    if (wall === null) return bad("no such date or time");
    const c = wallToInstants(wall, zone);
    if (!c.length) return bad(`that wall time does not occur in ${zone} (the clocks skip it)`);
    return { lo: c[0], hi: c[c.length - 1] + (precision === "minute" ? 60 : 1), dt: x, ...(c.length > 1 ? { twice: true } : {}) };
  }
  const r = readEdtf(value);
  if (r.refused) return r;
  return { lo: r.lo === null ? null : startOfDay(r.lo, zone), hi: r.hi === null ? null : startOfDay(r.hi + 1, zone),
           dt: x, start: r.start, end: r.end, qualifiers: r.qualifiers };
}

const text = (t) => (t === null ? null : instantText(t));

/**
 * R2: the half-open span of instants a date-time covers in its zone; an EDTF value at its widest reading (R3).
 * @param {DateTime|Instant} dt an instant string is a second in UTC
 * @returns {(Bounds & Answered)|Refusal}
 * @throws {TypeError} when `dt` is neither a string nor an object, or its value, precision or zone is not a string
 */
export function bounds(dt) {
  const s = spanOf(dt);
  if (isNo(s)) return s;
  return { earliest: text(s.lo), latest: text(s.hi) };
}

const zoneOf = (s) => (s.dt.zone ? s.dt.zone : "UTC");

/** R5 over spans already read. */
export function compareSpans(a, b) {
  if (a.hi !== null && b.lo !== null && a.hi <= b.lo) return "before";
  if (b.hi !== null && a.lo !== null && b.hi <= a.lo) return "after";
  /* R30: the reason is a key with its fills; a second open end rides in `also`, as validAt's further reasons do */
  const open = [a, b].filter((s) => s.lo === null || s.hi === null).map((s) => {
    const side = s.lo === null ? "start" : "end", kind = s.lo === null ? s.start : s.end;
    return reason(`civil-time.values.${side}_${kind}`, { value: String(s.dt.value) });
  });
  if (open.length) return withAlso(undetermined(open[0]), open.slice(1));
  if (a.dt.value === b.dt.value && a.dt.precision === b.dt.precision)
    return undetermined(reason("civil-time.precision_precision_held", { value: String(a.dt.value), precision: String(a.dt.precision) }));
  return undetermined(reason("civil-time.values.overlap", { value: String(a.dt.value), precision: String(a.dt.precision), zone: zoneOf(a),
    value_2: String(b.dt.value), precision_2: String(b.dt.precision), zone_2: zoneOf(b) }));
}

/**
 * R5: the one sequence read. `before` only when all of `a` lies before all of `b`, `after` in the mirror case,
 * otherwise undetermined naming the overlap or the open end. A day is never read as its midnight.
 * @param {DateTime|Instant} a
 * @param {DateTime|Instant} b
 * @returns {("before" & Answered)|("after" & Answered)|Undetermined|Refusal}
 * @throws {TypeError} as `bounds` throws, for either argument
 */
export function compare(a, b) {
  const sa = spanOf(a);
  if (isNo(sa)) return sa;
  const sb = spanOf(b);
  if (isNo(sb)) return sb;
  return compareSpans(sa, sb);
}

/**
 * R6: true only for a YYYY-MM-DD naming a real day of the proleptic Gregorian calendar.
 * @param {*} s any value; anything but such a string is false
 * @returns {boolean}
 */
export function isCalendarDate(s) {
  return parseDay(s) !== null;
}

/**
 * R1: the calendar day, in `zone`, on which `instant` falls, across daylight-saving changes.
 * @param {Instant} instant
 * @param {string} zone an IANA name
 * @returns {(string & Answered)|Refusal} the day, YYYY-MM-DD (ISO 8601's expanded form outside 0000 to 9999)
 * @throws {TypeError} when either argument is not a string
 */
export function localDay(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localDay takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  return dayText(localDayNumber(t, zone));
}

/**
 * R30: the wall clock of `instant` in `zone`, from the same zone arithmetic as `localDay`. It formats nothing.
 * @param {Instant} instant
 * @param {string} zone an IANA name
 * @returns {(Clock & Answered)|Refusal}
 * @throws {TypeError} when either argument is not a string
 */
export function localClock(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localClock takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  const secondOfDay = ((wallOf(t, zone) % 86400) + 86400) % 86400;
  return { hour: Math.floor(secondOfDay / 3600), minute: Math.floor(secondOfDay / 60) % 60 };
}

/**
 * R7: the inclusive local-day range: `start` is the first instant of `fromDay`, `end` the first instant after `toDay`.
 * @param {string} fromDay YYYY-MM-DD
 * @param {string} toDay YYYY-MM-DD
 * @param {string} zone an IANA name
 * @returns {({start: Instant, end: Instant} & Answered)|Refusal}
 * @bound fromDay after toDay is refused RANGE_INVERTED; a day that is not a calendar date (R6) is refused DATE_INVALID
 * @throws {TypeError} when any argument is not a string
 */
export function dayRange(fromDay, toDay, zone) {
  if (typeof fromDay !== "string" || typeof toDay !== "string" || typeof zone !== "string")
    throw new TypeError("dayRange takes two days and a zone, all strings");
  const a = parseDay(fromDay), b = parseDay(toDay);
  if (a === null || b === null) return refuse("DATE_INVALID", `'${a === null ? fromDay : toDay}' is not a calendar day (YYYY-MM-DD)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  if (a > b) return refuse("RANGE_INVERTED", `${fromDay} is after ${toDay}`);
  return { start: instantText(startOfDay(a, zone)), end: instantText(startOfDay(b + 1, zone)) };
}

/**
 * R8: a zone-less source date and a clock time written `h:mm AM` joined into a minute in `zone`.
 * @param {string} date YYYY-MM-DD, or the same followed by T00:00:00
 * @param {string} time h:mm AM or hh:mm PM, case and spacing folded
 * @param {string} zone an IANA name
 * @returns {(DateTime & Answered)|Undetermined|Refusal} a minute-precision date-time; undetermined with both candidate instants when the wall time occurs twice, with why when it does not occur
 * @bound time: hour 1 to 12, minute 0 to 59; any other is refused DATE_INVALID
 * @throws {TypeError} when any argument is not a string
 */
export function joinLocal(date, time, zone) {
  if (typeof date !== "string" || typeof time !== "string" || typeof zone !== "string")
    throw new TypeError("joinLocal takes a date, a time and a zone, all strings");
  const dm = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00)?$/.exec(date.trim());
  if (!dm || parseDay(dm[1]) === null) return refuse("DATE_INVALID", `'${date}' is not a date (YYYY-MM-DD, or with T00:00:00)`);
  const tm = /^(\d{1,2})\s*:\s*(\d{2})\s*([ap])\.?\s*m\.?$/i.exec(time.trim());
  if (!tm || +tm[1] < 1 || +tm[1] > 12 || +tm[2] > 59) return refuse("DATE_INVALID", `'${time}' is not a clock time written h:mm AM or h:mm PM`);
  const z = zoneRefusal(zone);
  if (z) return z;
  const h = (+tm[1] % 12) + (tm[3].toLowerCase() === "p" ? 12 : 0);
  const p = (n) => String(n).padStart(2, "0");
  const value = `${dm[1]}T${p(h)}:${tm[2]}`;
  const c = wallToInstants(parseDay(dm[1]) * 86400 + h * 3600 + +tm[2] * 60, zone);
  if (!c.length) return undetermined(reason("civil-time.occur_clocks_move", { value: String(value), zone: String(zone) }));
  if (c.length > 1) return undetermined(reason("civil-time.occurs_twice_clocks", { value: String(value), zone: String(zone) }), c.map(instantText));
  return { value, precision: "minute", zone };
}

/* ---- validAt (R22, R23) ---- */

/** A validity's bound as a span; `{none: true}` when it is not stated.
 *  @param {ValidityBound} b @param {string} precision @param {string|null} zone null only where no bound needs one (`validAt` answers first otherwise) @param {string} side
 *  @returns {Span|Refusal|Undetermined|{none: true, refused?: undefined, undetermined?: undefined, lo?: undefined, hi?: undefined, dt?: undefined}} */
function boundSpan(b, precision, zone, side) {
  if (b === null || b === undefined) return { none: true };
  if (typeof b === "string") return spanOf(precision === "instant" ? b : { value: b, precision, zone });
  if (typeof b !== "object") throw new TypeError(`a validity's ${side} is a string, an object or null`);
  const hasValue = b.value !== undefined && b.value !== null;
  const hasEvent = b.event !== undefined && b.event !== null;
  if (hasValue && hasEvent) return refuse("BOUND_BOTH", `the validity's ${side} gives both a value and an event`);
  if (hasValue) return boundSpan(b.value, b.precision || precision, b.zone || zone, side);
  if (hasEvent) {
    if (b.at === undefined || b.at === null) return undetermined(b.edge ? reason("civil-time.values.event_unresolved", { event: String(b.event), edge: String(b.edge) })
      : reason("civil-time.values.event_unresolved_edgeless", { event: String(b.event) }));
    return spanOf(b.at);
  }
  return { none: true };
}

/**
 * R22, R23: `in`, `out` or undetermined. A null bound means "not stated", never "always". Bounds are compared as
 * R5 compares. `view` (optional) gives the zone when the validity states none.
 * @param {Validity} validity
 * @param {DateTime|Instant} date
 * @param {{view?: {time_zone?: {value?: *}}|null}} [opts]
 * @returns {("in" & Answered)|("out" & Answered)|Undetermined|Refusal}
 * @throws {TypeError} when `validity.valid` is not an object, a bound is not a string, an object or null, or `date` is malformed as `bounds` throws
 */
export function validAt(validity, date, { view } = {}) {
  if (!validity || typeof validity !== "object" || !validity.valid || typeof validity.valid !== "object")
    throw new TypeError("validAt takes {valid: {from, to, precision, zone}, basis}");
  const v = validity.valid;
  const zone = v.zone || (view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null);
  const precision = v.precision || "day";
  const needZone = [v.from, v.to].some((b) => typeof b === "string" || (b && typeof b === "object" && b.value != null && !b.zone));
  if (needZone && !zone) return undetermined(reason("civil-time.validity_states_zone"));
  if (needZone) { const z = zoneRefusal(zone); if (z) return z; }
  const d = spanOf(date);
  if (isNo(d)) return d;
  const from = boundSpan(v.from, precision, zone, "from");
  const to = boundSpan(v.to, precision, zone, "to");
  for (const b of [from, to]) if (b.refused) return b;
  if (!from.none && !from.undetermined && from.lo !== null && d.hi !== null && d.hi <= from.lo) return "out";
  if (!to.none && !to.undetermined && to.hi !== null && d.lo !== null && d.lo >= to.hi) return "out";
  const whys = [];
  const within = (b, side) => {
    if (b.none) { whys.push(reason(side === "from" ? "civil-time.start_stated" : "civil-time.end_stated")); return false; }
    if (b.undetermined) { whys.push(b.why); return false; }
    const ok = side === "from" ? b.lo !== null && d.lo !== null && d.lo >= b.lo : b.hi !== null && d.hi !== null && d.hi <= b.hi;
    if (!ok) whys.push(reason(side === "from" ? "civil-time.values.overlaps_start" : "civil-time.values.overlaps_end", { value: String(d.dt.value), bound: String(b.dt.value) }));
    return ok;
  };
  const a = within(from, "from"), b = within(to, "to");
  if (a && b) return "in";
  return withAlso(undetermined(whys[0]), whys.slice(1));
}
