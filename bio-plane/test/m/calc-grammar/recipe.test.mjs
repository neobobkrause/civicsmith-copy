/* calc-grammar at its interface: the closed recipe grammar (R6) and its evaluation (R7–R14, R20). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRecipe, evaluate, OPS, TESTS, METHOD, SUM_RULE } from "../../../src/calc-grammar/index.mjs";
import { isObject, isUndetermined } from "../../../src/calc-grammar/decimal.mjs";
import { bothWays } from "./fixtures/stream.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/** @import { Figure, Precision, Undetermined } from "../../../src/calc-grammar/decimal.mjs" */
/** @import { Data, Members, Field, TableAnswer } from "../../../src/calc-grammar/tables.mjs" */
/** @import { Step, RecipeInput, Condition, Checked, RecipeError, Evaluation, EvalRefusal, EvalOptions, Ratio, Comparison, TraceLine } from "../../../src/calc-grammar/recipe.mjs" */
/** @import { Refusal } from "../../../src/calc-grammar/decimal.mjs" */

/** What `evaluate` answers. @typedef {Evaluation | EvalRefusal | Refusal} Answer */
/** What an evaluation's result may be. @typedef {Figure | Ratio | Comparison | TableAnswer | Undetermined} Result */
/** A table as a test binds it: its fields and its row objects. @typedef {{ fields: Field[], rows: Members[] }} TableIn */
/** A recipe as these tests write it, well formed or not; `checkRecipe` and `evaluate` read it as any value.
 *  @template S @typedef {{ method: string, inputs: RecipeInput[], steps: S[], output: Data }} RecipeOf */

/** Fails the test with `message` (an AssertionError). @param {string} message @returns {never} */
const fault = (message) => assert.fail(message);

/** @param {string} s @param {{ currency?: string }} [extra] @returns {Figure} */
const fig = (s, extra = {}) => {
  const negative = s.startsWith("-");
  /** @type {Figure} */
  const f = { value: negative ? s.slice(1) : s, sign: negative ? "-" : "+", precision: "exact" };
  const currency = extra.currency;
  if (currency !== undefined) f.currency = currency;
  return f;
};
/** A figure of `s` with another precision. @param {string} s @param {Precision} precision @returns {Figure} */
const figAs = (s, precision) => {
  const f = fig(s);
  f.precision = precision;
  return f;
};
/** @param {Figure} f @returns {string | undefined} */
const signed = (f) => (f.sign === "-" ? `-${f.value}` : f.value);
/** The name the last step answers (its `as` member, as reading it gives). @param {readonly Data[]} steps @returns {Data} */
const lastAs = (steps) => {
  const last = steps.at(-1);
  if (!isObject(last)) return fault("the last step is not an object");
  return last.as;
};
/** @template {Data} S @param {S[]} steps @param {Data} [output] @param {RecipeInput[]} [inputs] @returns {RecipeOf<S>} */
const recipe = (steps, output = lastAs(steps), inputs = [{ name: "t", kind: "table" }, { name: "u", kind: "table" },
  { name: "x", kind: "figure" }, { name: "y", kind: "figure" }]) => ({ method: METHOD, inputs, steps, output });

/** A checked recipe's faults; an accepted recipe fails the test. @param {Checked} r @returns {RecipeError[]} */
const errorsOf = (r) => {
  if (r.ok) return fault("the recipe was accepted");
  return r.errors;
};
/** @param {Checked} r @returns {RecipeError} */
const firstError = (r) => {
  const e = errorsOf(r)[0];
  if (e === undefined) return fault("the recipe was refused with no fault");
  return e;
};
/** An evaluation; a refusal fails the test. @param {Answer} r @returns {Evaluation} */
const evaluated = (r) => {
  if ("refused" in r) return fault(`refused ${r.refused}: ${r.why}`);
  return r;
};
/** A refusal; an evaluation fails the test. @param {Answer} r @returns {EvalRefusal | Refusal} */
const refusedOf = (r) => {
  if (!("refused" in r)) return fault("evaluated, not refused");
  return r;
};
/** The refusal's code, or `undefined` for an evaluation. @param {Answer} r @returns {string | undefined} */
const refusedCode = (r) => ("refused" in r ? r.refused : undefined);
/** @param {Answer} r @returns {Result} */
const resultOf = (r) => evaluated(r).result;
/** @param {Answer} r @param {number} k @returns {TraceLine} */
const traceLine = (r, k) => {
  const line = evaluated(r).trace[k];
  if (line === undefined) return fault(`no trace line ${k}`);
  return line;
};
/** @param {Result} x @returns {Figure} */
const asFigure = (x) => {
  if (!("sign" in x)) return fault("the result is not a figure");
  return x;
};
/** @param {Result} x @returns {Ratio} */
const asRatio = (x) => {
  if (!("numerator" in x)) return fault("the result is not a ratio");
  return x;
};
/** @param {Result} x @returns {Comparison} */
const asComparison = (x) => {
  if (!("relation" in x)) return fault("the result is not a comparison");
  return x;
};
/** @param {Result} x @returns {Undetermined} */
const asUndetermined = (x) => {
  if (!isUndetermined(x)) return fault("the result is not undetermined");
  return x;
};
/** @param {Result} x @returns {TableAnswer} */
const asTable = (x) => {
  if (!("fields" in x)) return fault("the result is not a table");
  return x;
};
/** A table result's rows as row objects. @param {Result} x @returns {Members[]} */
const rowsOf = (x) => {
  const rows = asTable(x).rows;
  if (typeof rows === "function") return fault("the table result is streamed");
  return rows.map((row) => {
    if (Array.isArray(row)) return fault("a result row is not a row object");
    return row;
  });
};
/** A figure's or an undetermined answer's `value` member, as reading it gives. @param {Figure | Undetermined} x @returns {string | undefined} */
const valueOf = (x) => ("sign" in x ? x.value : undefined);
/** A figure's or an undetermined answer's `undetermined` member, as reading it gives. @param {Figure | Undetermined} x @returns {boolean | undefined} */
const undeterminedOf = (x) => ("undetermined" in x ? x.undetermined : undefined);
/** A cell's `value` member, as reading it gives. @param {Data} d @returns {Data} */
const valueMember = (d) => (isObject(d) ? d.value : undefined);
/** A figure cell signed as `signed` writes it; a falsy cell as it is. @param {Data} d @returns {Data} */
const signedCell = (d) => {
  const cell = d;
  if (!cell) return cell;
  if (!isObject(cell)) return undefined;
  return cell.sign === "-" ? `-${String(cell.value)}` : cell.value;
};

/* One well-formed step of each op over the inputs t, u (tables), x, y (figures), and an earlier select `s` over t. */
/** @type {Step} */
const SEL = { op: "select", as: "s", from: "t", where: [{ field: "n", test: "gt", value: 0 }] };
/** @type {{ [op: string]: Step }} */
const VALID = {
  select: SEL,
  count: { op: "count", as: "k", from: "t" },
  sum: { op: "sum", as: "k", from: "t", field: "n" },
  difference: { op: "difference", as: "k", a: "x", b: "y" },
  ratio: { op: "ratio", as: "k", numerator: "x", denominator: "y", places: 4, mode: "half_up" },
  share: { op: "share", as: "k", part: "s", whole: "t" },
  group: { op: "group", as: "k", from: "t", by: ["name"], measure: { op: "sum", field: "n" } },
  span: { op: "span", as: "k", from: "t", start: "d", end: "e", unit: "days" },
  compare: { op: "compare", as: "k", a: "x", b: "y" },
  round: { op: "round", as: "k", of: "x", places: 0, mode: "down" },
  join: { op: "join", as: "k", left: "t", right: "u", on: { left: "name", right: "who" }, space: "vendor" },
  sort: { op: "sort", as: "k", from: "t", by: "n", order: "desc" },
};
/** @param {string} op @returns {Step} */
const valid = (op) => {
  const st = VALID[op];
  if (st === undefined) return fault(`no valid step for ${op}`);
  return st;
};
/** @param {string} op @param {Data} [st] @returns {Data[]} */
const stepsFor = (op, st = valid(op)) => (op === "select" ? [st] : [SEL, st]);

test("R6 every op of the closed grammar, in its form, is accepted", () => {
  assert.deepEqual(Object.keys(VALID).sort(), [...OPS].sort());
  for (const op of OPS) assert.deepEqual(checkRecipe(recipe(stepsFor(op))), { ok: true }, op);
  const cw = { op: "join", as: "k", left: "t", right: "u", on: { left: "name", right: "who" }, crosswalk: { input: "u", left: "a", right: "b" } };
  assert.deepEqual(checkRecipe(recipe([cw])), { ok: true });
});

test("R6 any other op, any field not in a step's form, any malformed field, function or code reference is RECIPE_INVALID naming the step and field", () => {
  /** @param {Checked} r @returns {string[]} */
  const codes = (r) => (r.ok ? [] : r.errors.map((e) => `${e.code}@${e.step}.${e.field}`));
  for (const op of ["eval", "map", "filter", "product", "formula", "", "SUM", null, 3]) {
    const r = checkRecipe(recipe([{ op, as: "k", from: "t" }]));
    assert.deepEqual(codes(r), ["RECIPE_INVALID@k.op"], String(op));
  }
  const fn = () => 1;
  for (const op of OPS) {
    const base = valid(op);
    for (const extra of ["expr", "code", "fn", "$ref", "formula", "where2"]) {
      const r = checkRecipe(recipe(stepsFor(op, { ...base, [extra]: "x + 1" })));
      assert.ok(codes(r).includes(`RECIPE_INVALID@${base.as}.${extra}`), `${op} ${extra}: ${codes(r)}`);
    }
    for (const field of Object.keys(base).filter((k) => k !== "op")) {
      for (const v of [fn, Symbol("s"), 1.5, { toString: fn }, [fn], /re/, new Date(0), "=SUM(A1:A9)"]) {
        if (typeof v === "string" && ["field", "start", "end", "into", "space", "by"].includes(field)) continue; // a name is data
        const r = checkRecipe(recipe(stepsFor(op, { ...base, [field]: v })));
        assert.equal(r.ok, false, `${op}.${field} = ${String(v)}`);
        assert.ok(errorsOf(r).some((e) => {
          const named = e.field;
          return named && named.startsWith(field === "as" ? "as" : field) || e.code === "NAME_UNDEFINED";
        }), `${op}.${field}: ${codes(r)}`);
      }
      const required = !["places", "mode", "into", "space", "field"].includes(field) || (op === "sum" && field === "field") || (op === "round");
      if (required) {
        const rest = { ...base };
        Reflect.deleteProperty(rest, field);
        assert.equal(checkRecipe(recipe(stepsFor(op, rest))).ok, false, `${op} without ${field}`);
      }
    }
  }
  for (const where of [[], [{ field: "n", test: "like", value: "a%" }], [{ field: "n", test: "eq", value: 1, fn }],
    [{ field: "n", test: "in", value: [] }], [{ field: "n", test: "between", value: [1] }], [{ field: "n", test: "eq", value: { $gt: 1 } }]]) {
    const r = checkRecipe(recipe([{ ...SEL, where }]));
    assert.equal(r.ok, false, JSON.stringify(where)); assert.equal(firstError(r).code, "RECIPE_INVALID"); assert.equal(firstError(r).step, "s");
  }
  for (const t of TESTS) assert.equal(checkRecipe(recipe([{ op: "select", as: "s", from: "t", where: [{ field: "n", test: t, value: t === "in" ? [1, 2] : t === "between" ? [1, 2] : 1 }] }])).ok, true, t);
  assert.equal(firstError(checkRecipe({ ...recipe([SEL]), extra: 1 })).code, "RECIPE_INVALID");
  assert.equal(firstError(checkRecipe(recipe([SEL, { ...valid("share"), part: "t" }]))).field, "part");
  assert.equal(firstError(checkRecipe(recipe([{ ...valid("sum"), from: "x" }]))).field, "from");
  assert.equal(firstError(checkRecipe(recipe([{ ...valid("compare"), a: "t" }]))).field, "a");
  assert.equal(firstError(checkRecipe(recipe([SEL, { ...SEL }]))).field, "as");
  assert.equal(checkRecipe(null).ok, false);
});

test("R6 a method other than bio-calc/1 is METHOD_UNKNOWN; a name not defined before its step is NAME_UNDEFINED", () => {
  for (const method of ["bio-calc/2", "BIO-CALC/1", undefined, "javascript"]) {
    const r = checkRecipe({ ...recipe([SEL]), method });
    assert.equal(firstError(r).code, "METHOD_UNKNOWN");
  }
  const later = [{ op: "count", as: "c", from: "s" }, SEL];
  assert.deepEqual(errorsOf(checkRecipe(recipe(later, "c"))).map((e) => [e.code, e.step, e.field]), [["NAME_UNDEFINED", "c", "from"]]);
  assert.equal(firstError(checkRecipe(recipe([SEL], "nope"))).code, "NAME_UNDEFINED");
  assert.equal(firstError(checkRecipe(recipe([{ ...valid("join"), space: undefined, crosswalk: { input: "zz", left: "a", right: "b" } }]))).code, "NAME_UNDEFINED");
  const ev = evaluate({ ...recipe([SEL]), method: "bio-calc/9" }, {});
  assert.equal(refusedCode(ev), "METHOD_UNKNOWN");
});

// ---- evaluation ----

/** @type {TableIn} */
const T = {
  fields: [{ name: "name", type: "string" }, { name: "n", type: "number", currency: "USD" }, { name: "i", type: "integer" },
    { name: "d", type: "date" }, { name: "e", type: "date" }, { name: "ok", type: "boolean" }],
  rows: [
    { name: "a", n: "10.50", i: "1", d: "2024-01-01", e: "2024-01-31", ok: "true" },
    { name: "b", n: "(2.25)", i: "2", d: "2024-02-15", e: "2024-03-01", ok: false },
    { name: "a", n: "", i: "x", d: "", e: "2024-02-01", ok: "maybe" },
    { name: "c", n: "about 7", i: "4", d: "2024-03-01", e: "2024-03-01", ok: true },
    { name: "", n: 3, i: 3, d: "2024-01-15", e: "2024-01-20", ok: "false" },
    { name: "d", n: 1.5, i: "1.5", d: "2024-13-45", e: "2024-01-01", ok: true },
  ],
};
/** @type {TableIn} */
const NO_ONE = { fields: [{ name: "who", type: "string" }], rows: [] };
/* Every evaluation here also runs with its tables streamed (R22), and must answer the same. */
/** @template {Data} S @param {S[]} steps @param {Members} [bound] @param {EvalOptions} [opts] @returns {Answer} */
const run = (steps, bound = {}, opts) => {
  /** @type {Members} */
  const all = { t: T, u: NO_ONE, x: fig("1"), y: fig("2") };
  for (const [name, value] of Object.entries(bound)) all[name] = value;
  const { objects, compared, streams } = bothWays(recipe(steps, lastAs(steps), [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "x", kind: "figure" }, { name: "y", kind: "figure" }]),
    all, opts);
  assert.deepEqual(streams, compared, "the same answer over the streamed tables");
  return objects;
};
/** @param {Answer} res @returns {Data[]} */
const names = (res) => rowsOf(resultOf(res)).map((r) => r.name);

test("R7 select keeps rows meeting every condition (eq ne lt le gt ge in between, inclusive); an undetermined field is set aside and counted, never coerced", () => {
  /** @param {Condition[]} where */
  const sel = (where) => run([{ op: "select", as: "s", from: "t", where }]);
  /** @type {[Condition[], string[], number[]][]} */
  const cases = [
    [[{ field: "name", test: "eq", value: "a" }], ["a", "a"], [4]],
    [[{ field: "name", test: "ne", value: "a" }], ["b", "c", "d"], [4]],
    [[{ field: "name", test: "in", value: ["b", "c"] }], ["b", "c"], [4]],
    [[{ field: "n", test: "gt", value: "0" }], ["a", ""], [2, 3, 5]],
    [[{ field: "n", test: "ge", value: "3" }], ["a", ""], [2, 3, 5]],
    [[{ field: "n", test: "lt", value: 3 }], ["b"], [2, 3, 5]],
    [[{ field: "n", test: "le", value: 3 }], ["b", ""], [2, 3, 5]],
    [[{ field: "n", test: "between", value: ["-2.25", "3"] }], ["b", ""], [2, 3, 5]],
    [[{ field: "n", test: "eq", value: "$10.5" }], ["a"], [2, 3, 5]],
    [[{ field: "i", test: "between", value: [2, 4] }], ["b", "c", ""], [2, 5]],
    [[{ field: "ok", test: "eq", value: true }], ["a", "c", "d"], [2]],
    [[{ field: "d", test: "ge", value: "2024-02-15" }], ["b", "c"], [2, 5]],
    [[{ field: "d", test: "between", value: ["2024-01-01", "2024-02-15"] }], ["a", "b", ""], [2, 5]],
    [[{ field: "d", test: "lt", value: "2024-02-15" }, { field: "name", test: "ne", value: "" }], ["a"], [2, 4, 5]],
  ];
  for (const [where, want, aside] of cases) {
    const r = sel(where);
    assert.deepEqual(names(r), want, JSON.stringify(where));
    assert.deepEqual(traceLine(r, 0).undetermined.map((u) => u.row), aside, JSON.stringify(where));
    assert.equal(evaluated(r).undetermined_rows, aside.length);
    for (const u of traceLine(r, 0).undetermined) assert.ok(u.why.length > 0);
  }
  assert.equal(refusedCode(sel([{ field: "nope", test: "eq", value: 1 }])), "RECIPE_INVALID");
  assert.equal(refusedCode(sel([{ field: "name", test: "lt", value: "b" }])), "RECIPE_INVALID");
  assert.equal(refusedCode(sel([{ field: "n", test: "gt", value: "€5" }])), "UNIT_MISMATCH");
});

test("R8 count counts rows; sum totals exactly; difference subtracts; ratio gives numerator, denominator and value; share carries its denominator; a zero denominator is undetermined", () => {
  /** @type {TableIn} */
  const exact = { fields: [{ name: "v", type: "number" }], rows: [{ v: "0.1" }, { v: "0.2" }, { v: "1,000.70" }] };
  let r = run([{ op: "count", as: "c", from: "t" }]);
  assert.deepEqual(resultOf(r), fig("6"));
  r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: exact });
  assert.deepEqual(resultOf(r), fig("1001.00"));
  r = run([{ op: "difference", as: "d", a: "x", b: "y" }], { x: fig("0.3"), y: fig("0.1") });
  assert.equal(asFigure(resultOf(r)).value, "0.2");
  r = run([{ op: "ratio", as: "q", numerator: "x", denominator: "y" }], { x: fig("1"), y: fig("3") });
  assert.deepEqual(resultOf(r), { numerator: fig("1"), denominator: fig("3"), value: { value: "0.333333333333", sign: "+", precision: "rounded" } });
  r = run([{ op: "ratio", as: "q", numerator: "x", denominator: "y", places: 2, mode: "up" }], { x: fig("1"), y: fig("0") });
  assert.equal(undeterminedOf(asRatio(resultOf(r)).value), true); assert.deepEqual(asRatio(resultOf(r)).denominator, fig("0"));
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "name", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t" }]);
  let q = asRatio(resultOf(r));
  assert.deepEqual([valueOf(q.numerator), valueOf(q.denominator), valueOf(q.value)], ["2", "6", "0.333333333333"]);
  /** @type {TableIn} */
  const empty = { fields: T.fields, rows: [] };
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "name", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t" }], { t: empty });
  assert.equal(undeterminedOf(asRatio(resultOf(r)).value), true); assert.equal(valueOf(asRatio(resultOf(r)).denominator), "0");
  /** @type {TableIn} */
  const money = { fields: [{ name: "k", type: "string" }, { name: "v", type: "number" }], rows: [{ k: "a", v: "3" }, { k: "b", v: "1" }] };
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "k", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t", field: "v", places: 2, mode: "half_even" }], { t: money });
  q = asRatio(resultOf(r));
  assert.deepEqual([valueOf(q.numerator), valueOf(q.denominator), valueOf(q.value)], ["3", "4", "0.75"]);
  r = run([{ op: "difference", as: "d", a: "x", b: "y" }, { op: "ratio", as: "q", numerator: "d", denominator: "y" }], { x: fig("4"), y: fig("2") });
  assert.equal(valueOf(asRatio(resultOf(r)).value), "1.000000000000");
});

test("R9 group gives one result per distinct value in first-appearance order; span counts through civil-time per row; round is R4's", () => {
  /** @type {TableIn} */
  const g = { fields: [{ name: "k", type: "string" }, { name: "y", type: "integer" }, { name: "v", type: "number", currency: "USD" }],
    rows: [{ k: "b", y: "1", v: "1" }, { k: "a", y: "1", v: "2.5" }, { k: "b", y: "2", v: "3" }, { k: "b", y: "1", v: "4" }, { k: "", y: "1", v: "9" }] };
  let r = run([{ op: "group", as: "g", from: "t", by: ["k"], measure: { op: "count" } }], { t: g });
  assert.deepEqual(asTable(resultOf(r)).rows, [{ k: "b", count: "3" }, { k: "a", count: "1" }]);
  assert.deepEqual(traceLine(r, 0).undetermined.map((u) => u.row), [4]);
  r = run([{ op: "group", as: "g", from: "t", by: ["k", "y"], measure: { op: "sum", field: "v" } }], { t: g });
  assert.deepEqual(rowsOf(resultOf(r)).map((x) => [x.k, x.y, valueMember(x.sum)]), [["b", "1", "5"], ["a", "1", "2.5"], ["b", "2", "3"]]);
  assert.equal(asTable(resultOf(r)).fields.at(-1)?.currency, "USD");
  r = run([{ op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" }]);
  assert.deepEqual(rowsOf(resultOf(r)).map((x) => signedCell(x.sp)), ["30", "15", null, "0", "5", null]);
  assert.deepEqual(traceLine(r, 0).undetermined.map((u) => u.row), [2, 5]);
  assert.equal(asTable(resultOf(r)).fields.at(-1)?.name, "sp");
  r = run([{ op: "span", as: "sp", from: "t", start: "name", end: "e", unit: "days" }]);
  assert.equal(refusedCode(r), "RECIPE_INVALID");
  r = run([{ op: "round", as: "r", of: "x", places: 1, mode: "half_even" }], { x: fig("2.25") });
  assert.deepEqual(resultOf(r), { value: "2.2", sign: "+", precision: "rounded" });
});

test("R10 compare gives a relation labelled a computed fact, never a judgment", () => {
  /** @param {Figure} x @param {Figure} y @returns {Comparison} */
  const cmp = (x, y) => asComparison(resultOf(run([{ op: "compare", as: "c", a: "x", b: "y" }], { x, y })));
  assert.deepEqual(cmp(fig("1"), fig("2")), { relation: "lower", label: "computed fact" });
  assert.deepEqual(cmp(fig("2.0"), fig("2")), { relation: "equal", label: "computed fact" });
  assert.deepEqual(cmp(fig("3"), fig("-2")), { relation: "higher", label: "computed fact" });
  const u = cmp(figAs("4200000", "rounded"), fig("4210000"));
  assert.equal(u.relation, "undetermined"); assert.equal(u.label, "computed fact"); assert.ok("why" in u ? u.why : undefined);
  assert.equal(cmp(figAs("4200000", "rounded"), fig("4300000")).relation, "lower");
  assert.equal(cmp(figAs("5", "approximate"), fig("100")).relation, "undetermined");
  assert.equal(cmp({ low: "1", high: "3", sign: "+", precision: "range" }, fig("4")).relation, "lower");
  assert.equal(cmp({ low: "1", high: "3", sign: "+", precision: "range" }, fig("2")).relation, "undetermined");
  for (const res of [cmp(fig("1"), fig("2")), cmp(fig("2"), fig("2"))]) {
    assert.deepEqual(Object.keys(res).sort(), ["label", "relation"]);
    assert.doesNotMatch(JSON.stringify(res), /breach|violat|fail|comply|complian|wrong|bad|good/i);
  }
  assert.equal(refusedCode(run([{ op: "compare", as: "c", a: "x", b: "y" }], { x: fig("1", { currency: "USD" }), y: fig("1") })), "UNIT_MISMATCH");
});

/** @type {TableIn} */
const P = { fields: [{ name: "pid", type: "string" }, { name: "amt", type: "number" }], rows: [{ pid: "Smith, J.", amt: "5" }, { pid: "", amt: "1" }, { pid: "J SMITH", amt: "7" }, { pid: "Unknown", amt: "2" }] };
/** @type {TableIn} */
const Q = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "smith j", role: "clerk" }, { who: "Doe", role: "mayor" }, { who: "", role: "x" }] };

test("R11 join compares values only through the caller's resolver for the named space, or the crosswalk's pairs; never raw strings", () => {
  /** @type {string[]} */
  const calls = [];
  /** @type {{ [raw: string]: string }} */
  const ids = { "Smith, J.": "P1", "J SMITH": "P1", "smith j": "P1", Doe: "P2" };
  /** @param {string} space @param {Data} v @returns {Data} */
  const resolveId = (space, v) => { calls.push(space); return ids[String(v)] ?? null; };
  const step = { op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" }, space: "person" };
  let r = run([step], { t: P, u: Q }, { resolveId });
  assert.deepEqual(rowsOf(resultOf(r)).map((x) => [x.pid, x["u.role"]]), [["Smith, J.", "clerk"], ["J SMITH", "clerk"]]);
  assert.ok(calls.length > 0 && calls.every(/** @param {string} s @returns {boolean} */ (s) => s === "person"));
  assert.deepEqual(traceLine(r, 0).undetermined.map((u) => `${u.side}${u.row}`).sort(), ["left1", "left3", "right2"]);
  // Equal raw strings that do not resolve are never joined.
  /** @type {TableIn} */
  const same = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "Unknown", role: "z" }] };
  r = run([step], { t: P, u: same }, { resolveId });
  assert.deepEqual(asTable(resultOf(r)).rows, []);
  // No resolver for the space: undetermined, why named.
  r = run([step], { t: P, u: Q });
  assert.equal(asUndetermined(resultOf(r)).undetermined, true); assert.match(asUndetermined(resultOf(r)).why, /no resolver for the space/);
  // A crosswalk's pairs.
  /** @type {TableIn} */
  const cw = { fields: [{ name: "a", type: "string" }, { name: "b", type: "string" }], rows: [{ a: "Smith, J.", b: "smith j" }, { a: "Unknown", b: "Doe" }] };
  const steps = [{ op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" }, crosswalk: { input: "x", left: "a", right: "b" } }];
  r = evaluate(recipe(steps, "j", [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "x", kind: "table" }]), { t: P, u: Q, x: cw });
  assert.deepEqual(rowsOf(resultOf(r)).map((x) => [x.pid, x["u.role"]]), [["Smith, J.", "clerk"], ["Unknown", "mayor"]]);
  assert.ok(traceLine(r, 0).undetermined.some((u) => u.side === "left" && u.row === 2 && u.why.includes("not in the crosswalk")));
  // Unkeyed.
  const unkeyed = recipe([{ op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" } }]);
  assert.equal(firstError(checkRecipe(unkeyed)).code, "JOIN_UNKEYED");
  assert.equal(refusedCode(evaluate(unkeyed, { t: P, u: Q, x: fig("1"), y: fig("1") })), "JOIN_UNKEYED");
});

test("R12 sort orders by one numeric or date field, ascending or descending, ties in input order; a string or composed field is SORT_NOT_QUANTITY", () => {
  /** @type {TableIn} */
  const S = { fields: [{ name: "id", type: "string" }, { name: "v", type: "number" }, { name: "d", type: "date" }, { name: "c", type: "number", composed: true }],
    rows: [{ id: "a", v: "3", d: "2024-02-01" }, { id: "b", v: "1.5", d: "2024-01-01" }, { id: "c", v: "3.0", d: "2024-02-01" }, { id: "d", v: "-2", d: "2023-12-31" }, { id: "e", v: "", d: "" }, { id: "f", v: "1 to 2", d: "2024-03-01" }] };
  /** @param {string} by @param {"asc" | "desc"} order */
  const sort = (by, order) => run([{ op: "sort", as: "o", from: "t", by, order }], { t: S });
  assert.deepEqual(rowsOf(resultOf(sort("v", "asc"))).map((r) => r.id), ["d", "b", "a", "c"]);
  assert.deepEqual(rowsOf(resultOf(sort("v", "desc"))).map((r) => r.id), ["a", "c", "b", "d"]);
  assert.deepEqual(traceLine(sort("v", "asc"), 0).undetermined.map((u) => u.row), [4, 5]);
  assert.deepEqual(rowsOf(resultOf(sort("d", "asc"))).map((r) => r.id), ["d", "b", "a", "c", "f"]);
  assert.deepEqual(rowsOf(resultOf(sort("d", "desc"))).map((r) => r.id), ["f", "a", "c", "b", "d"]);
  assert.equal(refusedCode(sort("id", "asc")), "SORT_NOT_QUANTITY");
  assert.equal(refusedCode(sort("c", "asc")), "SORT_NOT_QUANTITY");
});

test("R13 a sum over rows differing in kind, phase or stage, basis, currency or period is refused by name, naming the values found", () => {
  for (const [field, code] of SUM_RULE) {
    /** @type {TableIn} */
    const t = { fields: [{ name: "v", type: "number" }, { name: field, type: "string" }],
      rows: [{ v: "1", [field]: "alpha" }, { v: "2", [field]: "alpha" }, { v: "3", [field]: "beta" }] };
    const r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t });
    assert.equal(refusedCode(r), code, field); assert.match(refusedOf(r).why, /alpha/); assert.match(refusedOf(r).why, /beta/);
    /** @type {TableIn} */
    const same = { fields: t.fields, rows: t.rows.slice(0, 2) };
    assert.equal(asFigure(resultOf(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: same }))).value, "3", field);
    const g = run([{ op: "group", as: "g", from: "t", by: [field], measure: { op: "sum", field: "v" } }], { t });
    assert.deepEqual(rowsOf(resultOf(g)).map((x) => valueMember(x.sum)), ["3", "3"], `${field}: grouping by it separates the totals`);
  }
  /** @type {TableIn} */
  const mixed = { fields: [{ name: "v", type: "number" }], rows: [{ v: "$1" }, { v: "€2" }] };
  assert.equal(refusedCode(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: mixed })), "SUM_MIXED_CURRENCY");
});

test("R14 the trace lists each step's input rows, output, the rows set aside and why, and the method; the same arguments give the same result, reading nothing else", () => {
  const steps = [{ op: "select", as: "s", from: "t", where: [{ field: "n", test: "gt", value: 0 }] }, { op: "count", as: "c", from: "s" }, { op: "sum", as: "z", from: "s", field: "n" }];
  const answered = run(steps); const b = run(steps);
  assert.deepEqual(answered, b);
  const a = evaluated(answered);
  assert.deepEqual(a.trace.map((t) => [t.step, t.op, t.input_rows, t.method]), [["s", "select", 6, METHOD], ["c", "count", 2, METHOD], ["z", "sum", 2, METHOD]]);
  assert.deepEqual(traceLine(a, 1).output, fig("2"));
  assert.deepEqual(traceLine(a, 0).output, { rows: 2 });
  assert.ok(traceLine(a, 0).undetermined.every((u) => Number.isInteger(u.row) && typeof u.why === "string"));
  assert.equal(a.undetermined_rows, a.trace.reduce((n, t) => n + t.undetermined.length, 0));
  const frozen = structuredClone(T);
  run(steps);
  assert.deepEqual(T, frozen, "the inputs are not changed");
});

test("R20 undetermined never reads as zero: a total with an undetermined amount is undetermined, naming the rows; unbound and invalid inputs are refused by name", () => {
  /** @type {TableIn} */
  const t = { fields: [{ name: "v", type: "number" }], rows: [{ v: "1" }, { v: "" }, { v: "n/a" }] };
  let r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t });
  assert.equal(asUndetermined(resultOf(r)).undetermined, true); assert.match(asUndetermined(resultOf(r)).why, /never read as zero/);
  assert.deepEqual(traceLine(r, 0).undetermined.map((u) => u.row), [1, 2]);
  r = run([{ op: "sum", as: "s", from: "t", field: "v" }, { op: "difference", as: "d", a: "s", b: "x" }], { t });
  assert.equal(asUndetermined(resultOf(r)).undetermined, true);
  /** @type {TableIn} */
  const kinded = { fields: [{ name: "v", type: "number" }, { name: "kind", type: "string" }], rows: [{ v: "1", kind: "a" }, { v: "2", kind: "" }] };
  assert.equal(asUndetermined(resultOf(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: kinded }))).undetermined, true);
  const rec = recipe([{ op: "count", as: "c", from: "t" }], "c", [{ name: "t", kind: "table" }]);
  assert.equal(refusedCode(evaluate(rec, {})), "INPUT_UNBOUND");
  assert.equal(refusedCode(evaluate(rec, { t: { rows: [] } })), "INPUT_INVALID");
  assert.equal(refusedCode(evaluate(rec, { t: { fields: [{ name: "a", type: "money" }], rows: [] } })), "INPUT_INVALID");
  assert.throws(() => evaluate(rec, null), TypeError);
  assert.throws(() => evaluate(rec, {}, { resolveId: "x" }), TypeError);
});

test("R20 a ratio that is itself undetermined, read by a later step, makes that step undetermined, never a throw or a zero", () => {
  /* q0's zero denominator makes q1, which reads it, an undetermined ratio; each step of each kind that reads q1 answers
     undetermined of its own kind, naming why. */
  const head = [{ op: "ratio", as: "q0", numerator: "x", denominator: "y" }, { op: "ratio", as: "q1", numerator: "q0", denominator: "x" }];
  /** @type {Step[]} */
  const readers = [{ op: "difference", as: "d", a: "q1", b: "x" }, { op: "difference", as: "d", a: "x", b: "q1" },
    { op: "ratio", as: "q2", numerator: "q1", denominator: "x" }, { op: "ratio", as: "q2", numerator: "x", denominator: "q1" },
    { op: "compare", as: "c", a: "q1", b: "x" }, { op: "round", as: "r", of: "q1", places: 2, mode: "half_even" }];
  for (const st of readers) {
    const r = run([...head, st], { x: fig("2"), y: fig("0") });
    const u = asUndetermined(resultOf(r));
    assert.equal(u.undetermined, true, JSON.stringify(st)); assert.match(u.why, /division by zero/, JSON.stringify(st));
    assert.ok(isUndetermined(traceLine(r, 1).output), "q1 is an undetermined ratio");
  }
});

test("R20 calc-grammar.recipe.field_shape: a table field of an unknown type is refused INPUT_INVALID, its why naming every type; calc-grammar.composed_quantity: a composed sort field says so by key", () => {
  const rec = recipe([{ op: "count", as: "c", from: "t" }], "c", [{ name: "t", kind: "table" }]);
  const shape = evaluate(rec, { t: { fields: [{ name: "a", type: "money" }], rows: [] } });
  assert.equal(refusedCode(shape), "INPUT_INVALID");
  for (const type of ["string", "number", "integer", "date", "datetime", "boolean"]) assert.ok(refusedOf(shape).why.includes(type), type);
  /** @type {TableIn} */
  const composed = { fields: [{ name: "c", type: "number", composed: true }], rows: [] };
  const sorted = run([{ op: "sort", as: "o", from: "t", by: "c", order: "asc" }], { t: composed });
  assert.equal(refusedCode(sorted), "SORT_NOT_QUANTITY");
  assert.ok(refusedOf(sorted).why.includes(word("calc-grammar.composed_quantity")));
});
