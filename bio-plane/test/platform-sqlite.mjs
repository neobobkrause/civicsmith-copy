/* The platform's single-value limit, in the suite: a preload for node:sqlite.
 *
 *   node --import ./bio-plane/test/platform-sqlite.mjs --test <files>
 *   NODE_OPTIONS=--import=<absolute path to this file> node --test <files>
 *
 * Durable Object SQLite refuses a value over about 2.1 MB with SQLITE_TOOBIG
 * (measured: 2,098,176 B passed, 2,252,800 B failed; record-core/schema.mjs:30-35)
 * and node:sqlite does not, so no suite saw a reading over the limit (G41). This
 * file wraps StatementSync.prototype.run/all/get/iterate (and the tag store's
 * run/all/get/iterate) so a statement is refused, before it runs, when one bound
 * string or blob is over LIMIT bytes, or the bound strings and blobs together
 * are (the row approximation). A string is judged by its UTF-8 bytes, a
 * Uint8Array/Buffer/ArrayBuffer/DataView by its bytes; numbers, bigints and null
 * are not judged. Named parameters are judged like positional ones.
 *
 * The refusal has the shape node's own SQLITE_TOOBIG has, read from a real one
 * (a database opened with `limits: {length}` and a bind over it, node 26.10.0):
 * an Error, message "string or blob too big", own properties code
 * "ERR_SQLITE_ERROR", errcode 18, errstr "string or blob too big".
 *
 * WHAT IT CANNOT JUDGE: a value the engine computes (`a || b`, json_set,
 * json_group_array, group_concat, replace, printf, zeroblob(n)), a literal inside
 * the SQL text of exec() or of prepare(), and a column grown by UPDATE from its
 * own old value. It sees only what a caller binds. A write it does not see is
 * the platform check's to find (a local workerd run at the real limit).
 *
 * Importing it twice, or in a child that inherits NODE_OPTIONS, wraps once. */
import { DatabaseSync } from "node:sqlite";

export const PLATFORM_VALUE_LIMIT = 2_098_176;

const MARK = Symbol.for("bio.platformSqlite");

/** @typedef {(...args: unknown[]) => unknown} Method a statement's or a tag store's method, as the wrapper calls it */
/** @typedef {Method & {[MARK]?: true}} MarkedMethod a method, marked once it is the wrapper's */
/** @typedef {"run" | "all" | "get" | "iterate"} MethodName the methods that bind values */
/** @typedef {{run: MarkedMethod, all: MarkedMethod, get: MarkedMethod, iterate: MarkedMethod}} Methods */
/** @typedef {((...args: unknown[]) => Methods) & {[MARK]?: true}} MarkedCreate `createTagStore`, marked once wrapped */

/**
 * @param {unknown} v
 * @returns {number} the bytes a bound value takes: a string's UTF-8 bytes, a binary value's bytes, else 0
 */
const bytesOf = (v) => {
  if (typeof v === "string") return Buffer.byteLength(v, "utf8");
  if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v.byteLength;
  return 0;
};

const tooBig = () => {
  /** @type {Error & {code?: string, errcode?: number, errstr?: string}} */
  const e = new Error("string or blob too big");
  e.code = "ERR_SQLITE_ERROR";
  e.errcode = 18;
  e.errstr = e.message;
  return e;
};

/* `args` are a statement's bind arguments: values, or an object of named values
   first (a plain object, not a typed array). */
const judge = (/** @type {unknown[]} */ args) => {
  let sum = 0;
  const one = (/** @type {unknown} */ v) => {
    const n = bytesOf(v);
    if (n > PLATFORM_VALUE_LIMIT) throw tooBig();
    sum += n;
  };
  for (const a of args) {
    if (a !== null && typeof a === "object" && !ArrayBuffer.isView(a) && !(a instanceof ArrayBuffer)) {
      for (const v of Object.values(a)) one(v);
    } else one(a);
  }
  if (sum > PLATFORM_VALUE_LIMIT) throw tooBig();
};

/**
 * @param {Methods} proto
 * @param {MethodName[]} names
 */
const wrap = (proto, names) => {
  for (const name of names) {
    const real = proto[name];
    if (typeof real !== "function" || real[MARK]) continue;
    /** @type {MarkedMethod | undefined} */
    const wrapped = { [name](/** @type {unknown[]} */ ...args) { judge(args); return real.apply(this, args); } }[name];
    if (wrapped === undefined) continue; // never: the object has the member it is read by
    wrapped[MARK] = true;
    proto[name] = wrapped;
  }
};

const probe = new DatabaseSync(":memory:");
wrap(Object.getPrototypeOf(probe.prepare("select 1")), ["run", "all", "get", "iterate"]);
if (typeof probe.createTagStore === "function" && !DatabaseSync.prototype.createTagStore[MARK]) {
  /* The tag store binds its template's values. Each store has its own prototype object in node 26, so the methods are
     wrapped on the store createTagStore returns. */
  const realCreate = DatabaseSync.prototype.createTagStore;
  /** @type {MarkedCreate} */
  const create = { createTagStore(/** @type {unknown[]} */ ...args) {
    /** @type {Methods} */
    const store = realCreate.apply(this, args);
    /** @type {MethodName[]} */
    const names = ["run", "all", "get", "iterate"];
    for (const name of names) {
      const real = store[name];
      const wrapped = { [name](/** @type {unknown} */ strings, /** @type {unknown[]} */ ...values) { judge(values); return real.call(this, strings, ...values); } }[name];
      if (wrapped === undefined) continue; // never: the object has the member it is read by
      store[name] = wrapped;
    }
    return store;
  } }.createTagStore;
  create[MARK] = true;
  DatabaseSync.prototype.createTagStore = create;
}
probe.close();
