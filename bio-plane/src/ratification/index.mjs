/* ratification — the two signing ceremonies and what they judge (requirements: `build/requirements/ratification.md`;
 * Membership v2 §7, BIO_Publication_v0_1.md §2–§4). Publication takes two signatures: an owner signs the case document
 * (`op=caseratify`), and each finding and the evidence it rests on crosses by its own signature (`op=ratify`). This
 * module holds both ceremonies: whether the project's conclusion a case document records still stands (R1), whether
 * the document is well-formed (the case-document catalogue, R8, in `./checks.mjs`), what may cross and under whose
 * authority (R3–R5), and the facts the signer's gate reads (R7). It commits through `publication`, which holds the
 * record; it authors nothing and owns no table.
 *
 * Extracted from the legacy modules (T8, layer 8; K3, K6, K57, K61, K83 (3), K93 (3), K94, K102): from `store.mjs`, the
 * case-conclusion comparison (`CASE_BEARING_STATES`, `#caseConclusionFor`, `#editionsRecordingConclusion` and its three
 * statics, with the one writer of a `case_conclusions` row), `ratifyCaseDocument`, `gateFacts`, `publish` and their
 * dispatch entries; from `index.mjs`, the two handlers (now `./ops.mjs`, the Worker half); from `bio-checks.mjs`, the
 * catalogue and rows in `./checks.mjs`. The legacy code's comments moved with it, shortened where they only restated
 * the code; the commit's own SQL is `publication`'s (its R22) and its comments went with it. In T18 (N400, K636) the
 * bulk release (`Store.release`, R20–R27) moved here from `store.mjs` as `./release.mjs`, and in T19 (K653 BOB-3) the
 * bulk retirement (`Store.retire`, R28–R31, R33) as `./retire.mjs`. In T51 (G54, R57) `./casefile.mjs` holds the case-file
 * sweep (`caseFileSweep`, `caseFileWake`), which builds the case file of a complete edition every completing path left owed.
 *
 * REACHED as `ratificationOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call. At creation it creates `publish-schedule` and registers R42 as its publisher (its R2; R43 here), and it
 * registers the case-document catalogue with `promotion` (its R47; R8 here), the
 * case-member arm of C-2.8 as a promotion check and a record-core audit check (R9), and its mint-ledger seed sources
 * (`cases`, `case_documents`) with record-core (its R70; K783).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `head`, `transact`, `registerAuditCheck`, `registerMintSeed`,
 *                                   `evidenceStore`; `caseAuthority`, `inSight`, `existenceAct`; `runGate`,
 *                                   `runCaseGate`, `registerCaseCatalogue`, `registerStep`, `promote`.
 *   credentials    `attestingKeys` (its R11; R7's signers, R18's NO_ATTESTING_KEY; K757).
 *   provenance     `registeredFor` (the gate's register rows), `registerHolds` (R4's gate probe).
 *   inquiry        `earned`, `subjectEntityOf` (R7's earned registry).
 *   basisVersions  `conclusionOf`, `conclusionRecordOf`, `noProjectConclusionOf`, `projectsDrawingOn` (R1),
 *                  `testimonyReach` (R7).
 *   publication    the case documents, the pins, the registries, and the two commits (its R2, R7, R22).
 *   caseTensions   `observationsNamingAuthor`, `attributionStatedFor`, `attributionFacts` (its R5; R2, R7, R35) and
 *                  `dischargeCaseFlags` (its R2; R3), read directly, never through publication (T35-57, N597; K1643).
 *   retrieval      `selectionResolve` (R21, R29: the bulk release's and retirement's selection).
 *   connections    `citesInto` (its R22; R29: the retirement's live citers, `./retire.mjs`).
 *   contradiction  `candidatesFor` (its R25, R26; R22's contested arm). capture: `registerReader` (its R78; R34).
 *   strength       `testimonyCorroboration` (its R30; R35). reevaluation: `levelMoved` (its R29; R36).
 *   networkNotices `openSeals` (its R17; R37), after the case commit.
 *   publishSchedule `scheduleEdition`, `scheduledEditions`, `registerScheduledPublisher` (its R1, R4, R2; R40, R3, R43):
 *                  the waiting editions of "Publish at…" (T41, N823; publication's until its third split, K2438).
 *
 * READ CONTRACTS it reads in its own SQL: publication's `case_documents` and `cases` (its R40), record-core's `manifest`
 * and `history` (`gateFacts`' manifest and history lists, as they were), inquiry's `inquiry_basis` (`bundle_id`,
 * `target_id`, its R40), and connections' `refs` (`gateFacts`' `dangling` list, kept as it was; its R58). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { provenanceOf, partsHeld, withRegisterChecks } from "../provenance/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { publicationOf } from "../publication/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { strengthOf } from "../strength/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { networkNoticesOf } from "../network-notices/index.mjs";
import { publishScheduleOf } from "../publish-schedule/index.mjs";
import { peopleOf } from "../people/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { parseFrontmatter, normalizeType, isMachineIdentity, MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { approvalSubjectSha, approvalsOf } from "../case-grammar/index.mjs";
import { checkCaseDocument, caseMemberFindings, caseMemberImageFindings, completenessFields,
         RATIFY_SCOPE_CHECKS, rowOf, withCaseMemberChecks } from "./checks.mjs";
import { operatorCaseRefusal, machineCaseRefusal, testimonyCaseRefusal, attributionUnchosenRefusal,
         attributionStaleRefusal, conclusionMovedRefusal, noAttestingKeyRefusal,
         anonymousTestimonyRefusal, approvalMissingRefusal, approvalsRead, approvalsNotCarried } from "./refusals.mjs";
import { release, examineMember, PLANE_VIEWER } from "./release.mjs";
import { retire } from "./retire.mjs";
import { checkedOf, checkedDiffers, scheduleUncheckableRefusal, scheduledStop, refusedStop, commitStops,
         unreadableStop } from "./schedule.mjs";
import { copyMaterials } from "./ops.mjs";
import { findingFactsRefusal, findingShas, findingPublishArgs, copyFinding, reuseCheck, statedIn,
         editionsToAssemble, owesCaseFile, assembleEdition, priorOf, errorText } from "./finding.mjs";
import { sweepCaseFiles, wakeOfCaseFiles, outcomeOf } from "./casefile.mjs";
import { verifySshsig, caseRatifyStatement, ratifyStatement, NS_RATIFY } from "../sshsig.mjs";
import * as casefile from "../publication/worker.mjs";
import { combine as combineProfiles } from "../../../jurisdictions/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

export * from "./checks.mjs";
export { RELEASE_ACK_MAX, CLASS_REASONS } from "./release.mjs";
export { EDGE_REASON_MAX } from "./retire.mjs";
export { CHECKED_PARTS, keyFingerprint } from "./schedule.mjs";
export { CASEFILE_SWEEP_EDITIONS, CASEFILE_SWEEP_FILES, CASEFILE_SWEEP_BYTES } from "./casefile.mjs";

/* The viewer stamp membership mints for an organisation-scoped agent credential (`aiCredentialMint`'s principal). */
const AGENT_ORGANISATION_STAMP = `${MACHINE_CLASS_PREFIX}ai`;

/* Frontmatter-safe (once legacy-store's `#fmSafe`, the rule `caseConclusionRowLines` writes under): the restricted grammar
   has no escapes, and these strings are DERIVED rather than authored, so they are sanitised rather than refused. */
export function fmSafe(s) {
  return String(s ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "'").trim();
}


/* REC-135 / REC-157 — ONE MEMBER'S ROW OF `case_conclusions`, THE ONE WRITER OF IT.
   MOVED HERE BYTE FOR BYTE from `#caseDocumentText` (REC-135 wrote it inline) and
   changed in nothing: the document calls this for every roster member, and
   `editionsRecordingConclusion` calls it to render what a NEW edition would
   record so the comparison is between two rows written by one function and
   read back by one parser — never between a row and a hand-copied idea of one.
   `c` null writes the row a member with no recorded conclusion gets. */
export function caseConclusionRowLines(m, c) {
  return [
    `  - target: ${m}`,
    `    relationship: ${c ? c.relationship : "null"}`,
    `    project: ${c && c.project ? c.project : "null"}`,
    `    version: ${c && c.version ? c.version : "null"}`,
    `    claim_state: ${c && c.claim ? c.claim.state : "null"}`,
    `    claim: "${fmSafe(c && c.claim && c.claim.text ? c.claim.text : "")}"`,
    `    claim_detail: "${fmSafe(c && c.claim && c.claim.detail ? c.claim.detail : "")}"`,
    `    falsifier: "${fmSafe(c && c.falsifier ? c.falsifier : "")}"`,
    `    falsifier_override_by: ${c && c.falsifier_override ? c.falsifier_override.by : "null"}`,
    `    falsifier_override_at: "${fmSafe(c && c.falsifier_override ? c.falsifier_override.at : "")}"`,
    `    concluded_by: ${c && c.by ? c.by : "null"}`,
    `    concluded_at: "${fmSafe(c && c.at ? c.at : "")}"`];}

export class Ratification {
  #deps;
  #holdReader = null;   /* R45: the one reader of litigation holds, registered once at start (`actions`) */
  #approvalReader = null;   /* R50: the one reader of the group's approvals, registered once at start (`review`) */

  constructor({ storage, record, membership, promotion, host = null, provenance = null, inquiry = null,
                basisVersions = null, publication = null, retrieval = null, connections = null,
                credentials = null, contradiction = null, strength = null, reevaluation = null,
                networkNotices = null, people = null, money = null, caseTensions = null, publishSchedule = null,
                worker = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.#deps = { host, provenance, inquiry, basisVersions, publication, retrieval, connections, credentials,
                   contradiction, strength, reevaluation, networkNotices, people, money, caseTensions, publishSchedule,
                   worker };
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get provenance() { return this.#deps.provenance ||= provenanceOf(this.#deps.host); }
  get inquiry() { return this.#deps.inquiry ||= inquiryOf(this.#deps.host); }
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host); }
  get publication() { return this.#deps.publication ||= publicationOf(this.#deps.host); }
  /* case-tensions, one per host: publication is reached first, since its factory creates case-tensions and registers
     the provider case-tensions reads its tables through (publication R61). */
  get caseTensions() {
    return this.#deps.caseTensions ||= (void this.publication,
      caseTensionsOf(this.#deps.host, { record: this.record, membership: this.membership, promotion: this.promotion }));
  }
  get retrieval() { return this.#deps.retrieval ||= retrievalOf(this.#deps.host); }
  get connections() { return this.#deps.connections ||= connectionsOf(this.#deps.host); }
  get contradiction() { return this.#deps.contradiction ||= contradictionOf(this.#deps.host); }
  get strength() { return this.#deps.strength ||= strengthOf(this.#deps.host); }
  get reevaluation() { return this.#deps.reevaluation ||= reevaluationOf(this.#deps.host); }
  get networkNotices() {
    return this.#deps.networkNotices ||= networkNoticesOf(this.#deps.host, { record: this.record, membership: this.membership });
  }
  get people() { return this.#deps.people ||= peopleOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get money() { return this.#deps.money ||= moneyOf(this.#deps.host); }
  /* publish-schedule (N823), one per host: created here, by its first user, after publication (its Suggestions). */
  get publishSchedule() {
    return this.#deps.publishSchedule ||= publishScheduleOf(this.#deps.host,
      { record: this.record, membership: this.membership, publication: this.publication });
  }
  get credentials() {
    return this.#deps.credentials ||= credentialsOf(this.#deps.host, { record: this.record, membership: this.membership });
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* publication R40's read contract: a case document's row, unfenced (in-process; the Worker asked standing), and a
     case's owning project (`cases`, keyed on `case_id` alone; null for a case older than DEC-72, `null` row for none). */
  #caseDocumentRow(caseId, edition) {
    return this.#one(`SELECT doc_sha, text, sig_armored, ratified_at FROM case_documents WHERE case_id=? AND edition=?`,
                     caseId, Number(edition));
  }
  #caseOwner(caseId) { return this.#one(`SELECT project_id FROM cases WHERE case_id=?`, caseId); }


  /* ===== REC-135 / INVESTIGATIVE-SESSION.md §7.1 item 4 (BOB #15, 2026-09-18) —
   * IS THIS QUESTION CONCLUDED, AND FOR WHOSE RELATIONSHIP? THE ONE READER THE
   * CASE PATH ASKS.
   *
   * "Everything that asked 'is this inquiry concluded?' asks it FOR A PROJECT."
   * Before this, publishCase() asked bundles.current_state === 'concluded' —
   * the INQUIRY'S OWN SHARED STATE — which is the single stance §7 forbids: on a
   * shared question one team's conclusion admitted every team's case, and a team
   * that HAD concluded through op=conclude&project= could not publish at all,
   * because the project arm deliberately never moves the inquiry's state
   * (conclude(), THE PROJECT'S CONCLUSION IS WRITTEN ON THE PROJECT AND NOWHERE
   * ELSE). Both halves of that are corrected here.
   *
   * IT CALLS THE EXISTING READERS AND COPIES NEITHER. basis-versions' `conclusionOf` is the
   * project half (REC-124/REC-136: the stance, and only while it is a conclusion
   * — a withdrawal is never a standing answer) and `noProjectConclusionOf` is the
   * inquiry's-own-bytes half (REC-124 item 5, REC-136 item 6). BOB #16's
   * one-reader rule at REC-144: two reads of one quantity must be the same
   * function, or the record can disagree with itself about what a project
   * concluded.
   *
   * THE DISJUNCTION IS A PROVISIONAL AND IT IS ARGUED RATHER THAN ASSUMED, and
   * the alternative is named so reversing it is one edit. §7.1 item 8 says a
   * no-project conclusion is visible as information and is never read as P's,
   * and read strictly that refuses publication to every project whose finding was
   * concluded before the project arm existed — which is EVERY published case in
   * this record and every publishing caller the old test battery had, since op=conclude had
   * no project arm before 2026-09-18. Item 5 rules the opposite way about the
   * same bytes: they are read as the conclusion of the relationship that
   * concluded them, or of the no-project relationship where none can be
   * established — STATED AS SUCH. So the no-project conclusion still admits a
   * case, and what makes that honest rather than lax is the second half of this
   * item: WHICH relationship the case rests on is written into the case document
   * and into this act's answer, PER MEMBER, instead of being left to a reader to
   * assume it was the publisher's. Tightening later is one arm of this function
   * and a refusal message; it is not a migration.
   * (Item 6's aside — a case needs a project (DEC-72), so a no-project conclusion
   * is never published — is FALSE of the code as built, and is reported to BOB
   * rather than quietly made true in either direction.)
   *
   * not_concluded IS NOT ONE FACT AND IS NEVER RETURNED AS ONE (CLAUDE.md §2:
   * sparse is normal, and saying WHICH is a first-class obligation). The project
   * may have concluded and WITHDRAWN (REC-136's history), may have written an act
   * this plane does not recognise (undetermined, never guessed), may have done
   * nothing — and another project may have concluded the same shared question,
   * which is information and is never this project's stance (item 8). Each is
   * named, and the other-projects read publishes its own bound, because an
   * ABSENCE over a truncated set is not a finding.
   *
   * THE STATE FLOOR SURVIVES, and dropping it would have been this item opening a
   * hole while closing one. current_state no longer decides whether the
   * relationship concluded, but it still decides whether the QUESTION can bear a
   * case at all: conclude() refuses a deferred, dismissed or divided question,
   * yet a project's conclusions[] row written while the question was open
   * SURVIVES the group later setting it down or dividing it (DEC-28: divided is
   * terminal and its legs were re-homed onto children). A case asserted over one
   * of those would rest on a question the group has carried forward or put away,
   * which the old expression refused as a side effect and this refuses on
   * purpose. */
  static CASE_BEARING_STATES = ["open", "surfaced", "concluded"];

  caseConclusionFor(projectId, inquiryId, viewer, currentState) {
    const pid = String(projectId ?? "").trim();
    const inq = String(inquiryId ?? "").trim();
    const bearing = Ratification.CASE_BEARING_STATES.includes(currentState);

    const own = pid && bearing ? this.basisVersions.conclusionOf(pid, inq, viewer) : null;
    if (own)
      return { state: "concluded", relationship: "project", project: pid, inquiry: inq,
               version: own.version ?? null,
               claim: { state: own.claim ? "adopted" : "undetermined", text: own.claim ?? null,
                        version: own.version ?? null, detail: null },
               falsifier: own.falsifier ?? "", falsifier_override: own.falsifier_override ?? null,
               by: own.by ?? null, at: own.at ?? null,
               detail: localize("ratification.index.pid_concluded_this_question_on", "{pid} concluded this question on reading '{v1}' and still stands on it, so this case records that project's own adopted claim (7.1 items 1-2).", { pid: String(pid), v1: String(own.version ?? "(unnamed)") }) };

    const np = bearing ? this.basisVersions.noProjectConclusionOf(inq) : null;
    if (np)
      return { state: "concluded", relationship: "no_project", project: null, inquiry: inq,
               version: np.claim && np.claim.version ? np.claim.version : null,
               claim: { state: np.claim ? np.claim.state : "undetermined",
                        text: np.claim && np.claim.state === "adopted" ? np.claim.text : null,
                        version: np.claim && np.claim.version ? np.claim.version : null,
                        detail: np.claim && np.claim.state !== "adopted" ? np.claim.detail ?? null : null },
               falsifier: np.falsifier ?? "", falsifier_override: null, by: null, at: null,
               detail: np.relationship_detail };

    /* WHY IT IS NOT CONCLUDED FOR THIS RELATIONSHIP — the states the project
       could be in, and what any OTHER project has done, kept apart. */
    const rec = pid ? this.basisVersions.conclusionRecordOf(pid, inq, viewer) : { history: [], stance: null };
    const st = rec.stance;
    const why = !bearing ? "question_not_case_bearing"
              : !pid ? "no_project_named"
              : !st ? "project_has_never_concluded"
              : st.act === "withdrawn" ? "project_withdrew_its_conclusion"
              : st.act === "concluded" ? "project_has_never_concluded"
              : "project_stance_undetermined";
    const others = [];
    let othersBound = null, othersTruncated = null;
    if (bearing) {
      const drawing = this.basisVersions.projectsDrawingOn(inq, viewer);
      othersBound = drawing.bound ?? null;
      othersTruncated = drawing.truncated === true;
      for (const p of drawing) {
        if (p.id === pid) continue;
        const c = this.basisVersions.conclusionOf(p.id, inq, viewer);
        if (c) others.push({ project: p.id, version: c.version ?? null, at: c.at ?? null });
      }
    }
    return { state: "not_concluded", relationship: pid ? "project" : "no_project", project: pid || null,
             inquiry: inq, why, claim: { state: "undetermined", text: null, version: null, detail: null },
             stance: st ? { act: st.act, version: st.version ?? null, at: st.at ?? null } : null,
             history_length: rec.history.length,
             inquiry_state: currentState ?? null,
             concluded_elsewhere: others,
             concluded_elsewhere_bounds: { projects_bound: othersBound, projects_truncated: othersTruncated,
                                           detail: localize("ratification.index.a_bounded_number_of_projects", "a bounded number of projects drawing on this question are read, and only those this viewer may see. A conclusion reported here is still true; an ABSENCE over a truncated or gated set is not.") } };
  }

  /* ===== REC-157 / INVESTIGATIVE-SESSION.md §7.1 item 9 (BOB #19, 2026-09-21) —
   * WHICH CASE EDITIONS PINNING THESE BYTES ALREADY RECORD THE CONCLUSION THIS ACT
   * WOULD RECORD? THE ONE COMPARISON `case-authoring`'s `publishCase` (ALREADY_A_CASE_MEMBER) AND THE
   * `publish` AFFORDANCE (affordances' `#editionWarrantedForJoinedProjectOf`) BOTH ASK.
   *
   * WHY IT EXISTS. `ALREADY_A_CASE_MEMBER` used to compare the finding's BYTES alone
   * (the `caseRelation` pin, now case-tensions'), which answered "would a new edition say anything
   * different" correctly only while a case recorded nothing but those bytes. Since
   * REC-135 (IC-166) an edition also records the conclusion it rests on — WHOSE, on
   * which reading, with the claim verbatim — and a project's conclusion lives on the
   * PROJECT, so it moves while the finding's bytes do not. Item 9: *"a new edition is
   * warranted when the publishing project's latest conclusion is not the one the
   * pinned edition recorded, whether or not `bundle_sha` moved. The refusal compares
   * the RELATIONSHIP, exactly as `NOT_CONCLUDED` does."*
   *
   * WHAT IS ASKED. `rel` is case-tensions' `caseRelation(bundleId)` as the caller holds it; `conc`
   * is `caseConclusionFor`'s CONCLUDED answer — in `publishCase` the very object the
   * case document will record, carried on `prepared` and never re-read. The editions
   * are every RATIFIED edition whose roster pins this finding at its CURRENT sha
   * (`rel.pinned`, across every case: DEC-72 clause 6 lets a finding serve many) and
   * the unratified preparation that pins it (`rel.prepared`). An edition pinning an
   * OLDER version is not asked: the finding moved since, and the pin already says so.
   *
   * WHAT "ALREADY RECORDS IT" MEANS, per the relationship this act would record:
   *   - THE PROJECT'S OWN conclusion: the edition's row names the relationship
   *     `project` and the same ENTRY of that project's history — the project, the
   *     reading, the claim state, the claim verbatim, the falsifier or its stated
   *     override, who concluded and when. A conclusion is a dated, authored ACT (§7.1
   *     item 1), so one re-taken after a withdrawal is a different conclusion even
   *     where it adopts the same claim, and the history already says so (DEC-19).
   *     Both rows come from `caseConclusionRowLines` and back through the one
   *     parser, so they are compared in ONE spelling.
   *   - THE NO-PROJECT relationship (a question concluded in its own bytes, §7.1 item
   *     5): the edition's row says `no_project`, OR it recorded no conclusion at all
   *     (every edition before REC-135, and every one before the case document
   *     existed). Here the comparison IS THE PIN, not the fields: that conclusion is
   *     written in the finding's own bytes and this edition pins exactly those bytes,
   *     so it is the same conclusion by hash. An edition that recorded nothing rested
   *     on the question's own `concluded` state — the gate before REC-135 read nothing
   *     else — which is this relationship in these bytes. Comparing FIELDS here would
   *     let a later rewording of the READER (basis-versions' `noProjectConclusionOf`) warrant an
   *     edition of bytes nobody moved, which is the liar's direction.
   *   - ANYTHING ELSE an edition recorded — another relationship, another project's
   *     row, a value this plane does not write — is not this conclusion.
   *
   * WHAT IT CANNOT SEE, stated so the next reader does not have to test it:
   *   - two conclusion acts identical in content, author AND second (the record's
   *     timestamps are second-grained) are indistinguishable in the record and read as
   *     one; a new edition would then record byte-identical rows, so the refusal's own
   *     sentence stays true of what the case would say;
   *   - a reading NAME the frontmatter grammar coerces (`null`, a bare number) is
   *     compared AS COERCED on both sides, one writer and one parser, so equal inputs
   *     stay equal — the coercion is REC-135's unquoted `version:` field, unchanged;
   *   - a case document with no readable text counts as recording NOTHING, which then
   *     compares by the pin as above. */
  static #CONCLUSION_ENTRY_FIELDS = ["project", "version", "claim_state", "claim", "falsifier",
    "falsifier_override_by", "falsifier_override_at", "concluded_by", "concluded_at"];

  editionsRecordingConclusion(bundleId, rel, conc) {
    const editions = [
      ...(rel && Array.isArray(rel.pinned) ? rel.pinned : [])
        .map((p) => ({ case_id: p.case_id, edition: Number(p.edition), state: "ratified" })),
      ...(rel && rel.prepared
        ? [{ case_id: rel.prepared.case_id, edition: Number(rel.prepared.edition), state: "prepared" }] : []),
    ];
    const want = Ratification.#conclusionRowParsed(bundleId, conc);
    const pinned = [];
    for (const e of editions) {
      const d = this.#caseDocumentRow(e.case_id, e.edition);
      const had = Ratification.#recordedRowIn(d ? d.text : null, bundleId);
      pinned.push({ ...e, recorded: Ratification.#recordedConclusionSummary(had),
                    same: Ratification.#sameRecordedConclusion(had, want) });
    }
    return { same: pinned.filter((e) => e.same), pinned };
  }

  /* The `case_conclusions` row one document's text records for a member, or null (no readable text, or no row). */
  static #recordedRowIn(text, bundleId) {
    const rows = typeof text === "string" ? (parseFrontmatter(text).data || {}).case_conclusions : null;
    return Array.isArray(rows)
      ? rows.find((r) => r && typeof r === "object" && String(r.target ?? "") === String(bundleId)) || null
      : null;
  }

  /* REC-167 / C-65.1's question, asked of one document's TEXT: for each roster member, is the question concluded for
     the document's project (`caseConclusionFor`, read for the signer), and is that conclusion the one the text
     records (item 9's comparison, `#sameRecordedConclusion`, the one `editionsRecordingConclusion` makes)? It
     answers the members that fail, each with what the text recorded and what the project stands on now. The commit
     asks it of the stored document it is about to sign, and R18's pre-flight of the unsigned text it is given, so the
     two answer alike. */
  #conclusionsMoved(text, project, roster, signerMember) {
    const concViewer = signerMember ? `member:${signerMember}` : null;
    const moved = [];
    for (const m of roster) {
      const bm = this.record.head(m);
      const conc = this.caseConclusionFor(project, m, concViewer, bm ? bm.currentState : null);
      const had = Ratification.#recordedRowIn(text, m);
      if (conc.state === "concluded"
          && Ratification.#sameRecordedConclusion(had, Ratification.#conclusionRowParsed(m, conc))) continue;
      moved.push({ target: m, recorded: Ratification.#recordedConclusionSummary(had),
                   now: conc.state === "concluded"
                     ? { state: "concluded", relationship: conc.relationship, project: conc.project,
                         version: conc.version ?? null, claim: conc.claim ? conc.claim.text ?? null : null,
                         concluded_by: conc.by ?? null, concluded_at: conc.at ?? null }
                     : { state: "not_concluded", relationship: conc.relationship, project: conc.project,
                         why: conc.why, stance: conc.stance ?? null } });
    }
    return moved;
  }

  /* What a NEW edition would record for this member, rendered by the one writer and
     read back by the one parser — the same path an edition's own row took. */
  static #conclusionRowParsed(bundleId, c) {
    const text = ["---", "case_conclusions:", ...caseConclusionRowLines(bundleId, c), "---", ""].join("\n");
    const rows = (parseFrontmatter(text).data || {}).case_conclusions;
    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object" ? rows[0] : null;
  }

  static #sameRecordedConclusion(had, want) {
    if (!want) return false;
    const relOf = (r) => (r && typeof r.relationship === "string" ? r.relationship : null);
    const hadRel = relOf(had);
    /* THE PIN IS THE COMPARISON for the no-project relationship — the header says why. */
    if (want.relationship === "no_project") return hadRel === "no_project" || hadRel === null;
    if (want.relationship !== "project" || hadRel !== "project") return false;
    const v = (x) => (x === undefined || x === null ? null : String(x));
    return Ratification.#CONCLUSION_ENTRY_FIELDS.every((k) => v(had[k]) === v(want[k]));
  }

  /* What an edition RECORDED, for the act's answer — null where it recorded nothing. */
  static #recordedConclusionSummary(had) {
    if (!had || typeof had.relationship !== "string") return null;
    const v = (x) => (x === undefined || x === null || x === "" ? null : String(x));
    return { relationship: had.relationship, project: v(had.project), version: v(had.version),
             claim_state: v(had.claim_state), claim: v(had.claim),
             concluded_by: v(had.concluded_by), concluded_at: v(had.concluded_at) };
  }
  /* ---- R7: the facts `op=ratify`'s gate reads that are not in the image ----

     The gate and the signature check run at the control plane (`./ops.mjs`); this hands out the facts and commits.
     The manifest and history lists are still answered because older readers consumed them; plane-gate/1.0 reads all
     of that out of the image instead, since the catalogue wants the bundle as a filesystem.

     REC-140 (D-429): SIGHT FIRST, AND ONE ANSWER FOR ABSENT AND HIDDEN. A bundle the viewer cannot see answers with
     the SAME object a never-minted id does, through ONE condition. Before, the facts were read with no viewer and the
     hidden bundle leaked twice: RATIFY_STALE echoed its real sha, and the ratifier-scoped image came back empty and
     was reported as "bundle.md is missing". A viewer that was NOT SENT (null) is not asked: every other reader of
     these facts is a tool, not a caller. */
  gateFacts(bundleId, viewer = null) {
    const head = bundleId ? this.record.head(bundleId) : null;
    const row = head ? { bundle_id: bundleId, object_type: head.type, current_state: head.currentState,
                         bundle_sha: head.bundleSha } : null;
    /* REC-149: EXISTENCE answers C-70.1 (ratify is an act on the bundle); NONE is the line below, unchanged. */
    { const existence = row ? this.membership.existenceAct(bundleId, viewer) : null; if (existence) return existence; }
    if (!row || (viewer !== null && viewer !== undefined && !this.membership.inSight(bundleId, viewer)))
      return { ok: false, reason: "ABSENT", bundleId };
    const targets = this.#rows(`SELECT target_id FROM inquiry_basis WHERE bundle_id=?`, bundleId).map((r) => r.target_id);
    const testimony = this.basisVersions.testimonyReach([bundleId]);
    return {
      ok: true, row,
      /* REC-182: on a `created` tie the prior promotion is the one WRITTEN first (`rowid`, D-171). */
      manifest: this.#rows(`SELECT snap_key, kind, base, created FROM manifest WHERE bundle_id=? ORDER BY created, rowid`, bundleId),
      history: this.#rows(`SELECT snap_key, sha256 FROM history WHERE bundle_id=? AND path='bundle.md'`, bundleId),
      registers: this.provenance.registeredFor(bundleId)
        .map((r) => ({ capture_sha: r.capture_sha, path: r.path, bytes: r.bytes })),
      /* MK-1 (A): whether this bundle IS, or RESTS ON, a member's authored observation — the publication fence's
         one fact (C-53.10/.11). */
      testimony,
      /* MK-7: which of the observations this bundle is or rests on still name their author in their own files
         (§4.1 keeps those fenced), and — for an observation — whether a RATIFIED case document states a chosen level
         for it, which its words may not cross without. */
      testimonyLegacy: this.caseTensions.observationsNamingAuthor([...testimony.self, ...testimony.via.map((v) => v.observation)]),
      attributionStated: this.caseTensions.attributionStatedFor(bundleId),
      dangling: this.#rows(
        `SELECT r.target_id FROM refs r LEFT JOIN bundles b ON b.bundle_id=r.target_id
         WHERE r.bundle_id=? AND b.bundle_id IS NULL`, bundleId).map((r) => r.target_id),
      signers: this.credentials.attestingKeys(),   /* credentials R11: the ONE predicate (D-158; K757) */
      /* REC-14: the two facts the catalogue cannot get from the bundle — what THIS case asserted at its previous
         edition (C-21.1) and what the cases beneath it FROZE (C-21.2), read with the rows so the gate and the write
         path see the same published record. */
      publishedRegistry: this.publication.publishedRegistryFor(bundleId, targets),
      /* REC-44, D-309: C-21.1's fact is a CASE fact, for EVERY case this document is pinned or prepared into, read
         from the document's own claim and never from a request. */
      publishedCaseRegistry: this.publication.publishedCaseRegistryFor(this.publication.caseClaimsOf(bundleId)),
      /* REC-18: what each basis target EARNS, so an earned grade is confirmed at the ratification gate and not only at
         the write. The subject comes from the PROJECTION here (the document is already promoted). */
      earnedRegistry: this.inquiry.earned(this.inquiry.subjectEntityOf(bundleId), targets),
    };
  }

  /* ---- R4: `op=ratify`'s gate, on the promotion instance (N417, K691) ----

     `op=ratify`'s gate runs here, in the Durable Object, for `caseGate`'s reason (K233): `promotion.runGate` runs the
     type grammars later modules registered with record-core (C-2.7 among them), and those registrations live on this
     host; the Worker has none. The Worker hands what it already read under the ratifier's sight (the image, the known
     ids, the gate facts' registries and register rows); the register rows' bytes are probed here, in-process: the
     evidence store (record-core R38), then provenance's `registerHolds` (R5) and, for parts the bundle's record names,
     `partsHeld` (D-533, D-556). No evidence store bound is every row absent, as the Worker's unbound bucket was. The
     answer is the gate's verdict and `parted`, the whole-hash rows the gate admitted as held in parts with the parts
     the record names, which the Worker publishes part by part. */
  async ratifyGate({ bundleId, image, knownIds, registers, publishedRegistry, publishedCaseRegistry,
                     earnedRegistry } = {}) {
    const evidence = this.record.evidenceStore();
    const parted = [];
    const gate = await this.promotion.runGate({
      bundleId, image: image || {}, knownIds: new Set(Array.isArray(knownIds) ? knownIds : []),
      registers: Array.isArray(registers) ? registers : [],
      publishedRegistry: publishedRegistry ?? null, publishedCaseRegistry: publishedCaseRegistry ?? null,
      earnedRegistry: earnedRegistry ?? null,
      hasCapture: async (sha) => {
        if (!evidence) return { present: false, bytes: 0 };
        const h = await evidence.head(sha);
        if (h) return { present: true, bytes: h.size };
        /* D-530: a miss on the whole-hash key is not absence; D-556: the parts this bundle's record names are each
           headed and their digests verified, and the gate admits the row only when all are present and verify. */
        const held = this.provenance.registerHolds({ sha, bundle: bundleId });
        const named = held ? held.parts : null;
        if (named?.state === "unreadable") return { present: false, bytes: 0, parts: { why: named.why } };
        if (named?.state === "named") {
          const v = await partsHeld(evidence, (s) => s, named.parts);
          if (!v.missing.length && !v.disagree.length && !v.unverified.length) parted.push([sha, named.parts]);
          return { present: false, bytes: 0, parts: { named: named.parts, ...v } };
        }
        return { present: false, bytes: 0, ...(held && held.acquired === true ? { heldInParts: true } : {}) };
      },
    });
    /* B5 (T51; K4219; provenance R66): the C-18 register arms run here, where this host's provenance is, with its resolver,
       so a member's recorded decision on a capture's authority is read before the document's own. The Worker holds no
       provenance and runs no register arm of its own. */
    return { ...withRegisterChecks(image || {}, gate, this.provenance.containerResolver()), parted };
  }

  /* ---- R2: the case document's catalogue, on the promotion instance (K233) ----

     `op=caseratify`'s gate runs here, in the Durable Object, because the catalogue this module registered (R8) lives
     on the promotion instance of this host; the Worker has none. THE CATALOGUE, over the bytes the signature covers
     and over nothing else: the document is re-read at the `docSha` the Worker verified the signature over, and a
     document that moved since answers CASE_RATIFY_STALE. `priorCase` is C-21.1's fact at case altitude and comes from
     the one facts read that has the rows — passing null would not soften C-21.1, it would blind it. */
  caseGate({ caseId, edition, docSha, viewer = null, secretSha = null } = {}) {
    const facts = this.publication.caseDocumentFacts(caseId, edition, viewer, secretSha);
    if (!facts || !facts.ok) return facts || { ok: false, reason: "NO_CASE_DOCUMENT" };
    if (facts.doc.doc_sha !== docSha)
      return { ok: false, reason: "CASE_RATIFY_STALE", expected: facts.doc.doc_sha, got: docSha ?? null,
               detail: localize("ratification.index.the_case_document_has_changed_since", "the case document has changed since it was reviewed; read it again and re-sign") };
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): the body (C-3.1's section) and each member's basis at the
       pinned bytes (C-2.8's testimony and per-ground arms), both from the one facts read. */
    return this.#caseGateOver(facts.doc.case_id, Number(facts.doc.edition), parseFrontmatter(facts.doc.text),
                              facts.memberBasis || null, facts.priorCase);
  }

  /* The one call to promotion's case gate (R8's registered catalogue), for the act's gate and R18's pre-flight alike:
     `priorCase` is publication's `published_cases` row for the previous ratified edition, or null. */
  #caseGateOver(caseId, edition, parsed, memberBasis, priorCase) {
    return this.promotion.runCaseGate({
      caseId, edition,
      body: typeof parsed.body === "string" ? parsed.body : null,
      memberBasis,
      fm: parsed.data || {},
      priorCase: priorCase
        ? { edition: priorCase.edition,
            statement: priorCase.completeness ? (JSON.parse(priorCase.completeness).statement ?? null) : null,
            bias_acknowledgement: priorCase.bias_acknowledgement ?? null }
        : null });
  }

  /* ---- R18 (N364; DEC-80 items 3 and 4): THE CASE CEREMONY'S PRE-FLIGHT ----

     What `op=caseratify` (R2) and its commit (R3) would refuse, asked over an unsigned case document's bytes before
     anybody signs, so the ceremony can say so before its first screen (case-authoring R34). Every refusal that holds
     is listed, each asked on its own and never stopping at the first, in R18's order:
       C-32.13 and C-32.15, the credential fences, read from the control plane's `viewer` stamp: every machine
         identity (REC-46's predicate) holds both (the act answers the first; lifted, the second would answer) but an
         operator's bearer stamp `class:<cls>`, which holds C-32.15 alone; a member's or the founder's session holds
         neither; an absent viewer, an internal caller, is not asked. A viewer `{stamp, aiCred}` carrying a minted agent
         credential holds both, whatever its stamp (N407: a member-scoped agent's stamp is its minter's);
       C-53.12, C-92.10, C-92.11 over publication's attribution facts for these bytes;
       NO_ATTESTING_KEY, the pre-flight's own: `signer` (a member id, or `member:<id>`) holds no key
         `credentials.attestingKeys` answers (its R11; R19 here: whatever the key's origin);
       CASE_SIGNER_NOT_AN_OWNER through `membership.caseAuthority`, the deliverer not asked (it is fixed only when the
         act is delivered);
       C-65.1, the commit's own comparison (`#conclusionsMoved`) over these bytes, read for the signer;
       the case gate's findings, as the act's GATE_REFUSED: the catalogue over these bytes, with the previous ratified
         edition (publication R40's `published_cases`) and each member's basis at its pin (record-core R60).
     Each is built by the function the act answers through (`./refusals.mjs`, membership's `caseAuthority`), so it is
     the act's own; the act's envelope (`store`, `tokenClass` after the payload's refusals, the HTTP status) is the
     Worker's and is not here. It writes nothing and never throws: a part it cannot read makes the whole answer
     PREFLIGHT_UNDETERMINED, never a partial list read as a clear one. */
  caseRatifyPreflight({ text = null, signer = null, viewer = null } = {}) {
    try {
      const src = typeof text === "string" ? text : "";
      const parsed = parseFrontmatter(src);
      const fm = parsed.data || {};
      const caseId = fm.case_id === undefined || fm.case_id === null ? null : String(fm.case_id).trim();
      const edition = Number.isInteger(fm.case_edition) ? fm.case_edition : null;
      const project = typeof fm.case_project === "string" && fm.case_project !== "null" ? fm.case_project.trim() : null;
      const roster = (Array.isArray(fm.case_findings) ? fm.case_findings : [])
        .map((x) => String(x ?? "").trim()).filter(Boolean);
      const refusals = [];

      /* N385 (K601): the predicate decides C-32.13, never a word in the name. Every identity `isMachineIdentity`
         answers is refused C-32.13 but one: an operator's bearer, whose stamp is `class:<cls>` alone, which the act
         answers C-32.15 only (it has no agent credential). A `class:` stamp is an agent credential's only in the
         shapes the plane mints for one: the act's `class:<cls>/<tokenId>`, and membership's organisation principal
         `class:ai` (`aiCredentialMint`), matched as the whole stamp. */
      /* N407 (K649 (4)): the viewer carries the agent credential. A viewer is the control plane's stamp, or
         `{stamp, aiCred}` when the caller is a minted agent credential (admission stamps it, layer 11). A member-scoped
         agent's stamp is its minter's (`member:<minter>`, membership R28), so the stamp alone cannot tell it from its
         member; `aiCred` does, as it does for the act (`./ops.mjs`), which answers such a caller C-32.13 and, lifted,
         C-32.15 (class `ai`, never through a session). */
      const carried = viewer && typeof viewer === "object" ? viewer : null;
      const aiCred = carried && carried.aiCred && typeof carried.aiCred === "object" ? carried.aiCred : null;
      const v = carried ? String(carried.stamp ?? "").trim()
        : viewer === null || viewer === undefined ? "" : String(viewer).trim();
      if (aiCred) refusals.push(machineCaseRefusal("ai"), operatorCaseRefusal("ai"));
      else if (v && isMachineIdentity(v)) {
        const stamped = v.toLowerCase().startsWith(MACHINE_CLASS_PREFIX);
        const rest = stamped ? v.slice(MACHINE_CLASS_PREFIX.length) : v;
        const cls = stamped ? rest.split("/")[0] : v;
        const bearer = stamped && !rest.includes("/") && v.toLowerCase() !== AGENT_ORGANISATION_STAMP;
        if (!bearer) refusals.push(machineCaseRefusal(cls));
        refusals.push(operatorCaseRefusal(cls));
      }

      const attr = this.caseTensions.attributionFacts({ text: src, case_id: caseId, edition });
      for (const r of [testimonyCaseRefusal(caseId, edition, attr.legacy),
                       attributionUnchosenRefusal(caseId, edition, attr),
                       attributionStaleRefusal(caseId, edition, attr),
                       anonymousTestimonyRefusal(caseId, edition, this.#uncorroborated(src, attr))])
        if (r) refusals.push(r);

      /* R49 (D60; K2528, K2533): APPROVAL_MISSING, where the act asks it after CASE_RATIFY_STALE, over these bytes'
         approval digest; approvals that cannot be read make the answer undetermined, never a clear one. */
      const approval = this.#approvalCheck(caseId, edition, src);
      if (approval.read && approval.read.unreadable) throw new Error(approval.read.unreadable);
      if (approval.refusal) refusals.push(approval.refusal);

      const signerMember = signer === null || signer === undefined || isMachineIdentity(signer) ? null
        : String(signer).trim().replace(/^member:/, "") || null;
      if (!signerMember || !this.credentials.attestingKeys().some((k) => k.member_id === signerMember))
        refusals.push(noAttestingKeyRefusal(signerMember));

      const denied = this.membership.caseAuthority({ project, deliveredBy: null, signer: signerMember,
        act: "caseratify", subject: `case ${caseId} edition ${edition}`, extra: { caseId, edition } });
      if (denied) refusals.push(denied);

      const moved = conclusionMovedRefusal(caseId, edition, project,
                                           this.#conclusionsMoved(src, project, roster, signerMember));
      if (moved) refusals.push(moved);

      const priorCase = caseId && edition !== null
        ? this.#one(`SELECT edition, completeness, bias_acknowledgement FROM published_cases
                      WHERE case_id=? AND edition<? AND ratified_at IS NOT NULL ORDER BY edition DESC LIMIT 1`,
                    caseId, edition)
        : null;
      const gate = this.#caseGateOver(caseId, edition, parsed, this.#memberBasisAtPins(fm), priorCase);
      if (!gate || !gate.ok)
        refusals.push({ ok: false, reason: "GATE_REFUSED", gateVersion: gate ? gate.gateVersion : null,
                        findings: gate && Array.isArray(gate.findings) ? gate.findings : [] });

      return { ok: true, ready: refusals.length === 0, refusals, publish_at: this.#publishAtOffer() };
    } catch {
      return { ok: false, reason: "PREFLIGHT_UNDETERMINED",
               detail: localize("ratification.index.part_of_what_signing_would", "part of what signing would be refused for could not be read, so whether this document can be signed is undetermined; nothing is claimed either way, and nothing was written. Ask again.") };
    }
  }

  /* R44 (DEC-147; T50, N1203): whether the ceremony's last step offers "Publish at…", and in which zone: the group's
     governing zone as `publish-schedule` R1 reads it, which is `retrieval` R69's (`local-facts`' governing value of
     `time_zone` first, else the active profiles' through `jurisdictions.combine`). Should retrieval be unreadable, the
     profiles alone answer, as before. No zone held offers only "Publish now"; the time is never read as UTC.
     R58 (T51 fix round 7, G62; K4736): the answer also says where an offered zone came from (`source`: retrieval's
     `local-facts` or `profiles`, `profiles` also when retrieval was unreadable) and, when none is offered, why (`source`
     `none`, `why` retrieval's own, or `UNREADABLE`); one structured log line says the same, never the zone's text. A
     zone retrieval answers none for is final: two profiles that govern different zones govern none, and `publish-schedule`
     R1 would refuse a time offered in one of them. */
  #publishAtOffer() {
    let got = null, unreadable = false;
    try {
      got = this.retrieval.zone({ why: true });
    } catch {
      unreadable = true;
    }
    if (!unreadable && !(got && typeof got === "object")) got = { zone: got, source: null, why: null };
    let zone = unreadable ? null : got.zone, source = unreadable ? null : got.source, why = unreadable ? "UNREADABLE" : got.why;
    if (unreadable) {
      try {
        const list = this.record.getSetting("jurisdiction_profiles");
        const c = combineProfiles(Array.isArray(list) ? list : []);
        zone = c && c.ok && c.view && c.view.time_zone ? c.view.time_zone.value : null;
        if (typeof zone === "string" && zone) { source = "profiles"; why = null; }
      } catch { zone = null; }
    }
    zone = typeof zone === "string" && zone ? zone : null;
    source = zone ? (typeof source === "string" && source ? source : null) : "none";
    why = typeof why === "string" && why ? why : null;
    try { console.log(JSON.stringify({ event: "publish_at", offered: !!zone, source, why })); } catch { /* a log changes nothing */ }
    return zone ? { offered: true, zone, source }
                : { offered: false, zone: null, reason: "PUBLISH_AT_NO_ZONE", source, why };
  }

  /* R35 (DEC-102 items 1, 2; K1074): each roster member's testimony legs on an observation whose level in force for
     this edition (publication's attribution facts) is `group` or `project` that strength answers uncorroborated (its
     R30), as `{member, observation}`, and its legs on a document whose off-the-record capture's attesting member is at
     those levels (publication R60, strength R34; DEC-119 (3)), as `{member, document}`; judged at its pinned bytes: the reading the document records for it
     (`case_conclusions[].version`), its live basis only where it records none. Read as the plane: the pre-flight runs
     before a signer exists and must answer as the act does. No such level asks nothing. */
  #uncorroborated(text, attr) {
    const fm = parseFrontmatter(String(text ?? "")).data || {};
    const levels = Object.fromEntries((attr && Array.isArray(attr.current) ? attr.current : [])
      .filter((x) => x.level).map((x) => [x.observation || x.capture, x.level]));
    if (!Object.values(levels).some((l) => l === "group" || l === "project")) return [];
    const out = [];
    for (const m of (Array.isArray(fm.case_findings) ? fm.case_findings : []).map((x) => String(x ?? "").trim())) {
      const version = Ratification.#recordedRowIn(text, m)?.version;
      const a = this.strength.testimonyCorroboration({ inquiry: m, levels, viewer: PLANE_VIEWER,
        version: version === undefined || version === null || version === "null" ? null : String(version) });
      for (const l of a && a.ok && Array.isArray(a.legs) ? a.legs : [])
        if (l.state === "uncorroborated")
          out.push(l.kind === "evidence" ? { member: m, document: l.target_id } : { member: m, observation: l.target_id });
    }
    return out;
  }

  /** R35 in R2: the act's store half, asked by the Worker after C-92.11 (`./ops.mjs`): C-58.5 over the stored case
   *  document, the pre-flight's own refusal, or null. */
  caseTestimony({ caseId = null, edition = null } = {}) {
    const doc = this.#caseDocumentRow(String(caseId ?? ""), edition);
    if (!doc) return { ok: true, refusal: null };
    const attr = this.caseTensions.attributionFacts({ text: doc.text, case_id: caseId, edition: Number(edition) });
    return { ok: true, refusal: anonymousTestimonyRefusal(caseId, Number(edition),
                                                          this.#uncorroborated(doc.text, attr)) };
  }

  /* ===== THE GROUP'S APPROVALS BEFORE SIGNING (T41; D60, N820; R49, R50) ================================== */

  /** R50: the reader of the group's approval rule and the approvals given (`review`, its R32), registered once at start;
   *  a second is refused. With none, no rule is in force and R49 asks nothing. */
  registerApprovalReader(reader) {
    if (this.#approvalReader)
      return { ok: false, reason: "APPROVAL_READER_DECLARED",
               detail: localize("ratification.index.a_reader_of_the_teams_approvals", "a reader of the team's approvals is already registered; there is one, registered once at start") };
    if (!reader || typeof reader.rule !== "function" || typeof reader.approvals !== "function")
      return { ok: false, reason: "MALFORMED", detail: "registerApprovalReader takes {rule(), approvals({case, edition, docSha})}" };
    this.#approvalReader = reader;
    return { ok: true };
  }

  /* R50's reading at an approval digest (`./refusals.mjs` `approvalsRead`). */
  #approvals(caseId, edition, approvalSha) {
    return approvalsRead(this.#approvalReader, { caseId, edition, docSha: approvalSha });
  }

  /* R49 over one document's text: its approval digest (`case-grammar` R26's `approvalSubjectSha`, K2528), R50's reading
     there, and APPROVAL_MISSING when an approver has not approved it or a held approval is not carried in the text's own
     `approvals:` block (K2533); `refusal` null with no rule in force. */
  #approvalCheck(caseId, edition, text) {
    const sha = approvalSubjectSha(text);
    const read = this.#approvals(caseId, edition, sha);
    const carried = (approvalsOf(parseFrontmatter(String(text ?? "")).data || {}) || {}).approvals ?? [];
    return { sha, read, refusal: approvalMissingRefusal(caseId, edition, sha, read, approvalsNotCarried(read, carried)) };
  }

  /** R50 (K2533): the approvals in force for a case edition's document at its approval digest `docSha`, for
   *  `case-authoring` R68: `{ok: true, rule, approvals, missing}` (`rule` null, nothing missing, with no rule in force), or
   *  `{ok: false}` when they cannot be read. Writes nothing; never throws. */
  approvalsInForce({ case: caseArg = null, caseId = null, edition = null, docSha = null } = {}) {
    try {
      const read = this.#approvals(caseArg ?? caseId, Number(edition), docSha ?? null);
      if (read && read.unreadable)
        return { ok: false, reason: "APPROVALS_UNREADABLE", detail: localize("ratification.index.unreadable_could_not_be_read", "{unreadable} could not be read", { unreadable: String(read.unreadable) }) };
      return read ? { ok: true, rule: { approvers: read.approvers }, approvals: read.approvals, missing: read.missing }
                  : { ok: true, rule: null, approvals: [], missing: [] };
    } catch (e) {
      return { ok: false, reason: "APPROVALS_UNREADABLE", detail: String((e && e.message) || e).slice(0, 160) };
    }
  }

  /** R49 in R2: the act's store half, asked by the Worker after CASE_RATIFY_STALE (`./ops.mjs`), over the stored
   *  document at the `doc_sha` the Worker read: APPROVAL_MISSING (C-58.11) or null. */
  caseApproval({ caseId = null, edition = null, docSha = null } = {}) {
    const doc = this.#caseDocumentRow(String(caseId ?? ""), edition);
    if (!doc || doc.doc_sha !== docSha) return { ok: true, refusal: null };   /* the act's own refusals answer it */
    return { ok: true, refusal: this.#approvalCheck(caseId, Number(edition), doc.text).refusal };
  }

  /* ===== PUBLISHING AT A SET TIME (DEC-147; R40–R45, R48) ==================================================
     "Publish at…" signs now and publishes later: the signed statement is the same as "Publish now"'s, the time is not
     signed, and the edition waits in `publish-schedule` (its R1) until the one publisher this module registers (R43) checks
     it again at its time and commits it only if nothing changed (R42, R48). */

  /** R45: the reader of litigation holds in place over a project (`actions`, its R58), registered once at start; a
   *  second is refused. With none, R41's `holds` cannot be read, so `op=publishat` is refused and R42 stops. */
  registerHoldReader(reader) {
    if (this.#holdReader)
      return { ok: false, reason: "HOLD_READER_DECLARED",
               detail: localize("ratification.index.a_reader_of_litigation_holds", "a reader of litigation holds is already registered; there is one, registered once at start") };
    if (!reader || typeof reader.holdsOn !== "function")
      return { ok: false, reason: "MALFORMED", detail: "registerHoldReader takes {holdsOn({project})}" };
    this.#holdReader = reader;
    return { ok: true };
  }

  /* R41's reads, as signing and the publisher both make them. */
  #scheduleReads() {
    const carriage = this.publication.caseCarriage;
    const reader = this.#holdReader;
    return {
      sourcesLapsed: (text, at) => carriage.sourcesLapsed(text, at),
      acceptedWorkLapsed: (fm, signer) => carriage.acceptedWorkLapsed(fm, signer),
      tiesConcerning: (a) => this.people.tiesConcerning(a),
      readFact: (a) => this.money.readFact(a),
      holdsOn: reader ? (a) => reader.holdsOn(a) : null,
      stampsOf: (a) => this.publication.stampsOf(a),
      ratifiedEditions: (caseId) => this.#rows(`SELECT edition FROM case_documents WHERE case_id=? AND ratified_at IS NOT NULL
                                                ORDER BY edition`, caseId).map((r) => Number(r.edition)),
    };
  }

  /* R41 over a plan (the stored document's bytes), at `at`, for the signing member and the verified key; with R50's
     approvals at the plan's approval digest. */
  #checkedNow(plan, signer, keyB64, at) {
    return checkedOf({ text: plan.doc.text, fm: plan.fm, caseId: plan.id, project: plan.project,
                       signer: signer === null || signer === undefined ? null : String(signer).replace(/^member:/, ""),
                       keyB64, at, reads: { ...this.#scheduleReads(),
                                            approvals: () => this.#approvals(plan.id, plan.ed,
                                                                             approvalSubjectSha(plan.doc.text)) } });
  }

  /* `publish-schedule` R1's waiting entry for a case edition, or null (read as the plane, its R4). */
  #waitingEntry(id, ed) {
    for (let after = null; ;) {
      const page = this.publishSchedule.scheduledEditions({ case: id, state: "waiting", after, limit: 500 });
      const list = page && Array.isArray(page.editions) ? page.editions : [];
      const hit = list.find((e) => Number(e.edition) === ed);
      if (hit) return hit;
      if (!page || page.cursor === null || page.cursor === undefined) return null;
      after = page.cursor;
    }
  }

  /* R3 (DEC-147): an edition that waits is answered with `publish-schedule`'s PUBLISH_AT_ALREADY_SET, naming its set
     time. */
  #waitingRefusal(id, ed) {
    const w = this.#waitingEntry(id, ed);
    if (!w) return null;
    return { ok: false, reason: "PUBLISH_AT_ALREADY_SET", caseId: id, edition: ed, at: w.at ?? null,
             publish_at: w.publish_at ?? null, waiting: w,
             detail: localize("ratification.index.case_id_edition_ed_is", "case {id} edition {ed} is signed and waits to be published at its set time. To publish it now, an owner cancels the set time (op=publishatcancel) and signs again. Nothing was written.", { id: String(id), ed: String(ed) }) };
  }

  /* R6, R57 for a retry: a complete edition whose case file is still owed (its container never assembled, as after R42's
     commit without the Worker, or an attempt that did not end built). */
  #completedCase(id, ed) {
    const st = this.#editionState(id, ed);
    return owesCaseFile(st) ? { completedCase: st } : {};
  }

  /* An edition's state as the commit answers it, which names the publishing group: the `group` field of the first roster
     member's bytes at its pin (publication R22). The assembly writes it into the case file's manifest, so a state read
     any other way would build a manifest of another group. Null when the edition is unknown or unreadable. */
  #editionState(id, ed) {
    try {
      if (typeof this.publication.caseEditionState !== "function") return null;
      const doc = this.#caseDocumentRow(id, ed);
      const fm = doc ? parseFrontmatter(doc.text).data || {} : {};
      const first = (Array.isArray(fm.case_findings) ? fm.case_findings : []).map((x) => String(x ?? "").trim()).find(Boolean);
      const row = (Array.isArray(fm.case_roles) ? fm.case_roles : [])
        .find((r) => r && typeof r === "object" && String(r.target ?? "").trim() === first);
      const text = first ? this.record.textAtSha(first, row && typeof row.version_sha === "string" ? row.version_sha : null) : null;
      return this.publication.caseEditionState(id, ed, text ? (parseFrontmatter(text).data || {}).group ?? null : null);
    } catch { return null; }
  }

  /** R57 (G54): one tick of the case-file sweep at `now` (ms): the oldest owed editions, up to the tick's bound, each
   *  copied and assembled (`./casefile.mjs`). Answers what it did; never throws. */
  async caseFileSweep(now) {
    const w = this.#deps.worker;
    return sweepCaseFiles({ publication: this.publication, stateOf: (id, ed) => this.#editionState(id, ed),
      materialsOf: (id, ed) => copiedMaterials(this.publication.heldMaterialsOf?.(id, ed)), worker: w, now,
      assemble: (w && w.assembleCaseContainer) || casefile.assembleCaseContainer,
      recordFailure: (w && w.recordCaseFileFailure) || casefile.recordCaseFileFailure,
      textAt: typeof this.record.textAtSha === "function" ? (b, h) => this.record.textAtSha(b, h) : undefined });
  }

  /** R57 (G54): when the sweep next has work, in ms, or null; see `./casefile.mjs`. */
  caseFileWake(now) { return wakeOfCaseFiles({ publication: this.publication, worker: this.#deps.worker, now }); }

  /** R40: `op=publishat`'s store half. Every refusal R3 answers before its commit writes, in R3's order; then every
   *  refusal publication's commit would answer for the document now (the commit is made and rolled back, so the answer
   *  is the commit's own and nothing is written); then SCHEDULE_UNCHECKABLE (C-58.6) when R41 cannot be read; else, in
   *  this one transaction, `publish-schedule` R1 in place of the commit, its answer relayed as given. The same signature
   *  and `at` again answer its `existed`. Nothing of R3's commit, R36, R37 or R39 happens here: each happens at R42. */
  publishAt({ caseId, edition, docSha, sigArmored, attestorKey, attestorMember, gateVersion, deliveredBy = null,
              at = null, members = null } = {}) {
    const id = String(caseId ?? "").trim();
    const ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1 || !docSha || !at || typeof at !== "object")
      return { ok: false, reason: "MALFORMED" };
    if (!sigArmored || !attestorKey || !gateVersion)
      return { ok: false, reason: "CASE_UNSIGNED", caseId: id, edition: ed,
               detail: localize("ratification.index.case_id_edition_ed_is_2", "case {id} edition {ed} is published at a set time only under a member's signature, and this request carries none. Nothing was written.", { id: String(id), ed: String(ed) }) };
    const signer = attestorMember ?? null;
    const args = { case: id, edition: ed, docSha, signature: sigArmored, signer, deliveredBy: deliveredBy ?? null,
                   at: { date: at.date ?? null, time: at.time ?? null }, by: signer };
    return this.record.transact(() => {
      const plan = this.#casePlan({ id, ed, docSha, attestorMember: signer, deliveredBy, sigArmored, retry: false });
      if (!plan.plan) return plan;
      const waiting = this.#waitingEntry(id, ed);
      if (waiting) return this.publishSchedule.scheduleEdition({ ...args, checked: waiting.checked ?? null });
      const PASSED = "PUBLISH_AT_COMMIT_WOULD_PASS";
      const sitting = sittingOf(members);
      const probe = this.record.transact(() => {
        const c = this.publication.commitCaseEdition(this.#commitArgs(plan, { sigArmored, attestorKey,
          attestorMember: signer, gateVersion, deliveredBy }, stampInstant("millisecond")));
        if (!c || !c.ok) return c || { ok: false, reason: "CASE_PUBLISH_FAILED", caseId: id, edition: ed };
        /* R52: the sitting's members, each through R5's commit after the case, made and rolled back with it */
        const m = sitting.length ? this.#commitMembers(sitting) : { ok: true };
        return m.ok ? { ok: false, reason: PASSED } : m;
      });
      if (!probe || probe.reason !== PASSED) return probe;
      const checked = this.#checkedNow(plan, signer, attestorKey, stampInstant("millisecond"));
      if (!checked.ok) return scheduleUncheckableRefusal(id, ed, checked.unreadable);
      /* R52: the sitting's signatures held with the waiting edition, beside what R41 records (not one of its compared
         parts), for R42 to check again and commit after the case */
      return this.publishSchedule.scheduleEdition({ ...args, checked: sitting.length
        ? { ...checked.checked, members: sitting.map((m) => ({ id: m.bundleId, sha: m.bundleSha, signature: m.sigArmored })) }
        : checked.checked });
    });
  }

  /** R42: the scheduled publisher, registered with `publish-schedule` (its R2, R43 here). At `now`, over the document
   *  publication holds at the waiting `doc_sha`, it runs again every check signing ran but those that read the arriving
   *  credential, then reads R41 again and compares it with `checked`. Any refusal, difference or unread part stops it,
   *  one entry per cause, nothing committed; otherwise it commits as R3 commits and answers `{published: true,
   *  published_at}`, with R6's assembly, R37's sealed weeks and R39's copy after the commit. Never throws. */
  async publishScheduled(entry, now) {
    try { return await this.#publishScheduled(entry || {}, now); }
    catch (e) { return { stopped: [unreadableStop(word("ratification.stopped.check_itself_failed", { e: String(String((e && e.message) || e).slice(0, 160)) }))] }; }
  }

  async #publishScheduled(entry, now) {
    const id = String(entry.case ?? entry.case_id ?? "").trim();
    const ed = Number(entry.edition);
    const docSha = entry.doc_sha ?? entry.docSha ?? null;
    const sig = entry.signature ?? entry.sig_armored ?? null;
    const deliveredBy = entry.delivered_by ?? entry.deliveredBy ?? null;
    const at = typeof now === "number" ? new Date(now).toISOString() : typeof now === "string" && now ? now
      : stampInstant("millisecond");
    if (!id || !Number.isInteger(ed) || !docSha || typeof sig !== "string")
      return { stopped: [unreadableStop(word("ratification.stopped.waiting_edition_case"))] };
    const stopped = [];
    /* the signature, against the signers active now */
    const signers = this.credentials.attestingKeys();
    let attestor = null, keyB64 = null;
    if (!signers.length)
      stopped.push(refusedStop({ reason: "NO_SIGNERS", detail: localize("ratification.index.no_active_registered_signing_keys", "no active registered signing keys") }));
    else {
      const sv = await verifySshsig(sig, caseRatifyStatement(id, ed, docSha), NS_RATIFY, signers.map((k) => k.key_b64));
      if (!sv.ok) stopped.push(refusedStop({ reason: `SIG_${sv.reason}`, detail: sv.detail }));
      else { keyB64 = sv.keyB64; attestor = signers.find((k) => k.key_b64 === sv.keyB64)?.member_id ?? null; }
    }
    const signer = attestor ?? (entry.signer ? String(entry.signer).replace(/^member:/, "") : null);
    /* R52: the sitting's members held with the edition, each checked again now, before anything commits */
    const heldMembers = entry.checked && Array.isArray(entry.checked.members) ? entry.checked.members : [];
    const members = [];
    if (heldMembers.length && keyB64) {
      const d0 = this.#caseDocumentRow(id, ed);
      const a0 = d0 ? this.caseTensions.attributionFacts({ text: d0.text, case_id: id, edition: ed }) : null;
      const statedInSitting = statedIn(a0);
      for (const m of heldMembers) {
        const h = await this.#heldMember(m, { statedInSitting, signer, keyB64, deliveredBy });
        if (h.stop) stopped.push(h.stop); else members.push(h.prepared);
      }
    }
    const hold = { seals: null };
    const out = this.record.transact(() => {
      const plan = this.#casePlan({ id, ed, docSha, attestorMember: signer, deliveredBy, sigArmored: sig, retry: false });
      const late = plan.plan ? null : ["CASE_CONCLUSION_MOVED", "CASE_PRODUCTION_DIVERGED"].includes(plan.reason);
      if (!plan.plan && !late) stopped.push(refusedStop(plan));
      const doc = plan.plan ? plan.doc : this.#caseDocumentRow(id, ed);
      /* R49: after CASE_RATIFY_STALE, the group's approvals over the waiting document's bytes */
      if (doc && doc.doc_sha === docSha) {
        const a = this.#approvalCheck(id, ed, doc.text);
        if (a.read && a.read.unreadable) stopped.push(unreadableStop(a.read.unreadable));
        else if (a.refusal) stopped.push(refusedStop(a.refusal));
      }
      if (doc) {
        const attr = this.caseTensions.attributionFacts({ text: doc.text, case_id: id, edition: ed });
        for (const r of [testimonyCaseRefusal(id, ed, attr.legacy), attributionUnchosenRefusal(id, ed, attr),
                         attributionStaleRefusal(id, ed, attr),
                         anonymousTestimonyRefusal(id, ed, this.#uncorroborated(doc.text, attr))])
          if (r) stopped.push(refusedStop(r));
      }
      let gateVersion = null;
      if (doc && doc.doc_sha === docSha) {
        const fm = parseFrontmatter(doc.text);
        const prior = this.#one(`SELECT edition, completeness, bias_acknowledgement FROM published_cases
                                  WHERE case_id=? AND edition<? AND ratified_at IS NOT NULL ORDER BY edition DESC LIMIT 1`, id, ed);
        const gate = this.#caseGateOver(id, ed, fm, this.#memberBasisAtPins(fm.data || {}), prior);
        if (!gate || !gate.ok) stopped.push(refusedStop({ reason: "GATE_REFUSED", findings: gate && gate.findings }));
        else gateVersion = gate.gateVersion;
      }
      if (late) stopped.push(refusedStop(plan));
      if (plan.plan) {
        const read = this.#checkedNow(plan, signer, keyB64 ?? entry.signer_key ?? null, at);
        if (!read.ok) stopped.push(unreadableStop(read.unreadable));
        else for (const d of checkedDiffers(entry.checked, read.checked))
          stopped.push(d.part === "approvals"   /* R50: a changed approval or rule */
            ? scheduledStop(d.code, { cause: { code: "APPROVALS_CHANGED" }, changed: d.changed })
            : d.code === "SCHEDULED_CHECK_REFUSED" ? unreadableStop(word("ratification.unreadable_stop.signing_recorded", { part: String(d.part) }))
            : scheduledStop(d.code, { changed: d.changed }));
      }
      if (stopped.length || !plan.plan) return { ok: false, stopped };
      const done = this.#commitPlan(plan, { sigArmored: sig, attestorKey: keyB64, attestorMember: signer, gateVersion,
                                            deliveredBy }, hold);
      if (!done || !done.ok || done.existed) {
        stopped.push(...commitStops(done && done.existed ? { reason: "CASE_EDITION_ALREADY_RATIFIED" } : done));
        return { ok: false, stopped };
      }
      /* R52: the held members after the case, in this transaction; a refusal stops the edition with them */
      if (members.length) {
        const c = this.#commitMembers(members.map((p) => p.args));
        if (!c.ok) {
          const s = refusedStop(c);
          stopped.push({ ...s, cause: { ...s.cause, member: c.member } });
          return { ok: false, stopped };
        }
        return { ...done, memberCommits: c.commits };
      }
      return done;
    });
    if (!out || out.ok === false) return { stopped: out && out.stopped && out.stopped.length ? out.stopped : stopped };
    /* after the commit, as after R3's: R37's sealed weeks, R39's copy and R6's container; none changes the answer */
    const after = { seals: hold.seals ? await hold.seals : null };
    const w = this.#deps.worker;
    const commits = Array.isArray(out.memberCommits) ? out.memberCommits : [];
    /* R6 after R52: the case editions complete now, the case's own or one its members' commits completed */
    const toAssemble = editionsToAssemble(out.completedCase, commits);
    if (w && w.env && w.storeName) {
      /* R57 (G54): a copy that throws is stated in `after` and handed to the assembly (`prior`), which records the attempt */
      let copyError = null;
      try { after.materials_copied = await copyMaterials(w.env, w.storeName, out.evidenceMaterials || []); }
      catch (e) { copyError = e; after.materials_copied = { ok: false, reason: "COPY_FAILED", detail: errorText(e) }; }
      /* R52: each member's bytes copied and its reused parts re-fetched as op=ratify does (R6) */
      if (commits.length) {
        after.members = [];
        for (const [i, c] of commits.entries()) {
          const row = { bundleId: c.bundleId, edition: c.pub.edition ?? null, existed: !!c.pub.existed };
          try { const cp = await copyFinding(w.env, w.storeName, members[i]);
                row.published = { shas: members[i].shas.length, copied: cp.copied, alreadyPresent: cp.present, r2: cp.r2state,
                                  ...(cp.partsPublished ? { parts: cp.partsPublished } : {}) }; }
          catch (e) { copyError ??= e; row.published = { ok: false, reason: "COPY_FAILED", detail: errorText(e) }; }
          if (w.stub) {
            const rep = await reuseCheck({ env: w.env, ask: askDoor(w.stub), bundleId: c.bundleId,
                                           silentReason: "STORE_DID_NOT_ANSWER", silentDetail: "the store did not answer" })
              .catch((e) => ({ ok: false, reason: "REUSE_CHECK_FAILED", detail: String((e && e.message) || e).slice(0, 160) }));
            if (rep) row.reuse = rep;
          }
          after.members.push(row);
        }
      }
      /* R6, R57 (G54): every edition this commit completed is assembled and every outcome kept, in `after.containers` (one
         `{case, edition, built, code?}` each, for `publish-schedule` R2 to state at settle); `after.container` stays the last
         one's statement. An edition not reached here is owed in publication's ledger and the sweep builds it. */
      if (toAssemble.length) {
        after.containers = [];
        for (const cs of toAssemble) {
          if (w.stub) {
            after.container = await assembleEdition({ assemble: w.assembleCaseContainer || casefile.assembleCaseContainer,
              recordFailure: w.recordCaseFileFailure || casefile.recordCaseFileFailure, env: w.env, stub: w.stub,
              storeName: w.storeName, cs, via: "publishscheduled",
              prior: priorOf({ missing: after.materials_copied && Array.isArray(after.materials_copied.missing)
                                 ? after.materials_copied.missing : [], copyError }) });
            after.containers.push(outcomeOf(cs, after.container));
          } else after.containers.push(outcomeOf(cs, null));
        }
      }
    } else {
      if (toAssemble.length) after.containers = toAssemble.map((cs) => outcomeOf(cs, null));
      after.not_done = { materials: (out.evidenceMaterials || []).length, container: toAssemble.length > 0,
        ...(commits.length ? { members: commits.map((c) => c.bundleId) } : {}),
        detail: localize("ratification.index.the_published_bucket_is_not", "the published bucket is not reachable from here, so the materials held in the evidence store were not copied and a complete edition's container was not assembled; a re-sent op=caseratify with the same signature does both (R39, R6). The edition is published and this answer stands.{v1}", { v1: String(commits.length ? " The members committed with it were not copied either; re-sending each one's "
                                  + "op=ratify with the same signature copies it (R6)." : "") }) };
    }
    return { published: true, published_at: out.ratified_at, caseId: id, edition: ed, after };
  }

  /* Each roster member's `{basis, references}` at the bytes its `case_roles` row pins (record-core R60), for the case
     gate's C-2.8 arms (case-catalogue R6: a severed reference at the pinned bytes drops its leg there, as on the member's
     own arm); a member whose pinned bytes the record cannot produce is absent, so those arms are left unasked for it
     (publication's `caseDocumentFacts` builds the act's the same way). */
  #memberBasisAtPins(fm) {
    const out = {};
    for (const r of Array.isArray(fm.case_roles) ? fm.case_roles : []) {
      if (!r || typeof r !== "object" || typeof r.target !== "string") continue;
      const text = this.record.textAtSha(r.target, typeof r.version_sha === "string" ? r.version_sha : null);
      if (text === null) continue;
      const mfm = parseFrontmatter(text).data || {};
      out[r.target] = { basis: Array.isArray(mfm.basis) ? mfm.basis : [],
                        references: Array.isArray(mfm.references) ? mfm.references : [] };
    }
    return out;
  }


  /* ===== R3 — CASE-5b / DEC-72: THE CASE RATIFICATION COMMITTER ==================

     THIS IS THE METHOD THE WHOLE ITEM EXISTS FOR. Every case fact this plane
     holds is written here, FROM THE SIGNED CASE DOCUMENT AND FROM NOTHING ELSE
     — publication's `publishEdges` doctrine, arriving at the altitude the facts were always
     about. `cases`, `published_cases` and `published_case_members` are all
     parsed out of `case_documents.text`, whose hash the signature covers.

     THE FIRST FENCE IS THE ITEM'S OWN. `CASE_UNSIGNED` refuses a commit that
     arrives without an armored signature and an attestor key. It is a REFUSAL
     and not an `if` around the writes, and the difference is the whole point: a
     silent skip would mean a caller who reached this method without a signature
     got nothing written and no reason, which is indistinguishable from a caller
     whose case had nothing to write. Named, it says exactly what this record
     refuses — committing a group's case assertions from an unsigned request.

     THE PARAMETERS THAT ARE NOT READ FROM THE DOCUMENT are the signature itself,
     the key that made it, the member that key belongs to, and the catalog
     version that judged it. Those are facts about the ACT rather than about the
     case, and an act's own facts are exactly what a request legitimately carries
     — the same split `publish()` already makes one altitude down.

     `docSha` IS CHECKED AGAINST THE STORED ROW rather than trusted, because the
     control plane verified a signature over a hash and this method must be sure
     it is committing the bytes that hash names. A mismatch means the document
     moved between the read and the commit, which is RATIFY_STALE's question
     arriving here.

     IDEMPOTENT ON A RETRY. Re-ratifying the same edition with the same sha and
     the same signature reports `existed` and writes nothing, exactly as
     `publish()` does: a retry is not a revision. A DIFFERENT signature over the
     same edition is refused, because an edition answers forever and two
     attestations of one edition would leave a reader unable to say who stood
     behind it.

     R37 (DEC-111): ONCE THE EDITION IS COMMITTED its project's sealed weeks are opened (`network-notices.openSeals`, its
     R17), outside the commit's transaction: held with record-core's `afterCommit` (its R66), so it starts only after the
     outermost commit and is dropped with any refusal or rollback; a retry answering `existed` opens nothing. It is
     async, so the act answers once it settles: its answer is `seals`, and a failure never changes the ceremony's
     answer. It is stated there, and the `working-on-attest` consumer retries the opening. */
  async ratifyCaseDocument({ caseId, edition, docSha, sigArmored, attestorKey, attestorMember,
                             gateVersion, deliveredBy = null, members = null } = {}) {
    const id = String(caseId ?? "").trim();
    const ed = Number(edition);
    if (!id || !Number.isInteger(ed) || ed < 1 || !docSha) return { ok: false, reason: "MALFORMED" };
    if (!sigArmored || !attestorKey || !gateVersion)
      return { ok: false, reason: "CASE_UNSIGNED", caseId: id, edition: ed,
               detail: localize("ratification.index.a_cases_own_assertions_its", "a case's own assertions — its identity, its producing project, its scope, its roster, its load-bearing partition, its bias acknowledgement and its standard of evidence — are committed from BYTES A MEMBER SIGNED and from nothing else. This request carries no signature over case {id} edition {ed}, so committing it would mean this plane asserting a team's case on their behalf. Review the case document (op=casedocument) and ratify it (op=caseratify).", { id: String(id), ed: String(ed) }) };
    const hold = { seals: null };
    /* R52: the sitting's members (each `publish`'s arguments, verified by the Worker), committed after the case in this
       one transaction; a member's refusal rolls the case back with it, so nothing is written. A retry of the case's own
       signature (`existed`) still commits them, each idempotent. */
    const sitting = sittingOf(members);
    const withMembers = (done) => {
      if (!done || !done.ok || !sitting.length) return done;
      const m = this.#commitMembers(sitting);
      return m.ok ? { ...done, memberCommits: m.commits } : m;
    };
    const out = this.record.transact(() => {
      const plan = this.#casePlan({ id, ed, docSha, attestorMember, deliveredBy, sigArmored, retry: true });
      if (!plan.plan) return withMembers(plan);
      /* R3 (DEC-147): an edition `publish-schedule` holds waiting (its R1) is not published now: an owner cancels the set
         time (its R3) and signs again. Nothing is written. */
      const waiting = this.#waitingRefusal(id, ed);
      if (waiting) return waiting;
      return withMembers(this.#commitPlan(plan, { sigArmored, attestorKey, attestorMember, gateVersion, deliveredBy }, hold));
    });
    return hold.seals ? { ...out, seals: await hold.seals } : out;
  }

  /* R3's checks before its commit, in its order, for `op=caseratify`'s commit, `op=publishat` (R40) and the scheduled
     publisher (R42) alike, inside the caller's transaction: a refusal (or, with `retry`, the same signature's `existed`
     answer), else the plan `#commitPlan` commits, read from the stored document's bytes only. Without `retry` an edition
     already ratified is CASE_EDITION_ALREADY_RATIFIED whatever its signature. */
  #casePlan({ id, ed, docSha, attestorMember, deliveredBy, sigArmored, retry = false }) {
    const doc = this.#caseDocumentRow(id, ed);
    if (!doc) return { ok: false, reason: "NO_CASE_DOCUMENT", caseId: id, edition: ed };
    if (doc.doc_sha !== docSha)
      return { ok: false, reason: "CASE_RATIFY_STALE", caseId: id, edition: ed,
               expected: doc.doc_sha, got: docSha,
               detail: localize("ratification.index.the_case_document_has_changed", "the case document has changed since it was reviewed. Read it again and re-sign: a signature over the previous bytes says nothing about these.") };
    /* OUT OF THE SIGNED BYTES. Parsed here rather than at the control plane
       for `publish()`'s own reason: the bytes are in this store, and re-reading
       them at the layer that already verified a hash over them is where the
       two could come to disagree. Parsed BEFORE the retry check (moved up by
       REC-137) because both of the authority questions below are asked of the
       PUBLISHING PROJECT. */
    const fm = parseFrontmatter(doc.text).data || {};
    const roster = (Array.isArray(fm.case_findings) ? fm.case_findings : [])
      .map((x) => String(x ?? "").trim()).filter(Boolean);
    const rows = (Array.isArray(fm.case_roles) ? fm.case_roles : [])
      .filter((r) => r && typeof r === "object")
      .map((r) => ({ target: String(r.target ?? "").trim(), role: String(r.role ?? "").trim(),
                     version_sha: typeof r.version_sha === "string" ? r.version_sha : null }));
    const project = typeof fm.case_project === "string" && fm.case_project !== "null"
      ? fm.case_project.trim() : null;
    /* ===== REC-137 — WHO AUTHORISES A CASE, AND WHO MAY CARRY IT IN ==================
       Membership Architecture v2 §7, *"A CASE RATIFICATION: who AUTHORISES it and who
       may DELIVER it"* (BOB #15, 2026-09-18). Two questions, two answers, asked in this
       order and BEFORE the idempotent retry below, so a refused deliverer or a
       non-owner's signature is refused whether or not the edition already stands:

       (1) DELIVERY IS CARRIAGE, NOT DIRECTION (AI Roles §3 rule 4: the record states
           signer and deliverer apart). A member with a role in the project may deliver,
           and so may the FOUNDER, as DEC-33's interim publishing route; an enrolled
           administrator with no role in the project may NOT — administrators direct
           nothing (§4.9). The member half is REC-134's ONE positional check, consumed
           and never restated: `deliveredBy` is the control plane's reading of the SESSION
           ROW (`deliveringPrincipal`, REC-128), `member:<id>` for a member's session —
           byte-identical to `resolveSession`'s positional identity for that session — and
           `founder` for the founder's. The founder is told apart HERE by that principal
           and never by the folded name: a member ENROLLED as `admin` delivers as
           `member:admin`, is asked, and is not the founder. An ABSENT deliverer is every
           internal caller (a store-level committer, the legacy arms), not asked, as at
           every REC-134 act.
       (2) THE AUTHORITY IS THE SIGNATURE, AND IT MUST BE AN OWNER'S (DEC-72 clause 5:
           publishing is the project owner's act). Before this the instance-wide signer
           set was the only authority asked, so any registered signer could commit an
           owner's case under their own name. Asked through membership's owner predicate, §7's one
           owner predicate, never a second spelling of it. A case document naming no
           project has no owner to sign it and is refused by the same rule — DEC-72
           removed the project-less case, so this is a legacy document, and an absent
           publisher is not a publisher of none. */
    /* REC-140: both questions now live in membership's `caseAuthority`, which `op=ratify` asks too for a
       finding a ratified case pins — MOVED there, not restated, so there is one rule. */
    const denied = this.membership.caseAuthority({ project, deliveredBy, signer: attestorMember, act: "caseratify",
                                         subject: `case ${id} edition ${ed}`, extra: { caseId: id, edition: ed } });
    if (denied) return denied;
    /* ===== END REC-137 ================================================================ */
    if (doc.ratified_at) {
      if (retry && doc.sig_armored === sigArmored)   /* R39: a retry re-copies what the commit held in the evidence store */
        return { ok: true, existed: true, caseId: id, edition: ed,
                 evidenceMaterials: copiedMaterials(this.publication.heldMaterialsOf?.(id, ed)),
                 /* R6: and assembles a complete edition's container if the commit's assembly never ran (R42) */
                 ...this.#completedCase(id, ed) };
      return { ok: false, reason: "CASE_EDITION_ALREADY_RATIFIED", caseId: id, edition: ed,
               detail: localize("ratification.index.case_id_edition_ed_is_3", "case {id} edition {ed} is already ratified under a different signature. An edition is a separate document and answers forever — a second attestation over the same number would leave a reader unable to say who stood behind what they read. Publish a new edition instead.", { id: String(id), ed: String(ed) }) };
    }
    /* ===== REC-167 / INVESTIGATIVE-SESSION.md §7.1 items 4 and 9 — THE CONCLUSION A PREPARATION
       RECORDS MUST STILL BE THE ONE ITS PROJECT STANDS ON WHEN IT IS SIGNED ======================
       WHAT WAS WRONG, measured by REC-157 (M-92): a project concludes, `op=publish` prepares an edition
       whose document RECORDS that conclusion (REC-135, `case_conclusions:`), the project WITHDRAWS, and
       this committer still signed the document — the published edition then asserted, as the project's,
       a conclusion the project had given up before anybody signed. Nothing here re-asked the
       relationship: `op=publish` asked it once, at preparation, and the window after is exactly where a
       project's conclusion can move while the finding's bytes and this document do not.
       SO THIS ASKS, PER ROSTER MEMBER, WHAT `op=publish` ASKS, through the SAME two readers and never a
       copy of either: (1) `caseConclusionFor` — is the question concluded FOR THE DOCUMENT'S PUBLISHING
       PROJECT (the NOT_CONCLUDED gate's one reader), and (2) item 9's comparison, the one
       `editionsRecordingConclusion` makes, asked of THIS ONE DOCUMENT's text — is that conclusion the one the
       document RECORDS (a project conclusion compared as the dated, authored ENTRY; a no-project one by the
       pin). Both are `#conclusionsMoved`, which R18's pre-flight asks of the unsigned text too. Concluded-ness ALONE would pass a project that withdrew and concluded again on another
       claim — the document would then sign claim A for a project standing on claim B — so both are asked.
       THE VIEWER IS THE SIGNER, who `caseAuthority` just established is an OWNER of the project, so the
       project's own record is in sight; an owner cannot be told a project it owns "never concluded"
       for want of sight.
       ASKED AFTER THE RETRY, deliberately: a ratified edition answers forever (DEC-19 — its conclusion is
       history once signed), so a byte-identical retry of an edition that already stands still reports
       `existed`, and this question is asked only of a document about to be signed. ASKED BEFORE ANY
       WRITE, inside the transaction, so a refusal commits nothing. The route is item 9's: publish again,
       and the new document records what the project stands on now (REC-157 made that edition reachable). */
    {
      const moved = this.#conclusionsMoved(doc.text, project, roster, attestorMember);
      const refusal = conclusionMovedRefusal(id, ed, project, moved);
      if (refusal) return refusal;
    }
    /* ===== END REC-167 ================================================================ */
    /* CASE-2's INVARIANT, UNCHANGED AND NOW ASKED ONCE. A case does not change
       hands between editions (DEC-72): the bar is read from the publishing
       project at act time, so two answers here would be two standards of
       evidence for one case with nobody having authored either. `cases` is
       keyed on case_id ALONE precisely so this is a refusal rather than a
       second row. */
    /* REC-212 / §3 rule 13 — READ ONCE, so the committed row and this act's answer cannot come apart.
       `hasOwnProperty` and not truthiness: a document that SAYS UNDETERMINED (`statement_by: null`)
       and one that says NOTHING (no key, authored before rule 13) are two different facts, and
       collapsing them would let the second be read as the first. */
    const stmtWriter = (() => {
      const c = fm.completeness && typeof fm.completeness === "object" ? fm.completeness : null;
      const pub = c && typeof c.author === "string" && c.author.trim() ? c.author.trim() : "(unnamed)";
      if (!c || !Object.prototype.hasOwnProperty.call(c, "statement_by"))
        return { by: null, stated: localize("ratification.index.this_case_document_says_nothing", "this case document says nothing about who wrote its exclusion statement: it was authored before the record told the statement's writer apart from the case's publisher (BIO_Publication §3 rule 13), and {pub}, who prepared and published it, is not evidence of either.", { pub: String(pub) }) };
      const by = typeof c.statement_by === "string" && c.statement_by.trim() ? c.statement_by.trim() : null;
      if (!by)
        return { by: null, stated: localize("ratification.index.undetermined_this_case_document_states", "UNDETERMINED: this case document states that who wrote its exclusion statement could not be established, and it is NOT read off {pub}, who prepared and published the case (BIO_Publication §3 rule 13).", { pub: String(pub) }) };
      return { by, stated: by === pub
        ? word("ratification.stated.wrote_case_exclusion", { by: String(by) })
        : localize("ratification.index.by_wrote_this_cases_exclusion", "{by} wrote this case's exclusion statement; {pub} prepared and published the case — two acts, two names (BIO_Publication §3 rule 13).", { by: String(by), pub: String(pub) }) };
    })();
    const owner = this.#caseOwner(id);
    if (owner && owner.project_id !== project)
      return { ok: false, reason: "CASE_PRODUCTION_DIVERGED", caseId: id, edition: ed,
               declared: owner.project_id, signed: project,
               detail: localize("ratification.index.case_id_is_project_id", "case {id} is {project_id}'s production and this signed case document names {project}. A case does not change hands between editions (DEC-72).", { id: String(id), project_id: String(owner.project_id), project: String(project) }) };
    /* THE COMMIT, through publication (its R22), in this transaction and from the signed bytes only (R13): the
       case's owner at its first edition, the edition's scope, completeness and bar, the roster with its roles and
       pins in the roster's own order (the authored publish order), and the signature, signer and deliverer on the
       document. A retry with the same signature answers `existed`, another CASE_EDITION_ALREADY_RATIFIED.
       `deliveredBy` is the control plane's reading of the SESSION and is written as handed — never defaulted to
       `attestorMember` (REC-128, R12). */
    const completeness =
      fm.completeness ? {
        ...completenessFields(fm),
        subject_position: fm.completeness.subject_position ?? null,
        author: fm.completeness.author ?? null,
        /* REC-212 / §3 rule 13: WHO WROTE THE STATEMENT, committed FROM THE SIGNED BYTES and never
           from `author` above, who prepared and published the case. THREE STATES, not two, and the
           sentence beside the name is what tells them apart for a reader of `op=publishedcase`: a
           name; `null` where this plane established that it could not say (a stated UNDETERMINED);
           and a document authored before this key existed, which says NOTHING about the writer —
           and whose publisher's name is not evidence of either. The last two both commit as null,
           which is why the sentence is committed with them rather than derived by each reader. */
        statement_by: stmtWriter.by,
        statement_by_stated: stmtWriter.stated,
        at: fm.completeness.at ?? null,
        /* D-150 / §3 rule 11: THE SIGNED LIST, committed from the signed bytes. NULL — never
           an empty list — for a document authored before acknowledgements were recorded: it
           says nothing about who else read its statement, which is not the same fact as
           nobody having done so. */
        acknowledgements: Array.isArray(fm.completeness_acknowledgements)
          ? fm.completeness_acknowledgements.filter((a) => a && typeof a === "object")
              .map((a) => ({ kind: a.kind ?? null, by: a.by ?? null,
                             recipient: a.recipient === "null" ? null : a.recipient ?? null, at: a.at ?? null,
                             /* REC-217: a row the publisher's link brought in says so, from the signed bytes. */
                             ...(typeof a.draft === "string" && a.draft && a.draft !== "null"
                               ? { draft: a.draft } : {}) }))
          : null,
        /* REC-217 / §3 rule 13 (BOB #33): THE LINK AS SIGNED — the draft the publisher named, who and when —
           committed from the signed bytes and present only where the document states one. */
        ...(typeof fm.completeness.draft === "string" && fm.completeness.draft && fm.completeness.draft !== "null"
          ? { draft: { draft_id: fm.completeness.draft, named_by: fm.completeness.draft_named_by ?? null,
                       named_at: fm.completeness.draft_named_at ?? null } } : {}),
        acknowledgements_truncated: Array.isArray(fm.completeness_acknowledgements)
          ? fm.completeness.acknowledgements_truncated === true : null,
      } : null;
    return { plan: true, id, ed, doc, fm, roster, rows, project, stmtWriter, completeness };
  }

  /* publication R22's commit arguments for a plan, from the signed bytes only (R13), the act's own facts beside them. */
  #commitArgs({ id, ed, fm, roster, rows, project, completeness }, { sigArmored, attestorKey, attestorMember, gateVersion,
              deliveredBy }, now) {
    return {
      case: id, edition: ed, project, at: now,
      scope: typeof fm.case_scope === "string" ? fm.case_scope : null,
      completeness,
      biasAcknowledgement: typeof fm.bias_acknowledgement === "string" ? fm.bias_acknowledgement : null,
      bar: fm.required_strength && typeof fm.required_strength === "object" ? fm.required_strength : null,
      roster: roster.map((m) => {
        const r = rows.find((x) => x.target === m) || {};
        return { bundle_id: m, role: r.role ?? null, version_sha: r.version_sha ?? null };
      }),
      sigArmored, attestorKey, attestorMember: attestorMember ?? null, gateVersion, deliveredBy: deliveredBy ?? null };
  }

  /* R3's commit of a plan, through publication (its R22), in the caller's transaction, with R3's discharge, R36's
     telling and R37's sealed weeks held for after the commit (`hold.seals`). */
  #commitPlan(plan, signing, hold) {
    const { id, ed, doc, fm, roster, rows, project, stmtWriter } = plan;
    const { attestorMember } = signing;
    const now = stampInstant("millisecond");
    const committed = this.publication.commitCaseEdition(this.#commitArgs(plan, signing, now));
    if (!committed || !committed.ok) return committed || { ok: false, reason: "CASE_PUBLISH_FAILED", caseId: id, edition: ed };
    const evidenceMaterials = copiedMaterials(committed.materials ?? this.publication.heldMaterialsOf?.(id, ed));   /* R39 */
    if (committed.existed) return { ok: true, existed: true, caseId: id, edition: ed, evidenceMaterials };
    /* R3, case-tensions R2 (was publication R5): a ratified newer edition discharges the case's outstanding revision flags, stamped with
       who ratified it and when; never deleted (set-but-never-clear). */
    this.caseTensions.dischargeCaseFlags(id, ed, attestorMember ?? null, now);
    /* R36 (DEC-102 item 2): each observation this edition reaches, and each off-the-record capture's attesting member
       (a row keyed `capture`, publication R60; DEC-119 (3)), whose level in force (stated in the signed bytes, C-92.11)
       differs from its level at the case's previous ratified edition is told to reevaluation (its R29, R32), in this
       transaction, once. A first edition, or one the previous edition did not reach, tells nothing. */
    const prior = this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition<? AND ratified_at IS NOT NULL
                              ORDER BY edition DESC LIMIT 1`, id, ed);
    const levelsIn = (text) => {
      const rows = (parseFrontmatter(text).data || {}).observation_attributions;
      return new Map((Array.isArray(rows) ? rows : []).filter((x) => x && (x.observation || x.capture) && x.level
        && x.level !== "null").map((x) => [x.observation ? `observation ${x.observation}` : `capture ${x.capture}`,
                                           String(x.level)]));
    };
    const was = prior ? levelsIn(prior.text) : new Map();
    for (const [k, to] of prior ? levelsIn(doc.text) : []) {
      const [kind, key] = k.split(" ");
      if (was.has(k) && was.get(k) !== to)
        this.reevaluation.levelMoved({ [kind]: key, from: was.get(k), to, case: id, edition: ed, at: now });
    }
    /* D-442 / BIO_Publication_v0_1.md §3 rule 12: A CASE CAN BE COMPLETE THE MOMENT ITS DOCUMENT IS RATIFIED —
       every member pinned at bytes another case already carried across — and then no op=ratify will ever complete
       it. The commit answers the edition's state (`state`, read with the group off a member's pinned bytes), so
       the control plane can assemble the container (`assembleCaseContainer`). */
    const completedCase = committed.state && committed.state.complete && !committed.state.manifest_sha
      ? committed.state : null;
    this.record.afterCommit(() => { hold.seals = this.#openSeals(id, ed); });   /* R37 */
    return { ok: true, caseId: id, edition: ed, project, roster,
             /* REC-212 / §3 rule 13: BOTH NAMES IN THIS ACT'S ANSWER — who wrote the statement and who prepared and
                published the case — from the one read above, so the answer and the committed row are one fact. */
             statement: { author: fm.completeness && typeof fm.completeness === "object"
                            ? (fm.completeness.author ?? null) : null,
                          by: stmtWriter.by, stated: stmtWriter.stated },
             ...(completedCase ? { completedCase } : {}), evidenceMaterials,
             members: roster.map((m) => {
               const r = rows.find((x) => x.target === m) || {};
               return { bundle_id: m, role: r.role ?? null, version_sha: r.version_sha ?? null };
             }),
             ratified_at: now,
             /* THE EDITION IS NOT COMPLETE YET AND THAT IS STATED RATHER THAN HIDDEN. The case is committed; every
                member still signs its own bytes, because the finding is the unit of truth. `awaiting` is the roster
                less what is published at its pin. */
             awaiting: Array.isArray(committed.awaiting) ? committed.awaiting : [] };
  }

  /* R52: each member of a sitting through R5's commit (`publish`), in the caller's transaction and in the sitting's
     order, after the case; the first refusal is answered naming its member (the caller's transaction then rolls back). */
  #commitMembers(list) {
    const commits = [];
    for (const m of list) {
      const pub = this.publish(m);
      if (!pub || !pub.ok)
        return { ...(pub && pub.reason ? pub : { reason: "PUBLISH_FAILED", detail: pub ?? null }), ok: false,
                 member: m.bundleId ?? null };
      commits.push({ bundleId: m.bundleId, pub });
    }
    return { ok: true, commits };
  }

  /* R52 in R42: a held member of a sitting checked again at the set time, as R4 checks it but for the credential: the
     gate facts read for the signer (R7's sight), C-58.1, C-53.10, C-53.11, C-92.12 (the waiting document's statements
     counting, as at signing), RATIFY_STALE, the signature against the one key the case verified against now, and the
     store-half gate with its register and case-member arms. Bias's C-26 arm is the control plane's and is not reached
     here: it reads only the image, whose bytes RATIFY_STALE has just shown unchanged since signing passed it. Answers
     `{stop}` or `{prepared}` (`publish`'s arguments, and what the copy needs). */
  async #heldMember(m, { statedInSitting, signer, keyB64, deliveredBy }) {
    const id = m && typeof m.id === "string" ? m.id : null;
    const stop = (r) => { const s = refusedStop(r); return { stop: { ...s, cause: { ...s.cause, member: id } } }; };
    if (!id || typeof m.sha !== "string" || typeof m.signature !== "string")
      return { stop: unreadableStop(word("ratification.stop.held_member_signature", { unnamed: String(id ?? "unnamed") })) };
    const viewer = `member:${signer}`;
    const facts = this.gateFacts(id, viewer);
    if (!facts || !facts.ok) return stop(facts || { reason: "ABSENT" });
    const early = findingFactsRefusal(facts, { bundleId: id, expectedSha: m.sha, statedInSitting });
    if (early) return stop(early.body);
    const sv = await verifySshsig(m.signature, ratifyStatement(id, m.sha), NS_RATIFY, [keyB64]);
    if (!sv.ok) return stop({ reason: `SIG_${sv.reason}`, detail: sv.detail });
    const image = this.record.readImage(id) || {};
    const seen = (b) => { try { return this.membership.inSight(b, viewer) === true; } catch { return false; } };
    const known = this.#rows(`SELECT bundle_id FROM bundles`).map((r) => r.bundle_id).filter(seen);
    const { parted, ...registerGate } = await this.ratifyGate({ bundleId: id, image, knownIds: known,
      registers: facts.registers, publishedRegistry: facts.publishedRegistry,
      publishedCaseRegistry: facts.publishedCaseRegistry, earnedRegistry: facts.earnedRegistry });
    const partedRows = new Map(Array.isArray(parted) ? parted : []);
    const gate = withCaseMemberChecks(image, registerGate, parseFrontmatter);
    if (!gate.ok) return stop({ reason: "GATE_REFUSED", findings: gate.findings });
    const { shas, partShaSet } = await findingShas(image, partedRows, facts.registers);
    return { prepared: { shas, partShaSet, partedRows,
      args: findingPublishArgs({ bundleId: id, expectedSha: m.sha, image, shas, sig: m.signature, keyB64,
                                 attestorMember: signer, gateVersion: gate.gateVersion, deliveredBy }) } };
  }

  /* R37: `openSeals`' answer, or, when it refuses, throws or rejects, the failure stated; never a throw. */
  #openSeals(caseId, edition) {
    const unopened = (reason, detail) => ({ ok: false, opened: false, reason,
      detail: localize("ratification.index.the_sealed_weeks_of_case", "the sealed weeks of case {caseId} edition {edition} were not opened at this act ({detail}). The edition is committed and this answer stands; the working-on-attest consumer retries the opening.", { caseId: String(caseId), edition: String(edition), detail: String(detail) }) });
    let p;
    try { p = Promise.resolve(this.networkNotices.openSeals({ case: caseId, edition })); } catch (e) { p = Promise.reject(e); }
    return p.then((r) => (r && typeof r === "object" && r.ok !== false ? r
                          : unopened(r && r.reason ? r.reason : "OPEN_SEALS_FAILED", r && r.detail ? r.detail : "no answer")),
                  (e) => unopened("OPEN_SEALS_FAILED", String((e && e.message) || e).slice(0, 200)));
  }


  /* ===== R5 — THE FINDING COMMITTER: WHAT MAY CROSS, AND UNDER WHOSE AUTHORITY ================================
     REC-14 / DEC-12: the committer APPENDS AN EDITION, and its write is publication's `commitEdition` (its R22).
     What stays here is what decides who may publish: a finding a RATIFIED case pins crosses under the case's rules
     (REC-140), and nothing crosses outside a ratified case (D-431). CASE-5b: eight case parameters left this signature
     — every one of them was a case fact the control plane read out of a MEMBER's frontmatter; the case's facts are
     committed by `ratifyCaseDocument` out of the case's own signed document, and this method resolves the relation
     from the pin. */
  publish({ bundleId, bundleSha, attestorKey, attestorMember, gateVersion, sigArmored, shas,
            edition, title, completeness, strength, edges, group = null, deliveredBy = null,
            /* D-442: whether THESE signed bytes carry their own frozen blocks (a member published
               before BIO_Publication_v0_1.md §3 rule 12, whose `published_strength` the control plane
               read and passed as `strength`). False for a member published under rule 12: its
               edition and frozen pair are then read from the case documents pinning it. */
            memberCarriesBlocks = false } = {}) {
    if (!bundleId || !bundleSha || !attestorKey || !gateVersion || !sigArmored || !Array.isArray(shas))
      return { ok: false, reason: "MALFORMED" };
    return this.record.transact(() => {
      /* ===== REC-140 / D-429 — A FINDING A RATIFIED CASE PINS IS PUBLISHED UNDER THE CASE'S RULES ====
         BIO_Publication_v0_1.md §3 rule 2, as BOB #15 applied it: *wherever op=ratify ratifies a
         finding it takes case ratification's rules* — an OWNER of the publishing project signs, and
         the deliverer is the founder or a JOINED member. Asked through membership's `caseAuthority`, the one
         helper `ratifyCaseDocument` asks, FIRST in this transaction: before the edition refusals and
         before the idempotent retry, so nothing is written on a refusal and a retry is never an
         authority answer to somebody with none.
         WHICH FINDINGS: those whose bytes a RATIFIED case edition pins (publication's `pinnedCaseEditionsOf`, the
         same relation this method commits against below). A ratified case document is public, so the
         project a refusal names is already public — nothing here needs a sight answer.
         WHAT THIS DID NOT REACH, as REC-140 reported it for a ruling: a bundle no ratified case pins —
         an information bundle, a concluded inquiry in no case, and a finding PREPARED into a case whose
         document is not yet ratified — was published exactly as before. D-431 closes all three in the
         block that follows this one.
         SEVERAL PROJECTS: a finding two projects' cases pin is published if SOME publishing project
         passes both questions (its owner signed, its member or the founder delivered); otherwise the
         answer is the first project's refusal, in id order, so it is deterministic. */
      const pinnedBy = this.publication.pinnedCaseEditionsOf(bundleId, bundleSha);
      if (pinnedBy.length) {
        const byProject = new Map();
        for (const pin of pinnedBy) {
          const owner = this.#caseOwner(pin.case_id);
          const pid = owner ? owner.project_id ?? null : null;
          if (!byProject.has(pid)) byProject.set(pid, []);
          byProject.get(pid).push(`${pin.case_id} edition ${Number(pin.edition)}`);
        }
        let refused = null;
        for (const pid of [...byProject.keys()].sort()) {
          const denied = this.membership.caseAuthority({ project: pid, deliveredBy, signer: attestorMember, act: "ratify",
            subject: word("ratification.subject.finding_member_case", { bundle_id: String(bundleId), pid: String(byProject.get(pid).join(", ")) }),
            extra: { bundleId } });
          if (!denied) { refused = null; break; }
          refused = refused || denied;
        }
        if (refused) return refused;
      }
      /* ===== D-431 — NOTHING CROSSES OUTSIDE A RATIFIED CASE (BIO_Publication_v0_1.md §3 rule 2, the second
         note, BOB #16, 2026-09-19; decided from rule 2 and rule 1) =======================================
         REC-140 pinned three publications OUTSIDE a case, as measured: an information bundle in no case, a
         concluded inquiry in no case, and a finding PREPARED into a case whose document was not yet ratified
         (published loose, so the ceremony's order was not enforced). Each is closed here, in the one committer,
         inside its transaction and before the edition refusals and the idempotent retry — so nothing is written
         on a refusal and a retry of bytes that crossed before this rule is not an answer to anybody (what
         crossed stays crossed, rule 1: nothing here retracts a row).
         (a) A FINDING is ratified only at a `bundle_sha` a RATIFIED case pins — the branch above. A finding at
             any other sha is refused C-58.2, naming `op=caseratify` as the act to take first: the case
             document commits the case and its pins BEFORE any member signs (`ratifyCaseDocument`), so "case
             document first" is the ceremony's own order and refusing the other order is not circular.
         (b) ANY OTHER BUNDLE crosses only as EVIDENCE a ratified case's pinned finding RESTS ON
             (publication's `ratifiedFindingsRestingOn`, over `publishedGraphEdges` — the published graph's own edge
             set), signed and delivered as that finding is: `caseAuthority` for that case's project, and when
             several ratified cases' projects rest on it an owner of ANY of them may sign. An inquiry a pinned
             finding rests on crosses here too, as evidence; one nothing rests on is (a)'s.
         SIGHT: the control plane asked it at the gate facts (REC-140), and only PROJECT rows are ever hidden.
         What is consulted here is the RATIFIED cases, which are public, so the answer for a bundle no ratified
         case rests on is the same bytes whether or not some project the caller cannot see is preparing a case
         over it — nothing unratified is read, so there is nothing to disclose. */
      if (!pinnedBy.length) {
        /* N308 (K380): what rests on the bundle is read a page of pins at a time (publication R38's cursor), from the
           start through each `cursor` to null, and no further once a resting finding's project admits the act. A page
           may answer no finding while its cursor is set. The outcome is the one a whole list gave: admitted when some
           resting project's owner signed and its member or the founder delivered; else the refusal of the first
           project in id order, naming every finding of that project that rests on the bundle. */
        const byProject = new Map();
        let admitted = false;
        for (let after = null; ;) {
          const page = this.publication.ratifiedFindingsRestingOn(bundleId, { after });
          for (const r of page.findings) {
            if (!byProject.has(r.project)) {
              byProject.set(r.project, []);
              admitted = !this.membership.caseAuthority({ project: r.project, deliveredBy, signer: attestorMember,
                act: "ratify", subject: bundleId, extra: { bundleId } });
            }
            byProject.get(r.project).push(`${r.finding} of case ${r.case_id}`);
            if (admitted) break;
          }
          if (admitted || page.cursor === null || page.cursor === undefined) break;
          after = page.cursor;
        }
        if (!byProject.size) {
          const head = this.record.head(bundleId);
          const refusal = (code, detail) => {
            const row = RATIFY_SCOPE_CHECKS[code];
            return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, bundleId };
          };
          /* DEC-49 REGION is-ratify-outside-a-case */
          if (head && normalizeType(head.type) === "inquiry")
            return refusal("RATIFY_FINDING_NOT_IN_A_RATIFIED_CASE",
              localize("ratification.index.bundleid_at_string_is_not", "{bundleId} at {String} is not a finding any RATIFIED case pins, and a finding is published only as a member of a ratified case (BIO_Publication_v0_1.md §3 rule 2). Publish it into a case from its project (op=publish), have an owner of that project sign the case document (op=caseratify) FIRST, and then ratify this finding at the version the case pinned. Nothing was published.", { bundleId: String(bundleId), String: String(String(bundleSha).slice(0, 12)) }));
          return refusal("RATIFY_NOT_EVIDENCE_OF_A_RATIFIED_CASE",
            localize("ratification.index.no_finding_of_a_ratified", "no finding of a RATIFIED case rests on {bundleId}, and anything that is not a finding crosses only as the evidence a ratified case's finding rests on (BIO_Publication_v0_1.md §3 rule 2). Cite it from a finding, publish that finding's case and have an owner sign the case document (op=caseratify); then an owner of that project may sign this. Nothing was published.", { bundleId: String(bundleId) }));
          /* END DEC-49 REGION is-ratify-outside-a-case */
        }
        if (!admitted) {
          const pid = [...byProject.keys()].sort()[0];
          return this.membership.caseAuthority({ project: pid, deliveredBy, signer: attestorMember, act: "ratify",
            subject: word("ratification.subject.evidence_rests", { bundle_id: String(bundleId), pid: String(byProject.get(pid).join(", ")) }),
            extra: { bundleId } }); /* D-431 (b) */
        }
      }
      /* THE COMMIT, through publication (its R22, R35), in this transaction: the finding's edition — from the signed
         bytes, or for a member published under BIO_Publication §3 rule 12 from the ratified case documents pinning
         them — with EDITION_EXISTS and EDITION_NOT_INCREMENTED (DEC-12: a revision appends; a retry of the same
         bytes is idempotent and reports `existed`), the per-case checks and discharge, the bar projection, every
         file's hash (append-only), and the edges: `serve` only to a published target; a reference to a target not
         yet published is held privately, never in the published graph (its id is not published), and becomes `serve`
         when that target is published, as a reference held for a published finding to THIS target does now (R16;
         publication R22, R35; Bob, K283). The signer is the verified signature's and the deliverer the control
         plane's stamp, each from its one source (R12). */
      return this.publication.commitEdition({
        bundleId, bundleSha, ...(Number.isInteger(edition) ? { edition } : {}), title, completeness,
        strength, memberCarriesBlocks, group, edges, shas, attestorKey, attestorMember: attestorMember ?? null,
        gateVersion, sigArmored, deliveredBy: deliveredBy ?? null, at: stampInstant("millisecond") });
    });
  }

  /* ---- R9: C-2.8's case-member arm, registered with promotion (a check before the write) and record-core (audit) ----
     A replay re-states the record's own past verbatim and is exempt, as every registered check is. The refusal
     names each finding with its check. */
  check(c) {
    if (!c || c.replay || (c.pkg && c.pkg.replay)) return null;
    const md = Array.isArray(c.files) ? c.files.find((f) => f && f.path === "bundle.md") : null;
    if (!md || typeof md.text !== "string") return null;
    let fm = null;
    try { fm = parseFrontmatter(md.text).data; } catch { fm = null; }
    const errs = caseMemberFindings(fm).filter((x) => x.severity === "error");
    if (!errs.length) return null;
    return { ok: false, reason: "CASE_MEMBER_REFUSED", ...rowOf("CASE_MEMBER_REFUSED"),
             detail: localize("ratification.index.this_documents_bytes_claim_to", "this document's bytes claim to be a published case member (a frozen published_strength block) and do not carry what a case member must carry. Nothing was written."),
             findings: errs.map((x) => ({ check: x.check, detail: x.message, ...(x.repairs ? { repairs: x.repairs } : {}) })) };
  }

  /** R9: the audit check (record-core R59) over one image: every case-member finding of its bundle.md. */
  audit(image) { return caseMemberImageFindings(image, parseFrontmatter); }

  /** R20–R27: the bulk release of a selection from collected to verified (`./release.mjs`). */
  release(a) {
    const self = this;   /* contradiction is reached only when a member is examined that far (R22) */
    return release({ sql: this.sql, promotion: this.promotion, retrieval: this.retrieval,
                     get contradiction() { return self.contradiction; } }, a);
  }

  /** R34: R22's examination of one document, as `capture`'s `batch-examination` reader (its R78) reads it. */
  examine(id) {
    const self = this;
    const x = examineMember({ sql: this.sql, get contradiction() { return self.contradiction; } }, id);
    return x ? { eligible: false, class: x.class, reason: x.reason } : { eligible: true };
  }

  /** R28–R31, R33: the bulk retirement of a selection from verified (`./retire.mjs`). */
  retire(a) {
    return retire({ sql: this.sql, promotion: this.promotion, retrieval: this.retrieval,
                    connections: this.connections }, a);
  }
}

/* R39: the materials publication's commit (its R57) or `heldMaterialsOf` answers held outside the record's inline text,
   as `{sha, held}`, from a list or `{materials}`: `evidence` (only in the evidence store) and `derived` (an obscured
   copy, case-carriage R1, R11; T37); anything else is none. */
const COPIED_HOLDS = new Set(["evidence", "derived"]);
const copiedMaterials = (x) => (Array.isArray(x) ? x : Array.isArray(x?.materials) ? x.materials : [])
  .filter((m) => m && COPIED_HOLDS.has(m.held) && typeof m.sha === "string").map((m) => ({ sha: m.sha, held: m.held }));

/* R52: a sitting's members as handed to the store half, each `publish`'s arguments; anything else is none. */
const sittingOf = (members) => (Array.isArray(members) ? members.filter((m) => m && typeof m === "object") : []);

/* A store read through this host's own door (`worker.stub`), read as the control plane's chokepoint reads it. */
const askDoor = (stub) => async (path, init) => {
  try {
    const res = await stub.fetch(path, init);
    const out = res && typeof res.json === "function" ? await res.json() : res;
    return out && typeof out === "object" && out.ok === true && "result" in out ? { answered: true, result: out.result }
      : out && typeof out === "object" && !("ok" in out) ? { answered: true, result: out } : { answered: false };
  } catch { return { answered: false }; }
};

const instances = new WeakMap();

/* record-core R70 (K783): the tables whose opaque ids the case mint site's `taken` reads, named by this module for the
   ledger's seed (publication registers its own two, `published_cases` and `published_case_members`). */
const MINT_SEED = Object.freeze([Object.freeze(["CASE", "cases", "case_id"]),
                                 Object.freeze(["CASE", "case_documents", "case_id"])]);

/** K61: the one instance per host, created on the first call with `deps`. It registers the case-document catalogue
 *  with promotion (its R47; R8 here), R22's examination as capture's `batch-examination` reader (its R78; R34 here),
 *  C-2.8's case-member arm as a promotion check and an audit check (R9), and its mint-ledger seed sources with record-core (its R70); a refused seed registration is a wiring fault and throws,
 *  rather than leave the ledger blind to the case ids. */
export function ratificationOf(host, deps) {
  let r = instances.get(host);
  if (!r) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    r = new Ratification({ ...d, host, storage, record, membership, promotion });
    instances.set(host, r);
    promotion.registerCaseCatalogue("ratification", checkCaseDocument);
    /* R34: R22's own examination, registered once as capture's `batch-examination` reader (its R78). */
    (d.capture || captureOf(host)).registerReader("batch-examination", "ratification", (id) => r.examine(id));
    promotion.registerStep("ratification", { check: (c) => r.check(c) });
    record.registerAuditCheck("ratification", (image) => r.audit(image));
    /* R43 (DEC-147; N823): this module creates `publish-schedule` and registers R42 once as the one publisher of a
       waiting edition (its R2). */
    r.publishSchedule.registerScheduledPublisher({ publishScheduled: (entry, now) => r.publishScheduled(entry, now) });
    const seeded = record.registerMintSeed("ratification", MINT_SEED.map((x) => [...x]));
    if (seeded && seeded.ok === false)
      throw new Error(`ratification: record-core refused its mint seed: ${seeded.reason}`);
  }
  return r;
}

/** R32: the module's store-half ops (K3), spread into the plane's op map (`plane/store.mjs`): `gatefacts` (R7), `ratifygate` (R4's
 *  gate, N417), `casegate` (R2's gate), `caseratify` (R3), `publishat` (R40), `casetestimony` (R35), `caseapproval` (R49)
 *  and `publish` (R5), the internal hops of the two ceremonies,
 *  `release` (R20–R27) and `retire` (R28–R31), whose own fields (`handle`, `acknowledgment`, `mitigation`, `reason`) are
 *  the body's when it states them, else the query's (R51). `viewer`, and release's and retire's `owner` and `author`, are
 *  the control plane's stamps, read from the query, never from the body. `casegate`'s grant digest `secretSha` is the one
 *  exception: read from the internal request's body only, where the control plane sets it after removing any a caller
 *  sent; a `secretSha` in the query is never read (N761; K2129, K2175). */
export function ratificationOps(r, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  /* R51 (T47; N988): an act's own field, the body's when the body states it as a string, else the query's; never a stamp. */
  const act = (k) => (typeof b[k] === "string" ? b[k] : q(k));
  return {
    gatefacts: () => r.gateFacts(q("id"), q("viewer") ?? null),
    /* R52 / R60 (fix round 10): a sitting's members are gated in one call, `{members: [gate body, ...]}`, each answered as its own
       body would be, in the sitting's order; a single body is answered as before. */
    ratifygate: async () => (Array.isArray(b.members)
      ? { members: await Promise.all(b.members.map((m) => r.ratifyGate(m))) }
      : r.ratifyGate(b)),
    casegate: () => r.caseGate({ caseId: b.caseId ?? q("case"), edition: Number(b.edition ?? q("edition")),
                                 docSha: b.docSha ?? q("docSha"), viewer: q("viewer") ?? null,
                                 secretSha: typeof b.secretSha === "string" && b.secretSha ? b.secretSha : null }),
    caseratify: () => r.ratifyCaseDocument(b),
    publishat: () => r.publishAt(b),
    casetestimony: () => r.caseTestimony(b),
    caseapproval: () => r.caseApproval(b),
    publish: () => r.publish(b),
    release: () => r.release({ handle: act("handle"), acknowledgment: act("acknowledgment"),
                               mitigation: act("mitigation"), viewer: q("viewer"), owner: q("owner"), author: q("author") }),
    retire: () => r.retire({ handle: act("handle"), reason: act("reason"), viewer: q("viewer"), owner: q("owner"),
                             author: q("author") }),
  };
}

/* R53 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  release: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.release.does",
    fields: { accepts: ["handle","acknowledgment","mitigation"], requires: ["handle","acknowledgment","mitigation"] } },
  retire: { classes: ["admin","member","probe"], mutating: true, weight: "terminal", description: "act.retire.does",
    fields: { accepts: ["handle","reason"], requires: ["handle","reason"] } },
  /* R54 (T51; K4206): the case ceremony's door op, its Worker half (`caseRatifyOp`) and its store half (`caseratify`). Its
     `publish` is case-authoring's (its own row, the state act); this module's `publish` arm is the store's internal committer. */
  caseratify: { classes: ["admin","member","probe"], mutating: true, weight: "attested", description: "act.caseratify.does",
    fields: { accepts: ["caseId","edition","expectedSha","sig","members"], requires: ["caseId","edition","expectedSha","sig"] } },
  /* R53 (K5196; BOB's B23): `publishat`, the case ceremony's "Publish at…" door op (R40), served here and sent by the screens. Its
     class, weight and description are op-declarations' and op-grades' rows (weight `irreversible`), its fields are the caseratify
     payload plus `at`, which `publishat` requires. */
  publishat: { classes: ["admin","member","probe"], machineClasses: [], mutating: true, weight: "irreversible", description: localize("ratification.declared.publishat", "case-directed: keyed by a case edition (case, edition), reached from the publication ceremony's last step; signs now and publishes at the set time only if every check passes again then"),
    fields: { accepts: ["caseId","edition","expectedSha","sig","members","at"], requires: ["caseId","edition","expectedSha","sig","at"] } },
});
