/* calc-grammar's exact decimals (requirements: `build/requirements/calc-grammar.md`, R4, R5, R19, R20). A decimal is
 * `{n, s}`: the BigInt `n` scaled by 10^-s, so `0.1 + 0.2` is `3 × 10^-1` and no floating point ever touches a
 * figure's value. A figure (`{value, sign, unit?, currency?, precision}`, or a range with `low` and `high`) is read
 * into an interval `[lo, hi]` with its precision, worked on, and written back. Nothing here throws, except
 * `TypeError` for an argument of the wrong JavaScript type. */

import { word } from "../setup-words/index.mjs";

/**
 * A figure (R1, R4): an exact decimal with its sign, unit, currency and precision. A point figure carries `value`;
 * a range carries `low` and `high` in its place. `figureFault` says why a value is not one.
 * @typedef {Object} Figure
 * @property {string} [value] a point figure's magnitude
 * @property {string} [low] a range's lower bound
 * @property {string} [high] a range's upper bound
 * @property {string} sign
 * @property {string} [unit] `percent`, a span's unit, or the caller's
 * @property {string} [currency] a three-letter code
 * @property {string} precision
 * @property {string} [as_read] the source's characters, unchanged, on a figure `parseFigure` read
 * @property {boolean} [approximate] on a range whose source was qualified
 * @bound sign: "+" or "-"
 * @bound precision: one of exact, rounded, approximate, range; a range carries low and high and no value
 * @bound value: digits with at most one "." and no sign or exponent
 * @bound low, high: signed decimals of the same form, low not above high
 * @bound unit, currency: absent, or a non-empty string
 */
/**
 * A refusal by name (R20): the kind of no, and why.
 * @typedef {Object} Refusal
 * @property {string} refused the refusal's code
 * @property {string} why
 */
/**
 * An undetermined answer (R4, R20): never zero, never a guess.
 * @typedef {Object} Undetermined
 * @property {true} undetermined
 * @property {string} why
 */
/**
 * The fields of `F` that `K` lacks, as absent.
 * @template F, K
 * @typedef {{[P in Exclude<keyof F, keyof K>]?: undefined}} Absent
 */
/**
 * An answer of one of two kinds, each carrying the other's fields as absent: a reader tells them apart by reading
 * a field (`refused`, `undetermined`, `value`), as callers do.
 * @template A, B
 * @typedef {(A & Absent<B, A>) | (B & Absent<A, B>)} OneOf
 */
/**
 * An answer of one of three kinds, each carrying the others' fields as absent.
 * @template A, B, C
 * @typedef {(A & Absent<B & C, A>) | (B & Absent<A & C, B>) | (C & Absent<A & B, C>)} OneOf3
 */
/**
 * An exact decimal held inside the module: the whole number `n` scaled by 10^-s.
 * @typedef {Object} Dec
 * @property {bigint} n
 * @property {number} s the decimal places
 * @bound s: whole number, zero or more
 */
/**
 * A figure read as the interval it may stand for.
 * @typedef {Object} Reading
 * @property {Dec} lo
 * @property {Dec} hi
 * @property {string} precision as the figure's
 * @property {boolean} approximate
 * @property {string} [unit]
 * @property {string} [currency]
 * @property {Dec} [value] the stated value, for a figure that is not a range
 */
/**
 * How `divide` and `round` round (R4).
 * @typedef {Object} Rounding
 * @property {number} places
 * @property {string} mode
 * @bound places: whole number, 0 to 64
 * @bound mode: one of half_even, half_up, down, up
 */

/** @type {ReadonlyArray<string>} the rounding modes R4 names */
export const MODES = Object.freeze(["half_even", "half_up", "down", "up"]);
/** @type {ReadonlyArray<string>} a figure's precisions (R2) */
export const PRECISIONS = Object.freeze(["exact", "rounded", "approximate", "range"]);
/** @type {number} the most decimal places `divide` and `round` give */
export const MAX_PLACES = 64;

const UNSIGNED = /^\d+(?:\.\d+)?$/;
const SIGNED = /^-?\d+(?:\.\d+)?$/;
const TEN = 10n;
const pow10 = (k) => TEN ** BigInt(k);

/**
 * A refusal by name.
 * @param {string} code
 * @param {string} why
 * @returns {Refusal}
 */
export const refusal = (code, why) => ({ refused: code, why });
/**
 * An undetermined answer.
 * @param {string} why
 * @returns {Undetermined}
 */
export const undetermined = (why) => ({ undetermined: true, why });
/**
 * Whether a value is a refusal: an object whose `refused` is a string.
 * @param {*} x
 * @returns {x is Refusal}
 */
export const isRefusal = (x) => x != null && typeof x === "object" && typeof x.refused === "string";
/**
 * Whether a value is undetermined: an object whose `undetermined` is `true`.
 * @param {*} x
 * @returns {x is Undetermined}
 */
export const isUndetermined = (x) => x != null && typeof x === "object" && x.undetermined === true;

/**
 * A signed decimal string to `{n, s}`; `null` when it is not one.
 * @param {*} str
 * @returns {Dec|null}
 */
export function dec(str) {
  if (typeof str !== "string" || !SIGNED.test(str)) return null;
  const neg = str[0] === "-";
  const body = neg ? str.slice(1) : str;
  const [i, f = ""] = body.split(".");
  const n = BigInt(i + f);
  return { n: neg ? -n : n, s: f.length };
}

/**
 * `{n, s}` to its signed decimal string, with `s` places.
 * @param {Dec} d
 * @returns {string}
 */
export function decStr({ n, s }) {
  const neg = n < 0n;
  let digits = (neg ? -n : n).toString();
  if (s > 0) {
    digits = digits.padStart(s + 1, "0");
    digits = `${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  return neg ? `-${digits}` : digits;
}

/**
 * @param {Dec} a
 * @param {Dec} b
 * @returns {[bigint, bigint, number]}
 */
const align = (a, b) => {
  const s = Math.max(a.s, b.s);
  return [a.n * pow10(s - a.s), b.n * pow10(s - b.s), s];
};
/**
 * Exact a + b.
 * @param {Dec} a
 * @param {Dec} b
 * @returns {Dec}
 */
export const addD = (a, b) => { const [x, y, s] = align(a, b); return { n: x + y, s }; };
/**
 * Exact a − b.
 * @param {Dec} a
 * @param {Dec} b
 * @returns {Dec}
 */
export const subD = (a, b) => { const [x, y, s] = align(a, b); return { n: x - y, s }; };
/**
 * Exact a × b.
 * @param {Dec} a
 * @param {Dec} b
 * @returns {Dec}
 */
export const mulD = (a, b) => ({ n: a.n * b.n, s: a.s + b.s });
/**
 * Exact −a.
 * @param {Dec} a
 * @returns {Dec}
 */
export const negD = (a) => ({ n: -a.n, s: a.s });
/**
 * -1, 0 or 1 as a is below, equal to or above b.
 * @param {Dec} a
 * @param {Dec} b
 * @returns {number}
 */
export const cmpD = (a, b) => { const [x, y] = align(a, b); return x < y ? -1 : x > y ? 1 : 0; };
/**
 * Whether a is zero.
 * @param {Dec} a
 * @returns {boolean}
 */
export const isZeroD = (a) => a.n === 0n;
/** @type {(...xs: Dec[]) => Dec} */
const minD = (...xs) => xs.reduce((m, x) => (cmpD(x, m) < 0 ? x : m));
/** @type {(...xs: Dec[]) => Dec} */
const maxD = (...xs) => xs.reduce((m, x) => (cmpD(x, m) > 0 ? x : m));

/* The integer quotient of p / q (q > 0 after normalising) under a mode; also `floor` and `ceiling`, used only to
   keep a range's bounds outside every reading (R5). Answers `[quotient, exact]`. */
/**
 * @param {bigint} p
 * @param {bigint} q
 * @param {string} mode
 * @returns {[bigint, boolean]}
 */
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

/**
 * a / b to `places` decimal places under `mode`: `[{n, s}, exact]`.
 * @param {Dec} a
 * @param {Dec} b
 * @param {number} places
 * @param {string} mode
 * @returns {[Dec, boolean]}
 * @bound b: not zero
 * @bound mode: one of half_even, half_up, down, up, floor, ceiling
 */
export function divD(a, b, places, mode) {
  const p = a.n * pow10(places + b.s);
  const q = b.n * pow10(a.s);
  const [quo, exact] = divInt(p, q, mode);
  return [{ n: quo, s: places }, exact];
}

/**
 * a rounded to `places` under `mode`: `[{n, s}, exact]`.
 * @param {Dec} a
 * @param {number} places
 * @param {string} mode
 * @returns {[Dec, boolean]}
 * @bound mode: one of half_even, half_up, down, up, floor, ceiling
 */
export function roundD(a, places, mode) {
  if (a.s <= places) return [{ n: a.n * pow10(places - a.s), s: places }, true];
  const [quo, exact] = divInt(a.n, pow10(a.s - places), mode);
  return [{ n: quo, s: places }, exact];
}

// ---- figures ----

/**
 * Why a value is not a figure, or `null` when it is one.
 * @param {*} f
 * @returns {string|null}
 */
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
    if (cmpD(/** @type {Dec} */ (dec(f.low)), /** @type {Dec} */ (dec(f.high))) > 0) return "a range's low is above its high";
    return null;
  }
  if (typeof f.value !== "string" || !UNSIGNED.test(f.value))
    return "value must be digits with at most one '.' and no sign or exponent";
  return null;
}

/* A rounded figure's printed unit: its last decimal place, or for a whole number the power of ten its trailing zeros
   show (4200000 from "4.2 million" is 10^5). It can only overstate the unit, which makes a comparison more often
   undetermined, never wrongly settled. */
/**
 * @param {Dec} d
 * @returns {Dec}
 */
function roundedHalfUnit(d) {
  if (d.s > 0) return { n: 5n, s: d.s + 1 };
  let k = 0;
  let m = d.n < 0n ? -d.n : d.n;
  while (m !== 0n && m % TEN === 0n) { m /= TEN; k += 1; }
  return { n: 5n * pow10(k), s: 1 };
}

/**
 * A figure to `{lo, hi, precision, approximate, unit, currency, value?}`; `value` is the stated value when not a range.
 * @param {Figure} f a figure `figureFault` passes
 * @returns {Reading}
 */
export function readFigure(f) {
  const base = { precision: f.precision, approximate: f.precision === "approximate" || f.approximate === true,
    unit: f.unit, currency: f.currency };
  if (f.precision === "range") return { ...base, lo: /** @type {Dec} */ (dec(f.low)), hi: /** @type {Dec} */ (dec(f.high)) };
  const v0 = /** @type {Dec} */ (dec(f.value));
  const v = f.sign === "-" ? negD(v0) : v0;
  return { ...base, lo: v, hi: v, value: v };
}

/**
 * The interval a figure may stand for, for comparison: a rounded figure widens by half its unit.
 * @param {Figure} f a figure `figureFault` passes
 * @returns {Reading}
 */
export function readingOf(f) {
  const r = readFigure(f);
  if (f.precision === "rounded") {
    const h = roundedHalfUnit(/** @type {Dec} */ (r.value));
    return { ...r, lo: subD(/** @type {Dec} */ (r.value), h), hi: addD(/** @type {Dec} */ (r.value), h) };
  }
  return r;
}

/** @type {(rs: Reading[]) => string} */
const combinePrecision = (rs) => {
  if (rs.some((r) => r.precision === "range")) return "range";
  if (rs.some((r) => r.precision === "approximate")) return "approximate";
  if (rs.some((r) => r.precision === "rounded")) return "rounded";
  return "exact";
};

/**
 * Write an interval back as a figure: a range when its bounds differ or its precision is `range`.
 * @param {{lo: Dec, hi: Dec, precision: string, approximate?: boolean, unit?: string, currency?: string}} r
 * @returns {Figure}
 */
export function makeFigure({ lo, hi, precision, approximate, unit, currency }) {
  /** @type {Figure} builds a Figure, field by field below */
  const out = /** @type {Figure} */ ({});
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

/** @type {(r: {unit?: string, currency?: string}) => string} */
const describe = (r) => [r.currency && `currency ${r.currency}`, r.unit && `unit ${r.unit}`].filter(Boolean).join(", ")
  || "no unit or currency";
/** @type {(r: {unit?: string, currency?: string}) => boolean} */
const dimensioned = (r) => r.unit !== undefined || r.currency !== undefined;
/** @type {(a: {unit?: string, currency?: string}, b: {unit?: string, currency?: string}) => boolean} */
const sameDims = (a, b) => a.unit === b.unit && a.currency === b.currency;
/** @type {(a: {unit?: string, currency?: string}, b: {unit?: string, currency?: string}) => Refusal} */
const mismatch = (a, b) => refusal("UNIT_MISMATCH", `the operands differ: ${describe(a)} against ${describe(b)}`);

/**
 * Each operand read, or the first one's refusal; throws `TypeError` for a non-object.
 * @param {Array<*>} list
 * @returns {Reading[]|Refusal}
 */
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

/**
 * @param {object} a
 * @param {object} b
 * @param {number} sign 1 to add, -1 to subtract
 * @returns {OneOf<Figure, Refusal>}
 */
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

/**
 * R4: exact sum of two figures of one unit and currency. A figure that is not one is refused `FIGURE_INVALID`;
 * differing units or currencies `UNIT_MISMATCH` (R5). Throws `TypeError` for an operand that is not an object.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {object} b a figure, likewise
 * @returns {OneOf<Figure, Refusal>}
 */
export const add = (a, b) => additive(a, b, 1);
/**
 * R4: exact difference a − b, refused as `add` is.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {object} b a figure, likewise
 * @returns {OneOf<Figure, Refusal>}
 */
export const subtract = (a, b) => additive(a, b, -1);

/**
 * R4: exact product; at most one operand may carry a unit or currency, which the product keeps, else `UNIT_MISMATCH`.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {object} b a figure, likewise
 * @returns {OneOf<Figure, Refusal>}
 */
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

/**
 * The rounding stated, or `ROUNDING_UNSTATED` naming what is missing or wrong.
 * @param {*} opts
 * @returns {Rounding|Refusal}
 */
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

/** @type {(precision: string, exact: boolean) => string} */
const afterRounding = (precision, exact) => (exact || precision !== "exact" ? precision : "rounded");

/**
 * R4: a / b to the stated places under the stated mode. Division by zero, or by a range that holds zero, is
 * undetermined. A range's bounds are rounded outward, so the result still bounds every reading (R5). A divisor
 * with a unit or currency the dividend lacks is `UNIT_MISMATCH`; a missing or wrong rounding `ROUNDING_UNSTATED`.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {object} b a figure, likewise
 * @param {Partial<Rounding>} [opts] what is missing or wrong is refused `ROUNDING_UNSTATED`
 * @returns {OneOf3<Figure, Refusal, Undetermined>}
 */
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

/**
 * R4: a figure rounded to the stated places under the stated mode; a range's bounds are rounded outward.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {Partial<Rounding>} [opts] what is missing or wrong is refused `ROUNDING_UNSTATED`
 * @returns {OneOf<Figure, Refusal>}
 */
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
 *  one settles nothing. Throws `TypeError` for an operand that is not an object.
 * @param {object} a a figure; any other object is refused `FIGURE_INVALID`
 * @param {object} b a figure, likewise
 * @returns {string|Undetermined|Refusal}
 * @bound relation: one of lower, equal, higher
 */
export function relate(a, b) {
  for (const f of [a, b]) {
    if (f === null || typeof f !== "object") throw new TypeError("an operand must be a figure object");
    const why = figureFault(f);
    if (why) return refusal("FIGURE_INVALID", why);
  }
  const x = readingOf(/** @type {Figure} */ (a)); const y = readingOf(/** @type {Figure} */ (b));
  if (!sameDims(x, y)) return mismatch(x, y);
  if (x.approximate || y.approximate) return undetermined(word("calc-grammar.approximate_figure_settle"));
  if (cmpD(x.hi, y.lo) < 0) return "lower";
  if (cmpD(x.lo, y.hi) > 0) return "higher";
  if (x.precision === "exact" && y.precision === "exact") return "equal";
  return undetermined(word("calc-grammar.figures_readings_overlap"));
}

/**
 * The stated value of a non-range figure, as a decimal, for ordering (R12); `null` for a range.
 * @param {Figure} f a figure `figureFault` passes
 * @returns {Dec|null}
 */
export const statedValue = (f) => (f.precision === "range" ? null : /** @type {Dec} */ (readFigure(f).value));
