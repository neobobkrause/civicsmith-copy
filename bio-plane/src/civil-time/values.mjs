/* civil-time: date-times and their spans (R1, R2, R5–R8, R22, R23). A date-time is `{value, precision, zone}`; an
 * instant is a string in `record-grammar`'s `ISO_TS_RE`. Inside the module a value is a half-open span of instants
 * `[lo, hi)` in seconds, an open or unknown EDTF end held as null (never a date). A day is its whole local day, never
 * its midnight (K1464). */
import { parseDay, dayText, DAY_RE } from "./days.mjs";
import { isZone, startOfDay, wallToInstants, instantText, parseInstant, localDayNumber, wallOf } from "./zone.mjs";
import { readEdtf } from "./edtf.mjs";
import { reason } from "./reasons.mjs";

export const refuse = (code, why) => ({ refused: code, why });
export const undetermined = (why, candidates) => (candidates ? { undetermined: true, why, candidates } : { undetermined: true, why });
/* R30: the reasons after the first, each a `{key, vars}` too. */
const withAlso = (answer, more) => (more.length ? { ...answer, also: more } : answer);
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

/** A date-time as a span `{lo, hi, dt}` of instants, or a refusal. An instant string is a second's span in UTC. */
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

/** R2. */
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

/** R5. */
export function compare(a, b) {
  const sa = spanOf(a);
  if (isNo(sa)) return sa;
  const sb = spanOf(b);
  if (isNo(sb)) return sb;
  return compareSpans(sa, sb);
}

/** R6. */
export function isCalendarDate(s) {
  return parseDay(s) !== null;
}

/** R1. */
export function localDay(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localDay takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  return dayText(localDayNumber(t, zone));
}

/** R30: the wall clock of `instant` in `zone`, from the same zone arithmetic as `localDay`. */
export function localClock(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localClock takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  const secondOfDay = ((wallOf(t, zone) % 86400) + 86400) % 86400;
  return { hour: Math.floor(secondOfDay / 3600), minute: Math.floor(secondOfDay / 60) % 60 };
}

/** R7. */
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

/** R8: a zone-less source date and a clock time written `h:mm AM` joined into a minute in `zone`. */
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

/** R22, R23: `in`, `out` or undetermined. `view` (optional) gives the zone when the validity states none. */
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
