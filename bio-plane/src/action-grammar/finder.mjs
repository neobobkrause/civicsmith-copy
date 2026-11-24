/* action-grammar — the phrasing finder and the grammar of a member's resolutions (requirements:
 * `build/requirements/action-grammar.md`, R16–R19; T45, N861, N884, N892 (b); Actions D1, D11, D28b; v0.2 rules 2, 9, 21).
 *
 * `phrasingsFor` answers the phrasings that apply to a language and kind: Civicsmith's (`./phrasings.mjs`) and those the
 * active profiles add (`jurisdictions` R86, the combined view the caller hands in); a profile only extends. `pointOut`
 * points out the sentences of a text (split by the caller, `filings`) that match one. It decides nothing: a sentence
 * pointed out is one a member resolves, and one not pointed out is not thereby cleared (rule 2, "No tool has the final
 * word"). `assertionResolutionFindings` and `assertionsUnresolved` are the grammar of the member's resolutions of the
 * `assertion` sentences; who resolves, where it is recorded and the refusal at approval are `filings`' (its R43).
 *
 * Uses: `jurisdictions` `isLocale` (its R37) and `PHRASING_KINDS` (its R86, re-exported as the one binding). Pure (R10): no
 * record, no clock, no network; every function never throws. */

import { isLocale, PHRASING_KINDS } from "../../../jurisdictions/index.mjs";
import { PHRASINGS } from "./phrasings.mjs";

export { PHRASINGS, PHRASING_KINDS };

/** R2, R19: the two ways a member resolves a pointed-out assertion besides rewriting it. */
export const ASSERTION_RESOLUTIONS = Object.freeze(["only_asks", "breach_claim"]);
/** R16, R17: a phrasing's length, in characters. */
export const PHRASING_MIN = 2;
export const PHRASING_MAX = 100;
/** R18: the most sentences one text is read in, and the longest sentence. */
export const SENTENCES_MAX = 5000;
export const SENTENCE_MAX = 10000;
/** R19: the longest of a member's own words that the act only asks. */
export const RESOLUTION_WORDS_MAX = 500;

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const primary = (tag) => tag.split("-")[0].toLowerCase();
const LINE_BREAK = /[\r\n\u2028\u2029]/;

/* ---------------------------------------------------------------------------------------------- R18: the reading */

/* Typographic apostrophes and quotes, read as their plain forms. */
const PLAIN = new Map([["\u2018", "'"], ["\u2019", "'"], ["\u201B", "'"], ["\u02BC", "'"], ["\u2032", "'"], ["\uFF07", "'"],
  ["\u201C", '"'], ["\u201D", '"'], ["\u201E", '"'], ["\u201F", '"'], ["\u2033", '"'], ["\uFF02", '"']]);
/* A base character with the marks that follow it (or marks with no base): the unit NFC composes within. */
const CLUSTER = /\P{M}\p{M}*|\p{M}+/gsu;
const SPACE = /^\s+$/u;
const WORDLIKE = /[\p{L}\p{M}\p{N}]/u;

/* The text as R18 reads it, with, for each character read, the span of the text as given it came from: `chars` the read
 * characters and `from`/`to` their offsets in the original (`to` exclusive). */
function reading(text) {
  const chars = [], from = [], to = [];
  let m;
  CLUSTER.lastIndex = 0;
  while ((m = CLUSTER.exec(text))) {
    const start = m.index, end = start + m[0].length;
    if (SPACE.test(m[0])) {
      if (chars.length && chars[chars.length - 1] === " " && to[to.length - 1] === start) { to[to.length - 1] = end; continue; }
      chars.push(" "); from.push(start); to.push(end); continue;
    }
    const read = [...m[0].normalize("NFC").toLowerCase()].map((c) => PLAIN.get(c) ?? c).join("").normalize("NFC");
    for (let k = 0; k < read.length; k++) { chars.push(read[k]); from.push(start); to.push(end); }
  }
  return { text: chars.join(""), chars, from, to };
}
/* The character (a whole code point) just before and just after a UTF-16 position of the read text. */
const before = (t, at) => (at >= 2 && /[\uDC00-\uDFFF]/.test(t[at - 1]) && /[\uD800-\uDBFF]/.test(t[at - 2]) ? t.slice(at - 2, at) : t[at - 1]);
const after = (t, at) => String.fromCodePoint(t.codePointAt(at));
/** R18: a phrasing (or any text) as R18 reads it: NFC, case-folded, typographic apostrophes and quotes plain, each run
 *  of white space one space. Exported so a caller compares phrasings as the finder does. */
export function readAs(text) { return typeof text === "string" ? reading(text).text : ""; }

/* ---------------------------------------------------------------------------------------------- R16, R17: the phrasings */

/* Why a profile phrasing item is not used, or null. */
function itemFault(item) {
  if (!isObj(item)) return "not_an_entry";
  if (!isLocale(item.locale)) return "locale_malformed";
  if (!PHRASING_KINDS.includes(item.kind)) return "kind_unknown";
  if (!phraseWellFormed(item.phrase)) return "phrase_malformed";
  return null;
}
function phraseWellFormed(p) {
  return typeof p === "string" && p.length >= PHRASING_MIN && p.length <= PHRASING_MAX && !LINE_BREAK.test(p)
    && readAs(p).trim().length > 0;
}
/* Whether a list held for `tag` applies to `language`: the whole tag, case-insensitive, else the primary subtag. */
const applies = (tag, language) => tag.toLowerCase() === language.toLowerCase() || primary(tag) === primary(language);

/** R17: the phrasings that apply to `language` and `kind`: Civicsmith's own (`origin: "product"`), then each well-formed
 *  `view.phrasings` item whose locale applies and whose kind is `kind` (`origin: "profile"`), each phrasing once (a profile
 *  phrasing equal to a product one, as R18 reads them, is answered once as `product`). A malformed item is named in
 *  `ignored` with why. Undetermined, never an empty `read`, when the language is malformed, the kind unknown, or no
 *  phrasing is held for them. Pure; never throws. */
export function phrasingsFor(args) {
  const { language, kind, view } = isObj(args) ? args : {};
  if (!isLocale(language)) return { state: "undetermined", why: "language_malformed" };
  if (!PHRASING_KINDS.includes(kind)) return { state: "undetermined", why: "kind_unknown" };
  const phrases = [];
  const seen = new Set();
  const add = (phrase, origin) => {
    const key = readAs(phrase);
    if (seen.has(key)) return;
    seen.add(key);
    phrases.push({ phrase, origin });
  };
  const held = own(PHRASINGS, language.toLowerCase()) ? PHRASINGS[language.toLowerCase()]
    : own(PHRASINGS, primary(language)) ? PHRASINGS[primary(language)] : null;
  if (held && Array.isArray(held[kind])) for (const p of held[kind]) add(p, "product");
  const ignored = [];
  const items = isObj(view) && own(view, "phrasings") ? view.phrasings : undefined;
  if (items !== undefined && items !== null && !Array.isArray(items)) ignored.push({ index: null, why: "not_a_list" });
  if (Array.isArray(items)) items.forEach((item, index) => {
    const fault = itemFault(item);
    if (fault) { ignored.push({ index, why: fault }); return; }
    if (item.kind === kind && applies(item.locale, language)) add(item.phrase, "profile");
  });
  if (!phrases.length) return { state: "undetermined", why: "no_list", ...(ignored.length ? { ignored } : {}) };
  return { state: "read", language, phrases, ignored };
}

/* ---------------------------------------------------------------------------------------------- R18: pointing out */

const sentencesWellFormed = (s) => Array.isArray(s) && s.length <= SENTENCES_MAX
  && s.every((x) => typeof x === "string" && x.length <= SENTENCE_MAX);

/** R18: the sentences that match a phrasing R17 answers for `language` and `kind`: every match, in sentence order then
 *  position, `start` and `end` its offsets in the sentence as given. A phrasing matches where no letter, mark or digit is
 *  immediately before or after it. A question is not exempt. Undetermined for sentences not a list of strings within
 *  R18's bounds, and wherever R17 is. It decides nothing. Pure; never throws. */
export function pointOut(args) {
  const { sentences, language, kind, view } = isObj(args) ? args : {};
  if (!sentencesWellFormed(sentences)) return { state: "undetermined", why: "not_sentences" };
  const list = phrasingsFor({ language, kind, view });
  if (list.state !== "read") return list;
  const needles = list.phrases.map((p) => ({ ...p, read: readAs(p.phrase) }));
  const pointed = [];
  sentences.forEach((sentence, index) => {
    const r = reading(sentence);
    const found = [];
    needles.forEach((n, order) => {
      for (let at = r.text.indexOf(n.read); at !== -1; at = r.text.indexOf(n.read, at + 1)) {
        const last = at + n.read.length - 1;
        if (at > 0 && WORDLIKE.test(before(r.text, at))) continue;
        if (last + 1 < r.text.length && WORDLIKE.test(after(r.text, last + 1))) continue;
        found.push({ index, phrase: n.phrase, origin: n.origin, start: r.from[at], end: r.to[last], order });
      }
    });
    found.sort((a, b) => a.start - b.start || a.end - b.end || a.order - b.order);
    for (const { order, ...hit } of found) pointed.push(hit);
  });
  return { state: "read", language, kind, pointed };
}

/* ---------------------------------------------------------------------------------------------- R19: resolutions */

const RESOLUTION_KEYS = ["sentence", "resolution", "words"];
const RESOLUTION_REPAIRS = ["resolve each pointed-out sentence once: rewrite it, or name it exactly with only_asks and "
  + "your own words that the act only asks, or with breach_claim"];

/* The judgement of `{sentences, pointed, resolutions}`: null when `pointed` is not R18's read of `assertion` over the
 * sentences (undetermined), else each resolution's fault (or null) and the pointed-out sentences' indexes. */
function judge(args) {
  const { sentences, pointed, resolutions } = isObj(args) ? args : {};
  if (!sentencesWellFormed(sentences) || !isObj(pointed) || pointed.state !== "read" || pointed.kind !== "assertion"
      || !Array.isArray(pointed.pointed)) return null;
  const indexes = [...new Set(pointed.pointed.filter((p) => isObj(p) && Number.isInteger(p.index)
    && p.index >= 0 && p.index < sentences.length).map((p) => p.index))].sort((a, b) => a - b);
  const texts = new Set(indexes.map((i) => sentences[i]));
  const list = resolutions === undefined || resolutions === null ? [] : resolutions;
  if (!Array.isArray(list)) return { indexes, listFault: true, items: [] };
  const named = new Set();
  const items = list.map((item, i) => {
    let fault = null;
    if (!isObj(item)) fault = "is not a {sentence, resolution, words?} entry";
    else if (Object.keys(item).some((k) => !RESOLUTION_KEYS.includes(k)))
      fault = `carries ${Object.keys(item).filter((k) => !RESOLUTION_KEYS.includes(k)).map((k) => k.slice(0, 40)).join(", ")}: `
        + "a resolution names its sentence, the resolution and, for only_asks, your words";
    else if (!ASSERTION_RESOLUTIONS.includes(item.resolution))
      fault = `resolution '${String(item.resolution).slice(0, 40)}' is not one of: ${ASSERTION_RESOLUTIONS.join(", ")}`;
    else if (typeof item.sentence !== "string" || !texts.has(item.sentence))
      fault = "names no sentence pointed out as it now stands: a resolution names the exact text of a pointed-out sentence";
    else if (named.has(item.sentence)) fault = "resolves a sentence an earlier resolution resolves: each is resolved once";
    else if (item.resolution === "only_asks") {
      const w = item.words;
      if (typeof w !== "string" || !w.trim() || w.length > RESOLUTION_WORDS_MAX || LINE_BREAK.test(w))
        fault = `only_asks carries no words of 1 to ${RESOLUTION_WORDS_MAX} characters on one line: you confirm in your own `
          + "words that the act only asks";
    } else if (item.words !== undefined && item.words !== null) fault = "breach_claim carries words: a breach claim is the act's own, stated by marking it";
    if (!fault) named.add(item.sentence);
    return fault;
  });
  return { indexes, listFault: false, items, resolved: new Map(list.map((item, i) => [i, item]).filter(([i]) => !items[i])) };
}

/** R19: the findings on a member's resolutions, one `ASSERTION_RESOLUTION_REFUSED` per faulty item (`filings`' row): a
 *  resolution naming no pointed-out sentence, a second of one sentence, or a malformed one. With `pointed` undetermined
 *  nothing is judged against it. Pure; never throws; pushes and answers nothing. */
export function assertionResolutionFindings(args, findings) {
  const j = judge(args);
  if (!j) return;
  const push = (message) => findings.push({ check: "C-2.10", severity: "error", message, repairable: true,
    repairs: RESOLUTION_REPAIRS, code: "ASSERTION_RESOLUTION_REFUSED" });
  /* DEC-49 REGION is-assertion-resolution */
  if (j.listFault) { push("resolutions is not a list of {sentence, resolution, words?} entries (R19)"); return; }
  j.items.forEach((fault, i) => { if (fault) push(`resolutions[${i}] ${fault} (R19)`); });
  /* END DEC-49 REGION is-assertion-resolution */
}

/** R19: the pointed-out sentences no well-formed resolution resolves (`unresolved`, their indexes) and whether any
 *  resolution treats the act as a breach claim. A resolution binds the exact text, so an edited sentence is unresolved
 *  again; a rewritten one no longer pointed out needs none. Undetermined, never `unresolved: []`, when `pointed` is.
 *  Pure; never throws. */
export function assertionsUnresolved(args) {
  const j = judge(args);
  if (!j) return { state: "undetermined", why: "not_pointed" };
  const { sentences } = args;
  const resolved = j.listFault ? [] : [...j.resolved.values()];
  const texts = new Set(resolved.map((r) => r.sentence));
  return { state: "read", unresolved: j.indexes.filter((i) => !texts.has(sentences[i])),
           breach_claim: resolved.some((r) => r.resolution === "breach_claim") };
}
