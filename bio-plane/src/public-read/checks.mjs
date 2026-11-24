/* public-read's refusal rows (requirements: `build/requirements/public-read.md`, R17). DEC-49: every refusal this
 * module answers carries its code, its catalogue row and the stranger's translation.
 *
 * Moved from `publication/checks.mjs` (its R33) with their numbers, wheres and translations unchanged (K651; K93 (3):
 * rows follow their raisers): C-44.2 (the read's half of D-309, raised by `#resolveOneCase`; C-44.1 and C-44.3–.5 are
 * case-authoring's), C-68.5 (the published-store complaint; the rest of C-68 stays in the catalogue's
 * `INSTALLATION_CHECKS`, and `control-plane` reads this row from here, its layer-11 job) and the whole of C-98 (the
 * public door). Each family keeps the name it had there. C-98.10 (`PUBLIC_READ_NOT_REGISTERED`, R18; K1149) is a row minted
 * here in T23, stamped by 1.54.0; C-98.11 (`WITHHELD_BY_COURT_ORDER`, R28) in T33, its stamp T34's (K1504). `publication`'s job deletes its copies once this one merges,
 * so no row id is held in two tables after it. */

import { word } from "../setup-words/index.mjs";

/* C-44.2 — D-309's read (R3). Its family, C-44, is the case identity: the act's half (C-44.1) is case-authoring's. */
export const CASE_RESOLUTION_CHECKS = {
  /* UI-81 (2026-09-23) — D-309's OTHER HALF, the READ, given its row. `op=publishedcase` handed a
     finding id that several cases pin refuses and names every case (IC-74), because each case is
     its own artifact and serving one would choose for the reader. That refusal reached the
     published case page — the one page a stranger reads — with no code and no translation, and no
     row here named it, so the DEC-49 guard could not see it (R1 misses it; R2 misses it because
     the surface keys on the refusal's `cases[]`, not on the code). A ROW IN THIS FAMILY rather than
     a new one: the condition is clause 6's ambiguity at the read where C-44.1 is the same
     ambiguity at the act, and `#resolveOneCase` builds the refusal from this row (`rowOf`). The translation says what a reader of either surface can do — choose — and
     names no screen, because every caller of `#resolveOneCase` answers with it. */
  FINDING_IN_SEVERAL_CASES: {
    check: 'C-44.2',
    where: 'src/public-read/index.mjs #resolveOneCase > is-finding-in-several-cases',
    translation: word('refusal.FINDING_IN_SEVERAL_CASES'),
  },
};

/* C-68.5 — the published-store complaint (R5), at both public reads. Its family, C-68, is the installation's. */
export const PUBLISHED_STORE_CHECKS = {
  /* D-549. The one row in this family whose reader is most likely NOT whoever installed the copy:
     `publishedbytes` and `publishedcase` are PUBLIC, so the sentence is written for a member of the
     public holding no credential, and says what they can rely on (the document IS published, and
     nothing about it changed) before who can cure it. It names no binding and no mechanism. It is
     true at both sites: at `publishedbytes` the hash has already been verified as published, and at
     `publishedcase` the finding is a member of a published case. */
  NO_PUBLISHED_STORE: {
    check: 'C-68.5',
    where: 'src/publication/worker.mjs publishedStoreAbsent > is-published-store-absent',
    translation: word('refusal.NO_PUBLISHED_STORE'),
  },
};

/* ===========================================================================
   D-561 (C-98) — THE PUBLIC DOOR'S OWN REFUSALS: `op=publishedbytes` AND `op=publishedcase`.

   `BIO_Publication_v0_1.md` §4 lists both as the reads a published case is served through, and both are
   UNGATED (`classes: null`): the reader these sentences are written for is a MEMBER OF THE PUBLIC holding no
   credential. D-549 translated NO_PUBLISHED_STORE (C-68.5); D-561 enumerated at the code every other code the
   two ops hand an anonymous caller and found these eight bare, plus STORE_DID_NOT_ANSWER (C-69.2, the control plane's).

   EVERY SENTENCE HERE IS WRITTEN FOR A STRANGER, AND THREE RULES HOLD FOR ALL OF THEM:
     - PLAIN, no internal name: no bucket, binding, manifest key, op name or parameter spelled as code. A hash is
       "the fingerprint"; a container is "the case file as one download"; its manifest is "the list of its
       contents".
     - NEVER MORE THAN THE SITE ALREADY DISCLOSES. NO_PUBLISHED_PART and NOT_PUBLISHED keep their sites' doctrine:
       never-published and never-existed are ONE answer, and the sentence says so rather than hinting at either.
       The other six are reached only after the thing asked for was verified PUBLISHED, which is itself a public
       fact, so saying "it is published" discloses nothing.
     - A CONDITION OF THIS COPY IS STATED AS ONE, with who can cure it — never as a fact about the document.

   TWO CODES WERE RENAMED TO GET HERE, and that is the non-additive part of this family (I3): the public door
   answered `NOT_FOUND` and the container `TOO_LARGE`, and both spellings are minted elsewhere in the plane for
   DIFFERENT conditions (a capture absent from working storage, a progression version, an inbox item; a
   subresource, a knock). `dec49Attach` decorates by code, so a row under either old spelling would have put the
   public door's sentence on every other site's refusal — false there. One condition, one code, one row.
   A third site that answered `NOT_FOUND` — a hash VERIFIED published whose bytes are absent — said "no published
   part answers to that hash", which was FALSE of it; it now answers OBJECT_MISSING, the code `publishedcase`
   already used for the same condition, minted at one shared site.
   =========================================================================== */
export const PUBLISHED_READ_CHECKS = {
  NO_PUBLISHED_PART: {
    check: 'C-98.1',
    where: 'src/publication/worker.mjs noPublishedPart > is-no-published-part',
    translation: word('refusal.NO_PUBLISHED_PART'),
  },
  OBJECT_MISSING: {
    check: 'C-98.2',
    where: 'src/publication/worker.mjs publishedObjectMissing > is-published-object-missing',
    translation: word('refusal.OBJECT_MISSING'),
  },
  NOT_A_CONTAINER: {
    check: 'C-98.3',
    where: 'src/publication/worker.mjs publishedRoutes > is-not-a-container',
    translation: word('refusal.NOT_A_CONTAINER'),
  },
  MANIFEST_UNREADABLE: {
    check: 'C-98.4',
    where: 'src/publication/worker.mjs publishedRoutes > is-manifest-unreadable',
    translation: word('refusal.MANIFEST_UNREADABLE'),
  },
  PART_MISSING: {
    check: 'C-98.5',
    where: 'src/container.mjs containerEntries > is-part-missing',
    translation: word('refusal.PART_MISSING'),
  },
  DUPLICATE_PATH: {
    check: 'C-98.6',
    where: 'src/container.mjs serialiseContainer > is-duplicate-path',
    translation: word('refusal.DUPLICATE_PATH'),
  },
  CONTAINER_TOO_LARGE: {
    check: 'C-98.7',
    where: 'src/container.mjs serialiseContainer > is-container-too-large',
    translation: word('refusal.CONTAINER_TOO_LARGE'),
  },
  NOT_PUBLISHED: {
    check: 'C-98.8',
    where: 'src/public-read/index.mjs publishedCase > is-not-published',
    translation: word('refusal.NOT_PUBLISHED'),
  },
  /* D-734 (K245): a RATIFIED case document's hash is published, and its bytes are its signed text, re-hashed before
     they are served. When the record cannot produce bytes that hash to it, nothing is served and this says so; it is
     never NO_PUBLISHED_PART, whose sentence would call the document never published. */
  CASE_DOCUMENT_UNSERVABLE: {
    check: 'C-98.9',
    where: 'src/publication/worker.mjs publishedRoutes > is-case-document-unservable',
    translation: word('refusal.CASE_DOCUMENT_UNSERVABLE'),
  },
  /* R18 (K1149): a name no module registered a public read under, at `op=publicread` or a read's own op. A STRANGER's
     refusal, so it has its row; the registration's own refusals (`PROVIDER_DECLARED`, `PROVIDER_MALFORMED`) are a
     starting module's errors and have none. A new row minted in T23, stamped by 1.54.0 (T24's L2 moved
     `CATALOG_VERSION`, `publication` R33). */
  PUBLIC_READ_NOT_REGISTERED: {
    check: 'C-98.10',
    where: 'src/public-read/index.mjs publicRead > is-public-read-not-registered',
    translation: word('refusal.PUBLIC_READ_NOT_REGISTERED'),
  },
  /* R28 (K1480, K1493, K1522; J1 (6)): bytes a court order this group complied with withholds from serving, at
     `publishedbytes`. A new row minted in T33; its stamp by a release is T34's (K1504). The bytes are held, never
     deleted, and the fingerprint still verifies, so the sentence says both. */
  WITHHELD_BY_COURT_ORDER: {
    check: 'C-98.11',
    where: 'src/publication/worker.mjs withheldByCourtOrder > is-withheld-by-court-order',
    translation: word('refusal.WITHHELD_BY_COURT_ORDER'),
  },
};

/** A refusal from one of this module's rows: `reason` and `code` one literal, with its check and translation (R17). The
 *  code is a string literal at every call site (DEC-49); a code with no row here is a defect and throws, loudly. */
export function rowOf(code) {
  const row = Object.hasOwn(CASE_RESOLUTION_CHECKS, code) ? CASE_RESOLUTION_CHECKS[code]
    : Object.hasOwn(PUBLISHED_STORE_CHECKS, code) ? PUBLISHED_STORE_CHECKS[code]
    : Object.hasOwn(PUBLISHED_READ_CHECKS, code) ? PUBLISHED_READ_CHECKS[code] : null;
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`public-read: ${code} has no row with a canned translation (DEC-49)`);
  return { code, check: row.check, translation: row.translation };
}
