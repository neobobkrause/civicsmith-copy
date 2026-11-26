// @ts-check
/* record-grammar: actor identity (R13–R15). Moved from the check catalogue at T18 with its comments. Membership is
   the semantic owner, but text-chain (layer 1) reads `isMachineIdentity`, so it lives below both. */

/** Surface and AI identities, never release authors. Staged named-member-now:
 *  a member identity is any named identity outside this closed set, until the
 *  engagement layer adds per-member credentials (intake doctrine 4a). */
export const NON_MEMBER_AUTHORS = ['claude', 'pwa-client', 'daemon', 'sweep', 'session', 'accelerator', 'apps-script', 'system', 'agent', 'ai'];
/** The three actor classes a capture may DECLARE (C-18.1). Exported since
 *  REC-46 because a bare class word standing where a person's name belongs is
 *  one of the three ways this plane used to ask "is this a machine" — see
 *  `isMachineIdentity` below. The CHECK that reads it is still asking a
 *  different question (is this a legal value of a declared field), and that
 *  difference is stated at the site. */
export const ACTOR_CLASSES = ['daemon', 'session', 'member'];

/* ===================================================================== *
 * THE MACHINE-IDENTITY PREDICATE (REC-46, out of REC-45's measurement).
 *
 * THE DEFECT THIS CLOSES, measured through op=promote before it was written:
 * this plane had THREE unrelated ways of asking "is this a person" — the word
 * list above, the `token:` prefix `store.mjs` refused BY SHAPE, and
 * `ACTOR_CLASSES` — and NONE of them knew the whole answer. `checkGrounds`
 * asked only the word list, so `asserted_by: token:member` PASSED the
 * hand-written door while the identical claim was refused for saying `agent`.
 * A word list that a new class silently escapes is the shape to remove, not to
 * extend, so there is now ONE predicate and every asking site reads it.
 *
 * A SECOND MINTED SPELLING, found by sweeping for the class rather than
 * trusting the routed count of three: `index.mjs` stamps `token:<class>` on
 * AUTHORSHIP fields (author, actor, by) and `class:<class>` on OWNERSHIP and
 * viewer fields, at twenty sites between them. The word list knew neither.
 * Closing only the routed one would have left the same hole one spelling over.
 *
 * WHY THE MINT COMPOSES FROM HERE TOO. The prefixes are the CONTROL PLANE's
 * own vocabulary, and a refusal that reads one literal while the stamp writes
 * another is precisely the drift D-164 exists to stop. When this was written the
 * legacy index, store and query modules each imported it; today control-plane's
 * routes stamp and every refusing module imports this one, so the stamp and the
 * refusal are the same two strings and cannot disagree at all.
 *
 * TWO PREDICATES, AT TWO STRENGTHS, AND THE NARROWER ONE IS NOT AN OVERSIGHT.
 * `isMachineStamp` answers "did the control plane mint this identity", by
 * SHAPE. `isMachineIdentity` answers the full question and is `isMachineStamp`
 * OR a bare class word OR a surface/AI identity. `taskForward`/`taskResolve`
 * (REC-28, D-151) deliberately take the NARROW one: on those two verbs the
 * bare string "admin" is a LEGITIMATE actor — it is ROOT_ADMIN's own session —
 * so the bare-class arm would refuse the root administrator's browser. That
 * difference is real, it is documented at those two sites, and it is not
 * collapsed. Both still derive from the ONE set of prefixes, so moving what
 * counts as a minted machine identity moves those two sites as well.
 *
 * ABSENT IS NOT MACHINE. An empty or missing identity answers FALSE here and
 * every caller keeps its own `!who` arm, because "nobody said" and "a machine
 * said" are different findings and undetermined is first-class (CLAUDE.md).
 * ===================================================================== */

/** The prefix the control plane stamps on an AUTHORSHIP field (author, actor,
 *  `by`) for a machine credential — a NAMED machine identity rather than an
 *  anonymous one, which is what lets an unattended writer act at all (D-61). */
export const MACHINE_AUTHOR_PREFIX = 'token:';
/** The prefix it stamps on an OWNERSHIP or VIEWER field (viewer, owner, by,
 *  declaredBy, resolvedBy, threadedBy, memberId, decidedBy). */
export const MACHINE_CLASS_PREFIX = 'class:';
/** Every spelling this plane mints for a machine. A new one is added HERE and
 *  every refusal, every stamp and every sweep follows it. */
export const MACHINE_STAMP_PREFIXES = [MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX];

/* The one fold both predicates read: stringified, trimmed, lower-cased. A value that cannot be stringified (an object
   with no prototype, or a throwing `toString`) folds to '' and so is absent, never a throw (R15). */
/** @param {unknown} who @returns {string} */
function fold(who) {
  try { return String(who ?? '').trim().toLowerCase(); } catch { return ''; }
}

/** Did the CONTROL PLANE mint this identity? Case-folded deliberately: at the
 *  store the value is server-stamped and the fold changes nothing, while at the
 *  gate the value is hand-written by a caller and `Token:member` is the same
 *  claim as `token:member`.
 * @param {unknown} who
 * @returns {boolean} */
export function isMachineStamp(who) {
  const s = fold(who);
  return s !== '' && MACHINE_STAMP_PREFIXES.some((p) => s.startsWith(p));
}

/** Is this identity a machine rather than a named person? The whole question,
 *  in one place. Returns FALSE for an absent identity — see the block above.
 * @param {unknown} who
 * @returns {boolean} */
export function isMachineIdentity(who) {
  const s = fold(who);
  if (s === '') return false;
  return isMachineStamp(s) || ACTOR_CLASSES.includes(s) || NON_MEMBER_AUTHORS.includes(s);
}
