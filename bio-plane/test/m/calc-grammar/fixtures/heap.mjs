/* Run with `--expose-gc`: evaluates recipes of every op over a streamed table of 100,000 rows × 10 fields
   (1,000,000 cells), whose rows are made afresh on each pass as a caller streaming a CSV makes them, and prints,
   per recipe, the heap's growth over the baseline in bytes: the most live heap seen while evaluating and reading
   the answer (the heap is collected and read every 5,000 rows a pass yields), and what the answer holds after. */
import { evaluate, METHOD } from "../../../../src/calc-grammar/index.mjs";
import { isObject } from "../../../../src/calc-grammar/decimal.mjs";

/** @import { Data, Field } from "../../../../src/calc-grammar/tables.mjs" */
/** @import { Step, RecipeInput } from "../../../../src/calc-grammar/recipe.mjs" */

/** A streamed table whose rows are made afresh on each pass. @typedef {{ fields: Field[], rows: () => Generator<string[], void, undefined> }} MadeTable */
/** What the fixture prints for one recipe. @typedef {{ growth: number, held: number, refused: string | null, result_rows: number | null, undetermined_rows: number | null }} Measure */
/** The global object with Node's collector, which `--expose-gc` puts there. @typedef {{ gc: () => void }} Collecting */
/** The process with Node's `memoryUsage`. @typedef {{ memoryUsage: () => { heapUsed: number } }} Measuring */

export const ROWS = 100_000;
/** @type {Field[]} */
export const FIELDS = [{ name: "id", type: "string" }, { name: "dept", type: "string" }, { name: "amt", type: "number", currency: "USD" },
  { name: "qty", type: "integer" }, { name: "d", type: "date" }, { name: "e", type: "date" }, { name: "kind", type: "string" },
  { name: "ok", type: "boolean" }, { name: "code", type: "string" }, { name: "note", type: "string" }];
/** @param {number} n @returns {string} */
const two = (n) => (n < 10 ? `0${n}` : `${n}`);
/** Row i, made afresh: every cell a new string. @param {number} i @returns {string[]} */
export const rowAt = (i) => [`R-${i}`, `dept ${i % 20}`, `${(i * 7919) % 100000}.${two(i % 100)}`, `${i % 1000}`,
  `2024-${two(1 + (i % 12))}-${two(1 + (i % 28))}`, `2025-${two(1 + ((i * 5) % 12))}-${two(1 + ((i * 3) % 28))}`,
  "spending", i % 3 ? "true" : "false", `C${i % 1000}`, `row ${i} of the fixture`];

let peak = 0;
let sampling = false;
/* The host's heap facilities, which the tool's description of Node leaves out: read off the global object and the
   process, and called as Node gives them. */
/** @param {unknown} g @returns {g is Collecting} */
const isCollecting = (g) => { const o = isObject(g) ? g : null; return o !== null && typeof o.gc === "function"; };
/** @param {unknown} p @returns {p is Measuring} */
const isMeasuring = (p) => { const o = isObject(p) ? p : null; return o !== null && typeof o.memoryUsage === "function"; };
/** Runs `globalThis.gc()`. @returns {void} */
const gc = () => {
  const g = globalThis;
  if (!isCollecting(g)) throw new TypeError("globalThis.gc is not a function");
  g.gc();
};
/** `process.memoryUsage().heapUsed`. @returns {number} */
const heapUsed = () => {
  const p = process;
  if (!isMeasuring(p)) throw new TypeError("process.memoryUsage is not a function");
  return p.memoryUsage().heapUsed;
};
const sample = () => { if (!sampling) return; gc(); peak = Math.max(peak, heapUsed()); };
/** @param {number} [n] @returns {MadeTable} */
export const table = (n = ROWS) => ({ fields: FIELDS, rows: function* rows() {
  for (let i = 0; i < n; i++) { if (i % 5000 === 0) sample(); yield rowAt(i); }
} });
const depts = { fields: [{ name: "dept", type: "string" }, { name: "head", type: "string" }],
  rows: () => Array.from({ length: 20 }, (_, k) => [`dept ${k}`, `head ${k}`])[Symbol.iterator]() };

/** @type {{ [name: string]: Step[] }} */
export const RECIPES = {
  select: [{ op: "select", as: "s", from: "t", where: [{ field: "amt", test: "ge", value: 0 }] }],
  count: [{ op: "count", as: "c", from: "t" }],
  sum: [{ op: "sum", as: "z", from: "t", field: "amt" }],
  share: [{ op: "select", as: "s", from: "t", where: [{ field: "ok", test: "eq", value: true }] }, { op: "share", as: "sh", part: "s", whole: "t", field: "amt" }],
  "group by dept": [{ op: "group", as: "g", from: "t", by: ["dept"], measure: { op: "sum", field: "amt" } }],
  "group by id (one row each)": [{ op: "group", as: "g", from: "t", by: ["id"], measure: { op: "count" } }],
  span: [{ op: "span", as: "sp", from: "t", start: "d", end: "e", unit: "days" }],
  sort: [{ op: "sort", as: "o", from: "t", by: "amt", order: "desc" }],
  "join to a small table": [{ op: "join", as: "j", left: "t", right: "u", on: { left: "dept", right: "dept" }, space: "dept" }],
  "join to itself": [{ op: "join", as: "j", left: "t", right: "t", on: { left: "id", right: "id" }, space: "row" }],
  "select, sort, span, group": [{ op: "select", as: "s", from: "t", where: [{ field: "qty", test: "lt", value: 900 }] },
    { op: "sort", as: "o", from: "s", by: "d", order: "asc" }, { op: "span", as: "sp", from: "o", start: "d", end: "e", unit: "days" },
    { op: "group", as: "g", from: "sp", by: ["dept"], measure: { op: "sum", field: "sp" } }],
  "figures: difference, ratio, compare, round": [{ op: "sum", as: "a", from: "t", field: "qty" }, { op: "count", as: "b", from: "t" },
    { op: "difference", as: "df", a: "a", b: "b" }, { op: "ratio", as: "r", numerator: "a", denominator: "b" },
    { op: "compare", as: "cm", a: "a", b: "b" }, { op: "round", as: "rd", of: "r", places: 2, mode: "half_even" }],
};
/** The steps of the recipe named, from RECIPES. @param {string} name @returns {Step[]} */
export const recipeSteps = (name) => {
  const steps = RECIPES[name];
  if (steps === undefined) throw new TypeError(`no recipe ${name}`);
  return steps;
};
/** The name of the last step, the recipe's output. @param {Step[]} steps @returns {string} */
export const lastAs = (steps) => {
  const last = steps[steps.length - 1];
  if (last === undefined) throw new TypeError("a recipe has no steps");
  return last.as;
};
/** @type {RecipeInput[]} */
const INPUTS = [{ name: "t", kind: "table" }, { name: "u", kind: "table" }];
/** @param {Step[]} steps */
export const recipeOf = (steps) => ({ method: METHOD, inputs: INPUTS, steps, output: lastAs(steps) });
/** @param {string} _space @param {Data} v @returns {string} */
export const resolveId = (_space, v) => String(v);

const script = process.argv[1];
if (script && import.meta.url.endsWith(String(script.split("/").pop()))) {
  if (!isCollecting(globalThis)) throw new Error("run with --expose-gc");
  /** @type {{ [name: string]: Measure }} */
  const out = {};
  for (const [name, steps] of Object.entries(RECIPES)) {
    const t = table();
    gc(); gc();
    const base = heapUsed();
    peak = base; sampling = true;
    const r = evaluate(recipeOf(steps), { t, u: depts }, { resolveId });
    const result = "result" in r ? r.result : undefined;
    const resultRows = result && "rows" in result ? result.rows : undefined;
    /** @type {number | null} */
    let rows = null;
    if (typeof resultRows === "function") { let read = 0; for (const _ of resultRows()) { read += 1; if (read % 5000 === 0) sample(); } rows = read; }
    sampling = false;
    gc(); gc();
    const after = heapUsed();
    out[name] = { growth: Math.max(peak, after) - base, held: after - base, refused: "refused" in r ? r.refused : null,
      result_rows: rows, undetermined_rows: "undetermined_rows" in r ? r.undetermined_rows : null };
    Reflect.set(globalThis, "keep", r); Reflect.set(globalThis, "keep", null);
  }
  process.stdout.write(JSON.stringify(out));
}
