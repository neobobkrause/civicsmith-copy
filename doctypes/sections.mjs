/* regulation's structure readings (A LAW 1a and 2; ladders §6.4 L2–L3): an instrument's or
 * a code's SECTIONS (paths, headings and extents, the `portion` extents `standards` keys on),
 * and the passages in them that DEFINE a term or EXCEPT something (R9–R14, R19).
 *
 * WHAT IS LOCAL AND WHAT IS NOT (R11, R20). A code's section numbers, the characters that
 * divide their parts, and the order of its subsection markers are the jurisdiction's: they
 * come from the view (`vocabulary.codes[].sections`, jurisdictions R6). An instrument's own
 * `SECTION n.` headings, the definitional voice ("'X' means") and the exceptive voice
 * ("notwithstanding", "shall not apply") are the language's, the same wherever an English-
 * speaking body legislates, so they stay here as the operative voice does in regulation.mjs.
 *
 * MEASURED ON THE CODIFIER'S OWN DOCUMENTS (`measures-T33/time-law.md` §4–§5; the captures in
 * `test/fixtures/codifier.json`): a code section is served as one document whose first line
 * is `<number> - <title>.`, its subsections as marker paragraphs (`A.`, `1.`, `(a)`), its
 * history note last; a charter article as one document whose sections each open a paragraph
 * `Section <number>. <title>.`. Today's reader found 0 of 50 boundaries; this one is tested on
 * every one of them (R17).
 *
 * THE FAILURE ASYMMETRY (R23, R24). A text no heading divides gives NO sections and says why,
 * never one section standing for the whole; a definitional or exceptive passage no section
 * holds is listed with `section: null` and why, never dropped (R19). Nothing here records a
 * law relation: a definition or an exception is a reading, and a member records what it
 * means, in `standards` (R15). */
import { vocabulary } from "../docprofile/doctypes/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { lineIndex, spend } from "./windows.mjs";
/** @import { DoctypeContext } from "../docprofile/doctypes/index.mjs" */
/** @import { Pattern, SectionMarker } from "../jurisdictions/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */
/** @import { LineIndex } from "./windows.mjs" */

/**
 * A code the view names with a section-number form (R9, R11).
 * @typedef {Object} CodeForm
 * @property {string} key the code's key in the view
 * @property {string} label the code's label, or its key where it has none
 * @property {RegExp} heading a line that opens one of its sections: groups `num` and `rest`
 * @property {RegExp} cite a citation of one of its sections in prose (global)
 * @property {RegExp | null} split what its number divides on, or null where it does not divide
 * @property {SectionMarker[]} markers its subsection marker kinds, outermost first
 */
/**
 * What `codeHeadingsIn` finds of a text's code headings (R9).
 * @typedef {Object} CodeHeadings
 * @property {number} count how many code headings the text holds
 * @property {boolean} first whether the first non-blank line is one
 * @property {string | null} label the label of the code the first names, or null where there is none
 */
/**
 * A section or subsection read from a text (R10–R12): its path, its number as printed (a subsection's as
 * `<parent>(<marker>)`), its heading's title or null, its extent in the text read and where that starts in the source.
 * @typedef {Object} Section
 * @property {string[]} path
 * @property {string} number
 * @property {string | null} heading
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 */
/**
 * The sections of a text, or none and why (R11, R24).
 * @typedef {Object} SectionsReading
 * @property {Section[]} sections
 * @property {string | null} sections_why null where sections were read
 */
/**
 * What a reading of passages needs of a section: its extent and its path (`Section` is one; so is a policy's outline
 * section).
 * @typedef {{ readonly start: number, readonly end: number, readonly path: ReadonlyArray<string> }} SectionExtent
 */
/**
 * A section's extent with its number as printed (`Section` is one).
 * @typedef {{ readonly start: number, readonly end: number, readonly path: ReadonlyArray<string>, readonly number: string }} NumberedExtent
 */
/**
 * A passage defining a term (R13).
 * @typedef {Object} Definition
 * @property {string} term
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {ReadonlyArray<string> | null} section the path of the deepest section holding it, or null
 * @property {string} [why] present where `section` is null: why no section holds it
 */
/**
 * A passage that excepts (R14).
 * @typedef {Object} Exception
 * @property {number} start
 * @property {number} end
 * @property {ReadingPosition | null} source
 * @property {ReadonlyArray<string> | null} section the path of the deepest section holding it, or null
 * @property {string[]} cites the section numbers it names
 * @property {string} [why] present where `section` is null: why no section holds it
 */
/** Where in the source an offset of the text read stands, or null.
 *  @typedef {(offset: number) => ReadingPosition | null} Locate */

/** `v`, which the code around it has made sure is there; a `TypeError` where it is not, as reading a member of it would
 *  have thrown.
 *  @template T
 *  @param {T | undefined} v
 *  @returns {T} */
function present(v) {
  if (v === undefined) throw new TypeError("sections: a value read is missing");
  return v;
}

/* ---------------------------------------------------------------- the view's forms */

/** @param {string} s @returns {string} */
const escapeClass = (s) => String(s).replace(/[\\\]^-]/g, "\\$&");
/** @param {string} re @returns {string} */
const piece = (re) => String(re).replace(/^\^/, "").replace(/(?<!\\)\$$/, "");
/** @param {string} src @param {string} flags @returns {RegExp | null} */
const compile = (src, flags) => { try { return new RegExp(src, flags); } catch { return null; } };
/** @param {Pattern} p @returns {string} */
const ownFlags = (p) => String((p && p.flags) || "").replace(/[^iu]/g, "");

/**
 * One subsection marker kind: the marker opening a line (group 1 its value), the first values of a level, and the value
 * after a given one, or null where none follows.
 * @typedef {Object} MarkerKind
 * @property {RegExp} re
 * @property {ReadonlyArray<string>} first
 * @property {(v: string) => string | null} next
 */
/**
 * @typedef {Object} MarkerKinds
 * @property {MarkerKind} letter
 * @property {MarkerKind} numeral
 * @property {MarkerKind} paren_letter
 * @property {MarkerKind} paren_numeral
 * @property {MarkerKind} roman
 */

/** The subsection marker kinds jurisdictions R6 names, each as the marker opens a line:
 *  its value, how values follow one another, and the first value of a level. */
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi",
               "xvii", "xviii", "xix", "xx"];
/** @param {string} v @returns {string | null} */
const nextLetter = (v) => (v.length === 1 && v !== "z" && v !== "Z" ? String.fromCharCode(v.charCodeAt(0) + 1) : null);
/** @type {MarkerKinds} */
const MARKERS = {
  /* A letter's case is the level's own: the first value read there (`A.` or `a.`) sets it. */
  letter:        { re: /^([A-Za-z])\.(?=\s|$)/,       first: ["A", "a"], next: nextLetter },
  numeral:       { re: /^(\d{1,3})\.(?=\s|$)/,        first: ["1"], next: (v) => String(Number(v) + 1) },
  paren_letter:  { re: /^\(([A-Za-z])\)(?=\s|$)/,     first: ["A", "a"], next: nextLetter },
  paren_numeral: { re: /^\((\d{1,3})\)(?=\s|$)/,      first: ["1"], next: (v) => String(Number(v) + 1) },
  roman:         { re: /^\(?([ivx]{1,5})[.)](?=\s|$)/, first: ["i"],
                   next: (v) => { const i = ROMAN.indexOf(v); return i >= 0 && i + 1 < ROMAN.length ? present(ROMAN[i + 1]) : null; } },
};
/** The marker kind of a code form's level `level` (one of its levels).
 *  @param {CodeForm} form @param {number} level @returns {MarkerKind} */
const markerAt = (form, level) => MARKERS[present(form.markers[level])];

/** The codes the view names with a section-number form (R9, R11): each with its heading
 *  recogniser, the separators its number divides on, its subsection marker order, and a
 *  recogniser for a citation of one of its sections in prose (R14's `cites`).
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {CodeForm[]} */
export function codeForms(ctx) {
  /** @type {CodeForm[]} */
  const out = [];
  for (const c of vocabulary(ctx, "codes")) {
    /* An entry with no `key` gives no form, as one with no `sections` does (the view's entries are objects,
       `vocabulary` says; of its kinds only a code's has a key). */
    if (!c || !("key" in c)) continue;
    const s = c.sections;
    if (!s || typeof s !== "object" || !s.number || typeof s.number.re !== "string" || !s.number.re) continue;
    if (typeof c.key !== "string" || !c.key) continue;
    const num = piece(s.number.re);
    const flags = ownFlags(s.number);
    /* A heading: the number opening a line, optionally after the words any code is cited by,
       then a title. The title is required: a bare number on a line is not a heading. */
    const heading = compile(`^[ \\t]*(?:(?:Section|SECTION|Sec\\.|§{1,2})[ \\t]*)?(?<num>${num})(?![0-9A-Za-z])\\.?[ \\t]*(?:[-–—:][ \\t]*)?(?<rest>\\S.*)$`, flags);
    const cite = compile(`(?<![0-9A-Za-z.])(?:${num})(?![0-9A-Za-z])`, flags + "g");
    if (!heading || !cite) continue;
    const seps = typeof s.separators === "string" && s.separators ? s.separators : "";
    const markers = (Array.isArray(s.markers) ? s.markers : []).filter((m) => Object.hasOwn(MARKERS, m));
    out.push({ key: c.key, label: typeof c.label === "string" && c.label ? c.label : c.key, heading, cite,
               split: seps ? new RegExp(`[${escapeClass(seps)}]+`) : null, markers });
  }
  return out;
}

/* ---------------------------------------------------------------------- text lines */

/* Every line of the text is held as an offset (R38, ./windows.mjs `lineIndex`), so an extent is an offset into the text
   read and a large text is never split into a list of its lines. */

/** A title as printed after a heading's number: up to its own full stop, or the line's end.
 *  `stopped` requires the stop: a code's heading ends its title with one (measured: every
 *  codifier heading, `2.20.030 - Definitions.`, `Section 200. Composition of the Council.`),
 *  where a street address or a list line opening with a number does not. */
/** @param {string | undefined} rest @param {boolean} [stopped] @returns {string | null} */
function titleOf(rest, stopped = false) {
  const t = String(rest || "").trim();
  const stop = t.search(/\.(?=\s|$)/);
  if (stopped && stop < 0) return null;
  const title = (stop >= 0 ? t.slice(0, stop) : t).trim();
  return /^[A-Z"“'‘(]/.test(title) && /[A-Za-z]{2}/.test(title) ? title.slice(0, 300) : null;
}

/* -------------------------------------------------------------------- the sections */

/** Two section paths in a code's order: part by part, numerically where both parts are
 *  numbers (`2.20.090` before `2.20.100`), else as text. */
/** @param {ReadonlyArray<string>} a @param {ReadonlyArray<string>} b @returns {number} */
function comparePaths(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i], bi = b[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const x = /^\d+/.exec(ai), y = /^\d+/.exec(bi);
    if (x && y && Number(x[0]) !== Number(y[0])) return Number(x[0]) - Number(y[0]);
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

/**
 * A heading read from the text: where it starts, its line, its number and title, the code form it is of (null for an
 * instrument's own) and its path.
 * @typedef {{ readonly start: number, readonly li: number, readonly number: string, readonly heading: string | null, readonly form: CodeForm | null, readonly path: string[] }} Head
 */
/**
 * A code's heading: a `Head` of a code form, with a title.
 * @typedef {Object} CodeHead
 * @property {number} start
 * @property {number} li
 * @property {string} number
 * @property {string} heading
 * @property {CodeForm} form
 * @property {string[]} path
 */

/** The number and the rest of a heading `f.heading` matched (its pattern always has both groups).
 *  @param {RegExpExecArray} m @returns {{ num: string, rest: string | undefined }} */
function headingParts(m) {
  const groups = present(m.groups);
  return { num: present(groups.num), rest: groups.rest };
}

/** A code's section headings in the text read, in document order.
 *  @param {LineIndex} lines @param {ReadonlyArray<CodeForm>} forms @returns {CodeHead[]} */
function codeHeadings(lines, forms) {
  /** @type {CodeHead[]} */
  const out = [];
  for (let li = 0; li < lines.length; li++) {
    const l = lines.at(li);
    /* One document is of one code: after the first heading, only that code's headings
       divide it (a paragraph opening "1946 Termination of Tenancy." in a code section is
       another code's citation, not a section of a second code). */
    const head = out[0];
    for (const f of head ? [head.form] : forms) {
      const m = f.heading.exec(l.text);
      if (!m) continue;
      const parts = headingParts(m);
      const title = titleOf(parts.rest, true);
      if (!title) continue;
      const number = parts.num;
      /* A code is printed in its own order: a heading numbered before the one above it is
         a citation or a list line, not the next section. */
      const split = f.split;
      const path = split ? number.split(split).filter(Boolean) : [number];
      const above = out.at(-1);
      if (above && comparePaths(path, above.path) <= 0) break;
      out.push({ start: present(l.start) + (l.text.length - l.text.trimStart().length), li, number, heading: title, form: f, path });
      break;
    }
  }
  return out;
}

/** An instrument's own `SECTION n.` headings: place-free (R11), and read only in sequence
 *  from 1, so a sentence that happens to open with "Section 4." of another law is not one.
 *  @param {LineIndex} lines @returns {Head[]} */
function instrumentHeadings(lines) {
  /** @type {Head[]} */
  const out = [];
  let expect = 1;
  for (let li = 0; li < lines.length; li++) {
    const l = lines.at(li);
    const m = /^[ \t]*(?:SECTION|Section)[ \t]+(\d{1,3})[A-Z]?[ \t]*\.[ \t]*(.*)$/.exec(l.text);
    if (!m || Number(m[1]) !== expect) continue;
    expect++;
    const number = present(m[1]);
    out.push({ start: present(l.start) + (l.text.length - l.text.trimStart().length), li, number,
               heading: titleOf(m[2]), form: null, path: [number] });
  }
  return out;
}

/** The subsections of one code section, from its marker lines, in the order the code's
 *  markers nest (R10, R11). A marker is read only where it continues the sequence it belongs
 *  to (B after A, 2 after 1) or opens the next level at its first value, so a line that
 *  merely begins with "3." in prose is not a subsection. */
/** @param {LineIndex} lines @param {Head} sec @param {Section} secEntry `sec`'s section
 *  @param {number} end @param {CodeForm | null} form @param {Locate} locate @returns {Section[]} */
function subsections(lines, sec, secEntry, end, form, locate) {
  /** @type {Section[]} */
  const out = [];
  if (!form || !form.markers.length) return out;
  /** @type {Array<{ level: number, value: string, entry: Section }>} */
  const open = [];          // [{level, value, entry}]
  /** @param {number} depth @param {number} at */
  const close = (depth, at) => { while (open.length > depth) present(open.pop()).entry.end = at; };
  for (let li = sec.li + 1; li < lines.length && present(lines.start(li)) < end; li++) {
    const l = lines.at(li);
    const t = l.text.trimStart();
    const at = present(l.start) + (l.text.length - t.length);
    /** @type {{ depth: number, level: number, value: string } | null} */
    let placed = null;
    /* A sibling at this level or an ancestor's, deepest first; then a child of the deepest. */
    for (let d = open.length - 1; d >= 0 && !placed; d--) {
      const od = present(open[d]);
      const k = markerAt(form, od.level);
      const m = k.re.exec(t);
      const v = m ? m[1] : undefined;
      if (m && v === k.next(od.value)) placed = { depth: d, level: od.level, value: present(v) };
    }
    /* Else a child of the deepest open level, at its first value: the next level in the
       code's order, or a deeper one where the code skips a level (a first `i.` with no
       letter above it), the nearest that fits. */
    /* With nothing open, only the code's first two levels open (a charter section may
       begin at `(1)`): a first `i.` at the top of a code section is a list inside its prose
       (a definition's items), not a subsection. */
    const deepest = open.length ? form.markers.length : Math.min(2, form.markers.length);
    const top = open.at(-1);
    for (let level = top ? top.level + 1 : 0; !placed && level < deepest; level++) {
      const k = markerAt(form, level);
      const m = k.re.exec(t);
      const v = m ? m[1] : undefined;
      if (m && v !== undefined && k.first.includes(v)) placed = { depth: open.length, level, value: v };
    }
    /* A marker standing alone on its line (the codifier's marker paragraph) that continues
       no sequence still opens a subsection where its kind belongs: under the nearest open
       subsection of a shallower level. Measured: a code section printing `D.`, then `a.`
       to `f.`, then `2.` with no `1.` (its first item unnumbered); the `2.` is D's. */
    if (!placed && /^\S+$/.test(t.trim())) {
      for (let level = 0; !placed && level < form.markers.length; level++) {
        const m = markerAt(form, level).re.exec(t);
        if (!m) continue;
        let depth = 0;
        while (depth < open.length && present(open[depth]).level < level) depth++;
        if (depth > 0) placed = { depth, level, value: present(m[1]) };
      }
    }
    const got = placed;
    if (!got) continue;
    close(got.depth, at);
    const above = open.at(-1);
    const parent = above ? above.entry : secEntry;
    /** @type {Section} */
    const entry = { path: [...parent.path, got.value], number: `${parent.number}(${got.value})`, heading: null,
                    start: at, end, source: locate(at) || null };
    out.push(entry);
    open.push({ level: got.level, value: got.value, entry });
  }
  close(0, end);
  return out;
}

/** The code headings of a text (R9): how many there are, whether the first non-blank line
 *  is one, and the label of the code the first names.
 *  @param {string | null | undefined} raw
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {CodeHeadings} */
export function codeHeadingsIn(raw, ctx) {
  /* R37: the same reading as `codeHeadings`, a line at a time, so a large text is never split into a list of all its
     lines. */
  const all = String(raw || "");
  spend(all.length);
  const forms = codeForms(ctx);
  /* `firstForm` and `lastPath` are set with the first heading counted, so each is null exactly while `count` is 0. */
  /** @type {CodeForm | null} */
  let firstForm = null;
  /** @type {string[] | null} */
  let lastPath = null;
  let count = 0, firstHeadAt = -1, firstLineAt = -1;
  for (let start = 0; ;) {
    const nl = all.indexOf("\n", start);
    const text = all.slice(start, nl < 0 ? all.length : nl);
    if (firstLineAt < 0 && text.trim().length) firstLineAt = start;
    /** @type {CodeForm | null} */
    const ff = firstForm;
    for (const f of ff ? [ff] : forms) {
      const m = f.heading.exec(text);
      if (!m) continue;
      const parts = headingParts(m);
      const title = titleOf(parts.rest, true);
      if (!title) continue;
      const split = f.split;
      const path = split ? parts.num.split(split).filter(Boolean) : [parts.num];
      const lp = lastPath;
      if (lp && comparePaths(path, lp) <= 0) break;
      if (!count) { firstForm = f; firstHeadAt = start; }
      count++;
      lastPath = path;
      break;
    }
    if (nl < 0) break;
    start = nl + 1;
  }
  const ff = firstForm;
  return { count, first: !!(firstLineAt >= 0 && count && firstHeadAt === firstLineAt),
           label: ff ? ff.label : null };
}

/** The sections of the text read, with each extent (R10–R12), or none and why (R11, R24).
 *  @param {string} raw
 *  @param {string | null | undefined} form `"code"`, `"instrument"`, or anything else for neither
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {Locate} locate
 *  @returns {SectionsReading} */
export function readSections(raw, form, ctx, locate) {
  const lines = lineIndex(raw);
  const forms = codeForms(ctx);
  /** @type {ReadonlyArray<Head>} */
  const heads = form === "code" ? codeHeadings(lines, forms) : form === "instrument" ? instrumentHeadings(lines) : [];
  if (!heads.length) {
    const why = form === "code"
      ? (forms.length ? localize("doctypes.sections.no_code_heading", "no line of this text opens with a section number of a code the active jurisdiction profiles name, followed by a title, so it is not divided into sections")
                      : localize("doctypes.sections.no_code_forms", "no active jurisdiction profile gives a section-number form for any code, so no code section is read"))
      : form === "instrument"
        ? "no `SECTION 1.` heading opens a line of this instrument, so its text is not divided into sections"
        : forms.length
          ? localize("doctypes.sections.neither_form", "this text was read as neither an instrument nor a code section, so it is not divided into sections")
          : localize("doctypes.sections.neither_form_no_codes", "this text was read as neither an instrument nor a code section, so it is not divided into sections; and no active jurisdiction profile gives a section-number form for any code");
    return { sections: [], sections_why: why };
  }
  /** @type {Section[]} */
  const sections = [];
  heads.forEach((h, i) => {
    const next = heads[i + 1];
    const end = next ? next.start : raw.length;
    /** @type {Section} */
    const entry = { path: h.path, number: h.number, heading: h.heading, start: h.start, end, source: locate(h.start) || null };
    sections.push(entry);
    for (const s of subsections(lines, h, entry, end, h.form, locate)) sections.push(s);
  });
  return { sections, sections_why: null };
}

/** The deepest section whose extent holds `offset`, or null (found by looking through every section).
 *  @param {ReadonlyArray<SectionExtent>} sections @param {number} offset @returns {SectionExtent | null} */
function holder(sections, offset) {
  /** @type {SectionExtent | null} */
  let best = null;
  for (const s of sections)
    if (offset >= s.start && offset < s.end) {
      const b = best;
      if (!b || s.path.length > b.path.length) best = s;
    }
  return best;
}
/** `holder` for many offsets over the same sections, in work that does not grow with the number of sections each time
 *  (R40): sections nest, so the deepest one holding an offset is the nearest of the last section to start at or before it
 *  and the sections that hold that one's start. Sections not in the order of their starts are looked through, as `holder`
 *  does.
 *  @param {ReadonlyArray<SectionExtent>} sections @returns {(offset: number) => SectionExtent | null} */
function holderOf(sections) {
  const n = sections.length;
  const parent = new Int32Array(n);
  /** @type {number[]} */
  const open = [];
  for (let i = 0; i < n; i++) {
    const si = present(sections[i]);
    if (i && si.start < present(sections[i - 1]).start) return (offset) => holder(sections, offset);
    while (open.length && present(sections[present(open.at(-1))]).end <= si.start) open.pop();
    parent[i] = open.length ? present(open.at(-1)) : -1;
    open.push(i);
  }
  return (offset) => {
    let lo = 0, hi = n - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (present(sections[mid]).start <= offset) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    while (at >= 0 && !(offset < present(sections[at]).end)) at = present(parent[at]);
    return at >= 0 ? present(sections[at]) : null;
  };
}
/** @param {ReadonlyArray<SectionExtent>} sections @returns {string} */
const unplacedWhy = (sections) => (sections.length
  ? localize("doctypes.sections.unplaced", "no section read from this text holds this passage (it stands before the first heading)")
  : localize("doctypes.sections.not_divided", "this text was not divided into sections, so no section can be named for this passage"));

/* ------------------------------------------------------------------ the definitions */

/* The definitional voice: a quoted term followed by the verbs that define it, and the
   "as used in this <part>" opener. English legal voice, place-free (R13; Suggestions). */
const Q_OPEN = "[\"“‘']", Q_CLOSE = "[\"”’']";
const TERM = `${Q_OPEN}[^"“”‘’'\\n]{1,120}?${Q_CLOSE}`;
/* One term, or several naming one thing (`"Board" and "Residential Rent Adjustment Board"
   means`): each is a term the passage defines. */
const DEFINES = new RegExp(`(?<chain>(?:${TERM}[ \\t]*(?:,[ \\t]*)?(?:and|or)?[ \\t]+)*)${TERM}[ \\t]*,?[ \\t]*(?:as[ \\t]+used[ \\t]+in[ \\t]+this[ \\t]+\\w+[ \\t]*,[ \\t]*)?(?:shall[ \\t]+mean|shall[ \\t]+include|means|includes|is[ \\t]+defined[ \\t]+as|refers[ \\t]+to)\\b`, "g");
const AS_USED = new RegExp(`\\bas[ \\t]+used[ \\t]+in[ \\t]+this[ \\t]+(?:chapter|article|section|title|code|ordinance|resolution|part|division|subsection)[ \\t]*,?[ \\t]*(?:the[ \\t]+(?:term|word|phrase|words)[ \\t]+)?(?<chain>)${TERM}`, "gi");
const TERMS = new RegExp(`${Q_OPEN}([^"“”‘’'\\n]{1,120}?)${Q_CLOSE}`, "g");
/* A line that is only a list or subsection marker (`1.`, `(a)`, `ii.`). */
const MARKER_LINE = /^\s*\(?[A-Za-z0-9]{1,4}[.)]\s*$/;

/** The bounds of the line that holds `at`, found again only when `at` leaves the line last found (R40: many passages on
 *  one long line do not each look for its ends). */
/** @param {string} raw @returns {(at: number) => [number, number]} */
function lineFinder(raw) {
  let from = -1, to = -1;
  return (at) => {
    if (at < from || at > to) {
      from = at > 0 ? raw.lastIndexOf("\n", at - 1) + 1 : 0;
      const nl = raw.indexOf("\n", from);
      to = nl < 0 ? raw.length : nl;
    }
    return [from, to];
  };
}

/** Where a definitional passage ends: its paragraph's end, or, for a paragraph ending in a colon, past the list it
 *  introduces (marker lines and the paragraph after each). R38: read from the text a line at a time. */
/** @param {string} raw @param {number} from @param {(at: number) => [number, number]} lineOf @returns {number} */
function passageEnd(raw, from, lineOf) {
  if (from > raw.length) return raw.length;
  /** @param {number} at */
  const lineEnd = (at) => { const nl = raw.indexOf("\n", at); return nl < 0 ? raw.length : nl; };
  const [lineStart, first] = lineOf(from);
  let end = first;
  /* A line ends in a colon when its last character that is not white space is one. */
  let last = end;
  while (last > lineStart && /\s/.test(raw.charAt(last - 1))) last--;
  if (!(last > lineStart && raw.charAt(last - 1) === ":")) return end;
  let afterMarker = false;
  while (end < raw.length) {
    const next = lineEnd(end + 1);
    if (MARKER_LINE.test(raw.slice(end + 1, next))) { afterMarker = true; end = next; continue; }
    if (!afterMarker) break;
    afterMarker = false;
    end = next;
  }
  return end;
}

/* What a line must hold for either voice to match in it (R40): the verb that closes a definition, or the opener of the
   "as used in this" form. A line without it is not run through the voice's pattern, whose chain of terms is read again
   from each quote of a line that has none. */
const DEFINES_GATE = /shall[ \t]+mean|shall[ \t]+include|means|includes|is[ \t]+defined[ \t]+as|refers[ \t]+to/;
const AS_USED_GATE = /as[ \t]+used[ \t]+in[ \t]+this/i;

/* A line longer than this is read around the places its gate matches and not whole (R40, B13): the chain of quoted terms
   a definition names is read again from each quote of a line that has a verb far from them, so a line of tens of
   thousands of quoted words with a verb at its end would be read once for each word. What is read is the stretch before
   the verb in which a chain stands (`before` characters; a chain of more than that many characters of quoted terms
   before its verb reads from its later terms) and the stretch after the opener of the "as used in this" form. */
const LONG_LINE = 3000;

/** Calls `fn(m, index)` for each match of the global pattern `re` in `raw`, `index` its offset in `raw`. A match of the
 *  definitional voices never holds a line break, so the text is read a line at a time, and only the lines `gate` admits;
 *  a long line only around the places the gate matches (`before` and `after` characters about each). */
/* `matchAll` reads a copy of its pattern and never moves the pattern's own `lastIndex`, and nothing here moves the
   `lastIndex` of a pattern it reads so (the voices, `TERMS`, `EXCEPTS`, a code form's `cite`, each read only by
   `matchAll`), so each starts at 0 and none is reset by hand. */
/** @param {string} raw @param {RegExp} re @param {RegExp} gate @param {(m: RegExpExecArray, index: number) => void} fn
 *  @param {number} [before] @param {number} [after] */
function eachLineMatch(raw, re, gate, fn, before = 1500, after = 80) {
  const global = new RegExp(gate.source, gate.flags.includes("g") ? gate.flags : gate.flags + "g");
  for (let at = 0; ;) {
    const nl = raw.indexOf("\n", at);
    const end = nl < 0 ? raw.length : nl;
    if (end - at <= LONG_LINE) {
      const line = raw.slice(at, end);
      if (line && gate.test(line)) {
        for (const m of line.matchAll(re)) fn(m, m.index + at);
      }
    } else {
      const line = raw.slice(at, end);
      let done = 0;
      for (const g of line.matchAll(global)) {
        const from = Math.max(done, g.index - before), to = Math.min(line.length, g.index + g[0].length + after);
        if (to <= done) continue;
        for (const m of line.slice(from, to).matchAll(re)) {
          if (from + m.index < done) continue;
          const index = m.index + at + from;
          fn(m, index);
          done = index - at + m[0].length;
        }
        done = Math.max(done, to);
      }
    }
    if (nl < 0) return;
    at = nl + 1;
  }
}

/** Every passage defining a term (R13), in reading order: `{term, start, end, source,
 *  section}`, `end` the end of its paragraph or the start of the next definition in it.
 *  @param {string} raw
 *  @param {ReadonlyArray<SectionExtent>} sections
 *  @param {Locate} locate
 *  @returns {Definition[]} */
export function readDefinitions(raw, sections, locate) {
  spend(raw.length * 2);   // the two voices each read the text once
  /** @type {Array<{ start: number, at: number, term: string }>} */
  const hits = [];
  /** @type {Array<[RegExp, RegExp, number, number]>} */
  const voices = [[DEFINES, DEFINES_GATE, 1500, 80], [AS_USED, AS_USED_GATE, 20, 500]];
  for (const [re, gate, before, after] of voices) {
    eachLineMatch(raw, re, gate, (m, index) => {
      const tail = AS_USED === re ? m[0].slice(m[0].search(new RegExp(Q_OPEN + "[^" + "\"“”‘’'" + "]*" + Q_CLOSE + "$"))) : m[0];
      const base = index + m[0].length - tail.length;
      for (const t of tail.matchAll(TERMS)) hits.push({ start: base + t.index, at: index, term: present(t[1]).trim() });
    }, before, after);
  }
  hits.sort((a, b) => a.start - b.start);
  /* The hits are in the order of their starts, so a start met twice is the last one kept. */
  /** @type {Array<{ start: number, at: number, term: string }>} */
  const kept = [];
  for (const h of hits) {
    const last = kept.at(-1);
    if (!last || last.start !== h.start) kept.push(h);
  }
  /* A passage's terms share its extent: from its first term to its end. */
  /** @type {Array<{ at: number, start: number, terms: Array<{ start: number, at: number, term: string }> }>} */
  const passages = [];
  for (const h of kept) {
    const p = passages.length ? passages.at(-1) : null;
    if (p && p.at === h.at) p.terms.push(h); else passages.push({ at: h.at, start: h.start, terms: [h] });
  }
  /** @type {Definition[]} */
  const out = [];
  const holderAt = holderOf(sections), lineOf = lineFinder(raw);
  passages.forEach((p, i) => {
    let end = passageEnd(raw, p.start, lineOf);
    const next = passages[i + 1];
    if (next && next.start < end && next.start > p.start) end = next.start;
    const s = holderAt(p.start);
    for (const t of p.terms) {
      /** @type {Definition} */
      const d = { term: t.term, start: t.start, end, source: locate(t.start) || null, section: s ? s.path : null };
      if (!s) d.why = unplacedWhy(sections);
      out.push(d);
    }
  });
  return out;
}

/* ------------------------------------------------------------------- the exceptions */

/* The exceptive voice (R14): English legal voice, place-free. */
const EXCEPTS = /\b(?:except[ \t]+as[ \t]+(?:otherwise[ \t]+)?(?:provided|set[ \t]+forth|specified|permitted|required|authorized|stated)\b|notwithstanding\b|(?:does|do|shall)[ \t]+not[ \t]+apply\b)/gi;
/* Where a sentence ends: a stop before a capital or the line's end, but not after the
   abbreviations legal text cites by. */
const ABBREV = /(?:\b(?:Sec|Secs|No|Nos|Gov|Govt|Ord|Res|Stat|Stats|Cal|Civ|Pen|Proc|Ch|Art|Subd|seq|al|etc|Inc|St|Code|U\.S|i\.e|e\.g|v|vs|Mr|Ms|Dr)|\b[A-Z])$/;

const SPACE = /\s/;
/** The sentence around each exceptive passage, one passage after another in the order of the text (R14): `(at, endAt)`
 *  gives `{start, end}`. A sentence starts after the last stop before the passage on its line (a stop is a `.` or `;`
 *  and white space and a capital, and not the end of an abbreviation) and ends at the first stop after it, or at the end
 *  of the line. R40: the stops are met once, by a cursor along the line, and the end found for one passage is the end of
 *  every passage before it, so a line of 40,000 passages is read once and not 40,000 times.
 *  @param {string} raw @returns {(at: number, endAt: number) => { start: number, end: number }} */
function sentenceReader(raw) {
  let ls = -1, le = -1;                  // the line being read
  let cursor = 0, stopStart = 0;         // stops met up to `cursor`; the start after the last of them
  let tFrom = -1, tTo = -1, tEnd = -1;   // the last end found: for any passage ending in [tFrom, tTo] it is tEnd
  /** @param {number} j */
  const tail = (j) => ABBREV.test(raw.slice(Math.max(ls, j - 8), j));
  return (at, endAt) => {
    if (at < ls || at > le || at < cursor) {
      ls = raw.lastIndexOf("\n", at - 1) + 1;
      const nl = raw.indexOf("\n", endAt);
      le = nl < 0 ? raw.length : nl;
      cursor = ls; stopStart = ls; tFrom = -1;
    }
    for (let j = cursor; j < at; j++) {
      const c = raw.charCodeAt(j);
      if (c !== 46 && c !== 59) continue;
      let k = j + 1;
      if (!(k < raw.length && SPACE.test(raw.charAt(k)))) continue;
      while (k < raw.length && SPACE.test(raw.charAt(k))) k++;
      if (k < raw.length && "\"“(".includes(raw.charAt(k))) k++;
      if (!(k < raw.length && raw.charCodeAt(k) >= 65 && raw.charCodeAt(k) <= 90)) continue;
      if (tail(j)) continue;
      stopStart = j + 1;
    }
    cursor = at;
    let start = stopStart;
    while (start < at && SPACE.test(raw.charAt(start))) start++;
    if (!(tFrom >= 0 && endAt >= tFrom && endAt <= tTo)) {
      let stop = le, end = le;
      for (let i = endAt; i < le; i++) {
        const c = raw.charCodeAt(i);
        if (c !== 46 && c !== 59) continue;
        if (!(i + 1 === le || SPACE.test(raw.charAt(i + 1)))) continue;
        if (tail(i)) continue;
        stop = i; end = i + 1;
        break;
      }
      tFrom = endAt; tTo = stop; tEnd = end;
    }
    return { start, end: tEnd };
  };
}

/** Every passage that excepts (R14), one per sentence, in reading order: `{start, end,
 *  source, section, cites}`, `cites` the section numbers it names in the view's forms, and
 *  for an instrument its own `Section n` references to its own sections.
 *  @param {string} raw
 *  @param {ReadonlyArray<NumberedExtent>} sections
 *  @param {string | null | undefined} form `"instrument"` reads its own references
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {Locate} locate
 *  @returns {Exception[]} */
export function readExceptions(raw, sections, form, ctx, locate) {
  spend(raw.length);
  const forms = codeForms(ctx);
  /** @type {Set<string>} */
  const own = new Set(form === "instrument" ? sections.filter((s) => s.path.length === 1).map((s) => s.number) : []);
  /** @type {Exception[]} */
  const out = [];
  const holderAt = holderOf(sections), sentenceOf = sentenceReader(raw);
  /** @type {Set<number>} */
  const starts = new Set();
  for (const m of raw.matchAll(EXCEPTS)) {
    const { start, end } = sentenceOf(m.index, m.index + m[0].length);
    if (starts.has(start)) continue;
    starts.add(start);
    const text = raw.slice(start, end);
    /** @type {string[]} */
    const cites = [];
    /** @type {Array<{ at: number, n: string }>} */
    const hits = [];
    for (const f of forms) for (const c of text.matchAll(f.cite)) hits.push({ at: c.index, n: c[0] });
    if (own.size)
      for (const c of text.matchAll(/\bSections?[ \t]+(\d{1,3})\b/g)) {
        const n = c[1];
        if (n !== undefined && own.has(n)) hits.push({ at: c.index, n });
      }
    hits.sort((a, b) => a.at - b.at);
    for (const h of hits) if (!cites.includes(h.n)) cites.push(h.n);
    const s = holderAt(start);
    /** @type {Exception} */
    const e = { start, end, source: locate(start) || null, section: s ? s.path : null, cites };
    if (!s) e.why = unplacedWhy(sections);
    out.push(e);
  }
  return out;
}

/* -------------------------------------------------------------------- the digest */

/* SHA-256, pure and synchronous, so `assess` can tell whether a section's text moved
   between two readings (R16) without either reading carrying the text twice. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
/* Every index read below is within its array (a block is 64 bytes, `W` and `K` hold 64 words, `H` eight), so each
   `?? 0` never applies. */
class Sha256 {
  constructor() {
    /** @type {Uint32Array} the hash state */
    this.H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    /** @type {Uint32Array} the message schedule */
    this.W = new Uint32Array(64);
    /** @type {Uint8Array} the bytes not yet a whole block */
    this.tail = new Uint8Array(64);
    /** @type {number} how many of `tail` are held */
    this.held = 0;
    /** @type {number} the bytes given so far */
    this.length = 0;
  }
  /** @param {Uint8Array} b @param {number} o */
  block(b, o) {
    const { H, W } = this;
    /** @param {number} i @returns {number} */
    const w = (i) => W[i] ?? 0;
    /** @param {number} x @param {number} n @returns {number} */
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < 16; i++)
      W[i] = ((b[o + i * 4] ?? 0) << 24) | ((b[o + i * 4 + 1] ?? 0) << 16) | ((b[o + i * 4 + 2] ?? 0) << 8) | (b[o + i * 4 + 3] ?? 0);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w(i - 15), 7) ^ rotr(w(i - 15), 18) ^ (w(i - 15) >>> 3);
      const s1 = rotr(w(i - 2), 17) ^ rotr(w(i - 2), 19) ^ (w(i - 2) >>> 10);
      W[i] = (w(i - 16) + s0 + w(i - 7) + s1) >>> 0;
    }
    let a = H[0] ?? 0, b2 = H[1] ?? 0, c = H[2] ?? 0, d = H[3] ?? 0, e = H[4] ?? 0, f = H[5] ?? 0, g = H[6] ?? 0, h = H[7] ?? 0;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + w(i)) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] ?? 0) + a; H[1] = (H[1] ?? 0) + b2; H[2] = (H[2] ?? 0) + c; H[3] = (H[3] ?? 0) + d;
    H[4] = (H[4] ?? 0) + e; H[5] = (H[5] ?? 0) + f; H[6] = (H[6] ?? 0) + g; H[7] = (H[7] ?? 0) + h;
  }
  /** @param {Uint8Array} bytes @returns {Sha256} */
  update(bytes) {
    this.length += bytes.length;
    let o = 0;
    if (this.held) {
      const take = Math.min(64 - this.held, bytes.length);
      this.tail.set(bytes.subarray(0, take), this.held);
      this.held += take; o = take;
      if (this.held < 64) return this;
      this.block(this.tail, 0);
      this.held = 0;
    }
    for (; o + 64 <= bytes.length; o += 64) this.block(bytes, o);
    this.tail.set(bytes.subarray(o), 0);
    this.held = bytes.length - o;
    return this;
  }
  /** @returns {string} the digest, 64 lower-case hexadecimal digits */
  hex() {
    const rest = this.held;
    const pad = new Uint8Array(((rest + 9 + 63) >> 6) << 6);
    pad.set(this.tail.subarray(0, rest));
    pad[rest] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, Math.floor(this.length / 0x20000000));
    dv.setUint32(pad.length - 4, (this.length << 3) >>> 0);
    for (let o = 0; o < pad.length; o += 64) this.block(pad, o);
    return [...this.H].map((x) => x.toString(16).padStart(8, "0")).join("");
  }
}

/** The SHA-256 of `str`'s UTF-8 bytes, as 64 lower-case hexadecimal digits.
 *  @param {string} str @returns {string} */
export function sha256Hex(str) {
  return new Sha256().update(new TextEncoder().encode(String(str))).hex();
}

const DIGEST_PIECE = 1 << 16;

/** The SHA-256 of `raw.slice(start, end).replace(/\s+/g, " ").trim()`, read a piece at a time (R38): a section that runs
 *  over a large text is never copied whole, normalised and encoded. A piece is never cut between the two halves of a
 *  surrogate pair, and a white-space run across two pieces is one space, so the digest is the whole slice's.
 *  @param {string} raw @param {number} start @param {number} end
 *  @param {number} [piece] the characters read at a time
 *  @returns {string} */
export function textDigest(raw, start, end, piece = DIGEST_PIECE) {
  const sha = new Sha256();
  const enc = new TextEncoder();
  let started = false, space = false;
  for (let at = start; at < end;) {
    let cut = Math.min(end, at + piece);
    while (cut < end && raw.charCodeAt(cut - 1) >= 0xd800 && raw.charCodeAt(cut - 1) <= 0xdbff) cut++;
    let q = raw.slice(at, cut).replace(/\s+/g, " ");
    at = cut;
    if (q.startsWith(" ")) { if (started) space = true; q = q.slice(1); }
    if (!q) continue;
    const trailing = q.endsWith(" ");
    if (trailing) q = q.slice(0, -1);
    sha.update(enc.encode(space ? ` ${q}` : q));
    space = trailing;
    started = true;
  }
  return sha.hex();
}
