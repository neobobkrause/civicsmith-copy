/* A table bound as row objects, bound again as a streamed table (R22), and evaluate's answers over both read back as
   row objects, so a test can compare them. */
import { evaluate } from "../../../../src/calc-grammar/index.mjs";
import { isObject } from "../../../../src/calc-grammar/decimal.mjs";

/** @import { Refusal } from "../../../../src/calc-grammar/decimal.mjs" */
/** @import { Data, Members, Field } from "../../../../src/calc-grammar/tables.mjs" */
/** @import { Evaluation, EvalRefusal, EvalOptions, List } from "../../../../src/calc-grammar/recipe.mjs" */

/** A table bound as row objects. @typedef {{ fields: Field[], rows: Members[] }} ObjectTable */
/** What `evaluate` answers. @typedef {Evaluation | EvalRefusal | Refusal} Answer */
/** A table bound streamed, its rows an iterator over arrays of cells. @typedef {{ fields: Field[], rows: () => IterableIterator<Data[]> }} StreamedObjects */
/** One recipe evaluated both ways. @typedef {{ objects: Answer, compared: Answer, streams: Answer }} BothWays */

/** The same table, streamed: `rows()` answers a new iterator over arrays of cells in `fields` order.
 *  @param {ObjectTable} t @returns {StreamedObjects} */
export const streamed = (t) => ({ fields: t.fields, rows: () => t.rows.map((r) => t.fields.map((f) => r[f.name]))[Symbol.iterator]() });

/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);
/** @param {unknown} v @returns {v is ObjectTable} */
const isTable = (v) => { const o = isObject(v) ? v : null; return o !== null && isList(o.fields) && isList(o.rows); };

/* A row object from a streamed row; a cell the object table did not hold stays absent. */
/** @param {Field[]} fields @param {Members | Data[]} row @returns {Members} */
const asObject = (fields, row) => {
  /** @type {Members} */
  const out = {};
  fields.forEach((f, k) => { const cell = isList(row) ? row[k] : row[String(k)]; if (cell !== undefined) out[f.name] = cell; });
  return out;
};

/** A table result read as row objects (a streamed one by its `rows()`); any other answer unchanged.
 *  @param {Answer} answer @returns {Answer} */
export function asObjects(answer) {
  if (!("result" in answer)) return answer;
  const result = answer.result;
  if (!("rows" in result)) return answer;
  const { fields } = result;
  const rows = result.rows;
  if (typeof rows !== "function") return answer;
  return { ...answer, result: { fields, rows: [...rows()].map((r) => asObject(fields, r)) } };
}

/* An answer over row objects with each result row keyed by its fields only, as a streamed row reads back. */
/** @param {Answer} answer @returns {Answer} */
function byFields(answer) {
  if (!("result" in answer)) return answer;
  const result = answer.result;
  if (!isTable(result)) return answer;
  const { fields, rows } = result;
  return { ...answer, result: { fields, rows: rows.map((r) => asObject(fields, fields.map((f) => r[f.name]))) } };
}

/** Evaluate over `bound`, and again with every table input streamed: `{objects, streams, compared}`, the second read
 *  back as row objects and `compared` the first keyed as the second is.
 *  @param {unknown} recipe @param {Members} bound @param {EvalOptions} [opts] @returns {BothWays} */
export function bothWays(recipe, bound, opts) {
  const objects = evaluate(recipe, bound, opts);
  const compared = byFields(objects);
  /** @type {Members} */
  const s = {};
  for (const [k, v] of Object.entries(bound)) s[k] = isTable(v) ? streamed(v) : v;
  return { objects, compared, streams: asObjects(evaluate(recipe, s, opts)) };
}
