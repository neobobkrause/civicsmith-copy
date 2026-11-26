// @ts-check
/* record-grammar: canonical JSON (R12). Moved from the check catalogue at T18. */

/** An object read member by member. @typedef {{readonly [key: string]: unknown}} Members */
/** @param {unknown} v @returns {v is Members} */
const isMembers = (v) => v !== null && typeof v === 'object';
/** A list read item by item. @typedef {readonly unknown[]} List */
/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);

/* What `JSON.stringify` leaves out of an object and writes as `null` in an array. */
/** @param {unknown} x @returns {boolean} */
const unstorable = (x) => x === undefined || typeof x === 'function' || typeof x === 'symbol';

/** Canonicalize a parsed JSON value: recursively sorted keys, compact output. A member JSON cannot hold (`undefined`,
 *  a function, a symbol) is omitted from an object and is `null` in an array, as `JSON.stringify` has it, so the
 *  answer is always JSON (R12). No stored digest was taken over the old `"k":undefined` spelling (T18's job record).
 * @param {unknown} v
 * @returns {string} */
export function canonicalJson(v) {
  if (isList(v)) return '[' + v.map((x) => (unstorable(x) ? 'null' : canonicalJson(x))).join(',') + ']';
  if (isMembers(v)) {
    return '{' + Object.keys(v).filter((k) => !unstorable(v[k])).sort()
      .map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
