/* review — the review copy (requirements: `build/requirements/review.md`; BIO_Publication_v0_1.md §6A, DEC-31, DEC-72):
 * a draft of a case a project's editors prepare, shown inside the instance to members with standing and to named
 * recipients through a revocable, read-and-comment grant, marked as not a publication, as complete as a publication
 * would be, and naming what a publication would still refuse. It never publishes, signs, or leaves the instance (R20):
 * publishing stays ONE irreversible act, and a review copy stands BESIDE it.
 *
 * Extracted from the legacy modules (T8, layer 8; K3, K102): `store.mjs` (REC-126's review copy: `reviewAct` with
 * `#caseDraft`, `#reviewGrant` and `#reviewRevoke`, the draft identity and edition helpers, `#reviewGates`,
 * `#draftPublisher`, the grant and sight predicates, `#reviewLastChange`, `reviewCopy`, `reviewComment`; REC-198's
 * `caseDraftList`; the six dispatch entries), the check catalogue (C-87 and C-32.16, now `./checks.mjs`) and `schema.mjs`
 * (`case_drafts`, `review_grants`, `review_comments`, now `./schema.mjs`). The legacy code's comments moved with it,
 * shortened where they only restated the code.
 *
 * THE THREE OBJECTS (§6A):
 *   - THE DRAFT CASE (§6A.4, gap 3) is the production. It holds the arguments `op=publish` would take and is identified
 *     BEFORE any gate runs, because `publishCase` refuses an incomplete case and a review copy must not be refused for
 *     exactly the gaps it is sent to show. It is MUTABLE (Bob, 2026-09-17: "An editor must be able to edit").
 *   - THE GRANT (§6A.2) is a scoped, revocable, read-and-comment capability over ONE draft, bound to ONE case edition,
 *     attributed to its issuer and its recipient. Its read secret is generated at the control plane and this module is
 *     handed only the SHA-256 (R21): nothing here can print a secret because nothing here has ever held one.
 *   - THE COMMENT is attributed, and a recipient's is a RECIPIENT's.
 *
 * WHO MAY AUTHOR A DRAFT, ISSUE A GRANT AND REVOKE ONE (R2; §6A.2 as BOB #15 decided it, 2026-09-18, built by REC-133):
 *   - AUTHOR: the project's EDIT permission (membership's `isProjectEditor`). The draft is the production, and editing
 *     it is editing. Its capability half, `contribute`, is checked at the control plane, where capabilities live.
 *   - ISSUE: the project OWNER only, NO administrator arm. Sending unratified material outside the group is the same
 *     kind of act as publishing, and DEC-72 makes publishing the owner's.
 *   - REVOKE: the project OWNER only. Administrators "audit everything and direct nothing" (Membership v2 §4); a grant
 *     outliving its owners is handled by §7.13: an administrator adds an owner, and that owner revokes.
 * No two-person rule: none is ruled, and inventing one would be a fence tighter than its rule. A machine is refused by
 * name (R1): an addressed act is attributed to a person.
 *
 * REACHED as `reviewOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first call
 * with `deps`, returned to every later caller. At creation it creates its tables, declares them to record-core's purge
 * (R24, K23), and fills publication's review provider (publication R23), because `publication` and `case-authoring`
 * come earlier in the order and call the draft door, the grant door, the live grant and the dead answer back.
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership   layer 2: `transact`, `mintOpaqueId`, `seedMintLedger`, `declarePurge` (and record-core's
 *                        module-level `mintExhausted`, its R62; R27); `isProjectEditor`,
 *                        `isProjectOwner`, `projectOwners`, `existenceAct`, `viewerPredicate`.
 *   strength             `projectBar` (its R14; R11's `required_strength`).
 *   basisVersions        `testimonyReach` (its R39; R16).
 *   publication          `registerReviewProvider` (its R23).
 *   caseTensions         `attributionInForce` (its R6, was publication R39; R16), read directly and never through
 *                        `publication`, which no longer answers it (its R61; T35-60, N597, K1643).
 *   caseAuthoring        `publishCase` (its R18; R13), run dry.
 *   caseInputs           `statementAcknowledgements` (its R2; R15, R28; `case-authoring`'s R20 before T47, N908), the
 *                        one acknowledgement list, whose answer carries its `withheld_stated` sentence; on the one
 *                        instance for the host (`caseInputsOf`, its R16).
 *   caseAccount          `registerReviewComments` (its R7; was case-authoring R66, retired), filled at start with
 *                        R33's `reviewCommentsFor` (K2483; T42-23a, N839, K2608), on the one instance for the host.
 *   ratification         `registerApprovalReader` (its R50), filled at start with R30–R31's rule and approvals (R32).
 *   caseGrammar          `reviewCommentsOf` (its R25), the comments a signed document carries (R33's left-out read);
 *                        `approvalSubjectSha` (its R26; K2528), the digest an approval names (R31).
 *   now                  the clock for the instants it writes, an ISO string (default: the wall clock, to the ms).
 *
 * READ CONTRACTS it joins in its own SQL: record-core's `bundles` (`bundle_id`, `object_type`, `current_state`) and
 * `files` (`bundle_id`, `path`, `content`), its R37 (R12's findings, R19's project); publication's `cases`
 * (`case_id`, `project_id`), `published_cases` (`case_id`, `edition`, `scope`), `published_case_members` (`case_id`,
 * `edition`, `ord`, `bundle_id`, `role`; R39's starting point) and `case_documents` (`case_id`, `edition`,
 * `doc_sha`, `text`, `draft_id`, `sig_armored`), its R40 (R3, R5, R31, R33, R39).
 *
 * READ CONTRACT it states (R26): `case_drafts` (`draft_id`, `case_id`, `project_id`, `params`, `statement_by`,
 * `created_at`), on record-core R37's terms, which `case-inputs`' statement writer (its R3) reads under
 * `REVIEW_LIST_MAX`; every write to it stays here. */

import { recordOf, stampInstant, instantOrder, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, notAnAdmin } from "../membership/index.mjs";
import { strengthOf } from "../strength/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { publicationOf } from "../publication/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { caseAuthoringOf, AUTHORED_FIELDS, ACT_FIELDS, MEMBER_ROLES } from "../case-authoring/index.mjs";
import { caseInputsOf } from "../case-inputs/index.mjs";
import { caseAccountOf } from "../case-account/index.mjs";
import { ratificationOf, SUBJECT_POSITIONS } from "../ratification/index.mjs";
import { localFactsOf, TEAM_ZONE_PATH } from "../local-facts/index.mjs";
import { combine as combineProfiles } from "../../../jurisdictions/index.mjs";
import * as caseGrammar from "../case-grammar/index.mjs";
import { isMachineIdentity, parseFrontmatter, HEADINGS } from "../record-grammar/index.mjs";
import { REVIEW_COPY_CHECKS } from "./checks.mjs";
import { REVIEW_TABLES, migrateReview } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { REVIEW_COPY_CHECKS } from "./checks.mjs";
export { REVIEW_SCHEMA, REVIEW_TABLES } from "./schema.mjs";

/** R4, R37 (K4209): the fields of `op=publish` a draft keeps, derived and never hand-listed from `case-authoring`'s R65
 *  (its `AUTHORED_FIELDS` and `ACT_FIELDS`), less the four that are not a draft's arguments: `project` and `draft` name
 *  this module's own act, `viewer` and `author` are the control plane's stamps. Every other field of the act is dropped. */
export const REVIEW_DRAFT_FIELDS = Object.freeze([...new Set([...AUTHORED_FIELDS, ...ACT_FIELDS])]
  .filter((k) => !["project", "draft", "viewer", "author"].includes(k)));
/** R3: a draft's arguments as JSON, at most the size `op=publish` would accept. */
export const REVIEW_DRAFT_MAX = 64 * 1024;
/** R18: a comment's trimmed text. */
export const REVIEW_TEXT_MAX = 4000;
/** R6: a recipient's label. */
export const REVIEW_RECIPIENT_MAX = 200;
/** R30: the most approvers one rule names. */
export const APPROVERS_MAX = 50;
/** R31: an approval's reason, trimmed. */
export const APPROVAL_REASON_MAX = 4000;
/** R14, R19, R26: THE COPY'S LISTS ARE BOUNDED AND SAY SO. Comments, grants and drafts are read under this cap (one row
 *  over it to know), and an answer that hit it says so rather than presenting a page as the whole. `case-inputs`,
 *  earlier in the order, reads `case_drafts` under the same bound and keeps its own copy of it, `DRAFTS_READ_MAX`
 *  (its R3; K242). */
export const REVIEW_LIST_MAX = 500;
/** R19 (G12c): the most projects one `casedrafts` read names, and the most drafts one `reviewcopy` read names. A longer
 *  list is refused whole (`REVIEW_BATCH_TOO_LARGE`), never answered in part. */
export const REVIEW_BATCH_LISTS_MAX = 50;
export const REVIEW_BATCH_COPIES_MAX = 20;
/** R11: the marking every copy carries. Read by members and by recipients outside the group, so it names no machine
 *  and addresses no one as the group (DEC-149, T34-87). */
export const REVIEW_MARKING = word("review.review_marking");

const SECRET_SHA = /^[0-9a-f]{64}$/;
/* R34: record-core's stamp form, `stampInstant("second" | "millisecond")`: UTC, a `Z`, whole seconds or milliseconds. */
const STAMP_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
/* R34: a real calendar instant, not a date the stamp's shape only resembles (February 30 reads back as March). */
function validInstant(s) {
  const t = Date.parse(s);
  return !Number.isNaN(t) && stampInstant(s.includes(".") ? "millisecond" : "second", t) === s;
}

/* D-448: ONE CONSTRUCTOR FOR EVERY REFUSAL (REC-79's single-helper shape, as BIO_Assistant_and_AI_Roles_v0_1.md rule 10
   restates DEC-49), reading the canned translation off the row rather than repeating a sentence here. ADDITIVE ON THE
   WIRE: `reason`, each site's own `detail` and its per-site keys, then `code`, `check` and `translation`. */
function refusal(code, detail, extra) {
  const row = REVIEW_COPY_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}

/* R10, R19 (G12c): a batch longer than its bound is refused whole, naming the bound. */
function batchTooLarge(max) {
  /* DEC-49 REGION is-review-batch-too-large */
  return refusal("REVIEW_BATCH_TOO_LARGE",
           localize("review.index.a_batch_names_at_most", "a batch names at most {max} ids; ask for the rest in another call. Nothing was read.", { max: String(max) }), { max });
  /* END DEC-49 REGION is-review-batch-too-large */
}

/** R10: THE ONE DEAD ANSWER. A revoked grant, a grant whose draft has moved to another edition, a secret that never
 *  existed, a malformed secret, a draft that does not exist and a draft the caller has no standing in all receive THIS,
 *  built from no argument, so the bytes cannot vary with anything the caller sent or the record holds: a refusal that
 *  said REVOKED would tell the holder their access had existed. */
export function noReviewCopy() {
  /* DEC-49 REGION is-no-review-copy */
  return refusal("NO_REVIEW_COPY",
           localize("review.index.no_review_copy_answers_to", "no review copy answers to this request. A review copy is read through the grant that was issued for it, or by a member with standing in the project that produced it; a grant that was withdrawn, or whose draft has moved to another edition, answers exactly as one that was never issued."));
  /* END DEC-49 REGION is-no-review-copy */
}

/* R2: NOT PERMITTED, AND NOT THERE, ARE ONE ANSWER. The DETAIL varies with the ACT (which the caller chose) and with
   nothing the record holds. The code keeps REC-126's name for all three acts (REC-133's choice): exact for ISSUE,
   narrower than the rule for AUTHOR and REVOKE, and renaming it would change an answer callers branch on. */
const AUTHORITY = Object.freeze({
  draft: localize("review.index.authoring_a_draft_is_editing", "authoring a review copy's draft is EDITING the production, and needs the project's edit permission: an owner, or a JOINED participant, holding `contribute` (BIO_Publication §6A.2; Membership v2 §7.5)."),
  grant: localize("review.index.handing_the_teams_draft_to", "handing the team's draft to someone outside it is the producing project's own act and is wielded by an OWNER of it, as publishing is (DEC-72). An administrator sees every project and directs none of them."),
  revoke: localize("review.index.withdrawing_a_grant_is_the", "withdrawing a grant is the producing project's own act and is wielded by an OWNER of it, as issuing one is (BIO_Publication §6A.2). An administrator sees every project and directs none of them."),
});
function notReviewOwner(act) {
  /* DEC-49 REGION is-review-authority */
  return refusal("REVIEW_NOT_PROJECT_OWNER",
           localize("review.index.v1_a_project_draft_or", "{v1} A project, draft or grant you hold no such authority over is answered exactly as one that does not exist.", { v1: String(AUTHORITY[act]) }));
  /* END DEC-49 REGION is-review-authority */
}

/** R5 (D-568): THE EDITION A DRAFT'S ANSWERS STATE IS NULL WHERE ITS CASE IS DERIVED. The identity's edition 1 for a
 *  draft naming no case is the edition a MINTED case has, and it stays the INTERNAL key (grants and acknowledgements are
 *  written and matched at (case_id NULL, edition 1), so moving it would orphan every grant and reading already given).
 *  On the wire it would claim more than the record holds: a draft naming no case without `newCase` has its case DERIVED
 *  at publication, and which edition it becomes is undetermined until then. `newCase` is read for truthiness, as
 *  `publishCase` reads it. Pure. */
export function statedEdition(ident, newCase) {
  return ident.caseId || newCase ? ident.edition : null;
}

/** R5 (D-538): THE SENTENCE TAKES THE DRAFT'S `newCase`, BECAUSE A CASE ID OF null IS TWO DIFFERENT DRAFTS: one asking
 *  for a new case, and one whose case publication DERIVES from a record that can change before then. A draft naming a
 *  case AND asking for a new one is "the next edition" of nothing: publication refuses the pair together. The sentence
 *  is a member's and a recipient's to read, so it carries no code (the surfaces' DEC-49 guards refuse one on the page).
 *  Pure. */
export function caseIdentitySentence(caseId, edition, newCase) {
  if (caseId && newCase)
    return word("review.text.next_edition_draft", { edition: String(edition), case_id: String(caseId) });
  if (caseId) return word("review.text.next_edition", { edition: String(edition), case_id: String(caseId) });
  if (newCase) return word("review.text.new_case_whose");
  return localize("review.index.derived_case_identity", "a draft that does not name a case yet; which case it becomes is settled when it is published");
}

/* The statement as a case document PRINTS it: the frontmatter-safe normalisation the acknowledgements hash, so two
   spellings the record cannot tell apart are one statement (R4). */
const printed = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "'").trim();

/* R14, R19: the caller may ask for less, never for more; an absent or unreadable limit is the ceiling. */
function listCap(limit) {
  const asked = Number.parseInt(String(limit ?? ""), 10);
  return Number.isInteger(asked) && asked >= 1 ? Math.min(asked, REVIEW_LIST_MAX) : REVIEW_LIST_MAX;
}

/* R10, R19 (G12c): the ids a batch names, from a list or a comma-separated string, each once in the order given; blanks and
   anything that is not text are dropped. `null` when the key was not sent at all (the single read applies). */
function idList(v) {
  if (v === undefined || v === null) return null;
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(raw.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean))];
}

/** R17 (REC-200, BOB #32's ruling of 2026-09-23 on §6A.3 point 1): THE COPY CARRIES THE DATE OF ITS LAST CHANGE, the
 *  newest DATED ACT these bytes carry, and only those they carry: the draft's own last edit, a comment served, a grant
 *  served (or the recipient's own) with its issue and its revocation, and an acknowledgement served. It is computed over
 *  the rows SERVED, so an act beyond a list cap moves neither the hash nor this date.
 *  RANKED BY INSTANT, NEVER BY STRING (D-543): `…:00Z` sorts after `…:00.123Z` as a string though it is the earlier
 *  instant, and anything unparseable is not ranked at all. Equal instants keep the FIRST candidate in the order above.
 *  A WHOLE-SECOND STAMP NAMES ITS SECOND AND NOT WHERE IN IT THE ACT FELL (D-573, BOB #34, 2026-09-25): beside another
 *  act in that second the order between them is one the record cannot support, so the instant pick is kept as the one
 *  in-band date and each such act is named in `undetermined_within`, with `stated` saying why.
 *  THE AUTHOR DOES NOT MOVE WITH IT: the quartet's author stays the draft's `updated_by` (a recipient who comments has
 *  not authored the copy), and `by` here says who made the last change. What the copy draws live and dates nowhere
 *  (finding text, the gates' verdict, the floors) is named in `stated`. */
function lastChange({ draft, comments, grants, acknowledgements }) {
  const cand = [];
  const add = (at, by, byKind, kind) => {
    if (typeof at === "string" && at && !Number.isNaN(Date.parse(at)))
      cand.push({ at, by: by ?? null, by_kind: byKind, kind });
  };
  add(draft.updated_at, draft.updated_by, "member", "edit");
  for (const c of comments)
    add(c.at, c.author_kind === "recipient" ? c.recipient : c.author,
        c.author_kind === "recipient" ? "recipient" : "member", "comment");
  for (const g of grants) {
    add(g.issued_at, g.issued_by, "member", "grant");
    add(g.revoked_at, g.revoked_by, "member", "revocation");
  }
  for (const a of acknowledgements)
    add(a.at, a.kind === "recipient" ? a.recipient : a.by,
        a.kind === "recipient" ? "recipient" : "member", "statement acknowledgement");
  let last = null;
  for (const c of cand) if (!last || instantOrder(c.at, last.at) > 0) last = c;
  const who = (c) => `${c.kind === "edit" ? "an edit of the draft" : `a ${c.kind}`} by `
                   + `${c.by ?? "somebody this record does not name"}`;
  const act = !last ? word("review.text.undetermined_bytes_carry")
    : word("review.text.newest_dated_act", { last: String(who(last)) });
  const WHOLE = /T\d{2}:\d{2}:\d{2}Z$/;
  const second = (at) => Math.floor(Date.parse(at) / 1000);
  const tied = !last ? [] : cand.filter((c) => c !== last && second(c.at) === second(last.at)
                                             && (WHOLE.test(c.at) || WHOLE.test(last.at)));
  const tieStated = tied.map((c) => {
    const [a, b] = WHOLE.test(c.at) ? [c, last] : [last, c];
    const v1 = WHOLE.test(b.at)
      ? localize("review.index.both_were_recorded_to_the_second", "both were recorded to the second")
      : localize("review.index.who_was_recorded_to_the_second", "{who} was recorded to the second", { who: String(who(a)) });
    return localize("review.index.which_of_who_at_and", " Which of {who} ({at}) and {who_2} ({at_2}) came later is undetermined: {v1}, so the date this copy carries is the instant order's pick and not an order the record holds (BOB #34, 2026-09-25).", { who: String(who(a)), at: String(a.at), who_2: String(who(b)), at_2: String(b.at), v1 });
  }).join("");
  return {
    at: last ? last.at : null, by: last ? last.by : null,
    by_kind: last ? last.by_kind : null, kind: last ? last.kind : null,
    undetermined_within: tied.map((c) => ({ at: c.at, by: c.by, by_kind: c.by_kind, kind: c.kind })),
    stated: localize("review.index.act_tiestated_this_is_the", "{act}.{tieStated} THIS IS THE DATE THE COPY CARRIES IN-BAND (BIO_Publication_v0_1.md §6A.3 point 1, as BOB #32 ruled it on 2026-09-23): the copy's LAST CHANGE, so a comment, a grant, an acknowledgement or an edit moves both the hash and this date. IT DOES NOT SEE what this copy draws live and dates nowhere — each finding's text, the publish gates' verdict, and the project's declared floors — any of which can move the hash without moving this date.", { act: String(act), tieStated: String(tieStated) }),
  };
}

/* R12, R36: a draft's targets as the act took them: a list, or a comma-separated string, else the single `target`. */
function draftTargets(params) {
  return Array.isArray(params.targets) ? params.targets
       : typeof params.targets === "string" && params.targets.trim() ? params.targets.split(",")
       : params.target ? [params.target] : [];
}

/* R41 (L15, C46): a finding is answered in its own words, never as the file. The team's Session Log (`## Session Log`
   to the next `## ` heading, or the end) is the team's working record, with its record ids, hashes and members' reasons,
   and never reaches a reader of the copy, whichever door: it is cut from every text answered. Text without such a
   section is answered unchanged. */
function withoutLog(text) {
  const m = /^## Session Log[ \t]*\r?$/m.exec(text);
  if (!m) return text;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/\n## /);
  const before = text.slice(0, m.index).replace(/\s+$/, "");
  const after = next < 0 ? "" : rest.slice(next + 1);
  return before ? `${before}\n${after ? `\n${after}` : ""}` : after;
}

/* R41: an inquiry's section headings as record-grammar holds them (`## Conclusion`, `## What Would Falsify This`). */
const CONCLUSION_HEADING = HEADINGS.inquiry.find((h) => /Conclusion/.test(h));
const FALSIFIER_HEADING = HEADINGS.inquiry.find((h) => /Falsify/.test(h));

/* R41 (C46): the text under one heading line of a finding's body, to the next `## ` heading or the end, trimmed; null
   when the heading is absent or its section holds nothing. */
function sectionOf(text, heading) {
  const m = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*\\r?$`, "m").exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/\n## /);
  const got = (next < 0 ? rest : rest.slice(0, next)).trim();
  return got || null;
}

/* R41 (L15, C46; fix round 3): a finding file's words without its front matter (the lines between the opening and closing
   `---` fences), without the Session Log and without the file's headings. `statement` is the finding's own words: the
   front matter's `conclusion` (what `op=conclude` wrote there) or `statement` when it holds one as a plain string, first;
   else the text of the body's `## Conclusion` section; else, for words that are not laid out in sections at all (no `## `
   heading), the words themselves. A file laid out in sections whose Conclusion holds nothing has no statement (null:
   not concluded yet), never its headings. `falsifier` is what would change it, the front matter's, else the body's
   `## What Would Falsify This` section, else null. `text` is what follows the front matter. A file with no front matter
   answers its words unchanged (less any Session Log). `concluded` says whether a statement was found. */
function findingWords(content) {
  const raw = String(content ?? "");
  let parsed = null;
  try { parsed = parseFrontmatter(raw); } catch { parsed = null; }
  const laid = (t) => /^## /m.test(t);
  if (!parsed || parsed.data === null || typeof parsed.data !== "object") {
    const text = withoutLog(raw);
    const statement = sectionOf(text, CONCLUSION_HEADING) ?? (laid(text) || !text.trim() ? null : text);
    return { text, statement, falsifier: sectionOf(text, FALSIFIER_HEADING), concluded: statement !== null };
  }
  const body = withoutLog(String(parsed.body ?? "").replace(/^(?:\r?\n)+/, ""));
  const own = (k) => (typeof parsed.data[k] === "string" && parsed.data[k].trim() ? parsed.data[k].trim() : null);
  const statement = own("conclusion") ?? own("statement") ?? sectionOf(body, CONCLUSION_HEADING)
                    ?? (laid(body) || !body.trim() ? null : body);
  return { text: body, statement, falsifier: own("falsifier") ?? sectionOf(body, FALSIFIER_HEADING),
           concluded: statement !== null };
}

/* R13: the dry run's own throw, so a rollback is told apart from a failure. */
const ROLLBACK = Symbol("review-dry-run");

export class Review {
  #deps;
  #seeded = false;
  /* R35: where the governing time zone is read (local-facts R2; jurisdictions R41 as its fallback). */
  #localFacts; #combine;

  constructor({ storage, record, membership, host = null, strength = null, basisVersions = null, publication = null,
                caseTensions = null, caseAuthoring = null, caseInputs = null, caseAccount = null, ratification = null,
                caseGrammar: grammar = null, localFacts = undefined, combine = combineProfiles, now = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.#deps = { host, storage, strength, basisVersions, publication, caseTensions, caseAuthoring, caseInputs,
                   caseAccount, ratification, caseGrammar: grammar };
    this.#localFacts = localFacts;
    this.#combine = typeof combine === "function" ? combine : null;
    this.now = typeof now === "function" ? now : () => stampInstant("millisecond");
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get strength() { return this.#deps.strength ||= strengthOf(this.#deps.host); }
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host); }
  get publication() { return this.#deps.publication ||= publicationOf(this.#deps.host); }
  /* T35-60 (N597): case-tensions, one per host, forwarded the uses this module was given, as publication forwards its. */
  get caseTensions() {
    const { host, storage, basisVersions } = this.#deps;
    return this.#deps.caseTensions ||= caseTensionsOf(host, { storage, record: this.record, membership: this.membership,
                                                              ...(basisVersions ? { basisVersions } : {}) });
  }
  get caseAuthoring() { return this.#deps.caseAuthoring ||= caseAuthoringOf(this.#deps.host); }
  /* R15, R28 (T47; N908): case-inputs' one instance for the host (its R16), which holds the acknowledgement list. */
  get caseInputs() { return this.#deps.caseInputs ||= caseInputsOf(this.#deps.host); }
  /* R33 (T42-23a): case-account's one instance for the host (its R12), which holds the review-comments reader. */
  get caseAccount() { return this.#deps.caseAccount ||= caseAccountOf(this.#deps.host); }
  get ratification() { return this.#deps.ratification ||= ratificationOf(this.#deps.host); }
  /* case-grammar is pure: its module, unless a test passed its own. */
  get caseGrammar() { return this.#deps.caseGrammar || caseGrammar; }

  migrate() { migrateReview(this.sql); }

  /** R35: the time zone that governs on this instance, as `retrieval` R69 states it: local-facts' governing value (its
   *  R2) for the active profiles' `time_zone`, else the profiles' own (`jurisdictions` R41), else null (never UTC in its
   *  place); two profiles of different zones govern none. Never throws; writes nothing. */
  #zone() {
    const ok = (z) => (typeof z === "string" && z !== "" ? z : null);
    try {
      if (this.#localFacts === undefined) {
        this.#localFacts = null;
        if (this.#deps.host) this.#localFacts = localFactsOf(this.#deps.host);
      }
    } catch { this.#localFacts = null; }
    const lf = this.#localFacts;
    /* local-facts R21 (T51 D-B1): the team's own zone is a fact the team states with or without a profile installed, and
       its governing value already folds in the profiles' agreed zone; read it by its path first. */
    try {
      if (lf && typeof lf.factStatus === "function") {
        const team = lf.factStatus({ path: TEAM_ZONE_PATH });
        const z = team && team.ok !== false && team.governs ? ok(team.governs.value) : null;
        if (z) return z;
      }
    } catch { /* fall through to the profiles */ }
    let ids = null;
    try { ids = this.record.getSetting("jurisdiction_profiles"); } catch { ids = null; }
    if (!Array.isArray(ids) || !ids.length) return null;
    try {
      if (lf && typeof lf.factStatus === "function") {
        const zones = new Set();
        for (const id of ids) {
          const r = typeof id === "string" ? lf.factStatus({ path: `${id}/time_zone` }) : null;
          const z = r && r.ok !== false && r.governs ? ok(r.governs.value) : null;
          if (z) zones.add(z);
        }
        if (zones.size === 1) return [...zones][0];
        if (zones.size > 1) return null;
      }
    } catch { /* fall through to the profiles */ }
    try {
      const c = this.#combine ? this.#combine(ids) : null;
      return c && c.ok && c.view && c.view.time_zone ? ok(c.view.time_zone.value) : null;
    } catch { return null; }
  }

  /* R41 (C46, fix round 4): THE CONCLUSION THE PROJECT RECORDED for a question, in its own words. A project that concludes a
     question adopts a reading's claim and keeps it as its own conclusion record (basis-versions R22), and writes nothing
     into the question's bytes (`inquiry_moved: false`), so the file holds no `conclusion` for a reader to find. It is asked
     of ratification's `caseConclusionFor` (its R1), the one answer the publish gate and the case document use: the claim
     adopted and the falsifier, only while the project's latest act on the question is a conclusion (a withdrawn one, another
     project's and a conclusion written in the question's own bytes are not this project's: those answer the file's words).
     Null when there is none; never throws. */
  #recorded(id, state, project, viewer) {
    if (!project) return null;
    let c = null;
    try { c = this.ratification.caseConclusionFor(project, id, viewer, state); } catch { return null; }
    if (!c || c.state !== "concluded" || c.relationship !== "project") return null;
    const words = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const claim = c.claim && c.claim.state === "adopted" ? words(c.claim.text) : null;
    return claim ? { statement: claim, falsifier: words(c.falsifier) } : null;
  }

  /* R12: one id as the given reader may see it: present with its type, state, role and text, or absent with its role.
     `by` is the project the draft belongs to and the viewer its findings are read as (the draft's last editor), so a
     question that project concluded answers that conclusion's words (R41). */
  #finding(raw, roles, gate, by = null) {
    const id = String(raw ?? "").trim();
    /* D-539: THE ROLE IS THE DRAFT'S OWN AUTHORED FACT, said back whether or not the finding can be read, so an edit
       written from the answer does not lose it. It discloses nothing the target id beside it does not. */
    const role = roles && typeof roles === "object" ? roles[id] ?? null : null;
    const b = this.#one(`SELECT b.bundle_id, b.title, b.object_type, b.current_state FROM bundles b
                         WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
    if (!b) return { target: id, present: false, role,
                     detail: localize("review.index.this_draft_names_a_finding", "this draft names a finding its editor cannot read, or one that does not exist.") };
    const md = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
    /* R41 (L15): a reader reads the finding's own words, never the file's front matter. */
    let words = md ? findingWords(md.content) : null;
    /* R41 (fix round 4, C46): the project's own conclusion record comes first, as the case document records it. */
    const rec = b.object_type === "inquiry" && by ? this.#recorded(id, b.current_state, by.project, by.viewer) : null;
    if (rec) words = { text: words ? words.text : null, statement: rec.statement,
                       falsifier: rec.falsifier ?? (words ? words.falsifier : null), concluded: true };
    const concluded = !!(words && words.concluded);
    /* R41 (fix round 3): a finding with no words of its own is told as not concluded yet; the sentence is a stand-in
       for the design's row (`review.index.not_concluded_yet`). */
    return { target: id, present: true, title: typeof b.title === "string" && b.title.trim() ? b.title : null,
             object_type: b.object_type, state: b.current_state, role,
             text: words ? words.text : null, statement: words ? words.statement : null,
             falsifier: words ? words.falsifier : null, concluded,
             not_concluded: concluded ? null : localize("review.index.not_concluded_yet", "Not concluded yet") };
  }

  /** R40 (L14): THE SHORT TITLE a screen draws as a draft's heading, beside the identity sentence it keeps for body text:
   *  a named case reads "Case X, edition N"; a draft that names none reads `review.title.draft` with its scope or, failing
   *  that, its subject (the first finding it names that its editor can read: that finding's title), else
   *  `review.title.untitled`. Reads; never the identity sentence. */
  #title(ident, params, gate) {
    if (ident.caseId)
      return localize("review.index.case_edition_title", "Case {case_id}, edition {edition}", { case_id: String(ident.caseId), edition: String(ident.edition) });
    const scope = typeof params.scope === "string" ? params.scope.trim() : "";
    let subject = "";
    if (!scope) {
      for (const raw of draftTargets(params)) {
        const b = this.#one(`SELECT b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, String(raw ?? "").trim(), ...gate.args);
        if (b && typeof b.title === "string" && b.title.trim()) { subject = b.title.trim(); break; }
      }
    }
    return scope || subject ? word("review.title.draft", { title: scope || subject }) : word("review.title.untitled");
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #when() { const w = this.now(); return typeof w === "string" && w ? w : stampInstant("millisecond"); }
  #draftRow(id) { return this.#one(`SELECT * FROM case_drafts WHERE draft_id=?`, String(id ?? "").trim()); }

  /** D-432 (record-core R40): the opaque minter's ledger learns every draft and grant id standing in a live row, at
   *  start and again before this module's first mint, so an id a store minted before the ledger existed is never drawn
   *  twice, even after a purge deletes the row it stood in. At start, on a store whose ledger table is not yet created
   *  (its first boot, when no row can stand), it learns nothing and never throws: a throw at construction would take
   *  the instance down. */
  seedLedger() {
    if (this.#seeded) return;
    try {
      this.record.seedMintLedger([["DRAFT", "case_drafts", "draft_id"], ["DRAFT", "review_grants", "draft_id"],
                                  ["RVG", "review_grants", "grant_id"]]);
      this.#seeded = true;
    } catch { /* not yet: the ledger's table is created by record-core's migration, and the next call learns */ }
  }

  /* publication's `cases` and `published_cases` (R3, R5): a case's owning project, and its highest published edition. */
  #caseProject(caseId) {
    const r = this.#one(`SELECT project_id FROM cases WHERE case_id=?`, caseId);
    return r ? r.project_id : null;
  }
  #topEdition(caseId) {
    const r = this.#one(`SELECT MAX(edition) AS m FROM published_cases WHERE case_id=?`, caseId);
    return r && r.m != null ? Number(r.m) : 0;
  }

  /** R39 (C9, DEC-374): A NEW DRAFT THAT NAMES A PUBLISHED CASE BEGINS FROM THAT CASE'S HIGHEST PUBLISHED EDITION, and
   *  carries only what the next edition may: the findings it rests on and the roles they hold (publication's
   *  `published_case_members`, its R40) and its scope (`published_cases`). A field the act sent, even as `null`, is
   *  the member's own and is never filled. The four statements, the position, the bias acknowledgement and the account are
   *  authored afresh for every edition (DEC-12), so they are not carried. Reads; the case's own rows are never written. */
  #fromPublished(params, caseId, sent) {
    const top = this.#topEdition(caseId);
    if (top < 1) return;
    if (!sent.has("targets") && !sent.has("target")) {
      const members = this.#rows(`SELECT bundle_id, role FROM published_case_members WHERE case_id=? AND edition=?
                                  ORDER BY ord`, caseId, top);
      if (members.length) {
        params.targets = members.map((m) => m.bundle_id);
        const held = members.filter((m) => m.role);
        if (!sent.has("roles") && held.length) params.roles = Object.fromEntries(held.map((m) => [m.bundle_id, m.role]));
      }
    }
    const edition = this.#one(`SELECT scope FROM published_cases WHERE case_id=? AND edition=?`, caseId, top);
    if (!sent.has("scope") && edition && typeof edition.scope === "string" && edition.scope.trim()) params.scope = edition.scope;
  }

  /** R5: A DRAFT'S CASE IDENTITY IS READ FROM THE PUBLISHED RECORD EVERY TIME, never stored and never taken from the
   *  caller (`publishCase`'s own rule, DEC-12 as DEC-44 rehomes it): a named case stands at its highest published
   *  edition plus one; a draft naming none stands at edition 1, the internal key (see `statedEdition`). */
  draftIdentity(draft) {
    const named = String((draft && draft.case_id) ?? "").trim() || null;
    if (!named) return { caseId: null, edition: 1 };
    return { caseId: named, edition: this.#topEdition(named) + 1 };
  }

  /* R34: a grant's end date has come: `until` is the instant from which it is dead; none (NULL) never lapses. An `until`
     the record cannot read as an instant is never ranked, so it lapses nothing (the act refuses one at issue). */
  #lapsed(until, at) {
    return until != null && instantOrder(until, at) <= 0;
  }

  /** R8: THE LIVE-GRANT PREDICATE, the one place a grant is judged, read by the copy, its comment, the case document and
   *  the acknowledgements alike, so they cannot disagree. Live: a grant with this fingerprint exists, is NOT REVOKED,
   *  its draft exists, and the draft STILL STANDS AT THE CASE IDENTITY THE GRANT WAS BOUND TO (so a grant whose edition
   *  was published and signed is dead exactly as a revoked one). A malformed fingerprint is never live. R34 (T48): a
   *  grant is dead from its `until` on, as a revoked one; nothing is written when it lapses. Answers
   *  `{grant, draft}` or null. */
  liveGrant(secretSha) {
    const s = String(secretSha ?? "");
    if (!SECRET_SHA.test(s)) return null;
    const g = this.#one(`SELECT * FROM review_grants WHERE secret_sha=? AND revoked_at IS NULL`, s);
    if (!g || this.#lapsed(g.until, this.#when())) return null;
    const d = this.#draftRow(g.draft_id);
    if (!d) return null;
    const now = this.draftIdentity(d);
    if ((now.caseId ?? null) !== (g.case_id ?? null) || now.edition !== Number(g.edition)) return null;
    return { grant: g, draft: d };
  }

  /** R8: whether a live grant admits one case edition: it must be bound to exactly that named case and edition. */
  grantAdmitsCaseEdition(secretSha, caseId, edition) {
    if (!secretSha) return false;
    const live = this.liveGrant(secretSha);
    return !!(live && live.grant.case_id && live.grant.case_id === caseId
              && Number(live.grant.edition) === Number(edition));
  }

  /** R9: the draft, when the viewer has standing in its project's drafts; else null. */
  draftForMember(draftId, viewer) {
    const d = this.#draftRow(draftId);
    if (!d) return null;
    return this.seesProjectDrafts(d.project_id, viewer) ? d : null;
  }

  /** R9 (REC-198; BOB #32, 2026-09-23; §3 rule 15 (a)): THE DRAFT FENCE, AND THERE IS EXACTLY ONE OF IT. The single read
   *  and the list both CALL it. It is membership's sight predicate over the producing PROJECT bundle: a machine class
   *  compiles unfiltered, an identified member must be a participant (invited or joined) or an active administrator,
   *  and anything the predicate does not recognise is DENY. */
  seesProjectDrafts(projectId, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return false;
    if (gate.scope === "member") return true;
    return !!this.#one(`SELECT 1 AS seen FROM bundles b WHERE b.bundle_id=? AND b.object_type='project' AND ${gate.sql}`,
                       projectId, ...gate.args);
  }

  /** publication R23: the one review provider this module fills. */
  provider() {
    return {
      draftForMember: (draftId, viewer) => this.draftForMember(draftId, viewer),
      draftIdentity: (draft) => this.draftIdentity(draft),
      caseIdentitySentence, statedEdition,
      liveGrant: (secretSha) => this.liveGrant(secretSha),
      grantAdmitsCaseEdition: (secretSha, caseId, edition) => this.grantAdmitsCaseEdition(secretSha, caseId, edition),
      deadAnswer: noReviewCopy,
    };
  }

  /** R1: THE THREE AUTHORING ACTS ENTER THROUGH ONE DOOR, and the door is where the MACHINE FENCE (C-32.16) stands,
   *  before any act is chosen: the act is ADDRESSED and ATTRIBUTED (§6A.2), so the record must name the person. */
  act({ act = "", author = null, ...args } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-review — REC-126/C-32.16. The fence alone. */
    if (!who || isMachineIdentity(who))
      return refusal("MACHINE_CANNOT_REVIEW",
               localize("review.index.a_review_copy_is_an", "a review copy is an addressed act: somebody in this team hands a draft to a named person and the record says who. A machine credential may prepare the material and may not put the team's draft in front of anyone. Sign in as a member."));
    /* END DEC-49 REGION is-machine-review */
    if (act === "draft") return this.#draft(who, args);
    if (act === "grant") return this.#grant(who, args);
    if (act === "revoke") return this.#revoke(who, args);
    /* DEC-49 REGION is-review-unknown-act — every act but the three above falls through to here, named back. */
    return refusal("REVIEW_UNKNOWN_ACT",
             localize("review.index.the_review_copys_authoring_acts", "the review copy's authoring acts are draft, grant and revoke."), { act });
    /* END DEC-49 REGION is-review-unknown-act */
  }

  /* R3, R4: create a draft, or edit one in place. */
  #draft(who, { draft = null, project = null, viewer = null, ...rest } = {}) {
    const proj = String(project ?? "").trim();
    /* REC-149: a NEW draft under a DISCOVERABLE project its caller is outside is refused positionally (C-70.1); every
       other caller keeps the one answer below, which says nothing about whether the project exists. */
    if (!draft && proj) { const existence = this.membership.existenceAct(proj, viewer); if (existence) return existence; }
    const existing = draft ? this.#draftRow(draft) : null;
    if (draft && !existing) return notReviewOwner("draft");
    const owning = existing ? existing.project_id : proj;
    if (!owning)
      /* DEC-49 REGION is-review-no-project */
      return refusal("REVIEW_NO_PROJECT",
               "a draft case is a production of a project, as a published case is (DEC-72): pass "
             + "project=<project id>.");
      /* END DEC-49 REGION is-review-no-project */
    if (existing && proj && proj !== existing.project_id)
      /* DEC-49 REGION is-review-draft-changes-project */
      return refusal("REVIEW_DRAFT_CHANGES_PROJECT",
               localize("review.index.this_draft_is_project_id", "this draft is {project_id}'s production, and a case does not change hands (DEC-72). Draft this material as a new case under the other project instead.", { project_id: String(existing.project_id) }));
      /* END DEC-49 REGION is-review-draft-changes-project */
    if (!this.membership.isProjectEditor(owning, who)) return notReviewOwner("draft");
    /* R37 (C3): AN EDIT KEEPS EVERY FIELD IT DOES NOT SEND. The draft's arguments after an edit are the old ones with each
       sent field replaced; a sent `null` or an empty (blank) string clears that field, `caseId: null` the draft's case
       too. An empty list is a value, not a clearing: `excluded: []` is a claim (case-authoring R3), and silence is not. */
    const params = {};
    if (existing) {
      const held = JSON.parse(existing.params);
      for (const k of REVIEW_DRAFT_FIELDS) if (k in held) params[k] = held[k];
    }
    const sent = new Set();
    for (const k of REVIEW_DRAFT_FIELDS) {
      if (rest[k] === undefined) continue;
      sent.add(k);
      const v = rest[k];
      if (v === null || (typeof v === "string" && !v.trim())) delete params[k]; else params[k] = v;
    }
    const named = typeof params.caseId === "string" && params.caseId.trim() ? params.caseId.trim() : null;
    if (named) {
      if (this.#caseProject(named) !== owning)
        /* DEC-49 REGION is-review-no-such-case */
        return refusal("REVIEW_NO_SUCH_CASE",
                 localize("review.index.no_case_of_owning_s", "no case of {owning}'s answers to {named}. A draft names an EXISTING case to be its next edition, and a case this project did not publish is answered exactly as one that does not exist.", { owning: String(owning), named: String(named) }), { caseId: named });
        /* END DEC-49 REGION is-review-no-such-case */
      params.caseId = named;
      if (!existing) this.#fromPublished(params, named, sent);
    } else delete params.caseId;
    const json = JSON.stringify(params);
    if (json.length > REVIEW_DRAFT_MAX)
      /* DEC-49 REGION is-review-draft-too-large */
      return refusal("REVIEW_DRAFT_TOO_LARGE",
               "a draft's arguments are at most 64 KiB, the size of what op=publish would accept.");
      /* END DEC-49 REGION is-review-draft-too-large */
    const when = this.#when();
    /* R4 (REC-193, §3 rule 13): THE STATEMENT'S AUTHOR IS THE MEMBER WHO WROTE ITS CURRENT BYTES, stamped here from the
       session the act runs as; no caller-supplied field reaches it. An edit that leaves the statement text (as a case
       document would print it) alone leaves the stamp alone; a write supplying a statement to a draft whose author is
       unrecorded stamps it (that member did write the bytes that now stand); an emptied statement has no author. */
    const priorStatement = existing ? printed(JSON.parse(existing.params).statement ?? "") : "";
    const nextStatement = printed(params.statement ?? "");
    const statementBy = !nextStatement ? null
      : (existing && nextStatement === priorStatement && existing.statement_by) ? existing.statement_by
      : who;
    let id;
    if (existing) {
      id = existing.draft_id;
      this.sql.exec(`UPDATE case_drafts SET case_id=?, params=?, updated_by=?, updated_at=?, statement_by=?
                     WHERE draft_id=?`, named, json, who, when, statementBy, id);
    } else {
      /* REC-151: OPAQUE, never the DRAFT counter (Membership v2 §7): a draft is its project's editors' alone. */
      this.seedLedger();
      id = this.record.mintOpaqueId("DRAFT", when.slice(0, 4), "", (d) =>
        !!(this.#one(`SELECT 1 FROM case_drafts WHERE draft_id=?`, d)
          || this.#one(`SELECT 1 FROM review_grants WHERE draft_id=? LIMIT 1`, d)));
      /* R27 (N322, K275): no free opaque id is record-core's one answer (its R62, C-59.6), naming a draft id. */
      if (!id) return mintExhausted("DRAFT");
      this.sql.exec(`INSERT INTO case_drafts (draft_id,project_id,case_id,params,created_by,created_at,
                     updated_by,updated_at,statement_by) VALUES (?,?,?,?,?,?,?,?,?)`,
                    id, owning, named, json, who, when, who, when, statementBy);
    }
    const ident = this.draftIdentity({ case_id: named });
    return { ok: true, draftId: id, project: owning, edited: !!existing,
             caseId: ident.caseId, edition: statedEdition(ident, !!params.newCase),
             caseIdentity: caseIdentitySentence(ident.caseId, ident.edition, !!params.newCase),
             read: `op=reviewcopy&draft=${id}` };
  }

  /* R6: issue a grant bound to the draft's case identity at issue. */
  #grant(who, { draft = null, recipient = "", secretSha = null, until = null } = {}) {
    const d = this.#draftRow(draft);
    if (!d || !this.membership.isProjectOwner(d.project_id, who)) return notReviewOwner("grant");
    const to = String(recipient ?? "").trim();
    if (!to || to.length > REVIEW_RECIPIENT_MAX || /[\r\n]/.test(to))
      /* DEC-49 REGION is-review-recipient */
      return refusal("REVIEW_NO_RECIPIENT",
               localize("review.index.name_the_person_or_team", "name the person or team this copy is addressed to, in one line of at most {REVIEW_RECIPIENT_MAX} characters. An addressed act with no addressee is not attributed, and the grant is the record of who was handed what.", { REVIEW_RECIPIENT_MAX: String(REVIEW_RECIPIENT_MAX) }));
      /* END DEC-49 REGION is-review-recipient */
    /* DEC-49 REGION is-review-secret — the fingerprint's test and its refusal. */
    const s = String(secretSha ?? "");
    if (!SECRET_SHA.test(s))
      return refusal("REVIEW_NO_SECRET",
               localize("review.index.the_read_secrets_fingerprint_is", "the read secret's fingerprint is set by the control plane and was absent."));
    /* END DEC-49 REGION is-review-secret */
    const when = this.#when();
    /* R34 (T48; N1038; DEC-100): the reader's end date, after R6's refusals: an instant in record-core's stamp form
       (UTC, whole seconds or milliseconds, a real calendar instant) later than this act's own. Absent (null or not sent)
       is a grant live until revoked; an empty string is present, and is no instant. */
    const end = until === null || until === undefined ? null : until;
    /* DEC-49 REGION is-review-until */
    if (end !== null && !(typeof end === "string" && STAMP_INSTANT.test(end) && validInstant(end)
                          && instantOrder(end, when) > 0))
      return refusal("REVIEW_BAD_UNTIL",
               localize("review.index.a_readers_end_date_is", "a reader's end date is an instant in the record's form, after this act's own: YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DDTHH:MM:SS.sssZ. Nothing was written."));
    /* END DEC-49 REGION is-review-until */
    const ident = this.draftIdentity(d);
    /* REC-151: OPAQUE, never the RVG counter (Membership v2 §7): a grant is its project owner's alone. */
    this.seedLedger();
    const id = this.record.mintOpaqueId("RVG", when.slice(0, 4), "",
      (g) => !!this.#one(`SELECT 1 FROM review_grants WHERE grant_id=?`, g));
    /* R27 (N322, K275): record-core's one answer (its R62, C-59.6), naming a grant id. */
    if (!id) return mintExhausted("RVG");
    this.sql.exec(`INSERT INTO review_grants (grant_id,draft_id,case_id,edition,recipient,secret_sha,issued_by,issued_at,
                   until) VALUES (?,?,?,?,?,?,?,?,?)`, id, d.draft_id, ident.caseId, ident.edition, to, s, who, when, end);
    /* D-568: the ROW binds at the internal key; the ANSWER states the edition only where the record holds one. */
    const newCase = !!JSON.parse(d.params).newCase;
    return { ok: true, grantId: id, draftId: d.draft_id, caseId: ident.caseId,
             edition: statedEdition(ident, newCase),
             recipient: to, issuedBy: who, issuedAt: when, until: end,
             boundTo: localize("review.index.this_grant_reads_caseidentitysentence_and", "this grant reads {caseIdentitySentence} and nothing else. It ends when it is revoked, and when that edition is published and signed.{v1}", { caseIdentitySentence: String(caseIdentitySentence(ident.caseId, ident.edition, newCase)), v1: String(end ? localize("review.index.it_also_ends_at", " It also ends at {end}.", { end: String(end) }) : "") }) };
  }

  /* R7: withdraw a grant, once; a repeat answers the first revocation. */
  #revoke(who, { grant = null } = {}) {
    const gid = String(grant ?? "").trim();
    /* An ABSENT argument says nothing about what exists, so it is named as the payload complaint it is rather than
       answered as a grant nobody owns. */
    /* DEC-49 REGION is-review-grant-named — the absent argument's test and its refusal. */
    if (!gid)
      return refusal("REVIEW_NO_GRANT",
               "name the grant to withdraw: grant=<the grant id op=reviewgrant answered with>.");
    /* END DEC-49 REGION is-review-grant-named */
    const g = this.#one(`SELECT g.*, d.project_id FROM review_grants g JOIN case_drafts d ON d.draft_id=g.draft_id
                         WHERE g.grant_id=?`, gid);
    if (!g || !this.membership.isProjectOwner(g.project_id, who)) return notReviewOwner("revoke");
    if (g.revoked_at)
      return { ok: true, existed: true, grantId: g.grant_id, revokedBy: g.revoked_by, revokedAt: g.revoked_at };
    const when = this.#when();
    this.sql.exec(`UPDATE review_grants SET revoked_by=?, revoked_at=? WHERE grant_id=? AND revoked_at IS NULL`,
                  who, when, g.grant_id);
    return { ok: true, existed: false, grantId: g.grant_id, revokedBy: who, revokedAt: when };
  }

  /* R13: WHO THE GATES ARE RUN AS. Publishing is an owner's act (DEC-72) and `publishCase` runs its owner fence first,
     so a dry run as a non-owner editor would answer NOT_THE_PROJECT_OWNER for every such draft and hide the gaps the
     copy exists to show. So: the last editor when they own the project, otherwise its lowest-id owner (deterministic),
     and only for a project with NO owner the editor, whose NOT_THE_PROJECT_OWNER is then the true first gap. */
  #publisher(row) {
    if (this.membership.isProjectOwner(row.project_id, row.updated_by)) return row.updated_by;
    const [first] = [...this.membership.projectOwners(row.project_id)].sort();
    return first ?? row.updated_by;
  }

  /* R13: WHAT IS MISSING IS THE PUBLISH GATES' OWN ANSWER (§6A.4). The real act is run over the draft's arguments inside
     a transaction that is ALWAYS rolled back, so every write it would make (the case document, a minted case id) is
     undone and what survives is the gates' verdict in their own words: a second implementation of the gates here would
     be the second vocabulary §6A.4 forbids. `publishCase` stops at its first refusal and is not rebuilt to collect
     them, so what lies beyond the first is UNDETERMINED rather than absent, and `evaluated` says so. */
  #gates(row) {
    let out = null;
    try {
      this.record.transact(() => {
        const by = this.#publisher(row);
        out = this.caseAuthoring.publishCase({ ...JSON.parse(row.params), project: row.project_id,
                                               viewer: `member:${by}`, author: by });
        throw ROLLBACK;
      });
    } catch (e) {
      if (e !== ROLLBACK) throw e;
    }
    if (out && out.ok) return { gates: "passed", missing: [],
      evaluated: word("review.evaluated.publish_gate_run") };
    if (!out) return { gates: "undetermined", missing: [],
      evaluated: word("review.evaluated.publish_gates_gave") };
    const { ok: _ok, ...refused } = out;
    return { gates: "refused", missing: [refused],
      evaluated: word("review.evaluated.publish_gates_run") };
  }

  /* R10: the two doors. A recipient through a live grant (a named draft must be the grant's own), or a member with
     standing (R9). Answers `{draft, grant, reader}` or null for the dead answer. */
  #door({ draft, secretSha, viewer, bySecret }) {
    if (bySecret) {
      const live = this.liveGrant(secretSha);
      if (!live || (draft && String(draft).trim() !== live.draft.draft_id)) return null;
      return { draft: live.draft, grant: live.grant, reader: "recipient" };
    }
    const d = this.draftForMember(draft, viewer);
    return d ? { draft: d, grant: null, reader: "member" } : null;
  }

  /** R10–R17: the review copy (`op=reviewcopy`), or the dead answer. */
  copy({ draft = null, secretSha = null, viewer = null, bySecret = false, limit = null } = {}) {
    const door = this.#door({ draft, secretSha, viewer, bySecret });
    if (!door) return noReviewCopy();
    const { draft: d, grant, reader } = door;
    const params = JSON.parse(d.params);
    const ident = this.draftIdentity(d);
    const targets = draftTargets(params);
    /* R12: THE FINDINGS ARE READ AS THE DRAFT'S EDITOR SEES THEM, for both doors: the grant is the editor's act, so a
       recipient is shown exactly what the editor put in front of them and never a document the editor could not see. */
    const gate = viewerPredicate(`member:${d.updated_by}`);
    const findings = targets.map((raw) => this.#finding(raw, params.roles, gate, { project: d.project_id, viewer: `member:${d.updated_by}` }));
    const gates = this.#gates(d);
    const cap = listCap(limit);
    const commentRows = this.#rows(`SELECT c.comment_id, c.author_kind, c.author, c.grant_id, c.text, c.at,
                                        g.recipient FROM review_comments c
                                 LEFT JOIN review_grants g ON g.grant_id=c.grant_id
                                 WHERE c.draft_id=? ORDER BY c.comment_id LIMIT ?`, d.draft_id, cap + 1);
    const comments = commentRows.slice(0, cap)
      .map((c) => ({ comment_id: c.comment_id, author_kind: c.author_kind, author: c.author,
                     grant_id: c.grant_id ?? null, recipient: c.author_kind === "recipient" ? c.recipient : null,
                     text: c.text, at: c.at }));
    /* R14: THE RECIPIENT DOOR SEES ITS OWN GRANT; THE MEMBER DOOR SEES THE ROSTER, under the cap, LIVE judged once for
       the draft (every grant here is this draft's, so live is unrevoked, not lapsed (R34: each states its `until`) and bound to the identity it stands at now). A
       grant bound to no case was given at (NULL, 1) for a draft either new or derived, and the row does not record
       which: a live one states the draft's own stated edition, a dead one null (D-568). */
    const zone = this.#zone();
    let grantPart;
    if (grant) {
      grantPart = { grant: { grant_id: grant.grant_id, recipient: grant.recipient, issued_by: grant.issued_by,
                             issued_at: grant.issued_at, until: grant.until ?? null, zone } };
    } else {
      const lapseAt = this.#when();
      const grantRows = this.#rows(`SELECT grant_id, case_id, edition, recipient, secret_sha, issued_by, issued_at,
                                           revoked_by, revoked_at, until FROM review_grants WHERE draft_id=?
                                    ORDER BY issued_at, grant_id LIMIT ?`, d.draft_id, cap + 1);
      const grants = grantRows.slice(0, cap).map((g) => {
        const live = !g.revoked_at && !this.#lapsed(g.until, lapseAt)
                     && (g.case_id ?? null) === (ident.caseId ?? null) && Number(g.edition) === ident.edition;
        return { ...g, live, zone,
                 edition: g.case_id ? g.edition : live ? statedEdition(ident, !!params.newCase) : null };
      });
      grantPart = { grants, grants_truncated: grantRows.length > cap };
    }
    /* R15 (D-150, §3 rule 11; REC-194, REC-213): WHO HAS ACKNOWLEDGED THE STATEMENT AS IT STANDS NOW, case-inputs'
       one list (its R2; case-authoring's before T47), at this draft's identity (the draft is passed: for a draft
       naming no case the draft IS the identity the reading was given for). The WRITER is asked (`statement_by`, the
       member whose write made the statement's bytes, never `updated_by`): a reading by the sentence's own writer is
       not a second reading, so it is withheld and COUNTED, never hidden; `{by: null}` is undetermined and withholds
       every participant row, counted. */
    const writer = { by: d.statement_by ?? null };
    const acks = this.caseInputs.statementAcknowledgements(d.project_id, ident.caseId, ident.edition,
                                                           params.statement ?? "", null, writer, d.draft_id);
    const withheld = acks.byWriter + acks.withheldWriterUndetermined;
    const statementAcks = { statement_sha: acks.statementSha, acknowledgements: acks.rows,
                            truncated: acks.truncated,
                            withheld,
                            ...(acks.byWriter ? { acknowledgements_by_statement_writer_not_listed: acks.byWriter } : {}),
                            ...(acks.withheldWriterUndetermined
                              ? { acknowledgements_withheld_writer_undetermined: acks.withheldWriterUndetermined }
                              : {}),
                            withheld_stated: acks.withheld_stated,
                            /* R28 (DEC-88): the act's LINK names the act and the draft and nothing of the reader's,
                               so it never carries or pre-fills a member's words; beside it, in the `requires` form of
                               queue's act descriptors, that the act takes the acknowledger's own reason
                               (case-inputs R1, C-82.8; case-authoring R19 before T47). Both doors answer it alike. */
                            act: "op=statementack&draft=" + d.draft_id,
                            act_requires: ["reason"] };
    return {
      ok: true, kind: "review-copy", marking: REVIEW_MARKING, published: false,
      signature: { signed: false, detail: "a review copy is never signed. A signature is given only over a case "
                                        + "document at publication (op=caseratify)." },
      draft: d.draft_id, project: d.project_id, reader,
      /* R35 (N1229, K3765): the member door also answers the governing zone at the top level, with or without a grant,
         so a draft's first share reads it before the member chooses an end day. The recipient door's copy keeps it in
         its grant part alone. */
      ...(reader === "member" ? { zone } : {}),
      /* REC-199: `newCase` IS SAID BACK, beside the case it is the other half of one choice with, as the gates read it
         (a boolean), because a read that drops a field an edit writes back loses it. */
      case: { case_id: ident.caseId, edition: statedEdition(ident, !!params.newCase),
              identity: caseIdentitySentence(ident.caseId, ident.edition, !!params.newCase),
              newCase: !!params.newCase },
      title: this.#title(ident, params, gate),
      authored: { scope: params.scope ?? null, statement: params.statement ?? null,
                  excluded: params.excluded ?? null, subjectPosition: params.subjectPosition ?? null,
                  subjectJustification: params.subjectJustification ?? null,
                  biasAcknowledgement: params.biasAcknowledgement ?? null,
                  account: params.account ?? null, whatChanged: params.whatChanged ?? null },
      /* R38 (C2): the choices `op=publish` accepts, so a screen offers them without listing either: the positions
         `ratification` names (`case-authoring` imports the same list) and `case-authoring`'s member roles. */
      choices: { subject_positions: [...SUBJECT_POSITIONS], roles: [...MEMBER_ROLES] },
      findings, gates: gates.gates, missing: gates.missing, evaluated: gates.evaluated,
      comments, comments_truncated: commentRows.length > cap, list_limit: cap,
      statement_acknowledgements: statementAcks,
      observations: this.#observations(findings, this.#observedIdentity(d, ident)),
      updated_by: d.updated_by, updated_at: d.updated_at,
      last_change: lastChange({ draft: d, comments, acknowledgements: statementAcks.acknowledgements,
                                grants: grantPart.grants ?? (grantPart.grant ? [grantPart.grant] : []) }),
      /* R11 (REC-193, §3 rule 13): WHO WROTE THE STATEMENT THAT STANDS, beside the editor of everything else. */
      statement_by: d.statement_by ?? null,
      statement_by_stated: d.statement_by
        ? word("review.statement_by_stated.wrote_exclusion_statement", { statement_by: String(d.statement_by) })
        : localize("review.index.undetermined_statement_by", "UNDETERMINED: this draft predates the recording of the statement's author, and its last editor is not evidence of who wrote the statement"),
      ...grantPart,
      /* R11 (REC-148): the project's bar AS `op=publish` WOULD FREEZE IT, for the control plane's in-band floors. Read
         now, because a draft is not frozen. */
      required_strength: this.strength.projectBar(d.project_id),
    };
  }

  /** R10, R11 (G12c): THE REVIEW COPIES OF MANY DRAFTS IN ONE READ (`op=reviewcopy` with `drafts`): for each draft named, once,
   *  in the order given, exactly the answer the single read gives it, so a draft the reader may not see and one that does
   *  not exist answer the same dead answer, byte for byte. More than `REVIEW_BATCH_COPIES_MAX` ids is refused whole. Writes
   *  nothing. */
  copyMany({ drafts = null, ...args } = {}) {
    const ids = idList(drafts) ?? [];
    if (ids.length > REVIEW_BATCH_COPIES_MAX) return batchTooLarge(REVIEW_BATCH_COPIES_MAX);
    return { ok: true, kind: "review-copies", count: ids.length,
             copies: Object.fromEntries(ids.map((id) => [id, this.copy({ ...args, draft: id })])) };
  }

  /* R16 (K5130): THE IDENTITY THE OBSERVATIONS ARE READ AT. A draft naming a case stands at its next edition (R5). A draft
     naming none has no identity a level can be keyed to until it has prepared its case: once it has (`case-authoring` R83's
     `draftEditions`, which finds the preparation by the draft's own id), it stands at that prepared case and edition, and
     its authors' choices for it are read. R5's identity and R8's live-grant predicate are not changed: a grant stays bound
     to the draft's own identity, before the preparation and after it. Reads; never throws. */
  #observedIdentity(draft, ident) {
    if (ident.caseId) return ident;
    const got = this.#editions(ident, draft);
    return got.case && got.prepared != null ? { caseId: got.case, edition: got.prepared } : ident;
  }

  /* R16 (MK-7, MEMBER-KNOWLEDGE-DESIGN.md §4.2): EVERY OBSERVATION THE EDITION WOULD REACH from its present findings,
     with whether its author has chosen an attribution level for this case edition, never the level itself (that is the
     author's to state, in the case document). A draft naming no case, and with no prepared edition, has no identity a
     level can be keyed to. */
  #observations(findings, ident) {
    const seen = findings.filter((f) => f.present).map((f) => f.target);
    const r = this.basisVersions.testimonyReach(seen);
    return [...new Set([...r.self, ...r.via.map((v) => v.observation)])].map((obs) => {
      const chosen = ident.caseId ? this.caseTensions.attributionInForce(ident.caseId, ident.edition, obs) : null;
      return { observation: obs, chosen: !!chosen,
               stated: chosen ? word("review.stated.author_chosen_level", { case_id: String(ident.caseId), edition: String(ident.edition) })
                 : ident.caseId ? localize("review.index.its_author_has_chosen_no", "its author has chosen no level for {caseId} edition {edition}; the edition cannot be signed until they do (op=attribute)", { caseId: String(ident.caseId), edition: String(ident.edition) })
                 : "this draft names no case yet, so no level can be chosen; its author chooses one "
                   + "(op=attribute) once op=publish has prepared the case document" };
    });
  }

  /** R18 (C52): THE MEMBER A COMMENTING VIEWER NAMES, whichever way the control plane spells it: `member:<id>`, that
   *  spelling carrying a project (`member:<id>@<project>`, membership R149) and the founder's bare `admin`; the member's
   *  id, never the spelling. A machine credential, an unrecognised spelling and an absent viewer name none (null): a
   *  comment is a person's. */
  #commenter(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope !== "participant") return null;
    return gate.member ?? (String(gate.viewer ?? "").split("@")[0] || null);
  }

  /** R18: a comment through R10's doors (`op=reviewcomment`). A recipient's is attributed to the grant, a member's to
   *  the member. */
  comment({ draft = null, secretSha = null, viewer = null, bySecret = false, text = "" } = {}) {
    const v = String(viewer ?? "");
    const member = this.#commenter(v);
    const door = bySecret || member ? this.#door({ draft, secretSha, viewer: v, bySecret }) : null;
    if (!door) return noReviewCopy();
    const { draft: d, grant } = door;
    const kind = grant ? "recipient" : "member";
    const author = grant ? grant.grant_id : member;
    const body = String(text ?? "").trim();
    if (!body || body.length > REVIEW_TEXT_MAX)
      /* DEC-49 REGION is-review-comment-text */
      return refusal("REVIEW_NO_COMMENT_TEXT",
               localize("review.index.a_comment_says_something_at", "a comment says something: at least one character and at most {REVIEW_TEXT_MAX}.", { REVIEW_TEXT_MAX: String(REVIEW_TEXT_MAX) }));
      /* END DEC-49 REGION is-review-comment-text */
    const when = this.#when();
    const grantId = grant ? grant.grant_id : null;
    /* R33: the comment keeps the case identity its draft stands at now, as a grant does (R6). */
    const ident = this.draftIdentity(d);
    this.sql.exec(`INSERT INTO review_comments (draft_id,author_kind,author,grant_id,text,at,case_id,edition)
                   VALUES (?,?,?,?,?,?,?,?)`, d.draft_id, kind, author, grantId, body, when, ident.caseId, ident.edition);
    const row = this.#one(`SELECT last_insert_rowid() AS id`);
    return { ok: true, comment: { comment_id: row ? row.id : null, draft_id: d.draft_id, author_kind: kind,
                                  author, grant_id: grantId, text: body, at: when } };
  }

  /** R19 (REC-198, §6A.4): THE LIST OF A PROJECT'S DRAFTS (`op=casedrafts`), fenced exactly as the single read: a
   *  project that does not exist and a viewer without standing receive the dead answer, so the list is no oracle for
   *  which projects exist or hold drafts. Bounded as R14, `total` counted over the project's drafts. Writes nothing. */
  list({ project = null, viewer = null, limit = null } = {}) {
    const pid = String(project ?? "").trim();
    if (!pid || !this.#one(`SELECT 1 AS p FROM bundles WHERE bundle_id=? AND object_type='project'`, pid)
        || !this.seesProjectDrafts(pid, viewer)) return noReviewCopy();
    const cap = listCap(limit);
    const counted = this.#one(`SELECT COUNT(*) AS n FROM case_drafts WHERE project_id=?`, pid);
    const total = counted ? Number(counted.n) : 0;
    const rows = this.#rows(`SELECT draft_id, case_id, params, created_by, created_at, updated_by, updated_at,
                             statement_by FROM case_drafts WHERE project_id=? ORDER BY created_at, draft_id
                             LIMIT ?`, pid, cap);
    const drafts = rows.map((d) => {
      const ident = this.draftIdentity(d);
      const newCase = !!JSON.parse(d.params).newCase;
      return { draft_id: d.draft_id,
               case: { case_id: ident.caseId, edition: statedEdition(ident, newCase),
                       identity: caseIdentitySentence(ident.caseId, ident.edition, newCase) },
               created_by: d.created_by, created_at: d.created_at,
               updated_by: d.updated_by, updated_at: d.updated_at,
               /* REC-193: null where the draft predates the stamp — UNDETERMINED, not the editor. */
               statement_by: d.statement_by ?? null,
               /* R19 (C48, C50): what the draft has prepared and published, as case-authoring states it (its R83). */
               editions: this.#editions(ident, d),
               read: `op=reviewcopy&draft=${d.draft_id}` };
    });
    const { concluded, truncated: concludedTruncated } = this.#concluded(pid, viewer, cap);
    return { ok: true, kind: "review-drafts", project: pid, drafts, count: drafts.length,
             total, limit: cap, truncated: total > drafts.length, concluded, concluded_truncated: concludedTruncated };
  }

  /** R19 (G12c): THE DRAFT LISTS OF MANY PROJECTS IN ONE READ (`op=casedrafts` with `projects`): for each project named, once,
   *  in the order given, exactly the answer the single read gives it, the dead answer for a project the viewer has no
   *  standing in and for one that does not exist alike. More than `REVIEW_BATCH_LISTS_MAX` ids is refused whole. Writes
   *  nothing. */
  listMany({ projects = null, ...args } = {}) {
    const ids = idList(projects) ?? [];
    if (ids.length > REVIEW_BATCH_LISTS_MAX) return batchTooLarge(REVIEW_BATCH_LISTS_MAX);
    return { ok: true, kind: "review-drafts-batch", count: ids.length,
             lists: Object.fromEntries(ids.map((id) => [id, this.list({ ...args, project: id })])) };
  }

  /* R19 (fix round 3; case-authoring R83, K4363): what a draft has prepared and published, `{prepared, published}` for
     the case identity it stands at, from case-authoring's one read, `draftEditions`. Nulls where it cannot answer, never
     a throw: a list that cannot say states nothing prepared and nothing published. */
  #editions(ident, draft) {
    try {
      const got = this.caseAuthoring.draftEditions({ caseId: ident.caseId, draft });
      return { prepared: got && got.prepared != null ? got.prepared : null,
               published: got && got.published ? got.published : null, case: got && got.case ? got.case : null };
    } catch { return { prepared: null, published: null, case: null }; }
  }

  /** R43 (fix round 3, C14; project-roster R42): THE DRAFTS SHARED FOR REVIEW, BY PROJECT, in reads that do not grow with
   *  the projects asked. For each project asked: the number of its case drafts the viewer may see (R9) that hold a live
   *  grant (R8: not revoked, not lapsed, its draft still at the case identity the grant was bound to, so a grant whose
   *  edition has since been published is not counted), and the instant the newest such grant was issued (`null` when none).
   *  A project the viewer may not see, or that does not exist, is `{count: 0, newest: null}`. A draft with several live
   *  grants counts once. Writes nothing. */
  sharedDraftsByProject({ projectIds = [], viewer = null } = {}) {
    const ids = [...new Set((Array.isArray(projectIds) ? projectIds : []).filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()))];
    const out = Object.fromEntries(ids.map((p) => [p, { count: 0, newest: null }]));
    const gate = viewerPredicate(viewer);
    if (!ids.length || gate.scope === "DENY") return out;
    /* the plane binds about 100 variables a statement (D-36): 64 ids and the viewer gate's two arguments at most stay under it */
    const CHUNK = 64;
    const seen = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const q = part.map(() => "?").join(",");
      const rows = gate.scope === "member"
        ? this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='project' AND b.bundle_id IN (${q})`, ...part)
        : this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='project' AND b.bundle_id IN (${q}) AND ${gate.sql}`,
                     ...part, ...gate.args);
      for (const r of rows) seen.push(r.bundle_id);
    }
    const now = this.#when();
    for (let i = 0; i < seen.length; i += CHUNK) {
      const part = seen.slice(i, i + CHUNK);
      const q = part.map(() => "?").join(",");
      const grants = this.#rows(`SELECT g.draft_id, g.case_id AS bound_case, g.edition AS bound_edition, g.issued_at, g.until,
                                        d.project_id, d.case_id AS draft_case
                                 FROM review_grants g JOIN case_drafts d ON d.draft_id=g.draft_id
                                 WHERE g.revoked_at IS NULL AND d.project_id IN (${q})`, ...part);
      const cases = [...new Set(grants.map((g) => g.draft_case).filter(Boolean))];
      const top = new Map();
      for (let j = 0; j < cases.length; j += CHUNK) {
        const cq = cases.slice(j, j + CHUNK).map(() => "?").join(",");
        for (const r of this.#rows(`SELECT case_id, MAX(edition) AS m FROM published_cases WHERE case_id IN (${cq}) GROUP BY case_id`,
                                   ...cases.slice(j, j + CHUNK))) top.set(r.case_id, Number(r.m));
      }
      const drafts = new Map();
      for (const g of grants) {
        if (this.#lapsed(g.until, now)) continue;
        /* R8's identity: the draft's case now (highest published edition plus one; edition 1 for none) against the bound one */
        const named = String(g.draft_case ?? "").trim() || null;
        const edition = named ? (top.get(named) ?? 0) + 1 : 1;
        if ((named ?? null) !== (g.bound_case ?? null) || edition !== Number(g.bound_edition)) continue;
        const key = g.draft_id;
        const held = drafts.get(key);
        if (!held || instantOrder(g.issued_at, held.issued_at) > 0) drafts.set(key, { issued_at: g.issued_at, project: g.project_id });
      }
      for (const { issued_at: at, project } of drafts.values()) {
        const row = out[project];
        row.count++;
        if (row.newest === null || instantOrder(at, row.newest) > 0) row.newest = at;
      }
    }
    return out;
  }

  /* R36: the questions the project has concluded (ratification R1's `caseConclusionFor` answers `concluded` for the
     project and the question), each with its findings as R12 reads them for the viewer, oldest conclusion first, at most
     `cap`. The candidates are the questions the project's own document carries `conclusions` rows for. */
  #concluded(pid, viewer, cap) {
    const doc = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, pid);
    let fm = {};
    try { fm = doc ? parseFrontmatter(String(doc.content ?? "")).data || {} : {}; } catch { fm = {}; }
    const rows = Array.isArray(fm.conclusions) ? fm.conclusions : [];
    const ids = [...new Set(rows.map((r) => (r && typeof r === "object" ? String(r.inquiry ?? "").trim() : "")).filter(Boolean))];
    const gate = viewerPredicate(viewer);
    const found = [];
    for (const inq of ids) {
      const b = this.#one(`SELECT b.bundle_id, b.title, b.current_state FROM bundles b
                           WHERE b.bundle_id=? AND b.object_type='inquiry' AND (${gate.sql})`, inq, ...gate.args);
      if (!b) continue;
      const c = this.ratification.caseConclusionFor(pid, inq, viewer, b.current_state);
      if (!c || c.state !== "concluded" || c.relationship !== "project") continue;
      found.push({ inquiry: inq, title: b.title ?? null, concluded_at: c.at ?? null, concluded_by: c.by ?? null,
                   findings: [this.#finding(inq, null, gate, { project: pid, viewer })] });
    }
    /* by instant, never by string; an unparseable stamp is not ranked and goes last, keeping its order */
    found.sort((x, y) => {
      const ux = Number.isNaN(Date.parse(x.concluded_at ?? "")), uy = Number.isNaN(Date.parse(y.concluded_at ?? ""));
      return ux || uy ? Number(ux) - Number(uy) : instantOrder(x.concluded_at, y.concluded_at);
    });
    return { concluded: found.slice(0, cap), truncated: found.length > cap };
  }

  /* ---- T41: approvals before signing (D60; R30–R32) and the review comments a case carries (D61; R33) ---- */

  /** R30, R32: the rule in force, the latest set appended, or null when none was ever set or the latest turned it off. */
  approvalRule() {
    const r = this.#one(`SELECT approvers, set_by, set_at FROM approval_rules ORDER BY seq DESC LIMIT 1`);
    if (!r || r.approvers == null) return null;
    return { approvers: JSON.parse(r.approvers), set_by: r.set_by, set_at: r.set_at };
  }

  /** R30 (D60): an active administrator names the members whose approval every case of the group needs before it is
   *  signed, or turns the rule off with `null` (the default, so a group of one is never blocked). Every set is
   *  appended with who and when; nothing is replaced. */
  approvalRuleSet({ approvers, by = null } = {}) {
    const who = String(by ?? "").trim();
    if (!who || isMachineIdentity(who) || !this.membership.isAdministrator(who))
      return notAnAdmin(who || null, localize("review.index.set_the_teams_approval_rule", "set the team's approval rule"));
    let list = null;
    if (approvers !== null) {
      const ids = Array.isArray(approvers) ? approvers.map((a) => (typeof a === "string" ? a.trim() : "")) : [];
      list = [...new Set(ids)];
      const active = (id) => { const f = id ? this.membership.memberFacts(id) : null; return !!f && f.status === "active"; };
      /* DEC-49 REGION is-approval-rule-approvers */
      if (!ids.length || list.length > APPROVERS_MAX || !list.every(active))
        return refusal("APPROVAL_RULE_BAD_APPROVERS",
                 localize("review.index.an_approval_rule_names_one", "an approval rule names one or more active members of the team by member id, at most {APPROVERS_MAX}; approvers: null turns the rule off. Nothing was changed.", { APPROVERS_MAX: String(APPROVERS_MAX) }));
      /* END DEC-49 REGION is-approval-rule-approvers */
    }
    const when = this.#when();
    this.sql.exec(`INSERT INTO approval_rules (approvers, set_by, set_at) VALUES (?,?,?)`,
                  list ? JSON.stringify(list) : null, who, when);
    return { ok: true, approvers: list, set_by: who, set_at: when,
             stated: list ? word("review.stated.case_group_needs", { list: String(list.join(", ")) })
                          : word("review.stated.group_requires_approvals") };
  }

  /** R31 (D60): a named approver who may see the case's project approves one case edition's document at its
   *  approval digest (K2528); a later document needs a new approval. Not an approver, no rule, a case not seen and a case that does
   *  not exist are one answer. */
  caseApprove({ case: caseId = null, edition = null, docSha = null, reason = null, by = null } = {}) {
    const who = String(by ?? "").trim();
    const cid = String(caseId ?? "").trim();
    const rule = this.approvalRule();
    const project = cid ? this.#caseProject(cid) : null;
    /* DEC-49 REGION is-not-an-approver */
    if (!who || isMachineIdentity(who) || !rule || !rule.approvers.includes(who) || !project
        || !this.membership.inSight(project, `member:${who}`))
      return refusal("CASE_NOT_AN_APPROVER",
               localize("review.index.an_approval_is_given_by", "an approval is given by a member the team's approval rule names, of a case whose project they can see; a case you cannot see is answered exactly as one that does not exist. Nothing was recorded."));
    /* END DEC-49 REGION is-not-an-approver */
    const ed = Number(edition);
    const sha = String(docSha ?? "");
    /* K2528: `docSha` is the APPROVAL DIGEST, case-grammar R26's `approvalSubjectSha` of the case edition's document
       (its sha without the `approval_rule`/`approvals:` block), so the approval still names the document once that
       block is written into it at signing. */
    const doc = Number.isInteger(ed) && ed >= 1 && SECRET_SHA.test(sha)
      ? this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, cid, ed) : null;
    /* DEC-49 REGION is-approval-document */
    if (!doc || this.caseGrammar.approvalSubjectSha(doc.text) !== sha)
      return refusal("APPROVAL_NO_SUCH_DOCUMENT",
               localize("review.index.no_document_of_cid_edition", "no document of {cid} edition {v1} has that approval digest (its sha without the approvals block); an approval names the document it approves. Nothing was recorded.", { cid: String(cid), v1: String(Number.isInteger(ed) ? ed : "(none)") }), { caseId: cid });
    /* END DEC-49 REGION is-approval-document */
    const why = reason == null ? null : String(reason).trim() || null;
    /* DEC-49 REGION is-approval-reason */
    if (why && why.length > APPROVAL_REASON_MAX)
      return refusal("APPROVAL_REASON_TOO_LONG",
               localize("review.index.an_approvals_reason_is_at", "an approval's reason is at most {APPROVAL_REASON_MAX} characters. Nothing was recorded.", { APPROVAL_REASON_MAX: String(APPROVAL_REASON_MAX) }));
    /* END DEC-49 REGION is-approval-reason */
    const held = this.#one(`SELECT approved_by, reason, at FROM case_approvals
                            WHERE case_id=? AND edition=? AND doc_sha=? AND approved_by=?`, cid, ed, sha, who);
    if (held) return { ok: true, existed: true, case: cid, edition: ed, docSha: sha, by: held.approved_by,
                       reason: held.reason ?? null, at: held.at };
    const when = this.#when();
    this.sql.exec(`INSERT INTO case_approvals (case_id, edition, doc_sha, approved_by, reason, at) VALUES (?,?,?,?,?,?)`,
                  cid, ed, sha, who, why, when);
    return { ok: true, existed: false, case: cid, edition: ed, docSha: sha, by: who, reason: why, at: when };
  }

  /** R31, R32: the approvals of exactly one document, in the order given. */
  approvalsOf({ case: caseId = null, edition = null, docSha = null } = {}) {
    return this.#rows(`SELECT approved_by, reason, at FROM case_approvals WHERE case_id=? AND edition=? AND doc_sha=?
                       ORDER BY seq`, String(caseId ?? "").trim(), Number(edition), String(docSha ?? ""))
      .map((a) => ({ by: a.approved_by, at: a.at, reason: a.reason ?? null }));
  }

  /** R32: the reader `ratification` R50 takes, filled once at start. */
  approvalReader() {
    return { rule: () => this.approvalRule(), approvals: (args) => this.approvalsOf(args) };
  }

  /* R33: one comment row as a reader of the case sees it: a member by member id, a recipient by the grant's label. */
  #reviewerRow(c) {
    const recipient = c.author_kind === "recipient";
    return { comment_id: c.comment_id, draft_id: c.draft_id, reviewer: recipient ? c.recipient : c.author,
             reviewer_kind: recipient ? "recipient" : "member", text: c.text, at: c.at };
  }

  /** R33 (D61): THE COMMENTS ON A CASE EDITION'S REVIEW COPIES, for the publisher's choice (`case-account` R7 reads
   *  it through `registerReviewComments`, filled at start): every comment made while its draft stood at (case,
   *  edition), on a draft of that case's project, and, when `draft` is named (the draft `publishCase` binds), that
   *  draft's comments made while it named no case, which is how a new or derived case's copies are reached. Fenced as
   *  R9: a viewer without standing receives the dead answer. Bounded as R14. Writes nothing. */
  reviewCommentsFor({ case: caseId = null, edition = null, viewer = null, draft = null, limit = null } = {}) {
    const cid = String(caseId ?? "").trim() || null;
    const ed = Number(edition);
    const project = cid ? this.#caseProject(cid) : null;
    const d = draft ? this.#draftRow(draft) : null;
    if (draft && !d) return noReviewCopy();
    if (!project && !d) return noReviewCopy();
    for (const p of new Set([project, d && d.project_id].filter(Boolean)))
      if (!this.seesProjectDrafts(p, viewer)) return noReviewCopy();
    const arms = [], args = [];
    if (project && Number.isInteger(ed) && ed >= 1) {
      arms.push(`(c.case_id=? AND c.edition=? AND d.project_id=?)`);
      args.push(cid, ed, project);
    }
    /* The named draft's comments made while it named no case: a draft standing at a named case is reached by the
       first arm (case-authoring R9 refuses one standing at another), so this arm adds exactly what no case id reaches,
       and R33's left-out read finds the same set again from the document's `draft_id`. */
    if (d) {
      arms.push(`(c.draft_id=? AND c.case_id IS NULL AND c.edition=1)`);
      args.push(d.draft_id);
    }
    const cap = listCap(limit);
    const rows = !arms.length ? [] : this.#rows(`SELECT c.comment_id, c.draft_id, c.author_kind, c.author, c.text, c.at,
                                                       g.recipient FROM review_comments c
                                                JOIN case_drafts d ON d.draft_id=c.draft_id
                                                LEFT JOIN review_grants g ON g.grant_id=c.grant_id
                                                WHERE ${arms.join(" OR ")} ORDER BY c.comment_id LIMIT ?`,
                                               ...args, cap + 1);
    const comments = rows.slice(0, cap).map((c) => this.#reviewerRow(c));
    return { ok: true, kind: "review-comments", case: cid, edition: Number.isInteger(ed) ? ed : null,
             draft: d ? d.draft_id : null, comments, count: comments.length, truncated: rows.length > cap,
             limit: cap };
  }

  /* R33: the comments a signed document carries in its `review_comments:` block (`case-grammar` R25), or null when
     the block cannot be read (no reader, no block, a format before it, or a throw), so a reviewer is never told a
     comment was left out on a guess. */
  #includedIn(text) {
    const read = this.caseGrammar.reviewCommentsOf;
    if (typeof read !== "function") return null;
    try {
      /* its R25 reads the document's parsed front matter (record-grammar's `parseFrontmatter`) */
      const got = read(parseFrontmatter(String(text ?? "")).data);
      const list = Array.isArray(got) ? got : got && (got.comments ?? got.included ?? got.review_comments);
      return Array.isArray(list) ? list : null;
    } catch { return null; }
  }

  /** R33 (D61): AFTER PUBLICATION, EACH MEMBER REVIEWER WHOSE COMMENTS WERE LEFT OUT IS TOLD ONCE (`notice-producers`
   *  R17 reads this): for every published edition whose document is signed, the viewer's own member comments among
   *  that edition's review copies (as R33's list reads them: made at that case edition, or on the draft the document
   *  names while it named no case) that the document's `review_comments:` block does not carry, one item per case
   *  edition, keyed so it is raised once. A recipient is not a member and is told nothing here. An edition whose block
   *  cannot be read is counted `undetermined`, never told. Writes nothing. */
  reviewCommentsLeftOut({ viewer = null, limit = null } = {}) {
    const v = String(viewer ?? "");
    const member = v.startsWith("member:") ? v.slice("member:".length).trim() : "";
    const cap = listCap(limit);
    const out = { ok: true, kind: "review-comments-left-out", member: member || null, items: [], undetermined: 0,
                  truncated: false, limit: cap };
    if (!member || isMachineIdentity(member)) return out;
    const editions = this.#rows(`SELECT DISTINCT pc.case_id, pc.edition, cs.project_id, cd.text, cd.draft_id
      FROM review_comments c JOIN case_drafts d ON d.draft_id=c.draft_id
      JOIN case_documents cd ON cd.sig_armored IS NOT NULL
        AND ((c.case_id IS NOT NULL AND cd.case_id=c.case_id AND cd.edition=c.edition)
          OR (c.case_id IS NULL AND c.edition=1 AND cd.draft_id=c.draft_id))
      JOIN published_cases pc ON pc.case_id=cd.case_id AND pc.edition=cd.edition
      JOIN cases cs ON cs.case_id=cd.case_id
      WHERE c.author_kind='member' AND c.author=? ORDER BY pc.case_id, pc.edition`, member);
    for (const e of editions) {
      const mine = this.#rows(`SELECT c.comment_id, c.draft_id, c.author_kind, c.author, c.text, c.at, NULL AS recipient
        FROM review_comments c JOIN case_drafts d ON d.draft_id=c.draft_id
        WHERE c.author_kind='member' AND c.author=?
          AND ((c.case_id=? AND c.edition=? AND d.project_id=?) OR (c.draft_id=? AND c.case_id IS NULL AND c.edition=1))
        ORDER BY c.comment_id`, member, e.case_id, e.edition, e.project_id, e.draft_id ?? null)
        .map((c) => this.#reviewerRow(c));
      if (!mine.length) continue;
      const included = this.#includedIn(e.text);
      if (!included) { out.undetermined++; continue; }
      const carried = new Set(included.map((i) => JSON.stringify([i && i.reviewer, i && i.text, i && i.at])));
      const left = mine.filter((c) => !carried.has(JSON.stringify([c.reviewer, c.text, c.at])));
      if (!left.length) continue;
      if (out.items.length === cap) { out.truncated = true; break; }
      out.items.push({ key: `FINDING::review-comment-left-out::${e.case_id}::${e.edition}::${member}`,
                       case: e.case_id, edition: Number(e.edition), project: e.project_id,
                       left_out: left.length, comments: left.map((c) => c.comment_id) });
    }
    return out;
  }
}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It creates its tables, declares them to
 *  purge (R24), and fills publication's review provider (publication R23), replacing legacy-store's fill (K206),
 *  ratification's approval reader (R32) and case-account's review comments (R33). */
export function reviewOf(host, deps) {
  let r = instances.get(host);
  if (!r) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    r = new Review({ ...d, host, storage, record, membership });
    instances.set(host, r);
    r.migrate();
    record.declarePurge("review", REVIEW_TABLES);
    r.seedLedger();
    r.publication.registerReviewProvider("review", r.provider());
    /* R32 (D60): the approval rule and approvals, read by ratification's gates (its R49, R50). */
    r.ratification.registerApprovalReader(r.approvalReader());
    /* R33 (D61; K2483; T42-23a): the comments on a case's review copies, read for publishCase by case-account (its
       R7), registered there once and never through case-authoring's pass-through, which would register it twice. */
    r.caseAccount.registerReviewComments((args) => r.reviewCommentsFor(args));
  }
  return r;
}

/** Which purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function reviewOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return REVIEW_TABLES.some((x) => x.name === name);
}

/** The module's ops (K3), as entries of the plane store's op map (`plane/store.mjs`). Every identity is the control
 *  plane's stamp (R22): `author`, `viewer` and `bySecret` are read from the query and spread after the body, so a body
 *  naming one is overwritten, never honoured; `secretSha` (a grant's fingerprint) is read from the body only, where the
 *  control plane sets it after removing any a caller sent, and a `secretSha` in the query is never read (R29; N761). */
export function reviewOps(r, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  /* R29: the fingerprint's one channel, so no digest travels in an internal address. */
  const sha = b.secretSha ?? null;
  return {
    /* REC-149: `viewer` is stamped, and asked only for existence. */
    casedraft: () => r.act({ ...b, act: "draft", author: q("author"), viewer: q("viewer") }),
    reviewgrant: () => r.act({ act: "grant", draft: b.draft ?? q("draft"), recipient: b.recipient ?? q("recipient"),
                               until: b.until ?? q("until"), author: q("author"), secretSha: sha }),
    reviewrevoke: () => r.act({ act: "revoke", grant: b.grant ?? q("grant"), author: q("author") }),
    /* R10, R11 (G12c): `drafts`, a list in the body or comma-separated in the query, answers one copy per draft. */
    reviewcopy: () => {
      const drafts = b.drafts ?? q("drafts");
      const read = { secretSha: sha, viewer: q("viewer"), bySecret: q("bySecret") === "1", limit: q("limit") };
      return drafts === null || drafts === undefined ? r.copy({ ...read, draft: q("draft") }) : r.copyMany({ ...read, drafts });
    },
    reviewcomment: () => r.comment({ draft: q("draft"), secretSha: sha, viewer: q("viewer"),
                                     bySecret: q("bySecret") === "1", text: b.text }),
    /* REC-198: the store fails closed on an absent `viewer`. */
    /* R19 (G12c): `projects`, a list in the body or comma-separated in the query, answers one list per project. */
    casedrafts: () => {
      const projects = b.projects ?? q("projects");
      const read = { viewer: q("viewer"), limit: q("limit") };
      return projects === null || projects === undefined ? r.list({ ...read, project: q("project") }) : r.listMany({ ...read, projects });
    },
  };
}

/** R42 (T51; K4168, K4202; op-declarations R80, op-grades R49): THE OPS A SCREEN SENDS, declared by their owner beside the ops
 *  map. Each row's `classes`, `mutating`, `weight` and `description` are copied from the op's existing rows in
 *  `op-declarations` and `op-grades`, never chosen (the registrations refuse a row that differs). `fields.accepts` is every
 *  field the arm reads from the query and the body, less the control plane's stamps (`author`, `viewer`, `bySecret` and the
 *  grant's `secretSha`, R22, R29); `fields.requires` the ones it refuses without, as the refusal names them. `reviewcomment`
 *  is addressed by `draft` in the query and answers a request without it, like every request the doors refuse, with the
 *  dead answer (R10), which names nothing: so `draft` is accepted there and not required. A recipient presents the link's
 *  `secret` in the body; the control plane takes it, sends only its fingerprint as `secretSha` (R29) and drops the field,
 *  so the op as a screen reaches it accepts `secret` though this arm never reads one (a member's call sends none). `casedraft` is
 *  satisfied by a project (a new draft) or a draft (an edit), and keeps the fields a draft keeps (R4, R37). */
export const DECLARED_OPS = Object.freeze({
  casedraft: {
    classes: ["admin", "member", "probe"], mutating: true, weight: "reversible",
    description: localize("review.declared.casedraft", "review copy: its subject is a DRAFT CASE keyed draft_id, beside publish and never a bundle in a state — the answer names op=reviewcopy"),
    fields: { accepts: Object.freeze(["draft", "project", ...REVIEW_DRAFT_FIELDS]), requires: Object.freeze([Object.freeze(["project", "draft"])]) },
  },
  reviewgrant: {
    classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("review.declared.reviewgrant", "review copy: its subject is a DRAFT CASE keyed draft_id and its product is a grant keyed grant_id, not a move of any bundle"),
    fields: { accepts: Object.freeze(["draft", "recipient", "until"]), requires: Object.freeze(["draft", "recipient"]) },
  },
  reviewrevoke: {
    classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("review.declared.reviewrevoke", "review copy: its subject is a GRANT keyed grant_id, not a bundle in a state"),
    fields: { accepts: Object.freeze(["grant"]), requires: Object.freeze(["grant"]) },
  },
  /* G12c (K4208): the two reads a screen repeated once per item take a list of ids; both answer a call with none of the keys
     with the one dead answer (R10, R19), which names nothing, so nothing is required. The descriptions are the hand rows'. */
  casedrafts: {
    classes: ["admin", "member", "probe"], mutating: false, weight: "read",
    description: localize("review.declared.casedrafts", "read: the drafts of one project (BIO_Publication §6A.4), fenced exactly like reading one draft (BOB #32); each row names op=reviewcopy for its draft, and nothing is written"),
    fields: { accepts: Object.freeze(["project", "projects", "limit"]), requires: Object.freeze([]) },
  },
  reviewcopy: {
    classes: null, mutating: false, weight: "read",
    description: localize("review.declared.reviewcopy", "read: a review copy of one draft, or one per draft named in drafts, through a live grant or as a member with standing; any other reader gets the one dead answer; writes nothing"),
    fields: { accepts: Object.freeze(["draft", "drafts", "limit", "secret"]), requires: Object.freeze([]) },
  },
  reviewcomment: {
    classes: null, mutating: true, weight: "reversible",
    description: localize("review.declared.reviewcomment", "review-directed: keyed by a review copy; a reader's comment for the case's owner"),
    fields: { accepts: Object.freeze(["draft", "text", "secret"]), requires: Object.freeze(["text"]) },
  },
});
