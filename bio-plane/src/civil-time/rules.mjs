/* civil-time: time rules counted the law's way on a jurisdiction's calendar (R9–R19, R24, R25). A rule is a
 * `deadlines` entry of the view (`jurisdictions` R26); every closed day, weekend, closure list, office hour, channel
 * cutoff and receipt convention is read from the view, and each calendar entry's status from the caller's `factOf`.
 * "Now" is never read: `overdueOn` takes the caller's instant. */
import { parseDay, dayText, addMonths, weekdayOf, civil } from "./days.mjs";
import { instantText, wallOf, localDayNumber, startOfDay, wallToInstants, runtimeVersions, parseInstant } from "./zone.mjs";
import { spanOf, isNo, refuse, zoneRefusal } from "./values.mjs";
import { calendar, calendarStated, missing } from "./calendar.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { reason } from "./reasons.mjs";

const UNITS = ["days", "hours", "business_hours", "months", "years"];
const no = (code, why, extra) => ({ undetermined: true, code, why, ...(extra || {}) });
const ruleInvalid = (field, why) => no("RULE_INVALID", why, { field });
/* R30: a caller's own reason is passed on exactly as given when it is a key; a sentence of the caller's is a fill */
const passOn = (why, said, unsaid) => (why && typeof why === "object" && typeof why.key === "string" ? why : why ? reason(said, { why: String(why) }) : reason(unsaid));
const dayDt = (n, zone) => ({ value: dayText(n), precision: "day", zone });
const p2 = (n) => String(n).padStart(2, "0");
function minuteDt(t, zone) {
  const w = wallOf(t, zone), n = Math.floor(w / 86400), s = w - n * 86400;
  return { value: `${dayText(n)}T${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}`, precision: "minute", zone };
}

/** The view's time zone (`jurisdictions` R41), or null. */
const viewZone = (view) => (view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null);

/** A rule read into the shape the counter takes, or an undetermined RULE_INVALID naming the field (R16). */
export function readRule(rule) {
  if (!rule || typeof rule !== "object") throw new TypeError("a rule is a deadlines entry (an object)");
  let units = rule.units, amount = rule.amount;
  if (units === undefined && rule.days !== undefined) { units = "days"; amount = rule.days; }
  if (!UNITS.includes(units)) return ruleInvalid("units", reason("civil-time.rules.invalid_units", { units: String(units), allowed: UNITS.join(", ") }));
  if (!Number.isInteger(amount) || amount <= 0) return ruleInvalid("amount", reason("civil-time.rules.invalid_amount"));
  const direction = rule.direction === undefined ? "forward" : rule.direction;
  if (direction !== "forward" && direction !== "backward") return ruleInvalid("direction", reason("civil-time.rules.invalid_direction", { direction: String(direction) }));
  let count = rule.count;
  if (units === "days") {
    if (count === undefined) return ruleInvalid("count", reason("civil-time.rules.invalid_count_unstated"));
    if (count !== "calendar" && count !== "business") return ruleInvalid("count", reason("civil-time.rules.invalid_count", { count: String(count) }));
  } else if (count !== undefined) return ruleInvalid("count", reason("civil-time.rules.invalid_count_with_units", { units: String(units) }));
  if (rule.roll !== undefined && typeof rule.roll !== "boolean") return ruleInvalid("roll", reason("civil-time.rules.invalid_roll"));
  if (rule.closures !== undefined && typeof rule.closures !== "string") return ruleInvalid("closures", reason("civil-time.rules.invalid_closures"));
  if (rule.due_at !== undefined && rule.due_at !== "close_of_business" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(rule.due_at)))
    return ruleInvalid("due_at", reason("civil-time.rules.invalid_due_at"));
  if (rule.applies_on !== undefined && (!Array.isArray(rule.applies_on) || !rule.applies_on.every((d) => typeof d === "string" && d.length === 3)))
    return ruleInvalid("applies_on", reason("civil-time.rules.invalid_applies_on"));
  const ext = rule.extension;
  if (ext !== undefined && ext !== null) {
    if (typeof ext !== "object" || !Number.isInteger(ext.days) || ext.days <= 0) return ruleInvalid("extension", reason("civil-time.rules.invalid_extension_days"));
    if (ext.count !== undefined && ext.count !== "calendar" && ext.count !== "business") return ruleInvalid("extension", reason("civil-time.rules.invalid_extension_count", { count: String(ext.count) }));
  }
  return { units, amount, direction, count, roll: rule.roll === true, closures: rule.closures ?? null };
}

/** Days of the tolled spans, inclusive (R14). */
function tolledDays(tolled) {
  const set = new Map();
  if (tolled === undefined || tolled === null) return set;
  if (!Array.isArray(tolled)) throw new TypeError("tolled is a list of {from, to} days");
  for (const s of tolled) {
    const a = s && parseDay(s.from), b = s && parseDay(s.to);
    if (a === null || b === null || a === undefined || b === undefined || a > b) return null;
    for (let n = a; n <= b; n++) set.set(n, `${s.from}–${s.to}`);
  }
  return set;
}

/** Count `amount` days from day `n0` (excluded) in `dir` (+1/-1): every day when `business` is false, else the days not
 *  closed; tolled days never count. Each day passed over is traced (R25). */
function countDays(n0, amount, dir, business, cal, tolled, skipped) {
  let n = n0, k = 0;
  while (k < amount) {
    n += dir;
    if (tolled.has(n)) { skipped.push({ day: dayText(n), why: `tolled (${tolled.get(n)})` }); continue; }
    if (business) {
      const c = cal.closedOn(n);
      if (c.undetermined) return c;
      if (c.closed) { skipped.push({ day: dayText(n), why: c.why }); continue; }
    }
    k++;
  }
  return { day: n };
}

/** R10: from a closed last day to the next (forward) or previous (backward) day that is not closed. */
function rollDay(n, dir, cal, rolled) {
  let m = n;
  for (let guard = 0; guard < 400; guard++) {
    const c = cal.closedOn(m);
    if (c.undetermined) return c;
    if (!c.closed) break;
    rolled.push({ day: dayText(m), why: c.why });
    m += dir;
  }
  return { day: m };
}

function rollIfAsked(r, n, dir, cal, trace) {
  if (!r.roll) return { day: n };
  const rolled = [];
  const out = rollDay(n, dir, cal, rolled);
  if (out.undetermined) return out;
  if (rolled.length) trace.roll.push({ from: dayText(n), to: dayText(out.day), passed: rolled });
  return out;
}

/* The governing office's hours (`jurisdictions` R42): a counterparty by `role`, or a venue by its kind. */
function officeHours(view, office) {
  if (office === null || office === undefined) return null;
  if (typeof office === "string") {
    const c = (view.counterparties || []).find((x) => x && x.role === office);
    return c && c.hours ? c.hours : null;
  }
  if (office && office.venue) {
    const k = (view.action_kinds || []).find((x) => x && x.kind === office.venue);
    return k && k.venue && k.venue.hours ? k.venue.hours : null;
  }
  return null;
}

/* The venue of the action kind the rule applies to: its channel facts (`jurisdictions` R48). */
function venueOf(view, rule) {
  const k = (view.action_kinds || []).find((x) => x && x.kind === rule.applies_to);
  return k && k.venue ? k.venue : null;
}

/* R14: the due day at its time: `HH:MM`, or the close of business of the governing office's hours. */
function dueAtTime(rule, n, zone, view, office, trace) {
  if (rule.due_at === undefined) return dayDt(n, zone);
  let hhmm = rule.due_at;
  if (rule.due_at === "close_of_business") {
    const h = officeHours(view, office);
    const wd = weekdayOf(n);
    const spans = h && Array.isArray(h.weekly) ? h.weekly.filter((s) => s && s.day === wd) : [];
    if (!spans.length) {
      trace.notes.push(h ? `the close of business is undetermined: the office's hours list no opening on ${wd}`
        : "the close of business is undetermined: the jurisdiction view holds no hours for the governing office");
      return dayDt(n, zone);
    }
    hhmm = spans.map((s) => s.close).sort().pop();
    trace.notes.push(`due at the close of business, ${hhmm} (the office's hours)`);
  }
  const [hh, mm] = hhmm.split(":").map(Number);
  const c = wallToInstants(n * 86400 + hh * 3600 + mm * 60, zone);
  if (!c.length) return dayDt(n, zone);
  return { value: `${dayText(n)}T${hhmm}`, precision: "minute", zone };
}

/** The anchor's local days (R15): the first and last local day its span covers in the governing zone, after the
 *  channel's cutoff and the receipt convention. */
function anchorDays(anchor, zone, rule, view, cal, trace) {
  const s = spanOf(anchor);
  if (isNo(s)) return s;
  if (s.lo === null || s.hi === null) return no("ANCHOR_UNDETERMINED", reason("civil-time.rules.anchor_open_end", { value: String(s.dt.value) }));
  let first, last;
  if (s.dt.precision === "day") first = last = parseDay(s.dt.value);
  else { first = localDayNumber(s.lo, zone); last = localDayNumber(s.hi - 1, zone); }
  if (first !== last) trace.notes.push(`the anchor spans ${dayText(first)} to ${dayText(last)} at the precision held`);
  if (rule.starts === "received" && (s.dt.precision === "minute" || s.dt.precision === "second")) {
    const v = venueOf(view, rule);
    if (v && v.cutoff && typeof v.cutoff.time === "string") {
      const [h, m] = v.cutoff.time.split(":").map(Number);
      const wall = wallOf(s.lo, zone) - first * 86400;
      if (wall > h * 3600 + m * 60) {
        const r = rollDay(first + 1, 1, cal, []);
        if (r.undetermined) return r;
        trace.cutoff = { time: v.cutoff.time, citation: v.cutoff.citation ?? null, from: dayText(first), to: dayText(r.day) };
        first = last = r.day;
      }
    }
  }
  if (rule.starts === "received") {
    const v = venueOf(view, rule);
    if (v && v.receipt && v.receipt.rule === "next_business_day") {
      const out = [];
      for (const n of [first, last]) {
        const r = rollDay(n, 1, cal, []);
        if (r.undetermined) return r;
        out.push(r.day);
      }
      if (out[0] !== first || out[1] !== last)
        trace.receipt = { rule: "next_business_day", citation: v.receipt.citation ?? null, from: dayText(first), to: dayText(out[0]) };
      [first, last] = out;
    } else if (v && v.receipt && v.receipt.rule !== undefined) return ruleInvalid("venue receipt", reason("civil-time.rules.invalid_receipt", { rule: String(v.receipt.rule) }));
  }
  return { first, last, span: s };
}

/* A day rule's due day from anchor day `a` (exclusive), before any extension: `{unrolled, day}` or undetermined. */
function dueDay(r, a, cal, tolled, trace) {
  const dir = r.direction === "backward" ? -1 : 1;
  if (r.units === "days") {
    const c = countDays(a, r.amount, dir, r.count === "business", cal, tolled, trace.skipped);
    if (c.undetermined) return c;
    const rolled = rollIfAsked(r, c.day, dir, cal, trace);
    if (rolled.undetermined) return rolled;
    return { unrolled: c.day, day: rolled.day };
  }
  const months = (r.units === "years" ? 12 : 1) * r.amount * dir;
  const m = addMonths(a, months);
  const tollAfter = (n) => {
    let end = n, k = 0;
    for (const d of tolled.keys()) if ((dir > 0 && d > a && d <= end) || (dir < 0 && d < a && d >= end)) k++;
    for (let i = 0; i < k; i++) { end += dir; while (tolled.has(end)) end += dir; }
    if (k) trace.notes.push(`${k} tolled day${k === 1 ? "" : "s"} added to the period`);
    return end;
  };
  if (m.candidates) {
    trace.notes.push(localize("civil-time.rules.daytext_has_no_such_day", "{dayText} has no such day {v1}: both readings are kept (K1504 (4))", { dayText: String(dayText(a)), v1: String(r.units === "years" ? "in the target year's month" : "in the target month") }));
    const out = [];
    for (const c0 of m.candidates) {
      const c = tollAfter(c0);
      const rolled = rollIfAsked(r, c, dir, cal, trace);
      if (rolled.undetermined) return rolled;
      out.push({ unrolled: c, day: rolled.day });
    }
    return { candidates: out };
  }
  const n = tollAfter(m.day);
  const rolled = rollIfAsked(r, n, dir, cal, trace);
  if (rolled.undetermined) return rolled;
  return { unrolled: n, day: rolled.day };
}

/* R11: hours from the anchor's instant, all of them (`hours`) or only those on days not closed (`business_hours`). */
function countHours(r, t0, zone, cal, tolled, trace) {
  const dir = r.direction === "backward" ? -1 : 1;
  if (r.units === "hours" && !tolled.size) return { t: t0 + dir * r.amount * 3600 };
  let remaining = r.amount * 3600, t = t0;
  for (let guard = 0; remaining > 0 && guard < 100000; guard++) {
    const n = dir > 0 ? localDayNumber(t, zone) : localDayNumber(t - 1, zone);
    const edge = dir > 0 ? startOfDay(n + 1, zone) : startOfDay(n, zone);
    let closed = tolled.has(n) ? { closed: true, why: `tolled (${tolled.get(n)})` } : { closed: false };
    if (!closed.closed && r.units === "business_hours") {
      closed = cal.closedOn(n);
      if (closed.undetermined) return closed;
    }
    if (closed.closed) { trace.skipped.push({ day: dayText(n), why: closed.why }); t = edge; continue; }
    const avail = Math.abs(edge - t);
    if (avail >= remaining) { t += dir * remaining; remaining = 0; } else { remaining -= avail; t = edge; }
  }
  return { t };
}

/** The status checks of R16 that hold before any count: the rule's basis, a fact a rule needs withheld. */
function preconditions(rule, view) {
  if (rule.basis === "UNMEASURED") return no("UNMEASURED", reason("civil-time.rules.unmeasured"));
  if (rule.computation !== undefined) {
    const list = Array.isArray(view.computation) ? view.computation : [];
    const c = list.find((x) => x && x.key === rule.computation);
    if (!c) return missing(view, "computation", "computation", { computation: String(rule.computation) });
    if (c.rule !== "exclude_first_include_last") return ruleInvalid("computation", reason("civil-time.rules.invalid_computation", { rule: String(c.rule) }));
  }
  return null;
}

/** One evaluation of a read rule against one closure list: `{due, trace}`, an uncertain due, or undetermined. */
function evaluateOn(r, rule, anchor, view, office, tolled, factOf, list, zone) {
  const trace = { closures: list, skipped: [], roll: [], notes: [] };
  const cal = calendar({ view, list, office, factOf });
  const needsCal = r.units === "business_hours" || r.count === "business" || r.roll;
  if (needsCal && !(view.weekend && Array.isArray(view.weekend.days))) {
    return missing(view, "weekend", "weekend_counting");
  }
  if (r.units === "hours" || r.units === "business_hours") {
    const s = spanOf(anchor);
    if (isNo(s)) return s;
    if (s.dt.precision !== "minute" && s.dt.precision !== "second" && typeof anchor !== "string")
      return no("ANCHOR_UNDETERMINED", reason("civil-time.rules.anchor_hours_precision", { value: String(s.dt.value), precision: String(s.dt.precision) }));
    if (s.twice) trace.notes.push(`${s.dt.value} occurs twice in ${s.dt.zone}; counted from both`);
    const ends = s.twice ? [s.lo, s.hi - 60] : [s.lo];
    const out = [];
    for (const t0 of ends) {
      const h = countHours(r, t0, zone, cal, tolled, trace);
      if (h.undetermined) return h;
      out.push(minuteDt(h.t, zone));
    }
    trace.calendar = calendarStated(cal);
    return { due: out.length > 1 ? { candidates: out } : out[0], trace };
  }
  const a = anchorDays(anchor, zone, rule, view, cal, trace);
  if (a.refused || a.undetermined) return a;
  if (rule.applies_on !== undefined) {
    const wd = weekdayOf(a.first);
    if (a.first !== a.last || !rule.applies_on.includes(wd))
      return no("RULE_NOT_APPLICABLE", a.first === a.last ? reason("civil-time.rules.not_applicable_day", { days: rule.applies_on.join(" or "), weekday: wd })
        : reason("civil-time.rules.not_applicable_span", { days: rule.applies_on.join(" or ") }));
  }
  trace.anchor_day = a.first === a.last ? dayText(a.first) : [dayText(a.first), dayText(a.last)];
  const results = [];
  for (const n of a.first === a.last ? [a.first] : [a.first, a.last]) {
    const d = dueDay(r, n, cal, tolled, trace);
    if (d.undetermined) return d;
    if (d.candidates) results.push(...d.candidates); else results.push(d);
  }
  trace.calendar = calendarStated(cal);
  const days = results.map((x) => x.day).sort((x, y) => x - y);
  const due = days[0] === days[days.length - 1] ? dueAtTime(rule, days[0], zone, view, office, trace)
    : { candidates: [dueAtTime(rule, days[0], zone, view, office, trace), dueAtTime(rule, days[days.length - 1], zone, view, office, trace)] };
  return { due, trace, results, cal };
}

/* R12: the extension counted from the original due, as R9–R10 count; both readings, since the sources leave its start
   open (from day n before the roll or after it); where they agree, one date (K1504 (2)). */
function extend(r, rule, base, view, office, tolled, zone, trace) {
  const ext = rule.extension;
  const er = { ...r, units: "days", amount: ext.days, count: ext.count || r.count || "calendar" };
  const dir = r.direction === "backward" ? -1 : 1;
  const cal = base.cal;
  const starts = [];
  for (const x of base.results) starts.push(x.unrolled, x.day);
  const t = { skipped: [], roll: [], notes: [] };
  const days = [];
  for (const s of [...new Set(starts)]) {
    const c = countDays(s, er.amount, dir, er.count === "business", cal, tolled, t.skipped);
    if (c.undetermined) return c;
    const rolled = rollIfAsked(er, c.day, dir, cal, t);
    if (rolled.undetermined) return rolled;
    days.push(rolled.day);
  }
  days.sort((x, y) => x - y);
  const lo = days[0], hi = days[days.length - 1];
  if (lo !== hi)
    t.notes.push("the sources leave open whether the extension counts from the period's last day before or after its roll: both readings are kept (K1504 (2))");
  trace.extension = { days: ext.days, count: er.count, when: ext.when ?? null, citation: ext.citation ?? null, ...t };
  return lo === hi ? dueAtTime(rule, lo, zone, view, office, trace) : { candidates: [dayDt(lo, zone), dayDt(hi, zone)] };
}

/** R9–R17, R25. */
export function evaluateRule(args) {
  if (!args || typeof args !== "object") throw new TypeError("evaluateRule takes {rule, anchor, view, office?, tolled?, factOf?}");
  const { rule, anchor, view, office = null, tolled, factOf = null, practice = null } = args;
  if (!view || typeof view !== "object") throw new TypeError("evaluateRule needs the jurisdiction view");
  if (anchor === undefined || anchor === null) throw new TypeError("evaluateRule needs the anchor");
  if (factOf !== null && typeof factOf !== "function") throw new TypeError("factOf is a function");
  if (anchor && anchor.undetermined) return no("ANCHOR_UNDETERMINED", passOn(anchor.why, "civil-time.rules.anchor_undetermined", "civil-time.rules.anchor_undetermined_unsaid"));
  const r = readRule(rule);
  if (r.undetermined) return r;
  const pre = preconditions(rule, view);
  if (pre) return pre;
  const tolledSet = tolledDays(tolled);
  if (tolledSet === null) return refuse("DATE_INVALID", "a tolled span is not {from, to} calendar days in order");
  const anchorZone = typeof anchor === "string" ? "UTC" : anchor && anchor.zone;
  const zone = viewZone(view) || anchorZone;
  const zr = zoneRefusal(zone);
  if (zr) return zr;
  const head = { rule: rule.rule ?? null, applies_to: rule.applies_to ?? null, citation: rule.citation ?? null, status: rule.status ?? null,
                 basis: rule.basis ?? null, starts: rule.starts ?? null, units: r.units, amount: r.amount, count: r.count ?? null,
                 direction: r.direction, computation: rule.computation ?? null, anchor, zone,
                 zone_from: viewZone(view) ? "the view's time_zone" : word("civil-time.anchor_zone"), office,
                 tolled: Array.isArray(tolled) ? tolled : [], runtime: runtimeVersions() };
  const base = evaluateOn(r, rule, anchor, view, office, tolledSet, factOf, r.closures, zone);
  if (base.refused) return base;
  if (base.undetermined) return { ...base, trace: { ...head } };
  const trace = { ...head, ...base.trace };
  for (const e of base.trace.calendar ? base.trace.calendar.entries : []) {
    if (e.status === "unconfirmed" || e.status === "corrected") trace.notes.push(`calendar entry ${e.year}${e.list ? ` (${e.list})` : ""}: ${e.status}`);
    if (e.governs === "correction" && e.status !== "corrected") trace.notes.push(`calendar entry ${e.year}${e.list ? ` (${e.list})` : ""}: counted on its correction, now ${e.status}`);
  }
  const out = { due: base.due, trace };
  if (rule.extension && r.units !== "hours" && r.units !== "business_hours" && base.results) {
    const ex = extend(r, rule, base, view, office, tolledSet, zone, trace);
    if (ex.undetermined) trace.extension = { undetermined: true, code: ex.code, why: ex.why };
    else out.extension = { due: ex, when: rule.extension.when ?? null, citation: rule.extension.citation ?? null };
  }
  /* R10: a practice calendar (the rule's `observed`, or one the caller names) is answered beside the rule, never as it. */
  const practices = [];
  if (rule.observed && typeof rule.observed.closures === "string") practices.push({ list: rule.observed.closures, basis: rule.observed.basis ?? null, status: rule.observed.status ?? null });
  if (typeof practice === "string" && !practices.some((p) => p.list === practice)) practices.push({ list: practice, basis: null, status: null });
  if (practices.length && r.units !== "hours") {
    out.observed = practices.map((p) => {
      const o = evaluateOn({ ...r, closures: p.list }, rule, anchor, view, office, tolledSet, factOf, p.list, zone);
      const label = "observed practice";
      if (o.refused || o.undetermined) return { label, closures: p.list, undetermined: true, code: o.code ?? o.refused, why: o.why };
      return { label, closures: p.list, basis: p.basis, status: p.status, due: o.due, trace: { ...head, ...o.trace } };
    });
  }
  return out;
}

/* ---- due (R18) ---- */

const BASIS_KINDS = ["rule", "commitment", "dependency", "window"];

/** R18. */
export function due(args) {
  if (!args || typeof args !== "object") throw new TypeError("due takes {basis, ...}");
  const { basis } = args;
  if (typeof basis !== "string") throw new TypeError("due's basis is a string");
  if (!BASIS_KINDS.includes(basis)) return refuse("BASIS_UNKNOWN", `'${basis}' is not a basis kind (${BASIS_KINDS.join(", ")})`);
  if (basis === "rule") {
    const r = evaluateRule(args);
    if (r.refused || r.undetermined) return { ...r, basis_kind: "rule", law_set: true };
    return { ...r, basis_kind: "rule", law_set: true };
  }
  if (basis === "commitment" || basis === "window") {
    const date = args.date;
    if (date === undefined || date === null) throw new TypeError(`a ${basis} due needs its date`);
    const s = spanOf(date);
    if (isNo(s)) return { ...s, basis_kind: basis, law_set: false };
    const trace = { basis_kind: basis, date, ...(basis === "commitment" ? { citation: args.citation ?? null, says: word("civil-time.says.body_stated_date") } : { says: word("civil-time.says.group_date") }),
                    runtime: runtimeVersions() };
    return { due: date, basis_kind: basis, law_set: false, trace };
  }
  /* dependency: the date of the event it precedes, less its lead counted as R9 counts, so it moves with that event. */
  const { precedes, lead, why } = args;
  if (precedes === undefined || precedes === null || lead === undefined || lead === null) throw new TypeError("a dependency due needs precedes and lead");
  const l = typeof lead === "number" ? { amount: lead, count: "calendar" } : lead;
  if (typeof l !== "object") throw new TypeError("a dependency's lead is a number of days or {amount, count, units?}");
  const rule = { rule: "dependency", units: l.units || "days", amount: l.amount ?? l.days, count: (l.units || "days") === "days" ? (l.count || "calendar") : undefined,
                 direction: "backward", roll: l.roll === true, closures: l.closures, citation: why ?? null, starts: "act" };
  const view = args.view || {};
  const r = evaluateRule({ rule, anchor: precedes, view, office: args.office ?? null, factOf: args.factOf ?? null, tolled: args.tolled });
  if (r.refused || r.undetermined) return { ...r, basis_kind: "dependency", law_set: false };
  r.trace.basis_kind = "dependency";
  r.trace.precedes = precedes;
  r.trace.why = why ?? null;
  return { due: r.due, basis_kind: "dependency", law_set: false, trace: r.trace };
}

/* ---- overdueOn (R19) ---- */

/** R19. */
export function overdueOn(args) {
  if (!args || typeof args !== "object") throw new TypeError("overdueOn takes {due, at, side}");
  let { due: d, at, side } = args;
  if (d === undefined || d === null || typeof at !== "string" || typeof side !== "string") throw new TypeError("overdueOn needs due, at (an instant) and side");
  if (side !== "group" && side !== "body") return refuse("SIDE_UNKNOWN", `'${side}' is neither group nor body`);
  if (d && typeof d === "object" && "due" in d && !("value" in d)) d = d.due;
  if (d && (d.undetermined || d.refused)) return no(d.code || "DUE_UNDETERMINED", passOn(d.why, "civil-time.rules.due_undetermined", "civil-time.rules.due_undetermined_unsaid"));
  const t = parseInstant(at);
  if (t === null) return refuse("DATE_INVALID", `'${at}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  const past = (dt) => {
    const s = spanOf(dt);
    if (isNo(s)) return s;
    if (s.hi === null) return no("DUE_UNDETERMINED", reason("civil-time.rules.due_open_end", { value: String(s.dt.value) }));
    if (s.dt.precision === "day" || s.dt.precision === "edtf") {
      const z = s.dt.zone;
      const day = localDayNumber(t, z);
      const last = localDayNumber(s.hi - 1, z);
      return { over: day > last, day: dayText(day), zone: z };
    }
    return { over: t >= s.hi, instant: instantText(t) };
  };
  if (d.candidates) {
    const [e, l] = d.candidates;
    const pe = past(e), pl = past(l);
    for (const x of [pe, pl]) if (x.refused || x.undetermined) return x;
    if (side === "group") return pe.over ? "overdue" : "not_overdue";
    if (pl.over) return "overdue";
    if (!pe.over) return "not_overdue";
    return no("POSSIBLY_OVERDUE", pe.day !== undefined ? reason("civil-time.rules.possibly_overdue_day", { value: String(e.value), value_2: String(l.value), day: pe.day, zone: pe.zone })
      : reason("civil-time.rules.possibly_overdue_instant", { value: String(e.value), value_2: String(l.value), instant: pe.instant }));
  }
  const p = past(d);
  if (p.refused || p.undetermined) return p;
  return p.over ? "overdue" : "not_overdue";
}

/* ---- span (R24) ---- */

const SPAN_UNITS = ["days", "business days", "hours", "months", "years"];
function monthsBetween(a, b) {
  const x = civil(a), y = civil(b);
  let m = (y.y - x.y) * 12 + (y.m - x.m);
  if (m > 0 && y.d < x.d) m--;
  if (m < 0 && y.d > x.d) m++;
  return m;
}

/** R24. */
export function span(a, b, opts) {
  if (!opts || typeof opts !== "object" || typeof opts.unit !== "string") throw new TypeError("span takes (a, b, {unit, view?, office?})");
  if (a === undefined || a === null || b === undefined || b === null) throw new TypeError("span needs both date-times");
  const { unit, view = null, office = null, factOf = null } = opts;
  if (!SPAN_UNITS.includes(unit)) return refuse("UNIT_UNKNOWN", `'${unit}' is not one of ${SPAN_UNITS.join(", ")}`);
  const sa = spanOf(a), sb = spanOf(b);
  for (const s of [sa, sb]) if (isNo(s)) return s;
  for (const s of [sa, sb]) if (s.lo === null || s.hi === null) return no("OPEN_END", reason("civil-time.rules.span_open_end", { value: String(s.dt.value) }));
  const trace = { unit, a, b, runtime: runtimeVersions(), skipped: [], notes: [] };
  if (unit === "hours") {
    const pts = (s) => (s.dt.precision === "minute" ? [s.lo, s.twice ? s.hi - 60 : s.lo] : s.dt.precision === "second" ? [s.lo, s.twice ? s.hi - 1 : s.lo] : [s.lo, s.hi]);
    const [a0, a1] = pts(sa), [b0, b1] = pts(sb);
    const h = (x) => Math.trunc(x / 3600);
    return { min: h(b0 - a1), max: h(b1 - a0), trace };
  }
  const days = (s) => (s.dt.precision === "day" ? [parseDay(s.dt.value), parseDay(s.dt.value)] : [localDayNumber(s.lo, s.dt.zone), localDayNumber(s.hi - 1, s.dt.zone)]);
  const [a0, a1] = days(sa), [b0, b1] = days(sb);
  if (unit === "days") return { min: b0 - a1, max: b1 - a0, trace };
  if (unit === "months" || unit === "years") {
    const vals = [monthsBetween(a1, b0), monthsBetween(a0, b1), monthsBetween(a0, b0), monthsBetween(a1, b1)];
    const k = unit === "years" ? 12 : 1;
    return { min: Math.trunc(Math.min(...vals) / k), max: Math.trunc(Math.max(...vals) / k), trace };
  }
  if (!view || typeof view !== "object") return no("FACT_ABSENT", reason("civil-time.rules.span_needs_view"));
  if (!(view.weekend && Array.isArray(view.weekend.days))) return missing(view, "weekend", "weekend");
  const cal = calendar({ view, list: opts.closures ?? null, office, factOf });
  /* business days after x up to and including y (x excluded, as R9 counts); negative when y is before x */
  const between = (x, y) => {
    const dir = y >= x ? 1 : -1;
    let k = 0;
    for (let n = x + dir; dir > 0 ? n <= y : n >= y; n += dir) {
      const c = cal.closedOn(n);
      if (c.undetermined) return c;
      if (c.closed) trace.skipped.push({ day: dayText(n), why: c.why }); else k++;
    }
    return dir * k;
  };
  const lo = between(a1, b0);
  if (lo && lo.undetermined) return lo;
  const hi = a0 === a1 && b0 === b1 ? lo : between(a0, b1);
  if (hi && hi.undetermined) return hi;
  trace.calendar = calendarStated(cal);
  return { min: Math.min(lo, hi), max: Math.max(lo, hi), trace };
}
