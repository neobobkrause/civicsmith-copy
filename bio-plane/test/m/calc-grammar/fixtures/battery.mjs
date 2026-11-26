/* Every service of calc-grammar exercised once over fixed arguments; the invariants test runs it in a locked-down
   process and compares the answers with an ordinary run. */
/** @import * as Calc from "../../../../src/calc-grammar/index.mjs" */
/** @import { Figure } from "../../../../src/calc-grammar/decimal.mjs" */
/** @import { Data } from "../../../../src/calc-grammar/tables.mjs" */

/** Every service's answers, by name. @typedef {{ [name: string]: Data }} Answers */

/** @param {typeof Calc} c @returns {Answers} */
export function battery(c) {
  /** @param {string} v @returns {Figure} */
  const fig = (v) => ({ value: v, sign: "+", precision: "exact" });
  const t = { fields: [{ name: "k", type: "string" }, { name: "v", type: "number" }, { name: "d", type: "date" }, { name: "e", type: "date" }],
    rows: [{ k: "a", v: "1.10", d: "2024-01-01", e: "2024-01-09" }, { k: "b", v: "(2)", d: "2024-02-01", e: "2024-02-02" }, { k: "a", v: "", d: "", e: "2024-01-01" }] };
  const u = { fields: [{ name: "w", type: "string" }], rows: [{ w: "A" }, { w: "B" }] };
  const steps = [
    { op: "select", as: "s", from: "t", where: [{ field: "d", test: "ge", value: "2024-01-01" }, { field: "k", test: "in", value: ["a", "b"] }] },
    { op: "count", as: "c", from: "s" }, { op: "sum", as: "z", from: "s", field: "v" }, { op: "difference", as: "df", a: "c", b: "x" },
    { op: "ratio", as: "r", numerator: "c", denominator: "x" }, { op: "share", as: "sh", part: "s", whole: "t" },
    { op: "group", as: "g", from: "t", by: ["k"], measure: { op: "count" } }, { op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" },
    { op: "compare", as: "cm", a: "c", b: "x" }, { op: "round", as: "rd", of: "r", places: 2, mode: "half_up" },
    { op: "join", as: "j", left: "t", right: "u", on: { left: "k", right: "w" }, space: "letters" }, { op: "sort", as: "o", from: "t", by: "d", order: "desc" },
  ];
  /** @type {Answers} */
  const out = {};
  for (const st of steps) {
    const rec = { method: c.METHOD, inputs: [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "x", kind: "figure" }], steps, output: st.as };
    out[st.as] = c.evaluate(rec, { t, u, x: fig("3") }, { resolveId: (_s, v) => String(v).toUpperCase() });
    out[`key-${st.as}`] = c.resultKey(rec, { t: "0".repeat(64) });
  }
  out.figures = ["$4.2 million", "(1,234.50)", "about 5%", "4-5 bn", "-(5)"].map(c.parseFigure);
  out.arith = [c.add(fig("0.1"), fig("0.2")), c.subtract(fig("1"), fig("3")), c.multiply(fig("1.5"), fig("1.5")),
    c.divide(fig("2"), fig("3"), { places: 5, mode: "half_even" }), c.round(fig("2.5"), { places: 0, mode: "half_even" })];
  out.draw = c.draw({ frame: ["a", "b", "c", "d", "e"], n: 3, seed: "s" });
  out.interval = c.interval({ frame_size: 200, sample_size: 30, successes: 6, confidence: "0.95" });
  out.check = c.checkRecipe({ method: "bio-calc/1", inputs: [], steps: [{ op: "eval", as: "e" }], output: "e" });
  return out;
}
