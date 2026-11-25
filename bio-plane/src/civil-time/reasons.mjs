/* civil-time: the reasons the module gives for an undetermined answer of `values.mjs` (R30). A reason is `{key, vars}`,
 * never English: `key` a row of the word list, `vars` the values it fills. `reasonText` reads one in English through
 * the list, for a caller that draws a sentence itself (a trace, a log); the screens read `word(key, vars)` (people R40
 * passes the reason on exactly as given). The keys written first here are `localize` calls (K3930, K3943). */
import { word, localize } from "../setup-words/index.mjs";

/** R30: a reason, a key with its fills. */
export const reason = (key, vars = {}) => ({ key, vars });

const TEXT = {
  "civil-time.start_stated": (v) => word("civil-time.start_stated", v),
  "civil-time.end_stated": (v) => word("civil-time.end_stated", v),
  "civil-time.validity_states_zone": (v) => word("civil-time.validity_states_zone", v),
  "civil-time.precision_precision_held": (v) => word("civil-time.precision_precision_held", v),
  "civil-time.occur_clocks_move": (v) => word("civil-time.occur_clocks_move", v),
  "civil-time.occurs_twice_clocks": (v) => word("civil-time.occurs_twice_clocks", v),
  "civil-time.window_open_end": (v) => word("civil-time.window_open_end", v),
  "civil-time.date_open_unknown": (v) => word("civil-time.date_open_unknown", v),
  "civil-time.spans_two_fiscal": (v) => word("civil-time.spans_two_fiscal", v),
  "civil-time.recurrence.fiscal_year_form": (v) => localize("civil-time.recurrence.fiscal_year_form", "the fiscal year held for {body} does not give a start day (MM-DD) and a named_by (start or end)", v),
  "civil-time.missing.weekend_withheld": (v) => localize("civil-time.missing.weekend_withheld", "the weekend is withheld: the active profiles disagree on it ({at})", v),
  "civil-time.missing.weekend_absent": (v) => localize("civil-time.missing.weekend_absent", "the weekend is not held by the jurisdiction view", v),
  "civil-time.missing.weekend_counting_withheld": (v) => localize("civil-time.missing.weekend_counting_withheld", "the weekend is withheld: the active profiles disagree on it ({at}); a business count or a roll needs it (the weekend is never assumed)", v),
  "civil-time.missing.weekend_counting_absent": (v) => localize("civil-time.missing.weekend_counting_absent", "the weekend is not held by the jurisdiction view; a business count or a roll needs it (the weekend is never assumed)", v),
  "civil-time.missing.computation_withheld": (v) => localize("civil-time.missing.computation_withheld", "the computation '{computation}' the rule names is withheld: the active profiles disagree on it ({at})", v),
  "civil-time.missing.computation_absent": (v) => localize("civil-time.missing.computation_absent", "the computation '{computation}' the rule names is not held by the jurisdiction view", v),
  "civil-time.missing.fiscal_year_withheld": (v) => localize("civil-time.missing.fiscal_year_withheld", "a fiscal year for {body} is withheld: the active profiles disagree on it ({at})", v),
  "civil-time.missing.fiscal_year_absent": (v) => localize("civil-time.missing.fiscal_year_absent", "a fiscal year for {body} is not held by the jurisdiction view", v),
  "civil-time.missing.closure_list_withheld": (v) => localize("civil-time.missing.closure_list_withheld", "the closure list '{list}', which the rule names, is withheld: the active profiles disagree on it ({at})", v),
  "civil-time.missing.closure_list_absent": (v) => localize("civil-time.missing.closure_list_absent", "the closure list '{list}', which the rule names, is not held by the jurisdiction view", v),
  "civil-time.calendar.list_year_withheld": (v) => localize("civil-time.calendar.list_year_withheld", "the closure list '{list}' for {year} is withheld: the active profiles disagree on it", v),
  "civil-time.calendar.office_year_withheld": (v) => localize("civil-time.calendar.office_year_withheld", "the office calendar for {year} is withheld: the active profiles disagree on it", v),
  "civil-time.calendar.uncovered_list": (v) => localize("civil-time.calendar.uncovered_list", "the count reaches {year}, a year the closure list '{list}' does not cover for every office", v),
  "civil-time.calendar.uncovered_list_office": (v) => localize("civil-time.calendar.uncovered_list_office", "the count reaches {year}, a year the closure list '{list}' does not cover for {office}", v),
  "civil-time.calendar.uncovered_office": (v) => localize("civil-time.calendar.uncovered_office", "the count reaches {year}, a year the office calendar does not cover for every office", v),
  "civil-time.calendar.uncovered_office_office": (v) => localize("civil-time.calendar.uncovered_office_office", "the count reaches {year}, a year the office calendar does not cover for {office}", v),
  "civil-time.calendar.list_disputed": (v) => localize("civil-time.calendar.list_disputed", "the closure list '{list}' for {year}{offices} is disputed in your team's Civicsmith", v),
  "civil-time.calendar.office_disputed": (v) => localize("civil-time.calendar.office_disputed", "the office calendar for {year}{offices} is disputed in your team's Civicsmith", v),
  "civil-time.calendar.list_cannot_read": (v) => localize("civil-time.calendar.list_cannot_read", "the closure list '{list}' for {year}{offices} cannot be read in your team's Civicsmith", v),
  "civil-time.calendar.office_cannot_read": (v) => localize("civil-time.calendar.office_cannot_read", "the office calendar for {year}{offices} cannot be read in your team's Civicsmith", v),
  "civil-time.calendar.list_cannot_read_why": (v) => localize("civil-time.calendar.list_cannot_read_why", "the closure list '{list}' for {year}{offices} cannot be read in your team's Civicsmith: {why}", v),
  "civil-time.calendar.office_cannot_read_why": (v) => localize("civil-time.calendar.office_cannot_read_why", "the office calendar for {year}{offices} cannot be read in your team's Civicsmith: {why}", v),
  "civil-time.rules.invalid_units": (v) => localize("civil-time.rules.invalid_units", "the rule's units '{units}' is not one of {allowed}", v),
  "civil-time.rules.invalid_amount": (v) => localize("civil-time.rules.invalid_amount", "the rule's amount is not a positive whole number", v),
  "civil-time.rules.invalid_direction": (v) => localize("civil-time.rules.invalid_direction", "the rule's direction '{direction}' is neither forward nor backward", v),
  "civil-time.rules.invalid_count_unstated": (v) => localize("civil-time.rules.invalid_count_unstated", "the rule's count is not stated (calendar or business)", v),
  "civil-time.rules.invalid_count": (v) => localize("civil-time.rules.invalid_count", "the rule's count '{count}' is neither calendar nor business", v),
  "civil-time.rules.invalid_count_with_units": (v) => localize("civil-time.rules.invalid_count_with_units", "the rule's count is given with units '{units}'", v),
  "civil-time.rules.invalid_roll": (v) => localize("civil-time.rules.invalid_roll", "the rule's roll is not true or false", v),
  "civil-time.rules.invalid_closures": (v) => localize("civil-time.rules.invalid_closures", "the rule's closures is not a list's name", v),
  "civil-time.rules.invalid_due_at": (v) => localize("civil-time.rules.invalid_due_at", "the rule's due_at is neither close_of_business nor HH:MM", v),
  "civil-time.rules.invalid_applies_on": (v) => localize("civil-time.rules.invalid_applies_on", "the rule's applies_on is not a list of day names", v),
  "civil-time.rules.invalid_extension_days": (v) => localize("civil-time.rules.invalid_extension_days", "the rule's extension has no positive whole number of days", v),
  "civil-time.rules.invalid_extension_count": (v) => localize("civil-time.rules.invalid_extension_count", "the rule's extension count '{count}' is neither calendar nor business", v),
  "civil-time.rules.invalid_receipt": (v) => localize("civil-time.rules.invalid_receipt", "the rule's venue receipt '{rule}' is not a receipt rule this module counts", v),
  "civil-time.rules.invalid_computation": (v) => localize("civil-time.rules.invalid_computation", "the rule's computation names '{rule}', a computation this module does not count", v),
  "civil-time.rules.unmeasured": (v) => localize("civil-time.rules.unmeasured", "the rule's basis is UNMEASURED: no measurement or ruling sources it (K1445)", v),
  "civil-time.rules.anchor_open_end": (v) => localize("civil-time.rules.anchor_open_end", "the anchor {value} has an open or unknown end", v),
  "civil-time.rules.anchor_hours_precision": (v) => localize("civil-time.rules.anchor_hours_precision", "an hours rule counts from the anchor's time, and {value} is held at {precision} precision", v),
  "civil-time.rules.anchor_undetermined": (v) => localize("civil-time.rules.anchor_undetermined", "the anchor is undetermined: {why}", v),
  "civil-time.rules.anchor_undetermined_unsaid": (v) => localize("civil-time.rules.anchor_undetermined_unsaid", "the anchor is undetermined: no why given", v),
  "civil-time.rules.not_applicable_day": (v) => localize("civil-time.rules.not_applicable_day", "the rule applies only to an event on {days}, and the anchor is a {weekday}", v),
  "civil-time.rules.not_applicable_span": (v) => localize("civil-time.rules.not_applicable_span", "the rule applies only to an event on {days}, and the anchor is not a single day", v),
  "civil-time.rules.due_undetermined": (v) => localize("civil-time.rules.due_undetermined", "the due date is undetermined: {why}", v),
  "civil-time.rules.due_undetermined_unsaid": (v) => localize("civil-time.rules.due_undetermined_unsaid", "the due date is undetermined: no why given", v),
  "civil-time.rules.due_open_end": (v) => localize("civil-time.rules.due_open_end", "the due {value} has an open end", v),
  "civil-time.rules.possibly_overdue_day": (v) => localize("civil-time.rules.possibly_overdue_day", "possibly overdue: undetermined, because the due date is uncertain between {value} and {value_2} and {day} in {zone} lies after the first and not after the second (K1444 (i))", v),
  "civil-time.rules.possibly_overdue_instant": (v) => localize("civil-time.rules.possibly_overdue_instant", "possibly overdue: undetermined, because the due date is uncertain between {value} and {value_2} and {instant} lies after the first and not after the second (K1444 (i))", v),
  "civil-time.rules.span_open_end": (v) => localize("civil-time.rules.span_open_end", "{value} has an open or unknown end", v),
  "civil-time.rules.span_needs_view": (v) => localize("civil-time.rules.span_needs_view", "a span in business days needs the jurisdiction view", v),
  "civil-time.values.start_open": (v) => localize("civil-time.values.start_open", "{value} has an open start, so which comes first is not settled", v),
  "civil-time.values.start_unknown": (v) => localize("civil-time.values.start_unknown", "{value} has an unknown start, so which comes first is not settled", v),
  "civil-time.values.end_open": (v) => localize("civil-time.values.end_open", "{value} has an open end, so which comes first is not settled", v),
  "civil-time.values.end_unknown": (v) => localize("civil-time.values.end_unknown", "{value} has an unknown end, so which comes first is not settled", v),
  "civil-time.values.overlap": (v) => localize("civil-time.values.overlap", "{value} ({precision} precision, {zone}) and {value_2} ({precision_2} precision, {zone_2}) overlap, so the precision held does not say which came first", v),
  "civil-time.values.overlaps_start": (v) => localize("civil-time.values.overlaps_start", "{value} overlaps the start {bound} at the precision held", v),
  "civil-time.values.overlaps_end": (v) => localize("civil-time.values.overlaps_end", "{value} overlaps the end {bound} at the precision held", v),
  "civil-time.values.event_unresolved": (v) => localize("civil-time.values.event_unresolved", "the bounding event {event} ({edge}) is not resolved", v),
  "civil-time.values.event_unresolved_edgeless": (v) => localize("civil-time.values.event_unresolved_edgeless", "the bounding event {event} is not resolved", v),
};

/** Every key a reason of this module can carry (the test asserts each is held by the list or written by `localize`). */
export const REASON_KEYS = Object.keys(TEXT);

/** A `why` as English: a string as it is, a `{key, vars}` through the list. */
export function reasonText(why) {
  if (typeof why === "string") return why;
  if (!why || typeof why !== "object" || typeof why.key !== "string" || !Object.hasOwn(TEXT, why.key))
    throw new TypeError("a reason is a string or {key, vars} with a key this module gives");
  return TEXT[why.key](why.vars ?? {});
}
