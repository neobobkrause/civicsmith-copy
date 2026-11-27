/* A staff report: written BY staff TO a body, recommending that it act.
 *
 * FW-18, the SECOND class in M0-32's measured order (`MEASUREMENTS.md` M-18;
 * `EXTRACTION-BREADTH-DESIGN.md` §2's table, row 2). ~3,012 items (+/-716) scaled to
 * the text-bearing stratum — the LARGEST unregistered class by point estimate, and it
 * is second only because the census's PAIRED comparison could not separate it from
 * minutes (z = 0.78), which left §2's standing rule standing. It is not rarer than
 * minutes and the table says so.
 *
 * MEASURED ON A REAL DOCUMENT, fetched and read through the plane's own Tier-1
 * extraction and flattened by `readtext.mjs`'s `flattenText`:
 *
 *   cao-94612.s3.amazonaws.com/documents/2020.06.23-Errata-3-Agenda-Report-Exhibits-
 *   and-Resolution.pdf — the Director of Finance's AGENDA REPORT to the City
 *   Administrator on the FY 2020-21 mid-cycle budget errata, 58 pages, 286,846
 *   characters decoded. Read 2026-09-15.
 *
 * A SECOND DOCUMENT WAS READ AS A CONTROL and it is the more instructive one:
 * cao-94612.../documents/30-Agenda-FOT-7-15-20-PACKET.pdf, the Fox Oakland Theater
 * board's meeting packet. A crude first matcher — the presence of `TO:`/`SUBJECT:` and
 * the word RECOMMENDATION — called it a staff report; the rule below does not, because
 * it carries none of the template sections and no sign-off. It is in the pen as the
 * over-firing arm this type had to survive.
 *
 * WHAT THE DOCUMENT ACTUALLY LOOKS LIKE.
 *
 *   A MEMORANDUM HEADER at the very top, four labels in one block:
 *   `TO : Edard D. Reiskin ... FROM: Adam Benson ... SUBJECT: FY 2020-21 Proposed
 *   Mid-cycle Budget Errata No. 3 - Supplemental DATE: June 19, 2020`. Measured: the
 *   three-label span is 79 characters and it begins 42 characters into the document.
 *
 *   THE AGENDA-REPORT TEMPLATE'S SECTION HEADINGS, each alone on its line and in
 *   capitals: RECOMMENDATION, REASON FOR SUPPLEMENTAL, BACKGROUND / LEGISLATIVE
 *   HISTORY, ANALYSIS AND POLICY ALTERNATIVES, FISCAL IMPACT, PUBLIC OUTREACH /
 *   INTEREST, COORDINATION, SUSTAINABLE OPPORTUNITIES, ACTION REQUESTED OF THE CITY
 *   COUNCIL. Eight of the ten this type knows about fired.
 *
 *   A SIGN-OFF: `Respectfully submitted,` then the author and `Prepared by:`.
 *
 *   A RUNNING FOOTER repeating the subject, the date and a page number on every page.
 *
 *   AND A WHOLE RESOLUTION INSIDE IT — `OAKLAND CITY COUNCIL / RESOLUTION NO. ____
 *   C.M.S.`, six WHEREAS recitals and eleven operative clauses. This document is a
 *   LIVE INSTANCE of M0-32's 52-in-600 multi-class finding, and the `regulation` type
 *   registered beside this one detects it as well. Neither reading is wrong; the
 *   document is both things, and `also_satisfies` says so rather than letting one
 *   verdict stand for the whole document.
 *
 * WHY THE PHRASES ARE MATCHED OVER FLATTENED TEXT. This producer is not Legistar.
 * Tier-1 over the City's own published PDFs breaks words and phrases across lines
 * wherever the page laid them out — `TO\n:\n`, `P\nage 1`, `ben\nefit` — so a
 * line-anchored phrase test finds nothing and looks like a document that is not a
 * staff report. `flatten` in ./index.mjs carries the measurement. LINE ANCHORING is
 * kept only for the SECTION HEADINGS, where being alone on a line is the whole signal
 * that distinguishes a heading from the same words inside a sentence.
 *
 * WHY THIS TYPE MATTERS. A staff report is where a recommendation to a public body is
 * MADE and where the reasoning behind it is written down, so it is the document a
 * member most often needs when the minutes record only that a body accepted something.
 * What this reading claims is exactly: who addressed whom, on what subject, what was
 * recommended, and which instruments and code sections the report points at. It does
 * not evaluate the recommendation and does not treat the report's account of a fact as
 * the fact.
 */
import { CONFIDENCE, CONTRACT, diffEntities, flatten, alsoSatisfies,
         vocabulary, vocabRegex, vocabPatterns, enactmentPatterns, enactmentNumber, codePatterns,
         IN_PROSE } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { eachLine, lineTable, flatPrefix, flatFirst, scanFlatMany, rawMergedHits, referenceBook, counted, spend } from "./windows.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, Detection, Entity, TaggedPattern } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { FlatHit, ReferencesState } from "./windows.mjs" */

/**
 * A field of the memorandum header, by its label in lower case.
 * @typedef {"to" | "from" | "subject" | "date"} MemoField
 */
/**
 * The memorandum header's fields as read, each by its label in lower case: the text up to the next label, or null when
 * that is empty.
 * @typedef {{ [label: string]: string | null }} MemoFields
 */
/**
 * The memorandum header block: its fields, how many distinct labels it carries, the span from its first label to the
 * label that completed it, and the flattened offset it begins at.
 * @typedef {Object} MemoHeader
 * @property {MemoFields} fields
 * @property {number} labels
 * @property {number} span
 * @property {number} at
 */
/**
 * A label of the header where it was met: its flattened offset and its name in capitals.
 * @typedef {Object} MemoLabel
 * @property {number} i
 * @property {string} k
 */
/**
 * What was verified unchanged between two readings of a report (R16).
 * @typedef {Object} ReportConfirmed
 * @property {number} entries
 * @property {number} intact
 * @property {boolean} recommendation_unchanged
 */
/**
 * What `parse` reads from a staff report: the references it points at (with what `referenceBook` did not keep), the
 * memorandum header's fields, the recommendation (and, where the bound cut it, that it did and its whole length), how
 * many template sections it carries as headings and whether it is signed off.
 * @typedef {Object} StaffReportOwn
 * @property {Entity[]} entities
 * @property {string | null} to
 * @property {string | null} from
 * @property {string | null} subject
 * @property {string | null} date
 * @property {string | null} recommendation
 * @property {true} [recommendation_cut]
 * @property {number | null} [recommendation_length]
 * @property {number} sections
 * @property {boolean} signed_off
 * @property {string[]} also_satisfies
 * @property {string | null} at
 */
/** @typedef {ReferencesState & StaffReportOwn} StaffReportReading */
/**
 * What `assess` answers for two readings of one report.
 * @typedef {Object} StaffReportAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {ReportConfirmed | null} confirmed
 * @property {string} why
 */
/**
 * The staff report content type (docprofile's `ContentType`).
 * @typedef {Object} StaffReportType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => StaffReportReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => StaffReportAssessment} assess
 */

/** Entry `i` of `xs`, which the code around it has made sure is there; the `TypeError` reading a member of a missing
 *  one raised, where it is not.
 *  @template T @param {ArrayLike<T>} xs @param {number} i @returns {T} */
function nth(xs, i) {
  const x = xs[i];
  if (x === undefined) throw new TypeError(`Cannot read properties of undefined (entry ${i} is missing)`);
  return x;
}

/* The memorandum header's four labels. Matched over flattened text and as a BLOCK —
   see `memoHeader`. */
const MEMO_LABEL = /\b(TO|FROM|SUBJECT|DATE)\s*:/gi;
const MEMO_PREFIX = 4096, MEMO_BEYOND = 3000;

/* The report template's sections are the JURISDICTION'S house template (the view's
   `report_sections`, N3): a report of this kind states what it recommends, why, what it
   costs, who was consulted and what it asks the body to do, under whatever headings
   its staff use. Each is tested as a HEADING — at the start of a line of its own —
   because the same words inside a sentence are not a section. */
const reportSectionPatterns = /** @param {DoctypeContext} ctx @returns {RegExp[]} */ (ctx) => vocabPatterns(ctx, "report_sections");
/* The heading that opens the recommendation itself, in the language's own word: any
   template names its recommendation so, and it is read only when it is one of the
   jurisdiction's section headings as well. */
const RECOMMENDATION_HEADING = /^RECOMMENDATIONS?(?![A-Za-z0-9])/i;
/* A heading line is short: the template's headings are titles, and a sentence that
   happens to open with one of these words is not a section. 64 characters admits
   `ACTION REQUESTED OF THE CITY COUNCIL` (36) with room and excludes prose. */
const HEADING_MAX = 64;
/* The one bound that stays on the recommendation (R39): what is kept when no heading follows it. */
const RECOMMENDATION_MAX = 50000;

const SIGNOFF = /\bRespectfully\s+submitted\b/i;
const PREPARED = /\bPrepared\s+by\s*:/i;
/* Self-naming, on a line of its own, in the titles the jurisdiction's reports carry
   (the view's `report_titles`, N3). Unlike a masthead this appears ONCE, on the title
   page — measured at 1 in the real document — so it is never a rate here. */
const reportTitlePatterns = /** @param {DoctypeContext} ctx @returns {RegExp[]} */ (ctx) => vocabPatterns(ctx, "report_titles");

/** The memorandum header as a BLOCK, which is the whole discipline of this family.
 *
 *  A MEETING AGENDA AND A SET OF MINUTES BOTH CARRY `Subject:` AND `From:` — 41 and 61
 *  times respectively in the documents read for `meeting_minutes` — one pair per item,
 *  scattered the length of the document. A memorandum header is FOUR LABELS IN ONE
 *  PLACE AT THE TOP. Measured: the real staff report's three-label span is 79
 *  characters beginning at offset 42; the agenda's and the minutes' tightest such spans
 *  are 116-128 characters beginning at offsets 1,572 to 54,013.
 *
 *  So the test is the span AND the position, never the presence of the labels. Returns
 *  the block's fields when one is found, else null.
 *  @param {string} text @returns {MemoHeader | null} */
function memoHeader(text) {
  /* R37: only the top of the document is read. A header is found within the first 2,500 flattened characters, its
     fields end within 200 of their label, and the only fact about the rest of the text a field's end depends on is
     whether a label stands anywhere past 3,000: so the first 4,096 flattened characters are matched, and the rest
     is asked that one question when it is needed. */
  const flat = flatPrefix(text, MEMO_PREFIX);
  /** @type {boolean | null} */
  let beyond = null;
  const labelBeyond = () => {
    const held = beyond;
    if (held !== null) return held;
    const scan = { hit: false };
    scanFlatMany(text, [{ re: MEMO_LABEL, on: () => (scan.hit = true) }], { fromAbs: MEMO_BEYOND });
    beyond = scan.hit;
    return scan.hit;
  };
  /** @type {MemoLabel[]} */
  const hits = [...flat.matchAll(MEMO_LABEL)].map((m) => ({ i: m.index, k: nth(m, 1).toUpperCase() }));
  for (let a = 0; a < hits.length; a++) {
    const ha = nth(hits, a);
    if (ha.i > 2500) break;              /* a memorandum header is at the TOP */
    /** @type {Map<string, number>} */
    const seen = new Map(/** @type {Array<[string, number]>} */ ([]));
    for (let b = a; b < hits.length; b++) {
      const hb = nth(hits, b);
      if (!seen.has(hb.k)) seen.set(hb.k, hb.i);
      if (seen.size < 3) continue;
      if (hb.i - ha.i > 250) break; /* one block, not four scattered labels */
      /* Every label of the block, not only the three that reached the threshold: the
         measured document's `DATE:` is the fourth and sat just past it, and stopping
         at three dropped a field the document plainly carries. */
      for (let c = b + 1; c < hits.length && nth(hits, c).i - ha.i <= 250; c++)
        if (!seen.has(nth(hits, c).k)) seen.set(nth(hits, c).k, nth(hits, c).i);
      /* EACH FIELD ENDS WHERE THE NEXT LABEL BEGINS. Taking a fixed 120 characters
         made every field swallow the rest of the header — `to` came back as the whole
         block — which is the record carrying a value that is not the value. */
      /* Bounded by the next label ANYWHERE in the document, not only by the next one
         inside the block — the LAST field of the block has no successor inside it, and
         bounding it by a character count instead made `date` come back as
         `June 19, 2020 City Administrator Approval Date: RECOMMENDATION Staff
         Recommends...`. The document's own next label (`Approval Date:`) is the
         boundary it actually has. */
      const all = hits.map((h) => h.i).filter((x) => x < MEMO_BEYOND);
      /** @type {MemoFields} */
      const at = {};
      for (const [k, i] of seen) {
        const near = all.find((x) => x > i);
        const next = near != null ? near : (hits.some((h) => h.i >= MEMO_BEYOND) || (flat.length >= MEMO_PREFIX && labelBeyond()) ? MEMO_BEYOND : null);
        const rest = flat.slice(i, next != null ? Math.min(next, i + 200) : i + 160)
          .replace(/^\s*\w+\s*:\s*/, "");
        at[k.toLowerCase()] = rest.trim() || null;
      }
      return { fields: at, labels: seen.size, span: hb.i - ha.i, at: ha.i };
    }
  }
  return null;
}

/** Which of the template's sections appear as HEADINGS in this document.
 *  @param {string} raw @param {ReadonlyArray<RegExp>} sections @returns {number[]} */
function reportSections(raw, sections) {
  /** @type {number[]} */
  const found = [];
  eachLine(raw, (line) => {
    const l = line.trim();
    if (!l || l.length > HEADING_MAX) return;
    for (let i = 0; i < sections.length; i++)
      if (nth(sections, i).test(l) && !found.includes(i)) found.push(i);
  });
  return found;
}

/* The references a report points at, every one of them the jurisdiction's (N3): its
   instruments by kind and number (the view's `spaces.enactment`), its legislative
   record's file numbers (`file_numbers`), and its codes of law (`codes`). All are
   matched over RAW text with `\s+` between tokens so a wrapped citation is still found
   AND `match.index` stays a RAW offset — the only coordinate `ctx.locate` understands.
   A file number is NOT line-anchored here: a staff report is about ONE matter and
   cites its number in prose, the opposite of the agenda's item-per-line list. */
const reportFileRefs = /** @param {DoctypeContext} ctx @returns {TaggedPattern<null>[]} */ (ctx) => vocabPatterns(ctx, "file_numbers", IN_PROSE, "g").map(/** @param {RegExp} re @returns {TaggedPattern<null>} */ (re) => ({ re, tag: null }));

/** What was verified unchanged between two readings of a report, or null when nothing
 *  was (R16): the citations still cited, and the recommendation when it still reads
 *  the same.
 *  @param {StaffReportReading} a @param {StaffReportReading} b @returns {ReportConfirmed | null} */
function reportConfirmed(a, b) {
  const intact = (a.entities || []).filter((e) => (b.entities || []).some((x) => x.key === e.key)).length;
  const was = a.recommendation;
  const recommendation = !!was && String(was) === String(b.recommendation || "");
  if (!intact && !recommendation) return null;
  return { entries: (b.entities || []).length, intact, recommendation_unchanged: recommendation };
}

/** Is `x` a reading of this type (what `parse` hands back)? Any reading there is: `assess` reads every member through
 *  `|| []`, `|| ""` or `String(...)` and so tolerates an object that lacks them, and only a missing reading (null or
 *  undefined) is refused, as reading its `entities` refused it.
 *  @param {object | null | undefined} x @returns {x is StaffReportReading} */
function isStaffReportReading(x) { return x !== null && x !== undefined; }
/** `x` as a reading of this type, or the `TypeError` reading a member of a missing one raised.
 *  @param {object | null | undefined} x @returns {StaffReportReading} */
function reportReading(x) {
  if (!isStaffReportReading(x)) throw new TypeError(`Cannot read properties of ${x} (reading 'entities')`);
  return x;
}

/** @type {StaffReportType} */
const staffReport = {
  key: "staff_report",
  label: localize("doctypes.staff-report.label", "a staff report to a public body"),
  version: 1,
  /* A narrative document making a case, not a list, so what matters is its SUBSTANCE.
     Declared on the content type (CONSTRUCTS Step 0 #4). */
  contract: CONTRACT.SUBSTANCE,

  /** Is this a staff report?
   *
   *  FOUR INDEPENDENT FAMILIES on M0-32's discipline: (1) a memorandum header as a
   *  block at the top, (2) the agenda-report template's sections as headings, (3) a
   *  sign-off, (4) self-naming on a line of its own.
   *
   *  CERTAIN needs (1) AND (2), and that pair is what separates the measured document
   *  from every other document in this item's pen: a staff report is BOTH addressed as
   *  a memorandum AND sectioned by the template. Neither alone will do — the minutes
   *  and the agenda each produce a memo-shaped label span somewhere, and `RECOMMENDATION`
   *  appears as a heading in one set of minutes.
   *  @param {DoctypeContext} ctx @returns {Detection} */
  detect(ctx) {
    const t = String(ctx.text || "");
    /** @type {string[]} */
    const signals = [];

    const memo = memoHeader(t);
    if (memo) signals.push(localize("doctypes.staff-report.memo_header", "a memorandum header of {labels} labels in {span} characters at the top", { labels: String(memo.labels), span: String(memo.span) }));
    const secs = reportSections(t, reportSectionPatterns(ctx));
    if (secs.length) signals.push(localize("doctypes.staff-report.template_sections", "{count} report template section heading(s)", { count: String(secs.length) }));
    /* Both phrases bridge words with `\s+` only, so they are tested on the text as it stands (R37: no flattened copy). */
    spend(t.length * 2);
    const signoff = SIGNOFF.test(t) || PREPARED.test(t);
    if (signoff) signals.push("a staff sign-off");
    const titles = reportTitlePatterns(ctx);
    const titled = eachLine(t, (l) => titles.some((re) => re.test(l.trim())));
    if (titled) signals.push(localize("doctypes.staff-report.titled", "names itself as a report on a line of its own"));

    if (memo && secs.length >= 3) return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    /* LIKELY on the evidence a report in a house style this type has not met can still
       produce. The over-strictness direction is deliberate: a fence tighter than its
       rule is not a safer fence, and a merely-likely recogniser declines to narrow. */
    if (secs.length >= 3 && (signoff || titled)) return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    if (memo && signoff && titled) return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    return { match: false, confidence: CONFIDENCE.NONE };
  },

  /** What is in it: who addressed whom about what, what was recommended, and every
   *  instrument and code section the report points at.
   *
   *  FW-17 / IC-86 — THIS READER CAN SAY WHERE, WITH A LIMIT IT MUST STATE. Its
   *  references are cited INLINE in prose rather than alone on a line, so the
   *  reference's own offset is the offset of the match — which is why every pattern
   *  above is run over the RAW text with `\s+` standing in for a line break, never over
   *  the flattened copy: a flattened offset addresses a string no container ever
   *  emitted, and handing that to `ctx.locate` would produce a confident wrong page.
   *  As everywhere on this path, `rect` is null because Tier-1 text has no geometry,
   *  and a reader may emit ONLY a source `locate` gave it.
   *
   *  WHAT IT CANNOT PLACE: a citation this producer split mid-word (`R` / `ESOLUTION`
   *  from a drop cap, measured in a real ordinance) is not matched at all, so it is
   *  absent rather than mispositioned — the safe direction, and named here because a
   *  reference this reader never saw must not read as one the document lacks.
   *  @param {DoctypeContext} ctx @returns {StaffReportReading} */
  parse(ctx) {
    const raw = String(ctx.text || "");
    const given = ctx.locate;
    /** @type {(offset: number) => ReadingPosition | null} */
    const locate = typeof given === "function" ? given : () => null;

    const memo = memoHeader(raw);
    /** @type {MemoFields} */
    const f = (memo && memo.fields) || {};
    const sections = reportSectionPatterns(ctx);
    const secs = reportSections(raw, sections);

    /* THE RECOMMENDATION, which is the point of the document. Read from the
       `RECOMMENDATION` heading forward to the next heading, whole (G23, K4571): a
       member is never told it recommends less than it does. One bound stays, for a
       recommendation with no heading after it, which would swallow the rest of the
       report: `RECOMMENDATION_MAX` characters are kept, the answer says
       `recommendation_cut: true`, and `recommendation_length` is the full length to
       the next heading or the end (raw characters, a line break counted as one).
       Or from the `Staff Recommends That` sentence where the house style has no
       heading. Null is first-class and means this reader could not find one, never
       that the report recommends nothing. */
    /** @type {string | null} */
    let recommendation = null;
    /** @type {number | null} */
    let recommendationLength = null;
    let recommendationCut = false;
    {
      const lines = lineTable(raw);
      for (let i = 0; i < lines.length; i++) {
        const h = lines.get(i);
        /* A line past the last is no heading, as `test` found the text "undefined" none. */
        if (h === undefined || !RECOMMENDATION_HEADING.test(h) || h.length > HEADING_MAX || !sections.some((re) => re.test(h))) continue;
        /** @type {string[]} */
        const body = [];
        let kept = 0, total = 0;
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines.get(j);
          if (!l) continue;
          if (l.length <= HEADING_MAX && !RECOMMENDATION_HEADING.test(l) && sections.some((re) => re.test(l))) break;
          total += l.length + 1;
          if (kept < RECOMMENDATION_MAX) { body.push(l); kept += l.length + 1; }
        }
        if (body.length) {
          const whole = flatten(body.join(" ")).trim();
          recommendationLength = total - 1;
          recommendationCut = whole.length > RECOMMENDATION_MAX;
          recommendation = recommendationCut ? whole.slice(0, RECOMMENDATION_MAX).trim() : whole;
        }
        break;
      }
      /* Where the house style has no heading: the sentence opened by the words the
         jurisdiction's reports open a recommendation with (`recommendation_openers`). */
      if (!recommendation) {
        /** @type {FlatHit | null} */
        let best = null;
        for (const e of vocabulary(ctx, "recommendation_openers")) {
          /* An entry with no pattern compiles to none, as `vocabRegex` of a missing pattern did. */
          const re = vocabRegex("pattern" in e ? e.pattern : undefined, (s) => `(?<![A-Za-z0-9])(?:${s})(?![A-Za-z0-9])[^.]{0,500}\\.`);
          const m = re && flatFirst(raw, re);
          const held = best;
          if (m && (!held || m.abs < held.abs)) best = m;
        }
        const found = best;
        if (found) recommendation = nth(found.m, 0).trim();
      }
    }

    /* The references. Each key is one the SOURCE assigned — an instrument number, a
       Legistar file number, a code section — never a position in a list and never a
       person's name. A reference cited twice is one reference; the FIRST sighting
       carries `source`, and D-454: every sighting, the first included, is kept in
       `occurrences` once there is a second, so a later one is not lost. */
    /* D-454: a repeat is ANOTHER OCCURRENCE of the one reference (`readAgain`), never dropped; R40: up to the bounds
       ./windows.mjs `referenceBook` states, past which the answer says what it did not keep. */
    const book = referenceBook(locate);
    const { entities, take } = book;
    /* R40: each kind of reference is met a window of the text at a time (./windows.mjs `rawMergedHits`), in the order
       and with the overlap rule `allMatches` gives over all of it, so 400,000 citations are never a list of 400,000
       matches. */
    rawMergedHits(raw, enactmentPatterns(ctx), ({ m, tag }) => {
      const groups = m.groups;
      const n = enactmentNumber(tag.forms, groups && groups.num);
      if (!n) return;
      take(`${tag.kind}:${n}`, "instrument", `${nth(tag.kind, 0).toUpperCase()}${tag.kind.slice(1)} No. ${n}`,
           { instrument: tag.kind, number: n }, m.index);
    });
    /* Group 1 is `IN_PROSE`'s, around the whole of the number's pattern, so every match fills it. */
    rawMergedHits(raw, reportFileRefs(ctx), ({ m }) => {
      const file = nth(m, 1);
      take(`file:${file}`, "legislation", `legislation ${file}`, { file }, m.index);
    });
    /* `sec` is the group `codePatterns` closes every pattern with, so every match fills it. */
    rawMergedHits(raw, codePatterns(ctx), ({ m, tag }) => {
      const groups = m.groups;
      if (!groups) throw new TypeError("Cannot read properties of undefined (reading 'sec')");
      const sec = groups.sec;
      if (sec === undefined) throw new TypeError("staff-report: a code section matched without its group `sec`");
      take(`${tag.key}:${sec}`, "code_section", `${tag.label} ${sec}`,
           { code: tag.key, section: sec }, m.index);
    });

    return {
      entities,
      ...book.state(),
      to: f.to || null,
      from: f.from || null,
      subject: f.subject || null,
      date: f.date || null,
      recommendation,
      ...(recommendationCut ? { recommendation_cut: true, recommendation_length: recommendationLength } : {}),
      sections: secs.length,
      signed_off: (spend(raw.length * 2), SIGNOFF.test(raw) || PREPARED.test(raw)),
      also_satisfies: alsoSatisfies(ctx, "staff_report"),
      at: ctx.at || null,
    };
  },

  /** Given two parses of the same report address, what happened to it.
   *  @param {object | null | undefined} before @param {object | null | undefined} after
   *  @returns {StaffReportAssessment} */
  assess(before, after) {
    /* A read that found no recommendation AND no references, on EITHER side, is a failed
       reader, never a report that says nothing — and never the ground for reporting
       everything the other side read as gone (R33). */
    const readNothing = /** @param {object | null | undefined} given @returns {boolean} */ (given) => {
      const x = reportReading(given);
      return !(x.entities || []).length && !x.recommendation;
    };
    if (readNothing(before) || readNothing(after))
      return { meaningful: null, significance: null, events: [], confirmed: null,
               why: localize("doctypes.staff-report.unread_either", "nothing could be read from this report this time, so nothing is claimed about it either way") };
    const a = reportReading(before), b = reportReading(after);

    /** @type {EventHead[]} */
    const events = [];
    /* THE RECOMMENDATION MOVING IS THE SERIOUS ONE. A staff report is the document a
       member cites for what staff advised a body to do; that advice changing after
       publication, at the same address, is the record's own subject rather than drift. */
    if (String(a.recommendation || "") !== String(b.recommendation || ""))
      events.push(event("recommendation_changed", {
        was: a.recommendation || null, now: b.recommendation || null,
        why: localize("doctypes.staff-report.recommendation_changed", "what this report recommends the body do is not what it recommended before") }));
    /* The memorandum header moving is worth showing and is not the same fact. */
    /** @type {ReadonlyArray<MemoField>} */
    const fields = ["to", "from", "subject", "date"];
    for (const k of fields)
      if (String(a[k] || "") !== String(b[k] || ""))
        events.push(event("item_changed", { key: k, label: k, moved: [{ fact: k, was: a[k], now: b[k] }],
          why: localize("doctypes.staff-report.field_changed", "this report's {field} changed", { field: k }) }));

    const d = diffEntities(a.entities || [], b.entities || []);
    for (const e of d.gone)
      events.push(event("item_pulled", { key: e.key, label: e.label,
        why: localize("doctypes.staff-report.pulled", "an instrument or code section this report pointed at is no longer cited in it") }));
    for (const e of d.appeared)
      events.push(event("item_added", { key: e.key, label: e.label,
        why: localize("doctypes.staff-report.added", "this report now points at an instrument or code section it did not cite before") }));

    bySeverity(events);
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events,
      confirmed: reportConfirmed(a, b),
      why: events.length
        ? (String(a.recommendation || "") !== String(b.recommendation || "")
          ? localize("doctypes.staff-report.changes_and_recommendation", "{count} change(s): {gone} citation(s) gone, {added} added, and the recommendation moved", { count: String(events.length), gone: String(d.gone.length), added: String(d.appeared.length) })
          : localize("doctypes.staff-report.changes", "{count} change(s): {gone} citation(s) gone, {added} added", { count: String(events.length), gone: String(d.gone.length), added: String(d.appeared.length) }))
        : localize("doctypes.staff-report.unchanged", "this report says what it said, and points at the same instruments"),
    };
  },
};
export default counted(staffReport);
