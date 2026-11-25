/* calc-grammar's recipes (requirements: `build/requirements/calc-grammar.md`, R6–R15, R18, R20). A recipe is data in
 * one closed grammar, `bio-calc/1`: a list of steps, each one of twelve forms, every field of which is checked
 * before anything runs. Nothing in a recipe is ever run as code. `evaluate` reads only its arguments: the same
 * recipe and bindings give the same result, and every row it could not decide is set aside and named, never
 * coerced and never read as zero. */

import { canonicalJson, sha256HexSync } from "../record-grammar/index.mjs";
import { compare as compareTimes, span as spanTimes } from "../civil-time/index.mjs";
import { parseFigure } from "./figures.mjs";
import { MODES, MAX_PLACES, add, subtract, divide, round, relate, figureFault, statedValue, cmpD,
  refusal, undetermined, isRefusal, isUndetermined } from "./decimal.mjs";
import { Refused, stop, objectTable, heldTable, streamFault, streamTable, filterView, orderView, extendView, joinView,
  answerOf } from "./tables.mjs";
import { word, localize } from "../setup-words/index.mjs";

export const METHOD = "bio-calc/1";
export const OPS = Object.freeze(["select", "count", "sum", "difference", "ratio", "share", "group", "span", "compare",
  "round", "join", "sort"]);
export const TESTS = Object.freeze(["eq", "ne", "lt", "le", "gt", "ge", "in", "between"]);
export const FIELD_TYPES = Object.freeze(["string", "number", "integer", "date", "datetime", "boolean"]);
export const SPAN_UNITS = Object.freeze(["days", "business days", "hours", "months", "years"]);
export const RATIO_DEFAULT = Object.freeze({ places: 12, mode: "half_even" });
/** R13: a declared field whose values must agree across a sum, and the refusal when they do not. */
export const SUM_RULE = Object.freeze([["kind", "SUM_MIXED_KIND"], ["phase", "SUM_MIXED_STAGE"],
  ["stage", "SUM_MIXED_STAGE"], ["basis", "SUM_MIXED_BASIS"], ["currency", "SUM_MIXED_CURRENCY"],
  ["period", "SUM_MIXED_PERIOD"]]);

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const QUANTITY_TYPES = ["number", "integer", "date", "datetime"];

/* Each op's form: its fields, which are required, and what each holds. `ref:<kind>` names an input or an earlier
   step of that kind (`value` takes a figure or a ratio); `field` a table field; the rest are checked by shape. */
const FORMS = {
  select: { from: "ref:table", where: "conditions" },
  count: { from: "ref:table" },
  sum: { from: "ref:table", field: "field" },
  difference: { a: "ref:value", b: "ref:value" },
  ratio: { numerator: "ref:value", denominator: "ref:value", places: "?places", mode: "?mode" },
  share: { part: "ref:table", whole: "ref:table", field: "?field", places: "?places", mode: "?mode" },
  group: { from: "ref:table", by: "fields", measure: "measure" },
  span: { from: "ref:table", start: "field", end: "field", unit: "unit", into: "?field" },
  compare: { a: "ref:value", b: "ref:value" },
  round: { of: "ref:value", places: "places", mode: "mode" },
  join: { left: "ref:table", right: "ref:table", on: "on", space: "?field", crosswalk: "?crosswalk" },
  sort: { from: "ref:table", by: "field", order: "order" },
};
const PRODUCES = { select: "table", count: "figure", sum: "figure", difference: "figure", ratio: "ratio",
  share: "ratio", group: "table", span: "table", compare: "comparison", round: "figure", join: "table",
  sort: "table" };

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isFieldName = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
const isLiteral = (v) => typeof v === "string" || typeof v === "boolean" || Number.isSafeInteger(v);

function checkConditions(where, bad) {
  if (!Array.isArray(where) || !where.length) return bad("where", "a list of one or more conditions");
  where.forEach((c, i) => {
    if (!plain(c)) return bad(`where[${i}]`, "a condition is {field, test, value}");
    const extra = Object.keys(c).filter((k) => !["field", "test", "value"].includes(k));
    if (extra.length) return bad(`where[${i}].${extra[0]}`, "not a field of a condition");
    if (!isFieldName(c.field)) bad(`where[${i}].field`, "a field name");
    if (!TESTS.includes(c.test)) return bad(`where[${i}].test`, `one of ${TESTS.join(", ")}`);
    const v = c.value;
    if (c.test === "in" ? !(Array.isArray(v) && v.length && v.every(isLiteral))
      : c.test === "between" ? !(Array.isArray(v) && v.length === 2 && v.every(isLiteral)) : !isLiteral(v))
      bad(`where[${i}].value`, c.test === "in" ? "a list of literals" : c.test === "between"
        ? "two literals, low and high" : "a literal: a string, a boolean or a whole number");
  });
}

function checkShape(kind, v, bad, field) {
  const optional = kind.startsWith("?");
  const k = optional ? kind.slice(1) : kind;
  if (v === undefined) return optional ? undefined : bad(field, "required");
  switch (k) {
    case "field": return isFieldName(v) ? undefined : bad(field, "a field name");
    case "fields": return Array.isArray(v) && v.length && v.every(isFieldName) ? undefined
      : bad(field, "a list of one or more field names");
    case "places": return Number.isInteger(v) && v >= 0 && v <= MAX_PLACES ? undefined
      : bad(field, `a whole number of places from 0 to ${MAX_PLACES}`);
    case "mode": return MODES.includes(v) ? undefined : bad(field, `one of ${MODES.join(", ")}`);
    case "unit": return SPAN_UNITS.includes(v) ? undefined : bad(field, `one of ${SPAN_UNITS.join(", ")}`);
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

/** R6: whether a recipe is in the closed grammar. `{ok: true}` or `{ok: false, errors: [{code, step, field, why}]}`. */
export function checkRecipe(recipe) {
  const errors = [];
  const err = (code, step, field, why) => errors.push({ code, step, field, why });
  if (!plain(recipe)) return { ok: false, errors: [{ code: "RECIPE_INVALID", step: null, field: null, why: word("calc-grammar.why.recipe_object") }] };
  for (const k of Object.keys(recipe))
    if (!["method", "inputs", "steps", "output"].includes(k)) err("RECIPE_INVALID", null, k, "not a field of a recipe");
  if (recipe.method !== METHOD) err("METHOD_UNKNOWN", null, "method", `the method must be ${METHOD}`);
  const kinds = new Map();
  if (!Array.isArray(recipe.inputs)) err("RECIPE_INVALID", null, "inputs", "a list of {name, kind}");
  else recipe.inputs.forEach((inp, i) => {
    const f = `inputs[${i}]`;
    if (!plain(inp) || Object.keys(inp).some((k) => !["name", "kind"].includes(k)))
      return err("RECIPE_INVALID", null, f, "an input is {name, kind}");
    if (typeof inp.name !== "string" || !NAME.test(inp.name)) return err("RECIPE_INVALID", null, `${f}.name`, "a name");
    if (kinds.has(inp.name)) return err("RECIPE_INVALID", null, `${f}.name`, `"${inp.name}" is named twice`);
    if (inp.kind !== "table" && inp.kind !== "figure") return err("RECIPE_INVALID", null, `${f}.kind`, "table or figure");
    kinds.set(inp.name, inp.kind);
  });
  const selections = new Map();
  if (!Array.isArray(recipe.steps) || !recipe.steps.length) err("RECIPE_INVALID", null, "steps", "a list of one or more steps");
  else recipe.steps.forEach((st, i) => {
    const label = plain(st) && typeof st.as === "string" ? st.as : i;
    const bad = (field, why) => err("RECIPE_INVALID", label, field, why);
    if (!plain(st)) return bad(null, "a step is an object");
    if (!OPS.includes(st.op)) {
      if (typeof st.as === "string" && NAME.test(st.as) && !kinds.has(st.as)) kinds.set(st.as, "unknown");
      return bad("op", `one of ${OPS.join(", ")}`);
    }
    const form = FORMS[st.op];
    for (const k of Object.keys(st)) if (k !== "op" && k !== "as" && !(k in form)) bad(k, `not a field of ${st.op}`);
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
    if (st.op === "join") {
      if (st.space === undefined && st.crosswalk === undefined)
        err("JOIN_UNKEYED", label, "space", "a join is keyed through an identifier space or a crosswalk");
      else if (st.space !== undefined && st.crosswalk !== undefined) bad("crosswalk", "a join names a space or a crosswalk, not both");
      else if (st.crosswalk && plain(st.crosswalk)) {
        if (!kinds.has(st.crosswalk.input)) err("NAME_UNDEFINED", label, "crosswalk.input", `"${String(st.crosswalk.input).slice(0, 64)}" is not defined before this step`);
        else if (kinds.get(st.crosswalk.input) !== "table") bad("crosswalk.input", "a crosswalk is a table");
      }
    }
    if (st.op === "share" && typeof st.part === "string" && selections.get(st.part) !== st.whole)
      bad("part", "a share's part is a select step over its whole");
    if (typeof st.as !== "string" || !NAME.test(st.as)) return bad("as", "a name");
    if (kinds.has(st.as)) return bad("as", `"${st.as}" is already defined`);
    kinds.set(st.as, PRODUCES[st.op]);
    if (st.op === "select") selections.set(st.as, st.from);
  });
  if (typeof recipe.output !== "string") err("RECIPE_INVALID", null, "output", "the name of the answering step");
  else if (!kinds.has(recipe.output)) err("NAME_UNDEFINED", null, "output", `"${recipe.output.slice(0, 64)}" is not defined`);
  return errors.length ? { ok: false, errors } : { ok: true };
}

// ---- reading cells ----

function tableFault(t) {
  if (!plain(t) || !Array.isArray(t.fields) || !(Array.isArray(t.rows) || typeof t.rows === "function"))
    return "a table is {fields, rows}: rows a list of row objects, or a function answering an iterator over row arrays";
  const names = new Set();
  for (const f of t.fields) {
    if (!plain(f) || !isFieldName(f.name) || !FIELD_TYPES.includes(f.type)) return localize("calc-grammar.recipe.field_shape", "each field states its name and its type, the type one of {types}",{ types: FIELD_TYPES.join(", ") });
    if (names.has(f.name)) return `the field "${f.name}" is declared twice`;
    names.add(f.name);
  }
  if (Array.isArray(t.rows) && !t.rows.every(plain)) return "each row is an object keyed by field name";
  return null;
}

const empty = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** A cell read as its field's type: `{v}` or `{undetermined, why}`. Never coerced: a cell that does not read as
 *  its type is undetermined (R7). */
function readCell(field, raw) {
  if (empty(raw)) return undetermined(`"${field.name}" is empty`);
  switch (field.type) {
    case "string": return typeof raw === "string" ? { v: raw } : undetermined(word("calc-grammar.string", { name: String(field.name) }));
    case "boolean":
      if (raw === true || raw === "true") return { v: true };
      if (raw === false || raw === "false") return { v: false };
      return undetermined(word("calc-grammar.true_false", { name: String(field.name) }));
    case "number": case "integer": {
      let f;
      if (plain(raw)) f = raw;
      else if (typeof raw === "string") f = parseFigure(raw);
      else if (Number.isSafeInteger(raw)) f = parseFigure(String(raw));
      else return undetermined(word("calc-grammar.figure_floating_point", { name: String(field.name) }));
      if (isRefusal(f) || figureFault(f)) return undetermined(word("calc-grammar.read_figure", { name: String(field.name), why: String(f.why || figureFault(f)) }));
      if (field.type === "integer" && (f.precision === "range" || /\.\d*[1-9]/.test(f.value)))
        return undetermined(word("calc-grammar.whole_number", { name: String(field.name) }));
      const g = { ...f };
      delete g.as_read;
      for (const k of ["unit", "currency"]) {
        if (field[k] === undefined) continue;
        if (g[k] === undefined) g[k] = field[k];
        else if (g[k] !== field[k]) return { ...undetermined(word("calc-grammar.names_field", { name: String(field.name), key: String(k), grade: String(g[k]), field: String(field[k]) })), mismatch: true };
      }
      return { v: g };
    }
    default: { // date, datetime
      if (plain(raw) && typeof raw.value === "string" && typeof raw.precision === "string") return { v: raw };
      if (typeof raw !== "string") return undetermined(word("calc-grammar.date", { name: String(field.name) }));
      return { v: dateTime(raw, field.zone) };
    }
  }
}

function dateTime(s, zone) {
  const z = typeof zone === "string" && zone ? zone : "UTC";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, precision: "day", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return { value: s, precision: "minute", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return { value: s, precision: "second", zone: z };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)) return { value: s.slice(0, -1), precision: "second", zone: "UTC" };
  return { value: s, precision: "edtf", zone: z };
}

/* A condition's literal read as the field's type, so a comparison is between like values. */
function readLiteral(field, lit) {
  if (field.type === "number" || field.type === "integer") return readCell({ ...field, type: "number" }, typeof lit === "number" ? String(lit) : lit);
  if (field.type === "date" || field.type === "datetime") return typeof lit === "string" ? { v: dateTime(lit, field.zone) } : undetermined(word("calc-grammar.date_condition_takes"));
  if (field.type === "boolean") return readCell(field, lit);
  return typeof lit === "string" ? { v: lit } : undetermined(word("calc-grammar.string_field_compares"));
}

const sameDateTime = (a, b) => a.value === b.value && a.precision === b.precision && a.zone === b.zone;

/** -1, 0, 1, or `{undetermined, why}` (or a refusal) for two read values of one field type. */
function order(type, a, b) {
  if (type === "number" || type === "integer") {
    const r = relate(a, b);
    if (isRefusal(r) || isUndetermined(r)) return r;
    return r === "lower" ? -1 : r === "higher" ? 1 : 0;
  }
  if (type === "date" || type === "datetime") {
    if (sameDateTime(a, b)) return 0;
    let r;
    try { r = compareTimes(a, b); } catch (e) { return undetermined(word("calc-grammar.civil_time_compare", { message: String(e.message) })); }
    if (r === "before") return -1;
    if (r === "after") return 1;
    return undetermined(r && r.why ? r.why : word("calc-grammar.civil_time_answered"));
  }
  return a === b ? 0 : NaN; // a string or a boolean is equal or not, never ordered (R7 refuses an order test on one)
}

function test(type, cond, cell, literal) {
  const o = (b) => order(type, cell, b);
  const settle = (x, pred) => (typeof x === "number" ? pred(x) : x);
  switch (cond.test) {
    case "eq": return settle(o(literal), (x) => x === 0);
    case "ne": return settle(o(literal), (x) => x !== 0);
    case "lt": return settle(o(literal), (x) => x < 0);
    case "le": return settle(o(literal), (x) => x <= 0);
    case "gt": return settle(o(literal), (x) => x > 0);
    case "ge": return settle(o(literal), (x) => x >= 0);
    case "in": {
      let open = null;
      for (const l of literal) {
        const x = o(l);
        if (x === 0) return true;
        if (typeof x !== "number") open = open || x;
      }
      return open || false;
    }
    default: { // between, inclusive
      const lo = settle(o(literal[0]), (x) => x >= 0);
      const hi = settle(o(literal[1]), (x) => x <= 0);
      if (lo === false || hi === false) return false;
      if (lo === true && hi === true) return true;
      return lo === true ? hi : lo;
    }
  }
}

// ---- evaluating ----

function fieldOf(table, name, step, role) {
  const f = table.fields.find((x) => x.name === name);
  if (!f) stop("RECIPE_INVALID", word("calc-grammar.field_table", { role: String(role), name: String(name) }), step);
  return f;
}

const valueOf = (x) => (x && x.kind === "ratio" ? x.value.value : x.value);

/* R13, then exact totals of `fieldName` over each group's rows: row i is in group `gid[i]` (−1 for none), or every
   row in group 0 when `gid` is null. Two passes, as a total reads: the rule over all of a group's rows first, then
   its amounts. Each group's answer is `{v, rows: []}` or `{u, rows}`; the first group, in group order, whose total
   is refused stops the step, naming the values found. */
function totals(t, fieldName, step, gid, groups) {
  const f = fieldOf(t, fieldName, step, "sum's field");
  if (f.type !== "number" && f.type !== "integer") stop("RECIPE_INVALID", word("calc-grammar.numeric_field", { field_name: String(fieldName) }), step);
  const groupOf = gid ? (i) => gid[i] : () => 0;
  const rules = SUM_RULE.filter(([name]) => t.fields.some((x) => x.name === name))
    .map(([name, code]) => ({ name, code, read: t.reader(name), seen: [], blank: [] }));
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
  const zero = { value: "0", sign: "+", precision: "exact", ...(f.unit && { unit: f.unit }), ...(f.currency && { currency: f.currency }) };
  const acc = []; const set = []; const refused = [];
  if (out.includes(undefined)) {
    const read = t.reader(fieldName);
    let i = 0;
    for (const row of t.scan()) {
      const g = groupOf(i);
      if (g >= 0 && out[g] === undefined && !refused[g]) {
        const c = readCell(f, read(row));
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
  for (let g = 0; g < groups; g++) {
    if (out[g]) { if (out[g].stop) stop(...out[g].stop, step); continue; }
    if (refused[g]) stop(...refused[g], step);
    const s = set[g] || [];
    out[g] = s.length ? { u: undetermined(word("calc-grammar.amount_undetermined_total", { text: String(s.length), text_2: String(s.length > 1 ? "s are" : " is") })), rows: s }
      : { v: acc[g] || zero, rows: [] };
  }
  return out;
}
const total = (t, fieldName, step) => totals(t, fieldName, step, null, 1)[0];

const countFigure = (n) => ({ value: String(n), sign: "+", precision: "exact" });

function makeRatio(num, den, places, mode) {
  const value = divide(num, den, { places, mode });
  if (isRefusal(value)) return value;
  return { numerator: num, denominator: den, value };
}

/* The rows of `index` keyed by any of `keys`, ascending, each once. */
function matches(index, keys) {
  if (keys.length === 1) return index.get(keys[0]) || [];
  const js = new Set();
  for (const k of keys) for (const j of index.get(k) || []) js.add(j);
  return [...js].sort((a, b) => a - b);
}

/* Each op: (step, env, opts) → {kind, value, inputRows, set: [{row, why}]}. A table value is one of `tables.mjs`'s:
   held as row objects when its source was bound so, else a view over the streamed source. */
const RUN = {
  select(st, env) {
    const t = env.table(st.from);
    const conds = st.where.map((c) => {
      const field = fieldOf(t, c.field, st.as, word("calc-grammar.condition_field"));
      if (["lt", "le", "gt", "ge", "between"].includes(c.test) && !QUANTITY_TYPES.includes(field.type))
        stop("RECIPE_INVALID", word("calc-grammar.order", { field: String(c.field), type: String(field.type) }), st.as);
      const lits = (c.test === "in" || c.test === "between" ? c.value : [c.value]).map((l) => readLiteral(field, l));
      const badLit = lits.find((l) => isUndetermined(l) || isRefusal(l));
      if (badLit) stop(badLit.mismatch ? "UNIT_MISMATCH" : "RECIPE_INVALID", word("calc-grammar.condition", { field: String(c.field), why: String(badLit.why) }), st.as);
      const vs = lits.map((l) => l.v);
      return { c, field, read: t.reader(c.field), literal: c.test === "in" || c.test === "between" ? vs : vs[0] };
    });
    const kept = []; const set = [];
    let i = -1;
    rows: for (const row of t.scan()) {
      i += 1;
      let open = null;
      for (const { c, field, read, literal } of conds) {
        const cell = readCell(field, read(row));
        if (isUndetermined(cell)) { open = open || cell.why; continue; }
        const r = test(field.type, c, cell.v, literal);
        if (isRefusal(r)) stop(r.refused, `"${c.field}": ${r.why}`, st.as);
        if (r === false) continue rows;
        if (r !== true) open = open || r.why;
      }
      if (open) set.push({ row: i, why: open });
      else kept.push(t.streamed ? i : row);
    }
    return { kind: "table", value: t.streamed ? filterView(t, kept) : objectTable(t.fields, kept), inputRows: t.size, set };
  },
  count(st, env) {
    const t = env.table(st.from);
    return { kind: "figure", value: countFigure(t.size), inputRows: t.size, set: [] };
  },
  sum(st, env) {
    const t = env.table(st.from);
    const r = total(t, st.field, st.as);
    return { kind: "figure", value: r.u || r.v, inputRows: t.size, set: r.rows };
  },
  difference(st, env) {
    const r = subtract(env.value(st.a), env.value(st.b));
    if (isRefusal(r)) stop(r.refused, r.why, st.as);
    return { kind: "figure", value: r, set: [] };
  },
  ratio(st, env) {
    const r = makeRatio(env.value(st.numerator), env.value(st.denominator), st.places ?? RATIO_DEFAULT.places, st.mode ?? RATIO_DEFAULT.mode);
    if (isRefusal(r)) stop(r.refused, r.why, st.as);
    return { kind: "ratio", value: r, set: [] };
  },
  share(st, env) {
    const part = env.table(st.part); const whole = env.table(st.whole);
    let num; let den; const set = [];
    if (st.field === undefined) { num = countFigure(part.size); den = countFigure(whole.size); }
    else {
      const a = total(part, st.field, st.as);
      const b = total(whole, st.field, st.as);
      set.push(...b.rows);
      num = a.u || a.v; den = b.u || b.v;
    }
    if (isUndetermined(num) || isUndetermined(den))
      return { kind: "ratio", value: { numerator: num, denominator: den, value: undetermined(word("calc-grammar.total_undetermined")) }, inputRows: whole.size, set };
    const r = makeRatio(num, den, st.places ?? RATIO_DEFAULT.places, st.mode ?? RATIO_DEFAULT.mode);
    if (isRefusal(r)) stop(r.refused, r.why, st.as);
    return { kind: "ratio", value: r, inputRows: whole.size, set };
  },
  group(st, env) {
    const t = env.table(st.from);
    const by = st.by.map((n) => fieldOf(t, n, st.as, word("calc-grammar.grouping_field")));
    const reads = by.map((f) => t.reader(f.name));
    const keys = new Map(); const firsts = []; const counts = []; const set = [];
    const gid = st.measure.op === "sum" ? [] : null;
    let i = 0;
    for (const row of t.scan()) {
      const cells = by.map((f, k) => readCell(f, reads[k](row)));
      const open = cells.find(isUndetermined);
      let g = -1;
      if (open) set.push({ row: i, why: open.why });
      else {
        const key = canonicalJson(cells.map(({ v }) => v));
        g = keys.get(key);
        if (g === undefined) { g = firsts.length; keys.set(key, g); firsts.push(reads.map((read) => read(row))); counts.push(0); }
        counts[g] += 1;
      }
      if (gid) gid.push(g);
      i += 1;
    }
    let mfield;
    if (!gid) mfield = { name: "count", type: "integer" };
    else {
      const sf = fieldOf(t, st.measure.field, st.as, word("calc-grammar.measure_field"));
      mfield = { name: "sum", type: "number", ...(sf.unit && { unit: sf.unit }), ...(sf.currency && { currency: sf.currency }) };
    }
    const sums = gid && firsts.length ? totals(t, st.measure.field, st.as, gid, firsts.length) : null;
    const rows = firsts.map((cells, g) => {
      let m;
      if (!gid) m = String(counts[g]);
      else if (sums[g].u) { m = null; set.push(...sums[g].rows.map((x) => ({ ...x, why: localize("calc-grammar.recipe.why_its_groups_sum_is", "{why}; its group's sum is undetermined", { why: String(x.why) }) }))); }
      else m = sums[g].v;
      if (t.streamed) return [...cells, m];
      const out = {};
      by.forEach((f, k) => { out[f.name] = cells[k]; });
      out[mfield.name] = m;
      return out;
    });
    const fields = [...by, mfield];
    return { kind: "table", value: t.streamed ? heldTable(fields, rows) : objectTable(fields, rows), inputRows: t.size, set };
  },
  span(st, env, opts) {
    const t = env.table(st.from);
    const fs = fieldOf(t, st.start, st.as, "span's start"); const fe = fieldOf(t, st.end, st.as, "span's end");
    for (const f of [fs, fe]) if (f.type !== "date" && f.type !== "datetime") stop("RECIPE_INVALID", word("calc-grammar.date_field", { name: String(f.name) }), st.as);
    const into = st.into ?? st.as;
    if (t.fields.some((f) => f.name === into)) stop("RECIPE_INVALID", word("calc-grammar.already_field_table", { into: String(into) }), st.as);
    const ra = t.reader(fs.name); const rb = t.reader(fe.name);
    /* A row's span: `{cell}` or `{why}`; pure, so a view over a streamed table computes it again on each pass. */
    const spanOf = (row) => {
      const a = readCell(fs, ra(row)); const b = readCell(fe, rb(row));
      const open = [a, b].find(isUndetermined);
      if (open) return { why: open.why };
      let r;
      try { r = spanTimes(a.v, b.v, { unit: st.unit, ...(opts.view && { view: opts.view }), ...(opts.office && { office: opts.office }) }); } catch (e) { r = undetermined(word("calc-grammar.civil_time_count", { message: String(e.message) })); }
      if (!r || !Number.isSafeInteger(r.min) || !Number.isSafeInteger(r.max)) return { why: (r && r.why) || word("calc-grammar.why.civil_time_gave") };
      return { cell: r.min === r.max ? { value: String(Math.abs(r.min)), sign: r.min < 0 ? "-" : "+", precision: "exact", unit: st.unit }
        : { low: String(r.min), high: String(r.max), sign: r.min < 0 ? "-" : "+", precision: "range", unit: st.unit } };
    };
    const field = { name: into, type: "number", unit: st.unit };
    const set = []; const rows = [];
    let i = 0;
    for (const row of t.scan()) {
      const s = spanOf(row);
      if ("why" in s) set.push({ row: i, why: s.why });
      if (!t.streamed) rows.push({ ...row, [into]: "why" in s ? null : s.cell });
      i += 1;
    }
    const value = t.streamed ? extendView(t, field, (row) => { const s = spanOf(row); return "why" in s ? null : s.cell; })
      : objectTable([...t.fields, field], rows);
    return { kind: "table", value, inputRows: t.size, set };
  },
  compare(st, env) {
    const r = relate(env.value(st.a), env.value(st.b));
    if (isRefusal(r)) stop(r.refused, r.why, st.as);
    const value = isUndetermined(r) ? { relation: "undetermined", why: r.why, label: "computed fact" } : { relation: r, label: "computed fact" };
    return { kind: "comparison", value, set: [] };
  },
  round(st, env) {
    const r = round(env.value(st.of), { places: st.places, mode: st.mode });
    if (isRefusal(r)) stop(r.refused, r.why, st.as);
    return { kind: "figure", value: r, set: [] };
  },
  join(st, env, opts) {
    const L = env.table(st.left); const R = env.table(st.right);
    const lf = fieldOf(L, st.on.left, st.as, word("calc-grammar.join_left_field")); const rf = fieldOf(R, st.on.right, st.as, word("calc-grammar.join_right_field"));
    const set = [];
    let keyOf;
    if (st.space !== undefined) {
      if (typeof opts.resolveId !== "function") {
        return { kind: "table", value: undetermined(`no resolver for the space "${st.space}"`), inputRows: L.size, set };
      }
      keyOf = (v) => {
        let k;
        try { k = opts.resolveId(st.space, v); } catch (e) { return undetermined(word("calc-grammar.resolver_failed", { message: String(e.message) })); }
        return typeof k === "string" && k ? [k] : undetermined(word("calc-grammar.resolve_space", { value: String(String(v).slice(0, 64)), space: String(st.space) }));
      };
    } else {
      const cw = env.table(st.crosswalk.input);
      const cl = fieldOf(cw, st.crosswalk.left, st.as, word("calc-grammar.crosswalk_left_field")); const cr = fieldOf(cw, st.crosswalk.right, st.as, word("calc-grammar.crosswalk_right_field"));
      const readL = cw.reader(cl.name); const readR = cw.reader(cr.name);
      const pairs = new Map();
      for (const row of cw.scan()) {
        const a0 = readL(row); const b0 = readR(row);
        if (empty(a0) || empty(b0)) continue;
        const a = String(a0);
        if (!pairs.has(a)) pairs.set(a, []);
        pairs.get(a).push(`\u0000${String(b0)}`);
      }
      keyOf = (v, side) => {
        if (side === "right") return [`\u0000${String(v)}`];
        return pairs.has(String(v)) ? pairs.get(String(v)) : undetermined(word("calc-grammar.crosswalk", { value: String(String(v).slice(0, 64)) }));
      };
    }
    // The right side's keys, as an index from key to its rows in order; a value is compared only through its key.
    const index = new Map();
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
    const li = []; const rj = []; const rows = [];
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
          const out = { ...lrow };
          const rrow = R.list[m];
          for (const f of R.fields) out[`${st.right}.${f.name}`] = rrow[f.name];
          rows.push(out);
        }
      }
      i += 1;
    }
    return { kind: "table", value: streamed ? joinView(L, R, fields, li, rj) : objectTable(fields, rows), inputRows: L.size + R.size, set };
  },
  sort(st, env) {
    const t = env.table(st.from);
    const f = fieldOf(t, st.by, st.as, word("calc-grammar.sort_field"));
    if (!QUANTITY_TYPES.includes(f.type) || f.composed === true)
      stop("SORT_NOT_QUANTITY", word("calc-grammar.stated_quantity", { by: String(st.by), composed: String(f.composed ? word("calc-grammar.composed_quantity") : `a ${f.type}`) }), st.as);
    const numeric = f.type === "number" || f.type === "integer";
    const read = t.reader(f.name);
    const set = []; const keyed = [];
    let i = 0;
    for (const row of t.scan()) {
      const c = readCell(f, read(row));
      if (isUndetermined(c)) set.push({ row: i, why: c.why });
      else if (numeric && c.v.precision === "range") set.push({ row: i, why: word("calc-grammar.why.range_place_order", { name: String(f.name) }) });
      else keyed.push(numeric ? { i, d: statedValue(c.v), unit: c.v.unit, currency: c.v.currency } : { i, v: c.v });
      i += 1;
    }
    const sign = st.order === "desc" ? -1 : 1;
    const cmp = (a, b) => {
      if (numeric) {
        if (a.unit !== b.unit || a.currency !== b.currency) stop("UNIT_MISMATCH", word("calc-grammar.mixes_units_currencies", { name: String(f.name) }), st.as);
        return sign * cmpD(a.d, b.d);
      }
      const o = order(f.type, a.v, b.v);
      return typeof o === "number" ? sign * o : 0; // an undecided pair keeps its input order
    };
    const perm = mergeSort(keyed, cmp).map((x) => x.i);
    return { kind: "table", value: t.streamed ? orderView(t, perm) : objectTable(t.fields, perm.map((k) => t.list[k])), inputRows: t.size, set };
  },
};

/* A stable merge sort: ties keep their input order whatever the comparator's partiality. */
function mergeSort(xs, cmp) {
  if (xs.length < 2) return xs.slice();
  const mid = xs.length >> 1;
  const a = mergeSort(xs.slice(0, mid), cmp); const b = mergeSort(xs.slice(mid), cmp);
  const out = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) out.push(cmp(b[j], a[i]) < 0 ? b[j++] : a[i++]);
  return out.concat(a.slice(i), b.slice(j));
}

function summary(r) {
  if (r.kind === "table") return isUndetermined(r.value) ? r.value : { rows: r.value.size };
  return r.value;
}

/** R7–R14, R22: run a checked recipe over its bound inputs. `{result, undetermined_rows, trace}`, or a refusal
 *  `{refused, why, step?, errors?}`. A table input is bound as row objects or streamed (`tables.mjs`); a table
 *  result is answered as its source was bound: row objects, or a streamed table over the same rows. `opts.resolveId(space, value)`
 *  is the caller's normaliser for a join (R11); `opts.view` and `opts.office` pass to civil-time's `span` for a
 *  business-day count (R9). */
export function evaluate(recipe, bound, opts = {}) {
  if (bound === null || typeof bound !== "object") throw new TypeError("evaluate's bindings are an object");
  if (opts === null || typeof opts !== "object") throw new TypeError("evaluate's options are an object");
  if (opts.resolveId !== undefined && typeof opts.resolveId !== "function") throw new TypeError("resolveId is a function");
  const checked = checkRecipe(recipe);
  if (!checked.ok) return { refused: checked.errors[0].code, why: checked.errors[0].why, errors: checked.errors };
  const env = new Map();
  for (const inp of recipe.inputs) {
    if (!Object.prototype.hasOwnProperty.call(bound, inp.name)) return refusal("INPUT_UNBOUND", `the input "${inp.name}" is not bound`);
    const v = bound[inp.name];
    const why = inp.kind === "table" ? tableFault(v) : figureFault(v);
    if (why) return { refused: "INPUT_INVALID", why: localize("calc-grammar.recipe.the_input_name_why", "the input \"{name}\": {why}", { name: String(inp.name), why: String(why) }) };
    if (inp.kind !== "table") { env.set(inp.name, { kind: inp.kind, value: v }); continue; }
    if (Array.isArray(v.rows)) { env.set(inp.name, { kind: "table", value: objectTable(v.fields, v.rows) }); continue; }
    const s = streamFault(v, inp.name);
    if (s.why) return { refused: "INPUT_INVALID", why: s.why };
    env.set(inp.name, { kind: "table", value: streamTable(v.fields, v, s.size, inp.name) });
  }
  const trace = [];
  let undeterminedRows = 0;
  const access = {
    table: (n) => { const x = env.get(n); if (isUndetermined(x.value)) throw x; return x.value; },
    value: (n) => { const x = env.get(n); const v = valueOf(x); if (isUndetermined(v)) throw { value: v }; return v; },
  };
  try {
    for (const st of recipe.steps) {
      let r;
      try { r = RUN[st.op](st, access, opts); } catch (e) {
        if (e instanceof Refused) { if (e.r.step === null) e.r.step = st.as; throw e; }
        if (e && isUndetermined(e.value)) r = { kind: PRODUCES[st.op], value: undetermined(word("calc-grammar.input_undetermined", { why: String(e.value.why) })), set: [] };
        else throw e;
      }
      env.set(st.as, r);
      undeterminedRows += r.set.length;
      trace.push({ step: st.as, op: st.op, input_rows: r.inputRows ?? null, output: summary(r), undetermined: r.set, method: METHOD });
    }
  } catch (e) {
    if (e instanceof Refused) return { ...e.r, trace };
    throw e;
  }
  const out = env.get(recipe.output);
  return { result: out.kind === "table" && !isUndetermined(out.value) ? answerOf(out.value) : out.value,
    undetermined_rows: undeterminedRows, trace };
}

/** R15: the result key: SHA-256 of the canonical JSON of `{recipe, inputs, method_version}`. */
export function resultKey(recipe, inputHashes, { methodVersion = METHOD } = {}) {
  if (recipe === null || typeof recipe !== "object") throw new TypeError("resultKey takes a recipe object");
  if (inputHashes === null || typeof inputHashes !== "object") throw new TypeError("resultKey takes the inputs' hashes as an object");
  if (typeof methodVersion !== "string") throw new TypeError("methodVersion is a string");
  return sha256HexSync(canonicalJson({ recipe, inputs: inputHashes, method_version: methodVersion }));
}
