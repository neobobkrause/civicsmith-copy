/* calc-grammar's recipes (requirements: `build/requirements/calc-grammar.md`, R6–R15, R18, R20). A recipe is data in
 * one closed grammar, `bio-calc/1`: a list of steps, each one of twelve forms, every field of which is checked
 * before anything runs. Nothing in a recipe is ever run as code. `evaluate` reads only its arguments: the same
 * recipe and bindings give the same result, and every row it could not decide is set aside and named, never
 * coerced and never read as zero. */

import { canonicalJson, sha256HexSync } from "../record-grammar/index.mjs";
import { compare as compareTimes, span as spanTimes } from "../civil-time/index.mjs";
import { parseFigure } from "./figures.mjs";
import { MODES, MAX_PLACES, add, subtract, divide, round, relate, figureFault, isFigure, isObject, statedValue, cmpD,
  refusal, undetermined, isRefusal, isUndetermined } from "./decimal.mjs";
import { Refused, stop, objectTable, heldTable, streamFault, streamTable, filterView, orderView, extendView, joinView,
  answerOf, cellOf, messageOf } from "./tables.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** @import { Dec, Figure, Mode, Refusal, Undetermined, Relation } from "./decimal.mjs" */
/** @import { Data, Members, Field, FieldType, Held, StreamedTable, TableAnswer, RowSource } from "./tables.mjs" */

/** @typedef {"select" | "count" | "sum" | "difference" | "ratio" | "share" | "group" | "span" | "compare" | "round" | "join" | "sort"} Op */
/** @typedef {"eq" | "ne" | "lt" | "le" | "gt" | "ge" | "in" | "between"} Test */
/** @typedef {"days" | "business days" | "hours" | "months" | "years"} SpanUnit */
/** What a step answers. @typedef {"table" | "figure" | "ratio" | "comparison"} Produces */
/** A condition's literal. @typedef {string | boolean | number} Literal */
/**
 * A condition of a `select`: the field, the test, and its literal (a list for `in`, a low and a high for `between`).
 * @typedef {Object} Condition
 * @property {string} field
 * @property {Test} test
 * @property {Literal | Literal[]} value
 * @bound value: a string, a boolean or a whole number
 */
/** @typedef {{ op: "select", as: string, from: string, where: Condition[] }} SelectStep */
/** @typedef {{ op: "count", as: string, from: string }} CountStep */
/** @typedef {{ op: "sum", as: string, from: string, field: string }} SumStep */
/** @typedef {{ op: "difference", as: string, a: string, b: string }} DifferenceStep */
/** @typedef {{ op: "ratio", as: string, numerator: string, denominator: string, places?: number, mode?: Mode }} RatioStep */
/** @typedef {{ op: "share", as: string, part: string, whole: string, field?: string, places?: number, mode?: Mode }} ShareStep */
/** @typedef {{ op: "count" } | { op: "sum", field: string }} Measure */
/** @typedef {{ op: "group", as: string, from: string, by: string[], measure: Measure }} GroupStep */
/** @typedef {{ op: "span", as: string, from: string, start: string, end: string, unit: SpanUnit, into?: string }} SpanStep */
/** @typedef {{ op: "compare", as: string, a: string, b: string }} CompareStep */
/** @typedef {{ op: "round", as: string, of: string, places: number, mode: Mode }} RoundStep */
/** @typedef {{ left: string, right: string }} JoinOn */
/** @typedef {{ input: string, left: string, right: string }} Crosswalk */
/** @typedef {{ op: "join", as: string, left: string, right: string, on: JoinOn, space?: string, crosswalk?: Crosswalk }} JoinStep */
/** @typedef {{ op: "sort", as: string, from: string, by: string, order: "asc" | "desc" }} SortStep */
/** @typedef {SelectStep | CountStep | SumStep | DifferenceStep | RatioStep | ShareStep | GroupStep | SpanStep | CompareStep | RoundStep | JoinStep | SortStep} Step */
/** @typedef {{ name: string, kind: "table" | "figure" }} RecipeInput */
/**
 * A recipe in the closed grammar `bio-calc/1` (R6), as `checkRecipe` accepts it.
 * @typedef {Object} Recipe
 * @property {"bio-calc/1"} method
 * @property {RecipeInput[]} inputs
 * @property {Step[]} steps
 * @property {string} output
 * @bound names: letters, digits and _, not starting with a digit, at most 64; field names 1 to 200 characters; places 0 to 64
 */
/**
 * One fault `checkRecipe` finds: its code, the step (its name, or its place in the list) and field, and why.
 * @typedef {Object} RecipeError
 * @property {string} code
 * @property {string | number | null} step
 * @property {string | null} field
 * @property {string} why
 */
/** @typedef {{ ok: true } | { ok: false, errors: RecipeError[] }} Checked */
/** A row set aside as undetermined, and why; a join names the side. @typedef {{ side?: "left" | "right", row: number, why: string }} SetAside */
/**
 * R8's ratio: numerator, denominator and their quotient.
 * @typedef {Object} Ratio
 * @property {Figure | Undetermined} numerator
 * @property {Figure | Undetermined} denominator
 * @property {Figure | Undetermined} value
 */
/** R10's comparison, a computed fact. @typedef {{ relation: Relation, label: "computed fact" } | { relation: "undetermined", why: string, label: "computed fact" }} Comparison */
/** @typedef {{ kind: "table", value: Held | Undetermined, inputRows?: number, set: SetAside[] }} TableOut */
/** @typedef {{ kind: "figure", value: Figure | Undetermined, inputRows?: number, set: SetAside[] }} FigureOut */
/** @typedef {{ kind: "ratio", value: Ratio | Undetermined, inputRows?: number, set: SetAside[] }} RatioOut */
/** @typedef {{ kind: "comparison", value: Comparison | Undetermined, inputRows?: number, set: SetAside[] }} ComparisonOut */
/** A step's answer. @typedef {TableOut | FigureOut | RatioOut | ComparisonOut} Out */
/** An input as `evaluate` holds it. @typedef {{ kind: "table", value: Held } | { kind: "figure", value: Figure }} InputEntry */
/** What a step's trace line shows of its answer. @typedef {Figure | Ratio | Comparison | Undetermined | { rows: number }} Summary */
/**
 * One step's line of the trace (R14).
 * @typedef {Object} TraceLine
 * @property {string} step
 * @property {Op} op
 * @property {number | null} input_rows
 * @property {Summary} output
 * @property {SetAside[]} undetermined
 * @property {string} method
 */
/**
 * What `evaluate` answers (R14): the result, how many rows were set aside, and the trace.
 * @typedef {Object} Evaluation
 * @property {Figure | Ratio | Comparison | TableAnswer | Undetermined} result
 * @property {number} undetermined_rows
 * @property {TraceLine[]} trace
 */
/**
 * A refusal by `evaluate`: by name, with the step that stopped and the trace so far, or the recipe's faults.
 * @typedef {Object} EvalRefusal
 * @property {string} refused
 * @property {string} why
 * @property {string | number | null} [step]
 * @property {RecipeError[]} [errors]
 * @property {TraceLine[]} [trace]
 */
/**
 * `evaluate`'s options: the caller's normaliser for a join (R11), and civil-time's view and office for a span (R9).
 * @typedef {Object} EvalOptions
 * @property {(space: string, value: Data) => Data} [resolveId]
 * @property {Data} [view]
 * @property {Data} [office]
 */
/** A table input as bound. @typedef {{ fields: Field[], rows: Members[] | (() => RowSource) }} BoundTable */
/** A date or time as a cell is read: its text, its precision and its zone. @typedef {{ value: string, precision: string, zone: string }} DateTime */
/** A date cell given as an object. @typedef {{ value: string, precision: string }} DateIn */
/** A cell read as its field's type. @typedef {string | boolean | Figure | DateTime | DateIn} Value */
/** @typedef {{ v: Value }} Read */
/** A numeric cell whose unit or currency is not its field's. @typedef {{ undetermined: true, why: string, mismatch: true }} Mismatch */
/** @typedef {Undetermined | Mismatch} Unread */
/** A sum's answer for one group. @typedef {{ v: Figure, rows: SetAside[] } | { u: Undetermined, rows: SetAside[] }} Total */
/** How the steps reach the names before them. @typedef {{ table: (n: string) => Held, value: (n: string) => Data }} Access */

export const METHOD = "bio-calc/1";
/** @type {readonly Op[]} */
export const OPS = Object.freeze(["select", "count", "sum", "difference", "ratio", "share", "group", "span", "compare",
  "round", "join", "sort"]);
/** @type {readonly Test[]} */
export const TESTS = Object.freeze(["eq", "ne", "lt", "le", "gt", "ge", "in", "between"]);
/** @type {readonly FieldType[]} */
export const FIELD_TYPES = Object.freeze(["string", "number", "integer", "date", "datetime", "boolean"]);
/** @type {readonly SpanUnit[]} */
export const SPAN_UNITS = Object.freeze(["days", "business days", "hours", "months", "years"]);
/** @type {Readonly<{ places: number, mode: Mode }>} */
export const RATIO_DEFAULT = Object.freeze({ places: 12, mode: "half_even" });
/** R13: a declared field whose values must agree across a sum, and the refusal when they do not.
 *  @type {ReadonlyArray<readonly [string, string]>} */
export const SUM_RULE = Object.freeze([["kind", "SUM_MIXED_KIND"], ["phase", "SUM_MIXED_STAGE"],
  ["stage", "SUM_MIXED_STAGE"], ["basis", "SUM_MIXED_BASIS"], ["currency", "SUM_MIXED_CURRENCY"],
  ["period", "SUM_MIXED_PERIOD"]]);

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** @type {readonly FieldType[]} */
const QUANTITY_TYPES = ["number", "integer", "date", "datetime"];
/** @type {readonly Test[]} */
const ORDER_TESTS = ["lt", "le", "gt", "ge", "between"];
/** @type {readonly ("unit" | "currency")[]} */
const DIMS = ["unit", "currency"];

/* Each op's form: its fields, which are required, and what each holds. `ref:<kind>` names an input or an earlier
   step of that kind (`value` takes a figure or a ratio); `field` a table field; the rest are checked by shape. */
/** @type {[Op, { readonly [field: string]: string }][]} */
const FORM_LIST = [
  ["select", { from: "ref:table", where: "conditions" }],
  ["count", { from: "ref:table" }],
  ["sum", { from: "ref:table", field: "field" }],
  ["difference", { a: "ref:value", b: "ref:value" }],
  ["ratio", { numerator: "ref:value", denominator: "ref:value", places: "?places", mode: "?mode" }],
  ["share", { part: "ref:table", whole: "ref:table", field: "?field", places: "?places", mode: "?mode" }],
  ["group", { from: "ref:table", by: "fields", measure: "measure" }],
  ["span", { from: "ref:table", start: "field", end: "field", unit: "unit", into: "?field" }],
  ["compare", { a: "ref:value", b: "ref:value" }],
  ["round", { of: "ref:value", places: "places", mode: "mode" }],
  ["join", { left: "ref:table", right: "ref:table", on: "on", space: "?field", crosswalk: "?crosswalk" }],
  ["sort", { from: "ref:table", by: "field", order: "order" }],
];
const FORMS = new Map(FORM_LIST);

/** @param {Op} op @returns {Produces} */
function produces(op) {
  switch (op) {
    case "count": case "sum": case "difference": case "round": return "figure";
    case "ratio": case "share": return "ratio";
    case "compare": return "comparison";
    default: return "table"; // select, group, span, join, sort
  }
}

/** @param {unknown} v @returns {v is Members} */
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
  && (Reflect.getPrototypeOf(v) === Object.prototype || Reflect.getPrototypeOf(v) === null);
/** A list handed in as data, its members read one by one. @typedef {Data[]} List */
/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);
/** @param {Data} v @returns {boolean} */
const isFieldName = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
/** @param {unknown} v @returns {v is Literal} */
const isLiteral = (v) => typeof v === "string" || typeof v === "boolean" || Number.isSafeInteger(v);
/** @param {unknown} v @returns {v is Op} */
const isOp = (v) => OPS.some((x) => x === v);
/** @param {unknown} v @returns {v is Test} */
const isTest = (v) => TESTS.some((x) => x === v);
/** @param {unknown} v @returns {v is FieldType} */
const isFieldType = (v) => FIELD_TYPES.some((x) => x === v);
/** @param {number} x @returns {boolean} */
const isZero = (x) => x === 0;
/** @param {Data} v @returns {boolean} */
const isMode = (v) => MODES.some((x) => x === v);
/** @param {Data} v @returns {boolean} */
const isSpanUnit = (v) => SPAN_UNITS.some((x) => x === v);

/** @typedef {(field: string | null, why: string) => void} Bad */

/** @param {Data} where @param {Bad} bad @returns {void} */
function checkConditions(where, bad) {
  if (!isList(where) || !where.length) return bad("where", "a list of one or more conditions");
  where.forEach((c, i) => {
    if (!plain(c)) return bad(`where[${i}]`, "a condition is {field, test, value}");
    const extra = Object.keys(c).filter((k) => !["field", "test", "value"].includes(k));
    if (extra.length) return bad(`where[${i}].${extra[0]}`, "not a field of a condition");
    if (!isFieldName(c.field)) bad(`where[${i}].field`, "a field name");
    const t = c.test;
    if (!isTest(t)) return bad(`where[${i}].test`, `one of ${TESTS.join(", ")}`);
    const v = c.value;
    if (t === "in" ? !(isList(v) && v.length && v.every(isLiteral))
      : t === "between" ? !(isList(v) && v.length === 2 && v.every(isLiteral)) : !isLiteral(v))
      bad(`where[${i}].value`, t === "in" ? "a list of literals" : t === "between"
        ? "two literals, low and high" : "a literal: a string, a boolean or a whole number");
  });
}

/** @param {string} kind @param {Data} v @param {Bad} bad @param {string} field @returns {void} */
function checkShape(kind, v, bad, field) {
  const optional = kind.startsWith("?");
  const k = optional ? kind.slice(1) : kind;
  if (v === undefined) return optional ? undefined : bad(field, "required");
  switch (k) {
    case "field": return isFieldName(v) ? undefined : bad(field, "a field name");
    case "fields": return isList(v) && v.length && v.every(isFieldName) ? undefined
      : bad(field, "a list of one or more field names");
    case "places": return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_PLACES ? undefined
      : bad(field, `a whole number of places from 0 to ${MAX_PLACES}`);
    case "mode": return isMode(v) ? undefined : bad(field, `one of ${MODES.join(", ")}`);
    case "unit": return isSpanUnit(v) ? undefined : bad(field, `one of ${SPAN_UNITS.join(", ")}`);
    case "order": return v === "asc" || v === "desc" ? undefined : bad(field, "asc or desc");
    case "conditions": return checkConditions(v, bad);
    case "measure":
      if (!plain(v) || !(v.op === "count" || v.op === "sum")) return bad(field, "{op: count} or {op: sum, field}");
      if (Object.keys(v).some((x) => !["op", "field"].includes(x))) return bad(field, "{op: count} or {op: sum, field}");
      if (v.op === "sum" ? !isFieldName(v.field) : v.field !== undefined) return bad(`${field}.field`, "a field name for a sum, none for a count");
      return undefined;
    case "on":
      return plain(v) && Object.keys(v).length === 2 && isFieldName(v.left) && isFieldName(v.right) ? undefined
        : bad(field, "{left, right}: the field on each side");
    case "crosswalk":
      return plain(v) && Object.keys(v).length === 3 && typeof v.input === "string" && isFieldName(v.left)
        && isFieldName(v.right) ? undefined : bad(field, "{input, left, right}: a table input and its two fields");
    default: return bad(field, "not a field of this form");
  }
}

/** R6: whether a recipe is in the closed grammar. `{ok: true}` or `{ok: false, errors: [{code, step, field, why}]}`.
 *  @param {unknown} recipe @returns {Checked} */
export function checkRecipe(recipe) {
  /** @type {RecipeError[]} */
  const errors = [];
  /** @param {string} code @param {string | number | null} step @param {string | null} field @param {string} why @returns {void} */
  const err = (code, step, field, why) => { errors.push({ code, step, field, why }); };
  if (!plain(recipe)) return { ok: false, errors: [{ code: "RECIPE_INVALID", step: null, field: null, why: word("calc-grammar.why.recipe_object") }] };
  for (const k of Object.keys(recipe))
    if (!["method", "inputs", "steps", "output"].includes(k)) err("RECIPE_INVALID", null, k, "not a field of a recipe");
  if (recipe.method !== METHOD) err("METHOD_UNKNOWN", null, "method", `the method must be ${METHOD}`);
  /** @type {Map<string, string>} */
  const kinds = new Map(/** @type {[string, string][]} */ ([]));
  const inputs = recipe.inputs;
  if (!isList(inputs)) err("RECIPE_INVALID", null, "inputs", "a list of {name, kind}");
  else inputs.forEach((inp, i) => {
    const f = `inputs[${i}]`;
    if (!plain(inp) || Object.keys(inp).some((k) => !["name", "kind"].includes(k)))
      return err("RECIPE_INVALID", null, f, "an input is {name, kind}");
    const name = inp.name; const kind = inp.kind;
    if (typeof name !== "string" || !NAME.test(name)) return err("RECIPE_INVALID", null, `${f}.name`, "a name");
    if (kinds.has(name)) return err("RECIPE_INVALID", null, `${f}.name`, `"${name}" is named twice`);
    if (kind !== "table" && kind !== "figure") return err("RECIPE_INVALID", null, `${f}.kind`, "table or figure");
    kinds.set(name, kind);
  });
  /** @type {Map<string, Data>} */
  const selections = new Map(/** @type {[string, Data][]} */ ([]));
  const steps = recipe.steps;
  if (!isList(steps) || !steps.length) err("RECIPE_INVALID", null, "steps", "a list of one or more steps");
  else steps.forEach((st, i) => {
    const as = plain(st) ? st.as : undefined;
    const label = typeof as === "string" ? as : i;
    /** @type {Bad} */
    const bad = (field, why) => err("RECIPE_INVALID", label, field, why);
    if (!plain(st)) return bad(null, "a step is an object");
    const op = st.op;
    if (!isOp(op)) {
      if (typeof as === "string" && NAME.test(as) && !kinds.has(as)) kinds.set(as, "unknown");
      return bad("op", `one of ${OPS.join(", ")}`);
    }
    const form = FORMS.get(op) ?? {};
    for (const k of Object.keys(st)) if (k !== "op" && k !== "as" && !(k in form)) bad(k, `not a field of ${op}`);
    for (const [field, kind] of Object.entries(form)) {
      if (!kind.startsWith("ref:")) { checkShape(kind, st[field], bad, field); continue; }
      const ref = st[field];
      if (typeof ref !== "string") { bad(field, "the name of an input or an earlier step"); continue; }
      if (!kinds.has(ref)) { err("NAME_UNDEFINED", label, field, `"${ref.slice(0, 64)}" is not defined before this step`); continue; }
      const want = kind.slice(4); const got = kinds.get(ref);
      if (got === "unknown") continue;
      if (want === "value" ? !(got === "figure" || got === "ratio") : got !== want)
        bad(field, `"${ref}" is a ${got}, and ${field} takes a ${want === "value" ? "figure or ratio" : want}`);
    }
    if (op === "join") {
      const space = st.space; const crosswalk = st.crosswalk;
      if (space === undefined && crosswalk === undefined)
        err("JOIN_UNKEYED", label, "space", "a join is keyed through an identifier space or a crosswalk");
      else if (space !== undefined && crosswalk !== undefined) bad("crosswalk", "a join names a space or a crosswalk, not both");
      else if (crosswalk && plain(crosswalk)) {
        const input = crosswalk.input;
        if (!(typeof input === "string" && kinds.has(input))) err("NAME_UNDEFINED", label, "crosswalk.input", `"${String(input).slice(0, 64)}" is not defined before this step`);
        else if (kinds.get(input) !== "table") bad("crosswalk.input", "a crosswalk is a table");
      }
    }
    const part = st.part;
    if (op === "share" && typeof part === "string" && selections.get(part) !== st.whole)
      bad("part", "a share's part is a select step over its whole");
    if (typeof as !== "string" || !NAME.test(as)) return bad("as", "a name");
    if (kinds.has(as)) return bad("as", `"${as}" is already defined`);
    kinds.set(as, produces(op));
    if (op === "select") selections.set(as, st.from);
  });
  const output = recipe.output;
  if (typeof output !== "string") err("RECIPE_INVALID", null, "output", "the name of the answering step");
  else if (!kinds.has(output)) err("NAME_UNDEFINED", null, "output", `"${output.slice(0, 64)}" is not defined`);
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Whether a value is a recipe `checkRecipe` accepts.
 *  @param {unknown} recipe @returns {recipe is Recipe} */
const isRecipe = (recipe) => checkRecipe(recipe).ok;

// ---- reading cells ----

/** @param {Data} t @returns {string | null} */
function tableFault(t) {
  const fields = plain(t) ? t.fields : undefined; const rows = plain(t) ? t.rows : undefined;
  if (!plain(t) || !isList(fields) || !(isList(rows) || typeof rows === "function"))
    return "a table is {fields, rows}: rows a list of row objects, or a function answering an iterator over row arrays";
  /** @type {Set<string>} */
  const names = new Set(/** @type {string[]} */ ([]));
  for (const f of fields) {
    const name = plain(f) ? f.name : undefined; const type = plain(f) ? f.type : undefined;
    if (!plain(f) || typeof name !== "string" || !isFieldName(name) || !isFieldType(type)) return localize("calc-grammar.recipe.field_shape", "each field states its name and its type, the type one of {types}",{ types: FIELD_TYPES.join(", ") });
    if (names.has(name)) return `the field "${name}" is declared twice`;
    names.add(name);
  }
  if (isList(rows) && !rows.every(plain)) return "each row is an object keyed by field name";
  return null;
}

/* A table input `tableFault` has accepted: its fields and its rows, as bound. */
/** @param {unknown} t @returns {t is BoundTable} */
const isBoundTable = (t) => plain(t) && tableShape(t);
/** @param {Members} t @returns {boolean} */
const tableShape = (t) => isList(t.fields) && (isList(t.rows) || typeof t.rows === "function");

/** @param {Data} v @returns {boolean} */
const empty = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** @param {Read | Unread} x @returns {x is Unread} */
const isUnread = (x) => isUndetermined(x);

/** A numeric cell read as a figure: `{v}` or `{undetermined, why}`; never coerced (R7).
 *  @param {Field} field @param {Data} raw @returns {{ v: Figure } | Unread} */
function readNumber(field, raw) {
  if (empty(raw)) return undetermined(`"${field.name}" is empty`);
  const f = plain(raw) ? raw : typeof raw === "string" ? parseFigure(raw)
    : Number.isSafeInteger(raw) ? parseFigure(String(raw)) : null;
  if (f === null) return undetermined(word("calc-grammar.figure_floating_point", { name: String(field.name) }));
  if (isRefusal(f) || !isFigure(f)) return undetermined(word("calc-grammar.read_figure", { name: String(field.name), why: String(("why" in f ? f.why : undefined) || figureFault(f)) }));
  const precision = f.precision;
  if (field.type === "integer" && (precision === "range" || /\.\d*[1-9]/.test(String(f.value))))
    return undetermined(word("calc-grammar.whole_number", { name: String(field.name) }));
  /** @type {Figure} */
  const g = { ...f };
  delete g.as_read;
  for (const k of DIMS) {
    const fk = field[k];
    if (fk === undefined) continue;
    const gk = g[k];
    if (gk === undefined) g[k] = fk;
    else if (gk !== fk) return { undetermined: true, why: word("calc-grammar.names_field", { name: String(field.name), key: String(k), grade: String(gk), field: String(fk) }), mismatch: true };
  }
  return { v: g };
}

/** A cell read as its field's type: `{v}` or `{undetermined, why}`. Never coerced: a cell that does not read as
 *  its type is undetermined (R7).
 *  @param {Field} field @param {Data} raw @returns {Read | Unread} */
function readCell(field, raw) {
  const type = field.type;
  if (type === "number" || type === "integer") return readNumber(field, raw);
  if (empty(raw)) return undetermined(`"${field.name}" is empty`);
  switch (type) {
    case "string": return typeof raw === "string" ? { v: raw } : undetermined(word("calc-grammar.string", { name: String(field.name) }));
    case "boolean":
      if (raw === true || raw === "true") return { v: true };
      if (raw === false || raw === "false") return { v: false };
      return undetermined(word("calc-grammar.true_false", { name: String(field.name) }));
    default: { // date, datetime
      if (isDateIn(raw)) return { v: raw };
      if (typeof raw !== "string") return undetermined(word("calc-grammar.date", { name: String(field.name) }));
      return { v: dateTime(raw, field.zone) };
    }
  }
}

/** A date cell given as an object, which civil-time reads: its text and its precision, as strings.
 *  @param {unknown} x @returns {x is DateIn} */
const isDateIn = (x) => plain(x) && dateShape(x);
/** @param {Members} x @returns {boolean} */
const dateShape = (x) => typeof x.value === "string" && typeof x.precision === "string";

/** @param {string} s @param {Data} zone @returns {DateTime} */
function dateTime(s, zone) {
  const z = typeof zone === "string" && zone ? zone : "UTC";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, precision: "day", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return { value: s, precision: "minute", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return { value: s, precision: "second", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)) return { value: s.slice(0, -1), precision: "second", zone: "UTC" };
  return { value: s, precision: "edtf", zone: z };
}

/* A condition's literal read as the field's type, so a comparison is between like values. */
/** @param {Field} field @param {Literal} lit @returns {Read | Unread} */
function readLiteral(field, lit) {
  const type = field.type;
  if (type === "number" || type === "integer") return readCell({ ...field, type: "number" }, typeof lit === "number" ? String(lit) : lit);
  if (type === "date" || type === "datetime") return typeof lit === "string" ? { v: dateTime(lit, field.zone) } : undetermined(word("calc-grammar.date_condition_takes"));
  if (type === "boolean") return readCell(field, lit);
  return typeof lit === "string" ? { v: lit } : undetermined(word("calc-grammar.string_field_compares"));
}

/** @param {Data} a @param {Data} b @returns {boolean} */
const sameDateTime = (a, b) => isObject(a) && isObject(b) && a.value === b.value && a.precision === b.precision
  && a.zone === b.zone;

/** -1, 0, 1, or `{undetermined, why}` (or a refusal) for two read values of one field type.
 *  @param {FieldType} type @param {Value} a @param {Value} b @returns {number | Undetermined | Refusal} */
function order(type, a, b) {
  if (type === "number" || type === "integer") {
    const r = relate(a, b);
    if (isRefusal(r) || isUndetermined(r)) return r;
    return r === "lower" ? -1 : r === "higher" ? 1 : 0;
  }
  if (type === "date" || type === "datetime") {
    if (sameDateTime(a, b)) return 0;
    let r;
    try { r = compareTimes(a, b); } catch (e) { return undetermined(word("calc-grammar.civil_time_compare", { message: messageOf(e) })); }
    if (r === "before") return -1;
    if (r === "after") return 1;
    return undetermined(r && r.why ? r.why : word("calc-grammar.civil_time_answered"));
  }
  return a === b ? 0 : NaN; // a string or a boolean is equal or not, never ordered (R7 refuses an order test on one)
}

/* A literal a condition holds at a place its test has already counted. */
/** @param {Value[]} values @param {number} i @returns {Value} */
function literalAt(values, i) {
  const v = values[i];
  if (v === undefined) throw new TypeError("a condition holds the literals its test reads");
  return v;
}

/** @param {FieldType} type @param {Condition} cond @param {Value} cell @param {Value[]} literal
 *  @returns {boolean | Undetermined | Refusal} */
function test(type, cond, cell, literal) {
  /** @param {Value} b */
  const o = (b) => order(type, cell, b);
  /** @param {number | Undetermined | Refusal} x @param {(x: number) => boolean} pred @returns {boolean | Undetermined | Refusal} */
  const settle = (x, pred) => (typeof x === "number" ? pred(x) : x);
  switch (cond.test) {
    case "eq": return settle(o(literalAt(literal, 0)), isZero);
    case "ne": return settle(o(literalAt(literal, 0)), (x) => x !== 0);
    case "lt": return settle(o(literalAt(literal, 0)), (x) => x < 0);
    case "le": return settle(o(literalAt(literal, 0)), (x) => x <= 0);
    case "gt": return settle(o(literalAt(literal, 0)), (x) => x > 0);
    case "ge": return settle(o(literalAt(literal, 0)), (x) => x >= 0);
    case "in": {
      /** @type {Undetermined | Refusal | null} */
      let open = null;
      for (const l of literal) {
        const x = o(l);
        if (x === 0) return true;
        if (typeof x !== "number") open = open || x;
      }
      return open || false;
    }
    default: { // between, inclusive
      const lo = settle(o(literalAt(literal, 0)), (x) => x >= 0);
      const hi = settle(o(literalAt(literal, 1)), (x) => x <= 0);
      if (lo === false || hi === false) return false;
      if (lo === true && hi === true) return true;
      return lo === true ? hi : lo;
    }
  }
}

// ---- evaluating ----

/** @param {Held} table @param {string} name @param {string} step @param {string} role @returns {Field} */
function fieldOf(table, name, step, role) {
  const f = table.fields.find((x) => x.name === name);
  if (!f) return stop("RECIPE_INVALID", word("calc-grammar.field_table", { role: String(role), name: String(name) }), step);
  return f;
}

/* An input or an earlier step's answer, as a value: a ratio's quotient, or the value itself. A ratio that is itself
   undetermined is read as that undetermined value, so the step reading it answers undetermined (R20). */
/** @param {Out | InputEntry | undefined} x @returns {Data} */
function valueOf(x) {
  if (x === undefined) throw new TypeError("a step reads a name defined before it");
  if (x.kind === "ratio") { const r = x.value; return isUndetermined(r) ? r : r.value; }
  return x.value;
}

/* A row held as an object: a table bound as row objects, or derived from one. */
/** @param {Members | Data[]} row @returns {Members} */
function rowObject(row) {
  if (Array.isArray(row)) throw new TypeError("a table held as row objects holds objects");
  return row;
}

/* The rows of a table held as row objects. */
/** @param {Held} t @returns {(Members | Data[])[]} */
function listOf(t) {
  const list = t.list;
  if (!list) throw new TypeError("a table held as row objects holds its rows");
  return list;
}

/* R13, then exact totals of `fieldName` over each group's rows: row i is in group `gid[i]` (−1 for none), or every
   row in group 0 when `gid` is null. Two passes, as a total reads: the rule over all of a group's rows first, then
   its amounts. Each group's answer is `{v, rows: []}` or `{u, rows}`; the first group, in group order, whose total
   is refused stops the step, naming the values found. */
/** @param {Held} t @param {string} fieldName @param {string} step @param {number[] | null} gid @param {number} groups
 *  @returns {Total[]} */
function totals(t, fieldName, step, gid, groups) {
  const f = fieldOf(t, fieldName, step, "sum's field");
  const type = f.type;
  if (type !== "number" && type !== "integer") stop("RECIPE_INVALID", word("calc-grammar.numeric_field", { field_name: String(fieldName) }), step);
  /** @type {(i: number) => number} */
  const groupOf = gid ? (i) => gid[i] ?? -1 : () => 0;
  const rules = SUM_RULE.filter(([name]) => t.fields.some((x) => x.name === name))
    .map(([name, code]) => ({ name, code, read: t.reader(name), seen: /** @type {string[][]} */ ([]), blank: /** @type {number[][]} */ ([]) }));
  if (rules.length) {
    let i = 0;
    for (const row of t.scan()) {
      const g = groupOf(i);
      if (g >= 0) for (const r of rules) {
        const v = r.read(row);
        if (empty(v)) (r.blank[g] ||= []).push(i);
        else {
          const seen = (r.seen[g] ||= []);
          if (seen.length < 10 && !seen.includes(String(v))) seen.push(String(v));
        }
      }
      i += 1;
    }
  }
  /** @type {({ stop: [string, string] } | Total | undefined)[]} */
  const out = Array.from({ length: groups }, () => undefined);
  for (let g = 0; g < groups; g++) {
    for (const r of rules) {
      const seen = r.seen[g] || []; const blank = r.blank[g] || [];
      if (seen.length > 1) { out[g] = { stop: [r.code, word("calc-grammar.rows_differ", { name: String(r.name), seen: String(seen.join(", ")) })] }; break; }
      if (blank.length) {
        out[g] = { u: undetermined(word("calc-grammar.stated_row", { name: String(r.name), plural: String(blank.length > 1 ? "s" : ""), blank: String(blank.join(", ")) })),
          rows: blank.map((row) => ({ row, why: `${r.name} is empty` })) };
        break;
      }
    }
  }
  /** @type {Figure} */
  const zero = { value: "0", sign: "+", precision: "exact" };
  const unit = f.unit; const currency = f.currency;
  if (unit) zero.unit = unit;
  if (currency) zero.currency = currency;
  /** @type {(Figure | undefined)[]} */
  const acc = [];
  /** @type {(SetAside[] | undefined)[]} */ const set = [];
  /** @type {([string, string] | undefined)[]} */ const refused = [];
  if (out.includes(undefined)) {
    const read = t.reader(fieldName);
    let i = 0;
    for (const row of t.scan()) {
      const g = groupOf(i);
      if (g >= 0 && out[g] === undefined && !refused[g]) {
        const c = readNumber(f, read(row));
        const s = (set[g] ||= []);
        if (isUndetermined(c)) s.push({ row: i, why: c.why });
        else if (!s.length) {
          const next = add(acc[g] || zero, c.v);
          if (isRefusal(next)) refused[g] = [next.refused === "UNIT_MISMATCH" ? "SUM_MIXED_CURRENCY" : next.refused, next.why];
          else acc[g] = next;
        }
      }
      i += 1;
    }
  }
  /** @type {Total[]} */
  const result = [];
  for (let g = 0; g < groups; g++) {
    const o = out[g];
    if (o) { if ("stop" in o) stop(o.stop[0], o.stop[1], step); else result.push(o); continue; }
    const r = refused[g];
    if (r) stop(r[0], r[1], step);
    const s = set[g] || [];
    result.push(s.length ? { u: undetermined(word("calc-grammar.amount_undetermined_total", { text: String(s.length), text_2: String(s.length > 1 ? "s are" : " is") })), rows: s }
      : { v: acc[g] || zero, rows: none() });
  }
  return result;
}
/** @param {Held} t @param {string} fieldName @param {string} step @returns {Total} */
const total = (t, fieldName, step) => {
  const [first] = totals(t, fieldName, step, null, 1);
  if (!first) throw new TypeError("a total answers its one group");
  return first;
};
/** @param {Total} r @returns {Figure | Undetermined} */
const amountOf = (r) => ("u" in r ? r.u : r.v);

/** No rows set aside. @returns {SetAside[]} */
const none = () => [];

/** @param {number} n @returns {Figure} */
const countFigure = (n) => ({ value: String(n), sign: "+", precision: "exact" });

/** @param {Data} num @param {Data} den @param {number} places @param {Mode} mode @returns {Ratio | Refusal} */
function makeRatio(num, den, places, mode) {
  const value = divide(num, den, { places, mode });
  if (isRefusal(value)) return value;
  if (!isFigure(num) || !isFigure(den)) return refusal("FIGURE_INVALID", "a ratio's numerator and denominator are figures");
  return { numerator: num, denominator: den, value };
}

/* The rows of `index` keyed by any of `keys`, ascending, each once. */
/** @param {Map<string, number[]>} index @param {string[]} keys @returns {number[]} */
function matches(index, keys) {
  const only = keys[0];
  if (keys.length === 1 && only !== undefined) return index.get(only) || [];
  /** @type {Set<number>} */
  const js = new Set(/** @type {number[]} */ ([]));
  for (const k of keys) for (const j of index.get(k) || []) js.add(j);
  return [...js].sort((a, b) => a - b);
}

/* Each op: (step, env, opts) → {kind, value, inputRows, set: [{row, why}]}. A table value is one of `tables.mjs`'s:
   held as row objects when its source was bound so, else a view over the streamed source. */

/** @param {SelectStep} st @param {Access} env @returns {Out} */
function select(st, env) {
  const t = env.table(st.from);
  const conds = st.where.map((c) => {
    const field = fieldOf(t, c.field, st.as, word("calc-grammar.condition_field"));
    if (ORDER_TESTS.includes(c.test) && !QUANTITY_TYPES.includes(field.type))
      stop("RECIPE_INVALID", word("calc-grammar.order", { field: String(c.field), type: String(field.type) }), st.as);
    const value = c.value;
    const lits = (Array.isArray(value) ? value : [value]).map((l) => readLiteral(field, l));
    const badLit = lits.find(isUnread);
    if (badLit) stop("mismatch" in badLit ? "UNIT_MISMATCH" : "RECIPE_INVALID", word("calc-grammar.condition", { field: String(c.field), why: String(badLit.why) }), st.as);
    const vs = lits.flatMap((l) => ("v" in l ? [l.v] : []));
    return { c, field, read: t.reader(c.field), literal: vs };
  });
  /** @type {number[]} */
  const keptAt = [];
  /** @type {(Members | Data[])[]} */ const keptRows = [];
  /** @type {SetAside[]} */ const set = [];
  let i = -1;
  for (const row of t.scan()) {
    i += 1;
    /** @type {string | null} */
    let open = null;
    let dropped = false;
    for (const { c, field, read, literal } of conds) {
      const cell = readCell(field, read(row));
      if (isUnread(cell)) { open = open || cell.why; continue; }
      const r = test(field.type, c, cell.v, literal);
      if (isRefusal(r)) stop(r.refused, `"${c.field}": ${r.why}`, st.as);
      if (r === false) { dropped = true; break; }
      if (r !== true) open = open || r.why;
    }
    if (dropped) continue;
    const why = open;
    if (why) set.push({ row: i, why });
    else if (t.streamed) keptAt.push(i);
    else keptRows.push(row);
  }
  return { kind: "table", value: t.streamed ? filterView(t, keptAt) : objectTable(t.fields, keptRows), inputRows: t.size, set };
}

/** @param {CountStep} st @param {Access} env @returns {Out} */
function count(st, env) {
  const t = env.table(st.from);
  return { kind: "figure", value: countFigure(t.size), inputRows: t.size, set: [] };
}

/** @param {SumStep} st @param {Access} env @returns {Out} */
function sum(st, env) {
  const t = env.table(st.from);
  const r = total(t, st.field, st.as);
  return { kind: "figure", value: amountOf(r), inputRows: t.size, set: r.rows };
}

/** @param {DifferenceStep} st @param {Access} env @returns {Out} */
function difference(st, env) {
  const r = subtract(env.value(st.a), env.value(st.b));
  if (isRefusal(r)) stop(r.refused, r.why, st.as);
  return { kind: "figure", value: r, set: [] };
}

/** @param {RatioStep} st @param {Access} env @returns {Out} */
function ratio(st, env) {
  const r = makeRatio(env.value(st.numerator), env.value(st.denominator), st.places ?? RATIO_DEFAULT.places, st.mode ?? RATIO_DEFAULT.mode);
  if (isRefusal(r)) stop(r.refused, r.why, st.as);
  return { kind: "ratio", value: r, set: [] };
}

/** @param {ShareStep} st @param {Access} env @returns {Out} */
function share(st, env) {
  const part = env.table(st.part); const whole = env.table(st.whole);
  /** @type {SetAside[]} */
  const set = [];
  const field = st.field;
  /** @returns {[Figure | Undetermined, Figure | Undetermined]} */
  const amounts = () => {
    if (field === undefined) return [countFigure(part.size), countFigure(whole.size)];
    const a = total(part, field, st.as);
    const b = total(whole, field, st.as);
    set.push(...b.rows);
    return [amountOf(a), amountOf(b)];
  };
  const [num, den] = amounts();
  if (isUndetermined(num) || isUndetermined(den))
    return { kind: "ratio", value: { numerator: num, denominator: den, value: undetermined(word("calc-grammar.total_undetermined")) }, inputRows: whole.size, set };
  const r = makeRatio(num, den, st.places ?? RATIO_DEFAULT.places, st.mode ?? RATIO_DEFAULT.mode);
  if (isRefusal(r)) stop(r.refused, r.why, st.as);
  return { kind: "ratio", value: r, inputRows: whole.size, set };
}

/** @param {GroupStep} st @param {Access} env @returns {Out} */
function group(st, env) {
  const t = env.table(st.from);
  const by = st.by.map((n) => fieldOf(t, n, st.as, word("calc-grammar.grouping_field")));
  const cols = by.map((f) => ({ f, read: t.reader(f.name) }));
  /** @type {Map<string, number>} */
  const keys = new Map(/** @type {[string, number][]} */ ([]));
  /** @type {Data[][]} */
  const firsts = [];
  /** @type {number[]} */ const counts = [];
  /** @type {SetAside[]} */ const set = [];
  const measure = st.measure;
  const sumField = measure.op === "sum" ? measure.field : null;
  /** @type {number[] | null} */
  const gid = sumField !== null ? [] : null;
  let i = 0;
  for (const row of t.scan()) {
    const cells = cols.map(({ f, read }) => readCell(f, read(row)));
    const open = cells.find(isUnread);
    let g = -1;
    if (open) set.push({ row: i, why: open.why });
    else {
      const key = String(canonicalJson(cells.flatMap((c) => ("v" in c ? [c.v] : []))));
      const found = keys.get(key);
      const at = found === undefined ? firsts.length : found;
      if (found === undefined) { keys.set(key, at); firsts.push(cols.map(({ read }) => read(row))); counts.push(0); }
      counts[at] = (counts[at] ?? 0) + 1;
      g = at;
    }
    if (gid) gid.push(g);
    i += 1;
  }
  /** @type {Field} */
  let mfield;
  if (sumField === null) mfield = { name: "count", type: "integer" };
  else {
    const sf = fieldOf(t, sumField, st.as, word("calc-grammar.measure_field"));
    /** @type {Field} */
    const mf = { name: "sum", type: "number" };
    const unit = sf.unit; const currency = sf.currency;
    if (unit) mf.unit = unit;
    if (currency) mf.currency = currency;
    mfield = mf;
  }
  const measured = mfield;
  const sums = gid && sumField !== null && firsts.length ? totals(t, sumField, st.as, gid, firsts.length) : null;
  /** @type {(Members | Data[])[]} */
  const rows = firsts.map((cells, g) => {
    /** @type {string | Figure | null} */
    let m;
    if (!gid) m = String(counts[g]);
    else {
      const s = sums ? sums[g] : undefined;
      if (!s) throw new TypeError("a group's sum is worked out for each group");
      if ("u" in s) { m = null; set.push(...s.rows.map((x) => ({ ...x, why: localize("calc-grammar.recipe.why_its_groups_sum_is", "{why}; its group's sum is undetermined", { why: String(x.why) }) }))); }
      else m = s.v;
    }
    if (t.streamed) return [...cells, m];
    /** @type {Members} */
    const out = {};
    by.forEach((f, k) => { out[f.name] = cells[k]; });
    out[measured.name] = m;
    return out;
  });
  const fields = [...by, measured];
  return { kind: "table", value: t.streamed ? heldTable(fields, rows) : objectTable(fields, rows), inputRows: t.size, set };
}

/** @param {SpanStep} st @param {Access} env @param {EvalOptions} opts @returns {Out} */
function span(st, env, opts) {
  const t = env.table(st.from);
  const fs = fieldOf(t, st.start, st.as, "span's start"); const fe = fieldOf(t, st.end, st.as, "span's end");
  for (const f of [fs, fe]) { const type = f.type; if (type !== "date" && type !== "datetime") stop("RECIPE_INVALID", word("calc-grammar.date_field", { name: String(f.name) }), st.as); }
  const into = st.into ?? st.as;
  if (t.fields.some((f) => f.name === into)) stop("RECIPE_INVALID", word("calc-grammar.already_field_table", { into: String(into) }), st.as);
  const ra = t.reader(fs.name); const rb = t.reader(fe.name);
  /* A row's span: `{cell}` or `{why}`; pure, so a view over a streamed table computes it again on each pass. */
  /** @param {Members | Data[]} row @returns {{ cell: Figure } | { why: string }} */
  const spanOf = (row) => {
    const a = readCell(fs, ra(row)); const b = readCell(fe, rb(row));
    if (isUnread(a)) return { why: a.why };
    if (isUnread(b)) return { why: b.why };
    /** @type {Members} */
    const options = { unit: st.unit };
    const view = opts.view; const office = opts.office;
    if (view) options.view = view;
    if (office) options.office = office;
    let r;
    try { r = spanTimes(a.v, b.v, options); } catch (e) { r = undetermined(word("calc-grammar.civil_time_count", { message: messageOf(e) })); }
    if (!r || !Number.isSafeInteger(r.min) || !Number.isSafeInteger(r.max)) return { why: (r && r.why) || word("calc-grammar.why.civil_time_gave") };
    /** @type {Figure} */
    let cell;
    if (r.min === r.max) cell = { value: String(Math.abs(r.min)), sign: r.min < 0 ? "-" : "+", precision: "exact", unit: st.unit };
    else cell = { low: String(r.min), high: String(r.max), sign: r.min < 0 ? "-" : "+", precision: "range", unit: st.unit };
    return { cell };
  };
  /** @type {Field} */
  const field = { name: into, type: "number", unit: st.unit };
  /** @type {SetAside[]} */
  const set = [];
  /** @type {Members[]} */ const rows = [];
  let i = 0;
  for (const row of t.scan()) {
    const s = spanOf(row);
    if ("why" in s) set.push({ row: i, why: s.why });
    if (!t.streamed) rows.push({ ...rowObject(row), [into]: "why" in s ? null : s.cell });
    i += 1;
  }
  const value = t.streamed ? extendView(t, field, (row) => { const s = spanOf(row); return "why" in s ? null : s.cell; })
    : objectTable([...t.fields, field], rows);
  return { kind: "table", value, inputRows: t.size, set };
}

/** @param {CompareStep} st @param {Access} env @returns {Out} */
function compare(st, env) {
  const r = relate(env.value(st.a), env.value(st.b));
  if (isRefusal(r)) stop(r.refused, r.why, st.as);
  /** @type {Comparison} */
  const value = isUndetermined(r) ? { relation: "undetermined", why: r.why, label: "computed fact" } : { relation: r, label: "computed fact" };
  return { kind: "comparison", value, set: [] };
}

/** @param {RoundStep} st @param {Access} env @returns {Out} */
function roundStep(st, env) {
  const r = round(env.value(st.of), { places: st.places, mode: st.mode });
  if (isRefusal(r)) stop(r.refused, r.why, st.as);
  return { kind: "figure", value: r, set: [] };
}

/** @param {JoinStep} st @param {Access} env @param {EvalOptions} opts @returns {Out} */
function join(st, env, opts) {
  const L = env.table(st.left); const R = env.table(st.right);
  const lf = fieldOf(L, st.on.left, st.as, word("calc-grammar.join_left_field")); const rf = fieldOf(R, st.on.right, st.as, word("calc-grammar.join_right_field"));
  /** @type {SetAside[]} */
  const set = [];
  /** @type {(v: Data, side: "left" | "right") => string[] | Undetermined} */
  let keyOf;
  const space = st.space;
  if (space !== undefined) {
    const resolve = opts.resolveId;
    if (typeof resolve !== "function") {
      return { kind: "table", value: undetermined(`no resolver for the space "${space}"`), inputRows: L.size, set };
    }
    keyOf = (v) => {
      /** @type {Data} */
      let got;
      try { got = resolve.call(opts, space, v); } catch (e) { return undetermined(word("calc-grammar.resolver_failed", { message: messageOf(e) })); }
      const k = got;
      return typeof k === "string" && k ? [k] : undetermined(word("calc-grammar.resolve_space", { value: String(String(v).slice(0, 64)), space: String(space) }));
    };
  } else {
    const crosswalk = st.crosswalk;
    if (!crosswalk) throw new TypeError("a join names a space or a crosswalk");
    const cw = env.table(crosswalk.input);
    const cl = fieldOf(cw, crosswalk.left, st.as, word("calc-grammar.crosswalk_left_field")); const cr = fieldOf(cw, crosswalk.right, st.as, word("calc-grammar.crosswalk_right_field"));
    const readL = cw.reader(cl.name); const readR = cw.reader(cr.name);
    /** @type {Map<string, string[]>} */
    const pairs = new Map(/** @type {[string, string[]][]} */ ([]));
    for (const row of cw.scan()) {
      const a0 = readL(row); const b0 = readR(row);
      if (empty(a0) || empty(b0)) continue;
      const a = String(a0);
      const list = pairs.get(a);
      if (list) list.push(`\u0000${String(b0)}`); else pairs.set(a, [`\u0000${String(b0)}`]);
    }
    keyOf = (v, side) => {
      if (side === "right") return [`\u0000${String(v)}`];
      const hit = pairs.get(String(v));
      return hit !== undefined ? hit : undetermined(word("calc-grammar.crosswalk", { value: String(String(v).slice(0, 64)) }));
    };
  }
  // The right side's keys, as an index from key to its rows in order; a value is compared only through its key.
  /** @type {Map<string, number[]>} */
  const index = new Map(/** @type {[string, number[]][]} */ ([]));
  const readRight = R.reader(rf.name);
  let j = 0;
  for (const row of R.scan()) {
    const v = readRight(row);
    if (empty(v)) set.push({ side: "right", row: j, why: `"${rf.name}" is empty` });
    else {
      const k = keyOf(v, "right");
      if (isUndetermined(k)) set.push({ side: "right", row: j, why: k.why });
      else for (const key of k) { const js = index.get(key); if (!js) index.set(key, [j]); else if (js[js.length - 1] !== j) js.push(j); }
    }
    j += 1;
  }
  const fields = [...L.fields, ...R.fields.map((f) => ({ ...f, name: `${st.right}.${f.name}` }))];
  const streamed = L.streamed || R.streamed;
  /** @type {number[]} */
  const li = [];
  /** @type {number[]} */ const rj = [];
  /** @type {Members[]} */ const rows = [];
  const readLeft = L.reader(lf.name);
  let i = 0;
  for (const lrow of L.scan()) {
    const v = readLeft(lrow);
    if (empty(v)) set.push({ side: "left", row: i, why: `"${lf.name}" is empty` });
    else {
      const ks = keyOf(v, "left");
      if (isUndetermined(ks)) set.push({ side: "left", row: i, why: ks.why });
      else for (const m of matches(index, ks)) {
        if (streamed) { li.push(i); rj.push(m); continue; }
        /** @type {Members} */
        const out = { ...rowObject(lrow) };
        const rrow = listOf(R)[m];
        if (rrow === undefined) throw new TypeError("a join's match is a row of its right side");
        for (const f of R.fields) out[`${st.right}.${f.name}`] = cellOf(rrow, f.name);
        rows.push(out);
      }
    }
    i += 1;
  }
  return { kind: "table", value: streamed ? joinView(L, R, fields, li, rj) : objectTable(fields, rows), inputRows: L.size + R.size, set };
}

/** @param {SortStep} st @param {Access} env @returns {Out} */
function sort(st, env) {
  const t = env.table(st.from);
  const f = fieldOf(t, st.by, st.as, word("calc-grammar.sort_field"));
  if (!QUANTITY_TYPES.includes(f.type) || f.composed === true)
    stop("SORT_NOT_QUANTITY", word("calc-grammar.stated_quantity", { by: String(st.by), composed: String(f.composed ? word("calc-grammar.composed_quantity") : `a ${f.type}`) }), st.as);
  const type = f.type;
  const numeric = type === "number" || type === "integer";
  const read = t.reader(f.name);
  /** @type {SetAside[]} */
  const set = [];
  /** @type {{ i: number, d: Dec, unit: string | undefined, currency: string | undefined }[]} */
  const byAmount = [];
  /** @type {{ i: number, v: Value }[]} */
  const byValue = [];
  let i = 0;
  for (const row of t.scan()) {
    if (numeric) {
      const c = readNumber(f, read(row));
      if (isUndetermined(c)) set.push({ row: i, why: c.why });
      else if (c.v.precision === "range") set.push({ row: i, why: word("calc-grammar.why.range_place_order", { name: String(f.name) }) });
      else {
        const d = statedValue(c.v);
        if (d === null) throw new TypeError("a figure that is not a range states its value");
        byAmount.push({ i, d, unit: c.v.unit, currency: c.v.currency });
      }
    } else {
      const c = readCell(f, read(row));
      if (isUnread(c)) set.push({ row: i, why: c.why });
      else byValue.push({ i, v: c.v });
    }
    i += 1;
  }
  const sign = st.order === "desc" ? -1 : 1;
  const perm = numeric
    ? mergeSort(byAmount, (a, b) => {
      if (a.unit !== b.unit || a.currency !== b.currency) stop("UNIT_MISMATCH", word("calc-grammar.mixes_units_currencies", { name: String(f.name) }), st.as);
      return sign * cmpD(a.d, b.d);
    }).map((x) => x.i)
    : mergeSort(byValue, (a, b) => {
      const o = order(type, a.v, b.v);
      return typeof o === "number" ? sign * o : 0; // an undecided pair keeps its input order
    }).map((x) => x.i);
  const list = t.streamed ? null : listOf(t);
  return { kind: "table", value: list ? objectTable(t.fields, perm.map((k) => { const row = list[k]; if (row === undefined) throw new TypeError("a sort orders the rows it holds"); return row; })) : orderView(t, perm), inputRows: t.size, set };
}

/* A stable merge sort: ties keep their input order whatever the comparator's partiality. */
/** @template T @param {T[]} xs @param {(a: T, b: T) => number} cmp @returns {T[]} */
function mergeSort(xs, cmp) {
  if (xs.length < 2) return xs.slice();
  const mid = xs.length >> 1;
  const a = mergeSort(xs.slice(0, mid), cmp); const b = mergeSort(xs.slice(mid), cmp);
  /** @type {T[]} */
  const out = [];
  let i = 0; let j = 0;
  for (;;) {
    const x = a[i]; const y = b[j];
    if (x === undefined || y === undefined) break;
    if (cmp(y, x) < 0) { out.push(y); j++; } else { out.push(x); i++; }
  }
  return out.concat(a.slice(i), b.slice(j));
}

/** @param {Step} st @param {Access} env @param {EvalOptions} opts @returns {Out} */
function run(st, env, opts) {
  switch (st.op) {
    case "select": return select(st, env);
    case "count": return count(st, env);
    case "sum": return sum(st, env);
    case "difference": return difference(st, env);
    case "ratio": return ratio(st, env);
    case "share": return share(st, env);
    case "group": return group(st, env);
    case "span": return span(st, env, opts);
    case "compare": return compare(st, env);
    case "round": return roundStep(st, env);
    case "join": return join(st, env, opts);
    default: return sort(st, env);
  }
}

/** @param {Out} r @returns {Summary} */
function summary(r) {
  if (r.kind === "table") { const v = r.value; return isUndetermined(v) ? v : { rows: v.size }; }
  return r.value;
}

/** A step's answer when an input it reads is undetermined: undetermined, of the kind the step answers.
 *  @param {Op} op @param {Undetermined} u @returns {Out} */
function undeterminedOut(op, u) {
  switch (produces(op)) {
    case "figure": return { kind: "figure", value: u, set: [] };
    case "ratio": return { kind: "ratio", value: u, set: [] };
    case "comparison": return { kind: "comparison", value: u, set: [] };
    default: return { kind: "table", value: u, set: [] };
  }
}

/* An input a step reads that is undetermined: the step answers undetermined, never zero (R20). */
class Unsettled {
  /** @type {Undetermined} */
  value;
  /** @param {Undetermined} value */
  constructor(value) { this.value = value; }
}

/** R7–R14, R22: run a checked recipe over its bound inputs. `{result, undetermined_rows, trace}`, or a refusal
 *  `{refused, why, step?, errors?}`. A table input is bound as row objects or streamed (`tables.mjs`); a table
 *  result is answered as its source was bound: row objects, or a streamed table over the same rows. `opts.resolveId(space, value)`
 *  is the caller's normaliser for a join (R11); `opts.view` and `opts.office` pass to civil-time's `span` for a
 *  business-day count (R9).
 *  @param {unknown} recipe @param {Members} bound @param {EvalOptions} [opts] @returns {Evaluation | EvalRefusal | Refusal} */
export function evaluate(recipe, bound, opts = {}) {
  if (bound === null || typeof bound !== "object") throw new TypeError("evaluate's bindings are an object");
  if (opts === null || typeof opts !== "object") throw new TypeError("evaluate's options are an object");
  const resolveId = opts.resolveId;
  if (resolveId !== undefined && typeof resolveId !== "function") throw new TypeError("resolveId is a function");
  const checked = checkRecipe(recipe);
  if (!checked.ok) {
    const first = checked.errors[0];
    if (first) return { refused: first.code, why: first.why, errors: checked.errors };
  }
  if (!isRecipe(recipe)) throw new TypeError("a recipe checkRecipe accepts");
  /** @type {Map<string, Out | InputEntry>} */
  const env = new Map(/** @type {[string, Out | InputEntry][]} */ ([]));
  for (const inp of recipe.inputs) {
    if (!Object.prototype.hasOwnProperty.call(bound, inp.name)) return refusal("INPUT_UNBOUND", `the input "${inp.name}" is not bound`);
    const v = bound[inp.name];
    const why = inp.kind === "table" ? tableFault(v) : figureFault(v);
    if (why) return { refused: "INPUT_INVALID", why: localize("calc-grammar.recipe.the_input_name_why", "the input \"{name}\": {why}", { name: String(inp.name), why: String(why) }) };
    if (inp.kind !== "table") { if (isFigure(v)) env.set(inp.name, { kind: "figure", value: v }); continue; }
    if (!isBoundTable(v)) continue;
    const rows = v.rows;
    if (Array.isArray(rows)) { env.set(inp.name, { kind: "table", value: objectTable(v.fields, rows) }); continue; }
    /** @type {StreamedTable} */
    const input = { fields: v.fields, rows: () => rows.call(v) };
    const s = streamFault(input, inp.name);
    if ("why" in s) return { refused: "INPUT_INVALID", why: s.why };
    env.set(inp.name, { kind: "table", value: streamTable(v.fields, input, s.size, inp.name) });
  }
  /** @type {TraceLine[]} */
  const trace = [];
  let undeterminedRows = 0;
  /** @type {Access} */
  const access = {
    table: (n) => {
      const x = env.get(n);
      if (x === undefined) throw new TypeError("a step reads a name defined before it");
      if (x.kind !== "table") {
        const other = x.value;
        if (isUndetermined(other)) throw new Unsettled(other);
        throw new TypeError("a table step reads a table");
      }
      const value = x.value;
      if (isUndetermined(value)) throw new Unsettled(value);
      return value;
    },
    value: (n) => { const v = valueOf(env.get(n)); if (isUndetermined(v)) throw new Unsettled(v); return v; },
  };
  try {
    for (const st of recipe.steps) {
      /** @type {Out} */
      let r;
      try { r = run(st, access, opts); } catch (e) {
        const stopped = e instanceof Refused ? e : null;
        if (stopped) { if (stopped.r.step === null) stopped.r.step = st.as; throw stopped; }
        const unsettled = e instanceof Unsettled ? e : null;
        if (unsettled) r = undeterminedOut(st.op, undetermined(word("calc-grammar.input_undetermined", { why: String(unsettled.value.why) })));
        else throw e;
      }
      env.set(st.as, r);
      undeterminedRows += r.set.length;
      trace.push({ step: st.as, op: st.op, input_rows: r.inputRows ?? null, output: summary(r), undetermined: r.set, method: METHOD });
    }
  } catch (e) {
    const stopped = e instanceof Refused ? e : null;
    if (stopped) return { refused: stopped.r.refused, why: stopped.r.why, step: stopped.r.step, trace };
    throw e;
  }
  const out = env.get(recipe.output);
  if (out === undefined) throw new TypeError("a recipe's output is a name it defines");
  /** @type {Figure | Ratio | Comparison | TableAnswer | Undetermined} */
  let result;
  if (out.kind === "table") { const v = out.value; result = isUndetermined(v) ? v : answerOf(v); }
  else result = out.value;
  return { result, undetermined_rows: undeterminedRows, trace };
}

/** R15: the result key: SHA-256 of the canonical JSON of `{recipe, inputs, method_version}`.
 *  @param {Data} recipe @param {Data} inputHashes @param {{ methodVersion?: string }} [options] @returns {string} */
export function resultKey(recipe, inputHashes, { methodVersion = METHOD } = {}) {
  if (recipe === null || typeof recipe !== "object") throw new TypeError("resultKey takes a recipe object");
  if (inputHashes === null || typeof inputHashes !== "object") throw new TypeError("resultKey takes the inputs' hashes as an object");
  if (typeof methodVersion !== "string") throw new TypeError("methodVersion is a string");
  return String(sha256HexSync(canonicalJson({ recipe, inputs: inputHashes, method_version: methodVersion })));
}
