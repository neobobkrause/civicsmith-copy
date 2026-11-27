/* R38's reference: what the policy and the regulation type parse from each fixture reading, as digests, so a test can
 * say the bounded parses give the answers they gave before (`fixtures/r38-answers.json`, written by
 * `make-r38-answers.mjs`). Nothing here is the module under test. */
import { DOCTYPES } from "../index.mjs";
import { flattenText, makeLocator } from "../../docprofile/readtext.mjs";
import { sha, thrownText, parseWith } from "./r37-readings.mjs";
/** @import { Reading } from "./r37-readings.mjs" */

/**
 * A parse's answer as a digest, or the message of what it threw.
 * @typedef {string | { threw: string }} ParseDigest
 */
/**
 * The parse of `policy` and of `regulation` over one reading.
 * @typedef {{ [key: string]: ParseDigest }} Parses
 */

/** The parse of `policy` and of `regulation` over one reading, each as a digest (a parse that throws is its message).
 *  @param {Reading} reading @returns {Parses} */
export function parsesOf(reading) {
  const flat = flattenText(reading.supplied);
  const locate = makeLocator(flat.segments);
  /** @type {Parses} */
  const out = {};
  for (const key of ["policy", "regulation"]) {
    const t = DOCTYPES.find((x) => x.key === key);
    try { out[key] = sha(parseWith(t, { ...reading.ctx, text: flat.text, at: null, locate, alsoSatisfies: () => [] })); }
    catch (e) { out[key] = { threw: thrownText(e) }; }
  }
  return out;
}
