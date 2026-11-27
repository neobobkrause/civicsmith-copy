/* A policy: one item of a numbered series a body or organisation issues (an administrative instruction, a general or
 * special order, a training bulletin, a board policy, a company's policy) (R25–R34; T35-12; POLICIES L2, PO13).
 *
 * MEASURED FIRST (R35). The reader was built only after its header reading was measured on 50 captured policies of
 * one city and its police department (`test/fixtures/policies.json`, read as the plane reads them) against a member's
 * reading of each header written before any reader existed: 46 of 50 headers read wholly right (92%; the record of
 * the measurement is the job record `build/jobs/T35/doctypes.md`). The four it misses are layouts no label reading
 * reaches without guessing: a series name misspelt in the document itself, a date printed with no label, a header
 * whose text layer lost a word of the series name, and a scanned two-column header the OCR interleaves.
 *
 * WHAT IS LOCAL AND WHAT IS NOT (R3, R20). Which series exist, how each is labelled and numbered, and the labels a
 * header prints are the active profiles' (`standard_sources` with `series`, jurisdictions R63; `policy_headers`,
 * R69). The outline numbering (I., A., 1., a., 1)), page furniture, calendar date shapes and the English words
 * that state applicability, a table of responsible parties and a period of time are place-free and stay here.
 *
 * READINGS, NEVER FORCE (R32). Nothing here says whether a provision is required, recommended, allowed or
 * discretionary, or who holds a discretion: a member confirms a force in `standards`, on the document's own words.
 * Nothing is recorded as a standard, a duty or a law relation (R15). A timeframe is a reading, never a deadline. */
import { CONFIDENCE, CONTRACT, alsoSatisfies } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful, bySeverity } from "../site-profiles/index.mjs";
import { readDefinitions, textDigest } from "./sections.mjs";
import { readHeader, headerAnchored, policySeries, headerLabels, HEADER_FIELDS } from "./policy-header.mjs";
import { lineIndex, counted, spend } from "./windows.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext, Connection, Entity } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { Section, Definition } from "./sections.mjs" */
/** @import { PolicyHeaderReading } from "./policy-header.mjs" */
/** @import { LineAt } from "./windows.mjs" */

/** @typedef {(offset: number) => ReadingPosition | null} Locate where an offset of the text stands in its source */
/** @typedef {{ readonly start: number, readonly end: number }} Extent a stretch of the text */
/**
 * An outline marker kind: its name, how a line opens with it, its first value and the value after a given one ("dashed"
 * has neither).
 * @typedef {Object} OutlineKind
 * @property {string} kind
 * @property {RegExp} re
 * @property {string | null} first
 * @property {((v: string) => string | null) | null} next
 */
/**
 * An outline level open while the outline is read.
 * @typedef {Object} OpenLevel
 * @property {string} kind
 * @property {number} rank
 * @property {string} value
 * @property {Section} entry
 */
/**
 * A marker kind a line opens with, and its match.
 * @typedef {Object} OutlineHit
 * @property {number} rank
 * @property {OutlineKind} k
 * @property {RegExpExecArray} m
 */
/**
 * Where a heading line takes its place in the outline.
 * @typedef {Object} Placing
 * @property {number} depth
 * @property {string} kind
 * @property {number} rank
 * @property {string} value
 * @property {string | undefined} rest
 */
/**
 * A reading of a passage with the section that holds it: the deepest section's path, or null and why none does.
 * @template T
 * @typedef {(T & { section: string[] }) | (T & { section: null, why: string })} Placed
 */
/**
 * A passage of the text and where it stands in its source.
 * @typedef {Object} Passage
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 */
/**
 * A row of a responsible-party and action table.
 * @typedef {Object} ResponsibilityRow
 * @property {string} party
 * @property {string} action
 * @property {string} step
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 */
/**
 * A responsible-party and action table listed unread, and why.
 * @typedef {Object} UnreadTable
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {string} why
 */
/**
 * The responsibility tables of a text: their rows, the tables listed unread, and the stretch each table takes.
 * @typedef {Object} ResponsibilitiesReading
 * @property {Placed<ResponsibilityRow>[]} rows
 * @property {Placed<UnreadTable>[]} unread
 * @property {Extent[]} extents
 */
/**
 * A passage stating a period or a time limit; `amount` and `units` only where the text states them plainly.
 * @typedef {Object} Timeframe
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {number} [amount]
 * @property {string} [units]
 */
/** @typedef {{ [path: string]: string }} SectionDigests each section's text digest, by its path joined with "/" */
/**
 * How many of each reading, and how many of each no section holds.
 * @typedef {Object} PolicyCounts
 * @property {number} sections
 * @property {number} definitions
 * @property {number} definitions_unplaced
 * @property {number} applicability
 * @property {number} applicability_unplaced
 * @property {number} responsibilities
 * @property {number} responsibilities_unplaced
 * @property {number} timeframes
 * @property {number} timeframes_unplaced
 * @property {number} responsibilities_unread
 */
/**
 * The policy readings of a text (`readPolicy`).
 * @typedef {Object} PolicyReadings
 * @property {PolicyHeaderReading | null} header
 * @property {string | null} header_why
 * @property {Section[]} sections
 * @property {string | null} sections_why
 * @property {SectionDigests} section_digests
 * @property {Definition[]} definitions
 * @property {Placed<Passage>[]} applicability
 * @property {Placed<ResponsibilityRow>[]} responsibilities
 * @property {Placed<UnreadTable>[]} responsibilities_unread
 * @property {Placed<Timeframe>[]} timeframes
 * @property {PolicyCounts} counts
 */
/**
 * What the policy type's `parse` hands back: the readings, with no entities, the other types the text also satisfies and
 * when it was read.
 * @typedef {PolicyReadings & { entities: Entity[], also_satisfies: string[], at: string | null }} PolicyReading
 */
/**
 * A policy reading as `assess` reads it back: a reading stored by an earlier version may lack any member, so each is read
 * as it may be missing.
 * @typedef {Object} AssessedPolicy
 * @property {PolicyHeaderReading | null} [header]
 * @property {Section[]} [sections]
 * @property {string | null} [sections_why]
 * @property {SectionDigests} [section_digests]
 * @property {Definition[]} [definitions]
 * @property {Placed<Passage>[]} [applicability]
 * @property {Placed<ResponsibilityRow>[]} [responsibilities]
 * @property {Placed<Timeframe>[]} [timeframes]
 */
/**
 * Whether a text is a policy, and why or on what signals.
 * @typedef {Object} PolicyDetection
 * @property {boolean} match
 * @property {string} confidence
 * @property {string} [why]
 * @property {string[]} [signals]
 */
/**
 * What moved between two readings of a policy.
 * @typedef {Object} PolicyAssessment
 * @property {boolean | null} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {null} confirmed
 * @property {boolean} [header_compared]
 * @property {string | null} header_why
 * @property {boolean} [sections_compared]
 * @property {string | null} sections_why
 * @property {string} why
 */
/**
 * The policy content type.
 * @typedef {Object} PolicyType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => PolicyDetection} detect
 * @property {(ctx: DoctypeContext) => PolicyReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => PolicyAssessment} assess
 * @property {boolean} [fallback] never present: this type is not the fallback
 * @property {((before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => ReadonlyArray<Connection> | null | undefined) | undefined} [connections] never present: this type implies no connections
 */

/** A value just found present (an index inside its list, an entry the pattern always fills); a missing one throws, as
 *  reading a member of `undefined` did.
 *  @template T
 *  @param {T | undefined} x
 *  @returns {T}
 *  @throws {TypeError} where `x` is missing */
function must(x) {
  if (x === undefined) throw new TypeError("Cannot read properties of undefined");
  return x;
}
/** A capture group the pattern always fills where it matched (the group is not optional).
 *  @param {RegExpExecArray} m @param {number} i @returns {string}
 *  @throws {TypeError} where the group took no part, which a match of these patterns never gives */
const group = (m, i) => must(m[i]);

/* ------------------------------------------------------------------------ lines */

/* R38: the lines of a text are held as offsets (./windows.mjs `lineIndex`) and a line is cut from the text when it is
   read, so a large text is never split into a list of its lines. */
const indentOf = /** @param {{ readonly text: string }} l @returns {number} */ (l) => l.text.length - l.text.trimStart().length;
/* Where a line's text starts after its indent (NaN for a line with no start, as `undefined + n` was). */
const textStart = /** @param {LineAt} l @returns {number} */ (l) => (l.start ?? NaN) + indentOf(l);
/* Page furniture, which no section is: a page counter, a bare page number. */
const FURNITURE = /^\s*(?:Page\s+\d+\s+of\s+\d+|\d{1,3})\s*$/i;
/* A line set in capitals. */
const caps = /** @param {string} t @returns {boolean} */ (t) => { const letters = t.replace(/[^A-Za-z]/g, ""); return letters.length >= 4 && t.replace(/[^A-Z]/g, "").length / letters.length >= 0.85; };
/* A line opening with an outline marker. */
const OUTLINE_LINE = /^\s*(?:[IVX]{1,5}|[A-Z]|\d{1,2}|[a-z])[.)]\s+\S/;
/* A table of contents' line: dot leaders, or a heading ending in its page number. */
const DOT_LEADERS = /\.{4,}/;
const PAGE_NUMBER_END = /\s\d{1,3}\s*$/;
/** Is this line a contents entry: dot leaders, or a heading with no lower-case letter that ends in its page number? Read
 *  in work linear in the line (R40): the heading is what stands before the page number, which is found from the line's end.
 *  @param {string} t @returns {boolean} */
function isTocLine(t) {
  if (DOT_LEADERS.test(t)) return true;
  const m = PAGE_NUMBER_END.exec(t);
  if (!m) return false;
  const head = t.slice(0, m.index);
  return !/[a-z]/.test(head) && /[A-Z]/.test(head);
}

/* ------------------------------------------------------------- the outline sections */

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI",
               "XVII", "XVIII", "XIX", "XX"];
const nextLetter = /** @param {string} v @returns {string | null} */ (v) => (/^[A-Ya-y]$/.test(v) ? String.fromCharCode(v.charCodeAt(0) + 1) : null);
/** The outline marker kinds, in the order an outline nests them (I., A., 1., a., 1)), each with how a line opens
 *  with it, its first value and the value after a given one.
 *  @type {ReadonlyArray<OutlineKind>} */
const KINDS = [
  { kind: "roman", re: /^([IVX]{1,5})\.[ \t]+(\S.*)?$/, first: "I", next: (v) => { const i = ROMAN.indexOf(v); return i >= 0 && i + 1 < ROMAN.length ? ROMAN[i + 1] ?? null : null; } },
  { kind: "upper", re: /^([A-Z])\.[ \t]+(\S.*)?$/, first: "A", next: nextLetter },
  /* "A - 1." numbers an item under its lettered part (a newer layout of the same outline). */
  { kind: "dashed", re: /^([A-Z])[ \t]*[-–][ \t]*(\d{1,2})\.[ \t]+(\S.*)?$/, first: null, next: null },
  { kind: "numeral", re: /^(\d{1,2})\.[ \t]+(\S.*)?$/, first: "1", next: (v) => String(Number(v) + 1) },
  { kind: "lower", re: /^([a-z])\.[ \t]+(\S.*)?$/, first: "a", next: nextLetter },
  { kind: "paren", re: /^\(?(\d{1,2})\)[ \t]+(\S.*)?$/, first: "1", next: (v) => String(Number(v) + 1) },
];

/** The value after `v` in a kind's sequence; a kind with no sequence ("dashed") throws, as calling its null `next` did.
 *  @param {OutlineKind} k @param {string} v @returns {string | null}
 *  @throws {TypeError} for a kind with no sequence */
function nextOf(k, v) {
  const next = k.next;
  if (next === null) throw new TypeError("k.next is not a function");
  return next(v);
}

/** Whether `b` comes after `a` in a kind's sequence.
 *  @param {OutlineKind} k @param {string} a @param {string | undefined} b @returns {boolean} */
function order(k, a, b) {
  let v = nextOf(k, a);
  for (let i = 0; i < 40; i++) {
    const at = v;
    if (at === null) break;
    if (at === b) return true;
    v = nextOf(k, at);
  }
  return false;
}

/** The sections of a policy's text after its header (R27): outline headings in document order, each `{path, number,
 *  heading, start, end, source}`; a marker is read only where it continues its level's sequence (B after A) or opens
 *  a new level at its first value, so a line of prose that happens to open with "3." is not a section.
 *  @param {string} raw
 *  @param {number} from
 *  @param {ReadonlyArray<Extent>} skip
 *  @param {Locate} locate
 *  @returns {Section[]} */
export function readOutline(raw, from, skip, locate) {
  const lines = lineIndex(raw);
  /** @type {Section[]} */
  const out = [];
  /** @type {OpenLevel[]} */
  const open = [];            // [{kind, value, entry}]
  const close = /** @param {number} depth @param {number} at @returns {void} */ (depth, at) => { while (open.length > depth) must(open.pop()).entry.end = at; };
  for (let li = 0; li < lines.length; li++) {
    const l = lines.at(li);
    const ls = l.start ?? NaN;
    if (ls < from || FURNITURE.test(l.text) || skip.some((s) => ls >= s.start && ls < s.end)) continue;
    const t = l.text.trim();
    if (isTocLine(t)) continue;
    /* A contents entry wrapped onto a second line, which carries its page number. */
    if (li + 1 < lines.length && isTocLine(lines.at(li + 1).text.trim()) && caps(t)) continue;
    /** @type {OutlineHit[]} */
    const hits = [];
    for (const [rank, k] of KINDS.entries()) { const m = k.re.exec(t); if (m) hits.push({ rank, k, m }); }
    /** @type {Placing | null} */
    let placed = null;
    /* "A - 1." under the open lettered part it names. */
    for (const { rank, k, m } of hits) {
      const kind = k.kind;
      if (kind !== "dashed") continue;
      const d = open.findIndex((o) => o.kind === "upper" && o.value === m[1]);
      if (d >= 0) placed = { depth: d + 1, kind, rank, value: group(m, 2), rest: m[3] };
    }
    /* A sibling continuing an open level's sequence, deepest first, of any kind the line could be ("I." after "H."
       is a letter). */
    for (let d = open.length - 1; d >= 0 && !placed; d--) {
      const o = must(open[d]);
      for (const { rank, k, m } of hits)
        if (!placed && k.kind !== "dashed" && o.kind === k.kind && nextOf(k, o.value) === m[1])
          placed = { depth: d, kind: k.kind, rank, value: group(m, 1), rest: m[2] };
    }
    /* Else a new level at its first value, nested under the open levels an outline ranks above it (a numbered list
       before "I." does not hold "I."). A heading set in capitals may open a level, or follow its open sibling, at
       another value: a part printed alone ("III. PERFORMANCE REVIEW" in an order that replaces only Part III). */
    for (const { rank, k, m } of hits) {
      if (placed || k.kind === "dashed") break;
      let d = open.findIndex((o) => o.rank >= rank);
      if (d < 0) d = open.length;
      const g2 = m[2];
      const heading = g2 ? g2.trim() : "";
      const capsHeading = heading.length >= 4 && heading.replace(/[^A-Z]/g, "").length / Math.max(1, heading.replace(/[^A-Za-z]/g, "").length) >= 0.85;
      const od = open[d];
      const sameOpen = od && od.kind === k.kind ? od : null;
      if (m[1] === k.first && (!sameOpen || capsHeading)) placed = { depth: d, kind: k.kind, rank, value: group(m, 1), rest: m[2] };
      else if (capsHeading && (!sameOpen || order(k, sameOpen.value, m[1]))) placed = { depth: d, kind: k.kind, rank, value: group(m, 1), rest: m[2] };
    }
    const p = placed;
    if (!p) continue;
    const at = textStart(l);
    close(p.depth, at);
    const parent = p.depth ? must(open[p.depth - 1]).entry : null;
    const path = parent ? [...parent.path, p.value] : [p.value];
    const rest = p.rest;
    /** @type {Section} */
    const entry = { path, number: path.join("."), heading: rest ? rest.trim().slice(0, 300) : null,
                    start: at, end: raw.length, source: locate(at) || null };
    out.push(entry);
    open.push({ kind: p.kind, rank: p.rank, value: p.value, entry });
  }
  close(0, raw.length);
  return out;
}

/** The deepest section holding `offset`, or null.
 *  @param {ReadonlyArray<Section>} sections @param {number} offset @returns {Section | null} */
function holder(sections, offset) {
  /** @type {Section | null} */
  let best = null;
  for (const s of sections) { const b = best; if (offset >= s.start && offset < s.end && (!b || s.path.length > b.path.length)) best = s; }
  return best;
}
const UNPLACED = /** @param {ReadonlyArray<Section>} sections @returns {string} */ (sections) => (sections.length
  ? localize("doctypes.policy.unplaced", "no section read from this policy holds this passage (it stands before the first outline heading)")
  : localize("doctypes.policy.not_divided", "this policy's text was not divided into sections, so no section can be named for this passage"));
/** `item` with the path of the deepest section holding its start, or null and why none does.
 *  @template {{ readonly start: number }} T
 *  @param {ReadonlyArray<Section>} sections @param {T} item @returns {Placed<T>} */
function placed(sections, item) {
  const s = holder(sections, item.start);
  return s ? { ...item, section: s.path } : { ...item, section: null, why: UNPLACED(sections) };
}

/* --------------------------------------------------------- definitions (R28) */

const DEFINITIONS_HEADING = /^definitions?\b/i;
/** The definitions of a policy: the definitional voice (R13's), and each entry of a section headed as definitions,
 *  its term the entry's heading up to the dash or colon that opens its meaning. A term given twice gives two.
 *  @param {string} raw
 *  @param {ReadonlyArray<Section>} sections
 *  @param {Locate} locate
 *  @returns {Definition[]} */
export function readPolicyDefinitions(raw, sections, locate) {
  /** @type {Definition[]} */
  const out = readDefinitions(raw, sections, locate).map((d) => {
    /** @type {Definition} */
    const o = { term: d.term, start: d.start, end: d.end, source: d.source, section: d.section };
    const why = d.why;
    if (why) o.why = why;
    return o;
  });
  for (const s of sections) {
    const sh = s.heading;
    if (!sh || !DEFINITIONS_HEADING.test(sh)) continue;
    for (const c of sections) {
      const ch = c.heading;
      if (c.path.length !== s.path.length + 1 || c.path.slice(0, -1).join("/") !== s.path.join("/") || !ch) continue;
      const term = must(ch.split(/\s+[-–—]\s+|:\s|\s*[-–—]\s*(?=[A-Z])/)[0]).replace(/[.:]+$/, "").trim();
      if (!term || term.length > 100) continue;
      if (out.some((d) => d.start >= c.start && d.start < c.end && d.term.toLowerCase() === term.toLowerCase())) continue;
      out.push({ term, start: c.start, end: c.end, source: c.source, section: c.path });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/* --------------------------------------------------------- applicability (R29) */

const APPLIES_HEADING = /^(?:applicability|scope|eligibility)\b/i;
const APPLIES = /\b(?:this\s+(?:order|policy|instruction|directive|special\s+order|general\s+order|procedure|bulletin|regulation|administrative\s+instruction)\s+(?:shall\s+)?appl(?:y|ies)\s+to|appl(?:y|ies)\s+to\s+all|(?:is|are)\s+applicable\s+to|shall\s+apply\s+to)\b/gi;

/** @param {string} raw @param {number} at @param {number} endAt @returns {Extent} */
function sentenceAround(raw, at, endAt) {
  let start = at;
  while (start > 0 && !/[.;:]\s/.test(raw.slice(start - 2, start)) && raw[start - 1] !== "\n" ) start--;
  /* Back over a line break inside a sentence: the previous line did not end it, and is not a heading. */
  const prevLine = /** @param {number} at @returns {string} */ (at) => raw.slice(raw.lastIndexOf("\n", at - 2) + 1, at - 1);
  while (start > 0 && raw[start - 1] === "\n" && !/[.;:]\s*$/.test(prevLine(start))
         && !OUTLINE_LINE.test(prevLine(start)) && !caps(prevLine(start))) {
    start = raw.lastIndexOf("\n", start - 2) + 1;
    const stop = raw.slice(start, at).search(/[.;:]\s(?=\S)/);
    if (stop >= 0) { start += stop + 2; break; }
  }
  while (start < at && /\s/.test(raw[start] ?? "")) start++;
  const m = /[.;](?=\s|$)/.exec(raw.slice(endAt));
  const end = m ? endAt + m.index + 1 : raw.length;
  return { start, end };
}

/** Each passage stating to whom or what the policy applies (R29): a section headed so, and each sentence in the
 *  applying voice; an extent, never resolved to an office, unit or person.
 *  @param {string} raw
 *  @param {ReadonlyArray<Section>} sections
 *  @param {number} from
 *  @param {Locate} locate
 *  @returns {Placed<Passage>[]} */
export function readApplicability(raw, sections, from, locate) {
  /** @type {Placed<Passage>[]} */
  const out = [];
  for (const s of sections) {
    const sh = s.heading;
    if (sh && APPLIES_HEADING.test(sh)) out.push(placed(sections, { start: s.start, end: s.end, source: s.source }));
  }
  /* `matchAll` reads a copy of the pattern, so APPLIES's own lastIndex stays 0 and needs no reset. */
  for (const m of raw.matchAll(APPLIES)) {
    if (m.index < from) continue;
    const { start, end } = sentenceAround(raw, m.index, m.index + m[0].length);
    if (out.some((x) => start >= x.start && start < x.end)) continue;
    out.push(placed(sections, { start, end, source: locate(start) || null }));
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ---------------------------------------------------- responsibilities (R30) */

const TABLE_HEAD = /^\s*Responsible\s+Part(?:y|ies)\s*(?:\/|\s)\s*Actions?\s*$/i;
const STEP = /^(.*?)(?:^|\s)(\d{1,2})\.[ \t]+(\S.*)$/;

/** The rows of each two-column responsible-party and action table (R30), `{party, action, step, start, end, source,
 *  section}` in row order. A party is the text before its first numbered action, on that action's line or on the lines
 *  above it after the last action ended; where an action does not end before the next party's numbering starts again,
 *  the columns cannot be told apart and the table is listed unread, never split by guess.
 *  @param {string} raw
 *  @param {ReadonlyArray<Section>} sections
 *  @param {number} from
 *  @param {Locate} locate
 *  @returns {ResponsibilitiesReading} */
export function readResponsibilities(raw, sections, from, locate) {
  const lines = lineIndex(raw);
  /* A line's start; NaN for an index with none, which compares and adds as the `undefined` it was. */
  const lineStart = /** @param {number} j @returns {number} */ (j) => lines.start(j) ?? NaN;
  /** @type {Placed<ResponsibilityRow>[]} */
  const rows = [];
  /** @type {Placed<UnreadTable>[]} */
  const unread = [];
  /** @type {Extent[]} */
  const extents = [];
  /* The tables first: each one's head and the line its section (or the next roman heading) ends it at. */
  /** @type {{ i: number, head: LineAt, stop: number }[]} */
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines.at(i);
    const hs = head.start ?? NaN;
    if (hs < from || !TABLE_HEAD.test(head.text)) continue;
    const sec = holder(sections, hs);
    /* The table runs to the end of the section holding it, or to the next outline heading of a roman level. */
    let stop = sec ? sec.end : raw.length;
    for (let j = i + 1; j < lines.length && lineStart(j) < stop; j++)
      if (/^\s*[IVX]{1,5}\.\s+\S/.test(lines.at(j).text)) { stop = lineStart(j); break; }
    tables.push({ i, head, stop });
  }
  /* A running header or footer (a line printed three times or more that ends no sentence) is page furniture, never a
     party. Only the lines a table holds can be taken for one, so only those are counted, in one pass over the text. */
  /** @type {[string, number][]} */
  const none = [];
  const recurs = new Map(none);
  if (tables.length) {
    for (const { i, stop } of tables)
      for (let j = i + 1; j < lines.length && lineStart(j) < stop; j++) {
        const l = lines.at(j), t = l.text.trim();
        if (t && !FURNITURE.test(l.text)) recurs.set(t, 0);
      }
    for (let j = 0; j < lines.length; j++) {
      const t = lines.at(j).text.trim();
      if (recurs.has(t)) recurs.set(t, (recurs.get(t) ?? NaN) + 1);
    }
  }
  for (const { i, head, stop } of tables) {
    /** @type {{ party: string, step: string, start: number, aStart: number, end: number }[]} */
    const table = [];
    /** @type {{ text: string, start: number } | null} */
    let party = null;
    /** @type {LineAt[]} */
    let pending = [];
    /** @type {{ party: string, step: string, start: number, aStart: number, lastEnd: number } | null} */
    let cur = null;
    /** @type {string | null} */
    let why = null;
    let ok = true, expect = 1;
    const finish = () => { const c = cur; if (c) { table.push({ party: c.party, step: c.step, start: c.start, aStart: c.aStart, end: c.lastEnd }); cur = null; } };
    for (let j = i + 1; j < lines.length && lineStart(j) < stop; j++) {
      const l = lines.at(j);
      if (!l.text.trim() || FURNITURE.test(l.text) || ((recurs.get(l.text.trim()) || 0) >= 3 && !/[.;:]\s*$/.test(l.text))) continue;
      const found = STEP.exec(l.text.trim());
      const m0 = found ? { lead: group(found, 1), num: group(found, 2) } : null;
      /* Only a first action is printed beside its party; any other number opens its line. */
      const m1 = m0 && m0.lead.trim() && Number(m0.num) !== 1 ? null : m0;
      /* Beside a first action, the party is what follows the last sentence the line ends: the text before it
         continues the previous action. */
      const beside = !!m1 && !!m1.lead.trim();
      const cut = m1 && beside ? m1.lead.search(/[.;:]\s+(?=\S)(?!.*[.;:]\s+\S)/) : -1;
      const carried = cut >= 0 ? cut + 1 : 0;
      const m2 = m1 && cut >= 0 ? { lead: m1.lead.slice(cut + 1), num: m1.num } : m1;
      const m = m2 && beside && m2.lead.trim().split(/\s+/).length > 8 ? null : m2;
      const n = m ? Number(m.num) : null;
      /* A step a little past the one expected is still the table's next (a page's footer printed into a line can
         hide a step's number, whose text then stays with the step before). */
      if (m && n !== null && ((n >= expect && n <= expect + 2 && n > 1 && cur) || (n === 1 && (m.lead.trim() || pending.length || cur)))) {
        if (n === 1) {
          const inline = m.lead.trim();
          /* The party's name: the short lines just above, after the last that ends a sentence; the lines before
             them continue the previous action. */
          let k = pending.length;
          if (!inline) while (k > 0 && !/[.;:]\s*$/.test(must(pending[k - 1]).text) && must(pending[k - 1]).text.trim().split(/\s+/).length <= 8) k--;
          const c = cur;
          if (c && k > 0) c.lastEnd = must(pending[k - 1]).end;
          if (c && carried) c.lastEnd = textStart(l) + carried;
          pending = inline ? [] : pending.slice(k);
          if (!inline && !pending.length) { ok = false; why = localize("doctypes.policy.no_party_numbering", "a numbering that starts again at 1 has no party beside it or above it that can be told from the action before"); break; }
          if (c && !inline && !/[.;:]\s*$/.test(raw.slice(c.start, c.lastEnd))) {
            ok = false; why = localize("doctypes.policy.action_unbounded", "an action does not end before the next party's numbering starts, so where it stops and the next party begins cannot be told"); break;
          }
          finish();
          const pStart = pending.length ? textStart(must(pending[0])) : textStart(l);
          const pEnd = inline ? textStart(l) + l.text.trim().indexOf(m.lead) + m.lead.trimEnd().length : must(pending[pending.length - 1]).end;
          party = { text: raw.slice(pStart, pEnd).replace(/\s+/g, " ").trim(), start: pStart };
          pending = [];
          expect = 1;
        } else {
          /* Lines between two numbered actions continue the first. */
          const c = cur;
          if (c && pending.length) c.lastEnd = must(pending[pending.length - 1]).end;
          pending = [];
          finish();
        }
        const aStart = textStart(l) + l.text.trim().indexOf(`${m.num}.`, m.lead.length ? m.lead.length : 0);
        const pt = party;
        if (!pt) throw new TypeError("Cannot read properties of null (reading 'text')");
        cur = { party: pt.text, step: m.num, start: m.lead.trim() && n === 1 ? pt.start : aStart, aStart, lastEnd: l.end };
        expect = n + 1;
        continue;
      }
      const c = cur;
      if (c && !/[.;:]\s*$/.test(raw.slice(c.start, c.lastEnd))) { c.lastEnd = l.end; continue; }
      if (!cur && !party) { pending.push(l); continue; }
      /* After an action that ended: either its continuation's next sentence or the next party's name. */
      pending.push(l);
    }
    const c = cur;
    if (ok && c && pending.length) { c.lastEnd = must(pending[pending.length - 1]).end; pending = []; }
    finish();
    const start = textStart(head);
    extents.push({ start, end: stop });
    if (!ok || !table.length) {
      unread.push(placed(sections, { start, end: stop, source: locate(start) || null,
        why: why || localize("doctypes.policy.table_no_action", "the table's header is printed but no numbered action under a party is read below it") }));
      continue;
    }
    for (const r of table) {
      const action = raw.slice(r.aStart, r.end).replace(/^\d{1,2}\.\s*/, "").replace(/\s+/g, " ").trim();
      rows.push(placed(sections, { party: r.party, action, step: r.step, start: r.start, end: r.end, source: locate(r.start) || null }));
    }
  }
  return { rows, unread, extents };
}

/* ---------------------------------------------------------- timeframes (R31) */

/** @type {ReadonlyMap<string, number>} */
const WORDS = new Map([["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8],
                       ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12], ["fifteen", 15], ["twenty", 20], ["thirty", 30],
                       ["forty", 40], ["forty-five", 45], ["sixty", 60], ["ninety", 90]]);
const AMOUNT = `(?:\\d{1,4}|${[...WORDS.keys()].join("|")})(?:[ \\t]*\\(\\d{1,4}\\))?`;
const UNIT = "(?:minutes?|hours?|(?:calendar|business|working)[ \\t]+days?|days?|weeks?|months?|years?)";
const TIMEFRAME = new RegExp(`\\b(?:(?:within|no[ \\t]+later[ \\t]+than|not[ \\t]+later[ \\t]+than|no[ \\t]+more[ \\t]+than|not[ \\t]+to[ \\t]+exceed|at[ \\t]+least|every|prior[ \\t]+to|in[ \\t]+excess[ \\t]+of)[ \\t]+)?(?:the[ \\t]+)?(?<amount>${AMOUNT})[ \\t-]*(?<unit>${UNIT})\\b|\\b(?<every>annually|semi-annually|biannually|quarterly|monthly|weekly|daily|biennially)\\b`, "gi");
const UNITS = /** @param {string} u @returns {string | null} */ (u) => {
  const s = u.toLowerCase().replace(/\s+/g, " ");
  if (/business|working/.test(s)) return "business_days";
  for (const k of ["minute", "hour", "day", "week", "month", "year"]) if (s.includes(k)) return `${k}s`;
  return null;
};

/** Each passage stating a period or a time limit (R31), `{text, amount?, units?, start, end, source, section}`;
 *  `amount` and `units` only where the text states them plainly. A reading, never a deadline.
 *  @param {string} raw
 *  @param {ReadonlyArray<Section>} sections
 *  @param {number} from
 *  @param {Locate} locate
 *  @returns {Placed<Timeframe>[]} */
export function readTimeframes(raw, sections, from, locate) {
  /** @type {Placed<Timeframe>[]} */
  const out = [];
  /* `matchAll` reads a copy of the pattern, so TIMEFRAME's own lastIndex stays 0 and needs no reset. */
  for (const m of raw.matchAll(TIMEFRAME)) {
    if (m.index < from) continue;
    /** @type {Timeframe} */
    const t = { text: m[0].replace(/\s+/g, " "), start: m.index, end: m.index + m[0].length, source: locate(m.index) || null };
    const groups = must(m.groups);
    const amountText = groups.amount;
    if (amountText) {
      const a = amountText.toLowerCase();
      const digits = /\((\d{1,4})\)/.exec(a) || /^(\d{1,4})/.exec(a);
      const amount = digits ? Number(digits[1]) : WORDS.get(a.trim());
      if (amount !== undefined && Number.isFinite(amount)) t.amount = amount;
      const units = UNITS(must(groups.unit));
      if (units && t.amount !== undefined) t.units = units;
    }
    out.push(placed(sections, t));
  }
  return out;
}

/* ------------------------------------------------------------------ the type */

/* How many of a reading's items no section holds. */
const unplaced = /** @param {ReadonlyArray<{ readonly section: ReadonlyArray<string> | null }>} list @returns {number} */ (list) => list.filter((x) => x.section === null).length;
/** The policy readings of a text (R26–R31, R33).
 *  @param {DoctypeContext} ctx
 *  @param {string} raw
 *  @param {Locate} [locate]
 *  @returns {PolicyReadings} */
export function readPolicy(ctx, raw, locate = () => null) {
  const h = readHeader(ctx, raw, locate);
  const hd = h.header;
  const from = hd ? hd.end : 0;
  const resp = readResponsibilities(raw, [], from, locate);
  const sections = readOutline(raw, from, resp.extents, locate);
  const responsibilities = readResponsibilities(raw, sections, from, locate);
  const definitions = readPolicyDefinitions(raw, sections, locate).filter((d) => d.start >= from);
  const applicability = readApplicability(raw, sections, from, locate);
  const timeframes = readTimeframes(raw, sections, from, locate);
  /** @type {SectionDigests} */
  const digests = {};
  for (const s of sections) digests[s.path.join("/")] = textDigest(raw, s.start, s.end);
  /** @type {PolicyCounts} */
  const counts = {
    sections: sections.length,
    definitions: definitions.length, definitions_unplaced: unplaced(definitions),
    applicability: applicability.length, applicability_unplaced: unplaced(applicability),
    responsibilities: responsibilities.rows.length, responsibilities_unplaced: unplaced(responsibilities.rows),
    timeframes: timeframes.length, timeframes_unplaced: unplaced(timeframes),
    responsibilities_unread: responsibilities.unread.length,
  };
  return {
    header: h.header, header_why: h.why,
    sections, sections_why: sections.length ? null
      : localize("doctypes.policy.no_outline", "no outline heading (I., A., 1.) opens a line of this policy after its header, so its text is not divided into sections"),
    section_digests: digests,
    definitions, applicability, responsibilities: responsibilities.rows, responsibilities_unread: responsibilities.unread,
    timeframes, counts,
  };
}

/** @type {PolicyType} */
const POLICY = {
  key: "policy",
  label: localize("doctypes.policy.label", "a policy of a numbered series"),
  version: 1,
  /* A policy says what it says: its substance is the unit (R25, R4). */
  contract: CONTRACT.SUBSTANCE,

  /** Is this a policy? CERTAIN only when its header names a series the view gives, with a number that series reads
   *  (R25); never otherwise. */
  detect(ctx) {
    const series = policySeries(ctx);
    if (!series.length || !headerLabels(ctx).length)
      return { match: false, confidence: CONFIDENCE.NONE,
               why: localize("doctypes.policy.no_series_supplied", "the active jurisdiction profiles supply no policy series or no policy header labels, so no document is read as a policy") };
    /* R37: a header's type is read only from an anchor, so a text with none is refused without being cut into lines. */
    const text = String(ctx.text || "");
    spend(text.length * series.length);   // the search for an anchor reads the text once for each series
    const hd = headerAnchored(ctx, text) ? readHeader(ctx, text).header : null;
    const type = hd ? hd.type : undefined;
    if (!hd || !type)
      return { match: false, confidence: CONFIDENCE.NONE,
               why: localize("doctypes.policy.no_series_line", "no line of this text opens with a policy series the active profiles name, beside the header labels they give") };
    const number = hd.number;
    if (!number)
      return { match: false, confidence: CONFIDENCE.NONE,
               why: localize("doctypes.policy.no_series_number", "the header names {type} but carries no number that series reads, so it is not read as one of its items", { type: String(type.text) }) };
    return { match: true, confidence: CONFIDENCE.CERTAIN,
             signals: [localize("doctypes.policy.header_names", "a header naming {type} {number}", { type: String(type.text), number: String(number.text) }),
                       `${HEADER_FIELDS.length - hd.missing.length} header field(s) read`] };
  },

  parse(ctx) {
    const raw = String(ctx.text || "");
    const given = ctx.locate;
    const locate = typeof given === "function" ? given : () => null;
    return { entities: [], ...readPolicy(ctx, raw, locate), also_satisfies: alsoSatisfies(ctx, "policy"), at: ctx.at || null };
  },

  /** What moved between two readings of a policy (R34): a header field, or a section's heading, text, definitions,
   *  applicability, responsibilities or timeframes, each an `instrument_changed` naming the field or the section's
   *  path; a section read on one side only names which. A reading neither side read is said, never claimed. */
  assess(a, b) {
    /* A missing reading throws, as reading its header did. */
    if (!isAssessedPolicy(a)) throw new TypeError(`Cannot read properties of ${a} (reading 'header')`);
    if (!isAssessedPolicy(b)) throw new TypeError(`Cannot read properties of ${b} (reading 'header')`);
    /** @type {EventHead[]} */
    const events = [];
    const ha = a.header || null, hb = b.header || null;
    /** @type {string | null} */
    let headerWhy = null;
    if (ha && hb) {
      for (const f of HEADER_FIELDS) {
        const va = ha[f], vb = hb[f];
        const was = va ? ("date" in va ? va.date || va.text : va.text) : null, now = vb ? ("date" in vb ? vb.date || vb.text : vb.text) : null;
        if (String(was || "") !== String(now || ""))
          events.push(event("instrument_changed", { key: `header.${f}`, was, now,
            why: localize("doctypes.policy.header_changed", "this policy's {field} as its header states it is not what it was at this address", { field: f.replace("_", " ") }) }));
      }
    } else headerWhy = ha || hb
      ? localize("doctypes.policy.header_one_side", "only one of the readings gave a header, so nothing is said about the header")
      : localize("doctypes.policy.header_neither", "neither reading gave a header, so nothing is said about the header");
    const as = a.sections, bs = b.sections;
    const sa = Array.isArray(as) ? as : [], sb = Array.isArray(bs) ? bs : [];
    /** @type {string | null} */
    let sectionsWhy = null;
    if (sa.length && sb.length) {
      const entry = /** @param {Section} s @returns {[string, Section]} */ (s) => [s.path.join("/"), s];
      const ma = new Map(sa.map(entry)), mb = new Map(sb.map(entry));
      const da = a.section_digests, db = b.section_digests;
      /** @type {SectionDigests} */
      const noDigests = {};
      /* What a reading holds in one section, so two readings can be compared section by section. */
      const shows = [
        { list: "definitions", of: /** @param {AssessedPolicy} x @param {string} k @returns {string} */ (x, k) => inSec(x.definitions, k, (d) => d.term) },
        { list: "applicability", of: /** @param {AssessedPolicy} x @param {string} k @returns {string} */ (x, k) => inSec(x.applicability, k, (p) => p.end - p.start) },
        { list: "responsibilities", of: /** @param {AssessedPolicy} x @param {string} k @returns {string} */ (x, k) => inSec(x.responsibilities, k, (r) => `${r.party}\u0001${r.step}\u0001${r.action}`) },
        { list: "timeframes", of: /** @param {AssessedPolicy} x @param {string} k @returns {string} */ (x, k) => inSec(x.timeframes, k, (t) => t.text) },
      ];
      for (const [k, was] of ma) {
        const now = mb.get(k);
        if (!now) { events.push(event("instrument_changed", { key: "section", section: was.path, was: was.number, now: null,
          why: localize("doctypes.policy.section_gone", "section {number} was read before and is not read now", { number: String(was.number) }) })); continue; }
        /** @type {string[]} */
        const moved = [];
        if (String(was.heading || "") !== String(now.heading || "")) moved.push("heading");
        if (((da || noDigests)[k] || null) !== ((db || noDigests)[k] || null)) moved.push("text");
        for (const { list, of } of shows) if (of(a, k) !== of(b, k)) moved.push(list);
        if (moved.length) events.push(event("instrument_changed", { key: "section", section: now.path, moved,
          was: was.heading || was.number, now: now.heading || now.number,
          why: localize("doctypes.policy.section_changed", "section {number}'s {moved} is not what it was at this address", { number: String(now.number), moved: moved.join(", ") }) }));
      }
      for (const [k, now] of mb) if (!ma.has(k)) events.push(event("instrument_changed", { key: "section", section: now.path,
        was: null, now: now.number, why: localize("doctypes.policy.section_added", "section {number} is read now and was not read before", { number: String(now.number) }) }));
    } else {
      const why = b.sections_why || a.sections_why || "neither reading carries sections";
      sectionsWhy = sa.length || sb.length
        ? localize("doctypes.policy.sections_one_side", "only one of the readings gave sections, so nothing is said about sections: {why}", { why: String(why) })
        : localize("doctypes.policy.sections_neither", "neither reading gave sections, so nothing is said about sections: {why}", { why: String(why) });
    }
    const hw = headerWhy, sw = sectionsWhy;
    if (hw && sw)
      return { meaningful: null, significance: null, events: [], confirmed: null, header_why: hw, sections_why: sw,
               why: localize("doctypes.policy.unread", "nothing could be read from this policy on one side or the other, so nothing is claimed about it either way") };
    bySeverity(events);
    return {
      meaningful: isMeaningful(events), significance: worstSignificance(events), events, confirmed: null,
      header_compared: !hw, header_why: hw, sections_compared: !sw, sections_why: sw,
      why: events.length ? localize("doctypes.policy.changes", "{count} change(s) between two readings of a policy at the same address", { count: String(events.length) })
        : localize("doctypes.policy.unchanged", "this policy reads as it read: the same header and the same sections"),
    };
  },
};

/** Whether a value handed to `assess` is a policy reading as `assess` reads one back: anything but a missing value, as
 *  every member it reads may be missing (`AssessedPolicy`).
 *  @param {object | null | undefined} x
 *  @returns {x is AssessedPolicy} */
function isAssessedPolicy(x) { return x !== null && x !== undefined; }

/** What a reading holds in one section: the `show` of each of its `items` the section at path `k` holds, joined.
 *  @template {{ readonly section: ReadonlyArray<string> | null }} T
 *  @param {T[] | undefined} items @param {string} k @param {(y: T) => string | number} show @returns {string} */
function inSec(items, k, show) {
  return (Array.isArray(items) ? items : []).filter((y) => { const s = y.section; return s && s.join("/") === k; }).map((y) => show(y)).join("\u0000");
}

export default counted(POLICY);
