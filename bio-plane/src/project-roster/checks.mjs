/* project-roster's own refusal rows (requirements: `build/requirements/project-roster.md`). DEC-49: every refusal this
 * module answers carries its code, its row and the member's translation, so a surface shows the same sentence wherever
 * the act is reached.
 *
 * Copied from membership's `checks.mjs` at the split (T38, N783; K624: copy, then delete), each row's number and
 * translation unchanged and its `where` re-pointed to the region in this module's `index.mjs` that mints it: C-56.5
 * (R3), C-33.28 (R4), C-70.4 (R9) and the whole C-95 family (R10–R14). C-56.4, C-33.48 and C-70.1–.3 stay
 * membership's, minted at its acts (`existenceAct`'s C-70.1 is relayed here, never minted). */

import { hasWord, word } from "../setup-words/index.mjs";

/* Plan rule 6 (N1116, DEC-258): a row's translation is words.json's `refusal.<CODE>`, read by key through setup-words;
   `null` while the design lane has not given a code its word (reported, never inline English). */
const said = (code) => (hasWord(`refusal.${code}`) ? word(`refusal.${code}`) : null);

const at = (fn, region) => `src/project-roster/index.mjs ${fn} > ${region}`;

export const PROJECT_ROSTER_CHECKS = Object.freeze({
  /* R3 (N335): an owner is a JOINED participant with the owner flag, so a target not joined is its own condition. */
  TARGET_NOT_JOINED: Object.freeze({
    check: 'C-56.5', where: at("projectOwnerAdd", "is-owner-target-joined"),
    translation: said('TARGET_NOT_JOINED'),
  }),
  /* R4 (REC-64): one owner is the floor. */
  LAST_OWNER: Object.freeze({
    check: 'C-33.28', where: at("projectOwnerRemove", "is-owner-floor"),
    translation: said('LAST_OWNER'),
  }),
  /* R9 (REC-149): the directory is a member's. */
  PROJECT_DIRECTORY_NEEDS_A_MEMBER: Object.freeze({
    check: 'C-70.4', where: at("projectDirectory", "is-project-directory-member"),
    translation: said('PROJECT_DIRECTORY_NEEDS_A_MEMBER'),
  }),
});

/* REC-150 / C-95 — THE REQUEST TO JOIN (Membership Architecture v2 §7, item 7.14, "The request to join"; Bob's ruling
 * of 2026-09-18: *"somebody who sees the project can ask to be added as a member"*). A member outside a DISCOVERABLE
 * project asks (at most one open request per member per project, an optional comment) and may withdraw; an OWNER grants
 * — which writes the requester `invited`, never `joined`, because joining is the member's own act (§7.4) — or declines;
 * administrators and the founder see requests and answer none; setting the project HIDDEN lapses every open request.
 * Every refusal here is said only where it discloses nothing: a request to a project the caller cannot see is
 * `noSuchProject` byte for byte and never a C-95 code, and a withdrawal with no open request is ONE answer whatever the
 * id names. */
export const PROJECT_JOIN_REQUEST_CHECKS = Object.freeze({
  PROJECT_REQUEST_NEEDS_A_MEMBER: Object.freeze({
    check: 'C-95.1', where: at("#noRequester", "is-join-request-member"),
    translation: said('PROJECT_REQUEST_NEEDS_A_MEMBER'),
  }),
  PROJECT_REQUEST_NOT_OUTSIDE: Object.freeze({
    check: 'C-95.2', where: at("projectRequest", "is-join-request-ask"),
    translation: said('PROJECT_REQUEST_NOT_OUTSIDE'),
  }),
  PROJECT_REQUEST_ALREADY_OPEN: Object.freeze({
    check: 'C-95.3', where: at("projectRequest", "is-join-request-ask"),
    translation: said('PROJECT_REQUEST_ALREADY_OPEN'),
  }),
  PROJECT_REQUEST_NONE_OPEN: Object.freeze({
    check: 'C-95.4', where: at("#noOpenRequest", "is-join-request-none-open"),
    translation: said('PROJECT_REQUEST_NONE_OPEN'),
  }),
  PROJECT_REQUEST_ANSWER_NOT_THE_OWNER: Object.freeze({
    check: 'C-95.5', where: at("projectRequestAnswer", "is-join-request-answer"),
    translation: said('PROJECT_REQUEST_ANSWER_NOT_THE_OWNER'),
  }),
  PROJECT_REQUEST_UNKNOWN_ANSWER: Object.freeze({
    check: 'C-95.6', where: at("projectRequestAnswer", "is-join-request-answer"),
    translation: said('PROJECT_REQUEST_UNKNOWN_ANSWER'),
  }),
  PROJECT_REQUEST_REQUESTER_INACTIVE: Object.freeze({
    check: 'C-95.7', where: at("projectRequestAnswer", "is-join-request-answer"),
    translation: said('PROJECT_REQUEST_REQUESTER_INACTIVE'),
  }),
  PROJECT_REQUEST_REQUESTER_ALREADY_A_PARTICIPANT: Object.freeze({
    check: 'C-95.8', where: at("projectRequestAnswer", "is-join-request-answer"),
    translation: said('PROJECT_REQUEST_REQUESTER_ALREADY_A_PARTICIPANT'),
  }),
  PROJECT_REQUESTS_NOT_VISIBLE: Object.freeze({
    check: 'C-95.9', where: at("projectRequests", "is-join-requests-project"),
    translation: said('PROJECT_REQUESTS_NOT_VISIBLE'),
  }),
});

/* T45 (R21, R22, R24; Actions D4, D27; v0.2 rules 15, 20): A PROJECT'S SCOPE AND ITS SECOND-APPROVAL SETTING. A new
 * family, C-147 (J1's reading; the census's highest was C-146). `PROJECT_SCOPE_OWN` is said at two sites, the guard and
 * the rescue; its row names the guard, where it is minted, and the rescue relays it. T46 (R25): each row's translation
 * is `refusal.<CODE>`, read by key through setup-words (`said`); codes, numbers and `where`s unmoved. */
export const PROJECT_SCOPE_CHECKS = Object.freeze({
  PROJECT_SCOPE_UNKNOWN: Object.freeze({
    check: 'C-147.1', where: at("projectScopeSet", "is-project-scope-set"),
    translation: said('PROJECT_SCOPE_UNKNOWN'),
  }),
  PROJECT_SCOPE_NEEDS_HIDDEN: Object.freeze({
    check: 'C-147.2', where: at("projectScopeSet", "is-project-scope-set"),
    translation: said('PROJECT_SCOPE_NEEDS_HIDDEN'),
  }),
  PROJECT_SCOPE_OWN_NOT_SOLE: Object.freeze({
    check: 'C-147.3', where: at("projectScopeSet", "is-project-scope-set"),
    translation: said('PROJECT_SCOPE_OWN_NOT_SOLE'),
  }),
  PROJECT_SCOPE_UNCHANGED: Object.freeze({
    check: 'C-147.4', where: at("projectScopeSet", "is-project-scope-set"),
    translation: said('PROJECT_SCOPE_UNCHANGED'),
  }),
  PROJECT_SCOPE_OWN: Object.freeze({
    check: 'C-147.5', where: at("#guard", "is-project-scope-guard"),
    translation: said('PROJECT_SCOPE_OWN'),
  }),
  PROJECT_SCOPE_KEEPS_HIDDEN: Object.freeze({
    check: 'C-147.6', where: at("#guard", "is-project-scope-guard"),
    translation: said('PROJECT_SCOPE_KEEPS_HIDDEN'),
  }),
  APPROVAL_RULE_INVALID: Object.freeze({
    check: 'C-147.7', where: at("projectApprovalSet", "is-project-approval-set"),
    translation: said('APPROVAL_RULE_INVALID'),
  }),
  APPROVAL_KIND_UNKNOWN: Object.freeze({
    check: 'C-147.8', where: at("projectApprovalSet", "is-project-approval-set"),
    translation: said('APPROVAL_KIND_UNKNOWN'),
  }),
  /* T50 (R31; N933; K3230): the stake per matter. The next free numbers after C-147.8 at this job's START. */
  MACHINE_CANNOT_SET_STAKE: Object.freeze({
    check: 'C-147.9', where: at("projectStakeSet", "is-project-stake-set"),
    translation: said('MACHINE_CANNOT_SET_STAKE'),
  }),
  STAKE_MALFORMED: Object.freeze({
    check: 'C-147.10', where: at("projectStakeSet", "is-project-stake-set"),
    translation: hasWord('refusal.STAKE_MALFORMED.project') ? word('refusal.STAKE_MALFORMED.project') : null,   /* DEC-303: a project's own sentence */
  }),
});
