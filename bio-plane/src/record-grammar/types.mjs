// @ts-check
/* record-grammar: the type vocabulary (R3–R5). Moved from the check catalogue at T18 with its comments. */

/* The construct formerly named Problem, then FOCUS, is the INQUIRY (REC-10;
   RECONCILED.md is the design). History is append-only and is not rewritten,
   so `problem` and `focus` and their literals remain LEGAL LEGACY ALIASES
   wherever they already exist, and the catalog judges a document by its
   NORMALIZED type. PROB-/FOCUS- ids may carry any spelling, because a
   bundle's id is immutable while its frontmatter modernizes on promotion.
   The alias map is FLATTENED, never chained: normalizeType is a single
   lookup, so problem points straight at inquiry rather than at focus. */
/* PL-12 / D-84: `bias` joins as a SIXTH prefix and a FIFTH canonical type. It
   has no legacy spelling and never will — it is born under the collapse rather
   than before it — so it appears exactly once here and needs no entry in
   LEGACY_TYPE_ALIASES. */
/* K171 (1) and K198 (2) (T8): six more canonical types, one prefix each and no legacy spelling, on `bias`'s terms.
   The Action layer's four are its modules' record objects (standards R15, conformance R17, consequences R14,
   escalation R21); `aspiration` and `goal` are intent's (its R26). */
/* N-A1 (T18, K608): `action_plan`, the Action fold's action plan (`action-plans`' record), on the same terms. */
export const OBJECT_TYPES = { INFO: 'information', PROB: 'inquiry', FOCUS: 'inquiry', INQ: 'inquiry', PROJ: 'project', ACTN: 'action', BIAS: 'bias',
  STD: 'standard', CONF: 'determination', CONS: 'consequence', ESC: 'escalation', ASP: 'aspiration', GOAL: 'goal',
  PLN: 'action_plan',
  /* T33-1 (B0.1, C:A-6; K1470): the types of T33's new objects, one per prefix of `ID_TABLE` (ids.mjs). They are rows of
     their owners' tables, not bundle documents: R1's prefix set, `HEADINGS`, `STATES` and `checkBundle`'s schemas gain
     none of them, and `checkBundle` admits only the bundle prefixes' types and `SUC`'s, below (bundle.mjs). */
  CALC: 'calculation', EVT: 'event', LIN: 'line', MNY: 'money_fact', MSR: 'money_set', PFA: 'person_fact',
  IDC: 'identity_claim', MTI: 'member_tie', CHK: 'interest_check', HYP: 'hypothesis', DUT: 'duty',
  STQ: 'standing_question',
  /* T46-1 (R59; N911): the success record (`consequences`). Not a bundle prefix either (R1), but, unlike the rows above, a
     record object promoted with history, so `STATES` holds its one state (document.mjs); `HEADINGS` still gains nothing.
     T47-1 (R62; N958): `checkBundle` admits its document, a bare `SUC` id under this type with `success_record@1`
     (bundle.mjs), without making `SUC` one of R1's prefixes. */
  SUC: 'success_record' };
export const LEGACY_TYPE_ALIASES = { problem: 'inquiry', focus: 'inquiry' };
/* An OWN key only (R5): `constructor`, `toString` and the other `Object.prototype` names are types nobody declared,
   and answer themselves, never an inherited function. Only a string can be an alias. */
/** R5: the alias's target for an own key of `LEGACY_TYPE_ALIASES`, and `t` unchanged for anything else.
 * @template T
 * @param {T} t
 * @returns {T | string} */
export const normalizeType = (t) => {
  if (t === 'problem') return LEGACY_TYPE_ALIASES.problem;
  if (t === 'focus') return LEGACY_TYPE_ALIASES.focus;
  return t;
};
