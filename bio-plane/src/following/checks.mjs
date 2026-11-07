/* following — its refusal rows (requirements: `build/requirements/following.md`; DEC-49; N620, K1836). Every refusal this
 * module answers carries its code, its row and the member's translation (R1's "one with a catalogue row carries its
 * `check`, `code` and `translation`"). A family of its own, C-137 (K1836), so control-plane's composed catalogue never
 * decorates one of these refusals with another module's row: the per-meeting link's `NO_SUCH_ADDRESS`, which monitoring's
 * C-18.12 holds for a different act, is re-keyed `NO_SUCH_MEETING_ADDRESS` (K1836), and the two codes answers' and
 * money-checks' families already held are re-keyed `BAD_FOLLOW_CADENCE` and `NOT_THE_FOLLOWER`, so no code is held in two
 * families. Each translation says what the code already said, no new meaning. New rows: each stays `awaiting stamp`
 * until T35's promotion job (plan T34 Rules (5) 4). The listener refusals of R19 are membership's
 * (`listenerRefusal`), answered through it, never minted here. No translation names a place (R18), and none names the
 * group's own system other than as "your group's Civicsmith" (DEC-149); none needs to. */

import { word, localize } from "../setup-words/index.mjs";

const at = (fn, region) => `src/following/index.mjs ${fn} > ${region}`;
const row = (code, n, fn, region) => Object.freeze({ check: `C-137.${n}`, where: at(fn, region), translation: word(`refusal.${code}`) });

export const FOLLOWING_CHECKS = Object.freeze({
  MACHINE_CANNOT_FOLLOW: row("MACHINE_CANNOT_FOLLOW", 1, "#actorRefusal", "is-follow-member"),
  NO_SUCH_HOME: row("NO_SUCH_HOME", 2, "#actorRefusal", "is-follow-home"),
  NO_SUCH_BODY: row("NO_SUCH_BODY", 3, "followBody", "is-follow-body"),
  NO_LEGISTAR_ID: row("NO_LEGISTAR_ID", 4, "followBody", "is-follow-legistar"),
  BAD_PERIOD: row("BAD_PERIOD", 5, "followBody", "is-follow-period"),
  BAD_FOLLOW_CADENCE: row("BAD_FOLLOW_CADENCE", 6, "#cadence", "is-follow-cadence"),
  NO_SUCH_FOLLOW: row("NO_SUCH_FOLLOW", 7, "#follow", "is-follow-held"),
  NOT_THE_AUTHOR: row("NOT_THE_AUTHOR", 8, "unfollow", "is-follow-author"),
  NO_LOCATOR: row("NO_LOCATOR", 9, "followRegister", "is-follow-locator"),
  BAD_RENDER: row("BAD_RENDER", 10, "followRegister", "is-follow-render"),
  BAD_GATE: row("BAD_GATE", 11, "#gated", "is-follow-gate"),
  PERSON_QUERY_NOT_NAMED: row("PERSON_QUERY_NOT_NAMED", 12, "followPersonQuery", "is-person-query-named"),
  NO_KEY: row("NO_KEY", 13, "followPortal", "is-portal-key"),
  NO_SUCH_MEETING_ADDRESS: row("NO_SUCH_MEETING_ADDRESS", 14, "perMeetingBody", "is-meeting-address"),
  NO_SUCH_SNAPSHOT: row("NO_SUCH_SNAPSHOT", 15, "snapshotDiff", "is-snapshot-held"),
  NOT_GATED: row("NOT_GATED", 16, "refreshRegister", "is-refresh-gated"),
  NOT_THE_FOLLOWER: row("NOT_THE_FOLLOWER", 17, "refreshRegister", "is-refresh-follower"),
  PRICE_FIRST: row("PRICE_FIRST", 18, "refreshRegister", "is-refresh-price"),
  NO_CREDENTIAL: row("NO_CREDENTIAL", 19, "refreshRegister", "is-refresh-credential"),
  NOT_READ: row("NOT_READ", 20, "refreshRegister", "is-refresh-read"),
  WATCH_ENDED: row("WATCH_ENDED", 21, "watchLink", "is-watch-live"),
  MACHINE_CANNOT_LINK_WATCH: row("MACHINE_CANNOT_LINK_WATCH", 22, "watchLink", "is-link-member"),
  NO_SUCH_WATCH: row("NO_SUCH_WATCH", 23, "watchLink", "is-watch-seen"),
  WATCH_NOT_ASKED: row("WATCH_NOT_ASKED", 24, "watchAnswer", "is-answer-asked"),
  WATCH_RELIED_ON: row("WATCH_RELIED_ON", 25, "watchAnswer", "is-answer-relied"),
  BAD_PROCEEDING_DATES: row("BAD_PROCEEDING_DATES", 26, "proceedingDates", "is-proceeding-dates"),
  /* T50 (R32, R33; N1092): watch marks and second-look flags. `MACHINE_CANNOT_MARK` is sources' C-121.7 and is answered
     bare (no row minted here), so no code is held in two families. */
  MARK_NO_ITEM: row("MARK_NO_ITEM", 27, "#markRefusal", "is-mark-item-named"),
  MARK_NO_SUCH_ITEM: row("MARK_NO_SUCH_ITEM", 28, "#markRefusal", "is-mark-item-seen"),
  SECOND_LOOK_NO_NOTE: row("SECOND_LOOK_NO_NOTE", 29, "secondLook", "is-second-look-note"),
  SECOND_LOOK_NOT_OPEN: row("SECOND_LOOK_NOT_OPEN", 30, "secondLookClear", "is-second-look-open"),
  /* T53 (R37, R41): a register watch by a number; its sentences are written here at their use (K3943) */
  QUERY_NOT_NAMED: Object.freeze({ check: "C-137.31", where: at("followRegisterQuery", "is-query-named"),
    translation: localize("refusal.QUERY_NOT_NAMED", "A register is watched only for one number you name, of the form its scheme gives, in a scheme the active profiles list for that register; a name, a part of a number, a pattern, a list or two registers are not watched. Nothing was written.") }),
  BAD_ALERT: Object.freeze({ check: "C-137.32", where: at("followRegisterQuery", "is-alert-docket"),
    translation: localize("refusal.BAD_ALERT", "Only a followed docket number at the national docket service can carry its daily check of new filings, and \"courtlistener\" is the one check offered. Nothing was written.") }),
});

/** A refusal answer naming one of this module's rows (DEC-49): `{ok: false, reason, code, check, translation, detail,
 *  ...extra}`. */
export function followRefusal(code, detail, extra = {}) {
  const r = FOLLOWING_CHECKS[code];
  return { ok: false, reason: code, code, check: r ? r.check : null, translation: r ? r.translation : null, detail, ...extra };
}
