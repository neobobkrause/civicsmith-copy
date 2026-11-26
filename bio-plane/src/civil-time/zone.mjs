/* civil-time: zones. An instant is held inside the module as whole seconds since 1970-01-01T00:00:00Z (a Number);
 * a zone's offset at an instant comes from `Intl.DateTimeFormat` with the IANA name (the runtime's tz data, named in
 * every trace, R25). No clock is read: every instant comes from an argument (R26). */
import { ISO_TS_RE } from "../record-grammar/index.mjs";
import { dayNumber, civil, yearText, monthLength } from "./days.mjs";

const DAY_S = 86400;
const INTL_LIMIT_S = 8.64e12;           /* the range a JavaScript time value can hold, in seconds */
/** @type {Map<string, Intl.DateTimeFormat | null>} each zone's formatter, null where the runtime knows no such zone */
const formatters = new Map([]);

/** @param {string} zone
 * @returns {Intl.DateTimeFormat | null} */
function formatter(zone) {
  const known = formatters.get(zone);
  if (known !== undefined) return known;
  /** @type {Intl.DateTimeFormat | null} */
  let f = null;
  try {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", era: "short", year: "numeric",
      month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  } catch { f = null; }
  formatters.set(zone, f);
  return f;
}

/** An IANA zone name the runtime knows (`Area/Location`, or `UTC`); never a bare offset.
 * @param {unknown} zone
 * @returns {boolean} */
export function isZone(zone) {
  return typeof zone === "string" && /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/.test(zone) && formatter(zone) !== null;
}

/* N565: the offset read from the runtime, one `formatToParts` per call. */
/** @param {number} t
 * @param {string} zone
 * @returns {number} */
function offsetFromRuntime(t, zone) {
  const f = formatter(zone);
  if (f === null) throw new TypeError("Cannot read properties of null (reading 'formatToParts')");
  const parts = f.formatToParts(new Date(t * 1000));
  /** @type {Map<string, string>} each part's value by its type, the last of a type kept */
  const v = new Map([]);
  for (const p of parts) v.set(p.type, p.value);
  let y = Number(v.get("year"));
  if (/^B/.test(v.get("era") || "")) y = 1 - y;
  const wall = dayNumber(y, Number(v.get("month")), Number(v.get("day"))) * DAY_S + (Number(v.get("hour")) % 24) * 3600 + Number(v.get("minute")) * 60 + Number(v.get("second"));
  return wall - t;
}

/* N565: offsets cached per zone, keyed by the UTC hour. An hour whose two ends read the same offset holds that offset
 * throughout (no zone changes its offset twice within an hour); an hour holding a transition keeps the transition's
 * second, found once by bisection, and the offsets either side. The cache only remembers what the runtime answered,
 * so every answer is the one `offsetFromRuntime` gives (R26: the same inputs, the same answer). Bounded per zone. */
const HOUR_S = 3600;
const CACHE_LIMIT = 200000;
/** @typedef {{ at: number, before: number, after: number }} Transition an hour holding a change: the second it changes, and the offsets either side */
/** @type {Map<string, Map<number, number | Transition>>} */
const hourCaches = new Map([]);

/** @param {number} h
 * @param {string} zone
 * @returns {number | Transition} */
function hourOf(h, zone) {
  const held = hourCaches.get(zone);
  /** @type {Map<number, number | Transition>} */
  const c = held || new Map([]);
  if (!held) hourCaches.set(zone, c);
  const cached = c.get(h);
  if (cached !== undefined) return cached;
  const t0 = h * HOUR_S, t1 = t0 + HOUR_S;
  const before = offsetFromRuntime(t0, zone), after = offsetFromRuntime(t1, zone);
  const e = before === after ? before : transitionIn(t0, t1, before, after, zone);
  if (c.size >= CACHE_LIMIT) c.clear();
  c.set(h, e);
  return e;
}

/** The second within `[t0, t1]` at which the offset leaves `before`, found by bisection.
 * @param {number} t0
 * @param {number} t1
 * @param {number} before
 * @param {number} after
 * @param {string} zone
 * @returns {Transition} */
function transitionIn(t0, t1, before, after, zone) {
  let lo = t0, hi = t1;                 /* the offset at lo is `before`; at hi it is not */
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (offsetFromRuntime(mid, zone) === before) lo = mid; else hi = mid;
  }
  return { at: hi, before, after };
}

/** The zone's offset from UTC, in seconds, at instant `t`. Outside the range the runtime can format, 0 (only an EDTF
 *  year far beyond any calendar reaches there, and its trace says so).
 * @param {number} t
 * @param {string} zone
 * @returns {number} */
export function offsetAt(t, zone) {
  if (Math.abs(t) > INTL_LIMIT_S - 2 * DAY_S) return 0;
  if (formatter(zone) === null) return offsetFromRuntime(t, zone);
  const e = hourOf(Math.floor(t / HOUR_S), zone);
  return typeof e === "number" ? e : t < e.at ? e.before : e.after;
}

/** The wall clock, as seconds counted as though UTC, that instant `t` shows in `zone`. */
/** @type {(t: number, zone: string) => number} */
export const wallOf = (t, zone) => t + offsetAt(t, zone);
/** The local day (a day number) on which `t` falls in `zone` (R1). */
/** @type {(t: number, zone: string) => number} */
export const localDayNumber = (t, zone) => Math.floor(wallOf(t, zone) / DAY_S);

/** Every instant at which `zone` shows the wall time `wall`: none in a spring gap, two in an autumn overlap.
 * @param {number} wall
 * @param {string} zone
 * @returns {number[]} */
export function wallToInstants(wall, zone) {
  const offs = new Set([offsetAt(wall - DAY_S, zone), offsetAt(wall, zone), offsetAt(wall + DAY_S, zone)]);
  /** @type {number[]} */
  const out = [];
  for (const o of offs) {
    const t = wall - o;
    if (wallOf(t, zone) === wall && !out.includes(t)) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

/** The first instant of local day `n` in `zone` (its midnight, or the end of a gap that swallows midnight).
 * @param {number} n
 * @param {string} zone
 * @returns {number} */
export function startOfDay(n, zone) {
  const wall = n * DAY_S;
  const c = wallToInstants(wall, zone);
  const first = c[0];
  if (first !== undefined) return first;
  let lo = wall - 20 * 3600, hi = wall + 20 * 3600;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDayNumber(mid, zone) >= n) hi = mid; else lo = mid;
  }
  return hi;
}

/** An instant in `record-grammar`'s form (`ISO_TS_RE`); years outside 0000–9999 in the expanded form.
 * @param {number} t
 * @returns {string} */
export function instantText(t) {
  const n = Math.floor(t / DAY_S), s = t - n * DAY_S;
  const { y, m, d } = civil(n);
  /** @type {(x: number) => string} */
  const p = (x) => String(x).padStart(2, "0");
  return `${yearText(y)}-${p(m)}-${p(d)}T${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}Z`;
}

/** An instant string (`ISO_TS_RE`) as seconds, else null.
 * @param {unknown} s
 * @returns {number | null} */
export function parseInstant(s) {
  if (typeof s !== "string" || !ISO_TS_RE.test(s)) return null;
  const y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
  const h = +s.slice(11, 13), mi = +s.slice(14, 16), se = +s.slice(17, 19);
  if (mo < 1 || mo > 12 || d < 1 || d > monthLength(y, mo)) return null;
  if (h > 23 || mi > 59 || se > 59) return null;
  return dayNumber(y, mo, d) * DAY_S + h * 3600 + mi * 60 + se;
}

/** The runtime's own description of its versions (`process.versions`), read as it comes, or null.
 * @returns {unknown} */
function versionsOfRuntime() {
  try {
    const p = globalThis.process;
    const pv = p && "versions" in p ? p.versions : null;
    return pv ? pv : null;
  } catch { return null; }
}

/** The runtime's tz and ICU versions, or `unknown` where it does not state them (R25). Read from the runtime's own
 *  description, never from a clock.
 * @returns {{ tz: string, icu: string }} */
export function runtimeVersions() {
  const v = versionsOfRuntime();
  const o = typeof v === "object" && v !== null ? v : null;
  const tz0 = o && "tz" in o ? o.tz : undefined, icu0 = o && "icu" in o ? o.icu : undefined;
  const tz = typeof tz0 === "string" ? tz0 : "";
  const icu = typeof icu0 === "string" ? icu0 : "";
  return { tz: tz || "unknown", icu: icu || "unknown" };
}
