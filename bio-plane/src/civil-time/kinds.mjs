/* civil-time: the kinds the module accepts and hands back (the coding standard's S4). A jurisdiction view is given by the
 * caller (`jurisdictions`' combined view); the kinds below state the parts of it this module reads, and nothing more.
 * Every optional part may be absent: an absent fact is never read as an open day, a closed day or a zero (R28). */

/** @typedef {{ [name: string]: string }} ReasonVars the values a reason fills, by placeholder name */
/** @typedef {{ key: string, vars: ReasonVars }} Reason a reason: a row of the word list and its fills (R30) */
/** @typedef {{ refused: string, why: string }} Refusal a refusal: its code and a detail string */

/** @typedef {{ value: string, precision: string, zone: string }} DateTime a date-time: `precision` day, minute, second or
 *  edtf, with `value` of that precision's form, in the IANA zone `zone` */
/** @typedef {string | DateTime} When a date-time, or an instant string (`record-grammar`'s `ISO_TS_RE`) */

/**
 * @template [C=never]
 * @typedef {{ undetermined: true, why: Reason, candidates?: C[], also?: Reason[] }} Undetermined an answer the inputs
 *   leave open: the first reason, any candidates, and further reasons
 */
/** @typedef {{ undetermined: true, code: string, why: Reason, field?: string }} UndeterminedCode an undetermined answer
 *  naming its kind (`code`) and, for RULE_INVALID, the rule's field */
/** @typedef {{ undetermined: true, why?: Reason | string | null, code?: string }} Unsettled an undetermined value a caller
 *  hands in where a date-time is expected (an anchor or a due), with its own reason */

/* ---- the jurisdiction view's parts this module reads ---- */

/** @typedef {{ at: string }} Conflict a fact the view withholds, by its path (`jurisdictions` R15) */
/** @typedef {{ date: string, name?: string }} ClosureDay a closed day of a closure list */
/** @typedef {string | { venue: string }} Office a counterparty's role, or a venue by its action kind */
/** @typedef {{ year: number | string, list?: string | null, offices?: Office[], days?: ClosureDay[], basis?: string | null }}
 *  HolidayEntry one closure list's year (`jurisdictions` R33, R43, R47) */
/** @typedef {{ days: string[] }} Weekend the weekdays that are closed, as `WEEKDAYS` names them */
/** @typedef {{ day: string, close: string }} HoursSpan one opening of a weekday, closing at `close` (`HH:MM`) */
/** @typedef {{ weekly?: HoursSpan[] }} Hours an office's hours (`jurisdictions` R42) */
/** @typedef {{ role: string, hours?: Hours }} Counterparty */
/** @typedef {{ time: string, citation?: string | null }} Cutoff a channel's daily cutoff (`HH:MM`) */
/** @typedef {{ rule?: string, citation?: string | null }} Receipt a venue's receipt convention */
/** @typedef {{ hours?: Hours, cutoff?: Cutoff, receipt?: Receipt }} Venue an action kind's venue and its channel facts */
/** @typedef {{ kind: string, venue?: Venue }} ActionKind */
/** @typedef {{ key: string, rule?: string }} Computation a named way of counting days (CCP § 12) */
/** @typedef {{ body: string, start?: string, named_by?: string, label?: string }} FiscalYear a body's fiscal year: its
 *  start `MM-DD`, the year it is named by (`start` or `end`) and its label's pattern */
/** @typedef {{ value?: string }} TimeZoneFact the view's time zone (`jurisdictions` R41) */
/** @typedef {{ body: string, rrule: string, dtstart: string }} StatedRecurrence a body's stated meeting schedule, which a
 *  caller expands (R20) */
/**
 * @typedef {{ id?: string, time_zone?: TimeZoneFact, conflicts?: Conflict[], holidays?: HolidayEntry[], weekend?: Weekend,
 *   counterparties?: Counterparty[], action_kinds?: ActionKind[], computation?: Computation[], fiscal_year?: FiscalYear[],
 *   deadlines?: Rule[], recurrences?: StatedRecurrence[] }} View the parts of a jurisdiction view (`jurisdictions`'
 *   `combine`) this module reads, and the `deadlines` and `recurrences` a caller takes a rule or a schedule from
 */

/** @typedef {{ days: number, count?: string, when?: string | null, citation?: string | null }} Extension a rule's
 *  extension (R12) */
/** @typedef {{ closures?: string, basis?: string | null, status?: string | null }} Observed a practice calendar named
 *  beside a rule (R10) */
/**
 * @typedef {{ rule?: string, applies_to?: string, citation?: string | null, status?: string, basis?: string,
 *   starts?: string, units?: string | undefined, amount?: number | undefined, days?: number, direction?: string,
 *   count?: string | undefined, roll?: boolean | string | undefined, closures?: string | number | undefined,
 *   due_at?: string, applies_on?: string[] | string, computation?: string, extension?: Extension | null,
 *   observed?: Observed | undefined }} Rule a `deadlines` entry of the view (`jurisdictions` R26 as widened by T33-2); a
 *   field of another form than its count reads (a `roll` that is not true or false, a `closures` that is not a name, an
 *   `applies_on` that is not a list of weekdays) is answered RULE_INVALID naming it (R16)
 */

/** @typedef {{ from: string, to: string }} Tolled a span of days, inclusive, on which a count is suspended (R14) */

/**
 * @typedef {{ status: string, why?: string, value?: ClosureDay[] | HolidayEntry, corrected?: boolean,
 *   by?: string | null, at?: string | null, says?: string }} CalendarFact what the caller's `factOf` says of a calendar
 *   entry on this instance (`action-clocks` R12's shape): its status (`confirmed`, `unconfirmed`, `corrected`, `disputed`,
 *   `absent`), and a member's correction that governs
 */
/** @typedef {(entry: HolidayEntry) => CalendarFact | null | undefined} FactOf the caller's reader of a calendar entry's
 *  status */

/* ---- what the counting answers carry ---- */

/**
 * @typedef {{ year: number, list: string | null, offices: Office[] | null, basis: string | null, status: string,
 *   why?: string, corrected_by?: string | null, corrected_at?: string | null, governs?: string, says?: string }}
 *   CalendarRead one calendar entry as read, with what `factOf` said of it (R16, R25)
 */
/** @typedef {{ list: string | null, office: Office | null, entries: CalendarRead[], status: string, notes: string[] }}
 *  CalendarStated what a trace says of the calendar's entries (R25) */
/** @typedef {{ day: string, why: string }} Skipped a day passed over, with why (R25) */
/** @typedef {{ from: string, to: string, passed: Skipped[] }} Roll a roll from a closed last day (R10) */
/** @typedef {{ time: string, citation: string | null, from: string, to: string }} CutoffApplied */
/** @typedef {{ rule: string, citation: string | null, from: string, to: string }} ReceiptApplied */
/** @typedef {{ tz: string, icu: string }} Runtime the runtime's tz and ICU versions, or `unknown` (R25) */
/**
 * @typedef {{ days: number, count: string, when: string | null, citation: string | null, skipped: Skipped[],
 *   roll: Roll[], notes: string[] }} ExtensionTrace
 */
/** @typedef {{ undetermined: true, code: string, why: Reason }} ExtensionUndetermined */
/** @typedef {DateTime | { candidates: DateTime[] }} Due a due: a date-time, or an uncertain date's candidates (R17) */
/**
 * @typedef {{ rule?: string | null, applies_to?: string | null, citation?: string | null, status?: string | null,
 *   basis?: string | null, starts?: string | null, units?: string, amount?: number, count?: string | null,
 *   direction?: string, computation?: string | null, anchor?: When | Unsettled, zone?: string, zone_from?: string,
 *   office?: Office | null, tolled?: Tolled[], runtime?: Runtime, closures?: string | null, skipped?: Skipped[],
 *   roll?: Roll[], notes?: string[], cutoff?: CutoffApplied, receipt?: ReceiptApplied, calendar?: CalendarStated,
 *   anchor_day?: string | string[], extension?: ExtensionTrace | ExtensionUndetermined, basis_kind?: string,
 *   precedes?: When | Unsettled, why?: string | null }} RuleTrace a rule's trace (R25)
 */
/** @typedef {{ label: string, closures: string, undetermined: true, code: string, why: Reason | string }} ObservedOpen */
/**
 * @typedef {{ label: string, closures: string, basis: string | null, status: string | null, due: Due,
 *   trace: RuleTrace }} ObservedDue a practice calendar's due, beside the rule's (R10)
 */
/**
 * @typedef {{ due: Due, trace: RuleTrace, extension?: { due: Due, when: string | null, citation: string | null },
 *   observed?: (ObservedDue | ObservedOpen)[] }} RuleDue what `evaluateRule` answers (R9–R17, R25)
 */
/** @typedef {UndeterminedCode & { trace?: RuleTrace }} RuleUndetermined */

/** @typedef {{ basis_kind: string, law_set: boolean }} BasisOf a due's basis kind, and whether the law sets it (R18) */
/**
 * @typedef {{ basis_kind: string, date: When, citation?: string | null, says: string, runtime: Runtime }} StatedTrace
 */
/** @typedef {{ due: When, basis_kind: string, law_set: boolean, trace: StatedTrace }} StatedDue */

/** @typedef {{ unit: string, a: When, b: When, runtime: Runtime, skipped: Skipped[], notes: string[],
 *  calendar?: CalendarStated }} SpanTrace */
/** @typedef {{ min: number, max: number, trace: SpanTrace }} SpanAnswer what `span` answers (R24) */

export {};
