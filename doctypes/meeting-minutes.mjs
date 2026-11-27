/* Meeting minutes: what a body DID, item by item, after the meeting.
 *
 * FW-18, the FIRST class in M0-32's measured order (`MEASUREMENTS.md` M-18;
 * `EXTRACTION-BREADTH-DESIGN.md` §2's table, row 1). The census scaled a 600-document
 * fixed-seed body sample to a 44,076-item population and settled the order with a
 * PAIRED comparison: minutes ~2,617 (+/-673) do not separate from staff reports
 * (z = 0.78) and do separate from ordinances (z = 2.27). §2's standing rule —
 * *minutes first unless the count says otherwise* — therefore holds because the count
 * DECLINED TO OVERTURN IT, which is a stronger reason than a default never tested.
 *
 * MEASURED ON REAL DOCUMENTS, per the standing rule that an unmeasured content type is
 * not written. Two, fetched and read through the plane's own Tier-1 extraction
 * (`bio-plane/src/pdfstructure.mjs`) and flattened by `readtext.mjs`'s own
 * `flattenText`, so every rule below points at text a reader will actually be handed:
 *
 *   A · oakland.legistar1.com/oakland/meetings/2026/7/9569_M__Rules___Legislation_
 *       Committee_26-07-16_Meeting_Minutes.pdf — the *Rules & Legislation Committee,
 *       2026-07-16. 198,543 bytes, 25 pages, 42,065 characters decoded, 15 undetermined.
 *   B · .../9560_M___Concurrent_Meeting_of_the_Oakland_Redevelopment_Successor_Agency_
 *       and_the_City_Council_26-07-21_Meeting_Minutes.pdf — the Council, 2026-07-21.
 *       259,438 bytes, 37 pages, 59,049 characters, 35 undetermined.
 *
 * DOCUMENT A IS THE MINUTES OF THE MEETING WHOSE AGENDA `meeting_agenda` WAS MEASURED
 * ON (View.ashx?M=A&ID=1425405, the same body on the same date), and that is the point
 * of taking minutes first: both carry the SAME 41 legislation file numbers, so the
 * agenda->minutes progression Part I §8.2 names is the first one the record can close
 * from two readings of its own rather than from one reading and an assumption.
 *
 * WHAT THE DOCUMENTS ACTUALLY LOOK LIKE. Every rule below cites one of these.
 *
 *   The masthead line `Meeting Minutes - DRAFT` repeats as page furniture: 25 times in
 *   A, 37 in B — once per page. THAT RATE IS THE TYPE'S DEFINITIVE SIGNAL and the
 *   reason it is a rate; see `selfNaming` in ./index.mjs for the measurement that
 *   forced it.
 *
 *   The retrospective frame opens and closes the document: `The Oakland City Council
 *   Rules And Legislation Committee Convened At 10:30 A.M.` and `There Being No Further
 *   Business, The ... Committee Adjourned The Meeting At 11:02 A.M.`
 *
 *   The attendance roster follows the roll call as a NAME LINE then a LABEL then a
 *   COUNT, each on its own line: `Rowena Brown, Janani Ramachandran, and Kevin Jenkins`
 *   / `Present` / `3 - `, then `Carroll Fife` / `Excused` / `1 - `.
 *
 *   Each item carries its Legistar FILE NUMBER alone on a line (`26-0910`), 41 of them
 *   in A and 61 in B, exactly as the agenda does, preceded by the same `Subject:` /
 *   `From:` / `Recommendation:` blocks. WHAT THE MINUTES ADD IS THE OUTCOME, and it
 *   follows the file number in one of two shapes:
 *
 *     a MOTION block — `A motion was made by Rowena Brown, seconded by Janani
 *     Ramachandran, that this matter be Accepted. The motion carried by the following
 *     vote:` then `Aye:` / names / `3 - `, `Excused:` / names / `1 - `, `NO VOTE:` / `0`;
 *
 *     a DISPOSITION line — `This City Resolution be Scheduled.to go before the *
 *     Concurrent Meeting ... to be heard 7/21/2026`, or `This Informational Report be
 *     Received and Filed.`
 *
 *   Page furniture falls BETWEEN an item's parts at a page break, exactly as it does in
 *   the agenda, so nothing here assumes a block is contiguous.
 *
 * WHY THIS TYPE MATTERS, and what it does NOT claim. The agenda says what a body would
 * consider; the minutes say what it decided. A reading of minutes is therefore a list
 * of legislation references EACH CARRYING THE RECORDED OUTCOME — and nothing more. It
 * does not interpret the outcome, does not decide whether a vote was proper, and does
 * not treat a draft as final: `Meeting Minutes - DRAFT` is recorded as a fact so a
 * member can see that the record they are citing is one the body has not yet approved.
 */
import { CONFIDENCE, CONTRACT, entity, readAgain, diffEntities, flatten, FURNITURE_RECURS, alsoSatisfies,
         vocabPatterns, anyMatch, LINE_END } from "../docprofile/doctypes/index.mjs";
import { scanFlatMany, flatFirst, countLines, lineTable, counted } from "./windows.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, Entity } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/events.mjs" */

/**
 * What `detect` answers: whether this is a set of minutes, how sure, and on what signals.
 * @typedef {Object} MinutesDetection
 * @property {boolean} match
 * @property {string} confidence
 * @property {string[]} [signals]
 */
/**
 * Who attended, by attendance label (`present`, `excused`, ...): the names line the clerk set above the label.
 * @typedef {{ [label: string]: string }} MinutesRoster
 */
/**
 * A recorded vote: each tally label with the count the clerk set after it.
 * @typedef {{ [arm: string]: number }} MinutesVote
 */
/**
 * What `parse` answers: the meeting's own facts, each null where it was not read, and one entity per matter.
 * @typedef {Object} MinutesReading
 * @property {Entity[]} entities
 * @property {string | null} body
 * @property {string | null} body_why
 * @property {string | null} date
 * @property {string | null} convened
 * @property {string | null} adjourned
 * @property {string | null} status
 * @property {string | null} references_why
 * @property {MinutesRoster | null} attendance
 * @property {string[]} also_satisfies
 * @property {string | null} at
 */
/**
 * What `assess` answers for two readings: the graded events, whether they mean something, and what was confirmed.
 * @typedef {Object} MinutesAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {{ entries: number, intact: number } | null} confirmed
 * @property {string} why
 */
/**
 * The meeting-minutes content type.
 * @typedef {Object} MeetingMinutesType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => MinutesDetection} detect
 * @property {(ctx: DoctypeContext) => MinutesReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => MinutesAssessment} assess
 */

/** Group `i` of a match, which the pattern makes take part whenever it matches.
 *  @param {ArrayLike<string | undefined>} m @param {number} i @returns {string}
 *  @throws {TypeError} when the group took no part */
const minutesGroup = (m, i) => {
  const g = m[i];
  if (g === undefined) throw new TypeError(`meeting_minutes: group ${i} of a match took no part`);
  return g;
};

/** Whether `v` is a reading of minutes as far as `assess` reads one: it carries its entities.
 *  @param {object | null | undefined} v @returns {v is MinutesReading} */
const isMinutesReading = (v) => v != null && "entities" in v && Array.isArray(v.entities);

/* The masthead, line-anchored. `Meeting Minutes`, `Minutes`, either followed by a
   qualifier the clerk appends (`- DRAFT`, `- FINAL`, `- Approved`). NOT a sentence
   containing the word: `There Are No Minutes To Be Approved` is an AGENDA's line and
   must not match, which line anchoring alone settles. */
const MINUTES_MASTHEAD = /^(?:Meeting\s+)?Minutes(?:\s*[-–—]\s*\S.*)?$/i;

/* The legislative record's file number alone on its line. Same rule as the agenda's and
   for the same reason: an inline mention inside a recommendation's prose is a
   cross-reference, not an item of THIS meeting. Its SHAPE is the view's `file_numbers`
   (N3). Named differently from the agenda's helpers because the plane's bundle
   (`bio-plane/dist/bio-plane.bundled.mjs`) puts every doctype in ONE scope, and a
   duplicate top-level name there is a runtime collision the bundler refuses. */
/** @param {DoctypeContext} ctx @returns {RegExp[]} */
const minutesFileLines = (ctx) => vocabPatterns(ctx, "file_numbers", (re) => `^\\s*(${re})\\s*$`);
/** @param {ReadonlyArray<RegExp>} pats @param {string} line @returns {string | null | undefined} */
const minutesFileKey = (pats, line) => {
  for (const re of pats) { const m = re.exec(line); if (m) return m[1]; }
  return null;
};
/* An agenda item number. It starts at ONE — `0` alone on a line is the tally under a
   `NO VOTE:` label, and admitting it made the Council's minutes report `item: "0"` for
   every matter that followed a recorded vote. Items are numbered from 1; a zero is
   arithmetic. */
const MINUTES_ITEM_LINE = /^[1-9]\d*(?:\.\d+)*$/;

/* Outcome language, matched over the FLATTENED text because these phrases wrap. */
const MOTION_MADE = /\bA motion was made by\b/i;
const MOTION_RESULT = /\bThe motion (carried|failed)\b/i;
/* A roll-call tally label. `Aye`/`Noe`/`No`/`Abstain`/`Excused`/`Absent` followed by a
   colon, which is how the clerk emits each arm of the vote. */
const TALLY_LABEL = /\b(Aye|Ayes|Noe|Noes|No|Abstain|Abstained|Excused|Absent|Recused)\s*:/i;
/* The retrospective frame: a meeting that CONVENED and one that ADJOURNED at a time. */
/* Case-INSENSITIVE, and the flag is load-bearing rather than defensive: the measured
   documents are set in title case (`Convened At 10:30 A.M.`), and without the flag
   this family silently never fired on either of them. Found by driving the reader over
   the documents, not by reading it back. */
const CONVENED = /\bconvened\s+at\s+\d{1,2}:\d{2}\s*[AaPp]\.?\s*[Mm]\.?/i;
const ADJOURNED = /\badjourned\b[^.]{0,80}?\bat\s+\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?/i;
/* An attendance label alone on its line, which is how the roster is laid out. */
const ROSTER_LABEL = /^(Present|Absent|Excused|Abstained|Recused)$/i;

/* Page furniture skipped when scanning back for an item's heading. Deliberately narrow:
   an unrecognised line is treated as substance, which is the conservative direction.
   What stays here is what any clerk's print carries; the jurisdiction's and its
   offices' names, and its record's link labels, are the view's `furniture` (N3). */
const MINUTES_FURNITURE = [
  /^Page \d+$/i,
  /^Printed on /i,
  /^View Report$/i,
  /^View Legislation$/i,
  /^View (Attachment|Supplemental)\b/i,
  /^Attachments:$/i,
  /^Sponsors:$/i,
  MINUTES_MASTHEAD,
  /^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4}$/,
  /^[A-Z][a-z]+ \d{1,2}, \d{4}$/,
];
/** @param {DoctypeContext} ctx @returns {(l: string) => boolean} */
const minutesFurniture = (ctx) => {
  const local = vocabPatterns(ctx, "furniture");
  return (l) => MINUTES_FURNITURE.some((re) => re.test(l)) || anyMatch(local, l);
};

/** @type {{ readonly [month: string]: number }} */
const MINUTES_MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
                         august: 7, september: 8, october: 9, november: 10, december: 11 };
/** @param {string | null | undefined} s @returns {string | null} */
const minutesLongDate = (s) => {
  const m = /([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(String(s || ""));
  if (!m) return null;
  const mo = MINUTES_MONTHS[minutesGroup(m, 1).toLowerCase()];
  if (mo == null) return null;
  return new Date(Date.UTC(+minutesGroup(m, 3), mo, +minutesGroup(m, 2))).toISOString().slice(0, 10);
};
/** @param {string} text @param {RegExp} re @returns {string | null} */
const clockOf = (text, re) => { const h = flatFirst(text, re); return h ? minutesGroup(h.m, 0) : null; };

/** @type {MeetingMinutesType} */
const meetingMinutesType = {
  key: "meeting_minutes",
  label: localize("doctypes.meeting-minutes.label", "a set of meeting minutes"),
  version: 1,
  /* A list of items, each with what happened to it, so what matters is MEMBERSHIP:
     which matters the body took up and whether each still says what it said. Declared
     on the content type (CONSTRUCTS Step 0 #4), not derived from the stack. */
  contract: CONTRACT.MEMBERSHIP,

  /** Is this a set of minutes?
   *
   *  FOUR INDEPENDENT EVIDENCE FAMILIES, on M0-32's own discipline: a class is what
   *  makes a document that class IN PRINCIPLE, implemented as a threshold over
   *  families, never as one literal. The families are (1) self-naming AS FURNITURE,
   *  (2) outcome language, (3) the retrospective frame, (4) an attendance roster.
   *
   *  THE ONE THING THIS TYPE MUST NOT DO is what the registered agenda reader was
   *  measured doing on these very documents: read a REFERENCE as MEMBERSHIP. Minutes
   *  and agendas of the same meeting share their file-number lines, their `Subject:` /
   *  `Recommendation:` blocks and their front matter, and each mentions the other in
   *  prose. So NONE of the shared signals appears below, and family (1) is a RATE. */
  detect(ctx) {
    const t = String(ctx.text || "");
    /** @type {string[]} */
    const signals = [];

    /* R37: the phrases are matched over the flattened text a window at a time (./windows.mjs), never over a whole
       copy of it; the counts and the tests are the whole text's. */
    const hit = { made: false, carried: false, tallies: 0, convened: false, adjourned: false };
    scanFlatMany(t, [
      { re: MOTION_MADE, on: () => (hit.made = true) },
      { re: MOTION_RESULT, on: () => (hit.carried = true) },
      { re: TALLY_LABEL, on: () => { hit.tallies++; } },
      { re: CONVENED, on: () => (hit.convened = true) },
      { re: ADJOURNED, on: () => (hit.adjourned = true) },
    ]);
    const { made, carried, tallies, convened, adjourned } = hit;

    const named = countLines(t, MINUTES_MASTHEAD);
    const furniture = named >= FURNITURE_RECURS;
    if (furniture) signals.push(localize("doctypes.meeting-minutes.self_naming_furniture", "names itself as minutes on {count} lines, which is page furniture", { count: String(named) }));
    else if (named) signals.push(localize("doctypes.meeting-minutes.self_naming_once", "names itself as minutes once ({count}), which a reference also does", { count: String(named) }));

    const motion = made && carried;
    if (motion) signals.push(localize("doctypes.meeting-minutes.motions", "motions made, seconded and carried or failed"));
    if (tallies >= 2) signals.push(localize("doctypes.meeting-minutes.tally_labels", "{count} roll-call vote tally label(s)", { count: String(tallies) }));
    const outcome = motion || tallies >= 2;

    const frame = convened && adjourned;
    if (frame) signals.push(localize("doctypes.meeting-minutes.frame", "a meeting that convened and adjourned at stated times"));

    const roster = countLines(t, ROSTER_LABEL) >= 2;
    if (roster) signals.push("an attendance roster");

    /* CERTAIN needs the masthead AT FURNITURE RATE plus one other family. The
       masthead alone is not enough and neither is any amount of outcome language:
       an agenda packet quoting last meeting's motions is the failure this guards. */
    const others = [outcome, frame, roster].filter(Boolean).length;
    if (furniture && others >= 1) return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    /* LIKELY on the evidence a ONE-PAGE set of minutes can still produce: two
       independent families that are not the masthead. This is the over-strictness
       direction and it is deliberate — the rate test cannot see a single-page
       document, and refusing one for that would be a fence tighter than its rule. */
    if (others >= 2) return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    return { match: false, confidence: CONFIDENCE.NONE };
  },

  /** What is in it: the meeting's own facts, and one entity per matter taken up,
   *  keyed by the source-assigned file number and carrying WHAT HAPPENED TO IT.
   *
   *  FW-17 / IC-86 — THIS READER CAN SAY WHERE, on the same grounds the agenda reader
   *  can and with the same limit. Every reference it emits is a file number that sat
   *  ALONE ON ITS OWN LINE, so that line's offset IS the reference's offset and
   *  `ctx.locate` turns it into the container part the producer put it on. What it
   *  CANNOT say is the rectangle: Tier-1 text is a flat per-page string with no
   *  geometry, so a `pdf-page` source arrives with `rect: null` and the page is the
   *  honest maximum. A reader may emit ONLY a source `locate` gave it.
   *
   *  It positions the REFERENCE, not the outcome. The outcome is prose that follows
   *  the file number and may cross a page break — in document A the furniture falls
   *  between an item's description and its number — so recording the outcome's page
   *  would make the address disagree with the thing addressed. The file number is what
   *  an edge points at, so its position is the one recorded.
   *
   *  ONE DOCUMENT MAY BE MORE THAN ONE KIND (M0-32: 52 of 600), so `also_satisfies`
   *  states what else this same text satisfies. It is a fact, not a hedge: an agenda
   *  packet read as minutes should say it is also an agenda rather than let the single
   *  verdict stand for the whole document. */
  parse(ctx) {
    const raw = String(ctx.text || "");
    /* The lines, trimmed, held as offsets into the text (R37): a line is cut from it when it is read, so no copy of the
       whole text or of all its lines is built. `L.start(i)` is the start offset of each line IN THE UNSPLIT TEXT, the
       only coordinate `ctx.locate` understands. Derived from the separators the split actually matched, never from
       `length + 1`: a CRLF document drifts one character per line under the arithmetic, and a drift that grows
       silently down a 40,000-line packet is the class of wrong address position exists to avoid. */
    const L = lineTable(raw);
    /* Always a function: `readText` supplies one and a direct caller that does not gets
       the honest null rather than a TypeError. */
    const given = ctx.locate;
    const locate = typeof given === "function" ? given : () => null;
    const filePats = minutesFileLines(ctx);
    const isMinutesFurniture = minutesFurniture(ctx);
    const bodyEnds = vocabPatterns(ctx, "bodies", LINE_END);
    const memberTitles = vocabPatterns(ctx, "member_titles");

    /* The meeting's own facts. Every one of them may honestly be null; an unread fact
       is never invented. */
    /** @type {string | null} */
    let date = null;
    for (let i = 0; i < Math.min(L.length, 80); i++) {
      const l = L.get(i) ?? "";
      if (/^[A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}$/.test(l)) { date = minutesLongDate(l); break; }
    }

    /* THE BODY'S NAME IS FURNITURE OR IT IS NOTHING, and this is the rate test again
       rather than a second heuristic. In document A the line `*Rules & Legislation
       Committee` repeats on all 25 pages, so it is the running header and it is the
       body. In document B the name is set across THREE lines — `* Concurrent Meeting
       of the Oakland` / `Redevelopment Successor Agency` / `and the City Council` — so
       no single line is the name, and the honest answer is that this reader cannot say.
       Two earlier rules tried to pick one line out of that masthead and both produced a
       CONFIDENT WRONG BODY (`and the City Council`, then `Items, Reconsiderations,
       Pull Items Held In Committee`), which is the record naming a public body it
       never read. A null with a reason is worth more than either. */
    /** @type {string | null} */
    let body = null;
    {
      /* Every line's own recurrence, so both the candidate test and the wrap test
         below can ask the same question. */
      /** @type {Map<string, boolean>} */
      const recurs = new Map(/** @type {Array<[string, boolean]>} */ ([]));
      /** @param {string} l @returns {boolean | undefined} */
      const recursAt = (l) => {
        if (!recurs.has(l)) { let n = 0; for (let k = 0; k < L.length && n < FURNITURE_RECURS; k++) if (L.get(k) === l) n++; recurs.set(l, n >= FURNITURE_RECURS); }
        return recurs.get(l);
      };
      /* SEARCHED IN THE MASTHEAD ONLY. A body's name is where the clerk puts it — at
         the head of the document — and a line elsewhere that merely ends in `Council`
         is not the body that met. Without this bound the reader reached further down
         document B and named the body `Office Of The City Council`, a recurring
         address block. The bound is what makes the two guards below sufficient rather
         than the start of an endless list of them. */
      for (let i = 0; i < Math.min(L.length, 40) && !body; i++) {
        const l = L.get(i);
        if (!l || l.length > 80) continue;
        if (!anyMatch(bodyEnds, l)) continue;
        if (/^(and|or|of|the)\b/i.test(l) || /^[a-z]/.test(l)) continue;
        if (anyMatch(memberTitles, l) || isMinutesFurniture(l)) continue;
        if (!recursAt(l)) continue;
        /* THE WRAP TEST, and it is what stopped this reader naming the wrong body. A
           header the producer broke across lines repeats EVERY ONE of its lines at the
           furniture rate, so recurrence alone cannot tell the last line of a wrapped
           name from a whole name. What can: whether the line ABOVE it is itself a
           recurring NON-furniture line. Above `*Rules & Legislation Committee` sits the
           meeting's date, which is furniture — so that is a whole name. Above `Agency
           and the City Council` sits `Oakland Redevelopment Successor`, recurring 37
           times and not furniture — so that is a tail, and the reader declines. */
        /** @type {string | null} */
        let prev = null;
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) { const pj = L.get(j); if (pj) { prev = pj; break; } }
        const above = prev;
        if (above && !isMinutesFurniture(above) && recursAt(above)) continue;
        body = l.replace(/^[*\s]+/, "").trim();
      }
    }
    const body_why = body ? null
      : !bodyEnds.length
      ? localize("doctypes.meeting-minutes.no_body_profile", "no active jurisdiction profile says how a body is named, so which body met is not read")
      : localize("doctypes.meeting-minutes.no_body_line", "no single line of this document names the body at the rate a running header does, so which body met is not stated here rather than guessed from one line");
    const convened = clockOf(raw, CONVENED);
    const adjourned = clockOf(raw, ADJOURNED);
    /* DRAFT is a first-class fact about the record a member would be citing, not a
       cosmetic label: minutes the body has not yet approved can still change. */
    /** @type {string | null} */
    let status = null;
    for (let i = 0; i < L.length; i++) {
      const l = L.get(i) ?? "";
      const m = MINUTES_MASTHEAD.exec(l);
      if (!m) continue;
      const q = /[-–—]\s*(\S.*)$/.exec(l);
      status = q ? minutesGroup(q, 1).trim() : "unqualified";
      break;
    }

    /* The attendance roster, as a DOCUMENT FACT rather than as entities, and the
       reason is the key rule. An entity's `key` must be stable across fetches, and a
       PERSON'S NAME is not a key the source assigned — it is the source's spelling of
       a person on a day, and the two minutes read here spell one councilmember with a
       double space (`Kevin  Jenkins`). Framework §7's line is that an id in a URL is a
       key and a position in a list is not; a name is on the wrong side of it. Emitting
       attendance as entities would put an unstable key into the record's own diffing,
       which reports a re-spelling as a person leaving the body. So the roster is a
       fact, stated, and who attended stays readable without being addressable. */
    /** @type {MinutesRoster} */
    const roster = {};
    for (let i = 0; i < L.length; i++) {
      const lab = ROSTER_LABEL.exec(L.get(i) ?? "");
      if (!lab) continue;
      /* The names sit on the line ABOVE the label (measured in both documents); the
         count sits below it. Neither is assumed present. */
      const above = L.get(i - 1) || "";
      if (!above || isMinutesFurniture(above) || ROSTER_LABEL.test(above)) continue;
      const key = minutesGroup(lab, 1).toLowerCase();
      if (!roster[key]) roster[key] = above;
    }

    /** @type {Entity[]} */
    const entities = [];
    /* D-454: key -> the entity, so a repeat is recorded as another occurrence (`readAgain`). */
    /** @type {Map<string, Entity>} */
    const seen = new Map(/** @type {Array<[string, Entity]>} */ ([]));
    /** @type {string | null} */ let pendingSubject = null;
    /** @type {string | null} */ let pendingFrom = null;
    /** @type {string | null} */ let pendingItem = null;
    /** @type {string | null} */ let expect = null;
    for (let i = 0; i < L.length; i++) {
      const line = L.get(i);
      if (!line) continue;
      /* THE ITEM NUMBER IS CARRIED FORWARD, not scanned back for, and the difference
         is the measured layout. In the AGENDA the item number sits immediately before
         the file number. In the MINUTES it opens the block — `3.1` / `Subject:` /
         `From:` / `Recommendation: ...` / `26-0910` — so scanning back from the file
         line hits the recommendation's prose and gives up, which is why the first
         driven run reported `item: null` for every item of both documents. */
      if (MINUTES_ITEM_LINE.test(line) && minutesFileKey(filePats, line) == null) { pendingItem = line; continue; }
      const lab = /^(Subject|From):\s*(.*)$/.exec(line);
      if (lab) {
        const name = minutesGroup(lab, 1), said = minutesGroup(lab, 2);
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
      const key = minutesFileKey(filePats, line);
      if (key == null) continue;
      if (seen.has(key)) { readAgain(seen.get(key), locate(L.start(i))); continue; }

      /* A section item with no Subject block takes its heading from the nearest
         substantive line above; the item number was carried forward (see above). */
      const item = pendingItem;
      /** @type {string | null} */
      let heading = null;
      for (let j = i - 1, hops = 0; j >= 0 && hops < 8; j--) {
        const prev = L.get(j);
        if (!prev) continue;
        hops++;
        if (MINUTES_ITEM_LINE.test(prev)) continue;
        const prevFile = minutesFileKey(filePats, prev) != null;
        if (isMinutesFurniture(prev) || prevFile) {
          if (prevFile) break;
          continue;
        }
        heading = prev;
        break;
      }

      /* THE OUTCOME, read FORWARD from the file number to the next one — which is
         where the minutes put it, and the one thing this type adds over the agenda.
         Bounded by the next file-number line so an item can never borrow the next
         item's result, and the window is read as flattened text because both shapes
         wrap across lines. */
      let end = L.length;
      for (let j = i + 1; j < L.length; j++) if (minutesFileKey(filePats, L.get(j) ?? "") != null) { end = j; break; }
      /** @type {string[]} */
      const span = [];
      for (let j = i + 1; j < end; j++) span.push(L.get(j) ?? "");
      const window = flatten(span.join("\n"));
      /* Shape 1, a motion: who moved, who seconded, what was moved, and whether it
         carried. Shape 2, a disposition: `This <matter kind> be <action>`. */
      const mo = /\bA motion was made by\s+(.+?),\s*seconded by\s+(.+?),\s*that\s+this matter be\s+(.+?)\.\s*The motion\s+(carried|failed)\b/i.exec(window);
      const di = /\bThis\s+([A-Z][\w ]{2,40}?)\s+be\s+([^.]{2,90})\./.exec(window);
      /** @type {string | null} */ let outcome = null;
      /** @type {string | null} */ let moved_by = null;
      /** @type {string | null} */ let seconded_by = null;
      /** @type {string | null} */ let result = null;
      if (mo) { moved_by = minutesGroup(mo, 1).trim(); seconded_by = minutesGroup(mo, 2).trim(); outcome = minutesGroup(mo, 3).trim(); result = minutesGroup(mo, 4).toLowerCase(); }
      else if (di) { outcome = `${minutesGroup(di, 1).trim()} ${minutesGroup(di, 2).trim()}`.trim(); }

      /* The vote as the clerk recorded it: each tally label with the count that
         follows it. Never summed, never re-derived — a total this reader computed
         would be a number the document does not contain. */
      /** @type {MinutesVote} */
      const vote = {};
      for (const m of window.matchAll(/\b(Aye|Ayes|Noe|Noes|No|Abstain|Abstained|Excused|Absent|Recused|NO VOTE)\s*:\s*(.*?)(?=\b(?:Aye|Ayes|Noe|Noes|No|Abstain|Abstained|Excused|Absent|Recused|NO VOTE)\s*:|$)/gi)) {
        const n = /(\d+)\s*-/.exec(minutesGroup(m, 2));
        if (n) vote[minutesGroup(m, 1).toLowerCase()] = Number(minutesGroup(n, 1));
      }

      const label = pendingSubject || heading || `legislation ${key}`;
      const made = entity(key, "legislation", String(label).slice(0, 160), {
        subject: pendingSubject || null,
        from: pendingFrom || null,
        item: item || null,
        /* What the body DID. Null is first-class and means THIS READER COULD NOT
           SAY — an item listed with no recorded action, or an outcome in a shape
           these two documents did not contain — never "nothing happened". */
        outcome: outcome || null,
        result: result || null,
        moved_by, seconded_by,
        vote: Object.keys(vote).length ? vote : null,
      }, locate(L.start(i)));
      entities.push(made);
      seen.set(key, made);
      pendingSubject = null; pendingFrom = null; pendingItem = null;
    }

    return {
      entities, body, body_why, date, convened, adjourned, status,
      references_why: filePats.length ? null
        : localize("doctypes.meeting-minutes.no_file_shape", "no active jurisdiction profile gives the shape of its legislative record's file numbers, so no matter was read"),
      attendance: Object.keys(roster).length ? roster : null,
      also_satisfies: alsoSatisfies(ctx, "meeting_minutes"),
      at: ctx.at || null,
    };
  },

  /** Given two parses of the same minutes address, what happened to the record. */
  assess(a, b) {
    /* A read that found nothing is a failed reader, never an emptied record. Each reading is checked where it is
       first read, so a first reading with no entities answers before the second is looked at. */
    /** @returns {MinutesAssessment} */
    const unread = () => ({ meaningful: null, significance: null, events: [], confirmed: null,
               why: localize("doctypes.meeting-minutes.unread", "the matters in these minutes could not be read this time, so nothing is claimed about them either way") });
    if (!isMinutesReading(a)) throw new TypeError("meeting_minutes: assess was handed no reading of minutes before");
    if (!a.entities.length) return unread();
    if (!isMinutesReading(b)) throw new TypeError("meeting_minutes: assess was handed no reading of minutes after");
    if (!b.entities.length) return unread();

    const d = diffEntities(a.entities, b.entities);
    /** @type {EventHead[]} */
    const events = [];
    /* AN OUTCOME OR A VOTE MOVING IS THE SERIOUS ONE, and it is why this type exists
       rather than the agenda type being pointed at a second document. A published
       record of what a body DID changing afterwards is the record's own subject.
       Graded apart from the wording of the item, which is `item_changed` (NOTICE). */
    const HEAVY = new Set(["outcome", "result", "vote", "moved_by", "seconded_by"]);
    for (const alt of d.altered) {
      const heavy = alt.moved.filter((m) => HEAVY.has(m.fact));
      const light = alt.moved.filter((m) => !HEAVY.has(m.fact));
      if (heavy.length)
        events.push(event("outcome_changed", { key: alt.entity.key, label: alt.entity.label,
          moved: heavy,
          why: localize("doctypes.meeting-minutes.outcome_changed", "what these minutes record the body as having done with this matter changed") }));
      if (light.length)
        events.push(event("item_changed", { key: alt.entity.key, label: alt.entity.label,
          moved: light,
          why: localize("doctypes.meeting-minutes.item_changed", "what these minutes say about this matter changed") }));
    }
    /* A matter vanishing from a published record of a past meeting is the
       quiet-substitution class with no moving window to excuse it. */
    for (const e of d.gone)
      events.push(event("item_pulled", { key: e.key, label: e.label,
        why: localize("doctypes.meeting-minutes.pulled", "a matter these minutes recorded is no longer in them") }));
    /* Minutes gaining a matter is normal while they are a draft and is recorded. */
    for (const e of d.appeared)
      events.push(event("item_added", { key: e.key, label: e.label,
        why: localize("doctypes.meeting-minutes.added", "a matter was added to these minutes") }));

    bySeverity(events);
    const intact = a.entities.filter((e) =>
      b.entities.some((x) => x.key === e.key && JSON.stringify(x.facts) === JSON.stringify(e.facts))).length;
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events,
      /* What was verified unchanged, or null when nothing was (R16). */
      confirmed: intact ? { entries: b.entities.length, intact } : null,
      why: events.length
        ? localize("doctypes.meeting-minutes.changes", "{intact} of {total} matters unchanged; {gone} gone, {added} added, {altered} altered", { intact: String(intact), total: String(a.entities.length), gone: String(d.gone.length), added: String(d.appeared.length), altered: String(d.altered.length) })
        : localize("doctypes.meeting-minutes.unchanged", "all {count} matters in these minutes are unchanged", { count: String(b.entities.length) }),
    };
  },
};

export default counted(meetingMinutesType);
