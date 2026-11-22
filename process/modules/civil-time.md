Length: 104 lines. Last section: "Suggestions".

# civil-time: requirements

Next number: 31

**Size (P6).** About 1,500–2,500 lines (ladders §4.4).

## Public

### Purpose

The one engine for civil time: local days, date-times with their precision and zone, EDTF bands, three-valued comparison, time rules counted the law's way on a jurisdiction's calendar, due dates with their basis kind, bounded recurrences, fiscal periods, and `validAt`. It is pure: no store, no network, no clock; "now" is always its caller's. Every local fact (zone, weekend, closures, hours, rules, fiscal years) comes from the jurisdiction view it is given.

### Provides

**Values.** A *date-time* is `{value, precision, zone}`: `precision` is `day` (`value` `YYYY-MM-DD`), `minute` (`YYYY-MM-DDTHH:MM`), `second` (`YYYY-MM-DDTHH:MM:SS`) or `edtf` (`value` an EDTF level-1 string); `zone` an IANA name. An *instant* is a string matching `record-grammar`'s `ISO_TS_RE`. An *undetermined* answer is `{undetermined: true, why, candidates?}`; a *refusal* is `{refused: CODE, why}`. Every service throws `TypeError` only when an argument has the wrong JavaScript type or a required one is absent; otherwise it never throws.

**localDay(instant, zone) → `YYYY-MM-DD`**
- **R1** [met] Answers the calendar day, in `zone`, on which `instant` falls, across daylight-saving changes. An unknown zone is refused `ZONE_INVALID`.

**bounds(dt) → `{earliest, latest}`**
- **R2** [met] Answers the half-open span of instants `[earliest, latest)` that a date-time covers in its zone: a day covers its local day (23 or 25 hours across a daylight-saving change), a minute its minute, a second its second, an EDTF value its widest reading (R3). A malformed `value` is refused `DATE_INVALID`; a `value` not of its `precision`'s form is refused `DATE_INVALID`.

**parseEdtf(s) → `{earliest, latest, qualifiers}` or refusal**
- **R3** [met] Reads EDTF level 1 (K1464): uncertain `?`, approximate `~` and both `%`; unspecified digits `X`; intervals with an open (`..`) or unknown (empty) end; seasons 21–24; and years beyond four digits with `Y`. `earliest` and `latest` are days; an open or unknown end is `null`, never a date.
- **R4** [met] Anything of level 2 is refused `EDTF_UNSUPPORTED`, naming the feature; anything not EDTF is refused `DATE_INVALID`.

**compare(a, b) → `before` | `after` | `undetermined{why}`**
- **R5** [met] `before` only when all of `a` lies before all of `b` (`bounds(a).latest ≤ bounds(b).earliest`), `after` in the mirror case, and `undetermined` otherwise, naming the overlap ("both on 5 October at day precision"); an open or unknown EDTF end makes any comparison it could decide `undetermined`. A day is never read as its midnight (K1464). This is the one sequence read: no other module stores or computes "before" (ladders §2 EVENTS).

**isCalendarDate(s) → boolean**
- **R6** [met] `true` only for a `YYYY-MM-DD` naming a real day of the proleptic Gregorian calendar (`2024-02-29` yes, `2026-02-31` and `2026-13-01` no).

**dayRange(fromDay, toDay, zone) → `{start, end}`**
- **R7** [met] The inclusive local-day range: `start` is the first instant of `fromDay` and `end` the first instant after `toDay`, both in `zone`. `fromDay` after `toDay` is refused `RANGE_INVERTED`; a day failing R6 is refused `DATE_INVALID`.

**joinLocal(date, time, zone) → date-time or undetermined**
- **R8** [met] Joins a zone-less source date (a `YYYY-MM-DD`, or the same followed by a midnight `T00:00:00` as Legistar's `EventDate` gives it) with a clock time written `h:mm AM`/`hh:mm PM` (case and spacing folded) into a minute-precision date-time in `zone` (legistar-events M-V2). A wall time that occurs twice (the autumn change) is undetermined with both candidates; one that does not occur (the spring change) is undetermined with why. An unreadable time is refused `DATE_INVALID`.

**evaluateRule({rule, anchor, view, office?, tolled?, factOf?}) → `{due, trace}` or undetermined.** `rule` is a `deadlines` entry of `view` (`jurisdictions` R26 as widened by T33-2); `anchor` is the date-time of the event the rule `starts` from, given by the caller; `office` is the counterparty role or venue kind whose calendar governs; `tolled` is a list of `{from, to}` days the count is suspended; `factOf(entry)` is the caller's reader of a calendar entry's status (`action-clocks` R12's shape).
- **R9** [met] A day count follows the rule's `computation` (CCP §12 where cited: the first day excluded, the last included); the count runs forward or backward as `direction` says; `count: business` skips every closed day; `count: calendar` skips none. A closed day is a day of the `weekend` fact of the view, or a closure entry of the list the rule's `closures` selector names; with no selector, the holiday entries for all offices and those naming `office` (`jurisdictions` R43). The weekend is never assumed: with no `weekend` fact, a business count or a roll is undetermined with why.
- **R10** [met] `roll`: when the last day is closed, a forward period moves to the next day that is not closed, and a backward period to the previous one (time-law P2); with no `roll`, the last day stands. A statutory period rolls on the closures its law names, never on a body's practice; a practice calendar the caller passes in its place is answered beside the rule's, labelled "observed practice", never as the rule (K1504 (1); time-law O6/N6).
- **R11** [met] Hours: `hours` counts clock hours from the anchor's instant; `business hours` counts only hours on days that are not closed (OMC 2.20.070's "excluding Saturdays, Sundays and holidays"). Both run forward or backward and give a minute-precision due. Hours never roll.
- **R12** [met] `extension` `{days, count, when}` is computed, never ignored: the extended due is counted from the original due as R9–R10 count it. Where the sources leave its start open (the CPRA extension counted from day 10 before or after the roll), the answer is an uncertain date with both candidates (K1504 (2)).
- **R13** [met] A month or year period lands on the same day-number of the target month; where that month has no such day, the answer is an uncertain date whose candidates are the target month's last day and the next month's first (K1504 (4)).
- **R14** [met] Each `tolled` span's days are not counted. A rule due "by close of business" is due at the `close` of the governing office's `hours` (`jurisdictions` R42) on its due day; with no hours, the due is the day, at day precision, and the trace says the close of business is undetermined (K1444 (iii)).
- **R15** [met] Anchor conventions, from the view only: an anchor instant after a channel's `cutoff` on its local day counts from the next day that is not closed; an anchor on a closed day moves to the next day that is not closed only where a sourced local rule says so, else stays the actual day (K1504 (3)). The anchor's local day is taken in the governing office's `time_zone` (`jurisdictions` R41).
- **R16** [met] Undetermined, with why, when: the count reaches into a year the governing closure list does not cover (`jurisdictions` R33); a fact it needs is withheld as a conflict of the view; `factOf` reports an entry `disputed` or `absent`; the rule's basis is `UNMEASURED` (K1445); the anchor is undetermined; or the rule's form is not one this module counts (`RULE_INVALID` names the field). When `factOf` reports an entry `unconfirmed` or `corrected`, the due is computed and the trace states that status (`action-clocks` R10).
- **R17** [met] An uncertain date (R12, R13, an anchor with EDTF precision) is `{due: {candidates: [earliest, latest]}}`: the group's own deadline is the earliest candidate and a body's due the latest (K1444 (i)).

**due({basis, ...}) → `{due, basis_kind, law_set, trace}` or undetermined**
- **R18** [met] `basis` is one of `rule` (evaluated as R9–R17), `commitment` (the body's own stated date, cited), `dependency` `{precedes, lead, why}` (the date of the event it precedes, given by the caller, less `lead` counted as R9, so it moves when that event moves) or `window` (the group's own date). `law_set` is `true` only for `rule`; no other kind is ever called a deadline the law sets (K1431). An unknown kind is refused `BASIS_UNKNOWN`.

**overdueOn({due, at, side}) → `overdue` | `not_overdue` | `undetermined{why}`.** `at` is the caller's instant; `side` is `group` or `body`.
- **R19** [met] Compared on `at`'s local day in the due's zone, never the UTC day (K1444 (iii)). For `side: group` the earliest candidate governs; for `side: body` a body is overdue only after the latest candidate, and between the candidates the answer is `undetermined` ("possibly overdue: undetermined, because …", K1444 (i)). An undetermined due is undetermined.

**expandRecurrence({rrule, dtstart, zone, from, to}) → `{instances, truncated, trace}`**
- **R20** [met] Expands the RFC 5545 subset `FREQ` of `WEEKLY`, `MONTHLY` or `YEARLY`, `INTERVAL`, `BYDAY` with an ordinal, `BYMONTHDAY`, `BYSETPOS`, `EXDATE` and `UNTIL`, in `zone` (wall time kept across daylight-saving changes), between `from` and `to`. It stops at 24 months after `from` or 500 instances, whichever first, with `truncated: true`. Any other part is refused `RRULE_UNSUPPORTED`, naming it.

**fiscalPeriod({date, body, view}) → `{label, start, end}` or undetermined**
- **R21** [met] Maps a date to the fiscal year that contains it under the `fiscal_year` fact the view gives for `body` (its start month and day and the year it is named by), with `start` and `end` as days. No `fiscal_year` for the body is undetermined with why; a date of EDTF precision spanning two fiscal years is undetermined with both (ladders §4.2 F1).

**validAt({valid: {from, to, precision, zone}, basis}, date) → `in` | `out` | `undetermined{why}`**
- **R22** [met] `out` when `date` lies wholly before `from` or wholly after `to`; `in` when it lies wholly within both stated bounds; otherwise `undetermined`. A null bound means "not stated", never "always": a date after a stated `from` with a null `to` is `undetermined`, why "no end is stated", never `in` (ladders §2 TIME). Bounds are compared as R5 compares.
- **R23** [met] A bound may be `{event, edge, at?}`, `at` being the caller's resolution of that event's `edge` from its `bound_cache`; without `at` the bound is undetermined, why "the bounding event is not resolved". A bound giving both a value and an event is refused `BOUND_BOTH`. The zone defaults to the view's `time_zone` when the validity gives none.

**span(a, b, {unit, view?, office?}) → `{min, max, trace}` or undetermined**
- **R24** [met] The count of `unit` (`days`, `business days`, `hours`, `months`, `years`) from `a` to `b` on local days, `business days` counted as R9 counts them. When a precision leaves it open, `min` and `max` differ and bound every reading; when exact they are equal. It is the one span every module computes with (ladders §2 TIME, `calc-grammar`'s `span`).

**Traces**
- **R25** [met] Every answer of `evaluateRule`, `due`, `span` and `expandRecurrence` carries a `trace`: the rule and its citation, the anchor, each day skipped with why (weekend, which closure entry, tolled), any roll, extension or cutoff applied, each calendar entry's status as `factOf` gave it, and the runtime's tz and ICU versions, or `unknown` where the runtime does not state them (ladders §2 TIME).

**localClock(instant, zone) → `{hour, minute}`, and the reasons as keys**
- **R30** [met] (T51; N1249, N1250; K3864, K3870; PEOPLE #8 J2; `notice-producers` R25, `queue-producers` R43, `people` R40; amends R1, R22, R23) **A local clock read, and reasons that are keys.** `localClock(instant, zone)` answers `{hour, minute}`, the wall clock of `instant` in `zone` (hour 0 to 23, minute 0 to 59, across daylight-saving changes), from the same zone arithmetic as `localDay` (R1) and beside it: an unknown zone is refused `ZONE_INVALID` and an `instant` that is not an instant `DATE_INVALID`, as R1 refuses them, and a non-string argument is a `TypeError`. It formats nothing; a caller draws the clock in its own words. Every `why` that `validAt` (R22, R23) and `undetermined(why)` in `values.mjs` answer (no end stated, no start stated, the overlap, the unresolved bounding event, the zone and date refusals) is `{key, vars}`, never English, `vars` the values the reason fills (a date, a precision, a zone, an event and its edge); `people` R40 passes it on exactly as given. A reason with no row in the word table is written first by `localize` (setup-words R14), never inline English. Where one answer has more than one reason, `why` is the first and the rest ride in `also: [{key, vars}]`. `reasonText(why)` answers a reason's sentence through the word table, so a caller and a test read it as the module does; `REASON_KEYS` lists the keys. A refusal (`{refused: CODE, why}`) keeps its code and detail string, its sentence being `refusal.<CODE>` (K3958). Test: 2026-10-12T23:30:00Z in a Pacific zone answers hour 16, minute 30, and two instants an hour apart across the autumn change answer the repeated hour twice; a validity with a null `to` and a date after its `from` answers `why` an object with a string `key` and a `vars` object, and `word(key, vars)` is non-empty. Control: no undetermined answer of `values.mjs` carries a string `why`; the test asserts keys and fills, never a sentence's text.

## Private

### Uses

- `record-grammar`: `ISO_TS_RE` for instants.
- `jurisdictions`: the combined view's shape (`combine`): `deadlines` (R26 as widened by T33-2: units, direction, roll, closures, computation, extension, tolling, anchors, channel `cutoff`), `holidays` with `offices` (R33, R43), `hours` (R42), `time_zone` (R41), `weekend`, `fiscal_year`, and the view's `conflicts`.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R26** [met] Pure: no store, no network, no clock. No code path reads `Date.now()`, `new Date()` without an argument, or `Temporal.Now` (R-1 T-E9); "now" is always an argument. The same inputs always give the same answer.
- **R27** [met] No place in this module: no zone, weekend, holiday, office hour, rule or fiscal year is held in code. Every service is tested against the test profile and the first profile, and gives the test profile's answers from its facts alone.
- **R28** [met] Every undetermined answer and every refusal says which kind of no and why; absence of a calendar fact is never read as an open day, a closed day or a zero.
- **R29** [met] The worked examples of `measures-T33/time-law.md` §3 are its tests: P1–P6, R1, C1, O1–O6 and N6 each reach the expected due, and each one's negative control is not reached; E1 and E2's published answers are not matched. F1–F3 and the derived timed checks are tested as derived rows, labelled so, until a second source confirms each (P7).

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2, TIME (one engine; precision and zone; one validity value; basis kinds; rules as profile data; traces), §3 (the four basis kinds), §4.4 L1–L2 and the recurrences and fiscal periods of L3, §4.5 (due dates with zones for the one-off `.ics`).
- Rulings K1431, K1444, K1445, K1464, K1504 (the time conventions of `measures-T33/time-law.md` §1c).
- `build/layers.md`, "No jurisdiction in the product".

### Suggestions

- **For the callers** (not testable here): every module that counts days, takes a local day or compares dates delegates to this module (action-clocks, actions, monitoring, local-facts, progressions, queue, queue-producers, query-language, inquiry-grammar, calc-grammar's `span`); a module counting days itself is what ladders §2 TIME names as blocking. That obligation belongs in each caller's requirements.
- Field names: this file uses the entries' names (`units`, `direction`, `roll`, `closures`, `computation`, `extension`, `tolling`, `cutoff`, `weekend`, `fiscal_year`). `jurisdictions`' T33-2 job fixes them; this file follows, with no change of meaning. The receipt convention of R15 (K1504 (3)) needs a profile key; `receipt: "next_business_day"` on the rule or venue, with its citation, is a starting shape.
- Channel `outages` (entries A) have no counting rule in any source read; they are not counted here until one is sourced.
- `Intl.DateTimeFormat` with IANA zones does the zone arithmetic; `Temporal` replaces it only after the deployed-runtime measure (scope §3).
- R5's interval rule makes two identical second-precision instants `undetermined` ("the same instant at the precision held"); a fourth value `same` was not added, because the ladders specify three.
