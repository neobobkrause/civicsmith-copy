/* provenance's refusal rows (requirements: `build/requirements/provenance.md`, "Checks carried here"). DEC-49: every
 * refusal this module answers carries its code, its catalogue row and the member's translation.
 *
 * T18 (K585 (3)): the families this module mints moved here whole from the check catalogue (`checks/bio-checks.mjs`,
 * legacy-checks), each with its header, its ids and its rows unchanged: C-24 `VERSION_CHAIN_CHECKS`, C-103
 * `PROVENANCE_ACT_CHECKS` and C-53 `TESTIMONY_CHECKS` (C-53.1–C-53.9, C-53.13). Where a header below says "this
 * catalogue" or "this file", it was written in the catalogue; the rows it names are these. C-53.10–C-53.12 stay
 * ratification's.
 *
 * N512 (T25): C-34 `ROUTE_MARK_CHECKS` is `provenance-routes`' and C-89 `ATTEST_CHECKS` is `attestation`'s, each in
 * its own `checks.mjs`; no copy of either is held here, so no row is held twice (K1225). C-103.3, C-103.6 and
 * C-103.7 stay in `PROVENANCE_ACT_CHECKS`, answered through it by those modules (R58).
 *
 * C-53.14 was minted in this module's own table, `REGISTER_ENTRY_CHECKS`, rather than in `TESTIMONY_CHECKS`: a row is
 * counted wherever it lives (promotion R34), and the table takes a name of its own so no two families share one. It is
 * the same fence at the same write as C-53.13, asked of each register entry's stated size. */

/* =========================================================================
 * PL-10 / D-220 — THE DOCUMENT-VERSION CHAIN'S REFUSALS.
 *
 * The chain is a JOIN over two tables the record already holds, keyed on an
 * ADDRESS. Both ways of asking it wrong are ways of being told something about
 * a document other than the one asked about, which on this surface is the whole
 * hazard: sixty versions of one calendar reading as sixty documents is the
 * false-coverage failure D-220 exists to remove, and answering the wrong
 * address is the same failure arriving by the front door.
 *
 * D-221's mechanism is why the FIRST of these is a refusal rather than a
 * fallback. `heldMatch` reached for prior versions with a full-text query on a
 * text-indexed field, so a near-miss on the address still ANSWERED — with the
 * wrong document, ranked by relevance. An address that cannot be resolved must
 * therefore stop, not soften into a search.
 *
 * DEC-49's shape, on MEANING_READ_CHECKS' precedent (retrieval's family, in
 * `src/retrieval/checks.mjs` since T5; it stood in this file when this was written): the C-number, the
 * wire code and the CANNED TRANSLATION are ONE ROW, read from one place rather
 * than copied.
 * ========================================================================= */
import { word, localize } from '../setup-words/index.mjs';

export const VERSION_CHAIN_CHECKS = {
  /* No address at all. There is no default document and there must not be one:
     the chain's entire subject is "at THIS address", and a chain answered for
     an unnamed address is a list of unrelated bundles wearing the word
     "versions". */
  VERSION_CHAIN_NO_ADDRESS: {
    check: 'C-24.1',
    where: 'src/provenance/index.mjs versionChain, reached from op=versionchain',
    translation: word('refusal.VERSION_CHAIN_NO_ADDRESS'),
  },
  /* An anchor was given and it is not a version at this address. Refused rather
     than matched approximately — that approximation IS D-221 — and refused
     IDENTICALLY whether the capture is absent, filed at a different address, or
     in a project this viewer was never invited to. Hidden and absent are one
     answer here, as they are on every gated read in this plane. */
  VERSION_CHAIN_NO_SUCH_VERSION: {
    check: 'C-24.2',
    where: 'src/provenance/index.mjs versionChain, reached from op=versionchain with at=<capture sha>',
    translation: word('refusal.VERSION_CHAIN_NO_SUCH_VERSION'),
  },
  /* The anchor is not the shape a capture identity has. A separate refusal from
     the one above because it is a different fact about the world: "you typed
     something that is not a capture" is the caller's, and "no such version" is
     the record's. Collapsing them would make a typo indistinguishable from an
     absence, which is the distinction CLAUDE.md requires be stated. */
  VERSION_CHAIN_BAD_ANCHOR: {
    check: 'C-24.3',
    where: 'src/provenance/index.mjs versionChain, reached from op=versionchain with at=<capture sha>',
    translation: word('refusal.VERSION_CHAIN_BAD_ANCHOR'),
  },
};

/* ===========================================================================
   C-103 — PROVENANCE'S OWN ACTS (T4's extraction, provenance R1, R29, R58; T6, legacy-checks, N81).

   PROVENANCE #1 (T4) minted these in `src/provenance/index.mjs` and reported that none had a row: the write-time
   register refusal, a member's declared origin for a document (REC-225) and the instance's signed receipt for an
   archive-sourced capture (K59). They are one family because they were one module's acts and none fits a family
   already here: TESTIMONY_CHECKS is a member's testimony.

   THE SEAM (R58; N512, T25): the signed receipt is `attestation`'s since N512, and `provenanceChainRebuild` is
   `provenance-routes`'; both answer through this family rather than splitting it between files, so each row's `where`
   names the site that raises it, in whichever module that is.

   THE `where`s: `#registerArms` and `signReceipt` refuse only with these rows, so each names its function whole.
   `declareOrigin` also answers NO_SUCH_BUNDLE, a code minted at 26 sites and given no row (ACT_SHAPE_CHECKS'
   REC-64 rule), so its rows name two regions that exclude it, `is-origin-act` (ORIGIN_NOT_A_MEMBER, NO_BUNDLE)
   and `is-origin-statement` (ORIGIN_NOT_A_DOCUMENT, ORIGIN_NO_SYSTEM); marking them is provenance's. NO_BUNDLE
   is also answered by `provenance-routes`' `provenanceChainRebuild` for the same condition, and its sentence is true
   at both.
   =========================================================================== */
export const PROVENANCE_ACT_CHECKS = {
  /* R1: the C-18 register rules at the write. The findings carry each rule's own C-18 id; this row is the act's. */
  PROVENANCE_REGISTER_REFUSED: {
    check: 'C-103.1',
    where: 'src/provenance/index.mjs #registerArms',
    translation: word('refusal.PROVENANCE_REGISTER_REFUSED'),
  },
  ORIGIN_NOT_A_MEMBER: {
    check: 'C-103.2',
    where: 'src/provenance/index.mjs declareOrigin > is-origin-act',
    translation: word('refusal.ORIGIN_NOT_A_MEMBER'),
  },
  NO_BUNDLE: {
    check: 'C-103.3',
    where: 'src/provenance/index.mjs declareOrigin > is-origin-act; src/provenance-routes/index.mjs provenanceChainRebuild',
    translation: word('refusal.NO_BUNDLE'),
  },
  ORIGIN_NOT_A_DOCUMENT: {
    check: 'C-103.4',
    where: 'src/provenance/index.mjs declareOrigin > is-origin-statement',
    translation: word('refusal.ORIGIN_NOT_A_DOCUMENT'),
  },
  ORIGIN_NO_SYSTEM: {
    check: 'C-103.5',
    where: 'src/provenance/index.mjs declareOrigin > is-origin-statement',
    translation: word('refusal.ORIGIN_NO_SYSTEM'),
  },
  RECEIPT_MALFORMED: {
    check: 'C-103.6',
    where: 'src/attestation/index.mjs signReceipt',
    translation: word('refusal.RECEIPT_MALFORMED'),
  },
  RECEIPT_NO_KEY: {
    check: 'C-103.7',
    where: 'src/attestation/index.mjs signReceipt',
    translation: word('refusal.RECEIPT_NO_KEY'),
  },  /* R65 (T51; K4169, C62): a member's decision on a captured document's content authority. `declareAuthority` also answers
     NO_SUCH_BUNDLE, which carries no row (REC-64), so its rows name three regions that exclude it. */
  AUTHORITY_NOT_A_MEMBER: {
    check: 'C-103.8',
    where: 'src/provenance/index.mjs declareAuthority > is-authority-act',
    translation: localize('provenance.checks.deciding_who_issued_a', 'Deciding who issued a document is a named member\'s judgment, so nothing was recorded. A machine, an assistant or a call that carries nobody may suggest an issuer and never decides one. Sign in as a member.'),
  },
  AUTHORITY_NOT_A_DOCUMENT: {
    check: 'C-103.9',
    where: 'src/provenance/index.mjs declareAuthority > is-authority-document',
    translation: localize('provenance.checks.nothing_was_recorded_the_capture', 'Nothing was recorded: the capture named is not a document held in that record. Name a document the record\'s register holds.'),
  },
  AUTHORITY_NO_BASIS: {
    check: 'C-103.10',
    where: 'src/provenance/index.mjs declareAuthority > is-authority-statement',
    translation: localize('provenance.checks.nothing_was_recorded_say_how', 'Nothing was recorded: say how you know, or what you tried, in at most 2,000 characters. Not knowing is a fine answer, and it still needs its reason.'),
  },
  AUTHORITY_NO_ISSUER: {
    check: 'C-103.11',
    where: 'src/provenance/index.mjs declareAuthority > is-authority-statement',
    translation: localize('provenance.checks.nothing_was_recorded_name_the', 'Nothing was recorded: name the party that issued this document, in at most 500 characters. If you could not tell, choose that instead and say what you tried; no issuer is invented for you.'),
  },
  AUTHORITY_OUTCOME_UNKNOWN: {
    check: 'C-103.12',
    where: 'src/provenance/index.mjs declareAuthority > is-authority-statement',
    translation: localize('provenance.checks.nothing_was_recorded_a_decision', 'Nothing was recorded: a decision is either that the issuer is determined, or that after review it is still undetermined.'),
  },

};

/* =====================================================================
 * MK-1 / D-184 / IC-133 / IC-134 — THE AUTHORED BUNDLE (`MEMBER-KNOWLEDGE-
 * DESIGN.md` §2 and §7): a member's firsthand observation IS a document — an
 * INFO bundle whose bytes are a canonical header then the member's words, registered like any capture and
 * flagged `authored`. C-53, minted with the old process's `node tools/mintid.mjs C` (retired in T19).
 *
 * ITS OWN FAMILY, because the subject is its own: the ways a member's own
 * statement could be made to pass for a captured document (or a captured
 * document for a member's statement), and the ways the act could be performed
 * in somebody else's name. The design's words: the register must never let one
 * pass for the other.
 *
 *   is-testify-act       who is testifying — a signed-in member, stamped by the
 *                        plane; a machine, or a caller naming the author, refused
 *   is-testify-words     the words and the date the member says they observed it
 *   is-testify-bytes     whether the canonical bytes (header + words) are already
 *                        registered — reachable only by pre-registering them
 *   is-testimony-publish-bundle / is-testimony-publish-case
 *                        THE PUBLICATION FENCE (C-53.10–.12, now ratification's
 *                        RATIFY_TESTIMONY_CHECKS, not in this family), NARROWED BY MK-7:
 *                        it stands only over an observation that still names
 *                        its author in its own files (written before MK-6,
 *                        §4.1), a finding resting on one, or a case over such a
 *                        finding. Every other observation crosses under MK-7's
 *                        attribution (C-92: publication's and ratification's)
 *   is-testimony-fence  THE REFUSALS THE ITEM EXISTS FOR, at op=promote — the one
 *                        write path — so no route but op=testify can set the flag,
 *                        and no revision can quietly change what it says: an
 *                        authored document claiming an origin or actor other than
 *                        `member` (C-53.7); a document claiming `authored` that the
 *                        testimony path did not write (C-53.8, THE LIAR: a flag any
 *                        writer could set); an authored document that stops saying
 *                        so (C-53.9).
 *   is-register-home     D-179, THE SAME FENCE ASKED OF EVERY CAPTURE (C-53.13): a
 *                        register entry whose bytes another existing bundle
 *                        already holds — one capture, one home, the original's.
 *
 * WHAT IS NOT HERE, each by design: the `testimony` grade axis (§3) is MK-2's
 * and lives in C-2.8 (`checkTestimonyLeg`, IC-142), not in this family; the
 * attribution level on the case act (§4) is MK-7's, C-92 (publication's and ratification's).
 *
 * WHAT THE FAMILY HOLDS NOW, AND WHERE (T11, legacy-checks, N282; K325; T18,
 * K585 (3)). `TESTIMONY_CHECKS` holds C-53.1–C-53.9 and C-53.13, all minted in
 * provenance, and since T18 it is provenance's own, in this file. C-53.10–C-53.12
 * are ratification's (`src/ratification/checks.mjs` RATIFY_TESTIMONY_CHECKS).
 * C-53.14, REGISTER_BYTES_UNSTATED (a register entry states its size, provenance
 * R50), is provenance's too, in its own table below, `REGISTER_ENTRY_CHECKS`
 * (region `is-register-bytes` in `#registerEntries`).
 * ===================================================================== */
export const TESTIMONY_CHECKS = {
  TESTIMONY_NOT_A_MEMBER: {
    check: 'C-53.1',
    where: 'src/provenance/index.mjs testify > is-testify-act',
    translation: word('refusal.TESTIMONY_NOT_A_MEMBER'),
  },
  TESTIMONY_AUTHOR_SUPPLIED: {
    check: 'C-53.2',
    where: 'src/provenance/index.mjs testify > is-testify-act',
    translation: word('refusal.TESTIMONY_AUTHOR_SUPPLIED'),
  },
  TESTIMONY_NO_WORDS: {
    check: 'C-53.3',
    where: 'src/provenance/index.mjs testify > is-testify-words',
    translation: word('refusal.TESTIMONY_NO_WORDS'),
  },
  TESTIMONY_WORDS_TOO_LONG: {
    check: 'C-53.4',
    where: 'src/provenance/index.mjs testify > is-testify-words',
    translation: word('refusal.TESTIMONY_WORDS_TOO_LONG'),
  },
  TESTIMONY_OBSERVED_AT_INVALID: {
    check: 'C-53.5',
    where: 'src/provenance/index.mjs testify > is-testify-words',
    translation: word('refusal.TESTIMONY_OBSERVED_AT_INVALID'),
  },
  /* NARROWED BY BOB #14's RULING (2026-09-18), NOT DELETED. This refused a
     second member's IDENTICAL words, because the register is keyed by bytes.
     The ruling: two identical observations are two testimonies, and the bytes
     carry a canonical header holding the testimony's own id — so identical
     words never collide. What is left is the case only an adversary produces:
     somebody registering, ahead of time, the exact bytes the NEXT testimony
     will have (the id is sequential, so it can be predicted). Recording over
     them would re-file their register row under the observation. */
  TESTIMONY_WORDS_REGISTERED: {
    check: 'C-53.6',
    where: 'src/provenance/index.mjs testify > is-testify-bytes',
    translation: word('refusal.TESTIMONY_WORDS_REGISTERED'),
  },
  TESTIMONY_ORIGIN_NOT_MEMBER: {
    check: 'C-53.7',
    where: 'src/provenance/index.mjs #testimonyFence > is-testimony-fence',
    translation: word('refusal.TESTIMONY_ORIGIN_NOT_MEMBER'),
  },
  TESTIMONY_AUTHORED_UNEARNED: {
    check: 'C-53.8',
    where: 'src/provenance/index.mjs #testimonyFence > is-testimony-fence',
    translation: word('refusal.TESTIMONY_AUTHORED_UNEARNED'),
  },
  TESTIMONY_AUTHORED_DROPPED: {
    check: 'C-53.9',
    where: 'src/provenance/index.mjs #testimonyFence > is-testimony-fence',
    translation: word('refusal.TESTIMONY_AUTHORED_DROPPED'),
  },
  /* D-179 — ONE CAPTURE, ONE HOME, THE ORIGINAL's (BOB #26, 2026-09-22;
     `BIO_Intake_Doctrine_v1_1.md` §8). C-53.8 generalised from an authored
     observation to EVERY capture: `register` is keyed by `capture_sha`, so a
     promote registering bytes another bundle already holds would MOVE that
     bundle's row to the newcomer, silently. Kept in this family because it is
     the same fence at the same line, asked of every row rather than the authored
     one; C-53.8 still answers first for an authored capture, in its own words.
     The holding bundle is named only to a caller who may see it (D-15). */
  CAPTURE_HELD_BY_ANOTHER_BUNDLE: {
    check: 'C-53.13',
    where: 'src/provenance/index.mjs #testimonyFence > is-register-home',
    translation: word('refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE'),
  },
};

/* N263 (R50): A REGISTER ENTRY STATES ITS SIZE. `register.bytes` is part of the read contract (R48): the register audit
   compares it with the stored object (R8), publication reads it, and the column is NOT NULL. An entry with no size
   failed the promotion as a bare `PROMOTE_FAILED` from the database, and one stating `-1` or `1.5` was stored as a
   size no capture can have. Refused by name, before anything is written; this module does not compare the stated
   size with the stored object's, which R7 and R8 read. */
export const REGISTER_ENTRY_CHECKS = {
  REGISTER_BYTES_UNSTATED: {
    check: 'C-53.14',
    where: 'src/provenance/index.mjs #registerEntries > is-register-bytes',
    translation: word('refusal.REGISTER_BYTES_UNSTATED'),
  },
};
