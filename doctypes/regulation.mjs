/* An ordinance or a resolution: an instrument of law, enacted or proposed.
 *
 * FW-18, the THIRD class in M0-32's measured order (`MEASUREMENTS.md` M-18;
 * `EXTRACTION-BREADTH-DESIGN.md` §2's table, row 3) — ~1,629 items (+/-540) scaled to
 * the text-bearing stratum, SEPARATED from minutes by the census's paired comparison
 * at z = 2.27 and from directories at z = 3.95. It sits third because it was measured
 * to, not because an ordinance matters less than a report.
 *
 * ONE TYPE FOR BOTH INSTRUMENTS, and the choice is the design's. §2's table names the
 * class *ordinance or resolution*, and the two are the same KIND OF THING: a body's
 * own operative act, carrying a caption, recitals and clauses that change something.
 * A reader answers the same four questions of each. Which instrument it is travels as
 * a FACT (`instrument`), where a member can see it, rather than as two registry
 * entries whose detectors would differ by one word.
 *
 * MEASURED ON REAL DOCUMENTS, fetched and read through the plane's own Tier-1
 * extraction, 2026-09-15:
 *
 *   A · oakland.legistar1.com/oakland/attachments/9fde50ed-8b3d-45a5-bb51-c67af1d9d1a7.pdf
 *       — the `View Legislation` attachment of Oakland matter 37551, a PROPOSED
 *       ordinance amending O.M.C. Chapter 8.28 (solid waste collection). 369,264
 *       bytes, 37 pages, 142,138 characters decoded, ZERO undetermined. It carries the
 *       caption `OAKLAND CITY COUNCIL / ORDINANCE NO. ________ C.M.S.` with the number
 *       still blank, 25 WHEREAS recitals, `NOW, THEREFORE, THE CITY COUNCIL OF THE
 *       CITY OF OAKLAND DOES ORDAIN AS FOLLOWS`, and `SECTION 1. Amendment of Oakland
 *       Municipal Code.`
 *   B · cao-94612.s3.amazonaws.com/documents/2020.06.23-Errata-3-Agenda-Report-Exhibits-
 *       and-Resolution.pdf — a RESOLUTION amending Resolution No. 87759 C.M.S.,
 *       published inside the staff report the `staff_report` type was measured on. Six
 *       WHEREAS recitals and eleven operative clauses. It is here deliberately: it is
 *       this item's live instance of M0-32's multi-class finding.
 *
 * THE DEFECT THIS TYPE WAS BUILT NOT TO MAKE, measured on a third real document. All
 * five of M0-32's own recogniser errors were one shape — a REFERENCE to a kind read as
 * MEMBERSHIP of it — and the trap here is sprung by the minutes read for
 * `meeting_minutes`: the Council's 2026-07-21 minutes carry SEVEN well-formed
 * instrument captions (`Resolution No. 90xxx C.M.S.`), because minutes cite the
 * instruments a body adopted. A matcher resting on the caption would call that document
 * an ordinance. It carries ZERO enacting formulas and ZERO recitals, because it does
 * not ENACT anything — so the threshold below requires the OPERATIVE VOICE and the
 * caption is never sufficient on its own.
 *
 * WHAT THIS MATCHER CANNOT SEE, and it is the honest limit of the rule above: a
 * document that QUOTES an instrument at length — a report reproducing a resolution, a
 * set of minutes with the full text of what was adopted attached — carries the same
 * enacting formula and the same recitals as the instrument itself, and this type will
 * detect it. That is not a bug being tolerated: such a document genuinely CONTAINS an
 * instrument, which is what `also_satisfies` exists to say. What the type does NOT do
 * is claim the containing document IS only that.
 *
 * WHY THE PHRASES ARE MATCHED OVER FLATTENED TEXT. Document A's Tier-1 text opens
 * `R\nESOLUTION \nN\nO\n.` from a drop cap and splits its own enacting formula across a
 * line break. Line-anchored phrase tests find neither. See `flatten` in ./index.mjs.
 */
import { CONFIDENCE, CONTRACT, diffEntities, alsoSatisfies,
         vocabPatterns, anyMatch, enactmentPatterns, enactmentNumber, codePatterns } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { codeHeadingsIn, readSections, readDefinitions, readExceptions, textDigest } from "./sections.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { scanFlatMany, mergedHits, rawMergedHits, referenceBook, counted, spend } from "./windows.mjs";
/** @import { DoctypeContext, Detection, Entity, EnactmentPattern } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */
/** @import { Section, Definition, Exception, Locate, CodeHeadings } from "./sections.mjs" */
/** @import { ReferencesState } from "./windows.mjs" */

/**
 * The instrument's own caption (`ownCaption`): its kind, its number or null where the caption carries none, and the
 * flattened text that follows it (empty where none was asked for).
 * @typedef {Object} OwnCaption
 * @property {string} kind
 * @property {string | null} number
 * @property {string} after
 */
/**
 * The digest of each section's text, by the section's path joined with `/`.
 * @typedef {{ [path: string]: string }} SectionDigests
 */
/**
 * How many sections, definitions and exceptions were read, and how many definitions and exceptions no section holds.
 * @typedef {Object} StructureCounts
 * @property {number} sections
 * @property {number} definitions
 * @property {number} exceptions
 * @property {number} definitions_unplaced
 * @property {number} exceptions_unplaced
 */
/**
 * The structure readings of an instrument or a code section (`structure`): its sections, why none were read, each
 * section's digest, its definitions and exceptions, and their counts.
 * @typedef {Object} StructureReading
 * @property {Section[]} sections
 * @property {string | null} sections_why
 * @property {SectionDigests} section_digests
 * @property {Definition[]} definitions
 * @property {Exception[]} exceptions
 * @property {StructureCounts} counts
 */
/**
 * Which form of law a text is: an instrument, a code section, or neither (null).
 * @typedef {"code" | "instrument" | null} LawForm
 */
/**
 * The facts `parse` reads of an instrument besides its structure and its book of references.
 * @typedef {Object} RegulationFacts
 * @property {Entity[]} entities
 * @property {LawForm} form
 * @property {string | null} form_why
 * @property {string | null} instrument
 * @property {string | null} number
 * @property {string | null} number_why
 * @property {string | null} title
 * @property {number} recitals
 * @property {string[]} also_satisfies
 * @property {string | null} at
 */
/**
 * What `parse` reads from an ordinance, a resolution or a code section.
 * @typedef {RegulationFacts & ReferencesState & StructureReading} RegulationReading
 */
/**
 * What was verified unchanged between two readings (R16): how many references the later one names, how many of them both
 * name, and the instrument's own facts that agree.
 * @typedef {Object} RegulationConfirmed
 * @property {number} entries
 * @property {number} intact
 * @property {OwnFact[]} facts
 */
/**
 * What moved in the sections between two readings: whether they were compared, the events, and why not where they were not.
 * @typedef {Object} SectionComparison
 * @property {boolean} compared
 * @property {EventHead[]} events
 * @property {string | null} why
 */
/**
 * What `assess` answers for two readings of one instrument's address.
 * @typedef {Object} RegulationAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {RegulationConfirmed | null} confirmed
 * @property {boolean} sections_compared
 * @property {string | null} sections_why
 * @property {string} why
 */
/**
 * The ordinance-or-resolution content type (docprofile's `ContentType`).
 * @typedef {Object} RegulationType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => RegulationReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined) => RegulationAssessment} assess
 */
/**
 * One of the instrument's own facts, compared between two readings.
 * @typedef {"instrument" | "number" | "title"} OwnFact
 */

/* THE OPERATIVE VOICE — a body enacting, in the forms the measured instruments use plus
   the general shapes. It is the language of enactment, the same in every jurisdiction
   that ordains and resolves, so it stays here (N3 moved only the local words). This is the family that separates an instrument from a document
   that cites one, so it is written as a principle (a body ORDAINS or RESOLVES, in the
   present operative voice) rather than as one literal: document A carries none of
   `BE IT ORDAINED`, which a list of spellings would have made the whole test. */
const ENACTING = /\b(?:DOES\s+(?:HEREBY\s+)?(?:ORDAIN|RESOLVE)|BE\s+IT\s+(?:FURTHER\s+)?(?:ORDAINED|RESOLVED)|IT\s+IS\s+(?:FURTHER\s+)?(?:ORDAINED|RESOLVED)|NOW,?\s+THEREFORE[^.]{0,160}?\b(?:ORDAINS?|RESOLVED?))\b/i;
/* A recital chain. One `WHEREAS` is a quotation; a chain is how an instrument
   establishes its own grounds. */
const RECITAL = /\bWHEREAS\b/gi;
/* The instrument's own CAPTION is the jurisdiction's (N3): the kinds of instrument and
   their number forms are the view's `spaces.enactment`, and any series marker after the
   number (`C.M.S.` in the measured instance) its `enactment_markers`. The number may be
   blank on a proposed instrument, which document A shows. */
const regCaptions = /** @param {DoctypeContext} ctx @returns {EnactmentPattern[]} */ (ctx) => enactmentPatterns(ctx, { blankNumber: true });
/* Codification: the language by which an instrument changes a code. The verbs and a
   code's generic name are the language's; which codes exist is the view's `codes`. */
const CODIFYING = /\b(?:is\s+hereby\s+(?:amended|added|repealed|deleted)|hereby\s+(?:amended|repealed)|Municipal\s+Code\s+(?:Section|Chapter))\b/gi;

/* The enacting BODY, immediately above its own caption. The words that name a body
   are the view's `bodies` (N3); the measured instruments open `<CITY> CITY COUNCIL` /
   `RESOLUTION NO. ____ C.M.S.`, a body named on its own just above. */
const regBodyEnds = /** @param {DoctypeContext} ctx @returns {RegExp[]} */ (ctx) => vocabPatterns(ctx, "bodies", (re) => `(?:${re})[^A-Za-z0-9]{0,40}$`);

/** WHICH caption is the instrument's OWN, as opposed to one it merely cites.
 *
 *  THIS FUNCTION EXISTS BECAUSE THE FIRST TWO DRAFTS OF THIS READER MADE THE DEFECT
 *  THIS WHOLE ITEM IS ABOUT, and both were caught by DRIVING the reader over the real
 *  document rather than by reading it back.
 *
 *    Draft 1 took the first well-formed `ORDINANCE NO. nnnnn C.M.S.` anywhere in the
 *    text. On document A — whose own caption reads `ORDINANCE NO. ________ C.M.S.`,
 *    the number still blank because the instrument is PROPOSED — it reported
 *    `number: 83689`, the number of a different ordinance document A cites.
 *
 *    Draft 2 took the last caption BEFORE the enacting formula, reasoning that an
 *    instrument's caption is what its clauses hang off. It reported `number: 13314`:
 *    document A's twenty-five WHEREAS recitals cite prior ordinances by number, and
 *    every one of them sits between the real caption and the enactment.
 *
 *  Both are a REFERENCE read as MEMBERSHIP — M0-32's one defect class — made twice
 *  inside the reader written to avoid it. That is worth recording rather than
 *  smoothing: the class is not obvious from the outside, and neither draft looked
 *  wrong until a real document was run through it.
 *
 *  WHAT ACTUALLY SEPARATES THEM is what sits IMMEDIATELY ABOVE. An instrument's own
 *  caption is introduced by the ENACTING BODY (`OAKLAND CITY COUNCIL`); a citation
 *  sits inside a sentence. So the own caption is the first one whose preceding ~120
 *  characters end in a body's name.
 *
 *  AND WHEN THERE IS NONE, THERE IS NONE. A document whose caption did not survive
 *  extraction — document B's opens `R ESOLUTION N O .` after a drop cap, which no
 *  caption pattern matches — gets a null number with its reason stated, never the
 *  nearest number in the text. That is the direction this reader has already been
 *  wrong in twice.
 *  @param {string} text @param {ReadonlyArray<EnactmentPattern>} captions @param {ReadonlyArray<RegExp>} bodies
 *  @param {number} [afterChars] @returns {OwnCaption | null} */
function ownCaption(text, captions, bodies, afterChars = 0) {
  /* R37: the captions are met in the flattened text a window at a time (./windows.mjs), in the order and with the
     overlap rule `allMatches` gives them over all of it; `after` is the flattened text that follows the caption found. */
  /** @type {{ found: OwnCaption | null }} */
  const seen = { found: null };
  mergedHits(text, captions, ({ m, tag }, abs, w) => {
    /* Tested as printed and in capitals: a caption's body is set in capitals, and a
       profile may write a body's name in either case. */
    const before = w.buf.slice(Math.max(0, m.index - 120), m.index);
    if (!(anyMatch(bodies, before) || anyMatch(bodies, before.toUpperCase()))) return false;
    const at = m.index + m[0].length;
    const groups = m.groups;
    seen.found = { kind: tag.kind, number: enactmentNumber(tag.forms, groups && groups.num),
                   after: afterChars ? w.buf.slice(at, at + afterChars) : "" };
    return true;
  });
  return seen.found;
}

/** How many matches of a global pattern the text holds. The patterns it is used for bridge words with `\s` only, so the
 *  count is the same over the text as it stands as over its flattened form (R37: no flattened copy).
 *  @param {string} text @param {RegExp} re @returns {number} */
function countIn(text, re) {
  spend(text.length);
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let n = 0;
  while (g.exec(text) !== null) n++;
  return n;
}

/** The instrument's own facts, in the order they are compared and reported.
 *  @type {ReadonlyArray<OwnFact>} */
const REG_OWN_FACTS = ["instrument", "number", "title"];

/** What was verified unchanged between two readings of an instrument, or null when
 *  nothing was (R16): the references still named, and the instrument's own facts that
 *  were read on both sides and agree.
 *  @param {RegulationReading} a @param {RegulationReading} b @returns {RegulationConfirmed | null} */
function regConfirmed(a, b) {
  const intact = (a.entities || []).filter((e) => (b.entities || []).some((x) => x.key === e.key)).length;
  const facts = REG_OWN_FACTS.filter((k) => a[k] && String(a[k]) === String(b[k] || ""));
  if (!intact && !facts.length) return null;
  return { entries: (b.entities || []).length, intact, facts };
}

/** What moved in the sections between two readings (R16): a section whose heading, text,
 *  definitions or exceptions differ, and a section read on one side only, each an
 *  `instrument_changed` naming its path. With no section read on either side nothing is
 *  said about sections, and why (R23, R24).
 *  @param {RegulationReading} a @param {RegulationReading} b @returns {SectionComparison} */
function sectionChanges(a, b) {
  const aSections = a.sections, bSections = b.sections;
  const sa = Array.isArray(aSections) ? aSections : [], sb = Array.isArray(bSections) ? bSections : [];
  if (!sa.length && !sb.length)
    return { compared: false, events: [],
             why: localize("doctypes.regulation.sections_none_read", "no section was read from either reading, so nothing is said about sections: {why}", { why: String(b.sections_why || a.sections_why || "neither reading carries sections") }) };
  const key = /** @param {Section} s @returns {string} */ (s) => s.path.join("/");
  const entry = /** @param {Section} s @returns {[string, Section]} */ (s) => [key(s), s];
  const ma = new Map(sa.map(entry)), mb = new Map(sb.map(entry));
  /** @template {Definition | Exception} T @param {T[] | undefined} list @param {string} k @returns {T[]} */
  const inSec = (list, k) => (Array.isArray(list) ? list : []).filter((x) => { const s = x.section; return s && s.join("/") === k; });
  const defsOf = /** @param {RegulationReading} x @param {string} k @returns {string} */ (x, k) => inSec(x.definitions, k).map((d) => d.term).join("\u0000");
  const excOf = /** @param {RegulationReading} x @param {string} k @returns {string} */ (x, k) => inSec(x.exceptions, k).map((e) => `${e.end - e.start}:${(e.cites || []).join(",")}`).join("|");
  /** @type {SectionDigests} what a reading without digests holds: none */
  const noDigests = {};
  /** @type {EventHead[]} */
  const events = [];
  for (const [k, was] of ma) {
    const now = mb.get(k);
    if (!now) {
      events.push(event("instrument_changed", { key: "section", section: was.path, was: was.number, now: null,
        why: localize("doctypes.regulation.section_gone", "section {number} was read before and is not read now", { number: String(was.number) }) }));
      continue;
    }
    /** @type {string[]} */
    const moved = [];
    if (String(was.heading || "") !== String(now.heading || "")) moved.push("heading");
    if (((a.section_digests || noDigests)[k] || null) !== ((b.section_digests || noDigests)[k] || null)) moved.push("text");
    if (defsOf(a, k) !== defsOf(b, k)) moved.push("definitions");
    if (excOf(a, k) !== excOf(b, k)) moved.push("exceptions");
    if (moved.length)
      events.push(event("instrument_changed", { key: "section", section: now.path, moved,
        was: was.heading || was.number, now: now.heading || now.number,
        why: localize("doctypes.regulation.section_changed", "section {number}'s {moved} is not what it was at this address", { number: String(now.number), moved: moved.join(", ") }) }));
  }
  for (const [k, now] of mb)
    if (!ma.has(k))
      events.push(event("instrument_changed", { key: "section", section: now.path, was: null, now: now.number,
        why: localize("doctypes.regulation.section_added", "section {number} is read now and was not read before", { number: String(now.number) }) }));
  return { compared: true, events, why: null };
}

/** The code headings in a text (R9). */
const codeHeads = /** @param {DoctypeContext} ctx @param {string} text @returns {CodeHeadings} */ (ctx, text) => codeHeadingsIn(text, ctx);

/** The structure readings of an instrument or a code section (R9–R14, R19).
 *  @param {DoctypeContext} ctx @param {string} raw @param {LawForm} form @param {Locate} locate @returns {StructureReading} */
function structure(ctx, raw, form, locate) {
  const { sections, sections_why } = readSections(raw, form, ctx, locate);
  const definitions = readDefinitions(raw, sections, locate);
  const exceptions = readExceptions(raw, sections, form, ctx, locate);
  /** @type {SectionDigests} */
  const digests = {};
  for (const s of sections) digests[s.path.join("/")] = textDigest(raw, s.start, s.end);
  return {
    sections, sections_why, section_digests: digests, definitions, exceptions,
    counts: { sections: sections.length, definitions: definitions.length, exceptions: exceptions.length,
              definitions_unplaced: definitions.filter((d) => d.section === null).length,
              exceptions_unplaced: exceptions.filter((e) => e.section === null).length },
  };
}

/** Is `x` a reading of this type (what `parse` hands back)? Any reading there is: `assess` reads every member through
 *  `|| []`, `|| ""` or `Array.isArray` and so tolerates an object that lacks them, and only a missing reading (null or
 *  undefined) is refused, as reading its `instrument` refused it.
 *  @param {object | null | undefined} x @returns {x is RegulationReading} */
function isRegulationReading(x) { return x !== null && x !== undefined; }
/** `x` as a reading of this type, or the `TypeError` reading a member of a missing one raised.
 *  @param {object | null | undefined} x @returns {RegulationReading}
 *  @throws {TypeError} when `x` is null or undefined */
function regReading(x) {
  if (!isRegulationReading(x)) throw new TypeError(`Cannot read properties of ${x} (reading 'instrument')`);
  return x;
}

/** @type {RegulationType} */
const regulationType = {
  key: "regulation",
  label: "an ordinance or resolution",
  version: 1,
  /* An instrument is a text that says what it says; what matters is its SUBSTANCE.
     Declared on the content type (CONSTRUCTS Step 0 #4). */
  contract: CONTRACT.SUBSTANCE,

  /** Is this an instrument of law?
   *
   *  FOUR FAMILIES: (1) the operative voice, (2) a recital chain, (3) the instrument's
   *  caption, (4) codifying language. THE OPERATIVE VOICE IS REQUIRED FOR EVERY
   *  MATCH — it is the one family a document that merely CITES an instrument does not
   *  produce, and the measured minutes prove the point by carrying seven captions and
   *  no enacting formula at all. */
  detect(ctx) {
    const t = String(ctx.text || "");
    const signals = [];

    /* R37: one pass over the flattened text, a window at a time; the counts are the whole text's. */
    let enacting = false, caption = false, codeCites = 0;
    scanFlatMany(t, [{ re: ENACTING, on: () => (enacting = true) }]);
    mergedHits(t, regCaptions(ctx), () => (caption = true));
    mergedHits(t, codePatterns(ctx), () => { codeCites++; });
    if (enacting) signals.push(localize("doctypes.regulation.enacting", "an enacting formula in the operative voice"));
    const recitals = countIn(t, RECITAL);
    if (recitals >= 2) signals.push(localize("doctypes.regulation.recital_chain", "a recital chain of {count} WHEREAS clause(s)", { count: String(recitals) }));
    if (caption) signals.push("an instrument caption");
    const codify = countIn(t, CODIFYING) + codeCites;
    if (codify) signals.push(`${codify} codification phrase(s)`);

    /* The caption alone is NEVER a match, at any confidence — that is the measured
       minutes' seven captions refused by name. */
    /* A code section or a charter article may QUOTE an enacting clause (a charter
       prescribes the words its ordinances enact by), so a text that opens with a code's
       section heading, or is divided by several, is the code before it is an instrument;
       an instrument's own caption under its body still decides for the instrument. */
    const heads = codeHeads(ctx, t);
    if ((heads.first || heads.count >= 2) && !ownCaption(t, regCaptions(ctx), regBodyEnds(ctx))) {
      signals.push(localize("doctypes.regulation.code_headings", "{count} section heading(s) of {label}", { count: String(heads.count), label: String(heads.label) }));
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    }
    if (!enacting) {
      /* T33-13 (R9): A CODE SECTION, served by a codifier, enacts nothing — it carries no
         enacting formula (time-law §5: 0 of 50 detected before this). It is one only when a
         heading of a code the view names opens it: the code's section number, then a title.
         The heading must open the document (the codifier's one-section form) or recur (an
         article holding several), so a single cited number on a line of some other
         document is not read as the code itself. */
      return { match: false, confidence: CONFIDENCE.NONE };
    }
    if (recitals >= 2 || caption) return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    /* An instrument with neither recitals nor a caption in a shape this type knows —
       a short resolution, or a producer whose caption did not survive extraction —
       still enacts something, and declining to narrow is the ladder working. */
    return { match: true, confidence: CONFIDENCE.LIKELY, signals };
  },

  /** What is in it: which instrument it is, its own number when it has one, and every
   *  instrument and code section it acts on.
   *
   *  FW-17 / IC-86 — THIS READER CAN SAY WHERE, with the same limit as the staff
   *  report's: its references are cited inline, so every pattern is run over the RAW
   *  text (with `\s+` standing in for a line break) and the match's own offset is what
   *  `ctx.locate` is given. A flattened offset would address a string no container ever
   *  emitted. `rect` is null — Tier-1 text has no geometry — and a reader may emit only
   *  a source `locate` gave it.
   *
   *  WHAT IT CANNOT PLACE: a citation this producer split mid-word (document A's own
   *  `R` / `ESOLUTION` drop cap) is not matched, so it is absent rather than
   *  mispositioned. Absent-and-said is the safe direction; a confident wrong page is
   *  not.
   *
   *  ONE THING IT DELIBERATELY DOES NOT DO: it does not decide whether the instrument
   *  was ADOPTED. A proposed ordinance and an enacted one read the same at this grain,
   *  and whether a body passed it is the minutes' business — which is why `enacted` is
   *  not a fact here and `number` being null is reported as exactly what it is. */
  parse(ctx) {
    const raw = String(ctx.text || "");
    const given = ctx.locate;
    /** @type {Locate} */
    const locate = typeof given === "function" ? given : () => null;

    let enacts = false;
    scanFlatMany(raw, [{ re: ENACTING, on: () => (enacts = true) }]);
    const cap = ownCaption(raw, regCaptions(ctx), regBodyEnds(ctx), 2500);
    const number = cap && cap.number ? cap.number : null;
    const instrument = cap ? cap.kind : (/\bORDAIN/i.test(raw) ? "ordinance" : null);

    /* The caption's TITLE — the capitalised sentence that says what the instrument
       does. Taken from the OWN caption only, for the same reason the number is, and
       read as THE FIRST SUBSTANTIAL MOSTLY-CAPITALS SENTENCE after it rather than as
       the text immediately following: document A interposes `INTRODUCED BY
       COUNCILMEMBER [IF APPLICABLE]` between its caption and its title, and a rule
       that demanded adjacency returned null on the one document it was written from. */
    /** @type {string | null} */
    let title = null;
    if (cap) {
      const after = cap.after;
      const blanks = vocabPatterns(ctx, "template_blanks", null, "g");
      for (const s of after.split(/(?<=\.)\s+/)) {
        const t = s.trim();
        if (t.length < 40) continue;
        const letters = t.replace(/[^A-Za-z]/g, "");
        if (!letters.length) continue;
        /* "Mostly capitals" rather than "all capitals": these titles carry ordinals,
           punctuation and the occasional lower-case artefact of extraction. */
        if ((t.replace(/[^A-Z]/g, "").length / letters.length) < 0.85) continue;
        /* The template's own unfilled text is not the title: document A's caption is
           followed by `INTRODUCED BY COUNCILMEMBER [IF APPLICABLE]`, a blank on the
           form rather than anything the instrument says. Which text is a blank is the
           jurisdiction's template (`template_blanks`, N3). */
        let u = t;
        for (const re of blanks) u = u.replace(re, " ");
        u = u.replace(/\s+/g, " ").trim();
        if (u.length < 40) continue;
        title = u.slice(0, 500);
        break;
      }
    }

    const recitals = countIn(raw, RECITAL);

    /* D-454: a repeat is ANOTHER OCCURRENCE of the one reference (`readAgain`), never dropped; R40: up to the bounds
       ./windows.mjs `referenceBook` states, past which the answer says what it did not keep. */
    const book = referenceBook(locate);
    const { entities, take } = book;
    /* The instruments this one acts on or cites. Its OWN number, when it has one, is a
       document fact rather than an entity — an instrument is not a reference to
       itself, and emitting it as one would make every instrument appear to cite one
       more thing than it does. */
    const ownKey = number ? `${instrument}:${number}` : null;
    /* R40: each kind of reference is met a window of the text at a time (./windows.mjs `rawMergedHits`), in the order
       and with the overlap rule `allMatches` gives over all of it, so 400,000 citations are never a list of 400,000
       matches. */
    rawMergedHits(raw, enactmentPatterns(ctx), ({ m, tag }) => {
      const groups = m.groups;
      const n = enactmentNumber(tag.forms, groups && groups.num);
      if (!n) return;
      const key = `${tag.kind}:${n}`;
      if (key === ownKey) return;
      /* A kind of no letters has no first letter to capitalise, and reading one failed as it always did. */
      const initial = tag.kind[0];
      if (initial === undefined) throw new TypeError("Cannot read properties of undefined (reading 'toUpperCase')");
      take(key, "instrument", `${initial.toUpperCase()}${tag.kind.slice(1)} No. ${n}`,
           { instrument: tag.kind, number: n }, m.index);
    });
    rawMergedHits(raw, codePatterns(ctx), ({ m, tag }) => {
      const groups = m.groups;
      if (groups === undefined) throw new TypeError("Cannot read properties of undefined (reading 'sec')");
      /* Every code pattern requires its `sec` group (docprofile's `codePatterns`), so a match always carries it. */
      const sec = groups.sec;
      if (sec === undefined) return;
      take(`${tag.key}:${sec}`, "code_section", `${tag.label} ${sec}`,
           { code: tag.key, section: sec }, m.index);
    });

    /* T33-13 (R9): WHICH FORM OF LAW this is. An instrument enacts (its operative voice, or
       its own caption under a body); a code section is a codifier's page of a code, read
       by the view's section headings. Neither is a stated null, never a guess. */
    const heads = cap ? null : codeHeads(ctx, raw);
    /** @type {LawForm} */
    const form = heads && (heads.first || heads.count >= 2) ? "code" : enacts || cap ? "instrument" : null;
    const st = structure(ctx, raw, form, locate);

    return {
      entities,
      ...book.state(),
      form,
      form_why: form ? null
        : localize("doctypes.regulation.no_form", "this text carries no enacting formula, no instrument caption under a body, and no section heading of a code the active jurisdiction profiles name, so it is read as neither an instrument nor a code section"),
      ...st,
      instrument,
      /* Null means THIS INSTRUMENT CARRIES NO NUMBER — document A's caption is
         `ORDINANCE NO. ________ C.M.S.`, a proposed instrument awaiting one. It does
         not mean the reader failed, and `number_why` says which. */
      number,
      number_why: number ? null
        : cap ? localize("doctypes.regulation.proposed_no_number", "this instrument's caption carries no number, which is what a proposed ordinance or resolution looks like before a body adopts it")
        : localize("doctypes.regulation.no_caption", "no caption introduced by an enacting body was read, in the words the active jurisdiction profiles give for instruments and bodies, so the number is not stated"),
      title,
      recitals,
      also_satisfies: alsoSatisfies(ctx, "regulation"),
      at: ctx.at || null,
    };
  },

  /** Given two parses of the same instrument's address, what happened to it. */
  assess(before, after) {
    /* Nothing read on EITHER side is a failed reader (R16, R33), never an instrument
       that lost its text. */
    const readNothing = /** @param {object | null | undefined} given @returns {boolean} */ (given) => {
      const x = regReading(given);
      return !x.instrument && !(x.entities || []).length && !(x.sections || []).length;
    };
    if (readNothing(before) || readNothing(after))
      return { meaningful: null, significance: null, events: [], confirmed: null,
               sections_compared: false, sections_why: localize("doctypes.regulation.one_side_unread", "nothing was read from one of the readings, so nothing is said about its sections"),
               why: localize("doctypes.regulation.unread_either", "nothing could be read from this instrument this time, so nothing is claimed about it either way") };
    const a = regReading(before), b = regReading(after);

    /** @type {EventHead[]} */
    const events = [];
    /* AN INSTRUMENT'S OWN TEXT MOVING AT THE SAME ADDRESS IS THE SERIOUS ONE. This is
       the class of change the record exists to be able to prove: what a body enacted
       is not supposed to change afterwards, and a member who cited the title or the
       number of an instrument cited something fixed. */
    for (const k of REG_OWN_FACTS)
      if (String(a[k] || "") !== String(b[k] || ""))
        events.push(event("instrument_changed", { key: k, was: a[k] || null, now: b[k] || null,
          why: localize("doctypes.regulation.instrument_changed", "this instrument's {field} is not what it was at this address", { field: k }) }));
    if (Number(a.recitals || 0) !== Number(b.recitals || 0))
      events.push(event("instrument_changed", { key: "recitals", was: a.recitals, now: b.recitals,
        why: localize("doctypes.regulation.recitals", "the recitals establishing this instrument's grounds changed in number") }));

    if ((a.form || b.form) && String(a.form || "") !== String(b.form || ""))
      events.push(event("instrument_changed", { key: "form", was: a.form || null, now: b.form || null,
        why: localize("doctypes.regulation.form_changed", "what was read at this address is not the same form of law it was") }));
    const sec = sectionChanges(a, b);
    for (const e of sec.events) events.push(e);

    const d = diffEntities(a.entities || [], b.entities || []);
    for (const e of d.gone)
      events.push(event("item_pulled", { key: e.key, label: e.label,
        why: localize("doctypes.regulation.pulled", "an instrument or code section this one acted on is no longer named in it") }));
    for (const e of d.appeared)
      events.push(event("item_added", { key: e.key, label: e.label,
        why: localize("doctypes.regulation.added", "this instrument now names something it did not name before") }));

    bySeverity(events);
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events,
      confirmed: regConfirmed(a, b),
      sections_compared: sec.compared, sections_why: sec.why,
      why: events.length
        ? localize("doctypes.regulation.changes", "{count} change(s) to an instrument at the same address", { count: String(events.length) })
        : localize("doctypes.regulation.unchanged", "this instrument says what it said, and acts on the same things"),
    };
  },
};

export default counted(regulationType);
