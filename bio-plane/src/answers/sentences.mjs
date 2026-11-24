/* The sentence checks (R4, R5, R22, R31–R33; ladders §9.4 L1; D20, D56; K2471). `checkSentences` judges sentences that
 * each name what they cite (`support`: `h<i>`, `r<i>`, `l<i>`, 1-based positions in `cited.holdings`, `.rules`,
 * `.looks`) against what was read: R4's four checks, R5's closed book, R22's rule items, R31's `baseline` sentence and
 * R32's voice (no verdict, likelihood or rating word; a cause only quoting what establishes it). `checkAnswer` runs
 * through it; `case-checker` R24 bundles it for `case-disclosures` R30, so this file stays pure and imports only pure
 * files (record-grammar's JSON, calc-grammar's figures, observation-log's vocabulary, this module's rows and read log):
 * it writes nothing and never throws. */

import { canonicalJson } from "../record-grammar/json.mjs";
import { parseFigure } from "../calc-grammar/figures.mjs";
import { OBSERVATION_LEVELS, OBSERVATION_STATES } from "../observation-log/vocabulary.mjs";
import { ANSWERS_CHECKS, refusal } from "./checks.mjs";
import { ReadLog, textOf } from "./readlog.mjs";

/** R3, R31: a sentence's kinds. */
export const SENTENCE_KINDS = Object.freeze(["quote", "list", "figure", "absence", "rule", "explain", "baseline"]);
/** R6: a rule item's labels. */
export const RULE_LABELS = Object.freeze(["legal_information", "procedural_fact", "computed_fact"]);
/** R4: the levels and the five absence terms are observation-log's. */
export const LEVELS = Object.freeze(Object.keys(OBSERVATION_LEVELS));
export const ABSENCE_TERMS = Object.freeze(Object.keys(OBSERVATION_STATES));
/** R31 (D20): what a baseline rests on, and whether its document was looked for. */
export const BASIS_KINDS = Object.freeze(["document", "firsthand", "as_recalled"]);
export const LOOKED_STATES = Object.freeze(["not_yet_looked_for", "looked_for_and_not_found"]);
/** R32 (K2472): the closed list, frozen, BOB's (answers' Suggestions). A later change is a requirement change. */
export const VERDICT_WORDS = Object.freeze({
  verdict: Object.freeze(["guilty", "innocent", "liable", "negligent", "illegal", "unlawful", "lawful", "corrupt",
    "corruption", "fraud", "fraudulent", "wrongdoing", "misconduct", "violated", "at fault", "to blame", "proven",
    "disproven", "verdict"]),
  likelihood: Object.freeze(["likely", "unlikely", "probably", "probable", "possibly", "certainly", "clearly", "obviously",
    "almost certainly", "chance", "odds", "probability"]),
  rating: Object.freeze(["rating", "rated", "score", "scored", "out of ten", "stars"]),
});
/** R32: the words that state a cause. */
export const CAUSE_MARKERS = Object.freeze(["because", "caused", "causes", "causing", "due to", "led to", "leads to",
  "as a result of", "resulted in", "results in", "owing to", "on account of"]);

const RULE_ITEM_KEYS = ["rule_id", "service", "value", "label", "quote", "reading", "limits"];
const SEP = "\u0000";
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const wordsRe = (list) => new RegExp(`(?<![A-Za-z])(?:${[...list].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![A-Za-z])`, "i");
const VERDICT_RE = wordsRe(Object.values(VERDICT_WORDS).flat());
/* a percentage stated as a likelihood: the odds a thing is so, beside a word of certainty */
const PERCENT_LIKELIHOOD = /\d+(?:\.\d+)?\s?(?:%|percent\b)\s+(?:sure|certain|confident)\b/i;
const CAUSE_RE = wordsRe(CAUSE_MARKERS);
const QUOTED = /"[^"]*"|“[^”]*”|«[^»]*»/g;

function malformed(field, detail) { return refusal("ANSWER_MALFORMED", detail, { field }); }
function onlyKeys(o, keys, field) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) return malformed(`${field}.${k}`, `${field} carries a field the contract has no place for: ${k}`);
  return null;
}

/* ---- R3, R6, R31: the shapes ---- */

/** R31: null for a baseline of the contract's shape, else `ANSWER_MALFORMED` naming the field. */
function baselineShape(b, f, support) {
  if (!plain(b)) return malformed(f, "a baseline is {value, rests_on, basis_kind, looked}");
  const k = onlyKeys(b, ["value", "rests_on", "basis_kind", "looked"], f); if (k) return k;
  if (!(filled(b.value) || (typeof b.value === "number" && Number.isFinite(b.value))))
    return malformed(`${f}.value`, "a baseline states its value");
  if (!BASIS_KINDS.includes(b.basis_kind))
    return malformed(`${f}.basis_kind`, `a baseline names its basis, one of ${BASIS_KINDS.join(", ")}`);
  if (!Array.isArray(b.rests_on) || !b.rests_on.every((id) => support.includes(id)))
    return malformed(`${f}.rests_on`, "a baseline names what it rests on among its sentence's support");
  if (b.basis_kind === "document") {
    if (!b.rests_on.some((id) => /^h/.test(id))) return malformed(`${f}.rests_on`, "a document's baseline rests on a holding");
    if (b.looked !== null && b.looked !== undefined)
      return malformed(`${f}.looked`, "a baseline read from a document was found, so it names no look");
    return null;
  }
  if (b.looked === "not_yet_looked_for") return null;
  if (plain(b.looked) && b.looked.state === "looked_for_and_not_found" && filled(b.looked.where)
      && Object.keys(b.looked).every((x) => x === "state" || x === "where")) return null;
  return malformed(`${f}.looked`, "a baseline not read from a document says whether its document was looked for: "
    + "not_yet_looked_for, or {state: looked_for_and_not_found, where}");
}

/** R3, R31: null for a sentence of the contract's shape, else `ANSWER_MALFORMED` naming the field. `n` counts the
 *  cited items (`h`, `r`, `l`). */
export function sentenceShape(s, f, n) {
  const inRange = (id) => { const m = /^([hrl])([1-9]\d*)$/.exec(typeof id === "string" ? id : "");
    return !!m && Number(m[2]) <= n[m[1]]; };
  if (!plain(s)) return malformed(f, "a sentence is {text, kind, support}");
  const keys = s.kind === "baseline" ? ["text", "kind", "support", "baselines", "difference"] : ["text", "kind", "support"];
  const k = onlyKeys(s, keys, f); if (k) return k;
  if (!filled(s.text)) return malformed(`${f}.text`, "a sentence's text is a non-empty string");
  if (!SENTENCE_KINDS.includes(s.kind)) return malformed(`${f}.kind`, `a sentence's kind is one of ${SENTENCE_KINDS.join(", ")}`);
  if (!Array.isArray(s.support) || !s.support.every(inRange))
    return malformed(`${f}.support`, "a sentence's support names holdings, rule items or looks as h<i>, r<i>, l<i>");
  if (s.kind === "baseline") {
    if (!Array.isArray(s.baselines) || !s.baselines.length) return malformed(`${f}.baselines`, "a baseline sentence states its baselines");
    for (const [i, b] of s.baselines.entries()) { const bad = baselineShape(b, `${f}.baselines[${i}]`, s.support); if (bad) return bad; }
    if (!(s.difference === null || filled(s.difference))) return malformed(`${f}.difference`, "difference is null or the difference stated");
  }
  return null;
}

/** R3, R6: null for cited items of the contract's shape, else `ANSWER_MALFORMED`. */
export function citedShape({ holdings, rules, looks }) {
  if (!Array.isArray(holdings)) return malformed("holdings", "holdings is a list");
  if (!Array.isArray(rules)) return malformed("rules", "rules is a list");
  if (!Array.isArray(looks)) return malformed("looks", "looks is a list");
  for (const [i, h] of holdings.entries()) {
    const f = `holdings[${i}]`;
    if (!plain(h)) return malformed(f, "a holding is {address, quote}");
    const k = onlyKeys(h, ["address", "quote"], f); if (k) return k;
    if (!filled(h.address)) return malformed(`${f}.address`, "a holding names its address");
    if (typeof h.quote !== "string" || h.quote === "") return malformed(`${f}.quote`, "a holding carries its quote");
  }
  for (const [i, r] of rules.entries()) {
    const f = `rules[${i}]`;
    if (!plain(r)) return malformed(f, "a rule item is {rule_id, service, value, label, ...}");
    const k = onlyKeys(r, RULE_ITEM_KEYS, f); if (k) return k;
    if (!filled(r.rule_id)) return malformed(`${f}.rule_id`, "a rule item names the rule service's answer it is");
    if (!filled(r.service)) return malformed(`${f}.service`, "a rule item names its service");
    if (!("value" in r)) return malformed(`${f}.value`, "a rule item carries its value");
    if (!RULE_LABELS.includes(r.label)) return malformed(`${f}.label`, `a rule item's label is one of ${RULE_LABELS.join(", ")}`);
    if (r.label === "legal_information" && !filled(r.quote))
      return malformed(`${f}.quote`, "a reading of held law carries its quote beside it");
  }
  for (const [i, l] of looks.entries()) {
    const f = `looks[${i}]`;
    if (!plain(l)) return malformed(f, "a look is {level, state}");
    const k = onlyKeys(l, ["level", "state"], f); if (k) return k;
  }
  return null;
}

/* ---- R4: figures ---- */

const DATE = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g;
const ADDRESS = /\b[A-Z]{2,6}-\d{4}-[A-Za-z0-9-]+|\b[0-9a-f]{64}\b|\b(?:rule|occurrence):[^\s,;]+/g;
const FIGURE = /(?:about |approximately |nearly |over |~)?(?:[$€£]\s?|\b(?:USD|EUR|GBP|CAD) ?)?\(?-?\d[\d,]*(?:\.\d+)?\)?(?: ?(?:%|percent\b|thousand\b|million\b|billion\b|trillion\b))?/g;

/** The figures a text states outside its quotes (a date, a time, a record address and a section number are not
 *  figures; a bare four-digit year is read as a date). */
export function figuresIn(text, quotes = []) {
  let t = String(text);
  for (const q of quotes) if (q) t = t.split(q).join(" ");
  t = t.replace(QUOTED, " ").replace(DATE, " ").replace(ADDRESS, " ").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const out = [];
  for (const m of t.matchAll(FIGURE)) {
    const tok = m[0].trim();
    const before = t.slice(Math.max(0, m.index - 2), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if ((/[§#]\s?$/.test(before) || /[A-Za-z.]$/.test(before)) && !/[$€£(]/.test(tok[0])) continue;
    if (/[A-Za-z]/.test(after)) continue;
    if (/^\d{4}$/.test(tok) && Number(tok) >= 1800 && Number(tok) <= 2199) continue;
    const f = parseFigure(tok);
    if (f && typeof f.value === "string") out.push(f);
  }
  return out;
}

/* A decimal string in one spelling: no sign, no leading or trailing zeros. */
function norm(v) {
  let s = String(v).replace(/^[+-]/, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  let [i, f = ""] = s.split(".");
  i = i.replace(/^0+(?=\d)/, ""); f = f.replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}
/* Shift a decimal by `k` places (×10^k). */
function shift(v, k) {
  const n = norm(v); if (n === null) return null;
  let [i, f = ""] = n.split(".");
  if (k > 0) { f = f.padEnd(k, "0"); i = i + f.slice(0, k); f = f.slice(k); }
  else { const m = -k; i = i.padStart(m + 1, "0"); f = i.slice(i.length - m) + f; i = i.slice(0, i.length - m); }
  return norm(`${i}${f ? `.${f}` : ""}`);
}

/** The figures a cited object states: its numbers and its numeric strings, deep. */
function sourceFigures(v, out = new Set()) {
  if (typeof v === "number" && Number.isFinite(v)) { const n = norm(String(Math.abs(v))); if (n !== null) out.add(n); }
  else if (typeof v === "string") {
    if (/^[+-]?\d[\d,]*(\.\d+)?$/.test(v.trim())) { const n = norm(v.trim().replace(/,/g, "")); if (n !== null) out.add(n); }
    else { const f = /\d/.test(v) && v.length <= 40 ? parseFigure(v) : null; if (f && typeof f.value === "string") out.add(norm(f.value)); }
  } else if (Array.isArray(v)) for (const x of v) sourceFigures(x, out);
  else if (plain(v)) for (const x of Object.values(v)) sourceFigures(x, out);
  return out;
}

function figureSourced(f, sources) {
  const v = norm(f.value);
  if (v === null) return false;
  if (sources.has(v)) return true;
  if (f.unit === "percent") { const r = shift(v, -2); if (r !== null && sources.has(r)) return true; }
  return false;
}

/* ---- R4, R5, R22, R31, R32: the checks ---- */

const isFigureAddress = (a) => /^(CALC|MNY)-\d{4}-/.test(a);
const valueEqual = (a, b) => { try { return canonicalJson(a ?? null) === canonicalJson(b ?? null); } catch { return false; } };

/** R22: whether a rule item is one of R7's answers in the log, unchanged. */
function rulePlane(item, log) {
  const held = log.rule(item.rule_id);
  if (!held || held.ok === false || held.not_held) return false;
  if (held.service !== item.service || held.label !== item.label || !valueEqual(held.value, item.value)) return false;
  if (item.quote !== undefined && (typeof item.quote !== "string" || item.quote.includes(SEP) || !textOf(held).includes(item.quote))) return false;
  if (held.quote_only === true && item.reading !== undefined) return false;
  return true;
}

function holdingRead(h, log) {
  if (h.quote.includes(SEP)) return false;
  return log.objectsAt(h.address).some((o) => textOf(o).includes(h.quote));
}

const lookFault = (l) => !l || !LEVELS.includes(l.level) || !ABSENCE_TERMS.includes(l.state);

/** The text in Civicsmith's own voice: the sentence with its quotations and the quotes it cites taken out. */
function ownVoice(text, quotes) {
  let t = String(text);
  for (const q of quotes) if (q) t = t.split(q).join(" ");
  return t.replace(QUOTED, " ");
}

/** R32: whether a text in Civicsmith's voice gives a verdict, likelihood or rating word. */
export function verdictIn(text, quotes = []) {
  const t = ownVoice(text, quotes);
  return VERDICT_RE.test(t) || PERCENT_LIKELIHOOD.test(t);
}

/** R32: whether a sentence states a cause it does not establish: a cause word in its own voice, or a quotation stating
 *  a cause that is not part of a quote it cites and was read. */
function causeUnestablished(text, readQuotes) {
  if (CAUSE_RE.test(ownVoice(text, readQuotes))) return true;
  for (const m of String(text).matchAll(QUOTED)) {
    const inner = m[0].slice(1, -1);
    if (CAUSE_RE.test(inner) && !readQuotes.some((q) => q.includes(inner))) return true;
  }
  return false;
}

/* The read log as given: a ReadLog, or (offline, `case-checker` R24) the objects that were read, as a list. */
function asLog(readLog, viewer) {
  if (readLog instanceof ReadLog) return readLog.viewer === null || viewer === undefined || readLog.viewer === viewer ? readLog : new ReadLog({ viewer });
  const log = new ReadLog({ viewer: viewer ?? null });
  if (Array.isArray(readLog)) for (const o of readLog) if (o !== null && typeof o === "object") log.add("read", null, o);
  return log;
}

/** The judgement over sentences and their cited items: each item's state and each sentence's code (null kept). */
export function judge(sentences, cited, log) {
  const { holdings, rules, looks } = cited;
  const holdOk = holdings.map((h) => holdingRead(h, log));
  const ruleOk = rules.map((r) => rulePlane(r, log));
  const lookOk = looks.map((l) => !lookFault(l));
  const at = (id) => { const m = /^([hrl])(\d+)$/.exec(id); return { kind: m[1], i: Number(m[2]) - 1 }; };
  const code = (s) => {
    const sup = s.support.map(at);
    const hs = sup.filter((x) => x.kind === "h"), rs = sup.filter((x) => x.kind === "r"), ls = sup.filter((x) => x.kind === "l");
    const quotes = [...hs.map((x) => holdings[x.i].quote), ...rs.map((x) => rules[x.i].quote)];
    /* R32: Civicsmith's voice first: no verdict, likelihood or rating word, whatever it rests on */
    if (verdictIn(s.text, quotes)) return "ANSWER_VERDICT_WORD";
    if (s.kind === "absence") {
      if (!ls.length || ls.some((x) => !lookOk[x.i])) return "ANSWER_ABSENCE_WITHOUT_LEVEL";
    } else if (s.kind === "rule" && !rs.length) return "ANSWER_RULE_NOT_PLANE";   /* R22: a rule only through R7 */
    else if (log.empty || !sup.length) return "ANSWER_CITES_UNREAD";   /* R5: it rests on no read */
    if (hs.some((x) => !holdOk[x.i])) return "ANSWER_CITES_UNREAD";
    if (s.kind === "quote" && !hs.length) return "ANSWER_CITES_UNREAD";
    if (rs.some((x) => !ruleOk[x.i])) return "ANSWER_RULE_NOT_PLANE";
    if (ls.some((x) => !lookOk[x.i])) return "ANSWER_ABSENCE_WITHOUT_LEVEL";
    /* R32: a cause only as a quotation of what was read (a concluded finding, or a body's own words, shown as theirs) */
    if (causeUnestablished(s.text, quotes.filter(filled))) return "ANSWER_CAUSE_UNESTABLISHED";
    /* R31: a baseline's own value is labelled with its basis: the member's account, or the document's quote it rests on */
    const labelled = s.kind === "baseline" ? s.baselines.filter((b) => b.basis_kind !== "document"
      || b.rests_on.some((id) => /^h/.test(id) && String(holdings[at(id).i].quote).includes(String(b.value)))).map((b) => String(b.value)) : [];
    const figs = figuresIn(s.text, [...quotes, ...labelled]);
    if (figs.length) {
      const sources = new Set();
      for (const x of hs) { const h = holdings[x.i]; if (isFigureAddress(h.address)) for (const o of log.objectsAt(h.address)) sourceFigures(o, sources); }
      for (const x of rs) { const r = rules[x.i]; if (r.label === "computed_fact") sourceFigures(log.rule(r.rule_id)?.value, sources); }
      if (figs.some((f) => !figureSourced(f, sources))) return "ANSWER_FIGURE_UNSOURCED";
    }
    return null;
  };
  return { holdOk, ruleOk, lookOk, codes: sentences.map(code) };
}

/** R33 (D56; K2471): R4's checks, and R31's and R32's, over sentences that each name what they cite, for
 *  `case-disclosures` R30 (through `case-checker` R24). `cited` is `{holdings, rules, looks}` as an answer carries
 *  them; `readLog` a read log, or the objects read as a list. Answers `{ok: true, withheld, kept}`, `withheld` listing
 *  `{sentence, code, translation}` for each sentence withheld and `kept` the ids of the rest (`s<i>`), or
 *  `ANSWER_MALFORMED` naming the field. Pure; never throws. */
export function checkSentences(sentences, opts = {}) {
  try {
    const { cited = {}, readLog = null, viewer = undefined } = plain(opts) ? opts : {};
    if (!Array.isArray(sentences)) return malformed("sentences", "sentences is a list");
    const c = plain(cited) ? { holdings: cited.holdings ?? [], rules: cited.rules ?? [], looks: cited.looks ?? [] } : null;
    if (!c) return malformed("cited", "cited is {holdings, rules, looks}");
    const bad = citedShape(c);
    if (bad) return bad;
    const n = { h: c.holdings.length, r: c.rules.length, l: c.looks.length };
    for (const [i, s] of sentences.entries()) { const b = sentenceShape(s, `sentences[${i}]`, n); if (b) return b; }
    const j = judge(sentences, c, asLog(readLog, viewer));
    const withheld = [], kept = [];
    j.codes.forEach((code, i) => {
      if (code) withheld.push({ sentence: `s${i + 1}`, code, translation: ANSWERS_CHECKS[code].translation });
      else kept.push(`s${i + 1}`);
    });
    return { ok: true, withheld, kept };
  } catch (e) {
    return malformed("sentences", `the sentences could not be read: ${String(e && e.message || e).slice(0, 120)}`);
  }
}
