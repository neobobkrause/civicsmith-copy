/* A meeting agenda: the list of legislation a body will take up, item by item.
 *
 * MEASURED on a real document, per the standing rule that an unmeasured content
 * type is not written: oakland.legistar.com View.ashx?M=A&ID=1425405 (the *Rules
 * & Legislation Committee agenda for 2026-07-16, SUPPLEMENTAL), fetched
 * 2026-08-03 and read through Tier-1 text extraction (60,865 chars, 99.9%
 * decode — the agenda class Tier 1 fully serves, MEASUREMENTS.md CPDF-5).
 * Every rule below points at something in that text:
 *
 *   Each item of legislation carries a FILE NUMBER on its own line ("26-0910"),
 *   41 of them in the document, each unique. This is Legistar's own stable id
 *   for the legislation — the same number the body's minutes, later agendas and
 *   LegislationDetail pages carry — so it is the entity key (an id the source
 *   assigned is a key, framework §7).
 *
 *   An item's description precedes its number as labelled blocks, the label on
 *   its own line and the value on the next: "Subject: / Grand Performance
 *   Mural", "From: / Councilmember Wang", then "Recommendation: ..." inline.
 *   The ITEM NUMBER ("3.1") sits on its own line immediately before the file
 *   number. Section-level items ("2" / "26-0844") have no Subject block; their
 *   heading is the non-furniture line above the item number.
 *
 *   Page furniture repeats through the text ("Page 12", "City of Oakland",
 *   "Printed on 7/15/2026 ...", the meeting date, the body name, the "Agenda"
 *   banner) and can fall BETWEEN an item's description and its file number at a
 *   page break, so nothing here assumes a block is contiguous.
 *
 *   The meeting date is the document's first line ("Thursday, July 16, 2026")
 *   and the body name repeats as a header line ("*Rules & Legislation
 *   Committee").
 *
 * WHY THIS TYPE MATTERS. The agenda is the document class the citation graph is
 * keyed on (MEASUREMENTS: the agenda decodes free; the substance it links to is
 * where Tier 1 stops), and its file numbers are the references that connect a
 * meeting to the legislation it took up. A reading of an agenda is therefore a
 * list of legislation references — nothing more is claimed. What the body DID
 * with each item is the minutes' business, not the agenda's.
 */
import { CONFIDENCE, CONTRACT, entity, readAgain, diffEntities, FURNITURE_RECURS, alsoSatisfies,
         vocabPatterns, anyMatch, LINE_END } from "../docprofile/doctypes/index.mjs";
import { eachLine, countLines, lineTable, counted, spend } from "./windows.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, Entity } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/events.mjs" */

/**
 * What `detect` answers: whether this is an agenda, how sure, and on what signals.
 * @typedef {Object} AgendaDetection
 * @property {boolean} match
 * @property {string} confidence
 * @property {string[]} [signals]
 */
/**
 * What `parse` answers: the meeting's own facts, each null where it was not read, and one entity per item.
 * @typedef {Object} AgendaReading
 * @property {Entity[]} entities
 * @property {string | null} body
 * @property {string | null} body_why
 * @property {string | null} date
 * @property {string | null} references_why
 * @property {string[]} also_satisfies
 * @property {string | null} at
 */
/**
 * What `assess` answers for two readings: the graded events, whether they mean something, and what was confirmed.
 * @typedef {Object} AgendaAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {{ entries: number, intact: number } | null} confirmed
 * @property {string} why
 */
/**
 * The meeting-agenda content type.
 * @typedef {Object} MeetingAgendaType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => AgendaDetection} detect
 * @property {(ctx: DoctypeContext) => AgendaReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => AgendaAssessment} assess
 */

/** Group `i` of a match, which the pattern makes take part whenever it matches.
 *  @param {ArrayLike<string | undefined>} m @param {number} i @returns {string}
 *  @throws {TypeError} when the group took no part */
const agendaGroup = (m, i) => {
  const g = m[i];
  if (g === undefined) throw new TypeError(`meeting_agenda: group ${i} of a match took no part`);
  return g;
};

/** Whether `v` is a reading of an agenda as far as `assess` reads one: it carries its entities.
 *  @param {object | null | undefined} v @returns {v is AgendaReading} */
const isAgendaReading = (v) => v != null && "entities" in v && Array.isArray(v.entities);

/* The legislative record's file number, alone on its line. Its SHAPE is the
   jurisdiction's (Legistar's two-digit-year–dash–serial in the measured instance)
   and comes from the view's `file_numbers` (N3); only the line anchoring is this
   reader's. Line-anchored on purpose — an inline mention inside a recommendation's
   prose is a cross-reference, not an item on THIS agenda, and the measured document
   carries each item's number on its own line exactly once. */
/** @param {DoctypeContext} ctx @returns {RegExp[]} */
const agendaFileLines = (ctx) => vocabPatterns(ctx, "file_numbers", (re) => `^\\s*(${re})\\s*$`);
/** @param {ReadonlyArray<RegExp>} pats @param {string} line @returns {string | null | undefined} */
const agendaFileKey = (pats, line) => {
  for (const re of pats) { const m = re.exec(line); if (m) return m[1]; }
  return null;
};
const ITEM_LINE = /^\d+(?:\.\d+)*$/;

/* The agenda's own masthead, line-anchored. The measured packet's is ` Agenda -
   SUPPLEMENTAL`, repeated on all 33 pages; a plain `Agenda` and the clerk's other
   qualifiers (`- FINAL`, `- REVISED`) take the same shape. `Meeting Agenda` is the
   spelling other Legistar instances use. It deliberately does NOT match a sentence
   containing the word — see `detect`. */
const AGENDA_MASTHEAD = /^(?:Meeting\s+)?Agenda(?:\s*[-–—]\s*\S.*)?$/i;

/* The page furniture the measured document repeats; skipped when scanning back
   for a section heading. Deliberately narrow: an unrecognised line is treated as
   substance (the conservative direction), not as furniture. What stays here is
   what any clerk's print carries (a page number, a print stamp, the masthead, a
   date line, the record system's own field labels); the jurisdiction's and its
   offices' names, and its record's link labels, are the view's `furniture` (N3). */
const FURNITURE = [
  /^Page \d+$/i,
  /^Printed on /i,
  /^Agenda(?:\s*-.*)?$/i,
  /^View Report$/i,
  /^Attachments:$/i,
  /^Sponsors:$/i,
  /^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4}$/,
];
/** @param {DoctypeContext} ctx @returns {(l: string) => boolean} */
const agendaFurniture = (ctx) => {
  const local = vocabPatterns(ctx, "furniture");
  return (l) => FURNITURE.some((re) => re.test(l)) || anyMatch(local, l);
};

/** @type {{ readonly [month: string]: number }} */
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
                 august: 7, september: 8, october: 9, november: 10, december: 11 };
/** @param {string | null | undefined} s @returns {string | null} */
const parseLongDate = (s) => {
  const m = /([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(String(s || ""));
  if (!m) return null;
  const mo = MONTHS[agendaGroup(m, 1).toLowerCase()];
  if (mo == null) return null;
  return new Date(Date.UTC(+agendaGroup(m, 3), mo, +agendaGroup(m, 2))).toISOString().slice(0, 10);
};

/** @type {MeetingAgendaType} */
const meetingAgendaType = {
  key: "meeting_agenda",
  label: "a meeting agenda",
  version: 1,
  /* A list of items, so what matters is its MEMBERSHIP — which legislation is
     before the body and whether each item still says what it said. Declared on
     the content type (CONSTRUCTS Step 0 #4). */
  contract: CONTRACT.MEMBERSHIP,

  /** CORRECTED 2026-09-15 (FW-18), and the correction is a MEASURED DEFECT rather
   *  than a tidy-up. This rule used to take `/\bAgenda\b/i` — the word ANYWHERE in
   *  the text — as "an agenda heading", and on that basis it read TWO REAL SETS OF
   *  OAKLAND MEETING MINUTES as `meeting_agenda` at CERTAIN confidence:
   *
   *    9569_M__Rules___Legislation_Committee_26-07-16_Meeting_Minutes.pdf and
   *    9560_M___Concurrent_Meeting_..._City_Council_26-07-21_Meeting_Minutes.pdf,
   *
   *  both fetched and read through Tier-1 on 2026-09-15. Minutes carry the same
   *  line-anchored file numbers and the same `Subject:`/`Recommendation:` blocks as
   *  the agenda of the same meeting, so two of the three legs were already satisfied
   *  structurally; the third was satisfied by the phrase `On The July 21, 2026 City
   *  Council Agenda On Consent`, which appears against nearly every item. That is a
   *  REFERENCE to an agenda read as MEMBERSHIP of the class — exactly the one defect
   *  class all five of M0-32's own recogniser errors fell into, and the record
   *  claiming more than it could support on a whole class of document.
   *
   *  THE FIX IS A RATE, NOT A LONGER LIST OF WORDS. A document's self-naming is in
   *  its MASTHEAD and a masthead is page furniture: it recurs once per page (33
   *  times over the 33 pages of the measured agenda). A reference occurs once or
   *  twice. The minutes above carry 2 line-anchored `Agenda` lines — and both are the
   *  wrapped tails of attachment titles, `Draft July 28, 2026 Cancelled Finance And
   *  Management Committee` / `Agenda` — so even line anchoring alone would not have
   *  saved this; the threshold is what does. `selfNaming` in ./index.mjs carries the
   *  measurement.
   *
   *  THE LIKELY PATH IS KEPT AND WIDENED RATHER THAN NARROWED, because a one-page
   *  agenda names itself once and a fence tighter than its rule is not a safer fence. */
  detect(ctx) {
    const t = String(ctx.text || "");
    /** @type {string[]} */
    const signals = [];
    /* Line-anchored file numbers are the definitive signal: HTML never carries
       them alone on a line, and a staff report about ONE file does not list
       them item after item. */
    const filePats = agendaFileLines(ctx);
    /* R37: the lines are walked one at a time (./windows.mjs), never split into a list of all of them. */
    let files = 0;
    eachLine(t, (l) => { if (agendaFileKey(filePats, l) != null) files++; });
    if (files) signals.push(localize("doctypes.meeting-agenda.file_lines", "{count} legislation file number line(s)", { count: String(files) }));
    spend(t.length * 3);   // the tests of the text below ("Subject:", "Recommendation:", "Roll Call") each read it once at most
    if (/\bSubject:/.test(t) && /\bRecommendation:/.test(t))
      signals.push("Subject:/Recommendation: item blocks");
    const named = countLines(t, AGENDA_MASTHEAD);
    const furniture = named >= FURNITURE_RECURS;
    if (furniture) signals.push(localize("doctypes.meeting-agenda.self_naming_furniture", "names itself as an agenda on {count} lines, which is page furniture", { count: String(named) }));
    else if (named) signals.push(localize("doctypes.meeting-agenda.self_naming_once", "names itself as an agenda once ({count}), which a reference also does", { count: String(named) }));
    /* Front matter: a roll call, or a line the jurisdiction's own furniture names
       (its clerk's office, in the measured instance). */
    const isFurn = agendaFurniture(ctx);
    if (/Roll Call/i.test(t) || eachLine(t, (l) => { const x = l.trim(); return !!x && !FURNITURE.some((re) => re.test(x)) && isFurn(x); }))
      signals.push("meeting front matter");
    /* CERTAIN needs the file-number lines AND the item blocks AND the masthead at
       furniture rate — all three measured on the real packet, where the masthead
       ` Agenda - SUPPLEMENTAL` recurs on every one of 33 pages. */
    if (files && signals.includes("Subject:/Recommendation: item blocks") && furniture)
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    /* LIKELY on the evidence a ONE-PAGE agenda can produce: it names itself at least
       once and two other families fired. A document that never names itself as an
       agenda at all is not one, however many file numbers it lists — which is what
       the minutes proved. */
    if (named >= 1 && signals.length >= 3)
      return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    return { match: false, confidence: CONFIDENCE.NONE };
  },

  /** What is in it: the meeting's own facts, and one entity per item of
   *  legislation, keyed by the source-assigned file number.
   *
   *  FW-17 / IC-86 — THIS READER CAN SAY WHERE, and says so here because a
   *  reader's silence and a reader's honest null are indistinguishable at the
   *  wire. Every reference it emits is a file number that sat ALONE ON ITS OWN
   *  LINE, so the offset of that line is exactly the offset of the reference,
   *  and `ctx.locate` turns it into the page (or paragraph) the container put it
   *  on. What it CANNOT say is the rectangle: Tier-1 text is a flat per-page
   *  string with no geometry, so the `pdf-page` arm arrives with `rect: null`
   *  and the page is the honest maximum.
   *
   *  It says where the REFERENCE was read, not where the item's description
   *  was. The two differ: the measured document's page furniture falls BETWEEN
   *  a description and its file number at a page break, so a Subject: block can
   *  sit on page 11 and the number it belongs to on page 12. The file number is
   *  the reference an edge points at and the connection is drawn through, so its
   *  position is the one recorded; recording the description's would make the
   *  address disagree with the thing addressed. */
  parse(ctx) {
    const raw = String(ctx.text || "");
    /* The lines, trimmed, held as offsets into the text (R37), a line cut from it when it is read. `L.start(i)` is the
       start offset of each line IN THE UNSPLIT TEXT, which is the only coordinate `ctx.locate` understands. Derived
       from the separators the split actually matched rather than from `length + 1`: a CRLF document would
       drift one character per line under the arithmetic, and a drift that grows
       silently down a 40,000-line packet is exactly the class of wrong address
       this whole item exists to avoid. */
    const L = lineTable(raw);
    /* Always a function: `readText` supplies one, and a direct caller that does
       not gets the honest null rather than a TypeError. */
    const given = ctx.locate;
    const locate = typeof given === "function" ? given : () => null;

    /* The meeting's facts. Date: the first long-form date line (the measured
       document opens with it). Body: the first header-ish line naming a body.
       Both may honestly be null — an unread fact is never invented. */
    /* Which words name a body, and which title marks a member rather than a body,
       are the jurisdiction's (`bodies`, `member_titles`, N3). With none supplied the
       body is not read, and `body_why` says so. */
    const bodyEnds = vocabPatterns(ctx, "bodies", LINE_END);
    const memberTitles = vocabPatterns(ctx, "member_titles");
    /** @type {string | null} */ let date = null;
    /** @type {string | null} */ let body = null;
    for (let i = 0; i < Math.min(L.length, 60); i++) {
      const l = L.get(i) ?? "";
      if (!date && /^[A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}$/.test(l)) date = parseLongDate(l);
      if (!body && anyMatch(bodyEnds, l) && !anyMatch(memberTitles, l))
        body = l.replace(/^[*\s]+/, "").trim() || null;
      if (date && body) break;
    }
    const body_why = body ? null
      : bodyEnds.length ? localize("doctypes.meeting-agenda.no_body_line", "no line at the head of this agenda names a body in the words the active jurisdiction profiles give")
      : localize("doctypes.meeting-agenda.no_body_profile", "no active jurisdiction profile says how a body is named, so which body meets is not read");
    const filePats = agendaFileLines(ctx);
    const isFurniture = agendaFurniture(ctx);

    /** @type {Entity[]} */
    const entities = [];
    /* D-454: key -> the entity, so a repeat is recorded as another occurrence (`readAgain`). */
    /** @type {Map<string, Entity>} */
    const seen = new Map(/** @type {Array<[string, Entity]>} */ ([]));
    /** @type {string | null} */ let pendingSubject = null;
    /** @type {string | null} */ let pendingFrom = null;
    /** @type {string | null} */ let expect = null;
    for (let i = 0; i < L.length; i++) {
      const line = L.get(i);
      if (!line) continue;
      /* Labelled blocks: the label sits on its own line and the value follows
         (measured), or the value rides the label's own line. */
      const lab = /^(Subject|From):\s*(.*)$/.exec(line);
      if (lab) {
        const name = agendaGroup(lab, 1), said = agendaGroup(lab, 2);
        if (said) { if (name === "Subject") pendingSubject = said; else pendingFrom = said; expect = null; }
        else expect = name;
        continue;
      }
      const wanted = expect;
      if (wanted) {
        if (wanted === "Subject") pendingSubject = line; else pendingFrom = line;
        expect = null;
        continue;
      }
      const key = agendaFileKey(filePats, line);
      if (key == null) continue;
      /* The same file listed twice is one item of legislation; first mention
         carries the description in the measured layout. */
      if (seen.has(key)) { readAgain(seen.get(key), locate(L.start(i))); continue; }
      /* The item number immediately precedes the file line; a section item with
         no Subject block takes its heading from the nearest substantive line
         above the item number. */
      /** @type {string | null} */ let item = null;
      /** @type {string | null} */ let heading = null;
      for (let j = i - 1, hops = 0; j >= 0 && hops < 8; j--) {
        const prev = L.get(j);
        if (!prev) continue;
        hops++;
        if (item == null && ITEM_LINE.test(prev)) { item = prev; continue; }
        const prevFile = agendaFileKey(filePats, prev) != null;
        if (isFurniture(prev) || prevFile) { if (prevFile) break; continue; }
        heading = prev;
        break;
      }
      const label = pendingSubject || heading || `legislation ${key}`;
      const made = entity(key, "legislation", String(label).slice(0, 160), {
        subject: pendingSubject || null,
        from: pendingFrom || null,
        item: item || null,
      }, locate(L.start(i)));
      entities.push(made);
      seen.set(key, made);
      pendingSubject = null; pendingFrom = null;
    }

    /* FW-18 / M0-32: 52 of 600 sampled documents satisfied MORE THAN ONE class —
       Oakland publishes agenda packets that genuinely contain an agenda, its staff
       reports and its draft resolutions. Stated as a document fact so a packet read
       as an agenda does not let that single verdict stand for the whole document. */
    return { entities, body, body_why, date,
             references_why: filePats.length ? null
               : localize("doctypes.meeting-agenda.no_file_shape", "no active jurisdiction profile gives the shape of its legislative record's file numbers, so no item was read"),
             also_satisfies: alsoSatisfies(ctx, "meeting_agenda"),
             at: ctx.at || null };
  },

  /** Given two parses of the same agenda address, what happened to the list. */
  assess(a, b) {
    /* A read that found nothing is a failed reader, never an emptied agenda. Each reading is checked where it is
       first read, so a first reading with no entities answers before the second is looked at. */
    /** @returns {AgendaAssessment} */
    const unread = () => ({ meaningful: null, significance: null, events: [], confirmed: null,
               why: localize("doctypes.meeting-agenda.unread", "the items on this agenda could not be read this time, so nothing is claimed about them either way") });
    if (!isAgendaReading(a)) throw new TypeError("meeting_agenda: assess was handed no reading of an agenda before");
    if (!a.entities.length) return unread();
    if (!isAgendaReading(b)) throw new TypeError("meeting_agenda: assess was handed no reading of an agenda after");
    if (!b.entities.length) return unread();

    const d = diffEntities(a.entities, b.entities);
    /** @type {EventHead[]} */
    const events = [];
    /* An item REMOVED from a published agenda is the quiet-substitution class:
       the document still answers at the same address and no longer offers what
       it offered. There is no moving window here to excuse it (the calendar's
       lesson does not transfer: an agenda is one meeting's list, not a range). */
    for (const e of d.gone)
      events.push(event("item_pulled", { key: e.key, label: e.label,
        why: localize("doctypes.meeting-agenda.pulled", "an item of legislation this agenda listed is no longer on it") }));
    for (const alt of d.altered)
      events.push(event("item_changed", { key: alt.entity.key, label: alt.entity.label,
        moved: alt.moved,
        why: localize("doctypes.meeting-agenda.altered", "what this agenda says about an item changed") }));
    /* Items arriving is what a supplemental agenda IS (the measured document is
       one); routine, and recorded. */
    for (const e of d.appeared)
      events.push(event("item_added", { key: e.key, label: e.label,
        why: localize("doctypes.meeting-agenda.added", "an item of legislation was added to this agenda") }));

    bySeverity(events);
    const intact = a.entities.filter((e) =>
      b.entities.some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events,
      /* What was verified unchanged, or null when nothing was (R16). */
      confirmed: intact ? { entries: b.entities.length, intact } : null,
      why: events.length
        ? localize("doctypes.meeting-agenda.changes", "{intact} of {total} items unchanged; {pulled} pulled, {added} added, {altered} altered", { intact: String(intact), total: String(a.entities.length), pulled: String(d.gone.length), added: String(d.appeared.length), altered: String(d.altered.length) })
        : localize("doctypes.meeting-agenda.unchanged", "all {count} items on this agenda are unchanged", { count: String(b.entities.length) }),
    };
  },
};

export default counted(meetingAgendaType);
