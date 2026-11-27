/* The header block of a policy (R26): what the document claims about itself — its series and
 * number, title, effective date, what it supersedes, its references, its coordinator, when its
 * review is due and its revision cycle — each read by the labels the active profiles give for
 * it (`vocabulary.policy_headers`, jurisdictions R69), never by labels held here, and its series
 * by the view's `standard_sources` entries with `series` (jurisdictions R63).
 *
 * MEASURED FIRST (R35) on 50 captured policies of one city and its police department
 * (`test/fixtures/policies.json`), against a member's reading of each header written before this
 * reader existed (`test/fixtures/policies-answers.json`). What is place-free and stays here: the
 * outline numbering (I., A., 1.), page furniture ("Page 1 of 28", a bare page number, a table of
 * contents), calendar date shapes, and that a label is followed by its value.
 *
 * HOW A HEADER IS FOUND. The header is anchored where a line opens with a series' label and the
 * series' number follows it (a series whose number is printed under its own label, as an
 * administrative instruction prints "NUMBER 71", is anchored by its label alone). A label a
 * printed layout scatters across lines ("DEPARTMENTAL / GENERAL / ORDER") is matched word by word
 * at the opening of successive lines. The block runs from the start of the anchor's page (a
 * boxed layout prints some labels above the series name) to the first line of page furniture,
 * outline heading or body text after the anchor; a revision memorandum in front of an order is
 * on an earlier page, so its own TO/DATE/SUBJECT are never the order's.
 *
 * WHAT IS NEVER DONE (R26). A date that is not a whole calendar date (a placeholder such as
 * "XX XX 21") is kept as written with `date: null` and why, never completed. A field not read is
 * absent and named in `missing`. Whether this copy is in force is not this reader's question. */
import { readerView, vocabulary, vocabRegex } from "../docprofile/doctypes/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext } from "../docprofile/doctypes/index.mjs" */
/** @import { NormalPart, PolicyHeaderField, View, ViewStandardSource } from "../jurisdictions/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */

/**
 * A policy series the view names (jurisdictions R63), compiled for reading a header: its key (`<issuer>.<series>`), the
 * series' and issuer's keys, its label's recogniser (global, multi-line) and the label as the profile writes it, the
 * recognisers of a number alone (with its group `number`), of a number after the label (the number in group 1) and of
 * its citation (global), each null where the profile gives no citation pattern or it does not compile, and the
 * number's normal-form parts (jurisdictions R3), or null.
 * @typedef {Object} PolicySeries
 * @property {string} key
 * @property {string} series
 * @property {string} issuer
 * @property {RegExp} label
 * @property {string} labelText
 * @property {RegExp | null} numberOnly
 * @property {RegExp | null} number
 * @property {RegExp | null} cite
 * @property {ReadonlyArray<NormalPart> | null} normal
 */
/**
 * A header label the view gives (jurisdictions R69): its field and its recogniser (global, multi-line), which takes the
 * label's colon with it.
 * @typedef {Object} HeaderLabel
 * @property {PolicyHeaderField} field
 * @property {RegExp} re
 */
/**
 * Where the locator puts a character offset of the text (DoctypeContext's `locate`), or null.
 * @typedef {(offset: number) => ReadingPosition | null} HeaderLocate
 */
/**
 * A whole calendar date read off a text: the date (`YYYY-MM-DD`), where it begins in the text, and the text as printed.
 * @typedef {Object} DateRead
 * @property {string} date
 * @property {number} index
 * @property {string} text
 */
/**
 * A header field as read: its text as written (lines joined by a space), its extent in the raw text, where the
 * locator puts its start, and, on a field R35 measured below target (`BELOW_TARGET`), `measured`.
 * @typedef {Object} HeaderValue
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {"below_target"} [measured]
 */
/**
 * A date field as read (`effective`, `review_due`): a header field with its calendar date, or `date: null` and `why`
 * where it is printed as a placeholder and kept as written (R26).
 * @typedef {Object} DateValue
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {string | null} date
 * @property {string} [why]
 * @property {"below_target"} [measured]
 */
/**
 * The header's series (`type`), read from its anchor: the label as printed, the series' key (`<issuer>.<series>`) and
 * the series' own key.
 * @typedef {Object} TypeValue
 * @property {string} text
 * @property {string} key
 * @property {string} series
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 */
/**
 * The header's number: as printed, and its normal form where the series reads it (jurisdictions R63, R3).
 * @typedef {Object} NumberValue
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {string} [normal]
 */
/**
 * The header's title.
 * @typedef {Object} TitleValue
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 */
/**
 * The header's fields as read, each absent where it was not read.
 * @typedef {Object} HeaderFields
 * @property {TypeValue} [type]
 * @property {NumberValue} [number]
 * @property {TitleValue} [title]
 * @property {DateValue} [effective]
 * @property {HeaderValue} [supersedes]
 * @property {HeaderValue} [reference]
 * @property {HeaderValue} [coordinator]
 * @property {DateValue} [review_due]
 * @property {HeaderValue} [revision_cycle]
 */
/**
 * Why each field not read (or a number not in the series' form) was not, by field.
 * @typedef {Object} HeaderWhy
 * @property {string} [type]
 * @property {string} [number]
 * @property {string} [title]
 * @property {string} [effective]
 * @property {string} [supersedes]
 * @property {string} [reference]
 * @property {string} [coordinator]
 * @property {string} [review_due]
 * @property {string} [revision_cycle]
 */
/**
 * The header block of a policy (R26): its fields as read, the fields not read (in `HEADER_FIELDS`' order) and why, the
 * block's extent in the raw text, and `block_cut` where the block was cut at its length bound (R40).
 * @typedef {Object} PolicyHeaderBlock
 * @property {PolicyHeaderField[]} missing
 * @property {HeaderWhy} missing_why
 * @property {number} start
 * @property {number} end
 * @property {true} [block_cut]
 */
/** @typedef {HeaderFields & PolicyHeaderBlock} PolicyHeaderReading */
/**
 * What `readHeader` hands back: the header block and `why: null`, or `header: null` and why no header was read.
 * @typedef {{ header: PolicyHeaderReading, why: null } | { header: null, why: string }} HeaderRead
 */
/**
 * A line of the raw text: its extent and its text.
 * @typedef {Object} Line
 * @property {number} start
 * @property {number} end
 * @property {string} text
 */
/**
 * Where a header may be anchored: the series, the label's extent, and its number's where printed beside it.
 * @typedef {Object} Anchor
 * @property {PolicySeries} series
 * @property {number} start
 * @property {number} end
 * @property {{ start: number, text: string, end: number } | null} number
 */
/**
 * A label printed in the header block: its field and its extent.
 * @typedef {Object} LabelHit
 * @property {PolicyHeaderField} field
 * @property {number} start
 * @property {number} end
 */
/** @typedef {LabelHit & { vEnd: number }} LabelSpan */

/** @type {ReadonlyArray<PolicyHeaderField>} */
export const HEADER_FIELDS = Object.freeze(["type", "number", "title", "effective", "supersedes", "reference",
                                            "coordinator", "review_due", "revision_cycle"]);
/** @type {ReadonlySet<string>} */
const DATE_FIELDS = new Set(["effective", "review_due"]);
/* The fields R35's out-of-sample measure (2026-10-07, 24 fresh policies) read correctly for fewer than 90% of the
   policies printing them: each carries `measured: "below_target"`, so a member checks it before relying on it, until a
   later out-of-sample measure reads it at 90% or more (R26; K2079). */
/** @type {ReadonlyArray<"coordinator" | "review_due" | "revision_cycle">} */
export const BELOW_TARGET = Object.freeze(["coordinator", "review_due", "revision_cycle"]);
/** @type {ReadonlySet<string>} */
const ONE_LINE = new Set(["number", "revision_cycle"]);

/** The line at `i`, which the caller has bounded inside `lines`; reading past them throws, as reading a member of
 *  the missing line did.
 *  @param {ReadonlyArray<Line>} lines
 *  @param {number} i
 *  @returns {Line} */
function lineAt(lines, i) {
  const l = lines[i];
  if (l === undefined) throw new TypeError("Cannot read properties of undefined (a line past the text's last)");
  return l;
}

/* ------------------------------------------------------------------ the view's series */

/** The source of a regular expression's named group `number`, so the number can be found
 *  after the series' label as well as inside a citation.
 *  @param {string} src
 *  @param {string} name
 *  @returns {string | null} */
function groupSource(src, name) {
  const at = src.indexOf(`(?<${name}>`);
  if (at < 0) return null;
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") { i++; continue; }
    if (c === "[") { const j = src.indexOf("]", i + 1); if (j < 0) return null; i = j; continue; }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(at + name.length + 4, i);
  }
  return null;
}
const escapeRe = /** @param {string} s @returns {string} */ (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compile = /** @param {string} src @param {string} flags @returns {RegExp | null} */ (src, flags) => { try { return new RegExp(src, flags); } catch { return null; } };

/** A combined view's standard sources (a view without a profile's identity has none).
 *  @param {View} view
 *  @returns {ViewStandardSource[] | undefined} */
const standardSourcesOf = (view) => view.standard_sources;

/** The policy series the view names (jurisdictions R63; `kind: "policy"` only): each with its label as printed at the
 *  head of a document (words at the opening of one line or of successive lines), its number's
 *  form, and its citation pattern.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {PolicySeries[]} */
export function policySeries(ctx) {
  /** @type {PolicySeries[]} */
  const out = [];
  const view = readerView(ctx);
  const sources = "standard_sources" in view ? standardSourcesOf(view) : undefined;
  for (const s of Array.isArray(sources) ? sources : []) {
    /* A policy series only: a standard's designation (`kind: "standard"`) is cited inside a policy's header, never
       the series the header names (K1933). */
    const ser = s ? s.series : undefined;
    const labelText = ser && typeof ser === "object" ? ser.label : undefined;
    if (!s || s.kind !== "policy" || !ser || typeof ser !== "object" || typeof labelText !== "string" || !labelText.trim()) continue;
    const sKey = s.key, serKey = ser.key;
    if (typeof sKey !== "string" || typeof serKey !== "string") continue;
    const given = s.cite;
    const cite = given && typeof given.re === "string" ? given : null;
    const flags = String((cite && cite.flags) || "").replace(/[^iu]/g, "");
    const numSrc = cite ? groupSource(cite.re, "number") : null;
    const words = labelText.trim().split(/\s+/).map(escapeRe);
    /* One line, or the label's words each opening a line, with what a column layout prints
       beside them on the same line in between. */
    const label = compile(`^[ \\t]*(?:${words.join("[ \\t]+")}|${words.join("(?:[ \\t]+[^\\n]*)?\\n[ \\t]*")})(?![A-Za-z])`, "gim");
    const number = numSrc ? compile(`^[ \\t:.,#–—-]*(?:No\\.?|Number)?[ \\t:#]*\\n?[ \\t]*(${numSrc})(?![A-Za-z0-9])`, "i" + flags.replace("i", "")) : null;
    if (!label) continue;
    const normal = s.normal;
    out.push({ key: `${sKey}.${serKey}`, series: serKey, issuer: sKey, label, labelText,
               numberOnly: numSrc ? compile(`^(?<number>${numSrc})$`, flags) : null,
               number, cite: cite ? compile(cite.re, flags + "g") : null, normal: Array.isArray(normal) ? normal : null });
  }
  return out;
}

/** The match's group `number`, which a series' `numberOnly` always has; a match without it throws, as reading it did.
 *  @param {RegExpExecArray} m
 *  @returns {string} */
function numberGroup(m) {
  const groups = m.groups;
  const n = groups ? groups.number : undefined;
  if (n === undefined) throw new TypeError("a series' number matched without its group `number`");
  return n;
}

/** A number's normal form from the series' `normal` parts over the match's groups (jurisdictions R3's parts: a
 *  literal string, or `{group, upper?, unpad?, default?}`, `group` an index or a name); absent, the number as matched.
 *  @param {ReadonlyArray<NormalPart> | null} parts
 *  @param {RegExpExecArray} m
 *  @returns {string} */
function normalOf(parts, m) {
  if (!parts || !parts.length) return numberGroup(m);
  let out = "";
  for (const part of parts) {
    if (typeof part === "string") { out += part; continue; }
    const group = part ? part.group : undefined;
    if (!part || (typeof group !== "number" && typeof group !== "string")) continue;
    const named = m.groups || {};
    const found = typeof group === "number" ? m[group] : named[group];
    const fallback = part.default;
    const g = found == null ? (typeof fallback === "string" ? fallback : "") : found;
    const unpadded = part.unpad ? g.replace(/^0+(?=.)/, "") : g;
    out += part.upper ? unpadded.toUpperCase() : unpadded;
  }
  return out || numberGroup(m);
}

/** The header labels the view gives, by field (jurisdictions R69).
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {HeaderLabel[]} */
export function headerLabels(ctx) {
  /** @type {HeaderLabel[]} */
  const out = [];
  for (const e of vocabulary(ctx, "policy_headers")) {
    if (!("field" in e) || !HEADER_FIELDS.includes(e.field)) continue;
    const re = vocabRegex(e.pattern, (src) => `(?<![A-Za-z0-9(])(?:${src})(?![A-Za-z0-9])[ \\t]*:?`, "gm");
    if (re) out.push({ field: e.field, re });
  }
  return out;
}

/* ------------------------------------------------------------------------ the lines */

/** @param {string} raw @returns {Line[]} */
function linesOf(raw) {
  /** @type {Line[]} */
  const out = [];
  let at = 0;
  for (const text of raw.split("\n")) { out.push({ start: at, end: at + text.length, text }); at += text.length + 1; }
  return out;
}
/* Page furniture, the same in any document: a page counter, a bare page number or roman
   numeral, a table of contents' marker. */
const FURNITURE = /^\s*(?:Page\s+\d+\s+of\s+\d+|\d{1,3}|[ivxlc]{1,6}|.*\bTOC\b.*|TABLE OF CONTENTS?)\s*$/i;
/* An outline heading opening a line: I., IV., A., 1., a., 1) — place-free. */
const OUTLINE = /^\s*(?:[IVXL]{1,6}|[A-Z]|\d{1,2}|[a-z])[.)][ \t]+\S/;
/* Body text: a line of prose, eight words or more and mostly lower case, as no header value is
   printed (a header prints labels, names, numbers and dates). */
const isBody = /** @param {string} t @returns {boolean} */ (t) => {
  const words = t.trim().split(/\s+/);
  const letters = t.replace(/[^A-Za-z]/g, "");
  return words.length >= 8 && letters.length >= 30 && t.replace(/[^a-z]/g, "").length / letters.length >= 0.7;
};

/* A line set in capitals, as a title is. */
const caps = /** @param {string} t @returns {boolean} */ (t) => { const letters = t.replace(/[^A-Za-z]/g, ""); return letters.length >= 4 && t.replace(/[^A-Z]/g, "").length / letters.length >= 0.85; };

/* ------------------------------------------------------------------------- the dates */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
/* Not global: `exec` reads the first date from the start of the text and keeps no state. */
const DATE = new RegExp(`(?<![A-Za-z0-9])(?:(?<d1>\\d{1,2})[ \\t]+(?<m1>${MON})\\.?[ \\t]+(?<y1>\\d{4}|\\d{2})|(?<m2>${MON})\\.?[ \\t]+(?<d2>\\d{1,2}),?[ \\t]+(?<y2>\\d{4})|(?<m3>\\d{1,2})/(?<d3>\\d{1,2})/(?<y3>\\d{4}|\\d{2}))(?![A-Za-z0-9])`, "i");
/* A date with blanks left in it ("XX XX 21", "XX MMM 20", "XX March 26", "DD MMM YY"): a placeholder, kept as
   written. */
const PLACEHOLDER = /(?<![A-Za-z0-9])(?:XX|DD|\d{1,2})[ \t]+(?:XX|MMM?|[A-Za-z]{3,9})\.?[ \t]+(?:XX|YY(?:YY)?|\d{2,4})(?![A-Za-z0-9])/;
const isPlaceholder = /** @param {string} t @returns {boolean} */ (t) => PLACEHOLDER.test(t) && /\b(?:XX|MMM?|DD|YY(?:YY)?)\b/.test(t);

/** A whole calendar date read off `text`, or null. A two-digit year is read 00–49 as the
 *  2000s and 50–99 as the 1900s, which the 50 measured headers bear out (1981 to 2024).
 *  @param {string | null | undefined} text
 *  @returns {DateRead | null} */
export function readDate(text) {
  const m = DATE.exec(String(text || ""));
  if (!m) return null;
  const g = m.groups;
  if (!g) throw new TypeError("a date matched without its groups");
  const y = g.y1 || g.y2 || g.y3;
  if (y === undefined) throw new TypeError("a date matched without its year");
  const monthName = g.m1 || g.m2;
  const month = monthName ? MONTHS.indexOf(monthName.slice(0, 3).toLowerCase()) + 1 : Number(g.m3);
  const day = Number(g.d1 || g.d2 || g.d3);
  const year = y.length === 4 ? Number(y) : Number(y) + (Number(y) < 50 ? 2000 : 1900);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (!(month >= 1 && month <= 12) || probe.getUTCDate() !== day || probe.getUTCMonth() !== month - 1) return null;
  return { date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, index: m.index, text: m[0] };
}

/* ------------------------------------------------------------------------ the header */

const tidy = /** @param {string} s @returns {string} */ (s) => String(s || "").replace(/[ \t]*\n[ \t]*/g, " ").replace(/\s+/g, " ").replace(/^[\s:–—-]+|[\s:;,]+$/g, "");

/** A span of the raw text as a field: `{text, start, end, source}`, the text as written
 *  (lines joined by a space), its extent trimmed of space and the label's colon.
 *  @param {string} raw
 *  @param {number} start
 *  @param {number} end
 *  @param {HeaderLocate} locate
 *  @returns {HeaderValue | null} */
function field(raw, start, end, locate) {
  while (start < end && /[\s:]/.test(raw.charAt(start))) start++;
  while (end > start && /[\s:;,]/.test(raw.charAt(end - 1))) end--;
  if (end <= start) return null;
  return { text: tidy(raw.slice(start, end)), start, end, source: locate(start) || null };
}

/** Where a header may be anchored: each line opening with a series' label, with its number where the series prints
 *  it beside the label, first the earliest (with a number where two begin together). `series` are `policySeries`' of this reading, made
 *  afresh, so each label is read from the text's start.
 *  @param {string} raw
 *  @param {ReadonlyArray<PolicySeries>} series
 *  @param {ReadonlyArray<HeaderLabel>} labels
 *  @returns {Anchor[]} */
function anchors(raw, series, labels) {
  /** @type {Anchor[]} */
  const out = [];
  for (const s of series) {
    for (const m of raw.matchAll(s.label)) {
      /* A label opening a line of prose ("Administrative Instruction is to provide …") is the
         body naming its own kind, not the header. */
      const lineEnd = raw.indexOf("\n", m.index + m[0].length);
      if (isBody(raw.slice(m.index, lineEnd < 0 ? raw.length : lineEnd))) continue;
      const after = raw.slice(m.index + m[0].length, m.index + m[0].length + 80);
      const numberRe = s.number;
      const n = numberRe ? numberRe.exec(after) : null;
      /* Group 1 is the whole number, so a match always has it. */
      const n1 = n ? n[1] : null;
      if (n && n1 === undefined) throw new TypeError("a series' number matched without its group 1");
      const numberStart = n && n1 != null ? m.index + m[0].length + n.index + n[0].indexOf(n1) : 0;
      const number = n && n1 != null ? { start: numberStart, text: n1, end: numberStart + n1.length } : null;
      /** @type {Anchor} */
      const hit = { series: s, start: m.index + (m[0].length - m[0].trimStart().length), end: m.index + m[0].length,
                    number };
      /* A header prints its labels around its series' name: one within the next few lines,
         else this is a citation set on a line of its own. */
      const from = number ? number.end : hit.end;
      let stop = from;
      for (let k = 0; k < 6 && stop >= 0; k++) stop = raw.indexOf("\n", stop + 1);
      const near = raw.slice(m.index, stop < 0 ? raw.length : stop);
      if (!labels.some((l) => near.search(l.re) >= 0)) continue;
      out.push(hit);
    }
  }
  return out.sort((x, y) => x.start - y.start || (y.number ? 1 : 0) - (x.number ? 1 : 0));
}

/** Where the header block begins: the anchor's line, and the lines above it a boxed layout prints there (labels,
 *  numbers, short values), back to the first line that ends a sentence or reads as prose. A revision memorandum in
 *  front of an order ends in its signature, after prose, so its own TO, DATE and SUBJECT are never the order's.
 *  @param {ReadonlyArray<Line>} lines
 *  @param {number} offset
 *  @returns {number} */
function blockStart(lines, offset) {
  let i = lines.findIndex((l) => offset >= l.start && offset <= l.end);
  if (i < 0) return 0;
  let k = 0;
  while (i > 0 && k < 12) {
    const t = lineAt(lines, i - 1).text.trim();
    if (t && (isBody(t) || /\.\s*$/.test(t) && !/\b(?:Rev|No|Nos)\.$/.test(t) || t.split(/\s+/).length > 12)) break;
    i--; k++;
  }
  return lineAt(lines, i).start;
}

/** The header block of a policy (R26), or `{header: null, why}`. The block is the first anchor's; where the same
 *  series and number anchor again further on and that block reads more fields, it is that one: a revision
 *  memorandum's running header ("DEPARTMENTAL GENERAL ORDER D-4 Effective Date:") prints the order's name and one
 *  field above the order's own header.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {string | null | undefined} text
 *  @param {HeaderLocate} [locate]
 *  @returns {HeaderRead} */
export function readHeader(ctx, text, locate = () => null) {
  const raw = String(text || "");
  const series = policySeries(ctx);
  const labels = headerLabels(ctx);
  if (!series.length && !labels.length)
    return { header: null, why: localize("doctypes.policy-header.no_series_or_labels", "the active jurisdiction profiles give no policy series and no policy header labels, so no header is read") };
  const all = anchors(raw, series, labels);
  const first = all[0] || null;
  let best = readAt(raw, labels, first, locate);
  const fields = /** @param {HeaderRead} r @returns {number} */ (r) => { const h = r.header; return h ? HEADER_FIELDS.length - h.missing.length : -1; };
  for (const a of all.slice(1)) {
    /* A second anchor means a first. */
    if (first === null) throw new TypeError("Cannot read properties of null (reading 'series')");
    const an = a.number, fn = first.number;
    if (a.series !== first.series || !an || !fn || an.text !== fn.text) continue;
    const r = readAt(raw, labels, a, locate);
    if (fields(r) > fields(best)) best = r;
  }
  return best;
}

/** The lines of `raw` from `lo` (a line's start) to the end of the line holding `hi`, offsets absolute (`full` when
 *  the text ends there).
 *  @param {string} raw
 *  @param {number} lo
 *  @param {number} hi
 *  @returns {{ lines: Line[], full: boolean }} */
function linesBetween(raw, lo, hi) {
  const nl = hi >= raw.length ? -1 : raw.indexOf("\n", hi);
  const stop = nl < 0 ? raw.length : nl;
  /** @type {Line[]} */
  const out = [];
  let at = lo;
  for (const text of raw.slice(lo, stop).split("\n")) { out.push({ start: at, end: at + text.length, text }); at += text.length + 1; }
  return { lines: out, full: nl < 0 };
}
const REGION = 1 << 16;
/* How far into a text a header's first label is looked for when no series anchors one, and how far past its anchor a
   header block runs (R40; protective, K4868): a header stands on the first page. */
const HEADER_SCAN = 1 << 14;
const HEADER_BLOCK = 1 << 16;

/** The header block read from one anchor (or, with none, from the first label). R37: a header is read from the lines
 *  around its anchor (14 above it, and as far below as the block and its title run), widened until the reading stays
 *  inside them, so a large text is never cut into a list of all its lines; the answer is the whole text's.
 *  @param {string} raw
 *  @param {ReadonlyArray<HeaderLabel>} labels
 *  @param {Anchor | null} a
 *  @param {HeaderLocate} locate
 *  @returns {HeaderRead} */
function readAt(raw, labels, a, locate) {
  if (!a) return readAtLines(raw, labels, null, locate, null, true).result;
  let lo = a.start > 0 ? raw.lastIndexOf("\n", a.start - 1) + 1 : 0;
  for (let k = 0; k < 14 && lo > 0; k++) lo = lo - 1 > 0 ? raw.lastIndexOf("\n", lo - 2) + 1 : 0;
  for (let hi = a.start + REGION; ; hi *= 2) {
    const { lines, full } = linesBetween(raw, lo, hi);
    const r = readAtLines(raw, labels, a, locate, lines, full);
    if (full || !r.exhausted) return r.result;
  }
}

/** `readAt` over the given lines; `exhausted` says the reading ran to the last of them without `full` text behind it.
 *  An anchored reading is given its lines; with no anchor, none (null), and the whole text's are made.
 *  @param {string} raw
 *  @param {ReadonlyArray<HeaderLabel>} labels
 *  @param {Anchor | null} a
 *  @param {HeaderLocate} locate
 *  @param {Line[] | null} given
 *  @param {boolean} full
 *  @returns {{ exhausted?: boolean, result: HeaderRead }} */
function readAtLines(raw, labels, a, locate, given, full) {
  let exhausted = false;
  if (a && !given) throw new TypeError("Cannot read properties of null (reading 'findIndex')");
  const from = a && given ? blockStart(given, a.start) : 0;
  const an = a ? a.number : null;
  /* The block's end: the first line after the anchor (or, with none, after the first label)
     that is page furniture, an outline heading or body text. */
  /* R40: with no anchor the first label is looked for in the first HEADER_SCAN characters and no further, so a text of
     blank lines is not tried for a label from each of them (the labels' patterns may begin with `^\s*`, which reads on
     through every blank line it meets). */
  /* With no anchor the block starts at 0, so each label is looked for from the text's start. */
  const firstLabel = a ? null : (() => {
    /** @type {number | null} */
    let best = null;
    const head = raw.length > HEADER_SCAN ? raw.slice(0, HEADER_SCAN) : raw;
    for (const l of labels) { const at = head.search(l.re); const was = best; if (at >= 0 && (!was || at < was)) best = at; }
    return best;
  })();
  const after = a ? (an ? an.end : a.end) : firstLabel;
  if (after === null || after === undefined)
    return { result: { header: null, why: raw.length > HEADER_SCAN
      ? localize("doctypes.policy-header.no_block_window", "no line of this text opens with a policy series the active profiles name, and no header label they give is printed in its first {chars} characters, where a header stands", { chars: String(HEADER_SCAN) })
      : localize("doctypes.policy-header.no_block", "no line of this text opens with a policy series the active profiles name, and no header label they give is printed in it") } };
  const lines = given || linesOf(raw);
  let end = raw.length, endLine = lines.length;
  let stopped = false, blockCut = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lineAt(lines, i);
    if (l.start <= after) continue;
    /* R40: a header block runs no further than HEADER_BLOCK characters past its anchor (a page holds a header, not a
       hundred thousand lines of blanks), and the answer says when the block was cut there. */
    if (l.start - after > HEADER_BLOCK) { end = l.start; endLine = i; stopped = true; blockCut = true; break; }
    if (FURNITURE.test(l.text) || OUTLINE.test(l.text) || (isBody(l.text) && !labels.some((x) => { const at = l.text.search(x.re); return at >= 0 && at <= l.text.length - l.text.trimStart().length; }))) {
      end = l.start; endLine = i; stopped = true; break;
    }
  }
  if (!full && !stopped) exhausted = true;

  /* Every label printed in the block, longest first where two begin together, never two
     overlapping; the anchor and its number are boundaries too. */
  /** @type {LabelHit[]} */
  const hits = [];
  for (const l of labels) {
    /* A fresh copy of the label's expression, so each is read from the block's start. */
    for (const m of raw.slice(from, end).matchAll(new RegExp(l.re))) hits.push({ field: l.field, start: from + m.index, end: from + m.index + m[0].length });
  }
  hits.sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start));
  /** @type {LabelHit[]} */
  const taken = [];
  for (const h of hits) if (!taken.some((t) => h.start < t.end && t.start < h.end)) taken.push(h);
  const bounds = [...taken.map((t) => t.start)];
  if (a) { bounds.push(a.start); if (an) bounds.push(an.start); }
  bounds.sort((x, y) => x - y);
  const nextBound = /** @param {number} at @returns {number} */ (at) => { for (const b of bounds) if (b >= at) return b; return end; };

  /** @type {HeaderFields} */
  const header = {};
  /** @type {HeaderWhy} */
  const why = {};
  /** @type {Set<number>} */
  const usedDates = new Set();
  /* The raw extent of each label's value: from the label to the next label or boundary. */
  /** @type {LabelSpan[]} */
  const spans = taken.map((t) => ({ ...t, vEnd: Math.min(nextBound(t.end), end) }));
  for (const s of spans) {
    const k = s.field;
    /* A label of the type bounds the fields beside it; the type itself is the series the anchor names (R26). */
    if (k === "type" || header[k]) continue;
    let vEnd = s.vEnd;
    if (ONE_LINE.has(k)) { const nl = raw.indexOf("\n", raw.slice(s.end, vEnd).trim() ? s.end + (raw.slice(s.end).length - raw.slice(s.end).trimStart().length) : s.end); if (nl >= 0 && nl < vEnd) vEnd = nl; }
    if (k === "effective" || k === "review_due") {   // DATE_FIELDS
      const beside = field(raw, s.end, vEnd, locate);
      if (beside && !readDate(beside.text) && isPlaceholder(beside.text)) {
        header[k] = { text: beside.text, start: beside.start, end: beside.end, source: beside.source, date: null,
          why: localize("doctypes.policy-header.placeholder_date", "this date is not a whole calendar date as printed (a placeholder), so it is kept as written and not completed") };
        continue;
      }
      /* Beside its label; else, as a boxed layout prints it, below labels that are not dates, up to the next date
         label: the first whole date there. */
      const nearDate = readDate(raw.slice(s.end, vEnd)), base = s.end;
      /** @type {DateRead | null} */
      let belowDate = null;
      if (!nearDate) {
        const nextDateLabel = spans.find((o) => o !== s && o.start >= s.end && DATE_FIELDS.has(o.field));
        belowDate = readDate(raw.slice(s.end, nextDateLabel ? nextDateLabel.start : end));
      }
      const d = nearDate || belowDate;
      if (d && !usedDates.has(base + d.index)) {
        const start = base + d.index;
        usedDates.add(start);
        header[k] = { text: d.text, date: d.date, start, end: start + d.text.length, source: locate(start) || null };
        continue;
      }
      why[k] = beside ? localize("doctypes.policy-header.no_date_beside", "its label is printed with no calendar date beside it or below it in the header")
        : localize("doctypes.policy-header.nothing_beside", "its label is printed with nothing beside it");
      continue;
    }
    /* A value printed beside its label ends at its line where the next line is set in capitals and the value is not:
       that line is the order's own name under the block, not the value's continuation. The title is excepted: an
       old layout prints index terms under its label, then the name, which the title reading below takes. */
    if (k !== "title") {
      const nl = raw.indexOf("\n", s.end);
      const own = nl < 0 ? "" : raw.slice(s.end, nl);
      if (nl >= 0 && nl < vEnd && own.trim() && !caps(own)) {
        const next = raw.slice(nl + 1, raw.indexOf("\n", nl + 1) < 0 ? raw.length : raw.indexOf("\n", nl + 1));
        if (caps(next)) vEnd = nl;
      }
    }
    const f = field(raw, s.end, vEnd, locate);
    if (f) header[k] = f; else why[k] = localize("doctypes.policy-header.nothing_beside", "its label is printed with nothing beside it");
  }

  /* The series and number: the anchor's, or a number label's value in the series' form. */
  if (a) {
    header.type = { text: tidy(raw.slice(a.start, a.end)), key: a.series.key, series: a.series.series, start: a.start, end: a.end,
                    source: locate(a.start) || null };
    if (an) header.number = { text: an.text, start: an.start, end: an.end, source: locate(an.start) || null };
  }
  /* The number, in the series' form, and its normal form (jurisdictions R63, R3): a number read under a number label
     is the series' only where the series reads it. */
  const readNumber = header.number;
  if (readNumber && a) {
    const numberOnly = a.series.numberOnly;
    const m = numberOnly ? numberOnly.exec(readNumber.text.trim()) : null;
    if (!m) {
      why.number = localize("doctypes.policy-header.number_form", "\"{number}\" is printed as the number, and {series} does not read a number in that form", { number: String(readNumber.text), series: String(a.series.labelText) });
      delete header.number;
    } else readNumber.normal = normalOf(a.series.normal, m);
  }

  /* The title: printed beside the number ("K-03: USE OF FORCE"), else the order's own name
     printed in capitals under the block, else the title label's value. */
  /* Whether the title was read beside the number (held here, never in the answer). */
  let titleInline = false;
  if (a && an) {
    const lineEnd = raw.indexOf("\n", an.end);
    const rest = raw.slice(an.end, lineEnd < 0 ? raw.length : lineEnd);
    const m = /^[ \t]*:[ \t]*(\S.*)$/.exec(rest);
    /* Group 1 is not optional, so a match always has it. */
    const m1 = m ? m[1] : undefined;
    if (m1 !== undefined) {
      let start = an.end + rest.indexOf(m1), stop = lineEnd < 0 ? raw.length : lineEnd;
      /* Its continuation lines, up to the first label. */
      for (const l of lines) {
        if (l.start <= stop) continue;
        if (l.start >= end || taken.some((t) => t.start >= l.start && t.start <= l.start + (l.text.length - l.text.trimStart().length))) break;
        stop = l.end;
      }
      const f = field(raw, start, stop, locate);
      if (f) { header.title = f; titleInline = true; }
    }
  }
  if (!(header.title && titleInline)) {
    let i = endLine;
    while (i < lines.length && (FURNITURE.test(lineAt(lines, i).text) || !lineAt(lines, i).text.trim())) i++;
    if (!full && i >= lines.length - 1) exhausted = true;
    if (i < lines.length && !OUTLINE.test(lineAt(lines, i).text) && caps(lineAt(lines, i).text)) {
      let j = i;
      while (j + 1 < lines.length && caps(lineAt(lines, j + 1).text) && !OUTLINE.test(lineAt(lines, j + 1).text) && !FURNITURE.test(lineAt(lines, j + 1).text)) j++;
      if (!full && j + 1 >= lines.length - 1) exhausted = true;
      const f = field(raw, lineAt(lines, i).start, lineAt(lines, j).end, locate);
      if (f) header.title = f;
    }
  }
  /* A title label's value ending in the order's own name in capitals (an old layout prints its
     index terms under the label, then the title): the title is that name. */
  const labelTitle = header.title;
  if (labelTitle && !titleInline) {
    const inTitle = lines.filter((l) => l.start >= labelTitle.start && l.end <= labelTitle.end && l.text.trim());
    let k = inTitle.length;
    while (k > 0 && caps(lineAt(inTitle, k - 1).text)) k--;
    if (k > 0 && k < inTitle.length) {
      const f = field(raw, lineAt(inTitle, k).start, lineAt(inTitle, inTitle.length - 1).end, locate);
      if (f) header.title = f;
    }
  }
  /* A footnote's mark printed against a title's last word ("the Use of Force1"). */
  const markedTitle = header.title;
  if (markedTitle && /[a-z]\d{1,2}$/.test(markedTitle.text)) {
    const mark = markedTitle.text.match(/\d{1,2}$/);
    if (!mark) throw new TypeError("Cannot read properties of null (reading '0')");
    const cut = mark[0].length;
    header.title = { ...markedTitle, text: markedTitle.text.slice(0, -cut), end: markedTitle.end - cut };
  }
  /* A title label's value with the dates a boxed layout prints beside it taken out. */
  const datedTitle = header.title;
  if (datedTitle && datedTitle.text) {
    const d = readDate(datedTitle.text);
    if (d && d.index > 0 && d.index + d.text.length >= datedTitle.text.length - 1) datedTitle.text = tidy(datedTitle.text.slice(0, d.index));
  }

  for (const f of BELOW_TARGET) { const v = header[f]; if (v) v.measured = "below_target"; }
  const missing = HEADER_FIELDS.filter((f) => !header[f]);
  for (const f of missing) if (!why[f]) why[f] = f === "type"
    ? localize("doctypes.policy-header.no_series_type", "no line of this text opens with a policy series the active jurisdiction profiles name")
    : localize("doctypes.policy-header.no_label", "no label the active jurisdiction profiles give for this field is printed in the header block");
  return { exhausted, result: { header: { ...header, missing, missing_why: why, start: from, end, ...(blockCut ? { block_cut: true } : {}) }, why: null } };
}

/** Does any line of `raw` open with a policy series' label of the view's, with the header labels near it (R26)? The
 *  header's `type` is read only from such an anchor, so with none a text is no policy's.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {string | null | undefined} raw
 *  @returns {boolean} */
export function headerAnchored(ctx, raw) {
  return anchors(String(raw || ""), policySeries(ctx), headerLabels(ctx)).length > 0;
}
