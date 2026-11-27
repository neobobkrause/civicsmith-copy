/* Test helpers: a content-type registry holding a given set of types, and a reading
 * made the way docprofile's `readText` makes one (flatten, locate, recognise, also,
 * parse), so a test can read through THIS module's types, or through any other set,
 * with the same mechanics. Nothing here is the module under test. */
import { makeRegistry, identify } from "../../site-profiles/index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";

/** @import { Registry, Confidence } from "../../site-profiles/index.mjs" */
/** @import { ContentType, DoctypeContext, Detection, SuppliedText } from "../../docprofile/doctypes/index.mjs" */
/** @import { Locate } from "../../docprofile/readtext.mjs" */

/**
 * A registry of content types: site-profiles' registry, its members docprofile's `ContentType`.
 * @typedef {Registry<DoctypeContext, ContentType>} TypeRegistry
 */
/**
 * Another type that matched in the `also` pass, with its confidence.
 * @typedef {Object} AlsoMatched
 * @property {string} key
 * @property {string | undefined} confidence
 */
/**
 * A type whose `detect` threw in the `also` pass, with what it threw.
 * @typedef {Object} AlsoErred
 * @property {string} key
 * @property {string} error
 */
/**
 * What `typeFor` answers: the registry's member (absent only from an empty registry), how sure, on what, and every
 * other type the document also satisfies or whose `detect` threw.
 * @typedef {Object} TypeFound
 * @property {ContentType | undefined} type
 * @property {Confidence} confidence
 * @property {string[]} signals
 * @property {Array<AlsoMatched | AlsoErred>} also
 */
/**
 * What `readWith` answers: the flattened text, the type found, the type's reading (`{}` where it read nothing) and the
 * locator the reading was made with.
 * @typedef {Object} ReadWith
 * @property {string} text
 * @property {TypeFound} doctype
 * @property {object} parsed
 * @property {Locate} locate
 */

/** A registry holding `types`, in their order.
 *  @param {ReadonlyArray<ContentType>} types
 *  @returns {TypeRegistry} */
export function registryOf(types) {
  /** @type {TypeRegistry} */
  const r = makeRegistry();
  for (const t of types) r.register(t);
  return r;
}

/** What a thrown value says: its `message`, else the value as text (`String(e.message || e)`; a thrown null or
 *  undefined has no message to read).
 *  @param {unknown} e
 *  @returns {string}
 *  @throws {TypeError} when the value thrown is null or undefined, as reading its message would */
const thrown = (e) => {
  if (e === null || e === undefined) throw new TypeError(`Cannot read properties of ${e} (reading 'message')`);
  return String(((typeof e === "object" || typeof e === "function") && "message" in e && e.message) || e);
};

/** `doctypeFor` over a registry: the first CERTAIN, else the best, else the fallback,
 *  and `also` from every other non-fallback type's own detect.
 *  @param {TypeRegistry} reg
 *  @param {DoctypeContext} ctx
 *  @returns {TypeFound}
 *  @throws {TypeError} when the registry holds members and answers none, as reading its key would */
export function typeFor(reg, ctx) {
  const r = reg.recognise(ctx);
  const member = r.member;
  /** @type {Array<AlsoMatched | AlsoErred>} */
  const also = [];
  for (const m of reg.all()) {
    if (member === undefined) throw new TypeError("Cannot read properties of undefined (reading 'key')");
    if (m.key === member.key || m.fallback === true) continue;
    /** @type {Detection} */
    let d;
    try { d = m.detect(ctx) || { match: false }; } catch (e) { also.push({ key: m.key, error: thrown(e) }); continue; }
    if (d.match) also.push({ key: m.key, confidence: d.confidence });
  }
  return { type: member, confidence: r.confidence, signals: r.signals, also };
}

/** A reading of `supplied` (a string or I2's text shape) through `reg`'s types.
 *  @param {TypeRegistry} reg
 *  @param {SuppliedText | string | null | undefined} supplied
 *  @param {DoctypeContext} [ctx]
 *  @returns {ReadWith}
 *  @throws {TypeError} when no type is found or the type found has no `parse`, as calling it would */
export function readWith(reg, supplied, ctx = {}) {
  const flat = flattenText(supplied);
  const dctx = { ...ctx, text: flat.text };
  const stack = identify(dctx);
  /* `kind` is set only where the stack's handler classified the address (no reader reads it, nor whether it is held) */
  const kind = stack.kind;
  const dt = kind === undefined ? typeFor(reg, { ...dctx, handler: stack.handler })
    : typeFor(reg, { ...dctx, handler: stack.handler, kind });
  const locate = makeLocator(flat.segments);
  const alsoSatisfies = () => dt.also.map((x) => x.key);
  const type = dt.type;
  if (type === undefined) throw new TypeError("Cannot read properties of undefined (reading 'parse')");
  if (typeof type.parse !== "function") throw new TypeError("dt.type.parse is not a function");
  const parsed = type.parse?.({ ...dctx, handler: stack.handler, at: ctx.at || null, locate, alsoSatisfies }) || {};
  return { text: flat.text, doctype: dt, parsed, locate };
}
