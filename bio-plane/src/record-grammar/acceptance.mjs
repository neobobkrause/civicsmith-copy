// @ts-check
/* record-grammar: the one accepting act's record (R52; T41-1, N820; D3; K2405, K2418). Investigation §5: "One accepting
   act for every kind of proposal: a find, a hunch, a proposed question or step, or the reading of a passage. The member
   takes it up as proposed, takes it up edited, or writes her own instead, and the record keeps which." Every owner of an
   accepting act (`steps` R24, `hypotheses` R17, `run-productions` R22, `question-explorer` R6, `investigation` R12, R20,
   `case-authoring` R64) records this one shape, so "how often each kind is accepted unchanged" is one count over one
   field, group-wide (D3), and no owner spells the forms again.

   It refuses nothing on vouching grounds: which acts would make a member vouch for a legal or authored statement is
   each owner's, and that owner refuses `as_proposed` with `ACCEPT_MUST_REAUTHOR`, the one spelling held here. What it
   does refuse is a record that is not an acceptance at all: an unknown form, no proposal, no kind, no time, or no member
   (accepting is a member's act; a machine identity never accepts, R15). Pure: the caller stamps `at` (R24). */

import { isMachineIdentity } from './actors.mjs';
import { ISO_TS_RE } from './ids.mjs';

/** R52: the three forms of the one accepting act, in this order. */
export const ACCEPTANCE_FORMS = Object.freeze(['as_proposed', 'edited', 'own_instead']);

/** R52: the code an act's owner refuses `as_proposed` with, where accepting would make a member vouch for a legal or
 *  authored statement (an action's reason, a case statement, a testimony): she writes it in her own words. */
export const ACCEPT_MUST_REAUTHOR = 'ACCEPT_MUST_REAUTHOR';

/** What an accepting act hands in (R52). @typedef {{proposal: string, form: string, by: string, at: string, kind: string}} AcceptanceInput */
/** @type {Partial<AcceptanceInput>} */
const NONE = {};

/** R52: the record of one accepting act.
 * @typedef {Readonly<{proposal: string, form: string, by: string, at: string, kind: string}>} Acceptance */

/** R52: the one shape every accepting act records, `{proposal, form, by, at, kind}`, frozen, with no other key. Throws a
 *  `TypeError` naming the field for a blank or non-string `proposal` or `kind`, a `form` outside `ACCEPTANCE_FORMS`, a
 *  blank `by` or one that is a machine identity, or an `at` that is not `ISO_TS_RE`'s instant.
 * @param {AcceptanceInput} input
 * @returns {Acceptance} */
export function acceptanceRecord(input) {
  const { proposal, form, by, at, kind } = input && typeof input === 'object' ? input : NONE;
  if (typeof proposal !== 'string' || proposal.trim() === '') throw new TypeError('acceptanceRecord: proposal must be a non-blank string');
  if (typeof form !== 'string' || !ACCEPTANCE_FORMS.includes(form))
    throw new TypeError(`acceptanceRecord: form must be one of ${ACCEPTANCE_FORMS.join(', ')}`);
  if (typeof by !== 'string' || by.trim() === '' || isMachineIdentity(by)) throw new TypeError('acceptanceRecord: by must be a member, not blank or a machine');
  if (typeof at !== 'string' || !ISO_TS_RE.test(at)) throw new TypeError('acceptanceRecord: at must be YYYY-MM-DDTHH:MM:SSZ');
  if (typeof kind !== 'string' || kind.trim() === '') throw new TypeError('acceptanceRecord: kind must be a non-blank string');
  return Object.freeze({ proposal, form, by, at, kind });
}
