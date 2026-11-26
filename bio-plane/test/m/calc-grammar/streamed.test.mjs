/* calc-grammar at its interface: `relate` from the index (R21) and the streamed table (R22). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as calc from "../../../src/calc-grammar/index.mjs";
import { isObject, isRefusal, isUndetermined } from "../../../src/calc-grammar/decimal.mjs";
import { bothWays, streamed, asObjects } from "./fixtures/stream.mjs";
import { FIELDS, rowAt, table, RECIPES, recipeOf, resolveId, recipeSteps, lastAs } from "./fixtures/heap.mjs";

/** @import { Figure, Precision, Refusal, Relation, Undetermined } from "../../../src/calc-grammar/decimal.mjs" */
/** @import { Data, Members, Field, TableAnswer } from "../../../src/calc-grammar/tables.mjs" */
/** @import { Evaluation, EvalRefusal, EvalOptions, RecipeInput, TraceLine, Step, Ratio, Comparison } from "../../../src/calc-grammar/recipe.mjs" */
/** @import { ObjectTable, Answer } from "./fixtures/stream.mjs" */
/** @import { Measure } from "./fixtures/heap.mjs" */

const { relate, evaluate, METHOD, OPS } = calc;
/** @param {string} s @param {{ unit?: string, currency?: string }} [extra] @returns {Figure} */
const fig = (s, extra = {}) => {
  /** @type {Figure} */
  const f = { value: s.startsWith("-") ? s.slice(1) : s, sign: s.startsWith("-") ? "-" : "+", precision: "exact" };
  const { unit, currency } = extra;
  if (unit !== undefined) f.unit = unit;
  if (currency !== undefined) f.currency = currency;
  return f;
};
/** An exact figure given another precision. @param {string} s @param {Precision} precision @returns {Figure} */
const figAs = (s, precision) => { const f = fig(s); f.precision = precision; return f; };

/* What a test expects of an answer; anything else fails, as reading the member it lacks would. */
/** @param {Answer} a @returns {Evaluation} */
const asEvaluation = (a) => ("result" in a ? a : assert.fail(`not an evaluation: ${JSON.stringify(a)}`));
/** @param {Answer} a @param {string} [message] @returns {EvalRefusal | Refusal} */
const asRefused = (a, message) => ("refused" in a ? a : assert.fail(message ?? `not a refusal: ${JSON.stringify(a)}`));
/** @param {Figure | Ratio | Comparison | TableAnswer | Undetermined} r @returns {TableAnswer} */
const asTable = (r) => ("fields" in r ? r : assert.fail(`not a table: ${JSON.stringify(r)}`));
/** @param {Relation | Undetermined | Refusal} r @param {string} message @returns {Undetermined} */
const asUndetermined = (r, message) => (isUndetermined(r) ? r : assert.fail(message));
/** @param {Relation | Undetermined | Refusal} r @returns {Refusal} */
const asRefusal = (r) => (isRefusal(r) ? r : assert.fail(`not a refusal: ${JSON.stringify(r)}`));
/* An answer's member, as reading it off the answer gives it. */
/** @param {Answer} a @returns {string | undefined} */
const refusedOf = (a) => ("refused" in a ? a.refused : undefined);
/** @param {Answer} a @returns {string | undefined} */
const whyOf = (a) => ("why" in a ? a.why : undefined);
/** @param {Answer} a @returns {TraceLine[] | undefined} */
const traceOf = (a) => { if (!("trace" in a)) return undefined; const { trace } = a; return trace; };
/** @param {EvalRefusal | Refusal} r @returns {string | number | null | undefined} */
const stepOf = (r) => { if (!("step" in r)) return undefined; const { step } = r; return step; };
/** @param {unknown} x @param {string} name @returns {Data} */
const memberOf = (x, name) => (isObject(x) ? x[name] : undefined);

test("R21 relate is exported from the index: R10's relation of two figures, lower, equal, higher or undetermined with why; UNIT_MISMATCH naming both", () => {
  assert.equal(typeof relate, "function");
  /** @param {string} lo @param {string} hi @returns {Figure} */
  const R = (lo, hi) => {
    /** @type {Figure} */
    const f = { low: lo, high: hi, sign: lo.startsWith("-") ? "-" : "+", precision: "range" };
    return f;
  };
  /** @param {string} v @returns {Figure} */
  const rounded = (v) => figAs(v, "rounded");
  /** @type {[Figure, Figure, Relation][]} */
  const settled = [
    [fig("1"), fig("2"), "lower"], [fig("2"), fig("1"), "higher"], [fig("2.0"), fig("2"), "equal"], [fig("-3"), fig("-3.00"), "equal"],
    [fig("-3"), fig("2"), "lower"], [fig("0"), fig("-0.01"), "higher"],
    [rounded("4200000"), fig("4300000"), "lower"], [rounded("4200000"), fig("4100000"), "higher"],
    [R("1", "3"), fig("4"), "lower"], [R("1", "3"), fig("0.5"), "higher"], [R("1", "3"), R("3.5", "9"), "lower"],
    [fig("5", { currency: "USD" }), fig("7", { currency: "USD" }), "lower"], [fig("5", { unit: "percent" }), fig("5", { unit: "percent" }), "equal"],
  ];
  for (const [a, b, want] of settled) assert.equal(relate(a, b), want, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
  /** @type {[Figure, Figure][]} */
  const unsettled = [[rounded("4200000"), fig("4210000")], [rounded("4200000"), rounded("4200000")], [figAs("5", "approximate"), fig("100")],
    [R("1", "3"), fig("2")], [R("1", "3"), R("3", "4")], [fig("2"), rounded("2")]];
  for (const [a, b] of unsettled) {
    const r = asUndetermined(relate(a, b), JSON.stringify([a, b]));
    assert.equal(r.undetermined, true, JSON.stringify([a, b])); assert.ok(r.why.length > 0);
  }
  /** @type {[Figure, Figure, string[]][]} */
  const mismatched = [[fig("1", { currency: "USD" }), fig("1", { currency: "EUR" }), ["currency USD", "currency EUR"]],
    [fig("1", { currency: "USD" }), fig("1"), ["currency USD", "no unit or currency"]], [fig("1", { unit: "percent" }), fig("1", { unit: "FTE" }), ["unit percent", "unit FTE"]]];
  for (const [a, b, names] of mismatched) {
    const r = asRefusal(relate(a, b));
    assert.equal(r.refused, "UNIT_MISMATCH");
    for (const n of names) assert.ok(r.why.includes(n), r.why);
  }
  assert.equal(asRefusal(relate({ value: "1e3", sign: "+", precision: "exact" }, fig("1"))).refused, "FIGURE_INVALID");
  assert.throws(() => relate(1, fig("1")), TypeError);
  // The relation compare (R10) labels is relate's.
  const cmp = evaluate({ method: METHOD, inputs: [{ name: "a", kind: "figure" }, { name: "b", kind: "figure" }], steps: [{ op: "compare", as: "c", a: "a", b: "b" }], output: "c" },
    { a: rounded("4200000"), b: fig("4300000") });
  assert.deepEqual(asEvaluation(cmp).result, { relation: relate(rounded("4200000"), fig("4300000")), label: "computed fact" });
});

/* A table with every kind of cell an evaluation reads: undetermined ones, figures as objects, dates, a SUM_RULE field. */
/** @type {ObjectTable} */
const T = {
  fields: [{ name: "name", type: "string" }, { name: "n", type: "number", currency: "USD" }, { name: "i", type: "integer" },
    { name: "d", type: "date" }, { name: "e", type: "date" }, { name: "ok", type: "boolean" }, { name: "period", type: "string" }],
  rows: [
    { name: "a", n: "10.50", i: "1", d: "2024-01-01", e: "2024-01-31", ok: "true", period: "FY24" },
    { name: "b", n: "(2.25)", i: "2", d: "2024-02-15", e: "2024-03-01", ok: false, period: "FY24" },
    { name: "a", n: "", i: "x", d: "", e: "2024-02-01", ok: "maybe", period: "FY24" },
    { name: "c", n: "about 7", i: "4", d: "2024-03-01", e: "2024-03-01", ok: true, period: "FY24" },
    { name: "", n: 3, i: 3, d: "2024-01-15", e: "2024-01-20", ok: "false", period: "FY24" },
    { name: "d", n: { value: "1.5", sign: "+", precision: "exact" }, i: "1", d: "2024-13-45", e: "2024-01-01", ok: true, period: "FY24" },
    { name: "b", n: "$4", i: "4", d: "2024-02-20", e: "2023-12-01", ok: true, period: "FY24" },
  ],
};
/** @type {ObjectTable} */
const U = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "A", role: "clerk" }, { who: "B", role: "mayor" }, { who: "", role: "x" }, { who: "a", role: "deputy" }] };
/** @type {ObjectTable} */
const CW = { fields: [{ name: "l", type: "string" }, { name: "r", type: "string" }], rows: [{ l: "a", r: "A" }, { l: "b", r: "B" }, { l: "b", r: "a" }, { l: "c", r: "" }] };
/** @type {ObjectTable} */
const P = { fields: [{ name: "v", type: "number" }, { name: "period", type: "string" }], rows: [{ v: "1", period: "FY24" }, { v: "$2", period: "FY25" }] };
/** @type {RecipeInput[]} */
const inputs = [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "cw", kind: "table" }, { name: "p", kind: "table" }, { name: "x", kind: "figure" }];
/** @type {Step} */
const sel = { op: "select", as: "s", from: "t", where: [{ field: "n", test: "ge", value: "0" }] };
/** @type {{ [name: string]: Step[] }} */
const CASES = {
  select: [sel],
  "select, several conditions": [{ op: "select", as: "s", from: "t", where: [{ field: "d", test: "between", value: ["2024-01-01", "2024-02-28"] }, { field: "name", test: "in", value: ["a", "b", ""] }] }],
  count: [sel, { op: "count", as: "c", from: "s" }],
  sum: [{ op: "sum", as: "z", from: "t", field: "i" }],
  "sum, undetermined": [{ op: "sum", as: "z", from: "t", field: "n" }],
  "sum, refused by a period": [{ op: "select", as: "s", from: "p", where: [{ field: "v", test: "ge", value: 0 }] }, { op: "sum", as: "z", from: "s", field: "v" }],
  difference: [{ op: "sum", as: "z", from: "t", field: "i" }, { op: "difference", as: "df", a: "z", b: "x" }],
  ratio: [{ op: "count", as: "c", from: "t" }, { op: "ratio", as: "r", numerator: "x", denominator: "c" }],
  share: [sel, { op: "share", as: "sh", part: "s", whole: "t" }],
  "share of a field": [{ op: "select", as: "s", from: "t", where: [{ field: "ok", test: "eq", value: true }] }, { op: "share", as: "sh", part: "s", whole: "t", field: "i", places: 3, mode: "up" }],
  "group, count": [{ op: "group", as: "g", from: "t", by: ["name"], measure: { op: "count" } }],
  "group, sum": [{ op: "group", as: "g", from: "t", by: ["name", "period"], measure: { op: "sum", field: "i" } }],
  "group, an undetermined sum": [{ op: "group", as: "g", from: "t", by: ["ok"], measure: { op: "sum", field: "n" } }],
  span: [{ op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" }],
  "span, then sort by it": [{ op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" }, { op: "sort", as: "o", from: "sp", by: "sp", order: "asc" }],
  compare: [{ op: "count", as: "c", from: "t" }, { op: "compare", as: "cm", a: "c", b: "x" }],
  round: [{ op: "count", as: "c", from: "t" }, { op: "ratio", as: "r", numerator: "x", denominator: "c" }, { op: "round", as: "rd", of: "r", places: 1, mode: "half_up" }],
  "join through a space": [{ op: "join", as: "j", left: "t", right: "u", on: { left: "name", right: "who" }, space: "letters" }],
  "join through a crosswalk": [{ op: "join", as: "j", left: "t", right: "u", on: { left: "name", right: "who" }, crosswalk: { input: "cw", left: "l", right: "r" } }],
  "join, then select, sort and group": [{ op: "join", as: "j", left: "t", right: "u", on: { left: "name", right: "who" }, space: "letters" },
    { op: "select", as: "s2", from: "j", where: [{ field: "u.role", test: "ne", value: "x" }] }, { op: "sort", as: "o", from: "s2", by: "i", order: "desc" },
    { op: "group", as: "g", from: "o", by: ["u.role"], measure: { op: "count" } }],
  "sort by a number": [{ op: "sort", as: "o", from: "t", by: "i", order: "desc" }],
  "sort by a date": [{ op: "sort", as: "o", from: "t", by: "d", order: "asc" }],
  "sort, refused by a currency": [{ op: "sort", as: "o", from: "p", by: "v", order: "asc" }],
  "an input as the output": [{ op: "count", as: "c", from: "t" }],
};
/** The tables and figure every case reads, and `bound` over them. @param {Members} bound @returns {Members} */
const withInputs = (bound) => {
  /** @type {Members} */
  const all = { t: T, u: U, cw: CW, p: P, x: fig("3") };
  for (const [k, v] of Object.entries(bound)) all[k] = v;
  return all;
};
/** The steps of the case named. @param {string} name @returns {Step[]} */
const caseSteps = (name) => CASES[name] ?? assert.fail(`no case ${name}`);
/** @param {Step[]} steps @param {string} [output] @param {Members} [bound] @param {EvalOptions} [opts] */
const run = (steps, output, bound = {}, opts = { resolveId: (_s, v) => String(v).toUpperCase() || null }) =>
  bothWays({ method: METHOD, inputs, steps, output: output ?? lastAs(steps) }, withInputs(bound), opts);

test("R22 over a streamed table evaluate answers exactly as over the same table bound as row objects: every op, alone and chained, its result, undetermined rows and trace", () => {
  /** @type {Set<string>} */
  const seen = new Set();
  for (const [name, steps] of Object.entries(CASES)) {
    const { objects, compared, streams } = run(steps, name === "an input as the output" ? "t" : undefined);
    assert.deepEqual(streams, compared, name);
    for (const st of steps) seen.add(st.op);
    if (name.includes("refused")) assert.ok(refusedOf(objects), name); else assert.ok(traceOf(objects), `${name}: ${refusedOf(objects)} ${whyOf(objects)}`);
  }
  assert.deepEqual([...seen].sort(), [...OPS].sort(), "every op of the grammar");
  // A table result over a streamed table is a streamed table: rows() answers a new iterator each call, over arrays in fields order.
  const s = evaluate({ method: METHOD, inputs, steps: caseSteps("span"), output: "sp" }, { t: streamed(T), u: streamed(U), cw: streamed(CW), p: P, x: fig("3") });
  const result = asTable(asEvaluation(s).result);
  const rows = result.rows;
  assert.equal(typeof rows, "function");
  if (typeof rows !== "function") return;
  const first = [...rows()]; const again = [...rows()];
  assert.deepEqual(first, again);
  assert.ok(first.every((r) => Array.isArray(r) && r.length === result.fields.length));
  // Bound one way and the other in one recipe: the same answer.
  const mixed = evaluate({ method: METHOD, inputs, steps: caseSteps("join through a crosswalk"), output: "j" }, { t: T, u: streamed(U), cw: CW, p: streamed(P), x: fig("3") });
  assert.deepEqual(asObjects(mixed), run(caseSteps("join through a crosswalk")).compared);
  // No resolver for the space: undetermined, as over row objects.
  const { streams, compared } = run(caseSteps("join through a space"), undefined, {}, {});
  assert.deepEqual(streams, compared); assert.equal(memberOf(asEvaluation(streams).result, "undetermined"), true);
});

test("R22 at scale: past a pass's read-ahead (several passes), sort, join and group answer as over row objects", () => {
  const n = 40_000;
  /** @type {ObjectTable} */
  const t = { fields: FIELDS, rows: Array.from({ length: n }, (_, i) => Object.fromEntries(FIELDS.map((f, k) => [f.name, rowAt(i)[k]]))) };
  /** @type {ObjectTable} */
  const u = { fields: [{ name: "id", type: "string" }, { name: "w", type: "integer" }], rows: Array.from({ length: n }, (_, i) => ({ id: `R-${(i * 7) % n}`, w: String(i) })) };
  /** @type {Step[][]} */
  const recipes = [recipeSteps("sort"), recipeSteps("select, sort, span, group"),
    [{ op: "sort", as: "o", from: "t", by: "amt", order: "asc" }, { op: "join", as: "j", left: "o", right: "u", on: { left: "id", right: "id" }, space: "row" }, { op: "sort", as: "o2", from: "j", by: "u.w", order: "desc" }]];
  for (const steps of recipes) {
    const { streams, compared } = bothWays({ method: METHOD, inputs: [{ name: "t", kind: "table" }, { name: "u", kind: "table" }], steps, output: lastAs(steps) }, { t, u }, { resolveId });
    assert.ok(!refusedOf(compared), whyOf(compared));
    assert.deepEqual(streams, compared, steps.map((s) => s.op).join(" "));
  }
});

test("R22 a malformed streamed table is refused INPUT_INVALID, as a malformed table is; so is one that reads another table on a later pass", () => {
  const rec = { method: METHOD, inputs: [{ name: "t", kind: "table" }], steps: [{ op: "count", as: "c", from: "t" }], output: "c" };
  const f = [{ name: "a", type: "string" }, { name: "b", type: "number" }];
  /** @type {[string, Data][]} */
  const malformed = [
    ["rows neither a list nor a function", { fields: f, rows: "a,b" }],
    ["rows answers no iterator", { fields: f, rows: () => 5 }],
    ["rows throws", { fields: f, rows: () => { throw new Error("gone"); } }],
    ["a row is an object", { fields: f, rows: () => [{ a: "x", b: "1" }][Symbol.iterator]() }],
    ["a row is short", { fields: f, rows: () => [["x"]][Symbol.iterator]() }],
    ["a row is long", { fields: f, rows: () => [["x", "1", "2"]][Symbol.iterator]() }],
    ["the iterator throws", { fields: f, rows: function* rows() { yield ["x", "1"]; throw new Error("broken stream"); } }],
    ["a field is malformed", { fields: [{ name: "a", type: "money" }], rows: () => [][Symbol.iterator]() }],
    ["a field is declared twice", { fields: [f[0], f[0]], rows: () => [][Symbol.iterator]() }],
  ];
  for (const [what, t] of malformed) {
    const r = asRefused(evaluate(rec, { t }), what);
    assert.equal(r.refused, "INPUT_INVALID", what); assert.ok(r.why.includes('"t"'), `${what}: ${r.why}`);
  }
  // Read again, a different table: refused at the step that read it, never answered from half a table.
  let pass = 0;
  const shifting = { fields: f, rows: () => { pass += 1; return Array.from({ length: pass === 1 ? 3 : 2 }, () => ["x", "1"])[Symbol.iterator](); } };
  const r = asRefused(evaluate({ ...rec, steps: [{ op: "sum", as: "z", from: "t", field: "b" }], output: "z" }, { t: shifting }));
  assert.equal(r.refused, "INPUT_INVALID"); assert.equal(stepOf(r), "z"); assert.match(r.why, /3 rows on its first pass and 2/);
  pass = 0;
  const bad = { fields: f, rows: () => { pass += 1; return [pass === 1 ? ["x", "1"] : ["x"]][Symbol.iterator](); } };
  assert.equal(refusedOf(evaluate({ ...rec, steps: [{ op: "sum", as: "z", from: "t", field: "b" }], output: "z" }, { t: bad })), "INPUT_INVALID");
  // An empty streamed table is a table.
  assert.deepEqual(asEvaluation(evaluate(rec, { t: { fields: f, rows: () => [][Symbol.iterator]() } })).result, fig("0"));
});

/* The heap fixture's printed JSON, read as the measures it prints. */
/** @param {Data} v @returns {number | null} */
const countOrNull = (v) => (v === null || typeof v === "number" ? v : assert.fail(`not a count: ${JSON.stringify(v)}`));
/** @param {Data} v @returns {Measure} */
const measureOf = (v) => {
  const m = isObject(v) ? v : assert.fail(`not a measure: ${JSON.stringify(v)}`);
  const { growth, held, refused } = m;
  if (typeof growth !== "number" || typeof held !== "number") return assert.fail(`no heap growth: ${JSON.stringify(v)}`);
  if (refused !== null && typeof refused !== "string") return assert.fail(`not a refusal code: ${JSON.stringify(v)}`);
  return { growth, held, refused, result_rows: countOrNull(m.result_rows), undetermined_rows: countOrNull(m.undetermined_rows) };
};
/** @param {string} text @returns {{ [name: string]: Measure }} */
const measuresOf = (text) => {
  const printed = JSON.parse(text);
  const parsed = isObject(printed) ? printed : assert.fail(`the heap fixture printed no object: ${text}`);
  /** @type {{ [name: string]: Measure }} */
  const out = {};
  for (const [name, v] of Object.entries(parsed)) out[name] = measureOf(v);
  return out;
};
/** @param {{ [name: string]: Measure }} out @param {string} name @returns {Measure} */
const measured = (out, name) => out[name] ?? assert.fail(`no measure for ${name}`);

test("R22 evaluating any recipe of the grammar over a streamed table of 1,000,000 cells grows the heap by less than the 35 MB K1576 measured for 500,000 cells as row objects", (t) => {
  const out = measuresOf(execFileSync(process.execPath, ["--expose-gc", fileURLToPath(new URL("./fixtures/heap.mjs", import.meta.url))],
    { encoding: "utf8" }));
  const ops = new Set(Object.values(RECIPES).flat().map((s) => s.op));
  assert.deepEqual([...ops].sort(), [...OPS].sort(), "the recipes use every op");
  assert.deepEqual(Object.keys(out), Object.keys(RECIPES));
  const MB = 1024 * 1024;
  for (const [name, m] of Object.entries(out)) {
    t.diagnostic(`${name}: heap growth ${(m.growth / MB).toFixed(1)} MB (held after: ${(m.held / MB).toFixed(1)} MB)`);
    assert.equal(m.refused, null, name);
    assert.ok(m.growth < 35 * MB, `${name}: ${(m.growth / MB).toFixed(1)} MB`);
  }
  // The table measured is 1,000,000 cells, and a table result is read whole.
  assert.equal(FIELDS.length * [...table().rows()].length, 1_000_000);
  assert.equal(measured(out, "select").result_rows, 100_000);
  assert.equal(measured(out, "group by dept").result_rows, 20);
});
