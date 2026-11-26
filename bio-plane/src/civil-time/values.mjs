/* civil-time: date-times and their spans (R1, R2, R5–R8, R22, R23). A date-time is `{value, precision, zone}`; an
 * instant is a string in `record-grammar`'s `ISO_TS_RE`. Inside the module a value is a half-open span of instants
 * `[lo, hi)` in seconds, an open or unknown EDTF end held as null (never a date). A day is its whole local day, never
 * its midnight (K1464). */
import { parseDay, dayText, DAY_RE } from "./days.mjs";
import { isZone, startOfDay, wallToInstants, instantText, parseInstant, localDayNumber, wallOf } from "./zone.mjs";
import { readEdtf } from "./edtf.mjs";
import { reason } from "./reasons.mjs";
/** @import { Reason, Refusal, DateTime, When, Undetermined, View } from "./kinds.mjs" */
/** @import { EndKind, Qualifiers } from "./edtf.mjs" */

/** @typedef {{ value?: unknown, precision?: unknown, zone?: unknown }} DateTimeIn an object handed to `spanOf` as a
 *  date-time: read as one where its value, precision and zone are strings, else a TypeError */
/** @typedef {{ lo: number, hi: number, dt: DateTime, twice?: true }} FixedSpan a day, minute or second: `[lo, hi)` in
 *  seconds; `twice` where a wall time occurs twice */
/** @typedef {{ lo: number | null, hi: number | null, dt: DateTime, start: EndKind, end: EndKind,
 *  qualifiers: Qualifiers & { interval: boolean }, twice?: never }} EdtfSpan an EDTF value: an open or unknown end null;
 *  never `twice` */
/** @typedef {FixedSpan | EdtfSpan} Span */

/** @type {(code: string, why: string) => Refusal} */
export const refuse = (code, why) => ({ refused: code, why });
/**
 * @template [C=never]
 * @param {Reason} why
 * @param {C[]} [candidates]
 * @returns {Undetermined<C>}
 */
export function undetermined(why, candidates) {
  /** @type {Undetermined<C>} */
  const out = { undetermined: true, why };
  if (candidates) out.candidates = candidates;
  return out;
}
/* R30: the reasons after the first, each a `{key, vars}` too. */
/** @param {Undetermined} answer
 * @param {Reason[]} more
 * @returns {Undetermined} */
function withAlso(answer, more) {
  if (!more.length) return answer;
  /** @type {Undetermined} */
  const out = { undetermined: true, why: answer.why };
  const candidates = answer.candidates, also = answer.also;
  if (candidates) out.candidates = candidates;
  if (also) out.also = also;
  out.also = more;
  return out;
}

/** @type {string[]} */
const PRECISIONS = ["day", "minute", "second", "edtf"];
const MINUTE_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const SECOND_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** @param {unknown} zone
 * @returns {Refusal | null} */
export function zoneRefusal(zone) {
  return isZone(zone) ? null : refuse("ZONE_INVALID", `'${String(zone)}' is not a time zone the runtime knows (an IANA name)`);
}

/** The wall time `day`T`h:m:s` as seconds counted as though UTC, or null when not a real time.
 * @param {string | undefined} day
 * @param {number} h
 * @param {number} m
 * @param {number} s
 * @returns {number | null} */
function wallSeconds(day, h, m, s) {
  const n = parseDay(day);
  if (n === null || h > 23 || m > 59 || s > 59) return null;
  return n * 86400 + h * 3600 + m * 60 + s;
}

/** A date-time as a span `{lo, hi, dt}` of instants, or a refusal. An instant string is a second's span in UTC.
 * @param {string | DateTimeIn | null | undefined} x
 * @returns {Span | Refusal}
 * @throws {TypeError} when `x` is neither, or its parts are not strings */
export function spanOf(x) {
  const given = x;
  if (typeof given === "string") {
    const t = parseInstant(given);
    if (t === null) return refuse("DATE_INVALID", `'${given}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
    return { lo: t, hi: t + 1, dt: { value: given, precision: "second", zone: "UTC" } };
  }
  if (!given || typeof given !== "object") throw new TypeError("a date-time is an object {value, precision, zone} or an instant string");
  const { value, precision, zone } = given;
  if (typeof value !== "string" || typeof precision !== "string" || typeof zone !== "string")
    throw new TypeError("a date-time's value, precision and zone are strings");
  const z = zoneRefusal(zone);
  if (z) return z;
  /** @type {DateTime} */
  const dt = { value, precision, zone };
  if (!PRECISIONS.includes(precision)) return refuse("DATE_INVALID", `'${precision}' is not a precision (day, minute, second, edtf)`);
  /** @type {(why: string) => Refusal} */
  const bad = (why) => refuse("DATE_INVALID", `'${value}' is not a ${precision}-precision value: ${why}`);
  if (precision === "day") {
    const n = parseDay(value);
    if (n === null) return bad(DAY_RE.test(value) ? "no such day" : "a day is YYYY-MM-DD");
    return { lo: startOfDay(n, zone), hi: startOfDay(n + 1, zone), dt };
  }
  if (precision === "minute" || precision === "second") {
    const m = (precision === "minute" ? MINUTE_RE : SECOND_RE).exec(value);
    if (!m) return bad(precision === "minute" ? "a minute is YYYY-MM-DDTHH:MM" : "a second is YYYY-MM-DDTHH:MM:SS");
    const wall = wallSeconds(m[1], Number(m[2]), Number(m[3]), m[4] === undefined ? 0 : Number(m[4]));
    if (wall === null) return bad("no such date or time");
    const c = wallToInstants(wall, zone);
    const first = c[0], last = c[c.length - 1];
    if (first === undefined || last === undefined) return bad(`that wall time does not occur in ${zone} (the clocks skip it)`);
    /** @type {FixedSpan} */
    const sp = { lo: first, hi: last + (precision === "minute" ? 60 : 1), dt };
    if (c.length > 1) sp.twice = true;
    return sp;
  }
  const r = readEdtf(value);
  if ("refused" in r) return r;
  const rlo = r.lo, rhi = r.hi;
  return { lo: rlo === null ? null : startOfDay(rlo, zone), hi: rhi === null ? null : startOfDay(rhi + 1, zone),
           dt, start: r.start, end: r.end, qualifiers: r.qualifiers };
}

/** @type {(t: number | null) => string | null} */
const text = (t) => (t === null ? null : instantText(t));

/** R2.
 * @param {When} dt
 * @returns {{ earliest: string | null, latest: string | null } | Refusal}
 * @throws {TypeError} when `dt` is not a date-time object or an instant string */
export function bounds(dt) {
  const s = spanOf(dt);
  if ("refused" in s) return s;
  return { earliest: text(s.lo), latest: text(s.hi) };
}

/** @type {(s: Span) => string} */
const zoneOf = (s) => (s.dt.zone ? s.dt.zone : "UTC");

/** R5 over spans already read.
 * @param {Span} a
 * @param {Span} b
 * @returns {"before" | "after" | Undetermined} */
export function compareSpans(a, b) {
  const alo = a.lo, ahi = a.hi, blo = b.lo, bhi = b.hi;
  if (ahi !== null && blo !== null && ahi <= blo) return "before";
  if (bhi !== null && alo !== null && bhi <= alo) return "after";
  /* R30: the reason is a key with its fills; a second open end rides in `also`, as validAt's further reasons do */
  /** @type {Reason[]} */
  const open = [];
  for (const s of [a, b]) {
    if (!("start" in s) || (s.lo !== null && s.hi !== null)) continue;   /* only an EDTF end is ever open */
    const side = s.lo === null ? "start" : "end", kind = s.lo === null ? s.start : s.end;
    open.push(reason(`civil-time.values.${side}_${kind}`, { value: String(s.dt.value) }));
  }
  const first = open[0];
  if (first) return withAlso(undetermined(first), open.slice(1));
  if (a.dt.value === b.dt.value && a.dt.precision === b.dt.precision)
    return undetermined(reason("civil-time.precision_precision_held", { value: String(a.dt.value), precision: String(a.dt.precision) }));
  return undetermined(reason("civil-time.values.overlap", { value: String(a.dt.value), precision: String(a.dt.precision), zone: zoneOf(a),
    value_2: String(b.dt.value), precision_2: String(b.dt.precision), zone_2: zoneOf(b) }));
}

/** R5.
 * @param {When} a
 * @param {When} b
 * @returns {"before" | "after" | Undetermined | Refusal}
 * @throws {TypeError} when either is not a date-time object or an instant string */
export function compare(a, b) {
  const sa = spanOf(a);
  if ("refused" in sa) return sa;
  const sb = spanOf(b);
  if ("refused" in sb) return sb;
  return compareSpans(sa, sb);
}

/** R6.
 * @param {unknown} s
 * @returns {boolean} */
export function isCalendarDate(s) {
  return parseDay(s) !== null;
}

/** R1.
 * @param {string} instant
 * @param {string} zone
 * @returns {string | Refusal}
 * @throws {TypeError} when either is not a string */
export function localDay(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localDay takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  return dayText(localDayNumber(t, zone));
}

/** R30: the wall clock of `instant` in `zone`, from the same zone arithmetic as `localDay`.
 * @param {string} instant
 * @param {string} zone
 * @returns {{ hour: number, minute: number } | Refusal}
 * @bound hour: whole number, 0 to 23; minute: whole number, 0 to 59
 * @throws {TypeError} when either is not a string */
export function localClock(instant, zone) {
  if (typeof instant !== "string" || typeof zone !== "string") throw new TypeError("localClock takes an instant and a zone, both strings");
  const t = parseInstant(instant);
  if (t === null) return refuse("DATE_INVALID", `'${instant}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const z = zoneRefusal(zone);
  if (z) return z;
  const secondOfDay = ((wallOf(t, zone) % 86400) + 86400) % 86400;
  return { hour: Math.floor(secondOfDay / 3600), minute: Math.floor(secondOfDay / 60) % 60 };
}

/** R7.
 * @param {string} fromDay
 * @param {string} toDay
 * @param {string} zone
 * @returns {{ start: string, end: string } | Refusal}
 * @throws {TypeError} when any is not a string */
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

/** R8: a zone-less source date and a clock time written `h:mm AM` joined into a minute in `zone`.
 * @param {string} date
 * @param {string} time
 * @param {string} zone
 * @returns {DateTime | Undetermined<string> | Refusal}
 * @throws {TypeError} when any is not a string */
export function joinLocal(date, time, zone) {
  if (typeof date !== "string" || typeof time !== "string" || typeof zone !== "string")
    throw new TypeError("joinLocal takes a date, a time and a zone, all strings");
  const dm = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00)?$/.exec(date.trim());
  const dayN = dm ? parseDay(dm[1]) : null;
  if (!dm || dayN === null) return refuse("DATE_INVALID", `'${date}' is not a date (YYYY-MM-DD, or with T00:00:00)`);
  const tm = /^(\d{1,2})\s*:\s*(\d{2})\s*([ap])\.?\s*m\.?$/i.exec(time.trim());
  if (!tm || Number(tm[1]) < 1 || Number(tm[1]) > 12 || Number(tm[2]) > 59) return refuse("DATE_INVALID", `'${time}' is not a clock time written h:mm AM or h:mm PM`);
  const z = zoneRefusal(zone);
  if (z) return z;
  const h = (Number(tm[1]) % 12) + ((tm[3] ?? "").toLowerCase() === "p" ? 12 : 0);
  /** @type {(n: number) => string} */
  const p = (n) => String(n).padStart(2, "0");
  const value = `${dm[1]}T${p(h)}:${tm[2]}`;
  const c = wallToInstants(dayN * 86400 + h * 3600 + Number(tm[2]) * 60, zone);
  if (!c.length) return undetermined(reason("civil-time.occur_clocks_move", { value: String(value), zone: String(zone) }));
  if (c.length > 1) return undetermined(reason("civil-time.occurs_twice_clocks", { value: String(value), zone: String(zone) }), c.map(instantText));
  return { value, precision: "minute", zone };
}

/* ---- validAt (R22, R23) ---- */

/** @typedef {{ value?: string | null, precision?: string, zone?: string, event?: string | null, edge?: string,
 *  at?: When | null }} BoundObject a validity's bound: a value (with its own precision and zone), or an event's edge
 *  and the caller's resolution of it (`at`) (R23) */
/** @typedef {string | BoundObject | null} Bound a bound; null or absent is "not stated", never "always" (R22) */
/** @typedef {{ from?: Bound, to?: Bound, precision?: string, zone?: string | null }} Validity */
/** @typedef {{ valid: Validity, basis?: string | object | null }} ValidityRecord what `validAt` takes: a validity and its basis */
/** @typedef {{ none: true }} NoBound */

/** @param {Bound | undefined} b
 * @param {string} precision
 * @param {string | null} zone
 * @param {string} side
 * @returns {NoBound | Span | Refusal | Undetermined} */
function boundSpan(b, precision, zone, side) {
  if (b === null || b === undefined) return { none: true };
  if (typeof b === "string") return spanOf(precision === "instant" ? b : { value: b, precision, zone });
  if (typeof b !== "object") throw new TypeError(`a validity's ${side} is a string, an object or null`);
  const value = b.value, event = b.event;
  const hasValue = value !== undefined && value !== null;
  const hasEvent = event !== undefined && event !== null;
  if (hasValue && hasEvent) return refuse("BOUND_BOTH", `the validity's ${side} gives both a value and an event`);
  if (hasValue) return boundSpan(value, b.precision || precision, b.zone || zone, side);
  if (hasEvent) {
    const at = b.at, edge = b.edge;
    if (at === undefined || at === null) return undetermined(edge ? reason("civil-time.values.event_unresolved", { event: String(event), edge: String(edge) })
      : reason("civil-time.values.event_unresolved_edgeless", { event: String(event) }));
    return spanOf(at);
  }
  return { none: true };
}

/** R22, R23: `in`, `out` or undetermined. `view` (optional) gives the zone when the validity states none.
 * @param {ValidityRecord} validity
 * @param {When} date
 * @param {{ view?: View | null }} [opts]
 * @returns {"in" | "out" | Undetermined | Refusal}
 * @throws {TypeError} when `validity` holds no `valid` object, or `date` is not a date-time */
export function validAt(validity, date, { view } = {}) {
  if (!validity || typeof validity !== "object" || !validity.valid || typeof validity.valid !== "object")
    throw new TypeError("validAt takes {valid: {from, to, precision, zone}, basis}");
  const v = validity.valid;
  const tzFact = view ? view.time_zone : undefined, tzValue = tzFact ? tzFact.value : undefined;
  const zone = v.zone || (typeof tzValue === "string" ? tzValue : null);
  const precision = v.precision || "day";
  const needZone = [v.from, v.to].some((b) => typeof b === "string" || (b && typeof b === "object" && b.value != null && !b.zone));
  if (needZone && !zone) return undetermined(reason("civil-time.validity_states_zone"));
  if (needZone) { const z = zoneRefusal(zone); if (z) return z; }
  const d = spanOf(date);
  if ("refused" in d) return d;
  const from = boundSpan(v.from, precision, zone, "from");
  const to = boundSpan(v.to, precision, zone, "to");
  if ("refused" in from) return from;
  if ("refused" in to) return to;
  const dlo = d.lo, dhi = d.hi;
  const fromLo = "lo" in from ? from.lo : null, toHi = "hi" in to ? to.hi : null;
  if (fromLo !== null && dhi !== null && dhi <= fromLo) return "out";
  if (toHi !== null && dlo !== null && dlo >= toHi) return "out";
  /** @type {Reason[]} */
  const whys = [];
  /** @type {(b: NoBound | Span | Undetermined, side: string) => boolean} */
  const within = (b, side) => {
    if ("none" in b) { whys.push(reason(side === "from" ? "civil-time.start_stated" : "civil-time.end_stated")); return false; }
    if ("undetermined" in b) { whys.push(b.why); return false; }
    const blo = b.lo, bhi = b.hi;
    const ok = side === "from" ? blo !== null && dlo !== null && dlo >= blo : bhi !== null && dhi !== null && dhi <= bhi;
    if (!ok) whys.push(reason(side === "from" ? "civil-time.values.overlaps_start" : "civil-time.values.overlaps_end", { value: String(d.dt.value), bound: String(b.dt.value) }));
    return ok;
  };
  const a = within(from, "from"), b = within(to, "to");
  const first = whys[0];   /* every bound not met pushed its reason, so `first` is held whenever a or b is false */
  if ((a && b) || !first) return "in";
  return withAlso(undetermined(first), whys.slice(1));
}
