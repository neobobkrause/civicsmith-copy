/* answer-envelope's table: the rows of the checks the two doors raise (R8, was `control-plane` R32's rows; K6: each check
 * moves as an invariant with its test). DEC-49: every refusal the doors answer carries its code, its row's check id and
 * the member's translation, read from the one row here.
 *
 * Copied whole from `control-plane/checks.mjs` at the split (T35-80; K617, K1907, K1974), each row keeping its code,
 * check id and words. Each `where` names the file whose code raises the row: this module's for C-61.1, C-69.2 and C-69.3
 * (`requiredArgument`, `storeSilent`, `planeInternalAnswer`); `store-door`'s `dispatch.mjs` for C-69.4 and C-69.5 (its
 * R6, R4); `control-plane/index.mjs` for C-69.1, C-68.2–.4 and C-66.6, whose sites stay there; `signin-door`'s file for C-69.7
 * (`SIGNINTRACE_NOT_TEST`, its R5; R16). Each check's invariant and its test stay where its code is raised. C-69.6
 * (`DISCLOSURE_DUE`, T46) retired at T47 (R14; DEC-198 (3), K3030): the code's one row is `credentials`' C-29.40, its
 * number never reused.
 *
 * History, from `control-plane`: moved from the check catalogue (`checks/bio-checks.mjs`) at control-plane's extraction
 * (T12, K6, K64's pattern): the dispatch rows C-69.1–.4 whole; the bootstrap claim's C-68.2–.4 (`INSTALLATION_CHECKS`
 * keeps C-68.1, minted at acquisition's one region); the unverified replay C-66.6; and, at T18 (K621, K636), the argument
 * complaint C-61.1 with R39's gate. The admission rows (C-38, C-78, C-29.6–.10, C-32.17, C-64.4) left with the gates
 * that raise them for `admission`'s own table at the split (K617, K624 (1), (2); admission R14). */

/* ===========================================================================
   D-278 (C-69) — NO OPERATION BY THAT NAME.

   Group (5) of BOB #26's ruling. `error: "unknown op"` is kept BYTE-IDENTICAL
   beside the code, and that is load-bearing rather than courtesy: the legacy
   `civicos-ui` screens read it (`queueAbsent` and its two siblings) until that
   folder is deleted (CR-5), to tell a copy running an OLDER
   plane — one that has not got the op yet — from a refusal. The translation
   says only what the copy knows: it has no op by that name. It does not guess
   which of "older", "newer" or "misspelt" is true.
   =========================================================================== */
import { word, localize } from '../setup-words/index.mjs';

export const DISPATCH_CHECKS = {
  UNKNOWN_OP: {
    check: 'C-69.1',
    where: 'src/control-plane/index.mjs fetch > is-unknown-op',
    translation: word('refusal.UNKNOWN_OP'),
  },
  /* D-561. THE STORE DID NOT ANSWER (REC-52's `storeSilent`). Every public read can meet it — `publishedbytes`,
     `publishedcase`, `verify`, `publishedmanifest` — so its reader is often a member of the public holding nothing,
     and until D-561 the code reached them bare. It is a fact about the EXCHANGE, never about the record, and the
     sentence says only that. It does NOT say "nothing was changed": `storeSilent` also answers a write whose store
     went silent, and whether that write took effect is exactly what a silence cannot say. */
  STORE_DID_NOT_ANSWER: {
    check: 'C-69.2',
    where: 'src/answer-envelope/index.mjs storeSilent > is-store-silent',
    translation: word('refusal.STORE_DID_NOT_ANSWER'),
  },
  /* D-629 (R5; C-69.3) — THE WORKER DOOR THREW. It had no outermost catch (the platform's own error page); the stack is
     now logged server-side under a CORRELATION id, and the caller receives the code, this sentence and the id, nothing
     else. Numbered after C-69.2, which D-561 gave `STORE_DID_NOT_ANSWER`. The store's own row (`STORE_INTERNAL_ERROR`,
     C-69.4) came with the store's door (N333, K412). THE TRANSLATION CLAIMS NOTHING ABOUT THE RECORD: a throw part-way through
     an op may or may not have left a write behind, and the catch cannot say which. */
  PLANE_INTERNAL_ERROR: {
    check: 'C-69.3',
    where: 'src/answer-envelope/index.mjs planeInternalAnswer > is-plane-internal-error',
    translation: word('refusal.PLANE_INTERNAL_ERROR'),
  },
  /* D-629 (`store-door` R6; C-69.4) — THE STORE'S DOOR THREW. Its outermost catch answered `String(e.stack)` for any throw on any op
     (file paths, line numbers and constraint text, public ops included). It came with the store's door (N333, K412);
     C-69.3 being PLANE_INTERNAL_ERROR's since T12, it takes the next free number (stamped by 1.44.0, N318). Same posture:
     the stack is logged under a CORRELATION id, the caller receives the code, this sentence and the id. */
  STORE_INTERNAL_ERROR: {
    check: 'C-69.4',
    where: 'src/store-door/dispatch.mjs internalAnswer > is-store-internal-error',
    translation: word('refusal.STORE_INTERNAL_ERROR'),
  },
  /* DEC-113 (`store-door` R4, C-69.5; K1252, K1253) — A PURGE THAT WOULD REACH HELD MATERIAL. While a litigation hold stands, the
     store's door refuses every purge of the real record that would reach what the hold preserves: the whole store while
     any hold is in place, and a single bundle of a held project or a held action, or one whose project cannot be told.
     A failure to ask the hold refuses too, so the sentence claims only that the removal could not be shown to be clear
     of the hold. Nothing was removed, read for proof or written. The test store (`scratch`) is never refused for a hold. */
  PURGE_HOLD_IN_PLACE: {
    check: 'C-69.5',
    where: 'src/store-door/dispatch.mjs purgeHoldRefusal > is-purge-hold-in-place',
    translation: word('refusal.PURGE_HOLD_IN_PLACE'),
  },
  /* T47 (R16; `signin-door` R5, was `control-plane` R87; N1001, connect §3) — THE SIGN-IN TRACE OFF A TEST INSTANCE. The
     bounded trace of sign-ins is kept and answered by `op=signintrace` on a test instance only; anywhere else the door
     refuses, reading and writing nothing. The next free C-69 number (C-69.6 retired, never reused). Its words are this
     table's until `words.json` holds `refusal.SIGNINTRACE_NOT_TEST`; they say only what the copy knows. */
  SIGNINTRACE_NOT_TEST: {
    check: 'C-69.7',
    where: 'src/signin-door/index.mjs signintrace > is-signintrace-test-instance',
    translation: localize('answer-envelope.checks.this_teams_civicsmith_keeps_a', 'This team\'s Civicsmith keeps a trace of sign-ins only when it runs as a test instance, and this one does not. Nothing was read or changed.'),
  },
};

/* C-68.2–.4 — THE BOOTSTRAP CLAIM (D-278). `claim`'s three bootstrap-credential complaints, pre-authentication, met
   before anyone holds anything, and each says no more than its `error` did. Addressed to whoever installed the copy,
   the only person who can act on them. Split from `INSTALLATION_CHECKS`, which keeps C-68.1. */
export const BOOTSTRAP_CHECKS = {
  BOOTSTRAP_CREDENTIAL_UNSET: {
    check: 'C-68.2',
    where: 'src/control-plane/index.mjs fetch > is-bootstrap-claim',
    translation: word('refusal.BOOTSTRAP_CREDENTIAL_UNSET'),
  },
  BOOTSTRAP_CREDENTIAL_PUBLISHED: {
    check: 'C-68.3',
    where: 'src/control-plane/index.mjs fetch > is-bootstrap-claim',
    translation: word('refusal.BOOTSTRAP_CREDENTIAL_PUBLISHED'),
  },
  BOOTSTRAP_CREDENTIAL_MISMATCH: {
    check: 'C-68.4',
    where: 'src/control-plane/index.mjs fetch > is-bootstrap-claim',
    translation: word('refusal.BOOTSTRAP_CREDENTIAL_MISMATCH'),
  },
};

/* C-66.6 — A REPLAY THE PLANE COULD NOT VERIFY (D-512). Split from `SURFACE_CHECKS`. */
export const REPLAY_CHECKS = {
  /* D-512 (INVESTIGATIVE-SESSION.md §11 item 5, "`replay` IS THE SERVER'S WORD, NEVER THE CALLER'S", BOB #33's
     STEP (2)): `replay` exempts a promotion from every shape fence `promote` has, because a replay re-states the
     record's own past verbatim. D-511 (step 1) removed the flag from every caller but the ADMIN class with no
     session; this is the end state. A promotion of ANY type and ANY revision that asserts a replay names its
     drive-provenance capture, and `op=promote` verifies it against what the record HOLDS — the capture registered
     by this promotion, its bytes read back and hashed, and one preserved promotion record naming this bundle and
     listing this revision's `bundle.md` SHA-256 — never against the request's own claim. Found
     before this existed (`9f8b69e6`, by the old `risk-tier.test.mjs` §8 arm (δ)): the admin deploy token sending
     `replay: true` with no provenance landed `risk_tier: 1` on an action nobody assessed. `control-plane` R16's tests
     (`test/m/control-plane/gates.test.mjs`, `converts.test.mjs`) prove the gate now. Asked in `op=promote`'s stamp block
     BEFORE the store is called, so nothing is written. The admin is refused rather than downgraded to an ordinary
     promotion, because an honest replay carries the past verbatim and an ordinary creation is rewritten on the way in.
     (Its one honest sender was the Drive-era migration tool, `migrate.mjs`, retired in K739; no product caller sends a
     replay today, and the gate stands for any that does.) */
  REPLAY_UNVERIFIED: {
    check: 'C-66.6',
    where: 'src/control-plane/index.mjs fetch > is-promote-replay-verified',
    translation: word('refusal.REPLAY_UNVERIFIED'),
  },
};

/* ===========================================================================
   D-270 — THE ARGUMENT COMPLAINT (C-61), the other half of the row. Moved from the check catalogue at T18 (K636,
   K621: control-plane R39's gate and its raiser `requiredArgument` with it; the row and its words unchanged, its
   `where` then control-plane's; stamped by 1.49.0). Its `where` names this module's file since T35's split (R8).

   THREE OPS REFUSED A MISSING OR MALFORMED ARGUMENT WITH A BARE `error` STRING
   AND NO CODE OF ANY KIND: `op=capture` and `op=pdfstructure` (*"requires
   sha256=<64 lowercase hex>"*) and `op=monitor` (*"needs a bundleId"*). A
   refusal with no code is one layer further out than REC-64's sweep of codes
   with no translation — there is nothing to translate, DEC-49's guard cannot
   see it, and a census of CODES cannot count a refusal that has none.

   ONE ROW AND NOT THREE, and the reason is that the CONDITION is one condition.
   `AI_BEYOND_TASK_SCOPE` is the standing precedent for a single code whose
   producers are told apart by a field. The site names the argument and the shape
   it wanted, so a caller can tell `op=capture`'s complaint from `op=monitor`'s
   without the catalogue growing a row per call site.

   AND IT IS MINTED IN ONE GOVERNED FUNCTION rather than at three edited sites,
   because a DEC-49 row holds ONE `where` naming the SMALLEST SPAN. A code minted
   at three sites inside `fetch` could not name one honestly — the guard's own
   arm-C note calls that the MULTI-SITE class. Minting it in `requiredArgument`
   is what makes this row's `where` true.

   CORRECTED 2026-09-23 BY D-278. This paragraph read *`op=verify` and
   `op=publishedbytes` make the same sha256 complaint and keep their bare
   strings … D-278's subject and a different determination.* BOB #26 made that
   determination (INTERFACES.md I3, **Answers**, 2026-09-22): the PRE-
   AUTHENTICATION argument complaints of `verify`, `publishedbytes`,
   `publishedcase` and `knock` take THIS row, because the fact is the same fact
   and the sentence below carries no member vocabulary. They are minted through
   the same helper, so the row's one `where` stays true.
   =========================================================================== */
export const REQUIRED_ARGUMENT_CHECKS = {
  /* NOTHING WAS CHANGED, and the sentence says so first. A caller who cannot
     tell a refused request from a half-applied one has to go and look, and this
     is the one refusal in the plane most likely to be met by a script. */
  REQUIRED_ARGUMENT_MISSING: {
    check: 'C-61.1',
    where: 'src/answer-envelope/index.mjs requiredArgument > is-required-argument',
    translation: word('refusal.REQUIRED_ARGUMENT_MISSING'),
  },
};
