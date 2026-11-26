/* civil-time: bounded recurrences (R20) and fiscal periods (R21). The RFC 5545 subset is FREQ (WEEKLY, MONTHLY,
 * YEARLY), INTERVAL, BYDAY (with an ordinal), BYMONTHDAY, BYSETPOS, EXDATE and UNTIL; any other part is refused by
 * name. Wall time is kept across daylight-saving changes. The expansion stops at 24 months after `from` or 500
 * instances, whichever comes first. */
import { parseDay, dayText, dayNumber, civil, monthLength, weekdayOf, addMonths, WEEKDAYS } from "./days.mjs";
import { wallToInstants, offsetAt, instantText, runtimeVersions } from "./zone.mjs";
import { spanOf, refuse, undetermined, zoneRefusal } from "./values.mjs";
import { missing } from "./calendar.mjs";
import { word } from "../setup-words/index.mjs";
import { reason } from "./reasons.mjs";
/** @import { Refusal, When, View, Undetermined, UndeterminedCode, Runtime } from "./kinds.mjs" */

/** @typedef {{ day: number, sec?: number, utc?: boolean }} Stamp an RFC 5545 date (`day`) or date-time (`sec` into the
 *  day, `utc` where written with Z) */
/** @typedef {{ n: number | null, day: string | undefined }} ByDay a BYDAY entry: its ordinal, if any, and weekday */
/**
 * @typedef {{ freq: string, interval: number, byday: ByDay[] | null, bymonthday: number[] | null,
 *   bysetpos: number[] | null, until: Stamp | null, exdates: Stamp[] }} Rrule a recurrence rule's parts, read
 */
/** @typedef {{ value: string, precision: string, zone: string, instant: string }} Instance one instance: a date-time in
 *  the zone, and its instant */
/**
 * @typedef {{ rrule: string, dtstart: When, zone: string, from: When, to: When,
 *   limits: { months: number, instances: number }, notes: string[], runtime: Runtime }} RecurrenceTrace
 */
/** @typedef {{ instances: Instance[], truncated: boolean, trace: RecurrenceTrace }} Expansion what `expandRecurrence`
 *  answers (R20, R25) */
/** @typedef {{ label: string, start: string, end: string }} FiscalPeriod a fiscal year: its label, first and last day */

/** @type {string[]} */
const SUBSET = ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYSETPOS", "EXDATE", "UNTIL"];
/** @type {string[]} */
const FREQS = ["WEEKLY", "MONTHLY", "YEARLY"];
const MAX_INSTANCES = 500;
const MAX_MONTHS = 24;
/** @type {Map<string, string>} RFC 5545's weekday names as `WEEKDAYS` names them */
const RRDAY = new Map([["SU", "sun"], ["MO", "mon"], ["TU", "tue"], ["WE", "wed"], ["TH", "thu"], ["FR", "fri"], ["SA", "sat"]]);

/** @type {(part: string) => Refusal} */
const unsupported = (part) => refuse("RRULE_UNSUPPORTED", `${part} is outside the RFC 5545 subset this module expands (${SUBSET.join(", ")})`);
/** @type {(why: string) => Refusal} */
const bad = (why) => refuse("DATE_INVALID", `the recurrence is malformed: ${why}`);

/** An RFC 5545 local or UTC date or date-time (`YYYYMMDD`, `YYYYMMDDTHHMMSS[Z]`) as `{day, sec?, utc?}`.
 * @param {string} s
 * @returns {Stamp | null} */
function readStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(s);
  if (!m) return null;
  const day = parseDay(`${m[1]}-${m[2]}-${m[3]}`);
  if (day === null) return null;
  if (m[4] === undefined) return { day };
  return { day, sec: Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6]), utc: !!m[7] };
}

/** The rule's parts, or a refusal naming the first part outside the subset.
 * @param {string} text
 * @returns {Rrule | Refusal}
 * @throws {TypeError} when `text` is not a string */
export function readRrule(text) {
  if (typeof text !== "string") throw new TypeError("an rrule is a string");
  /** @type {Map<string, string>} each part's value by its name */
  const parts = new Map([]);
  /** @type {string[]} */
  const exdates = [];
  for (const raw of text.split(/\r?\n|;(?=[A-Z]+[=:])/)) {
    let line = raw.trim();
    if (!line) continue;
    if (/^RRULE:/i.test(line)) line = line.slice(6);
    if (/^EXDATE[;:]/i.test(line)) { const v = line.replace(/^EXDATE(;[^:]*)?:/i, ""); exdates.push(...v.split(",")); continue; }
    for (const p of line.split(";")) {
      if (!p) continue;
      const eq = p.indexOf("=");
      if (eq < 1) return bad(`'${p}' is not NAME=VALUE`);
      const k = p.slice(0, eq).toUpperCase(), v = p.slice(eq + 1);
      if (!SUBSET.includes(k)) return unsupported(k);
      if (k === "EXDATE") { exdates.push(...v.split(",")); continue; }
      if (parts.get(k) !== undefined) return bad(`${k} is given twice`);
      parts.set(k, v);
    }
  }
  const freq = parts.get("FREQ"), intervalText = parts.get("INTERVAL"), bydayText = parts.get("BYDAY");
  const bymonthdayText = parts.get("BYMONTHDAY"), bysetposText = parts.get("BYSETPOS"), untilText = parts.get("UNTIL");
  if (!freq) return bad("FREQ is required");
  if (!FREQS.includes(freq)) return unsupported(`FREQ=${freq}`);
  const interval = intervalText === undefined ? 1 : Number(intervalText);
  if (!Number.isInteger(interval) || interval < 1) return bad("INTERVAL is not a positive whole number");
  /** @type {ByDay[] | null} */
  const byday = bydayText === undefined ? null : [];
  if (byday && bydayText !== undefined) {
    for (const d of bydayText.split(",")) {
      const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d);
      if (!m || (m[1] !== undefined && (Number(m[1]) === 0 || Math.abs(Number(m[1])) > 53))) return bad(`BYDAY '${d}'`);
      if (m[1] !== undefined && freq === "WEEKLY") return bad("an ordinal BYDAY with FREQ=WEEKLY");
      byday.push({ n: m[1] === undefined ? null : Number(m[1]), day: RRDAY.get(m[2] ?? "") });
    }
  }
  const bymonthday = bymonthdayText === undefined ? null : bymonthdayText.split(",").map(Number);
  if (bymonthday && !bymonthday.every((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 31)) return bad("BYMONTHDAY");
  const bysetpos = bysetposText === undefined ? null : bysetposText.split(",").map(Number);
  if (bysetpos && !bysetpos.every((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 366)) return bad("BYSETPOS");
  /** @type {Stamp | null} */
  let until = null;
  if (untilText !== undefined) { until = readStamp(untilText); if (!until) return bad("UNTIL"); }
  /** @type {Stamp[]} */
  const ex = [];
  for (const e of exdates) { const s = readStamp(e.trim()); if (!s) return bad(`EXDATE '${e}'`); ex.push(s); }
  return { freq, interval, byday, bymonthday, bysetpos, until, exdates: ex };
}

/** The days one period yields, sorted, before BYSETPOS.
 * @param {Rrule} r
 * @param {string} freq
 * @param {number} start
 * @param {number} dtDay
 * @returns {number[]} */
function periodDays(r, freq, start, dtDay) {
  const dc = civil(dtDay), dm = dc.m, dd = dc.d;
  const byday = r.byday, bymonthday = r.bymonthday, bysetpos = r.bysetpos;
  /** @type {(first: number, len: number, rules: ByDay[]) => number[]} the days of a month or year that BYDAY names */
  const daysNamed = (first, len, rules) => {
    /** @type {number[]} */
    const bd = [];
    for (const { n, day } of rules) {
      /** @type {number[]} */
      const all = [];
      for (let i = 0; i < len; i++) if (weekdayOf(first + i) === day) all.push(first + i);
      if (n === null) bd.push(...all); else { const x = n > 0 ? all[n - 1] : all[all.length + n]; if (x !== undefined) bd.push(x); }
    }
    return bd;
  };
  /** @type {(y: number, m: number) => number[]} */
  const monthDays = (y, m) => {
    const len = monthLength(y, m), first = dayNumber(y, m, 1);
    const byMonthDays = bymonthday ? bymonthday.map((k) => (k > 0 ? k : len + k + 1)).filter((k) => k >= 1 && k <= len).map((k) => first + k - 1) : null;
    const bd = byday ? daysNamed(first, len, byday) : null;
    const set = bd ? (byMonthDays ? byMonthDays.filter((x) => bd.includes(x)) : bd) : byMonthDays;
    return set ? set : dd <= len ? [first + dd - 1] : [];
  };
  /** @type {number[]} */
  let out;
  if (freq === "WEEKLY") {
    /** @type {number[]} */
    const days = [];
    for (let i = 0; i < 7; i++) days.push(start + i);
    /** @type {Set<string | undefined>} */
    const want = byday ? new Set(byday.map((b) => b.day)) : new Set([weekdayOf(dtDay)]);
    out = days.filter((n) => want.has(weekdayOf(n)));
    if (bymonthday) out = out.filter((n) => { const c = civil(n), len = monthLength(c.y, c.m); return bymonthday.some((k) => (k > 0 ? k : len + k + 1) === c.d); });
  } else if (freq === "MONTHLY") {
    const c = civil(start);
    out = monthDays(c.y, c.m);
  } else {
    const y = civil(start).y;
    if (!byday && !bymonthday) out = dm === 2 && dd === 29 && monthLength(y, 2) < 29 ? [] : [dayNumber(y, dm, dd)];
    else if (byday && !bymonthday && byday.some((b) => b.n !== null)) {
      const first = dayNumber(y, 1, 1), len = dayNumber(y + 1, 1, 1) - first;
      out = daysNamed(first, len, byday);
    } else { out = []; for (let m = 1; m <= 12; m++) out.push(...monthDays(y, m)); }
  }
  out = [...new Set(out)].sort((a, b) => a - b);
  if (bysetpos) {
    /** @type {number[]} */
    const pick = [];
    for (const k of bysetpos) { const x = k > 0 ? out[k - 1] : out[out.length + k]; if (x !== undefined) pick.push(x); }
    out = [...new Set(pick)].sort((a, b) => a - b);
  }
  return out;
}

/* The instant of wall time `sec` on day `n` in `zone`: the first occurrence when it is twice, the time after the gap
   when the clocks skip it (RFC 5545 §3.3.5). */
/** @param {number} n
 * @param {number} sec
 * @param {string} zone
 * @returns {{ t: number, shifted?: true }} */
function instantOn(n, sec, zone) {
  const wall = n * 86400 + sec;
  const c = wallToInstants(wall, zone);
  const first = c[0];
  if (first !== undefined) return { t: first };
  return { t: wall - offsetAt(wall - 86400, zone), shifted: true };
}

/** R20.
 * @param {{ rrule: string, dtstart: When, zone: string, from: When, to: When }} args
 * @returns {Expansion | Refusal | Undetermined}
 * @bound instances: at most 500, none later than 24 months after from; truncated is true where either limit stopped it
 * @throws {TypeError} when an argument is absent or of the wrong type */
export function expandRecurrence(args) {
  if (!args || typeof args !== "object") throw new TypeError("expandRecurrence takes {rrule, dtstart, zone, from, to}");
  const { rrule, dtstart, zone, from, to } = args;
  if (typeof rrule !== "string" || typeof zone !== "string" || dtstart === undefined || from === undefined || to === undefined)
    throw new TypeError("expandRecurrence needs rrule and zone (strings), dtstart, from and to");
  const zr = zoneRefusal(zone);
  if (zr) return zr;
  const r = readRrule(rrule);
  if ("refused" in r) return r;
  const ds = typeof dtstart === "string" ? spanOf(/T/.test(dtstart) && !/Z$/.test(dtstart)
    ? { value: dtstart, precision: dtstart.length > 16 ? "second" : "minute", zone } : dtstart.length === 10 ? { value: dtstart, precision: "day", zone } : dtstart) : spanOf(dtstart);
  if ("refused" in ds) return ds;
  const fs = spanOf(typeof from === "string" && from.length === 10 ? { value: from, precision: "day", zone } : from);
  const ts = spanOf(typeof to === "string" && to.length === 10 ? { value: to, precision: "day", zone } : to);
  if ("refused" in fs) return fs;
  if ("refused" in ts) return ts;
  const fsLo = fs.lo, tsHi = ts.hi;
  if (fsLo === null || tsHi === null) return undetermined(reason("civil-time.window_open_end"));
  const dsLo = ds.lo ?? 0;   /* an open EDTF start counts as 0 seconds, as the arithmetic on null always did */
  const wallStart = dsLo + offsetAt(dsLo, zone);
  const dtDay = Math.floor(wallStart / 86400), sec = ds.dt.precision === "day" ? 0 : wallStart - dtDay * 86400;
  const fromDay = Math.floor((fsLo + offsetAt(fsLo, zone)) / 86400);
  const limitDay = (() => { const m = addMonths(fromDay, MAX_MONTHS); return "day" in m ? m.day : m.candidates[1]; })();
  const limit = Math.min(tsHi, wallToInstants(limitDay * 86400, zone)[0] ?? (limitDay * 86400 - offsetAt(limitDay * 86400, zone)));
  const until = r.until, untilSec = until ? until.sec : undefined;
  const untilT = until ? (untilSec === undefined ? null : until.utc ? until.day * 86400 + untilSec : instantOn(until.day, untilSec, zone).t) : null;
  const untilDay = until ? until.day : null;
  /** @type {Set<number>} */
  const exT = new Set();
  /** @type {Set<number>} */
  const exDays = new Set();
  for (const e of r.exdates) {
    const esec = e.sec;
    if (esec === undefined) exDays.add(e.day);
    else exT.add(e.utc ? e.day * 86400 + esec : instantOn(e.day, esec, zone).t);
  }
  /* period starts: the week (from Monday), month or year holding dtstart, stepped by INTERVAL; skip ahead to `from` */
  const c0 = civil(dtDay);
  /** @type {(k: number) => number} */
  const periodStart = (k) => {
    if (r.freq === "WEEKLY") { const mon = dtDay - ((WEEKDAYS.indexOf(String(weekdayOf(dtDay))) + 6) % 7); return mon + 7 * k * r.interval; }
    if (r.freq === "MONTHLY") { const idx = c0.y * 12 + c0.m - 1 + k * r.interval; return dayNumber(Math.floor(idx / 12), (idx % 12 + 12) % 12 + 1, 1); }
    return dayNumber(c0.y + k * r.interval, 1, 1);
  };
  let k = 0;
  const span = r.freq === "WEEKLY" ? 7 * r.interval : r.freq === "MONTHLY" ? 28 * r.interval : 365 * r.interval;
  if (fromDay - dtDay > 2 * span) k = Math.max(0, Math.floor((fromDay - dtDay) / (r.freq === "WEEKLY" ? 7 * r.interval : r.freq === "MONTHLY" ? 31 * r.interval : 366 * r.interval)) - 1);
  /** @type {Instance[]} */
  const instances = [];
  /** @type {string[]} */
  const notes = [];
  let truncated = false;
  for (let guard = 0; guard < 100000; guard++, k++) {
    const p = periodStart(k);
    if (p * 86400 - 14 * 3600 >= limit) { truncated = limit < tsHi; break; }
    if (untilDay !== null && p > untilDay) break;
    let stop = false;
    for (const n of periodDays(r, r.freq, p, dtDay)) {
      if (n < dtDay) continue;
      const it = instantOn(n, sec, zone);
      if (it.t < dsLo) continue;
      if (untilT !== null ? it.t > untilT : untilDay !== null && n > untilDay) { stop = true; break; }
      if (it.t >= limit) { if (limit < tsHi) truncated = true; stop = true; break; }
      if (it.t < fsLo) continue;
      if (exDays.has(n) || exT.has(it.t)) { notes.push(`${dayText(n)} excluded (EXDATE)`); continue; }
      if (instances.length >= MAX_INSTANCES) { truncated = true; stop = true; break; }
      if (it.shifted) notes.push(word("civil-time.wall_time_occur", { n: String(dayText(n)), zone: String(zone) }));
      const w = it.t + offsetAt(it.t, zone), wn = Math.floor(w / 86400), ws = w - wn * 86400;
      /** @type {(x: number) => string} */
      const p2 = (x) => String(x).padStart(2, "0");
      instances.push({ value: ds.dt.precision === "day" ? dayText(wn) : `${dayText(wn)}T${p2(Math.floor(ws / 3600))}:${p2(Math.floor(ws / 60) % 60)}`,
                       precision: ds.dt.precision === "day" ? "day" : "minute", zone, instant: instantText(it.t) });
    }
    if (stop) break;
  }
  /** @type {RecurrenceTrace} */
  const trace = { rrule, dtstart, zone, from, to, limits: { months: MAX_MONTHS, instances: MAX_INSTANCES }, notes, runtime: runtimeVersions() };
  if (truncated) trace.notes.push(`stopped at ${instances.length >= MAX_INSTANCES ? `${MAX_INSTANCES} instances` : `${MAX_MONTHS} months after from`}`);
  return { instances, truncated, trace };
}

/* ---- fiscalPeriod (R21) ---- */

/** @param {number} y
 * @param {string} startText the fiscal year's first day, `MM-DD`
 * @param {{ named_by?: string, label?: string }} f
 * @returns {FiscalPeriod & { startN: number, endN: number }} */
function periodFor(y, startText, f) {
  const md = startText.split("-").map(Number), mm = Number(md[0]), dd = Number(md[1]);
  const start = dayNumber(y, mm, Math.min(dd, monthLength(y, mm)));
  const next = dayNumber(y + 1, mm, Math.min(dd, monthLength(y + 1, mm)));
  const endY = civil(next - 1).y;
  const named = f.named_by === "start" ? y : endY;
  const label = String(f.label || "FY{year}")
    .replace(/\{start\}/g, String(y)).replace(/\{end\}/g, String(endY))
    .replace(/\{start2\}/g, String(y).slice(-2)).replace(/\{end2\}/g, String(endY).slice(-2)).replace(/\{year\}/g, String(named));
  return { label, start: dayText(start), end: dayText(next - 1), startN: start, endN: next - 1 };
}

/** R21.
 * @param {{ date: When, body: string, view: View }} args
 * @returns {FiscalPeriod | UndeterminedCode | Undetermined<FiscalPeriod> | Refusal}
 * @throws {TypeError} when an argument is absent or of the wrong type */
export function fiscalPeriod(args) {
  if (!args || typeof args !== "object") throw new TypeError("fiscalPeriod takes {date, body, view}");
  const { date, body, view } = args;
  if (date === undefined || date === null || typeof body !== "string" || !view || typeof view !== "object")
    throw new TypeError("fiscalPeriod needs date, body (a string) and view");
  const fiscal = view.fiscal_year;
  const list = Array.isArray(fiscal) ? fiscal : [];
  const f = list.find((x) => x && x.body === body) || list.find((x) => x && x.body === "*");
  if (!f) {
    const m = missing(view, "fiscal_year", "fiscal_year", { body: String(body) });
    return { undetermined: true, code: m.code, why: m.why };
  }
  const startText = f.start;
  if (typeof startText !== "string" || !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(startText) || (f.named_by !== "start" && f.named_by !== "end"))
    return { undetermined: true, code: "FACT_INVALID", why: reason("civil-time.recurrence.fiscal_year_form", { body: String(body) }) };
  const s = typeof date === "string" && date.length === 10 ? spanOf({ value: date, precision: "day", zone: "UTC" }) : spanOf(date);
  if ("refused" in s) return s;
  const slo = s.lo, shi = s.hi;
  if (slo === null || shi === null) return undetermined(reason("civil-time.date_open_unknown"));
  const z = s.dt.zone;
  /* a day's span was read from a real day, so parseDay always answers; null would count as day 0, as civil(null) did */
  const lo = s.dt.precision === "day" ? parseDay(s.dt.value) ?? 0 : Math.floor((slo + offsetAt(slo, z)) / 86400);
  const hi = s.dt.precision === "day" ? lo : Math.floor((shi - 1 + offsetAt(shi - 1, z)) / 86400);
  /** @type {(n: number) => FiscalPeriod & { startN: number, endN: number }} */
  const yearOf = (n) => { const y = civil(n).y; const p = periodFor(y, startText, f); return n >= p.startN ? p : periodFor(y - 1, startText, f); };
  const a = yearOf(lo), b = yearOf(hi);
  /** @type {(p: FiscalPeriod) => FiscalPeriod} */
  const out = (p) => ({ label: p.label, start: p.start, end: p.end });
  if (a.startN !== b.startN) return undetermined(reason("civil-time.spans_two_fiscal", { value: String(s.dt.value), label: String(a.label), label_2: String(b.label) }), [out(a), out(b)]);
  return out(a);
}
