/* What this module reads from the jurisdiction view (R12): every title, heading,
 * header word and code form is the profile's, never this file's.
 *
 * The keys (QUESTION J1 to BOB; `jurisdictions` R6 and R52 as this job reads
 * them): `vocabulary.financial_report_titles`, `budget_book_titles`,
 * `financial_headings` and `fiscal_year_forms`, each `{pattern, basis}`;
 * `vocabulary.budget_headers`, each `{column, pattern, basis}`; and
 * `classification_schemes`, each `{scheme, kind, forms: [{re, flags}]}`, the
 * code forms of a budget's classification. A view without a key reads as an
 * empty list, and every reader then says it found nothing for want of it. */
import { readerView, vocabulary, vocabRegex } from "../docprofile/registry.mjs";
/** @import { DoctypeContext, VocabularyEntry } from "../docprofile/registry.mjs" */
/** @import { BudgetColumn, ClassificationKind } from "../jurisdictions/index.mjs" */

/**
 * A vocabulary key whose entries are patterns alone: titles, headings and fiscal-year forms.
 * @typedef {"financial_report_titles" | "budget_book_titles" | "financial_headings" | "fiscal_year_forms"} PatternKey
 */
/**
 * One compiled pattern of a vocabulary key, with the entry it came from.
 * @typedef {Object} CompiledPattern
 * @property {RegExp} re
 * @property {VocabularyEntry} entry
 */
/**
 * What a line matched: the text matched, trimmed, and the entry whose pattern matched it.
 * @typedef {Object} Matched
 * @property {string} text
 * @property {VocabularyEntry} entry
 */
/**
 * One budget header word: the column it names and its compiled pattern.
 * @typedef {Object} HeaderWord
 * @property {BudgetColumn} column
 * @property {RegExp} re
 */
/**
 * One code form of a classification: its scheme, its anchored pattern and how it is named in a reading.
 * @typedef {Object} CodeForm
 * @property {string | null} scheme
 * @property {RegExp} re
 * @property {string} label
 */

/** @type {Readonly<{ REPORT_TITLES: "financial_report_titles", BOOK_TITLES: "budget_book_titles", HEADINGS: "financial_headings", FISCAL_YEARS: "fiscal_year_forms", HEADERS: "budget_headers" }>} */
export const KEYS = Object.freeze({
  REPORT_TITLES: "financial_report_titles",
  BOOK_TITLES: "budget_book_titles",
  HEADINGS: "financial_headings",
  FISCAL_YEARS: "fiscal_year_forms",
  HEADERS: "budget_headers",
});

/** The columns a budget line-item table's header words may name (R7).
 *  @type {ReadonlyArray<BudgetColumn>} */
export const COLUMNS = Object.freeze(["fund", "org", "department", "department_code", "program", "project",
                                      "account", "amount", "period", "phase"]);

/** Compiled patterns of one vocabulary key, case-insensitive as a heading is
 *  printed in any case, and white-space tolerant: a text layer that letter-spaces
 *  a heading ("Gove rnme nt", money-people §1c) still matches.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {PatternKey} key
 *  @returns {CompiledPattern[]} */
export function patterns(ctx, key) {
  /** @type {CompiledPattern[]} */
  const out = [];
  for (const e of vocabulary(ctx, key)) {
    const re = vocabRegex("pattern" in e ? e.pattern : null, null, "i");
    if (re) out.push({ re, entry: e });
  }
  return out;
}

/** The first pattern of `key` matching `line`, as `{text, entry}`, or null. A
 *  line is tried as printed and with its spaces removed, so a letter-spaced
 *  heading matches a pattern written with or without spaces.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {PatternKey} key
 *  @param {string} line
 *  @returns {Matched | null} */
export function matchIn(ctx, key, line) {
  const s = String(line);
  for (const p of patterns(ctx, key)) {
    const m = p.re.exec(s);
    if (m) return { text: m[0].trim(), entry: p.entry };
  }
  const squeezed = s.replace(/\s+/g, "");
  for (const p of patterns(ctx, key)) {
    /** @type {RegExp} */
    let re;
    try { re = new RegExp(p.re.source.replace(/\\s[+*]?|\s+/g, ""), p.re.flags); } catch { continue; }
    if (re.test(squeezed)) return { text: s.trim(), entry: p.entry };
  }
  /* A ligature the text layer could not decode ("Classi\u0000cation": the "fi"
     of a font with no mapping for it) is tried as each Latin ligature it may
     stand for; the line is still given as read. */
  if (UNDECODED.test(s))
    for (const lig of LIGATURES) {
      const m = matchIn(ctx, key, s.replace(UNDECODED_ALL, lig));
      if (m) return { text: s.trim(), entry: m.entry };
    }
  return null;
}

const UNDECODED = /[\u0000\uFFFD]/;
const UNDECODED_ALL = /[\u0000\uFFFD]/g;
const LIGATURES = ["fi", "fl", "ff", "ffi", "ffl"];

/** The view's budget header words, `[{column, re}]`, in the profile's order.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @returns {HeaderWord[]} */
export function headerWords(ctx) {
  /** @type {HeaderWord[]} */
  const out = [];
  for (const e of vocabulary(ctx, KEYS.HEADERS)) {
    const named = "column" in e ? e.column : undefined;
    const column = COLUMNS.find((c) => c === named);
    if (column === undefined) continue;
    const re = vocabRegex("pattern" in e ? e.pattern : null, null, "i");
    if (re) out.push({ column, re });
  }
  return out;
}

/* `jurisdictions` R52 names a classification's kind `organisation`; R7 calls
   the column `org`. A department is an organisational unit too: R52 has no
   kind of its own for it, and a profile holds a department's code forms under
   `organisation` (K1513). */
/** @type {ReadonlyMap<string, ClassificationKind>} */
const KIND_OF = new Map(/** @type {Array<[string, ClassificationKind]>} */ ([["fund", "fund"], ["org", "organisation"],
  ["program", "program"], ["project", "project"], ["account", "account"], ["department_code", "organisation"]]));

/** @param {string} s @returns {string} */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The code forms of the view's classification scheme for one column, each
 *  `{scheme, re, label}`: its `forms`, and each code it lists (`codes`), which
 *  is a form of exactly that code.
 *  @param {DoctypeContext | null | undefined} ctx
 *  @param {string} column
 *  @returns {CodeForm[]} */
export function codeForms(ctx, column) {
  const kind = KIND_OF.get(column);
  const view = readerView(ctx);
  const full = "classification_schemes" in view ? view : null;
  const schemes = full ? full.classification_schemes : undefined;
  /** @type {CodeForm[]} */
  const out = [];
  if (!kind || !Array.isArray(schemes)) return out;
  for (const s of schemes) {
    if (!s || s.kind !== kind) continue;
    const forms = s.forms, codes = s.codes;
    for (const f of Array.isArray(forms) ? forms : []) {
      const re = vocabRegex(f, (src) => `^(?:${src})$`, "");
      if (re) out.push({ scheme: s.scheme || null, re, label: f.re });
    }
    for (const c of Array.isArray(codes) ? codes : []) {
      if (!c || typeof c.code !== "string" || !c.code) continue;
      out.push({ scheme: s.scheme || null, re: new RegExp(`^${escape(c.code)}$`), label: `code ${c.code}` });
    }
  }
  return out;
}
