/* The content type for a document whose type is not recognised.
 *
 * Reports any substantive difference and declines to describe it. That is the safe
 * direction and it is deliberately unsatisfying: a member sees "this changed" with
 * no account of what, which is annoying, honest, and a standing prompt to measure
 * the type and write it. The alternative, guessing at what a document means, is how
 * a system starts reassuring people about things it has not understood.
 */
import { CONFIDENCE, CONTRACT } from "../docprofile/doctypes/index.mjs";
import { event, worstSignificance, isMeaningful } from "../site-profiles/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/** @import { DoctypeContext, Detection, Entity, EntityFacts, Connection } from "../docprofile/doctypes/index.mjs" */
/** @import { EventHead } from "../site-profiles/index.mjs" */

/**
 * What the generic type reads of a document: no entities and no facts.
 * @typedef {Object} GenericReading
 * @property {Entity[]} entities
 * @property {EntityFacts} facts
 */
/**
 * What the generic type answers of two readings: one `substance_changed` event, graded by the catalogue.
 * @typedef {Object} GenericAssessment
 * @property {boolean} meaningful
 * @property {string | null} significance
 * @property {EventHead[]} events
 * @property {null} confirmed
 * @property {string} why
 */
/**
 * The generic content type, the one fallback: docprofile's `ContentType`, its reading and its answer its own.
 * @typedef {Object} GenericType
 * @property {string} key
 * @property {string} label
 * @property {number} version
 * @property {true} fallback
 * @property {string} contract
 * @property {(ctx: DoctypeContext) => Detection} detect
 * @property {(ctx: DoctypeContext) => GenericReading} parse
 * @property {(before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => GenericAssessment} assess
 * @property {((before: object | null | undefined, after: object | null | undefined, ctx: DoctypeContext) => ReadonlyArray<Connection> | null | undefined) | undefined} [connections]
 *   never present: the generic type implies no connections
 */

/** @type {GenericType} */
const generic = {
  key: "generic", label: localize("doctypes.generic.label", "a document of no recognised type"), version: 1, fallback: true,
  /* Watch its substance: with no reader for its members, the whole document is the
     unit. This is the declared contract (CONSTRUCTS Step 0 #4), not one derived from
     the stack that served it. */
  contract: CONTRACT.SUBSTANCE,
  detect() { return { match: false, confidence: CONFIDENCE.NONE }; },
  /* FW-17 / IC-86 — THIS READER CANNOT SAY WHERE A REFERENCE WAS READ, for the
     one reason that admits no fix: it reads no references. The generic type's
     whole discipline is that it reports a substantive difference without
     describing it, so it emits NO entities, and where a reference was read is
     not a question it can be asked. Declared here rather than left implicit
     because IC-86 obliges a reader that cannot say to say so, and "it has
     nothing to position" is a materially different answer from "it had
     something and could not place it" — which is what the calendar reader's own
     header records. This one closes when a measured type is written for the
     document, not before. */
  parse() { return { entities: [], facts: {} }; },
  /* A substantive difference in an unrecognised document is flagged in the safe
     direction, and left undescribed: one `substance_changed` event, so `meaningful` is
     derived from the catalogue here as everywhere else (R14), never asserted. */
  assess() {
    const events = [event("substance_changed", {
      why: localize("doctypes.generic.changed", "the substance of this document changed; what kind of document it is has not been worked out") })];
    return { meaningful: isMeaningful(events), significance: worstSignificance(events), events, confirmed: null,
             why: localize("doctypes.generic.changed_undescribed", "the substance of this document changed; what kind of document it is has not been worked out, so what changed is not described") };
  },
};

export default generic;
