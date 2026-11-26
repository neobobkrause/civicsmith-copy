/* calc-grammar's exact decimals (requirements: `build/requirements/calc-grammar.md`, R4, R5, R19, R20). A decimal is
 * `{n, s}`: the BigInt `n` scaled by 10^-s, so `0.1 + 0.2` is `3 × 10^-1` and no floating point ever touches a
 * figure's value. A figure (`{value, sign, unit?, currency?, precision}`, or a range with `low` and `high`) is read
 * into an interval `[lo, hi]` with its precision, worked on, and written back. Nothing here throws, except
 * `TypeError` for an argument of the wrong JavaScript type. */

import { word } from "../setup-words/index.mjs";

/**
 * An exact decimal: the whole number `n` scaled by 10^-s.
 * @typedef {Object} Dec
 * @property {bigint} n
 * @property {number} s
 * @bound s: whole number, zero or more
 */
/** A rounding mode a caller may state (R4). @typedef {"half_even" | "half_up" | "down" | "up"} Mode */
/** A rounding mode inside the module: a caller's, or one that keeps a range's bounds outside every reading.
 *  @typedef {Mode | "floor" | "ceiling"} DivMode */
/** @typedef {"exact" | "rounded" | "approximate" | "range"} Precision */
/** @typedef {"+" | "-"} Sign */
/**
 * A figure: an exact value with its sign, unit, currency and precision; a range carries `low` and `high` in place of
 * `value`.
 * @typedef {Object} Figure
 * @property {string} [value]
 * @property {string} [low]
 * @property {string} [high]
 * @property {Sign} sign
 * @property {Precision} precision
 * @property {string} [unit]
 * @property {string} [currency]
 * @property {string} [as_read]
 * @property {boolean} [approximate]
 * @bound value: digits with at most one '.', no sign and no exponent; low and high: signed exact decimals, low not above high
 */
/**
 * A refusal by name: which kind of no, and why (R20).
 * @typedef {Object} Refusal
 * @property {string} refused
 * @property {string} why
 */
/**
 * An undetermined answer, and why; never read as zero (R20).
 * @typedef {Object} Undetermined
 * @property {true} undetermined
 * @property {string} why
 */
/** R10's settled relation of two figures. @typedef {"lower" | "equal" | "higher"} Relation */
/**
 * The places and mode a rounding states (R4); either missing is refused `ROUNDING_UNSTATED`.
 * @typedef {Object} Rounding
 * @property {number | undefined} [places]
 * @property {string | undefined} [mode]
 * @bound places: whole number, 0 to 64
 */
/**
 * A figure read as the interval it stands for, with its precision, unit and currency.
 * @typedef {Object} Reading
 * @property {Dec} lo
 * @property {Dec} hi
 * @property {Precision} precision
 * @property {boolean} approximate
 * @property {string | undefined} unit
 * @property {string | undefined} currency
 * @property {Dec} [value]
 */
/**
 * A figure read as `readFigure` reads it: a part that is not an exact decimal is `null`.
 * @typedef {Object} LooseReading
 * @property {Dec | null} lo
 * @property {Dec | null} hi
 * @property {Precision} precision
 * @property {boolean} approximate
 * @property {string | undefined} unit
 * @property {string | undefined} currency
 * @property {Dec | null} [value]
 */
/**
 * What `makeFigure` writes back as a figure.
 * @typedef {Object} FigureParts
 * @property {Dec} lo
 * @property {Dec} hi
 * @property {Precision} precision
 * @property {boolean | undefined} [approximate]
 * @property {string | undefined} [unit]
 * @property {string | undefined} [currency]
 */
/** @import { Data, Members } from "./tables.mjs" */

/** @type {readonly Mode[]} */
export const MODES = Object.freeze(["half_even", "half_up", "down", "up"]);
/** @type {readonly Precision[]} */
export const PRECISIONS = Object.freeze(["exact", "rounded", "approximate", "range"]);
/** @type {64} */
export const MAX_PLACES = 64;

const UNSIGNED = /^\d+(?:\.\d+)?$/;
const SIGNED = /^-?\d+(?:\.\d+)?$/;
const TEN = 10n;
/** @param {number} k @returns {bigint} */
const pow10 = (k) => TEN ** BigInt(k);

/** @param {string} code @param {string} why @returns {Refusal} */
export const refusal = (code, why) => ({ refused: code, why });
/** @param {string} why @returns {Undetermined} */
export const undetermined = (why) => ({ undetermined: true, why });
/** Whether a value is an object; its members are then read one by one, each as any value.
 *  @param {unknown} x @returns {x is Members} */
export const isObject = (x) => x != null && typeof x === "object";
/** @param {unknown} x @returns {x is Refusal} */
export const isRefusal = (x) => isObject(x) && typeof x.refused === "string";
/** @param {unknown} x @returns {x is Undetermined} */
export const isUndetermined = (x) => isObject(x) && x.undetermined === true;
/** @param {unknown} x @returns {x is Mode} */
const isMode = (x) => x === "half_even" || x === "half_up" || x === "down" || x === "up";
/** @param {unknown} x @returns {x is Precision} */
const isPrecision = (x) => x === "exact" || x === "rounded" || x === "approximate" || x === "range";

/** A signed decimal string to `{n, s}`; `null` when it is not one.
 *  @param {unknown} str @returns {Dec | null} */
export function dec(str) {
  if (typeof str !== "string" || !SIGNED.test(str)) return null;
  const neg = str[0] === "-";
  const body = neg ? str.slice(1) : str;
  const [i = "", f = ""] = body.split(".");
  const n = BigInt(i + f);
  return { n: neg ? -n : n, s: f.length };
}

/* A decimal string a figure's check has already accepted, to `{n, s}`. */
/** @param {unknown} str @returns {Dec} */
function decOf(str) {
  const d = dec(str);
  if (d === null) throw new TypeError("a figure's value is an exact decimal");
  return d;
}

/** `{n, s}` to its signed decimal string, with `s` places.
 *  @param {Dec} d @returns {string} */
export function decStr({ n, s }) {
  const neg = n < 0n;
  let digits = (neg ? -n : n).toString();
  if (s > 0) {
    digits = digits.padStart(s + 1, "0");
    digits = `${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  return neg ? `-${digits}` : digits;
}

/** @param {Dec} a @param {Dec} b @returns {[bigint, bigint, number]} */
const align = (a, b) => {
  const s = Math.max(a.s, b.s);
  return [a.n * pow10(s - a.s), b.n * pow10(s - b.s), s];
};
/** @param {Dec} a @param {Dec} b @returns {Dec} */
export const addD = (a, b) => { const [x, y, s] = align(a, b); return { n: x + y, s }; };
/** @param {Dec} a @param {Dec} b @returns {Dec} */
export const subD = (a, b) => { const [x, y, s] = align(a, b); return { n: x - y, s }; };
/** @param {Dec} a @param {Dec} b @returns {Dec} */
export const mulD = (a, b) => ({ n: a.n * b.n, s: a.s + b.s });
/** @param {Dec} a @returns {Dec} */
export const negD = (a) => ({ n: -a.n, s: a.s });
/** @param {Dec} a @param {Dec} b @returns {-1 | 0 | 1} */
export const cmpD = (a, b) => { const [x, y] = align(a, b); return x < y ? -1 : x > y ? 1 : 0; };
/** @param {Dec} a @returns {boolean} */
export const isZeroD = (a) => a.n === 0n;
/** @param {Dec} first @param {Dec[]} xs @returns {Dec} */
const minD = (first, ...xs) => xs.reduce((m, x) => (cmpD(x, m) < 0 ? x : m), first);
/** @param {Dec} first @param {Dec[]} xs @returns {Dec} */
const maxD = (first, ...xs) => xs.reduce((m, x) => (cmpD(x, m) > 0 ? x : m), first);

/* The integer quotient of p / q (q > 0 after normalising) under a mode; also `floor` and `ceiling`, used only to
   keep a range's bounds outside every reading (R5). Answers `[quotient, exact]`. */
/** @param {bigint} p @param {bigint} q @param {DivMode} mode @returns {[bigint, boolean]} */
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

/** a / b to `places` decimal places under `mode`: `[{n, s}, exact]`. `b` must not be zero.
 *  @param {Dec} a @param {Dec} b @param {number} places @param {DivMode} mode @returns {[Dec, boolean]} */
export function divD(a, b, places, mode) {
  const p = a.n * pow10(places + b.s);
  const q = b.n * pow10(a.s);
  const [quo, exact] = divInt(p, q, mode);
  return [{ n: quo, s: places }, exact];
}

/** a rounded to `places` under `mode`: `[{n, s}, exact]`.
 *  @param {Dec} a @param {number} places @param {DivMode} mode @returns {[Dec, boolean]} */
export function roundD(a, places, mode) {
  if (a.s <= places) return [{ n: a.n * pow10(places - a.s), s: places }, true];
  const [quo, exact] = divInt(a.n, pow10(a.s - places), mode);
  return [{ n: quo, s: places }, exact];
}

// ---- figures ----

/** Why a value is not a figure, or `null` when it is one.
 *  @param {unknown} f @returns {string | null} */
export function figureFault(f) {
  if (!isObject(f) || Array.isArray(f)) return "a figure is an object";
  if (!isPrecision(f.precision)) return `precision must be one of ${PRECISIONS.join(", ")}`;
  if (f.sign !== "+" && f.sign !== "-") return "sign must be + or -";
  if (f.unit !== undefined && (typeof f.unit !== "string" || !f.unit)) return "unit must be a non-empty string";
  if (f.currency !== undefined && (typeof f.currency !== "string" || !f.currency))
    return "currency must be a non-empty string";
  if (f.precision === "range") {
    if (typeof f.low !== "string" || !SIGNED.test(f.low) || typeof f.high !== "string" || !SIGNED.test(f.high))
      return "a range carries low and high as exact decimals";
    if (cmpD(decOf(f.low), decOf(f.high)) > 0) return "a range's low is above its high";
    return null;
  }
  if (typeof f.value !== "string" || !UNSIGNED.test(f.value))
    return "value must be digits with at most one '.' and no sign or exponent";
  return null;
}

/** Whether a value is a figure: `figureFault` finds nothing.
 *  @param {unknown} f @returns {f is Figure} */
export const isFigure = (f) => figureFault(f) === null;

/* A rounded figure's printed unit: its last decimal place, or for a whole number the power of ten its trailing zeros
   show (4200000 from "4.2 million" is 10^5). It can only overstate the unit, which makes a comparison more often
   undetermined, never wrongly settled. */
/** @param {Dec} d @returns {Dec} */
function roundedHalfUnit(d) {
  if (d.s > 0) return { n: 5n, s: d.s + 1 };
  let k = 0;
  let m = d.n < 0n ? -d.n : d.n;
  while (m !== 0n && m % TEN === 0n) { m /= TEN; k += 1; }
  return { n: 5n * pow10(k), s: 1 };
}

/* A figure `figureFault` has accepted, read as an interval with its precision. */
/** @param {Figure} f @returns {Reading} */
function readValid(f) {
  const precision = f.precision;
  const approximate = precision === "approximate" || f.approximate === true;
  if (precision === "range") return { precision, approximate, unit: f.unit, currency: f.currency, lo: decOf(f.low), hi: decOf(f.high) };
  const v0 = decOf(f.value);
  const v = f.sign === "-" ? negD(v0) : v0;
  return { precision, approximate, unit: f.unit, currency: f.currency, lo: v, hi: v, value: v };
}

/* The interval an accepted figure may stand for: a rounded figure widens by half its unit. */
/** @param {Figure} f @returns {Reading} */
function readingValid(f) {
  const r = readValid(f);
  const v = r.value;
  if (f.precision === "rounded" && v !== undefined) {
    const h = roundedHalfUnit(v);
    return { precision: r.precision, approximate: r.approximate, unit: r.unit, currency: r.currency, lo: subD(v, h),
      hi: addD(v, h), value: v };
  }
  return r;
}

/* A decimal read from a figure, where the reading goes on to use it: the language's own error when there is none. */
/** @param {Dec | null} d @param {string} member @returns {Dec} */
function used(d, member) {
  if (d === null) throw new TypeError(`Cannot read properties of null (reading '${member}')`);
  return d;
}

/** A figure to `{lo, hi, precision, approximate, unit, currency, value?}`; `value` is the stated value when not a range.
 *  A part that is not an exact decimal reads as `null`.
 *  @param {Figure} f @returns {LooseReading} */
export function readFigure(f) {
  const precision = f.precision;
  const approximate = precision === "approximate" || f.approximate === true;
  if (precision === "range") return { precision, approximate, unit: f.unit, currency: f.currency, lo: dec(f.low), hi: dec(f.high) };
  const v0 = dec(f.value);
  const v = f.sign === "-" ? negD(used(v0, "n")) : v0;
  return { precision, approximate, unit: f.unit, currency: f.currency, lo: v, hi: v, value: v };
}

/** The interval a figure may stand for, for comparison: a rounded figure widens by half its unit.
 *  @param {Figure} f @returns {LooseReading} */
export function readingOf(f) {
  const r = readFigure(f);
  const v = r.value;
  if (f.precision === "rounded" && v !== undefined) {
    const d = used(v, "s");
    const h = roundedHalfUnit(d);
    return { precision: r.precision, approximate: r.approximate, unit: r.unit, currency: r.currency, lo: subD(d, h),
      hi: addD(d, h), value: d };
  }
  return r;
}

/** @param {Reading[]} rs @returns {Precision} */
const combinePrecision = (rs) => {
  if (rs.some((r) => r.precision === "range")) return "range";
  if (rs.some((r) => r.precision === "approximate")) return "approximate";
  if (rs.some((r) => r.precision === "rounded")) return "rounded";
  return "exact";
};

/** Write an interval back as a figure.
 *  @param {FigureParts} parts @returns {Figure} */
export function makeFigure({ lo, hi, precision, approximate, unit, currency }) {
  const sign = lo.n < 0n ? "-" : "+";
  /** @type {Figure} */
  let out;
  if (precision === "range" || cmpD(lo, hi) !== 0) {
    out = { low: decStr(lo), high: decStr(hi), sign, precision: "range" };
    if (approximate) out.approximate = true;
  } else {
    out = { value: decStr(lo.n < 0n ? negD(lo) : lo), sign, precision };
  }
  if (unit !== undefined) out.unit = unit;
  if (currency !== undefined) out.currency = currency;
  return out;
}

/** @param {Reading} r @returns {string} */
const describe = (r) => {
  const currency = r.currency; const unit = r.unit;
  return [currency && `currency ${currency}`, unit && `unit ${unit}`].filter(Boolean).join(", ") || "no unit or currency";
};
/** @param {Reading} r @returns {boolean} */
const dimensioned = (r) => r.unit !== undefined || r.currency !== undefined;
/** @param {Reading} a @param {Reading} b @returns {boolean} */
const sameDims = (a, b) => a.unit === b.unit && a.currency === b.currency;
/** @param {Reading} a @param {Reading} b @returns {Refusal} */
const mismatch = (a, b) => refusal("UNIT_MISMATCH", `the operands differ: ${describe(a)} against ${describe(b)}`);

/** An operand as a figure, or the refusal of one that is not; a value that is not an object is a `TypeError`.
 *  @param {Data} f @returns {{ figure: Figure } | { refusal: Refusal }} */
function figureOf(f) {
  if (f === null || typeof f !== "object") throw new TypeError("an operand must be a figure object");
  if (!isFigure(f)) return { refusal: refusal("FIGURE_INVALID", String(figureFault(f))) };
  return { figure: f };
}

/** @param {Data} f @returns {Reading | Refusal} */
function operand(f) {
  const g = figureOf(f);
  return "refusal" in g ? g.refusal : readValid(g.figure);
}

/** @param {Data} a @param {Data} b @param {number} sign @returns {Figure | Refusal} */
function additive(a, b, sign) {
  const x = operand(a);
  if (isRefusal(x)) return x;
  const y = operand(b);
  if (isRefusal(y)) return y;
  const rs = [x, y];
  if (!sameDims(x, y)) return mismatch(x, y);
  const lo = sign > 0 ? addD(x.lo, y.lo) : subD(x.lo, y.hi);
  const hi = sign > 0 ? addD(x.hi, y.hi) : subD(x.hi, y.lo);
  return makeFigure({ lo, hi, precision: combinePrecision(rs), approximate: rs.some((r) => r.approximate),
    unit: x.unit, currency: x.currency });
}

/** R4: exact sum of two figures of one unit and currency. Any value is taken; one that is not a figure is refused.
 *  @param {Data} a @param {Data} b @returns {Figure | Refusal} */
export const add = (a, b) => additive(a, b, 1);
/** R4: exact difference a − b.
 *  @param {Data} a @param {Data} b @returns {Figure | Refusal} */
export const subtract = (a, b) => additive(a, b, -1);

/** R4: exact product; at most one operand may carry a unit or currency, which the product keeps.
 *  @param {Data} a @param {Data} b @returns {Figure | Refusal} */
export function multiply(a, b) {
  const x = operand(a);
  if (isRefusal(x)) return x;
  const y = operand(b);
  if (isRefusal(y)) return y;
  const rs = [x, y];
  if (dimensioned(x) && dimensioned(y)) return mismatch(x, y);
  const d = dimensioned(x) ? x : y;
  return makeFigure({ lo: minD(mulD(x.lo, y.lo), mulD(x.lo, y.hi), mulD(x.hi, y.lo), mulD(x.hi, y.hi)),
    hi: maxD(mulD(x.lo, y.lo), mulD(x.lo, y.hi), mulD(x.hi, y.lo), mulD(x.hi, y.hi)), precision: combinePrecision(rs),
    approximate: rs.some((r) => r.approximate), unit: d.unit, currency: d.currency });
}

/** @param {Rounding | null | undefined} opts @returns {{ places: number, mode: Mode } | Refusal} */
function rounding(opts) {
  if (opts === undefined || opts === null) return refusal("ROUNDING_UNSTATED", "no places and mode were stated");
  if (typeof opts !== "object") throw new TypeError("rounding options must be an object");
  const { places, mode } = opts;
  if (mode === undefined) return refusal("ROUNDING_UNSTATED", "no rounding mode was stated");
  if (places === undefined) return refusal("ROUNDING_UNSTATED", "no number of decimal places was stated");
  if (!isMode(mode)) return refusal("ROUNDING_UNSTATED", `mode must be one of ${MODES.join(", ")}`);
  if (!Number.isInteger(places) || places < 0 || places > MAX_PLACES)
    return refusal("ROUNDING_UNSTATED", `places must be a whole number from 0 to ${MAX_PLACES}`);
  return { places, mode };
}

/** @param {Precision} precision @param {boolean} exact @returns {Precision} */
const afterRounding = (precision, exact) => (exact || precision !== "exact" ? precision : "rounded");

/** R4: a / b to the stated places under the stated mode. Division by zero is undetermined. A range's bounds are
 *  rounded outward, so the result still bounds every reading (R5).
 *  @param {Data} a @param {Data} b @param {Rounding | null} [opts] @returns {Figure | Refusal | Undetermined} */
export function divide(a, b, opts) {
  const x = operand(a);
  if (isRefusal(x)) return x;
  const y = operand(b);
  if (isRefusal(y)) return y;
  const rs = [x, y];
  const r = rounding(opts);
  if (isRefusal(r)) return r;
  if (dimensioned(y) && !sameDims(x, y)) return mismatch(x, y);
  if (y.lo.n <= 0n && y.hi.n >= 0n)
    return undetermined(isZeroD(y.lo) && isZeroD(y.hi) ? word("calc-grammar.division_zero") : word("calc-grammar.divisor_range_includes"));
  const same = sameDims(x, y);
  const unit = same ? undefined : x.unit; const currency = same ? undefined : x.currency;
  const approximate = rs.some((q) => q.approximate);
  const precision = combinePrecision(rs);
  if (precision === "range") {
    /** @type {[Dec, Dec][]} */
    const qs = [[x.lo, y.hi], [x.hi, y.lo], [x.hi, y.hi]];
    const lo = minD(divD(x.lo, y.lo, r.places, "floor")[0], ...qs.map(([p, q]) => divD(p, q, r.places, "floor")[0]));
    const hi = maxD(divD(x.lo, y.lo, r.places, "ceiling")[0], ...qs.map(([p, q]) => divD(p, q, r.places, "ceiling")[0]));
    return makeFigure({ lo, hi, precision, approximate, unit, currency });
  }
  const [q, exact] = divD(x.lo, y.lo, r.places, r.mode);
  return makeFigure({ lo: q, hi: q, precision: afterRounding(precision, exact), approximate, unit, currency });
}

/** R4: a figure rounded to the stated places under the stated mode.
 *  @param {Data} a @param {Rounding | null} [opts] @returns {Figure | Refusal} */
export function round(a, opts) {
  const x = operand(a);
  if (isRefusal(x)) return x;
  const r = rounding(opts);
  if (isRefusal(r)) return r;
  const precision = x.precision;
  const keep = { approximate: x.approximate, unit: x.unit, currency: x.currency };
  if (precision === "range") {
    return makeFigure({ lo: roundD(x.lo, r.places, "floor")[0], hi: roundD(x.hi, r.places, "ceiling")[0], precision,
      approximate: keep.approximate, unit: keep.unit, currency: keep.currency });
  }
  const [v, exact] = roundD(x.lo, r.places, r.mode);
  return makeFigure({ lo: v, hi: v, precision: afterRounding(precision, exact), approximate: keep.approximate,
    unit: keep.unit, currency: keep.currency });
}

/** R10's relation of two figures: `lower`, `equal`, `higher` or `{undetermined, why}`; a refusal on a unit mismatch.
 *  Equal only for two exact figures of one value; a rounded figure stands for half a unit either side; an approximate
 *  one settles nothing.
 *  @param {Data} a @param {Data} b @returns {Relation | Undetermined | Refusal} */
export function relate(a, b) {
  const fa = figureOf(a);
  if ("refusal" in fa) return fa.refusal;
  const fb = figureOf(b);
  if ("refusal" in fb) return fb.refusal;
  const x = readingValid(fa.figure); const y = readingValid(fb.figure);
  if (!sameDims(x, y)) return mismatch(x, y);
  if (x.approximate || y.approximate) return undetermined(word("calc-grammar.approximate_figure_settle"));
  if (cmpD(x.hi, y.lo) < 0) return "lower";
  if (cmpD(x.lo, y.hi) > 0) return "higher";
  if (x.precision === "exact" && y.precision === "exact") return "equal";
  return undetermined(word("calc-grammar.figures_readings_overlap"));
}

/** The stated value of a non-range figure, as a decimal, for ordering (R12); `null` for a range.
 *  @param {Figure} f @returns {Dec | null} */
export const statedValue = (f) => (f.precision === "range" ? null : readFigure(f).value ?? null);
