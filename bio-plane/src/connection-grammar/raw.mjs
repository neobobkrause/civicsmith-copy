// @ts-check
/* connection-grammar: how this module reads a value before it knows it is well formed (R1, R6, R9, R12-R14). Every
   check here and in the other files reads each field as it comes and never assumes its kind. Pure (R16). */

/**
 * A value as this module reads it before it is known to be well formed: any object that is not a list, each field
 * read as it comes (R1, R6, R9, R12-R14). Every field may be missing.
 * @typedef {Object} RawFields
 * @property {unknown} [id]
 * @property {unknown} [from]
 * @property {unknown} [to]
 * @property {unknown} [kind]
 * @property {unknown} [owner]
 * @property {unknown} [valid]
 * @property {unknown} [evidence]
 * @property {unknown} [grade]
 * @property {unknown} [derived]
 * @property {unknown} [label]
 * @property {unknown} [scope]
 * @property {unknown} [source]
 * @property {unknown} [precision]
 * @property {unknown} [zone]
 * @property {unknown} [value]
 * @property {unknown} [event]
 * @property {unknown} [edge]
 * @property {unknown} [at]
 * @property {unknown} [assertion]
 * @property {unknown} [ends]
 * @property {unknown} [method]
 * @property {unknown} [inputs]
 * @property {unknown} [as_of]
 * @property {unknown} [basis]
 * @property {unknown} [undetermined]
 * @property {unknown} [why]
 * @property {unknown} [key]
 * @property {unknown} [vars]
 * @property {unknown} [items]
 * @property {unknown} [next]
 * @property {unknown} [hub]
 * @property {unknown} [unread]
 * @property {unknown} [set_size]
 * @property {unknown} [what]
 * @property {unknown} [refused]
 * @property {unknown} [hops]
 * @property {unknown} [quantities]
 * @property {unknown} [visited]
 * @property {unknown} [reason]
 * @property {unknown} [node]
 * @property {unknown} [kinds]
 * @property {unknown} [page]
 * @property {unknown} [viewer]
 * @property {unknown} [neighbours]
 * @property {unknown} [word]
 * @property {unknown} [class]
 * @property {unknown} [by]
 * @property {unknown} [fixture]
 * @property {unknown} [declares]
 * @property {unknown} [undated]
 * @property {unknown} [group_wide]
 * @property {unknown} [in]
 * @property {unknown} [out]
 * @property {unknown} [viewers]
 * @property {unknown} [sees]
 * @property {unknown} [blind]
 * @property {unknown} [fenced]
 * @property {unknown} [expected]
 * @property {unknown} [hunch]
 */

/**
 * A list as this module reads it before it knows what its entries are.
 * @typedef {unknown[]} List
 */
/**
 * Whether `v` is a list, whose entries this module then reads as they come.
 * @param {unknown} v
 * @returns {v is List}
 */
export const isList = (v) => Array.isArray(v);
/**
 * An object as this module reads it by names it does not know beforehand, such as a path's quantities (R14).
 * @typedef {{[name: string]: unknown}} Table
 */
/**
 * Whether `v` is an object that is not a list, read by names not known beforehand.
 * @param {unknown} v
 * @returns {v is Table}
 */
export const isTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/**
 * Whether `v` is an object that is not a list, whose fields this module then reads as they come.
 * @param {unknown} v
 * @returns {v is RawFields}
 */
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/**
 * `v` when it is a non-empty string, spaces alone being empty; else null.
 * @param {unknown} v
 * @returns {string | null}
 */
export const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);
/**
 * Whether `v` is a non-empty string, spaces alone being empty.
 * @param {unknown} v
 * @returns {boolean}
 */
export const filled = (v) => text(v) !== null;
