/* The shared event catalogue, and significance graded ONCE.
 *
 * CONSTRUCTS Step 0, collisions #5 and #6. Before this, a content type invented its
 * own event-type strings inline (`delisted`, `cancelled`, `minutes_replaced`, ...)
 * and stamped a significance beside each push site by hand, and `meaningful` was a
 * second boolean carried alongside the significance it could have been derived from.
 * Both are the lesson the plane's check catalogue already taught: a vocabulary with
 * no registry is a vocabulary that the second author either duplicates or contradicts.
 *
 * So every event a content type can emit is named here ONCE, with its significance,
 * and a content type draws its events from `event()` rather than writing the string
 * and the grade itself. A second content type either reuses these types or extends
 * the catalogue in this one place.
 */

/* How much a member should be troubled, ordered so a report leads with the worst
   thing rather than the first thing. */
export const SIGNIFICANCE = { EVENT: "event", NOTICE: "notice", ROUTINE: "routine" };
const SIG_RANK = { routine: 0, notice: 1, event: 2 };
/** Where a significance sits, for ordering and for deriving `meaningful`. */
export function significanceRank(s) { return typeof s === "string" && Object.hasOwn(SIG_RANK, s) ? SIG_RANK[s] : -1; }

/* The catalogue. Each entry names the fixed significance of that kind of event.
   Document events come in agenda/ and minutes/ pairs because the two are the same
   shape of thing arriving on the same clock. */
export const EVENTS = {
  /* a public record removed from a public list, or one that cannot be told apart
     from that because the window could not be read — close to the reason BIO exists */
  delisted:          { significance: SIGNIFICANCE.EVENT },
  possibly_delisted: { significance: SIGNIFICANCE.EVENT },
  /* a meeting's own status, date or a swapped/withdrawn document: things a member
     watching that body needs to see */
  cancelled:         { significance: SIGNIFICANCE.EVENT },
  rescheduled:       { significance: SIGNIFICANCE.EVENT },
  status_changed:    { significance: SIGNIFICANCE.EVENT },
  moved:             { significance: SIGNIFICANCE.EVENT },
  agenda_withdrawn:  { significance: SIGNIFICANCE.EVENT },
  minutes_withdrawn: { significance: SIGNIFICANCE.EVENT },
  agenda_replaced:   { significance: SIGNIFICANCE.EVENT },
  minutes_replaced:  { significance: SIGNIFICANCE.EVENT },
  /* the body holding a meeting is named differently: worth showing, not an alarm */
  renamed:           { significance: SIGNIFICANCE.NOTICE },
  /* the list doing its job: a new meeting, or a document arriving on schedule */
  scheduled:         { significance: SIGNIFICANCE.ROUTINE },
  agenda_published:  { significance: SIGNIFICANCE.ROUTINE },
  minutes_published: { significance: SIGNIFICANCE.ROUTINE },
  /* the meeting_agenda type (FW-15): an item of legislation removed from a
     published agenda is the quiet-substitution class; its wording moving is
     worth showing; items arriving is what a supplemental agenda is */
  item_pulled:       { significance: SIGNIFICANCE.EVENT },
  item_changed:      { significance: SIGNIFICANCE.NOTICE },
  item_added:        { significance: SIGNIFICANCE.ROUTINE },
  /* FW-18's three readers. Each row is here rather than inline because `event()`
     throws on a type the catalogue does not hold, which is the mechanism that
     stopped the three earlier types inventing their own strings.

     WHAT A PUBLISHED RECORD OF A PAST ACT CHANGING MEANS, and why these sit at
     EVENT rather than NOTICE. `item_changed` (NOTICE) grades a change to what a
     body says it WILL consider — an agenda is a forward-looking notice and it is
     expected to move. The three below grade a change to what a body is recorded
     as having ALREADY DONE, what staff already recommended, and what an
     instrument of law already says. Those are the record's own subject: a member
     who cited the recorded outcome of a vote, or the recommendation a report
     made, has cited something that is not supposed to move afterwards. Grading
     them as routine drift would be the record reassuring a member about the one
     thing it exists to hold. */
  outcome_changed:        { significance: SIGNIFICANCE.EVENT },
  recommendation_changed: { significance: SIGNIFICANCE.EVENT },
  instrument_changed:     { significance: SIGNIFICANCE.EVENT },
  /* The generic type's one event: the substance of a document of no recognised type
     changed. It is an EVENT because nothing narrower can be said, and the failure
     asymmetry reports rather than reassures. It lets `meaningful` be derived from the
     events for the generic type too, never asserted beside them (R14). */
  substance_changed:      { significance: SIGNIFICANCE.EVENT },
};

/** Build an event, drawing its significance from the catalogue so the grade lives in
 *  ONE place. An unknown type throws rather than defaulting: a silently-routine typo
 *  is exactly the miscarriage the catalogue exists to prevent, and a new event type
 *  is a deliberate addition to the catalogue above, not an inline string. */
export function event(type, detail) {
  const spec = typeof type === "string" && Object.hasOwn(EVENTS, type) ? EVENTS[type] : null;
  if (!spec) throw new Error(`site-profiles: unknown event type "${type}" — add it to the catalogue in events.mjs`);
  /* The detail never regrades: type and significance are the catalogue's, whatever
     the detail carries, and keep their place first. */
  const out = { type, significance: spec.significance, ...(detail && typeof detail === "object" ? detail : {}) };
  out.type = type; out.significance = spec.significance;
  return out;
}

/** The worst significance among a set of events, or null when there are none. */
export function worstSignificance(events) {
  /* A significance outside the catalogue ranks below routine and is never the worst:
     only `event()` grades, so such an entry was not built from the catalogue. */
  let worst = null;
  for (const e of events) {
    const s = e && e.significance;
    if (significanceRank(s) >= 0 && (worst === null || significanceRank(s) > significanceRank(worst))) worst = s;
  }
  return worst;
}

/** `meaningful` is DERIVED, never a second fact carried beside the grade: a change is
 *  meaningful exactly when its worst event rises to EVENT. (CONSTRUCTS Step 0 #6) */
export function isMeaningful(events) {
  return worstSignificance(events) === SIGNIFICANCE.EVENT;
}

/** Sort events worst-first, in place, so a report leads with the heaviest thing. */
export function bySeverity(events) {
  return events.sort((a, b) => significanceRank(b && b.significance) - significanceRank(a && a.significance));
}
