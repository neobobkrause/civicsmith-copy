/* citation — citing, in the record's own terms "this is why I think that" (requirements: `build/requirements/citation.md`).
 * On a case (a `project`) a citation is a `cites` edge in the case's `references[]`; on a question (an `inquiry`) it is
 * a leg of the question's `basis[]`, with the target in its references too. This module holds that act (`cite`, R1–R3),
 * a case drawing one question in without a selection (`drawQuestion`, R14), its withdrawal and restoration on a case's
 * edge or a question's leg (`sever`, `reinstate`, R4, R15: status changes, never deletions) and the one rule
 * of what may be cited now (`retiredNotCitable`, R5), and the read of who cited a captured passage (`recordedBy`, R13,
 * `./recorded.mjs`), registered with `retrieval` (its R76) where `citationOf` first makes it. A question may also rest on
 * another team's accepted finding at a named edition, and take that leg back (`citeImported`, `withdrawImported`, R16, R17). It judges nothing about a leg's grammar, grade or the basis
 * graph: it composes legs, and `inquiry` judges them at the write (its R11), as it judges every other leg.
 *
 * Extracted from the legacy modules (T7, T6-2; K3, K64, K83, K102, N55): `store.mjs` (`cite`, `#edgeTransition`,
 * `sever`, `reinstate`, `#retiredNotCitable`, `#spliceEdgeStatus`, `#legExtentLines`, `#spliceBasis`, the three
 * `CITE_*` bounds and `EDGE_NOTE_MAX`, and the three ops' dispatch entries) and the legacy check catalogue
 * (`legacy-checks`: rows C-33.15–C-33.19, C-33.39 and C-45.7–C-45.10, now `./checks.mjs`). The record grammar it reads
 * (`normalizeType`, `OBJECT_TYPES`, `parseFrontmatter`, `createSha256`) is `record-grammar`'s. The legacy code's
 * comments moved with it, shortened where they only restated it.
 *
 * A CITATION EXISTS ONLY IN THE CITING DOCUMENT'S BYTES (R6, D-21). Both acts write the document and promote it; `refs`
 * and `inquiry_basis` are projections of those bytes (`connections`', `inquiry`'s), re-derived inside the promotion, and
 * this module writes neither. That is what makes the write's leg grammar and its cycle guard unavoidable rather than
 * merely available: there is no path from here to either table.
 *
 * FULLY SYNCHRONOUS, and that is load-bearing: nothing between resolving the selection and committing the promotion
 * awaits, and a Durable Object is single threaded, so no other write can interleave. The compare-and-swap is still
 * passed, as a backstop.
 *
 * REACHED as `citationOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps`, returned to every later caller. `deps`:
 *   record, membership, promotion, content, retrieval   the modules it uses, through their factories on the same host
 *                unless a test passes its own.
 *   provenance   `{homeOf}` (provenance R4): the document a found match's capture is held in (R1, T35); by default
 *                `provenanceOf(host)`.
 *   inquiry      `{earned, checkLegExtentGrammar, BASIS_ROLES, restingOn}` (inquiry R13, R5, R4, R12): the earned registry that fills a
 *                leg's grade, the one leg-part grammar, and the role vocabulary; by default `inquiryOf(host)`'s
 *                registry with the grammar and roles inquiry exports. One lacking any of the three refuses citing onto
 *                a question `INQUIRY_UNAVAILABLE` (never written ungraded by default); `restingOn`, the leg projection
 *                read back, is how R13 finds a capture's legs.
 *   acceptedWork `{acceptedFinding, openFlagsOn}` (accepted-work R2): the facts at an edition that `citeImported`'s receipt
 *                carries as `origin` (R16); by default `acceptedWorkOf(host)`. Its refusal itself runs inside the write.
 *   storage      the Durable Object's storage (default `host.storage`): R13 reads record-core's `bundles` contract (its R37)
 *                through its `sql` in one statement.
 *   now          the module's clock, milliseconds since the epoch (default: the wall clock). */

import { normalizeType, OBJECT_TYPES } from "../record-grammar/types.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { createSha256 } from "../record-grammar/sha256.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, noSuchProject } from "../membership/index.mjs";
import { promotionOf, INLINE_MAX } from "../promotion/index.mjs";
import { contentOf, citationExtent } from "../content/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { retrievalOf, answerChanged } from "../retrieval/index.mjs";
import { inquiryOf, checkLegExtentGrammar, BASIS_ROLES } from "../inquiry/index.mjs";
import { importedFindingRef, IMPORTED_FINDING_RE, CALCULATION_REF_RE, OCCURRENCE_REF_RE, DERIVED_CONNECTION_ID_RE } from "../inquiry-grammar/index.mjs";
import { BASIS_GRADES } from "../record-grammar/grades.mjs";
import { acceptedWorkOf } from "../accepted-work/index.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { CITE_CHECKS, CITE_EXTENT_CHECKS, CITE_IMPORTED_CHECKS, CITE_LEG_GRADE_CHECKS } from "./checks.mjs";
import { spliceEdgeStatus, spliceReferences, spliceBasis, removeBasisLegs, setBasisRole, setLegGrade, setLegStatus, setScalar, appendSessionLog } from "./splice.mjs";
import { recordedBy } from "./recorded.mjs";
import { localize, word } from "../setup-words/index.mjs";

export { CITE_CHECKS, CITE_EXTENT_CHECKS, CITE_IMPORTED_CHECKS, CITE_LEG_GRADE_CHECKS } from "./checks.mjs";
export { spliceEdgeStatus, spliceReferences, spliceBasis, removeBasisLegs, setBasisRole, setLegGrade, legExtentLines } from "./splice.mjs";
export { RECORDED_LIMIT_DEFAULT, RECORDED_LIMIT_MAX } from "./recorded.mjs";

/** R1: citing writes one frontmatter entry per cited record into a single `bundle.md`, so the edges one citing object
 *  can carry are bounded by the inline bound (1 MiB), not by a selection's size. MEASURED at 83 bytes per edge for the
 *  reference block at a 25-character bundle id (2026-07-25, test/cite-scale.mjs); used only to tell a member roughly
 *  how many would fit, never to decide the refusal, which is made on the real encoded length. */
export const CITE_EDGE_BYTES = 83;
/** R1 (REC-219 / D-579(a)): the `    extent_capture: <64 hex>` line a pinned case edge adds, 85 bytes by construction
 *  (20 + 64 + the newline), not measured, because it is fixed width. */
export const CITE_PIN_BYTES = 85;
/** R3, R4: how many ids a Session Log entry names before it summarises, bounded as the audit bounds its offenders. */
export const CITE_LOG_SAMPLE = 20;
/** R1: a note's ceiling (C-33.15). */
export const NOTE_MAX = 200;
/** R1: an extent value's ceiling (C-45.10). */
export const EXTENT_VALUE_MAX = 200;
/** R4: a severance's or reinstatement's reason, at most this long (a copy: `inquiry` holds its own, K57). */
export const EDGE_REASON_MAX = 160;
/** R4: an edge's note, the reasons appended to it, at most this long, the oldest dropped first. */
export const EDGE_NOTE_MAX = 480;

/* R1 (REC-97 / IC-90): the act's part vocabulary, and the TYPE each wire scalar must take to survive a round trip
   through the restricted frontmatter grammar. `int` and `nums` are coerced ONLY when the spelling permits it; a value
   that does not parse is passed through UNCHANGED so the leg grammar's own sentence refuses it rather than a worse one
   written here. FW-19 / IC-125 added the two newer arms and the image reference. */
export const EXTENT_PARAMS = Object.freeze({
  extent_kind: "text",  extent_ref: "text",
  extent_page: "int",   extent_rect: "nums",
  extent_sheet: "text", extent_cell: "text",
  extent_slide: "int",  extent_shape: "int",
  extent_para: "int",   extent_run: "int",
  extent_range: "text", extent_table: "int",
  extent_part: "text",  extent_cited_as: "text",
  content_id: "text",
});

/* R22: a leg's (or an incoming part's) part as one comparable string: its content id and extent fields, none for the
   whole document. */
function partKey(o) {
  return JSON.stringify(Object.keys(EXTENT_PARAMS).sort()
    .filter((k) => o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "")
    .map((k) => [k, Array.isArray(o[k]) ? o[k].join(",") : String(o[k]).trim()]));
}

/* R1 (T35; N698, DEC-164 (4)): a found match's extent (`content`'s extent grammar, retrieval R73) as the part bag a
   cited extent arrives in: each field `f` as `extent_f`, so the found part meets exactly the refusals a named part
   meets, and a field no part carries (`extent_space`, a nested note) is refused by name (C-45.7), never dropped. */
export function foundExtentBag(extent) {
  const bag = {};
  for (const [k, v] of Object.entries(extent)) {
    if (v === undefined || v === null) continue;
    bag[`extent_${k}`] = Array.isArray(v) ? `[${v.join(", ")}]` : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return bag;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const given = (v) => v !== null && v !== undefined && String(v).trim() !== "";

/* A refusal with a catalogue row carries the row's check and translation (R1). */
const rowOf = (family, code) => ({ code, check: family[code].check, translation: family[code].translation });

/* R16: a positive whole number, spelled as a number or as digits (the address carries it as text); else null. */
const editionOf = (v) => {
  if (typeof v === "number") return Number.isInteger(v) && v >= 1 ? v : null;
  return typeof v === "string" && /^[1-9]\d{0,8}$/.test(v.trim()) ? Number(v.trim()) : null;
};

const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------------ the module */

export class Citation {
  /* R13: each citing object's citations, parsed once per version of its bytes (keyed by its `bundleSha`); memory, not a
     row (R6). */
  #recorded = new Map();

  constructor({ record, membership, promotion, content, retrieval, provenance = null, inquiry = null, acceptedWork = null, storage = null, now } = {}) {
    this.record = record;
    this.acceptedWork = acceptedWork;
    /* R13: the store, for one read of record-core's `bundles` contract (its R37); absent, R13 reads it bundle by bundle. */
    this.sql = storage && storage.sql ? storage.sql : null;
    this.provenance = provenance;
    this.membership = membership;
    this.promotion = promotion;
    this.content = content;
    this.retrieval = retrieval;
    this.inquiry = inquiry;
    this.now = typeof now === "function" ? now : () => Date.now();
  }

  /* ---- R5 ---- */

  /** R5 (D-444, D-553): THE ONE RETIRED-TARGET PREDICATE, "may this be cited now". True exactly when the bundle's
   *  current state is `retired`, whatever its type: the rule follows the STATE, so any object in a `retired` state is
   *  not citable, by any door and for every caller. An id with no row answers false (an absent target is refused by
   *  another door and this one claims nothing about it). `source_status` is not read: a removed or modified source
   *  stays citable, `retired` is the other axis. NEVER viewer-gated: whether a viewer can see the target decides only
   *  a refusal's WORDING, never citability. Asked by `cite` (R1), `reinstate` (R4), and the later modules that offer
   *  or suggest a citation, so an offer and a refusal cannot answer differently. Never throws. */
  retiredNotCitable(id) {
    try {
      if (typeof id !== "string" || !id) return false;
      const h = this.record.head(id);
      return !!h && String(h.currentState ?? "").trim() === "retired";
    } catch { return false; }
  }

  /* ---- R27 ---- */

  /** R27 (T53; DEC-464; K5525): what a leg on a member's typing says of it, as the typing stands NOW: who typed it, when,
   *  who has checked it (members other than the typist, in time order, each with when), and the label by content's key
   *  (`content.typed.unchecked` / `content.typed.checked`, content R64). A member is named as the caller passes her in
   *  `names` (`{member: "how she is named"}`; the credit level is the caller's to apply), else as content names her
   *  (its credit rule), else "a member of the team"; a member's handle never appears. Null for a content id that is not
   *  a typing, or one the viewer may not see. Read by `cite` for its answer and Session Log, and by any caller reading a
   *  leg afterward. Writes nothing; never throws. */
  typedOf({ contentId = null, viewer = null, names = null } = {}) {
    try {
      if (typeof contentId !== "string" || !contentId.trim() || !this.content || typeof this.content.transcriptionRead !== "function") return null;
      const r = this.content.transcriptionRead({ id: contentId.trim(), viewer });
      if (!r || !r.ok || !isObj(r.typed)) return null;
      const passed = isObj(names) ? names : {};
      const nameOf = (member, fallback) => {
        const n = Object.prototype.hasOwnProperty.call(passed, member) && typeof passed[member] === "string" && passed[member].trim()
          ? passed[member].trim() : null;
        return n ?? (fallback && typeof fallback.name === "string" && fallback.name ? fallback.name : null);
      };
      const said = (n) => n ?? word("content.typed.anonymous_member");
      const typist = { name: said(nameOf(r.transcriber, r.typed.typist)) };
      const counted = (Array.isArray(r.attestations) ? r.attestations : []).filter((a) => a && a.attestor !== r.transcriber);
      const heldCheckers = Array.isArray(r.typed.checkers) ? r.typed.checkers : [];
      const checkers = counted.map((a, i) => ({ name: said(nameOf(a.attestor, heldCheckers[i])), at: a.at ?? null }));
      const checked = checkers.length > 0;
      const label_key = checked ? "content.typed.checked" : "content.typed.unchecked";
      const label = checked
        ? word(label_key, { typist: typist.name, checkers: checkers.map((c) => c.name).join(", ") })
        : word(label_key, { typist: typist.name });
      return { content_id: r.content_id, typist, at: r.at ?? null, checkers, checked, label_key, label };
    } catch { return null; }
  }

  /* ---- R13 ---- */

  /** R13 (T36; N715, DEC-164 (4)): who cited an extent of `captureSha`, in `events` R49's shape, over the legs and `cites`
   *  edges the citing objects' current bytes hold, each naming who first wrote it. Writes nothing; never throws. */
  recordedBy(args = {}) { return recordedBy(this, this.#recorded, args); }

  /* ---- the citing object, R1 and R4's shared opening ---- */

  /* The citing object, answered through sight BEFORE position (REC-138 / D-426, R9): an existence-only sight is
     `membership`'s C-70.1 (REC-149), and an absent id and one this viewer cannot see give the same answer, which is
     `membership.noSuchProject`'s (its R78, N146, N208): the code is minted there, never here. */
  #citingObject(project, viewer) {
    const h = typeof project === "string" && project ? this.record.head(project) : null;
    if (h) { const existence = this.membership.existenceAct(project, viewer); if (existence) return existence; }
    if (!h || !this.membership.inSight(project, viewer)) return noSuchProject(project);
    return { ok: true, head: h };
  }

  /* The live `bundle.md`, parsed (`ok: true`), or its readability refusal, returned as itself so its verdict stands
     at the top level (N196: a refusal nested one level down reads to the D-240 reader as an answer). It reads one
     file, bounded by the inline bound (1 MiB, promotion R48), and publishes no collection. */
  #document(project, detail) {
    const f = this.record.readFile(project, "bundle.md");
    if (!f || typeof f.text !== "string") return { ok: false, reason: "NO_BUNDLE_MD", project };
    const parsed = parseFrontmatter(f.text);
    if (!parsed.data)
      return { ok: false, reason: "UNPARSEABLE_FRONTMATTER", project, ...(detail ? { detail } : {}) };
    return { ok: true, text: f.text, data: parsed.data };
  }

  /* Promote the rewritten `bundle.md` over the head, every OTHER live file carried forward untouched: promote writes a
     whole image, so a writer that mentions one file deletes the rest (the default that once destroyed a provenance
     register). Hand-authored, not mechanical: a member citing evidence is authorship, so no writer and no operation
     are claimed. */
  #write(project, head, text, when, author, fm, objectType) {
    const carried = [];
    for (const path of this.record.livePaths(project) || []) {
      if (path === "bundle.md") continue;
      const f = this.record.readFile(project, path);
      if (!f) continue;
      carried.push(typeof f.text === "string"
        ? { path, text: f.text, sha256: f.sha256 }
        : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    const bytes = new TextEncoder().encode(text);
    return this.promotion.promote({
      bundleId: project, base: head.bundleSha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
      author: author || "member",
      files: [{ path: "bundle.md", text, bytes: bytes.length, sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: {
        object_type: objectType, title: fm.title,
        current_state: fm.current_state, prior_state: fm.prior_state ?? null,
        created: fm.created, last_updated: when,
        criticality: fm.criticality ?? null,
      },
    });
  }

  /* ---- sever, reinstate (R4) ---- */

  /** R4, R15: SEVERING and REINSTATING a case's `cites` edges and (T47, R15) a question's own legs, both at weight
   *  `refuse` (R7). SEVERING IS NOT DELETION: the edge stays, with its target and rel intact, and only its status
   *  moves, so a reader can see that the group once relied on something and stopped, and why. On a question the leg
   *  itself stays in `basis[]` untouched (role, grade, part, pin): what moves is the status of the `references[]` entry
   *  naming its target, whatever that entry's relation, which is exactly what `connections.edgeSevered` and
   *  `leg-earning`'s `restsOnLive` read a leg's severance from. A REASON IS REQUIRED by both: the catalogue's own remedy
   *  for a bad edge is "sever with reason" (C-6.1), and State Rules §5.1 has a human confirming or severing. One method
   *  for both directions and both arms, because they are the same operation over the same grammar. */
  #edgeTransition({ project, handle, viewer, owner, reason, author, from, to, verb, resultKey, identity = null, role = null, extent = null }) {
    /* Weight `refuse`, hard-coded exactly as `cite` hard-codes `report`: a caller that could choose the weight would
       make the distinction advisory (R7). */
    const sel = this.retrieval.selectionResolve({ handle, viewer, owner, weight: "refuse" });
    if (!sel.ok) return sel;

    /* Sight is the citing object's, a question's as a case's (R9, R15): an unseen one answers as an absent one. */
    const obj = this.#citingObject(project, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;
    /* Through normalizeType, so a legacy focus/problem spelling is the question it names (the MAP RULE). */
    const onInquiry = normalizeType(p.type) === "inquiry";
    if (p.type !== "project" && !onInquiry)
      return { ok: false, reason: "NOT_A_PROJECT", project, got: p.type,
               detail: localize("citation.index.citations_live_on_the_citing", "citations live on the citing object, and this is neither a case nor a question, so it holds no citation to withdraw or restore. A case keeps them in its references; a question keeps them in the basis its answer rests on.") };
    /* REC-134: moving a project's own citation edge is work inside that project (§7.5). A question is shared material,
       not a project's (INVESTIGATIVE-SESSION §7), so its arm asks no position, as `cite`'s does not (R1, R15). */
    if (!onInquiry) {
      const denied = this.membership.projectAuthority(project, identity, "joined", resultKey === "severed" ? "sever" : "reinstate");
      if (denied) return denied;
    }

    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("citation.index.verb_an_edge_records_why", "{verb} an edge records WHY. The catalog's own remediation for a bad reference is \"sever with reason\", and an edge moved with no reason is an unexplained change wearing a status field.", { verb: String(verb) }) };
    if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: localize("citation.index.a_reason_is_at_most", "a reason is at most {max} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes, so those would reshape the document rather than appear in it", { max: String(EDGE_REASON_MAX) }) };

    /* R23: a reinstatement may also put a question's leg on the other side. A case's edge carries no role, so a role sent
       there is refused by name as `cite` refuses it, never dropped; on a question it is one of the vocabulary. */
    const rl = role === null || role === undefined || String(role) === "" ? null : String(role);
    if (rl !== null) {
      if (!onInquiry)
        return { ok: false, reason: "ROLE_NOT_APPLICABLE", ...rowOf(CITE_CHECKS, "ROLE_NOT_APPLICABLE"), project, handle,
                 got: rl, drift: sel.drift,
                 detail: localize("citation.index.a_role_says_what_material", "a role says what material does for a QUESTION's answer, and this citing object is a case. A case's citation edge carries no role, so this one would be dropped rather than recorded — refused instead, because a field stated in one place and honoured nowhere is how the record and its projections drift apart.") };
      if (!this.inquiry || !Array.isArray(this.inquiry.BASIS_ROLES))
        return { ok: false, reason: "INQUIRY_UNAVAILABLE", project, handle, drift: sel.drift,
                 detail: localize("citation.index.citing_onto_a_question_needs", "citing onto a question needs the inquiry module's role vocabulary, leg grammar and earned registry, and your team's Civicsmith was created without them, so nothing was written.") };
      if (!this.inquiry.BASIS_ROLES.includes(rl))
        return { ok: false, reason: "BAD_ROLE", ...rowOf(CITE_CHECKS, "BAD_ROLE"), project, handle, got: rl,
                 roles: this.inquiry.BASIS_ROLES.slice(), drift: sel.drift,
                 detail: localize("citation.index.rl_is_not_a_role", "'{rl}' is not a role a basis leg can carry. The set is closed and is published by op=affordances beside the act: {roles}.", { rl, roles: this.inquiry.BASIS_ROLES.join(", ") }) };
    }

    /* R25: on a question the call names a passage by its part, as `cite` names it. The field names are judged as R1 judges
       them (a part is refused by name, never dropped); a case's edge is the document, so its arm reads no part. */
    const bag = onInquiry && extent && typeof extent === "object" ? extent : {};
    if (onInquiry) {
      const unknownFields = Object.keys(bag).filter((k) => !(k in EXTENT_PARAMS)).sort();
      if (unknownFields.length)
        return { ok: false, reason: "UNKNOWN_EXTENT_FIELD", ...rowOf(CITE_EXTENT_CHECKS, "UNKNOWN_EXTENT_FIELD"),
                 project, handle, drift: sel.drift, got: unknownFields, fields: Object.keys(EXTENT_PARAMS),
                 detail: localize("citation.index.this_call_names_fields", "this call names {names}, which this act does not carry, so the record cannot tell what part of the document was meant. It is REFUSED rather than ignored: a field accepted and quietly dropped leaves a citation that looks like the one you made and is not. The fields this act takes are: {fields}.", { names: unknownFields.map((k) => `'${k}'`).join(", "), fields: Object.keys(EXTENT_PARAMS).join(", ") }) };
    }
    const named = onInquiry && partKey(bag) !== partKey({});
    if (named && sel.members.length > 1)
      return { ok: false, reason: "EXTENT_ON_MANY", ...rowOf(CITE_EXTENT_CHECKS, "EXTENT_ON_MANY"),
               project, handle, offenders: sel.members.slice().sort(), drift: sel.drift,
               detail: localize("citation.index.a_part_of_a_document_is", "a part of a document is a part of ONE document, and this call would write {n} legs. Writing the same page or passage onto each of them would put claims in the record that nobody made — the extent was named once. Cite the one document this part belongs to, and cite the rest separately.", { n: String(sel.members.length) }) };

    /* An EMPTY selection is refused, not a successful no-op: promoting an UNCHANGED document would put a revision
       recording that nothing happened into an append-only history. */
    if (!sel.members.length)
      return { ok: false, reason: "EMPTY_SELECTION", project, handle, drift: sel.drift,
               detail: localize("citation.index.this_selection_resolves_to_nothing_to_move", "this selection resolves to no members, so there is nothing to move. It may have named ids that do not exist, or its members may have been purged or hidden since it was made.") };

    /* THE MIRROR OF `cite`'s CITABILITY TEST (REC-72): a case may cite information or a question, so it may also
       withdraw from and restore either; through `normalizeType`, so a legacy `focus`/`problem` spelling is the
       question it names (the MAP RULE). The whole call is refused rather than narrowed. */
    const offenders = [];
    for (const id of sel.members) {
      const b = this.record.head(id);
      const ty = b ? normalizeType(b.type) : null;
      if (!(ty === "information" || ty === "inquiry")) offenders.push(id);
    }
    if (offenders.length)
      return { ok: false, reason: "NOT_INFORMATION", project, handle, offenders: offenders.sort(),
               citable: ["information", "inquiry"],
               detail: localize("citation.index.a_citation_points_at_material", "a citation points at material or at a question, and these members of the selection are neither, so they carry no citation to move. The whole call is refused rather than narrowed.") };

    /* REC-183 / C-33.39: moving an edge INTO `confirmed` is a citation made now, so it asks cite's question through
       R5's one predicate, with the same code and the same whole-call refusal; otherwise severing, retiring and
       reinstating would rest a case on a retired item. `severed` is not asked: withdrawing reliance on a retired item
       is the direction the rule wants. Not a DEC-49 region: the row's one `where` is cite's (is-cite-retired). */
    if (to === "confirmed") {
      const retiredMembers = sel.members.filter((id) => this.retiredNotCitable(id));
      if (retiredMembers.length)
        return { ok: false, reason: "RETIRED_NOT_CITABLE", ...rowOf(CITE_CHECKS, "RETIRED_NOT_CITABLE"),
                 project, handle, offenders: retiredMembers.sort(), drift: sel.drift,
                 detail: localize("citation.index.the_team_has_retired_these", "the team has RETIRED these since the edge was severed, recording that they are superseded or no longer stand, and reinstating the edge would read to every later member as live support. Cite what superseded them, or re-collect the source as a new record and cite that. The whole call is refused rather than narrowed to the members that are not retired.") };
    }

    const doc = this.#document(project, null);
    if (!doc.ok) return doc;

    /* The entry each member's status lives on. On a case, its `cites` edge. On a question (R15), the `references[]`
       entry naming a leg's target, under any relation (R2 joins a leg's target there unless it is already referenced),
       the first such entry as `connections.edgeSevered` reads it; and only a target the question's basis holds a leg
       on, since a question may reference a document without resting on it (basis ⊆ references, never the reverse). */
    const legged = new Set(onInquiry && Array.isArray(doc.data.basis)
      ? doc.data.basis.filter((l) => l && typeof l === "object" && typeof l.target === "string").map((l) => l.target)
      : []);
    const current = new Map();
    for (const r of Array.isArray(doc.data.references) ? doc.data.references : [])
      if (r && typeof r === "object" && typeof r.target === "string" && (onInquiry ? legged.has(r.target) : r.rel === "cites")
          && !current.has(r.target))
        current.set(r.target, r);

    /* THE WHOLE SET MOVES OR NONE OF IT DOES. A member in the wrong state means the member is looking at a stale view,
       so the batch is refused by name rather than partially applied: a half-run state change is what weight `refuse`
       exists to prevent. */
    const wrong = [];
    /* R25: on a question each selected member's passage is one leg, named by its part (R22's identity). `legAt` maps a
       member to the position in `basis[]` of the leg to move; `legs` is each target's legs with their own status, a leg
       with none read through the document's entry, as every leg written before a passage had a status of its own. */
    const legAt = new Map();
    /* K5407: a leg carries `status: "severed"` while severed and none while live. A leg of a document severed before a passage
       had a status of its own (its entry `severed`, no leg of it carrying a status) reads through the entry. */
    const statusOf = (leg, e, doc_) => {
      if (typeof leg.status === "string" && leg.status !== "") return leg.status;
      const sibs = (Array.isArray(doc_.data.basis) ? doc_.data.basis : []).filter((l) => l && typeof l === "object" && l.target === leg.target);
      return e.status === "severed" && !sibs.some((l) => typeof l.status === "string" && l.status !== "") ? "severed" : e.status === "severed" ? "confirmed" : e.status;
    };
    if (onInquiry) {
      const basisAll = Array.isArray(doc.data.basis) ? doc.data.basis : [];
      const mine = partKey(bag);
      const ambiguous = [];
      for (const id of sel.members) {
        const e = current.get(id);
        const held = [];
        basisAll.forEach((l, n) => { if (l && typeof l === "object" && l.target === id) held.push(n); });
        let at = -1;
        if (named) at = held.find((n) => partKey(basisAll[n]) === mine) ?? -1;
        else if (held.length === 1) at = held[0];
        else if (held.length > 1) { ambiguous.push({ id, parts: held.map((n) => ({ ...Object.fromEntries(Object.keys(EXTENT_PARAMS).filter((k) => basisAll[n][k] !== undefined && basisAll[n][k] !== null && String(basisAll[n][k]).trim() !== "").map((k) => [k, basisAll[n][k]])) })) }); continue; }
        if (at < 0 || !e || !from.includes(statusOf(basisAll[at], e, doc))) { wrong.push(id); continue; }
        legAt.set(id, at);
      }
      /* DEC-49 REGION is-which-passage — C-33.65. */
      if (ambiguous.length)
        return { ok: false, reason: "WHICH_PASSAGE", ...rowOf(CITE_CHECKS, "WHICH_PASSAGE"), project, handle,
                 offenders: ambiguous.map((a) => a.id).sort(), passages: Object.fromEntries(ambiguous.map((a) => [a.id, a.parts])),
                 drift: sel.drift,
                 detail: localize("citation.index.which_passage", "this question rests on {ids} in more than one passage, and the call did not say which one to move. Name the passage by its part; each passage is listed. Nothing was written.", { ids: ambiguous.map((a) => a.id).sort().join(", ") }) };
      /* END DEC-49 REGION is-which-passage */
    } else {
      for (const id of sel.members) {
        const e = current.get(id);
        if (!e || !from.includes(e.status)) wrong.push(id);
      }
    }
    if (wrong.length)
      return { ok: false, reason: from.includes("severed") ? "NOT_SEVERED" : "NOT_CITED",
               project, handle, offenders: wrong.sort(), drift: sel.drift,
               detail: localize("citation.index.verb_requires_an_edge_currently", "{verb} requires an edge currently in {states}. These targets are not, so the whole call is refused: a batch that moved only the eligible members would be a state change the operator did not ask for.", { verb: String(verb), states: from.map((s) => `'${s}'`).join(" or ") }) };

    const when = stampInstant("second", this.now());
    /* The reason is APPENDED to the note, never substituted: the reason an edge was cited is as much a part of the
       record as the reason it stopped being relied on. Bounded, the oldest text dropped first, because the superseded
       revision is in history and the newest reasoning is what a reader needs first. On a question the entry (the
       document's) moves only when its live legs change from some to none or from none to some (R25); a passage that
       moves beside another live one is recorded by its own leg and the Session Log. */
    const changes = new Map();
    const legChanges = new Map();
    for (const id of sel.members) {
      if (onInquiry) {
        const basisAll = doc.data.basis;
        const at = legAt.get(id);
        legChanges.set(at, { target: id, status: to, ...(rl !== null ? { role: rl } : {}) });
        const live = basisAll.some((l, n) => l && typeof l === "object" && l.target === id
          && (n === at ? to !== "severed" : statusOf(l, current.get(id), doc) !== "severed"));
        const entryTo = live ? (current.get(id).status === "severed" ? "confirmed" : current.get(id).status) : "severed";
        if (entryTo === current.get(id).status) continue;
        const prev = String(current.get(id).note ?? "");
        let note = (prev ? prev + " | " : "") + `${verb} ${when}: ${why}`;
        if (note.length > EDGE_NOTE_MAX) note = note.slice(note.length - EDGE_NOTE_MAX);
        changes.set(id, { status: entryTo, note });
        continue;
      }
      const prev = String(current.get(id).note ?? "");
      let note = (prev ? prev + " | " : "") + `${verb} ${when}: ${why}`;
      if (note.length > EDGE_NOTE_MAX) note = note.slice(note.length - EDGE_NOTE_MAX);
      changes.set(id, { status: to, note });
    }

    const spliced = spliceEdgeStatus(doc.text, changes);
    if (!spliced)
      return { ok: false, reason: "UNSPLICEABLE_REFERENCES", project,
               detail: localize("citation.index.the_references_block_not_in_shape", "the references block is not in a shape this grammar can edit in place") };

    /* R23, R25: the named leg's own status, and its role when one was sent, go in the same write; the other legs of the same
       document are not named, so they keep their side, status, grade, part and pin. */
    let withRole = spliced, roleMoved = [], roleFrom = [];
    if (onInquiry) {
      const set = setLegStatus(spliced, legChanges);
      if (!set)
        return { ok: false, reason: "UNSPLICEABLE_BASIS", project,
                 detail: localize("citation.index.the_questions_basis_block", "the question's basis block is not in a shape this grammar can extend in place. Citing appends legs to that block and never rewrites the rest of the document.") };
      withRole = set;
      if (rl !== null)
        for (const [at, ch] of legChanges) {
          const was = doc.data.basis[at].role;
          if (was !== rl) { roleMoved.push(ch.target); roleFrom.push(was); }
        }
      roleMoved.sort();
      roleFrom = [...new Set(roleFrom)].sort();
    }
    let text = setScalar(withRole, "last_updated", `"${when}"`);
    const ids = [...sel.members].sort();
    const shown = ids.slice(0, CITE_LOG_SAMPLE);
    const listed = shown.join(", ") + (ids.length > shown.length ? `, and ${ids.length - shown.length} more` : "");
    const logHead = ids.length === 1
      ? localize("citation.index.session_head_one_citation", "### Session {when} | {verb} {count} citation | {who}\n", { when, verb, count: String(ids.length), who: author || "member" })
      : localize("citation.index.session_head_many_citations", "### Session {when} | {verb} {count} citations | {who}\n", { when, verb, count: String(ids.length), who: author || "member" });
    text = appendSessionLog(text,
      logHead
      + localize("citation.index.trigger_selection_handle", "Trigger: selection {handle}\n", { handle: String(handle) })
      + (onInquiry
        ? (roleMoved.length
          ? localize("citation.index.changes_basis_legs_role_moved", "Changes: basis legs on {listed} moved to '{to}', each leg kept as it was except the role of {moved}, which moves from {from} to {role}. Reason: {why}.\n", { listed, to, moved: roleMoved.join(", "), from: roleFrom.join(", "), role: String(rl), why: String(why) })
          : localize("citation.index.changes_basis_legs_on", "Changes: basis legs on {listed} moved to '{to}', each leg kept as it was. Reason: {why}.\n", { listed, to, why: String(why) }))
        : localize("citation.index.changes_cites_edges_to", "Changes: cites edges to {listed} moved to '{to}'. Reason: {why}.\n", { listed, to, why: String(why) })));

    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX)
      return { ok: false, reason: "CITATION_TOO_LARGE", project, bytes: bytes.length, limit: INLINE_MAX,
               detail: localize("citation.index.the_reasons_appended_to_these", "the reasons appended to these citations would push bundle.md past the 1MB inline limit") };
    /* The type from the DOCUMENT, as `cite` writes it: byte-identical for a case, correct for a question. The write's
       refusals come back unchanged (a question whose document cannot be revised is refused as any write to it is,
       inquiry R11; R15). */
    const promoted = this.#write(project, p, text, when, author, doc.data, doc.data.object_type ?? p.type);
    if (!promoted.ok) return { ...promoted, project, handle, drift: sel.drift };

    return { ok: true, project, handle, weight: "refuse", moved: sel.moved, drift: sel.drift,
             /* `why` and NOT `reason`: every refusal returns a REASON CODE under that name, and returning the member's
                prose under the same key would make a success indistinguishable from a refusal to a caller checking
                `reason`. */
             [resultKey]: ids, why, from, to,
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion, gate: sel.gate,
             ...(onInquiry ? { citingObjectType: "inquiry" } : {}),
             ...(rl !== null ? { role: rl, roleMoved } : {}) };
  }

  sever({ project, handle, viewer = null, owner = null, reason = "", author = null, identity = null, extent = null } = {}) {
    return this.#edgeTransition({ project, handle, viewer, owner, reason, author, identity, extent,
      from: ["confirmed", "proposed"], to: "severed", verb: "Severed", resultKey: "severed" });
  }

  reinstate({ project, handle, viewer = null, owner = null, reason = "", author = null, identity = null, role = null, extent = null } = {}) {
    return this.#edgeTransition({ project, handle, viewer, owner, reason, author, identity, role, extent,
      from: ["severed"], to: "confirmed", verb: "Reinstated", resultKey: "reinstated" });
  }

  /* R21: the labels a question's `grounds[]` declares, from its document. */
  #declaredGrounds(project) {
    const d = this.#document(project, null);
    return d.ok && Array.isArray(d.data.grounds)
      ? d.data.grounds.filter((g) => g && typeof g === "object" && typeof g.ground === "string" && g.ground.trim()).map((g) => g.ground.trim())
      : [];
  }

  /* ---- cite (R1–R3) ---- */

  /** R1–R3: CITING, at weight `report` (R7): material, or a question, becomes part of what a case or a question rests
   *  on. ONE ACT (REC-37): where the record keeps it differs (a case's `references[]`, a question's `basis[]`) and
   *  what the member did does not, so one op serves both arms and `project` names the citing object either way.
   *
   *  WHAT THE INQUIRY ARM DOES NOT DO, and each absence is a decision:
   *   - IT DOES NOT GRADE (R8). A leg's connection grade is FILLED from `inquiry.earned`, the same registry the read
   *     answers from and the write enforces with; a target the record earns nothing for lands with NO grade, axis or
   *     source: undetermined, stated by the absence, inert (DEC-18). There is no grade control and no default letter.
   *   - IT DOES NOT CHECK FOR A CYCLE. `SELF_BASIS` and `BASIS_CYCLE` are the write's (inquiry R11), reached because
   *     the leg lands THROUGH THE DOCUMENT; a second rule here would be a second answer waiting to disagree.
   *   - IT DOES NOT VALIDATE A LEG beyond routing its part through `inquiry.checkLegExtentGrammar`, the same function
   *     that judges it again at the write.
   *   - IT ASKS ONE THING ABOUT A TARGET'S STATE, ON BOTH ARMS: whether the group RETIRED it (R5). */
  cite({ project = null, handle = null, found = null, question = null, viewer = null, owner = null,
         note = "", author = null, role = null, extent = null, identity = null, ground = null, names = null } = {}) {
    /* T35 (N698, DEC-164 (4), (5)): WHAT IS CITED, from ONE source, asked before anything else. A selection (`handle`,
       with an optional `extent`), or one match "Find in this" answered (`found`, retrieval R73), which stands in place
       of both: its document is the one member, its extent that member's part. Being found changes no judgement: the
       found part meets every refusal below a named part meets, at the same weight (R7). */
    /* DEC-49 REGION is-cite-found — C-45.14-16. */
    const fromFound = found !== null && found !== undefined;
    const bagGiven = isObj(extent) && Object.values(extent).some(given);
    if (fromFound === given(handle) || (fromFound && bagGiven))
      return { ok: false, reason: "CITE_ONE_SOURCE", ...rowOf(CITE_EXTENT_CHECKS, "CITE_ONE_SOURCE"), project,
               detail: fromFound
                 ? localize("citation.index.this_call_names_a_passage", "this call names a passage found by search and also a selection or a part of a document. A found passage already names its document and its part, so the record could not tell which you meant; nothing was written.")
                 : localize("citation.index.this_call_names_neither", "this call names neither a selection nor a passage found by search, so there is nothing to cite; nothing was written.") };
    let foundDoc = null, foundCapture = null;
    if (fromFound) {
      /* Read for its capture and extent ONLY, never its words: the words are the search's, the part is the record's. */
      const sha = isObj(found) && typeof found.capture_sha === "string" ? found.capture_sha.trim().toLowerCase() : "";
      const home = /^[0-9a-f]{64}$/.test(sha) && this.provenance && typeof this.provenance.homeOf === "function"
        ? this.provenance.homeOf(sha) : null;
      /* A capture the record holds in no document, and one in a document this viewer may not see, are answered
         alike (R9's rule, retrieval's CAPTURE_NOT_HELD): neither names a document this member can cite. */
      const doc = home && typeof home.bundleId === "string" && this.membership.inSight(home.bundleId, viewer)
        ? home.bundleId : null;
      if (!doc || !isObj(found.extent) || typeof found.extent.kind !== "string" || !found.extent.kind.trim())
        return { ok: false, reason: "FOUND_MALFORMED", ...rowOf(CITE_EXTENT_CHECKS, "FOUND_MALFORMED"), project,
                 missing: [...(doc ? [] : ["document"]), ...(sha ? [] : ["capture_sha"]),
                           ...(isObj(found) && isObj(found.extent) && typeof found.extent.kind === "string"
                               && found.extent.kind.trim() ? [] : ["extent"])],
                 detail: localize("citation.index.a_passage_found_by_search", "a passage found by search is cited by the document it is in, the capture it was found in and its part of that capture, and this one names no document you can see, no capture, or no part; nothing was written.") };
      /* The part was found in THESE bytes; a leg on this document is pinned to `content.captureFor`'s capture (R2,
         REC-220). Where they differ the part would be written against bytes it was not found in. */
      const pinned = this.content.captureFor(doc);
      if (pinned !== sha)
        return { ok: false, reason: "FOUND_CAPTURE_MOVED", ...rowOf(CITE_EXTENT_CHECKS, "FOUND_CAPTURE_MOVED"), project,
                 document: doc, found_capture: sha, pinned_capture: pinned ?? null,
                 detail: localize("citation.index.this_passage_was_found_in", "this passage was found in capture {sha} of {doc}, and a citation of {doc_2} is pinned to {v1}, so its part could name different words. Nothing was written.", { sha: String(sha), doc: String(doc), doc_2: String(doc), v1: String(pinned ? `capture ${pinned}` : "no capture") }) };
      foundDoc = doc; foundCapture = sha;
      extent = foundExtentBag(found.extent);
    }
    /* END DEC-49 REGION is-cite-found */

    /* The question the member looked for it for, optional (DEC-164 (5)): kept in the Session Log and the answer, and
       changing no other judgement. An absent question and one this viewer may not see are answered alike. */
    /* DEC-49 REGION is-cite-question — C-33.52-53. */
    let questionId = null;
    if (given(question)) {
      const qid = String(question).trim();
      const qh = this.record.head(qid);
      if (!qh || !this.membership.inSight(qid, viewer))
        return { ok: false, reason: "NO_SUCH_QUESTION", ...rowOf(CITE_CHECKS, "NO_SUCH_QUESTION"), project, question: qid,
                 detail: localize("citation.index.no_question_kept_with_it", "no question by that id is one you can see, so this citation cannot be kept with it; nothing was written.") };
      if (normalizeType(qh.type) !== "inquiry")
        return { ok: false, reason: "NOT_AN_INQUIRY", ...rowOf(CITE_CHECKS, "NOT_AN_INQUIRY"), project, question: qid,
                 got: qh.type,
                 detail: localize("citation.index.not_a_question_cited_for", "{qid} is not a question, so it cannot be the question this was cited for; nothing was written.", { qid }) };
      questionId = qid;
    }
    /* END DEC-49 REGION is-cite-question */

    /* The gate first, so an unknown or someone else's selection is refused before a project is looked at. A found
       match has no selection: its one member is its document, and nothing could have moved (R3). */
    const sel = fromFound
      ? { ok: true, members: [foundDoc], drift: false, moved: false, gate: null, expires: null }
      : this.retrieval.selectionResolve({ handle, viewer, owner, weight: "report" });
    if (!sel.ok) return sel;
    if (fromFound) handle = null;

    const obj = this.#citingObject(project, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;
    /* Through normalizeType, so a legacy focus/problem spelling lands on the inquiry arm — the MAP RULE. */
    const ontoInquiry = normalizeType(p.type) === "inquiry";
    if (p.type !== "project" && !ontoInquiry)
      return { ok: false, reason: "NOT_A_PROJECT", project, got: p.type,
               detail: localize("citation.index.citations_live_on_the_citing_object", "citations live on the CITING object, and this is neither a case nor a question. A case keeps them in its references; a question keeps them in the basis its answer rests on (State Rules 5.2). Nothing else in the record holds either.") };
    /* REC-134: citing INTO A PROJECT edits that project's document, work inside it, so the actor must have JOINED it
       (§7.5). The question arm is untouched: an inquiry is shared material, not a project's (INVESTIGATIVE-SESSION §7). */
    if (!ontoInquiry) {
      const denied = this.membership.projectAuthority(project, identity, "joined", "cite");
      if (denied) return denied;
    }

    /* A note is written into the restricted frontmatter grammar, which understands no escapes: a quote or a newline
       would silently reshape the document. Refused rather than sanitised: mangling a member's words is worse than
       declining them. */
    /* DEC-49 REGION is-cite-note — REC-64/C-33.15. */
    const nt = String(note ?? "");
    if (nt.length > NOTE_MAX || /["\\\r\n]/.test(nt))
      return { ok: false, reason: "BAD_NOTE", ...rowOf(CITE_CHECKS, "BAD_NOTE"),
               detail: localize("citation.index.a_note_is_at_most", "a note is at most 200 characters and cannot contain a quote, a backslash, or a newline") };
    /* END DEC-49 REGION is-cite-note */

    /* THE ROLE (REC-37), judged before the members so a member who has not said what the material DOES is told that
       first. REQUIRED on the inquiry arm and refused BY NAME (R8): `cuts_against` is first-class (Invariant 7) and is
       exactly the leg a default would silently turn into `supports`. The vocabulary travels WITH the refusal. REFUSED,
       not ignored, on the case arm: a `cites` edge has no role, and a field authored in one place and honoured nowhere
       is the D-21 class in miniature. */
    /* The instance's own wiring, not a member's mistake: the question arm cannot run without inquiry's services. */
    if (ontoInquiry && (!this.inquiry || typeof this.inquiry.earned !== "function"
                        || typeof this.inquiry.checkLegExtentGrammar !== "function" || !Array.isArray(this.inquiry.BASIS_ROLES)))
      return { ok: false, reason: "INQUIRY_UNAVAILABLE", project, handle, drift: sel.drift,
               detail: localize("citation.index.citing_onto_a_question_needs", "citing onto a question needs the inquiry module's role vocabulary, leg grammar and earned registry, and your team's Civicsmith was created without them, so nothing was written.") };
    /* DEC-49 REGION is-cite-role — REC-64/C-33.16-18. */
    const rl = role === null || role === undefined || String(role) === "" ? null : String(role);
    if (ontoInquiry) {
      const roles = this.inquiry.BASIS_ROLES;
      if (rl === null)
        return { ok: false, reason: "NO_ROLE", ...rowOf(CITE_CHECKS, "NO_ROLE"), project, handle, roles: roles.slice(),
                 drift: sel.drift,
                 detail: localize("citation.index.a_leg_of_a_questions_basis", "a leg of a question's basis says what the material DOES for the answer, and this call does not say. It is never assumed: a leg that cuts against the case is first-class here, and guessing would put a claim about your own reasoning in the record that you did not make. State role as one of: {roles}.", { roles: roles.join(", ") }) };
      if (!roles.includes(rl))
        return { ok: false, reason: "BAD_ROLE", ...rowOf(CITE_CHECKS, "BAD_ROLE"), project, handle, got: rl,
                 roles: roles.slice(), drift: sel.drift,
                 detail: localize("citation.index.rl_is_not_a_role", "'{rl}' is not a role a basis leg can carry. The set is closed and is published by op=affordances beside the act: {roles}.", { rl, roles: roles.join(", ") }) };
    } else if (rl !== null) {
      return { ok: false, reason: "ROLE_NOT_APPLICABLE", ...rowOf(CITE_CHECKS, "ROLE_NOT_APPLICABLE"), project, handle,
               got: rl, drift: sel.drift,
               detail: localize("citation.index.a_role_says_what_material", "a role says what material does for a QUESTION's answer, and this citing object is a case. A case's citation edge carries no role, so this one would be dropped rather than recorded — refused instead, because a field stated in one place and honoured nowhere is how the record and its projections drift apart.") };
    }
    /* END DEC-49 REGION is-cite-role */

    /* R21: the group a new leg joins, a label the question already declares; refused by name on a case (no groups) and for a
       label the question does not declare, never dropped. Whether the grouping is whole is the write's. */
    /* DEC-49 REGION is-cite-ground — C-33.58. */
    const gl = given(ground) ? String(ground).trim() : null;
    const declaredGrounds = ontoInquiry ? this.#declaredGrounds(project) : [];
    if (gl !== null && !declaredGrounds.includes(gl))
      return { ok: false, reason: "BAD_GROUND", ...rowOf(CITE_CHECKS, "BAD_GROUND"), project, handle, got: gl,
               grounds: declaredGrounds, drift: sel.drift,
               detail: localize("citation.index.bad_ground", "a new citation can join only a group its question already declares, and this one names {ground}; a case has no groups. Nothing was written.", { ground: gl }) };
    /* END DEC-49 REGION is-cite-ground */

    /* Every member must be CITABLE: information, or a QUESTION, on both arms (REC-72: a case may draw on a question;
       REC-37: a question rests on material or another question, DEC-23). A question citing ITSELF is not caught here:
       that cycle MEANS something and the write names the path it closes (SELF_BASIS). Either way the whole call is
       refused with the offenders named, never filtered down: narrowing a set changes what the member's click meant. */
    const offenders = [];
    for (const id of sel.members) {
      const b = this.record.head(id);
      const ty = b ? normalizeType(b.type) : null;
      if (!(ty === "information" || ty === "inquiry")) offenders.push(id);
    }
    if (offenders.length)
      return ontoInquiry
        /* Its own reason, because on this arm an inquiry IS citable. */
        ? { ok: false, reason: "NOT_CITABLE", project, handle,
            offenders: offenders.sort(), drift: sel.drift, citable: ["information", "inquiry"],
            detail: localize("citation.index.a_question_rests_on_material", "a question rests on material or on another question, and nothing else in the record can be a leg of its basis. These members of the selection are neither, and the whole call is refused rather than narrowed to the ones that are.") }
        /* The wire string does not move (renaming a reason code is a break, REC-37); `detail` says what is refused
           and `citable` carries the vocabulary. Renaming it is recorded as Bob's decision, not taken here. */
        : { ok: false, reason: "NOT_INFORMATION", project, handle,
            offenders: offenders.sort(), drift: sel.drift, citable: ["information", "inquiry"],
            detail: localize("citation.index.a_case_rests_on_material", "a case rests on material, or on a question the team is asking. These members of the selection are neither, and the whole call is refused rather than narrowed to the ones that are.") };

    /* DEC-49 REGION is-cite-retired — D-168 / C-33.39. A RETIRED ITEM IS NOT CITABLE (State Rules §4.1): a citation
       made after the retirement is the harm `retire`'s CITED refusal guards, entered by the other door. Asked through
       R5's one predicate. Neither `source_status` (the other axis) nor the edges already written are asked. */
    const retiredMembers = sel.members.filter((id) => this.retiredNotCitable(id));
    if (retiredMembers.length)
      return { ok: false, reason: "RETIRED_NOT_CITABLE", ...rowOf(CITE_CHECKS, "RETIRED_NOT_CITABLE"),
               project, handle, offenders: retiredMembers.sort(), drift: sel.drift,
               detail: localize("citation.index.the_team_has_retired_these_now", "the team has RETIRED these, recording that they are superseded or no longer stand, and a citation made now would read to every later member as live support. Cite what superseded them, or re-collect the source as a new record and cite that. The whole call is refused rather than narrowed to the members that are not retired.") };
    /* END DEC-49 REGION is-cite-retired */

    const doc = this.#document(project, localize("citation.index.projects_bundle_md_does_not_parse", "the project's own bundle.md does not parse under the restricted grammar"));
    if (!doc.ok) return doc;

    /* Partition the selection against what the document already carries. SEVERED IS NOT ABSENT: a severed edge is a
       recorded human judgment, and reinstating one is a state change that cannot ride inside a report-weight act
       (Bob, 2026-07-25). On the inquiry arm ALREADY means "already carries a LEG" (a question can reference a document
       without resting on it; basis ⊆ references, never the reverse). A second leg on the same target is legal by
       design (D4) but is an authored statement, not a repeat of this act, so citing stays safely retryable. */
    const existing = Array.isArray(doc.data.references) ? doc.data.references : [];
    const byTarget = new Map();
    for (const r of existing)
      if (r && typeof r === "object" && r.rel === "cites" && typeof r.target === "string")
        byTarget.set(r.target, r.status);
    /* EVERY references target whatever its rel, so the inquiry arm never writes a SECOND entry for a target already
       referenced under another relation (C-6.3 asks that a leg's target be in references[], not for a duplicate). */
    const referenced = new Set(existing
      .filter((r) => r && typeof r === "object" && typeof r.target === "string").map((r) => r.target));
    /* R22: a document is cited already only under the same PART; the parts the question's legs hold, per target. */
    const leggedParts = new Map();
    if (ontoInquiry && Array.isArray(doc.data.basis))
      for (const l of doc.data.basis)
        if (l && typeof l === "object" && typeof l.target === "string") {
          if (!leggedParts.has(l.target)) leggedParts.set(l.target, new Set());
          leggedParts.get(l.target).add(partKey(l));
        }
    const legged = new Set(leggedParts.keys());

    const severed = [], already = [], add = [];
    for (const id of sel.members) {
      const st = byTarget.get(id);
      if (st === "severed") severed.push(id);
      else if (ontoInquiry ? legged.has(id) : st !== undefined) already.push(id);
      else add.push(id);
    }
    /* DEC-49 REGION is-cite-severed — REC-64/C-33.19. */
    if (severed.length)
      return { ok: false, reason: "SEVERED_EDGE", ...rowOf(CITE_CHECKS, "SEVERED_EDGE"), project, handle,
               offenders: severed.sort(), drift: sel.drift,
               detail: localize("citation.index.these_targets_already_carry", "these targets already carry a SEVERED cites edge, which is a recorded decision to cut the dependency, not the absence of one. Citing neither reverses it silently nor skips past it. Reinstating a severance is a separate action that records its own reason.") };
    /* END DEC-49 REGION is-cite-severed */

    /* REC-97 / IC-90 — WHAT PART OF THE DOCUMENT THE LEG RESTS ON. Nothing here is dropped: every arm refuses BY NAME
       (a part once sent beside the act was dropped in silence, the record then claiming something other than what the
       member did). This owns no grammar: what it judges is what only the ACT can know (which fields it carries, which
       arm it is on, how many legs one part would be written onto, whether a value can be written at all). ABSENT IS
       `document` AND IS NEVER REFUSED (Bob's 5.3): with no part field none of this is reached and the act is
       byte-identical to one that never heard of parts. AN EMPTY VALUE IS NOT AN AUTHORED ONE; the FIELD NAME is judged
       whatever its value. */
    /* DEC-49 REGION is-cite-extent — REC-97/C-45.7-10. */
    const bag = extent && typeof extent === "object" ? extent : {};
    const unknownFields = Object.keys(bag).filter((k) => !(k in EXTENT_PARAMS)).sort();
    if (unknownFields.length)
      return { ok: false, reason: "UNKNOWN_EXTENT_FIELD", ...rowOf(CITE_EXTENT_CHECKS, "UNKNOWN_EXTENT_FIELD"),
               project, handle, drift: sel.drift, got: unknownFields, fields: Object.keys(EXTENT_PARAMS),
               detail: localize("citation.index.this_call_names_fields", "this call names {names}, which this act does not carry, so the record cannot tell what part of the document was meant. It is REFUSED rather than ignored: a field accepted and quietly dropped leaves a citation that looks like the one you made and is not. The fields this act takes are: {fields}.", { names: unknownFields.map((k) => `'${k}'`).join(", "), fields: Object.keys(EXTENT_PARAMS).join(", ") }) };
    const authored = Object.keys(bag).filter((k) => String(bag[k] ?? "").trim() !== "").sort();
    if (authored.length && !ontoInquiry)
      return { ok: false, reason: "EXTENT_NOT_APPLICABLE", ...rowOf(CITE_EXTENT_CHECKS, "EXTENT_NOT_APPLICABLE"),
               project, handle, got: authored, drift: sel.drift,
               detail: localize("citation.index.which_part_of_a_document", "which part of a document a citation rests on is recorded on a leg of a QUESTION's basis, and this citing object is a case. A case's citation edge names the document and has no slot for a page or a passage, so this extent would be dropped rather than recorded — refused instead, for the reason a role is refused here: a field stated in one place and honoured nowhere is how the record and its projections drift apart.") };
    if (authored.length && add.length > 1)
      return { ok: false, reason: "EXTENT_ON_MANY", ...rowOf(CITE_EXTENT_CHECKS, "EXTENT_ON_MANY"),
               project, handle, offenders: add.slice().sort(), drift: sel.drift,
               detail: localize("citation.index.a_part_of_a_document_is", "a part of a document is a part of ONE document, and this call would write {n} legs. Writing the same page or passage onto each of them would put claims in the record that nobody made — the extent was named once. Cite the one document this part belongs to, and cite the rest separately.", { n: String(add.length) }) };
    /* THE SPELLING FENCE, BAD_NOTE's rule one field down: these values are written as frontmatter scalars. */
    const legFields = {};
    for (const k of authored) {
      const raw = String(bag[k]).trim();
      if (raw.length > EXTENT_VALUE_MAX || /["\\\r\n#]/.test(raw))
        return { ok: false, reason: "BAD_EXTENT_VALUE", ...rowOf(CITE_EXTENT_CHECKS, "BAD_EXTENT_VALUE"),
                 project, handle, field: k, drift: sel.drift,
                 detail: localize("citation.index.k_cannot_be_written_into", "'{k}' cannot be written into the record as it stands: a value describing which part of a document is at most 200 characters and cannot contain a quotation mark, a backslash, a line break or a comment mark. Those characters would reshape the document rather than appear in it.", { k }) };
      const t = EXTENT_PARAMS[k];
      if (t === "int" && /^\d+$/.test(raw)) legFields[k] = parseInt(raw, 10);
      else if (t === "nums") {
        const parts = raw.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim());
        const nums = parts.map((s) => (/^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN));
        legFields[k] = nums.every((n) => Number.isFinite(n)) ? nums : raw;
      } else legFields[k] = raw;
    }
    /* END DEC-49 REGION is-cite-extent */

    /* R22: on a question a member already cited under a DIFFERENT part (another content_id or extent, the whole
       document being a part of its own) is a new leg, not a repeat; the same part stays alreadyCited. */
    if (ontoInquiry && already.length) {
      const mine = partKey(legFields);
      const fresh = already.filter((id) => !leggedParts.get(id).has(mine));
      if (fresh.length) {
        for (const id of fresh) already.splice(already.indexOf(id), 1);
        add.splice(0, add.length, ...sel.members.filter((id) => !already.includes(id) && !severed.includes(id)));
        if (authored.length && add.length > 1)
          return { ok: false, reason: "EXTENT_ON_MANY", ...rowOf(CITE_EXTENT_CHECKS, "EXTENT_ON_MANY"),
                   project, handle, offenders: add.slice().sort(), drift: sel.drift,
                   detail: localize("citation.index.a_part_of_a_document_is", "a part of a document is a part of ONE document, and this call would write {n} legs. Writing the same page or passage onto each of them would put claims in the record that nobody made — the extent was named once. Cite the one document this part belongs to, and cite the rest separately.", { n: String(add.length) }) };
      }
    }

    /* AND NOW THE LEG GRAMMAR JUDGES IT, under the write's own name: the composed part goes through
       `inquiry.checkLegExtentGrammar`, the same function that judges it again at the write, so an unlanded kind, an
       unparseable page, a malformed content id and a leg naming both an id and an extent are refused HERE, before a
       byte moves, in the catalogue's own words. The record-only arms (the page set, the chain) are the write's.
       Outside the region above, because `BASIS_REFUSED` is not a row of this module's. */
    if (authored.length) {
      const ef = [];
      this.inquiry.checkLegExtentGrammar(legFields, localize("citation.index.the_part_of_the_document_label", "the part of the document this citation names"), "C-2.8", ef);
      const exErrs = ef.filter((x) => x.severity === "error");
      if (exErrs.length)
        return { ok: false, reason: "BASIS_REFUSED", project, handle, drift: sel.drift,
                 findings: exErrs.map((x) => ({ check: x.check, code: x.code ?? null,
                                                detail: x.message, repairs: x.repairs ?? [] })),
                 repairs: [],
                 detail: localize("citation.index.the_part_of_the_document_refused", "the part of the document this citation names is refused by the SAME catalog function op=promote runs at the write, so nothing was written. A citation that names no part means the whole document, which is always a legal thing to cite.") };
    }

    const when = stampInstant("second", this.now());

    if (!sel.members.length)
      return { ok: false, reason: "EMPTY_SELECTION", project, handle, drift: sel.drift,
               detail: localize("citation.index.this_selection_resolves_to_nothing_to_cite", "this selection resolves to no members, so there is nothing to cite. It may have named ids that do not exist, or its members may have been purged or hidden since it was made.") };
    /* Nothing to do is a SUCCESS that writes nothing: citing must be safely retryable, since drift is reported rather
       than fatal and a member who reads a drift report will reasonably press again. AND WHEN A PART WAS NAMED, SAY
       THAT IT WENT NOWHERE (narrowing an existing citation is its own act, Bob's 5.3). */
    if (!add.length)
      return { ok: true, project, handle, weight: "report", moved: sel.moved, drift: sel.drift,
               cited: [], alreadyCited: already.sort(), severed: [], question: questionId,
               bundleSha: p.bundleSha, rowVersion: null,
               detail: localize("citation.index.every_member_of_the_selection", "every member of the selection was already cited; nothing was written{v1}", { v1: String(authored.length
                        ? localize("citation.index.part_named_written_nowhere", ". The part of the document this call named was written NOWHERE, because no leg was written at all: making an existing citation more specific is a separate authored act on this record's own plan.")
                        : "") }) };

    /* THE WRITE, PER ARM; both go through the document (R6). */
    let spliced = null, filled = [];
    /* REC-219 / D-579(a): a CASE's edge carries the capture the record presents at this act (`content.captureFor`),
       as `extent_capture` in the edge's own bytes, so which bytes a case cited is a fact the record holds rather than
       a question asked again at every later read. Not stamped on a question target (no bytes, DEC-21) or where the
       record holds no capture of the document. */
    const edgePins = new Map();
    if (!ontoInquiry)
      for (const target of add)
        if (normalizeType(OBJECT_TYPES[String(target).split("-")[0]]) === "information") {
          const pin = this.content.captureFor(target);
          if (pin) edgePins.set(target, pin);
        }
    if (!ontoInquiry) {
      spliced = spliceReferences(
        doc.text, add.map((target) => ({ rel: "cites", target, status: "confirmed", note: nt,
                                         ...(edgePins.has(target) ? { extent_capture: edgePins.get(target) } : {}) })));
      if (!spliced)
        return { ok: false, reason: "UNSPLICEABLE_REFERENCES", project,
                 detail: localize("citation.index.projects_references_block_extend", "the project's references block is not in a shape this grammar can extend in place. Citing edits only that block and never rewrites the rest of the document.") };
    } else {
      /* THE SUBJECT COMES FROM THE BYTES, the authority, not from a projection of them. */
      const subject = typeof doc.data.subject_entity === "string" && doc.data.subject_entity.trim() !== ""
        ? doc.data.subject_entity.trim() : null;
      const reg = this.inquiry.earned(subject, add);
      /* REC-220: the capture a document leg rests on, PINNED at the act as `extent_capture` (Bob, 2026-09-25, rule 1:
         a reference is pinned to the version it was made against). Not where the leg names a `content_id` (the id is a
         hash over its capture, already pinned), on a question target, or where the record holds no capture. */
      const pinOf = (target) => {
        if (typeof legFields.content_id === "string" && legFields.content_id.trim()) return null;
        if (normalizeType(OBJECT_TYPES[target.split("-")[0]]) !== "information") return null;
        return this.content.captureFor(target);
      };
      filled = add.map((target) => {
        const grp = gl !== null ? { ground: gl } : {};
        const earned = reg && reg.earned && reg.earned.connection ? reg.earned.connection[target] : null;
        const pin = pinOf(target);
        const pinned = pin ? { extent_capture: pin } : {};
        /* ONLY THE CONNECTION AXIS IS FILLED: the capture axis's earned value is a ceiling, not a measurement. */
        return earned && earned.grade
          ? { target, role: rl, grade: earned.grade, grade_axis: "connection", grade_source: "resolution",
              note: nt, why: earned.why, ...grp, ...legFields, ...pinned }
          : { target, role: rl, note: nt, why: null, ...grp, ...legFields, ...pinned };
      });
      /* references FIRST and only where the document does not already carry the target: C-6.3 refuses a leg whose
         target is not in references[], and the two projections of one document must not disagree. */
      const newRefs = add.filter((t) => !referenced.has(t))
        .map((target) => ({ rel: "cites", target, status: "confirmed", note: nt }));
      const withRefs = newRefs.length ? spliceReferences(doc.text, newRefs) : doc.text;
      if (!withRefs)
        return { ok: false, reason: "UNSPLICEABLE_REFERENCES", project,
                 detail: localize("citation.index.the_questions_references_block", "the question's references block is not in a shape this grammar can extend in place. Citing edits only that block and the basis block, and never rewrites the rest of the document.") };
      spliced = spliceBasis(withRefs, filled);
      if (!spliced)
        /* ITS OWN REASON: a member told "references" about a basis failure would look in the wrong block. */
        return { ok: false, reason: "UNSPLICEABLE_BASIS", project,
                 detail: localize("citation.index.the_questions_basis_block", "the question's basis block is not in a shape this grammar can extend in place. Citing appends legs to that block and never rewrites the rest of the document.") };
    }

    /* last_updated moves, so a Session Log entry accounts for the act (C-13.2), BOUNDED (R3): the edges are the
       record; the entry accounts for the act. On the inquiry arm it STATES how many legs were left undetermined: an
       ungraded leg is inert and invisible in the derived pair, so this is the one place a member learns it. The drift
       clause reads `answerChanged` (REC-55), so a query selection whose answer swapped at a constant count says so. */
    let text = setScalar(spliced, "last_updated", `"${when}"`);
    const shown = add.slice(0, CITE_LOG_SAMPLE);
    const listed = shown.join(", ") + (add.length > shown.length ? `, and ${add.length - shown.length} more` : "");
    const ungraded = filled.filter((l) => !l.grade).length;
    const graded = filled.length - ungraded;
    const setMovedNote = !fromFound && answerChanged(sel.drift, sel.moved)
      ? localize("citation.index.set_had_moved_since", " (the set had moved since it was made; citing is report-weight and proceeded)") : "";
    /* R3 (T35): what the act was cited FROM, a selection or a passage found by search in its document, and the
       question it was looked for for, when one was named. */
    const trigger = (fromFound
      ? localize("citation.index.trigger_a_part_found_in_capture", "Trigger: a part of {doc} found by search in capture {capture}", { doc: String(foundDoc), capture: String(foundCapture) })
      : localize("citation.index.trigger_selection_moved", "Trigger: selection {handle}{moved}", { handle: String(handle), moved: setMovedNote }))
      + (questionId ? localize("citation.index.for_question_suffix", "; for question {question}", { question: String(questionId) }) : "") + "\n";
    const logNote = nt ? localize("citation.index.log_note", " Note: {note}.", { note: nt }) : "";
    /* R27 (T53; DEC-464): a leg on a member's typing names who typed it and who has checked it, as at the act, by
       content's keys and as the caller names each member (`names`); never the original's or Civicsmith's words. */
    const typedAt = new Map();
    if (ontoInquiry)
      for (const l of filled)
        if (typeof l.content_id === "string" && !typedAt.has(l.content_id)) {
          const t = this.typedOf({ contentId: l.content_id, viewer, names });
          if (t) typedAt.set(l.content_id, t);
        }
    const logTyped = [...typedAt.entries()].map(([cid, t]) =>
      localize("citation.index.log_typed_passage", "Passage {content_id}: {label}.\n", { content_id: cid, label: t.label })).join("");
    const logHead = ontoInquiry
      ? (add.length === 1
        ? localize("citation.index.session_rested_one_record", "### Session {when} | Rested this question on 1 record ({role}) | {who}\n", { when, role: rl, who: author || "member" })
        : localize("citation.index.session_rested_many_records", "### Session {when} | Rested this question on {count} records ({role}) | {who}\n", { when, count: String(add.length), role: rl, who: author || "member" }))
      : (add.length === 1
        ? localize("citation.index.session_cited_one_record", "### Session {when} | Cited 1 record | {who}\n", { when, who: author || "member" })
        : localize("citation.index.session_cited_many_records", "### Session {when} | Cited {count} records | {who}\n", { when, count: String(add.length), who: author || "member" }));
    text = appendSessionLog(text, ontoInquiry
      ? logHead + trigger
        + localize("citation.index.changes_basis_legs_added", "Changes: basis legs added for {listed}, each with role {role}. Grades: {graded} filled from the record's own resolutions to this question's subject; {ungraded} left undetermined and stated.{note}\n", { listed, role: rl, graded: String(graded), ungraded: String(ungraded), note: logNote })
        + logTyped
      : logHead + trigger
        + localize("citation.index.changes_cites_edges_added", "Changes: cites edges added to {listed}.{note}\n", { listed, note: logNote }));

    /* Past the inline bound, refused here in words that name the real limit (a maximum legal selection once reached
       the write as OVERSIZE_INLINE), the whole call rather than a prefix, which would silently change which records
       the click meant. `roomFor` is an estimate that errs toward "fewer would fit"; it never decides the refusal. */
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX) {
      const perEdge = CITE_EDGE_BYTES + (edgePins.size ? CITE_PIN_BYTES : 0);
      const overhead = bytes.length - add.length * perEdge;
      return { ok: false, reason: "CITATION_TOO_LARGE",
               project, handle, drift: sel.drift,
               requested: add.length, bytes: bytes.length, limit: INLINE_MAX,
               roomFor: Math.max(0, Math.floor((INLINE_MAX - overhead) / perEdge)),
               detail: localize("citation.index.citing_this_many_records", "citing this many records at once would push this {object}'s bundle.md past the 1MB inline limit. Every edge is written into the document, so the ceiling is on edges in ONE object, not on the size of a selection. Cite in smaller batches; nothing has been written.", { object: ontoInquiry ? "question" : "case" }) };
    }

    const fm = doc.data;
    /* The type from the DOCUMENT (op=conclude's precedent): byte-identical for a case, correct for a question. */
    const promoted = this.#write(project, p, text, when, author, fm, fm.object_type ?? p.type);
    /* THE WRITE'S REFUSALS COME BACK UNCHANGED (inquiry R11: BASIS_REFUSED, SELF_BASIS, BASIS_CYCLE; since T42 the
       machine-passage read R11 asks, inquiry R62 with run-productions R25: PROPOSAL_NOT_TAKEN_UP,
       MACHINE_PASSAGE_UNCHECKED; N834): this act composes legs; the write judges them. No seam of its own (K2608). */
    if (!promoted.ok)
      return { ...promoted, project, handle, drift: sel.drift,
               ...(promoted.reason === "BASIS_REFUSED" ? { repairs: [] } : {}) };

    return { ok: true, project, handle, weight: "report", moved: sel.moved, drift: sel.drift,
             cited: add.slice().sort(), alreadyCited: already.sort(), severed: [], question: questionId,
             ...(ontoInquiry ? {} : { pinned_captures: Object.fromEntries(
               add.slice().sort().map((t) => [t, edgePins.get(t) ?? null])) }),
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion,
             gate: sel.gate, expires: sel.expires,
             /* R3: what the act landed on the question, per leg, from the leg it composed (never an echo of the
                request): the role, the grade the RECORD earned with the registry's `why` or an explicit null, the
                capture it pinned, and the part as written, ABSENT for every leg that names none. */
             ...(ontoInquiry ? { citingObjectType: "inquiry", role: rl,
                                 legs: filled.map((l) => ({ target: l.target, role: l.role,
                                   grade: l.grade ?? null, grade_axis: l.grade_axis ?? null,
                                   grade_source: l.grade_source ?? null, why: l.why ?? null,
                                   pinned_capture: l.extent_capture ?? null,
                                   ...(Object.keys(legFields).length
                                       ? { extent: citationExtent(l),
                                           ...(l.content_id ? { content_id: l.content_id } : {}) }
                                       : {}),
                                   ...(l.content_id && typedAt.has(l.content_id) ? { typed: typedAt.get(l.content_id) } : {}) })),
                                 gradesFilled: filled.filter((l) => l.grade).length,
                                 gradesUndetermined: filled.filter((l) => !l.grade).length }
                             : {}) };
  }

  /* ---- legGrade (R24) ---- */

  /** R24 (T51 fix round 10; DEC-439 to DEC-441; K5303; D-M1, C-M4): A MEMBER GRADES HOW WELL THE TEAM'S COPY SHOWS A CITED
   *  PASSAGE. One document leg of a question's `basis[]`, found by its target and its part (R22), takes the capture-axis
   *  grade the member states, with source `capture` (the only source the capture axis admits, `inquiry-grammar` R11's arm),
   *  up to the capture ceiling `inquiry.earned` answers for it (`leg-earning` R1, R8): a letter above it is refused
   *  `GRADE_OVER_CEILING` naming the ceiling, so no leg is given a grade the record did not earn (R8). The write
   *  judges the revised document again as it judges every leg (`inquiry` R11). A leg of a kind the record derives, or on
   *  another team's finding, is not the member's to grade; a leg already graded on another axis keeps that grade (a leg
   *  carries one). A grade is the member's act, so a machine is refused as it is for R16. */
  legGrade({ project = null, target = null, grade = null, reason = "", author = null, viewer = null, identity = null,
             extent = null } = {}) {
    /* DEC-49 REGION is-leggrade-member */
    if (typeof author !== "string" || !author.trim() || isMachineIdentity(author) || author.trim().toLowerCase() === "admin")
      return { ok: false, reason: "MACHINE_CANNOT_GRADE_LEG", ...rowOf(CITE_LEG_GRADE_CHECKS, "MACHINE_CANNOT_GRADE_LEG"), project,
               detail: localize("citation.index.leggrade_member_only", "only a named member says how well your team's copy shows a passage; this came from an automated or unnamed credential, so nothing was written.") };
    const obj = this.#citingObject(project, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;
    if (normalizeType(p.type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", ...rowOf(CITE_CHECKS, "NOT_AN_INQUIRY"), project, got: p.type,
               detail: localize("citation.index.leggrade_not_a_question", "{project} is not a question, and a passage is graded where a question rests on it; nothing was written.", { project: String(project) }) };
    const gr = given(grade) ? String(grade).trim() : "";
    if (!BASIS_GRADES.includes(gr))
      return { ok: false, reason: "BAD_GRADE", ...rowOf(CITE_LEG_GRADE_CHECKS, "BAD_GRADE"), project, got: given(grade) ? String(grade) : null,
               grades: BASIS_GRADES.slice(),
               detail: localize("citation.index.leggrade_bad_grade", "a grade is one letter, {grades}; nothing was written.", { grades: BASIS_GRADES.join(", ") }) };
    /* END DEC-49 REGION is-leggrade-member */
    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON", project,
               detail: localize("citation.index.leggrade_needs_reason", "a grade records WHY, and a grade with no reason is an unexplained claim about your team's copy; nothing was written.") };
    if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON", project,
               detail: localize("citation.index.a_reason_is_at_most", "a reason is at most {max} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes, so those would reshape the document rather than appear in it", { max: String(EDGE_REASON_MAX) }) };
    if (!this.inquiry || typeof this.inquiry.earned !== "function")
      return { ok: false, reason: "INQUIRY_UNAVAILABLE", project,
               detail: localize("citation.index.citing_onto_a_question_needs", "citing onto a question needs the inquiry module's role vocabulary, leg grammar and earned registry, and your team's Civicsmith was created without them, so nothing was written.") };

    const doc = this.#document(project, null);
    if (!doc.ok) return doc;
    const tg = given(target) ? String(target).trim() : "";
    const bag = isObj(extent) ? extent : {};
    const mine = partKey(bag);
    const basis = Array.isArray(doc.data.basis) ? doc.data.basis : [];
    const at = basis.findIndex((l) => isObj(l) && l.target === tg && partKey(l) === mine);
    if (at < 0)
      return { ok: false, reason: "NOT_CITED", project, target: tg || null,
               detail: localize("citation.index.leggrade_not_cited", "this question holds no leg on that passage, so there is nothing to grade. A different part of the same document is a different passage.") };
    const leg = basis[at];

    /* DEC-49 REGION is-leggrade-leg */
    const kind = IMPORTED_FINDING_RE.test(tg) ? "imported" : CALCULATION_REF_RE.test(tg) ? "calculation"
      : OCCURRENCE_REF_RE.test(tg) ? "occurrence" : DERIVED_CONNECTION_ID_RE.test(tg) ? "derived_connection"
      : normalizeType(OBJECT_TYPES[tg.split("-")[0]]) === "inquiry" ? "question" : null;
    if (kind)
      return { ok: false, reason: "LEG_NOT_GRADABLE", ...rowOf(CITE_LEG_GRADE_CHECKS, "LEG_NOT_GRADABLE"), project, target: tg, kind,
               detail: localize("citation.index.leggrade_not_gradable", "this passage is not one your team holds a copy of, so a member does not grade it: the record works its grade out from what it rests on, or takes it from the other team's edition. Nothing was written.") };
    const held = leg.grade !== undefined && leg.grade !== null && String(leg.grade).trim() !== "";
    if (held && leg.grade_axis !== "capture")
      return { ok: false, reason: "LEG_GRADE_OTHER_AXIS", ...rowOf(CITE_LEG_GRADE_CHECKS, "LEG_GRADE_OTHER_AXIS"), project, target: tg,
               axis: leg.grade_axis ?? null, grade: String(leg.grade),
               detail: localize("citation.index.leggrade_other_axis", "this passage already carries a grade of {grade} on the {axis} axis, and a passage carries one grade, so that grade is kept and nothing was written.", { grade: String(leg.grade), axis: String(leg.grade_axis ?? "unstated") }) };
    /* END DEC-49 REGION is-leggrade-leg */

    /* DEC-49 REGION is-leggrade-ceiling */
    const subject = typeof doc.data.subject_entity === "string" && doc.data.subject_entity.trim() !== ""
      ? doc.data.subject_entity.trim() : null;
    const reg = this.inquiry.earned(subject, [tg]);
    const ceil = reg && reg.earned && reg.earned.capture ? reg.earned.capture[tg] : null;
    const ceiling = ceil && ceil.mode === "ceiling" && BASIS_GRADES.includes(ceil.grade) ? ceil.grade : null;
    if (ceiling === null || BASIS_GRADES.indexOf(gr) < BASIS_GRADES.indexOf(ceiling))
      return { ok: false, reason: "GRADE_OVER_CEILING", ...rowOf(CITE_LEG_GRADE_CHECKS, "GRADE_OVER_CEILING"), project, target: tg, grade: gr,
               ceiling, why: ceil && typeof ceil.why === "string" ? ceil.why : null,
               detail: ceiling === null
                 ? localize("citation.index.leggrade_no_ceiling", "the record cannot say how well your team's copy of {target} shows it, so it cannot support any grade here; nothing was written.", { target: tg })
                 : localize("citation.index.leggrade_over_ceiling", "the most the record can support for your team's copy of {target} is {ceiling}, and {grade} is stronger; nothing was written.", { target: tg, ceiling, grade: gr }) };
    /* END DEC-49 REGION is-leggrade-ceiling */

    const spliced = setLegGrade(doc.text, at, tg, gr);
    if (!spliced)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", project,
               detail: localize("citation.index.the_questions_basis_block", "the question's basis block is not in a shape this grammar can extend in place. Citing appends legs to that block and never rewrites the rest of the document.") };
    const when = stampInstant("second", this.now());
    const who = author.trim();
    const was = held ? String(leg.grade) : null;
    let text = setScalar(spliced, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("citation.index.session_graded_leg", "### Session {when} | Graded {target} on the capture axis | {who}\n", { when, target: tg, who })
      + localize("citation.index.trigger_graded_leg", "Trigger: the member's own grade of how well the team's copy shows {target}\n", { target: tg })
      + localize("citation.index.changes_graded_leg", "Changes: basis leg on {target} graded {grade} on the capture axis, up to the record's ceiling of {ceiling}; before: {was}. Reason: {why}.\n",
                 { target: tg, grade: gr, ceiling, was: was ?? localize("citation.index.leggrade_was_none", "no grade"), why }));
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX)
      return { ok: false, reason: "CITATION_TOO_LARGE", project, bytes: bytes.length, limit: INLINE_MAX,
               detail: localize("citation.index.leggrade_too_large", "the reason would push this question's bundle.md past the 1MB inline limit; nothing has been written.") };
    const promoted = this.#write(project, p, text, when, author, doc.data, doc.data.object_type ?? p.type);
    /* The write's refusals come back unchanged (inquiry R11): it judges the revised leg as it judges every other. */
    if (!promoted.ok) return { ...promoted, project };
    const role = typeof leg.role === "string" ? leg.role : null;
    return { ok: true, project, citingObjectType: "inquiry", target: tg, role, grade: gr, grade_axis: "capture", grade_source: "capture",
             ceiling, was, why,
             leg: { target: tg, role, grade: gr, grade_axis: "capture", grade_source: "capture" },
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion };
  }

  /* ---- drawQuestion (R14) ---- */

  /** R14 (T47; N975): DRAWING ONE QUESTION INTO A CASE in one served act, with no selection and no document sent by
   *  the caller: the case gains a `confirmed` `cites` edge to the question, spliced into the case's held document and
   *  promoted, the edge and the answer exactly those `cite` writes for a one-member selection naming the question, at
   *  `report` weight (R7). So the case draws on the question (`leg-earning`'s `projectsDrawingOn`) without a member
   *  revising the whole document. Every refusal is one `cite` already answers, with its code and row; it mints none. */
  drawQuestion({ project = null, inquiry = null, note = "", author = null, viewer = null, identity = null } = {}) {
    /* No selection is resolved, so no `owner` is read: the act names its one member itself. */
    const obj = this.#citingObject(project, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;
    /* A question draws on another question by `cite` (its basis); this act is a case's. */
    if (p.type !== "project")
      return { ok: false, reason: "NOT_A_PROJECT", project, got: p.type,
               detail: localize("citation.index.a_question_is_drawn_into", "a question is drawn into a case, and this is not a case. A question rests on another question through a leg of its own basis, which citing onto it writes.") };
    const denied = this.membership.projectAuthority(project, identity, "joined", "drawquestion");
    if (denied) return denied;

    const nt = String(note ?? "");
    if (nt.length > NOTE_MAX || /["\\\r\n]/.test(nt))
      return { ok: false, reason: "BAD_NOTE", ...rowOf(CITE_CHECKS, "BAD_NOTE"),
               detail: localize("citation.index.a_note_is_at_most", "a note is at most 200 characters and cannot contain a quote, a backslash, or a newline") };

    /* The question, as `cite`'s optional question is judged (R1): an absent one and one this viewer may not see are
       answered alike. */
    const qid = given(inquiry) ? String(inquiry).trim() : "";
    const qh = qid ? this.record.head(qid) : null;
    if (!qh || !this.membership.inSight(qid, viewer))
      return { ok: false, reason: "NO_SUCH_QUESTION", ...rowOf(CITE_CHECKS, "NO_SUCH_QUESTION"), project, question: qid || null,
               detail: localize("citation.index.no_question_drawn_into_case", "no question by that id is one you can see, so it cannot be drawn into this case; nothing was written.") };
    if (normalizeType(qh.type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", ...rowOf(CITE_CHECKS, "NOT_AN_INQUIRY"), project, question: qid,
               got: qh.type,
               detail: localize("citation.index.not_a_question_drawn_into", "{qid} is not a question, so it cannot be drawn into this case as one; nothing was written.", { qid }) };
    if (this.retiredNotCitable(qid))
      return { ok: false, reason: "RETIRED_NOT_CITABLE", ...rowOf(CITE_CHECKS, "RETIRED_NOT_CITABLE"),
               project, handle: null, offenders: [qid], drift: false,
               detail: localize("citation.index.the_team_has_retired_this", "the team has RETIRED this, recording that it is superseded or no longer stands, and drawing on it now would read to every later member as live support. Draw on what superseded it.") };

    const doc = this.#document(project, localize("citation.index.projects_bundle_md_does_not_parse", "the project's own bundle.md does not parse under the restricted grammar"));
    if (!doc.ok) return doc;
    /* SEVERED IS NOT ABSENT (R1's rule): a severed edge is a recorded decision, restored by `reinstate` (R4) with its
       own reason, never re-drawn. Any other `cites` edge to it means the case already draws on it. */
    const edge = (Array.isArray(doc.data.references) ? doc.data.references : [])
      .find((r) => r && typeof r === "object" && r.rel === "cites" && r.target === qid);
    if (edge && edge.status === "severed")
      return { ok: false, reason: "SEVERED_EDGE", ...rowOf(CITE_CHECKS, "SEVERED_EDGE"), project, handle: null,
               offenders: [qid], drift: false,
               detail: localize("citation.index.this_case_already_carries", "this case already carries a SEVERED edge to this question, which is a recorded decision to cut the dependency, not the absence of one. Drawing on it again would neither reverse that decision silently nor skip past it. Reinstating a severance is a separate action that records its own reason.") };
    const base = { ok: true, project, handle: null, weight: "report", moved: false, drift: false };
    if (edge)
      return { ...base, cited: [], alreadyCited: [qid], severed: [], question: null,
               bundleSha: p.bundleSha, rowVersion: null,
               detail: localize("citation.index.this_case_already_draws", "this case already draws on this question; nothing was written") };

    /* THE WRITE, `cite`'s case arm for a one-member selection: one `confirmed` `cites` edge carrying the note, no
       pin (a question has no bytes, DEC-21), the references block extended in place and nothing else rewritten. */
    const spliced = spliceReferences(doc.text, [{ rel: "cites", target: qid, status: "confirmed", note: nt }]);
    if (!spliced)
      return { ok: false, reason: "UNSPLICEABLE_REFERENCES", project,
               detail: localize("citation.index.drawing_references_block", "the project's references block is not in a shape this grammar can extend in place. Drawing a question in edits only that block and never rewrites the rest of the document.") };
    const when = stampInstant("second", this.now());
    let text = setScalar(spliced, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("citation.index.session_cited_one_record", "### Session {when} | Cited 1 record | {who}\n", { when, who: author || "member" })
      + localize("citation.index.trigger_question_drawn", "Trigger: question {qid} drawn into this case\n", { qid })
      + localize("citation.index.changes_cites_edges_added", "Changes: cites edges added to {listed}.{note}\n", { listed: qid, note: nt ? localize("citation.index.log_note", " Note: {note}.", { note: nt }) : "" }));
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX)
      return { ok: false, reason: "CITATION_TOO_LARGE", project, handle: null, drift: false,
               requested: 1, bytes: bytes.length, limit: INLINE_MAX,
               roomFor: 0,
               detail: localize("citation.index.drawing_this_question_in_would", "drawing this question in would push this case's bundle.md past the 1MB inline limit. Every edge is written into the document; nothing has been written.") };
    const promoted = this.#write(project, p, text, when, author, doc.data, doc.data.object_type ?? p.type);
    if (!promoted.ok) return { ...promoted, project, handle: null, drift: false };
    return { ...base, cited: [qid], alreadyCited: [], severed: [], question: null, pinned_captures: { [qid]: null },
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion, gate: null, expires: null };
  }

  /* ---- citeImported, withdrawImported (R16, R17) ---- */

  /* R16, R17: only a named member rests a question on another team's finding or takes it back. A machine is record-grammar's
     whole question (`isMachineIdentity`), and the bare founder's viewer `admin` names no member (membership R43). */
  #importedMemberRefusal(author, inquiry) {
    /* DEC-49 REGION is-cite-imported-member */
    if (typeof author !== "string" || !author.trim() || isMachineIdentity(author) || author.trim().toLowerCase() === "admin")
      return { ok: false, reason: "MACHINE_CANNOT_CITE_IMPORTED", ...rowOf(CITE_IMPORTED_CHECKS, "MACHINE_CANNOT_CITE_IMPORTED"), inquiry,
               detail: localize("citation.index.imported_member_only", "only a named member rests a question on another team's finding or takes it back; this came from an automated or unnamed credential, so nothing was written.") };
    /* END DEC-49 REGION is-cite-imported-member */
    return null;
  }

  /* The question both acts name, through sight (R9) and then its type. */
  #importedQuestion(inquiry, viewer) {
    const obj = this.#citingObject(inquiry, viewer);
    if (!obj.ok) return obj;
    if (normalizeType(obj.head.type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", ...rowOf(CITE_CHECKS, "NOT_AN_INQUIRY"), inquiry, got: obj.head.type,
               detail: localize("citation.index.imported_not_a_question", "{inquiry} is not a question, and another team's finding is cited from a question; nothing was written.", { inquiry: String(inquiry) }) };
    return obj;
  }

  /* R16: what the other team's case published, read once the leg stands, from accepted-work's one door: the group, the
     case, the edition and the acceptance (by, at, reason), and how many flags are open on it. Null when it cannot be read. */
  #originOf(ref, edition, viewer) {
    const aw = this.acceptedWork;
    if (!aw || typeof aw.acceptedFinding !== "function") return null;
    try {
      const a = aw.acceptedFinding({ ref, edition, viewer });
      if (!isObj(a) || a.absent === true || a.unreadable === true || !isObj(a.acceptance)) return null;
      const f = typeof aw.openFlagsOn === "function" ? aw.openFlagsOn({ ref, edition, viewer }) : null;
      const open = isObj(f) && Array.isArray(f.flags) ? f.flags.length : null;
      return { group: a.group ?? null, case: a.case ?? null, edition: a.edition ?? edition, finding: a.finding ?? null,
               acceptance: { by: a.acceptance.by ?? null, at: a.acceptance.at ?? null, reason: a.acceptance.reason ?? null },
               openFlags: open };
    } catch { return null; }
  }

  /** R16 (T51; K4189; UC-082): RESTING A QUESTION ON ANOTHER TEAM'S ACCEPTED FINDING at one named edition: one leg on
   *  the question's `basis[]`, `target`, `target_edition`, `role` and `note`, nothing else. No grade is written: the leg
   *  is read as the edition publishes it, never stronger (`strength` R33), and the target is not in `references[]`
   *  (`inquiry-grammar` R11). Whether the edition is accepted is not asked here: the write asks it (`accepted-work` R3,
   *  R4), and its refusal comes back unchanged inside `BASIS_REFUSED`. */
  citeImported({ inquiry = null, import: importId = null, finding = null, edition = null, role = null, note = "",
                 author = null, viewer = null, identity = null } = {}) {
    const machine = this.#importedMemberRefusal(author, inquiry);
    if (machine) return machine;
    const obj = this.#importedQuestion(inquiry, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;

    /* DEC-49 REGION is-cite-imported-shape */
    const ref = importedFindingRef(importId, finding);
    if (!ref)
      return { ok: false, reason: "IMPORTED_REF_MALFORMED", ...rowOf(CITE_IMPORTED_CHECKS, "IMPORTED_REF_MALFORMED"), inquiry,
               detail: localize("citation.index.imported_ref_malformed", "the import and the finding named here do not spell another team's finding, so there is nothing to rest the question on; nothing was written.") };
    const ed = editionOf(edition);
    if (ed === null)
      return { ok: false, reason: "IMPORTED_EDITION_MALFORMED", ...rowOf(CITE_IMPORTED_CHECKS, "IMPORTED_EDITION_MALFORMED"), inquiry, ref,
               detail: localize("citation.index.imported_edition_malformed", "an edition is a whole number of one or more, the edition of the other team's case your team accepted, because each edition is its own document with its own published grades; nothing was written.") };
    /* END DEC-49 REGION is-cite-imported-shape */

    if (!this.inquiry || !Array.isArray(this.inquiry.BASIS_ROLES))
      return { ok: false, reason: "INQUIRY_UNAVAILABLE", inquiry,
               detail: localize("citation.index.citing_onto_a_question_needs", "citing onto a question needs the inquiry module's role vocabulary, leg grammar and earned registry, and your team's Civicsmith was created without them, so nothing was written.") };
    const roles = this.inquiry.BASIS_ROLES;
    const rl = role === null || role === undefined || String(role) === "" ? null : String(role);
    if (rl === null)
      return { ok: false, reason: "NO_ROLE", ...rowOf(CITE_CHECKS, "NO_ROLE"), inquiry, ref, roles: roles.slice(),
               detail: localize("citation.index.a_leg_of_a_questions_basis", "a leg of a question's basis says what the material DOES for the answer, and this call does not say. It is never assumed: a leg that cuts against the case is first-class here, and guessing would put a claim about your own reasoning in the record that you did not make. State role as one of: {roles}.", { roles: roles.join(", ") }) };
    if (!roles.includes(rl))
      return { ok: false, reason: "BAD_ROLE", ...rowOf(CITE_CHECKS, "BAD_ROLE"), inquiry, ref, got: rl, roles: roles.slice(),
               detail: localize("citation.index.rl_is_not_a_role", "'{rl}' is not a role a basis leg can carry. The set is closed and is published by op=affordances beside the act: {roles}.", { rl, roles: roles.join(", ") }) };
    const nt = String(note ?? "");
    if (nt.length > NOTE_MAX || /["\\\r\n]/.test(nt))
      return { ok: false, reason: "BAD_NOTE", ...rowOf(CITE_CHECKS, "BAD_NOTE"),
               detail: localize("citation.index.a_note_is_at_most", "a note is at most 200 characters and cannot contain a quote, a backslash, or a newline") };

    const doc = this.#document(inquiry, localize("citation.index.projects_bundle_md_does_not_parse", "the project's own bundle.md does not parse under the restricted grammar"));
    if (!doc.ok) return doc;
    /* Already resting on this finding: ok, nothing written. A later edition is `reevaluation`'s act (DEC-12), not a second leg. */
    const held = (Array.isArray(doc.data.basis) ? doc.data.basis : []).find((l) => isObj(l) && l.target === ref);
    if (held)
      return { ok: true, inquiry, citingObjectType: "inquiry", cited: [], alreadyCited: [ref],
               edition: Number.isInteger(held.target_edition) ? held.target_edition : null,
               bundleSha: p.bundleSha, rowVersion: null,
               detail: localize("citation.index.imported_already_cited", "this question already rests on that finding; nothing was written. Moving to a later edition is the re-evaluation's act, not a second leg.") };

    const spliced = spliceBasis(doc.text, [{ target: ref, role: rl, target_edition: ed, note: nt }]);
    if (!spliced)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", inquiry,
               detail: localize("citation.index.the_questions_basis_block", "the question's basis block is not in a shape this grammar can extend in place. Citing appends legs to that block and never rewrites the rest of the document.") };
    const when = stampInstant("second", this.now());
    const who = author || "member";
    let text = setScalar(spliced, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("citation.index.session_rested_on_imported", "### Session {when} | Rested this question on another team's finding ({role}) | {who}\n", { when, role: rl, who })
      + localize("citation.index.trigger_imported_finding", "Trigger: {ref} at edition {edition}\n", { ref, edition: String(ed) })
      + localize("citation.index.changes_imported_leg_added", "Changes: basis leg added for {ref} at edition {edition}, role {role}. Grade: as that edition published it, none of its own.{note}\n", { ref, edition: String(ed), role: rl, note: nt ? localize("citation.index.log_note", " Note: {note}.", { note: nt }) : "" }));
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX)
      return { ok: false, reason: "CITATION_TOO_LARGE", inquiry, bytes: bytes.length, limit: INLINE_MAX,
               detail: localize("citation.index.imported_would_be_too_large", "resting on this finding would push this question's bundle.md past the 1MB inline limit; nothing has been written.") };

    const promoted = this.#write(inquiry, p, text, when, author, doc.data, doc.data.object_type ?? p.type);
    /* The write's refusals come back unchanged: BASIS_REFUSED carrying IMPORTED_NOT_ACCEPTED (C-21.4) or ACCEPTED_WORK_UNREADABLE
       (C-21.5) from accepted-work's check, DIVIDED_CANNOT_RESTRUCTURE, the rest of inquiry R11's. */
    if (!promoted.ok) return { ...promoted, inquiry };

    return { ok: true, inquiry, citingObjectType: "inquiry", role: rl, cited: [ref], alreadyCited: [],
             legs: [{ target: ref, target_edition: ed, role: rl }], gradesFilled: 0,
             origin: this.#originOf(ref, ed, viewer ?? author),
             inherits: localize("citation.index.imported_inherits_publication", "citing this inherits the fact of publication, not the credibility of its content"),
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion };
  }

  /** R17 (T51; K4189; R15): TAKING THAT LEG BACK. `sever` cannot (an imported leg is not in `references[]`), so this
   *  removes the leg from the live `basis[]` with a Session Log entry; the earlier bytes stay in history and each frozen
   *  version keeps its copy (`basis-versions` R29). */
  withdrawImported({ inquiry = null, import: importId = null, finding = null, reason = "", author = null, viewer = null,
                     identity = null } = {}) {
    const machine = this.#importedMemberRefusal(author, inquiry);
    if (machine) return machine;
    const obj = this.#importedQuestion(inquiry, viewer);
    if (!obj.ok) return obj;
    const p = obj.head;

    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("citation.index.imported_withdraw_needs_reason", "taking another team's finding off a question records WHY, and a change with no reason is an unexplained change; nothing was written.") };
    if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: localize("citation.index.a_reason_is_at_most", "a reason is at most {max} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes, so those would reshape the document rather than appear in it", { max: String(EDGE_REASON_MAX) }) };

    const doc = this.#document(inquiry, localize("citation.index.projects_bundle_md_does_not_parse", "the project's own bundle.md does not parse under the restricted grammar"));
    if (!doc.ok) return doc;
    const ref = importedFindingRef(importId, finding);
    const resting = ref !== null && (Array.isArray(doc.data.basis) ? doc.data.basis : []).some((l) => isObj(l) && l.target === ref);
    if (!resting)
      return { ok: false, reason: "NOT_CITED", inquiry, ref,
               detail: localize("citation.index.imported_not_cited", "this question holds no leg on that finding, so there is nothing to take back. A leg on a document or a question is severed, not withdrawn.") };

    const cut = removeBasisLegs(doc.text, ref);
    if (!cut)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", inquiry,
               detail: localize("citation.index.imported_basis_block_not_editable", "the question's basis block is not in a shape this grammar can edit in place; nothing was written.") };
    const when = stampInstant("second", this.now());
    const editions = cut.editions.filter((e) => e !== null);
    let text = setScalar(cut.text, "last_updated", `"${when}"`);
    text = appendSessionLog(text,
      localize("citation.index.session_took_imported_back", "### Session {when} | Took another team's finding back off this question | {who}\n", { when, who: author || "member" })
      + localize("citation.index.trigger_imported_finding", "Trigger: {ref} at edition {edition}\n", { ref, edition: editions.join(", ") })
      + localize("citation.index.changes_imported_leg_removed", "Changes: basis leg on {ref} (edition {edition}) removed. Reason: {why}.\n", { ref, edition: editions.join(", "), why }));
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > INLINE_MAX)
      return { ok: false, reason: "CITATION_TOO_LARGE", inquiry, bytes: bytes.length, limit: INLINE_MAX,
               detail: localize("citation.index.imported_withdraw_too_large", "the reason would push this question's bundle.md past the 1MB inline limit; nothing has been written.") };
    const promoted = this.#write(inquiry, p, text, when, author, doc.data, doc.data.object_type ?? p.type);
    if (!promoted.ok) return { ...promoted, inquiry };
    return { ok: true, inquiry, citingObjectType: "inquiry", withdrawn: [ref], editions, why,
             bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion };
  }
}

/* ------------------------------------------------------------------ reaching it */

const instances = new WeakMap();

/* inquiry's services this module builds against (inquiry R13, R5, R4, and R12's leg projection read back for R13,
   `restingOn`; K2132), from its instance and its exports. */
export function inquiryServices(k) {
  return { earned: (subject, targets, contentIds) => k.earned(subject, targets, contentIds), checkLegExtentGrammar, BASIS_ROLES,
           restingOn: (targetId) => k.restingOn(targetId) };
}

export function citationOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const content = d.content || contentOf(host, { record, membership });
    const retrieval = d.retrieval || retrievalOf(host, { record, membership, promotion });
    const inquiry = d.inquiry || inquiryServices(inquiryOf(host, { record, membership, promotion, content }));
    const provenance = d.provenance || provenanceOf(host, { record, membership, promotion });
    const acceptedWork = d.acceptedWork || acceptedWorkOf(host, { record, promotion });
    c = new Citation({ ...d, storage: d.storage || host.storage, record, membership, promotion, content, retrieval, provenance, inquiry, acceptedWork });
    instances.set(host, c);
    /* R13 (retrieval R76): the read registered once, at start, against the one retrieval instance `findIn` runs on (the
       plane's boot reaches this factory before the first request). A stand-in that offers no registration is left alone. */
    if (retrieval && typeof retrieval.registerRecordedBy === "function")
      retrieval.registerRecordedBy("citation", (a) => c.recordedBy(a));
  }
  return c;
}

/* The Durable Object routes this module answers, as entries of the plane's one route map (plane R5: `routes` spreads
   them in, and control-plane's `dispatch` answers every store request over it; K3). `url` carries the control plane's stamps (`viewer`, `owner`, `author`, `identity`); weight is never read
   from the caller (R7). */
function foundParam(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

export function citationOps(c, url, body) {
  const q = (key) => url.searchParams.get(key);
  /* C31, R20 (K4308): `cite` WRITES, so it takes its fields from the POST body; where the body does not carry one, the
     address's value is still read (a caller not yet moved), and the body wins where both are sent. A call naming no source
     is refused CITE_ONE_SOURCE, writing nothing. The door's stamps (`viewer`, `owner`, `author`, `identity`) stay in the
     address. Weight is read from nowhere (R7). */
  const b = isObj(body) ? body : {};
  const has = (key) => b[key] !== undefined && b[key] !== null;
  const s = (key) => (has(key) ? String(b[key]) : q(key));
  const bag = [...url.searchParams].filter(([k]) => k === "content_id" || k.startsWith("extent_"));
  const part = Object.fromEntries([...bag, ...Object.entries(b).filter(([k]) => k === "content_id" || k.startsWith("extent_"))
                                                              .map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])]);
  return {
    cite: () => c.cite({
      project: s("project"), handle: s("handle"), viewer: q("viewer"), owner: q("owner"),
      note: s("note") ?? "", author: q("author"), identity: q("identity"),
      /* REC-37: the leg's ROLE, read only on the inquiry arm and REFUSED rather than dropped on the other. */
      role: s("role"), ground: s("ground"),
      /* REC-97 / IC-90: every parameter the leg-part grammar could own arrives WHOLE and the act decides, by name,
         which ones it carries; a named `get()` per field is what once dropped a part in silence. None sent is an empty
         bag, which is `document`. */
      extent: part,
      /* T35 (N698): a found match travels as one value, read whole: an object, or one JSON string parsed; one that does
         not parse is passed on as sent, for FOUND_MALFORMED to name. `question` is the optional question it was looked
         for for. */
      found: foundParam(has("found") ? b.found : q("found")),
      question: s("question"),
      /* R27: how the caller names each member a typed passage credits, an object (or one JSON string). */
      names: foundParam(has("names") ? b.names : q("names")),
    }),
    sever: () => c.sever({ project: q("project"), handle: q("handle"), viewer: q("viewer"), owner: q("owner"),
                           reason: q("reason") ?? "", author: q("author"), identity: q("identity"),
                           /* R25: the passage, by its part, as `cite` names it. */
                           extent: part }),
    reinstate: () => c.reinstate({ project: q("project"), handle: q("handle"), viewer: q("viewer"), owner: q("owner"),
                                   reason: q("reason") ?? "", author: q("author"), identity: q("identity"),
                                   /* R23: optional; body-first as `cite`'s (R20). */
                                   role: s("role"), extent: part }),
    /* R14 (T47; N975): one question drawn into a case, named by `inquiry`; no selection and no document. */
    drawquestion: () => c.drawQuestion({ project: q("project"), inquiry: q("inquiry"), note: q("note") ?? "",
                                         author: q("author"), viewer: q("viewer"), identity: q("identity") }),
    /* R24 (T51 fix round 10): a member grades how well the team's copy shows a cited passage; the fields from the body first, as
       `cite`'s (R20), the passage's part by its `content_id` or `extent_*` fields. */
    leggrade: () => c.legGrade({ project: s("project"), target: s("target"), grade: s("grade"), reason: s("reason") ?? "",
                                 extent: part, author: q("author"), viewer: q("viewer"), identity: q("identity") }),
    /* R16, R17 (T51; K4189): a question rests on another team's accepted finding at an edition, and takes it back. */
    citeimported: () => c.citeImported({ inquiry: q("inquiry"), import: q("import"), finding: q("finding"), edition: q("edition"),
                                         role: q("role"), note: q("note") ?? "", author: q("author"), viewer: q("viewer"),
                                         identity: q("identity") }),
    withdrawimported: () => c.withdrawImported({ inquiry: q("inquiry"), import: q("import"), finding: q("finding"),
                                                reason: q("reason") ?? "", author: q("author"), viewer: q("viewer"),
                                                identity: q("identity") }),
  };
}

/* R18 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that a screen sends or that this
   tranche adds, declared by their owner beside the ops map. Class, mutating and weight are the op's existing rows'
   (`op-declarations`, `op-grades`; the two new ops' are K4189's table); the fields are what each arm reads from the address.
   The stamps (`viewer`, `owner`, `author`, `identity`) are the door's. A part of a document travels as `extent_*` fields and
   `content_id` (EXTENT_PARAMS); `cite` refuses any other `extent_*` by name (C-45.7). */
export const DECLARED_OPS = Object.freeze({
  cite: { classes: ["admin", "member", "probe"], mutating: true, needs: "contribute", weight: "reversible",
    description: localize("citation.declared.cite", "cites material or a question into a case's references or a question's basis, and sever takes it back"),
    fields: { accepts: ["project", "handle", "found", "question", "note", "role", "ground", "names", ...Object.keys(EXTENT_PARAMS)],
              requires: ["project", ["handle", "found"]] } },
  drawquestion: { classes: ["admin", "member", "probe"], mutating: true, needs: "contribute", weight: "reversible",
    description: localize("citation.declared.drawquestion", "project-directed: keyed by a project and one question; draws the question into the project as a confirmed `cites` edge and promotes the project; moves the project's bundle"),
    fields: { accepts: ["project", "inquiry", "note"], requires: ["project", "inquiry"] } },
  sever: { classes: ["admin", "member", "probe"], mutating: true, needs: "contribute", weight: "reasoned", refusal: "NO_REASON",
    description: localize("citation.declared.sever", "moves a case's cites edge, or a question's own leg, to severed with the member's reason; nothing is deleted"),
    fields: { accepts: ["project", "handle", "reason", ...Object.keys(EXTENT_PARAMS)], requires: ["project", "handle", "reason"] } },
  reinstate: { classes: ["admin", "member", "probe"], mutating: true, needs: "contribute", weight: "reasoned", refusal: "NO_REASON",
    description: localize("citation.declared.reinstate", "moves a severed cites edge, or a question's severed leg, back to confirmed with the member's reason"),
    fields: { accepts: ["project", "handle", "reason", "role", ...Object.keys(EXTENT_PARAMS)], requires: ["project", "handle", "reason"] } },
  leggrade: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["author", "viewer"], needs: "contribute", weight: "reversible",
    description: localize("citation.declared.leggrade", "a member's grade of how well your team's copy shows a passage a question rests on, up to the most the record supports, with the reason"),
    fields: { accepts: ["project", "target", "grade", "reason", ...Object.keys(EXTENT_PARAMS)],
              requires: ["project", "target", "grade", "reason"] } },
  citeimported: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["author", "viewer"], needs: "contribute", weight: "reversible",
    description: localize("citation.declared.citeimported", "rests a question on another team's accepted finding at the edition shown; the grade is the edition's own, and withdrawimported takes it back"),
    fields: { accepts: ["inquiry", "import", "finding", "edition", "role", "note"],
              requires: ["inquiry", "import", "finding", "edition", "role"] } },
  withdrawimported: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["author", "viewer"], needs: "contribute", weight: "reasoned", refusal: "NO_REASON",
    description: localize("citation.declared.withdrawimported", "takes another team's finding off a question's answer with the member's reason; the history keeps it, and so does each version already frozen"),
    fields: { accepts: ["inquiry", "import", "finding", "reason"], requires: ["inquiry", "import", "finding", "reason"] } },
});
