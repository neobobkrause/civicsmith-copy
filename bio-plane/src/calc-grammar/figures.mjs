/* calc-grammar's figure parser (requirements: `build/requirements/calc-grammar.md`, R1–R3). Moved by copy from
 * `consequences/figures.mjs` (C:A-11; consequences deletes its copy in its own job): every figure that parser reads
 * is read here with the same value, and more besides — a trailing currency sign or code, `%`, a qualifier, a range.
 * A figure is held exactly, as digits: `$4.2 million` is `4200000`, never a float of it. */

import { dec, decStr, cmpD, negD, refusal } from "./decimal.mjs";
import { localize } from "../setup-words/index.mjs";

const SCALES = Object.freeze({ thousand: 3, thousands: 3, k: 3, million: 6, millions: 6, m: 6, mm: 6, mn: 6,
  billion: 9, billions: 9, bn: 9, b: 9, trillion: 12, trillions: 12, tn: 12 });
const SIGNS = Object.freeze({ $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY" });
const QUALIFIER = /^(?:(?:about|approximately|approx\.|nearly|over)\s+|~\s*)/i;
const FIGURE = /^(-|\()?\s*(?:([$€£¥])|([A-Z]{3})\s)?\s*(-|\()?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*([A-Za-z]+)?\s*(%)?\s*(?:([$€£¥])|([A-Z]{3}))?\s*(\))?$/;
const CODE = /^[A-Z]{3}$/;

const fold = (s) => s.replace(/[   \s]+/g, " ").replace(/[−–—]/g, "-").trim();
const invalid = (why) => refusal("FIGURE_INVALID", why);

/* One figure, no qualifier, no range: `{neg, digits, word, exp, currency, percent}` or a refusal. */
function single(t) {
  const m = FIGURE.exec(t);
  if (!m) return invalid(localize("calc-grammar.figure_module_reads", "\"{text}\" is not a figure this module reads (digits, with thousands separators, a decimal point, a currency sign or code, a minus sign or parentheses, % or a scale word)", { text: String(t.slice(0, 80)) }));
  const [, lead, signBefore, codeBefore, minus, digits, word0, pct, signAfter, codeAfter0, close] = m;
  if ((lead === "(" || minus === "(") !== (close === ")"))
    return invalid(localize("calc-grammar.opening_parenthesis_closed", "an opening parenthesis is not closed, or the reverse"));
  if (lead && minus) return invalid(localize("calc-grammar.figure_carries_two", "the figure carries two signs"));
  let word = word0;
  let codeAfter = codeAfter0;
  if (word && CODE.test(word) && !(word.toLowerCase() in SCALES) && !codeAfter && !pct) { codeAfter = word; word = undefined; }
  let exp = 0;
  if (word) {
    if (!(word.toLowerCase() in SCALES)) return invalid(localize("calc-grammar.scale_word_module", "\"{word}\" is not a scale word this module reads", { word: String(word) }));
    exp = SCALES[word.toLowerCase()];
  }
  const marks = [signBefore && SIGNS[signBefore], codeBefore, signAfter && SIGNS[signAfter], codeAfter].filter(Boolean);
  if (marks.length > 1) return invalid(localize("calc-grammar.figure_carries_two_currency", "the figure carries two currency marks"));
  if (marks.length && pct) return invalid(localize("calc-grammar.figure_cannot_currency", "a figure cannot be both a currency amount and a percentage"));
  return { neg: Boolean(lead || minus), digits: digits.replace(/,/g, ""), word, exp, currency: marks[0],
    percent: Boolean(pct) };
}

/* Digits scaled by 10^exp, exactly, as an unsigned decimal string; and whether the scale went past the printed places. */
function scaled(digits, exp) {
  const [i0, f = ""] = digits.split(".");
  const i = i0 || "0";
  let out;
  if (exp >= f.length) out = i + f + "0".repeat(exp - f.length);
  else out = `${i}${f.slice(0, exp)}.${f.slice(exp)}`;
  out = out.replace(/^0+(?=\d)/, "");
  return { value: out, rounded: exp > 0 && f.length < exp };
}

function figureOf(p, as_read, precision) {
  const { value, rounded } = scaled(p.digits, p.exp);
  const zero = /^[0.]+$/.test(value);
  const f = { value, sign: p.neg && !zero ? "-" : "+", precision: precision || (rounded ? "rounded" : "exact") };
  if (p.percent) f.unit = "percent";
  if (p.currency) f.currency = p.currency;
  f.as_read = as_read;
  return f;
}

/* Two figures joined by a dash or "to": a scale word, currency or % stated on one side only is read on both. */
function rangeOf(left, right, as_read) {
  const l = { ...left }; const r = { ...right };
  if (!l.word && r.word) { l.word = r.word; l.exp = r.exp; }
  if (!r.word && l.word) { r.word = l.word; r.exp = l.exp; }
  if (l.currency && r.currency && l.currency !== r.currency) return invalid(localize("calc-grammar.range_two_figures", "a range's two figures name different currencies"));
  l.currency = r.currency = l.currency || r.currency;
  if (l.percent !== r.percent && (l.currency || r.currency)) return invalid(localize("calc-grammar.range_mixes_percentage", "a range mixes a percentage and an amount"));
  l.percent = r.percent = l.percent || r.percent;
  const signed = (p) => { const d = dec(scaled(p.digits, p.exp).value); return p.neg ? negD(d) : d; };
  const lo = signed(l); const hi = signed(r);
  if (cmpD(lo, hi) > 0) return invalid(localize("calc-grammar.range_first_figure", "a range's first figure is above its second"));
  const f = { low: decStr(lo), high: decStr(hi), sign: lo.n < 0n ? "-" : "+", precision: "range" };
  if (l.percent) f.unit = "percent";
  if (l.currency) f.currency = l.currency;
  f.as_read = as_read;
  return f;
}

function splitRange(t) {
  const to = t.split(/\s+to\s+/i);
  const tries = [];
  if (to.length === 2) tries.push(to);
  for (let i = 1; i < t.length - 1; i++) if (t[i] === "-") tries.push([t.slice(0, i), t.slice(i + 1)]);
  for (const [a, b] of tries) {
    const l = single(a.trim()); const r = single(b.trim());
    if (!l.refused && !r.refused) return [l, r];
  }
  return null;
}

/** R1–R3: a figure as printed, or `{refused: "FIGURE_INVALID", why}`. Throws only for a non-string. */
export function parseFigure(text) {
  if (typeof text !== "string") throw new TypeError("parseFigure takes the figure's text as a string");
  let t = fold(text);
  if (!t) return invalid(localize("calc-grammar.figure_stated", "no figure was stated"));
  const q = QUALIFIER.exec(t);
  if (q) t = t.slice(q[0].length).trim();
  const one = single(t);
  if (!one.refused) return figureOf(one, text, q ? "approximate" : undefined);
  const pair = splitRange(t);
  if (!pair) return one;
  const f = rangeOf(pair[0], pair[1], text);
  if (!f.refused && q) f.approximate = true;
  return f;
}
