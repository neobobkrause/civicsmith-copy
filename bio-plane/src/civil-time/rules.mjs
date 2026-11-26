/* civil-time: time rules counted the law's way on a jurisdiction's calendar (R9–R19, R24, R25). A rule is a
 * `deadlines` entry of the view (`jurisdictions` R26); every closed day, weekend, closure list, office hour, channel
 * cutoff and receipt convention is read from the view, and each calendar entry's status from the caller's `factOf`.
 * "Now" is never read: `overdueOn` takes the caller's instant. */
import { parseDay, dayText, addMonths, weekdayOf, civil } from "./days.mjs";
import { instantText, wallOf, localDayNumber, startOfDay, wallToInstants, runtimeVersions, parseInstant } from "./zone.mjs";
import { spanOf, refuse, zoneRefusal } from "./values.mjs";
import { calendar, calendarStated, missing } from "./calendar.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { reason } from "./reasons.mjs";
/** @import { Reason, Refusal, DateTime, When, Unsettled, UndeterminedCode, View, Rule, Extension, Office, Hours, Venue, Tolled, FactOf, Skipped, Roll, Due, RuleTrace, RuleDue, RuleUndetermined, ObservedDue, ObservedOpen, BasisOf, StatedDue, StatedTrace, SpanAnswer, SpanTrace } from "./kinds.mjs" */
/** @import { Calendar, Closed } from "./calendar.mjs" */
/** @import { Span, DateTimeIn } from "./values.mjs" */

/** @typedef {{ units: string, amount: number, direction: string, count: string | undefined, roll: boolean,
 *  closures: string | null }} ReadRule a rule read into the shape the counter takes */
/** @typedef {RuleTrace & { skipped: Skipped[], roll: Roll[], notes: string[] }} WorkTrace a trace while it is written */
/** @typedef {{ unrolled: number, day: number }} DayResult a due day before and after its roll */
/** @typedef {{ due: Due, trace: WorkTrace }} HoursDue */
/** @typedef {{ due: Due, trace: WorkTrace, results: DayResult[], cal: Calendar }} DaysDue */
/** @typedef {{ amount?: number, days?: number, count?: string, units?: string, roll?: boolean, closures?: string }} Lead
 *  a dependency's lead: days, or a count of `units` (R18) */
/**
 * @typedef {{ rule?: Rule, anchor: When | Unsettled, view: View, office?: Office | null, tolled?: Tolled[] | null | undefined,
 *   factOf?: FactOf | null, practice?: string | null }} EvaluateArgs what `evaluateRule` takes: `anchor` the date-time of
 *   the event the rule starts from, `office` the office whose calendar governs, `tolled` the days the count is suspended,
 *   `factOf` the caller's reader of a calendar entry's status, `practice` a practice calendar to answer beside the rule
 */
/**
 * @typedef {{ basis: string, rule?: Rule, anchor?: When | Unsettled | null, view?: View | null, office?: Office | null,
 *   tolled?: Tolled[] | null | undefined, factOf?: FactOf | null, practice?: string | null, date?: When | null,
 *   citation?: string | null, precedes?: When | Unsettled | null, lead?: number | Lead | null, why?: string | null }} DueArgs
 *   what `due` takes: `basis` one of rule, commitment, dependency or window, with that kind's parts (R18)
 */
/** @typedef {When | { candidates: readonly When[] }} DueValue a due as `evaluateRule` or `due` answers it, or a caller's own */
/** @typedef {{ over: boolean, day: string, zone: string } | { over: boolean, instant: string }} Past */

/** @type {string[]} */
const UNITS = ["days", "hours", "business_hours", "months", "years"];
/** @param {string} code
 * @param {Reason} why
 * @param {{ field: string }} [extra]
 * @returns {UndeterminedCode} */
function no(code, why, extra) {
  /** @type {UndeterminedCode} */
  const out = { undetermined: true, code, why };
  if (extra) out.field = extra.field;
  return out;
}
/** @type {(field: string, why: Reason) => UndeterminedCode} */
const ruleInvalid = (field, why) => no("RULE_INVALID", why, { field });
/* R30: a caller's own reason is passed on exactly as given when it is a key; a sentence of the caller's is a fill */
/** @type {(why: Reason | string | null | undefined, said: string, unsaid: string) => Reason} */
const passOn = (why, said, unsaid) => (why && typeof why === "object" && typeof why.key === "string" ? why : why ? reason(said, { why: String(why) }) : reason(unsaid));
/** @type {(n: number, zone: string) => DateTime} */
const dayDt = (n, zone) => ({ value: dayText(n), precision: "day", zone });
/** @type {(n: number) => string} */
const p2 = (n) => String(n).padStart(2, "0");
/** @param {number} t
 * @param {string} zone
 * @returns {DateTime} */
function minuteDt(t, zone) {
  const w = wallOf(t, zone), n = Math.floor(w / 86400), s = w - n * 86400;
  return { value: `${dayText(n)}T${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}`, precision: "minute", zone };
}

/** The view's time zone (`jurisdictions` R41), or null.
 * @type {(view: View) => string | null} */
const viewZone = (view) => {
  const tz = view ? view.time_zone : undefined, value = tz ? tz.value : undefined;
  return typeof value === "string" ? value : null;
};

/** A rule read into the shape the counter takes, or an undetermined RULE_INVALID naming the field (R16).
 * @param {Rule | null | undefined} entry
 * @returns {ReadRule | UndeterminedCode}
 * @throws {TypeError} when `entry` is not an object */
export function readRule(entry) {
  const e = entry;
  if (!e || typeof e !== "object") throw new TypeError("a rule is a deadlines entry (an object)");
  const days = e.days, byDays = e.units === undefined && days !== undefined;
  const units = byDays ? "days" : e.units, amount = byDays ? days : e.amount;
  if (units === undefined || !UNITS.includes(units)) return ruleInvalid("units", reason("civil-time.rules.invalid_units", { units: String(units), allowed: UNITS.join(", ") }));
  if (amount === undefined || !Number.isInteger(amount) || amount <= 0) return ruleInvalid("amount", reason("civil-time.rules.invalid_amount"));
  const stated = e.direction;
  const direction = stated === undefined ? "forward" : stated;
  if (direction !== "forward" && direction !== "backward") return ruleInvalid("direction", reason("civil-time.rules.invalid_direction", { direction: String(direction) }));
  const count = e.count;
  if (units === "days") {
    if (count === undefined) return ruleInvalid("count", reason("civil-time.rules.invalid_count_unstated"));
    if (count !== "calendar" && count !== "business") return ruleInvalid("count", reason("civil-time.rules.invalid_count", { count: String(count) }));
  } else if (count !== undefined) return ruleInvalid("count", reason("civil-time.rules.invalid_count_with_units", { units: String(units) }));
  const roll = e.roll, closures = e.closures, dueAt = e.due_at, appliesOn = e.applies_on;
  if (roll !== undefined && typeof roll !== "boolean") return ruleInvalid("roll", reason("civil-time.rules.invalid_roll"));
  if (closures !== undefined && typeof closures !== "string") return ruleInvalid("closures", reason("civil-time.rules.invalid_closures"));
  if (dueAt !== undefined && dueAt !== "close_of_business" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(dueAt)))
    return ruleInvalid("due_at", reason("civil-time.rules.invalid_due_at"));
  if (appliesOn !== undefined && (!Array.isArray(appliesOn) || !appliesOn.every((d) => typeof d === "string" && d.length === 3)))
    return ruleInvalid("applies_on", reason("civil-time.rules.invalid_applies_on"));
  const ext = e.extension;
  if (ext !== undefined && ext !== null) {
    const extDays = ext.days, extCount = ext.count;
    if (typeof ext !== "object" || !Number.isInteger(extDays) || extDays <= 0) return ruleInvalid("extension", reason("civil-time.rules.invalid_extension_days"));
    if (extCount !== undefined && extCount !== "calendar" && extCount !== "business") return ruleInvalid("extension", reason("civil-time.rules.invalid_extension_count", { count: String(extCount) }));
  }
  return { units, amount, direction, count, roll: roll === true, closures: closures ?? null };
}

/** Days of the tolled spans, inclusive (R14).
 * @param {Tolled[] | null | undefined} tolled
 * @returns {Map<number, string> | null}
 * @throws {TypeError} when `tolled` is not a list */
function tolledDays(tolled) {
  /** @type {Map<number, string>} */
  const set = new Map([]);
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
 *  closed; tolled days never count. Each day passed over is traced (R25).
 * @param {number} n0
 * @param {number} amount
 * @param {number} dir
 * @param {boolean} business
 * @param {Calendar} cal
 * @param {Map<number, string>} tolled
 * @param {Skipped[]} skipped
 * @returns {{ day: number } | UndeterminedCode} */
function countDays(n0, amount, dir, business, cal, tolled, skipped) {
  let n = n0, k = 0;
  while (k < amount) {
    n += dir;
    if (tolled.has(n)) { skipped.push({ day: dayText(n), why: `tolled (${tolled.get(n)})` }); continue; }
    if (business) {
      const c = cal.closedOn(n);
      if ("undetermined" in c) return c;
      if (c.closed) { skipped.push({ day: dayText(n), why: c.why }); continue; }
    }
    k++;
  }
  return { day: n };
}

/** R10: from a closed last day to the next (forward) or previous (backward) day that is not closed.
 * @param {number} n
 * @param {number} dir
 * @param {Calendar} cal
 * @param {Skipped[]} rolled
 * @returns {{ day: number } | UndeterminedCode} */
function rollDay(n, dir, cal, rolled) {
  let m = n;
  for (let guard = 0; guard < 400; guard++) {
    const c = cal.closedOn(m);
    if ("undetermined" in c) return c;
    if (!c.closed) break;
    rolled.push({ day: dayText(m), why: c.why });
    m += dir;
  }
  return { day: m };
}

/** @param {{ roll: boolean }} r
 * @param {number} n
 * @param {number} dir
 * @param {Calendar} cal
 * @param {{ roll: Roll[] }} trace
 * @returns {{ day: number } | UndeterminedCode} */
function rollIfAsked(r, n, dir, cal, trace) {
  if (!r.roll) return { day: n };
  /** @type {Skipped[]} */
  const rolled = [];
  const out = rollDay(n, dir, cal, rolled);
  if ("undetermined" in out) return out;
  if (rolled.length) trace.roll.push({ from: dayText(n), to: dayText(out.day), passed: rolled });
  return out;
}

/** The governing office's hours (`jurisdictions` R42): a counterparty by `role`, or a venue by its kind.
 * @param {View} view
 * @param {Office | null} office
 * @returns {Hours | null} */
function officeHours(view, office) {
  if (office === null || office === undefined) return null;
  if (typeof office === "string") {
    const c = (view.counterparties || []).find((x) => x && x.role === office);
    const hours = c ? c.hours : undefined;
    return hours ? hours : null;
  }
  if (office && office.venue) {
    const k = (view.action_kinds || []).find((x) => x && x.kind === office.venue);
    const venue = k ? k.venue : undefined, hours = venue ? venue.hours : undefined;
    return hours ? hours : null;
  }
  return null;
}

/** The venue of the action kind the rule applies to: its channel facts (`jurisdictions` R48).
 * @param {View} view
 * @param {Rule} rule
 * @returns {Venue | null} */
function venueOf(view, rule) {
  const k = (view.action_kinds || []).find((x) => x && x.kind === rule.applies_to);
  const venue = k ? k.venue : undefined;
  return venue ? venue : null;
}

/** R14: the due day at its time: `HH:MM`, or the close of business of the governing office's hours.
 * @param {Rule} rule
 * @param {number} n
 * @param {string} zone
 * @param {View} view
 * @param {Office | null} office
 * @param {WorkTrace} trace
 * @returns {DateTime} */
function dueAtTime(rule, n, zone, view, office, trace) {
  const dueAt = rule.due_at;
  if (dueAt === undefined) return dayDt(n, zone);
  const at = dueAt === "close_of_business" ? closeOfBusiness(view, office, n, trace) : { time: dueAt };
  if (!at) return dayDt(n, zone);
  const hhmm = at.time;
  if (hhmm === undefined) throw new TypeError("Cannot read properties of undefined (reading 'split')");
  const hm = hhmm.split(":").map(Number), hh = Number(hm[0]), mm = Number(hm[1]);
  const c = wallToInstants(n * 86400 + hh * 3600 + mm * 60, zone);
  if (!c.length) return dayDt(n, zone);
  return { value: `${dayText(n)}T${hhmm}`, precision: "minute", zone };
}

/** R14: the close of the governing office's hours on day `n`, traced; null, traced, where its hours hold no opening.
 * @param {View} view
 * @param {Office | null} office
 * @param {number} n
 * @param {WorkTrace} trace
 * @returns {{ time: string | undefined } | null} */
function closeOfBusiness(view, office, n, trace) {
  const h = officeHours(view, office);
  const wd = weekdayOf(n);
  const weekly = h ? h.weekly : undefined;
  const spans = Array.isArray(weekly) ? weekly.filter((s) => s && s.day === wd) : [];
  if (!spans.length) {
    trace.notes.push(h ? `the close of business is undetermined: the office's hours list no opening on ${wd}`
      : "the close of business is undetermined: the jurisdiction view holds no hours for the governing office");
    return null;
  }
  const time = spans.map((s) => s.close).sort().pop();
  trace.notes.push(`due at the close of business, ${time} (the office's hours)`);
  return { time };
}

/** The anchor's local days (R15): the first and last local day its span covers in the governing zone, after the
 *  channel's cutoff and the receipt convention.
 * @param {When} anchor
 * @param {string} zone
 * @param {Rule} rule
 * @param {View} view
 * @param {Calendar} cal
 * @param {WorkTrace} trace
 * @returns {{ first: number, last: number, span: Span } | Refusal | UndeterminedCode} */
function anchorDays(anchor, zone, rule, view, cal, trace) {
  const s = spanOf(anchor);
  if ("refused" in s) return s;
  const slo = s.lo, shi = s.hi;
  if (slo === null || shi === null) return no("ANCHOR_UNDETERMINED", reason("civil-time.rules.anchor_open_end", { value: String(s.dt.value) }));
  /* a day's span was read from a real day, so parseDay always answers; null would count as day 0 in every sum */
  let first = s.dt.precision === "day" ? parseDay(s.dt.value) ?? 0 : localDayNumber(slo, zone);
  let last = s.dt.precision === "day" ? first : localDayNumber(shi - 1, zone);
  if (first !== last) trace.notes.push(`the anchor spans ${dayText(first)} to ${dayText(last)} at the precision held`);
  if (rule.starts === "received" && (s.dt.precision === "minute" || s.dt.precision === "second")) {
    const v = venueOf(view, rule);
    const cutoff = v ? v.cutoff : undefined, cutTime = cutoff ? cutoff.time : undefined;
    if (cutoff && typeof cutTime === "string") {
      const hm = cutTime.split(":").map(Number), h = Number(hm[0]), m = Number(hm[1]);
      const wall = wallOf(slo, zone) - first * 86400;
      if (wall > h * 3600 + m * 60) {
        const r = rollDay(first + 1, 1, cal, scratch());
        if ("undetermined" in r) return r;
        trace.cutoff = { time: cutTime, citation: cutoff.citation ?? null, from: dayText(first), to: dayText(r.day) };
        first = last = r.day;
      }
    }
  }
  if (rule.starts === "received") {
    const v = venueOf(view, rule);
    const receipt = v ? v.receipt : undefined, receiptRule = receipt ? receipt.rule : undefined;
    if (receipt && receiptRule === "next_business_day") {
      const r0 = rollDay(first, 1, cal, scratch());
      if ("undetermined" in r0) return r0;
      const r1 = rollDay(last, 1, cal, scratch());
      if ("undetermined" in r1) return r1;
      if (r0.day !== first || r1.day !== last)
        trace.receipt = { rule: "next_business_day", citation: receipt.citation ?? null, from: dayText(first), to: dayText(r0.day) };
      first = r0.day;
      last = r1.day;
    } else if (receipt && receiptRule !== undefined) return ruleInvalid("venue receipt", reason("civil-time.rules.invalid_receipt", { rule: String(receiptRule) }));
  }
  return { first, last, span: s };
}

/** A fresh list for days passed over that no trace keeps.
 * @returns {Skipped[]} */
function scratch() {
  /** @type {Skipped[]} */
  const none = [];
  return none;
}

/** A day rule's due day from anchor day `a` (exclusive), before any extension: `{unrolled, day}` or undetermined.
 * @param {ReadRule} r
 * @param {number} a
 * @param {Calendar} cal
 * @param {Map<number, string>} tolled
 * @param {WorkTrace} trace
 * @returns {DayResult | { candidates: DayResult[] } | UndeterminedCode} */
function dueDay(r, a, cal, tolled, trace) {
  const dir = r.direction === "backward" ? -1 : 1;
  if (r.units === "days") {
    const c = countDays(a, r.amount, dir, r.count === "business", cal, tolled, trace.skipped);
    if ("undetermined" in c) return c;
    const rolled = rollIfAsked(r, c.day, dir, cal, trace);
    if ("undetermined" in rolled) return rolled;
    return { unrolled: c.day, day: rolled.day };
  }
  const months = (r.units === "years" ? 12 : 1) * r.amount * dir;
  const m = addMonths(a, months);
  /** @type {(n: number) => number} */
  const tollAfter = (n) => {
    let end = n, k = 0;
    for (const d of tolled.keys()) if ((dir > 0 && d > a && d <= end) || (dir < 0 && d < a && d >= end)) k++;
    for (let i = 0; i < k; i++) { end += dir; while (tolled.has(end)) end += dir; }
    if (k) trace.notes.push(`${k} tolled day${k === 1 ? "" : "s"} added to the period`);
    return end;
  };
  if ("candidates" in m) {
    trace.notes.push(localize("civil-time.rules.daytext_has_no_such_day", "{dayText} has no such day {v1}: both readings are kept (K1504 (4))", { dayText: String(dayText(a)), v1: String(r.units === "years" ? "in the target year's month" : "in the target month") }));
    /** @type {DayResult[]} */
    const out = [];
    for (const c0 of m.candidates) {
      const c = tollAfter(c0);
      const rolled = rollIfAsked(r, c, dir, cal, trace);
      if ("undetermined" in rolled) return rolled;
      out.push({ unrolled: c, day: rolled.day });
    }
    return { candidates: out };
  }
  const n = tollAfter(m.day);
  const rolled = rollIfAsked(r, n, dir, cal, trace);
  if ("undetermined" in rolled) return rolled;
  return { unrolled: n, day: rolled.day };
}

/** R11: hours from the anchor's instant, all of them (`hours`) or only those on days not closed (`business_hours`).
 * @param {ReadRule} r
 * @param {number} t0
 * @param {string} zone
 * @param {Calendar} cal
 * @param {Map<number, string>} tolled
 * @param {WorkTrace} trace
 * @returns {{ t: number } | UndeterminedCode} */
function countHours(r, t0, zone, cal, tolled, trace) {
  const dir = r.direction === "backward" ? -1 : 1;
  if (r.units === "hours" && !tolled.size) return { t: t0 + dir * r.amount * 3600 };
  let remaining = r.amount * 3600, t = t0;
  for (let guard = 0; remaining > 0 && guard < 100000; guard++) {
    const n = dir > 0 ? localDayNumber(t, zone) : localDayNumber(t - 1, zone);
    const edge = dir > 0 ? startOfDay(n + 1, zone) : startOfDay(n, zone);
    /** @type {Closed | UndeterminedCode} */
    const closed = tolled.has(n) ? { closed: true, why: `tolled (${tolled.get(n)})` } : r.units === "business_hours" ? cal.closedOn(n) : { closed: false };
    if ("undetermined" in closed) return closed;
    if (closed.closed) { trace.skipped.push({ day: dayText(n), why: closed.why }); t = edge; continue; }
    const avail = Math.abs(edge - t);
    if (avail >= remaining) { t += dir * remaining; remaining = 0; } else { remaining -= avail; t = edge; }
  }
  return { t };
}

/** The status checks of R16 that hold before any count: the rule's basis, a fact a rule needs withheld.
 * @param {Rule} rule
 * @param {View} view
 * @returns {UndeterminedCode | null} */
function preconditions(rule, view) {
  if (rule.basis === "UNMEASURED") return no("UNMEASURED", reason("civil-time.rules.unmeasured"));
  const computation = rule.computation;
  if (computation !== undefined) {
    const held = view.computation;
    const list = Array.isArray(held) ? held : [];
    const c = list.find((x) => x && x.key === computation);
    if (!c) return missing(view, "computation", "computation", { computation: String(computation) });
    if (c.rule !== "exclude_first_include_last") return ruleInvalid("computation", reason("civil-time.rules.invalid_computation", { rule: String(c.rule) }));
  }
  return null;
}

/** One evaluation of a read rule against one closure list: `{due, trace}`, an uncertain due, or undetermined.
 * @param {ReadRule} r
 * @param {Rule} rule
 * @param {When} anchor
 * @param {View} view
 * @param {Office | null} office
 * @param {Map<number, string>} tolled
 * @param {FactOf | null} factOf
 * @param {string | null} list
 * @param {string} zone
 * @returns {HoursDue | DaysDue | Refusal | UndeterminedCode} */
function evaluateOn(r, rule, anchor, view, office, tolled, factOf, list, zone) {
  /** @type {WorkTrace} */
  const trace = { closures: list, skipped: [], roll: [], notes: [] };
  const cal = calendar({ view, list, office, factOf });
  const needsCal = r.units === "business_hours" || r.count === "business" || r.roll;
  const weekend = view.weekend, weekendDays = weekend ? weekend.days : undefined;
  if (needsCal && !(weekend && Array.isArray(weekendDays))) {
    return missing(view, "weekend", "weekend_counting");
  }
  if (r.units === "hours" || r.units === "business_hours") {
    const s = spanOf(anchor);
    if ("refused" in s) return s;
    /* an EDTF anchor (the only span with `start`) is of neither precision, and is never an instant string */
    if ("start" in s || (s.dt.precision !== "minute" && s.dt.precision !== "second" && typeof anchor !== "string"))
      return no("ANCHOR_UNDETERMINED", reason("civil-time.rules.anchor_hours_precision", { value: String(s.dt.value), precision: String(s.dt.precision) }));
    if (s.twice) trace.notes.push(`${s.dt.value} occurs twice in ${s.dt.zone}; counted from both`);
    const h0 = countHours(r, s.lo, zone, cal, tolled, trace);
    if ("undetermined" in h0) return h0;
    const d0 = minuteDt(h0.t, zone);
    /** @type {Due} */
    let due = d0;
    if (s.twice) {
      const h1 = countHours(r, s.hi - 60, zone, cal, tolled, trace);
      if ("undetermined" in h1) return h1;
      due = { candidates: [d0, minuteDt(h1.t, zone)] };
    }
    trace.calendar = calendarStated(cal);
    return { due, trace };
  }
  const a = anchorDays(anchor, zone, rule, view, cal, trace);
  if ("refused" in a || "undetermined" in a) return a;
  const appliesOn = rule.applies_on;
  if (Array.isArray(appliesOn)) {   /* readRule refused every other form but absence */
    const wd = weekdayOf(a.first);
    if (a.first !== a.last || !appliesOn.includes(String(wd)))
      return no("RULE_NOT_APPLICABLE", a.first === a.last ? reason("civil-time.rules.not_applicable_day", { days: appliesOn.join(" or "), weekday: String(wd) })
        : reason("civil-time.rules.not_applicable_span", { days: appliesOn.join(" or ") }));
  }
  trace.anchor_day = a.first === a.last ? dayText(a.first) : [dayText(a.first), dayText(a.last)];
  /** @type {DayResult[]} */
  const results = [];
  for (const n of a.first === a.last ? [a.first] : [a.first, a.last]) {
    const d = dueDay(r, n, cal, tolled, trace);
    if ("undetermined" in d) return d;
    if ("candidates" in d) results.push(...d.candidates); else results.push(d);
  }
  trace.calendar = calendarStated(cal);
  const days = results.map((x) => x.day).sort((x, y) => x - y);
  const lo = days[0] ?? NaN, hi = days[days.length - 1] ?? NaN;   /* every day evaluated gave at least one result */
  const due = lo === hi ? dueAtTime(rule, lo, zone, view, office, trace)
    : { candidates: [dueAtTime(rule, lo, zone, view, office, trace), dueAtTime(rule, hi, zone, view, office, trace)] };
  return { due, trace, results, cal };
}

/** R12: the extension counted from the original due, as R9–R10 count; both readings, since the sources leave its start
 *  open (from day n before the roll or after it); where they agree, one date (K1504 (2)).
 * @param {ReadRule} r
 * @param {Extension} ext
 * @param {Rule} rule
 * @param {DaysDue} base
 * @param {View} view
 * @param {Office | null} office
 * @param {Map<number, string>} tolled
 * @param {string} zone
 * @param {WorkTrace} trace
 * @returns {Due | UndeterminedCode} */
function extend(r, ext, rule, base, view, office, tolled, zone, trace) {
  const count = ext.count || r.count || "calendar";
  /** @type {ReadRule} */
  const er = { ...r, units: "days", amount: ext.days, count };
  const dir = r.direction === "backward" ? -1 : 1;
  const cal = base.cal;
  /** @type {number[]} */
  const starts = [];
  for (const x of base.results) starts.push(x.unrolled, x.day);
  /** @type {{ skipped: Skipped[], roll: Roll[], notes: string[] }} */
  const t = { skipped: [], roll: [], notes: [] };
  /** @type {number[]} */
  const days = [];
  for (const s of [...new Set(starts)]) {
    const c = countDays(s, er.amount, dir, er.count === "business", cal, tolled, t.skipped);
    if ("undetermined" in c) return c;
    const rolled = rollIfAsked(er, c.day, dir, cal, t);
    if ("undetermined" in rolled) return rolled;
    days.push(rolled.day);
  }
  days.sort((x, y) => x - y);
  const lo = days[0] ?? NaN, hi = days[days.length - 1] ?? NaN;   /* every due day gave at least one start */
  if (lo !== hi)
    t.notes.push("the sources leave open whether the extension counts from the period's last day before or after its roll: both readings are kept (K1504 (2))");
  trace.extension = { days: ext.days, count, when: ext.when ?? null, citation: ext.citation ?? null, ...t };
  return lo === hi ? dueAtTime(rule, lo, zone, view, office, trace) : { candidates: [dayDt(lo, zone), dayDt(hi, zone)] };
}

/** R9–R17, R25.
 * @param {EvaluateArgs} args
 * @returns {RuleDue | RuleUndetermined | Refusal}
 * @throws {TypeError} when the view, the anchor or the rule is absent, or `factOf` is not a function */
export function evaluateRule(args) {
  if (!args || typeof args !== "object") throw new TypeError("evaluateRule takes {rule, anchor, view, office?, tolled?, factOf?}");
  const rule = args.rule, anchor = args.anchor, view = args.view, tolled = args.tolled;
  const givenOffice = args.office, givenFactOf = args.factOf, givenPractice = args.practice;
  const office = givenOffice === undefined ? null : givenOffice, factOf = givenFactOf === undefined ? null : givenFactOf;
  const practice = givenPractice === undefined ? null : givenPractice;
  if (!view || typeof view !== "object") throw new TypeError("evaluateRule needs the jurisdiction view");
  if (anchor === undefined || anchor === null) throw new TypeError("evaluateRule needs the anchor");
  if (factOf !== null && typeof factOf !== "function") throw new TypeError("factOf is a function");
  /* an object naming `undetermined` is the caller's unsettled value, never a date-time */
  if (typeof anchor === "object" && "undetermined" in anchor) return no("ANCHOR_UNDETERMINED", passOn(anchor.why, "civil-time.rules.anchor_undetermined", "civil-time.rules.anchor_undetermined_unsaid"));
  if (!rule || typeof rule !== "object") throw new TypeError("a rule is a deadlines entry (an object)");
  const r = readRule(rule);
  if ("undetermined" in r) return r;
  const pre = preconditions(rule, view);
  if (pre) return pre;
  const tolledSet = tolledDays(tolled);
  if (tolledSet === null) return refuse("DATE_INVALID", "a tolled span is not {from, to} calendar days in order");
  const anchorZone = typeof anchor === "string" ? "UTC" : anchor && anchor.zone;
  const zone = viewZone(view) || anchorZone;
  const zr = zoneRefusal(zone);
  if (zr) return zr;
  /** @type {RuleTrace} */
  const head = { rule: rule.rule ?? null, applies_to: rule.applies_to ?? null, citation: rule.citation ?? null, status: rule.status ?? null,
                 basis: rule.basis ?? null, starts: rule.starts ?? null, units: r.units, amount: r.amount, count: r.count ?? null,
                 direction: r.direction, computation: rule.computation ?? null, anchor, zone,
                 zone_from: viewZone(view) ? "the view's time_zone" : word("civil-time.anchor_zone"), office,
                 tolled: Array.isArray(tolled) ? tolled : [], runtime: runtimeVersions() };
  const base = evaluateOn(r, rule, anchor, view, office, tolledSet, factOf, r.closures, zone);
  if ("refused" in base) return base;
  if ("undetermined" in base) return { ...base, trace: { ...head } };
  /** @type {WorkTrace} */
  const trace = { ...head, ...base.trace };
  const stated = base.trace.calendar;
  for (const e of stated ? stated.entries : []) {
    const status = e.status, list = e.list;
    if (status === "unconfirmed" || status === "corrected") trace.notes.push(`calendar entry ${e.year}${list ? ` (${list})` : ""}: ${status}`);
    if (e.governs === "correction" && status !== "corrected") trace.notes.push(`calendar entry ${e.year}${list ? ` (${list})` : ""}: counted on its correction, now ${status}`);
  }
  /** @type {RuleDue} */
  const out = { due: base.due, trace };
  const ruleExt = rule.extension;
  if (ruleExt && r.units !== "hours" && r.units !== "business_hours" && "results" in base) {
    const ex = extend(r, ruleExt, rule, base, view, office, tolledSet, zone, trace);
    if ("undetermined" in ex) trace.extension = { undetermined: true, code: ex.code, why: ex.why };
    else out.extension = { due: ex, when: ruleExt.when ?? null, citation: ruleExt.citation ?? null };
  }
  /* R10: a practice calendar (the rule's `observed`, or one the caller names) is answered beside the rule, never as it. */
  /** @type {{ list: string, basis: string | null, status: string | null }[]} */
  const practices = [];
  const observed = rule.observed, observedList = observed ? observed.closures : undefined;
  if (observed && typeof observedList === "string") practices.push({ list: observedList, basis: observed.basis ?? null, status: observed.status ?? null });
  if (typeof practice === "string" && !practices.some((p) => p.list === practice)) practices.push({ list: practice, basis: null, status: null });
  if (practices.length && r.units !== "hours") {
    out.observed = practices.map((p) => {
      const o = evaluateOn({ ...r, closures: p.list }, rule, anchor, view, office, tolledSet, factOf, p.list, zone);
      const label = "observed practice";
      /** @type {ObservedDue | ObservedOpen} */
      const answer = "refused" in o ? { label, closures: p.list, undetermined: true, code: o.refused, why: o.why }
        : "undetermined" in o ? { label, closures: p.list, undetermined: true, code: o.code, why: o.why }
          : { label, closures: p.list, basis: p.basis, status: p.status, due: o.due, trace: { ...head, ...o.trace } };
      return answer;
    });
  }
  return out;
}

/* ---- due (R18) ---- */

/** @type {string[]} */
const BASIS_KINDS = ["rule", "commitment", "dependency", "window"];

/** R18.
 * @param {DueArgs} args
 * @returns {((RuleDue | RuleUndetermined | Refusal) & BasisOf) | StatedDue | Refusal}
 * @throws {TypeError} when `basis` is not a string, or a part its kind needs is absent or of the wrong type */
export function due(args) {
  if (!args || typeof args !== "object") throw new TypeError("due takes {basis, ...}");
  const { basis } = args;
  if (typeof basis !== "string") throw new TypeError("due's basis is a string");
  if (!BASIS_KINDS.includes(basis)) return refuse("BASIS_UNKNOWN", `'${basis}' is not a basis kind (${BASIS_KINDS.join(", ")})`);
  if (basis === "rule") {
    /* evaluateRule's own first checks, made here in its order and words, so that what it is handed states them */
    const { view, anchor } = args;
    if (!view || typeof view !== "object") throw new TypeError("evaluateRule needs the jurisdiction view");
    if (anchor === undefined || anchor === null) throw new TypeError("evaluateRule needs the anchor");
    const r = evaluateRule({ ...args, view, anchor });
    if ("refused" in r || "undetermined" in r) return { ...r, basis_kind: "rule", law_set: true };
    return { ...r, basis_kind: "rule", law_set: true };
  }
  if (basis === "commitment" || basis === "window") {
    const date = args.date;
    if (date === undefined || date === null) throw new TypeError(`a ${basis} due needs its date`);
    const s = spanOf(date);
    if ("refused" in s) return { ...s, basis_kind: basis, law_set: false };
    if (basis === "commitment") {
      /** @type {StatedTrace} */
      const stated = { basis_kind: basis, date, citation: args.citation ?? null, says: word("civil-time.says.body_stated_date"), runtime: runtimeVersions() };
      /** @type {StatedDue} */
      const committed = { due: date, basis_kind: basis, law_set: false, trace: stated };
      return committed;
    }
    /** @type {StatedTrace} */
    const trace = { basis_kind: basis, date, says: word("civil-time.says.group_date"), runtime: runtimeVersions() };
    /** @type {StatedDue} */
    const windowed = { due: date, basis_kind: basis, law_set: false, trace };
    return windowed;
  }
  /* dependency: the date of the event it precedes, less its lead counted as R9 counts, so it moves with that event. */
  const { precedes, lead, why } = args;
  if (precedes === undefined || precedes === null || lead === undefined || lead === null) throw new TypeError("a dependency due needs precedes and lead");
  const l = typeof lead === "number" ? { amount: lead, count: "calendar" } : lead;
  if (typeof l !== "object") throw new TypeError("a dependency's lead is a number of days or {amount, count, units?}");
  /** @type {Rule} */
  const depRule = { rule: "dependency", units: l.units || "days", amount: l.amount ?? l.days, count: (l.units || "days") === "days" ? (l.count || "calendar") : undefined,
                 direction: "backward", roll: l.roll === true, closures: l.closures, citation: why ?? null, starts: "act" };
  const view = args.view || {};
  const r = evaluateRule({ rule: depRule, anchor: precedes, view, office: args.office ?? null, factOf: args.factOf ?? null, tolled: args.tolled });
  if ("refused" in r || "undetermined" in r) return { ...r, basis_kind: "dependency", law_set: false };
  r.trace.basis_kind = "dependency";
  r.trace.precedes = precedes;
  r.trace.why = why ?? null;
  return { due: r.due, basis_kind: "dependency", law_set: false, trace: r.trace };
}

/* ---- overdueOn (R19) ---- */

/** @type {(x: When | undefined) => string | undefined} */
const valueOf = (x) => (x && typeof x === "object" ? x.value : undefined);

/** R19.
 * @param {{ due: DueValue | Unsettled | UndeterminedCode | Refusal | { due: DueValue | Unsettled }, at: string, side: string }} args
 * @returns {"overdue" | "not_overdue" | UndeterminedCode | Refusal}
 * @throws {TypeError} when `due` is absent, or `at` or `side` is not a string */
export function overdueOn(args) {
  if (!args || typeof args !== "object") throw new TypeError("overdueOn takes {due, at, side}");
  const d0 = args.due, at = args.at, side = args.side;
  if (d0 === undefined || d0 === null || typeof at !== "string" || typeof side !== "string") throw new TypeError("overdueOn needs due, at (an instant) and side");
  if (side !== "group" && side !== "body") return refuse("SIDE_UNKNOWN", `'${side}' is neither group nor body`);
  const d = d0 && typeof d0 === "object" && "due" in d0 && !("value" in d0) ? d0.due : d0;
  if (d && typeof d === "object" && "undetermined" in d) {
    const code = d.code;
    return no(code || "DUE_UNDETERMINED", passOn(d.why, "civil-time.rules.due_undetermined", "civil-time.rules.due_undetermined_unsaid"));
  }
  if (d && typeof d === "object" && "refused" in d)
    return no("DUE_UNDETERMINED", passOn(d.why, "civil-time.rules.due_undetermined", "civil-time.rules.due_undetermined_unsaid"));
  const t = parseInstant(at);
  if (t === null) return refuse("DATE_INVALID", `'${at}' is not an instant (YYYY-MM-DDTHH:MM:SSZ)`);
  /** @type {(dt: When | DateTimeIn | undefined) => Past | Refusal | UndeterminedCode} */
  const past = (dt) => {
    const s = spanOf(dt);
    if ("refused" in s) return s;
    const shi = s.hi;
    if (shi === null) return no("DUE_UNDETERMINED", reason("civil-time.rules.due_open_end", { value: String(s.dt.value) }));
    if (s.dt.precision === "day" || s.dt.precision === "edtf") {
      const z = s.dt.zone;
      const day = localDayNumber(t, z);
      const last = localDayNumber(shi - 1, z);
      return { over: day > last, day: dayText(day), zone: z };
    }
    return { over: t >= shi, instant: instantText(t) };
  };
  if (typeof d === "object" && "candidates" in d) {
    const e = d.candidates[0], l = d.candidates[1];
    const pe = past(e), pl = past(l);
    if ("refused" in pe || "undetermined" in pe) return pe;
    if ("refused" in pl || "undetermined" in pl) return pl;
    if (side === "group") return pe.over ? "overdue" : "not_overdue";
    if (pl.over) return "overdue";
    if (!pe.over) return "not_overdue";
    return no("POSSIBLY_OVERDUE", "day" in pe ? reason("civil-time.rules.possibly_overdue_day", { value: String(valueOf(e)), value_2: String(valueOf(l)), day: pe.day, zone: pe.zone })
      : reason("civil-time.rules.possibly_overdue_instant", { value: String(valueOf(e)), value_2: String(valueOf(l)), instant: pe.instant }));
  }
  const p = past(d);
  if ("refused" in p || "undetermined" in p) return p;
  return p.over ? "overdue" : "not_overdue";
}

/* ---- span (R24) ---- */

/** @type {string[]} */
const SPAN_UNITS = ["days", "business days", "hours", "months", "years"];
/** @param {number} a
 * @param {number} b
 * @returns {number} */
function monthsBetween(a, b) {
  const x = civil(a), y = civil(b);
  let m = (y.y - x.y) * 12 + (y.m - x.m);
  if (m > 0 && y.d < x.d) m--;
  if (m < 0 && y.d > x.d) m++;
  return m;
}

/** R24.
 * @param {When} a
 * @param {When} b
 * @param {{ unit: string, view?: View | null, office?: Office | null, factOf?: FactOf | null, closures?: string | null }} opts
 * @returns {SpanAnswer | UndeterminedCode | Refusal}
 * @bound min, max: whole numbers, min no more than max; equal when the precisions leave nothing open
 * @throws {TypeError} when a date-time is absent, or `opts` holds no `unit` string */
export function span(a, b, opts) {
  if (!opts || typeof opts !== "object" || typeof opts.unit !== "string") throw new TypeError("span takes (a, b, {unit, view?, office?})");
  if (a === undefined || a === null || b === undefined || b === null) throw new TypeError("span needs both date-times");
  const unit = opts.unit, givenView = opts.view, givenOffice = opts.office, givenFactOf = opts.factOf;
  const view = givenView === undefined ? null : givenView;
  const office = givenOffice === undefined ? null : givenOffice, factOf = givenFactOf === undefined ? null : givenFactOf;
  if (!SPAN_UNITS.includes(unit)) return refuse("UNIT_UNKNOWN", `'${unit}' is not one of ${SPAN_UNITS.join(", ")}`);
  const sa = spanOf(a), sb = spanOf(b);
  if ("refused" in sa) return sa;
  if ("refused" in sb) return sb;
  const saLo = sa.lo, saHi = sa.hi, sbLo = sb.lo, sbHi = sb.hi;
  if (saLo === null || saHi === null) return no("OPEN_END", reason("civil-time.rules.span_open_end", { value: String(sa.dt.value) }));
  if (sbLo === null || sbHi === null) return no("OPEN_END", reason("civil-time.rules.span_open_end", { value: String(sb.dt.value) }));
  /** @type {SpanTrace} */
  const trace = { unit, a, b, runtime: runtimeVersions(), skipped: [], notes: [] };
  if (unit === "hours") {
    /** @type {(s: Span, lo: number, hi: number) => [number, number]} */
    const pts = (s, lo, hi) => {
      const twice = s.twice;
      return s.dt.precision === "minute" ? [lo, twice ? hi - 60 : lo] : s.dt.precision === "second" ? [lo, twice ? hi - 1 : lo] : [lo, hi];
    };
    const [a0, a1] = pts(sa, saLo, saHi), [b0, b1] = pts(sb, sbLo, sbHi);
    /** @type {(x: number) => number} */
    const h = (x) => Math.trunc(x / 3600);
    return { min: h(b0 - a1), max: h(b1 - a0), trace };
  }
  /* a day's span was read from a real day, so parseDay always answers; null would count as day 0 in every sum */
  /** @type {(s: Span, lo: number, hi: number) => [number, number]} */
  const days = (s, lo, hi) => (s.dt.precision === "day" ? [parseDay(s.dt.value) ?? 0, parseDay(s.dt.value) ?? 0] : [localDayNumber(lo, s.dt.zone), localDayNumber(hi - 1, s.dt.zone)]);
  const [a0, a1] = days(sa, saLo, saHi), [b0, b1] = days(sb, sbLo, sbHi);
  if (unit === "days") return { min: b0 - a1, max: b1 - a0, trace };
  if (unit === "months" || unit === "years") {
    const vals = [monthsBetween(a1, b0), monthsBetween(a0, b1), monthsBetween(a0, b0), monthsBetween(a1, b1)];
    const k = unit === "years" ? 12 : 1;
    return { min: Math.trunc(Math.min(...vals) / k), max: Math.trunc(Math.max(...vals) / k), trace };
  }
  if (!view || typeof view !== "object") return no("FACT_ABSENT", reason("civil-time.rules.span_needs_view"));
  const weekend = view.weekend, weekendDays = weekend ? weekend.days : undefined;
  if (!(weekend && Array.isArray(weekendDays))) return missing(view, "weekend", "weekend");
  const cal = calendar({ view, list: opts.closures ?? null, office, factOf });
  /* business days after x up to and including y (x excluded, as R9 counts); negative when y is before x */
  /** @type {(x: number, y: number) => number | UndeterminedCode} */
  const between = (x, y) => {
    const dir = y >= x ? 1 : -1;
    let k = 0;
    for (let n = x + dir; dir > 0 ? n <= y : n >= y; n += dir) {
      const c = cal.closedOn(n);
      if ("undetermined" in c) return c;
      if (c.closed) trace.skipped.push({ day: dayText(n), why: c.why }); else k++;
    }
    return dir * k;
  };
  const lo = between(a1, b0);
  if (typeof lo === "object") return lo;
  const hi = a0 === a1 && b0 === b1 ? lo : between(a0, b1);
  if (typeof hi === "object") return hi;
  trace.calendar = calendarStated(cal);
  return { min: Math.min(lo, hi), max: Math.max(lo, hi), trace };
}
