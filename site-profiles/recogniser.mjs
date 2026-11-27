/* One extension shape for every axis: the RECOGNISER and its REGISTRY.
 *
 * This is §4 of BIO_Content_Framework_v0_10 made real, and it is the reconciliation
 * D-68 / CONSTRUCTS Step 0 exists to perform. The inventory's worst finding was that
 * two axes (host stack, content type) each grew their OWN copy of the same
 * apparatus in a day: two confidence ladders, two ordered registries, two
 * `identify`-shaped loops. They were never two ideas. They are one, written twice.
 *
 * A RECOGNISER answers one question about a capture and declares how sure it is:
 *
 *     detect(ctx) -> { match, confidence, signals[] }
 *     key, label, version          // machine name, words for a member, and the
 *                                  //   version so a judgment can be found and
 *                                  //   revised when the rule later improves
 *
 * A REGISTRY holds the recognisers for ONE axis, ordered most specific first. The
 * first CERTAIN detection wins; short of that the highest confidence wins; and a
 * fallback that never matches is reached only by falling through and is always the
 * conservative one. That is the WHOLE extension mechanism: adding a host stack, a
 * content type, or an axis nobody has thought of yet is the same act — write a
 * recogniser, register it. The test of whether this consolidation worked is that the
 * ENTITY axis (CONSTRUCTS Step 4) costs one `makeRegistry()` and nothing else.
 */

/* The one confidence ladder, used by every axis. `certain` is a signal only this
   thing produces; `likely` is consistent but not conclusive; `possible` is a weak
   hint; `none` is the fallback's floor. Confidence below `certain` changes the
   answer (framework invariant 5): a merely-likely recogniser declines to narrow and
   the conservative default applies. Content-type recognisers simply never use
   `possible`; the ladder is still one ladder. */
export const CONFIDENCE = { CERTAIN: "certain", LIKELY: "likely", POSSIBLE: "possible", NONE: "none" };

/**
 * A value of the one ladder, `CONFIDENCE`'s four.
 * @typedef {string} Confidence
 */

/**
 * What a recogniser's `detect` answers: a match carries its confidence.
 * @typedef {{ match: true, confidence: Confidence, signals?: string[] } | { match: false, confidence?: Confidence, signals?: string[] }} Detection
 */

/**
 * A recogniser for one axis, whose `detect` reads that axis's context.
 * @template C
 * @typedef {{ key: string, label?: string, version?: number, fallback?: boolean, detect: (ctx: C) => (Detection | null | undefined) }} Recogniser
 */

/**
 * One member that matched, as `recognise` lists it.
 * @typedef {Object} Considered
 * @property {string} key
 * @property {Confidence} confidence
 * @property {string[]} signals
 */

/**
 * What `recognise` answers. `member` is absent only from a registry with no members.
 * @template M
 * @typedef {Object} Recognition
 * @property {M | undefined} member
 * @property {Confidence} confidence
 * @property {string[]} signals
 * @property {Considered[]} considered
 * @property {boolean} matched
 */

/**
 * @template M
 * @typedef {Object} RegistryOptions
 * @property {(m: M) => boolean} [isFallback] names the member answered when nothing matches
 */

/**
 * One axis's registry, its members most specific first.
 * @template C
 * @template {Recogniser<C>} M
 * @typedef {Object} Registry
 * @property {(m: M) => M} register
 * @property {() => M[]} all
 * @property {() => (M | undefined)} fallbackMember
 * @property {(ctx: C) => Recognition<M>} recognise
 */

const RANK = new Map([["none", 0], ["possible", 1], ["likely", 2], ["certain", 3]]);
/** Where a confidence sits on the single ladder, for comparing two detections.
 *  @param {unknown} c
 *  @returns {number} */
export function confidenceRank(c) { return typeof c === "string" ? RANK.get(c) ?? 0 : 0; }

/** Build a recogniser registry for one axis.
 *
 *  `isFallback` names the member that is returned when nothing detects — the
 *  conservative handler on the stack axis, the generic type on the content axis.
 *  Both carry `fallback: true`, so the default suffices and no axis needs its own
 *  registry code. That is the point.
 *
 *  `recognise(ctx)` always returns a member: an unrecognised capture gets the
 *  fallback rather than an error, because refusing to profile would just move the
 *  special case back out into every caller. */
/**
 * @template C
 * @template {Recogniser<C>} M
 * @param {RegistryOptions<M>} [opts]
 * @returns {Registry<C, M>}
 */
export function makeRegistry(opts = {}) {
  const isFallback = opts.isFallback || ((m) => m.fallback === true);
  /** @type {M[]} */
  const members = [];
  /** @type {Registry<C, M>} */
  const registry = {
    register(m) { members.push(m); return m; },
    all() { return members.slice(); },
    fallbackMember() { return members.find(isFallback) || members[members.length - 1]; },
    recognise(ctx) {
      /** @type {Considered[]} */
      const considered = [];
      /** @type {{ member: M, confidence: Confidence, signals?: string[] } | null} */
      let best = null;
      for (const m of members) {
        /** @type {Detection} */
        const d = m.detect(ctx) || { match: false };
        if (!d.match) continue;
        considered.push({ key: m.key, confidence: d.confidence, signals: d.signals || [] });
        const held = best;
        if (!held || confidenceRank(d.confidence) > confidenceRank(held.confidence)) best = { member: m, ...d };
        if (d.confidence === CONFIDENCE.CERTAIN) break;
      }
      const won = best;
      if (!won)
        return { member: registry.fallbackMember(), confidence: CONFIDENCE.NONE, signals: [], considered, matched: false };
      return { member: won.member, confidence: won.confidence, signals: won.signals || [], considered, matched: true };
    },
  };
  return registry;
}
