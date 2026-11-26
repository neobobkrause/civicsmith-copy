/* civil-time: which days are closed, from the jurisdiction view alone (R9, R16, R27, R28). Nothing local is held
 * here: the weekend, the closure lists and their offices, and each entry's status on this instance (through the
 * caller's `factOf`) all come from the arguments. A missing fact is never read as an open day, a closed day or a
 * zero: it makes the answer that needs it undetermined, with why. */
import { civil, dayText, weekdayOf, parseDay } from "./days.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { reason } from "./reasons.mjs";
/** @import { Reason, ReasonVars, UndeterminedCode, View, Conflict, HolidayEntry, Office, ClosureDay, CalendarFact, FactOf, CalendarRead, CalendarStated } from "./kinds.mjs" */

/** @typedef {{ closed: true, why: string } | { closed: false }} Closed whether a day is closed, and why */
/** @typedef {{ days: Map<number, string> }} YearDays a year's closed days, each with its name */
/**
 * @typedef {{ closedOn: (n: number) => Closed | UndeterminedCode, read: CalendarRead[], list: string | null,
 *   office: Office | null, describe: string, readable: boolean }} Calendar
 */

/** @type {(code: string, why: Reason) => UndeterminedCode} */
const no = (code, why) => ({ undetermined: true, code, why });
/* R30: the office a reason names, as a value: a role, or a venue kind; "" for every office */
/** @type {(o: Office | null | undefined) => string} */
const officeName = (o) => (o === null || o === undefined ? "" : typeof o === "string" ? o : o && o.venue ? String(o.venue) : String(o));

/** The conflicts of the view about one fact (`jurisdictions` R15: a fact profiles disagree on is withheld).
 * @param {View | null | undefined} view
 * @param {string} key
 * @returns {Conflict[]} */
export function conflictsAbout(view, key) {
  const held = view ? view.conflicts : undefined;
  const cs = Array.isArray(held) ? held : [];
  return cs.filter((c) => {
    const at = c ? c.at : undefined;
    return c && typeof at === "string" && (at === key || at.startsWith(`${key}.`) || at.startsWith(`${key}[`));
  });
}

/** Why a fact the count needs is absent: withheld as a conflict, or not held. `subject` names which (R30): `weekend`,
 *  `weekend_counting`, `computation`, `fiscal_year`, `closure_list`; `vars` its fills.
 * @param {View | null | undefined} view
 * @param {string} key
 * @param {string} subject
 * @param {ReasonVars} [vars]
 * @returns {UndeterminedCode} */
export function missing(view, key, subject, vars = {}) {
  const c = conflictsAbout(view, key);
  if (c.length) {
    /** @type {ReasonVars} */
    const fills = { ...vars };
    fills.at = c.map((x) => x.at).join(", ");
    return no("FACT_WITHHELD", reason(`civil-time.missing.${subject}_withheld`, fills));
  }
  return no("FACT_ABSENT", reason(`civil-time.missing.${subject}_absent`, vars));
}

/** @type {(o: Office | null | undefined) => string} */
const officeWords = (o) => (o === null || o === undefined ? "every office" : typeof o === "string" ? o : o && o.venue ? word("civil-time.venue", { venue: String(o.venue) }) : String(o));
/** @param {HolidayEntry} entry
 * @param {Office | null} office
 * @returns {boolean} */
function namesOffice(entry, office) {
  const offices = entry.offices;
  if (!Array.isArray(offices)) return true;
  if (office === null || office === undefined) return false;
  return offices.some((o) => (typeof o === "string" ? o === office
    : !!(o && typeof o === "object" && office && typeof office === "object" && o.venue === office.venue)));
}

/** R9, R16 (N603; local-facts R2, R3): the days of a member's correction that governs on this instance, else null. A
 * correction governs until a later act, and a later `confirm` confirms it, so it is counted on whenever the answer says
 * the governing value is a correction (`corrected: true`), whatever the status reads now, as well as while the status
 * reads `corrected`. The value is the entry's days, or the entry itself with its days.
 * @param {CalendarFact | null} fact
 * @returns {ClosureDay[] | null} */
function governingCorrection(fact) {
  const f = fact;
  if (!f || (f.status !== "corrected" && f.corrected !== true)) return null;
  const value = f.value;
  if (Array.isArray(value)) return value;
  const days = value && typeof value === "object" ? value.days : undefined;
  if (Array.isArray(days)) return days;
  return null;
}

/**
 * A calendar: `closedOn(n)` answers whether local day `n` is closed, `{closed, why}`, or undetermined. `list` names
 * the closure list (R47) a rule counts on; null takes the office calendar (the entries with no `list`). `tolled` days
 * are reported apart by the counter, not here. `read` collects, once per entry, what `factOf` said of it (R16, R25).
 * @param {{ view: View, list?: string | null, office?: Office | null, factOf?: FactOf | null }} args
 * @returns {Calendar}
 */
export function calendar({ view, list = null, office = null, factOf = null }) {
  const heldHolidays = view ? view.holidays : undefined;
  const holidays = Array.isArray(heldHolidays) ? heldHolidays : [];
  const selected = holidays.filter((h) => {
    const hl = h ? h.list : undefined;
    return h && (list ? hl === list : hl === undefined || hl === null) && namesOffice(h, office);
  });
  const heldWeekend = view ? view.weekend : undefined, weekendDays = heldWeekend ? heldWeekend.days : undefined;
  /** @type {Set<string | undefined> | null} */
  const weekend = Array.isArray(weekendDays) ? new Set(weekendDays) : null;
  const readable = typeof factOf === "function";
  /** @type {CalendarRead[]} */
  const read = [];
  /** @type {Map<number, UndeterminedCode | YearDays>} */
  const years = new Map([]);
  const listWords = list ? word("civil-time.closure_list", { list: String(list) }) : word("civil-time.office_calendar");
  const listHeld = !list || holidays.some((h) => h && h.list === list);

  /** What the caller's `factOf` says of an entry; absent where it gives nothing or fails; null where there is no reader.
   * @param {HolidayEntry} h
   * @returns {CalendarFact | null} */
  function factFor(h) {
    if (typeof factOf !== "function") return null;
    try { return factOf(h) || { status: "absent", why: word("action-clocks.why.reader_gave_answer") }; } catch { return { status: "absent", why: word("civil-time.why.reader_failed") }; }
  }

  /** @param {number} y
   * @returns {UndeterminedCode | YearDays} */
  function readYear(y) {
    const entries = selected.filter((h) => Number(h.year) === y);
    if (!listHeld) return missing(view, "holidays", "closure_list", { list: String(list) });
    if (!entries.length) {
      const c = conflictsAbout(view, "holidays").filter((x) => x.at.includes(String(y)));
      const kind = list ? "list" : "office", who = officeName(office);
      /** @type {ReasonVars} */
      const fills = {};
      if (list) fills.list = String(list);
      fills.year = String(y);
      if (who) fills.office = who;
      return c.length ? no("FACT_WITHHELD", reason(`civil-time.calendar.${kind}_year_withheld`, fills))
        : no("CALENDAR_UNCOVERED", reason(`civil-time.calendar.uncovered_${kind}${who ? "_office" : ""}`, fills));
    }
    /** @type {Map<number, string>} */
    const days = new Map([]);
    for (const h of entries) {
      const stated = factFor(h);
      const governs = governingCorrection(stated);
      const offices = h.offices, status = stated ? stated.status : undefined, why = stated ? stated.why : undefined;
      /** @type {CalendarRead} */
      const entry = { year: y, list: h.list ?? null, offices: Array.isArray(offices) ? offices : null, basis: h.basis ?? null,
                      status: stated ? stated.status : "not_read" };
      if (stated && why) entry.why = why;
      if (stated && status === "corrected") { entry.corrected_by = stated.by ?? null; entry.corrected_at = stated.at ?? null; }
      if (governs) {
        entry.governs = "correction";
        const says = stated ? stated.says : undefined;
        if (typeof says === "string") entry.says = says;
      }
      read.push(entry);
      if (stated && (status === "disputed" || status === "absent")) {
        const kind = list ? "list" : "office";
        /** @type {ReasonVars} */
        const at = {};
        if (list) at.list = String(list);
        at.year = String(y);
        at.offices = Array.isArray(offices) ? ` (${offices.map(officeWords).join(", ")})` : "";
        if (status === "disputed") return no("FACT_DISPUTED", reason(`civil-time.calendar.${kind}_disputed`, at));
        if (!why) return no("FACT_ABSENT", reason(`civil-time.calendar.${kind}_cannot_read`, at));
        /** @type {ReasonVars} */
        const atWhy = { ...at };
        atWhy.why = String(why);
        return no("FACT_ABSENT", reason(`civil-time.calendar.${kind}_cannot_read_why`, atWhy));
      }
      const dayList = governs || h.days;
      for (const d of dayList || []) {
        const n = d && parseDay(d.date);
        if (n !== null && n !== undefined) days.set(n, d.name || "a closure day");
      }
    }
    return { days };
  }

  /** @param {number} y
   * @returns {UndeterminedCode | YearDays} */
  function year(y) {
    const known = years.get(y);
    if (known !== undefined) return known;
    const out = readYear(y);
    years.set(y, out);
    return out;
  }

  /** @param {number} n
   * @returns {Closed | UndeterminedCode} */
  function closedOn(n) {
    if (!weekend) return missing(view, "weekend", "weekend");
    const wd = weekdayOf(n);
    if (weekend.has(wd)) return { closed: true, why: `weekend (${wd})` };
    const y = year(civil(n).y);
    if ("undetermined" in y) return y;
    if (y.days.has(n)) return { closed: true, why: `${y.days.get(n)} (${list || "office calendar"})` };
    return { closed: false };
  }

  return { closedOn, read, list, office, describe: listWords, readable };
}

/** What the trace says of the calendar's entries (R25; `action-clocks` R10's statement).
 * @param {Calendar} cal
 * @returns {CalendarStated} */
export function calendarStated(cal) {
  /** @type {string[]} */
  const notes = [];
  for (const r of cal.read) {
    const says = r.says, by = r.corrected_by, at = r.corrected_at;
    if (r.status === "unconfirmed") notes.push(word("civil-time.counted_unconfirmed_calendar", { basis: String(r.basis ?? localize("civil-time.calendar.no_source_stated", "no source stated")), year: String(r.year) }));
    if (r.governs === "correction" && r.status !== "corrected")
      notes.push(word("civil-time.counted_correction_governs", { status: String(r.status), says: String(says ? ` (${says})` : ""), year: String(r.year) }));
    if (r.status === "corrected") notes.push(word("civil-time.counted_calendar_corrected", { corrected_by: String(by ? ` by ${by}` : ""), corrected_at: String(at ? `, ${at}` : ""), year: String(r.year) }));
  }
  return { list: cal.list, office: cal.office ?? null, entries: cal.read, status: cal.readable ? (cal.read.length ? "read" : "none_read") : "not_read", notes };
}

export { dayText };
