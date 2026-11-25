/* calc-grammar at its interface: `relate` from the index (R21) and the streamed table (R22). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as calc from "../../../src/calc-grammar/index.mjs";
import { bothWays, streamed, asObjects } from "./fixtures/stream.mjs";
import { FIELDS, rowAt, table, RECIPES, recipeOf, resolveId } from "./fixtures/heap.mjs";

const { relate, evaluate, METHOD, OPS } = calc;
const fig = (s, extra = {}) => (s.startsWith("-") ? { value: s.slice(1), sign: "-", precision: "exact", ...extra }
  : { value: s, sign: "+", precision: "exact", ...extra });

test("R21 relate is exported from the index: R10's relation of two figures, lower, equal, higher or undetermined with why; UNIT_MISMATCH naming both", () => {
  assert.equal(typeof relate, "function");
  const R = (lo, hi) => ({ low: lo, high: hi, sign: lo.startsWith("-") ? "-" : "+", precision: "range" });
  const rounded = (v) => ({ ...fig(v), precision: "rounded" });
  for (const [a, b, want] of [
    [fig("1"), fig("2"), "lower"], [fig("2"), fig("1"), "higher"], [fig("2.0"), fig("2"), "equal"], [fig("-3"), fig("-3.00"), "equal"],
    [fig("-3"), fig("2"), "lower"], [fig("0"), fig("-0.01"), "higher"],
    [rounded("4200000"), fig("4300000"), "lower"], [rounded("4200000"), fig("4100000"), "higher"],
    [R("1", "3"), fig("4"), "lower"], [R("1", "3"), fig("0.5"), "higher"], [R("1", "3"), R("3.5", "9"), "lower"],
    [fig("5", { currency: "USD" }), fig("7", { currency: "USD" }), "lower"], [fig("5", { unit: "percent" }), fig("5", { unit: "percent" }), "equal"],
  ]) assert.equal(relate(a, b), want, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
  for (const [a, b] of [[rounded("4200000"), fig("4210000")], [rounded("4200000"), rounded("4200000")], [{ ...fig("5"), precision: "approximate" }, fig("100")],
    [R("1", "3"), fig("2")], [R("1", "3"), R("3", "4")], [fig("2"), rounded("2")]]) {
    const r = relate(a, b);
    assert.equal(r.undetermined, true, JSON.stringify([a, b])); assert.ok(r.why.length > 0);
  }
  for (const [a, b, names] of [[fig("1", { currency: "USD" }), fig("1", { currency: "EUR" }), ["currency USD", "currency EUR"]],
    [fig("1", { currency: "USD" }), fig("1"), ["currency USD", "no unit or currency"]], [fig("1", { unit: "percent" }), fig("1", { unit: "FTE" }), ["unit percent", "unit FTE"]]]) {
    const r = relate(a, b);
    assert.equal(r.refused, "UNIT_MISMATCH");
    for (const n of names) assert.ok(r.why.includes(n), r.why);
  }
  assert.equal(relate({ value: "1e3", sign: "+", precision: "exact" }, fig("1")).refused, "FIGURE_INVALID");
  assert.throws(() => relate(1, fig("1")), TypeError);
  // The relation compare (R10) labels is relate's.
  const cmp = evaluate({ method: METHOD, inputs: [{ name: "a", kind: "figure" }, { name: "b", kind: "figure" }], steps: [{ op: "compare", as: "c", a: "a", b: "b" }], output: "c" },
    { a: rounded("4200000"), b: fig("4300000") });
  assert.deepEqual(cmp.result, { relation: relate(rounded("4200000"), fig("4300000")), label: "computed fact" });
});

/* A table with every kind of cell an evaluation reads: undetermined ones, figures as objects, dates, a SUM_RULE field. */
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
const U = { fields: [{ name: "who", type: "string" }, { name: "role", type: "string" }], rows: [{ who: "A", role: "clerk" }, { who: "B", role: "mayor" }, { who: "", role: "x" }, { who: "a", role: "deputy" }] };
const CW = { fields: [{ name: "l", type: "string" }, { name: "r", type: "string" }], rows: [{ l: "a", r: "A" }, { l: "b", r: "B" }, { l: "b", r: "a" }, { l: "c", r: "" }] };
const P = { fields: [{ name: "v", type: "number" }, { name: "period", type: "string" }], rows: [{ v: "1", period: "FY24" }, { v: "$2", period: "FY25" }] };
const inputs = [{ name: "t", kind: "table" }, { name: "u", kind: "table" }, { name: "cw", kind: "table" }, { name: "p", kind: "table" }, { name: "x", kind: "figure" }];
const S = (op, as, more) => ({ op, as, ...more });
const sel = S("select", "s", { from: "t", where: [{ field: "n", test: "ge", value: "0" }] });
const CASES = {
  select: [sel],
  "select, several conditions": [S("select", "s", { from: "t", where: [{ field: "d", test: "between", value: ["2024-01-01", "2024-02-28"] }, { field: "name", test: "in", value: ["a", "b", ""] }] })],
  count: [sel, S("count", "c", { from: "s" })],
  sum: [S("sum", "z", { from: "t", field: "i" })],
  "sum, undetermined": [S("sum", "z", { from: "t", field: "n" })],
  "sum, refused by a period": [S("select", "s", { from: "p", where: [{ field: "v", test: "ge", value: 0 }] }), S("sum", "z", { from: "s", field: "v" })],
  difference: [S("sum", "z", { from: "t", field: "i" }), S("difference", "df", { a: "z", b: "x" })],
  ratio: [S("count", "c", { from: "t" }), S("ratio", "r", { numerator: "x", denominator: "c" })],
  share: [sel, S("share", "sh", { part: "s", whole: "t" })],
  "share of a field": [S("select", "s", { from: "t", where: [{ field: "ok", test: "eq", value: true }] }), S("share", "sh", { part: "s", whole: "t", field: "i", places: 3, mode: "up" })],
  "group, count": [S("group", "g", { from: "t", by: ["name"], measure: { op: "count" } })],
  "group, sum": [S("group", "g", { from: "t", by: ["name", "period"], measure: { op: "sum", field: "i" } })],
  "group, an undetermined sum": [S("group", "g", { from: "t", by: ["ok"], measure: { op: "sum", field: "n" } })],
  span: [S("span", "sp", { from: "t", start: "d", end: "e", unit: "days" })],
  "span, then sort by it": [S("span", "sp", { from: "t", start: "d", end: "e", unit: "days" }), S("sort", "o", { from: "sp", by: "sp", order: "asc" })],
  compare: [S("count", "c", { from: "t" }), S("compare", "cm", { a: "c", b: "x" })],
  round: [S("count", "c", { from: "t" }), S("ratio", "r", { numerator: "x", denominator: "c" }), S("round", "rd", { of: "r", places: 1, mode: "half_up" })],
  "join through a space": [S("join", "j", { left: "t", right: "u", on: { left: "name", right: "who" }, space: "letters" })],
  "join through a crosswalk": [S("join", "j", { left: "t", right: "u", on: { left: "name", right: "who" }, crosswalk: { input: "cw", left: "l", right: "r" } })],
  "join, then select, sort and group": [S("join", "j", { left: "t", right: "u", on: { left: "name", right: "who" }, space: "letters" }),
    S("select", "s2", { from: "j", where: [{ field: "u.role", test: "ne", value: "x" }] }), S("sort", "o", { from: "s2", by: "i", order: "desc" }),
    S("group", "g", { from: "o", by: ["u.role"], measure: { op: "count" } })],
  "sort by a number": [S("sort", "o", { from: "t", by: "i", order: "desc" })],
  "sort by a date": [S("sort", "o", { from: "t", by: "d", order: "asc" })],
  "sort, refused by a currency": [S("sort", "o", { from: "p", by: "v", order: "asc" })],
  "an input as the output": [S("count", "c", { from: "t" })],
};
const run = (steps, output, bound = {}, opts = { resolveId: (_s, v) => String(v).toUpperCase() || null }) =>
  bothWays({ method: METHOD, inputs, steps, output: output ?? steps[steps.length - 1].as }, { t: T, u: U, cw: CW, p: P, x: fig("3"), ...bound }, opts);

test("R22 over a streamed table evaluate answers exactly as over the same table bound as row objects: every op, alone and chained, its result, undetermined rows and trace", () => {
  const seen = new Set();
  for (const [name, steps] of Object.entries(CASES)) {
    const { objects, compared, streams } = run(steps, name === "an input as the output" ? "t" : undefined);
    assert.deepEqual(streams, compared, name);
    for (const st of steps) seen.add(st.op);
    if (name.includes("refused")) assert.ok(objects.refused, name); else assert.ok(objects.trace, `${name}: ${objects.refused} ${objects.why}`);
  }
  assert.deepEqual([...seen].sort(), [...OPS].sort(), "every op of the grammar");
  // A table result over a streamed table is a streamed table: rows() answers a new iterator each call, over arrays in fields order.
  const s = evaluate({ method: METHOD, inputs, steps: CASES.span, output: "sp" }, { t: streamed(T), u: streamed(U), cw: streamed(CW), p: P, x: fig("3") });
  assert.equal(typeof s.result.rows, "function");
  const first = [...s.result.rows()]; const again = [...s.result.rows()];
  assert.deepEqual(first, again);
  assert.ok(first.every((r) => Array.isArray(r) && r.length === s.result.fields.length));
  // Bound one way and the other in one recipe: the same answer.
  const mixed = evaluate({ method: METHOD, inputs, steps: CASES["join through a crosswalk"], output: "j" }, { t: T, u: streamed(U), cw: CW, p: streamed(P), x: fig("3") });
  assert.deepEqual(asObjects(mixed), run(CASES["join through a crosswalk"]).compared);
  // No resolver for the space: undetermined, as over row objects.
  const { streams, compared } = run(CASES["join through a space"], undefined, {}, {});
  assert.deepEqual(streams, compared); assert.equal(streams.result.undetermined, true);
});

test("R22 at scale: past a pass's read-ahead (several passes), sort, join and group answer as over row objects", () => {
  const n = 40_000;
  const t = { fields: FIELDS, rows: Array.from({ length: n }, (_, i) => Object.fromEntries(FIELDS.map((f, k) => [f.name, rowAt(i)[k]]))) };
  const u = { fields: [{ name: "id", type: "string" }, { name: "w", type: "integer" }], rows: Array.from({ length: n }, (_, i) => ({ id: `R-${(i * 7) % n}`, w: String(i) })) };
  for (const steps of [RECIPES.sort, RECIPES["select, sort, span, group"],
    [S("sort", "o", { from: "t", by: "amt", order: "asc" }), S("join", "j", { left: "o", right: "u", on: { left: "id", right: "id" }, space: "row" }), S("sort", "o2", { from: "j", by: "u.w", order: "desc" })]]) {
    const { streams, compared } = bothWays({ method: METHOD, inputs: [{ name: "t", kind: "table" }, { name: "u", kind: "table" }], steps, output: steps[steps.length - 1].as }, { t, u }, { resolveId });
    assert.ok(!compared.refused, compared.why);
    assert.deepEqual(streams, compared, steps.map((s) => s.op).join(" "));
  }
});

test("R22 a malformed streamed table is refused INPUT_INVALID, as a malformed table is; so is one that reads another table on a later pass", () => {
  const rec = { method: METHOD, inputs: [{ name: "t", kind: "table" }], steps: [{ op: "count", as: "c", from: "t" }], output: "c" };
  const f = [{ name: "a", type: "string" }, { name: "b", type: "number" }];
  for (const [what, t] of [
    ["rows neither a list nor a function", { fields: f, rows: "a,b" }],
    ["rows answers no iterator", { fields: f, rows: () => 5 }],
    ["rows throws", { fields: f, rows: () => { throw new Error("gone"); } }],
    ["a row is an object", { fields: f, rows: () => [{ a: "x", b: "1" }][Symbol.iterator]() }],
    ["a row is short", { fields: f, rows: () => [["x"]][Symbol.iterator]() }],
    ["a row is long", { fields: f, rows: () => [["x", "1", "2"]][Symbol.iterator]() }],
    ["the iterator throws", { fields: f, rows: function* rows() { yield ["x", "1"]; throw new Error("broken stream"); } }],
    ["a field is malformed", { fields: [{ name: "a", type: "money" }], rows: () => [][Symbol.iterator]() }],
    ["a field is declared twice", { fields: [f[0], f[0]], rows: () => [][Symbol.iterator]() }],
  ]) {
    const r = evaluate(rec, { t });
    assert.equal(r.refused, "INPUT_INVALID", what); assert.ok(r.why.includes('"t"'), `${what}: ${r.why}`);
  }
  // Read again, a different table: refused at the step that read it, never answered from half a table.
  let pass = 0;
  const shifting = { fields: f, rows: () => { pass += 1; return Array.from({ length: pass === 1 ? 3 : 2 }, () => ["x", "1"])[Symbol.iterator](); } };
  const r = evaluate({ ...rec, steps: [{ op: "sum", as: "z", from: "t", field: "b" }], output: "z" }, { t: shifting });
  assert.equal(r.refused, "INPUT_INVALID"); assert.equal(r.step, "z"); assert.match(r.why, /3 rows on its first pass and 2/);
  pass = 0;
  const bad = { fields: f, rows: () => { pass += 1; return [pass === 1 ? ["x", "1"] : ["x"]][Symbol.iterator](); } };
  assert.equal(evaluate({ ...rec, steps: [{ op: "sum", as: "z", from: "t", field: "b" }], output: "z" }, { t: bad }).refused, "INPUT_INVALID");
  // An empty streamed table is a table.
  assert.deepEqual(evaluate(rec, { t: { fields: f, rows: () => [][Symbol.iterator]() } }).result, fig("0"));
});

test("R22 evaluating any recipe of the grammar over a streamed table of 1,000,000 cells grows the heap by less than the 35 MB K1576 measured for 500,000 cells as row objects", (t) => {
  const out = JSON.parse(execFileSync(process.execPath, ["--expose-gc", fileURLToPath(new URL("./fixtures/heap.mjs", import.meta.url))],
    { encoding: "utf8", maxBuffer: 1 << 20 }));
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
  assert.equal(out.select.result_rows, 100_000);
  assert.equal(out["group by dept"].result_rows, 20);
});
