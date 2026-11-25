/* civil-time: bounded recurrences (R20) and fiscal periods (R21). The RFC 5545 subset is FREQ (WEEKLY, MONTHLY,
 * YEARLY), INTERVAL, BYDAY (with an ordinal), BYMONTHDAY, BYSETPOS, EXDATE and UNTIL; any other part is refused by
 * name. Wall time is kept across daylight-saving changes. The expansion stops at 24 months after `from` or 500
 * instances, whichever comes first. */
import { parseDay, dayText, dayNumber, civil, monthLength, weekdayOf, addMonths, WEEKDAYS } from "./days.mjs";
import { wallToInstants, offsetAt, instantText, runtimeVersions } from "./zone.mjs";
import { spanOf, isNo, refuse, undetermined, zoneRefusal } from "./values.mjs";
import { missing } from "./calendar.mjs";
import { word } from "../setup-words/index.mjs";
import { reason } from "./reasons.mjs";

const SUBSET = ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYSETPOS", "EXDATE", "UNTIL"];
const FREQS = ["WEEKLY", "MONTHLY", "YEARLY"];
const MAX_INSTANCES = 500;
const MAX_MONTHS = 24;
const RRDAY = { SU: "sun", MO: "mon", TU: "tue", WE: "wed", TH: "thu", FR: "fri", SA: "sat" };

const unsupported = (part) => refuse("RRULE_UNSUPPORTED", `${part} is outside the RFC 5545 subset this module expands (${SUBSET.join(", ")})`);
const bad = (why) => refuse("DATE_INVALID", `the recurrence is malformed: ${why}`);

/** An RFC 5545 local or UTC date or date-time (`YYYYMMDD`, `YYYYMMDDTHHMMSS[Z]`) as `{day, sec?, utc?}`. */
function readStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(s);
  if (!m) return null;
  const day = parseDay(`${m[1]}-${m[2]}-${m[3]}`);
  if (day === null) return null;
  if (m[4] === undefined) return { day };
  return { day, sec: +m[4] * 3600 + +m[5] * 60 + +m[6], utc: !!m[7] };
}

/** The rule's parts, or a refusal naming the first part outside the subset. */
export function readRrule(text) {
  if (typeof text !== "string") throw new TypeError("an rrule is a string");
  const parts = {};
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
      if (parts[k] !== undefined) return bad(`${k} is given twice`);
      parts[k] = v;
    }
  }
  if (!parts.FREQ) return bad("FREQ is required");
  if (!FREQS.includes(parts.FREQ)) return unsupported(`FREQ=${parts.FREQ}`);
  const interval = parts.INTERVAL === undefined ? 1 : Number(parts.INTERVAL);
  if (!Number.isInteger(interval) || interval < 1) return bad("INTERVAL is not a positive whole number");
  let byday = null;
  if (parts.BYDAY !== undefined) {
    byday = [];
    for (const d of parts.BYDAY.split(",")) {
      const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d);
      if (!m || (m[1] !== undefined && (Number(m[1]) === 0 || Math.abs(Number(m[1])) > 53))) return bad(`BYDAY '${d}'`);
      if (m[1] !== undefined && parts.FREQ === "WEEKLY") return bad("an ordinal BYDAY with FREQ=WEEKLY");
      byday.push({ n: m[1] === undefined ? null : Number(m[1]), day: RRDAY[m[2]] });
    }
  }
  let bymonthday = null;
  if (parts.BYMONTHDAY !== undefined) {
    bymonthday = parts.BYMONTHDAY.split(",").map(Number);
    if (!bymonthday.every((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 31)) return bad("BYMONTHDAY");
  }
  let bysetpos = null;
  if (parts.BYSETPOS !== undefined) {
    bysetpos = parts.BYSETPOS.split(",").map(Number);
    if (!bysetpos.every((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 366)) return bad("BYSETPOS");
  }
  let until = null;
  if (parts.UNTIL !== undefined) { until = readStamp(parts.UNTIL); if (!until) return bad("UNTIL"); }
  const ex = [];
  for (const e of exdates) { const s = readStamp(e.trim()); if (!s) return bad(`EXDATE '${e}'`); ex.push(s); }
  return { freq: parts.FREQ, interval, byday, bymonthday, bysetpos, until, exdates: ex };
}

/* The days one period yields, sorted, before BYSETPOS. */
function periodDays(r, freq, start, dtDay) {
  const { m: dm, d: dd } = civil(dtDay);
  const monthDays = (y, m) => {
    const len = monthLength(y, m), first = dayNumber(y, m, 1);
    let set = null;
    if (r.bymonthday) set = r.bymonthday.map((k) => (k > 0 ? k : len + k + 1)).filter((k) => k >= 1 && k <= len).map((k) => first + k - 1);
    if (r.byday) {
      const bd = [];
      for (const { n, day } of r.byday) {
        const all = [];
        for (let i = 0; i < len; i++) if (weekdayOf(first + i) === day) all.push(first + i);
        if (n === null) bd.push(...all); else { const x = n > 0 ? all[n - 1] : all[all.length + n]; if (x !== undefined) bd.push(x); }
      }
      set = set ? set.filter((x) => bd.includes(x)) : bd;
    }
    if (!set) set = dd <= len ? [first + dd - 1] : [];
    return set;
  };
  let out;
  if (freq === "WEEKLY") {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(start + i);
    const want = r.byday ? new Set(r.byday.map((b) => b.day)) : new Set([weekdayOf(dtDay)]);
    out = days.filter((n) => want.has(weekdayOf(n)));
    if (r.bymonthday) out = out.filter((n) => { const c = civil(n), len = monthLength(c.y, c.m); return r.bymonthday.some((k) => (k > 0 ? k : len + k + 1) === c.d); });
  } else if (freq === "MONTHLY") {
    const c = civil(start);
    out = monthDays(c.y, c.m);
  } else {
    const y = civil(start).y;
    if (!r.byday && !r.bymonthday) out = dm === 2 && dd === 29 && monthLength(y, 2) < 29 ? [] : [dayNumber(y, dm, dd)];
    else if (r.byday && !r.bymonthday && r.byday.some((b) => b.n !== null)) {
      const first = dayNumber(y, 1, 1), len = dayNumber(y + 1, 1, 1) - first;
      out = [];
      for (const { n, day } of r.byday) {
        const all = [];
        for (let i = 0; i < len; i++) if (weekdayOf(first + i) === day) all.push(first + i);
        if (n === null) out.push(...all); else { const x = n > 0 ? all[n - 1] : all[all.length + n]; if (x !== undefined) out.push(x); }
      }
    } else { out = []; for (let m = 1; m <= 12; m++) out.push(...monthDays(y, m)); }
  }
  out = [...new Set(out)].sort((a, b) => a - b);
  if (r.bysetpos) {
    const pick = [];
    for (const k of r.bysetpos) { const x = k > 0 ? out[k - 1] : out[out.length + k]; if (x !== undefined) pick.push(x); }
    out = [...new Set(pick)].sort((a, b) => a - b);
  }
  return out;
}

/* The instant of wall time `sec` on day `n` in `zone`: the first occurrence when it is twice, the time after the gap
   when the clocks skip it (RFC 5545 §3.3.5). */
function instantOn(n, sec, zone) {
  const wall = n * 86400 + sec;
  const c = wallToInstants(wall, zone);
  if (c.length) return { t: c[0] };
  return { t: wall - offsetAt(wall - 86400, zone), shifted: true };
}

/** R20. */
export function expandRecurrence(args) {
  if (!args || typeof args !== "object") throw new TypeError("expandRecurrence takes {rrule, dtstart, zone, from, to}");
  const { rrule, dtstart, zone, from, to } = args;
  if (typeof rrule !== "string" || typeof zone !== "string" || dtstart === undefined || from === undefined || to === undefined)
    throw new TypeError("expandRecurrence needs rrule and zone (strings), dtstart, from and to");
  const zr = zoneRefusal(zone);
  if (zr) return zr;
  const r = readRrule(rrule);
  if (r.refused) return r;
  const ds = typeof dtstart === "string" ? spanOf(/T/.test(dtstart) && !/Z$/.test(dtstart)
    ? { value: dtstart, precision: dtstart.length > 16 ? "second" : "minute", zone } : dtstart.length === 10 ? { value: dtstart, precision: "day", zone } : dtstart) : spanOf(dtstart);
  if (isNo(ds)) return ds;
  const fs = spanOf(typeof from === "string" && from.length === 10 ? { value: from, precision: "day", zone } : from);
  const ts = spanOf(typeof to === "string" && to.length === 10 ? { value: to, precision: "day", zone } : to);
  for (const s of [fs, ts]) if (isNo(s)) return s;
  if (fs.lo === null || ts.hi === null) return undetermined(reason("civil-time.window_open_end"));
  const wallStart = ds.lo + offsetAt(ds.lo, zone);
  const dtDay = Math.floor(wallStart / 86400), sec = ds.dt.precision === "day" ? 0 : wallStart - dtDay * 86400;
  const fromDay = Math.floor((fs.lo + offsetAt(fs.lo, zone)) / 86400);
  const limitDay = (() => { const m = addMonths(fromDay, MAX_MONTHS); return m.day ?? m.candidates[1]; })();
  const limit = Math.min(ts.hi, wallToInstants(limitDay * 86400, zone)[0] ?? (limitDay * 86400 - offsetAt(limitDay * 86400, zone)));
  const untilT = r.until ? (r.until.sec === undefined ? null : r.until.utc ? r.until.day * 86400 + r.until.sec : instantOn(r.until.day, r.until.sec, zone).t) : null;
  const untilDay = r.until ? r.until.day : null;
  const exT = new Set(), exDays = new Set();
  for (const e of r.exdates) {
    if (e.sec === undefined) exDays.add(e.day);
    else exT.add(e.utc ? e.day * 86400 + e.sec : instantOn(e.day, e.sec, zone).t);
  }
  /* period starts: the week (from Monday), month or year holding dtstart, stepped by INTERVAL; skip ahead to `from` */
  const c0 = civil(dtDay);
  const periodStart = (k) => {
    if (r.freq === "WEEKLY") { const mon = dtDay - ((WEEKDAYS.indexOf(weekdayOf(dtDay)) + 6) % 7); return mon + 7 * k * r.interval; }
    if (r.freq === "MONTHLY") { const idx = c0.y * 12 + c0.m - 1 + k * r.interval; return dayNumber(Math.floor(idx / 12), (idx % 12 + 12) % 12 + 1, 1); }
    return dayNumber(c0.y + k * r.interval, 1, 1);
  };
  let k = 0;
  const span = r.freq === "WEEKLY" ? 7 * r.interval : r.freq === "MONTHLY" ? 28 * r.interval : 365 * r.interval;
  if (fromDay - dtDay > 2 * span) k = Math.max(0, Math.floor((fromDay - dtDay) / (r.freq === "WEEKLY" ? 7 * r.interval : r.freq === "MONTHLY" ? 31 * r.interval : 366 * r.interval)) - 1);
  const instances = [];
  const notes = [];
  let truncated = false;
  for (let guard = 0; guard < 100000; guard++, k++) {
    const p = periodStart(k);
    if (p * 86400 - 14 * 3600 >= limit) { truncated = limit < ts.hi; break; }
    if (untilDay !== null && p > untilDay) break;
    let stop = false;
    for (const n of periodDays(r, r.freq, p, dtDay)) {
      if (n < dtDay) continue;
      const it = instantOn(n, sec, zone);
      if (it.t < ds.lo) continue;
      if (untilT !== null ? it.t > untilT : untilDay !== null && n > untilDay) { stop = true; break; }
      if (it.t >= limit) { if (limit < ts.hi) truncated = true; stop = true; break; }
      if (it.t < fs.lo) continue;
      if (exDays.has(n) || exT.has(it.t)) { notes.push(`${dayText(n)} excluded (EXDATE)`); continue; }
      if (instances.length >= MAX_INSTANCES) { truncated = true; stop = true; break; }
      if (it.shifted) notes.push(word("civil-time.wall_time_occur", { n: String(dayText(n)), zone: String(zone) }));
      const w = it.t + offsetAt(it.t, zone), wn = Math.floor(w / 86400), ws = w - wn * 86400;
      const p2 = (x) => String(x).padStart(2, "0");
      instances.push({ value: ds.dt.precision === "day" ? dayText(wn) : `${dayText(wn)}T${p2(Math.floor(ws / 3600))}:${p2(Math.floor(ws / 60) % 60)}`,
                       precision: ds.dt.precision === "day" ? "day" : "minute", zone, instant: instantText(it.t) });
    }
    if (stop) break;
  }
  const trace = { rrule, dtstart, zone, from, to, limits: { months: MAX_MONTHS, instances: MAX_INSTANCES }, notes, runtime: runtimeVersions() };
  if (truncated) trace.notes.push(`stopped at ${instances.length >= MAX_INSTANCES ? `${MAX_INSTANCES} instances` : `${MAX_MONTHS} months after from`}`);
  return { instances, truncated, trace };
}

/* ---- fiscalPeriod (R21) ---- */

function periodFor(y, f) {
  const [mm, dd] = f.start.split("-").map(Number);
  const start = dayNumber(y, mm, Math.min(dd, monthLength(y, mm)));
  const next = dayNumber(y + 1, mm, Math.min(dd, monthLength(y + 1, mm)));
  const endY = civil(next - 1).y;
  const named = f.named_by === "start" ? y : endY;
  const label = String(f.label || "FY{year}")
    .replace(/\{start\}/g, String(y)).replace(/\{end\}/g, String(endY))
    .replace(/\{start2\}/g, String(y).slice(-2)).replace(/\{end2\}/g, String(endY).slice(-2)).replace(/\{year\}/g, String(named));
  return { label, start: dayText(start), end: dayText(next - 1), startN: start, endN: next - 1 };
}

/** R21. */
export function fiscalPeriod(args) {
  if (!args || typeof args !== "object") throw new TypeError("fiscalPeriod takes {date, body, view}");
  const { date, body, view } = args;
  if (date === undefined || date === null || typeof body !== "string" || !view || typeof view !== "object")
    throw new TypeError("fiscalPeriod needs date, body (a string) and view");
  const list = Array.isArray(view.fiscal_year) ? view.fiscal_year : [];
  const f = list.find((x) => x && x.body === body) || list.find((x) => x && x.body === "*");
  if (!f) {
    const m = missing(view, "fiscal_year", "fiscal_year", { body: String(body) });
    return { undetermined: true, code: m.code, why: m.why };
  }
  if (typeof f.start !== "string" || !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(f.start) || (f.named_by !== "start" && f.named_by !== "end"))
    return { undetermined: true, code: "FACT_INVALID", why: reason("civil-time.recurrence.fiscal_year_form", { body: String(body) }) };
  const s = typeof date === "string" && date.length === 10 ? spanOf({ value: date, precision: "day", zone: "UTC" }) : spanOf(date);
  if (isNo(s)) return s;
  if (s.lo === null || s.hi === null) return undetermined(reason("civil-time.date_open_unknown"));
  const z = s.dt.zone;
  const lo = s.dt.precision === "day" ? parseDay(s.dt.value) : Math.floor((s.lo + offsetAt(s.lo, z)) / 86400);
  const hi = s.dt.precision === "day" ? lo : Math.floor((s.hi - 1 + offsetAt(s.hi - 1, z)) / 86400);
  const yearOf = (n) => { const y = civil(n).y; const p = periodFor(y, f); return n >= p.startN ? p : periodFor(y - 1, f); };
  const a = yearOf(lo), b = yearOf(hi);
  const out = (p) => ({ label: p.label, start: p.start, end: p.end });
  if (a.startN !== b.startN) return undetermined(reason("civil-time.spans_two_fiscal", { value: String(s.dt.value), label: String(a.label), label_2: String(b.label) }), [out(a), out(b)]);
  return out(a);
}
