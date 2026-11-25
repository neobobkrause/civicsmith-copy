/* ai-accounts' own refusal rows (requirements: `build/requirements/ai-accounts.md`). DEC-49: every refusal this module
 * answers carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act
 * is reached. Each row's `where` names its one site in this module.
 *
 * Moved by copy from `credentials/checks.mjs` at the split (T48-10; N996, K624, K3101; split map §2), R33: the C-29
 * rows of the AI accounts, each with its number, code and translation unchanged and its `where` re-pointed here, as one
 * family object, `AI_ACCOUNT_CHECKS`; and `AI_WORDS`, whose every key is the accounts'. credentials keeps C-29.1–.5,
 * .11, .23–.26, .28, .33, .41–.43, .46 and .47 (C-44's and C-136's precedent: one family across two files). */

import { word } from "../setup-words/index.mjs";

const at = (fn, region) => `src/ai-accounts/index.mjs ${fn} > ${region}`;

/* R10–R12, R14, R22, R23 (T41; DEC-188 (7); T50, N1116, K3366, DEC-259, DEC-260): the words of `words.json`
   (`docs/development/ux-substrate/screens/words.json`) this module's refusals and notices read, each read by key through
   setup-words' `word`, never held here; placeholders (`{Use}`, `{whose}`, `{who}`, `{project}`, `{for_uses}`, `{member}`,
   `{date}`, `{reason}`) are left for the screen by being written back as themselves, except that a project key's
   disclosure is answered with `{project}` filled (R12). A row's `translation` is the word itself, never a copy. */
const keep = (key, ...names) => word(key, Object.fromEntries(names.map((n) => [n, `{${n}}`])));

/** @type {Readonly<Object<string, string>>} R10–R12, R14, R22, R23: each key this module reads of words.json, and its words with the screen's placeholders kept */
export const AI_WORDS = Object.freeze({
  'ai.refused.off': keep('ai.refused.off', 'Use', 'whose', 'who'),
  'ai.refused.projectkeptaway': keep('ai.refused.projectkeptaway', 'for_uses', 'member', 'date', 'reason'),
  'ai.refused.notsole': keep('ai.refused.notsole', 'project'),
  'ai.disclosure.projectkey': keep('ai.disclosure.projectkey', 'project'),
  'ai.refused.noticedue': keep('ai.refused.noticedue', 'project'),
  'ai.refused.switchvalue': word('ai.refused.switchvalue'),
  'ai.refused.signinnotconnected': word('ai.refused.signinnotconnected'),
  /* R23 (T47; N981, K231): DISCLOSURE_DUE's sentence, unchanged by its move from the door's C-69.6 */
  'refusal.DISCLOSURE_DUE': word('refusal.DISCLOSURE_DUE'),
});

/* T33-20 (K1502, K1449): each member's own Claude account reference (R1–R4); T34 (K1755): the group's API key (R5–R9).
   The account refusals R1 names are minted in one region, `#accountBar`, which every act on a reference consumes, and
   credentials' grant mint through R25's `accountActBar`. */
/** @type {Readonly<Object<string, Readonly<{check: string, where: string, translation: string}>>>} R33: this module's C-29 rows, keyed by code */
export const AI_ACCOUNT_CHECKS = Object.freeze({
  MACHINE_CANNOT_HOLD_ACCOUNT: Object.freeze({
    check: 'C-29.13', where: at("#accountBar", "is-account-own-act"),
    translation: word('refusal.MACHINE_CANNOT_HOLD_ACCOUNT'),
  }),
  NOT_YOUR_ACCOUNT: Object.freeze({
    check: 'C-29.14', where: at("#notYours", "is-account-theirs"),
    translation: word('refusal.NOT_YOUR_ACCOUNT'),
  }),
  ACCOUNT_MEMBER_NOT_ACTIVE: Object.freeze({
    check: 'C-29.15', where: at("#accountBar", "is-account-own-act"),
    translation: word('refusal.ACCOUNT_MEMBER_NOT_ACTIVE'),
  }),
  /* C-29.16 (ACCOUNT_LEVEL_MEMBER_ONLY) is retired with `credentials` R26 (K1755, K1756, T34): the group's API key is R5's own act;
     its id is not reused. */
  /* T38 (T38-5; N708's remainder, K2200): re-worded, the subscription token retired: a subscription is connected by
     signing in through Claude Code (R18). Awaiting promotion's stamp (T38-6). */
  UNKNOWN_ACCOUNT_KIND: Object.freeze({
    check: 'C-29.17', where: at("accountReferenceSet", "is-account-kind"),
    translation: word('refusal.UNKNOWN_ACCOUNT_KIND'),
  }),
  /* C-29.18 (ACCOUNT_KIND_NOT_OFFERED) is retired with K1537's hold (K1547, T33-20b); its id is not reused. */
  NO_SECRET: Object.freeze({
    check: 'C-29.19', where: at("#noSecret", "is-secret-given"),
    translation: word('refusal.NO_SECRET'),
  }),
  /* T34 (K1755, K1757): the words name the group's key, since a member with no account of their own is served by it
     while it is on (R7). T38 (T38-5; N785, K2200): re-worded, the subscription connected by signing in through Claude
     Code, never a token. Awaiting promotion's stamp (T38-6). */
  NO_ACCOUNT: Object.freeze({
    check: 'C-29.20', where: at("#noAccount", "is-account-held"),
    translation: word('refusal.NO_ACCOUNT'),
  }),
  UNKNOWN_SWITCH: Object.freeze({
    check: 'C-29.21', where: at("#switchName", "is-account-switch"),
    /* T40 (T40-3; R14): re-worded, an account now holds a switch for each kind of use. Awaiting promotion's stamp
       (T40-4). */
    /* (T41; T41-5, R14) re-worded: four kinds of use added. Awaiting promotion's stamp (T41-6). */
    translation: word('refusal.UNKNOWN_SWITCH'),
  }),
  ACCOUNT_SEAL_UNAVAILABLE: Object.freeze({
    check: 'C-29.22', where: at("#sealRefusal", "is-seal-bound"),
    translation: word('refusal.ACCOUNT_SEAL_UNAVAILABLE'),
  }),
  /* R18 (DEC-156; K1819, K1922): a connected subscription is held as a fact only; a call carrying anything but the
     member is refused, so no login, code or token is ever taken. T35's new row, awaiting promotion's stamp (T35-16). */
  SUBSCRIPTION_LOGIN_REFUSED: Object.freeze({
    check: 'C-29.29', where: at("subscriptionConnected", "is-subscription-fact"),
    translation: word('refusal.SUBSCRIPTION_LOGIN_REFUSED'),
  }),
  GROUP_KEY_NOTICE_DUE: Object.freeze({
    check: 'C-29.27', where: at("#noticeDue", "is-group-key-notice-seen"),
    translation: word('refusal.GROUP_KEY_NOTICE_DUE'),
  }),
  /* T36 (T36-7; DEC-172, K1957): keep-away's two refusals (R7, R20), the next free numbers of C-29 (C-29.30 is
     admission's). (T37-6; K231, N755, N765) C-29.31's `where` is `aiKeptAway`, the one site every gate on keep-away
     reads (R7); C-29.32 is re-coded `AI_KEEP_AWAY_NO_REASON`, a code of this module's own, its number unmoved, so
     progressions' `NO_REASON` (C-100.18) reads its own row again. Both await promotion's stamp (T37-7). */
  AI_KEPT_AWAY: Object.freeze({
    check: 'C-29.31', where: at("#keptAway", "is-kept-away"),
    translation: word('refusal.AI_KEPT_AWAY'),
  }),
  /* T40 (T40-3; N812, D34, D38, K2352, K2353, K2404): a project's account (R10), the switches' values (R14), the
     account used (R11), a project's material limit (R22) and its key's notice (R12), the next free numbers of C-29 at
     the job's START (C-29.34–.39). New rows, awaiting promotion's stamp (T40-4). (T41; DEC-188 (7)) Each reads its
     translation by key from `AI_WORDS` (`words.json`), never a copy: a row change for promotion's T41-6 stamp. */
  PROJECT_NOT_SOLE_MEMBER: Object.freeze({
    check: 'C-29.34', where: at("projectSigninSet", "is-project-sole-member"),
    translation: AI_WORDS['ai.refused.notsole'],
  }),
  SIGNIN_NOT_CONNECTED: Object.freeze({
    check: 'C-29.35', where: at("projectSigninSet", "is-signin-connected"),
    translation: AI_WORDS['ai.refused.signinnotconnected'],
  }),
  SWITCH_VALUE_INVALID: Object.freeze({
    check: 'C-29.36', where: at("#valueInvalid", "is-switch-value"),
    translation: AI_WORDS['ai.refused.switchvalue'],
  }),
  AI_USE_SWITCHED_OFF: Object.freeze({
    check: 'C-29.37', where: at("#switchedOff", "is-use-switched-on"),
    translation: AI_WORDS['ai.refused.off'],
  }),
  PROJECT_AI_KEPT_AWAY: Object.freeze({
    check: 'C-29.38', where: at("aiKeptAway", "is-project-kept-away"),
    translation: AI_WORDS['ai.refused.projectkeptaway'],
  }),
  PROJECT_KEY_NOTICE_DUE: Object.freeze({
    check: 'C-29.39', where: at("#projectNoticeDue", "is-project-key-notice-seen"),
    translation: AI_WORDS['ai.refused.noticedue'],
  }),
  /* T47 (T47-9; N981, K231, K3030): the disclosure-first order held here (R23), its one site `disclosureDue`, which R1
     refuses through and control-plane R65 relays (T47-65); the next free number of C-29 at the job's START. Its code and
     sentence are the door's C-69.6's, unchanged (that row retires at T47-65, its number never reused); its translation
     read by key. A new row, awaiting promotion's stamp (T47-10). */
  DISCLOSURE_DUE: Object.freeze({
    check: 'C-29.40', where: at("disclosureDue", "is-disclosure-shown"),
    translation: AI_WORDS['refusal.DISCLOSURE_DUE'],
  }),
  SIGNIN_NOT_HELD: Object.freeze({
    check: 'C-29.44', where: at("#signinNotHeld", "is-signin-held"),
    translation: word('refusal.SIGNIN_NOT_HELD'),
  }),
  SUBSCRIPTION_TOKEN_MALFORMED: Object.freeze({
    check: 'C-29.45', where: at("subscriptionTokenHold", "is-signin-token-shape"),
    translation: word('refusal.SUBSCRIPTION_TOKEN_MALFORMED'),
  }),
  /* T40 (T40-3): its `where` moves to `#keepAwayReason`, the one site R20 and R22 share (a row change for T40-4). */
  AI_KEEP_AWAY_NO_REASON: Object.freeze({
    check: 'C-29.32', where: at("#keepAwayReason", "is-keep-away-reason"),
    translation: word('refusal.AI_KEEP_AWAY_NO_REASON'),
  }),
});
