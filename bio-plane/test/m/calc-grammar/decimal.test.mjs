/* calc-grammar at its interface: exact decimal arithmetic (R4, R5), exactness against a decimal reference (R19), and
 * the kinds of no (R20). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { add, subtract, multiply, divide, round, MODES } from "../../../src/calc-grammar/index.mjs";

const fig = (s, extra = {}) => (s.startsWith("-") ? { value: s.slice(1), sign: "-", precision: "exact", ...extra }
  : { value: s, sign: "+", precision: "exact", ...extra });
const signed = (f) => (f.sign === "-" ? `-${f.value}` : f.value);

/* An independent oracle: a rational p/q (BigInt) rounded to `places` by the mode's definition. */
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
  let r;
  if (mode === "down") r = towardZero;
  else if (mode === "up") r = away;
  else if (dLo !== dHi) r = dLo < dHi ? fl : ce;
  else r = mode === "half_up" ? away : (fl % 2n === 0n ? fl : ce);
  return [r, false];
}
const asDecimal = (n, places) => {
  const neg = n < 0n; let d = (neg ? -n : n).toString().padStart(places + 1, "0");
  if (places) d = `${d.slice(0, -places)}.${d.slice(-places)}`;
  return neg && /[1-9]/.test(d) ? `-${d}` : d;
};

test("R4 add, subtract and multiply are exact (0.1 + 0.2 is 0.3), over every pair of a grid of signed decimals", () => {
  assert.equal(add(fig("0.1"), fig("0.2")).value, "0.3");
  const grid = ["0", "0.1", "0.2", "-0.3", "1.005", "-12.75", "99999999999999999999.99", "0.0000000001", "-7"];
  const big = (s) => { const [i, f = ""] = s.replace("-", "").split("."); return [BigInt(i + f) * (s.startsWith("-") ? -1n : 1n), f.length]; };
  for (const a of grid) for (const b of grid) {
    const [x, xs] = big(a); const [y, ys] = big(b); const s = Math.max(xs, ys);
    const X = x * 10n ** BigInt(s - xs); const Y = y * 10n ** BigInt(s - ys);
    assert.equal(signed(add(fig(a), fig(b))), asDecimal(X + Y, s), `${a}+${b}`);
    assert.equal(signed(subtract(fig(a), fig(b))), asDecimal(X - Y, s), `${a}-${b}`);
    assert.equal(signed(multiply(fig(a), fig(b))), asDecimal(x * y, xs + ys), `${a}*${b}`);
    for (const op of [add, subtract, multiply]) assert.equal(op(fig(a), fig(b)).precision, "exact");
  }
});

test("R4 divide and round give the stated places under each mode, exactly by the mode's definition; a missing mode is ROUNDING_UNSTATED; a rounded result says so unless exact", () => {
  const divisors = [1n, 2n, 3n, -3n, 4n, 7n, 8n, 10n, -16n];
  for (const mode of MODES) for (let n = -60n; n <= 60n; n++) for (const d of divisors) for (const places of [0, 1, 2]) {
    const a = asDecimal(n, 1); const [want, exact] = oracle(n, d * 10n, places, mode);
    const r = divide(fig(a), fig(String(d)), { places, mode });
    assert.equal(signed(r), asDecimal(want, places), `${a}/${d} ${mode} ${places}`);
    assert.equal(r.precision, exact ? "exact" : "rounded", `${a}/${d} ${mode} ${places}`);
  }
  for (const mode of MODES) for (let n = -999n; n <= 999n; n += 7n) for (const places of [0, 1, 2]) {
    const a = asDecimal(n, 3); const [want, exact] = oracle(n, 1000n, places, mode);
    const r = round(fig(a), { places, mode });
    assert.equal(signed(r), asDecimal(want, places), `round ${a} ${mode} ${places}`);
    assert.equal(r.precision, exact ? "exact" : "rounded");
  }
  for (const opts of [undefined, {}, { places: 2 }, { mode: "half_even" }, { places: 2, mode: "bankers" }, { places: -1, mode: "up" }, { places: 1.5, mode: "up" }]) {
    assert.equal(divide(fig("1"), fig("3"), opts).refused, "ROUNDING_UNSTATED", JSON.stringify(opts));
    assert.equal(round(fig("1.25"), opts).refused, "ROUNDING_UNSTATED", JSON.stringify(opts));
  }
  assert.equal(round({ ...fig("1.25"), precision: "approximate" }, { places: 1, mode: "half_up" }).precision, "approximate");
});

test("R4 R20 division by zero is undetermined, never zero or infinity", () => {
  for (const z of ["0", "0.00", "-0"]) {
    const r = divide(fig("5"), fig(z), { places: 2, mode: "half_even" });
    assert.equal(r.undetermined, true); assert.match(r.why, /zero/); assert.equal(r.value, undefined);
  }
  const r = divide(fig("5"), { low: "-1", high: "1", sign: "-", precision: "range" }, { places: 2, mode: "up" });
  assert.equal(r.undetermined, true); assert.match(r.why, /zero/);
});

test("R5 different currencies, or different units where the operation needs one, are refused UNIT_MISMATCH naming both", () => {
  const usd = fig("10", { currency: "USD" }); const eur = fig("10", { currency: "EUR" });
  const pct = fig("10", { unit: "percent" }); const bare = fig("10"); const fte = fig("2", { unit: "FTE" });
  for (const [a, b] of [[usd, eur], [usd, bare], [pct, bare], [usd, pct], [fte, pct]]) for (const op of [add, subtract]) {
    const r = op(a, b);
    assert.equal(r.refused, "UNIT_MISMATCH");
    for (const x of [a, b]) assert.ok(r.why.includes(x.currency ? `currency ${x.currency}` : x.unit ? `unit ${x.unit}` : "no unit or currency"), r.why);
  }
  assert.equal(multiply(usd, eur).refused, "UNIT_MISMATCH");
  assert.equal(multiply(usd, pct).refused, "UNIT_MISMATCH");
  assert.deepEqual(multiply(usd, fig("3")), fig("30", { currency: "USD" }));
  assert.equal(divide(bare, usd, { places: 0, mode: "down" }).refused, "UNIT_MISMATCH");
  assert.equal(divide(eur, usd, { places: 0, mode: "down" }).refused, "UNIT_MISMATCH");
  assert.deepEqual(divide(usd, fig("4"), { places: 1, mode: "down" }), fig("2.5", { currency: "USD" }));
  assert.deepEqual(divide(usd, fig("4", { currency: "USD" }), { places: 1, mode: "down" }), fig("2.5"));
  assert.equal(add(usd, fig("5", { currency: "USD" })).currency, "USD");
});

test("R5 an approximate operand makes the result approximate; a range operand makes the result a range bounding every reading", () => {
  const approx = { ...fig("100"), precision: "approximate" };
  for (const r of [add(approx, fig("1")), subtract(fig("1"), approx), multiply(approx, fig("2")), divide(approx, fig("3"), { places: 2, mode: "half_even" })])
    assert.equal(r.precision, "approximate");
  assert.equal(add({ ...fig("1"), precision: "rounded" }, fig("1")).precision, "rounded");
  const R = (lo, hi) => ({ low: lo, high: hi, sign: lo.startsWith("-") ? "-" : "+", precision: "range" });
  const ranges = [R("-3", "2"), R("1", "4"), R("-5", "-2"), R("0.5", "0.75")];
  const points = (r) => { const out = []; const lo = Number(r.low); const hi = Number(r.high); for (let k = 0; k <= 8; k++) out.push(lo + ((hi - lo) * k) / 8); return out; };
  for (const a of ranges) for (const b of [...ranges, fig("3"), fig("-2")]) {
    const bp = b.precision === "range" ? points(b) : [Number(signed(b))];
    const cases = [[add(a, b), (x, y) => x + y], [subtract(a, b), (x, y) => x - y], [multiply(a, b), (x, y) => x * y]];
    if (!(bp.some((y) => y <= 0) && bp.some((y) => y >= 0))) cases.push([divide(a, b, { places: 3, mode: "half_even" }), (x, y) => x / y]);
    for (const [r, f] of cases) {
      assert.equal(r.precision, "range");
      for (const x of points(a)) for (const y of bp) {
        const v = f(x, y);
        assert.ok(Number(r.low) <= v + 1e-9 && v - 1e-9 <= Number(r.high), `${JSON.stringify(a)} ${JSON.stringify(b)}: ${v} outside [${r.low}, ${r.high}]`);
      }
    }
  }
  const third = divide(R("1", "2"), fig("3"), { places: 2, mode: "half_even" });
  assert.deepEqual([third.low, third.high], ["0.33", "0.67"]);
  const rr = round(R("1.234", "1.236"), { places: 2, mode: "half_even" });
  assert.deepEqual([rr.low, rr.high], ["1.23", "1.24"]);
});

test("R19 exact: 10,000 two-decimal figures summed with no difference from a decimal reference", () => {
  let acc = fig("0"); let cents = 0n; let seed = 12345;
  for (let i = 0; i < 10000; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const c = BigInt(seed % 20000000) - 10000000n;
    const s = asDecimal(c, 2);
    acc = add(acc, fig(s));
    cents += c;
  }
  assert.equal(signed(acc), asDecimal(cents, 2));
  assert.equal(acc.precision, "exact");
});

test("R20 every refusal names its kind and why; an invalid figure is refused, and a wrong JavaScript type is a TypeError", () => {
  for (const bad of [{ value: "1e5", sign: "+", precision: "exact" }, { value: "-1", sign: "+", precision: "exact" },
    { value: "1", sign: "*", precision: "exact" }, { value: "1", sign: "+", precision: "guess" },
    { low: "2", high: "1", sign: "+", precision: "range" }, { value: 1, sign: "+", precision: "exact" }]) {
    const r = add(bad, fig("1"));
    assert.equal(r.refused, "FIGURE_INVALID"); assert.ok(r.why);
  }
  for (const op of [add, subtract, multiply]) assert.throws(() => op(1, fig("1")), TypeError);
  assert.throws(() => divide(fig("1"), fig("1"), 5), TypeError);
});
