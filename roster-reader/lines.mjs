/* The line-level reading the roster and org-chart types share: what a name looks like, which contact
 * points a line carries (to leave them unread, R4), which of the view's staff titles it prints, and how
 * a roster line divides into a name and a title — or does not (R2).
 *
 * WHAT STAYS IN CODE, AND WHY IT IS PLACE-FREE (R8; layers.md, "No jurisdiction in the product"). The
 * shape of a personal name in Latin script (capitalised words, initials, particles, generational
 * suffixes); the shape of an e-mail address, a North American phone number and a street address; the
 * English words that name a KIND of organisational unit (office, division, section) and the function
 * words a sentence opens with. None names a place or an office of one jurisdiction. Everything local —
 * the words a roster or chart names itself with, its header words, the titles printed beside a name —
 * comes from the view (`roster_words`, `roster_headers`, `staff_titles`; jurisdictions R6).
 *
 * WHAT A NAME SPAN CANNOT SEE, stated because it bounds every reading built on it: a name in a script
 * without case, a single-word name, and a name printed in capitals are not name-shaped here; a phrase of
 * two to four capitalised words that is not a person's name ("Grey Gardner" is a name; "Harbor Point" is
 * not, and both look alike) is. So nothing in this module asserts that a span IS a person: a span is
 * "name-shaped", and every reading built on one says so (R10). */
import { vocabPatterns, vocabulary, vocabRegex, IN_PROSE } from "../docprofile/registry.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
/** @import { DoctypeContext } from "../docprofile/registry.mjs" */
/** @import { RosterKind } from "../jurisdictions/types.mjs" */

/** A value read from a reading handed back, or from the store's read, before this module has judged its shape.
 *  @typedef {object | string | number | bigint | boolean | symbol | null | undefined} Value */
/** A plain object read so, whose fields are not yet judged: this module's own reading of it.
 *  @typedef {{ [key: string]: Value }} Fields */
/** A list read so, whose entries are not yet judged: this module's own reading of it.
 *  @typedef {Value[] & { readonly judged?: never }} Entries */

/** Whether `v` is a plain object (not null, not a list).
 *  @param {unknown} v
 *  @returns {v is Fields} */
export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Whether `v` is a list.
 *  @param {unknown} v
 *  @returns {v is Entries} */
export const isList = (v) => Array.isArray(v);
/** A field of a plain object when it is a string, else undefined.
 *  @param {Fields} o
 *  @param {string} k
 *  @returns {string | undefined} */
export const strField = (o, k) => { const v = o[k]; return typeof v === "string" ? v : undefined; };

/**
 * A span of a string: its text and where it starts.
 * @typedef {Object} Span
 * @property {string} text
 * @property {number} index
 */
/**
 * A line with its contact points removed (R4): its words closed up, the runs between the removed points, and how many
 * were removed.
 * @typedef {Object} Contactless
 * @property {string} text
 * @property {string[]} parts
 * @property {number} removed
 */
/**
 * A self-naming recogniser of the view and the kinds of document it names.
 * @typedef {Object} RosterWordPattern
 * @property {RegExp} re
 * @property {RosterKind[]} kinds
 */
/**
 * One non-empty line of a text, its white space closed up, and where it starts in the text.
 * @typedef {Object} Line
 * @property {string} text
 * @property {number} offset
 */
/**
 * A self-naming line, with the kinds of document it names.
 * @typedef {Line & { kinds: RosterKind[] }} SelfLine
 */
/**
 * What a document's self-naming lines name it, for one kind.
 * @typedef {Object} NamedAs
 * @property {SelfLine[]} as
 * @property {boolean} only_other
 */
/**
 * A date a line states: its text, the date (`YYYY-MM-DD`, or `YYYY-MM` for a month alone) or null with why, its
 * precision, and where it starts.
 * @typedef {Object} StatedDate
 * @property {string} text
 * @property {string | null} date
 * @property {"day" | "month" | null} precision
 * @property {number} offset
 * @property {string} [why]
 */

/* A word that, opening or ending a span, makes it a phrase rather than a name: function words, the
   kinds of unit an organisation is divided into, the words of a schedule and of a blank form, and the
   words a chart prints in an empty box. Place-free English; a closed list of KINDS, never of places. */
const NOT_NAME_WORDS = new Set(`a an and are as at be by but for from has have he her his i if in is it its
  of on or our she that the their these they this those to was we were will with your you all any each
  every no not yes please dear total page pages date name names updated update regular meeting meetings
  agenda minutes notes note item items vacant reserved pending tbd tba none open position positions
  office offices division divisions section sections unit units bureau bureaus department departments
  dept agency agencies program programs programme services service center centre centers team teams
  branch board boards committee committees commission commissions council councils organization
  organisation organizations administration management operations group groups area areas district
  districts foundation inc llc company co corporation association union local hospital school schools
  college university library police fire works public city county state staff members member roster
  chart directory contacts contact phone email fax address street avenue suite floor plaza level
  january february march april may june july august september october november december monday tuesday
  wednesday thursday friday saturday sunday chair chairs`.split(/\s+/).filter(Boolean));

/* The words that make a short line name a UNIT of an organisation, as its last word ("Records
   Division") or its first ("Office of the Inspector General"). Place-free: kinds of unit. */
export const UNIT_WORDS = new Set(`office division section unit bureau department dept agency program programme
  services center centre team branch board committee commission council councils administration
  operations group area district task force`.split(/\s+/).filter(Boolean));

const L = "\\p{Lu}";
const l = "\\p{Ll}";
/* One word of a name: a capitalised word (hyphens and apostrophes inside it, internal capitals as in
   "McDonald" or "LeGrannde"), or an initial. A particle (de, van, da) may sit between words. */
const WORD = `(?:${L}${l}+(?:${L}${l}+)*(?:[-'’]${L}?${l}+)*|${L}\\.)`;
const PARTICLE = "(?:de|del|della|di|da|dos|du|la|le|van|von|der|den|ter|bin|ibn|al)";
const NICK = `(?:["“][${"\\p{L}"}]+["”])`;
const SUFFIX = "(?:,?\\s+(?:Jr\\.?|Sr\\.?|II|III|IV))";
/* Two to four name words, optionally one quoted nickname and one generational suffix. */
const NAME_SRC = `${WORD}(?:\\s+(?:${PARTICLE}\\s+)?(?:${NICK}\\s+)?${WORD}){1,3}${SUFFIX}?`;
const NAME_AT = new RegExp(`^(?:${NAME_SRC})`, "u");
const NAME_WHOLE = new RegExp(`^(?:${NAME_SRC})$`, "u");
const NAME_ALL = new RegExp(`(?<![\\p{L}\\p{N}])${NAME_SRC}(?![\\p{L}\\p{N}])`, "gu");

const words = /** @param {unknown} s @returns {string[]} */ (s) => String(s).replace(/["“”]/g, "").split(/\s+/).filter(Boolean);
/* Is this UTF-16 code unit white space as `\s` reads it? */
const isSpaceCode = /** @param {number} c @returns {boolean} */ (c) => c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 5760 || (c >= 8192 && c <= 8202) ||
  c === 8232 || c === 8233 || c === 8239 || c === 8287 || c === 12288 || c === 65279;
/* How many words `words` gives, counted in place: no copy of the string, no array. It stops past `cap` (default: all). */
/** @param {string} s @param {number} [cap] @returns {number} */
function countWords(s, cap = Infinity) {
  let n = 0, inWord = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34 || c === 8220 || c === 8221) continue;
    if (isSpaceCode(c)) inWord = false;
    else if (!inWord) { inWord = true; if (++n > cap) return n; }
  }
  return n;
}
/* Is this word one that ends a name? Answered once per distinct word (a text repeats its words): the cache is cleared
   when it passes PHRASE_CACHE entries, so a text of any size holds a bounded number. */
const PHRASE_CACHE = 4096;
/** @type {Map<string, boolean>} */
const phraseCache = new Map(/** @type {Array<[string, boolean]>} */ ([]));
/** @param {string} w @returns {boolean} */
function phraseWord(w) {
  const held = phraseCache.get(w);
  if (held !== undefined) return held;
  const v = NOT_NAME_WORDS.has(w.replace(/["“”.,]+/g, "").toLowerCase());
  if (phraseCache.size >= PHRASE_CACHE) phraseCache.clear();
  phraseCache.set(w, v);
  return v;
}
/* A name ends where a phrase word begins: a matched run is cut at its first phrase word, and what is
   left is a name only while it keeps two name words ("Langston Buddenhagen District 1" reads the name
   "Langston Buddenhagen"). A span is never shortened from its front: that would choose a name inside a
   phrase, the guess R2 forbids. */
/** @param {string} run @returns {string | null} */
function cut(run) {
  let end = 0, n = 0, at = 0;
  while (at < run.length) {
    let to = at;
    while (to < run.length && !isSpaceCode(run.charCodeAt(to))) to++;
    const w = run.slice(at, to);
    if (phraseWord(w)) break;
    end = to;
    if (!/^["“]/.test(w) && !/^(?:Jr\.?|Sr\.?|II|III|IV),?$/.test(w) && !/^\p{Ll}/u.test(w)) n++;
    at = to;
    while (at < run.length && isSpaceCode(run.charCodeAt(at))) at++;
  }
  /* The words kept, with the white space between them as the run has it. */
  const out = run.slice(0, end).replace(/,\s*$/, "").trim();
  return n >= 2 && !/^\p{Ll}/u.test(out) && !/\s\p{Ll}+$/u.test(out) ? out : null;
}

/* The first word of a string (to its first white space). */
/** @param {string} s @returns {string} */
function firstWord(s) {
  let to = 0;
  while (to < s.length && !isSpaceCode(s.charCodeAt(to))) to++;
  return s.slice(0, to);
}

/** The name-shaped spans in a string, in order, each `{text, index}`.
 *  @param {unknown} s
 *  @returns {Span[]} */
export function nameSpans(s) {
  /** @type {Span[]} */
  const out = [];
  const str = String(s);
  /* `exec` on the shared recogniser, as `matchAll` does on a clone of it: no regex is made per line. */
  NAME_ALL.lastIndex = 0;
  for (;;) {
    const m = NAME_ALL.exec(str);
    if (m === null) break;
    if (!phraseWord(firstWord(m[0]))) {
      const t = cut(m[0]);
      if (t) out.push({ text: t, index: m.index });
    }
  }
  NAME_ALL.lastIndex = 0;
  return out;
}

/** Does the string hold a name-shaped span? The same answer as `nameSpans(s).length > 0`, found without building them. */
/** @param {unknown} s @returns {boolean} */
export function hasNameSpan(s) {
  const str = String(s);
  NAME_ALL.lastIndex = 0;
  let found = false;
  while (!found) {
    const m = NAME_ALL.exec(str);
    if (m === null) break;
    found = !phraseWord(firstWord(m[0])) && cut(m[0]) !== null;
  }
  NAME_ALL.lastIndex = 0;
  return found;
}

/** Is the whole string (trimmed, a trailing comma or full stop aside) exactly one name-shaped span? */
/** @param {unknown} s @returns {boolean} */
export function isName(s) {
  const t = String(s).trim().replace(/[,;]+$/, "").trim();
  if (!t) return false;
  return NAME_WHOLE.test(t) && cut(t) === t;
}

/** The leading name-shaped span of a string, or null. */
/** @param {unknown} s @returns {string | null} */
export function leadingName(s) {
  const t = String(s).trim();
  const m = NAME_AT.exec(t);
  return m && !phraseWord(firstWord(m[0])) ? cut(m[0]) : null;
}

/* ---- contact points (R4): found so they can be LEFT UNREAD, never kept ---- */
export const EMAIL = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g;
export const PHONE = /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])?\b\d{3}[-.]\d{4}\b(?:\s*(?:x|ext\.?)\s*\d{1,6})?/gi;
const EXTENSION = /\b(?:x|ext\.?)\s*\d{3,6}\b/gi;
/* A street address: a number, capitalised words, and a street word, with an optional unit. */
export const STREET = /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z0-9][\w'.-]*\s+){0,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Way|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Plaza|Parkway|Pkwy|Square|Sq|Terrace|Highway|Hwy)\b\.?(?:,?\s*(?:Suite|Ste\.?|Floor|Fl\.?|Room|Rm\.?|Unit|#)\s*[\w-]+)?/g;

/** A line with every contact point removed: `text` with the line's words closed up, `parts` the runs
 *  of text between the removed points (a removed point is a boundary no name runs across), and how many
 *  were removed. */
/** @param {unknown} line @returns {Contactless} */
export function withoutContacts(line) {
  const raw = String(line);
  /* A line with no "@", no digit and no NUL holds none of the four contact points (each needs one of them), so
     it is only tidied: the common line of running text costs no regex pass and no copy. */
  if (!CONTACT_POSSIBLE.test(raw)) {
    const text = tidy(raw);
    return { text, parts: text ? [text] : [], removed: 0 };
  }
  cuts = 0;
  let marked = raw;
  if (raw.includes("@")) marked = cutAll(EMAIL, marked);
  marked = cutAll(STREET, marked);
  marked = cutAll(PHONE, marked);
  marked = cutAll(EXTENSION, marked);
  if (!cuts && !raw.includes(MARK)) { const text = tidy(raw); return { text, parts: text ? [text] : [], removed: 0 }; }
  return { text: tidy(marked.split(MARK).join(" ")), parts: marked.split(MARK).map(tidy).filter(Boolean), removed: cuts };
}
const MARK = "\u0000";
let cuts = 0;
const markCut = () => { cuts++; return MARK; };
/* Every match of a contact recogniser replaced by the cut mark; a string it does not match is returned as it is. */
/** @param {RegExp} re @param {string} s @returns {string} */
function cutAll(re, s) {
  /* `search` reads from the start whatever the recogniser's lastIndex, and `replace` with a global one does too. */
  if (s.search(re) < 0) return s;
  return s.replace(re, markCut);
}
/* A character any contact point needs: an "@" (e-mail), a digit (phone, extension, street), or the NUL that marks a cut. */
const CONTACT_POSSIBLE = /[@\d\u0000]/;
/* A string's words closed up, a space dropped before , ; :, and the edges stripped. A string with nothing to change is returned as it is. */
const TIDY_NEEDED = /[^\S ]|  | [,;:]|^[\s,;:|-]|[\s,;|-]$/;
const tidy = /** @param {string} s @returns {string} */ (s) => TIDY_NEEDED.test(s)
  ? s.replace(/\s+/g, " ").replace(/\s+([,;:])/g, "$1").replace(/^[\s,;:|-]+|[\s,;|-]+$/g, "").trim()
  : s;

/* ---- the view's staff titles ---- */

/** The staff-title recognisers of the view, each bounded by non-letters and global. */
/** @param {DoctypeContext | null | undefined} ctx @returns {RegExp[]} */
export function titlePatterns(ctx) {
  return vocabPatterns(ctx, "staff_titles", IN_PROSE, "g");
}

/** Every staff-title span in a string, merged in reading order, overlaps dropped (the earlier, then the
 *  longer, kept), each `{text, index}`. */
/** @param {ReadonlyArray<RegExp>} patterns @param {unknown} s @returns {Span[]} */
export function titleSpans(patterns, s) {
  /** @type {Span[]} */
  const hits = [];
  const str = String(s);
  for (const re of patterns) {
    /* `exec` on the recogniser itself, as `matchAll` does on a clone of it: no regex is made per line. */
    re.lastIndex = 0;
    for (;;) {
      const m = re.exec(str);
      if (m === null) break;
      if (m[0].trim()) hits.push({ text: m[0], index: m.index });
      if (m[0] === "") re.lastIndex += re.unicode && (str.codePointAt(re.lastIndex) ?? 0) > 0xffff ? 2 : 1;
    }
    re.lastIndex = 0;
  }
  if (hits.length < 2) return hits;
  hits.sort((a, b) => a.index - b.index || b.text.length - a.text.length);
  /** @type {Span[]} */
  const out = [];
  let end = -1;
  for (const h of hits) { if (h.index < end) continue; out.push(h); end = h.index + h.text.length; }
  return out;
}

/** A string with the given spans removed, collapsed. */
/** @param {string} s @param {ReadonlyArray<Span>} spans @returns {string} */
export function removeSpans(s, spans) {
  let out = "", at = 0;
  for (const h of spans) { out += s.slice(at, h.index) + " "; at = h.index + h.text.length; }
  return (out + s.slice(at)).replace(/\s+/g, " ").trim();
}

/* ---- the view's roster words ---- */

/** The self-naming recognisers of the view (`roster_words`), bounded and case as the profile wrote, each
 *  with the kind of document it names: `roster`, `chart`, or both when the entry names no kind. */
/** @param {DoctypeContext | null | undefined} ctx @returns {RosterWordPattern[]} */
export function rosterWordPatterns(ctx) {
  /** @type {RosterWordPattern[]} */
  const out = [];
  for (const e of vocabulary(ctx, "roster_words")) {
    const re = vocabRegex("pattern" in e ? e.pattern : undefined, IN_PROSE);
    if (!re) continue;
    const { kind } = "kind" in e ? e : { kind: undefined };
    /** @type {RosterKind[]} */
    const kinds = kind === "roster" || kind === "chart" ? [kind] : ["roster", "chart"];
    out.push({ re, kinds });
  }
  return out;
}

/* A self-naming line is a TITLE, not a mention: short. Eight words is longer than every measured
   self-naming line ("CITYCOUNCIL COMMITTEE MEMBER ROSTER AND ASSIGNED STAFF" is seven when one line) and
   shorter than the sentence that mentions a roster in prose. */
export const TITLE_WORDS = 8;

/* White space a line's words are not already closed up over: a run of two or a character other than a space. */
const ODD_SPACE = /[^\S ]|  /;

/* A string made of one piece. A global replace leaves a chain of pieces behind (on node 26, ten times the
   memory of the flat string it spells), and a line kept in a reading is kept for its whole life. */
const flat = /** @param {string} s @returns {string} */ (s) => { if (s.length) s.charCodeAt(0); return s; };

/** Calls `visit({text, offset})` for each non-empty line of a text, in order, one line at a time: nothing of the
 *  lines is kept here, so a reader that counts and discards holds one line, however long the text (R1, R3). */
/** @param {unknown} text @param {(line: Line) => void} visit @returns {void} */
export function eachLine(text, visit) {
  const raw = String(text || "");
  let at = 0;
  while (at <= raw.length) {
    let end = raw.indexOf("\n", at);
    if (end < 0) end = raw.length;
    let part = raw.slice(at, end);
    if (part.endsWith("\r")) part = part.slice(0, -1);
    const t = part.trim();
    if (t) visit({ text: flat(ODD_SPACE.test(t) ? t.replace(/\s+/g, " ") : t), offset: at + part.length - part.trimStart().length });
    at = end + 1;
  }
}

/** The self-naming line `x` is, with the kinds it names, or null: a short line a `roster_words` pattern matches. */
/** @param {Line} x @param {ReadonlyArray<RosterWordPattern>} patterns @returns {SelfLine | null} */
export function selfNamingLine(x, patterns) {
  if (countWords(x.text, TITLE_WORDS) > TITLE_WORDS) return null;
  /** @type {Set<RosterKind>} */
  const kinds = new Set();
  for (const p of patterns) if (x.text.search(p.re) >= 0) for (const k of p.kinds) kinds.add(k);
  return kinds.size ? { ...x, kinds: [...kinds] } : null;
}

/** The lines that name the document as a roster or chart: short lines a `roster_words` pattern matches. */
/** @param {ReadonlyArray<Line>} lines @param {ReadonlyArray<RosterWordPattern>} patterns @returns {SelfLine[]} */
export function selfNamingLines(lines, patterns) {
  /** @type {SelfLine[]} */
  const out = [];
  if (!patterns.length) return out;
  for (const x of lines) { const s = selfNamingLine(x, patterns); if (s) out.push(s); }
  return out;
}

/** What a document's self-naming lines name it: `{as, only_other}` for the kind asked. `as` holds the
 *  lines that name it this kind; `only_other` is true when it names itself, and only as the other kind. */
/** @param {ReadonlyArray<SelfLine>} selfLines @param {RosterKind} kind @returns {NamedAs} */
export function namedAs(selfLines, kind) {
  const as = selfLines.filter((x) => x.kinds.includes(kind));
  return { as, only_other: selfLines.length > 0 && !as.length };
}

/* ---- dates: a document's own stated date, and the dated-rows rule ---- */

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/* A date in the forms a schedule prints (staff_directory's own test, applied here: a month named with a
   day, or a three-part numeric date). */
export const DATE_IN_ROWS = new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}\\b|\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b`, "gi");
const FULL_DATE = new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b|\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})\\b|\\b(${MONTH})\\.?,?\\s+(\\d{4})\\b`, "i");

/** How many dates the document's rows carry, as staff_directory counts them over the flattened text: the date
 *  patterns take any run of white space where the flatten leaves one space, so the text is counted as it is,
 *  not copied (R1). */
/** @param {unknown} text @returns {number} */
export function datesIn(text) {
  const re = new RegExp(DATE_IN_ROWS.source, DATE_IN_ROWS.flags);
  const raw = String(text || "");
  let n = 0;
  while (re.exec(raw)) n++;
  return n;
}

const pad = /** @param {string | number} n @returns {string} */ (n) => String(n).padStart(2, "0");
/** The first date one of these lines states, as `{text, date, precision, offset}` (`date` is `YYYY-MM-DD`
 *  or, for a month and a year alone, `YYYY-MM`), or null. A two-digit year is not expanded: it is read as
 *  stated and given no `date`. */
/** @param {ReadonlyArray<Line>} lines @returns {StatedDate | null} */
export function statedDate(lines) {
  for (const x of lines) {
    const m = FULL_DATE.exec(x.text);
    if (!m) continue;
    const text = m[0];
    const offset = x.offset + m.index;
    /* The groups each alternative of FULL_DATE captures: 1 to 3, 4 to 6, or 7 and 8, each present when it matched. */
    const g = (/** @type {number} */ i) => m[i] ?? "";
    if (m[1]) {
      const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
      return { text, date: `${g(3)}-${pad(mo)}-${pad(g(2))}`, precision: "day", offset };
    }
    if (m[4]) {
      const y = g(6).length === 4 ? g(6) : null;
      /** @type {StatedDate} */
      const d = { text, date: y ? `${y}-${pad(m[4])}-${pad(g(5))}` : null, precision: y ? "day" : null, offset };
      if (!y) d.why = localize("roster-reader.lines.the_line_states_a_two_digit", "the line states a two-digit year, which is not expanded");
      return d;
    }
    const mo = MONTHS.indexOf(g(7).slice(0, 3).toLowerCase()) + 1;
    return { text, date: `${g(8)}-${pad(mo)}`, precision: "month", offset };
  }
  return null;
}

/* Does str[a, b) hold a letter? Looked for in place: no slice is made. */
/** @param {string} str @param {number} a @param {number} b @returns {boolean} */
function hasLetter(str, a, b) {
  for (let i = a; i < b; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) { if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return true; continue; }
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < b) { c = str.codePointAt(i) ?? c; i++; }
    if (LETTER_IN.test(String.fromCodePoint(c))) return true;
  }
  return false;
}
/* A word's letters alone, lowercased. */
const lettersOf = /** @param {string} str @param {number} a @param {number} b @returns {string} */ (str, a, b) => str.slice(a, b).replace(/[^\p{L}]/gu, "").toLowerCase();

/** Is a short line a unit's label: its last word, or its first before "of", a kind of unit? */
/** @param {unknown} s @returns {boolean} */
export function isUnitLine(s) {
  const str = String(s);
  /* The words that hold a letter: counted in place, the first two and the last stripped to their letters. */
  let n = 0, first = "", second = "", lastA = 0, lastB = 0;
  let i = 0;
  while (i < str.length) {
    while (i < str.length && isSpaceCode(str.charCodeAt(i))) i++;
    const a = i;
    while (i < str.length && !isSpaceCode(str.charCodeAt(i))) i++;
    if (i === a) break;
    if (!hasLetter(str, a, i)) continue;
    if (++n > TITLE_WORDS) return false;
    if (n === 1) first = lettersOf(str, a, i); else if (n === 2) second = lettersOf(str, a, i);
    lastA = a; lastB = i;
  }
  if (!n) return false;
  if (UNIT_WORDS.has(lettersOf(str, lastA, lastB))) return true;
  return n >= 3 && UNIT_WORDS.has(first) && second === "of";
}
const LETTER_IN = /\p{L}/u;

export const wordCount = /** @param {unknown} s @returns {number} */ (s) => countWords(String(s));
