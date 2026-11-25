/* membership's own refusal rows (requirements: `build/requirements/membership.md`). DEC-49: every refusal this module
 * answers carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act
 * is reached. Its families are C-56.1–.4 and .6, C-57, C-70.1–.3 and .5 and C-33.48; the member families (C-96, C-55,
 * C-102.11–.12) moved to `member-roster` (T51, CR-4), whose rows `index.mjs` joins to these under the old table names (R154,
 * each code one row, K231). C-56.5 and C-95 are `project-roster`'s; C-29, C-63 and C-96.8 are `credentials`'.
 *
 * NO_SUCH_PROJECT (R78) is one condition, a project absent or unseen, answered as absent and minted at one site,
 * `noSuchProject`. NOT_A_PARTICIPANT (R87) names one condition, the caller holds no participation in the project, minted at
 * `notAParticipant`, which promotion's fork calls too; a TARGET holding none (R36) is its own condition and code. */

import { rowWord } from "../member-roster/words.mjs";
import { MEMBER_ROSTER_ROWS } from "../member-roster/checks.mjs";

const at = (fn, region) => `src/membership/index.mjs ${fn} > ${region}`;

/* R133 (T47; K3037): every refusal-row table this module exports is a frozen map from a code to a frozen row, read by
   promotion's row census and answer-envelope and written by no one. */
const frozenRows = (table) => Object.freeze(Object.fromEntries(
  Object.entries(table).map(([code, row]) => [code, Object.freeze({ ...row })])));

/* The rows of this module's own that were in `MEMBERSHIP_CHECKS`; the table exported below is the union with
   `member-roster`'s (R154), the same rows under the same names, so a user's import of them still resolves (K3268). */
const OWN_ROWS = frozenRows({
  NO_SUCH_PROJECT: Object.freeze({
    check: 'C-70.5', where: at("noSuchProject", "is-project-seen"),
    translation: rowWord("NO_SUCH_PROJECT"),
  }),
  NOT_A_PARTICIPANT: Object.freeze({
    check: 'C-56.3', where: at("notAParticipant", "is-not-a-participant"),
    translation: rowWord("NOT_A_PARTICIPANT"),
  }),
  TARGET_NOT_A_PARTICIPANT: Object.freeze({
    check: 'C-56.4', where: at("projectRemove", "is-remove-target-participant"),
    translation: rowWord("TARGET_NOT_A_PARTICIPANT"),
  }),
  LAST_COMMITTED_OWNER: {
    check: 'C-33.48',
    where: 'src/membership/index.mjs projectLeave > is-leave-owner-floor',
    translation: rowWord("LAST_COMMITTED_OWNER"),
  },
  /* T45 (T45-2; N893, Actions D4; R128): the project-act guard could not answer (a throw, a promise or an answer
     it does not give), so the invitation or the visibility setting fails closed. T47 (R142 (2), K3078): its translation is
     `words.json`'s `refusal.PROJECT_GUARD_UNCHECKED`, read by key. */
  PROJECT_GUARD_UNCHECKED: Object.freeze({
    check: 'C-56.6', where: at("#projectActGuarded", "is-project-guard-checked"),
    translation: rowWord("PROJECT_GUARD_UNCHECKED"),
  }),
});

/* R154 (K231; `member-roster` R68): the three member tables are `member-roster`'s rows, exported here under the names
   every census reads, and `MEMBERSHIP_CHECKS` is the union of its rows and this module's, every code one row. */
export const MEMBERSHIP_CHECKS = frozenRows({ ...MEMBER_ROSTER_ROWS.MEMBERSHIP_CHECKS, ...OWN_ROWS });
export const MEMBER_ID_CHECKS = MEMBER_ROSTER_ROWS.MEMBER_ID_CHECKS;
export const CUSTODIAL_CHECKS = MEMBER_ROSTER_ROWS.CUSTODIAL_CHECKS;

/* REC-134 / C-56 — SIGHT IS NOT AUTHORITY (Membership Architecture v2 §7, the block of that
 * name, BOB #15, 2026-09-18; §4.9: *"the custodial role can audit everything and direct
 * nothing"*). An act that changes a project, its productions or their grants asks the ACTOR'S
 * OWN POSITION IN THAT PROJECT — never what the actor may SEE. An administrator (enrolled, or
 * the founder) saw every project (every discoverable one since D54) and so passed every act whose only barrier was the
 * visibility gate; these two rows are what such an act now answers when the position is
 * missing. The positions are §7's: a JOINED participant holds the working rights (§7.5 —
 * invited-not-joined is view only), and an OWNER holds the acts §7 and DEC-72 reserve to the
 * owner. §7.13's add-an-owner is the one administrator path and is NOT behind this family.
 * A machine credential carries no position and is not asked (the fences on machines are
 * their own and unchanged). */
export const PROJECT_AUTHORITY_CHECKS = frozenRows({
  PROJECT_ACT_NOT_A_PARTICIPANT: {
    check: 'C-56.1',
    where: 'src/membership/index.mjs projectAuthority > is-project-authority',
    translation: rowWord("PROJECT_ACT_NOT_A_PARTICIPANT"),
  },
  /* T40 (R122; N812, K231): minted at one site, `notTheOwner`, which `projectAuthority` (R55) and `credentials`
     (its R54–R57) answer through; the row's `where` moved there, its words unchanged. */
  PROJECT_ACT_NOT_THE_OWNER: {
    check: 'C-56.2',
    where: 'src/membership/index.mjs notTheOwner > is-not-the-owner',
    translation: rowWord("PROJECT_ACT_NOT_THE_OWNER"),
  },
});

/* REC-149 / C-70 — A DISCOVERABLE PROJECT SHOWS ITS EXISTENCE, NOT ITS DOORS (Membership Architecture
 * v2 §7, item 7.14, BOB #16 from Bob's ruling of 2026-09-18, *"each project chooses"*). A member who
 * is outside a DISCOVERABLE project sees its id and name in the directory, and nothing else. Every act
 * such a member aims at it — other than the request to join — is refused POSITIONALLY with this code,
 * carrying the project's id and name and NOTHING else. A "does not exist" answer there would be false
 * about a project the directory has just shown the caller; a HIDDEN project still answers exactly as
 * one that does not exist (§7.9, REC-138) to every member who is not an administrator. D54 (K2408, K2409;
 * T41-3): an administrator neither invited nor joined to a HIDDEN project is at its EXISTENCE too, and this
 * code then also carries its owners' handles (membership R77). C-70.1's translation is true of both forms.
 * Minted in ONE region, `Membership#existenceOnly`, which every act's sight check relays. */
export const PROJECT_VISIBILITY_CHECKS = frozenRows({
  PROJECT_SEEN_NOT_A_PARTICIPANT: {
    check: 'C-70.1',
    where: 'src/membership/index.mjs #existenceOnly > is-project-existence-only',
    translation: rowWord("PROJECT_SEEN_NOT_A_PARTICIPANT"),
  },
  PROJECT_VISIBILITY_NOT_THE_OWNER: {
    check: 'C-70.2',
    where: 'src/membership/index.mjs projectVisibilitySet > is-project-visibility-owner',
    translation: rowWord("PROJECT_VISIBILITY_NOT_THE_OWNER"),
  },
  PROJECT_VISIBILITY_UNKNOWN_SETTING: {
    check: 'C-70.3',
    /* REC-197: the value check moved into one helper both doors ask (the owner's act and a creation's
       `visibility`), so this row names that helper's region and the code keeps ONE site. */
    where: 'src/membership/index.mjs visibilitySettingRefusal > is-project-visibility-setting',
    translation: rowWord("PROJECT_VISIBILITY_UNKNOWN_SETTING"),
  },
});

/* REC-137 / C-57 — A CASE RATIFICATION'S AUTHORITY IS ITS SIGNATURES, AND THEY MUST INCLUDE AN
 * OWNER OF THE PUBLISHING PROJECT (Membership Architecture v2 §7, the bullet *"A CASE
 * RATIFICATION: who AUTHORISES it and who may DELIVER it"*, BOB #15, 2026-09-18; DEC-72 clause 5:
 * publishing is the project owner's act). Before this, `op=caseratify` accepted the signature of
 * ANY registered signer of the instance — the instance-wide signer set and the `publish`
 * capability were the only authority asked — so a case authored by an owner could be committed
 * under a non-owner's signature, and the record then named that non-owner as the one who stood
 * behind the project's case. The DELIVERY half of the same bullet (an enrolled administrator with
 * no role in the project may not carry the signature in) is NOT in this family: it is REC-134's
 * one positional check, `projectAuthority`, asked of the deliverer, and answers C-56.1. */
export const CASE_AUTHORITY_CHECKS = frozenRows({
  CASE_SIGNER_NOT_AN_OWNER: {
    check: 'C-57.1',
    /* REC-140 (2026-09-18): the region moved into `caseAuthority`, the ONE helper both ratify
       paths call — `op=caseratify` for the case document and `op=ratify` for a finding a
       ratified case pins (Publication rule 2 as BOB #15 applied it to D-429). The TRANSLATION
       was corrected from "this case" to "a case, and each finding in it" at the same time,
       because the same code now answers at both acts and the old sentence was false at one. */
    where: 'src/membership/index.mjs caseAuthority > is-case-signer-owner',
    translation: rowWord("CASE_SIGNER_NOT_AN_OWNER"),
  },
});
