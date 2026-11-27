/* A meeting calendar: a list of meetings, each with a date, a body, a status, and
 * documents that arrive at different times relative to the meeting itself.
 *
 * MEASURED on oakland.legistar.com/Calendar.aspx, 2026-07-30. This type is written
 * from that page and nothing else, and every rule below points at something in it.
 *
 *   The visible range is "This Month", read from the range control's own value.
 *   Dates on the page span 6/29/2026 to 7/31/2026. THE WINDOW IS RELATIVE TO NOW.
 *   18 meetings, each keyed by a stable MeetingDetail.aspx?ID=.
 *   FIVE of the eighteen read CANCELLED.
 *   Document links carry a type code: M=A is an Agenda (11 present), M=M is Minutes
 *   (10 present), with AADA and MADA the accessible versions of each.
 *
 * THE FALSE POSITIVE THIS TYPE EXISTS TO KILL. Because the window is relative, a
 * check a week later sees a different set of meetings: some have scrolled out of
 * range. The membership diff underneath reports those as REMOVED, which is the
 * heaviest signal the system has and which is reserved for a public record being
 * delisted. A meeting leaving the visible window is not that. No amount of care
 * about bytes or furniture could tell the two apart, because the distinction is
 * about what a calendar IS: it shows a moving window onto a longer series.
 *
 * So absence is only a delisting when the meeting's own date is INSIDE the window
 * the new capture shows. Outside it, absence is expected and silent.
 *
 * THE TEMPORAL STRUCTURE, which is the other half. A meeting has a scheduled date
 * and documents that are due at knowable times relative to it: an agenda BEFORE,
 * minutes AFTER. That makes some absences into facts with dates attached, which is
 * the most valuable thing this type produces. Minutes that have not appeared three
 * weeks after a meeting are a fact about the body, not a gap in the record.
 */
import { CONFIDENCE, CONTRACT, entity, referential, temporal, diffEntities, readerView, practiceValue } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful, bySeverity, unescapeHtml, SIGNIFICANCE } from "../site-profiles/index.mjs";
import { evaluateRule, localDay, reasonText } from "../bio-plane/src/civil-time/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { counted, spend } from "./windows.mjs";

/** @import { DoctypeContext, Detection, Entity, EntityFact, Connection, PracticeValue, ReaderView } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */
/** @import { RuleDue, RuleUndetermined, Refusal } from "../bio-plane/src/civil-time/kinds.mjs" */

/**
 * The window a calendar shows (R41): the range control's own name for it, whether it moves, and the first and last
 * dates on the page as UTC milliseconds (`NaN` both when a date on it is not a date; null with no dates).
 * @typedef {Object} MeetingWindow
 * @property {string | null} named
 * @property {boolean} relative
 * @property {number | null} from
 * @property {number | null} to
 */
/**
 * What `parse` reads of a calendar: one entity per meeting, the window, and when it was captured.
 * @typedef {Object} MeetingCalendarReading
 * @property {Entity[]} entities
 * @property {MeetingWindow} window
 * @property {string | null} at
 */
/**
 * When minutes of a meeting are due (`minutesDue`): the day, its unit, the period and the zone it was counted in, or
 * no day and why.
 * @typedef {{ due: string, unit: string, amount: number, zone: string } | { due: null, unit?: string, why: string }} MinutesDue
 */
/**
 * civil-time's answer to the count of minutes due, or what the count threw.
 * @typedef {{ ok: true, answer: RuleDue | RuleUndetermined | Refusal } | { ok: false, thrown: unknown }} DueCount
 */
/**
 * What `assess` confirmed unchanged: of how many meetings, how many are intact, the window's name, and how many
 * scrolled out of it.
 * @typedef {Object} MeetingConfirmed
 * @property {number} entries
 * @property {number} intact
 * @property {string | null} window
 * @property {number} scrolled_out
 */
/**
 * What `assess` answers of two readings (docprofile's `TypeAssessment`, with the worst significance).
 * @typedef {Object} MeetingCalendarAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {MeetingConfirmed | null} confirmed
 * @property {string} why
 */
/**
 * The meeting calendar's content type, as `counted` hands it back: docprofile's `ContentType` with this type's own reading.
 * @typedef {Object} MeetingCalendarType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {boolean} [fallback] never present: this type is not the fallback
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => MeetingCalendarReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => MeetingCalendarAssessment} assess
 * @property {(before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => Connection[]} connections
 */

/* How long after a meeting minutes stop being merely late is the JURISDICTION'S
   practice, not this reader's: it is the view's `practice.minutes_due_days`, with the
   measurement it rests on (N3). It is a threshold for RAISING A QUESTION, never for
   asserting a violation, and with no profile supplying it no date is set at all: the
   absence is still stated, and when the minutes are due is said to be unknown. */

/** When minutes of a meeting held on `day` are due, by the view's practice (T33 B4, K1527):
 *  the period counted the way the profile states it (`count: business` on the profile's own
 *  weekend and closures, else calendar days) by civil-time, the one engine for counting days,
 *  from the meeting's day in the profile's time zone.
 *  `{due, unit}`, or `{due: null, why}` when no profile states the practice or the count
 *  cannot be made (no weekend stated, a year the closures do not cover), never a guess. */
/** civil-time's count of the practice's period from `day`, or what the count threw. A rule's `closures` left undefined
 *  is a rule without one: civil-time reads the member and nothing else of it.
 *  @param {PracticeValue} p @param {string} count @param {string | null} closures @param {string} day @param {string} zone
 *  @param {ReaderView} view
 *  @returns {DueCount} */
function countDue(p, count, closures, day, zone, view) {
  try {
    return { ok: true, answer: evaluateRule({ rule: { rule: "minutes_due_days", units: "days", amount: p.value, count,
                                                      direction: "forward", basis: p.basis || null, starts: "act",
                                                      closures: closures || undefined },
                                              anchor: { value: day, precision: "day", zone }, view }) };
  }
  catch (e) { return { ok: false, thrown: e }; }
}

/** @param {DoctypeContext} ctx @param {string} day @returns {MinutesDue} */
function minutesDue(ctx, day) {
  const view = readerView(ctx);
  /* The period and its unit through docprofile's shared reader (as docprofile's own seed
     reads it); the closure list it counts on from the view's same entry (jurisdictions R7). */
  const p = practiceValue(ctx, "minutes_due_days");
  if (!p) return { due: null, why: localize("doctypes.meeting-calendar.no_practice", "no active jurisdiction profile states how long minutes usually take") };
  const practice = view.practice;
  const entry = practice && practice.minutes_due_days;
  const named = entry ? entry.closures : undefined;
  const closures = entry && typeof named === "string" ? named : null;
  const count = p.count === "business" ? "business" : "calendar";
  const full = "time_zone" in view ? view : null;   // a view without the member reads it as absent
  const tz = full ? full.time_zone : undefined;
  const tzValue = tz ? tz.value : undefined;
  const zone = tz && typeof tzValue === "string" ? tzValue : "UTC";
  /* The closures a business count skips are the profile's own: the list the practice names
     (`closures`) when it names one, else the office calendar (civil-time R9). */
  const tried = countDue(p, count, closures, day, zone, view);
  if (!tried.ok) { const e = tried.thrown; return { due: null, why: localize("doctypes.meeting-calendar.period_uncounted", "the period could not be counted: {reason}", { reason: String((e instanceof Error && e.message) || e) }) }; }
  const unit = count === "business" ? "business days" : "days";
  const answer = tried.answer;
  /* Each member read as the old `r.refused`, `r.undetermined`, `r.due` and `r.why` read it: undefined where absent. */
  const refused = "refused" in answer ? answer.refused : undefined;
  const undetermined = "undetermined" in answer ? answer.undetermined : undefined;
  const due = "due" in answer ? answer.due : undefined;
  const why = "why" in answer ? answer.why : undefined;
  if (!answer || refused || undetermined || !due)
    return { due: null, unit, why: localize("doctypes.meeting-calendar.period_not_counted_here", "the jurisdiction's {amount} {unit} could not be counted from this meeting: {reason}", { amount: String(p.value), unit, reason: answer && why ? reasonText(why) : "no due day" }) };
  /* An uncertain due is the body's latest candidate: lateness is only raised after it (K1444 (i)). */
  const d = "candidates" in due ? due.candidates[due.candidates.length - 1] : due;
  if (d === undefined) throw new TypeError("Cannot read properties of undefined (reading 'value')");
  return { due: String(d.value).slice(0, 10), unit, amount: p.value, zone };
}

/** What lies inside the page's `<main>` element, from the end of its opening tag to its last `</main>`, or the whole text
 *  when it holds none. Only the first opening tag can be the one: a `</main>` after a later one is after this one too.
 *  (R40: found without trying every `<main` against the rest of the text.) */
/** @param {string} raw @returns {string} */
function insideMain(raw) {
  const open = /<main\b/i.exec(raw);
  if (!open) return raw;
  const gt = raw.indexOf(">", open.index + open[0].length);
  if (gt < 0) return raw;
  /* The last `</main>` of the text, kept only when it starts after the opening tag's `>`: one `</main>` cannot overlap
     another, so the last of all of them is the last of those found from there. */
  let last = -1;
  for (const c of raw.matchAll(/<\/main>/gi)) last = c.index;
  return last < gt + 1 ? raw : raw.slice(gt + 1, last);
}

/** The table rows of the text, `<tr ...>` to the next `</tr>`, one at a time (R40: no list of all of them, and no tag
 *  that never closes tried against the rest of the text). */
/** The first match `it` yields that starts at or after `at`, or null when none is left.
 *  @param {Iterator<RegExpExecArray, unknown, undefined>} it @param {number} at @returns {RegExpExecArray | null} */
function firstFrom(it, at) {
  for (;;) {
    const n = it.next();
    if (n.done) return null;
    if (n.value.index >= at) return n.value;
  }
}

/** @param {string} scope @returns {Generator<string, void, void>} */
function* rowsOf(scope) {
  const lastGt = scope.lastIndexOf(">");
  if (lastGt < 0) return;
  const head = scope.slice(0, lastGt + 1);   // a tag opening after the last ">" never ends
  /* One pass of each pattern, from the start, skipping what lies before where the search would have started: an
     opening tag holds no ">" but its last, and a row ends on one, so no tag found from the start runs across a row's
     end; `</tr>` cannot overlap another. So each is the first found from there, as a search started there finds. */
  const opens = head.matchAll(/<tr\b[^>]*>/gi), closes = scope.matchAll(/<\/tr>/gi);
  for (let at = 0; ;) {
    const o = firstFrom(opens, at);
    if (!o) return;
    const c = firstFrom(closes, o.index + o[0].length);
    if (!c) return;
    at = c.index + c[0].length;
    yield scope.slice(o.index, at);
  }
}

/** A group of a match as a number, `NaN` where it took no part, as `+` reads an absent one. @param {string | undefined} g @returns {number} */
const num = (g) => (g === undefined ? NaN : +g);
/** @param {string} s @returns {number | null} */
const parseDate = (s) => {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || ""));
  if (!m) return null;
  return Date.UTC(num(m[3]), num(m[1]) - 1, num(m[2]));
};
/** @param {number | null} t @returns {string | null} */
const iso = (t) => (t == null ? null : new Date(t).toISOString().slice(0, 10));
/** A document link's type code, upper-cased, and the document it is. */
const DOCUMENT_KINDS = new Map([["A", "agenda"], ["M", "minutes"], ["AADA", "agenda"], ["MADA", "minutes"], ["IC", "packet"]]);
/** A row's documents before any is read: none. @type {ReadonlyArray<[string, string | undefined]>} */
const NO_DOCS = Object.freeze([]);

/* What reading a member of a reading that is not there throws, word for word as the old reads threw it: `assess` read
   `a.entities.length`, `connections` iterated `b.entities`. */
const MISSING_LENGTH = "Cannot read properties of undefined (reading 'length')";
const MISSING_ITERABLE = "b.entities is not iterable";

/** Whether `v` is a reading of this type: its entities a list.
 *  @param {object} v @returns {v is MeetingCalendarReading} */
function isReading(v) {
  return "entities" in v && Array.isArray(v.entities);
}

/** `r` as this type's reading; a `TypeError`, as reading its entities threw, where it is none.
 *  @param {object | null | undefined} r
 *  @param {string} missing what reading the absent entities threw
 *  @returns {MeetingCalendarReading}
 *  @throws {TypeError} when `r` is absent or holds no list of entities */
function readingOf(r, missing) {
  if (r === null || r === undefined) throw new TypeError(`Cannot read properties of ${r} (reading 'entities')`);
  if (!isReading(r)) throw new TypeError(missing);
  return r;
}

/** @type {MeetingCalendarType} */
const meetingCalendar = {
  key: "meeting_calendar",
  label: "a meeting calendar",
  version: 1,
  /* A list, so what matters is its MEMBERSHIP — which meetings are on it and whether
     each still says what it said — not whether the page differs. Declared here on the
     content type (CONSTRUCTS Step 0 #4) rather than derived from the stack handler. */
  contract: CONTRACT.MEMBERSHIP,

  detect(ctx) {
    const t = String(ctx.text || "");
    /** @type {string[]} */
    const signals = [];
    spend(t.length * 3);   // the three tests of the text below each read it once at most
    /* The pattern holds no character an entity stands for, so the text unescaped holds it exactly where the text as it
       stands does (R37: no unescaped copy of a large text). */
    if (/MeetingDetail\.aspx\?ID=/i.test(t)) signals.push("meeting detail links");
    if (/\bCalendar\.aspx/i.test(String(ctx.locator || "")) || /\bcalendar\b/i.test(String(ctx.locator || "")))
      signals.push("calendar address");
    if (/Date Range Dropdown|lstYears_Input/i.test(t)) signals.push("a date-range control");
    if (/>\s*(?:Agenda|Minutes)\s*</i.test(t)) signals.push("agenda and minutes columns");
    /* The detail links are the definitive signal: a page listing meetings by id IS
       a meeting calendar whatever it is called. */
    if (signals.includes("meeting detail links") && signals.length >= 2)
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    if (signals.length >= 2) return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    return { match: false, confidence: CONFIDENCE.NONE };
  },

  /** What is in it: the window it shows, and one entity per meeting.
   *
   *  FW-17 / IC-86 — THIS READER CANNOT SAY WHERE A REFERENCE WAS READ, and it
   *  says so here because IC-86 makes that a stated obligation rather than a
   *  silence: a reader that emits no position and a reader that had none are
   *  indistinguishable at the wire, so the one that cannot must declare it.
   *  Every entity below is emitted with NO `source`, deliberately, and for three
   *  reasons that are each sufficient on their own.
   *
   *  (1) NO ARM OF IC-1 HAS A PRODUCER FOR THIS CONTAINER. An HTML page's
   *  element reference is IC-1's `dom` arm, and `dom` has no producer anywhere
   *  in the tree and is refused by name until CONTENT-HTML emits it. Emitting
   *  any other arm for an HTML page would be a second reference vocabulary —
   *  precisely what IC-1's constraint forbids.
   *
   *  (2) THE OFFSETS THIS READER WORKS IN ARE NOT THE OFFSETS `ctx.locate`
   *  ANSWERS. It reads `unescapeHtml(ctx.text)`, and unescaping SHORTENS the
   *  string by four characters per `&amp;` and three per `&lt;` — so every
   *  offset after the first entity reference is displaced by an amount that
   *  depends on how many preceded it. It then narrows to the inside of `<main>`,
   *  displacing them again. Handing either coordinate to `locate` would return a
   *  confidently wrong page, which is worse than no page at all: a wrong address
   *  is a claim, and an absent one is an admission.
   *
   *  (3) A CALENDAR REACHES THIS READER THROUGH THE ACQUIRE PATH'S OWN TEXT
   *  READ-BACK — a bare decoded string, not I2's itemised text field — so there
   *  is no segment map to consult even if (1) and (2) were solved. The map
   *  exists only where a producer itemised the container, which for text today
   *  means a PDF's pages and an office container's paragraphs.
   *
   *  What it would take to close this: CONTENT-HTML producing the `dom` arm, and
   *  an offset-preserving unescape so a match's index in the working string maps
   *  back to the served bytes. Both are that area's, neither is this item's, and
   *  the absence is honest until they exist. */
  parse(ctx) {
    const raw = unescapeHtml(String(ctx.text || ""));
    const scope = insideMain(raw);

    /* The window. Read from the control's own value where the page states it, and
       from the dates present as a fallback, because an inferred window is still far
       better than treating every absence as a delisting. `relative` is the fact
       that matters: a named range like "This Month" means the window MOVES. */
    const named = /lstYears_Input"[^>]*\bvalue="([^"]*)"/i.exec(raw);
    /* R41: the first and last of the dates are found as they are met, never by spreading a list of all of them into
       `Math.min`, which throws past about 125,000 arguments. A date that is not a number (`99/99/2026`) makes both ends
       not a number, as `Math.min` and `Math.max` made them. */
    spend(scope.length);
    /** @type {number | null} */
    let first = null;
    /** @type {number | null} */
    let last = null;
    let nan = false;
    for (const d of scope.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)) {
      const t = parseDate(d[0]);
      if (t == null) continue;
      if (t !== t) nan = true;
      const was0 = first, was1 = last;
      if (was0 === null || t < was0) first = t;
      if (was1 === null || t > was1) last = t;
    }
    const lo = first, hi = last;
    const value = named ? named[1] : null;
    if (value === undefined) throw new TypeError("Cannot read properties of undefined (reading 'trim')");
    /** @type {MeetingWindow} */
    const window = {
      named: value !== null ? value.trim() : null,
      relative: value !== null ? /this|next|last|current|upcoming|past|month|year|week/i.test(value) : true,
      from: lo === null ? null : nan ? NaN : lo,
      to: hi === null ? null : nan ? NaN : hi,
    };

    /** @type {Entity[]} */
    const entities = [];
    for (const row of rowsOf(scope)) {
      const id = /MeetingDetail\.aspx\?ID=(\d+)/i.exec(row);
      if (!id) continue;
      const flat = row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      /** @type {Map<string, string | undefined>} */
      const docs = new Map(NO_DOCS);
      for (const d of row.match(/View\.ashx\?M=([A-Za-z]+)&ID=(\d+)[^"'\s]*/gi) || []) {
        const c = /M=([A-Za-z]+)&ID=(\d+)/i.exec(d);
        if (!c) throw new TypeError("Cannot read properties of null (reading '1')");
        const code = c[1];
        if (code === undefined) throw new TypeError("Cannot read properties of undefined (reading 'toUpperCase')");
        /* The ADA variants are the same document in an accessible form, so they are
           not separate documents and their presence is not a separate event. */
        const kind = DOCUMENT_KINDS.get(code.toUpperCase());
        if (kind && !docs.get(kind)) docs.set(kind, c[2]);
      }
      const when = parseDate(flat);
      /* The body is the text before the date, which is how Legistar lays a row out.
         Kept as a fact rather than a key: a committee being renamed is a change
         worth seeing, and it must not silently become a different meeting. */
      /* The status word is stripped OUT of the body name. Legistar writes the
         status into the title text ("Rules and Legislation Committee - CANCELLED"),
         so leaving it in means a cancellation moves two facts at once and reports a
         spurious rename beside the real event. Caught on the real page. */
      const before = flat.split(/\d{1,2}\/\d{1,2}\/\d{4}/)[0];
      if (before === undefined) throw new TypeError("Cannot read properties of undefined (reading 'replace')");
      const body = before
        .replace(/^[*\s]+/, "").replace(/[\s-]*\b(?:CANCELL?ED|RESCHEDULED)\b[\s-]*/gi, " ").trim();
      entities.push(entity(id[1], "meeting", flat.slice(0, 160), {
        body, date: iso(when),
        status: /\bCANCELL?ED\b/i.test(flat) ? "cancelled"
              : /\bRESCHEDULED\b/i.test(flat) ? "rescheduled" : "scheduled",
        agenda: docs.get("agenda") || null, minutes: docs.get("minutes") || null,
      }));
    }
    return { entities, window, at: ctx.at || null };
  },

  /** Given two parses, what actually happened. */
  assess(before, after, ctx) {
    /* A read that found nothing is a failed reader, never an emptied calendar. */
    const a = readingOf(before, MISSING_LENGTH);
    const b = a.entities.length ? readingOf(after, MISSING_LENGTH) : null;
    if (!b || !b.entities.length)
      return { meaningful: null, significance: null, events: [], confirmed: null,
               why: localize("doctypes.meeting-calendar.unread", "the meetings on this calendar could not be read this time, so nothing is claimed about them either way") };

    const d = diffEntities(a.entities, b.entities);
    /** @type {EventHead[]} */
    const events = [];
    const w = b.window;
    /** @param {EntityFact | undefined} dateIso @returns {boolean | null} */
    const inWindow = (dateIso) => {
      const from = w.from, to = w.to;
      if (!dateIso || from == null || to == null) return null;
      const t = Date.parse(dateIso + "T00:00:00Z");
      return t >= from && t <= to;
    };

    /* Every event below is built with event(type, ...), which stamps the significance
       from the shared catalogue (site-profiles' events.mjs) rather than inline here — so the grade
       lives in one place and a typo'd type throws instead of quietly becoming routine.
       `meaningful` and `worst` are then DERIVED from those graded events, never
       carried as separate facts (CONSTRUCTS Step 0 #5, #6). */

    /* GONE: only a delisting if the meeting's date is inside the range the new
       capture actually shows. This is the whole reason this type exists. */
    let scrolled = 0;
    for (const e of d.gone) {
      const within = inWindow(e.facts.date);
      if (within === false) { scrolled++; continue; }
      events.push(event(within === null ? "possibly_delisted" : "delisted",
                    { key: e.key, label: e.label,
                      why: within === null
                        ? localize("doctypes.meeting-calendar.gone_unknown_range", "a meeting is no longer listed, and this calendar's date range could not be read, so whether it simply moved out of view is not established")
                        : localize("doctypes.meeting-calendar.gone_in_range", "a meeting dated inside the range this calendar shows is no longer listed") }));
    }

    for (const alt of d.altered) {
      const f = new Map(alt.moved.map((m) => [m.fact, m]));
      const status = f.get("status"), date = f.get("date"), body = f.get("body");
      if (status) {
        const now = status.now;
        events.push(event(now === "cancelled" ? "cancelled" : now === "rescheduled" ? "rescheduled" : "status_changed",
                      { key: alt.entity.key, label: alt.entity.label, was: status.was, now,
                        why: localize("doctypes.meeting-calendar.status_changed", "a meeting's status changed from {was} to {now}", { was: String(status.was), now: String(now) }) }));
      }
      if (date)
        events.push(event("moved", { key: alt.entity.key, label: alt.entity.label,
                      was: date.was, now: date.now, why: "a meeting's date changed" }));
      if (body)
        events.push(event("renamed", { key: alt.entity.key,
                      was: body.was, now: body.now,
                      why: localize("doctypes.meeting-calendar.renamed", "the body holding a meeting is named differently") }));
      /* A document APPEARING is the normal course of business and is a routine
         event with a temporal connection attached. A document DISAPPEARING or being
         SWAPPED is not: a published agenda or set of minutes that stops being the
         one it was is the quiet substitution, and it is an event. */
      for (const kind of ["agenda", "minutes"]) {
        const moved = f.get(kind);
        if (!moved) continue;
        const { was, now } = moved;
        if (!was && now)
          events.push(event(`${kind}_published`, { key: alt.entity.key, label: alt.entity.label,
                        document: now, why: localize("doctypes.meeting-calendar.published", "{kind} were published for a meeting that had none", { kind }) }));
        else if (was && !now)
          events.push(event(`${kind}_withdrawn`, { key: alt.entity.key, label: alt.entity.label,
                        why: localize("doctypes.meeting-calendar.withdrawn", "{kind} that this calendar previously offered are no longer offered", { kind }) }));
        else
          events.push(event(`${kind}_replaced`, { key: alt.entity.key, label: alt.entity.label,
                        was, now, why: localize("doctypes.meeting-calendar.replaced", "the {kind} document for this meeting is a different document than before", { kind }) }));
      }
    }

    /* A meeting appearing is the calendar doing its job. */
    for (const e of d.appeared)
      events.push(event("scheduled", { key: e.key, label: e.label,
                    why: localize("doctypes.meeting-calendar.added", "a meeting was added to the calendar") }));

    bySeverity(events);
    const worst = worstSignificance(events);
    const meaningful = isMeaningful(events);

    /* The confirmation half, kept even when something did change, because on a
       calendar most of it did not and that is worth saying. */
    const intact = a.entities.filter((e) =>
      b.entities.some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;

    /** @type {string[]} */
    const parts = [];
    if (events.some((e) => e.significance === SIGNIFICANCE.EVENT))
      parts.push(events.filter((e) => e.significance === SIGNIFICANCE.EVENT).length + " needing attention");
    if (scrolled) parts.push(localize("doctypes.meeting-calendar.scrolled", "{count} no longer in the range shown, which is this calendar moving its window", { count: String(scrolled) }));
    if (d.appeared.length) parts.push(`${d.appeared.length} newly listed`);

    return {
      meaningful, significance: worst, events,
      /* What was verified unchanged, or null when nothing was (R16). */
      confirmed: intact ? { entries: b.entities.length, intact, window: w.named || null,
                            scrolled_out: scrolled } : null,
      why: events.length || scrolled
        ? localize("doctypes.meeting-calendar.unchanged_of", "{intact} of {total} meetings unchanged{parts}", { intact: String(intact), total: String(a.entities.length), parts: parts.length ? "; " + parts.join(", ") : "" })
        : localize("doctypes.meeting-calendar.all_unchanged", "all {count} meetings on this calendar are unchanged", { count: String(b.entities.length) }),
    };
  },

  /** What this calendar implies about relationships and about time. */
  connections(before, after, ctx) {
    const b = readingOf(after, MISSING_ITERABLE);
    /** @type {Connection[]} */
    const out = [];
    const given = ctx.now;
    const now = given ? Date.parse(given) : Date.now();
    for (const m of b.entities) {
      const self = `meeting:${m.key}`;
      /* REFERENTIAL: a document belongs to a meeting, and a meeting belongs to a
         body. Claims about scope, followed to understand what a thing is part of. */
      if (m.facts.agenda)
        out.push(referential(`document:${m.facts.agenda}`, self, "is_the_agenda_for",
          localize("doctypes.meeting-calendar.is_agenda", "this document is the agenda for that meeting")));
      if (m.facts.minutes)
        out.push(referential(`document:${m.facts.minutes}`, self, "is_the_minutes_of",
          localize("doctypes.meeting-calendar.is_minutes", "this document records what happened at that meeting")));
      if (m.facts.body)
        out.push(referential(self, `body:${m.facts.body}`, "held_by",
          localize("doctypes.meeting-calendar.held_by", "this meeting was held by that body")));

      /* TEMPORAL: a sequence, and its most useful form is an expected thing that
         has not arrived. A meeting whose date has passed with no minutes is a fact
         about the body rather than a hole in the record, and it carries a date. */
      /* A parse's date is a day as text or null; a date of another kind is read as none. */
      const fact = m.facts.date;
      const date = typeof fact === "string" ? fact : null;
      if (!date) continue;
      const when = Date.parse(date + "T00:00:00Z");
      if (m.facts.status === "cancelled") continue;   // nothing is owed for a meeting that did not happen
      if (m.facts.minutes)
        out.push(temporal(self, `document:${m.facts.minutes}`, "minutes_published_after",
          { at: date, why: localize("doctypes.meeting-calendar.minutes_exist", "minutes for this meeting exist, so the meeting was recorded") }));
      else if (when < now) {
        const due = minutesDue(ctx, date);
        const today = due.due ? localDay(new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"), due.zone) : null;
        out.push(temporal(self, null, "minutes_not_yet_published",
          { at: date, expected_by: due.due,
            why: !due.due
              ? localize("doctypes.meeting-calendar.due_unknown", "this meeting has taken place and no minutes are offered yet; when they are due is not known, because {why}", { why: String("why" in due ? due.why : undefined) })
              : typeof today === "string" && today > due.due
              ? localize("doctypes.meeting-calendar.overdue", "this meeting was held more than {amount} {unit} ago, longer than minutes usually take here (the jurisdiction's measured practice), and this calendar still offers no minutes", { amount: String(due.amount), unit: String(due.unit) })
              : localize("doctypes.meeting-calendar.taken_place", "this meeting has taken place and no minutes are offered yet") }));
      }
      if (!m.facts.agenda && when > now)
        out.push(temporal(self, null, "agenda_not_yet_published",
          { at: date, expected_by: date,
            why: localize("doctypes.meeting-calendar.upcoming", "this meeting is upcoming and no agenda is offered yet") }));
    }
    return out;
  },
};

export default counted(meetingCalendar);
