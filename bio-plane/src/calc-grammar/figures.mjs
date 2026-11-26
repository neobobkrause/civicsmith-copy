/* calc-grammar's figure parser (requirements: `build/requirements/calc-grammar.md`, R1–R3). Moved by copy from
 * `consequences/figures.mjs` (C:A-11; consequences deletes its copy in its own job): every figure that parser reads
 * is read here with the same value, and more besides — a trailing currency sign or code, `%`, a qualifier, a range.
 * A figure is held exactly, as digits: `$4.2 million` is `4200000`, never a float of it. */

import { dec, decStr, cmpD, negD, refusal, isRefusal } from "./decimal.mjs";
import { localize } from "../setup-words/index.mjs";

/** @import { Dec, Figure, Refusal } from "./decimal.mjs" */
/**
 * One figure as printed, before it is scaled: its sign, digits, scale word and power of ten, currency and percent.
 * @typedef {Object} Printed
 * @property {boolean} neg
 * @property {string} digits
 * @property {string | undefined} word
 * @property {number} exp
 * @property {string | undefined} currency
 * @property {boolean} percent
 */

/** @type {Readonly<{ [word: string]: number }>} */
const SCALES = Object.freeze({ thousand: 3, thousands: 3, k: 3, million: 6, millions: 6, m: 6, mm: 6, mn: 6,
  billion: 9, billions: 9, bn: 9, b: 9, trillion: 12, trillions: 12, tn: 12 });
/** @type {Readonly<{ [sign: string]: string }>} */
const SIGNS = Object.freeze({ $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY" });
const QUALIFIER = /^(?:(?:about|approximately|approx\.|nearly|over)\s+|~\s*)/i;
const FIGURE = /^(-|\()?\s*(?:([$€£¥])|([A-Z]{3})\s)?\s*(-|\()?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*([A-Za-z]+)?\s*(%)?\s*(?:([$€£¥])|([A-Z]{3}))?\s*(\))?$/;
const CODE = /^[A-Z]{3}$/;

/** @param {string} s @returns {string} */
const fold = (s) => s.replace(/[   \s]+/g, " ").replace(/[−–—]/g, "-").trim();
/** @param {string} why @returns {Refusal} */
const invalid = (why) => refusal("FIGURE_INVALID", why);

/* One figure, no qualifier, no range: `{neg, digits, word, exp, currency, percent}` or a refusal. */
/** @param {string} t @returns {Printed | Refusal} */
function single(t) {
  const m = FIGURE.exec(t);
  if (!m) return invalid(localize("calc-grammar.figure_module_reads", "\"{text}\" is not a figure this module reads (digits, with thousands separators, a decimal point, a currency sign or code, a minus sign or parentheses, % or a scale word)", { text: String(t.slice(0, 80)) }));
  const [, lead, signBefore, codeBefore, minus, digits, word0, pct, signAfter, codeAfter0, close] = m;
  if ((lead === "(" || minus === "(") !== (close === ")"))
    return invalid(localize("calc-grammar.opening_parenthesis_closed", "an opening parenthesis is not closed, or the reverse"));
  if (lead && minus) return invalid(localize("calc-grammar.figure_carries_two", "the figure carries two signs"));
  const asCode = word0 !== undefined && word0 !== "" && CODE.test(word0) && !(word0.toLowerCase() in SCALES) && !codeAfter0 && !pct;
  const word = asCode ? undefined : word0;
  const codeAfter = asCode ? word0 : codeAfter0;
  let exp = 0;
  if (word) {
    const scale = SCALES[word.toLowerCase()];
    if (!(word.toLowerCase() in SCALES) || scale === undefined) return invalid(localize("calc-grammar.scale_word_module", "\"{word}\" is not a scale word this module reads", { word: String(word) }));
    exp = scale;
  }
  const marks = [signBefore && SIGNS[signBefore], codeBefore, signAfter && SIGNS[signAfter], codeAfter].filter(Boolean);
  if (marks.length > 1) return invalid(localize("calc-grammar.figure_carries_two_currency", "the figure carries two currency marks"));
  if (marks.length && pct) return invalid(localize("calc-grammar.figure_cannot_currency", "a figure cannot be both a currency amount and a percentage"));
  return { neg: Boolean(lead || minus), digits: String(digits).replace(/,/g, ""), word, exp, currency: marks[0],
    percent: Boolean(pct) };
}

/* Digits scaled by 10^exp, exactly, as an unsigned decimal string; and whether the scale went past the printed places. */
/** @param {string} digits @param {number} exp @returns {{ value: string, rounded: boolean }} */
function scaled(digits, exp) {
  const [i0 = "", f = ""] = digits.split(".");
  const i = i0 || "0";
  /** @type {string} */
  let out;
  if (exp >= f.length) out = i + f + "0".repeat(exp - f.length);
  else out = `${i}${f.slice(0, exp)}.${f.slice(exp)}`;
  out = out.replace(/^0+(?=\d)/, "");
  return { value: out, rounded: exp > 0 && f.length < exp };
}

/** @param {Printed} p @param {string} as_read @param {"approximate" | undefined} precision @returns {Figure} */
function figureOf(p, as_read, precision) {
  const { value, rounded } = scaled(p.digits, p.exp);
  const zero = /^[0.]+$/.test(value);
  /** @type {Figure} */
  const f = { value, sign: p.neg && !zero ? "-" : "+", precision: precision || (rounded ? "rounded" : "exact") };
  if (p.percent) f.unit = "percent";
  const currency = p.currency;
  if (currency) f.currency = currency;
  f.as_read = as_read;
  return f;
}

/* Two figures joined by a dash or "to": a scale word, currency or % stated on one side only is read on both. */
/** @param {Printed} left @param {Printed} right @param {string} as_read @returns {Figure | Refusal} */
function rangeOf(left, right, as_read) {
  /** @type {Printed} */
  const l = { neg: left.neg, digits: left.digits, word: left.word, exp: left.exp, currency: left.currency, percent: left.percent };
  /** @type {Printed} */
  const r = { neg: right.neg, digits: right.digits, word: right.word, exp: right.exp, currency: right.currency, percent: right.percent };
  const rightWord = r.word;
  if (!l.word && rightWord) { l.word = rightWord; l.exp = r.exp; }
  const leftWord = l.word;
  if (!r.word && leftWord) { r.word = leftWord; r.exp = l.exp; }
  const lc = l.currency; const rc = r.currency;
  if (lc && rc && lc !== rc) return invalid(localize("calc-grammar.range_two_figures", "a range's two figures name different currencies"));
  l.currency = r.currency = l.currency || r.currency;
  if (l.percent !== r.percent && (l.currency || r.currency)) return invalid(localize("calc-grammar.range_mixes_percentage", "a range mixes a percentage and an amount"));
  l.percent = r.percent = l.percent || r.percent;
  /** @param {Printed} p @returns {Dec | null} */
  const signed = (p) => { const d = dec(scaled(p.digits, p.exp).value); return p.neg && d ? negD(d) : d; };
  const lo = signed(l); const hi = signed(r);
  if (lo === null || hi === null) throw new TypeError("a scaled figure is an exact decimal");
  if (cmpD(lo, hi) > 0) return invalid(localize("calc-grammar.range_first_figure", "a range's first figure is above its second"));
  /** @type {Figure} */
  const f = { low: decStr(lo), high: decStr(hi), sign: lo.n < 0n ? "-" : "+", precision: "range" };
  if (l.percent) f.unit = "percent";
  const currency = l.currency;
  if (currency) f.currency = currency;
  f.as_read = as_read;
  return f;
}

/** @param {string} t @returns {[Printed, Printed] | null} */
function splitRange(t) {
  const to = t.split(/\s+to\s+/i);
  /** @type {[string, string][]} */
  const tries = [];
  const [a0, b0] = to;
  if (to.length === 2 && a0 !== undefined && b0 !== undefined) tries.push([a0, b0]);
  for (let i = 1; i < t.length - 1; i++) if (t[i] === "-") tries.push([t.slice(0, i), t.slice(i + 1)]);
  for (const [a, b] of tries) {
    const l = single(a.trim()); const r = single(b.trim());
    if (!isRefusal(l) && !isRefusal(r)) return [l, r];
  }
  return null;
}

/** R1–R3: a figure as printed, or `{refused: "FIGURE_INVALID", why}`. Throws only for a non-string.
 *  @param {string} text @returns {Figure | Refusal} */
export function parseFigure(text) {
  if (typeof text !== "string") throw new TypeError("parseFigure takes the figure's text as a string");
  let t = fold(text);
  if (!t) return invalid(localize("calc-grammar.figure_stated", "no figure was stated"));
  const q = QUALIFIER.exec(t);
  if (q) t = t.slice(q[0].length).trim();
  const one = single(t);
  if (!isRefusal(one)) return figureOf(one, text, q ? "approximate" : undefined);
  const pair = splitRange(t);
  if (!pair) return one;
  const f = rangeOf(pair[0], pair[1], text);
  if (!isRefusal(f) && q) f.approximate = true;
  return f;
}
