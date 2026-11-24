/* case-checker — the account's sentences, judged against what they cite (requirements: `build/requirements/case-checker.md`
 * R24; D56; K2451, K2471).
 *
 * `checkAccount({account, cited, printed, conclusions})` judges each sentence of a case document's `account:` block
 * (`case-grammar` R23) through `answers.checkSentences` (its R33) and `case-disclosures` R30's arms, in its order:
 *
 *   ACCOUNT_SENTENCE_UNSUPPORTED     a sentence not bias-marked that cites nothing (an account row), or cites anything
 *                                    that was not read;
 *   ACCOUNT_FACT_NOT_IN_CITED        a figure, date, name or quotation not in what it cites;
 *   ACCOUNT_CONTRADICTED_BY_RECORD   a finding's conclusion or a determination other than the record holds, or a leg that
 *                                    cuts against it read as supporting it (against `conclusions`);
 *   ACCOUNT_BIAS_NOT_PRINTED         a bias-marked sentence whose statement is not in `printed`;
 *   ACCOUNT_CLAIM_NOT_BIAS           a bias-marked sentence stating a fact ("Lying is not bias").
 *
 * (T46; N916) A sentence not bias-marked that states nothing these arms can check (no figure, date, name or quotation)
 * and whose cites were all read reads as supported: "supported" means only that it states nothing the cited record lacks,
 * never that the cited record shows what it says. `filings` (its R34) and `case-account` read it so.
 *
 * (K2965; `case-disclosures` R30, K2533) Arm 1's "cites nothing" judges only rows of kind `account` (a row with no
 * `kind` is read as one): a statement's or an outcome's sentence that cites nothing is judged by the other arms alone,
 * arm 2 having nothing it cites to judge it against, so arms 3 to 5.
 *
 * `case-disclosures` R30 runs it at the act, with the record; `checkCaseFile` (R1) runs it offline over the carried
 * document, so one body of check code judges both. The machine flags (`run-rules` R25) are not judged here. Its codes'
 * catalogue rows are `case-disclosures`' (its R22). Pure: it reads only its arguments, the same arguments give the same
 * answer, and it never throws. No place is named here (R17). */

import { canonicalJson } from "../record-grammar/json.mjs";
import { checkSentences, VERDICT_WORDS, CAUSE_MARKERS } from "../answers/sentences.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** R24: the arms' codes, in `case-disclosures` R30's order. */
export const ACCOUNT_CODES = Object.freeze(["ACCOUNT_SENTENCE_UNSUPPORTED", "ACCOUNT_FACT_NOT_IN_CITED",
  "ACCOUNT_CONTRADICTED_BY_RECORD", "ACCOUNT_BIAS_NOT_PRINTED", "ACCOUNT_CLAIM_NOT_BIAS"]);

/* The words that state a finding's outcome, a determination (arm 3 (a), arm 5). */
export const DETERMINATION_WORDS = Object.freeze(["established", "establishes", "establish", "found that", "finds that",
  "concluded", "concludes", "determined", "determines", "proved", "proves", "proven", "shows that", "showed that",
  "shown that", "confirmed", "confirms", "demonstrated", "demonstrates"]);
/* A leg read as supporting what it rests on (arm 3 (c)), and the words that read it as cutting against it. */
export const SUPPORT_WORDS = Object.freeze(["supports", "supported", "shows", "showed", "confirms", "confirmed", "proves",
  "proved", "establishes", "established", "demonstrates", "demonstrated", "bears out", "backs"]);
export const CONTRARY_WORDS = Object.freeze(["against", "contradicts", "contradicted", "undermines", "undermined",
  "disputes", "disputed", "cuts", "however", "despite", "but", "although", "though", "weakens", "conflicts"]);

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const wordsRe = (list, flags = "i") => new RegExp(`(?<![A-Za-z])(?:${[...list].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![A-Za-z])`, flags);
const squash = (s) => String(s).replace(/\s+/g, " ").trim();
const lower = (s) => squash(s).toLowerCase();

const DETERMINATION_RE = wordsRe(DETERMINATION_WORDS);
const SUPPORT_RE = wordsRe(SUPPORT_WORDS);
const CONTRARY_RE = wordsRe(CONTRARY_WORDS);
/* answers R32's voice (its verdict, likelihood and rating words, a likelihood's percentage and its cause words) is the
   assistant's own and no arm of R30's: taken out of the text `checkSentences` reads, so it hides no arm's code */
const VOICE_RE = wordsRe([...Object.values(VERDICT_WORDS).flat(), ...CAUSE_MARKERS, "sure", "certain", "confident"], "gi");
const QUOTED = /"([^"]*)"|“([^”]*)”|«([^»]*)»/g;

/* ============================================================ the facts a sentence states */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = `(?:${MONTHS.map((m) => `${m[0].toUpperCase()}${m.slice(1)}`).join("|")}|(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?)`;
const DATE_RE = new RegExp([
  "\\b\\d{4}-\\d{2}-\\d{2}\\b",
  `\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
  `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\s+\\d{4}\\b`,
  `\\b${MONTH}\\s+\\d{4}\\b`,
  "\\b(?:18|19|20|21)\\d{2}\\b"].join("|"), "g");
const monthOf = (w) => { const i = MONTHS.findIndex((m) => m.startsWith(w.toLowerCase().replace(/\.$/, "").slice(0, 3))); return i < 0 ? null : String(i + 1).padStart(2, "0"); };

/** A date as one spelling: `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. */
function dateKey(s) {
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^([A-Za-z.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s))) return `${m[3]}-${monthOf(m[1])}-${m[2].padStart(2, "0")}`;
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z.]+)\s+(\d{4})$/.exec(s))) return `${m[3]}-${monthOf(m[2])}-${m[1].padStart(2, "0")}`;
  if ((m = /^([A-Za-z.]+)\s+(\d{4})$/.exec(s))) return `${m[2]}-${monthOf(m[1])}`;
  return s;
}
/** Every date a text states, each with the spellings it is found by: itself, and the month and year it falls in. */
const datesIn = (t) => [...String(t).matchAll(DATE_RE)].map((m) => ({ said: m[0], key: dateKey(squash(m[0])) }));
const dateKeysOf = (t) => {
  const out = new Set();
  for (const d of datesIn(t)) { out.add(d.key); out.add(d.key.slice(0, 7)); out.add(d.key.slice(0, 4)); }
  return out;
};

/* A figure: an amount, count, ratio or percentage (a date is not one; answers' `figuresIn` reads them the same way). */
const FIGURE_RE = /(?:[$€£]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent\b|thousand\b|million\b|billion\b))?/g;
const numberCore = (s) => (/\d[\d,]*(?:\.\d+)?/.exec(s) || [""])[0].replace(/,/g, "");
const NOT_NAMES = new Set(["I", ...MONTHS.map((m) => `${m[0].toUpperCase()}${m.slice(1)}`),
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);

const SENTENCE_OPENERS = new Set(["The", "A", "An", "This", "That", "These", "Those", "It", "Its", "We", "Our", "They", "Their",
  "He", "She", "His", "Her", "In", "On", "At", "By", "For", "Of", "And", "But", "As", "When", "After", "Before", "Then"]);

/** The text outside a sentence's quotations. */
const unquoted = (t) => String(t).replace(QUOTED, " ");
/** The quotations a sentence makes. */
const quotationsIn = (t) => [...String(t).matchAll(QUOTED)].map((m) => m[1] ?? m[2] ?? m[3]).filter((q) => q.trim());

/** The names a text states outside its quotations: runs of capitalised words, a sentence's first word not counted when
 *  it stands alone or is a word any sentence may begin with; months, weekdays and record ids (words holding a digit)
 *  are not names. */
function namesIn(t) {
  const text = unquoted(t);
  const out = [];
  for (const m of text.matchAll(/[A-Z][A-Za-z'’-]*(?:\s+(?:of|the|and|for|de|van|von|du|la)\s+[A-Z][A-Za-z'’-]*|\s+[A-Z][A-Za-z'’-]*)*/g)) {
    const before = text.slice(0, m.index);
    if (before && /[A-Za-z0-9]$/.test(before)) continue;
    let words = m[0].split(/\s+/);
    const starts = !before.trim() || /[.!?:;]\s*$/.test(before) || /["“«(]\s*$/.test(before);
    /* a sentence's first word is capitalised whatever it is: a word every sentence may begin with is dropped, and a
       first word standing alone is not read as a name */
    if (starts && (SENTENCE_OPENERS.has(words[0]) || words.length === 1)) { words = words.slice(1); while (words.length && /^[a-z]/.test(words[0])) words = words.slice(1); }
    words = words.filter((w) => !/\d/.test(w));
    while (words.length && NOT_NAMES.has(words[0])) words = words.slice(1);
    while (words.length && NOT_NAMES.has(words.at(-1))) words = words.slice(0, -1);
    if (words.length) out.push(words.join(" "));
  }
  return [...new Set(out)];
}

/** The figures a text states outside its quotations, each a span of the text (a date is not a figure). */
function figureSpans(t) {
  const text = unquoted(t);
  const dateSpans = [...text.matchAll(DATE_RE)].map((m) => [m.index, m.index + m[0].length]);
  const out = [];
  for (const m of text.matchAll(FIGURE_RE)) {
    const s = m.index, e = s + m[0].length;
    if (dateSpans.some(([a, b]) => s < b && e > a)) continue;
    if (/[A-Za-z-]$/.test(text.slice(Math.max(0, s - 1), s))) continue;    /* part of a word or an id */
    if (/^[A-Za-z]/.test(text.slice(e, e + 1))) continue;
    out.push(m[0].trim());
  }
  return out;
}
const figureIn = (fig, texts) => {
  const core = numberCore(fig);
  if (!core) return true;
  const re = new RegExp(`(?<![\\d.,])${core.replace(/\B(?=(\d{3})+(?!\d))/g, ",?").replace(/\./g, "\\.")}(?![\\d]|[.,]\\d)`);
  return texts.some((x) => re.test(x));
};

/** Every fact a text states: its figures, dates, names and quotations. */
export function factsIn(t) {
  return { figures: figureSpans(t), dates: datesIn(unquoted(t)).map((d) => d.said), names: namesIn(t), quotations: quotationsIn(t) };
}

/* ============================================================ the arguments */

/** A list field written as a list, as canonical JSON in one value (`case-grammar`'s flat rows), or comma-separated. */
export function listOfField(v) {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined);
  if (typeof v !== "string" || !v.trim()) return [];
  if (/^\s*\[/.test(v)) { try { const j = JSON.parse(v); if (Array.isArray(j)) return j.filter((x) => x !== null && x !== undefined); } catch { /* read as words */ } }
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

/** What a sentence cites, as `case-grammar` R23 spells it (K2528): `{kind, ref, ord}`, `kind` one of `finding`, `leg`,
 *  `passage`, `material`; a leg its finding's id with its `ord`, a passage its `content_id`, a material its
 *  `materials:` ref; `ord` null but for a leg. Answers the one key this module holds it by (a leg's `<finding>#<ord>`),
 *  and the words a refusal names it in; a bare string is read as a key. */
export const CITE_KINDS = Object.freeze(["finding", "leg", "passage", "material"]);
const legWords = (finding, ord) => localize("case-checker.account.leg_of", "leg {ord} of {finding}", { ord, finding });
export function citeOf(c) {
  if (typeof c === "string" && c.trim()) {
    const m = /^(.+)#(\d+)$/.exec(c.trim());
    return { key: c.trim(), words: m ? legWords(m[1], m[2]) : c.trim() };
  }
  if (!plain(c) || !filled(c.ref) || (c.kind !== undefined && !CITE_KINDS.includes(c.kind))) return null;
  if (c.kind === "leg") {
    const ord = Number.isInteger(c.ord) ? c.ord : typeof c.ord === "string" && /^\d+$/.test(c.ord) ? Number(c.ord) : null;
    return ord === null ? null : { key: `${c.ref}#${ord}`, words: legWords(c.ref, ord) };
  }
  return { key: c.ref, words: c.ref };
}

/* The text of what was cited: a string as given, an object's string leaves joined by a space. */
function textOfCited(v) {
  if (typeof v === "string") return v;
  const out = [];
  const walk = (x) => { if (typeof x === "string") out.push(x); else if (typeof x === "number") out.push(String(x));
    else if (Array.isArray(x)) x.forEach(walk); else if (plain(x)) Object.values(x).forEach(walk); };
  walk(v);
  return out.join(" ");
}

function citedMap(cited) {
  const out = new Map();
  if (Array.isArray(cited)) {
    for (const [i, c] of cited.entries()) {
      const k = plain(c) ? citeOf(c.kind === undefined ? c.ref : c) : null;
      if (!k) return { bad: `cited[${i}]` };
      out.set(k.key, { text: textOfCited(c.text ?? ""), role: typeof c.role === "string" ? c.role : null });
    }
  } else if (plain(cited)) {
    for (const [ref, v] of Object.entries(cited)) out.set(ref, { text: textOfCited(plain(v) && "text" in v ? v.text : v), role: plain(v) && typeof v.role === "string" ? v.role : null });
  } else if (cited !== undefined && cited !== null) return { bad: "cited" };
  return { map: out };
}

const MALFORMED = (field) => ({ ok: false, reason: "MALFORMED", field });

/* ============================================================ the check */

/** R24: judge each sentence of an `account:` block. `account` its rows `{ord, text, cites, kind, bias_statement?,
 *  began_as}` (`case-grammar` R23), each cite `{kind, ref, ord}` (`citeOf`); `cited` what the sentences may cite, each
 *  `{kind, ref, ord?, text, role?}` (a leg's `role` as the record holds it), or a map from a cite's key to its text;
 *  `printed` the bias statements printed in this case's lens (their ids, or `{bundle, id}`); `conclusions` the record's,
 *  `[{finding, claim, claim_state, legs: [{ord, target, role}]}]`. Answers `{ok: true, departures}` (K2531): one
 *  `{ord, code, detail}` per sentence and arm that fails, `ord` the `account:` row's, in the account's order and the
 *  arms' order, never only the first; `[]` when every sentence holds. Malformed arguments answer `{ok: false, reason:
 *  "MALFORMED", field}`. Pure; never throws. */
export function checkAccount(args) {
  try { return judgeAccount(plain(args) ? args : {}); }
  catch { return MALFORMED("account"); }
}

function judgeAccount({ account = [], cited = [], printed = [], conclusions = [] }) {
  if (!Array.isArray(account)) return MALFORMED("account");
  const rows = [];
  for (const [i, r] of account.entries()) {
    if (!plain(r) || !filled(r.text)) return MALFORMED(`account[${i}]`);
    const cites = listOfField(r.cites).map(citeOf);
    if (cites.some((x) => !x)) return MALFORMED(`account[${i}].cites`);
    rows.push({ ord: Number.isInteger(r.ord) ? r.ord : i, text: String(r.text), cites: cites.map((x) => x.key),
                /* (K2965) arm 1 judges only an account row: a row with no `kind` is read as one */
                account: r.kind === undefined || r.kind === null || r.kind === "account",
                words: Object.fromEntries(cites.map((x) => [x.key, x.words])), bias: filled(r.bias_statement) ? r.bias_statement.trim() : null });
  }
  const c = citedMap(cited);
  if (c.bad) return MALFORMED(c.bad);
  if (!Array.isArray(printed)) return MALFORMED("printed");
  const printedIds = new Set(printed.flatMap((p) => (typeof p === "string" ? [p] : plain(p) && filled(p.id)
    ? [p.id, `${p.bundle ?? ""}#${p.id}`] : [])));
  if (!Array.isArray(conclusions)) return MALFORMED("conclusions");
  const concl = new Map();
  for (const [i, x] of conclusions.entries()) {
    if (!plain(x) || !filled(x.finding)) return MALFORMED(`conclusions[${i}]`);
    concl.set(x.finding, { claim: filled(x.claim) ? x.claim : null, adopted: x.claim_state === "adopted",
                           legs: Array.isArray(x.legs) ? x.legs.filter(plain) : [] });
  }
  const refusals = [];
  for (const row of rows) refusals.push(...judgeSentence(row, c.map, printedIds, concl));
  const seen = new Set();
  const departures = refusals.filter((r) => { const k = canonicalJson(r); if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: true, departures };
}

/* The leg a cite names: `<finding>#<ord>`, as `conclusions` or `cited` hold it. */
function legOf(cite, cited, concl) {
  const m = /^(.+)#(\d+)$/.exec(cite);
  if (!m) return null;
  const leg = (concl.get(m[1])?.legs || []).find((l) => Number(l.ord) === Number(m[2]));
  const role = leg && typeof leg.role === "string" ? leg.role : cited.get(cite)?.role ?? null;
  return { finding: m[1], ord: Number(m[2]), role };
}

/* A fact a sentence states, named by its kind (`figure`, `date`, `name`, `quotation`) and as the sentence says it. */
const factWords = (kind, said) => (kind === "figure" ? localize("case-checker.account.the_figure", "the figure {said}", { said })
  : kind === "date" ? localize("case-checker.account.the_date", "the date {said}", { said })
  : kind === "name" ? localize("case-checker.account.the_name", "the name {said}", { said })
  : localize("case-checker.account.the_quotation", "the quotation \"{said}\"", { said }));

/* Without its negations: `not`, `no`, `never` and `n't`. */
const unnegated = (s) => lower(s).replace(/n['’]t\b/g, "").replace(/\b(?:not|never|no)\b/g, " ").replace(/\s+/g, " ").trim();

function judgeSentence(row, cited, printed, concl) {
  const out = [];
  const say = (code, detail) => out.push({ ord: row.ord, code, detail });
  const w = (k) => row.words[k] ?? k;
  const read = row.cites.filter((x) => cited.has(x));
  const texts = read.map((x) => cited.get(x).text);
  const facts = factsIn(row.text);

  if (!row.bias) {
    /* arm 1 and the figures of arm 2, through answers' checkSentences (its R33): a holding per cite, the read log what
       was cited; a figure taken word for word from what it cites is marked as quoting it; its voice taken out */
    let text = row.text.replace(VOICE_RE, " ");
    for (const f of [...new Set(facts.figures)].sort((a, b) => b.length - a.length)) if (figureIn(f, texts)) text = text.split(f).join(`“${f}”`);
    if (!text.trim()) text = "-";
    const holdings = row.cites.map((x) => ({ address: x, quote: cited.has(x) && cited.get(x).text ? cited.get(x).text : x }));
    const log = read.map((x) => ({ address: x, text: cited.get(x).text }));
    const j = row.cites.length
      ? checkSentences([{ text, kind: "explain", support: holdings.map((_, i) => `h${i + 1}`) }], { cited: { holdings }, readLog: log })
      : null;
    const code = j && j.ok ? (j.withheld[0]?.code ?? null) : null;
    const unread = row.cites.filter((x) => !cited.has(x));
    if (!row.cites.length) {
      /* (K2965) a statement's or outcome's sentence citing nothing: arm 1 is not asked, and arm 2, judged against what
         a sentence cites, has nothing to judge it against (J4); arms 3 to 5 below still judge it */
      if (row.account) say("ACCOUNT_SENTENCE_UNSUPPORTED", word("case-checker.say.sentence_cites_marked", { ord: row.ord }));
    } else if (code === "ANSWER_CITES_UNREAD" || (j && !j.ok))
      say("ACCOUNT_SENTENCE_UNSUPPORTED", word("case-checker.say.sentence_cites_among", { ord: row.ord, w: (unread.length ? unread : row.cites).map(w).join(", ") }));
    else {
      /* arm 2: a figure, date, name or quotation not in what it cites */
      const missing = [];
      if (code === "ANSWER_FIGURE_UNSOURCED") {
        for (const f of facts.figures) if (!figureIn(f, texts)) missing.push({ kind: "figure", said: f });
        if (!missing.length) missing.push({ kind: "figure", said: localize("case-checker.account.it_states", "it states") });
      }
      const keys = new Set(texts.flatMap((x) => [...dateKeysOf(x)]));
      for (const d of datesIn(unquoted(row.text))) if (!keys.has(d.key) && !texts.some((x) => lower(x).includes(lower(d.said)))) missing.push({ kind: "date", said: d.said });
      for (const n of facts.names) if (!texts.some((x) => lower(x).includes(lower(n)))) missing.push({ kind: "name", said: n });
      for (const q of facts.quotations) if (!texts.some((x) => squash(x).includes(squash(q)))) missing.push({ kind: "quotation", said: q });
      if (missing.length)
        say("ACCOUNT_FACT_NOT_IN_CITED", word("case-checker.say.sentence_states_cites", { ord: row.ord, said: missing.map((m) => factWords(m.kind, m.said)).join(", "),
          are: missing.length === 1 ? localize("case-checker.account.is", "is") : localize("case-checker.account.are", "are") }));
    }
  }

  /* arm 3: against the record's conclusions, and the legs that cut against what they rest on */
  for (const cite of row.cites) {
    const k = concl.get(cite);
    if (k && !k.adopted && DETERMINATION_RE.test(unquoted(row.text)))
      say("ACCOUNT_CONTRADICTED_BY_RECORD", word("case-checker.say.sentence_states_finding", { ord: row.ord, cite }));
    else if (k && k.adopted && k.claim) {
      const s = lower(unquoted(row.text)), claim = lower(k.claim);
      if (!s.includes(claim) && unnegated(s).includes(unnegated(claim)) && unnegated(claim))
        say("ACCOUNT_CONTRADICTED_BY_RECORD", word("case-checker.say.sentence_states_finding_conclusion", { ord: row.ord, cite, claim: k.claim }));
    }
    const leg = legOf(cite, cited, concl);
    if (leg && leg.role === "cuts_against" && SUPPORT_RE.test(unquoted(row.text)) && !CONTRARY_RE.test(unquoted(row.text)))
      say("ACCOUNT_CONTRADICTED_BY_RECORD", word("case-checker.say.sentence_reads_supporting", { ord: row.ord, cite: w(cite), finding: leg.finding }));
  }

  if (row.bias) {
    /* arm 4: its statement printed in this case's lens */
    if (!printed.has(row.bias))
      say("ACCOUNT_BIAS_NOT_PRINTED", word("case-checker.say.sentence_marked_following", { ord: row.ord, bias: row.bias }));
    /* arm 5: a bias-marked sentence states no fact */
    const stated = [...facts.figures.map((f) => factWords("figure", f)), ...facts.dates.map((d) => factWords("date", d)),
                    ...facts.names.map((n) => factWords("name", n)), ...facts.quotations.map((q) => factWords("quotation", q))];
    if (DETERMINATION_RE.test(unquoted(row.text))) stated.push(word("case-checker.push.finding_outcome"));
    else for (const [f, k] of concl) if (k.claim && unnegated(k.claim).split(" ").length >= 3 && unnegated(row.text).includes(unnegated(k.claim))) { stated.push(word("case-checker.push.finding_outcome_2", { f })); break; }
    if (stated.length)
      say("ACCOUNT_CLAIM_NOT_BIAS", word("case-checker.say.sentence_marked_bias", { ord: row.ord, stated: stated.join(", ") }));
  }
  return out;
}
