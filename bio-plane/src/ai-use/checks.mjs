/* ai-use's own refusal rows (R8; DEC-49, K6, K231): every code this module mints carries its row here, its member-facing
 * sentence read by key from the design stream's `words.json` (R13; DEC-188 (7)), never a copy written here. Family C-143 (K2480),
 * a new family for this new module (K2373 B11: each code the next free number of its module's family at the job's
 * START), awaiting promotion's stamp (T41). `AI_LIMIT_REACHED` replaces `run-rules`' retired C-109.8 and C-109.9
 * (`AI_USE_CEILING_REACHED`, `AI_USE_COPY_CEILING_REACHED`) and `AI_LIMIT_INVALID` its C-109.12 (`AI_CEILING_INVALID`),
 * their numbers never reused (run-rules R20). `AI_RUN_CONSUME_INVALID` (C-22.13) and `NOT_YOUR_CEILING` (C-109.11) are
 * run-rules' rows, read there by key. Each row's `where` names its one site in `index.mjs`. Tested in
 * `test/m/ai-use/`. */

import { word, localize } from '../setup-words/index.mjs';

const at = (fn, region) => `src/ai-use/index.mjs ${fn} > ${region}`;

/* R13 (DEC-188 (7); T43, N856, N862: DEC-189, DEC-190; T44, N859, N869, N876: DEC-191, DEC-192): the words of
   `words.json` (`docs/development/ux-substrate/screens/words.json`) this module's refusals and its Ask item read, each `en`
   verbatim, by key, a test failing on any difference. A refusal reaches its member through every caller as it is
   answered (ai-runs' open and tick, answers' ask and standing relay it unchanged), so each refusal's sentence is answered
   whole, every placeholder filled by key and none by this module (K2514; DEC-189 (1)): `{whose}` from `ai.whose.*`,
   `{use}` inside a sentence from `ai.use.<use>.inline` and `{Use}` at a sentence's start from `ai.use.<use>.name`, for
   all nine uses (DEC-191 (2)), `{period}` from `ai.period.*`, `{when}` from `ai.when.*` with `{month}` from
   `date.month.*` (`ai.until.*` is the queue item's, notice-producers'), `{field}` from `ai.limitfield.*`; R3's unjudged
   refusal reads `ai.refused.limit.unjudged`. Only the Ask item, a queue item `notice-producers` renders, leaves `{scope}`
   and `{account}` for the screen. `ai.use.suggestions` names a switch, not a use, and is not read here. */
export const AI_USE_WORDS = Object.freeze({
  'ai.use.ask.name': word('ai.use.ask.name'),
  'ai.use.draft.name': word('ai.use.draft.name'),
  'ai.use.run.name': word('ai.use.run.name'),
  'ai.use.standing.name': word('ai.use.standing.name'),
  'ai.use.explore.name': word('ai.use.explore.name'),
  'ai.use.enquire.name': word('ai.use.enquire.name'),
  'ai.use.read.name': word('ai.use.read.name'),
  'ai.use.transcribe.name': word('ai.use.transcribe.name'),
  'ai.use.account.name': word('ai.use.account.name'),
  'ai.use.ask.inline': word('ai.use.ask.inline'),
  'ai.use.draft.inline': word('ai.use.draft.inline'),
  'ai.use.run.inline': word('ai.use.run.inline'),
  'ai.use.standing.inline': word('ai.use.standing.inline'),
  'ai.use.explore.inline': word('ai.use.explore.inline'),
  'ai.use.enquire.inline': word('ai.use.enquire.inline'),
  'ai.use.read.inline': word('ai.use.read.inline'),
  'ai.use.transcribe.inline': word('ai.use.transcribe.inline'),
  'ai.use.account.inline': word('ai.use.account.inline'),
  'ai.whose.group': word('ai.whose.group'),
  'ai.whose.project': word('ai.whose.project'),
  'ai.whose.own': word('ai.whose.own'),
  'ai.period.day': word('ai.period.day'),
  'ai.period.month': word('ai.period.month'),
  'ai.when.day': word('ai.when.day'),
  'ai.when.month': word('ai.when.month', { month: '{month}' }),
  'date.month.january': 'January',
  'date.month.february': 'February',
  'date.month.march': 'March',
  'date.month.april': 'April',
  'date.month.may': 'May',
  'date.month.june': 'June',
  'date.month.july': 'July',
  'date.month.august': 'August',
  'date.month.september': 'September',
  'date.month.october': 'October',
  'date.month.november': 'November',
  'date.month.december': 'December',
  'ai.refused.limit': word('ai.refused.limit', { whose: '{whose}', period: '{period}', use: '{use}', when: '{when}' }),
  'ai.refused.limit.overall': word('ai.refused.limit.overall', { whose: '{whose}', period: '{period}', when: '{when}' }),
  'ai.refused.limit.member': word('ai.refused.limit.member', { period: '{period}', whose: '{whose}', when: '{when}' }),
  'ai.refused.limit.unjudged': word('ai.refused.limit.unjudged', { whose: '{whose}' }),
  'ai.refused.limitinvalid': word('ai.refused.limitinvalid', { field: '{field}' }),
  'ai.limitfield.owner': word('ai.limitfield.owner'),
  'ai.limitfield.scope': word('ai.limitfield.scope'),
  'ai.limitfield.unit': word('ai.limitfield.unit'),
  'ai.limitfield.period': word('ai.limitfield.period'),
  'ai.limitfield.amount': word('ai.limitfield.amount'),
  'ai.limitfield.inclusive': word('ai.limitfield.inclusive'),
  'ai.limitfield.use': word('ai.limitfield.use'),
  'ai.limitfield.count': word('ai.limitfield.count'),
  'ai.refused.unitunavailable': word('ai.refused.unitunavailable'),
  'ai.refused.explorenotenabled': word('ai.refused.explorenotenabled', { whose: '{whose}' }),
  'ai.refused.exploreoutofscope': word('ai.refused.exploreoutofscope', { whose: '{whose}' }),
  'ai.refused.exploreaskinvalid': word('ai.refused.exploreaskinvalid'),
  'ai.queue.exploreask': word('ai.queue.exploreask', { scope: '{scope}', what: '{what}', account: '{account}' }),
});

/* R13 (T53): the sentences T53 adds, each written once at its use (K3943) and extracted into the word table by the
   build step, where the design stream reviews it (`words-unreviewed.json`); the table wins once it holds the key. */
export const AI_USE_NEW_WORDS = Object.freeze({
  'ai.refused.thresholdinvalid': localize('ai.refused.thresholdinvalid', "That alert can't be set: {field}. An alert is a percent of a limit you have set, or an amount in dollars, tokens or calls.", { field: '{field}' }),
  'ai.refused.notapayingaccount': localize('ai.refused.notapayingaccount', "A member's own AI account is theirs alone: its use is shown only to them."),
  'ai.alert.threshold': localize('ai.alert.threshold', "{whose} account has used {level} of its {period} amount for {use}.", { whose: '{whose}', level: '{level}', period: '{period}', use: '{use}' }),
  'ai.use.notmeasurable': localize('ai.use.notmeasurable', "Not measurable in money: this plan reports no cost and your team's Civicsmith has no price for it. Tokens and calls are shown instead."),
});

/* R13: the key each refusal and each fill reads. `AI_LIMIT_REACHED` by its scope (a use's own: `ai.refused.limit`), or
   `ai.refused.limit.unjudged` when R3 cannot judge it; `{whose}` by the account's kind; `{period}`, `{when}` by the
   limit's period; `{month}` by the next period's month (0 for January); `{field}` by the field R2 refuses. */
export const LIMIT_WORD_BY_SCOPE = Object.freeze({ overall: 'ai.refused.limit.overall', per_member: 'ai.refused.limit.member' });
export const UNJUDGED_WORD = 'ai.refused.limit.unjudged';
export const WHOSE_WORD = Object.freeze({ group: 'ai.whose.group', project: 'ai.whose.project', own: 'ai.whose.own' });
export const PERIOD_WORD = Object.freeze({ day: 'ai.period.day', month: 'ai.period.month' });
export const WHEN_WORD = Object.freeze({ day: 'ai.when.day', month: 'ai.when.month' });
export const MONTH_WORD = Object.freeze(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december'].map((m) => `date.month.${m}`));
export const LIMIT_FIELD_WORD = Object.freeze(Object.fromEntries(['owner', 'scope', 'unit', 'period', 'amount', 'inclusive',
  'use', 'count'].map((f) => [f, `ai.limitfield.${f}`])));
export const useInlineWord = (use) => `ai.use.${use}.inline`;
export const useNameWord = (use) => `ai.use.${use}.name`;

/* R13: one sentence filled by key: each `{name}` of `fills` replaced by its value, as given, never read as a replacement
   pattern (a `$` in a member's own words, the Ask item's `{what}`, stays as written). A placeholder not in `fills` is
   left for the screen. */
export function fillWords(sentence, fills) {
  return Object.entries(fills).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), sentence);
}

export const AI_USE_CHECKS = Object.freeze({
  /* R3 (D38 C, D39; B3, B5, B7): a limit of the paying account is reached for the current period: its own use's, its
     overall one (over the uses that are not exclusive), or its per-member one. Carries `whose` (`group`, `project` or
     `own`), `scope` and `period`, and names no cost (K1450). (T43; DEC-189 (5)) When the limit cannot be judged, it
     carries `unjudged: true` and no `scope`, `unit` or `period`. The row's sentence is the use-scope one; the answer
     reads the one for its scope, or the unjudged one (R13). */
  AI_LIMIT_REACHED: {
    check: 'C-143.1',
    where: at('#limitReached', 'is-ai-limit-reached'),
    translation: AI_USE_WORDS['ai.refused.limit'],
  },
  /* R2: a limit as set is not one: the owner, scope, unit, period, amount or inclusive flag is outside R2's, named. */
  AI_LIMIT_INVALID: {
    check: 'C-143.2',
    where: at('#invalid', 'is-ai-limit-invalid'),
    translation: AI_USE_WORDS['ai.refused.limitinvalid'],
  },
  /* R2 (B4; fact 3): a dollar limit on an account served by a sign-in, which reports no cost. */
  LIMIT_UNIT_UNAVAILABLE: {
    check: 'C-143.3',
    where: at('aiLimitSet', 'is-limit-unit-unavailable'),
    translation: AI_USE_WORDS['ai.refused.unitunavailable'],
  },
  /* R3, R6, R9 (A5, B6; K2350, K2400): exploring is `no` on the account that would pay for it. */
  EXPLORE_NOT_ENABLED: {
    check: 'C-143.4',
    where: at('#exploreOff', 'is-explore-not-enabled'),
    translation: AI_USE_WORDS['ai.refused.explorenotenabled'],
  },
  /* R6 (B6): the question lies outside what the owner may explore: the group's, a question of the record; a
     project's, a question it draws on (`connections.citesInto`); a member's, none yet (D36 open). Named by this job's
     J1 (5), K2480. (T44; N859, N869; DEC-191 (1)) Carries `whose` (`group`, `project` or `own`), as `AI_LIMIT_REACHED`
     does; its sentence is `ai.refused.exploreoutofscope`, the answer's `{whose}` filled from `ai.whose.*` (R13). */
  EXPLORE_OUT_OF_SCOPE: {
    check: 'C-143.5',
    where: at('#outOfScope', 'is-explore-out-of-scope'),
    translation: AI_USE_WORDS['ai.refused.exploreoutofscope'],
  },
  /* R9: an exploring ask or approval that names no day or no thing worth exploring. Named by this job's J2, K2486.
     (T44; N859, N869; DEC-191 (1)) Its sentence is `ai.refused.exploreaskinvalid`. */
  EXPLORE_ASK_INVALID: {
    check: 'C-143.6',
    where: at('#askFault', 'is-explore-ask-invalid'),
    translation: AI_USE_WORDS['ai.refused.exploreaskinvalid'],
  },
  /* R23 (T53; BR24): an alert threshold as set is not one: its kind, its level, or a percent with no matching limit, named.
     The next free number of C-143 at this job's START, awaiting promotion's stamp. */
  AI_THRESHOLD_INVALID: {
    check: 'C-143.7',
    where: at('#thresholdInvalid', 'is-ai-threshold-invalid'),
    translation: AI_USE_NEW_WORDS['ai.refused.thresholdinvalid'],
    word: 'ai.refused.thresholdinvalid',
  },
  /* R27 (T53; K5459): the use by member is asked of a member's own account, which is never a paying account read by
     member. C-143.8, awaiting promotion's stamp. */
  NOT_A_PAYING_ACCOUNT: {
    check: 'C-143.8',
    where: at('accountUseByMember', 'is-not-a-paying-account'),
    translation: AI_USE_NEW_WORDS['ai.refused.notapayingaccount'],
    word: 'ai.refused.notapayingaccount',
  },
});
