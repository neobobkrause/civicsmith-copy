/* calc-grammar at its interface: the closed recipe grammar (R6) and its evaluation (R7–R14, R20). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRecipe, evaluate, OPS, TESTS, METHOD, SUM_RULE } from "../../../src/calc-grammar/index.mjs";
import { bothWays } from "./fixtures/stream.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const fig = (s, extra = {}) => (s.startsWith("-") ? { value: s.slice(1), sign: "-", precision: "exact", ...extra }
  : { value: s, sign: "+", precision: "exact", ...extra });
const signed = (f) => (f.sign === "-" ? `-${f.value}` : f.value);
const recipe = (steps, output = steps[steps.length - 1].as, inputs = [{ name: "t", kind: "table" }, { name: "u", kind: "table" },
  { name: "x", kind: "figure" }, { name: "y", kind: "figure" }]) => ({ method: METHOD, inputs, steps, output });

/* One well-formed step of each op over the inputs t, u (tables), x, y (figures), and an earlier select `s` over t. */
const SEL = { op: "select", as: "s", from: "t", where: [{ field: "n", test: "gt", value: 0 }] };
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
const stepsFor = (op, st = VALID[op]) => (op === "select" ? [st] : [SEL, st]);

test("R6 every op of the closed grammar, in its form, is accepted", () => {
  assert.deepEqual(Object.keys(VALID).sort(), [...OPS].sort());
  for (const op of OPS) assert.deepEqual(checkRecipe(recipe(stepsFor(op))), { ok: true }, op);
  const cw = { op: "join", as: "k", left: "t", right: "u", on: { left: "name", right: "who" }, crosswalk: { input: "u", left: "a", right: "b" } };
  assert.deepEqual(checkRecipe(recipe([cw])), { ok: true });
});

test("R6 any other op, any field not in a step's form, any malformed field, function or code reference is RECIPE_INVALID naming the step and field", () => {
  const codes = (r) => (r.ok ? [] : r.errors.map((e) => `${e.code}@${e.step}.${e.field}`));
  for (const op of ["eval", "map", "filter", "product", "formula", "", "SUM", null, 3]) {
    const r = checkRecipe(recipe([{ op, as: "k", from: "t" }]));
    assert.deepEqual(codes(r), ["RECIPE_INVALID@k.op"], String(op));
  }
  const fn = () => 1;
  for (const op of OPS) {
    const base = VALID[op];
    for (const extra of ["expr", "code", "fn", "$ref", "formula", "where2"]) {
      const r = checkRecipe(recipe(stepsFor(op, { ...base, [extra]: "x + 1" })));
      assert.ok(codes(r).includes(`RECIPE_INVALID@${base.as}.${extra}`), `${op} ${extra}: ${codes(r)}`);
    }
    for (const field of Object.keys(base).filter((k) => k !== "op")) {
      for (const v of [fn, Symbol("s"), 1.5, { toString: fn }, [fn], /re/, new Date(0), "=SUM(A1:A9)"]) {
        if (typeof v === "string" && ["field", "start", "end", "into", "space", "by"].includes(field)) continue; // a name is data
        const r = checkRecipe(recipe(stepsFor(op, { ...base, [field]: v })));
        assert.equal(r.ok, false, `${op}.${field} = ${String(v)}`);
        assert.ok(r.errors.some((e) => e.field && e.field.startsWith(field === "as" ? "as" : field) || e.code === "NAME_UNDEFINED"), `${op}.${field}: ${codes(r)}`);
      }
      const required = !["places", "mode", "into", "space", "field"].includes(field) || (op === "sum" && field === "field") || (op === "round");
      if (required) {
        const { [field]: _, ...rest } = base;
        assert.equal(checkRecipe(recipe(stepsFor(op, rest))).ok, false, `${op} without ${field}`);
      }
    }
  }
  for (const where of [[], [{ field: "n", test: "like", value: "a%" }], [{ field: "n", test: "eq", value: 1, fn }],
    [{ field: "n", test: "in", value: [] }], [{ field: "n", test: "between", value: [1] }], [{ field: "n", test: "eq", value: { $gt: 1 } }]]) {
    const r = checkRecipe(recipe([{ ...SEL, where }]));
    assert.equal(r.ok, false, JSON.stringify(where)); assert.equal(r.errors[0].code, "RECIPE_INVALID"); assert.equal(r.errors[0].step, "s");
  }
  for (const t of TESTS) assert.equal(checkRecipe(recipe([{ ...SEL, where: [{ field: "n", test: t, value: t === "in" ? [1, 2] : t === "between" ? [1, 2] : 1 }] }])).ok, true, t);
  assert.equal(checkRecipe({ ...recipe([SEL]), extra: 1 }).errors[0].code, "RECIPE_INVALID");
  assert.equal(checkRecipe(recipe([SEL, { ...VALID.share, part: "t" }])).errors[0].field, "part");
  assert.equal(checkRecipe(recipe([{ ...VALID.sum, from: "x" }])).errors[0].field, "from");
  assert.equal(checkRecipe(recipe([{ ...VALID.compare, a: "t" }])).errors[0].field, "a");
  assert.equal(checkRecipe(recipe([SEL, { ...SEL }])).errors[0].field, "as");
  assert.equal(checkRecipe(null).ok, false);
});

test("R6 a method other than bio-calc/1 is METHOD_UNKNOWN; a name not defined before its step is NAME_UNDEFINED", () => {
  for (const method of ["bio-calc/2", "BIO-CALC/1", undefined, "javascript"]) {
    const r = checkRecipe({ ...recipe([SEL]), method });
    assert.equal(r.errors[0].code, "METHOD_UNKNOWN");
  }
  const later = [{ op: "count", as: "c", from: "s" }, SEL];
  assert.deepEqual(checkRecipe(recipe(later, "c")).errors.map((e) => [e.code, e.step, e.field]), [["NAME_UNDEFINED", "c", "from"]]);
  assert.equal(checkRecipe(recipe([SEL], "nope")).errors[0].code, "NAME_UNDEFINED");
  assert.equal(checkRecipe(recipe([{ ...VALID.join, space: undefined, crosswalk: { input: "zz", left: "a", right: "b" } }])).errors[0].code, "NAME_UNDEFINED");
  const ev = evaluate({ ...recipe([SEL]), method: "bio-calc/9" }, {});
  assert.equal(ev.refused, "METHOD_UNKNOWN");
});

// ---- evaluation ----

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
/* Every evaluation here also runs with its tables streamed (R22), and must answer the same. */
const run = (steps, bound = {}, opts) => {
  const { objects, compared, streams } = bothWays(recipe(steps, steps[steps.length - 1].as, [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "x", kind: "figure" }, { name: "y", kind: "figure" }]),
    { t: T, u: { fields: [{ name: "who", type: "string" }], rows: [] }, x: fig("1"), y: fig("2"), ...bound }, opts);
  assert.deepEqual(streams, compared, "the same answer over the streamed tables");
  return objects;
};
const names = (res) => res.result.rows.map((r) => r.name);

test("R7 select keeps rows meeting every condition (eq ne lt le gt ge in between, inclusive); an undetermined field is set aside and counted, never coerced", () => {
  const sel = (where) => run([{ op: "select", as: "s", from: "t", where }]);
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
    assert.deepEqual(r.trace[0].undetermined.map((u) => u.row), aside, JSON.stringify(where));
    assert.equal(r.undetermined_rows, aside.length);
    for (const u of r.trace[0].undetermined) assert.ok(u.why.length > 0);
  }
  assert.equal(sel([{ field: "nope", test: "eq", value: 1 }]).refused, "RECIPE_INVALID");
  assert.equal(sel([{ field: "name", test: "lt", value: "b" }]).refused, "RECIPE_INVALID");
  assert.equal(sel([{ field: "n", test: "gt", value: "€5" }]).refused, "UNIT_MISMATCH");
});

test("R8 count counts rows; sum totals exactly; difference subtracts; ratio gives numerator, denominator and value; share carries its denominator; a zero denominator is undetermined", () => {
  const exact = { fields: [{ name: "v", type: "number" }], rows: [{ v: "0.1" }, { v: "0.2" }, { v: "1,000.70" }] };
  let r = run([{ op: "count", as: "c", from: "t" }]);
  assert.deepEqual(r.result, fig("6"));
  r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: exact });
  assert.deepEqual(r.result, fig("1001.00"));
  r = run([{ op: "difference", as: "d", a: "x", b: "y" }], { x: fig("0.3"), y: fig("0.1") });
  assert.equal(r.result.value, "0.2");
  r = run([{ op: "ratio", as: "q", numerator: "x", denominator: "y" }], { x: fig("1"), y: fig("3") });
  assert.deepEqual(r.result, { numerator: fig("1"), denominator: fig("3"), value: { value: "0.333333333333", sign: "+", precision: "rounded" } });
  r = run([{ op: "ratio", as: "q", numerator: "x", denominator: "y", places: 2, mode: "up" }], { x: fig("1"), y: fig("0") });
  assert.equal(r.result.value.undetermined, true); assert.deepEqual(r.result.denominator, fig("0"));
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "name", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t" }]);
  assert.deepEqual([r.result.numerator.value, r.result.denominator.value, r.result.value.value], ["2", "6", "0.333333333333"]);
  const empty = { fields: T.fields, rows: [] };
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "name", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t" }], { t: empty });
  assert.equal(r.result.value.undetermined, true); assert.equal(r.result.denominator.value, "0");
  const money = { fields: [{ name: "k", type: "string" }, { name: "v", type: "number" }], rows: [{ k: "a", v: "3" }, { k: "b", v: "1" }] };
  r = run([{ op: "select", as: "s", from: "t", where: [{ field: "k", test: "eq", value: "a" }] }, { op: "share", as: "sh", part: "s", whole: "t", field: "v", places: 2, mode: "half_even" }], { t: money });
  assert.deepEqual([r.result.numerator.value, r.result.denominator.value, r.result.value.value], ["3", "4", "0.75"]);
  r = run([{ op: "difference", as: "d", a: "x", b: "y" }, { op: "ratio", as: "q", numerator: "d", denominator: "y" }], { x: fig("4"), y: fig("2") });
  assert.equal(r.result.value.value, "1.000000000000");
});

test("R9 group gives one result per distinct value in first-appearance order; span counts through civil-time per row; round is R4's", () => {
  const g = { fields: [{ name: "k", type: "string" }, { name: "y", type: "integer" }, { name: "v", type: "number", currency: "USD" }],
    rows: [{ k: "b", y: "1", v: "1" }, { k: "a", y: "1", v: "2.5" }, { k: "b", y: "2", v: "3" }, { k: "b", y: "1", v: "4" }, { k: "", y: "1", v: "9" }] };
  let r = run([{ op: "group", as: "g", from: "t", by: ["k"], measure: { op: "count" } }], { t: g });
  assert.deepEqual(r.result.rows, [{ k: "b", count: "3" }, { k: "a", count: "1" }]);
  assert.deepEqual(r.trace[0].undetermined.map((u) => u.row), [4]);
  r = run([{ op: "group", as: "g", from: "t", by: ["k", "y"], measure: { op: "sum", field: "v" } }], { t: g });
  assert.deepEqual(r.result.rows.map((x) => [x.k, x.y, x.sum.value]), [["b", "1", "5"], ["a", "1", "2.5"], ["b", "2", "3"]]);
  assert.equal(r.result.fields.at(-1).currency, "USD");
  r = run([{ op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" }]);
  assert.deepEqual(r.result.rows.map((x) => x.sp && signed(x.sp)), ["30", "15", null, "0", "5", null]);
  assert.deepEqual(r.trace[0].undetermined.map((u) => u.row), [2, 5]);
  assert.equal(r.result.fields.at(-1).name, "sp");
  r = run([{ op: "span", as: "sp", from: "t", start: "name", end: "e", unit: "days" }]);
  assert.equal(r.refused, "RECIPE_INVALID");
  r = run([{ op: "round", as: "r", of: "x", places: 1, mode: "half_even" }], { x: fig("2.25") });
  assert.deepEqual(r.result, { value: "2.2", sign: "+", precision: "rounded" });
});

test("R10 compare gives a relation labelled a computed fact, never a judgment", () => {
  const cmp = (x, y) => run([{ op: "compare", as: "c", a: "x", b: "y" }], { x, y }).result;
  assert.deepEqual(cmp(fig("1"), fig("2")), { relation: "lower", label: "computed fact" });
  assert.deepEqual(cmp(fig("2.0"), fig("2")), { relation: "equal", label: "computed fact" });
  assert.deepEqual(cmp(fig("3"), fig("-2")), { relation: "higher", label: "computed fact" });
  const u = cmp({ ...fig("4200000"), precision: "rounded" }, fig("4210000"));
  assert.equal(u.relation, "undetermined"); assert.equal(u.label, "computed fact"); assert.ok(u.why);
  assert.equal(cmp({ ...fig("4200000"), precision: "rounded" }, fig("4300000")).relation, "lower");
  assert.equal(cmp({ ...fig("5"), precision: "approximate" }, fig("100")).relation, "undetermined");
  assert.equal(cmp({ low: "1", high: "3", sign: "+", precision: "range" }, fig("4")).relation, "lower");
  assert.equal(cmp({ low: "1", high: "3", sign: "+", precision: "range" }, fig("2")).relation, "undetermined");
  for (const res of [cmp(fig("1"), fig("2")), cmp(fig("2"), fig("2"))]) {
    assert.deepEqual(Object.keys(res).sort(), ["label", "relation"]);
    assert.doesNotMatch(JSON.stringify(res), /breach|violat|fail|comply|complian|wrong|bad|good/i);
  }
  assert.equal(run([{ op: "compare", as: "c", a: "x", b: "y" }], { x: fig("1", { currency: "USD" }), y: fig("1") }).refused, "UNIT_MISMATCH");
});

const P = { fields: [{ name: "pid", type: "string" }, { name: "amt", type: "number" }], rows: [{ pid: "Smith, J.", amt: "5" }, { pid: "", amt: "1" }, { pid: "J SMITH", amt: "7" }, { pid: "Unknown", amt: "2" }] };
const Q = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "smith j", role: "clerk" }, { who: "Doe", role: "mayor" }, { who: "", role: "x" }] };

test("R11 join compares values only through the caller's resolver for the named space, or the crosswalk's pairs; never raw strings", () => {
  const calls = [];
  const resolveId = (space, v) => { calls.push(space); return { "Smith, J.": "P1", "J SMITH": "P1", "smith j": "P1", Doe: "P2" }[v] ?? null; };
  const step = { op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" }, space: "person" };
  let r = run([step], { t: P, u: Q }, { resolveId });
  assert.deepEqual(r.result.rows.map((x) => [x.pid, x["u.role"]]), [["Smith, J.", "clerk"], ["J SMITH", "clerk"]]);
  assert.ok(calls.length > 0 && calls.every((s) => s === "person"));
  assert.deepEqual(r.trace[0].undetermined.map((u) => `${u.side}${u.row}`).sort(), ["left1", "left3", "right2"]);
  // Equal raw strings that do not resolve are never joined.
  const same = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "Unknown", role: "z" }] };
  r = run([step], { t: P, u: same }, { resolveId });
  assert.deepEqual(r.result.rows, []);
  // No resolver for the space: undetermined, why named.
  r = run([step], { t: P, u: Q });
  assert.equal(r.result.undetermined, true); assert.match(r.result.why, /no resolver for the space/);
  // A crosswalk's pairs.
  const cw = { fields: [{ name: "a", type: "string" }, { name: "b", type: "string" }], rows: [{ a: "Smith, J.", b: "smith j" }, { a: "Unknown", b: "Doe" }] };
  const steps = [{ op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" }, crosswalk: { input: "x", left: "a", right: "b" } }];
  r = evaluate(recipe(steps, "j", [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "x", kind: "table" }]), { t: P, u: Q, x: cw });
  assert.deepEqual(r.result.rows.map((x) => [x.pid, x["u.role"]]), [["Smith, J.", "clerk"], ["Unknown", "mayor"]]);
  assert.ok(r.trace[0].undetermined.some((u) => u.side === "left" && u.row === 2 && /not in the crosswalk/.test(u.why)));
  // Unkeyed.
  const unkeyed = recipe([{ op: "join", as: "j", left: "t", right: "u", on: { left: "pid", right: "who" } }]);
  assert.equal(checkRecipe(unkeyed).errors[0].code, "JOIN_UNKEYED");
  assert.equal(evaluate(unkeyed, { t: P, u: Q, x: fig("1"), y: fig("1") }).refused, "JOIN_UNKEYED");
});

test("R12 sort orders by one numeric or date field, ascending or descending, ties in input order; a string or composed field is SORT_NOT_QUANTITY", () => {
  const S = { fields: [{ name: "id", type: "string" }, { name: "v", type: "number" }, { name: "d", type: "date" }, { name: "c", type: "number", composed: true }],
    rows: [{ id: "a", v: "3", d: "2024-02-01" }, { id: "b", v: "1.5", d: "2024-01-01" }, { id: "c", v: "3.0", d: "2024-02-01" }, { id: "d", v: "-2", d: "2023-12-31" }, { id: "e", v: "", d: "" }, { id: "f", v: "1 to 2", d: "2024-03-01" }] };
  const sort = (by, order) => run([{ op: "sort", as: "o", from: "t", by, order }], { t: S });
  assert.deepEqual(sort("v", "asc").result.rows.map((r) => r.id), ["d", "b", "a", "c"]);
  assert.deepEqual(sort("v", "desc").result.rows.map((r) => r.id), ["a", "c", "b", "d"]);
  assert.deepEqual(sort("v", "asc").trace[0].undetermined.map((u) => u.row), [4, 5]);
  assert.deepEqual(sort("d", "asc").result.rows.map((r) => r.id), ["d", "b", "a", "c", "f"]);
  assert.deepEqual(sort("d", "desc").result.rows.map((r) => r.id), ["f", "a", "c", "b", "d"]);
  assert.equal(sort("id", "asc").refused, "SORT_NOT_QUANTITY");
  assert.equal(sort("c", "asc").refused, "SORT_NOT_QUANTITY");
});

test("R13 a sum over rows differing in kind, phase or stage, basis, currency or period is refused by name, naming the values found", () => {
  for (const [field, code] of SUM_RULE) {
    const t = { fields: [{ name: "v", type: "number" }, { name: field, type: "string" }],
      rows: [{ v: "1", [field]: "alpha" }, { v: "2", [field]: "alpha" }, { v: "3", [field]: "beta" }] };
    const r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t });
    assert.equal(r.refused, code, field); assert.match(r.why, /alpha/); assert.match(r.why, /beta/);
    const same = { ...t, rows: t.rows.slice(0, 2) };
    assert.equal(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: same }).result.value, "3", field);
    const g = run([{ op: "group", as: "g", from: "t", by: [field], measure: { op: "sum", field: "v" } }], { t });
    assert.deepEqual(g.result.rows.map((x) => x.sum.value), ["3", "3"], `${field}: grouping by it separates the totals`);
  }
  const mixed = { fields: [{ name: "v", type: "number" }], rows: [{ v: "$1" }, { v: "€2" }] };
  assert.equal(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: mixed }).refused, "SUM_MIXED_CURRENCY");
});

test("R14 the trace lists each step's input rows, output, the rows set aside and why, and the method; the same arguments give the same result, reading nothing else", () => {
  const steps = [{ op: "select", as: "s", from: "t", where: [{ field: "n", test: "gt", value: 0 }] }, { op: "count", as: "c", from: "s" }, { op: "sum", as: "z", from: "s", field: "n" }];
  const a = run(steps); const b = run(steps);
  assert.deepEqual(a, b);
  assert.deepEqual(a.trace.map((t) => [t.step, t.op, t.input_rows, t.method]), [["s", "select", 6, METHOD], ["c", "count", 2, METHOD], ["z", "sum", 2, METHOD]]);
  assert.deepEqual(a.trace[1].output, fig("2"));
  assert.deepEqual(a.trace[0].output, { rows: 2 });
  assert.ok(a.trace[0].undetermined.every((u) => Number.isInteger(u.row) && typeof u.why === "string"));
  assert.equal(a.undetermined_rows, a.trace.reduce((n, t) => n + t.undetermined.length, 0));
  const frozen = structuredClone(T);
  run(steps);
  assert.deepEqual(T, frozen, "the inputs are not changed");
});

test("R20 undetermined never reads as zero: a total with an undetermined amount is undetermined, naming the rows; unbound and invalid inputs are refused by name", () => {
  const t = { fields: [{ name: "v", type: "number" }], rows: [{ v: "1" }, { v: "" }, { v: "n/a" }] };
  let r = run([{ op: "sum", as: "s", from: "t", field: "v" }], { t });
  assert.equal(r.result.undetermined, true); assert.match(r.result.why, /never read as zero/);
  assert.deepEqual(r.trace[0].undetermined.map((u) => u.row), [1, 2]);
  r = run([{ op: "sum", as: "s", from: "t", field: "v" }, { op: "difference", as: "d", a: "s", b: "x" }], { t });
  assert.equal(r.result.undetermined, true);
  const kinded = { fields: [{ name: "v", type: "number" }, { name: "kind", type: "string" }], rows: [{ v: "1", kind: "a" }, { v: "2", kind: "" }] };
  assert.equal(run([{ op: "sum", as: "s", from: "t", field: "v" }], { t: kinded }).result.undetermined, true);
  const rec = recipe([{ op: "count", as: "c", from: "t" }], "c", [{ name: "t", kind: "table" }]);
  assert.equal(evaluate(rec, {}).refused, "INPUT_UNBOUND");
  assert.equal(evaluate(rec, { t: { rows: [] } }).refused, "INPUT_INVALID");
  assert.equal(evaluate(rec, { t: { fields: [{ name: "a", type: "money" }], rows: [] } }).refused, "INPUT_INVALID");
  assert.throws(() => evaluate(rec, null), TypeError);
  assert.throws(() => evaluate(rec, {}, { resolveId: "x" }), TypeError);
});

test("R20 calc-grammar.recipe.field_shape: a table field of an unknown type is refused INPUT_INVALID, its why naming every type; calc-grammar.composed_quantity: a composed sort field says so by key", () => {
  const rec = recipe([{ op: "count", as: "c", from: "t" }], "c", [{ name: "t", kind: "table" }]);
  const shape = evaluate(rec, { t: { fields: [{ name: "a", type: "money" }], rows: [] } });
  assert.equal(shape.refused, "INPUT_INVALID");
  for (const type of ["string", "number", "integer", "date", "datetime", "boolean"]) assert.ok(shape.why.includes(type), type);
  const composed = { fields: [{ name: "c", type: "number", composed: true }], rows: [] };
  const sorted = run([{ op: "sort", as: "o", from: "t", by: "c", order: "asc" }], { t: composed });
  assert.equal(sorted.refused, "SORT_NOT_QUANTITY");
  assert.ok(sorted.why.includes(word("calc-grammar.composed_quantity")));
});
