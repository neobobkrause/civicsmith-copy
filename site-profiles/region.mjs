/* The three regions a document is separated into (index.mjs' header gives the model).
   A leaf of its own so the handlers can name a region without importing index.mjs,
   which imports and registers them: the module registers its own handlers with no
   import cycle. It also states the shapes the handlers and `index.mjs` share. */

/** @import { Confidence, Detection } from "./recogniser.mjs" */

export const REGION = { EVIDENTIARY: "evidentiary", PRESENTATIONAL: "presentational", MECHANICAL: "mechanical" };

/**
 * A response's headers, by lower-case name.
 * @typedef {{ readonly [name: string]: string }} Headers
 */

/**
 * Where a recogniser adds the characters it examined (R20).
 * @typedef {Object} Work
 * @property {number} chars
 */

/**
 * What a caller knows about one fetch: its headers, its address, its content type and
 * its bytes decoded as text, with the count a bounded detect adds to.
 * @typedef {Object} StackContext
 * @property {Headers} [headers]
 * @property {string} [locator] the address
 * @property {string} [content_type]
 * @property {string} [text] the bytes decoded, when read as text
 * @property {Work} [work]
 */

/**
 * One rule of a handler: the patterns whose middle group is normalised, under one region.
 * @typedef {Object} Rule
 * @property {string} key
 * @property {string} region one of `REGION`'s three labels
 * @property {string} label words for a member
 * @property {RegExp[]} patterns each with three groups: before, the normalised part, after
 */

/**
 * One part a captured page names (a subresource), as a fidelity manifest lists it.
 * @typedef {Object} Part
 * @property {boolean} [ok] held
 * @property {string} [reason] why it was not fetched
 * @property {string} [kind]
 * @property {string} [url]
 */

/**
 * A stack handler: a recogniser of the host stack, with what follows from it.
 * @typedef {Object} StackHandler
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {boolean} [textual]
 * @property {boolean} [conservative] its rules are trusted without a CERTAIN match
 * @property {boolean} [fallback] the registry's member when nothing matches
 * @property {boolean} [shell] its class is a client-rendered shell
 * @property {string} [warning]
 * @property {(ctx: StackContext) => Detection} detect
 * @property {(ctx: StackContext, confidence?: Confidence) => (string | undefined)} [kind]
 * @property {(ctx: StackContext) => Rule[]} [rules]
 * @property {(ctx: StackContext) => (RegExp | null)} [boundary]
 * @property {(part: Part, ctx?: StackContext) => boolean} [renderCritical]
 * @property {(part: Part) => boolean} [ignorable]
 */
