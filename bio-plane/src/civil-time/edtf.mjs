/* civil-time: EDTF (ISO 8601-2) level 1, read as a band of days (R3, R4; K1464). Level 0 (dates, date-times,
 * intervals) is read too, since level 1 contains it. Every level-2 feature is refused by name; anything else is not
 * EDTF. A band's ends are day numbers; an open (`..`) or unknown (empty) interval end is null, never a date. */
import { dayNumber, monthLength, dayText } from "./days.mjs";

const refused = (refused, why) => ({ refused, why });
const invalid = (s, why) => refused("DATE_INVALID", `'${s}' is not an EDTF date: ${why}`);
const level2 = (feature) => refused("EDTF_UNSUPPORTED", `EDTF level 2 is not read here: ${feature}`);

/* Seasons 21–24, read at their widest across the two conventions in use for the northern hemisphere's meteorological
   seasons (winter is the December that opens it or the January and February that close it). */
const SEASONS = { 21: ["spring", 3, 1, 5, 31], 22: ["summer", 6, 1, 8, 31], 23: ["autumn", 9, 1, 11, 30] };

/* Level-2 features, recognised before the level-1 grammar is tried, so each is refused by name. */
function level2Feature(s) {
  if (/[[\]{}]/.test(s)) return "a set ([...] or {...})";
  if (/^-?Y-?\d+E\d+/.test(s) || /\dE\d/.test(s)) return "an exponential year (E)";
  if (/\dS\d/.test(s)) return "significant digits (S)";
  for (const p of s.split("/")) {
    if (/[?~%]/.test(p.slice(0, -1))) return "qualification of a single component";
    const g = /^-?\d{4}-(\d{2})[?~%]?$/.exec(p);
    if (g && +g[1] >= 25 && +g[1] <= 41) return `the sub-year grouping ${g[1]}`;
  }
  return null;
}

/** One date of level 0 or 1, with an optional whole-date qualifier: `{lo, hi, q}` (inclusive day numbers), or a
 *  refusal. */
function readDate(s, whole) {
  const q = { uncertain: false, approximate: false, unspecified: false, season: false };
  let t = s;
  const qm = /[?~%]$/.exec(t);
  if (qm) {
    t = t.slice(0, -1);
    if (qm[0] !== "~") q.uncertain = true;
    if (qm[0] !== "?") q.approximate = true;
  }
  let m = /^Y(-?)(\d+)$/.exec(t);
  if (m) {
    if (m[2].length <= 4) return invalid(whole, "a Y-prefixed year has more than four digits");
    const y = (m[1] ? -1 : 1) * Number(m[2]);
    if (!Number.isSafeInteger(y) || Math.abs(y) > 1e12) return invalid(whole, "the year is beyond any reckoning held here");
    return { lo: dayNumber(y, 1, 1), hi: dayNumber(y, 12, 31), q };
  }
  m = /^(-?)(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(t);
  if (m) {
    if (qm) return invalid(whole, "a date-time takes no qualifier");
    const y = (m[1] ? -1 : 1) * +m[2], mo = +m[3], d = +m[4];
    if (mo < 1 || mo > 12 || d < 1 || d > monthLength(y, mo) || +m[5] > 23 || +m[6] > 59 || +m[7] > 59) return invalid(whole, "no such date-time");
    const n = dayNumber(y, mo, d);
    return { lo: n, hi: n, q };
  }
  m = /^(-?)(\d{4}|\d{3}X|\d{2}XX)(?:-(\d{2}|XX)(?:-(\d{2}|XX))?)?$/.exec(t);
  if (!m) {
    if (/X/.test(t) && /^-?[\dX]{4}(-[\dX]{2}){0,2}$/.test(t)) return level2("unspecified digits in a position level 1 does not allow");
    return invalid(whole, "not a date of EDTF's forms");
  }
  const neg = !!m[1], ys = m[2], ms = m[3], ds = m[4];
  if (/X/.test(ys)) {
    if (ms !== undefined) return level2("unspecified year digits followed by a month");
    q.unspecified = true;
    const lo = Number(ys.replace(/X/g, "0")), hi = Number(ys.replace(/X/g, "9"));
    const a = neg ? -hi : lo, b = neg ? -lo : hi;
    return { lo: dayNumber(a, 1, 1), hi: dayNumber(b, 12, 31), q };
  }
  const y = (neg ? -1 : 1) * Number(ys);
  if (ms === undefined) return { lo: dayNumber(y, 1, 1), hi: dayNumber(y, 12, 31), q };
  if (ms === "XX") {
    if (ds !== undefined && ds !== "XX") return level2("an unspecified month with a specified day");
    q.unspecified = true;
    return { lo: dayNumber(y, 1, 1), hi: dayNumber(y, 12, 31), q };
  }
  const mo = Number(ms);
  if (mo >= 21 && mo <= 24) {
    if (ds !== undefined) return invalid(whole, "a season takes no day");
    q.season = true;
    if (mo === 24) return { lo: dayNumber(y, 1, 1), hi: dayNumber(y + 1, 2, monthLength(y + 1, 2)), q };
    const [, m1, d1, m2, d2] = SEASONS[mo];
    return { lo: dayNumber(y, m1, d1), hi: dayNumber(y, m2, d2), q };
  }
  if (mo >= 25 && mo <= 41) return level2(`the sub-year grouping ${ms}`);
  if (mo < 1 || mo > 12) return invalid(whole, `no month ${ms}`);
  if (ds === undefined) return { lo: dayNumber(y, mo, 1), hi: dayNumber(y, mo, monthLength(y, mo)), q };
  if (ds === "XX") { q.unspecified = true; return { lo: dayNumber(y, mo, 1), hi: dayNumber(y, mo, monthLength(y, mo)), q }; }
  const d = Number(ds);
  if (d < 1 || d > monthLength(y, mo)) return invalid(whole, `no day ${ds} in that month`);
  return { lo: dayNumber(y, mo, d), hi: dayNumber(y, mo, d), q };
}

/** The band as day numbers: `{lo, hi, start, end, qualifiers}` (`start`/`end` `known`, `open` or `unknown`; `lo`/`hi`
 *  null at an open or unknown end), or a refusal. */
export function readEdtf(s) {
  if (typeof s !== "string" || s === "" || /\s/.test(s)) return invalid(String(s), "empty or containing white space");
  const f = level2Feature(s);
  if (f) return level2(f);
  const parts = s.split("/");
  if (parts.length > 2) return invalid(s, "more than one '/'");
  if (parts.length === 1) {
    const r = readDate(s, s);
    if (r.refused) return r;
    return { lo: r.lo, hi: r.hi, start: "known", end: "known", qualifiers: { ...r.q, interval: false } };
  }
  const end = (p) => (p === ".." ? { kind: "open" } : p === "" ? { kind: "unknown" } : readDate(p, s));
  const a = end(parts[0]), b = end(parts[1]);
  if (a.refused) return a;
  if (b.refused) return b;
  if (a.kind && b.kind) return invalid(s, "an interval with neither end known");
  if (!a.kind && !b.kind && a.lo > b.hi) return invalid(s, "the interval's start is after its end");
  const q = { uncertain: false, approximate: false, unspecified: false, season: false, interval: true };
  for (const x of [a, b]) if (x.q) for (const k of ["uncertain", "approximate", "unspecified", "season"]) q[k] = q[k] || x.q[k];
  return { lo: a.kind ? null : a.lo, hi: b.kind ? null : b.hi, start: a.kind || "known", end: b.kind || "known", qualifiers: q };
}

/** R3, R4: `{earliest, latest, qualifiers}` (days; an open or unknown end null), or a refusal. */
export function parseEdtf(s) {
  if (typeof s !== "string") throw new TypeError("parseEdtf takes a string");
  const r = readEdtf(s);
  if (r.refused) return r;
  return { earliest: r.lo === null ? null : dayText(r.lo), latest: r.hi === null ? null : dayText(r.hi),
           qualifiers: { ...r.qualifiers, start: r.start, end: r.end } };
}
