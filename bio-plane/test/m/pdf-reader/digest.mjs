/* pdf-reader tests: a digest of a whole answer that is the same for equal answers and holds nothing of it, so the
 * answer for a 16 MB file (150 MB as JSON) can be compared without being written out. Objects by key in order,
 * arrays by element, strings by their characters (in chunks), numbers and booleans by value. */
import { createHash } from "node:crypto";

/** A value of any kind, as the walk meets it.
 *  @typedef {object | string | number | bigint | boolean | symbol | null | undefined} Digestible */
/** A list met in the walk, its entries not yet looked at.
 *  @typedef {Digestible[]} Items */
/** An object met in the walk, its members not yet looked at.
 *  @typedef {{ [key: string]: Digestible }} Members */

/** Whether `v` is a list.
 *  @param {unknown} v
 *  @returns {v is Items} */
const isItems = (v) => Array.isArray(v);
/** Whether `v` is an object (a list's and a byte array's own tests come first).
 *  @param {unknown} v
 *  @returns {v is Members} */
const isMembers = (v) => typeof v === "object" && v !== null;

/** The digest of `value`, as 64 hex digits.
 *  @param {Digestible} value
 *  @returns {string} */
export function digestOf(value) {
  const h = createHash("sha256");
  /** @param {string} s */
  const text = (s) => { for (let i = 0; i < s.length; i += 65536) h.update(s.slice(i, i + 65536)); };
  /** @param {Digestible} v */
  const walk = (v) => {
    if (v === null) h.update("n;");
    else if (typeof v === "string") { h.update(`s${v.length}:`); text(v); h.update(";"); }
    else if (typeof v !== "object") h.update(`${typeof v}:${String(v)};`);
    else if (isItems(v)) { h.update(`[${v.length}:`); for (const x of v) walk(x); h.update("];"); }
    else if (v instanceof Uint8Array) h.update(`b${v.length}:${Buffer.from(v).toString("hex")};`);
    else if (isMembers(v)) { const keys = Object.keys(v); h.update(`{${keys.length}:`); for (const k of keys) { h.update(`k${k.length}:${k};`); walk(v[k]); } h.update("};"); }
  };
  walk(value);
  return h.digest("hex");
}
