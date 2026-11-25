/* translations' own refusal rows (requirements: `build/requirements/translations.md`, R13). DEC-49: every refusal this
 * module answers carries its code, its row and the member's translation, so a surface shows the same sentence wherever
 * the act is reached. Each row's `where` names its one site in this module, the function that holds its region and the
 * region inside it.
 *
 * Moved by copy from `instance-setup`'s `INSTANCE_SETUP_CHECKS` at the split (T50-22; N1084, K3674, K3696): C-64.11–.17,
 * .19–.26 and .31, and C-119.12 `LANGUAGE_MALFORMED` (which `instance-setup`'s R64 and R85 now build their refusals
 * from), each with its number and code unchanged. C-64.18 is dropped and never reused (R9): `NO_SUCH_MEMBER` is
 * `membership`'s alone (C-96.47, its R121). Each translation is the word `refusal.<CODE>` read by key through
 * setup-words' `word` (K3747), never a copy. */

import { word } from "../setup-words/index.mjs";

const at = (fn, region) => `src/translations/index.mjs ${fn} > ${region}`;
/* A row's `translation` is the word itself, never a copy. A placeholder the sentence names as an example (`{name}`, in
   TRANSLATION_TEXT_REFUSED's) is written back as itself, so the sentence reads as it always has. */
const row = (check, where, code, ...names) => Object.freeze({ check, where,
  translation: word(`refusal.${code}`, Object.fromEntries(names.map((n) => [n, `{${n}}`]))) });

/* R1–R10 (T37-30; N669; DEC-127 (2), (5), DEC-157, DEC-179; K2200, K2201, K2216; T48, N670): the group's translation of
   the interface. */
export const TRANSLATIONS_CHECKS = Object.freeze({
  TRANSLATION_DIRECTION_UNKNOWN: row("C-64.11", at("#draftRequest", "is-translation-draft"), "TRANSLATION_DIRECTION_UNKNOWN"),
  MACHINE_CANNOT_TRANSLATE: row("C-64.12", at("#translationActor", "is-translation-actor"), "MACHINE_CANNOT_TRANSLATE"),
  TRANSLATION_NOT_GRANTED: row("C-64.13", at("#translationSpeaker", "is-translation-speaker"), "TRANSLATION_NOT_GRANTED"),
  NO_SUCH_WORD: row("C-64.14", at("#translationWord", "is-translation-word"), "NO_SUCH_WORD"),
  TRANSLATION_NOT_MISSING: row("C-64.15", at("#draftRequest", "is-translation-draft"), "TRANSLATION_NOT_MISSING"),
  TRANSLATION_KEYS_MALFORMED: row("C-64.16", at("#draftRequest", "is-translation-draft"), "TRANSLATION_KEYS_MALFORMED"),
  TRANSLATION_NOTHING_TO_DRAFT: row("C-64.17", at("#draftRequest", "is-translation-draft"), "TRANSLATION_NOTHING_TO_DRAFT"),
  /* C-64.18 (`NO_SUCH_MEMBER`) is dropped and never reused (R9; N793, K231, K2275): the code is `membership`'s alone,
     answered through its `noSuchMember` (its R121, C-96.47). */
  NO_SUCH_DRAFT: row("C-64.19", at("translationAdopt", "is-translation-adopt"), "NO_SUCH_DRAFT"),
  TRANSLATION_TEXT_REFUSED: row("C-64.20", at("translationAdopt", "is-translation-adopt"), "TRANSLATION_TEXT_REFUSED", "name"),
  TRANSLATION_NOT_AWAITING: row("C-64.21", at("#translationAwaiting", "is-translation-awaiting"), "TRANSLATION_NOT_AWAITING"),
  TRANSLATION_CONFIRM_SELF: row("C-64.22", at("translationConfirm", "is-translation-confirm"), "TRANSLATION_CONFIRM_SELF"),
  TRANSLATION_NOT_READ_BACK: row("C-64.23", at("translationConfirm", "is-translation-confirm"), "TRANSLATION_NOT_READ_BACK"),
  TRANSLATION_NOTHING_TO_UNDO: row("C-64.24", at("translationRevert", "is-translation-revert"), "TRANSLATION_NOTHING_TO_UNDO"),
  TRANSLATION_NOT_SHOWN: row("C-64.25", at("translationMark", "is-translation-mark"), "TRANSLATION_NOT_SHOWN"),
  TRANSLATION_NOTE_REFUSED: row("C-64.26", at("translationMark", "is-translation-mark"), "TRANSLATION_NOTE_REFUSED"),
  /* R10 (T48; N670; DEC-127 (3)): the language a passage is read in, when the member has set none and names none. */
  LANGUAGE_NOT_SET: row("C-64.31", at("readingLanguage", "is-reading-language"), "LANGUAGE_NOT_SET"),
  /* R1, R3–R8, R10 (C-119.12): a language is a well-formed tag. `instance-setup`'s R64 and R85 raise it too, from this row. */
  LANGUAGE_MALFORMED: row("C-119.12", at("#translationLanguage", "is-translation-language"), "LANGUAGE_MALFORMED"),
});
