/* The gate: the check catalog, run rather than reimplemented.
 *
 * plane-gate/0.1 hand-wrote four checks because the catalog was unreachable,
 * embedded in an Apps Script runtime being decommissioned. That gate could not
 * see illegal states, missing core fields, wrong headings, broken append-only
 * surfaces, or a mechanical writer exceeding its envelope, which is how two
 * defects shipped in the intake path without anything noticing.
 *
 * This runs the catalog itself. Not a port of it: BIO's conformance doctrine
 * requires three implementations agreeing, and a plane-native rewrite of the
 * checks would be a fourth implementation pretending to be that agreement. The
 * catalog is a pure function over an injected filesystem, so the plane supplies
 * the five seams and nothing else.
 *
 * Two deliberate choices about bytes:
 *
 *   Blob-backed files are declared ELIDED rather than fetched. The catalog's
 *   three-tier read model exists for exactly this: existence assertions consult
 *   files union elided, byte checks read files only. Fetching would mean pulling
 *   a 39.6MB capture and its history copies into a Worker's memory to gate one
 *   bundle.
 *
 *   Capture integrity is not re-proven here because it was proven earlier and
 *   harder. The capture op hashes the body server-side on write and refuses a
 *   mismatch, so a registered capture's bytes were verified when they landed. A
 *   gate that re-hashes them on every ratification pays for the same assurance
 *   twice.
 *
 * What the plane still checks itself: that every registered capture is PRESENT
 * in the working bucket. That is an R2 head, not a fetch, and it catches the one
 * thing content addressing cannot, which is bytes that were never stored or were
 * removed out of band.
 */

import { checkBundle } from "./record-grammar/index.mjs";
import { recordChecks } from "./promotion/record-checks.mjs";
import { localize } from "./setup-words/index.mjs";

/* 1.21.0 (D-470, 2026-09-24): THE VERSION CATCHES UP WITH THE CATALOG, AND IS
   PINNED TO IT FROM HERE ON. The sentence below is the whole point of this
   constant and it was NOT TRUE between 2026-09-18 and today: 1.20.0 stamped the
   catalog REC-23/D-130 left, and then went on stamping it as C-41.10's
   acknowledgement arms (D-150), C-44.2 (CASE_DERIVATION_CHECKS, IC-185), C-73.1
   (GOVERNING_LAW_CHECKS, D-149) and others landed — so two different catalogs
   answered to one number and a stranger reading `1.20.0` on two ratifications
   could not tell them apart. That is a signed record claiming more precision
   than it holds, which is worse than a missing feature
   (BIO_Publication_v0_1.md §3 rule 12 (c); CLAUDE.md §2).
   MINOR, on REC-14's precedent as the note this replaces records it: 1.18.0 ->
   1.19.0 and 1.19.0 -> 1.20.0 were both MINOR for changes that made the catalog
   refuse documents that used to pass. This bump is ADDITIVE in the same sense
   and no check moves with it.

   1.24.0 (D-472, 2026-09-24, cloud session WORKER D-472 under CONDUCT #20): MINOR,
   ADDITIVE, and the census arm forced it again on a WORKER's branch rather than at an
   integration. `op=monitor` gained its own two Drive-shell refusals — C-48.8
   (DRIVE_TICK_EXPORT_IS_THE_SHELL) and C-48.9 (DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL) —
   so the catalogue went 447 -> 449 checks: TWO ARRIVALS, NO DEPARTURES. The figure is the
   one `d470-catalog-census.test.mjs` PRINTED on this tree, never 447 plus two.
   **THE NUMBER AND THE CENSUS ARE PROPERTIES OF THE MERGED CATALOGUE: if another branch in
   the same batch also adds rows, CONDUCT re-reads BOTH at integration** — which is what
   every note below this one records happening.

   1.23.0 (CONDUCT #20, c20-batch14, 2026-09-24): MINOR, ADDITIVE, and the census arm
   forced it a SECOND time at the union of c20-batch13 and c20-integ1b. D-64's
   `RENDER_CAPTURE_CHECKS` family arrived from the other side of the integration, so
   the catalogue went 438 -> 445 checks: SEVEN ARRIVALS, NO DEPARTURES (C-83.1 to
   C-83.7). The figure is the one `d470-catalog-census.test.mjs` PRINTED on this tree,
   never 438 plus seven. Same precedent as the bump below, one integration on.

   1.22.0 (CONDUCT #20, c20-batch13, 2026-09-24): MINOR, ADDITIVE, AND IT IS THE
   FIRST MOVE D-470'S OWN CENSUS FORCED RATHER THAN A HAND DECIDING TO MOVE IT.
   D-470 recorded 1.21.0's census on ITS OWN BASE. The other side of this
   integration, c20-batch11fix, GREW the catalog while standing at 1.20.0 with no
   census suite on it to notice — FIVE checks, all arrivals and no departures:
   C-32.19, C-41.13 (REC-188's disclosures arm), C-71.8, C-71.9 and C-78.2
   (D-461's NAMESPACE_PINNED). So at the union the catalog was NOT the catalog
   1.21.0 recorded, and `d470-catalog-census.test.mjs` went RED at A3 naming the
   exact remedy it is written to name. This is the failure mode the note above
   describes — two different catalogs answering to one number — caught by the
   instrument instead of by a stranger reading a ratification, which is the whole
   reason the census exists. ADDITIVE on the same precedent: five checks arrive,
   none moves and none leaves.

   WHAT KEEPS IT TRUE (re-worded at 1.51.0, N469: the d470 suite this note named was
   deleted in T20): `ROW_CENSUS` below pins this string to a census of every refusal
   row (R50), and `bio-plane/test/system/row-census.test.mjs` holds that pin against
   the tree. Add, remove or change a row and that suite goes red naming it, and it
   stays red until this version moves and the census is re-pinned beside it. DO NOT
   edit this constant without reading that suite's header — the two are one mechanism.

   1.20.0 (REC-23/D-130): C-2.10's counterparty becomes a three-valued block.
   A MINOR bump on REC-14's precedent (1.18.0 -> 1.19.0 also made the catalog
   refuse documents that used to pass) — the catalog's own version records what
   judged a bundle, and every ratification stamps it, so an action refused here
   is distinguishable from one refused by 1.19.0 without reading this file. */
/* 1.22.0 (CONDUCT #20 at c20-batch18, 2026-09-24): D-484 added C-33.40 NO_BASIS and C-33.41
   NO_CITATION to ACT_SHAPE_CHECKS, so the catalogue moved 433 -> 435 checks and the stamp moves
   with it, MINOR and additive on this constant's own rule (Publication §3 rule 17). The d470
   census suite caught it on the c20-batch17 train (A3). */
/* 1.24.0 (D-507, 2026-09-24): the six STATEMENT_ACK_* refusals that reached a member untranslated
   became catalogued rows C-82.2..C-82.7 in STATEMENT_ACK_CHECKS, so the catalogue moved 447 -> 453
   checks and the stamp moves with it, MINOR and additive on this constant's own rule (Publication §3
   rule 17). Nothing that passed is refused by the move: the six conditions already refused, at the
   same six sites, under the same six `reason`s — what they gained is a row and a canned translation.
   The d470 census suite named the figures before this line moved. */
/* 1.24.0 (D-508, 2026-09-24): the doorbell's two rate refusals take catalogue rows — C-85.1 RATE_IP and
   C-85.2 RATE_GLOBAL in the new `KNOCK_CHECKS` family — so the catalogue moved 447 -> 449 checks and the
   stamp moves with it, MINOR and additive on this constant's own rule (Publication §3 rule 17). TWO
   ARRIVALS, NO DEPARTURES. D-507 adds six rows to `STATEMENT_ACK_CHECKS` in parallel and moves this same
   constant and the same census row; CONDUCT reconciles the number and RE-READS the census from the d470
   suite's own print on the merged tree, because neither branch's figure is the union's. */
/* 1.24.0 AT THE UNION (CONDUCT #20, c20-batch22): D-507 and D-508 each took 1.24.0 on its own branch for a DIFFERENT catalogue, and neither reached main. The union takes 1.24.0 ONCE for the catalogue that actually runs (447 + 6 + 2), census re-read from the d470 suite's own print on the merged tree; both branch rows are dropped. */
/* 1.24.0 (REC-211, 2026-09-24): IC-273 added C-33.42 NO_DEFINITION_VERSION and C-33.43
   DEFINITION_MOVED to ACT_SHAPE_CHECKS — op=proposedispose now binds the definition version the
   member SAW — so the catalogue grew by two and the stamp moves with it. MINOR and additive on this
   constant's own rule (Publication §3 rule 17): two checks arrive, none moves and none leaves. */
/* 1.25.0 AT THE SECOND UNION (CONDUCT #20, c20-batch23): REC-211 took 1.24.0 on its own branch for 447 + 2, but main's
   1.24.0 (c20-batch22) is already the D-507 + D-508 catalogue of 455 checks. REC-211's two rows are a DIFFERENT
   catalogue, so the union moves the stamp once more, MINOR: 455 + 2 = 457, figures re-read from the d470 suite's print. */
/* 1.29.0 (REC-217, 2026-09-24, branch land/worker/REC-217): C-44.3 PUBLISH_DRAFT_NOT_FOUND, C-44.4
   PUBLISH_DRAFT_NOT_THIS_CASE and C-44.5 PUBLISH_DRAFT_ALREADY_BOUND joined CASE_DERIVATION_CHECKS (op=publish's
   draft= link, BIO_Publication §3 rule 13), so the catalogue moved 461 -> 464 checks and the stamp moves with it,
   MINOR and additive on this constant's own rule (Publication §3 rule 17): three arrivals, none moves or leaves.
   The figures are the d470 suite's print on this branch; the integrator re-reads them on the union. */
/* D-448 (2026-09-24): 1.28.0 -> 1.29.0. C-87 REVIEW_COPY_CHECKS added eleven rows, so the catalogue
   census moved 461 -> 472 and the census arm (d470 A3/A5) forces the MINOR step. */
/* 1.29.0 (D-468, 2026-09-24): ONE arrival, C-26.12 BIAS_ILLEGAL_TRANSITION — `op=promote` holding a bias set to
   the declared STATES edges read from its head, which STATES.bias described and nothing enforced. MINOR: one
   arrival, no departures. THE FIGURE IS THE MERGED TREE'S: this item took 1.26.0 over origin/main 1a7f0bcc0 and
   then MERGED a main already at 1.28.0 (whose own 1.26.0 row is a different catalogue), so the stamp moves once
   more from the catalogue that actually runs and the census is RE-READ from d470-catalog-census.test.mjs's own
   print — never either base's figure plus one. THREE PLACES MOVED WITH THIS CONSTANT then, and the gate named each if
   one was missed: the census row in d470, that suite's (A5) literal, and ratify.test.mjs's gateVersion literal (both
   suites deleted in T20; since 1.43.0 it is `ROW_CENSUS` that moves with it, R50). */
/* 1.29.0 (REC-214, 2026-09-24, branch land/worker/REC-214): the new `RISK_TIER_REVISION_CHECKS` family (C-90.1..5) —
   `op=actionrisktier`'s four conditions and `promote`'s refusal of a revision that moves a tier or its history
   without the act — so the catalogue moved 461 -> 466 and the stamp moves with it, MINOR and additive on this
   constant's own rule (Publication §3 rule 17). FIVE ARRIVALS, NO DEPARTURES; C-32.19's row changed only its
   `where` (the region moved into `#machineRiskTierRefusal`), not its condition. The census is the d470 suite's own
   print. If another branch in the batch also takes 1.29.0, CONDUCT re-reads the union's census. */
/* 1.29.0 (D-450, 2026-09-25, branch land/worker/D-450): NO check added or removed — C-41.12 CHANGED. It
   admits `null` for a bar axis nobody set (Publication §3 rule 14), so a one-axis bar 1.28.0 refused now
   signs; rule 17 moves the stamp for a changed check. The d470 census row names it in `changed`. If
   another branch takes 1.29.0 first, CONDUCT takes the next number at the union. */
/* 1.29.0 (D-512, 2026-09-24, branch land/worker/D-512): C-66.6 REPLAY_UNVERIFIED joined SURFACE_CHECKS — `op=promote`
   honours `replay` only over a drive-provenance capture it verifies (BOB #33's step (2)). MINOR and additive: one check
   arrives, none moves and none leaves. CONDUCT reconciles the number at integration if another branch takes 1.29.0. */
/* 1.29.0 (D-454, 2026-09-25): ONE ARRIVAL, NO DEPARTURES — C-74.4 CONNECTION_CHOICE_OCCURRENCE_UNNAMED in
   CONNECTION_CHOICE_CHECKS (a reference read at several places names which one is on point). MINOR and additive
   on this constant's own rule. If another branch in the same batch also moves this constant, CONDUCT takes the next
   number and re-reads the census from the d470 suite's print on the merged tree. */
/* REC-150 side, kept as history — took 1.31.0 (REC-150, 2026-09-25, branch land/worker/REC-150): the C-95 family PROJECT_JOIN_REQUEST_CHECKS — §7.14's
   request to join, nine refusals (C-95.1..C-95.9) — so the catalogue moved 466 -> 475, NINE ARRIVALS, NO DEPARTURES,
   MINOR and additive. NOT 1.30.0: CONDUCT #21's c21-batch28 (integrated, not yet on main) already published a
   DIFFERENT catalogue under 1.30.0, and one version names one catalogue. Figures are the d470 suite's print on this
   item's tree over origin/main 964da679; the integrator takes the union's number once and re-reads it. */
/* D-520 side, kept as history — took 1.29.0 (D-520, 2026-09-25): C-83.8 RENDER_AT_CAPACITY joins RENDER_CAPTURE_CHECKS — a render over the concurrency
   cap WAITS (BOB #33) — so the catalogue moved 461 -> 462 checks and the stamp moves with it, MINOR and additive on
   this constant's own rule (Publication §3 rule 17): one check arrives, none moves and none leaves. Figures are the d470
   suite's own print on the item's tree over origin/main 8bdf20e6; CONDUCT reconciles the number at the union. */
/* REC-219 side, kept as history — took 1.30.0 (REC-219, 2026-09-25): C-41.14 and C-41.15 joined CASE_DOCUMENT_FAMILY — a `bio-case-document/4`
   must state the adoptions of its scope pinning a PROPOSED revision at signing, and its citation edges each with
   the version it rests on (BIO_Publication_v0_1.md §3 rule 18; D-579(a)) — so the catalogue moved 466 -> 468 checks, MINOR and additive on this constant's own rule: nothing that passed
   is refused, because /3, /2 and /1 documents are never asked the new question. Figures from the d470
   suite's own print; CONDUCT re-reads them on the union if another branch moves this constant too. */
/* REC-203 side, kept as history — took 1.30.0 (REC-203, 2026-09-25, branch land/worker/REC-203): THREE ARRIVALS, NO DEPARTURES — C-91.1
   IDSPACE_UNKNOWN, C-91.2 IDSPACE_VALUE_NOT_IN_SPACE and C-91.3 IDSPACE_CAPTURE_NOT_HELD, `op=idmatch`'s
   refusals in the new IDSPACE_CHECKS family. MINOR and additive on this constant's own rule; CONDUCT
   reconciles the number at integration if another branch takes 1.30.0 first. */
/* REC-186 side, kept as history — took 1.29.0 (REC-186, 2026-09-25): C-33.48 LAST_OWNER_CANNOT_LEAVE joined ACT_SHAPE_CHECKS — op=projectleave refuses a
   project's ONLY owner (BOB #31, 2026-09-23 21:37Z) — so the catalogue moved 461 -> 462 and the stamp moves with it,
   MINOR and additive (Publication §3 rule 17). (Renumbered C-33.47 -> C-33.48 at c22-rec186-renumber, REC-207 holding
   C-33.47.) The integrator takes the union's number once and re-reads the census from the d470 suite's print. */
/* 1.31.0 AT THE UNION (CONDUCT #22, c22-batch29 union, 2026-09-25): every branch above that took 1.29.0, 1.30.0 or 1.31.0
   over its own base rides ONE new number, and every such claim is superseded here (their comments kept as history).
   SIXTY-EIGHT ARRIVALS — C-33.48 (REC-186), C-41.14/.15 (REC-219), C-69.2 + C-98.1..8 (D-561), C-83.8 (D-520),
   C-86.3/.4 (D-563), C-91.1..3 (REC-203), C-92.1..12 (MK-7), C-93.1..7 (REC-147), C-94.1..11 (D-147), C-95.1..9
   (REC-150), C-96.1..9 (D-134), C-97.1/.2 (REC-197) — ONE DEPARTURE, C-82.1 (retired by D-521b, unreachable), and
   NINE CHANGED under an unmoved id (the d470 row's `changed`, rule 17 as BOB #35 folded it): C-2.8 and C-21.2
   (D-598), C-2.10 (D-147), C-41.1 and C-41.13 (REC-219), C-53.10..12 (MK-7), C-70.3 (REC-197). MINOR: the one
   departure refused nothing any input could reach. Count 569, digest d1e8a679…, source 832fbe02… — the d470
   suite's own print on the merged tree (HEAD ee29c763 + this commit), never 502 + 68 - 1. */
/* 1.32.0 (PROMOTION #1, T3, 2026-09-26; K64, K66): NO ARRIVALS, NO DEPARTURES FROM WHAT THE GATE RUNS — FOUR CHECKS
   CHANGED, AND MOVED. C-4.2, C-17.2, C-18.8 and C-20.1 left `bio-checks.mjs` for promotion (`src/promotion/history.mjs`,
   `release.mjs`), and this gate runs them after `checkBundle`, so a ratification is judged by the same set of checks.
   What changed: C-20.1 and C-17.2 walk the history in write order (`seq`, record-core R16) and say when an image
   carries none (R30); C-4.2 reads an undeclared edge in a document's own history as made under earlier rules only where
   the record's own history holds the same move at or before the state-edge fence (R32); C-18.8 verifies through
   `signatures.verifySshsig` (R31), which also admits a sha256-hashed SSHSIG. MINOR, rule 17 moving the stamp for
   changed checks. The catalogue's own census (`checkBundle` alone) lost these four ids; every suite that counts it
   pins the old figures and was legacy-tests' to re-read. */
/* 1.33.0 (PROMOTION #2, T4 layer 2, 2026-09-27; K118, entry T4-2b): SIX ARRIVALS, NO DEPARTURES, ONE CHANGED. LEGACY-CHECKS
   #1 (T4 layer 1, N44 and N36) added C-29.11 AI_CREDENTIAL_PRINCIPAL_NOT_THE_MINTER, C-29.12 AI_CREDENTIAL_ORG_NOT_ADMIN,
   C-96.10 RESIGN_AT_TWO, C-96.11 NO_HOLDERS, C-96.12 PAIRING_NOT_YOURS and C-33.49 ABSENT, and C-33.48 now carries the
   code its site mints, LAST_COMMITTED_OWNER (formerly LAST_OWNER_CANNOT_LEAVE, which nothing mints since REC-224), with
   its translation rewritten for both of membership's sites. MINOR, rule 17 moving the stamp for arrivals and a changed
   check. Census 566 -> 572, sha256 86ddf728…, behaviour source 1513f4a8…: the d470 suite's own print on this tree, whose
   re-pin was legacy-tests' (T4-5). */
/* 1.34.0 (PROMOTION #3, T5 layer 2, 2026-09-27; entry N86): NO ARRIVALS, FOUR DEPARTURES FROM THE CATALOGUE, NONE CHANGED
   BY THIS STEP. PROVENANCE #1 (T4 layer 3) moved C-18.1, C-18.3, C-18.4 and C-18.9 out of `bio-checks.mjs` into
   `provenance` after 1.33.0 was minted, so two catalogues answered to 1.33.0. A ratification is still judged by them:
   the plane runs them over the same image after this gate (`provenance.withRegisterChecks`, K72 (4)). MINOR, rule 17 moving the stamp for
   removed checks. Census 572 -> 568, sha256 4f93c5f6…, behaviour source 4fa025ac…: the d470 suite's own print on this
   tree, whose re-pin (A3, A9) was legacy-tests' (T5-12). */
/* 1.35.0 (PROMOTION #4, T5 layer 5, 2026-09-27; K150): NO ARRIVALS, FORTY-NINE DEPARTURES FROM THE CATALOGUE, NONE
   CHANGED BY THIS STEP. After 1.34.0 was minted, layer 4 and layer 5 jobs moved these rows out of `bio-checks.mjs` into
   their own modules (the file's diff 3ec9dbc533..508920f1c1, pure removals): CALIBRATION #1 C-42.1–C-42.7 (K136);
   EXTRACTION #1 C-51.1–C-51.5 (K135); ENTITIES #1 C-91.1–C-91.3; PROGRESSIONS #1 C-33.26, C-33.42, C-33.43 (K147);
   OBSERVATION-LOG #1 C-54.2–C-54.10 (K142); BIAS #1 C-26.1–C-26.11 and C-26.13–C-26.19 with `checkBiasExtension`
   (K146, K150; C-26.12 stays); RETRIEVAL #1 C-23.1, C-23.2, C-33.20, C-33.32. CONTENT #1 also moved the helpers `imagePageUndetermined`, `legContentId` and
   `mintUndetermined`, which carry no check id. `checkBundle` no longer runs `checkBiasExtension`: the plane is to wrap
   this gate with bias's `withBiasChecks` as with provenance's `withRegisterChecks` (legacy-index, T5-11, K146), so a
   ratification is judged by C-26.1–C-26.7 again once that lands. MINOR, rule 17 moving the stamp for removed
   checks, 1.34.0's precedent. Census 568 -> 519, sha256 e4d92a7e…, behaviour source 18a61872…: the d470 suite's own
   print on this tree, whose re-pin (A3) was legacy-tests' (T5-12). */
/* 1.36.0 (PROMOTION #5, T6 layer 2, 2026-09-27; LEGACY-CHECKS #2's REPORT 7, K163): THIRTY-ONE ARRIVALS, NO DEPARTURES,
   NONE CHANGED. LEGACY-CHECKS #2 (T6 layer 1) added C-22.17 AI_LOG_NEVER_LOOKED_STORED, C-28.17 CAPTURE_FETCH_FAILED,
   C-28.18 CAPTURE_REQUEST_NOT_RETRYABLE, C-81.11–C-81.14 (the theme withdrawal, carried word for word from connections),
   the new families REGISTRATION_CHECKS C-102.1–C-102.5, PROVENANCE_ACT_CHECKS C-103.1–C-103.7 and
   EXTRACT_PROPOSE_CHECKS C-104.1–C-104.12. It moved 71 `where`s, which name where a refusal is minted and change no
   check's condition, code or translation. MINOR, rule 17 moving the stamp for arrivals. Census 519 -> 550, sha256
   d35d735c…, behaviour source 66baec44…: the d470 suite's own print on this tree, whose re-pin (A3, A9) was
   legacy-tests' (T6-14). */
/* 1.37.0 (PROMOTION #6, T8 layer 2, 2026-09-28; N147): TWO ARRIVALS, FIFTY-NINE CHECKS NET DEPARTED, AND CHECKS CHANGED.
   After 1.36.0 was minted, T7's layer-6 and layer-7 jobs moved rows out of `bio-checks.mjs` into their own modules
   (citation's C-33.15–C-33.19, C-33.39 and C-45.7–C-45.10; strength's C-30, C-71 and C-32.9; ai-runs' rows; contradiction's
   C-93; reevaluation's C-10.1, C-80.1 and C-80.2; the others their records name), and T8's layer 1 (LEGACY-CHECKS #3, K229,
   K231) added C-102.6 FACT_MALFORMED and C-102.7 STEP_MODULE_UNNAMED, admitted six record types (`STD`, `CONF`, `CONS`,
   `ESC`, `ASP`, `GOAL`: C-2.5 and the state tables now pass documents they refused) and moved 91 `where`s. MINOR, rule 17
   moving the stamp for arrivals, departures and changed checks. Census 550 -> 491, sha256 42a9d0a3…, behaviour source
   17c6fd16…: the d470 suite's own print on this tree, whose re-pin (A3, A9) was legacy-tests' (N147's other share). Layer
   9's moves (actions' C-32 and C-94 rows, ratification's C-41) take the next number when they land. */
/* 1.38.0 (PROMOTION #7, T8 after layer 9, 2026-09-28; N147, K233, K253): NO ARRIVALS, NINETY-SIX DEPARTURES, THREE CHANGED.
   After 1.37.0 was minted, T8's layer-8 and layer-9 jobs moved rows out of `bio-checks.mjs` into their own modules (the
   file's diff a99312070e..d8a0601f3d, 1,523 lines, pure removals). Layer 8 (55): publication's C-44.2, C-68.5,
   C-92.1–C-92.9 and C-98.1–C-98.8; ratification's C-32.12–C-32.15, C-53.10–C-53.12, C-58.1–C-58.3, C-65.1 and
   C-92.10–C-92.12; case-authoring's C-44.1, C-44.3–C-44.5 and C-82.2–C-82.7; review's C-87.1–C-87.11 and C-32.16.
   Layer 9 (41), actions': C-11.1, C-32.3, C-32.4, C-32.18, C-32.19, C-33.3–C-33.9, C-72.1–C-72.8, C-73.1–C-73.5,
   C-90.1–C-90.5 and C-94.1–C-94.11. CHANGED under an unmoved id, arms that `checkBundle` no longer runs because their
   module runs them at its own registration: C-2.10 (the action arms, `checkActionExtension`, now actions'), C-6.1 (the
   `responds_to` arm, now actions') and C-2.8 (`checkPublishedExtension` over a case member's own bytes, now run by
   ratification's registered step; `checkCaseDocument`'s per-member arm stays). C-41.1–C-41.15 did NOT leave the file:
   ratification holds its own `CASE_DOCUMENT_FAMILY` and the file keeps its copy for `checkCaseDocument`, so the census
   still counts them. Outside the catalogue, and so outside this census, layer 9 added its modules' own families:
   standards C-112, conformance C-113, consequences C-114, filings C-115, escalation C-116 and actions C-117. MINOR,
   rule 17 moving the stamp for departures and changed checks. Census 491 -> 395, sha256 c22e2574…, behaviour source
   4108bfa4…: the d470 suite's own print on this tree, whose re-pin (A1's floors, A3, A5, A9) was legacy-tests'. */
/* 1.39.0 (PROMOTION #9, T9 layer 2, 2026-09-28; N240, K284): THREE ARRIVALS, ONE DEPARTURE, NONE CHANGED. After 1.38.0
   was minted, monitoring moved C-18.5's emission site out of `bio-checks.mjs` (N240: the census printed 394 under
   1.38.0, so R34 did not hold at T8's close), and T9's layer 1 (LEGACY-CHECKS #4, N206, N214) added C-102.8 STEP_DECLARED,
   C-102.9 CASE_CATALOGUE_FAILED and C-102.10 CASE_MEMBER_REFUSED and moved the `where`s of C-32.6 and C-33.14 (N212) and
   C-48.8 and C-48.9 (N226), which name where a refusal is minted and change no check's condition, code or translation.
   MINOR, rule 17 moving the stamp for arrivals and a departure. Census 395 -> 397, sha256 e1c688c5…, behaviour source
   9927c1ad…: the d470 suite's own print on this tree, whose re-pin (A3, A5, A9) was legacy-tests'. */
/* 1.40.0 (PROMOTION #10, T9 after layer 4, 2026-09-28; K233's pattern, K288): TWO ARRIVALS, NO DEPARTURES, TWO CHANGED,
   all in a module's own row table (R34, R47: rows are counted wherever they live). After 1.39.0 was minted (85493f73b5),
   capture-sources' job (CAPTURE-SOURCES #3, N189, K288) added C-105.10 CAPTURE_CREDENTIAL_SUPPLY_FAILED and C-105.11
   CAPTURE_CREDENTIAL_WITHDRAW_FAILED to `CAPTURE_CREDENTIAL_CHECKS`, taking from C-105.8 (NO_KEY) the failed encryption
   or store and from C-105.9 (NO_SUCH) the failed read or withdrawal they also answered: C-105.8 and C-105.9 now refuse
   one condition each, so they changed. Wording only, what is refused or admitted unmoved: C-105.1–C-105.11 gained their
   `where`s, C-105.6's and C-105.9's translations were lengthened, and C-105.7 is minted at one helper. Layers 3 and 4
   moved no other row: capture's, content's, extraction's, calibration's and provenance's listener registrations now
   refuse through membership's `listenerRefusal` (codes with no row yet, N202), content reads a rect's space through
   text-chain's `rectSpace` with C-45.13 refusing the same spaces, and `bio-checks.mjs` did not change. MINOR, rule 17
   moving the stamp for arrivals and changed checks. The d470 census, of the catalogue file only, is unmoved: 397,
   sha256 e1c688c5…, behaviour source 9927c1ad… (its own print on this tree), so its 1.40.0 row, legacy-tests' then, named
   `changed: ["C-105.8", "C-105.9"]` to stand apart from 1.39.0's (A4). */
/* 1.41.0 (PROMOTION #11, T11 layer 2, 2026-09-28; N281, K343, K233's pattern): THREE ARRIVALS, THREE DEPARTURES, TWO
   CHANGED, counted wherever the rows live (R34, R47). After 1.40.0 was minted (97cb7a30d2), T10's jobs moved these, and
   nothing re-stamped them. ARRIVED: C-53.14 REGISTER_BYTES_UNSTATED, provenance's `REGISTER_ENTRY_CHECKS` (its R50,
   N263); C-91.4 NO_SUCH_ENTITY, entities' `ENTITY_CHECKS` (its R36, N208); C-107.2 BAD_GRADE, strength's
   `STRENGTH_BAR_CHECKS` (N208, K275). DEPARTED, their ids retired: progressions' C-100.1 NO_KEY (answered now as the
   catalogue's generic code, with no row, K329), C-100.12 NO_SUCH_ENTITY (gives way to C-91.4) and C-100.23
   LISTENER_DECLARED (membership's `listenerRefusal`, its R81). CHANGED: C-22.17 AI_LOG_NEVER_LOOKED_STORED is now what
   observation-log's `checkObservation` answers a stored never-looked look, which C-22.1 answered until T10 (N118), so
   C-22.1 now refuses one condition and both changed. MOVED, NOT CHANGED: C-81.11–C-81.14 are held once, in the
   catalogue's `THEME_CHECKS`, and connections' second copy became a view of them (N125); C-22.7 stays in the
   catalogue until ai-runs holds its own copy (K350, N299), code, condition and translation unmoved. Wording only, what is refused or admitted unmoved: the `where`s of
   C-26.11, C-30.7, C-30.8, C-100.9, C-100.11, C-100.13–C-100.15, C-100.17, C-100.18 and inquiry's C-106 rows; the
   comments of C-22 and C-53 (N282, N286); and C-102.9, whose finding `caseCatalogueFailed` now builds the case gate's
   whole answer (N275), the same answer as before. MINOR, rule 17 moving the stamp for arrivals, departures and changed
   checks. The d470 census, of the catalogue file only, is unmoved (every arrival and departure is in a module's own
   table): 397, sha256 e1c688c5…, behaviour source 9927c1ad… (its own print on this tree after K350's restore), so its
   1.41.0 row, legacy-tests' then, named `changed: ["C-22.1", "C-22.17"]` to stand apart from 1.40.0's (A4); A3 and A5 were
   that re-pin's. */
/* 1.42.0 (PROMOTION #12, T12 layer 2, 2026-09-29; N302, K369, K381): EIGHT ARRIVALS, FOUR DEPARTURES, ONE CHANGED,
   counted wherever the rows live (R34, R47). After 1.41.0 was minted (7702929d29), T11's layer 6–9 jobs and T12's layer
   1 moved these, and nothing re-stamped them; read from each table as merged on `tranche/T12`. ARRIVED: C-22.18
   AI_RUN_STATE_TOO_LARGE, ai-runs' `AI_RUN_CHECKS`; C-112.11 STANDARD_NO_ID, standards'; C-113.22 NO_REASON,
   conformance's; C-117.2 NO_SUCH_ACTION, C-117.3 ACTION_TOO_LARGE, C-117.4 ACTION_MOVE_NO_REASON, C-117.5
   PENDING_CLOCKS_BAD_BEFORE and C-117.6 ACTION_NO_DETERMINATION, actions'. DEPARTED, their ids retired: conformance's
   C-113.2 and intent's C-111.2 (NO_SUCH_PROJECT, answered through membership's C-70.5), filings' C-115.2 and
   escalation's C-116.11 (NO_SUCH_ACTION, answered through actions' C-117.2). CHANGED: C-113.17 BAD_REASON, which also
   answered an absent supersession reason until C-113.22 took it, now refuses one condition. MOVED, NOT CHANGED: C-22.7
   AI_RUN_SKILL_VERSION_UNNAMED left the catalogue's `AI_RUN_CHECKS` (N299, K381) and is held once, its `where` naming
   `checkSkillVersion` (in `src/run-rules/skill-version.mjs` since T19, K882); code, condition and translation unmoved. Wording
   only, what is refused or admitted unmoved: the `where`s of C-73.6, C-90.2, C-113.12, case-authoring's C-44.1 and
   C-44.3–C-44.5, and consequences' C-114.1, C-114.3 and C-114.12–C-114.17; the translations of C-73.3 (the levels named
   from `LAW_LEVELS`), C-113.17, C-114.3, C-114.10, C-114.12 and C-114.17. MINOR, rule 17 moving the stamp for
   arrivals, departures and a changed check. T12's later row changes (N306, K380) are the next number's (N318). The
   d470 census, of the catalogue file only, moved with C-22.7's copy: 397 -> 396, sha256 de54b8bd…, behaviour source
   8ada0f4c… (its own print on this tree); its 1.42.0 row, and A3, A5 and A9, were legacy-tests' re-pin. */
/* 1.43.0 (PROMOTION #14, T13 layer 2, 2026-09-29; N318, N319, K425, K431): EVERY ROW CHANGE SINCE 1.42.0, counted
   wherever the rows live (R34, R47), read by diffing every row table between f955769afc (1.42.0's stamp) and
   `tranche/T13` after record-core and membership merged (build/plan/t13-stamp-list.md, checked row by row).
   ARRIVED: C-33.50 NO_PROJECT_SCOPE (queue); C-51.6 NO_SHA (extraction); C-59.6 MINT_EXHAUSTED (record-core's R62, N322);
   C-69.3 PLANE_INTERNAL_ERROR (control-plane); C-87.12 MINT_EXHAUSTED (review, N306; it retired into C-59.6 later in
   T13, K434, and 1.44.0 stamps its departure); C-91.5 NO_ENTITY, C-91.6 ENTITY_NO_LABEL (entities); C-96.13 EXPERTISE_NO_LABEL (membership, missed by 1.42.0,
   K382); C-113.23 DETERMINATION_SUPERSEDED (conformance); C-118.1 NOT_FOUND, C-118.2 NO_SUCH_KNOCK (capture); C-119.1
   PROFILES_NOT_ADMIN, C-119.2 NOT_A_LIST, C-119.3 UNKNOWN_PROFILE, C-119.4 PROFILE_IS_TEST (instance-setup).
   DEPARTED, their ids retired: C-100.9, C-100.19 (progressions); C-111.5 (intent); C-113.9, C-113.18 (conformance);
   C-114.1 (consequences); C-116.3, C-116.4 (escalation).
   RENAMED under an unmoved id: C-100.2 PROGRESSION_NO_LABEL, C-100.8 PROGRESSION_VERSION_NOT_HELD; C-113.3
   DETERMINATION_NOT_A_PARTICIPANT, C-113.20 NO_SUCH_COMPARISON; C-114.2 CONSEQUENCE_NOT_NONCOMPLIANT (its translation
   too), C-114.3 CONSEQUENCE_NOT_A_PARTICIPANT; C-116.6 ESCALATION_NOT_A_PARTICIPANT, C-116.30 EDGE_NOT_PROPOSED.
   MOVED out of the catalogue into their module's table, condition and code unmoved, `where` following the site: queue's
   eight (C-31.1–C-31.3, C-32.10, C-32.11, C-33.27, C-33.44, C-76.1; C-33.44's translation also reworded); instance-setup's
   five (C-64.2, C-64.3, C-64.5–C-64.7); control-plane's twenty-four (C-29.6–C-29.10, C-32.17, C-38.1–C-38.8, C-64.4,
   C-66.6, C-68.2–C-68.4, C-69.1, C-69.2, C-78.1–C-78.3). HELD TWICE: C-96.1 NOT_AN_ADMIN, now also in membership's table
   (N324, `notAnAdmin`), its catalogue copy kept one tranche (K408 (4)), same code and translation.
   Wording only: the `where`s of C-100.20 (and its translation), C-112.10 and C-113.15.
   MINOR, rule 17 moving the stamp for arrivals, departures, renames and moves. ROW_CENSUS (R50, K431) is pinned to this
   tree: 820 rows. Rows changed after this stamp in T13 (review's C-87.12, retired in T13 (K434); control-plane's C-69.4)
   were named `awaiting stamp` by their jobs' records, and 1.44.0 stamps both. */
/* 1.44.0 (PROMOTION #15, T14 layer 2, 2026-09-29; N318, N341, N350, K425): EVERY ROW CHANGE SINCE 1.43.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T14` after record-core and membership
   merged against 1.43.0's own (`test/fixtures/row-census-1.43.0.jsonl`): nine arrivals, two departures, nothing else.
   ARRIVED: C-69.4 STORE_INTERNAL_ERROR (control-plane, T13, awaiting this stamp, K442); C-102.13 COUNTS_DECLARED and
   C-102.14 COUNTS_MALFORMED (record-core's R63, N342); C-102.11 LISTENER_MALFORMED and C-102.12 LISTENER_DECLARED
   (membership's R81, N128: the codes its `listenerRefusal` minted with no row now carry one); C-56.3 NOT_A_PARTICIPANT,
   C-56.4 TARGET_NOT_A_PARTICIPANT, C-56.5 TARGET_NOT_JOINED and C-96.14 NOT_PROPOSED (membership, N335: codes minted
   on other modules' rows now hold their own, and promotion's fork answers NOT_A_PARTICIPANT through membership's
   `notAParticipant`, R43).
   DEPARTED: C-87.12 MINT_EXHAUSTED (review, retired into record-core's C-59.6 in T13, K434, awaiting this stamp; the
   number is not reused); C-96.1's catalogue copy in `CUSTODIAL_CHECKS` (legacy-checks, K408 (4)): C-96.1 NOT_AN_ADMIN
   is now held once, membership's row, its line unmoved, so the census no longer counts it twice.
   CHANGED IN WHAT THE GATE RUNS, no row moving: `checkBundle` no longer runs C-19.1's inbox grammar (legacy-checks,
   N325's share); queue takes it at its own registration. Retired with no row: the catalogue's empty
   `CASE_DERIVATION_CHECKS` and `ATTRIBUTION_CHECKS` exports (N212, N214, N251).
   MINOR, rule 17 moving the stamp for arrivals, departures and a changed composition. ROW_CENSUS (R50) is re-pinned to
   this tree as R50 now words it (N350: lines sort by check, then code, then by the line itself; every fleet member's
   `scripts/` left out): 827 rows. The d470 census, of the catalogue file only, moved
   with legacy-checks' removal (359 -> 358); its 1.44.0 row was legacy-tests' re-pin. */
/* 1.45.0 (PROMOTION #16, T15 layer 2, 2026-09-30; N318, K425, K482): EVERY ROW CHANGE SINCE 1.44.0, counted wherever
   the rows live (R34, R47), read by diffing R50's census lines of `tranche/T15` after its layer 1 merged against
   1.44.0's own (`test/fixtures/row-census-1.44.0.jsonl`): two arrivals, four departures, nothing else. Each is one a
   job record names (T14's layers 3+ `awaiting stamp`; T15's layer 1).
   ARRIVED: C-118.1 EVIDENCE_NOT_HELD (capture, N347: C-118.1 re-keyed from NOT_FOUND, its `where` and translation
   unmoved); C-19.2 INBOX_REFUSED (queue's `QUEUE_INBOX_CHECKS`, N325).
   DEPARTED, their ids retired: C-118.1 NOT_FOUND (the re-key's old key); C-26.20 BIAS_ADOPTION_NOT_AN_ADMINISTRATOR
   (bias, N327) and C-111.16 GROUP_ASPIRATION_NOT_ADMIN (intent, N327), both answered now through membership's
   NOT_AN_ADMIN; C-29.12 AI_CREDENTIAL_ORG_NOT_ADMIN (legacy-checks, N327's remainder: nothing mints it since
   MEMBERSHIP #7; its mention in 1.33.0's note above is history).
   CHANGED IN WHAT THE GATE RUNS, no row moving: the promote gate gains queue's registered step (N325, K462, K464):
   C-19.1's inbox grammar judged at the write, a failure refused C-19.2. The catalogue's own copy of `checkInboxGrammar`
   is gone (legacy-checks, N325's remainder); `checkBundle` stopped running it in 1.44.0, so its composition is unmoved.
   MINOR, rule 17 moving the stamp for arrivals, departures and a changed composition. ROW_CENSUS (R50) is re-pinned to
   this tree: 825 rows. T15's layer-2 entries name no row (membership's `hiddenBundles`, N352). Rows T15's layers
   3+ change are T16's stamp (`awaiting stamp`). The d470 census, of the catalogue file only, moved with legacy-checks'
   removals (358 -> 356, sha256 968acdfb…, behaviour source b7d4112b…, its own print on this tree); its 1.45.0 row was
   legacy-tests' re-pin. */
/* 1.46.0 (PROMOTION #17, T16 layer 2, 2026-09-30; N318, K425, K483): EVERY ROW CHANGE SINCE 1.45.0, counted wherever
   the rows live (R34, R47), read by diffing R50's census lines of `tranche/T16` after membership merged (d5efecdc39)
   against 1.45.0's own (`test/fixtures/row-census-1.45.0.jsonl`): fifty-two arrivals, three changed, no departures. Each is
   one a job record names (T15's layers 3+ `awaiting stamp`; T16's layer 2).
   ARRIVED: C-91.7 NO_SUCH_RESOLUTION (entities, N345); C-2.11–C-2.17 in `INQUIRY_CONTRADICTION_CHECKS` (inquiry, N345);
   C-60.2 CANDIDATES_NO_SUBJECT, C-60.3 TENSIONS_TOO_MANY and C-93.8–C-93.39 (contradiction, N345; 34 rows); C-120.1–C-120.3
   in `CASE_DISCLOSURE_CHECKS` (case-authoring, N345); C-113.24–C-113.28 (conformance, N345; C-113.28 STANDARD_SIDE_UNNAMED
   by K503); C-96.15 SIGNER_KEY_HELD_BY_ANOTHER and C-96.16 SIGNER_KEY_REVOKED (membership, N364, K535).
   CHANGED, `where` only: C-93.1, C-93.2, C-93.3 now name `#runRefusals`, the one site `propose` and `recommend` share;
   code, condition and translation unmoved.
   CHANGED IN WHAT THE GATES RUN, no row moving: the promote gate gains contradiction's registered step (its R38), and
   inquiry's step now also runs R47's arm and C-2.17; the case gate runs only the catalogue a later module registers
   (ratification's), and with none answers C-102.9 (N361's share, K529), where it used to fall back to the catalogue's
   own `checkCaseDocument`. T16's layer 1 (legacy-checks, N361) moved no row.
   MINOR, rule 17 moving the stamp for arrivals and a changed composition. ROW_CENSUS (R50) is re-pinned to this tree:
   877 rows. Rows T16's layers 3+ change are T17's stamp (`awaiting stamp`). The d470 census, of the catalogue file
   only, is unmoved (356, sha256 968acdfb…; `bio-checks.mjs` did not change), so its 1.46.0 row, legacy-tests' then, named
   what changed to stand apart from 1.45.0's (A4). */
/* 1.47.0 (PROMOTION #18, T17 layer 2, 2026-09-30; N318, K425, K575, K577): EVERY ROW CHANGE SINCE 1.46.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T17` after membership and record-core
   merged (16eaac937e) against 1.46.0's own (`test/fixtures/row-census-1.46.0.jsonl`): seventeen arrivals, fifteen
   departures, eleven changed. Each is one a job record names (T16's layers 3+ `awaiting stamp`; T17's layers 1 and 2).
   ARRIVED: C-118.3 KNOCKER_SECRET_WEAK, C-118.4 KNOCK_DISCARDED, C-118.5 NOT_THE_CAPTURING_ACTOR, C-118.6 ACCOUNT_NO_TEXT
   (capture, N364); C-121.1–C-121.6 in `SOURCES_CHECKS` (sources, N364); C-122.1 SOURCE_CONSENT_WITHDRAWN in a new family
   `CASE_SOURCES_CHECKS` (publication, K554); C-120.4–C-120.7 in `CASE_DISCLOSURE_CHECKS`, now "a case's disclosures and
   its pre-flight", C-120.7 giving UNCLEARED_HUNCH its first row (case-authoring); C-2.18 CONTRADICTION_ARM_FAILED
   (inquiry, K543); C-96.17 MACHINE_CANNOT_REGISTER_KEY (membership, N387, K577).
   DEPARTED: C-41.1–C-41.15, the catalogue's copy of `CASE_DOCUMENT_FAMILY` (legacy-checks, N372, K529); ratification's
   copy, its lines identical, is now the only one, so each line is counted once where it was counted twice. With it
   the catalogue's `checkCaseDocument` left, and its C-21.1 arm and the case-document arms of C-2.8 and C-3.1 with it;
   the case gate has run only ratification's registered catalogue since 1.46.0, so what judges a case is unmoved.
   CHANGED: C-2.15's translation (inquiry, K543); the `where` of C-19.2, C-32.10, C-32.11 and C-76.1, now in
   `src/tasks/` with queue's copies retired (tasks, queue, K562); the `where` of C-32.13, C-32.15, C-53.12, C-65.1, C-92.10
   and C-92.11, now `src/ratification/refusals.mjs`, the last two with their regions split and renamed
   `is-attribution-unchosen` and `is-attribution-stale` (ratification, K555). Code and condition unmoved in each.
   CHANGED IN WHAT THE GATES RUN, no row moving: the promote gate's registered step for the inbox grammar (C-19.1, a
   failure refused C-19.2) is tasks' now, queue's retired; record-core's audit likewise runs tasks' registration (K531).
   Record-core's N376 moved no row (K577). MINOR, rule 17 moving the stamp for arrivals, departures, changed checks and
   a changed composition. ROW_CENSUS (R50) is re-pinned to this tree: 879 rows. Rows T17's layers 3+ change are T18's
   stamp (`awaiting stamp`). The d470 census, of the catalogue file only, moved with N372 (356 -> 340, sha256
   c56ccc26…, behaviour source 15465533…, its own print on this tree); its 1.47.0 row was legacy-tests' re-pin. */
/* 1.48.0 (PROMOTION #19, T18 layer 2, 2026-09-30; N318, K425, K636, K644, K650): EVERY ROW CHANGE SINCE 1.47.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T18` after record-core and membership
   merged against 1.47.0's own (`test/fixtures/row-census-1.47.0.jsonl`): eight arrivals, one row now held twice, three
   changed. Each is one a job record names (T17's layers 3+ `awaiting stamp`; T18's layers 1 and 2).
   ARRIVED: C-102.15 GRAMMAR_DECLARED, C-102.16 GRAMMAR_MALFORMED (record-core R67, the grammar seam), C-102.17
   STATS_SOURCE_DECLARED, C-102.18 STATS_SOURCE_MALFORMED (record-core R65); C-102.1 AUDIT_CHECK_DECLARED, C-102.2
   AUDIT_CHECK_MALFORMED and C-102.3 AUDIT_CHECK_FAILED copied into record-core's `RECORD_CORE_CHECKS` with `where`s
   naming their DEC-49 regions (the catalogue's `REGISTRATION_CHECKS` copies, their lines unmoved, stay for T19, so each
   is counted twice, as two row objects are).
   HELD TWICE, line unchanged: C-59.5 ALLOCID_PREFIX_GATED, copied into `RECORD_CORE_CHECKS` beside the catalogue's
   `PROJECT_ID_CHECKS` row (T19 deletes the catalogue's).
   CHANGED: C-76.1's key, `NOT_YOURS` departed and `TASK_NOT_YOURS` arrived, its line otherwise unchanged (tasks, N382,
   K606); the `where`s of C-120.1 and C-120.2, now `#tensionsJudged` (case-authoring, K616). Code and condition unmoved.
   MOVED, NOT CHANGED, each line byte-identical where it now lives: C-35.1–C-35.14 `TEXT_CHAIN_CHECKS` into
   `src/textchain.mjs` (text-chain); C-75.1–C-75.5 `PER_ITEM_CHECKS` into `src/record-core/checks.mjs` (record-core);
   C-86.1–C-86.4 `PROMOTED_TYPE_CHECKS` and C-97.1–C-97.2 `PROJECT_CREATION_VISIBILITY_CHECKS` into
   `src/promotion/checks.mjs` (this job), each catalogue copy deleted; C-77's corpus check with `projectNameKey`,
   `withProducingGroup` and a copy of `MECHANICAL_FIELD_SETS` into promotion, none a row.
   CHANGED IN WHAT THE GATES RUN, no row moving: `checkBundle` runs the type grammars later modules register with
   record-core in their arms' places (legacy-checks' §1b seam), and the promote gate and the audit pass the one list
   (`record.grammars()`), a throwing grammar one error on the bundle at both; none is registered at this stamp, so no
   bundle's findings move. C-2.5 admits a schema stamp whose type holds `_` (`^[a-z][a-z_]*@\d+$`, for `action_plan@1`),
   and N-A1 added `PLN`/`action_plan` to the id and type vocabularies (legacy-checks, record-grammar); record-grammar's
   moved grammar answers some malformed inputs differently (its record: a lone quote, a `__proto__` key and an indented
   inherited name read as C-2.1; inherited names in `normalizeType`). Removed exports with no row: `LAW_LEVELS`,
   `CASE_MEMBER_ROLES`.
   MINOR, rule 17 moving the stamp for arrivals, changed checks and a changed composition. ROW_CENSUS (R50) is re-pinned
   to this tree: 887 rows. Rows T18's layers 3+ change are T19's stamp (`awaiting stamp`). The d470 census, of the
   catalogue file only, moved with the removals (text-chain's, record-core's, this job's) and was legacy-tests' re-pin. */
/* 1.49.0 (PROMOTION #20, T19 layer 2, 2026-10-01; rule 7, K425, K785, K791): EVERY ROW CHANGE SINCE 1.48.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T19` after record-core, credentials
   and membership's deletion merged against 1.48.0's own (reproduced at d75700d9c9: 887 rows, bfda481e…): ninety-seven
   arrivals, no departures, sixty-four changed, sixty-five rows now held twice and three held once again. Each is one a
   job record names (T18's layers 3–11 `awaiting stamp`; T19's layers 1 and 2).
   ARRIVED: C-18.10 GATHERING_REFUSED (monitoring, K717); C-109.2–C-109.7 (run-rules); C-115.28–C-115.40 (filings);
   C-116.45 ACTION_PREMISE_OVERRIDDEN (escalation); C-117.7–C-117.19 (actions); C-123.1–C-123.3 (action-clocks);
   C-124.1–C-124.57 (action-plans, K711); C-96.18 ENROL_NOT_RECORDED (membership, K778); C-102.19 MINT_SEED_DECLARED,
   C-102.20 MINT_SEED_MALFORMED (record-core R70).
   CHANGED, code and condition unmoved: the `where`s of C-22.5, C-22.7, C-22.8, C-22.11–C-22.16, C-22.18 (run-rules),
   C-28.13 (acquisition), C-29.1–C-29.11 (credentials, K779), C-32.1 and C-33.10–C-33.12 (ratification, RATIFICATION #9),
   C-32.17, C-38.1–C-38.8, C-61.1, C-64.4, C-78.1–C-78.3 (control-plane, K737), C-33.41 (record-grammar, N430, K765),
   C-44.2 and C-98.8 (publication, public-read, K697), C-48.1–C-48.7 and C-83.1–C-83.8 (acquisition), C-115.3 and
   C-115.9 (filings); the translations of C-33.3, C-101.3 and C-101.4 (actions).
   HELD TWICE, each a copy made for a reader that re-points later in T19 (rule 1), its line unchanged unless named:
   observation-log's C-22.1–.4, .6, .9, .10, .17; capture-requests' C-28.1–.4, .6–.11, .14–.18 and acquisition's C-28.13;
   ratification's C-32.1, C-33.10–.12 and case-authoring's C-32.6, C-33.14 (those `where`s re-pointed in the copies);
   entities' C-33.25; content's C-80.3; actions' C-117.5 (its copy's line differs); membership's families (C-33.28,
   C-33.48, C-55.1, C-56.1, C-56.2, C-57.1, C-70.1–.4, C-95.1–.9, C-96.2–.12) and credentials' C-63.1, C-63.2,
   C-96.15–.17 and C-96.8 (three copies; credentials' lines name its sites); this job's C-26.12 and C-64.1 (the copy
   names `#promote > is-group-undetermined`, N44).
   HELD ONCE AGAIN: C-102.1–C-102.3 and C-59.5, the catalogue's duplicates of record-core's rows, removed (K783).
   MOVED, NOT CHANGED, each line byte-identical where it now lives: into promotion C-33.21, C-33.24, C-33.38, C-33.49,
   C-67.1, C-32.5, C-59.1–C-59.4, C-102.4–C-102.9 (this job); C-102.10 into ratification; C-63 and C-96.15–.17 into
   credentials (K774).
   CHANGED IN WHAT THE GATES RUN, no row moving: C-18.6/.7 is promotion's registered grammar (R55, K773) and left
   `LEGACY_GRAMMARS`; `checkBundle` is record-grammar's, and the catalogue's remaining arms (C-6.1, C-15.1, C-2.8,
   C-2.9/C-9.1, C-2.7's held copy) reach the gate and the audit only through record-core's legacy registration, which the
   composition root makes (K775, K785), so the module-level `runGate` with no grammars runs the structural arms alone.
   MINOR, rule 17 moving the stamp for arrivals, changed checks and a changed composition. ROW_CENSUS (R50) is re-pinned
   to this tree: 1051 rows. The `tools/` files a module's `paths` hold since K771 run when imported and hold no row
   literal, so the census reads them as R50's scripts are read (text only): the figures are unmoved by it. Rows T19's
   layers 3–11 change are T20's stamp (`awaiting stamp`). */
/* 1.50.0 (PROMOTION #21, T20 layer 2, 2026-10-01; K792, K871, K881): EVERY ROW CHANGE SINCE 1.49.0, counted wherever
   the rows live (R34, R47), read by diffing R50's census lines of `tranche/T20` after membership merged (K881) against
   1.49.0's own (reproduced at d93286c6ad: 1051 rows, c7e4b82c…): six re-keyed, twenty-nine changed, sixty-five rows held
   twice now held once, no other arrival or departure. Each is one a job record names (T19's layers 3–11 `awaiting
   stamp`; T20's layers 1–2, which changed no row: membership's deletion of its credential copies took no row object).
   RE-KEYED, number, `where` and translation unmoved (the old code departed, the new arrived): C-111.4
   INTENT_NO_SUCH_PROGRESSION, C-111.6 INTENT_BAD_STAGE, C-111.13 INTENT_NO_REASON (intent, K823); C-113.17
   CONFORMANCE_BAD_REASON, C-113.22 CONFORMANCE_NO_REASON (conformance, N433); C-116.24 ESCALATION_NO_REASON (escalation,
   N433).
   CHANGED, `where` only, code, condition and translation unmoved: C-25.1–.10, .12–.15, .19 and C-27.15 (basis-versions'
   grammar); C-45.1–.4, .11, .12 (content, K801); C-54.1 (inquiry-grammar); C-66.5 (inquiry, its own step); C-68.1
   (acquisition, K794, K796); C-73.6 (action-grammar); C-81.1 (connections); C-117.11 (actions' `contactNotAMember`, K837);
   C-123.2 (action-clocks' `reminderRefused`).
   HELD ONCE AGAIN, each line unchanged, the catalogue's copies gone with the file (T19's close, K858): observation-log's
   C-22.1–.4, .6, .9, .10, .17; capture-requests' C-28.1–.4, .6–.11, .14–.18 and acquisition's C-28.13; ratification's
   C-32.1, C-33.10–.12 and case-authoring's C-32.6, C-33.14; entities' C-33.25; content's C-80.3; action-clocks' C-117.5;
   membership's C-33.28, C-33.48, C-55.1, C-56.1, C-56.2, C-57.1, C-70.1–.4, C-95.1–.9, C-96.2–.12 (C-96.8 still held
   twice, membership's and credentials'); this module's C-26.12 and C-64.1.
   MOVED, NOT CHANGED, each line byte-identical where it now lives: public-read's C-44.2, C-68.5, C-98.1–.9; action-grammar's
   rows from actions.
   CHANGED IN WHAT THE GATES RUN, no row moving: the arms 1.49.0 named as reaching the gate and the audit through
   record-core's legacy registration (C-6.1, C-15.1, C-2.8; C-2.9/C-9.1; C-2.7) are registered by their owners
   (inquiry-grammar, intent, capture), each moved line for line, so what judges a bundle is unmoved.
   MINOR, rule 17 moving the stamp for re-keyed and changed rows and a changed composition. ROW_CENSUS (R50) is re-pinned
   to this tree, module tables only, the catalogue being gone: 986 rows. Rows T20's layers 3–11 change are T21's stamp
   (`awaiting stamp`). */
/* 1.51.0 (PROMOTION #22, T21 layer 2, 2026-10-01; K792, K904, K942, K944, K946): EVERY ROW CHANGE SINCE 1.50.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T21` after record-core and membership
   merged (3e16dc612d) against 1.50.0's own (`test/fixtures/row-census-1.50.0.jsonl`: 986 rows, dd61926a…): four arrivals,
   one changed, six rows held twice now held once, no other departure. Each is one a job record names (T20's layers 3–11
   `awaiting stamp`; T21's layers 1–2).
   ARRIVED: C-117.20 MACHINE_CANNOT_SET_HOLD, C-117.21 HOLD_REFUSED, C-117.22 HOLD_NO_LEGAL_MARK (action-grammar, K899 (7),
   K912); C-86.15 PROJECT_STAGE_COMPUTED (this module, R56, N456 in Bob's form (b), K904).
   CHANGED, `where` only, code, condition and translation unmoved: C-68.1 (acquisition's `evidenceStorageAbsent`, K887;
   control-plane's door now answers through it, its own region gone, K920).
   HELD ONCE AGAIN, each line unchanged where it stays: C-63.1, C-63.2, C-96.8, C-96.15, C-96.16, C-96.17, membership's
   copies deleted (N453, K946); credentials' rows, naming its sites, are the only ones.
   CHANGED IN WHAT THE GATES RUN, no row moving: the project's state machine (record-grammar R35, K930): legal `forming`
   `closed`, `investigating` and `matured` legacy (read, never a destination), edges to `closed` only and `closed` ->
   `forming`, so C-4.1 and the promote fence (R15) refuse the hand-written stage moves; C-6.3's `workproduct_state` arm
   retired and the `checkProjectExtension` slot's ids `['C-2.9']` (record-grammar, K930); intent's C-2.9 arms over
   `workproduct_state` and `evaluations` and C-9.1 retired (K907); C-13.2's and C-16.1's messages say "record"
   (record-grammar, N458); promote refuses a project created at another stage than `forming` or `closed`, replay included
   (R56, K942), and C-4.2 reads the retired project moves recorded at or before 2026-10-01 as made under earlier rules
   (`STATE_MOVE_FENCED_SINCE.project`). The promote step moved from plane's held copy to control-plane's `promotionStep`,
   the same check and projection (K920). Jurisdictions' codes are not rows. Record-core's T21 job changed no row.
   MINOR, rule 17 moving the stamp for arrivals, a changed row, departures of duplicates and a changed composition.
   ROW_CENSUS (R50) is re-pinned to this tree, module tables only: 984 rows. Rows T21's layers 3–11 change are T22's
   stamp (`awaiting stamp`). */
/* 1.52.0 (PROMOTION #23, T22 layer 2, 2026-10-01; K952, K979, K989, K991, K992, K1006): EVERY ROW CHANGE SINCE 1.51.0,
   counted wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T22` after membership merged
   against 1.51.0's own (`test/fixtures/row-census-1.51.0.jsonl`: 984 rows, b7c43a32…): forty new rows, two re-keyed,
   two retired (forty-two lines arrived, four departed) and eleven changed. Each is one a job record names (T21's layers 3–11 `awaiting stamp`; T22's layers 1–2 changed no row).
   ARRIVED: C-115.41 TEMPLATE_USE_BRIEF, C-115.42 TEMPLATE_USE_FILE, C-115.43 TEMPLATE_AND_TEXT (filings, K992); C-125.1–
   C-125.32 in `FILING_TEMPLATE_CHECKS` (filing-templates, K991); C-126.1–C-126.5 (local-facts, K989).
   RE-KEYED, each moved into filing-templates' table and re-worded (the old code departed, the new arrived): C-115.31
   MACHINE_CANNOT_DRAFT_TEMPLATE (was MACHINE_CANNOT_SAVE_TEMPLATE), C-115.36 TEMPLATE_TIER3_FILE (was
   TEMPLATE_KIND_TIER3) (filing-templates, K991).
   DEPARTED, their ids retired and never reused: C-115.6 KIND_NO_TEMPLATE, C-115.17 NOT_TIER3 (filings, K992).
   CHANGED: MOVED into filing-templates' table, `where` re-pointed, code unmoved: C-115.32, C-115.35, C-115.37, C-115.38,
   and C-115.33 TEMPLATE_KIND_REFUSED re-worded too (a kind is now required) (K991); filings' own: C-115.12
   TEXT_UNWRITABLE (`where` and translation), C-115.39 TEMPLATE_KIND_MISMATCH (`where` and translation), C-115.40
   TEMPLATE_NOT_NAMED (`where` and translation), C-115.34 TEMPLATE_FROM_UNAPPROVED (translation), C-115.19
   NO_DETERMINATION (`where` only) (K992); provenance's C-53.13 CAPTURE_HELD_BY_ANOTHER_BUNDLE (translation, N458, K952).
   CHANGED IN WHAT THE GATES RUN, no row moving: intent's registered grammar claims the ids `["C-2.9"]` (a composition,
   K979). Membership's T22 job (N478, N480) changed no row; the `legacy-tests` it dropped from `MODULE_ORDER` registered
   no step, so the order the gates run in is unmoved.
   MINOR, rule 17 moving the stamp for arrivals, departures, re-keyed and changed rows and a changed composition.
   ROW_CENSUS (R50) is re-pinned to this tree, module tables only: 1022 rows. The census suite is this module's since
   T22's opening (K1006). Rows T22's layers 3–11 change are T23's stamp (`awaiting stamp`). */
/* 1.53.0 (PROMOTION #24, T23 layer 2, 2026-10-02; K1094, K1123, K1124): EVERY ROW CHANGE SINCE 1.52.0, counted wherever
   the rows live (R34, R47), read by diffing R50's census lines of `tranche/T23` after membership and record-core merged
   against 1.52.0's own (`test/fixtures/row-census-1.52.0.jsonl`: 1022 rows, de396d62…): twenty-five arrivals, ten
   changed, no departure. Each is one a job record names (T22's layers 3–11 `awaiting stamp`; T23's layers 1–2 changed
   no row).
   ARRIVED: C-18.11 MACHINE_CANNOT_SET_FREQUENCY, C-18.12 NO_SUCH_ADDRESS, C-18.13 BAD_FREQUENCY, C-18.14
   NOT_A_SOURCE_OWNER, C-18.15 FREQUENCY_NO_REASON in `FREQUENCY_CHECKS` (monitoring R52, K1019); C-26.21
   BIAS_ADOPTION_NO_REASON (bias); C-33.51 QUEUE_SORT_UNKNOWN (queue); C-41.16 WHAT_CHANGED in `CASE_DOCUMENT_FAMILY`,
   C-58.4 CONTESTED_IN_BATCH, C-58.5 ANONYMOUS_TESTIMONY_UNCORROBORATED (ratification); C-52.10 ATTEST_NO_NOTE (content);
   C-54.11 LEAD_LOOK_NO_DETAIL, C-54.12 LEAD_SHARE_NO_REASON (observation-log); C-82.8 STATEMENT_ACK_NO_REASON
   (case-authoring); C-91.8 ENTITY_NO_NOTE (entities); C-92.13 ATTRIBUTION_NO_REASON (publication); C-107.3 BAR_NO_REASON
   (strength); C-110.29 VERSION_ADOPT_NO_REASON (reevaluation); C-112.20 STANDARD_NO_REASON (standards); C-115.44
   PACKET_NO_REASON (filings); C-116.46 MACHINE_CANNOT_DECLINE_TO_ESCALATE (escalation); C-118.7 RESOLVE_NO_REASON,
   C-118.8 MACHINE_CANNOT_SET_ASIDE, C-118.9 SET_ASIDE_NO_REASON (capture).
   CHANGED, code unmoved: the translations of C-33.44 CLASS_NOT_DISPOSED (queue: "signal" and "to-do" for the classes),
   C-112.17 STANDARD_FIELD_UNKNOWN (standards: the fields it holds gain "reason"), C-118.3 KNOCKER_SECRET_WEAK and C-85.1–
   C-85.5 (capture: each now says the group can see how often its doorbell turns people away; C-85.1 and C-85.2 open
   "Your material was not received"); the `where`s of C-116.5, C-116.6 and C-116.7, now `#pursuable` (escalation).
   CHANGED IN WHAT THE GATES RUN, no row moving: none beyond the rows above. The case gate's registered catalogue
   (ratification's) runs C-41.16's arm, counted as that row's arrival; no registered step, grammar or listener changed
   its ids since 1.52.0. Membership's T23 job (`MODULE_ORDER`) and record-core's (tests only) changed no row.
   MINOR, rule 17 moving the stamp for arrivals and changed rows. ROW_CENSUS (R50) is re-pinned to this tree, module
   tables only: 1046 rows. Rows T23's layers 3–11 change were T24's stamp, taken by 1.54.0. */
/* 1.54.0 (PROMOTION #25, T24 layer 2, 2026-10-02; K1185, K1186): EVERY ROW CHANGE SINCE 1.53.0, counted wherever the
   rows live (R34, R47), read by diffing R50's census lines of `tranche/T24` after record-core, credentials and
   membership merged against 1.53.0's own (`test/fixtures/row-census-1.53.0.jsonl`: 1046 rows, 28dc9ebb…): twenty-seven
   arrivals, none changed, no departure. Each is one a job record names (T23's layers 3–11 `awaiting stamp`; T24's
   layer 2, record-core's).
   ARRIVED: C-127.1–C-127.16 in `NETWORK_NOTICE_CHECKS`, MACHINE_CANNOT_POST_NOTICE through NOTICE_UNCHANGED (the new
   module network-notices, K1119, K1145); C-128.1 SWEEP_SCOPE_MISSING, C-128.2 SWEEP_REDIRECT_OUT_OF_SCOPE in
   `SWEEP_SCOPE_CHECKS` (acquisition R31); C-18.16 SWEEP_TERM_REFUSED, C-18.17 SWEEP_NOT_A_MEMBER, C-18.18
   SWEEP_RATIFY_NOT_AN_OWNER in `SWEEP_CHECKS` (monitoring); C-28.19 CAPTURE_SWEEP_OUT_OF_SCOPE (capture-requests R45);
   C-41.17 WORKING_ON in `CASE_DOCUMENT_FAMILY` (ratification R38, K1144); C-98.10 PUBLIC_READ_NOT_REGISTERED
   (public-read R18, K1149); C-59.7 OPAQUE_ID_MALFORMED, C-59.8 OPAQUE_ID_SPENT, C-59.9 OPAQUE_ID_NO_TRANSACTION
   (record-core R75, N503).
   CHANGED IN WHAT THE GATES RUN, no row moving: none beyond the rows above. The case gate's registered catalogue
   (ratification's) runs C-41.17's arm, counted as that row's arrival; no registered step, grammar or listener changed
   its ids since 1.53.0 (the new registrations, capture-requests' sweep scope, network-notices' mint seed and public
   reads, are no gate's). Membership's T24 job (`MODULE_ORDER` gains `link-sweep`, which registers no step yet) and
   credentials' (`status_at`) changed no row.
   MINOR, rule 17 moving the stamp for arrivals. ROW_CENSUS (R50) is re-pinned to this tree, module tables only: 1073
   rows. Rows T24's layers 3–11 change were T25's stamp, taken by 1.55.0. */
/* 1.55.0 (PROMOTION #26, T25 layer 2, 2026-10-02; K1209, K1216, K1218): EVERY ROW CHANGE SINCE 1.54.0, counted wherever
   the rows live (R34, R47), read by diffing R50's census lines of `tranche/T25` after membership merged against 1.54.0's
   own (`test/fixtures/row-census-1.54.0.jsonl`: 1073 rows, f1f0ad54…): three changed, no arrival, no departure. Each is
   one a job record names (T24's layers 3–11 `awaiting stamp`: LINK-SWEEP #1's record; T25's layer 2 changed no row).
   CHANGED, `where` only, code, number, condition and translation unmoved: C-18.16 SWEEP_TERM_REFUSED, C-18.17
   SWEEP_NOT_A_MEMBER and C-18.18 SWEEP_RATIFY_NOT_AN_OWNER, moved with the link sweep from monitoring's `SWEEP_CHECKS`
   into link-sweep's (`src/link-sweep/checks.mjs`; N506), each `where` re-pointed to the site that now mints it:
   `src/link-sweep/checks.mjs sweepGrammar > is-sweep-term`, `src/link-sweep/sweep.mjs sweepFence > is-sweep-member`
   and `> is-sweep-owner`. Monitoring's copies left with the move, so each row is held once, as before.
   DEPARTED: none. ARRIVED: none.
   CHANGED IN WHAT THE GATES RUN, no row moving: C-18.5's sweep arms, which monitoring's registered promote step
   (monitoring R27) and its audit (R42) run, reach monitoring through link-sweep's registration (`registerSweep`,
   monitoring R66; link-sweep R1–R3) where monitoring held them, moved line for line (`sweepGrammar`, LINK-SWEEP #1's
   record), so what judges a bundle is unmoved, as 1.50.0's owner registrations were. No registered step, grammar or
   listener of either gate changed its ids since 1.54.0. Membership's T25 job (`MODULE_ORDER` gains `attestation`,
   `provenance-routes` and `reading-pipeline`, none of which registers a gate step yet) changed no row.
   MINOR, rule 17 moving the stamp for changed rows and a changed composition. ROW_CENSUS (R50) is re-pinned to this tree, module tables only:
   1073 rows. Rows T25's layers 3–11 change were T26's stamp, taken by 1.56.0. */
/* 1.56.0 (PROMOTION #27, T26 layer 2, 2026-10-02; N512, K1225, K1227, K1246): EVERY ROW CHANGE SINCE 1.55.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T26` at its opening against 1.55.0's
   own (`test/fixtures/row-census-1.55.0.jsonl`: 1073 rows, 735376fd…): eight changed, no arrival, no departure. Each is
   one a job record names (T25's layers 3–11 `awaiting stamp`: PROVENANCE #14's, PROVENANCE-ROUTES #1's and ATTESTATION
   #1's records; T26's layer 2 changed no row).
   CHANGED, `where` only, code, number, condition and translation unmoved, each re-pointed by the provenance split (N512)
   to the site that now mints it: C-34.1 ROUTE_MARK_NO_AUTHOR, C-34.2 ROUTE_MARK_NO_BUNDLE, C-34.3 ROUTE_MARK_NO_SUCH_BUNDLE
   and C-34.4 ROUTE_MARK_NOT_A_DOCUMENT, moved from provenance's table into provenance-routes' `ROUTE_MARK_CHECKS`
   (`src/provenance-routes/index.mjs provenanceRouteAssess > is-route-mark`); C-89.1 CAPTURE_HELD_IN_PARTS, moved into
   attestation's `ATTEST_CHECKS` (`src/attestation/index.mjs attest > is-attest-parts`); C-103.6 RECEIPT_MALFORMED and
   C-103.7 RECEIPT_NO_KEY, still provenance's `PROVENANCE_ACT_CHECKS` rows, minted now at attestation's `signReceipt`
   (`src/attestation/index.mjs signReceipt`); C-103.3 NO_BUNDLE, provenance's, now naming its second site
   (`src/provenance/index.mjs declareOrigin > is-origin-act; src/provenance-routes/index.mjs provenanceChainRebuild`,
   K1227). Provenance keeps no copy of the moved rows (K1225), so each is held once, as before.
   DEPARTED: none. ARRIVED: none.
   CHANGED IN WHAT THE GATES RUN: nothing. No registered step, grammar or listener of either gate changed its ids since
   1.55.0, and the case gate's registered catalogue is unmoved. Outside the gates, the audit's `route` finding and the
   `routeMarks` count are registered with record-core by provenance-routes where provenance registered them, the same
   tally moved line for line (PROVENANCE-ROUTES #1's record), so what the audit counts is unmoved. Membership's T26 job
   is none; T26's layer 2 is this stamp alone.
   MINOR, rule 17 moving the stamp for changed rows. ROW_CENSUS (R50) is re-pinned to this tree, module tables only:
   1073 rows. Rows T26's layers 3–11 change were T27's stamp, and T27's were T28's, taken by 1.57.0. */
/* 1.57.0 (PROMOTION #28, T28 layer 2, 2026-10-03; S4, K1299): EVERY ROW CHANGE SINCE 1.56.0, counted wherever the rows
   live (R34, R47), read by diffing R50's census lines of `tranche/T28` at its layer 2 against 1.56.0's own
   (`test/fixtures/row-census-1.56.0.jsonl`: 1073 rows, 3371a04b…): thirty arrivals, none changed, no departure. Each is
   one a job record names (T27's layers 3–11 `awaiting stamp`, accepted red 2: ACTION-GRAMMAR's, CONTROL-PLANE's and
   DOCKET's records; T26's layers 3–11 changed no row; T28's layer 2 changes none).
   ARRIVED: C-117.23 HOLD_RELEASE_IS_ITS_OWN_ACT, C-117.24 HOLD_PROJECTS_REFUSED, C-117.25 HOLD_ALREADY_RELEASED
   (action-grammar R9, DEC-113, their `where`s naming actions' regions); C-69.5 PURGE_HOLD_IN_PLACE (control-plane R46);
   C-129.1–C-129.26 in the new family `DOCKET_CHECKS`, MACHINE_CANNOT_FILE_DOCKET through DOCKET_ALREADY_WITHDRAWN (the
   new module docket, N520). public-read's and signatures' T27 jobs added no row (their records), and none of T28's
   drafted rows (C-120.8, C-120.10–C-120.13, C-122.2–C-122.4, C-21.3–C-21.5, case-import's family; C-58.5's and C-92.10's
   re-wordings) exists at this stamp: each is T29's. C-120.9 is withdrawn (K1277) and its number is never reused.
   CHANGED IN WHAT THE GATES RUN: nothing. No registered step, grammar or listener of either gate changed its ids since
   1.56.0 (docket registers none; `MODULE_ORDER` gaining docket moves no gate's order), and the case gate's registered
   catalogue is unmoved.
   MINOR, rule 17 moving the stamp for arrivals. ROW_CENSUS (R50) is re-pinned to this tree, module tables only: 1103
   rows. Rows T28's layers 3–11 change were T29's stamp, taken by 1.58.0. */
/* 1.58.0 (PROMOTION #29, T29 layer 2, 2026-10-03; S5, K1334): EVERY ROW CHANGE SINCE 1.57.0, counted wherever the rows
   live (R34, R47), read by diffing R50's census lines of `tranche/T29` at its layer 2 against 1.57.0's own
   (`test/fixtures/row-census-1.57.0.jsonl`: 1103 rows, 966af5b4…): twenty-six new rows, one re-keyed, four changed (twenty-
   seven lines arrived, one departed). Each is one a job record names (T28's layers 3–11 `awaiting stamp`, accepted red 2:
   INQUIRY-GRAMMAR's, ACCEPTED-WORK's, CASE-AUTHORING's, PUBLICATION's, RATIFICATION's, DOCKET's and CASE-IMPORT's records;
   T29's layer 2 changes none).
   ARRIVED: C-21.3 IMPORTED_LEG_MALFORMED (inquiry-grammar R11); C-21.4 IMPORTED_NOT_ACCEPTED, C-21.5
   ACCEPTED_WORK_UNREADABLE (the new module accepted-work); C-120.8 RELIED_ON_NOT_PRESENTABLE, C-120.10
   ACCEPTED_WORK_NOT_IN_FORCE, C-120.11 FLAG_NOT_DISCLOSED, C-120.12 FLAGS_UNDETERMINED, C-120.13
   FLAG_DISCLOSURE_NOT_STANDING (case-authoring's `CASE_DISCLOSURE_CHECKS`; C-120.9 is withdrawn, K1277, and its number
   is never reused); C-122.2 CASE_FORMAT_SUPERSEDED, C-122.3 ACCEPTANCE_WITHDRAWN_SINCE, C-122.4 FLAG_OPENED_SINCE
   (publication); C-130.1–C-130.14, MACHINE_CANNOT_IMPORT through IMPORT_FLAG_NOT_OPEN (the new module case-import, N520).
   RE-KEYED, number, `where` and translation unmoved (the old code departed, the new arrived): C-129.10
   MACHINE_CANNOT_MARK_DOCKET_PRESSURE, was MACHINE_CANNOT_MARK_PRESSURE (docket, N526: action-grammar's C-117.14 keeps
   that code).
   CHANGED, code and number unmoved: the translations of C-92.4 ATTRIBUTION_NOT_AN_OBSERVATION and C-92.5
   ATTRIBUTION_NOT_THE_AUTHOR (publication R60: a capture's attesting member) and of C-58.5
   ANONYMOUS_TESTIMONY_UNCORROBORATED and C-92.10 ATTRIBUTION_UNCHOSEN (ratification, N523, DEC-119 (3): material from an
   unnamed source a member attests).
   CHANGED IN WHAT THE GATES RUN: the promote gate gains accepted-work's registered step (C-21.4, C-21.5); inquiry-grammar's
   registered grammar runs the imported-leg arm (C-21.3); the case gate's registered catalogue (ratification's) holds an
   anonymous attestation to C-58.5's guard. Each is counted with its row above. `MODULE_ORDER` gaining accepted-work,
   case-checker and case-import (membership, T28) places accepted-work's step in the modules' total order (R39).
   Rows this tranche's L8 jobs will move (the C-120 rows' `where` with the case-authoring split, N529; docket's own codes
   for PRESSURE_MARKED and PRESSURE_REFUSED, N533) are not stamped in advance: they are T30's.
   MINOR, rule 17 moving the stamp for arrivals, a re-keyed row, changed rows and a changed composition. ROW_CENSUS (R50)
   is re-pinned to this tree, module tables only: 1128 rows. Rows T29's layers 3–11 change were T30's stamp, taken by
   1.59.0. */
/* 1.59.0 (PROMOTION #30, T30 layer 2, 2026-10-03; S6, K1357): EVERY ROW CHANGE SINCE 1.58.0, counted wherever the rows
   live (R34, R47), read by diffing R50's census lines of `tranche/T30` at its layer 2 against 1.58.0's own
   (`test/fixtures/row-census-1.58.0.jsonl`: 1128 rows, bc45a9ec…): twelve rows changed in `where` only, two re-keyed
   (fourteen lines arrived, fourteen departed; 1128 rows still). Each is one a job record names (T29's layers 8 and 11:
   CASE-DISCLOSURES', CASE-AUTHORING's, CONTROL-PLANE's and DOCKET's records; T30's layer 2 changes none).
   CHANGED, code, number and translation unmoved: the `where` of C-120.1–C-120.8 and C-120.10–C-120.13, now
   case-disclosures' (`CASE_DISCLOSURE_CHECKS`, `src/case-disclosures/checks.mjs`; each names
   `src/case-disclosures/index.mjs <method> > <region>`, C-120.3's method `tensionsUndetermined`; the case-authoring
   split, N529, K1348). C-120.9 stays withdrawn (K1277).
   RE-KEYED, number, `where` and translation unmoved (the old code departed, the new arrived): C-129.12 DOCKET_PRESSURE_MARKED,
   was PRESSURE_MARKED, and C-129.13 DOCKET_PRESSURE_REFUSED, was PRESSURE_REFUSED (docket's own codes, N533, K1346).
   CHANGED IN WHAT THE GATES RUN: nothing. case-disclosures and docket register no step, grammar, fact or case catalogue,
   and no registered step of either gate changed its ids since 1.58.0.
   MINOR, rule 17 moving the stamp for changed and re-keyed rows. ROW_CENSUS (R50) is re-pinned to this tree, module
   tables only: 1128 rows. Rows T30's layers 3–11 change were T31's stamp, and T31's are T32's, taken by 1.60.0. */
/* 1.60.0 (PROMOTION #31, T32 layer 2, 2026-10-03; S7, K1393, K1401, N534): EVERY ROW CHANGE SINCE 1.59.0, counted
   wherever the rows live (R34, R47), read by diffing R50's census lines of `tranche/T32` at its layer 2 against 1.59.0's
   own (`test/fixtures/row-census-1.59.0.jsonl`: 1128 rows, 61929a98…): thirty-four arrivals, none changed, no departure.
   Each is one a job record names (T31's layers 3–11, accepted red 2: WIZARD-SCRIPTS' and CASE-IMPORT's records; T30's
   layers 3–11 changed no row; T32's layers 1–2 change none).
   ARRIVED: C-131.1–C-131.32 in the new family `WIZARD_SCRIPTS_CHECKS`, MACHINE_CANNOT_DRAFT_WIZARD through
   WIZARD_NO_SUCH_GRANT (the new module wizard-scripts, `src/wizard-scripts/checks.mjs`, K1393, K1401). Three of its codes,
   C-131.8 NOT_A_DRAFT, C-131.14 NOT_AN_APPROVER and C-131.15 APPROVER_IS_AUTHOR, are also filing-templates' (C-125): each
   family's row is its own row object and is stamped as its own, so each code is counted twice, once per family;
   filing-templates' lines are unmoved, and control-plane's composed catalogue keeps the first source's row for them
   (WIZARD-SCRIPTS #1's record). C-130.15 IMPORT_WATCH_BAD_ADDRESS and C-130.16 IMPORT_NOT_WATCHED (case-import, the
   watch, N534). Docket's T31 job added and changed no row (its record).
   CHANGED IN WHAT THE GATES RUN, no row line moving: the case gate's registered catalogue (ratification's) accepts
   `bio-case-document/7`, `/6` in every field (case-grammar R1, DEC-124, K1365 (1)), and names the format a document
   declares in the findings of C-41.1 and C-41.13–C-41.15 (N538, K1367), so a `/6` document's findings are unmoved;
   publication's C-122.2 admits `/7` beside `/6`, through case-grammar's predicate. wizard-scripts and case-import
   register no step, grammar, fact or case catalogue, and no registered step of the promote gate changed its ids since
   1.59.0.
   MINOR, rule 17 moving the stamp for arrivals and a changed composition. ROW_CENSUS (R50) is re-pinned to this tree,
   module tables only: 1162 rows. Rows T32's layers 3–11 change are T33's stamp. */
/* 1.61.0 (PROMOTION #32, T34, 2026-10-06; N553, N631, K1718): MINOR. The stamp of T33's rows awaiting it (accepted
   red at T33's close, K1708) and of T34's layer 1, re-pinned over the tree of `tranche/T34` as this job stamps it.
   ARRIVED (136): record-core C-102.21–.25 and C-132.1–.4 (K1542, K1545); progressions C-100.24; run-rules C-109.8–.12
   and C-22.19–.21; standards C-112.21–.32 (K1571); conformance C-113.29–.31 and consequences C-114.21/.22 (K1649);
   action-grammar C-117.26–.28; setup C-119.5–.10; case-authoring C-120.14–.16 (K1638) and C-136.1; sources
   C-121.7–.10; action-clocks C-123.4–.6; docket C-129.27/.28 (K1635); duties C-133.1–.36 (34 rows); hypotheses
   C-134.1–.12 (K1607); answers C-135.1–.12 and inquiry-grammar's three C-2.8 rows (K1608, K1609); capture-requests
   C-28.20–.22 (K1605); credentials C-29.13–.24 and C-96.19–.21; public-read C-98.11 (K1644).
   CHANGED (14): C-92.1–.9 and C-92.13, `where` re-pointed from publication to case-tensions, words unchanged;
   C-113.5 ACT_INCOMPLETE (an act named by its event); C-114.4 AFFECTED_UNKNOWN_KIND (a person a document names; an
   office by its role and body); C-114.7 MEASURE_INVALID (exact decimals); C-91.1 IDSPACE_UNKNOWN (the spaces listed
   from the jurisdiction profiles). DEPARTED (1): C-114.5 AFFECTED_INDIVIDUAL.
   CHANGED IN WHAT THE GATES RUN, no row line moving: C-20.1 (R30, N631) counts a file named in a mechanical
   promotion's entry as written only when it is new to that promotion's own pre-image snapshot or differs from its
   copy there, and states a copy it cannot compare as undetermined (a warning, R37), so a monitoring tick that carries
   a file unchanged adds no envelope error.
   T34 LAYER 2, re-pinned in place as each merges (BOB's CHANGE): membership (K1752) ARRIVED C-96.22–.38 (17) and
   DEPARTED C-96.5 ADMINS_FIRST and C-96.10 RESIGN_AT_TWO (retired, never reused); record-core (K1754) ARRIVED
   C-102.26 TABLE_NAME_INVALID and C-102.27 TABLE_DECLARED (N554); credentials (K1764) ARRIVED C-29.25
   STANDING_SWITCH_OFF, C-29.26 NO_QUESTION, C-29.27 GROUP_KEY_NOTICE_DUE, CHANGED C-29.19 NO_SECRET, C-29.20 NO_ACCOUNT,
   C-29.21 UNKNOWN_SWITCH, C-29.24 GRANT_NOT_HELD, and DEPARTED C-29.16 ACCOUNT_LEVEL_MEMBER_ONLY (retired, never reused).
   ROW_CENSUS (R50) re-pinned to this tree: 1316 rows. Rows a T34 job in layers 3–11 adds or changes are T35's stamp
   (plan Rules (5) 4). */
/* 1.62.0 (PROMOTION #33, T35-16, 2026-10-07; N553's tail, K1542, K1545, K1855, K1934, DEC-149): MINOR. The stamp of every
   row awaiting it at T34's close (T34's layers 3–11, accepted red 4) and of T35's layers 1 and 2, read by diffing R50's
   census lines of `tranche/T35` after its layer 1 merged against 1.61.0's own (`test/fixtures/row-census-1.61.0.jsonl`:
   1316 rows, 5f710da0…): sixty-two new rows, five re-keyed (sixty-seven lines arrived, five departed), seventy-eight
   changed. Each is one a job record names (T34's: SETUP's, WIZARD-SCRIPTS', DUTIES', HYPOTHESES', FOLLOWING's, TASKS',
   INQUIRY-GRAMMAR's, RATIFICATION's and the DEC-149 sweep's, K1784, K1845, K1846, K1855) or this job's sweep.
   ARRIVED (62): setup C-64.8 PLACE_NAME_MALFORMED, C-64.9, C-64.10 and C-119.11, C-119.12; wizard-scripts C-131.33–.41;
   hypotheses C-134.13–.19 (the member's note); following C-137.1–.20 (the new module's family, three codes re-keyed by
   K1836, K1855 (2)); tasks C-138.1–.15 (the check request); inquiry-grammar's C-2.8 DERIVED_LEG_MALFORMED; ratification
   C-58.6–.10 (the scheduled check).
   RE-KEYED, number, `where` and translation unmoved (the old code departed, the new arrived): duties C-133.19
   DUTY_MEMBER_ACT_ONLY, C-133.21 DUTY_NO_REASON, C-133.24 DUTY_NO_SUCH_PROPOSAL (N608, K1679); hypotheses C-134.5
   HYPOTHESIS_NO_STATEMENT, C-134.7 HYPOTHESIS_NO_REASON (N608).
   CHANGED (78), translation, code and number unmoved, nearly all DEC-149's words ("your group's Civicsmith" for the
   instance, the copy or the plane): this module's C-64.1, C-86.3 and C-102.4–.8 (T35-16's sweep); admission C-29.8,
   C-32.17, C-38.1, .3, .8, C-64.4, C-78.1; action-grammar C-101.1; action-plans C-124.32 (N601's wording, K1750),
   C-124.57; capture-requests C-28.1, .4, .6, .8, .16, .17, .20, .21; case-authoring C-120.8, C-136.1; case-import
   C-130.3, .5, .7; conformance C-113.28; control-plane C-66.6, C-68.2–.4, C-69.1–.5; docket C-129.16, .22; duties C-133.9;
   entities C-91.1, .2; escalation C-116.44; filing-templates C-125.3, .15; filings C-115.13; local-facts C-126.2;
   monitoring C-48.8, .9; network-notices C-127.4, .5, .12; public-read C-68.5, C-98.1, .2, .4–.6, .8–.10; queue C-33.44;
   ratification C-32.14, .15; review C-87.7; run-rules C-33.29, C-109.1, .9, .10; setup C-64.3, C-119.1, .3–.5;
   wizard-scripts C-131.24.
   CHANGED IN WHAT THE GATES RUN, no row line moving: none this job knows of beyond the rows above (the arrivals' own
   arms are counted with their rows). T35's layer 1 added and changed no row; T35's layer 2 (record-core, membership,
   credentials) is re-pinned in place as each merges (BOB's CHANGE), so T35 names one catalogue.
   T35 LAYER 2, re-pinned in place: record-core and membership (8937567d88, K1942): record-core ARRIVED C-102.28
   ANONYMOUS_LEASE and C-102.29–.32 SETTING_NAME_REQUIRED, SETTING_BY_REQUIRED, SETTING_VALUE_REQUIRED, SETTING_INVALID
   (N655, its R81) and CHANGED C-59.6–.9, C-102.1, .2, .13–.27 (DEC-149, its R82: the `BUILD_FAULT` sentence and "your
   group's Civicsmith"); membership CHANGED C-55.1, C-96.11, C-102.11, .12 (DEC-149, its R112); credentials (63ef48312c,
   K1945) ARRIVED C-29.28 AI_CREDENTIAL_BAD_EXPIRY, C-29.29 SUBSCRIPTION_LOGIN_REFUSED, C-96.39 SIGN_IN_PAUSED, C-96.40
   NOT_SIGNED_IN, C-96.41 RECOVERY_REFUSED, C-96.42 SECURITY_KIND_UNKNOWN, C-96.43 SECURITY_PERIOD_INVALID (its new
   refusals, R38–R47, K1934 (9)) and CHANGED C-29.1, .3, .5, .22, C-63.1, .2 (DEC-149, its R48).
   ROW_CENSUS (R50) re-pinned to this tree: 1390 rows. Rows a T35 job in layers 3–11 adds or changes are T36's stamp
   (plan T35, Rules 9 (2)). */
/* 1.63.0 (PROMOTION #34, T36-8, 2026-10-08; T35's red 2, T36's red 4; K1542, K1545, K1855): MINOR. The stamp of every
   row awaiting it at T35's close (T35's layers 3–11) and of T36's layers 1 and 2, read by diffing R50's census lines of
   `tranche/T36` after its layer 1 merged against 1.62.0's own (`test/fixtures/row-census-1.62.0.jsonl`: 1390 rows,
   ff8c6743…): seventy-seven new rows, none departed, forty-four changed. Each is one a T35 job record names.
   ARRIVED (77): standards C-112.33–.52, .54–.58 (25); law-relations C-112.53 LAW_RELATION_NO_EDITION; acquisition
   C-137.1–.19 (the archive family, its R29, stamped here under following's numbers, each row counted as its own; T36-10
   renumbered them C-139.1–.19, N738, red 8 cleared, and 1.64.0 stamps them there, N754); capture-requests C-28.23–.33; capture-sources C-105.12 CAPTURE_CREDENTIAL_OWN_HOST;
   conformance C-113.32–.36; filing-templates C-115.45, .46; publication C-122.5 SCHEDULED_CHECK_UNAVAILABLE; duties
   C-133.37–.39; answers C-135.13 STANDING_NEEDS_SEARCH; admission C-29.30 AI_CREDENTIAL_EXPIRED, C-38.9
   DOOR_RATE_LIMITED; citation C-33.52, C-33.53, C-45.14–.16; case-authoring C-44.6 CASE_EDITION_WAITING.
   CHANGED (44), code and number unmoved: law-relations C-112.23, .24, .26–.32 (`where` moved out with law.mjs, C-112.29
   re-worded); standards C-112.3, C-112.21; acquisition C-28.13, C-48.1, .4, .7, C-68.1, C-83.1, .3, .4, .5, .8, C-128.1
   (DEC-149); answer-envelope C-61.1, C-69.2–.5 (`where` re-pointed by the L11 split); hypotheses C-134.13–.16 (`where`);
   answers C-135.6, .8; capture C-85.3, .4; extraction C-51.1, .4; provenance C-103.7; attestation C-89.1; capture-sources
   C-105.8; reevaluation C-110.1; intent C-111.24; docket C-129.16; bias C-26.2 (each DEC-149's words).
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T35 or T36 job record names. T36's layer 1 added and
   changed no row; T36's layer 2 (membership, credentials) is re-pinned in place as each merges (BOB's CHANGE), so T36
   names one catalogue.
   T36 LAYER 2, re-pinned in place: membership (K2090) added and changed no row; credentials (5b3d7fb633, K2093) ARRIVED
   C-29.31 AI_KEPT_AWAY and C-29.32 NO_REASON (the keep-away act, DEC-172) and C-96.44 SECURITY_COUNTS_UNREADABLE (the
   counts read), and CHANGED C-96.43 SECURITY_PERIOD_INVALID (`where` now `#periodRefusal`, words unchanged).
   ROW_CENSUS (R50) re-pinned to this tree: 1470 rows. Rows a T36 job in layers 3–11 adds or changes are T37's stamp
   (plan T36, Rules 5 (4)). */
/* 1.64.0 (PROMOTION #35, T37-7, 2026-10-08; T36's red 4, N754, N755; K1542, K1545, K1855, K2027, K2100, K2101): MINOR.
   The stamp of every row awaiting it at T36's close (T36's layers 3–11) and of T37's layers 1 and 2, read by diffing
   R50's census lines of `tranche/T37` after its layer 1 closed against 1.63.0's own
   (`test/fixtures/row-census-1.63.0.jsonl`: 1470 rows, e9ef089b…): forty-seven new rows, nineteen renumbered (sixty-six
   lines arrived, twenty departed), one retired, two changed. Each is one a T36 job record names (ADMISSION's,
   STANDARDS', INSTANCE-SETUP's, CASE-AUTHORING's, ACQUISITION's and FILE-SAFETY's).
   ARRIVED (47): admission C-38.10 CREDENTIAL_IN_ADDRESS, C-38.11 MEMBER_TOKEN_RETIRED; standards C-112.59
   THROUGH_INVALID, .60 THROUGH_NO_SOURCE, .61 THROUGH_AFTER_CHECK, .62 NO_SUCH_RECORD; case-authoring C-136.2
   STANDARDS_USE_REFUSED; acquisition C-139.20 NOT_AN_ARCHIVE (its R41); file-safety C-140.1 FILE_NOT_HELD through
   C-140.39 FORWARD_PERIOD_INVALID (the new module's family, `FILE_SAFETY_CHECKS`, 39 rows).
   RENUMBERED (19), code, `where` and translation unmoved (the old number departed, the new arrived): acquisition's
   archive family C-137.1–.19 → C-139.1–.19, in the same order (N738, K2027; following keeps C-137.1–.20).
   DEPARTED (1), its number never reused: instance-setup C-119.6 ASSISTANT_SWITCH_MALFORMED (the switch retired with
   `assistantset`).
   CHANGED (2), code and number unmoved: standards C-112.41 FORCE_TEXT_NOT_HELD (`where` now `refuseTextNotHeld`, words
   unchanged); instance-setup C-119.5 ASSISTANT_OFF (translation: the group keeps its material away from every
   assistant, the administrator's reason coming with the answer).
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T36 or T37 job record names. T37's layer 1 added and changed
   no row (file-scanner's and image-cover's refusals are no table's). T37's layer 2 (membership, credentials) is
   re-pinned in place as each merges, so T37 names one catalogue.
   T37 LAYER 2, re-pinned in place: membership (K2183) added and changed no row; credentials (K2184) ARRIVED C-29.33
   AI_CREDENTIAL_NO_SECRET, C-96.45 MACHINE_CANNOT_SET_PASSWORD and C-96.46 CURRENT_PASSWORD_WRONG, RE-KEYED C-29.32
   NO_REASON → AI_KEEP_AWAY_NO_REASON (N755: it no longer shares progressions' C-100.18 code, K231), and CHANGED C-29.31
   AI_KEPT_AWAY (`where` now `aiKeptAway`, the one site that mints it, N765; words unchanged).
   ROW_CENSUS (R50) re-pinned to this tree: 1519 rows. Rows a T37 job in layers 3–11 adds or changes are T38's stamp
   (plan T37, Rules 6 (2)). */
/* 1.65.0 (PROMOTION #36, T38-6, 2026-10-08; T37's red 2 (plan T38, rule 6 item 2); K1542, K2231, K2232): MINOR. The
   stamp of every row awaiting it at T37's close (T37's layers 3–11) and of T38's layers 1 and 2, read by diffing R50's
   census lines of `tranche/T38` at its layer 2 against 1.64.0's own (`test/fixtures/row-census-1.64.0.jsonl`: 1519 rows,
   60d892ca…): twenty-eight new rows, one retired, seven changed. Each is one a T37 job record names (INSTANCE-SETUP's,
   CASE-CARRIAGE's, CASE-DISCLOSURES', PUBLICATION's, FILE-SAFETY's and CONFORMANCE's).
   ARRIVED (28): instance-setup C-64.11 TRANSLATION_DIRECTION_UNKNOWN through C-64.26 TRANSLATION_NOTE_REFUSED (the
   screens' translation, its R67–R75; C-64.18 NO_SUCH_MEMBER among them, N793's one site to follow); case-carriage
   C-141.1 MACHINE_CANNOT_MARK through C-141.6 AREA_OUTSIDE (the new module's family, `CASE_CARRIAGE_CHECKS`);
   case-disclosures C-120.17 PHOTO_NOT_COVERABLE, C-120.18 PHOTO_MARKS_UNDETERMINED; publication C-122.6
   PHOTO_MARKS_CHANGED_SINCE; file-safety C-140.40 CONFIG_MISSING, C-140.41 CONFIG_UNKNOWN, C-140.42
   DEEPER_CHECKS_UNREADABLE.
   DEPARTED (1), its number never reused: instance-setup C-119.5 ASSISTANT_OFF (the gate answers credentials'
   AI_KEPT_AWAY, C-29.31, N765).
   CHANGED (7), `where` only, code, number, region and translation unmoved, each re-pointed to the function that holds its
   region (K2231): conformance C-113.12 OUTCOME_UNKNOWN and C-113.32 STANDARD_NOT_BINDING to `#determine`, C-113.19
   PROPOSAL_CANNOT_DETERMINE to `#propose`, C-113.29 ACT_NO_EVENT and C-113.31 ACT_NOT_AN_EVENT to `#actEvent`, C-113.34
   ACTOR_IS_A_PERSON and C-113.35 ACTOR_NOT_AN_OFFICE_OR_ORGANISATION to `#comparedAct`.
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T37 or T38 job record names. T38's layer 1 (bundler,
   image-codecs, file-scanner) added and changed no row. T38's layer 2 (project-roster, membership, credentials) is
   re-pinned in place as each merges, so T38 names one catalogue.
   T38 LAYER 2, re-pinned in place after all three merged (K2283): project-roster (the membership split, N783) CHANGED
   C-56.5 TARGET_NOT_JOINED, C-33.28 LAST_OWNER, C-70.4 PROJECT_DIRECTORY_NEEDS_A_MEMBER and C-95.1–.9, `where` only, each
   now naming `src/project-roster/index.mjs`, numbers, codes and translations unmoved, membership's copies gone;
   membership ARRIVED C-96.47 NO_SUCH_MEMBER (`noSuchMember`, N793's one site; instance-setup's C-64.18 leaves in T39);
   credentials CHANGED C-29.17 UNKNOWN_ACCOUNT_KIND and C-29.20 NO_ACCOUNT (translation: the subscription is connected by
   signing in, N785).
   ROW_CENSUS (R50) re-pinned to this tree: 1547 rows (1546 over the tranche at its layer 2's opening). Rows a T38 job in layers 3–11 adds or changes are T39's stamp
   (plan T38, rule 6 item 2). */
/* 1.66.0 (PROMOTION #37, T39-3, 2026-10-08; T38's red 2 (plan T39, rule 3 item 2); N800, N808; K1542, K2285, K2343,
   K2358): MINOR. The stamp of every row awaiting it at T38's close (T38's layers 3–11) and of T39's layers 1 and 2, read
   by diffing R50's census lines of `tranche/T39` at its layer 2 against 1.65.0's own
   (`test/fixtures/row-census-1.65.0.jsonl`: 1547 rows, 6f8d4d64…): five new rows, one re-keyed (six lines arrived, one
   departed), one retired, two changed. Each is one a T38 job record names (CASE-CARRIAGE's, CASE-DISCLOSURES',
   PUBLICATION's and INSTANCE-SETUP's).
   ARRIVED (5): case-carriage C-141.7 MACHINE_CANNOT_WITHDRAW_MARK, C-141.8 NO_SUCH_MARK, C-141.9 MARK_ALREADY_WITHDRAWN,
   C-141.10 WITHDRAW_NO_REASON (a mark's withdrawal); case-disclosures C-120.19 PHOTO_UNCHECKED.
   RE-KEYED (1), number, `where` and translation unmoved (the old code departed, the new arrived): case-carriage C-141.1
   MACHINE_CANNOT_MARK_PHOTO, was MACHINE_CANNOT_MARK.
   DEPARTED (1), its number never reused: instance-setup C-64.18 NO_SUCH_MEMBER (the site answers membership's C-96.47,
   N793, as 1.65.0's note foresaw).
   CHANGED (2), code and number unmoved, translation only: case-disclosures C-120.17 PHOTO_NOT_COVERABLE and publication
   C-122.6 PHOTO_MARKS_CHANGED_SINCE (the protected words, `photo.refused.format` and `photo.refused.changed`).
   T39's layer 1 added and changed no row: doc-clean's `CLEAN_REFUSALS` (its family, EMBEDDED_MEDIA among them, K2346,
   K2351) and image-cover's `STRIP_REFUSALS` and `COVER_REFUSALS` map a code to its words and carry no `check`, so no
   census reads a row in them; pdf-reader's and bundler's jobs moved no row.
   CHANGED IN WHAT THE GATES RUN, no row line moving (this job, R31, R32): C-18.8 verifies a release over the released
   bytes, the `bundle.md` as the promotion that recorded the release left it (the first manifest entry, in write order,
   whose `bundle.md` holds it), hashed as the image holds them, never decoded; when they cannot be read the release is an
   error, never a pass, so a later revision no longer fails a signature that verified over what was released. Its
   message and the registry root's text keep one byte per code unit, and a code unit above 0xFF fails closed (the release
   an error, the root `not_latin1`) where it was masked to its low byte (N808, K2358). C-4.2 never throws: a type or a
   state named by an inherited key (`toString`, `constructor`, `__proto__`) has no declared table and adds no finding of
   its own, as any type with none (`checkBundle`'s own throw on such a type is record-grammar's, N809).
   T39's layer 2 (membership) is re-pinned in place if its merge moves a row, so T39 names one catalogue.
   ROW_CENSUS (R50) re-pinned to this tree: 1551 rows. Rows a T39 job in layers 3–11 adds or changes are T40's stamp
   (plan T39, rule 3 item 2). */
/* 1.67.0 (PROMOTION #38, T40-4, 2026-10-09; T39's rule 3 item 2, T40's rule 4 item 2; K2370, K2377, K2378, K2413,
   K2414): MINOR. The stamp of every row awaiting it at T39's close (T39's layers 3–11) and of T40's layers 1 and 2, read
   by diffing R50's census lines of `tranche/T40` after membership and credentials merged against 1.66.0's own
   (`test/fixtures/row-census-1.66.0.jsonl`: 1551 rows, 51c6423a…): fifteen new rows, three changed, none departed. Each
   is one a job record names (T39's CASE-DISCLOSURES', PUBLICATION's and CASE-CARRIAGE's; T40's MEMBERSHIP's and
   CREDENTIALS').
   ARRIVED (15): case-disclosures C-120.20 DOCUMENT_COPY_UNDETERMINED, C-120.21 DOCUMENT_COPY_PENDING, C-120.22
   DOCUMENT_NOT_CLEANABLE (R22, provisional until this stamp); publication C-122.7 DOCUMENT_COPY_CHANGED_SINCE (K2370);
   case-carriage C-141.11 DOCUMENT_COPY_NO_STORE (K2377); membership C-96.48 HANDLE_CHECK_PAUSED, C-96.49
   HANDLE_CHANGE_NOT_A_MEMBER, C-96.50 HANDLE_FIXED, C-96.51 HANDLE_CHANGE_UNCHECKED (the handle codes); credentials
   C-29.34 PROJECT_NOT_SOLE_MEMBER, C-29.35 SIGNIN_NOT_CONNECTED, C-29.36 SWITCH_VALUE_INVALID, C-29.37
   AI_USE_SWITCHED_OFF, C-29.38 PROJECT_AI_KEPT_AWAY, C-29.39 PROJECT_KEY_NOTICE_DUE.
   CHANGED (3), code and number unmoved: credentials C-29.21 UNKNOWN_SWITCH (translation: a switch for each kind of use,
   and one for suggestions) and C-29.32 AI_KEEP_AWAY_NO_REASON (`where` now `#keepAwayReason`, words unchanged);
   membership C-56.2 PROJECT_ACT_NOT_THE_OWNER (`where` now `notTheOwner > is-not-the-owner`, words unchanged).
   T40's layer 1 added and changed no row (record-grammar, pdf-reader, doc-clean).
   CHANGED IN WHAT THE GATES RUN, no row line moving: record-grammar's `checkBundle` answers an inherited-key
   `object_type` (`toString`, `constructor`, `__proto__`) as an unknown type and never throws (T40-1, N809), where it
   threw; membership's `MODULE_ORDER` gains `ai-use`, which registers no step, so no gate's order moves.
   ROW_CENSUS (R50) re-pinned to this tree: 1566 rows. Rows a T40 job in layers 3–11 adds or changes are T41's stamp
   (plan T40, rule 4 item 2). */
/* 1.68.0 (PROMOTION #39, T41-6, 2026-10-09; T40's rule 4 item 2, T41's rule 4 item 2; K2426, K2428, K2431, K2435, K2441,
   K2442, K2444, K2445): MINOR. The stamp of every row awaiting it at T40's close (T40's layers 3–11) and of T41's layers 1
   and 2, read by diffing R50's census lines of `tranche/T41` after record-core, membership, project-roster and
   credentials merged against 1.67.0's own (`test/fixtures/row-census-1.67.0.jsonl`: 1566 rows, d3f742b5…): one new row,
   thirteen changed, none departed. Each is one BOB's START and CHANGE name (RECORD-GRAMMAR's, TEXT-CHAIN's, MEMBERSHIP's
   and CREDENTIALS' T41 jobs); T40's layers 3–11 added and changed no row.
   ARRIVED (1): record-grammar C-33.54 ACCEPT_MUST_REAUTHOR, the shared row in `SHARED_ACT_CHECKS` (its R52, K2426).
   CHANGED (13), translation only, code, number and `where` unmoved: text-chain C-35.13 TEXT_CHAIN_LETTER_UNCALIBRATED (an
   AI's reading of a page, K2428); membership C-70.1 PROJECT_SEEN_NOT_A_PARTICIPANT ("you can see that this project
   exists"), C-96.48 HANDLE_CHECK_PAUSED, C-96.49 HANDLE_CHANGE_NOT_A_MEMBER, C-96.51 HANDLE_CHANGE_UNCHECKED (the handle
   words); credentials C-29.21 UNKNOWN_SWITCH (the new kinds of use), C-29.34 PROJECT_NOT_SOLE_MEMBER, C-29.35
   SIGNIN_NOT_CONNECTED, C-29.36 SWITCH_VALUE_INVALID, C-29.37 AI_USE_SWITCHED_OFF, C-29.38 PROJECT_AI_KEPT_AWAY, C-29.39
   PROJECT_KEY_NOTICE_DUE (DEC-188's words, K2435).
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T41 L1–L2 job record names. Record-core's and
   project-roster's T41 jobs added and changed no row; membership's `MODULE_ORDER` gains the five new modules (`steps`,
   `reading-guides`, `question-explorer`, `investigation`, `publish-schedule`), none of which registers a gate step yet,
   so no gate's order moves.
   ROW_CENSUS (R50) re-pinned to this tree: 1567 rows. Rows a T41 job in layers 3–11 adds or changes are T42's stamp
   (plan T41, rule 4 item 2). */
/* 1.69.0 (PROMOTION #40, T42-5, 2026-10-11; T41's rule 4 item 2, T42's rule 4 item 2; K1680, K1750, K2607, K2608):
   MINOR. The stamp of every row awaiting it at T41's close (T41's layers 3–11) and of T42's layers 1 and 2, read by
   diffing R50's census lines of `tranche/T42` at its layer 2 against 1.68.0's own (`test/fixtures/row-census-1.68.0.jsonl`:
   1567 rows, 8c92f849…): 154 new rows, 24 changed, two retired. Each is one a job record names (T41's RUN-PRODUCTIONS',
   RUN-RULES', AI-RUNS', AI-USE's, STEPS', READING-GUIDES', QUESTION-EXPLORER's, INVESTIGATION's, HYPOTHESES', ANSWERS',
   INQUIRY's, INQUIRY-GRAMMAR's, BASIS-VERSIONS', INTENT's, ACTION-GRAMMAR's, ACTION-PLANS', CAPTURE's,
   CAPTURE-REQUESTS', CASE-DISCLOSURES', CASE-CARRIAGE's, PUBLICATION's, PUBLISH-SCHEDULE's, RATIFICATION's, REVIEW's,
   WIZARD-SCRIPTS', OBSERVATION-LOG's and ANSWER-ENVELOPE's; T42's RECORD-GRAMMAR's).
   ARRIVED (154): steps C-142.1–.31 (the new module's family); investigation C-146.1–.28; reading-guides C-144.1–.18;
   question-explorer C-145.1–.11; ai-use C-143.1–.6; run-productions C-104.13–.31 (reading runs, connections,
   acceptance, bearings); hypotheses C-134.20–.28 (proposals); run-rules C-22.22–.28; case-disclosures C-120.23–.29 (the
   account's checks); review C-87.13–.16 (approval rules); intent C-111.29, .30 (`registerNoneExistsReader`, its R33);
   answers C-135.14, .15; action-grammar C-117.29 SEEKS_REFUSED, C-32.21 MACHINE_CANNOT_STATE_SEEKS; inquiry C-106.2
   DRAWN_ON_BY_A_PROJECT, C-2.19 BIAS_APPLICATION_NOT_IN_FORCE; inquiry-grammar C-2.8 BIAS_APPLICATION_MALFORMED;
   basis-versions C-25.35 BAD_BIAS_APPLIED; capture C-118.10 UPLOAD_NO_STATEMENT; capture-requests C-28.34
   CAPTURE_REQUEST_NO_STEP; ratification C-58.11 APPROVAL_MISSING; wizard-scripts C-131.42 START_RUMOUR_AS_QUESTION.
   DEPARTED (2), their numbers never reused: inquiry C-106.1 DRAWN_ON_BY_SEVERAL_PROJECTS (C-106.2 answers the act);
   action-plans C-124.52 PROPOSALS_CURSOR_REFUSED.
   CHANGED (24), code and number unmoved. `where` only: run-productions C-104.9, C-104.10; run-rules C-109.11;
   publish-schedule C-122.5 SCHEDULED_CHECK_UNAVAILABLE (now minted in `src/publish-schedule/`); record-grammar C-33.40
   NO_BASIS (now naming progressions' and entities' sites beside inquiry's, N827) and C-33.54 ACCEPT_MUST_REAUTHOR
   (case-account R4 in place of case-authoring R64, K2608). `where` and translation: run-productions C-104.2–.4; run-rules
   C-109.8, .9, .12. Translation only: run-productions C-104.5, .8; run-rules C-109.10, C-22.14; observation-log C-22.9;
   case-disclosures C-120.19; publication C-122.6; case-carriage C-141.7–.10; action-grammar C-94.5.
   CHANGED IN WHAT THE GATES RUN, no row line moving: the promote gate gains two registered checks, steps' (its R18: a
   basis leg resting on a step id is refused STEP_NOT_A_LEG inside BASIS_REFUSED) and investigation's (a leg resting on
   an intake interview, narrative, is refused NARRATIVE_NOT_A_LEG inside BASIS_REFUSED), each counted with its row
   above and run in the modules' total order (R39); intent's registered step gains a projection (its R32: the person
   warning at an objective's or condition's promotion, never a refusal). 1.68.0's note had steps and investigation
   registering none.
   T42's layer 1 changed the two record-grammar `where`s above and no other row. T42 LAYER 2, re-pinned in place after
   record-core, membership and credentials merged (K2623): none added, changed or retired a row (the census over the
   merged tranche is this pin, line for line); membership's `MODULE_ORDER` gains `doorbell` and `case-account` (T42-3),
   neither of which registers a gate step yet, so no gate's order moves.
   ROW_CENSUS (R50) re-pinned to this tree: 1719 rows. Rows a T42 job in layers 3–11 adds or changes (doorbell's
   re-pointed `where`s among them) are T43's stamp (plan T42, rule 4 item 2). */
/* 1.70.0 (PROMOTION #41, T43-6, 2026-10-11; T42's rule 4 item 2, T43's rule 4 item 2; N854; K1680, K2625, K2689):
   MINOR. The stamp of every row awaiting it at T42's close (T42's layers 3–11) and of T43's layers 1 and 2, read by
   diffing R50's census lines of `tranche/T43` at its layer 2 against 1.69.0's own (`test/fixtures/row-census-1.69.0.jsonl`:
   1719 rows, 8902282a…): three new rows, five re-keyed (five lines arrived, five departed), ten changed, none retired.
   Each is one a job record names (T42's RUN-PRODUCTIONS', INQUIRY's, EXTRACTION's, HYPOTHESES', STEPS', INVESTIGATION's
   and DOORBELL's; T43's RECORD-GRAMMAR's).
   ARRIVED (3): run-productions C-104.32 PROPOSAL_NOT_TAKEN_UP (`machinePassage`); inquiry C-2.20
   MACHINE_PASSAGE_UNCHECKED (its own table, `INQUIRY_PASSAGE_CHECKS`); extraction C-51.7 TRANSCRIBE_NOT_DEPLOYED
   (`pageTranscribe`).
   RE-KEYED (5), number, `where` and translation unmoved (the old code departed, the new arrived; N843): hypotheses
   C-134.22 HYPOTHESIS_PROPOSAL_NO_RUN, was PROPOSAL_NO_RUN, and C-134.23 NO_SUCH_HYPOTHESIS_PROPOSAL, was
   NO_SUCH_PROPOSAL; steps C-142.28 NO_SUCH_STEP_PROPOSAL, was NO_SUCH_PROPOSAL; investigation C-146.21
   NO_SUCH_PLANNING_PROPOSAL, was NO_SUCH_PROPOSAL, and C-146.26 INTERVIEW_NOT_A_LEG, was NARRATIVE_NOT_A_LEG.
   CHANGED (10), code and number unmoved. `where` only: doorbell's nine, still held in capture's `KNOCK_CHECKS` and
   `CAPTURE_CHECKS` and re-pointed to the doorbell sites that mint them (K2609): C-85.1, C-85.2 (`src/doorbell/index.mjs
   #knockRateRefusal`), C-85.3–.5 (`src/doorbell/door.mjs`), C-118.2, C-118.4, C-118.7 (`src/doorbell/index.mjs`),
   C-118.3 (`src/doorbell/door.mjs`); record-grammar C-33.40 NO_BASIS (all five sites, money's `setFundType` and lines'
   `recordLine` added, N857).
   CHANGED AT THE WRITE DOOR, no row line moving (this job, R38, N854): C-1.1 and C-2.1 are judged by
   record-grammar's own arms, as `checkBundle` judges them: a non-replay promotion is refused BUNDLE_ID_DISAGREES exactly
   when `idDisagrees` is true (an id padded with white space is refused where it was trimmed and passed; a non-string id is
   C-1.2's and no longer refused here), and a creation or a revision is refused BUNDLE_MD_UNREADABLE on any C-2.1 finding
   of `parseFrontmatter` (a key given twice, a line outside the grammar), not only a revision whose block it reads no
   data from (K2706).
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T42 L3–L11 or T43 L1–L2 job record names beyond the rows
   above (inquiry's registered check now answers C-2.20 and investigation's C-146.26 under its new code, each counted
   with its row). T43's layer 1 changed C-33.40's `where` and no other row; its layer 2 is this job alone.
   ROW_CENSUS (R50) re-pinned to this tree: 1722 rows. Rows a T43 job in layers 3–11 adds or changes are T44's stamp
   (plan T43, rule 4 item 2). */
/* 1.71.0 (PROMOTION #42, T44-3, 2026-10-11; T43's rule 4 item 2, T44's rule 4 item 2; K1680, K2717, K2732): MINOR. The
   stamp of every row awaiting it at T43's close (T43's layers 3–11) and of T44's layers 1 and 2, read by diffing R50's
   census lines of `tranche/T44` at its layer 2 against 1.70.0's own (`test/fixtures/row-census-1.70.0.jsonl`: 1722 rows,
   f73c10a3…): two changed, none new, none re-keyed, none retired.
   CHANGED (2), translation only, code, number and `where` unmoved: extraction C-51.7 TRANSCRIBE_NOT_DEPLOYED (the
   assistant's reading of page pictures not yet switched on; "You can type a page's words yourself meanwhile"; T43-10,
   R47, K2717); ai-use C-143.4 EXPLORE_NOT_ENABLED ("Exploring is off on {whose} account. Its owners can switch it on.",
   DEC-189's `ai.refused.explorenotenabled`, which ai-use's R13 serves verbatim from `words.json`; T43-11, whose record
   names the words and not the row).
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T43 L3–L11 or T44 L1–L2 job record names. T44's layer 1
   (image-codecs, pdf-pixels) added and changed no row; its layer 2 is this job alone, whose one other change (R44: a
   fork's title written as the grammar reads it back) moves no row and no gate.
   ROW_CENSUS (R50) re-pinned to this tree: 1722 rows. Rows a T44 job in layers 3–11 adds or changes are T45's stamp
   (plan T44, rule 4 item 2). */
/* 1.72.0 (PROMOTION #43, T45-4, 2026-10-11; T44's rule 4 item 2, T45's rule 4 item 2; N892; K1680, K2786, K2795, K2796,
   K2797): MINOR. The stamp of every row awaiting it at T44's close (T44's layers 3–11) and of T45's layers 1 and 2, read
   by diffing R50's census lines of `tranche/T45` after membership and project-roster merged against 1.71.0's own
   (`test/fixtures/row-census-1.71.0.jsonl`: 1722 rows, c6a39c14…): ten new rows, one changed, none re-keyed, none
   retired.
   ARRIVED (10): project-roster C-147.1 PROJECT_SCOPE_UNKNOWN, C-147.2 PROJECT_SCOPE_NEEDS_HIDDEN, C-147.3
   PROJECT_SCOPE_OWN_NOT_SOLE, C-147.4 PROJECT_SCOPE_UNCHANGED (a project's scope, its R21), C-147.5 PROJECT_SCOPE_OWN,
   C-147.6 PROJECT_SCOPE_KEEPS_HIDDEN (its project-act guard, R22), C-147.7 APPROVAL_RULE_INVALID, C-147.8
   APPROVAL_KIND_UNKNOWN (the second-approval setting, R24) (the new family `PROJECT_SCOPE_CHECKS`; T45-3, K2797);
   membership C-56.6 PROJECT_GUARD_UNCHECKED (the project-act guard, its R128; T45-2, K2796); this module's C-86.16
   COUNSEL_MATTER_NOT_EVIDENCE (R57: a leg or a live `cites` entry newly naming a counsel matter's bundle from another
   project, or from none, is refused at the write; K2795's readings).
   CHANGED (1), code and number unmoved: ai-use C-143.5 EXPLORE_OUT_OF_SCOPE (`where` now `#outOfScope`, translation
   naming `{whose}` account and what its owners "chose to explore"; T44-7, AI-USE's record). C-143.6's line is unmoved
   (T44-7 changed how it is read, by key, not its row).
   T45's layer 1 (jurisdictions) added and changed no row.
   CHANGED IN WHAT THE GATES RUN, no row line moving: the promote door gains R57's own refusal, counted with its row
   above; membership's `MODULE_ORDER` gains the five new T45 modules (`case-check`, `action-holds`, `action-replies`,
   `plan-work` and `action-producers`; K2781 (1)), none of which registers a gate step yet, so no gate's
   order moves.
   ROW_CENSUS (R50) re-pinned to this tree: 1732 rows. Rows a T45 job in layers 3–11 adds or changes are T46's stamp
   (plan T45, rule 4 item 2). */
/* 1.73.0 (PROMOTION #44, T46-6, 2026-10-12; T45's rule 4 item 2, T46's rule 5 item 2; N902; K1680, K2891, K2917, K2931):
   MINOR. The stamp of every row awaiting it at T45's close (T45's layers 3–11) and of T46's layers 1 and 2, read by
   diffing R50's census lines of `tranche/T46` after record-core, membership and project-roster merged against 1.72.0's
   own (`test/fixtures/row-census-1.72.0.jsonl`: 1732 rows, 795f5029…): 152 lines arrived and twelve departed (145 new rows,
   seven moved to a new number, one re-numbered and re-worded, four retired), nineteen changed. Each is one a job record names (T45's ACTION-GRAMMAR's,
   ACTIONS', ACTION-HOLDS', ACTION-REPLIES', ACTION-PLANS', ACTION-CLOCKS', PLAN-WORK's, CASE-CHECK's, CASE-ACCOUNT's,
   CASE-AUTHORING's, CONFORMANCE's, CONSEQUENCES', FILINGS', FILING-TEMPLATES', LOCAL-FACTS', DUTIES', FOLLOWING's,
   STANDARDS', RUN-RULES', ANSWERS', DOCKET's, MONITORING's, PUBLICATION's, READING-GUIDES' and INSTANCE-SETUP's; T46's
   MEMBERSHIP's and PROJECT-ROSTER's).
   THE FAMILIES THAT ARRIVED, T45's new modules': `CASE_CHECK_CHECKS` C-148 (case-check), `ACTION_HOLDS_CHECKS` C-149
   (action-holds), `ACTION_REPLY_CHECKS` C-150 (action-replies), `PLAN_WORK_CHECKS` C-151 (plan-work) and
   `CASE_ACCOUNT_CHECKS` C-153 (case-account). No C-152: action-producers holds no family (K2891).
   ARRIVED (145): action-grammar C-117.30–.58 (29; the five shape codes and actions' new acts, renumbered contiguously
   before any stamp); consequences C-114.23–.44 (22: the addressed record, the success record, the carried outcome);
   filings C-115.45–.56 (12); local-facts C-126.6–.16 (11, the group's own rules); conformance C-113.37–.44 (8, the void
   determination and the cure); action-plans C-124.58–.65 (8, scenarios, pause and resume); plan-work C-151.1–.8 (8);
   action-replies C-150.1–.7 (7); action-holds C-149.8–.11 (4, beside the seven it took from actions, below);
   case-authoring C-136.3–.8 (6, carrying an outcome); duties C-133.40–.44 (5); following C-137.21–.25 (5, the watch);
   case-account C-153.1–.3; case-check C-148.1, .2; standards C-112.63, .64; run-rules C-109.13, .14; filing-templates
   C-125.33, .34; action-clocks C-123.7, .8; answers C-135.16 STANDING_ENDED; docket C-129.29 DOCKET_OUTCOME_UNREADABLE;
   monitoring C-18.19 WATCH_END_REFUSED; publication C-122.8 COUNSEL_MATTER_NOT_PUBLISHED; reading-guides C-144.19
   GUIDE_ITEM_UNSOURCED; setup C-64.27 STAKE_MALFORMED; membership C-96.52 HANDLE_FIXED (R129: `op=handlechange` refuses
   every change; its translation new).
   MOVED TO A NEW NUMBER (7), code and translation unmoved, `where` following the site (the old number departed, the new
   arrived): actions' hold and pressure rows into action-holds, C-117.20 MACHINE_CANNOT_SET_HOLD → C-149.1, C-117.21
   HOLD_REFUSED → C-149.2, C-117.23 HOLD_RELEASE_IS_ITS_OWN_ACT → C-149.3, C-117.24 HOLD_PROJECTS_REFUSED → C-149.4,
   C-117.25 HOLD_ALREADY_RELEASED → C-149.5, C-117.17 PRESSURE_MARKED → C-149.6, C-117.18 PRESSURE_NO_ENTRY → C-149.7.
   RE-NUMBERED AND RE-WORDED (1): membership's HANDLE_FIXED, C-96.50 departed and C-96.52 arrived (counted above), its
   condition and translation new (the old row retired with R124).
   RETIRED (4), their numbers never reused: filings C-115.19 NO_DETERMINATION; action-grammar C-117.22 HOLD_NO_LEGAL_MARK;
   membership C-96.49 HANDLE_CHANGE_NOT_A_MEMBER and C-96.51 HANDLE_CHANGE_UNCHECKED (R124 retired by refusal, R126).
   CHANGED (19), code and number unmoved. `where` only: conformance C-113.17, C-113.22 (`#reasonRefusal`); action-plans
   C-124.22 (`refuseNoSuchProposal`). `where` and translation: action-plans C-124.1 (`machineCannotPlan`). Translation
   only: conformance C-113.7; consequences C-114.16 ("A revision says why."); action-grammar C-117.19; action-plans
   C-124.30; local-facts C-126.1; docket C-129.19; reading-guides C-144.1, .2, .4; project-roster C-147.3–.8 (read by key
   from `words.json`, its R25). Membership's C-56.6 PROJECT_GUARD_UNCHECKED is unmoved (its R128 as K2917 folded it).
   T46's layer 1 (record-grammar, bundler) and record-core's T46 job added and changed no row.
   CHANGED IN WHAT THE GATES RUN, no row line moving: record-grammar's state tables (T46-1, its R35): an escalation gains
   `stopped_pursuing` and an action plan `paused`, with their edges, so C-4.1 and the promote fence (R15) admit those moves;
   `success_record` (`SUC-`) is a type the catalogue knows. No registered step, grammar, fact, case catalogue or listener
   changed since 1.72.0; membership's `MODULE_ORDER` gains the six interface modules after `store-door` (T46-4), none of
   which registers a gate step, so no gate's order moves.
   ROW_CENSUS (R50) re-pinned to this tree: 1872 rows. Rows a T46 job in layers 3–11 adds or changes are T47's stamp
   (plan T46, rule 5 item 2). */
/* 1.74.0 (PROMOTION #45, T47-10, 2026-10-12; T46's rule 5 item 2, T47's rules 5 (2) and 7a; K3027, K3037, K3039, K3040):
   MINOR. The stamp of every row awaiting it at T46's close (T46's layers 3–11) and of T47's layers 1 and 2, read by
   diffing R50's census lines of `tranche/T47` after record-core, membership, project-roster and credentials merged
   against 1.73.0's own (`test/fixtures/row-census-1.73.0.jsonl`: 1872 rows, 65a4bea3…): ten new rows, ninety-two changed,
   none re-keyed, none retired. Each is one a job record names (T46's ESCALATION's, RUN-RULES', AI-RUNS', INSTANCE-SETUP's,
   ANSWER-ENVELOPE's, ACTION-GRAMMAR's, ACTION-HOLDS', ACTION-PLANS', ACTION-REPLIES', CASE-ACCOUNT's, CASE-AUTHORING's,
   CONFORMANCE's, CONSEQUENCES', DUTIES', FILING-TEMPLATES', FILINGS', LOCAL-FACTS', READING-GUIDES' and STANDARDS'; T47's
   RECORD-CORE's and CREDENTIALS').
   NO FAMILY ARRIVED since 1.73.0: every new row joins a family its module already held.
   ARRIVED (10): escalation C-116.47 MACHINE_CANNOT_STOP, C-116.48 NOT_STOPPED (stopping pursuit); run-rules C-22.29
   AI_PART_NOT_DEPLOYED, C-22.30 MEMBER_RUN_MODE_NOT_ADMITTED (minted at ai-runs' `dispatchMemberRun`); instance-setup
   C-64.28 MACHINE_CANNOT_SET_INFO_LEVEL, C-64.29 INFO_LEVEL_UNKNOWN; answer-envelope C-69.6 DISCLOSURE_DUE (the door's,
   until T47-65 retires it, K3030); record-core C-102.33 SETTING_NOT_JSON (its R84, T47-6); credentials C-29.40
   DISCLOSURE_DUE (an API-key account reference while no disclosure is read, T47-9) and C-29.41
   AI_RUN_CREDENTIAL_MALFORMED (its R63's mint). C-69.6 and C-29.40 share a code and are two row objects, counted twice.
   CHANGED (92), code and number unmoved. Translation only (91), DEC-194's words read by key from `words.json` (N913):
   action-grammar C-117.30, .31, .33–.40, .42–.54, .56 (24); consequences C-114.23–.28, .30–.33, .35, .36, .38–.42 (17);
   filings C-115.45–.49, .51–.53 (8); local-facts C-126.6–.10, .12, .14, .15 (8); action-replies C-150.1–.6; action-plans
   C-124.30, .58–.62; conformance C-113.38–.43 (6 each); case-authoring C-136.3, .6–.8 (4); duties C-133.41, .42, .44;
   reading-guides C-144.4, .19; run-rules C-109.13, .14; standards C-112.63, .64; action-holds C-149.10; case-account
   C-153.2; filing-templates C-125.33. `where` only (1): escalation C-116.27 NOT_OPEN, now minted at `refuseNotOpen >
   is-escalation-open`, words unchanged. No row of extraction's C-51 moved.
   CHANGED IN WHAT THE GATES RUN, no row line moving: record-grammar's `checkBundle` admits a `success_record` object
   (T47-1, its R62: a `SUC-<year>-<digits>` id with no slug, its type, `success_record@1`), so C-1.2 and C-2.5 pass such a
   document where they refused it; `PROPOSAL_STATES` gains `status_report` (its R61), no gate's. Membership's
   `MODULE_ORDER` gains `case-inputs`, `action-records`, `screens-wizards`, `screens-investigate`, `screens-publish` and
   `screens-action` (T47-7), none of which registers a gate step, so no gate's order moves; membership's R133 froze its
   row tables, no line moving. T47's layer 1 (jurisdictions, connection-grammar, bundler, odf-reader, file-scanner) and
   project-roster's T47 job added and changed no row.
   ROW_CENSUS (R50) re-pinned to this tree: 1882 rows. Rows a T47 job in layers 3–11 adds or changes (case-inputs' and
   action-records' moved `where`s among them) are T48's stamp (plan T47, rule 5 item 2). */
/* 1.75.0 (PROMOTION #46, T48-12, 2026-10-14; T47's rule 5 item 2, T48's rules 5 (2) and 5 (6); N1018, N1052, N1056; K3192,
   K3195): MINOR. The stamp of every row awaiting it at T47's close (T47's layers 3–11) and of T48's layers 1 and 2, read
   by diffing R50's census lines of `tranche/T48` against 1.74.0's own (`test/fixtures/row-census-1.74.0.jsonl`: 1882 rows,
   42d2890c…): fifty-nine lines, seventeen new rows, forty-one changed, one retired (K3192 counts the same fifty-nine).
   Each is one a T47 job record names (ACTION-GRAMMAR's, ACTION-RECORDS', ACTION-PLANS', ACTION-REPLIES', ANSWER-ENVELOPE's,
   CASE-INPUTS', CREDENTIALS', DOCKET's, ESCALATION's, FILE-SAFETY's, FILING-TEMPLATES', FILINGS', INSTANCE-SETUP's,
   LOCAL-FACTS', MEMBERSHIP's, MONITORING's, RUN-RULES', STRENGTH's and TASKS').
   THE FAMILIES THAT ARRIVED, in T47 and not stamped by 1.74.0's note: `case-inputs`' `CARRIED_OUTCOME_CHECKS`
   (C-136.3–.8, taken by copy from case-authoring, T47-31) and its `STATEMENT_ACK_CHECKS` (C-82.2–.8); each row's line
   is counted where it now lives, and only its `where` (and C-136.5's translation) moved.
   ARRIVED (17): answer-envelope C-69.7 SIGNINTRACE_NOT_TEST; credentials C-29.42 REAUTH_DUE, C-29.43 SESSION_LOCKED,
   C-29.44 SIGNIN_NOT_HELD, C-29.45 SUBSCRIPTION_TOKEN_MALFORMED, C-29.46 RESET_LINK_DEAD, C-29.47
   RESET_LINK_MEMBER_NOT_ACTIVE and C-96.53 RECOVERY_CODES_NOT_A_MEMBER; file-safety C-140.43 RENDER_QUEUE_UNREADABLE;
   filings C-115.57 SENT_REFERENCE_MALFORMED, C-115.58 FILL_UNKNOWN_BLANK; monitoring C-18.20
   MACHINE_CANNOT_SET_MONITORING, C-18.21 MONITOR_SET_REFUSED; instance-setup C-64.30 LOGO_REFUSED; strength C-107.4
   PROJECT_BAR_NO_REASON; tasks C-138.16 MACHINE_CANNOT_ASK_SIGN, C-138.17 SIGN_ALREADY_ASKED.
   RETIRED (1), its number never reused: answer-envelope C-69.6 DISCLOSURE_DUE (T47-65 retired the door's copy, K3030;
   credentials' C-29.40 holds the code).
   CHANGED (41), code and number unmoved. `where` only (27): action-grammar C-73.2–.5, C-90.2, C-90.6, C-117.39,
   C-117.48–.52 (action-records' sites, T47); case-inputs C-136.3, .4, .6–.8 and C-82.2–.8; filing-templates C-125.4;
   local-facts C-126.7; strength C-32.9, C-107.2. `where` and translation (1): case-inputs C-136.5 BAD_CARRIED_OUTCOME.
   Translation only (13): action-plans C-124.63; action-replies C-150.3; credentials C-96.41; docket C-129.29; escalation
   C-116.14, C-116.41; file-safety C-140.2, .3, .13, .38; membership C-56.6; run-rules C-22.30.
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T47 L3–L11 or T48 L1 job record names. T48's layer 1
   (record-grammar, jurisdictions, signatures, bundler, court-citations, ooxml, file-scanner) added and changed no row.
   THE CENSUS'S SCRIPTS (R50, N1056): `bio-plane/src/journey-check/journey.mjs` runs its journey and exits when imported,
   so the census reads it as text only, beside the fleet members' `scripts/`; it holds no `check:` key, so the figures
   are unmoved by it.
   T48 LAYER 2, re-pinned in place after ai-accounts, record-core, membership and credentials merged (K3213, K3215,
   K3216, K3218): THE FAMILY THAT ARRIVED is `ai-accounts`' `AI_ACCOUNT_CHECKS` (the credentials split by copy, T48-10,
   K3101), into which credentials' C-29 rows moved, credentials' copies deleted (T48-11), so each is held once, as
   before. CHANGED (21), `where` only, code, number and translation unmoved, each naming `src/ai-accounts/`: C-29.13–.15,
   .17, .19–.22, .27, .29, .31 (`#keptAway > is-kept-away`), .32, .34–.40, .44, .45. No row arrived or departed. Record-core's
   N1018 sentence for `WCD` and `OUTC` is `mintExhausted`'s detail, not C-59.6's line, so no row moved; membership's T48
   job moved no row (its `MODULE_ORDER` gains `ai-accounts`, `signin-door` and `journey-check`, none of which registers a
   gate step, so no gate's order moves).
   ROW_CENSUS (R50) re-pinned to this tree: 1898 rows. Rows a T48 job in layers 3–11 adds or changes are T49's stamp
   (plan T48, rule 5 item 2). */
/* 1.76.0 (PROMOTION #47, T49-4, 2026-10-14; T48's rule 5 item 2, T49's rules 5 (2) and 7; K3321 (D), K3336, K3337, K3338):
   MINOR. The stamp of every row awaiting it at T48's close (T48's layers 3-11) and of T49's layer 2, read by diffing R50's
   census lines of `tranche/T49` (after membership, project-roster and credentials merged) against 1.75.0's own
   (`test/fixtures/row-census-1.75.0.jsonl`: 1898 rows, c57e3cf8...): thirty-four lines, ten new rows, twenty-three changed,
   one retired. Each is one a T48 or T49 job record names.
   ARRIVED (10): action-replies C-150.8 MACHINE_CANNOT_RECORD_QUOTING, C-150.9 QUOTING_NOT_RFC, C-150.10 QUOTING_REFUSED;
   following C-137.26 BAD_PROCEEDING_DATES; instance-setup C-64.31 LANGUAGE_NOT_SET, C-64.32 UPDATE_NOT_READY, C-64.33
   UPDATE_SKIP_NO_REASON; review C-87.17 REVIEW_BAD_UNTIL; entities C-91.9 NOT_A_PROCEEDING (the row C-117.28 moved to
   C-91.9); membership C-96.54 FOUNDER_HANDLE_NOT_FOUNDER (T49-1, N1072).
   RETIRED (1), its number never reused: C-117.28 NOT_A_PROCEEDING (now C-91.9).
   CHANGED (23), code and number unmoved: conformance C-113.6 NO_FINDINGS; filing-templates C-115.47
   RFC_QUOTING_MISSING and filings C-115.48 NOT_A_PARTNER; action-grammar C-117.34 MACHINE_CANNOT_SET_PARTNERS, C-117.35
   PARTNERS_REFUSED, C-32.4 MACHINE_CANNOT_CORRESPOND, C-33.5-.9 (BAD_DIRECTION, BAD_DATE, CAPTURE_AND_TESTIMONY,
   NEITHER_CAPTURE_NOR_TESTIMONY, UNREGISTERED_ARTIFACT); wizard-scripts C-131.7, C-131.24; reading-guides C-144.4,
   C-144.13; credentials C-29.41 AI_RUN_CREDENTIAL_MALFORMED and (T49-3, N1075, words read by key) C-96.39 SIGN_IN_PAUSED,
   C-96.40 NOT_SIGNED_IN, C-96.41 RECOVERY_REFUSED, C-96.46 CURRENT_PASSWORD_WRONG; membership (T49-1, N1075) C-96.32
   NO_SUCH_JOIN_LINK, C-96.33 JOIN_LINK_DAILY_CAP and C-96.52 HANDLE_FIXED (`where` and translation).
   THE FAMILIES THAT ARRIVED: none. CHANGED IN WHAT THE GATES RUN, no row line moving: none a T48 L3-L11 or T49 L2 job
   record names. Credentials added no row (K3337).
   ROW_CENSUS (R50) re-pinned to this tree: 1907 rows. Rows a T49 job in layers 3-11 adds or changes are T50's stamp
   (plan T49, rule 5 item 2). */
/* 1.77.0 (PROMOTION #48, T50-6, 2026-10-17; T49's rules 5 (2) and 7, T50's rule 5 (2); K3624, K3625, K3633, K3636, K3638):
   MINOR. The stamp of every row awaiting it at T49's close (R085's and T49's layers 3-11) and of T50's layer 2, read by
   diffing R50's census lines of `tranche/T50` (after ai-accounts, membership, credentials and project-roster merged, and
   this module's own N1116 words) against 1.76.0's own (`test/fixtures/row-census-1.76.0.jsonl`: 1907 rows, e2035581...):
   seventy lines, two new rows, sixty-eight changed, none retired.
   ARRIVED (2): project-roster C-147.9 MACHINE_CANNOT_SET_STAKE, C-147.10 STAKE_MALFORMED (T50-3, N933).
   CHANGED (68), code and number unmoved, each its translation (N1116, the words read by key `refusal.<CODE>`, "team" for
   "group", N1160) unless named: promotion (this job) the 38 rows it holds that the design keys, of which the census
   moves C-32.5 MACHINE_CANNOT_REOPEN, C-64.1 GROUP_UNDETERMINED, C-86.3 ENVELOPE_TITLE_DISAGREES, C-86.14
   REVISION_REGROUPS_BUNDLE, C-97.1 PROJECT_VISIBILITY_NO_OWNER and C-102.4 to C-102.8 (the rest read by key the words
   they had); ai-accounts C-29.6-.10, C-29.15, .17, .20, .22, .27, .29-.32, .45 (the T50-4 moves, K3625; C-29.6-.10 and
   C-29.30 from R085/T49 as well); credentials and the door C-32.17 OPERATOR_TOKEN_CANNOT_GOVERN, C-38.1-.11, C-64.4
   GROUP_IDENTITY_NEEDS_SESSION, C-78.1-.3; membership C-55.1, C-56.6, C-70.2 and C-96.1-.3, .6, .11, .18, .22,
   .25, .27-.33, .35-.38, .47, .54, C-102.11, C-102.12 (listenerRefusal); project-roster C-147.8 APPROVAL_KIND_UNKNOWN.
   THE FAMILIES THAT ARRIVED: none. CHANGED IN WHAT THE GATES RUN, no row line moving: none a T49 L3-L11 or T50 L2 job
   record names (membership's `MODULE_ORDER` is now generated from `modules.json`, which moves no gate's order).
   ROW_CENSUS (R50) re-pinned to this tree: 1909 rows. Rows a T50 job in layers 3-11 adds or changes are T51's stamp
   (plan T50, rule 5 item 2). */
/* 1.78.0 (PROMOTION #49, T51-15, 2026-10-18; T50's rule 5 (2), T51's rule 5 (2); K3843): MINOR. The stamp of every row
   awaiting it at T50's close (T50's layers 3-11) and of T51's layer 2 (membership, project-roster, credentials merged
   into `tranche/T51`), read by diffing R50's census lines of that tree against 1.77.0's own
   (`test/fixtures/row-census-1.77.0.jsonl`: 1909 rows, 962db2b0...): nine new rows, 327 changed, none retired.
   ARRIVED (9): C-100.26 NO_SET, C-100.27 SET_TOO_LARGE; C-137.27 MARK_NO_ITEM, C-137.28 MARK_NO_SUCH_ITEM, C-137.29
   SECOND_LOOK_NO_NOTE, C-137.30 SECOND_LOOK_NOT_OPEN; C-139.21 BAD_FOR; C-22.31 LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE;
   C-25.36 VERSION_NAME_MALFORMED.
   CHANGED (327), code and number unmoved, each its `where` or translation (the words read by key, N1116, as the
   modules that hold them moved them); the list is the diff of the two fixtures. THE FAMILIES THAT ARRIVED: none.
   CHANGED IN WHAT THE GATES RUN, no row line moving: none a T50 L3-L11 or T51 L2 job record names. This module adds
   no row (R58 is a read).
   ROW_CENSUS (R50) re-pinned to this tree: 1918 rows. Rows a T51 job in layers 3-11 adds or changes are T52's stamp
   (plan T51, rule 5 item 2). */
/* 1.79.0 (PROMOTION #51, CR-5, 2026-10-19; T51's rule 5 (2); K4015, K4104, K4114): MINOR. The stamp of every row the jobs
   after T51's layer 2 added or changed (L3 to L11 and R1 to R8, and the completion round's jobs merged before this
   one), read by diffing R50's census lines of `tranche/T51` against 1.78.0's own (`test/fixtures/row-census-1.78.0.jsonl`:
   1918 rows, 31b4a129...): five new rows, 75 changed, none retired.
   ARRIVED (5): C-117.59 MINUTES_NOT_PUBLIC_COMMENT, C-117.60 BAD_MINUTES; C-25.37 VERSION_COMPARE_NO_INQUIRY, C-25.38
   VERSION_COMPARE_NO_VERSION, C-25.39 VERSION_COMPARE_NO_SUCH_VERSION.
   CHANGED (75), code and number unmoved, each its `where` or translation (the words read by key, as the modules that hold
   them moved them); the list is the diff of the two fixtures. THE FAMILIES THAT ARRIVED: none. CHANGED IN WHAT THE
   GATES RUN, no row line moving: none a job record names. This module adds no row (R59 is a field of a read). The
   census no longer leaves out `civicos-ui/` scripts, the directory being deleted (T51-126, K3838, N1246).
   ROW_CENSUS (R50) re-pinned to this tree: 1923 rows. Rows a T52 job adds or changes are T53's stamp. */
/* 1.80.0 (PROMOTION #1, T52-8, 2026-10-27; K5339): MINOR. The stamp of every row the jobs after 1.79.0's tree added or
   changed (modules after layer 2, merged after PROMOTION #51's stamp; no job record named them `awaiting stamp`), read by
   diffing R50's census lines of this tree against 1.79.0's own (`test/fixtures/row-census-1.79.0.jsonl`: 1923 rows,
   c5885eaf...): 48 new rows, 12 changed, none retired. THE CAUSE of T51's red `row-census`: the pin was stamped once
   and rows moved after it with no stamp, which the suite refuses by name; this is the layer-2 stamp it waits for.
   ARRIVED (48): C-102.34-.39, C-103.8-.12, C-107.5, C-113.45, C-118.11, C-124.66, C-130.17-.22, C-136.9, C-138.18-.19,
   C-140.44-.45, C-154.1, C-155.1, C-18.22-.24, C-33.55-.64, C-87.18, C-91.10-.11, C-93.40-.42, C-96.55.
   CHANGED (12), code and number unmoved: C-113.32, C-140.4, C-140.7, C-146.25, C-146.6, C-146.7, C-33.54, C-87.1,
   C-94.5, C-94.6, C-96.17, C-96.39. THE FAMILIES THAT ARRIVED: none. This module adds no row.
   ROW_CENSUS (R50) re-pinned to this tree: 1971 rows. Rows a T52 job adds or changes are T53's stamp. */
export const CATALOG_VERSION = "1.80.0";
/* D-147 side, kept as history — took 1.30.0 (D-147, 2026-09-25, branch land/worker/D-147): 1.29.0 -> 1.30.0, MINOR — eleven checks ADDED (C-94.1-11, LIFECYCLE_CHECKS, the records-request lifecycle), none changed or removed; the census read from the d470 suite's print (466 -> 477). CONDUCT reconciles the number at integration if another branch takes 1.30.0 first. */
/* MK-7 side, kept as history — took 1.30.0 (MK-7, 2026-09-25, branch land/worker/MK-7): ONE NEW FAMILY, ATTRIBUTION_CHECKS (C-92.1-.12, the
   attribution act and its gate), and three TESTIMONY_CHECKS rows (C-53.10-.12) re-worded as their fence is narrowed.
   466 -> 478, read from d470-catalog-census.test.mjs's own print on this tree. MINOR: arrivals only. */
/* REC-147 side, kept as history — its own note on its own branch: */
/* 1.30.0 (REC-147, 2026-09-25, branch land/worker/REC-147): C-93's seven rows arrive in the new
   CONTRADICTION_CANDIDATE_CHECKS family — op=contradictionpropose's refusals — so the catalogue grew 466 -> 473 and the
   stamp moves with it, MINOR and additive on this constant's own rule: seven checks arrive, none moves, none leaves.
   AT A UNION the census is RE-READ from the d470 suite's print on the merged tree, never added by hand. */
/* REC-197 side, kept as history — its own note on its own branch: */
/* 1.30.0 (REC-197, 2026-09-25, branch land/worker/REC-197, stacked on land/worker/REC-196 @ 82f604d2): C-97.1
   PROJECT_VISIBILITY_NO_OWNER and C-97.2 PROJECT_VISIBILITY_NOT_A_CREATION, the new PROJECT_CREATION_VISIBILITY_CHECKS
   family (a creation's `visibility`, BOB #32's ruling (b)). TWO ARRIVALS, NO DEPARTURES: MINOR and additive on this
   constant's own rule. CONDUCT reconciles the VERSION at integration if another branch takes 1.30.0 first. */
/* D-521b side, kept as history — its own note on its own branch: */
/* 1.31.0 (D-521, 2026-09-25, branch land/worker/D-521b): ONE DEPARTURE, NO ARRIVALS. C-82.1
   STATEMENT_ACK_DOCUMENTS_OVER_BOUND is retired as unreachable (the read it guarded returns at most two rows against a
   bound of 8). Rule 17 moves the stamp for a removed check. MINOR: nothing that passed now fails. The census is the
   d470 suite's own print; CONDUCT re-reads it on the union if another branch moves this constant. */
/* D-561 side, kept as history — took 1.31.0 (D-561, 2026-09-25, branch land/worker/D-561): the new PUBLISHED_READ_CHECKS family (C-98.1..8, the public
   door's refusals at op=publishedbytes and op=publishedcase) and C-69.2 STORE_DID_NOT_ANSWER join the catalogue — nine
   arrivals, none moved or removed, MINOR on this constant's own rule. 502 -> 511 from the d470 suite's print. */
/* 1.24.0 (D-491, 2026-09-24, branch land/worker/D-491): C-28.16
   CAPTURE_REQUEST_RENDER_MALFORMED joined CAPTURE_REQUEST_CHECKS — the capture-request
   door's refusal of a `render` flag that is neither true nor absent (IC-276) — so the
   catalogue moved 447 -> 448 checks and the stamp moves with it, MINOR and additive on
   this constant's own rule. The figure and the digest recorded in
   `test/d470-catalog-census.test.mjs` are THAT SUITE'S OWN PRINT on this tree, never
   arithmetic on 447. THE A3 CENSUS SUITE CAUGHT IT on this item's first full gate.
   **THREE ITEMS WERE RUNNING BESIDE THIS ONE in render and capture code (D-490, D-492,
   D-499): if any of them also took 1.24.0, the integrator re-reads the census on the
   union and this row takes the next number — one version names one catalogue.** */
/* 1.26.0 AT THE THIRD UNION (CONDUCT #20, c20-batch25): D-491 took 1.24.0 on its branch for 447 + 1 (C-28.16), but main's line is already 1.25.0 = 457 (c20-batch23). ONE VERSION NAMES ONE CATALOGUE, so the union moves the stamp once more, MINOR: 458, read from the d470 suite's print. */
/* 1.27.0 AT THE UNION (CONDUCT #20, c20-batch25): D-472 took a branch version over its own base; the line already stood at 1.26.0, so the union takes the next number once, MINOR, its census read from the d470 suite's print. */
/* 1.28.0 AT THE UNION (CONDUCT #20, c20-batch25): D-510 took a branch version over its own base; the line already stood at 1.27.0, so the union takes the next number once, MINOR, its census read from the d470 suite's print. */
/* 1.26.0 (D-463, 2026-09-24, branch land/worker/D-463, REBASED onto main @ 1a7f0bcc): two checks ARRIVE and
   none departs — C-78.3 NAMESPACE_CONFINED in NAMESPACE_CHECKS and C-29.10 AI_CONFINEMENT_NOT_SCRATCH in
   AI_CREDENTIAL_CHECKS — so the catalogue moved 457 -> 459 and the stamp moves with it, MINOR and additive on
   this constant's own rule (Publication §3 rule 17). **THIS BRANCH FIRST TOOK 1.24.0 FOR 447 -> 449, WHICH WAS
   TRUE OF ITS OLD BASE AND IS DROPPED:** main's 1.24.0 is the D-507 + D-508 catalogue and its 1.25.0 is
   REC-211's, so this item's two rows are a THIRD catalogue and take the next number. ONE VERSION NAMES ONE
   CATALOGUE, which is the d470 table's whole rule. Figures RE-READ from the d470 suite's own print on the
   rebased tree, never arithmetic and never this branch's old figure. */
/* 1.29.0 AT THE UNION (CONDUCT #20, c20-batch27): D-463 took a branch version over its own base; the line already stood at 1.28.0, so the union takes the next number once, MINOR, its census read from the d470 suite's print. */
/* 1.26.0 (D-513, 2026-09-24): `op=knock`'s three pre-store refusals take catalogue rows —
   C-85.3 KNOCK_ENVELOPE_TOO_LARGE, C-85.4 KNOCK_PAYLOAD_TOO_LARGE and C-85.5 KNOCK_EMPTY in the
   existing `KNOCK_CHECKS` family — so the catalogue moved 457 -> 460 checks and the stamp moves with
   it. THREE ARRIVALS, NO DEPARTURES, so the bump is MINOR on this constant's own rule (Publication §3
   rule 17): nothing the catalogue passed is now refused. The census figures below are the d470 suite's
   own print on this item's tree over origin/main 1a7f0bcc0, never 457 + 3. THE BASE READ IS main's
   1.25.0 (c20-batch23's second union); CONDUCT #20's c20-batch25 moves the same constant in parallel,
   so ONE VERSION NAMES ONE CATALOGUE (A4) makes the number at the union CONDUCT's to take once, from
   the d470 suite's print on the merged tree — this branch's figure is this branch's catalogue. */
/* 1.29.0 AT THE UNION ALSO CARRIES D-513 (CONDUCT #20, c20-batch27): D-513 took 1.26.0 over its own base; the union's ONE new number for this batch is 1.29.0, holding D-463's and D-513's checks together, its census read from the d470 suite's print. */
/* 1.29.0 (D-547, 2026-09-25, branch land/worker/D-547 over land/worker/D-526): C-86.2 REVISION_RETYPES_BUNDLE joins PROMOTED_TYPE_CHECKS — one check ADDED, none moved or removed, MINOR. Census from the d470 suite's print on this tree. OTHER BRANCHES ALSO TAKE 1.29.0: one version names one catalogue, so the integrator takes the next number at the union and re-reads the print. */
/* 1.29.0 (D-549, 2026-09-24, branch land/worker/D-549, base 9f8b69e6): C-68.5 NO_PUBLISHED_STORE joined INSTALLATION_CHECKS,
   so the catalogue moved 461 -> 462 checks (the d470 suite's print) and the stamp moves with it, MINOR and additive. If
   another branch in the same train also took 1.29.0, the integrator re-reads the census on the union and this row takes
   the next number — one version names one catalogue. */
/* 1.26.0 (REC-205, 2026-09-24, branch land/worker/REC-205): C-33.44 CLASS_NOT_DISPOSED joins
   ACT_SHAPE_CHECKS — op=proposedispose refuses a CONDITION or an OBLIGATION by its CLASS, naming the act
   that does reach it, where it used to answer NO_SUCH_PROGRESSION. One arrival, no departure, nothing
   moved: MINOR on this constant's own rule (Publication §3 rule 17). 457 + 1 = 458, count and digest
   re-read from the d470 suite's own print on this tree. */
/* 1.26.0 (REC-207, 2026-09-24): BOB #32's ruling of 2026-09-23 23:42Z on what settles a bias-debt
   obligation added TEN rows — C-26.13 to C-26.19 in BIAS_CHECKS (the member's resolve) and C-33.45 to
   C-33.47 in ACT_SHAPE_CHECKS (the re-run link, judged at op=airunopen's door). MINOR and additive on
   this constant's own rule (Publication §3 rule 17): ten checks arrive, none moves and none leaves.
   457 + 10 = 467, and the count and digest recorded in d470-catalog-census.test.mjs are THAT SUITE'S
   OWN PRINT on this tree, never the arithmetic — the arithmetic would agree with itself for free. */
/* 1.29.0 (D-530, 2026-09-24): the catalogue gained C-89.1 (ATTEST_CHECKS, CAPTURE_HELD_IN_PARTS), 461 -> 462, MINOR, its census read from the d470 suite's print. */
/* 1.30.0 AT THE UNION (CONDUCT #21, c21-batch28): every branch above that took a number over its own base rides ONE new
   number — D-448 (C-87), D-468 (C-26.12), REC-205 (C-33.44), REC-207 (C-26.13..19, C-33.45..47, renumbered off
   those two collisions), D-512 (C-66.6), D-530 (C-89.1), D-547 (C-86.2), D-549 (C-68.5), REC-214 (C-90), D-454
   (C-74.4), REC-217 (C-44.3..5) and D-450 (C-41.12 CHANGED) — MINOR, since no check leaves; count and digest are
   the d470 suite's print on the merged tree. */
/* D-134 side, kept as history — took 1.30.0 (D-134, 2026-09-25, branch land/worker/D-134): the new CUSTODIAL_CHECKS family, C-96.1-.9 —
   §4.9's custodial acts' refusals given canned translations, and `adminRemove`'s target case split to
   TARGET_NOT_AN_ADMIN — so the catalogue moved 466 -> 475 and the stamp moves with it. NINE ARRIVALS, NO
   DEPARTURES, so the bump is MINOR on this constant's own rule (Publication §3 rule 17). Figures are the
   d470 suite's own print on this tree over origin/main 964da679. If another branch also took 1.30.0, the
   union takes the next number once — ONE VERSION NAMES ONE CATALOGUE. */
/* D-563 side, kept as history — took 1.31.0 (D-563, 2026-09-25, branch land/worker/D-563): TWO ARRIVALS, NO DEPARTURES, NONE CHANGED — C-86.3
   ENVELOPE_TITLE_DISAGREES and C-86.4 ENVELOPE_STATE_DISAGREES in PROMOTED_TYPE_CHECKS. MINOR; 502 -> 504, count and
   digest from the d470 suite's print on this tree. If another branch in the batch also moves the version, CONDUCT takes
   the next number at the union and re-reads the print on the merged tree. */
export const GATE_VERSION = `plane-gate/1.0 (bio-checks ${CATALOG_VERSION})`;
/* R50 (N319, K431): the census of every refusal row as this stamp read it, pinned here and held against the tree by
   this module's own census suite, `bio-plane/test/system/row-census.test.mjs` (legacy-tests' until T22's opening, K1006):
   a test may import every module's tables, which this module's source cannot (P4). The stamp that moves CATALOG_VERSION
   re-pins it. */
export const ROW_CENSUS = Object.freeze({ version: CATALOG_VERSION, rows: 1971,
  digest: "17406b472cd7001dfef7d6028e0746b51ef7df322d42ad9fff1f2e1af16a5609" });

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const te = new TextEncoder();

/* CASE-5b / DEC-72: THE CASE DOCUMENT'S GATE, run at op=caseratify and nowhere
   else — `runGate`'s own rule one level up, and for the same reason: a catalog
   that runs at two doors is a catalog whose two doors drift.

   IT RUNS THE CATALOG RATHER THAN REIMPLEMENTING IT, which is this file's whole
   premise. The registered catalogue is a pure function over the parsed frontmatter
   and two facts the document cannot carry about itself (which case and which
   edition the store is about to commit it as, and what the PREVIOUS edition of
   this case asserted, for C-21.1). Passing null for the prior case does not
   soften C-21.1, it BLINDS it — the same sentence `runGate` already carries
   about `publishedRegistry`, arriving at case altitude.

   THE VERSION IT REPORTS IS THE SAME `GATE_VERSION`, deliberately: what judged a
   ratification is one catalog at one version, and giving the case door a version
   of its own would let the two drift apart while each looked internally
   consistent. A member reading `plane-gate/1.0 (bio-checks 1.21.0)` on a case
   ratification and on a finding ratification has read the same fact. */
/* D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): two more facts the document cannot carry about
   itself — its BODY (C-3.1's section followed the block into it) and each member's `basis` at the
   PINNED bytes (C-2.8's testimony-row and per-ground arms read it). Omitting `memberBasis` BLINDS
   those two arms rather than softening them; the store supplies it with the rest of the facts. */
/* R33, N254, N275: the one refusal the case gate makes of its own, CASE_CATALOGUE_FAILED (C-102.9), when no
   case-document catalogue is registered (K529), or the one registered threw `e` or answered no list of findings: nothing
   has judged the document, so it is not passed. It builds the gate's whole answer, R29's verdict with `ok: false` at the
   top and its one finding naming C-102.9's code, so the region C-102.9's `where` names holds the refusal's verdict. The
   answer is a verdict, never a refusal with a `reason` (K534). */
function caseCatalogueFailed(e) {
  return { gateVersion: GATE_VERSION, ok: false,
           findings: [{ check: "CASE_CATALOGUE_FAILED",
                        detail: localize("promotion.gate.the_case_document_catalogue_could", "the case-document catalogue could not judge this document, so it is not passed: {String}", { String: String(String(e && e.message ? e.message : e).slice(0, 200)) }) }],
           warnings: 0 };
}

/* R33, R47 (K529): `catalogue` is the case-document catalogue promotion runs, the one a later module registered with the
   promotion instance (ratification's). There is no fallback: with none registered, nothing judges the document, and the
   gate answers C-102.9. A catalogue that throws or does not answer with findings has judged nothing either, so the gate
   fails closed on it (never throws, never passes). */
export function runCaseGate({ caseId, edition, fm, priorCase, body = null, memberBasis = null } = {}, catalogue = null) {
  if (typeof catalogue !== "function")
    return caseCatalogueFailed(new Error("no case-document catalogue is registered with this instance"));
  let findings;
  try {
    findings = catalogue(fm, { caseId, edition, priorCase: priorCase || null, body, memberBasis });
    if (!Array.isArray(findings) || !findings.every((x) => x && typeof x === "object"))
      throw new Error("the catalogue answered no list of findings");
  } catch (e) {
    return caseCatalogueFailed(e);
  }
  const errors = findings
    .filter((x) => x.severity === "error")
    .map((x) => ({ check: x.check, detail: x.message, ...(x.repairs ? { repairs: x.repairs } : {}) }));
  return {
    gateVersion: GATE_VERSION,
    ok: errors.length === 0,
    findings: errors,
    warnings: findings.filter((x) => x.severity !== "error").length,
  };
}

/* R27 (§1b, K585 (2), K785): `grammars` are the type grammars later modules registered with record-core
   (`record.grammars()`, `[{module, ids, arm}]` in module order), passed to record-grammar's `checkBundle` as its
   `opts.grammars`: each fills its slot, so a grammar judges the bundle at the gate exactly as at the audit. Promotion's
   instance passes its record's (`Promotion#runGate`), each registered by the module that owns it (the catalogue's legacy
   registration left in T20); a caller of this function with none passes none, and only the structural arms run. */
export async function runGate({ bundleId, image, knownIds, hasCapture, registers, releaseRegistry,
                                publishedRegistry, publishedCaseRegistry, earnedRegistry, grammars = null }) {
  const files = new Map(), elided = new Set();
  for (const [path, v] of Object.entries(image || {})) {
    if (typeof v === "string") files.set(path, v);
    else elided.add(path);
  }

  const sha256 = async (v) => hex(await crypto.subtle.digest("SHA-256", typeof v === "string" ? te.encode(v) : v));
  const { findings: catalogue } = await checkBundle({
    folderName: bundleId,
    files,
    elidedPaths: elided,
    sha256,
    sha512: async (b) => new Uint8Array(await crypto.subtle.digest("SHA-512", b)),
    resolveTarget: (id) => knownIds.has(id),
    releaseRegistry: releaseRegistry || null,
    /* REC-14: the published projection, supplied by ratification's gateFacts for
       the bundle being gated and for every target its basis names. C-21.1 and
       C-21.2 are the two checks in the catalog that cannot be answered from
       the bundle alone: what the PREVIOUS EDITION of this case asserted, and
       what strength the case beneath this one FROZE when the group signed it.
       Passing null here does not soften the gate, it blinds it -- so it is
       threaded from the one place that has the rows. */
    publishedRegistry: publishedRegistry || null,
    /* REC-44: and C-21.1's fact at CASE altitude -- what the PREVIOUS EDITION
       OF THIS CASE asserted about its own limits. A case is a container over
       one or more findings (DEC-44), so this cannot be read off the finding
       being gated and arrives in its own registry. Passing null blinds C-21.1
       exactly as passing null above blinds C-21.2. */
    publishedCaseRegistry: publishedCaseRegistry || null,
    /* REC-18: what each basis target EARNS, supplied by ratification's gateFacts
       for the bundle being gated. The third fact the catalog cannot answer from
       the bundle alone -- an EARNED grade is computed from `resolutions` and the
       capture record, so a leg claiming one can only be confirmed where those
       rows are. Passing null here does not soften the gate either: checkEarnedLeg
       refuses the leg outright rather than waving it through, which is why the
       blinding is loud instead of silent. */
    earnedRegistry: earnedRegistry || null,
  }, { grammars });
  /* R30–R32 (K64): the checks that read a bundle's record of promotions and its release signatures (C-4.2, C-17.2,
     C-18.8, C-20.1) left the catalogue for this module, and run here, after it, over the same image. */
  const findings = [...catalogue, ...await recordChecks({ folderName: bundleId, files, raw: image || null,
                                                           releaseRegistry: releaseRegistry || null, sha256 })];

  const errors = findings
    .filter((f) => f.severity === "error")
    .map((f) => ({ check: f.check, detail: f.message, ...(f.repairs ? { repairs: f.repairs } : {}) }));

  /* The plane's own remaining duty: bytes the register claims must exist. */
  for (const r of registers || []) {
    let probe = await hasCapture(r.capture_sha);
    /* R28 (K5130): a register row whose `path` in the image holds bytes hashing to its `capture_sha` is present
       there: a member's own testified observation is held only so (provenance's `testify`, an inline file
       registered with its digest), never in the bucket. Bytes that differ leave the bucket's answer as it was. */
    if (!probe.present && typeof image?.[r.path] === "string") {
      const held = image[r.path];
      if (await sha256(held) === r.capture_sha) probe = { present: true, bytes: te.encode(held).length };
    }
    /* D-556 (BOB #34, 2026-09-25 00:00Z; Intake Doctrine section 8): A WHOLE-HASH ROW HELD IN PARTS RATIFIES
       when every part the record names (the bundle's data/provenance.json) is present and its digest verifies:
       the audit calls those bytes SOUND (D-533), and publication now copies them part by part and re-verifies
       each at the destination, so the gate may not treat them as missing. Otherwise it is refused BY NAME: the
       parts that are not there, or the parts whose size or digest failed or could not be checked. */
    if (!probe.present && probe.parts) {
      const { named, missing, disagree, unverified, why } = probe.parts;
      const sum = (named || []).reduce((n, p) => n + p.bytes, 0);
      const label = (ps) => ps.map((p) => p.file || p.sha256).join(", ");
      if (why)
        errors.push({ check: "PLANE_PART_UNVERIFIED",
                      detail: localize("promotion.gate.registered_capture_is_held_in", "registered capture is held in parts, and {why}, so no part could be verified", { why: String(why) }),
                      where: { path: r.path, sha256: r.capture_sha } });
      else if (missing.length)
        errors.push({ check: "PLANE_PART_MISSING",
                      detail: localize("promotion.gate.registered_capture_is_held_in_2", "registered capture is held in parts, and {length} of the {length_2} parts the record names are not in the working bucket: {label}", { length: String(missing.length), length_2: String(named.length), label: String(label(missing)) }),
                      where: { path: r.path, sha256: r.capture_sha, missing_parts: missing } });
      else if (disagree.length || unverified.length || (typeof r.bytes === "number" && sum !== r.bytes))
        errors.push({ check: "PLANE_PART_UNVERIFIED",
                      detail: disagree.length
                        ? localize("promotion.gate.registered_capture_is_held_in_3", "registered capture is held in parts, and the stored size or digest of {length} disagrees with the record: {label}", { length: String(disagree.length), label: String(label(disagree)) })
                        : unverified.length
                        ? localize("promotion.gate.registered_capture_is_held_in_4", "registered capture is held in parts, all present, but the digest of {length} could not be verified: {label}", { length: String(unverified.length), label: String(label(unverified)) })
                        : localize("promotion.gate.registered_capture_is_held_in_5", "registered capture is held in parts, and the parts the record names sum to {sum} bytes where the register says {bytes}", { sum: String(sum), bytes: String(r.bytes) }),
                      where: { path: r.path, sha256: r.capture_sha,
                               ...(disagree.length ? { disagreeing_parts: disagree } : {}),
                               ...(unverified.length ? { unverified_parts: unverified } : {}) } });
      continue;
    }
    /* D-530: a whole hash held only in parts is not missing bytes, and saying so was
       false. D-556: it is still refused when the record names NO parts for it, since
       then there is nothing to verify or to copy under any hash. */
    if (!probe.present && probe.heldInParts)
      errors.push({ check: "PLANE_HELD_IN_PARTS",
                    detail: localize("promotion.gate.registered_capture_is_held_only", "registered capture is held only in parts: the acquisition receipt of your team's Civicsmith names the whole hash, and the working bucket stores the document as its parts, each under its own hash, but the record's data/provenance.json names no parts for it. Publication copies the parts the record names, so name them there, or register the parts rather than the whole"),
                    where: { path: r.path, sha256: r.capture_sha } });
    else if (!probe.present)
      errors.push({ check: "PLANE_MISSING_BYTES", detail: localize("promotion.gate.capture_absent_from_bucket", "registered capture is absent from the working bucket"),
                    where: { path: r.path, sha256: r.capture_sha } });
    else if (typeof r.bytes === "number" && probe.bytes !== r.bytes)
      errors.push({ check: "PLANE_SIZE", detail: localize("promotion.gate.capture_bytes_differ", "capture bytes differ from the register"),
                    where: { path: r.path, want: r.bytes, got: probe.bytes } });
  }

  return {
    gateVersion: GATE_VERSION,
    ok: errors.length === 0,
    findings: errors,
    warnings: findings.filter((f) => f.severity !== "error").length,
  };
}
