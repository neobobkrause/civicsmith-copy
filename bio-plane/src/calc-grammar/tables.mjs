/* calc-grammar's tables, as `evaluate` holds them (requirements: `build/requirements/calc-grammar.md`, R7–R14, R22).
 * A table is bound either as row objects (`{fields, rows: [ {name: cell} ]}`) or streamed (`{fields, rows}`, `rows`
 * a function answering a new iterator over arrays of cells in `fields` order). Every step reads its tables through
 * one interface: `size`, `scan()` (an iterator over the rows), `pick(indices)` (the rows at those indices, in that
 * order) and `reader(name)` (a row's cell of a field). A table derived from row objects is held as row objects, as
 * the caller already holds them. A table derived from a streamed one is a view over its source: the indices it
 * keeps, the order it puts them in, or the pairs it joins, with computed cells computed again on each pass. So a
 * step holds only what it keeps, never the source's cells, and a streamed table is read again, pass by pass. */

/* The rows a stream pass reads ahead when a view asks for rows out of order: a pass reads the source once and keeps
   at most this many of its rows. */
import { word, localize } from "../setup-words/index.mjs";
import { isObject } from "./decimal.mjs";

/* A row is an object keyed by field name, or an array of cells in `fields` order: written out as
   `{ [key: string]: Data } | Data[]` wherever it stands. */
/**
 * Any value a caller hands in as data (a cell, a member of a recipe or a binding), read only after it is checked.
 * @typedef {{} | null | undefined} Data
 */
/** A plain object read member by member. @typedef {{ [key: string]: Data }} Members */
/** @typedef {"string" | "number" | "integer" | "date" | "datetime" | "boolean"} FieldType */
/**
 * A table's field (Table Schema's types); a numeric field may state its unit or currency, a date field its zone.
 * @typedef {Object} Field
 * @property {string} name
 * @property {FieldType} type
 * @property {string} [unit]
 * @property {string} [currency]
 * @property {string} [zone]
 * @property {boolean} [composed]
 * @bound name: 1 to 200 characters, each field's name once in a table
 */
/**
 * A table as the steps read it: held as row objects (`list`), or a view over a streamed source.
 * @typedef {Object} Held
 * @property {Field[]} fields
 * @property {boolean} streamed
 * @property {number} size
 * @property {({ [key: string]: Data } | Data[])[]} [list]
 * @property {(name: string) => ((row: { [key: string]: Data } | Data[]) => Data)} reader
 * @property {() => IterableIterator<{ [key: string]: Data } | Data[], void, undefined>} scan
 * @property {(idx: number[]) => IterableIterator<{ [key: string]: Data } | Data[], void, undefined>} pick
 * @property {(row: { [key: string]: Data } | Data[]) => Data[]} asArray
 */
/**
 * What a streamed table's `rows` answers: an iterator over arrays of cells in `fields` order, or a value that holds one.
 * @typedef {Iterator<Data[], Data, undefined> | Iterable<Data[], Data, undefined>} RowSource
 */
/**
 * A table bound streamed: `rows` answers, on each call, a new iterator over arrays of cells in `fields` order.
 * @typedef {Object} StreamedTable
 * @property {Field[]} fields
 * @property {() => RowSource} rows
 */
/**
 * A table result as `evaluate` answers it: row objects, or streamed.
 * @typedef {Object} TableAnswer
 * @property {Field[]} fields
 * @property {({ [key: string]: Data } | Data[])[] | (() => Generator<{ [key: string]: Data } | Data[], void, undefined>)} rows
 */
/**
 * A step's stop: the refusal, and the step it names.
 * @typedef {Object} StepRefusal
 * @property {string} refused
 * @property {string} why
 * @property {string | number | null} step
 */

export const PICK_CHUNK = 16384;

/** A step's stop: a refusal by name, caught by `evaluate`. */
export class Refused {
  /** @type {StepRefusal} */
  r;
  /** @param {StepRefusal} r */
  constructor(r) { this.r = r; }
}
/** @param {string} code @param {string} why @param {string | number | null} step @returns {never} */
export const stop = (code, why, step) => { throw new Refused({ refused: code, why, step }); };

/** A row's cell of the field `name`: an array row holds none by name.
 *  @param {{ [key: string]: Data } | Data[]} row @param {string} name @returns {Data} */
export const cellOf = (row, name) => (Array.isArray(row) ? undefined : row[name]);

/** @param {Field[]} fields @returns {(name: string) => ((row: { [key: string]: Data } | Data[]) => Data)} */
function readers(fields) {
  /** @type {Map<string, number>} */
  const at = new Map(fields.map((f, k) => [f.name, k]));
  return (name) => { const k = at.get(name); return (row) => (k === undefined ? undefined : Array.isArray(row) ? row[k] : row[String(k)]); };
}
/** @param {string} name @returns {(row: { [key: string]: Data } | Data[]) => Data} */
const keyReader = (name) => (row) => cellOf(row, name);

/** A table held as row objects: the caller's, or one derived from it.
 *  @param {Field[]} fields @param {({ [key: string]: Data } | Data[])[]} list @returns {Held} */
export function objectTable(fields, list) {
  return { fields, streamed: false, size: list.length, list, reader: keyReader,
    scan: () => list[Symbol.iterator](), pick: (idx) => idx.map((i) => rowAt(list, i))[Symbol.iterator](),
    asArray: (row) => fields.map((f) => cellOf(row, f.name)) };
}

/** A table held as arrays: a group's results over a streamed table.
 *  @param {Field[]} fields @param {({ [key: string]: Data } | Data[])[]} list @returns {Held} */
export function heldTable(fields, list) {
  return { fields, streamed: true, size: list.length, reader: readers(fields), scan: () => list[Symbol.iterator](),
    pick: (idx) => idx.map((i) => rowAt(list, i))[Symbol.iterator](), asArray: (row) => asCells(row) };
}

/* A row a table holds at an index it has already counted. */
/** @param {({ [key: string]: Data } | Data[])[]} list @param {number} i @returns {{ [key: string]: Data } | Data[]} */
function rowAt(list, i) {
  const row = list[i];
  if (row === undefined) throw new TypeError("a table's row is read at an index it holds");
  return row;
}

/* An array row's cells, as the views hand them on. */
/** @param {{ [key: string]: Data } | Data[]} row @returns {Data[]} */
function asCells(row) {
  if (!Array.isArray(row)) throw new TypeError("a streamed table's row is an array of cells");
  return row;
}

/** An iterator over a caller's rows, as a pass reads it. @typedef {{ next: () => IteratorResult<Data, Data>, return?: () => Data }} RowIterator */
/** A value that holds its own iterator. @typedef {{ [Symbol.iterator]: () => Data }} RowIterable */
/** A streamed row's cells. @typedef {Data[]} Cells */

/** Whether a value answers `next`, as an iterator does.
 *  @param {unknown} x @returns {x is RowIterator} */
export const isRowIterator = (x) => isObject(x) && typeof x.next === "function";
/** Whether a value holds its own iterator.
 *  @param {unknown} x @returns {x is RowIterable} */
export const isRowIterable = (x) => (typeof x === "object" || typeof x === "function") && x !== null
  && Symbol.iterator in x && typeof x[Symbol.iterator] === "function";
/** @param {unknown} x @returns {x is Cells} */
const isCells = (x) => Array.isArray(x);

/* What a pass meets on a value that answers no `next`: the language's own error for `it.next()`. */
/** @type {RowIterator} */
const NO_NEXT = { next: () => { throw new TypeError("it.next is not a function"); } };

/** The iterator a caller's rows answer, or `null` when they answer none.
 *  @param {unknown} x @returns {RowIterator | null} */
export function iteratorOf(x) {
  if (isRowIterator(x)) return x;
  if (typeof x === "string") return x[Symbol.iterator]();
  if (isRowIterable(x)) {
    const got = x[Symbol.iterator]();
    if (isRowIterator(got)) return got;
    return got ? NO_NEXT : null;
  }
  return null;
}

/** The message of an error a caller's code raised, read as the language reads `e.message`.
 *  @param {unknown} e @returns {string} */
export const messageOf = (e) => {
  if (e === null || e === undefined) throw new TypeError(`Cannot read properties of ${e} (reading 'message')`);
  return String(isObject(e) ? e.message : undefined);
};

/** Why a streamed table cannot be read, or `{size}`: one pass over it, checking every row's shape.
 *  @param {StreamedTable} input @param {string} name @returns {{ why: string } | { size: number }} */
export function streamFault(input, name) {
  // What the rows answer, or what they raise: an error is reported, anything else is read as their iterator.
  const got = (() => { try { return iteratorOf(input.rows()); } catch (e) { return e; } })();
  if (got instanceof Error) return { why: word("calc-grammar.why.input_rows_read", { name: String(name), message: messageOf(got) }) };
  if (!got) return { why: word("calc-grammar.why.input_streamed_table", { name: String(name) }) };
  const it = isRowIterator(got) ? got : NO_NEXT;
  const width = input.fields.length;
  let size = 0;
  try {
    for (;;) {
      const s = it.next();
      if (s.done) break;
      const value = s.value;
      if (!isCells(value) || value.length !== width)
        return { why: word("calc-grammar.why.input_row_array", { name: String(name), size: String(size), width: String(width) }) };
      size += 1;
    }
  } catch (e) { return { why: word("calc-grammar.why.input_rows_read", { name: String(name), message: messageOf(e) }) }; }
  return { size };
}

/** A streamed input: read again on each pass; a pass that fails, or reads another table, is refused.
 *  @param {Field[]} fields @param {StreamedTable} input @param {number} size @param {string} name @returns {Held} */
export function streamTable(fields, input, size, name) {
  const width = fields.length;
  /** @param {string} why @returns {never} */
  const bad = (why) => stop("INPUT_INVALID", localize("calc-grammar.tables.the_input_name_why", "the input \"{name}\": {why}", { name: String(name), why: String(why) }), null);
  /** @param {unknown} e @returns {never} */
  const unread = (e) => bad(`its rows could not be read again: ${messageOf(e)}`);
  /** @returns {RowIterator} */
  const again = () => {
    /** @type {RowIterator | null} */
    let found = null;
    try { found = iteratorOf(input.rows()); } catch (e) { unread(e); }
    return found ?? bad("its rows answered no iterator on a later pass");
  };
  /** @param {RowIterator} it @returns {IteratorResult<Data, Data>} */
  const step = (it) => { try { return it.next(); } catch (e) { return unread(e); } };
  /** @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
  function* scan() {
    const it = again();
    let n = 0; let done = false;
    try {
      for (;;) {
        const s = step(it);
        if (s.done) break;
        const value = s.value;
        if (!isCells(value) || value.length !== width) bad(`row ${n} is not an array of its ${width} cells in fields order`);
        n += 1;
        yield value;
      }
      done = true;
    } finally {
      if (!done && typeof it.return === "function") it.return();
    }
    if (n !== size) bad(`it answered ${size} rows on its first pass and ${n} on a later one`);
  }
  return { fields, streamed: true, size, reader: readers(fields), scan, pick: (idx) => pickByPass(scan, idx),
    asArray: (row) => asCells(row) };
}

/* The rows at `idx` (any order, repeats allowed) from a table read only forward: one pass per chunk of indices. */
/** @param {() => IterableIterator<{ [key: string]: Data } | Data[], void, undefined>} scan @param {number[]} idx
 *  @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
function* pickByPass(scan, idx) {
  for (let c = 0; c < idx.length; c += PICK_CHUNK) {
    const part = idx.slice(c, c + PICK_CHUNK);
    /** @type {Map<number, number[]>} */
    const want = new Map(/** @type {[number, number[]][]} */ ([]));
    let max = -1;
    part.forEach((i, k) => {
      const slots = want.get(i);
      if (slots) slots.push(k); else want.set(i, [k]);
      if (i > max) max = i;
    });
    /** @type {({ [key: string]: Data } | Data[] | undefined)[]} */
    const buf = Array.from({ length: part.length }, () => undefined);
    let i = 0;
    for (const row of scan()) {
      const slots = want.get(i);
      if (slots) for (const k of slots) buf[k] = row;
      if (++i > max) break;
    }
    for (const row of buf) yield present(row);
  }
}

/* A row a pass has read: every index a view picks is one its source holds. */
/** @param {{ [key: string]: Data } | Data[] | undefined} row @returns {{ [key: string]: Data } | Data[]} */
function present(row) {
  if (row === undefined) throw new TypeError("a view picks only rows its source holds");
  return row;
}

/** The rows of `parent` at the ascending indices `keep` (a select over a streamed table).
 *  @param {Held} parent @param {number[]} keep @returns {Held} */
export function filterView(parent, keep) {
  /** @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
  function* scan() {
    if (!keep.length) return;
    let p = 0; let i = 0;
    for (const row of parent.scan()) {
      if (i === keep[p]) { yield row; if (++p === keep.length) return; }
      i += 1;
    }
  }
  return { fields: parent.fields, streamed: true, size: keep.length, reader: parent.reader, scan, asArray: parent.asArray,
    pick: (idx) => parent.pick(idx.map((k) => indexAt(keep, k))) };
}

/* An index a view holds at a place it has already counted. */
/** @param {number[]} list @param {number} k @returns {number} */
function indexAt(list, k) {
  const i = list[k];
  if (i === undefined) throw new TypeError("a view's row is read at a place it holds");
  return i;
}

/** The rows of `parent` in the order `perm` (a sort over a streamed table).
 *  @param {Held} parent @param {number[]} perm @returns {Held} */
export function orderView(parent, perm) {
  return { fields: parent.fields, streamed: true, size: perm.length, reader: parent.reader, asArray: parent.asArray,
    scan: () => parent.pick(perm), pick: (idx) => parent.pick(idx.map((k) => indexAt(perm, k))) };
}

/** Each row of `parent` with one cell computed from it, again on each pass (a span over a streamed table).
 *  @param {Held} parent @param {Field} field @param {(row: { [key: string]: Data } | Data[]) => Data} cellOf
 *  @returns {Held} */
export function extendView(parent, field, cellOf) {
  const fields = [...parent.fields, field];
  /** @param {{ [key: string]: Data } | Data[]} row @returns {Data[]} */
  const extend = (row) => [...parent.asArray(row), cellOf(row)];
  /** @param {IterableIterator<{ [key: string]: Data } | Data[], void, undefined>} rows
   *  @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
  function* each(rows) { for (const row of rows) yield extend(row); }
  return { fields, streamed: true, size: parent.size, reader: readers(fields), asArray: (row) => asCells(row),
    scan: () => each(parent.scan()), pick: (idx) => each(parent.pick(idx)) };
}

/* The next row of a view's own pass, which holds as many rows as it is asked for. */
/** @param {IterableIterator<{ [key: string]: Data } | Data[], void, undefined>} rows
 *  @returns {{ [key: string]: Data } | Data[]} */
function nextRow(rows) {
  const s = rows.next();
  if (s.done) throw new TypeError("a view's pass holds the rows it is asked for");
  return s.value;
}

/** The pairs `(li[k], rj[k])` of a join, ascending in `li`, as rows: the left row's cells, then the right's.
 *  @param {Held} L @param {Held} R @param {Field[]} fields @param {number[]} li @param {number[]} rj @returns {Held} */
export function joinView(L, R, fields, li, rj) {
  /** @param {{ [key: string]: Data } | Data[]} l @param {{ [key: string]: Data } | Data[]} r @returns {Data[]} */
  const merge = (l, r) => [...L.asArray(l), ...R.asArray(r)];
  /** @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
  function* scan() {
    if (!li.length) return;
    const right = R.pick(rj);
    let p = 0; let i = 0;
    for (const lrow of L.scan()) {
      while (p < li.length && li[p] === i) { yield merge(lrow, nextRow(right)); p += 1; }
      if (p === li.length) return;
      i += 1;
    }
  }
  /** @param {number[]} idx @returns {Generator<{ [key: string]: Data } | Data[], void, undefined>} */
  function* pick(idx) {
    const left = L.pick(idx.map((k) => indexAt(li, k))); const right = R.pick(idx.map((k) => indexAt(rj, k)));
    for (let k = 0; k < idx.length; k++) yield merge(nextRow(left), nextRow(right));
  }
  return { fields, streamed: true, size: li.length, reader: readers(fields), scan, pick, asArray: (row) => asCells(row) };
}

/** A table as `evaluate` answers it: row objects as the caller bound them, or a streamed table it reads again.
 *  @param {Held} t @returns {TableAnswer} */
export function answerOf(t) {
  const list = t.list;
  if (!t.streamed && list) return { fields: t.fields, rows: list };
  return { fields: t.fields, rows: function* rows() {
    try { yield* t.scan(); } catch (e) { const stopped = e instanceof Refused ? e : null; if (stopped) throw new Error(stopped.r.why); throw e; }
  } };
}
