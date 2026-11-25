/* credentials' own refusal rows (requirements: `build/requirements/credentials.md`). DEC-49: every refusal this module
 * answers carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act
 * is reached. Each row's `where` names its one site in this module.
 *
 * Copied at the split (K617, K637; T19 layer 2, CREDENTIALS #1), ids and words unchanged, `where`s re-pointed here:
 *   - `SIGNER_ENROLMENT_CHECKS` (C-63) and `AI_CREDENTIAL_CHECKS` (C-29's mint and revocation rows) from the check
 *     catalogue (✱, family names kept; the catalogue's copies are deleted after membership's deletion, K636 BOB-2);
 *   - `CREDENTIALS_CHECKS`: C-96.8 `BAD_KEY` (from the catalogue's `CUSTODIAL_CHECKS`, minted only in `signerAdd`) and
 *     C-96.15–.17 (from `membership/checks.mjs`, R9's three rows). C-96.1 `NOT_AN_ADMIN` stays membership's: R6, R7 and
 *     R13 answer through `membership.notAnAdmin` (its R84). */

import { word, localize } from '../setup-words/index.mjs';

const at = (fn, region) => `src/credentials/index.mjs ${fn} > ${region}`;

/* R38 (F3; K1881, K1934 (2)): the sign-in window's bounds, BOB's under K1881. Refused attempts are estimated per source
   and per role over any 10 minutes by a two-bucket sliding window (capture R31's form); at `perSource` for the source,
   or `perRole` for the role, the next attempt is paused. `SIGN_IN_STATED` is the bound as the pause states it, composed
   from the same constants. Here, not in index.mjs, so the pause's words can read it without an import cycle. */
export const SIGN_IN_WINDOW = Object.freeze({ perSource: 10, perRole: 10, windowMs: 10 * 60 * 1000 });
export const SIGN_IN_STATED = word("credentials.refused_attempts_place", { per_source: String(SIGN_IN_WINDOW.perSource), per_role: String(SIGN_IN_WINDOW.perRole), window_ms: String(SIGN_IN_WINDOW.windowMs / 60000) });

/* (T49; N1075, K3269) The words of `words.json` (`docs/development/ux-substrate/screens/words.json`) this module's
   refusals carry, each `en` verbatim, read by key: the translation of each of the five rows that file keys is the word
   itself, never a copy. SIGN_IN_PAUSED's `{stated}` is filled here with the bound as R38 states it (`SIGN_IN_STATED`,
   DEC-436); no time is stated, since neither tells which count was full. */
export const CREDENTIALS_WORDS = Object.freeze({
  'refusal.SIGN_IN_PAUSED': word('refusal.SIGN_IN_PAUSED', { stated: SIGN_IN_STATED }),
  'refusal.NOT_SIGNED_IN': word('refusal.NOT_SIGNED_IN'),
  'refusal.RECOVERY_REFUSED': word('refusal.RECOVERY_REFUSED'),
  'refusal.CURRENT_PASSWORD_WRONG': word('refusal.CURRENT_PASSWORD_WRONG'),
  'refusal.AI_RUN_CREDENTIAL_MALFORMED': word('refusal.AI_RUN_CREDENTIAL_MALFORMED'),
});


/* D-158 / C-63: a signing key is registered to a member who can attest (Membership Architecture v2 §6). Two codes for
   two facts: a member with no handle has never enrolled; one who has a handle and is not `active` is not standing. Both
   are minted in one region, `#signerMemberBar`, which R6, R7's activation and R9 consume. */
export const SIGNER_ENROLMENT_CHECKS = Object.freeze({
  SIGNER_MEMBER_NOT_ENROLLED: Object.freeze({
    check: 'C-63.1', where: at("#signerMemberBar", "is-signer-member-attesting"),
    translation: word('refusal.SIGNER_MEMBER_NOT_ENROLLED'),
  }),
  SIGNER_MEMBER_NOT_ACTIVE: Object.freeze({
    check: 'C-63.2', where: at("#signerMemberBar", "is-signer-member-attesting"),
    translation: word('refusal.SIGNER_MEMBER_NOT_ACTIVE'),
  }),
});

/* C-29 — the `ai` credential (PL-11 / IS-5, D-199): the mint's and the revocation's rows (C-29.1–.5, C-29.11). The
   reach question, what a declared scope admits (C-29.6–.10), is the control plane's (`AI_SCOPE_CHECKS`). */
export const AI_CREDENTIAL_CHECKS = Object.freeze({
  /* D-199 (3): "If an agent can request a broader token, the scoping is theatre." */
  AI_CREDENTIAL_MINT_NOT_A_MEMBER: Object.freeze({
    check: 'C-29.1', where: at("aiCredentialMint", "is-ai-credential-mint"),
    translation: localize('credentials.checks.only_a_named_person_signed', 'Only a named person signed in to your team\'s Civicsmith can create an agent credential. Deciding what an automated worker is allowed to reach is a judgement somebody has to be accountable for, so an automated worker cannot make it — not even about itself.'),
  }),
  /* D-199 (4) / DEC-55 det 4: an act says which principal stands behind it. */
  AI_CREDENTIAL_PRINCIPAL_UNSTATED: Object.freeze({
    check: 'C-29.2', where: at("aiCredentialMint", "is-ai-credential-mint"),
    translation: localize('credentials.checks.an_agent_credential_has_to', 'An agent credential has to say who stands behind it: the organisation as a whole, or one named member. The two carry different accountability and they see different things, so the record will not hold one that says neither.'),
  }),
  /* The identity is what acts cite, so it is never rebound. */
  AI_CREDENTIAL_IDENTITY_TAKEN: Object.freeze({
    check: 'C-29.3', where: at("aiCredentialMint", "is-ai-credential-mint"),
    translation: word('refusal.AI_CREDENTIAL_IDENTITY_TAKEN'),
  }),
  /* The row carries `revoked_by`, and a machine name there would record a decision nobody in the group made. */
  AI_CREDENTIAL_REVOKE_NOT_A_MEMBER: Object.freeze({
    check: 'C-29.4', where: at("aiCredentialRevoke", "is-ai-credential-revoke"),
    translation: word('refusal.AI_CREDENTIAL_REVOKE_NOT_A_MEMBER'),
  }),
  AI_CREDENTIAL_UNKNOWN: Object.freeze({
    check: 'C-29.5', where: at("aiCredentialRevoke", "is-ai-credential-revoke"),
    translation: word('refusal.AI_CREDENTIAL_UNKNOWN'),
  }),
  /* R14: a member-scoped credential's principal is the member who mints it. */
  AI_CREDENTIAL_PRINCIPAL_NOT_THE_MINTER: Object.freeze({
    check: 'C-29.11', where: at("aiCredentialMint", "is-ai-credential-mint"),
    translation: localize('credentials.checks.a_credential_that_acts_for', 'A credential that acts for one member acts for the member who creates it, and nobody else. You named another member, and nobody can authorise an agent in someone else\'s name: it would see what they see and its work would be recorded as theirs. Nothing was created. The member it should act for can create it themselves.'),
  }),
  /* R42 (F15; K1881, K1934): an agent credential expires after a whole number of days, 1 to 365, 90 when not given.
     T35's new row, awaiting promotion's stamp (T35-16). */
  AI_CREDENTIAL_BAD_EXPIRY: Object.freeze({
    check: 'C-29.28', where: at("aiCredentialMint", "is-ai-credential-expiry"),
    translation: word('refusal.AI_CREDENTIAL_BAD_EXPIRY'),
  }),
  /* R53 (T37-6; N761, K2129): a mint that carries no digest of its secret, the next free number of C-29. A new row,
     awaiting promotion's stamp (T37-7). */
  AI_CREDENTIAL_NO_SECRET: Object.freeze({
    check: 'C-29.33', where: at("aiCredentialMint", "is-ai-credential-digest"),
    translation: word('refusal.AI_CREDENTIAL_NO_SECRET'),
  }),
  /* R63 (T47-9; N955, K2976): a run segment's credential asked for without its run, or with writes that are not the
     runner's, the next free number of C-29 after C-29.40 (this module's R64's then, `ai-accounts` R23's since T48). A
     new row, awaiting promotion's stamp (T47-10). */
  AI_RUN_CREDENTIAL_MALFORMED: Object.freeze({
    check: 'C-29.41', where: at("aiRunCredentialMint", "is-ai-run-credential-shape"),
    translation: CREDENTIALS_WORDS['refusal.AI_RUN_CREDENTIAL_MALFORMED'],
  }),
});

/* C-96's rows for the acts on a member's keys: R6's key shape (C-96.8) and R9's three (C-96.15–.17). */
export const CREDENTIALS_CHECKS = Object.freeze({
  BAD_KEY: Object.freeze({
    check: 'C-96.8', where: at("signerAdd", "is-signer-key-shape"),
    translation: word('refusal.BAD_KEY'),
  }),
  SIGNER_KEY_HELD_BY_ANOTHER: Object.freeze({
    check: 'C-96.15', where: at("signerRegisterOwn", "is-signer-key-held"),
    translation: word('refusal.SIGNER_KEY_HELD_BY_ANOTHER'),
  }),
  SIGNER_KEY_REVOKED: Object.freeze({
    check: 'C-96.16', where: at("signerRegisterOwn", "is-signer-key-revoked"),
    translation: word('refusal.SIGNER_KEY_REVOKED'),
  }),
  MACHINE_CANNOT_REGISTER_KEY: Object.freeze({
    check: 'C-96.17', where: at("#machineCannotRegister", "is-machine-register-key"),
    translation: word('refusal.MACHINE_CANNOT_REGISTER_KEY'),
  }),
  /* R83 (T51 fix round 10; K5303): "I know about this key" is said of a key a member registered for themselves and that is
     still active, the next free number of C-96. A new row, awaiting promotion's stamp. */
  SIGNER_NOT_SELF_ACTIVE: Object.freeze({
    check: 'C-96.55', where: at("signerKnown", "is-signer-self-active"),
    translation: localize('credentials.checks.only_a_key_a_member_registered', 'Only a key a member registered for themselves, and that is still in use, can be marked as one you know about. This key was registered by an administrator, or it has been withdrawn, so there is nothing to confirm. Nothing was changed.'),
  }),
});

/* C-29's rows held here: the ask grant's (R27, R28, R31, R32; T33-20, T34), the sessions' lock and re-ask (R65, R66)
   and the administrator's reset link (R69). (T48; N996, K3101) The AI accounts' rows of C-29 (C-29.13–.15, .17,
   .19–.22, .27, .29, .31, .32, .34–.40, .44, .45) moved with their code to `ai-accounts`' `AI_ACCOUNT_CHECKS`, numbers,
   codes and words unchanged, so the family spans both modules' files (C-44's and C-136's precedent); `index.mjs`
   answers the two together as `ACCOUNT_CHECKS` until its readers re-point (R72). */
export const ACCOUNT_CHECKS = Object.freeze({
  GRANT_OP_REFUSED: Object.freeze({
    check: 'C-29.23', where: at("aiGrantAdmit", "is-grant-op"),
    translation: word('refusal.GRANT_OP_REFUSED'),
  }),
  GRANT_NOT_HELD: Object.freeze({
    check: 'C-29.24', where: at("#grantNotHeld", "is-grant-held"),
    translation: word('refusal.GRANT_NOT_HELD'),
  }),
  /* T34 (T34-11; K1609, K1755, K1757): R32's two refusals. Stamped by promotion (T34-12). */
  STANDING_SWITCH_OFF: Object.freeze({
    check: 'C-29.25', where: at("aiGrantMintStanding", "is-standing-grant"),
    translation: word('refusal.STANDING_SWITCH_OFF'),
  }),
  NO_QUESTION: Object.freeze({
    check: 'C-29.26', where: at("aiGrantMintStanding", "is-standing-grant"),
    translation: word('refusal.NO_QUESTION'),
  }),
  /* T47 (T47-81; K3060 D4, K3061 D3, K3069): the sessions' lock and re-ask (R65, R66) and the administrator's reset
     link (R69), of the next free numbers of C-29 at that job's START (C-29.42–.47; .44 and .45, the held sign-in's,
     moved to `ai-accounts`, T48). New rows, joining the row census red until T48's stamp. */
  REAUTH_DUE: Object.freeze({
    check: 'C-29.42', where: at("reauthDue", "is-reauth-window"),
    translation: word('refusal.REAUTH_DUE'),
  }),
  SESSION_LOCKED: Object.freeze({
    check: 'C-29.43', where: at("sessionLockedRefusal", "is-session-unlocked"),
    translation: word('refusal.SESSION_LOCKED'),
  }),
  RESET_LINK_DEAD: Object.freeze({
    check: 'C-29.46', where: at("#resetLinkDead", "is-reset-link-live"),
    translation: word('refusal.RESET_LINK_DEAD'),
  }),
  RESET_LINK_MEMBER_NOT_ACTIVE: Object.freeze({
    check: 'C-29.47', where: at("passwordResetLinkMake", "is-reset-link-member"),
    translation: word('refusal.RESET_LINK_MEMBER_NOT_ACTIVE'),
  }),
});


/* R29 (K1449): the group's keys for keyed outside services. */
export const KEYED_SERVICE_CHECKS = Object.freeze({
  UNKNOWN_KEYED_SERVICE: Object.freeze({
    check: 'C-96.19', where: at("#keyedService", "is-keyed-service"),
    translation: word('refusal.UNKNOWN_KEYED_SERVICE'),
  }),
  KEYED_SERVICE_NO_KEY: Object.freeze({
    check: 'C-96.20', where: at("keyedServiceSet", "is-keyed-service-key"),
    translation: word('refusal.KEYED_SERVICE_NO_KEY'),
  }),
  KEYED_SERVICE_OFF: Object.freeze({
    check: 'C-96.21', where: at("keyedServiceFor", "is-keyed-service-on"),
    translation: word('refusal.KEYED_SERVICE_OFF'),
  }),
});

/* T35 (T35-15; F3, F14, N703, K1888; K1881, K1934): the sign-in window (R38), sign-out (R39), recovery (R47) and the
   security tally and map (R44, R45). New rows, the next free numbers of C-96, awaiting promotion's stamp (T35-16). */
export const SIGN_IN_CHECKS = Object.freeze({
  SIGN_IN_PAUSED: Object.freeze({
    check: 'C-96.39', where: at("#paused", "is-sign-in-window"),
    translation: CREDENTIALS_WORDS['refusal.SIGN_IN_PAUSED'],
  }),
  NOT_SIGNED_IN: Object.freeze({
    check: 'C-96.40', where: at("#notSignedIn", "is-session-live"),
    translation: CREDENTIALS_WORDS['refusal.NOT_SIGNED_IN'],
  }),
  RECOVERY_REFUSED: Object.freeze({
    check: 'C-96.41', where: at("#recoveryRefused", "is-recovery-code"),
    translation: CREDENTIALS_WORDS['refusal.RECOVERY_REFUSED'],
  }),
  SECURITY_KIND_UNKNOWN: Object.freeze({
    check: 'C-96.42', where: at("securityCount", "is-security-kind"),
    translation: word('refusal.SECURITY_KIND_UNKNOWN'),
  }),
  SECURITY_PERIOD_INVALID: Object.freeze({
    check: 'C-96.43', where: at("#periodRefusal", "is-security-period"),
    translation: word('refusal.SECURITY_PERIOD_INVALID'),
  }),
  /* T36 (T36-7; K1946 T3): R49's read when the counts cannot be read, the next free number of C-96. A new row, awaiting
     promotion's stamp (T36-8). */
  SECURITY_COUNTS_UNREADABLE: Object.freeze({
    check: 'C-96.44', where: at("securityTotals", "is-security-counts-read"),
    translation: word('refusal.SECURITY_COUNTS_UNREADABLE'),
  }),
  /* T37 (T37-6; N776, DEC-182 (4)): R3's own password change, the next free numbers of C-96. New rows, awaiting
     promotion's stamp (T37-7). */
  MACHINE_CANNOT_SET_PASSWORD: Object.freeze({
    check: 'C-96.45', where: at("passwordChange", "is-password-change-own"),
    translation: word('refusal.MACHINE_CANNOT_SET_PASSWORD'),
  }),
  CURRENT_PASSWORD_WRONG: Object.freeze({
    check: 'C-96.46', where: at("passwordChange", "is-current-password"),
    translation: CREDENTIALS_WORDS['refusal.CURRENT_PASSWORD_WRONG'],
  }),
  /* T47 (T47-81; R68, K3060 D4): recovery codes issued to anyone but an active member, the next free number of C-96.
     A new row, joining the row census red until T48's stamp. */
  RECOVERY_CODES_NOT_A_MEMBER: Object.freeze({
    check: 'C-96.53', where: at("recoveryCodesIssue", "is-recovery-codes-member"),
    translation: word('refusal.RECOVERY_CODES_NOT_A_MEMBER'),
  }),
});
