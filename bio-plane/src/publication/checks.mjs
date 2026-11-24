/* publication's invariants and refusal rows (requirements: `build/requirements/publication.md`, R33). DEC-49: every
 * refusal this module answers carries its code, its catalogue row and the member's translation.
 *
 * C-122.1 (R51, N364) is a family of its own here: a case's sources; C-122.2 (R58, DEC-112) and C-122.3, C-122.4 (R59,
 * N522) join it at T28, C-122.5 (a waiting edition no publisher could check; N687) at T35, moved with its raiser to
 * `publish-schedule` (its R9; T41, K2438), number and translation unchanged, so no row id is held twice, and
 * C-122.6 (R57's photo marks changed since preparation; N757, K2206) at T37, its translation `words.json`'s
 * `photo.refused.changed` since T38 (DEC-183 (4)) and `photo.refused.changed.signed` since T41 (DEC-187 (4): answered at
 * the commit, always after signing), and C-122.7 (R57's member document copy changed since preparation; N806, K2333) at
 * T39, its translation `words.json`'s `document.refused.changed` since T41 (DEC-188 (7)), both read by key.
 * C-122.8 (R78's counsel matter never published; N892, T45) is the one row for its code: `case-authoring` (its R72) and
 * `docket` (its R28) answer it through this module's export, holding no copy.
 * C-92.1–.9 and C-92.13 (the attribution act) moved with the act to `case-tensions` (its R9; T33-62, T33-63), numbers
 * and translations unchanged, and left this table, so no row id is held twice.
 *
 * C-44.2, C-68.5 and C-98.1–.9, raised by `public-read`'s code since K651, are `public-read`'s (its R17), moved there
 * with their numbers, wheres and translations unchanged and deleted here (T19), so no row id is held twice.
 *
 * The case document's grammar (`CASE_DOCUMENT_FORMAT` … and its four predicates) is `case-grammar`'s since K651 (its
 * R1, which was this module's R20), re-exported here unchanged so every importer of this file reads what it read. */

import { word, WORD_ROWS } from "../setup-words/index.mjs";

export { WORDS, caseWordsOf, lensClosingSentencesOf } from "../case-grammar/index.mjs";
export { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3,
         CASE_DOCUMENT_FORMAT_V2,
         CASE_DOCUMENT_FORMAT_LEGACY, CASE_DOCUMENT_FORMATS_ACCEPTED, caseDocumentStatesMemberBlocks,
         caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures,
         caseDocumentRequiresTensionSection } from "../case-grammar/index.mjs";

/* A key's English with its placeholders left as written: `word` fills each `{name}` with `{name}` itself. */
function wordAsWritten(key) {
  const en = WORD_ROWS.find((r) => r[0] === key)[1];
  return word(key, Object.fromEntries([...en.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(([, name]) => [name, `{${name}}`])));
}

/* R33 (DEC-187 (4), DEC-188 (7); K2483): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`)
   this module's rows answer, each read by key from `setup-words`' list (protected); `{photo}` is left for the screen,
   the answer naming the photos. */
export const PUBLICATION_WORDS = Object.freeze(Object.fromEntries(
  ["photo.refused.changed.signed", "document.refused.changed"].map((key) => [key, wordAsWritten(key)])));

/* C-122 — A CASE'S SOURCES (R51; N364, DEC-78 item 5(d)), a new family held here: the one refusal of the commit that
   re-reads, at the signature, what the public may be told of each source the case document states. A consent withdrawn
   binds only later publications, and a commit is one: what the document states is re-read at it, and a statement no
   longer publishable stops the commit with nothing written. The remedy is a new preparation, which leaves it out. */
export const CASE_SOURCES_CHECKS = {
  SOURCE_CONSENT_WITHDRAWN: {
    check: 'C-122.1',
    where: 'src/publication/index.mjs commitCaseEdition > is-source-consent-withdrawn',
    translation: word('refusal.SOURCE_CONSENT_WITHDRAWN'),
  },
  /* C-122.2 (R58; DEC-112, K1268 BOB's decision 5): a preparation made before published cases carried their method and
     materials (any format but `bio-case-document/6` or `/7`, which is `/6` in every field: N538, K1365 (1)) is never
     committed; the remedy is a new preparation. */
  CASE_FORMAT_SUPERSEDED: {
    check: 'C-122.2',
    where: 'src/publication/index.mjs commitCaseEdition > is-case-format-current',
    translation: word('refusal.CASE_FORMAT_SUPERSEDED'),
  },
  /* C-122.3, C-122.4 (R59; DEC-96 items 1, 4, N522): another group's work the case rests on is re-read at the commit,
     as R51 re-reads a source's consent. */
  ACCEPTANCE_WITHDRAWN_SINCE: {
    check: 'C-122.3',
    where: 'src/publication/index.mjs commitCaseEdition > is-accepted-work-standing',
    translation: word('refusal.ACCEPTANCE_WITHDRAWN_SINCE'),
  },
  FLAG_OPENED_SINCE: {
    check: 'C-122.4',
    where: 'src/publication/index.mjs commitCaseEdition > is-accepted-work-standing',
    translation: word('refusal.FLAG_OPENED_SINCE'),
  },
  /* C-122.6 (R33, R57; N757, DEC-180 (4), K2206): a photo the case carries no longer matches its marks (its copy no
     longer the photo's current copy, a mark withdrawn since the case was prepared among them (case-carriage R14), a
     photo carried whole, or marks that cannot be read), read through case-carriage (its R13) at the commit; the remedy
     is a new preparation. (T41; DEC-187 (4)) Answered at the commit, always after signing, so its translation is
     `words.json`'s `photo.refused.changed.signed`, read by key; `photo.refused.changed` stays the screens' for the
     moment before signing. */
  PHOTO_MARKS_CHANGED_SINCE: {
    check: 'C-122.6',
    where: 'src/publication/index.mjs commitCaseEdition > is-photo-marks-current',
    translation: PUBLICATION_WORDS['photo.refused.changed.signed'],
  },
  /* C-122.7 (R33, R57; N806, K2333): a document a member supplied that the case carries is not carried as its current
     publication copy (a copy no longer the document's current copy, a document carried whole that needs a copy, or one
     whose state cannot be read), read through case-carriage's `document` rows (its R13) at the commit; the remedy is a
     new preparation. (T41; DEC-188 (7); K2483) Its translation is `words.json`'s `document.refused.changed`, read by
     key. */
  DOCUMENT_COPY_CHANGED_SINCE: {
    check: 'C-122.7',
    where: 'src/publication/index.mjs commitCaseEdition > is-document-copy-current',
    translation: PUBLICATION_WORDS['document.refused.changed'],
  },
  /* C-122.8 (R78; T45, N892; Actions D4; v0.2 rule 15): nothing of a counsel matter enters a case or an edition. The
     commit refuses it before its other refusals; `case-authoring` (its R72) and `docket` (its R28) answer this same row
     through this module's export (`rowOf`, `publicationRowOf` from `index.mjs`), holding no copy. Its translation BOB's
     draft, re-wordable by the UX stream. */
  COUNSEL_MATTER_NOT_PUBLISHED: {
    check: 'C-122.8',
    where: 'src/publication/index.mjs commitCaseEdition > is-counsel-matter-published',
    translation: word('refusal.COUNSEL_MATTER_NOT_PUBLISHED'),
  },
};

/** A refusal from one of this module's rows: `reason` and `code` one literal, with its check and translation. The
 *  code is a string literal at every call site (DEC-49); a code with no row here is a defect and throws, loudly. */
export function rowOf(code) {
  const row = CASE_SOURCES_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`publication: ${code} has no row with a canned translation (DEC-49)`);
  return { code, check: row.check, translation: row.translation };
}
