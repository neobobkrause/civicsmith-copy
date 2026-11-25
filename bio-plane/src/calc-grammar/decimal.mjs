/* calc-grammar's exact decimals (requirements: `build/requirements/calc-grammar.md`, R4, R5, R19, R20). A decimal is
 * `{n, s}`: the BigInt `n` scaled by 10^-s, so `0.1 + 0.2` is `3 × 10^-1` and no floating point ever touches a
 * figure's value. A figure (`{value, sign, unit?, currency?, precision}`, or a range with `low` and `high`) is read
 * into an interval `[lo, hi]` with its precision, worked on, and written back. Nothing here throws, except
 * `TypeError` for an argument of the wrong JavaScript type. */

import { word } from "../setup-words/index.mjs";

export const MODES = Object.freeze(["half_even", "half_up", "down", "up"]);
export const PRECISIONS = Object.freeze(["exact", "rounded", "approximate", "range"]);
export const MAX_PLACES = 64;

const UNSIGNED = /^\d+(?:\.\d+)?$/;
const SIGNED = /^-?\d+(?:\.\d+)?$/;
const TEN = 10n;
const pow10 = (k) => TEN ** BigInt(k);

export const refusal = (code, why) => ({ refused: code, why });
export const undetermined = (why) => ({ undetermined: true, why });
export const isRefusal = (x) => x != null && typeof x === "object" && typeof x.refused === "string";
export const isUndetermined = (x) => x != null && typeof x === "object" && x.undetermined === true;

/** A signed decimal string to `{n, s}`; `null` when it is not one. */
export function dec(str) {
  if (typeof str !== "string" || !SIGNED.test(str)) return null;
  const neg = str[0] === "-";
  const body = neg ? str.slice(1) : str;
  const [i, f = ""] = body.split(".");
  const n = BigInt(i + f);
  return { n: neg ? -n : n, s: f.length };
}

/** `{n, s}` to its signed decimal string, with `s` places. */
export function decStr({ n, s }) {
  const neg = n < 0n;
  let digits = (neg ? -n : n).toString();
  if (s > 0) {
    digits = digits.padStart(s + 1, "0");
    digits = `${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  return neg ? `-${digits}` : digits;
}

const align = (a, b) => {
  const s = Math.max(a.s, b.s);
  return [a.n * pow10(s - a.s), b.n * pow10(s - b.s), s];
};
export const addD = (a, b) => { const [x, y, s] = align(a, b); return { n: x + y, s }; };
export const subD = (a, b) => { const [x, y, s] = align(a, b); return { n: x - y, s }; };
export const mulD = (a, b) => ({ n: a.n * b.n, s: a.s + b.s });
export const negD = (a) => ({ n: -a.n, s: a.s });
export const cmpD = (a, b) => { const [x, y] = align(a, b); return x < y ? -1 : x > y ? 1 : 0; };
export const isZeroD = (a) => a.n === 0n;
const minD = (...xs) => xs.reduce((m, x) => (cmpD(x, m) < 0 ? x : m));
const maxD = (...xs) => xs.reduce((m, x) => (cmpD(x, m) > 0 ? x : m));

/* The integer quotient of p / q (q > 0 after normalising) under a mode; also `floor` and `ceiling`, used only to
   keep a range's bounds outside every reading (R5). Answers `[quotient, exact]`. */
function divInt(p, q, mode) {
  if (q < 0n) { p = -p; q = -q; }
  let quo = p / q; // truncates toward zero
  const rem = p - quo * q;
  if (rem === 0n) return [quo, true];
  const neg = p < 0n;
  const away = () => (neg ? quo - 1n : quo + 1n);
  const twice = (rem < 0n ? -rem : rem) * 2n;
  switch (mode) {
    case "down": break;
    case "up": quo = away(); break;
    case "floor": if (neg) quo -= 1n; break;
    case "ceiling": if (!neg) quo += 1n; break;
    case "half_up": if (twice >= q) quo = away(); break;
    default: // half_even
      if (twice > q || (twice === q && (quo % 2n !== 0n))) quo = away();
  }
  return [quo, false];
}

/** a / b to `places` decimal places under `mode`: `[{n, s}, exact]`. `b` must not be zero. */
export function divD(a, b, places, mode) {
  const p = a.n * pow10(places + b.s);
  const q = b.n * pow10(a.s);
  const [quo, exact] = divInt(p, q, mode);
  return [{ n: quo, s: places }, exact];
}

/** a rounded to `places` under `mode`: `[{n, s}, exact]`. */
export function roundD(a, places, mode) {
  if (a.s <= places) return [{ n: a.n * pow10(places - a.s), s: places }, true];
  const [quo, exact] = divInt(a.n, pow10(a.s - places), mode);
  return [{ n: quo, s: places }, exact];
}

// ---- figures ----

/** Why a value is not a figure, or `null` when it is one. */
export function figureFault(f) {
  if (f === null || typeof f !== "object" || Array.isArray(f)) return "a figure is an object";
  if (!PRECISIONS.includes(f.precision)) return `precision must be one of ${PRECISIONS.join(", ")}`;
  if (f.sign !== "+" && f.sign !== "-") return "sign must be + or -";
  if (f.unit !== undefined && (typeof f.unit !== "string" || !f.unit)) return "unit must be a non-empty string";
  if (f.currency !== undefined && (typeof f.currency !== "string" || !f.currency))
    return "currency must be a non-empty string";
  if (f.precision === "range") {
    if (typeof f.low !== "string" || !SIGNED.test(f.low) || typeof f.high !== "string" || !SIGNED.test(f.high))
      return "a range carries low and high as exact decimals";
    if (cmpD(dec(f.low), dec(f.high)) > 0) return "a range's low is above its high";
    return null;
  }
  if (typeof f.value !== "string" || !UNSIGNED.test(f.value))
    return "value must be digits with at most one '.' and no sign or exponent";
  return null;
}

/* A rounded figure's printed unit: its last decimal place, or for a whole number the power of ten its trailing zeros
   show (4200000 from "4.2 million" is 10^5). It can only overstate the unit, which makes a comparison more often
   undetermined, never wrongly settled. */
function roundedHalfUnit(d) {
  if (d.s > 0) return { n: 5n, s: d.s + 1 };
  let k = 0;
  let m = d.n < 0n ? -d.n : d.n;
  while (m !== 0n && m % TEN === 0n) { m /= TEN; k += 1; }
  return { n: 5n * pow10(k), s: 1 };
}

/** A figure to `{lo, hi, precision, approximate, unit, currency, value?}`; `value` is the stated value when not a range. */
export function readFigure(f) {
  const base = { precision: f.precision, approximate: f.precision === "approximate" || f.approximate === true,
    unit: f.unit, currency: f.currency };
  if (f.precision === "range") return { ...base, lo: dec(f.low), hi: dec(f.high) };
  const v0 = dec(f.value);
  const v = f.sign === "-" ? negD(v0) : v0;
  return { ...base, lo: v, hi: v, value: v };
}

/** The interval a figure may stand for, for comparison: a rounded figure widens by half its unit. */
export function readingOf(f) {
  const r = readFigure(f);
  if (f.precision === "rounded") {
    const h = roundedHalfUnit(r.value);
    return { ...r, lo: subD(r.value, h), hi: addD(r.value, h) };
  }
  return r;
}

const combinePrecision = (rs) => {
  if (rs.some((r) => r.precision === "range")) return "range";
  if (rs.some((r) => r.precision === "approximate")) return "approximate";
  if (rs.some((r) => r.precision === "rounded")) return "rounded";
  return "exact";
};

/** Write an interval back as a figure. */
export function makeFigure({ lo, hi, precision, approximate, unit, currency }) {
  const out = {};
  if (precision === "range" || cmpD(lo, hi) !== 0) {
    out.low = decStr(lo); out.high = decStr(hi);
    out.sign = lo.n < 0n ? "-" : "+";
    out.precision = "range";
    if (approximate) out.approximate = true;
  } else {
    out.value = decStr(lo.n < 0n ? negD(lo) : lo);
    out.sign = lo.n < 0n ? "-" : "+";
    out.precision = precision === "range" ? "exact" : precision;
  }
  if (unit !== undefined) out.unit = unit;
  if (currency !== undefined) out.currency = currency;
  return out;
}

const describe = (r) => [r.currency && `currency ${r.currency}`, r.unit && `unit ${r.unit}`].filter(Boolean).join(", ")
  || "no unit or currency";
const dimensioned = (r) => r.unit !== undefined || r.currency !== undefined;
const sameDims = (a, b) => a.unit === b.unit && a.currency === b.currency;
const mismatch = (a, b) => refusal("UNIT_MISMATCH", `the operands differ: ${describe(a)} against ${describe(b)}`);

function operands(list) {
  const rs = [];
  for (const f of list) {
    if (f === null || typeof f !== "object") throw new TypeError("an operand must be a figure object");
    const why = figureFault(f);
    if (why) return refusal("FIGURE_INVALID", why);
    rs.push(readFigure(f));
  }
  return rs;
}

function additive(a, b, sign) {
  const rs = operands([a, b]);
  if (isRefusal(rs)) return rs;
  const [x, y] = rs;
  if (!sameDims(x, y)) return mismatch(x, y);
  const lo = sign > 0 ? addD(x.lo, y.lo) : subD(x.lo, y.hi);
  const hi = sign > 0 ? addD(x.hi, y.hi) : subD(x.hi, y.lo);
  return makeFigure({ lo, hi, precision: combinePrecision(rs), approximate: rs.some((r) => r.approximate),
    unit: x.unit, currency: x.currency });
}

/** R4: exact sum of two figures of one unit and currency. */
export const add = (a, b) => additive(a, b, 1);
/** R4: exact difference a − b. */
export const subtract = (a, b) => additive(a, b, -1);

/** R4: exact product; at most one operand may carry a unit or currency, which the product keeps. */
export function multiply(a, b) {
  const rs = operands([a, b]);
  if (isRefusal(rs)) return rs;
  const [x, y] = rs;
  if (dimensioned(x) && dimensioned(y)) return mismatch(x, y);
  const ps = [mulD(x.lo, y.lo), mulD(x.lo, y.hi), mulD(x.hi, y.lo), mulD(x.hi, y.hi)];
  const d = dimensioned(x) ? x : y;
  return makeFigure({ lo: minD(...ps), hi: maxD(...ps), precision: combinePrecision(rs),
    approximate: rs.some((r) => r.approximate), unit: d.unit, currency: d.currency });
}

function rounding(opts) {
  if (opts === undefined || opts === null) return refusal("ROUNDING_UNSTATED", "no places and mode were stated");
  if (typeof opts !== "object") throw new TypeError("rounding options must be an object");
  const { places, mode } = opts;
  if (mode === undefined) return refusal("ROUNDING_UNSTATED", "no rounding mode was stated");
  if (places === undefined) return refusal("ROUNDING_UNSTATED", "no number of decimal places was stated");
  if (!MODES.includes(mode)) return refusal("ROUNDING_UNSTATED", `mode must be one of ${MODES.join(", ")}`);
  if (!Number.isInteger(places) || places < 0 || places > MAX_PLACES)
    return refusal("ROUNDING_UNSTATED", `places must be a whole number from 0 to ${MAX_PLACES}`);
  return { places, mode };
}

const afterRounding = (precision, exact) => (exact || precision !== "exact" ? precision : "rounded");

/** R4: a / b to the stated places under the stated mode. Division by zero is undetermined. A range's bounds are
 *  rounded outward, so the result still bounds every reading (R5). */
export function divide(a, b, opts) {
  const rs = operands([a, b]);
  if (isRefusal(rs)) return rs;
  const r = rounding(opts);
  if (isRefusal(r)) return r;
  const [x, y] = rs;
  if (dimensioned(y) && !sameDims(x, y)) return mismatch(x, y);
  if (y.lo.n <= 0n && y.hi.n >= 0n)
    return undetermined(isZeroD(y.lo) && isZeroD(y.hi) ? word("calc-grammar.division_zero") : word("calc-grammar.divisor_range_includes"));
  const keep = sameDims(x, y) ? {} : { unit: x.unit, currency: x.currency };
  const approximate = rs.some((q) => q.approximate);
  const precision = combinePrecision(rs);
  if (precision === "range") {
    const qs = [[x.lo, y.lo], [x.lo, y.hi], [x.hi, y.lo], [x.hi, y.hi]];
    const lo = minD(...qs.map(([p, q]) => divD(p, q, r.places, "floor")[0]));
    const hi = maxD(...qs.map(([p, q]) => divD(p, q, r.places, "ceiling")[0]));
    return makeFigure({ lo, hi, precision, approximate, ...keep });
  }
  const [q, exact] = divD(x.lo, y.lo, r.places, r.mode);
  return makeFigure({ lo: q, hi: q, precision: afterRounding(precision, exact), approximate, ...keep });
}

/** R4: a figure rounded to the stated places under the stated mode. */
export function round(a, opts) {
  const rs = operands([a]);
  if (isRefusal(rs)) return rs;
  const r = rounding(opts);
  if (isRefusal(r)) return r;
  const [x] = rs;
  if (x.precision === "range") {
    return makeFigure({ ...x, lo: roundD(x.lo, r.places, "floor")[0], hi: roundD(x.hi, r.places, "ceiling")[0] });
  }
  const [v, exact] = roundD(x.lo, r.places, r.mode);
  return makeFigure({ ...x, lo: v, hi: v, precision: afterRounding(x.precision, exact) });
}

/** R10's relation of two figures: `lower`, `equal`, `higher` or `{undetermined, why}`; a refusal on a unit mismatch.
 *  Equal only for two exact figures of one value; a rounded figure stands for half a unit either side; an approximate
 *  one settles nothing. */
export function relate(a, b) {
  for (const f of [a, b]) {
    if (f === null || typeof f !== "object") throw new TypeError("an operand must be a figure object");
    const why = figureFault(f);
    if (why) return refusal("FIGURE_INVALID", why);
  }
  const x = readingOf(a); const y = readingOf(b);
  if (!sameDims(x, y)) return mismatch(x, y);
  if (x.approximate || y.approximate) return undetermined(word("calc-grammar.approximate_figure_settle"));
  if (cmpD(x.hi, y.lo) < 0) return "lower";
  if (cmpD(x.lo, y.hi) > 0) return "higher";
  if (x.precision === "exact" && y.precision === "exact") return "equal";
  return undetermined(word("calc-grammar.figures_readings_overlap"));
}

/** The stated value of a non-range figure, as a decimal, for ordering (R12); `null` for a range. */
export const statedValue = (f) => (f.precision === "range" ? null : readFigure(f).value);
