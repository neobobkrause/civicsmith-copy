/* calc-grammar at its interface: exact decimal arithmetic (R4, R5), exactness against a decimal reference (R19), and
 * the kinds of no (R20). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { add, subtract, multiply, divide, round, MODES } from "../../../src/calc-grammar/index.mjs";
import { isRefusal, isUndetermined } from "../../../src/calc-grammar/decimal.mjs";
/** @import { Figure, Refusal, Undetermined, Rounding } from "../../../src/calc-grammar/decimal.mjs" */

/** @param {string} s @param {{ currency?: string, unit?: string }} [extra] @returns {Figure} */
const fig = (s, extra = {}) => {
  const neg = s.startsWith("-");
  /** @type {Figure} */
  const f = { value: neg ? s.slice(1) : s, sign: neg ? "-" : "+", precision: "exact" };
  const currency = extra.currency; const unit = extra.unit;
  if (currency !== undefined) f.currency = currency;
  if (unit !== undefined) f.unit = unit;
  return f;
};
/* The result read as a figure; any other answer fails the test, as reading a figure's members from it did. */
/** @param {Figure | Refusal | Undetermined} x @returns {Figure} */
const asFigure = (x) => {
  if (isRefusal(x) || isUndetermined(x)) assert.fail(`expected a figure, got ${JSON.stringify(x)}`);
  return x;
};
/** @param {Figure | Refusal | Undetermined} x @returns {Refusal} */
const asRefusal = (x) => {
  if (!isRefusal(x)) assert.fail(`expected a refusal, got ${JSON.stringify(x)}`);
  return x;
};
/** @param {Figure | Refusal | Undetermined} x @returns {Undetermined} */
const asUndetermined = (x) => {
  if (!isUndetermined(x)) assert.fail(`expected undetermined, got ${JSON.stringify(x)}`);
  return x;
};
/* The refusal's code, or undefined for any other answer (what reading `.refused` gave). */
/** @param {Figure | Refusal | Undetermined} x @returns {string | undefined} */
const refusedOf = (x) => (isRefusal(x) ? x.refused : undefined);
/** @param {Figure | Refusal | Undetermined} x @returns {string | undefined} */
const whyOf = (x) => (isRefusal(x) || isUndetermined(x) ? x.why : undefined);
/** @param {Figure | Refusal | Undetermined} x @returns {string} */
const signed = (x) => {
  const f = asFigure(x);
  const value = f.value;
  if (value === undefined) assert.fail(`expected a figure with a value, got ${JSON.stringify(f)}`);
  return f.sign === "-" ? `-${value}` : value;
};

/* An independent oracle: a rational p/q (BigInt) rounded to `places` by the mode's definition. */
/** @param {bigint} p @param {bigint} q @param {number} places @param {string} mode @returns {[bigint, boolean]} */
function oracle(p, q, places, mode) {
  if (q < 0n) { p = -p; q = -q; }
  const scaled = p * 10n ** BigInt(places);
  const fl = scaled >= 0n ? scaled / q : -((-scaled + q - 1n) / q); // floor
  const exact = fl * q === scaled;
  if (exact) return [fl, true];
  const ce = fl + 1n;
  const dLo = scaled - fl * q; const dHi = ce * q - scaled; // distances, times q
  const neg = scaled < 0n;
  const towardZero = neg ? ce : fl; const away = neg ? fl : ce;
  /** @type {bigint} */
  let r;
  if (mode === "down") r = towardZero;
  else if (mode === "up") r = away;
  else if (dLo !== dHi) r = dLo < dHi ? fl : ce;
  else r = mode === "half_up" ? away : (fl % 2n === 0n ? fl : ce);
  return [r, false];
}
/** @param {bigint} n @param {number} places @returns {string} */
const asDecimal = (n, places) => {
  const neg = n < 0n; let d = (neg ? -n : n).toString().padStart(places + 1, "0");
  if (places) d = `${d.slice(0, -places)}.${d.slice(-places)}`;
  return neg && /[1-9]/.exec(d) !== null ? `-${d}` : d;
};

test("R4 add, subtract and multiply are exact (0.1 + 0.2 is 0.3), over every pair of a grid of signed decimals", () => {
  assert.equal(asFigure(add(fig("0.1"), fig("0.2"))).value, "0.3");
  const grid = ["0", "0.1", "0.2", "-0.3", "1.005", "-12.75", "99999999999999999999.99", "0.0000000001", "-7"];
  /** @param {string} s @returns {[bigint, number]} */
  const big = (s) => { const [i = "", f = ""] = s.replace("-", "").split("."); return [BigInt(i + f) * (s.startsWith("-") ? -1n : 1n), f.length]; };
  for (const a of grid) for (const b of grid) {
    const [x, xs] = big(a); const [y, ys] = big(b); const s = Math.max(xs, ys);
    const X = x * 10n ** BigInt(s - xs); const Y = y * 10n ** BigInt(s - ys);
    assert.equal(signed(add(fig(a), fig(b))), asDecimal(X + Y, s), `${a}+${b}`);
    assert.equal(signed(subtract(fig(a), fig(b))), asDecimal(X - Y, s), `${a}-${b}`);
    assert.equal(signed(multiply(fig(a), fig(b))), asDecimal(x * y, xs + ys), `${a}*${b}`);
    for (const op of [add, subtract, multiply]) assert.equal(asFigure(op(fig(a), fig(b))).precision, "exact");
  }
});

test("R4 divide and round give the stated places under each mode, exactly by the mode's definition; a missing mode is ROUNDING_UNSTATED; a rounded result says so unless exact", () => {
  const divisors = [1n, 2n, 3n, -3n, 4n, 7n, 8n, 10n, -16n];
  for (const mode of MODES) for (let n = -60n; n <= 60n; n++) for (const d of divisors) for (const places of [0, 1, 2]) {
    const a = asDecimal(n, 1); const [want, exact] = oracle(n, d * 10n, places, mode);
    const r = divide(fig(a), fig(String(d)), { places, mode });
    assert.equal(signed(r), asDecimal(want, places), `${a}/${d} ${mode} ${places}`);
    assert.equal(asFigure(r).precision, exact ? "exact" : "rounded", `${a}/${d} ${mode} ${places}`);
  }
  for (const mode of MODES) for (let n = -999n; n <= 999n; n += 7n) for (const places of [0, 1, 2]) {
    const a = asDecimal(n, 3); const [want, exact] = oracle(n, 1000n, places, mode);
    const r = round(fig(a), { places, mode });
    assert.equal(signed(r), asDecimal(want, places), `round ${a} ${mode} ${places}`);
    assert.equal(asFigure(r).precision, exact ? "exact" : "rounded");
  }
  /** @type {(Rounding | undefined)[]} */
  const unstated = [undefined, {}, { places: 2 }, { mode: "half_even" }, { places: 2, mode: "bankers" }, { places: -1, mode: "up" }, { places: 1.5, mode: "up" }];
  for (const opts of unstated) {
    assert.equal(refusedOf(divide(fig("1"), fig("3"), opts)), "ROUNDING_UNSTATED", JSON.stringify(opts));
    assert.equal(refusedOf(round(fig("1.25"), opts)), "ROUNDING_UNSTATED", JSON.stringify(opts));
  }
  const approx = fig("1.25"); approx.precision = "approximate";
  assert.equal(asFigure(round(approx, { places: 1, mode: "half_up" })).precision, "approximate");
});

test("R4 R20 division by zero is undetermined, never zero or infinity", () => {
  for (const z of ["0", "0.00", "-0"]) {
    const r = divide(fig("5"), fig(z), { places: 2, mode: "half_even" });
    assert.equal(asUndetermined(r).undetermined, true); assert.match(asUndetermined(r).why, /zero/); const u = asUndetermined(r); assert.equal("value" in u ? u.value : undefined, undefined);
  }
  const r = divide(fig("5"), { low: "-1", high: "1", sign: "-", precision: "range" }, { places: 2, mode: "up" });
  assert.equal(asUndetermined(r).undetermined, true); assert.match(asUndetermined(r).why, /zero/);
});

test("R5 different currencies, or different units where the operation needs one, are refused UNIT_MISMATCH naming both", () => {
  const usd = fig("10", { currency: "USD" }); const eur = fig("10", { currency: "EUR" });
  const pct = fig("10", { unit: "percent" }); const bare = fig("10"); const fte = fig("2", { unit: "FTE" });
  /** @type {[Figure, Figure][]} */
  const pairs = [[usd, eur], [usd, bare], [pct, bare], [usd, pct], [fte, pct]];
  for (const [a, b] of pairs) for (const op of [add, subtract]) {
    const r = op(a, b);
    assert.equal(refusedOf(r), "UNIT_MISMATCH");
    const why = asRefusal(r).why;
    for (const x of [a, b]) {
      const currency = x.currency; const unit = x.unit;
      assert.ok(why.includes(currency ? `currency ${currency}` : unit ? `unit ${unit}` : "no unit or currency"), why);
    }
  }
  assert.equal(refusedOf(multiply(usd, eur)), "UNIT_MISMATCH");
  assert.equal(refusedOf(multiply(usd, pct)), "UNIT_MISMATCH");
  assert.deepEqual(multiply(usd, fig("3")), fig("30", { currency: "USD" }));
  assert.equal(refusedOf(divide(bare, usd, { places: 0, mode: "down" })), "UNIT_MISMATCH");
  assert.equal(refusedOf(divide(eur, usd, { places: 0, mode: "down" })), "UNIT_MISMATCH");
  assert.deepEqual(divide(usd, fig("4"), { places: 1, mode: "down" }), fig("2.5", { currency: "USD" }));
  assert.deepEqual(divide(usd, fig("4", { currency: "USD" }), { places: 1, mode: "down" }), fig("2.5"));
  assert.equal(asFigure(add(usd, fig("5", { currency: "USD" }))).currency, "USD");
});

test("R5 an approximate operand makes the result approximate; a range operand makes the result a range bounding every reading", () => {
  const approx = fig("100"); approx.precision = "approximate";
  for (const r of [add(approx, fig("1")), subtract(fig("1"), approx), multiply(approx, fig("2")), divide(approx, fig("3"), { places: 2, mode: "half_even" })])
    assert.equal(asFigure(r).precision, "approximate");
  const rounded = fig("1"); rounded.precision = "rounded";
  assert.equal(asFigure(add(rounded, fig("1"))).precision, "rounded");
  /** @param {string} lo @param {string} hi @returns {Figure} */
  const R = (lo, hi) => ({ low: lo, high: hi, sign: lo.startsWith("-") ? "-" : "+", precision: "range" });
  const ranges = [R("-3", "2"), R("1", "4"), R("-5", "-2"), R("0.5", "0.75")];
  /** @param {Figure} r @returns {number[]} */
  const points = (r) => {
    /** @type {number[]} */
    const out = []; const lo = Number(r.low); const hi = Number(r.high); for (let k = 0; k <= 8; k++) out.push(lo + ((hi - lo) * k) / 8); return out; };
  /** @type {Figure[]} */
  const operands = [...ranges, fig("3"), fig("-2")];
  for (const a of ranges) for (const b of operands) {
    const bp = b.precision === "range" ? points(b) : [Number(signed(b))];
    /** @type {[Figure | Refusal | Undetermined, (x: number, y: number) => number][]} */
    const cases = [[add(a, b), (x, y) => x + y], [subtract(a, b), (x, y) => x - y], [multiply(a, b), (x, y) => x * y]];
    if (!(bp.some((y) => y <= 0) && bp.some((y) => y >= 0))) cases.push([divide(a, b, { places: 3, mode: "half_even" }), (x, y) => x / y]);
    for (const [result, f] of cases) {
      const r = asFigure(result);
      assert.equal(r.precision, "range");
      for (const x of points(a)) for (const y of bp) {
        const v = f(x, y);
        assert.ok(Number(r.low) <= v + 1e-9 && v - 1e-9 <= Number(r.high), `${JSON.stringify(a)} ${JSON.stringify(b)}: ${v} outside [${r.low}, ${r.high}]`);
      }
    }
  }
  const third = asFigure(divide(R("1", "2"), fig("3"), { places: 2, mode: "half_even" }));
  assert.deepEqual([third.low, third.high], ["0.33", "0.67"]);
  const rr = asFigure(round(R("1.234", "1.236"), { places: 2, mode: "half_even" }));
  assert.deepEqual([rr.low, rr.high], ["1.23", "1.24"]);
});

test("R19 exact: 10,000 two-decimal figures summed with no difference from a decimal reference", () => {
  /** @type {Figure | Refusal} */
  let acc = fig("0"); let cents = 0n; let seed = 12345;
  for (let i = 0; i < 10000; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const c = BigInt(seed % 20000000) - 10000000n;
    const s = asDecimal(c, 2);
    acc = add(acc, fig(s));
    cents += c;
  }
  assert.equal(signed(acc), asDecimal(cents, 2));
  const sum = acc;
  assert.equal(asFigure(sum).precision, "exact");
});

test("R20 every refusal names its kind and why; an invalid figure is refused, and a wrong JavaScript type is a TypeError", () => {
  for (const bad of [{ value: "1e5", sign: "+", precision: "exact" }, { value: "-1", sign: "+", precision: "exact" },
    { value: "1", sign: "*", precision: "exact" }, { value: "1", sign: "+", precision: "guess" },
    { low: "2", high: "1", sign: "+", precision: "range" }, { value: 1, sign: "+", precision: "exact" }]) {
    const r = add(bad, fig("1"));
    assert.equal(refusedOf(r), "FIGURE_INVALID"); assert.ok(whyOf(r));
  }
  for (const op of [add, subtract, multiply]) assert.throws(() => op(1, fig("1")), TypeError);
  assert.throws(() => divide(fig("1"), fig("1"), 5), TypeError);
});
