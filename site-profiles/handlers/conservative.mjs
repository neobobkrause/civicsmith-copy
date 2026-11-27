/* The handler for a document nothing recognises.
 *
 * This is the most important handler in the package, because it is the one that
 * runs when we are wrong about everything else. Its job is to be USELESS in the
 * safe direction: it claims almost nothing is machinery, nothing at all is
 * decoration, and therefore any difference in the bytes is reported as a possible
 * change to the substance.
 *
 * The consequence is deliberate. An unrecognised source will report change on
 * every fetch if it happens to churn, and a member will see noise. That is the
 * cost of not silently telling somebody their evidence is unchanged when it is
 * not, and it is the right way round: noise is annoying and a false "unchanged"
 * is a false claim in the record, discovered by the party the claim is aimed at.
 *
 * The noise is also a SIGNAL, and it is how this package grows. A source that
 * reports change constantly under this handler is a source that needs measuring
 * and a handler writing, and the pattern is visible rather than buried.
 */
import { CONFIDENCE } from "../recogniser.mjs";
import { REGION } from "../region.mjs";
/** @import { Detection } from "../recogniser.mjs" */
/** @import { StackHandler, Rule, Part } from "../region.mjs" */

/** @type {{ conservative: boolean, fallback: boolean, detect: () => Detection, kind: () => string, rules: () => Rule[], renderCritical: () => boolean, ignorable: (part: Part) => boolean } & StackHandler} */
const handler = {
  key: "conservative",
  label: "an unrecognised document",
  version: 1,
  /* `conservative` licenses the narrowing-without-certainty rule in compare()/assess();
     `fallback` is what the shared registry looks for when nothing detects. This is
     both the fallback member and the one handler whose rules are trusted without a
     certain detection, and both facts are true of it. */
  conservative: true,
  fallback: true,
  textual: true,

  /* Never claims a match: the registry reaches this handler by falling through,
     not by detection, so a stack handler can never lose to it. */
  /** @returns {Detection} */
  detect() { return { match: false, confidence: CONFIDENCE.NONE }; },
  /** @returns {string} */
  kind() { return "unknown"; },

  /* The ONLY rules here are ones that are true of the HTTP and HTML machinery
     itself rather than of any particular stack, and every one is per-response by
     definition rather than by observation. Nothing else is assumed. */
  /** @returns {Rule[]} */
  rules() {
    return [
      { key: "csp_nonce", region: REGION.MECHANICAL, label: "a one-time security token",
        /* A nonce that repeated would not be a nonce. This is definitional, not
           a guess about a framework. */
        patterns: [/(\bnonce=")([^"]*)(")/gi] },
    ];
  },

  /* With no idea what this document is, every part it names might be load-bearing
     for how it reads. So a missing part refuses the render, which is where the
     viewer started before fidelity had levels, and is correct in ignorance. */
  /** @returns {boolean} */
  renderCritical() { return true; },
  /* Deliberate non-fetches are still not absences: a third party's advertising
     was never part of the document under any handler. */
  /** @param {Part} part @returns {boolean} */
  ignorable(part) {
    return part.reason === "THIRD_PARTY" || part.reason === "OUTSIDE_THE_DOCUMENT"
        || part.reason === "COLLAPSED_SRCSET_FAMILY";
  },
};

export default handler;
