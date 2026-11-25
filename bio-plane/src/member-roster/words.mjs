/* member-roster's words (R70; N1116; K3366, K3368; DEC-257, DEC-258; `setup-words` R11–R13). This module holds no
   member-facing English: every sentence it answers is read through `setup-words`' `word(key, vars)` and what is held
   here is keys. A row's key is `refusal.<CODE>` unless `ROW_KEYS` names another; the other sentences are named below. A
   sentence an earlier requirement here quotes means the key whose English it is (R70). The strings
   `docs/development/ux-substrate/screens/words-reads.json` marks `unkeyed` (a refusal's `detail`, beside its code, which
   the shell never draws) stay in source. The three `membership.why.*` keys are `membership`'s. */
import { word } from "../setup-words/index.mjs";

/* The key's English with each named placeholder left in place, for a screen to fill (R50's `words`, a row's
   `translation` where the answer carries the value). */
export const keyed = (key, names = []) => word(key, Object.fromEntries(names.map((n) => [n, `{${n}}`])));

/* The rows whose key is not `refusal.<CODE>`, and the placeholders a row's English leaves for the screen. */
const ROW_KEYS = Object.freeze({ HANDLE_CHECK_PAUSED: "handle.refused.paused" });
const ROW_PLACEHOLDERS = Object.freeze({ CONSENSUS_REQUIRED: ["awaiting"], HANDLE_CHECK_PAUSED: ["minutes"] });

export const rowKey = (code) => ROW_KEYS[code] ?? `refusal.${code}`;

/* A refusal row's `translation`: its key's words. */
export const rowWord = (code) => keyed(rowKey(code), ROW_PLACEHOLDERS[code] ?? []);

/* Every key this module reads, other than the rows' own (`rowKey`): R50's three, the sentence R18's remedy, the
   hosting and door notices, R43's statement and the audit's finding. */
export const SENTENCE_KEYS = Object.freeze([
  "handle.free", "handle.taken", "handle.characters", "handle.refused.paused",
  "membership.handle_check_stated", "membership.door_warning", "membership.also_do", "court.statement",
  "membership.remedy.active_administrator_group_confirm",
  "membership.says.member_enrolled_under", "membership.says.member_holds_reserved",
]);
